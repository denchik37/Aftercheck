import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {transactionHash, policyFixture} from './helpers/uniswap-fixture.mjs';

const cli = resolve('bin/aftercheck.mjs');
const preload = resolve('test/helpers/simulated-rpc-preload.mjs');
const endpoint = 'https://simulated-rpc.invalid/KEY_DO_NOT_PRINT';
const json = value => JSON.stringify(value);
function run(policyPath,out,scenario='complete',hash=transactionHash,endpointOverride=endpoint) {
  return spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','--experimental-strip-types',
    '--import',preload,cli,'inspect',hash,policyPath,out],{
    encoding:'utf8',timeout:15_000,env:{...process.env,AFTERCHECK_RPC_URL:endpointOverride,
      AFTERCHECK_TEST_RPC_SCENARIO:scenario}
  });
}
async function setup(t) {
  const root=await fs.mkdtemp(join(tmpdir(),'aftercheck-inspect-cli-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  return {root,out:join(root,'report')};
}
async function policyFile(root,name,contents) {
  const path=join(root,name+'.json');
  await fs.writeFile(path,typeof contents==='string'?contents:json(contents));
  return path;
}
async function report(out) {
  return JSON.parse(await fs.readFile(join(out,'report.json'),'utf8'));
}

test('CLI inspect publishes a coherent four-file set from one simulated read-only RPC source',async t=>{
  const {root,out}=await setup(t);
  const p=await policyFile(root,'base',policyFixture());
  const call=run(p,out);
  assert.equal(call.status,0,call.stderr);
  assert.match(call.stdout,/execution=SUCCEEDED support=SUPPORTED evidence=COMPLETE verdict=PASS/);
  assert.doesNotMatch(call.stdout+call.stderr,/KEY_DO_NOT_PRINT|simulated-rpc.invalid/);
  assert.deepEqual((await fs.readdir(out)).sort(),['evidence.json','policy.json','report.json','report.md']);
  const evidence=JSON.parse(await fs.readFile(join(out,'evidence.json'),'utf8'));
  const result=await report(out);
  assert.equal(result.evidenceDigest,evidence.digest);
  assert.equal(result.verdict,'PASS');
  assert.equal(result.protocol.amountInRaw,'500');
  assert.equal(result.protocol.amountOutRaw,'350');
  assert.deepEqual(JSON.parse(await fs.readFile(join(out,'policy.json'),'utf8')),policyFixture());
  assert.match(await fs.readFile(join(out,'report.md'),'utf8'),/Logged output:/i);
});

test('one-command policy changes produce VIOLATION and reserve UNKNOWN without stale PASS files',async t=>{
  const {root,out}=await setup(t);
  const pass=await policyFile(root,'pass',policyFixture());
  const violation=await policyFile(root,'violation',policyFixture({maxInputRaw:'499'}));
  const reserve=await policyFile(root,'reserve',policyFixture({reserveFloorRaw:'1'}));
  assert.equal(run(pass,out).status,0);
  assert.equal(run(violation,out).status,2);
  const failed=await report(out);
  assert.equal(failed.verdict,'VIOLATION');
  assert.equal(failed.checks.find(x=>x.id==='maxInputRaw').result,'VIOLATION');
  assert.equal(run(reserve,out).status,3);
  const unknown=await report(out);
  assert.equal(unknown.verdict,'UNKNOWN');
  assert.equal(unknown.coverage,'PARTIAL');
  assert.equal(unknown.checks.find(x=>x.id==='reserveFloorRaw').result,'UNKNOWN');
});

test('incomplete reads and changed canonical blocks yield saved UNKNOWN reports',async t=>{
  const {root,out}=await setup(t);
  const p=await policyFile(root,'base',policyFixture());
  for (const scenario of ['unavailable-chain','missing-history','reorg']) {
    const call=run(p,out,scenario);
    assert.equal(call.status,3,scenario+': '+call.stderr);
    const result=await report(out);
    assert.equal(result.verdict,'UNKNOWN');
    if (scenario==='reorg') assert.equal(result.coverage,'CONFLICTED');
    assert.doesNotMatch(call.stdout+call.stderr,/private provider message|KEY_DO_NOT_PRINT/);
  }
});

test('invalid policy, wrong chain, hash and endpoint cannot overwrite existing verified output',async t=>{
  const {root,out}=await setup(t);
  const p=await policyFile(root,'base',policyFixture());
  assert.equal(run(p,out).status,0);
  const files=await Promise.all(['evidence.json','policy.json','report.json','report.md'].map(n=>fs.readFile(join(out,n),'utf8')));
  const invalid=await policyFile(root,'invalid',policyFixture({maxInputRaw:500}));
  const wrongChain=await policyFile(root,'wrong-chain',policyFixture({chainId:1}));
  const attempts=[
    run(invalid,out),
    run(wrongChain,out),
    run(p,out,'complete','0x1234'),
    run(p,out,'complete',transactionHash,'http://external.example.invalid')
  ];
  for (const result of attempts){
    assert.equal(result.status,1,result.stderr);
    assert.doesNotMatch(result.stdout+result.stderr,/KEY_DO_NOT_PRINT|simulated-rpc.invalid/);
  }
  assert.deepEqual(await Promise.all(['evidence.json','policy.json','report.json','report.md'].map(n=>fs.readFile(join(out,n),'utf8'))),files);
});
