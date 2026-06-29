$ErrorActionPreference = "Stop"
$bridgeRoot = Join-Path $PSScriptRoot "..\..\sauron-vscode-bridge"
Push-Location $bridgeRoot
try {
  npm install
  npm run package:vsix
  Write-Host "Bridge VSIX: $(Join-Path $bridgeRoot 'dist\sauron-vscode-bridge.vsix')"
} finally {
  Pop-Location
}
