#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

// Optional independent recompilation uses an explicitly installed local solc
// module. This script makes no network requests and does not install anything.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(root, 'docs/evidence/token-precision');
const manifest = JSON.parse(readFileSync(resolve(folder, 'manifest.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const evidenceBytes = readFileSync(resolve(root, manifest.evidence.sourcePath));
const evidence = JSON.parse(evidenceBytes);
assert.equal(sha256(evidenceBytes), manifest.evidence.sha256);
assert.equal(evidence.digest, manifest.evidence.digest);
assert.equal(evidence.chainId, manifest.evidence.chainId);
assert.equal(evidence.transactionHash, manifest.evidence.transactionHash);
assert.equal(evidence.block.hash, manifest.evidence.blockHash);
assert.equal(evidence.block.number, manifest.evidence.blockNumber);
const args = process.argv.slice(2);
if (!(args.length === 0 || (args.length === 2 && args[0] === '--compiler'))) throw new Error('Usage: node scripts/check-historical-token-precision.mjs [--compiler /path/to/solc/index.js]');
const compiler = args.length ? createRequire(import.meta.url)(resolve(args[1])) : null;
if (compiler) assert.equal(compiler.version(), manifest.compiler.fullVersion);
const results = [];
for (const token of manifest.tokens) {
  const inputBytes = readFileSync(resolve(folder, token.standardInputPath));
  assert.equal(sha256(inputBytes), token.standardInputSha256);
  const input = JSON.parse(inputBytes);
  const [file, name] = token.compilationTarget.split(':');
  const main = input.sources[file].content;
  assert.match(main, new RegExp(`contract ${name} is ERC20, Ownable`));
  assert.doesNotMatch(main, /function\s+decimals|delegatecall|fallback\s*\(/);
  const decimalsSource = input.sources[token.decimalsSource].content;
  assert.equal(sha256(decimalsSource), token.decimalsSourceSha256);
  assert.match(decimalsSource, /function decimals\(\) public view virtual returns \(uint8\) \{\s*return 18;\s*\}/);
  const observations = evidence.state.filter(state => state.key === `${token.role}.code`);
  assert.equal(observations.length, 1);
  const observation = observations[0];
  assert.equal(observation.method, 'eth_getCode');
  assert.equal(observation.params[0], token.address);
  assert.deepEqual(observation.params[1], {blockHash: evidence.block.hash, requireCanonical: true});
  const storedRuntime = readFileSync(resolve(folder, token.compiledRuntimePath), 'utf8').trim();
  assert.equal(storedRuntime, observation.result);
  assert.equal(sha256(Buffer.from(storedRuntime.slice(2), 'hex')), token.runtimeSha256);
  assert.equal((storedRuntime.length - 2) / 2, token.runtimeBytes);
  if (compiler) {
    input.settings.outputSelection = {'*': {'*': ['evm.deployedBytecode.object']}};
    const output = JSON.parse(compiler.compile(JSON.stringify(input)));
    assert.deepEqual((output.errors ?? []).filter(error => error.severity === 'error'), []);
    const recompiled = '0x' + output.contracts[file][name].evm.deployedBytecode.object;
    assert.equal(recompiled, observation.result, 'Entire independently compiled runtime must match; no metadata stripping or patching');
  }
  results.push({token: token.address, decimals: token.decimals, runtimeBytes: token.runtimeBytes, runtimeSha256: token.runtimeSha256, fullRecompilationThisRun: compiler !== null});
}
console.log(JSON.stringify({status: 'PASS', mode: compiler ? 'INDEPENDENT_FULL_RECOMPILATION' : 'RETAINED_SOURCE_AND_RUNTIME_INTEGRITY', compilerVersion: compiler?.version() ?? null, evidenceDigest: evidence.digest, results}, null, 2));
