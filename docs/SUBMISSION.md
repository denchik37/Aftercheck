# Submission preparation

Prepared 5 November 2026; submission-requirements refresh 7 November 2026 IST. Selected track: **Start from Scratch / Classic**. This is technical submission material, not a statement of accepted participation, prize qualification or completed external submission.

## Project copy

**Name:** Aftercheck

**Tagline:** Check a swap's recorded effects. Keep the evidence.

**Description:** Aftercheck is a read-only, browser-native verifier for a supported direct Uniswap v3 SwapRouter02 swap on Ethereum Sepolia. Given a historical transaction and a user-supplied retrospective policy, it validates retained transaction, receipt and block-bound protocol evidence, reconciles receipt-emitted token amounts, and checks declared input and output limits. Execution success, protocol support, evidence coverage and financial-policy verdict are distinct; unverifiable transaction-boundary reserves stay UNKNOWN. A portable ZIP and offline CLI/browser replay make the reasoning independently reproducible without a wallet or proprietary backend.

**Problem:** A successful receipt does not say whether a swap respected a separately declared spending cap, recipient or received-amount floor. Reviewers also need the evidence and assumptions behind a verdict so that they can reproduce it when an author or service is unavailable.

**Technical contribution:** Strict seven-field Router02 ABI decoding; hash-bound factory/pool observations; signed Swap and ordered Transfer reconciliation; exact `bigint` policy checks; fail-closed reserve uncertainty; bounded input/RPC handling; digest-bound evidence and verified export/CLI parity; a browser-native shared evaluator with responsive policy edits. The CLI can inspect an existing transaction locally via a separately selected RPC. No required application backend or signing authority.

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

For the **current browser-native verifier**, serve committed assets over loopback HTTP (native modules require localhost or HTTPS):

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
```

Open `http://127.0.0.1:8080/inspector.html` and use the retained transaction or import evidence. The separate self-contained `web/report-viewer.html` can open a saved `report.json` directly, but only displays it; it does not rerun evaluation. These rehearsals use **historical testnet evidence** and **retrospectively supplied policies**, not a new event swap.

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

The [event video guidance](https://ethglobal.com/events/mumbai/info/details) and [CROPS challenge](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation) together call for a 2–3 minute video. Use at least 720p, the owner's narration, and an actual dependency-loss demonstration. The owner confirms no AI-generated voiceover was used. The final video has not been independently inspected here. **ETHGlobal expressly disallows AI/text-to-speech voiceover** (as well as sped-up playback and music-plus-text-only narration); use the founder's own human narration. Event upload requires **2–4 minutes** and **at least 720p**; the selected EF CROPS challenge imposes a stricter **3-minute maximum** and requires visibly demonstrating the loss-of-dependency property. Verify the final edit and audio origin before upload.

## Sponsor and owner checklist

- **Chainlink CRE: implemented; official execution qualification remains conditional.**
  The owner superseded the internal deadline gate and authorized completion.
  Present the optional manifest-to-pool comparison and Aftercheck appendix using
  its actual execution classification. Select the third partner as qualified
  only after a successful official CLI simulation is retained; a WASM build,
  `RPC_REHEARSAL` or unit test does not establish that requirement. See the
  [integration guide](CRE_INTEGRATION.md), [readiness evidence](READINESS.md) and
  [decision history](CRE_DECISION.md). No external form or partner selection was changed.
- **Uniswap:** public repository, real protocol evidence, source links and [`FEEDBACK.md`](../FEEDBACK.md) are available. **Developer Feedback Form submitted:** owner-provided completion screenshot (7 November 2026 IST, confirmation screen says 'Thanks for sharing your feedback'). Include the FEEDBACK URL in the sponsor handoff. Sponsor eligibility and ETHGlobal partner selection remain separate and unconfirmed. [Requirements](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation).
- **EF Best CROPS App, conditional:** the README must have a section titled `CROPS` explaining dependencies, reproducibility, third-party exposure and trust assumptions. Retain a video of the lead property surviving dependency loss. The client has no analytics, signing or account system; RPC collection reveals requests and network metadata to the chosen provider. Qualification is unconfirmed. [Requirements](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation).
- **Final submission:** owner action, still pending. **Owner-confirmed Hacker Dashboard deadline: Saturday 7 November 2026, 09:00 IST.** A public event-page rendering indicated 8 November, but the authenticated Hacker Dashboard displays 7 November and controls the working submission cutoff. Treat the earlier date as binding; **do not rely on an extra day**. Submit with a buffer and retain dashboard confirmation. [Official event details](https://ethglobal.com/events/mumbai/info/details), [participant guide](https://ethglobal.com/events/mumbai/info/start).

The supported operation excludes multicall, Universal Router, multi-hop and delegated/native-value routes. Reserve checks remain UNKNOWN. RPC observations and bytecode presence do not prove arbitrary token balance semantics. No new swap, contract deployment, financial protection, independent audit or sponsor acceptance is claimed.

## Submission handoff and evidence gate — refreshed 7 November 2026 IST

**Checked repository state:** public `main` at `1ad2dd1ba629bd0751748a7451619cfe8c5d488d`. [Current main Verify run](https://github.com/denchik37/aftercheck/actions/runs/42300692948) completed successfully, as did [Windows syntax checks](https://github.com/denchik37/aftercheck/actions/runs/42300692969). [Optional CRE run](https://github.com/denchik37/aftercheck/actions/runs/42300693047) is **green for workflow availability and WASM build, not a successful simulator run**: authentication was absent and the actual simulation/consumption steps were skipped. Earlier [public HTTPS acceptance](https://github.com/denchik37/aftercheck/actions/runs/42280622631) passed against deployed `f4fac3b8b7a3680aaef362c76de39e3d1df65fdd`; do not claim the newer `main` revision was deployed merely because its CI passed.

**Prepare and confirm separately; a repository file does not submit a form:**

- [ ] Confirm the live deadline and participation/project status inside the authenticated ETHGlobal Hacker Dashboard.
- [ ] Review the finished video: human voice, 2–3 minutes for the EF intersection, ≥720p, normal playback speed, readable app, honest historical Sepolia/retrospective-policy labels and a visible local/offline replay or dependency-loss demonstration.
- [ ] Verify the public HTTPS app opens and the read-only PASS / VIOLATION / reserve UNKNOWN flow matches the retained evidence; keep an offline CLI/report fallback and record the exact deployed revision.
- [ ] Confirm public repo, license, meaningful development history, README setup, CROPS section, integration code pointers, receipt/explorer link, tests and data provenance; scan public artifacts and video frames for confidential material or secrets.
- [x] **Uniswap Developer Feedback Form submitted.** Owner shared the confirmation screenshot on 7 November 2026 IST. [`FEEDBACK.md`](../FEEDBACK.md) updated; submission receipt screenshot remains in the private conversation (not automatically public). This is separate from selecting Uniswap in the ETHGlobal form.
- [ ] In ETHGlobal submission select **Start from Scratch / Classic**, enter the title/description, public source, deployed app, demo video, and the required integration/feedback fields; choose **Uniswap — Build with Uniswap** and **Ethereum Foundation — Best CROPS App**. The dashboard controls the available partner choices.
- [ ] Select **Chainlink — Best workflow with CRE** only when an **actual successful official CRE CLI simulation or live deployment** and meaningful consumed result are recorded; `RPC_REHEARSAL`, a successful WASM build or a green authentication-gated CI job are insufficient.
- [ ] Check AI/tool attribution and actual pre-event planning-input provenance against Classic rules. Do not misdate or silently claim approval of contested inputs; seek an organizer ruling where required while protecting unrelated confidential context.
- [ ] Save the final form confirmation, selected partners, public project URL, source SHA, video location, evidence/run links and the time of submission. Return to the dashboard to verify the submission is marked complete; check the assigned judging slot after submission.

**External submission state:** no Hacker Dashboard project submission, partner selection or Uniswap feedback-form completion has been independently confirmed in this review.

## Optional CRE presentation segment

After the core receipt-policy and offline demonstrations, show the separate pool-identity appendix. Identify the original recorded pool, the comparison expectation, the historical block and the result status. Run the intentional mismatch to make the discrepancy visible while the core policy verdict remains unchanged. Explain that the EVM call is bound to a block number with a separately compared header; the same Tenderly provider does not establish independent-source authenticity.

If official simulation is authenticated and succeeds, name the actual CLI/SDK versions and source-bound run. Otherwise show `RPC_REHEARSAL` only where a real rehearsal record exists and explicitly state that official CRE execution remains pending. Keep this segment short enough for the event's current video guidance; the pre-existing primary demonstration remains the lead story.

**Current truthful sponsor copy:** “Aftercheck adds an optional Chainlink CRE workflow that combines a revision-pinned public evidence manifest with a historical Sepolia Uniswap factory read. Its separate report appendix exposes MATCH, MISMATCH, UNAVAILABLE and UNSUPPORTED without changing the financial-policy verdict. The official SDK workflow compiles to WASM. Live Node HTTP/RPC rehearsal produced MATCH, intentional MISMATCH and fetch-failure UNAVAILABLE, and Aftercheck consumed those results. Official CLI simulation is currently blocked by account authentication, so sponsor execution qualification remains incomplete.”

For a reproducible presentation without live endpoint or account dependencies,
run `npm run cre:demo`. It replays the retained real RPC observations, visibly
labelled **OFFLINE REPLAY OF RETAINED RPC_REHEARSAL**; it performs no new CRE
execution. The five appendices are under `output/cre-demo`.

**AI assistance and provenance:** the optional CRE implementation, review and tests were assisted by ChatGPT. Actual commits, source revisions and execution logs establish what was built and run. Earlier planning is not relabelled as event-time implementation. The owner must accurately describe their own contributions and resolve any organizer questions about dated inputs; this repository does not certify participation or eligibility.
