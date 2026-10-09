# Installation AuraCode (Windows, sans admin).
# Usage : irm https://raw.githubusercontent.com/Grungyyt/auracode/main/scripts/install.ps1 | iex
$ErrorActionPreference = "Stop"
$Dir = Join-Path $env:LOCALAPPDATA "AuraCode"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$rel = Invoke-RestMethod -Uri "https://api.github.com/Grungyyt/auracode/releases/latest" -Headers @{"User-Agent" = "auracode-install" }
$asset = $rel.assets | Where-Object { $_.name -like "auracode*.exe" } | Select-Object -First 1
if (-not $asset) { throw "Aucun .exe trouvé dans la dernière release." }
Write-Host "Téléchargement $($rel.tag_name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile (Join-Path $Dir "auracode.exe") -Headers @{"User-Agent" = "auracode-install" }
$path = [Environment]::GetEnvironmentVariable("Path", "User")
if ($path -notlike "*$Dir*") {
  [Environment]::SetEnvironmentVariable("Path", "$path;$Dir", "User")
  $env:Path += ";$Dir"
}
Write-Host "Installé. Ouvre un NOUVEAU terminal puis tape : auracode"
