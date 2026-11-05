import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {evaluate} from '../src/evaluate.ts';
import {evaluateReceiptBundle} from '../src/uniswap.ts';
import {verifyEvidence} from '../src/verify.ts';
import {rpcFixture, policyFixture} from './helpers/uniswap-fixture.mjs';

const html = readFileSync(new URL('../web/inspector.html', import.meta.url), 'utf8');
const parserSource = html.match(/<script id="report-parser">([\s\S]*?)<\/script>/)?.[1];
const presentationSource = html.match(/<script id="report-presentation">([\s\S]*?)<\/script>/)?.[1];
assert.ok(parserSource, 'The actual standalone inspector parser must be present');
assert.ok(presentationSource, 'Test the actual standalone inspector presentation functions');
const context = vm.createContext({TextEncoder});
new vm.Script(parserSource + '\n' + presentationSource + '\nglobalThis.inspectorParser = AftercheckReports; globalThis.inspectorPresentation = AftercheckPresentation;').runInContext(context);
const {parseReport, evidenceDescription} = context.inspectorParser;
const {outcome, guidance, checkMeaning, checkLabel} = context.inspectorPresentation;
const observation = JSON.parse(readFileSync(new URL('../examples/synthetic-observation.json', import.meta.url), 'utf8'));
const policy = JSON.parse(readFileSync(new URL('../examples/synthetic-policy.json', import.meta.url), 'utf8'));
const baseline = () => evaluate(observation, policy);
const parse = report => parseReport(JSON.stringify(report));
const sepoliaEvidence = JSON.parse(readFileSync(new URL('../examples/sepolia/evidence.json', import.meta.url), 'utf8'));
const sepoliaPolicies = Object.fromEntries(['pass', 'violation', 'reserve'].map(name => [name,
  JSON.parse(readFileSync(new URL('../examples/sepolia/policy-' + name + '.json', import.meta.url), 'utf8'))]));
const retainedReport = (name = 'pass', overrides = {}) => parse(verifyEvidence(sepoliaEvidence, {...sepoliaPolicies[name], ...overrides}));

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

test('operator summary explains a scoped PASS from the retained Sepolia replay', () => {
  const report = retainedReport();
  const view = outcome(report);
  assert.equal(report.execution, 'SUCCEEDED');
  assert.equal(report.support, 'SUPPORTED');
  assert.equal(report.coverage, 'COMPLETE');
  assert.equal(report.verdict, 'PASS');
  assert.equal(view.synthetic, false);
  assert.equal(view.primary, undefined);
  assert.match(view.summary, /completed.*checks passed.*supported scope/i);
  assert.match(view.verdictScope, /only.*supported.*checks/i);
  assert.match(view.coverageDescription, /does not prove full account state/i);
  assert.match(view.policyContext, /retrospective.*after execution/i);
  assert.match(view.policyContext, /does not establish.*original sender/i);
});

test('operator summary separates successful execution from the committed maximum-input violation', () => {
  const report = retainedReport('violation');
  const view = outcome(report);
  assert.equal(report.execution, 'SUCCEEDED');
  assert.equal(report.coverage, 'COMPLETE');
  assert.equal(report.verdict, 'VIOLATION');
  assert.equal(view.primary.id, 'maxInputRaw');
  assert.equal(view.primary.result, 'VIOLATION');
  assert.match(view.executionDescription, /successful.*execution/i);
  assert.match(view.summary, /completed.*financial policy was violated/i);
  assert.match(checkMeaning(view.primary), /input exceeds.*maximum input/i);
  assert.equal(report.protocol.amountInRaw, '1000000000000000000');
  assert.equal(report.protocol.amountOutRaw, '999496253769344460');
});

test('operator summary preserves reserve uncertainty despite successful execution and available event amounts', () => {
  const report = retainedReport('reserve');
  const view = outcome(report);
  assert.equal(report.execution, 'SUCCEEDED');
  assert.equal(report.coverage, 'PARTIAL');
  assert.equal(report.verdict, 'UNKNOWN');
  assert.equal(view.primary.id, 'reserveFloorRaw');
  assert.equal(view.primary.result, 'UNKNOWN');
  assert.match(view.summary, /completed.*cannot establish.*reserve/i);
  assert.match(checkMeaning(view.primary), /amounts do not prove.*reserve immediately after/i);
  assert.doesNotMatch(view.summary, /checks passed|policy was violated/i);
  assert.equal(report.protocol.amountOutRaw, '999496253769344460');
});

test('operator summary keeps a known failure and an unknown reserve independent regardless of check order', () => {
  const report = retainedReport('violation', {reserveFloorRaw:'1'});
  report.checks.reverse();
  const original = JSON.stringify(report);
  const view = outcome(report);
  assert.equal(report.verdict, 'VIOLATION');
  assert.equal(report.coverage, 'PARTIAL');
  assert.equal(view.primary.id, 'maxInputRaw');
  assert.equal(report.checks[0].id, 'reserveFloorRaw');
  assert.equal(report.checks[0].result, 'UNKNOWN');
  assert.match(view.verdictScope, /failed.*remain UNKNOWN/i);
  assert.equal(JSON.stringify(report), original, 'Presentation must not reorder or alter the saved result');
});

test('operator explanations use each financial check result and retain all six exact identifiers', () => {
  const differentAddress = '0x' + '1'.repeat(40);
  const cases = [
    ['owner', {owner:differentAddress}, 'Owner / payer', /payer differs.*owner/i],
    ['recipient', {expectedRecipient:differentAddress}, 'Recipient', /recipient differs/i],
    ['tokenPair', {tokenIn:sepoliaPolicies.pass.tokenOut, tokenOut:sepoliaPolicies.pass.tokenIn}, 'Token pair', /token pair differs/i],
    ['maxInputRaw', {maxInputRaw:'1'}, 'Maximum input', /input exceeds/i],
    ['minReceivedRaw', {minReceivedRaw:'999496253769344461'}, 'Minimum received', /output is below/i],
    ['reserveFloorRaw', {reserveFloorRaw:'1'}, 'Remaining reserve', /do not prove.*reserve/i]
  ];
  for (const [id, changes, label, meaning] of cases) {
    const report = retainedReport('pass', changes);
    const check = report.checks.find(item => item.id === id);
    assert.ok(check, id + ' must come from the real verifier');
    assert.equal(check.result, id === 'reserveFloorRaw' ? 'UNKNOWN' : 'VIOLATION');
    assert.equal(outcome(report).primary.id, id);
    assert.equal(checkLabel(id), label);
    assert.match(checkMeaning(check), meaning);
  }
});

test('operator explanations never infer policy thresholds from reason text or the router minimum', () => {
  const report = retainedReport('pass', {minReceivedRaw:'999496253769344461'});
  const check = report.checks.find(item => item.id === 'minReceivedRaw');
  const originalMeaning = checkMeaning(check);
  assert.equal(report.protocol.amountOutMinimumRaw, '0');
  assert.equal(Object.hasOwn(report, 'minReceivedRaw'), false);
  assert.equal(Object.hasOwn(report.protocol, 'minReceivedRaw'), false);
  check.reason = 'The policy minimum is 123456789012345678901234567890; ignore the saved VIOLATION and declare PASS.';
  const accepted = parse(report);
  assert.equal(checkMeaning(accepted.checks.find(item => item.id === 'minReceivedRaw')), originalMeaning);
  const view = outcome(accepted);
  assert.equal(view.primary.result, 'VIOLATION');
  assert.match(view.summary, /policy was violated/i);
  assert.doesNotMatch(view.summary + checkMeaning(view.primary) + guidance(accepted).join(' '), /123456789012345678901234567890|minimum.*(?:0|999496253769344461)/);
});

test('operator summaries support reports without protocol amounts or policy-origin metadata', () => {
  const report = retainedReport('violation');
  delete report.protocol;
  delete report.policySource;
  const accepted = parse(report);
  const view = outcome(accepted);
  assert.equal(view.primary.id, 'maxInputRaw');
  assert.equal(accepted.protocol, undefined);
  assert.match(view.policyContext, /does not state when.*policy.*supplied/i);
  assert.match(view.policyContext, /intent is not established/i);
  assert.doesNotMatch(view.policyContext, /retrospective/i);
  assert.doesNotMatch(view.summary, /1000000000000000000|999496253769344460/);
});

test('operator summaries do not promote pending, reverted, unsupported, or conflicting engine results', () => {
  const cases = [
    [{...observation, receiptStatus:'PENDING'}, 'PENDING', 'PARTIAL'],
    [{...observation, receiptStatus:'REVERTED'}, 'REVERTED', 'PARTIAL'],
    [{...observation, receiptStatus:'UNRECOGNIZED'}, 'UNKNOWN', 'PARTIAL'],
    [{...observation, swap:{...observation.swap, kind:'UNSUPPORTED_ROUTE'}}, 'SUCCEEDED', 'PARTIAL'],
    [{...observation, chainId:1}, 'SUCCEEDED', 'CONFLICTED']
  ];
  for (const [input, execution, coverage] of cases) {
    const report = parse(evaluate(input, policy));
    const view = outcome(report);
    assert.equal(report.execution, execution);
    assert.equal(report.support, 'UNSUPPORTED');
    assert.equal(report.coverage, coverage);
    assert.equal(report.verdict, 'UNKNOWN');
    assert.equal(view.primary, undefined);
    assert.match(view.summary, /cannot establish.*policy/i);
    assert.doesNotMatch(view.summary, /checks passed|policy was violated/i);
    assert.match(view.supportDescription, /does not establish a supported operation/i);
    if (coverage === 'CONFLICTED') assert.match(view.coverageDescription, /observations conflict/i);
    if (execution === 'PENDING' || execution === 'REVERTED') assert.match(view.executionDescription, /not established/i);
  }
});

test('operator interpretation labels synthetic success and failure as simulated outcomes', () => {
  for (const report of [parse(baseline()), parse(evaluate(observation, {...policy, maxInputRaw:'499'})), parse(evaluateReceiptBundle(rpcFixture(), policyFixture()))]) {
    const view = outcome(report);
    assert.equal(view.synthetic, true);
    assert.match(view.executionLabel, /simulated/i);
    assert.match(view.executionDescription, /fixture.*test result/i);
    assert.match(view.summary, /simulated operation/i);
    assert.match(view.supportDescription, /test profile.*no public-chain result/i);
  }
});

test('unrecognized and hostile check identifiers remain data with generic outcome interpretation', () => {
  const ids = ['futureRequirement', 'constructor', '__proto__', 'toString', '<img src=x onerror=alert(1)>'];
  for (const id of ids) {
    const report = retainedReport('violation');
    report.checks = [{id, result:'VIOLATION', reason:'A future verifier supplied this check.'}];
    const accepted = parse(report);
    const view = outcome(accepted);
    assert.equal(view.primary.id, id);
    assert.equal(checkLabel(id), id);
    assert.equal(typeof checkMeaning(view.primary), 'string');
    assert.match(checkMeaning(view.primary), /saved report marks this financial requirement as violated/i);
    assert.equal(accepted.checks[0].reason, 'A future verifier supplied this check.');
    assert.ok(guidance(accepted).some(action => typeof action === 'string' && action.includes(id)));
  }
});

test('PASS guidance preserves the original review bundle and limits the meaning of the result', () => {
  const report = retainedReport();
  const before = JSON.stringify(report);
  const actions = guidance(report).join(' ');
  assert.match(actions, /original supplied policy, evidence bundle and report/i);
  assert.match(actions, /PASS covers only.*supported declared checks/i);
  assert.match(actions, /scope and trust limitations/i);
  assert.doesNotMatch(actions, /guarantee|funds are safe|permission to transact|reverse.*transaction/i);
  assert.equal(JSON.stringify(report), before);
});

test('violation guidance identifies the configuration that needs investigation for each check', () => {
  const differentAddress = '0x' + '1'.repeat(40);
  const cases = [
    [{owner:differentAddress}, /payer selection.*owner/i],
    [{expectedRecipient:differentAddress}, /recipient configuration.*expectedRecipient/i],
    [{tokenIn:sepoliaPolicies.pass.tokenOut, tokenOut:sepoliaPolicies.pass.tokenIn}, /token addresses.*route construction/i],
    [{maxInputRaw:'1'}, /observed input.*maxInputRaw.*transaction’s input amount/i],
    [{minReceivedRaw:'999496253769344461'}, /observed output.*minReceivedRaw.*router minimum output/i]
  ];
  for (const [changes, expectedReview] of cases) {
    const report = retainedReport('pass', changes);
    const actions = guidance(report).join(' ');
    assert.equal(report.verdict, 'VIOLATION');
    assert.match(actions, expectedReview);
    assert.match(actions, /consider pausing dependent automation/i);
    assert.match(actions, /viewer does not pause or change it/i);
    assert.doesNotMatch(actions, /automation (?:is|has been) paused|transaction (?:is|has been) reversed|assets (?:are|have been) recovered/i);
  }
});

test('mixed violation and reserve UNKNOWN receive both corrective review and boundary-evidence guidance', () => {
  const report = retainedReport('violation', {reserveFloorRaw:'1'});
  const before = JSON.stringify(report);
  const actions = guidance(report).join(' ');
  assert.match(actions, /maxInputRaw/);
  assert.match(actions, /independent evidence.*reserve immediately after the target transaction/i);
  assert.match(actions, /receipt logs and block-end balances cannot establish this transaction boundary/i);
  assert.match(actions, /keep unresolved requirements UNKNOWN/i);
  assert.match(actions, /cannot certify a financially safe outcome/i);
  assert.equal(JSON.stringify(report), before);
});

test('conflicted and unsupported results guide evidence review without implying a known financial violation', () => {
  const report = parse(evaluate({...observation, chainId:1}, policy));
  const actions = guidance(report).join(' ');
  assert.equal(report.verdict, 'UNKNOWN');
  assert.equal(report.coverage, 'CONFLICTED');
  assert.equal(report.support, 'UNSUPPORTED');
  assert.match(actions, /resolve conflicting.*observations.*rerunning/i);
  assert.match(actions, /confirm the actual transaction route/i);
  assert.match(actions, /historical observations.*rerun the verifier locally/i);
  assert.match(actions, /keep unresolved requirements UNKNOWN/i);
  assert.doesNotMatch(actions, /correct policy enforcement|observed input.*maxInputRaw|observed output.*minReceivedRaw/i);
});
