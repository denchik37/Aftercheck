#!/usr/bin/env python3
"""Isolated optional browser regression test; requires Python Playwright + Chromium.

The application is loaded as source into about:blank. There is no file:// or HTTP
navigation, local server, persistent browser profile, wallet, or external service.
All context networking is disabled and all attempted requests are aborted.

Usage:
  python scripts/test-inspector.py --out output/browser
  python scripts/test-inspector.py --out /tmp/aftercheck-browser-check \
    --evidence examples/captured/evidence.json --policy examples/captured/policy.json
  python scripts/test-inspector.py --report output/real-example/report.json
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "web" / "report-viewer.html"


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def make_reports(evidence: Path | None, policy: Path | None) -> dict:
    """Use the real offline verifier for all financial states, never hand-set them."""
    source = """
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sealEvidence} from './src/evidence.ts';
import {verifyEvidence} from './src/verify.ts';
import {rpcFixture,policyFixture} from './test/helpers/uniswap-fixture.mjs';
const paths=JSON.parse(process.argv[1]);
const evidence=paths.evidence ? JSON.parse(readFileSync(paths.evidence,'utf8')) : sealEvidence(rpcFixture());
const policy=paths.policy ? JSON.parse(readFileSync(paths.policy,'utf8')) : policyFixture();
const pass=verifyEvidence(evidence,policy);
if(pass.verdict!=='PASS'||!pass.protocol)throw Error('BROWSER_TEST_REQUIRES_A_SUPPORTED_PASS_BASELINE');
const retainedCase=paths.evidence===resolve('examples/sepolia/evidence.json') && paths.policy===resolve('examples/sepolia/policy-pass.json');
const violation=verifyEvidence(evidence,{...policy,minReceivedRaw:(BigInt(pass.protocol.amountOutRaw)+1n).toString()});
const reservePolicy=retainedCase ? JSON.parse(readFileSync('examples/sepolia/policy-reserve.json','utf8')) : {...policy,reserveFloorRaw:'0'};
const unknown=verifyEvidence(evidence,reservePolicy);
if(violation.verdict!=='VIOLATION'||unknown.verdict!=='UNKNOWN')throw Error('BROWSER_TEST_BASELINE_STATES_NOT_ESTABLISHED');
const maxPolicy=retainedCase
  ? JSON.parse(readFileSync('examples/sepolia/policy-violation.json','utf8'))
  : {...policy,maxInputRaw:(BigInt(pass.protocol.amountInRaw)-1n).toString()};
const maxInput=verifyEvidence(evidence,maxPolicy);
if(!maxInput.checks.some(c=>c.id==='maxInputRaw'&&c.result==='VIOLATION'))throw Error('BROWSER_TEST_REQUIRES_MAX_INPUT_VIOLATION');
const mixed=verifyEvidence(evidence,{...maxPolicy,reserveFloorRaw:'0'});
// Deliberately put UNKNOWN first: the UI must still prioritize a proven violation.
mixed.checks.sort((a,b)=>Number(b.result==='UNKNOWN')-Number(a.result==='UNKNOWN'));
const fixtureReport=mutate=>{const input=rpcFixture();mutate(input);return verifyEvidence(sealEvidence(input),policyFixture());};
const synthetic=fixtureReport(()=>{});
const pending=fixtureReport(e=>{e.transaction.blockHash=null;e.transaction.blockNumber=null;e.transaction.transactionIndex=null;e.receipt=null;});
const reverted=fixtureReport(e=>{e.receipt.status='0x0';e.receipt.logs=[];});
const unsupported=fixtureReport(e=>{e.transaction.input='0x12345678';});
const conflicted=fixtureReport(e=>{e.transaction.chainId='0x1';});
// Optional-field compatibility case; statuses and checks still come from the verifier.
const noProtocol=structuredClone(maxInput);delete noProtocol.protocol;delete noProtocol.policySource;
if(mixed.verdict!=='VIOLATION'||mixed.coverage!=='PARTIAL'||!mixed.checks.some(c=>c.id==='reserveFloorRaw'&&c.result==='UNKNOWN'))throw Error('BROWSER_TEST_REQUIRES_MIXED_RESULT');
for(const report of [pending,reverted,unsupported,conflicted])if(report.verdict!=='UNKNOWN')throw Error('BROWSER_TEST_INVALID_NEGATIVE_FIXTURE');
console.log(JSON.stringify({pass,violation,unknown,'max-input-violation':maxInput,mixed,synthetic,pending,reverted,unsupported,conflicted,'no-protocol':noProtocol}));
"""
    paths = {"evidence": str(evidence) if evidence else None, "policy": str(policy) if policy else None}
    result = subprocess.run(
        ["node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", "--input-type=module", "-e", source, json.dumps(paths)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
        timeout=30,
    )
    return json.loads(result.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=Path("output/browser"), type=Path, help="Ignored output directory or external scratch directory for screenshots and the test log")
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--policy", type=Path)
    parser.add_argument("--report", type=Path, help="Additional genuine saved report to inspect without altering its verdict")
    parser.add_argument("--chromium", default=os.environ.get("AFTERCHECK_CHROMIUM_EXECUTABLE"), help="Optional Chromium executable; otherwise use Playwright's bundled Chromium")
    args = parser.parse_args()
    if bool(args.evidence) != bool(args.policy):
        parser.error("--evidence and --policy must be supplied together")
    out = args.out.resolve()
    ignored_output = ROOT / "output"
    if (out == ROOT or ROOT in out.parents) and out != ignored_output and ignored_output not in out.parents:
        parser.error("Keep generated artifacts in ignored output/ or outside the source repository")
    out.mkdir(parents=True, exist_ok=True)
    html_bytes = HTML_PATH.read_bytes()
    html = html_bytes.decode("utf-8")
    evidence = args.evidence.resolve() if args.evidence else None
    policy = args.policy.resolve() if args.policy else None
    reports = make_reports(evidence, policy)
    serialized = {name: json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n" for name, report in reports.items()}
    additional_source = args.report.resolve().read_bytes().decode("utf-8") if args.report else None
    additional_report = json.loads(additional_source) if additional_source is not None else None
    for name, source in serialized.items():
        (out / f"{name}-report.json").write_text(source, encoding="utf-8")
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    dirty = bool(subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    summary = {
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": commit,
        "workingTreeHasChanges": dirty,
        "inspectorSha256": sha256(html_bytes),
        "harnessSha256": sha256(Path(__file__).read_bytes()),
        "evidenceClass": reports["pass"]["evidenceClass"],
        "evidenceDigest": reports["pass"]["evidenceDigest"],
        "reportSha256": {name: sha256(value.encode("utf-8")) for name, value in serialized.items()},
        "reportStates": {name: {field: report[field] for field in ["execution", "support", "coverage", "verdict", "evidenceClass"]} for name, report in reports.items()},
        "rendererMutations": {"mixed": "Actual verifier result with UNKNOWN checks placed first; statuses, reasons and digests are unchanged.", "no-protocol": "Actual max-input violation with optional protocol and policySource fields omitted to test schema compatibility."},
        "runtime": {"python": sys.version.split()[0], "playwright": importlib.metadata.version("playwright"), "chromiumExecutable": args.chromium or "Playwright bundled Chromium"},
        "isolation": {"pageURL": "about:blank", "persistentProfile": False, "offlineContext": True, "allRequestsAborted": True},
        "limitation": "Tests run exact application source in about:blank with networking disabled. file:// navigation itself is not tested.",
        "cases": [],
        "screenshots": [],
        "requests": [],
        "pageErrors": [],
        "dialogs": [],
    }
    if additional_report is not None:
        summary["additionalReport"] = {"sha256": sha256(additional_source.encode("utf-8")), "evidenceClass": additional_report.get("evidenceClass"), "verdict": additional_report.get("verdict")}

    def checked(device: str, name: str) -> None:
        summary["cases"].append({"device": device, "case": name, "result": "PASS"})

    playwright = None
    browser = None
    page = None
    device = "startup"
    try:
        playwright = sync_playwright().start()
        launch_options = {"headless": True, "args": ["--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-sync", "--no-first-run", "--disable-extensions"]}
        if args.chromium:
            launch_options["executable_path"] = args.chromium
        browser = playwright.chromium.launch(**launch_options)
        summary["runtime"]["chromiumVersion"] = browser.version
        for device, viewport in [("desktop", {"width": 1280, "height": 900}), ("mobile", {"width": 390, "height": 844})]:
            context = browser.new_context(viewport=viewport, offline=True, service_workers="block", accept_downloads=True, is_mobile=device == "mobile", has_touch=device == "mobile")

            def abort_request(route):
                summary["requests"].append({"device": device, "url": route.request.url})
                route.abort("blockedbyclient")

            context.route("**/*", abort_request)
            page = context.new_page()
            page.on("pageerror", lambda error: summary["pageErrors"].append(str(error)))

            def dismiss_dialog(dialog):
                summary["dialogs"].append(dialog.message)
                dialog.dismiss()

            page.on("dialog", dismiss_dialog)
            assert page.url == "about:blank"
            page.set_content(html, wait_until="load")
            assert page.url == "about:blank"
            expect(page.locator("#empty-state")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()
            checked(device, "initial empty state in offline isolated page")

            def upload(source: str | bytes, name: str = "test-report.json"):
                data = source.encode("utf-8") if isinstance(source, str) else source
                page.locator("#report-file").set_input_files({"name": name, "mimeType": "application/json", "buffer": data})

            def show_report(name: str):
                upload(serialized[name], name + "-report.json")
                expect(page.locator("#report")).to_be_visible()
                expect(page.locator("#report-title")).to_have_text(reports[name]["verdict"])
                for field in ["execution", "support", "coverage", "verdict"]:
                    expect(page.locator("#" + field)).to_have_text(reports[name][field])
                expect(page.locator("#outcome-summary")).to_be_focused()
                expect(page.locator("#execution")).to_be_in_viewport()
                expect(page.locator("#verdict")).to_be_in_viewport()
                assert not page.locator("#import-panel").evaluate("element => element.open")
                expect(page.locator("#import-status")).to_have_attribute("role", "status")
                assert page.locator("#import-panel #import-status").count() == 0

            def screenshot(name: str, both: bool = True):
                for suffix, full_page in [("viewport", False), ("full", True)] if both else [("viewport", False)]:
                    path = out / f"{device}-{name}-{suffix}.png"
                    page.screenshot(path=str(path), full_page=full_page)
                    summary["screenshots"].append(str(path))

            def no_overflow():
                dimensions = page.evaluate("({viewport:innerWidth,page:document.documentElement.scrollWidth})")
                assert dimensions["page"] <= dimensions["viewport"], dimensions

            def assert_cleared():
                expect(page.locator("#report")).to_be_hidden()
                for selector in ["#verdict", "#raw-report", "#report-subtitle", "#primary-requirement", "#policy-context", "#outcome-origin", "#amount-in", "#amount-out", "#router-minimum", "#attention-checks", "#checks", "#guidance", "#identity", "#protocol"]:
                    expect(page.locator(selector)).to_have_text("")
                assert page.locator("#import-panel").evaluate("element => element.open")

            def inspect_outcome(name: str, primary: str | None = None):
                report = reports[name]
                for field in ["execution", "verdict", "support", "coverage"]:
                    region = page.locator(f'#outcome-summary [data-dimension="{field}"]')
                    expect(region).to_be_visible()
                    expect(region).to_contain_text(report[field])
                expect(page.locator("#report-subtitle")).not_to_be_empty()
                expect(page.locator("#guidance")).not_to_be_empty()
                expect(page.locator("#limitations")).to_be_visible()
                if primary:
                    expect(page.locator("#primary-requirement")).to_be_visible()
                    expect(page.locator("#primary-requirement")).to_be_in_viewport()
                    expect(page.locator("#primary-requirement")).to_contain_text(primary)
                attention = [c for c in report["checks"] if c["result"] != "PASS"]
                attention.sort(key=lambda c: c["result"] != "VIOLATION")
                assert page.locator("#attention-checks .check-id").all_text_contents() == [c["id"] for c in attention]
                assert page.locator("#attention-checks .check-reason").all_text_contents() == [c["reason"] for c in attention]
                for row in page.locator("#attention-checks .check").all():
                    expect(row).to_be_visible()
                    expect(row.locator(".check-meaning")).not_to_be_empty()
                assert page.locator("#checks .check-id").all_text_contents() == [c["id"] for c in report["checks"]]
                assert page.locator("#checks .check-reason").all_text_contents() == [c["reason"] for c in report["checks"]]
                if report.get("protocol"):
                    expect(page.locator("#observed-amounts")).to_be_visible()
                    for selector, field in [("#amount-in", "amountInRaw"), ("#amount-out", "amountOutRaw"), ("#router-minimum", "amountOutMinimumRaw")]:
                        expect(page.locator(selector)).to_have_text(report["protocol"][field])
                else:
                    expect(page.locator("#observed-amounts")).to_be_hidden()
                    expect(page.locator("#amount-in")).to_have_text("")
                    expect(page.locator("#amount-out")).to_have_text("")
                note = page.locator("#policy-threshold-note")
                expect(note).to_be_visible()
                expect(note).to_contain_text("not provided as structured fields")
                expect(note).to_contain_text("original supplied policy")
                expect(note).to_contain_text("does not substitute")
                if report.get("policySource") == "SUPPLIED_RETROSPECTIVE":
                    expect(page.locator("#policy-context")).to_contain_text("Retrospective")
                else:
                    expect(page.locator("#policy-context")).to_contain_text("does not state when")
                no_overflow()

            show_report("pass")
            expect(page.locator("#protocol")).to_contain_text(reports["pass"]["protocol"]["amountInRaw"])
            expect(page.locator("#identity")).to_contain_text(reports["pass"]["evidenceDigest"])
            expect(page.locator(".display-only")).to_contain_text("display only")
            if "SYNTHETIC" in reports["pass"]["evidenceClass"]:
                expect(page.locator("#evidence-banner")).to_have_attribute("data-synthetic", "true")
                expect(page.locator("#evidence-title")).to_contain_text("Synthetic")
            else:
                expect(page.locator("#evidence-class")).to_have_text(reports["pass"]["evidenceClass"])
            checked(device, "actual verifier PASS report and identity render")

            dimensions = page.evaluate("({viewport:innerWidth,page:document.documentElement.scrollWidth})")
            assert dimensions["page"] <= dimensions["viewport"], dimensions
            checked(device, "no horizontal overflow at requested viewport")
            screenshot("pass")

            with page.expect_download(timeout=5000) as pending_download:
                page.locator("#download-report").click()
            download = pending_download.value
            assert download.suggested_filename == "aftercheck-report.json"
            download_path = out / f"{device}-downloaded-report.json"
            download.save_as(download_path)
            assert download_path.read_bytes() == serialized["pass"].encode("utf-8")
            checked(device, "download retains exact accepted report bytes")

            show_report("violation")
            expect(page.locator("#checks")).to_contain_text("VIOLATION")
            checked(device, "actual verifier financial VIOLATION renders")
            inspect_outcome("violation", "minReceivedRaw")
            expect(page.locator("#report-subtitle")).to_contain_text("completed, but")
            screenshot("min-received-violation")

            show_report("unknown")
            expect(page.locator("#coverage")).to_have_text("PARTIAL")
            expect(page.locator("#checks")).to_contain_text("Remaining reserve")
            expect(page.locator("#checks")).to_contain_text("UNKNOWN")
            checked(device, "actual verifier reserve UNKNOWN remains visible")
            inspect_outcome("unknown", "reserveFloorRaw")
            expect(page.locator("#primary-requirement")).to_contain_text("do not prove")
            screenshot("unknown")

            for name, primary in [("pass", None), ("max-input-violation", "maxInputRaw"), ("mixed", "maxInputRaw"), ("synthetic", None), ("no-protocol", "maxInputRaw"), ("pending", None), ("reverted", None), ("unsupported", None), ("conflicted", None)]:
                show_report(name)
                inspect_outcome(name, primary)
                if name == "max-input-violation":
                    expect(page.locator("#execution")).to_have_text("SUCCEEDED")
                    expect(page.locator("#primary-requirement")).to_contain_text("input exceeds")
                    expect(page.locator("#report-subtitle")).to_contain_text("policy was violated")
                    screenshot(name)
                if name == "mixed":
                    expect(page.locator("#coverage")).to_have_text("PARTIAL")
                    expect(page.locator("#verdict-scope")).to_contain_text("remain UNKNOWN")
                    screenshot(name)
                if name == "synthetic":
                    expect(page.locator("#outcome-origin")).to_contain_text("SYNTHETIC / SIMULATED")
                    expect(page.locator("#report-subtitle")).to_contain_text("simulated operation")
                    expect(page.locator("#evidence-banner")).to_have_attribute("data-synthetic", "true")
                if name in ["pending", "reverted", "unsupported", "conflicted"]:
                    expect(page.locator("#verdict")).to_have_text("UNKNOWN")
                    expect(page.locator("#report-subtitle")).to_contain_text("cannot establish")
                if name == "conflicted":
                    expect(page.locator("#coverage-description")).to_contain_text("Observations conflict")
                checked(device, f"{name}: separate outcomes, exact checks, amounts, provenance and guidance")

            show_report("pass")
            page.locator("#import-panel > summary").focus()
            page.keyboard.press("Enter")
            expect(page.locator(".paste summary")).to_be_visible()
            page.locator(".paste summary").focus()
            page.keyboard.press("Enter")
            page.keyboard.press("Tab")
            expect(page.locator("#report-text")).to_be_focused()
            page.locator("#report-text").fill(serialized["max-input-violation"])
            page.keyboard.press("Tab")
            expect(page.locator("#open-text")).to_be_focused()
            page.keyboard.press("Enter")
            expect(page.locator("#outcome-summary")).to_be_focused()
            expect(page.locator("#verdict")).to_have_text("VIOLATION")
            checked(device, "keyboard paste opens import and moves focus to accepted outcome")

            show_report("pass")
            for details, content in [("#checks-details", "#checks"), ("#identity-details", "#identity"), ("#protocol-section", "#protocol"), (".raw", "#raw-report")]:
                page.locator(details + " > summary").focus()
                page.keyboard.press("Enter")
                expect(page.locator(content)).to_be_visible()
            page.keyboard.press("Tab")
            expect(page.locator("#raw-report")).to_be_focused()
            assert json.loads(page.locator("#raw-report").inner_text()) == reports["pass"]
            no_overflow()
            checked(device, "keyboard opens technical evidence and complete raw report without horizontal overflow")

            if device == "mobile":
                page.set_viewport_size({"width": 320, "height": 740})
                for name in ["pass", "max-input-violation", "unknown", "mixed"]:
                    show_report(name)
                    no_overflow()
                    screenshot("320-" + name)
                checked(device, "320px PASS, VIOLATION, UNKNOWN and mixed results have no horizontal overflow")
                page.set_viewport_size(viewport)

            show_report("pass")
            page.locator("#import-panel > summary").click()
            if not page.locator(".paste").evaluate("element => element.open"):
                page.locator(".paste summary").click()
            page.locator("#report-text").fill('{"schemaVersion":')
            page.locator("#open-text").click()
            expect(page.locator("#import-error")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()
            expect(page.locator("#verdict")).to_have_text("")
            expect(page.locator("#raw-report")).to_have_text("")
            assert_cleared()
            checked(device, "malformed pasted input clears stale PASS and raw report")
            if device == "desktop":
                screenshot("malformed")

            show_report("pass")
            missing = dict(reports["pass"])
            del missing["checks"]
            upload(json.dumps(missing), "missing-field.json")
            expect(page.locator("#import-error")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()
            checked(device, "missing required field rejects and clears prior report")

            show_report("pass")
            hostile = json.loads(serialized["pass"])
            hostile_text = '<img src="https://example.invalid/aftercheck-test" onerror="globalThis.aftercheckInjected=1"><script>globalThis.aftercheckInjected=2</script>'
            hostile["checks"][0]["reason"] = hostile_text
            hostile["limitations"].append(hostile_text)
            upload(json.dumps(hostile), "hostile-text.json")
            expect(page.locator("#report")).to_be_visible()
            expect(page.locator("#checks .check-reason").first).to_have_text(hostile_text)
            assert page.locator("#report img, #report script").count() == 0
            assert page.evaluate("typeof globalThis.aftercheckInjected") == "undefined"
            checked(device, "hostile markup stays inert text without elements or script execution")

            upload(b" " * (2 * 1024 * 1024 + 1), "oversized.json")
            expect(page.locator("#import-error")).to_contain_text("2 MiB")
            expect(page.locator("#report")).to_be_hidden()
            checked(device, "oversized file rejected before import")

            show_report("pass")
            upload(b'{"x":"\xc3("}', "invalid-utf8.json")
            expect(page.locator("#import-error")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()
            checked(device, "invalid UTF-8 rejects and clears prior report")

            duplicate = serialized["pass"].rstrip()[:-1] + ',"verdict":"PASS"}'
            upload(duplicate, "duplicate-key.json")
            expect(page.locator("#import-error")).to_contain_text("Duplicate")
            expect(page.locator("#report")).to_be_hidden()
            checked(device, "duplicate report key rejected")

            strict_inputs = []
            for key in ["__proto__", "constructor", "prototype"]:
                strict_inputs.append(("unsafe key " + key, serialized["pass"].rstrip()[:-1] + ',' + json.dumps(key) + ':{}}'))
            for name, patch in [
                ("contradictory execution PASS", {"execution": "REVERTED"}),
                ("contradictory incomplete PASS", {"coverage": "PARTIAL"}),
                ("contradictory unsupported PASS", {"support": "UNSUPPORTED"}),
                ("unknown top-level field", {"unexpected": True}),
                ("invalid digest", {"evidenceDigest": "0x1234"}),
                ("excess check count", {"checks": [{"id": f"check-{i}", "result": "PASS", "reason": "bounded"} for i in range(513)]}),
                ("excess text length", {"limitations": ["x" * 20001]}),
                ("duplicate check ID", {"checks": [reports["pass"]["checks"][0]] * 2}),
            ]:
                strict_inputs.append((name, json.dumps({**reports["pass"], **patch})))
            numeric_amount = json.loads(serialized["pass"])
            numeric_amount["protocol"]["amountInRaw"] = 9007199254740993
            strict_inputs.append(("unsafe numeric token amount", json.dumps(numeric_amount)))
            for name, source in strict_inputs:
                show_report("pass")
                upload(source, "invalid-report.json")
                expect(page.locator("#import-error")).to_be_visible()
                assert_cleared()
                checked(device, name + " rejected and all stale outcome content cleared")

            show_report("pass")
            page.locator("#clear-report").click()
            expect(page.locator("#empty-state")).to_be_visible()
            expect(page.locator("#report")).to_be_hidden()
            expect(page.locator("#report-text")).to_have_value("")
            expect(page.locator("#report-file")).to_be_focused()
            assert_cleared()
            checked(device, "clear action removes data and returns keyboard focus")

            if additional_report is not None:
                upload(additional_source, "captured-report.json")
                expect(page.locator("#report")).to_be_visible()
                expect(page.locator("#report-title")).to_have_text(additional_report["verdict"])
                for field in ["execution", "support", "coverage", "verdict"]:
                    expect(page.locator("#" + field)).to_have_text(additional_report[field])
                expect(page.locator("#evidence-class")).to_have_text(additional_report["evidenceClass"])
                if additional_report.get("transactionHash"):
                    expect(page.locator("#identity")).to_contain_text(additional_report["transactionHash"])
                if additional_report.get("protocol"):
                    expect(page.locator("#protocol")).to_contain_text(additional_report["protocol"]["amountOutRaw"])
                dimensions = page.evaluate("({viewport:innerWidth,page:document.documentElement.scrollWidth})")
                assert dimensions["page"] <= dimensions["viewport"], dimensions
                checked(device, "additional captured report renders its original identities and verdict")
                screenshot("captured-report")

            assert page.url == "about:blank"
            assert not summary["requests"], summary["requests"]
            assert not summary["pageErrors"], summary["pageErrors"]
            assert not summary["dialogs"], summary["dialogs"]
            checked(device, "zero attempted network requests, page errors, or dialogs")
            context.close()
        summary["result"] = "PASS"
    except Exception as error:
        if page is not None and not page.is_closed():
            try:
                failure_image = out / f"{device}-failure.png"
                page.screenshot(path=str(failure_image), full_page=True)
                summary["screenshots"].append(str(failure_image))
            except Exception as screenshot_error:
                summary["screenshotFailure"] = str(screenshot_error)
        summary["result"] = "FAIL"
        summary["failure"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        try:
            if browser is not None:
                browser.close()
            if playwright is not None:
                playwright.stop()
        except Exception as cleanup_error:
            summary["cleanupFailure"] = str(cleanup_error)
        summary["finishedAt"] = datetime.now(timezone.utc).isoformat()
        (out / "browser-results.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
