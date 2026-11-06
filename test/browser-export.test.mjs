import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createVerificationPackage, createStoreZip, MAX_EXPORT_FILE_BYTES, MAX_EXPORT_TOTAL_BYTES} from '../src/browser-export.ts';
import {verifyEvidenceAsync} from '../src/browser-engine.ts';
import {canonicalJson} from '../src/json.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidenceText = readFileSync(join(root, 'examples/sepolia/evidence.json'), 'utf8');
const evidence = JSON.parse(evidenceText);
const policy = name => JSON.parse(readFileSync(join(root, `examples/sepolia/policy-${name}.json`), 'utf8'));

test('export preserves exact evidence bytes, normalized policy and actual full browser report', async () => {
  const supplied = policy('pass');
  supplied.owner = '0x' + supplied.owner.slice(2).toUpperCase();
  const report = await verifyEvidenceAsync(evidence, supplied);
  const exported = await createVerificationPackage({evidenceText, policy: supplied, report, displayDecimals: {input: 18, output: 18}});
  assert.equal(exported.files['evidence.json'], evidenceText);
  assert.equal(exported.files['report.json'], canonicalJson(report) + '\n');
  const normalized = JSON.parse(exported.files['policy.json']);
  assert.equal(normalized.owner, supplied.owner.toLowerCase());
  const display = JSON.parse(exported.files['display-metadata.json']);
  assert.equal(display.input.decimals, 18);
  assert.equal(display.input.provenance, 'SOURCE_VERIFIED_PINNED_RUNTIME');
  assert.equal(display.output.provenance, 'SOURCE_VERIFIED_PINNED_RUNTIME');
  assert.equal(display.policyDigest, report.policyDigest);
  assert.match(exported.files['report.md'], /supplied retrospectively, not authenticated original intent/);
  assert.match(exported.files['README.txt'], /0 PASS; 2 VIOLATION; 3 UNKNOWN; 1 invalid input/);
  assert.match(exported.files['README.txt'], /CLI.*before going offline/);
  assert.deepEqual(exported.zip, (await createVerificationPackage({evidenceText, policy: supplied, report, displayDecimals: {input: 18, output: 18}})).zip);
});

test('export rejects stale or fabricated reports and changed evidence rather than patching verdict fields', async () => {
  const supplied = policy('pass');
  const report = await verifyEvidenceAsync(evidence, supplied);
  await assert.rejects(createVerificationPackage({evidenceText, policy: {...supplied, minReceivedRaw: '1000000000000000000'}, report}), /EXPORT_REPORT_MISMATCH/);
  await assert.rejects(createVerificationPackage({evidenceText, policy: supplied, report: {...report, verdict: 'VIOLATION'}}), /EXPORT_REPORT_MISMATCH/);
  await assert.rejects(createVerificationPackage({evidenceText, policy: supplied, report: {...report, unexpected: true}}), /EXPORT_REPORT_MISMATCH/);
  await assert.rejects(createVerificationPackage({evidenceText: evidenceText.replace(evidence.transactionHash, '0x' + '0'.repeat(64)), policy: supplied, report}), /DIGEST/);
  await assert.rejects(createVerificationPackage({evidenceText: '{"x":1,"x":2}', policy: supplied, report}), /DUPLICATE/);
});

test('user-supplied decimals remain unverified supplemental metadata without changing raw policy', async () => {
  const supplied = policy('pass');
  const report = await verifyEvidenceAsync(evidence, supplied);
  const exported = await createVerificationPackage({evidenceText, policy: supplied, report, displayDecimals: {input: 6, output: null}});
  const display = JSON.parse(exported.files['display-metadata.json']);
  assert.deepEqual(display.input, {address: supplied.tokenIn, decimals: 6, provenance: 'USER_SUPPLIED_UNVERIFIED'});
  assert.deepEqual(display.output, {address: supplied.tokenOut, decimals: null, provenance: 'RAW_UNITS'});
  assert.equal(exported.files['policy.json'], canonicalJson(supplied) + '\n');
  assert.equal(exported.files['report.json'], canonicalJson(report) + '\n');
  await assert.rejects(createVerificationPackage({evidenceText, policy: supplied, report, displayDecimals: {input: 256, output: 18}}), /Decimals/);
});

test('package creation snapshots policy, report and display values before asynchronous hashing', async () => {
  const supplied = policy('pass');
  const report = await verifyEvidenceAsync(evidence, supplied);
  const displayDecimals = {input: 18, output: 18};
  const pending = createVerificationPackage({evidenceText, policy: supplied, report, displayDecimals});
  supplied.minReceivedRaw = '1'; report.verdict = 'UNKNOWN'; displayDecimals.output = 6;
  const exported = await pending;
  assert.equal(JSON.parse(exported.files['report.json']).verdict, 'PASS');
  assert.equal(JSON.parse(exported.files['policy.json']).minReceivedRaw, '999000000000000000');
  assert.equal(JSON.parse(exported.files['display-metadata.json']).output.decimals, 18);
});

test('ZIP rejects paths, unexpected filenames, oversize UTF-8 content and lossy encoding', () => {
  for (const files of [{}, {'../policy.json': '{}'}, {'/policy.json': '{}'}, {'secret.txt': 'x'}, {'policy.json': 1}, {'policy.json': '\ud800'}]) {
    assert.throws(() => createStoreZip(files));
  }
  assert.throws(() => createStoreZip({'evidence.json': 'x'.repeat(MAX_EXPORT_FILE_BYTES + 1)}), /SIZE/);
  assert.throws(() => createStoreZip({'report.md': 'é'.repeat(MAX_EXPORT_FILE_BYTES / 2 + 1)}), /SIZE/);
  assert.throws(() => createStoreZip({'evidence.json': 'x'.repeat(MAX_EXPORT_TOTAL_BYTES / 2), 'report.json': 'x'.repeat(MAX_EXPORT_TOTAL_BYTES / 2), 'report.md': 'x'}), /SIZE/);
});

for (const [name, expectedCode, expectedVerdict] of [['pass', 0, 'PASS'], ['output-threshold', 2, 'VIOLATION'], ['violation', 2, 'VIOLATION'], ['reserve', 3, 'UNKNOWN']]) {
  test(`independent ZIP extraction and offline CLI reproduce browser ${name} package byte-for-byte`, async () => {
    const folder = mkdtempSync(join(tmpdir(), 'aftercheck-browser-export-'));
    try {
      const supplied = policy(name);
      const report = await verifyEvidenceAsync(evidence, supplied);
      const exported = await createVerificationPackage({evidenceText, policy: supplied, report, displayDecimals: {input: 18, output: 18}});
      const zipPath = join(folder, 'verification.zip');
      writeFileSync(zipPath, exported.zip);
      const unzip = spawnSync('python3', ['-c', [
        'import zipfile,sys',
        'with zipfile.ZipFile(sys.argv[1]) as z:',
        ' assert z.testzip() is None',
        ' assert len(z.namelist()) == 6',
        ' assert all(i.compress_type == zipfile.ZIP_STORED for i in z.infolist())',
        ' z.extractall(sys.argv[2])'
      ].join('\n'), zipPath, folder], {encoding: 'utf8', timeout: 15_000});
      assert.equal(unzip.status, 0, unzip.stderr);
      for (const [file, text] of Object.entries(exported.files)) assert.equal(readFileSync(join(folder, file), 'utf8'), text);
      const replay = spawnSync(process.execPath, ['--experimental-strip-types', '--import', resolve(root, 'scripts/offline-guard.mjs'), resolve(root, 'bin/aftercheck.mjs'), 'verify', join(folder, 'evidence.json'), join(folder, 'policy.json'), join(folder, 'replay')], {cwd: root, encoding: 'utf8', timeout: 15_000});
      assert.equal(replay.status, expectedCode, replay.stderr + replay.stdout);
      assert.equal(JSON.parse(readFileSync(join(folder, 'replay/report.json'), 'utf8')).verdict, expectedVerdict);
      assert.equal(readFileSync(join(folder, 'replay/report.json'), 'utf8'), exported.files['report.json']);
      assert.equal(readFileSync(join(folder, 'replay/report.md'), 'utf8'), exported.files['report.md']);
      assert.equal(readFileSync(join(folder, 'replay/policy.json'), 'utf8'), exported.files['policy.json']);
      assert.doesNotMatch(replay.stderr, /NETWORK_FORBIDDEN/);
    } finally { rmSync(folder, {recursive: true, force: true}); }
  });
}
