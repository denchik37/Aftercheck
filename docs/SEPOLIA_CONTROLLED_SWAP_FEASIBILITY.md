# Controlled Sepolia swap with a predeclared policy

**Issue [#18](https://github.com/denchik37/aftercheck/issues/18) · 6 November 2026 IST**

## Decision and objective

**CONDITIONAL GO for one existing Circle test-USDC → WETH pool; execution is not ready or authorized.** The proposed experiment is a direct Sepolia Router02 swap that can succeed under its encoded minimum while violating a stricter operator minimum published beforehand. Any future result must be reported as observed, including PASS, UNKNOWN, unsupported execution, or revert. This is an intentionally constructed parameter-mismatch demonstration, not evidence of a real financial loss or a Uniswap defect.

The historical TIGER/Lab USD pool returned a positive quote, but legitimate input-token acquisition and current token semantics are unverified. Do not spend more time searching for those tokens. One bounded alternative has a documented free input-token faucet, an existing factory-selected pool, positive liquidity, and a successful read-only quote. **INFERRED:** that candidate does not currently indicate a need for new contracts, a liquidity position, paid provider, backend, or verifier scope expansion.

This investigation does not authorize wallet creation on the owner's behalf, funding, token approvals, signing, broadcasting, deployment, or publication of a final policy containing an owner wallet identity. None has been performed. No final pre-execution policy or controlled transaction exists.

## Evidence vocabulary

| Label | Meaning in this report |
|---|---|
| VERIFIED | Checked source, repository behavior, or executed test; scope is stated |
| OBSERVED BUT PROVIDER-DEPENDENT | Live RPC response at a recorded block; not a consensus/state proof |
| INFERRED | Reasoned implication with its assumptions stated |
| UNVERIFIED | Not established by retained evidence |
| BLOCKED | A necessary prerequisite currently prevents readiness |
| NOT APPLICABLE | Outside this bounded experiment |

## Actual implementation boundary

Inspection started with both `main` and `spike/predeclared-sepolia-example` at `09bfe5d0352276267476d5050bc996a3d0f09513`. Issue #18 had no comments and there were no open PRs at the initial check. Existing [branch CI run 42097844215](https://github.com/denchik37/aftercheck/actions/runs/42097844215) was successful: its inspected test/browser logs recorded **117 Node tests**, all three offline demo outcomes, and **28 browser checks**. These are baseline results, not validation of this spike.

The actual source, including `src/uniswap.ts`, `evidence.ts`, `collect.ts`, `inspect.ts`, `verify.ts`, `policy.ts`, `rpc.ts`, `values.ts`, the CLI, protocol/readiness docs, historical example, regression tests, and both relevant workflows, controls this assessment. `docs/READINESS.md` contains older pinned checkpoints; its older counts are not the current baseline.

The supported call is `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`, selector `0x04e45aaf`. Its seven fields are tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, and sqrtPriceLimitX96. There is **no deadline field**. The profile requires direct Router02 targeting, zero native value, a supported EOA sender without observed contract/delegated code, distinct coded token contracts, positive full exact input below `2^255`, and zero square-root price limit. Universal Router, multicall, multihop, recipient aliases, router-balance input mode, partial-fill routes, and type-4/delegated execution remain unsupported.

The entire receipt must reconcile one output Transfer (pool → recipient), one input Transfer (sender → pool), then one pool Swap, with exact signed amounts, participants, canonical ABI widths, identities and ordering. At most one ordinary input-token Approval for sender/router may occur inside the payment callback. Extra transfers, swaps, unrelated events, inconsistent fields or missing observations cannot become PASS. Token events do not prove actual balance semantics. Reserve reconstruction is outside scope and remains UNKNOWN.

The collector needs transaction, receipt, containing block, chain/canonicality checks and **12 state observations**: sender/router/factory/two token code reads; router `factory()`; factory `getPool()`; pool code plus `factory()`, `token0()`, `token1()`, `fee()`. Every state read must use `{blockHash, requireCanonical:true}`. Current feasibility reads are not substituted into historical verifier evidence.

## A. Deployment and interfaces

| Identity | Value | Basis |
|---|---|---|
| Network / chain | Ethereum Sepolia / `11155111` | Official documentation and live chain ID |
| Router02 | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` | Official Uniswap deployment; observed nonempty code and matching `factory()` |
| Factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` | Official deployment and observed code/pool binding |
| QuoterV2 | `0xed1f6473345f45b75f8179591dd5ba1888cf2fb3` | Official deployment; observed code and matching `factory()` |
| Circle test USDC | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` | Circle's official Sepolia deployment |
| Sepolia WETH | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` | [Uniswap's official wrapped-native table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments#wrapped-native-token-addresses) |

[Uniswap's deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments) and the official [Router02 interface](https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol) were checked on 6 November IST. Documentation recommends Universal Router for general integrations, but explicitly lists this Router02 deployment. This spike preserves the narrower supported interface.

The [QuoterV2 interface](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoterV2.sol) differs: its tuple is tokenIn, tokenOut, **amountIn, fee**, sqrtPriceLimitX96. `eth_call` quoting returns output, square-root price after the simulated swap, initialized ticks crossed, and a swap-path gas estimate. It does not pay from a real EOA or exercise that EOA's allowance. Its gas estimate is not the complete approval-plus-router transaction budget.

Nonempty runtime code and matching metadata are provider observations, not a reproduced source-to-bytecode proof or a token audit.

## B. Bounded candidate investigation

Both candidates below were observed through the single public keyless provider `https://sepolia.gateway.tenderly.co`. Initial complete probe attempts pinned block **12071805** (`0xb8337d`), hash `0xa66ccae4fd8140aeab9d014a1bbd3012e8a38f3a73fd6b6b4e88dc34f02525b1`, timestamp **2026-11-05T20:20:12Z**, and passed their final block/chain rechecks. Those captures identify the precommit prototype by its exact script hash. The final probe, executed at the local source revision mapped below to published commit `f24584bc8512626afe436af58163790b48062364`, independently repeated the **selected USDC/WETH candidate** at block **12071829** (`0xb83395`), hash `0x5f5a2934c8ffd028a1ae64f79879d8e5ba7c0853a996a3f92ca80a3c95e00e7e`, timestamp **2026-11-05T20:25:12Z**: all **20 requests completed**, with the same liquidity and quote quantities below. These are observations at the recorded blocks, not promises about later output.

| Item | Historical candidate | Selected bounded alternative |
|---|---|---|
| Pool | `0x029603931809d430ae47d2f55212cc0e89dbfd52` | `0x3289680dd4d6c10bb19b899729cda5eef58aeff1` |
| Token0 / input | TIGER `0x0f47e03a0383396635846f8495003fc478b71bca` | Circle test USDC `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` |
| Token1 / output | Lab USD `0x9142fa65aaef921aea2127e88758adee0510a0f0` | WETH `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` |
| Fee | `500` (0.05%) | `500` (0.05%) |
| Observed active liquidity | `800005769246931921502066` | `16015164533241097` |
| Tick | `99055` | `174526` |
| Square-root price X96 | `11213084133036597495817993051651` | `488066059377187592329714233123365` |
| Proposed input, raw | `1000000000000000000` | `1000000` |
| Quoted output, raw | `20016908621170349224705` | `37929811014366` |
| Quote swap-gas component | `102821` | `95430` |
| Acquisition | BLOCKED: no authenticated faucet/distribution found | Documented public Circle faucet; owner receipt UNVERIFIED |

For each full probe the official factory selected exactly the nominated pool; pool factory/token order/fee matched; router/factory/pool/token/quoter code was nonempty; `slot0` was unlocked. The positive quotes support a small-trade hypothesis more directly than the liquidity field alone. They do not establish future inclusion, an actual supported receipt, full-fill behavior of a future owner call, or ordinary token balance semantics.

A separate hash-bound metadata supplement at the final selected block returned USDC decimals `6` and WETH decimals `18`, with the same canonical block rechecked. Thus `1000000` raw input represents **1 test USDC**, and the quote represents **0.000037929811014366 test WETH**. These display conversions do not ascribe monetary value. Exact requests, replies, code hashes, source revisions and separate failed attempts are retained in the [research manifest](evidence/sepolia-controlled-swap-feasibility.json).

Only one fallback token pair was investigated. Discovery queried fee tiers `500` and `3000`; the latter returned `0x6ce0896eae6d4bd668fde41bb784548fb8f59b50`, but was not developed as another candidate after the `500` pool quoted successfully. No further pool search is justified.

An earlier sequential research attempt at block `12071790` returned metadata and a quote but timed out on an optional token-balance read, exhausting the request time budget before canonicality/chain rechecks. It is an **incomplete attempt**, not silently repaired using another capture. Bounded parallel reads subsequently completed independent captures.

The final committed probe's repeat of the historical TIGER/Lab USD candidate was also **INCOMPLETE**: `quoter.code`, `pool.liquidity`, `chain.final`, and `block.final` returned sanitized `RPC_HTTP_ERROR`. The HTTP status and provider body were not retained, so the cause is not attributed to rate limits or a provider defect. That failed attempt is preserved separately from both earlier successful captures and the independently complete selected-candidate capture. No retry or further pool search is needed for the rejected token-acquisition path.

## C. Historical evidence availability

The unchanged production `inspect` command was run afresh against the retained third-party transaction `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`. Capture began **2026-11-05T20:19:22.233Z** and returned **SUCCEEDED / SUPPORTED / COMPLETE / PASS** under the existing retrospective pass policy, with all **12 historical state observations** and no collection errors.

The fresh evidence digest was `0xd170ac971902427d8939803ddd596837a9be5d44e4671727db354164db631441`. Its entire normalized payload matched the retained original apart from capture timestamp and digest. It still describes the February 2025 transaction at block `7689923`, hash `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34`; it is not a new transaction.

The [manifest's `historicalCollectorCheck`](evidence/sepolia-controlled-swap-feasibility.json) records all 12 requests, sanitized results/code hashes, verdict and capture hashes. The unchanged retained base plus the captured acquisition timestamp reconstructs the exact fresh canonical payload/digest and file bytes. That reconstruction is an offline reproduction of the recorded acquisition, not a new chain observation; the supplied `inspect` command below performs a new read.

This establishes a working collector path on the same provider at the observation time, not a service guarantee. [Tenderly documents its keyless Sepolia endpoint](https://docs.tenderly.co/node-rpc/rpc-reference) and [public limits](https://docs.tenderly.co/node-rpc/overview); the live test, rather than ordinary method availability, established this historical [EIP-1898](https://eips.ethereum.org/EIPS/eip-1898) capability. No observations from another provider were merged into an evidence bundle.

## D. Token acquisition and behavior

**Historical pair — BLOCKED for this attempt.** Exact-address searches found explorer records but no authenticated issuer faucet or legitimate public distribution for TIGER/Lab USD. This bounded search does not prove none exists. The February 2025 receipt and today's nonempty code/positive quote do not establish present token access or transfer semantics. Do not call these contracts freely mintable.

**Circle input — documented path, actual funding UNVERIFIED.** [Circle's official address table](https://developers.circle.com/stablecoins/usdc-contract-addresses) identifies the candidate USDC as a Sepolia test token with no financial value or real-USD backing. The reachable [Circle faucet](https://faucet.circle.com/) lists Ethereum Sepolia, advertises 20 test USDC per address/network every two hours, requires no account, and uses reCAPTCHA. No wallet address was submitted and no claim was requested. Faucet reserves, acceptance, and owner receipt are not established. USDC input avoids a prior WETH-wrapping transaction; the output can remain wrapped.

Circle's [upstream implementation](https://github.com/circlefin/stablecoin-evm/blob/master/contracts/v1/FiatTokenV1.sol) has amount-preserving transfers plus allowance, pause, and blacklist controls, with an upgradeable architecture. This supports a compatibility hypothesis only. Direct source retrieval from both Etherscan ([USDC](https://sepolia.etherscan.io/address/0x1c7d4b196cb0c7b01d743fbc6116a902379c7238#code), [WETH](https://sepolia.etherscan.io/address/0xfff9976782d46cc05630d1f6ebab18b2324d6b14#code)) and Sepolia Blockscout ([USDC API](https://eth-sepolia.blockscout.com/api/v2/smart-contracts/0x1c7d4b196cb0c7b01d743fbc6116a902379c7238), [WETH API](https://eth-sepolia.blockscout.com/api/v2/smart-contracts/0xfff9976782d46cc05630d1f6ebab18b2324d6b14)) was blocked by HTTP 403. The current USDC proxy implementation's source/bytecode binding, pause/blacklist state for the eventual participants, upgrade state, and deployed transfer behavior therefore remain **UNVERIFIED**. WETH's source/bytecode binding also remains unverified. A documented address and an ERC-20 interface do not prove those properties.

The next technical prerequisite is narrowly defined: authenticate the selected tokens' deployed code/implementation and relevant source/state to assess transfer semantics. A retained ordinary direct Router02 receipt can **separately** establish observed event-shape compatibility; it cannot replace source/state analysis or prove actual balance semantics, absence of transfer fees/rebasing, or future proxy behavior. The verifier retains its plain-token assumption. After legitimate funding/allowance are established, the actual owner's read-only router call must also be checked. Do not relax the receipt profile to accommodate extra events; a future owner swap still needs its own receipt verification.

## E. Gas, wallet, and execution prerequisites

[Ethereum's network documentation](https://ethereum.org/developers/docs/networks/) identifies Sepolia for application development and lists free faucets. Documentation, a reachable page, owner eligibility, and actual funding are four different conditions.

| Gas path | Established on 6 November IST | Remaining gap |
|---|---|---|
| [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) | Reachable official sign-in page | Google sign-in, current allowance/capacity, owner eligibility and receipt unverified |
| [Alchemy faucet documentation](https://www.alchemy.com/docs/faucets) | No Alchemy account; 0.1 Sepolia ETH per wallet per 24 hours; CAPTCHA | Same recipient must already hold at least 0.001 mainnet ETH and real mainnet transaction history, and not exceed testnet balance restrictions; owner eligibility unverified |

The Alchemy restrictions do not justify purchasing/moving mainnet ETH or using an owner's existing mainnet identity without approval. Google is a candidate path for an owner-controlled test wallet, not a promise of free funds. Circle's native-ETH developer-console faucet only funds Circle-created wallets; introducing that infrastructure is unnecessary here.

An eventual owner-controlled flow would require a public-use Sepolia EOA with no observed contract/delegated code, received test USDC and Sepolia ETH, and a separate bounded USDC approval if allowance is insufficient. The target transaction must call the pinned Router02 directly with `value = 0`; WETH output need not be unwrapped. No wallet has been selected, and balances, nonce, allowance, participant blacklist state, and a full sender-specific router `eth_call` are **UNVERIFIED**. QuoterV2 success is not that sender-specific simulation. A lack-of-balance/allowance failure would not by itself reject pool liquidity.

Gas must cover the approval (if needed), swap, and any separately authorized cleanup. A conservative spending cap is the sum of each authorized `gasLimit × maxFeePerGas`. The observed QuoterV2 number concerns only the simulated swap path, not intrinsic gas, the router's full work, or an approval. No numeric owner gas budget or expenditure is authorized by this report. See [Ethereum gas documentation](https://ethereum.org/developers/docs/gas/).

## F. Candidate transaction and independent minimum

This is a **research design**, not a final policy, unsigned transaction, or execution instruction. Owner, recipient, nonce, gas caps, and final thresholds are intentionally unset.

| Parameter | Candidate design |
|---|---|
| Chain / to | `11155111` / pinned Router02 above |
| Pool / fee | `0x3289680dd4d6c10bb19b899729cda5eef58aeff1` / `500` |
| Direction | Circle Sepolia test USDC → documented Sepolia WETH |
| Exact input / policy input cap | `1000000` raw input units, subject to owner approval |
| Recipient / owner | UNVERIFIED; owner must approve the actual public addresses |
| Native value / price limit | `0` / `0` |
| Router minimum formula | `floor(Q × 99 / 100)` |
| Independent operator minimum formula | `ceil(Q × 101 / 100)` |
| `Q` | A fresh pre-publication quote for the exact approved input, with provider and block/hash recorded |

The proposed 1% stricter-than-quote operator threshold deliberately demonstrates a parameter mismatch; it is not a fair-value estimate or evidence of unexpected market loss. With the research quote `Q = 37929811014366`, the illustrative router minimum is `37550512904222` and the independent policy minimum is `38309109124510` raw WETH units. These numbers are **not a published final pre-execution policy**. Before any authorized attempt, choose and freeze the exact thresholds from a fresh quote and disclose the construction. Do not recompute them after seeing a receipt. Market movement may produce PASS, VIOLATION, or revert; incomplete evidence may produce UNKNOWN.

The policy must retain exactly the existing required fields: `schemaVersion`, `chainId`, `owner`, `expectedRecipient`, `tokenIn`, `tokenOut`, `maxInputRaw`, `minReceivedRaw`. Do not add provenance fields or a reserve requirement. Keep router parameters in a separate intent record, so the encoded minimum cannot be confused with the independent operator requirement.

## G. Proposed pre-execution chronology procedure

**Designed only; none of these publication or execution steps has occurred.**

1. After the external prerequisites and owner authorization are resolved, freeze one attempt's actual owner/recipient, input, pool/fee, router minimum, independent policy minimum, and quote context. Decode the seven-field router call and compare it with the separate intent record. Identify the nonce if available after approvals.
2. Validate the unchanged policy schema. Compute both **SHA-256 of the exact policy file bytes** and Aftercheck's **normalized policy digest**, `digestJson(parsePolicy(parseJson(text)))`. The latter normalizes addresses and sorts keys; it is not the file-byte hash. Hash the separate intent file too.
3. Commit and push the policy and intent as commit **S**. Fetch their actual Git blobs by full commit SHA and recheck both digests. This also detects unexpected line-ending conversion. Do not force-push or rewrite this history.
4. Publish a **new dedicated, unedited** GitHub PR or issue-comment record whose initial body already binds full commit **S**, commit-pinned file URLs, both policy digests, the intent digest, and attempt ID. Retain the API response with record ID/URL, author, body, `created_at` and `updated_at`; verify public readability. An old PR's creation date does not timestamp a later-added policy, and an edited comment's original date does not timestamp its current body.
5. The owner reviews that published record before signing/broadcasting the authorized call. Retain the observed owner confirmation/submission sequence. A later block timestamp alone cannot prove publication preceded broadcast: a previously broadcast transaction can be included later. Allow a clear temporal separation and report ambiguous ordering as ambiguous.
6. Collect the actual transaction from one provider. Match sender, recipient, router, value, calldata, tokens, fee, input and applicable nonce against the frozen intent. Verify the exact committed policy, retaining the complete evidence and honest verdict. Failed/reverted/passing attempts remain part of the record; changed parameters require a newly published attempt before a retry.
7. Create a later closeout manifest **M** referencing **S**, the publication record, transaction/block, and evidence/report digests. A commit cannot meaningfully contain its own future SHA. Verify the publication record remains unedited and retain its original captured response.

GitHub's server-created records provide inspectable third-party chronology, not immutable cryptographic timestamping. Git author/committer dates are caller-controlled; signed commits do not turn those dates into trusted publication times. The comparison also depends on clocks and retained observations. See GitHub's [issue-comment API](https://docs.github.com/en/rest/issues/comments) and [Git commit API](https://docs.github.com/en/rest/git/commits).

**Current software limitation:** `src/verify.ts` always emits `policySource: "SUPPLIED_RETROSPECTIVE"`, and the report explicitly does not authenticate original intent. The CLI normalizes the exported policy, so exported byte hashes can differ from the committed original while the normalized policy digest agrees. This spike does not change that schema or wording. A future chronology assessment must be a separately reviewed artifact; do not relabel the financial report or imply Aftercheck automatically verified prepublication.

## H. Bounded engineering implementation

[`scripts/probe-sepolia-feasibility.mjs`](../scripts/probe-sepolia-feasibility.mjs) is separate research tooling and reuses the existing bounded `RpcClient`. A complete path uses **20 read-only requests**, with parallel independent batches, 32-call transport ceiling, 8-second per-request/90-second total defaults, 2 MB per-response and 8 MB total byte ceilings. It has no runtime dependencies beyond the existing project.

The probe validates the chain, pinned block, code/metadata, factory pool binding, liquidity/slot0, and QuoterV2 quote ABI and price bounds; it rechecks chain/canonical block afterward. It emits fixed read methods and fixed contract calls, without an owner `from`, state overrides, wallet generation, signing, approvals or broadcasting. Endpoint credentials and arbitrary error bodies are omitted. Code observations retain byte length and SHA-256 rather than dumping bytecode. A hash identifies captured bytes; it does not authenticate them.

`candidateStatus: OBSERVED` means the research reads completed; it is **not GO, financial PASS, or a supported transaction verdict**. `readiness` always remains `NOT_ESTABLISHED`. The output distinguishes token access, wallet funding, quote simulation, capture-block state reads, and the full collector path. Zero active liquidity alone is not interpreted as proof that every possible trade is impossible. Missing data, malformed responses, wrong identities, and failed final rechecks never become a complete observation.

[`test/sepolia-feasibility.test.mjs`](../test/sepolia-feasibility.test.mjs) adds **16 explicitly synthetic regression tests** for correct identities, wrong chain, missing code, zero selected pool, conflicting metadata, missing liquidity, malformed envelopes/ABI, sanitized failures, read-only methods, no state overrides, exact quote encoding, invalid quoted prices, canonicality, incomplete final reads, input bounds, and batching dependencies. These fabricated responses do not establish public liquidity.

The production verifier, schemas, retained genuine evidence, browser, Windows workstream and existing workflows are unchanged.

## I. Readiness matrix and decision gates

| Gate / feature | Actual evidence or test | Source revision / observation | Status and remaining risk |
|---|---|---|---|
| A — official supported deployment | Official mappings plus matching chain/code/router factory | Final selected probe, `f24584b`, block `12071829` | PASS within documented RPC trust; OBSERVED BUT PROVIDER-DEPENDENT |
| B — one existing usable pool | Factory/pool metadata, nonzero active liquidity, positive exact-input quote | Same 20-request selected capture | PASS for a quoted small-trade candidate, not future execution |
| C — accessible ordinary test tokens | Circle identity/faucet documentation; 6/18 decimal reads | Official sources retrieved 6 November IST; same hash-bound block | CONDITIONAL: deployed implementation/semantics and actual acquisition UNVERIFIED |
| D — gas funding | Official Ethereum faucet list; reachable Google sign-in and Alchemy requirements | Sources retrieved 6 November IST | CONDITIONAL: owner eligibility/capacity/balance UNVERIFIED |
| E — supported execution path | Correct Router02 tuple/profile; QuoterV2 simulation | `f24584b`; existing decoder and 16 new synthetic tests | CONDITIONAL: funded EOA, allowance, full owner simulation, gas budget and actual receipt absent |
| F — post-execution evidence path | Fresh unchanged production `inspect`; 12 hash-bound reads, COMPLETE/PASS | Production source `09bfe5d`; captured `2026-11-05T20:19:22.233Z` | PASS as a demonstrated historical path; public provider availability is not guaranteed |
| Prepublication procedure | Separate policy/intent, digests, fresh server-created publication record, owner sequence, closeout | Section G; current parser/digest implementation | Designed, UNVERIFIED in practice; no final policy or publication exists |
| Probe failure handling | 16 synthetic tests including wrong chain/code, malformed/error data and reorg | Probe/test implementation `f24584b` | VERIFIED local tests; mocked replies do not prove chain facts |
| Existing financial verifier | Typecheck and 133 Node tests; all three offline demos | Same code files as `f24584b`; Node `24.22.1` | VERIFIED locally; final PR CI is recorded separately below |
| Transaction-boundary reserves | Existing reserve demo returns UNKNOWN / PARTIAL | Unchanged genuine example | NOT APPLICABLE to this experiment; never inferred from receipts |

**Overall: CONDITIONAL GO, not execution GO.** Pool/deployment/quote and a historical evidence path are credible. Token behavior, actual access, wallet state, owner-specific execution feasibility, and chronology are not established. Making the desired four-field result appear in a report is not a reason to bypass any condition.

## J. Reproduce the investigation

Requires Node.js 24. These commands perform tests, offline replay, or public reads only:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
node --experimental-strip-types --test test/sepolia-feasibility.test.mjs
node --experimental-strip-types scripts/probe-sepolia-feasibility.mjs --json
```

The last command probes the historical candidate. Exit `0` means its research observations completed, **not GO or policy PASS**; exit `2` means incomplete/rejected observations and `1` indicates invalid setup. `--help` describes the CLI. An endpoint can be provided locally using `AFTERCHECK_RPC_URL`; do not paste private URLs into a shared command or document.

For the selected fallback, this Bash/Node snippet uses the same narrow exported probe:

```bash
node --input-type=module <<'JS'
import {RpcClient} from './src/rpc.ts';
import {probeSepoliaFeasibility} from './scripts/probe-sepolia-feasibility.mjs';
const client = new RpcClient(process.env.AFTERCHECK_RPC_URL ?? 'https://sepolia.gateway.tenderly.co');
const result = await probeSepoliaFeasibility(client, {candidate: {
  pool: '0x3289680dd4d6c10bb19b899729cda5eef58aeff1',
  tokenIn: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  tokenOut: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  fee: 500, amountInRaw: '1000000'
}});
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.candidateStatus === 'OBSERVED' ? 0 : 2;
JS
```

Each invocation obtains a new head block, pins its hash, and may return different data or provider errors. To re-query a retained observation, use its exact method/parameters from the manifest; do not silently replace its block context with `latest`. The manifest is a research artifact, deliberately not accepted as `aftercheck.evidence.v1` or a financial report.

Recheck the existing historical collector independently, using one public provider:

```bash
AFTERCHECK_RPC_URL=https://sepolia.gateway.tenderly.co npm run cli -- inspect \
  0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9 \
  examples/sepolia/policy-pass.json output/issue18-reinspection
node scripts/check-public-example-inspection.mjs output/issue18-reinspection
```

The live probe source published as `f24584bc8512626afe436af58163790b48062364` has script SHA-256 `3a810316866d1b6948e7982b128c348fe3cbbac1e1c30ba044bce3c92cf86234`. The manifest preserves the earlier prototype hash and each separate success/failure without relabeling it as that final source. It also retains the local verification log digests: **133/133 Node tests**, **16/16 new synthetic tests**, typecheck success and demo exits **0/2/3**. The production historical collection succeeded separately from those synthetic/offline tests.

Publication provenance: the shell push lacked GitHub authentication, so the same focused snapshots were published through the connected GitHub API. Local deployment-report commit `94834847159606e2ed40f2c0a6acb018dbca81eb` maps to published `98804365aba73a38e2114c78160199601b7aaae3`, with identical tree `df747db48cb9020b05ee645d177ba39ffca7cbaa`. The live probe executed from local `605bb9e95b439cc15a415a7ea9dfe42d7edc4550`; published `f24584bc8512626afe436af58163790b48062364` has the identical complete source tree `e4ba295c82518e492178899f73ad1606f969ba6e` and script hash. Capture records retain their actual local revision and add the published mapping; publication time is not represented as acquisition time. No branch history was force-pushed.

The existing GitHub Actions workflow runs the full tests/demo and its browser job on the PR revision. The PR's Testing section supplies the final head SHA, Actions run, tested checkout SHA and inspected job outcomes; baseline CI links above are not substituted for the new branch's final CI.

## K. Material risks and owner boundary

- **Token semantics:** source/bytecode and live USDC proxy-state verification remain open; events can misrepresent balances. A matching example receipt does not close this gap.
- **Liquidity and execution:** the quoted price/liquidity can change; an EOA may lack funds/allowance or encounter pause/blacklist restrictions. A future swap can revert, pass the policy, violate it, or be outside the strict profile.
- **Provider trust and availability:** RPC answers are trusted observations. Both successful and failed captures occurred. Code hashes/digests do not prove consensus or finality; future historical reads can fail.
- **Policy chronology:** GitHub records are mutable third-party evidence with clock assumptions. Block time proves an inclusion context, not when the owner broadcast. The current evaluator does not authenticate original intent.
- **Interpretation:** the stricter threshold is intentionally constructed from a prior quote. A violation would demonstrate declared-policy versus encoded-parameter divergence for test tokens, not profit, real loss, a security guarantee, or universal balance protection.
- **Delivery cost:** this P1 investigation must not delay the working P0 historical/offline demonstration. No broader token/pool search, new deployment, liquidity funding, or backend build is justified.

After the token-behavior prerequisite is resolved, advancing to a real attempt would require explicit owner authorization for the actual public EOA/recipient, free test-token and gas acquisition, exact input cap, any bounded router approval, gas caps, policy/intent publication, and one owner-signed direct swap. The current report authorizes none of those actions and requests no wallet secrets. Owner addresses, wallet balances, approval transaction, final policy commit, publication event and controlled transaction are all absent.

## L. Consequential recommendation

**Choose one narrowly defined prerequisite resolution, not execution:** authenticate the selected USDC/WETH deployed implementation and relevant transfer behavior. Event-profile corroboration and later owner-funded read-only simulation remain distinct checks. If this cannot be resolved quickly from accessible public evidence, stop the optional execution effort and retain the functioning historical example.

The authorized spike itself is complete: it identifies one concrete quoted candidate, tests the available historical evidence path, implements bounded reproducible research tooling, preserves failures, and defines honest chronology/authorization gates. A later controlled swap could add evidence of predeclared intent; until it actually occurs and is verified, the existing retrospective case remains the demonstrable product result.
