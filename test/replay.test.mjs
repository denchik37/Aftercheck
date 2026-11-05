import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sealEvidence} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {rpcFixture,policyFixture} from './helpers/uniswap-fixture.mjs';
import {canonicalJson} from '../src/json.ts';
import {readJsonFile} from '../src/io.ts';

test('offline entry point binds policy and evidence and regenerates deterministic exact results',()=>{
  const evidence=sealEvidence(rpcFixture());
  const report=verifyEvidence(evidence,policyFixture());
  assert.equal(report.verdict,'PASS');assert.equal(report.support,'SUPPORTED_TEST_PROFILE');
  assert.equal(report.verificationMode,'OFFLINE_REPLAY');
  assert.equal(canonicalJson(report),canonicalJson(verifyEvidence(evidence,policyFixture())));
  const violation=verifyEvidence(evidence,policyFixture({maxInputRaw:'499'}));
  assert.equal(violation.verdict,'VIOLATION');assert.notEqual(violation.policyDigest,report.policyDigest);
  assert.equal(violation.evidenceDigest,report.evidenceDigest);
  const unknown=verifyEvidence(evidence,policyFixture({reserveFloorRaw:'0'}));
  assert.equal(unknown.verdict,'UNKNOWN');assert.equal(unknown.checks.at(-1).result,'UNKNOWN');
});
test('digest mismatch, unknown policy keys and contradictory re-sealed evidence never pass',()=>{
  const evidence=sealEvidence(rpcFixture());evidence.receipt.logs[0].data='0x'+'0'.repeat(64);
  assert.throws(()=>verifyEvidence(evidence,policyFixture()),/DIGEST_MISMATCH/);
  assert.throws(()=>verifyEvidence(sealEvidence(rpcFixture()),{...policyFixture(),unexpected:'ignored?'}),/Unknown policy field/);
  const inconsistent=rpcFixture();inconsistent.receipt.transactionHash='0x'+'f'.repeat(64);
  const report=verifyEvidence(sealEvidence(inconsistent),policyFixture());
  assert.equal(report.execution,'UNKNOWN');assert.equal(report.verdict,'UNKNOWN');assert.equal(report.coverage,'CONFLICTED');
});
test('CLI verify exports portable evidence/policy/reports while every network primitive is disabled',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'aftercheck-replay-'));
  try{
    const evidence=join(dir,'evidence.json'),policy=join(dir,'policy.json'),guard=join(dir,'offline.mjs'),out=join(dir,'out');
    await writeFile(evidence,canonicalJson(sealEvidence(rpcFixture())));
    await writeFile(policy,canonicalJson(policyFixture()));
    await writeFile(guard,`import net from 'node:net'; import http from 'node:http'; import https from 'node:https'; import dns from 'node:dns'; const fail=()=>{throw Error('NETWORK_FORBIDDEN_DURING_REPLAY')};globalThis.fetch=fail;net.Socket.prototype.connect=fail;http.request=fail;https.request=fail;dns.lookup=fail;`);
    const run=()=>spawnSync(process.execPath,['--import',guard,resolve('bin/aftercheck.mjs'),'verify',evidence,policy,out],{encoding:'utf8',env:{...process.env,AFTERCHECK_RPC_URL:'https://unreachable.invalid/SHOULD_NOT_BE_USED'}});
    const result=run();assert.equal(result.status,0,result.stderr);
    const first=await readFile(join(out,'report.json'),'utf8');
    for(const file of ['evidence.json','policy.json','report.json','report.md'])assert.ok((await stat(join(out,file))).size>0);
    assert.equal(run().status,0);assert.equal(await readFile(join(out,'report.json'),'utf8'),first);
    await writeFile(policy,canonicalJson(policyFixture({minReceivedRaw:'351'})));assert.equal(run().status,2);
    await writeFile(policy,canonicalJson(policyFixture({reserveFloorRaw:'100'})));assert.equal(run().status,3);
    await writeFile(policy,'{"schemaVersion":"x","schemaVersion":"aftercheck.policy.v1"}');assert.equal(run().status,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('bounded file reads reject oversized input before parsing and malformed UTF-8',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'aftercheck-file-'));
  try{
    const file=join(dir,'data.json');await writeFile(file,'x'.repeat(65));
    await assert.rejects(readJsonFile(file,64),/SIZE_LIMIT/);
    await writeFile(file,Buffer.from([0x22,0xc3,0x28,0x22]));await assert.rejects(readJsonFile(file));
    await assert.rejects(readJsonFile(dir),/SIZE_LIMIT/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
