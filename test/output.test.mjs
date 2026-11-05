import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {writeOutputDirectory} from '../src/output.ts';

const oldFiles = {
  'evidence.json': '{"digest":"old-evidence"}\n',
  'policy.json': '{"maxInputRaw":"500"}\n',
  'report.json': '{"verdict":"PASS","policy":"old-policy"}\n',
  'report.md': '# Previous PASS\n'
};
const newFiles = {
  'evidence.json': '{"digest":"new-evidence"}\n',
  'policy.json': '{"maxInputRaw":"499"}\n',
  'report.json': '{"verdict":"VIOLATION","policy":"new-policy"}\n',
  'report.md': '# New VIOLATION\n'
};
async function readSet(path) {
  const names = (await fs.readdir(path)).sort();
  return Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(join(path, name), 'utf8')])));
}
async function setup(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'aftercheck-output-test-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  return {root, output: join(root, 'out')};
}

test('complete output publication replaces the whole coherent managed set', async t => {
  const {root, output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  assert.deepEqual(await readSet(output), oldFiles);
  await writeOutputDirectory(output, newFiles);
  assert.deepEqual(await readSet(output), newFiles);
  assert.deepEqual(await fs.readdir(root), ['out']);
  // Windows uses ACLs and cannot represent POSIX owner/group permission masks.
  // All publication, rollback and preservation assertions still run on Windows.
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(output)).mode & 0o777, 0o700);
    for (const name of Object.keys(newFiles)) assert.equal((await fs.stat(join(output, name))).mode & 0o777, 0o600);
  }
});

test('a successful evidence-only collection removes stale reports and policy from that output', async t => {
  const {output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  const captured = {'evidence.json': '{"digest":"fresh-capture"}\n'};
  await writeOutputDirectory(output, captured);
  assert.deepEqual(await readSet(output), captured);
});

test('a failed staged report write leaves the entire previous PASS set unchanged', async t => {
  const {root, output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  const write = fs.writeFile;
  t.mock.method(fs, 'writeFile', async (path, ...args) => {
    if (basename(String(path)) === 'report.json') throw new Error('SIMULATED_STAGE_WRITE_FAILURE');
    return write(path, ...args);
  });
  await assert.rejects(writeOutputDirectory(output, newFiles), /SIMULATED_STAGE_WRITE_FAILURE/);
  assert.deepEqual(await readSet(output), oldFiles);
  assert.deepEqual(await fs.readdir(root), ['out']);
});

test('a failed final rename restores the complete previous output before reporting failure', async t => {
  const {root, output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  const rename = fs.rename;
  t.mock.method(fs, 'rename', async (from, to) => {
    if (basename(String(from)).startsWith('.aftercheck-stage-') && to === output) throw new Error('SIMULATED_PUBLISH_FAILURE');
    return rename(from, to);
  });
  await assert.rejects(writeOutputDirectory(output, newFiles), /SIMULATED_PUBLISH_FAILURE/);
  assert.deepEqual(await readSet(output), oldFiles);
  assert.deepEqual(await fs.readdir(root), ['out']);
});

test('root, symlinks, files, nested entries and unrelated output content are never replaced', async t => {
  const {root, output} = await setup(t);
  await assert.rejects(writeOutputDirectory('/', newFiles), /ROOT_FORBIDDEN/);
  await fs.writeFile(output, 'keep this unrelated file');
  await assert.rejects(writeOutputDirectory(output, newFiles), /DIRECTORY_REQUIRED/);
  assert.equal(await fs.readFile(output, 'utf8'), 'keep this unrelated file');
  await fs.unlink(output);
  const target = join(root, 'target'); await fs.mkdir(target);
  // Junctions exercise linked-directory rejection without Windows symlink privileges.
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  await fs.symlink(target, output, linkType);
  await assert.rejects(writeOutputDirectory(output, newFiles), /DIRECTORY_REQUIRED/);
  assert.equal((await fs.lstat(output)).isSymbolicLink(), true);
  await fs.unlink(output); await fs.mkdir(output);
  await fs.writeFile(join(output, 'notes.txt'), 'keep user content');
  await assert.rejects(writeOutputDirectory(output, newFiles), /UNMANAGED_FILES/);
  assert.equal(await fs.readFile(join(output, 'notes.txt'), 'utf8'), 'keep user content');
  await fs.unlink(join(output, 'notes.txt')); await fs.mkdir(join(output, 'report.json'));
  await assert.rejects(writeOutputDirectory(output, newFiles), /UNMANAGED_FILES/);
  await fs.rmdir(join(output, 'report.json')); await fs.symlink(target, join(output, 'report.json'), linkType);
  await assert.rejects(writeOutputDirectory(output, newFiles), /UNMANAGED_FILES/);
  assert.deepEqual(await fs.readdir(target), []);
});

test('filename and byte budgets fail before changing an existing output', async t => {
  const {root, output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  for (const files of [{}, {'../escape.json': 'x'}, {'report.json': 1}, {'report.json': 'x'.repeat(8_000_001)},
    {'evidence.json': 'x'.repeat(8_000_000), 'report.json': 'x'.repeat(8_000_000), 'report.md': 'x'}]) {
    await assert.rejects(writeOutputDirectory(output, files), /INVALID_OUTPUT_FILES|OUTPUT_SIZE_LIMIT/);
    assert.deepEqual(await readSet(output), oldFiles);
  }
  assert.deepEqual(await fs.readdir(root), ['out']);
});

test('concurrently added unrelated files block publication and are preserved', async t => {
  const {output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  const write = fs.writeFile;
  let changed = false;
  t.mock.method(fs, 'writeFile', async (path, ...args) => {
    await write(path, ...args);
    if (!changed) { changed = true; await write(join(output, 'user-note.txt'), 'preserve concurrent note'); }
  });
  await assert.rejects(writeOutputDirectory(output, newFiles), /UNMANAGED_FILES/);
  assert.deepEqual(await readSet(output), {...oldFiles, 'user-note.txt': 'preserve concurrent note'});
});

test('a failed rollback retains the backup instead of deleting recoverable prior results', async t => {
  const {root, output} = await setup(t);
  await writeOutputDirectory(output, oldFiles);
  const rename = fs.rename;
  t.mock.method(fs, 'rename', async (from, to) => {
    if (to === output) throw new Error('SIMULATED_RENAME_FAILURE');
    return rename(from, to);
  });
  await assert.rejects(writeOutputDirectory(output, newFiles), /OUTPUT_ROLLBACK_FAILED/);
  const backups = (await fs.readdir(root)).filter(name => name.startsWith('.aftercheck-backup-'));
  assert.equal(backups.length, 1);
  assert.deepEqual(await readSet(join(root, backups[0], 'previous')), oldFiles);
});
