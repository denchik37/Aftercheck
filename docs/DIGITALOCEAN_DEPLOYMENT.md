# DigitalOcean static application deployment

## Browser verifier release status — 6 November 2026

**The browser-native verifier has not been deployed.** The existing public root
[aftercheck-g4nsb.ondigitalocean.app](https://aftercheck-g4nsb.ondigitalocean.app/)
still serves the prior 55,075-byte saved-report viewer, SHA-256
`8fc5fef9b8ea2e52cd9448e1b5d32efc4c41f2f6b8f395260957031d5dcd958a`.
The new implementation passed both mandatory jobs in
[push Verify 42260012899](https://github.com/denchik37/aftercheck/actions/runs/42260012899)
and [PR Verify 42260023168](https://github.com/denchik37/aftercheck/actions/runs/42260023168)
for feature source `1b4729ef259e2c4641e21e1b77d4369c3def0ae6`. The runs establish
**343 Node tests, 40 Chromium/Node parity cases, 46 workspace checks including
18 actual ZIP/offline CLI replays, 75 fallback-viewer cases and 44 local HTTP
checks including 36 browser checks**. The refreshed desktop, mobile and 320px
workspace screenshots were visually reviewed. These are local-HTTP CI results;
manual production release and the public HTTPS walkthrough have not occurred.
[PR #34](https://github.com/denchik37/aftercheck/pull/34) is the authoritative record
for current source, integration and required checks.

Authenticated provider access was unavailable in this execution session. The
connected Browser tool required the originating browser context, and the cloud
DigitalOcean dashboard attempt returned **Site Unavailable**. This is an access
limitation, not evidence that the public application is down. No new deployment
ID, active provider Git SHA, current account estimate or rollback availability has
been authenticated. The previous provider record below is preserved as dated
evidence rather than represented as a fresh dashboard observation.

| Release item | Current recorded state |
|---|---|
| Authorized target | Existing dedicated app `2fb584c9-e7fc-4ab9-8565-8c2d84da13c2` |
| Existing public URL | `https://aftercheck-g4nsb.ondigitalocean.app/` |
| Public behavior observed during this enhancement | Prior saved-report viewer remains served |
| Historical deployment / source | `a0318069-e0fd-4616-a3da-4c8d703feaf7` / `d5414cb43c6d31cc66afd070d14dca4ab9921a75` |
| New verifier deployment ID / source | Pending; no new provider deployment has been established |
| Resource architecture | Existing App Platform Static Site; source `web`, index `inspector.html`, no paid component added |
| Automatic deployment | Remains disabled in the app spec; a push/merge is not a release |
| Recovery reference | Historical deployment above is a candidate; its continued availability must be checked in the authenticated dashboard |
| Rollback execution | Not performed |

### New static asset boundary

The new workspace keeps the existing app configuration. Reviewed, committed files
are served directly; no runtime Node service, database, RPC backend, account,
wallet, signing or analytics is introduced. The original viewer is preserved
byte-for-byte as `report-viewer.html`.

The explicit 21-file publication allowlist now covers `inspector.html`,
`workspace.css`, `report-viewer.html`, the unchanged `evidence/sepolia.json`, four
sample reports, twelve native JavaScript modules and `assets/browser-build.json`. The
[browser implementation guide](BROWSER_VERIFIER.md#static-build-and-publication-boundary)
lists every path. `test/deployment.test.mjs` rejects symlinks and extra files and
enforces a **512 KiB total** limit, **256 KiB evidence** limit and **128 KiB per
module** limit. The deterministic build has an additional **250,000-byte generated
asset** budget. Compiler research inputs and internal repository files are not
published.

The reviewed candidate at `1b4729ef259e2c4641e21e1b77d4369c3def0ae6` measures
**21 files / 382,709 bytes**. Generated JavaScript plus its build manifest measure
**13 assets / 104,465 bytes**, with source digest
`e10bd20375263954c51712e46c807414f1170bc7002fcb37437e8e5ab85704f0`.
These are source/CI measurements, not observations of a new deployment. The
[readiness checkpoint](READINESS.md#browser-verifier-implementation--6-november-2026)
preserves the earlier `54c861b` run, its 24-screenshot layout findings, and the
corrected run's 27-screenshot artifact.

The build manifest records exact source-file hashes, generator digest, pinned
TypeScript version, combined source digest and each emitted asset's size/hash.
`npm run check:browser` rejects stale output. This provides a reproducible content
binding; the release record must still name the exact reviewed Git revision and
the separately authenticated provider deployment. The manifest alone is not a
provider or Git attestation.

The workspace meta CSP changes connection access from `'none'` to `'self'` for
retained same-origin evidence and restricts scripts/styles to `'self'`. Policy input,
imports and generated files stay local. The saved-report fallback retains its old
no-connections CSP. HTML meta CSP does not establish HTTP framing/security headers;
actual provider response headers remain part of production inspection.

The last authenticated dashboard estimate was **$0.00/month** for the earlier
static-only app. This enhancement adds no paid resource or service. The current
account estimate and transfer usage have not been rechecked; the existing
provider's transfer accounting still applies. Historical pricing statements below
are preserved with their original check date.

### Manual promotion and acceptance

1. Review the focused PR, integrate current `main`, and require the complete Node
   and Chromium CI jobs to pass at the exact release source. Inspect the actual
   screenshots and exported-package replay logs. Record the full reviewed SHA.
2. Restore authenticated access to the existing dedicated app. Before deployment,
   record its current deployment/source and confirm the historical recovery
   candidate is still available. Do not create another app or change unrelated
   resources.
3. Use the existing app's manual deployment control for the intended reviewed
   revision. Keep automatic deployment disabled and the component static-only.
   Inspect provider build/deployment logs and wait for the actual live state.
4. Run the new `Production verifier` workflow with the full reviewed source SHA.
   It compares all public asset bytes and exercises actual browser evaluation,
   downloads and offline CLI reproduction. Its equivalent command is:

   ```bash
   python scripts/test-browser-workspace.py \
     --url https://aftercheck-g4nsb.ondigitalocean.app/ \
     --expected-revision <full-reviewed-source-SHA> \
     --out output/verifier-production
   ```

5. Inspect the desktop, mobile and narrow screenshots and the actual downloaded
   PASS/VIOLATION/UNKNOWN packages. Record the authenticated new deployment ID,
   source identity, public HTTPS/TLS results, manifest/asset hashes, CI run and
   rollback reference. Update this status only from those observations.

The new HTTPS harness requires a clean checkout at the expected revision, uses
normal certificate validation, compares reviewed assets, checks unintended paths,
and records UI/privacy/download behavior. It keeps provider identity separate from
public byte equality. A local run, a green build, HTTP 200 or matching HTML alone
does not establish the complete production outcome.

## Preserved saved-report viewer release — 6 November 2026

**Historical scope:** the remainder of this document records the initial viewer
release at `d5414cb43c6d31cc66afd070d14dca4ab9921a75`. Its five-file publication
boundary, old CSP, provider observations and test counts apply to that prior
release. They are not acceptance evidence for the browser-verifier enhancement.

**6 November 2026 (IST): production deployment and public verification complete.**
The dedicated static viewer is live at
[`https://aftercheck-g4nsb.ondigitalocean.app/`](https://aftercheck-g4nsb.ondigitalocean.app/).
The authenticated provider record, exact deployed bytes, public TLS/HTTP behavior,
three browser viewports and all four report outcomes were inspected. The release
remains a saved-report viewer with the limitations documented below; it is not an
audited service or protection for real funds.

## Architecture and source boundary

The versioned [app spec](../.do/app.yaml) published the self-contained
[original inspector at the release SHA](https://github.com/denchik37/aftercheck/blob/d5414cb43c6d31cc66afd070d14dca4ab9921a75/web/inspector.html)
and four public historical reports. It used one
**App Platform Static Site**, with no application service, database, worker,
wallet, report-upload endpoint, analytics, or RPC credentials.

| Setting | Configured value |
|---|---|
| Repository / production branch | `denchik37/aftercheck` / `main` |
| App / static component | `aftercheck` / `inspector` |
| Environment | `html` |
| Source directory | `web` |
| Output directory | `.` relative to that source directory |
| Index document / route | `inspector.html` / `/` |
| Build command | None; committed static files are served directly |
| Automatic deployment | Disabled: `deploy_on_push: false` |
| Catchall document | None; absent paths must return real 404s |
| Production domain | `aftercheck-g4nsb.ondigitalocean.app` |

DigitalOcean's [static HTML documentation](https://docs.digitalocean.com/products/app-platform/getting-started/sample-apps/static-assets/)
supports a custom index document. The [app-spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
and [source-directory documentation](https://docs.digitalocean.com/products/app-platform/how-to/deploy-from-monorepo/)
describe these fields. A Droplet adds an operating system, SSH, firewall and TLS
maintenance without serving an application requirement here. No unrelated cloud
resource or DNS zone is needed.

The publication directory contains only five files, **66,742 bytes** at the initial
implementation: the HTML and `samples/{pass,input-cap-violation,output-threshold-violation,reserve-unknown}.json`.
The Node regression suite enforces that allowlist, rejects symlinks and applies a
128 KiB asset budget. The repository root, evidence archive, tests and scripts
are not the web root. No duplicate `index.html` is maintained.

The public samples are canonical outputs of the existing verifier against the
unchanged historical Sepolia capture and its four committed retrospective
policies. The landing page lets a visitor download a sample and import it through
the normal strict parser, without developer tools. It labels the third-party
transaction's 12 February 2025 execution and 5 November 2026 capture accurately.
The browser does not recompute or authenticate those saved findings.

```bash
# Refresh only the four committed public reports after an intentional source change.
node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/public-samples.mjs --write
# CI checks byte-for-byte agreement with a fresh offline verification.
node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/public-samples.mjs --check
```

## Provider identity, scope and cost

The deployment used the authenticated DigitalOcean dashboard without exposing a
token or credential. It created a dedicated resource and did not access or alter
unrelated infrastructure.

| Provider record | Observed value |
|---|---|
| Project / project ID | `Aftercheck` / `d350d2ff-22f5-4f1c-84f4-ccc14555e7a7` |
| App / app ID | `aftercheck` / `2fb584c9-e7fc-4ab9-8565-8c2d84da13c2` |
| Live deployment ID | `a0318069-e0fd-4616-a3da-4c8d703feaf7` |
| Region / delivery | `blr1` / Global CDN |
| Component | `inspector`, Static Site, source directory `/workspace/web` |
| Provider build | Started 6 November 2026 at 19:39:32 IST; 1m18s total, 2s billable |
| Release source | `d5414cb43c6d31cc66afd070d14dca4ab9921a75` |
| Displayed estimate | **$0.00/month** |
| Account message | Up to three free apps composed only of static sites/functions; additional apps $3/month |

The provider build log showed the viewer and four sample JSON files uploaded, plus
DigitalOcean's generated default `404.html`. There are no application services,
workers, databases, environment variables or secrets. The dashboard showed the
deployment as **Live** and the app as **Healthy**. Its generic Git source is branch
`main`; automatic deploy-on-push is not enabled, and the canonical app spec keeps
`deploy_on_push: false`.

The provider UI did not expose a Git SHA on the inspected deployment screen. Release
identity therefore rests on the authenticated app/deployment IDs, the source selected
for the manual launch, and public HTML/sample bytes that match the clean checkout at
`d5414cb` exactly. This is strong release evidence but is not a provider-signed Git
attestation. The public harness deliberately records
`deploymentIdentityVerified: false` because it has no authenticated provider API
session.

[Pricing checked on 6 November 2026](https://docs.digitalocean.com/products/app-platform/details/pricing/):
the free static allowance includes 1 GiB outbound transfer per app; additional
transfer is **$0.02/GiB**. The displayed estimate is not a hard spending cap.
The five intentional public files total about 65.2 KiB before compression and
headers; actual requests, caching and provider accounting determine transfer.

## Executed release and later promotions

The first production release used reviewed source
[`d5414cb`](https://github.com/denchik37/aftercheck/commit/d5414cb43c6d31cc66afd070d14dca4ab9921a75).
[PR #28](https://github.com/denchik37/aftercheck/pull/28) fixed the provider's
generic-Git template dialect after preserving the rejected-field error. Its PR and
post-merge CI passed before deployment. The authenticated dashboard then launched
the dedicated static component and the operator inspected its build log and live
state.

Production verification ran from a clean checkout at the deployed release SHA:

```bash
python scripts/test-hosted-inspector.py \
  --url https://aftercheck-g4nsb.ondigitalocean.app/ \
  --expected-revision d5414cb43c6d31cc66afd070d14dca4ab9921a75 \
  --out output/hosted-production
```

[Production run 42234449518](https://github.com/denchik37/aftercheck/actions/runs/42234449518)
completed with `PUBLIC_HTTPS: PASS — 45 checks (36 browser checks)`. Artifact
`13509454311` contains the result JSON and 18 screenshots; the downloaded artifact
ZIP SHA-256 is
`2df466e0e09d16670ebf866e117285e8f2d04e394a43d05aefd7cabc8ad777fe`.

For later releases, review and merge a focused PR, record the exact intended SHA,
wait for mandatory CI, and use [Actions → Deploy](https://docs.digitalocean.com/products/app-platform/how-to/manage-deployments/)
manually. Re-run the production workflow with the promoted SHA and inspect its
screenshots before recording completion. Do not enable automatic deployment, add
paid components, or change DNS as an incidental release step.

## Test evidence and production acceptance

The existing offline browser harness is unchanged. The hosted harness can serve
the real `web/` directory over loopback HTTP for CI:

```bash
python scripts/test-hosted-inspector.py --local --out output/hosted-local
```

`--local` explicitly does **not** verify DigitalOcean routing, public accessibility,
TLS, or provider headers. Production used `--url`, which requires HTTPS and a clean
checkout at the full expected SHA. It performed normal certificate/hostname
validation, checked the HTTP redirect, compared served HTML and all samples
byte-for-byte, recorded actual cache/security observations, and required 404s for
unintended paths.

Both modes exercise desktop 1280×900, mobile 390×844 and narrow 320×740 viewports:
sample download, local imports of all four real reports, separate result dimensions,
exact amounts, original-byte download, inspectable hashes/raw JSON, invalid-input
clearing, hostile markup, layout, and post-load network/privacy checks. Initial
public asset requests and explicit sample downloads are recorded separately from
the phase in which every attempted report-processing request is blocked and fails
the test. Browser errors and dialogs also fail the run.

`publicViewerSmokePassed` describes only an HTTPS viewer smoke test. The harness
does not authenticate a DigitalOcean app/deployment ID or the provider's Git SHA;
`deploymentIdentityVerified` always remains false in this script; establish those
facts in the separate authenticated operator record. Matching public bytes alone cannot distinguish two Git
commits with identical web assets.

The production result was **PASS: 45 checks, including 36 browser checks**. The root
returned 200 and exact 55,075-byte HTML SHA-256
`8fc5fef9b8ea2e52cd9448e1b5d32efc4c41f2f6b8f395260957031d5dcd958a`;
HTTP redirected to HTTPS with 301. All three viewports negotiated TLS 1.3 with
normal certificate and hostname validation. The four sample hashes matched the
clean checkout, and all nine unintended paths returned true 404s.

Browser automation imported PASS, both VIOLATION variants and reserve UNKNOWN at
1280×900, 390×844 and 320×740. It recorded no post-load/import requests,
page errors or dialogs. Eighteen screenshots were inspected; the landing and each
outcome remained legible and distinct in every layout. The root response exposed
`cache-control: public,max-age=10,s-maxage=86400`, a 6 November 2026 last-modified
timestamp and `server: cloudflare`; no unsupported security-header claim is made.

The local runtime separately passed verifier and HTTP checks but rejected Chromium
startup with `socket() failed: Operation not permitted`. It produced **no local
browser pass**. The failure was preserved; the successful GitHub Actions production
run is the browser authority. Exact counts, source revision and artifact are recorded
in the [readiness checkpoint](READINESS.md#digitalocean-viewer-deployment--issue-19).

For production, retain all of:

| Evidence | Required observation |
|---|---|
| Provider identity | Dedicated app ID, live deployment ID, timestamp, release-source evidence and app-spec revision |
| Public HTTPS | Actual URL, HTTP 200, HTTP→HTTPS redirect, accepted TLS certificate |
| Source/content | Expected source SHA and matching HTML/sample SHA-256 hashes |
| Browser behavior | Successful desktop/mobile/narrow checks, screenshots, zero import-triggered requests/errors/dialogs |
| Exposure and cache | Unintended paths return 404; actual headers and repeated content checks recorded |
| Release status | Reviewed PR, green mandatory CI, no hidden production/preview distinction |

## Privacy and hosting limitations

Loading the hosted page and choosing a public sample sends ordinary HTTPS requests
to the hosting/CDN provider, which can observe request metadata such as IP address
and public paths. Imported reports are read through the browser file API or pasted
locally; no report data is added to requests, URLs or persistent storage. Closing
the page removes its in-memory display. Original-report download uses a local Blob.
This does not promise protection from a compromised browser, extension, device or
future malicious source deployment.

The existing meta CSP retains `default-src`, `connect-src`, `form-action`,
`object-src`, `base-uri`, `img-src` and `font-src` restrictions to `'none'`.
Inline scripts/styles remain allowed as before. Strict bounded parsing and inert
text rendering remain in place. A `no-referrer` meta policy is added. The application
does not load remote scripts, fonts or tracking assets.

An HTML meta CSP is **not** an HTTP security-header configuration. The current
published App Spec has no documented arbitrary response-header mechanism; no
unsupported `headers` or `_headers` feature is assumed. In particular, this work
does not claim HTTP `frame-ancestors`, `X-Frame-Options`, or `nosniff` enforcement.
Without a framing response policy, embedding/clickjacking protection is not
established. Always open the intended HTTPS origin directly to inspect a report.

DigitalOcean [documents automatic HTTPS upgrades but no automatic HSTS header](https://docs.digitalocean.com/products/app-platform/details/limits/).
The starter hostname uses the HSTS-preloaded `.app` TLD. This is distinct from an
observed `Strict-Transport-Security` response header. The production record did not
observe that header, so this release does not claim it.

[Documented static caching](https://docs.digitalocean.com/products/app-platform/how-to/configure-edge-settings/)
defaults to 24 hours at the CDN and 10 seconds in browsers; redeployment invalidates
caches. Static edge caching cannot be disabled through the app-spec toggle. Check
the actual response bytes after promotion or rollback, not just the dashboard status.

The viewer displays saved findings. Its PASS is receipt-scoped, UNKNOWN remains
unresolved, and successful execution can coexist with VIOLATION. It proves neither
full wallet state nor consensus/finality, and it is not audited or a fund-protection
service. The local verifier remains independently usable without this website.

## Rollback and availability

DigitalOcean supports rollback to any of the **ten latest successful deployments**,
subject to its documented region/database constraints. It restores code,
configuration and app spec. See [the supported rollback procedure](https://docs.digitalocean.com/products/app-platform/how-to/manage-deployments/).

1. Open the dedicated **Aftercheck → Activity** page.
2. Select the previously verified deployment by its recorded deployment ID and
   full source SHA. Use **Rollback**, inspect the changes, and keep automatic
   deployment disabled.
3. Wait for that deployment to become the live app. Verify the provider source SHA.
4. Use a separate clean checkout at the restored revision and repeat the HTTPS
   harness against the actual URL. Compare the expected HTML/sample hashes and
   inspect screenshots before recording recovery.

This is the first verified DigitalOcean deployment. Rollback was not exercised
because there is no earlier verified production target; do not invent one. If this
release fails, correct it through a reviewed revert/fix with green CI and deploy
normally. Once a later release exists, `a0318069-e0fd-4616-a3da-4c8d703feaf7`
at `d5414cb` is the recorded first recovery candidate, subject to retention in the
provider's ten-deployment history. Never rewrite `main` or edit production HTML by
hand.

Check provider availability/deployment status and transfer usage after each release
and before the demo. Repeat the public harness for a functional check; a lone HTTP
200 is insufficient. No paid monitor, external telemetry or scheduled job has been
created by this change.
