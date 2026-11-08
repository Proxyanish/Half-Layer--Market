#!/usr/bin/env bash
# The Half Layer · local server launcher (developed by Anish Luitel)
cd "$(dirname "$0")" || exit 1
if ! python3 -c "import pandas,numpy,scipy,matplotlib,plotly,yfinance,nbconvert,nbformat,nbclient,ipykernel,jinja2" >/dev/null 2>&1; then
  echo "First start: installing the Python packages the dashboards need (once)..."
  python3 -m pip install -r requirements.txt || { echo "Installation failed."; exit 1; }
fi
python3 serve_dashboard.py "$@"
