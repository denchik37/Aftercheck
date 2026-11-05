#!/usr/bin/env node
// Commit generated public reports so the static host needs no Node build/runtime.
// Recompute from retained evidence with the existing verifier; never edit verdicts.
import './offline-guard.mjs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {readJsonFile} from '../src/io.ts';
import {parseEvidence} from '../src/evidence.ts';
import {parsePolicy} from '../src/policy.ts';
import {verifyEvidence} from '../src/verify.ts';
import {canonicalJson} from '../src/json.ts';

const example = name => new URL('../examples/sepolia/' + name, import.meta.url);
const output = new URL('../web/samples/', import.meta.url);
const cases = [
  ['pass', 'pass', 'PASS', 'COMPLETE'],
  ['input-cap-violation', 'violation', 'VIOLATION', 'COMPLETE'],
  ['output-threshold-violation', 'output-threshold', 'VIOLATION', 'COMPLETE'],
  ['reserve-unknown', 'reserve', 'UNKNOWN', 'PARTIAL']
];

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
    throw new Error('USAGE: node scripts/public-samples.mjs --check | --write');
  }
  const evidence = parseEvidence(await readJsonFile(example('evidence.json')));
  if (evidence.evidenceClass !== 'RPC_RECEIPT' || evidence.chainId !== 11155111 ||
      evidence.transactionHash !== '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9') {
    throw new Error('PUBLIC_SAMPLE_EVIDENCE_CHANGED');
  }
  const generated = [];
  for (const [name, policyName, verdict, coverage] of cases) {
    const policy = parsePolicy(await readJsonFile(example('policy-' + policyName + '.json'), 64_000));
    const report = verifyEvidence(evidence, policy);
    if (report.execution !== 'SUCCEEDED' || report.support !== 'SUPPORTED' ||
        report.verdict !== verdict || report.coverage !== coverage ||
        report.policySource !== 'SUPPLIED_RETROSPECTIVE' || report.evidenceDigest !== evidence.digest) {
      throw new Error('PUBLIC_SAMPLE_OUTCOME_CHANGED');
    }
    generated.push({name, source: canonicalJson(report) + '\n'});
  }
  if (args[0] === '--write') await mkdir(output, {recursive: true});
  for (const {name, source} of generated) {
    const path = new URL(name + '.json', output);
    if (args[0] === '--write') await writeFile(path, source, 'utf8');
    else if (await readFile(path, 'utf8') !== source) throw new Error('PUBLIC_SAMPLE_STALE: ' + name);
  }
  console.log(`Public samples ${args[0] === '--write' ? 'generated' : 'verified'}: ${generated.length}. Historical Sepolia evidence; retrospective policies; offline replay.`);
} catch (error) {
  // Source inputs are fixed public repository files; do not print imported data.
  console.error(error instanceof Error && /^(?:USAGE:|PUBLIC_SAMPLE_)/.test(error.message)
    ? error.message : 'PUBLIC_SAMPLE_GENERATION_FAILED');
  process.exitCode = 1;
}
