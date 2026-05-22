@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\npm.cmd" run dev > dev-server.log 2>&1
