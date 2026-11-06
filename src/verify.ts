import {parseEvidence} from './evidence.ts';
import {parsePolicy} from './policy.ts';
import {digestJson} from './json.ts';
import {createReplayReport, type ReplayReport} from './verify-core.ts';
export type {ReplayReport} from './verify-core.ts';

/** Public offline entry point: verify integrity, raw identities, protocol, then policy. */
export function verifyEvidence(input: unknown, policyInput: unknown): ReplayReport {
  const evidence = parseEvidence(input);
  const policy = parsePolicy(policyInput);
  return createReplayReport(evidence, policy, digestJson(policy));
}
