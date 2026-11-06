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
