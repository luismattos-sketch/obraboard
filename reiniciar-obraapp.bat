@echo off
cd /d "%~dp0"
echo Encerrando servidor antigo na porta 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)
echo.
echo Iniciando ObraApp...
echo Mantenha esta janela aberta enquanto usa o sistema.
echo.
npm run dev:turbo
pause
