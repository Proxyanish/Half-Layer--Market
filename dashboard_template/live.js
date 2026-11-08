/* The Half Layer – local server link: Refresh button, intraday API, About card.   Developed by Anish Luitel */
(() => {
'use strict';
const HL = window.HL; if (!HL) return;
const {M, esc} = HL, $ = id => document.getElementById(id);
const L = HL.live = {ok: false, base: '', token: '', info: null};
const hs = window.HL_SERVER;
L.base = hs ? (hs.base || location.origin) : (location.protocol.startsWith('http') ? location.origin : 'http://localhost:8765');
L.token = (hs && hs.token) || (() => { try { return localStorage.getItem('hl-server-token') || ''; } catch (e) { return ''; } })();

/* ---------------- shared dialog ---------------- */
HL.modal = function (html, onClick) {
  const g = $('gmodal'), b = $('gbox'); b.innerHTML = html + '<div class="mcredit">Developed by <b>Anish Luitel</b></div>'; g.classList.add('on');
  b.onclick = e => { if (e.target.closest('[data-close]')) return HL.closeModal(); if (onClick) onClick(e); };
  g.onclick = e => { if (e.target === g) HL.closeModal(); };
  return b;
};
HL.closeModal = () => $('gmodal').classList.remove('on');
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('gmodal').classList.contains('on')) HL.closeModal(); });
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const head = t => `<div class="mh"><b>${t}</b><button class="tb" data-close>${X}</button></div>`;

/* ---------------- talking to the server ---------------- */
L.api = async (path, opt = {}) => {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), opt.timeout || 8000);
  try {
    const post = opt.method === 'POST';
    const r = await fetch(L.base + path, {method: opt.method || 'GET', headers: {'Content-Type': 'application/json', ...(post ? {'X-HL-Token': L.token} : {})}, body: opt.body ? JSON.stringify(opt.body) : undefined, signal: ctl.signal});
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j;
  } finally { clearTimeout(to); }
};
L.probe = async () => { try { L.info = await L.api('/api/ping', {timeout: 1800}); L.ok = true; } catch (e) { L.ok = false; L.info = null; } paint(); window.dispatchEvent(new CustomEvent('hl-live', {detail: L.ok})); return L.ok; };
L.needToken = () => {
  if (L.token) return true; const t = window.prompt('Paste the token printed in the terminal where serve_dashboard.py is running (pages opened through the server need no token):'); if (!t) return false;
  L.token = t.trim(); try { localStorage.setItem('hl-server-token', L.token); } catch (e) {} return true;
};
L.intraday = async (t, tf) => { const iv = {'1m': '1m', '5m': '5m', '15m': '15m', '1h': '60m'}[tf], j = await L.api(`/api/intraday?t=${encodeURIComponent(t)}&interval=${iv}`, {timeout: 30000}); const bars = j.bars.map(b => ({time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5]})); bars.offset = j.offset; bars.currency = j.currency; return bars; };

/* ---------------- header button ---------------- */
const ICON = '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
$('hTools').insertAdjacentHTML('beforeend', `<button class="hbtn" id="hRefresh" title="Refresh data, intraday and live mode">${ICON}<span>Refresh</span><i class="dot"></i></button>`);
function age() { const t = Date.parse(String(M.generated).replace(' ', 'T')); return isFinite(t) ? (Date.now() - t) / 36e5 : null; }
function paint() {
  const b = $('hRefresh'); if (!b) return; const a = age(), stale = a != null && a > 20;
  b.classList.toggle('ok', L.ok); b.classList.toggle('stale', stale && !L.ok);
  b.title = (L.ok ? 'Local server connected · ' : 'Local server not detected · ') + `data built ${M.generated}` + (a != null ? ` (${a < 1 ? 'less than 1 h' : Math.round(a) + ' h'} ago)` : '');
}
$('hRefresh').onclick = () => openRefresh();
(() => { const br = document.querySelector('.brand'); if (br && location.protocol.startsWith('http') && hs) { br.style.cursor = 'pointer'; br.title = 'Back to the market launcher'; br.onclick = () => { location.href = '/home'; }; } })();
paint(); if (location.protocol.startsWith('http')) L.probe().then(ok => setTimeout(ok ? autoUpdate : olBanner, ok ? 500 : 1500)); else setTimeout(olBanner, 2500);           // pages opened straight from disk only probe when you ask (no console noise)

/* ---------------- refresh dialog ---------------- */
let poll = null;
async function openRefresh() {
  await L.probe(); const a = age(), cmd = 'python serve_dashboard.py', url = 'http://localhost:8765';
  const info = `<div class="kv"><div>Dashboard built</div><div>${esc(M.generated)}${a != null ? ` <span class="sub">(${a < 1 ? '< 1 h' : Math.round(a) + ' h'} ago)</span>` : ''}</div><div>Last price bar</div><div>${esc(M.last)}</div><div>Source</div><div>${esc(M.source)}</div><div>Currency</div><div>${esc(M.currency)}</div></div>`;
  const miss = (L.info && L.info.missing) || [], missHtml = miss.length ? `<div class="pend"><b>Python packages missing:</b> ${esc(miss.join(', '))}. Rebuilding cannot run until they are installed. Close the server window, open a Command Prompt in the project folder and run <code>python -m pip install -r requirements.txt</code> (or just start the server again with <code>run_server.bat</code>, which installs them the first time).</div>` : '';
  const body = L.ok ? `${info}${missHtml}<div class="sec">LOCAL SERVER · CONNECTED</div>
      <div class="sub" style="margin-bottom:8px">Re-runs the notebook in the background (usually well under a minute), then reloads this page with fresh prices, fundamentals and analyst data. Intraday timeframes (1m, 5m, 15m, 1h) and the <b>Live</b> button on the chart are available while the server runs.</div>
      <label class="chk"><input type="checkbox" id="rfClear" checked> Clear the cache and download everything again</label>
      <label class="chk"><input type="checkbox" id="rfAuto" ${AU.on ? 'checked' : ''}> Update prices automatically when I open this dashboard and its data is older than <select id="rfHrs" class="tinput" style="width:auto;display:inline-block;padding:2px 6px">${[3, 6, 12, 24].map(h => `<option value="${h}" ${AU.hrs === h ? 'selected' : ''}>${h}</option>`).join('')}</select> hours</label>
      <div class="mf" style="justify-content:flex-start;padding:6px 0"><button class="btn on" id="rfGo">Rebuild dashboard now</button><span class="sub" id="rfSt" style="margin-left:12px"></span></div><pre class="log" id="rfLog" style="display:none"></pre>`
    : `${info}${onlineHtml()}<div class="sec">LOCAL SERVER · NOT RUNNING</div>
      <div class="sub" style="margin-bottom:8px">A browser cannot download market data by itself, so refreshing needs the small server that ships with the notebook. Start it in the project folder:</div>
      <pre class="log">${cmd}</pre><div class="sub">then open <code>${url}</code> (the dashboard opens from there). Or refresh manually without the server:</div>
      <pre class="log">jupyter nbconvert --to notebook --execute --inplace global_market_analysis.ipynb</pre>
      <div class="mf" style="justify-content:flex-start;padding:6px 0"><button class="btn" id="rfAgain">Check again</button><span class="sub" id="rfSt" style="margin-left:12px"></span></div>`;
  const mb = HL.modal(head('Refresh data') + `<div class="gbody">${body}</div>`, e => {
    if (e.target.closest('#rfAgain')) { $('rfSt').textContent = 'checking…'; L.probe().then(ok => { if (ok) openRefresh(); else $('rfSt').textContent = 'still not reachable'; }); }
    else if (e.target.closest('#rfGo')) startRefresh();
    else if (e.target.closest('#olGo')) olGo().catch(err => { const t = $('olSt'); if (t) t.textContent = err.message; const g = $('olGo'); if (g) g.disabled = false; });
    else if (e.target.closest('#olReset')) olReset();
  });
  if (DU && !L.ok) olCheck();
  mb.onchange = e => { if (e.target.id === 'rfAuto') AU.on = e.target.checked; if (e.target.id === 'rfHrs') AU.hrs = +e.target.value; };
}
async function startRefresh() {
  if (!L.needToken()) return; const st = $('rfSt'), lg = $('rfLog'); $('rfGo').disabled = true; st.textContent = 'starting…'; lg.style.display = 'block';
  try { await L.api('/api/refresh', {method: 'POST', body: {clear_cache: $('rfClear').checked, universes: [M.universe]}}); } catch (e) { st.textContent = e.message; $('rfGo').disabled = false; return; }
  clearInterval(poll);
  poll = setInterval(async () => {
    try {
      const j = await L.api('/api/refresh/status'); lg.textContent = (j.log || []).slice(-14).join('\n'); lg.scrollTop = lg.scrollHeight;
      st.textContent = j.state === 'running' ? `running… ${Math.round(j.elapsed)} s` : j.state === 'done' ? 'done, reloading…' : 'failed (see log)';
      if (j.state === 'done') { clearInterval(poll); setTimeout(() => location.reload(), 1200); }
      if (j.state === 'error') { clearInterval(poll); $('rfGo').disabled = false; }
    } catch (e) { st.textContent = 'waiting for the server…'; }
  }, 2000);
}

/* ---------------- automatic price update when the dashboard is opened (needs the local server) ---------------- */
const AU = {
  get on() { try { return localStorage.getItem('hl-autoupdate') !== '0'; } catch (e) { return true; } }, set on(v) { try { localStorage.setItem('hl-autoupdate', v ? '1' : '0'); } catch (e) {} },
  get hrs() { try { const v = +localStorage.getItem('hl-autoupdate-hrs'); return [3, 6, 12, 24].includes(v) ? v : 6; } catch (e) { return 6; } }, set hrs(v) { try { localStorage.setItem('hl-autoupdate-hrs', String(v)); } catch (e) {} }
};
function expectedLast() {                                   // the newest trading day whose close should exist by now (weekdays only; US close is about 21:00 UTC)
  const d = new Date(); let day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wk = x => { const w = x.getUTCDay(); return w >= 1 && w <= 5; };
  if (!(wk(day) && d.getUTCHours() >= 22)) day = new Date(day.getTime() - 864e5);
  while (!wk(day)) day = new Date(day.getTime() - 864e5);
  return day.toISOString().slice(0, 10);
}
const needsUpdate = () => { const a = age(); return a != null && String(M.last) < expectedLast() && a > AU.hrs; };
function autoBar(html, cls) {
  let b = $('autoBar'); if (!b) { b = document.createElement('div'); b.id = 'autoBar'; document.body.appendChild(b); }
  b.className = 'autobar ' + (cls || ''); b.innerHTML = html; return b;
}
async function autoUpdate() {
  if (!L.ok || !AU.on || !L.token || !M.universe || !needsUpdate()) return;
  let st = null; try { st = await L.api('/api/refresh/status'); } catch (e) { return; }
  const KEY = 'hl-autoupdate-try'; let last = 0; try { last = +sessionStorage.getItem(KEY) || 0; } catch (e) {}
  if (st.state !== 'running') { if (Date.now() - last < 10 * 60 * 1000) return; try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
  const stop = () => { clearInterval(tm); const b = $('autoBar'); if (b) b.remove(); };
  let tm = 0, skipped = false;
  autoBar(`<b>UPDATING PRICES</b><span id="auSt">starting…</span><button class="btn" id="auSkip" type="button">Not now</button>`);
  $('autoBar').onclick = e => { if (e.target.closest('#auSkip')) { skipped = true; stop(); } };
  if (st.state !== 'running') { try { await L.api('/api/refresh', {method: 'POST', body: {clear_cache: true, universes: [M.universe]}}); } catch (e) { autoBar(`<b>UPDATE FAILED</b><span>${esc(e.message)}</span><button class="btn" id="auOk" type="button">Close</button>`, 'bad').onclick = () => $('autoBar').remove(); return; } }
  tm = setInterval(async () => {
    if (skipped) return;
    try {
      const j = await L.api('/api/refresh/status'), el = $('auSt'); if (el) el.textContent = j.state === 'running' ? `downloading and recalculating… ${Math.round(j.elapsed)} s` : j.state === 'done' ? 'done, reloading…' : 'failed';
      if (j.state === 'done') { clearInterval(tm); setTimeout(() => location.reload(), 600); }
      else if (j.state === 'error') { clearInterval(tm); autoBar(`<b>UPDATE FAILED</b><span>The rebuild did not finish. Open Refresh to see the log.</span><button class="btn" id="auOk" type="button">Close</button>`, 'bad').onclick = () => $('autoBar').remove(); }
    } catch (e) { const el = $('auSt'); if (el) el.textContent = 'waiting for the server…'; }
  }, 2000);
}

/* ---------------- online update: newest data published by the daily GitHub build (no server needed) ---------------- */
const DU = String(window.HL_DATA_URL || '').replace(/\/+$/, '');
const cmpNewer = m => !!m && (String(m.last) > String(M.last));
async function olMeta() { const r = await fetch(DU + '/meta.json?v=' + Date.now(), {cache: 'no-store'}); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); return (j.dashboards || {})[M.universe] || null; }
function onlineHtml() {
  if (!DU) return '';
  const used = window.HL_USING_DOWNLOADED;
  return `<div class="sec">ONLINE UPDATE · NO SERVER NEEDED</div>
    <div class="sub" style="margin-bottom:8px">Downloads the newest data that the project's daily build published online (a few MB), then reloads this page. It updates <b>everything</b>: prices, risk, ratings, screens and valuations. Needs an internet connection.</div>
    <div class="kv"><div>Prices in this page</div><div>to ${esc(M.last)}${used ? ' <span class="sub">(downloaded)</span>' : ''}</div><div>Newest online</div><div id="olNew">checking…</div></div>
    <div class="mf" style="justify-content:flex-start;padding:6px 0;gap:8px;flex-wrap:wrap"><button class="btn on" id="olGo" disabled>Update now</button>${used ? '<button class="btn" id="olReset" type="button">Back to the original data</button>' : ''}<span class="sub" id="olSt"></span></div>`;
}
async function olCheck() {
  const el = $('olNew'), go = $('olGo'); if (!el) return;
  try { const m = await olMeta(); if (!m) { el.textContent = 'not published yet for this dashboard'; return; }
    el.innerHTML = `prices to ${esc(m.last)} <span class="sub">(built ${esc(m.generated)} UTC)</span>`;
    if (cmpNewer(m)) { if (go) go.disabled = false; } else { const t = $('olSt'); if (t) t.textContent = 'You already have the newest prices.'; }
  } catch (e) { el.textContent = 'not reachable: ' + e.message; }
}
async function olGo(setSt) {
  const st = setSt || (t => { const e = $('olSt'); if (e) e.textContent = t; }), g = $('olGo'); if (g) g.disabled = true;
  if (!window.HLDB || !window.DecompressionStream) { st('This browser cannot store the download. Use a current Chrome, Edge, Firefox or Safari.'); return; }
  st('downloading…');
  const r = await fetch(`${DU}/${M.universe}.json.gz?v=${Date.now()}`, {cache: 'no-store'}); if (!r.ok) throw new Error('download failed (HTTP ' + r.status + ')');
  const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), chunks = []; let got = 0;
  for (;;) { const {done, value} = await rd.read(); if (done) break; chunks.push(value); got += value.length; st(`downloading… ${(got / 1e6).toFixed(1)}${total ? ' of ' + (total / 1e6).toFixed(1) : ''} MB`); }
  st('unpacking…'); const txt = await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const head = txt.slice(0, 3000), pick = k => (head.match(new RegExp('"' + k + '":\\s*"([^"]+)"')) || [])[1];
  if (pick('universe') !== M.universe) throw new Error('the downloaded file belongs to a different dashboard');
  st('saving…'); await HLDB.put({k: M.universe, generated: pick('generated'), last: pick('last'), json: txt, saved: new Date().toISOString()});
  st('done, reloading…'); setTimeout(() => location.reload(), 500);
}
function olReset() { if (window.HLDB) HLDB.del(M.universe).catch(() => {}).then(() => location.reload()); }
async function olBanner() {
  if (!DU || L.ok) return; let seen = false; try { seen = sessionStorage.getItem('hl-olbanner') === '1'; } catch (e) {} if (seen) return;
  let m = null; try { m = await olMeta(); } catch (e) { return; } if (!cmpNewer(m)) return;
  try { sessionStorage.setItem('hl-olbanner', '1'); } catch (e) {}
  const b = autoBar(`<b>NEWER PRICES ONLINE</b><span id="auSt">to ${esc(m.last)}</span><button class="btn on" id="olBn" type="button">Update now</button><button class="btn" id="auSkip" type="button">Later</button>`);
  b.onclick = e => {
    if (e.target.closest('#auSkip')) b.remove();
    else if (e.target.closest('#olBn')) { e.target.disabled = true; olGo(t => { const x = $('auSt'); if (x) x.textContent = t; }).catch(err => { const x = $('auSt'); if (x) x.textContent = err.message; e.target.disabled = false; }); }
  };
}

/* ---------------- Add a stock (any Yahoo Finance ticker) ---------------- */
HL.addStock = function (prefill) {
  const uni = M.universe || 'global';
  const row = r => `<div class="asr ${r.ok ? '' : 'bad'}" data-t="${esc(r.t)}"><div><b>${esc(r.t)}</b> ${r.ok ? `<span>${esc(r.name)}</span><em class="mono">${esc([r.exchange, r.currency, r.price != null ? r.price.toLocaleString(undefined, {maximumFractionDigits: 2}) : ''].filter(Boolean).join(' · '))}</em>` : `<em class="neg">${esc(r.error || 'not found')}</em>`}</div>${r.ok ? `<button class="btn on" data-add>Add</button>` : ''}</div>`;
  let found = {}, list = [], dirty = false, poll = null;
  const draw = () => {
    const have = new Set(list.map(x => x.t)), inU = t => !!HL.INST.find(i => i.t === t);
    return `<div class="gbody"><div class="sub" style="margin-bottom:10px">Type any Yahoo Finance symbol, for example <code>GOOGL</code>, <code>META</code>, <code>TD.TO</code>, <code>7203.T</code> (separate several with commas). Added stocks join <b>every</b> dashboard after a rebuild and get the full treatment: chart, signals, risk, valuation and technical and analyst ratings.</div>
    <div class="addrow"><input class="tinput" id="asT" placeholder="GOOGL, META …" autocomplete="off" spellcheck="false" value="${esc(prefill || '')}"><button class="btn on" id="asGo">Check</button></div>
    <div id="asRes"></div><div class="sec">YOUR ADDED STOCKS ${list.length ? '· ' + list.length : ''}</div>
    <div id="asList">${list.length ? list.map(x => `<span class="chip o" data-t="${esc(x.t)}">${esc(x.name && x.name !== x.t ? x.name + ' · ' : '')}${esc(x.t)} <u data-rm="${esc(x.t)}" title="Remove">✕</u>${inU(x.t) ? '' : ' <em class="mono">pending</em>'}</span>`).join(' ') : '<span class="sub">None yet.</span>'}</div>
    <div id="asAct" class="${dirty || list.some(x => !inU(x.t)) ? 'on' : ''}"><div class="sec">REBUILD TO SEE THEM</div><div class="sub" style="margin-bottom:8px">Prices are downloaded and every page is recalculated. It usually takes one to three minutes.</div>
      <div class="mf" style="justify-content:flex-start;padding:4px 0;gap:8px;flex-wrap:wrap"><button class="btn on" id="asRb">Rebuild this dashboard (${esc(uni)})</button><button class="btn" id="asRbAll">Rebuild all dashboards</button><span class="sub" id="asSt"></span></div><pre class="log" id="asLog" style="display:none"></pre></div></div>`;
  };
  const open = () => { const b = HL.modal(head('Add a stock') + draw(), onClick); const i = $('asT'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') check(); }; } };
  async function loadList() { try { const j = await L.api('/api/watchlist'); list = j.watchlist || []; } catch (e) {} }
  async function check() {
    const syms = [...new Set($('asT').value.toUpperCase().split(/[\s,;]+/).filter(Boolean))].slice(0, 10), out = $('asRes');
    if (!syms.length) return; if (!L.ok) { out.innerHTML = notRunning(); return; }
    out.innerHTML = '<div class="sub">Checking Yahoo Finance…</div>'; found = {};
    const rs = await Promise.all(syms.map(t => L.api('/api/lookup?t=' + encodeURIComponent(t), {timeout: 25000}).catch(e => ({ok: false, t, error: e.message}))));
    rs.forEach(r => found[r.t] = r); out.innerHTML = rs.map(r => row(r)).join('') + (rs.filter(r => r.ok).length > 1 ? '<div class="mf" style="justify-content:flex-start;padding:6px 0"><button class="btn on" data-addall>Add all found</button></div>' : '');
  }
  const notRunning = () => `<div class="pend"><b>The local server is not running.</b> Adding a stock needs it (a browser cannot download market data alone). Start it with <code>run_server.bat</code>, open <code>http://localhost:8765</code> and try again. Or add the symbol by hand: append a line such as <code>GOOGL,Alphabet,USD</code> to <code>data/watchlist.csv</code> and run the notebook.</div>`;
  async function save(rows) {
    if (!L.needToken()) return; try { const j = await L.api('/api/watchlist', {method: 'POST', body: {add: rows.map(r => ({t: r.t, name: r.name, ccy: r.currency}))}}); list = j.watchlist || list; dirty = true; } catch (e) { $('asRes').insertAdjacentHTML('afterbegin', `<div class="sub neg">${esc(e.message)}</div>`); return; }
    $('gbox').querySelector('.gbody').outerHTML = draw(); $('asT').onkeydown = e => { if (e.key === 'Enter') check(); };
  }
  async function rebuild(all) {
    if (!L.needToken()) return; const st = $('asSt'), lg = $('asLog'); $('asRb').disabled = $('asRbAll').disabled = true; st.textContent = 'starting…'; lg.style.display = 'block';
    try { await L.api('/api/refresh', {method: 'POST', body: {clear_cache: false, universes: all ? 'all' : [uni]}}); } catch (e) { st.textContent = e.message; $('asRb').disabled = $('asRbAll').disabled = false; return; }
    clearInterval(poll); poll = setInterval(async () => {
      try { const j = await L.api('/api/refresh/status'); lg.textContent = (j.log || []).slice(-12).join('\n'); lg.scrollTop = lg.scrollHeight;
        st.textContent = j.state === 'running' ? `running… ${Math.round(j.elapsed)} s` : j.state === 'done' ? 'done, reloading…' : 'failed (see the log)';
        if (j.state === 'done') { clearInterval(poll); setTimeout(() => location.reload(), 1000); } if (j.state === 'error') { clearInterval(poll); $('asRb').disabled = $('asRbAll').disabled = false; }
      } catch (e) { st.textContent = 'waiting for the server…'; }
    }, 2000);
  }
  function onClick(e) {
    if (e.target.closest('#asGo')) check();
    else if (e.target.closest('[data-addall]')) save(Object.values(found).filter(r => r.ok));
    else if (e.target.closest('[data-add]')) { const t = e.target.closest('.asr').dataset.t; save([found[t]]); }
    else if (e.target.closest('[data-rm]')) { const t = e.target.closest('[data-rm]').dataset.rm; if (!L.needToken()) return; L.api('/api/watchlist', {method: 'POST', body: {remove: [t]}}).then(j => { list = j.watchlist || []; dirty = true; $('gbox').querySelector('.gbody').outerHTML = draw(); $('asT').onkeydown = ev => { if (ev.key === 'Enter') check(); }; }).catch(() => {}); }
    else if (e.target.closest('#asRb')) rebuild(false); else if (e.target.closest('#asRbAll')) rebuild(true);
  }
  L.probe().then(() => (L.ok ? loadList() : null)).then(open);
};

/* ---------------- About ---------------- */
HL.about = () => HL.modal(head('About') + `<div class="about"><img src="${esc(document.querySelector('.brand img').src)}" alt="">
  <h3 class="hl">The Half Layer</h3><div class="sub">Global markets terminal · ${esc(M.universe)} universe</div>
  <div class="byline2">Developed by <b class="hl">Anish Luitel</b></div>
  <div class="kv" style="margin-top:14px;text-align:left"><div>Built</div><div>${esc(M.generated)}</div><div>Data</div><div>${esc(M.source)} · to ${esc(M.last)}</div><div>Instruments</div><div>${M.n_assets}</div><div>Currency</div><div>${esc(M.currency)}</div></div>
  <div class="sub" style="margin-top:12px;font-size:11.5px">Python · yfinance · Plotly · TradingView Lightweight Charts™. For education and research, not financial advice.</div></div>`);
})();
