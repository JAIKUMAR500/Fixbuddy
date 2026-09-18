$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$nvmNode = "C:\nvm4w\nodejs"
if (Test-Path $nvmNode) {
  $env:Path = "$nvmNode;" + $env:Path
}

$studio = @(
  "$env:ProgramFiles\Android\Android Studio\bin\studio64.exe",
  "$env:ProgramFiles\Android\Android Studio\bin\studio.exe",
  "$env:LOCALAPPDATA\Programs\Android Studio\bin\studio64.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($studio) {
  $env:CAPACITOR_ANDROID_STUDIO_PATH = $studio
  npx cap open android
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Android Studio is not installed, so the phone app cannot open yet."
Write-Host "Install it from: https://developer.android.com/studio"
Write-Host "Then in this same folder run:  npm run android:open"
Write-Host ""
Write-Host "You are already in android-app. Do not run: cd android-app"
Write-Host "Opening the Android project folder in Explorer..."
Start-Process explorer.exe (Join-Path $root "android")
exit 1
