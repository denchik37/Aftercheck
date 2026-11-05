import test from 'node:test';
import assert from 'node:assert/strict';
import {rawAmount, positiveAmount, address, hash32, chainId} from '../src/values.ts';
import {parsePolicy} from '../src/policy.ts';
const a=(digit)=>'0x'+digit.repeat(40);
const policy={schemaVersion:'aftercheck.policy.v1',chainId:11155111,owner:a('1'),expectedRecipient:a('2'),tokenIn:a('3'),tokenOut:a('4'),maxInputRaw:'90071992547409935',minReceivedRaw:'1'};

test('amounts exceeding 2^53 remain exact integers',()=>{
  assert.equal(rawAmount('90071992547409935')-rawAmount('90071992547409934'),1n);
  assert.equal(rawAmount('0'),0n);
  assert.equal(rawAmount(((1n<<256n)-1n).toString()),(1n<<256n)-1n);
});
test('strict canonical raw units reject decimals, signs, booleans and unsafe types',()=>{
 for(const v of ['00','01',' 1','1 ','1.0','1e3','-1','+1','',1,1n,true,null,[],{}]){
   assert.throws(()=>rawAmount(v),{name:'TypeError'});
 }
 assert.throws(()=>rawAmount((1n<<256n).toString()),{name:'RangeError'});
 assert.throws(()=>positiveAmount('0'),{name:'RangeError'});
});
test('validates normalized EVM identifiers and chain IDs',()=>{
 assert.equal(address(a('A')),a('a'));
 assert.equal(hash32('0x'+'AB'.repeat(32)),'0x'+'ab'.repeat(32));
 for(const invalid of ['0x','0x'+'2'.repeat(39),12,null])assert.throws(()=>address(invalid));
 for(const invalid of [0,-1,0.5,Number.MAX_SAFE_INTEGER+1,'1',null])assert.throws(()=>chainId(invalid));
});
test('policy normalization accepts explicit exact limits and optional reserve',()=>{
 const p=parsePolicy({...policy, reserveFloorRaw:'0'});
 assert.equal(p.maxInputRaw,'90071992547409935');
 assert.equal(p.reserveFloorRaw,'0');
 assert.equal(p.tokenIn,a('3'));
});
test('rejects unsupported policy schema, equal token pair, malformed values',()=>{
 assert.throws(()=>parsePolicy({...policy,schemaVersion:'wrong'}));
 assert.throws(()=>parsePolicy({...policy,tokenOut:a('3')}));
 assert.throws(()=>parsePolicy({...policy,maxInputRaw:'0'}));
 assert.throws(()=>parsePolicy({...policy,owner:'0x123'}));
 assert.throws(()=>parsePolicy({...policy,ignoredLimit:'1'}),/Unknown policy field/);
 assert.throws(()=>rawAmount('9'.repeat(10000)));
 assert.throws(()=>parsePolicy([]));
});
