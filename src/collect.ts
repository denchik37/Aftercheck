import {collectReceipt, sealEvidence, validateReceiptIdentity, hexData, quantity, type RpcReader, type StateObservation, type EvidenceBundle} from './evidence.ts';
import {RpcError} from './rpc.ts';
import {hash32, requireRecord} from './values.ts';
import {protocolStateRequests, poolStateRequests, decodeAddressResult, type StateRequest} from './uniswap.ts';

/** Collect only public read observations; unavailable hash-bound state has no fallback. */
export async function collectSupportedEvidence(client: RpcReader, transactionHash: string): Promise<EvidenceBundle> {
  const evidence = await collectReceipt(client, transactionHash);
  const identity = validateReceiptIdentity(evidence);
  if (identity.coverage !== 'COMPLETE' || identity.execution !== 'SUCCEEDED') return sealEvidence(evidence);
  let requests: StateRequest[];
  try { requests = protocolStateRequests(evidence.transaction); }
  catch { return sealEvidence(evidence); } // Raw calldata remains inspectable; verifier explains unsupported routes.
  const blockHash = hash32(evidence.transaction?.blockHash);
  const context = {blockHash, requireCanonical:true};
  async function observe(request: StateRequest): Promise<void> {
    const observation: StateObservation = {key:request.key,method:request.method,params:[...request.params,context]};
    try { observation.result = hexData(await client.call(request.method, observation.params),65_536); }
    catch (error) { observation.error = error instanceof RpcError ? error.code : 'MALFORMED_STATE_RESULT'; }
    evidence.state.push(observation);
  }
  for (const request of requests) await observe(request);
  const factory = evidence.state.find(state=>state.key === 'factory.pool');
  if (factory?.result !== undefined) {
    try { requests = poolStateRequests(decodeAddressResult(factory.result)); }
    catch { requests = []; }
    for (const request of requests) await observe(request);
  }
  // Recheck after every state observation, so a reorg during collection cannot
  // inherit the earlier successful canonical block check.
  evidence.canonicalBlockHash = null;
  try {
    const block = requireRecord(await client.call('eth_getBlockByNumber',[evidence.transaction?.blockNumber,false]),'block');
    if (quantity(block.number) !== quantity(evidence.transaction?.blockNumber)) throw new Error();
    evidence.canonicalBlockHash = hash32(block.hash);
  } catch (error) { evidence.collectionErrors.push({stage:'canonicalBlockAfterState',code:error instanceof RpcError?error.code:'MALFORMED_BLOCK'}); }
  try {
    const chain = quantity(await client.call('eth_chainId',[]));
    if (chain !== 11155111n) evidence.collectionErrors.push({stage:'chainAfterState',code:'CHAIN_ID_CONFLICT'});
  } catch (error) { evidence.collectionErrors.push({stage:'chainAfterState',code:error instanceof RpcError?error.code:'MALFORMED_CHAIN_ID'}); }
  return sealEvidence(evidence);
}
