# DigitalOcean static viewer deployment

**6 November 2026 (IST): production deployment and public verification complete.**
The dedicated static viewer is live at
[`https://aftercheck-g4nsb.ondigitalocean.app/`](https://aftercheck-g4nsb.ondigitalocean.app/).
The authenticated provider record, exact deployed bytes, public TLS/HTTP behavior,
three browser viewports and all four report outcomes were inspected. The release
remains a saved-report viewer with the limitations documented below; it is not an
audited service or protection for real funds.

## Architecture and source boundary

The versioned [app spec](../.do/app.yaml) publishes the existing self-contained
[inspector](../web/inspector.html) and four public historical reports. It uses one
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
