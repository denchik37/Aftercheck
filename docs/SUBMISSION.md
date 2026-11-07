# Submission preparation

> **7 November 2026 final handoff:** [ready-to-paste ETHGlobal fields, three partner links, 2:58 human-voiced master-video direction, and the owner submission checklist](ETHGLOBAL_SUBMISSION_HANDOFF.md). This handoff preserves the verified CRE simulator evidence. **Final MP4, Classic provenance resolution and ETHGlobal submission confirmation remain pending. The Uniswap feedback form was submitted and its on-screen success confirmed by the owner on 7 November 2026 IST.**

Prepared 5 November 2026. Selected track: **Start from Scratch / Classic**. This is technical submission material, not a statement of accepted participation, prize qualification or completed external submission.

## Project copy

**Name:** Aftercheck

**Tagline:** Check a swap's recorded effects. Keep the evidence.

**Description:** Aftercheck is a local, read-only verifier for a narrow direct Uniswap v3 SwapRouter02 swap on Ethereum Sepolia. It collects transaction, receipt and block evidence, checks router/factory/pool identities with hash-bound historical reads, and compares reconciled receipt-emitted amounts with a declared financial policy. Execution, protocol support, evidence coverage and policy verdict remain separate. Portable evidence and JSON/Markdown reports can be replayed offline; a local browser viewer explains the saved report without a wallet connection.

**Problem:** A successful receipt does not say whether a swap respected a separately declared spending cap, recipient or received-amount floor. Reviewers also need the evidence and assumptions behind a verdict so that they can reproduce it when an author or service is unavailable.

**Technical contribution:** Strict seven-field ABI decoding; independent factory/pool observations; signed Swap and ordered Transfer reconciliation; exact `bigint` policy checks; fail-closed uncertainty; bounded input and RPC handling; digest-bound evidence; offline replay; a static local report viewer. The application uses public protocol interfaces and Node.js; it has no required application backend.

## Integration evidence

| Component | Inspectable source |
|---|---|
| Direct Router02 calldata, deployment constants, historical state requests and event reconciliation | [`src/uniswap.ts`](../src/uniswap.ts) |
| Transaction/receipt/block collection and identity checks | [`src/evidence.ts`](../src/evidence.ts), [`src/collect.ts`](../src/collect.ts) |
| Integrity and policy replay | [`src/json.ts`](../src/json.ts), [`src/verify.ts`](../src/verify.ts) |
| CLI and local viewer | [`bin/aftercheck.mjs`](../bin/aftercheck.mjs), [`web/inspector.html`](../web/inspector.html) |
| Supported assumptions and exclusions | [`PROTOCOL.md`](PROTOCOL.md) |

Sepolia Router02: `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e`. Factory: `0x0227628f3f023bb0b980b67d528571c95c6dac1c`. Their mapping is recorded in the [official deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments).

**Historical example: complete RPC capture and independent local replay verified.** The example is third-party Sepolia transaction [`0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`](https://sepolia.etherscan.io/tx/0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9), executed on **12 February 2025**, with read-only RPC observations captured on **5 November 2026**. It is not a newly executed Aftercheck transaction.

The [capture workflow](https://github.com/denchik37/aftercheck/actions/runs/42068312090) ran source `14b9ca2d9934146300046656d283d88c788a5bc6` and retained the unmodified Tenderly bundle with digest `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093`. The receipt, independent explorer literals, and all 12 required hash-bound protocol observations agree. The retrospective policies demonstrate PASS, an input-cap VIOLATION, and reserve UNKNOWN. See [exact identities, quantities and provenance](../examples/sepolia/README.md) and [release verification](READINESS.md). These are RPC observations under the documented trust assumptions, not consensus proofs.

## Working local rehearsal

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
```

Open `web/inspector.html` locally and import `output/demo/pass/report.json`, then compare `output/demo/violation/report.json` and `output/demo/reserve/report.json`. This rehearsal replays **historical testnet RPC evidence**. The viewer displays a saved report; it does not independently verify Ethereum or execute the evaluator.

The underlying standalone replay command is:

```bash
npm run cli -- verify examples/sepolia/evidence.json examples/sepolia/policy-pass.json output/replay
```

After dependencies are installed, repeat replay with network access disabled. Show the saved evidence and policy, regenerated reports and the local viewer. A matching digest establishes artifact integrity, not authenticity or refreshed chain finality.

## Human-narrated video: target 2 minutes 45 seconds

Use the retained historical testnet case and identify its transaction date separately from its capture date. The demonstration policies were supplied after execution.

| Time | Screen and narration |
|---|---|
| 0:00–0:20 | Show the four report statuses. “A transaction can succeed while missing a financial rule. Aftercheck checks recorded effects against the policy supplied for this analysis.” |
| 0:20–0:55 | Show the transaction, chain, pinned protocol addresses, receipt evidence and declared raw-unit policy. Identify whether the evidence is a historical testnet capture or a synthetic fixture. Explain that the policy is retrospective. |
| 0:55–1:25 | Lower the input cap and replay to show VIOLATION. Add a reserve floor and show UNKNOWN. “Transfer events do not prove the wallet balance immediately after this transaction.” |
| 1:25–2:15 | Disable network access after setup. Run offline replay and reopen the local report viewer. Show that evidence, policy and reports remain available with no author-controlled backend. Explain that fresh collection still depends on an RPC provider. |
| 2:15–2:45 | Show source, tests and limitations. “The supported slice is one direct Sepolia swap. This checks receipt-emitted amounts under explicit token assumptions. It does not simulate the AMM, verify consensus, audit tokens or protect real funds.” |

The [event video guidance](https://ethglobal.com/events/mumbai/info/details) and [CROPS challenge](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation) together call for a 2–3 minute video. Use at least 720p, the owner's narration, and an actual dependency-loss demonstration. Recording is pending.

## Sponsor and owner checklist

- **Chainlink — Best workflow with CRE: technical criteria demonstrated with
  official local simulation.** On 7 November 2026 IST, authenticated CRE CLI
  1.39.0 plus SDK 1.23.0 executed **MATCH, intentionally altered MISMATCH and
  missing-manifest UNAVAILABLE** against the fixed Sepolia manifest/Uniswap
  factory profile. Aftercheck consumed all three results, exposing the external
  corroboration separately while retaining its core financial-policy PASS.
  See [full reviewed source-bound results and sanitized logs](evidence/cre/official-2026-11-07/README.md),
  [audit index](evidence/cre/official-2026-11-07/audit-index.json),
  [technical integration](CRE_INTEGRATION.md) and
  [partner-specific submission copy](CRE_SUBMISSION.md).
  Select Chainlink as the **third partner** only if Classic participation and
  the use/disclosure of any pre-event project-specific design inputs satisfy
  the organizer's rules. No Chainlink deployment, DON attestation, accepted
  prize or partner-dashboard selection is implied.
- **Uniswap:** public repository, protocol evidence, source locations and [`FEEDBACK.md`](../FEEDBACK.md) are available. The owner submitted the [Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback) and supplied its success-screen confirmation on 7 November 2026 IST; screenshot retained privately. Sponsor qualification and ETHGlobal partner selection remain separate. [Requirements](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation).
- **EF Best CROPS App, conditional:** the README must have a section titled `CROPS` explaining dependencies, reproducibility, third-party exposure and trust assumptions. Retain a video of the lead property surviving dependency loss. The client has no analytics, signing or account system; RPC collection reveals requests and network metadata to the chosen provider. Qualification is unconfirmed. [Requirements](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation).
- **Final submission:** owner action, still pending. The owner directly confirmed **Saturday, 7 November 2026, 09:00 IST** as the deadline in the authenticated Hacker Dashboard; treat that as binding despite conflicting public-guide text. Submit with up to **three partners**, public GitHub source and a human-narrated **2–4 minute, ≥720p** video; obtain submission confirmation before cutoff. Existing static-site acceptance does not imply video or dashboard submission.

The supported operation excludes multicall, Universal Router, multi-hop and delegated/native-value routes. Reserve checks remain UNKNOWN. RPC observations and bytecode presence do not prove arbitrary token balance semantics. No new swap, contract deployment, financial protection, independent audit or sponsor acceptance is claimed.

## Optional CRE presentation segment

After the core receipt-policy and offline demonstrations, show the separate pool-identity appendix. Identify the original recorded pool, the comparison expectation, the historical block and the result status. Run the intentional mismatch to make the discrepancy visible while the core policy verdict remains unchanged. Explain that the EVM call is bound to a block number with a separately compared header; the same Tenderly provider does not establish independent-source authenticity.

Show the actual authenticated **CRE_CLI_SIMULATION** results and cite the
7 November source revision and retained logs; do not show the earlier
`RPC_REHEARSAL` as if it were CRE. Keep this segment brief within the event's
2–4-minute video limit. A `MATCH` is protocol-identity corroboration, not
transaction-boundary reserve proof. Chainlink requires no deployment for the
selected CRE category.

**Current truthful Chainlink sponsor copy (7 November 2026 IST):**
“Aftercheck uses a Chainlink CRE workflow to fetch a revision-pinned public
evidence manifest and read a historical Uniswap v3 factory on Ethereum Sepolia.
It compares the actual `getPool` observation with the manifest, checks the
numbered block header separately, and appends an independent result to the
Aftercheck financial report. The authenticated CRE CLI simulation (v1.39.0,
SDK v1.23.0) produced MATCH, deliberately altered MISMATCH and
HTTP-unavailable results. Aftercheck consumed all three without changing the
core policy verdict. It is a local simulation, not a deployed DON or state
proof; the read is number-bound and uses the same RPC provider as the capture.”

For a reproducible presentation without live endpoint or account dependencies,
run `npm run cre:demo`. It replays the retained real RPC observations, visibly
labelled **OFFLINE REPLAY OF RETAINED RPC_REHEARSAL**; it performs no new CRE
execution. The five appendices are under `output/cre-demo`.

**AI assistance and provenance:** the optional CRE implementation, review and tests were assisted by ChatGPT. Actual commits, source revisions and execution logs establish what was built and run. Earlier planning is not relabelled as event-time implementation. The owner must accurately describe their own contributions and resolve any organizer questions about dated inputs; this repository does not certify participation or eligibility.
