/* The Half Layer – MINE: your own portfolio. Add holdings, then see value, P&L, risk, allocation, stress tests and rebalancing. */
(() => {
'use strict';
const HL = window.HL; if (!HL) return;
const {D, M, BY, INST, V, VIEWS, nz, esc, pct, num, cls, short, rcol, panel, table, draw, ax, pill, REG, PAL, MONO, selectTicker, zBg} = HL;
const N = D.dates.length, KEY = 'hl-holdings-v1', $ = id => document.getElementById(id);
const BASE = M.base || '';
const CCYS = ['USD', 'CAD', 'EUR', 'GBP', 'GBX', 'CHF', 'JPY', 'HKD', 'INR', 'AUD', 'KRW', 'CNY', 'BRL', 'SEK', 'NOK', 'DKK', 'SGD', 'MXN', 'ZAR', 'NZD'];
const CNAME = {GBX: 'GBX (pence)'}, FXD = D.fx || {};
const perUSD = (c, i) => { if (c === 'USD') return 1; if (c === 'GBX') { const g = FXD.GBP; return g && g[i] != null ? g[i] * 100 : null; } const x = FXD[c]; return x && x[i] != null ? x[i] : null; };
const toBase = (ccy, i) => { if (!BASE) return null; const a = perUSD(BASE, i), b = perUSD(ccy, i); return a != null && b ? a / b : null; };      // base-currency units per 1 unit of ccy on day i
const ccyOpts = first => `<option value="">${first}</option>` + CCYS.map(c => `<option value="${c}">${CNAME[c] || c}</option>`).join('');
const money = (v, d) => nz(v) ? (v < 0 ? '−' : '') + Math.abs(v).toLocaleString(undefined, {maximumFractionDigits: d || 0}) : '–';
const smoney = v => nz(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString(undefined, {maximumFractionDigits: 0}) : '–';

/* ---------------- holdings storage ---------------- */
let H = (() => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch (e) {} return (D.holdings || []).map(h => ({t: h.t, shares: h.shares, cost: h.cost, date: h.date || '', note: h.note || ''})); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(H)); } catch (e) {} badge(); };
const S = {alloc: 'holding', perf: 'twr', scheme: 'equal', edit: null, msg: ''};
const hasData = t => !!D.ac[t];
const lastIdx = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; };
const firstFrom = (a, i0) => { for (let i = i0; i < a.length; i++) if (a[i] != null) return i; return -1; };
function dateIdx(s) { if (!s || s <= D.dates[0]) return 0; if (s > D.dates[N - 1]) return N - 1; let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (D.dates[m] >= s) hi = m; else lo = m + 1; } return lo; }
const WL = (() => { const out = []; let key = null; for (let i = 0; i < N; i++) { const d = D.dates[i], days = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000, k = Math.floor((days + 3) / 7); if (k !== key) { out.push(i); key = k; } else out[out.length - 1] = i; } return out; })();
const weekly = a => WL.map(i => a[i]);
const wrets = w => w.map((v, k) => k && v != null && w[k - 1] != null ? v / w[k - 1] - 1 : null);
const mean = a => { const x = a.filter(nz); return x.length ? x.reduce((p, c) => p + c, 0) / x.length : null; };
const stdev = a => { const x = a.filter(nz), m = mean(x); return x.length > 2 ? Math.sqrt(x.reduce((p, c) => p + (c - m) ** 2, 0) / (x.length - 1)) : null; };
const overlap = (a, b) => { const x = [], y = []; for (let i = 0; i < a.length; i++) if (nz(a[i]) && nz(b[i])) { x.push(a[i]); y.push(b[i]); } return [x, y]; };
function cov(a, b) { const [x, y] = overlap(a, b); if (x.length < 26) return null; const mx = mean(x), my = mean(y); return x.reduce((p, c, i) => p + (c - mx) * (y[i] - my), 0) / (x.length - 1); }
function corr(a, b) { const [x, y] = overlap(a, b); if (x.length < 26) return null; const c = cov(x, y), sx = Math.sqrt(cov(x, x)), sy = Math.sqrt(cov(y, y)); return sx && sy ? c / (sx * sy) : null; }

/* ---------------- analysis ---------------- */
function positions() {
  return H.filter(h => hasData(h.t) && h.shares > 0).map(h => {
    const ac = D.ac[h.t], oc = D.ohlc[h.t].c, li = lastIdx(ac); let pi = li; for (let i = li - 1; i >= 0; i--) if (ac[i] != null) { pi = i; break; }
    const b0 = firstFrom(ac, h.date ? dateIdx(h.date) : 0), bi = b0 < 0 ? li : b0, ratioNow = ac[li] / oc[li], ratioBuy = (ac[bi] != null && oc[bi]) ? ac[bi] / oc[bi] : ratioNow;
    const fxr = h.ccy && h.cost > 0 ? toBase(h.ccy, h.date ? bi : li) : null;        // you chose a cost currency: convert with that day's FX rate
    const costB = fxr != null ? h.shares * h.cost * fxr : h.cost > 0 ? h.shares * h.cost * (h.date ? ratioBuy : ratioNow) : (h.date ? h.shares * ac[bi] : null);
    const value = h.shares * ac[li], I = BY[h.t], f = (D.fund || {})[h.t] || {};
    return {t: h.t, name: short(h.t), h, shares: h.shares, bi: h.date ? bi : 0, li, value, day: value - h.shares * ac[pi], d1: ac[li] / ac[pi] - 1, last: oc[li], cost: h.cost, costB, pnl: costB != null ? value - costB : null, pnlPct: costB ? value / costB - 1 : null,
      region: I.region, ccy: I.ccy, sector: f.sector || (I.type === 'Index' ? 'Index / ETF' : 'Other'), mine: I.type === 'Mine'};
  });
}
function twr(P) {
  const idx = new Array(N).fill(null), val = new Array(N).fill(null); if (!P.length) return {idx, val, first: 0};
  const first = Math.min(...P.map(p => p.bi)); let level = 100; idx[first] = 100;
  for (let i = first; i < N; i++) {
    let v = 0; for (const p of P) if (p.bi <= i && D.ac[p.t][i] != null) v += p.shares * D.ac[p.t][i]; val[i] = v;
    if (i > first) { let tot = 0, r = 0; for (const p of P) { if (p.bi > i - 1) continue; const a0 = D.ac[p.t][i - 1], a1 = D.ac[p.t][i]; if (a0 == null || a1 == null) continue; const x = p.shares * a0; tot += x; r += x * (a1 / a0 - 1); } level *= tot > 0 ? 1 + r / tot : 1; idx[i] = level; }
  }
  return {idx, val, first};
}
function analyse() {
  const P = positions(), total = P.reduce((a, p) => a + p.value, 0); P.forEach(p => p.w = total ? p.value / total : 0);
  const T = twr(P), tw = T.idx, bench = D.ac[M.bench] || [], first = T.first, yrs = Math.max((N - 1 - first) / 252, .05);
  const wk = weekly(tw), pw = wrets(wk), bw = wrets(weekly(bench)), vol = stdev(pw) * Math.sqrt(52), mu = mean(pw) * 52, rf = M.rf;
  const [pwo, bwo] = overlap(pw, bw), c = cov(pwo, bwo), vb = cov(bwo, bwo), beta = c != null && vb ? c / vb : null;
  const sharpe = vol ? (mu - rf) / vol : null, last = tw[lastIdx(tw)], cagr = Math.pow(last / 100, 1 / yrs) - 1;
  let pk = -1, mdd = 0; const dd = tw.map(v => { if (v == null) return null; pk = Math.max(pk, v); const d = v / pk - 1; mdd = Math.min(mdd, d); return d; });
  const dr = []; for (let i = first + 1; i < N; i++) if (tw[i] != null && tw[i - 1] != null) dr.push(tw[i] / tw[i - 1] - 1); const sd = dr.slice().sort((a, b) => a - b), q = sd[Math.floor(sd.length * .05)] || 0, cvar = mean(sd.filter(x => x <= q));
  let wr = P.map(p => wrets(weekly(D.ac[p.t]))); const n = P.length, keep = wr.length ? wr[0].map((_, k) => wr.every(r => nz(r[k]))) : []; if (keep.filter(Boolean).length >= 52) wr = wr.map(r => r.map((v, k) => keep[k] ? v : null));
  const Sg = P.map((_, i) => P.map((__, j) => cov(wr[i], wr[j]) || 0));
  const w = P.map(p => p.w), sw = Sg.map(row => row.reduce((a, x, j) => a + x * w[j], 0)), v2 = w.reduce((a, x, i) => a + x * sw[i], 0);
  P.forEach((p, i) => { p.rc = v2 > 0 ? w[i] * sw[i] / v2 : null; p.vol = (D.risk[p.t] || {}).vol; });
  const Cm = P.map((_, i) => P.map((__, j) => i === j ? 1 : corr(wr[i], wr[j]))), pairs = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (nz(Cm[i][j])) pairs.push([i, j, Cm[i][j]]);
  const avgCorr = pairs.length ? pairs.reduce((a, x) => a + x[2], 0) / pairs.length : null, hhi = w.reduce((a, x) => a + x * x, 0), divRatio = v2 > 0 ? P.reduce((a, p) => a + p.w * (p.vol || 0), 0) / (Math.sqrt(v2) * Math.sqrt(52)) : null;
  return {P, total, T, tw, dd, first, vol, mu, beta, sharpe, cagr, mdd, last, q, cvar, Cm, pairs, avgCorr, hhi, effN: hhi ? 1 / hhi : null, divRatio, wr, pw, bw,
    cost: P.reduce((a, p) => a + (p.costB || 0), 0), pnl: P.reduce((a, p) => a + (p.pnl || 0), 0), day: P.reduce((a, p) => a + p.day, 0), worstWeek: Math.min(...pw.filter(nz)), worstDay: sd[0]};
}
const group = (A, key) => { const m = {}; A.P.forEach(p => { m[p[key] || '–'] = (m[p[key] || '–'] || 0) + p.value; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };

/* ---------------- page skeleton ---------------- */
V.mine = {
  html: () => `<div class="grid">
  ${panel('m-form', 'c12', 'My portfolio', 'SAVED IN THIS BROWSER', `Add what you own: ticker, number of shares, your average cost per share, the <b>currency you paid in</b> (leave on <i>Same as the stock</i> if you paid in the stock's own currency) and, optionally, the purchase date. Everything below is measured in <b>${esc(M.currency)}</b>. Stocks that are not in the dashboard's data yet are saved too, and flagged <b>pending</b> until you export the file and run the notebook once.`, `
    <div class="hform">
      <label>Ticker<input id="hT" list="hTL" placeholder="AAPL · RY.TO · 7203.T" autocomplete="off" spellcheck="false"><datalist id="hTL">${INST.map(i => `<option value="${esc(i.t)}">${esc(i.name)}</option>`).join('')}</datalist></label>
      <label>Shares<input id="hS" type="number" min="0" step="any" placeholder="10"></label>
      <label>Avg cost / share<input id="hC" type="number" min="0" step="any" placeholder="150.00"></label>
      <label>Purchase date <small>optional</small><input id="hD" type="date"></label>
      <label>Currency <small>of your cost</small><select id="hCcy">${ccyOpts("Same as the stock")}</select></label>
      <label id="hQrow" style="display:none">Quote currency <small>this ticker trades in</small><select id="hQc">${ccyOpts("Guess from the ticker")}</select></label>
      <label>Note <small>optional</small><input id="hN" type="text" placeholder="e.g. long-term"></label>
      <button class="btn on" id="hAdd">Add to portfolio</button>
    </div>
    <div class="hbtns"><label class="btn filebtn">Import CSV<input type="file" id="hFile" accept=".csv,text/csv" hidden></label><button class="btn" id="hExp">Export CSV</button><button class="btn" id="hEx">Load example</button><button class="btn" id="hClr">Clear all</button><span class="sub" id="hMsg"></span></div>
    <div id="mPend"></div>`)}
  <div class="c12" id="mEmpty" style="display:none"></div>
  <div id="mMain" style="display:contents">
  <div class="kpis" id="mKpi"></div>
  ${panel('m-tab', 'c8', 'Holdings', 'CLICK A ROW TO OPEN THE CHART', `Value, weight and profit or loss in ${esc(M.currency)}. Profit includes currency moves when the stock is priced in another currency. Click a column to sort, a row to open that stock's chart, ✎ to edit, ✕ to remove.`, '<div id="mTab"></div>')}
  ${panel('m-al', 'c4', 'Allocation', '', `Where your money sits. A single slice above about 25% means one stock can dominate your results.`, `<div class="ctl"><div class="seg" id="mAllocSeg">${[['holding', 'Holding'], ['sector', 'Sector'], ['region', 'Region'], ['ccy', 'Currency']].map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('')}</div></div><div id="mAlloc" class="plot" style="height:340px"></div>`)}
  ${panel('m-pf', 'c8', 'Performance vs benchmark', 'TIME-WEIGHTED', `<b>Return</b> chains daily results so that adding money later does not look like a gain (time-weighted return, base 100). <b>Value</b> is the market value of what you hold. Compared with ${esc(short(M.bench))} from the same start. Holdings without a purchase date are treated as held for the whole period.`, `<div class="ctl"><div class="seg" id="mPerfSeg"><button data-v="twr">Return</button><button data-v="val">Value</button></div></div><div id="mPerf" class="plot" style="height:360px"></div>`)}
  ${panel('m-hl', 'c4', 'Portfolio health', 'RULES OF THUMB', `Plain checks on concentration, diversification, risk and trend. Green is fine, amber deserves a look, red is a risk worth acting on. These are generic guidelines, not advice.`, '<div id="mHealth"></div>')}
  ${panel('m-rc', 'c6', 'Where your risk comes from', 'RISK vs WEIGHT', `Bars compare each holding's <b>share of money</b> with its <b>share of portfolio risk</b> (variance contribution, weekly returns). When risk is far above weight, that holding is driving your ups and downs.`, '<div id="mRisk" class="plot" style="height:330px"></div>')}
  ${panel('m-pl', 'c6', 'Profit &amp; loss by holding', '', `Each holding's gain or loss in ${esc(M.currency)}: who made the money and who lost it.`, '<div id="mPnl" class="plot" style="height:330px"></div>')}
  ${panel('m-co', 'c6', 'Correlation between your holdings', 'WEEKLY RETURNS', `Near <b>+1</b> the two move together (little diversification); near <b>0</b> they are independent; below 0 they offset each other.`, '<div id="mCorr" class="plot" style="height:380px"></div>', 'v')}
  ${panel('m-dd', 'c6', 'Drawdown', 'PEAK-TO-TROUGH', `How far your portfolio has been below its previous high.`, '<div id="mDD" class="plot" style="height:380px"></div>')}
  ${panel('m-st', 'c6', 'Stress tests', 'ESTIMATES', `What could happen to today's portfolio value. <b>Market scenarios</b> scale your beta; <b>historical</b> rows replay your own worst day and week; <b>VaR</b> is the loss exceeded on only 5% of days. Estimates only: real crashes move correlations to 1.`, '<div id="mStress"></div>')}
  ${panel('m-rb', 'c6', 'Rebalancing helper', 'ILLUSTRATIVE', `Compare today's weights with a simple target. <b>Equal</b> spreads value evenly; <b>Inverse volatility</b> gives calmer stocks more weight. Shares to trade are at the latest price, before costs and taxes.`, `<div class="ctl"><div class="seg" id="mSchemeSeg"><button data-v="equal">Equal weight</button><button data-v="invvol">Inverse volatility</button></div></div><div id="mReb"></div>`)}
  ${panel('m-tq', 'c12', 'Technicals &amp; analysts for your holdings', 'TRADINGVIEW-STYLE', `<b>Technical rating</b> is the net vote of 11 oscillators and 15 moving averages. <b>52-week range</b> shows where the price sits between its yearly low and high. <b>Analyst upside</b> is the average 12-month price target versus today's price.`, '<div id="mTech"></div>')}
  </div></div>`,
  render
};

/* ---------------- render ---------------- */
function render() {
  wire(); const A = analyse(), pend = H.filter(h => !hasData(h.t));
  $('mPend').innerHTML = pend.length ? `<div class="pend"><b>${pend.length} pending</b> – no data yet for: ${pend.map(h => `<span class="chip o">${esc(h.t)} <u data-rm="${esc(h.t)}" title="Remove">✕</u></span>`).join(' ')}
    <div class="sub" style="margin-top:6px">To analyse them: click <b>Export CSV</b>, save it as <code>data/my_portfolio.csv</code> next to the notebook, then run the notebook once (or <code>jupyter nbconvert --to notebook --execute --inplace global_market_analysis.ipynb</code>) and reopen the dashboard.</div></div>` : '';
  $('hMsg').textContent = S.msg; $('hAdd').textContent = S.edit ? 'Save changes' : 'Add to portfolio';
  const empty = !A.P.length; $('mMain').style.display = empty ? 'none' : 'contents'; const em = $('mEmpty'); em.style.display = empty ? 'block' : 'none';
  if (empty) { em.innerHTML = `<section class="panel" style="text-align:center;padding:34px 20px"><div class="hl" style="font-size:30px;margin-bottom:8px">${H.length ? 'Waiting for data' : 'Add your first stock'}</div><div class="sub" style="max-width:640px;margin:0 auto 14px">${H.length ? 'Your holdings are saved but none has price data in this dashboard yet. Export the CSV, save it as <code>data/my_portfolio.csv</code> and run the notebook once.' : 'Use the form above, import a CSV (ticker, shares, cost, date) or load an example portfolio to see how the analysis looks.'}</div><button class="btn on" id="hEx2">Load example portfolio</button></section>`; const b = $('hEx2'); if (b) b.onclick = loadExample; return; }
  if (!BASE) $('hMsg').textContent = "Base currency is 'local': totals mix currencies. Set CONFIG['base_currency'] for meaningful totals.";
  kpis(A); holdings(A); alloc(A); perf(A); health(A); risk(A); pnl(A); corrPlot(A); ddPlot(A); stress(A); rebalance(A); tech(A);
}
function kpis(A) {
  const K = (l, v, s, sm) => `<div class="kpi"><div class="l">${l}</div><div class="v hl ${sm ? 'sm' : ''}">${v}</div><div class="s">${s}</div></div>`;
  $('mKpi').innerHTML = K('Portfolio value', money(A.total), `${esc(M.currency)} · ${A.P.length} holdings`, true) +
    K('Unrealised P&amp;L', smoney(A.pnl), A.cost ? `${pct(A.pnl / A.cost, 1)} on ${money(A.cost)} invested` : 'add costs to see this', true) +
    K('Today', smoney(A.day), `${pct(A.total ? A.day / (A.total - A.day) : null, 2)} vs previous close`, true) +
    K('Beta', nz(A.beta) ? num(A.beta) : '–', `vs ${esc(short(M.bench))} (weekly)`) +
    K('Volatility', nz(A.vol) ? pct(A.vol, 1, false) : '–', `annualised · Sharpe ${nz(A.sharpe) ? num(A.sharpe) : '–'}`) +
    K('Max drawdown', pct(A.mdd, 0), `now ${pct(A.dd[lastIdx(A.dd)], 1)} from peak`);
}
function holdings(A) {
  const rows = A.P.map(p => ({t: p.t, name: p.name, sh: p.h.shares, cost: p.cost, hc: p.h.ccy || p.ccy, last: p.last, value: p.value, w: p.w, pnl: p.pnl, pnlPct: p.pnlPct, d1: p.d1, mine: p.mine, ccy: p.ccy}));
  table('mTab', [{k: 'name', l: 'Holding', f: (v, r) => `<span class="rd" style="background:${rcol(r.t)}"></span>${esc(v)} <em class="mono" style="font-size:10px;color:var(--dim)">${esc(r.t)}</em>`, str: 1},
    {k: 'sh', l: 'Shares', f: v => v.toLocaleString(undefined, {maximumFractionDigits: 4})}, {k: 'cost', l: 'Avg cost', f: (v, r) => nz(v) ? v.toLocaleString(undefined, {maximumFractionDigits: 2}) + ` <em class="mono" style="font-size:10px;color:var(--dim)">${esc(r.hc)}</em>` : '–'}, {k: 'last', l: 'Last', f: v => v.toLocaleString(undefined, {maximumFractionDigits: 2})},
    {k: 'value', l: 'Value', f: v => money(v)}, {k: 'w', l: 'Weight', f: v => `${pct(v, 1, false)}<span class="bar"><i style="width:${Math.min(100, v * 250)}%"></i></span>`},
    {k: 'pnl', l: 'P&L', f: v => smoney(v), c: cls}, {k: 'pnlPct', l: 'P&L %', f: v => pct(v), c: cls}, {k: 'd1', l: '1D', f: v => pct(v, 2), c: cls},
    {k: 'x', l: '', f: (v, r) => `<u data-ed="${esc(r.t)}" title="Edit">✎</u> <u data-rm="${esc(r.t)}" title="Remove">✕</u>`}],
    rows, {row: t => selectTicker(t, true), k: 'value', h: 420});
}
function alloc(A) {
  const g = S.alloc === 'holding' ? A.P.map(p => [p.name, p.value]).sort((a, b) => b[1] - a[1]) : group(A, S.alloc);
  [...$('mAllocSeg').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.alloc));
  draw('mAlloc', [{type: 'pie', hole: .62, labels: g.map(x => x[0]), values: g.map(x => x[1]), sort: false, marker: {colors: PAL, line: {color: '#07122E', width: 2}}, textinfo: 'percent', textfont: {family: MONO, size: 10, color: '#fff'}, hovertemplate: '%{label}<br>%{value:,.0f} ' + BASE + '<br>%{percent}<extra></extra>'}],
    {margin: {l: 6, r: 6, t: 6, b: 6}, showlegend: true, legend: {font: {size: 10}, orientation: 'h', y: -.05}, annotations: [{text: `<b>${money(A.total)}</b><br><span style="font-size:10px">${BASE}</span>`, showarrow: false, font: {family: MONO, size: 14, color: '#E8F0FF'}}]});
}
function perf(A) {
  [...$('mPerfSeg').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.perf));
  const f = A.first, x = D.dates.slice(f), tw = A.tw.slice(f), b0 = (D.ac[M.bench] || [])[f], bench = (D.ac[M.bench] || []).slice(f).map(v => v == null || b0 == null ? null : 100 * v / b0);
  if (S.perf === 'twr') draw('mPerf', [{x, y: tw, name: 'My portfolio', line: {color: '#FF9E2C', width: 2.6}, hovertemplate: '%{y:.1f}<extra>Portfolio</extra>'}, {x, y: bench, name: short(M.bench), line: {color: '#F6F0E2', width: 1.6, dash: 'dot'}, hovertemplate: '%{y:.1f}<extra>' + esc(short(M.bench)) + '</extra>'}],
    {hovermode: 'x unified', legend: {orientation: 'h', y: 1.1}, margin: {l: 48, r: 10, t: 8, b: 30}});
  else draw('mPerf', [{x, y: A.T.val.slice(f), name: 'Market value', fill: 'tozeroy', fillcolor: 'rgba(255,158,44,.14)', line: {color: '#FF9E2C', width: 2}, hovertemplate: '%{y:,.0f} ' + BASE + '<extra>Value</extra>'}], {hovermode: 'x unified', margin: {l: 62, r: 10, t: 8, b: 30}});
}
function health(A) {
  const top = [...A.P].sort((a, b) => b.w - a.w)[0], R = [], add = (k, t, x) => R.push({k, t, x});
  add(top.w > .4 ? 'r' : top.w > .25 ? 'a' : 'g', 'Concentration', `${esc(top.name)} is ${pct(top.w, 0, false)} of the portfolio. Effective number of holdings: ${num(A.effN, 1)} (of ${A.P.length}).`);
  if (nz(A.avgCorr)) add(A.avgCorr > .6 ? 'r' : A.avgCorr > .4 ? 'a' : 'g', 'Diversification', `Average correlation between holdings is ${num(A.avgCorr)}${nz(A.divRatio) ? `; diversification ratio ${num(A.divRatio)}` : ''}.${A.avgCorr > .6 ? ' They tend to move together.' : ''}`);
  const sec = group(A, 'sector'), s0 = sec[0]; if (s0) add(s0[1] / A.total > .5 ? 'a' : 'g', 'Sector', `${esc(s0[0])} is ${pct(s0[1] / A.total, 0, false)} of your money.`);
  const cc = group(A, 'ccy').filter(x => x[0] !== (BASE)), fx = cc.reduce((a, x) => a + x[1], 0) / A.total; if (BASE) add(fx > .6 ? 'a' : 'g', 'Currency', `${pct(fx, 0, false)} is in currencies other than ${esc(BASE)}; their moves add to your returns and risks.`);
  if (nz(A.beta)) add(A.beta > 1.3 ? 'a' : 'g', 'Market sensitivity', `Beta ${num(A.beta)}: when ${esc(short(M.bench))} moves 10%, you typically move about ${num(A.beta * 10, 1)}%.`);
  add(A.dd[lastIdx(A.dd)] < -.15 ? 'r' : A.dd[lastIdx(A.dd)] < -.07 ? 'a' : 'g', 'Drawdown', `${pct(A.dd[lastIdx(A.dd)], 1)} below the peak now; the worst so far was ${pct(A.mdd, 0)}.`);
  const up = A.P.filter(p => (D.sig[p.t] || {}).p200 > 0).reduce((a, p) => a + p.w, 0); add(up < .4 ? 'a' : 'g', 'Trend', `${pct(up, 0, false)} of your money is in stocks trading above their 200-day average.`);
  const losers = A.P.filter(p => nz(p.pnlPct) && p.pnlPct < -.15); if (losers.length) add('a', 'Losing positions', `${losers.length} holding${losers.length > 1 ? 's are' : ' is'} more than 15% below cost: ${losers.map(p => esc(p.name)).join(', ')}.`);
  $('mHealth').innerHTML = R.map(r => `<div class="hrow"><i class="hd ${r.k}"></i><div><b>${r.t}</b><div>${r.x}</div></div></div>`).join('');
}
function risk(A) {
  const P = [...A.P].sort((a, b) => b.w - a.w);
  draw('mRisk', [{type: 'bar', name: 'Share of money', x: P.map(p => p.name), y: P.map(p => p.w), marker: {color: '#6DB6FF'}, hovertemplate: '%{x}: %{y:.1%}<extra>weight</extra>'}, {type: 'bar', name: 'Share of risk', x: P.map(p => p.name), y: P.map(p => p.rc), marker: {color: '#FF9E2C'}, hovertemplate: '%{x}: %{y:.1%}<extra>risk</extra>'}],
    {barmode: 'group', yaxis: ax({tickformat: '.0%'}), xaxis: ax({tickangle: -35, automargin: true}), legend: {orientation: 'h', y: 1.12}, margin: {l: 44, r: 8, t: 8, b: 70}});
}
function pnl(A) {
  const P = [...A.P].filter(p => nz(p.pnl)).sort((a, b) => b.pnl - a.pnl);
  draw('mPnl', [{type: 'bar', x: P.map(p => p.name), y: P.map(p => p.pnl), marker: {color: P.map(p => p.pnl >= 0 ? '#6FF0A6' : '#FF6B7A')}, hovertemplate: '%{x}: %{y:,.0f} ' + BASE + '<extra></extra>', text: P.map(p => pct(p.pnlPct, 0)), textposition: 'outside', textfont: {family: MONO, size: 10, color: '#B9C9EA'}, cliponaxis: false}],
    {yaxis: ax({tickformat: ',.0f'}), xaxis: ax({tickangle: -35, automargin: true}), margin: {l: 62, r: 8, t: 14, b: 70}});
}
function corrPlot(A) {
  const order = A.P.map((p, i) => i).sort((i, j) => A.P[j].w - A.P[i].w), names = order.map(i => A.P[i].name), z = order.map(i => order.map(j => A.Cm[i][j]));
  draw('mCorr', [{type: 'heatmap', z, x: names, y: names, zmin: -1, zmax: 1, colorscale: [[0, '#FF6B7A'], [.5, '#0C1E4E'], [.75, '#3F7BD8'], [1, '#FF9E2C']], text: z.map(r => r.map(v => v == null ? '' : v.toFixed(2))), texttemplate: names.length > 12 ? '' : '%{text}', textfont: {size: 10, color: '#fff'}, colorbar: {thickness: 8, tickfont: {family: MONO, size: 9, color: '#8FA6D4'}, outlinewidth: 0}, xgap: 1, ygap: 1, hovertemplate: '%{y} × %{x}: %{z:.2f}<extra></extra>'}],
    {margin: {l: 110, r: 8, t: 8, b: 100}, yaxis: ax({autorange: 'reversed', automargin: true}), xaxis: ax({tickangle: -45, automargin: true})});
}
function ddPlot(A) {
  const f = A.first; draw('mDD', [{x: D.dates.slice(f), y: A.dd.slice(f), fill: 'tozeroy', fillcolor: 'rgba(255,107,122,.18)', line: {color: '#FF6B7A', width: 1.6}, hovertemplate: '%{y:.1%}<extra>drawdown</extra>'}], {hovermode: 'x unified', yaxis: ax({tickformat: '.0%'}), margin: {l: 48, r: 10, t: 8, b: 30}});
}
function stress(A) {
  const b = nz(A.beta) ? A.beta : 1, T = A.total, rows = [
    {t: '', s: 'Market −10% (using your beta)', p: -.10 * b}, {t: '', s: 'Market −20% (using your beta)', p: -.20 * b}, {t: '', s: 'Market +10% (using your beta)', p: .10 * b},
    {t: '', s: 'Every holding −20%', p: -.20}, {t: '', s: 'Your worst day so far', p: A.worstDay}, {t: '', s: 'Your worst week so far', p: A.worstWeek}, {t: '', s: '1-day VaR 95%', p: A.q}, {t: '', s: '1-day expected shortfall (CVaR)', p: A.cvar}].map((r, i) => ({...r, t: 's' + i, usd: r.p * T}));
  table('mStress', [{k: 's', l: 'Scenario', str: 1}, {k: 'p', l: 'Impact', f: v => pct(v, 1), c: cls}, {k: 'usd', l: BASE || 'Value', f: v => smoney(v), c: cls}], rows, {k: 'p', d: 1, h: 360});
}
function rebalance(A) {
  [...$('mSchemeSeg').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.scheme));
  const inv = A.P.map(p => 1 / (p.vol || .3)), si = inv.reduce((a, x) => a + x, 0), rows = A.P.map((p, i) => { const tgt = S.scheme === 'equal' ? 1 / A.P.length : inv[i] / si, dv = (tgt - p.w) * A.total, ac = D.ac[p.t][p.li]; return {t: p.t, name: p.name, w: p.w, tgt, dv, sh: dv / ac}; });
  table('mReb', [{k: 'name', l: 'Holding', str: 1}, {k: 'w', l: 'Now', f: v => pct(v, 1, false)}, {k: 'tgt', l: 'Target', f: v => pct(v, 1, false)}, {k: 'dv', l: `Trade (${BASE || 'value'})`, f: v => smoney(v), c: cls},
    {k: 'sh', l: 'Shares', f: v => nz(v) ? (v > 0 ? 'Buy ' : 'Sell ') + Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0) : '–', c: v => v > 0 ? 'pos' : 'neg'}], rows, {k: 'dv', h: 360});
}
function tech(A) {
  const rows = A.P.map(p => { const o = D.ohlc[p.t], c = o.c.filter(x => x != null).slice(-252), hi = Math.max(...o.h.filter(x => x != null).slice(-252)), lo = Math.min(...o.l.filter(x => x != null).slice(-252)), px = c[c.length - 1], f = (D.fund || {})[p.t], an = f && f.an, up = an && nz(an.tmean) && an.tmean / px > .2 && an.tmean / px < 5 ? an.tmean / px - 1 : null, tr = HL.techRating ? HL.techRating(p.t) : {score: null, label: ''}, s = D.sig[p.t] || {};
    return {t: p.t, name: p.name, rate: tr.score, rl: tr.label, ts: s.score, rsi: s.rsi, p200: s.p200, pos: hi > lo ? (px - lo) / (hi - lo) : null, up, am: an && nz(an.mean) ? an.mean : null}; });
  table('mTech', [{k: 'name', l: 'Holding', f: (v, r) => `<span class="rd" style="background:${rcol(r.t)}"></span>${esc(v)}`, str: 1},
    {k: 'rate', l: 'Technical rating', f: (v, r) => nz(v) ? pill(String(r.rl).toUpperCase(), /buy/i.test(r.rl) ? 'g' : /sell/i.test(r.rl) ? 'r' : 'n') : '–'}, {k: 'ts', l: 'Trend score', f: v => nz(v) ? HL.dots(v) : '–'},
    {k: 'rsi', l: 'RSI 14', f: v => num(v, 0), c: v => v > 70 ? 'warn' : v < 30 ? 'neg' : ''}, {k: 'p200', l: 'vs SMA 200', f: v => pct(v), c: cls},
    {k: 'pos', l: '52-week range', f: v => nz(v) ? `<span class="bar" style="width:70px"><i style="width:${v * 100}%"></i></span> ${pct(v, 0, false)}` : '–'},
    {k: 'am', l: 'Analyst rating', f: v => nz(v) ? `${v <= 1.5 ? 'Strong buy' : v <= 2.5 ? 'Buy' : v <= 3.5 ? 'Hold' : v <= 4.5 ? 'Sell' : 'Strong sell'} <em class="mono" style="color:var(--dim)">${num(v, 1)}</em>` : '–', c: v => v <= 2.5 ? 'pos' : v > 3.5 ? 'neg' : ''},
    {k: 'up', l: 'Analyst upside', f: v => pct(v, 1), c: cls}], rows, {row: t => selectTicker(t, true), k: 'rate', h: 380});
}

/* ---------------- add / edit / import / export ---------------- */
function setMsg(t) { S.msg = t; const m = $('hMsg'); if (m) m.textContent = t; }
function addHolding() {
  const t = $('hT').value.trim().toUpperCase(), sh = parseFloat($('hS').value), cost = parseFloat($('hC').value), date = $('hD').value, note = $('hN').value.trim();
  if (!t) return setMsg('Enter a ticker.'); if (!(sh > 0)) return setMsg('Enter the number of shares.');
  const ccy = $('hCcy').value, qccy = $('hQrow').style.display === 'none' ? '' : $('hQc').value, rec = {t, shares: sh, cost: cost > 0 ? cost : null, date, note, ccy, qccy};
  const k = H.findIndex(h => h.t === t);
  if (!S.edit && k >= 0 && (H[k].ccy || '') !== ccy && H[k].cost > 0 && rec.cost > 0) return setMsg(`${t} is already saved with cost currency ${H[k].ccy || 'same as the stock'}: use ✎ to edit it, or enter the new lot in that currency.`);
  if (S.edit) { const e = H.findIndex(h => h.t === S.edit); if (e >= 0) H[e] = rec; else H.push(rec); S.edit = null; setMsg(`Updated ${t}.`); }
  else if (k >= 0) { const o = H[k], tot = o.shares + sh; H[k] = {t, shares: tot, cost: (o.cost > 0 && rec.cost > 0) ? (o.cost * o.shares + rec.cost * sh) / tot : (rec.cost || o.cost), date: (o.date && date) ? (o.date < date ? o.date : date) : (o.date || date), note: note || o.note, ccy: o.ccy || ccy, qccy: o.qccy || qccy}; setMsg(`Added a lot to ${t} (now ${tot} shares, average cost merged).`); }
  else { H.push(rec); setMsg(hasData(t) ? `Added ${t}.` : `Added ${t}: no data yet, see "pending" below.`); }
  save(); ['hT', 'hS', 'hC', 'hD', 'hN', 'hCcy', 'hQc'].forEach(i => $(i).value = ''); $('hQrow').style.display = 'none'; render();
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()); if (!lines.length) return []; const sep = lines[0].includes(';') ? ';' : ',', split = l => l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
  let hdr = split(lines[0]).map(x => x.toLowerCase()); const has = hdr.some(x => /^(ticker|symbol)$/.test(x)); if (!has) hdr = ['ticker', 'shares', 'cost', 'date', 'note']; const body = has ? lines.slice(1) : lines;
  const col = names => hdr.findIndex(x => names.includes(x)), ct = col(['ticker', 'symbol']), cs = col(['shares', 'qty', 'quantity']), cc = col(['cost', 'avg_cost', 'price', 'buy_price']), cd = col(['date', 'purchase_date']), cn = col(['note', 'notes']), cy = col(['ccy', 'currency', 'cost_currency']), cq = col(['qccy', 'quote_currency']);
  return body.map(l => { const c = split(l); return {t: (c[ct] || '').toUpperCase(), shares: parseFloat(c[cs]), cost: parseFloat(c[cc]) > 0 ? parseFloat(c[cc]) : null, date: (c[cd] || '').slice(0, 10), note: c[cn] || '', ccy: (c[cy] || '').toUpperCase(), qccy: (c[cq] || '').toUpperCase()}; }).filter(r => r.t && r.shares > 0);
}
function exportCSV() {
  const rows = ['ticker,shares,cost,date,note,ccy,qccy'].concat(H.map(h => [h.t, h.shares, h.cost == null ? '' : h.cost, h.date || '', '"' + (h.note || '').replace(/"/g, '""') + '"', h.ccy || '', h.qccy || ''].join(',')));
  const u = URL.createObjectURL(new Blob([rows.join('\n') + '\n'], {type: 'text/csv'})), a = document.createElement('a'); a.href = u; a.download = 'my_portfolio.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 3000);
  setMsg('Saved my_portfolio.csv: put it in the notebook\'s data/ folder and run the notebook to analyse new tickers.');
}
function loadExample() {
  const pick = ['AAPL', 'NVDA', 'RY.TO', 'ASML.AS', '7203.T', 'JPM', 'SHOP.TO', 'NESN.SW'].filter(t => hasData(t)).slice(0, 6); if (!pick.length) return setMsg('No example tickers available in this universe.');
  H = pick.map((t, k) => { const oc = D.ohlc[t].c, bi = Math.max(0, N - 520 + k * 70), px = oc[firstFrom(oc, bi)] || oc[lastIdx(oc)], base = D.ac[t][firstFrom(D.ac[t], bi)] || 100; return {t, shares: Math.max(1, Math.round(9000 / base)), cost: +(px * (.97 + .03 * (k % 3))).toFixed(2), date: D.dates[Math.min(N - 1, bi)], note: 'example'}; });
  save(); setMsg('Loaded an example portfolio (clear it any time).'); render();
}
let wired = false;
function wire() {
  if (wired || !$('hAdd')) return; wired = true;
  $('hAdd').onclick = addHolding; ['hT', 'hS', 'hC', 'hD', 'hN'].forEach(i => $(i).addEventListener('keydown', e => { if (e.key === 'Enter') addHolding(); }));
  $('hT').addEventListener('input', () => { const t = $('hT').value.trim().toUpperCase(); $('hQrow').style.display = t && !hasData(t) ? '' : 'none'; });
  $('hT').addEventListener('change', () => { const t = $('hT').value.trim().toUpperCase(); if (hasData(t) && !$('hC').value) $('hC').placeholder = 'last ' + (HL.last ? HL.last(D.ohlc[t].c) : ''); });
  $('hExp').onclick = exportCSV; $('hEx').onclick = loadExample;
  $('hClr').onclick = () => { if (H.length && confirm('Remove all holdings from this browser?')) { H = []; S.edit = null; save(); setMsg('Cleared.'); render(); } };
  $('hFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const rows = parseCSV(String(r.result)); rows.forEach(x => { const k = H.findIndex(h => h.t === x.t); if (k >= 0) H[k] = x; else H.push(x); }); save(); setMsg(`Imported ${rows.length} holdings.`); render(); }; r.readAsText(f); e.target.value = ''; };
  $('mAllocSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.alloc = b.dataset.v; render(); } };
  $('mPerfSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.perf = b.dataset.v; render(); } };
  $('mSchemeSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.scheme = b.dataset.v; render(); } };
  const root = $('v-mine');
  root.addEventListener('click', e => {                       // capture removal / edit buttons before the table's row handler opens the chart
    const rm = e.target.closest('[data-rm]'), ed = e.target.closest('[data-ed]');
    if (rm) { e.stopPropagation(); H = H.filter(h => h.t !== rm.dataset.rm); save(); setMsg(`Removed ${rm.dataset.rm}.`); render(); }
    else if (ed) { e.stopPropagation(); const h = H.find(x => x.t === ed.dataset.ed); if (h) { S.edit = h.t; $('hT').value = h.t; $('hS').value = h.shares; $('hC').value = h.cost == null ? '' : h.cost; $('hD').value = h.date || ''; $('hN').value = h.note || ''; $('hCcy').value = h.ccy || ''; $('hQc').value = h.qccy || ''; $('hQrow').style.display = hasData(h.t) ? 'none' : ''; setMsg(`Editing ${h.t}: change the fields and press Save.`); $('hAdd').textContent = 'Save changes'; $('hS').focus(); window.scrollTo({top: 0, behavior: 'smooth'}); } }
  }, true);
}

/* ---------------- register the page + public API ---------------- */
VIEWS.push({id: 'mine', l: 'MINE', top: true, i: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3M3 13h18"/>'});
$('hTools').insertAdjacentHTML('beforeend', `<button class="hbtn mine" id="hMine" title="My portfolio: add your own stocks and analyse them"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3M3 13h18"/></svg><span>My portfolio</span><b class="cnt" id="hMineN"></b></button>`);
function badge() { const n = $('hMineN'); if (n) n.textContent = H.length ? H.length : ''; }
$('hMine').onclick = () => { if (HL.ST.view === 'mine') HL.show(HL.ST.prev && HL.ST.prev !== 'mine' ? HL.ST.prev : 'overview'); else HL.show('mine'); };
window.addEventListener('hl-view', e => $('hMine').classList.toggle('on', e.detail === 'mine')); badge();
HL.mine = {
  analyse, held: t => H.some(h => h.t === t), count: () => H.length,
  openAdd(t, price) { HL.show('mine'); setTimeout(() => { const T = $('hT'); if (!T) return; T.value = t; if (price != null) $('hC').placeholder = 'last ' + price; $('hS').focus(); setMsg(`Adding ${t}: enter shares and your average cost.`); window.scrollTo({top: 0}); }, 60); }
};
})();
