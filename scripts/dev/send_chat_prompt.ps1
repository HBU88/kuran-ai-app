param(
  [Parameter(Mandatory = $true)]
  [string]$Text
)

$ErrorActionPreference = 'Stop'

$adb = 'C:\Users\burak\AppData\Local\Android\Sdk\platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb not found at $adb"
}

$base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Text))
$remoteCommand = 'sh -c ''s=$(echo ' + $base64 + ' | base64 -d); input text "$s"'''

& $adb shell $remoteCommand
