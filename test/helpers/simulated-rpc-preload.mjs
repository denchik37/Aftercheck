import {rpcFixture} from './uniswap-fixture.mjs';
import {canonicalJson} from '../../src/json.ts';

// Intercept only this test process's fetch. Responses are SIMULATED, not chain
// observations. No network request leaves the child process.
const e = rpcFixture();
let canonicalReads = 0;
const scenario = process.env.AFTERCHECK_TEST_RPC_SCENARIO ?? 'complete';
globalThis.fetch = async (endpoint, init) => {
  if (!String(endpoint).startsWith('https://simulated-rpc.invalid/')) {
    throw new Error('UNEXPECTED_RPC_ENDPOINT');
  }
  const request = JSON.parse(init.body);
  if (request.method.startsWith('eth_send')) throw new Error('SIGNING_OR_BROADCAST_FORBIDDEN');
  const method = request.method, params = request.params;
  if (scenario === 'unavailable-chain' && method === 'eth_chainId') {
    return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32000,message:'private provider message'}}));
  }
  if (scenario === 'missing-history' && method === 'eth_call') {
    return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32000,message:'history unavailable'}}));
  }
  let result;
  if (method === 'eth_chainId') result = e.rpcChainId;
  else if (method === 'eth_getTransactionByHash') result = e.transaction;
  else if (method === 'eth_getTransactionReceipt') result = e.receipt;
  else if (method === 'eth_getBlockByHash') result = e.block;
  else if (method === 'eth_getBlockByNumber') {
    canonicalReads++;
    result = scenario === 'reorg' && canonicalReads > 1
      ? {...e.block,hash:'0x'+'f'.repeat(64)} : e.block;
  } else result = e.state.find(s=>s.method === method &&
    canonicalJson(s.params) === canonicalJson(params))?.result;
  return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
};
