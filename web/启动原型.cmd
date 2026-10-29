@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.12+ or 24, then retry.
  pause
  exit /b 1
)
node "%~dp0scripts\start-local.mjs" %*
if errorlevel 1 pause
endlocal
