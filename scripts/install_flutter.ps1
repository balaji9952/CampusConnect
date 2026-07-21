$ErrorActionPreference = "Stop"
$flutterZipUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.44.5-stable.zip"
$zipPath = "$env:TEMP\flutter.zip"
$extractPath = "C:\src"
$flutterBinPath = "$extractPath\flutter\bin"

Write-Host "Creating C:\src directory..."
if (-not (Test-Path $extractPath)) {
    New-Item -ItemType Directory -Force -Path $extractPath | Out-Null
}

Write-Host "Downloading Flutter SDK... This will take a few minutes."
curl.exe -L -o $zipPath $flutterZipUrl

Write-Host "Extracting Flutter SDK to $extractPath..."
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

Write-Host "Adding Flutter to User PATH..."
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if (-not ($userPath -match [regex]::Escape($flutterBinPath))) {
    $newPath = "$userPath;$flutterBinPath"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    Write-Host "Added $flutterBinPath to PATH."
} else {
    Write-Host "Flutter is already in the PATH."
}

Write-Host "Cleaning up..."
Remove-Item -Path $zipPath -Force

Write-Host "Flutter installation complete! Please close and reopen your PowerShell window to use the 'flutter' command."
