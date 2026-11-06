#!/usr/bin/env node
import './offline-guard.mjs';
import {realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {readJsonFile} from '../src/io.ts';
import {canonicalJson} from '../src/json.ts';
import {renderMarkdown} from '../src/report.ts';
import {writeOutputDirectory} from '../src/output.ts';
import {
  consumeCorroboration, renderCorroborationMarkdown,
  MAX_CRE_MANIFEST_BYTES, MAX_CRE_RESULT_BYTES
} from '../src/corroboration.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
async function physicalPath(path) {
  const full = resolve(path);
  try { return await realpath(full); }
  catch (error) {
    if (error.code !== 'ENOENT' || dirname(full) === full) throw error;
    return join(await physicalPath(dirname(full)), basename(full));
  }
}

let phase = 'ARGUMENTS';
try {
  const args = process.argv.slice(2);
  if (args.length < 4 || args.length > 5 || args.some(arg => arg.length === 0)) {
    throw new Error('CRE_CONSUME_INVALID_ARGUMENTS');
  }
  const [evidencePath, policyPath, manifestPath, resultPath] = args;
  const output = args[4] ? resolve(args[4]) : join(root, 'output/cre-corroboration');
  phase = 'CHECK_OUTPUT_PATHS';
  const inputs = await Promise.all(args.slice(0, 4).map(path => realpath(path)));
  const destinations = await Promise.all(['core', 'corroboration'].map(name => physicalPath(join(output, name))));
  for (const destination of destinations) {
    for (const input of inputs) {
      const path = relative(destination, input);
      if (!isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep)) {
        throw new Error('CRE_OUTPUT_OVERLAPS_INPUT');
      }
    }
  }
  phase = 'READ_INPUTS';
  const [evidence, policy, manifest, result] = await Promise.all([
    readJsonFile(evidencePath), readJsonFile(policyPath, 64_000),
    readJsonFile(manifestPath, MAX_CRE_MANIFEST_BYTES), readJsonFile(resultPath, MAX_CRE_RESULT_BYTES)
  ]);
  phase = 'VALIDATE_AND_COMPARE';
  const consumed = consumeCorroboration(evidence, policy, manifest, result);
  const json = value => canonicalJson(value) + '\n';
  const coreFiles = {'report.json': json(consumed.coreReport), 'report.md': renderMarkdown(consumed.coreReport)};
  const appendixFiles = {
    'report.json': json(consumed.appendix), 'report.md': renderCorroborationMarkdown(consumed.appendix)
  };
  // The input evidence and original report are never rewritten. Both output
  // directories use the existing safe publisher; publication is atomic per
  // directory, not a transaction spanning the two directories.
  phase = 'EXPORT_CORE_REPORT';
  await writeOutputDirectory(join(output, 'core'), coreFiles);
  phase = 'EXPORT_CORROBORATION';
  await writeOutputDirectory(join(output, 'corroboration'), appendixFiles);
  const external = consumed.appendix.externalCorroboration;
  console.log([
    'AFTERCHECK — OPTIONAL CRE CORROBORATION',
    `Transaction execution: ${consumed.coreReport.execution}`,
    `Protocol support: ${consumed.coreReport.support}`,
    `Evidence coverage: ${consumed.coreReport.coverage}`,
    `Financial-policy verdict: ${consumed.coreReport.verdict} (unchanged)`,
    `External pool identity: ${external.status}`,
    `Execution classification: ${external.metadata.executionMode}`,
    `Scenario: ${external.manifest.scenario}`,
    `Manifest HTTP fetch: ${external.observation.manifestFetch}`,
    'Result authenticity: self-reported local file; not an authenticated Chainlink or DON attestation.',
    ...(external.metadata.executionMode === 'UNIT_TEST' ? ['UNIT_TEST: this fixture is not an executed CRE CLI simulation.'] : []),
    ...(external.metadata.executionMode === 'RPC_REHEARSAL' ? ['RPC_REHEARSAL: direct RPC execution is not an executed CRE CLI simulation.'] : []),
    ...(external.manifest.scenario === 'INTENTIONAL_MISMATCH'
      ? ['INTENTIONAL_MISMATCH: deliberately changed test expectation, not original historical evidence.'] : []),
    `Original evidence pool: ${consumed.appendix.sourceBinding.recordedPool}`,
    `Compared expectation: ${external.manifest.call.expectedPool}`,
    `Observed pool: ${external.observedPool ?? 'UNAVAILABLE'}`,
    `Saved core/report.json, core/report.md, corroboration/report.json and corroboration/report.md under ${output}`,
    'Exit code describes external corroboration only; the independent financial-policy verdict is shown above.'
  ].join('\n'));
  process.exitCode = external.status === 'MATCH' ? 0 : external.status === 'MISMATCH' ? 2 : 3;
} catch (error) {
  // Imported JSON, credentials, provider responses and arbitrary error bodies
  // must never be printed as diagnostic text.
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : 'CRE_CONSUME_FAILED';
  console.error(`CRE corroboration failed during ${phase}: ${code}.`);
  console.error('Existing outputs may belong to an earlier run; output directories publish separately.');
  if (code === 'CRE_CONSUME_INVALID_ARGUMENTS') {
    console.error('Usage: node --experimental-strip-types scripts/cre-consume.mjs <evidence.json> <policy.json> <manifest.json> <cre-result.json> [outDir]');
  }
  if (code === 'OUTPUT_ROLLBACK_FAILED') console.error('Preserve the sibling .aftercheck-backup-* directory for recovery.');
  process.exitCode = 1;
}
