import {parseJson} from './json.ts';
import {requireRecord} from './values.ts';

export class RpcError extends Error {
  code: string;
  constructor(code: string) { super(code); this.name = 'RpcError'; this.code = code; }
}
const METHODS = new Set(['eth_chainId', 'eth_getTransactionByHash', 'eth_getTransactionReceipt',
  'eth_getBlockByHash', 'eth_getBlockByNumber', 'eth_call', 'eth_getCode']);

/** Bounded read-only transport. Provider bodies, endpoints and credentials never enter errors. */
export class RpcClient {
  #endpoint: string;
  #fetch: typeof fetch;
  #id = 0;
  #started = Date.now();
  #bytes = 0;
  #timeout: number;
  #totalTimeout: number;
  #responseBytes: number;
  constructor(endpoint: string, options: {fetchImpl?: typeof fetch; timeoutMs?: number; totalTimeoutMs?: number; maxResponseBytes?: number} = {}) {
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new RpcError('INVALID_RPC_URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.hash) throw new RpcError('INVALID_RPC_URL');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new RpcError('RPC_HTTPS_REQUIRED');
    this.#endpoint = endpoint;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#timeout = Math.min(options.timeoutMs ?? 8_000, 15_000);
    this.#totalTimeout = Math.min(options.totalTimeoutMs ?? 90_000, 120_000);
    this.#responseBytes = Math.min(options.maxResponseBytes ?? 2_000_000, 2_000_000);
    if (this.#timeout < 1 || this.#totalTimeout < 1 || this.#responseBytes < 1) throw new RpcError('INVALID_RPC_LIMIT');
  }
  async call(method: string, params: unknown[]): Promise<unknown> {
    if (!METHODS.has(method)) throw new RpcError('RPC_METHOD_NOT_ALLOWED');
    if (++this.#id > 32 || Date.now() - this.#started >= this.#totalTimeout) throw new RpcError('RPC_BUDGET_EXHAUSTED');
    const id = this.#id;
    const controller = new AbortController();
    let timedOut = false;
    let response: Response | undefined;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(this.#timeout, this.#totalTimeout - (Date.now() - this.#started)));
    try {
      response = await this.#fetch(this.#endpoint, {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({jsonrpc: '2.0', id, method, params}), signal: controller.signal,
        redirect: 'error', credentials: 'omit'
      });
      if (!response.ok) throw new RpcError('RPC_HTTP_ERROR');
      if (!response.body) throw new RpcError('RPC_EMPTY_RESPONSE');
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > this.#responseBytes) throw new RpcError('RPC_RESPONSE_TOO_LARGE');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength; this.#bytes += value.byteLength;
          if (size > this.#responseBytes || this.#bytes > 8_000_000) throw new RpcError('RPC_RESPONSE_TOO_LARGE');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      let data: Record<string, unknown>;
      try { data = requireRecord(parseJson(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks)), this.#responseBytes), 'rpc'); }
      catch { throw new RpcError('RPC_INVALID_JSON'); }
      if (data.jsonrpc !== '2.0' || data.id !== id || !Object.hasOwn(data, 'result') || Object.hasOwn(data, 'error')) throw new RpcError(Object.hasOwn(data, 'error') ? 'RPC_REMOTE_ERROR' : 'RPC_INVALID_ENVELOPE');
      return data.result;
    } catch (error) {
      if (timedOut) throw new RpcError('RPC_TIMEOUT');
      if (error instanceof RpcError) throw error;
      throw new RpcError('RPC_TRANSPORT_ERROR');
    } finally {
      clearTimeout(timer);
      controller.abort();
      // Early status/Content-Length failures have no reader to cancel yet.
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  }
}
