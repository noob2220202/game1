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

  /* ---------------- game clock ----------------
   * In-game time starts at 2026-11-24 03:33:00 and advances with real play time.
   * Director can override (e.g. freeze at 04:44).                                  */
  const BASE = new Date(2026, 10, 24, 3, 33, 0).getTime();
  let lastTick = 0, running = false;
  G.clock = {
    base: BASE,
    start() { running = true; lastTick = performance.now(); },
    pause() { G.clock.tick(); running = false; },
    tick() {
      if (!running) return;
      const t = performance.now(); const dt = t - lastTick; lastTick = t;
      if (dt > 0 && dt < 5000 && !document.hidden) G.state.playMs += dt;
    },
    now() {
      if (G.state.vars.clockOverride) return new Date(G.state.vars.clockOverride);
      // 1 real second = 1 in-game second, capped at 04:43 so the 04:44 beat is reserved for the climax
      const cap = new Date(2026, 10, 24, 4, 43, 30).getTime();
      return new Date(Math.min(cap, BASE + G.state.playMs + (G.state.vars.clockSkip || 0)));
    },
    playMinutes() { return G.state.playMs / 60000; },
  };
  setInterval(() => { G.clock.tick(); }, 1000);
  document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
})();
