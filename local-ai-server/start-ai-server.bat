@echo off
setlocal
cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22 LTS, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found.
  echo Reinstall Node.js 22 LTS, then run this file again.
  pause
  exit /b 1
)

if not exist dist (
  echo Preparing the app...
  call npm run build
  if errorlevel 1 (
    echo ERROR: App build failed.
    pause
    exit /b 1
  )
)

echo Starting Basketball Tactical Analyzer AI server...
echo Keep this window open while using AI analysis.
node local-ai-server\server.mjs

set "EXITCODE=%ERRORLEVEL%"
echo.
echo AI server stopped. Exit code: %EXITCODE%
pause
exit /b %EXITCODE%
