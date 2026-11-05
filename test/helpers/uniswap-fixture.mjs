// Artificial RPC responses for negative tests. No address, block, contract code or
// transaction in this helper is asserted to represent an executed public-chain swap.
export const router = '0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e';
export const factory = '0x0227628f3f023bb0b980b67d528571c95c6dac1c';
export const token0 = '0x1111111111111111111111111111111111111111';
export const token1 = '0x2222222222222222222222222222222222222222';
export const pool = '0x4444444444444444444444444444444444444444';
export const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const blockHash = '0x' + 'b'.repeat(64);
export const transactionHash = '0x' + 'a'.repeat(64);
export const otherHash = '0x' + 'c'.repeat(64);
export const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const swapTopic = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
export const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

export const uint = n => BigInt.asUintN(256, BigInt(n)).toString(16).padStart(64, '0');
export const aw = a => a.slice(2).padStart(64, '0');
export const addressResult = a => '0x' + aw(a);
export function calldata(overrides = {}) {
  const p = {tokenIn: token0, tokenOut: token1, fee: 3000, recipient, amountIn: 500n, minimum: 300n, priceLimit: 0n, ...overrides};
  return '0x04e45aaf' + aw(p.tokenIn) + aw(p.tokenOut) + uint(p.fee) + aw(p.recipient) + uint(p.amountIn) + uint(p.minimum) + uint(p.priceLimit);
}

export function rpcFixture({reverse = false, amountIn = 500n, amountOut = 350n} = {}) {
  amountIn = BigInt(amountIn); amountOut = BigInt(amountOut);
  const input = reverse ? token1 : token0;
  const output = reverse ? token0 : token1;
  const baseLog = {transactionHash, blockHash, blockNumber: '0x80', transactionIndex: '0x1', removed: false};
  const logs = [
    {...baseLog, logIndex: '0x17', address: output, topics: [transferTopic, addressResult(pool), addressResult(recipient)], data: '0x' + uint(amountOut)},
    {...baseLog, logIndex: '0x18', address: input, topics: [transferTopic, addressResult(owner), addressResult(pool)], data: '0x' + uint(amountIn)},
    {...baseLog, logIndex: '0x19', address: pool, topics: [swapTopic, addressResult(router), addressResult(recipient)],
      data: '0x' + uint(reverse ? -amountOut : amountIn) + uint(reverse ? amountIn : -amountOut) + uint(1n << 96n) + uint(1000000) + uint(0)}
  ];
  const context = () => ({blockHash, requireCanonical: true});
  const code = (key, a) => ({key, method: 'eth_getCode', params: [a, context()], result: key === 'sender.code' ? '0x' : '0x6001600055'});
  const call = (key, to, data, result) => ({key, method: 'eth_call', params: [{to, data}, context()], result});
  return {
    schemaVersion: 'aftercheck.evidence.v1', evidenceClass: 'SYNTHETIC_RPC_FIXTURE', chainId: 11155111,
    rpcChainId: '0xaa36a7', transactionHash, canonicalBlockHash: blockHash, acquiredAt: '2026-11-05T16:00:00.000Z', collectionErrors: [],
    transaction: {hash: transactionHash, from: owner, to: router, input: calldata({tokenIn: input, tokenOut: output, amountIn}), value: '0x0',
      blockHash, blockNumber: '0x80', transactionIndex: '0x1', type: '0x2'},
    receipt: {transactionHash, from: owner, to: router, blockHash, blockNumber: '0x80', transactionIndex: '0x1', status: '0x1', logs},
    block: {hash: blockHash, number: '0x80', parentHash: '0x' + 'd'.repeat(64), timestamp: '0x12345', transactions: [otherHash, transactionHash]},
    state: [
      code('sender.code', owner), code('router.code', router), code('factory.code', factory), code('tokenIn.code', input), code('tokenOut.code', output),
      call('router.factory', router, '0xc45a0155', addressResult(factory)),
      call('factory.pool', factory, '0x1698ee82' + aw(token0) + aw(token1) + uint(3000), addressResult(pool)),
      code('pool.code', pool), call('pool.factory', pool, '0xc45a0155', addressResult(factory)),
      call('pool.token0', pool, '0x0dfe1681', addressResult(token0)), call('pool.token1', pool, '0xd21220a7', addressResult(token1)),
      call('pool.fee', pool, '0xddca3f43', '0x' + uint(3000))
    ]
  };
}

export function policyFixture({reverse = false, maxInputRaw = '500', minReceivedRaw = '350', ...overrides} = {}) {
  return {schemaVersion: 'aftercheck.policy.v1', chainId: 11155111, owner, expectedRecipient: recipient,
    tokenIn: reverse ? token1 : token0, tokenOut: reverse ? token0 : token1, maxInputRaw, minReceivedRaw, ...overrides};
}

export const observation = (evidence, key) => evidence.state.find(item => item.key === key);

export function approvalLog() {
  return {transactionHash, blockHash, blockNumber: '0x80', transactionIndex: '0x1', removed: false, logIndex: '0x18',
    address: token0, topics: [approvalTopic, addressResult(owner), addressResult(router)], data: '0x' + uint(1234)};
}
