#!/usr/bin/env python3
"""Verify the actual static financial workspace and replay downloaded ZIP inputs.

--local tests a loopback HTTP build; --url checks a clean pinned HTTPS deployment.
Only reviewed same-origin static assets may load. Policy editing, imports and
exports run in an offline browser context. CLI replay blocks common Node network
entry points using the existing offline guard; this is not an OS network sandbox.
Authenticated provider identity is recorded separately from public byte equality.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import threading
import traceback
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
TX = "0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9"
spec = importlib.util.spec_from_file_location("hosted_helpers", ROOT / "scripts/test-hosted-inspector.py")
hosted = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hosted)
require = hosted.require
sha256 = hosted.sha256


def replay_download(archive: Path, evidence_bytes: bytes, expected_verdict: str) -> dict:
    """Use only the evidence/policy actually downloaded from the browser."""
    package = archive.with_suffix("")
    package.mkdir(exist_ok=True)
    require(package.is_dir() and not package.is_symlink(), "Package destination must be a real directory")
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        require({"evidence.json", "policy.json", "report.json", "report.md"}.issubset(names), "Incomplete verification package")
        require(len(names) == len(set(names)) and len(names) <= 8, "Duplicate or excessive archive entries")
        require(all(re.fullmatch(r"[A-Za-z0-9_-]+\.(json|md|txt)", name) for name in names), "Unsafe archive path")
        require(sum(item.file_size for item in bundle.infolist()) <= 16_000_000, "Archive exceeds extraction budget")
        require(all(not (package / name).is_symlink() for name in names), "Archive destination contains a symlink")
        bundle.extractall(package)
    require((package / "evidence.json").read_bytes() == evidence_bytes, "Export changed evaluated evidence bytes")
    report_bytes = (package / "report.json").read_bytes()
    report = json.loads(report_bytes)
    policy = json.loads((package / "policy.json").read_bytes())
    require(report["verdict"] == expected_verdict, "Exported verdict differs from displayed result")
    replay_out = package.parent / (package.name + "-replay")
    env = dict(os.environ)
    env["NODE_OPTIONS"] = "--import=" + str(ROOT / "scripts/offline-guard.mjs")
    completed = subprocess.run(["npm", "run", "cli", "--", "verify", str(package / "evidence.json"),
                                str(package / "policy.json"), str(replay_out)], cwd=ROOT, env=env,
                               capture_output=True, text=True, timeout=45)
    (package.parent / (package.name + "-cli.log")).write_text(completed.stdout + completed.stderr)
    require(completed.returncode == {"PASS": 0, "VIOLATION": 2, "UNKNOWN": 3}[expected_verdict], "Unexpected offline CLI exit code")
    require((replay_out / "report.json").read_bytes() == report_bytes, "Browser/CLI canonical report bytes differ")
    require((replay_out / "policy.json").read_bytes() == (package / "policy.json").read_bytes(), "Policy normalization differs")
    require((replay_out / "report.md").read_bytes() == (package / "report.md").read_bytes(), "Browser/CLI Markdown differs")
    return {"archive": archive.name, "archiveSha256": sha256(archive.read_bytes()),
            "reportSha256": sha256(report_bytes), "exitCode": completed.returncode,
            "evidenceDigest": report["evidenceDigest"], "policyDigest": report["policyDigest"],
            "verdict": report["verdict"], "policy": policy, "fullCanonicalParity": True,
            "networkControl": "Node offline guard: fetch, HTTP, HTTPS, net and DNS disabled"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--local", action="store_true")
    target.add_argument("--url")
    parser.add_argument("--expected-revision")
    parser.add_argument("--out", type=Path, default=Path("output/browser-workspace"))
    parser.add_argument("--chromium", default=os.environ.get("AFTERCHECK_CHROMIUM_EXECUTABLE"))
    args = parser.parse_args()
    if args.url:
        parsed = urlsplit(args.url)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
                or parsed.query or parsed.fragment or parsed.path not in ("", "/") or parsed.port not in (None, 443)):
            parser.error("--url requires an HTTPS origin without credentials, path, query or fragment")
    if args.expected_revision and not re.fullmatch(r"[0-9a-f]{40}", args.expected_revision):
        parser.error("Use a full reviewed source SHA")
    out = args.out.resolve()
    if (out == ROOT or ROOT in out.parents) and out != ROOT / "output" and ROOT / "output" not in out.parents:
        parser.error("Write artifacts inside ignored output/ or outside the repository")
    out.mkdir(parents=True, exist_ok=True)
    summary = {"schemaVersion": "aftercheck.browser-workspace-test.v1", "result": "FAIL",
               "mode": "LOCAL_HTTP" if args.local else "PUBLIC_HTTPS", "startedAt": datetime.now(timezone.utc).isoformat(),
               "providerIdentityVerified": False, "checks": [], "http": [], "screenshots": [], "requests": [],
               "localEvaluationRequests": [], "pageErrors": [], "dialogs": [], "replays": [], "tls": []}
    server = browser = playwright = None
    device = "startup"

    def checked(name: str):
        summary["checks"].append({"device": device, "case": name, "result": "PASS"})

    try:
        revision = hosted.run("git", "rev-parse", "HEAD").strip()
        dirty = bool(hosted.run("git", "status", "--porcelain"))
        summary.update(sourceRevision=revision, workingTreeHasChanges=dirty,
                       harnessSha256=sha256(Path(__file__).read_bytes()))
        require(not args.expected_revision or args.expected_revision == revision, "Checkout does not match expected revision")
        if args.url:
            require(not dirty, "Production verification requires a clean pinned checkout")
        manifest = json.loads((WEB / "assets/browser-build.json").read_text())
        summary["sourceDigest"] = manifest["sourceDigest"]
        files = ["inspector.html", "workspace.css", "report-viewer.html", "assets/browser-build.json", "evidence/sepolia.json"]
        files += [item["path"] for item in manifest["assets"]]
        files += ["samples/" + name + ".json" for name in hosted.CASES]
        if args.local:
            server = hosted.ThreadingHTTPServer(("127.0.0.1", 0), hosted.StaticHandler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            url = f"http://127.0.0.1:{server.server_port}/"
        else:
            url = args.url.rstrip("/") + "/"
        summary["url"] = url
        response, body = hosted.retrieve(url, url)
        summary["http"].append(response)
        require(response["status"] == 200 and body == (WEB / "inspector.html").read_bytes(), "Root is not the reviewed workspace")
        checked("root serves reviewed HTML bytes")
        for name in files:
            record, body = hosted.retrieve(urljoin(url, name), url)
            summary["http"].append(record)
            require(record["status"] == 200 and body == (WEB / name).read_bytes(), "Stale or missing public asset: " + name)
        checked("every reviewed public asset matches source byte-for-byte")
        for name in [".git/config", ".env", "package.json", "src/verify.ts", "scripts/build-browser.mjs",
                     "docs/evidence/token-precision/manifest.json", "api/upload", "aftercheck-missing-route"]:
            record, _ = hosted.retrieve(urljoin(url, name), url)
            summary["http"].append(record)
            require(record["status"] == 404, "Unintended public route: " + name)
        checked("internal source and upload routes remain inaccessible")
        if args.url:
            record, _ = hosted.retrieve("http://" + url.removeprefix("https://"), url, follow=False)
            summary["http"].append(record)
            require(record["status"] in (301, 302, 307, 308) and urljoin(url, record["headers"].get("location", "")) == url,
                    "HTTP must redirect to this HTTPS origin")
            checked("HTTPS certificate validation and HTTP redirect")
        evidence_bytes = (WEB / "evidence/sepolia.json").read_bytes()
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(headless=True, executable_path=args.chromium)
        summary["browserVersion"] = browser.version
        for device, width, height in [("desktop", 1280, 900), ("mobile", 390, 844), ("narrow", 320, 844)]:
            context = browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True,
                                          is_mobile=device != "desktop", has_touch=device != "desktop",
                                          service_workers="block", ignore_https_errors=False)
            phase = {"name": "bootstrap"}
            unexpected = []
            allowed = {url, *[urljoin(url, name) for name in files]}

            def gate(route):
                request = route.request
                event = {"device": device, "phase": phase["name"], "url": request.url, "method": request.method}
                summary["requests"].append(event)
                if phase["name"] == "local":
                    summary["localEvaluationRequests"].append(event)
                    route.abort()
                elif request.method != "GET" or request.url not in allowed:
                    unexpected.append(event)
                    route.abort()
                else:
                    route.continue_()

            context.route("**/*", gate)
            context.route_web_socket("**/*", lambda socket: (unexpected.append({"websocket": socket.url}), socket.close()))
            context.add_init_script("window.__walletAccessCount = 0; Object.defineProperty(window, 'ethereum', {get() { window.__walletAccessCount++; throw new Error('WALLET_ACCESS_FORBIDDEN'); }});")
            page = context.new_page()
            page.on("pageerror", lambda error: summary["pageErrors"].append({"device": device, "message": str(error)}))
            page.on("dialog", lambda dialog: (summary["dialogs"].append({"device": device, "message": dialog.message}), dialog.dismiss()))
            navigation = page.goto(url, wait_until="networkidle")
            require(navigation.status == 200 and page.url == url, "Browser did not open the reviewed origin")
            if args.url:
                details = navigation.security_details()
                require(details is not None, "No browser TLS evidence")
                summary["tls"].append({"device": device, **details})

            def screenshot(name):
                sizes = page.evaluate("({viewport:innerWidth,content:document.documentElement.scrollWidth})")
                require(sizes["content"] <= sizes["viewport"], "Horizontal overflow: " + str(sizes))
                filename = f"{device}-{name}.png"
                page.screenshot(path=str(out / filename), full_page=True)
                summary["screenshots"].append(filename)

            # Workspace interaction checks are below; all values come from the retained fixture.
            run_workspace(page, context, phase, out, device, evidence_bytes, checked, screenshot, summary)
            require(not unexpected, "Unexpected request: " + str(unexpected))
            require(not summary["localEvaluationRequests"], "Local processing attempted a network request")
            require(not summary["pageErrors"] and not summary["dialogs"], "Browser error or dialog")
            require(page.url == url, "User policy leaked into the URL or navigation changed")
            storage = page.evaluate("({local:localStorage.length,session:sessionStorage.length,cookie:document.cookie})")
            require(storage == {"local": 0, "session": 0, "cookie": ""}, "Unexpected client persistence")
            require(page.evaluate("window.__walletAccessCount") == 0, "Wallet API was accessed")
            checked("zero policy requests, wallet access, uploads, page errors or persistent storage")
            context.close()
        summary["result"] = "PASS"
        summary["checkCount"] = len(summary["checks"])
        print(f"{summary['mode']}: PASS — {summary['checkCount']} checks, {len(summary['replays'])} actual exported packages replayed")
    except Exception as error:
        summary["failure"] = f"{type(error).__name__}: {error}"
        summary["traceback"] = traceback.format_exc()
        raise
    finally:
        if browser:
            browser.close()
        if playwright:
            playwright.stop()
        if server:
            server.shutdown()
            server.server_close()
        summary["finishedAt"] = datetime.now(timezone.utc).isoformat()
        (out / "workspace-results.json").write_text(json.dumps(summary, indent=2) + "\n")
    return 0


def run_workspace(page, context, phase, out, device, evidence_bytes, checked, screenshot, summary):
    tx = page.locator("#transaction-hash")
    minimum = page.locator("#min-received")
    maximum = page.locator("#max-input")
    recipient = page.locator("#expected-recipient")
    reserve = page.locator("#reserve-enabled")
    verdict = page.locator("#verdict")
    error = page.locator("#error")

    def load():
        page.locator("#load-evidence").click()

    def tab(name):
        page.get_by_role("tab", name=name, exact=True).click()

    def expect_verdict(value):
        expect(verdict).to_have_text(value)
        expect(page.locator("#execution")).to_have_text("SUCCEEDED")
        expect(error).to_be_hidden()

    def export(name, result):
        tab("Export")
        if name == "pass":
            screenshot("export")
        with page.expect_download(timeout=10_000) as pending:
            page.locator("#download-package").click()
        path = out / f"{device}-{name}.zip"
        pending.value.save_as(path)
        record = replay_download(path, evidence_bytes, result)
        summary["replays"].append({"device": device, **record})
        tab("Overview")
        return record

    expect(tx).to_be_visible()
    screenshot("landing")
    tx.fill("0x1234")
    load()
    expect(error).to_be_visible()
    expect(verdict).not_to_have_text("PASS")
    checked("invalid transaction hash cannot leave a PASS")
    tx.fill("0x" + "1" * 64)
    load()
    expect(error).to_contain_text("No retained evidence")
    expect(page.locator("#evidence-file")).to_be_attached()
    checked("unknown transaction offers an evidence import without RPC lookup")
    tx.fill(TX)
    load()
    expect(page.locator("#execution")).to_have_text("SUCCEEDED")
    expect(page.locator("#amount-in")).to_contain_text("1")
    expect(page.locator("#amount-out")).to_contain_text("0.99949625376934446")
    expect(page.locator("body")).to_contain_text("Historical evidence replay")
    expect(page.locator("body")).to_contain_text("User-supplied retrospective policy")
    checked("genuine retained evidence is validated and source-bound decimal amounts appear")
    phase["name"] = "local"
    context.set_offline(True)
    maximum.fill("1")
    minimum.fill("0.999")
    expect_verdict("PASS")
    screenshot("pass")
    pass_export = export("pass", "PASS")
    require(pass_export["policy"]["maxInputRaw"] == "1000000000000000000", "Input conversion is not exact")
    require(pass_export["policy"]["minReceivedRaw"] == "999000000000000000", "Output conversion is not exact")
    checked("human-readable PASS and actual downloaded package reproduce offline")

    minimum.fill("1")
    expect_verdict("VIOLATION")
    screenshot("output-violation")
    violation_export = export("output-violation", "VIOLATION")
    require(violation_export["policy"]["minReceivedRaw"] == "1000000000000000000", "Violation export does not match entered threshold")
    require(pass_export["evidenceDigest"] == violation_export["evidenceDigest"], "Policy edit changed evidence")
    require(pass_export["policyDigest"] != violation_export["policyDigest"], "Policy digest did not change")
    checked("stricter requirement changes only financial verdict and policy digest")

    minimum.fill("0.999")
    reserve.check()
    page.locator("#reserve-floor").fill("0")
    expect_verdict("UNKNOWN")
    screenshot("reserve-unknown")
    reserve_export = export("reserve-unknown", "UNKNOWN")
    require(reserve_export["policy"]["reserveFloorRaw"] == "0" and reserve_export["policy"]["minReceivedRaw"] == "999000000000000000",
            "Reserve export does not match entered policy")
    checked("zero reserve floor remains UNKNOWN without transaction-boundary proof")
    minimum.fill("1")
    expect_verdict("VIOLATION")
    tab("Policy checks")
    expect(page.locator("#checks")).to_contain_text("UNKNOWN")
    screenshot("mixed-checks")
    mixed_export = export("mixed", "VIOLATION")
    require(mixed_export["policy"]["reserveFloorRaw"] == "0" and mixed_export["policy"]["minReceivedRaw"] == "1000000000000000000",
            "Mixed export does not match entered policy")
    checked("known violation keeps precedence over a separate unknown reserve")

    reserve.uncheck()
    minimum.fill("0.999496253769344460")
    expect_verdict("PASS")
    minimum.fill("0.999496253769344461")
    expect_verdict("VIOLATION")
    minimum.fill("0")
    expect_verdict("PASS")
    minimum.fill("0.999")
    maximum.fill("0.999999999999999999")
    expect_verdict("VIOLATION")
    maximum.fill("1")
    expect_verdict("PASS")
    checked("one-unit output and input comparisons, equality and exact zero")

    for invalid in ["-1", "1e-3", "NaN", "1,000", "0.0000000000000000001"]:
        minimum.fill(invalid)
        expect(error).to_be_visible()
        expect(verdict).not_to_have_text("PASS")
        tab("Export")
        expect(page.locator("#download-package")).to_be_disabled()
        tab("Overview")
    saved_recipient = recipient.input_value()
    minimum.fill("0.999")
    recipient.fill("0x123")
    expect(error).to_be_visible()
    expect(verdict).not_to_have_text("PASS")
    recipient.fill(saved_recipient)
    minimum.fill("1")
    minimum.fill("0.999")
    expect_verdict("PASS")
    checked("invalid policy clears stale verdict/download; rapid edits resolve to newest policy")

    # Hold an actual native digest, change the form, then release the obsolete work.
    # This is a controlled test adapter, never shipped application code.
    page.evaluate("""() => {
      const nativeDigest = crypto.subtle.digest.bind(crypto.subtle);
      window.__digestHeld = false;
      window.__holdNextDigest = false;
      window.__pendingDigests = 0;
      crypto.subtle.digest = (...args) => {
        const held = window.__holdNextDigest;
        window.__holdNextDigest = false;
        window.__pendingDigests++;
        const result = nativeDigest(...args);
        const returned = held ? result.then(value => new Promise(resolve => {
          window.__digestHeld = true;
          window.__releaseDigest = () => { window.__digestHeld = false; resolve(value); };
        })) : result;
        return returned.finally(() => window.__pendingDigests--);
      };
    }""")
    page.evaluate("window.__holdNextDigest = true")
    minimum.fill("1")
    page.wait_for_function("window.__digestHeld === true")
    minimum.fill("0.999")
    page.evaluate("window.__releaseDigest()")
    expect_verdict("PASS")
    page.wait_for_function("window.__pendingDigests === 0")
    expect_verdict("PASS")
    page.evaluate("window.__holdNextDigest = true")
    minimum.fill("1")
    page.wait_for_function("window.__digestHeld === true")
    minimum.fill("1e-3")
    page.evaluate("window.__releaseDigest()")
    page.wait_for_function("window.__pendingDigests === 0")
    expect(error).to_be_visible()
    expect(verdict).not_to_have_text("PASS")
    expect(verdict).not_to_have_text("VIOLATION")
    minimum.fill("0.999")
    expect_verdict("PASS")
    checked("delayed obsolete native-crypto evaluations cannot replace newer valid or invalid state")

    tab("Overview")
    page.get_by_role("tab", name="Overview", exact=True).press("ArrowRight")
    expect(page.get_by_role("tab", name="Policy checks", exact=True)).to_be_focused()
    expect(page.get_by_role("tab", name="Policy checks", exact=True)).to_have_attribute("aria-selected", "true")
    page.get_by_role("tab", name="Policy checks", exact=True).press("End")
    expect(page.get_by_role("tab", name="Export", exact=True)).to_be_focused()
    tab("Evidence")
    expect(page.locator("body")).to_contain_text(TX)
    screenshot("evidence")
    checked("tabs expose semantics, keyboard focus, and inspectable transaction evidence")
    tab("Overview")

    # Display precision is a reversible view of a raw policy, never a policy edit.
    page.locator("#precision-mode").select_option("raw")
    expect(minimum).to_have_value("999000000000000000")
    expect_verdict("PASS")
    raw_export = export("raw-display", "PASS")
    require(raw_export["policyDigest"] == pass_export["policyDigest"], "Raw display changed policy meaning")
    page.locator("#precision-mode").select_option("custom")
    page.locator("#input-decimals").fill("6")
    page.locator("#output-decimals").fill("6")
    page.locator("#apply-precision").click()
    expect_verdict("PASS")
    expect(minimum).to_have_value("999000000000")
    expect(page.locator("body")).to_contain_text("User-supplied")
    custom_export = export("custom-display", "PASS")
    require(custom_export["policyDigest"] == pass_export["policyDigest"], "User precision changed raw policy")
    checked("raw and user-supplied precision preserve raw requirements and policy digest")
    screenshot("custom-precision")

    # File imports stay local and cannot retain the previous result after a failure.
    corrupted = json.loads(evidence_bytes)
    corrupted["digest"] = "0x" + "0" * 64
    page.locator("#evidence-file").set_input_files({"name": "corrupt.json", "mimeType": "application/json",
                                                "buffer": json.dumps(corrupted).encode()})
    expect(error).to_be_visible()
    expect(error).to_contain_text(re.compile("digest|integrity", re.I))
    expect(verdict).not_to_have_text("PASS")
    tx.fill("0x" + "1" * 64)
    page.locator("#evidence-file").set_input_files({"name": "wrong-transaction.json", "mimeType": "application/json",
                                                "buffer": evidence_bytes})
    expect(error).to_be_visible()
    expect(error).to_contain_text(re.compile("transaction|hash", re.I))
    expect(verdict).not_to_have_text("PASS")
    tx.fill(TX)
    page.locator("#evidence-file").set_input_files({"name": "evidence.json", "mimeType": "application/json",
                                                "buffer": evidence_bytes})
    expect(page.locator("#execution")).to_have_text("SUCCEEDED")
    minimum.fill("0.999")
    maximum.fill("1")
    expect_verdict("PASS")
    checked("corrupt and wrong-transaction imports clear old results; valid local import recovers offline")
    screenshot("import-recovered")
    if device == "desktop":
        page.locator("#evidence-file").set_input_files({"name": "invalid-utf8.json", "mimeType": "application/json",
                                                    "buffer": b'{"name":"\xff"}'})
        expect(error).to_be_visible()
        expect(error).to_contain_text(re.compile("utf|encod", re.I))
        expect(verdict).not_to_have_text("PASS")
        page.locator("#evidence-file").set_input_files({"name": "too-large.json", "mimeType": "application/json",
                                                    "buffer": b" " * 8_000_001})
        expect(error).to_be_visible()
        expect(verdict).not_to_have_text("PASS")
        checked("malformed UTF-8 and oversized imports fail before evaluation or upload")


if __name__ == "__main__":
    raise SystemExit(main())
