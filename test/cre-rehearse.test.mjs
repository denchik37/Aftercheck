import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {RpcError} from '../src/rpc.ts';
import {runUnitRehearsal, runRehearsal} from '../scripts/cre-rehearse.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = fileURLToPath(new URL('../integrations/cre/public/reference.json', import.meta.url));
const reference = JSON.parse(readFileSync(manifestPath, 'utf8'));
const negative = JSON.parse(readFileSync(new URL('../integrations/cre/public/intentional-mismatch.json', import.meta.url), 'utf8'));
const url = 'https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/reference.json';
const poolData = '0x000000000000000000000000029603931809d430ae47d2f55212cc0e89dbfd52';

function transport({manifest = reference, chain = '0xaa36a7', header = {number: '0x7556c3', hash: reference.target.blockHash}, response = poolData} = {}) {
  const calls = [], gets = [];
  return {
    calls, gets,
    fetchImpl: async (requestedUrl, options) => { gets.push({url: requestedUrl, options}); return new Response(JSON.stringify(manifest), {status: 200}); },
    rpcCall: async (method, params) => {
      calls.push({method, params});
      if (method === 'eth_chainId') return chain;
      if (method === 'eth_getBlockByNumber') return header;
      if (method === 'eth_call') return response;
      throw new Error('UNEXPECTED_RPC_METHOD');
    },
  };
}

test('RPC rehearsal unit path verifies HTTP before three exact read-only RPC requests', async () => {
  const t = transport();
  const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t});
  assert.equal(result.status, 'MATCH');
  assert.equal(result.metadata.executionMode, 'UNIT_TEST');
  assert.equal(result.metadata.cliVersion, null);
  assert.equal(result.metadata.sdkVersion, null);
  assert.equal(transcript.transport, 'INJECTED_UNIT_TEST');
  assert.equal(transcript.rpcEndpoint, null);
  assert.equal(transcript.http.manifestFetch, 'VERIFIED');
  assert.equal(t.gets.length, 1);
  assert.equal(t.gets[0].options.redirect, 'error');
  assert.equal(t.gets[0].options.credentials, 'omit');
  assert.equal(t.gets[0].options.method, 'GET');
  assert.deepEqual(t.calls, [
    {method: 'eth_chainId', params: []},
    {method: 'eth_getBlockByNumber', params: ['0x7556c3', false]},
    {method: 'eth_call', params: [{to: reference.call.factory, data: reference.call.calldata}, '0x7556c3']},
  ]);
  assert.equal(result.observation.chainId, '11155111');
  assert.equal(transcript.chainIdentityMethod, 'ETH_CHAIN_ID_RPC');
});

test('RPC rehearsal deliberate expectation change is MISMATCH and cannot mutate reference evidence', async () => {
  const before = JSON.stringify(reference);
  const t = transport({manifest: negative});
  const {result} = await runUnitRehearsal({manifest: negative, manifestUrl: url.replace('reference.json', 'intentional-mismatch.json'), ...t});
  assert.equal(result.status, 'MISMATCH');
  assert.equal(result.observedPool, reference.call.expectedPool);
  assert.equal(result.manifest.evidence.digest, reference.evidence.digest);
  assert.equal(result.manifest.scenario, 'INTENTIONAL_MISMATCH');
  assert.equal(JSON.stringify(reference), before);
});

test('RPC rehearsal actual non-200 fetch path prevents every RPC call and omits remote error bodies', async () => {
  let rpcCalls = 0;
  const {result, transcript} = await runUnitRehearsal({manifest: reference,
    manifestUrl: url.replace('reference.json', 'unavailable.json'),
    fetchImpl: async () => new Response('provider error SECRET_DO_NOT_RETAIN', {status: 404}),
    rpcCall: async () => { rpcCalls++; throw new Error('UNEXPECTED_RPC'); },
  });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.observation.manifestFetch, 'UNAVAILABLE');
  assert.equal(result.observation.errorCode, 'HTTP_STATUS_ERROR');
  assert.equal(transcript.http.statusCode, 404);
  assert.equal(transcript.http.receivedBytes, 0);
  assert.equal(rpcCalls, 0);
  assert.doesNotMatch(JSON.stringify({result, transcript}), /SECRET_DO_NOT_RETAIN/);
});

test('RPC rehearsal rejects malformed or wrong-digest HTTP manifests before blockchain reads', async () => {
  const bodies = ['{"malformed":"SECRET_DO_NOT_RETAIN"}', JSON.stringify({...reference, manifestDigest: '0x' + '0'.repeat(64)}), JSON.stringify(negative)];
  for (const body of bodies) {
    let rpcCalls = 0;
    const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url,
      fetchImpl: async () => new Response(body, {status: 200}),
      rpcCall: async () => { rpcCalls++; },
    });
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.observation.manifestFetch, 'INVALID');
    assert.equal(rpcCalls, 0);
    assert.doesNotMatch(JSON.stringify(transcript), /SECRET_DO_NOT_RETAIN/);
  }
});

test('RPC rehearsal GET enforces streaming and content-length size limits', async () => {
  for (const fetchImpl of [
    async () => new Response(' '.repeat(32_769), {status: 200}),
    async () => new Response('{}', {status: 200, headers: {'content-length': '1000000'}}),
    async () => new Response(new Uint8Array([0xff, 0xfe]), {status: 200}),
  ]) {
    let rpcCalls = 0;
    const {result} = await runUnitRehearsal({manifest: reference, manifestUrl: url, fetchImpl, rpcCall: async () => { rpcCalls++; }});
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.observation.errorCode, 'HTTP_FETCH_FAILED');
    assert.equal(rpcCalls, 0);
  }
});

test('RPC rehearsal hashes received HTTP bytes and never strips a BOM into valid evidence', async () => {
  const body = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(reference))]);
  let rpcCalls = 0;
  const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url,
    fetchImpl: async () => new Response(body), rpcCall: async () => { rpcCalls++; }});
  assert.equal(transcript.http.receivedBytes, body.length);
  assert.equal(transcript.http.bodySha256, '0x' + createHash('sha256').update(body).digest('hex'));
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.observation.manifestFetch, 'INVALID');
  assert.equal(rpcCalls, 0);
});

test('RPC rehearsal redirects and network exceptions never use a local fallback as fetched evidence', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('https://secret.example/key=SECRET_DO_NOT_RETAIN'); },
    async () => { const response = new Response(JSON.stringify(reference)); Object.defineProperty(response, 'redirected', {value: true}); return response; },
  ]) {
    let rpcCalls = 0;
    const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url, fetchImpl, rpcCall: async () => { rpcCalls++; }});
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.observation.manifestFetch, 'UNAVAILABLE');
    assert.equal(rpcCalls, 0);
    assert.doesNotMatch(JSON.stringify(transcript), /SECRET_DO_NOT_RETAIN|secret\.example/);
  }
});

test('RPC rehearsal validates actual eth_chainId and stops before state reads on a wrong chain', async () => {
  const t = transport({chain: '0x1'});
  const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t});
  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.observation.chainId, '1');
  assert.equal(result.observation.chainSelector, reference.target.chainSelector);
  assert.equal(result.observation.errorCode, 'UNSUPPORTED_CHAIN');
  assert.equal(transcript.requests.length, 1);
  assert.equal(result.observation.header, null);
  assert.equal(result.observation.call, null);
});

test('RPC rehearsal absent or conflicting historical header cannot proceed to getPool', async () => {
  for (const [header, expectedStatus] of [[null, 'UNAVAILABLE'], [{number: '0x7556c4', hash: reference.target.blockHash}, 'MISMATCH'],
    [{number: '0x7556c3', hash: '0x' + '1'.repeat(64)}, 'MISMATCH']]) {
    const t = transport({header});
    const {result} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t});
    assert.equal(result.status, expectedStatus);
    assert.equal(t.calls.length, 2);
    assert.equal(result.observation.call, null);
  }
});

test('RPC rehearsal only retains bounded allowed header fields and raw validated EVM data', async () => {
  const t = transport({header: {number: '0x7556c3', hash: reference.target.blockHash, privateKey: 'SECRET_DO_NOT_RETAIN'}});
  const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t});
  assert.equal(result.status, 'MATCH');
  assert.deepEqual(transcript.requests[1].result, {number: '0x7556c3', hash: reference.target.blockHash});
  assert.equal(transcript.requests[2].result, poolData);
  assert.doesNotMatch(JSON.stringify(transcript), /SECRET_DO_NOT_RETAIN|privateKey/);
});

test('RPC rehearsal malformed results and RPC errors are unavailable with sanitized codes', async () => {
  for (const response of ['<script>SECRET_DO_NOT_RETAIN</script>', poolData + '\n']) {
    const t = transport({response});
    const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t});
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(transcript.requests[2].result, null);
    assert.equal(transcript.requests[2].errorCode, 'RPC_RESULT_INVALID');
    assert.doesNotMatch(JSON.stringify(transcript), /SECRET_DO_NOT_RETAIN/);
  }
  const t = transport();
  t.rpcCall = async () => { throw new RpcError('RPC_REMOTE_ERROR'); };
  const {result, transcript} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t});
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(transcript.requests[0].errorCode, 'RPC_REMOTE_ERROR');
  assert.equal(transcript.requests[0].result, null);
});

test('RPC rehearsal injected transports cannot claim CRE simulation or real RPC rehearsal', async () => {
  const t = transport();
  const {result} = await runUnitRehearsal({manifest: reference, manifestUrl: url, ...t,
    metadata: {executionMode: 'CRE_CLI_SIMULATION'}, executionMode: 'RPC_REHEARSAL'});
  assert.equal(result.metadata.executionMode, 'UNIT_TEST');
  assert.equal(result.metadata.rpcProvider, 'UNIT_TEST_FIXTURE');
  assert.match(result.limitations.join(' '), /UNIT_TEST only/);
});

test('RPC rehearsal arbitrary origins, mutable refs and URL suffixes are rejected before fetching', async () => {
  for (const invalid of ['http://127.0.0.1/private', url.replace('2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d', 'main'), url + '?secret=1', url + '#fragment', url + '\n']) {
    let requests = 0;
    await assert.rejects(runUnitRehearsal({manifest: reference, manifestUrl: invalid,
      fetchImpl: async () => { requests++; }, rpcCall: async () => { requests++; }}), /PUBLIC_MANIFEST_URL_REJECTED/);
    assert.equal(requests, 0);
  }
});

test('RPC rehearsal refuses nonempty output and source overlap before any execution', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftercheck-rehearsal-test-'));
  try {
    const stale = join(dir, 'result.json');
    await writeFile(stale, 'old result');
    await assert.rejects(runRehearsal(['--manifest', manifestPath, '--manifest-url', url, '--output', dir]), /OUTPUT_MUST_BE_FRESH/);
    assert.equal(await readFile(stale, 'utf8'), 'old result');
    await assert.rejects(runRehearsal(['--manifest', manifestPath, '--manifest-url', url, '--output', join(root, 'src')]), /OUTPUT_.*(?:OVERLAP|FORBIDDEN)|SOURCE_.*OVERLAP/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('RPC rehearsal CLI rejects unknown and duplicate flags without network execution', () => {
  const script = fileURLToPath(new URL('../scripts/cre-rehearse.mjs', import.meta.url));
  for (const args of [[], ['--rpc', 'https://secret.example', '--manifest-url', url, '--output', 'output/never-used'],
    ['--manifest', manifestPath, '--manifest', manifestPath, '--output', 'output/never-used']]) {
    const run = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', script, ...args], {encoding: 'utf8'});
    assert.equal(run.status, 1);
    assert.match(run.stderr, /CRE_REHEARSE_INVALID_ARGUMENTS/);
    assert.doesNotMatch(run.stderr, /secret\.example/);
  }
});
