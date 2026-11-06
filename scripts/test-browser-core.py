#!/usr/bin/env python3
"""Run the actual published ES modules in disposable Chromium against Node vectors.

Only local static module requests are allowed during bootstrap. Every request is
blocked during financial verification, which uses real native browser Web Crypto.
This is core parity evidence; production/UI acceptance is a separate harness.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import subprocess
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "web"), **kwargs)

    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path == "/__core_test__.html":
            body = b"<!doctype html><meta charset=utf-8><title>Aftercheck browser core parity</title><p>Disposable verifier test</p>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith("/assets/") and ".." not in self.path:
            super().do_GET()
        else:
            self.send_error(404)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("output/browser-core"))
    parser.add_argument("--chromium", default=os.environ.get("AFTERCHECK_CHROMIUM_EXECUTABLE"))
    args = parser.parse_args()
    out = args.out.resolve()
    ignored = ROOT / "output"
    if (out == ROOT or ROOT in out.parents) and out != ignored and ignored not in out.parents:
        parser.error("Test artifacts must use ignored output/ or an external scratch directory")
    out.mkdir(parents=True, exist_ok=True)
    vectors_run = subprocess.run(
        ["node", "--import", "./scripts/offline-guard.mjs", "scripts/browser-parity-cases.mjs"],
        cwd=ROOT, capture_output=True, text=True, check=True, timeout=45,
    )
    vectors = json.loads(vectors_run.stdout)["cases"]
    source_revision = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    summary = {
        "schemaVersion": "aftercheck.browser-core-test.v1",
        "sourceRevision": source_revision,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "playwrightVersion": importlib.metadata.version("playwright"),
        "build": json.loads((ROOT / "web/assets/browser-build.json").read_text()),
        "cases": [], "bootstrapRequests": [], "evaluationRequests": [], "pageErrors": [],
        "result": "FAIL",
    }
    (out / "canonical-node-vectors.json").write_text(vectors_run.stdout + "\n", encoding="utf-8")
    server = None
    browser = None
    playwright = None
    phase = "bootstrap"
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f"http://127.0.0.1:{server.server_port}"
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(headless=True, executable_path=args.chromium)
        summary["browserVersion"] = browser.version
        context = browser.new_context(service_workers="block")

        def request_gate(route):
            request = route.request
            if phase == "bootstrap" and request.method == "GET" and request.url.startswith(origin + "/"):
                summary["bootstrapRequests"].append(request.url.removeprefix(origin))
                route.continue_()
            else:
                summary["evaluationRequests"].append({"method": request.method, "url": request.url})
                route.abort()

        context.route("**/*", request_gate)
        page = context.new_page()
        page.on("pageerror", lambda error: summary["pageErrors"].append(str(error)))
        page.goto(origin + "/__core_test__.html", wait_until="networkidle")
        page.evaluate("async () => { globalThis.AftercheckCoreUnderTest = await import('/assets/browser-engine.js'); }")
        runtime = page.evaluate("({buffer:typeof Buffer, process:typeof process, crypto:!!globalThis.crypto?.subtle})")
        assert runtime == {"buffer": "undefined", "process": "undefined", "crypto": True}, runtime
        summary["runtime"] = runtime
        phase = "evaluation"
        context.set_offline(True)
        for item in vectors:
            actual = page.evaluate("""async ({evidenceText, policyText}) => {
              const engine = globalThis.AftercheckCoreUnderTest;
              try {
                const report = await engine.verifyEvidenceAsync(engine.parseJson(evidenceText), engine.parseJson(policyText));
                return {report:engine.canonicalJson(report), markdown:engine.renderMarkdown(report)};
              } catch (error) { return {error:error.message}; }
            }""", {"evidenceText": item["evidenceText"], "policyText": item["policyText"]})
            if actual != item["expected"]:
                (out / "mismatch.json").write_text(json.dumps({"name": item["name"], "expected": item["expected"], "actual": actual}, indent=2) + "\n")
                raise AssertionError("Full canonical Node/browser parity mismatch: " + item["name"])
            record = {"name": item["name"], "result": "PASS"}
            if "report" in actual:
                report = json.loads(actual["report"])
                record.update({key: report[key] for key in ["execution", "support", "coverage", "verdict", "evidenceDigest", "policyDigest"]})
                record["reportSha256"] = hashlib.sha256(actual["report"].encode()).hexdigest()
            else:
                record["rejectedWith"] = actual["error"]
            summary["cases"].append(record)
        assert not summary["evaluationRequests"], summary["evaluationRequests"]
        assert not summary["pageErrors"], summary["pageErrors"]
        summary["result"] = "PASS"
        summary["caseCount"] = len(summary["cases"])
        print(f"PASS: {summary['caseCount']} complete browser/Node parity cases; zero evaluation requests")
    except Exception as error:
        summary["failure"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        if browser is not None:
            browser.close()
        if playwright is not None:
            playwright.stop()
        if server is not None:
            server.shutdown()
            server.server_close()
        summary["finishedAt"] = datetime.now(timezone.utc).isoformat()
        (out / "browser-core-results.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
