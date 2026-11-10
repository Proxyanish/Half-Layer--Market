#!/usr/bin/env python3
"""Turn the built dashboards into a small website plus downloadable data files.        Developed by Anish Luitel

    python publish_data.py --out pub                 data files only:      pub/latest/<name>.json.gz + meta.json
    python publish_data.py --out pub --site --pin 1605
                                                     also a website:       pub/index.html + pub/<name>.html (PIN set to 1605)

Used by the daily build (.github/workflows/update-data.yml). The website is served by GitHub Pages; the Refresh button of
any dashboard (also a plain file) downloads pub/latest/<name>.json.gz."""
import argparse, base64, glob, gzip, hashlib, html, json, os, re
from datetime import datetime, timezone

OPEN = '<script id="data" type="application/json">'
HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = {"global": ("Global", "World indices and global mega-caps, side by side in one currency."),
         "canada": ("Canada", "TSX blue-chips with world indices for context, in Canadian dollars."),
         "mega": ("Mega 110", "The largest US, Canadian, European and Asian companies: 110 stocks."),
         "penny": ("Penny stocks", "Stocks under 5, found live by Yahoo, with filters for strong buy and potential increase.")}

ap = argparse.ArgumentParser()
ap.add_argument("--outputs", default=os.path.join(HERE, "outputs"))
ap.add_argument("--out", default=os.path.join(HERE, "pub"))
ap.add_argument("--site", action="store_true", help="also write index.html and the dashboards as web pages")
ap.add_argument("--pin", default="", help="4-digit PIN for the web pages (default: keep the PIN in the files)")
args = ap.parse_args()

data_dir = os.path.join(args.out, "latest")
os.makedirs(data_dir, exist_ok=True)
meta = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), "dashboards": {}}
pin_re = re.compile(r"(/\*PINHASH\*/')[0-9a-f]*(')")
for f in sorted(glob.glob(os.path.join(args.outputs, "*_market_dashboard.html"))):
    name = re.sub(r"_market_dashboard\.html$", "", os.path.basename(f))
    raw = open(f, "rb").read()
    a = raw.find(OPEN.encode()); b = raw.find(b"</script>", a) if a >= 0 else -1
    if a < 0 or b < 0:
        print(f"skip {name}: no data block"); continue
    txt = raw[a + len(OPEN):b]
    d = json.loads(txt.decode("utf-8")); m = d["meta"]
    if m.get("universe") != name:
        print(f"skip {name}: universe mismatch ({m.get('universe')})"); continue
    gz = gzip.compress(txt, 9, mtime=0)
    open(os.path.join(data_dir, name + ".json.gz"), "wb").write(gz)
    meta["dashboards"][name] = {"generated": m.get("generated"), "generated_utc": m.get("generated_utc"), "last": m.get("last"), "n_assets": m.get("n_assets"), "bytes": len(gz)}
    print(f"{name}: prices to {m.get('last')}, {m.get('n_assets')} instruments, {len(gz) / 1e6:.1f} MB gzipped")
    if args.site:
        page = raw.decode("utf-8")
        if args.pin:
            if not (args.pin.isdigit() and len(args.pin) == 4):
                raise SystemExit("--pin must be exactly 4 digits")
            digest = hashlib.sha256(("halflayer|" + args.pin).encode()).hexdigest()
            page, k = pin_re.subn(lambda mm: mm.group(1) + digest + mm.group(2), page)
            if not k:
                print(f"warning: no PIN marker found in {name}")
        open(os.path.join(args.out, name + ".html"), "w", encoding="utf-8").write(page)
json.dump(meta, open(os.path.join(data_dir, "meta.json"), "w"), indent=1)
open(os.path.join(data_dir, "README.txt"), "w").write("Data published by the daily build of The Half Layer (developed by Anish Luitel).\nOne <name>.json.gz per dashboard and meta.json. Rebuilt every weekday; the branch holds a single commit.\n")

if args.site:
    logo = "data:image/png;base64," + base64.b64encode(open(os.path.join(HERE, "dashboard_template", "assets", "hl-logo.png"), "rb").read()).decode()
    try:
        fonts = open(os.path.join(HERE, "dashboard_template", "fonts.css"), encoding="utf-8").read()
    except OSError:
        fonts = ""
    cards = ""
    for name in ("global", "canada", "mega", "penny"):
        if name not in meta["dashboards"]:
            continue
        m = meta["dashboards"][name]; t, desc = NAMES[name]
        cards += (f'<a class="card" href="{name}.html"><h2 class="hl">{html.escape(t)}</h2><p>{html.escape(desc)}</p>'
                  f'<div class="st"><div><span>INSTRUMENTS</span><b>{m["n_assets"]}</b></div><div><span>PRICES TO</span><b>{html.escape(str(m["last"]))}</b></div>'
                  f'<div><span>BUILT (UTC)</span><b>{html.escape(str(m["generated"]))}</b></div></div><span class="go">Open dashboard &rarr;</span></a>')
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="author" content="Anish Luitel"><title>The Half Layer · Markets</title><style>{fonts}</style><style>
:root{{--ink:#E8F0FF;--mut:#8FA6D4;--line:rgba(130,180,255,.26);--orange:#FF9E2C;--mono:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;--sans:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}}
*{{box-sizing:border-box}}html{{background:#040A1C}}body{{margin:0;min-height:100vh;color:var(--ink);font:14px/1.55 var(--sans);background:radial-gradient(ellipse 90% 70% at 50% 24%,#16346F 0%,#0C214D 42%,#040A1C 100%) fixed}}
.hl{{font-weight:700;letter-spacing:-.02em;line-height:1.05;color:transparent;background:linear-gradient(180deg,#F6F0E2 0 49%,#E0B472 52%,#C9805A 72%,#94384A 100%);-webkit-background-clip:text;background-clip:text;-webkit-mask:linear-gradient(#000,#000) top/100% 50% no-repeat,repeating-linear-gradient(180deg,#000 0 2px,transparent 2px 3.6px) bottom/100% 50% no-repeat;mask:linear-gradient(#000,#000) top/100% 50% no-repeat,repeating-linear-gradient(180deg,#000 0 2px,transparent 2px 3.6px) bottom/100% 50% no-repeat}}
header,main,footer{{max-width:1080px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right))}}
header{{display:flex;align-items:center;gap:12px;padding-top:max(18px,env(safe-area-inset-top))}}header img{{height:42px}}header b{{display:block;font:700 12px var(--mono);letter-spacing:.32em}}header span{{display:block;font:500 9px var(--mono);letter-spacing:.24em;color:var(--mut);margin-top:3px}}
h1{{margin:clamp(26px,5vw,52px) 0 0;font-size:clamp(38px,7vw,76px);text-transform:uppercase;text-wrap:balance}}.lead{{max-width:58ch;color:var(--mut);font-size:15px;margin:14px 0 0}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px;margin:34px 0 0}}
.card{{display:flex;flex-direction:column;gap:12px;padding:22px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(70,120,215,.17),rgba(12,28,70,.42));color:inherit;text-decoration:none;box-shadow:0 18px 50px rgba(0,0,0,.4);transition:.25s}}
.card:hover{{transform:translateY(-4px);border-color:var(--orange);box-shadow:0 24px 60px rgba(0,0,0,.5),0 0 34px rgba(255,158,44,.18)}}
.card h2{{margin:0;font-size:clamp(28px,4vw,40px);text-transform:uppercase}}.card p{{margin:0;color:var(--mut)}}
.st{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;border-radius:10px;overflow:hidden;border:1px solid rgba(130,180,255,.12);background:rgba(130,180,255,.12)}}.st div{{padding:9px 11px;background:rgba(7,18,50,.78);min-width:0}}
.st span{{display:block;font:500 8.5px var(--mono);letter-spacing:.2em;color:var(--mut)}}.st b{{font:600 12.5px var(--mono);white-space:nowrap}}
.go{{align-self:flex-start;margin-top:4px;padding:9px 16px;border-radius:10px;background:linear-gradient(180deg,#FFB052,#F08A1C);color:#1B0F00;font:700 11px var(--mono);letter-spacing:.16em;text-transform:uppercase}}
.note{{margin:30px 0 0;color:var(--mut);font-size:12.5px;max-width:70ch}}footer{{padding-top:30px;padding-bottom:max(30px,env(safe-area-inset-bottom));text-align:center;font:500 10px var(--mono);letter-spacing:.2em;color:var(--mut)}}footer b{{font-size:15px;letter-spacing:0;font-family:var(--sans)}}
</style></head><body>
<header><img src="{logo}" alt=""><div><b>THE HALF LAYER</b><span>MARKETS TERMINAL</span></div></header>
<main><h1 class="hl">Choose your market</h1><p class="lead">Rebuilt every weekday after the US close, so these pages are always current. Each one asks for a PIN.</p>
<section class="cards">{cards}</section>
<p class="note">Prices come from Yahoo Finance and can be delayed or wrong. For education and research, not financial advice. Built {html.escape(meta['updated'])} UTC.</p></main>
<footer>DEVELOPED BY <b class="hl">Anish Luitel</b></footer></body></html>"""
    open(os.path.join(args.out, "index.html"), "w", encoding="utf-8").write(page)
    open(os.path.join(args.out, ".nojekyll"), "w").write("")
    print("wrote website: index.html +", len(meta["dashboards"]), "dashboards")
print("wrote", len(meta["dashboards"]), "dashboards to", args.out)
