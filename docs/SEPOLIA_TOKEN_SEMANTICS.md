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

## Scope retained

The research concerns one direct zero-native-value Router02 `exactInputSingle`
USDC → WETH operation. Production receipt verification, schemas, existing genuine
evidence, browser and deployment remain unchanged. Receipt compatibility does not
prove immediate post-transaction balances. No reserve-balance PASS is introduced.
No wallet, faucet, approval, signing, broadcast, deployment or final pre-execution
policy is part of this work.
