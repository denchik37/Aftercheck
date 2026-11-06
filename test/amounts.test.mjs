import test from 'node:test';
import assert from 'node:assert/strict';
import {decimalToRaw, rawToDecimal, formatAmount, parseDecimals, MAX_AMOUNT_TEXT_LENGTH, MAX_TOKEN_DECIMALS} from '../src/amounts.ts';

const max = ((1n << 256n) - 1n).toString();

test('decimal inputs convert exactly at six, eighteen and zero decimals', () => {
  assert.equal(decimalToRaw('25.5', 6), '25500000');
  assert.equal(decimalToRaw('25.50', 6), '25500000');
  assert.equal(decimalToRaw('0.000945281192884240', 18), '945281192884240');
  assert.equal(decimalToRaw('1', 18), '1000000000000000000');
  assert.equal(decimalToRaw('0.999', 18), '999000000000000000');
  assert.equal(decimalToRaw('25', 0), '25');
});

test('zero and leading/trailing digit zeros are exact without silent rounding', () => {
  for (const decimals of [0, 6, 18, 255]) assert.equal(decimalToRaw('000', decimals), '0');
  assert.equal(decimalToRaw('00025.500000', 6), '25500000');
  assert.equal(decimalToRaw('0000.000000', 6), '0');
  assert.equal(rawToDecimal('0', 255), '0');
  assert.equal(rawToDecimal('25500000', 6), '25.5');
  assert.throws(() => decimalToRaw('25.5000000', 6), /decimal places/);
  assert.throws(() => decimalToRaw('0.0', 0), /decimal places/);
  assert.throws(() => decimalToRaw('1.0000000000000000001', 18), /decimal places/);
});

test('values beyond Number precision and a single raw unit remain distinguishable', () => {
  assert.equal(decimalToRaw('9007199254740993', 0), '9007199254740993');
  assert.equal(decimalToRaw('0.999496253769344460', 18), '999496253769344460');
  assert.equal(decimalToRaw('0.999496253769344461', 18), '999496253769344461');
  assert.equal(rawToDecimal('999496253769344460', 18), '0.99949625376934446');
  assert.equal(rawToDecimal('999496253769344461', 18), '0.999496253769344461');
});

test('uint256 upper bound is enforced at every token precision', () => {
  for (const decimals of [0, 6, 18, 78, 255]) {
    const text = rawToDecimal(max, decimals);
    assert.equal(decimalToRaw(text, decimals), max);
  }
  assert.throws(() => decimalToRaw((1n << 256n).toString(), 0), /uint256/);
  assert.throws(() => decimalToRaw('1', 78), /canonical|uint256/);
  assert.throws(() => rawToDecimal((1n << 256n).toString(), 18), /uint256/);
});

test('maximum uint8 precision supports one raw unit and rejects one extra fractional digit', () => {
  assert.equal(MAX_TOKEN_DECIMALS, 255);
  const smallest = `0.${'0'.repeat(254)}1`;
  assert.equal(rawToDecimal('1', 255), smallest);
  assert.equal(decimalToRaw(smallest, 255), '1');
  assert.throws(() => decimalToRaw(`0.${'0'.repeat(255)}1`, 255), /decimal places/);
});

test('malformed, signed, locale, scientific and non-string amounts fail closed', () => {
  for (const input of ['', ' ', ' 1', '1 ', '1\n', '1\r', '1\r\n', '\t1', '-1', '-0', '+1', '.5', '1.', '1,000', '1,5', '1_000', '1 000', '1\u00a0000', '1e18', '1E3', 'NaN', 'Infinity', '0x1', '１', '1.2.3', null, 1, 1n, Infinity, NaN, true, {}, []]) {
    assert.throws(() => decimalToRaw(input, 18), undefined, String(input));
  }
  assert.throws(() => decimalToRaw('0'.repeat(MAX_AMOUNT_TEXT_LENGTH + 1), 0), /bounded/);
  assert.throws(() => decimalToRaw('9'.repeat(MAX_AMOUNT_TEXT_LENGTH), 0), /canonical|uint256/);
});

test('token precision must be bounded integer metadata, with no implicit coercion', () => {
  for (const input of [0, 6, 18, 255, '0', '6', '18', '255']) assert.equal(parseDecimals(input), Number(input));
  for (const input of [-0, -1, 256, 1.5, NaN, Infinity, '', '18\n', '18 ', '01', '1e1', '0x12', '-0', '256', '0000', null, undefined, [], {}, true]) {
    assert.throws(() => parseDecimals(input), undefined, String(input));
  }
});

test('exact round trips span all supported precisions and the full raw range', () => {
  const values = ['0', '1', '10', '9007199254740993', '1000000000000000000', max];
  for (let decimals = 0; decimals <= 255; decimals++) {
    for (const raw of values) assert.equal(decimalToRaw(rawToDecimal(raw, decimals), decimals), raw);
  }
});

test('read-only grouping retains every digit and does not alter editable values', () => {
  assert.equal(formatAmount('12345678901234567890123456789', 18), '12,345,678,901.234567890123456789');
  assert.equal(formatAmount('12345678901234567890123456789', 18, false), '12345678901.234567890123456789');
  assert.equal(formatAmount('1000000000000000000', 18), '1');
  assert.equal(formatAmount('1000000', 0), '1,000,000');
  assert.throws(() => decimalToRaw(formatAmount('1000000', 0), 0), /separators/);
});
