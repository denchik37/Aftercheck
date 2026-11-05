import {open} from 'node:fs/promises';
import {parseJson, MAX_JSON_BYTES} from './json.ts';

/** Bound bytes before parsing, including a file that grows after the size check. */
export async function readJsonFile(path: string, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new RangeError('INPUT_FILE_SIZE_LIMIT');
    const buffer = Buffer.alloc(maxBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const {bytesRead} = await handle.read(buffer,offset,buffer.length-offset,offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maxBytes) throw new RangeError('INPUT_FILE_SIZE_LIMIT');
    const text = new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,offset));
    return parseJson(text,maxBytes);
  } finally { await handle.close(); }
}
