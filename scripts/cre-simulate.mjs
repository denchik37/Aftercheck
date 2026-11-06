#!/usr/bin/env node
/** Run the official, read-only CRE simulator; this wrapper never substitutes an RPC rehearsal. */
import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {lstat, mkdir, open, readdir, realpath, rename, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripVTControlCharacters} from 'node:util';
import {
  CRE_RESULT_CHUNK_BYTES, CRE_RESULT_CHUNK_MARKER, MAX_CRE_JSON_BYTES,
  assertManifestDigest, canonicalJson, parseCorroboration,
  parseExecutionMetadata, parseManifest
} from '../integrations/cre/shared.ts';

export const CRE_CLI_VERSION = '1.39.0';
export const CRE_SDK_VERSION = '1.23.0';
export const CRE_BUN_VERSION = '1.4.4';
export const RESULT_MARKER = 'AFTERCHECK_CRE_RESULT=';
const MAX_LOG_BYTES = 2_000_000;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_PATHS = ['integrations/cre', 'scripts/cre-simulate.mjs'];
// Only explicit, CLI-owned generated paths may be present during source rechecks.
const GENERATED_FILES = ['workflow/main.js', 'workflow/main.wasm', 'workflow/build/workflow.js', 'workflow/build/workflow.wasm', 'workflow/.cre_build_tmp.js'];
const REQUIRED_SOURCE = [
  'integrations/cre/shared.ts', 'integrations/cre/config.ts', 'integrations/cre/project.yaml',
  'integrations/cre/workflow/main.ts', 'integrations/cre/workflow/workflow.yaml',
  'integrations/cre/workflow/package.json', 'integrations/cre/workflow/package-lock.json',
  'integrations/cre/workflow/tsconfig.json', 'scripts/cre-simulate.mjs'
];
const PUBLIC_URL = /^https:\/\/raw\.githubusercontent\.com\/denchik37\/aftercheck\/([0-9a-f]{40})\/(integrations\/cre\/public\/(reference|intentional-mismatch|unavailable)\.json)$/;
const sha256Text = text => '0x' + createHash('sha256').update(text, 'utf8').digest('hex');
const ensure = (condition, code) => { if (!condition) throw new Error(code); };

/** No shell, bounded output, and a finite deadline for every child process. */
async function capture(command, args, {cwd, env = process.env, timeoutMs = 240_000, maxBytes = MAX_LOG_BYTES} = {}) {
  return await new Promise(resolveResult => {
    const stdout = [], stderr = [];
    let size = 0, failure = null, child, escalation = null;
    try { child = spawn(command, args, {cwd, env, shell: false, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']}); }
    catch { resolveResult({exitCode: null, signal: null, stdout: '', stderr: '', failure: 'CRE_PROCESS_START_FAILED'}); return; }
    const signal = value => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, value);
        else {
          child.kill(value);
          if (value === 'SIGKILL' && child.pid) {
            const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {shell: false, windowsHide: true, stdio: 'ignore'});
            killer.on('error', () => {});
          }
        }
      } catch { /* The process may already have exited. */ }
    };
    const stop = code => {
      if (failure) return;
      failure = code;
      signal('SIGTERM');
      escalation = setTimeout(() => signal('SIGKILL'), 2_000);
      escalation.unref();
    };
    const timer = setTimeout(() => stop('CRE_PROCESS_TIMEOUT'), timeoutMs);
    timer.unref();
    const collect = target => chunk => {
      size += chunk.length;
      if (size > maxBytes) { stop('CRE_LOG_SIZE_LIMIT'); return; }
      target.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.on('error', () => { failure = 'CRE_PROCESS_START_FAILED'; });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (escalation) clearTimeout(escalation);
      resolveResult({exitCode, signal, stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'), failure});
    });
  });
}

async function git(root, args, maxBytes = 1_000_000) {
  return await capture('git', ['-C', root, ...args], {timeoutMs: 20_000, maxBytes});
}

/** Check both tracked changes and unexpected untracked source before and after execution. */
export async function verifySourceProvenance(root) {
  const head = await git(root, ['rev-parse', '--verify', 'HEAD']);
  ensure(head.exitCode === 0 && !head.failure && /^[0-9a-f]{40}\n?$/.test(head.stdout), 'CRE_SOURCE_REVISION_UNAVAILABLE');
  const revision = head.stdout.trim();
  const tracked = await git(root, ['ls-files', '--error-unmatch', '--', ...REQUIRED_SOURCE]);
  ensure(tracked.exitCode === 0 && !tracked.failure, 'CRE_REQUIRED_SOURCE_NOT_COMMITTED');
  const status = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...SOURCE_PATHS]);
  ensure(status.exitCode === 0 && !status.failure, 'CRE_SOURCE_STATUS_UNAVAILABLE');
  ensure(status.stdout.length === 0, 'CRE_SOURCE_NOT_CLEAN');
  const ignored = await git(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--',
    'integrations/cre', ':!integrations/cre/workflow/node_modules/**',
    ':!integrations/cre/workflow/config.json', ...GENERATED_FILES.map(path => ':!integrations/cre/' + path)]);
  ensure(ignored.exitCode === 0 && !ignored.failure, 'CRE_SOURCE_STATUS_UNAVAILABLE');
  ensure(ignored.stdout.length === 0, 'CRE_IGNORED_SOURCE_NOT_COMMITTED');
  for (const path of ['workflow/build', ...GENERATED_FILES]) {
    try {
      const info = await lstat(join(root, 'integrations/cre', path));
      ensure(!info.isSymbolicLink() && (path === 'workflow/build' ? info.isDirectory() : info.isFile() && info.nlink === 1), 'CRE_GENERATED_PATH_UNSAFE');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return revision;
}

export function parsePublicManifestUrl(url) {
  ensure(typeof url === 'string' && url.length <= 300 && !/\s/.test(url), 'CRE_PUBLIC_MANIFEST_URL_REJECTED');
  const match = PUBLIC_URL.exec(url);
  ensure(match !== null, 'CRE_PUBLIC_MANIFEST_URL_REJECTED');
  return {url, revision: match[1], path: match[2], unavailableExpected: match[3] === 'unavailable', scenario: match[3]};
}

/** Bytes must be the reviewed Git object, not merely a caller-provided matching digest. */
export async function bindManifestToPublicRevision(root, text, manifestUrl) {
  ensure(typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= MAX_CRE_JSON_BYTES, 'CRE_MANIFEST_SIZE_LIMIT');
  const manifest = parseManifest(text);
  assertManifestDigest(manifest, sha256Text);
  const source = parsePublicManifestUrl(manifestUrl);
  const commit = await git(root, ['cat-file', '-t', source.revision]);
  ensure(commit.exitCode === 0 && !commit.failure && commit.stdout.trim() === 'commit', 'CRE_PUBLIC_REVISION_NOT_AVAILABLE');
  let expectedPath = source.path;
  if (source.unavailableExpected) {
    const tree = await git(root, ['ls-tree', source.revision, '--', source.path]);
    ensure(tree.exitCode === 0 && !tree.failure, 'CRE_PUBLIC_MANIFEST_LOOKUP_FAILED');
    ensure(tree.stdout.length === 0, 'CRE_UNAVAILABLE_FIXTURE_EXISTS');
    expectedPath = 'integrations/cre/public/reference.json';
    ensure(manifest.scenario === 'REFERENCE', 'CRE_UNAVAILABLE_TARGET_NOT_REFERENCE');
  } else {
    ensure(manifest.scenario === (source.scenario === 'reference' ? 'REFERENCE' : 'INTENTIONAL_MISMATCH'), 'CRE_PUBLIC_SCENARIO_CONFLICT');
  }
  const committed = await git(root, ['show', `${source.revision}:${expectedPath}`], MAX_CRE_JSON_BYTES + 1);
  ensure(committed.exitCode === 0 && !committed.failure, 'CRE_PUBLIC_MANIFEST_NOT_AVAILABLE');
  ensure(committed.stdout === text, 'CRE_PUBLIC_MANIFEST_BYTES_CONFLICT');
  return {manifest, source: {...source, localBytesSha256: sha256Text(text), manifestDigest: manifest.manifestDigest}};
}

/** Parser tests exercise untrusted output, not a simulated execution of CRE. */
/**
 * Decode one complete, checksum-bound simulator result from CRE user-log events.
 * Chainlink limits each log line to 1 KB; every hex fragment is at most 256
 * original UTF-8 bytes. Missing, conflicting, or truncated lines fail closed.
 */
export function reconstructChunkedResult(logs) {
  const lines = logs.split('\n').filter(line => line.includes(CRE_RESULT_CHUNK_MARKER));
  const maxChunks = Math.ceil(MAX_CRE_JSON_BYTES / CRE_RESULT_CHUNK_BYTES);
  ensure(lines.length > 0 && lines.length <= maxChunks, 'CRE_RESULT_CHUNK_COUNT');
  const chunks = new Map();
  let declaredTotal = null, digest = null;
  for (const line of lines) {
    const pos = line.indexOf(CRE_RESULT_CHUNK_MARKER);
    ensure(line.indexOf(CRE_RESULT_CHUNK_MARKER, pos + CRE_RESULT_CHUNK_MARKER.length) === -1, 'CRE_RESULT_CHUNK_INVALID');
    const candidate = line.slice(pos + CRE_RESULT_CHUNK_MARKER.length);
    const match = /^v1:([1-9][0-9]{0,2})\/([1-9][0-9]{0,2}):([0-9a-f]{64}):([0-9a-f]{2,512})$/.exec(candidate);
    ensure(match !== null && match[4].length % 2 === 0, 'CRE_RESULT_CHUNK_INVALID');
    const index = Number(match[1]), total = Number(match[2]), fragmentDigest = match[3];
    ensure(total > 0 && total <= maxChunks && index <= total, 'CRE_RESULT_CHUNK_INDEX_INVALID');
    ensure(declaredTotal === null || declaredTotal === total, 'CRE_RESULT_CHUNK_TOTAL_CONFLICT');
    ensure(digest === null || digest === fragmentDigest, 'CRE_RESULT_CHUNK_DIGEST_CONFLICT');
    ensure(!chunks.has(index), 'CRE_RESULT_CHUNK_DUPLICATE');
    const bytes = Buffer.from(match[4], 'hex');
    ensure(bytes.length > 0 && bytes.length <= CRE_RESULT_CHUNK_BYTES, 'CRE_RESULT_CHUNK_SIZE');
    ensure(index === total || bytes.length === CRE_RESULT_CHUNK_BYTES, 'CRE_RESULT_CHUNK_SIZE');
    declaredTotal = total;
    digest = fragmentDigest;
    chunks.set(index, bytes);
  }
  ensure(declaredTotal === lines.length, 'CRE_RESULT_CHUNK_MISSING');
  const bytes = Buffer.concat(Array.from({length: declaredTotal}, (_, i) => {
    const chunk = chunks.get(i + 1);
    ensure(chunk !== undefined, 'CRE_RESULT_CHUNK_MISSING');
    return chunk;
  }));
  ensure(bytes.length > 0 && bytes.length <= MAX_CRE_JSON_BYTES, 'CRE_RESULT_CHUNK_SIZE');
  ensure(createHash('sha256').update(bytes).digest('hex') === digest, 'CRE_RESULT_CHUNK_CHECKSUM');
  return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
}

export function validateSimulationOutput({stdout, stderr = '', exitCode, failure = null}, manifestInput, metadataInput) {
  ensure(exitCode === 0 && failure === null, 'CRE_SIMULATOR_DID_NOT_SUCCEED');
  const manifest = parseManifest(manifestInput);
  assertManifestDigest(manifest, sha256Text);
  const metadata = parseExecutionMetadata(metadataInput);
  ensure(metadata.executionMode === 'CRE_CLI_SIMULATION' && metadata.cliVersion === CRE_CLI_VERSION &&
    metadata.sdkVersion === CRE_SDK_VERSION, 'CRE_SIMULATOR_METADATA_CONFLICT');
  const logs = stripVTControlCharacters(`${stdout}\n${stderr}`).replace(/\r\n/g, '\n');
  ensure(Buffer.byteLength(logs, 'utf8') <= MAX_LOG_BYTES, 'CRE_LOG_SIZE_LIMIT');
  const chunked = logs.includes(CRE_RESULT_CHUNK_MARKER);
  ensure(!chunked || !logs.includes(RESULT_MARKER), 'CRE_RESULT_MARKER_MODE_CONFLICT');
  const json = chunked ? reconstructChunkedResult(logs) : (() => {
    // Backward compatibility for short, pre-chunk single-line results. Truncated
    // old-format logs still fail strict parsing and never become evidence.
    ensure(logs.split(RESULT_MARKER).length === 2, 'CRE_RESULT_MARKER_COUNT');
    return logs.slice(logs.indexOf(RESULT_MARKER) + RESULT_MARKER.length).split('\n')[0];
  })();
  const result = parseCorroboration(json);
  ensure(canonicalJson(result) === json, 'CRE_RESULT_NOT_CANONICAL');
  assertManifestDigest(result.manifest, sha256Text);
  ensure(canonicalJson(result.manifest) === canonicalJson(manifest), 'CRE_RESULT_MANIFEST_CONFLICT');
  ensure(canonicalJson(result.metadata) === canonicalJson(metadata), 'CRE_RESULT_METADATA_CONFLICT');
  return result;
}

/** Never preserve unvalidated result payloads, endpoint credentials, bearer values or known environment secrets. */
export function sanitizeCreLog(text, {secretValues = [], approvedResult = null} = {}) {
  let cleaned = stripVTControlCharacters(text).replace(/\r\n/g, '\n').replace(/\0/g, '');
  for (const secret of secretValues.filter(value => typeof value === 'string' && value.length >= 8).sort((a, b) => b.length - a.length)) {
    cleaned = cleaned.split(secret).join('[REDACTED]');
  }
  const approvedLine = approvedResult ? RESULT_MARKER + canonicalJson(approvedResult) : null;
  return cleaned.split('\n').map(line => {
    // A malformed fragment can contain arbitrary untrusted payload; even valid
    // fragments are represented by the separately validated result.json.
    if (line.includes(CRE_RESULT_CHUNK_MARKER)) return CRE_RESULT_CHUNK_MARKER +
      (approvedResult ? '[VALIDATED_FRAGMENT_OMITTED]' : '[UNVALIDATED_FRAGMENT_OMITTED]');
    if (line.includes(RESULT_MARKER)) return approvedLine && line.endsWith(approvedLine)
      ? approvedLine : `${RESULT_MARKER}[UNVALIDATED_RESULT_OMITTED]`;
    return line
      .replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi, '[REDACTED_AUTHORIZATION]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
      .replace(/https?:\/\/[^\s<>"']+/gi, value => {
        try {
          const url = new URL(value);
          if (!url.username && !url.password && !url.search && !url.hash &&
              (PUBLIC_URL.test(value) || url.origin === 'https://docs.chain.link' || value === 'https://app.chain.link')) return value;
          return `${url.protocol}//${url.hostname}/[REDACTED_URL]`;
        } catch { return '[REDACTED_URL]'; }
      })
      .replace(/\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|private[_-]?key|authorization))\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '$1=[REDACTED]')
      .replace(/(?:0x)?\b[0-9a-fA-F]{64}\b/g, '[REDACTED_64_HEX]');
  }).join('\n');
}

async function boundedText(path, maxBytes) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    ensure(info.isFile() && info.size <= maxBytes, 'CRE_INPUT_FILE_SIZE_LIMIT');
    const bytes = Buffer.alloc(maxBytes + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const {bytesRead} = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    ensure(offset <= maxBytes, 'CRE_INPUT_FILE_SIZE_LIMIT');
    // Preserve a UTF-8 BOM so strict parsing rejects it instead of silently
    // normalizing local bytes before the immutable Git blob comparison.
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes.subarray(0, offset));
  } finally { await handle.close(); }
}

function argumentsFrom(args) {
  ensure(args.length === 6, 'CRE_SIMULATE_INVALID_ARGUMENTS');
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    ensure(['--manifest', '--manifest-url', '--output'].includes(args[i]) && !Object.hasOwn(values, args[i]) &&
      typeof args[i + 1] === 'string' && args[i + 1].length > 0, 'CRE_SIMULATE_INVALID_ARGUMENTS');
    values[args[i]] = args[i + 1];
  }
  return {manifestPath: resolve(values['--manifest']), manifestUrl: values['--manifest-url'], output: resolve(values['--output'])};
}

async function physicalPath(path) {
  const full = resolve(path);
  try { return await realpath(full); }
  catch (error) {
    if (error.code !== 'ENOENT' || dirname(full) === full) throw error;
    return join(await physicalPath(dirname(full)), basename(full));
  }
}

function contains(parent, child) {
  const path = relative(parent, child);
  return !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
}

/** Shared by execution tools. Every attempt retains its own exclusive artifact set. */
export async function prepareFreshCreOutput(output, {root = ROOT, inputs = []} = {}) {
  const physicalOutput = await physicalPath(output);
  const physicalRoot = await realpath(root);
  ensure(!contains(physicalOutput, physicalRoot), 'CRE_OUTPUT_OVERLAPS_SOURCE');
  if (contains(physicalRoot, physicalOutput)) {
    ensure(['output', 'aftercheck-output'].some(name => contains(join(physicalRoot, name), physicalOutput)), 'CRE_OUTPUT_OVERLAPS_SOURCE');
  }
  for (const input of inputs) ensure(!contains(physicalOutput, await physicalPath(input)), 'CRE_OUTPUT_OVERLAPS_INPUT');
  await mkdir(dirname(output), {recursive: true});
  try { await mkdir(output, {mode: 0o700}); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const info = await lstat(output);
    ensure(info.isDirectory() && !info.isSymbolicLink(), 'CRE_OUTPUT_DIRECTORY_REQUIRED');
    ensure((await readdir(output)).length === 0, 'CRE_OUTPUT_MUST_BE_FRESH');
  }
}

async function atomicConfig(path, config) {
  try {
    const info = await lstat(path);
    ensure(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'CRE_CONFIG_FILE_UNSAFE');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, canonicalJson(config) + '\n', {flag: 'wx', mode: 0o600});
    await rename(temporary, path);
  } finally { await rm(temporary, {force: true}); }
}

export async function runSimulation(args, {root = ROOT, env = process.env} = {}) {
  const options = argumentsFrom(args);
  parsePublicManifestUrl(options.manifestUrl);
  await prepareFreshCreOutput(options.output, {root, inputs: [options.manifestPath]});
  const startedAt = new Date().toISOString();
  let phase = 'SOURCE_PROVENANCE', revision = null, publicSource = null, metadata = null, configDigest = null;
  let cliOutput = {exitCode: null, signal: null, stdout: '', stderr: '', failure: null};
  let toolLogs = '', result = null, failureReason = null, lock = null, lockPath = null;
  const toolVersions = {cli: null, sdk: null, bun: null};
  const project = join(root, 'integrations/cre');
  const executable = env.CRE_BIN || 'cre';
  const commandArgs = ['workflow', 'simulate', 'workflow', '--project-root', project, '--target', 'sepolia', '--non-interactive', '--trigger-index', '0'];
  try {
    revision = await verifySourceProvenance(root);
    const physicalRoot = await realpath(root);
    lockPath = join(tmpdir(), 'aftercheck-cre-' + createHash('sha256').update(physicalRoot).digest('hex').slice(0, 20) + '.lock');
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('CRE_SIMULATION_ALREADY_RUNNING'); throw error; }
    await lock.writeFile(JSON.stringify({pid: process.pid, startedAt}) + '\n');
    phase = 'PUBLIC_MANIFEST_BINDING';
    const text = await boundedText(options.manifestPath, MAX_CRE_JSON_BYTES);
    const bound = await bindManifestToPublicRevision(root, text, options.manifestUrl);
    const manifest = bound.manifest;
    publicSource = bound.source;
    phase = 'TOOLCHAIN';
    const pkg = JSON.parse(await boundedText(join(project, 'workflow/package.json'), MAX_CRE_JSON_BYTES));
    ensure(pkg.dependencies?.['@chainlink/cre-sdk'] === CRE_SDK_VERSION, 'CRE_SDK_DEPENDENCY_NOT_PINNED');
    const installed = JSON.parse(await boundedText(join(project, 'workflow/node_modules/@chainlink/cre-sdk/package.json'), MAX_CRE_JSON_BYTES));
    ensure(installed.name === '@chainlink/cre-sdk' && installed.version === CRE_SDK_VERSION, 'CRE_INSTALLED_SDK_VERSION_CONFLICT');
    toolVersions.sdk = installed.version;
    for (const [name, binary, versionArgs, expected, regex] of [
      ['cli', executable, ['version'], CRE_CLI_VERSION, /(?:^|\n)CRE CLI version v([0-9]+\.[0-9]+\.[0-9]+)(?:\r?\n|$)/],
      ['bun', 'bun', ['--version'], CRE_BUN_VERSION, /^([0-9]+\.[0-9]+\.[0-9]+)\r?\n?$/]
    ]) {
      const checked = await capture(binary, versionArgs, {cwd: project, env, timeoutMs: 20_000, maxBytes: 32_768});
      toolLogs += `[${name} version]\n${checked.stdout}${checked.stderr}\n`;
      ensure(checked.exitCode === 0 && !checked.failure, 'CRE_TOOL_VERSION_UNAVAILABLE');
      const version = regex.exec(stripVTControlCharacters(checked.stdout))?.[1];
      ensure(version === expected, 'CRE_TOOL_VERSION_CONFLICT');
      toolVersions[name] = version;
    }
    const projectYaml = await boundedText(join(project, 'project.yaml'), MAX_CRE_JSON_BYTES);
    const urls = [...projectYaml.matchAll(/^\s*url:\s*["']?([^\s"'#]+)["']?\s*$/gm)].map(match => match[1]);
    const chains = [...projectYaml.matchAll(/^\s*-?\s*chain-name:\s*["']?([^\s"'#]+)["']?\s*$/gm)].map(match => match[1]);
    ensure(urls.length === 1 && urls[0] === 'https://sepolia.gateway.tenderly.co' && chains.length === 1 &&
      chains[0] === 'ethereum-testnet-sepolia', 'CRE_RPC_CONFIGURATION_CONFLICT');
    phase = 'CONFIGURATION';
    const ignored = await git(root, ['check-ignore', '-q', 'integrations/cre/workflow/config.json']);
    ensure(ignored.exitCode === 0, 'CRE_GENERATED_CONFIG_NOT_IGNORED');
    metadata = {executionMode: 'CRE_CLI_SIMULATION', workflowRevision: revision, cliVersion: CRE_CLI_VERSION,
      sdkVersion: CRE_SDK_VERSION, rpcProvider: 'TENDERLY_PUBLIC_SEPOLIA'};
    const config = {schedule: '0 */5 * * * *', manifestUrl: options.manifestUrl, expectedManifest: manifest, metadata};
    configDigest = sha256Text(canonicalJson(config));
    await atomicConfig(join(project, 'workflow/config.json'), config);
    phase = 'OFFICIAL_SIMULATOR';
    // No signing key is required or added, and --broadcast is deliberately absent.
    cliOutput = await capture(executable, commandArgs, {cwd: project, env});
    const raw = `${cliOutput.stdout}\n${cliOutput.stderr}`;
    if (cliOutput.exitCode !== 0 || cliOutput.failure) {
      failureReason = /authentication required|not logged in|no CRE_API_KEY set/i.test(raw)
        ? 'CRE_AUTHENTICATION_UNAVAILABLE' : cliOutput.failure ?? 'CRE_SIMULATOR_FAILED';
      throw new Error(failureReason);
    }
    phase = 'SOURCE_RECHECK';
    ensure(await verifySourceProvenance(root) === revision, 'CRE_SOURCE_CHANGED_DURING_RUN');
    ensure(await boundedText(join(project, 'workflow/config.json'), MAX_CRE_JSON_BYTES) === canonicalJson(config) + '\n', 'CRE_CONFIG_CHANGED_DURING_RUN');
    phase = 'RESULT_VALIDATION';
    result = validateSimulationOutput(cliOutput, manifest, metadata);
    phase = 'COMPLETE';
  } catch (error) {
    failureReason ??= error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message) ? error.message : 'CRE_SIMULATION_ATTEMPT_FAILED';
  } finally {
    if (lock) { await lock.close(); await rm(lockPath, {force: true}); }
  }
  const secretValues = Object.entries(env).filter(([name]) => /(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|AUTHORIZATION)/i.test(name)).map(([, value]) => value);
  const stdout = sanitizeCreLog(toolLogs + cliOutput.stdout, {secretValues, approvedResult: result});
  const stderr = sanitizeCreLog(cliOutput.stderr, {secretValues, approvedResult: result});
  const execution = {
    schemaVersion: 'aftercheck.cre-execution.v1', attemptedMode: 'CRE_CLI_SIMULATION',
    startedAt, finishedAt: new Date().toISOString(), sourceRevision: revision, publicSource, metadata, configDigest,
    toolVersions, command: [env.CRE_BIN ? '<CRE_BIN>' : 'cre', ...commandArgs.map(value => value === project ? '.' : value)],
    workingDirectory: 'integrations/cre',
    commandPathRepresentation: 'Reproducible relative paths; the child process uses the corresponding absolute project root.',
    exitCode: cliOutput.exitCode, signal: cliOutput.signal,
    phase, outcome: result ? 'VALIDATED_SIMULATOR_RESULT' : failureReason === 'CRE_AUTHENTICATION_UNAVAILABLE' ? 'BLOCKED' : 'FAILED',
    failureReason, comparisonStatus: result?.status ?? null,
    resultSha256: result ? sha256Text(canonicalJson(result)) : null,
    logs: {sanitized: true, stdoutSha256: sha256Text(stdout), stderrSha256: sha256Text(stderr)},
    limitations: ['This local execution record is not an authenticated Chainlink or DON attestation.',
      'A successful compiler or ordinary RPC rehearsal does not satisfy CRE simulation execution.',
      'A valid UNAVAILABLE result records failure to obtain corroborating evidence; it is not a successful MATCH.']
  };
  await writeFile(join(options.output, 'stdout.log'), stdout, {flag: 'wx', mode: 0o600});
  await writeFile(join(options.output, 'stderr.log'), stderr, {flag: 'wx', mode: 0o600});
  if (result) await writeFile(join(options.output, 'result.json'), canonicalJson(result) + '\n', {flag: 'wx', mode: 0o600});
  await writeFile(join(options.output, 'execution.json'), JSON.stringify(execution, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  return {exitCode: result ? 0 : 1, execution, result};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSimulation(process.argv.slice(2)).then(({exitCode, execution}) => {
    console.log(execution.comparisonStatus ? `CRE simulator result: ${execution.comparisonStatus}` :
      `CRE simulation incomplete: ${execution.failureReason} (${execution.phase}).`);
    if (execution.failureReason === 'CRE_AUTHENTICATION_UNAVAILABLE') console.log('Authenticate privately with cre login on the execution machine, or configure CRE_API_KEY through an approved secret mechanism.');
    console.log('Inspect execution.json and sanitized stdout.log/stderr.log. Each attempt requires a fresh output directory.');
    process.exitCode = exitCode;
  }).catch(error => {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message) ? error.message : 'CRE_SIMULATION_ATTEMPT_FAILED';
    console.error(code);
    if (code === 'CRE_SIMULATE_INVALID_ARGUMENTS') console.error('Usage: node scripts/cre-simulate.mjs --manifest <manifest.json> --manifest-url <immutable public URL> --output <fresh output directory>');
    process.exitCode = 1;
  });
}
