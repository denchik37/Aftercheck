# Readiness checkpoint

## Chainlink CRE sponsor technical readiness — 7 November 2026 IST

**CRE READY — VERIFIED local CLI simulation, but no live DON deployment or
external award acceptance claimed.** An authenticated Chainlink CRE CLI **1.39.0**
at exact source `1ad2dd1ba629bd0751748a7451619cfe8c5d488d` executed an
actual HTTP-manifest-plus-historical-Sepolia-EVM workflow in QuickJS/WASM with
SDK **1.23.0**, Bun **1.4.4**, producing three validated results:
**MATCH**, deliberate **MISMATCH**, and HTTP-failure **UNAVAILABLE**.
All three `execution.json` records report `exitCode=0` and
`VALIDATED_SIMULATOR_RESULT`. The Aftercheck consumer recomputed each separate
corroboration appendix with the **core PASS unchanged**. The owner-supplied
34,752-byte ZIP was inspected offline (ZIP CRC, 28 entries, bounded paths,
secret/privacy patterns, per-file hashes, canonical result hashes, execution
source binding, unchanged core report byte hashes) before the matching sanitized
records were published.

**Primary evidence:** [official CRE simulator records, logs and review](evidence/cre/official-2026-11-07/README.md),
[byte-hash index](evidence/cre/official-2026-11-07/audit-index.json),
[full integration guide](CRE_INTEGRATION.md), and [sponsor submission copy](CRE_SUBMISSION.md).
The original archive SHA-256 is
`3aefbda5ed2899cfd3b41bee257505f362a1f72efec51ca95bdc12b4d5ad4c45`.

| Sponsor-readiness axis | Status | Evidence / bound |
|---|---|---|
| CRE01 meaningful HTTP+blockchain workflow | **PASS** | Immutable public HTTPS evidence manifest plus block-number-bound Sepolia `factory.getPool` from actual CRE SDK workflow |
| CRE02 official execution | **PASS** | Locally authenticated CRE CLI results MATCH/MISMATCH/UNAVAILABLE at `1ad2dd1`; not merely compiler or rehearsal |
| CRE03 application consumption | **PASS** | Core `SUCCEEDED / SUPPORTED / COMPLETE / PASS` unchanged; three external statuses imported, including discrepancy and missing-input semantics |
| CRE04 source and execution reproduction | **PASS, bounded** | Committed source/results/logs/execution, hashes, pinned versions/manifest and offline consumer; authenticated local rerun uses owner's CRE session |
| CRE05 truthful security and provenance | **PASS for technical claims** | Same underlying Tenderly RPC, separate header not hash-pinned call, simulation not deployed DON, historical third-party transaction |
| Classic-track event provenance/AI eligibility | **UNRESOLVED — organizer/owner gate** | Detailed project-specific planning from 28 October predates kickoff; participation and permissible use are not certified by CI |
| Actual hacker dashboard partner selection/submission | **NOT YET VERIFIED** | Owner must select Chainlink (third partner) and confirm submission/AI disclosure in dashboard |

The owner-supplied Windows batch ran the CRE cases and Aftercheck consumption
successfully. Its later local `npm run verify` recorded **342 pass / 4 fail** on
missing Python in four ZIP-replay tests; those four failures were subsequently
repaired by [PR #40](https://github.com/denchik37/aftercheck/pull/40) and
validated with **10/10 Windows-specific tests** in actual Windows GitHub Actions.
The later CI success is a different source revision and is not misrepresented
as re-running CRE. The source-bound retained CRE results are unchanged.
The dated 6 November status below records **historical** missing-credential
conditions which the subsequent local login/simulation resolved.

**Official event time correction:** the current
[ETHGlobal submission guide](https://ethglobal.com/events/mumbai/info/details)
specifies **Sunday 8 November 2026 at 09:00 IST**, not the older 7 November
date in initial planning snapshots. This does not modify historic decisions
retroactively. The primary Uniswap/CROPS demo and final submission remain
separate acceptance gates.

---


## Browser verifier public HTTPS acceptance — 7 November 2026 IST

**PUBLIC ACCEPTANCE: PASS for merged source `f4fac3b8b7a3680aaef362c76de39e3d1df65fdd`.**
The existing production URL [aftercheck-g4nsb.ondigitalocean.app](https://aftercheck-g4nsb.ondigitalocean.app/)
served the reviewed HTML, all static modules, bundled genuine evidence, and the
saved-report fallback byte-for-byte. Independent
[GitHub production run 42280622631](https://github.com/denchik37/aftercheck/actions/runs/42280622631) checked out **the exact deployed
source** `f4fac3b8b7a3680aaef362c76de39e3d1df65fdd` from a clean tree, validated the deterministic browser build,
and passed **47 public HTTPS/source/browser checks**. Its **18 actual browser
exports** independently replayed through the CLI with identical JSON, Markdown,
policy and verdict bytes for PASS, VIOLATION, UNKNOWN and mixed requirements.
The [retained artifact](https://github.com/denchik37/aftercheck/actions/runs/42280622631/artifacts/13535895576) contains the full test report,
27 actual public screenshots, 18 downloaded ZIPs, and replay logs. ZIP SHA-256:
`34914b79cc985870ab6f5e726810fedb7eef9ae246859f28fbe809d134ff97ca`.

| Production acceptance | Result / evidence |
|---|---|
| Public root and assets | **PASS**; root 200, 14,476 bytes, SHA-256 `8035f9496fb064c9959365c8ec041bcb722a52f13f6a34266d50ae40036ecc5a`; all reviewed assets exactly matched the pinned checkout |
| HTTPS/TLS | **PASS**; HTTP redirect and ordinary certificate verification, TLS **1.3** on desktop 1280×900, mobile 390×844 and narrow 320×844 |
| Financial interaction | **PASS**; supported retained Sepolia case, exact readable amounts, responsive user-policy edits, independent execution and verdict, PASS → VIOLATION → reserve UNKNOWN |
| Export and local reproduction | **PASS**; 18 authentic public-browser ZIP exports with canonical offline CLI parity and exits 0/2/3 where applicable |
| Privacy and hostile inputs | **PASS**; zero local-evaluation network requests, zero page errors/dialogs, invalid and corrupt imports clear stale results |
| Visual review | **PASS**; 27 archived public screenshots, including desktop and mobile financial outcomes and export tab |
| Provider deployment ID / SHA | **UNVERIFIED in this access context**; the owner reported successful manual deployment and displayed `f4fac3b` prefix, but no new full provider deployment ID or provider-authenticated SHA was retrieved |
| Rollback availability | **UNVERIFIED**; historic deployment `a0318069-e0fd-4616-a3da-4c8d703feaf7` is the documented earlier candidate, but retention in the provider UI has not been rechecked |

The production acceptance was triggered by a **branch-scoped, CI-only test workflow**
at `verify/production-f4fac3` commit
`674015ef1ef2197826b4f5dd1313b31ad6767739`, because the connected GitHub
tools cannot dispatch `workflow_dispatch`. That workflow explicitly checked out
`f4fac3b8b7a3680aaef362c76de39e3d1df65fdd`; it made no changes to `main`, the live DigitalOcean app or its
production code. The standard `Production verifier` workflow remains available
for future authorized manual runs.

**Scope:** This is public-site and browser behavior acceptance against reviewed
source, not an attestation signed by DigitalOcean or proof of blockchain consensus,
token balances, original financial-mandate authorization or real-funds protection.
The next optional operator evidence is the new provider deployment ID, actual
displayed source and retention of the earlier rollback entry.

## Historical browser verifier implementation checkpoint — 6 November 2026

**Historical state at this 6 November checkpoint:** implementation and local
browser acceptance were complete, but the new verifier had not yet been deployed.
The later successful public acceptance is recorded above.
[Push Verify 42260012899](https://github.com/denchik37/aftercheck/actions/runs/42260012899)
and [PR Verify 42260023168](https://github.com/denchik37/aftercheck/actions/runs/42260023168)
both passed their test and browser jobs for feature source
`1b4729ef259e2c4641e21e1b77d4369c3def0ae6`.
[PR #34](https://github.com/denchik37/aftercheck/pull/34) records the current
integration state and checks for subsequent documentation or merge revisions.
The public root at
[aftercheck-g4nsb.ondigitalocean.app](https://aftercheck-g4nsb.ondigitalocean.app/)
still returns the previous 55,075-byte saved-report viewer, SHA-256
`8fc5fef9b8ea2e52cd9448e1b5d32efc4c41f2f6b8f395260957031d5dcd958a`.
That observation establishes public byte equality, not a newly authenticated
provider deployment identity.

Work began from actual `main`
`ee572a8b6558751c56e7b2eeaf0a0d1b283c9f6c`, whose
[Verify run 42248352228](https://github.com/denchik37/aftercheck/actions/runs/42248352228)
was green, on branch `feature/browser-financial-verifier`. The focused browser
enhancement preserves the existing optional integration and the previous viewer.
The reviewed JavaScript build source digest at `1b4729e` is
`e10bd20375263954c51712e46c807414f1170bc7002fcb37437e8e5ab85704f0`.
The publication inventory is **21 files / 382,709 bytes**, including **13 generated
assets / 104,465 bytes**. The local verification log is
`output/browser-implementation/full-verify.log`; the completed CI evidence is
retained in the runs above. Downloaded browser artifact
[`browser-42260012899-1`](https://github.com/denchik37/aftercheck/actions/runs/42260012899/artifacts/13525285490)
has SHA-256
`835a5da6a585d04402eb2230798a368a55ac591bfa9c18709388016e1bcc6eaf`.
Its result files name the tested source, source digest and Chromium
**151.0.7922.34**; the workspace contains **27 screenshots** across 1280×900,
390×844 and 320×844. The refreshed PASS, pure VIOLATION, reserve UNKNOWN, mixed
checks, custom-precision and export views were visually reviewed and accepted.

The first complete checkpoint was
`54c861b33c507e8dc3522cc84186a7cd8c62a83d`, with successful
[push Verify 42259275673](https://github.com/denchik37/aftercheck/actions/runs/42259275673)
and [PR Verify 42259407155](https://github.com/denchik37/aftercheck/actions/runs/42259407155).
It recorded **343 Node tests, 40 parity cases, 46 workspace checks, 18 actual
ZIP/CLI replays, 75 fallback-viewer cases and 44 local HTTP checks including 36
browser checks**. Inspection of its **24 workspace screenshots** found 320px
unit-label overlap, retained-amount wrapping and clipped precision text. The
correction in `1b4729e` passed the refreshed checks below and added Export-tab
captures. The first run remains a separate checkpoint; its screenshots are not
presented as validation of the correction.

| Feature / requirement | Actual implementation or executed evidence | Source / evidence | Remaining work or limit |
|---|---|---|---|
| Full Node verification | `npm run verify`: TypeScript, deterministic build check and **343/343 Node tests passed**, zero failures | Verify `42260012899` and `42260023168`; source `1b4729e`; [build manifest](../web/assets/browser-build.json) | Later revisions must retain mandatory green checks; PR #34 is the current record |
| Shared browser verifier | **40 complete Chromium/Node parity cases passed** for native Web Crypto, reports, Markdown and rejection behavior; the portable core calls the same Uniswap verifier as Node | `browser-core-results.json` in the linked artifact; source `1b4729e` | Receipt/RPC assumptions and reserve UNKNOWN remain |
| Exact readable financial input | **9 focused amount tests passed**, including all 256 supported precisions, uint256 bounds, one-unit comparisons and malformed forms; included in the full 343-test pass | `src/amounts.ts`, `test/amounts.test.mjs`; CI at `1b4729e` | Raw policies remain canonical; user-entered decimals remain explicitly unverified |
| Historical token precision | **5 metadata tests passed**; both complete 4,380-byte runtimes independently compiled and matched, with no warnings | [Source, compiler and runtime manifest](evidence/token-precision/manifest.json), [executed recompilation](evidence/token-precision/recompilation-result.json), `7c3a93f` | Bound only to the exact retained capture; source/RPC trust is not consensus proof |
| Reproducible browser export | **10 focused export tests passed**, including four independently extracted package/CLI comparisons with exits **0/2/2/3**. Actual Chromium downloaded **18 ZIPs** across three viewports and reproduced their complete JSON/Markdown/policy with the offline CLI | `test/browser-export.test.mjs`, `workspace-results.json` and replay logs in the linked artifact; source `1b4729e` | Replay establishes agreement with retained evidence and supplied policy; the Node network guard is not an OS sandbox |
| Transaction-first workspace | **46 workspace checks passed**: retained lookup/import, policy edits, precision controls, stale-result handling, keyboard behavior, exports and recovery; **27 screenshots** retained and refreshed views visually reviewed | [Browser feature contract](BROWSER_VERIFIER.md), workspace artifact; source `1b4729e` | Tested Chromium and viewport set; public delivery remains to be exercised |
| Saved-report fallback | **75 viewer cases passed**; separate local HTTP suite passed **44 checks including 36 browser checks**; original viewer SHA-256 preserved | `browser-results.json`, `hosted-results.json`; source `1b4729e` | Local HTTP does not establish production TLS or provider identity |
| Static publication integrity | Explicit **21 files / 382,709 bytes**; generated JS/manifest **13 assets / 104,465 bytes**. Exact allowlist, hashes, bounds and reproducibility checks passed | `scripts/build-browser.mjs`, `test/deployment.test.mjs`, linked CI and [manifest](../web/assets/browser-build.json) | Deployed byte comparison pending |
| Privacy/security regression | Core/workspace checks passed with networking disabled after same-origin bootstrap; **zero local evaluation requests, page errors or dialogs**; storage and unexpected-request assertions passed | `browser-core-results.json`, `workspace-results.json`; source `1b4729e` | Browser/device/source compromise remains outside scope |
| GitHub integration | Dedicated branch and focused increments; both mandatory test/browser jobs succeeded at the accepted implementation checkpoint | [PR #34](https://github.com/denchik37/aftercheck/pull/34), push/PR runs above, `.github/workflows/ci.yml` | The PR is authoritative for later head, check and merge state; every new revision must satisfy required CI |
| Public release | Existing static website remains available with the prior saved-report viewer | [Historical production run 42234449518](https://github.com/denchik37/aftercheck/actions/runs/42234449518); unchanged root bytes observed in this session | New verifier not live; authenticated provider access unavailable |
| Rollback and cost | Prior recorded deployment `a0318069-e0fd-4616-a3da-4c8d703feaf7` / source `d5414cb…`; existing static-only configuration and manual deployment retained | [Deployment record](DIGITALOCEAN_DEPLOYMENT.md) | Current provider state, retained rollback availability and account estimate not reauthenticated; no rollback executed |

### Original predeployment steps (historical; superseded by the 7 November public acceptance)

The implementation checkpoint has completed mandatory CI and visual review.
Any later documentation or integration revision must pass the required checks
recorded on [PR #34](https://github.com/denchik37/aftercheck/pull/34); its final
source and merge identity must be read from that record. Production additionally
requires authenticated access to the existing dedicated DigitalOcean application:
the connected Browser tool did not have the originating browser context, and the
cloud dashboard attempt returned **Site Unavailable**. No new provider deployment
was created or authenticated in this session.

After access is restored, record the active deployment/source and available
rollback target, manually deploy the reviewed revision without enabling automatic
deployment or adding paid components, inspect provider logs, and run the
`Production verifier` HTTPS workflow against that exact SHA. Record the resulting
deployment ID and public test artifacts only after observing them. Public byte
matching alone cannot identify a provider deployment.

The following sections preserve earlier implementation and deployment checkpoints.
Their dates, source revisions and test counts apply to those historical releases.

## Current audited status — 6 November 2026

**Optional CRE: implemented and demonstrable; official execution qualification remains incomplete because account authentication is unavailable.** The owner superseded the internal deadline stop rule. The full evidence and CRE01–CRE05 matrix are in the [CRE delivery record](evidence/cre/README.md); commands and trust boundaries are in [CRE_INTEGRATION.md](CRE_INTEGRATION.md).

| Feature / requirement | Actual test or execution | Source revision | Remaining risk |
|---|---|---|---|
| Core verifier and optional consumer regression | [Verify 42244604886](https://github.com/denchik37/aftercheck/actions/runs/42244604886): TypeScript, **272/272 Node tests**, zero failures | `f7e4048389d3acf85d7c16020b34990c03fde93f` | Narrow receipt/RPC assumptions remain |
| Offline core demo | Same run: PASS / VIOLATION / UNKNOWN, exits 0 / 2 / 3 | `f7e4048…` | Third-party historical testnet observations and retrospective policies |
| Offline inspector and local HTTP delivery | Same completed run: **75/75 browser cases**, no requests/errors/dialogs; **44/44 local HTTP checks**, including 36 browser checks | `f7e4048…` | Saved-report display, not consensus authentication |
| Optional official SDK workflow | [CRE 42244604852](https://github.com/denchik37/aftercheck/actions/runs/42244604852): actual WASM build passed with isolated SDK 1.23.0; local [build log/hash](evidence/cre/build/build.json) also retained | CI `f7e4048389d3acf85d7c16020b34990c03fde93f`; local build `ec92456…` | Compilation does not establish capability execution |
| Real public HTTP + historical RPC comparison | [MATCH](evidence/cre/rpc-reference/execution.json), [intentional MISMATCH](evidence/cre/rpc-intentional-mismatch/execution.json), [actual HTTP-404 UNAVAILABLE](evidence/cre/rpc-unavailable/execution.json); correct chain/block/hash; no RPC after missing manifest | `f7e4048…` | Explicit **RPC_REHEARSAL**, same Tenderly provider, number-bound read plus separate header |
| Actual application consumption | [Five retained consumer runs](evidence/cre/consumption.json); core JSON **and Markdown** byte-identical to PASS / VIOLATION / UNKNOWN demo outputs | `f7e4048…` | Imported execution metadata is self-reported; no DON attestation |
| Presentation replay | `npm run cre:demo` revalidates five retained cases with networking disabled and explicit intentional-mismatch/RPC_REHEARSAL labels | Presentation commit carries its own CI log | Offline replay is not a fresh observation or official simulation |
| Official CRE execution | [Actual CLI attempt](evidence/cre/official-reference/execution.json): CLI 1.39.0, SDK 1.23.0, Bun 1.4.4; exit 1, **CRE_AUTHENTICATION_UNAVAILABLE**. Optional CI also records BLOCKED and skips simulator execution | Actual attempt `ec92456…`; current optional CI `f7e4048…` | Owner must authenticate, then actual simulator runs may reveal runtime issues |

The transport correction in `f7e4048` followed two preserved eight-second header timeouts. It changes only the optional Node rehearsal's bounded timeout, and its fresh live runs establish the three results above. [Verify 42244604886](https://github.com/denchik37/aftercheck/actions/runs/42244604886) passed the correction's complete regression and browser checks; both job logs were inspected. Later commits and final merge require their own CI, recorded in the delivery PR rather than relabelling older runs.

Remaining CRE work is narrowly defined: authenticated official reference, negative and unavailable simulations; consume those outputs; update the sponsor matrix and presentation from their actual logs. Existing Uniswap and offline CROPS demonstrations remain independent. No new infrastructure, signing, contract deployment, financial transaction or external partner selection was performed.

### Preserved core and hosting baseline before CRE implementation

Initial audit source: **`4130c2af7e6b096b8394f423f7e56ecc75da87ab`**, current `main`
when the logs below were inspected. The subsequent deployment-documentation merge
`e8c36203c2d8f096d46dac2980b6cd14c408b18e` supplies the separate authenticated
provider record preserved later in this document. These are pinned checkpoints;
a later documentation revision needs its own CI result.

| Feature / requirement | Actual executed evidence | Source revision | Remaining risk |
|---|---|---|---|
| Core verifier and deterministic regression | [Verify 42234382492](https://github.com/denchik37/aftercheck/actions/runs/42234382492): TypeScript check; **197/197 Node tests**, zero failures | `4130c2a` | Receipt/RPC assumptions and reserve UNKNOWN remain |
| Offline CLI demonstration | Same run: PASS / VIOLATION / UNKNOWN with exits **0 / 2 / 3**; retained public-report consistency check passed | `4130c2a` | Historical third-party testnet evidence and retrospective policies |
| Offline inspector | Same run: **75/75 browser cases**, zero requests, page errors or dialogs | `4130c2a` | Saved-report display; no refreshed chain authentication |
| Local HTTP delivery and privacy | Same run: **44/44 checks**, including **36 browser checks** | `4130c2a` | Local mode alone does not establish public hosting |
| Public HTTPS viewer | [Production run 42234449518](https://github.com/denchik37/aftercheck/actions/runs/42234449518): **45/45 checks**, including **36 browser checks**, against [the public viewer](https://aftercheck-g4nsb.ondigitalocean.app/) | Expected clean checkout **`d5414cb43c6d31cc66afd070d14dca4ab9921a75`**; workflow run HEAD `4130c2a` | Public bytes alone do not authenticate provider identity; the separate operator record appears below |
| Optional Chainlink CRE at this historical audit | Not implemented in that old source; subsequent implementation is recorded above | Audited tree `4130c2a` | The internal stop rule was subsequently superseded; see [CRE_DECISION.md](CRE_DECISION.md) |

Both Verify job logs and the production job log were inspected. The production
harness deliberately leaves `deploymentIdentityVerified` false. Its expected
source is distinct from the revision hosting the workflow. The inspected public
web assets are identical between these two revisions; this does not identify a
provider deployment. The later operator record supplies its own provider and
screenshot observations; this log audit did not repeat those UI inspections.

At that audit, both public event guides stated **7 November 2026, 09:00 IST**.
The owner subsequently superseded the internal CRE D−14h stop rule. This changes
the engineering scope, not the external deadline. Core/browser success does not
establish a successful official CRE simulation.

## Historical implementation checkpoint — 5 November 2026

**5 November 2026 · functional implementation merged through PR #7, main `8bfedc72f5f03d64a003ed27fd1a41768e880bd8`.** The passing PR #7 workflow below tested merge revision `40ee01b30505ba8163c7e18011b2a8cb5e4878b3` for head `678cf4344d22af89f0d1114d97bd3c62500b2784`. This is a pinned engineering checkpoint, not a claim of production readiness.

The narrow vertical slice is implemented and verified: real historical Sepolia receipt → independent protocol observations → exact receipt amounts → retrospective policy → portable reports → offline CLI replay → browser inspection. TypeScript checking, **109 unit/integration tests**, the three committed demo outcomes, and **28 browser cases using the real capture** passed. Reserve state, arbitrary token balance semantics, consensus and finality remain outside the claim.

## Source and CI evidence

These workflow logs were inspected, including their source revision and test summaries:

| Change | Implementation commit | Main merge | Executed verification |
|---|---|---|---|
| [PR #1 — receipt collection](https://github.com/denchik37/aftercheck/pull/1) | [`9d8fca3`](https://github.com/denchik37/aftercheck/commit/9d8fca39f635ed65f0460ad9a21a23631bbe5819) | [`3e2d6f6`](https://github.com/denchik37/aftercheck/commit/3e2d6f6773e0040922cdefa5885ed8dab5bede89) | [36 passed, 0 failed](https://github.com/denchik37/aftercheck/actions/runs/42063290460) |
| [PR #2 — Uniswap receipt profile](https://github.com/denchik37/aftercheck/pull/2) | [`5ba457c`](https://github.com/denchik37/aftercheck/commit/5ba457c12b72f92e3d659b037e556ebc178fbc25) | [`05a3c80`](https://github.com/denchik37/aftercheck/commit/05a3c8098c18e0f1112d46978c328c8e5fe4ff73) | [75 passed, 0 failed](https://github.com/denchik37/aftercheck/actions/runs/42064720649) |
| [PR #3 — portable replay and output](https://github.com/denchik37/aftercheck/pull/3) | [`b49b395`](https://github.com/denchik37/aftercheck/commit/b49b395b6a4df22363fd209efb3324734334a522) | [`593939c`](https://github.com/denchik37/aftercheck/commit/593939c81337c297cc1ef4b8d2fd35269d2cea19) | [`tsc --noEmit`; 92 passed, 0 failed](https://github.com/denchik37/aftercheck/actions/runs/42066109522) |
| [PR #4 — local inspector](https://github.com/denchik37/aftercheck/pull/4) | [`868f122`](https://github.com/denchik37/aftercheck/commit/868f12211427fdebc3b6844a045a275203d9df23) | [`dc9ee97`](https://github.com/denchik37/aftercheck/commit/dc9ee971888748d6b2b37e7d1085ca92cd05a7de) | [Typecheck; 102 unit/integration tests; 28 browser cases passed](https://github.com/denchik37/aftercheck/actions/runs/42066862898), tested PR merge `f34329b5f4dd1c8fcb25bf44bc18a71e249ab7b2` |
| [PR #5 — independent capture attempts](https://github.com/denchik37/aftercheck/pull/5) | [`d60bc0b`](https://github.com/denchik37/aftercheck/commit/d60bc0b242f8678653557da7e9f8f68bcd4890a5) | [`b8181d9`](https://github.com/denchik37/aftercheck/commit/b8181d96ea502fe05f2f938cf05815feaa0b1bc4) | [Typecheck; 102 unit/integration tests; 28 browser cases passed at this exact main revision](https://github.com/denchik37/aftercheck/actions/runs/42067676571) |
| [PR #6 — documented keyless archive endpoint](https://github.com/denchik37/aftercheck/pull/6) | [`e0e8c1f`](https://github.com/denchik37/aftercheck/commit/e0e8c1f46cb4cfda6be8fe0b9aad6c2ee8229d6e) | [`14b9ca2`](https://github.com/denchik37/aftercheck/commit/14b9ca2d9934146300046656d283d88c788a5bc6) | [Typecheck; 102 tests; both CI jobs passed](https://github.com/denchik37/aftercheck/actions/runs/42068090708); subsequent real capture below |
| [PR #7 — retained real case and offline demo](https://github.com/denchik37/aftercheck/pull/7) | [`678cf43`](https://github.com/denchik37/aftercheck/commit/678cf4344d22af89f0d1114d97bd3c62500b2784) | [`8bfedc7`](https://github.com/denchik37/aftercheck/commit/8bfedc72f5f03d64a003ed27fd1a41768e880bd8) | [Typecheck; 109 tests; three CLI demo outcomes; 28 real-case browser checks passed](https://github.com/denchik37/aftercheck/actions/runs/42069380806) |

Counts are cumulative at those specific revisions, not counts of independently authenticated chain observations. Verification artifacts retain logs, Node version, and source revision; browser artifacts retain results and screenshots. The browser runs have 14 desktop and 14 mobile cases, with zero attempted network requests, page errors, or dialogs.

After merging PR #7, [main run 42069896692](https://github.com/denchik37/aftercheck/actions/runs/42069896692) repeated the same gates at exact revision `8bfedc72f5f03d64a003ed27fd1a41768e880bd8`: TypeScript check, 109 tests, all three demo policies, and 28 browser cases passed. Both job logs were inspected.

The initial browser-workflow revision [failed Actions validation](https://github.com/denchik37/aftercheck/actions/runs/42066618986). Its environment-context configuration was corrected in `868f122` before the passing PR run and merge; that failure is not counted as a passing test run.

The local environment also rejected public RPC POST requests with HTTP 403 and could not launch Chromium because socket creation was denied. Those local attempts established no protocol result or browser pass. The authorized GitHub Actions environment performed the actual public capture and disposable browser tests. The browser harness uses offline `about:blank`, with no persistent profile; direct `file://` navigation remains unverified.

## Feature matrix

| Feature | Achieved behavior | Actual test reference | Source checkpoint | Remaining boundary |
|---|---|---|---|---|
| Exact policy amounts | Canonical decimal strings, `bigint` comparisons, strict policy keys, separate result dimensions | [`values.test.mjs`](../test/values.test.mjs), [`evaluate.test.mjs`](../test/evaluate.test.mjs) | PR #2 | Policy is supplied retrospectively, not authenticated original intent |
| RPC receipt collection | Read-only method allowlist; time, byte and request budgets; sanitized errors; transaction/receipt/block/log consistency | [`rpc.test.mjs`](../test/rpc.test.mjs), [`evidence.test.mjs`](../test/evidence.test.mjs) | PR #3 | Provider answers remain trusted observations |
| One-command inspection | Parse/validate policy before RPC; single-source receipt and hash-bound reads; immediate scoped verdict; four-file atomic export and exit 0/2/3 | [`inspect.test.mjs`](../test/inspect.test.mjs), [`inspect-cli.test.mjs`](../test/inspect-cli.test.mjs), [live smoke](https://github.com/denchik37/aftercheck/actions/runs/42092888204) | PR #11, #12, #13 | One supported route and trusted provider observations; reserve remains UNKNOWN |
| Router decoder | Pinned Sepolia Router02; strict seven-field `exactInputSingle`; unsupported routes rejected | [`uniswap.test.mjs`](../test/uniswap.test.mjs) | PR #2 | One router, network and bounded call profile |
| Pool binding | Hash-bound code and factory/pool metadata observations; no latest-state fallback | [`uniswap.test.mjs`](../test/uniswap.test.mjs), [`collect.test.mjs`](../test/collect.test.mjs) | PR #3 | Historical EIP-1898 availability depends on the selected RPC |
| Transfer reconciliation | Exactly supported Transfer/Swap edges, signed quantities, participants and callback order; contradictory state reads rejected | [`uniswap.test.mjs`](../test/uniswap.test.mjs) | PR #2 | Event amounts under explicit token assumptions; no token-balance or AMM execution proof |
| Financial verdict | Owner, recipient, token pair, input cap and minimum emitted output; known violation survives an unknown reserve check | [`uniswap.test.mjs`](../test/uniswap.test.mjs), [`replay.test.mjs`](../test/replay.test.mjs) | PR #3 | Reserve balance intentionally remains UNKNOWN |
| Evidence integrity | Canonical serialization, separate policy/evidence digests, duplicate/unsafe key rejection, tamper detection | [`json.test.mjs`](../test/json.test.mjs), [`evidence.test.mjs`](../test/evidence.test.mjs), [`replay.test.mjs`](../test/replay.test.mjs) | PR #3 | A digest establishes integrity, not authenticity |
| Offline replay and reports | Deterministic JSON/Markdown output; replay with fetch, sockets, HTTP requests and DNS lookup disabled; exit codes exercised | [`replay.test.mjs`](../test/replay.test.mjs), [`cli.test.mjs`](../test/cli.test.mjs) | PR #3 | Replay does not refresh canonicality or finality |
| Coherent output publication | Whole managed output set staged before replacement; rollback on publication failure; new collection removes stale reports | [`output.test.mjs`](../test/output.test.mjs) | PR #3 | If external filesystem changes prevent rollback, the previous set is retained in a recovery backup |
| Real protocol example | Unchanged complete Tenderly capture, literal independent expectations, actual offline CLI PASS/VIOLATION/UNKNOWN; separate genuine partial capture stays UNKNOWN | [`real-case.test.mjs`](../test/real-case.test.mjs), [example provenance](../examples/sepolia/README.md), [capture run](https://github.com/denchik37/aftercheck/actions/runs/42068312090) | PR #7 | One third-party historical testnet swap; provider trust and token assumptions remain |
| One-command demo | `npm run demo` checks the same evidence digest and three policy outcomes, with common network entry points disabled | [CLI demo log](https://github.com/denchik37/aftercheck/actions/runs/42069380806), [`scripts/demo.mjs`](../scripts/demo.mjs) | PR #7 | Rehearsal guard is not an OS network sandbox |
| Browser inspector | Local report import/paste, separate statuses, exact quantities, raw-report download; malformed input clears stale results; hostile markup stays inert | [`inspector.test.mjs`](../test/inspector.test.mjs), [`test-inspector.py`](../scripts/test-inspector.py), [real-case browser artifact](https://github.com/denchik37/aftercheck/actions/runs/42069380806/artifacts/13435176898) | PR #4, real-case verification PR #7 | Saved-report display only; no independent chain authentication or verdict recomputation |

## One-command real-provider inspection

At source revision [`53dc14a`](https://github.com/denchik37/aftercheck/commit/53dc14ade58ce5faa9edee5e072fc5b202e2ce8f), the optional [read-only smoke run 42092888204](https://github.com/denchik37/aftercheck/actions/runs/42092888204) collected the existing February 2025 Sepolia transaction through a keyless public RPC provider, evaluated `examples/sepolia/policy-pass.json`, and saved `evidence.json`, `policy.json`, `report.json` and `report.md`. Its CLI produced `SUCCEEDED / SUPPORTED / COMPLETE / PASS` (exit `0`); an independent offline replay check matched the saved results and exact previously recorded raw-unit amounts. [Retained output artifact](https://github.com/denchik37/aftercheck/actions/runs/42092888204/artifacts/13445793682). This is a fresh **read-only observation of an old transaction**, not a new swap, consensus proof or account-balance reconstruction.

The [main workflow at the same revision](https://github.com/denchik37/aftercheck/actions/runs/42092864091) passed TypeScript checking, 117 tests, the three committed offline demo outcomes, the retained public-case output checker and 28 browser cases. Live RPC testing remains separate from deterministic CI so an unreliable provider cannot block source verification.

## Complete historical case

[Capture run 42068312090](https://github.com/denchik37/aftercheck/actions/runs/42068312090), source `14b9ca2d9934146300046656d283d88c788a5bc6`, made 19 read-only requests to the documented keyless Tenderly Sepolia endpoint. The primary attempt retained the receipt and all 12 required historical state observations. Its evidence digest is `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093`.

The transaction is a third-party swap from **12 February 2025**, observed on **5 November 2026**, not a newly executed Aftercheck swap. Exact source, file hashes, transaction/block/pool/token identities and raw quantities are in [the example README](../examples/sepolia/README.md). Literal expected calldata and receipt values were recorded from the explorer before the successful RPC capture; the tests compare those values independently of the adapter's output. A complete bundle does not establish consensus or arbitrary token balance semantics.

| Committed demo policy | Execution | Support | Evidence | Policy verdict / CLI exit |
|---|---|---|---|---|
| Base input cap and output minimum | SUCCEEDED | SUPPORTED | COMPLETE | PASS / 0 |
| Input cap lowered to `900000000000000000` | SUCCEEDED | SUPPORTED | COMPLETE | VIOLATION / 2 |
| Base policy plus reserve floor `1` | SUCCEEDED | SUPPORTED | PARTIAL | UNKNOWN / 3 |

The browser suite uses the same authentic evidence with a stricter output minimum for VIOLATION and reserve floor `0` for UNKNOWN; the separate CLI suite and demo test the committed policies above. Its 14 desktop and 14 mobile checks passed with zero attempted requests, page errors or dialogs. Four screenshots were visually reviewed. Browser artifact ZIP SHA-256: `4dd2a039784abef2fcfe4fb08727158edf3f660e425297a1a66da9e6c85e890c`.

## Preserved real-capture limitations

Both runs inspect existing third-party Sepolia transactions; no project wallet transaction was sent. The first candidate is `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`; the second is `0xbc9d8049ad3e9b0ed9f18700110017c45df3643acfd9500c5d7a027d01b17ea0`.

| Recorded attempt | Actual observation | Consequence |
|---|---|---|
| [Initial capture, PR #3](https://github.com/denchik37/aftercheck/actions/runs/42066113089), first candidate | Transaction and block present; receipt null; no state observations | Incomplete evidence; UNKNOWN |
| [Capture matrix, PR #5](https://github.com/denchik37/aftercheck/actions/runs/42067676503), PublicNode, first candidate | SUCCEEDED receipt; transaction/receipt/block identity complete; seven initial protocol reads all return `RPC_REMOTE_ERROR` | Pool binding is not established; UNKNOWN |
| Same matrix, PublicNode, second candidate | Receipt missing | Incomplete evidence; UNKNOWN |
| Same matrix, dRPC, both candidates | Initial chain-ID request fails | CAPTURE_FAILED; no evidence bundle or policy verdict produced |

The retained Publicnode partial bundle's digest is `0xeb791a7eedbdb9362943d9f939ac9649c29f4d490e08ec1bfdd067c4b78a8e8f`. Its source revision is `b8181d96ea502fe05f2f938cf05815feaa0b1bc4`; it is committed separately in the example. Fields from separate providers were not combined.

The retained partial bundles remain UNKNOWN after the complete Tenderly capture; failed capture attempts produced no policy verdict. A successful workflow status establishes that the job completed and retained observations, not a financial PASS. The recorded sanitized RPC errors do not establish why the provider rejected those reads.

## Reproduce locally

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
```

Open `web/inspector.html` locally and import `output/demo/pass/report.json`, `output/demo/violation/report.json` or `output/demo/reserve/report.json`. The primary CI repeats verification and demo, records its checked commit, and retains the generated reports. The separate optional capture workflow is not a dependency of deterministic tests.

See [PROTOCOL.md](PROTOCOL.md) for the exact implemented claim boundary. This prototype is not audited and does not establish safety for real funds.

## DigitalOcean viewer deployment — Issue 19

**6 November 2026 (IST): COMPLETE.** The dedicated static viewer is live at
[`https://aftercheck-g4nsb.ondigitalocean.app/`](https://aftercheck-g4nsb.ondigitalocean.app/).
The production app, provider deployment, public bytes, TLS/HTTP behavior and all
browser outcomes were inspected. Issue #19 closes with this evidence record.

### Release identity

| Record | Verified value |
|---|---|
| Project | `Aftercheck` (`d350d2ff-22f5-4f1c-84f4-ccc14555e7a7`) |
| Static app | `aftercheck` (`2fb584c9-e7fc-4ab9-8565-8c2d84da13c2`) |
| Live deployment | `a0318069-e0fd-4616-a3da-4c8d703feaf7`, Healthy, region `blr1`, Global CDN |
| Tested release source | [`d5414cb43c6d31cc66afd070d14dca4ab9921a75`](https://github.com/denchik37/aftercheck/commit/d5414cb43c6d31cc66afd070d14dca4ab9921a75) |
| Public verification | [Workflow run 42234449518](https://github.com/denchik37/aftercheck/actions/runs/42234449518), artifact `13509454311` |
| Displayed estimate | **$0.00/month**; static-site-only free allowance shown by the account |

The dashboard's deployment screen did not expose the source Git SHA. The release
record therefore combines the authenticated app/deployment identity, the reviewed
source used for launch, and byte-for-byte equality between production assets and a
clean checkout at `d5414cb`. It is not represented as a provider-signed Git
attestation. Automatic deployment remains disabled, so subsequent documentation
commits do not change the live app.

### Executed acceptance matrix

| Requirement | Actual result | Evidence / remaining boundary |
|---|---|---|
| Pre-deploy regression | PR #28 and post-merge CI passed; **197/197 Node tests** and the hosted local gate passed before launch | [PR #28](https://github.com/denchik37/aftercheck/pull/28); receipt/provider trust boundaries are unchanged |
| Production root and source | 200, 55,075 bytes, exact SHA-256 `8fc5fef9b8ea2e52cd9448e1b5d32efc4c41f2f6b8f395260957031d5dcd958a` | Production run; matching bytes cannot distinguish commits with identical web assets |
| Public samples | All four JSON files matched the clean release checkout and fresh offline outputs | PASS, two distinct VIOLATION reports and reserve UNKNOWN retained |
| TLS and redirect | HTTP→HTTPS 301; default certificate/hostname validation; TLS 1.3 in all three browser contexts | Assigned `.ondigitalocean.app` hostname; no custom domain or DNS change |
| Browser behavior | **36/36 browser checks** across 1280×900, 390×844 and 320×740; 18 screenshots visually inspected | No post-load/import requests, page errors or dialogs |
| Exposure boundary | Nine unintended repository/API paths returned true 404s | Provider also generated its default `404.html`; it is not an application route |
| Provider scope | One Static Site; no service, worker, database, environment variable, secret or upload endpoint | Hosting/CDN still observes ordinary request metadata |
| Recovery | Manual promotion and rollback procedure documented; first deployment retained as future recovery candidate | Rollback not exercised because there is no earlier verified production target |

The production workflow reported **`PUBLIC_HTTPS: PASS — 45 checks (36 browser
checks)`** from a clean checkout at exactly `d5414cb`; `workingTreeHasChanges` was
false. The artifact ZIP SHA-256 is
`2df466e0e09d16670ebf866e117285e8f2d04e394a43d05aefd7cabc8ad777fe`.
Runtime versions were Python **3.14.4**, Playwright **1.62.0** and Chromium
**151.0.7922.34**. Artifact retention is controlled by the workflow; preserve a
release copy before expiry if it is needed beyond that period.

The local production attempt separately passed source and HTTP checks but Chromium
startup failed with `socket() failed: Operation not permitted`; it recorded **FAIL
with zero browser checks**, not a pass. GitHub Actions supplied the authoritative
production browser execution. Earlier launch-template validation also preserved the
provider's rejected-field error before [PR #28](https://github.com/denchik37/aftercheck/pull/28)
fixed the generic-Git dialect.

The release work was delivered in focused increments: [PR #25](https://github.com/denchik37/aftercheck/pull/25)
added the static publication boundary and harness; [PR #27](https://github.com/denchik37/aftercheck/pull/27)
added the launch wrapper and parity test; [PR #28](https://github.com/denchik37/aftercheck/pull/28)
fixed provider compatibility; [PR #29](https://github.com/denchik37/aftercheck/pull/29)
added the pinned production workflow; and [PR #30](https://github.com/denchik37/aftercheck/pull/30)
kept its checkout clean before verification. The first production workflow failure
was preserved: it created its source-record file too early and correctly tripped the
clean-tree guard. Run `42234449518` is the passing replacement.

No unrelated infrastructure was changed. The viewer remains a local saved-report
inspector: PASS is receipt-scoped, reserve UNKNOWN remains unresolved, and successful
execution can coexist with a policy VIOLATION. It does not authenticate original
intent, establish full wallet state or consensus/finality, and is not audited or a
fund-protection service. See the [deployment runbook](DIGITALOCEAN_DEPLOYMENT.md)
for exact provider records, cache observations, limitations and release procedure.
