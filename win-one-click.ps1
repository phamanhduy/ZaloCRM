# win-one-click.ps1 - Chạy ZaloCRM All-in-One trên một cổng (3000)
# Chạy bằng lệnh: powershell -ExecutionPolicy Bypass -File .\win-one-click.ps1

$ErrorActionPreference = "Stop"

# 1. Cấu hình các đường dẫn
$BIN_DIR = Join-Path $PSScriptRoot "_bin"
$PG_DIR = Join-Path $BIN_DIR "pgsql"
$DATA_DIR = Join-Path $BIN_DIR "data"
$PG_ZIP = Join-Path $BIN_DIR "postgresql.zip"
$PG_URL = "https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64-binaries.zip"
$BACKEND_STATIC = Join-Path $PSScriptRoot "backend\static"

Write-Host "`n--- DANG KHOI DONG ZALOCRM ALL-IN-ONE ---" -ForegroundColor Cyan

# 2. Quản lý PostgreSQL (Setup & Start)
if (-not (Test-Path $BIN_DIR)) { New-Item -ItemType Directory -Path $BIN_DIR | Out-Null }

if (-not (Test-Path (Join-Path $PG_DIR "bin\psql.exe"))) {
    Write-Host "[1/5] Dang tai PostgreSQL Portable..." -ForegroundColor Yellow
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) { curl.exe -L -o $PG_ZIP $PG_URL }
    else { Invoke-WebRequest -Uri $PG_URL -OutFile $PG_ZIP }
    Expand-Archive -Path $PG_ZIP -DestinationPath $BIN_DIR -Force
    Remove-Item $PG_ZIP
}

if (-not (Test-Path (Join-Path $DATA_DIR "PG_VERSION"))) {
    Write-Host "[2/5] Khoi tao database..." -ForegroundColor Yellow
    & (Join-Path $PG_DIR "bin\initdb.exe") -D $DATA_DIR -U postgres --auth=trust --encoding=UTF8
}

$pg_isready = Join-Path $PG_DIR "bin\pg_isready.exe"
& $pg_isready -p 5432
if ($LASTEXITCODE -ne 0) {
    Write-Host "[3/5] Dang bat database..." -ForegroundColor Yellow
    & (Join-Path $PG_DIR "bin\pg_ctl.exe") -D $DATA_DIR -l (Join-Path $BIN_DIR "pg.log") start
    Start-Sleep -Seconds 2
}

# Đảm bảo database zalocrm tồn tại
try { & (Join-Path $PG_DIR "bin\createdb.exe") -U postgres zalocrm } catch {}

# 3. Cài đặt & Build Frontend
Write-Host "[4/5] Dang xay dung giao dien (Frontend Build)..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $PSScriptRoot "frontend\node_modules"))) {
    Set-Location (Join-Path $PSScriptRoot "frontend")
    npm install --legacy-peer-deps
}
Set-Location (Join-Path $PSScriptRoot "frontend")
npm run build

# Copy sang thu muc static cua backend
if (Test-Path $BACKEND_STATIC) { Remove-Item -Recurse -Force $BACKEND_STATIC }
New-Item -ItemType Directory -Path $BACKEND_STATIC | Out-Null
Copy-Item -Path "dist\*" -Destination $BACKEND_STATIC -Recurse -Force
Set-Location $PSScriptRoot

# 4. Cấu hình & Chạy Backend (Chế độ Production)
Write-Host "[5/5] Dang khoi dong Server (Port 3000)..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $PSScriptRoot "backend\node_modules"))) {
    Set-Location (Join-Path $PSScriptRoot "backend")
    npm install
}

# Đảm bảo file .env đúng cấu hình và nằm trong backend
if (-not (Test-Path (Join-Path $PSScriptRoot ".env"))) {
    Copy-Item (Join-Path $PSScriptRoot ".env.example") (Join-Path $PSScriptRoot ".env")
}
# Cập nhật NODE_ENV và DATABASE_URL
$env_content = Get-Content (Join-Path $PSScriptRoot ".env")
$new_env = $env_content | ForEach-Object {
    if ($_ -match "^NODE_ENV=") { "NODE_ENV=production" }
    elseif ($_ -match "^DATABASE_URL=") { "DATABASE_URL=`"postgresql://postgres@localhost:5432/zalocrm?schema=public`"" }
    else { $_ }
}
$new_env | Set-Content (Join-Path $PSScriptRoot ".env")
Copy-Item (Join-Path $PSScriptRoot ".env") (Join-Path $PSScriptRoot "backend\.env") -Force

Write-Host "`n--- ZALOCRM DANG CHAY TAI: http://localhost:3000 ---" -ForegroundColor Green
Write-Host "Luu y: Giao dien va API deu dung chung mot cong 3000." -ForegroundColor Gray

# Mở trình duyệt
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

# Chạy backend
Set-Location (Join-Path $PSScriptRoot "backend")
npm run dev
