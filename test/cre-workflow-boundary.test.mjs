import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {
  CRE_CLI_VERSION, CRE_SDK_VERSION, SCHEDULE, missingManifestObservation,
  parseWorkflowConfig, validateFetchedManifest, validatePublicManifestUrl
} from '../integrations/cre/config.ts';
import {
  canonicalJson, compareObservation, DEMO_TARGET, INTENTIONAL_MISMATCH_POOL, parseManifest
} from '../integrations/cre/shared.ts';

// UNIT_TEST boundaries only. No HTTP request, RPC call, SDK runtime, WASM
// execution or official CRE simulation occurs in any test in this file.
const reference = parseManifest(await readFile(new URL('../integrations/cre/public/reference.json', import.meta.url), 'utf8'));
const negative = parseManifest(await readFile(new URL('../integrations/cre/public/intentional-mismatch.json', import.meta.url), 'utf8'));
const sha256Text = text => '0x' + createHash('sha256').update(text, 'utf8').digest('hex');
const revision = 'a'.repeat(40); // Deliberately synthetic configuration revision; never fetched.
const publicRoot = `https://raw.githubusercontent.com/denchik37/aftercheck/${revision}/integrations/cre/public/`;
const referenceUrl = publicRoot + 'reference.json';
const config = {
  schedule: SCHEDULE, manifestUrl: referenceUrl, expectedManifest: reference,
  metadata: {
    // Describes the only accepted production config shape, not a test execution.
    executionMode: 'CRE_CLI_SIMULATION', workflowRevision: revision,
    cliVersion: CRE_CLI_VERSION, sdkVersion: CRE_SDK_VERSION, rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'
  }
};
const unitMetadata = {
  executionMode: 'UNIT_TEST', workflowRevision: revision,
  cliVersion: null, sdkVersion: null, rpcProvider: 'UNIT_TEST_FIXTURE'
};
const completeUnitObservation = {
  availability: 'AVAILABLE', manifestFetch: 'VERIFIED',
  chainId: reference.target.chainId, chainSelector: reference.target.chainSelector,
  requestedBlockNumber: reference.target.blockNumber,
  header: {blockNumber: reference.target.blockNumber, blockHash: reference.target.blockHash},
  call: {to: reference.call.factory, data: reference.call.calldata, blockNumber: reference.target.blockNumber},
  returnData: '0x' + '0'.repeat(24) + DEMO_TARGET.pool.slice(2), errorCode: null
};

test('UNIT_TEST config accepts only the reviewed schedule, immutable public target and pinned toolchain', () => {
  const before = canonicalJson(config);
  const parsed = parseWorkflowConfig(config, sha256Text);
  assert.equal(canonicalJson(parsed), before);
  assert.equal(canonicalJson(config), before, 'input configuration must remain unchanged');
  assert.equal(canonicalJson(parseWorkflowConfig(before, sha256Text)), before);
  assert.equal(validatePublicManifestUrl(referenceUrl), referenceUrl);
  assert.equal(validatePublicManifestUrl(publicRoot + 'intentional-mismatch.json'), publicRoot + 'intentional-mismatch.json');
  assert.equal(validatePublicManifestUrl(publicRoot + 'unavailable.json'), publicRoot + 'unavailable.json');
});

test('UNIT_TEST URL boundary rejects private targets, alternate origins, credentials, redirects and queries', () => {
  const rejected = [
    'http://127.0.0.1/reference.json', 'https://127.0.0.1/reference.json', 'http://localhost/reference.json',
    'https://169.254.169.254/latest/meta-data/', 'https://[::1]/reference.json',
    'file:///etc/passwd', 'data:application/json,{}',
    referenceUrl.replace('https:', 'http:'),
    referenceUrl.replace('raw.githubusercontent.com', 'raw.githubusercontent.com.evil.example'),
    referenceUrl.replace('raw.githubusercontent.com', 'raw.githubusercontent.com@127.0.0.1'),
    referenceUrl.replace('raw.githubusercontent.com', 'user:password@raw.githubusercontent.com'),
    referenceUrl.replace('raw.githubusercontent.com', 'raw.githubusercontent.com:443'),
    referenceUrl.replace('/denchik37/', '/someone-else/'),
    referenceUrl + '?redirect=https://127.0.0.1/', referenceUrl + '?token=UNIT_TEST_TOKEN',
    referenceUrl + '#fragment',
    'https://github.com/denchik37/aftercheck/raw/' + revision + '/integrations/cre/public/reference.json'
  ];
  for (const value of rejected) assert.throws(() => validatePublicManifestUrl(value), /CRE_PUBLIC_MANIFEST_URL_REJECTED/);
});

test('UNIT_TEST URL boundary rejects mutable refs, path normalization tricks and trailing controls', () => {
  const rejected = [
    referenceUrl.replace(revision, 'main'), referenceUrl.replace(revision, 'v1.0.0'),
    referenceUrl.replace(revision, 'a'.repeat(39)), referenceUrl.replace(revision, 'A'.repeat(40)),
    publicRoot + '../public/reference.json', publicRoot + '%2e%2e/public/reference.json',
    referenceUrl.replace('/public/', '%2fpublic%2f'), publicRoot + 'report.json',
    referenceUrl + '\n', referenceUrl + '\r', referenceUrl + '\r\n', referenceUrl + '\t',
    referenceUrl + ' ', ' ' + referenceUrl, '\n' + referenceUrl
  ];
  for (const value of rejected) assert.throws(() => validatePublicManifestUrl(value), /CRE_PUBLIC_MANIFEST_URL_REJECTED/);
});

test('UNIT_TEST config binds reference, deliberate mismatch and absent-file scenarios explicitly', () => {
  const altered = parseWorkflowConfig({...config, manifestUrl: publicRoot + 'intentional-mismatch.json', expectedManifest: negative}, sha256Text);
  assert.equal(altered.expectedManifest.scenario, 'INTENTIONAL_MISMATCH');
  assert.equal(altered.expectedManifest.call.expectedPool, INTENTIONAL_MISMATCH_POOL);
  assert.equal(parseWorkflowConfig({...config, manifestUrl: publicRoot + 'unavailable.json'}, sha256Text).expectedManifest.scenario, 'REFERENCE');
  for (const value of [
    {...config, expectedManifest: negative},
    {...config, manifestUrl: publicRoot + 'intentional-mismatch.json'},
    {...config, manifestUrl: publicRoot + 'unavailable.json', expectedManifest: negative}
  ]) assert.throws(() => parseWorkflowConfig(value, sha256Text), /CRE_CONFIG_SCENARIO_CONFLICT/);
});

test('UNIT_TEST config rejects tampered digests, arbitrary RPC settings and unpinned execution metadata', () => {
  assert.throws(() => parseWorkflowConfig({...config, expectedManifest: {...reference, manifestDigest: '0x' + '0'.repeat(64)}}, sha256Text), /CRE_MANIFEST_DIGEST_MISMATCH/);
  assert.throws(() => parseWorkflowConfig({...config, rpcUrl: 'http://localhost:8545'}, sha256Text), /CRE_CONFIG_FIELDS_REJECTED/);
  assert.throws(() => parseWorkflowConfig({...config, schedule: '* * * * * *'}, sha256Text), /CRE_CONFIG_SCHEDULE_REJECTED/);
  for (const metadata of [
    {...config.metadata, cliVersion: '1.39.1'}, {...config.metadata, sdkVersion: '1.23.1'},
    {...config.metadata, rpcProvider: 'PUBLICNODE_SEPOLIA'},
    {...config.metadata, workflowRevision: 'main'}, unitMetadata,
    {...config.metadata, executionMode: 'RPC_REHEARSAL', cliVersion: null, sdkVersion: null}
  ]) assert.throws(() => parseWorkflowConfig({...config, metadata}, sha256Text), /CRE_/);
});

test('UNIT_TEST config parser rejects duplicate fields and unsafe object keys before execution', () => {
  assert.throws(() => parseWorkflowConfig('{"schedule":"x","schedule":"y"}', sha256Text), /CRE_DUPLICATE_JSON_KEY/);
  assert.throws(() => parseWorkflowConfig('{"__proto__":{}}', sha256Text), /CRE_UNSAFE_JSON_KEY/);
  assert.throws(() => parseWorkflowConfig('[]', sha256Text), /CRE_CONFIG_OBJECT_REQUIRED/);
  assert.throws(() => parseWorkflowConfig(canonicalJson(config) + 'x', sha256Text), /CRE_TRAILING_JSON_DATA/);
});

test('UNIT_TEST successful fetch validation requires HTTP200, a genuine manifest digest and exact configured content', () => {
  const valid = validateFetchedManifest(200, canonicalJson(reference), reference, sha256Text);
  assert.equal(valid.manifestFetch, 'VERIFIED');
  assert.equal(valid.errorCode, null);
  assert.equal(canonicalJson(valid.manifest), canonicalJson(reference));
  const whitespace = validateFetchedManifest(200, JSON.stringify(reference, null, 2) + '\n', reference, sha256Text);
  assert.equal(whitespace.manifestFetch, 'VERIFIED', 'JSON whitespace does not change the canonical digest');
  const wrongScenario = validateFetchedManifest(200, canonicalJson(negative), reference, sha256Text);
  assert.equal(wrongScenario.manifestFetch, 'INVALID');
  assert.equal(wrongScenario.manifest, null);
  assert.equal(wrongScenario.errorCode, 'MANIFEST_DIGEST_MISMATCH');
});

test('UNIT_TEST HTTP errors and visible redirect responses cannot substitute configured target data for a fetch', () => {
  for (const status of [0, 201, 204, 301, 302, 303, 307, 308, 400, 401, 403, 404, 429, 500, 503, '200', NaN]) {
    const fetched = validateFetchedManifest(status, canonicalJson(reference), reference, sha256Text);
    assert.deepEqual(fetched, {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: 'HTTP_STATUS_ERROR'});
    const result = compareObservation(reference, missingManifestObservation(fetched), unitMetadata);
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.observedPool, null);
  }
  // This tests rejection of 3xx returned by the capability. It does not claim
  // to establish the CRE capability's underlying automatic-redirect policy.
});

test('UNIT_TEST malformed, oversized and poisoned HTTP bodies fail closed', () => {
  const bodies = [
    '', '<html>private proxy diagnostic</html>', '{not JSON}',
    '{"schemaVersion":"x","schemaVersion":"y"}',
    '{"__proto__":{"polluted":true}}', ' '.repeat(32_769),
    canonicalJson({...reference, evidence: {...reference.evidence, sourceUrl: 'http://localhost/private-policy.json'}}),
    canonicalJson({...reference, call: {...reference.call, expectedPool: INTENTIONAL_MISMATCH_POOL}}),
    canonicalJson({...reference, observationMode: 'CURRENT_STATE'})
  ];
  for (const body of bodies) {
    const fetched = validateFetchedManifest(200, body, reference, sha256Text);
    assert.equal(fetched.manifestFetch, 'INVALID');
    assert.equal(fetched.manifest, null);
    assert.equal(fetched.errorCode, 'MANIFEST_INVALID');
    assert.equal(compareObservation(reference, missingManifestObservation(fetched), unitMetadata).status, 'UNAVAILABLE');
  }
  const tamperedDigest = validateFetchedManifest(200, canonicalJson({...reference, manifestDigest: '0x' + '0'.repeat(64)}), reference, sha256Text);
  assert.equal(tamperedDigest.errorCode, 'MANIFEST_DIGEST_MISMATCH');
});

test('UNIT_TEST cached target plus matching fabricated EVM values cannot MATCH when HTTP evidence is absent or invalid', () => {
  for (const manifestFetch of ['UNAVAILABLE', 'INVALID']) {
    const result = compareObservation(reference, {...completeUnitObservation, manifestFetch}, unitMetadata);
    assert.equal(result.status, 'UNAVAILABLE');
    assert.ok(result.reasonCodes.includes(manifestFetch === 'INVALID' ? 'PUBLIC_MANIFEST_INVALID' : 'PUBLIC_MANIFEST_UNAVAILABLE'));
    assert.equal(result.metadata.executionMode, 'UNIT_TEST');
  }
  const baseline = compareObservation(reference, completeUnitObservation, unitMetadata);
  assert.equal(baseline.status, 'MATCH');
  assert.ok(baseline.limitations.some(text => text.includes('UNIT_TEST only')));
});

test('UNIT_TEST missing fetch observations retain the failure code and never invent chain, block or call data', () => {
  for (const fetched of [
    {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: 'HTTP_FETCH_FAILED'},
    {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: 'HTTP_STATUS_ERROR'},
    {manifestFetch: 'INVALID', manifest: null, errorCode: 'MANIFEST_INVALID'},
    {manifestFetch: 'INVALID', manifest: null, errorCode: 'MANIFEST_DIGEST_MISMATCH'}
  ]) {
    const missing = missingManifestObservation(fetched);
    assert.equal(missing.availability, 'UNAVAILABLE');
    assert.equal(missing.manifestFetch, fetched.manifestFetch);
    assert.equal(missing.errorCode, fetched.errorCode);
    for (const field of ['chainId', 'chainSelector', 'requestedBlockNumber', 'header', 'call', 'returnData']) assert.equal(missing[field], null);
    assert.equal(compareObservation(reference, missing, unitMetadata).status, 'UNAVAILABLE');
  }
});
