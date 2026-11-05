import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJson,canonicalJson,digestJson} from '../src/json.ts';

test('restricted JSON parses standard values without decimal financial coercion',()=>{
  assert.equal(canonicalJson(parseJson('{"b":[true,null,-3,"90071992547409935"],"a":"x\\\"y"}')),'{"a":"x\\\"y","b":[true,null,-3,"90071992547409935"]}');
  assert.equal(digestJson({b:2,a:1}),digestJson({a:1,b:2}));
  assert.notEqual(digestJson({a:[1,2]}),digestJson({a:[2,1]}));
});
test('duplicate, escaped duplicate and prototype keys are rejected before normalization',()=>{
  for(const text of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"nested":{"__proto__":{}}}','{"constructor":1}','{"prototype":1}']) assert.throws(()=>parseJson(text),/DUPLICATE|UNSAFE/);
});
test('malformed, unsafe-number, excessive-depth and oversized JSON fail closed',()=>{
  for(const text of ['','01','-0','1.5','1e3','9007199254740993','{"a":1,}','[1,]','true false','"\n"','"unterminated']) assert.throws(()=>parseJson(text));
  assert.throws(()=>parseJson('['.repeat(50)+'0'+']'.repeat(50)),/COMPLEXITY/);
  assert.throws(()=>parseJson('"abc"',4),/SIZE/);
  for(const value of [1n,undefined,Infinity,1.2,new Date(),{a:undefined}]) assert.throws(()=>canonicalJson(value));
});
