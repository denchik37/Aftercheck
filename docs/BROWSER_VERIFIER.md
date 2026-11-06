# Browser financial verification

**Release status, 6 November 2026:** the browser verifier is implemented and has
passed both jobs in
[Verify run 42260012899](https://github.com/denchik37/aftercheck/actions/runs/42260012899)
at source `1b4729ef259e2c4641e21e1b77d4369c3def0ae6`, including **343 Node tests**,
actual Chromium parity and interactive workspace/export checks.
[PR #34](https://github.com/denchik37/aftercheck/pull/34) is the current integration
and check record. **The new verifier is not deployed:** the public root still
serves the previous saved-report viewer. [READINESS.md](READINESS.md) records the
executed evidence; [DIGITALOCEAN_DEPLOYMENT.md](DIGITALOCEAN_DEPLOYMENT.md) preserves
the earlier provider record and the authenticated-access blocker.

## What the browser evaluates

Aftercheck compares a supported Uniswap transaction's retained execution evidence
with a separately supplied financial policy. The browser performs the actual
verification: strict parsing, digest validation, transaction/receipt/block identity
checks, supported-route decoding, protocol observations, event reconciliation and
exact policy comparisons. It does not choose a prepared report based on form values.

The scope remains Ethereum Sepolia, chain `11155111`, direct Uniswap v3
SwapRouter02 `exactInputSingle`, one factory-selected pool, zero native value and
price limit, and full exact input. The [protocol contract](PROTOCOL.md) retains the
precise support restrictions and receipt/plain-token assumptions.

Execution, protocol support, evidence coverage and financial policy verdict are
independent report dimensions. SUCCEEDED can coexist with VIOLATION. Missing,
unsupported or conflicted evidence does not become PASS. A required reserve check
remains UNKNOWN; an independently established violation takes precedence over that
uncertainty in the overall verdict.

## Launch locally

The committed JavaScript files need no browser-side package download. From a
prepared checkout, serve the `web/` directory and open the workspace:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
# Open http://127.0.0.1:8080/inspector.html
```

Use HTTPS or localhost so native Web Crypto is available. Direct `file://` loading
of the workspace's ES modules is not the supported path. The preserved
`web/report-viewer.html` remains a self-contained file for saved-report inspection;
the Node CLI can verify saved evidence without a server or network.

Development checks use Node.js 24+ and the locked TypeScript dependency:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
```

## Transaction lookup and evidence import

One retained public transaction is indexed:

```text
0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9
```

It is a genuine third-party historical Sepolia transaction. The browser's public
`evidence/sepolia.json` is byte-identical to `examples/sepolia/evidence.json`: the
183,990-byte original has SHA-256
`d57013b097c323271d25a021f6244e79a00ec72853dd6aed0828f2a481fe0c36`.
The evidence's canonical payload digest is separately recorded as
`0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093`.
These are different hashes over different byte representations, not competing
claims about the same hash input.

Entering that hash loads the retained file from the same static origin. Schema,
digest, requested transaction and raw receipt identities are checked before the
workspace presents supported observations. The UI says **Historical evidence
replay — not a fresh blockchain inspection**. Loading a static capture does not
refresh the chain, finality or provider observations.

For any other well-formed hash, the interface says **No retained evidence is
available for this transaction** and offers local `evidence.json` import. Importing
a file does not upload it. Its transaction identity must agree with the entered
hash. The same verifier decides whether the imported route and evidence are
supported; a file's presence is not enough to establish a financial result.
Imported `SYNTHETIC_RPC_FIXTURE` evidence is labelled synthetic and simulated in
the UI, canonical report and package instructions; it is not presented as a real
historical execution.

There is no public RPC collector, proxy or server-side verification service. Fresh
read-only inspection remains the CLI's separate `inspect`/`collect` path and
requires a historical RPC provider configured locally.

## Policy inputs and the demonstration

Actual transaction amounts, recipient, router, pool, token addresses, block and
encoded minimum come from validated evidence and supported decoding. The financial
form supplies a separate `aftercheck.policy.v1` object, including chain, owner,
token identities, maximum input, minimum received, expected recipient and an
optional reserve floor. Prefilling identities from the observed swap is a user
convenience; it does not authenticate historical instructions. The initial form
uses the decoded input amount, calldata minimum and recipient, with no reserve
requirement. The retained transaction therefore starts with a minimum of `0`;
enter your own financial requirement rather than treating that starting value as
an authenticated mandate.

The interface and reports label policy provenance **User-supplied retrospective
policy**. A new output floor cannot be attributed to the original trader.

For the retained transaction, enter maximum input `1`, minimum received `0.999`
and the observed recipient using the verified 18-decimal precision. Then change
only the requirement:

| Action | Execution | Financial finding |
|---|---|---|
| Minimum received `0.999` | SUCCEEDED | PASS when the other checks pass |
| Increase minimum to `1` | SUCCEEDED | VIOLATION; actual output is `0.999496253769344460` |
| Restore `0.999`, enable a reserve requirement | SUCCEEDED | UNKNOWN; available receipt evidence does not prove the reserve |
| Keep the reserve requirement and raise the minimum to `1` | SUCCEEDED | VIOLATION overall, with the reserve check separately UNKNOWN |

The evidence digest remains identical throughout. Policy changes produce a new
policy digest. With the stricter output floor, the exact shortfall is
`503746230655540` raw units, or `0.000503746230655540` output-token units under the
verified precision. This says nothing about USD values or the economic equivalence
of the two different tokens. The router's encoded minimum remains `0` raw units;
it is displayed separately from the user's requirement.

The Overview, Policy checks, Evidence and Export views expose the result and its
inputs. Progress labels correspond to actual loading/validation/reconciliation
work. Invalid evidence or policy clears the earlier result and disables export.
The workspace ties asynchronous loads, evaluations and exports to the current
input revision and discards older results. It permits one evaluation in flight
and collapses intermediate edits to the latest pending policy.

## Exact token units and their provenance

Financial conversion uses string parsing and `bigint`, never floating-point
amounts. The policy continues to store canonical uint256 raw-unit strings. Negative
values, scientific notation, ambiguous separators, non-finite forms, excess
fractional precision, excessive input length and overflow are rejected. A zero
minimum or reserve floor is representable; the canonical maximum-input policy
requires a positive amount.

For the original capture, both token contracts' constant 18-decimal implementation
was independently compiled from verified Solidity source. The complete output
runtimes match the original block-bound token-code observations, including compiler
metadata. The browser checks the pinned evidence/chain/transaction/block context,
code-request parameters and runtime SHA-256 before exposing that metadata as
source-verified. [TOKEN_PRECISION.md](TOKEN_PRECISION.md) provides the exact source,
compiler, contracts, hashes and reproduction commands.

The binding is deliberately narrow. Different, incomplete or altered captures do
not inherit it. Raw units remain available, and a user may explicitly choose
unverified display decimals where no authenticated precision applies. Changing
display precision reformats the existing raw requirements; it must not reinterpret
unchanged text as a different financial policy. Exact raw quantities remain
inspectable in every display mode.

The precision evidence is a source-to-retained-runtime correspondence. It is not a
new RPC `decimals()` observation or an independent consensus/finality proof. It
does not establish a token symbol's authenticity, monetary value or reserve state.

## Shared engine and runtime adapters

| Module | Responsibility |
|---|---|
| `json-codec.ts` | Shared bounded JSON parser and canonical serialization; duplicate/prototype keys and unsafe numeric metadata are rejected |
| `evidence-core.ts` | Shared evidence schema and transaction/receipt/block identity validation |
| `uniswap.ts` | The existing route decoder, pinned protocol observations, event reconciliation and exact financial checks |
| `policy.ts`, `values.ts` | Canonical policy normalization and exact raw quantities/identities |
| `verify-core.ts` | Shared report assembly and trust/provenance fields |
| `json.ts`, `verify.ts` | Existing synchronous Node entry point with native `node:crypto` SHA-256 |
| `browser-engine.ts` | Asynchronous browser entry point with native Web Crypto SHA-256 over the same canonical UTF-8 bytes |
| `amounts.ts`, `token-precision.ts` | Display conversion and authenticated precision bindings, separate from raw-unit policy evaluation |
| `browser-export.ts`, `report.ts` | Exact input/output package and shared deterministic Markdown rendering |

The browser snapshots evidence and normalizes policy before asynchronous hashing.
This prevents the caller from changing checked data while crypto is in flight.
Digest validation remains mandatory, including canonical error precedence when
both evidence and policy are invalid. Both adapters then call the same report
assembler and Uniswap verifier. There is no frontend-specific receipt algorithm,
Node crypto polyfill, external JavaScript CDN or extra crypto dependency.

The resulting `aftercheck.report.v1` has the same execution/support/coverage/verdict,
checks, observed raw amounts, router minimum, identities, evidence/policy digests,
limitations and trust fields. The evaluator remains version `0.2.0` because this
work changes runtime access and UI rather than the financial rule set. Full
canonical JSON and Markdown parity are tested, including non-PASS/error cases.

## Verification package and offline replay

The download button creates a standard ZIP locally with six fixed entries:

| File | Role |
|---|---|
| `evidence.json` | Original UTF-8 evidence text actually evaluated, preserved byte-for-byte |
| `policy.json` | Normalized retrospective policy in exact raw units |
| `report.json` | Actual displayed browser verifier result |
| `report.md` | Deterministic rendering from the same report |
| `display-metadata.json` | Supplementary selected precision and its source/user-supplied provenance |
| `README.txt` | Reproduction command, exit codes and trust boundaries |

Before packaging, the exporter independently reruns the shared browser entry point
and rejects a stale or altered report. Canonical report and policy schemas are not
expanded with display preferences. The archive uses STORE entries, fixed filenames,
no directory paths, bounded sizes and normalized timestamps. CRC32 checks archive
integrity; the verifier's SHA-256 digests provide the recorded evidence/policy
integrity comparison.

Prepare the checkout and Node.js locally before going offline. From the checkout,
pass the extracted evidence/policy paths to the existing CLI:

```bash
npm run cli -- verify evidence.json policy.json output/replay
```

Use absolute paths when the extracted package is elsewhere. Expected exit codes
are `0` PASS, `2` VIOLATION, `3` UNKNOWN, and `1` invalid input. Compare the complete
generated `report.json`, `report.md` and normalized `policy.json` with the browser
package. Offline replay needs no RPC, GitHub, npm-registry or Aftercheck-server
request once the local tools and inputs are present.

## Static build and publication boundary

`npm run build:browser` uses the already pinned TypeScript `5.9.3` compiler to
produce native ES2022 modules. The generator follows only an explicit reviewed
local module set, rejects Node runtime references and nonlocal/dynamic imports,
and emits no source maps. `npm run check:browser`, included in `npm run verify`,
rebuilds in memory and rejects stale or unexpected committed assets.

`web/assets/browser-build.json` records every source-file SHA-256, the generator
digest, compiler version, a combined source digest, and each emitted asset's size
and hash. This establishes a reproducible source-to-asset mapping. The deployment
record separately pins the reviewed Git SHA; the manifest's content digest alone
does not identify a unique Git commit or authenticate a provider deployment.

The allowed published set is explicit:

```text
inspector.html
workspace.css
report-viewer.html
evidence/sepolia.json
assets/browser-build.json
assets/browser-workspace.js
assets/browser-engine.js
assets/json-codec.js
assets/evidence-core.js
assets/verify-core.js
assets/uniswap.js
assets/policy.js
assets/values.js
assets/report.js
assets/amounts.js
assets/token-precision.js
assets/browser-export.js
samples/pass.json
samples/input-cap-violation.json
samples/output-threshold-violation.json
samples/reserve-unknown.json
```

The reviewed implementation at `1b4729ef259e2c4641e21e1b77d4369c3def0ae6`
contains **21 public files / 382,709 bytes**. Generated JavaScript and its manifest
account for **13 assets / 104,465 bytes**. The JavaScript build source digest is
`e10bd20375263954c51712e46c807414f1170bc7002fcb37437e8e5ab85704f0`.
The stylesheet and HTML are reviewed source files;
their public bytes are compared with the pinned checkout separately from the
generated-JavaScript manifest. Publication tests reject symlinks and extra files.
The full web tree must remain
below 512 KiB; generated assets have a separate 250,000-byte build budget, individual
modules stay below 128 KiB and the retained capture below 256 KiB. The original
saved-report viewer keeps its exact previous SHA-256. Compiler research sources,
Node collectors, tests, repository metadata and credentials are outside `web/`.

The existing DigitalOcean configuration remains a single Static Site publishing
committed `web/` files, with `inspector.html` as the index and automatic deployment
disabled. There is no build server at runtime and no new paid component.

## Privacy, security and limits

Only same-origin static assets and public retained evidence are fetched. The
hosting/CDN provider sees ordinary requests and associated connection metadata.
Policy values, imported evidence and generated reports stay in browser memory;
they are not sent in requests, URLs, analytics or uploads, and are not persisted
in application storage. Policy re-evaluation and export require no networking.
The application has no wallet API, account, signing or custody path.

The workspace's meta CSP permits scripts, styles and connections only to `'self'`, with
default resources, objects, base-URI changes and forms restricted. It renders
untrusted data as inert text. The bounded strict parser caps evidence at 8,000,000
UTF-8 bytes, 48 levels and 100,000 nodes. Amount text and decimals are separately
bounded; ZIP entries are limited to 8,000,000 bytes each and 16,000,000 bytes total.

An HTML meta CSP is not an HTTP response-header policy. This implementation does
not claim provider-enforced `frame-ancestors`, `X-Frame-Options`, `nosniff` or HSTS
headers without production observations. The legacy fallback viewer retains its
own stricter no-connections CSP and inline self-contained implementation.

An attacker who controls the browser, an extension, the served source or the
original RPC observations remains outside these guarantees. Digest equality proves
integrity relative to retained inputs, not Ethereum consensus, provider honesty,
original trading intent, complete accounting or transaction-boundary reserves.
The application remains experimental and read-only.

## Validation and release evidence

The completed
[Verify run 42260012899](https://github.com/denchik37/aftercheck/actions/runs/42260012899)
tested source `1b4729ef259e2c4641e21e1b77d4369c3def0ae6`; both mandatory jobs
succeeded, as did the corresponding
[PR run 42260023168](https://github.com/denchik37/aftercheck/actions/runs/42260023168). The push run's
[browser artifact](https://github.com/denchik37/aftercheck/actions/runs/42260012899/artifacts/13525285490)
was downloaded and validated. The archive SHA-256 is
`835a5da6a585d04402eb2230798a368a55ac591bfa9c18709388016e1bcc6eaf`.
The actual browser was Chromium **151.0.7922.34**, with Playwright **1.62.0**.

| Check | What it establishes | Executed result at this checkpoint |
|---|---|---|
| Amount/metadata/export unit suites | Exact conversions, context binding, bounded archive generation, stale-report rejection and synthetic provenance | **24 focused tests passed**, included in the full Node suite |
| Independent compiler reproduction | Both complete token runtimes equal the retained bytes | Executed; [result retained](evidence/token-precision/recompilation-result.json) |
| Export tests with an independent ZIP reader and offline CLI | Four real policy cases reproduce full JSON/Markdown/policy bytes, exits `0/2/2/3` | Executed in the focused export suite |
| Complete Node suite and reproducible browser build | Existing regressions plus new engine/publication tests | **343/343 passed**, zero failures; TypeScript and deterministic build check passed |
| `scripts/test-browser-core.py` | Actual Chromium native-crypto reports, Markdown and rejections equal complete Node vectors; networking disabled after bootstrap | **40 cases passed**; zero evaluation requests and page errors; no Node `Buffer` or `process` in the browser |
| `scripts/test-browser-workspace.py --local` | Real input edits, downloads, offline CLI replay, privacy, keyboard interaction and three rendered sizes | **46 checks passed**, including **18 actual downloaded ZIP/offline CLI replays**; **27 screenshots** retained; zero local evaluation requests, page errors or dialogs |
| Saved-report viewer regression | Existing fallback remains compatible and preserves its prior bytes | **75 cases passed**; separate local HTTP harness passed **44 checks, including 36 browser checks** |
| Production verifier workflow | HTTPS/TLS delivery, complete public asset equality, UI behavior and downloaded-package replay at a pinned SHA | Pending authenticated manual deployment |

The first complete browser run at
`54c861b33c507e8dc3522cc84186a7cd8c62a83d` also passed both
[push](https://github.com/denchik37/aftercheck/actions/runs/42259275673) and
[PR](https://github.com/denchik37/aftercheck/actions/runs/42259407155) jobs with
343 Node tests, 40 parity cases, 46 workspace checks, 18 ZIP/CLI replays, 75
fallback-viewer cases and 44 local HTTP checks. Inspection of its **24 workspace
screenshots** found overlapping unit labels, wrapped retained amounts and clipped
precision text at 320px. The correction in `1b4729e` adjusted these layouts and
UNKNOWN wording. The later run above exercises the corrected source and adds an
Export-tab screenshot for each viewport, producing **27 workspace screenshots**.
The refreshed desktop, mobile and 320px screenshots were visually inspected and
accepted, including PASS, pure VIOLATION, reserve UNKNOWN, mixed checks,
custom precision and export.

The workspace harness targets desktop 1280×900, mobile 390×844 and narrow mobile
320×844, recording screenshots, requests, errors, downloaded ZIPs and CLI logs.
Its public mode requires a clean checkout at the full expected revision and
compares the deployed bytes. Provider deployment identity is separately recorded
through authenticated access; the public harness does not claim that authentication.
For the current integration state and checks after this pinned acceptance run,
refer to [PR #34](https://github.com/denchik37/aftercheck/pull/34).

CI prepares a pinned isolated Playwright environment. With it available locally:

```bash
python scripts/test-browser-core.py --out output/browser-core
python scripts/test-browser-workspace.py --local --out output/browser-workspace
```

Production acceptance requires the HTTPS mode after the authorized manual release:

```bash
python scripts/test-browser-workspace.py \
  --url https://aftercheck-g4nsb.ondigitalocean.app/ \
  --expected-revision <full-reviewed-source-SHA> \
  --out output/verifier-production
```

Neither a local pass nor a generated screenshot proves that the new public
application is live. Update the readiness and deployment records from the actual
final CI, provider state and public walkthrough, preserving any failed attempts.
