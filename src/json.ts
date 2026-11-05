import {createHash} from 'node:crypto';

export const MAX_JSON_BYTES = 8_000_000;
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

/** Restricted JSON: unique safe keys, bounded depth, exact integer metadata. */
export function parseJson(text: string, maxBytes = MAX_JSON_BYTES): unknown {
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new RangeError('JSON_SIZE_LIMIT');
  let at = 0, nodes = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[at] ?? '\0')) at++; };
  function string(): string {
    const start = at++;
    while (at < text.length) {
      const char = text[at++];
      if (char === '"') {
        try { return JSON.parse(text.slice(start, at)); }
        catch { throw new TypeError('INVALID_JSON_STRING'); }
      }
      if (char === '\\') at++;
    }
    throw new TypeError('UNTERMINATED_JSON_STRING');
  }
  function value(depth: number): unknown {
    if (depth > 48 || ++nodes > 100_000) throw new RangeError('JSON_COMPLEXITY_LIMIT');
    whitespace();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; whitespace();
      const result: Record<string, unknown> = Object.create(null);
      if (text[at] === '}') { at++; return result; }
      while (at < text.length) {
        whitespace();
        if (text[at] !== '"') throw new TypeError('INVALID_JSON_KEY');
        const key = string();
        if (FORBIDDEN.has(key)) throw new TypeError('UNSAFE_JSON_KEY');
        if (Object.hasOwn(result, key)) throw new TypeError('DUPLICATE_JSON_KEY');
        whitespace();
        if (text[at++] !== ':') throw new TypeError('INVALID_JSON_OBJECT');
        result[key] = value(depth + 1); whitespace();
        if (text[at] === '}') { at++; return result; }
        if (text[at++] !== ',') throw new TypeError('INVALID_JSON_OBJECT');
      }
      throw new TypeError('INVALID_JSON_OBJECT');
    }
    if (text[at] === '[') {
      at++; whitespace();
      const result: unknown[] = [];
      if (text[at] === ']') { at++; return result; }
      while (at < text.length) {
        result.push(value(depth + 1)); whitespace();
        if (text[at] === ']') { at++; return result; }
        if (text[at++] !== ',') throw new TypeError('INVALID_JSON_ARRAY');
      }
      throw new TypeError('INVALID_JSON_ARRAY');
    }
    for (const [word, result] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(word, at)) { at += word.length; return result; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at));
    if (number) {
      if (!/^-?(?:0|[1-9][0-9]*)$/.test(number[0])) throw new TypeError('JSON_INTEGER_REQUIRED');
      const result = Number(number[0]);
      if (!Number.isSafeInteger(result) || Object.is(result, -0)) throw new TypeError('UNSAFE_JSON_NUMBER');
      at += number[0].length; return result;
    }
    throw new TypeError('INVALID_JSON');
  }
  const result = value(0); whitespace();
  if (at !== text.length) throw new TypeError('TRAILING_JSON_DATA');
  return result;
}

/** Sorted object keys, array order preserved, no coercion or toJSON callbacks. */
export function canonicalJson(value: unknown): string {
  let nodes = 0;
  function encode(item: unknown, depth: number): string {
    if (depth > 48 || ++nodes > 100_000) throw new RangeError('JSON_COMPLEXITY_LIMIT');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isSafeInteger(item) && !Object.is(item, -0)) return JSON.stringify(item);
    if (Array.isArray(item)) return '[' + item.map(x => encode(x, depth + 1)).join(',') + ']';
    if (typeof item === 'object' && item !== null && [Object.prototype, null].includes(Object.getPrototypeOf(item))) {
      return '{' + Object.keys(item).sort().map(key => {
        if (FORBIDDEN.has(key)) throw new TypeError('UNSAFE_JSON_KEY');
        return JSON.stringify(key) + ':' + encode((item as Record<string, unknown>)[key], depth + 1);
      }).join(',') + '}';
    }
    throw new TypeError('UNSUPPORTED_JSON_VALUE');
  }
  const text = encode(value, 0);
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new RangeError('JSON_SIZE_LIMIT');
  return text;
}

export function digestJson(value: unknown): string {
  return '0x' + createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
