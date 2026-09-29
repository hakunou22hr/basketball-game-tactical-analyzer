@echo off
setlocal
cd /d "%~dp0"

if not exist node.exe (
  echo ERROR: Portable node.exe was not found.
  echo Please download and extract the complete portable ZIP again.
  pause
  exit /b 1
)

if not exist local-ai-server\.env.local (
  if exist local-ai-server\.env.example (
    copy /Y local-ai-server\.env.example local-ai-server\.env.local >nul
  ) else (
    > local-ai-server\.env.local echo OPENAI_API_KEY=
    >> local-ai-server\.env.local echo OPENAI_MODEL=gpt-4.1-mini
    >> local-ai-server\.env.local echo PORT=8787
  )
  echo First-time setup:
  echo A settings file has been created.
  echo Enter your OpenAI API key after OPENAI_API_KEY=, save, close Notepad,
  echo then run START-AI-SERVER.bat again.
  start "" notepad.exe local-ai-server\.env.local
  pause
  exit /b 0
)

findstr /B /C:"OPENAI_API_KEY=" local-ai-server\.env.local | findstr /V /C:"OPENAI_API_KEY=$" >nul
if errorlevel 1 (
  echo ERROR: OPENAI_API_KEY is empty.
  echo Opening the settings file now.
  start "" notepad.exe local-ai-server\.env.local
  pause
  exit /b 1
)

echo Starting Basketball Tactical Analyzer...
echo No installation is required.
echo Keep this black window open while using AI analysis.
echo.
echo Open this address in your browser after the server starts:
echo http://localhost:8787
echo.
node.exe local-ai-server\server.mjs

echo.
echo AI server stopped.
pause
