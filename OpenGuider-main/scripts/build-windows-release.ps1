# Sauron Windows release build (NSIS installer)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BridgeRoot = Join-Path (Split-Path -Parent $Root) "sauron-vscode-bridge"

Write-Host "==> Sauron Windows release build"
Set-Location $Root

Write-Host "==> npm ci (OpenGuider-main)"
npm ci

if (Test-Path $BridgeRoot) {
  Write-Host "==> Bridge VSIX package (sauron-vscode-bridge)"
  Set-Location $BridgeRoot
  npm ci
  npm run package:vsix
  Set-Location $Root
} else {
  throw "sauron-vscode-bridge not found at $BridgeRoot"
}

Write-Host "==> pre-dist checks"
node scripts/pre-dist-check.js

Write-Host "==> dist:win (NSIS)"
npm run dist:win

$Version = (Get-Content package.json | ConvertFrom-Json).version
$Artifact = Join-Path $Root "release" "Sauron-$Version-win-x64.exe"
if (Test-Path $Artifact) {
  Write-Host "Release artifact: $Artifact"
} else {
  Write-Warning "Expected installer not found at $Artifact - check release/ folder."
}
