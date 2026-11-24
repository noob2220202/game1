/* =========================================================
 * Core: utils, event bus, game state & autosave, settings, game clock
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* ---------------- utils ---------------- */
  const U = (G.util = {});
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
  U.onTap = function (node, fn) {
    // fast, reliable tap handler for mobile (click is fine with touch-action: manipulation)
    node.addEventListener('click', (e) => { fn(e); });
    return node;
  };
  /** Korean 2-set keyboard: hangul syllables -> the latin keys you would press. ("콩이" -> "zhddl") */
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

  /* ---------------- event bus ---------------- */
  const listeners = {};
  G.bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return () => G.bus.off(ev, fn); },
    off(ev, fn) { const l = listeners[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(ev, data) { (listeners[ev] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }); (listeners['*'] || []).slice().forEach((fn) => { try { fn(ev, data); } catch (e) {} }); },
  };

  /* ---------------- settings ---------------- */
  const SKEY = 'haru-escape.settings.v1';
  G.settings = { sound: true, volume: 0.9, vibration: true, scares: 'full', textSize: 1, voice: true, camera: true };
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
  G.saveSettings = function () { try { localStorage.setItem(SKEY, JSON.stringify(G.settings)); } catch (e) {} G.bus.emit('settings', G.settings); };

  /* ---------------- state & autosave ---------------- */
  const KEY = 'haru-escape.save.v1';
  function fresh() {
    return {
      v: 1,
      flags: {},          // progress flags: G.flag('memoUnlocked')
      vars: {},           // misc values
      playMs: 0,          // accumulated play time
      hintsUsed: 0,
      hints: {},          // objectiveId -> tier revealed
      threads: {},        // live message threads appended at runtime: threadId -> [msgs]
      notifs: [],         // notification history
      read: {},           // read markers
      fragments: {},      // notebook fragment inputs
      seen: {},           // seen content ids (photos, etc)
      startedAt: Date.now(),
    };
  }
  G.state = fresh();
  G.hasSave = function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  G.load = function () {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { G.state = Object.assign(fresh(), s); return true; } } catch (e) {}
    return false;
  };
  let saveTimer = null;
  G.save = function (immediate) {
    const doSave = () => { saveTimer = null; try { localStorage.setItem(KEY, JSON.stringify(G.state)); } catch (e) {} };
    if (immediate) { clearTimeout(saveTimer); doSave(); return; }
    if (!saveTimer) saveTimer = setTimeout(doSave, 400);
  };
  G.resetSave = function () { try { localStorage.removeItem(KEY); } catch (e) {} G.state = fresh(); };

  /** read or set a progress flag. Setting emits 'flag' + 'flag:<name>' once. */
  G.flag = function (name, value) {
    if (value === undefined) return !!G.state.flags[name];
    const had = !!G.state.flags[name];
    G.state.flags[name] = value ? (typeof value === 'number' ? value : Date.now()) : 0;
    if (!value) delete G.state.flags[name];
    G.save();
    if (value && !had) { G.bus.emit('flag', name); G.bus.emit('flag:' + name, name); }
    return !!value;
  };
  G.vars = function (k, v) { if (v === undefined) return G.state.vars[k]; G.state.vars[k] = v; G.save(); return v; };

  /* ---------------- hooks registry ---------------- */
  const hooks = {};
  G.hooks = {
    set(name, fn) { hooks[name] = fn; },
    has(name) { return !!hooks[name]; },
    call(name, ...args) { const fn = hooks[name]; if (!fn) { console.warn('[hooks] missing', name); return undefined; } try { return fn(...args); } catch (e) { console.error('[hooks]', name, e); } },
  };

  /* ---------------- progress: fragments & mirroring ---------------- */
  const FRAG_ORDER = ['47', '29', '06'];
  G.fragCount = function () { return FRAG_ORDER.filter((id) => G.flag('frag' + id)).length; };
  G.foundFragment = function (id) {
    id = String(id);
    if (!FRAG_ORDER.includes(id) || G.flag('frag' + id)) return false;
    G.flag('frag' + id, true);
    const n = G.fragCount();
    G.flag('F' + n, true);
    G.state.fragments[id] = id;
    G.save(true);
    G.bus.emit('fragment', { id, count: n });
    return true;
  };
  G.mirroring = function () { return !!G.flag('M1') && !G.flag('M5'); };

  /* ---------------- game clock (milestone model, design §2.1) ----------------
   * In-game date is fixed 2026-11-24. Time = last milestone time + (play since milestone) * (60/50),
   * capped at next milestone - 1 min (seconds then loop 57-58-59).                    */
  const D = (h, m) => new Date(2026, 10, 24, h, m, 0).getTime();
  const MILESTONES = [
    ['start', D(3, 33), 23], ['M1', D(3, 38), 21], ['M2', D(3, 47), 17], ['F1', D(3, 56), 12], ['F2', D(4, 4), 4],
    ['F3', D(4, 13), 4], ['M4', D(4, 22), 4], ['M5', D(4, 31), 4], ['M6', D(4, 38), 4], ['M7', D(4, 41), 1], ['M8', D(4, 44), 1],
  ];
  G.MILESTONES = MILESTONES;
  const BASE = D(3, 33);
  let lastTick = 0, running = false;
  function currentStage() {
    let idx = 0;
    MILESTONES.forEach(([id], i) => { if (i > 0 && G.flag(id)) idx = Math.max(idx, i); });
    return idx;
  }
  G.clock = {
    base: BASE,
    start() { running = true; lastTick = performance.now(); },
    pause() { G.clock.tick(); running = false; },
    tick() {
      if (!running) return;
      const t = performance.now(); const dt = t - lastTick; lastTick = t;
      if (dt > 0 && dt < 5000 && !document.hidden) G.state.playMs += dt;
    },
    freeze(h, m) { G.state.vars.clockFreeze = D(h, m); G.save(); },
    unfreeze() { delete G.state.vars.clockFreeze; G.save(); },
    now() {
      const v = G.state.vars;
      if (v.clockFreeze) return new Date(v.clockFreeze + (G.flag('END') ? 0 : 0));
      if (v.clockOverride) return new Date(v.clockOverride);
      const idx = currentStage();
      const [id, t0] = MILESTONES[idx];
      // when did we reach this stage? (stored on first observation)
      const key = 'ms_at_' + id;
      if (v[key] == null) { v[key] = G.state.playMs; }
      const next = MILESTONES[idx + 1];
      const cap = next ? next[1] - 60000 : t0 + 3600000;
      const t = t0 + (G.state.playMs - v[key]) * (60 / 50);
      if (t >= cap) {
        // stuck time: seconds loop 57 -> 58 -> 59 -> 57
        const loop = 57 + (Math.floor(G.state.playMs / 1000) % 3);
        return new Date(cap - (cap % 60000) + loop * 1000);
      }
      return new Date(t);
    },
    stage() { return MILESTONES[currentStage()][0]; },
    playMinutes() { return G.state.playMs / 60000; },
  };
  G.battery = function () {
    if (G.state.vars.battery != null) return G.state.vars.battery;
    return MILESTONES[currentStage()][2];
  };
  setInterval(() => { G.clock.tick(); }, 1000);
  document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
})();
