# Chainlink CRE official simulator evidence — 7 November 2026 IST

**Status: CRE SDK workflow successfully simulated and consumed by Aftercheck, with a recorded positive case and two distinct fail-safe cases.** These are **operator-provided, source-bound local CLI execution artifacts independently checked for internal byte integrity**. They are **not** authenticated Chainlink/DON attestations, nor a second independent simulator execution by the reviewer.

## Source and execution

- CLI **1.39.0**, TypeScript SDK **1.23.0**, Bun **1.4.4**, compiled to QuickJS/WASM.
- Executed at source commit [`1ad2dd1ba629bd0751748a7451619cfe8c5d488d`](https://github.com/denchik37/aftercheck/commit/1ad2dd1ba629bd0751748a7451619cfe8c5d488d), **7 November 2026 approximately 03:39–03:40 IST** (6 November 22:09–22:10 UTC).
- Original owner-provided archive: `cre-evidence-resume-20261107-033923-ca8892.zip`, **34,752 bytes**, **28 ZIP entries**, SHA-256 `3aefbda5ed2899cfd3b41bee257505f362a1f72efec51ca95bdc12b4d5ad4c45`. The archive was inspected for path traversal, ZIP corruption, sensitive terms, execution metadata and exact file hashes before the listed source-bound records were published. Do not treat the archive digest as a signature from Chainlink.
- The exact retained simulator `result.json`, `execution.json`, and **sanitized** `stdout.log`/`stderr.log` are committed for each case. Their SHA-256 hashes match the originals byte-for-byte; see [`audit-index.json`](audit-index.json). The original operator archive additionally contains the full generated core and appendix JSON/Markdown files; their exact hashes are indexed. Re-running the **offline result consumer** generates these files again; it does not re-run CRE.
- All three `execution.json` records report `exitCode: 0`, `phase: COMPLETE`, `outcome: VALIDATED_SIMULATOR_RESULT` and `metadata.executionMode: CRE_CLI_SIMULATION`. All three returned independently validated canonical results; no result was inferred from a green CI job alone.

| Official simulated case | CRE comparison | Source-bound evidence | Aftercheck core result |
|---|---|---|---|
| Public manifest and Sepolia historical Uniswap pool read | **MATCH** | [Result](reference/result.json) · [Execution](reference/execution.json) · [stdout](reference/stdout.log) · [stderr](reference/stderr.log) | **PASS**, unchanged |
| Deliberately changed expected pool `0x000…001` | **MISMATCH** (controlled input, not a genuine protocol defect) | [Result](mismatch/result.json) · [Execution](mismatch/execution.json) · [stdout](mismatch/stdout.log) · [stderr](mismatch/stderr.log) | **PASS**, unchanged |
| Deliberately missing public HTTPS manifest | **UNAVAILABLE** (no invented chain read) | [Result](unavailable/result.json) · [Execution](unavailable/execution.json) · [stdout](unavailable/stdout.log) · [stderr](unavailable/stderr.log) | **PASS**, unchanged |

The operator later ran `npm run verify` at the execution revision: **342 of 346 Node tests passed**, with four failing only because the Windows export-test harness assumed Python was installed. No CRE simulator test failed. The [Python-free Windows repair](https://github.com/denchik37/aftercheck/pull/40) subsequently passed **10/10 native Windows ZIP/offline replay tests**, along with the standard PR CI; that later test run is *not* claimed as the source revision of these three CRE simulations.

## Precisely what the workflow corroborates

The HTTPS capability fetched one immutable [public demo manifest](https://github.com/denchik37/aftercheck/tree/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public). The CRE EVM capability read Uniswap v3 factory `0x0227628f3f023bb0b980b67d528571c95c6dac1c` at **Ethereum Sepolia** (chain ID `11155111`, chain selector `16015286601757825753`), using historical block number `7689923`. It compared `getPool(token0, token1, 500)` to the manifest's pool and separately compared the fetched block header hash `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34`. The reference and intentional-mismatch cases both actually observed pool `0x029603931809d430ae47d2f55212cc0e89dbfd52`.

The underlying source transaction `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9` is an **existing third-party Sepolia transaction from February 2025** captured read-only in November 2026, not a newly submitted financial transaction. The recorded evidence digest is `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093`.

**Trust boundary:** the contract call is *number-bound*, not block-hash-bound. A separately matching header is not an EIP-1898 hash-bound contract read or consensus proof. This uses the same Tenderly public Sepolia provider as the retained capture and therefore does not prove independent-provider corroboration. It checks **pool identity**, not wallet balances, transaction-boundary reserves, source authenticity, original policy intent, audit status or safety for real funds. CRE simulation is not live deployment on a DON.

The simulator's sanitized stderr mentions a **default simulation-only key for possible chain-write simulations**. Our workflow has no signing/broadcast path or chain-write capability; the warning does **not** show that any transaction was sent. No key bytes, login tokens, MFA factors, recovery codes, credential URLs or private project materials were found in the candidate files.

## Reproduce

Follow [the integration guide](../../CRE_INTEGRATION.md) for CLI, SDK, Bun and login requirements. Run from a clean checkout with the immutable publication commit in Git history:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix integrations/cre/workflow ci --ignore-scripts --no-audit --no-fund
npm run cre:manifest
npm --prefix integrations/cre/workflow run build
# Use authenticated CRE CLI on the local execution machine.
npm run cre:simulate -- --manifest integrations/cre/public/reference.json --manifest-url https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/reference.json --output output/cre/reference-new
npm run cre:consume -- examples/sepolia/evidence.json examples/sepolia/policy-pass.json integrations/cre/public/reference.json output/cre/reference-new/result.json output/cre/reference-new/aftercheck
```

For a non-networked test of the **already recorded** result, use `scripts/cre-consume.mjs` with [`reference/result.json`](reference/result.json) (and analogously the mismatch/unavailable files). Consumer exits **0 = MATCH, 2 = MISMATCH, 3 = UNAVAILABLE/UNSUPPORTED**; those codes do not replace the financial-policy verdict.

The independent `npm run cre:demo` is explicitly an **offline replay of earlier RPC_REHEARSAL** captures, *not* the genuine CRE CLI simulator session. Don't label it otherwise in a judge video. The current public [source and sponsor guidance](../../CRE_INTEGRATION.md) preserves both classes without conflation.

## Sponsor criteria (technical evidence only)

| Control | Assessment | Basis |
|---|---|---|
| **CRE01 — meaningful orchestration** | **PASS** | A CRE HTTP capability fetch and EVM historical read are combined for pool-identity comparison. |
| **CRE02 — genuine execution** | **PASS** | Three independently inspected owner-provided official CLI simulation results and sanitized logs, including positive `MATCH`. |
| **CRE03 — Aftercheck consumption** | **PASS** | The operator's recorded consumer generated appendices for all three results; core verdict remained unchanged. |
| **CRE04 — reproducibility** | **PASS (bounded)** | Public source/SDK lockfile, immutable manifest, validated outputs, precise revisions/hashes/commands. The self-reported local execution still isn't a chain-authenticated attestation. |
| **CRE05 — accurate scope** | **PASS** | Simulation vs DON, provider reuse, block number vs block hash, historical third-party transaction and unknown reserve limitations all explicitly stated. |

**Recommendation:** select **Chainlink — Best workflow with CRE** as the third partner *if the organizer's Classic-track provenance and participation conditions are met*. A passing technical checklist is not a prize guarantee. Selecting the partner and submitting via the ETHGlobal dashboard remain owner-only actions.
