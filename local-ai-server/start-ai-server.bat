@echo off
chcp 65001 > nul
cd /d "%~dp0.."
where node > nul 2>&1
if errorlevel 1 (
  echo Node.jsが見つかりません
  echo Node.js 22をインストールしてから、もう一度実行してください。
  pause
  exit /b 1
)
if not exist dist (
  echo アプリを準備しています...
  call npm run build
  if errorlevel 1 (
    echo アプリの準備に失敗しました。
    pause
    exit /b 1
  )
)
node local-ai-server/server.mjs
pause
