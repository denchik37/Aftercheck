# Aftercheck

**Experimental, read-only financial verification for a supported Uniswap swap.** Aftercheck compares retained transaction evidence with a user-supplied retrospective policy. The shared browser/Node engine validates the evidence, reconciles the supported receipt and produces exact, reproducible PASS / VIOLATION / UNKNOWN findings. It is not audited and does not establish safety for real funds.

**Browser feature release status — 6 November 2026:** the browser verification
implementation is complete on `feature/browser-financial-verifier`. Local
TypeScript, reproducible-build and **343 Node tests** passed; actual Chromium/CI
acceptance and the manual production deployment are pending. The
[public website](https://aftercheck-g4nsb.ondigitalocean.app/) still serves the
previous saved-report viewer. A repository change or successful local test does
not mean the new workspace is live. See the [readiness checkpoint](docs/READINESS.md)
and [release status](docs/DIGITALOCEAN_DEPLOYMENT.md).

## Run locally

Requires **Node.js 24 or newer**. The CLI has no runtime npm dependencies, wallet connection, signing or transaction submission. Locked development dependencies provide TypeScript checking and reproducible browser compilation.

**Windows PowerShell:** Start with the [Windows quickstart](docs/WINDOWS_QUICKSTART.md) for Git/Node setup, `npm.cmd`, offline replay, optional Sepolia inspection, and exact report locations.

```bash
npm ci --ignore-scripts
npm run verify
npm run demo
```

Open `web/report-viewer.html` locally and import `output/demo/pass/report.json` to
inspect a saved result. Compare `output/demo/violation/` and `output/demo/reserve/`;
each directory also contains evidence, policy and Markdown output. The demo
replays one retained **historical Sepolia RPC capture** under three retrospective
policies; it sends no transaction or network request.

The new browser workspace uses committed native JavaScript modules. Serve `web/`
over loopback HTTP and open `http://127.0.0.1:8080/inspector.html`:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
```

On Windows, use `py` instead of `python3` when that is your Python launcher. HTTPS
or localhost is required for native Web Crypto. Direct `file://` module loading is
not the workspace's supported launch path; the self-contained saved-report viewer
and offline CLI remain available without a web server.

Evaluation exits **0 = PASS, 2 = VIOLATION, 3 = UNKNOWN, 1 = invalid input**. Execution, protocol support, evidence coverage and policy verdict are separate fields. The demo exits zero only after checking all three expected outcomes and their individual CLI exit codes.

The original synthetic example remains available with `npm run cli -- examples/synthetic-observation.json examples/synthetic-policy.json output/synthetic`. It is labeled **SYNTHETIC_FIXTURE**, with invented addresses and events; its PASS does not establish a public-chain transaction.

## Collect and replay

Configure `AFTERCHECK_RPC_URL` in your local environment. Keep keyed provider URLs out of shared files and command history.

```bash
npm run cli -- inspect <transaction-hash> <your-policy.json> output/inspection
npm run cli -- collect <transaction-hash> output/capture
npm run cli -- verify output/capture/evidence.json <your-policy.json> output/replay
```

`inspect` performs one read-only collection and immediate policy evaluation using the same single provider. It publishes a coherent evidence/policy/JSON/Markdown set and returns exit code **0/2/3** for PASS/VIOLATION/UNKNOWN. A policy with the wrong chain or invalid input is rejected before RPC reads; incomplete historical observations cannot produce PASS. For a known public example, use the retained retrospective policy `examples/sepolia/policy-pass.json` with transaction hash `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`. A network read is not required for subsequent offline `verify`.

`collect` reads an existing Ethereum Sepolia transaction, its receipt and block, plus EIP-1898 block-hash-bound contract observations. Missing historical calls remain explicit incomplete evidence; there is no latest-state fallback. Collection success is not a policy verdict.

`verify` works offline: it checks the bundle digest and identities, decodes the supported route, reconciles receipt events and applies the separate policy. It writes `evidence.json`, normalized `policy.json`, `report.json` and `report.md`. Use actual case addresses and exact raw-unit limits; the synthetic policy is not a real transaction policy.

Use dedicated output directories and check exit status. The managed output set is staged before replacement; a new collection removes earlier reports in that directory. Invalid input does not refresh earlier output.

## Implemented Uniswap integration

The bounded profile supports **Ethereum Sepolia, chain 11155111**, direct Uniswap v3 **SwapRouter02 `exactInputSingle`**, zero native value and price limit, full exact input, and one factory-selected pool. Deployment addresses and ABI details are pinned in [PROTOCOL.md](docs/PROTOCOL.md).

| Implementation | Responsibility |
|---|---|
| [src/uniswap.ts](src/uniswap.ts) | Router calldata, factory/pool binding, Transfer/Swap reconciliation, policy checks |
| [src/collect.ts](src/collect.ts), [src/rpc.ts](src/rpc.ts) | Bounded read-only RPC collection and historical state requests |
| [src/evidence-core.ts](src/evidence-core.ts), [src/verify-core.ts](src/verify-core.ts) | Shared schema/identity validation and report assembly |
| [src/verify.ts](src/verify.ts), [src/browser-engine.ts](src/browser-engine.ts) | Synchronous Node SHA-256 and asynchronous native Web Crypto adapters |
| [src/inspect.ts](src/inspect.ts), [bin/aftercheck.mjs](bin/aftercheck.mjs) | Single-source collection and immediate offline evaluation of the captured bundle |
| [src/amounts.ts](src/amounts.ts), [src/token-precision.ts](src/token-precision.ts) | Exact decimal controls and source-to-retained-runtime precision binding |
| [src/browser-workspace.ts](src/browser-workspace.ts), [web/inspector.html](web/inspector.html) | Transaction-first browser verification workspace |
| [src/browser-export.ts](src/browser-export.ts), [src/report.ts](src/report.ts) | Reproducible ZIP inputs, actual JSON results and deterministic Markdown |
| [web/report-viewer.html](web/report-viewer.html) | Preserved standalone saved-report inspection |

Pinned integration entry points: [calldata decoder](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L125), [historical protocol requests](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L162), [pool requests](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L174), and [receipt/policy evaluation](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L269).

Amounts use canonical uint256 decimal strings and `bigint`. Owner, recipient, token pair, maximum input and minimum emitted output are checked. Unsupported routes, missing/conflicting observations and incomplete reconstruction cannot become PASS. A required transaction-boundary reserve floor remains UNKNOWN; an established amount-policy violation remains visible alongside it.

Receipt events are evaluated under an explicit plain-token assumption. Nonempty token bytecode does not prove balance semantics. Pool price/tick fields receive ABI/range checks, not AMM simulation. RPC observations and their digests do not prove consensus, finality, source authenticity, original user intent or immediate post-transaction wallet balances.

## Browser verification workspace

The entry point is the transaction hash. One genuine historical transaction has a
published retained capture:

```text
0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9
```

Loading it retrieves the unchanged public evidence bundle from the same static
origin. An unrecognized hash offers local `evidence.json` import; it does not
trigger an RPC lookup. The workspace explicitly labels this **historical evidence
replay**, with a **user-supplied retrospective policy**. It does not establish the
original trader's instructions.

The browser runs the shared verifier rather than selecting prepared reports. It
checks strict JSON/schema integrity, SHA-256, transaction/receipt/block identities,
the exact supported Uniswap route and event reconciliation before assessing the
policy. Changing financial inputs requires no new network request. The overview,
individual checks, evidence and export views keep execution and policy findings
separate.

The historical tokens' 18-decimal precision is bound to independently compiled
source and the exact retained runtime bytes; [the complete precision evidence](docs/TOKEN_PRECISION.md)
records chain, addresses, block, source and hashes. Other captures use raw units
or explicitly unverified user-supplied precision. Display changes preserve the
existing raw policy; editing an amount changes the policy itself.

| Same retained execution | Minimum received | Financial result |
|---|---:|---|
| Output `0.999496253769344460` | `0.999` | PASS, when the other supplied checks pass |
| Same output | `1` | VIOLATION; execution stays SUCCEEDED |
| Passing amount requirements plus a reserve floor | Any reserve floor, including `0` | UNKNOWN reserve check; no transaction-boundary reserve proof |

A definite violation retains precedence if a reserve check is also UNKNOWN. The
encoded router minimum is separately displayed as `0` raw units; it is not the
retrospectively supplied output requirement.

**Download verification package** exports the original evidence, normalized raw
policy, actual browser JSON report, Markdown, display provenance and offline
instructions in one ZIP. With the CLI already prepared locally, replay the saved
inputs without RPC access:

```bash
npm run cli -- verify evidence.json policy.json output/replay
```

Pass full paths when the extracted files are outside your checkout. Exit codes
are **0 PASS, 2 VIOLATION, 3 UNKNOWN, 1 invalid input**. A full report comparison,
including both digests and every check, is stronger than comparing only the verdict.
See [browser architecture, usage and validation](docs/BROWSER_VERIFIER.md).

## Saved-report viewer and historical demo

The previous viewer is preserved byte-for-byte at
[web/report-viewer.html](web/report-viewer.html). Open it locally and choose a
generated `report.json`; it displays saved findings without recomputing them.
Malformed imports clear the old result and imported text stays inert. It remains
self-contained, with no backend, remote assets, analytics or wallet.

The currently deployed public root is still this older viewer. Its historical
[production HTTPS run 42234449518](https://github.com/denchik37/aftercheck/actions/runs/42234449518)
passed **45 checks**, including **36 browser checks**, against expected source
`d5414cb43c6d31cc66afd070d14dca4ab9921a75`. Those results validate that prior release;
they do not validate or deploy the new browser evaluator. The provider record and
remaining manual release step are in [deployment and rollback](docs/DIGITALOCEAN_DEPLOYMENT.md).

**Historical example:** transaction [`0x608ca58e…98d5e9`](https://sepolia.etherscan.io/tx/0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9), executed by a third party on **12 February 2025**, was captured read-only on **5 November 2026**. Its unchanged receipt and 12 historical observations are retained in [examples/sepolia](examples/sepolia/README.md), with exact quantities, independent checks and capture provenance. It is not a newly executed Aftercheck transaction.

`RPC_RECEIPT` labels provider observations; `SYNTHETIC_FIXTURE` / `SYNTHETIC_RPC_FIXTURE` label invented test data. Reproduce the real capture's three outcomes with:

```bash
npm run demo
```

It replays `policy-pass.json`, `policy-violation.json` and `policy-reserve.json` against the same `evidence.json`, with common Node network entry points disabled. The cap policy returns VIOLATION; the reserve policy returns UNKNOWN with PARTIAL coverage. The rehearsal guard is not an operating-system network sandbox. The retained incomplete Publicnode observation separately reproduces UNKNOWN when historical state is unavailable.

## Executed verification

**Local browser-enhancement checkpoint:** `npm run verify` passed TypeScript,
deterministic asset reproduction and **343/343 Node tests**, with zero failures.
This includes **24 focused amount, metadata and export tests**, four complete
exported-package CLI replays and explicit synthetic provenance. Both historical
token runtimes were independently recompiled in full. The current local publication
contains **21 files / 382,538 bytes**; generated JavaScript plus its manifest are
**13 assets / 104,394 bytes**. Actual Chromium parity/workspace results, final
reviewed Git SHA and CI runs remain pending in the [readiness checkpoint](docs/READINESS.md).
Earlier browser counts are not acceptance for this feature.

`npm run verify` now includes TypeScript, committed-browser-asset reproducibility
and Node tests. `npm run build:browser` regenerates the small native ES-module
graph using the already pinned TypeScript compiler; `npm run check:browser` rejects
stale or unexpected generated assets. CI separately runs the actual Chromium
core/parity, interactive workspace, offline-export and fallback-viewer harnesses.

**Preserved earlier implementation checkpoint:** [Verify run 42244604886](https://github.com/denchik37/aftercheck/actions/runs/42244604886)
at `f7e4048389d3acf85d7c16020b34990c03fde93f` passed TypeScript checking,
**272 Node tests**, the offline PASS/VIOLATION/UNKNOWN demo, **75 offline browser
cases** and **44 local HTTP checks**. The [current readiness matrix](docs/READINESS.md#current-audited-status--6-november-2026)
separately pins the latest real corroboration runs and actual SDK builds to their
source revisions. The public HTTPS viewer retains its own deployment source;
this optional CLI integration does not redeploy it. The records below retain
earlier implementation checkpoints.

**Optional Chainlink CRE integration:** the official SDK workflow fetches a
revision-pinned public manifest and requests a historical Sepolia factory
`getPool` read plus a separate block header. Aftercheck validates its structured
result and produces a separate corroboration appendix while preserving the core
financial verdict. The actual workflow compiles to WASM; successful official
simulation remains dependent on CRE account authentication. Direct RPC rehearsal
is explicitly labelled and is not CRE execution evidence. See the
[integration and reproduction guide](docs/CRE_INTEGRATION.md),
[current evidence](docs/READINESS.md), and [superseded gate decision](docs/CRE_DECISION.md).
The ordinary verifier, replay and viewer require no CRE credentials or packages.

Run `npm run cre:demo` to replay the retained real HTTP/RPC corroboration results
offline and generate five separate appendices under `output/cre-demo`. This
demonstrates MATCH, intentional MISMATCH and UNAVAILABLE while preserving core
PASS, VIOLATION and reserve UNKNOWN. It is labelled **RPC_REHEARSAL**, and does not
claim a fresh observation or official CRE simulation. [Recorded evidence and
sponsor status](docs/evidence/cre/README.md).

[Real-case PR #7 CI](https://github.com/denchik37/aftercheck/actions/runs/42069380806) tested merge revision `40ee01b30505ba8163c7e18011b2a8cb5e4878b3` for implementation commit `678cf4344d22af89f0d1114d97bd3c62500b2784`: TypeScript checking and **109 tests passed** on Node `24.22.2`, followed by all three committed demo policies with CLI exits `0/2/3`. Tests include literal historical observations, one-unit boundaries, offline replay, hostile input and output consistency.

Its [browser artifact](https://github.com/denchik37/aftercheck/actions/runs/42069380806/artifacts/13435176898) records **28/28 checks** using the genuine capture across desktop 1280×900 and mobile 390×844, with zero attempted page requests, errors or dialogs. Downloads and all three verdicts passed; four screenshots were visually reviewed. Runtime: Python `3.14.4`, Playwright `1.62.0`, Chromium `151.0.7922.34`. The harness executes the exact HTML in offline `about:blank`; direct `file://` navigation itself is not exercised. The source revision, test logs and screenshots are retained in the linked CI run.

**Verified one-command read-only collection:** [optional Sepolia inspection workflow](https://github.com/denchik37/aftercheck/actions/runs/42092888204) ran exact main revision [`53dc14a`](https://github.com/denchik37/aftercheck/commit/53dc14ade58ce5faa9edee5e072fc5b202e2ce8f) against the existing third-party historical transaction using Tenderly's documented keyless endpoint. It returned `SUCCEEDED / SUPPORTED / COMPLETE / PASS` under the committed retrospective policy; the saved evidence, policy, JSON and Markdown passed the offline consistency check. The [workflow artifact](https://github.com/denchik37/aftercheck/actions/runs/42092888204/artifacts/13445793682) retains those outputs. This provider-dependent check is optional and is not part of mandatory CI; it does not prove source authenticity, arbitrary token balances or transaction-boundary reserves.

## CROPS

- **Censorship resistance:** No Aftercheck domain or server is required. After checkout and Node setup, saved-evidence replay and the viewer work without GitHub, npm or RPC access; fresh collection still needs an accessible historical RPC provider.
- **Open source:** Aftercheck-authored source is [MIT licensed](LICENSE); Node.js 24 runs the CLI/demo without runtime packages. Locked npm dependencies are needed for development type checks. Optional official CRE SDK/plugin dependencies have separate BUSL-1.1 nonproduction terms, listed in [third-party notices](integrations/cre/THIRD_PARTY_NOTICES.md); the core does not depend on them. Code and public references are linked in [PROTOCOL.md](docs/PROTOCOL.md).
- **Privacy:** The RPC provider sees the client's IP and requested transactions, contracts and blocks. GitHub/npm see initial download metadata. Policies and reports stay local during evaluation/inspection; the client has no trackers or analytics.
- **Security:** No wallet keys or signing. Strict parsing, exact arithmetic and explicit trust limits reduce accidental overclaiming; this prototype has no audit, consensus proof or reserve-state guarantee.

These are implemented properties and limitations, not a security certification. See [protocol boundaries](docs/PROTOCOL.md), [developer feedback](FEEDBACK.md), and [AI engineering assistance](AI_USAGE.md).
