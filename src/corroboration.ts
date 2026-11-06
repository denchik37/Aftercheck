import {createHash} from 'node:crypto';
import {parseEvidence, quantity, validateReceiptIdentity} from './evidence.ts';
import {canonicalJson, digestJson} from './json.ts';
import {address, hash32, requireRecord} from './values.ts';
import {decodeAddressResult, decodeExactInputSingle, protocolStateRequests} from './uniswap.ts';
import {verifyEvidence, type ReplayReport} from './verify.ts';
import {
  assertManifestDigest, canonicalJson as canonicalCreJson, compareObservation, parseCorroboration, parseManifest,
  type Corroboration, type Manifest
} from '../integrations/cre/shared.ts';

export const MAX_CRE_MANIFEST_BYTES = 64_000;
export const MAX_CRE_RESULT_BYTES = 128_000;

const CONSUMER_LIMITATIONS = [
  'This local result file is self-reported. Its contents and source revision are not authenticated Chainlink or DON attestations.',
  'The consumer checks source evidence binding and recomputes the comparison; it cannot prove that the supplied observation was obtained by executing CRE.',
  'A manifest or evidence digest establishes artifact integrity, not Ethereum consensus authenticity or provider independence.',
  'The CRE read is requested by block number. A separate matching block header does not turn it into an EIP-1898 block-hash-bound contract read.',
  'Protocol identity corroboration does not establish transaction-boundary balances, reserves, token semantics or original trading intent.',
  'The core financial-policy report is reproduced unchanged. External corroboration cannot upgrade an UNKNOWN or override a VIOLATION.'
] as const;

function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new TypeError(code);
}

function bound(input: unknown, maxBytes: number): void {
  // Use the integration encoder first: it rejects getters, prototypes and
  // unsafe keys without invoking attacker-supplied accessor callbacks.
  ensure(Buffer.byteLength(canonicalCreJson(input), 'utf8') <= maxBytes, 'CRE_INPUT_SIZE_LIMIT');
}

export interface CorroborationAppendix {
  schemaVersion: 'aftercheck.cre-appendix.v1';
  evidenceDigest: string;
  policyDigest: string;
  coreReportDigest: string;
  coreOutcome: {
    execution: ReplayReport['execution'];
    support: ReplayReport['support'];
    coverage: ReplayReport['coverage'];
    policyVerdict: ReplayReport['verdict'];
  };
  financialPolicyVerdict: 'UNCHANGED';
  sourceBinding: {
    transactionHash: string;
    chainId: string;
    blockNumber: string;
    blockHash: string;
    recordedPool: string;
    manifestDigest: string;
    sourceReference: 'DECLARED_PUBLIC_SOURCE_REFERENCE';
    expectedPoolOrigin: 'ORIGINAL_CAPTURE' | 'INTENTIONAL_TEST_INPUT';
  };
  resultAuthenticity: 'SELF_REPORTED_LOCAL_FILE_NOT_AUTHENTICATED';
  externalCorroboration: Corroboration;
  limitations: string[];
}

/**
 * Bind the manifest to independently parsed, retained source evidence. The
 * result's own asserted digest, identities and expected value are insufficient.
 * No network, signing, or financial-policy changes occur here.
 */
function bindManifestToEvidence(evidenceInput: unknown, manifest: Manifest, core: ReplayReport): CorroborationAppendix['sourceBinding'] {
  const evidence = parseEvidence(evidenceInput);
  const identity = validateReceiptIdentity(evidence);
  ensure(evidence.evidenceClass === 'RPC_RECEIPT' && identity.execution === 'SUCCEEDED' &&
    identity.coverage === 'COMPLETE', 'CRE_SOURCE_RECEIPT_NOT_ESTABLISHED');
  // A reserve-floor policy may have PARTIAL coverage / UNKNOWN while the same
  // complete protocol-identity observations remain usable for this comparison.
  ensure(core.support === 'SUPPORTED' && core.protocol !== undefined, 'CRE_SOURCE_PROTOCOL_NOT_ESTABLISHED');
  ensure(evidence.digest === manifest.evidence.digest && core.evidenceDigest === evidence.digest,
    'CRE_SOURCE_EVIDENCE_DIGEST_CONFLICT');
  ensure(evidence.acquiredAt === manifest.evidence.acquiredAt &&
    evidence.evidenceClass === manifest.evidence.evidenceClass, 'CRE_SOURCE_ORIGIN_CONFLICT');

  const tx = requireRecord(evidence.transaction, 'transaction');
  const block = requireRecord(evidence.block, 'block');
  const blockHash = hash32(tx.blockHash);
  const blockNumber = quantity(tx.blockNumber).toString();
  const transactionHash = hash32(evidence.transactionHash);
  ensure(String(evidence.chainId) === manifest.target.chainId &&
    transactionHash === manifest.target.transactionHash &&
    blockNumber === manifest.target.blockNumber && blockHash === manifest.target.blockHash &&
    hash32(block.hash) === blockHash && quantity(block.number).toString() === blockNumber,
  'CRE_SOURCE_TARGET_CONFLICT');

  const decoded = decodeExactInputSingle(tx.input);
  const [token0, token1] = [decoded.tokenIn, decoded.tokenOut].sort();
  const request = protocolStateRequests(tx).find(item => item.key === 'factory.pool');
  ensure(request && request.method === 'eth_call' && typeof request.params[0] === 'object',
    'CRE_SOURCE_FACTORY_REQUEST_MISSING');
  const expectedCall = request.params[0];
  ensure(expectedCall.to === manifest.call.factory && expectedCall.data === manifest.call.calldata &&
    token0 === manifest.call.token0 && token1 === manifest.call.token1 &&
    String(decoded.fee) === manifest.call.fee && core.protocol.factory === expectedCall.to,
  'CRE_SOURCE_CALL_CONFLICT');

  const observations = evidence.state.filter(item => item.key === request.key);
  ensure(observations.length === 1, 'CRE_SOURCE_FACTORY_OBSERVATION_CONFLICT');
  const observation = observations[0];
  ensure(observation.method === 'eth_call' && observation.result !== undefined && observation.error === undefined,
    'CRE_SOURCE_FACTORY_OBSERVATION_UNAVAILABLE');
  const actualCall = requireRecord(observation.params[0], 'factory call');
  const actualBlock = requireRecord(observation.params[1], 'factory block');
  ensure(Object.keys(actualCall).length === 2 && Object.keys(actualBlock).length === 2 &&
    address(actualCall.to) === expectedCall.to &&
    typeof actualCall.data === 'string' && actualCall.data.toLowerCase() === expectedCall.data &&
    hash32(actualBlock.blockHash) === blockHash && actualBlock.requireCanonical === true,
  'CRE_SOURCE_HASH_BOUND_CALL_CONFLICT');
  const recordedPool = decodeAddressResult(observation.result);
  ensure(recordedPool === core.protocol.pool, 'CRE_SOURCE_POOL_CONFLICT');

  if (manifest.scenario === 'REFERENCE') {
    ensure(manifest.call.expectedPool === recordedPool, 'CRE_SOURCE_EXPECTED_POOL_CONFLICT');
  } else {
    // parseManifest restricts this to the published, clearly labelled sentinel.
    ensure(manifest.scenario === 'INTENTIONAL_MISMATCH' && manifest.call.expectedPool !== recordedPool,
      'CRE_TEST_EXPECTATION_NOT_DISTINCT');
  }
  return {
    transactionHash, chainId: String(evidence.chainId), blockNumber, blockHash, recordedPool,
    manifestDigest: manifest.manifestDigest,
    sourceReference: 'DECLARED_PUBLIC_SOURCE_REFERENCE',
    expectedPoolOrigin: manifest.scenario === 'REFERENCE' ? 'ORIGINAL_CAPTURE' : 'INTENTIONAL_TEST_INPUT'
  };
}

/** Validate, bind and recompute a separate corroboration appendix, entirely offline. */
export function consumeCorroboration(evidenceInput: unknown, policyInput: unknown, manifestInput: unknown,
  resultInput: unknown): {coreReport: ReplayReport; appendix: CorroborationAppendix} {
  bound(manifestInput, MAX_CRE_MANIFEST_BYTES);
  bound(resultInput, MAX_CRE_RESULT_BYTES);
  const manifest = parseManifest(manifestInput);
  assertManifestDigest(manifest, text => '0x' + createHash('sha256').update(text, 'utf8').digest('hex'));
  const imported = parseCorroboration(resultInput);
  ensure(canonicalJson(imported.manifest) === canonicalJson(manifest), 'CRE_RESULT_MANIFEST_CONFLICT');

  const coreReport = verifyEvidence(evidenceInput, policyInput);
  const sourceBinding = bindManifestToEvidence(evidenceInput, manifest, coreReport);
  const recomputed = compareObservation(manifest, imported.observation, imported.metadata);
  ensure(canonicalJson(imported) === canonicalJson(recomputed), 'CRE_RESULT_DERIVATION_CONFLICT');
  const limitations: string[] = [...CONSUMER_LIMITATIONS];
  if (imported.metadata.executionMode === 'UNIT_TEST') {
    limitations.unshift('UNIT_TEST: this result is a test fixture, not an executed CRE CLI simulation.');
  } else if (imported.metadata.executionMode === 'RPC_REHEARSAL') {
    limitations.unshift('RPC_REHEARSAL: this result records direct RPC rehearsal, not an executed CRE CLI simulation.');
  }
  if (manifest.scenario === 'INTENTIONAL_MISMATCH') {
    limitations.unshift('INTENTIONAL_MISMATCH: the expected pool was deliberately changed for a negative test; it is not the pool recorded in the historical source evidence.');
  }
  return {coreReport, appendix: {
    schemaVersion: 'aftercheck.cre-appendix.v1',
    evidenceDigest: coreReport.evidenceDigest,
    policyDigest: coreReport.policyDigest,
    coreReportDigest: digestJson(coreReport),
    coreOutcome: {
      execution: coreReport.execution, support: coreReport.support,
      coverage: coreReport.coverage, policyVerdict: coreReport.verdict
    },
    financialPolicyVerdict: 'UNCHANGED', sourceBinding,
    resultAuthenticity: 'SELF_REPORTED_LOCAL_FILE_NOT_AUTHENTICATED',
    externalCorroboration: recomputed, limitations
  }};
}

const markdownText = (value: string): string => value.replace(/[\r\n]/g, ' ')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*\[\]|]/g, '\\$&');

/** Render only the validated appendix returned by consumeCorroboration. */
export function renderCorroborationMarkdown(appendix: CorroborationAppendix): string {
  const result = appendix.externalCorroboration;
  const lines = [
    '# External corroboration — Chainlink CRE', '',
    `- **Pool identity comparison:** ${result.status}`,
    `- **Execution classification:** ${result.metadata.executionMode}`,
    `- **Scenario:** ${result.manifest.scenario}`,
    `- **Manifest HTTP fetch:** ${result.observation.manifestFetch}`,
    '- **Result authenticity:** self-reported local file; not an authenticated Chainlink or DON attestation.', '',
    '## Original Aftercheck result', '',
    `- **Transaction execution:** ${appendix.coreOutcome.execution}`,
    `- **Protocol support:** ${appendix.coreOutcome.support}`,
    `- **Evidence coverage:** ${appendix.coreOutcome.coverage}`,
    `- **Financial-policy verdict:** ${appendix.coreOutcome.policyVerdict} (unchanged)`,
    `- **Core report SHA-256:** ${appendix.coreReportDigest}`, '',
    '## Source and comparison', '',
    `- **Transaction:** ${appendix.sourceBinding.transactionHash}`,
    `- **Chain ID:** ${appendix.sourceBinding.chainId}`,
    `- **Historical block:** ${appendix.sourceBinding.blockNumber}`,
    `- **Retained block hash:** ${appendix.sourceBinding.blockHash}`,
    `- **CRE requested block:** ${result.observation.requestedBlockNumber ?? 'UNAVAILABLE'}`,
    `- **CRE returned header hash:** ${result.observation.header?.blockHash ?? 'UNAVAILABLE'}`,
    '- **Read binding:** block-number request with a separate header comparison; not a hash-bound eth_call.',
    `- **Factory:** ${result.manifest.call.factory}`,
    `- **Method:** ${result.manifest.call.method}`,
    `- **Token 0:** ${result.manifest.call.token0}`,
    `- **Token 1:** ${result.manifest.call.token1}`,
    `- **Fee:** ${result.manifest.call.fee}`,
    `- **Pool recorded in original evidence:** ${appendix.sourceBinding.recordedPool}`,
    `- **Comparison expectation:** ${result.manifest.call.expectedPool} (${appendix.sourceBinding.expectedPoolOrigin})`,
    `- **Observed pool:** ${result.observedPool ?? 'UNAVAILABLE'}`,
    `- **Reason codes:** ${result.reasonCodes.length ? result.reasonCodes.join(', ') : 'NONE'}`,
    `- **Evidence SHA-256:** ${appendix.evidenceDigest}`,
    `- **Manifest SHA-256:** ${appendix.sourceBinding.manifestDigest}`,
    `- **Policy SHA-256:** ${appendix.policyDigest}`, '',
    '## Declared execution metadata', '',
    `- **Workflow revision:** ${result.metadata.workflowRevision}`,
    `- **CRE CLI:** ${result.metadata.cliVersion ?? 'NOT_EXECUTED'}`,
    `- **CRE SDK:** ${result.metadata.sdkVersion ?? 'NOT_EXECUTED'}`,
    `- **RPC provider classification:** ${result.metadata.rpcProvider}`, '',
    '## Limitations', '',
    ...appendix.limitations.map(reason => `- ${markdownText(reason)}`),
    ...result.limitations.map(reason => `- ${markdownText(reason)}`), ''
  ];
  return lines.join('\n');
}
