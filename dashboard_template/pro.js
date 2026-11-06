/* The Half Layer – chart workstation (TradingView-style).
   Engine: TradingView Lightweight Charts (Apache-2.0). Indicators, drawing tools, replay, templates: this project. */
(() => {
'use strict';
const HL = window.HL, LW = window.LightweightCharts;
if (!HL || !LW) return;
const {D, M, ST, BY, IDX, STK, ALL, nz, esc, pct, num, cls, short, lab, rcol, selectTicker, V, last, PAL} = HL;
const MONO = "'JetBrains Mono',ui-monospace,monospace";
const UP = '#6FF0A6', DN = '#FF6B7A', OR = '#FF9E2C', BL = '#6DB6FF', VI = '#B69CFF', CR = '#F6F0E2', TL = '#5EEAD4', GD = '#E0B472';
const $ = id => document.getElementById(id);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* =============================================================  A. INDICATOR LIBRARY  */
const NaNs = n => new Array(n).fill(NaN);
const fin = Number.isFinite;
const firstIdx = a => { for (let i = 0; i < a.length; i++) if (fin(a[i])) return i; return a.length; };
function sma(a, n) { const o = NaNs(a.length), f = firstIdx(a); let s = 0; for (let i = f; i < a.length; i++) { s += a[i]; if (i - f >= n) s -= a[i - n]; if (i - f >= n - 1) o[i] = s / n; } return o; }
function ema(a, n) { const o = NaNs(a.length), f = firstIdx(a), k = 2 / (n + 1); let p = 0; for (let i = f; i < a.length; i++) { if (i - f === n - 1) { let s = 0; for (let j = f; j <= i; j++) s += a[j]; p = s / n; o[i] = p; } else if (i - f > n - 1) { p = a[i] * k + p * (1 - k); o[i] = p; } } return o; }
function rma(a, n) { const o = NaNs(a.length), f = firstIdx(a); let p = 0; for (let i = f; i < a.length; i++) { if (i - f === n - 1) { let s = 0; for (let j = f; j <= i; j++) s += a[j]; p = s / n; o[i] = p; } else if (i - f > n - 1) { p = (p * (n - 1) + a[i]) / n; o[i] = p; } } return o; }
function wma(a, n) { const o = NaNs(a.length), den = n * (n + 1) / 2, f = firstIdx(a); for (let i = f + n - 1; i < a.length; i++) { let s = 0; for (let j = 0; j < n; j++) s += a[i - j] * (n - j); o[i] = s / den; } return o; }
function stdev(a, n) { const o = NaNs(a.length), f = firstIdx(a); for (let i = f + n - 1; i < a.length; i++) { let m = 0; for (let j = i - n + 1; j <= i; j++) m += a[j]; m /= n; let v = 0; for (let j = i - n + 1; j <= i; j++) v += (a[j] - m) ** 2; o[i] = Math.sqrt(v / n); } return o; }
function highest(a, n) { const o = NaNs(a.length); for (let i = n - 1; i < a.length; i++) { let m = -Infinity; for (let j = i - n + 1; j <= i; j++) if (a[j] > m) m = a[j]; o[i] = m; } return o; }
function lowest(a, n) { const o = NaNs(a.length); for (let i = n - 1; i < a.length; i++) { let m = Infinity; for (let j = i - n + 1; j <= i; j++) if (a[j] < m) m = a[j]; o[i] = m; } return o; }
function trueRange(h, l, c) { return h.map((x, i) => i === 0 ? x - l[i] : Math.max(x - l[i], Math.abs(x - c[i - 1]), Math.abs(l[i] - c[i - 1]))); }
const atr = (h, l, c, n) => rma(trueRange(h, l, c), n);
function rsi(c, n) {
  const up = NaNs(c.length), dn = NaNs(c.length);
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; up[i] = Math.max(d, 0); dn[i] = Math.max(-d, 0); }
  const au = rma(up, n), ad = rma(dn, n);
  return au.map((x, i) => fin(x) && fin(ad[i]) ? (ad[i] === 0 ? 100 : 100 - 100 / (1 + x / ad[i])) : NaN);
}
function macd(c, f, s, g) { const e1 = ema(c, f), e2 = ema(c, s), line = e1.map((x, i) => x - e2[i]), sig = ema(line, g); return {line, sig, hist: line.map((x, i) => x - sig[i])}; }
function stoch(h, l, c, k, d, sm) { const hh = highest(h, k), ll = lowest(l, k), raw = c.map((x, i) => hh[i] === ll[i] ? NaN : 100 * (x - ll[i]) / (hh[i] - ll[i])); const K = sma(raw, sm), D2 = sma(K, d); return {K, D: D2}; }
function stochRsi(c, rl, sl, ks, ds) { const r = rsi(c, rl), hh = highest(r.map(x => fin(x) ? x : -Infinity), sl), ll = lowest(r.map(x => fin(x) ? x : Infinity), sl); const raw = r.map((x, i) => fin(x) && fin(hh[i]) && fin(ll[i]) && hh[i] !== ll[i] ? 100 * (x - ll[i]) / (hh[i] - ll[i]) : NaN); const K = sma(raw, ks); return {K, D: sma(K, ds)}; }
function cci(h, l, c, n) { const tp = c.map((x, i) => (h[i] + l[i] + x) / 3), m = sma(tp, n); return tp.map((x, i) => { if (!fin(m[i])) return NaN; let d = 0; for (let j = i - n + 1; j <= i; j++) d += Math.abs(tp[j] - m[i]); d /= n; return d === 0 ? 0 : (x - m[i]) / (0.015 * d); }); }
function willr(h, l, c, n) { const hh = highest(h, n), ll = lowest(l, n); return c.map((x, i) => fin(hh[i]) && hh[i] !== ll[i] ? -100 * (hh[i] - x) / (hh[i] - ll[i]) : NaN); }
function roc(c, n) { return c.map((x, i) => i >= n && c[i - n] ? 100 * (x / c[i - n] - 1) : NaN); }
function obv(c, v) { const o = NaNs(c.length); let s = 0; o[0] = 0; for (let i = 1; i < c.length; i++) { s += c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0; o[i] = s; } return o; }
function mfi(h, l, c, v, n) { const tp = c.map((x, i) => (h[i] + l[i] + x) / 3), o = NaNs(c.length); for (let i = n; i < c.length; i++) { let p = 0, q = 0; for (let j = i - n + 1; j <= i; j++) { const f = tp[j] * v[j]; if (tp[j] > tp[j - 1]) p += f; else if (tp[j] < tp[j - 1]) q += f; } o[i] = q === 0 ? 100 : 100 - 100 / (1 + p / q); } return o; }
function adx(h, l, c, n) {
  const N = c.length, pd = NaNs(N), md = NaNs(N), tr = trueRange(h, l, c); tr[0] = NaN;
  for (let i = 1; i < N; i++) { const u = h[i] - h[i - 1], d = l[i - 1] - l[i]; pd[i] = u > d && u > 0 ? u : 0; md[i] = d > u && d > 0 ? d : 0; }
  const a = rma(tr, n), pdi = rma(pd, n).map((x, i) => 100 * x / a[i]), mdi = rma(md, n).map((x, i) => 100 * x / a[i]);
  const dx = pdi.map((x, i) => 100 * Math.abs(x - mdi[i]) / (x + mdi[i]));
  return {adx: rma(dx, n), pdi, mdi};
}
function aroon(h, l, n) { const up = NaNs(h.length), dn = NaNs(h.length); for (let i = n; i < h.length; i++) { let hi = i - n, lo = i - n; for (let j = i - n; j <= i; j++) { if (h[j] >= h[hi]) hi = j; if (l[j] <= l[lo]) lo = j; } up[i] = 100 * (n - (i - hi)) / n; dn[i] = 100 * (n - (i - lo)) / n; } return {up, dn}; }
function histVol(c, n) { const r = c.map((x, i) => i ? Math.log(x / c[i - 1]) : NaN); return stdev(r, n).map(x => x * Math.sqrt(252) * 100); }
function bollinger(c, n, k) { const m = sma(c, n), s = stdev(c, n); return {mid: m, up: m.map((x, i) => x + k * s[i]), lo: m.map((x, i) => x - k * s[i])}; }
function keltner(h, l, c, n, an, mult) { const m = ema(c, n), a = atr(h, l, c, an); return {mid: m, up: m.map((x, i) => x + mult * a[i]), lo: m.map((x, i) => x - mult * a[i])}; }
function donchian(h, l, n) { const u = highest(h, n), d = lowest(l, n); return {up: u, lo: d, mid: u.map((x, i) => (x + d[i]) / 2)}; }
function supertrend(h, l, c, n, m) {
  const a = atr(h, l, c, n), N = c.length, up = NaNs(N), dn = NaNs(N); let fu = NaN, fl = NaN, dir = 1;
  for (let i = 0; i < N; i++) {
    if (!fin(a[i])) continue;
    const mid = (h[i] + l[i]) / 2, bu = mid + m * a[i], bl = mid - m * a[i], pfu = fu, pfl = fl;
    fu = (!fin(pfu) || bu < pfu || c[i - 1] > pfu) ? bu : pfu; fl = (!fin(pfl) || bl > pfl || c[i - 1] < pfl) ? bl : pfl;
    if (fin(pfu)) { if (dir === 1 && c[i] < fl) dir = -1; else if (dir === -1 && c[i] > fu) dir = 1; }
    if (dir === 1) up[i] = fl; else dn[i] = fu;
  }
  return {up, dn};
}
function psar(h, l, st, inc, mx) {
  const N = h.length, o = NaNs(N); let bull = true, af = st, ep = h[0], sar = l[0]; o[0] = sar;
  for (let i = 1; i < N; i++) {
    sar = sar + af * (ep - sar);
    if (bull) { sar = Math.min(sar, l[i - 1], i > 1 ? l[i - 2] : l[i - 1]); if (l[i] < sar) { bull = false; sar = ep; ep = l[i]; af = st; } else if (h[i] > ep) { ep = h[i]; af = Math.min(af + inc, mx); } }
    else { sar = Math.max(sar, h[i - 1], i > 1 ? h[i - 2] : h[i - 1]); if (h[i] > sar) { bull = true; sar = ep; ep = h[i]; af = st; } else if (l[i] < ep) { ep = l[i]; af = Math.min(af + inc, mx); } }
    o[i] = sar;
  }
  return o;
}
function ichimoku(h, l, c, t, k, s, d) {
  const mid = n => { const a = highest(h, n), b = lowest(l, n); return a.map((x, i) => (x + b[i]) / 2); };
  const tn = mid(t), kj = mid(k), sa = tn.map((x, i) => (x + kj[i]) / 2), sb = mid(s);
  return {tn, kj, sa, sb, ch: c.slice()};
}
HL.ind = {sma, ema, rma, wma, stdev, rsi, macd, stoch, stochRsi, atr, cci, willr, roc, obv, mfi, adx, aroon, bollinger, keltner, donchian, supertrend, psar, ichimoku, histVol};

/* ---- registry: how every indicator is built, shown and configured ---- */
const P = (k, l, v, min, max, step) => ({k, l, v, min: min == null ? 1 : min, max: max || 1000, step: step || 1});
const MAPAL = [OR, BL, VI, UP, DN, CR, TL, GD];
const REG = {
  sma: {n: 'Simple Moving Average', g: 'Moving averages', kind: 'overlay', p: [P('len', 'Length', 50)], cols: [OR], lab: p => `SMA ${p.len}`, fn: (B, p) => ({lines: [{d: sma(B.c, p.len)}]})},
  ema: {n: 'Exponential Moving Average', g: 'Moving averages', kind: 'overlay', p: [P('len', 'Length', 20)], cols: [BL], lab: p => `EMA ${p.len}`, fn: (B, p) => ({lines: [{d: ema(B.c, p.len)}]})},
  wma: {n: 'Weighted Moving Average', g: 'Moving averages', kind: 'overlay', p: [P('len', 'Length', 20)], cols: [VI], lab: p => `WMA ${p.len}`, fn: (B, p) => ({lines: [{d: wma(B.c, p.len)}]})},
  ichi: {n: 'Ichimoku Cloud', g: 'Trend', kind: 'overlay', p: [P('t', 'Conversion', 9), P('k', 'Base', 26), P('s', 'Span B', 52), P('d', 'Displacement', 26)], cols: [BL, '#FF6B7A', '#8FA6D4', UP, DN], lab: p => `Ichimoku ${p.t},${p.k},${p.s},${p.d}`,
    fn: (B, p) => { const r = ichimoku(B.h, B.l, B.c, p.t, p.k, p.s, p.d); return {off: p.d, lines: [{n: 'Conversion', d: r.tn}, {n: 'Base', d: r.kj}, {n: 'Lagging', d: r.ch, off: -p.d, w: 1}, {n: 'Span A', d: r.sa, off: p.d, w: 1}, {n: 'Span B', d: r.sb, off: p.d, w: 1}], cloud: {a: 3, b: 4}}; }},
  st: {n: 'Supertrend', g: 'Trend', kind: 'overlay', p: [P('len', 'ATR length', 10), P('mult', 'Factor', 3, .5, 20, .5)], cols: [UP, DN], lab: p => `Supertrend ${p.len},${p.mult}`, fn: (B, p) => { const r = supertrend(B.h, B.l, B.c, p.len, p.mult); return {lines: [{n: 'Up', d: r.up, w: 2}, {n: 'Down', d: r.dn, w: 2}]}; }},
  sar: {n: 'Parabolic SAR', g: 'Trend', kind: 'overlay', p: [P('st', 'Start', .02, .001, 1, .001), P('inc', 'Increment', .02, .001, 1, .001), P('mx', 'Maximum', .2, .01, 1, .01)], cols: [VI], lab: p => `SAR ${p.st},${p.inc},${p.mx}`, fn: (B, p) => ({lines: [{d: psar(B.h, B.l, p.st, p.inc, p.mx), dots: true}]})},
  bb: {n: 'Bollinger Bands', g: 'Volatility', kind: 'overlay', p: [P('len', 'Length', 20), P('mult', 'StdDev', 2, .1, 10, .1)], cols: [BL, OR, BL], lab: p => `BB ${p.len},${p.mult}`,
    fn: (B, p) => { const r = bollinger(B.c, p.len, p.mult); return {lines: [{n: 'Upper', d: r.up, w: 1}, {n: 'Basis', d: r.mid, w: 1, dash: true}, {n: 'Lower', d: r.lo, w: 1}], fills: [{a: 0, b: 2, c: 'rgba(109,182,255,.10)'}]}; }},
  kc: {n: 'Keltner Channels', g: 'Volatility', kind: 'overlay', p: [P('len', 'EMA length', 20), P('an', 'ATR length', 10), P('mult', 'Multiplier', 1.5, .1, 10, .1)], cols: [VI, VI, VI], lab: p => `KC ${p.len},${p.an},${p.mult}`,
    fn: (B, p) => { const r = keltner(B.h, B.l, B.c, p.len, p.an, p.mult); return {lines: [{n: 'Upper', d: r.up, w: 1}, {n: 'Basis', d: r.mid, w: 1, dash: true}, {n: 'Lower', d: r.lo, w: 1}], fills: [{a: 0, b: 2, c: 'rgba(182,156,255,.09)'}]}; }},
  dc: {n: 'Donchian Channels', g: 'Volatility', kind: 'overlay', p: [P('len', 'Length', 20)], cols: [TL, TL, TL], lab: p => `Donchian ${p.len}`,
    fn: (B, p) => { const r = donchian(B.h, B.l, p.len); return {lines: [{n: 'Upper', d: r.up, w: 1}, {n: 'Middle', d: r.mid, w: 1, dash: true}, {n: 'Lower', d: r.lo, w: 1}], fills: [{a: 0, b: 2, c: 'rgba(94,234,212,.07)'}]}; }},
  rsi: {n: 'Relative Strength Index', g: 'Momentum', kind: 'pane', p: [P('len', 'Length', 14)], cols: [VI], lab: p => `RSI ${p.len}`, rng: [0, 100], levels: [70, 50, 30],
    fn: (B, p) => ({lines: [{n: 'RSI', d: rsi(B.c, p.len)}]})},
  macd: {n: 'MACD', g: 'Momentum', kind: 'pane', p: [P('f', 'Fast', 12), P('s', 'Slow', 26), P('g', 'Signal', 9)], cols: [BL, OR, UP], lab: p => `MACD ${p.f},${p.s},${p.g}`, levels: [0],
    fn: (B, p) => { const r = macd(B.c, p.f, p.s, p.g); return {lines: [{n: 'Histogram', d: r.hist, hist: true, cf: i => r.hist[i] >= 0 ? (r.hist[i] >= (r.hist[i - 1] || 0) ? 'rgba(111,240,166,.85)' : 'rgba(111,240,166,.4)') : (r.hist[i] <= (r.hist[i - 1] || 0) ? 'rgba(255,107,122,.85)' : 'rgba(255,107,122,.4)')}, {n: 'MACD', d: r.line}, {n: 'Signal', d: r.sig}]}; }},
  stoch: {n: 'Stochastic', g: 'Momentum', kind: 'pane', p: [P('k', '%K length', 14), P('d', '%D smoothing', 3), P('sm', 'Smooth K', 3)], cols: [BL, OR], lab: p => `Stoch ${p.k},${p.d},${p.sm}`, rng: [0, 100], levels: [80, 20],
    fn: (B, p) => { const r = stoch(B.h, B.l, B.c, p.k, p.d, p.sm); return {lines: [{n: '%K', d: r.K}, {n: '%D', d: r.D}]}; }},
  srsi: {n: 'Stochastic RSI', g: 'Momentum', kind: 'pane', p: [P('r', 'RSI length', 14), P('s', 'Stoch length', 14), P('k', 'K', 3), P('d', 'D', 3)], cols: [BL, OR], lab: p => `StochRSI ${p.r},${p.s},${p.k},${p.d}`, rng: [0, 100], levels: [80, 20],
    fn: (B, p) => { const r = stochRsi(B.c, p.r, p.s, p.k, p.d); return {lines: [{n: '%K', d: r.K}, {n: '%D', d: r.D}]}; }},
  cci: {n: 'Commodity Channel Index', g: 'Momentum', kind: 'pane', p: [P('len', 'Length', 20)], cols: [TL], lab: p => `CCI ${p.len}`, levels: [100, 0, -100], fn: (B, p) => ({lines: [{n: 'CCI', d: cci(B.h, B.l, B.c, p.len)}]})},
  wr: {n: 'Williams %R', g: 'Momentum', kind: 'pane', p: [P('len', 'Length', 14)], cols: [GD], lab: p => `%R ${p.len}`, rng: [-100, 0], levels: [-20, -80], fn: (B, p) => ({lines: [{n: '%R', d: willr(B.h, B.l, B.c, p.len)}]})},
  roc: {n: 'Rate of Change', g: 'Momentum', kind: 'pane', p: [P('len', 'Length', 12)], cols: [OR], lab: p => `ROC ${p.len}`, levels: [0], fn: (B, p) => ({lines: [{n: 'ROC', d: roc(B.c, p.len)}]})},
  adx: {n: 'ADX / Directional Movement', g: 'Trend', kind: 'pane', p: [P('len', 'Length', 14)], cols: [CR, UP, DN], lab: p => `ADX ${p.len}`, levels: [25], rng: [0, 100],
    fn: (B, p) => { const r = adx(B.h, B.l, B.c, p.len); return {lines: [{n: 'ADX', d: r.adx, w: 2}, {n: '+DI', d: r.pdi}, {n: '-DI', d: r.mdi}]}; }},
  aroon: {n: 'Aroon', g: 'Trend', kind: 'pane', p: [P('len', 'Length', 25)], cols: [UP, DN], lab: p => `Aroon ${p.len}`, rng: [0, 100], levels: [70, 30],
    fn: (B, p) => { const r = aroon(B.h, B.l, p.len); return {lines: [{n: 'Up', d: r.up}, {n: 'Down', d: r.dn}]}; }},
  atr: {n: 'Average True Range', g: 'Volatility', kind: 'pane', p: [P('len', 'Length', 14)], cols: [OR], lab: p => `ATR ${p.len}`, fn: (B, p) => ({lines: [{n: 'ATR', d: atr(B.h, B.l, B.c, p.len)}]})},
  hv: {n: 'Historical Volatility', g: 'Volatility', kind: 'pane', p: [P('len', 'Length', 20)], cols: [VI], lab: p => `HV ${p.len}`, fn: (B, p) => ({lines: [{n: 'HV %', d: histVol(B.c, p.len)}]})},
  vpvr: {n: 'Volume Profile (Visible Range)', g: 'Volume', kind: 'vp', p: [P('rows', 'Rows', 70, 10, 300), P('va', 'Value area %', 70, 10, 100), P('w', 'Width % of chart', 28, 5, 80), P('side', 'Side (1 = right, 0 = left)', 1, 0, 1)], cols: [BL, OR, DN], lab: p => `VPVR ${p.rows} rows · VA ${p.va}%`},
  vol: {n: 'Volume', g: 'Volume', kind: 'volume', p: [P('ma', 'MA length', 20)], cols: [OR], lab: p => `Volume ${p.ma}`},
  obv: {n: 'On Balance Volume', g: 'Volume', kind: 'pane', p: [], cols: [BL], lab: () => 'OBV', fn: B => ({lines: [{n: 'OBV', d: obv(B.c, B.v)}]})},
  mfi: {n: 'Money Flow Index', g: 'Volume', kind: 'pane', p: [P('len', 'Length', 14)], cols: [TL], lab: p => `MFI ${p.len}`, rng: [0, 100], levels: [80, 20], fn: (B, p) => ({lines: [{n: 'MFI', d: mfi(B.h, B.l, B.c, B.v, p.len)}]})}
};
HL.indReg = REG;
const TEMPLATES = {
  'Clean (price + volume)': [['vol']],
  'Trend following': [['vol'], ['ema', {len: 20}], ['sma', {len: 50}], ['sma', {len: 200}], ['macd'], ['adx']],
  'Mean reversion': [['vol'], ['bb'], ['rsi'], ['stoch']],
  'Volatility breakout': [['vol'], ['kc'], ['bb', {len: 20, mult: 2}], ['atr']],
  'Ichimoku set-up': [['vol'], ['ichi'], ['rsi']],
  'Momentum lab': [['vol'], ['ema', {len: 50}], ['rsi'], ['macd'], ['srsi'], ['roc']]
};

/* ---- extra maths for the technical rating (TradingView-style vote of oscillators + moving averages) ---- */
const sumN = (a, n) => { const o = NaNs(a.length); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1 && fin(s)) o[i] = s; } return o; };
function hma(c, n) { const h = Math.max(1, n >> 1), w1 = wma(c, h), w2 = wma(c, n), raw = w1.map((x, i) => 2 * x - w2[i]); return wma(raw, Math.max(1, Math.round(Math.sqrt(n)))); }
function vwma(c, v, n) { const a = sumN(c.map((x, i) => x * v[i]), n), b = sumN(v, n); return a.map((x, i) => b[i] > 0 ? x / b[i] : NaN); }
function ultimateOsc(h, l, c, a, b, d) {
  const bp = c.map((x, i) => i ? x - Math.min(l[i], c[i - 1]) : NaN).slice(1), tr = c.map((x, i) => i ? Math.max(h[i], c[i - 1]) - Math.min(l[i], c[i - 1]) : NaN).slice(1);
  const f = n => { const s1 = sumN(bp, n), s2 = sumN(tr, n); return [NaN].concat(s1.map((x, i) => x / s2[i])); };
  const A = f(a), B = f(b), C = f(d); return A.map((x, i) => 100 * (4 * x + 2 * B[i] + C[i]) / 7);
}
const VERD = ['Strong sell', 'Sell', 'Neutral', 'Buy', 'Strong buy'];
const verdictIdx = v => v < -0.5 ? 0 : v < -0.1 ? 1 : v <= 0.1 ? 2 : v <= 0.5 ? 3 : 4;
function computeTech(B) {
  const n = B.c.length; if (n < 40) return null;
  const i = n - 1, c = B.c, h = B.h, l = B.l, v = B.v, px = c[i], osc = [], mas = [];
  const act = (buy, sell) => buy ? 'Buy' : sell ? 'Sell' : 'Neutral';
  const push = (arr, name, val, a) => arr.push({n: name, v: val, a: fin(val) ? a : 'n/a'});
  const r = rsi(c, 14); push(osc, 'Relative Strength Index (14)', r[i], act(r[i] < 30 && r[i] > r[i - 1], r[i] > 70 && r[i] < r[i - 1]));
  const st = stoch(h, l, c, 14, 3, 3); push(osc, 'Stochastic %K (14, 3, 3)', st.K[i], act(st.K[i] < 20 && st.D[i] < 20 && st.K[i] > st.D[i], st.K[i] > 80 && st.D[i] > 80 && st.K[i] < st.D[i]));
  const cc = cci(h, l, c, 20); push(osc, 'Commodity Channel Index (20)', cc[i], act(cc[i] < -100 && cc[i] > cc[i - 1], cc[i] > 100 && cc[i] < cc[i - 1]));
  const ad = adx(h, l, c, 14); push(osc, 'Average Directional Index (14)', ad.adx[i], act(ad.adx[i] > 20 && ad.pdi[i] > ad.mdi[i] && ad.pdi[i - 1] <= ad.mdi[i - 1], ad.adx[i] > 20 && ad.pdi[i] < ad.mdi[i] && ad.pdi[i - 1] >= ad.mdi[i - 1]));
  const md = h.map((x, k) => (x + l[k]) / 2), s34 = sma(md, 34), ao = sma(md, 5).map((x, k) => x - s34[k]); push(osc, 'Awesome Oscillator', ao[i], act(ao[i] > 0 && ao[i] > ao[i - 1], ao[i] < 0 && ao[i] < ao[i - 1]));
  const mo = c.map((x, k) => k >= 10 ? x - c[k - 10] : NaN); push(osc, 'Momentum (10)', mo[i], act(mo[i] > mo[i - 1], mo[i] < mo[i - 1]));
  const mc = macd(c, 12, 26, 9); push(osc, 'MACD Level (12, 26)', mc.line[i], act(mc.line[i] > mc.sig[i], mc.line[i] < mc.sig[i]));
  const sr = stochRsi(c, 14, 14, 3, 3); push(osc, 'Stochastic RSI Fast (3, 3, 14, 14)', sr.K[i], act(sr.K[i] < 20 && sr.D[i] < 20 && sr.K[i] > sr.D[i], sr.K[i] > 80 && sr.D[i] > 80 && sr.K[i] < sr.D[i]));
  const wr = willr(h, l, c, 14); push(osc, 'Williams Percent Range (14)', wr[i], act(wr[i] < -80 && wr[i] > wr[i - 1], wr[i] > -20 && wr[i] < wr[i - 1]));
  const e13 = ema(c, 13), bull = h[i] - e13[i], bear = l[i] - e13[i], pbull = h[i - 1] - e13[i - 1], pbear = l[i - 1] - e13[i - 1];
  push(osc, 'Bull Bear Power', bull + bear, act(e13[i] > e13[i - 1] && bear < 0 && bear > pbear, e13[i] < e13[i - 1] && bull > 0 && bull < pbull));
  const uo = ultimateOsc(h, l, c, 7, 14, 28); push(osc, 'Ultimate Oscillator (7, 14, 28)', uo[i], act(uo[i] > 70, uo[i] < 30));
  [10, 20, 30, 50, 100, 200].forEach(p => { const e = ema(c, p)[i], s = sma(c, p)[i]; push(mas, `Exponential Moving Average (${p})`, e, act(e < px, e > px)); push(mas, `Simple Moving Average (${p})`, s, act(s < px, s > px)); });
  const kj = (highest(h, 26)[i] + lowest(l, 26)[i]) / 2; push(mas, 'Ichimoku Base Line (9, 26, 52, 26)', kj, act(kj < px, kj > px));
  const vw = v.some(x => x > 0) ? vwma(c, v, 20)[i] : NaN; push(mas, 'Volume Weighted Moving Average (20)', vw, act(vw < px, vw > px));
  const hm = hma(c, 9)[i]; push(mas, 'Hull Moving Average (9)', hm, act(hm < px, hm > px));
  const sc = arr => { const u = arr.filter(x => x.a !== 'n/a'), b = u.filter(x => x.a === 'Buy').length, s = u.filter(x => x.a === 'Sell').length; return {n: u.length, buy: b, sell: s, neu: u.length - b - s, score: u.length ? (b - s) / u.length : 0}; };
  return {osc, mas, so: sc(osc), sm: sc(mas), all: sc(osc.concat(mas)), px};
}
function pivotSets(b) {
  const H = b.high, L = b.low, C = b.close, P = (H + L + C) / 3, R = H - L, Pw = (H + L + 2 * C) / 4;
  return {
    Classic: {S3: L - 2 * (H - P), S2: P - R, S1: 2 * P - H, P, R1: 2 * P - L, R2: P + R, R3: H + 2 * (P - L)},
    Fibonacci: {S3: P - R, S2: P - .618 * R, S1: P - .382 * R, P, R1: P + .382 * R, R2: P + .618 * R, R3: P + R},
    Camarilla: {S3: C - R * 1.1 / 4, S2: C - R * 1.1 / 6, S1: C - R * 1.1 / 12, P, R1: C + R * 1.1 / 12, R2: C + R * 1.1 / 6, R3: C + R * 1.1 / 4},
    Woodie: {S3: L - 2 * (H - Pw), S2: Pw - R, S1: 2 * Pw - H, P: Pw, R1: 2 * Pw - L, R2: Pw + R, R3: H + 2 * (Pw - L)}
  };
}
const _ratingCache = {};
HL.techRating = t => { if (_ratingCache[t]) return _ratingCache[t]; const b = getBars(t, 'D'), T = computeTech(toArrays(b)); return _ratingCache[t] = T ? {score: T.all.score, idx: verdictIdx(T.all.score), label: VERD[verdictIdx(T.all.score)]} : {score: null, idx: 2, label: 'n/a'}; };

/* =============================================================  B. STATE + DATA  */
const DEFAULT_INDS = [['vol'], ['sma', {len: 50}], ['sma', {len: 200}], ['rsi']];
let UID = 1;
const mkInd = (key, params, i) => { const r = REG[key], p = {}; r.p.forEach(x => p[x.k] = x.v); Object.assign(p, params || {}); const same = (S && S.inds ? S.inds.filter(z => z.key === key).length : 0);
  return {id: 'i' + (UID++), key, p, vis: true, colors: r.cols.map((c, j) => (r.kind === 'overlay' && r.cols.length === 1 && same) ? MAPAL[(same + MAPAL.indexOf(c) + 1) % MAPAL.length] : c)}; };
const saved = lsGet('hl-ws-v2', {});
const S = {tf: saved.tf || 'D', type: saved.type || 'candles', tool: 'cursor', magnet: false, lock: false, hide: false, scale: 'auto', autoscale: true, cmp: [], inds: [], tab: 'tech', sel: null, showTargets: false, techMore: false, sound: lsGet('hl-sound', true)};
S.inds = (saved.inds || DEFAULT_INDS.map(a => ({key: a[0], p: a[1]}))).filter(x => REG[x.key]).map(x => { const o = mkInd(x.key, x.p); if (x.colors) o.colors = x.colors; if (x.vis === false) o.vis = false; return o; });
(function recolor() { const seen = {}; S.inds.forEach((i, n) => { const r = REG[i.key]; seen[i.key] = (seen[i.key] || 0) + 1; if (r.kind === 'overlay' && r.cols.length === 1 && seen[i.key] > 1 && !(saved.inds && saved.inds[n] && saved.inds[n].colors)) i.colors = [MAPAL[(MAPAL.indexOf(r.cols[0]) + seen[i.key] - 1) % MAPAL.length]]; }); })();
const R = {on: false, idx: 0, playing: false, speed: 1, picking: false, timer: null};
const RT = {bars: [], view: [], B: null, times: [], future: [], timeIdx: new Map(), step: 86400, ticker: null, dver: 0, aver: 0};
let chart = null, main = null, volSeries = null, volMA = null, cmpSeries = [], dirty = true, built = false, OWN = [];
const add = (def, opts, pane) => { const s = chart.addSeries(def, opts, pane); OWN.push(s); return s; };

const TSEC = D.dates.map(s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000);
const barsCache = {};
function dailyBars(t) {
  const o = D.ohlc[t], out = []; if (!o) return out;
  for (let i = 0; i < TSEC.length; i++) { const c = o.c[i]; if (c == null) continue; out.push({time: TSEC[i], open: o.o[i] == null ? c : o.o[i], high: o.h[i] == null ? c : o.h[i], low: o.l[i] == null ? c : o.l[i], close: c, volume: o.v[i] || 0}); }
  return out;
}
function resample(b, tf) {
  if (tf === 'D') return b;
  const out = []; let cur = null, key = null;
  for (const x of b) {
    const d = new Date(x.time * 1000), k = tf === 'W' ? Math.floor(x.time / 86400 / 7 + 3 / 7) : d.getUTCFullYear() * 12 + d.getUTCMonth();
    if (k !== key) { cur = {time: x.time, open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume}; out.push(cur); key = k; }
    else { cur.high = Math.max(cur.high, x.high); cur.low = Math.min(cur.low, x.low); cur.close = x.close; cur.volume += x.volume; }
  }
  return out;
}
const INTRA_TF = {'1m': 60, '5m': 300, '15m': 900, '1h': 3600}, isIntra = tf => tf in INTRA_TF, INTRA = {};     // intraday bars come from the local server and are cached for a few seconds
const getBars = (t, tf) => isIntra(tf) ? ((INTRA[t + '|' + tf] || {}).bars || []) : (barsCache[t + tf] || (barsCache[t + tf] = resample(dailyBars(t), tf)));
const TFN = {D: ['1D', '1 day', 'day'], W: ['1W', '1 week', 'week'], M: ['1M', '1 month', 'month'], '1m': ['1m', '1 minute', 'bar'], '5m': ['5m', '5 minutes', 'bar'], '15m': ['15m', '15 minutes', 'bar'], '1h': ['1h', '1 hour', 'bar']};
const aheadBars = () => ({D: 252, W: 52, M: 12})[S.tf] || 0, defZoom = () => ({D: 260, W: 180, M: 100})[S.tf] || 170;
async function fetchIntra(t, tf, force) {
  const k = t + '|' + tf, c = INTRA[k]; if (!force && c && Date.now() - c.at < 20000) return c.bars;
  if (!HL.live) throw new Error('local server module missing'); if (!HL.live.ok) await HL.live.probe(); if (!HL.live.ok) throw new Error('the local server is not running');
  const bars = await HL.live.intraday(t, tf); INTRA[k] = {bars, at: Date.now()}; return bars;
}
function heikin(b) { const o = []; let po = null, pc = null; for (const x of b) { const c = (x.open + x.high + x.low + x.close) / 4, op = po == null ? (x.open + x.close) / 2 : (po + pc) / 2; o.push({time: x.time, open: op, high: Math.max(x.high, op, c), low: Math.min(x.low, op, c), close: c}); po = op; pc = c; } return o; }
const toArrays = b => ({t: b.map(x => x.time), o: b.map(x => x.open), h: b.map(x => x.high), l: b.map(x => x.low), c: b.map(x => x.close), v: b.map(x => x.volume)});
function futureTimes(n) {
  const out = []; let t = RT.times[RT.times.length - 1]; if (t == null) return out;
  for (let i = 0; i < n; i++) { if (isIntra(S.tf)) t += INTRA_TF[S.tf]; else if (S.tf === 'D') { do { t += 86400; } while ([0, 6].includes(new Date(t * 1000).getUTCDay())); } else if (S.tf === 'W') t += 7 * 86400; else { const d = new Date(t * 1000); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; } out.push(t); }
  return out;
}
function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 86400; }
const fmtP = v => { if (!fin(v)) return '–'; const d = (Math.abs(v) >= 1 || v === 0) ? 2 : 4; return v.toLocaleString(undefined, {minimumFractionDigits: d, maximumFractionDigits: d}); };
const fmtV = v => !fin(v) ? '–' : v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v));
const ic = {
  cursor: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="1.4"/>', trend: '<path d="M4 19L20 5"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="5" r="2"/>',
  ray: '<path d="M4 18L21 7"/><circle cx="4" cy="18" r="2"/><path d="M16 5l5 2-2 5"/>', hline: '<path d="M3 12h18"/><circle cx="12" cy="12" r="2"/>', vline: '<path d="M12 3v18"/><circle cx="12" cy="12" r="2"/>',
  rect: '<rect x="5" y="7" width="14" height="10" rx="1"/>', fib: '<path d="M4 5h16M4 10h16M4 15h16M4 20h16"/><path d="M6 5l12 15" stroke-dasharray="2 2"/>', measure: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
  text: '<path d="M5 6h14M12 6v13M9 19h6"/>', magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.5 7.5A17 17 0 0 0 2 12s4 7 10 7a9.700 9.700 0 0 0 4-.9"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>', play: '<path d="M7 4l13 8-13 8z"/>', pause: '<path d="M8 4v16M16 4v16"/>',
  step: '<path d="M6 4l10 8-10 8zM19 4v16"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M19.100 4.900L17 7M7 17l-2.100 2.100"/>',
  bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>', alert: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>', vpfix: '<path d="M4 5h9M4 9h14M4 13h7M4 17h12"/><path d="M3 3v18" stroke-dasharray="2 2"/>',
  fx: '<path d="M4 18c3 0 3-12 6-12M3 11h8M13 10l6 8M19 10l-6 8"/>', plus: '<path d="M12 5v14M5 12h14"/>', replay: '<path d="M4 5v14M20 5L8 12l12 7z"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'
};
const svg = (n, sz) => `<svg viewBox="0 0 24 24" ${sz ? `width="${sz}" height="${sz}"` : ''}>${ic[n] || ''}</svg>`;

/* =============================================================  C. DOM SKELETON  */
const TOOLS = [['cursor', 'Cross cursor'], ['trend', 'Trend line  (Alt+T)'], ['ray', 'Ray  (Alt+Y)'], ['hline', 'Horizontal line  (Alt+H)'], ['vline', 'Vertical line  (Alt+V)'], ['rect', 'Rectangle  (Alt+R)'], ['fib', 'Fib retracement  (Alt+F)'], ['measure', 'Measure  (Alt+M)'], ['text', 'Text note  (Alt+N)'], ['alert', 'Create price alert  (Alt+A)'], ['vpfix', 'Fixed range volume profile  (Alt+P)']];
const TYPES = [['candles', 'Candles'], ['hollow', 'Hollow candles'], ['bars', 'Bars (OHLC)'], ['heikin', 'Heikin Ashi'], ['line', 'Line'], ['area', 'Area'], ['baseline', 'Baseline']];
V.explorer = {
  html: () => `<div class="ws" id="ws">
  <div class="ws-top">
    <div class="symbox"><b id="wsSym"></b><span id="wsSub"></span></div><span class="tsep"></span>
    <div class="seg" id="tfSeg"><button data-v="1m" title="Intraday: needs the local server">1m</button><button data-v="5m">5m</button><button data-v="15m">15m</button><button data-v="1h">1h</button><button data-v="D">1D</button><button data-v="W">1W</button><button data-v="M">1M</button></div><span class="tsep"></span>
    <div class="dd"><button class="tb wide" id="bType">Candles ▾</button><div class="ddm" id="mType"></div></div>
    <button class="tb wide" id="bInd">${svg('fx', 16)}<span>Indicators</span></button>
    <div class="dd"><button class="tb wide" id="bTpl">${svg('layers', 16)}<span>Templates ▾</span></button><div class="ddm" id="mTpl"></div></div>
    <div class="dd"><button class="tb wide" id="bCmp">${svg('plus', 16)}<span>Compare</span></button><div class="ddm" id="mCmp"></div></div>
    <button class="tb wide" id="bReplay">${svg('replay', 16)}<span>Replay</span></button>
    <button class="tb wide" id="bLive" title="Live updates: needs the local server"><i class="ldot"></i><span>Live</span></button>
    <button class="tb wide" id="bMine" title="Add this stock to your portfolio">${svg('plus', 16)}<span>Portfolio</span></button>
    <span class="sp"></span>
    <button class="tb" id="bUndo" title="Undo  (Ctrl+Z)">${svg('undo', 17)}</button><button class="tb" id="bRedo" title="Redo  (Ctrl+Y)">${svg('redo', 17)}</button>
    <button class="tb" id="bShot" title="Download snapshot (PNG)">${svg('cam', 17)}</button><button class="tb" id="bFull" title="Fullscreen">${svg('full', 17)}</button>
  </div>
  <div class="ws-tools" id="wsTools"></div>
  <div class="ws-chart" id="lwwrap">
    <div id="lw"></div><canvas id="ov"></canvas><div id="wmk" class="wmk"></div>
    <div id="lgs"></div><div id="dtool" class="dtool"></div><div id="hint" class="hint"></div>
    <div id="rbar" class="rbar"></div><button id="aplus" class="aplus" title="Create an alert at this price">${svg('bell', 14)}<b>+</b></button><div id="cmenu" class="ddm cmenu"></div>
  </div>
  <div class="ws-side">
    <div class="tabs" id="sTabs"><button data-v="watch">WATCH</button><button data-v="tech">TECH</button><button data-v="alerts">ALERTS<i id="abadge" class="bdg"></i></button><button data-v="detail">INFO</button><button data-v="layers">LAYERS</button></div>
    <div class="sbody" id="sBody"></div>
    <div class="sidesig" aria-label="Developed by Anish Luitel"><img alt=""><span class="a">DEVELOPED BY</span><b class="hl b">Anish Luitel</b><span class="ly"><i></i><i></i><i></i><i></i></span></div>
  </div>
  <div class="ws-bot">
    <div class="rng" id="rngBtns">${['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'].map(r => `<button data-r="${r}">${r}</button>`).join('')}</div>
    <span class="sp"></span><span class="byline">Developed by <b>Anish Luitel</b></span><span class="sub mono" id="wsClock"></span>
    <div class="rng"><button id="sPct" title="Percentage scale">%</button><button id="sLog" title="Logarithmic scale">log</button><button id="sAuto" title="Auto-fit price scale" class="on">auto</button></div>
  </div>
  <div class="modal" id="modal"><div class="mbox" id="mbox"></div></div><div class="toasts" id="toasts"></div>
</div>`,
  render
};

/* =============================================================  D. CHART ENGINE  */
function ensureChart() {
  if (chart) return;
  const grid = {color: 'rgba(130,180,255,.06)'};
  chart = LW.createChart($('lw'), {
    autoSize: true,
    layout: {background: {type: 'solid', color: 'transparent'}, textColor: '#8FA6D4', fontFamily: MONO, fontSize: 11, attributionLogo: true,
      panes: {separatorColor: 'rgba(130,180,255,.28)', separatorHoverColor: 'rgba(255,158,44,.4)', enableResize: true}},
    grid: {vertLines: grid, horzLines: grid},
    crosshair: {mode: LW.CrosshairMode.Normal, vertLine: {color: 'rgba(255,158,44,.8)', style: LW.LineStyle.Dashed, labelBackgroundColor: OR, width: 1}, horzLine: {color: 'rgba(255,158,44,.8)', style: LW.LineStyle.Dashed, labelBackgroundColor: OR, width: 1}},
    rightPriceScale: {borderColor: 'rgba(130,180,255,.25)', scaleMargins: {top: .08, bottom: .06}},
    timeScale: {borderColor: 'rgba(130,180,255,.25)', rightOffset: 8, barSpacing: 7, minBarSpacing: .25, timeVisible: false, fixLeftEdge: false},
    localization: {priceFormatter: fmtP}
  });
  chart.subscribeCrosshairMove(onCross);
  chart.subscribeClick(onChartClick);
  chart.timeScale().subscribeVisibleLogicalRangeChange(r => { dirty = true; if (r) RT.lastVr = {from: r.from, to: r.to}; });
  new ResizeObserver(() => { sizeOverlay(); dirty = true; }).observe($('lwwrap'));
  requestAnimationFrame(loop);
}
function seriesOpts(kind, color, w, dash) {
  return {color, lineWidth: w || 1.5, lineStyle: dash ? LW.LineStyle.Dashed : LW.LineStyle.Solid, priceLineVisible: false, lastValueVisible: kind === 'pane', crosshairMarkerVisible: false};
}
function buildSeries() {
  // remove everything we created before
  OWN.forEach(s => { try { chart.removeSeries(s); } catch (e) {} }); OWN = [];     // every series this workstation ever created
  S.inds.forEach(i => i.rt = []); main = volSeries = volMA = null; cmpSeries = [];
  const t = S.type;
  if (t === 'candles' || t === 'hollow' || t === 'heikin') main = add(LW.CandlestickSeries, {upColor: t === 'hollow' ? 'rgba(0,0,0,0)' : UP, downColor: DN, borderUpColor: UP, borderDownColor: DN, wickUpColor: UP, wickDownColor: DN, priceLineColor: OR, priceLineStyle: LW.LineStyle.Dashed}, 0);
  else if (t === 'bars') main = add(LW.BarSeries, {upColor: UP, downColor: DN, priceLineColor: OR, priceLineStyle: LW.LineStyle.Dashed}, 0);
  else if (t === 'line') main = add(LW.LineSeries, {color: CR, lineWidth: 2, priceLineColor: OR, priceLineStyle: LW.LineStyle.Dashed}, 0);
  else if (t === 'area') main = add(LW.AreaSeries, {lineColor: OR, topColor: 'rgba(255,158,44,.38)', bottomColor: 'rgba(255,158,44,0)', lineWidth: 2, priceLineColor: OR, priceLineStyle: LW.LineStyle.Dashed}, 0);
  else main = add(LW.BaselineSeries, {topLineColor: UP, bottomLineColor: DN, topFillColor1: 'rgba(111,240,166,.28)', topFillColor2: 'rgba(111,240,166,.02)', bottomFillColor1: 'rgba(255,107,122,.02)', bottomFillColor2: 'rgba(255,107,122,.28)', priceLineColor: OR, priceLineStyle: LW.LineStyle.Dashed}, 0);
  main.applyOptions({autoscaleInfoProvider: base => { const r = base(); if (!r || !S.showTargets) return r; const ti = targetInfo(), vr = chart.timeScale().getVisibleLogicalRange(); if (!ti || !vr || vr.to < RT.view.length + 25) return r; return {priceRange: {minValue: Math.min(r.priceRange.minValue, ti.low), maxValue: Math.max(r.priceRange.maxValue, ti.high)}, margins: r.margins}; }});
  main.applyOptions({priceFormat: {type: 'custom', formatter: fmtP, minMove: Math.abs(last(D.ohlc[RT.ticker].c) || 1) >= 1 ? .01 : .0001}});
  // volume overlay (bottom 18% of the main pane)
  const vi = S.inds.find(i => i.key === 'vol');
  if (vi) {
    volSeries = add(LW.HistogramSeries, {priceFormat: {type: 'volume'}, priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false}, 0);
    volMA = add(LW.LineSeries, {color: vi.colors[0], lineWidth: 1.2, priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false}, 0);
    chart.priceScale('vol', 0).applyOptions({scaleMargins: {top: .82, bottom: 0}});
    vi.rt = [{api: volSeries}, {api: volMA}];
  }
  // compare symbols share the main price scale (percentage mode makes them comparable)
  S.cmp.forEach((t2, i) => cmpSeries.push(add(LW.LineSeries, {color: PAL[(i + 3) % PAL.length], lineWidth: 1.8, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: true, title: short(t2)}, 0)));
  // indicators: overlays on the main pane, oscillators in their own panes
  let pi = 1;
  S.inds.forEach(ind => {
    const r = REG[ind.key]; if (r.kind === 'volume') return; if (r.kind === 'vp') { ind.pane = 0; ind.rt = []; return; }
    ind.pane = r.kind === 'pane' ? pi++ : 0; ind.rt = [];
    const out = r.fn(RT.B || {c: [], h: [], l: [], o: [], v: []}, ind.p);
    out.lines.forEach((ln, j) => {
      const col = ind.colors[Math.min(j, ind.colors.length - 1)] || OR;
      const api = ln.hist ? add(LW.HistogramSeries, {priceLineVisible: false, lastValueVisible: false, base: 0}, ind.pane)
        : ln.dots ? add(LW.LineSeries, {...seriesOpts(r.kind, col, 1), lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 2.2, lastValueVisible: false}, ind.pane)
        : add(LW.LineSeries, seriesOpts(r.kind, col, ln.w || 1.5, ln.dash), ind.pane);
      ind.rt.push({api, ln});
    });
    if (r.kind === 'pane' && ind.rt.length) {
      const first = ind.rt[ind.rt.length > 1 && r.lines0hist ? 1 : 0].api;
      if (r.rng) first.applyOptions({autoscaleInfoProvider: () => ({priceRange: {minValue: r.rng[0], maxValue: r.rng[1]}})});
      (r.levels || []).forEach(lv => first.createPriceLine({price: lv, color: 'rgba(143,166,212,.45)', lineWidth: 1, lineStyle: LW.LineStyle.Dotted, axisLabelVisible: false, title: ''}));
    }
  });
  const panes = chart.panes(); panes.forEach((p, i) => { try { p.setStretchFactor(i === 0 ? 3.4 : 1); } catch (e) {} });
  applyScale(); buildLegends();
}
function mainData() {
  const v = RT.view;
  if (S.type === 'heikin') return heikin(v);
  if (S.type === 'hollow') return v.map((x, i) => { const up = x.close >= (i ? v[i - 1].close : x.open), hollow = x.close >= x.open; return {time: x.time, open: x.open, high: x.high, low: x.low, close: x.close, color: up ? (hollow ? 'rgba(0,0,0,0)' : UP) : DN, borderColor: up ? UP : DN, wickColor: up ? UP : DN}; });
  if (['line', 'area', 'baseline'].includes(S.type)) return v.map(x => ({time: x.time, value: x.close}));
  return v.map(x => ({time: x.time, open: x.open, high: x.high, low: x.low, close: x.close}));
}
function lineData(ln, TSX) {
  const off = ln.off || 0, out = []; let started = false;
  for (let i = 0; i < ln.d.length; i++) {
    const j = i + off; if (j < 0 || j >= TSX.length) continue;
    const v = ln.d[i];
    if (fin(v)) { started = true; const pt = {time: TSX[j], value: v}; if (ln.cf) pt.color = ln.cf(i); out.push(pt); } else if (started) out.push({time: TSX[j]});
  }
  return out;
}
function setData() {
  const maxOff = Math.max(0, S.showTargets && targetInfo() ? aheadBars() : 0, ...S.inds.filter(i => i.vis && REG[i.key].fn).map(i => { const o = REG[i.key].fn(RT.B, i.p); return o.off || 0; }));
  RT.times = RT.view.map(x => x.time); RT.future = maxOff ? futureTimes(maxOff) : [];
  RT.timeIdx = new Map(RT.times.map((t, i) => [t, i])); RT.step = median(RT.times.slice(-60).map((t, i, a) => i ? t - a[i - 1] : null).filter(x => x));
  const TSX = RT.times.concat(RT.future);
  main.setData(mainData().concat(RT.future.map(t => ({time: t}))));
  const hasVol = RT.view.some(x => x.volume > 0);
  if (volSeries) {
    volSeries.setData(hasVol ? RT.view.map(x => ({time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(111,240,166,.38)' : 'rgba(255,107,122,.38)'})) : []);
    const vi = S.inds.find(i => i.key === 'vol'); volMA.setData(hasVol && vi.vis ? lineData({d: sma(RT.B.v, vi.p.ma)}, TSX) : []); volMA.applyOptions({visible: vi.vis}); volSeries.applyOptions({visible: vi.vis});
  }
  S.inds.forEach(ind => {
    const r = REG[ind.key]; if (!r.fn) return;
    const out = r.fn(RT.B, ind.p); ind.out = out;
    (ind.rt || []).forEach((x, j) => { x.ln = out.lines[j]; x.api.setData(ind.vis ? lineData(out.lines[j], TSX) : []); x.api.applyOptions({visible: ind.vis}); });
  });
  cmpSeries.forEach((s, i) => { const b = getBars(S.cmp[i], S.tf), n = R.on ? Math.min(b.length, RT.view.length) : b.length; s.setData((R.on ? b.filter(x => x.time <= RT.times[RT.times.length - 1]) : b).map(x => ({time: x.time, value: x.close}))); });
}
function applyAll(structure) {
  chart.timeScale().applyOptions({timeVisible: isIntra(S.tf), secondsVisible: false});
  // rebuilding series resets the time-scale position, so remember the visible window and restore it afterwards
  const cur = structure && main ? chart.timeScale().getVisibleLogicalRange() : null, vr = cur ? (RT.lastVr || cur) : null;
  RT.view = R.on ? RT.bars.slice(0, R.idx + 1) : RT.bars;
  RT.B = toArrays(RT.view);
  if (structure || !main) buildSeries();
  setData(); updateLegend(RT.view.length - 1); updateHeader();
  if (vr) { chart.timeScale().setVisibleLogicalRange({from: vr.from, to: vr.to}); RT.lastVr = {from: vr.from, to: vr.to}; }
  dirty = true;
}
function applyScale() {
  chart.priceScale('right', 0).applyOptions({mode: S.scale === 'log' ? LW.PriceScaleMode.Logarithmic : S.scale === 'pct' ? LW.PriceScaleMode.Percentage : LW.PriceScaleMode.Normal, autoScale: S.autoscale});
  for (let i = 1; i < chart.panes().length; i++) chart.priceScale('right', i).applyOptions({mode: LW.PriceScaleMode.Normal, autoScale: true});   // oscillator panes never follow % / log
  $('sPct').classList.toggle('on', S.scale === 'pct'); $('sLog').classList.toggle('on', S.scale === 'log'); $('sAuto').classList.toggle('on', S.autoscale);
}
function persist() { lsSet('hl-ws-v2', {tf: isIntra(S.tf) ? 'D' : S.tf, type: S.type, inds: S.inds.map(i => ({key: i.key, p: i.p, colors: i.colors, vis: i.vis}))}); }
function zoomLast(n, ahead) { const L = RT.view.length, r = {from: Math.max(0, L - n), to: L - 1 + (ahead || 9)}; chart.timeScale().setVisibleLogicalRange(r); RT.lastVr = r; }
function setRange(code) {
  const b = RT.view; if (!b.length) return; const lt = b[b.length - 1].time;
  if (code === 'ALL') { chart.timeScale().fitContent(); return; }
  const from = code === 'YTD' ? Date.UTC(new Date(lt * 1000).getUTCFullYear(), 0, 1) / 1000 : lt - ({'1M': 30, '3M': 91, '6M': 182, '1Y': 365, '3Y': 1095, '5Y': 1826}[code]) * 86400;
  let i = b.findIndex(x => x.time >= from); if (i < 0) i = 0; chart.timeScale().setVisibleLogicalRange({from: i - .5, to: b.length - 1 + 9});
}

/* =============================================================  E. LEGENDS  */
function buildLegends() {
  const lg = $('lgs'); lg.innerHTML = '';
  const panes = chart.panes();
  for (let i = 0; i < panes.length; i++) { const d = document.createElement('div'); d.className = 'pl'; d.id = 'pl' + i; lg.appendChild(d); }
  const mk = (ind) => {
    const r = REG[ind.key], row = document.createElement('div'); row.className = 'lgr' + (ind.vis ? '' : ' off'); row.dataset.id = ind.id;
    row.innerHTML = `<span class="nm">${esc(r.lab(ind.p))}</span><span class="vals" data-vals></span><span class="acts"><button data-act="eye" title="Show / hide">${svg(ind.vis ? 'eye' : 'eyeoff', 13)}</button>${r.p.length || r.cols.length ? `<button data-act="set" title="Settings">${svg('gear', 13)}</button>` : ''}<button data-act="del" title="Remove">${svg('close', 13)}</button></span>`;
    return row;
  };
  const p0 = $('pl0'); p0.innerHTML = `<div class="ohlc" id="ohlc"></div>`;
  S.cmp.forEach((t, i) => { const row = document.createElement('div'); row.className = 'lgr cmp'; row.dataset.cmp = t; row.innerHTML = `<span class="nm" style="color:${PAL[(i + 3) % PAL.length]}">${esc(short(t))}</span><span class="vals" data-cv></span><span class="acts"><button data-act="delcmp">${svg('close', 13)}</button></span>`; p0.appendChild(row); });
  S.inds.forEach(ind => { const r = REG[ind.key]; const host = r.kind === 'pane' ? $('pl' + ind.pane) : p0; if (host) host.appendChild(mk(ind)); });
  lg.onclick = e => { const b = e.target.closest('button'); if (!b) return; const row = b.closest('.lgr'); if (row.dataset.cmp) { S.cmp = S.cmp.filter(x => x !== row.dataset.cmp); applyAll(true); renderSide(); return; } const ind = S.inds.find(i => i.id === row.dataset.id); if (!ind) return;
    if (b.dataset.act === 'eye') { ind.vis = !ind.vis; persist(); applyAll(false); buildLegends(); updateLegend(RT.view.length - 1); renderSide(); } else if (b.dataset.act === 'del') removeInd(ind.id); else if (b.dataset.act === 'set') openSettings(ind.id); };
}
function updateLegend(idx) {
  const v = RT.view, b = v[Math.max(0, Math.min(idx, v.length - 1))], pb = v[Math.max(0, idx - 1)]; if (!b) return;
  const o = $('ohlc'); if (!o) return;
  const chg = b.close - (idx > 0 ? pb.close : b.open), pc = chg / (idx > 0 ? pb.close : b.open) * 100, c = chg >= 0 ? UP : DN;
  o.innerHTML = `<span class="s1">${esc(short(RT.ticker))}</span><span class="s2">${TFN[S.tf][0]}</span><span class="s2">${(iso => isIntra(S.tf) ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10))(new Date(b.time * 1000).toISOString())}</span>`
    + `<span>O <b style="color:${c}">${fmtP(b.open)}</b></span><span>H <b style="color:${c}">${fmtP(b.high)}</b></span><span>L <b style="color:${c}">${fmtP(b.low)}</b></span><span>C <b style="color:${c}">${fmtP(b.close)}</b></span>`
    + `<span style="color:${c}">${chg >= 0 ? '+' : ''}${fmtP(chg)} (${chg >= 0 ? '+' : ''}${pc.toFixed(2)}%)</span>${b.volume > 0 ? `<span>Vol <b>${fmtV(b.volume)}</b></span>` : ''}${R.on ? '<span class="rp">REPLAY</span>' : ''}`;
  S.inds.forEach(ind => {
    const row = document.querySelector(`.lgr[data-id="${ind.id}"] [data-vals]`); if (!row) return; const r = REG[ind.key];
    if (r.kind === 'volume') { row.innerHTML = b.volume > 0 ? `<b style="color:${ind.colors[0]}">${fmtV(b.volume)}</b>` : '<i>n/a</i>'; return; }
    if (!ind.out) return;
    row.innerHTML = ind.out.lines.map((ln, j) => { if (ln.hist) return ''; const vi = idx - (ln.off || 0), val = ln.d[vi]; return fin(val) ? `<b style="color:${ind.colors[Math.min(j, ind.colors.length - 1)]}">${Math.abs(val) >= 1000 ? val.toLocaleString(undefined, {maximumFractionDigits: 1}) : val.toFixed(2)}</b>` : ''; }).join(' ');
  });
  S.cmp.forEach(t => { const el = document.querySelector(`.lgr[data-cmp="${t}"] [data-cv]`); if (!el) return; const bb = getBars(t, S.tf).find(x => x.time === b.time); el.innerHTML = bb ? `<b>${fmtP(bb.close)}</b>` : ''; });
}
function onCross(p) { if (p.time === undefined) { updateLegend(RT.view.length - 1); } else { const i = RT.timeIdx.get(p.time); if (i !== undefined) updateLegend(i); } dirty = true; }
function updateHeader() {
  const t = RT.ticker, I = BY[t]; $('wsSym').textContent = I.name; $('wsSub').textContent = `${t} · ${I.ccy} · ${I.region}`; $('wmk').innerHTML = esc(I.name.toUpperCase()) + '<small>DEVELOPED BY ANISH LUITEL</small>';
  $('tfSeg').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.tf); b.classList.toggle('dis', isIntra(b.dataset.v) && !(HL.live && HL.live.ok)); });
  const lv = $('bLive'); if (lv) { lv.classList.toggle('on', !!S.live); lv.classList.toggle('dis', !(HL.live && HL.live.ok)); }
  $('bType').textContent = (TYPES.find(x => x[0] === S.type) || TYPES[0])[1] + ' ▾';
  $('bReplay').classList.toggle('on', R.on || R.picking);
}

/* =============================================================  F. DRAWINGS  */
let DR = [], HIST = {u: [], r: []}, draft = null, drag = null;
const drKey = t => 'hl-dr-' + t;
const loadDr = t => { DR = lsGet(drKey(t), []); HIST = {u: [], r: []}; S.sel = null; };
const saveDr = () => lsSet(drKey(RT.ticker), DR);
const snap = () => JSON.stringify(DR);
function commit(before) { HIST.u.push(before); if (HIST.u.length > 60) HIST.u.shift(); HIST.r = []; saveDr(); RT.dver++; dirty = true; renderSide(); }
function undo() { if (!HIST.u.length) return; HIST.r.push(snap()); DR = JSON.parse(HIST.u.pop()); S.sel = null; saveDr(); RT.dver++; dirty = true; renderSide(); }
function redo() { if (!HIST.r.length) return; HIST.u.push(snap()); DR = JSON.parse(HIST.r.pop()); S.sel = null; saveDr(); RT.dver++; dirty = true; renderSide(); }
const stepSec = () => RT.step || 86400;
function TSA() { return RT.times.concat(RT.future); }
function logicalOf(t) { const T = TSA(), n = T.length; if (!n) return 0; if (t <= T[0]) return (t - T[0]) / stepSec(); if (t >= T[n - 1]) return n - 1 + (t - T[n - 1]) / stepSec(); let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; } return lo + (t - T[lo]) / (T[hi] - T[lo]); }
function timeOf(l) { const T = TSA(), n = T.length; if (!n) return 0; if (l <= 0) return T[0] + l * stepSec(); if (l >= n - 1) return T[n - 1] + (l - (n - 1)) * stepSec(); const i = Math.floor(l); return T[i] + (l - i) * (T[i + 1] - T[i]); }
const X = t => chart.timeScale().logicalToCoordinate(logicalOf(t));
const Yc = p => main.priceToCoordinate(p);
function paneBox() { return {w: chart.timeScale().width(), h: chart.paneSize(0).height}; }
function fromXY(x, y, snapIt) {
  let l = chart.timeScale().coordinateToLogical(x); if (l == null) l = 0;
  let price = main.coordinateToPrice(y); if (price == null) price = 0;
  if (snapIt && S.magnet) { const i = Math.round(l); const b = RT.view[i]; if (b) { l = i; const cands = [b.open, b.high, b.low, b.close]; let best = price, bd = 1e9; cands.forEach(c => { const cy = Yc(c); if (cy != null && Math.abs(cy - y) < bd) { bd = Math.abs(cy - y); best = c; } }); if (bd < 22) price = best; } }
  if (S.magnet || snapIt === 'bar') { const i = Math.round(l); if (RT.view[i]) l = i; }
  return {t: timeOf(l), p: price};
}
const PTSN = {vpfix: 2, trend: 2, ray: 2, rect: 2, fib: 2, measure: 2, hline: 1, vline: 1, text: 1};
const FIB = [[0, '#8FA6D4'], [.236, '#FF6B7A'], [.382, '#FF9E2C'], [.5, '#6FF0A6'], [.618, '#5EEAD4'], [.786, '#6DB6FF'], [1, '#8FA6D4'], [1.618, '#B69CFF']];
function scr(d) { return d.pts.map(q => ({x: X(q.t), y: Yc(q.p)})); }
function segDist(px, py, a, b, ray) { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; let t = L ? ((px - a.x) * dx + (py - a.y) * dy) / L : 0; t = ray ? Math.max(0, t) : Math.max(0, Math.min(1, t)); return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)); }
function distTo(d, x, y) {
  const s = scr(d); if (s.some(q => q.x == null || q.y == null)) return 1e9;
  switch (d.type) {
    case 'trend': case 'measure': return segDist(x, y, s[0], s[1], false);
    case 'ray': return segDist(x, y, s[0], s[1], true);
    case 'hline': return Math.abs(y - s[0].y);
    case 'vline': return Math.abs(x - s[0].x);
    case 'rect': { const x0 = Math.min(s[0].x, s[1].x), x1 = Math.max(s[0].x, s[1].x), y0 = Math.min(s[0].y, s[1].y), y1 = Math.max(s[0].y, s[1].y); return (x >= x0 && x <= x1 && y >= y0 && y <= y1) ? 0 : Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1)); }
    case 'fib': { const x0 = Math.min(s[0].x, s[1].x) - 6, x1 = Math.max(s[0].x, s[1].x) + 6; if (x < x0 || x > x1) return 1e9; let m = 1e9; FIB.forEach(([lv]) => { const py = Yc(d.pts[1].p + (d.pts[0].p - d.pts[1].p) * lv); if (py != null) m = Math.min(m, Math.abs(y - py)); }); return m; }
    case 'vpfix': { const b = vpBox(d); if (b.x0 == null) return 1e9; const xa = Math.min(b.x0, b.x1), xb = Math.max(b.x0, b.x1), ya = b.vp ? Yc(b.vp.hi) : 0, yb = b.vp ? Yc(b.vp.lo) : 1e4, y0 = Math.min(ya, yb), y1 = Math.max(ya, yb); return (x >= xa && x <= xb && y >= y0 && y <= y1) ? 0 : Math.hypot(Math.max(xa - x, 0, x - xb), Math.max(y0 - y, 0, y - y1)); }
    case 'text': { const w = (d.text || '').length * 6.6 + 12; return (x >= s[0].x - 4 && x <= s[0].x + w && y >= s[0].y - 14 && y <= s[0].y + 6) ? 0 : 1e9; }
  } return 1e9;
}
function hit(x, y) { let best = null, bd = 7; for (let i = DR.length - 1; i >= 0; i--) { const dd = distTo(DR[i], x, y); if (dd < bd) { bd = dd; best = DR[i]; } } return best; }
function handleAt(d, x, y) { const s = scr(d); for (let i = 0; i < s.length; i++) if (s[i].x != null && Math.hypot(x - s[i].x, y - s[i].y) < 9) return i; return -1; }
function sizeOverlay() { const w = $('lwwrap'), c = $('ov'), dpr = window.devicePixelRatio || 1; const W = w.clientWidth, H = w.clientHeight; if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; } }
let hoverId = null, mouse = null;
function drawAll() {
  const c = $('ov'), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
  if (!main) return; const box = paneBox(); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, box.w, box.h); ctx.clip();
  drawFills(ctx, box); drawVP(ctx, box); drawTargets(ctx, box);
  if (!S.hide) { DR.forEach(d => drawOne(ctx, d, box, d.id === S.sel, d.id === hoverId)); if (draft) drawOne(ctx, draft, box, true, false); }
  drawAlerts(ctx, box);
  ctx.restore();
}
function drawFills(ctx, box) {
  const vr = chart.timeScale().getVisibleLogicalRange(); if (!vr) return; const i0 = Math.max(0, Math.floor(vr.from) - 1), i1 = Math.ceil(vr.to) + 1;
  S.inds.forEach(ind => {
    const r = REG[ind.key]; if (!ind.vis || !ind.out || ind.pane !== 0) return;
    const fills = ind.out.fills || []; fills.forEach(f => {
      const A = ind.out.lines[f.a].d, B = ind.out.lines[f.b].d; const pa = [], pb = [];
      for (let i = i0; i <= Math.min(i1, A.length - 1); i++) if (fin(A[i]) && fin(B[i])) { const x = chart.timeScale().logicalToCoordinate(i), ya = Yc(A[i]), yb = Yc(B[i]); if (x != null && ya != null && yb != null) { pa.push([x, ya]); pb.push([x, yb]); } }
      if (pa.length < 2) return; ctx.beginPath(); pa.forEach((q, k) => k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let k = pb.length - 1; k >= 0; k--) ctx.lineTo(pb[k][0], pb[k][1]); ctx.closePath(); ctx.fillStyle = f.c; ctx.fill();
    });
    if (ind.out.cloud) {
      const L = ind.out.lines, a = L[ind.out.cloud.a], b = L[ind.out.cloud.b], off = a.off || 0; let seg = [];
      const flush = col => { if (seg.length < 2) { seg = []; return; } ctx.beginPath(); seg.forEach((q, k) => k ? ctx.lineTo(q.x, q.ya) : ctx.moveTo(q.x, q.ya)); for (let k = seg.length - 1; k >= 0; k--) ctx.lineTo(seg[k].x, seg[k].yb); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); seg = []; };
      let cur = null;
      for (let i = i0 - off; i <= Math.min(i1 - off, a.d.length - 1); i++) { if (i < 0 || !fin(a.d[i]) || !fin(b.d[i])) continue; const x = chart.timeScale().logicalToCoordinate(i + off), ya = Yc(a.d[i]), yb = Yc(b.d[i]); if (x == null || ya == null || yb == null) continue; const bull = a.d[i] >= b.d[i]; if (cur !== null && bull !== cur) flush(cur ? 'rgba(111,240,166,.14)' : 'rgba(255,107,122,.14)'); cur = bull; seg.push({x, ya, yb}); }
      if (cur !== null) flush(cur ? 'rgba(111,240,166,.14)' : 'rgba(255,107,122,.14)');
    }
  });
}
function lbl(ctx, text, x, y, color, bg, align) {
  ctx.font = `600 10.5px ${MONO}`; const w = ctx.measureText(text).width + 10; const xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = bg || 'rgba(8,20,52,.92)'; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(xx, y - 10, w, 20, 5) : ctx.rect(xx, y - 10, w, 20); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, xx + 5, y + .5);
}
function drawOne(ctx, d, box, sel, hov) {
  const s = scr(d); if (s.some(q => q.x == null || q.y == null)) return;
  const col = d.color || OR, w = (d.w || 1.6) + (hov || sel ? .6 : 0); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.setLineDash(d.dash ? [6, 4] : []); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  switch (d.type) {
    case 'trend': line(s[0], s[1]); break;
    case 'ray': { const dx = s[1].x - s[0].x, dy = s[1].y - s[0].y, k = dx === 0 ? 1e4 : (box.w + 50 - s[0].x) / dx; line(s[0], {x: s[0].x + dx * Math.max(k, 1), y: s[0].y + dy * Math.max(k, 1)}); break; }
    case 'hline': { line({x: 0, y: s[0].y}, {x: box.w, y: s[0].y}); ctx.setLineDash([]); lbl(ctx, (d.label ? d.label + '  ' : '') + fmtP(d.pts[0].p), box.w - 4, s[0].y, col, null, 'right'); break; }
    case 'vline': line({x: s[0].x, y: 0}, {x: s[0].x, y: box.h}); break;
    case 'vpfix': ctx.setLineDash([]); drawVPFix(ctx, d, box, sel); break;
    case 'rect': { const x0 = Math.min(s[0].x, s[1].x), y0 = Math.min(s[0].y, s[1].y), ww = Math.abs(s[1].x - s[0].x), hh = Math.abs(s[1].y - s[0].y); ctx.globalAlpha = .13; ctx.fillRect(x0, y0, ww, hh); ctx.globalAlpha = 1; ctx.strokeRect(x0, y0, ww, hh); break; }
    case 'fib': {
      const x0 = Math.min(s[0].x, s[1].x), x1 = Math.max(box.w - 2, Math.max(s[0].x, s[1].x)), ys = FIB.map(([lv]) => Yc(d.pts[1].p + (d.pts[0].p - d.pts[1].p) * lv));
      FIB.forEach(([lv, fc], k) => { if (k < FIB.length - 2 || true) { const y = ys[k]; if (y == null) return; if (k < FIB.length - 2 && ys[k + 1] != null) { ctx.globalAlpha = .07; ctx.fillStyle = FIB[k + 1][1]; ctx.fillRect(x0, Math.min(y, ys[k + 1]), x1 - x0, Math.abs(ys[k + 1] - y)); ctx.globalAlpha = 1; } ctx.strokeStyle = fc; ctx.lineWidth = lv === 0 || lv === 1 ? 1.3 : 1; ctx.setLineDash(lv === 0 || lv === 1 ? [] : [4, 3]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = fc; ctx.font = `600 10px ${MONO}`; ctx.textBaseline = 'bottom'; ctx.fillText(`${lv} (${fmtP(d.pts[1].p + (d.pts[0].p - d.pts[1].p) * lv)})`, x0 + 4, y - 2); } });
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); line(s[0], s[1]); break;
    }
    case 'measure': {
      const dp = d.pts[1].p - d.pts[0].p, pc = dp / d.pts[0].p * 100, up = dp >= 0, c2 = up ? BL : DN; const bars = Math.round(logicalOf(d.pts[1].t) - logicalOf(d.pts[0].t)), days = Math.round((d.pts[1].t - d.pts[0].t) / 86400);
      ctx.fillStyle = up ? 'rgba(109,182,255,.16)' : 'rgba(255,107,122,.16)'; ctx.fillRect(Math.min(s[0].x, s[1].x), Math.min(s[0].y, s[1].y), Math.abs(s[1].x - s[0].x), Math.abs(s[1].y - s[0].y));
      ctx.strokeStyle = c2; ctx.lineWidth = 1.4; ctx.setLineDash([]); line({x: s[0].x, y: s[0].y}, {x: s[1].x, y: s[1].y}); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(s[1].x, s[1].y, 3.5, 0, 7); ctx.fill();
      lbl(ctx, `${dp >= 0 ? '+' : ''}${fmtP(dp)} (${pc >= 0 ? '+' : ''}${pc.toFixed(2)}%)  ${bars} bars · ${days}d`, (s[0].x + s[1].x) / 2, Math.min(s[0].y, s[1].y) - 18, c2, null, 'center'); break;
    }
    case 'text': { ctx.setLineDash([]); ctx.font = `600 12px ${MONO}`; ctx.textBaseline = 'alphabetic'; const wd = ctx.measureText(d.text || '').width; ctx.fillStyle = 'rgba(8,20,52,.85)'; ctx.fillRect(s[0].x - 4, s[0].y - 14, wd + 10, 20); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(s[0].x - 4, s[0].y - 14, wd + 10, 20); ctx.fillStyle = col; ctx.fillText(d.text || '', s[0].x + 1, s[0].y); break; }
  }
  ctx.setLineDash([]);
  if (sel) { ctx.fillStyle = '#08142F'; ctx.strokeStyle = col; ctx.lineWidth = 2; s.forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 7); ctx.fill(); ctx.stroke(); }); }
}
function loop() {
  requestAnimationFrame(loop);
  const v = $('v-explorer'); if (!chart || !main || !v || !v.classList.contains('on')) return;
  let sig = '';
  try { const vr = chart.timeScale().getVisibleLogicalRange(); sig = [vr && vr.from.toFixed(2), vr && vr.to.toFixed(2), main.priceToCoordinate(1), main.priceToCoordinate(5000), chart.paneSize(0).height, $('lwwrap').clientWidth, RT.dver, RT.aver, S.sel, hoverId, draft && draft.pts.map(q => q.t + ':' + q.p).join(), mouse && mouse.x + ',' + mouse.y].join('|'); } catch (e) { return; }
  if (dirty || sig !== loop.sig) { loop.sig = sig; dirty = false; sizeOverlay(); drawAll(); positionLegends(); positionDtool(); }
}
function positionLegends() {
  const panes = chart.panes(), w = $('lwwrap').getBoundingClientRect();
  panes.forEach((p, i) => { const el = p.getHTMLElement(), d = $('pl' + i); if (!el || !d) return; const r = el.getBoundingClientRect(); d.style.top = (r.top - w.top + 5) + 'px'; d.style.left = '8px'; d.style.maxWidth = Math.max(240, chart.timeScale().width() - 20) + 'px'; });
}

/* ---- mouse handling for drawing tools ---- */
function wrapXY(e) { const r = $('lwwrap').getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; }
function inPane(p) { const b = paneBox(); return p.x >= 0 && p.x <= b.w && p.y >= 0 && p.y <= b.h; }
function finishDraft() { if (!draft) return; const before = snap(); const d = {...draft, id: 'd' + Date.now() + Math.random().toString(36).slice(2, 5)}; delete d.tmp; DR.push(d); S.sel = d.id; draft = null; setTool('cursor'); commit(before); }
function closeCtx() { const m = $('cmenu'); if (m) m.classList.remove('on'); }
function showCtx(p, price) {
  const m = $('cmenu'), lastP = last(D.ohlc[RT.ticker].c);
  m.innerHTML = `<button data-k="alert">${svg('bell', 15)} Add alert at ${fmtP(price)}</button><button data-k="alertc">${svg('bell', 15)} Add alert… (choose condition)</button><button data-k="hline">${svg('hline', 15)} Add horizontal line at ${fmtP(price)}</button><div class="sepl"></div><button data-k="reset">Reset chart view</button><button data-k="clear">Remove all drawings</button>`;
  m.style.left = Math.max(4, Math.min(p.x, $('lwwrap').clientWidth - 250)) + 'px'; m.style.top = Math.max(4, Math.min(p.y, $('lwwrap').clientHeight - 190)) + 'px'; m.style.right = 'auto'; m.classList.add('on');
  m.onclick = e => { e.stopPropagation(); const b = e.target.closest('button'); if (!b) return; closeCtx();
    if (b.dataset.k === 'alert') addAlert({price, cond: price > lastP ? 'up' : 'down'}); else if (b.dataset.k === 'alertc') openAlertDialog(price);
    else if (b.dataset.k === 'hline') { const before = snap(); DR.push({id: 'd' + Date.now(), type: 'hline', pts: [{t: RT.view[RT.view.length - 1].time, p: price}], color: OR, w: 1.6}); commit(before); }
    else if (b.dataset.k === 'reset') zoomLast(260); else if (b.dataset.k === 'clear') $('tClear').click(); };
}
function onDown(e) {
  if (e.button !== 0 || !chart || !main) return; if (e.target.closest && e.target.closest('#aplus,#dtool,#rbar,#cmenu,.pl,#hint')) return;
  const p = wrapXY(e); closeCtx(); if (!inPane(p) || R.picking) return;
  if (S.tool === 'alert') { e.stopPropagation(); e.preventDefault(); const q = fromXY(p.x, p.y, false); setTool('cursor'); openAlertDialog(q.p); return; }
  if (S.tool !== 'cursor' && !S.lock) {
    e.stopPropagation(); e.preventDefault();
    const q = fromXY(p.x, p.y, true), n = PTSN[S.tool];
    if (n === 1) { const before = snap(); const d = {id: 'd' + Date.now(), type: S.tool, pts: [q], color: OR, w: 1.6}; if (S.tool === 'text') { const tx = window.prompt('Text', 'Note'); if (!tx) return; d.text = tx; } DR.push(d); S.sel = d.id; setTool('cursor'); commit(before); return; }
    if (!draft) { draft = {type: S.tool, pts: [q, {...q}], color: S.tool === 'measure' ? BL : OR, w: 1.6, down: p}; if (S.tool === 'vpfix') { draft.rows = 48; draft.va = 70; } }
    else { draft.pts[1] = q; finishDraft(); }
    return;
  }
  if (S.tool === 'cursor') {
    const ah = alertHit(p.y); if (ah) { e.stopPropagation(); e.preventDefault(); drag = {alert: ah.id, moved: false}; return; }
    if (S.hide) return;
    const sel = DR.find(d => d.id === S.sel); let target = null, hi = -1;
    if (sel) { hi = handleAt(sel, p.x, p.y); if (hi >= 0) target = sel; }
    if (!target) target = hit(p.x, p.y);
    if (target) { e.stopPropagation(); e.preventDefault(); S.sel = target.id; hoverId = target.id; if (target.locked) { RT.dver++; renderSide(); return; }
      const l0 = chart.timeScale().coordinateToLogical(p.x) ?? 0, p0 = main.coordinateToPrice(p.y) ?? 0;
      drag = {id: target.id, h: hi, l0, p0, orig: JSON.parse(JSON.stringify(target.pts)), before: snap(), moved: false}; RT.dver++; renderSide();
    } else if (S.sel) { S.sel = null; RT.dver++; renderSide(); }
  }
}
function onMove(e) {
  const p = wrapXY(e); mouse = p;
  const ap = $('aplus');
  if (ap) { const show = main && S.tool === 'cursor' && !drag && !draft && !R.picking && inPane(p) && !(e.target.closest && e.target.closest('#dtool,#rbar,.pl,#cmenu')); ap.style.display = show ? 'flex' : 'none'; if (show) { ap.style.top = (p.y - 12) + 'px'; ap.style.left = (paneBox().w - 40) + 'px'; ap.dataset.y = p.y; } }
  if (drag && drag.alert) { const a = AL.find(x => x.id === drag.alert), pr = main.coordinateToPrice(p.y); if (a && pr != null) { a.price = pr; drag.moved = true; RT.aver++; dirty = true; } return; }
  if (drag) {
    const d = DR.find(x => x.id === drag.id); if (!d) return; drag.moved = true;
    if (drag.h >= 0) { d.pts[drag.h] = fromXY(p.x, p.y, true); }
    else { const l = chart.timeScale().coordinateToLogical(p.x) ?? 0, pr = main.coordinateToPrice(p.y) ?? 0, dl = l - drag.l0, dp = pr - drag.p0; d.pts = drag.orig.map(q => ({t: timeOf(logicalOf(q.t) + dl), p: q.p + dp})); }
    RT.dver++; dirty = true; return;
  }
  if (draft) { draft.pts[1] = fromXY(Math.max(0, Math.min(p.x, paneBox().w)), Math.max(0, Math.min(p.y, paneBox().h)), true); RT.dver++; dirty = true; return; }
  const w = $('lwwrap');
  if (S.tool === 'cursor' && !S.hide && inPane(p)) { const h = hit(p.x, p.y), id = h ? h.id : null; if (id !== hoverId) { hoverId = id; dirty = true; } w.classList.toggle('hovdraw', !!id || !!alertHit(p.y)); } else { if (hoverId) { hoverId = null; dirty = true; } w.classList.remove('hovdraw'); }
}
function onUp(e) {
  if (drag && drag.alert) { if (drag.moved) { saveAlerts(); renderSide(); } drag = null; return; }
  if (drag) { if (drag.moved) commit(drag.before); drag = null; return; }
  if (draft && draft.down) { const p = wrapXY(e); if (Math.hypot(p.x - draft.down.x, p.y - draft.down.y) > 8) { finishDraft(); } else delete draft.down; }
}
function setTool(t) { S.tool = t; draft = null; $('wsTools').querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('lwwrap').classList.toggle('tool', t !== 'cursor'); hint(t === 'cursor' ? '' : ({measure: 'Click two points to measure', hline: 'Click to place a horizontal line', vline: 'Click to place a vertical line', text: 'Click to place a note', alert: 'Click on the chart to set the alert price'}[t] || 'Click start point, then end point (or drag)')); RT.dver++; dirty = true; }
let hintT = null; function hint(t, ms) { const h = $('hint'); h.textContent = t; h.style.display = t ? 'block' : 'none'; clearTimeout(hintT); if (t && ms) hintT = setTimeout(() => hint(''), ms); }
function positionDtool() {
  const el = $('dtool'), d = DR.find(x => x.id === S.sel);
  if (!d || S.hide) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  if (el.dataset.for !== d.id + RT.dver) {
    el.dataset.for = d.id + RT.dver;
    el.innerHTML = [OR, BL, UP, DN, VI, CR].map(c => `<button class="sw ${d.color === c ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('') + '<span class="tsep"></span>'
      + [1.2, 2, 3.2].map(w => `<button class="tb sm ${Math.abs((d.w || 1.6) - w) < .5 ? 'on' : ''}" data-w="${w}"><i style="display:block;height:${Math.max(1, w)}px;width:14px;background:currentColor;border-radius:2px"></i></button>`).join('')
      + `<button class="tb sm ${d.dash ? 'on' : ''}" data-act="dash" title="Dashed">- -</button><button class="tb sm ${d.locked ? 'on' : ''}" data-act="lock" title="Lock">${svg('lock', 14)}</button><button class="tb sm" data-act="del" title="Delete (Del)">${svg('trash', 14)}</button>`;
  }
}

/* =============================================================  G. SIDEBAR  */
function spark(t) { const c = D.ohlc[t].c.filter(x => x != null).slice(-45); if (c.length < 3) return ''; const mn = Math.min(...c), mx = Math.max(...c), w = 52, h = 16, pts = c.map((v, i) => `${(i / (c.length - 1) * w).toFixed(1)},${(h - (v - mn) / (mx - mn || 1) * h).toFixed(1)}`).join(' '); return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${c[c.length - 1] >= c[0] ? UP : DN}" stroke-width="1.3" points="${pts}"/></svg>`; }
let wlFilter = '';
function renderSideBase() {
  const body = $('sBody'); if (!body) return; $('sTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S.tab));
  if (S.tab === 'watch') {
    const L = HL.list(ALL).filter(t => !wlFilter || (short(t) + t).toLowerCase().includes(wlFilter));
    const row = t => { const o = D.ohlc[t], c = last(o.c), ch = (D.tr[t] || {})['1D']; return `<button class="wl ${t === RT.ticker ? 'on' : ''}" data-t="${esc(t)}"><i class="rd" style="background:${rcol(t)}"></i><span class="n"><b>${esc(short(t))}${HL.mine && HL.mine.held(t) ? ' <u class="held" title="In your portfolio">●</u>' : ''}</b><em>${esc(t)}</em></span>${spark(t)}<span class="p"><b>${fmtP(c)}</b><em class="${cls(ch)}">${pct(ch, 2)}</em></span></button>`; };
    const idx = L.filter(t => BY[t].type === 'Index'), stk = L.filter(t => BY[t].type === 'Stock'), mine = L.filter(t => BY[t].type === 'Mine');
    body.innerHTML = `<button class="btn" id="wlAdd" style="width:100%;margin-bottom:8px">＋ Add a stock</button><input class="tinput" id="wlq" placeholder="filter watchlist…" value="${esc(wlFilter)}">${idx.length ? '<div class="gh">INDICES</div>' + idx.map(row).join('') : ''}${stk.length ? '<div class="gh">STOCKS</div>' + stk.map(row).join('') : ''}${mine.length ? '<div class="gh">MY STOCKS</div>' + mine.map(row).join('') : ''}`;
    body.onclick = e => { if (e.target.closest('#wlAdd')) return HL.addStock(); const b = e.target.closest('.wl'); if (b) selectTicker(b.dataset.t, false); };
    const q = $('wlq'); q.oninput = () => { wlFilter = q.value.toLowerCase(); const pos = q.selectionStart; renderSide(); const n = $('wlq'); n.focus(); n.setSelectionRange(pos, pos); };
  } else if (S.tab === 'detail') {
    body.innerHTML = `<div class="card">${HL.cardHtml(RT.ticker)}</div>`; body.onclick = null;
  } else {
    body.innerHTML = `<div class="gh">INDICATORS</div>${S.inds.map(i => `<div class="lrow" data-id="${i.id}"><button data-act="eye">${svg(i.vis ? 'eye' : 'eyeoff', 14)}</button><span>${esc(REG[i.key].lab(i.p))}</span><span class="sp"></span>${REG[i.key].p.length ? `<button data-act="set">${svg('gear', 14)}</button>` : ''}<button data-act="del">${svg('close', 14)}</button></div>`).join('') || '<div class="sub" style="padding:8px 12px">None. Use Indicators in the toolbar.</div>'}
      <div class="gh">DRAWINGS · ${esc(short(RT.ticker))}</div>${DR.map(d => `<div class="lrow ${d.id === S.sel ? 'on' : ''}" data-d="${d.id}"><span class="sw" style="background:${d.color || OR}"></span><span>${esc(d.type)}${d.text ? ': ' + esc(d.text) : ''}</span><span class="sp"></span><button data-act="ddel">${svg('close', 14)}</button></div>`).join('') || '<div class="sub" style="padding:8px 12px">No drawings yet. Pick a tool on the left rail.</div>'}`;
    body.onclick = e => { const b = e.target.closest('button'), row = e.target.closest('.lrow'); if (!row) return;
      if (row.dataset.d) { if (b) { const before = snap(); DR = DR.filter(x => x.id !== row.dataset.d); S.sel = null; commit(before); } else { S.sel = row.dataset.d; RT.dver++; renderSide(); } return; }
      const id = row.dataset.id, ind = S.inds.find(i => i.id === id); if (!b || !ind) return; if (b.dataset.act === 'eye') { ind.vis = !ind.vis; persist(); applyAll(false); buildLegends(); updateLegend(RT.view.length - 1); renderSide(); } else if (b.dataset.act === 'del') removeInd(id); else openSettings(id); };
  }
}

function renderSide() {
  const body = $('sBody'); if (!body) return; const sc = body.scrollTop;
  $('sTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S.tab));
  if (S.tab === 'tech') renderTech(body); else if (S.tab === 'alerts') renderAlerts(body); else renderSideBase();
  body.scrollTop = sc; const act = AL.filter(a => a.active).length + AL.filter(a => a.trig).length, bd = $('abadge'); if (bd) bd.textContent = act ? act : '';
}

/* =============================================================  H. INDICATOR UI  */
function addInd(key, params) { S.inds.push(mkInd(key, params)); persist(); applyAll(true); renderSide(); }
function removeInd(id) { const ind = S.inds.find(i => i.id === id); if (!ind) return; S.inds = S.inds.filter(i => i.id !== id); persist(); applyAll(true); renderSide(); }
function openModal(html) { $('mbox').innerHTML = html + '<div class="mcredit">Developed by <b>Anish Luitel</b></div>'; $('modal').classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); }
function openIndicators() {
  const groups = [...new Set(Object.values(REG).map(r => r.g))];
  const draw = q => `<div class="mh"><b>Indicators</b><input class="tinput" id="iq" placeholder="Search…  (e.g. RSI, Ichimoku, Bollinger)" value="${esc(q || '')}"><button class="tb" data-close>${svg('close', 16)}</button></div><div class="mlist">${groups.map(g => { const items = Object.entries(REG).filter(([k, r]) => r.g === g && (!q || (r.n + ' ' + k + ' ' + g).toLowerCase().includes(q.toLowerCase()))); return items.length ? `<div class="gh">${g.toUpperCase()}</div>` + items.map(([k, r]) => `<button class="mrow" data-k="${k}"><b>${esc(r.n)}</b><em>${r.kind === 'pane' ? 'separate pane' : r.kind === 'volume' ? 'volume bars' : r.kind === 'vp' ? 'profile on price' : 'overlay on price'}</em></button>`).join('') : ''; }).join('')}</div>`;
  openModal(draw('')); const bind = () => { const iq = $('iq'); iq.focus(); iq.oninput = () => { const v = iq.value; $('mbox').innerHTML = draw(v); bind(); const n = $('iq'); n.focus(); n.setSelectionRange(v.length, v.length); }; };
  bind();
  $('mbox').onclick = e => { if (e.target.closest('[data-close]')) return closeModal(); const b = e.target.closest('.mrow'); if (b) { if (b.dataset.k === 'vol' && S.inds.some(i => i.key === 'vol')) { closeModal(); return; } addInd(b.dataset.k); closeModal(); } };
}
function openSettings(id) {
  const ind = S.inds.find(i => i.id === id); if (!ind) return; const r = REG[ind.key], names = ind.out ? ind.out.lines.map(l => l.n || '') : r.cols.map(() => '');
  openModal(`<div class="mh"><b>${esc(r.n)}</b><button class="tb" data-close>${svg('close', 16)}</button></div><div class="mform">${r.p.map(x => `<label>${esc(x.l)}<input type="number" data-p="${x.k}" value="${ind.p[x.k]}" min="${x.min}" max="${x.max}" step="${x.step}"></label>`).join('')}
    ${ind.colors.map((c, j) => `<label>Colour ${esc(names[j] || (ind.key === 'vpvr' ? ['Up volume', 'Down volume · value area', 'POC line'][j] : j + 1))}<input type="color" data-c="${j}" value="${c.startsWith('#') ? c : '#ff9e2c'}"></label>`).join('')}</div><div class="mf"><button class="btn on" data-ok>Apply</button></div>`);
  $('mbox').onclick = e => { if (e.target.closest('[data-close]')) return closeModal(); if (e.target.closest('[data-ok]')) { $('mbox').querySelectorAll('[data-p]').forEach(i => { const v = +i.value; if (fin(v)) ind.p[i.dataset.p] = v; }); $('mbox').querySelectorAll('[data-c]').forEach(i => ind.colors[+i.dataset.c] = i.value); persist(); applyAll(true); renderSide(); closeModal(); } };
}

/* =============================================================  I. REPLAY  */
function replayBar() {
  const b = $('rbar');
  if (!R.on && !R.picking) { b.style.display = 'none'; return; }
  b.style.display = 'flex';
  b.innerHTML = R.picking ? `<span>Click a bar on the chart to start the replay</span><button class="tb sm" data-r="cancel">${svg('close', 14)}</button>`
    : `<button class="tb sm" data-r="pick" title="Choose another start bar">${svg('replay', 14)}</button><button class="tb sm" data-r="play" title="Play / pause (Space)">${svg(R.playing ? 'pause' : 'play', 14)}</button><button class="tb sm" data-r="step" title="Next bar (→)">${svg('step', 14)}</button>
      <span class="seg">${[1, 2, 5, 10].map(s => `<button data-s="${s}" class="${R.speed === s ? 'on' : ''}">${s}x</button>`).join('')}</span><span class="sub mono">${new Date(RT.view[RT.view.length - 1].time * 1000).toISOString().slice(0, 10)} · bar ${R.idx + 1}/${RT.bars.length}</span><button class="tb sm" data-r="exit" title="Exit replay">${svg('close', 14)}</button>`;
}
function replayStep() { if (R.idx >= RT.bars.length - 1) { R.playing = false; clearInterval(R.timer); replayBar(); return; } R.idx++; applyAll(false); chart.timeScale().scrollToRealTime(); replayAlerts(); if (S.tab === 'tech') renderSide(); replayBar(); }
function replayPlay(on) { R.playing = on; clearInterval(R.timer); if (on) R.timer = setInterval(replayStep, 700 / R.speed); replayBar(); }
function replayExit() { R.on = false; R.picking = false; R.alerts = null; SIM = []; RT.aver++; replayPlay(false); applyAll(false); replayBar(); updateHeader(); hint(''); renderSide(); }
function onChartClick(p) {
  if (R.picking && p.time !== undefined) { const i = RT.timeIdx.get(p.time); if (i !== undefined) { R.picking = false; R.on = true; R.idx = Math.max(20, i); hint(''); R.alerts = AL.filter(a => a.ticker === RT.ticker).map(a => ({...a, fired: null, active: a.trig ? true : a.active})); applyAll(false); zoomLast(120); replayBar(); updateHeader(); } }
}

/* =============================================================  I2. GAUGES, TECHNICALS, ANALYST RATING  */
const GP_TECH = ['#94384A', '#FF6B7A', '#8FA6D4', '#6DB6FF', '#2F6FE0'], GP_AN = ['#F08A24', '#FFB347', '#8FA6D4', '#2BB59A', '#0F8F6B'];
function gauge(v, pal, idx, cls2) {
  const cx = 110, cy = 104, r = 80, rad = d => d * Math.PI / 180, pt = (a, rr) => [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))], f = q => q.map(x => x.toFixed(1)).join(' ');
  const arc = (a0, a1) => { const p0 = pt(a0, r), p1 = pt(a1, r); return `M${f(p0)}A${r} ${r} 0 0 1 ${f(p1)}`; };
  let s = `<svg viewBox="0 0 220 128" class="gauge ${cls2 || ''}">`;
  pal.forEach((c, k) => { s += `<path d="${arc(180 + k * 36 + 5, 180 + (k + 1) * 36 - 5)}" stroke="${c}" stroke-width="13" stroke-linecap="round" fill="none" opacity="${k === idx ? 1 : .5}" ${k === idx ? `style="filter:drop-shadow(0 0 5px ${c})"` : ''}/>`; });
  const a = 180 + 180 * (Math.max(-1, Math.min(1, v)) + 1) / 2, tip = pt(a, 68), b1 = pt(a + 90, 5.5), b2 = pt(a - 90, 5.5), tail = pt(a + 180, 13);
  s += `<polygon points="${f(tip)} ${f(b1)} ${f(tail)} ${f(b2)}" fill="#F6F0E2" stroke="#07122E" stroke-width="1" stroke-linejoin="round"/><circle cx="${cx}" cy="${cy}" r="7" fill="#F6F0E2" stroke="#07122E" stroke-width="2"/>`;
  s += `<text x="${cx - r}" y="${cy + 22}" text-anchor="middle" class="gt">SELL</text><text x="${cx + r}" y="${cy + 22}" text-anchor="middle" class="gt">BUY</text></svg>`;
  return s;
}
const vcol = a => a === 'Buy' ? 'pos' : a === 'Sell' ? 'neg' : '';
function targetInfo() {
  const f = (D.fund || {})[RT.ticker]; if (!f || !f.an) return null; const an = f.an, px = last(D.ohlc[RT.ticker].c);
  if (!nz(an.tmean) || !(px > 0)) return null; const ratio = an.tmean / px; if (ratio < .2 || ratio > 5) return null;
  return {mean: an.tmean, high: nz(an.thigh) ? an.thigh : an.tmean, low: nz(an.tlow) ? an.tlow : an.tmean, med: nz(an.tmed) ? an.tmed : an.tmean, n: an.n, px, up: an.tmean / px - 1};
}
function analystHtml() {
  const f = (D.fund || {})[RT.ticker]; if (!f || !f.an || !nz(f.an.mean)) return `<div class="sec">ANALYST RATING</div><div class="sub" style="padding:4px 2px 10px">No analyst coverage for ${esc(short(RT.ticker))} (indices and some listings have none).</div>`;
  const an = f.an, v = (3 - an.mean) / 2, idx = an.mean <= 1.5 ? 4 : an.mean <= 2.5 ? 3 : an.mean <= 3.5 ? 2 : an.mean <= 4.5 ? 1 : 0, ti = targetInfo();
  const cnt = [['Strong buy', an.sb, GP_AN[4]], ['Buy', an.b, GP_AN[3]], ['Hold', an.h, GP_AN[2]], ['Sell', an.s, GP_AN[1]], ['Strong sell', an.ss, GP_AN[0]]], tot = cnt.reduce((a, x) => a + (nz(x[1]) ? x[1] : 0), 0);
  let h = `<div class="sec">ANALYST RATING</div><div class="gwrap">${gauge(v, GP_AN, idx)}<div class="verd">${VERD[idx]}</div><div class="sub mono" style="margin-top:2px">mean score ${num(an.mean, 2)} / 5 · ${nz(an.n) ? an.n + ' analysts' : ''}</div></div>`;
  if (tot > 0) h += `<div class="dist">${cnt.map(x => nz(x[1]) && x[1] > 0 ? `<i style="flex:${x[1]};background:${x[2]}" title="${x[0]}: ${x[1]}"></i>` : '').join('')}</div><div class="distl">${cnt.map(x => `<span><b style="color:${x[2]}">${nz(x[1]) ? x[1] : 0}</b>${x[0]}</span>`).join('')}</div>`;
  if (ti) {
    const lo = Math.min(ti.low, ti.px), hi = Math.max(ti.high, ti.px), pos = x => ((x - lo) / (hi - lo || 1) * 100).toFixed(1);
    h += `<div class="ptrow"><span>1 year price target</span><span><b>${fmtP(ti.mean)}</b> <b class="${cls(ti.up)}">(${pct(ti.up, 2)})</b></span></div>
      <div class="prange"><div class="bar"><i style="left:${pos(ti.low)}%;width:${(pos(ti.high) - pos(ti.low)).toFixed(1)}%"></i><u style="left:${pos(ti.px)}%" title="Last price"></u><s style="left:${pos(ti.mean)}%" title="Average target"></s></div>
      <div class="lab"><span>Low <b>${fmtP(ti.low)}</b></span><span>Median <b>${fmtP(ti.med)}</b></span><span>High <b>${fmtP(ti.high)}</b></span></div></div>
      <button class="btn ${S.showTargets ? 'on' : ''}" id="tgtBtn" style="width:100%;margin-top:8px">${S.showTargets ? 'Hide' : 'Show'} price targets on chart</button>`;
  } else h += `<div class="sub" style="padding:6px 2px">Price target unavailable or in a different quote unit.</div>`;
  return h + `<div class="sub" style="font-size:10.5px;margin-top:8px">Source: Yahoo Finance analyst consensus. Illustrative, not advice.</div>`;
}
function techHtml() {
  const T = computeTech(RT.B), t = RT.ticker, tf = TFN[S.tf][1];
  let h = `<div class="th"><i class="rd" style="background:${rcol(t)}"></i><b>${esc(short(t))}</b><span class="sp"></span><span class="tag o">${tf}${R.on ? ' · replay' : ''}</span></div>`;
  if (!T) return h + '<div class="sub" style="padding:14px 4px">Not enough history for a technical rating.</div>';
  const gi = verdictIdx(T.all.score);
  h += `<div class="gwrap">${gauge(T.all.score, GP_TECH, gi)}<div class="verd">${VERD[gi]}</div><div class="cnt"><span class="neg">Sell ${T.all.sell}</span><span>Neutral ${T.all.neu}</span><span class="pos">Buy ${T.all.buy}</span></div></div>
    <div class="g2"><div>${gauge(T.so.score, GP_TECH, verdictIdx(T.so.score), 'sm')}<b>Oscillators</b><em class="${vcol(['', 'Sell', '', 'Buy', 'Buy'][verdictIdx(T.so.score)] || '')}">${VERD[verdictIdx(T.so.score)]}</em><span class="sub mono">${T.so.sell} · ${T.so.neu} · ${T.so.buy}</span></div>
    <div>${gauge(T.sm.score, GP_TECH, verdictIdx(T.sm.score), 'sm')}<b>Moving averages</b><em class="${vcol(['', 'Sell', '', 'Buy', 'Buy'][verdictIdx(T.sm.score)] || '')}">${VERD[verdictIdx(T.sm.score)]}</em><span class="sub mono">${T.sm.sell} · ${T.sm.neu} · ${T.sm.buy}</span></div></div>
    <div style="text-align:center"><button class="pillbtn" id="techMore">${S.techMore ? 'Fewer technicals' : 'More technicals'}</button></div>`;
  if (S.techMore) {
    const tbl = (title, rows) => `<div class="sec">${title}</div><table class="tt"><thead><tr><th>Name</th><th>Value</th><th>Action</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.n)}</td><td>${fin(x.v) ? fmtP(x.v) : '–'}</td><td class="${vcol(x.a)}">${x.a}</td></tr>`).join('')}</tbody></table>`;
    h += tbl('OSCILLATORS', T.osc) + tbl('MOVING AVERAGES', T.mas);
    const bars = RT.view, pb = bars[bars.length - 1], ps = pivotSets(pb), keys = ['S3', 'S2', 'S1', 'P', 'R1', 'R2', 'R3'];
    h += `<div class="sec">PIVOT POINTS · from the last ${TFN[S.tf][2]}</div><table class="tt piv"><thead><tr><th>Pivot</th>${Object.keys(ps).map(k => `<th>${({Classic: 'Classic', Fibonacci: 'Fib', Camarilla: 'Camar', Woodie: 'Woodie'})[k]}</th>`).join('')}</tr></thead><tbody>${keys.map(k => `<tr><td>${k}</td>${Object.keys(ps).map(m => `<td class="${k[0] === 'R' ? 'neg' : k[0] === 'S' ? 'pos' : ''}">${fmtP(ps[m][k])}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <button class="btn" id="plotPiv" style="width:100%;margin-top:8px">Plot classic pivots on chart</button>
      <div class="sub" style="font-size:10.5px;margin-top:8px">Each indicator votes Buy / Sell / Neutral with simplified, TradingView-style rules; the gauge is the net vote (Strong sell … Strong buy).</div>`;
  }
  return h + analystHtml();
}
function renderTech(body) {
  body.innerHTML = `<div class="tcard">${techHtml()}</div>`;
  body.onclick = e => {
    if (e.target.closest('#techMore')) { S.techMore = !S.techMore; renderSide(); }
    else if (e.target.closest('#tgtBtn')) { S.showTargets = !S.showTargets; applyAll(false); renderSide(); if (S.showTargets) { const ah = aheadBars(); if (ah) zoomLast(S.tf === 'D' ? 300 : S.tf === 'W' ? 150 : 60, ah + 14); else toast('Price targets', 'Targets are projected on daily, weekly and monthly charts.', 'info'); } }
    else if (e.target.closest('#plotPiv')) plotPivots();
  };
}
function plotPivots() {
  const b = RT.view[RT.view.length - 1], c = pivotSets(b).Classic, before = snap(); DR = DR.filter(d => !d.pivot);
  Object.entries(c).forEach(([k, p]) => DR.push({id: 'pv' + k + Date.now(), type: 'hline', pivot: true, label: k, pts: [{t: b.time, p}], color: k === 'P' ? GD : k[0] === 'R' ? DN : UP, w: 1.2, dash: true}));
  commit(before); toast('Pivot points', 'Classic pivots plotted on the chart (Layers tab to remove).', 'info');
}

/* =============================================================  I3. TOASTS + PRICE ALERTS  */
function toast(title, msg, kind) {
  const c = $('toasts'); if (!c) return; const d = document.createElement('div'); d.className = 'toast ' + (kind || 'info');
  d.innerHTML = `<span class="ti">${svg(kind === 'alert' ? 'bell' : 'plus', 16)}</span><div><b>${esc(title)}</b><div>${esc(msg)}</div></div>`; d.onclick = () => d.remove(); c.appendChild(d); setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, kind === 'alert' ? 9000 : 4500);
}
let actx = null;
function beep() { if (!S.sound) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + .13); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .45); o.connect(g); g.connect(actx.destination); o.start(); o.stop(t + .5); } catch (e) {} }
let AL = lsGet('hl-alerts-v1', []), SIM = [];
const saveAlerts = () => lsSet('hl-alerts-v1', AL);
const COND = {cross: 'Crossing', up: 'Crossing up', down: 'Crossing down', gt: 'Greater than', lt: 'Less than'};
const alertText = a => `${short(a.ticker)} ${COND[a.cond].toLowerCase()} ${fmtP(a.price)}`;
function condHit(cond, P, bar, prev) {
  const pc = prev ? prev.close : bar.open;
  if (cond === 'up') return pc < P && bar.high >= P; if (cond === 'down') return pc > P && bar.low <= P;
  if (cond === 'cross') return (pc < P && bar.high >= P) || (pc > P && bar.low <= P);
  if (cond === 'gt') return bar.close > P; if (cond === 'lt') return bar.close < P; return false;
}
function scanAlerts() {            // alerts are checked against every daily bar that arrived after they were created
  const fired = [];
  AL.forEach(a => { if (!a.active || a.trig) return; const bars = getBars(a.ticker, 'D'); for (let k = 0; k < bars.length; k++) { const b = bars[k]; if (b.time <= a.created) continue; if (condHit(a.cond, a.price, b, bars[k - 1])) { a.trig = {t: b.time, p: (a.cond === 'gt' || a.cond === 'lt') ? b.close : a.price}; a.active = false; fired.push(a); break; } } });
  if (fired.length) saveAlerts(); return fired;
}
function addAlert(o) {
  const bars = getBars(o.ticker || RT.ticker, 'D'), a = {id: 'a' + Date.now() + Math.random().toString(36).slice(2, 5), ticker: o.ticker || RT.ticker, price: o.price, cond: o.cond || 'cross', note: o.note || '', created: bars.length ? bars[bars.length - 1].time : 0, active: true, trig: null, sim: !!R.on};
  if (a.sim) { SIM.push(a); if (R.alerts) R.alerts.push({...a, fired: null}); } else { AL.push(a); saveAlerts(); }
  RT.aver++; dirty = true; renderSide(); toast('Alert created', alertText(a) + (a.sim ? '  (replay only)' : ''), 'info'); return a;
}
function removeAlert(id) { const before = AL.length; AL = AL.filter(a => a.id !== id); SIM = SIM.filter(a => a.id !== id); if (R.alerts) R.alerts = R.alerts.filter(a => a.id !== id); if (AL.length !== before) saveAlerts(); RT.aver++; dirty = true; renderSide(); }
function fireReplay(a, bar) { a.fired = {t: bar.time, p: bar.close}; toast('Alert triggered', `${alertText(a)} · ${new Date(bar.time * 1000).toISOString().slice(0, 10)} · close ${fmtP(bar.close)}`, 'alert'); beep(); RT.aver++; dirty = true; renderSide(); }
function replayAlerts() { if (!R.alerts) return; const b = RT.bars[R.idx], pb = RT.bars[R.idx - 1]; R.alerts.forEach(a => { if (!a.fired && a.active && condHit(a.cond, a.price, b, pb)) fireReplay(a, b); }); }
function alertsFor(t) {
  if (R.on && R.alerts) return R.alerts.filter(a => a.ticker === t).map(a => ({a, state: a.fired ? 'fired' : 'active'}));
  return AL.filter(a => a.ticker === t).map(a => ({a, state: a.trig ? 'fired' : (a.active ? 'active' : 'paused')}));
}
function alertHit(y) { if (R.on) return null; for (const x of alertsFor(RT.ticker)) { if (x.state !== 'active') continue; const yy = Yc(x.a.price); if (yy != null && Math.abs(yy - y) < 6) return x.a; } return null; }
function bellPath(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-6, -1, -5, -4); ctx.quadraticCurveTo(-3, -8, 0, -8); ctx.quadraticCurveTo(3, -8, 5, -4); ctx.quadraticCurveTo(6, -1, 6, 4); ctx.closePath(); ctx.fill(); ctx.fillRect(-7.5, 4, 15, 1.7); ctx.beginPath(); ctx.arc(0, 7.8, 1.9, 0, 7); ctx.fill(); ctx.restore();
}
function drawAlerts(ctx, box) {
  alertsFor(RT.ticker).forEach(({a, state}) => {
    const y = Yc(a.price); if (y == null || y < -12 || y > box.h + 12) return;
    const col = state === 'fired' ? '#8FA6D4' : state === 'paused' ? '#5B72A3' : '#FFD166';
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = state === 'active' ? 1.5 : 1.1; ctx.setLineDash(state === 'active' ? [8, 5] : [2, 5]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(box.w, y); ctx.stroke(); ctx.setLineDash([]);
    const txt = `${state === 'fired' ? '✓ ' : ''}${COND[a.cond]} ${fmtP(a.price)}${a.sim ? ' · SIM' : ''}`; ctx.font = `600 10.5px ${MONO}`; const w = ctx.measureText(txt).width + 30;
    ctx.fillStyle = 'rgba(8,20,52,.94)'; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(8, y - 11, w, 22, 6) : ctx.rect(8, y - 11, w, 22); ctx.fill(); ctx.stroke();
    bellPath(ctx, 20, y - 1, .85, col); ctx.fillStyle = col; ctx.textBaseline = 'middle'; ctx.fillText(txt, 31, y + .5); ctx.restore();
    if (state === 'fired' && a.trig) { const tx = X(a.trig.t), ty = Yc(a.trig.p); if (tx != null && ty != null && tx > 0 && tx < box.w) { ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, 7); ctx.fill(); bellPath(ctx, tx, ty - 14, .8, '#FFD166'); } }
    if (state === 'fired' && a.fired) { const tx = X(a.fired.t), ty = Yc(a.fired.p); if (tx != null && ty != null) { ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, 7); ctx.fill(); bellPath(ctx, tx, ty - 14, .8, '#FFD166'); } }
  });
}
function openAlertDialog(price, ticker) {
  const t = ticker || RT.ticker, last0 = last(D.ohlc[t].c), cond = (price > last0) ? 'up' : 'down';
  openModal(`<div class="mh"><b>Create alert · ${esc(short(t))}</b><button class="tb" data-close>${svg('close', 16)}</button></div><div class="mform">
    <label>Condition<select id="alC">${Object.entries(COND).map(([k, v]) => `<option value="${k}" ${k === cond ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Price<input type="number" id="alP" step="any" value="${(+price).toFixed(Math.abs(price) >= 1 ? 2 : 4)}"></label>
    <label style="grid-column:1/3">Note (optional)<input type="text" id="alN" placeholder="e.g. breakout above resistance"></label></div>
    <div class="sub" style="padding:0 16px 8px;font-size:11.5px">Checked against every new daily bar. It fires when the bar's range crosses the level (or closes beyond it for greater/less than). Last close ${fmtP(last0)}. ${R.on ? '<b>Replay is on: this alert only exists during the replay.</b>' : 'Alerts are saved in this browser and re-checked each time you open the dashboard.'}</div>
    <div class="mf"><button class="btn on" data-ok>Create alert</button></div>`);
  $('mbox').onclick = e => { if (e.target.closest('[data-close]')) return closeModal(); if (e.target.closest('[data-ok]')) { const p = +$('alP').value; if (!fin(p) || p <= 0) return; addAlert({ticker: t, price: p, cond: $('alC').value, note: $('alN').value}); closeModal(); S.tab = 'alerts'; renderSide(); } };
}
function renderAlerts(body) {
  const act = AL.filter(a => a.active).length, trg = AL.filter(a => a.trig).length, mine = AL.filter(a => a.ticker === RT.ticker).length;
  const row = a => { const st = a.trig ? 'trig' : a.active ? 'act' : 'off'; return `<div class="arow ${st}" data-id="${a.id}" data-t="${esc(a.ticker)}"><span class="ai">${svg('bell', 16)}</span><div class="am"><b>${esc(short(a.ticker))} · ${COND[a.cond]} ${fmtP(a.price)}</b><em>${a.trig ? `Triggered ${new Date(a.trig.t * 1000).toISOString().slice(0, 10)} at ${fmtP(a.trig.p)}` : a.active ? `Active since ${new Date(a.created * 1000).toISOString().slice(0, 10)}` : 'Paused'}${a.note ? ' · ' + esc(a.note) : ''}</em></div><div class="aa">${!a.trig ? `<button data-act="pause" title="${a.active ? 'Pause' : 'Resume'}">${svg(a.active ? 'pause' : 'play', 14)}</button>` : `<button data-act="reset" title="Re-arm">${svg('replay', 14)}</button>`}<button data-act="del" title="Delete">${svg('trash', 14)}</button></div></div>`; };
  const sorted = [...AL].sort((x, y) => (x.trig ? 1 : 0) - (y.trig ? 1 : 0) || (x.ticker === RT.ticker ? -1 : 0) - (y.ticker === RT.ticker ? -1 : 0));
  body.innerHTML = `<div class="th"><b>Alerts</b><span class="sp"></span><span class="tag o">${act} active · ${trg} triggered</span></div>
    <button class="btn on" id="alNew" style="width:100%;margin:4px 0 8px">＋ Create alert on ${esc(short(RT.ticker))}</button>
    <div class="sub" style="font-size:11.5px;margin-bottom:6px">Tip: hover the chart and click the <b>＋</b> at the price axis, right-click → <i>Add alert</i>, or use the bell tool (Alt+A). Drag an alert line to move it. Enter <b>Replay</b> to watch alerts fire bar by bar.</div>
    <label class="chk"><input type="checkbox" id="alSnd" ${S.sound ? 'checked' : ''}> Play a sound when an alert fires</label>
    ${sorted.length ? sorted.map(row).join('') : '<div class="sub" style="padding:14px 4px">No alerts yet.</div>'}
    ${SIM.length ? `<div class="gh">REPLAY-ONLY ALERTS</div>${SIM.map(a => `<div class="arow act sim" data-id="${a.id}" data-t="${esc(a.ticker)}"><span class="ai">${svg('bell', 16)}</span><div class="am"><b>${esc(alertText(a))}</b><em>replay only</em></div><div class="aa"><button data-act="del">${svg('trash', 14)}</button></div></div>`).join('')}` : ''}`;
  body.onclick = e => {
    if (e.target.closest('#alNew')) { openAlertDialog(last(D.ohlc[RT.ticker].c)); return; }
    const row = e.target.closest('.arow'); if (!row) return; const a = AL.find(x => x.id === row.dataset.id) || SIM.find(x => x.id === row.dataset.id), b = e.target.closest('button');
    if (b && a) { if (b.dataset.act === 'del') removeAlert(a.id); else if (b.dataset.act === 'pause') { a.active = !a.active; saveAlerts(); RT.aver++; dirty = true; renderSide(); } else if (b.dataset.act === 'reset') { a.trig = null; a.active = true; const bars = getBars(a.ticker, 'D'); a.created = bars[bars.length - 1].time; saveAlerts(); RT.aver++; dirty = true; renderSide(); } return; }
    if (a && a.ticker !== RT.ticker) selectTicker(a.ticker, false);
  };
  const sn = $('alSnd'); if (sn) sn.onchange = () => { S.sound = sn.checked; lsSet('hl-sound', S.sound); if (S.sound) beep(); };
}

/* =============================================================  I4. VOLUME PROFILE  */
const vpCache = new Map();
function vpCompute(i0, i1, rows, vaPct) {
  const v = RT.view; i0 = Math.max(0, Math.round(i0)); i1 = Math.min(v.length - 1, Math.round(i1)); if (i1 <= i0) return null;
  const key = [i0, i1, rows, vaPct, v.length, RT.ticker, S.tf].join('|'); if (vpCache.has(key)) return vpCache.get(key);
  let lo = Infinity, hi = -Infinity, tot = 0;
  for (let i = i0; i <= i1; i++) { lo = Math.min(lo, v[i].low); hi = Math.max(hi, v[i].high); tot += v[i].volume; }
  if (!(tot > 0) || !(hi > lo)) { vpCache.set(key, null); return null; }
  const step = (hi - lo) / rows, up = new Array(rows).fill(0), dn = new Array(rows).fill(0);
  for (let i = i0; i <= i1; i++) {
    const b = v[i]; if (!(b.volume > 0)) continue; const arr = b.close >= b.open ? up : dn, a = Math.min(rows - 1, Math.floor((b.low - lo) / step)), z = Math.min(rows - 1, Math.floor((b.high - lo) / step));
    if (z <= a) { arr[a] += b.volume; continue; } const span = b.high - b.low;
    for (let r = a; r <= z; r++) { const r0 = Math.max(b.low, lo + r * step), r1 = Math.min(b.high, lo + (r + 1) * step); arr[r] += b.volume * Math.max(0, r1 - r0) / span; }
  }
  const tv = up.map((x, k) => x + dn[k]); let poc = 0; tv.forEach((x, k) => { if (x > tv[poc]) poc = k; });
  let lowI = poc, highI = poc, acc = tv[poc]; const target = tot * vaPct / 100;
  while (acc < target && (lowI > 0 || highI < rows - 1)) { const nu = highI < rows - 1 ? tv[highI + 1] : -1, nd = lowI > 0 ? tv[lowI - 1] : -1; if (nu >= nd) { highI++; acc += tv[highI]; } else { lowI--; acc += tv[lowI]; } }
  const res = {lo, hi, step, rows, up, dn, tv, poc, lowI, highI, max: Math.max(...tv), pocP: lo + (poc + .5) * step, vah: lo + (highI + 1) * step, val: lo + lowI * step, tot};
  if (vpCache.size > 80) vpCache.clear(); vpCache.set(key, res); return res;
}
function paintVP(ctx, vp, x0, dir, maxLen, cols) {
  for (let r = 0; r < vp.rows; r++) {
    const ya = Yc(vp.lo + (r + 1) * vp.step), yb = Yc(vp.lo + r * vp.step); if (ya == null || yb == null) continue; const h = Math.max(1, yb - ya - 1), inVA = r >= vp.lowI && r <= vp.highI;
    const lu = vp.up[r] / vp.max * maxLen, ld = vp.dn[r] / vp.max * maxLen; ctx.globalAlpha = inVA ? .66 : .3;
    ctx.fillStyle = cols[0]; ctx.fillRect(dir > 0 ? x0 : x0 - lu, ya, lu, h);
    ctx.fillStyle = cols[1]; ctx.fillRect(dir > 0 ? x0 + lu : x0 - lu - ld, ya, ld, h);
  }
  ctx.globalAlpha = 1;
}
function vpLines(ctx, vp, xa, xb, cols, withLabels) {
  const L = (price, col, dash, name, w) => { const y = Yc(price); if (y == null) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.restore(); if (withLabels) lbl(ctx, `${name} ${fmtP(price)}`, xa + 4, y - (name === 'VAL' ? -12 : 12), col, null, 'left'); };
  L(vp.vah, cols[1], [3, 4], 'VAH', 1); L(vp.val, cols[1], [3, 4], 'VAL', 1); L(vp.pocP, cols[2], [], 'POC', 1.6);
}
function drawVP(ctx, box) {
  const vr = chart.timeScale().getVisibleLogicalRange(); if (!vr) return;
  S.inds.forEach(ind => {
    if (ind.key !== 'vpvr' || !ind.vis) return; const p = ind.p, vp = vpCompute(vr.from, vr.to, Math.round(p.rows), p.va), el = document.querySelector(`.lgr[data-id="${ind.id}"] [data-vals]`);
    if (!vp) { if (el && el.dataset.s !== 'na') { el.dataset.s = 'na'; el.innerHTML = '<i>no volume data in view</i>'; } return; }
    const maxLen = box.w * p.w / 100, right = p.side >= 1; paintVP(ctx, vp, right ? box.w : 0, right ? -1 : 1, maxLen, ind.colors); vpLines(ctx, vp, 0, box.w, ind.colors, true);
    if (el) { const s = `POC ${fmtP(vp.pocP)} · VAH ${fmtP(vp.vah)} · VAL ${fmtP(vp.val)}`; if (el.dataset.s !== s) { el.dataset.s = s; el.innerHTML = `<b style="color:${ind.colors[2]}">POC ${fmtP(vp.pocP)}</b> <b style="color:${ind.colors[1]}">VAH ${fmtP(vp.vah)} · VAL ${fmtP(vp.val)}</b>`; } }
  });
}
function vpBox(d) { const t0 = Math.min(d.pts[0].t, d.pts[1].t), t1 = Math.max(d.pts[0].t, d.pts[1].t), i0 = logicalOf(t0), i1 = logicalOf(t1), vp = vpCompute(i0, i1, d.rows || 48, d.va || 70); return {t0, t1, vp, x0: X(t0), x1: X(t1)}; }
function drawVPFix(ctx, d, box, sel) {
  const b = vpBox(d); if (b.x0 == null || b.x1 == null) return; const vp = b.vp;
  if (!vp) { ctx.strokeStyle = OR; ctx.setLineDash([4, 4]); ctx.strokeRect(b.x0, 4, b.x1 - b.x0, box.h - 8); ctx.setLineDash([]); lbl(ctx, 'no volume data in range', b.x0 + 6, 18, OR, null, 'left'); return; }
  const ya = Yc(vp.hi), yb = Yc(vp.lo), cols = [BL, OR, DN];
  ctx.fillStyle = 'rgba(109,182,255,.07)'; const va = Yc(vp.vah), vb = Yc(vp.val); if (va != null && vb != null) ctx.fillRect(b.x0, va, b.x1 - b.x0, vb - va);
  ctx.strokeStyle = sel ? OR : 'rgba(109,182,255,.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); if (ya != null && yb != null) ctx.strokeRect(b.x0, ya, b.x1 - b.x0, yb - ya); ctx.setLineDash([]);
  paintVP(ctx, vp, b.x0, 1, (b.x1 - b.x0) * .7, cols); vpLines(ctx, vp, b.x0, b.x1, cols, true);
}

function drawTargets(ctx, box) {
  if (!S.showTargets || !aheadBars()) return; const ti = targetInfo(); if (!ti || !RT.view.length) return;
  const n = RT.view.length - 1, ahead = aheadBars(), lastB = RT.view[n], x0 = X(lastB.time), x1 = chart.timeScale().logicalToCoordinate(n + ahead), y0 = Yc(lastB.close);
  if (x0 == null || x1 == null || y0 == null) return; const yH = Yc(ti.high), yM = Yc(ti.mean), yL = Yc(ti.low); if (yH == null || yM == null || yL == null) return;
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, yH); ctx.lineTo(x1, yL); ctx.closePath(); ctx.fillStyle = 'rgba(43,181,154,.10)'; ctx.fill();
  [[yH, '#6FF0A6', [6, 4], 'High', ti.high], [yM, '#FFD166', [], 'Average', ti.mean], [yL, '#FF6B7A', [6, 4], 'Low', ti.low]].forEach(([y, col, dash, nm, val]) => {
    ctx.strokeStyle = col; ctx.lineWidth = nm === 'Average' ? 2 : 1.4; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x1, y, 3.5, 0, 7); ctx.fill(); const up = val / ti.px - 1; lbl(ctx, `${nm} ${fmtP(val)} (${up >= 0 ? '+' : ''}${(up * 100).toFixed(1)}%)`, Math.min(x1 - 8, box.w - 6), y, col, null, 'right'); });
  ctx.restore();
}

/* =============================================================  I5. INTRADAY + LIVE  */
async function setTf(tf) {
  if (isIntra(tf)) {
    hint('Loading ' + TFN[tf][0] + ' bars…');
    try { await fetchIntra(RT.ticker, tf); } catch (err) { hint(''); toast('Intraday unavailable', err.message + '. Start  python serve_dashboard.py  and open http://localhost:8765', 'info'); updateHeader(); return false; }
    hint('');
  }
  S.tf = tf; replayExit(); RT.bars = getBars(RT.ticker, tf); applyAll(false); zoomLast(defZoom()); persist(); updateHeader(); renderSide(); return true;
}
let liveTimer = null;
function refreshBars(bars) { const vr = chart.timeScale().getVisibleLogicalRange(), atEnd = !vr || vr.to >= RT.view.length - 1; RT.bars = bars; applyAll(false); if (atEnd) chart.timeScale().scrollToRealTime(); else if (vr) chart.timeScale().setVisibleLogicalRange({from: vr.from, to: vr.to}); }
function mergeToday(b5) {            // fold today's intraday bars into the last daily bar so the daily chart moves with the market
  if (!b5.length) return; const dayOf = t => new Date(t * 1000).toISOString().slice(0, 10), lastDay = dayOf(b5[b5.length - 1].time), sess = b5.filter(x => dayOf(x.time) === lastDay);
  const exNow = Date.now() / 1000 + (b5.offset || 0), open = exNow - b5[b5.length - 1].time < 20 * 60;       // the exchange clock is within 20 min of the last bar: the market is trading
  const dl = barsCache[RT.ticker + 'D']; if (!open && dl && dl.length && dl[dl.length - 1].time >= Date.UTC(+lastDay.slice(0, 4), +lastDay.slice(5, 7) - 1, +lastDay.slice(8, 10)) / 1000) return;   // closed: keep the official daily close
  const daily = barsCache[RT.ticker + 'D']; if (!daily || !daily.length) return; const lb = daily[daily.length - 1], t0 = Date.UTC(+lastDay.slice(0, 4), +lastDay.slice(5, 7) - 1, +lastDay.slice(8, 10)) / 1000, vol = sess.reduce((a, x) => a + x.volume, 0);
  const bar = {time: t0, open: sess[0].open, high: Math.max(...sess.map(x => x.high)), low: Math.min(...sess.map(x => x.low)), close: sess[sess.length - 1].close, volume: vol > 0 ? vol : (lb.time === t0 ? lb.volume : 0)};
  if (lb.time === t0) daily[daily.length - 1] = bar; else if (t0 > lb.time) daily.push(bar); else return;
  delete barsCache[RT.ticker + 'W']; delete barsCache[RT.ticker + 'M']; refreshBars(daily);
}
async function liveAlerts() {        // while Live is on, active alerts are checked against the newest 1-minute bars
  const act = AL.filter(a => a.active && !a.trig); if (!act.length) return; let fired = false;
  for (const t of [...new Set(act.map(a => a.ticker))].slice(0, 8)) {
    const bars = await fetchIntra(t, '1m', true).catch(() => null); if (!bars) continue;
    for (const a of act.filter(x => x.ticker === t && x.active && !x.trig)) for (let k = Math.max(1, bars.length - 3); k < bars.length; k++) {
      const b = bars[k]; if (condHit(a.cond, a.price, b, bars[k - 1])) { a.trig = {t: b.time, p: (a.cond === 'gt' || a.cond === 'lt') ? b.close : a.price}; a.active = false; fired = true; toast('Alert triggered (live)', `${alertText(a)} · ${new Date(b.time * 1000).toISOString().slice(11, 16)} · ${fmtP(b.close)}`, 'alert'); beep(); break; }
    }
  }
  if (fired) { saveAlerts(); RT.aver++; dirty = true; renderSide(); }
}
async function liveTick() {
  if (R.on || document.hidden || !S.live) return;
  try {
    if (isIntra(S.tf)) { const old = RT.bars[RT.bars.length - 1], bars = await fetchIntra(RT.ticker, S.tf, true), nb = bars[bars.length - 1]; if (nb && (!old || nb.time !== old.time || nb.close !== old.close || bars.length !== RT.bars.length)) refreshBars(bars); }
    else if (S.tf === 'D') mergeToday(await fetchIntra(RT.ticker, '5m', true));
    await liveAlerts(); const el = $('wsClock'); if (el) el.dataset.live = new Date().toISOString().slice(11, 19);
  } catch (e) { hint('Live update failed: ' + e.message, 4000); }
}
function setLive(on) { S.live = on; clearInterval(liveTimer); if (on) { liveTick(); liveTimer = setInterval(liveTick, 20000); toast('Live mode on', 'Refreshing every 20 s while this page is open. Alerts are checked against fresh 1-minute bars.', 'info'); } updateHeader(); }

/* =============================================================  J. RENDER + WIRING  */
function loadTicker(t) {
  const wantTf = S.tf; if (isIntra(S.tf) && !INTRA[t + '|' + S.tf]) S.tf = 'D';                // intraday bars for a new symbol are fetched below
  RT.ticker = t; RT.bars = getBars(t, S.tf); loadDr(t); if (R.on) { R.on = false; R.alerts = null; SIM = []; replayPlay(false); }
  applyAll(!built); built = true; zoomLast(defZoom()); updateHeader(); buildLegends(); updateLegend(RT.view.length - 1); renderSide(); replayBar(); persist();
  if (isIntra(wantTf) && S.tf === 'D') setTf(wantTf);
}
function wire() {
  $('wsTools').innerHTML = TOOLS.map(([k, t]) => `<button class="tb ${k === 'cursor' ? 'on' : ''}" data-tool="${k}" title="${t}">${svg(k, 19)}</button>`).join('') + '<span class="hsep"></span>'
    + `<button class="tb" id="tMag" title="Magnet: snap to OHLC">${svg('magnet', 19)}</button><button class="tb" id="tLock" title="Lock all drawings">${svg('lock', 19)}</button><button class="tb" id="tHide" title="Hide drawings">${svg('eye', 19)}</button><button class="tb" id="tClear" title="Remove all drawings">${svg('trash', 19)}</button>`;
  $('wsTools').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.id === 'tMag') { S.magnet = !S.magnet; b.classList.toggle('on', S.magnet); chart.applyOptions({crosshair: {mode: S.magnet ? LW.CrosshairMode.Magnet : LW.CrosshairMode.Normal}}); }
    else if (b.id === 'tLock') { S.lock = !S.lock; b.classList.toggle('on', S.lock); hint(S.lock ? 'Drawings locked: new drawings disabled' : '', 1500); }
    else if (b.id === 'tHide') { S.hide = !S.hide; b.classList.toggle('on', S.hide); b.innerHTML = svg(S.hide ? 'eyeoff' : 'eye', 19); RT.dver++; dirty = true; }
    else if (b.id === 'tClear') { if (DR.length && confirm('Remove all drawings for ' + short(RT.ticker) + '?')) { const before = snap(); DR = []; S.sel = null; commit(before); } } };
  // timeframe, type, templates, compare
  $('tfSeg').onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.v !== S.tf) setTf(b.dataset.v); };
  const dd = (btn, menu, fill) => { $(btn).onclick = e => { e.stopPropagation(); document.querySelectorAll('.ddm.on').forEach(m => { if (m.id !== menu) m.classList.remove('on'); }); const m = $(menu); if (!m.classList.contains('on')) fill(m); m.classList.toggle('on'); }; };
  dd('bType', 'mType', m => { m.innerHTML = TYPES.map(([k, n]) => `<button data-k="${k}" class="${k === S.type ? 'on' : ''}">${n}</button>`).join(''); m.onclick = e => { const b = e.target.closest('button'); if (b) { S.type = b.dataset.k; m.classList.remove('on'); applyAll(true); persist(); } }; });
  dd('bTpl', 'mTpl', m => { m.innerHTML = Object.keys(TEMPLATES).map(n => `<button data-k="${esc(n)}">${esc(n)}</button>`).join(''); m.onclick = e => { const b = e.target.closest('button'); if (b) { S.inds = TEMPLATES[b.dataset.k].map(a => mkInd(a[0], a[1])); m.classList.remove('on'); persist(); applyAll(true); renderSide(); } }; });
  dd('bCmp', 'mCmp', m => { m.innerHTML = '<div class="gh">COMPARE WITH…</div>' + ALL.filter(t => t !== RT.ticker).map(t => `<button data-k="${esc(t)}">${esc(short(t))} <em>${esc(t)}</em></button>`).join(''); m.onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.k) { if (S.cmp.length < 4 && !S.cmp.includes(b.dataset.k)) S.cmp.push(b.dataset.k); S.scale = 'pct'; m.classList.remove('on'); applyAll(true); renderSide(); } }; });
  document.addEventListener('click', () => document.querySelectorAll('.ddm.on').forEach(m => m.classList.remove('on')));
  $('bLive').onclick = async () => { if (!HL.live || (!HL.live.ok && !(await HL.live.probe()))) { toast('Live needs the local server', 'Run  python serve_dashboard.py  and open http://localhost:8765', 'info'); updateHeader(); return; } setLive(!S.live); };
  window.addEventListener('hl-live', () => updateHeader());
  $('bInd').onclick = openIndicators; $('bMine').onclick = () => { if (HL.mine) HL.mine.openAdd(RT.ticker, last(D.ohlc[RT.ticker].c)); };
  $('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
  $('bReplay').onclick = () => { if (R.on || R.picking) replayExit(); else { R.picking = true; hint('Click a bar on the chart to start the replay'); replayBar(); updateHeader(); } };
  $('rbar').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.s) { R.speed = +b.dataset.s; if (R.playing) replayPlay(true); replayBar(); return; } const a = b.dataset.r; if (a === 'play') replayPlay(!R.playing); else if (a === 'step') replayStep(); else if (a === 'exit' || a === 'cancel') replayExit(); else if (a === 'pick') { replayPlay(false); R.on = false; R.picking = true; applyAll(false); replayBar(); } };
  $('bUndo').onclick = undo; $('bRedo').onclick = redo;
  $('bShot').onclick = () => { const a = chart.takeScreenshot(true), c = document.createElement('canvas'); c.width = a.width; c.height = a.height; const x = c.getContext('2d'); x.fillStyle = '#0a1a44'; x.fillRect(0, 0, c.width, c.height); x.drawImage(a, 0, 0); x.drawImage($('ov'), 0, 0, a.width, a.height); x.font = '600 12px monospace'; x.fillStyle = 'rgba(232,240,255,.6)'; x.fillText('The Half Layer · Developed by Anish Luitel', 12, c.height - 10); c.toBlob(b => { const u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = `${RT.ticker}_${S.tf}_chart.png`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); }); };
  { const im = document.querySelector('.sidesig img'), br = document.querySelector('.brand img'); if (im && br) im.src = br.src; }
  $('bFull').onclick = () => { const w = $('ws'); if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (w.requestFullscreen || w.webkitRequestFullscreen || (() => {})).call(w); };
  document.addEventListener('fullscreenchange', () => { setTimeout(() => { dirty = true; sizeOverlay(); }, 150); });
  $('rngBtns').onclick = e => { const b = e.target.closest('button'); if (b) setRange(b.dataset.r); };
  $('sPct').onclick = () => { S.scale = S.scale === 'pct' ? 'auto' : 'pct'; applyScale(); }; $('sLog').onclick = () => { S.scale = S.scale === 'log' ? 'auto' : 'log'; applyScale(); }; $('sAuto').onclick = () => { S.autoscale = !S.autoscale; applyScale(); };
  $('sTabs').onclick = e => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.v; renderSide(); } };
  // drawing interaction (capture phase so the chart never pans while a tool is active)
  const w = $('lwwrap'); ['mousedown'].forEach(ev => w.addEventListener(ev, onDown, true)); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  $('dtool').onclick = e => { const d = DR.find(x => x.id === S.sel), b = e.target.closest('button'); if (!d || !b) return; const before = snap(); if (b.dataset.c) d.color = b.dataset.c; else if (b.dataset.w) d.w = +b.dataset.w; else if (b.dataset.act === 'dash') d.dash = !d.dash; else if (b.dataset.act === 'lock') d.locked = !d.locked; else if (b.dataset.act === 'del') { DR = DR.filter(x => x.id !== d.id); S.sel = null; } $('dtool').dataset.for = ''; commit(before); };
  document.addEventListener('keydown', e => {
    const v = $('v-explorer'); if (!v || !v.classList.contains('on')) return; const tag = (document.activeElement || {}).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape') { if ($('modal').classList.contains('on')) closeModal(); else if (draft) { draft = null; RT.dver++; dirty = true; } else if (R.picking || R.on) replayExit(); else if (S.tool !== 'cursor') setTool('cursor'); else if (S.sel) { S.sel = null; RT.dver++; renderSide(); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); const before = snap(); DR = DR.filter(x => x.id !== S.sel); S.sel = null; commit(before); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.altKey) { const m = {t: 'trend', y: 'ray', h: 'hline', v: 'vline', r: 'rect', f: 'fib', m: 'measure', n: 'text', a: 'alert', p: 'vpfix'}[e.key.toLowerCase()]; if (m) { e.preventDefault(); setTool(m); } }
    else if (R.on && e.key === ' ') { e.preventDefault(); replayPlay(!R.playing); } else if (R.on && e.key === 'ArrowRight') replayStep();
  });
  $('lwwrap').addEventListener('contextmenu', e => { const p = wrapXY(e); if (!main || !inPane(p)) return; e.preventDefault(); e.stopPropagation(); showCtx(p, main.coordinateToPrice(p.y)); });
  $('aplus').onclick = e => { e.stopPropagation(); const pr = main.coordinateToPrice(+$('aplus').dataset.y); if (pr != null) { $('aplus').style.display = 'none'; openAlertDialog(pr); } };
  setInterval(() => { const c = $('wsClock'); if (c) c.textContent = new Date().toISOString().slice(11, 19) + ' UTC'; }, 1000);
}
let wired = false;
function render() {
  const t = ST.sel; if (!BY[t]) return;
  if (!chart) { ensureChart(); wire(); const fired = scanAlerts(); if (fired.length) setTimeout(() => { toast('Alerts triggered', fired.map(alertText).join('  ·  '), 'alert'); renderSide(); }, 700); }
  if (RT.ticker !== t || !built) { loadTicker(t); } else { renderSide(); updateHeader(); dirty = true; chart.resize && 0; }
  setTimeout(() => { dirty = true; }, 50);
}
HL.pro = {S, R, RT, REG, get chart() { return chart; }, get main() { return main; }, get DR() { return DR; }, get AL() { return AL; }, get SIM() { return SIM; }, setTool, addInd, applyAll, replayStep, addAlert, scanAlerts, computeTech, vpCompute, toast, pivotSets, condHit};
})();
