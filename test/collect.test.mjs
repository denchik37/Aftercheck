import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSupportedEvidence} from '../src/collect.ts';
import {parseEvidence,validateReceiptIdentity} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {RpcError} from '../src/rpc.ts';
import {rpcFixture,policyFixture,transactionHash} from './helpers/uniswap-fixture.mjs';
import {canonicalJson} from '../src/json.ts';

function readerFor(e, mutate=()=>{}) {
  return {calls:[],async call(method,params) {
    this.calls.push({method,params});
    let result;
    if(method==='eth_chainId')result=e.rpcChainId;
    else if(method==='eth_getTransactionByHash')result=e.transaction;
    else if(method==='eth_getTransactionReceipt')result=e.receipt;
    else if(method==='eth_getBlockByHash'||method==='eth_getBlockByNumber')result=e.block;
    else result=e.state.find(s=>s.method===method&&canonicalJson(s.params)===canonicalJson(params))?.result;
    const changed=mutate({method,params,result,calls:this.calls});
    return structuredClone(changed===undefined?result:changed);
  }};
}
test('read-only collection completes 12 hash-bound protocol reads and replays exact fixture amounts',async()=>{
  const reader=readerFor(rpcFixture());
  const bundle=await collectSupportedEvidence(reader,transactionHash);
  assert.equal(bundle.state.length,12);assert.equal(reader.calls.length,19);
  assert.equal(parseEvidence(bundle).digest,bundle.digest);
  assert.equal(validateReceiptIdentity(bundle).coverage,'COMPLETE');
  assert.ok(bundle.state.every(s=>s.params[1].requireCanonical===true));
  // The fake transport exercises the capture code. Relabel explicitly before it
  // can be used as a saved regression artifact; it is not authentic chain data.
  const report=verifyEvidence(bundle,policyFixture());
  assert.equal(report.verdict,'PASS');assert.equal(report.protocol.amountInRaw,'500');
  assert.equal(report.protocol.amountOutRaw,'350');
});
test('unavailable historical calls remain UNKNOWN with no latest or number-only fallback',async()=>{
  const reader=readerFor(rpcFixture(),({method})=>{if(method==='eth_call')throw new RpcError('RPC_REMOTE_ERROR');});
  const bundle=await collectSupportedEvidence(reader,transactionHash);
  assert.equal(verifyEvidence(bundle,policyFixture()).verdict,'UNKNOWN');
  assert.ok(bundle.state.some(s=>s.error==='RPC_REMOTE_ERROR'));
  assert.ok(reader.calls.filter(x=>x.method==='eth_call'||x.method==='eth_getCode').every(x=>typeof x.params[1]==='object'));
});
test('post-state-read reorg and changed chain invalidate collection',async()=>{
  const e=rpcFixture();
  const reorg=readerFor(e,({method,calls})=>{if(method==='eth_getBlockByNumber'&&calls.length>10)return {...e.block,hash:'0x'+'f'.repeat(64)};});
  const chain=readerFor(e,({method,calls})=>{if(method==='eth_chainId'&&calls.length>10)return '0x1';});
  for(const reader of [reorg,chain]){
    const bundle=await collectSupportedEvidence(reader,transactionHash);
    const report=verifyEvidence(bundle,policyFixture());
    assert.equal(report.verdict,'UNKNOWN');assert.equal(report.coverage,'CONFLICTED');
  }
});
test('malformed state result is sanitized and not exported as arbitrary provider text',async()=>{
  const reader=readerFor(rpcFixture(),({method})=>method==='eth_getCode'?'secret-bearing-provider-message':undefined);
  const bundle=await collectSupportedEvidence(reader,transactionHash);
  assert.doesNotMatch(canonicalJson(bundle),/secret-bearing/);
  assert.ok(bundle.state.some(x=>x.error==='MALFORMED_STATE_RESULT'));
  assert.equal(verifyEvidence(bundle,policyFixture()).verdict,'UNKNOWN');
});
