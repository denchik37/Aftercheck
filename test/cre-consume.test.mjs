import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonicalJson, digestJson} from '../src/json.ts';
import {sealEvidence} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {consumeCorroboration, renderCorroborationMarkdown} from '../src/corroboration.ts';
import {compareObservation, DEMO_TARGET, INTENTIONAL_MISMATCH_POOL} from '../integrations/cre/shared.ts';
import {createManifest} from '../scripts/cre-manifest.mjs';

const examplePath = resolve('examples/sepolia/evidence.json');
const policyPath = resolve('examples/sepolia/policy-pass.json');
const evidence = JSON.parse(await readFile(examplePath, 'utf8'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const manifest = await createManifest(evidence);
// Every generated observation in this file is explicitly UNIT_TEST. No test
// fixture is evidence that the official CRE simulator or a blockchain was run.
const metadata = {
  executionMode: 'UNIT_TEST', workflowRevision: 'a'.repeat(40),
  cliVersion: null, sdkVersion: null, rpcProvider: 'UNIT_TEST_FIXTURE'
};
const observation = {
  availability: 'AVAILABLE', manifestFetch: 'VERIFIED',
  chainId: manifest.target.chainId, chainSelector: manifest.target.chainSelector,
  requestedBlockNumber: manifest.target.blockNumber,
  header: {blockNumber: manifest.target.blockNumber, blockHash: manifest.target.blockHash},
  call: {to: manifest.call.factory, data: manifest.call.calldata, blockNumber: manifest.target.blockNumber},
  returnData: evidence.state.find(item => item.key === 'factory.pool').result, errorCode: null
};
const unitResult = (m = manifest, o = observation) => compareObservation(m, o, metadata);
const consume = (m = manifest, o = observation, p = policy) => consumeCorroboration(evidence, p, m, unitResult(m, o));

test('UNIT_TEST consumer binds original evidence and produces a separate deterministic appendix', () => {
  const inputs = canonicalJson({evidence, policy, manifest, observation});
  const first = consume();
  const second = consume();
  assert.deepEqual(first, second);
  assert.deepEqual(first.coreReport, verifyEvidence(evidence, policy));
  assert.equal(first.appendix.coreReportDigest, digestJson(first.coreReport));
  assert.equal(first.appendix.externalCorroboration.status, 'MATCH');
  assert.equal(first.appendix.resultAuthenticity, 'SELF_REPORTED_LOCAL_FILE_NOT_AUTHENTICATED');
  assert.equal(first.appendix.sourceBinding.recordedPool, DEMO_TARGET.pool);
  assert.equal(first.appendix.sourceBinding.expectedPoolOrigin, 'ORIGINAL_CAPTURE');
  assert.equal(first.appendix.sourceBinding.blockNumber, '7689923');
  assert.equal(canonicalJson({evidence, policy, manifest, observation}), inputs, 'inputs must not be modified');
  const markdown = renderCorroborationMarkdown(first.appendix);
  assert.match(markdown, /UNIT_TEST/);
  assert.match(markdown, /not an executed CRE CLI simulation/);
  assert.match(markdown, /not an authenticated Chainlink or DON attestation/);
  assert.match(markdown, /not a hash-bound eth_call/);
});

test('external MATCH never upgrades original VIOLATION or reserve UNKNOWN', async () => {
  for (const [name, expected] of [['policy-output-threshold.json', 'VIOLATION'], ['policy-reserve.json', 'UNKNOWN']]) {
    const p = JSON.parse(await readFile(resolve('examples/sepolia', name), 'utf8'));
    const result = consume(manifest, observation, p);
    assert.equal(result.appendix.externalCorroboration.status, 'MATCH');
    assert.equal(result.coreReport.verdict, expected);
    assert.equal(result.appendix.coreOutcome.policyVerdict, expected);
    assert.deepEqual(result.coreReport, verifyEvidence(evidence, p));
    assert.equal(result.appendix.financialPolicyVerdict, 'UNCHANGED');
  }
});

test('intentional mismatch reports the altered expectation separately from the actual historical pool', async () => {
  const changed = await createManifest(evidence, 'INTENTIONAL_MISMATCH');
  const result = consume(changed);
  assert.equal(result.appendix.externalCorroboration.status, 'MISMATCH');
  assert.equal(result.appendix.sourceBinding.recordedPool, DEMO_TARGET.pool);
  assert.equal(result.appendix.externalCorroboration.manifest.call.expectedPool, INTENTIONAL_MISMATCH_POOL);
  assert.equal(result.appendix.sourceBinding.expectedPoolOrigin, 'INTENTIONAL_TEST_INPUT');
  assert.equal(result.coreReport.verdict, 'PASS');
  const markdown = renderCorroborationMarkdown(result.appendix);
  assert.match(markdown, /INTENTIONAL_MISMATCH/);
  assert.match(markdown, /not the pool recorded in the historical source evidence/);
  assert.match(markdown, /Financial-policy verdict:\*\* PASS \(unchanged\)/);
});

test('a disagreeing observation is a visible MISMATCH without changing the original report', () => {
  const wrongPool = {...observation, returnData: '0x' + '0'.repeat(63) + '2'};
  const result = consume(manifest, wrongPool);
  assert.equal(result.appendix.externalCorroboration.status, 'MISMATCH');
  assert.ok(result.appendix.externalCorroboration.reasonCodes.includes('POOL_ADDRESS_MISMATCH'));
  assert.deepEqual(result.coreReport, verifyEvidence(evidence, policy));
});

test('HTTP failure, missing state and unsupported network cannot become MATCH', () => {
  const unavailable = {
    availability: 'UNAVAILABLE', manifestFetch: 'UNAVAILABLE',
    chainId: null, chainSelector: null, requestedBlockNumber: null,
    header: null, call: null, returnData: null, errorCode: 'HTTP_FETCH_FAILED'
  };
  assert.equal(consume(manifest, unavailable).appendix.externalCorroboration.status, 'UNAVAILABLE');
  const missingState = {...observation, availability: 'UNAVAILABLE', returnData: null, errorCode: 'HISTORICAL_STATE_UNAVAILABLE'};
  assert.equal(consume(manifest, missingState).appendix.externalCorroboration.status, 'UNAVAILABLE');
  const wrongChain = {...observation, chainId: '1'};
  assert.equal(consume(manifest, wrongChain).appendix.externalCorroboration.status, 'UNSUPPORTED');
});

test('incorrect block number, header hash, call identity and unverified manifest remain non-MATCH', () => {
  const attempts = [
    {...observation, requestedBlockNumber: '7689924'},
    {...observation, header: {...observation.header, blockHash: '0x' + '1'.repeat(64)}},
    {...observation, call: {...observation.call, blockNumber: '7689924'}},
    {...observation, call: {...observation.call, to: INTENTIONAL_MISMATCH_POOL}},
    {...observation, call: {...observation.call, data: '0x1698ee82'}},
    {...observation, manifestFetch: 'UNAVAILABLE'},
    {...observation, returnData: '0x1234'},
    {...observation, header: null}
  ];
  for (const wrong of attempts) {
    assert.notEqual(consume(manifest, wrong).appendix.externalCorroboration.status, 'MATCH');
  }
});

test('forged MATCH, altered reason codes and invented attestation claims are rejected', () => {
  const mismatch = unitResult(manifest, {...observation, returnData: '0x' + '0'.repeat(63) + '2'});
  assert.equal(mismatch.status, 'MISMATCH');
  assert.throws(() => consumeCorroboration(evidence, policy, manifest, {...mismatch, status: 'MATCH'}), /CRE_RESULT_COMPARISON_CONFLICT/);
  const valid = unitResult();
  for (const forged of [
    {...valid, reasonCodes: []}, {...valid, observedPool: INTENTIONAL_MISMATCH_POOL},
    {...valid, limitations: ['Certified by Chainlink']}, {...valid, financialPolicyVerdict: 'PASS'},
    {...valid, blockBinding: 'HASH_BOUND_STATE_PROOF'}
  ]) assert.throws(() => consumeCorroboration(evidence, policy, manifest, forged), /CRE_RESULT_COMPARISON_CONFLICT/);
});

test('manifest integrity and supplied/embedded manifest identity are checked independently', async () => {
  const badDigest = {...manifest, manifestDigest: '0x' + '0'.repeat(64)};
  assert.throws(() => consumeCorroboration(evidence, policy, badDigest, unitResult(badDigest)), /CRE_MANIFEST_DIGEST_MISMATCH/);
  const changed = await createManifest(evidence, 'INTENTIONAL_MISMATCH');
  assert.throws(() => consumeCorroboration(evidence, policy, manifest, unitResult(changed)), /CRE_RESULT_MANIFEST_CONFLICT/);
});

test('altered historical evidence cannot be validated by an unchanged claimed digest', () => {
  const changed = structuredClone(evidence);
  changed.state.find(item => item.key === 'factory.pool').result = '0x' + '0'.repeat(63) + '1';
  assert.throws(() => consumeCorroboration(changed, policy, manifest, unitResult()), /EVIDENCE_DIGEST_MISMATCH/);
  const {digest: _digest, ...payload} = changed;
  const resealed = sealEvidence(payload);
  assert.notEqual(resealed.digest, evidence.digest);
  assert.throws(() => consumeCorroboration(resealed, policy, manifest, unitResult()), /CRE_SOURCE_PROTOCOL_NOT_ESTABLISHED|CRE_SOURCE_EVIDENCE_DIGEST_CONFLICT/);
});

test('malformed identity, current-state substitution and unlabelled altered expectation are rejected', () => {
  for (const changed of [
    {...manifest, observationMode: 'CURRENT_STATE'},
    {...manifest, target: {...manifest.target, chainId: '1'}},
    {...manifest, target: {...manifest.target, blockNumber: 'latest'}},
    {...manifest, target: {...manifest.target, blockNumber: 7689923}},
    {...manifest, call: {...manifest.call, expectedPool: INTENTIONAL_MISMATCH_POOL}},
    {...manifest, evidence: {...manifest.evidence, sourceRevision: 'main'}},
    {...manifest, unknownField: 'ignored?'}
  ]) assert.throws(() => consumeCorroboration(evidence, policy, changed, unitResult()), /CRE_/);
});

test('unit-test execution metadata cannot masquerade as a successful simulator run', () => {
  const result = unitResult();
  for (const forged of [
    {...metadata, executionMode: 'CRE_CLI_SIMULATION'},
    {...metadata, cliVersion: '0.0.1', sdkVersion: '0.0.1'},
    {...metadata, workflowRevision: 'main'},
    {...metadata, rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'}
  ]) assert.throws(() => consumeCorroboration(evidence, policy, manifest, {...result, metadata: forged}), /CRE_/);
});

test('consumer rejects an accessor-bearing manifest without invoking its getter', () => {
  let invoked = false;
  const malicious = {...manifest};
  Object.defineProperty(malicious, 'scenario', {enumerable: true, get() { invoked = true; return 'REFERENCE'; }});
  assert.throws(() => consumeCorroboration(evidence, policy, malicious, unitResult()), /CRE_UNSUPPORTED_JSON_VALUE/);
  assert.equal(invoked, false);
});

test('RPC_REHEARSAL remains explicitly distinct from an executed CRE simulation', () => {
  const rehearsal = compareObservation(manifest, observation, {
    ...metadata, executionMode: 'RPC_REHEARSAL', rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'
  });
  const result = consumeCorroboration(evidence, policy, manifest, rehearsal);
  assert.equal(result.appendix.externalCorroboration.status, 'MATCH');
  const markdown = renderCorroborationMarkdown(result.appendix);
  assert.match(markdown, /RPC_REHEARSAL/);
  assert.match(markdown, /not an executed CRE CLI simulation/);
  assert.match(markdown, /CRE CLI:\*\* NOT_EXECUTED/);
});

async function files(t, m = manifest, o = observation) {
  const dir = await mkdtemp(join(tmpdir(), 'aftercheck-cre-consume-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const manifestPath = join(dir, 'manifest.json');
  const resultPath = join(dir, 'result.json');
  await writeFile(manifestPath, canonicalJson(m));
  await writeFile(resultPath, canonicalJson(unitResult(m, o)));
  return {dir, manifestPath, resultPath, output: join(dir, 'out')};
}
function run(manifestPath, resultPath, output, p = policyPath, e = examplePath) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types',
    resolve('scripts/cre-consume.mjs'), e, p, manifestPath, resultPath, output], {encoding: 'utf8'});
}

test('offline consumer CLI saves the unchanged core report plus a separate UNIT_TEST appendix', async t => {
  const f = await files(t);
  const before = await readFile(examplePath, 'utf8');
  const r = run(f.manifestPath, f.resultPath, f.output);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /External pool identity: MATCH/);
  assert.match(r.stdout, /UNIT_TEST: this fixture is not an executed CRE CLI simulation/);
  assert.match(r.stdout, /Financial-policy verdict: PASS \(unchanged\)/);
  const core = JSON.parse(await readFile(join(f.output, 'core/report.json'), 'utf8'));
  const appendix = JSON.parse(await readFile(join(f.output, 'corroboration/report.json'), 'utf8'));
  assert.deepEqual(core, verifyEvidence(evidence, policy));
  assert.equal(appendix.coreReportDigest, digestJson(core));
  assert.equal(await readFile(examplePath, 'utf8'), before);
  assert.equal(run(f.manifestPath, f.resultPath, f.output).status, 0);
  assert.deepEqual((await readdir(join(f.output, 'core'))).sort(), ['report.json', 'report.md']);
});

test('consumer CLI returns distinct external mismatch and unavailable exit codes', async t => {
  const changed = await createManifest(evidence, 'INTENTIONAL_MISMATCH');
  const negative = await files(t, changed);
  const mismatch = run(negative.manifestPath, negative.resultPath, negative.output);
  assert.equal(mismatch.status, 2, mismatch.stderr);
  assert.match(mismatch.stdout, /INTENTIONAL_MISMATCH: deliberately changed test expectation/);
  assert.match(mismatch.stdout, /Financial-policy verdict: PASS \(unchanged\)/);
  const missing = await files(t, manifest, {...observation, availability: 'UNAVAILABLE', returnData: null, errorCode: 'EVM_READ_FAILED'});
  const unavailable = run(missing.manifestPath, missing.resultPath, missing.output);
  assert.equal(unavailable.status, 3, unavailable.stderr);
  assert.match(unavailable.stdout, /External pool identity: UNAVAILABLE/);
});

test('consumer CLI rejects duplicate keys and secret-like error bodies without publishing output', async t => {
  const f = await files(t);
  const marker = 'PRIVATE_TEST_MARKER_DO_NOT_PRINT';
  await writeFile(f.resultPath, `{"schemaVersion":"${marker}","schemaVersion":"x"}`);
  const result = run(f.manifestPath, f.resultPath, f.output);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr + result.stdout, new RegExp(marker));
  assert.match(result.stderr, /DUPLICATE_JSON_KEY/);
  await assert.rejects(readFile(join(f.output, 'corroboration/report.json')), {code: 'ENOENT'});
});

test('consumer CLI enforces file size bounds before parsing a result', async t => {
  const f = await files(t);
  await writeFile(f.resultPath, ' '.repeat(128_001));
  const result = run(f.manifestPath, f.resultPath, f.output);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /INPUT_FILE_SIZE_LIMIT/);
});

test('consumer CLI refuses output paths that would replace an input file', async t => {
  const f = await files(t);
  await mkdir(join(f.output, 'core'), {recursive: true});
  const protectedInput = join(f.output, 'core/report.json');
  const source = await readFile(f.resultPath, 'utf8');
  await writeFile(protectedInput, source);
  const result = run(f.manifestPath, protectedInput, f.output);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CRE_OUTPUT_OVERLAPS_INPUT/);
  assert.equal(await readFile(protectedInput, 'utf8'), source);
});

test('consumer CLI preserves unrelated output content and reports partial publication accurately', async t => {
  const f = await files(t);
  await mkdir(join(f.output, 'corroboration'), {recursive: true});
  const note = join(f.output, 'corroboration/notes.txt');
  await writeFile(note, 'keep user content');
  const result = run(f.manifestPath, f.resultPath, f.output);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OUTPUT_CONTAINS_UNMANAGED_FILES/);
  assert.match(result.stderr, /output directories publish separately/);
  assert.equal(await readFile(note, 'utf8'), 'keep user content');
});
