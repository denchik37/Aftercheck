import {collectSupportedEvidence} from './collect.ts';
import {parsePolicy, type Policy} from './policy.ts';
import {verifyEvidence, type ReplayReport} from './verify.ts';
import {hash32} from './values.ts';
import type {EvidenceBundle, RpcReader} from './evidence.ts';

export interface Inspection {
  evidence: EvidenceBundle;
  policy: Policy;
  report: ReplayReport;
}

/**
 * Collect once from one read-only provider, then evaluate that exact captured
 * bundle against a supplied retrospective policy. A missing or conflicted
 * observation cannot become PASS, and no alternative provider is consulted.
 */
export async function inspectSupportedSwap(
  reader: RpcReader, transactionHash: string, policyInput: unknown
): Promise<Inspection> {
  const policy = parsePolicy(policyInput);
  if (policy.chainId !== 11155111) throw new TypeError('UNSUPPORTED_POLICY_CHAIN');
  const target = hash32(transactionHash, 'transactionHash');
  const evidence = await collectSupportedEvidence(reader, target);
  const report = verifyEvidence(evidence, policy);
  return {evidence, policy, report};
}
