# Optional Chainlink CRE pool-identity corroboration

Aftercheck's optional CRE workflow compares one historical Uniswap v3 factory
observation with a deliberately public manifest derived from the retained
Sepolia evidence. The result is a separate, inspectable appendix. The original
financial-policy report is regenerated unchanged.

**Engineering status: official local CRE CLI simulation VERIFIED (7 November
2026 IST).** The official SDK workflow compiled into WASM and the authenticated
CRE CLI **1.39.0** produced independently reviewed and source-bound
**MATCH, intentional MISMATCH and UNAVAILABLE** results at revision
`1ad2dd1ba629bd0751748a7451619cfe8c5d488d`. Aftercheck consumed all
three results without changing its core PASS; the original CLI logs and full
result/execution JSONs are published under
[official 7 November simulation evidence](evidence/cre/official-2026-11-07/README.md).
The exact operator-supplied ZIP and its SHA-256 are documented there. This
establishes successful **local** CRE simulation, *not* a deployed DON attestation
or financial-state proof. Earlier direct RPC rehearsals and ordinary tests remain
explicitly different execution classes.

The retained real Node HTTP/RPC runs produced **MATCH, intentional MISMATCH and
HTTP-404 UNAVAILABLE** at source `f7e4048389d3acf85d7c16020b34990c03fde93f`.
Aftercheck consumed all three and preserved its core PASS, VIOLATION and reserve
UNKNOWN reports byte-for-byte. The [execution evidence and sponsor matrix](evidence/cre/README.md)
include the earlier timeout failures and the official CLI authentication failure.

The owner superseded the earlier deadline-derived stop decision and authorized
completion. See [the decision history](CRE_DECISION.md). Presentation proceeds
with the evidence actually available; the integration is not removed merely
because sponsor qualification is incomplete.

## What is compared

| Identity | Exact value |
|---|---|
| Network | Ethereum Sepolia, chain ID `11155111` |
| CRE chain selector | `16015286601757825753` |
| Transaction | `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9` |
| Historical block | `7689923` |
| Retained block hash | `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34` |
| Factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` |
| Token 0 | `0x0f47e03a0383396635846f8495003fc478b71bca` |
| Token 1 | `0x9142fa65aaef921aea2127e88758adee0510a0f0` |
| Fee | `500` |
| Recorded pool | `0x029603931809d430ae47d2f55212cc0e89dbfd52` |
| Evidence SHA-256 | `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093` |

The third-party testnet transaction was executed on 12 February 2025. Its retained
capture was acquired on 5 November 2026. Neither is a newly executed Aftercheck
swap. The public source is pinned to revision
`17ac1368d238f594a6e46728402c298b9e3968f1`; the two generated manifests are hosted at
immutable publication revision `2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d`.

The workflow uses the official SDK's HTTP capability to GET the manifest, then
the Sepolia EVM capability to call `factory.getPool(token0, token1, fee)` at block
`7689923`. It separately requests that numbered block's header and compares its
hash with the retained hash. The [EVM capability](https://docs.chain.link/cre/reference/sdk/evm-client-ts)
uses a **block-number-bound contract call**. The separately matching header does
not convert it to an EIP-1898 block-hash-bound call or authenticate consensus.

The fixed public RPC endpoint is `https://sepolia.gateway.tenderly.co`, the same
provider used for the original capture. This demonstrates a newly obtained
observation through the selected execution path; **provider independence is not
established**. No wallet balance, reserve reconstruction, token safety, original
trading intent or protection of real funds is inferred.

## Data and trust boundaries

1. `scripts/cre-manifest.mjs` parses the genuine evidence, checks its digest and
   receipt identities, evaluates its supported protocol profile and verifies the
   original hash-bound `factory.pool` call. It generates the minimal manifests.
2. `integrations/cre/config.ts` restricts HTTPS to the reviewed repository,
   immutable commit paths and three specific filenames. Credentials, query
   strings, mutable branches, other hosts and whitespace are rejected. The
   [official HTTP capability rejects redirects](https://docs.chain.link/cre/guides/workflow/using-http-client/get-request-ts).
3. The HTTP node callback validates the bounded JSON schema, supported literal
   identities, SHA-256 and the expected manifest before aggregation. SDK 1.23.0
   receives a canonical string because its consensus serializer excludes `null`.
   The agreed string is validated again before any EVM read.
4. If HTTPS fails, the configuration's manifest identifies the requested target
   only. `manifestFetch` remains `UNAVAILABLE` or `INVALID`; local configuration
   cannot substitute for a successful external fetch or yield `MATCH`.
5. The shared comparison checks the configured network, requested block, returned
   header, contract/calldata, strict ABI return and expected address. Missing,
   unsupported and conflicting observations cannot become `MATCH`.
6. `src/corroboration.ts` binds imported results to the original evidence and
   recomputes the comparison. The local result file remains self-reported; it is
   not an authenticated Chainlink or DON attestation. Retained source-bound
   simulator logs provide operational execution evidence separately.

All chain selectors, block numbers, fees and identities use exact strings and
`bigint`; no floating-point financial arithmetic is introduced. JSON parsing
rejects duplicate and prototype-related keys, unsafe numbers, excessive nesting,
extra fields and oversized data. A digest establishes integrity, not authenticity.

## Install the optional toolchain

Ordinary `npm ci`, `npm run verify`, `npm run demo`, CLI replay and the browser
inspector require no CRE package, account or network service. Optional packages
are isolated in `integrations/cre/workflow`; they are absent from the root lockfile.

Versions used for the actual build are CRE CLI **1.39.0**, SDK **1.23.0**, Bun
**1.4.4**, Javy **8.1.0**, Javy plugin **1.7.0**, viem **2.54.2**, noble hashes
**2.2.0**, TypeScript **5.9.3** and Node **24**. SDK/plugin licensing is
**BUSL-1.1 with a nonproduction grant**, separate from Aftercheck's MIT code. See
[third-party notices](../integrations/cre/THIRD_PARTY_NOTICES.md).

On Linux x64 with GLIBC 2.38 or newer (for example Ubuntu 24.04), plus `curl`,
`tar` and `unzip`, the repository installer downloads fixed official releases and
checks their pinned archive SHA-256 values without `sudo` or a shell install pipe:

```bash
node scripts/cre-install-tools.mjs --output /tmp/aftercheck-cre-tools
export PATH="/tmp/aftercheck-cre-tools/bin:$PATH"
npm --prefix integrations/cre/workflow ci --ignore-scripts --no-audit --no-fund
npm run cre:manifest
npm --prefix integrations/cre/workflow run build
```

On other operating systems, follow the official [CLI installation](https://docs.chain.link/cre/getting-started/cli-installation)
and Bun instructions, using those exact versions. The Node operator scripts avoid
shell command construction. `CRE_BIN` can privately identify an installed CLI
executable when it is not on `PATH`.

Generated `config.json`, build products and output directories are ignored.
The wrapper checks that relevant source is committed and unchanged before and
after execution, binds the local manifest bytes to their Git object, and records
the actual source revision. Use a clean checkout with the manifest publication
commit available; Actions uses `fetch-depth: 0`.

On Windows, CRE CLI 1.39.0 can leave `integrations/cre/workflow/.cre_build_tmp.js`
after invoking the official simulator. The exact generated path is ignored and
explicitly permitted by the source-integrity guard; other unexpected generated
or untracked source remains rejected. A previously stopped Windows run can
resume without cloning or reinstalling by downloading
[`scripts/cre-windows-resume.ps1`](../scripts/cre-windows-resume.ps1) and running
it with `-WorkDir <existing-Aftercheck-checkout>`. The runner fast-forwards
`main`, requires previously installed locked dependencies, rebuilds WASM from
that exact revision, uses local CLI authentication, and writes each new attempt into a fresh
`output/cre/resume-*` evidence directory. It never treats an earlier failed
post-check as a verified simulator result.

## Authentication and official simulation

Authenticate on the same machine running the CLI:

```bash
cre login
cre whoami
```

The official login uses a browser callback to localhost on that machine. For
noninteractive Actions, use a privately configured repository secret named
`CRE_API_KEY` if the account has the deploy-access approval required by the
current authentication guide. Browser login remains the ordinary simulation
route. Do not put credentials
in source files, public logs, issues or chat. The [authentication guide](https://docs.chain.link/cre/guides/cli/managing-auth)
describes account and API-key requirements. This read-only integration has no
signing-key setting and never uses `--broadcast`.

Run the positive comparison from the repository root:

```bash
npm run cre:simulate -- --manifest integrations/cre/public/reference.json --manifest-url https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/reference.json --output output/cre/reference
```

The [official CRE logging quota](https://docs.chain.link/cre/service-quotas#logging-quotas)
limits a single workflow log entry to **1 KB**. An unfragmented corroboration
result is approximately 3.3 KB and was observed being truncated on Windows
during authenticated CLI simulation. The workflow now emits 256-byte UTF-8
fragments as lowercase hex with explicit 1-based indices, a total count, and
a SHA-256 of the full canonical JSON. The operator wrapper requires every
fragment to be complete, uniquely numbered, size-bounded and checksum-valid
before applying the original strict schema, manifest, identity, metadata and
comparison checks. Missing or conflicting fragments fail closed; a CLI exit
code 0 alone is never a validated result. Sanitized public logs omit raw
fragments; the fully validated object is kept separately in `result.json`.

The wrapper invokes the actual official command:

```bash
# Working directory: integrations/cre
cre workflow simulate workflow --project-root . --target sepolia --non-interactive --trigger-index 0
```

The wrapper supplies an absolute project-root path at runtime. It records CLI,
SDK and Bun versions, timestamps, command, input digests, source revision, exit
status and sanitized logs. A `result.json` is written only if the CLI exits zero
and exactly one canonical result marker validates against the expected manifest
and execution metadata. Authentication and compilation failures retain a failure
record and cannot produce a successful result artifact. Use a fresh output
directory for every attempt.

The official [simulator](https://docs.chain.link/cre/guides/operations/simulating-workflows)
performs actual endpoint calls in a local execution environment. Successful
simulation is still distinct from a deployed DON attestation or certification.

## Negative and unavailable demonstrations

The intentionally changed fixture uses expectation
`0x0000000000000000000000000000000000000001` and declares
`scenario: INTENTIONAL_MISMATCH`. It is never relabelled as the original capture.

```bash
npm run cre:simulate -- --manifest integrations/cre/public/intentional-mismatch.json --manifest-url https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/intentional-mismatch.json --output output/cre/intentional-mismatch
npm run cre:simulate -- --manifest integrations/cre/public/reference.json --manifest-url https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/unavailable.json --output output/cre/unavailable
```

`unavailable.json` deliberately does not exist at that immutable revision. A
failed fetch yields `UNAVAILABLE` and performs no EVM comparison. Wrong chain,
block, call, header, malformed return values and forged statuses are exercised in
the deterministic tests. They cannot produce a valid historical `MATCH`.

The simulation wrapper exits zero for a successfully executed, validated result
of any comparison status. The status is data. A genuine negative case is not a
process failure; authentication or malformed execution output is.

## Consume the result in Aftercheck

For a ready presentation using the retained real observations, run:

```bash
npm run cre:demo
```

This **offline replay of retained RPC_REHEARSAL** produces five clearly labelled
appendices under `output/cre-demo`: MATCH with PASS, MATCH with VIOLATION, MATCH
with reserve UNKNOWN, intentional MISMATCH, and fetch-failure UNAVAILABLE. It
performs no new HTTP/RPC calls or CRE simulation. Common Node networking entry
points are disabled. The original evidence and core JSON/Markdown remain intact.

To consume a newly captured official simulator result directly:

```bash
npm run cre:consume -- examples/sepolia/evidence.json examples/sepolia/policy-pass.json integrations/cre/public/reference.json output/cre/reference/result.json output/cre/reference/aftercheck
```

The output contains `core/report.json`, `core/report.md`,
`corroboration/report.json` and `corroboration/report.md`. The appendix shows both
the pool actually recorded in the source and the comparison expectation,
provenance, reasons, context and limitations. Use the mismatch manifest/result
for the negative case. Policy alternatives remain
`examples/sepolia/policy-violation.json` and `policy-reserve.json`.

Consumer exit codes describe **external corroboration only**:

| Exit | External comparison |
|---|---|
| `0` | MATCH |
| `2` | MISMATCH; investigate the discrepancy |
| `3` | UNAVAILABLE or UNSUPPORTED |
| `1` | Input, source binding or export rejected |

The independent core verdict remains visible. A corroboration MATCH cannot
upgrade reserve UNKNOWN or override a spending-cap VIOLATION. Imported files
cannot establish that the declared execution actually occurred without the
separate logs and source record.

## Direct RPC rehearsal when simulator authentication is unavailable

`npm run cre:rehearse --` accepts the same manifest, URL and output flags. It
actually fetches the public manifest and reads the fixed public Sepolia endpoint
using ordinary Node HTTP/RPC. It creates the same comparison result shape with
**`RPC_REHEARSAL`** and null CLI/SDK execution versions. It can be consumed by the
same command above, which displays that classification prominently.

This is useful for exercising live data, failure handling and the presentation
path. It does **not** satisfy the sponsor's official CRE execution requirement.
No code path converts an RPC rehearsal or unit fixture into a CRE simulation.

## CI and evidence

[Optional CRE](../.github/workflows/cre.yml) compiles the actual SDK workflow to
WASM and retains its log and hash. On trusted push/manual runs, a separately
configured private API key enables genuine reference, mismatch and unavailable
simulations followed by Aftercheck consumption. Without that key, the artifact
and job summary explicitly record `BLOCKED`, `officialSimulationExecuted:false`.
A successful availability-check job is not proof that a simulation occurred.

The independent core CI runs its normal verification, offline demo and browser
checks. New deterministic tests cover shared parsing/comparison, workflow
boundaries, provenance/output handling and unchanged core financial verdicts.
Actual run IDs, source revisions and the CRE01–CRE05 matrix are retained in
[READINESS.md](READINESS.md) and the [dedicated execution evidence record](evidence/cre/README.md).

## Presentation and attribution

Show the core receipt-scoped PASS, cap VIOLATION and reserve UNKNOWN first. Then
show the separately labelled pool-identity comparison, original versus expected
pool, exact block binding, and mismatch. Use the actual execution classification
visible in the artifact. If authentication remains unresolved, say the official
SDK workflow compiles and the direct RPC path works only where its run record
establishes that; do not call it a successful CRE simulation.

The optional code and tests were implemented with ChatGPT assistance during the
recorded development session. Commit timestamps, build records and acquired
observations retain their actual provenance. Earlier planning is not presented
as newly created software. Organizer acceptance, Classic input eligibility,
human-contribution disclosure and final submission remain separate from these
engineering results.
