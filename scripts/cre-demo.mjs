import './offline-guard.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readJsonFile} from '../src/io.ts';
import {canonicalJson} from '../src/json.ts';
import {verifyEvidence} from '../src/verify.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const cases = [
  {name: 'match', observation: 'rpc-reference', manifest: 'reference', policy: 'pass', status: 'MATCH', verdict: 'PASS', exit: 0},
  {name: 'violation', observation: 'rpc-reference', manifest: 'reference', policy: 'violation', status: 'MATCH', verdict: 'VIOLATION', exit: 0},
  {name: 'reserve', observation: 'rpc-reference', manifest: 'reference', policy: 'reserve', status: 'MATCH', verdict: 'UNKNOWN', exit: 0},
  {name: 'mismatch', observation: 'rpc-intentional-mismatch', manifest: 'intentional-mismatch', policy: 'pass', status: 'MISMATCH', verdict: 'PASS', exit: 2},
  {name: 'unavailable', observation: 'rpc-unavailable', manifest: 'reference', policy: 'pass', status: 'UNAVAILABLE', verdict: 'PASS', exit: 3},
];

try {
  if (process.argv.length !== 2) throw new Error('CRE_DEMO_TAKES_NO_ARGUMENTS');
  console.log('OFFLINE REPLAY OF RETAINED RPC_REHEARSAL — not a live CRE simulation.');
  console.log('Recorded public HTTP/RPC observations are revalidated locally; no new chain read occurs.');
  console.log('Fetch and common Node networking entry points are disabled (a rehearsal guard, not an OS sandbox).');
  const evidence = await readJsonFile(join(root, 'examples/sepolia/evidence.json'));
  for (const item of cases) {
    const output = join(root, 'output/cre-demo', item.name);
    const policyPath = join(root, `examples/sepolia/policy-${item.policy}.json`);
    const proc = spawnSync(process.execPath, [
      '--disable-warning=ExperimentalWarning', '--experimental-strip-types',
      join(root, 'scripts/cre-consume.mjs'), join(root, 'examples/sepolia/evidence.json'), policyPath,
      join(root, `integrations/cre/public/${item.manifest}.json`),
      join(root, `docs/evidence/cre/${item.observation}/result.json`), output,
    ], {cwd: root, encoding: 'utf8', timeout: 15_000, maxBuffer: 64_000, shell: false});
    if (proc.error || proc.signal || proc.status !== item.exit) throw new Error('CRE_DEMO_UNEXPECTED_EXIT');
    const core = await readJsonFile(join(output, 'core/report.json'));
    const appendix = await readJsonFile(join(output, 'corroboration/report.json'));
    const recomputed = verifyEvidence(evidence, await readJsonFile(policyPath));
    if (core.verdict !== item.verdict || canonicalJson(core) !== canonicalJson(recomputed) ||
        appendix.externalCorroboration.status !== item.status ||
        appendix.externalCorroboration.metadata.executionMode !== 'RPC_REHEARSAL' ||
        appendix.financialPolicyVerdict !== 'UNCHANGED') throw new Error('CRE_DEMO_UNEXPECTED_REPORT');
    console.log(`${item.name}: external ${item.status}; core ${item.verdict} (unchanged); consumer exit ${proc.status}`);
    if (item.manifest === 'intentional-mismatch') {
      console.log('  INTENTIONAL_MISMATCH: the expected pool was deliberately changed for a negative test; this is not a defect observed in the original capture.');
    }
    console.log(`  output/cre-demo/${item.name}/corroboration/report.md`);
  }
  console.log('5 retained cases replayed. Official CRE execution remains dependent on authentication and a successful simulator run.');
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.exec(error.message)?.[0] === error.message ? error.message : 'CRE_DEMO_FAILED';
  console.error(`CRE replay failed: ${code}. Existing output may belong to an earlier run.`);
  process.exitCode = 1;
}
