# Case study: successful swap, violated output policy

**A genuine successful Uniswap transaction violates a separately supplied retrospective financial policy.** The same retained Sepolia evidence produces `PASS` under the existing example policy and `VIOLATION` under a stricter output floor. Execution remains `SUCCEEDED` in both reports.

This historical transaction was executed by a third party on 12 February 2025. Both example policies were supplied afterward. The case establishes a reproducible policy comparison; it does not establish the original trader's instructions or an actual historical financial loss.

## A. The operator's problem

A transaction receipt answers whether execution succeeded. An operator may also require a spending cap, a minimum received amount, approved assets and a particular recipient. Those financial instructions need their own evaluation.

The concrete failure mode here is an external output requirement that is stricter than the minimum encoded in the router call. The router's requirement can be satisfied while the separate policy fails. Aftercheck keeps execution, protocol support, evidence coverage and financial verdict separate so an operator can inspect that distinction.

## B. The actual transaction

The [retained evidence](../examples/sepolia/evidence.json) is the original committed RPC capture. The [capture record](../examples/sepolia/README.md) documents its acquisition and independent literal expectations; [real-case tests](../test/real-case.test.mjs) check its exact file hash, calldata and raw receipt logs.

| Identity or observation | Value |
|---|---|
| Network | Ethereum Sepolia, chain ID `11155111` |
| Transaction | [`0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`](https://sepolia.etherscan.io/tx/0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9) |
| Execution time | 12 February 2025, 03:02:00 UTC, from captured block timestamp `0x67ac0f28` |
| Block / transaction index | `7689923` / `106` |
| Block hash | `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34` |
| Receipt execution status | `0x1`, interpreted as `SUCCEEDED` after identity validation |
| Supported operation | Direct Uniswap v3 SwapRouter02 `exactInputSingle`, selector `0x04e45aaf` |
| Router | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` |
| Factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` |
| Pool / fee | `0x029603931809d430ae47d2f55212cc0e89dbfd52` / `500` |
| Owner and recipient | `0x3f82931394a11582e89366fb837e53d5d0baa62a` |
| Input token | `0x0f47e03a0383396635846f8495003fc478b71bca` |
| Output token | `0x9142fa65aaef921aea2127e88758adee0510a0f0` |
| Observed input | `1000000000000000000` raw input-token units |
| Observed output | `999496253769344460` raw output-token units |
| Router `amountOutMinimum` | `0` raw output-token units |

The receipt contains an output `Transfer` at log index `111`, an input `Transfer` at `112`, and a pool `Swap` at `113`. The [existing verifier](../src/uniswap.ts) reconciles their participants and exact amounts with the calldata and factory-selected pool. The observed output exceeds the encoded minimum of zero, consistent with successful execution under the supported router profile. No policy threshold is inserted into the historical calldata or receipt.

The [capture record](../examples/sepolia/README.md) attributes acquisition to the keyless Tenderly Sepolia endpoint in [capture run 42068312090](https://github.com/denchik37/aftercheck/actions/runs/42068312090). The bundle records acquisition at `2026-11-05T16:49:14.801Z`. Its twelve historical code and contract-call observations use the same block hash with `requireCanonical: true`. This case uses that one capture without filling gaps from other providers.

| Integrity reference | Value |
|---|---|
| Evidence payload digest | `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093` |
| Original evidence file SHA-256 | `d57013b097c323271d25a021f6244e79a00ec72853dd6aed0828f2a481fe0c36` |

[Evidence parsing](../src/evidence.ts) recomputes the payload digest before evaluation. The file hash additionally fixes the original committed bytes. A matching digest detects changes relative to that reference; it does not independently authenticate RPC observations or prove consensus.

## C. Two different policy outcomes

[The runner](../scripts/case-study.mjs) evaluates both policies through the existing [`verifyEvidence`](../src/verify.ts) entry point. The new [output-threshold policy](../examples/sepolia/policy-output-threshold.json) changes only `minReceivedRaw` from the [existing PASS policy](../examples/sepolia/policy-pass.json). Chain, owner, recipient, token pair and input cap stay identical.

| Report dimension | Existing supplied policy | Stricter retrospective output policy |
|---|---|---|
| Execution | `SUCCEEDED` | `SUCCEEDED` |
| Protocol support | `SUPPORTED` | `SUPPORTED` |
| Evidence coverage | `COMPLETE` | `COMPLETE` |
| Financial verdict | `PASS` | `VIOLATION` |
| Violated check | None | `minReceivedRaw` |

**Same transaction. Same receipt. Same evidence. Different supplied financial requirements.** Both reports retain the evidence digest above and the same block identity and observed amounts. Their policy digests differ. The financial verdict changes because the supplied output floor changes.

`COMPLETE` means the required evidence is complete for these supported receipt-scoped checks. Neither policy requests a reserve check. It does not mean complete knowledge of wallet state or of every possible financial condition. The existing reserve example still returns `UNKNOWN` with `PARTIAL` coverage.

## D. Exact financial comparison

All figures below are integer raw units. Input and output refer to different token contracts.

| Financial check | Existing supplied policy | Stricter retrospective output policy |
|---|---|---|
| Input cap, `maxInputRaw` | `1000000000000000000` | `1000000000000000000` |
| Observed input | `1000000000000000000` | `1000000000000000000` |
| Required output, `minReceivedRaw` | `999000000000000000` | `1000000000000000000` |
| Observed output | `999496253769344460` | `999496253769344460` |
| Shortfall below output floor | `0` | `503746230655540` |
| `minReceivedRaw` result | `PASS` | `VIOLATION` |
| Financial verdict | `PASS` | `VIOLATION` |

The runner calculates the stricter policy's shortfall with `bigint`:

```js
BigInt(policy.minReceivedRaw) - BigInt(report.protocol.amountOutRaw)
// 1000000000000000000n - 999496253769344460n
// = 503746230655540n raw output-token units
```

This subtracts output-token units from an output-token requirement. It does not compare the economic values of the input and output assets. The contracts are testnet tokens; this case does not authenticate decimals or prices and asserts no human-readable token conversion, USD value, exchange-rate loss or missing funds.

## E. Why this matters

A trading agent could mark a task complete after receiving a successful receipt even when an external output floor was missed. An automation system could then start a dependent operation. A treasury reviewer could need an auditable explanation for why a completed swap failed a financial check.

These are possible operating scenarios, not events established about this historical trader. The case supplies the concrete reconciliation evidence an integration would need: the unchanged transaction, the separate policy, the exact observed amount, the failed check and the shortfall. The operator can then decide whether dependent work should proceed.

## F. What should be fixed before execution?

Recommended controls belong in the transaction-building system:

1. Validate the financial instructions, raw-unit amounts, chain, token addresses and recipient before constructing a swap.
2. Encode a router minimum output consistent with the declared output floor. For the supported route, a below-floor output must not satisfy the router's minimum-output check.
3. Review the difference between the declared policy and the transaction parameters. A zero minimum does not encode a positive output requirement.
4. Require explicit review when a policy requirement cannot be enforced by the selected route, including requirements needing additional state evidence.

These are proposed integration controls. Aftercheck's current replay reads evidence and reports results; it did not construct, authorize or prevent this transaction. Raising a minimum is an execution constraint, not a guarantee that a desired trade will succeed.

## G. What should happen after execution?

An operator or integrating system should collect the transaction, receipt and required supporting observations, then run Aftercheck against the declared policy. On a violation, review the failed check and preserve `evidence.json`, `policy.json`, `report.json` and `report.md` together.

The operator can alert the responsible person, consider pausing dependent operations, investigate the transaction parameters and correct future transaction construction. Those alerts and pauses require human action or a separate integration. Aftercheck currently reports findings; it does not automatically stop other systems, undo transactions or recover funds.

## H. What Aftercheck cannot prove

The [supported profile and trust model](PROTOCOL.md) limit the conclusions:

- The original trader's intent, actual economic loss, optimal execution or an MEV attack.
- Arbitrary token balance semantics: internally consistent `Transfer` and `Swap` logs are evaluated under a plain-token assumption.
- Complete wallet reserves immediately after the target transaction. Captured contract metadata describes block-end observations, and no transaction-boundary balance reconstruction is performed.
- Independent consensus or finality. Replay trusts the retained RPC observations and cannot refresh canonicality.
- Safety of real funds, an audit, or permission to move funds.

Unsupported routes and missing or conflicting required evidence cannot become `PASS`. A reserve requirement remains `UNKNOWN`; the amount-policy demonstration does not remove that limitation.

## Reproduce and inspect

Use Node.js 24 or later. From the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/case-study.mjs
```

Dependency installation may need network access. The case-study replay itself uses Node built-ins and needs no RPC service, wallet, credential or new transaction. The runner loads the existing network-blocking rehearsal guard on every invocation. To preload the same guard explicitly and choose an isolated output root:

```bash
node --disable-warning=ExperimentalWarning --experimental-strip-types --import ./scripts/offline-guard.mjs scripts/case-study.mjs output/case-study-offline
```

The guard disables `fetch` and common Node network entry points; it is a test guard, not an operating-system security boundary. An explicit output root resolves from the caller's working directory; the default is the repository's `output/case-study`. With that default, the runner writes:

| Directory | Files |
|---|---|
| `output/case-study/pass/` | `evidence.json`, `policy.json`, `report.json`, `report.md` |
| `output/case-study/output-threshold-violation/` | `evidence.json`, `policy.json`, `report.json`, `report.md` |

Reports use the existing `aftercheck.report.v1` schema and Markdown renderer. Evidence and policies remain separate; the canonical JSON export can have different whitespace from the source file while preserving the same evidence content and payload digest. [The existing output utility](../src/output.ts) publishes each case's complete four-file directory atomically. Publication of the two directories is not one combined atomic transaction; if a run fails, earlier output may remain, so check the process exit and report identities before using it.

The runner exits `0` only when the expected comparison and exports succeed. This means the demonstration succeeded; the stricter report's financial verdict remains `VIOLATION`. To independently replay that exported case through the normal verifier:

```bash
npm run cli -- verify output/case-study/output-threshold-violation/evidence.json output/case-study/output-threshold-violation/policy.json output/case-study-independent
```

That command intentionally exits `2` for `VIOLATION`; `0` means `PASS`, `3` means `UNKNOWN`, and `1` means invalid input or failure. See [`bin/aftercheck.mjs`](../bin/aftercheck.mjs).

Open [`web/inspector.html`](../web/inspector.html) locally and import either `report.json`. The existing report fields expose the four separate dimensions and the `minReceivedRaw` check. The supplied threshold is retained in `policy.json` and in the check explanation; no custom business-verdict schema is required.

[`test/case-study.test.mjs`](../test/case-study.test.mjs) covers the policy contrast and runner; [`test/real-case.test.mjs`](../test/real-case.test.mjs) retains the independent historical capture regressions. Reproduction results and source revision should be taken from the corresponding commit's test and CI logs.
