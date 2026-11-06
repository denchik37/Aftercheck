import {parseJson, canonicalJson} from './json-codec.ts';
import {validateEvidenceShape, type EvidenceBundle} from './evidence-core.ts';
import {parsePolicy} from './policy.ts';
import {createReplayReport, type ReplayReport} from './verify-core.ts';

export {MAX_JSON_BYTES, parseJson, canonicalJson} from './json-codec.ts';
export {parsePolicy, type Policy} from './policy.ts';
export {validateReceiptIdentity, quantity, type EvidenceBundle} from './evidence-core.ts';
export {decodeExactInputSingle, SEPOLIA_CHAIN_ID, SEPOLIA_ROUTER02} from './uniswap.ts';
export {renderMarkdown} from './report.ts';
export {address, hash32} from './values.ts';
export type {ReplayReport} from './verify-core.ts';

/** Native browser SHA-256 over exactly the Node adapter's canonical UTF-8 bytes. */
export async function digestJsonAsync(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  if (!globalThis.crypto?.subtle) throw new Error('SECURE_CONTEXT_CRYPTO_REQUIRED');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return '0x' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Detach the accepted JSON before the first await. A caller cannot mutate the
 * checked payload while Web Crypto is working and have a different bundle used.
 */
function snapshotEvidence(input: unknown): ReturnType<typeof validateEvidenceShape> {
  return validateEvidenceShape(parseJson(canonicalJson(input)));
}

async function checkSnapshotDigest(snapshot: ReturnType<typeof validateEvidenceShape>): Promise<EvidenceBundle> {
  if (snapshot.digest !== await digestJsonAsync(snapshot.payload)) throw new TypeError('EVIDENCE_DIGEST_MISMATCH');
  return snapshot.evidence;
}

/** Public browser parser: identical schema and SHA-256 checks, with no RPC calls. */
export async function parseEvidenceAsync(input: unknown): Promise<EvidenceBundle> {
  return checkSnapshotDigest(snapshotEvidence(input));
}

/**
 * Public browser verifier. Both inputs are normalized before yielding; integrity,
 * identity, route reconciliation, every policy check and report assembly are
 * shared with the synchronous Node entry point. There is no alternate evaluator.
 */
export async function verifyEvidenceAsync(input: unknown, policyInput: unknown): Promise<ReplayReport> {
  const snapshot = snapshotEvidence(input);
  const policy = parsePolicy(policyInput);
  const evidence = await checkSnapshotDigest(snapshot);
  const policyDigest = await digestJsonAsync(policy);
  return createReplayReport(evidence, policy, policyDigest);
}
