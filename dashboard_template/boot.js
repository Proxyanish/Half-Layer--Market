/* The Half Layer – start-up.   Developed by Anish Luitel
   Runs the app after checking whether the Refresh button has downloaded newer data (kept in the browser's IndexedDB).
   The app code sits in <script type="text/plain" class="hl-code"> blocks and is executed here, in order, once the data is settled. */
(() => {
'use strict';
const DB = 'halflayer', ST = 'payloads';
const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, {keyPath: 'k'}); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction(ST, mode); let q; try { q = fn(t.objectStore(ST)); } catch (e) { return rej(e); } t.oncomplete = () => { db.close(); res(q && q.result); }; t.onerror = t.onabort = () => { db.close(); rej(t.error || new Error('IndexedDB failed')); }; }));
window.HLDB = {get: k => tx('readonly', s => s.get(k)), put: rec => tx('readwrite', s => s.put(rec)), del: k => tx('readwrite', s => s.delete(k))};

const el = document.getElementById('data'), head = el.textContent.slice(0, 3000);
const pick = k => (head.match(new RegExp('"' + k + '":\\s*"([^"]+)"')) || [])[1] || '';
const uni = pick('universe') || 'x', gen = pick('generated'), lastBar = pick('last');
window.HL_EMBEDDED = {universe: uni, generated: gen, last: lastBar};

function run() {
  document.querySelectorAll('script.hl-code').forEach(c => { const s = document.createElement('script'); s.text = c.textContent; document.body.appendChild(s); });
  HL.start(); window.dispatchEvent(new Event('hl-booted'));
}
let done = false; const go = () => { if (done) return; done = true; run(); };
if (!window.indexedDB) go();
else {
  setTimeout(go, 4000);                                                     // never wait long for the browser's storage
  HLDB.get(uni).then(rec => {
    if (rec && typeof rec.json === 'string' && rec.json.charAt(0) === '{' && (String(rec.last) > lastBar || (String(rec.last) === lastBar && String(rec.generated) > gen))) {
      const h = rec.json.slice(0, 3000), u = (h.match(/"universe":\s*"([^"]+)"/) || [])[1];
      if (u === uni) { el.textContent = rec.json; window.HL_USING_DOWNLOADED = {generated: rec.generated, last: rec.last, saved: rec.saved || ''}; }
    }
  }).catch(() => {}).then(go);
}
})();
