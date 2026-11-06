import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {verifyEvidence} from '../src/verify.ts';
import {canonicalJson} from '../src/json.ts';

const root = new URL('../', import.meta.url);
const web = new URL('web/', root);
const html = readFileSync(new URL('report-viewer.html', web), 'utf8');
const workspace = readFileSync(new URL('inspector.html', web), 'utf8');
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

test('static publication includes only reviewed browser modules, genuine evidence, and viewer assets', () => {
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
  const manifest = JSON.parse(read('web/assets/browser-build.json'));
  const approvedModules = ['browser-engine', 'json-codec', 'evidence-core', 'verify-core', 'uniswap',
    'policy', 'values', 'report', 'amounts', 'browser-export', 'browser-workspace', 'token-precision'];
  const approvedAssets = approvedModules.map(name => 'assets/' + name + '.js');
  assert.deepEqual(manifest.assets.map(asset => asset.path).sort(), approvedAssets.sort());
  assert.deepEqual(published.sort(), ['inspector.html', 'workspace.css', 'report-viewer.html', 'evidence/sepolia.json',
    'assets/browser-build.json', ...approvedAssets, ...cases.map(([name]) => 'samples/' + name + '.json')].sort());
  // Deliberate budgets include the 184 kB retained capture and a small native ES-module graph.
  const bytes = published.reduce((sum, path) => sum + readFileSync(new URL(path, web)).length, 0);
  assert.ok(bytes < 512 * 1024, 'Keep the complete static workspace below 512 KiB');
  assert.ok(readFileSync(new URL('evidence/sepolia.json', web)).length < 256 * 1024);
  for (const asset of manifest.assets) {
    const data = readFileSync(new URL(asset.path, web));
    assert.equal(data.length, asset.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
    assert.ok(data.length < 128 * 1024, 'No oversized runtime module: ' + asset.path);
  }
  assert.deepEqual(readFileSync(new URL('evidence/sepolia.json', web)),
    readFileSync(new URL('examples/sepolia/evidence.json', root)), 'Publish the original capture bytes unchanged');
  assert.equal(createHash('sha256').update(html).digest('hex'),
    '8fc5fef9b8ea2e52cd9448e1b5d32efc4c41f2f6b8f395260957031d5dcd958a',
    'Keep the previously deployed standalone report viewer byte-for-byte as the fallback');
  assert.match(html, /LOCAL REPORTS · NO UPLOADS/);
  assert.match(html, /Hosted page and public sample downloads use the network/);
  assert.match(html, /Importing a saved report processes its contents on this device without uploading them/);
});

test('browser workspace restricts networking and keeps imported values inert', () => {
  const csp = workspace.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  for (const value of ["default-src 'none'", "script-src 'self'", "connect-src 'self'",
    "object-src 'none'", "form-action 'none'", "base-uri 'none'"]) assert.ok(csp.includes(value), value);
  assert.doesNotMatch(workspace, /<iframe\b|<(?:script|link|img)\b[^>]*(?:src|href)="https?:/i);
  const source = read('src/browser-workspace.ts');
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|sendBeacon|XMLHttpRequest|WebSocket|EventSource)\b/);
  assert.doesNotMatch(source, /ethereum\.request|requestAccounts|eth_sendTransaction|wallet_/);
});

test('committed browser assets reproduce from the exact pinned compiler and reviewed source graph', () => {
  const result = spawnSync(process.execPath, ['scripts/build-browser.mjs', '--check'],
    {cwd: fileURLToPath(root), encoding: 'utf8', timeout: 30_000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Verified .* browser assets/);
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
    assert.match(spec, /source_dir: web/);
    assert.match(spec, /output_dir: \./);
    assert.match(spec, /index_document: inspector\.html/);
    assert.doesNotMatch(spec, /^\s*(services|workers|jobs|functions|databases):/m);
  }
  assert.match(appSpec, /deploy_on_push: false/);
  assert.match(appSpec, /repo: denchik37\/aftercheck/);
  assert.match(deployTemplate, /^spec:/);
  assert.doesNotMatch(deployTemplate, /deploy_on_push:/);
  assert.match(deployTemplate, /repo_clone_url: https:\/\/github\.com\/denchik37\/aftercheck\.git/);
});
