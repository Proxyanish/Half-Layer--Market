/* The Half Layer – PIN lock screen.   Developed by Anish Luitel
   A screen lock for casual privacy (it hides the page until the PIN is typed). It is NOT encryption: the data is still inside the HTML file.
   Change the PIN with:  python set_pin.py 1234      (turn it off with:  python set_pin.py none) */
(() => {
'use strict';
const PIN_HASH = /*PINHASH*/'c1c25bb733371294932dddd94914d615d0f0be8e4799ea5bb68d2b53756661bd'/*END*/;
if (!PIN_HASH) return;
const KEY = 'hl-unlock-v1';

/* small synchronous SHA-256 (works on file://, http:// and https://) */
function sha256(m) {
  const K = [], Hh = [], isP = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }, frac = x => ((x - Math.floor(x)) * 4294967296) | 0;
  for (let n = 2, c = 0; c < 64; n++) if (isP(n)) { if (c < 8) Hh[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); }
  const by = []; for (let i = 0; i < m.length; i++) by.push(m.charCodeAt(i) & 255);
  const bits = by.length * 8; by.push(0x80); while (by.length % 64 !== 56) by.push(0); for (let i = 7; i >= 0; i--) by.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
  let h = Hh.slice();
  for (let o = 0; o < by.length; o += 64) {
    const w = []; for (let i = 0; i < 16; i++) w[i] = (by[o + 4 * i] << 24) | (by[o + 4 * i + 1] << 16) | (by[o + 4 * i + 2] << 8) | by[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2], s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + w[i]) | 0,
        S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const hashOf = pin => sha256('halflayer|' + pin);
const unlockedNow = () => { try { return sessionStorage.getItem(KEY) === PIN_HASH; } catch (e) { return false; } };

const CSS = `#hlock{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:20px;color:#E8F0FF;font:14px/1.5 'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:radial-gradient(ellipse 90% 70% at 50% 28%,#16346F 0%,#0C214D 42%,#040A1C 100%);overflow:hidden;transition:opacity .35s}
#hlock.out{opacity:0;pointer-events:none}
#hlock .fl{position:absolute;left:-30%;right:-30%;bottom:-8vh;height:58vh;pointer-events:none;background-image:linear-gradient(rgba(109,182,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(109,182,255,.16) 1px,transparent 1px);background-size:64px 64px;transform:perspective(520px) rotateX(64deg);transform-origin:50% 100%;-webkit-mask-image:linear-gradient(to top,#000 0,transparent 92%);mask-image:linear-gradient(to top,#000 0,transparent 92%)}
#hlock .gl{position:absolute;width:60vw;height:60vw;left:20vw;top:-32vw;pointer-events:none;background:radial-gradient(closest-side,rgba(255,158,44,.14),transparent)}
#hlock .bx{position:relative;width:min(340px,100%);padding:26px 24px 22px;border-radius:18px;border:1px solid rgba(130,180,255,.26);background:linear-gradient(180deg,rgba(70,120,215,.17),rgba(12,28,70,.55));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 24px 70px rgba(0,0,0,.55);text-align:center}
#hlock .bx::before{content:"";position:absolute;left:-1px;top:-1px;width:18px;height:18px;border-left:2px solid #6DB6FF;border-top:2px solid #6DB6FF;border-top-left-radius:18px}
#hlock img.lg{height:54px;width:auto;filter:drop-shadow(0 0 14px rgba(255,158,44,.35))}
#hlock .wm{font:700 12px 'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.32em;margin-top:10px}
#hlock .ti{font:600 10px 'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.3em;color:#FF9E2C;margin:18px 0 12px}
#hlock .dots{display:flex;justify-content:center;gap:14px;height:18px;margin-bottom:6px}
#hlock .dots i{width:14px;height:14px;border-radius:50%;border:1.5px solid rgba(130,180,255,.6);transition:.15s}
#hlock .dots i.on{background:#FF9E2C;border-color:#FF9E2C;box-shadow:0 0 12px rgba(255,158,44,.8)}
#hlock.bad .dots i{border-color:#FF6B7A;background:#FF6B7A;box-shadow:0 0 12px rgba(255,107,122,.8)}
#hlock.bad .dots{animation:hlshake .38s}
@keyframes hlshake{20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
#hlock .msg{min-height:20px;margin-bottom:8px;font:500 11px 'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:#8FA6D4}
#hlock.bad .msg{color:#FF9AA5}
#hlock .pad{display:grid;grid-template-columns:repeat(3,64px);gap:12px;justify-content:center}
#hlock .pad button{width:64px;height:64px;border-radius:50%;border:1px solid rgba(130,180,255,.3);background:rgba(10,25,64,.65);color:#E8F0FF;font:600 22px 'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;cursor:pointer;transition:.15s;padding:0}
#hlock .pad button:hover{border-color:#FF9E2C;background:rgba(255,158,44,.14)}
#hlock .pad button:active{transform:scale(.94)}
#hlock .pad button.fn{font-size:12px;letter-spacing:.06em;color:#8FA6D4;background:transparent;border-color:transparent}
#hlock .pad button:focus-visible{outline:2px solid #FF9E2C;outline-offset:3px}
#hlock .by{position:relative;margin-top:22px;display:grid;grid-template-columns:auto 1fr;column-gap:9px;align-items:center;padding:7px 14px 8px 10px;border-radius:12px;border:1px solid rgba(130,180,255,.26);background:rgba(8,20,54,.85)}
#hlock .by img{grid-row:1/3;height:28px;width:auto}
#hlock .by .a{font:600 8px 'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;letter-spacing:.24em;color:#8FA6D4;text-align:left}
#hlock .by b{font-size:16px;line-height:1.1;white-space:nowrap;text-align:left;font-weight:700;color:transparent;background:linear-gradient(180deg,#F6F0E2 0 49%,#E0B472 52%,#C9805A 72%,#94384A 100%);-webkit-background-clip:text;background-clip:text}
#hlock .by .ly{grid-column:1/3;display:flex;flex-direction:column;gap:2px;margin-top:5px}#hlock .by .ly i{display:block;height:2px;border-radius:1px}
@media (max-height:640px){#hlock .pad{grid-template-columns:repeat(3,52px);gap:8px}#hlock .pad button{width:52px;height:52px;font-size:19px}#hlock .by{margin-top:12px}#hlock img.lg{height:40px}}
@media (prefers-reduced-motion:reduce){#hlock *{animation:none!important;transition:none!important}}`;

let el = null, buf = '', fails = 0, until = 0, tm = 0;
const logo = () => { const i = document.querySelector('.brand img, .top .brand img'); return i ? i.src : ''; };

function build() {
  if (el) return el;
  const st = document.createElement('style'); st.id = 'hlockcss'; st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'hlock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Enter PIN');
  el.innerHTML = `<div class="gl"></div><div class="fl"></div>
  <div class="bx"><img class="lg" alt=""${logo() ? ` src="${logo()}"` : ''}><div class="wm">THE HALF LAYER</div><div class="ti">ENTER PIN</div>
    <div class="dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="msg" id="hlmsg" aria-live="polite">Type the 4-digit PIN</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}" aria-label="${n}">${n}</button>`).join('')}<button type="button" class="fn" data-k="clr" aria-label="Clear">CLEAR</button><button type="button" data-k="0" aria-label="0">0</button><button type="button" class="fn" data-k="del" aria-label="Delete">DEL</button></div></div>
  <div class="by"><img alt=""${logo() ? ` src="${logo()}"` : ''}><span class="a">DEVELOPED BY</span><b>Anish Luitel</b><span class="ly"><i style="background:#F6F0E2"></i><i style="background:#E0B472"></i><i style="background:#C9805A"></i><i style="background:#94384A"></i></span></div>`;
  el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
  return el;
}
function paint() { el.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i < buf.length)); }
function msg(t) { const m = el.querySelector('#hlmsg'); if (m) m.textContent = t; }
function setInert(on) { Array.from(document.body.children).forEach(c => { if (c !== el && c.id !== 'hlockcss') { try { c.inert = on; } catch (e) {} } }); }
function press(k) {
  if (Date.now() < until) { msg('Too many tries. Wait ' + Math.ceil((until - Date.now()) / 1000) + ' s'); return; }
  if (k === 'clr') buf = ''; else if (k === 'del') buf = buf.slice(0, -1); else if (/^\d$/.test(k) && buf.length < 4) buf += k;
  el.classList.remove('bad'); paint(); if (buf.length) msg('');
  if (buf.length === 4) {
    if (hashOf(buf) === PIN_HASH) { try { sessionStorage.setItem(KEY, PIN_HASH); } catch (e) {} fails = 0; unlock(); }
    else { fails++; el.classList.add('bad'); msg(fails >= 5 ? 'Too many tries. Wait 30 s' : 'Wrong PIN'); if (fails >= 5) { until = Date.now() + 30000; fails = 0; } clearTimeout(tm); tm = setTimeout(() => { buf = ''; el.classList.remove('bad'); paint(); if (Date.now() >= until) msg('Type the 4-digit PIN'); }, 650); }
  }
}
function lock() {
  build(); buf = ''; paint(); msg('Type the 4-digit PIN'); el.classList.remove('out', 'bad');
  if (!el.isConnected) document.body.insertBefore(el, document.body.firstChild);
  setInert(true); document.documentElement.style.overflow = 'hidden';
  const b = el.querySelector('[data-k="5"]'); if (b) b.focus({preventScroll: true});
}
function unlock() {
  el.classList.add('out'); setInert(false); document.documentElement.style.overflow = '';
  setTimeout(() => { if (el.isConnected && el.classList.contains('out')) el.remove(); }, 400);
  window.dispatchEvent(new Event('resize'));
}
document.addEventListener('keydown', e => {
  if (!el || !el.isConnected || el.classList.contains('out')) return;
  if (/^\d$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); press(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); press('del'); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); press('clr'); }
  else if (e.key === 'Tab') { /* keep focus inside the keypad */ const f = Array.from(el.querySelectorAll('button')), i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
}, true);

/* start: locked unless this tab already entered the PIN */
const start = () => { if (!unlockedNow()) lock(); };
if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
document.addEventListener('DOMContentLoaded', () => {
  const lg = logo(); if (el && lg) el.querySelectorAll('img').forEach(i => { if (!i.getAttribute('src')) i.src = lg; });
  if (el && el.isConnected && !el.classList.contains('out')) setInert(true);
  const host = document.getElementById('hTools') || document.querySelector('.top');
  if (host && !document.getElementById('hLock')) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'hLock'; b.className = 'hbtn btn'; b.title = 'Lock the dashboard (asks for the PIN again)';
    b.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Lock</span>';
    b.onclick = () => { try { sessionStorage.removeItem(KEY); } catch (e) {} lock(); };
    if (host.id === 'hTools') host.appendChild(b); else host.insertBefore(b, document.getElementById('rf') || null);
  }
});
})();
