# Chainlink CRE decision — technical integration verified

## 7 November 2026 — third-partner technical qualification gate passed

Authenticated **CRE CLI 1.39.0 / SDK 1.23.0** produced a genuine local
simulation `MATCH` against the public Sepolia factory pool at source
`1ad2dd1ba629bd0751748a7451619cfe8c5d488d`. An intentionally
modified expected pool produced `MISMATCH`, and an unavailable external
manifest produced `UNAVAILABLE`. Aftercheck consumed all three genuine
simulator results without altering the original policy verdict. The complete
[reviewed execution results, sanitized CLI logs and byte-hash evidence](evidence/cre/official-2026-11-07/README.md)
are now public.

**Decision:** select Chainlink `Best workflow with CRE` as the third sponsor
target *on technical merits*, subject to the separate Classic-track provenance,
AI-disclosure and actual dashboard selection gates. Local simulation is enough
for the sponsor's CRE execution requirement; it is not a deployed DON or
financial-state attestation. The same underlying Tenderly public provider was
used for the retained capture, and the historic contract read is bound to block
number plus a separately fetched header, not EIP-1898 hash-pinned state.

The currently published [event guide](https://ethglobal.com/events/mumbai/info/details)
gives **Sunday 8 November 2026 09:00 IST** as the final submission deadline;
earlier records mentioning 7 November are historical planning snapshots, not
the current decision. No external ETHGlobal submission has been confirmed.

---

## Historical 6 November decision and implementation state


**6 November 2026: the owner explicitly superseded the internal deadline gate and authorized completing the CRE integration.** Presentation preparation governs how the integration is demonstrated. Incomplete challenge qualification is recorded honestly and does not stop the authorized engineering work.

## Active scope

Implement one optional, read-only historical Uniswap pool-identity corroboration: a public evidence manifest, official CRE HTTP and EVM capabilities, exact comparison, a structured output, and a separate Aftercheck report appendix. Keep the existing financial-policy verdict and the ordinary offline workflow independent.

The official SDK workflow, strict validators, manifest generator, report consumer and execution tooling are implemented. The actual workflow has compiled to WASM. The official simulator requires account authentication; a failed authentication attempt is not a successful simulation. Direct HTTP/RPC rehearsal is explicitly labelled `RPC_REHEARSAL`, with no CRE execution claim.

See [CRE_INTEGRATION.md](CRE_INTEGRATION.md) for installation, reproduction, negative cases and limitations, and [READINESS.md](READINESS.md) for the source-bound execution record and remaining work.

## Sponsor evidence remains evidence-based

The [Best workflow with CRE challenge](https://ethglobal.com/events/mumbai/prizes/chainlink) requires meaningful external-data-plus-blockchain use, successful official simulation or deployment, and application consumption. Building WASM, running unit tests or using ordinary RPC does not by itself establish real CRE execution. The sponsor recommendation follows the actual CRE01–CRE05 evidence, not the superseded time gate.

The integration can be included in the presentation with its current execution status shown. Select Chainlink as a qualified third partner only when the official simulation evidence establishes the requirement. No partner form, dashboard selection or submission has been changed by these repository edits.

## Preserved decision history

Before the override, [PR #32](https://github.com/denchik37/aftercheck/pull/32) recorded an audit at 20:07 IST on 6 November, at source `4130c2af7e6b096b8394f423f7e56ecc75da87ab`. That source had no CRE workflow or simulator evidence. The original decision derived a 19:00 IST cutoff from the public 7 November, 09:00 IST submission deadline and stopped optional work. Its [unaltered historical document](https://github.com/denchik37/aftercheck/blob/9464c2fd390a95b5975e17a4add52d5a3e39ab80/docs/CRE_DECISION.md) remains in Git history.

The subsequent owner instruction removes that internal stop rule. It does not alter an external event deadline, invent account access, establish participation, certify Classic input eligibility, or convert a test fixture into sponsor execution evidence. Dated planning and actual implementation records retain their true provenance.
