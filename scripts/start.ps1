$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Can cai Node.js 24 LTS.' }
    if (-not (Test-Path 'backend-api/.env')) { throw 'Chay node scripts/configure.js, dien cau hinh database, roi chay setup.cmd.' }
    if (-not (Test-Path 'backend-api/node_modules/express')) { throw 'Chay setup.cmd truoc.' }
    & npm.cmd run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Migration that bai. Xem loi o tren, khong xoa database.' }
    Write-Host 'Mo http://localhost:5000 (hoac PORT trong .env). Ctrl+C de dung.'
    & npm.cmd start
    exit $LASTEXITCODE
} catch { Write-Error $_; exit 1 }
