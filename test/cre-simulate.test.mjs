import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  RESULT_MARKER, bindManifestToPublicRevision, parsePublicManifestUrl, prepareFreshCreOutput,
  reconstructChunkedResult,
  sanitizeCreLog, validateSimulationOutput, verifySourceProvenance
} from '../scripts/cre-simulate.mjs';
import {CRE_RESULT_CHUNK_BYTES, CRE_RESULT_CHUNK_MARKER, canonicalJson, compareObservation, DEMO_TARGET, parseManifest} from '../integrations/cre/shared.ts';

const referenceText = await readFile(new URL('../integrations/cre/public/reference.json', import.meta.url), 'utf8');
const mismatchText = await readFile(new URL('../integrations/cre/public/intentional-mismatch.json', import.meta.url), 'utf8');
const manifest = parseManifest(referenceText);
const metadata = {executionMode: 'CRE_CLI_SIMULATION', workflowRevision: '1'.repeat(40),
  cliVersion: '1.39.0', sdkVersion: '1.23.0', rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'};
const observation = {
  availability: 'AVAILABLE', manifestFetch: 'VERIFIED', chainId: DEMO_TARGET.chainId,
  chainSelector: DEMO_TARGET.chainSelector, requestedBlockNumber: DEMO_TARGET.blockNumber,
  header: {blockNumber: DEMO_TARGET.blockNumber, blockHash: DEMO_TARGET.blockHash},
  call: {to: DEMO_TARGET.factory, data: DEMO_TARGET.calldata, blockNumber: DEMO_TARGET.blockNumber},
  returnData: '0x' + '0'.repeat(24) + DEMO_TARGET.pool.slice(2), errorCode: null
};
// These are parser fixtures. No test in this file represents execution of the CRE simulator.
const match = compareObservation(manifest, observation, metadata);
const captured = result => ({stdout: `[USER LOG] ${RESULT_MARKER}${canonicalJson(result)}\n`, stderr: '', exitCode: 0});
/** Models CRE's <=1KB log events, not a real CRE simulator execution. */
const capturedChunked = result => {
  const bytes = Buffer.from(canonicalJson(result), 'utf8');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const total = Math.ceil(bytes.length / CRE_RESULT_CHUNK_BYTES);
  const lines = [];
  for (let i = 0; i < total; i++) {
    const fragment = bytes.subarray(i * CRE_RESULT_CHUNK_BYTES, (i + 1) * CRE_RESULT_CHUNK_BYTES);
    lines.push(`[USER LOG] ${CRE_RESULT_CHUNK_MARKER}v1:${i + 1}/${total}:${digest}:${fragment.toString('hex')}`);
  }
  return {stdout: lines.join('\n') + '\n', stderr: '', exitCode: 0};
};
const url = (revision, name = 'reference') => `https://raw.githubusercontent.com/denchik37/aftercheck/${revision}/integrations/cre/public/${name}.json`;

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], {encoding: 'utf8', shell: false});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'aftercheck-cre-source-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const files = {
    '.gitignore': 'output/\naftercheck-output/\nnode_modules/\nintegrations/cre/workflow/config.json\n*.wasm\n*.js\nintegrations/cre/workflow/build/\nintegrations/cre/workflow/.cre_build_tmp.js\n',
    'integrations/cre/shared.ts': '// Test repository source.\n',
    'integrations/cre/config.ts': '// Test repository source.\n',
    'integrations/cre/project.yaml': 'sepolia:\n  rpcs: []\n',
    'integrations/cre/workflow/main.ts': '// Test repository source.\n',
    'integrations/cre/workflow/package.json': '{"dependencies":{"@chainlink/cre-sdk":"1.23.0"}}\n',
    'integrations/cre/workflow/package-lock.json': '{"lockfileVersion":3}\n',
    'integrations/cre/workflow/tsconfig.json': '{}\n',
    'integrations/cre/workflow/workflow.yaml': 'sepolia: {}\n',
    'integrations/cre/public/reference.json': referenceText,
    'integrations/cre/public/intentional-mismatch.json': mismatchText,
    'scripts/cre-simulate.mjs': '// Test repository source.\n'
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), {recursive: true});
    await writeFile(join(root, path), content);
  }
  git(root, ['init', '--quiet']);
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Aftercheck Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Parser test fixture']);
  return {root, revision: git(root, ['rev-parse', 'HEAD'])};
}

test('UNIT_TEST CRE parser fixture: one canonical result preserves separate MATCH and unchanged financial verdict', () => {
  const result = validateSimulationOutput(captured(match), manifest, metadata);
  assert.equal(result.status, 'MATCH');
  assert.equal(result.financialPolicyVerdict, 'UNCHANGED');
  assert.equal(result.metadata.executionMode, 'CRE_CLI_SIMULATION');
});

test('UNIT_TEST CRE parser fixtures: legitimate MISMATCH and UNAVAILABLE are valid structured outputs', () => {
  const different = parseManifest(mismatchText);
  const mismatch = compareObservation(different, observation, metadata);
  assert.equal(validateSimulationOutput(captured(mismatch), different, metadata).status, 'MISMATCH');
  const unavailable = compareObservation(manifest, {...observation, availability: 'UNAVAILABLE', manifestFetch: 'UNAVAILABLE',
    chainId: null, chainSelector: null, requestedBlockNumber: null, header: null, call: null, returnData: null,
    errorCode: 'HTTP_STATUS_ERROR'}, metadata);
  assert.equal(validateSimulationOutput(captured(unavailable), manifest, metadata).status, 'UNAVAILABLE');
});

test('UNIT_TEST CRE log fragments reconstruct the full result below the 1KB logging quota', () => {
  const fixture = capturedChunked(match);
  const lines = fixture.stdout.trim().split('\n');
  assert.ok(lines.length > 1);
  assert.ok(lines.every(line => Buffer.byteLength(line, 'utf8') < 900));
  assert.equal(reconstructChunkedResult(fixture.stdout), canonicalJson(match));
  assert.equal(validateSimulationOutput(fixture, manifest, metadata).status, 'MATCH');
  // A completed user-log span may be interleaved with other CRE messages.
  const interleaved = fixture.stdout.replace(/\n/g, '\nCRE capability completed\n');
  assert.equal(validateSimulationOutput({...fixture, stdout: interleaved}, manifest, metadata).status, 'MATCH');
  const reversed = lines.toReversed().join('\n') + '\n';
  assert.equal(validateSimulationOutput({...fixture, stdout: reversed}, manifest, metadata).status, 'MATCH');
});

test('UNIT_TEST CRE log fragments support intentional MISMATCH and unavailable manifest', () => {
  const wrong = parseManifest(mismatchText);
  assert.equal(validateSimulationOutput(capturedChunked(compareObservation(wrong, observation, metadata)), wrong, metadata).status, 'MISMATCH');
  const unavailable = compareObservation(manifest, {...observation, availability: 'UNAVAILABLE', manifestFetch: 'UNAVAILABLE',
    chainId: null, chainSelector: null, requestedBlockNumber: null, header: null, call: null, returnData: null,
    errorCode: 'HTTP_STATUS_ERROR'}, metadata);
  assert.equal(validateSimulationOutput(capturedChunked(unavailable), manifest, metadata).status, 'UNAVAILABLE');
});

test('UNIT_TEST CRE log fragment parser rejects missing, duplicate, altered, truncated and mixed messages', () => {
  const complete = capturedChunked(match);
  const lines = complete.stdout.trim().split('\n');
  assert.throws(() => reconstructChunkedResult(lines.slice(0, -1).join('\n')), /CHUNK_MISSING/);
  assert.throws(() => reconstructChunkedResult(lines.concat(lines[0]).join('\n')), /CHUNK_DUPLICATE|CHUNK_MISSING/);
  assert.throws(() => reconstructChunkedResult(lines.map((line, i) => i ? line : line.slice(0, -1)).join('\n')), /CHUNK_INVALID|CHUNK_SIZE/);
  assert.throws(() => reconstructChunkedResult(lines.map((line, i) => i ? line : line.replace(/.$/, c => c === '0' ? '1' : '0')).join('\n')), /CHUNK_CHECKSUM/);
  assert.throws(() => reconstructChunkedResult(lines.map((line, i) => i ? line : line.replace(/([a-f0-9]{64}):/, '0'.repeat(64) + ':')).join('\n')), /CHUNK_DIGEST_CONFLICT/);
  assert.throws(() => reconstructChunkedResult(lines.map((line, i) => i ? line : line.replace('v1:1/', 'v1:0/')).join('\n')), /CHUNK_INVALID/);
  assert.throws(() => validateSimulationOutput({...complete, stdout: complete.stdout + captured(match).stdout}, manifest, metadata), /MARKER_MODE_CONFLICT/);
  const sanitized = sanitizeCreLog(complete.stdout);
  assert.ok(sanitized.includes('[UNVALIDATED_FRAGMENT_OMITTED]'));
  assert.ok(!sanitized.includes(lines[0].split(':').at(-1)));
});

test('UNIT_TEST CRE parser rejects nonzero exits, missing/duplicate markers, truncation and noncanonical JSON', () => {
  assert.throws(() => validateSimulationOutput({...captured(match), exitCode: 1}, manifest, metadata), /DID_NOT_SUCCEED/);
  assert.throws(() => validateSimulationOutput({...captured(match), failure: 'CRE_PROCESS_TIMEOUT'}, manifest, metadata), /DID_NOT_SUCCEED/);
  assert.throws(() => validateSimulationOutput({stdout: 'Workflow compiled\n', exitCode: 0}, manifest, metadata), /MARKER_COUNT/);
  assert.throws(() => validateSimulationOutput({...captured(match), stderr: captured(match).stdout}, manifest, metadata), /MARKER_COUNT/);
  assert.throws(() => validateSimulationOutput({...captured(match), stdout: RESULT_MARKER + canonicalJson(match).slice(0, 100)}, manifest, metadata), /JSON/);
  assert.throws(() => validateSimulationOutput({...captured(match), stdout: RESULT_MARKER + canonicalJson(match) + ' \n'}, manifest, metadata), /NOT_CANONICAL/);
});

test('UNIT_TEST CRE parser rejects unrelated metadata, digest changes and forged comparison status', () => {
  for (const mutation of [{workflowRevision: '2'.repeat(40)}, {rpcProvider: 'PUBLICNODE_SEPOLIA'}, {cliVersion: '1.38.0'}]) {
    const result = compareObservation(manifest, observation, {...metadata, ...mutation});
    assert.throws(() => validateSimulationOutput(captured(result), manifest, metadata), /METADATA_CONFLICT/);
  }
  const wrongManifest = {...manifest, manifestDigest: '0x' + '0'.repeat(64)};
  assert.throws(() => validateSimulationOutput(captured(compareObservation(wrongManifest, observation, metadata)), manifest, metadata), /DIGEST_MISMATCH/);
  const mismatch = compareObservation(parseManifest(mismatchText), observation, metadata);
  assert.throws(() => validateSimulationOutput(captured({...mismatch, status: 'MATCH'}), parseManifest(mismatchText), metadata), /COMPARISON_CONFLICT/);
  assert.throws(() => validateSimulationOutput(captured(mismatch), manifest, metadata), /MANIFEST_CONFLICT/);
});

test('UNIT_TEST CRE parser accepts ANSI-decorated CLI prefixes while rejecting oversized captured output', () => {
  assert.equal(validateSimulationOutput({...captured(match), stdout: '\u001b[32m[USER LOG]\u001b[0m ' + RESULT_MARKER + canonicalJson(match) + '\r\n'}, manifest, metadata).status, 'MATCH');
  assert.throws(() => validateSimulationOutput({...captured(match), stderr: 'x'.repeat(2_000_001)}, manifest, metadata), /LOG_SIZE_LIMIT/);
});

test('UNIT_TEST public manifest URL is restricted to exact immutable repository fixture paths', () => {
  assert.equal(parsePublicManifestUrl(url('a'.repeat(40))).scenario, 'reference');
  assert.equal(parsePublicManifestUrl(url('a'.repeat(40), 'unavailable')).unavailableExpected, true);
  for (const candidate of [url('a'.repeat(40)) + '?token=x', url('a'.repeat(40)) + '#fragment', url('a'.repeat(40)) + '\n', url('a'.repeat(40)) + '\r\n', url('main'),
    url('a'.repeat(40)).replace('https:', 'http:'), url('a'.repeat(40)).replace('raw.githubusercontent.com', 'raw.githubusercontent.com.evil.example'),
    url('a'.repeat(40)).replace('/denchik37/', '/other/'), url('a'.repeat(40)).replace('/public/', '/public/../'),
    url('a'.repeat(40)).replace('/reference.json', '/%72eference.json'), url('a'.repeat(40)).replace('https://', 'https://user:secret@')]) {
    assert.throws(() => parsePublicManifestUrl(candidate), /URL_REJECTED/);
  }
});

test('UNIT_TEST Git provenance binds exact published manifest bytes and explicitly absent 404 fixture', async t => {
  const {root, revision} = await repository(t);
  const bound = await bindManifestToPublicRevision(root, referenceText, url(revision));
  assert.equal(bound.source.revision, revision);
  assert.equal(bound.source.localBytesSha256, '0x' + createHash('sha256').update(referenceText).digest('hex'));
  assert.equal((await bindManifestToPublicRevision(root, mismatchText, url(revision, 'intentional-mismatch'))).manifest.scenario, 'INTENTIONAL_MISMATCH');
  assert.equal((await bindManifestToPublicRevision(root, referenceText, url(revision, 'unavailable'))).source.unavailableExpected, true);
  await assert.rejects(bindManifestToPublicRevision(root, referenceText + ' ', url(revision)), /BYTES_CONFLICT/);
  await assert.rejects(bindManifestToPublicRevision(root, mismatchText, url(revision)), /SCENARIO_CONFLICT/);
  await assert.rejects(bindManifestToPublicRevision(root, referenceText, url('0'.repeat(40))), /REVISION_NOT_AVAILABLE/);
  await writeFile(join(root, 'integrations/cre/public/unavailable.json'), referenceText);
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Aftercheck Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Deliberately existing 404 fixture']);
  await assert.rejects(bindManifestToPublicRevision(root, referenceText, url(git(root, ['rev-parse', 'HEAD']), 'unavailable')), /FIXTURE_EXISTS/);
});

test('UNIT_TEST clean-source guard rejects tracked, staged and ignored/untracked source changes', async t => {
  const {root, revision} = await repository(t);
  assert.equal(await verifySourceProvenance(root), revision);
  const main = join(root, 'integrations/cre/workflow/main.ts');
  await writeFile(main, '// changed\n');
  await assert.rejects(verifySourceProvenance(root), /SOURCE_NOT_CLEAN/);
  git(root, ['add', '.']);
  await assert.rejects(verifySourceProvenance(root), /SOURCE_NOT_CLEAN/);
  git(root, ['restore', '--staged', '.']); git(root, ['restore', '.']);
  const hidden = join(root, 'integrations/cre/workflow/helper.js');
  await writeFile(hidden, '// ignored but potentially executable source\n');
  await assert.rejects(verifySourceProvenance(root), /IGNORED_SOURCE_NOT_COMMITTED/);
  await rm(hidden);
  await writeFile(join(root, 'integrations/cre/untracked.ts'), '// uncommitted source\n');
  await assert.rejects(verifySourceProvenance(root), /SOURCE_NOT_CLEAN/);
});

test('UNIT_TEST clean-source guard allows only known generated outputs and ignored configuration', async t => {
  const {root, revision} = await repository(t);
  for (const path of ['config.json', 'main.js', 'main.wasm', 'build/workflow.js', 'build/workflow.wasm', '.cre_build_tmp.js', 'node_modules/package/index.js']) {
    await mkdir(join(root, 'integrations/cre/workflow', path, '..'), {recursive: true});
    await writeFile(join(root, 'integrations/cre/workflow', path), 'generated\n');
  }
  assert.equal(await verifySourceProvenance(root), revision);
  // A specific leftover from an actual CLI simulation is permitted; arbitrary ignored source remains blocked.
  await writeFile(join(root, 'integrations/cre/workflow/build/untracked-source.ts'), '// ignored unexpected source\n');
  await assert.rejects(verifySourceProvenance(root), /IGNORED_SOURCE_NOT_COMMITTED/);
});

test('UNIT_TEST fresh output paths preserve existing evidence and reject source/input overlap', async t => {
  const {root} = await repository(t);
  await assert.rejects(prepareFreshCreOutput(root, {root}), /OVERLAPS_SOURCE/);
  await assert.rejects(prepareFreshCreOutput(join(root, 'integrations/cre/new-output'), {root}), /OVERLAPS_SOURCE/);
  const output = join(root, 'output', 'attempt');
  await prepareFreshCreOutput(output, {root});
  await writeFile(join(output, 'result.json'), 'previous successful result\n');
  await assert.rejects(prepareFreshCreOutput(output, {root}), /MUST_BE_FRESH/);
  assert.equal(await readFile(join(output, 'result.json'), 'utf8'), 'previous successful result\n');
  const input = join(root, 'output', 'input.json');
  await writeFile(input, '{}\n');
  await assert.rejects(prepareFreshCreOutput(join(root, 'output'), {root, inputs: [input]}), /OVERLAPS_INPUT/);
  const linked = join(root, 'output', 'link');
  await symlink(output, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(prepareFreshCreOutput(linked, {root}), /DIRECTORY_REQUIRED/);
});

test('UNIT_TEST log sanitation removes secrets, credential URLs and unvalidated result payloads', () => {
  const secret = 'deliberate-unit-test-secret';
  const text = `token=${secret}\nAuthorization: Bearer secret-bearer-value\nhttps://rpc.example/key-path?token=hidden\n${RESULT_MARKER}{"secret":"sensitive"}\n${'f'.repeat(64)}\n! You are not logged in\n`;
  const sanitized = sanitizeCreLog(text, {secretValues: [secret]});
  for (const forbidden of [secret, 'secret-bearer-value', 'key-path', 'token=hidden', 'sensitive', 'f'.repeat(64)]) assert.equal(sanitized.includes(forbidden), false);
  assert.match(sanitized, /You are not logged in/);
  assert.match(sanitized, /UNVALIDATED_RESULT_OMITTED/);
  assert.equal(sanitizeCreLog(captured(match).stdout, {approvedResult: match}), RESULT_MARKER + canonicalJson(match) + '\n');
});
