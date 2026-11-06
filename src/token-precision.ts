import {parseEvidenceAsync} from './browser-engine.ts';
import {canonicalJson} from './json-codec.ts';
import {address, hash32} from './values.ts';

export interface VerifiedTokenPrecision {
  provenance: 'SOURCE_VERIFIED_PINNED_RUNTIME';
  chainId: 11155111;
  address: string;
  decimals: 18;
  blockNumber: '0x7556c3';
  blockHash: string;
  runtimeSha256: string;
  sourceUrl: string;
  sourceResponseSha256: string;
  standardInputSha256: string;
  compilerVersion: '0.8.26+commit.8a97fa7a';
}

const EVIDENCE_DIGEST = '0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093';
const TRANSACTION = '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9';
const BLOCK_HASH = '0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34';
const BLOCK_NUMBER = '0x7556c3';

// Independently compiled full runtimes, including metadata, equal the retained
// eth_getCode bytes. Both sources inherit constant ERC20 decimals() = 18 without
// override or proxy. Inspect/reproduce docs/evidence/token-precision/manifest.json.
const REFERENCES = [
  {
    role: 'tokenIn', address: '0x0f47e03a0383396635846f8495003fc478b71bca',
    runtimeSha256: '8d5ab55c4e3ee83c5058ad5912de9ca449035c2e99a462a335ba92cdbb29e71c',
    sourceResponseSha256: 'f6dc54fcad30510306ce630af164e1a0fa0d7d1f2b04812d846bb295216e9afa',
    standardInputSha256: '35b6e4ae31da50d3f53fe1ab689a3e1a44496b51bcb783b2afbd66f54983c62d'
  },
  {
    role: 'tokenOut', address: '0x9142fa65aaef921aea2127e88758adee0510a0f0',
    runtimeSha256: 'a5a02890e3f35fc56e61694f7836a606841ed62bb4f6b7a5affa007c2914b214',
    sourceResponseSha256: 'c71c8790e06c9dfbe337fb4c933024b04b3c4af11d5df27fe2af881eba9f6d05',
    standardInputSha256: 'f5d17d601ee90c15af479dadcf4bc291068f54bd056e9a6491cf2e6513247083'
  }
] as const;

/** Never generalize this source-derived precision to other captures or contracts. */
export async function authenticatedTokenPrecision(evidenceInput: unknown): Promise<{input: VerifiedTokenPrecision | null; output: VerifiedTokenPrecision | null}> {
  const evidence = await parseEvidenceAsync(evidenceInput);
  const unavailable = {input: null, output: null};
  if (evidence.chainId !== 11155111 || hash32(evidence.digest) !== EVIDENCE_DIGEST ||
      hash32(evidence.transactionHash) !== TRANSACTION || evidence.block?.number !== BLOCK_NUMBER ||
      evidence.block?.hash !== BLOCK_HASH || evidence.canonicalBlockHash !== BLOCK_HASH) return unavailable;
  const descriptors: (VerifiedTokenPrecision | null)[] = [];
  for (const reference of REFERENCES) {
    const observations = evidence.state.filter(state => state.key === `${reference.role}.code`);
    const observation = observations[0];
    if (observations.length !== 1 || observation.method !== 'eth_getCode' ||
        address(observation.params[0]) !== reference.address ||
        canonicalJson(observation.params[1]) !== canonicalJson({blockHash: BLOCK_HASH, requireCanonical: true}) ||
        typeof observation.result !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(observation.result)) {
      descriptors.push(null); continue;
    }
    const hex = observation.result.slice(2);
    const bytes = Uint8Array.from({length: hex.length / 2}, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
    if (digest !== reference.runtimeSha256) { descriptors.push(null); continue; }
    descriptors.push({
      provenance: 'SOURCE_VERIFIED_PINNED_RUNTIME', chainId: 11155111, address: reference.address, decimals: 18,
      blockNumber: BLOCK_NUMBER, blockHash: BLOCK_HASH, runtimeSha256: digest,
      sourceUrl: `https://sourcify.dev/server/v2/contract/11155111/${reference.address}?fields=all`,
      sourceResponseSha256: reference.sourceResponseSha256, standardInputSha256: reference.standardInputSha256,
      compilerVersion: '0.8.26+commit.8a97fa7a'
    });
  }
  return {input: descriptors[0], output: descriptors[1]};
}
