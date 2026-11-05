import { address, chainId, positiveAmount, rawAmount, requireRecord } from './values.ts';

export interface Policy {
  schemaVersion: 'aftercheck.policy.v1';
  chainId: number;
  owner: string;
  expectedRecipient: string;
  tokenIn: string;
  tokenOut: string;
  maxInputRaw: string;
  minReceivedRaw: string;
  reserveFloorRaw?: string;
}

export function parsePolicy(input: unknown): Policy {
  const obj = requireRecord(input, 'policy');
  if (obj.schemaVersion !== 'aftercheck.policy.v1') {
    throw new TypeError('Unsupported policy schema');
  }
  const owner = address(obj.owner, 'owner');
  const expectedRecipient = address(obj.expectedRecipient, 'expectedRecipient');
  const tokenIn = address(obj.tokenIn, 'tokenIn');
  const tokenOut = address(obj.tokenOut, 'tokenOut');
  if (tokenIn === tokenOut) throw new TypeError('Input and output tokens must differ');
  const maxInputRaw = positiveAmount(obj.maxInputRaw, 'maxInputRaw').toString();
  const minReceivedRaw = rawAmount(obj.minReceivedRaw, 'minReceivedRaw').toString();
  const policy: Policy = {
    schemaVersion: 'aftercheck.policy.v1',
    chainId: chainId(obj.chainId),
    owner,
    expectedRecipient,
    tokenIn,
    tokenOut,
    maxInputRaw,
    minReceivedRaw
  };
  if (obj.reserveFloorRaw !== undefined) {
    policy.reserveFloorRaw = rawAmount(obj.reserveFloorRaw, 'reserveFloorRaw').toString();
  }
  return policy;
}
