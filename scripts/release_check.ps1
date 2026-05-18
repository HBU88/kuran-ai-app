param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$logRoot = Join-Path $ProjectRoot 'test_artifacts/logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

$results = New-Object System.Collections.ArrayList

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  $safeName = $Name -replace '[^a-zA-Z0-9_-]', '_'
  $logPath = Join-Path $logRoot ("release_check_{0}.log" -f $safeName)
  $started = Get-Date
  $status = 'PASS'
  $outputText = ''
  $previousErrorActionPreference = $ErrorActionPreference

  try {
    $ErrorActionPreference = 'Continue'
    $output = & $Command 2>&1
    $exitCode = $LASTEXITCODE
    if ($null -ne $output) {
      $outputText = ($output | Out-String).TrimEnd()
    }
    if ($exitCode -ne 0) {
      $status = 'FAIL'
    }
  } catch {
    $status = 'FAIL'
    $outputText = ($_ | Out-String).TrimEnd()
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  $content = @(
    "STEP: $Name",
    "STATUS: $status",
    "STARTED: $started",
    "FINISHED: $(Get-Date)",
    ''
  )
  if ($outputText) {
    $content += $outputText
  }
  Set-Content -Path $logPath -Value ($content -join "`r`n") -Encoding utf8

  Write-Host ($status + ': ' + $Name)
  [void]$results.Add([pscustomobject]@{
    Name = $Name
    Status = $status
    Log = $logPath
  })
}

Push-Location $ProjectRoot
try {
  Invoke-Step -Name 'flutter_clean' -Command { flutter clean }
  Invoke-Step -Name 'flutter_pub_get' -Command { flutter pub get }
  $serverRoot = Join-Path $ProjectRoot 'server'
  Invoke-Step -Name 'validate_ilmihal' -Command { npm --prefix $serverRoot run validate:ilmihal }
  Invoke-Step -Name 'test_chat' -Command { npm --prefix $serverRoot run test:chat }
  Invoke-Step -Name 'visual_smoke' -Command { powershell -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot 'scripts/run_visual_smoke.ps1') }
  Invoke-Step -Name 'flutter_analyze' -Command { flutter analyze }
  Invoke-Step -Name 'flutter_build_release' -Command { flutter build apk --release }
} finally {
  Pop-Location
}

$passed = @($results | Where-Object { $_.Status -eq 'PASS' }).Count
$failed = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count

Write-Host ''
Write-Host 'RELEASE CHECK SUMMARY'
Write-Host "PASS: $passed"
Write-Host "FAIL: $failed"
foreach ($result in $results) {
  Write-Host ("{0}: {1} ({2})" -f $result.Status, $result.Name, $result.Log)
}

if ($failed -gt 0) {
  exit 1
}
