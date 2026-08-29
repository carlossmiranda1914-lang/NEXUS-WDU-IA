[CmdletBinding()]
param(
  [string]$ConfigSource = 'D:\NexusLocalConfig\NEXUS-WDU-IA\.env.test.local',
  [string]$FirebaseUid = $env:NEXUS_UAT_FIREBASE_UID
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

& (Join-Path $PSScriptRoot 'bootstrap-local-worktree.ps1') -ConfigSource $ConfigSource
$env:TEST_DATABASE_LOCAL_AUTHORIZED = 'true'

if (-not $FirebaseUid -and (Test-Path '.env.test.local')) {
  $uidLine = Get-Content '.env.test.local' | Where-Object { $_ -match '^\s*NEXUS_UAT_FIREBASE_UID\s*=\s*(.+?)\s*$' } | Select-Object -First 1
  if ($uidLine -match '^\s*NEXUS_UAT_FIREBASE_UID\s*=\s*(.+?)\s*$') { $FirebaseUid = $matches[1].Trim().Trim('"').Trim("'") }
}
if (-not $FirebaseUid) { throw 'NEXUS_UAT_FIREBASE_UID must be set in ignored external local configuration for the canonical UAT administrative account.' }
if ($FirebaseUid -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'NEXUS_UAT_FIREBASE_UID is invalid.' }
$env:NEXUS_UAT_FIREBASE_UID = $FirebaseUid

npx tsx scripts/bootstrap-local-uat.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output 'NEXUS local UAT bootstrap: PASS'
