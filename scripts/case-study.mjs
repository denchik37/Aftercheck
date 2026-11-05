#!/usr/bin/env node
import './offline-guard.mjs';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {readJsonFile} from '../src/io.ts';
import {parseEvidence} from '../src/evidence.ts';
import {parsePolicy} from '../src/policy.ts';
import {verifyEvidence} from '../src/verify.ts';
import {canonicalJson, digestJson} from '../src/json.ts';
import {renderMarkdown} from '../src/report.ts';
import {writeOutputDirectory} from '../src/output.ts';

// These are assertions about the retained third-party case, not report values.
// Reports and every displayed financial quantity come from the actual verifier
// and validated policies. Neither policy authenticates the original trader's intent.
const expected = {
  transactionHash: '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9',
  evidenceDigest: '0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093',
  chainId: 11155111,
  amountInRaw: '1000000000000000000',
  amountOutRaw: '999496253769344460',
  minimumOutRaw: '1000000000000000000',
  shortfallRaw: 503746230655540n
};
const root = fileURLToPath(new URL('../', import.meta.url));
const example = name => join(root, 'examples/sepolia', name);
const json = value => canonicalJson(value) + '\n';
const requireCase = (condition, code) => { if (!condition) throw new Error(code); };
let phase = 'ARGUMENTS';

try {
  const args = process.argv.slice(2);
  requireCase(args.length <= 1 && (args.length === 0 || args[0].length > 0), 'CASE_STUDY_INVALID_ARGUMENTS');
  const outputRoot = args.length ? resolve(args[0]) : join(root, 'output/case-study');

  phase = 'READ_EVIDENCE';
  const evidence = parseEvidence(await readJsonFile(example('evidence.json')));
  requireCase(evidence.digest === expected.evidenceDigest &&
    evidence.transactionHash === expected.transactionHash && evidence.chainId === expected.chainId &&
    evidence.evidenceClass === 'RPC_RECEIPT', 'CASE_STUDY_EVIDENCE_CHANGED');
  phase = 'READ_PASS_POLICY';
  const passPolicy = parsePolicy(await readJsonFile(example('policy-pass.json'), 64_000));
  phase = 'READ_OUTPUT_POLICY';
  const outputPolicy = parsePolicy(await readJsonFile(example('policy-output-threshold.json'), 64_000));
  requireCase(outputPolicy.minReceivedRaw === expected.minimumOutRaw &&
    passPolicy.maxInputRaw === expected.amountInRaw && passPolicy.reserveFloorRaw === undefined &&
    canonicalJson(outputPolicy) === canonicalJson({...passPolicy, minReceivedRaw: outputPolicy.minReceivedRaw}),
  'CASE_STUDY_POLICY_CONTRAST_CHANGED');

  // Validate both complete results before publishing either directory. No new
  // report schema or example-specific substitute for the verifier is involved.
  const cases = [
    {name: 'pass', policy: passPolicy, verdict: 'PASS'},
    {name: 'output-threshold-violation', policy: outputPolicy, verdict: 'VIOLATION'}
  ];
  for (const item of cases) {
    phase = item.verdict === 'PASS' ? 'VERIFY_PASS' : 'VERIFY_OUTPUT_POLICY';
    item.report = verifyEvidence(evidence, item.policy);
    const report = item.report;
    requireCase(report.execution === 'SUCCEEDED' && report.support === 'SUPPORTED' &&
      report.coverage === 'COMPLETE' && report.verdict === item.verdict &&
      report.evidenceClass === 'RPC_RECEIPT' && report.verificationMode === 'OFFLINE_REPLAY' &&
      report.policySource === 'SUPPLIED_RETROSPECTIVE', 'CASE_STUDY_UNEXPECTED_REPORT');
    requireCase(report.transactionHash === evidence.transactionHash && report.chainId === evidence.chainId &&
      report.blockHash === evidence.block.hash && report.blockNumber === evidence.block.number &&
      report.transactionIndex === evidence.transaction.transactionIndex &&
      report.evidenceDigest === evidence.digest && report.policyDigest === digestJson(item.policy),
    'CASE_STUDY_REPORT_IDENTITY_CHANGED');
    requireCase(report.protocol?.amountInRaw === expected.amountInRaw &&
      report.protocol.amountOutRaw === expected.amountOutRaw && report.protocol.amountOutMinimumRaw === '0',
    'CASE_STUDY_AMOUNTS_CHANGED');
  }

  phase = 'CHECK_CONTRAST';
  const [pass, violation] = cases.map(item => item.report);
  requireCase(pass.policyDigest !== violation.policyDigest &&
    canonicalJson(pass.protocol) === canonicalJson(violation.protocol), 'CASE_STUDY_CONTRAST_NOT_ESTABLISHED');
  requireCase(pass.checks.length > 0 && pass.checks.every(check => check.result === 'PASS'),
    'CASE_STUDY_PASS_CHECKS_CHANGED');
  const failedChecks = violation.checks.filter(check => check.result !== 'PASS');
  requireCase(failedChecks.length === 1 && failedChecks[0].id === 'minReceivedRaw' &&
    failedChecks[0].result === 'VIOLATION', 'CASE_STUDY_VIOLATED_CHECK_CHANGED');
  const observed = BigInt(violation.protocol.amountOutRaw);
  const required = BigInt(outputPolicy.minReceivedRaw);
  const shortfall = required - observed;
  requireCase(shortfall === expected.shortfallRaw && observed >= BigInt(violation.protocol.amountOutMinimumRaw),
    'CASE_STUDY_SHORTFALL_CHANGED');

  phase = 'PREPARE_OUTPUT';
  const evidenceJson = json(evidence);
  for (const item of cases) {
    item.files = {
      'evidence.json': evidenceJson,
      'policy.json': json(item.policy),
      'report.json': json(item.report),
      'report.md': renderMarkdown(item.report)
    };
  }
  for (const item of cases) {
    phase = item.verdict === 'PASS' ? 'EXPORT_PASS' : 'EXPORT_OUTPUT_POLICY';
    // Atomic per case using the existing publisher; the two directories are
    // not one filesystem transaction. Never recursively replace the output root.
    await writeOutputDirectory(join(outputRoot, item.name), item.files);
  }

  console.log([
    'AFTERCHECK — REAL TRANSACTION / RETROSPECTIVE POLICY CASE', '',
    `Network: Ethereum Sepolia (chain ID ${pass.chainId})`,
    `Transaction: ${pass.transactionHash}`,
    `Evidence digest: ${pass.evidenceDigest}`, '',
    `Onchain execution (both cases): ${pass.execution}`,
    `Protocol support (both cases): ${pass.support}`,
    `Evidence coverage (both cases): ${pass.coverage} (supported receipt-scoped checks)`, '',
    `Input token: ${pass.protocol.tokenIn}`,
    `Output token: ${pass.protocol.tokenOut}`,
    `Observed input: ${pass.protocol.amountInRaw} raw input-token units`,
    `Observed output: ${pass.protocol.amountOutRaw} raw output-token units`,
    `Router-encoded minimum output: ${pass.protocol.amountOutMinimumRaw} raw output-token units`, '',
    'CASE A — Existing supplied retrospective policy',
    `Input cap: ${passPolicy.maxInputRaw} raw input-token units`,
    `Required output: ${passPolicy.minReceivedRaw} raw output-token units`,
    `Financial verdict: ${pass.verdict}`,
    `Policy digest: ${pass.policyDigest}`, '',
    'CASE B — Stricter retrospective output requirement',
    `Input cap: ${outputPolicy.maxInputRaw} raw input-token units`,
    `Required output: ${required} raw output-token units`,
    `Observed output: ${observed} raw output-token units`,
    `Difference (shortfall): ${shortfall} raw output-token units`,
    `Financial verdict: ${violation.verdict}`,
    `Violated check: ${failedChecks[0].id}`,
    `Policy digest: ${violation.policyDigest}`, '',
    'The transaction succeeded onchain; the stricter retrospective financial policy was not satisfied.',
    "This does not establish the original trader's intent or a real historical financial loss.",
    'Quantities are receipt-emitted amounts under the supported plain-token assumption.',
    'Reserves, full balance effects, consensus and finality are not proved.',
    'Aftercheck reports findings; it does not stop other systems, undo a swap or recover funds.', '',
    `Saved evidence.json, policy.json, report.json and report.md in each of:`,
    ...cases.map(item => `  ${join(outputRoot, item.name)}`),
    'Open web/inspector.html locally and import either report.json.',
    'Case-study exit 0 means the expected contrast was reproduced; verifier VIOLATION remains exit 2.'
  ].join('\n'));
} catch (error) {
  // Do not emit imported text, filesystem paths or arbitrary exception bodies.
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : 'CASE_STUDY_FAILED';
  console.error(`Case study failed during ${phase}: ${code}.`);
  console.error('Existing output may belong to an earlier run; the two case directories are published separately.');
  if (code === 'CASE_STUDY_INVALID_ARGUMENTS') console.error('Usage: node scripts/case-study.mjs [output-root]');
  if (code === 'OUTPUT_ROLLBACK_FAILED') console.error('Preserve the sibling .aftercheck-backup-* directory under previous for recovery.');
  process.exitCode = 1;
}
