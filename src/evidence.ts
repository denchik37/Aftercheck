import {hash32, address, requireRecord} from './values.ts';
import {digestJson} from './json.ts';
import {RpcError} from './rpc.ts';
import {quantity, hexData, validateEvidenceShape, type RpcReader, type EvidencePayload, type EvidenceBundle} from './evidence-core.ts';
export {quantity, hexData, validateReceiptIdentity, type RpcReader, type StateObservation, type EvidencePayload, type EvidenceBundle} from './evidence-core.ts';

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
/** Synchronous Node adapter: the same schema and identity rules used in browsers. */
export function parseEvidence(input: unknown): EvidenceBundle {
  const {evidence, payload, digest} = validateEvidenceShape(input);
  if (digest !== digestJson(payload)) throw new TypeError('EVIDENCE_DIGEST_MISMATCH');
  return evidence;
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
