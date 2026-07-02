# Sauron recovery — Explorer donmasi / panel tiklanmiyor sonrasi
$ErrorActionPreference = "Stop"

Write-Host "Sauron processleri kapatiliyor..."
Get-Process Sauron,electron -ErrorAction SilentlyContinue | Stop-Process -Force

$localWs = Join-Path $env:LOCALAPPDATA "Sauron\workspace"
New-Item -ItemType Directory -Force -Path $localWs | Out-Null

foreach ($cfgPath in @(
  (Join-Path $env:APPDATA "Sauron\config.json"),
  (Join-Path $env:APPDATA "sauron\config.json")
)) {
  if (-not (Test-Path $cfgPath)) { continue }
  $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $cfg.browserAgentEnabled = $false
  $cfg.workspacePath = $localWs
  $cfg.gamedevSetupComplete = $true
  $cfg.gamedevQuickSetupDismissed = $true
  $cfg | ConvertTo-Json -Depth 30 | Set-Content $cfgPath -Encoding UTF8
  Write-Host "Ayarlar duzeltildi: $cfgPath"
}

Write-Host "Explorer yeniden baslatiliyor..."
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process explorer

Write-Host "Tamam. Simdi Sauron v2.6.3 kur ve ac."
