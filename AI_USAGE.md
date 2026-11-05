# AI assistance and development attribution

Aftercheck uses ChatGPT for engineering assistance. This disclosure records the work observed in the 5 November 2026 execution session; it is not an independent human audit or a complete development-input archive.

## Scope of assistance

AI assistance covers implementation, test generation, debugging, code review, public documentation research and documentation drafting. The current session's affected areas include:

- JSON parsing, RPC transport, evidence collection and integrity: `src/json.ts`, `src/rpc.ts`, `src/evidence.ts`, `src/collect.ts`.
- Uniswap calldata/event decoding and retrospective policy replay: `src/uniswap.ts`, `src/verify.ts`, plus changes to `src/policy.ts` and `src/report.ts`.
- Local file handling and CLI integration: `src/io.ts`, `src/output.ts`, `bin/aftercheck.mjs`.
- The local viewer `web/inspector.html`, regression tests under `test/`, `scripts/test-inspector.py`, `scripts/capture-example.mjs`, `scripts/demo.mjs`, `scripts/offline-guard.mjs`, and workflows under `.github/workflows/`.
- README, protocol documentation, developer feedback and submission preparation.

The starting repository already declared AI-assisted code and test generation. Actual changes and their dates are recorded in Git history. Model-generated review and passing automated tests do not establish independent human review, complete token behavior validation, or production readiness.

## Human and submission responsibilities

The project owner supplied the scope, constraints and execution authorization. The owner must review the delivered behavior, accurately describe their own contributions, record the demonstration and confirm the final submission. No additional human contributor, review, recording or submission is claimed by this file.

The [event guidance](https://ethglobal.com/events/mumbai/info/details) requires accurate AI attribution and, for spec-driven work, the relevant specifications, prompts and planning inputs. Project-specific planning documents dated **28 October 2026** were supplied as context. Their eligibility as inputs to the selected Start from Scratch / Classic track is unresolved; they are not represented as newly created during the event.

This summary does not replace the required development-input archive or certify eligibility. Complete required disclosure and owner/organizer confirmation remain pending. Publication of a repository or regeneration of text does not establish an input's creation date or eligibility.

Public technical dependencies and reference interfaces are identified in the lockfile, workflows, [`docs/PROTOCOL.md`](docs/PROTOCOL.md) and [`FEEDBACK.md`](FEEDBACK.md). No application signing keys are required or generated.
