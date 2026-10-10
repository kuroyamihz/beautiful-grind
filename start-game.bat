@echo off
title Beautiful Grind
cd /d "%~dp0"
if exist .env (
  if not exist node_modules\@anthropic-ai\sdk (
    echo Installing the Claude connector, one moment...
    call npm install --no-fund --no-audit
  )
)
start "" http://localhost:3000
node --env-file-if-exists=.env server.js
pause
