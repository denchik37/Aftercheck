# Aftercheck CRE - Windows official simulator runner (LF-safe v3)
# Uses your existing locally authenticated CRE CLI; never reads or exports login secrets.
# Run in PowerShell. A fresh work directory is created on every invocation.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Native([string]$step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." }
}
function Require-Tool([string]$name) {
    if (-not (Get-Command -Name $name -ErrorAction SilentlyContinue)) {
        throw "$name is not on PATH. Reopen PowerShell and check your Git/Node/Bun/CRE installation."
    }
}
function Announce([string]$message) {
    Write-Host "`n== $message ==" -ForegroundColor Cyan
}

# Restore OS-level PATH entries that may have been lost when installing Bun
# without deleting existing session-specific entries (e.g. a Node version manager).
$paths = @(
    [Environment]::GetEnvironmentVariable('Path', 'Machine')
    [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path
    (Join-Path $HOME '.bun\bin')
    (Join-Path $env:ProgramFiles 'Git\cmd')
    (Join-Path $env:ProgramFiles 'nodejs')
)
$env:Path = ($paths | Where-Object { $_ -and $_.Trim() }) -join ';'

Announce 'Checking tools before changing files'
foreach ($tool in @('git.exe', 'node.exe', 'npm.cmd', 'bun.exe', 'cre.exe')) {
    Require-Tool $tool
}

$nodeVersion = (& node.exe --version).Trim()
Assert-Native 'Node version check'
$bunVersion = (& bun.exe --version).Trim()
Assert-Native 'Bun version check'
$creVersion = (& cre.exe version).Trim()
Assert-Native 'CRE version check'
& git.exe --version
Assert-Native 'Git version check'
& npm.cmd --version
Assert-Native 'npm version check'

if (-not ($nodeVersion -match '^v([0-9]+)\.')) {
    throw "Could not parse Node.js version: $nodeVersion."
}
if ([int]$Matches[1] -lt 24) {
    throw "Node.js 24+ required; found $nodeVersion."
}
if ($bunVersion -ne '1.4.4') { throw "Bun 1.4.4 required; found $bunVersion." }
if ($creVersion -notmatch '^CRE CLI version v1\.39\.0$') {
    throw "CRE CLI v1.39.0 required; found $creVersion."
}
Write-Host "PASS: $nodeVersion / Bun $bunVersion / $creVersion"

$folderName = 'aftercheck-cre-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6)
$work = Join-Path $HOME $folderName
$zip = Join-Path $work 'cre-evidence.zip'
$success = $false

try {
    Announce 'Cloning current public Aftercheck main (full history)'
    # Immutable published CRE manifest bytes must remain LF even when Git for Windows has core.autocrlf=true.
    # The resulting repo also keeps autocrlf=false so subsequent Git operations do not reintroduce CRLF.
    & git.exe -c core.autocrlf=false clone -c core.autocrlf=false https://github.com/denchik37/aftercheck.git $work
    Assert-Native 'Git clone with LF-safe checkout'
    Set-Location $work
    $revision = (& git.exe rev-parse HEAD).Trim()
    Assert-Native 'Git revision'
    $branch = (& git.exe branch --show-current).Trim()
    Assert-Native 'Git branch'
    if ($branch -ne 'main') { throw "Expected branch main; got $branch." }
    Write-Host "Source revision: $revision"
    $manifestPaths = @(
        'integrations/cre/public/reference.json',
        'integrations/cre/public/intentional-mismatch.json'
    )
    foreach ($manifestPath in $manifestPaths) {
        $manifestFullPath = Join-Path -Path $work -ChildPath $manifestPath
        $bytes = [System.IO.File]::ReadAllBytes($manifestFullPath)
        $foundCrlf = $false
        for ($i = 0; $i -lt ($bytes.Length - 1); $i++) {
            if ($bytes[$i] -eq 13 -and $bytes[$i + 1] -eq 10) { $foundCrlf = $true; break }
        }
        if ($foundCrlf) { throw "CRE manifest has CRLF checkout bytes: $manifestPath." }
    }
    Write-Host 'PASS: CRE manifests retain exact LF checkout bytes' -ForegroundColor Green

    Announce 'Installing locked core + CRE SDK dependencies'
    & npm.cmd ci --ignore-scripts --no-audit --no-fund
    Assert-Native 'Core npm ci'
    & npm.cmd --prefix integrations/cre/workflow ci --ignore-scripts --no-audit --no-fund
    Assert-Native 'CRE SDK npm ci'
    & npm.cmd run cre:manifest
    Assert-Native 'Public manifest validation'
    Write-Host 'PASS: immutable CRE manifest bytes match the retained capture' -ForegroundColor Green
    & npm.cmd --prefix integrations/cre/workflow run build
    Assert-Native 'Actual CRE WASM build'

    $creDir = Join-Path $work 'output\cre'
    New-Item -ItemType Directory -Path $creDir -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $creDir 'source-revision.txt') -Value $revision -Encoding Ascii
    $publicBase = 'https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public'

    function Run-CreCase([string]$name, [string]$manifest, [string]$target, [string]$expected) {
        Announce "Official CRE simulation: $name"
        & npm.cmd run cre:simulate -- --manifest "integrations/cre/public/$manifest.json" --manifest-url "$publicBase/$target.json" --output "output/cre/$name"
        Assert-Native "Official simulation $name"
        $resultPath = "output/cre/$name/result.json"
        $executionPath = "output/cre/$name/execution.json"
        if (-not (Test-Path -LiteralPath $resultPath)) { throw "$name produced no official result.json." }
        $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
        $execution = Get-Content -LiteralPath $executionPath -Raw | ConvertFrom-Json
        if ($result.status -ne $expected -or $result.metadata.executionMode -ne 'CRE_CLI_SIMULATION' -or $execution.outcome -ne 'VALIDATED_SIMULATOR_RESULT') {
            throw "$name failed validation: status=$($result.status), mode=$($result.metadata.executionMode), outcome=$($execution.outcome)."
        }
        Write-Host "PASS: official $name = $expected" -ForegroundColor Green
    }

    Run-CreCase 'reference' 'reference' 'reference' 'MATCH'
    Run-CreCase 'mismatch' 'intentional-mismatch' 'intentional-mismatch' 'MISMATCH'
    Run-CreCase 'unavailable' 'reference' 'unavailable' 'UNAVAILABLE'

    Announce 'Consuming official results inside Aftercheck'
    foreach ($case in @(
        @{ Name='reference'; Manifest='reference'; Expected='MATCH'; Exit=0 },
        @{ Name='mismatch'; Manifest='intentional-mismatch'; Expected='MISMATCH'; Exit=2 },
        @{ Name='unavailable'; Manifest='reference'; Expected='UNAVAILABLE'; Exit=3 }
    )) {
        $directory = "output/cre/$($case.Name)"
        & npm.cmd run cre:consume -- examples/sepolia/evidence.json examples/sepolia/policy-pass.json "integrations/cre/public/$($case.Manifest).json" "$directory/result.json" "$directory/aftercheck"
        $actual = $LASTEXITCODE
        if ($actual -ne $case.Exit) { throw "Consumer $($case.Name) returned $actual; expected $($case.Exit)." }
        $core = Get-Content -LiteralPath "$directory/aftercheck/core/report.json" -Raw | ConvertFrom-Json
        if ($core.verdict -ne 'PASS') { throw "Core verdict changed for $($case.Name): $($core.verdict)." }
        Write-Host "PASS: $($case.Name) consumed; core PASS unchanged; expected consumer exit $actual" -ForegroundColor Green
    }

    Announce 'Running independent core regression + demo'
    & npm.cmd run verify
    Assert-Native 'Core verify'
    & npm.cmd run demo
    Assert-Native 'Core demo'
    $success = $true
}
catch {
    Write-Host "`nSTOPPED at the first failing step: $($_.Exception.Message)" -ForegroundColor Red
    throw
}
finally {
    Set-Location $HOME
    $evidenceRoot = Join-Path $work 'output\cre'
    if (Test-Path -LiteralPath $evidenceRoot) {
        $entries = @(Get-ChildItem -LiteralPath $evidenceRoot -Force)
        if ($entries.Count -gt 0) {
            try {
                Compress-Archive -Path "$evidenceRoot\*" -DestinationPath $zip -Force
                Write-Host "`nEvidence archive: $zip"
                Write-Host 'Upload this archive to ChatGPT for verification. Do NOT upload CRE login or recovery files.'
            }
            catch { Write-Warning "Evidence packaging failed: $($_.Exception.Message)" }
        }
    }
}

if ($success) {
    Write-Host "`nSUCCESS: All three official CRE simulations, consumption, and core regression passed." -ForegroundColor Green
    Write-Host "Git revision: $revision"
    Write-Host "Evidence archive: $zip"
}