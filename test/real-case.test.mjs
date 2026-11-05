import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseEvidence} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';

// Literal expectations were independently transcribed from the historical
// Etherscan calldata and logs before this RPC capture. No adapter output is used
// to construct the expected amounts, event identities or log indices.
// https://sepolia.etherscan.io/tx/0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9
const target = '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9';
const blockHash = '0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34';
const digest = '0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093';
const owner = '0x3f82931394a11582e89366fb837e53d5d0baa62a';
const router = '0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e';
const factory = '0x0227628f3f023bb0b980b67d528571c95c6dac1c';
const pool = '0x029603931809d430ae47d2f55212cc0e89dbfd52';
const tokenIn = '0x0f47e03a0383396635846f8495003fc478b71bca';
const tokenOut = '0x9142fa65aaef921aea2127e88758adee0510a0f0';
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const swapTopic = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const example = name => new URL('../examples/sepolia/' + name, import.meta.url);
const load = name => JSON.parse(readFileSync(example(name), 'utf8'));
const addressWord = address => '0x' + address.slice(2).padStart(64, '0');

test('Genuine historical capture preserves its exact file, transaction, block and seven calldata fields', () => {
  const bytes = readFileSync(example('evidence.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'd57013b097c323271d25a021f6244e79a00ec72853dd6aed0828f2a481fe0c36');
  const e = parseEvidence(JSON.parse(bytes));
  assert.equal(e.digest, digest);
  assert.equal(e.evidenceClass, 'RPC_RECEIPT');
  assert.equal(e.chainId, 11155111);
  assert.equal(e.rpcChainId, '0xaa36a7');
  assert.equal(e.transactionHash, target);
  assert.equal(e.transaction.hash, target);
  assert.equal(e.transaction.from, owner);
  assert.equal(e.transaction.to, router);
  assert.equal(BigInt(e.transaction.value), 0n);
  assert.equal(e.transaction.blockHash, blockHash);
  assert.equal(e.block.hash, blockHash);
  assert.equal(e.canonicalBlockHash, blockHash);
  assert.equal(BigInt(e.transaction.blockNumber), 7689923n);
  assert.equal(BigInt(e.transaction.transactionIndex), 106n);
  assert.equal(e.block.transactions[106], target);
  assert.equal(e.transaction.input.slice(0, 10), '0x04e45aaf');
  const words = e.transaction.input.slice(10).match(/.{64}/g);
  assert.equal(words.length, 7);
  assert.deepEqual(words.slice(0, 2).map(x => '0x' + x.slice(24)), [tokenIn, tokenOut]);
  assert.equal(BigInt('0x' + words[2]), 500n);
  assert.equal('0x' + words[3].slice(24), owner);
  assert.deepEqual(words.slice(4).map(x => BigInt('0x' + x)), [1000000000000000000n, 0n, 0n]);
});

test('Genuine receipt matches independent literal Transfer and signed Swap observations', () => {
  const e = load('evidence.json');
  assert.equal(e.receipt.status, '0x1');
  assert.equal(e.receipt.transactionHash, target);
  const [output, input, swap] = e.receipt.logs;
  assert.equal(e.receipt.logs.length, 3);
  assert.deepEqual(e.receipt.logs.map(x => BigInt(x.logIndex)), [111n, 112n, 113n]);
  assert.deepEqual(e.receipt.logs.map(x => x.address), [tokenOut, tokenIn, pool]);
  assert.deepEqual(output.topics, [transferTopic, addressWord(pool), addressWord(owner)]);
  assert.deepEqual(input.topics, [transferTopic, addressWord(owner), addressWord(pool)]);
  assert.deepEqual(swap.topics, [swapTopic, addressWord(router), addressWord(owner)]);
  assert.equal(BigInt(output.data), 999496253769344460n);
  assert.equal(BigInt(input.data), 1000000000000000000n);
  const words = swap.data.slice(2).match(/.{64}/g).map(x => BigInt('0x' + x));
  assert.deepEqual(words, [1000000000000000000n, (1n << 256n) - 999496253769344460n,
    79227964543758943516933103974n, 800000000000000000043482n, (1n << 256n) - 1n]);
  for (const log of e.receipt.logs) {
    assert.equal(log.transactionHash, target);
    assert.equal(log.blockHash, blockHash);
    assert.equal(log.removed, false);
  }
});

test('All twelve genuine state observations bind the same historical block and expected deployment', () => {
  const e = load('evidence.json');
  assert.equal(e.state.length, 12);
  assert.deepEqual(e.collectionErrors, []);
  const state = new Map(e.state.map(x => [x.key, x]));
  assert.equal(state.size, 12);
  for (const item of e.state) {
    assert.deepEqual(item.params[1], {blockHash, requireCanonical: true});
    assert.equal(item.error, undefined);
    assert.equal(typeof item.result, 'string');
  }
  for (const [key, address] of [['router.factory', factory], ['factory.pool', pool],
    ['pool.factory', factory], ['pool.token0', tokenIn], ['pool.token1', tokenOut]]) {
    assert.equal(state.get(key).result, addressWord(address));
  }
  assert.equal(BigInt(state.get('pool.fee').result), 500n);
  assert.equal(state.get('sender.code').result, '0x');
  for (const key of ['router.code', 'factory.code', 'tokenIn.code', 'tokenOut.code', 'pool.code']) {
    assert.ok(state.get(key).result.length > 2);
  }
});

test('Real raw amounts retain one-unit policy boundaries above Number precision', () => {
  const e = load('evidence.json'), policy = load('policy-pass.json');
  const exact = verifyEvidence(e, {...policy, minReceivedRaw: '999496253769344460'});
  assert.equal(exact.verdict, 'PASS');
  assert.equal(exact.protocol.amountInRaw, '1000000000000000000');
  assert.equal(exact.protocol.amountOutRaw, '999496253769344460');
  const below = verifyEvidence(e, {...policy, maxInputRaw: '999999999999999999'});
  assert.equal(below.verdict, 'VIOLATION');
  assert.equal(below.checks.find(x => x.id === 'maxInputRaw').result, 'VIOLATION');
  const above = verifyEvidence(e, {...policy, minReceivedRaw: '999496253769344461'});
  assert.equal(above.verdict, 'VIOLATION');
  assert.equal(above.checks.find(x => x.id === 'minReceivedRaw').result, 'VIOLATION');
});

test('Original real bundle replays all three CLI outcomes with network entry points disabled', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftercheck-real-'));
  try {
    for (const [name, expected, status, coverage] of [
      ['pass', 'PASS', 0, 'COMPLETE'], ['violation', 'VIOLATION', 2, 'COMPLETE'], ['reserve', 'UNKNOWN', 3, 'PARTIAL']
    ]) {
      const out = join(dir, name);
      const result = spawnSync(process.execPath, ['--import', new URL('../scripts/offline-guard.mjs', import.meta.url).href,
        fileURLToPath(new URL('../bin/aftercheck.mjs', import.meta.url)), 'verify',
        fileURLToPath(example('evidence.json')), fileURLToPath(example(`policy-${name}.json`)), out],
      {encoding: 'utf8', timeout: 10_000, env: {...process.env, AFTERCHECK_RPC_URL: 'https://unreachable.invalid/unused'}});
      assert.equal(result.status, status, result.stderr);
      const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8'));
      assert.equal(report.evidenceDigest, digest);
      assert.equal(report.evidenceClass, 'RPC_RECEIPT');
      assert.equal(report.execution, 'SUCCEEDED');
      assert.equal(report.support, 'SUPPORTED');
      assert.equal(report.coverage, coverage);
      assert.equal(report.verdict, expected);
      assert.equal(report.verificationMode, 'OFFLINE_REPLAY');
      assert.equal(report.policySource, 'SUPPLIED_RETROSPECTIVE');
      assert.equal(report.sourceTrust, 'RPC_OBSERVATION_NOT_CONSENSUS_PROOF');
      assert.equal(report.observationFinality, 'NOT_CHECKED');
      assert.equal(report.protocol.amountInRaw, '1000000000000000000');
      assert.equal(report.protocol.amountOutRaw, '999496253769344460');
      assert.deepEqual(report.protocol.logIndices, {inputTransfer: '0x70', outputTransfer: '0x6f', swap: '0x71'});
      if (name === 'reserve') assert.equal(report.checks.find(x => x.id === 'reserveFloorRaw').result, 'UNKNOWN');
      const portable = JSON.parse(await readFile(join(out, 'evidence.json'), 'utf8'));
      assert.deepEqual(portable, load('evidence.json'));
      assert.match(await readFile(join(out, 'report.md'), 'utf8'), new RegExp(expected));
    }
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('Genuine partial provider capture remains UNKNOWN without borrowing successful provider state', () => {
  const e = load('evidence-publicnode-partial.json');
  assert.equal(e.digest, '0xeb791a7eedbdb9362943d9f939ac9649c29f4d490e08ec1bfdd067c4b78a8e8f');
  assert.equal(e.transactionHash, target);
  assert.equal(e.receipt.status, '0x1');
  assert.equal(e.state.length, 7);
  assert.ok(e.state.every(x => x.error === 'RPC_REMOTE_ERROR' && x.result === undefined));
  const report = verifyEvidence(e, load('policy-pass.json'));
  assert.equal(report.execution, 'SUCCEEDED');
  assert.equal(report.support, 'UNSUPPORTED');
  assert.equal(report.coverage, 'PARTIAL');
  assert.equal(report.verdict, 'UNKNOWN');
  assert.equal(report.checks.length, 0);
});

test('Tampering with a genuine receipt is rejected before policy evaluation', () => {
  const e = load('evidence.json');
  e.receipt.logs[0].data = '0x' + '0'.repeat(64);
  assert.throws(() => verifyEvidence(e, load('policy-pass.json')), /EVIDENCE_DIGEST_MISMATCH/);
});
