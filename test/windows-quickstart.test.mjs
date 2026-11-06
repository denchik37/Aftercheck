import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {canonicalJson} from '../src/json.ts';
import {parsePolicy} from '../src/policy.ts';
import {renderMarkdown} from '../src/report.ts';
import {verifyEvidence} from '../src/verify.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['evidence.json', 'policy.json', 'report.json', 'report.md'];
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

// Exercise the unpacked application's runtime, with no .git or node_modules,
// from a directory containing spaces. This does not test downloading a ZIP.
async function portableCopy(t) {
  const temporary = await mkdtemp(join(tmpdir(), 'aftercheck Windows '));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  const working = join(temporary, 'checkout with spaces');
  for (const name of ['package.json', 'bin', 'src', 'scripts/offline-guard.mjs',
    'scripts/check-public-example-inspection.mjs', 'examples/sepolia', 'web/report-viewer.html']) {
    const destination = join(working, name);
    await mkdir(dirname(destination), {recursive: true});
    await cp(join(root, name), destination, {recursive: true});
  }
  return working;
}

function replay(working, policy, output) {
  const env = {...process.env};
  delete env.AFTERCHECK_RPC_URL;
  // --import takes an ESM specifier: a native Windows drive path is not a URL.
  const guard = pathToFileURL(join(working, 'scripts/offline-guard.mjs')).href;
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--import', guard,
    join(working, 'bin/aftercheck.mjs'), 'verify', join('examples', 'sepolia', 'evidence.json'), policy, output
  ], {cwd: working, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 64_000});
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

test('Windows quickstart is reachable and its PowerShell examples use the safe npm entry point', async () => {
  const readme = await readFile(join(root, 'README.md'), 'utf8');
  const guide = await readFile(join(root, 'docs/WINDOWS_QUICKSTART.md'), 'utf8');
  assert.match(readme, /\]\(docs\/WINDOWS_QUICKSTART\.md\)/);
  const commands = [...guide.matchAll(/```powershell\s*\r?\n([\s\S]*?)```/g)].map(match => match[1]).join('\n');
  assert.match(commands, /npm\.cmd ci --ignore-scripts --no-audit --no-fund/);
  assert.match(commands, /npm\.cmd run verify/);
  assert.match(commands, /npm\.cmd run demo/);
  assert.doesNotMatch(commands, /^\s*(?:&\s+)?npm(?:\s|$)/m, 'PowerShell should invoke npm.cmd, not npm.ps1');
  assert.doesNotMatch(commands, /\bSet-ExecutionPolicy\b/i, 'onboarding must not change execution policy');
  const evidence = await readJson(join(root, 'examples/sepolia/evidence.json'));
  assert.ok(guide.includes(evidence.transactionHash), 'the guide must use the retained historical transaction');
  for (const name of ['package.json', 'web/report-viewer.html', 'examples/sepolia/evidence.json',
    'examples/sepolia/policy-pass.json', 'examples/sepolia/policy-violation.json', 'examples/sepolia/policy-reserve.json']) {
    assert.ok((await stat(join(root, name))).isFile(), name);
  }
});

test('portable operator replay works from a path with spaces and publishes consistent real reports', async t => {
  const working = await portableCopy(t);
  await assert.rejects(stat(join(working, '.git')), {code: 'ENOENT'});
  await assert.rejects(stat(join(working, 'node_modules')), {code: 'ENOENT'});
  const retained = await readJson(join(working, 'examples/sepolia/evidence.json'));
  for (const [name, code, verdict, coverage, output] of [
    ['pass', 0, 'PASS', 'COMPLETE', join('output', 'offline-pass')],
    ['violation', 2, 'VIOLATION', 'COMPLETE', join('output', 'demo', 'violation')],
    ['reserve', 3, 'UNKNOWN', 'PARTIAL', join('output', 'demo', 'reserve')]
  ]) {
    const policyPath = join('examples', 'sepolia', `policy-${name}.json`);
    const result = replay(working, policyPath, output);
    assert.equal(result.status, code, result.stderr);
    assert.ok(result.stdout.includes(`execution=SUCCEEDED support=SUPPORTED evidence=${coverage} verdict=${verdict}`));
    const directory = join(working, output);
    assert.ok(result.stdout.includes(directory), 'the CLI must print the resolved output directory');
    assert.deepEqual((await readdir(directory)).sort(), files);
    const evidence = await readJson(join(directory, 'evidence.json'));
    const policy = await readJson(join(directory, 'policy.json'));
    const reportText = await readFile(join(directory, 'report.json'), 'utf8');
    const report = JSON.parse(reportText);
    assert.deepEqual(evidence, retained, 'all policies must preserve the same historical evidence');
    assert.deepEqual(policy, parsePolicy(await readJson(join(working, policyPath))));
    assert.equal(reportText, canonicalJson(verifyEvidence(evidence, policy)) + '\n');
    assert.equal(await readFile(join(directory, 'report.md'), 'utf8'), renderMarkdown(report));
    assert.deepEqual([report.execution, report.support, report.coverage, report.verdict],
      ['SUCCEEDED', 'SUPPORTED', coverage, verdict]);
    assert.equal(report.transactionHash, retained.transactionHash);
    assert.equal(report.evidenceClass, 'RPC_RECEIPT');
    assert.equal(report.evidenceDigest, retained.digest);
    assert.equal(report.verificationMode, 'OFFLINE_REPLAY');
    assert.equal(report.policySource, 'SUPPLIED_RETROSPECTIVE');
    assert.equal(report.observationFinality, 'NOT_CHECKED');
    if (name === 'violation') assert.equal(report.checks.find(check => check.id === 'maxInputRaw').result, 'VIOLATION');
    if (name === 'reserve') assert.equal(report.checks.find(check => check.id === 'reserveFloorRaw').result, 'UNKNOWN');
  }
  const consistency = spawnSync(process.execPath, [
    '--import', pathToFileURL(join(working, 'scripts/offline-guard.mjs')).href,
    join(working, 'scripts/check-public-example-inspection.mjs'), join('output', 'offline-pass')
  ], {cwd: working, encoding: 'utf8', timeout: 15_000});
  assert.ifError(consistency.error);
  assert.equal(consistency.status, 0, consistency.stderr);
});

test('an operator command failure warns about and preserves earlier reports, without creating fresh output', async t => {
  const working = await portableCopy(t);
  const output = join('output', 'inspection');
  const initial = replay(working, join('examples', 'sepolia', 'policy-pass.json'), output);
  assert.equal(initial.status, 0, initial.stderr);
  const snapshot = async () => Promise.all(files.map(async name => {
    const path = join(working, output, name);
    return [name, await readFile(path, 'utf8'), (await stat(path)).mtimeMs];
  }));
  const previous = await snapshot();
  const invalidPolicy = 'invalid policy.json';
  await writeFile(join(working, invalidPolicy), '{not JSON}');
  const failure = replay(working, invalidPolicy, output);
  assert.equal(failure.status, 1, failure.stderr);
  assert.match(failure.stderr, /No new complete output was published/);
  assert.match(failure.stderr, /Existing output, if any, belongs to an earlier run/);
  assert.deepEqual(await snapshot(), previous, 'old contents and modification times must remain unchanged');
  const fresh = join('output', 'new inspection attempt');
  assert.equal(replay(working, invalidPolicy, fresh).status, 1);
  await assert.rejects(stat(join(working, fresh)), {code: 'ENOENT'});
});
