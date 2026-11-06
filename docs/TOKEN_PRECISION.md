# Exact amounts and historical token precision

## Result

The retained historical example's two actual token contracts have **18 decimals**
under the same retained-RPC trust boundary as the rest of the replay. This value is
derived from verified source whose **entire independently compiled runtime** equals
the token runtime bytes already captured at the transaction's containing block.
The evidence file was not modified, and no new historical `decimals()` RPC call is
claimed.

The browser authenticates these narrow metadata bindings before using token units.
Other evidence defaults to raw units unless it matches the exact reference. A user
may explicitly supply display decimals for unverified tokens; those choices remain
labelled **user-supplied, unverified** and are exported separately from the policy.

## Pinned context

| Item | Retained identity |
|---|---|
| Chain | Ethereum Sepolia, `11155111` |
| Transaction | `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9` |
| Block | `7689923` / `0x7556c3` |
| Block hash | `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34` |
| Evidence digest | `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093` |
| Original evidence file SHA-256 | `d57013b097c323271d25a021f6244e79a00ec72853dd6aed0828f2a481fe0c36` |
| Input token | `0x0f47e03a0383396635846f8495003fc478b71bca` |
| Output token | `0x9142fa65aaef921aea2127e88758adee0510a0f0` |

These addresses differ from the Circle test-USDC/WETH contracts investigated in
the separate token-compatibility research. Those tokens' 6/18-decimal findings were
not transferred to this example.

## Source and compilation evidence

The [input token source record](https://sourcify.dev/server/v2/contract/11155111/0x0f47e03a0383396635846f8495003fc478b71bca?fields=all)
and [output token source record](https://sourcify.dev/server/v2/contract/11155111/0x9142fa65aaef921aea2127e88758adee0510a0f0?fields=all)
were retrieved from Sourcify on 6 November 2026. Both records declare `exact_match`.
Both `onchainBytecode` and `recompiledBytecode` fields equal their corresponding
`tokenIn.code`/`tokenOut.code` observations in the original retained evidence.

The actual source contracts inherit `ERC20` and `Ownable`; neither overrides
`decimals()`. The inherited ERC20 implementation returns the literal `18` and reads
no mutable storage. These are standalone runtimes, with no proxy or delegatecall
path in the compiled contract sources. Token symbols and economic valuations are
not needed for this precision binding.

The two standard JSON compiler inputs were independently compiled with npm
`solc@0.8.26`, full compiler version
`0.8.26+commit.8a97fa7a.Emscripten.clang`, in an isolated research directory. Compiler
settings preserve the recorded optimizer configuration (disabled, 200 runs),
Cancun EVM target and IPFS metadata. There were no compiler errors or warnings.

| Token | Full runtime size | SHA-256 of raw runtime bytes |
|---|---:|---|
| Input | 4,380 bytes | `8d5ab55c4e3ee83c5058ad5912de9ca449035c2e99a462a335ba92cdbb29e71c` |
| Output | 4,380 bytes | `a5a02890e3f35fc56e61694f7836a606841ed62bb4f6b7a5affa007c2914b214` |

Both independently produced runtime strings match the captured programs in full,
including their compiler metadata. No metadata stripping, byte substitutions,
library relinking or partial comparison was required. The [manifest](evidence/token-precision/manifest.json)
records the source URLs, response SHA-256 values, source-input hashes, compiler
package integrity and exact evidence identities. The source inputs and compiled
runtime strings are retained next to it; their original SPDX notices remain intact.
The [recompilation result](evidence/token-precision/recompilation-result.json) records
the executed full comparison.

The browser does not download these source documents. Its small
[`token-precision.ts`](../src/token-precision.ts) adapter validates the evidence
digest, exact chain/transaction/block identity, exact `eth_getCode` request target
and EIP-1898 block-hash parameters, then hashes the retained runtime bytes using
Web Crypto before returning the pinned precision descriptor. Changed, missing or
different evidence cannot inherit the reference's verified metadata.

This proves a source-to-retained-runtime correspondence under the stated source,
compiler and RPC observation trust. It does not independently prove Ethereum
consensus, finality, token backing, balances or reserves. A match to the containing
block's captured runtime is not a new transaction-boundary state proof.

## Reproduce the source check

The normal test suite validates the committed source and runtime hashes without
networking or a Solidity dependency. Run that integrity check directly with:

```bash
node scripts/check-historical-token-precision.mjs
```

To independently recompile, install the exact compiler in an isolated directory
while online, then run the compiler comparison. The comparison script itself makes
no network requests and never installs software:

```bash
npm install --prefix output/token-precision/compiler --ignore-scripts --no-audit --no-fund --save-exact solc@0.8.26
node scripts/check-historical-token-precision.mjs --compiler output/token-precision/compiler/node_modules/solc/index.js
```

The compiler package's registry URL and integrity are recorded in the manifest.
The script requires the exact full compiler version and compares every output byte
with the retained evidence. A run without `--compiler` explicitly reports
`fullRecompilationThisRun: false`; it does not claim a fresh compiler execution.

## Exact decimal arithmetic

`src/amounts.ts` converts ungrouped decimal strings to canonical raw uint256 strings
using string operations and `bigint` validation. It never converts an amount to a
JavaScript `Number`. Precision is bounded to the ERC-20 uint8 range, `0`–`255`;
financial-input text is bounded before parsing or padding. Negative values, signs,
exponents, non-finite values, locale separators, excess fractional precision and
uint256 overflow are rejected. Excess fractional zeros are also rejected when
they exceed the selected precision; no silent rounding occurs.

| Quantity | Exact raw amount | Exact token units at verified 18 decimals |
|---|---|---|
| Observed input | `1000000000000000000` | `1` |
| Observed output | `999496253769344460` | `0.999496253769344460` |
| Example passing minimum | `999000000000000000` | `0.999` |
| Example violating minimum | `1000000000000000000` | `1` |
| Output shortfall against that minimum | `503746230655540` | `0.000503746230655540` |

The formatter may remove insignificant trailing zeros or group the read-only
integer portion; it preserves every significant digit. Editable values remain
ungrouped. The canonical policy always stores raw-unit strings. Changing display
precision reformats those existing raw values instead of reinterpreting the old
text as a different requirement. Editing an amount is a separate policy change.

## Export and checks

The verification ZIP contains the original evidence text, normalized policy, actual
browser-generated JSON report, deterministic Markdown report, supplementary
`display-metadata.json`, and reproduction instructions. Display provenance is
distinct from the canonical policy/report schemas. A user-provided 6-decimal view
cannot be exported as a source-verified token property.

The exporter re-evaluates the exact evidence and normalized policy, and rejects a
stale or altered displayed report. The standard ZIP uses bounded uncompressed
entries with fixed filenames, no paths, deterministic timestamps and CRC32 checks.
CRC32 is an archive check; the verifier's SHA-256 digests establish bundle integrity.

Amount tests cover exact values at 0, 6, 18 and 255 decimals, every supported
precision in round trips, one-unit differences beyond Number's precision, uint256
limits and invalid forms. Metadata tests cover original bindings, missing or
changed code/context, forged digests and unsupported chains. Export tests use an
independent Python ZIP reader and the offline Node CLI for PASS, output-floor
VIOLATION, input-cap VIOLATION and reserve UNKNOWN, comparing complete reports and
Markdown byte-for-byte with network entry points disabled.
