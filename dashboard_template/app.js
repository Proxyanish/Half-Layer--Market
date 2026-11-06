(() => {
'use strict';
const D = JSON.parse(document.getElementById('data').textContent);
const M = D.meta, INST = D.inst, BY = Object.fromEntries(INST.map(i => [i.t, i]));
const IDX = INST.filter(i => i.type === 'Index').map(i => i.t), STK = INST.filter(i => i.type === 'Stock').map(i => i.t);
const ALL = INST.map(i => i.t), N = D.dates.length;
const MONO = "'JetBrains Mono',ui-monospace,monospace";
const REG = {'North America':'#6DB6FF','Europe':'#B69CFF','Asia-Pacific':'#FF9E2C','Latin America':'#6FF0A6','Canada':'#FF6B7A','United States':'#6DB6FF','Other':'#8FA6D4'};
const PAL = ['#FF9E2C','#6DB6FF','#B69CFF','#6FF0A6','#FF6B7A','#5EEAD4','#F5D06F','#9DB8FF','#F08BD0','#A3E635','#FDBA74','#67E8F9','#C4B5FD','#FCA5A5','#86EFAC','#FACC15','#38BDF8','#E879F9','#4ADE80','#FB923C'];
const RULE_COL = {'Buy & hold':'#F6F0E2','Price > SMA200':'#FF9E2C','Golden cross':'#6DB6FF','MACD > signal':'#B69CFF','2-of-3 vote':'#6FF0A6'};
const $ = (s, e) => (e || document).querySelector(s);
const nz = v => v != null && typeof v === 'number' && isFinite(v);
const pct = (v, d = 1, sg = true) => nz(v) ? ((sg && v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%') : '–';
const num = (v, d = 2) => nz(v) ? v.toFixed(d) : '–';
const cls = v => !nz(v) ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const short = t => BY[t] ? BY[t].name : t;
const lab = t => BY[t] && BY[t].name !== t ? `${BY[t].name} (${t})` : t;
const rcol = t => REG[(BY[t] || {}).region] || REG.Other;
const median = a => { const s = a.filter(nz).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const last = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };

const ST = {view: 'overview', sel: BY[M.focus] ? M.focus : ALL[0], type: 'ALL', region: 'ALL', win: '1Y', ov: {s50: true, s200: true, bb: true},
  corr: 'idx', rules: new Set(D.bt ? D.bt.rules : []), pf: {kind: 'front', i: 0}, dcf: {g: M.dcf.growth_5y, tg: M.dcf.terminal_growth, r: M.dcf.discount_rate}, vsel: null};
const visible = t => (ST.type === 'ALL' || BY[t].type === ST.type) && (ST.region === 'ALL' || BY[t].region === ST.region);
const list = base => base.filter(visible);

/* ---------- plotly theme ---------- */
const merge = (a, b) => { const o = Array.isArray(a) ? [...a] : {...a}; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; return o; };
const AX = {gridcolor:'rgba(130,180,255,.10)', zerolinecolor:'rgba(130,180,255,.28)', linecolor:'rgba(130,180,255,.3)', tickfont:{family:MONO, size:10, color:'#8FA6D4'}, title:{font:{family:MONO, size:10, color:'#8FA6D4'}}};
const ax = o => merge(AX, o || {});
const BASE = {font:{family:'Inter,system-ui,sans-serif', color:'#CFE0FF', size:12}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:52, r:14, t:10, b:38},
  xaxis:AX, yaxis:AX, hoverlabel:{bgcolor:'#0B1B44', bordercolor:'#FF9E2C', font:{family:MONO, size:11, color:'#fff'}}, legend:{font:{size:11, color:'#CFE0FF'}, bgcolor:'rgba(0,0,0,0)'}};
const CFG = {responsive:true, displaylogo:false, displayModeBar:false};
// Plotly mutates the layout objects it receives (adds type/range/autorange), so every call gets its own deep copy of the merged layout.
const draw = (id, tr, lay) => { const el = document.getElementById(id); if (!el) return null; Plotly.react(el, tr, JSON.parse(JSON.stringify(merge(BASE, lay || {}))), CFG); return el; };
const onClick = (el, fn) => { if (!el) return; if (el.removeAllListeners) el.removeAllListeners('plotly_click'); el.on('plotly_click', ev => { const p = ev.points[0]; if (p && p.customdata) fn(Array.isArray(p.customdata) ? p.customdata[0] : p.customdata); }); };

/* ---------- series helpers ---------- */
function winStart(w) {
  if (w === 'ALL') return 0;
  if (w === 'YTD') { const py = String(+D.dates[N - 1].slice(0, 4) - 1); let i = 0; for (let j = 0; j < N; j++) if (D.dates[j].slice(0, 4) <= py) i = j; return i; }
  return Math.max(0, N - 1 - ({'3M':63, '6M':126, '1Y':252, '3Y':756}[w] || 252));
}
function rebase(t, i0) { const a = D.ac[t]; let b = null; for (let j = i0; j < N && b == null; j++) b = a[j]; return a.slice(i0).map(v => v == null || b == null ? null : 100 * v / b); }
function rets(t) { const a = D.ac[t], r = []; for (let i = 1; i < N; i++) if (a[i] != null && a[i - 1] != null) r.push(a[i] / a[i - 1] - 1); return r; }
function ddOf(a) { let pk = -Infinity; return a.map(v => { if (v == null) return null; pk = Math.max(pk, v); return v / pk - 1; }); }
function dcfv(f, g, tg, r) {
  if (!f || !(f.fcf > 0 && f.shares > 0 && r > tg && f.same)) return null;
  let pv = 0, cf = f.fcf; for (let t = 1; t <= 5; t++) { cf *= 1 + g; pv += cf / Math.pow(1 + r, t); }
  return (pv + cf * (1 + tg) / (r - tg) / Math.pow(1 + r, 5)) / f.shares;
}

/* ---------- ui helpers ---------- */
const note = h => `<div class="note"><span class="k">HOW TO READ</span>${h}</div>`;
const panel = (id, c, title, tag, nt, body, tc) => `<section class="panel ${c}" id="${id}"><div class="ph"><span class="dot"></span><h3>${title}</h3><span class="sp"></span>${tag ? `<span class="tag ${tc || ''}">${tag}</span>` : ''}</div>${nt ? note(nt) : ''}${body}</section>`;
const seg = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(o => `<button data-v="${esc(o.v)}" class="${o.v === cur ? 'on' : ''}">${o.d ? `<span class="d" style="background:${o.d}"></span>` : ''}${esc(o.l)}</button>`).join('')}</div>`;
const bindSeg = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = e => { const b = e.target.closest('button'); if (b) fn(b.dataset.v); }; };
const dots = n => `<span class="dots">${[1,2,3,4,5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const pill = (t, c) => `<span class="pill ${c}">${t}</span>`;
const nameCell = (v, r) => `<span class="rd" style="background:${rcol(r.t)}"></span>${esc(v)}`;
const heatBg = (v, sc) => { if (!nz(v)) return ''; const a = Math.min(.8, .08 + Math.abs(v) / (sc || .2) * .72); return `background:${v >= 0 ? `rgba(111,240,166,${a})` : `rgba(255,107,122,${a})`};text-shadow:0 1px 2px rgba(0,0,0,.55)`; };
const zBg = v => { if (!nz(v)) return ''; const a = Math.min(.7, Math.abs(v) / 2 * .6); return `background:${v >= 0 ? `rgba(111,240,166,${a})` : `rgba(255,107,122,${a})`}`; };
const TS = {};
function table(id, cols, rows, o) {
  o = o || {}; const el = document.getElementById(id); if (!el) return;
  const S = TS[id] = TS[id] || {k: o.k || cols[0].k, d: o.d || -1};
  const col = cols.find(c => c.k === S.k) || cols[0];
  const sorted = [...rows].sort((a, b) => { const x = col.sv ? col.sv(a) : a[col.k], y = col.sv ? col.sv(b) : b[col.k]; const xn = x == null || (typeof x === 'number' && !isFinite(x)), yn = y == null || (typeof y === 'number' && !isFinite(y)); if (xn && yn) return 0; if (xn) return 1; if (yn) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * S.d; });
  const old = el.querySelector('.tw'), st = old ? old.scrollTop : 0, sl = old ? old.scrollLeft : 0;
  el.innerHTML = `<div class="tw" style="${o.h ? `max-height:${o.h}px` : ''}"><table class="t ${o.tcls || ''}"><thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.k === S.k ? 's' : ''}" data-d="${S.d > 0 ? '▲' : '▼'}" style="${c.str && c !== cols[0] ? 'text-align:left' : ''}" ${c.tip ? `title="${esc(c.tip)}"` : ''}>${c.l}</th>`).join('')}</tr></thead><tbody>${sorted.map(r => `<tr data-t="${esc(r.t)}">${cols.map(c => { const v = r[c.k]; const h = c.f ? c.f(v, r) : (typeof v === 'number' ? num(v) : esc(v)); return `<td class="${c.c ? c.c(v, r) : ''}" style="${c.str && c !== cols[0] ? 'text-align:left;' : ''}${c.s ? c.s(v, r) : ''}">${h}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const nw = el.querySelector('.tw'); nw.scrollTop = st; nw.scrollLeft = sl;
  el.querySelector('thead').onclick = e => { const th = e.target.closest('th'); if (!th) return; const k = th.dataset.k; if (S.k === k) S.d *= -1; else { S.k = k; S.d = (cols.find(c => c.k === k).str ? 1 : -1); } table(id, cols, rows, o); };
  el.querySelector('tbody').onclick = e => { const tr = e.target.closest('tr'); if (tr && o.row) o.row(tr.dataset.t); };
}
const kvh = pairs => `<div class="kv">${pairs.map(p => `<div>${p[0]}</div><div class="${p[2] || ''}">${p[1]}</div>`).join('')}</div>`;
const empty = (id, msg) => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="sub" style="padding:24px 4px">${msg}</div>`; };

/* ---------- selection / navigation ---------- */
function selectTicker(t, go) { if (!BY[t]) return; ST.sel = t; if (go) show('explorer'); else renderView(ST.view); updateChipSel(); }
function updateChipSel() { const c = document.getElementById('selchip'); if (c) c.innerHTML = `SELECTED <b>${esc(short(ST.sel))}</b>`; }

/* =====================================================================  VIEW: OVERVIEW  */
const V = {};
V.overview = {
  html: () => `<div class="grid"><div class="kpis" id="kpis"></div>
  ${panel('p-heat', 'c7', 'Return heatmap', M.currency.toUpperCase(), `Green = up, red = down over each window, brighter = bigger move. Click any row to open it in the chart explorer. Use the filters above to focus on a region or on indices vs stocks.`, '<div id="heat"></div>')}
  ${panel('p-perf', 'c5', 'Relative performance', 'REBASED TO 100', `Every line starts at <code>100</code> at the left edge, so growth is directly comparable. Click a legend entry to hide it, double-click to isolate it. Stocks start hidden when you view everything.`, `<div class="ctl">${seg('winseg', ['3M','6M','YTD','1Y','3Y','ALL'].map(w => ({v: w, l: w})), ST.win)}</div><div id="perf" class="plot" style="height:430px"></div>`)}
  ${panel('p-reg', 'c4', 'By region', 'MEDIAN OF INDICES', `The median trailing return of the indices in each region. A quick read on <b>where</b> the strength is.`, '<div id="regbars" class="plot" style="height:300px"></div>')}
  ${panel('p-mov', 'c4', 'Leaders &amp; laggards', '1-MONTH', `Best and worst performers over the last 21 trading days within your filter.`, '<div id="movers"></div>')}
  ${panel('p-br', 'c4', 'Breadth map', 'ABOVE 200-DAY AVERAGE', `Each dot is an index. <b>Green</b> = trading above its 200-day average (long-term uptrend), <b>red</b> = below. When most are green the rally is broad; when few are, it is narrow and more fragile.`, '<div id="breadth"></div>')}
  </div>`,
  render() {
    const idxTR = IDX.map(t => [t, (D.tr[t] || {})['1M']]).filter(x => nz(x[1])).sort((a, b) => b[1] - a[1]);
    const R = M.regime, rc = R.regime === 'Risk-on' ? '#6FF0A6' : R.regime === 'Risk-off' ? '#FF6B7A' : '#FF9E2C', b = nz(R.breadth) ? R.breadth : 0;
    const topS = Object.entries(D.score || {}).filter(([t, s]) => nz(s.comp)).sort((a, c) => c[1].score - a[1].score)[0];
    const K = (l, v, s, sm) => `<div class="kpi"><div class="l">${l}</div><div class="v hl ${sm ? 'sm' : ''}">${v}</div><div class="s">${s}</div></div>`;
    document.getElementById('kpis').innerHTML =
      `<div class="kpi"><div class="l">Market regime</div><div class="gauge"><svg viewBox="0 0 120 70"><path d="M10 62A50 50 0 0 1 110 62" pathLength="100" fill="none" stroke="rgba(130,180,255,.2)" stroke-width="9" stroke-linecap="round"/><path d="M10 62A50 50 0 0 1 110 62" pathLength="100" fill="none" stroke="${rc}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${b * 100} 100" style="filter:drop-shadow(0 0 5px ${rc})"/><text x="60" y="55" text-anchor="middle" fill="#E8F0FF" font-family="${MONO}" font-weight="700" font-size="19">${nz(R.breadth) ? Math.round(b * 100) + '%' : '–'}</text></svg><div><div class="v hl sm" style="margin:0">${esc(R.regime)}</div></div></div><div class="s">of indices above their 200-day average</div></div>` +
      K('Global volatility', nz(R.global_vol) ? pct(R.global_vol, 1, false) : '–', `median 21-day vol · higher than ${nz(R.vol_percentile) ? Math.round(R.vol_percentile * 100) : '–'}% of its history`) +
      K('Best index · 1M', idxTR.length ? pct(idxTR[0][1]) : '–', idxTR.length ? esc(short(idxTR[0][0])) : '') +
      K('Worst index · 1M', idxTR.length ? pct(idxTR[idxTR.length - 1][1]) : '–', idxTR.length ? esc(short(idxTR[idxTR.length - 1][0])) : '') +
      K('Markets move together', nz(M.pc[0]) ? pct(M.pc[0], 0, false) : '–', `variance explained by the global factor · avg correlation ${num(M.avg_corr)}`) +
      K('Top-scored stock', topS ? esc(topS[1].name) : '–', topS ? `composite ${Math.round(topS[1].score)}/100 · relative ranking` : 'needs fundamentals', true);

    const hz = Object.keys(D.tr[ALL[0]] || {}), L = list(ALL);
    const cols = [{k: 'name', l: 'Instrument', f: nameCell, str: 1}].concat(hz.map(h => ({k: h, l: h, f: v => pct(v), s: v => heatBg(v, h === '1D' || h === '1W' ? .05 : .25), c: () => 'h'})));
    table('heat', cols, L.map(t => ({t, name: short(t), ...D.tr[t]})), {row: t => selectTicker(t, true), tcls: 'hm', h: 520, k: '1M'});

    const i0 = winStart(ST.win), tr = L.map((t, i) => {
      const isB = t === M.bench, hide = ST.type === 'ALL' && BY[t].type !== 'Index';
      return {x: D.dates.slice(i0), y: rebase(t, i0), name: short(t), type: 'scatter', mode: 'lines', visible: hide ? 'legendonly' : true, line: {width: isB ? 2.8 : 1.4, color: isB ? '#F6F0E2' : PAL[i % PAL.length]}, hovertemplate: '%{y:.1f}<extra>' + esc(short(t)) + '</extra>'};
    });
    draw('perf', tr, {hovermode: 'x unified', margin: {l: 44, r: 10, t: 8, b: 8}, legend: {orientation: 'h', y: -.12, font: {size: 10}}, xaxis: ax({}), yaxis: ax({})});

    const regs = [...new Set(L.filter(t => BY[t].type === 'Index').map(t => BY[t].region))], H = ['1M','3M','6M','YTD','1Y'].filter(h => hz.includes(h)), shade = ['#F6F0E2','#E0B472','#D79A6A','#C9805A','#94384A'];
    draw('regbars', H.map((h, i) => ({type: 'bar', name: h, x: regs, y: regs.map(r => median(L.filter(t => BY[t].type === 'Index' && BY[t].region === r).map(t => D.tr[t][h]))), marker: {color: shade[i]}, hovertemplate: '%{x} · ' + h + ': %{y:.1%}<extra></extra>'})),
      {barmode: 'group', yaxis: ax({tickformat: '.0%'}), legend: {orientation: 'h', y: -.18}, margin: {l: 44, r: 8, t: 8, b: 40}});

    const mv = L.map(t => [t, (D.tr[t] || {})['1M']]).filter(x => nz(x[1])).sort((a, c) => c[1] - a[1]), top5 = mv.slice(0, 5), bot5 = mv.slice(-5).reverse(), mx = Math.max(...mv.map(x => Math.abs(x[1])), .01);
    const row = x => `<div class="wb" style="grid-template-columns:130px 1fr 56px;margin:5px 0;cursor:pointer" data-t="${esc(x[0])}"><span class="n">${esc(short(x[0]))}</span><span class="b"><i style="width:${Math.abs(x[1]) / mx * 100}%;${x[1] < 0 ? 'background:linear-gradient(90deg,#FF6B7A,#94384A)' : ''}"></i></span><span class="p ${cls(x[1])}">${pct(x[1])}</span></div>`;
    const mvEl = document.getElementById('movers'); mvEl.innerHTML = `<div class="sec" style="margin-top:2px;border:0;padding:0">LEADERS</div>${top5.map(row).join('')}<div class="sec">LAGGARDS</div>${bot5.map(row).join('')}`;
    mvEl.onclick = e => { const r = e.target.closest('[data-t]'); if (r) selectTicker(r.dataset.t, true); };

    const bi = list(IDX).filter(t => D.sig[t] && nz(D.sig[t].p200)), up = bi.filter(t => D.sig[t].p200 > 0);
    const bEl = document.getElementById('breadth'); bEl.innerHTML = `<div class="v hl" style="font-size:34px">${up.length}<span style="font-size:18px"> / ${bi.length}</span></div><div class="sub" style="margin:2px 0 10px">indices in a long-term uptrend</div><div style="display:flex;flex-wrap:wrap;gap:7px">${bi.map(t => `<span class="chip ${D.sig[t].p200 > 0 ? 'g' : 'r'}" data-t="${esc(t)}" style="cursor:pointer">${esc(short(t))} ${pct(D.sig[t].p200, 1)}</span>`).join('')}</div>`;
    bEl.onclick = e => { const r = e.target.closest('[data-t]'); if (r) selectTicker(r.dataset.t, true); };
    bindSeg('winseg', v => { ST.win = v; renderView('overview'); });
  }
};

/* =====================================================================  INSTRUMENT CARD (used by the chart workstation sidebar)  */
function cardHtml(t) {
  const I = BY[t], tR = D.tr[t] || {}, s = D.sig[t] || {}, k = D.risk[t] || {}, c = D.capm[t], f = (D.fund || {})[t], sc = (D.score || {})[t], px = last(D.ohlc[t].c);
  return `<div class="sub" style="margin-bottom:2px"><span class="chip" style="border-color:${rcol(t)};color:${rcol(t)}">${esc(I.region)}</span> <span class="chip">${I.type === 'Mine' ? 'My stock' : I.type}</span></div>
      <h2>${esc(I.name)}</h2><div class="sub mono">${esc(t)} · ${esc(I.ccy)}</div><div class="px hl" style="font-size:28px">${px != null ? px.toLocaleString(undefined, {maximumFractionDigits: 2}) : '–'}</div>
      <div class="sec" style="margin-top:6px">RETURNS · ${esc(M.currency.toUpperCase())}</div>${kvh([['1 day', pct(tR['1D']), cls(tR['1D'])], ['1 month', pct(tR['1M']), cls(tR['1M'])], ['3 months', pct(tR['3M']), cls(tR['3M'])], ['Year to date', pct(tR['YTD']), cls(tR['YTD'])], ['1 year', pct(tR['1Y']), cls(tR['1Y'])]])}
      <div class="sec">SIGNALS</div>${kvh([['Trend score', dots(s.score || 0)], ['SMA 50 vs 200', s.cross ? pill(s.cross.toUpperCase(), s.cross === 'Golden' ? 'g' : 'r') : '–'], ['Price vs SMA 200', pct(s.p200), cls(s.p200)], ['RSI 14', num(s.rsi, 0)], ['12-1 momentum', pct(s.mom), cls(s.mom)]])}
      <div class="sec">RISK</div>${kvh([['CAGR', pct(k.cagr), cls(k.cagr)], ['Volatility', pct(k.vol, 1, false)], ['Sharpe', num(k.sharpe)], ['Max drawdown', pct(k.mdd, 0), 'neg'], [`VaR ${Math.round(M.conf * 100)}% (1-day)`, pct(k.var_h, 1, false)]])}
      ${c ? `<div class="sec">VS ${esc(short(M.bench).toUpperCase())}</div>${kvh([['Beta', num(c.beta)], ['Alpha (ann.)', pct(c.alpha), cls(c.alpha)], ['Alpha t-stat', num(c.alpha_t, 1)], ['Correlation', num(c.corr)]])}` : ''}
      ${f && sc ? `<div class="sec">FUNDAMENTALS · ${esc(f.sector || '')}</div>${kvh([['Scorecard', nz(sc.score) ? Math.round(sc.score) + ' / 100 ' + pill(esc(sc.tier).toUpperCase(), sc.tier === 'Top tier' ? 'g' : sc.tier === 'Bottom tier' ? 'r' : 'n') : '–'], ['P/E', num(f.pe, 1)], ['P/B', num(f.pb, 1)], ['Dividend yield', pct(f.div, 1, false)], ['ROE', pct(f.roe, 0, false)]])}` : ''}`;
}
V.explorer = {html: () => '<div class="panel c12"><div class="sub">Chart engine unavailable.</div></div>', render() {}};   // replaced by pro.js

/* =====================================================================  VIEW: SIGNALS  */
V.signals = {
  html: () => `<div class="grid">
  ${panel('p-sg', 'c8', 'Signal board', 'SCREEN · NOT A RECOMMENDATION', `<b>Trend score (0–5)</b> counts five yes/no tests: price above <code>SMA 200</code>, <code>SMA 50</code> above <code>SMA 200</code> (golden-cross state), <code>MACD</code> histogram above zero, <code>RSI</code> between 50 and 70, and positive 12-1 month momentum. Click a column to sort, a row to open the chart.`, '<div id="sgt"></div>')}
  ${panel('p-sd', 'c4', 'Score distribution', 'HOW MANY PASS', `How many of the filtered instruments pass 0, 1, 2 … 5 tests. A cluster at 4–5 means broad strength; a cluster at 0–1 means broad weakness.`, '<div id="sgd" class="plot" style="height:300px"></div><div class="sec">THE FIVE TESTS</div><div class="sub" style="line-height:2">① Price &gt; SMA 200 &nbsp;② SMA 50 &gt; SMA 200<br>③ MACD histogram &gt; 0 &nbsp;④ RSI 50–70<br>⑤ 12-1 momentum &gt; 0</div>')}
  </div>`,
  render() {
    const tr0 = t => (window.HL && HL.techRating) ? HL.techRating(t) : {score: null, label: ''}, L = list(ALL).filter(t => D.sig[t]), rows = L.map(t => ({t, name: short(t), ...D.sig[t], rate: tr0(t).score, rl: tr0(t).label}));
    table('sgt', [
      {k: 'name', l: 'Instrument', f: nameCell, str: 1}, {k: 'p200', l: 'vs SMA200', f: v => pct(v), c: cls, tip: 'Price relative to its 200-day average'},
      {k: 'rsi', l: 'RSI 14', f: v => nz(v) ? `${num(v, 0)}<span class="bar"><i style="width:${v}%;background:${v > 70 ? '#FF9E2C' : v < 30 ? '#6DB6FF' : '#8FA6D4'}"></i></span>` : '–', c: v => v > 70 ? 'warn' : ''},
      {k: 'macd', l: 'MACD hist', f: v => pct(v, 2), c: cls, tip: 'MACD histogram as % of price'}, {k: 'stoch', l: 'Stoch %K', f: v => num(v, 0)},
      {k: 'roc3', l: 'ROC 3M', f: v => pct(v), c: cls}, {k: 'mom', l: 'Mom 12-1', f: v => pct(v), c: cls},
      {k: 'cross', l: 'SMA 50/200', f: v => pill(String(v).toUpperCase(), v === 'Golden' ? 'g' : 'r'), str: 1}, {k: 'score', l: 'Trend score', f: v => dots(v)},
      {k: 'rate', l: 'Technical rating', tip: 'Net vote of 11 oscillators and 15 moving averages (TradingView-style): Strong sell … Strong buy', f: (v, r) => nz(v) ? pill(String(r.rl).toUpperCase(), /buy/i.test(r.rl) ? 'g' : /sell/i.test(r.rl) ? 'r' : 'n') : '–'}],
      rows, {row: t => selectTicker(t, true), k: 'score', h: 600});
    const cnt = [0, 1, 2, 3, 4, 5].map(n => rows.filter(r => r.score === n).length);
    draw('sgd', [{type: 'bar', x: ['0', '1', '2', '3', '4', '5'], y: cnt, marker: {color: ['#94384A', '#B05353', '#C9805A', '#D79A6A', '#E0B472', '#F6F0E2']}, hovertemplate: 'score %{x}: %{y}<extra></extra>'}],
      {margin: {l: 36, r: 8, t: 8, b: 32}, xaxis: ax({type: 'category', title: {text: 'TREND SCORE', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), yaxis: ax({dtick: 1})});
  }
};

/* =====================================================================  VIEW: RISK  */
V.risk = {
  html: () => `<div class="grid">
  ${panel('p-rr', 'c7', 'Risk vs return map', 'CLICK A POINT', `Up and to the left is better: more return for less volatility. ◆ = index, ● = stock. The colour is the region. Click any point to drill into it below.`, '<div id="rrmap" class="plot" style="height:470px"></div>')}
  ${panel('p-ds', 'c5', 'Return distribution', 'DAILY RETURNS', `The histogram is what actually happened. The dashed curve is a <b>bell curve</b> with the same average and spread – the gap in the tails is why simple models understate risk. <code>VaR</code> marks the loss exceeded only ${Math.round((1 - M.conf) * 100)}% of days; <code>CVaR</code> is the average loss on those days.`, '<div class="sub" id="dsname"></div><div id="dist" class="plot" style="height:410px"></div>')}
  ${panel('p-dd', 'c7', 'Drawdown', 'PEAK-TO-TROUGH', `How far below its previous high the price has been at each date: the pain you would have lived through. Orange = selected instrument, blue = benchmark.`, '<div id="ddc" class="plot" style="height:300px"></div>')}
  ${panel('p-vl', 'c5', 'Loss ladder', 'ONE-DAY, ' + Math.round(M.conf * 100) + '% CONFIDENCE', `Four ways to estimate a bad day. When <b>Cornish-Fisher</b> is well above <b>Normal</b>, the asset has fat or skewed tails that a bell curve hides.`, '<div id="vl" class="plot" style="height:300px"></div>')}
  ${panel('p-rt', 'c12', 'Risk &amp; return table', 'ALL METRICS', `<code>Sharpe</code> = excess return per unit of risk. <code>Sortino</code> counts only downside. <code>Max DD</code> = worst peak-to-trough fall. <code>Calmar</code> = CAGR ÷ |max drawdown|.`, '<div id="rtab"></div>')}
  </div>`,
  render() {
    const L = list(ALL).filter(t => D.risk[t]), regs = [...new Set(L.map(t => BY[t].region))], tr = [], crowded = L.length > 18;
    regs.forEach(rg => ['Index', 'Stock', 'Mine'].forEach(ty => { const ts = L.filter(t => BY[t].region === rg && BY[t].type === ty); if (!ts.length) return;
      tr.push({type: 'scatter', mode: (crowded && ty === 'Index') ? 'markers' : 'markers+text', name: `${rg} · ${ty === 'Mine' ? 'my stocks' : ty.toLowerCase() + 's'}`, x: ts.map(t => D.risk[t].vol), y: ts.map(t => D.risk[t].cagr), text: ts.map(short), textposition: 'top center', textfont: {size: 9, color: '#B9C9EA'}, customdata: ts, marker: {size: 12, symbol: ty === 'Index' ? 'diamond' : ty === 'Mine' ? 'star' : 'circle', color: REG[rg] || REG.Other, line: {width: 1, color: '#07122E'}},
        hovertemplate: '%{text}<br>CAGR %{y:.1%} · vol %{x:.1%}<extra></extra>'}); }));
    const el = draw('rrmap', tr, {xaxis: ax({tickformat: '.0%', title: {text: 'ANNUALISED VOLATILITY', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), yaxis: ax({tickformat: '.0%', title: {text: 'CAGR', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), legend: {orientation: 'h', y: -.2, font: {size: 10}}, margin: {l: 56, r: 10, t: 8, b: 70}});
    onClick(el, t => selectTicker(t, false));

    const t = ST.sel, k = D.risk[t]; document.getElementById('dsname').textContent = lab(t);
    if (k) {
      const r = rets(t), mu = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / (r.length - 1));
      const xs = Array.from({length: 120}, (_, i) => Math.min(...r) + (Math.max(...r) - Math.min(...r)) * i / 119);
      draw('dist', [{type: 'histogram', x: r, nbinsx: 70, histnorm: 'probability density', marker: {color: 'rgba(109,182,255,.55)', line: {color: 'rgba(109,182,255,.9)', width: .5}}, name: 'Actual', hovertemplate: '%{x:.2%}<extra></extra>'},
        {type: 'scatter', mode: 'lines', x: xs, y: xs.map(v => Math.exp(-0.5 * ((v - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))), name: 'Bell curve', line: {color: '#F6F0E2', dash: 'dash', width: 1.5}, hoverinfo: 'skip'}],
        {xaxis: ax({tickformat: '.0%'}), yaxis: ax({showticklabels: false}), legend: {orientation: 'h', y: 1.08}, margin: {l: 14, r: 10, t: 18, b: 34},
         shapes: [{type: 'line', x0: -k.var_h, x1: -k.var_h, yref: 'paper', y0: 0, y1: .92, line: {color: '#FF9E2C', width: 2, dash: 'dot'}}, {type: 'line', x0: -k.cvar, x1: -k.cvar, yref: 'paper', y0: 0, y1: .92, line: {color: '#FF6B7A', width: 2}}],
         annotations: [{x: -k.var_h, yref: 'paper', y: .97, text: 'VaR ' + pct(-k.var_h, 1, false), showarrow: false, font: {family: MONO, size: 10, color: '#FF9E2C'}, xanchor: 'left'}, {x: -k.cvar, yref: 'paper', y: .84, text: 'CVaR ' + pct(-k.cvar, 1, false), showarrow: false, font: {family: MONO, size: 10, color: '#FF6B7A'}, xanchor: 'right'}]});
      draw('vl', [{type: 'bar', orientation: 'h', y: ['CVaR (avg of worst days)', 'Cornish-Fisher VaR', 'Normal VaR', 'Historical VaR'], x: [k.cvar, k.var_cf, k.var_n, k.var_h], marker: {color: ['#94384A', '#C9805A', '#E0B472', '#F6F0E2']}, text: [k.cvar, k.var_cf, k.var_n, k.var_h].map(v => pct(v, 2, false)), textposition: 'outside', textfont: {family: MONO, size: 11, color: '#E8F0FF'}, hoverinfo: 'skip', cliponaxis: false}],
        {xaxis: ax({tickformat: '.0%', range: [0, k.cvar * 1.3]}), yaxis: ax({automargin: true}), margin: {l: 150, r: 40, t: 8, b: 30}});
      const tx = D.dates, ds = ddOf(D.ac[t]), db = ddOf(D.ac[M.bench] || []);
      draw('ddc', [{x: tx, y: ds, name: short(t), fill: 'tozeroy', fillcolor: 'rgba(255,158,44,.18)', line: {color: '#FF9E2C', width: 1.5}, hovertemplate: '%{y:.1%}<extra>' + esc(short(t)) + '</extra>'},
        ...(t !== M.bench && D.ac[M.bench] ? [{x: tx, y: db, name: short(M.bench), line: {color: '#6DB6FF', width: 1.2, dash: 'dot'}, hovertemplate: '%{y:.1%}<extra>' + esc(short(M.bench)) + '</extra>'}] : [])],
        {hovermode: 'x unified', yaxis: ax({tickformat: '.0%'}), legend: {orientation: 'h', y: 1.12}, margin: {l: 48, r: 10, t: 8, b: 30}});
    }
    table('rtab', [{k: 'name', l: 'Instrument', f: nameCell, str: 1}, {k: 'cagr', l: 'CAGR', f: v => pct(v), c: cls}, {k: 'vol', l: 'Volatility', f: v => pct(v, 1, false)}, {k: 'sharpe', l: 'Sharpe', f: v => num(v)}, {k: 'sortino', l: 'Sortino', f: v => num(v)},
      {k: 'mdd', l: 'Max DD', f: v => pct(v, 0), c: () => 'neg'}, {k: 'calmar', l: 'Calmar', f: v => num(v)}, {k: 'var_h', l: 'VaR hist', f: v => pct(v, 1, false)}, {k: 'var_cf', l: 'VaR C-F', f: v => pct(v, 1, false)},
      {k: 'cvar', l: 'CVaR', f: v => pct(v, 1, false)}, {k: 'skew', l: 'Skew', f: v => num(v)}, {k: 'kurt', l: 'Ex. kurt', f: v => num(v)}, {k: 'worst', l: 'Worst day', f: v => pct(v), c: () => 'neg'}],
      L.map(t => ({t, name: short(t), ...D.risk[t]})), {row: t => selectTicker(t, false), k: 'sharpe', h: 460});
  }
};

/* =====================================================================  VIEW: CROSS-MARKET  */
V.cross = {
  html: () => `<div class="grid">
  ${panel('p-cm', 'c7', 'Correlation matrix', 'CLUSTERED', `Correlation runs from <b>−1</b> (opposite) through <b>0</b> (unrelated) to <b>+1</b> (move together). Related markets are re-ordered next to each other so blocks appear. Diversification only helps when correlations are <code class="v">below 1</code>. Based on ${M.xfreq} returns because markets close at different times.`, `<div class="ctl">${seg('cset', [{v: 'idx', l: 'Indices'}, {v: 'stk', l: 'Stocks'}], ST.corr)}</div><div id="cmat" class="plot" style="height:600px"></div>`, 'v')}
  ${panel('p-pc', 'c5', 'How synchronised is the world?', 'PCA', `The first principal component is the single "global factor". The higher its share of variance, the more markets move as one and the weaker diversification becomes.`, `<div class="stat3" id="pcs"></div><div class="sec">ROLLING 1-YEAR CORRELATION WITH ${esc(short(M.bench).toUpperCase())}</div><div id="roll" class="plot" style="height:330px"></div>`, 'v')}
  ${panel('p-ab', 'c5', 'Beta vs alpha', 'VS BENCHMARK', `<b>Beta</b> = sensitivity to the benchmark (1.3 = typically moves 30% more). <b>Alpha</b> = return left after accounting for that. Up-and-right = high beta with strong alpha. Click a point to open it.`, '<div id="abm" class="plot" style="height:400px"></div>')}
  ${panel('p-cp', 'c7', 'CAPM statistics', 'VS ' + esc(short(M.bench).toUpperCase()), `<code>Alpha t-stat</code> under ±2 means the alpha could easily be luck. <code>Info ratio</code> = active return ÷ tracking error. <code>Up/Down capture</code> = share of the benchmark's up/down moves captured: &gt;100% up and &lt;100% down is ideal.`, '<div id="capm"></div>')}
  </div>`,
  render() {
    if (!STK.length) ST.corr = 'idx';
    const C = D.corr[ST.corr] || D.corr.idx, names = C.order.map(short), n = names.length;
    draw('cmat', [{type: 'heatmap', z: C.z, x: names, y: names, zmin: -1, zmax: 1, colorscale: [[0, '#FF6B7A'], [.5, '#0C1E4E'], [.75, '#3F7BD8'], [1, '#FF9E2C']], text: C.z.map(r => r.map(v => v == null ? '' : v.toFixed(2))), texttemplate: n > 12 ? '' : '%{text}', textfont: {size: 9, color: '#fff'},
      colorbar: {thickness: 10, tickfont: {family: MONO, size: 9, color: '#8FA6D4'}, outlinewidth: 0}, hovertemplate: '%{y} × %{x}: %{z:.2f}<extra></extra>', xgap: 1, ygap: 1}],
      {margin: {l: 120, r: 10, t: 8, b: 110}, yaxis: ax({autorange: 'reversed', automargin: true}), xaxis: ax({tickangle: -50, automargin: true})});
    bindSeg('cset', v => { ST.corr = v; renderView('cross'); });
    if (!STK.length) { const s = document.getElementById('cset'); if (s) s.style.display = 'none'; }
    document.getElementById('pcs').innerHTML = [0, 1, 2].map(i => `<div><div class="l">PC${i + 1} VARIANCE</div><div class="v hl">${nz(M.pc[i]) ? pct(M.pc[i], 0, false) : '–'}</div></div>`).join('') + `<div style="grid-column:span 3"><div class="l">AVERAGE PAIRWISE CORRELATION · INDICES</div><div class="v hl">${num(M.avg_corr)}</div></div>`;
    const rs = D.roll.s, sel = ST.sel, tr = IDX.filter(t => t !== sel && rs[t]).map(t => ({x: D.roll.dates, y: rs[t], name: short(t), line: {color: 'rgba(143,166,212,.35)', width: 1}, hovertemplate: '%{y:.2f}<extra>' + esc(short(t)) + '</extra>'}));
    if (rs[sel]) tr.push({x: D.roll.dates, y: rs[sel], name: short(sel), line: {color: '#FF9E2C', width: 2.6}, hovertemplate: '%{y:.2f}<extra>' + esc(short(sel)) + '</extra>'});
    draw('roll', tr, {showlegend: false, hovermode: 'x unified', yaxis: ax({range: [-.4, 1]}), margin: {l: 36, r: 8, t: 8, b: 30}});
    const L = list(ALL).filter(t => D.capm[t]), regs = [...new Set(L.map(t => BY[t].region))];
    const el = draw('abm', regs.map(rg => { const ts = L.filter(t => BY[t].region === rg); return {type: 'scatter', mode: 'markers', name: rg, x: ts.map(t => D.capm[t].beta), y: ts.map(t => D.capm[t].alpha), text: ts.map(short), customdata: ts, marker: {size: 11, color: REG[rg] || REG.Other, line: {width: 1, color: '#07122E'}}, hovertemplate: '%{text}<br>beta %{x:.2f} · alpha %{y:.1%}<extra></extra>'}; }),
      {xaxis: ax({title: {text: 'BETA', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), yaxis: ax({tickformat: '.0%', title: {text: 'ALPHA (ANN.)', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), legend: {orientation: 'h', y: -.2, font: {size: 10}}, margin: {l: 52, r: 10, t: 8, b: 66},
       shapes: [{type: 'line', x0: 1, x1: 1, yref: 'paper', y0: 0, y1: 1, line: {color: 'rgba(143,166,212,.4)', dash: 'dot'}}]});
    onClick(el, t => selectTicker(t, false));
    table('capm', [{k: 'name', l: 'Instrument', f: nameCell, str: 1}, {k: 'beta', l: 'Beta', f: v => num(v)}, {k: 'alpha', l: 'Alpha', f: v => pct(v), c: cls}, {k: 'alpha_t', l: 'α t-stat', f: v => num(v, 1)}, {k: 'r2', l: 'R²', f: v => pct(v, 0, false)}, {k: 'corr', l: 'Corr', f: v => num(v)},
      {k: 'te', l: 'Track. err.', f: v => pct(v, 1, false)}, {k: 'ir', l: 'Info ratio', f: v => num(v), c: cls}, {k: 'upcap', l: 'Up cap.', f: v => pct(v, 0, false)}, {k: 'dncap', l: 'Down cap.', f: v => pct(v, 0, false)}],
      L.map(t => ({t, name: short(t), ...D.capm[t]})), {row: t => selectTicker(t, false), k: 'beta', h: 400});
  }
};

/* =====================================================================  VIEW: PORTFOLIO  */
V.portfolio = {
  html: () => `<div class="grid">
  ${panel('p-ef', 'c8', 'Efficient frontier', 'MODERN PORTFOLIO THEORY', `The <b>red line</b> is the efficient frontier: the best expected return for each level of risk. The cloud is thousands of random portfolios. Drag the slider to walk along the frontier. Inputs are <b>shrunk</b> toward the average and every stock is capped at ${pct(M.max_w, 0, false)} so a single hot stock cannot dominate. A framework for thinking about diversification, not a recommendation.`, '<div id="ef" class="plot" style="height:540px"></div>')}
  ${panel('p-pw', 'c4', 'Selected portfolio', 'ILLUSTRATIVE', '', `<div class="ctl">${seg('pfk', [{v: 'minvar', l: 'Min variance'}, {v: 'sharpe', l: 'Max Sharpe'}, {v: 'equal', l: 'Equal weight'}], '')}</div>
    <div class="sl"><label>Risk dial <b id="pfl"></b></label><input type="range" id="pfs" min="0" max="10" value="0"></div><div class="stat3" id="pfst"></div><div id="pfw" class="wb"></div>`)}
  ${panel('p-pc2', 'c12', 'Weights compared', '', `How the three reference portfolios spread money across stocks. The optimisers concentrate; the equal-weight portfolio does not.`, '<div id="pfc" class="plot" style="height:360px"></div>')}
  </div>`,
  render() {
    const F = D.frontier; if (!F) { empty('ef', 'Needs at least three stocks with price history.'); return; }
    const sl = document.getElementById('pfs'); sl.max = F.pts.length - 1;
    if (ST.pf.kind === 'front') sl.value = Math.min(ST.pf.i, F.pts.length - 1);
    const cur = ST.pf.kind === 'front' ? {...F.pts[Math.min(ST.pf.i, F.pts.length - 1)], name: 'Frontier point'} : {...F.port[ST.pf.kind], name: {minvar: 'Min variance', sharpe: 'Max Sharpe', equal: 'Equal weight'}[ST.pf.kind]};
    document.getElementById('pfl').textContent = ST.pf.kind === 'front' ? `${pct(cur.vol, 1, false)} vol` : cur.name;
    [...document.getElementById('pfk').children].forEach(b => b.classList.toggle('on', b.dataset.v === ST.pf.kind));
    const P = F.port, tr = [
      {type: 'scatter', mode: 'markers', x: F.cloud.map(c => c[0]), y: F.cloud.map(c => c[1]), name: 'Random portfolios', marker: {size: 4, color: F.cloud.map(c => c[2]), colorscale: [[0, '#16346F'], [.5, '#6DB6FF'], [1, '#F6F0E2']], opacity: .6}, hovertemplate: 'vol %{x:.1%} · return %{y:.1%}<extra></extra>'},
      {type: 'scatter', mode: 'lines', x: F.pts.map(p => p.vol), y: F.pts.map(p => p.ret), name: 'Efficient frontier', line: {color: '#FF6B7A', width: 3.5}},
      {type: 'scatter', mode: 'markers+text', x: F.sd, y: F.mu, text: F.names, textposition: 'bottom center', textfont: {size: 9, color: '#8FA6D4'}, name: 'Single stocks', marker: {size: 7, color: '#8FA6D4'}, hovertemplate: '%{text}<br>vol %{x:.1%} · exp. return %{y:.1%}<extra></extra>'},
      ...[['minvar', 'Min variance', 'diamond', '#6DB6FF'], ['sharpe', 'Max Sharpe', 'star', '#FF9E2C'], ['equal', 'Equal weight', 'circle', '#F6F0E2']].map(a => ({type: 'scatter', mode: 'markers', x: [P[a[0]].vol], y: [P[a[0]].ret], name: a[1], marker: {size: 14, symbol: a[2], color: a[3], line: {width: 1.5, color: '#07122E'}}})),
      {type: 'scatter', mode: 'markers', x: [cur.vol], y: [cur.ret], name: 'Selected', marker: {size: 22, symbol: 'circle-open', color: '#FF9E2C', line: {width: 3, color: '#FF9E2C'}}, hoverinfo: 'skip'}];
    draw('ef', tr, {xaxis: ax({tickformat: '.0%', title: {text: 'VOLATILITY (ANNUAL)', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), yaxis: ax({tickformat: '.0%', title: {text: 'EXPECTED RETURN', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), legend: {orientation: 'h', y: -.16, font: {size: 10}}, margin: {l: 56, r: 10, t: 8, b: 70}});
    document.getElementById('pfst').innerHTML = [['EXP. RETURN', pct(cur.ret, 1), 'pos'], ['VOLATILITY', pct(cur.vol, 1, false), ''], ['SHARPE', num(cur.sh), '']].map(a => `<div><div class="l">${a[0]}</div><div class="v ${a[2]}">${a[1]}</div></div>`).join('');
    const mxw = Math.max(...cur.w, .01), rows = F.tickers.map((t, i) => [t, cur.w[i]]).filter(x => x[1] > .0005).sort((a, b) => b[1] - a[1]);
    document.getElementById('pfw').innerHTML = rows.map(x => `<span class="n">${esc(short(x[0]))}</span><span class="b"><i style="width:${x[1] / mxw * 100}%"></i></span><span class="p">${pct(x[1], 1, false)}</span>`).join('');
    draw('pfc', [['minvar', 'Min variance', '#6DB6FF'], ['sharpe', 'Max Sharpe', '#FF9E2C'], ['equal', 'Equal weight', '#8FA6D4']].map(a => ({type: 'bar', name: a[1], x: F.names, y: P[a[0]].w, marker: {color: a[2]}, hovertemplate: '%{x}: %{y:.1%}<extra>' + a[1] + '</extra>'})),
      {barmode: 'group', yaxis: ax({tickformat: '.0%'}), xaxis: ax({tickangle: -40, automargin: true}), legend: {orientation: 'h', y: 1.12}, margin: {l: 46, r: 8, t: 8, b: 80}});
    sl.oninput = () => { ST.pf = {kind: 'front', i: +sl.value}; V.portfolio.render(); };
    document.getElementById('pfk').onclick = e => { const b = e.target.closest('button'); if (b) { ST.pf = {kind: b.dataset.v, i: ST.pf.i}; V.portfolio.render(); } };
  }
};

/* =====================================================================  VIEW: VALUATION  */
V.value = {
  html: () => `<div class="grid">
  ${panel('p-dc', 'c12', 'DCF assumptions', 'LIVE · MOVE THE SLIDERS', `A discounted-cash-flow model values a company as the present value of its future free cash flow. The answer is <b>extremely sensitive</b> to these three inputs, so move them and watch every row change. It is a way to ask <i>"what must I believe?"</i>, not a price target. Trailing cash flow can be depressed by heavy investment, which makes some names look pessimistic.`,
    `<div class="ctl" style="gap:26px"><div class="sl"><label>5-year FCF growth <b id="gv"></b></label><input type="range" id="gs" min="0" max="0.25" step="0.005"></div><div class="sl"><label>Terminal growth <b id="tv"></b></label><input type="range" id="ts" min="0" max="0.04" step="0.001"></div><div class="sl"><label>Discount rate <b id="rv"></b></label><input type="range" id="rs" min="0.05" max="0.15" step="0.0025"></div><button class="btn" id="dcfreset">Reset</button></div>`)}
  ${panel('p-sc', 'c7', 'Scorecard', 'RANKS WITHIN THIS LIST ONLY', `Each stock is z-scored against the others on four factor families: <b>Value</b> (cheap vs earnings, book, cash, dividends), <b>Quality</b> (ROE, margins, low debt), <b>Momentum</b> (12-1 month, 6-month, distance above 200-day) and <b>Risk</b> (low volatility, shallow drawdown, Sharpe). The composite is ranked 0–100. Weights: ${Object.entries(M.weights).map(([k, v]) => `${k} ${pct(v, 0, false)}`).join(', ')}. It says which stocks look better <i>relative to each other</i>, never that one is a good buy.`, '<div id="sct"></div>')}
  ${panel('p-vq', 'c5', 'Value vs quality', 'COLOUR = MOMENTUM', `Top-right = cheap <b>and</b> high-quality. Greener dots have stronger momentum. Click a dot to open it.`, '<div id="vq" class="plot" style="height:430px"></div>')}
  ${panel('p-fd', 'c7', 'Fundamentals &amp; live DCF', 'LOCAL PRICES', `<code>DCF value</code> and <code>Upside</code> update live with the sliders. A DCF is only shown when the company reports in the same currency its shares trade in; otherwise it would silently mislead.`, '<div id="fdt"></div>')}
  ${panel('p-sg2', 'c5', 'DCF sensitivity', 'UPSIDE VS PRICE', `Each cell is the upside (or downside) versus today's price for a combination of growth (columns) and discount rate (rows), at your terminal-growth setting. Read it as <b>"what growth does the current price already assume?"</b>`, '<div class="ctl"><select class="tinput" id="vsel" style="width:auto"></select></div><div id="sens" class="plot" style="height:360px"></div>')}
  </div>`,
  render() {
    if (!D.fund || !STK.length) { ['sct', 'vq', 'fdt', 'sens'].forEach(i => empty(i, 'Needs stocks with fundamentals data.')); return; }
    const g = ST.dcf; const sets = (id, vid, v, f) => { const e = document.getElementById(id); e.value = v; document.getElementById(vid).textContent = f(v); };
    sets('gs', 'gv', g.g, v => pct(v, 1, false)); sets('ts', 'tv', g.tg, v => pct(v, 1, false)); sets('rs', 'rv', g.r, v => pct(v, 2, false));
    const upd = () => { ST.dcf = {g: +document.getElementById('gs').value, tg: +document.getElementById('ts').value, r: +document.getElementById('rs').value}; V.value.renderLive(); };
    ['gs', 'ts', 'rs'].forEach(i => document.getElementById(i).oninput = upd);
    document.getElementById('dcfreset').onclick = () => { ST.dcf = {g: M.dcf.growth_5y, tg: M.dcf.terminal_growth, r: M.dcf.discount_rate}; V.value.render(); };
    const S = list(STK).filter(t => D.score[t]);
    table('sct', [{k: 'name', l: 'Stock', f: nameCell, str: 1}, {k: 'tier', l: 'Tier', f: v => pill(esc(v).toUpperCase(), v === 'Top tier' ? 'g' : v === 'Bottom tier' ? 'r' : 'n'), str: 1}, {k: 'score', l: 'Score', f: v => nz(v) ? `${Math.round(v)}<span class="bar"><i style="width:${v}%"></i></span>` : '–'},
      {k: 'Value', l: 'Value', f: v => num(v), s: zBg}, {k: 'Quality', l: 'Quality', f: v => num(v), s: zBg}, {k: 'Momentum', l: 'Momentum', f: v => num(v), s: zBg}, {k: 'Risk', l: 'Risk', f: v => num(v), s: zBg}, {k: 'comp', l: 'Composite', f: v => num(v), c: cls}],
      S.map(t => ({t, name: short(t), ...D.score[t]})), {row: t => selectTicker(t, false), k: 'score', h: 470});
    const vq = S.filter(t => nz(D.score[t].Value) && nz(D.score[t].Quality)), vqel = draw('vq', [{type: 'scatter', mode: 'markers+text', x: vq.map(t => D.score[t].Value), y: vq.map(t => D.score[t].Quality), text: vq.map(short), customdata: vq, textposition: 'top center', textfont: {size: 9, color: '#B9C9EA'},
      marker: {size: 15, color: vq.map(t => D.score[t].Momentum), colorscale: [[0, '#FF6B7A'], [.5, '#B9C9EA'], [1, '#6FF0A6']], cmid: 0, line: {width: 1, color: '#07122E'}, colorbar: {thickness: 8, title: {text: 'MOM', font: {family: MONO, size: 9, color: '#8FA6D4'}}, tickfont: {family: MONO, size: 9, color: '#8FA6D4'}, outlinewidth: 0}}, hovertemplate: '%{text}<br>value %{x:.2f} · quality %{y:.2f}<extra></extra>'}],
      {xaxis: ax({title: {text: 'VALUE  →  CHEAPER', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), yaxis: ax({title: {text: 'QUALITY  →  BETTER BUSINESS', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), margin: {l: 52, r: 10, t: 8, b: 44}});
    onClick(vqel, t => selectTicker(t, false));
    const valid = STK.filter(t => D.fund[t] && D.fund[t].fcf > 0 && D.fund[t].same), sel = document.getElementById('vsel');
    if (!ST.vsel || !valid.includes(ST.vsel)) ST.vsel = valid.includes(ST.sel) ? ST.sel : valid[0];
    sel.innerHTML = valid.map(t => `<option value="${esc(t)}" ${t === ST.vsel ? 'selected' : ''}>${esc(short(t))}</option>`).join('') || '<option>none valid</option>';
    sel.onchange = () => { ST.vsel = sel.value; V.value.renderLive(); };
    V.value.renderLive();
  },
  renderLive() {
    const g = ST.dcf; document.getElementById('gv').textContent = pct(g.g, 1, false); document.getElementById('tv').textContent = pct(g.tg, 1, false); document.getElementById('rv').textContent = pct(g.r, 2, false);
    const S = list(STK).filter(t => D.fund[t]);
    table('fdt', [{k: 'name', l: 'Stock', f: nameCell, str: 1}, {k: 'sector', l: 'Sector', f: v => esc(v || '–'), str: 1}, {k: 'ccy', l: 'Ccy', f: v => esc(v || ''), str: 1}, {k: 'price', l: 'Price', f: v => nz(v) ? v.toLocaleString(undefined, {maximumFractionDigits: 2}) : '–'}, {k: 'pe', l: 'P/E', f: v => num(v, 1)}, {k: 'pb', l: 'P/B', f: v => num(v, 1)}, {k: 'div', l: 'Div yld', f: v => pct(v, 1, false)},
      {k: 'fcfy', l: 'FCF yld', f: v => pct(v, 1, false), c: cls}, {k: 'roe', l: 'ROE', f: v => pct(v, 0, false)}, {k: 'margin', l: 'Margin', f: v => pct(v, 0, false)}, {k: 'de', l: 'Debt/Eq', f: v => num(v)}, {k: 'dcf', l: 'DCF value', f: v => nz(v) ? v.toLocaleString(undefined, {maximumFractionDigits: 2}) : '–'}, {k: 'up', l: 'Upside', f: v => pct(v, 0), c: cls, s: v => nz(v) ? heatBg(v, .8) : ''}],
      S.map(t => { const f = D.fund[t], v = dcfv(f, g.g, g.tg, g.r); return {t, name: short(t), sector: f.sector, ccy: f.ccy, price: f.price, pe: f.pe, pb: f.pb, div: f.div, fcfy: f.fcfy, roe: f.roe, margin: f.margin, de: f.de, dcf: v, up: v != null && f.price ? v / f.price - 1 : null}; }),
      {row: t => selectTicker(t, false), k: 'up', h: 470});
    const t = ST.vsel, f = D.fund[t]; if (!f) { empty('sens', 'No stock with positive free cash flow in a matching currency.'); return; }
    const gs = Array.from({length: 9}, (_, i) => .02 + i * .02), rs = Array.from({length: 8}, (_, i) => .06 + i * .01);
    const z = rs.map(r => gs.map(gg => { const v = dcfv(f, gg, g.tg, r); return v == null ? null : v / f.price - 1; }));
    draw('sens', [{type: 'heatmap', z, x: gs.map(v => pct(v, 0, false)), y: rs.map(v => pct(v, 0, false)), zmin: -1, zmax: 1, colorscale: [[0, '#94384A'], [.5, '#16346F'], [1, '#6FF0A6']], text: z.map(r => r.map(v => v == null ? '' : (v > 0 ? '+' : '') + Math.round(v * 100) + '%')), texttemplate: '%{text}', textfont: {size: 10, family: MONO, color: '#fff'}, showscale: false, xgap: 2, ygap: 2, hovertemplate: 'growth %{x} · discount %{y}<br>upside %{text}<extra></extra>'}],
      {xaxis: ax({type: 'category', title: {text: '5-YEAR FCF GROWTH', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), yaxis: ax({type: 'category', autorange: 'reversed', title: {text: 'DISCOUNT RATE', font: {family: MONO, size: 9, color: '#8FA6D4'}}}), margin: {l: 52, r: 8, t: 8, b: 48}});
  }
};

/* =====================================================================  VIEW: BACKTEST  */
V.backtest = {
  html: () => `<div class="grid">
  ${panel('p-bs', 'c12', 'Do the trend rules beat buy-and-hold?', 'HISTORICAL TEST · COSTS INCLUDED', `Each rule holds the asset only while its signal is on (traded the <i>next</i> day, ${M.cost_bps} bp cost per trade) and earns the risk-free rate otherwise. Trend rules usually <b>do not beat buy-and-hold on return in a bull market</b>; their job is a <b>shallower drawdown</b> and a smoother ride. Compare the share of instruments that improved, not one lucky chart. Small sample, no optimisation, no taxes: evidence, not a promise.`,
    `<div class="ctl"><span class="sub">SHOW RULES</span><div class="seg" id="rseg"></div></div><div id="bsum"></div>`)}
  ${panel('p-bk', 'c6', 'Equal-weight stock basket', 'GROWTH OF 100 · LOG', 'Every stock follows the same rule and results are averaged: the fairest single picture of whether a rule adds value.', '<div id="bkc" class="plot" style="height:430px"></div>')}
  ${panel('p-as', 'c6', 'Selected instrument', '', '', '<div class="sub" id="asname"></div><div id="asc" class="plot" style="height:410px"></div>')}
  ${panel('p-bt', 'c6', 'Basket statistics', '', '', '<div id="bkt"></div>')}
  ${panel('p-at', 'c6', 'Instrument statistics', '', '', '<div id="ast"></div>')}
  </div>`,
  render() {
    const B = D.bt; if (!B) { empty('bsum', 'Backtest unavailable.'); return; }
    const rseg = document.getElementById('rseg'); rseg.innerHTML = B.rules.map(r => `<button data-v="${esc(r)}" class="${ST.rules.has(r) ? 'on' : ''}"><span class="d" style="background:${RULE_COL[r] || '#8FA6D4'}"></span>${esc(r)}</button>`).join('');
    rseg.onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.v === 'Buy & hold') return; ST.rules.has(b.dataset.v) ? ST.rules.delete(b.dataset.v) : ST.rules.add(b.dataset.v); V.backtest.render(); };
    const R = B.rules.filter(r => ST.rules.has(r)), sc = [{k: 'name', l: 'Rule', str: 1}, {k: 'cagr', l: 'CAGR', f: v => pct(v), c: cls}, {k: 'vol', l: 'Volatility', f: v => pct(v, 1, false)}, {k: 'sharpe', l: 'Sharpe', f: v => num(v)}, {k: 'mdd', l: 'Max DD', f: v => pct(v, 0), c: () => 'neg'}, {k: 'calmar', l: 'Calmar', f: v => num(v)}, {k: 'inv', l: 'Time invested', f: v => pct(v, 0, false)}, {k: 'trades', l: 'Trades/yr', f: v => num(v, 1)}];
    const rowsOf = o => R.map(r => ({t: r, name: r, ...o[r]}));
    table('bsum', sc.concat([{k: 'beat', l: '% beat B&H Sharpe', f: v => nz(v) ? pct(v, 0, false) : '–'}, {k: 'shallow', l: '% shallower DD', f: v => nz(v) ? pct(v, 0, false) : '–'}]), R.map(r => ({t: r, name: r, ...B.summary[r]})), {k: 'sharpe'});
    const eqChart = (id, eq, title) => {
      const tr = [], tx = D.dates;
      R.forEach(r => { const y = eq[r]; if (!y) return; const w = r === 'Buy & hold' ? 3 : 1.6; tr.push({x: tx, y, name: r, line: {color: RULE_COL[r], width: w}, hovertemplate: '%{y:.0f}<extra>' + esc(r) + '</extra>'}); });
      R.forEach(r => { const y = eq[r]; if (!y) return; tr.push({x: tx, y: ddOf(y), name: r, yaxis: 'y2', showlegend: false, line: {color: RULE_COL[r], width: r === 'Buy & hold' ? 2 : 1.1}, hovertemplate: '%{y:.0%}<extra>' + esc(r) + ' · drawdown</extra>'}); });
      draw(id, tr, {hovermode: 'x unified', legend: {orientation: 'h', y: -.1, font: {size: 10}}, yaxis: ax({type: 'log', domain: [.34, 1], dtick: 'D2', tickformat: ',d'}), yaxis2: ax({domain: [0, .26], tickformat: '.0%'}), margin: {l: 48, r: 10, t: 8, b: 30}, xaxis: ax({anchor: 'y2'})});
    };
    const small = sc.filter(c => c.k !== 'vol'); eqChart('bkc', B.basket.eq);
    const t = ST.sel; document.getElementById('asname').textContent = lab(t);
    if (B.eq[t]) { eqChart('asc', B.eq[t]); table('ast', small, rowsOf(B.asset[t]), {k: 'sharpe'}); } else { empty('asc', 'No backtest for this instrument (needs 200+ days of history).'); empty('ast', ''); }
    table('bkt', small, rowsOf(B.basket.stats), {k: 'sharpe'});
  }
};

/* =====================================================================  SHELL  */
const VIEWS = [
  {id: 'overview', l: 'WORLD', i: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'},
  {id: 'explorer', l: 'CHART', i: '<path d="M3 17l5-6 4 3 8-9"/><path d="M3 21h18"/>'},
  {id: 'signals', l: 'SIGNALS', i: '<path d="M3 12h4l3-7 4 14 3-7h4"/>'},
  {id: 'risk', l: 'RISK', i: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'},
  {id: 'cross', l: 'LINKS', i: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 7"/>'},
  {id: 'portfolio', l: 'MIX', i: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>'},
  {id: 'value', l: 'VALUE', i: '<path d="M12 4v16M6 20h12M5 8h14"/><path d="M5 8l-2 6a3 3 0 0 0 4 0zM19 8l-2 6a3 3 0 0 0 4 0z"/>'},
  {id: 'backtest', l: 'TEST', i: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>'}];
const rendered = {};
function renderView(id) { try { V[id].render(); } catch (e) { console.error(id, e); const el = document.getElementById('v-' + id); if (el) el.insertAdjacentHTML('afterbegin', `<div class="banner">Render error in ${id}: ${esc(e.message)}</div>`); } rendered[id] = true; }
function show(id) {
  if (id !== ST.view) ST.prev = ST.view;
  ST.view = id; VIEWS.forEach(v => document.getElementById('v-' + v.id).classList.toggle('on', v.id === id));
  const rv = VIEWS.filter(v => !v.top), k = rv.findIndex(v => v.id === id);       // 'top' views (MINE) live in the header, not on the rail
  [...document.querySelectorAll('.rail .st')].forEach((b, i) => { b.classList.toggle('on', i === k); b.classList.toggle('past', i < k); });
  const rail = document.getElementById('rail'), steps = rail.querySelectorAll('.st'), fill = rail.querySelector('.fill');
  if (fill) fill.style.height = steps[k] ? (steps[k].offsetTop + 20 - 26 + 6) + 'px' : '0px';
  renderView(id); try { history.replaceState(null, '', '#' + id); } catch (e) {}
  window.dispatchEvent(new CustomEvent('hl-view', {detail: id}));
  window.scrollTo({top: 0});
}
function renderFilters() {
  const regs = [...new Set(INST.map(i => i.region))];
  document.getElementById('filters').innerHTML = `<span class="lbl">TYPE</span>${seg('ftype', [{v: 'ALL', l: 'All'}, {v: 'Index', l: 'Indices'}, {v: 'Stock', l: 'Stocks'}, {v: 'Mine', l: 'My stocks'}].filter(o => o.v === 'ALL' || INST.some(i => i.type === o.v)), ST.type)}
    <span class="lbl">REGION</span>${seg('freg', [{v: 'ALL', l: 'All'}].concat(regs.map(r => ({v: r, l: r, d: REG[r] || REG.Other}))), ST.region)}<span class="sp" style="flex:1"></span><span class="chip o" id="selchip"></span><span class="tag">FILTERS APPLY TO WORLD · SIGNALS · RISK · LINKS</span>`;
  bindSeg('ftype', v => { ST.type = v; renderFilters(); Object.keys(rendered).forEach(k => rendered[k] = false); renderView(ST.view); });
  bindSeg('freg', v => { ST.region = v; renderFilters(); Object.keys(rendered).forEach(k => rendered[k] = false); renderView(ST.view); });
  updateChipSel();
}

function init() {
  document.getElementById('ttl').textContent = ({canada: 'CANADA MARKETS', custom: 'MY MARKETS', mega: 'MEGA 110', penny: 'PENNY STOCKS'}[M.universe] || 'GLOBAL MARKETS');
  document.getElementById('brandSub').textContent = 'MARKETS TERMINAL · ' + M.universe.toUpperCase();
  document.getElementById('status').innerHTML = `<span class="chip">SOURCE <b>${esc(M.source)}</b></span><span class="chip">AS OF <b>${esc(M.last)}</b></span><span class="chip o">CCY <b>${esc(M.currency)}</b></span><span class="chip v">BENCH <b>${esc(short(M.bench))}</b></span><span class="chip">RF <b>${pct(M.rf, 1, false)}</b></span><span class="chip g">${N.toLocaleString()} DAYS · ${INST.length} INSTRUMENTS</span>`;
  document.getElementById('disc').textContent = `Returns are in ${M.currency}; technical indicators and valuation ratios use local prices. Cross-market statistics use ${M.xfreq} returns. Prices are adjusted for splits and dividends. Free data may be delayed or wrong, and all figures describe the past. Illustrative analysis, not financial advice. Generated ${M.generated}.`;
  const tape = INST.map(i => { const v = (D.tr[i.t] || {})['1D']; return `<span><b>${esc(i.name)}</b><em class="${cls(v)}" style="font-style:normal">${nz(v) ? (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + pct(v, 2, false) : '–'}</em></span>`; }).join('');
  document.getElementById('tape').innerHTML = tape + tape;
  document.getElementById('tickers').innerHTML = INST.map(i => `<option value="${esc(i.name)} (${esc(i.t)})"></option>`).join('');
  const gs = document.getElementById('gsearch');
  gs.onchange = () => { const v = gs.value.trim().toLowerCase(), hit = INST.find(i => `${i.name} (${i.t})`.toLowerCase() === v || i.t.toLowerCase() === v || i.name.toLowerCase() === v) || INST.find(i => (i.name + i.t).toLowerCase().includes(v)); if (hit) { selectTicker(hit.t, true); gs.value = ''; gs.blur(); } else if (v && /^[a-z0-9.\-=]{1,15}$/i.test(v) && HL.addStock) { HL.addStock(gs.value.trim().toUpperCase()); gs.value = ''; gs.blur(); } };
  document.getElementById('rail').innerHTML = '<div class="track"></div><div class="fill"></div>' + VIEWS.filter(v => !v.top).map(v => `<button class="st" data-v="${v.id}" title="${v.l}"><span class="c"><svg viewBox="0 0 24 24">${v.i}</svg></span><b>${v.l}</b></button>`).join('');
  document.getElementById('rail').onclick = e => { const b = e.target.closest('.st'); if (b) show(b.dataset.v); };
  document.getElementById('views').innerHTML = VIEWS.map(v => `<div class="view" id="v-${v.id}">${V[v.id].html()}</div>`).join('');
  const sg = document.getElementById('sig'); if (sg) { sg.querySelector('img').src = document.querySelector('.brand img').src; sg.onclick = e => { e.preventDefault(); if (HL.about) HL.about(); }; }
  console.log('%cThe Half Layer · developed by Anish Luitel', 'color:#FF9E2C;font:600 12px monospace');
  const eb = document.getElementById('explainBtn'); let ex = true; try { ex = localStorage.getItem('hl-explain') !== '0'; } catch (e) {}
  const setEx = on => { document.body.classList.toggle('explain', on); eb.classList.toggle('on', on); try { localStorage.setItem('hl-explain', on ? '1' : '0'); } catch (e) {} }; setEx(ex);
  eb.onclick = () => { setEx(!document.body.classList.contains('explain')); window.dispatchEvent(new Event('resize')); };
  document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); gs.focus(); } else if (/^[1-9]$/.test(e.key) && document.activeElement.tagName !== 'INPUT') show(VIEWS[+e.key - 1].id); });
  renderFilters();
  const h = (location.hash || '').slice(1); show(VIEWS.some(v => v.id === h) ? h : 'overview');
  window.addEventListener('resize', () => { const v = document.getElementById('v-' + ST.view); v && v.querySelectorAll('.plot').forEach(p => { try { Plotly.Plots.resize(p); } catch (e) {} }); });
}
window.HL = {table, draw, ax, merge, onClick, heatBg, zBg, MONO, VIEWS, show, renderView, median, D, M, ST, INST, BY, IDX, STK, ALL, V, nz, esc, pct, num, cls, short, lab, rcol, last, visible, list, selectTicker, panel, seg, bindSeg, dots, pill, kvh, cardHtml, REG, PAL, start: init};
})();
