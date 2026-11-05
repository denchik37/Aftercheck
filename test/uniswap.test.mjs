import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeExactInputSingle, decodeAddressResult, protocolStateRequests, poolStateRequests, evaluateReceiptBundle} from '../src/uniswap.ts';
import {rpcFixture, policyFixture, calldata, observation, approvalLog, uint, addressResult, router, factory, token0, token1, pool, owner, recipient, blockHash, transactionHash, otherHash} from './helpers/uniswap-fixture.mjs';

const result = (mutate, policy = policyFixture()) => {
  const evidence = rpcFixture();
  mutate?.(evidence);
  return evaluateReceiptBundle(evidence, policy);
};
const noPass = report => { assert.equal(report.verdict, 'UNKNOWN'); assert.equal(report.checks.length, 0); };
function insertApproval(evidence, log = approvalLog()) {
  evidence.receipt.logs[1].logIndex = '0x19';
  evidence.receipt.logs[2].logIndex = '0x1a';
  evidence.receipt.logs.splice(1, 0, log);
}

test('Router02 seven-field ABI has exact address, fee and raw-unit decoding', () => {
  assert.deepEqual(decodeExactInputSingle(calldata()), {tokenIn: token0, tokenOut: token1, fee: 3000, recipient,
    amountInRaw: '500', amountOutMinimumRaw: '300', sqrtPriceLimitX96Raw: '0'});
  assert.equal(decodeExactInputSingle(calldata({amountIn: 90071992547409935n})).amountInRaw, '90071992547409935');
  assert.equal(decodeAddressResult(addressResult(pool)), pool);
});

test('Rejects multicall, eight-field legacy ABI, extra bytes and noncanonical calldata padding', () => {
  for (const invalid of [
    '0xac9650d8' + calldata().slice(10), '0x414bf389' + calldata().slice(10) + uint(12345),
    calldata().slice(0, -2), calldata() + '00', calldata().replace(/^0x04e45aaf0/, '0x04e45aaf1'),
    calldata().slice(0, 9) + 'z' + calldata().slice(10),
    calldata({fee: 1n << 24n})
  ]) assert.throws(() => decodeExactInputSingle(invalid));
});

test('Rejects token aliases, router-balance input, recipient aliases, extreme amounts and price-limit routes', () => {
  for (const overrides of [
    {tokenOut: token0}, {tokenIn: '0x' + '0'.repeat(40)}, {recipient: '0x' + '0'.repeat(39) + '1'},
    {recipient: '0x' + '0'.repeat(39) + '2'}, {recipient: '0x' + '0'.repeat(40)}, {recipient: router},
    {amountIn: 0n}, {amountIn: 1n << 255n}, {priceLimit: 1n}, {fee: 1000000}
  ]) assert.throws(() => decodeExactInputSingle(calldata(overrides)));
});

test('State requests pin the official factory, router and ABI selectors without choosing latest', () => {
  const requests = protocolStateRequests(rpcFixture().transaction);
  assert.deepEqual(requests.map(r => r.key), ['sender.code', 'router.code', 'factory.code', 'tokenIn.code', 'tokenOut.code', 'router.factory', 'factory.pool']);
  assert.deepEqual(requests.find(r => r.key === 'router.factory'), {key: 'router.factory', method: 'eth_call', params: [{to: router, data: '0xc45a0155'}]});
  const getPool = requests.find(r => r.key === 'factory.pool');
  assert.equal(getPool.params[0].to, factory);
  assert.equal(getPool.params[0].data, '0x1698ee82' + token0.slice(2).padStart(64, '0') + token1.slice(2).padStart(64, '0') + uint(3000));
  assert.deepEqual(poolStateRequests(pool).map(r => r.key), ['pool.code', 'pool.factory', 'pool.token0', 'pool.token1', 'pool.fee']);
  assert.ok([...requests, ...poolStateRequests(pool)].every(r => r.params.length === 1));
});

test('Coherent synthetic RPC-shaped evidence only passes the explicitly labeled test profile', () => {
  const r = result();
  assert.equal(r.execution, 'SUCCEEDED'); assert.equal(r.support, 'SUPPORTED_TEST_PROFILE');
  assert.equal(r.coverage, 'COMPLETE'); assert.equal(r.verdict, 'PASS');
  assert.equal(r.evidenceClass, 'SYNTHETIC_RPC_FIXTURE');
  assert.equal(r.protocol.pool, pool); assert.equal(r.protocol.amountInRaw, '500'); assert.equal(r.protocol.amountOutRaw, '350');
  assert.deepEqual(r.protocol.logIndices, {inputTransfer: '0x18', outputTransfer: '0x17', swap: '0x19'});
  assert.match(r.limitations.join(' '), /synthetic RPC-shaped/);
  assert.match(r.limitations.join(' '), /plain-token assumption/);
  assert.match(r.limitations.join(' '), /not Ethereum consensus/);
});

test('The RPC source label never removes provider-trust, token-semantics or retrospective-policy limitations', () => {
  const r = result(e => {e.evidenceClass = 'RPC_RECEIPT';});
  assert.equal(r.support, 'SUPPORTED'); assert.equal(r.verdict, 'PASS');
  assert.match(r.limitations.join(' '), /trusted observations/);
  assert.match(r.limitations.join(' '), /logs can misrepresent balance/);
  assert.match(r.limitations.join(' '), /retrospective/);
});

test('Token1 input reconstructs the opposite signed Swap direction', () => {
  const r = evaluateReceiptBundle(rpcFixture({reverse: true}), policyFixture({reverse: true}));
  assert.equal(r.verdict, 'PASS'); assert.equal(r.protocol.tokenIn, token1); assert.equal(r.protocol.amountOutRaw, '350');
});

test('Independent exact cap and minimum violations remain visible', () => {
  for (const override of [{maxInputRaw: '499'}, {minReceivedRaw: '351'}, {owner: token0}, {expectedRecipient: token0}, {tokenOut: pool}]) {
    const r = result(undefined, policyFixture(override));
    assert.equal(r.verdict, 'VIOLATION'); assert.equal(r.coverage, 'COMPLETE');
    assert.ok(r.checks.some(check => check.result === 'VIOLATION'));
  }
});

test('Reserve balance remains UNKNOWN, and a known event-amount violation survives it', () => {
  const unknown = result(undefined, policyFixture({reserveFloorRaw: '0'}));
  assert.equal(unknown.verdict, 'UNKNOWN'); assert.equal(unknown.coverage, 'PARTIAL');
  assert.equal(unknown.checks.find(c => c.id === 'reserveFloorRaw').result, 'UNKNOWN');
  const violation = result(undefined, policyFixture({reserveFloorRaw: '200', maxInputRaw: '499'}));
  assert.equal(violation.verdict, 'VIOLATION'); assert.equal(violation.coverage, 'PARTIAL');
});

test('Exact arithmetic above 2^53 detects a one-unit threshold failure', () => {
  const evidence = rpcFixture({amountIn: 90071992547409935n, amountOut: 90071992547409931n});
  const r = evaluateReceiptBundle(evidence, policyFixture({maxInputRaw: '90071992547409934', minReceivedRaw: '90071992547409932'}));
  assert.equal(r.verdict, 'VIOLATION');
  assert.equal(r.protocol.amountInRaw, '90071992547409935');
  assert.equal(r.checks.filter(c => c.result === 'VIOLATION').length, 2);
});

test('Missing transaction, mined receipt, block or state produces UNKNOWN', () => {
  for (const key of ['transaction', 'receipt', 'block', 'state']) {
    const r = result(e => {e[key] = null;});
    noPass(r); assert.equal(r.coverage, 'PARTIAL');
    if (key === 'receipt') assert.equal(r.execution, 'UNKNOWN');
  }
});

test('A missing receipt is PENDING only when the transaction is unmined', () => {
  const r = result(e => {e.transaction.blockHash = null; e.transaction.blockNumber = null; e.transaction.transactionIndex = null; e.receipt = null;});
  noPass(r); assert.equal(r.execution, 'PENDING'); assert.equal(r.coverage, 'PARTIAL');
});

test('Reverted receipt cannot produce a completed swap verdict', () => {
  const r = result(e => {e.receipt.status = '0x0'; e.receipt.logs = [];});
  noPass(r); assert.equal(r.execution, 'REVERTED');
});

test('Wrong chain and incorrect raw RPC chain identity cannot pass', () => {
  const wrongChain = result(e => {e.chainId = 1;});
  noPass(wrongChain); assert.equal(wrongChain.support, 'UNSUPPORTED');
  for (const raw of ['0x1', '0x0aa36a7', 11155111]) {
    const r = result(e => {e.rpcChainId = raw;}); noPass(r); assert.equal(r.coverage, 'CONFLICTED');
  }
  const wrongPolicy = result(undefined, policyFixture({chainId: 1}));
  noPass(wrongPolicy); assert.equal(wrongPolicy.coverage, 'CONFLICTED');
  const missingRpcChain = result(e => {e.rpcChainId = null;}); noPass(missingRpcChain); assert.equal(missingRpcChain.coverage, 'PARTIAL');
  const conflictingTxChain = result(e => {e.transaction.chainId = '0x1';}); noPass(conflictingTxChain); assert.equal(conflictingTxChain.coverage, 'CONFLICTED');
});

test('Transaction, receipt and block hashes must agree independently', () => {
  for (const mutate of [
    e => {e.transaction.hash = otherHash;}, e => {e.receipt.transactionHash = otherHash;},
    e => {e.receipt.blockHash = otherHash;}, e => {e.block.hash = otherHash;},
    e => {e.receipt.blockNumber = '0x81';}, e => {e.block.number = '0x81';},
    e => {e.receipt.transactionIndex = '0x0';}, e => {e.receipt.from = recipient;}, e => {e.receipt.to = token0;}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
  const foreign = result(e => {e.receipt.transactionHash = otherHash;});
  assert.equal(foreign.execution, 'UNKNOWN');
});

test('Unresolved collection errors prevent complete evidence and a policy PASS', () => {
  const partial = result(e => {e.collectionErrors.push({stage: 'canonicalBlockAfterState', code: 'RPC_TIMEOUT'});});
  noPass(partial); assert.equal(partial.coverage, 'PARTIAL');
  const chain = result(e => {e.collectionErrors.push({stage: 'chainAfterState', code: 'CHAIN_ID_CONFLICT'});});
  noPass(chain); assert.equal(chain.coverage, 'CONFLICTED');
});

test('Block membership, unique transaction list and canonical recheck are required', () => {
  for (const mutate of [
    e => {e.block.transactions = [transactionHash, otherHash];}, e => {e.block.transactions = [transactionHash, transactionHash];},
    e => {e.block.transactions = [];}, e => {e.canonicalBlockHash = otherHash;},
    e => {e.transaction.transactionIndex = '0x10000000000000000'; e.receipt.transactionIndex = e.transaction.transactionIndex;}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
  const missing = result(e => {e.canonicalBlockHash = null;}); noPass(missing); assert.equal(missing.coverage, 'PARTIAL');
});

test('Direct-router profile rejects native value, other routers, multicall and delegated transactions', () => {
  for (const mutate of [
    e => {e.transaction.value = '0x1';}, e => {e.transaction.to = token0; e.receipt.to = token0;},
    e => {e.transaction.input = '0xac9650d8' + e.transaction.input.slice(10);},
    e => {e.transaction.type = '0x4';}, e => {e.transaction.authorizationList = [{address: token0}];}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.support, 'UNSUPPORTED');}
});

test('Sender code is observed at the block and contract/delegated senders are unsupported', () => {
  const r = result(e => {observation(e, 'sender.code').result = '0xef0100' + token0.slice(2);});
  noPass(r); assert.equal(r.support, 'UNSUPPORTED');
});

test('Contract and participant aliases cannot create contradictory code observations under different keys', () => {
  for (const token of [owner, recipient, router, factory]) {
    const r = result(e => {e.transaction.input = calldata({tokenIn: token});});
    noPass(r); assert.equal(r.support, 'UNSUPPORTED');
  }
  const extra = result(e => {e.state.push({...structuredClone(e.state[0]), key: 'sender.extra', result: '0x6000'});});
  noPass(extra); assert.equal(extra.coverage, 'CONFLICTED');
  assert.match(extra.limitations[0], /Conflicting results for the same state request/);
});

test('Required router, factory, token and pool code cannot be absent', () => {
  for (const key of ['router.code', 'factory.code', 'tokenIn.code', 'tokenOut.code', 'pool.code']) {
    const r = result(e => {observation(e, key).result = '0x';});
    noPass(r); assert.equal(r.coverage, 'CONFLICTED');
  }
});

test('Router factory, pool factory, token order and fee must agree with the pinned deployment and call', () => {
  for (const [key, value] of [
    ['router.factory', addressResult(token0)], ['pool.factory', addressResult(token0)],
    ['pool.token0', addressResult(token1)], ['pool.token1', addressResult(token0)], ['pool.fee', '0x' + uint(500)]
  ]) {const r = result(e => {observation(e, key).result = value;}); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
});

test('Missing getPool result, zero pool and conflicting factory pool never establish a supported binding', () => {
  for (const mutate of [
    e => {observation(e, 'factory.pool').result = undefined;},
    e => {observation(e, 'factory.pool').result = addressResult('0x' + '0'.repeat(40));},
    e => {observation(e, 'factory.pool').result = addressResult(token0);}
  ]) noPass(result(mutate));
});

test('Hash-bound state failures are partial and cannot silently use latest observations', () => {
  const unavailable = result(e => {const s = observation(e, 'pool.token0'); delete s.result; s.error = 'RPC_REMOTE_ERROR';});
  noPass(unavailable); assert.equal(unavailable.coverage, 'PARTIAL');
  for (const context of ['latest', '0x80', {blockHash}, {blockHash: otherHash, requireCanonical: true}, {blockHash, requireCanonical: false}]) {
    const r = result(e => {observation(e, 'pool.token0').params[1] = context;});
    noPass(r); assert.equal(r.coverage, 'CONFLICTED');
  }
});

test('State key, method, address, calldata and return encoding are independently bound', () => {
  for (const mutate of [
    e => {e.state.push(structuredClone(e.state[0]));},
    e => {observation(e, 'pool.token0').method = 'eth_getCode';},
    e => {observation(e, 'pool.token0').params[0].to = router;},
    e => {observation(e, 'pool.token0').params[0].data = '0xd21220a7';},
    e => {observation(e, 'pool.token0').params[0].from = owner;},
    e => {observation(e, 'pool.token0').result += '00';},
    e => {observation(e, 'pool.token0').result = '0x1' + observation(e, 'pool.token0').result.slice(3);},
    e => {observation(e, 'pool.token0').error = 'RPC_REMOTE_ERROR';}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
});

test('Receipt log hashes, index, ordering and removal state are independently checked', () => {
  for (const mutate of [
    e => {e.receipt.logs[0].transactionHash = otherHash;}, e => {e.receipt.logs[0].blockHash = otherHash;},
    e => {e.receipt.logs[0].blockNumber = '0x81';}, e => {e.receipt.logs[0].transactionIndex = '0x0';},
    e => {e.receipt.logs[0].removed = true;}, e => {e.receipt.logs[1].logIndex = '0x17';},
    e => {e.receipt.logs.reverse();}, e => {e.receipt.logs[0].topics[1] = '0xdead';}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
});

test('Missing Transfer or Swap is incomplete evidence even when declared policy would fail', () => {
  for (const index of [0, 1, 2]) {
    const r = result(e => {e.receipt.logs.splice(index, 1);}, policyFixture({maxInputRaw: '1'}));
    noPass(r); assert.equal(r.coverage, 'PARTIAL');
  }
});

test('Additional swaps or transfers are unsupported rather than attributed to the selected route', () => {
  for (const index of [0, 2]) {
    const r = result(e => {const extra = structuredClone(e.receipt.logs[index]); extra.logIndex = '0x20'; e.receipt.logs.push(extra);});
    noPass(r); assert.equal(r.support, 'UNSUPPORTED');
  }
});

test('Swap emitting pool and indexed sender/recipient must match independently observed identities', () => {
  for (const mutate of [
    e => {e.receipt.logs[2].address = token0;},
    e => {e.receipt.logs[2].topics[1] = addressResult(owner);},
    e => {e.receipt.logs[2].topics[2] = addressResult(owner);}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
});

test('Swap amount signs, field widths and signed tick padding are strict', () => {
  const invalidData = [
    '0x' + uint(-500) + uint(350) + uint(1n << 96n) + uint(1) + uint(0),
    '0x' + uint(500) + uint(0) + uint(1n << 96n) + uint(1) + uint(0),
    '0x' + uint(500) + uint(-350) + uint(1n << 160n) + uint(1) + uint(0),
    '0x' + uint(500) + uint(-350) + uint(1n << 96n) + uint(1n << 128n) + uint(0),
    '0x' + uint(500) + uint(-350) + uint(1n << 96n) + uint(1) + uint(0xffffff),
    '0x' + uint(500) + uint(-350) + uint(1n << 96n) + uint(1) + uint(-887273)
  ];
  for (const data of invalidData) {
    const r = result(e => {e.receipt.logs[2].data = data;}); noPass(r); assert.equal(r.coverage, 'CONFLICTED');
  }
});

test('Properly sign-extended negative tick remains supported', () => {
  const r = result(e => {const data = e.receipt.logs[2].data; e.receipt.logs[2].data = data.slice(0, -64) + uint(-1);});
  assert.equal(r.verdict, 'PASS');
});

test('Swap full-fill amount and router minimum must be consistent with a successful receipt', () => {
  const partialFill = result(e => {e.transaction.input = calldata({amountIn: 501});});
  noPass(partialFill); assert.equal(partialFill.support, 'UNSUPPORTED');
  const belowRouterMin = result(e => {e.transaction.input = calldata({minimum: 351});});
  noPass(belowRouterMin); assert.equal(belowRouterMin.coverage, 'CONFLICTED');
});

test('Each Transfer requires its exact emitter, participants and matching raw amount', () => {
  for (const mutate of [
    e => {e.receipt.logs[0].data = '0x' + uint(349);},
    e => {e.receipt.logs[1].data = '0x' + uint(501);},
    e => {e.receipt.logs[0].topics[2] = addressResult(owner);},
    e => {e.receipt.logs[1].topics[1] = addressResult(recipient);},
    e => {e.receipt.logs[1].address = token1;},
    e => {e.receipt.logs[1].topics.push(otherHash);},
    e => {e.receipt.logs[1].data += uint(0);}
  ]) {const r = result(mutate); noPass(r); assert.equal(r.coverage, 'CONFLICTED');}
  const unrelated = result(e => {e.receipt.logs[0].address = pool;});
  noPass(unrelated); assert.equal(unrelated.support, 'UNSUPPORTED');
});

test('v3 output-before-payment-before-Swap ordering is required, not just matching amounts', () => {
  const r = result(e => {
    [e.receipt.logs[0], e.receipt.logs[1]] = [e.receipt.logs[1], e.receipt.logs[0]];
    e.receipt.logs[0].logIndex = '0x17'; e.receipt.logs[1].logIndex = '0x18';
  });
  noPass(r); assert.equal(r.coverage, 'CONFLICTED');
});

test('A well-formed allowance update from the input token is allowed without becoming a token movement', () => {
  const r = result(e => {insertApproval(e);});
  assert.equal(r.verdict, 'PASS'); assert.equal(r.protocol.amountInRaw, '500');
  const afterInput = result(e => {
    e.receipt.logs[2].logIndex = '0x1a';
    const log = approvalLog(); log.logIndex = '0x19'; e.receipt.logs.splice(2, 0, log);
  });
  assert.equal(afterInput.verdict, 'PASS');
});

test('An input-token allowance update before output transfer contradicts the v3 payment callback order', () => {
  const r = result(e => {const log = approvalLog(); log.logIndex = '0x16'; e.receipt.logs.unshift(log);});
  noPass(r); assert.equal(r.coverage, 'CONFLICTED');
});

test('Unknown events and unrelated or malformed allowance changes are unsupported', () => {
  for (const mutate of [
    log => {log.topics[0] = otherHash;}, log => {log.address = token1;},
    log => {log.topics[1] = addressResult(recipient);}, log => {log.topics[2] = addressResult(pool);}
  ]) {
    const r = result(e => {const log = approvalLog(); mutate(log); insertApproval(e, log);});
    noPass(r); assert.equal(r.support, 'UNSUPPORTED');
  }
});

test('No evidence schema or source-label shortcut promotes normalized claims to protocol support', () => {
  for (const mutate of [e => {e.schemaVersion = 'aftercheck.observation.v1';}, e => {e.evidenceClass = 'NORMALIZED_SWAP';},
    e => {e.state = []; e.swap = {kind: 'UNISWAP_V3_ROUTER02_EXACT_INPUT_SINGLE',amountInRaw: '500',amountOutRaw: '350'};}]) noPass(result(mutate));
});

test('Malformed policy still fails as invalid input instead of returning a reassuring report', () => {
  assert.throws(() => evaluateReceiptBundle(rpcFixture(), policyFixture({maxInputRaw: 500})));
});
