import test from 'node:test';
import assert from 'node:assert/strict';
import {RpcClient, RpcError} from '../src/rpc.ts';
import {probeSepoliaFeasibility, HISTORICAL_CANDIDATE, SEPOLIA_QUOTER_V2} from '../scripts/probe-sepolia-feasibility.mjs';

// Every response below is SYNTHETIC. Invented block identities and bytecode test
// the read-only research tool; none establishes live liquidity or real execution.
const ROUTER = '0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e';
const FACTORY = '0x0227628f3f023bb0b980b67d528571c95c6dac1c';
const c = HISTORICAL_CANDIDATE;
const HASH = '0x' + '1'.repeat(64);
const BLOCK = {hash: HASH, number: '0x1234', timestamp: '0x65000000'};
const abiWord = value => {
  const n = BigInt(value);
  return (n < 0n ? (1n << 256n) + n : n).toString(16).padStart(64, '0');
};
const addressResult = value => '0x' + value.slice(2).padStart(64, '0');
const slotResult = values => '0x' + values.map(abiWord).join('');
const SLOT = [1n << 96n, 0n, 0n, 1n, 1n, 0n, 1n];
const LIQUIDITY = '79228162514264337593543950459';
const OUTPUT = '999000000000000123';

function syntheticReader(mutate = () => undefined) {
  const calls = [];
  return {calls, async call(method, params) {
    calls.push({method, params});
    let key, result;
    if (method === 'eth_chainId') { key = calls.length === 1 ? 'chain.initial' : 'chain.final'; result = '0xaa36a7'; }
    else if (method === 'eth_getBlockByNumber') { key = params[0] === 'latest' ? 'block.initial' : 'block.final'; result = BLOCK; }
    else if (method === 'eth_getCode') {
      key = Object.entries({router: ROUTER, factory: FACTORY, tokenIn: c.tokenIn, tokenOut: c.tokenOut, pool: c.pool, quoter: SEPOLIA_QUOTER_V2}).find(([, target]) => target === params[0])?.[0] + '.code';
      result = '0x6000';
    } else if (method === 'eth_call') {
      const {to, data} = params[0];
      if (to === ROUTER && data === '0xc45a0155') { key = 'router.factory'; result = addressResult(FACTORY); }
      else if (to === FACTORY && data.startsWith('0x1698ee82')) { key = 'factory.pool'; result = addressResult(c.pool); }
      else if (to === SEPOLIA_QUOTER_V2 && data === '0xc45a0155') { key = 'quoter.factory'; result = addressResult(FACTORY); }
      else if (to === SEPOLIA_QUOTER_V2 && data.startsWith('0xc6a5026a')) {
        key = 'quoter.quote'; result = slotResult([OUTPUT, 1n << 96n, 0n, 60001n]);
      } else if (to === c.pool) {
        const map = {
          '0xc45a0155': ['pool.factory', addressResult(FACTORY)],
          '0x0dfe1681': ['pool.token0', addressResult(c.tokenIn)],
          '0xd21220a7': ['pool.token1', addressResult(c.tokenOut)],
          '0xddca3f43': ['pool.fee', '0x' + abiWord(500)],
          '0x1a686502': ['pool.liquidity', '0x' + abiWord(LIQUIDITY)],
          '0x3850c7bd': ['pool.slot0', slotResult(SLOT)]
        };
        [key, result] = map[data] ?? [];
      }
    }
    assert.ok(key, 'Unexpected method or calldata in synthetic transport');
    const changed = mutate({key, method, params, result, calls});
    return structuredClone(changed === undefined ? result : changed);
  }};
}

test('synthetic: exact deployment, metadata, bigint liquidity, and QuoterV2 ABI remain research observations', async () => {
  const reader = syntheticReader(), result = await probeSepoliaFeasibility(reader);
  assert.equal(result.candidateStatus, 'OBSERVED');
  assert.equal(result.deployment.status, 'OBSERVED_MATCH');
  assert.equal(result.pool.status, 'OBSERVED_MATCH');
  assert.equal(result.pool.factorySelectedPool, c.pool);
  assert.equal(result.liquidity.activeRaw, LIQUIDITY);
  assert.equal(result.quote.amountOutRaw, OUTPUT);
  assert.equal(result.quote.swapGasEstimateRaw, '60001');
  assert.equal(result.quote.status, 'QUOTED');
  assert.equal(result.readiness, 'NOT_ESTABLISHED');
  assert.equal(result.tokenAccess.status, 'UNVERIFIED');
  assert.equal(result.walletFunding.status, 'UNVERIFIED');
  assert.equal(result.historicalRpc.hashBoundState, 'OBSERVED_AT_CAPTURE_BLOCK');
  assert.equal(result.historicalRpc.fullCollectorPath, 'NOT_TESTED');
  assert.equal(result.requestCount, 20);
  assert.equal(reader.calls.length, 20);
  assert.deepEqual(result.errors, []);
  const quote = reader.calls.find(x => x.method === 'eth_call' && x.params[0].data.startsWith('0xc6a5026a'));
  assert.equal(quote.params[0].data, '0xc6a5026a' + c.tokenIn.slice(2).padStart(64, '0') + c.tokenOut.slice(2).padStart(64, '0') + abiWord('1000000000000000000') + abiWord(500) + abiWord(0));
  const code = result.observations.find(x => x.key === 'router.code').result;
  assert.equal(code.bytes, 2); assert.match(code.sha256, /^[0-9a-f]{64}$/);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('synthetic: wrong chain stops before any contract observation', async () => {
  const reader = syntheticReader(({key}) => key === 'chain.initial' ? '0x1' : undefined);
  const result = await probeSepoliaFeasibility(reader);
  assert.equal(result.candidateStatus, 'REJECTED');
  assert.deepEqual(result.errors, [{stage: 'chain.initial', code: 'CHAIN_ID_CONFLICT'}]);
  assert.equal(reader.calls.length, 1);
});

test('synthetic: empty required code never establishes a compatible candidate', async () => {
  for (const key of ['router.code', 'factory.code', 'tokenIn.code', 'tokenOut.code', 'pool.code', 'quoter.code']) {
    const result = await probeSepoliaFeasibility(syntheticReader(x => x.key === key ? '0x' : undefined));
    assert.equal(result.candidateStatus, 'REJECTED', key);
    assert.ok(result.errors.some(e => e.stage === key && e.code === 'EMPTY_CONTRACT_CODE'));
    assert.equal(result.readiness, 'NOT_ESTABLISHED');
  }
});

test('synthetic: zero factory pool is rejected and no pool or quote is queried', async () => {
  const reader = syntheticReader(({key}) => key === 'factory.pool' ? '0x' + '0'.repeat(64) : undefined);
  const result = await probeSepoliaFeasibility(reader);
  assert.equal(result.candidateStatus, 'REJECTED');
  assert.ok(result.errors.some(e => e.code === 'POOL_NOT_FOUND'));
  assert.ok(!result.observations.some(o => o.key.startsWith('pool.') || o.key.startsWith('quoter.')));
});

test('synthetic: inconsistent factory-selected pool or metadata never establishes support', async () => {
  for (const [key, value] of [['factory.pool', addressResult(ROUTER)], ['router.factory', addressResult(ROUTER)],
    ['pool.factory', addressResult(ROUTER)], ['pool.token0', addressResult(c.tokenOut)],
    ['pool.token1', addressResult(c.tokenIn)], ['pool.fee', '0x' + abiWord(3000)], ['quoter.factory', addressResult(ROUTER)]]) {
    const result = await probeSepoliaFeasibility(syntheticReader(x => x.key === key ? value : undefined));
    assert.equal(result.candidateStatus, 'REJECTED', key);
    assert.equal(result.historicalRpc.hashBoundState, 'UNVERIFIED');
  }
});

test('synthetic: unavailable liquidity stays incomplete even if a quote returns', async () => {
  const result = await probeSepoliaFeasibility(syntheticReader(({key}) => {
    if (key === 'pool.liquidity') throw new RpcError('RPC_REMOTE_ERROR');
  }));
  assert.equal(result.candidateStatus, 'INCOMPLETE');
  assert.equal(result.liquidity.status, 'UNVERIFIED');
  assert.equal(result.quote.status, 'QUOTED');
  assert.equal(result.historicalRpc.hashBoundState, 'UNVERIFIED');
});

test('synthetic: zero active liquidity is an observation, not proof that every possible trade is impossible', async () => {
  const result = await probeSepoliaFeasibility(syntheticReader(({key}) => key === 'pool.liquidity' ? '0x' + abiWord(0) : undefined));
  assert.equal(result.liquidity.status, 'ZERO_ACTIVE_LIQUIDITY');
  assert.equal(result.readiness, 'NOT_ESTABLISHED');
  assert.equal(result.quote.status, 'QUOTED');
});

test('synthetic: malformed RPC values and noncanonical ABI fields fail closed without retaining provider text', async () => {
  for (const [key, value] of [['chain.initial', '0x00'], ['block.initial', {...BLOCK, hash: 'secret-provider-text'}],
    ['router.code', 'secret-provider-text'], ['pool.fee', '0x' + abiWord(1n << 24n)],
    ['pool.liquidity', '0x' + abiWord(1n << 128n)], ['pool.token0', '0x' + abiWord(1n << 160n)],
    ['pool.slot0', slotResult([1n << 96n, 1n << 24n, 0n, 1n, 1n, 0n, 1n])],
    ['pool.slot0', slotResult([1n << 96n, 0n, 0n, 1n, 1n, 0n, 2n])],
    ['quoter.quote', slotResult([OUTPUT, 1n << 160n, 0n, 1n])], ['quoter.quote', '0x']]) {
    const result = await probeSepoliaFeasibility(syntheticReader(x => x.key === key ? value : undefined));
    assert.equal(result.candidateStatus, 'INCOMPLETE', key);
    assert.ok(result.errors.some(e => e.stage === key && e.code === 'MALFORMED_RESULT'), key);
    assert.doesNotMatch(JSON.stringify(result), /secret-provider-text/);
  }
});

test('synthetic: plain errors and invented RPC error codes are sanitized', async () => {
  for (const error of [new Error('https://secret.invalid/PRIVATE_TOKEN'), new RpcError('PRIVATE_TOKEN'), new RpcError('RPC_REMOTE_ERROR')]) {
    const result = await probeSepoliaFeasibility(syntheticReader(({key}) => { if (key === 'router.code') throw error; }));
    assert.equal(result.candidateStatus, 'INCOMPLETE');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN|secret.invalid/);
    assert.ok(result.errors.some(e => ['RPC_READ_FAILED', 'RPC_REMOTE_ERROR'].includes(e.code)));
  }
});

test('synthetic: zero or out-of-range quoted price cannot establish a positive quote', async () => {
  for (const price of [0n, 4295128738n, 1461446703485210103287273052203988822378723970342n]) {
    const result = await probeSepoliaFeasibility(syntheticReader(({key}) =>
      key === 'quoter.quote' ? slotResult([OUTPUT, price, 0n, 60001n]) : undefined));
    assert.equal(result.candidateStatus, 'INCOMPLETE');
    assert.equal(result.quote.status, 'UNVERIFIED');
    assert.equal(result.quote.amountOutRaw, undefined);
    assert.ok(result.errors.some(e => e.stage === 'quoter.quote' && e.code === 'MALFORMED_RESULT'));
  }
});

test('synthetic: actual bounded RpcClient sanitizes malformed envelopes and provider failures', async () => {
  for (const body of ['{"jsonrpc":"2.0","id":999,"result":"0xaa36a7"}',
    '{"jsonrpc":"2.0","id":1,"error":{"message":"PRIVATE_TOKEN"}}', 'PRIVATE_TOKEN']) {
    const client = new RpcClient('https://rpc.example.invalid/PRIVATE_TOKEN', {fetchImpl: async () => new Response(body)});
    const result = await probeSepoliaFeasibility(client);
    assert.equal(result.candidateStatus, 'INCOMPLETE');
    assert.equal(result.requestCount, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN|example.invalid/);
  }
});

test('synthetic: only read methods, two-parameter EIP-1898 calls, and no state overrides are emitted', async () => {
  const reader = syntheticReader(); await probeSepoliaFeasibility(reader);
  const allowed = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_call', 'eth_getCode']);
  assert.ok(reader.calls.every(call => allowed.has(call.method)));
  for (const call of reader.calls.filter(x => ['eth_call', 'eth_getCode'].includes(x.method))) {
    assert.equal(call.params.length, 2);
    assert.deepEqual(call.params[1], {blockHash: HASH, requireCanonical: true});
    if (call.method === 'eth_call') assert.deepEqual(Object.keys(call.params[0]).sort(), ['data', 'to']);
  }
  assert.ok(reader.calls.length <= 32);
});

test('synthetic: changed canonical block or final chain invalidates the observation batch', async () => {
  for (const [key, value] of [['block.final', {...BLOCK, hash: '0x' + '2'.repeat(64)}],
    ['block.final', {...BLOCK, number: '0x1235'}], ['chain.final', '0x1']]) {
    const result = await probeSepoliaFeasibility(syntheticReader(x => x.key === key ? value : undefined));
    assert.equal(result.candidateStatus, 'REJECTED');
    assert.equal(result.historicalRpc.hashBoundState, 'UNVERIFIED');
    assert.equal(result.readiness, 'NOT_ESTABLISHED');
  }
});

test('synthetic: an unavailable final check cannot inherit earlier successful observations', async () => {
  for (const stage of ['block.final', 'chain.final', 'quoter.quote']) {
    const result = await probeSepoliaFeasibility(syntheticReader(({key}) => { if (key === stage) throw new RpcError('RPC_TIMEOUT'); }));
    assert.equal(result.candidateStatus, 'INCOMPLETE');
    if (stage !== 'quoter.quote') assert.equal(result.historicalRpc.hashBoundState, 'UNVERIFIED');
    if (stage === 'quoter.quote') assert.equal(result.quote.status, 'UNVERIFIED');
  }
});

test('synthetic: unsigned exact input is bounded and cannot carry arbitrary calls or endpoints', async () => {
  for (const candidate of [{...c, amountInRaw: '0'}, {...c, amountInRaw: (1n << 255n).toString()},
    {...c, amountInRaw: 1}, {...c, amountInRaw: '1e18'}, {...c, fee: 1_000_000}, {...c, tokenOut: c.tokenIn},
    {...c, rpc: 'https://secret.invalid'}, {...c, calldata: '0x'}]) {
    const reader = syntheticReader();
    await assert.rejects(probeSepoliaFeasibility(reader, {candidate}));
    assert.equal(reader.calls.length, 0);
  }
  const reader = syntheticReader();
  await probeSepoliaFeasibility(reader, {candidate: {...c, amountInRaw: '1000000'}});
  const quote = reader.calls.find(x => x.method === 'eth_call' && x.params[0].data.startsWith('0xc6a5026a'));
  assert.equal(quote.params[0].data.slice(10 + 2 * 64, 10 + 3 * 64), abiWord(1000000));
});

test('synthetic: independent state reads overlap while final checks wait for quote completion', async () => {
  const underlying = syntheticReader(); let active = 0, maximum = 0, quoteDone = false;
  const client = {async call(method, params) {
    if (method === 'eth_getBlockByNumber' && params[0] !== 'latest') assert.equal(quoteDone, true);
    if (method === 'eth_getCode' || method === 'eth_call') {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
    }
    const result = await underlying.call(method, params);
    if (method === 'eth_call' && params[0].data.startsWith('0xc6a5026a')) quoteDone = true;
    return result;
  }};
  const result = await probeSepoliaFeasibility(client);
  assert.equal(result.candidateStatus, 'OBSERVED'); assert.ok(maximum > 1);
});
