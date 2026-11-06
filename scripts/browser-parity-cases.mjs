import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseJson, canonicalJson} from '../src/json.ts';
import {sealEvidence} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {renderMarkdown} from '../src/report.ts';
import {rpcFixture, policyFixture, addressResult, pool} from '../test/helpers/uniswap-fixture.mjs';

/** Test inputs and expected outputs come from the canonical Node entry point. */
export function browserParityCases() {
  const cases = [];
  const realEvidence = readFileSync(new URL('../examples/sepolia/evidence.json', import.meta.url), 'utf8');
  const policy = name => parseJson(readFileSync(new URL(`../examples/sepolia/policy-${name}.json`, import.meta.url), 'utf8'));
  const passPolicy = policy('pass');
  const add = (name, evidence, suppliedPolicy = passPolicy) => {
    const evidenceText = typeof evidence === 'string' ? evidence : canonicalJson(evidence);
    const policyText = typeof suppliedPolicy === 'string' ? suppliedPolicy : canonicalJson(suppliedPolicy);
    let expected;
    try {
      const report = verifyEvidence(parseJson(evidenceText), parseJson(policyText));
      expected = {report: canonicalJson(report), markdown: renderMarkdown(report)};
    } catch (error) {
      expected = {error: error.message};
    }
    cases.push({name, evidenceText, policyText, expected});
  };
  for (const name of ['pass', 'violation', 'output-threshold', 'reserve']) add(`historical-${name}`, realEvidence, policy(name));
  add('historical-known-violation-with-unknown-reserve', realEvidence, {...policy('output-threshold'), reserveFloorRaw: '1'});
  add('historical-output-equality', realEvidence, {...passPolicy, minReceivedRaw: '999496253769344460'});
  add('historical-output-one-unit-above', realEvidence, {...passPolicy, minReceivedRaw: '999496253769344461'});
  add('historical-zero-output-floor', realEvidence, {...passPolicy, minReceivedRaw: '0'});
  add('historical-uint256-output-floor', realEvidence, {...passPolicy, minReceivedRaw: ((1n << 256n) - 1n).toString()});
  add('historical-uint256-input-cap', realEvidence, {...passPolicy, maxInputRaw: ((1n << 256n) - 1n).toString()});
  add('synthetic-above-safe-number', sealEvidence(rpcFixture({amountIn: 90071992547409935n, amountOut: 18446744073709551617n})),
    policyFixture({maxInputRaw: '90071992547409935', minReceivedRaw: '18446744073709551617'}));
  add('synthetic-reverse-direction', sealEvidence(rpcFixture({reverse: true})), policyFixture({reverse: true}));
  add('zero-reserve-remains-unknown', sealEvidence(rpcFixture()), policyFixture({reserveFloorRaw: '0'}));
  const changed = (name, edit) => {
    const fixture = rpcFixture();
    edit(fixture);
    add(name, sealEvidence(fixture), policyFixture());
  };
  changed('missing-protocol-observations', e => { e.state = []; });
  changed('missing-one-protocol-observation', e => { e.state = e.state.filter(s => s.key !== 'pool.token0'); });
  changed('conflicting-pool-identity', e => { e.state.find(s => s.key === 'factory.pool').result = addressResult('0x' + '9'.repeat(40)); });
  changed('unsupported-selector', e => { e.transaction.input = '0x12345678' + e.transaction.input.slice(10); });
  changed('unexpected-event', e => { e.receipt.logs.push({...e.receipt.logs[2], logIndex: '0x1a', topics: ['0x' + '0'.repeat(64)]}); });
  changed('wrong-transaction-identity', e => { e.receipt.transactionHash = '0x' + 'f'.repeat(64); });
  changed('wrong-chain', e => { e.chainId = 1; });
  changed('conflicting-rpc-chain', e => { e.rpcChainId = '0x1'; });
  changed('invalid-receipt-status', e => { e.receipt.status = '0x2'; });
  changed('conflicting-receipt-block', e => { e.receipt.blockHash = '0x' + 'f'.repeat(64); });
  changed('missing-receipt', e => { e.receipt = null; });
  changed('missing-block', e => { e.block = null; });
  changed('missing-canonical-block', e => { e.canonicalBlockHash = null; });
  changed('incomplete-collection', e => { e.collectionErrors = [{stage: 'pool.code', code: 'RPC_READ_FAILED'}]; });
  const corrupted = sealEvidence(rpcFixture());
  corrupted.receipt.logs[0].data = '0x' + '0'.repeat(64);
  add('corrupted-evidence-digest', corrupted, policyFixture());
  const unknownField = {...sealEvidence(rpcFixture()), extra: 'unreviewed'};
  add('unexpected-evidence-field', unknownField, policyFixture());
  add('unknown-policy-field', sealEvidence(rpcFixture()), {...policyFixture(), extra: 'unreviewed'});
  add('invalid-zero-input-cap', sealEvidence(rpcFixture()), policyFixture({maxInputRaw: '0'}));
  add('policy-uint256-overflow', sealEvidence(rpcFixture()), policyFixture({minReceivedRaw: (1n << 256n).toString()}));
  add('wrong-policy-chain', sealEvidence(rpcFixture()), policyFixture({chainId: 1}));
  add('duplicate-evidence-key', '{"digest":"a","digest":"b"}', policyFixture());
  add('escaped-duplicate-evidence-key', '{"digest":"a","\\u0064igest":"b"}', policyFixture());
  add('prototype-pollution-key', '{"__proto__":{"polluted":true}}', policyFixture());
  add('unsafe-integer-json', '{"chainId":9007199254740992}', policyFixture());
  add('excessive-json-depth', '['.repeat(50) + '0' + ']'.repeat(50), policyFixture());
  add('duplicate-policy-key', sealEvidence(rpcFixture()), '{"maxInputRaw":"1","maxInputRaw":"2"}');
  return cases;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify({schemaVersion: 'aftercheck.browser-parity.v1', cases: browserParityCases()}));
}
