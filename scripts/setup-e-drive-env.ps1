# Stero Wrist — force heavy tooling onto E: (keep C: free)
# Run once in an elevated or normal PowerShell, then restart Cursor/terminals.
# Usage:
#   powershell -ExecutionPolicy Bypass -File "E:\Stero Wrist\scripts\setup-e-drive-env.ps1"
#   powershell -ExecutionPolicy Bypass -File "E:\Stero Wrist\scripts\setup-e-drive-env.ps1" -Migrate

param(
  [switch]$Migrate
)

$ErrorActionPreference = 'Stop'

$Root = 'E:\dev'
$Paths = [ordered]@{
  ANDROID_HOME      = "$Root\Android\Sdk"
  ANDROID_SDK_ROOT  = "$Root\Android\Sdk"
  GRADLE_USER_HOME  = "$Root\gradle"
  EXPO_CACHE_DIR    = "$Root\expo"
  TMP               = "$Root\temp"
  TEMP              = "$Root\temp"
}
# npm env keys (set separately; PowerShell hashtables are case-insensitive)
$NpmCache = "$Root\npm-cache"
$NpmPrefix = 'E:\npm-global'

Write-Host 'Creating E: directories...'
@(
  $Root,
  $Paths.ANDROID_HOME,
  $Paths.GRADLE_USER_HOME,
  $Paths.EXPO_CACHE_DIR,
  $NpmCache,
  $NpmPrefix,
  $Paths.TEMP,
  "$Root\node-gyp",
  "$Root\caches",
  'E:\Stero Wrist'
) | ForEach-Object {
  New-Item -ItemType Directory -Force -Path $_ | Out-Null
}

Write-Host 'Setting User environment variables...'
foreach ($key in $Paths.Keys) {
  [Environment]::SetEnvironmentVariable($key, $Paths[$key], 'User')
  Set-Item -Path "Env:$key" -Value $Paths[$key]
  Write-Host "  $key = $($Paths[$key])"
}
[Environment]::SetEnvironmentVariable('npm_config_cache', $NpmCache, 'User')
[Environment]::SetEnvironmentVariable('npm_config_prefix', $NpmPrefix, 'User')
$env:npm_config_cache = $NpmCache
$env:npm_config_prefix = $NpmPrefix
Write-Host "  npm_config_cache = $NpmCache"
Write-Host "  npm_config_prefix = $NpmPrefix"

# PATH: ensure E:\npm-global and Android platform-tools are present
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$add = @(
  $NpmPrefix,
  "$($Paths.ANDROID_HOME)\platform-tools",
  "$($Paths.ANDROID_HOME)\emulator",
  "$($Paths.ANDROID_HOME)\cmdline-tools\latest\bin"
)
$parts = @()
if ($userPath) { $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() } }
foreach ($p in $add) {
  if ($parts -notcontains $p) { $parts += $p }
}
[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
Write-Host '  Path updated (npm-global + Android tools)'

# npm user config (persists outside this shell; run outside project so project .npmrc cannot block prefix)
Push-Location $Root
try {
  npm config set cache $NpmCache --location=user
  npm config set prefix $NpmPrefix --location=user
  Write-Host '  npm cache/prefix written to user .npmrc'
} finally {
  Pop-Location
}

function Move-Or-Junction {
  param(
    [string]$Source,
    [string]$Destination,
    [string]$Label
  )
  if (-not (Test-Path $Source)) {
    Write-Host "  skip $Label (source missing): $Source"
    return
  }
  $item = Get-Item $Source -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Host "  skip $Label (already a junction/symlink): $Source"
    return
  }
  $destHasData = (Test-Path $Destination) -and ((Get-ChildItem $Destination -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)
  if ($destHasData) {
    Write-Host "  destination already has data for $Label -> $Destination"
    Write-Host "  leaving E: data in place; pointing old C: path at it..."
  } else {
    Write-Host "  moving $Label -> $Destination"
    New-Item -ItemType Directory -Force -Path (Split-Path $Destination) | Out-Null
    if (Test-Path $Destination) {
      Remove-Item -Path $Destination -Force -Recurse -ErrorAction SilentlyContinue
    }
    Move-Item -Path $Source -Destination $Destination -Force
  }
  if (Test-Path $Source) {
    # Source still present (dest already had data, or move failed) — quarantine then junction
    $backup = "$Source.pre-e-drive-backup"
    if (-not (Test-Path $backup)) {
      Rename-Item -Path $Source -NewName (Split-Path $backup -Leaf)
    } else {
      Remove-Item -Path $Source -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not (Test-Path $Source)) {
    cmd /c mklink /J "$Source" "$Destination"
    Write-Host "  junction: $Source => $Destination"
  } else {
    Write-Host "  WARN: could not create junction; source still exists: $Source"
  }
}

if ($Migrate) {
  Write-Host ''
  Write-Host 'Migrating existing C: caches to E: (junctions keep old paths working)...'
  Move-Or-Junction -Source "$env:USERPROFILE\.gradle" -Destination $Paths.GRADLE_USER_HOME -Label 'Gradle'
  Move-Or-Junction -Source "$env:USERPROFILE\.expo" -Destination $Paths.EXPO_CACHE_DIR -Label 'Expo'
  Move-Or-Junction -Source "$env:LOCALAPPDATA\npm-cache" -Destination $NpmCache -Label 'npm-cache'
  # Android SDK is large — move Local\Android\Sdk if present
  $sdkSrc = "$env:LOCALAPPDATA\Android\Sdk"
  if (Test-Path $sdkSrc) {
    Move-Or-Junction -Source $sdkSrc -Destination $Paths.ANDROID_HOME -Label 'Android SDK'
  } else {
    Write-Host '  skip Android SDK (not found under LocalAppData\Android\Sdk)'
    Write-Host '  Install / point Android Studio SDK location to E:\dev\Android\Sdk'
  }
} else {
  Write-Host ''
  Write-Host 'Env vars set. Existing C: caches were NOT moved.'
  Write-Host 'Re-run with -Migrate to move Gradle / Expo / npm / Android SDK to E:.'
}

Write-Host ''
Write-Host 'Done. Restart Cursor and any open terminals so new env vars apply.'
Write-Host 'Project root must stay: E:\Stero Wrist'
Write-Host 'Verify:  echo `$env:ANDROID_HOME; echo `$env:GRADLE_USER_HOME; npm config get cache'
