/* The Half Layer – save your holdings, alerts, drawings and layout outside the browser.   Developed by Anish Luitel
   1) Google Drive (needs your own OAuth Client ID) · 2) a folder on your computer via the local server · 3) a backup file. */
(() => {
'use strict';
const HL = window.HL; if (!HL || !HL.live || !HL.modal) return;
const L = HL.live, $ = id => document.getElementById(id), esc = HL.esc;
const SKIP = new Set(['hl-gclient', 'hl-gdrive-folder', 'hl-server-token', 'hl-sync-auto-drive', 'hl-sync-auto-folder', 'hl-sync-last']);
const ls = {get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }};
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/* ---------------- what gets saved ---------------- */
function collect() { const keys = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('hl-') && !SKIP.has(k)) keys[k] = localStorage.getItem(k); } } catch (e) {} return keys; }
const snapshot = () => ({app: 'the-half-layer', author: 'Anish Luitel', version: 1, savedAt: new Date().toISOString(), universe: HL.M.universe, keys: collect()});
function applyState(obj) {
  if (!obj || typeof obj.keys !== 'object') throw new Error('This file is not a Half Layer backup');
  try { Object.keys(collect()).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  Object.entries(obj.keys).forEach(([k, v]) => { if (k.startsWith('hl-') && !SKIP.has(k)) ls.set(k, v); });
}
const summary = o => { const k = (o && o.keys) || {}, n = x => { try { return JSON.parse(k[x] || '[]').length; } catch (e) { return 0; } }; return `${n('hl-holdings-v1')} holdings, ${n('hl-alerts-v1')} alerts, ${Object.keys(k).filter(x => x.startsWith('hl-dr-')).length} drawing sets`; };

/* ---------------- Google Drive ---------------- */
const G = {tok: null, exp: 0, client: null, cid: null, cb: null};
const cid = () => ls.get('hl-gclient') || '';
const loadGIS = () => new Promise((res, rej) => { if (window.google && google.accounts && google.accounts.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('Could not load Google sign-in (are you online?)')); document.head.appendChild(s); });
async function gToken(interactive) {
  if (G.tok && Date.now() < G.exp) return G.tok;
  if (!cid()) throw new Error('Enter your Google OAuth Client ID first');
  await loadGIS();
  return new Promise((res, rej) => {
    if (!G.client || G.cid !== cid()) {
      G.cid = cid();
      G.client = google.accounts.oauth2.initTokenClient({client_id: G.cid, scope: 'https://www.googleapis.com/auth/drive.file',
        callback: r => { if (r.error) return G.cb.rej(new Error(r.error_description || r.error)); G.tok = r.access_token; G.exp = Date.now() + ((r.expires_in || 3600) - 60) * 1000; G.cb.res(G.tok); },
        error_callback: e => G.cb.rej(new Error(e.message || e.type || 'sign-in cancelled'))});
    }
    G.cb = {res, rej}; G.client.requestAccessToken({prompt: interactive ? 'consent' : ''});
  });
}
async function gf(url, opt = {}) { const t = await gToken(false), r = await fetch(url, {...opt, headers: {Authorization: 'Bearer ' + t, ...(opt.headers || {})}}); if (!r.ok) throw new Error(`Google Drive ${r.status}: ${(await r.text()).slice(0, 160)}`); return r; }
const Q = s => encodeURIComponent(s);
async function folderId() {
  let id = ls.get('hl-gdrive-folder'); if (id) return id;
  let j = await (await gf(`https://www.googleapis.com/drive/v3/files?q=${Q("mimeType='application/vnd.google-apps.folder' and name='The Half Layer' and trashed=false")}&fields=files(id,name)`)).json();
  if (j.files && j.files[0]) id = j.files[0].id;
  else { j = await (await gf('https://www.googleapis.com/drive/v3/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: 'The Half Layer', mimeType: 'application/vnd.google-apps.folder'})})).json(); id = j.id; }
  ls.set('hl-gdrive-folder', id); return id;
}
async function findFile(folder) { const j = await (await gf(`https://www.googleapis.com/drive/v3/files?q=${Q(`name='hl_state.json' and '${folder}' in parents and trashed=false`)}&fields=files(id,name,modifiedTime)`)).json(); return j.files && j.files[0]; }
async function driveSave() {
  const folder = await folderId(), f = await findFile(folder), body = JSON.stringify(snapshot());
  await driveWrite(folder, f, body);
  const chk = await findFile(folder); if (!chk) throw new Error('Drive did not confirm the file after saving'); return chk;
}
async function driveWrite(folder, f, body) {
  if (f) await gf(`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=media&fields=id,modifiedTime`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body});
  else { const b = 'hl' + Math.random().toString(36).slice(2), meta = {name: 'hl_state.json', parents: [folder], mimeType: 'application/json'};
    await gf('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', {method: 'POST', headers: {'Content-Type': `multipart/related; boundary=${b}`}, body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`}); }
}
async function driveLoad() { const folder = await folderId(), f = await findFile(folder); if (!f) throw new Error('No saved file in your Drive yet: use "Save to Drive" first'); return (await gf(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json(); }

/* ---------------- folder on this computer (through the local server) ---------------- */
async function folderSave() { if (!L.ok && !(await L.probe())) throw new Error('the local server is not running'); if (!L.needToken()) throw new Error('token needed'); await L.api('/api/state', {method: 'POST', body: snapshot()}); }
async function folderLoad() { if (!L.ok && !(await L.probe())) throw new Error('the local server is not running'); const j = await L.api('/api/state'); if (!j.exists) throw new Error('No saved state in the folder yet'); return j.state; }

/* ---------------- auto-save + status ---------------- */
const auto = {drive: ls.get('hl-sync-auto-drive') === '1', folder: ls.get('hl-sync-auto-folder') === '1'};
let timer = null, pending = false, status = {k: 'off', t: ''};
const BTN = '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.500 18z"/></svg>';
$('hTools').insertAdjacentHTML('beforeend', `<button class="hbtn" id="hSync" title="Save your portfolio, alerts and layout to Google Drive or a folder">${BTN}<span>Sync</span><i class="dot"></i></button>`);
function paint() { const b = $('hSync'); if (!b) return; b.dataset.k = status.k; b.title = status.t || 'Save your portfolio, alerts and layout to Google Drive or a folder'; }
function setStatus(k, t) { status = {k, t}; paint(); const m = $('syMsg'); if (m) { m.textContent = t; m.className = 'sub ' + (k === 'err' ? 'neg' : k === 'ok' ? 'pos' : ''); } }
async function push() {
  pending = false; const jobs = [];
  if (auto.drive && G.tok) jobs.push(['Drive', driveSave]); else if (auto.drive) setStatus('err', 'Drive auto-save paused: reconnect (open Sync)');
  if (auto.folder && L.ok) jobs.push(['Folder', folderSave]);
  if (!jobs.length) return; setStatus('busy', 'Saving…');
  const res = await Promise.allSettled(jobs.map(j => j[1]()));
  const bad = res.map((r, i) => r.status === 'rejected' ? `${jobs[i][0]}: ${r.reason.message}` : null).filter(Boolean);
  if (bad.length) setStatus('err', bad.join(' · ')); else { const t = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}); ls.set('hl-sync-last', t); setStatus('ok', `Saved ${t} to ${jobs.map(j => j[0] === 'Drive' ? 'Google Drive' : 'the folder').join(' + ')}`); }
}
function dirty() { if (!auto.drive && !auto.folder) return; pending = true; setStatus('busy', 'Changes waiting to be saved…'); clearTimeout(timer); timer = setTimeout(push, 4000); }
try {                                                           // notice every change to hl-* storage keys
  const P = Storage.prototype, setI = P.setItem, remI = P.removeItem, mine = (o, k) => o === localStorage && typeof k === 'string' && k.startsWith('hl-') && !SKIP.has(k);
  P.setItem = function (k, v) { setI.call(this, k, v); if (mine(this, k)) dirty(); };
  P.removeItem = function (k) { remI.call(this, k); if (mine(this, k)) dirty(); };
} catch (e) {}
window.addEventListener('beforeunload', () => { if (pending) push(); });
setStatus(auto.drive || auto.folder ? 'idle' : 'off', auto.drive || auto.folder ? 'Auto-save is on' : '');

/* ---------------- dialog ---------------- */
function open() {
  const origin = location.protocol.startsWith('http') ? location.origin : 'http://localhost:8765', web = location.protocol.startsWith('http');
  const info = L.info || {};
  HL.modal(`<div class="mh"><b>Save &amp; sync</b><button class="tb" data-close>${X}</button></div><div class="gbody sync">
  <div class="sub" style="margin-bottom:8px">Your holdings, alerts, drawings and chart layout live in this browser. Pick where else to keep them. <span id="syMsg" class="sub"></span></div>

  <div class="sec" style="margin-top:6px;border:0;padding:0">1 · GOOGLE DRIVE</div>
  ${web ? '' : `<div class="pend" style="margin:6px 0">Google only allows sign-in from <b>http://localhost</b> or https, not from a file opened directly. Start <code>python serve_dashboard.py</code> and open <code>${origin}</code> first.</div>`}
  <div class="sub">Saves one small file, <code>hl_state.json</code>, in a <b>The Half Layer</b> folder of your own Drive. The app can only see files it creates itself.</div>
  <details class="how"><summary>One-time setup (3 minutes)</summary><ol>
    <li>Open <b>console.cloud.google.com</b> → create a project (any name).</li>
    <li><i>APIs &amp; Services → Library</i> → enable <b>Google Drive API</b>.</li>
    <li><i>OAuth consent screen</i> → External → add your own Google account under <b>Test users</b>.</li>
    <li><i>Credentials → Create credentials → OAuth client ID</i> → type <b>Web application</b> → under <i>Authorized JavaScript origins</i> add <code>${esc(origin)}</code>.</li>
    <li>Copy the <b>Client ID</b> (ends in <code>.apps.googleusercontent.com</code>) into the box below.</li></ol></details>
  <div class="srow"><input class="tinput" id="syCid" placeholder="123456-abc.apps.googleusercontent.com" value="${esc(cid())}" spellcheck="false"><button class="btn" id="syCidSave">Save ID</button></div>
  <div class="hbtns"><button class="btn on" id="syGcon">Connect</button><button class="btn" id="syGsave">Save to Drive</button><button class="btn" id="syGload">Load from Drive</button><button class="btn" id="syGoff">Disconnect</button></div>
  <label class="chk"><input type="checkbox" id="syGauto" ${auto.drive ? 'checked' : ''}> Auto-save to Drive a few seconds after every change</label>

  <div class="sec">2 · A FOLDER ON THIS COMPUTER</div>
  <div class="sub">${L.ok ? `Through the local server: <code>${esc(info.state_dir || '')}</code>` : 'Needs the local server (<code>python serve_dashboard.py</code>).'} Start it with <code>--state-dir "…/Google Drive/My Drive/TheHalfLayer"</code> and Google Drive for desktop syncs the file to your Drive, with no sign-in or setup.</div>
  <div class="hbtns"><button class="btn" id="syFsave">Save to folder</button><button class="btn" id="syFload">Load from folder</button></div>
  <label class="chk"><input type="checkbox" id="syFauto" ${auto.folder ? 'checked' : ''}> Auto-save to the folder after every change</label>

  <div class="sec">3 · BACKUP FILE</div>
  <div class="sub">Works anywhere, no server and no sign-in.</div>
  <div class="hbtns"><button class="btn" id="syDl">Download backup</button><label class="btn filebtn">Restore from file<input type="file" id="syUp" accept=".json,application/json" hidden></label></div>
  </div>`, onClick);
  const m = $('syMsg'); if (m && status.t) m.textContent = status.t;
}
async function run(label, fn, kind) {
  setStatus('busy', label + '…');
  try { const r = await fn(); if (kind === 'conn') setStatus('conn', 'Connected to Google. Nothing is saved yet: click “Save to Drive”.'); else if (kind === 'drive') setStatus('ok', `Saved to Drive: The Half Layer / hl_state.json · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`); else setStatus('ok', label + ': done'); return r; }
  catch (e) { setStatus('err', label + ' failed: ' + e.message); }
}
function confirmLoad(obj, from) { if (!obj) return; if (window.confirm(`Load from ${from}?\n\nThis replaces what is in this browser with: ${summary(obj)}.\n(saved ${obj.savedAt || 'earlier'})`)) { applyState(obj); location.reload(); } }
function onClick(e) {
  const id = (e.target.closest('button, label') || {}).id; if (!id) return;
  if (id === 'syCidSave') { ls.set('hl-gclient', $('syCid').value.trim()); G.tok = null; setStatus('ok', 'Client ID saved'); }
  else if (id === 'syGcon') run('Connecting to Google', async () => { ls.set('hl-gclient', $('syCid').value.trim()); await gToken(true); await folderId(); }, 'conn');
  else if (id === 'syGsave') run('Saving to Drive', async () => { await gToken(false).catch(() => gToken(true)); await driveSave(); }, 'drive');
  else if (id === 'syGload') run('Loading from Drive', async () => { await gToken(false).catch(() => gToken(true)); return driveLoad(); }).then(o => confirmLoad(o, 'Google Drive'));
  else if (id === 'syGoff') { if (G.tok && window.google && google.accounts) try { google.accounts.oauth2.revoke(G.tok); } catch (e) {} G.tok = null; auto.drive = false; ls.set('hl-sync-auto-drive', '0'); const c = $('syGauto'); if (c) c.checked = false; setStatus('off', 'Disconnected from Google'); }
  else if (id === 'syFsave') run('Saving to folder', folderSave);
  else if (id === 'syFload') run('Loading from folder', folderLoad).then(o => confirmLoad(o, 'the folder'));
  else if (id === 'syDl') { const u = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 1)], {type: 'application/json'})), a = document.createElement('a'); a.href = u; a.download = 'the-half-layer-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); setStatus('ok', 'Backup downloaded'); }
  else if (id === 'syGauto') { auto.drive = $('syGauto').checked; ls.set('hl-sync-auto-drive', auto.drive ? '1' : '0'); if (auto.drive && !G.tok) run('Connecting to Google', async () => { await gToken(true); await folderId(); }, 'conn').then(() => { dirty(); }); else if (auto.drive) dirty(); }
  else if (id === 'syFauto') { auto.folder = $('syFauto').checked; ls.set('hl-sync-auto-folder', auto.folder ? '1' : '0'); if (auto.folder) L.probe().then(() => dirty()); }
}
document.addEventListener('change', e => { if (e.target && e.target.id === 'syUp') { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { confirmLoad(JSON.parse(String(r.result)), 'the backup file'); } catch (err) { setStatus('err', 'Not a valid backup: ' + err.message); } }; r.readAsText(f); e.target.value = ''; } });
$('hSync').onclick = open;
HL.sync = {snapshot, applyState, collect, driveSave, driveLoad, folderSave, folderLoad, open};
})();
