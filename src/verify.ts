import {parseEvidence, validateReceiptIdentity} from './evidence.ts';
import {parsePolicy} from './policy.ts';
import {digestJson} from './json.ts';
import {evaluateReceiptBundle, type ReceiptReport} from './uniswap.ts';

export interface ReplayReport extends ReceiptReport {
  evidenceDigest: string;
  policyDigest: string;
  evaluatorVersion: '0.2.0';
  verificationMode: 'OFFLINE_REPLAY';
  policySource: 'SUPPLIED_RETROSPECTIVE';
  sourceTrust: 'RPC_OBSERVATION_NOT_CONSENSUS_PROOF';
  observationFinality: 'NOT_CHECKED';
}

/** Public offline entry point: verify integrity, raw identities, protocol, then policy. */
export function verifyEvidence(input: unknown, policyInput: unknown): ReplayReport {
  const evidence = parseEvidence(input);
  const policy = parsePolicy(policyInput);
  const identity = validateReceiptIdentity(evidence);
  const report: ReceiptReport = identity.coverage === 'COMPLETE' ? evaluateReceiptBundle(evidence,policy) : {
    schemaVersion:'aftercheck.report.v1',evidenceClass:evidence.evidenceClass,transactionHash:evidence.transactionHash,
    execution:identity.execution,support:'UNSUPPORTED',coverage:identity.coverage,verdict:'UNKNOWN',checks:[],
    limitations:[identity.reason ?? 'EVIDENCE_INCOMPLETE',
      'RPC observations are not Ethereum consensus proofs. A matching digest proves integrity, not source authenticity.',
      'Offline replay does not refresh chain canonicality or finality; no token balance or reserve is established.']
  };
  return {...report,evidenceDigest:evidence.digest,policyDigest:digestJson(policy),evaluatorVersion:'0.2.0',
    verificationMode:'OFFLINE_REPLAY',policySource:'SUPPLIED_RETROSPECTIVE',sourceTrust:'RPC_OBSERVATION_NOT_CONSENSUS_PROOF',observationFinality:'NOT_CHECKED'};
}
