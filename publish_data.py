#!/usr/bin/env python3
"""Turn the built dashboards into small downloadable data files.        Developed by Anish Luitel

    python publish_data.py --out latest

For every outputs/<name>_market_dashboard.html it writes  <out>/<name>.json.gz  (the dashboard's data block, gzipped)
and one <out>/meta.json describing them. The daily GitHub build (.github/workflows/update-data.yml) publishes the
folder; the Refresh button of a dashboard opened WITHOUT the local server downloads <name>.json.gz from there."""
import argparse, glob, gzip, json, os, re
from datetime import datetime, timezone

OPEN = '<script id="data" type="application/json">'
HERE = os.path.dirname(os.path.abspath(__file__))

ap = argparse.ArgumentParser()
ap.add_argument("--outputs", default=os.path.join(HERE, "outputs"))
ap.add_argument("--out", default=os.path.join(HERE, "latest"))
args = ap.parse_args()

os.makedirs(args.out, exist_ok=True)
meta = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), "dashboards": {}}
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
    open(os.path.join(args.out, name + ".json.gz"), "wb").write(gz)
    meta["dashboards"][name] = {"generated": m.get("generated"), "last": m.get("last"), "n_assets": m.get("n_assets"), "bytes": len(gz)}
    print(f"{name}: prices to {m.get('last')}, {m.get('n_assets')} instruments, {len(gz) / 1e6:.1f} MB gzipped")
json.dump(meta, open(os.path.join(args.out, "meta.json"), "w"), indent=1)
open(os.path.join(args.out, "README.txt"), "w").write("Data published by the daily build of The Half Layer (developed by Anish Luitel).\nOne <name>.json.gz per dashboard and meta.json. Rebuilt every weekday; the branch holds a single commit.\n")
print("wrote", len(meta["dashboards"]), "dashboards to", args.out)
