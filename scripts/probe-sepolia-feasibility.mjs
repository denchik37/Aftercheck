/** Read-only research, separate from the financial verifier and its evidence schema. */
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {RpcClient, RpcError} from '../src/rpc.ts';
import {hexData, quantity} from '../src/evidence.ts';
import {address, hash32, positiveAmount, requireRecord} from '../src/values.ts';
import {SEPOLIA_CHAIN_ID, SEPOLIA_ROUTER02, SEPOLIA_V3_FACTORY, decodeAddressResult, poolStateRequests} from '../src/uniswap.ts';

export const HISTORICAL_CANDIDATE = Object.freeze({
  pool: '0x029603931809d430ae47d2f55212cc0e89dbfd52',
  tokenIn: '0x0f47e03a0383396635846f8495003fc478b71bca',
  tokenOut: '0x9142fa65aaef921aea2127e88758adee0510a0f0', fee: 500,
  amountInRaw: '1000000000000000000'
});
// Official Sepolia QuoterV2. It quotes pool behavior; it does not test an owner's balance/allowance.
export const SEPOLIA_QUOTER_V2 = '0xed1f6473345f45b75f8179591dd5ba1888cf2fb3';
const ZERO = '0x' + '0'.repeat(40);
const MIN_SQRT_RATIO = 4295128739n;
const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;
const SAFE_RPC_ERRORS = new Set(['INVALID_RPC_URL', 'RPC_HTTPS_REQUIRED', 'INVALID_RPC_LIMIT',
  'RPC_METHOD_NOT_ALLOWED', 'RPC_BUDGET_EXHAUSTED', 'RPC_HTTP_ERROR', 'RPC_EMPTY_RESPONSE',
  'RPC_RESPONSE_TOO_LARGE', 'RPC_INVALID_JSON', 'RPC_REMOTE_ERROR', 'RPC_INVALID_ENVELOPE',
  'RPC_TIMEOUT', 'RPC_TRANSPORT_ERROR']);
const errorCode = error => error instanceof RpcError && SAFE_RPC_ERRORS.has(error.code) ? error.code : 'RPC_READ_FAILED';
const word = n => BigInt(n).toString(16).padStart(64, '0');
const addressWord = a => a.slice(2).padStart(64, '0');
function words(value, count) {
  const result = hexData(value, count * 32).toLowerCase();
  if (result.length !== 2 + count * 64) throw new Error();
  return Array.from({length: count}, (_, i) => BigInt('0x' + result.slice(2 + i * 64, 66 + i * 64)));
}
function uint(value, bits) { if (value >= 1n << BigInt(bits)) throw new Error(); return value.toString(); }
function block(value) {
  const b = requireRecord(value, 'block');
  return {hash: hash32(b.hash), number: '0x' + quantity(b.number).toString(16), timestampRaw: quantity(b.timestamp).toString()};
}
function slot0(value) {
  const w = words(value, 7);
  const tick = w[1] >= 1n << 255n ? w[1] - (1n << 256n) : w[1];
  if (tick < -887272n || tick > 887272n || w[6] > 1n ||
    (w[0] !== 0n && (w[0] < MIN_SQRT_RATIO || w[0] >= MAX_SQRT_RATIO))) throw new Error();
  return {sqrtPriceX96Raw: uint(w[0], 160), tick: Number(tick),
    observationIndex: uint(w[2], 16), observationCardinality: uint(w[3], 16),
    observationCardinalityNext: uint(w[4], 16), feeProtocol: uint(w[5], 8), unlocked: w[6] === 1n};
}
function candidateInput(input) {
  const c = requireRecord(input, 'candidate');
  if (Object.keys(c).some(k => !['pool', 'tokenIn', 'tokenOut', 'fee', 'amountInRaw'].includes(k)) ||
      !Number.isInteger(c.fee) || c.fee < 1 || c.fee >= 1_000_000) throw new Error('INVALID_CANDIDATE');
  const amountIn = positiveAmount(c.amountInRaw);
  if (amountIn >= 1n << 255n) throw new Error('INVALID_CANDIDATE');
  const result = {pool: address(c.pool), tokenIn: address(c.tokenIn), tokenOut: address(c.tokenOut), fee: c.fee, amountInRaw: amountIn.toString()};
  const identities = [result.pool, result.tokenIn, result.tokenOut, SEPOLIA_ROUTER02, SEPOLIA_V3_FACTORY];
  if (identities.includes(ZERO) || new Set(identities).size !== identities.length) throw new Error('INVALID_CANDIDATE');
  return result;
}

/** The injected reader must implement call(method, params). No signing or arbitrary calldata entry point exists. */
export async function probeSepoliaFeasibility(client, {candidate = HISTORICAL_CANDIDATE} = {}) {
  const c = candidateInput(candidate), [token0, token1] = [c.tokenIn, c.tokenOut].sort();
  const result = {
    kind: 'SEPOLIA_READ_ONLY_FEASIBILITY', acquiredAt: new Date().toISOString(),
    sourceTrust: 'RPC_PROVIDER_DEPENDENT', candidateStatus: 'INCOMPLETE', readiness: 'NOT_ESTABLISHED',
    deployment: {status: 'UNVERIFIED', chainId: SEPOLIA_CHAIN_ID, router: SEPOLIA_ROUTER02, factory: SEPOLIA_V3_FACTORY},
    pool: {status: 'UNVERIFIED', ...c}, liquidity: {status: 'UNVERIFIED'}, block: null,
    quote: {status: 'UNVERIFIED', quoter: SEPOLIA_QUOTER_V2, amountInRaw: c.amountInRaw, kind: 'READ_ONLY_QUOTER_SIMULATION'},
    tokenAccess: {status: 'UNVERIFIED', semantics: 'UNVERIFIED'}, walletFunding: {status: 'UNVERIFIED'},
    historicalRpc: {hashBoundState: 'UNVERIFIED', fullCollectorPath: 'NOT_TESTED'},
    observations: [], errors: [], requestCount: 0,
    unresolved: ['Token transfer semantics and legitimate acquisition are not established by code or metadata.',
      'No owner wallet, token balance, allowance, or gas funding has been established.',
      'Liquidity and a QuoterV2 quote do not establish future execution, a supported receipt, or complete router gas cost.',
      'A complete receipt and all twelve historical collector observations remain necessary after a future transaction.',
      'No pre-execution policy has been published. Wallet actions require separate owner authorization.']
  };
  let rejected = false;
  function conflict(stage, code) { result.errors.push({stage, code}); rejected = true; }
  async function read(key, method, params, decode) {
    result.requestCount++;
    const observation = {key, method, params};
    result.observations.push(observation);
    let raw;
    try { raw = await client.call(method, params); }
    catch (error) { observation.error = errorCode(error); result.errors.push({stage: key, code: observation.error}); return null; }
    try {
      const parsed = decode(raw);
      // Export only validated fields. Code is identified by length and SHA-256, never arbitrary provider text.
      observation.result = method === 'eth_chainId' ? '0x' + parsed.toString(16) :
        method === 'eth_getCode' || method.startsWith('eth_getBlock') ? parsed : hexData(raw, 224).toLowerCase();
      return parsed;
    } catch { observation.error = 'MALFORMED_RESULT'; result.errors.push({stage: key, code: observation.error}); return null; }
  }
  function finish() {
    result.candidateStatus = rejected ? 'REJECTED' : result.errors.length ? 'INCOMPLETE' : 'OBSERVED';
    return result;
  }
  const chain = await read('chain.initial', 'eth_chainId', [], quantity);
  if (chain === null) return finish();
  if (chain !== BigInt(SEPOLIA_CHAIN_ID)) { conflict('chain.initial', 'CHAIN_ID_CONFLICT'); return finish(); }
  result.block = await read('block.initial', 'eth_getBlockByNumber', ['latest', false], block);
  if (result.block === null) return finish();
  const context = {blockHash: result.block.hash, requireCanonical: true};
  const codeResult = value => {
    const hex = hexData(value, 65_536).toLowerCase();
    return {bytes: (hex.length - 2) / 2, sha256: createHash('sha256').update(Buffer.from(hex.slice(2), 'hex')).digest('hex')};
  };
  const state = async (key, method, params, decode) => read(key, method, [...params, context], decode);
  const codes = {};
  await Promise.all([['router', SEPOLIA_ROUTER02], ['factory', SEPOLIA_V3_FACTORY], ['tokenIn', c.tokenIn], ['tokenOut', c.tokenOut]].map(async ([key, target]) => {
    codes[key] = await state(key + '.code', 'eth_getCode', [target], codeResult);
    if (codes[key]?.bytes === 0) conflict(key + '.code', 'EMPTY_CONTRACT_CODE');
  }));
  const [routerFactory, selected] = await Promise.all([
    state('router.factory', 'eth_call', [{to: SEPOLIA_ROUTER02, data: '0xc45a0155'}], decodeAddressResult),
    state('factory.pool', 'eth_call', [{to: SEPOLIA_V3_FACTORY,
      data: '0x1698ee82' + addressWord(token0) + addressWord(token1) + word(c.fee)}], decodeAddressResult)
  ]);
  if (routerFactory !== null && routerFactory !== SEPOLIA_V3_FACTORY) conflict('router.factory', 'FACTORY_IDENTITY_CONFLICT');
  result.deployment.status = codes.router?.bytes > 0 && codes.factory?.bytes > 0 && routerFactory === SEPOLIA_V3_FACTORY ? 'OBSERVED_MATCH' : 'UNVERIFIED';
  result.pool.factorySelectedPool = selected;
  if (selected !== null && selected !== c.pool) conflict('factory.pool', selected === ZERO ? 'POOL_NOT_FOUND' : 'POOL_IDENTITY_CONFLICT');
  if (selected === c.pool) {
    const metadata = {};
    await Promise.all(poolStateRequests(selected).map(async request => {
      const decode = request.key === 'pool.code' ? codeResult : request.key === 'pool.fee' ? value => uint(words(value, 1)[0], 24) : decodeAddressResult;
      metadata[request.key] = await state(request.key, request.method, request.params, decode);
    }));
    if (metadata['pool.code']?.bytes === 0) conflict('pool.code', 'EMPTY_CONTRACT_CODE');
    for (const [key, expected] of [['pool.factory', SEPOLIA_V3_FACTORY], ['pool.token0', token0], ['pool.token1', token1], ['pool.fee', String(c.fee)]]) {
      if (metadata[key] !== null && metadata[key] !== expected) conflict(key, 'POOL_METADATA_CONFLICT');
    }
    result.pool.status = metadata['pool.code']?.bytes > 0 && codes.tokenIn?.bytes > 0 && codes.tokenOut?.bytes > 0 &&
      metadata['pool.factory'] === SEPOLIA_V3_FACTORY && metadata['pool.token0'] === token0 && metadata['pool.token1'] === token1 && metadata['pool.fee'] === String(c.fee) ? 'OBSERVED_MATCH' : 'UNVERIFIED';
    const [activeRaw, observedSlot0, quoterCode, quoterFactory] = await Promise.all([
      state('pool.liquidity', 'eth_call', [{to: selected, data: '0x1a686502'}], value => uint(words(value, 1)[0], 128)),
      state('pool.slot0', 'eth_call', [{to: selected, data: '0x3850c7bd'}], slot0),
      state('quoter.code', 'eth_getCode', [SEPOLIA_QUOTER_V2], codeResult),
      state('quoter.factory', 'eth_call', [{to: SEPOLIA_QUOTER_V2, data: '0xc45a0155'}], decodeAddressResult)
    ]);
    result.liquidity = {status: activeRaw === null || observedSlot0 === null ? 'UNVERIFIED' : activeRaw === '0' ? 'ZERO_ACTIVE_LIQUIDITY' : 'OBSERVED_NONZERO', activeRaw, slot0: observedSlot0};
    if (quoterCode?.bytes === 0) conflict('quoter.code', 'EMPTY_CONTRACT_CODE');
    if (quoterFactory !== null && quoterFactory !== SEPOLIA_V3_FACTORY) conflict('quoter.factory', 'FACTORY_IDENTITY_CONFLICT');
    if (quoterCode?.bytes > 0 && quoterFactory === SEPOLIA_V3_FACTORY && result.pool.status === 'OBSERVED_MATCH') {
      // QuoterV2 uses amountIn BEFORE fee, unlike Router02's seven-field tuple.
      const quoted = await state('quoter.quote', 'eth_call', [{to: SEPOLIA_QUOTER_V2,
        data: '0xc6a5026a' + addressWord(c.tokenIn) + addressWord(c.tokenOut) + word(c.amountInRaw) + word(c.fee) + word(0)}], value => {
        const w = words(value, 4);
        if (w[1] < MIN_SQRT_RATIO || w[1] >= MAX_SQRT_RATIO) throw new Error();
        return {amountOutRaw: uint(w[0], 256), sqrtPriceX96AfterRaw: uint(w[1], 160),
          initializedTicksCrossed: uint(w[2], 32), swapGasEstimateRaw: uint(w[3], 256)};
      });
      if (quoted !== null) result.quote = {...result.quote, status: quoted.amountOutRaw === '0' ? 'ZERO_OUTPUT' : 'QUOTED', ...quoted};
    }
  }
  const [canonical, finalChain] = await Promise.all([
    read('block.final', 'eth_getBlockByNumber', [result.block.number, false], block),
    read('chain.final', 'eth_chainId', [], quantity)
  ]);
  if (canonical !== null && (canonical.hash !== result.block.hash || canonical.number !== result.block.number || canonical.timestampRaw !== result.block.timestampRaw)) conflict('block.final', 'CANONICAL_BLOCK_CONFLICT');
  if (finalChain !== null && finalChain !== BigInt(SEPOLIA_CHAIN_ID)) conflict('chain.final', 'CHAIN_ID_CONFLICT');
  const stateReads = result.observations.filter(o => !o.key.startsWith('quoter.') && (o.method === 'eth_call' || o.method === 'eth_getCode'));
  result.historicalRpc.hashBoundState = stateReads.length === 13 && stateReads.every(o => !o.error) && canonical !== null && finalChain !== null && !rejected ? 'OBSERVED_AT_CAPTURE_BLOCK' : 'UNVERIFIED';
  return finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !['--json', '--help'].includes(arg))) {
    console.error('Usage: node --experimental-strip-types scripts/probe-sepolia-feasibility.mjs [--json|--help]'); process.exitCode = 1;
  } else if (args[0] === '--help') {
    console.log('Read-only Sepolia candidate probe. Set AFTERCHECK_RPC_URL or use the public Tenderly default. --json emits sanitized research observations. No wallet actions or financial-verification verdicts.');
  } else {
    try {
      const client = new RpcClient(process.env.AFTERCHECK_RPC_URL ?? 'https://sepolia.gateway.tenderly.co');
      const result = await probeSepoliaFeasibility(client);
      if (args[0] === '--json') console.log(JSON.stringify(result, null, 2));
      else console.log(`Candidate: ${result.candidateStatus}\nExperiment readiness: ${result.readiness}\nBlock: ${result.block?.number ?? 'UNAVAILABLE'} ${result.block?.hash ?? ''}\nDeployment: ${result.deployment.status}\nPool: ${result.pool.status}\nLiquidity: ${result.liquidity.status}\nQuote: ${result.quote.status}${result.quote.amountOutRaw ? ' / output raw ' + result.quote.amountOutRaw : ''}\nHash-bound reads: ${result.historicalRpc.hashBoundState}\nCalls: ${result.requestCount}\n${result.errors.map(e => `${e.stage}: ${e.code}`).join('\n')}\n${result.unresolved.join('\n')}`);
      process.exitCode = result.candidateStatus === 'OBSERVED' ? 0 : 2;
    } catch (error) { console.error(`Probe failed: ${errorCode(error)}`); process.exitCode = 1; }
  }
}
