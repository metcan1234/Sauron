# Publish Sauron Windows installer to GitHub Releases (requires: gh auth login)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Version = (Get-Content package.json | ConvertFrom-Json).version
$Artifact = Join-Path $Root "release" "Sauron-$Version-win-x64.exe"
$Tag = "v$Version"

if (-not (Test-Path $Artifact)) {
  throw "Installer not found: $Artifact — run npm run dist:win first."
}

gh auth status | Out-Null

$notes = @"
## Sauron $Version — Game Dev stabilite

### Indir
- ``Sauron-$Version-win-x64.exe`` — Windows kurulum

### Kurulum sonrasi (Game Dev)
1. Ayarlar → **Calisma Kismi yolu** = Unity proje klasorunuz (Assets/ iceren klasor)
2. Unity Editor → Package Manager → Git URL: ``https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main``
3. Unity Editor acikken Cline'da **gamedev-all-in-one** MCP sunucusunu baslatin
4. Panelde gorev yazin → **🎮** veya Enter

### Duzeltmeler
- Game Dev badge IPC yarisi (badge artik 1 sn sonra kapanmaz)
- VS Code guvenilir acilis
- ``gamedevModeActive`` kaliciligi
- Doctor: yanlis workspace uyarisi
"@

gh release create $Tag $Artifact `
  --repo metcan1234/Sauron `
  --title "Sauron $Version — Game Dev stabilite" `
  --notes $notes

Write-Host "Release published: https://github.com/metcan1234/Sauron/releases/tag/$Tag"
