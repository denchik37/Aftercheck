#!/usr/bin/env node
/** Pinned, unprivileged Linux x64 tool installation. No remote shell scripts are executed. */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants, createReadStream} from 'node:fs';
import {chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const TOOLS = Object.freeze({
  bun: {
    version: '1.4.4', file: 'bun-linux-x64.zip', entry: 'bun-linux-x64/bun',
    url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64.zip',
    sums: 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/SHASUMS256.txt',
    sha256: 'bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c',
    versionArgs: ['--version'], versionText: '1.4.4'
  },
  cre: {
    version: '1.39.0', file: 'cre_linux_amd64.tar.gz', entry: 'cre_v1.39.0_linux_amd64',
    url: 'https://github.com/smartcontractkit/cre-cli/releases/download/v1.39.0/cre_linux_amd64.tar.gz',
    sums: 'https://github.com/smartcontractkit/cre-cli/releases/download/v1.39.0/checksums.txt',
    sha256: 'e840ee945d3741fbc76a3cae73749bc9a1730cc58c6babc5e65c2567413c7af0',
    versionArgs: ['version'], versionText: 'CRE CLI version v1.39.0'
  }
});

async function command(binary, args, {timeoutMs = 190_000, maxBytes = 32_768} = {}) {
  return await new Promise(resolveResult => {
    const child = spawn(binary, args, {shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe']});
    let text = '', failed = false, bytes = 0, escalation;
    const signal = value => { try { if (child.pid) process.kill(-child.pid, value); } catch { /* exited */ } };
    const stop = () => {
      if (failed) return;
      failed = true; signal('SIGTERM'); escalation = setTimeout(() => signal('SIGKILL'), 2_000); escalation.unref();
    };
    const timer = setTimeout(stop, timeoutMs); timer.unref();
    child.on('error', () => { failed = true; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) stop(); else text += chunk.toString('utf8');
    });
    child.on('close', code => { clearTimeout(timer); if (escalation) clearTimeout(escalation); resolveResult({code, text, failed}); });
  });
}

async function downloaded(url, path, maxBytes) {
  // Both URLs are immutable literals above. Curl follows HTTPS release-asset redirects;
  // the pinned SHA-256 is checked before any extracted executable is run.
  const result = await command('curl', ['--disable', '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2',
    '--fail', '--location', '--max-redirs', '3', '--max-time', '180', '--max-filesize', String(maxBytes),
    '--silent', '--show-error', '--output', path, url]);
  ensure(result.code === 0 && !result.failed, 'CRE_TOOL_DOWNLOAD_FAILED');
  const info = await lstat(path);
  ensure(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maxBytes, 'CRE_TOOL_DOWNLOAD_SIZE_INVALID');
}

async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function parseArguments(args) {
  const bunOnly = args.includes('--bun-only');
  const rest = args.filter(value => value !== '--bun-only');
  ensure(args.filter(value => value === '--bun-only').length <= 1 && rest.length === 2 && rest[0] === '--output' &&
    typeof rest[1] === 'string' && rest[1].length > 0 && !rest[1].startsWith('--'), 'CRE_INSTALL_INVALID_ARGUMENTS');
  return {output: resolve(rest[1]), bunOnly};
}

export async function installCreTools(args) {
  ensure(process.platform === 'linux' && process.arch === 'x64', 'CRE_INSTALL_LINUX_X64_REQUIRED');
  const {output, bunOnly} = parseArguments(args);
  await mkdir(dirname(output), {recursive: true});
  try { await mkdir(output, {mode: 0o700}); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const info = await lstat(output);
    ensure(info.isDirectory() && !info.isSymbolicLink() && (await readdir(output)).length === 0, 'CRE_INSTALL_OUTPUT_MUST_BE_FRESH');
  }
  const staging = await mkdtemp(join(tmpdir(), 'aftercheck-cre-install-'));
  const installed = [];
  try {
    await mkdir(join(output, 'bin'), {mode: 0o700});
    for (const name of bunOnly ? ['bun'] : ['bun', 'cre']) {
      const tool = TOOLS[name];
      const archive = join(staging, tool.file), sums = join(staging, name + '-checksums.txt');
      await Promise.all([downloaded(tool.url, archive, 150_000_000), downloaded(tool.sums, sums, 64_000)]);
      const digest = await fileHash(archive);
      ensure(digest === tool.sha256, 'CRE_TOOL_CHECKSUM_CONFLICT');
      const lines = (await readFile(sums, 'utf8')).split(/\r?\n/);
      const listed = name === 'bun'
        ? lines.some(line => line.trim().split(/\s+/)[0] === tool.sha256 && line.trim().split(/\s+/).at(-1)?.replace(/^\*/, '') === tool.file)
        : lines.includes(`cre_v${tool.version}_linux_amd64.tar.gz: ${tool.sha256}`);
      ensure(listed, 'CRE_OFFICIAL_CHECKSUM_CONFLICT');
      const destination = join(staging, name); await mkdir(destination);
      const extracted = name === 'bun'
        ? await command('unzip', ['-q', archive, tool.entry, '-d', destination])
        : await command('tar', ['--extract', '--gzip', '--file', archive, '--directory', destination, '--', tool.entry]);
      ensure(extracted.code === 0 && !extracted.failed, 'CRE_TOOL_EXTRACTION_FAILED');
      const binary = join(destination, tool.entry);
      const info = await lstat(binary);
      ensure(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'CRE_TOOL_EXECUTABLE_INVALID');
      await chmod(binary, 0o755);
      const version = await command(binary, tool.versionArgs, {timeoutMs: 20_000});
      ensure(version.code === 0 && !version.failed && version.text.trim() === tool.versionText, 'CRE_TOOL_VERSION_CONFLICT');
      // The requested destination (including RUNNER_TEMP) may be on a different
      // filesystem from the extraction directory. Never overwrite an existing tool.
      const installedPath = join(output, 'bin', name);
      await copyFile(binary, installedPath, constants.COPYFILE_EXCL);
      await chmod(installedPath, 0o755);
      const executableSha256 = await fileHash(binary);
      ensure(await fileHash(installedPath) === executableSha256, 'CRE_INSTALLED_EXECUTABLE_CONFLICT');
      installed.push({name, version: tool.version, archiveSha256: tool.sha256, source: tool.url, checksums: tool.sums,
        executable: `bin/${name}`, executableSha256});
      console.log(`Verified and installed ${name} ${tool.version}.`);
    }
    const record = {schemaVersion: 'aftercheck.cre-toolchain.v1', platform: 'linux-x64', installed};
    await writeFile(join(output, 'toolchain.json'), JSON.stringify(record, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    return record;
  } finally { await rm(staging, {recursive: true, force: true}); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installCreTools(process.argv.slice(2)).catch(error => {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message) ? error.message :
      typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,30}$/.test(error.code) ? 'CRE_TOOL_INSTALL_FAILED_' + error.code : 'CRE_TOOL_INSTALL_FAILED';
    console.error(code);
    if (code === 'CRE_INSTALL_INVALID_ARGUMENTS') console.error('Usage: node scripts/cre-install-tools.mjs --output <fresh directory> [--bun-only]');
    process.exitCode = 1;
  });
}
