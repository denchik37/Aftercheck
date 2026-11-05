# Aftercheck

**Experimental prototype · Initialized 5 November 2026**

Aftercheck explores read-only verification of EVM transaction outcomes, emphasizing exact raw-unit financial checks, inspectable evidence, and explicit uncertainty.

## Try the current prototype

Requires Node.js 24. There are no runtime npm dependencies or wallet connection. Synthetic examples and offline replay need no RPC endpoint; live collection uses a provider you explicitly configure. Locked development dependencies provide TypeScript checking.

```bash
npm ci --ignore-scripts
npm run verify
npm run cli -- examples/synthetic-observation.json examples/synthetic-policy.json
# inspect aftercheck-output/report.json and aftercheck-output/report.md
```

The supplied data is **SYNTHETIC_FIXTURE**: invented addresses, transaction identities, and transfers. A PASS proves that the local test fixture satisfies its declared retrospective policy **under the fixture's assumptions**. It does **not** prove a transaction happened onchain, establish the correctness of a real pool, authenticate user intent, or prove token balances.

Change `maxInputRaw` to `400` to see a policy VIOLATION. Add `reserveFloorRaw: "100"` to see UNKNOWN: receipt-scoped evidence cannot prove the remaining wallet balance immediately after the transaction. The CLI exits `0` for PASS, `2` for VIOLATION, `3` for UNKNOWN, and `1` for invalid input.

The synthetic command writes a normalized policy, deterministic JSON report and readable Markdown report to the chosen local output directory. It does not sign transactions or make RPC requests.

## Collect and replay a supported Sepolia transaction

Configure `AFTERCHECK_RPC_URL` in your local environment; keep keyed provider URLs out of command history, reports and shared files. Then run:

```bash
npm run cli -- collect <transaction-hash> output/capture
npm run cli -- verify output/capture/evidence.json <your-policy.json> output/replay
```

`collect` retrieves the transaction, receipt, containing block and EIP-1898 hash-bound protocol observations. A provider that cannot serve those historical calls produces explicit incomplete evidence; there is no latest-state fallback. Only existing Ethereum Sepolia transactions are supported. No wallet or signing operation exists.

`verify` checks the bundle digest, revalidates its identities, decodes the supported protocol events, and applies the supplied retrospective policy. It works offline and exports `evidence.json`, `policy.json`, `report.json` and `report.md`. A matching digest establishes internal integrity, not source authenticity. Policy addresses and raw-unit limits must describe your chosen case; the synthetic policy's invented addresses are not a real transaction policy.

Use a dedicated output directory. Files are staged before the complete managed set is replaced, so a write failure cannot mix a new policy with an old PASS report. Unrelated files and symlink outputs are rejected. A successful new `collect` replaces earlier reports in that directory with evidence only. Always check the command's exit status; failed input evaluation does not refresh an earlier result.

The optional **Capture public Sepolia evidence** workflow is separate from deterministic CI. It can run manually or on a dedicated `capture/**` branch, using a fixed credential-free public provider; it retains observations as an artifact and bounded log JSON. A completed collection workflow is not a financial verdict.

## Inspect a saved report in the browser

Open [`web/inspector.html`](web/inspector.html) from your local checkout, then select the generated `report.json`. The single file includes all scripts and styles; it has no backend, remote fonts, analytics or wallet connection. It displays the four result dimensions, exact receipt-emitted amounts, evidence/policy digests, checks and limitations. Malformed input clears the previous display, and imported text cannot insert HTML.

The inspector is a **saved-report viewer**. It does not recompute the financial verdict or authenticate chain evidence. Use the CLI `verify` command for independent offline re-evaluation, then inspect its output.

The optional browser test runtime is pinned in `test/browser-requirements.txt`. CI tests desktop and mobile views in a fresh Chromium context with all networking disabled; it loads the exact HTML source into `about:blank` and retains screenshots. This tests rendering, file import, downloads and hostile input; `file://` navigation itself is not exercised by that isolated harness.

## Current supported scope

- Strict canonical unsigned decimal strings up to uint256; `bigint` comparisons, not floating-point finance.
- Explicit chain, owner, recipient, token pair, maximum input and minimum received policy.
- Normalized, synthetic direct Uniswap v3 `exactInputSingle`-shaped example with two reconciled token-transfer edges.
- Independent execution, support, evidence coverage, and policy verdict fields.
- Direct Sepolia Router02 collection, hash-bound factory/pool checks, receipt-emitted amount reconciliation, portable evidence integrity and offline replay.
- Fail-closed UNKNOWN for unsupported routes, unverified normalized external data, receipt conflicts, missing transfer evidence, and unverifiable reserve claims.
- Tests for large amounts, contradictions, unsupported inputs, and negative cases.

## Important limits

The bounded read-only collector library in `src/rpc.ts` and `src/evidence.ts` validates transaction/receipt/block identities and exports a deterministic integrity digest. The adapter in `src/uniswap.ts` checks direct Sepolia Router02 calldata, hash-bound factory/pool observations and exact Transfer/Swap event reconciliation. See [the implemented receipt profile](docs/PROTOCOL.md). Its regression tests use mocked RPC responses, and offline CLI tests disable network primitives before replay.

This version has **no published real swap evidence, contract deployment, production asset support, transaction-boundary reserve reconstruction, or security audit**. The normalized input format is currently a testing interface, not proof of raw Ethereum logs. Offline reports evaluate only supplied evidence and do not establish canonicality. Do not use the prototype to protect or move real funds.

The next milestone is to retain and independently cross-check a genuine supported public-chain capture with its source revision. Do not confuse the synthetic regression fixtures with that milestone.

Licensed under MIT. Development includes AI-assisted code and test generation.
