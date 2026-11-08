#!/usr/bin/env python3
"""The Half Layer – local companion server.            Developed by Anish Luitel

Run it next to the notebook, then open  http://localhost:8765  in your browser:

    python serve_dashboard.py
    python serve_dashboard.py --state-dir "~/Google Drive/My Drive/TheHalfLayer"      # sync your portfolio/alerts via Google Drive for desktop

What it adds to the dashboard (the HTML works without it, just without these extras):
  * intraday bars (1m / 5m / 15m / 1h) and live updates       -> /api/intraday
  * a "Refresh" button that re-runs the notebook in the background and rebuilds the dashboard     -> /api/refresh
  * saving your holdings, alerts, drawings and layout to a folder on your computer                -> /api/state

Security: it listens on 127.0.0.1 only; actions that change files (refresh, save state) need the token printed at start-up
(it is injected automatically into pages served by this server).
"""
import argparse, json, os, re, secrets, shutil, subprocess, sys, threading, time, traceback
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

VERSION = "1.0"
HERE = os.path.dirname(os.path.abspath(__file__))
ALLOWED_INTERVALS = {"1m": ("1m", "5d"), "2m": ("2m", "5d"), "5m": ("5m", "30d"), "15m": ("15m", "60d"), "30m": ("30m", "60d"), "60m": ("60m", "365d"), "1h": ("60m", "365d")}
RANGE_LIMITS = {"1m": 7, "2m": 60, "5m": 60, "15m": 60, "30m": 60, "60m": 730, "1h": 730}
SYMBOL = re.compile(r"^[A-Za-z0-9\.\-\^=_]{1,24}$")

args = None
TOKEN = ""
_cache = {}
_cache_lock = threading.Lock()
JOB = {"state": "idle", "started": None, "finished": None, "log": [], "returncode": None}
JOB_LOCK = threading.Lock()


REQUIRED = ["pandas", "numpy", "scipy", "matplotlib", "plotly", "yfinance", "nbconvert", "nbformat", "nbclient", "ipykernel", "jinja2"]


def missing_packages():
    """Python packages the notebook needs that are not installed (so the Refresh button can say so instead of failing)."""
    import importlib.util
    out = []
    for m in REQUIRED:
        try:
            if importlib.util.find_spec(m) is None:
                out.append(m)
        except Exception:
            out.append(m)
    return out


INSTALL_HINT = "python -m pip install -r requirements.txt"


def yf_available():
    try:
        import yfinance  # noqa: F401
        return True
    except Exception:
        return False


# ------------------------------------------------------------------ intraday
def intraday(symbol, interval, rng=None):
    if interval not in ALLOWED_INTERVALS:
        raise ValueError("interval must be one of " + ", ".join(ALLOWED_INTERVALS))
    yf_interval, default_range = ALLOWED_INTERVALS[interval]
    period = rng or default_range
    m = re.match(r"^(\d+)d$", period)
    if not m or int(m.group(1)) > RANGE_LIMITS[interval]:
        period = default_range
    key = (symbol, yf_interval, period)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < 15:
            return hit[1]
    import pandas as pd
    import yfinance as yf
    tk = yf.Ticker(symbol)
    df = tk.history(period=period, interval=yf_interval, auto_adjust=False, prepost=False)
    if df is None or df.empty:
        raise RuntimeError(f"no intraday data returned for {symbol} ({interval}, {period})")
    idx = df.index
    local = idx.tz_localize(None) if getattr(idx, "tz", None) is not None else idx      # exchange wall-clock time, shown as-is on the chart
    ts = ((local - pd.Timestamp("1970-01-01")) // pd.Timedelta("1s")).astype("int64")
    bars = []
    for t, (o, h, l, c, v) in zip(ts.tolist(), df[["Open", "High", "Low", "Close", "Volume"]].itertuples(index=False, name=None)):
        if any(x != x for x in (o, h, l, c)):
            continue
        bars.append([int(t), round(float(o), 4), round(float(h), 4), round(float(l), 4), round(float(c), 4), int(v) if v == v else 0])
    meta = {}
    try:
        md = tk.history_metadata or {}
        meta = {"currency": md.get("currency"), "exchange": md.get("exchangeName"), "tz": md.get("exchangeTimezoneName")}
        if meta["tz"]:                                              # seconds the exchange clock is ahead of UTC right now (lets the page tell if the market is open)
            from zoneinfo import ZoneInfo
            meta["offset"] = int(datetime.now(ZoneInfo(meta["tz"])).utcoffset().total_seconds())
    except Exception:
        pass
    out = {"symbol": symbol, "interval": interval, "period": period, "bars": bars, "fetched": datetime.utcnow().isoformat() + "Z", **meta}
    with _cache_lock:
        _cache[key] = (now, out)
        if len(_cache) > 120:
            _cache.clear()
    return out


# ------------------------------------------------------------------ refresh job (re-runs the notebook)
def known_universes():
    """Universes that have a dashboard in the outputs folder (name_market_dashboard.html), plus 'global' when nothing exists yet."""
    d = os.path.join(HERE, args.dashboards)
    names = sorted(re.sub(r"_market_dashboard\.html$", "", f) for f in os.listdir(d) if f.endswith("_market_dashboard.html")) if os.path.isdir(d) else []
    return names or ["global"]


def run_refresh(clear_cache, universes=None):
    """Re-run the notebook once per universe (HL_UNIVERSE tells the notebook which one to build)."""
    with JOB_LOCK:
        if JOB["state"] == "running":
            return False
        miss = missing_packages()
        if miss:
            JOB.update(state="error", started=time.time(), finished=time.time(), returncode=1,
                       log=["Cannot rebuild yet: these Python packages are not installed: " + ", ".join(miss),
                            "Install them once (in the project folder):  " + INSTALL_HINT,
                            "Then press Refresh again. (run_server.bat does this for you at the next start.)"])
            return True
        JOB.update(state="running", started=time.time(), finished=None, log=[], returncode=None)
    todo = universes or known_universes()
    def work():
        try:
            if clear_cache:
                shutil.rmtree(os.path.join(HERE, "cache"), ignore_errors=True)
                JOB["log"].append("cache cleared")
            nb = os.path.join(HERE, args.notebook)
            rc = 0
            for n, u in enumerate(todo, 1):
                JOB["log"].append(f"=== ({n}/{len(todo)}) building '{u}' ===")
                cmd = [sys.executable, "-m", "nbconvert", "--to", "notebook", "--execute", "--inplace",
                       "--ExecutePreprocessor.timeout=3000", "--ExecutePreprocessor.kernel_name=python3", nb]
                env = dict(os.environ, HL_UNIVERSE=u)
                p = subprocess.Popen(cmd, cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
                for line in p.stdout:
                    line = line.rstrip()
                    if line:
                        JOB["log"].append(line[:300]); JOB["log"] = JOB["log"][-80:]
                p.wait(); rc = rc or p.returncode
                JOB["log"].append(f"'{u}': " + ("done" if p.returncode == 0 else f"FAILED (exit {p.returncode})"))
            JOB["returncode"] = rc
            JOB["state"] = "done" if rc == 0 else "error"
        except Exception as e:
            JOB["log"].append("error: " + str(e)); JOB["state"] = "error"
        finally:
            JOB["finished"] = time.time()
    threading.Thread(target=work, daemon=True).start()
    return True


# ------------------------------------------------------------------ stocks added from the dashboard (data/watchlist.csv)
def watch_path():
    return os.path.join(HERE, "data", "watchlist.csv")


def read_watch():
    import csv
    p = watch_path(); out = []
    if os.path.exists(p):
        with open(p, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                t = (r.get("ticker") or "").strip().upper()
                if t:
                    out.append({"t": t, "name": (r.get("name") or "").strip(), "ccy": (r.get("ccy") or "").strip().upper()})
    return out


def write_watch(rows):
    import csv
    os.makedirs(os.path.dirname(watch_path()), exist_ok=True)
    with open(watch_path(), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["ticker", "name", "ccy"])
        for r in rows:
            w.writerow([r["t"], r.get("name", ""), r.get("ccy", "")])


def lookup(sym):
    """Check that Yahoo Finance knows a ticker and return its name, currency and last price."""
    sym = sym.strip().upper()
    if sym.startswith("^"):
        return {"ok": False, "t": sym, "error": "Indices cannot be added here. Add a stock or ETF symbol."}
    import yfinance as yf
    t = yf.Ticker(sym)
    h = t.history(period="5d", auto_adjust=True)
    if h is None or h.empty or h["Close"].dropna().empty:
        return {"ok": False, "t": sym, "error": "No price data found. Check the symbol on finance.yahoo.com (for example GOOGL, RY.TO, 7203.T)."}
    try:
        info = t.info or {}
    except Exception:
        info = {}
    ccy = info.get("currency") or ""
    ccy = {"GBp": "GBX", "GBX": "GBX", "ZAc": "ZAC"}.get(ccy, ccy.upper())
    return {"ok": True, "t": sym, "name": info.get("shortName") or info.get("longName") or sym, "exchange": info.get("fullExchangeName") or info.get("exchange") or "",
            "currency": ccy, "price": float(h["Close"].dropna().iloc[-1]), "type": info.get("quoteType") or ""}


# ------------------------------------------------------------------ saved state (holdings, alerts, drawings, layout)
def state_path():
    return os.path.join(os.path.expanduser(args.state_dir), "hl_state.json")


def read_state():
    p = state_path()
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def write_state(obj):
    d = os.path.dirname(state_path()); os.makedirs(d, exist_ok=True)
    p = state_path()
    if os.path.exists(p):                                           # keep the last 10 versions
        stamp = datetime.fromtimestamp(os.path.getmtime(p)).strftime("%Y%m%d-%H%M%S")
        shutil.copy2(p, os.path.join(d, f"hl_state.{stamp}.json"))
        old = sorted(f for f in os.listdir(d) if re.match(r"hl_state\.\d{8}-\d{6}\.json$", f))
        for f in old[:-10]:
            try: os.remove(os.path.join(d, f))
            except OSError: pass
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, p)


# ------------------------------------------------------------------ HTTP

_META_CACHE = {}
def dash_meta(fname):
    """Small summary of one generated dashboard (read from its embedded data block, cached by modification time)."""
    p = os.path.join(HERE, args.dashboards, fname)
    try:
        st = os.stat(p)
    except OSError:
        return {"file": fname}
    key = (fname, st.st_mtime_ns)
    if key in _META_CACHE:
        return _META_CACHE[key]
    out = {"file": fname, "size_mb": round(st.st_size / 1e6, 1), "modified": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")}
    try:
        with open(p, "rb") as fh:
            raw = fh.read()
        a = raw.find(b'<script id="data" type="application/json">')
        b = raw.find(b"</script>", a) if a >= 0 else -1
        if a >= 0 and b > a:
            d = json.loads(raw[a + len(b'<script id="data" type="application/json">'):b].decode("utf-8"))
            m = d.get("meta", {}); inst = d.get("inst", []); bench = m.get("bench")
            ac = (d.get("ac") or {}).get(bench) or []
            pts = [x for x in ac if isinstance(x, (int, float))][-90:]
            step = max(1, len(pts) // 60)
            reg = m.get("regime") or {}
            tr = (d.get("tr") or {}).get(bench) or {}
            out.update({
                "universe": m.get("universe"), "source": m.get("source"), "is_sample": bool(m.get("is_sample")), "first": m.get("first"), "last": m.get("last"),
                "generated": m.get("generated"), "n_assets": m.get("n_assets"), "currency": m.get("currency"), "base": m.get("base"), "bench": bench,
                "bench_name": next((i.get("name") for i in inst if i.get("t") == bench), bench),
                "n_indices": sum(1 for i in inst if i.get("type") == "Index"), "n_stocks": sum(1 for i in inst if i.get("type") == "Stock"),
                "bench_1d": tr.get("1D"), "bench_1m": tr.get("1M"), "bench_ytd": tr.get("YTD"),
                "regime": reg.get("regime"), "breadth": reg.get("breadth"), "vol": reg.get("global_vol"),
                "spark": [round(x, 2) for x in pts[::step]] + ([round(pts[-1], 2)] if pts and (len(pts) - 1) % step else []),
            })
    except Exception as e:                                           # a damaged file must not break the home page
        out["error"] = f"{type(e).__name__}: {e}"
    _META_CACHE.clear() if len(_META_CACHE) > 20 else None
    _META_CACHE[key] = out
    return out


def render_home():
    """The launcher page (dashboard_template/home.html) with fonts and logo inlined; None if the template is missing."""
    t = os.path.join(HERE, "dashboard_template")
    try:
        html = open(os.path.join(t, "home.html"), encoding="utf-8").read()
        fonts = open(os.path.join(t, "fonts.css"), encoding="utf-8").read()
        lock = open(os.path.join(t, "lock.js"), encoding="utf-8").read()
        import base64
        logo = "data:image/png;base64," + base64.b64encode(open(os.path.join(t, "assets", "hl-logo.png"), "rb").read()).decode()
    except OSError:
        return None
    inject = '<script>window.HL_SERVER=' + json.dumps({"base": "", "token": TOKEN, "version": VERSION}) + ';</script>'
    return html.replace("/*__FONTS__*/", fonts).replace("/*__LOCK__*/", lock).replace("__LOGO__", logo).replace("</head>", inject + "</head>", 1).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "HalfLayer/" + VERSION

    def log_message(self, fmt, *a):
        if args.verbose:
            sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % a))

    # --- helpers
    def origin_ok(self):
        o = self.headers.get("Origin")
        if o is None or o == "null":
            return True
        host = urlparse(o).hostname
        return host in ("localhost", "127.0.0.1", "::1")

    def cors(self):
        o = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", o if o else "*")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-HL-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code); self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(body)

    def authed(self):
        return self.origin_ok() and secrets.compare_digest(self.headers.get("X-HL-Token", ""), TOKEN)

    # --- verbs
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/ping":
                return self.send_json({"ok": True, "version": VERSION, "yfinance": yf_available(), "state_dir": os.path.expanduser(args.state_dir),
                                       "dashboards": self.dashboards(), "universes": known_universes(), "missing": missing_packages(), "time": datetime.now().isoformat(timespec="seconds"), "notebook": args.notebook})
            if u.path == "/api/dashboards":
                return self.send_json({"dashboards": [dash_meta(f) for f in self.dashboards()], "notebook": args.notebook})
            if u.path == "/api/lookup":
                sym = q.get("t", "")
                if not SYMBOL.match(sym):
                    return self.send_json({"ok": False, "error": "That does not look like a ticker symbol."}, 400)
                return self.send_json(lookup(sym))
            if u.path == "/api/watchlist":
                return self.send_json({"watchlist": read_watch(), "file": watch_path(), "universes": known_universes()})
            if u.path == "/api/intraday":
                sym = q.get("t", "")
                if not SYMBOL.match(sym):
                    return self.send_json({"error": "bad symbol"}, 400)
                return self.send_json(intraday(sym, q.get("interval", "5m"), q.get("range")))
            if u.path == "/api/refresh/status":
                j = dict(JOB); j["elapsed"] = round((j["finished"] or time.time()) - j["started"], 1) if j["started"] else 0
                return self.send_json(j)
            if u.path == "/api/state":
                st = read_state(); p = state_path()
                return self.send_json({"exists": bool(st), "path": p, "modified": os.path.getmtime(p) if os.path.exists(p) else None, "state": st})
            return self.static(u.path)
        except Exception as e:
            if args.verbose:
                traceback.print_exc()
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length") or 0); raw = self.rfile.read(n) if n else b"{}"
            if not self.authed():
                return self.send_json({"error": "missing or wrong token (it is printed when the server starts)"}, 403)
            body = json.loads(raw or b"{}")
            if u.path == "/api/refresh":
                us = body.get("universes")
                if us in (None, "all", ["all"]):
                    us = None
                elif not (isinstance(us, list) and us and all(isinstance(x, str) and re.match(r"^[a-z0-9_]{1,30}$", x) for x in us)):
                    return self.send_json({"error": "universes must be 'all' or a list of names like ['global']"}, 400)
                ok = run_refresh(bool(body.get("clear_cache", True)), us)
                return self.send_json({"started": ok, "state": JOB["state"]})
            if u.path == "/api/watchlist":
                cur = read_watch(); have = {r["t"] for r in cur}
                for r in body.get("remove") or []:
                    cur = [x for x in cur if x["t"] != str(r).strip().upper()]
                for r in body.get("add") or []:
                    t = str((r or {}).get("t", "")).strip().upper()
                    if not SYMBOL.match(t) or t.startswith("^"):
                        return self.send_json({"error": f"bad ticker '{t}'"}, 400)
                    if t not in {x["t"] for x in cur}:
                        cur.append({"t": t, "name": str(r.get("name", ""))[:60].replace("\n", " "), "ccy": str(r.get("ccy", ""))[:4].upper()})
                if len(cur) > 150:
                    return self.send_json({"error": "the watchlist is limited to 150 extra stocks"}, 400)
                write_watch(cur)
                return self.send_json({"saved": True, "watchlist": cur})
            if u.path == "/api/state":
                if not isinstance(body, dict) or "keys" not in body:
                    return self.send_json({"error": "expected {keys: {...}}"}, 400)
                write_state(body)
                return self.send_json({"saved": True, "path": state_path()})
            return self.send_json({"error": "not found"}, 404)
        except Exception as e:
            if args.verbose:
                traceback.print_exc()
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)

    # --- static files (dashboards)
    def dashboards(self):
        d = os.path.join(HERE, args.dashboards)
        return sorted(f for f in os.listdir(d) if f.endswith(".html")) if os.path.isdir(d) else []

    def static(self, path):
        d = os.path.realpath(os.path.join(HERE, args.dashboards))
        if path in ("", "/", "/home"):
            files = self.dashboards()
            if len(files) == 1 and path != "/home":
                self.send_response(302); self.send_header("Location", "/" + files[0]); self.end_headers(); return
            page = render_home()
            if page is not None:
                self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(page))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(page); return
            items = "".join(f'<li><a href="/{f}">{f}</a></li>' for f in files) or "<li>No dashboards yet: run the notebook first.</li>"
            html = f"<!doctype html><meta charset=utf-8><title>The Half Layer</title><body style='font:16px system-ui;background:#06122e;color:#e8f0ff;padding:40px'><h2>The Half Layer · local server</h2><ul>{items}</ul><p style='color:#8fa6d4'>Developed by Anish Luitel</p>"
            body = html.encode(); self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        f = os.path.realpath(os.path.join(d, path.lstrip("/")))
        if not f.startswith(d + os.sep) or not os.path.isfile(f):
            return self.send_json({"error": "not found"}, 404)
        with open(f, "rb") as fh:
            data = fh.read()
        ctype = "text/html; charset=utf-8" if f.endswith(".html") else "application/octet-stream"
        if f.endswith(".html"):                                       # let the page know it is being served here, and give it the action token
            inject = ('<script>window.HL_SERVER=' + json.dumps({"base": "", "token": TOKEN, "version": VERSION}) + ';</script>').encode()
            data = data.replace(b"</head>", inject + b"</head>", 1)
        self.send_response(200); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(data))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(data)


def main():
    global args, TOKEN
    ap = argparse.ArgumentParser(description="The Half Layer local companion server (developed by Anish Luitel)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--dashboards", default="outputs", help="folder with the generated dashboards")
    ap.add_argument("--notebook", default="global_market_analysis.ipynb")
    ap.add_argument("--state-dir", default=os.path.join(HERE, "state"), help="folder where holdings / alerts / layout are saved (point it at a Google Drive folder to sync)")
    ap.add_argument("--token", default=os.environ.get("HL_TOKEN"), help="fixed action token (default: random each start)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    TOKEN = args.token or secrets.token_urlsafe(12)
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"\n  The Half Layer · local server v{VERSION}   (developed by Anish Luitel)")
    print(f"  Dashboards : http://{'localhost' if args.host == '127.0.0.1' else args.host}:{args.port}/")
    print(f"  State folder: {os.path.expanduser(args.state_dir)}")
    print(f"  Token (only needed if you open the HTML file directly instead of through this server): {TOKEN}")
    print(f"  yfinance   : {'available' if yf_available() else 'NOT installed -> intraday disabled (pip install yfinance)'}")
    miss = missing_packages()
    if miss:
        print(f"\n  ! Missing Python packages: {', '.join(miss)}")
        print(f"    The Refresh / Rebuild buttons need them. Install once with:  {INSTALL_HINT}")
    print("  Press Ctrl+C to stop.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
