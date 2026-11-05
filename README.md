# Aftercheck

**Experimental, read-only Uniswap receipt inspection.** Aftercheck compares a supported swap's receipt-emitted token amounts with a supplied retrospective policy, exports JSON/Markdown evidence reports, and makes uncertainty explicit. It is not audited and does not establish safety for real funds.

## Run locally

Requires **Node.js 24**. The CLI has no runtime npm dependencies, wallet connection, signing or transaction submission. Locked development dependencies provide TypeScript checking.

```bash
npm ci --ignore-scripts
npm run verify
npm run demo
```

Open `web/inspector.html` locally and import `output/demo/pass/report.json`. Compare the reports in `output/demo/violation/` and `output/demo/reserve/`. Each directory also contains evidence, policy and Markdown output. The demo replays one retained **historical Sepolia RPC capture** under three retrospective policies; it sends no transaction or network request.

Evaluation exits **0 = PASS, 2 = VIOLATION, 3 = UNKNOWN, 1 = invalid input**. Execution, protocol support, evidence coverage and policy verdict are separate fields. The demo exits zero only after checking all three expected outcomes and their individual CLI exit codes.

The original synthetic example remains available with `npm run cli -- examples/synthetic-observation.json examples/synthetic-policy.json output/synthetic`. It is labeled **SYNTHETIC_FIXTURE**, with invented addresses and events; its PASS does not establish a public-chain transaction.

## Collect and replay

Configure `AFTERCHECK_RPC_URL` in your local environment. Keep keyed provider URLs out of shared files and command history.

```bash
npm run cli -- collect <transaction-hash> output/capture
npm run cli -- verify output/capture/evidence.json <your-policy.json> output/replay
```

`collect` reads an existing Ethereum Sepolia transaction, its receipt and block, plus EIP-1898 block-hash-bound contract observations. Missing historical calls remain explicit incomplete evidence; there is no latest-state fallback. Collection success is not a policy verdict.

`verify` works offline: it checks the bundle digest and identities, decodes the supported route, reconciles receipt events and applies the separate policy. It writes `evidence.json`, normalized `policy.json`, `report.json` and `report.md`. Use actual case addresses and exact raw-unit limits; the synthetic policy is not a real transaction policy.

Use dedicated output directories and check exit status. The managed output set is staged before replacement; a new collection removes earlier reports in that directory. Invalid input does not refresh earlier output.

## Implemented Uniswap integration

The bounded profile supports **Ethereum Sepolia, chain 11155111**, direct Uniswap v3 **SwapRouter02 `exactInputSingle`**, zero native value and price limit, full exact input, and one factory-selected pool. Deployment addresses and ABI details are pinned in [PROTOCOL.md](docs/PROTOCOL.md).

| Implementation | Responsibility |
|---|---|
| [src/uniswap.ts](src/uniswap.ts) | Router calldata, factory/pool binding, Transfer/Swap reconciliation, policy checks |
| [src/collect.ts](src/collect.ts), [src/rpc.ts](src/rpc.ts) | Bounded read-only RPC collection and historical state requests |
| [src/evidence.ts](src/evidence.ts), [src/verify.ts](src/verify.ts) | Identity validation, integrity digest and offline evaluation |
| [src/report.ts](src/report.ts), [web/inspector.html](web/inspector.html) | Markdown export and local JSON inspection |

Pinned integration entry points: [calldata decoder](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L125), [historical protocol requests](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L162), [pool requests](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L174), and [receipt/policy evaluation](https://github.com/denchik37/aftercheck/blob/678cf4344d22af89f0d1114d97bd3c62500b2784/src/uniswap.ts#L269).

Amounts use canonical uint256 decimal strings and `bigint`. Owner, recipient, token pair, maximum input and minimum emitted output are checked. Unsupported routes, missing/conflicting observations and incomplete reconstruction cannot become PASS. A required transaction-boundary reserve floor remains UNKNOWN; an established amount-policy violation remains visible alongside it.

Receipt events are evaluated under an explicit plain-token assumption. Nonempty token bytecode does not prove balance semantics. Pool price/tick fields receive ABI/range checks, not AMM simulation. RPC observations and their digests do not prove consensus, finality, source authenticity, original user intent or immediate post-transaction wallet balances.

## Local inspector and demo

Open [web/inspector.html](web/inspector.html) from your checkout and choose a generated `report.json`. Everything is in one HTML file: no backend, remote fonts, analytics or wallet. It displays statuses, raw amounts, identities, digests, checks and limitations. Malformed imports clear the previous result; imported text stays inert. The inspector **displays saved results** and does not recompute or authenticate them. Use CLI `verify` for offline re-evaluation.

**Historical example:** transaction [`0x608ca58e…98d5e9`](https://sepolia.etherscan.io/tx/0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9), executed by a third party on **12 February 2025**, was captured read-only on **5 November 2026**. Its unchanged receipt and 12 historical observations are retained in [examples/sepolia](examples/sepolia/README.md), with exact quantities, independent checks and capture provenance. It is not a newly executed Aftercheck transaction.

`RPC_RECEIPT` labels provider observations; `SYNTHETIC_FIXTURE` / `SYNTHETIC_RPC_FIXTURE` label invented test data. Reproduce the real capture's three outcomes with:

```bash
npm run demo
```

It replays `policy-pass.json`, `policy-violation.json` and `policy-reserve.json` against the same `evidence.json`, with common Node network entry points disabled. The cap policy returns VIOLATION; the reserve policy returns UNKNOWN with PARTIAL coverage. The rehearsal guard is not an operating-system network sandbox. The retained incomplete Publicnode observation separately reproduces UNKNOWN when historical state is unavailable.

## Executed verification

[Real-case PR #7 CI](https://github.com/denchik37/aftercheck/actions/runs/42069380806) tested merge revision `40ee01b30505ba8163c7e18011b2a8cb5e4878b3` for implementation commit `678cf4344d22af89f0d1114d97bd3c62500b2784`: TypeScript checking and **109 tests passed** on Node `24.22.2`, followed by all three committed demo policies with CLI exits `0/2/3`. Tests include literal historical observations, one-unit boundaries, offline replay, hostile input and output consistency.

Its [browser artifact](https://github.com/denchik37/aftercheck/actions/runs/42069380806/artifacts/13435176898) records **28/28 checks** using the genuine capture across desktop 1280×900 and mobile 390×844, with zero attempted page requests, errors or dialogs. Downloads and all three verdicts passed; four screenshots were visually reviewed. Runtime: Python `3.14.4`, Playwright `1.62.0`, Chromium `151.0.7922.34`. The harness executes the exact HTML in offline `about:blank`; direct `file://` navigation itself is not exercised. The source revision, test logs and screenshots are retained in the linked CI run.

## CROPS

- **Censorship resistance:** No Aftercheck domain or server is required. After checkout and Node setup, saved-evidence replay and the viewer work without GitHub, npm or RPC access; fresh collection still needs an accessible historical RPC provider.
- **Open source:** [MIT license](LICENSE); Node.js 24 runs the CLI/demo without runtime packages. Locked npm dependencies are needed for development type checks. Code and public references are linked in [PROTOCOL.md](docs/PROTOCOL.md).
- **Privacy:** The RPC provider sees the client's IP and requested transactions, contracts and blocks. GitHub/npm see initial download metadata. Policies and reports stay local during evaluation/inspection; the client has no trackers or analytics.
- **Security:** No wallet keys or signing. Strict parsing, exact arithmetic and explicit trust limits reduce accidental overclaiming; this prototype has no audit, consensus proof or reserve-state guarantee.

These are implemented properties and limitations, not a security certification. See [protocol boundaries](docs/PROTOCOL.md), [developer feedback](FEEDBACK.md), and [AI engineering assistance](AI_USAGE.md).
