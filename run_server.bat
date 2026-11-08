@echo off
rem The Half Layer - local server launcher (developed by Anish Luitel)
cd /d "%~dp0"
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py"
if not defined PY (
  echo.
  echo Python was not found. Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH", then run this file again.
  goto done
)
rem first start: install what the notebook needs (Refresh and Rebuild use it)
%PY% -c "import pandas,numpy,scipy,matplotlib,plotly,yfinance,nbconvert,nbformat,nbclient,ipykernel,jinja2" >nul 2>nul
if errorlevel 1 (
  echo.
  echo First start: installing the Python packages the dashboards need. This takes a few minutes and is done only once.
  %PY% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo The installation failed. Check your internet connection, then run this file again.
    goto done
  )
)
%PY% serve_dashboard.py %*
:done
echo.
pause
