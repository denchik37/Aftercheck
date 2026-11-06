import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseJson, digestJson} from '../src/json.ts';
import {parseEvidence, validateReceiptIdentity} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {protocolStateRequests, decodeAddressResult} from '../src/uniswap.ts';
import {DEMO_TARGET, INTENTIONAL_MISMATCH_POOL, parseManifest} from '../integrations/cre/shared.ts';

const evidenceUrl = new URL('../examples/sepolia/evidence.json', import.meta.url);
const policyUrl = new URL('../examples/sepolia/policy-pass.json', import.meta.url);
const manifestDirUrl = new URL('../integrations/cre/public/', import.meta.url);

/** Generate from integrity-checked retained evidence; never invent a missing observation. */
export async function createManifest(evidenceInput, scenario = 'REFERENCE') {
  if (!['REFERENCE', 'INTENTIONAL_MISMATCH'].includes(scenario)) throw new TypeError('CRE_UNSUPPORTED_SCENARIO');
  const evidence = parseEvidence(evidenceInput);
  const identity = validateReceiptIdentity(evidence);
  if (evidence.evidenceClass !== 'RPC_RECEIPT' || identity.execution !== 'SUCCEEDED' || identity.coverage !== 'COMPLETE') throw new TypeError('CRE_SOURCE_IDENTITY_INCOMPLETE');
  const policy = parseJson(await readFile(policyUrl, 'utf8'));
  const report = verifyEvidence(evidence, policy);
  if (report.support !== 'SUPPORTED' || report.coverage !== 'COMPLETE' || report.verdict !== 'PASS' || !report.protocol) throw new TypeError('CRE_SOURCE_PROTOCOL_INCOMPLETE');
  const request = protocolStateRequests(evidence.transaction).find(item => item.key === 'factory.pool');
  const matches = evidence.state.filter(item => item.key === 'factory.pool');
  if (!request || matches.length !== 1) throw new TypeError('CRE_SOURCE_POOL_OBSERVATION_MISSING');
  const observation = matches[0];
  if (observation.method !== 'eth_call' || observation.error !== undefined ||
      digestJson(observation.params) !== digestJson([...request.params, {blockHash: report.blockHash, requireCanonical: true}])) throw new TypeError('CRE_SOURCE_CALL_BINDING_CONFLICT');
  const pool = decodeAddressResult(observation.result);
  if (pool !== report.protocol.pool) throw new TypeError('CRE_SOURCE_POOL_CONFLICT');
  const [token0, token1] = [report.protocol.tokenIn, report.protocol.tokenOut].sort();
  const payload = {
    schemaVersion: 'aftercheck.cre-manifest.v1', scenario, observationMode: 'HISTORICAL_BLOCK_NUMBER',
    evidence: {evidenceClass: evidence.evidenceClass, origin: 'THIRD_PARTY_HISTORICAL_SEPOLIA_CAPTURE',
      digest: evidence.digest, sourceRevision: DEMO_TARGET.sourceRevision, sourcePath: DEMO_TARGET.sourcePath,
      sourceUrl: DEMO_TARGET.sourceUrl, acquiredAt: evidence.acquiredAt},
    target: {chainId: String(evidence.chainId), chainSelector: DEMO_TARGET.chainSelector,
      transactionHash: evidence.transactionHash, blockNumber: BigInt(report.blockNumber).toString(), blockHash: report.blockHash},
    call: {method: 'getPool(address,address,uint24)', factory: report.protocol.factory, token0, token1,
      fee: String(report.protocol.fee), calldata: request.params[0].data,
      expectedPool: scenario === 'REFERENCE' ? pool : INTENTIONAL_MISMATCH_POOL},
  };
  return parseManifest({...payload, manifestDigest: digestJson(payload)});
}

export async function retainedManifests() {
  const evidence = parseJson(await readFile(evidenceUrl, 'utf8'));
  return {
    'reference.json': await createManifest(evidence),
    'intentional-mismatch.json': await createManifest(evidence, 'INTENTIONAL_MISMATCH'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--write', '--check'].includes(args[0]))) throw new TypeError('Usage: node scripts/cre-manifest.mjs [--write|--check]');
  const manifests = await retainedManifests();
  if (!args.length) { process.stdout.write(JSON.stringify(manifests['reference.json'], null, 2) + '\n'); return; }
  if (args[0] === '--write') await mkdir(manifestDirUrl, {recursive: true});
  for (const [name, manifest] of Object.entries(manifests)) {
    const text = JSON.stringify(manifest, null, 2) + '\n';
    const path = new URL(name, manifestDirUrl);
    if (args[0] === '--write') await writeFile(path, text, 'utf8');
    else if (await readFile(path, 'utf8') !== text) throw new TypeError('CRE_COMMITTED_MANIFEST_DIFFERS');
    process.stdout.write(`${args[0] === '--write' ? 'WROTE' : 'VERIFIED'} ${name} ${manifest.manifestDigest}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
