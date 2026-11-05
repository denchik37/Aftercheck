# Windows PowerShell quickstart

Get a historical Sepolia swap report working **offline first**, then optionally collect fresh read-only RPC observations. Use Windows PowerShell or PowerShell 7 in a normal, non-administrator terminal. Copy commands without a `PS>` prompt; run them in order and stop if a command fails.

## 1. Check Git and Node.js

```powershell
git --version
node --version
npm.cmd --version
```

Successful commands print version numbers. Aftercheck's [package metadata](../package.json) requires **Node.js 24 or newer**: `v24.x.x` and `v26.x.x` are supported majors. Keep an existing supported Node.js 26 installation; there is no need to downgrade. npm prints a separate version such as `11.x.x`.

| Tool | Why it is here |
|---|---|
| Git for Windows | Downloads a checkout and updates it while preserving version history. |
| Node.js | Runs Aftercheck locally. Install a supported Windows version from [nodejs.org](https://nodejs.org/en/download) if missing; the installer includes npm. |
| npm | Installs the locked development tools and runs the commands in `package.json`. Use **`npm.cmd`** in PowerShell. |
| GitHub CLI (`gh`) | Optional GitHub account/PR tooling. It is not Git and is not needed to clone this public repository or run Aftercheck. |

**Git missing?** The [official Git Windows installation page](https://git-scm.com/install/windows) provides an installer and this WinGet command:

```powershell
winget install --id Git.Git -e --source winget
```

After installation, **completely close and reopen your terminal application**, then run `git --version` again. A terminal that was already open may still have its old PATH. If WinGet is unavailable, use the installer linked above.

**Still seeing `git : The term 'git' is not recognized`?** Check a common installation location:

```powershell
Test-Path "C:\Program Files\Git\cmd\git.exe"
```

Only if that prints `True`, add that directory to this PowerShell process's PATH and retry:

```powershell
$env:Path += ";C:\Program Files\Git\cmd"
git --version
```

This is a temporary change for the current session, not a system-wide setting. Install locations vary. If the file is absent, locate the Git installation through Windows Installed apps or rerun the official installer to check its destination; do not add an invented directory to PATH. A Git-free source ZIP route is also possible.

**Seeing `npm.ps1 cannot be loaded because running scripts is disabled`?** Use `npm.cmd` wherever you would otherwise type `npm`:

```powershell
npm.cmd --version
```

This selects npm's Windows command launcher. Leave PowerShell's execution policy unchanged. Ordinary npm commands here need no administrator privileges. After installing Node, reopen the terminal if `node` or `npm.cmd` is still not found.

## 2. Obtain the repository and enter it

For a first checkout, check whether the destination already exists:

```powershell
cd $HOME
Test-Path .\aftercheck
```

If that prints `False`, clone the public repository. No GitHub login is needed:

```powershell
git clone https://github.com/denchik37/aftercheck.git
if ($LASTEXITCODE -ne 0) { throw "Clone failed. Read the error before continuing." }
cd .\aftercheck
```

If the folder already exists, **do not clone over it**. Enter your existing checkout instead:

```powershell
cd "$HOME\aftercheck"
git status --short
git branch --show-current
```

If `git status --short` prints nothing and the branch is `main`, update it with:

```powershell
git pull --ff-only
```

If there are local changes, a different branch, or a fast-forward error, preserve your work and resolve that condition first. Do not reset or discard files to follow this guide. If the existing folder is not an Aftercheck checkout, choose another empty destination and use its path throughout.

From now on, commands assume **the repository root**, normally `$HOME\aftercheck`. Confirm it:

```powershell
Get-Location
Test-Path .\package.json
Test-Path .\web\inspector.html
Test-Path .\examples\sepolia\evidence.json
```

All three checks must print `True`. If any prints `False`, enter the extracted/cloned directory containing those files before running npm. Running from your Windows profile directory alone will not work.

## 3. Produce the first reports without RPC

Initial source download and dependency installation need network access. From the repository root, install the lockfile's development dependencies, run the type check and Node tests, then reproduce the demo:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw "Verification failed. Read the test output." }
npm.cmd run demo
if ($LASTEXITCODE -ne 0) { throw "Demo failed. Earlier reports may still exist." }
```

`npm.cmd run verify` runs development checks; the separate CLI `verify` subcommand below re-evaluates one evidence bundle. The demo succeeds only after verifying its three expected reports and each CLI exit code:

| Report to import | Execution | Support | Evidence coverage | Policy verdict | Individual CLI exit |
|---|---|---|---|---|---|
| `output\demo\pass\report.json` | SUCCEEDED | SUPPORTED | COMPLETE | PASS | 0 |
| `output\demo\violation\report.json` | SUCCEEDED | SUPPORTED | COMPLETE | VIOLATION | 2 |
| `output\demo\reserve\report.json` | SUCCEEDED | SUPPORTED | PARTIAL | UNKNOWN | 3 |

**Aftercheck can report a financial-policy violation even when the blockchain transaction succeeded.** The input-cap policy deliberately fails; the reserve requirement remains unproved. UNKNOWN is not PASS. The overall demo exits 0 when all three expected outcomes are reproduced.

These are three **retrospective policies against one unchanged historical transaction**, executed by a third party on 12 February 2025 and captured read-only on 5 November 2026. This is not a newly executed swap, and the policies are not claimed to be the original trader's instructions. See the [retained case and provenance](../examples/sepolia/README.md).

### Find and open the first report

```powershell
Test-Path .\output\demo\pass\report.json
(Resolve-Path .\output\demo\pass\report.json).Path
explorer.exe (Resolve-Path .\output\demo\pass).Path
Start-Process -FilePath (Resolve-Path .\web\inspector.html).Path
```

`True` means the file exists; `False` means it does not exist at that location. `Resolve-Path` requires an existing file and prints its absolute path. These relative paths work from the repository root.

The last command opens the local **HTML inspector** in your default browser. Use its **Open a report** file picker to select `output\demo\pass\report.json`; paste the printed absolute path into the file dialog if locating it is difficult. Then import the violation and reserve reports to compare outcomes. Select `report.json`, not `evidence.json` or `policy.json`.

The inspector displays a saved report; it does not independently recompute the blockchain verification. The other files in each output directory are `evidence.json`, `policy.json` and the readable `report.md`. If `.html` is associated with an editor, use File Explorer's **Open with** and choose a browser.

## 4. Reproduce the historical case directly

This standalone command requires no RPC configuration:

```powershell
npm.cmd run cli -- verify .\examples\sepolia\evidence.json .\examples\sepolia\policy-pass.json .\output\offline-pass
$LASTEXITCODE
```

Expected console status: `execution=SUCCEEDED support=SUPPORTED evidence=COMPLETE verdict=PASS`, with exit 0. The CLI prints the resolved output directory. Your report is `output\offline-pass\report.json`, normally `$HOME\aftercheck\output\offline-pass\report.json`.

After download and setup, retained-evidence replay and local report viewing need no GitHub, RPC, Aftercheck server, wallet or transaction signing. The CLI itself has no runtime npm dependencies; the installed development tools are for `npm.cmd run verify`. Replay checks the saved bundle's internal consistency. It does not refresh finality or authenticate its original provider.

PASS applies only to the supported receipt-scoped policy checks under their stated assumptions. It is not a full account-balance verification, an independent consensus proof, a security audit or protection for real funds. See [protocol scope and trust limits](PROTOCOL.md).

## 5. Optional: collect fresh read-only Sepolia observations

Only do this after the offline workflow succeeds. Configure the documented public, keyless endpoint in **the current PowerShell session**:

```powershell
$env:AFTERCHECK_RPC_URL = "https://sepolia.gateway.tenderly.co"
```

Then run this single-line command from the repository root:

```powershell
npm.cmd run cli -- inspect 0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9 .\examples\sepolia\policy-pass.json .\output\inspection
$LASTEXITCODE
```

This reads the **existing** transaction, receipt and historical protocol observations from one provider, evaluates the supplied retrospective policy, and publishes evidence, policy, JSON and Markdown together. It does not execute a swap. When the provider supplies all the required observations, expect `execution=SUCCEEDED support=SUPPORTED evidence=COMPLETE verdict=PASS` and exit 0. Missing observations may produce UNKNOWN or a reported command failure; public endpoints can fail or rate-limit requests.

Historical reads must be bound to the transaction's block hash. There is no fallback to current/latest chain state. The endpoint has [previously passed a separate public-example smoke check](https://github.com/denchik37/aftercheck/actions/runs/42092888204); that earlier run is not a guarantee of availability now. The deterministic Windows test does not use a live provider.

### Where is `report.json`?

For the command above, it is at **`$HOME\aftercheck\output\inspection\report.json`** when you cloned under `$HOME\aftercheck`. `$HOME` normally means your Windows profile directory. If you chose another checkout or extraction location, the output is inside that location instead.

```powershell
Test-Path .\output\inspection\report.json
(Resolve-Path .\output\inspection\report.json).Path
Get-Item .\output\inspection\report.json | Select-Object FullName, LastWriteTime, Length
explorer.exe (Resolve-Path .\output\inspection).Path
Start-Process -FilePath (Resolve-Path .\web\inspector.html).Path
```

Check that the command just completed successfully before using an existing file. Open the HTML in the browser, then import **`output\inspection\report.json`** through the inspector's file picker. Opening the JSON directly in a browser does not load it into the inspector. The inspector displays the saved result; use CLI `verify` to re-evaluate evidence.

The provider sees your IP address and the public blockchain data requested. No wallet, seed phrase, private key, funded account, token approval, signing, broadcasting or Aftercheck account is required. If you choose a credentialed RPC URL, keep it out of public issues, screenshots, logs, reports and the repository; avoid entering it in saved shell history. Remove the variable when finished if desired:

```powershell
Remove-Item Env:AFTERCHECK_RPC_URL -ErrorAction SilentlyContinue
```

## 6. Exit codes and recovery

Read `$LASTEXITCODE` **immediately after** the CLI command, before another native program changes it. For `inspect` and CLI `verify`:

| Exit | Meaning | What to do |
|---|---|---|
| 0 | PASS | Read the report's supported scope and limitations. |
| 2 | VIOLATION | Read which financial-policy check failed. This is a completed evaluation, not a CLI crash. |
| 3 | UNKNOWN | Read the missing/conflicting/unsupported evidence and unresolved checks. Do not treat it as PASS. |
| 1 | Invalid input or another reported command failure | Read the console error; a fresh complete report was not published. |

The four result dimensions answer different questions: **execution** describes the transaction, **support** describes the admitted protocol profile, **coverage** describes the evidence, and **verdict** describes the supplied financial policy. Successful blockchain execution can accompany VIOLATION or UNKNOWN. `collect` alone has a different contract: exit 0 means collection completed, not policy PASS. `npm.cmd run verify` and `npm.cmd run demo` exit 0 only when their own checks succeed.

### Avoid mistaking an old report for a new result

**A previously existing report directory is not proof that the latest command succeeded.** If a new operation fails before publishing a complete replacement, earlier output can remain. Check the CLI exit code and console message, resolved location, file modification time and report verdict together. A timestamp or file's existence alone is not enough.

When investigating a failure, use a new, empty output directory rather than overwriting your prior evidence. This example chooses a new name automatically:

```powershell
$attempt = Join-Path .\output ("inspection-" + [guid]::NewGuid().ToString("N"))
npm.cmd run cli -- inspect 0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9 .\examples\sepolia\policy-pass.json $attempt
$LASTEXITCODE
```

Use dedicated output folders. Aftercheck rejects unrelated files or nested entries in a managed output directory. A successful evidence-only `collect` replaces that directory's managed set, removing its previous policy and reports; do not use your saved report folder for a collection you want to keep separately. If the CLI reports `OUTPUT_ROLLBACK_FAILED`, preserve the sibling backup directory named in its recovery message.

### If RPC collection fails

Keep the actual error/UNKNOWN result; do not relabel it as PASS or borrow current-state reads. Return to the standalone offline command in section 4, which writes **`output\offline-pass`**, separate from the failed live attempt. Offline replay reproduces the retained capture under a retrospective policy; it does not refresh finality or the source's historical authenticity. Do not automatically substitute another provider and present its observations as the same attempt.

| Symptom | Bounded recovery |
|---|---|
| `AFTERCHECK_RPC_URL_REQUIRED` | Set the public endpoint in the same PowerShell session, or use offline CLI `verify`. |
| RPC HTTP/remote/timeout error, or UNKNOWN | Preserve the status and use retained evidence. Retry later into a fresh directory if fresh observations are needed. |
| npm cannot find `package.json`, or `Test-Path` is `False` | Use `Get-Location` and return to the repository root; repeat the three checks in section 2. |
| `INVALID_INPUT` or a missing policy/report file | Check the exact path and file type. Import `report.json`; CLI `verify` takes `evidence.json` plus a separate policy. |
| The HTML opens in an editor or no browser opens | Find `web\inspector.html` in File Explorer and use **Open with** to select your browser. |

## Validation boundary

The dedicated [Windows workflow](../.github/workflows/windows-quickstart.yml) runs the actual PowerShell/npm/CLI path using committed evidence; its source revision, OS, shell and Node/npm versions, test results and resolved report paths are retained as CI evidence. A workflow definition is not itself a passing run: use the linked PR's completed checks and logs to determine the tested revision.

The existing Ubuntu browser harness checks the inspector's HTML in an isolated Chromium `about:blank` page. It does **not** establish a manual Windows `file://` launch, Explorer window, default-browser association or file-picker interaction. No test of your own computer is implied. Git/Node installer dialogs, PATH refresh in an already open terminal and the interactive desktop steps require operator confirmation on that machine. Nothing here requires a hosted Aftercheck service or DigitalOcean deployment.

External command references: [Git for Windows](https://git-scm.com/install/windows), [Node.js downloads](https://nodejs.org/en/download), [Microsoft Start-Process](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process), and [PowerShell execution policies](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies).
