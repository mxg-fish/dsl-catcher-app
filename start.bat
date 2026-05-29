@echo off
echo Starting DSL Catcher Tracker...

start "DSL Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --port 8000 --reload"

timeout /t 2 /nobreak >nul

start "DSL Frontend" cmd /k "cd /d %~dp0frontend && npm run preview -- --port 5173 --host"

timeout /t 3 /nobreak >nul

echo.
echo App running at: http://localhost:5173
echo Backend API at: http://localhost:8000
echo.
echo Default login: admin / marlins2025
echo.
start http://localhost:5173
