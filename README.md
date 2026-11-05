# Aftercheck

**Experimental prototype · Initialized 5 November 2026**

Aftercheck explores read-only verification of EVM transaction outcomes, emphasizing exact raw-unit financial checks, inspectable evidence, and explicit uncertainty.

## Try the current prototype

Requires Node.js 24. No runtime npm dependencies, wallet connection, or RPC endpoint.

```bash
npm ci --ignore-scripts
npm test
npm run cli -- examples/synthetic-observation.json examples/synthetic-policy.json
# inspect aftercheck-output/report.json and aftercheck-output/report.md
```

The supplied data is **SYNTHETIC_FIXTURE**: invented addresses, transaction identities, and transfers. A PASS proves that the local test fixture satisfies its declared retrospective policy **under the fixture's assumptions**. It does **not** prove a transaction happened onchain, establish the correctness of a real pool, authenticate user intent, or prove token balances.

Change `maxInputRaw` to `400` to see a policy VIOLATION. Add `reserveFloorRaw: "100"` to see UNKNOWN: receipt-scoped evidence cannot prove the remaining wallet balance immediately after the transaction. The CLI exits `0` for PASS, `2` for VIOLATION, `3` for UNKNOWN, and `1` for invalid input.

The command writes only a deterministic JSON report and readable Markdown report to the chosen local output directory. It does not sign transactions or make RPC requests.

## Current supported scope

- Strict canonical unsigned decimal strings up to uint256; `bigint` comparisons, not floating-point finance.
- Explicit chain, owner, recipient, token pair, maximum input and minimum received policy.
- Normalized, synthetic direct Uniswap v3 `exactInputSingle`-shaped example with two reconciled token-transfer edges.
- Independent execution, support, evidence coverage, and policy verdict fields.
- Fail-closed UNKNOWN for unsupported routes, non-synthetic external data, receipt conflicts, missing transfer evidence, and unverifiable reserve claims.
- Tests for large amounts, contradictions, unsupported inputs, and negative cases.

## Important limits

The bounded read-only collector library in `src/rpc.ts` and `src/evidence.ts` validates transaction/receipt/block identities and exports a deterministic integrity digest. Its tests use mocked RPC responses; the CLI still evaluates only the synthetic example.

This version has **no verified router/pool binding, real swap evidence, contract deployment, production asset support, transaction-boundary reserve reconstruction, or security audit**. The normalized input format is currently a testing interface, not proof of raw Ethereum logs. Offline reports evaluate only supplied evidence and do not establish canonicality. Do not use the prototype to protect or move real funds.

The next milestone is to collect a genuinely supported direct swap receipt, independently validate the actual router/pool/event identities, and preserve a reproducible evidence bundle.

Licensed under MIT. Development includes AI-assisted code and test generation.
