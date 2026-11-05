# Submission preparation

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

- **Uniswap:** retain the public MIT-licensed repository, actual protocol evidence, source locations in the README and [`FEEDBACK.md`](../FEEDBACK.md); submit the [Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback) with the FEEDBACK URL. Form completion is pending. [Requirements](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation).
- **EF Best CROPS App, conditional:** the README must have a section titled `CROPS` explaining dependencies, reproducibility, third-party exposure and trust assumptions. Retain a video of the lead property surviving dependency loss. The client has no analytics, signing or account system; RPC collection reveals requests and network metadata to the chosen provider. Qualification is unconfirmed. [Requirements](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation).
- **Eligibility and attribution:** obtain an organizer determination about the supplied project-specific planning inputs dated 28 October 2026 and complete the required input disclosure; accurately state meaningful human contributions. [`AI_USAGE.md`](../AI_USAGE.md) records the unresolved Classic eligibility issue and is not a complete prompt archive.
- **Final submission:** owner action, still pending. Official deadline: **7 November 2026, 09:00 IST**; aim to finish the package by **05:00 IST**. Confirm any organizer updates and submit through the Hacker Dashboard. [Event details](https://ethglobal.com/events/mumbai/info/details).

The supported operation excludes multicall, Universal Router, multi-hop and delegated/native-value routes. Reserve checks remain UNKNOWN. RPC observations and bytecode presence do not prove arbitrary token balance semantics. No new swap, contract deployment, financial protection, independent audit or sponsor acceptance is claimed.
