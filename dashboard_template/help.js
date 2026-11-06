/* The Half Layer – "i" buttons everywhere + Info mode.   Developed by Anish Luitel
   Every element that has an explanation in help_data*.js gets (a) a small round "i" button, or
   (b) a corner "i" that appears on hover, and (c) can be clicked in Info mode (header button or "?" key). */
(() => {
'use strict';
const HL = window.HL, HELP = window.HL_HELP; if (!HL || !HELP) return;
const $ = id => document.getElementById(id), esc = HL.esc || (s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])));
const E = (k, t, w, h, i, r, f) => { HELP[k] = {t, w, h, i, r: r || '', f: f || ''}; };

/* ---- small extra entries that need engine-side keys ---- */
E('ohlc', 'Price legend', 'The open, high, low, close, change and volume of the bar under your cursor (or the latest bar when the cursor is away).', 'It updates as you move across the chart. The coloured values after it are the readings of each indicator on the same bar.', 'Display only. It is the exact-number companion to the chart.');
E('th:instrument', 'Instrument', 'The index or stock in the row.', 'Click the row to open it on the chart page. The coloured dot is its region.', 'Identifies the row.');
E('th:stock', 'Stock', 'The company in the row.', 'Click the row to open it on the chart page.', 'Identifies the row.');
E('th:tt:name', 'Indicator name', 'The technical indicator that casts a vote.', 'Each is computed from the price history of the current timeframe.', 'Part of the technical rating.');
E('th:tt:value', 'Indicator value', 'The current reading of the indicator.', 'For oscillators it is the indicator value; for moving averages it is the average\'s price level.', 'The vote is based on this value.');
E('th:tt:pivot', 'Pivot level', 'Support (S1 to S3), central pivot (P) and resistance (R1 to R3).', 'Computed from the previous period\'s high, low and close.', 'Possible reaction levels.');
['classic:Classic pivots:The traditional floor-trader formula built from the average of high, low and close.', 'fib:Fibonacci pivots:Levels placed at 38.2%, 61.8% and 100% of the previous range around the central pivot.', 'camar:Camarilla pivots:Tight levels built from the previous close and range, popular for intraday reversals.', 'woodie:Woodie pivots:Like classic but with extra weight on the closing price.'].forEach(s => { const [k, t, w] = s.split(':'); E('th:tt:' + k, t, w, 'The seven levels (S3 to R3) are calculated from the last period\'s high, low and close.', 'Possible support and resistance for the next period.'); });
[['1d', '1-day return', 'the previous close'], ['1w', '1-week return', 'five trading days ago'], ['1m', '1-month return', '21 trading days ago'], ['3m', '3-month return', '63 trading days ago'], ['6m', '6-month return', '126 trading days ago'], ['ytd', 'Year-to-date return', 'the last close of the previous year'], ['1y', '1-year return', '252 trading days ago']].forEach(([k, t, a]) => E('th:' + k, t, 'The percentage price change since ' + a + ', in the base currency.', 'Latest price ÷ price at the start of the window − 1, with each price converted to the base currency.', 'Shows momentum at this horizon. Compare columns: a negative 1D and a positive 1Y is a pullback in an uptrend.'));
E('th:m-tab:value', 'Position value', 'What the holding is worth now in the base currency.', 'Shares × latest price × exchange rate.', 'Weight and profit and loss.');
E('th:m-tab:1d', '1-day return', 'The holding\'s price change since the previous close.', 'Latest price ÷ previous close − 1.', 'Today\'s contribution to your portfolio.');

E('sec:leaders', 'Leaders', 'The five best performers over the last month in your current filter.', 'Ranked by the 21-trading-day return in the base currency.', 'Shows short-term winners. Last month\'s winners often cool off, so treat the list as information, not a shopping list.');
E('sec:laggards', 'Laggards', 'The five worst performers over the last month in your current filter.', 'Ranked by the 21-trading-day return in the base currency.', 'Shows where stress is concentrated, and sometimes where bargains or real problems are.');
E('sec:the five tests', 'The five trend tests', 'The five yes/no checks behind the trend score.', '1) price above SMA 200, 2) SMA 50 above SMA 200, 3) MACD histogram above zero, 4) RSI between 50 and 70, 5) 12-1 month momentum positive. Each pass is one point.', 'The Trend score column and the Score distribution chart.');
E('sec:rolling correlation', 'Rolling 1-year correlation', 'How the average correlation between markets and the benchmark has changed over time, using a moving one-year window.', 'For each date, the correlation is recalculated on the previous 252 trading days. A rising line means markets are moving more in sync.', 'Shows whether diversification has been getting weaker or stronger. It usually spikes in crises.');

E('watch-row', 'Watchlist row', 'One instrument in the watchlist: name, ticker, last price and the one-day change.', 'Click it to load the instrument on the chart. Green is up, red is down versus the previous close.', 'Which instrument the chart shows.');
E('alSnd', 'Alert sound', 'A tick box that turns the alert sound on or off.', 'When on, a short tone plays when an alert fires. The setting is remembered in this browser.', 'Only the sound. The pop-up and the chart marker always appear.');
E('tech-tf', 'Timeframe of the rating', 'The timeframe the technical rating was calculated on.', 'It matches the timeframe chosen in the top bar (for example 1 day). Replay adds a note when the rating is based on replayed data.', 'Change the timeframe and the whole rating changes with it.');
E('alert-row', 'Alert', 'One of your price alerts.', 'Shows the instrument, the condition and level, and whether it is active or already triggered. Click to jump to it; use the buttons to turn it on or off or delete it.', 'Notifications when the price meets the condition.');
E('th:m-st:scenario', 'Scenario', 'The "what if" being tested.', 'Market scenarios apply a fall to the benchmark and scale it by your portfolio beta. Historical rows replay your worst day and worst week. VaR rows use the loss exceeded on 5% of days.', 'The size of the loss in the next columns.');
E('th:m-st:impact', 'Impact (%)', 'The estimated percentage change of your portfolio in that scenario.', 'Market scenarios: benchmark move × beta. Historical rows: the actual worst return of your own portfolio.', 'How big the hit would be relative to your portfolio value.');
E('th:m-st:amount', 'Impact (in money)', 'The same estimate expressed in the base currency.', 'Impact % × today\'s portfolio value.', 'The size of the loss in money, which is what you would actually feel.');
E('th:m-rb:now', 'Current weight', 'How much of your portfolio each holding makes up today.', 'Position value ÷ portfolio value.', 'The starting point for the comparison.');
E('th:m-rb:target', 'Target weight', 'The weight each holding would have under the chosen scheme.', 'Equal weight = 1 ÷ number of holdings. Inverse volatility = proportional to 1 ÷ volatility, normalised to 100%.', 'The destination of the rebalance.');
E('th:m-rb:trade', 'Trade amount', 'How much to buy (positive) or sell (negative) to reach the target, in the base currency.', '(target weight − current weight) × portfolio value.', 'The size of the rebalance, before costs and taxes.');
E('th:m-rb:shares', 'Shares to trade', 'The number of shares to buy or sell to reach the target.', 'Trade amount ÷ latest price, in the stock\'s own currency.', 'What you would actually enter with your broker.');
E('th:52-week range', '52-week range', 'Where the price sits between its lowest and highest price of the last year.', 'The bar runs from the 52-week low (left) to the 52-week high (right); the mark is the latest price.', 'A price near the top means strong momentum, or an expensive entry; near the bottom means weakness, or a possible bargain.');
E('th:analyst rating', 'Analyst rating', 'The consensus rating from Yahoo Finance analysts, Strong buy to Strong sell.', 'Mean of all analyst ratings from 1 (Strong buy) to 5 (Strong sell).', 'Long-term opinion about the business, unlike the technical rating.');
E('th:analyst upside', 'Analyst upside', 'How far the average analyst price target is above or below today\'s price.', 'Average 12-month target ÷ latest price − 1.', 'Expected upside according to analysts. Often optimistic; use as a guide only.');

E('wlAdd', 'Add a stock', 'Adds any stock or ETF from Yahoo Finance to your dashboards, for example Alphabet (GOOGL) or Meta (META).', 'Type the symbol and press Check: the local server asks Yahoo Finance for its name, currency and last price. Press Add and the symbol is saved in <code>data/watchlist.csv</code>. After you rebuild, its prices are downloaded and every page is recalculated with it included.', 'Every page of every dashboard you rebuild: the heatmap, signals, risk, correlations, portfolio mix, valuation and backtest, plus the chart workstation. Needs the local server.');
E('rebuild', 'Rebuild', 'Downloads fresh prices and recalculates one dashboard (or all of them).', 'The local server re-runs the notebook for that universe in the background and the page then reloads. Stocks you added with Add a stock are included. It usually takes one to three minutes; the Mega dashboard takes longest.', 'The numbers, charts and ratings of that dashboard.');

/* ---- key index (normalised) ---- */
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}%/&² -]/gu, ' ').replace(/\s+/g, ' ').trim();
const nk = s => norm(s).replace(/ /g, '');
let IDX = {};
const rebuild = () => { IDX = {}; Object.keys(HELP).forEach(k => { const m = k.match(/^([a-z]+):(.*)$/); if (m) IDX[m[1] + ':' + nk(m[2])] = k; else IDX[k] = k; }); };
rebuild();
const look = (...cands) => { for (const c of cands) { if (!c) continue; const m = c.match(/^([a-z]+):(.*)$/), k = m ? m[1] + ':' + nk(m[2]) : c; if (IDX[k]) return IDX[k]; } return null; };
const ownText = el => { let t = ''; el.childNodes.forEach(n => { if (n.nodeType === 3) t += n.nodeValue; }); return t.trim() || el.textContent.trim(); };
const head = t => `<div class="mh"><b>${esc(t)}</b><button class="tb" data-close><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;

/* ---- the dialog ---- */
HL.info = function (key) {
  const h = HELP[key]; if (!h) return;
  const sec = (cls, label, body) => body ? `<div class="ik ${cls}">${label}</div><p class="ip">${body}</p>` : '';
  const html = head(h.t) + `<div class="gbody ihelp">
    ${sec('k1', 'What it is', h.w)}${sec('k2', 'How it works', h.h)}
    ${h.f ? `<div class="ik k5">Formula</div><pre class="fm">${esc(h.f)}</pre>` : ''}
    ${sec('k3', 'What it affects', h.i)}${sec('k4', 'How to read it', h.r)}
    <div class="ifoot">Plain-English explanation. For education and research, not financial advice.</div></div>`;
  HL.modal(html);
};

/* ---- rules ---- */
const TOOLMAP = {'cross cursor': 'cursor', 'trend line': 'trend', 'ray': 'ray', 'horizontal line': 'hline', 'vertical line': 'vline', 'rectangle': 'rect', 'fib retracement': 'fib', 'measure': 'measure', 'text note': 'text', 'create price alert': 'alert', 'fixed range volume profile': 'vpfix'};
const ALIAS = {ftype: 'f-type', freg: 'f-region', selchip: 'f-selected'};
const secKey = el => { let t = el.textContent.trim().split('·'); let s = t[0].trim(); if (/^\d+$/.test(s) && t[1]) s = t[1].trim(); const n = norm(s); if (/^vs /.test(n)) return look('sec:vs benchmark'); if (/^rolling 1-year correlation/.test(n)) return look('sec:rolling correlation'); return look('sec:' + s); };
const indKey = el => { const row = el.closest('[data-id]'); const S = HL.pro && HL.pro.S; const ind = row && S && S.inds.find(i => i.id === row.dataset.id); return ind ? look('ind:' + ind.key) : null; };
const idSel = Object.keys(HELP).filter(k => /^[A-Za-z][\w-]*$/.test(k) && !/^(p|m|v|f)-/.test(k)).concat(Object.keys(ALIAS)).map(k => '#' + k).join(',');
// mode: 'in' = inline inside the element, 'after' = right after the element, 'c' = corner badge on hover, 'C' = corner badge always, 'x' = Info mode only
const RULES = [
  {sel: '.panel[id]', key: el => look(el.id), mode: 'panel'},
  {sel: '[data-hh]', key: el => look(el.dataset.hh), mode: 'c'},
  {sel: '.kpi .l', key: el => look('kpi:' + ownText(el).split('·')[0]), mode: 'in'},
  {sel: 'table th', key: el => { let t = ownText(el); const sc = el.closest('table.tt') ? 'tt' : (el.closest('.panel') || {}).id, cc = String((HL.M && HL.M.currency) || '').split(/[-\s]/)[0]; if (cc) { if (norm(t) === norm(cc)) t = 'amount'; else t = t.replace(new RegExp('\\b' + cc + '\\b', 'i'), ''); } return look('th:' + sc + ':' + t, 'th:' + t); }, mode: 'in'},
  {sel: '.sec, .gh', key: secKey, mode: 'in'},
  {sel: '#sBody .th', key: el => look((el.querySelector('b') || {}).textContent === 'Alerts' ? 'sec:alerts' : null), mode: 'in'},
  {sel: '.filters .lbl', key: el => look({type: 'f-type', region: 'f-region'}[norm(el.textContent)]), mode: 'in'},
  {sel: '.filters .tag', key: () => look('f-note'), mode: 'x'},
  {sel: '.ctl label, .sl label, .hform label', key: el => look('lbl:' + ownText(el)), mode: 'in'},
  {sel: '.rail .st[data-v]', key: el => look('v-' + el.dataset.v), mode: 'c'},
  {sel: '.brand', key: () => look('brand'), mode: 'x'},
  {sel: '.ws-top .symbox', key: () => look('symbox'), mode: 'c'},
  {sel: '#sTabs button[data-v]', key: el => look('tab:' + el.dataset.v), mode: 'c'},
  {sel: '#wsTools .tb[title]', key: el => look('tool:' + TOOLMAP[norm(el.title.split('(')[0])]), mode: 'c'},
  {sel: '.mrow[data-k]', key: el => look('ind:' + el.dataset.k), mode: 'in'},
  {sel: '.lrow[data-id], .lgr[data-id]', key: indKey, mode: 'x'},
  {sel: '#sBody .gwrap', key: el => { const p = el.previousElementSibling; return look(p && p.classList.contains('sec') ? 'sec:analyst rating' : 'tech-gauge'); }, mode: 'C'},
  {sel: '#sBody .g2 > div', key: el => look((el.querySelector('b') || {}).textContent === 'Oscillators' ? 'tech-osc' : 'tech-ma'), mode: 'C'},
  {sel: '#sBody .dist', key: () => look('analyst-dist'), mode: 'x'},
  {sel: '#sBody .ptrow', key: () => look('analyst-target'), mode: 'x'},
  {sel: '.card .kv > div:nth-child(odd), .gbox .kv > div:nth-child(odd)', key: el => look('kv:' + ownText(el)), mode: 'x'},
  {sel: '.wl[data-t]', key: () => look('watch-row'), mode: 'x'},
  {sel: '#sBody .chk', key: () => look('alSnd'), mode: 'x'},
  {sel: '#sBody .th .tag', key: () => look('tech-tf'), mode: 'x'},
  {sel: '#sBody .arow', key: () => look('alert-row'), mode: 'x'},
  {sel: '#alNew', key: () => look('alert-create'), mode: 'c'},
  {sel: '.panel .seg[id], .ctl .seg[id]', key: el => look(ALIAS[el.id] || el.id), mode: 'after'},
  {sel: idSel, key: el => look(ALIAS[el.id] || el.id), mode: 'c'}
];
const NOBADGE = new Set(['sig', 'tape', 'wsClock', 'ohlc', 'wlq']);
const hostOf = el => el.tagName === 'INPUT' ? (el.closest('.search') || el.closest('label.filebtn')) : el;
function badge(key, cls) { const b = document.createElement('span'); b.className = 'ib ' + (cls || ''); b.setAttribute('role', 'button'); b.tabIndex = 0; b.dataset.i = key; b.title = 'What is this? Click to learn more'; b.setAttribute('aria-label', 'Info: ' + HELP[key].t); b.textContent = 'i'; return b; }
function apply(el, key, mode) {
  el.dataset.hk = key;
  if (mode === 'x' || NOBADGE.has(el.id)) return;
  if (mode === 'panel') { const h = el.querySelector(':scope > .ph > h3'); if (h && !(h.nextElementSibling && h.nextElementSibling.classList.contains('ib'))) h.insertAdjacentElement('afterend', badge(key, 'after')); return; }
  if (mode === 'in') { if (!el.querySelector(':scope > .ib')) el.appendChild(badge(key)); return; }
  if (mode === 'after') { if (!(el.nextElementSibling && el.nextElementSibling.classList.contains('ib'))) el.insertAdjacentElement('afterend', badge(key, 'after')); return; }
  const h = hostOf(el); if (!h) return; if (h !== el && !h.dataset.hk) h.dataset.hk = key;
  h.classList.add('hk-c'); if (!h.querySelector(':scope > .ib.corner')) h.appendChild(badge(key, 'corner' + (mode === 'C' ? ' always' : '')));
}
function scan() {
  RULES.forEach(rule => {
    let list; try { list = document.querySelectorAll(rule.sel); } catch (e) { return; }
    list.forEach(el => { if (el.dataset.hk) return; const key = rule.key(el); if (key) apply(el, key, rule.mode); });
  });
}
let pend = false;
const sched = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; try { scan(); } catch (e) { console.warn('help scan', e); } }); };
new MutationObserver(ms => {
  for (const m of ms) {
    if (m.type !== 'childList') continue; const t = m.target;
    if (t.closest && t.closest('#lgs, #lw, #ov, .plot, .js-plotly-plot, #tape, #toasts')) continue;
    if ([...m.addedNodes].every(n => n.nodeType === 1 && n.classList.contains('ib') || n.nodeType === 3)) { if (m.addedNodes.length) continue; }
    return sched();
  }
}).observe(document.body, {childList: true, subtree: true});
window.addEventListener('hl-view', sched);

/* ---- Info mode ---- */
const ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>';
$('hTools').insertAdjacentHTML('afterbegin', `<button class="hbtn info" id="hInfo" title="Info mode: click anything to learn what it is and how it works  ( ? )">${ICON}<span>Info</span></button>`);
let imode = false;
function setMode(on) {
  imode = on; document.body.classList.toggle('imode', on); $('hInfo').classList.toggle('on', on);
  let b = $('imbar'); if (on) { if (!b) { b = document.createElement('div'); b.id = 'imbar'; b.className = 'imbar'; b.innerHTML = `<b>INFO MODE</b><span>Click anything with an orange outline to learn what it is, how it works and what it affects.</span><button class="btn on" id="imoff">Done  (Esc)</button>`; document.body.appendChild(b); } b.style.display = 'flex'; } else if (b) b.style.display = 'none';
  sched();
}
HL.infoMode = setMode;
const modalOpen = () => $('gmodal').classList.contains('on');
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  const ib = t.closest('.ib[data-i]');
  if (ib) { e.preventDefault(); e.stopImmediatePropagation(); HL.info(ib.dataset.i); return; }
  if (t.closest('#imoff')) { e.preventDefault(); e.stopImmediatePropagation(); setMode(false); return; }
  if (t.closest('#hInfo')) { e.preventDefault(); e.stopImmediatePropagation(); setMode(!imode); return; }
  if (!imode) return;
  if (t.closest('#imbar')) return;
  if (t.closest('#gmodal') && !t.closest('[data-hk]')) return;
  const hk = t.closest('[data-hk]');
  if (hk && HELP[hk.dataset.hk]) { e.preventDefault(); e.stopImmediatePropagation(); HL.info(hk.dataset.hk); return; }
  if (t.closest('#modal')) return;
  e.preventDefault(); e.stopImmediatePropagation(); flash();
}, true);
let ft = 0;
function flash() { const b = $('imbar'); if (!b) return; b.classList.add('nope'); clearTimeout(ft); ft = setTimeout(() => b.classList.remove('nope'), 700); }
document.addEventListener('keydown', e => {
  const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
  if ((e.key === 'Enter' || e.key === ' ') && tg && tg.classList && tg.classList.contains('ib')) { e.preventDefault(); e.stopPropagation(); HL.info(tg.dataset.i); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '?') { e.preventDefault(); setMode(!imode); }
  else if (e.key === 'Escape' && imode && !modalOpen()) setMode(false);
}, true);

/* quick self-check hook for tests */
HL.help = {HELP, scan, look, get imode() { return imode; }, missing() {
  const out = [];
  document.querySelectorAll('.panel[id], .kpi .l, table th, .sec, .gh, .rail .st, #hTools .hbtn, .ws-top .tb, #wsTools .tb, #sTabs button, .ws-bot button, .filters .lbl').forEach(el => { if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return; if (!el.dataset.hk && !el.closest('[data-hk]')) out.push((el.id || el.className || el.tagName) + ' :: ' + (el.title || el.textContent.trim()).slice(0, 40)); });
  return out;
}};
sched();
})();
