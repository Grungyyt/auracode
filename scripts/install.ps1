# Installation AuraCode (Windows, sans admin, sans release requise).
# Usage : irm https://raw.githubusercontent.com/Grungyyt/auracode/main/scripts/install.ps1 | iex
$ErrorActionPreference = "Stop"
$Base = "https://raw.githubusercontent.com/Grungyyt/auracode/main"
$Dir = Join-Path $env:LOCALAPPDATA "AuraCode"
$Bin = Join-Path $Dir "bin"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

# Node.js requis ?
try { $nv = node -v } catch { $nv = $null }
if (-not $nv) {
  Write-Host "Node.js introuvable, installation..."
  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

$pkg = Invoke-RestMethod -Uri "$Base/cli/package.json"
Write-Host "Installation AuraCode v$($pkg.version)..."
Invoke-WebRequest -Uri "$Base/cli/package.json" -OutFile (Join-Path $Dir "package.json")
Invoke-WebRequest -Uri "$Base/cli/bin/auracode.js" -OutFile (Join-Path $Bin "auracode.js")
@'
@echo off
node "%LOCALAPPDATA%\AuraCode\bin\auracode.js" %*
'@ | Out-File -Encoding ascii (Join-Path $Dir "auracode.cmd")

$path = [Environment]::GetEnvironmentVariable("Path", "User")
if ($path -notlike "*$Dir*") {
  [Environment]::SetEnvironmentVariable("Path", "$path;$Dir", "User")
  $env:Path += ";$Dir"
}
Write-Host "Installé. Ouvre un NOUVEAU terminal puis tape : auracode"
Write-Host "Mise à jour ensuite avec : auracode update"
