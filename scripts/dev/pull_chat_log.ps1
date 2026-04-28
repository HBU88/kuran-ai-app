$ErrorActionPreference = 'Stop'

$adb = 'C:\Users\burak\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$packageName = 'com.example.kuran_uygulamasi'
$remotePaths = @(
  '/data/data/com.example.kuran_uygulamasi/app_flutter/logs/chat_runtime_log.txt',
  '/data/data/com.example.kuran_uygulamasi/files/logs/chat_runtime_log.txt'
)
$destinationPath = 'C:\kuran_app\logs\chat_runtime_log.txt'
$destinationDir = Split-Path -Path $destinationPath -Parent
$tempPath = Join-Path $env:TEMP 'chat_runtime_log.pull.tmp'
$stderrPath = Join-Path $env:TEMP 'chat_runtime_log.pull.stderr.tmp'

if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb not found at $adb"
}

if (-not (Test-Path -LiteralPath $destinationDir)) {
  New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
}

if (Test-Path -LiteralPath $tempPath) {
  Remove-Item -LiteralPath $tempPath -Force
}

if (Test-Path -LiteralPath $stderrPath) {
  Remove-Item -LiteralPath $stderrPath -Force
}

function Try-RunAsCopy([string]$remotePath) {
  if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Force
  }
  if (Test-Path -LiteralPath $stderrPath) {
    Remove-Item -LiteralPath $stderrPath -Force
  }

  $process = Start-Process `
    -FilePath $adb `
    -ArgumentList @('exec-out', 'run-as', $packageName, 'cat', $remotePath) `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $tempPath `
    -RedirectStandardError $stderrPath

  if ($process.ExitCode -ne 0) {
    return $false
  }

  if (-not (Test-Path -LiteralPath $tempPath)) {
    return $false
  }

  $bytes = [System.IO.File]::ReadAllBytes($tempPath)
  return $bytes.Length -gt 0
}

if (-not ($remotePaths | Where-Object { Try-RunAsCopy $_ } | Select-Object -First 1)) {
  $stderr = if (Test-Path -LiteralPath $stderrPath) {
    [System.IO.File]::ReadAllText($stderrPath)
  } else {
    ''
  }
  throw "Failed to pull chat log from emulator. $stderr".Trim()
}

$bytes = [System.IO.File]::ReadAllBytes($tempPath)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$content = $utf8NoBom.GetString($bytes)
[System.IO.File]::WriteAllText($destinationPath, $content, $utf8NoBom)

Remove-Item -LiteralPath $tempPath -Force
if (Test-Path -LiteralPath $stderrPath) {
  Remove-Item -LiteralPath $stderrPath -Force
}

Write-Output 'Chat log pulled to C:\kuran_app\logs\chat_runtime_log.txt'
