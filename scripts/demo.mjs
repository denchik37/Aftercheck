import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readJsonFile} from '../src/io.ts';

// Reproduce three retrospective policies against one unchanged historical
// Sepolia capture. No live collection, wallet, endpoint or signing is involved.
const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = join(root, 'examples/sepolia/evidence.json');
const cli = join(root, 'bin/aftercheck.mjs');
// --import expects an ESM specifier, including a file URL on Windows.
const guard = new URL('./offline-guard.mjs', import.meta.url).href;
const cases = [
  {name: 'pass', code: 0, verdict: 'PASS'},
  {name: 'violation', code: 2, verdict: 'VIOLATION'},
  {name: 'reserve', code: 3, verdict: 'UNKNOWN'}
];

try {
  if (process.argv.length !== 2) throw new Error('DEMO_TAKES_NO_ARGUMENTS');
  let digest;
  console.log('Historical Sepolia RPC observations; policies are supplied retrospectively.');
  console.log('Replay runs with fetch and common Node networking entry points disabled.');
  for (const item of cases) {
    const output = join(root, 'output/demo', item.name);
    const result = spawnSync(process.execPath, [
      '--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--import', guard,
      cli, 'verify', evidence, join(root, `examples/sepolia/policy-${item.name}.json`), output
    ], {cwd: root, encoding: 'utf8', timeout: 15_000, maxBuffer: 64_000});
    if (result.error || result.signal || result.status !== item.code) {
      throw new Error(`DEMO_${item.name.toUpperCase()}_UNEXPECTED_EXIT`);
    }
    const report = await readJsonFile(join(output, 'report.json'));
    if (report.verdict !== item.verdict || report.execution !== 'SUCCEEDED' ||
        report.support !== 'SUPPORTED' || report.evidenceClass !== 'RPC_RECEIPT' ||
        report.coverage !== (item.name === 'reserve' ? 'PARTIAL' : 'COMPLETE')) {
      throw new Error(`DEMO_${item.name.toUpperCase()}_UNEXPECTED_REPORT`);
    }
    if (digest !== undefined && report.evidenceDigest !== digest) throw new Error('DEMO_EVIDENCE_CHANGED');
    digest = report.evidenceDigest;
    console.log(`${item.name}: ${report.execution} / ${report.support} / ${report.coverage} / ${report.verdict} (CLI exit ${result.status})`);
    console.log(`  output/demo/${item.name}/report.json and report.md`);
  }
  console.log(`Same evidence digest for every policy: ${digest}`);
  console.log('Open web/report-viewer.html locally and import one generated report.json.');
  console.log('PASS concerns receipt-emitted amounts; reserve state, consensus and finality are not proved.');
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : 'DEMO_FAILED';
  console.error(`Demo failed: ${code}. Existing output may belong to an earlier run.`);
  process.exitCode = 1;
}
