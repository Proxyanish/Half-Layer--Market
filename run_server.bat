@echo off
rem The Half Layer - local server launcher (developed by Anish Luitel)
cd /d "%~dp0"
where python >nul 2>nul && (python serve_dashboard.py %* & goto done)
where py >nul 2>nul && (py serve_dashboard.py %* & goto done)
echo.
echo Python was not found. Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH", then run this file again.
:done
echo.
pause
