# CRE delivery evidence — 6 November 2026

**CRE IMPLEMENTED — QUALIFICATION INCOMPLETE.** The official SDK workflow builds
to WASM and the complete public-manifest → real historical RPC comparison →
Aftercheck appendix path has been exercised. That executed path is explicitly
`RPC_REHEARSAL`. The official CRE CLI stops at account authentication, and no
successful official simulation or deployed DON execution is claimed.

The owner superseded the internal deadline gate. This package supports the
presentation and continued integration work with the achieved status shown.

## Read the current results

| Case | Actual result | Inspectable records |
|---|---|---|
| Public manifest + historical factory read | **RPC_REHEARSAL / MATCH**, HTTP 200, 3 successful read-only RPC requests | [Result](rpc-reference/result.json), [transcript](rpc-reference/transcript.md), [execution](rpc-reference/execution.json) |
| Deliberately changed expected pool | **RPC_REHEARSAL / MISMATCH**, HTTP 200, 3 successful read-only RPC requests | [Result](rpc-intentional-mismatch/result.json), [transcript](rpc-intentional-mismatch/transcript.md), [execution](rpc-intentional-mismatch/execution.json) |
| Intentionally absent public manifest | **RPC_REHEARSAL / UNAVAILABLE**, actual HTTP 404, **zero RPC calls** | [Result](rpc-unavailable/result.json), [transcript](rpc-unavailable/transcript.md), [execution](rpc-unavailable/execution.json) |
| Official CRE CLI attempt | **BLOCKED**, actual CLI exit 1, no result artifact | [Execution](official-reference/execution.json), [stdout](official-reference/stdout.txt), [stderr](official-reference/stderr.txt) |
| Actual SDK WASM build | **PASS**, exit 0; SDK 1.23.0, Bun 1.4.4, Javy 8.1.0 | [Build record and hashes](build/build.json), [compiler log](build/compiler.txt) |
| Official CLI/Bun installation | **PASS**, exit 0, archive and installed-executable hashes checked | [Toolchain](toolchain/installed-tools.json), [installer record](toolchain/installer-success.json), [log](toolchain/installer-success.txt) |

The reference and negative reads both returned pool
`0x029603931809d430ae47d2f55212cc0e89dbfd52`. The intentional negative fixture
compares it with `0x0000000000000000000000000000000000000001`. That changed
expectation is clearly marked; it is not a historical protocol defect.

All current live rehearsal records use source
`f7e4048389d3acf85d7c16020b34990c03fde93f`. Their actual chain ID is `11155111`,
requested block is `7689923`, returned header hash is
`0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34`, and the factory
is `0x0227628f3f023bb0b980b67d528571c95c6dac1c`. Exact calldata, byte hashes,
timestamps and request/response fields remain in the records.

## Actual Aftercheck consumption

The [consumption record](consumption.json) captures real consumer commands at
`f7e4048`. Both core JSON **and Markdown** were compared byte-for-byte with the
independent offline demo output and remained identical in every case.

| Imported corroboration | Unchanged core result | Rendered appendix |
|---|---|---|
| MATCH | PASS | [Reference](consumed/reference/corroboration/report.md) |
| MATCH | VIOLATION | [Input-cap violation remains visible](consumed/reference-violation/corroboration/report.md) |
| MATCH | UNKNOWN | [Reserve uncertainty remains visible](consumed/reference-reserve/corroboration/report.md) |
| INTENTIONAL_MISMATCH | PASS | [Negative comparison](consumed/intentional-mismatch/corroboration/report.md) |
| UNAVAILABLE | PASS | [Unavailable external evidence](consumed/unavailable/corroboration/report.md) |

Run `npm run cre:demo` to reproduce those five appendices from the retained
records, without networking or CRE packages. The command says **OFFLINE REPLAY
OF RETAINED RPC_REHEARSAL**; it does not obtain fresh data or run CRE. The
[ordinary core demo log](core/demo.txt) retains the original receipt-scoped
PASS / VIOLATION / UNKNOWN demonstration.

## Sponsor matrix

| Requirement | Status | Exact evidence and remaining gap |
|---|---|---|
| CRE01 — meaningful CRE integration | **BLOCKED** | Official HTTP + historical EVM workflow is implemented and compiles. Real ordinary HTTP/RPC dataflow is verified above. Actual capability execution through CRE remains blocked by CRE02. |
| CRE02 — real official execution | **BLOCKED** | Official CLI 1.39.0 reports no login or CRE_API_KEY and exits 1. No qualifying simulation or deployment is recorded. |
| CRE03 — application consumption | **PASS** | The actual consumer validates retained real RPC_REHEARSAL outputs, exposes the deliberate mismatch and preserves all core outcomes. Consumption of a genuinely executed CRE result remains dependent on CRE02. |
| CRE04 — complete qualifying reproduction | **BLOCKED** | Public source, immutable manifests, locked dependencies, checked installer, commands, build logs and rehearsal outputs exist. A successful official simulator run and its complete result must still be reproduced after authentication. |
| CRE05 — accurate representation | **PASS** | Artifacts distinguish UNIT_TEST, RPC_REHEARSAL, compiler success and official authentication failure. The same-provider, number-bound-read and self-reported-result limitations remain explicit. |

**Do not describe this as completed Chainlink prize qualification.** Include the
implemented integration in the presentation with its current status. Selecting
Chainlink as a qualified third partner requires successful official simulation
evidence. No dashboard selection, form submission, new transaction or deployment
was performed by this engineering work.

## CI evidence and source boundaries

| Checkpoint | Actual verification |
|---|---|
| `ec92456bc401d2c30eff44900ceb634c0d0c7310` | [Verify 42243860373](https://github.com/denchik37/aftercheck/actions/runs/42243860373): TypeScript, **272 tests**, offline core demo, **75 offline browser cases**, **44 local HTTP checks**. Both job logs were inspected. |
| Same source | [Optional CRE 42243860686](https://github.com/denchik37/aftercheck/actions/runs/42243860686): actual SDK WASM build passed. Authentication check recorded BLOCKED; simulator execution steps were skipped. Its green workflow status is not simulation success. |
| `f7e4048389d3acf85d7c16020b34990c03fde93f` | [Optional CRE 42244604852](https://github.com/denchik37/aftercheck/actions/runs/42244604852): actual SDK build passed; authentication still unavailable. [Core verification 42244604886](https://github.com/denchik37/aftercheck/actions/runs/42244604886) passed TypeScript, **272 tests**, the three core demo cases, **75 offline browser cases** and **44 local HTTP checks**; both job logs were inspected. |

The official CLI attempt and local build record were produced at `ec92456…`.
The next code change, `f7e4048`, adjusted only the optional Node rehearsal's
bounded RPC timeout. It did not change the CRE workflow, shared comparator or
consumer. The current live rehearsal and consumption records identify `f7e4048`
directly. Later presentation/documentation commits do not relabel earlier
observations as later executions; their own CI records cover their source.

Historical evidence is pinned to `17ac1368d238f594a6e46728402c298b9e3968f1`;
manifest publication is pinned to `2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d`.
The [machine-readable index](index.json) records every copied file's byte length
and SHA-256. Log filenames use `.txt` for publication; their contents and the
original execution-record hashes are preserved. Commands retain the paths used
during execution. No SDK executable or compiled binary is redistributed here.

## Failures preserved and corrected

- The first actual workflow build rejected a null-valued consensus envelope.
  [Original compiler error](failures/workflow-initial-build-failure.txt). The
  correction uses a validated canonical manifest string or fixed error code,
  supported by SDK 1.23.0, and revalidates the aggregation result.
- The first installer could not rename a binary across separate filesystems.
  [Original failure record](failures/installer-initial-failure.json). Exclusive
  copying, checksum verification and a full actual rerun succeeded.
- Two actual negative-case attempts reached HTTP 200 and correct chain ID, but
  their historical-header read hit the eight-second RPC timeout. They accurately
  remain [UNAVAILABLE attempt 1](prior-attempts/header-timeout-1/execution.json)
  and [UNAVAILABLE attempt 2](prior-attempts/header-timeout-2/execution.json).
  The correction allowed the existing transport's 15-second per-call maximum
  and a 60-second total budget. A fresh committed-source run then produced
  MISMATCH. The earlier [reference MATCH](prior-attempts/rpc-reference-8s/execution.json)
  and [404 UNAVAILABLE](prior-attempts/http-unavailable-8s/execution.json) are also retained.

## Remaining work

1. Authenticate the official CLI with `cre login` on its execution machine, or
   privately configure an eligible `CRE_API_KEY` for the prepared Actions path.
   Current API-key access requires approved deploy access. No signing key is
   required for this read-only workflow.
2. Run the documented official reference, intentional-mismatch and unavailable
   cases. Resolve any actual simulator/capability issue and retain logs with the
   exact source revision. Compilation cannot pre-certify that execution.
3. Consume those real CRE results, update CRE01–CRE04 from the actual evidence,
   and use the successful source-bound run in the sponsor presentation.

Source and account authentication do not prove Ethereum consensus, independent
RPC providers, transaction-boundary balances/reserves, audited protection,
organizer eligibility or final sponsor acceptance.
