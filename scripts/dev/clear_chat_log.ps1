$ErrorActionPreference = 'Stop'

$adb = 'C:\Users\burak\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$packageName = 'com.hakai.app'
$remotePath = '/data/data/com.hakai.app/app_flutter/logs/chat_runtime_log.txt'
$hostPath = 'C:\kuran_app\logs\chat_runtime_log.txt'

if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb not found at $adb"
}

& $adb shell "run-as $packageName sh -c 'rm -f app_flutter/logs/chat_runtime_log.txt'"

if (Test-Path -LiteralPath $hostPath) {
  Remove-Item -LiteralPath $hostPath -Force
}

Write-Output 'Chat runtime log cleared.'
