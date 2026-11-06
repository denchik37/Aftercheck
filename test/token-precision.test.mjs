import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {authenticatedTokenPrecision} from '../src/token-precision.ts';
import {sealEvidence} from '../src/evidence.ts';

const evidence = JSON.parse(readFileSync(new URL('../examples/sepolia/evidence.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../docs/evidence/token-precision/manifest.json', import.meta.url), 'utf8'));
const reseal = change => {const value = structuredClone(evidence); delete value.digest; change(value); return sealEvidence(value);};

test('token precision binds the exact historical capture to independently reproduced runtime', async () => {
  const precision = await authenticatedTokenPrecision(evidence);
  for (const [role, source] of [['input', manifest.tokens[0]], ['output', manifest.tokens[1]]]) {
    assert.equal(precision[role].provenance, 'SOURCE_VERIFIED_PINNED_RUNTIME');
    assert.equal(precision[role].decimals, 18);
    assert.equal(precision[role].address, source.address);
    assert.equal(precision[role].runtimeSha256, source.runtimeSha256);
    assert.equal(precision[role].sourceResponseSha256, source.sourceResponseSha256);
    assert.equal(precision[role].standardInputSha256, source.standardInputSha256);
    assert.equal(precision[role].blockHash, evidence.block.hash);
    assert.equal(precision[role].blockNumber, evidence.block.number);
    assert.equal(precision[role].chainId, 11155111);
  }
});

test('altered and missing token code or context cannot inherit authenticated display precision', async () => {
  const cases = [
    e => {e.state = e.state.filter(state => state.key !== 'tokenIn.code');},
    e => {e.state.find(state => state.key === 'tokenIn.code').result = '0x00';},
    e => {e.state.find(state => state.key === 'tokenOut.code').params[0] = '0x' + '1'.repeat(40);},
    e => {e.state.find(state => state.key === 'tokenOut.code').params[1] = 'latest';},
    e => {e.block.number = '0x7556c4';},
    e => {e.canonicalBlockHash = null;},
    e => {e.transactionHash = '0x' + '1'.repeat(64);},
    e => {e.state.push(structuredClone(e.state.find(state => state.key === 'tokenIn.code')));}
  ];
  for (const change of cases) assert.deepEqual(await authenticatedTokenPrecision(reseal(change)), {input: null, output: null});
});

test('metadata lookup rejects forged integrity and unsupported chain before display', async () => {
  const tampered = structuredClone(evidence); tampered.state[3].result = '0x00';
  await assert.rejects(authenticatedTokenPrecision(tampered), /DIGEST/);
  await assert.rejects(authenticatedTokenPrecision({...evidence, chainId: 1}), /CHAIN/);
});

test('mutating returned display metadata cannot poison future verified results', async () => {
  const first = await authenticatedTokenPrecision(evidence);
  first.input.decimals = 6; first.output.address = '0x' + '1'.repeat(40);
  const again = await authenticatedTokenPrecision(evidence);
  assert.equal(again.input.decimals, 18);
  assert.equal(again.output.address, manifest.tokens[1].address);
});

test('committed source inputs and full compiled runtime reproduce the research integrity record', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/check-historical-token-precision.mjs'], {cwd: new URL('..', import.meta.url), encoding: 'utf8'}));
  assert.equal(result.status, 'PASS');
  assert.equal(result.mode, 'RETAINED_SOURCE_AND_RUNTIME_INTEGRITY');
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every(token => token.fullRecompilationThisRun === false));
});
