# Aftercheck CRE - resume an authenticated Windows CLI simulation from an existing checkout.
# Existing CRE login stays on the operator's machine. No private credentials are copied.
param(
    [Parameter(Mandatory = $true)]
    [string]$WorkDir
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Native([string]$step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." }
}
function Require-Tool([string]$tool) {
    if (-not (Get-Command -Name $tool -ErrorAction SilentlyContinue)) { throw "$tool is missing from PATH." }
}
function Announce([string]$title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}

# Restore the system and user PATH; preserve Node version manager and Bun entries.
$paths = @(
    [Environment]::GetEnvironmentVariable('Path', 'Machine')
    [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path
    (Join-Path $HOME '.bun\bin')
    (Join-Path $env:ProgramFiles 'Git\cmd')
    (Join-Path $env:ProgramFiles 'nodejs')
)
$env:Path = ($paths | Where-Object { $_ -and $_.Trim() }) -join ';'
foreach ($tool in @('git.exe', 'node.exe', 'npm.cmd', 'bun.exe', 'cre.exe')) { Require-Tool $tool }
if ((& bun.exe --version).Trim() -ne '1.4.4') { throw 'This workflow requires Bun 1.4.4.' }
Assert-Native 'Bun version check'
if ((& cre.exe version).Trim() -ne 'CRE CLI version v1.39.0') { throw 'This workflow requires CRE CLI 1.39.0.' }
Assert-Native 'CRE CLI version check'
if ([int]((& node.exe --version).Trim() -replace '^v(\d+)\..*$', '$1') -lt 24) { throw 'Node.js 24+ is required.' }
Assert-Native 'Node version check'

$work = (Resolve-Path -LiteralPath $WorkDir).ProviderPath
if (-not (Test-Path -LiteralPath (Join-Path $work '.git'))) { throw 'WorkDir is not a Git repository.' }
$session = 'resume-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
$outputRel = "output/cre/$session"
$outputFull = Join-Path $work $outputRel
$zip = Join-Path $work ("cre-evidence-$session.zip")
$originalLocation = Get-Location
$success = $false

try {
    Announce 'Checking and updating existing Aftercheck checkout'
    $origin = (& git.exe -C $work remote get-url origin).Trim()
    Assert-Native 'Git origin'
    if ($origin -ne 'https://github.com/denchik37/aftercheck.git') { throw 'Unexpected Git origin; refusing to run.' }
    $branch = (& git.exe -C $work branch --show-current).Trim()
    Assert-Native 'Git branch'
    if ($branch -ne 'main') { throw 'Existing checkout must be on main.' }
    $dirty = (& git.exe -C $work status --porcelain --untracked-files=no)
    Assert-Native 'Git tracked status'
    if ($dirty) { throw 'Tracked files are modified; refusing to overwrite them.' }
    & git.exe -C $work pull --ff-only origin main
    Assert-Native 'Fast-forward main'
    $revision = (& git.exe -C $work rev-parse HEAD).Trim()
    Assert-Native 'Source revision'
    Write-Host "Source revision: $revision"

    Set-Location -LiteralPath $work
    if (-not (Test-Path -LiteralPath 'integrations/cre/workflow/node_modules/@chainlink/cre-sdk/package.json')) {
        throw 'Locked CRE SDK dependencies are missing; this checkout has not been prepared.'
    }
    if (-not (Test-Path -LiteralPath 'integrations/cre/workflow/build/workflow.wasm')) {
        throw 'Compiled workflow.wasm is missing; compile first.'
    }
    Announce 'Validating published manifest integrity'
    & npm.cmd run cre:manifest
    Assert-Native 'Manifest integrity check'

    New-Item -ItemType Directory -Path $outputFull -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $outputFull 'source-revision.txt') -Value $revision -Encoding ascii
    $publicBase = 'https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public'

    function Run-OfficialCase([string]$name, [string]$manifest, [string]$urlName, [string]$expected) {
        Announce "Official CRE simulation: $name"
        $relativeResultDir = "$outputRel/$name"
        & npm.cmd run cre:simulate -- --manifest "integrations/cre/public/$manifest.json" --manifest-url ($publicBase + "/$urlName.json") --output $relativeResultDir
        Assert-Native "Official CRE simulation $name"
        $result = Get-Content -LiteralPath (Join-Path $relativeResultDir 'result.json') -Raw | ConvertFrom-Json
        $record = Get-Content -LiteralPath (Join-Path $relativeResultDir 'execution.json') -Raw | ConvertFrom-Json
        if ($result.status -ne $expected) { throw "$name result is $($result.status); expected $expected." }
        if ($result.metadata.executionMode -ne 'CRE_CLI_SIMULATION') { throw "$name is not an official CRE CLI simulation." }
        if ($record.outcome -ne 'VALIDATED_SIMULATOR_RESULT' -or $record.sourceRevision -ne $revision) {
            throw "$name execution record is unvalidated or bound to another revision."
        }
        Write-Host "PASS: $name = $expected (official CLI simulation)" -ForegroundColor Green
    }

    Run-OfficialCase 'reference' 'reference' 'reference' 'MATCH'
    Run-OfficialCase 'mismatch' 'intentional-mismatch' 'intentional-mismatch' 'MISMATCH'
    Run-OfficialCase 'unavailable' 'reference' 'unavailable' 'UNAVAILABLE'

    Announce 'Consuming source-bound results with the Aftercheck verifier'
    foreach ($case in @(
        @{ Name='reference'; Manifest='reference'; Exit=0 },
        @{ Name='mismatch'; Manifest='intentional-mismatch'; Exit=2 },
        @{ Name='unavailable'; Manifest='reference'; Exit=3 }
    )) {
        $dir = "$outputRel/$($case.Name)"
        & npm.cmd run cre:consume -- examples/sepolia/evidence.json examples/sepolia/policy-pass.json "integrations/cre/public/$($case.Manifest).json" "$dir/result.json" "$dir/aftercheck"
        $actual = $LASTEXITCODE
        if ($actual -ne $case.Exit) { throw "Aftercheck consumer for $($case.Name) returned $actual; expected $($case.Exit)." }
        $report = Get-Content -LiteralPath "$dir/aftercheck/core/report.json" -Raw | ConvertFrom-Json
        if ($report.verdict -ne 'PASS') { throw "Core financial verdict changed for $($case.Name)." }
        Write-Host "PASS: $($case.Name) consumed; core verdict unchanged" -ForegroundColor Green
    }

    Announce 'Core regression and replay'
    & npm.cmd run verify
    Assert-Native 'Core verification'
    & npm.cmd run demo
    Assert-Native 'Core demo'
    $success = $true
}
catch {
    Write-Host "STOPPED: $($_.Exception.Message)" -ForegroundColor Red
    throw
}
finally {
    Set-Location -LiteralPath $originalLocation
    if (Test-Path -LiteralPath $outputFull) {
        try {
            Compress-Archive -Path (Join-Path $outputFull '*') -DestinationPath $zip -Force
            Write-Host "Evidence archive: $zip"
            Write-Host 'Review archive contents before sharing. Never upload CRE login or recovery files.'
        }
        catch { Write-Warning "Evidence packaging failed: $($_.Exception.Message)" }
    }
}

if ($success) {
    Write-Host 'SUCCESS: 3 official CRE simulations, Aftercheck consumption, regression, and demo verified.' -ForegroundColor Green
    Write-Host "Git revision: $revision"
    Write-Host "Evidence archive: $zip"
}
