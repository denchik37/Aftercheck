import fs from 'node:fs/promises';
import {basename, dirname, join, resolve} from 'node:path';

const MANAGED = new Set(['evidence.json', 'policy.json', 'report.json', 'report.md']);
const MAX_FILE_BYTES = 8_000_000;
const MAX_TOTAL_BYTES = 16_000_000;
type DirectoryIdentity = {dev: number; ino: number} | null;

async function inspectDirectory(path: string): Promise<DirectoryIdentity> {
  let stat;
  try { stat = await fs.lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('OUTPUT_DIRECTORY_REQUIRED');
  const entries = await fs.readdir(path, {withFileTypes: true});
  if (entries.some(entry => !MANAGED.has(entry.name) || !entry.isFile() || entry.isSymbolicLink())) {
    throw new Error('OUTPUT_CONTAINS_UNMANAGED_FILES');
  }
  return {dev: stat.dev, ino: stat.ino};
}

/** Remove only names owned by the exporter. Concurrently added files are preserved. */
async function removeManagedDirectory(path: string): Promise<void> {
  for (const name of MANAGED) {
    try { await fs.unlink(join(path, name)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  await fs.rmdir(path);
}

/**
 * Publish a complete report set by sibling-directory rename. Validation/staging
 * failure preserves the previous complete set. Failed publication restores it.
 * A concurrent filesystem change that also prevents rollback retains the backup
 * and raises OUTPUT_ROLLBACK_FAILED; no backup content is recursively deleted.
 */
export async function writeOutputDirectory(path: string, files: Record<string, string>): Promise<void> {
  if (typeof path !== 'string' || path.length === 0) throw new Error('INVALID_OUTPUT_PATH');
  const output = resolve(path), parent = dirname(output);
  if (output === parent) throw new Error('OUTPUT_ROOT_FORBIDDEN');
  if (files === null || typeof files !== 'object' || Array.isArray(files) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(files))) throw new Error('INVALID_OUTPUT_FILES');
  const entries = Object.entries(files);
  if (entries.length === 0 || entries.length > MANAGED.size || entries.some(([name, body]) => !MANAGED.has(name) || typeof body !== 'string')) {
    throw new Error('INVALID_OUTPUT_FILES');
  }
  const sizes = entries.map(([, body]) => Buffer.byteLength(body, 'utf8'));
  if (sizes.some(size => size > MAX_FILE_BYTES) || sizes.reduce((sum, size) => sum + size, 0) > MAX_TOTAL_BYTES) throw new Error('OUTPUT_SIZE_LIMIT');
  const before = await inspectDirectory(output);
  await fs.mkdir(parent, {recursive: true});
  const stage = await fs.mkdtemp(join(parent, `.aftercheck-stage-${basename(output)}-`));
  let backupRoot: string | null = null, backup: string | null = null, published = false;
  try {
    await fs.chmod(stage, 0o700);
    for (const [name, body] of entries) await fs.writeFile(join(stage, name), body, {mode: 0o600, flag: 'wx'});
    const now = await inspectDirectory(output);
    if (before?.dev !== now?.dev || before?.ino !== now?.ino) throw new Error('OUTPUT_CHANGED_DURING_EXPORT');
    if (now !== null) {
      backupRoot = await fs.mkdtemp(join(parent, `.aftercheck-backup-${basename(output)}-`));
      backup = join(backupRoot, 'previous');
      await fs.rename(output, backup);
    }
    try { await fs.rename(stage, output); published = true; }
    catch (error) {
      if (backup !== null) {
        try { await fs.rename(backup, output); backup = null; }
        catch { throw new Error('OUTPUT_ROLLBACK_FAILED'); }
      }
      throw error;
    }
  } finally {
    // The stage is exporter-created; after a successful rename it no longer exists.
    await fs.rm(stage, {recursive: true, force: true}).catch(() => {});
    // Cleanup trouble after successful publication leaves a backup; it cannot
    // turn a coherent published result into a misleading failed export.
    if (published && backup !== null) await removeManagedDirectory(backup).catch(() => {});
    if (backupRoot !== null) await fs.rmdir(backupRoot).catch(() => {});
  }
}
