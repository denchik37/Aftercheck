import {hash32, address, requireRecord} from './values.ts';
import {canonicalJson, digestJson} from './json.ts';
import {RpcError} from './rpc.ts';

export type RpcReader = {call(method: string, params: unknown[]): Promise<unknown>};
export interface StateObservation { key: string; method: string; params: unknown[]; result?: string; error?: string; }
export interface EvidencePayload {
  schemaVersion: 'aftercheck.evidence.v1';
  evidenceClass: 'RPC_RECEIPT' | 'SYNTHETIC_RPC_FIXTURE';
  chainId: number;
  transactionHash: string;
  acquiredAt: string;
  rpcChainId: string | null;
  transaction: Record<string, unknown> | null;
  receipt: Record<string, unknown> | null;
  block: Record<string, unknown> | null;
  canonicalBlockHash: string | null;
  state: StateObservation[];
  collectionErrors: {stage: string; code: string}[];
}
export type EvidenceBundle = EvidencePayload & {digest: string};
export function quantity(input: unknown, label = 'quantity'): bigint {
  if (typeof input !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/.test(input)) throw new TypeError(`INVALID_${label}`);
  return BigInt(input);
}
export function hexData(input: unknown, maxBytes = 32_768): string {
  if (typeof input !== 'string' || input.length > maxBytes * 2 + 2 || !/^0x(?:[0-9a-fA-F]{2})*$/.test(input)) throw new TypeError('INVALID_HEX_DATA');
  return input;
}
function select(input: unknown, keys: string[]): Record<string, unknown> {
  const obj = requireRecord(input, 'RPC_RESULT');
  const out: Record<string, unknown> = {};
  for (const key of keys) if (Object.hasOwn(obj, key)) out[key] = obj[key];
  return out;
}
const TX_KEYS = ['hash','from','to','input','value','blockHash','blockNumber','transactionIndex','chainId','type','authorizationList'];
const LOG_KEYS = ['address','topics','data','blockHash','blockNumber','transactionHash','transactionIndex','logIndex','removed'];
const RECEIPT_KEYS = ['transactionHash','blockHash','blockNumber','transactionIndex','from','to','status','logs'];
const BLOCK_KEYS = ['hash','number','parentHash','timestamp','transactions'];

function cleanTransaction(input: unknown): Record<string, unknown> {
  const tx = select(input, TX_KEYS);
  hash32(tx.hash); address(tx.from); if (tx.to !== null) address(tx.to);
  hexData(tx.input); quantity(tx.value);
  if (tx.blockHash !== null) hash32(tx.blockHash);
  if (tx.blockNumber !== null) quantity(tx.blockNumber);
  if (tx.transactionIndex !== null) quantity(tx.transactionIndex);
  if (tx.chainId !== undefined) quantity(tx.chainId);
  if (tx.type !== undefined) quantity(tx.type);
  if (tx.authorizationList !== undefined) {
    if (!Array.isArray(tx.authorizationList) || tx.authorizationList.length > 32) throw new TypeError('INVALID_AUTHORIZATION_LIST');
    tx.authorizationList = tx.authorizationList.map(item => {
      const auth = select(item, ['chainId','address','nonce','yParity','r','s']);
      address(auth.address);
      for (const key of ['chainId','nonce','yParity']) quantity(auth[key]);
      for (const key of ['r','s']) {
        if (typeof auth[key] !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(auth[key] as string)) throw new TypeError('INVALID_AUTHORIZATION_SIGNATURE');
      }
      return auth;
    });
  }
  return tx;
}
function cleanReceipt(input: unknown): Record<string, unknown> {
  const receipt = select(input, RECEIPT_KEYS);
  hash32(receipt.transactionHash); hash32(receipt.blockHash);
  quantity(receipt.blockNumber); quantity(receipt.transactionIndex); quantity(receipt.status);
  address(receipt.from); if (receipt.to !== null) address(receipt.to);
  if (!Array.isArray(receipt.logs) || receipt.logs.length > 2048) throw new TypeError('INVALID_LOGS');
  receipt.logs = receipt.logs.map(item => {
    const log = select(item, LOG_KEYS);
    address(log.address); hexData(log.data);
    hash32(log.blockHash); hash32(log.transactionHash);
    for (const key of ['blockNumber','transactionIndex','logIndex']) quantity(log[key]);
    if (typeof log.removed !== 'boolean' || !Array.isArray(log.topics) || log.topics.length > 4) throw new TypeError('INVALID_LOG');
    log.topics.forEach(topic => hash32(topic));
    return log;
  });
  return receipt;
}
function cleanBlock(input: unknown): Record<string, unknown> {
  const block = select(input, BLOCK_KEYS);
  hash32(block.hash); hash32(block.parentHash); quantity(block.number); quantity(block.timestamp);
  if (!Array.isArray(block.transactions) || block.transactions.length > 20_000) throw new TypeError('INVALID_BLOCK');
  block.transactions.forEach(tx => hash32(tx));
  return block;
}

export function sealEvidence(payload: EvidencePayload): EvidenceBundle {
  return {...payload, digest: digestJson(payload)};
}
export function parseEvidence(input: unknown): EvidenceBundle {
  const obj = requireRecord(input, 'evidence');
  const keys = ['schemaVersion','evidenceClass','chainId','transactionHash','acquiredAt','rpcChainId','transaction','receipt','block','canonicalBlockHash','state','collectionErrors','digest'];
  if (Object.keys(obj).some(x => !keys.includes(x)) || keys.some(x => !Object.hasOwn(obj,x))) throw new TypeError('INVALID_EVIDENCE_FIELDS');
  if (obj.schemaVersion !== 'aftercheck.evidence.v1' || !['RPC_RECEIPT','SYNTHETIC_RPC_FIXTURE'].includes(obj.evidenceClass as string)) throw new TypeError('UNSUPPORTED_EVIDENCE_SCHEMA');
  if (obj.chainId !== 11155111) throw new TypeError('UNSUPPORTED_CHAIN');
  hash32(obj.transactionHash);
  if (typeof obj.acquiredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(obj.acquiredAt) || !Number.isFinite(Date.parse(obj.acquiredAt))) throw new TypeError('INVALID_CAPTURE_TIME');
  if (!Array.isArray(obj.state) || obj.state.length > 24 || !Array.isArray(obj.collectionErrors) || obj.collectionErrors.length > 40) throw new TypeError('INVALID_EVIDENCE_OBSERVATIONS');
  for (const value of obj.state) {
    const state = requireRecord(value, 'state');
    if (Object.keys(state).some(k => !['key','method','params','result','error'].includes(k)) || typeof state.key !== 'string' || !/^[a-zA-Z0-9.]{1,64}$/.test(state.key) || !['eth_call','eth_getCode'].includes(state.method as string) || !Array.isArray(state.params) || state.params.length !== 2 || (Object.hasOwn(state,'result') === Object.hasOwn(state,'error'))) throw new TypeError('INVALID_STATE_OBSERVATION');
    if (state.result !== undefined) hexData(state.result, 65_536);
    if (state.error !== undefined && (typeof state.error !== 'string' || !/^[A-Z_]{1,64}$/.test(state.error))) throw new TypeError('INVALID_STATE_ERROR');
  }
  for (const value of obj.collectionErrors) {
    const error = requireRecord(value, 'collectionError');
    if (Object.keys(error).some(k => !['stage','code'].includes(k)) || typeof error.stage !== 'string' || !/^[a-zA-Z0-9.]{1,64}$/.test(error.stage) || typeof error.code !== 'string' || !/^[A-Z_]{1,64}$/.test(error.code)) throw new TypeError('INVALID_COLLECTION_ERROR');
  }
  const {digest, ...payload} = obj;
  if (hash32(digest) !== digestJson(payload)) throw new TypeError('EVIDENCE_DIGEST_MISMATCH');
  canonicalJson(obj);
  return obj as unknown as EvidenceBundle;
}

export function validateReceiptIdentity(input: unknown): {execution: 'SUCCEEDED'|'REVERTED'|'PENDING'|'UNKNOWN'; coverage:'COMPLETE'|'PARTIAL'|'CONFLICTED'; reason?:string} {
  let execution: 'SUCCEEDED'|'REVERTED'|'PENDING'|'UNKNOWN' = 'UNKNOWN';
  try {
    const e = requireRecord(input, 'evidence');
    const target = hash32(e.transactionHash);
    if (e.chainId !== 11155111) throw new Error('CHAIN_ID_CONFLICT');
    if (e.rpcChainId === null) return {execution,coverage:'PARTIAL',reason:'CHAIN_ID_UNAVAILABLE'};
    if (quantity(e.rpcChainId) !== 11155111n) throw new Error('CHAIN_ID_CONFLICT');
    if (e.transaction === null) return {execution:'UNKNOWN',coverage:'PARTIAL',reason:'TRANSACTION_NOT_FOUND'};
    const tx = requireRecord(e.transaction, 'transaction');
    if (hash32(tx.hash) !== target) throw new Error('TRANSACTION_HASH_CONFLICT');
    address(tx.from); if (tx.to !== null) address(tx.to);
    hexData(tx.input); quantity(tx.value);
    if (tx.chainId !== undefined && quantity(tx.chainId) !== 11155111n) throw new Error('TRANSACTION_CHAIN_CONFLICT');
    if (tx.type !== undefined) quantity(tx.type);
    if (e.receipt === null) return {execution:tx.blockHash === null ? 'PENDING':'UNKNOWN',coverage:'PARTIAL',reason:'RECEIPT_MISSING'};
    const receipt = requireRecord(e.receipt, 'receipt');
    const receiptExecution = receipt.status === '0x1' ? 'SUCCEEDED' : receipt.status === '0x0' ? 'REVERTED' : 'UNKNOWN';
    if (receiptExecution === 'UNKNOWN') throw new Error('INVALID_RECEIPT_STATUS');
    if (hash32(receipt.transactionHash) !== target) throw new Error('RECEIPT_TRANSACTION_CONFLICT');
    const bh = hash32(tx.blockHash), bn = quantity(tx.blockNumber), ti = quantity(tx.transactionIndex);
    if (hash32(receipt.blockHash) !== bh || quantity(receipt.blockNumber) !== bn || quantity(receipt.transactionIndex) !== ti) throw new Error('RECEIPT_BLOCK_CONFLICT');
    if (address(receipt.from) !== address(tx.from) || (receipt.to === null ? null:address(receipt.to)) !== (tx.to === null?null:address(tx.to))) throw new Error('RECEIPT_PARTICIPANT_CONFLICT');
    execution = receiptExecution;
    if (!Array.isArray(receipt.logs) || receipt.logs.length > 2048) throw new Error('INVALID_RECEIPT_LOGS');
    let previous = -1n;
    for (const value of receipt.logs) {
      const log = requireRecord(value, 'log');
      if (hash32(log.transactionHash) !== target || hash32(log.blockHash) !== bh || quantity(log.blockNumber) !== bn || quantity(log.transactionIndex) !== ti || log.removed !== false) throw new Error('LOG_IDENTITY_CONFLICT');
      const index = quantity(log.logIndex); if (index <= previous) throw new Error('LOG_ORDER_CONFLICT'); previous = index;
      address(log.address); hexData(log.data);
      if (!Array.isArray(log.topics) || log.topics.length > 4) throw new Error('INVALID_LOG_TOPICS');
      log.topics.forEach(x => hash32(x));
    }
    if (execution === 'REVERTED' && receipt.logs.length !== 0) throw new Error('REVERTED_LOGS_CONFLICT');
    if (e.block === null) return {execution,coverage:'PARTIAL',reason:'BLOCK_MISSING'};
    const block = requireRecord(e.block,'block');
    if (hash32(block.hash) !== bh || quantity(block.number) !== bn) throw new Error('BLOCK_IDENTITY_CONFLICT');
    hash32(block.parentHash); quantity(block.timestamp);
    if (!Array.isArray(block.transactions) || block.transactions.length > 20_000 || ti >= BigInt(block.transactions.length)) throw new Error('BLOCK_TRANSACTION_INDEX_CONFLICT');
    const hashes = block.transactions.map(x => hash32(x));
    if (new Set(hashes).size !== hashes.length || hashes[Number(ti)] !== target) throw new Error('BLOCK_TRANSACTION_CONFLICT');
    if (e.canonicalBlockHash === null) return {execution,coverage:'PARTIAL',reason:'CANONICAL_BLOCK_UNAVAILABLE'};
    if (hash32(e.canonicalBlockHash) !== bh) throw new Error('CANONICAL_BLOCK_CONFLICT');
    if (!Array.isArray(e.collectionErrors)) throw new Error('INVALID_COLLECTION_ERRORS');
    if (e.collectionErrors.some(item => requireRecord(item,'collectionError').code === 'CHAIN_ID_CONFLICT')) throw new Error('CHAIN_ID_CONFLICT');
    if (e.collectionErrors.length !== 0) return {execution,coverage:'PARTIAL',reason:'COLLECTION_INCOMPLETE'};
    return {execution,coverage:'COMPLETE'};
  } catch (error) {
    const reason = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'MALFORMED_RECEIPT_IDENTITY';
    return {execution,coverage:'CONFLICTED',reason};
  }
}

export async function collectReceipt(client: RpcReader, transactionHash: string): Promise<EvidencePayload> {
  hash32(transactionHash);
  const e: EvidencePayload = {schemaVersion:'aftercheck.evidence.v1',evidenceClass:'RPC_RECEIPT',chainId:11155111,transactionHash:transactionHash.toLowerCase(),acquiredAt:new Date().toISOString(),rpcChainId:null,transaction:null,receipt:null,block:null,canonicalBlockHash:null,state:[],collectionErrors:[]};
  async function read(stage: string, method: string, params: unknown[]): Promise<unknown> {
    try { return await client.call(method,params); }
    catch (error) { e.collectionErrors.push({stage,code:error instanceof RpcError?error.code:'RPC_READ_FAILED'}); return null; }
  }
  const chain = await read('chain','eth_chainId',[]);
  if (chain !== null) { try { quantity(chain); e.rpcChainId=chain as string; } catch { e.collectionErrors.push({stage:'chain',code:'MALFORMED_CHAIN_ID'}); } }
  if (e.rpcChainId === null || quantity(e.rpcChainId) !== 11155111n) return e;
  const tx = await read('transaction','eth_getTransactionByHash',[e.transactionHash]);
  const receipt = await read('receipt','eth_getTransactionReceipt',[e.transactionHash]);
  try { if (tx !== null) e.transaction=cleanTransaction(tx); } catch { e.collectionErrors.push({stage:'transaction',code:'MALFORMED_TRANSACTION'}); }
  try {
    if (receipt !== null) {
      e.receipt=cleanReceipt(receipt);
    }
  } catch { e.receipt=null; e.collectionErrors.push({stage:'receipt',code:'MALFORMED_RECEIPT'}); }
  if (e.transaction?.blockHash !== null && e.transaction?.blockHash !== undefined) {
    try {
      const bh = hash32(e.transaction.blockHash);
      const block = await read('block','eth_getBlockByHash',[bh,false]);
      if (block !== null) e.block=cleanBlock(block);
      const bn = e.transaction.blockNumber; quantity(bn);
      const canonical = await read('canonicalBlock','eth_getBlockByNumber',[bn,false]);
      if (canonical !== null) e.canonicalBlockHash=hash32(requireRecord(canonical,'block').hash);
    } catch { e.collectionErrors.push({stage:'block',code:'MALFORMED_BLOCK'}); }
  }
  return e;
}
