# AI assistance and development attribution

Aftercheck uses ChatGPT for engineering assistance. This disclosure records the dated sessions below; it is not an independent human audit or a complete development-input archive.

## 5 November 2026 — implementation assistance

AI assistance covers implementation, test generation, debugging, code review, public documentation research and documentation drafting. That session's affected areas include:

- JSON parsing, RPC transport, evidence collection and integrity: `src/json.ts`, `src/rpc.ts`, `src/evidence.ts`, `src/collect.ts`.
- Uniswap calldata/event decoding and retrospective policy replay: `src/uniswap.ts`, `src/verify.ts`, plus changes to `src/policy.ts` and `src/report.ts`.
- Local file handling and CLI integration: `src/io.ts`, `src/output.ts`, `bin/aftercheck.mjs`.
- The local viewer `web/inspector.html`, regression tests under `test/`, `scripts/test-inspector.py`, `scripts/capture-example.mjs`, `scripts/demo.mjs`, `scripts/offline-guard.mjs`, and workflows under `.github/workflows/`.
- README, protocol documentation, developer feedback and submission preparation.

The starting repository already declared AI-assisted code and test generation. Actual changes and their dates are recorded in Git history. Model-generated review and passing automated tests do not establish independent human review, complete token behavior validation, or production readiness.

## 6 November 2026 — CRE scope decision and evidence reconciliation

ChatGPT assisted with research into the public event deadline and sponsor requirements,
inspection of repository and GitHub Actions evidence, and documentation drafting
and review. This update affects `README.md`, `docs/CRE_DECISION.md`,
`docs/READINESS.md`, `docs/SUBMISSION.md`, and this disclosure.

The update records the decision to omit optional CRE work after the deadline-derived
gate. It adds no CRE workflow, dependency or simulator result, and does not establish
independent human review, accepted participation or sponsor qualification.

## 6–7 November 2026 — later CRE authorization and implementation (superseding the earlier omission decision)

After the earlier documentation decision, the owner explicitly overrode its internal
CRE cutoff and authorized the optional integration to proceed. The earlier section
records a genuine historical decision; it is **not** the current implementation
state. ChatGPT assisted with the official CRE SDK workflow and read-only
HTTP/EVM capability integration, revision-pinned manifest handling, comparison
and bounded result serialization, Aftercheck's separate CRE result consumer,
validation tests, CI scripts, local Windows execution instructions and
reproducibility documentation. The relevant public implementation and evidence
are under `integrations/cre/`, `docs/CRE_INTEGRATION.md`, `docs/evidence/cre/`,
and the ordinary Git commit/CI history.

The SDK WASM build, ordinary RPC rehearsal, offline appendix consumption and CI
checks have distinct execution meanings. At the observed `main` revision
`1ad2dd1ba629bd0751748a7451619cfe8c5d488d`, the official
[CRE simulation workflow](https://github.com/denchik37/aftercheck/actions/runs/42300693047)
completed its authentication availability check with **no configured CRE API key**;
the official CLI simulation and corresponding result-consumption steps were
**skipped**, not passed. This disclosure does not claim qualified Chainlink
sponsor execution, independent human auditing or original authorship of public
third-party dependencies.
