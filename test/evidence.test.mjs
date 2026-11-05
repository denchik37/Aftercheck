import test from 'node:test';
import assert from 'node:assert/strict';
import {collectReceipt,validateReceiptIdentity,sealEvidence,parseEvidence} from '../src/evidence.ts';
import {RpcError} from '../src/rpc.ts';
import {canonicalJson,parseJson} from '../src/json.ts';
import {receiptFixture,fixtureReader,hash} from './helpers/receipt-fixture.mjs';

test('collector binds actual transaction, receipt, ordered logs and block membership',async()=>{
  const reader=fixtureReader();const e=await collectReceipt(reader,hash('a'));
  assert.deepEqual(validateReceiptIdentity(e),{execution:'SUCCEEDED',coverage:'COMPLETE'});
  assert.equal(e.receipt.logs[0].logIndex,'0x10');
  assert.deepEqual(reader.calls.map(x=>x.method),['eth_chainId','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByHash','eth_getBlockByNumber']);
});
test('missing transaction, missing receipt and pending transaction remain partial',async()=>{
  const missing=await collectReceipt(fixtureReader({eth_getTransactionByHash:null,eth_getTransactionReceipt:null}),hash('a'));
  assert.equal(validateReceiptIdentity(missing).reason,'TRANSACTION_NOT_FOUND');
  const receiptMissing=await collectReceipt(fixtureReader({eth_getTransactionReceipt:null}),hash('a'));
  assert.equal(validateReceiptIdentity(receiptMissing).execution,'UNKNOWN');
  const pending=receiptFixture();pending.transaction.blockHash=null;pending.transaction.blockNumber=null;pending.transaction.transactionIndex=null;
  const e=await collectReceipt(fixtureReader({eth_getTransactionByHash:pending.transaction,eth_getTransactionReceipt:null}),hash('a'));
  assert.equal(validateReceiptIdentity(e).execution,'PENDING');
});
test('wrong chain stops further collection and transport errors remain sanitized partial observations',async()=>{
  const reader=fixtureReader({eth_chainId:'0x1'});const e=await collectReceipt(reader,hash('a'));
  assert.equal(reader.calls.length,1);assert.equal(validateReceiptIdentity(e).coverage,'CONFLICTED');
  const unavailable=await collectReceipt(fixtureReader({eth_getTransactionReceipt:new RpcError('RPC_TIMEOUT')}),hash('a'));
  assert.deepEqual(unavailable.collectionErrors,[{stage:'receipt',code:'RPC_TIMEOUT'}]);
  assert.equal(validateReceiptIdentity(unavailable).coverage,'PARTIAL');
});
test('receipt/block/chain/hash/index conflicts, duplicate logs and malformed hex fail closed',()=>{
  const mutations=[e=>e.receipt.transactionHash=hash('c'),e=>e.receipt.blockHash=hash('c'),e=>e.receipt.transactionIndex='0x2',e=>e.transaction.chainId='0x1',e=>e.canonicalBlockHash=hash('c'),e=>e.block.transactions.reverse(),e=>e.receipt.logs.push({...e.receipt.logs[0]}),e=>e.receipt.logs[0].removed=true,e=>e.transaction.input='0xabc',e=>e.transaction.value='0x00',e=>e.receipt.logs[0].data='0xzz',e=>e.receipt.logs[0].topics=[hash('a')+'00'],e=>e.receipt.from='0x'+'9'.repeat(40)];
  for(const mutate of mutations){const e=receiptFixture();mutate(e);assert.equal(validateReceiptIdentity(e).coverage,'CONFLICTED');}
});
test('reverted receipt has no successful effects and cannot carry logs',()=>{
  const e=receiptFixture();e.receipt.status='0x0';e.receipt.logs=[];
  assert.deepEqual(validateReceiptIdentity(e),{execution:'REVERTED',coverage:'COMPLETE'});
  e.receipt.logs=receiptFixture().receipt.logs;
  assert.equal(validateReceiptIdentity(e).coverage,'CONFLICTED');
});
test('portable digest detects tampering and canonical replay ignores JSON object order',()=>{
  const bundle=sealEvidence(receiptFixture());
  const parsed=parseEvidence(parseJson(canonicalJson(bundle)));
  assert.equal(parsed.digest,bundle.digest);
  const tampered=structuredClone(bundle);tampered.transaction.value='0x1';
  assert.throws(()=>parseEvidence(tampered),/DIGEST_MISMATCH/);
  const extra={...bundle,unsupported:true};assert.throws(()=>parseEvidence(extra),/FIELDS/);
  const missing={...bundle};delete missing.block;assert.throws(()=>parseEvidence(missing),/FIELDS/);
});
test('collector strips unneeded provider extras and retains resource failure',async()=>{
  const e=receiptFixture();e.transaction.providerDebug='PRIVATE_ENDPOINT';e.receipt.logs[0].providerDebug='PRIVATE_ENDPOINT';
  const collected=await collectReceipt(fixtureReader({eth_getTransactionByHash:e.transaction,eth_getTransactionReceipt:e.receipt}),hash('a'));
  assert.doesNotMatch(JSON.stringify(collected),/PRIVATE_ENDPOINT/);
  e.receipt.logs=Array.from({length:2049},()=>e.receipt.logs[0]);
  const oversized=await collectReceipt(fixtureReader({eth_getTransactionReceipt:e.receipt}),hash('a'));
  assert.ok(oversized.collectionErrors.some(x=>x.code==='MALFORMED_RECEIPT'));
});
test('malformed provider fields cannot export arbitrary echoed credentials',async()=>{
  const e=receiptFixture();e.transaction.input='https://provider.invalid/SECRET_IN_INVALID_RESULT';
  e.receipt.logs[0].data='SECRET_IN_INVALID_RESULT';e.block.transactions=['SECRET_IN_INVALID_RESULT'];
  const result=await collectReceipt(fixtureReader({eth_getTransactionByHash:e.transaction,eth_getTransactionReceipt:e.receipt,eth_getBlockByHash:e.block}),hash('a'));
  assert.doesNotMatch(JSON.stringify(result),/SECRET_IN_INVALID_RESULT|provider.invalid/);
  assert.equal(result.transaction,null);assert.equal(result.receipt,null);
});
test('unavailable chain is partial and a foreign receipt cannot establish target execution',async()=>{
  const e=await collectReceipt(fixtureReader({eth_chainId:new RpcError('RPC_TIMEOUT')}),hash('a'));
  assert.deepEqual(validateReceiptIdentity(e),{execution:'UNKNOWN',coverage:'PARTIAL',reason:'CHAIN_ID_UNAVAILABLE'});
  const foreign=receiptFixture();foreign.receipt.transactionHash=hash('f');
  assert.equal(validateReceiptIdentity(foreign).execution,'UNKNOWN');
  assert.equal(validateReceiptIdentity(foreign).coverage,'CONFLICTED');
});
