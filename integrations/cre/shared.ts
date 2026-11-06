/** Pure bounded data/compare layer. No Node, RPC, signing, or CRE runtime imports. */
export const MAX_CRE_JSON_BYTES = 32_768;
const MAX_DEPTH = 16;
const MAX_NODES = 2_048;
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export const DEMO_TARGET = Object.freeze({
  sourceRevision: '17ac1368d238f594a6e46728402c298b9e3968f1',
  sourcePath: 'examples/sepolia/evidence.json',
  sourceUrl: 'https://raw.githubusercontent.com/denchik37/aftercheck/17ac1368d238f594a6e46728402c298b9e3968f1/examples/sepolia/evidence.json',
  chainId: '11155111',
  chainSelector: '16015286601757825753',
  transactionHash: '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9',
  blockNumber: '7689923',
  blockHash: '0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34',
  evidenceDigest: '0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093',
  acquiredAt: '2026-11-05T16:49:14.801Z',
  factory: '0x0227628f3f023bb0b980b67d528571c95c6dac1c',
  token0: '0x0f47e03a0383396635846f8495003fc478b71bca',
  token1: '0x9142fa65aaef921aea2127e88758adee0510a0f0',
  fee: '500',
  pool: '0x029603931809d430ae47d2f55212cc0e89dbfd52',
  calldata: '0x1698ee820000000000000000000000000f47e03a0383396635846f8495003fc478b71bca0000000000000000000000009142fa65aaef921aea2127e88758adee0510a0f000000000000000000000000000000000000000000000000000000000000001f4',
} as const);

export const INTENTIONAL_MISMATCH_POOL = '0x0000000000000000000000000000000000000001';
export type Scenario = 'REFERENCE' | 'INTENTIONAL_MISMATCH';
export type Status = 'MATCH' | 'MISMATCH' | 'UNAVAILABLE' | 'UNSUPPORTED';
export type ExecutionMode = 'CRE_CLI_SIMULATION' | 'RPC_REHEARSAL' | 'UNIT_TEST';
export type RpcProvider = 'TENDERLY_PUBLIC_SEPOLIA' | 'PUBLICNODE_SEPOLIA' | 'OTHER_CONFIGURED_SEPOLIA_RPC' | 'UNIT_TEST_FIXTURE';
export const OBSERVATION_ERROR_CODES = Object.freeze([
  'HTTP_FETCH_FAILED', 'HTTP_STATUS_ERROR', 'MANIFEST_INVALID', 'MANIFEST_DIGEST_MISMATCH',
  'EVM_READ_FAILED', 'HEADER_UNAVAILABLE', 'UNSUPPORTED_CHAIN', 'UNSUPPORTED_CAPABILITY',
  'HISTORICAL_STATE_UNAVAILABLE',
] as const);
export type ObservationError = typeof OBSERVATION_ERROR_CODES[number];

export interface Manifest {
  schemaVersion: 'aftercheck.cre-manifest.v1';
  scenario: Scenario;
  observationMode: 'HISTORICAL_BLOCK_NUMBER';
  evidence: {
    evidenceClass: 'RPC_RECEIPT';
    origin: 'THIRD_PARTY_HISTORICAL_SEPOLIA_CAPTURE';
    digest: string;
    sourceRevision: string;
    sourcePath: string;
    sourceUrl: string;
    acquiredAt: string;
  };
  target: {chainId: string; chainSelector: string; transactionHash: string; blockNumber: string; blockHash: string};
  call: {method: 'getPool(address,address,uint24)'; factory: string; token0: string; token1: string; fee: string; calldata: string; expectedPool: string};
  manifestDigest: string;
}

export interface Observation {
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSUPPORTED';
  manifestFetch: 'VERIFIED' | 'UNAVAILABLE' | 'INVALID';
  chainId: string | null;
  chainSelector: string | null;
  requestedBlockNumber: string | null;
  header: {blockNumber: string; blockHash: string} | null;
  call: {to: string; data: string; blockNumber: string} | null;
  returnData: string | null;
  errorCode: ObservationError | null;
}

export interface ExecutionMetadata {
  executionMode: ExecutionMode;
  workflowRevision: string;
  cliVersion: string | null;
  sdkVersion: string | null;
  rpcProvider: RpcProvider;
}

export interface Corroboration {
  schemaVersion: 'aftercheck.cre-corroboration.v1';
  manifest: Manifest;
  observation: Observation;
  metadata: ExecutionMetadata;
  status: Status;
  reasonCodes: string[];
  observedPool: string | null;
  blockBinding: 'BLOCK_NUMBER_PLUS_SEPARATE_HEADER';
  financialPolicyVerdict: 'UNCHANGED';
  limitations: string[];
}

/** UTF-8 byte count without Buffer or TextEncoder (QuickJS compatible). */
function byteLength(text: string): number {
  if (text.length > MAX_CRE_JSON_BYTES) throw new RangeError('CRE_JSON_SIZE_LIMIT');
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
    if (bytes > MAX_CRE_JSON_BYTES) throw new RangeError('CRE_JSON_SIZE_LIMIT');
  }
  return bytes;
}

/** Rejects duplicate/unsafe keys and inexact numeric JSON before schema parsing. */
export function parseBoundedJson(text: string): unknown {
  if (typeof text !== 'string') throw new TypeError('CRE_JSON_STRING_REQUIRED');
  byteLength(text);
  let at = 0, nodes = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[at] ?? '\0')) at++; };
  function string(): string {
    const start = at++;
    while (at < text.length) {
      const char = text[at++];
      if (char === '"') {
        try { return JSON.parse(text.slice(start, at)); }
        catch { throw new TypeError('CRE_INVALID_JSON_STRING'); }
      }
      if (char === '\\') at++;
    }
    throw new TypeError('CRE_UNTERMINATED_JSON_STRING');
  }
  function value(depth: number): unknown {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) throw new RangeError('CRE_JSON_COMPLEXITY_LIMIT');
    whitespace();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; whitespace();
      const obj: Record<string, unknown> = Object.create(null);
      if (text[at] === '}') { at++; return obj; }
      while (at < text.length) {
        whitespace();
        if (text[at] !== '"') throw new TypeError('CRE_INVALID_JSON_KEY');
        const key = string();
        if (FORBIDDEN.has(key)) throw new TypeError('CRE_UNSAFE_JSON_KEY');
        if (has(obj, key)) throw new TypeError('CRE_DUPLICATE_JSON_KEY');
        whitespace();
        if (text[at++] !== ':') throw new TypeError('CRE_INVALID_JSON_OBJECT');
        obj[key] = value(depth + 1); whitespace();
        if (text[at] === '}') { at++; return obj; }
        if (text[at++] !== ',') throw new TypeError('CRE_INVALID_JSON_OBJECT');
      }
      throw new TypeError('CRE_INVALID_JSON_OBJECT');
    }
    if (text[at] === '[') {
      at++; whitespace();
      const arr: unknown[] = [];
      if (text[at] === ']') { at++; return arr; }
      while (at < text.length) {
        arr.push(value(depth + 1)); whitespace();
        if (text[at] === ']') { at++; return arr; }
        if (text[at++] !== ',') throw new TypeError('CRE_INVALID_JSON_ARRAY');
      }
      throw new TypeError('CRE_INVALID_JSON_ARRAY');
    }
    for (const [word, result] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(word, at)) { at += word.length; return result; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at));
    if (number) {
      if (!/^-?(?:0|[1-9][0-9]*)$/.test(number[0])) throw new TypeError('CRE_JSON_INTEGER_REQUIRED');
      const n = Number(number[0]);
      if (!Number.isSafeInteger(n) || Object.is(n, -0)) throw new TypeError('CRE_UNSAFE_JSON_NUMBER');
      at += number[0].length;
      return n;
    }
    throw new TypeError('CRE_INVALID_JSON');
  }
  const result = value(0); whitespace();
  if (at !== text.length) throw new TypeError('CRE_TRAILING_JSON_DATA');
  return result;
}

/** Sorted safe keys; same encoding as the core, with tighter integration bounds. */
export function canonicalJson(input: unknown): string {
  let nodes = 0;
  function encode(value: unknown, depth: number): string {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) throw new RangeError('CRE_JSON_COMPLEXITY_LIMIT');
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'string') { byteLength(value); return JSON.stringify(value); }
    if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return JSON.stringify(value);
    if (typeof value !== 'object' || value === null) throw new TypeError('CRE_UNSUPPORTED_JSON_VALUE');
    if (Object.getOwnPropertySymbols(value).length) throw new TypeError('CRE_UNSUPPORTED_JSON_VALUE');
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_NODES || Object.keys(value).sort().length !== value.length) throw new TypeError('CRE_INVALID_JSON_ARRAY');
      const entries: string[] = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !has(descriptor, 'value')) throw new TypeError('CRE_UNSUPPORTED_JSON_VALUE');
        entries.push(encode(descriptor.value, depth + 1));
      }
      return '[' + entries.join(',') + ']';
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('CRE_UNSUPPORTED_JSON_VALUE');
    const keys = Object.getOwnPropertyNames(value).sort();
    if (keys.length > 64) throw new RangeError('CRE_JSON_COMPLEXITY_LIMIT');
    return '{' + keys.map(key => {
      if (FORBIDDEN.has(key)) throw new TypeError('CRE_UNSAFE_JSON_KEY');
      byteLength(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !has(descriptor, 'value')) throw new TypeError('CRE_UNSUPPORTED_JSON_VALUE');
      return JSON.stringify(key) + ':' + encode(descriptor.value, depth + 1);
    }).join(',') + '}';
  }
  const output = encode(input, 0);
  byteLength(output);
  return output;
}

function inputObject(input: unknown): Record<string, unknown> {
  const parsed = parseBoundedJson(typeof input === 'string' ? input : canonicalJson(input));
  return record(parsed);
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('CRE_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
  const obj = record(value);
  if (Object.keys(obj).sort().length !== names.length || names.some(key => !has(obj, key))) throw new TypeError('CRE_INVALID_FIELDS');
  return obj;
}
function literal(value: unknown, expected: string, code = 'CRE_UNSUPPORTED_IDENTITY'): void {
  if (value !== expected) throw new TypeError(code);
}
function member(value: unknown, allowed: readonly string[], code = 'CRE_INVALID_ENUM'): void {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new TypeError(code);
}
function pattern(value: unknown, regex: RegExp, code: string): void {
  if (typeof value !== 'string' || regex.exec(value)?.[0] !== value) throw new TypeError(code);
}
function decimal(value: unknown): void {
  pattern(value, /^(?:0|[1-9][0-9]{0,77})$/, 'CRE_INVALID_DECIMAL');
  if (BigInt(value as string) >= (1n << 256n)) throw new TypeError('CRE_INVALID_DECIMAL');
}
function hash(value: unknown): void { pattern(value, /^0x[0-9a-f]{64}$/, 'CRE_INVALID_HASH'); }
function address(value: unknown): void { pattern(value, /^0x[0-9a-f]{40}$/, 'CRE_INVALID_ADDRESS'); }
function hex(value: unknown): void { pattern(value, /^0x(?:[0-9a-f]{2}){0,512}$/, 'CRE_INVALID_HEX'); }

/** Shape and supported-target checks only; call assertManifestDigest separately. */
export function parseManifest(input: unknown): Manifest {
  const m = fields(inputObject(input), ['schemaVersion', 'scenario', 'observationMode', 'evidence', 'target', 'call', 'manifestDigest']);
  literal(m.schemaVersion, 'aftercheck.cre-manifest.v1', 'CRE_UNSUPPORTED_MANIFEST_SCHEMA');
  member(m.scenario, ['REFERENCE', 'INTENTIONAL_MISMATCH']);
  literal(m.observationMode, 'HISTORICAL_BLOCK_NUMBER', 'CRE_UNSUPPORTED_OBSERVATION_MODE');
  hash(m.manifestDigest);
  const e = fields(m.evidence, ['evidenceClass', 'origin', 'digest', 'sourceRevision', 'sourcePath', 'sourceUrl', 'acquiredAt']);
  literal(e.evidenceClass, 'RPC_RECEIPT');
  literal(e.origin, 'THIRD_PARTY_HISTORICAL_SEPOLIA_CAPTURE');
  literal(e.digest, DEMO_TARGET.evidenceDigest);
  for (const key of ['sourceRevision', 'sourcePath', 'sourceUrl', 'acquiredAt'] as const) literal(e[key], DEMO_TARGET[key]);
  const t = fields(m.target, ['chainId', 'chainSelector', 'transactionHash', 'blockNumber', 'blockHash']);
  for (const key of ['chainId', 'chainSelector', 'transactionHash', 'blockNumber', 'blockHash'] as const) literal(t[key], DEMO_TARGET[key]);
  const c = fields(m.call, ['method', 'factory', 'token0', 'token1', 'fee', 'calldata', 'expectedPool']);
  literal(c.method, 'getPool(address,address,uint24)');
  for (const key of ['factory', 'token0', 'token1', 'fee', 'calldata'] as const) literal(c[key], DEMO_TARGET[key]);
  literal(c.expectedPool, m.scenario === 'REFERENCE' ? DEMO_TARGET.pool : INTENTIONAL_MISMATCH_POOL, 'CRE_SCENARIO_EXPECTATION_CONFLICT');
  return m as unknown as Manifest;
}

export function manifestDigestInput(input: unknown): string {
  const {manifestDigest: _digest, ...payload} = parseManifest(input);
  return canonicalJson(payload);
}

/** Hashing is supplied by the host: SHA-256 over this canonical UTF-8 text. */
export function assertManifestDigest(input: unknown, sha256Text: (text: string) => string): void {
  const m = parseManifest(input);
  const computed = sha256Text(manifestDigestInput(m));
  hash(computed);
  if (computed !== m.manifestDigest) throw new TypeError('CRE_MANIFEST_DIGEST_MISMATCH');
}

export function parseObservation(input: unknown): Observation {
  const o = fields(inputObject(input), ['availability', 'manifestFetch', 'chainId', 'chainSelector', 'requestedBlockNumber', 'header', 'call', 'returnData', 'errorCode']);
  member(o.availability, ['AVAILABLE', 'UNAVAILABLE', 'UNSUPPORTED']);
  member(o.manifestFetch, ['VERIFIED', 'UNAVAILABLE', 'INVALID']);
  for (const key of ['chainId', 'chainSelector', 'requestedBlockNumber']) if (o[key] !== null) decimal(o[key]);
  if (o.header !== null) {
    const h = fields(o.header, ['blockNumber', 'blockHash']);
    decimal(h.blockNumber); hash(h.blockHash);
  }
  if (o.call !== null) {
    const c = fields(o.call, ['to', 'data', 'blockNumber']);
    address(c.to); hex(c.data); decimal(c.blockNumber);
  }
  if (o.returnData !== null) hex(o.returnData);
  if (o.errorCode !== null) member(o.errorCode, OBSERVATION_ERROR_CODES, 'CRE_INVALID_ERROR_CODE');
  if (o.availability === 'AVAILABLE' && o.errorCode !== null) throw new TypeError('CRE_CONFLICTING_AVAILABILITY');
  return o as unknown as Observation;
}

export function parseExecutionMetadata(input: unknown): ExecutionMetadata {
  const m = fields(inputObject(input), ['executionMode', 'workflowRevision', 'cliVersion', 'sdkVersion', 'rpcProvider']);
  member(m.executionMode, ['CRE_CLI_SIMULATION', 'RPC_REHEARSAL', 'UNIT_TEST']);
  pattern(m.workflowRevision, /^[0-9a-f]{40}$/, 'CRE_INVALID_SOURCE_REVISION');
  member(m.rpcProvider, ['TENDERLY_PUBLIC_SEPOLIA', 'PUBLICNODE_SEPOLIA', 'OTHER_CONFIGURED_SEPOLIA_RPC', 'UNIT_TEST_FIXTURE']);
  if (m.executionMode === 'CRE_CLI_SIMULATION') {
    for (const key of ['cliVersion', 'sdkVersion']) pattern(m[key], /^(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3})(?:-[0-9A-Za-z.-]{1,40})?$/, 'CRE_INVALID_VERSION');
    if (m.rpcProvider === 'UNIT_TEST_FIXTURE') throw new TypeError('CRE_EXECUTION_PROVENANCE_CONFLICT');
  } else if (m.cliVersion !== null || m.sdkVersion !== null) throw new TypeError('CRE_EXECUTION_PROVENANCE_CONFLICT');
  if ((m.executionMode === 'UNIT_TEST') !== (m.rpcProvider === 'UNIT_TEST_FIXTURE')) throw new TypeError('CRE_EXECUTION_PROVENANCE_CONFLICT');
  return m as unknown as ExecutionMetadata;
}

function limitations(metadata: ExecutionMetadata): string[] {
  return [
    'Only Uniswap factory pool identity is compared; the financial-policy verdict is unchanged.',
    'The EVM call is bound to a block number; its separately observed header is not block-hash binding for that call.',
    'Chain ID is selected through the configured network/chain selector; no consensus authentication.',
    'An artifact digest establishes integrity, not source authenticity or Ethereum consensus.',
    'RPC observations are trusted provider responses, not transaction-boundary balance or reserve proofs.',
    metadata.rpcProvider === 'TENDERLY_PUBLIC_SEPOLIA'
      ? 'This observation uses the same Tenderly provider as the retained capture; independent-source validation is not established.'
      : metadata.rpcProvider === 'PUBLICNODE_SEPOLIA'
        ? 'A different public RPC endpoint is configured; independent-source authenticity is not established.'
        : metadata.rpcProvider === 'UNIT_TEST_FIXTURE'
          ? 'Observation values are test fixtures, not independently fetched blockchain data.'
          : 'The configured provider\'s independence from the original capture is unknown.',
    metadata.executionMode === 'CRE_CLI_SIMULATION'
      ? 'CRE_CLI_SIMULATION is a local simulator execution, not a deployed DON attestation or Chainlink certification.'
      : metadata.executionMode === 'RPC_REHEARSAL'
        ? 'RPC_REHEARSAL uses ordinary HTTP/RPC code; this result is not CRE CLI simulation evidence.'
        : 'UNIT_TEST only; this result is not CRE CLI simulation evidence.',
  ];
}

/** Deterministic comparison, not authentication of who obtained the supplied data. */
export function compareObservation(manifestInput: unknown, observationInput: unknown, metadataInput: unknown): Corroboration {
  const manifest = parseManifest(manifestInput);
  const observation = parseObservation(observationInput);
  const metadata = parseExecutionMetadata(metadataInput);
  const reasons: string[] = [];
  let unsupported = false, mismatch = false, unavailable = false;
  const mark = (code: string, category: Status) => {
    if (!reasons.includes(code)) reasons.push(code);
    if (category === 'UNSUPPORTED') unsupported = true;
    if (category === 'MISMATCH') mismatch = true;
    if (category === 'UNAVAILABLE') unavailable = true;
  };
  if (observation.manifestFetch !== 'VERIFIED') mark(observation.manifestFetch === 'INVALID' ? 'PUBLIC_MANIFEST_INVALID' : 'PUBLIC_MANIFEST_UNAVAILABLE', 'UNAVAILABLE');
  if (observation.availability !== 'AVAILABLE') mark(observation.errorCode ?? 'OBSERVATION_UNAVAILABLE', observation.availability);
  for (const key of ['chainId', 'chainSelector'] as const) {
    if (observation[key] === null) mark(key === 'chainId' ? 'CHAIN_ID_UNAVAILABLE' : 'CHAIN_SELECTOR_UNAVAILABLE', 'UNAVAILABLE');
    else if (observation[key] !== manifest.target[key]) mark(key === 'chainId' ? 'CHAIN_ID_MISMATCH' : 'CHAIN_SELECTOR_MISMATCH', 'UNSUPPORTED');
  }
  if (observation.requestedBlockNumber === null) mark('REQUESTED_BLOCK_UNAVAILABLE', 'UNAVAILABLE');
  else if (observation.requestedBlockNumber !== manifest.target.blockNumber) mark('REQUESTED_BLOCK_MISMATCH', 'MISMATCH');
  if (observation.header === null) mark('HEADER_UNAVAILABLE', 'UNAVAILABLE');
  else {
    if (observation.header.blockNumber !== manifest.target.blockNumber) mark('HEADER_NUMBER_MISMATCH', 'MISMATCH');
    if (observation.header.blockHash !== manifest.target.blockHash) mark('HEADER_HASH_MISMATCH', 'MISMATCH');
  }
  if (observation.call === null) mark('CALL_IDENTITY_UNAVAILABLE', 'UNAVAILABLE');
  else {
    if (observation.call.to !== manifest.call.factory) mark('CALL_CONTRACT_MISMATCH', 'MISMATCH');
    if (observation.call.data !== manifest.call.calldata) mark('CALL_DATA_MISMATCH', 'MISMATCH');
    if (observation.call.blockNumber !== manifest.target.blockNumber) mark('CALL_BLOCK_MISMATCH', 'MISMATCH');
  }
  let observedPool: string | null = null;
  if (observation.returnData === null) mark('POOL_RESULT_UNAVAILABLE', 'UNAVAILABLE');
  else if (!/^0x0{24}[0-9a-f]{40}$/.test(observation.returnData)) mark('MALFORMED_POOL_RETURN_DATA', 'UNAVAILABLE');
  else {
    observedPool = '0x' + observation.returnData.slice(26);
    if (observedPool !== manifest.call.expectedPool) mark('POOL_ADDRESS_MISMATCH', 'MISMATCH');
  }
  const status: Status = unsupported ? 'UNSUPPORTED' : mismatch ? 'MISMATCH' : unavailable ? 'UNAVAILABLE' : 'MATCH';
  if (status === 'MATCH') reasons.push('POOL_IDENTITY_MATCH');
  return {schemaVersion: 'aftercheck.cre-corroboration.v1', manifest, observation, metadata, status,
    reasonCodes: reasons, observedPool, blockBinding: 'BLOCK_NUMBER_PLUS_SEPARATE_HEADER',
    financialPolicyVerdict: 'UNCHANGED', limitations: limitations(metadata)};
}

/** Rejects forged statuses/reasons/limitations. Digest/source authentication is separate. */
export function parseCorroboration(input: unknown): Corroboration {
  const r = fields(inputObject(input), ['schemaVersion', 'manifest', 'observation', 'metadata', 'status', 'reasonCodes', 'observedPool', 'blockBinding', 'financialPolicyVerdict', 'limitations']);
  literal(r.schemaVersion, 'aftercheck.cre-corroboration.v1', 'CRE_UNSUPPORTED_RESULT_SCHEMA');
  const expected = compareObservation(r.manifest, r.observation, r.metadata);
  if (canonicalJson(r) !== canonicalJson(expected)) throw new TypeError('CRE_RESULT_COMPARISON_CONFLICT');
  return expected;
}
