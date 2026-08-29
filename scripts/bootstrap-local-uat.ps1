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

if ($FirebaseUid) {
  if ($FirebaseUid -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'NEXUS_UAT_FIREBASE_UID is invalid.' }
  $env:NEXUS_UAT_FIREBASE_UID = $FirebaseUid
}

npx tsx scripts/bootstrap-local-uat.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output 'NEXUS local UAT bootstrap: PASS'
