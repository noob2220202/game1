/* =========================================================
 * engine/core/base.js — core platform for episode 2 (fork of ep1 js/core/base.js, ARCH_EP2 §4.3)
 *
 * Public API
 *   G.util                         ep1 helpers ($ $$ sleep clamp rand pick pad esc el normalize fmt* onTap hangulToQwerty)
 *   G.bus.on/off/emit              event bus (ep1)
 *   G.settings / G.saveSettings()  shared key 'haru-escape.settings.v1' (ep1 keys untouched; ep2 adds audioMode subs
 *                                  e1MyMsgs reduceShake reduceFlash)
 *   G.T(str) / G.NAME              the single text-expansion function (ARCH §1.1) — call it at RENDER time
 *   G.state · G.hasSave() · G.load() · G.save(immediate?) · G.resetSave() · G.memoryMode()
 *   G.flag(name[, value]) · G.pm(name) · G.vars(k[, v]) · G.hooks.set/has/call
 *   G.clock  now hm minutes toMin passed jump run start pause resume running freeze unfreeze segment tick
 *            (+ ep1 names stage() playMinutes(); core-internal onTick(fn), _scale(x))
 *   G.battery()
 *   ep1 fragment / mirroring API neutralised: G.fragCount() → 0, G.foundFragment() → false, G.mirroring() → false
 * Bus events emitted: 'flag' 'flag:<n>' (false→true) · 'flag:off' 'flag:off:<n>' (true→false) · 'var' {k,v,prev} ·
 *   'var:<k>' {v,prev} · 'settings' · 'visibility' {hidden} · 'tick' {dt, playMs} (250 ms, only while running) ·
 *   'clock:min' {hm, min, date, at} · 'clock:jump' {from, to, skipped} · 'state:load' · 'state:reset'
 * Flags set here: none (milestone flags are set by their owners; this file only re-anchors the clock on them).
 * Storage: 'haru-escape.ep2.save.v1' via CONFIG.SAVE_KEY (config.ep2.js) + shared settings key. Memory mode on failure.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const W = window;

  /* ---------------- utils (ep1, unchanged) ---------------- */
  const U = (G.util = G.util || {});
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.pad = (n, w) => String(n).padStart(w || 2, '0');
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** el('div.class#id', {attrs/on*}, children...) */
  U.el = function (tag, attrs, ...children) {
    const m = tag.match(/^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i);
    const node = document.createElement((m && m[1]) || 'div');
    if (attrs != null && (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object')) { children.unshift(attrs); attrs = null; }
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, v) => { if (t === '.') node.classList.add(v); else node.id = v; });
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    children.flat(Infinity).forEach((c) => { if (c == null || c === false) return; node.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return node;
  };
  U.normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '').normalize('NFC');
  U.fmtTime = (d) => `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
  U.fmtKTime = (d) => { const h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${U.pad(d.getMinutes())}`; };
  U.fmtDate = (d) => `${d.getFullYear()}.${U.pad(d.getMonth() + 1)}.${U.pad(d.getDate())}`;
  U.WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  U.fmtKDate = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${U.WEEK[d.getDay()]}요일`;
  U.onTap = function (node, fn) { node.addEventListener('click', (e) => { fn(e); }); return node; };
  const CHO = 'rRseEfaqQtTdwWczxvg';
  const JUNG = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l'];
  const JONG = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g'];
  U.hangulToQwerty = function (str) {
    let out = '';
    for (const ch of str) {
      const c = ch.charCodeAt(0) - 0xac00;
      if (c < 0 || c > 11171) { out += ch; continue; }
      out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
    }
    return out;
  };

  const warned = {};
  const dwarn = (k, ...a) => { if (!G.DEBUG || warned[k]) return; warned[k] = 1; console.warn(...a); };

  /* ---------------- event bus (ep1) ---------------- */
  const listeners = {};
  G.bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return () => G.bus.off(ev, fn); },
    off(ev, fn) { const l = listeners[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(ev, data) { (listeners[ev] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }); (listeners['*'] || []).slice().forEach((fn) => { try { fn(ev, data); } catch (e) {} }); },
  };

  /* ---------------- settings (shared with ep1) ---------------- */
  const SKEY = 'haru-escape.settings.v1';
  let prm = false;
  try { prm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  const EPD = (G.EP && G.EP.DEFAULTS) || {};
  G.settings = {
    sound: true, volume: 0.9, vibration: true, scares: EPD.scares || 'full', textSize: 1, voice: true, camera: true,
    audioMode: EPD.audioMode || 'ear', subs: EPD.subs || 'info', e1MyMsgs: EPD.e1MyMsgs !== false,
    reduceShake: prm, reduceFlash: prm,
  };
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
  G.saveSettings = function () { try { localStorage.setItem(SKEY, JSON.stringify(G.settings)); } catch (e) {} G.bus.emit('settings', G.settings); };

  /* ---------------- text tokens (ARCH §1.1) ---------------- */
  const cfg = () => W.CONFIG || {};
  const playerName = () => { const n = cfg().PLAYER_NAME; return (typeof n === 'string' && n.trim()) ? n.trim() : '하루'; };
  try { Object.defineProperty(G, 'NAME', { configurable: true, enumerable: true, get: playerName, set() { dwarn('NAME', '[base] G.NAME is derived from CONFIG.PLAYER_NAME'); } }); } catch (e) { G.NAME = playerName(); }
  function lastJong(s) { const c = s.charCodeAt(s.length - 1) - 0xac00; return c >= 0 && c <= 11171 ? c % 28 : -1; }
  function josa(name, j) {
    const jj = lastJong(name), B = jj > 0;
    switch (j) {
      case '야': case '아': return B ? '아' : '야';
      case '가': case '이가': return B ? '이' : '가';
      case '는': case '은': return B ? '은' : '는';
      case '를': case '을': return B ? '을' : '를';
      case '랑': return B ? '이랑' : '랑';
      case '이': return B ? '이' : '';
      case '의': return '의';
      case '와': case '과': return B ? '과' : '와';
      case '로': return B && jj !== 8 ? '으로' : '로';
      default: return '';
    }
  }
  function makerContact() {
    const c = cfg();
    const mc = typeof c.MAKER_CONTACT === 'string' ? c.MAKER_CONTACT.trim() : '';
    if (mc) return mc;
    const mn = typeof c.MAKER_NAME === 'string' ? c.MAKER_NAME.trim() : '';
    return !mn || mn === '너의 친구' ? '친구' : mn;
  }
  /** {MAKER_HON} — how a third person (the detective) names {MAKER}: '친구분' when makerContact() is the generic fallback
   *  (MAKER_CONTACT empty and MAKER_NAME empty or '너의 친구'), else '<contact> 님'. Both end in a final consonant, so the
   *  particle after the token never changes (DESIGN §4.0 token rule · §4.10.8′). */
  function makerHon() {
    const c = cfg();
    const mc = typeof c.MAKER_CONTACT === 'string' ? c.MAKER_CONTACT.trim() : '';
    const mn = typeof c.MAKER_NAME === 'string' ? c.MAKER_NAME.trim() : '';
    return !mc && (!mn || mn === '너의 친구') ? '친구분' : makerContact() + ' 님';
  }
  const TOKEN_OK = /^\{(q|s|n|m|k|min|off|ok|kind|predict|i|d|t)\}$/;
  G.T = function (s) {
    if (typeof s !== 'string' || s.indexOf('{') < 0) return s;
    const STR = G.e2 && G.e2.STR;
    s = s.replace(/\{\$([A-Za-z0-9_]+)\}/g, (m, k) => (STR && typeof STR[k] === 'string' ? STR[k] : (dwarn('T$' + k, '[G.T] unknown system string', m), m)));
    const names = (G.STORY && G.STORY.names) || {};
    s = s.replace(/\{([a-zA-Z]+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(names, k) && typeof names[k] === 'string' ? names[k] : m));
    s = s.replace(/\{(MAKER_CONTACT|MAKER_ID|MAKER_HON|MAKER)\}/g, (m, k) => {
      const c = cfg();
      if (k === 'MAKER_CONTACT') return makerContact();
      if (k === 'MAKER_HON') return makerHon();
      if (k === 'MAKER_ID') return typeof c.MAKER_HANDLE === 'string' ? c.MAKER_HANDLE.trim().replace(/^@/, '') : '';
      return typeof c.MAKER_NAME === 'string' && c.MAKER_NAME.trim() ? c.MAKER_NAME : '너의 친구';
    });
    const N = playerName();
    s = s.replace(/\{N(야|아|가|이가|는|은|를|을|랑|이|의|와|과|로)?\}/g, (m, j) => N + (j ? josa(N, j) : ''));
    if (G.DEBUG && s.indexOf('{') >= 0) {
      const left = s.match(/\{[^{}\s]{1,40}\}/g);
      if (left) left.forEach((t) => { if (!TOKEN_OK.test(t)) dwarn('T' + t, '[G.T] unknown token left as is:', t); });
    }
    return s;
  };

  /* ---------------- state & autosave ---------------- */
  const KEY = (W.CONFIG && W.CONFIG.SAVE_KEY) || 'haru-escape.save.v1';
  G.SAVE_KEY = KEY;
  let memory = false;
  function freshStage() { return { e2_finger: null, e2_dash: null, e2_fakeReply: false, e2_jimin: false, e2_phone: null }; }
  function fresh() {
    const st = {
      v: 1, ep: (G.EP && G.EP.n) || 2,
      flags: {}, vars: {}, playMs: 0, hintsUsed: 0, hints: {}, threads: {}, notifs: [], read: {},
      fragments: {},          // unused in ep2 (kept empty for ep1 loader compatibility)
      seen: {}, startedAt: Date.now(),
      stage: freshStage(), cb: null,
    };
    try { if (G.applyVarDefaults) G.applyVarDefaults(st); } catch (e) {}
    return st;
  }
  G.state = fresh();
  G.memoryMode = () => memory;
  G.hasSave = function () { if (memory) return false; try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  G.load = function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    if (!s || s.v !== 1 || typeof s !== 'object') return false;
    const st = fresh();
    Object.keys(s).forEach((k) => {
      if (k === 'vars' || k === 'stage') st[k] = Object.assign(st[k], s[k] || {});
      else st[k] = s[k];
    });
    if (!st.flags || typeof st.flags !== 'object') st.flags = {};
    G.state = st;
    varSnap = {};
    clockReset();
    G.bus.emit('state:load', st);
    return true;
  };
  let saveTimer = null, lastSavedPm = -1;
  function doSave() {
    saveTimer = null;
    if (memory) return;
    try { localStorage.setItem(KEY, JSON.stringify(G.state)); lastSavedPm = G.state.playMs; }
    catch (e) { memory = true; console.warn('[base] storage unavailable — memory mode'); }
  }
  G.save = function (immediate) {
    if (immediate) { clearTimeout(saveTimer); doSave(); return; }
    if (!saveTimer) saveTimer = setTimeout(doSave, 400);
  };
  G.resetSave = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    G.state = fresh();
    varSnap = {};
    clockReset();
    G.bus.emit('state:reset');
  };

  /* ---------------- flags / pm / vars ---------------- */
  const flagHooks = [];   // core-internal, run before the bus events (clock re-anchor)
  G.flag = function (name, value) {
    const f = G.state.flags;
    if (value === undefined) return !!f[name];
    if (G.DEBUG && G.F && Array.isArray(G.F.ALL) && G.F.ALL.indexOf(name) < 0) dwarn('flag:' + name, '[flag] name not in G.F.ALL:', name);
    const had = !!f[name];
    if (value) {
      if (had) { if (typeof value === 'number') { f[name] = value; G.save(); } return true; }
      f[name] = typeof value === 'number' ? value : Date.now();
      const pm = (G.state.vars.pm = G.state.vars.pm && typeof G.state.vars.pm === 'object' ? G.state.vars.pm : {});
      if (pm[name] == null) pm[name] = Math.round(G.state.playMs);
      G.save();
      flagHooks.forEach((fn) => { try { fn(name, true); } catch (e) { console.error('[flag hook]', e); } });
      G.bus.emit('flag', name);
      G.bus.emit('flag:' + name, name);
      return true;
    }
    if (!had) return false;
    delete f[name];
    G.save();
    G.bus.emit('flag:off', name);
    G.bus.emit('flag:off:' + name, name);
    return false;
  };
  G.pm = function (name) { const pm = G.state.vars.pm; return pm && pm[name] != null ? pm[name] : null; };
  let varSnap = {};
  const jsonOf = (v) => { try { return JSON.stringify(v === undefined ? null : v); } catch (e) { return String(v); } };
  G.vars = function (k, v) {
    const vars = G.state.vars;
    if (v === undefined) return vars[k];
    const before = Object.prototype.hasOwnProperty.call(varSnap, k) ? varSnap[k] : jsonOf(vars[k]);
    const after = jsonOf(v);
    vars[k] = v;
    G.save();
    if (before === after) return v;
    varSnap[k] = after;
    let prev; try { prev = before === undefined ? undefined : JSON.parse(before); } catch (e) { prev = undefined; }
    G.bus.emit('var', { k, v, prev });
    G.bus.emit('var:' + k, { v, prev });
    return v;
  };

  /* ---------------- hooks registry (ep1) ---------------- */
  const hooks = {};
  G.hooks = {
    set(name, fn) { hooks[name] = fn; },
    has(name) { return !!hooks[name]; },
    call(name, ...args) { const fn = hooks[name]; if (!fn) { console.warn('[hooks] missing', name); return undefined; } try { return fn(...args); } catch (e) { console.error('[hooks]', name, e); } },
  };

  /* ---------------- ep1 fragments & mirroring — off in ep2 ---------------- */
  G.fragCount = () => 0;
  G.foundFragment = () => false;
  G.mirroring = () => false;

  /* =========================================================
   * Milestone clock (DESIGN §2.1 / §9.1 — G.EP.CLOCK). In-game minutes are counted from 2026-12-24 00:00
   * (00:00–11:59 belong to 12-25). Segments: rate (1 min per `rate` real seconds, stop at cap — seconds loop
   * 57→58→59), beat (M7: 00:36 / +18 s 00:39 / +30 s 00:41 then 1 min per m7rate s to cap), card (fixed; ending may
   * run(rate, cap)), fixed (M0 23:10, HOOK 03:33). Milestone flags and jump() only ever move the clock forward.
   * ========================================================= */
  const DEF_CLOCK = { t0: [2026, 11, 24], ms: [['M0', '23:10', null, null, 67]], jump: {}, m7beat: [], m7rate: 1.5 };
  const CK = () => (G.EP && G.EP.CLOCK) || DEF_CLOCK;
  const ROWS = () => CK().ms || [];
  const pad2 = (n) => String(n).padStart(2, '0');
  function toMin(hm) {
    if (typeof hm === 'number') return hm;
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ''));
    if (!m) return NaN;
    const h = +m[1], mi = +m[2];
    return (h < 12 ? 1440 : 0) + h * 60 + mi;
  }
  function hmOf(min) { const m = ((Math.floor(min) % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
  function baseMs() { const t = CK().t0 || [2026, 11, 24]; return new Date(t[0], t[1], t[2], 0, 0, 0).getTime(); }
  function dateOf(min, sec) { return new Date(baseMs() + Math.floor(min) * 60000 + (sec || 0) * 1000); }
  function ymdOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function modeOf(row) {
    if (!row) return 'fixed';
    const r = row[2];
    return typeof r === 'number' ? 'rate' : r === 'beat' ? 'beat' : r === 'card' ? 'card' : 'fixed';
  }
  function segIdx() { const r = ROWS(), f = G.state.flags; let idx = -1; for (let i = 0; i < r.length; i++) if (f[r[i][0]]) idx = i; return idx; }
  function CS() {
    let c = G.state.vars.clock;
    if (!c || typeof c !== 'object' || typeof c.seg !== 'number') {
      const r0 = ROWS()[0];
      c = G.state.vars.clock = { seg: -1, a: toMin(r0 ? r0[1] : '23:10'), p: 0, fl: null, flp: 0, run: null, frz: null, frs: 0, lm: null };
    }
    return c;
  }
  const loopSec = (s) => (s < 57 ? s : 57 + ((s - 57) % 3));
  /** displayed time {min:int, sec:int} at playMs pm */
  function calc(pm) {
    const c = CS();
    if (c.frz != null) return { min: Math.floor(c.frz), sec: c.frs | 0 };
    const row = ROWS()[c.seg], md = c.seg < 0 ? 'fixed' : modeOf(row);
    let min, sec, t = null, cap = null;
    if (md === 'rate') { t = c.a + (pm - c.p) / 1000 / row[2]; cap = row[3] ? toMin(row[3]) : null; }
    else if (md === 'card' && c.run) { t = c.run.a + (pm - c.run.p) / 1000 / c.run.rate; cap = c.run.cap; }
    else if (md === 'beat') {
      const e = Math.max(0, (pm - c.p) / 1000), beats = CK().m7beat || [];
      let bi = -1; for (let i = 0; i < beats.length; i++) if (e >= beats[i][0]) bi = i;
      cap = row[3] ? toMin(row[3]) : null;
      if (bi < 0) { min = Math.floor(c.a); sec = loopSec(Math.floor(e)); }
      else if (bi === beats.length - 1) t = toMin(beats[bi][1]) + (e - beats[bi][0]) / (CK().m7rate || 1.5);
      else { min = toMin(beats[bi][1]); sec = loopSec(Math.floor(e - beats[bi][0])); }
    } else { min = Math.floor(c.a); sec = loopSec(Math.max(0, Math.floor((pm - c.p) / 1000))); }
    if (t != null) {
      if (cap != null && t >= cap) { min = cap; sec = 57 + (Math.floor(pm / 1000) % 3); }
      else { min = Math.floor(t); sec = Math.min(59, Math.floor((t - min) * 60)); }
    }
    if (c.fl != null && c.fl > min) { min = c.fl; sec = loopSec(Math.max(0, Math.floor((pm - c.flp) / 1000))); }
    return { min, sec };
  }
  const curF = (pm) => { const d = calc(pm); return d.min + d.sec / 60; };
  function emitMin(min) {
    const at = dateOf(min);
    G.bus.emit('clock:min', { hm: hmOf(min), min, date: ymdOf(at), at });
  }
  /** after an explicit move (milestone / jump / run): one 'clock:jump' (if ≥ 1 minute was skipped) + one 'clock:min' */
  function announceJump() {
    const c = CS(), now = calc(G.state.playMs).min;
    if (c.lm == null) { c.lm = now; return; }
    if (now <= c.lm) return;
    if (now > c.lm + 1) {
      const skipped = [];
      for (let m = c.lm + 1; m < now && skipped.length < 1440; m++) skipped.push(hmOf(m));
      const from = hmOf(c.lm);
      c.lm = now;
      G.bus.emit('clock:jump', { from, to: hmOf(now), skipped });
    } else c.lm = now;
    emitMin(now);
  }
  /** natural flow: one 'clock:min' per minute passed */
  function flowMinutes() {
    const c = CS(), now = calc(G.state.playMs).min;
    if (c.lm == null) { c.lm = now; return; }
    let guard = 0;
    while (c.lm < now && guard++ < 120) { c.lm++; emitMin(c.lm); }
  }
  /** re-anchor when a later milestone flag is on (forward only) */
  function syncSeg() {
    const c = CS(), idx = segIdx();
    if (idx <= c.seg) return false;
    const pm = G.state.playMs, f = curF(pm), row = ROWS()[idx], target = toMin(row[1]), md = modeOf(row);
    c.seg = idx; c.run = null; c.fl = null;
    if (md === 'beat') {
      const pmAt = G.pm(row[0]);
      c.p = pmAt != null ? pmAt : pm; c.a = target;
      if (f > target + 0.0001) { c.fl = Math.floor(f); c.flp = pm; }
    } else if (md === 'rate') { c.a = Math.max(target, f); c.p = pm; }
    else { c.a = Math.max(target, Math.floor(f)); c.p = pm; }
    return true;
  }
  function clockReset() { const c = CS(); syncSeg(); c.lm = calc(G.state.playMs).min; lastTick = performance.now(); }

  let started = false, paused = false, scale = 1, lastTick = performance.now(), tickN = 0;
  const tickFns = [];
  flagHooks.push((name) => {
    const r = ROWS(); for (let i = 0; i < r.length; i++) if (r[i][0] === name) { if (syncSeg()) announceJump(); return; }
  });

  G.clock = {
    get base() { return baseMs(); },
    now() { const d = calc(G.state.playMs); return dateOf(d.min, d.sec); },
    hm() { return hmOf(calc(G.state.playMs).min); },
    minutes() { return calc(G.state.playMs).min; },
    toMin,
    toHm: hmOf,
    passed(hm) { return calc(G.state.playMs).min >= toMin(hm); },
    jump(hmOrKey) {
      const J = CK().jump || {};
      const t = toMin(Object.prototype.hasOwnProperty.call(J, hmOrKey) ? J[hmOrKey] : hmOrKey);
      if (!isFinite(t)) { dwarn('jump:' + hmOrKey, '[clock] bad jump target', hmOrKey); return false; }
      syncSeg();
      const c = CS(), pm = G.state.playMs, f = curF(pm);
      if (t <= Math.floor(f)) return false;                       // forward only: max(now, t)
      const md = c.seg < 0 ? 'fixed' : modeOf(ROWS()[c.seg]);
      if (c.frz != null) { c.frz = t; c.frs = 0; }
      else if (md === 'beat') { c.fl = t; c.flp = pm; }
      else if (md === 'card' && c.run) { c.run.a = t; c.run.p = pm; }
      else { c.a = t; c.p = pm; }
      G.save();
      announceJump();
      return true;
    },
    run(rateSec, capHM) {
      syncSeg();
      const c = CS(), pm = G.state.playMs;
      const md = c.seg < 0 ? 'fixed' : modeOf(ROWS()[c.seg]);
      if (md !== 'card') { dwarn('run', '[clock] run() is for card mode only'); return false; }
      c.run = { a: curF(pm), p: pm, rate: Math.max(0.05, +rateSec || 1), cap: capHM ? toMin(capHM) : null };
      G.save();
      return true;
    },
    start() { if (!started) { started = true; paused = false; } lastTick = performance.now(); },
    pause() { paused = true; },
    resume() { paused = false; lastTick = performance.now(); },
    running() { return started && !paused && !document.hidden; },
    started() { return started; },
    freeze() { const c = CS(); if (c.frz != null) return; const d = calc(G.state.playMs); c.frz = d.min; c.frs = d.sec; G.save(); },
    unfreeze() {
      const c = CS(); if (c.frz == null) return;
      const f = c.frz, pm = G.state.playMs, md = c.seg < 0 ? 'fixed' : modeOf(ROWS()[c.seg]);
      c.frz = null;
      if (md === 'beat') { c.fl = Math.floor(f); c.flp = pm; } else if (md === 'card' && c.run) { c.run.a = f; c.run.p = pm; } else { c.a = f; c.p = pm; }
      G.save();
    },
    frozen() { return CS().frz != null; },
    segment() {
      const c = CS(), row = ROWS()[c.seg];
      if (!row) return { id: null, mode: 'fixed', rate: null, cap: null };
      const md = modeOf(row);
      return { id: row[0], mode: md, rate: md === 'rate' ? row[2] : md === 'beat' ? (CK().m7rate || 1.5) : (c.run ? c.run.rate : null), cap: md === 'card' && c.run ? hmOf(c.run.cap) : row[3] || null };
    },
    stage() { const row = ROWS()[CS().seg]; return row ? row[0] : 'start'; },
    playMinutes() { return G.state.playMs / 60000; },
    tick,
    onTick(fn) { tickFns.push(fn); return () => { const i = tickFns.indexOf(fn); if (i >= 0) tickFns.splice(i, 1); }; },
    _scale(x) { if (x != null) scale = Math.max(0, +x || 0); return scale; },
  };

  function tick() {
    const now = performance.now();
    let dt = now - lastTick; lastTick = now;
    if (!G.clock.running()) return;
    if (!(dt > 0)) dt = 0;
    if (dt > 1000) dt = 1000;                                   // throttled timers / sleep: never leap
    dt *= scale;
    G.state.playMs += dt;
    if (syncSeg()) announceJump();
    flowMinutes();
    tickFns.forEach((fn) => { try { fn(dt); } catch (e) { console.error('[tick]', e); } });
    if (++tickN % 40 === 0 && G.state.playMs !== lastSavedPm) G.save(true);   // + every 10 s
    G.bus.emit('tick', { dt, playMs: G.state.playMs });
  }
  setInterval(tick, 250);

  G.battery = function () {
    if (G.state.vars.battery != null) return G.state.vars.battery;
    const r = ROWS(), idx = segIdx();
    const row = r[idx] || r[0];
    return row && row[4] != null ? row[4] : 67;
  };

  /* visibility: playMs / tick stop while hidden (ep1 rule); save immediately */
  document.addEventListener('visibilitychange', () => {
    lastTick = performance.now();
    const hidden = !!document.hidden;
    if (hidden) G.save(true);
    G.bus.emit('visibility', { hidden });
  });
  W.addEventListener('pagehide', () => { G.save(true); });

  clockReset();
})();
