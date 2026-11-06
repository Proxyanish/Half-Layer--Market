#!/usr/bin/env python3
"""Change (or remove) the PIN of The Half Layer dashboards.        Developed by Anish Luitel

    python set_pin.py 1234      set a new 4-digit PIN
    python set_pin.py none      turn the PIN screen off

It updates dashboard_template/lock.js and every dashboard already built in outputs/ (no rebuild needed).
The PIN is a screen lock, not encryption: only a salted hash is stored, but a 4-digit PIN can be guessed by anyone who reads the file."""
import hashlib, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) != 2:
    sys.exit(__doc__)
pin = sys.argv[1].strip()
if pin.lower() in ("none", "off", ""):
    digest = ""
elif pin.isdigit() and len(pin) == 4:
    digest = hashlib.sha256(("halflayer|" + pin).encode()).hexdigest()
else:
    sys.exit("The PIN must be exactly 4 digits (or 'none').")

pat = re.compile(r"(/\*PINHASH\*/')[0-9a-f]*(')")
files = [os.path.join(HERE, "dashboard_template", "lock.js")]
out = os.path.join(HERE, "outputs")
if os.path.isdir(out):
    files += [os.path.join(out, f) for f in sorted(os.listdir(out)) if f.endswith(".html")]
n = 0
for f in files:
    if not os.path.exists(f):
        continue
    s = open(f, encoding="utf-8").read()
    s2, k = pat.subn(lambda m: m.group(1) + digest + m.group(2), s)
    if k:
        open(f, "w", encoding="utf-8").write(s2); n += 1
print(("PIN turned off" if not digest else "PIN updated") + f" in {n} file(s). Reload the browser tab (a tab that already entered the old PIN stays open until it is locked or closed).")
