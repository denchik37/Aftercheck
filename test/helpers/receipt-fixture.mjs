export const hash = n => '0x' + n.repeat(64);
export const addr = n => '0x' + n.repeat(40);
export function receiptFixture() {
  const transactionHash = hash('a'), blockHash = hash('b');
  const identity = {transactionHash,blockHash,blockNumber:'0x123',transactionIndex:'0x1'};
  return {
    schemaVersion:'aftercheck.evidence.v1',evidenceClass:'SYNTHETIC_RPC_FIXTURE',chainId:11155111,
    acquiredAt:'2026-11-05T16:00:00.000Z',transactionHash,rpcChainId:'0xaa36a7',
    transaction:{hash:transactionHash,from:addr('1'),to:addr('2'),input:'0x04e45aaf',value:'0x0',blockHash,blockNumber:'0x123',transactionIndex:'0x1',chainId:'0xaa36a7',type:'0x2'},
    receipt:{...identity,from:addr('1'),to:addr('2'),status:'0x1',logs:[{...identity,address:addr('3'),topics:[hash('c')],data:'0x',logIndex:'0x10',removed:false}]},
    block:{hash:blockHash,number:'0x123',parentHash:hash('c'),timestamp:'0x12345',transactions:[hash('d'),transactionHash]},
    canonicalBlockHash:blockHash,state:[],collectionErrors:[]
  };
}
export function fixtureReader(changes={}) {
  const e=receiptFixture();
  const results={eth_chainId:e.rpcChainId,eth_getTransactionByHash:e.transaction,eth_getTransactionReceipt:e.receipt,eth_getBlockByHash:e.block,eth_getBlockByNumber:e.block,...changes};
  return {calls:[],async call(method,params){this.calls.push({method,params}); const result=results[method]; if(result instanceof Error)throw result; return structuredClone(result);}};
}
