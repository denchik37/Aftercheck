import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson} from '../src/json.ts';
import {inspectSupportedSwap} from '../src/inspect.ts';
import {RpcError} from '../src/rpc.ts';
import {rpcFixture, policyFixture, transactionHash} from './helpers/uniswap-fixture.mjs';

// Simulated RPC responses: no actual public-chain capture is asserted by this
// test. The retained genuine Sepolia example is tested separately.
function simulatedReader(evidence, adjust = () => undefined) {
  return {
    calls: [],
    async call(method, params) {
      this.calls.push({method, params});
      let result;
      if (method === 'eth_chainId') result = evidence.rpcChainId;
      else if (method === 'eth_getTransactionByHash') result = evidence.transaction;
      else if (method === 'eth_getTransactionReceipt') result = evidence.receipt;
      else if (method === 'eth_getBlockByHash' || method === 'eth_getBlockByNumber') result = evidence.block;
      else result = evidence.state.find(state => state.method === method &&
        canonicalJson(state.params) === canonicalJson(params))?.result;
      const changed = adjust({method, params, result, calls: this.calls});
      return structuredClone(changed === undefined ? result : changed);
    }
  };
}

test('one read-only inspection returns a matching evidence, policy and report set', async () => {
  const reader = simulatedReader(rpcFixture());
  const {evidence, policy, report} = await inspectSupportedSwap(reader, transactionHash, policyFixture());
  assert.equal(reader.calls.length, 19);
  assert.equal(evidence.state.length, 12);
  assert.equal(report.evidenceDigest, evidence.digest);
  assert.equal(report.evidenceClass, 'RPC_RECEIPT'); // simulated transport, not authenticated chain data
  assert.equal(report.verdict, 'PASS');
  assert.equal(report.support, 'SUPPORTED');
  assert.equal(report.execution, 'SUCCEEDED');
  assert.equal(report.protocol.amountInRaw, '500');
  assert.equal(report.protocol.amountOutRaw, '350');
  assert.deepEqual(report.checks.map(x => x.result), ['PASS','PASS','PASS','PASS','PASS']);
  assert.deepEqual(policy, policyFixture());
  assert.ok(reader.calls.every(x => !x.method.startsWith('eth_send')));
});

test('policy violations survive unknown reserve checks in the same inspection', async () => {
  const reader = simulatedReader(rpcFixture());
  const result = await inspectSupportedSwap(reader, transactionHash,
    policyFixture({maxInputRaw: '499', reserveFloorRaw: '1'}));
  assert.equal(result.report.verdict, 'VIOLATION');
  assert.equal(result.report.coverage, 'PARTIAL');
  assert.equal(result.report.checks.find(x => x.id === 'maxInputRaw').result, 'VIOLATION');
  assert.equal(result.report.checks.find(x => x.id === 'reserveFloorRaw').result, 'UNKNOWN');
});

test('unavailable historical reads and a changed canonical block fail closed', async () => {
  const incomplete = simulatedReader(rpcFixture(), ({method}) => {
    if (method === 'eth_call') throw new RpcError('RPC_REMOTE_ERROR');
  });
  const partial = await inspectSupportedSwap(incomplete, transactionHash, policyFixture());
  assert.equal(partial.report.verdict, 'UNKNOWN');
  assert.equal(partial.report.coverage, 'PARTIAL');
  assert.ok(partial.evidence.state.some(x => x.error === 'RPC_REMOTE_ERROR'));

  const e = rpcFixture();
  const changed = simulatedReader(e, ({method, calls}) =>
    method === 'eth_getBlockByNumber' && calls.length > 10
      ? {...e.block, hash: '0x' + 'f'.repeat(64)} : undefined);
  const conflict = await inspectSupportedSwap(changed, transactionHash, policyFixture());
  assert.equal(conflict.report.verdict, 'UNKNOWN');
  assert.equal(conflict.report.coverage, 'CONFLICTED');
});

test('invalid policy, unsupported policy chain and malformed transaction hash perform zero RPC calls', async () => {
  for (const [target, policy] of [
    [transactionHash, {...policyFixture(), maxInputRaw: 500}],
    [transactionHash, {...policyFixture(), chainId: 1}],
    ['0x1234', policyFixture()]
  ]) {
    const reader = simulatedReader(rpcFixture());
    await assert.rejects(inspectSupportedSwap(reader, target, policy));
    assert.equal(reader.calls.length, 0);
  }
});
