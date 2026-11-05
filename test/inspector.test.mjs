import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {evaluate} from '../src/evaluate.ts';
import {evaluateReceiptBundle} from '../src/uniswap.ts';
import {rpcFixture, policyFixture} from './helpers/uniswap-fixture.mjs';

const html = readFileSync(new URL('../web/inspector.html', import.meta.url), 'utf8');
const parserSource = html.match(/<script id="report-parser">([\s\S]*?)<\/script>/)?.[1];
assert.ok(parserSource, 'The actual standalone inspector parser must be present');
const context = vm.createContext({TextEncoder});
new vm.Script(parserSource + '\nglobalThis.inspectorParser = AftercheckReports;').runInContext(context);
const {parseReport, evidenceDescription} = context.inspectorParser;
const observation = JSON.parse(readFileSync(new URL('../examples/synthetic-observation.json', import.meta.url), 'utf8'));
const policy = JSON.parse(readFileSync(new URL('../examples/synthetic-policy.json', import.meta.url), 'utf8'));
const baseline = () => evaluate(observation, policy);
const parse = report => parseReport(JSON.stringify(report));

test('inspector accepts actual evaluator PASS, VIOLATION, and reserve UNKNOWN reports', () => {
  for (const [settings, verdict] of [[policy, 'PASS'], [{...policy, maxInputRaw:'499'}, 'VIOLATION'], [{...policy, reserveFloorRaw:'200'}, 'UNKNOWN']]) {
    const report = parse(evaluate(observation, settings));
    assert.equal(report.verdict, verdict);
    assert.equal(report.evidenceClass, 'SYNTHETIC_FIXTURE');
    assert.equal(evidenceDescription(report).synthetic, true);
  }
});

test('inspector preserves a known violation alongside an unknown reserve check', () => {
  const report = parse(evaluate(observation, {...policy, maxInputRaw:'499', reserveFloorRaw:'200'}));
  assert.equal(report.verdict, 'VIOLATION');
  assert.equal(report.coverage, 'PARTIAL');
  assert.equal(report.checks.find(check => check.id === 'reserveFloorRaw').result, 'UNKNOWN');
});

test('inspector accepts optional captured identity and preserves raw amounts above 2^53', () => {
  const report = evaluateReceiptBundle(rpcFixture({amountIn:90071992547409935n,amountOut:18446744073709551617n}), policyFixture({maxInputRaw:'90071992547409935',minReceivedRaw:'1'}));
  Object.assign(report, {evidenceDigest:'0x'+'c'.repeat(64), policyDigest:'0x'+'d'.repeat(64), evaluatorVersion:'0.2.0', verificationMode:'OFFLINE_REPLAY', policySource:'SUPPLIED_RETROSPECTIVE', sourceTrust:'RPC_OBSERVATION_NOT_CONSENSUS_PROOF', observationFinality:'NOT_CHECKED'});
  const parsed = parse(report);
  assert.equal(parsed.protocol.amountInRaw, '90071992547409935');
  assert.equal(parsed.protocol.amountOutRaw, '18446744073709551617');
  assert.equal(parsed.blockNumber, '0x80');
  assert.equal(parsed.protocol.logIndices.swap, '0x19');
  assert.equal(parsed.verificationMode, 'OFFLINE_REPLAY');
  assert.equal(evidenceDescription(parsed).synthetic, true);
  report.protocol.amountInRaw = 500;
  assert.throws(() => parse(report), /raw amounts/);
});

test('inspector rejects incomplete protocol fields and unsupported provenance claims', () => {
  for (const field of ['profile','pool','tokenIn','amountOutRaw','logIndices']) {
    const report = evaluateReceiptBundle(rpcFixture(), policyFixture()); delete report.protocol[field];
    assert.throws(() => parse(report), /complete supported receipt profile/);
  }
  for (const fields of [{verificationMode:'LIVE_VERIFIED'}, {policySource:'AUTHENTICATED_INTENT'}, {sourceTrust:'CONSENSUS_PROOF'}, {observationFinality:'FINALIZED'}, {protocol:{profile:'OTHER'}}]) assert.throws(() => parse({...baseline(),...fields}));
  const report = evaluateReceiptBundle(rpcFixture(), policyFixture()); report.protocol.logIndices.swap = 25;
  assert.throws(() => parse(report), /logIndices/);
});

test('inspector refuses missing, malformed, or unsupported report fields', () => {
  for (const field of ['schemaVersion','evidenceClass','transactionHash','execution','support','coverage','verdict','checks','limitations']) {
    const report = baseline(); delete report[field];
    assert.throws(() => parse(report), undefined, field);
  }
  for (const fields of [{transactionHash:'0x1234'}, {execution:'OK'}, {support:'TRUSTED'}, {verdict:'APPROVED'}, {checks:null}, {limitations:'none'}, {schemaVersion:'aftercheck.bundle.v1'}, {unexpected:true}, {checks:[{id:'x',result:'PASS',reason:'ok',html:'unsafe'}]}]) {
    assert.throws(() => parse({...baseline(),...fields}));
  }
});

test('inspector rejects contradictory green or violation reports', () => {
  for (const fields of [{execution:'REVERTED'}, {support:'UNSUPPORTED'}, {coverage:'PARTIAL'}, {coverage:'CONFLICTED'}, {checks:[]}, {checks:[{id:'x',result:'UNKNOWN',reason:'missing'}]}]) {
    assert.throws(() => parse({...baseline(),...fields}), /Contradictory PASS/);
  }
  assert.throws(() => parse({...baseline(),verdict:'VIOLATION'}), /Contradictory VIOLATION/);
  const violation = evaluate(observation, {...policy,maxInputRaw:'499'});
  assert.throws(() => parse({...violation,coverage:'CONFLICTED'}), /Contradictory VIOLATION/);
});

test('inspector rejects duplicate keys including escaped names and unsafe nested keys', () => {
  const source = JSON.stringify(baseline());
  assert.throws(() => parseReport(source.replace('"verdict":"PASS"', '"verdict":"UNKNOWN","verdict":"PASS"')), /Duplicate/);
  assert.throws(() => parseReport(source.replace('"verdict":"PASS"', '"verdict":"UNKNOWN","\\u0076erdict":"PASS"')), /Duplicate/);
  for (const key of ['__proto__','constructor','prototype']) {
    assert.throws(() => parseReport(source.slice(0,-1)+',"protocol":{"'+key+'":{}}}'), /Unsafe/);
  }
  const report = baseline(); report.checks.push(report.checks[0]);
  assert.throws(() => parse(report), /Duplicate check/);
});

test('inspector bounds report size, nesting, check count, and unsafe numbers', () => {
  assert.throws(() => parseReport(' '.repeat(2*1024*1024+1)), /2 MiB/);
  assert.throws(() => parseReport('['.repeat(34)+'0'+']'.repeat(34)), /depth limit/);
  const report = baseline(); report.checks = Array.from({length:513}, (_,i) => ({id:String(i),result:'PASS',reason:'example'}));
  assert.throws(() => parse(report), /512/);
  assert.throws(() => parse({...baseline(),chainId:9007199254740992}), /safe integers/);
  assert.throws(() => parseReport('{"chainId":1e999}'), /safe integers/);
});

test('hostile markup remains report text and the page has no network or HTML injection sinks', () => {
  const hostile = '<img src="https://example.invalid/leak" onerror="alert(1)"><script>alert(2)</script>';
  const report = baseline(); report.checks[0].reason = hostile; report.limitations.push(hostile);
  const parsed = parse(report);
  assert.equal(parsed.checks[0].reason, hostile);
  assert.equal(parsed.limitations.at(-1), hostile);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(/);
  assert.doesNotMatch(html, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/);
  assert.doesNotMatch(html, /<(?:script|link|img|iframe)\b[^>]*(?:src|href)\s*=/i);
  const styles = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.doesNotMatch(styles, /@import\b|\burl\s*\(/i);
});

test('inspector parser rejects malformed serialized input without accepting a trailing value', () => {
  for (const source of ['', 'null', '[]', '{', '{"x":1,}', '[1,]', JSON.stringify(baseline())+'{}']) assert.throws(() => parseReport(source));
});
