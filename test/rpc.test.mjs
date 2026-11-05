import test from 'node:test';
import assert from 'node:assert/strict';
import {RpcClient} from '../src/rpc.ts';
const endpoint='https://rpc.example.invalid/PRIVATE_KEY_DO_NOT_EXPORT';
const respond = body => async()=>new Response(body,{headers:{'content-type':'application/json'}});

test('RPC permits read methods and binds request/response ids',async()=>{
  let request;
  const rpc=new RpcClient(endpoint,{fetchImpl:async(url,init)=>{request=JSON.parse(init.body);assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:'0xaa36a7'}));}});
  assert.equal(await rpc.call('eth_chainId',[]),'0xaa36a7');
  assert.deepEqual(request,{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]});
  await assert.rejects(rpc.call('eth_sendRawTransaction',[]),/METHOD_NOT_ALLOWED/);
  await assert.rejects(new RpcClient(endpoint,{fetchImpl:respond('{"jsonrpc":"2.0","id":2,"result":"0x1"}')}).call('eth_chainId',[]),/INVALID_ENVELOPE/);
});
test('RPC errors and invalid JSON never expose provider messages or URL credentials',async()=>{
  for(const fetchImpl of [respond('{"jsonrpc":"2.0","id":1,"error":{"message":"PRIVATE_KEY_DO_NOT_EXPORT"}}'),async()=>{throw Error(endpoint);},respond('{"jsonrpc":"2.0","id":1,"result":1,"result":2}')]) {
    await assert.rejects(new RpcClient(endpoint,{fetchImpl}).call('eth_chainId',[]),error=>{assert.doesNotMatch(error.message,/PRIVATE_KEY|example.invalid/);return /^RPC_/.test(error.code);});
  }
});
test('RPC enforces streamed response, read-count and timeout budgets',async()=>{
  await assert.rejects(new RpcClient(endpoint,{fetchImpl:respond('x'.repeat(51)),maxResponseBytes:50}).call('eth_chainId',[]),/TOO_LARGE/);
  const client=new RpcClient(endpoint,{fetchImpl:async(url,init)=>new Response(JSON.stringify({jsonrpc:'2.0',id:JSON.parse(init.body).id,result:'0x1'}))});
  for(let n=0;n<32;n++)await client.call('eth_chainId',[]);
  await assert.rejects(client.call('eth_chainId',[]),/BUDGET/);
  const never=async(url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});
  await assert.rejects(new RpcClient(endpoint,{fetchImpl:never,timeoutMs:10}).call('eth_chainId',[]),/TIMEOUT/);
});
test('unsecured nonlocal endpoints and non-HTTP protocols are rejected',()=>{
  for(const url of ['file:///etc/passwd','http://example.com','bad url','https://example.com/#fragment'])assert.throws(()=>new RpcClient(url));
  assert.doesNotThrow(()=>new RpcClient('http://127.0.0.1:8545'));
});
