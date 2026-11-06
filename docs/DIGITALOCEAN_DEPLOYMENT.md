# DigitalOcean static viewer deployment

**6 November 2026 (IST): deployment prepared; production remains unexecuted.**
There is no verified Aftercheck DigitalOcean app ID, deployment ID, or public URL
from this execution. Account access and free-tier eligibility are not established.
Keep [Issue #19](https://github.com/denchik37/aftercheck/issues/19) open until the
provider deployment and public HTTPS tests below actually pass.

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
| Initial domain | Actual DigitalOcean-assigned hostname; not yet available |

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

## Access and cost gate

The available integrations contained no DigitalOcean connector. The execution
environment initially had no `doctl` installation, authentication configuration,
or DigitalOcean token. The cloud browser returned **Site Unavailable / Unable to
access this site** for the Apps dashboard, including after one reload. This is a
limitation of that session, not evidence that DigitalOcean is down.

Official `doctl` **v2.3.0** was subsequently downloaded and checked against the
release's SHA-256. Its credential-free schema check passed:

```bash
doctl apps spec validate .do/app.yaml --schema-only
```

Full account-aware validation failed with the actual error:

```text
Error: Unable to initialize DigitalOcean API client: access token is required. (hint: run 'doctl auth init')
```

Schema validation establishes recognized field names/types and valid YAML. It
does not establish account access, an eligible free slot, repository integration,
successful provider build detection, or a live URL. CI repeats the same official
schema check without a token.

**Required external action:** provide an authorized DigitalOcean account session
accessible to the operator performing the deployment. Use official sign-in or a
privately configured `doctl` session. Never put a token, password, key, or recovery
code in chat, GitHub, terminal transcripts, or the public app spec. Restrict any
GitHub integration to this public Aftercheck repository.

With that authenticated session, run this non-provisioning preflight:

```bash
doctl apps propose --spec .do/app.yaml --output json
```

Do not specify an existing app ID: this proposal is for a new dedicated app.
Confirm `app_is_static`, `existing_static_apps`, `max_free_static_apps`, and any
reported `app_cost`. If a dedicated Aftercheck app already exists, establish its
identity and authorization before using it; do not repurpose another project.

[Pricing checked on 6 November 2026](https://docs.digitalocean.com/products/app-platform/details/pricing/):
up to three static-only apps are free, with 1 GiB outbound transfer per app.
Additional transfer is **$0.02/GiB**; a static-only app beyond the free allowance
is **$3/month**. The account's available allowance is still unknown. No resource
was provisioned and no deployment cost was incurred by this work.

This is not a hard spending cap. The current five files total about 65.2 KiB before
compression and headers; roughly 16,000 uncached downloads of the entire set use
1 GiB. Actual requests, caching, compression and provider accounting determine
transfer. Check the account's usage/billing controls before launch. Stop for owner
cost authorization if the free slot is unavailable or a paid component is proposed.

## Release procedure — not yet executed

1. Review the focused PR and obtain green **Verify** CI for the exact intended
   source. Preserve branch rules and required checks. Merge to `main` only under
   the authorized free static hosting path.
2. Record the full reviewed `main` SHA and confirm that it has not advanced before
   deployment. Keep automatic deployment disabled. A push alone is not a release gate.
3. Complete the account/cost preflight above. Create a **dedicated Aftercheck static
   app** from `.do/app.yaml`, with no environment secrets or added paid components:

   ```bash
   doctl apps create --spec .do/app.yaml --wait
   ```

   Alternatively configure the exact settings in the DigitalOcean Apps dashboard.
   If a GitHub authorization step is needed, grant only the intended repository access.
4. Inspect the provider's build/deployment logs. The written documentation supports
   `inspector.html` directly; actual provider build detection is still untested.
   If detection fails, preserve its error and make a separate minimal packaging fix.
   Do not silently add a Node service or duplicate the application.
5. In **Activity**, identify the deployment marked **Live app** and its source commit.
   Record app ID, deployment ID, timestamp, spec revision and the actual assigned URL.
   A component configured for `main` is not proof of the deployed SHA. If it differs
   from the reviewed SHA, verify the actual revision and CI before claiming release.
6. Run the public HTTPS harness from a clean checkout at that exact source revision.
   Use the actual assigned root URL in place of the placeholder:

   ```bash
   python scripts/test-hosted-inspector.py \
     --url https://ACTUAL-ASSIGNED-HOST/ \
     --expected-revision FULL_40_CHARACTER_SOURCE_SHA \
     --out output/hosted-production
   ```

   The script uses the pinned Python Playwright requirement in
   `test/browser-requirements.txt` and Chromium. The existing CI browser setup shows
   installation in an isolated virtual environment. `--chromium` can select an
   already installed compatible Chromium executable.
7. Inspect `hosted-results.json` and its actual screenshots. Preserve the public
   deployment logs and identity record after checking them for credentials. Record
   the URL and tested SHA in this runbook and update Issue #19 only after success.

For later releases, [Actions → Deploy](https://docs.digitalocean.com/products/app-platform/how-to/manage-deployments/)
pulls the latest source from the configured branch. Repeat the exact-revision and
CI gate before each manual promotion. No custom domain or DNS change is required.

## Test evidence and production acceptance

The existing offline browser harness is unchanged. The additional harness serves
the real `web/` directory over loopback HTTP for CI:

```bash
python scripts/test-hosted-inspector.py --local --out output/hosted-local
```

`--local` explicitly does **not** verify DigitalOcean routing, public accessibility,
TLS, or provider headers. `--url` requires HTTPS and a clean checkout at the full
expected SHA. It performs normal certificate/hostname validation, checks the HTTP
redirect, compares served HTML and all samples byte-for-byte, records actual
security/cache headers, and requires 404s for unintended paths.

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

The initial local runtime could run verifier and HTTP checks but rejected Chromium
startup with `socket() failed: Operation not permitted`. It produced **no local
browser pass**. The failure was preserved; GitHub Actions is used for the actual
browser execution. The final executed counts, source revision and CI artifacts
are recorded in the [readiness checkpoint](READINESS.md#digitalocean-viewer-deployment--issue-19).

For production, retain all of:

| Evidence | Required observation |
|---|---|
| Provider identity | Dedicated app ID, live deployment ID, timestamp, actual source SHA, app-spec revision |
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
observed `Strict-Transport-Security` response header, which the harness records
without inventing it. Provider headers remain unobserved until deployment.

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

No previous verified DigitalOcean deployment exists in this record, so a production
rollback has not been exercised and there is no rollback target to invent. For a
first-release failure, do not advertise the URL until it is corrected and verified.
If an older good deployment is outside the rollback history, restore its code by a
reviewed revert PR with green CI and deploy normally; never rewrite `main` or edit
production HTML by hand.

Check provider availability/deployment status and transfer usage after each release
and before the demo. Repeat the public harness for a functional check; a lone HTTP
200 is insufficient. No paid monitor, external telemetry or scheduled job has been
created by this change.
