@echo off
cd /d "%~dp0"
echo.
echo   With Alt1 running, paste this into your web browser address bar:
echo.
echo      alt1://addapp/http://localhost:8232/appconfig.json
echo.
echo   Leave this window open while you play. Close it to stop.
echo.
where node >nul 2>nul && (node tools\serve.js 8232 & goto :done)
where py >nul 2>nul && (py -m http.server 8232 -b 127.0.0.1 & goto :done)
where python >nul 2>nul && (python -m http.server 8232 -b 127.0.0.1 & goto :done)
echo   Node or Python is needed. Install one, then run this file again.
:done
pause
