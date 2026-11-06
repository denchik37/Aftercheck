import {rawAmount} from './values.ts';

/** ERC-20 decimals is uint8. These are display units, never floating-point amounts. */
export const MAX_TOKEN_DECIMALS = 255;
// uint256's 78 digits, a decimal point, up to 255 fractional digits and two spare
// leading zeros. Check this before regex work, padding or bigint conversion.
export const MAX_AMOUNT_TEXT_LENGTH = 336;

export function parseDecimals(input: unknown): number {
  let decimals: number;
  if (typeof input === 'number') {
    decimals = input;
  } else if (typeof input === 'string' && input.length <= 3) {
    const match = /^(?:0|[1-9][0-9]{0,2})$/.exec(input);
    if (!match || match[0] !== input) throw new TypeError('Decimals must be an integer from 0 to 255');
    decimals = Number(input);
  } else {
    throw new TypeError('Decimals must be an integer from 0 to 255');
  }
  if (!Number.isSafeInteger(decimals) || Object.is(decimals, -0) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) {
    throw new RangeError('Decimals must be an integer from 0 to 255');
  }
  return decimals;
}

/** Parse a nonnegative, ungrouped decimal exactly; excess precision is rejected. */
export function decimalToRaw(input: unknown, decimalsInput: number): string {
  const decimals = parseDecimals(decimalsInput);
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_AMOUNT_TEXT_LENGTH) {
    throw new TypeError('Amount must be a bounded decimal string');
  }
  const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(input);
  // Require the entire input, including any trailing control characters.
  if (!match || match[0] !== input) throw new TypeError('Use digits and a decimal point only; no signs, separators or scientific notation');
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) throw new RangeError(`Amount exceeds ${decimals} decimal places`);
  const raw = (match[1] + fraction.padEnd(decimals, '0')).replace(/^0+(?=[0-9])/, '');
  return rawAmount(raw).toString();
}

/** Exact editable decimal form. Removing insignificant trailing zeros never rounds. */
export function rawToDecimal(input: unknown, decimalsInput: number): string {
  const raw = rawAmount(input).toString();
  const decimals = parseDecimals(decimalsInput);
  if (decimals === 0) return raw;
  const padded = raw.padStart(decimals + 1, '0');
  const integer = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

/** Read-only exact formatting; grouped output must not be fed back into the parser. */
export function formatAmount(input: unknown, decimals: number, group = true): string {
  const [integer, fraction] = rawToDecimal(input, decimals).split('.');
  const readable = group ? integer.replace(/\B(?=(?:[0-9]{3})+(?![0-9]))/g, ',') : integer;
  return fraction === undefined ? readable : `${readable}.${fraction}`;
}
