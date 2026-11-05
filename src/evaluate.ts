import {address, chainId, hash32, positiveAmount, rawAmount, requireRecord} from './values.ts';
import {parsePolicy, type Policy} from './policy.ts';

export type Verdict = 'PASS' | 'VIOLATION' | 'UNKNOWN';
export type CheckResult = 'PASS' | 'VIOLATION' | 'UNKNOWN';
export interface Check { id: string; result: CheckResult; reason: string; }
export interface Report {
  schemaVersion: 'aftercheck.report.v1';
  evidenceClass: string;
  transactionHash: string | null;
  execution: 'SUCCEEDED' | 'REVERTED' | 'PENDING' | 'UNKNOWN';
  support: 'SUPPORTED_TEST_PROFILE' | 'SUPPORTED' | 'UNSUPPORTED';
  coverage: 'COMPLETE' | 'PARTIAL' | 'CONFLICTED';
  verdict: Verdict;
  checks: Check[];
  limitations: string[];
}

const PROFILE = 'UNISWAP_V3_ROUTER02_EXACT_INPUT_SINGLE';
const NO_CHAIN_PROOF = 'Input is a normalized synthetic test fixture, not an authenticated onchain receipt or state proof.';
const NO_RESERVE_PROOF = 'Receipt-scoped synthetic evidence does not establish immediately-after-transaction token balances.';
function unknownResult({evidenceClass='UNKNOWN',txHash=null,execution='UNKNOWN',coverage='PARTIAL',reason}: {
  evidenceClass?: string,txHash?: string|null,execution?: Report['execution'],coverage?:Report['coverage'],reason:string
}): Report {
  return {
    schemaVersion:'aftercheck.report.v1',evidenceClass,transactionHash:txHash,
    execution,support:'UNSUPPORTED',coverage,verdict:'UNKNOWN',checks:[],limitations:[reason]
  };
}

/**
 * Evaluates only normalized, explicitly SYNTHETIC fixtures.
 * Never accepts unverified external data as proof of a real swap.
 */
export function evaluate(input: unknown, policyInput: unknown): Report {
  const policy: Policy = parsePolicy(policyInput);
  const data = requireRecord(input,'observation');
  const evidenceClass = typeof data.evidenceClass === 'string' ? data.evidenceClass : 'UNKNOWN';
  if (data.schemaVersion !== 'aftercheck.observation.v1')
    return unknownResult({evidenceClass,reason:'Observation schema is missing or unsupported'});
  let transactionHash: string|null;
  try {transactionHash=hash32(data.transactionHash,'transactionHash');}
  catch {return unknownResult({evidenceClass,coverage:'CONFLICTED',reason:'Missing or malformed transaction hash'});}
  const status = data.receiptStatus;
  const execution: Report['execution'] = status==='SUCCEEDED'||status==='REVERTED'||status==='PENDING'?status:'UNKNOWN';
  if(evidenceClass!=='SYNTHETIC_FIXTURE')
    return unknownResult({evidenceClass,txHash:transactionHash,execution,reason:'External evidence is not authenticated by this evaluator; actual protocol support is not established'});
  if(execution!=='SUCCEEDED')
    return unknownResult({evidenceClass,txHash:transactionHash,execution,reason:'No successful completed transaction effects are established'});
  try {
    if(chainId(data.chainId)!==policy.chainId)throw Error('CHAIN_ID_MISMATCH');
    hash32(data.blockHash,'blockHash');
  } catch {
    return unknownResult({evidenceClass,txHash:transactionHash,execution,coverage:'CONFLICTED',reason:'Missing or contradictory chain/block identity'});
  }
  let swap:Record<string,unknown>;
  try{swap=requireRecord(data.swap,'swap');}
  catch{return unknownResult({evidenceClass,txHash:transactionHash,execution,reason:'Missing normalized swap evidence'});}
  if(swap.kind!==PROFILE)
    return unknownResult({evidenceClass,txHash:transactionHash,execution,reason:'Unsupported swap route'});

  let owner:string,recipient:string,tokenIn:string,tokenOut:string,pool:string,inputAmount:bigint,outputAmount:bigint;
  try {
    owner=address(swap.owner,'swap.owner');
    recipient=address(swap.recipient,'swap.recipient');
    tokenIn=address(swap.tokenIn,'swap.tokenIn');
    tokenOut=address(swap.tokenOut,'swap.tokenOut');
    pool=address(swap.pool,'swap.pool');
    inputAmount=positiveAmount(swap.amountInRaw,'swap.amountInRaw');
    outputAmount=positiveAmount(swap.amountOutRaw,'swap.amountOutRaw');
    if(tokenIn===tokenOut)throw Error('MATCHING_TOKEN_PAIR');
  }catch {
    return unknownResult({evidenceClass,txHash:transactionHash,execution,coverage:'CONFLICTED',reason:'Malformed or contradictory swap amounts/addresses'});
  }

  // A synthetic fixture must independently include the two expected Transfer edges.
  // This check is deliberately NOT a proof of a real ERC-20 or v3 pool event.
  if (!Array.isArray(swap.transfers) || swap.transfers.length!==2)
    return unknownResult({evidenceClass,txHash:transactionHash,execution,reason:'Required synthetic transfer edges missing or ambiguous'});
  try{
    const edges=swap.transfers.map((item)=>{
      const t=requireRecord(item,'transfer');
      return {token:address(t.token,'transfer.token'),from:address(t.from,'transfer.from'),to:address(t.to,'transfer.to'),amount:positiveAmount(t.amountRaw,'transfer.amountRaw')};
    });
    const inputMatches=edges.filter(t=>t.token===tokenIn&&t.from===owner&&t.to===pool&&t.amount===inputAmount);
    const outputMatches=edges.filter(t=>t.token===tokenOut&&t.from===pool&&t.to===recipient&&t.amount===outputAmount);
    if(inputMatches.length!==1||outputMatches.length!==1||inputMatches[0]===outputMatches[0])
      throw Error('TRANSFER_EDGE_MISMATCH');
  }catch {
    return unknownResult({evidenceClass,txHash:transactionHash,execution,coverage:'CONFLICTED',reason:'Transfer edges do not reconcile with the declared swap'});
  }

  const checks:Check[]=[];
  const check=(id:string,ok:boolean,reason:string)=>checks.push({id,result:ok?'PASS':'VIOLATION',reason});
  check('owner',owner===policy.owner,'Swap payer matches the declared owner');
  check('recipient',recipient===policy.expectedRecipient,'Swap recipient matches the declared policy');
  check('tokenPair',tokenIn===policy.tokenIn&&tokenOut===policy.tokenOut,'Swap tokens match the declared pair');
  check('maxInputRaw',inputAmount<=rawAmount(policy.maxInputRaw),'Exact observed input does not exceed the declared cap');
  check('minReceivedRaw',outputAmount>=rawAmount(policy.minReceivedRaw),'Exact observed output meets the declared minimum');
  if(policy.reserveFloorRaw!==undefined){
    checks.push({id:'reserveFloorRaw',result:'UNKNOWN',reason:NO_RESERVE_PROOF});
  }
  const hasViolation=checks.some(c=>c.result==='VIOLATION');
  const hasUnknown=checks.some(c=>c.result==='UNKNOWN');
  const verdict:Verdict=hasViolation?'VIOLATION':hasUnknown?'UNKNOWN':'PASS';
  return {
    schemaVersion:'aftercheck.report.v1',evidenceClass,transactionHash,
    execution,support:'SUPPORTED_TEST_PROFILE',coverage:hasUnknown?'PARTIAL':'COMPLETE',
    verdict,checks,limitations:[NO_CHAIN_PROOF,...(hasUnknown?[NO_RESERVE_PROOF]:[])]
  };
}
