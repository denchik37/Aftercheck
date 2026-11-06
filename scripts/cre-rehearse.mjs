#!/usr/bin/env node
/** Ordinary Node HTTP/RPC rehearsal. This never executes or impersonates the CRE CLI. */
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {open, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {RpcClient, RpcError} from '../src/rpc.ts';
import {
  DEMO_TARGET, canonicalJson, compareObservation, parseManifest, assertManifestDigest,
} from '../integrations/cre/shared.ts';
import {
  MAX_MANIFEST_BYTES, PUBLIC_RPC_URL, validatePublicManifestUrl,
  validateFetchedManifest, missingManifestObservation,
} from '../integrations/cre/config.ts';
import {
  bindManifestToPublicRevision, prepareFreshCreOutput, verifySourceProvenance,
} from './cre-simulate.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const exec = promisify(execFile);
const sha256 = text => '0x' + createHash('sha256').update(text, 'utf8').digest('hex');
const ensure = (value, code) => { if (!value) throw new Error(code); };
const REHEARSAL_SOURCE = ['src', 'scripts/cre-rehearse.mjs', 'test/cre-rehearse.test.mjs'];
const REHEARSAL_REQUIRED = ['src/rpc.ts', 'src/json.ts', 'src/values.ts', 'scripts/cre-rehearse.mjs', 'test/cre-rehearse.test.mjs'];
const RPC_ERRORS = new Set(['RPC_HTTP_ERROR', 'RPC_EMPTY_RESPONSE', 'RPC_RESPONSE_TOO_LARGE', 'RPC_INVALID_JSON',
  'RPC_REMOTE_ERROR', 'RPC_INVALID_ENVELOPE', 'RPC_TIMEOUT', 'RPC_TRANSPORT_ERROR', 'RPC_BUDGET_EXHAUSTED']);

async function cleanRehearsalRevision(root) {
  const revision = await verifySourceProvenance(root);
  try {
    await exec('git', ['-C', root, 'ls-files', '--error-unmatch', '--', ...REHEARSAL_REQUIRED], {timeout: 20_000, maxBuffer: 65_536});
    const status = await exec('git', ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...REHEARSAL_SOURCE], {timeout: 20_000, maxBuffer: 65_536});
    ensure(status.stdout.length === 0, 'CRE_REHEARSAL_SOURCE_NOT_CLEAN');
  } catch (error) {
    if (error instanceof Error && error.message === 'CRE_REHEARSAL_SOURCE_NOT_CLEAN') throw error;
    throw new Error('CRE_REHEARSAL_SOURCE_NOT_COMMITTED');
  }
  return revision;
}

async function boundedManifestFile(path) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    ensure(info.isFile() && info.size <= MAX_MANIFEST_BYTES, 'CRE_REHEARSAL_MANIFEST_SIZE_LIMIT');
    const bytes = Buffer.alloc(MAX_MANIFEST_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const result = await handle.read(bytes, size, bytes.length - size, size);
      if (!result.bytesRead) break;
      size += result.bytesRead;
    }
    ensure(size <= MAX_MANIFEST_BYTES, 'CRE_REHEARSAL_MANIFEST_SIZE_LIMIT');
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes.subarray(0, size));
  } finally { await handle.close(); }
}

async function fetchManifest(manifestUrl, expected, fetchImpl) {
  const controller = new AbortController();
  const http = {method: 'GET', url: manifestUrl, statusCode: null, receivedBytes: 0,
    bodySha256: null, manifestFetch: 'UNAVAILABLE', errorCode: null};
  let response, reader, timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('HTTP_FETCH_FAILED')); }, 15_000);
  });
  const operation = (async () => {
    response = await fetchImpl(manifestUrl, {method: 'GET', redirect: 'error', credentials: 'omit', signal: controller.signal});
    http.statusCode = response.status;
    if (response.redirected || (response.url && response.url !== manifestUrl)) throw new Error('HTTP_FETCH_FAILED');
    if (response.status !== 200) return validateFetchedManifest(response.status, '', expected, sha256);
    if (!response.body) throw new Error('HTTP_FETCH_FAILED');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > MAX_MANIFEST_BYTES)) throw new Error('HTTP_FETCH_FAILED');
    reader = response.body.getReader();
    const chunks = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      http.receivedBytes += part.value.byteLength;
      if (http.receivedBytes > MAX_MANIFEST_BYTES) throw new Error('HTTP_FETCH_FAILED');
      chunks.push(part.value);
    }
    const bytes = Buffer.concat(chunks);
    http.bodySha256 = '0x' + createHash('sha256').update(bytes).digest('hex');
    const body = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
    return validateFetchedManifest(response.status, body, expected, sha256);
  })();
  let fetched;
  try { fetched = await Promise.race([operation, deadline]); }
  catch { fetched = {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: 'HTTP_FETCH_FAILED'}; }
  finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) await reader.cancel().catch(() => {});
    else if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
  }
  http.manifestFetch = fetched.manifestFetch;
  http.errorCode = fetched.errorCode;
  return {fetched, http};
}

function exactHex(value, kind) {
  const pattern = kind === 'quantity' ? /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/
    : kind === 'hash' ? /^0x[0-9a-fA-F]{64}$/ : /^0x(?:[0-9a-fA-F]{2}){0,512}$/;
  ensure(typeof value === 'string' && pattern.exec(value)?.[0] === value, 'RPC_RESULT_INVALID');
  return value.toLowerCase();
}

async function collectObservation(manifest, rpcCall, requests) {
  const observation = {availability: 'UNAVAILABLE', manifestFetch: 'VERIFIED', chainId: null,
    chainSelector: manifest.target.chainSelector, requestedBlockNumber: null, header: null,
    call: null, returnData: null, errorCode: 'EVM_READ_FAILED'};
  async function read(method, params, clean) {
    try {
      const value = clean(await rpcCall(method, params));
      requests.push({method, params, result: value, errorCode: null});
      return value;
    } catch (error) {
      const code = error instanceof RpcError && RPC_ERRORS.has(error.code) ? error.code : 'RPC_RESULT_INVALID';
      requests.push({method, params, result: null, errorCode: code});
      return null;
    }
  }
  const chain = await read('eth_chainId', [], value => exactHex(value, 'quantity'));
  if (chain === null) return observation;
  observation.chainId = BigInt(chain).toString();
  if (observation.chainId !== manifest.target.chainId) {
    observation.availability = 'UNSUPPORTED'; observation.errorCode = 'UNSUPPORTED_CHAIN';
    return observation;
  }
  const blockTag = '0x' + BigInt(manifest.target.blockNumber).toString(16);
  observation.requestedBlockNumber = manifest.target.blockNumber;
  const header = await read('eth_getBlockByNumber', [blockTag, false], value => {
    ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'RPC_RESULT_INVALID');
    return {number: exactHex(value.number, 'quantity'), hash: exactHex(value.hash, 'hash')};
  });
  if (header === null) { observation.errorCode = 'HEADER_UNAVAILABLE'; return observation; }
  observation.header = {blockNumber: BigInt(header.number).toString(), blockHash: header.hash};
  if (observation.header.blockNumber !== manifest.target.blockNumber || observation.header.blockHash !== manifest.target.blockHash) {
    observation.availability = 'AVAILABLE'; observation.errorCode = null;
    return observation;
  }
  observation.call = {to: manifest.call.factory, data: manifest.call.calldata, blockNumber: manifest.target.blockNumber};
  const result = await read('eth_call', [{to: manifest.call.factory, data: manifest.call.calldata}, blockTag], value => exactHex(value, 'bytes'));
  if (result === null) return observation;
  observation.returnData = result;
  observation.availability = 'AVAILABLE'; observation.errorCode = null;
  return observation;
}

async function executeComparison({manifest, manifestUrl, metadata, fetchImpl, rpcCall}) {
  validatePublicManifestUrl(manifestUrl);
  manifest = parseManifest(manifest);
  assertManifestDigest(manifest, sha256);
  const requests = [];
  const {fetched, http} = await fetchManifest(manifestUrl, manifest, fetchImpl);
  const observation = fetched.manifestFetch === 'VERIFIED'
    ? await collectObservation(fetched.manifest, rpcCall, requests) : missingManifestObservation(fetched);
  const result = compareObservation(manifest, observation, metadata);
  const transcript = {
    schemaVersion: 'aftercheck.cre-rehearsal-transcript.v1', executionMode: metadata.executionMode,
    transport: metadata.executionMode === 'UNIT_TEST' ? 'INJECTED_UNIT_TEST' : 'NODE_HTTP_RPC',
    rpcEndpoint: metadata.executionMode === 'UNIT_TEST' ? null : PUBLIC_RPC_URL,
    chainIdentityMethod: 'ETH_CHAIN_ID_RPC', configuredChainSelector: manifest.target.chainSelector,
    http, requests, comparisonStatus: result.status, reasonCodes: result.reasonCodes,
    limitations: ['This transcript is a local execution record, not a CRE simulator or DON attestation.',
      'Only bounded, validated public response fields are retained; provider error bodies are omitted.'],
  };
  return {result, transcript};
}

/** Injected transports are exposed only through an explicitly UNIT_TEST-labelled entry point. */
export async function runUnitRehearsal({manifest, manifestUrl, fetchImpl, rpcCall}) {
  ensure(typeof fetchImpl === 'function' && typeof rpcCall === 'function', 'CRE_UNIT_TRANSPORT_REQUIRED');
  return executeComparison({manifest, manifestUrl, fetchImpl, rpcCall,
    metadata: {executionMode: 'UNIT_TEST', workflowRevision: DEMO_TARGET.sourceRevision,
      cliVersion: null, sdkVersion: null, rpcProvider: 'UNIT_TEST_FIXTURE'}});
}

function parseArguments(args) {
  ensure(args.length === 6, 'CRE_REHEARSE_INVALID_ARGUMENTS');
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    ensure(['--manifest', '--manifest-url', '--output'].includes(args[i]) && !Object.hasOwn(values, args[i]) &&
      typeof args[i + 1] === 'string' && args[i + 1].length > 0, 'CRE_REHEARSE_INVALID_ARGUMENTS');
    values[args[i]] = args[i + 1];
  }
  return {manifestPath: resolve(values['--manifest']), manifestUrl: validatePublicManifestUrl(values['--manifest-url']), output: resolve(values['--output'])};
}

function transcriptMarkdown(result, transcript, revision) {
  return ['# Ordinary HTTP/RPC rehearsal', '',
    '**RPC_REHEARSAL — not an official CRE CLI simulation.**', '',
    `- Source revision: ${revision}`,
    `- Comparison: ${result.status}`,
    `- Scenario: ${result.manifest.scenario}`,
    `- Public manifest: ${transcript.http.url}`,
    `- Manifest HTTP status: ${transcript.http.statusCode ?? 'UNAVAILABLE'}`,
    `- Manifest fetch: ${result.observation.manifestFetch}`,
    `- Actual RPC chain ID: ${result.observation.chainId ?? 'UNAVAILABLE'}`,
    `- Configured chain selector: ${result.manifest.target.chainSelector}`,
    `- Requested historical block: ${result.observation.requestedBlockNumber ?? 'UNAVAILABLE'}`,
    `- Returned header hash: ${result.observation.header?.blockHash ?? 'UNAVAILABLE'}`,
    `- Expected pool: ${result.manifest.call.expectedPool}`,
    `- Observed pool: ${result.observedPool ?? 'UNAVAILABLE'}`,
    `- Financial-policy verdict: unchanged; this command does not evaluate or modify it.`,
    `- Read-only RPC requests: ${transcript.requests.length}`,
    `- Reason codes: ${result.reasonCodes.join(', ')}`, '',
    '## Requests and bounded observations', '',
    '```json', JSON.stringify(transcript.requests, null, 2), '```', '',
    '## Limits', '', ...result.limitations.map(value => `- ${value}`), '',
  ].join('\n');
}

/** Real execution always uses global fetch and the fixed public, read-only RPC endpoint. */
export async function runRehearsal(args) {
  const options = parseArguments(args);
  await prepareFreshCreOutput(options.output, {root: ROOT, inputs: [options.manifestPath]});
  const lockPath = join(options.output, '.rehearsal.lock');
  const lock = await open(lockPath, 'wx', 0o600);
  let phase = 'SOURCE_PROVENANCE';
  try {
    const startedAt = new Date().toISOString();
    const revision = await cleanRehearsalRevision(ROOT);
    phase = 'PUBLIC_MANIFEST_BINDING';
    const manifestText = await boundedManifestFile(options.manifestPath);
    const {manifest, source} = await bindManifestToPublicRevision(ROOT, manifestText, options.manifestUrl);
    const metadata = {executionMode: 'RPC_REHEARSAL', workflowRevision: revision,
      cliVersion: null, sdkVersion: null, rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'};
    // Real archive-header attempts exceeded 8 seconds. Keep finite budgets while
    // allowing the transport's supported 15-second per-request maximum.
    const rpc = new RpcClient(PUBLIC_RPC_URL, {timeoutMs: 15_000, totalTimeoutMs: 60_000, maxResponseBytes: 524_288});
    phase = 'HTTP_RPC_REHEARSAL';
    const {result, transcript} = await executeComparison({manifest, manifestUrl: options.manifestUrl, metadata,
      fetchImpl: globalThis.fetch, rpcCall: (method, params) => rpc.call(method, params)});
    phase = 'SOURCE_RECHECK';
    ensure(await cleanRehearsalRevision(ROOT) === revision, 'CRE_REHEARSAL_SOURCE_CHANGED');
    const exitCode = result.status === 'MATCH' ? 0 : result.status === 'MISMATCH' ? 2 : 3;
    const execution = {
      schemaVersion: 'aftercheck.cre-rehearsal-execution.v1', executionMode: 'RPC_REHEARSAL',
      startedAt, finishedAt: new Date().toISOString(), sourceRevision: revision, relevantSourceClean: true,
      entrypoint: 'scripts/cre-rehearse.mjs', publicSource: source, metadata,
      comparisonStatus: result.status, exitCode, manifestDigest: manifest.manifestDigest,
      manifestFileSha256: sha256(manifestText), resultSha256: sha256(canonicalJson(result)),
      transcriptSha256: sha256(canonicalJson(transcript)), officialCreSimulation: false,
      limitations: ['Ordinary Node HTTP/RPC execution does not satisfy official CRE simulation qualification.',
        'A local record and its digests do not authenticate Ethereum consensus or a Chainlink attestation.'],
    };
    phase = 'EXCLUSIVE_EXPORT';
    const files = {
      'manifest.json': manifestText, 'result.json': canonicalJson(result) + '\n',
      'transcript.json': canonicalJson(transcript) + '\n',
      'transcript.md': transcriptMarkdown(result, transcript, revision),
      // Written last as the completion record; existing output is never overwritten.
      'execution.json': JSON.stringify(execution, null, 2) + '\n',
    };
    for (const [name, body] of Object.entries(files)) await writeFile(join(options.output, name), body, {flag: 'wx', mode: 0o600});
    console.log(`RPC_REHEARSAL: ${result.status}; manifest ${result.observation.manifestFetch}; ${transcript.requests.length} read-only RPC requests.`);
    console.log('Not an official CRE CLI simulation. Financial-policy verdict unchanged.');
    return exitCode;
  } catch (error) {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.exec(error.message)?.[0] === error.message ? error.message : 'CRE_REHEARSAL_FAILED';
    throw new Error(`${phase}:${code}`);
  } finally { await lock.close(); await rm(lockPath, {force: true}); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRehearsal(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_:]{0,120}$/.exec(error.message)?.[0] === error.message ? error.message : 'CRE_REHEARSAL_FAILED';
    console.error(`RPC_REHEARSAL failed: ${code}. No CRE simulation is claimed.`);
    console.error('Use a fresh output directory; preserve any partial files from a failed export.');
    process.exitCode = 1;
  });
}
