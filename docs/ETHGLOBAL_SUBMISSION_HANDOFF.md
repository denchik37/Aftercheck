# ETHGlobal Mumbai 2026 — final submission handoff

**Prepared:** 7 November 2026 IST. **Submission:** NOT submitted; no dashboard confirmation or final video upload has been observed. **Track:** Start from Scratch / Classic (unchanged). **Technical baseline:** public `main` at `4232debe14a2ce98dc2745bf39d24b99a7d68a01`, with verified official CRE simulator evidence from source `1ad2dd1ba629bd0751748a7451619cfe8c5d488d`. Documentation-only revisions do not retroactively change which source was simulated.

## Copy for the ETHGlobal project form

**Project name:** Aftercheck

**Tagline:** Check a swap's recorded effects. Keep the evidence.

**Short description:**

> Aftercheck is a read-only, local-first checker for a supported Uniswap v3 swap on Ethereum Sepolia. It separates successful execution from whether a declared, retrospective financial policy was met, reports PASS / VIOLATION / UNKNOWN with explicit evidence limits, and exports reproducible local reports. An optional Chainlink CRE workflow retrieves a public evidence manifest and checks the historical Uniswap pool through a Sepolia EVM read; verified CLI simulations show MATCH, deliberate MISMATCH and UNAVAILABLE without changing the core verdict.

**Repository:** https://github.com/denchik37/aftercheck

**Working static browser demo:** https://aftercheck-g4nsb.ondigitalocean.app/ (the public browser build was verified against deployed source `f4fac3b8`; the hosted UI does **not** display the optional CRE appendix).

**Video:** **NOT YET ASSEMBLED OR UPLOADED.** Add the final human-narrated MP4 link/upload only after viewing the rendered master.

**Contract deployments by this project:** None. The demonstration inspects an existing *third-party* Sepolia transaction: `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`, block `7689923`; no new swap, funded wallet or contract was deployed by this read-only verifier.

## Partner selections and concise justification

Select at most **three** in the Hacker Dashboard (subject to actual eligibility):

| Partner / challenge | Pasteable explanation | Proof |
|---|---|---|
| **Uniswap Foundation — Build with Uniswap** | Our direct Uniswap v3 SwapRouter02 inspector decodes and reconciles a real historical Sepolia swap's calldata, receipt, Swap and Transfer events, and factory/pool identity against declared policy. It rejects unsupported routes and preserves reserve UNKNOWN. | [Protocol adapter](../src/uniswap.ts), [historical capture](../examples/sepolia/README.md), [developer feedback](../FEEDBACK.md) |
| **Ethereum Foundation — Best CROPS App** | Aftercheck exports the evidence and deterministic evaluator output for local CLI/browser replay without a founder-controlled backend or live RPC. Its privacy, source authenticity and fresh-data limitations are explicit. | [Runbook](WINDOWS_QUICKSTART.md), [CROPS README section](../README.md), [public browser acceptance](READINESS.md) |
| **Chainlink — Best workflow with CRE** | Our official CRE SDK workflow fetches an immutable HTTPS evidence manifest, reads a historical Sepolia Uniswap v3 factory pool through the EVM capability, and provides a separately consumed MATCH / controlled MISMATCH / UNAVAILABLE appendix. Authenticated CRE CLI simulation succeeded for all three; local simulation is not a deployed DON attestation. | [CRE submission copy](CRE_SUBMISSION.md), [source](../integrations/cre/workflow/main.ts), [verified simulator results](evidence/cre/official-2026-11-07/README.md) |

**Open sponsor action:** The [Uniswap Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback) must be completed with the public [FEEDBACK.md](../FEEDBACK.md) link. File existence is not proof of form submission. No Uniswap form confirmation has been observed.

**AI / provenance:** AI-assisted code, tests, documentation and review are disclosed in [AI_USAGE.md](../AI_USAGE.md). Human decisions, account setup and authenticated CLI execution must be accurately described; never claim an independent human security audit. Detailed Aftercheck-specific planning artifacts existed on **28 October 2026**, before the event. Their eligibility for the Classic track is **unresolved**. The official [Classic rules](https://ethglobal.com/events/mumbai/info/details) disallow pre-kickoff project-specific designs; actual provenance must not be obscured, and any organizer-required permission/disclosure must be handled before asserting eligibility.

## One final master video — target 2:58, not separate sponsor videos

**Editorial directive:** Use the already prepared, real demo assets. The approved intro is about **58.8 seconds**; the synchronized browser demo is about **64.8 seconds**. Retain natural playback speed; trim unused holds or narration **without accelerating playback**. Time ranges below are editorial targets, not evidence of an already assembled video.

| Final time | Show | Spoken point |
|---|---|---|
| **0:00–0:59** | Approved `Aftercheck_The_Why_CleanVoice-esv2-50p-bg-10p-music-10p` intro with title/problem. | Successful execution does not prove every retrospective financial policy requirement. |
| **0:59–2:04** | `Aftercheck_Browser_Demo_Synced`: genuine transaction, imported evidence, PASS → stricter-policy VIOLATION → reserve UNKNOWN. | The *same* historical transaction, changing only declared rules; unavailable boundary balance remains UNKNOWN. |
| **2:04–2:15** | Actual browser export of evidence/report package. | Export the exact evidence and analysis. |
| **2:15–2:36** | Actual CLI recording: network disabled, offline verification/replay, matching saved report and expected exit code. | Anyone can reproduce the report without our server or fresh RPC. Do not claim fresh chain verification. |
| **2:36–2:54** | **CRE insert:** show source `HTTP manifest → historical Sepolia factory.getPool`, then actual recorded `CRE_CLI_SIMULATION` MATCH, controlled MISMATCH, UNAVAILABLE and unchanged core PASS. Onscreen label: **Recorded official CRE CLI simulation; not DON deployment**. | “Chainlink CRE fetches public evidence and reads the historical Uniswap pool. Our official simulation returned MATCH, deliberate MISMATCH, and UNAVAILABLE for a missing manifest. The core policy verdict stays unchanged.” |
| **2:54–2:58** | Aftercheck wordmark; GitHub and working demo URLs. | “Aftercheck: check the outcome; keep the evidence.” |

**Assets and real-state boundary:** The approved final `Aftercheck_NextPart_CleanVoice-esv2-50p-bg-10p-music-10p` audio is longer than the **32-second** export-plus-CLI allocation; select its essential human-spoken lines rather than speeding it up. The final CLI screencast and assembled master **have not been supplied in this submission-preparation context**. Preserve all real screencast and historical-evidence labels; do not stage a mock CLI run as if it were a newly executed CRE simulation. Use the published recorded CRE evidence if the actual CRE terminal capture is unavailable.

**Hard export gates:** **2–3 minutes total** to satisfy both the event's 2–4 minute upload rule and the EF CROPS 3-minute maximum; **at least 720p**, preferably 1080p/30fps; **human voiceover, no AI-generated speech or text-to-speech**; normal playback speed; no music-only text explanation. Keep readable source/status and the actual offline dependency-loss moment. An audio-cleanup workflow is fine only if the narration remains the speaker's genuine human voice. Review the entire rendered file before upload.

## Owner submission checklist — incomplete items are NOT done

1. Confirm participation/Classic provenance with organizers as required; this technical package does not establish eligibility.
2. Verify final video meets the duration, audio and resolution rules; upload it to the ETHGlobal form. **Video upload: PENDING.**
3. Complete [Uniswap Developer Feedback](https://developers.uniswap.org/hackathon-feedback) with the `FEEDBACK.md` URL. **Form confirmation: PENDING.**
4. Submit [Hacker Dashboard](https://ethglobal.com/events/mumbai/info/details) project name, description, repo, public demo, video and selected **Uniswap / Ethereum Foundation / Chainlink** partner challenges. **External submission: PENDING.**
5. Retain the actual dashboard submission URL/confirmation, selected partners and final video asset digest. Do not claim an award or verified partner acceptance.

**Official deadline:** **Sunday 8 November 2026, 09:00 IST** per the current [ETHGlobal Mumbai submission guide](https://ethglobal.com/events/mumbai/info/details). Older project runbooks recording 7 November were superseded; the Hacker Dashboard is the authority for the account's actual submission state.

**Direct CRE result:** [official local simulation evidence](evidence/cre/official-2026-11-07/README.md) · [CRE sponsor-specific copy](CRE_SUBMISSION.md). This is an experimental verifier and a narrow pool-identity check—not wallet protection, a balance proof, original-intent authentication, independent-provider verification, or an audit.
