# build-release.ps1
# Script to build and package ZaloCRM for release

$ReleaseDir = "release"
$RootDir = Get-Location

# 1. Clean release directory
if (Test-Path $ReleaseDir) {
    Write-Host "Cleaning existing release directory..." -ForegroundColor Cyan
    Remove-Item -Path $ReleaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

# 2. Build Frontend
Write-Host "Building Frontend..." -ForegroundColor Cyan
Set-Location "$RootDir/frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }

# 3. Build Backend
Write-Host "Building Backend..." -ForegroundColor Cyan
Set-Location "$RootDir/backend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed"; exit 1 }

# 4. Copy Backend Files
Write-Host "Copying Backend files..." -ForegroundColor Cyan
Copy-Item -Path "$RootDir/backend/dist" -Destination $ReleaseDir -Recurse -Force
Copy-Item -Path "$RootDir/backend/package.json" -Destination "$ReleaseDir/package.json"
Write-Host "Copying libraries (node_modules)..." -ForegroundColor Cyan
Copy-Item -Path "$RootDir/backend/node_modules" -Destination "$ReleaseDir/node_modules" -Recurse -Force

# 5. Copy Frontend dist to static
Write-Host "Copying Frontend assets to static..." -ForegroundColor Cyan
Copy-Item -Path "$RootDir/frontend/dist" -Destination "$ReleaseDir/static" -Recurse -Force
if (Test-Path "$ReleaseDir/static/dist") {
    Move-Item -Path "$ReleaseDir/static/dist/*" -Destination "$ReleaseDir/static" -Force
    Remove-Item -Path "$ReleaseDir/static/dist" -Recurse -Force
}

# 6. Copy Config & Database
Write-Host "Copying configuration and database..." -ForegroundColor Cyan
if (Test-Path "$RootDir/backend/.env") {
    Copy-Item -Path "$RootDir/backend/.env" -Destination "$ReleaseDir/.env"
} elseif (Test-Path "$RootDir/.env") {
    Copy-Item -Path "$RootDir/.env" -Destination "$ReleaseDir/.env"
}

if (Test-Path "$RootDir/backend/zalocrm.db") {
    Copy-Item -Path "$RootDir/backend/zalocrm.db" -Destination "$ReleaseDir/zalocrm.db"
}

# 7. Create Start Script
Write-Host "Creating start scripts..." -ForegroundColor Cyan
$StartBat = @"
@echo off
SET NODE_ENV=production
echo Starting ZaloCRM...
node dist/app.js
pause
"@
$StartBat | Out-File -FilePath "$ReleaseDir/start.bat" -Encoding ascii

Set-Location $RootDir
Write-Host "Release build complete! Folder: $ReleaseDir" -ForegroundColor Green
