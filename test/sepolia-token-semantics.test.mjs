import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {RpcError} from '../src/rpc.ts';
import {sealEvidence} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {TokenResearchRpcClient, probeSepoliaTokenSemantics, assessSelectedReceipt,
  TOKENS, SLOTS, RUNTIME_SHA256} from '../scripts/check-sepolia-token-semantics.mjs';
import {rpcFixture, calldata, observation, approvalLog, uint, aw, addressResult,
  router, factory, owner, recipient, blockHash, otherHash} from './helpers/uniswap-fixture.mjs';

// All RPC responses, block identities and receipts constructed below are SYNTHETIC.
// Retained public runtime bytes exercise the comparison logic; putting those bytes
// into a mock does not authenticate a blockchain observation or executed swap.
// The final test is separately labeled offline replay of retained real evidence.
const manifest = JSON.parse(readFileSync(new URL('../docs/evidence/sepolia-token-semantics.json', import.meta.url), 'utf8'));
const runtimes = manifest.authenticatedRuntimeBytes;
const BLOCK = {hash: blockHash, number: '0x1234', timestamp: '0x65000000'};
const CONTEXT = {blockHash, requireCanonical: true};
const ADMIN = '0xcccccccccccccccccccccccccccccccccccccccc';
const FOREIGN = '0xdddddddddddddddddddddddddddddddddddddddd';
const word = value => '0x' + uint(value);

function syntheticReader(mutate = () => undefined) {
  const calls = []; let chainReads = 0, blockReads = 0;
  return {calls, async call(method, params) {
    calls.push({method, params});
    let key, result;
    if (method === 'eth_chainId') { key = ++chainReads === 1 ? 'chain.initial' : 'chain.final'; result = '0xaa36a7'; }
    else if (method === 'eth_getBlockByNumber') { key = ++blockReads === 1 ? 'block.initial' : 'block.final'; result = BLOCK; }
    else if (method === 'eth_getCode') {
      const name = {[TOKENS.usdc]: 'usdcProxy', [TOKENS.implementation]: 'usdcImplementation', [TOKENS.weth]: 'weth'}[params[0]];
      key = name && name + '.code'; result = runtimes[name];
    } else if (method === 'eth_getStorageAt' && params[0] === TOKENS.usdc) {
      [key, result] = {
        [SLOTS.implementation]: ['proxy.implementationSlot', addressResult(TOKENS.implementation)],
        [SLOTS.admin]: ['proxy.adminSlot', addressResult(ADMIN)]
      }[params[1]] ?? [];
    } else if (method === 'eth_call') {
      const {to, data} = params[0];
      if (to === TOKENS.weth && data === '0x313ce567') { key = 'weth.decimals'; result = word(18); }
      else if (to === TOKENS.usdc) {
        [key, result] = {
          '0x5c60da1b': ['proxy.implementation', addressResult(TOKENS.implementation)],
          '0xf851a440': ['proxy.admin', addressResult(ADMIN)],
          '0x5c975abb': ['usdc.paused', word(0)],
          '0x313ce567': ['usdc.decimals', word(6)],
          '0x8da5cb5b': ['usdc.owner', addressResult(ADMIN)],
          '0x9fd0506d': ['usdc.pauser', addressResult(ADMIN)],
          '0xbd102430': ['usdc.blacklister', addressResult(ADMIN)],
          '0x35d99f35': ['usdc.masterMinter', addressResult(ADMIN)],
          ['0xfe575a87' + aw(router)]: ['usdc.routerBlacklisted', word(0)],
          ['0xfe575a87' + aw(TOKENS.pool)]: ['usdc.poolBlacklisted', word(0)]
        }[data] ?? [];
      }
    }
    assert.ok(key, 'Unexpected request in synthetic token reader');
    const changed = mutate({key, method, params, result, calls});
    return structuredClone(changed === undefined ? result : changed);
  }};
}

function selectedFixture({amountIn = 1000000n, amountOut = 37929811014366n, minimum = 300n} = {}) {
  const e = rpcFixture({amountIn, amountOut});
  e.transaction.input = calldata({tokenIn: TOKENS.usdc, tokenOut: TOKENS.weth, fee: 500, amountIn, minimum});
  observation(e, 'tokenIn.code').params[0] = TOKENS.usdc;
  observation(e, 'tokenOut.code').params[0] = TOKENS.weth;
  observation(e, 'factory.pool').params[0].data = '0x1698ee82' + aw(TOKENS.usdc) + aw(TOKENS.weth) + uint(500);
  observation(e, 'factory.pool').result = addressResult(TOKENS.pool);
  observation(e, 'pool.code').params[0] = TOKENS.pool;
  for (const key of ['pool.factory', 'pool.token0', 'pool.token1', 'pool.fee']) observation(e, key).params[0].to = TOKENS.pool;
  observation(e, 'pool.token0').result = addressResult(TOKENS.usdc);
  observation(e, 'pool.token1').result = addressResult(TOKENS.weth);
  observation(e, 'pool.fee').result = word(500);
  e.receipt.logs[0].address = TOKENS.weth; e.receipt.logs[0].topics[1] = addressResult(TOKENS.pool);
  e.receipt.logs[1].address = TOKENS.usdc; e.receipt.logs[1].topics[2] = addressResult(TOKENS.pool);
  e.receipt.logs[2].address = TOKENS.pool;
  return e;
}

const assess = (mutate, options) => {
  const e = selectedFixture(options); mutate?.(e);
  return assessSelectedReceipt(sealEvidence(e));
};
const remainsUnknown = result => {
  assert.equal(result.status, 'UNKNOWN'); assert.equal(result.amounts, null);
  assert.equal(result.immediateBalances, 'UNKNOWN');
};
const syntheticFetch = reader => async (_url, init) => {
  const request = JSON.parse(init.body);
  assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
  return Response.json({jsonrpc: '2.0', id: request.id, result: await reader.call(request.method, request.params)});
};

test('synthetic token probe: exact runtime and proxy bindings remain bounded block-end research', async () => {
  const reader = syntheticReader();
  const result = await probeSepoliaTokenSemantics(reader);
  assert.equal(result.status, 'OBSERVED'); assert.equal(result.chainId, 11155111);
  assert.equal(result.implementationIdentity, 'MATCHED_AUTHENTICATED_RUNTIMES');
  assert.equal(result.transferConfiguration, 'CLEAR_FOR_OBSERVED_FIXED_CONTRACTS');
  assert.equal(result.proxy.implementation, TOKENS.implementation);
  assert.equal(result.proxy.implementationSlot, TOKENS.implementation);
  assert.equal(result.proxy.admin, ADMIN); assert.equal(result.proxy.adminSlot, ADMIN);
  assert.equal(result.configuration.usdcDecimals, '6'); assert.equal(result.configuration.wethDecimals, '18');
  for (const [key, raw] of Object.entries(runtimes)) {
    assert.equal(result.runtimeHashes[key].sha256, RUNTIME_SHA256[key]);
    assert.equal(createHash('sha256').update(Buffer.from(raw.slice(2), 'hex')).digest('hex'), RUNTIME_SHA256[key]);
  }
  assert.equal(result.receiptCompatibility, 'NOT_TESTED_BY_STATE_PROBE');
  assert.equal(result.immediateBalances, 'UNKNOWN'); assert.equal(result.readiness, 'NOT_ESTABLISHED');
  assert.deepEqual(result.errors, []); assert.equal(result.requestCount, 20); assert.equal(reader.calls.length, 20);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('synthetic token probe: wrong chain stops before reading contracts', async () => {
  const reader = syntheticReader(({key}) => key === 'chain.initial' ? '0x1' : undefined);
  const result = await probeSepoliaTokenSemantics(reader);
  assert.equal(result.status, 'REJECTED'); assert.equal(result.implementationIdentity, 'UNKNOWN');
  assert.deepEqual(result.errors, [{stage: 'chain.initial', code: 'CHAIN_ID_CONFLICT'}]);
  assert.equal(reader.calls.length, 1);
});

test('synthetic token probe: explicitly requested block must match and invalid quantities make no requests', async () => {
  assert.equal((await probeSepoliaTokenSemantics(syntheticReader(), {blockNumber: BLOCK.number})).status, 'OBSERVED');
  const reader = syntheticReader();
  const result = await probeSepoliaTokenSemantics(reader, {blockNumber: '0x1235'});
  assert.equal(result.status, 'REJECTED'); assert.equal(reader.calls.length, 2);
  assert.ok(result.errors.some(e => e.code === 'BLOCK_NUMBER_CONFLICT'));
  for (const blockNumber of ['0x00', 'earliest', 1234, 'PRIVATE_TOKEN']) {
    const client = syntheticReader();
    await assert.rejects(probeSepoliaTokenSemantics(client, {blockNumber}));
    assert.equal(client.calls.length, 0);
  }
});

test('synthetic token probe: empty or altered runtime never authenticates a token', async () => {
  for (const key of ['usdcProxy.code', 'usdcImplementation.code', 'weth.code']) {
    for (const [value, expected] of [['0x', 'EMPTY_CONTRACT_CODE'], ['0x6000', 'RUNTIME_IDENTITY_CONFLICT']]) {
      const result = await probeSepoliaTokenSemantics(syntheticReader(x => x.key === key ? value : undefined));
      assert.equal(result.status, 'REJECTED', key); assert.equal(result.implementationIdentity, 'UNKNOWN');
      assert.equal(result.transferConfiguration, 'UNKNOWN');
      assert.ok(result.errors.some(e => e.stage === key && e.code === expected));
    }
  }
});

test('synthetic token probe: malformed implementation slots fail closed without retaining raw provider text', async () => {
  for (const value of ['0x01', word(1n << 160n), addressResult(TOKENS.implementation) + '00', 'PRIVATE_TOKEN']) {
    const reader = syntheticReader(({key}) => key === 'proxy.implementationSlot' ? value : undefined);
    const result = await probeSepoliaTokenSemantics(reader);
    assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.implementationIdentity, 'UNKNOWN');
    assert.ok(result.errors.some(e => e.stage === 'proxy.implementationSlot' && e.code === 'MALFORMED_RESULT'));
    assert.ok(!reader.calls.some(c => c.method === 'eth_getCode' && c.params[0] === TOKENS.implementation));
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN/);
  }
});

test('synthetic token probe: an unexpected implementation is rejected and never followed', async () => {
  const reader = syntheticReader(({key}) => ['proxy.implementation', 'proxy.implementationSlot'].includes(key) ? addressResult(FOREIGN) : undefined);
  const result = await probeSepoliaTokenSemantics(reader);
  assert.equal(result.status, 'REJECTED'); assert.equal(result.implementationIdentity, 'UNKNOWN');
  assert.ok(result.errors.some(e => e.code === 'UNEXPECTED_IMPLEMENTATION'));
  assert.ok(reader.calls.filter(c => c.method === 'eth_getCode').every(c => [TOKENS.usdc, TOKENS.weth].includes(c.params[0])));
});

test('synthetic token probe: getter/storage contradictions invalidate implementation or admin identity', async () => {
  for (const [key, code] of [['proxy.implementation', 'IMPLEMENTATION_IDENTITY_CONFLICT'],
    ['proxy.implementationSlot', 'IMPLEMENTATION_IDENTITY_CONFLICT'], ['proxy.adminSlot', 'ADMIN_IDENTITY_CONFLICT']]) {
    const result = await probeSepoliaTokenSemantics(syntheticReader(x => x.key === key ? addressResult(FOREIGN) : undefined));
    assert.equal(result.status, 'REJECTED'); assert.equal(result.implementationIdentity, 'UNKNOWN');
    assert.ok(result.errors.some(e => e.code === code));
  }
});

test('synthetic token probe: malformed ABI booleans, metadata and role addresses stay incomplete', async () => {
  for (const [key, value] of [['usdc.paused', word(2)], ['usdc.routerBlacklisted', '0x'],
    ['usdc.decimals', word(256)], ['weth.decimals', word(18) + '00'],
    ['usdc.owner', word(1n << 160n)], ['proxy.admin', 'PRIVATE_TOKEN'], ['weth.code', '0x0']]) {
    const result = await probeSepoliaTokenSemantics(syntheticReader(x => x.key === key ? value : undefined));
    assert.equal(result.status, 'INCOMPLETE', key); assert.equal(result.implementationIdentity, 'UNKNOWN');
    assert.ok(result.errors.some(e => e.stage === key && e.code === 'MALFORMED_RESULT'));
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN/);
  }
});

test('synthetic token probe: pause, blacklist or contradictory decimals prevent a clear configuration', async () => {
  for (const [key, value] of [['usdc.paused', word(1)], ['usdc.routerBlacklisted', word(1)],
    ['usdc.poolBlacklisted', word(1)], ['usdc.decimals', word(18)], ['weth.decimals', word(6)]]) {
    const result = await probeSepoliaTokenSemantics(syntheticReader(x => x.key === key ? value : undefined));
    assert.equal(result.status, 'REJECTED', key); assert.equal(result.transferConfiguration, 'UNKNOWN');
    assert.equal(result.readiness, 'NOT_ESTABLISHED');
  }
});

test('synthetic token probe: final canonical block and chain must still match', async () => {
  for (const [key, value] of [['block.final', {...BLOCK, hash: otherHash}], ['block.final', {...BLOCK, number: '0x1235'}],
    ['block.final', {...BLOCK, timestamp: '0x65000001'}], ['chain.final', '0x1']]) {
    const result = await probeSepoliaTokenSemantics(syntheticReader(x => x.key === key ? value : undefined));
    assert.equal(result.status, 'REJECTED'); assert.equal(result.implementationIdentity, 'UNKNOWN');
  }
});

test('synthetic token probe: missing final observations cannot inherit earlier successful identity checks', async () => {
  for (const stage of ['block.final', 'chain.final', 'usdcImplementation.code']) {
    const result = await probeSepoliaTokenSemantics(syntheticReader(({key}) => {if (key === stage) throw new RpcError('RPC_TIMEOUT');}));
    assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.implementationIdentity, 'UNKNOWN');
    assert.ok(result.errors.some(e => e.stage === stage && e.code === 'RPC_TIMEOUT'));
  }
});

test('synthetic token probe: arbitrary exceptions and invented RPC error codes are sanitized', async () => {
  for (const error of [new Error('https://secret.invalid/PRIVATE_TOKEN'), new RpcError('PRIVATE_TOKEN'), new RpcError('RPC_REMOTE_ERROR')]) {
    const result = await probeSepoliaTokenSemantics(syntheticReader(({key}) => {if (key === 'usdc.paused') throw error;}));
    assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.transferConfiguration, 'UNKNOWN');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN|secret.invalid/);
    assert.ok(result.errors.some(e => ['RPC_READ_FAILED', 'RPC_REMOTE_ERROR'].includes(e.code)));
  }
});

test('synthetic transport: a full probe uses only fixed targets and canonical hash-bound reads', async () => {
  const reader = syntheticReader();
  const result = await probeSepoliaTokenSemantics(new TokenResearchRpcClient('https://example.invalid', {fetchImpl: syntheticFetch(reader)}));
  assert.equal(result.status, 'OBSERVED'); assert.equal(reader.calls.length, 20);
  for (const c of reader.calls) {
    assert.ok(['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(c.method));
    if (c.method === 'eth_getCode' || c.method === 'eth_call') assert.deepEqual(c.params[1], CONTEXT);
    if (c.method === 'eth_getStorageAt') assert.deepEqual(c.params, [TOKENS.usdc, c.params[1], CONTEXT]);
    if (c.method === 'eth_call') assert.deepEqual(Object.keys(c.params[0]).sort(), ['data', 'to']);
  }
});

test('synthetic transport: signing, broadcasting and unrelated RPC methods never reach fetch', async () => {
  let sent = 0;
  const client = new TokenResearchRpcClient('https://example.invalid', {fetchImpl: async () => {sent++; throw new Error();}});
  for (const method of ['eth_sendTransaction', 'eth_sendRawTransaction', 'personal_sign', 'eth_sign',
    'eth_signTypedData_v4', 'wallet_sendCalls', 'eth_estimateGas', 'debug_traceCall', 'eth_getLogs']) {
    await assert.rejects(client.call(method, []), {code: 'RPC_METHOD_NOT_ALLOWED'});
  }
  assert.equal(sent, 0);
});

test('synthetic transport: arbitrary targets, token approvals, state overrides and unpinned reads are rejected', async () => {
  let sent = 0;
  const client = new TokenResearchRpcClient('https://example.invalid', {fetchImpl: async () => {sent++; throw new Error();}});
  const calls = [
    ['eth_getCode', [FOREIGN, CONTEXT]], ['eth_getStorageAt', [TOKENS.implementation, SLOTS.implementation, CONTEXT]],
    ['eth_getStorageAt', [TOKENS.usdc, '0x0', CONTEXT]], ['eth_call', [{to: FOREIGN, data: '0x313ce567'}, CONTEXT]],
    ['eth_call', [{to: TOKENS.usdc, data: '0x095ea7b3' + aw(router) + uint(1)}, CONTEXT]],
    ['eth_call', [{to: TOKENS.usdc, data: '0xa9059cbb' + aw(owner) + uint(1)}, CONTEXT]],
    ['eth_call', [{to: TOKENS.usdc, data: '0x313ce567', from: owner}, CONTEXT]],
    ['eth_call', [{to: TOKENS.usdc, data: '0x313ce567', value: '0x0'}, CONTEXT]],
    ['eth_call', [{to: TOKENS.usdc, data: '0x313ce567'}, CONTEXT, {}]],
    ['eth_getBlockByNumber', ['latest', true]], ['eth_chainId', ['unexpected']]
  ];
  for (const ctx of ['latest', '0x1234', {blockHash}, {blockHash, requireCanonical: false}, {...CONTEXT, extra: true}]) {
    calls.push(['eth_getCode', [TOKENS.usdc, ctx]], ['eth_getStorageAt', [TOKENS.usdc, SLOTS.admin, ctx]]);
  }
  for (const [method, params] of calls) await assert.rejects(client.call(method, params), {code: 'RPC_REQUEST_NOT_ALLOWED'});
  assert.equal(sent, 0);
});

test('synthetic transport: malformed envelopes and HTTP/transport errors expose only safe codes', async () => {
  const failures = [
    async () => new Response('PRIVATE_TOKEN', {status: 403}),
    async () => new Response('PRIVATE_TOKEN'),
    async () => Response.json({jsonrpc: '2.0', id: 1, error: {message: 'PRIVATE_TOKEN'}}),
    async () => Response.json({jsonrpc: '2.0', id: 99, result: '0xaa36a7'}),
    async () => Response.json({jsonrpc: '2.0', id: 1}),
    async () => {throw new Error('https://secret.invalid/PRIVATE_TOKEN');},
    async () => {throw new RpcError('PRIVATE_TOKEN');}
  ];
  for (const fetchImpl of failures) {
    const result = await probeSepoliaTokenSemantics(new TokenResearchRpcClient('https://example.invalid/PRIVATE_TOKEN', {fetchImpl}));
    assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.requestCount, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN|secret.invalid|example.invalid/);
  }
});

test('synthetic transport: both declared and streamed response sizes are bounded', async () => {
  for (const fetchImpl of [async () => new Response('short', {headers: {'content-length': '999'}}),
    async () => new Response('x'.repeat(1000))]) {
    const client = new TokenResearchRpcClient('https://example.invalid', {fetchImpl, maxResponseBytes: 64});
    await assert.rejects(client.call('eth_chainId', []), {code: 'RPC_RESPONSE_TOO_LARGE'});
  }
});

test('synthetic transport: request count and timeout are enforced without a live network', async () => {
  let sent = 0;
  const client = new TokenResearchRpcClient('https://example.invalid', {fetchImpl: async (_url, init) => {
    sent++; return Response.json({jsonrpc: '2.0', id: JSON.parse(init.body).id, result: '0xaa36a7'});
  }});
  for (let i = 0; i < 32; i++) assert.equal(await client.call('eth_chainId', []), '0xaa36a7');
  await assert.rejects(client.call('eth_chainId', []), {code: 'RPC_BUDGET_EXHAUSTED'}); assert.equal(sent, 32);
  const timeout = new TokenResearchRpcClient('https://example.invalid', {timeoutMs: 10,
    fetchImpl: async (_url, {signal}) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('PRIVATE_TOKEN')), {once: true}))});
  await assert.rejects(timeout.call('eth_chainId', []), {code: 'RPC_TIMEOUT'});
});

test('synthetic transport: invalid endpoints and limits are rejected before network access', () => {
  for (const endpoint of ['not a URL', 'file:///secret', 'https://example.invalid/#PRIVATE_TOKEN', 'http://example.invalid']) {
    assert.throws(() => new TokenResearchRpcClient(endpoint), e => ['INVALID_RPC_URL', 'RPC_HTTPS_REQUIRED'].includes(e.code));
  }
  for (const key of ['timeoutMs', 'totalTimeoutMs', 'maxResponseBytes']) {
    for (const value of [0, -1, 1.5, NaN, Infinity, '100']) {
      assert.throws(() => new TokenResearchRpcClient('https://example.invalid', {[key]: value}), {code: 'INVALID_RPC_LIMIT'});
    }
  }
});

test('synthetic selected receipt: exact amounts above 2^53 retain their test-only classification', () => {
  const input = 90071992547409935n, output = 90071992547409931n;
  const result = assess(undefined, {amountIn: input, amountOut: output, minimum: output});
  assert.equal(result.status, 'SYNTHETIC_COMPATIBLE'); assert.equal(result.evidenceClass, 'SYNTHETIC_RPC_FIXTURE');
  assert.deepEqual(result.amounts, {inputRaw: input.toString(), outputRaw: output.toString()});
  assert.deepEqual(result.verifier, {execution: 'SUCCEEDED', support: 'SUPPORTED_TEST_PROFILE', coverage: 'COMPLETE', verdict: 'PASS'});
  assert.equal(result.policyMeaning, 'RETROSPECTIVE_ROUTE_COMPATIBILITY_ONLY'); assert.equal(result.immediateBalances, 'UNKNOWN');
});

test('synthetic selected receipt: a permitted input-token allowance event preserves receipt compatibility', () => {
  for (const beforeInput of [true, false]) {
    const result = assess(e => {
      const log = approvalLog(); log.address = TOKENS.usdc;
      if (beforeInput) {e.receipt.logs[1].logIndex = '0x19'; e.receipt.logs[2].logIndex = '0x1a'; e.receipt.logs.splice(1, 0, log);}
      else {log.logIndex = '0x19'; e.receipt.logs[2].logIndex = '0x1a'; e.receipt.logs.splice(2, 0, log);}
    });
    assert.equal(result.status, 'SYNTHETIC_COMPATIBLE'); assert.equal(result.amounts.inputRaw, '1000000');
  }
});

test('synthetic selected receipt: extra token events, swaps or WETH approvals are unsupported', () => {
  for (const mutate of [
    e => {const log = {...e.receipt.logs[0], logIndex: '0x20', topics: [otherHash]}; e.receipt.logs.push(log);},
    e => {e.receipt.logs.push({...structuredClone(e.receipt.logs[2]), logIndex: '0x20'});},
    e => {const log = approvalLog(); log.address = TOKENS.weth; log.logIndex = '0x20'; e.receipt.logs.push(log);}
  ]) {
    const result = assess(mutate); remainsUnknown(result); assert.equal(result.verifier.support, 'UNSUPPORTED');
  }
});

test('synthetic selected receipt: incorrect token participants or pool identities never become compatible', () => {
  for (const mutate of [
    e => {e.receipt.logs[0].topics[2] = addressResult(owner);},
    e => {e.receipt.logs[0].topics[1] = addressResult(router);},
    e => {e.receipt.logs[1].topics[1] = addressResult(recipient);},
    e => {e.receipt.logs[1].topics[2] = addressResult(router);},
    e => {e.receipt.logs[2].topics[1] = addressResult(owner);},
    e => {e.receipt.logs[2].topics[2] = addressResult(owner);},
    e => {e.receipt.logs[2].address = factory;}
  ]) remainsUnknown(assess(mutate));
});

test('synthetic selected receipt: one-unit Transfer discrepancies and router minimum contradictions fail closed', () => {
  const input = 90071992547409935n, output = 90071992547409931n;
  for (const [index, amount] of [[0, output - 1n], [1, input + 1n]]) {
    remainsUnknown(assess(e => {e.receipt.logs[index].data = word(amount);}, {amountIn: input, amountOut: output}));
  }
  remainsUnknown(assess(undefined, {amountIn: input, amountOut: output, minimum: output + 1n}));
});

test('synthetic selected receipt: incomplete historical collection and missing events remain UNKNOWN', () => {
  for (const mutate of [
    e => {e.receipt = null;}, e => {e.block = null;}, e => {e.state = [];}, e => {e.canonicalBlockHash = null;},
    e => {e.collectionErrors.push({stage: 'chainAfterState', code: 'RPC_TIMEOUT'});},
    ...[0, 1, 2].map(index => e => {e.receipt.logs.splice(index, 1);})
  ]) remainsUnknown(assess(mutate));
});

test('synthetic selected receipt: integrity, chain, block context and output-before-input order remain enforced', () => {
  const sealed = sealEvidence(selectedFixture()); sealed.receipt.logs[0].data = word(999);
  remainsUnknown(assessSelectedReceipt(sealed));
  for (const mutate of [
    e => {e.chainId = 1;}, e => {e.receipt.blockHash = otherHash;},
    e => {observation(e, 'pool.token0').params[1] = 'latest';},
    e => {[e.receipt.logs[0], e.receipt.logs[1]] = [e.receipt.logs[1], e.receipt.logs[0]];
      e.receipt.logs[0].logIndex = '0x17'; e.receipt.logs[1].logIndex = '0x18';}
  ]) remainsUnknown(assess(mutate));
});

test('synthetic selected receipt: other pairs and fees, wrapping, multicall and delegated senders cannot pass', () => {
  for (const overrides of [{tokenIn: TOKENS.weth, tokenOut: TOKENS.usdc}, {fee: 3000}]) {
    const result = assess(e => {e.transaction.input = calldata({tokenIn: TOKENS.usdc, tokenOut: TOKENS.weth, fee: 500, ...overrides});});
    assert.equal(result.status, 'UNSUPPORTED_PAIR'); assert.equal(result.amounts, null);
  }
  for (const mutate of [
    e => {e.transaction.value = '0x1';}, e => {e.transaction.input = '0xac9650d8' + e.transaction.input.slice(10);},
    e => {e.transaction.type = '0x4';}, e => {observation(e, 'sender.code').result = '0xef0100' + FOREIGN.slice(2);}
  ]) remainsUnknown(assess(mutate));
  for (const evidence of [null, {}, {transaction: {input: '0x'}}]) remainsUnknown(assessSelectedReceipt(evidence));
});

test('historical offline replay: retained third-party selected-pair receipt is compatible while reserves remain UNKNOWN', () => {
  const capture = manifest.historicalReplay;
  assert.equal(capture.evidenceEncoding, 'zlib+base64');
  const bytes = inflateSync(Buffer.from(capture.evidenceZlibBase64, 'base64'), {maxOutputLength: 1_000_000});
  assert.equal(bytes.length, capture.evidenceFileBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.evidenceFileSha256);
  const evidence = JSON.parse(bytes.toString('utf8'));
  assert.equal(evidence.evidenceClass, 'RPC_RECEIPT');
  assert.equal(evidence.digest, capture.evidenceDigest);
  assert.equal(evidence.transactionHash, '0x43507127d3dc456b9f04f8d303268ae908a3620f08c05a30265567f74e61468d');
  assert.equal(evidence.block.hash, '0xf6e12d492ab92cd27c63da5cb20dc61f21751825afe83324ead31eb9f8756d26');
  assert.equal(BigInt(evidence.block.number), 12070596n);
  assert.equal(evidence.state.length, 12); assert.deepEqual(evidence.collectionErrors, []);
  const result = assessSelectedReceipt(evidence);
  assert.equal(result.status, 'OBSERVED_COMPATIBLE'); assert.equal(result.evidenceClass, 'RPC_RECEIPT');
  assert.equal(result.blockHash, evidence.block.hash);
  assert.deepEqual(result.amounts, {inputRaw: '25000000', outputRaw: '945281192884240'});
  assert.deepEqual(result.verifier, {execution: 'SUCCEEDED', support: 'SUPPORTED', coverage: 'COMPLETE', verdict: 'PASS'});
  assert.equal(result.immediateBalances, 'UNKNOWN');
  assert.equal(result.policyMeaning, 'RETROSPECTIVE_ROUTE_COMPATIBILITY_ONLY');
  const report = verifyEvidence(evidence, capture.policy);
  assert.equal(report.verdict, 'PASS'); assert.equal(report.policySource, 'SUPPLIED_RETROSPECTIVE');
  assert.deepEqual(report.protocol, capture.reportSummary.protocol);
  const reserve = verifyEvidence(evidence, {...capture.policy, reserveFloorRaw: '0'});
  assert.equal(reserve.verdict, 'UNKNOWN'); assert.equal(reserve.coverage, 'PARTIAL');
  assert.equal(reserve.checks.find(check => check.id === 'reserveFloorRaw').result, 'UNKNOWN');
});
