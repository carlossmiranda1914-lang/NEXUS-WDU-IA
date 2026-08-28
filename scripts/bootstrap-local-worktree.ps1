[CmdletBinding()]
param(
  [string]$ExpectedBranch = 'codex/academic-01-temporal-structure',
  [string]$ConfigSource = 'D:\NexusLocalConfig\NEXUS-WDU-IA\.env.test.local'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

if ((git branch --show-current).Trim() -ne $ExpectedBranch) { throw "Expected branch $ExpectedBranch." }
if (-not (Test-Path -LiteralPath $ConfigSource -PathType Leaf)) { throw 'Missing external local test configuration.' }
git check-ignore -q .env.test.local
if ($LASTEXITCODE -ne 0) { throw '.env.test.local must remain ignored.' }

$target = Join-Path $root '.env.test.local'
if (Test-Path -LiteralPath $target) {
  $targetItem = Get-Item -LiteralPath $target -Force
  if (-not $targetItem.LinkType) { throw 'Refusing to replace a non-link local configuration file.' }
} else {
  New-Item -ItemType HardLink -Path $target -Target $ConfigSource | Out-Null
}

$raw = Get-Content -LiteralPath $target -Raw
if ($raw -notmatch '127\.0\.0\.1:54329' -or $raw -notmatch 'nexus_fnd01_test' -or $raw -notmatch 'nexus_test_runner' -or $raw -notmatch '(?im)^TEST_DATABASE_URL=.*:[^@\r\n]+@') { throw 'External local test configuration does not match the approved disposable target.' }
$env:TEST_DATABASE_LOCAL_AUTHORIZED = 'true'
node scripts/nexus-test-db-safety.mjs
Write-Output 'NEXUS local worktree bootstrap: PASS'
