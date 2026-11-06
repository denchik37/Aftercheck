import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {verifyEvidence} from '../src/verify.ts';
import {canonicalJson} from '../src/json.ts';

const root = new URL('../', import.meta.url);
const web = new URL('web/', root);
const html = readFileSync(new URL('inspector.html', web), 'utf8');
const read = path => readFileSync(new URL(path, root), 'utf8');
const appSpec = read('.do/app.yaml');
const deployTemplate = read('.do/deploy.template.yaml');
const cases = [
  ['pass', 'pass', 'PASS', 'COMPLETE', null],
  ['input-cap-violation', 'violation', 'VIOLATION', 'COMPLETE', 'maxInputRaw'],
  ['output-threshold-violation', 'output-threshold', 'VIOLATION', 'COMPLETE', 'minReceivedRaw'],
  ['reserve-unknown', 'reserve', 'UNKNOWN', 'PARTIAL', 'reserveFloorRaw']
];

test('public sample downloads match fresh verifier results and load in the actual inspector parser', () => {
  const evidence = JSON.parse(read('examples/sepolia/evidence.json'));
  const context = vm.createContext({TextEncoder});
  const parser = html.match(/<script id="report-parser">([\s\S]*?)<\/script>/)[1];
  new vm.Script(parser + '\nglobalThis.parseReport = AftercheckReports.parseReport;').runInContext(context);
  for (const [name, policyName, verdict, coverage, attention] of cases) {
    const policy = JSON.parse(read('examples/sepolia/policy-' + policyName + '.json'));
    const fresh = verifyEvidence(evidence, policy);
    const saved = read('web/samples/' + name + '.json');
    assert.equal(saved, canonicalJson(fresh) + '\n', name + ' must not contain hand-edited or stale results');
    const report = context.parseReport(saved);
    assert.deepEqual([report.execution, report.support, report.coverage, report.verdict],
      ['SUCCEEDED', 'SUPPORTED', coverage, verdict]);
    assert.equal(report.evidenceClass, 'RPC_RECEIPT');
    assert.equal(report.policySource, 'SUPPLIED_RETROSPECTIVE');
    assert.equal(report.evidenceDigest, evidence.digest);
    assert.equal(report.transactionHash, evidence.transactionHash);
    if (attention) assert.ok(report.checks.some(check => check.id === attention && check.result === verdict));
    assert.match(html, new RegExp('href="samples/' + name + '\\.json" download="aftercheck-' + name + '\\.json"'));
  }
});

test('static publication includes only the standalone viewer and allowlisted public report bytes', () => {
  const published = [];
  function walk(dir, prefix = '') {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const path = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'A public asset must not escape the web root via a symlink');
      if (entry.isDirectory()) walk(new URL(entry.name + '/', dir), path + '/');
      else { assert.ok(entry.isFile()); published.push(path); }
    }
  }
  walk(web);
  assert.deepEqual(published.sort(), ['inspector.html', ...cases.map(([name]) => 'samples/' + name + '.json')].sort());
  // Asset budget also catches accidental inclusion of evidence archives or vendor bundles.
  const bytes = published.reduce((sum, path) => sum + readFileSync(new URL(path, web)).length, 0);
  assert.ok(bytes < 128 * 1024, 'Keep this static viewer and its four small reports below 128 KiB');
  assert.match(html, /LOCAL REPORTS · NO UPLOADS/);
  assert.match(html, /Hosted page and public sample downloads use the network/);
  assert.match(html, /Importing a saved report processes its contents on this device without uploading them/);
});

test('the public sample generator checks committed artifacts with networking disabled', () => {
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning', '--experimental-strip-types',
    fileURLToPath(new URL('scripts/public-samples.mjs', root)), '--check'
  ], {cwd: fileURLToPath(root), encoding: 'utf8', timeout: 30_000});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Public samples verified: 4/);
  assert.match(read('scripts/public-samples.mjs'), /import '\.\/offline-guard\.mjs'/);
});

test('DigitalOcean launch files describe the same static-only manual release', () => {
  for (const spec of [appSpec, deployTemplate]) {
    assert.match(spec, /name: aftercheck/);
    assert.match(spec, /static_sites:/);
    assert.match(spec, /name: inspector/);
    assert.match(spec, /branch: main/);
    assert.match(spec, /deploy_on_push: false/);
    assert.match(spec, /source_dir: web/);
    assert.match(spec, /output_dir: \./);
    assert.match(spec, /index_document: inspector\.html/);
    assert.doesNotMatch(spec, /^\s*(services|workers|jobs|functions|databases):/m);
  }
  assert.match(appSpec, /repo: denchik37\/aftercheck/);
  assert.match(deployTemplate, /^spec:/);
  assert.match(deployTemplate, /repo_clone_url: https:\/\/github\.com\/denchik37\/aftercheck\.git/);
});
