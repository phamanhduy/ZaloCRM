# dev.ps1 - Chạy cả Backend và Frontend trong môi trường phát triển (HMR)
# Cách chạy: .\dev.ps1

$PSScriptRoot = Get-Location

Write-Host "`n--- DANG KHOI DONG ZALOCRM (DEV MODE) ---" -ForegroundColor Cyan

# 1. Kiểm tra node_modules và .env
if (-not (Test-Path "$PSScriptRoot\backend\node_modules")) {
    Write-Host ">> Dang cai dat dependencies cho Backend..." -ForegroundColor Gray
    Set-Location "$PSScriptRoot\backend"
    npm install
}

if (-not (Test-Path "$PSScriptRoot\frontend\node_modules")) {
    Write-Host ">> Dang cai dat dependencies cho Frontend..." -ForegroundColor Gray
    Set-Location "$PSScriptRoot\frontend"
    npm install
}

if (-not (Test-Path "$PSScriptRoot\backend\.env")) {
    if (Test-Path "$PSScriptRoot\.env") {
        Copy-Item "$PSScriptRoot\.env" "$PSScriptRoot\backend\.env"
    } elseif (Test-Path "$PSScriptRoot\.env.example") {
        Copy-Item "$PSScriptRoot\.env.example" "$PSScriptRoot\backend\.env"
        Write-Host ">> Da tao file .env cho Backend tu .env.example. Vui long kiem tra lai cau hinh!" -ForegroundColor Yellow
    }
}

# 2. Khởi động Backend trong cửa sổ mới
Write-Host "[1/2] Dang khoi dong Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; npm run dev"

# 3. Khởi động Frontend trong cửa sổ mới
Write-Host "[2/2] Dang khoi dong Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`n--- TAT CA DA DUOC KHOI DONG ---" -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor Gray
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "Vui long kiem tra 2 cua so Terminal moi mo." -ForegroundColor Cyan

Set-Location $PSScriptRoot
