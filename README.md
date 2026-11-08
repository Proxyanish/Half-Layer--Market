# Global Share Market Lab  ·  The Half Layer terminal
*Developed by Anish Luitel*

* `global_market_analysis.ipynb` – the notebook (formulas, explanations, charts, backtest). Already executed.
* `outputs/global_market_dashboard.html` – 15 indices + 20 mega-caps, USD.
* `outputs/canada_market_dashboard.html` – TSX blue-chips + world context, S&P/TSX benchmark, CAD.
* `dashboard_template/` – the dashboard's look and behaviour (`style.css`, `app.js`, `pro.js` = chart workstation, `index.html`, fonts, logo, `vendor/` = TradingView Lightweight Charts, Apache-2.0). **Keep this folder next to the notebook**; the notebook reads it when it builds a dashboard.

The dashboards are standalone files: they work offline and need no Python.

## Using the dashboard
Nine views on the left rail: WORLD · CHART · SIGNALS · SCREEN · RISK · LINKS · MIX · VALUE · TEST (keys `1`–`9`).
`/` jumps to any ticker. The TYPE / REGION filters apply across views. Click any table row or chart point to open it in CHART.
MIX has a risk dial along the efficient frontier; VALUE has live DCF sliders; TEST toggles the backtest rules. "Explain" hides the plain-English notes.

## Refresh on a computer without the server (shared files)
A dashboard opened as a plain file cannot talk to Yahoo, but it can download data that was built for it online. The workflow `.github/workflows/update-data.yml` rebuilds all four dashboards every weekday (22:30 UTC, after the US close) on GitHub, turns each into a small gzipped file with `publish_data.py` and publishes them on the `data` branch. In a dashboard opened without the server, **Refresh → Update now** (or the "Newer prices online" bar that appears on open) downloads the file for that dashboard, stores it in the browser (IndexedDB) and reloads, so everything is current: prices, risk, ratings, screens, valuations. **Back to the original data** undoes it. Holdings, alerts and layout are not touched.
One-time setup in GitHub (the data must be readable without signing in, so the repository that holds the `data` branch must be **public**):
1. Make the repository public (Settings → General → Danger zone → Change visibility), or create a second empty public repository for the data and in the code repository add the variable `DATA_REPO` (Settings → Secrets and variables → Actions → Variables) = `your-name/that-repo` and the secret `DATA_REPO_TOKEN` = a fine-grained token with Contents write access to it.
2. Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save.
3. Actions tab → **Update market data** → **Run workflow** (first run, about 10 to 20 minutes). After that it runs by itself every weekday.
4. If the data lives somewhere other than `https://raw.githubusercontent.com/Proxyanish/Half-Layer--Market/data/latest`, run `python set_data_url.py https://raw.githubusercontent.com/YOU/REPO/data/latest` (updates the built files and the notebook), or edit `data_url` in the notebook's CONFIG.
Data is public market data; the PIN does not protect it. Check the first run in the Actions tab.

## Prices that update by themselves
With the server running (`run_server.bat`), a dashboard checks its own age when you open it. If a newer trading day should exist and the data is older than the number of hours set in **Refresh** (default 6), a bar appears ("Updating prices"), the notebook rebuilds just that dashboard in the background (about 20 seconds for Global, up to a minute for Mega and Penny) and the page reloads on its own with the new prices. **Not now** skips it; the checkbox in the Refresh dialog turns it off or changes the hours. For prices that move while the page stays open, use **Live** on the chart. Without the server (a file opened straight from disk, or the phone link) nothing can update: prices are frozen at the build time.
Tip: to have the server always ready, put a shortcut to `run_server.bat` in the Windows Startup folder (press Win+R, type `shell:startup`).

## The launcher page (http://localhost:8765/)
With the server running, the home address now shows a launcher: one card per dashboard (Global, Canada, and any other you build) with a benchmark sparkline, market-regime gauge, 1-month and YTD returns, last price bar and how old the build is. Click a card to open it; click the logo inside a dashboard to come back. **Refresh data** on the launcher rebuilds through the same job as the dashboard's Refresh button. `/home` always shows the launcher, even if only one dashboard exists. "Developed by Anish Luitel" appears on every screen: the signature plate, every dialog, the chart watermark and the chart's bottom bar (also in fullscreen).

## Three dashboards, and adding any stock
`outputs/` holds **Global** (35 instruments), **Canada** (29) and **Mega 110** (9 indices + 110 of the largest US, Canadian, European and Asian companies, including Alphabet, Meta, Tesla and Berkshire). The launcher shows one card per dashboard, each with its own **Rebuild** button; **Rebuild all** runs them one after another (`HL_UNIVERSE` tells the notebook which universe to build).
Listing every stock in the world is not possible in one file (tens of thousands of tickers would be gigabytes), so instead you can **add any Yahoo Finance ticker** yourself: use **Add any stock** on the launcher, or **＋ Add a stock** at the top of the CHART watchlist (typing an unknown ticker in the search box also opens it). The server checks the symbol, saves it in `data/watchlist.csv`, and the next rebuild downloads its prices and adds it to every page of the dashboard you rebuild (about 20 seconds for Global, one to three minutes for Mega). Remove stocks with the ✕ on their chip. See `data/watchlist.example.csv` for the file format (`ticker,name,ccy`).

## Penny stocks and the SCREEN page
The **Penny stocks** dashboard (`outputs/penny_market_dashboard.html`, universe `"penny"`) lists US and Toronto-listed stocks priced under 5, found live by Yahoo's screener each time you rebuild (the most-traded first), with the Russell 2000 as the benchmark. It is rebuilt from its card on the launcher like the others; the list can change on every rebuild.
Every dashboard has a **SCREEN** page (key `4`). Click a quick list (All stocks, Strong buy, Potential increase, Triple signal, Uptrend, Breakouts, Oversold, Under 1, Easy to trade) or combine filter chips: price, analyst rating, potential increase (analyst target versus price), technical rating, trend, momentum, volume and risk. Each chip shows how many stocks would remain, the table is sortable, a row opens the chart and **Export CSV** saves the list. Every card and chip has an **i** that explains it.
Penny stocks are high risk (thin trading, big swings, many have no analyst coverage). The page shows a warning and is a research screen, not advice.

## PIN lock
Every dashboard and the launcher open on a PIN screen. Type the 4 digits on the keypad or keyboard; a tab that has entered the PIN stays unlocked until you press **Lock** (header) or close the tab, and five wrong tries mean a 30 second wait. Change it with `python set_pin.py 1234` (or turn it off with `python set_pin.py none`); this updates `dashboard_template/lock.js` and the dashboards already built. It is a **screen lock, not encryption**: only a salted hash of the PIN is stored, but the data is still inside the HTML file and a 4-digit PIN can be guessed by anyone who can read that file.

## "i" buttons and Info mode (explanations everywhere)
Every panel title, KPI tile, table column heading, slider, form field and chart-sidebar section has a small round **i**. Click it for a plain-English card: *what it is*, *how it works*, *what it affects*, plus a formula and a "how to read it" tip where useful.
Buttons and icon-only controls (header buttons, left rail, chart toolbar, drawing tools, tabs, gauges) show their **i** in the corner when you hover over them.
For **everything else** press **Info** in the header (or the `?` key): every explained element gets an orange outline and clicking it opens its card instead of doing its normal action. `Esc` leaves Info mode.
The texts live in `dashboard_template/help_data.js` and `help_data2.js` (one line per entry) so you can edit or translate them.

## The CHART view (TradingView-style workstation)
* **Toolbar:** timeframe 1D / 1W / 1M · chart type (candles, hollow, bars, Heikin Ashi, line, area, baseline) · **Indicators** (25, searchable, editable settings) · **Templates** · **Compare** (up to 4 symbols, % scale) · **Replay** · undo/redo · snapshot PNG · fullscreen.
* **Left rail:** cursor, trend line, ray, horizontal line, vertical line, rectangle, Fib retracement, measure, text · magnet · lock · hide · clear. Click a drawing to restyle it; drag to move; `Del` removes; `Esc` cancels. Shortcuts: Alt+T/Y/H/V/R/F/M/N, Ctrl+Z / Ctrl+Y, Space = play/pause replay.
* **Right panel:** watchlist with sparklines, instrument details, and a layers list (indicators + drawings).
* **Bottom bar:** range buttons and `%` / `log` / `auto` price scales. Drag the pane separators to resize indicator panes.
* Indicator layout and drawings are remembered in your browser (per ticker for drawings).
* Daily data only (no intraday). Prices on the chart are in each instrument's local currency.

## Local server: refresh, intraday, live (optional)
```bash
python serve_dashboard.py          # or ./run_server.sh  /  run_server.bat
```
Then open **http://localhost:8765**. The dashboards work without it; the server adds:
* **Refresh button** (top right): re-runs the notebook in the background and reloads with fresh data (about 15–60 s).
* **Intraday timeframes** 1m / 5m / 15m / 1h on the chart and a **Live** button (updates every 20 s, folds today's session into the daily bar while the market is open, and checks your alerts against 1-minute bars). Intraday history is limited by Yahoo: 1m ≈ 7 days, 5m/15m ≈ 60 days, 1h ≈ 2 years.
* **Save to a folder** (see Sync below). Only listens on 127.0.0.1; actions that write files need the token it prints (pages it serves get the token automatically).

## Sync: keep your portfolio, alerts and layout safe (top-right **Sync** button)
1. **Google Drive** ("Connect Google"): saves `hl_state.json` into a *The Half Layer* folder of your Drive; the app can only see files it creates. One-time setup: in console.cloud.google.com create a project, enable the *Google Drive API*, configure the OAuth consent screen (add yourself as a test user), create an *OAuth client ID* of type *Web application* with the authorized JavaScript origin `http://localhost:8765`, and paste the Client ID into the Sync dialog. Open the dashboard from `http://localhost:8765` (Google does not allow sign-in from a file opened directly).
2. **Folder on your computer**: `python serve_dashboard.py --state-dir "~/Google Drive/My Drive/TheHalfLayer"` and Google Drive for desktop syncs it for you, with no sign-in.
3. **Backup file**: download / restore a `.json` any time, no server needed.
Auto-save (a few seconds after each change) can be switched on for Drive and the folder.

## MINE: your own portfolio (top-right **My portfolio** button, key `9`)
* **Add stocks** in the page: ticker, shares, average cost per share (in the stock's own currency), optional purchase date. Pick the **currency of your cost** (costs are converted to your base currency at that day's rate). Add the same ticker again to merge lots; ✎ edits, ✕ removes. Saved in your browser. **Import CSV / Export CSV** also work.
* Works immediately for the 35 built-in instruments. For **any other ticker**: click **Export CSV**, save it as `data/my_portfolio.csv` next to the notebook (see `data/my_portfolio.example.csv`), and run the notebook once. It downloads the new tickers, and they then get the full workstation (chart, technicals, analyst rating). You can also list them in `CONFIG["my_holdings"]`.
* The page shows value, unrealised P&L (FX-aware), today, beta, volatility, drawdown, allocation (holding / sector / region / currency), time-weighted performance vs the benchmark, risk contribution, correlations, stress tests, a rebalancing helper, a health check, and technical + analyst ratings per holding.

## CHART panels: technicals, alerts, volume profile
* **TECH tab**: TradingView-style gauge (Strong sell … Strong buy) from 11 oscillators + 15 moving averages, "More technicals" tables, pivot points, and the **analyst rating** gauge with the 1-year price target (can be projected on the chart).
* **Price alerts**: click the **+** on the price axis, right-click → Add alert, or the bell tool (Alt+A). Drag lines to move them. Saved in the browser and re-checked against new data each time the dashboard is rebuilt. They also fire during Replay.
* **Volume profile**: *Volume Profile (Visible Range)* indicator and the *Fixed Range Volume Profile* tool (Alt+P), with POC and value area.

## Run the notebook yourself
```bash
pip install -r requirements.txt
jupyter lab global_market_analysis.ipynb      # Kernel > Restart & Run All
```

## Switch things in the CONFIG cell
| Setting | Options |
|---|---|
| `universe` | `"global"`, `"canada"`, `"custom"` (edit `CUSTOM_UNIVERSE`) |
| `benchmark` | `"auto"` or any ticker |
| `base_currency` | `"auto"`, `"local"`, or `"USD"`, `"CAD"`, `"EUR"` ... |
| `data_source` | `"yfinance"`, `"csv"`, `"sample"` |

Each universe writes `outputs/<universe>_market_dashboard.html`.
To restyle the dashboard, edit `dashboard_template/style.css` (colours are variables at the top) and re-run the last notebook cells.

*Educational tool – not financial advice.*
