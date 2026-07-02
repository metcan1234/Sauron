# Sauron recovery — Explorer donmasi / panel tiklanmiyor sonrasi
$ErrorActionPreference = "Stop"

function Set-JsonProp {
  param($obj, [string]$name, $value)
  if (-not ($obj.PSObject.Properties.Name -contains $name)) {
    $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value
  } else {
    $obj.$name = $value
  }
}

function Repair-SauronConfig {
  param([string]$cfgPath, [string]$localWs)

  $parent = Split-Path $cfgPath -Parent
  if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  if (-not (Test-Path $cfgPath)) {
    '{}' | Set-Content -Path $cfgPath -Encoding UTF8
  }

  try {
    $raw = Get-Content -Path $cfgPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { $raw = '{}' }
    $cfg = $raw | ConvertFrom-Json
  } catch {
    $cfg = [pscustomobject]@{}
  }

  Set-JsonProp $cfg "browserAgentEnabled" $false
  Set-JsonProp $cfg "workspacePath" $localWs
  Set-JsonProp $cfg "gamedevSetupComplete" $true
  Set-JsonProp $cfg "gamedevQuickSetupDismissed" $true

  $cfg | ConvertTo-Json -Depth 40 | Set-Content -Path $cfgPath -Encoding UTF8
  Write-Host "Ayarlar duzeltildi: $cfgPath"
}

Write-Host "Sauron processleri kapatiliyor..."
Get-Process Sauron,electron -ErrorAction SilentlyContinue | Stop-Process -Force

$localWs = Join-Path $env:LOCALAPPDATA "Sauron\workspace"
New-Item -ItemType Directory -Force -Path $localWs | Out-Null

$candidatePaths = @(
  (Join-Path $env:APPDATA "Sauron\config.json"),
  (Join-Path $env:APPDATA "sauron\config.json"),
  (Join-Path $env:LOCALAPPDATA "Sauron\config.json"),
  (Join-Path $env:LOCALAPPDATA "sauron\config.json")
)

$seen = @{}
foreach ($cfgPath in $candidatePaths) {
  if (-not $cfgPath -or $seen.ContainsKey($cfgPath.ToLower())) { continue }
  $seen[$cfgPath.ToLower()] = $true
  if ((Test-Path $cfgPath) -or $cfgPath -like "*\AppData\Roaming\Sauron\config.json") {
    Repair-SauronConfig -cfgPath $cfgPath -localWs $localWs
  }
}

Write-Host "Explorer yeniden baslatiliyor..."
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process explorer

Write-Host "Tamam. Simdi Sauron v2.6.3 kur ve ac."
