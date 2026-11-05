/** Bounded read-only research. Not a financial verifier or transaction executor. */
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseJson} from '../src/json.ts';
import {RpcError} from '../src/rpc.ts';
import {hexData, quantity} from '../src/evidence.ts';
import {address, hash32, requireRecord} from '../src/values.ts';
import {SEPOLIA_CHAIN_ID, SEPOLIA_ROUTER02, decodeAddressResult, decodeExactInputSingle} from '../src/uniswap.ts';
import {verifyEvidence} from '../src/verify.ts';

export const TOKENS = Object.freeze({
  usdc: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  implementation: '0xda317c1d3e835dd5f1be459006471acaa1289068',
  weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  pool: '0x3289680dd4d6c10bb19b899729cda5eef58aeff1'
});
// Authenticated legacy ZeppelinOS slots, NOT EIP-1967. See the research report.
export const SLOTS = Object.freeze({
  implementation: '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3',
  admin: '0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b'
});
export const RUNTIME_SHA256 = Object.freeze({
  usdcProxy: '846efa39d1689bdcffea1cdabe788d0b6f81050c0667ad6444e722aed27f7e86',
  usdcImplementation: 'eb2726ec3ac0cb69704b0d37e7076470f47e87c6eaac452f173d58c607b4265f',
  weth: '9bbda01ae25d1f2b4171918cc6280a5769d6d6fc5500ed01e2143697902df4e1'
});
const PUBLIC_RPC = 'https://sepolia.gateway.tenderly.co';
const METHODS = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call']);
const SAFE_ERRORS = new Set(['INVALID_RPC_URL', 'RPC_HTTPS_REQUIRED', 'INVALID_RPC_LIMIT',
  'RPC_METHOD_NOT_ALLOWED', 'RPC_REQUEST_NOT_ALLOWED', 'RPC_BUDGET_EXHAUSTED', 'RPC_HTTP_ERROR',
  'RPC_EMPTY_RESPONSE', 'RPC_RESPONSE_TOO_LARGE', 'RPC_INVALID_JSON', 'RPC_REMOTE_ERROR',
  'RPC_INVALID_ENVELOPE', 'RPC_TIMEOUT', 'RPC_TRANSPORT_ERROR']);
const safeError = error => error instanceof RpcError && SAFE_ERRORS.has(error.code) ? error.code : 'RPC_READ_FAILED';
const addrWord = value => value.slice(2).padStart(64, '0');
const CALLS = new Set(['0x5c60da1b', '0xf851a440', '0x5c975abb', '0x313ce567',
  '0x8da5cb5b', '0x9fd0506d', '0xbd102430', '0x35d99f35',
  '0xfe575a87' + addrWord(SEPOLIA_ROUTER02), '0xfe575a87' + addrWord(TOKENS.pool)]);
function context(input) {
  const value = requireRecord(input, 'context');
  if (Object.keys(value).length !== 2 || value.requireCanonical !== true) throw new Error();
  hash32(value.blockHash);
}
function allowedRequest(method, params) {
  if (!Array.isArray(params)) return false;
  try {
    if (method === 'eth_chainId') return params.length === 0;
    if (method === 'eth_getBlockByNumber') {
      if (params[0] !== 'latest') quantity(params[0]);
      return params.length === 2 && params[1] === false;
    }
    if (method === 'eth_getStorageAt') {
      context(params[2]);
      return params.length === 3 && params[0] === TOKENS.usdc && Object.values(SLOTS).includes(params[1]);
    }
    context(params[1]);
    if (params.length !== 2) return false;
    if (method === 'eth_getCode') return [TOKENS.usdc, TOKENS.implementation, TOKENS.weth].includes(params[0]);
    if (method === 'eth_call') {
      const call = requireRecord(params[0], 'call');
      if (Object.keys(call).sort().join(',') !== 'data,to') return false;
      return (call.to === TOKENS.usdc && CALLS.has(call.data)) ||
        (call.to === TOKENS.weth && call.data === '0x313ce567');
    }
  } catch { return false; }
  return false;
}

/** Isolated extension for fixed storage reads. Production RpcClient is unchanged. */
export class TokenResearchRpcClient {
  #endpoint; #fetch; #id = 0; #started = Date.now(); #bytes = 0; #timeout; #total; #limit;
  constructor(endpoint = PUBLIC_RPC, {fetchImpl = fetch, timeoutMs = 15_000, totalTimeoutMs = 120_000, maxResponseBytes = 1_000_000} = {}) {
    let url;
    try { url = new URL(endpoint); } catch { throw new RpcError('INVALID_RPC_URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.hash) throw new RpcError('INVALID_RPC_URL');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new RpcError('RPC_HTTPS_REQUIRED');
    if (![timeoutMs, totalTimeoutMs, maxResponseBytes].every(n => Number.isSafeInteger(n) && n > 0)) throw new RpcError('INVALID_RPC_LIMIT');
    this.#endpoint = endpoint; this.#fetch = fetchImpl;
    this.#timeout = Math.min(timeoutMs, 15_000); this.#total = Math.min(totalTimeoutMs, 120_000);
    this.#limit = Math.min(maxResponseBytes, 1_000_000);
  }
  async call(method, params) {
    if (!METHODS.has(method)) throw new RpcError('RPC_METHOD_NOT_ALLOWED');
    if (!allowedRequest(method, params)) throw new RpcError('RPC_REQUEST_NOT_ALLOWED');
    if (++this.#id > 32 || Date.now() - this.#started >= this.#total) throw new RpcError('RPC_BUDGET_EXHAUSTED');
    const id = this.#id, controller = new AbortController();
    let timedOut = false, response;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); },
      Math.min(this.#timeout, this.#total - (Date.now() - this.#started)));
    try {
      response = await this.#fetch(this.#endpoint, {method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({jsonrpc: '2.0', id, method, params}), signal: controller.signal,
        redirect: 'error', credentials: 'omit'});
      if (!response.ok) throw new RpcError('RPC_HTTP_ERROR');
      if (!response.body) throw new RpcError('RPC_EMPTY_RESPONSE');
      if (Number(response.headers.get('content-length')) > this.#limit) throw new RpcError('RPC_RESPONSE_TOO_LARGE');
      const reader = response.body.getReader(), chunks = [];
      let size = 0;
      try {
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.byteLength; this.#bytes += value.byteLength;
          if (size > this.#limit || this.#bytes > 4_000_000) throw new RpcError('RPC_RESPONSE_TOO_LARGE');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      let data;
      try { data = requireRecord(parseJson(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)), this.#limit), 'rpc'); }
      catch { throw new RpcError('RPC_INVALID_JSON'); }
      if (data.jsonrpc !== '2.0' || data.id !== id || !Object.hasOwn(data, 'result') || Object.hasOwn(data, 'error')) {
        throw new RpcError(Object.hasOwn(data, 'error') ? 'RPC_REMOTE_ERROR' : 'RPC_INVALID_ENVELOPE');
      }
      return data.result;
    } catch (error) {
      if (timedOut) throw new RpcError('RPC_TIMEOUT');
      if (error instanceof RpcError && SAFE_ERRORS.has(error.code)) throw error;
      throw new RpcError('RPC_TRANSPORT_ERROR');
    } finally {
      clearTimeout(timer); controller.abort();
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  }
}

function block(input) {
  const b = requireRecord(input, 'block');
  return {hash: hash32(b.hash), number: '0x' + quantity(b.number).toString(16), timestampRaw: quantity(b.timestamp).toString()};
}
function abiUint(input, bits = 256) {
  const data = hexData(input, 32);
  if (data.length !== 66 || BigInt(data) >= 1n << BigInt(bits)) throw new Error();
  return BigInt(data).toString();
}
const abiBool = input => abiUint(input, 1) === '1';
function code(input) {
  const raw = hexData(input, 65_536).toLowerCase();
  return {bytes: (raw.length - 2) / 2, sha256: createHash('sha256').update(Buffer.from(raw.slice(2), 'hex')).digest('hex')};
}

/** Fixed identities/selectors only. An unexpected upgrade is never followed or authenticated automatically. */
export async function probeSepoliaTokenSemantics(client, {blockNumber = 'latest'} = {}) {
  if (blockNumber !== 'latest') quantity(blockNumber);
  const result = {
    kind: 'SEPOLIA_READ_ONLY_TOKEN_SEMANTICS', acquiredAt: new Date().toISOString(),
    sourceTrust: 'RPC_PROVIDER_DEPENDENT', chainId: SEPOLIA_CHAIN_ID, block: null,
    status: 'INCOMPLETE', implementationIdentity: 'UNKNOWN', transferConfiguration: 'UNKNOWN',
    receiptCompatibility: 'NOT_TESTED_BY_STATE_PROBE', immediateBalances: 'UNKNOWN', readiness: 'NOT_ESTABLISHED',
    tokens: TOKENS, runtimeHashes: {}, proxy: {}, configuration: {}, observations: [], errors: [], requestCount: 0,
    limitations: ['Observations describe block-end state, not transaction-boundary state or consensus proofs.',
      'Future upgrades, pause and blacklist changes can invalidate these observations.',
      'Only the fixed router/pool blacklist state is checked. No owner, balance, allowance or funding is selected.',
      'Source-compatible receipts do not independently prove actual immediate balances; reserves remain UNKNOWN.',
      'No signing, approval, funding, broadcast, deployment or pre-execution policy is authorized.']
  };
  let rejected = false;
  const conflict = (stage, error) => { rejected = true; result.errors.push({stage, code: error}); };
  const finish = () => {
    result.status = rejected ? 'REJECTED' : result.errors.length ? 'INCOMPLETE' : 'OBSERVED';
    if (result.status !== 'OBSERVED') { result.implementationIdentity = 'UNKNOWN'; result.transferConfiguration = 'UNKNOWN'; }
    return result;
  };
  async function read(key, method, params, decode) {
    const observation = {key, method, params}; result.observations.push(observation); result.requestCount++;
    let raw;
    try { raw = await client.call(method, params); }
    catch (error) { observation.error = safeError(error); result.errors.push({stage: key, code: observation.error}); return null; }
    try {
      const parsed = decode(raw);
      observation.result = method === 'eth_getCode' || method === 'eth_getBlockByNumber' ? parsed :
        method === 'eth_chainId' ? '0x' + parsed.toString(16) : hexData(raw, 32).toLowerCase();
      return parsed;
    } catch { observation.error = 'MALFORMED_RESULT'; result.errors.push({stage: key, code: observation.error}); return null; }
  }
  const chain = await read('chain.initial', 'eth_chainId', [], quantity);
  if (chain === null) return finish();
  if (chain !== BigInt(SEPOLIA_CHAIN_ID)) { conflict('chain.initial', 'CHAIN_ID_CONFLICT'); return finish(); }
  result.block = await read('block.initial', 'eth_getBlockByNumber', [blockNumber, false], block);
  if (result.block === null) return finish();
  if (blockNumber !== 'latest' && quantity(result.block.number) !== quantity(blockNumber)) {
    conflict('block.initial', 'BLOCK_NUMBER_CONFLICT'); return finish();
  }
  const ctx = {blockHash: result.block.hash, requireCanonical: true};
  const call = (key, target, data, decode) => read(key, 'eth_call', [{to: target, data}, ctx], decode);
  const storage = (key, slot) => read(key, 'eth_getStorageAt', [TOKENS.usdc, slot, ctx], decodeAddressResult);
  async function runtime(key, target) {
    const observed = await read(key + '.code', 'eth_getCode', [target, ctx], code);
    result.runtimeHashes[key] = observed;
    if (observed !== null && (observed.bytes === 0 || observed.sha256 !== RUNTIME_SHA256[key])) {
      conflict(key + '.code', observed.bytes === 0 ? 'EMPTY_CONTRACT_CODE' : 'RUNTIME_IDENTITY_CONFLICT');
    }
    return observed;
  }
  const [proxyCode, wethCode, implementation, implementationSlot, admin, adminSlot] = await Promise.all([
    runtime('usdcProxy', TOKENS.usdc), runtime('weth', TOKENS.weth),
    call('proxy.implementation', TOKENS.usdc, '0x5c60da1b', decodeAddressResult),
    storage('proxy.implementationSlot', SLOTS.implementation),
    call('proxy.admin', TOKENS.usdc, '0xf851a440', decodeAddressResult), storage('proxy.adminSlot', SLOTS.admin)
  ]);
  result.proxy = {pattern: 'LEGACY_ZEPPELINOS', implementation, implementationSlot, admin, adminSlot};
  if (implementation !== null && implementation !== TOKENS.implementation) conflict('proxy.implementation', 'UNEXPECTED_IMPLEMENTATION');
  if (implementationSlot !== null && implementationSlot !== TOKENS.implementation) conflict('proxy.implementationSlot', 'UNEXPECTED_IMPLEMENTATION');
  if (implementation !== null && implementationSlot !== null && implementation !== implementationSlot) conflict('proxy', 'IMPLEMENTATION_IDENTITY_CONFLICT');
  if (admin !== null && adminSlot !== null && admin !== adminSlot) conflict('proxy', 'ADMIN_IDENTITY_CONFLICT');
  if (implementation === TOKENS.implementation && implementationSlot === TOKENS.implementation && proxyCode?.sha256 === RUNTIME_SHA256.usdcProxy) {
    await runtime('usdcImplementation', TOKENS.implementation);
  }
  const values = await Promise.all([
    call('usdc.paused', TOKENS.usdc, '0x5c975abb', abiBool),
    call('usdc.routerBlacklisted', TOKENS.usdc, '0xfe575a87' + addrWord(SEPOLIA_ROUTER02), abiBool),
    call('usdc.poolBlacklisted', TOKENS.usdc, '0xfe575a87' + addrWord(TOKENS.pool), abiBool),
    call('usdc.decimals', TOKENS.usdc, '0x313ce567', value => abiUint(value, 8)),
    call('weth.decimals', TOKENS.weth, '0x313ce567', value => abiUint(value, 8)),
    ...[['owner', '0x8da5cb5b'], ['pauser', '0x9fd0506d'], ['blacklister', '0xbd102430'], ['masterMinter', '0x35d99f35']].map(
      ([key, selector]) => call('usdc.' + key, TOKENS.usdc, selector, decodeAddressResult))
  ]);
  const [paused, routerBlacklisted, poolBlacklisted, usdcDecimals, wethDecimals, owner, pauser, blacklister, masterMinter] = values;
  result.configuration = {paused, routerBlacklisted, poolBlacklisted, usdcDecimals, wethDecimals, owner, pauser, blacklister, masterMinter};
  if ([paused, routerBlacklisted, poolBlacklisted].some(v => v === true)) conflict('configuration', 'TRANSFER_CONFIGURATION_BLOCKED');
  if ((usdcDecimals !== null && usdcDecimals !== '6') || (wethDecimals !== null && wethDecimals !== '18')) conflict('configuration', 'TOKEN_METADATA_CONFLICT');
  const [finalBlock, finalChain] = await Promise.all([
    read('block.final', 'eth_getBlockByNumber', [result.block.number, false], block),
    read('chain.final', 'eth_chainId', [], quantity)
  ]);
  if (finalBlock !== null && JSON.stringify(finalBlock) !== JSON.stringify(result.block)) conflict('block.final', 'CANONICAL_BLOCK_CONFLICT');
  if (finalChain !== null && finalChain !== BigInt(SEPOLIA_CHAIN_ID)) conflict('chain.final', 'CHAIN_ID_CONFLICT');
  if (!rejected && result.errors.length === 0 && proxyCode && wethCode && result.runtimeHashes.usdcImplementation) {
    result.implementationIdentity = 'MATCHED_AUTHENTICATED_RUNTIMES';
    result.transferConfiguration = 'CLEAR_FOR_OBSERVED_FIXED_CONTRACTS';
  }
  return finish();
}

/** Offline adapter reuse, with a retrospective route-compatibility policy only. Never a new intent/policy declaration. */
export function assessSelectedReceipt(evidence) {
  const result = {kind: 'SEPOLIA_TOKEN_RECEIPT_COMPATIBILITY', status: 'UNKNOWN', evidenceClass: 'UNKNOWN',
    transactionHash: null, blockHash: null, amounts: null, verifier: null, immediateBalances: 'UNKNOWN',
    policyMeaning: 'RETROSPECTIVE_ROUTE_COMPATIBILITY_ONLY', verificationMode: 'OFFLINE_REPLAY',
    sourceTrust: 'BUNDLE_SOURCE_NOT_AUTHENTICATED_BY_REPLAY'};
  try {
    const e = requireRecord(evidence, 'evidence'), tx = requireRecord(e.transaction, 'transaction');
    const d = decodeExactInputSingle(tx.input);
    if (d.tokenIn !== TOKENS.usdc || d.tokenOut !== TOKENS.weth || d.fee !== 500) return {...result, status: 'UNSUPPORTED_PAIR'};
    const report = verifyEvidence(evidence, {schemaVersion: 'aftercheck.policy.v1', chainId: SEPOLIA_CHAIN_ID,
      owner: address(tx.from), expectedRecipient: d.recipient, tokenIn: TOKENS.usdc, tokenOut: TOKENS.weth,
      maxInputRaw: d.amountInRaw, minReceivedRaw: d.amountOutMinimumRaw});
    result.evidenceClass = report.evidenceClass; result.transactionHash = report.transactionHash;
    result.verifier = {execution: report.execution, support: report.support, coverage: report.coverage, verdict: report.verdict};
    if (report.verdict === 'PASS' && report.coverage === 'COMPLETE' && report.protocol?.pool === TOKENS.pool) {
      result.status = report.evidenceClass === 'RPC_RECEIPT' ? 'OBSERVED_COMPATIBLE' : 'SYNTHETIC_COMPATIBLE';
      result.blockHash = report.blockHash;
      result.amounts = {inputRaw: report.protocol.amountInRaw, outputRaw: report.protocol.amountOutRaw};
    }
    return result;
  } catch { return result; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
      console.log('Read-only fixed Sepolia token/source probe. [--json] [--block=0xNUMBER]. Default: public Tenderly; optional AFTERCHECK_RPC_URL. No transaction execution or financial verdict.');
    } else {
      if (args.length > 2 || new Set(args).size !== args.length || args.some(a => a !== '--json' && !/^--block=0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/.test(a)) || args.filter(a => a.startsWith('--block=')).length > 1) throw new Error();
      const blockNumber = args.find(a => a.startsWith('--block='))?.slice(8) ?? 'latest';
      const client = new TokenResearchRpcClient(process.env.AFTERCHECK_RPC_URL ?? PUBLIC_RPC);
      const result = await probeSepoliaTokenSemantics(client, {blockNumber});
      if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
      else console.log(`Research: ${result.status}\nBlock: ${result.block?.number ?? 'UNKNOWN'} ${result.block?.hash ?? ''}\nImplementation: ${result.implementationIdentity}\nConfiguration: ${result.transferConfiguration}\nReceipt: ${result.receiptCompatibility}\nImmediate balances: ${result.immediateBalances}\nReadiness: ${result.readiness}\nCalls: ${result.requestCount}\n${result.errors.map(e => `${e.stage}: ${e.code}`).join('\n')}`);
      process.exitCode = result.status === 'OBSERVED' ? 0 : 2;
    }
  } catch (error) { console.error(error instanceof RpcError ? safeError(error) : 'INVALID_PROBE_INPUT'); process.exitCode = 1; }
}
