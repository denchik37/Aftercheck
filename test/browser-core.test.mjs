import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseJson, canonicalJson, digestJson} from '../src/json.ts';
import {verifyEvidence} from '../src/verify.ts';
import {sealEvidence} from '../src/evidence.ts';
import {rpcFixture, policyFixture} from './helpers/uniswap-fixture.mjs';
import * as browserSource from '../src/browser-engine.ts';
import * as browserPublished from '../web/assets/browser-engine.js';
import {browserParityCases} from '../scripts/browser-parity-cases.mjs';

test('Web Crypto matches independent Node SHA-256 over canonical UTF-8 including Unicode', async () => {
  const values = [null, {}, {b: 2, a: 1}, 'é', '🪙', '\ud800', {s: 'Ethereum\u0000漢字', a: [true, false, '0', 11155111]}];
  for (const value of values) {
    const expected = '0x' + createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
    assert.equal(await browserSource.digestJsonAsync(value), expected);
    assert.equal(await browserPublished.digestJsonAsync(value), expected);
    assert.equal(digestJson(value), expected);
  }
  assert.equal(await browserPublished.digestJsonAsync({}), '0x44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
});

test('portable strict JSON retains exact UTF-8 byte bounds', () => {
  for (const text of ['"abc"', '"é"', '"🪙"', '"\ud800"']) {
    const bytes = Buffer.byteLength(text, 'utf8');
    assert.equal(browserPublished.parseJson(text, bytes), parseJson(text, bytes));
    assert.throws(() => browserPublished.parseJson(text, bytes - 1), /JSON_SIZE_LIMIT/);
    assert.throws(() => parseJson(text, bytes - 1), /JSON_SIZE_LIMIT/);
  }
});

for (const item of browserParityCases()) {
  test(`browser and Node complete report parity: ${item.name}`, async () => {
    for (const engine of [browserSource, browserPublished]) {
      if (item.expected.error) {
        await assert.rejects(async () => engine.verifyEvidenceAsync(engine.parseJson(item.evidenceText), engine.parseJson(item.policyText)),
          error => error.message === item.expected.error);
      } else {
        const report = await engine.verifyEvidenceAsync(engine.parseJson(item.evidenceText), engine.parseJson(item.policyText));
        assert.equal(engine.canonicalJson(report), item.expected.report);
        assert.equal(engine.renderMarkdown(report), item.expected.markdown);
      }
    }
  });
}

test('async evidence and policy are detached before Web Crypto yields', async () => {
  const evidence = sealEvidence(rpcFixture());
  const policy = policyFixture();
  const expected = verifyEvidence(evidence, policy);
  const pending = browserPublished.verifyEvidenceAsync(evidence, policy);
  evidence.receipt.logs[0].data = '0x' + '0'.repeat(64);
  policy.minReceivedRaw = '999999';
  assert.deepEqual(await pending, expected);
  const clean = sealEvidence(rpcFixture());
  const parsed = browserPublished.parseEvidenceAsync(clean);
  clean.transactionHash = '0x' + 'f'.repeat(64);
  assert.notEqual((await parsed).transactionHash, clean.transactionHash);
});

test('same retained evidence changes only the supplied-policy result and digest', async () => {
  const evidence = parseJson(readFileSync(new URL('../examples/sepolia/evidence.json', import.meta.url), 'utf8'));
  const policy = parseJson(readFileSync(new URL('../examples/sepolia/policy-pass.json', import.meta.url), 'utf8'));
  const pass = await browserPublished.verifyEvidenceAsync(evidence, policy);
  const violation = await browserPublished.verifyEvidenceAsync(evidence, {...policy, minReceivedRaw: '1000000000000000000'});
  const unknown = await browserPublished.verifyEvidenceAsync(evidence, {...policy, reserveFloorRaw: '0'});
  assert.equal(pass.verdict, 'PASS');
  assert.equal(violation.verdict, 'VIOLATION');
  assert.equal(unknown.verdict, 'UNKNOWN');
  assert.equal(pass.evidenceDigest, violation.evidenceDigest);
  assert.equal(pass.evidenceDigest, unknown.evidenceDigest);
  assert.notEqual(pass.policyDigest, violation.policyDigest);
  assert.notEqual(pass.policyDigest, unknown.policyDigest);
  assert.deepEqual(pass.protocol, violation.protocol);
  assert.deepEqual(pass.protocol, unknown.protocol);
  assert.equal(violation.execution, 'SUCCEEDED');
  assert.equal(1000000000000000000n - BigInt(violation.protocol.amountOutRaw), 503746230655540n);
});

test('async verifier fails closed when secure Web Crypto is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true});
    await assert.rejects(browserSource.verifyEvidenceAsync(sealEvidence(rpcFixture()), policyFixture()), /SECURE_CONTEXT_CRYPTO_REQUIRED/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});
