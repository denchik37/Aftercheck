# Sepolia USDC/WETH token compatibility

**Issue [#24](https://github.com/denchik37/aftercheck/issues/24) · 6 November 2026 IST**

## Investigation checkpoint: deployed source identities

This first increment authenticates the selected source programs. The final decision
will follow pinned live runtime/configuration checks and historical receipt replay.
It does not authorize or execute a transaction.

Work started from `main` at `3835c5a933c1f3f493ff726dd3b597f68c8c6330`.
Issue #24, merged PR #23, the existing feasibility report/probe, production adapter,
collector, evidence validator, protocol documentation and tests were inspected.
There were no open PRs or pre-existing token-semantics branch at the initial check.
[Main CI run 42109773947](https://github.com/denchik37/aftercheck/actions/runs/42109773947)
passed; inspected logs contain 165 Node tests and 75 browser checks. A fresh local
`npm ci --ignore-scripts --no-audit --no-fund` and `npm run verify` also passed all
165 baseline tests. Those are baseline checks, not proof of new research findings.

## Exact identities

| Role | Ethereum Sepolia (`11155111`) address |
|---|---|
| Circle test USDC / proxy | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` |
| Observed USDC implementation | `0xda317c1d3e835dd5f1be459006471acaa1289068` |
| WETH9 | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` |
| SwapRouter02 | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` |
| v3 factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` |
| Selected pool / fee | `0x3289680dd4d6c10bb19b899729cda5eef58aeff1` / `500` |

[Circle's official address table](https://developers.circle.com/stablecoins/usdc-contract-addresses)
identifies the test-USDC address and states that test tokens have no financial value
or real-USD backing. [Uniswap's official deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments)
identifies this WETH9, Router02 and factory. Both were checked during this investigation.

## Source-to-runtime authentication

Public [Sourcify API v2](https://docs.sourcify.dev/docs/api/) records were retrieved for
the exact chain/addresses. Their standard compiler inputs were compiled locally in
isolated temporary directories, without changing Aftercheck's dependencies.

| Contract | Compiler and settings | Independently reproduced comparison |
|---|---|---|
| FiatTokenProxy | Solidity `0.6.12+commit.27d51765`, optimizer enabled / 10,000,000 runs, Istanbul | Full 1,798-byte runtime identical to the verification record |
| FiatTokenV2_2 | Same compiler/settings; linked SignatureChecker `0x36939d5a1ca73901058f3fa2ba0b7546e7144d7a` | Executable 23,411-byte prefix identical; full 23,464-byte runtime differs in 32 bytes of trailing IPFS metadata |
| WETH9 | Solidity `0.4.19+commit.c4cbbb05`, optimizer disabled | Full 3,124-byte runtime identical to the verification record |

The implementation is a Sourcify **`match`**, not `exact_match`. Its only differing
bytes occupy offsets 23421–23452, within the final 53-byte CBOR metadata trailer.
The executable prefix, including linked library addresses, is identical. No arbitrary
byte stripping, library replacement or claim of a full metadata match is made.
The linked signature library is used by authorization/permit paths; the ordinary
`transfer`/`transferFrom` path under review does not call it.

Runtime SHA-256 values below hash the raw bytes, not their hexadecimal text:

| Contract | Recorded onchain runtime SHA-256 |
|---|---|
| Proxy | `846efa39d1689bdcffea1cdabe788d0b6f81050c0667ad6444e722aed27f7e86` |
| Implementation | `eb2726ec3ac0cb69704b0d37e7076470f47e87c6eaac452f173d58c607b4265f` |
| WETH9 | `9bbda01ae25d1f2b4171918cc6280a5769d6d6fc5500ed01e2143697902df4e1` |

The implementation executable-prefix SHA-256 is
`6991ce72b9df21fdce5bce22a97d84aa005102fadd702f8b75bd8bf70a703ddc`.
The separate [research manifest](evidence/sepolia-token-semantics.json) retains the
runtime bytes, source-response hashes, exact verification URLs and compiler evidence.
Matching these records is source authentication under the stated compiler/service
trust; a pinned public RPC comparison is a separate required observation.

## USDC proxy identity

The authenticated FiatTokenProxy uses **legacy ZeppelinOS unstructured slots**:

- Implementation: `0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`, the hash of `org.zeppelinos.proxy.implementation`.
- Admin: `0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b`, the hash of `org.zeppelinos.proxy.admin`.

These are not EIP-1967 slots. The source exposes public `implementation()` and
`admin()` getters; both can be cross-checked against storage without impersonation.
At discovery block **12072153**, hash
`0x352955965bd5c16126a36944c5d9ebd332611da0f2312196cd1f23ba159c18cf`,
the implementation getter and legacy slot independently returned the implementation
above. Admin getter and slot both returned
`0xd48f3032f64e3127883fda62bc2c47c698d6baf7`.
These are provider-dependent block-end observations, not transaction-boundary state
proofs. They do not establish the implementation at earlier blocks.

## Transfer paths and administrative controls

The authenticated deployed `FiatTokenV1` functions are inherited unchanged by
`FiatTokenV2_2`. Ordinary `transferFrom(from,to,value)` requires an unpaused token,
unblocked caller/from/to, sufficient allowance and sufficient balance. It debits
and credits exactly `value`, emits one `Transfer`, decrements allowance silently,
and returns ABI `true`. Even maximum allowance is decremented: this implementation
has no unlimited-allowance exemption. The proxy's fallback adds no event; delegated
execution emits the token log from the **proxy address**.

The reviewed transfer path has no transfer fee, rebase, receiver hook or external
recipient callback. V2.2 packs the blacklist bit above a 255-bit balance and rejects
an overflowing balance. This is a source-level conclusion about the authenticated
program, not a proof extracted from its event names. An explicit approval emits
`Approval`; authorization, mint/burn and administrative entry points have their
own events. They are not invoked by the proposed ordinary input payment.

USDC remains mutable. The proxy admin can upgrade and change admin; the token owner
can replace the pauser, blacklister and master minter. The pauser can stop transfers;
the blacklister can block participants. For the input leg, the checked participants
must include **Router02 as caller, the actual sender, and the pool**. Public role
addresses identify configured authorities, not the people or mechanisms controlling
them. [Circle's official source](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/v1/FiatTokenV1.sol)
and [proxy source](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/upgradeability/AdminUpgradeabilityProxy.sol)
provide context; that current upstream revision is **not asserted to be the deployed
source revision**. The deployed binding comes from recompiling the exact verified
source inputs recorded in the manifest.

WETH9 is a standalone non-upgradeable contract in the authenticated source/runtime.
Its `transfer` delegates internally to `transferFrom`; ordinary transfers debit and
credit the same raw amount, emit one `Transfer`, and return `true`. Finite third-party
allowance decreases without `Approval`; maximum allowance remains unchanged.
Its ordinary transfer path has no fee, rebasing, pause/blocklist, upgrade control or
recipient hook. `deposit`/payable fallback emit `Deposit`, and `withdraw` emits
`Withdrawal` and sends native ETH. The proposed route uses neither: **native value
stays zero and the output remains WETH**.

## Genuine historical receipt and unchanged adapter replay

The bounded discovery queried exactly two 2,000-block ranges, with the selected pool,
Swap topic and indexed Router02 sender fixed. It returned 48 matching Swap logs;
15 positive-USDC-input transaction candidates were inspected. Four called Router02
directly; eleven called other contracts and were not treated as supported. Discovery
used 25 public read-only requests with no RPC failures. Its `eth_getLogs` calls were
isolated research; the production RPC allowlist remains unchanged.

The strongest selected transaction was then collected independently through the
**unchanged production collector**, including all twelve historical protocol-state
observations, EOA code check, block membership and final canonical/chain rechecks.

| Field | Actual observation |
|---|---|
| Transaction | [`0x43507127d3dc456b9f04f8d303268ae908a3620f08c05a30265567f74e61468d`](https://sepolia.etherscan.io/tx/0x43507127d3dc456b9f04f8d303268ae908a3620f08c05a30265567f74e61468d) |
| Chain / block / index | `11155111` / `12070596` (`0xb82ec4`) / `0x72` |
| Block hash | `0xf6e12d492ab92cd27c63da5cb20dc61f21751825afe83324ead31eb9f8756d26` |
| Block timestamp | `2026-11-05T16:14:12Z` |
| Sender and recipient | `0x1ef24506bbab74c2e99e8b8cbea63ec6d343834f` |
| Call | Direct Router02, selector `0x04e45aaf`, selected token pair, fee `500` |
| Type / native value / price limit | `0x2` / `0` / `0` |
| Input / output raw | `25000000` / `945281192884240` |
| Router minimum raw | `0` (historical fact, not a proposed safe minimum) |
| Capture | `2026-11-05T21:36:28.889Z`–`2026-11-05T21:38:06.784Z` |
| Provider / requests | Public keyless Tenderly / `19`, all successful |
| Collector source | `3835c5a933c1f3f493ff726dd3b597f68c8c6330`; imported production files unchanged |

The **entire receipt** contains these three logs, with no Approval or extra activity:

| Index | Event | Participants | Raw quantity |
|---|---|---|---|
| `0xf9` | WETH `Transfer` | Pool → recipient | `945281192884240` |
| `0xfa` | USDC `Transfer` | Sender → pool | `25000000` |
| `0xfb` | Pool `Swap` | Router02 / recipient | `amount0=25000000`, `amount1=-945281192884240` |

All log/transaction/receipt identities agree. The exact calldata input equals the
input Transfer and positive signed pool input; output Transfer equals negative
signed pool output. Order matches output payment → input callback → Swap.

The unchanged verifier returned **SUCCEEDED / SUPPORTED / COMPLETE / PASS** under a
retrospectively derived **compatibility-only** policy (actual participants/pair,
input cap `25000000`, output minimum `0`). This is not an independently predeclared
financial policy, an owner-executed experiment, a loss incident or a new transaction.
Adding `reserveFloorRaw: "0"` returns **UNKNOWN / PARTIAL**, with the reserve check
UNKNOWN. The evidence digest is
`0x2085ade6fc6fdf6421df10d384492f32994b5ba1a0e296c312054d2a2f1f1171`.

The manifest embeds the exact 172,438-byte canonical capture using `zlib+base64` to
avoid duplicating large contract bytecode in several JSON sections. It includes the
original file SHA-256, digest, readable transaction/receipt, retrospective policy,
source hashes and replay results. Decompression reconstructs the original bytes;
replay checks them without contacting any server. This new research capture does not
replace or modify the existing genuine public example.

The other three direct transaction candidates are recorded in the discovery manifest
summary. Only the selected transaction received complete collector verification.
Do not extend its coverage to the other three.

## Compatibility versus financial state

| Proposition | Supported conclusion |
|---|---|
| Standard token transfer paths | Authenticated deployed programs support ordinary exact-amount transfers with the restrictions above |
| Supported complete receipt | Observed in a genuine included third-party transaction; replayed through the unchanged adapter |
| Extra input Approval | Existing adapter permits at most one ordinary sender/router Approval inside the payment callback; neither authenticated ordinary token path emits it here |
| More transfers/swaps, Deposit/Withdrawal, unrelated events | Remain unsupported; no verifier relaxation |
| Current or historical block-end implementation | Must be tied to its own pinned state observation; never inferred from the token symbol or another block |
| Exact implementation at the transaction boundary | Not independently proven by a block-end getter/code read; an intra-block upgrade is not excluded by that read alone |
| Immediate balances/reserves | UNKNOWN; receipt logs are not independent state proofs |
| Future transfer behavior or transaction success | Not guaranteed; upgrades/configuration and execution conditions can change |

## Scope retained

The research concerns one direct zero-native-value Router02 `exactInputSingle`
USDC → WETH operation. Production receipt verification, schemas, existing genuine
evidence, browser and deployment remain unchanged. Receipt compatibility does not
prove immediate post-transaction balances. No reserve-balance PASS is introduced.
No wallet, faucet, approval, signing, broadcast, deployment or final pre-execution
policy is part of this work.
