$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
$projectRoot = Split-Path $scriptRoot -Parent
$mcpRoot = Join-Path $projectRoot "extensions\gamedev-all-in-one"

Write-Host "=== Sauron Unity Stack Kurulumu ===" -ForegroundColor Cyan

if (-not (Test-Path $mcpRoot)) {
  Write-Error "gamedev-all-in-one bulunamadi: $mcpRoot"
}

Push-Location $mcpRoot
try {
  Write-Host "Game Dev MCP build..."
  npm install
  npm run build
} finally {
  Pop-Location
}

$stackScript = Join-Path $scriptRoot "install-sauron-stack.ps1"
if (Test-Path $stackScript) {
  Write-Host "Sauron Bridge stack..."
  & $stackScript
}

Write-Host ""
Write-Host "=== Unity stack hazir ===" -ForegroundColor Green
Write-Host "Sonraki: Unity Editor acik + MCP plugin (TCP 7890) + Sauron Game Dev modu"
