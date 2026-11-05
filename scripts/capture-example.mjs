import {mkdir, writeFile} from 'node:fs/promises';
import {RpcClient} from '../src/rpc.ts';
import {collectSupportedEvidence} from '../src/collect.ts';
import {validateReceiptIdentity} from '../src/evidence.ts';

// Fixed public providers, independent bundles. No keys, caller-controlled URLs,
// signing, latest-state substitution, cross-provider field copying or policy claim.
const PROVIDERS = [
  {id: 'publicnode', endpoint: 'https://ethereum-sepolia-rpc.publicnode.com'},
  {id: 'drpc', endpoint: 'https://sepolia.drpc.org'}
];
const MAX_EVIDENCE_BYTES = 950_000;
const MAX_SUMMARY_BYTES = 100_000;
const MAX_TOTAL_BYTES = 4_000_000;
const safeError = error => error instanceof Error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.message)
  ? error.message : 'CAPTURE_FAILED';

try {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2 || args.some(value => !/^0x[0-9a-fA-F]{64}$/.test(value))) {
    throw new Error('INVALID_TRANSACTION_HASH');
  }
  const hashes = args.map(value => value.toLowerCase());
  if (new Set(hashes).size !== hashes.length) throw new Error('DUPLICATE_TRANSACTION_HASH');
  const attempts = [];
  let totalBytes = 0;
  await mkdir('output/capture', {recursive: true, mode: 0o700});
  for (const [index, transactionHash] of hashes.entries()) {
    for (const provider of PROVIDERS) {
      const id = `case${index + 1}-${provider.id}`;
      const started = Date.now();
      let requestCount = 0;
      const client = new RpcClient(provider.endpoint, {timeoutMs: 6_000, totalTimeoutMs: 45_000});
      const reader = {call(method, params) { requestCount++; return client.call(method, params); }};
      try {
        const evidence = await collectSupportedEvidence(reader, transactionHash);
        const json = JSON.stringify(evidence, null, 2) + '\n';
        const size = Buffer.byteLength(json, 'utf8');
        if (size > MAX_EVIDENCE_BYTES || totalBytes + size > MAX_TOTAL_BYTES - MAX_SUMMARY_BYTES) {
          throw new Error('CAPTURE_EXPORT_TOO_LARGE');
        }
        const file = `evidence-${id}.json`;
        await writeFile(`output/capture/${file}`, json, {mode: 0o600});
        totalBytes += size;
        const identity = validateReceiptIdentity(evidence);
        const unavailableStateReads = evidence.state.filter(item => item.error !== undefined).length;
        const complete = identity.coverage === 'COMPLETE' && identity.execution === 'SUCCEEDED' &&
          evidence.state.length === 12 && unavailableStateReads === 0;
        attempts.push({id, provider: provider.id, transactionHash, file, evidenceDigest: evidence.digest,
          requestCount, elapsedMs: Date.now() - started, execution: identity.execution,
          identityCoverage: identity.coverage, identityReason: identity.reason ?? null,
          stateObservations: evidence.state.length, unavailableStateReads,
          captureStatus: complete ? 'COMPLETE_OBSERVATIONS' : 'INCOMPLETE_OBSERVATIONS'});
        // Each complete block is one unchanged bundle. JSON quoting prevents
        // imported strings from creating additional workflow-command lines.
        console.log(`AFTERCHECK_EVIDENCE_BEGIN ${id}`);
        process.stdout.write(json);
        console.log(`AFTERCHECK_EVIDENCE_END ${id}`);
      } catch (error) {
        attempts.push({id, provider: provider.id, transactionHash, requestCount,
          elapsedMs: Date.now() - started, captureStatus: 'CAPTURE_FAILED', error: safeError(error)});
      }
    }
  }
  const summary = {schemaVersion: 'aftercheck.capture-attempts.v1',
    sourceRevision: /^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : null,
    capturedAt: new Date().toISOString(), attempts,
    limitation: 'Independent RPC observations only. Capture completeness is not protocol support, a policy verdict, source authenticity, consensus or finality.'};
  const summaryJson = JSON.stringify(summary, null, 2) + '\n';
  if (Buffer.byteLength(summaryJson, 'utf8') > MAX_SUMMARY_BYTES) throw new Error('CAPTURE_SUMMARY_TOO_LARGE');
  await writeFile('output/capture/attempts.json', summaryJson, {mode: 0o600});
  console.log('AFTERCHECK_ATTEMPTS_BEGIN');
  process.stdout.write(summaryJson);
  console.log('AFTERCHECK_ATTEMPTS_END');
  console.log('Each attempt is independent. No policy was evaluated and no observation was copied between providers.');
  if (attempts.every(item => item.captureStatus === 'CAPTURE_FAILED')) process.exitCode = 1;
} catch (error) {
  // Never emit an arbitrary provider response, endpoint, error stack, or body.
  console.error(`Capture failed: ${safeError(error)}`);
  process.exitCode = 1;
}
