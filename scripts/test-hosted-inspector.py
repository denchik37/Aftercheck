#!/usr/bin/env python3
"""Exercise the actual static HTTP(S) viewer, without uploading imported reports.

Local: python scripts/test-hosted-inspector.py --local --out output/hosted-local
Public: python scripts/test-hosted-inspector.py --url https://ACTUAL-HOST/ \
          --expected-revision FULL_COMMIT_SHA --out output/hosted-production

--local serves only web/ on an ephemeral loopback port, mapping / to the configured
inspector.html index. It does not establish DigitalOcean routing, TLS, or headers.
--url requires a clean checkout at the expected commit and uses normal certificate
validation in both urllib and Chromium. Public requests contain only public asset
paths. All attempted browser requests during report import are recorded and blocked.
The harness verifies the served viewer; DigitalOcean app/deployment identifiers and
the provider's source commit require a separate authenticated deployment record.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import re
import ssl
import subprocess
import sys
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
CASES = {
    "pass": ("PASS", "COMPLETE", None),
    "input-cap-violation": ("VIOLATION", "COMPLETE", "maxInputRaw"),
    "output-threshold-violation": ("VIOLATION", "COMPLETE", "minReceivedRaw"),
    "reserve-unknown": ("UNKNOWN", "PARTIAL", "reserveFloorRaw"),
}
HEADER_NAMES = [
    "content-type", "content-length", "cache-control", "age", "etag",
    "last-modified", "expires", "content-security-policy", "x-frame-options",
    "x-content-type-options", "referrer-policy", "strict-transport-security",
    "server", "location",
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def run(*command: str) -> str:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=45)
    if completed.returncode != 0:
        raise RuntimeError(f"{command[0]} exited {completed.returncode}: {completed.stderr.strip()}")
    return completed.stdout


def make_reports() -> dict[str, bytes]:
    """Generate the four public historical cases through the unchanged verifier."""
    source = """
import './scripts/offline-guard.mjs';
import {readFileSync} from 'node:fs';
import {parseEvidence} from './src/evidence.ts';
import {parsePolicy} from './src/policy.ts';
import {verifyEvidence} from './src/verify.ts';
import {canonicalJson} from './src/json.ts';
const evidence=parseEvidence(JSON.parse(readFileSync('examples/sepolia/evidence.json','utf8')));
const cases={pass:'pass','input-cap-violation':'violation',
  'output-threshold-violation':'output-threshold','reserve-unknown':'reserve'};
const output={};
for(const [name,policyName] of Object.entries(cases)) {
  const policy=parsePolicy(JSON.parse(readFileSync(`examples/sepolia/policy-${policyName}.json`,'utf8')));
  output[name]=canonicalJson(verifyEvidence(evidence,policy))+'\\n';
}
console.log(JSON.stringify(output));
"""
    serialized = json.loads(run("node", "--disable-warning=ExperimentalWarning",
                                "--experimental-strip-types", "--input-type=module", "-e", source))
    return {name: value.encode("utf-8") for name, value in serialized.items()}


class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.path = "/inspector.html"
        super().do_GET()

    def do_HEAD(self):
        if self.path == "/":
            self.path = "/inspector.html"
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404, "Directory listing is disabled")
        return None

    def log_message(self, format, *args):
        pass


class SameOriginRedirect(HTTPRedirectHandler):
    def __init__(self, origin: str, follow: bool):
        self.origin = urlsplit(origin)
        self.follow = follow

    def redirect_request(self, request, fp, code, message, headers, new_url):
        if not self.follow:
            return None
        destination = urlsplit(new_url)
        require((destination.scheme, destination.netloc) == (self.origin.scheme, self.origin.netloc),
                "Unexpected cross-origin or HTTPS downgrade redirect")
        return super().redirect_request(request, fp, code, message, headers, new_url)


def retrieve(url: str, origin: str, follow: bool = True) -> tuple[dict, bytes]:
    opener = build_opener(HTTPSHandler(context=ssl.create_default_context()),
                          SameOriginRedirect(origin, follow))
    request = Request(url, headers={"User-Agent": "Aftercheck-deployment-smoke/1", "Accept-Encoding": "identity"})
    try:
        response = opener.open(request, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        body = response.read(4 * 1024 * 1024 + 1)
        require(len(body) <= 4 * 1024 * 1024, "Public response exceeds the smoke-test bound")
        record = {
            "requestedUrl": url, "finalUrl": response.geturl(), "status": response.getcode(),
            "sha256": sha256(body), "bytes": len(body),
            "headers": {key: response.headers[key] for key in HEADER_NAMES if key in response.headers},
            "setsCookie": "set-cookie" in response.headers,
        }
    return record, body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--local", action="store_true", help="Serve the real web/ directory on loopback; no production claims")
    target.add_argument("--url", help="Actual public HTTPS root URL, with no credentials, query, or fragment")
    parser.add_argument("--expected-revision", help="Full source commit SHA; public mode defaults to clean HEAD")
    parser.add_argument("--out", type=Path, default=Path("output/hosted"))
    parser.add_argument("--chromium", default=os.environ.get("AFTERCHECK_CHROMIUM_EXECUTABLE"))
    args = parser.parse_args()
    if args.expected_revision and not re.fullmatch(r"[0-9a-f]{40}", args.expected_revision):
        parser.error("--expected-revision must be a full lowercase commit SHA")
    if args.url:
        try:
            parsed = urlsplit(args.url)
            invalid = (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
                       or parsed.password is not None or parsed.query or parsed.fragment
                       or parsed.path not in ("", "/") or parsed.port not in (None, 443))
        except ValueError:
            invalid = True
        if invalid:
            parser.error("--url must be the public HTTPS root without credentials, query, fragment, or a custom port")
        hostname = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
        args.url = f"https://{hostname}/"
    out = args.out.resolve()
    if (out == ROOT or ROOT in out.parents) and out != ROOT / "output" and ROOT / "output" not in out.parents:
        parser.error("Keep generated artifacts inside ignored output/ or outside the repository")
    out.mkdir(parents=True, exist_ok=True)
    mode = "LOCAL_HTTP" if args.local else "PUBLIC_HTTPS"
    summary = {
        "startedAt": datetime.now(timezone.utc).isoformat(), "mode": mode, "result": "FAIL",
        "publicViewerSmokePassed": False, "deploymentIdentityVerified": False,
        "deploymentIdentityLimitation": "DigitalOcean app/deployment IDs and provider source SHA require a separate authenticated deployment record.",
        "harnessSha256": sha256(Path(__file__).read_bytes()),
        "runtime": {"python": sys.version, "playwright": importlib.metadata.version("playwright")},
        "checks": [], "http": [], "screenshots": [], "requests": [], "postLoadRequests": [],
        "pageErrors": [], "dialogs": [], "tls": {"result": "NOT_TESTED_LOCAL_HTTP" if args.local else "NOT_EXECUTED"},
    }
    server = browser = playwright = page = None
    device = "startup"

    def checked(scope: str, name: str) -> None:
        summary["checks"].append({"scope": scope, "case": name, "result": "PASS"})

    def snapshot(name: str, full_page: bool = False) -> None:
        filename = f"{device}-{name}{'-full' if full_page else ''}.png"
        page.screenshot(path=str(out / filename), full_page=full_page)
        summary["screenshots"].append(filename)

    try:
        commit = run("git", "rev-parse", "HEAD").strip()
        dirty = bool(run("git", "status", "--porcelain"))
        expected = args.expected_revision or commit
        summary.update(sourceCommit=commit, expectedCommit=expected, workingTreeHasChanges=dirty)
        require(commit == expected, "Check out the expected source commit before testing this deployment")
        if args.url:
            require(not dirty, "Public release verification requires a clean checkout at the expected commit")
        html_bytes = (WEB / "inspector.html").read_bytes()
        summary["inspectorSha256"] = sha256(html_bytes)
        payloads = make_reports()
        reports = {name: json.loads(data) for name, data in payloads.items()}
        for name, (verdict, coverage, primary) in CASES.items():
            report = reports[name]
            require((report["execution"], report["support"], report["coverage"], report["verdict"],
                     report["evidenceClass"], report["policySource"]) ==
                    ("SUCCEEDED", "SUPPORTED", coverage, verdict, "RPC_RECEIPT", "SUPPLIED_RETROSPECTIVE"),
                    f"Historical verifier baseline changed: {name}")
            if primary:
                require(any(check["id"] == primary and check["result"] == verdict for check in report["checks"]),
                        f"Expected financial requirement is absent: {name}")
            require((WEB / "samples" / f"{name}.json").read_bytes() == payloads[name],
                    f"Published sample is not the deterministic verifier output: {name}")
            (out / f"{name}-report.json").write_bytes(payloads[name])
        require(len({report["evidenceDigest"] for report in reports.values()}) == 1, "Historical evidence changed between cases")
        summary["reports"] = {name: {"sha256": sha256(payloads[name]), **{field: report[field] for field in
                              ["execution", "support", "coverage", "verdict", "evidenceDigest", "policyDigest"]}}
                              for name, report in reports.items()}
        checked("source", "four public samples exactly reproduce the real offline verifier")
        if args.local:
            server = ThreadingHTTPServer(("127.0.0.1", 0), StaticHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            url = f"http://127.0.0.1:{server.server_port}/"
        else:
            url = args.url
        summary["url"] = url
        root_response, root_body = retrieve(url, url)
        summary["http"].append(root_response)
        require(root_response["status"] == 200, "Root did not return HTTP 200")
        require(root_body == html_bytes, "Served HTML does not match the tested source bytes")
        require("text/html" in root_response["headers"].get("content-type", ""), "Root has the wrong content type")
        checked("http", "root serves the exact inspector source as HTML")
        second_response, second_body = retrieve(url, url)
        summary["http"].append(second_response)
        require(second_response["status"] == 200 and second_body == root_body, "Repeated retrieval served different or stale content")
        checked("http", "repeated root retrieval is stable; actual cache headers recorded")
        sample_urls = {name: urljoin(url, f"samples/{name}.json") for name in CASES}
        for name, sample_url in sample_urls.items():
            record, body = retrieve(sample_url, url)
            summary["http"].append(record)
            require(record["status"] == 200 and body == payloads[name], f"Published sample is unavailable or stale: {name}")
            checked("http", f"{name} sample serves exact verifier-produced bytes")
        for path in [".git/config", ".env", ".env.local", "package.json", "src/verify.ts",
                     "scripts/test-hosted-inspector.py", "test/inspector.test.mjs", "inspector.html.map",
                     "api/upload", "aftercheck-missing-route"]:
            record, _ = retrieve(urljoin(url, path), url)
            summary["http"].append(record)
            require(record["status"] == 404, f"Unintended public route or catchall response at {path}")
        checked("http", "known source, credentials, upload, map, and missing routes return real 404s")
        if args.url:
            http_url = "http://" + url.removeprefix("https://")
            record, _ = retrieve(http_url, url, follow=False)
            summary["http"].append(record)
            require(record["status"] in (301, 302, 307, 308), "HTTP is not redirected to HTTPS")
            require(urljoin(http_url, record["headers"].get("location", "")) == url, "HTTP redirect does not target the expected HTTPS root")
            summary["tls"] = {"result": "CERTIFICATE_VALIDATED", "urllib": "Default certificate and hostname verification", "browsers": []}
            checked("http", "HTTPS certificate validation succeeds and HTTP redirects to the HTTPS root")

        playwright = sync_playwright().start()
        options = {"headless": True, "args": ["--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-sync", "--no-first-run", "--disable-extensions"]}
        if args.chromium:
            options["executable_path"] = args.chromium
        browser = playwright.chromium.launch(**options)
        summary["runtime"]["chromium"] = browser.version
        for device, width, height in [("desktop", 1280, 900), ("mobile", 390, 844), ("narrow", 320, 740)]:
            context = browser.new_context(viewport={"width": width, "height": height},
                                          is_mobile=device != "desktop", has_touch=device != "desktop",
                                          accept_downloads=True, service_workers="block", ignore_https_errors=False)
            phase = {"name": "navigation"}
            unexpected = []

            def route_request(route):
                request = route.request
                event = {"device": device, "phase": phase["name"], "url": request.url,
                         "method": request.method, "resourceType": request.resource_type}
                summary["requests"].append(event)
                if phase["name"] == "imports":
                    summary["postLoadRequests"].append(event)
                    route.abort("blockedbyclient")
                elif request.url not in {url, *sample_urls.values()} or request.method != "GET":
                    unexpected.append(event)
                    route.abort("blockedbyclient")
                else:
                    route.continue_()

            def block_socket(socket):
                event = {"device": device, "phase": phase["name"], "url": socket.url, "resourceType": "websocket"}
                unexpected.append(event)
                if phase["name"] == "imports":
                    summary["postLoadRequests"].append(event)
                socket.close()

            context.route("**/*", route_request)
            context.route_web_socket("**/*", block_socket)
            page = context.new_page()
            page.on("pageerror", lambda error: summary["pageErrors"].append({"device": device, "message": str(error)}))

            def dismiss_dialog(dialog):
                summary["dialogs"].append({"device": device, "message": dialog.message})
                dialog.dismiss()

            page.on("dialog", dismiss_dialog)
            response = page.goto(url, wait_until="networkidle", timeout=30_000)
            require(response is not None and response.status == 200, "Browser root request failed")
            require(page.url == url and response.body() == html_bytes, "Browser served a different origin or HTML revision")
            if args.url:
                details = response.security_details()
                require(details is not None, "Browser did not report TLS details for the public origin")
                summary["tls"]["browsers"].append({"device": device, **details})
            expect(page).to_have_title(re.compile("Aftercheck"))
            expect(page.locator("#empty-state")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()

            def no_overflow():
                sizes = page.evaluate("({viewport:innerWidth,page:document.documentElement.scrollWidth})")
                require(sizes["page"] <= sizes["viewport"], f"Horizontal page overflow: {sizes}")

            no_overflow()
            snapshot("landing")
            checked(device, "actual root navigation, initial application state, and layout")
            csp = page.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute("content") or ""
            for directive in ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "object-src 'none'", "base-uri 'none'", "img-src 'none'", "font-src 'none'"]:
                require(directive in [part.strip() for part in csp.split(";")], f"Missing CSP restriction: {directive}")
            require(page.locator("script[src], link[rel=stylesheet][href], iframe").count() == 0, "Unexpected remote asset or embedded application")
            summary["documentCsp"] = csp
            checked(device, "document CSP restrictions and self-contained application assets")
            for name in CASES:
                expect(page.locator(f'a[href="samples/{name}.json"]')).to_be_visible()
            phase["name"] = "sample_download"
            with page.expect_download(timeout=10_000) as pending:
                page.locator('a[href="samples/output-threshold-violation.json"]').click()
            downloaded = out / f"{device}-public-sample.json"
            pending.value.save_as(downloaded)
            require(downloaded.read_bytes() == payloads["output-threshold-violation"], "Sample link downloaded different report bytes")
            require(page.url == url, "Public sample download unexpectedly navigated away from the application")
            checked(device, "explicit public sample download works without developer tools")
            phase["name"] = "imports"

            def upload(data: bytes, name: str):
                page.locator("#report-file").set_input_files({"name": name, "mimeType": "application/json", "buffer": data})

            def show(name: str):
                upload(payloads[name], name + ".json")
                expect(page.locator("#report")).to_be_visible()
                expect(page.locator("#outcome-summary")).to_be_focused()
                for field in ["execution", "support", "coverage", "verdict"]:
                    expect(page.locator("#" + field)).to_have_text(reports[name][field])

            for name, (_, _, primary) in CASES.items():
                show(name)
                expect(page.locator("#execution")).to_be_in_viewport()
                expect(page.locator("#verdict")).to_be_in_viewport()
                expect(page.locator(".display-only")).to_contain_text("does not recompute")
                expect(page.locator("#policy-context")).to_contain_text("Retrospective")
                expect(page.locator("#limitations")).to_be_visible()
                if primary:
                    expect(page.locator("#primary-requirement")).to_contain_text(primary)
                    expect(page.locator("#attention-checks")).to_contain_text(primary)
                for selector, field in [("#amount-in", "amountInRaw"), ("#amount-out", "amountOutRaw"), ("#router-minimum", "amountOutMinimumRaw")]:
                    expect(page.locator(selector)).to_have_text(reports[name]["protocol"][field])
                expect(page.locator("#identity")).to_contain_text(reports[name]["transactionHash"])
                expect(page.locator("#identity")).to_contain_text(reports[name]["evidenceDigest"])
                no_overflow()
                snapshot(name)
                if name == "output-threshold-violation":
                    snapshot(name, full_page=True)
                checked(device, f"{name}: separate result dimensions, raw quantities, identity, limitations, and layout")

            show("output-threshold-violation")
            with page.expect_download(timeout=5000) as pending:
                page.locator("#download-report").click()
            original = out / f"{device}-original-report.json"
            pending.value.save_as(original)
            require(original.read_bytes() == payloads["output-threshold-violation"], "Original report download changed imported bytes")
            checked(device, "original report download preserves every imported byte")
            for selector in ["#identity-details", "#protocol-section", ".raw"]:
                page.locator(selector + " > summary").click()
            expect(page.locator("#identity")).to_be_visible()
            expect(page.locator("#protocol")).to_be_visible()
            expect(page.locator("#raw-report")).to_be_visible()
            require(json.loads(page.locator("#raw-report").inner_text()) == reports["output-threshold-violation"], "Raw JSON differs from the imported report")
            no_overflow()
            checked(device, "long transaction identity and complete raw report remain inspectable")
            show("pass")
            upload(b'{"schemaVersion":', "invalid.json")
            expect(page.locator("#import-error")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()
            for selector in ["#verdict", "#execution", "#raw-report", "#amount-out", "#primary-requirement"]:
                expect(page.locator(selector)).to_have_text("")
            checked(device, "invalid report clears a previously displayed PASS and raw content")
            hostile = json.loads(payloads["pass"])
            markup = '<img src="https://example.invalid/aftercheck-test" onerror="globalThis.aftercheckInjected=1"><script>globalThis.aftercheckInjected=2</script>'
            hostile["checks"][0]["reason"] = markup
            hostile["limitations"].append(markup)
            upload(json.dumps(hostile).encode("utf-8"), "hostile-text.json")
            expect(page.locator("#report")).to_be_visible()
            expect(page.locator("#checks .check-reason").first).to_have_text(markup)
            require(page.locator("#report img, #report script").count() == 0, "Imported markup created elements")
            require(page.evaluate("typeof globalThis.aftercheckInjected") == "undefined", "Imported markup executed")
            checked(device, "adversarial report text remains inert without HTML or script execution")
            page.locator("#clear-report").click()
            expect(page.locator("#report")).to_be_hidden()
            expect(page.locator("#report-file")).to_be_focused()
            expect(page.locator("#raw-report")).to_have_text("")
            require(page.evaluate("localStorage.length === 0 && sessionStorage.length === 0"), "Report processing persisted browser storage")
            require(page.url == url, "Import placed report data into navigation or query parameters")
            require(not unexpected and not summary["postLoadRequests"], "Unexpected asset or report-import networking")
            require(not summary["pageErrors"] and not summary["dialogs"], "Browser errors or unexpected dialogs")
            checked(device, "imports, downloads, and clear: zero outgoing requests, errors, or dialogs; no persisted web storage")
            context.close()
        summary["result"] = "PASS"
        summary["publicViewerSmokePassed"] = bool(args.url)
        if args.url:
            summary["tls"]["result"] = "PASS"
    except Exception as error:
        summary["failure"] = f"{type(error).__name__}: {error}"
        summary["traceback"] = traceback.format_exc()
        if page is not None and not page.is_closed():
            try:
                snapshot("failure", full_page=True)
            except Exception as failure:
                summary["screenshotFailure"] = str(failure)
    finally:
        if browser is not None:
            browser.close()
        if playwright is not None:
            playwright.stop()
        if server is not None:
            server.shutdown()
            server.server_close()
        summary["finishedAt"] = datetime.now(timezone.utc).isoformat()
        summary["checkCount"] = len(summary["checks"])
        summary["browserCheckCount"] = sum(check["scope"] in ("desktop", "mobile", "narrow") for check in summary["checks"])
        destination = out / "hosted-results.json"
        destination.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(f"{mode}: {summary['result']} — {summary['checkCount']} checks ({summary['browserCheckCount']} browser checks).")
        print(f"Evidence: {destination}")
        if summary.get("failure"):
            print(summary["failure"], file=sys.stderr)
    return 0 if summary["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
