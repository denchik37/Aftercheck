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
