/** Exact EVM quantities and identifiers; no floating-point financial arithmetic. */
const MAX_UINT256 = (1n << 256n) - 1n;
const RAW_AMOUNT = /^(0|[1-9][0-9]*)$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;

export function rawAmount(value: unknown, label = 'amount'): bigint {
  if (typeof value !== 'string' || value.length > 78 || !RAW_AMOUNT.test(value)) {
    throw new TypeError(`${label} must be a canonical nonnegative decimal string`);
  }
  const result = BigInt(value);
  if (result > MAX_UINT256) throw new RangeError(`${label} exceeds uint256`);
  return result;
}

export function positiveAmount(value: unknown, label = 'amount'): bigint {
  const amount = rawAmount(value, label);
  if (amount === 0n) throw new RangeError(`${label} must be positive`);
  return amount;
}

export function address(value: unknown, label = 'address'): string {
  if (typeof value !== 'string' || !ADDRESS.test(value)) {
    throw new TypeError(`${label} must be a 20-byte 0x-prefixed EVM address`);
  }
  return value.toLowerCase();
}

export function hash32(value: unknown, label = 'hash'): string {
  if (typeof value !== 'string' || !HASH32.test(value)) {
    throw new TypeError(`${label} must be a 32-byte 0x-prefixed hash`);
  }
  return value.toLowerCase();
}

export function chainId(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError('chainId must be a positive safe integer');
  }
  return value as number;
}

export function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const obj = value as Record<string, unknown>;
  if (Object.getPrototypeOf(obj) !== Object.prototype && Object.getPrototypeOf(obj) !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return obj;
}
