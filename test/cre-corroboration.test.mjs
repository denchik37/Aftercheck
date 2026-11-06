import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseJson, digestJson, canonicalJson as coreCanonicalJson} from '../src/json.ts';
import {verifyEvidence} from '../src/verify.ts';
import {createManifest, retainedManifests} from '../scripts/cre-manifest.mjs';
import {
  DEMO_TARGET, INTENTIONAL_MISMATCH_POOL, MAX_CRE_JSON_BYTES, parseBoundedJson,
  canonicalJson, parseManifest, parseObservation, parseExecutionMetadata,
  manifestDigestInput, assertManifestDigest, compareObservation, parseCorroboration,
} from '../integrations/cre/shared.ts';

const load = name => parseJson(readFileSync(new URL('../examples/sepolia/' + name, import.meta.url), 'utf8'));
const evidence = load('evidence.json');
const policy = load('policy-pass.json');
const reference = await createManifest(evidence);
const negative = await createManifest(evidence, 'INTENTIONAL_MISMATCH');
const clone = value => JSON.parse(JSON.stringify(value));
const sha256 = text => '0x' + createHash('sha256').update(text, 'utf8').digest('hex');
const metadata = {
  executionMode: 'UNIT_TEST', workflowRevision: DEMO_TARGET.sourceRevision,
  cliVersion: null, sdkVersion: null, rpcProvider: 'UNIT_TEST_FIXTURE',
};
const observed = () => ({
  availability: 'AVAILABLE', manifestFetch: 'VERIFIED', chainId: '11155111',
  chainSelector: '16015286601757825753', requestedBlockNumber: '7689923',
  header: {blockNumber: '7689923', blockHash: '0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34'},
  call: {to: '0x0227628f3f023bb0b980b67d528571c95c6dac1c', data: reference.call.calldata, blockNumber: '7689923'},
  returnData: '0x000000000000000000000000029603931809d430ae47d2f55212cc0e89dbfd52',
  errorCode: null,
});
const reseal = input => { const {digest: _digest, ...payload} = input; return {...payload, digest: digestJson(payload)}; };

test('CRE manifest derives the retained real pool observation with exact public provenance', () => {
  assert.equal(reference.evidence.digest, '0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093');
  assert.equal(reference.evidence.sourceRevision, '17ac1368d238f594a6e46728402c298b9e3968f1');
  assert.equal(reference.evidence.evidenceClass, 'RPC_RECEIPT');
  assert.equal(reference.evidence.acquiredAt, evidence.acquiredAt);
  assert.equal(reference.target.transactionHash, evidence.transactionHash);
  assert.equal(reference.target.blockNumber, '7689923');
  assert.equal(reference.target.blockHash, evidence.canonicalBlockHash);
  assert.equal(reference.call.calldata, evidence.state.find(item => item.key === 'factory.pool').params[0].data);
  assert.equal(reference.call.expectedPool, '0x029603931809d430ae47d2f55212cc0e89dbfd52');
  assert.equal(reference.manifestDigest, '0x76b8666d4d9d7d91ef45bf110f6af1628114303c007da08ee59830d6b4aa72ad');
  assertManifestDigest(reference, sha256);
});

test('CRE committed public manifests exactly reproduce from the retained capture', async () => {
  for (const [name, manifest] of Object.entries(await retainedManifests())) {
    const actual = readFileSync(new URL('../integrations/cre/public/' + name, import.meta.url), 'utf8');
    assert.equal(actual, JSON.stringify(manifest, null, 2) + '\n');
  }
  const run = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types',
    fileURLToPath(new URL('../scripts/cre-manifest.mjs', import.meta.url)), '--check'], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /VERIFIED reference\.json/);
  assert.match(run.stdout, /VERIFIED intentional-mismatch\.json/);
});

test('CRE generator rejects tampered, synthetic, incomplete and conflicting source evidence', async () => {
  const tampered = clone(evidence); tampered.transactionHash = '0x' + '1'.repeat(64);
  await assert.rejects(createManifest(tampered), /EVIDENCE_DIGEST_MISMATCH/);
  const synthetic = clone(evidence); synthetic.evidenceClass = 'SYNTHETIC_RPC_FIXTURE';
  await assert.rejects(createManifest(reseal(synthetic)), /CRE_SOURCE_IDENTITY_INCOMPLETE/);
  const missing = clone(evidence); missing.state = missing.state.filter(item => item.key !== 'factory.pool');
  await assert.rejects(createManifest(reseal(missing)), /CRE_SOURCE_PROTOCOL_INCOMPLETE/);
  const conflict = clone(evidence); conflict.transaction.blockNumber = '0x1';
  await assert.rejects(createManifest(reseal(conflict)), /CRE_SOURCE_IDENTITY_INCOMPLETE/);
});

test('CRE bounded JSON rejects duplicate/unsafe keys, unsafe numbers and resource abuse', () => {
  for (const text of [
    '{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"__proto__":{}}',
    '{"x":{"constructor":1}}', '{"prototype":null}', '9007199254740993',
    '-0', '1.0', '1e1', '{} trailing', '{"a":1,}', '[1,]', 'NaN',
  ]) assert.throws(() => parseBoundedJson(text), /CRE_/);
  assert.throws(() => parseBoundedJson(' '.repeat(MAX_CRE_JSON_BYTES + 1)), /SIZE_LIMIT/);
  assert.throws(() => parseBoundedJson(JSON.stringify('😀'.repeat(9_000))), /SIZE_LIMIT/);
  assert.throws(() => parseBoundedJson('['.repeat(18) + '0' + ']'.repeat(18)), /COMPLEXITY_LIMIT/);
  assert.throws(() => parseBoundedJson('[' + Array(2_050).fill('0').join(',') + ']'), /COMPLEXITY_LIMIT/);
});

test('CRE canonical JSON matches the core without invoking accessors or coercion', () => {
  const input = {z: ['test', true, null, '9007199254740993'], a: {b: 7}};
  assert.equal(canonicalJson(input), coreCanonicalJson(input));
  let called = false;
  const getter = Object.defineProperty({}, 'x', {enumerable: true, get() {called = true; return 'unsafe';}});
  assert.throws(() => canonicalJson(getter), /UNSUPPORTED_JSON_VALUE/);
  assert.equal(called, false);
  assert.throws(() => canonicalJson({toJSON() {called = true; return {};}}), /UNSUPPORTED_JSON_VALUE/);
  assert.equal(called, false);
  assert.throws(() => canonicalJson([, 1]), /INVALID_JSON_ARRAY/);
  assert.throws(() => canonicalJson({x: 9007199254740992}), /UNSUPPORTED_JSON_VALUE/);
  assert.throws(() => canonicalJson({x: 1n}), /UNSUPPORTED_JSON_VALUE/);
});

test('CRE manifest validates all pinned transaction, chain, block, token and call identities', () => {
  const mutations = [
    m => m.target.chainId = '1', m => m.target.chainSelector = '1',
    m => m.target.transactionHash = '0x' + '1'.repeat(64), m => m.target.blockNumber = '7689924',
    m => m.target.blockHash = '0x' + '1'.repeat(64), m => m.target.blockNumber = 7689923,
    m => m.call.factory = INTENTIONAL_MISMATCH_POOL, m => m.call.token0 = m.call.token1,
    m => m.call.token1 = m.call.token0, m => m.call.fee = '3000', m => m.call.calldata = '0x',
    m => m.evidence.sourceRevision = '0'.repeat(40), m => m.evidence.sourceUrl = 'http://127.0.0.1/private',
    m => m.evidence.digest = '0x' + '0'.repeat(64), m => m.evidence.origin = 'NEW_AFTERCHECK_TRANSACTION',
    m => m.observationMode = 'CURRENT_STATE', m => m.evidence.acquiredAt = '<script>alert(1)</script>',
    m => m.extra = 'unexpected', m => m.call.extra = 'unexpected',
  ];
  for (const mutate of mutations) { const changed = clone(reference); mutate(changed); assert.throws(() => parseManifest(changed), /CRE_/); }
  assert.throws(() => parseManifest(JSON.stringify(reference).replace('"scenario":"REFERENCE"', '"scenario":"REFERENCE","scenario":"REFERENCE"')), /DUPLICATE_JSON_KEY/);
});

test('CRE scenario labels cannot hide a changed expected pool as authentic evidence', () => {
  assert.equal(negative.scenario, 'INTENTIONAL_MISMATCH');
  assert.equal(negative.call.expectedPool, INTENTIONAL_MISMATCH_POOL);
  assert.equal(negative.evidence.digest, reference.evidence.digest);
  assert.notEqual(negative.manifestDigest, reference.manifestDigest);
  const unlabeled = clone(reference); unlabeled.call.expectedPool = INTENTIONAL_MISMATCH_POOL;
  assert.throws(() => parseManifest(unlabeled), /SCENARIO_EXPECTATION_CONFLICT/);
  const misleading = clone(negative); misleading.call.expectedPool = DEMO_TARGET.pool;
  assert.throws(() => parseManifest(misleading), /SCENARIO_EXPECTATION_CONFLICT/);
});

test('CRE manifest SHA checks canonical payload separately from schema validation', () => {
  assert.equal(sha256(manifestDigestInput(reference)), reference.manifestDigest);
  assertManifestDigest(reference, sha256);
  const changed = {...reference, manifestDigest: '0x' + '0'.repeat(64)};
  parseManifest(changed);
  assert.throws(() => assertManifestDigest(changed, sha256), /MANIFEST_DIGEST_MISMATCH/);
  assert.throws(() => assertManifestDigest(reference, () => 'not a digest'), /INVALID_HASH/);
});

test('CRE exact comparison matches complete evidence without claiming simulator execution', () => {
  const result = compareObservation(reference, observed(), metadata);
  assert.equal(result.status, 'MATCH');
  assert.deepEqual(result.reasonCodes, ['POOL_IDENTITY_MATCH']);
  assert.equal(result.observedPool, DEMO_TARGET.pool);
  assert.equal(result.metadata.executionMode, 'UNIT_TEST');
  assert.equal(result.blockBinding, 'BLOCK_NUMBER_PLUS_SEPARATE_HEADER');
  assert.equal(result.financialPolicyVerdict, 'UNCHANGED');
  assert.match(result.limitations.join(' '), /not CRE CLI simulation evidence/);
  assert.deepEqual(parseCorroboration(JSON.stringify(result)), result);
});

test('CRE deliberate expectation mismatch surfaces discrepancy with genuine reference preserved', () => {
  const result = compareObservation(negative, observed(), metadata);
  assert.equal(result.status, 'MISMATCH');
  assert.deepEqual(result.reasonCodes, ['POOL_ADDRESS_MISMATCH']);
  assert.equal(result.manifest.evidence.digest, reference.evidence.digest);
  assert.equal(result.observedPool, DEMO_TARGET.pool);
  assert.equal(result.manifest.call.expectedPool, INTENTIONAL_MISMATCH_POOL);
  assert.equal(result.financialPolicyVerdict, 'UNCHANGED');
});

test('CRE missing identities, header or EVM response never become MATCH', () => {
  for (const field of ['chainId', 'chainSelector', 'requestedBlockNumber', 'header', 'call', 'returnData']) {
    const value = observed(); value[field] = null;
    assert.equal(compareObservation(reference, value, metadata).status, 'UNAVAILABLE', field);
  }
  for (const manifestFetch of ['UNAVAILABLE', 'INVALID']) {
    const value = {...observed(), manifestFetch};
    assert.equal(compareObservation(reference, value, metadata).status, 'UNAVAILABLE');
  }
});

test('CRE real-request failure shape retains only target reference and an explicit unavailable result', () => {
  const result = compareObservation(reference, {
    availability: 'UNAVAILABLE', manifestFetch: 'UNAVAILABLE', chainId: null, chainSelector: null,
    requestedBlockNumber: null, header: null, call: null, returnData: null, errorCode: 'HTTP_STATUS_ERROR',
  }, metadata);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.ok(result.reasonCodes.includes('HTTP_STATUS_ERROR'));
  assert.equal(result.observedPool, null);
  assert.deepEqual(parseCorroboration(result), result);
  assert.throws(() => parseObservation({...observed(), errorCode: 'EVM_READ_FAILED'}), /CONFLICTING_AVAILABILITY/);
  assert.throws(() => parseObservation({...observed(), availability: 'UNAVAILABLE', errorCode: 'credential=https://secret'}), /INVALID_ERROR_CODE/);
});

test('CRE wrong chain and selector remain unsupported even when the pool address matches', () => {
  assert.equal(compareObservation(reference, {...observed(), chainId: '1'}, metadata).status, 'UNSUPPORTED');
  assert.equal(compareObservation(reference, {...observed(), chainSelector: '1'}, metadata).status, 'UNSUPPORTED');
  const value = {...observed(), availability: 'UNSUPPORTED', errorCode: 'UNSUPPORTED_CAPABILITY'};
  assert.equal(compareObservation(reference, value, metadata).status, 'UNSUPPORTED');
});

test('CRE different historical block, header or call cannot produce a historical MATCH', () => {
  const mutations = [
    o => o.requestedBlockNumber = '7689924',
    o => o.header.blockNumber = '7689924', o => o.header.blockHash = '0x' + '1'.repeat(64),
    o => o.call.blockNumber = '7689924', o => o.call.to = INTENTIONAL_MISMATCH_POOL,
    o => o.call.data = '0x1698ee82',
  ];
  for (const mutate of mutations) { const value = observed(); mutate(value); assert.equal(compareObservation(reference, value, metadata).status, 'MISMATCH'); }
  const large = {...observed(), requestedBlockNumber: '9007199254740993'};
  assert.equal(parseObservation(large).requestedBlockNumber, '9007199254740993');
  assert.equal(compareObservation(reference, large, metadata).status, 'MISMATCH');
  assert.throws(() => parseObservation({...observed(), requestedBlockNumber: 9007199254740992}), /CRE_/);
  assert.throws(() => parseObservation({...observed(), requestedBlockNumber: (1n << 256n).toString()}), /INVALID_DECIMAL/);
});

test('CRE malformed ABI return, unexpected trailing bytes and noncanonical padding fail closed', () => {
  for (const returnData of ['0x', observed().returnData + '00', '0x1' + observed().returnData.slice(3), '0x' + '00'.repeat(31)]) {
    assert.equal(compareObservation(reference, {...observed(), returnData}, metadata).status, 'UNAVAILABLE');
  }
  const zero = compareObservation(reference, {...observed(), returnData: '0x' + '00'.repeat(32)}, metadata);
  assert.equal(zero.status, 'MISMATCH');
  assert.throws(() => parseObservation({...observed(), returnData: '<script>alert(1)</script>'}), /INVALID_HEX/);
});

test('CRE result parser recomputes statuses, identities, reason codes and trust limitations', () => {
  const mismatch = compareObservation(negative, observed(), metadata);
  const mutations = [
    r => r.status = 'MATCH', r => r.reasonCodes = ['POOL_IDENTITY_MATCH'], r => r.observedPool = INTENTIONAL_MISMATCH_POOL,
    r => r.blockBinding = 'HASH_BOUND', r => r.financialPolicyVerdict = 'PASS', r => r.limitations = [],
    r => r.extra = true,
  ];
  for (const mutate of mutations) { const changed = clone(mismatch); mutate(changed); assert.throws(() => parseCorroboration(changed), /CRE_/); }
});

test('CRE metadata separates unit fixtures, ordinary RPC rehearsal and actual simulator classification', () => {
  assert.throws(() => parseExecutionMetadata({...metadata, executionMode: 'CRE_CLI_SIMULATION'}), /INVALID_VERSION/);
  assert.throws(() => parseExecutionMetadata({...metadata, cliVersion: '1.39.0'}), /PROVENANCE_CONFLICT/);
  assert.throws(() => parseExecutionMetadata({...metadata, workflowRevision: 'main'}), /INVALID_SOURCE_REVISION/);
  assert.throws(() => parseExecutionMetadata({...metadata, executionMode: 'RPC_REHEARSAL'}), /PROVENANCE_CONFLICT/);
  const rehearsal = {...metadata, executionMode: 'RPC_REHEARSAL', rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'};
  assert.equal(parseExecutionMetadata(rehearsal).cliVersion, null);
  const result = compareObservation(reference, observed(), rehearsal);
  assert.match(result.limitations.join(' '), /same Tenderly provider/);
  assert.match(result.limitations.join(' '), /ordinary HTTP\/RPC code/);
  // Metadata syntax is testable here; this unit fixture is not an actual simulation.
  const simulatedMetadata = {...metadata, executionMode: 'CRE_CLI_SIMULATION', rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA', cliVersion: '1.39.0', sdkVersion: '1.23.0'};
  assert.equal(parseExecutionMetadata(simulatedMetadata).executionMode, 'CRE_CLI_SIMULATION');
});

test('CRE comparisons leave source evidence, manifest, input observation and core policy results unchanged', () => {
  const observation = observed();
  const before = [canonicalJson(reference), canonicalJson(observation), digestJson(evidence), digestJson(verifyEvidence(evidence, policy))];
  compareObservation(reference, observation, metadata);
  compareObservation(negative, observation, metadata);
  assert.deepEqual([canonicalJson(reference), canonicalJson(observation), digestJson(evidence), digestJson(verifyEvidence(evidence, policy))], before);
});
