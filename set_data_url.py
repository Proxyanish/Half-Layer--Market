#!/usr/bin/env python3
"""Point the Refresh button of the dashboards at a different online data folder.        Developed by Anish Luitel

    python set_data_url.py https://raw.githubusercontent.com/USER/REPO/data/latest
    python set_data_url.py none        (turns the online update off)

The address is stamped into every built dashboard in outputs/ and into the notebook's CONFIG["data_url"], so no rebuild is needed for files that already exist."""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) != 2:
    sys.exit(__doc__)
url = sys.argv[1].strip().rstrip("/")
if url.lower() in ("none", "off", ""):
    url = ""
elif not re.match(r"^https?://[\w.\-:/]+$", url):
    sys.exit("That does not look like a web address.")

n = 0
pat_html = re.compile(r"(window\.HL_DATA_URL=/\*DATAURL\*/)('[^']*'|\"[^\"]*\")(/\*END\*/)")
out = os.path.join(HERE, "outputs")
files = [os.path.join(out, f) for f in sorted(os.listdir(out)) if f.endswith(".html")] if os.path.isdir(out) else []
for f in files:
    s = open(f, encoding="utf-8").read()
    s2, k = pat_html.subn(lambda m: m.group(1) + '"' + url + '"' + m.group(3), s)
    if k:
        open(f, "w", encoding="utf-8").write(s2); n += 1
nb = os.path.join(HERE, "global_market_analysis.ipynb")
if os.path.exists(nb):
    s = open(nb, encoding="utf-8").read()
    s2, k = re.subn(r'(\\"data_url\\": \\")[^\\]*(\\")', lambda m: m.group(1) + url + m.group(2), s)
    if k:
        open(nb, "w", encoding="utf-8").write(s2)
print(("Online update turned off" if not url else "Online update address set") + f" in {n} dashboard(s)" + (" and the notebook." if os.path.exists(nb) else "."))
