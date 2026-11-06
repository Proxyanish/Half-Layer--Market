/* The Half Layer – SCREEN: click a quick list or a filter and see every matching stock.   Developed by Anish Luitel */
(() => {
'use strict';
const HL = window.HL; if (!HL) return;
window.HL_HELP = window.HL_HELP || {};
const HL_HELP = window.HL_HELP;
const {D, M, INST, V, VIEWS, nz, esc, pct, num, cls, short, rcol, panel, table, pill, dots, selectTicker} = HL;
const $ = id => document.getElementById(id);
const KEY = 'hl-screen-v1';
const lastv = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
const meanv = a => { const x = a.filter(nz); return x.length ? x.reduce((p, c) => p + c, 0) / x.length : null; };
const compact = v => !nz(v) ? '–' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0);
const price = v => !nz(v) ? '–' : v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(2) : v.toFixed(3);

/* ---------------- one row of numbers per stock ---------------- */
let ROWS = null;
function build() {
  if (ROWS) return ROWS;
  ROWS = INST.filter(i => i.type === 'Stock' && D.ohlc[i.t]).map(i => {
    const t = i.t, o = D.ohlc[t], c = o.c.filter(nz), px = lastv(o.c), w = c.slice(-252), hi = w.length ? Math.max(...w) : null, lo = w.length ? Math.min(...w) : null;
    const v20 = meanv(o.v.slice(-25).filter(nz).slice(-20)), tr = D.tr[t] || {}, sg = D.sig[t] || {}, rk = D.risk[t] || {}, f = (D.fund || {})[t] || {}, an = f.an || {};
    const tech = HL.techRating ? HL.techRating(t) : {idx: 2, label: '', score: null};
    const am = nz(an.mean) ? an.mean : null;
    let up = null; if (nz(an.tmean) && px > 0) { const ratio = an.tmean / px; if (ratio >= .2 && ratio <= 5) up = ratio - 1; }
    return {t, name: short(t), region: i.region, ccy: i.ccy, sector: f.sector || '', px, d1: tr['1D'], w1: tr['1W'], m1: tr['1M'], m3: tr['3M'], ytd: tr.YTD, y1: tr['1Y'],
      rsi: sg.rsi, trend: sg.score, p200: sg.p200, cross: sg.cross, mom: sg.mom, tech, amean: am, an: an, up, nA: an.n,
      alabel: am == null ? '' : am <= 1.5 ? 'Strong buy' : am <= 2.5 ? 'Buy' : am <= 3.5 ? 'Hold' : am <= 4.5 ? 'Sell' : 'Strong sell',
      vol20: v20, pos52: hi != null && hi > lo ? (px - lo) / (hi - lo) : null, fromHi: hi ? px / hi - 1 : null, fromLo: lo ? px / lo - 1 : null, vol: rk.vol, mdd: rk.mdd};
  });
  return ROWS;
}

/* ---------------- filters: every one is explained by its own "i" ---------------- */
const F = [
  {g: 'Price', id: 'p1', l: 'Under 1', f: r => r.px < 1, w: 'Share price below 1 (in the stock\'s own currency).', h: 'Compares the latest close with 1.', i: 'Sub-dollar stocks move in big percentage jumps and are often illiquid and volatile.'},
  {g: 'Price', id: 'p2', l: 'Under 2', f: r => r.px < 2, w: 'Share price below 2.', h: 'Compares the latest close with 2.', i: 'A middle band between the very cheapest names and the 5 limit.'},
  {g: 'Price', id: 'p5', l: 'Under 5 (penny)', f: r => r.px < 5, w: 'Share price below 5: the usual definition of a penny stock.', h: 'Compares the latest close with 5.', i: 'Restricts the list to penny-priced stocks. It is on by default in the Penny dashboard.'},
  {g: 'Analysts', id: 'asb', l: 'Strong buy', f: r => r.amean != null && r.amean <= 1.5, w: 'Wall Street analysts rate the stock Strong buy on average.', h: 'The mean rating from Yahoo Finance is 1.5 or lower on the 1 (Strong buy) to 5 (Strong sell) scale.', i: 'Shows stocks with the most bullish analyst consensus. Many penny stocks have no coverage at all and are left out when this is on.'},
  {g: 'Analysts', id: 'ab', l: 'Buy or better', f: r => r.amean != null && r.amean <= 2.5, w: 'Analysts rate the stock Buy or Strong buy on average.', h: 'Mean analyst rating of 2.5 or lower.', i: 'A wider net than Strong buy.'},
  {g: 'Analysts', id: 'acov', l: 'Has coverage', f: r => r.amean != null, w: 'At least one analyst follows the stock.', h: 'An analyst rating exists in the Yahoo Finance data.', i: 'Removes stocks nobody on Wall Street follows, which are the hardest to research.'},
  {g: 'Potential increase', id: 'u25', l: 'Target +25% or more', f: r => r.up != null && r.up >= .25, w: 'The average analyst price target is at least 25% above today\'s price.', h: 'Average 12-month target ÷ latest price − 1.', i: 'Ranks stocks by how much upside analysts see. Targets can be stale or too optimistic, especially for tiny companies.'},
  {g: 'Potential increase', id: 'u50', l: 'Target +50% or more', f: r => r.up != null && r.up >= .5, w: 'The average analyst target is at least 50% above today\'s price.', h: 'Average 12-month target ÷ latest price − 1.', i: 'A bigger potential gain, usually with more risk behind it.'},
  {g: 'Potential increase', id: 'u100', l: 'Target +100% or more', f: r => r.up != null && r.up >= 1, w: 'The average analyst target is at least double today\'s price.', h: 'Average 12-month target ÷ latest price − 1.', i: 'Extreme targets are often a sign of a very low price or of old analyst estimates. Check the date and number of analysts.'},
  {g: 'Technicals', id: 'tsb', l: 'Strong buy', f: r => r.tech && r.tech.idx === 4, w: 'The technical rating is Strong buy.', h: 'The net vote of 11 oscillators and 15 moving averages on daily data is above +0.5.', i: 'Short-term trend and momentum are strongly positive right now.'},
  {g: 'Technicals', id: 'tb', l: 'Buy or better', f: r => r.tech && r.tech.idx >= 3, w: 'The technical rating is Buy or Strong buy.', h: 'The net indicator vote is above +0.1.', i: 'Price action is positive on balance.'},
  {g: 'Trend', id: 'up', l: 'Uptrend (score 4+)', f: r => r.trend >= 4, w: 'The stock passes at least four of the five trend tests.', h: 'Price above SMA 200, SMA 50 above SMA 200, MACD histogram above zero, RSI between 50 and 70, positive 12-1 momentum.', i: 'Finds stocks whose trend is broadly healthy.'},
  {g: 'Trend', id: 'a200', l: 'Above 200-day', f: r => r.p200 > 0, w: 'The price is above its 200-day average.', h: 'Latest price ÷ 200-day simple average − 1 is positive.', i: 'The classic long-term trend filter.'},
  {g: 'Trend', id: 'gc', l: 'Golden cross', f: r => r.cross === 'Golden', w: 'The 50-day average is above the 200-day average.', h: 'SMA 50 > SMA 200.', i: 'A slow signal that the medium-term trend is stronger than the long-term trend.'},
  {g: 'Momentum', id: 'm20', l: '+20% in 1 month', f: r => r.m1 >= .2, w: 'The stock gained at least 20% over the last month.', h: '21-trading-day return in the base currency.', i: 'Shows fast movers. Big one-month gains often reverse, so treat it as a watch list.'},
  {g: 'Momentum', id: 'm3', l: 'Up over 3 months', f: r => r.m3 > 0, w: 'The stock is higher than three months ago.', h: '63-trading-day return is positive.', i: 'Confirms the move is more than one good week.'},
  {g: 'Momentum', id: 'bo', l: 'Near 52-week high', f: r => r.fromHi != null && r.fromHi >= -.05, w: 'The price is within 5% of its highest price of the last year.', h: 'Latest close ÷ 52-week high − 1 is above −5%.', i: 'Breakout candidates: strength tends to attract buyers.'},
  {g: 'Momentum', id: 'lo', l: 'Near 52-week low', f: r => r.fromLo != null && r.fromLo <= .15, w: 'The price is within 15% of its lowest price of the last year.', h: 'Latest close ÷ 52-week low − 1 is 15% or less.', i: 'Beaten-down stocks. Cheap can stay cheap: check why it fell.'},
  {g: 'Momentum', id: 'os', l: 'Oversold (RSI under 30)', f: r => r.rsi < 30, w: 'The 14-day RSI is below 30.', h: 'RSI compares recent gains with losses; under 30 is traditionally oversold.', i: 'Possible bounce candidates after a sharp fall.'},
  {g: 'Liquidity', id: 'v1', l: 'Volume 1M+ shares/day', f: r => r.vol20 >= 1e6, w: 'At least one million shares trade on an average day.', h: 'Average volume of the last 20 trading days.', i: 'Easier to buy and sell without moving the price. Illiquid penny stocks are risky to trade.'},
  {g: 'Liquidity', id: 'v5', l: 'Volume 5M+ shares/day', f: r => r.vol20 >= 5e6, w: 'At least five million shares trade on an average day.', h: 'Average volume of the last 20 trading days.', i: 'Very actively traded names.'},
  {g: 'Risk', id: 'rv', l: 'Volatility under 80%', f: r => r.vol != null && r.vol < .8, w: 'The yearly price swing is below 80%.', h: 'Annualised standard deviation of daily returns.', i: 'Removes the wildest names; penny stocks often exceed 100%.'},
  {g: 'Risk', id: 'rd', l: 'Drawdown better than −60%', f: r => r.mdd != null && r.mdd > -.6, w: 'The worst fall from a peak was less than 60%.', h: 'Maximum drawdown over the data period.', i: 'Removes stocks that have lost most of their value at some point.'}
];
const PRE = [
  {id: 'all', l: 'All stocks', d: 'Every stock in this dashboard', on: []},
  {id: 'sb', l: 'Strong buy', d: 'Analysts rate it Strong buy', on: ['asb']},
  {id: 'pot', l: 'Potential increase', d: 'Analyst target 50% or more above the price', on: ['u50']},
  {id: 'trip', l: 'Triple signal', d: 'Analyst buy, technical buy and 25% or more upside', on: ['ab', 'tb', 'u25']},
  {id: 'upt', l: 'Uptrend', d: 'Trend score 4+ and above the 200-day average', on: ['up', 'a200']},
  {id: 'brk', l: 'Breakouts', d: 'Near the 52-week high and up 20% in a month', on: ['bo', 'm20']},
  {id: 'ovs', l: 'Oversold', d: 'RSI under 30: possible bounce', on: ['os']},
  {id: 'p1', l: 'Under 1', d: 'Priced below 1', on: ['p1']},
  {id: 'liq', l: 'Easy to trade', d: 'One million or more shares a day', on: ['v1']}
];
F.forEach(f => { HL_HELP['scf:' + f.id] = {t: f.g + ': ' + f.l, w: f.w, h: f.h, i: f.i, r: '', f: ''}; });
PRE.forEach(p => { HL_HELP['scp:' + p.id] = {t: 'Quick list: ' + p.l, w: p.d + '. One click selects the filters below and shows every matching stock.', h: 'It switches on these filters: ' + (p.on.length ? p.on.map(id => { const f = F.find(x => x.id === id); return f.g + ' ' + f.l; }).join(', ') : 'none') + '. You can add or remove filters afterwards.', i: 'The results table at the bottom of the page.', r: 'The number on the card is how many stocks match.', f: ''}; });

const S = (() => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && Array.isArray(v.on)) return {on: new Set(v.on.filter(id => F.find(f => f.id === id))), q: String(v.q || '')}; } catch (e) {} return {on: new Set(), q: ''}; })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({on: [...S.on], q: S.q})); } catch (e) {} };
const match = (r, ids, q) => ids.every(id => F.find(f => f.id === id).f(r)) && (!q || (r.name + ' ' + r.t + ' ' + r.sector).toLowerCase().includes(q));
let cur = [];

/* ---------------- page ---------------- */
V.screener = {
  html: () => `<div class="grid"><div class="c12" id="scWarn"></div>
  ${panel('p-sq', 'c12', 'Quick lists', 'CLICK ONE TO SEE THE STOCKS', 'Each card switches on a set of filters below and lists every stock that passes. The number is how many match.', '<div class="sq" id="sqList"></div>')}
  ${panel('p-sf', 'c12', 'Filters', 'EVERY SELECTED FILTER MUST MATCH', 'Click chips to add or remove them. The small number on a chip is how many stocks would be left if you added it.', '<div class="sfbar"><input class="tinput" id="sfQ" placeholder="search name, ticker or sector…" autocomplete="off" spellcheck="false"><button class="btn" id="sfClear">Clear filters</button></div><div id="sfBody"></div>')}
  ${panel('p-sr', 'c12', 'Matching stocks', 'CLICK A ROW TO OPEN THE CHART', '', '<div class="srbar"><div id="srSum"></div><button class="btn" id="srCsv">Export CSV</button></div><div id="srTab"></div>')}
  </div>`,
  render
};
function render() {
  const rows = build(), n = rows.length, cheap = rows.filter(r => r.px < 5).length;
  $('scWarn').innerHTML = (M.universe === 'penny' || (n && cheap / n > .5)) ? `<div class="banner warn"><b>Penny stocks are high risk.</b> They trade in small volumes, can swing 20% in a day and are easy to manipulate. Prices come from Yahoo Finance and some figures may be missing. This page is a screen to help you research, not a recommendation to buy.</div>` : '';
  draw();
  $('sfQ').value = S.q;
  $('sfQ').oninput = e => { S.q = e.target.value.trim().toLowerCase(); save(); draw(); };
  $('sfClear').onclick = () => { S.on.clear(); S.q = ''; $('sfQ').value = ''; save(); draw(); };
  $('sqList').onclick = e => { const b = e.target.closest('.sqc'); if (!b || e.target.closest('.ib')) return; const p = PRE.find(x => x.id === b.dataset.p); S.on = new Set(p.on); save(); draw(); document.getElementById('p-sr').scrollIntoView({behavior: 'smooth', block: 'start'}); };
  $('sfBody').onclick = e => { const b = e.target.closest('.fc'); if (!b || e.target.closest('.ib')) return; const id = b.dataset.f; S.on.has(id) ? S.on.delete(id) : S.on.add(id); save(); draw(); };
  $('srCsv').onclick = csv;
}
function draw() {
  const rows = build(), act = [...S.on], matches = rows.filter(r => match(r, act, S.q)); cur = matches;
  const samePre = p => p.on.length === act.length && p.on.every(id => S.on.has(id));
  $('sqList').innerHTML = PRE.map(p => { const n = rows.filter(r => match(r, p.on, '')).length; return `<button type="button" class="sqc ${samePre(p) ? 'on' : ''}" data-p="${p.id}" data-hh="scp:${p.id}"><b>${esc(p.l)}</b><em>${n}</em><span>${esc(p.d)}</span></button>`; }).join('');
  const groups = [...new Set(F.map(f => f.g))];
  $('sfBody').innerHTML = groups.map(g => `<div class="fg"><div class="fl">${g}</div><div class="fcs">${F.filter(f => f.g === g).map(f => { const on = S.on.has(f.id), n = rows.filter(r => match(r, on ? act : act.concat(f.id), S.q)).length; return `<button type="button" class="fc ${on ? 'on' : ''}" data-f="${f.id}" data-hh="scf:${f.id}">${esc(f.l)}<i>${n}</i></button>`; }).join('')}</div></div>`).join('');
  $('srSum').innerHTML = `<b style="font:700 26px var(--mono);color:var(--orange)">${matches.length}</b> <span class="sub">of ${rows.length} stocks match${act.length ? ' · ' + act.map(id => { const f = F.find(x => x.id === id); return esc(f.g + ': ' + f.l); }).join(' · ') : ''}${S.q ? ' · “' + esc(S.q) + '”' : ''}</span>`;
  const rate = (l, i) => pill(esc(l), i >= 3 ? 'g' : i <= 1 ? 'r' : 'n');
  table('srTab', [
    {k: 'name', l: 'Stock', str: 1, f: (v, r) => `<span class="rd" style="background:${rcol(r.t)}"></span>${esc(v)} <em class="mono" style="font-size:10px;color:var(--dim)">${esc(r.t)}</em>`},
    {k: 'px', l: 'Price', f: (v, r) => `${price(v)} <em class="mono" style="font-size:10px;color:var(--dim)">${esc(r.ccy || '')}</em>`},
    {k: 'd1', l: '1D', f: v => pct(v, 1), c: cls}, {k: 'm1', l: '1M', f: v => pct(v, 0), c: cls}, {k: 'm3', l: '3M', f: v => pct(v, 0), c: cls}, {k: 'y1', l: '1Y', f: v => pct(v, 0), c: cls},
    {k: 'tech', l: 'Technical', f: (v, r) => rate(r.tech.label || '–', r.tech.idx), sv: r => r.tech.score, tip: 'Net vote of 26 indicators (same as the chart page)'},
    {k: 'amean', l: 'Analysts', f: (v, r) => r.alabel ? rate(r.alabel, r.amean <= 1.5 ? 4 : r.amean <= 2.5 ? 3 : r.amean <= 3.5 ? 2 : r.amean <= 4.5 ? 1 : 0) + ` <em class="mono" style="font-size:10px;color:var(--dim)">${r.amean.toFixed(1)}${nz(r.nA) ? ' · ' + r.nA : ''}</em>` : '<span class="sub">none</span>', sv: r => r.amean == null ? null : -r.amean, tip: 'Mean analyst rating (1 = Strong buy) and number of analysts'},
    {k: 'up', l: 'Target upside', f: v => pct(v, 0), c: cls, tip: 'Average analyst 12-month target versus the price'},
    {k: 'rsi', l: 'RSI', f: v => nz(v) ? v.toFixed(0) : '–'}, {k: 'trend', l: 'Trend', f: v => nz(v) ? dots(v) : '–'},
    {k: 'vol20', l: 'Avg volume', f: v => compact(v)},
    {k: 'pos52', l: '52-wk range', f: v => nz(v) ? `<span class="bar" style="margin:0;width:56px"><i style="width:${(v * 100).toFixed(0)}%"></i></span>` : '–', tip: 'Where the price sits between its 52-week low (left) and high (right)'},
    {k: 'vol', l: 'Volatility', f: v => pct(v, 0, false)}, {k: 'sector', l: 'Sector', str: 1, f: v => esc(v || '–')}
  ], matches, {row: t => selectTicker(t, true), k: 'up', h: 640});
  if (!matches.length) $('srTab').innerHTML = '<div class="sub" style="padding:24px 4px">No stock passes every selected filter. Remove a filter, or press Clear filters.</div>';
}
function csv() {
  const head = ['Ticker', 'Name', 'Price', 'Currency', '1D', '1M', '3M', '1Y', 'Technical', 'Analyst mean', 'Analyst label', 'Target upside', 'RSI', 'Trend score', 'Avg volume 20d', 'Volatility', 'Sector'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', f4 = v => nz(v) ? +v.toFixed(4) : '';
  const lines = [head.join(',')].concat(cur.map(r => [r.t, r.name, r.px, r.ccy, f4(r.d1), f4(r.m1), f4(r.m3), f4(r.y1), r.tech.label, f4(r.amean), r.alabel, f4(r.up), nz(r.rsi) ? +r.rsi.toFixed(1) : '', r.trend, nz(r.vol20) ? Math.round(r.vol20) : '', f4(r.vol), r.sector].map(q).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'})); a.download = `screen_${M.universe}_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
VIEWS.splice(3, 0, {id: 'screener', l: 'SCREEN', i: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>'});
HL.screen = {rows: () => build(), filters: F, state: S, matches: () => cur};
})();
