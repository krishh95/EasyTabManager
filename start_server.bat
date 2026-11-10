@echo off
title EasyTabManager CSV Server
echo Starting EasyTabManager with local CSV database...
cd /d "%~dp0"
python server.py
pause
