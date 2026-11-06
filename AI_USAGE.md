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

## 6–7 November 2026 — optional CRE implementation and submission evidence

Subsequent ChatGPT-assisted development (after the earlier 6 November decision
snapshot) created and refined the optional Chainlink CRE HTTP-plus-EVM workflow,
manifest generator, shared comparison and strict parsers, source-integrity and
bounded CLI simulation runner, consumer report appendix, tests, GitHub Actions,
Windows tools and documentation. Materially affected paths include
`integrations/cre/`, `src/corroboration.ts`,
`scripts/cre-*.mjs`, `scripts/cre-windows-*.ps1`,
`test/cre-*.test.mjs`, `test/browser-export.test.mjs`,
`.github/workflows/cre.yml`, `.github/workflows/cre-evidence.yml`,
`.github/workflows/windows-cre-runner.yml`, the official CRE evidence
and sponsor documents. Exact file-level attribution is inspectable in Git
commits and pull requests, including PRs #33, #36–#40 and the later source-bound
submission-evidence PR. This supplement does **not** backdate any implementation.

The owner executed first-time Chainlink account login/MFA setup and manually
ran the authenticated CRE CLI on Windows. Their supplied operator logs, results
and exports were reviewed for integrity and sensitive data; the actual
`CRE_CLI_SIMULATION` reference, intentional mismatch and unavailable cases
are tied to source `1ad2dd1ba629bd0751748a7451619cfe8c5d488d` and published
under [the official evidence record](docs/evidence/cre/official-2026-11-07/README.md).
Automated checking, assistant review, and a locally authenticated simulator
do not establish an independent human code audit or a Chainlink DON
attestation. The owner remains responsible for final video, human
contribution, permission to use dated pre-event planning inputs, and accurate
ETHGlobal disclosure.

The 6 November section above describes an earlier, incomplete scope checkpoint.
Its past-tense omission decision was explicitly overridden; the later
implementation and verification are recorded here and in actual Git history.

## 7 November 2026 — final submission copy and editing direction

ChatGPT reviewed current public ETHGlobal submission/partner requirements and the already verified Aftercheck repository, then assisted in drafting `docs/ETHGLOBAL_SUBMISSION_HANDOFF.md` and updating the README, submission, CRE, and readiness references. The planned 2:58 master is editorial guidance using user-prepared real footage and human narration; **no new video was rendered, uploaded or submitted** in this documentation update. This does not establish independent human audit or resolve the Classic prior-design eligibility question.
