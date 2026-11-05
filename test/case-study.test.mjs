import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseEvidence, sealEvidence, validateReceiptIdentity} from '../src/evidence.ts';
import {canonicalJson, digestJson, parseJson} from '../src/json.ts';
import {parsePolicy} from '../src/policy.ts';
import {verifyEvidence} from '../src/verify.ts';

// Fixed anchors from the unchanged historical fixture and its existing
// real-case regressions. These expectations do not come from the case runner.
const target = '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9';
const blockHash = '0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34';
const evidenceDigest = '0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093';
const owner = '0x3f82931394a11582e89366fb837e53d5d0baa62a';
const router = '0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e';
const pool = '0x029603931809d430ae47d2f55212cc0e89dbfd52';
const tokenIn = '0x0f47e03a0383396635846f8495003fc478b71bca';
const tokenOut = '0x9142fa65aaef921aea2127e88758adee0510a0f0';
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const swapTopic = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const amountIn = '1000000000000000000';
const amountOut = '999496253769344460';
const minimumOut = '1000000000000000000';
const example = name => new URL('../examples/sepolia/' + name, import.meta.url);
const load = name => parseJson(readFileSync(example(name), 'utf8'));
const addressWord = address => '0x' + address.slice(2).padStart(64, '0');

function assertScopedReport(report, verdict, coverage = 'COMPLETE') {
  assert.equal(report.schemaVersion, 'aftercheck.report.v1');
  assert.equal(report.execution, 'SUCCEEDED');
  assert.equal(report.support, 'SUPPORTED');
  assert.equal(report.coverage, coverage);
  assert.equal(report.verdict, verdict);
  assert.equal(report.evidenceClass, 'RPC_RECEIPT');
  assert.equal(report.transactionHash, target);
  assert.equal(report.chainId, 11155111);
  assert.equal(report.blockHash, blockHash);
  assert.equal(BigInt(report.blockNumber), 7689923n);
  assert.equal(BigInt(report.transactionIndex), 106n);
  assert.equal(report.evidenceDigest, evidenceDigest);
  assert.equal(report.protocol.amountInRaw, amountIn);
  assert.equal(report.protocol.amountOutRaw, amountOut);
  assert.equal(report.protocol.amountOutMinimumRaw, '0');
  assert.equal(report.verificationMode, 'OFFLINE_REPLAY');
  assert.equal(report.policySource, 'SUPPLIED_RETROSPECTIVE');
  assert.equal(report.sourceTrust, 'RPC_OBSERVATION_NOT_CONSENSUS_PROOF');
  assert.equal(report.observationFinality, 'NOT_CHECKED');
}

test('Case study preserves the exact original evidence and three existing policy files', () => {
  for (const [name, hash] of [
    ['evidence.json', 'd57013b097c323271d25a021f6244e79a00ec72853dd6aed0828f2a481fe0c36'],
    ['policy-pass.json', '56b67eb48b2196b8aecf9e0dd7da29889d634324893ace28ee8349750320364b'],
    ['policy-violation.json', 'd1b140deb7e2ddd6e514cb10000802fa66b484dc0be7eaf4a9a8fb212adc85dc'],
    ['policy-reserve.json', '44352faa1e8ec1522d568a93d5c116d598bb662f141c9d1d6bda9e78582cd8cf']
  ]) {
    assert.equal(createHash('sha256').update(readFileSync(example(name))).digest('hex'), hash, name);
  }
  const evidence = parseEvidence(load('evidence.json'));
  assert.equal(evidence.digest, evidenceDigest);
  assert.equal(evidence.evidenceClass, 'RPC_RECEIPT');
  assert.equal(evidence.chainId, 11155111);
  assert.equal(evidence.rpcChainId, '0xaa36a7');
  assert.equal(evidence.transactionHash, target);
  assert.equal(evidence.transaction.hash, target);
  assert.equal(evidence.receipt.transactionHash, target);
  assert.equal(evidence.receipt.status, '0x1');
  assert.equal(evidence.transaction.blockHash, blockHash);
  assert.equal(evidence.receipt.blockHash, blockHash);
  assert.equal(evidence.block.hash, blockHash);
  assert.equal(evidence.canonicalBlockHash, blockHash);
  assert.equal(evidence.block.transactions[106], target);
  assert.deepEqual(validateReceiptIdentity(evidence), {execution: 'SUCCEEDED', coverage: 'COMPLETE'});
});

test('Committed calldata and raw receipt logs establish quantities and the zero router floor independently', () => {
  const evidence = load('evidence.json');
  assert.equal(evidence.transaction.from, owner);
  assert.equal(evidence.transaction.to, router);
  assert.equal(BigInt(evidence.transaction.value), 0n);
  const calldata = evidence.transaction.input;
  assert.equal(calldata.slice(0, 10), '0x04e45aaf');
  assert.equal(calldata.length, 10 + 7 * 64);
  const words = calldata.slice(10).match(/.{64}/g);
  assert.deepEqual(words.slice(0, 2).map(word => '0x' + word.slice(24)), [tokenIn, tokenOut]);
  assert.equal(BigInt('0x' + words[2]), 500n);
  assert.equal('0x' + words[3].slice(24), owner);
  assert.deepEqual(words.slice(4).map(word => BigInt('0x' + word)), [1000000000000000000n, 0n, 0n]);

  const [output, input, swap] = evidence.receipt.logs;
  assert.equal(evidence.receipt.logs.length, 3);
  assert.deepEqual([output.address, input.address, swap.address], [tokenOut, tokenIn, pool]);
  assert.deepEqual(output.topics, [transferTopic, addressWord(pool), addressWord(owner)]);
  assert.deepEqual(input.topics, [transferTopic, addressWord(owner), addressWord(pool)]);
  assert.deepEqual(swap.topics, [swapTopic, addressWord(router), addressWord(owner)]);
  assert.equal(BigInt(input.data), 1000000000000000000n);
  assert.equal(BigInt(output.data), 999496253769344460n);
  const swapWords = swap.data.slice(2).match(/.{64}/g);
  assert.equal(swapWords.length, 5);
  assert.deepEqual(swapWords.slice(0, 2).map(word => BigInt.asIntN(256, BigInt('0x' + word))),
    [1000000000000000000n, -999496253769344460n]);
  assert.deepEqual(evidence.receipt.logs.map(log => BigInt(log.logIndex)), [111n, 112n, 113n]);
  for (const log of evidence.receipt.logs) {
    assert.equal(log.transactionHash, target);
    assert.equal(log.blockHash, blockHash);
    assert.equal(log.removed, false);
  }
});

test('Retrospective output policy changes only the minimum and preserves the supported identities and cap', () => {
  const pass = parsePolicy(load('policy-pass.json'));
  const threshold = parsePolicy(load('policy-output-threshold.json'));
  assert.deepEqual(threshold, {...pass, minReceivedRaw: minimumOut});
  assert.equal(threshold.chainId, 11155111);
  assert.equal(threshold.owner, owner);
  assert.equal(threshold.expectedRecipient, owner);
  assert.equal(threshold.tokenIn, tokenIn);
  assert.equal(threshold.tokenOut, tokenOut);
  assert.equal(threshold.maxInputRaw, amountIn);
  assert.equal(threshold.reserveFloorRaw, undefined);
});

test('Historical successful transaction has a scoped PASS under the existing supplied policy', () => {
  const policy = parsePolicy(load('policy-pass.json'));
  const report = verifyEvidence(load('evidence.json'), policy);
  assertScopedReport(report, 'PASS');
  assert.equal(policy.minReceivedRaw, '999000000000000000');
  assert.equal(report.policyDigest, digestJson(policy));
  assert.deepEqual(report.checks.map(check => [check.id, check.result]), [
    ['owner', 'PASS'], ['recipient', 'PASS'], ['tokenPair', 'PASS'],
    ['maxInputRaw', 'PASS'], ['minReceivedRaw', 'PASS']
  ]);
});

test('The stricter retrospective policy violates only minReceivedRaw by exactly 503746230655540 raw units', () => {
  const policy = parsePolicy(load('policy-output-threshold.json'));
  const report = verifyEvidence(load('evidence.json'), policy);
  assertScopedReport(report, 'VIOLATION');
  assert.equal(report.policyDigest, digestJson(policy));
  assert.deepEqual(report.checks.map(check => [check.id, check.result]), [
    ['owner', 'PASS'], ['recipient', 'PASS'], ['tokenPair', 'PASS'],
    ['maxInputRaw', 'PASS'], ['minReceivedRaw', 'VIOLATION']
  ]);
  const observed = BigInt(report.protocol.amountOutRaw);
  const required = BigInt(policy.minReceivedRaw);
  const shortfall = required - observed;
  assert.equal(shortfall, 503746230655540n);
  assert.ok(shortfall > 0n);
  assert.ok(observed >= BigInt(report.protocol.amountOutMinimumRaw));
  assert.match(report.checks.find(check => check.id === 'minReceivedRaw').reason,
    /Receipt output amount 999496253769344460 compared with minimum 1000000000000000000 in exact raw units/);
});

test('Policy changes the verdict while transaction, block, evidence and observed protocol quantities remain identical', () => {
  const evidence = parseEvidence(load('evidence.json'));
  const before = canonicalJson(evidence);
  const pass = verifyEvidence(evidence, load('policy-pass.json'));
  const violation = verifyEvidence(evidence, load('policy-output-threshold.json'));
  assertScopedReport(pass, 'PASS');
  assertScopedReport(violation, 'VIOLATION');
  for (const field of ['transactionHash', 'chainId', 'blockHash', 'blockNumber', 'transactionIndex', 'evidenceDigest']) {
    assert.equal(pass[field], violation[field], field);
  }
  assert.deepEqual(pass.protocol, violation.protocol);
  assert.notEqual(pass.policyDigest, violation.policyDigest);
  assert.notEqual(pass.verdict, violation.verdict);
  assert.equal(canonicalJson(evidence), before, 'Verifier must not modify the retained observation');
});

test('Tampered receipt copies and malformed policy thresholds are rejected without modifying retained evidence', () => {
  const evidence = load('evidence.json');
  const original = canonicalJson(evidence);
  const tampered = structuredClone(evidence);
  tampered.receipt.logs[0].data = '0x' + BigInt(minimumOut).toString(16).padStart(64, '0');
  const policy = load('policy-output-threshold.json');
  assert.throws(() => verifyEvidence(tampered, policy), /EVIDENCE_DIGEST_MISMATCH/);
  assert.throws(() => verifyEvidence(evidence, {...policy, minReceivedRaw: '1e18'}), /canonical nonnegative decimal string/);
  assert.throws(() => verifyEvidence(evidence, {...policy, minReceivedRaw: '01000000000000000000'}), /canonical nonnegative decimal string/);
  assert.throws(() => verifyEvidence(evidence, {...policy, businessVerdict: 'PASS'}), /Unknown policy field/);
  assert.equal(canonicalJson(load('evidence.json')), original);
});

test('Resealed incomplete and conflicting test copies stay UNKNOWN under the new policy', () => {
  const original = load('evidence.json');
  for (const [mutate, coverage] of [
    [copy => { copy.canonicalBlockHash = null; }, 'PARTIAL'],
    [copy => { copy.receipt.transactionHash = '0x' + 'f'.repeat(64); }, 'CONFLICTED']
  ]) {
    // Deliberately altered only in memory and labeled as a test fixture. This
    // digest is not presented as another authentic historical observation.
    const {digest: ignored, ...copy} = structuredClone(original);
    copy.evidenceClass = 'SYNTHETIC_RPC_FIXTURE';
    mutate(copy);
    const report = verifyEvidence(sealEvidence(copy), load('policy-output-threshold.json'));
    assert.equal(report.verdict, 'UNKNOWN');
    assert.equal(report.coverage, coverage);
    assert.equal(report.support, 'UNSUPPORTED');
    assert.deepEqual(report.checks, []);
    assert.notEqual(report.evidenceDigest, evidenceDigest);
  }
  assert.equal(parseEvidence(load('evidence.json')).digest, evidenceDigest);
});

test('Existing PASS, input-cap VIOLATION and reserve UNKNOWN demonstrations retain their exact meanings', () => {
  const evidence = load('evidence.json');
  for (const [name, verdict, coverage, checkId, checkResult] of [
    ['pass', 'PASS', 'COMPLETE', 'minReceivedRaw', 'PASS'],
    ['violation', 'VIOLATION', 'COMPLETE', 'maxInputRaw', 'VIOLATION'],
    ['reserve', 'UNKNOWN', 'PARTIAL', 'reserveFloorRaw', 'UNKNOWN']
  ]) {
    const report = verifyEvidence(evidence, load(`policy-${name}.json`));
    assertScopedReport(report, verdict, coverage);
    assert.equal(report.checks.find(check => check.id === checkId).result, checkResult);
    if (name === 'violation') assert.equal(report.checks.find(check => check.id === 'minReceivedRaw').result, 'PASS');
    if (name === 'reserve') {
      assert.equal(report.checks.filter(check => check.result === 'UNKNOWN').length, 1);
      assert.equal(report.checks.filter(check => check.result === 'VIOLATION').length, 0);
    }
  }
});
