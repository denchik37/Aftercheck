# Readiness checkpoint

**5 November 2026 · functional implementation merged through PR #7, main `8bfedc72f5f03d64a003ed27fd1a41768e880bd8`.** The passing PR #7 workflow below tested merge revision `40ee01b30505ba8163c7e18011b2a8cb5e4878b3` for head `678cf4344d22af89f0d1114d97bd3c62500b2784`. This is a pinned engineering checkpoint, not a claim of event acceptance or completed submission.

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
| Router decoder | Pinned Sepolia Router02; strict seven-field `exactInputSingle`; unsupported routes rejected | [`uniswap.test.mjs`](../test/uniswap.test.mjs) | PR #2 | One router, network and bounded call profile |
| Pool binding | Hash-bound code and factory/pool metadata observations; no latest-state fallback | [`uniswap.test.mjs`](../test/uniswap.test.mjs), [`collect.test.mjs`](../test/collect.test.mjs) | PR #3 | Historical EIP-1898 availability depends on the selected RPC |
| Transfer reconciliation | Exactly supported Transfer/Swap edges, signed quantities, participants and callback order; contradictory state reads rejected | [`uniswap.test.mjs`](../test/uniswap.test.mjs) | PR #2 | Event amounts under explicit token assumptions; no token-balance or AMM execution proof |
| Financial verdict | Owner, recipient, token pair, input cap and minimum emitted output; known violation survives an unknown reserve check | [`uniswap.test.mjs`](../test/uniswap.test.mjs), [`replay.test.mjs`](../test/replay.test.mjs) | PR #3 | Reserve balance intentionally remains UNKNOWN |
| Evidence integrity | Canonical serialization, separate policy/evidence digests, duplicate/unsafe key rejection, tamper detection | [`json.test.mjs`](../test/json.test.mjs), [`evidence.test.mjs`](../test/evidence.test.mjs), [`replay.test.mjs`](../test/replay.test.mjs) | PR #3 | A digest establishes integrity, not authenticity |
| Offline replay and reports | Deterministic JSON/Markdown output; replay with fetch, sockets, HTTP requests and DNS lookup disabled; exit codes exercised | [`replay.test.mjs`](../test/replay.test.mjs), [`cli.test.mjs`](../test/cli.test.mjs) | PR #3 | Replay does not refresh canonicality or finality |
| Coherent output publication | Whole managed output set staged before replacement; rollback on publication failure; new collection removes stale reports | [`output.test.mjs`](../test/output.test.mjs) | PR #3 | If external filesystem changes prevent rollback, the previous set is retained in a recovery backup |
| Real protocol example | Unchanged complete Tenderly capture, literal independent expectations, actual offline CLI PASS/VIOLATION/UNKNOWN; separate genuine partial capture stays UNKNOWN | [`real-case.test.mjs`](../test/real-case.test.mjs), [example provenance](../examples/sepolia/README.md), [capture run](https://github.com/denchik37/aftercheck/actions/runs/42068312090) | PR #7 | One third-party historical testnet swap; provider trust and token assumptions remain |
| One-command demo | `npm run demo` checks the same evidence digest and three policy outcomes, with common network entry points disabled | [CLI demo log](https://github.com/denchik37/aftercheck/actions/runs/42069380806), [`scripts/demo.mjs`](../scripts/demo.mjs) | PR #7 | Rehearsal guard is not an OS network sandbox; owner records the dependency-loss video |
| Browser inspector | Local report import/paste, separate statuses, exact quantities, raw-report download; malformed input clears stale results; hostile markup stays inert | [`inspector.test.mjs`](../test/inspector.test.mjs), [`test-inspector.py`](../scripts/test-inspector.py), [real-case browser artifact](https://github.com/denchik37/aftercheck/actions/runs/42069380806/artifacts/13435176898) | PR #4, real-case verification PR #7 | Saved-report display only; no independent chain authentication or verdict recomputation |
| Submission materials | README/integration anchors, MIT license, feedback, AI attribution, project copy and human-video script prepared | [`SUBMISSION.md`](SUBMISSION.md), [`FEEDBACK.md`](../FEEDBACK.md), [`AI_USAGE.md`](../AI_USAGE.md) | Delivery documentation after PR #7 | Required input disclosure, qualification, video, feedback form and final submission remain owner actions |

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

## Reproduce and finish delivery

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
```

Open `web/inspector.html` locally and import `output/demo/pass/report.json`, `output/demo/violation/report.json` or `output/demo/reserve/report.json`. The primary CI repeats verification and demo, records its checked commit, and retains the generated reports. The separate optional capture workflow is not a dependency of deterministic tests.

The next owner checkpoint is an organizer determination about the **28 October 2026 project-specific planning inputs**, the required development-input disclosure and actual human contributions under the selected Classic rules. No eligibility approval is recorded. Then record the supplied 2:45 human-narrated demonstration, submit the Uniswap feedback form, and finish the external submission. No video, form submission, sponsor qualification, application acceptance or check-in is claimed here. The official deadline and four-hour internal buffer are recorded in [SUBMISSION.md](SUBMISSION.md).

See [PROTOCOL.md](PROTOCOL.md) for the exact implemented claim boundary. This prototype is not audited and does not establish safety for real funds.
