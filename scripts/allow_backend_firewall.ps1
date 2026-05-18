param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

$ruleName = "HAKAI Backend Dev Port $Port"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )) {
  throw 'Run this script from an elevated PowerShell session.'
}

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  $existing | Remove-NetFirewallRule -ErrorAction SilentlyContinue
}

New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Profile Any | Out-Null

Write-Host "Created firewall rule: $ruleName"
