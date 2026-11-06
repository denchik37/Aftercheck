/** Reviewed public configuration shared by the CRE workflow and operator tests. */
import {
  assertManifestDigest, canonicalJson, parseBoundedJson, parseExecutionMetadata,
  parseManifest, type ExecutionMetadata, type Manifest, type Observation,
} from './shared.ts';

export const CRE_CLI_VERSION = '1.39.0';
export const CRE_SDK_VERSION = '1.23.0';
export const SCHEDULE = '0 */5 * * * *';
export const PUBLIC_RPC_URL = 'https://sepolia.gateway.tenderly.co';
export const MAX_MANIFEST_BYTES = 32_768;
export const RESULT_MARKER = 'AFTERCHECK_CRE_RESULT=';

export interface WorkflowConfig {
  schedule: typeof SCHEDULE;
  manifestUrl: string;
  expectedManifest: Manifest;
  metadata: ExecutionMetadata;
}

/** No credentials, whitespace, query strings, mutable branches, or other origins. */
export function validatePublicManifestUrl(value: unknown): string {
  if (typeof value !== 'string' || /\s/.test(value) || !/^https:\/\/raw\.githubusercontent\.com\/denchik37\/aftercheck\/[0-9a-f]{40}\/integrations\/cre\/public\/(?:reference|intentional-mismatch|unavailable)\.json$/.test(value)) {
    throw new TypeError('CRE_PUBLIC_MANIFEST_URL_REJECTED');
  }
  return value;
}

export function parseWorkflowConfig(input: unknown, sha256Text: (text: string) => string): WorkflowConfig {
  const parsed = parseBoundedJson(typeof input === 'string' ? input : canonicalJson(input));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('CRE_CONFIG_OBJECT_REQUIRED');
  const c = parsed as Record<string, unknown>;
  const fields = ['schedule', 'manifestUrl', 'expectedManifest', 'metadata'];
  if (Object.keys(c).sort().length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(c, key))) throw new TypeError('CRE_CONFIG_FIELDS_REJECTED');
  if (c.schedule !== SCHEDULE) throw new TypeError('CRE_CONFIG_SCHEDULE_REJECTED');
  const manifestUrl = validatePublicManifestUrl(c.manifestUrl);
  const expectedManifest = parseManifest(c.expectedManifest);
  assertManifestDigest(expectedManifest, sha256Text);
  const expectedFile = expectedManifest.scenario === 'REFERENCE' ? 'reference.json' : 'intentional-mismatch.json';
  if (!manifestUrl.endsWith('/' + expectedFile) && !(expectedManifest.scenario === 'REFERENCE' && manifestUrl.endsWith('/unavailable.json'))) throw new TypeError('CRE_CONFIG_SCENARIO_CONFLICT');
  const metadata = parseExecutionMetadata(c.metadata);
  if (metadata.executionMode !== 'CRE_CLI_SIMULATION' || metadata.cliVersion !== CRE_CLI_VERSION || metadata.sdkVersion !== CRE_SDK_VERSION || metadata.rpcProvider !== 'TENDERLY_PUBLIC_SEPOLIA') throw new TypeError('CRE_CONFIG_PROVENANCE_REJECTED');
  return {schedule: SCHEDULE, manifestUrl, expectedManifest, metadata};
}

export type ManifestFetch =
  | {manifestFetch: 'VERIFIED'; manifest: Manifest; errorCode: null}
  | {manifestFetch: 'INVALID' | 'UNAVAILABLE'; manifest: null; errorCode: 'HTTP_FETCH_FAILED' | 'HTTP_STATUS_ERROR' | 'MANIFEST_INVALID' | 'MANIFEST_DIGEST_MISMATCH'};

/** A pinned local manifest identifies the target on failure; it never substitutes for a GET. */
export function validateFetchedManifest(statusCode: number, body: string, expected: Manifest, sha256Text: (text: string) => string): ManifestFetch {
  if (statusCode !== 200) return {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: 'HTTP_STATUS_ERROR'};
  let manifest: Manifest;
  try { manifest = parseManifest(body); }
  catch { return {manifestFetch: 'INVALID', manifest: null, errorCode: 'MANIFEST_INVALID'}; }
  try { assertManifestDigest(manifest, sha256Text); }
  catch { return {manifestFetch: 'INVALID', manifest: null, errorCode: 'MANIFEST_DIGEST_MISMATCH'}; }
  if (canonicalJson(manifest) !== canonicalJson(expected)) return {manifestFetch: 'INVALID', manifest: null, errorCode: 'MANIFEST_DIGEST_MISMATCH'};
  return {manifestFetch: 'VERIFIED', manifest, errorCode: null};
}

export function missingManifestObservation(fetch: Exclude<ManifestFetch, {manifestFetch: 'VERIFIED'}>): Observation {
  return {availability: 'UNAVAILABLE', manifestFetch: fetch.manifestFetch,
    chainId: null, chainSelector: null, requestedBlockNumber: null,
    header: null, call: null, returnData: null, errorCode: fetch.errorCode};
}
