# Chainlink CRE decision — omitted from this submission

**Decision checked 6 November 2026 at 20:07 IST. Status: CRE NOT READY — DROP THIRD PARTNER.**

The optional integration did not have a successful, meaningful official CRE CLI
simulation before the deadline-derived decision gate. No CRE workflow, SDK
dependency, simulator result or application consumer exists at the audited source
revision `4130c2af7e6b096b8394f423f7e56ecc75da87ab`. Optional CRE engineering stopped
at the initial audit. This document records a scope decision, not an implementation.

## Verified deadline and stop rule

The current official [submission guide](https://ethglobal.com/events/mumbai/info/details)
and [getting-started guide](https://ethglobal.com/events/mumbai/info/start), both
checked on 6 November, state **Saturday, 7 November 2026 at 09:00 IST**. The initial
CRE execution brief's 8 November assumption conflicted with both current sources
and the deadline already recorded in [SUBMISSION.md](SUBMISSION.md).

The internal CRE gate was **D minus 14 hours**, therefore **6 November at 19:00
IST**. The audit's clock reading was `2026-11-06 14:37:30 UTC`, or **20:07:30 IST**:
the gate had passed by 1 hour 7 minutes. No authenticated dashboard notice or
organizer extension was available to supersede the public guides. An inaccessible
dashboard does not establish that no extension exists; the earlier verified
deadline controls this engineering decision.

The explicit delivery rule was to stop optional CRE work if a meaningful successful
simulation was absent at this gate. This preserves the remaining time for the
existing Uniswap demonstration, offline replay, video and submission. A later
authoritative deadline or a separate scope decision would need a fresh assessment;
this record does not establish future CRE qualification.

## Sponsor requirements and actual evidence

The [official Chainlink challenge](https://ethglobal.com/events/mumbai/prizes/chainlink)
lists **Best workflow with CRE — $1,500**. A workflow must combine a blockchain
with an external source, execute successfully in the official CLI simulator or
live CRE environment, and be meaningfully used by the application. Simulation is
sufficient; compilation, conventional unit tests and mocked responses do not
establish that requirement. The separate CCIP challenge is outside this decision.

| Requirement | Status | Supporting observation at audited source | Reproduction / remaining gap |
|---|---|---|---|
| CRE01 — meaningful integration | FAIL | No CRE workflow, external manifest fetch or EVM capability integration exists | Inspect the audited tree and `package.json`; no CRE command exists |
| CRE02 — real execution | NOT TESTED | No official CLI simulation or deployed execution was attempted or retained | No simulation command, exit code, MATCH or MISMATCH is claimed |
| CRE03 — application consumption | FAIL | CLI and viewer consume existing Aftercheck reports; no CRE result consumer exists | A separate digest-bound consumer would still be required |
| CRE04 — reproducibility | FAIL | No tested CRE dependency set, configuration or output artifact exists | Public research is not executable sponsor evidence |
| CRE05 — accurate result representation | NOT TESTED | There is no CRE output whose provenance can be validated | This note explicitly claims no simulation, DON attestation or financial assurance |

All rows refer to `4130c2af7e6b096b8394f423f7e56ecc75da87ab`; none is a sponsor
qualification PASS. Existing project tests do not substitute for these missing
CRE checks. No authentication error from the simulator is claimed: the CLI was
not installed or invoked in this execution.

## Bounded technical assessment, not implemented

The smallest useful candidate was a public manifest derived from the retained
Sepolia evidence, fetched through CRE HTTP, compared against a real factory
`getPool` read. It would add protocol-identity corroboration without changing the
financial-policy verdict or inventing transaction-boundary balances.

The [official EVM SDK reference](https://docs.chain.link/cre/reference/sdk/evm-client-ts)
documents explicit block-number contract reads. A separate header comparison
would not make that contract call block-hash-bound. Archive availability,
authentication, WASM compatibility and actual HTTP/EVM execution remain untested.
The [simulation guide](https://docs.chain.link/cre/guides/operations/simulating-workflows)
describes real endpoint calls and account/login prerequisites. No speculative
workflow is added to the release.

## Preserved submission path

Continue with **Uniswap** as the primary partner and **Ethereum Foundation CROPS**
as the conditional secondary partner, using the actual evidence and outstanding
requirements in [SUBMISSION.md](SUBMISSION.md). **Do not select Chainlink as the
third partner on the present evidence.** No external partner selection or form
submission was changed by this documentation update.

The core remains independently runnable with `npm run verify` and `npm run demo`;
neither requires CRE credentials, packages or network services. The latest
audited verification and hosted-viewer evidence are recorded in
[READINESS.md](READINESS.md#current-audited-status--6-november-2026).

This engineering decision does not certify participation, track eligibility,
required development-input disclosure, human contribution or sponsor acceptance.
