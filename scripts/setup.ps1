$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Can cai Node.js 24 LTS truoc.' }
    if ([int](& node -p 'process.versions.node.split(".")[0]') -lt 22) { throw 'Can Node.js 22 tro len, khuyen nghi 24 LTS.' }
    & node scripts/configure.js
    if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc cau hinh.' }
    & npm.cmd run setup
    if ($LASTEXITCODE -ne 0) { throw 'Cai dependencies that bai. Kiem tra mang va npm.' }
    & npm.cmd run db:setup
    if ($LASTEXITCODE -ne 0) { throw 'Kiem tra SQL Server TCP/IP va DB_* trong backend-api/.env, roi chay lai setup.cmd. Khong xoa database.' }
    Write-Host 'Cai dat xong. Chay start.cmd de mo ung dung.'
} catch { Write-Error $_; exit 1 }
