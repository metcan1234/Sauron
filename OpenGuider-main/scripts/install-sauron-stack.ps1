$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
$bridgeRoot = Join-Path $scriptRoot "..\..\sauron-vscode-bridge"
$vsixPath = Join-Path $bridgeRoot "dist\sauron-vscode-bridge.vsix"

Write-Host "=== Sauron Stack Kurulumu ===" -ForegroundColor Cyan

Push-Location $bridgeRoot
try {
  Write-Host "Bridge bagimliliklari kuruluyor..."
  npm install
  Write-Host "Bridge VSIX paketleniyor..."
  npm run package:vsix
} finally {
  Pop-Location
}

if (-not (Test-Path $vsixPath)) {
  Write-Error "VSIX bulunamadi: $vsixPath"
}

$codeCmd = Get-Command code -ErrorAction SilentlyContinue
if (-not $codeCmd) {
  Write-Warning "VS Code CLI (code) PATH'te yok. VSIX hazir: $vsixPath"
  Write-Warning 'Command Palette -> Shell Command: Install "code" command in PATH'
  exit 1
}

Write-Host "Bridge extension kuruluyor..."
& code --install-extension $vsixPath --force

Write-Host ""
Write-Host "=== Kurulum tamamlandi ===" -ForegroundColor Green
Write-Host "VSIX: $vsixPath"
Write-Host "Sonraki adim: Sauron Core -> Ayarlar -> Sistem tanisi calistir"
