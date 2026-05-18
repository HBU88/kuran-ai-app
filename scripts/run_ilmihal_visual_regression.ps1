param(
  [string]$Tag = 'kurban',
  [string]$EmulatorId = 'Pixel_6'
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverDir = Join-Path $root 'server'
$artifactsDir = Join-Path $root 'test_artifacts'
$logsDir = Join-Path $artifactsDir 'logs'
$screenshotsDir = Join-Path $artifactsDir 'screenshots'
$backendStdOutLog = Join-Path $logsDir 'ilmihal_visual_regression.backend.stdout.log'
$backendStdErrLog = Join-Path $logsDir 'ilmihal_visual_regression.backend.stderr.log'
$flutterLog = Join-Path $logsDir 'ilmihal_visual_regression.log'
$flutterStdOutLog = Join-Path $logsDir 'ilmihal_visual_regression.stdout.log'
$flutterStdErrLog = Join-Path $logsDir 'ilmihal_visual_regression.stderr.log'
$generatedDir = Join-Path $root 'integration_test/.generated'
$generatedFile = Join-Path $generatedDir 'ilmihal_visual_regression_cases.g.dart'
$caseFile = Join-Path $serverDir 'tests\ilmihal_regression_cases.json'
$adb = 'C:\Users\burak\AppData\Local\Android\Sdk\platform-tools\adb.exe'

function Write-Step {
  param([string]$Message)
  Write-Host $Message
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}

function Test-BackendHealthy {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/health' -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-BackendIfNeeded {
  if (Test-BackendHealthy) {
    Write-Step 'Backend already healthy on http://localhost:3000.'
    return $null
  }

  Write-Step 'Starting backend...'
  $process = Start-Process `
    -FilePath 'node' `
    -ArgumentList 'index.js' `
    -WorkingDirectory $serverDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendStdOutLog `
    -RedirectStandardError $backendStdErrLog `
    -PassThru

  for ($i = 0; $i -lt 60; $i++) {
    if (Test-BackendHealthy) {
      Write-Step 'Backend is healthy.'
      return $process
    }
    Start-Sleep -Seconds 1
  }

  throw 'Backend did not become healthy in time.'
}

function Get-ConnectedEmulatorId {
  if (-not (Test-Path -LiteralPath $adb)) {
    throw "adb not found at $adb"
  }

  $lines = & $adb devices
  foreach ($line in $lines) {
    if ($line -match '^(emulator-\d+)\s+device$') {
      return $Matches[1]
    }
  }

  return $null
}

function Wait-ForEmulatorBoot {
  param([string]$DeviceId)

  for ($i = 0; $i -lt 120; $i++) {
    $boot = & $adb -s $DeviceId shell getprop sys.boot_completed
    if ($LASTEXITCODE -eq 0 -and ($boot | ForEach-Object { $_.Trim() }) -contains '1') {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "Emulator $DeviceId did not finish booting."
}

function Ensure-Emulator {
  $deviceId = Get-ConnectedEmulatorId
  if ($deviceId) {
    Write-Step "Using connected emulator $deviceId."
    return $deviceId
  }

  Write-Step "Launching emulator $EmulatorId..."
  $flutterCmd = (Get-Command flutter).Source
  Start-Process -FilePath $flutterCmd -ArgumentList "emulators --launch $EmulatorId" -WindowStyle Hidden | Out-Null

  for ($i = 0; $i -lt 120; $i++) {
    $deviceId = Get-ConnectedEmulatorId
    if ($deviceId) {
      Wait-ForEmulatorBoot -DeviceId $deviceId
      Write-Step "Emulator ready: $deviceId"
      return $deviceId
    }
    Start-Sleep -Seconds 2
  }

  throw 'No emulator became available.'
}

function Clear-ArtifactFiles {
  if (Test-Path -LiteralPath $screenshotsDir) {
    Get-ChildItem -LiteralPath $screenshotsDir -Filter 'ilmihal_*_failure.png' -File -ErrorAction SilentlyContinue |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $logsDir) {
    Get-ChildItem -LiteralPath $logsDir -Filter 'ilmihal_visual_regression*' -File -ErrorAction SilentlyContinue |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

function Get-SelectedCases {
  param([string]$TagName)

  $raw = [System.IO.File]::ReadAllText($caseFile, [System.Text.Encoding]::UTF8)
  $cases = $raw | ConvertFrom-Json
  $selected = @()
  foreach ($case in $cases) {
    $tags = @()
    if ($case.tags) {
      $tags = @($case.tags)
    }
    if (-not $TagName -or $tags -contains $TagName) {
      $selected += $case
    }
  }

  return $selected
}

function ConvertTo-Base64Utf8 {
  param([string]$Text)

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  return [Convert]::ToBase64String($bytes)
}

Ensure-Directory -Path $screenshotsDir
Ensure-Directory -Path $logsDir
Ensure-Directory -Path $generatedDir
Clear-ArtifactFiles

if (-not (Test-Path -LiteralPath $caseFile)) {
  throw "Missing regression case file: $caseFile"
}

$selectedCases = Get-SelectedCases -TagName $Tag
if (-not $selectedCases -or $selectedCases.Count -eq 0) {
  throw "No ilmihal regression cases matched tag '$Tag'."
}

$casesJson = $selectedCases | ConvertTo-Json -Depth 10 -Compress
$casesBase64 = ConvertTo-Base64Utf8 -Text $casesJson
$generatedContent = @"
// GENERATED FILE. DO NOT EDIT BY HAND.
// The visual regression script rewrites this file before each run.
const String ilmihalVisualRegressionCasesBase64 = r"""$casesBase64""";
"@
Set-Content -LiteralPath $generatedFile -Value $generatedContent -Encoding utf8

Write-Step 'Checking backend...'
$null = Start-BackendIfNeeded

Write-Step 'Checking emulator...'
$deviceId = Ensure-Emulator

Write-Step 'Getting Flutter packages...'
& flutter pub get
if ($LASTEXITCODE -ne 0) {
  throw 'flutter pub get failed.'
}

Write-Step "Running ilmihal visual regression for tag '$Tag'..."
$flutterCmd = (Get-Command flutter).Source
$flutterProcess = Start-Process `
  -FilePath $flutterCmd `
  -ArgumentList @(
    'test',
    'integration_test/ilmihal_visual_regression_test.dart',
    '-d',
    $deviceId
  ) `
  -WorkingDirectory $root `
  -RedirectStandardOutput $flutterStdOutLog `
  -RedirectStandardError $flutterStdErrLog `
  -PassThru `
  -Wait
$exitCode = $flutterProcess.ExitCode

if (Test-Path -LiteralPath $flutterStdOutLog) {
  Get-Content -LiteralPath $flutterStdOutLog | Set-Content -LiteralPath $flutterLog
}
if (Test-Path -LiteralPath $flutterStdErrLog) {
  Get-Content -LiteralPath $flutterStdErrLog | Add-Content -LiteralPath $flutterLog
}

Get-Content -LiteralPath $flutterLog -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
  Write-Host "PASS: ilmihal visual regression completed for tag '$Tag'."
  Write-Host "Screenshots: $screenshotsDir"
  Write-Host "Logs: $logsDir"
  exit 0
} else {
  Write-Host "FAIL: ilmihal visual regression failed for tag '$Tag'."
  Write-Host "Screenshots: $screenshotsDir"
  Write-Host "Logs: $logsDir"
  exit $exitCode
}
