import {createHash} from 'node:crypto';
import {canonicalJson} from './json-codec.ts';
export {MAX_JSON_BYTES, parseJson, canonicalJson} from './json-codec.ts';

export function digestJson(value: unknown): string {
  return '0x' + createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
