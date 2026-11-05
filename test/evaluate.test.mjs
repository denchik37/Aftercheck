import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../src/evaluate.ts';

const a=(n)=>'0x'+n.repeat(40);
const hash=(n)=>'0x'+n.repeat(64);
const policy={schemaVersion:'aftercheck.policy.v1',chainId:11155111,owner:a('1'),expectedRecipient:a('2'),tokenIn:a('3'),tokenOut:a('4'),maxInputRaw:'600',minReceivedRaw:'300'};
const observation={
  schemaVersion:'aftercheck.observation.v1', evidenceClass:'SYNTHETIC_FIXTURE',chainId:11155111,
  transactionHash:hash('a'),blockHash:hash('b'),receiptStatus:'SUCCEEDED',
  swap:{kind:'UNISWAP_V3_ROUTER02_EXACT_INPUT_SINGLE',owner:a('1'),recipient:a('2'),tokenIn:a('3'),tokenOut:a('4'),pool:a('5'),amountInRaw:'500',amountOutRaw:'350',transfers:[
    {token:a('3'),from:a('1'),to:a('5'),amountRaw:'500'},
    {token:a('4'),from:a('5'),to:a('2'),amountRaw:'350'}]}
};
const obs=(mod)=>({...structuredClone(observation),...mod});
const swap=(mod)=>obs({swap:{...structuredClone(observation.swap),...mod}});

test('coherent explicitly SYNTHETIC receipt is only a test-profile PASS',()=>{
 const r=evaluate(observation,policy);
 assert.equal(r.execution,'SUCCEEDED'); assert.equal(r.support,'SUPPORTED_TEST_PROFILE');
 assert.equal(r.verdict,'PASS');assert.equal(r.coverage,'COMPLETE');
 assert.equal(r.evidenceClass,'SYNTHETIC_FIXTURE');
 assert.match(r.limitations.join(' '),/not an authenticated onchain receipt/);
 assert.equal(r.checks.filter(c=>c.result==='PASS').length,5);
});
test('a synthetically successful swap can violate input cap or output floor',()=>{
 assert.equal(evaluate(observation,{...policy,maxInputRaw:'499'}).verdict,'VIOLATION');
 assert.equal(evaluate(observation,{...policy,minReceivedRaw:'351'}).verdict,'VIOLATION');
});
test('declared owner, recipient and token-pair mismatches are VIOLATION',()=>{
 for(const [field,bad] of [['owner',a('6')],['expectedRecipient',a('7')],['tokenOut',a('8')]]){
   const r=evaluate(observation,{...policy,[field]:bad});
   assert.equal(r.verdict,'VIOLATION');
   assert.ok(r.checks.some(c=>c.result==='VIOLATION'));
 }
});
test('reserve is UNKNOWN, never silently inferred from receipt scoped evidence',()=>{
 const r=evaluate(observation,{...policy,reserveFloorRaw:'200'});
 assert.equal(r.verdict,'UNKNOWN'); assert.equal(r.coverage,'PARTIAL');
 assert.equal(r.checks.find(c=>c.id==='reserveFloorRaw').result,'UNKNOWN');
});
test('known violation survives unknown reserve check',()=>{
 const r=evaluate(observation,{...policy,maxInputRaw:'400',reserveFloorRaw:'200'});
 assert.equal(r.verdict,'VIOLATION');
 assert.equal(r.checks.find(c=>c.id==='reserveFloorRaw').result,'UNKNOWN');
});
test('unverified RPC-labeled input cannot become PASS by changing a label',()=>{
 const r=evaluate(obs({evidenceClass:'RPC_RECEIPT'}),policy);
 assert.equal(r.verdict,'UNKNOWN');assert.equal(r.support,'UNSUPPORTED');
});
test('PENDING and REVERTED receipts cannot pass',()=>{
 for(const receiptStatus of ['PENDING','REVERTED']){
   const r=evaluate(obs({receiptStatus}),policy);
   assert.equal(r.verdict,'UNKNOWN');assert.equal(r.execution,receiptStatus);
 }
});
test('wrong chain or block identity produces conflicted UNKNOWN',()=>{
 for(const changes of [{chainId:1},{blockHash:'0xdead'}]){
   const r=evaluate(obs(changes),policy);
   assert.equal(r.verdict,'UNKNOWN');assert.equal(r.coverage,'CONFLICTED');
 }
});
test('unsupported route, absent swap, or absent transfer edge never pass',()=>{
 assert.equal(evaluate(swap({kind:'MULTICALL'}),policy).verdict,'UNKNOWN');
 assert.equal(evaluate(obs({swap:null}),policy).verdict,'UNKNOWN');
 assert.equal(evaluate(swap({transfers:observation.swap.transfers.slice(0,1)}),policy).verdict,'UNKNOWN');
});
test('conflicting event amounts and token addresses force UNKNOWN',()=>{
 const corrupted=structuredClone(observation.swap.transfers);corrupted[1].amountRaw='349';
 const r=evaluate(swap({transfers:corrupted}),policy);
 assert.equal(r.verdict,'UNKNOWN');assert.equal(r.coverage,'CONFLICTED');
});
test('exact boundary comparisons above 2^53 cannot round across threshold',()=>{
 const large='90071992547409935';
 const t=structuredClone(observation.swap.transfers);t[0].amountRaw=large;
 const r=evaluate(swap({amountInRaw:large,transfers:t}),{...policy,maxInputRaw:'90071992547409934'});
 assert.equal(r.verdict,'VIOLATION');
});
test('invalid numeric input cannot silently coerce',()=>{
 const r=evaluate(swap({amountInRaw:500}),policy);
 assert.equal(r.verdict,'UNKNOWN');assert.equal(r.coverage,'CONFLICTED');
});
