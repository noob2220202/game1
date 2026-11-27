/* =========================================================
 * 하루를 위한 방탈출! 2 — room engine (engine/room/room.js · owner: room)
 * 방 보기 = the camera app's view of the 601 studio, and the "eye views" (M0 cold open · M7 forced window · M8 door).
 * DESIGN §2.6 · §3.1 · §3.8 · §3.15 · §4.7.6 · §4.7.7 · §6.3 (live layers, seen-while-watching) · §6.4-①② · §7.1.2 (yaw)
 * · §8.3-2/-3/-5/-6/-7 · §9.5-4 · §9.8.  ARCH §2.3 (z) · §4.15 · §6.3 data-qa.  Data: ep2/js/room/roomdata.js (G.ROOM).
 *
 * Public API (G.room)
 *   init()                                    bus listeners + hook 'room:refreshLayers' (idempotent; open() calls it lazily)
 *   open({ mode:'camera'|'eye', view, sub, fromLock, flash, onClose }) → api       camera = the `camera` app (app stack z 10,
 *                                             or a z 45 layer above the lock screen when fromLock); user '—' → null
 *   close({ all }) · isOpen() · current() → { mode, view, sub, zoom, closeup, flash } | null
 *   flash(on?) → bool                         camera flashlight (QS 손전등 tile uses it)
 *   forceView({ view, sub, lockMs, pinch, handle, until }) → Promise<{ via:'handle'|'until'|'closed' }>   eye view, z 45
 *   eyeM0({ resume }) → Promise               M0 door → p2_door_open → box → card/polaroid → phone → 'alarm:ring' → gotPhone
 *   dirSub(text, az, ms) · refresh()
 *   playTankGlow({ variant:'hand'|'cap', holdMs }) → Promise<bool>     B09 (false when r2_window / roof_tank is not on screen)
 *   handleJerk({ less }) · tankAjar() → Promise · beams('direct'|'sweep') → Promise · police(on) · lightsOn()
 *   doorGap('police'|'torch'|null) · closeup(id) → Promise
 * Bus out: room:open {mode} · room:close {mode} · room:view {view, sub, zoom} · room:zoom {z} · room:spot {id}
 *          room:closeup {id} · room:shot {view, sub, zoom}
 * Bus in (live layers — never polls other owners): flag · flag:off · var · clock:min · clock:jump · tick · settings ·
 *          visibility · lock:show · users:switching · climax:drill · climax:wobble
 * Hook set: 'room:refreshLayers'.  Hooks called: 'alarm:ring' (media).
 * Flags set: gotPhone · boxNote · boxHand · polaroidSeen · seenNote · newPhoneSeen.  Vars: vars.room · vars.shots.
 * HARD MODE: no hint text, no tutorial line, no out-of-world error text. Every string = DESIGN §4.7.6/§4.7.7/§3.1 or G.e2.STR.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const R = (G.room = G.room || {});

  /* ======================= small guarded helpers ======================= */
  function el(tag, attrs) {
    const m = /^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i.exec(tag);
    const n = document.createElement((m && m[1]) || 'div');
    let kids = Array.prototype.slice.call(arguments, 2);
    if (attrs != null && (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object')) { kids.unshift(attrs); attrs = null; }
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, v) => { if (t === '.') n.classList.add(v); else n.id = v; });
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    kids = [].concat.apply([], kids);
    kids.forEach((c) => { if (c == null || c === false) return; n.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return n;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const D = () => G.ROOM || null;
  const DEBUG = () => !!G.DEBUG;
  function warn() { if (DEBUG()) try { console.warn.apply(console, ['[room]'].concat([].slice.call(arguments))); } catch (e) {} }
  function flag(f) { try { return !!(G.flag && G.flag(f)); } catch (e) { return false; } }
  function setFlag(f) { try { if (G.flag && !G.flag(f)) G.flag(f, true); } catch (e) { console.error('[room] flag', f, e); } }
  function vars() { return (G.state && G.state.vars) || {}; }
  function save() { try { G.save && G.save(); } catch (e) {} }
  function emit(ev, data) { try { G.bus && G.bus.emit(ev, data); } catch (e) {} }
  function on(ev, fn) { try { if (G.bus) G.bus.on(ev, fn); } catch (e) {} }
  /** player-facing text (G.T at render time — tokens incl. {$key}); local fallback only for partial builds */
  const STR_FB = { wipe: '원격 초기화 중… (요청: 다른 기기)', frp: '이전 계정 인증 — 인증 코드를 문자로 보냈습니다', noSimEmergency: 'SIM 없음 · 긴급 통화를 연결할 수 없습니다' };
  function T(s) {
    if (typeof s === 'function') { try { s = s(); } catch (e) { s = ''; } }
    if (typeof s !== 'string') return s == null ? '' : String(s);
    try { if (G.T) return G.T(s); } catch (e) {}
    const name = (window.CONFIG && window.CONFIG.PLAYER_NAME) || '하루';
    return s.replace(/\{\$(\w+)\}/g, (_, k) => (G.e2 && G.e2.STR && G.e2.STR[k]) || STR_FB[k] || '').replace(/\{N[^}]*\}/g, name);
  }
  function sfx(name) { try { const f = G.audio && G.audio.sfx && G.audio.sfx[name]; if (typeof f === 'function') return f(); } catch (e) {} return undefined; }
  function less() { try { if (G.e2 && G.e2.less) return !!G.e2.less(); } catch (e) {} return !!(G.settings && G.settings.scares && G.settings.scares !== 'full'); }
  function lowEnd() { try { return !!(G.e2 && G.e2.lowEnd && G.e2.lowEnd()); } catch (e) { return false; } }
  function reduceMotion() {
    let rm = false; try { rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    return rm || !!(G.settings && G.settings.reduceShake);
  }
  function reduceFlash() { return !!(G.settings && G.settings.reduceFlash) || reduceMotion(); }
  function screenEl() { return document.getElementById('screen') || document.body; }
  function imgUrl(key) { const d = D(); return d ? d.img(key) : ''; }
  function hasImg(key) { const d = D(); return d ? d.has(key) : false; }
  function clockNow() { try { return G.clock && G.clock.now ? G.clock.now() : new Date(); } catch (e) { return new Date(); } }

  /* ======================= masks (data URIs — a file URL mask fails on file://, §8.3-2) ======================= */
  const MASK = {};
  function svgUrl(svg) { return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")'; }
  function quadPath(q) { return 'M' + q.map((p) => (+p[0]).toFixed(4) + ' ' + (+p[1]).toFixed(4)).join('L') + 'Z'; }
  function glassMaskSvg() {
    const d = D(); const panes = d && d.GEO.panes(); const quads = panes && panes.length ? panes : [d ? d.GEO.glass() : [[0.285, 0.296], [0.776, 0.302], [0.773, 0.535], [0.283, 0.538]]];
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><path fill="#fff" fill-rule="evenodd" d="M0 0H1V1H0Z ' + quads.map(quadPath).join(' ') + '"/></svg>');
  }
  /** PNG → data URL through a canvas (same-origin http(s)); file:// taints the canvas → fallback */
  function loadMask(key, fallback) {
    if (MASK[key]) return MASK[key];
    const m = (MASK[key] = { url: fallback, waiters: [] });
    if (location.protocol === 'file:' || !hasImg(key)) return m;
    const im = new Image();
    im.onload = function () {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        m.url = 'url("' + c.toDataURL('image/png') + '")';
        m.waiters.forEach((fn) => { try { fn(m.url); } catch (e) {} }); m.waiters = [];
      } catch (e) { /* tainted: keep fallback */ }
    };
    im.src = imgUrl(key);
    return m;
  }
  function applyMask(node, key, fallback) {
    const m = loadMask(key, fallback);
    const set = (u) => { node.style.webkitMaskImage = u || ''; node.style.maskImage = u || ''; };
    set(m.url); m.waiters && m.waiters.push(set);
  }

  /* ======================= geometry ======================= */
  function bbox(q) { let x0 = 1, y0 = 1, x1 = 0, y1 = 0; q.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
  /** where the roof plate sits inside r2_window (view fractions): glass bbox (+ margin), cover-fit (§8.3-2) */
  function plateRect(view) {
    const g = bbox(D().GEO.glass()), o = view.outside, m = o.margin || 0;
    const bx = g.x - m * g.w, by = g.y - m * g.h, bw = g.w * (1 + 2 * m), bh = g.h * (1 + 2 * m);
    const bwp = bw * view.w, bhp = bh * view.h, sc = Math.max(bwp / o.w, bhp / o.h), W = o.w * sc, H = o.h * sc;
    return { x: (bx * view.w - (W - bwp) / 2) / view.w, y: (by * view.h - (H - bhp) / 2) / view.h, w: W / view.w, h: H / view.h };
  }
  function mapRect(p, from, to) { return { x: to.x + (p.x - from.x) / from.w * to.w, y: to.y + (p.y - from.y) / from.h * to.h }; }
  function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  /** CSS matrix3d mapping an element of w×h px onto quad q (px; TL, TR, BR, BL) — Heckbert square→quad */
  function quadMatrix(w, h, q) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
    return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1].map((v) => +v.toFixed(8)).join(',') + ')';
  }
  function pctBox(n, r) { n.style.left = r.x * 100 + '%'; n.style.top = r.y * 100 + '%'; n.style.width = r.w * 100 + '%'; n.style.height = r.h * 100 + '%'; return n; }
  function relAz(az, yaw) { return ((((az - yaw) % 360) + 540) % 360) - 180; }

  /* ======================= crossfading image slot (live layers — §6.3 rule 1) ======================= */
  function Slot(parent, cls, o) {
    this.el = el('div.rm2-slot' + (cls ? '.' + cls : ''));
    this.o = o || {};
    this.key = undefined;
    parent.appendChild(this.el);
  }
  Slot.prototype.set = function (key, o) {
    o = o || {};
    const self = this;
    if (key === this.key) { if (this.cur && o.filter != null) this.cur.style.filter = o.filter; if (this.cur && o.opacity != null) this.cur.style.opacity = o.opacity; return; }
    this.key = key;
    const old = Array.prototype.slice.call(this.el.children);
    const fade = Math.max(0, o.fade == null ? 400 : o.fade);
    const out = () => old.forEach((n) => { n.style.transition = 'opacity ' + Math.min(fade, 600) + 'ms linear'; n.style.opacity = '0'; setTimeout(() => n.remove(), Math.min(fade, 600) + 60); });
    if (!key) { this.cur = null; out(); return; }
    const fb = (this.o.fallback || {})[key];
    if (!hasImg(key)) { if (fb) { this.key = undefined; this.set(fb[0], Object.assign({}, o, { filter: fb[1] !== 1 ? 'brightness(' + fb[1] + ')' : o.filter })); } return; }
    const im = el('img.rm2-sl', { alt: '', draggable: 'false' });
    im.style.opacity = '0';
    if (o.filter) im.style.filter = o.filter;
    if (o.cls) im.classList.add(o.cls);
    const target = o.opacity == null ? 1 : o.opacity;
    im.onload = function () {
      if (self.key !== key) { im.remove(); return; }
      self.cur = im;
      if (!fade) { im.style.transition = 'none'; im.style.opacity = String(target); old.forEach((n) => n.remove()); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transition = 'opacity ' + fade + 'ms linear'; im.style.opacity = String(target); }));
      setTimeout(() => { old.forEach((n) => { if (n.parentNode) n.remove(); }); }, fade + 80);
    };
    im.onerror = function () {
      im.remove();
      if (self.key !== key) return;
      if (fb) { self.key = undefined; self.set(fb[0], Object.assign({}, o, { filter: fb[1] !== 1 ? 'brightness(' + fb[1] + ')' : o.filter })); }
      // otherwise keep whatever was there (nearest state — §9.8)
    };
    im.src = imgUrl(key);
    this.el.appendChild(im);
  };

  /* ======================= one global animation ticker (rAF only while visible) ======================= */
  const tickers = new Set();
  let rafId = 0, lastT = 0;
  function frame(t) {
    rafId = 0;
    if (document.hidden) return;
    const dt = lastT ? Math.min(100, t - lastT) : 16; lastT = t;
    tickers.forEach((fn) => { try { if (fn(t, dt) === false) tickers.delete(fn); } catch (e) { tickers.delete(fn); console.error('[room] ticker', e); } });
    if (tickers.size) rafId = requestAnimationFrame(frame);
  }
  function addTicker(fn) { tickers.add(fn); if (!rafId && !document.hidden) { lastT = 0; rafId = requestAnimationFrame(frame); } return () => tickers.delete(fn); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && tickers.size && !rafId) { lastT = 0; rafId = requestAnimationFrame(frame); } });

  /* ======================= snow particles (§8.3-5 — ≤ 60, 30 fps, time based) ======================= */
  function Snow(parent, o) {
    o = o || {};
    this.cv = el('canvas.rm2-snow');
    if (o.clip) this.cv.style.clipPath = o.clip;
    parent.appendChild(this.cv);
    this.n = 0; this.ps = []; this.acc = 0; this.alive = true;
    const self = this;
    this.off = addTicker((t, dt) => self.step(dt));
  }
  Snow.prototype.setCount = function (n) {
    if (lowEnd()) n = 0;
    this.n = n;
    while (this.ps.length < n) this.ps.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, v: 0.04 + Math.random() * 0.07, w: Math.random() * 6.28, a: 0.35 + Math.random() * 0.5 });
    this.ps.length = n;
    this.draw();
  };
  Snow.prototype.step = function (dt) {
    if (!this.alive) return false;
    if (!this.cv.isConnected) return true;
    this.acc += dt; if (this.acc < 33) return true;
    const k = this.acc / 1000; this.acc = 0;
    if (!reduceMotion()) this.ps.forEach((p) => { p.y += p.v * k; p.w += k * 1.3; p.x += Math.sin(p.w) * 0.004 * k * 10; if (p.y > 1.02) { p.y = -0.02; p.x = Math.random(); } });
    this.draw();
    return true;
  };
  Snow.prototype.draw = function () {
    const c = this.cv, r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (!r.width) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
    x.fillStyle = '#fff';
    this.ps.forEach((p) => { x.globalAlpha = p.a; x.beginPath(); x.arc(p.x * w, p.y * h, p.r * dpr, 0, 6.2832); x.fill(); });
    x.globalAlpha = 1;
  };
  Snow.prototype.kill = function () { this.alive = false; this.off && this.off(); this.cv.remove(); };
  const SNOW_N = [20, 40, 60];

  /* ======================= world effects shared by every open view (§6.3 — the same timer everywhere) ======================= */
  const FX = { glow: null, ajar: null, beams: null, handle: null, police: null, gap: null, lightsAt: 0, lastJumpAt: 0 };
  const insts = [];          // open instances (last = top)
  function topInst() { for (let i = insts.length - 1; i >= 0; i--) if (!insts[i].closed) return insts[i]; return null; }
  function visibleInst() { const t = topInst(); return t && !document.hidden ? t : null; }
  let refreshQ = 0;
  function refreshAll() { if (refreshQ) return; refreshQ = requestAnimationFrame(() => { refreshQ = 0; insts.slice().forEach((i) => { try { i.live(); } catch (e) { console.error('[room] live', e); } }); }); }
  function refreshNow() { insts.slice().forEach((i) => { try { i.live(); } catch (e) { console.error('[room] live', e); } }); }
  function policeActive() { if (FX.police != null) return !!FX.police; const d = D(); return !!(d && d.policeOn()); }
  function gapState() {
    if (FX.gap !== null && FX.gap !== undefined) return FX.gap;
    if (flag('M8') && !flag('doorOpened')) return 'torch';
    return policeActive() ? 'police' : null;
  }
  /** B09 glow opacity curve: 0.5 s on · hold · (+0.6 s cap) · 0.5 s off (§6.4-② · §8.3-3) */
  function glowAt(t) {
    const g = FX.glow; if (!g) return null;
    const e = t - g.t0, endHold = 500 + g.hold + g.capMs;
    const light = e < 500 ? e / 500 : e < endHold ? 1 : e < endHold + 500 ? 1 - (e - endHold) / 500 : 0;
    const capA = g.capMs ? clamp((e - (500 + g.hold)) / 200, 0, 1) * (e < endHold ? 1 : light) : 0;
    return { light: Math.max(0, light), hand: Math.max(0, light), cap: capA, done: e >= endHold + 500 };
  }
  /** B17 door ajar: 0.6 s open · 2.2 s · 0.6 s close (§6.2/§6.3) */
  function ajarAt(t) {
    const a = FX.ajar; if (!a) return null;
    const e = t - a.t0;
    const v = e < 600 ? e / 600 : e < 2800 ? 1 : e < 3400 ? 1 - (e - 2800) / 600 : 0;
    return { v: Math.max(0, v), done: e >= 3400 };
  }
  /** B16 beams: angle targets in plate coordinates */
  function beamsAt(t) {
    const b = FX.beams, d = D();
    const door = { x: 0.282, y: 0.5 }, rail = { x: 0.8, y: 0.62 }, start = { x: 0.24, y: 0.95 };
    if (!b) {
      if (d && vars().climax && vars().climax.b16Done && !d.passed('00:50')) return { a: door, b: { x: door.x + 0.012, y: door.y + 0.06 }, k: 1, onDoor: true };
      return null;
    }
    const e = t - b.t0, ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
    const lerp = (p, q, k) => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });
    const fadeIn = clamp(e / 400, 0, 1);
    let a;
    if (b.mode === 'direct') a = lerp(start, door, ease(e / 1500));
    else a = e < 3000 ? lerp(start, rail, ease(e / 3000)) : lerp(rail, door, ease((e - 3000) / 3000));
    const jit = Math.sin(e / 140) * 0.006;
    return { a: { x: a.x + jit, y: a.y }, b: { x: a.x + 0.015 - jit, y: a.y + 0.07 }, k: fadeIn, onDoor: b.mode === 'direct' ? e >= 1500 : e >= 6000 };
  }
  let fxOff = null;
  function fxRun() {
    if (fxOff) return;
    fxOff = addTicker((t) => {
      const any = FX.glow || FX.ajar || FX.beams || FX.handle;
      insts.forEach((i) => { try { i.fx(t); } catch (e) { console.error('[room] fx', e); } });
      if (FX.glow && glowAt(t).done) { const g = FX.glow; FX.glow = null; g.resolve && g.resolve(true); }
      if (FX.ajar && ajarAt(t).done) { const a = FX.ajar; FX.ajar = null; a.resolve && a.resolve(); refreshAll(); }
      if (FX.beams) { const s = beamsAt(t); if (s && s.onDoor && !FX.beams.reached) { FX.beams.reached = true; FX.beams.onDoor && FX.beams.onDoor(); refreshAll(); } if (s && s.onDoor && t - FX.beams.t0 > (FX.beams.mode === 'direct' ? 3500 : 8000)) { const b = FX.beams; FX.beams = null; b.resolve && b.resolve(); refreshAll(); } }
      if (FX.handle && t - FX.handle.t0 > 420) FX.handle = null;
      if (!any && !(FX.glow || FX.ajar || FX.beams || FX.handle)) { fxOff = null; return false; }
      return true;
    });
  }

  /* ======================= the room instance ======================= */
  const PAD_B = 200;              // camera chrome height the image may tilt above (ep1 rule)
  const ICON = {
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    flash: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  R.ICON = ICON;

  function createRoom(o) {
    const data = D();
    const mode = o.mode;                         // 'camera' | 'camlock' | 'eye'
    const eye = mode === 'eye';
    const cam = !eye;
    const V = data.views;
    const inst = { mode, closed: false, o };
    const vr = (vars().room = vars().room || {});
    let vi = Math.max(0, data.indexOf(o.view || (cam ? vr.view : '') || 'r2_door'));
    let flash = cam && (o.flash != null ? !!o.flash : !!vr.flash);
    let scenes = [];                             // [base, sub, sub2]
    let cu = [];                                 // close-up stack
    let sw = 1, sh = 1;
    let lockUntil = o.lockMs ? now() + o.lockMs : 0;
    const allowZoom = cam || !!o.pinch;
    let spotsSig = '';

    /* ---------- DOM ---------- */
    const root = el('div.rm2-room.rv' + (eye ? '.rm2-eyeview' : '.rm2-cam'));
    if (DEBUG() && !G.APP) root.classList.add('rm2-debug');   // hotspot outlines — never under G.APP (app build / ?app=1)
    root.dataset.status = 'light';
    const stage = el('div.rv-stage');
    const turnWrap = el('div.rv-turn');
    stage.appendChild(turnWrap);
    const capEl = el('div.rv-caption');
    const subsEl = el('div.rm2-dirsubs');
    const cuLayer = el('div.rm2-culayer');
    const shotFx = el('div.rm2-shotfx');
    root.append(stage, el('div.rv-vig'), subsEl, capEl, shotFx);
    let chrome = null, flashBtn = null, pill = null, dots = null, thumb = null, prevBtn = null, nextBtn = null;
    if (cam) {
      const closeBtn = el('button.rm2-btn.rm2-close', { 'data-qa': 'room.close', 'aria-label': '닫기', html: ICON.close });
      flashBtn = el('button.rm2-btn.rm2-flash', { 'data-qa': 'room.flash', 'aria-label': '손전등', html: ICON.flash });
      dots = el('div.rm2-dots', null, V.map(() => el('i')));
      prevBtn = el('button.rm2-turn.left', { 'data-qa': 'room.prev', 'aria-label': '왼쪽으로', html: ICON.left });
      nextBtn = el('button.rm2-turn.right', { 'data-qa': 'room.next', 'aria-label': '오른쪽으로', html: ICON.right });
      pill = el('div.rm2-pill', null, [1, 2, 8].map((z) => el('button', { 'data-qa': 'room.zoom:' + z, dataset: { z: String(z) } }, z + '×')));
      const shutter = el('button.rm2-shutter', { 'data-qa': 'room.shutter', 'aria-label': '촬영' }, el('i'));
      thumb = el('button.rm2-thumb', { 'aria-label': '갤러리' });
      if (mode === 'camlock') thumb.style.visibility = 'hidden';
      chrome = el('div.rm2-chrome', null,
        el('div.rm2-top', null, closeBtn, el('span.rm2-top-mid', null, dots), flashBtn),
        prevBtn, nextBtn,
        el('div.rm2-bottom', null, pill, el('div.rm2-row', null, thumb, shutter, el('span.rm2-row-sp'))));
      root.appendChild(chrome);
      closeBtn.addEventListener('click', () => close('closed'));
      flashBtn.addEventListener('click', () => { sfx('tap'); setFlash(!flash); });
      prevBtn.addEventListener('click', () => turn(-1));
      nextBtn.addEventListener('click', () => turn(1));
      pill.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sfx('tap'); pillZoom(+b.dataset.z); });
      shutter.addEventListener('click', shoot);
      thumb.addEventListener('click', () => {
        if (mode === 'camlock' || (G.phone && G.phone.isLocked && G.phone.isLocked())) return;
        close('closed');
        setTimeout(() => { try { G.phone && G.phone.openApp && G.phone.openApp('gallery', { user: 'n', album: 'camera' }); } catch (e) {} }, 260);
      });
      const shots = vars().shots || [];
      if (shots[0] && shots[0].key) thumb.style.backgroundImage = 'url("' + imgUrl(shots[0].key) + '")';
    }
    root.appendChild(cuLayer);

    /* ---------- mounting (ARCH §2.3) ---------- */
    let entry = null, layer = null, offBack = null;
    if (mode === 'camera' && G.phone && typeof G.phone.push === 'function') {
      entry = G.phone.push(root, { appId: 'camera', anim: 'fade', onBack: () => back(), onClose: () => close('shell', true) });
    } else {
      layer = el('div.rm2-eye' + (mode === 'camlock' ? '.rm2-camlock' : ''));
      layer.appendChild(root);
      screenEl().appendChild(layer);
      requestAnimationFrame(() => layer.classList.add('in'));
      if (G.phone && typeof G.phone.pushBack === 'function') offBack = G.phone.pushBack(() => { if (!inst.closed && insts.indexOf(inst) >= 0) { back(); return true; } return false; });
      if (eye) screenEl().classList.add('eye-mode');
      if (eye && o.fadeIn) { layer.classList.add('rm2-fadein'); }
    }
    insts.push(inst);

    /* ---------- scenes ---------- */
    function buildViewScene(v) {
      const sc = { kind: 'view', def: v, id: v.id, w: v.w, h: v.h, z: 1, cx: 0.5, cy: 0.5, enterZ: 1, minZ: 1, maxZ: 8, slots: {} };
      const fr = (sc.el = el('div.rv-frame', { 'data-qa': 'room.view:' + v.id }));
      // outside group (window): above the room-darkness filter (§8.3-2)
      if (v.outside) {
        const pr = (sc.plate = plateRect(v));
        const out = (sc.out = pctBox(el('div.rm2-outside'), pr));
        sc.slots.plate = new Slot(out, 'plate', { fallback: v.outside.plateFallback });
        sc.slots.steps = new Slot(out, 'steps');
        sc.slots.steps2 = new Slot(out, 'steps2');
        sc.slots.ajar = new Slot(out, 'ajar');
        sc.glowImgs = glowImgs(out, v.outside.glow);
        sc.ajarFx = el('img.rm2-fxi', { alt: '' }); sc.ajarFx.style.opacity = '0'; if (hasImg(v.outside.ajar.dark)) sc.ajarFx.src = imgUrl(v.outside.ajar.dark); out.appendChild(sc.ajarFx);
        sc.snow = new Snow(out);
        sc.policeEl = el('div.rm2-police', null, el('i.r'), el('i.b'));
        applyMask(sc.policeEl, 'm_roof_snow', '');
        out.appendChild(sc.policeEl);
        sc.beamsEl = el('div.rm2-beams', null, el('i'), el('i'));
        out.appendChild(sc.beamsEl);
        fr.appendChild(out);
      }
      const wrap = (sc.wrap = el('div.rm2-roomwrap'));
      if (v.mask) applyMask(wrap, v.mask, glassMaskSvg());
      const dark = el('div.rv-dark'), litG = el('div.rv-lit');
      const baseImg = el('img.rv-img', { alt: '', draggable: 'false' });
      const litImg = el('img.rv-img', { alt: '', draggable: 'false' });
      baseImg.onerror = () => { baseImg.remove(); dark.classList.add('rm2-noimg'); };
      litImg.onerror = () => litImg.remove();
      baseImg.src = imgUrl(v.key); litImg.src = imgUrl(v.key);
      sc.darkLayers = el('div.rv-layers'); sc.litLayers = el('div.rv-layers');
      dark.append(baseImg, el('div.rm2-fbsil.' + v.id), sc.darkLayers); litG.append(litImg, sc.litLayers);
      wrap.append(dark, litG);
      sc.litG = litG;
      fr.appendChild(wrap);
      // in-room object layers (darkened with the room): box patch · handle frame · wall clock · lock panel crop
      sc.objs = { dark: {}, lit: {} };
      ['dark', 'lit'].forEach((k) => {
        const host = k === 'dark' ? sc.darkLayers : sc.litLayers;
        if (v.id === 'r2_door') {
          sc.objs[k].box = el('img.rv-layer', { alt: '', draggable: 'false' }); pctBox(sc.objs[k].box, { x: 0, y: 0, w: 1, h: 1 });
          sc.objs[k].box.onload = function () { this.classList.add('ok'); }; sc.objs[k].box.onerror = function () { this.remove(); };
          host.appendChild(sc.objs[k].box);
          const lp = data.GEO.lockPanel;
          const panel = pctBox(el('div.rm2-lockpanel'), lp);
          panel.style.backgroundImage = 'url("' + imgUrl(v.key) + '")';
          panel.style.backgroundSize = (100 / lp.w) + '% ' + (100 / lp.h) + '%';
          panel.style.backgroundPosition = (lp.x / (1 - lp.w) * 100) + '% ' + (lp.y / (1 - lp.h) * 100) + '%';
          host.appendChild(panel); sc.objs[k].panel = panel;
          const hd = el('img.rv-layer.rm2-handle', { alt: '', draggable: 'false' }); pctBox(hd, { x: 0, y: 0, w: 1, h: 1 });
          if (hasImg(v.handleKey)) hd.src = imgUrl(v.handleKey);
          hd.onerror = function () { this.remove(); };
          host.appendChild(hd); sc.objs[k].handle = hd;
        }
        if (v.wallClock) { const c = clockHands(); host.appendChild(c.node); sc.objs[k].clock = c; }
      });
      // emitters (not darkened)
      const glow = (sc.glow = el('div.rv-glow'));
      if (v.id === 'r2_door') {
        const L = data.GEO.ledLock();
        sc.led = el('i.rm2-led.lock'); sc.led.style.left = L.x * 100 + '%'; sc.led.style.top = L.y * 100 + '%'; glow.appendChild(sc.led);
        sc.gap = gapSvg(data.GEO.doorGap()); glow.appendChild(sc.gap);
      }
      if (v.id === 'r2_window') {
        sc.glare = pctBox(el('div.rm2-glare'), bbox(data.GEO.glass())); glow.appendChild(sc.glare);
        sc.refl = el('img.rm2-refl', { alt: '' }); pctBox(sc.refl, { x: 0, y: 0, w: 1, h: 1 }); sc.refl.onerror = function () { this.remove(); };
        if (hasImg(v.refl)) sc.refl.src = imgUrl(v.refl);
        glow.appendChild(sc.refl);
      }
      if (v.newPhone) { sc.np = npGlowSvg(data.GEO.npDesk()); glow.appendChild(sc.np); }
      fr.appendChild(glow);
      sc.wash = el('div.rm2-wash.' + v.id, null, el('i.r'), el('i.b'));
      fr.appendChild(sc.wash);
      sc.spots = el('div.rv-spots');
      fr.appendChild(sc.spots);
      return sc;
    }
    function buildSubScene(s) {
      const sc = { kind: 'sub', def: s, id: s.id, w: s.w, h: s.h, z: s.enterZ, cx: 0.5, cy: 0.5, enterZ: s.enterZ, minZ: s.enterZ * 0.7, maxZ: s.maxZ || 8, slots: {} };
      const fr = (sc.el = el('div.rv-frame.rm2-subframe', { 'data-qa': 'room.view:' + s.id }));
      const out = (sc.out = el('div.rm2-outside.full'));
      // §9.8: a missing telephoto falls back to the plate, cropped and enlarged (soft) — the real photo covers it when present
      const crop = s.id === 'roof_tank' ? data.GEO.tankRect() : s.id === 'roof_rail' ? data.GEO.railRect() : (() => { const a = data.GEO.railRect(), b = data.GEO.railwinRect(); return { x: a.x + b.x * a.w, y: a.y + b.y * a.h, w: b.w * a.w, h: b.h * a.h }; })();
      sc.cropFb = el('div.rm2-cropfb');
      sc.cropFb.style.backgroundSize = (100 / crop.w) + '% ' + (100 / crop.h) + '%';
      sc.cropFb.style.backgroundPosition = (crop.x / (1 - crop.w) * 100) + '% ' + (crop.y / (1 - crop.h) * 100) + '%';
      out.appendChild(sc.cropFb);
      sc.slots.plate = new Slot(out, 'plate', { fallback: s.fallback });
      sc.slots.steps = new Slot(out, 'steps');
      sc.slots.ajar = new Slot(out, 'ajar');
      if (s.glow) sc.glowImgs = glowImgs(out, s.glow);
      if (s.ajar) { sc.ajarFx = el('img.rm2-fxi', { alt: '' }); sc.ajarFx.style.opacity = '0'; if (hasImg(s.ajar.dark)) sc.ajarFx.src = imgUrl(s.ajar.dark); out.appendChild(sc.ajarFx); }
      sc.snow = new Snow(out);
      sc.policeEl = el('div.rm2-police.sub', null, el('i.r'), el('i.b')); out.appendChild(sc.policeEl);
      if (s.id === 'roof_tank') { sc.torch = el('div.rm2-torchwash'); out.appendChild(sc.torch); }
      fr.appendChild(out);
      if (s.led) { const L = s.led(); sc.ledEl = el('i.rm2-led.rail' + (s.ledPx > 6 ? '.near' : '')); sc.ledEl.style.left = L.x * 100 + '%'; sc.ledEl.style.top = L.y * 100 + '%'; fr.appendChild(sc.ledEl); }
      sc.spots = el('div.rv-spots');
      fr.appendChild(sc.spots);
      return sc;
    }
    function glowImgs(parent, g) {
      const mk = (k) => { const i = el('img.rm2-fxi.glow', { alt: '' }); i.style.opacity = '0'; if (hasImg(k)) i.src = imgUrl(k); i.onerror = function () { this.remove(); }; parent.appendChild(i); return i; };
      const r = { light: mk(g.light), hand: mk(g.hand), cap: mk(g.cap), line: el('i.rm2-gapline'), pool: el('i.rm2-gappool') };
      parent.append(r.line, r.pool);
      return r;
    }
    function clockHands() {
      const c = data.GEO.clockBed(), V0 = V[data.indexOf('r2_bed')] || { w: 1024, h: 1536 };
      const r = c.r, rh = r * V0.w / V0.h;
      const node = el('div.rm2-clock', { html: '<svg viewBox="-1 -1 2 2"><line class="h" x1="0" y1="0" x2="0" y2="-0.5"/><line class="m" x1="0" y1="0" x2="0" y2="-0.78"/><circle r="0.05"/></svg>' });
      pctBox(node, { x: c.cx - r, y: c.cy - rh, w: 2 * r, h: 2 * rh });
      const h = node.querySelector('.h'), m = node.querySelector('.m');
      return { node, set() { const d = clockNow(); const mm = d.getMinutes(), hh = d.getHours() % 12; m.setAttribute('transform', 'rotate(' + mm * 6 + ')'); h.setAttribute('transform', 'rotate(' + (hh * 30 + mm * 0.5) + ')'); } };
    }
    function gapSvg(pts) {
      const s = el('div.rm2-gap', { html: '<svg viewBox="0 0 1 1" preserveAspectRatio="none"><polyline class="edge" points="' + pts.map((p) => p[0] + ',' + p[1]).join(' ') + '"/><line class="sill" x1="' + pts[2][0] + '" y1="' + (pts[2][1] - 0.002) + '" x2="' + pts[3][0] + '" y2="' + (pts[3][1] - 0.002) + '"/></svg>' });
      return s;
    }
    function npGlowSvg(q) {
      const b = bbox(q), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      return el('div.rm2-np', { html: '<svg viewBox="0 0 1 1" preserveAspectRatio="none"><polygon class="scr" points="' + q.map((p) => p[0] + ',' + p[1]).join(' ') + '"/><ellipse class="dot" cx="' + cx + '" cy="' + cy + '" rx="0.0025" ry="0.0017"/></svg>' });
    }

    const cur = () => scenes[scenes.length - 1];
    const base = () => scenes[0];
    function sceneYaw(sc) {
      if (!sc) return 0;
      if (sc.kind === 'sub') return sc.def.az;
      const h = Math.min(0.5, sw / (2 * sc.W * sc.s || 1));
      const panX = h >= 0.5 ? 0.5 : clamp((sc.cx - h) / (1 - 2 * h), 0, 1);
      return (((sc.def.az + (panX - 0.5) * 50) % 360) + 360) % 360;
    }
    inst.yaw = () => { const c2 = cuTop(); if (c2 && c2.def.yaw != null) return c2.def.yaw; return sceneYaw(cur()); };
    function applyYaw() { if (inst.closed || topInst() !== inst) return; try { G.audio && G.audio.setYaw && G.audio.setYaw(inst.yaw()); } catch (e) {} }

    function measure() { const r = stage.getBoundingClientRect(); sw = Math.max(1, r.width); sh = Math.max(1, r.height); }
    function layout(sc) {
      sc = sc || cur();
      if (!sc || inst.closed) return;
      measure();
      const cs = Math.max(sw / sc.w, sh / sc.h), W = sc.w * cs, H = sc.h * cs;
      const s = sc.kind === 'sub' ? sc.z / sc.enterZ : sc.z;
      sc.W = W; sc.H = H; sc.s = s;
      let tx = sw / 2 - sc.cx * W * s, ty = sh / 2 - sc.cy * H * s;
      tx = W * s <= sw ? (sw - W * s) / 2 : clamp(tx, sw - W * s, 0);
      const padB = cam && !cu.length ? PAD_B : 0;
      ty = H * s <= sh ? (sh - H * s) / 2 : clamp(ty, Math.min(0, sh - padB - H * s), 0);
      sc.cx = (sw / 2 - tx) / (W * s); sc.cy = (sh / 2 - ty) / (H * s);
      sc.tx = tx; sc.ty = ty;
      sc.el.style.width = W + 'px'; sc.el.style.height = H + 'px';
      sc.el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      sc.el.style.setProperty('--iz', String(1 / s));
      sc.el.style.setProperty('--fw', W + 'px');
      if (sc === cur()) { applyLight(sc); updatePill(); applyYaw(); root.classList.toggle('zoomed', sc.z > 1.05 || sc.kind === 'sub'); }
    }
    inst.layout = () => layout();
    function applyLight(sc) {
      if (!sc || sc.kind !== 'view' || !sc.litG) return;
      const isLit = !!data.lit();
      root.classList.toggle('flash-on', flash && !isLit);
      if (!flash || isLit) return;
      const s = sc.s || 1, px = sw / 2, py = sh * 0.46, rad = Math.max(sw, sh) * 0.38;
      const lx = (px - sc.tx) / s, ly = (py - sc.ty) / s, lr = rad / s;
      const m = 'radial-gradient(circle ' + lr + 'px at ' + lx + 'px ' + ly + 'px, #000 0%, rgba(0,0,0,.9) 38%, rgba(0,0,0,.32) 72%, transparent 100%)';
      sc.litG.style.webkitMaskImage = m; sc.litG.style.maskImage = m;
    }

    /* ---------- view switching ---------- */
    function setView(i, dir, opt) {
      opt = opt || {};
      vi = ((i % V.length) + V.length) % V.length;
      const v = V[vi];
      if (cam) { vr.view = v.id; save(); }
      const old = scenes.slice();
      const sc = buildViewScene(v);
      scenes = [sc];
      turnWrap.appendChild(sc.el);
      old.forEach((s) => killScene(s));
      if (dots) Array.prototype.forEach.call(dots.children, (n, k) => n.classList.toggle('on', k === vi));
      sc.z = 1; sc.cx = 0.5; sc.cy = 0.5;
      layout(sc);
      if (dir) {
        turnWrap.classList.remove('turn-l', 'turn-r'); void turnWrap.offsetWidth; turnWrap.classList.add(dir > 0 ? 'turn-r' : 'turn-l');
        if (!opt.silent) sfx('whoosh');
      }
      spotsSig = '';
      live(true);
      hideCaption();
      emitView();
    }
    function killScene(s) { if (!s) return; try { s.snow && s.snow.kill(); } catch (e) {} if (s.el && s.el.parentNode) s.el.remove(); }
    function emitView() { const c = cur(); emit('room:view', { view: V[vi].id, sub: c && c.kind === 'sub' ? c.id : null, zoom: c ? +c.z.toFixed(2) : 1, mode: eye ? 'eye' : 'camera' }); }
    function turn(d) {
      if (cu.length || inst.closed || locked()) return;
      if (cur() && cur().kind === 'sub') { exitAllSubs(); return; }
      setView(vi + d, d);
    }

    /* ---------- sub-views (§8.3-2 — zoom ≥ 2× over tank_rect / rail_rect, back below 1.5×) ---------- */
    function enterSub(id, center, z) {
      const def = data.subs[id]; if (!def) return;
      const parent = cur();
      const sc = buildSubScene(def);
      sc.z = z != null ? z : def.enterZ;
      if (center) { sc.cx = clamp(center.x, 0, 1); sc.cy = clamp(center.y, 0, 1); }
      sc.el.style.opacity = '0';
      turnWrap.appendChild(sc.el);
      scenes.push(sc);
      spotsSig = '';
      layout(sc);
      live(true);
      requestAnimationFrame(() => { sc.el.style.transition = 'opacity .25s linear'; sc.el.style.opacity = '1'; });
      if (parent) setTimeout(() => { if (scenes.indexOf(parent) >= 0 && cur() !== parent) parent.el.style.visibility = 'hidden'; }, 270);
      emitView();
      emit('room:zoom', { z: +sc.z.toFixed(2) });
    }
    function exitSub(z) {
      const sc = cur(); if (!sc || sc.kind !== 'sub') return;
      const parent = scenes[scenes.length - 2];
      parent.el.style.visibility = '';
      // map the sub centre back into the parent (inverse of the entry map)
      const back = mapSubToParent(sc, { x: sc.cx, y: sc.cy });
      if (back) { parent.cx = back.x; parent.cy = back.y; }
      const zz = z != null ? z : sc.z;
      parent.z = parent.kind === 'view' ? clamp(zz, 1, 1.45) : clamp(zz, parent.enterZ * 0.76, sc.enterZ * 0.95);
      scenes.pop();
      sc.el.style.transition = 'opacity .25s linear'; sc.el.style.opacity = '0';
      setTimeout(() => killScene(sc), 280);
      spotsSig = '';
      layout(parent);
      live(true);
      emitView();
      emit('room:zoom', { z: +parent.z.toFixed(2) });
    }
    function exitAllSubs() { while (cur() && cur().kind === 'sub') exitSub(1); const b = base(); if (b) { b.z = 1; layout(b); } }
    function plateOf(sc, p) { const pr = sc.plate; return { x: (p.x - pr.x) / pr.w, y: (p.y - pr.y) / pr.h }; }
    function mapParentToSub(parent, id, p) {
      if (id === 'roof_tank') { const m = data.GEO.tankMap(); return mapRect(plateOf(parent, p), m.plate, m.tank); }
      if (id === 'roof_rail') { const r = data.GEO.railRect(); return mapRect(plateOf(parent, p), r, { x: 0, y: 0, w: 1, h: 1 }); }
      if (id === 'rail_window') { const r = data.GEO.railwinRect(); return mapRect(p, r, { x: 0, y: 0, w: 1, h: 1 }); }
      return { x: 0.5, y: 0.5 };
    }
    function mapSubToParent(sc, p) {
      const parent = scenes[scenes.indexOf(sc) - 1]; if (!parent) return null;
      if (sc.id === 'roof_tank' || sc.id === 'roof_rail') {
        const pp = sc.id === 'roof_tank' ? mapRect(p, data.GEO.tankMap().tank, data.GEO.tankMap().plate) : mapRect(p, { x: 0, y: 0, w: 1, h: 1 }, data.GEO.railRect());
        const pr = parent.plate; return { x: pr.x + pp.x * pr.w, y: pr.y + pp.y * pr.h };
      }
      if (sc.id === 'rail_window') return mapRect(p, { x: 0, y: 0, w: 1, h: 1 }, data.GEO.railwinRect());
      return null;
    }
    function checkSub() {
      const sc = cur(); if (!sc || cu.length) return;
      if (sc.kind === 'sub' && sc.z < sc.enterZ * 0.75) { exitSub(sc.z); return; }
      const c = { x: sc.cx, y: sc.cy };
      if (sc.kind === 'view' && sc.def.outside && sc.z >= 2 - 1e-3) {
        const p = plateOf(sc, c);
        if (inRect(p, data.GEO.tankRect())) { enterSub('roof_tank', mapParentToSub(sc, 'roof_tank', c), sc.z); return; }
        if (inRect(p, data.GEO.railRect())) { enterSub('roof_rail', mapParentToSub(sc, 'roof_rail', c), sc.z); return; }
      }
      if (sc.kind === 'sub' && sc.id === 'roof_rail' && sc.z >= data.subs.rail_window.enterZ - 1e-3 && inRect(c, data.GEO.railwinRect())) {
        enterSub('rail_window', mapParentToSub(sc, 'rail_window', c), sc.z);
      }
    }

    /* ---------- zoom ---------- */
    let zAnim = 0;
    function zoomTo(nz, fx, fy, instant) {
      const sc = cur(); if (!sc) return;
      nz = clamp(nz, sc.minZ, sc.maxZ);
      cancelAnimationFrame(zAnim);
      const z0 = sc.z, cx0 = sc.cx, cy0 = sc.cy, cx1 = fx != null ? fx : sc.cx, cy1 = fy != null ? fy : sc.cy;
      if (instant) { sc.z = nz; sc.cx = cx1; sc.cy = cy1; layout(sc); emit('room:zoom', { z: +sc.z.toFixed(2) }); checkSub(); return; }
      const t0 = now(), dur = 300;
      const step = () => {
        if (inst.closed || cur() !== sc) return;
        const k = Math.min(1, (now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        sc.z = z0 + (nz - z0) * e; sc.cx = cx0 + (cx1 - cx0) * e; sc.cy = cy0 + (cy1 - cy0) * e;
        layout(sc);
        if (k < 1) zAnim = requestAnimationFrame(step); else { emit('room:zoom', { z: +sc.z.toFixed(2) }); checkSub(); }
      };
      zAnim = requestAnimationFrame(step);
    }
    function pillZoom(z) {
      if (z <= 1) { if (cur().kind === 'sub') exitAllSubs(); zoomTo(1); return; }
      const sc = cur();
      if (sc.kind === 'sub') { zoomTo(Math.max(sc.minZ, Math.min(sc.maxZ, z))); return; }
      zoomTo(z);
    }
    function updatePill() {
      if (!pill) return;
      const z = cur() ? cur().z : 1, ps = [1, 2, 8];
      Array.prototype.forEach.call(pill.children, (b, i) => {
        const p = ps[i], nx = ps[i + 1];
        const onp = z >= p - 0.02 && (nx == null || z < nx - 0.02);
        b.classList.toggle('on', onp);
        b.textContent = onp && Math.abs(z - p) > 0.05 ? z.toFixed(1) + '×' : p + '×';
      });
    }

    /* ---------- input: drag (look around / turn at the edge) · pinch · wheel · double tap ---------- */
    const ptrs = new Map();
    let drag = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 }, wheelT = 0;
    function locked() { return lockUntil && now() < lockUntil; }
    inst.dragging = () => !!(drag && drag.moved);
    stage.style.touchAction = 'none';
    stage.addEventListener('pointerdown', (e) => {
      if (locked() || cu.length) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const sc = cur(); if (!sc) return;
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: sc.cx, cy: sc.cy, t: now(), moved: false, id: e.pointerId, over: 0 };
      else if (ptrs.size === 2 && allowZoom) {
        const ps = Array.from(ptrs.values()), r = stage.getBoundingClientRect();
        const mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, z0: sc.z, ix: (mx - sc.tx) / (sc.W * sc.s), iy: (my - sc.ty) / (sc.H * sc.s) };
        if (drag) drag.moved = true;
        try { stage.setPointerCapture(e.pointerId); } catch (er) {}
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const sc = cur(); if (!sc) return;
      if (ptrs.size >= 2 && pinch) {
        const ps = Array.from(ptrs.values()), r = stage.getBoundingClientRect();
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        const mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        sc.z = clamp(pinch.z0 * (d / pinch.d), sc.minZ, sc.maxZ);
        const s = sc.kind === 'sub' ? sc.z / sc.enterZ : sc.z;
        sc.cx = (sw / 2 - (mx - pinch.ix * sc.W * s)) / (sc.W * s);
        sc.cy = (sh / 2 - (my - pinch.iy * sc.H * s)) / (sc.H * s);
        layout(sc);
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; try { stage.setPointerCapture(e.pointerId); } catch (er) {} }
      if (!drag.moved) return;
      const s = sc.s || 1, want = drag.cx - dx / (sc.W * s);
      sc.cx = want; sc.cy = drag.cy - dy / (sc.H * s);
      layout(sc);
      // overscroll past the pan edge (px) → turn on release
      drag.over = (want - sc.cx) * sc.W * s;
      turnWrap.style.transform = sc.kind === 'view' && Math.abs(drag.over) > 4 ? 'translateX(' + clamp(-drag.over * 0.25, -40, 40) + 'px)' : '';
    });
    const endPtr = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      const sc = cur();
      if (ptrs.size < 2 && pinch) { pinch = null; emit('room:zoom', { z: sc ? +sc.z.toFixed(2) : 1 }); checkSub(); }
      if (drag && drag.id === e.pointerId) {
        turnWrap.style.transform = '';
        const d = drag, dt = now() - d.t, dx = e.clientX - d.x;
        if (d.moved && sc && sc.kind === 'view' && sc.z <= 1.05 && !locked()) {
          // dragging on past the edge of the picture turns to the next wall (drag / arrows only — no sensors, ARCH §1)
          if (Math.abs(d.over) > 48 || (Math.abs(d.over) > 8 && Math.abs(dx) > 90 && dt < 400)) turn(d.over < 0 ? -1 : 1);
        }
        if (!d.moved && allowZoom && e.pointerType !== 'mouse' && !e.target.closest('.rv-spot')) {
          const t = now();
          if (t - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { dblTap(e); lastTap.t = 0; } else lastTap = { t, x: e.clientX, y: e.clientY };
        }
        setTimeout(() => { if (drag === d) drag = null; }, 0);
      }
      if (ptrs.size === 1 && sc) { const id = Array.from(ptrs.keys())[0], p = ptrs.get(id); drag = { x: p.x, y: p.y, cx: sc.cx, cy: sc.cy, t: now(), moved: true, id, over: 0 }; }
    };
    stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
    let lastPT = 'mouse';
    stage.addEventListener('pointerdown', (e) => { lastPT = e.pointerType || 'mouse'; }, true);
    stage.addEventListener('dblclick', (e) => { if (lastPT === 'mouse' && allowZoom && !locked() && !e.target.closest('.rv-spot')) dblTap(e); });
    function dblTap(e) {
      const sc = cur(); if (!sc) return;
      const r = stage.getBoundingClientRect(), s = sc.s || 1;
      const ix = (e.clientX - r.left - sc.tx) / (sc.W * s), iy = (e.clientY - r.top - sc.ty) / (sc.H * s);
      if (sc.kind === 'sub') { exitAllSubs(); return; }
      zoomTo(sc.z > 1.5 ? 1 : 2, sc.z > 1.5 ? 0.5 : ix, sc.z > 1.5 ? 0.5 : iy);
    }
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!allowZoom || locked() || cu.length) return;
      const sc = cur(); if (!sc) return;
      const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, s0 = sc.s || 1;
      const ix = (mx - sc.tx) / (sc.W * s0), iy = (my - sc.ty) / (sc.H * s0);
      sc.z = clamp(sc.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), sc.minZ, sc.maxZ);
      const s = sc.kind === 'sub' ? sc.z / sc.enterZ : sc.z;
      sc.cx = (sw / 2 - (mx - ix * sc.W * s)) / (sc.W * s); sc.cy = (sh / 2 - (my - iy * sc.H * s)) / (sc.H * s);
      layout(sc);
      clearTimeout(wheelT); wheelT = setTimeout(() => { emit('room:zoom', { z: +sc.z.toFixed(2) }); checkSub(); }, 180);
    }, { passive: false });
    const onKey = (e) => {
      if (inst.closed || topInst() !== inst || locked()) return;
      const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return;
      try { if ((G.notebook && G.notebook.isOpen && G.notebook.isOpen()) || (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())) return; } catch (er) {}
      if (cam && entry && G.phone && G.phone.top && G.phone.top() !== entry) return;
      if (cu.length) return;
      if (e.key === 'ArrowLeft') { turn(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { turn(1); e.preventDefault(); }
      else if (allowZoom && (e.key === '+' || e.key === '=')) { const sc = cur(); zoomTo(sc.z * 1.6); }
      else if (allowZoom && e.key === '-') { const sc = cur(); if (sc.kind === 'sub' && sc.z / 1.6 < sc.enterZ * 0.75) exitSub(sc.z / 1.6); else zoomTo(sc.z / 1.6); }
    };
    window.addEventListener('keydown', onKey);
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => { layout(); cu.forEach((c) => c.viewer && c.viewer.layout()); }); ro.observe(stage); }
    else window.addEventListener('resize', inst.layout);

    /* ---------- hotspots ---------- */
    function spotList(sc) {
      if (sc.kind === 'sub') return sc.def.hotspots || [];
      const v = sc.def;
      if (o.m0 && v.m0Spots) return v.m0Spots;
      if (o.handle && v.handleSpots) return v.handleSpots;
      return v.hotspots || [];
    }
    function renderSpots(sc) {
      const list = spotList(sc).filter((h) => { try { return !h.when || h.when(); } catch (e) { return false; } });
      const sig = sc.id + ':' + list.map((h) => h.id).join(',');
      if (sig === spotsSig && sc.spots.childElementCount) return;
      spotsSig = sig;
      sc.spots.innerHTML = '';
      const glassB = sc.def.outside ? bbox(data.GEO.glass()) : null;
      list.forEach((h) => {
        let r = { x: h.x, y: h.y, w: h.w, h: h.h };
        if (h.coord === 'plate' && sc.plate) {
          const pr = sc.plate; r = { x: pr.x + h.x * pr.w, y: pr.y + h.y * pr.h, w: h.w * pr.w, h: h.h * pr.h };
          if (glassB) { const x0 = Math.max(r.x, glassB.x), y0 = Math.max(r.y, glassB.y), x1 = Math.min(r.x + r.w, glassB.x + glassB.w), y1 = Math.min(r.y + r.h, glassB.y + glassB.h); if (x1 <= x0 || y1 <= y0) return; r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
        }
        const b = pctBox(el('button.rv-spot', { 'data-qa': 'room.spot:' + h.id, dataset: { id: h.id } }), r);
        b.addEventListener('click', (e) => { e.stopPropagation(); if (inst.dragging() || locked()) return; tapSpot(h, sc, r); });
        sc.spots.appendChild(b);
      });
    }
    function tapSpot(h, sc, r) {
      sfx('tap');
      emit('room:spot', { id: h.id });
      if (h.act) { act(h.act, h); return; }
      const text = h.cap ? data.cap[h.cap] : null;
      if (h.open) { openCloseup(h.open, { cap: text }); return; }
      if (h.sub && allowZoom) {
        const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 }, f = data.subs[h.sub].focus;
        enterSub(h.sub, f || mapParentToSub(sc, h.sub, c), data.subs[h.sub].enterZ);
        if (text) caption(text);
        return;
      }
      if (text) caption(text);
    }
    function act(name) {
      if (name === 'openDoorM0') { openCloseup('p2_door_open'); return; }
      if (name === 'handle') { FX.handle = { t0: now() }; fxRun(); finish('handle'); return; }
    }

    /* ---------- captions (§4.7.6 — one line at the bottom, description only) ---------- */
    let capT = 0;
    function hideCaption() { clearTimeout(capT); capEl.classList.remove('in'); }
    function caption(text, ms) {
      const t = T(text); if (!t) return;
      const target = cuTop() ? cuTop().capEl : capEl;
      clearTimeout(capT);
      target.textContent = t;
      target.classList.remove('in'); void target.offsetWidth; target.classList.add('in');
      if (target === capEl) capT = setTimeout(() => capEl.classList.remove('in'), ms || Math.max(2800, t.length * 130));
    }

    /* ---------- direction subtitles (§7.4 rule 1 — at the direction's place, no direction words) ---------- */
    inst.dirSub = function (text, az, ms) {
      const t = T(text); if (!t) return;
      const yaw = inst.yaw(), rel = az == null ? 0 : relAz(az, yaw);
      const n = el('div.rm2-dirsub', null, t);
      let x = 50, y = 64;
      if (az != null) {
        if (Math.abs(rel) <= 28) x = 50 + (rel / 28) * 26;
        else if (Math.abs(rel) <= 135) x = rel > 0 ? 76 : 24;
        else { x = 50; y = 72; }
      }
      n.style.left = x + '%'; n.style.top = y + '%';
      subsEl.appendChild(n);
      Array.prototype.slice.call(subsEl.children, 0, -2).forEach((c) => c.remove());
      placeSub(n, x);
      requestAnimationFrame(() => { placeSub(n, x); n.classList.add('in'); });
      setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, ms || 2600);
    };
    /** keep the whole line on screen: the side anchors (24 % / 76 %) shift inward by what a long line needs (10 px margin) —
     *  it still sits toward its side; the width itself is capped by CSS (.rm2-dirsub max-width ≤ 70 %, long lines wrap) */
    function placeSub(n, x) {
      const W = subsEl.clientWidth, w = n.offsetWidth, m = 10;
      if (!W || !w) return;                                   // room hidden / not laid out yet — keep the % anchor
      n.style.left = Math.max(m + w / 2, Math.min(W - m - w / 2, (x / 100) * W)) + 'px';
    }

    /* ---------- flash ---------- */
    function setFlash(v) {
      if (!cam) return;
      flash = !!v; vr.flash = flash; save();
      if (flashBtn) flashBtn.classList.toggle('on', flash);
      applyLight(cur());
      live();
    }
    inst.setFlash = setFlash;
    inst.flash = () => flash;
    if (flashBtn) flashBtn.classList.toggle('on', flash);

    /* ---------- shutter (camera roll — vars.shots, no progress) ---------- */
    function shoot() {
      if (cu.length) return;
      sfx('shutter');
      if (!reduceFlash()) { shotFx.classList.remove('go'); void shotFx.offsetWidth; shotFx.classList.add('go'); }
      const sc = cur(), v = V[vi];
      let key = v.key;
      if (sc.kind === 'sub') key = sc.slots.plate.key || key;
      const rec = { t: clockNow().getTime(), view: sc.kind === 'sub' ? sc.id : v.id, key, zoom: +sc.z.toFixed(2), lit: !!data.lit() };
      const shots = (vars().shots = vars().shots || []);
      shots.unshift(rec); if (shots.length > 30) shots.length = 30;
      save();
      if (thumb) thumb.style.backgroundImage = 'url("' + imgUrl(key) + '")';
      emit('room:shot', { view: v.id, sub: sc.kind === 'sub' ? sc.id : null, zoom: rec.zoom });
    }

    /* ---------- live layers: re-evaluated on every world event, cross-faded in view (§6.3 rule 1) ---------- */
    function live(first) {
      if (inst.closed) return;
      const w = data.world();
      if (FX.lit) w.lit = true;                  // G.room.lightsOn() comes a beat before doorOpened (ARCH §3.2 B20 order)
      const isLit = !!w.lit;
      root.classList.toggle('lit-room', isLit);
      root.classList.toggle('police-on', policeActive() && !isLit);
      root.classList.toggle('rm2-lowend', lowEnd());
      root.classList.toggle('rm2-calm', reduceMotion());
      root.classList.toggle('rm2-noflash', reduceFlash());   // 깜빡임 줄이기 (or reduced motion): every blink ≤ 0.5 Hz (§10 H)
      const drilling = !!(flag('M6') && !flag('M7') && !flag('C2'));
      root.classList.toggle('rm2-drill', !!(flag('M6') && !flag('M7')));
      root.classList.toggle('rm2-spin', drilling);
      try { const t0 = drilling && G.climax && G.climax.drillT0 && G.climax.drillT0(); if (t0) root.style.setProperty('--drill-delay', -((now() - t0) % 6000) + 'ms'); } catch (e) {}
      root.classList.toggle('rm2-m0', !!o.m0);
      scenes.forEach((sc) => liveScene(sc, w, first));
      const sc = cur(); if (sc) { renderSpots(sc); applyLight(sc); }
      cu.forEach((c) => c.live && c.live(w));
    }
    inst.live = live;
    function plateFade(sc, slot, nextKey, w) {
      const prev = slot.key;
      if (prev === undefined) return 0;
      const wasDark = /_s2d$/.test(prev || ''), isDark = /_s2d$/.test(nextKey || '');
      if (!wasDark && isDark) return 250;                 // switch off (§6.2 B12 — like a switch)
      if (wasDark && !isDark) return lowEnd() ? 250 : 1200; // 00:50 back on
      if (lowEnd()) return 250;
      return now() - FX.lastJumpAt < 4000 ? 8000 : 60000;   // snow: 60 s in view, 8 s after a clock jump (§6.1.7)
    }
    function liveScene(sc, w, first) {
      const d = sc.def;
      if (sc.kind === 'view') {
        if (d.id === 'r2_door') {
          ['dark', 'lit'].forEach((k) => {
            const o2 = sc.objs[k];
            const want = flag('gotPhone') && hasImg('p_door_box') ? imgUrl('p_door_box') : '';
            if (o2.box && o2.box.getAttribute('src') !== want) { if (want) o2.box.src = want; else { o2.box.removeAttribute('src'); o2.box.classList.remove('ok'); } }
          });
          const red = flag('M6') && !flag('M7');
          sc.led.className = 'rm2-led lock ' + (red ? 'red' : 'green');
          const g = gapState();
          sc.gap.className = 'rm2-gap' + (g ? ' ' + g : '');
        }
        if (d.outside) {
          const key = d.outside.plate();
          let filt = '';
          if (flash && !w.lit) filt = 'brightness(.7)'; else if (w.lit) filt = 'brightness(.8)';
          sc.slots.plate.set(key, { fade: first ? 0 : plateFade(sc, sc.slots.plate, key, w), filter: filt, cls: (!first && /_s2d$/.test(sc.slots.plate.key || '') && !/_s2d$/.test(key)) ? 'rm2-flicker' : '' });
          sc.out.style.filter = '';
          stepsLive(sc, d.outside.steps, w, first);
          ajarLive(sc, d.outside.ajar, w, first);
          sc.snow.setCount(SNOW_N[w.snow] || 0);
          sc.policeEl.classList.toggle('on', policeActive() && !w.lit);
          sc.glare.classList.toggle('on', flash && !w.lit);
          if (sc.refl) sc.refl.classList.toggle('on', !!w.lit);
          fxScene(sc, now());
        }
        if (d.wallClock) ['dark', 'lit'].forEach((k) => sc.objs[k].clock && sc.objs[k].clock.set());
        if (d.newPhone && sc.np) sc.np.className = 'rm2-np ' + npState();
        sc.wash.classList.toggle('on', policeActive() && !w.lit);
      } else {
        const key = d.key();
        const pk = 'roof_plate_' + data.plateState();
        if (sc.cropFb && sc.cropFb.dataset.k !== pk) { sc.cropFb.dataset.k = pk; sc.cropFb.style.backgroundImage = hasImg(pk) ? 'url("' + imgUrl(pk) + '")' : ''; }
        sc.slots.plate.set(key, { fade: first ? 0 : plateFade(sc, sc.slots.plate, key, w), cls: (!first && /_s2d$/.test(sc.slots.plate.key || '') && !/_s2d$/.test(key)) ? 'rm2-flicker' : '' });
        if (d.steps) stepsLive(sc, d.steps, w, first);
        if (d.ajar) ajarLive(sc, d.ajar, w, first);
        if (d.railSteps) sc.slots.steps.set(w.footprints >= 2 && w.light && hasImg(d.railSteps) ? d.railSteps : null, { fade: first ? 0 : 1200 });
        sc.snow.setCount(SNOW_N[w.snow] || 0);
        sc.policeEl.classList.toggle('on', policeActive());
        if (sc.ledEl) sc.ledEl.className = 'rm2-led rail ' + (d.ledPx > 6 ? 'near ' : '') + w.led;
        fxScene(sc, now());
      }
    }
    function npState() {
      const s = data.newPhoneScreen();
      return s === 'frp' ? 'frp' : s === 'boot' ? 'boot' : s === 'wipe' ? 'wipe' : 'bat';
    }
    function stepsLive(sc, keys, w, first) {
      if (w.footprints < 1) { sc.slots.steps.set(null, { fade: 400 }); if (sc.slots.steps2) sc.slots.steps2.set(null, { fade: 400 }); return; }
      if (policeActive() && !w.light) sc.slots.steps.set(keys.dark, { fade: first ? 0 : 8000, opacity: 0.9 });
      else if (w.light) sc.slots.steps.set(keys.lit, { fade: first ? 0 : 1200 });
      else sc.slots.steps.set(null, { fade: 1200 });
      if (sc.slots.steps2 && keys.two) sc.slots.steps2.set(w.footprints >= 2 && w.light ? keys.two : null, { fade: first ? 0 : 1200 });
    }
    function ajarLive(sc, keys, w, first) {
      const open = w.tankOpened || (FX.beams && FX.beams.reached);
      sc.slots.ajar.set(open && !FX.ajar ? (w.light ? keys.lit : keys.dark) : null, { fade: first ? 0 : 600 });
    }
    /** per-frame effects of this scene (B09 glow, B17 ajar, B16 beams) */
    function fxScene(sc, t) {
      if (sc.glowImgs) {
        const g = glowAt(t), gi = sc.glowImgs;
        gi.light.style.opacity = g ? String(g.light) : '0';
        gi.hand.style.opacity = g ? String(g.hand) : '0';
        gi.cap.style.opacity = g ? String(g.cap) : '0';
        // 1× window: the PNG line is sub-pixel at this scale → a thin CSS line + the pool of light on the snow in front of the door
        // (§6.3 "1× 화면에선 틈의 가는 흰 선 + 문 앞 눈에 번지는 빛"); telephoto: CSS only when the PNGs are missing (§9.8)
        const noPng = !gi.light.getAttribute('src') || !gi.light.naturalWidth;
        const css = sc.kind === 'view' || noPng;
        gi.line.style.opacity = g && css ? String(g.light) : '0';
        gi.pool.style.opacity = g && css ? String(g.light * 0.85) : '0';
        if (g && css && !gi.placed) {
          gi.placed = true;
          const gb = bbox(sc.kind === 'view' ? data.GEO.gapPlate() : data.GEO.gapTank());
          pctBox(gi.line, gb);
          const pw = sc.kind === 'view' ? 0.07 : 0.3, ph = sc.kind === 'view' ? 0.05 : 0.06;
          pctBox(gi.pool, { x: gb.x + gb.w / 2 - pw / 2, y: gb.y + gb.h - ph * 0.45, w: pw, h: ph });
        }
      }
      if (sc.ajarFx) { const a = ajarAt(t); sc.ajarFx.style.opacity = a ? String(a.v) : '0'; }
      if (sc.beamsEl) {
        const b = beamsAt(t), is = sc.beamsEl.children;
        sc.beamsEl.classList.toggle('on', !!b);
        if (b) {
          const o2 = data.GEO.beamOrigin(), ar = sc.def.outside ? sc.def.outside.w / sc.def.outside.h : 1.5;
          [b.a, b.b].forEach((p, k) => {
            const dx = (p.x - o2.x) * ar, dy = p.y - o2.y, ang = Math.atan2(dy, dx) * 180 / Math.PI, len = Math.hypot(dx, dy) / ar;
            const n = is[k];
            n.style.left = o2.x * 100 + '%'; n.style.top = o2.y * 100 + '%'; n.style.width = len * 100 + '%';
            n.style.transform = 'translateY(-50%) rotate(' + ang + 'deg)'; n.style.opacity = String(b.k * (k ? 0.75 : 1));
          });
        }
      }
      if (sc.torch) { const b = beamsAt(t); sc.torch.classList.toggle('on', !!(b && b.onDoor)); }
    }
    inst.fx = function (t) {
      if (inst.closed) return;
      scenes.forEach((sc) => fxScene(sc, t));
      const hd = FX.handle;
      const b = base();
      if (b && b.def.id === 'r2_door') {
        const e = hd ? t - hd.t0 : 1e9, show = e < 140;
        ['dark', 'lit'].forEach((k) => { const h = b.objs[k].handle; if (h) h.classList.toggle('ok', show); });
        b.el.classList.toggle('rm2-jerk', e >= 140 && e < 280);
      }
      cu.forEach((c) => c.fx && c.fx(t));
    };

    /* ======================= close-ups ======================= */
    function cuTop() { return cu[cu.length - 1] || null; }
    function makeViewer(w, h, fit, maxZ) {
      const box = el('div.rm2-cuv'), inner = el('div.rm2-cui');
      inner.style.width = w + 'px'; inner.style.height = h + 'px';
      box.appendChild(inner);
      let s = 1, cx = 0.5, cy = 0.5, bw = 1, bh = 1, f = 1, moved = false, g = 0;
      /** gestures(): bumps on every zoom the player makes by hand (pinch · double-tap · wheel) — pans don't count */
      const vw = { box, inner, moved: () => moved, gestures: () => g, get scale() { return s; } };
      vw.layout = function () { const r = box.getBoundingClientRect(); bw = r.width || 1; bh = r.height || 1; f = fit === 'cover' ? Math.max(bw / w, bh / h) : Math.min(bw / w, bh / h); apply(); };
      function apply(anim) {
        const k = f * s, W = w * k, H = h * k;
        let tx = bw / 2 - cx * W, ty = bh / 2 - cy * H;
        tx = W <= bw ? (bw - W) / 2 : clamp(tx, bw - W, 0); ty = H <= bh ? (bh - H) / 2 : clamp(ty, bh - H, 0);
        cx = (bw / 2 - tx) / W; cy = (bh / 2 - ty) / H;
        inner.style.transition = anim ? 'transform .32s cubic-bezier(.2,.9,.3,1)' : 'none';
        inner.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')';
        inner.style.setProperty('--ik', String(1 / k));
      }
      vw.zoomTo = function (x, y, z, anim) { s = clamp(z, 1, maxZ); cx = x; cy = y; apply(anim !== false); };
      /** zoom onto a rect in image fractions {x0,y0,x1,y1}: centred on it, as close as `zCap` allows while the whole rect
       *  stays inside `fill` of the viewer (the zoom follows the phone's width — a fixed z crops it on narrow / tall screens) */
      vw.fitZoom = function (r, zCap, fill) {
        fill = fill || 0.92;
        const k1 = Math.max(1e-3, r.x1 - r.x0) * w * f, k2 = Math.max(1e-3, r.y1 - r.y0) * h * f;   // rect size at z = 1, px
        return Math.max(1, Math.min(zCap || maxZ, maxZ, (fill * bw) / k1, (fill * bh) / k2));
      };
      const ps = new Map(); let st = null, pin = null, lt = 0;
      box.style.touchAction = 'none';
      box.addEventListener('pointerdown', (e) => {
        ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ps.size === 1) { st = { x: e.clientX, y: e.clientY, cx, cy }; moved = false; }
        else if (ps.size === 2) { const a = Array.from(ps.values()); pin = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, s0: s }; moved = true; g++; }
      });
      box.addEventListener('pointermove', (e) => {
        if (!ps.has(e.pointerId)) return;
        ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ps.size >= 2 && pin) { const a = Array.from(ps.values()); s = clamp(pin.s0 * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / pin.d, 1, maxZ); apply(); return; }
        if (!st) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (!moved && Math.hypot(dx, dy) > 7) { moved = true; try { box.setPointerCapture(e.pointerId); } catch (er) {} }
        if (moved && s > 1.01) { const k = f * s; cx = st.cx - dx / (w * k); cy = st.cy - dy / (h * k); apply(); }
      });
      const up = (e) => {
        ps.delete(e.pointerId); if (ps.size < 2) pin = null;
        if (!ps.size) { const t = now(); if (!moved && e.pointerType !== 'mouse' && t - lt < 300 && !e.target.closest('button')) { dbl(e); lt = 0; } else if (!moved) lt = t; setTimeout(() => { moved = false; }, 0); st = null; }
      };
      box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
      box.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) dbl(e); });
      function dbl(e) { g++; const r = inner.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; if (s > 1.3) vw.zoomTo(0.5, 0.5, 1); else vw.zoomTo(x, y, Math.min(2, maxZ)); }
      box.addEventListener('wheel', (e) => { e.preventDefault(); g++; s = clamp(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, maxZ); apply(); }, { passive: false });
      return vw;
    }
    function cuImg(inner, key, w, h, onfail) {
      const i = el('img.rm2-cuimg', { alt: '', draggable: 'false' });
      i.style.width = w + 'px'; i.style.height = h + 'px';
      i.onerror = function () { this.remove(); onfail && onfail(); };
      if (hasImg(key)) i.src = imgUrl(key); else setTimeout(() => onfail && onfail(), 0);
      inner.appendChild(i);
      return i;
    }
    function cuSpots(c, list, w, h) {
      c.spotsEl.innerHTML = '';
      list.forEach((sp) => {
        const b = el('button.rv-spot.cu', { 'data-qa': 'room.spot:' + sp.id, dataset: { id: sp.id } });
        b.style.left = sp.x * w + 'px'; b.style.top = sp.y * h + 'px'; b.style.width = sp.w * w + 'px'; b.style.height = sp.h * h + 'px';
        b.addEventListener('click', (e) => { e.stopPropagation(); if (c.viewer.moved()) return; sfx('tap'); emit('room:spot', { id: sp.id }); c.onSpot(sp); });
        c.spotsEl.appendChild(b);
      });
    }
    function openCloseup(id, opt) {
      opt = opt || {};
      const def = data.closeups[id]; if (!def) return null;
      const c = { id, def, w: def.w, h: def.h };
      const node = el('div.rm2-cu.' + id + (def.fit === 'contain' ? '.contain' : ''));
      const viewer = (c.viewer = makeViewer(def.w, def.h, def.fit, def.maxZ || 3));
      c.spotsEl = el('div.rm2-cuspots');
      c.capEl = el('div.rm2-cucap');
      node.append(viewer.box, c.capEl);
      if (!def.noBack) {
        const bb = el('button.rm2-btn.rm2-cuback', { 'data-qa': 'closeup.close', 'aria-label': '돌아가기', html: ICON.left });
        bb.addEventListener('click', () => cuBack());
        node.appendChild(bb);
      }
      c.node = node; c.onSpot = () => {};
      const builder = CU[id] || CU.simple;
      const emitId = builder(c, opt) || def.key || id;
      viewer.inner.appendChild(c.spotsEl);
      cuLayer.appendChild(node);
      cu.push(c);
      cuLayer.classList.add('on');
      root.classList.add('rm2-hascu');
      requestAnimationFrame(() => { viewer.layout(); node.classList.add('in'); });
      hideCaption();
      const text = opt.cap != null ? opt.cap : def.cap ? data.cap[def.cap] : null;
      if (text) setTimeout(() => { if (cuTop() === c) caption(text); }, 120);
      if (c.live) c.live(data.world());
      emit('room:closeup', { id: emitId });
      applyYaw();
      return new Promise((res) => { c.resolve = res; });
    }
    function closeCloseup() {
      const c = cu.pop(); if (!c) return;
      sfx('back');
      c.node.classList.remove('in');
      try { c.onClose && c.onClose(); } catch (e) {}
      setTimeout(() => { c.node.remove(); c.snow && c.snow.kill(); }, 260);
      if (!cu.length) { cuLayer.classList.remove('on'); root.classList.remove('rm2-hascu'); layout(); }
      c.resolve && c.resolve();
      applyYaw();
    }
    /** ‹ · Esc · phone back on the top close-up. While the box lid's handwriting zoom is up (lidZoom — §3.1 ①, the lid tap
     *  is the only other way out of it) the first press steps back out to the whole box; the next one closes. Only that
     *  zoom: once the player pinches / double-taps / wheels, the zoom is theirs and ‹ closes as on any other close-up. */
    function cuBack() {
      const c = cuTop(); if (!c) return;
      const vw = c.viewer;
      if (c.lidZoomed && vw && vw.scale > 1.05 && vw.gestures() === c.lidG) {
        c.lidZoomed = false;
        sfx('back');
        vw.zoomTo(0.5, 0.5, 1);
        return;
      }
      closeCloseup();
    }
    inst.closeup = (id) => openCloseup(id) || Promise.resolve();

    const CU = {
      simple(c) { const d = c.def; cuImg(c.viewer.inner, d.key, d.w, d.h); return d.key; },
      p2_door_open(c) {
        const d = c.def;
        cuImg(c.viewer.inner, d.key, d.w, d.h, () => { c.node.classList.add('rm2-fb'); c.viewer.inner.prepend(drawing('door', d.w, d.h)); });
        const sn = el('div.rm2-cusnow'); sn.style.left = 0.472 * d.w + 'px'; sn.style.top = 0.205 * d.h + 'px'; sn.style.width = 0.125 * d.w + 'px'; sn.style.height = 0.63 * d.h + 'px';
        c.viewer.inner.appendChild(sn);
        c.snow = new Snow(sn); c.snow.setCount(24);
        cuSpots(c, d.spots, d.w, d.h);
        c.onSpot = (sp) => { if (sp.open) openCloseup(sp.open, { m0: true }); };
        return 'p2_door_open';
      },
      box(c, opt) {
        const d = c.def, m0 = !!(o.m0 && !flag('gotPhone'));
        const st = (c.st = { m0, lifted: !!(o.m0 && boxLifted) });
        const imgHost = el('div.rm2-cuimgs'); c.viewer.inner.appendChild(imgHost);
        const render = () => {
          imgHost.innerHTML = '';
          const k = d.key(st);
          cuImg(imgHost, hasImg(k) ? k : d.fallbackKey(st), d.w, d.h, () => { c.node.classList.add('rm2-fb'); imgHost.prepend(drawing('box' + (st.lifted || !st.m0 ? '.lifted' : ''), d.w, d.h)); });
          lidName(imgHost, st.lifted || !st.m0 ? data.GEO.lidNameLifted() : data.GEO.lidName(), d.w, d.h);
          if (st.m0 && !st.lifted) phoneAlarm(imgHost, d.phoneQuad || data.GEO.boxPhone(), d.w, d.h, d.alarm);
          cuSpots(c, st.m0 && !st.lifted ? d.spotsPhone : d.spotsLifted, d.w, d.h);
        };
        render();
        c.onSpot = (sp) => {
          if (sp.act === 'lid') {
            setFlag('boxHand'); seenNote();
            lidZoom(c, d.lid);
            return;
          }
          if (sp.act === 'pickPhone') { pickPhone(c, st, render); return; }
          if (sp.open) openCloseup(sp.open);
        };
        return st.m0 ? (st.lifted ? 'box_top_lifted' : 'box_top') : 'box_top_lifted_in';
      },
      note_card(c) {
        const d = c.def, W = d.w, H = d.h;
        const flip = el('button.rm2-flip', { 'data-qa': 'note.flip' });
        flip.style.width = W + 'px'; flip.style.height = H + 'px';
        const f = el('div.rm2-face.front'), b = el('div.rm2-face.back');
        cuImg(f, d.front, W, H, () => f.appendChild(el('div.rm2-cardfb.front', null, el('span.hand', null, T(d.frontText.text)))));
        cuImg(b, d.back, W, H, () => b.appendChild(el('div.rm2-cardfb.back', null, el('b', null, T(d.backText[0])), el('hr'), el('span', null, T(d.backText[1])))));
        flip.append(f, b);
        c.viewer.inner.appendChild(flip);
        let back = false;
        flip.addEventListener('click', (e) => {
          e.stopPropagation(); if (c.viewer.moved()) return;
          back = !back; flip.classList.toggle('flipped', back); sfx('pageTurn');
          if (back) { setFlag('boxNote'); seenNote(); }
        });
        return 'note_card';
      },
      polaroid(c) {
        const d = c.def;
        setFlag('polaroidSeen');
        const flip = el('button.rm2-flip.pol');
        flip.style.width = d.w + 'px'; flip.style.height = d.h + 'px';
        const f = el('div.rm2-face.front'), b = el('div.rm2-face.back');
        cuImg(f, d.front, d.w, d.h, () => f.appendChild(el('div.rm2-polfb')));
        cuImg(b, d.back, d.w, d.h, () => b.appendChild(el('div.rm2-polfb.back')));
        flip.append(f, b);
        c.viewer.inner.appendChild(flip);
        flip.addEventListener('click', (e) => { e.stopPropagation(); if (c.viewer.moved() || c.viewer.scale > 1.05) return; flip.classList.toggle('flipped'); sfx('pageTurn'); });
        return 'polaroid_601';
      },
      landlord(c) {
        const d = c.def;
        cuImg(c.viewer.inner, d.key, d.w, d.h, () => {
          c.viewer.inner.appendChild(el('div.rm2-notefb', null,
            el('div.paper', null, d.domFallback.map((l, i) => el('p' + (i === d.domFallback.length - 1 ? '.sign' : ''), null, T(l)))),
            el('div.sticky', null, d.sticky.map((l) => el('p', null, T(l))))));
        });
        return 'landlord_note';
      },
      peephole(c) {
        const d = c.def, disc = data.GEO.peepDisc();
        c.slot = new Slot(c.viewer.inner, 'peep');
        c.slot.el.style.width = d.w + 'px'; c.slot.el.style.height = d.h + 'px';
        const sn = el('div.rm2-cusnow.lens');
        sn.style.width = d.w + 'px'; sn.style.height = d.h + 'px';
        c.viewer.inner.appendChild(sn);
        c.snow = new Snow(sn, { clip: 'circle(' + disc.r * 100 + '% at ' + disc.cx * 100 + '% ' + disc.cy * 100 + '%)' });
        let first = true;
        c.live = (w) => {
          c.slot.set(d.key(), { fade: first ? 0 : 200 });
          first = false;
          c.snow.setCount(w.taped ? 0 : [8, 14, 18][w.snow] || 0);
          if (cuTop() === c) { c.capEl.textContent = T(data.cap.peephole); c.capEl.classList.add('in'); }
        };
        return 'peephole';
      },
      doorlock(c) {
        const d = c.def;
        const host = el('div.rm2-lockcu'); host.style.width = d.w + 'px'; host.style.height = d.h + 'px';
        c.viewer.inner.appendChild(host);
        cuImg(host, d.key, d.w, d.h, () => c.node.classList.add('rm2-fb'));
        const hd = el('img.rm2-cuhandle', { alt: '' }); hd.style.width = d.w + 'px'; hd.style.height = d.h + 'px'; hd.onerror = function () { this.remove(); };
        if (hasImg(d.handleKey)) hd.src = imgUrl(d.handleKey);
        host.appendChild(hd);
        const L = data.GEO.ledLockCu();
        const led = el('i.rm2-led.lockcu'); led.style.left = L.x * d.w + 'px'; led.style.top = L.y * d.h + 'px';
        c.viewer.inner.appendChild(led);
        c.live = () => {
          led.className = 'rm2-led lockcu ' + (flag('M6') && !flag('M7') ? 'red' : 'green');
          if (cuTop() === c) { c.capEl.textContent = T(data.cap.lock); c.capEl.classList.add('in'); }
        };
        c.fx = (t) => { const e = FX.handle ? t - FX.handle.t0 : 1e9; hd.classList.toggle('on', e < 140); host.classList.toggle('rm2-jerk', e >= 140 && e < 280); led.classList.toggle('flare', e < 400); };
        return 'doorlock_in';
      },
      newphone(c) {
        const d = c.def, S = d.screens;
        setFlag('newPhoneSeen');
        cuImg(c.viewer.inner, d.key, d.w, d.h, () => c.node.classList.add('rm2-fb'));
        const q = data.GEO.npCu().map((p) => [p[0] * d.w, p[1] * d.h]);
        const VW = 360, VH = 800;
        const scr = el('div.rm2-npscr');
        scr.style.width = VW + 'px'; scr.style.height = VH + 'px'; scr.style.transform = quadMatrix(VW, VH, q);
        c.viewer.inner.appendChild(scr);
        const pw = d.power, pb = el('button.rv-spot.cu.rm2-power', { 'data-qa': 'newphone.power' });
        pb.style.left = pw.x * d.w + 'px'; pb.style.top = pw.y * d.h + 'px'; pb.style.width = pw.w * d.w + 'px'; pb.style.height = pw.h * d.h + 'px';
        c.viewer.inner.appendChild(pb);
        let shown = '';
        const render = () => {
          const s = data.newPhoneScreen();
          if (s === shown) return; shown = s;
          scr.className = 'rm2-npscr ' + s;
          scr.innerHTML = '';
          if (s === 'battery0' || s === 'battery2') {
            scr.append(el('div.np-bat', null, el('i.body', null, el('i.fill')), el('i.cap')), el('div.np-pct', null, s === 'battery2' ? S.battery2 : S.battery0));
          } else if (s === 'wipe') {
            scr.append(el('div.np-mid', null, el('p', null, T(S.wipe)), el('div.np-bar', null, el('i'))));
          } else if (s === 'boot') {
            scr.append(el('div.np-mid', null, el('i.np-dot'), el('p.small', null, T(S.boot))));
          } else {
            const F = S.frp;
            const msg = el('p.np-fail');
            const em = el('button.np-em', { 'data-qa': 'newphone.emergency' }, T(F.emergency));
            em.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); msg.textContent = T(F.emergencyFail); msg.classList.add('in'); clearTimeout(c.failT); c.failT = setTimeout(() => msg.classList.remove('in'), 3200); });
            scr.append(el('div.np-sb', null, T(F.sim)), el('div.np-frp', null,
              el('h4', null, T(F.head)), el('p.line', null, T(F.line)), el('p.small', null, T(F.small)),
              el('div.np-field', null, T(F.field)), el('div.np-next', null, T(F.next))), em, msg);
          }
        };
        pb.addEventListener('click', (e) => {
          e.stopPropagation(); if (c.viewer.moved()) return;
          if (flag('M2')) return;
          scr.classList.remove('blink'); void scr.offsetWidth; scr.classList.add('blink');
        });
        render();
        c.live = () => render();
        return 'newphone';
      },
    };
    /** §3.1 ① tap → the handwriting enlarged: the whole written block — `text` (baked `받는 사람: 601호` / `보내는 사람: —`) ∪ the
     *  DOM {N} as laid out now — fitted to the screen (≤ lid.maxZ); tap again → back to 1×. Legacy data: a fixed lid.zoomTo. */
    function lidZoom(c, L) {
      const vw = c.viewer;
      // c.lidZoomed / c.lidG: the zoom-in is the lid's (cuBack steps out of it first) until the player zooms by hand
      const zin = (x, y, z) => { vw.zoomTo(x, y, z); c.lidZoomed = vw.scale > 1.05; c.lidG = vw.gestures(); };
      const zout = () => { vw.zoomTo(0.5, 0.5, 1); c.lidZoomed = false; };
      if (!L.text) { const z = L.zoomTo || { x: 0.5, y: 0.5, z: 2 }; if (vw.scale > 1.4) zout(); else zin(z.x, z.y, z.z); return; }
      const r = { x0: L.text.x0, y0: L.text.y0, x1: L.text.x1, y1: L.text.y1 };
      const grow = (x0, y0, x1, y1) => { r.x0 = Math.min(r.x0, x0); r.y0 = Math.min(r.y0, y0); r.x1 = Math.max(r.x1, x1); r.y1 = Math.max(r.y1, y1); };
      const nm = vw.inner.querySelector('.rm2-lidname'), ir = vw.inner.getBoundingClientRect(), nr = nm && nm.getBoundingClientRect();
      if (nr && nr.width > 0 && ir.width > 0 && ir.height > 0) grow((nr.left - ir.left) / ir.width, (nr.top - ir.top) / ir.height, (nr.right - ir.left) / ir.width, (nr.bottom - ir.top) / ir.height);
      else { const q = (c.st && (c.st.lifted || !c.st.m0)) ? data.GEO.lidNameLifted() : data.GEO.lidName(); q.forEach((p) => grow(p[0], p[1], p[0], p[1])); }   // not laid out: the whole name slot
      const z = vw.fitZoom(r, L.maxZ || 2.6, L.fill || 0.92);
      if (vw.scale > Math.min(1.4, 1 + (z - 1) * 0.6)) zout();
      else zin((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z);
    }
    function lidName(host, q, w, h) {
      const qq = q.map((p) => [p[0] * w, p[1] * h]);
      const VW = 220, VH = 60, FS = 54, ROOM = VW - 10;
      const name = T('{N}');
      const n = el('span.rm2-lidname', null, name);
      const box = el('div.rm2-lid'); box.style.width = VW + 'px'; box.style.height = VH + 'px'; box.style.transform = quadMatrix(VW, VH, qq);
      box.appendChild(n); host.appendChild(box);
      /* {N} stays inside its slot on the lid (VW): first a guess from the length (pen-font Hangul ≈ .62 em, narrower letters ≈ .42 em),
         then the laid-out width once the lid is in the page and again when the pen web font has arrived (the cursive fallback is wider) */
      const size = (fs) => { n.style.fontSize = fs + 'px'; box.classList.toggle('long', fs < FS); };
      const em = [...name].reduce((s, ch) => s + (/[ㄱ-ㆎ가-힣㐀-鿿]/.test(ch) ? 0.62 : 0.42), 0);
      const guess = Math.max(18, Math.min(FS, Math.floor(ROOM / Math.max(em, 0.01))));
      size(guess);
      const fit = () => {
        if (!n.isConnected) return;
        n.style.fontSize = FS + 'px'; box.classList.remove('long');
        const nw = n.offsetWidth;
        if (!nw) { size(guess); return; }                  // hidden — keep the guess
        size(nw > ROOM ? Math.max(18, Math.floor(FS * ROOM / nw)) : FS);
      };
      requestAnimationFrame(fit);
      try { if (document.fonts && document.fonts.load) document.fonts.load(FS + "px 'Nanum Pen Script'", name).then(() => requestAnimationFrame(fit), () => {}); } catch (e) {}
    }
    function phoneAlarm(host, q, w, h, a) {
      const qq = q.map((p) => [p[0] * w, p[1] * h]);
      const VW = 300, VH = 560;
      const box = el('div.rm2-boxalarm', null, el('i.notch'), el('b', null, T(a.time)), el('span.t', null, T(a.title)), el('span.p', null, T(a.playing)), el('div.eq', null, el('i'), el('i'), el('i'), el('i')));
      box.style.width = VW + 'px'; box.style.height = VH + 'px'; box.style.transform = quadMatrix(VW, VH, qq);
      host.appendChild(box);
    }
    function seenNote() { if (flag('boxNote') && flag('boxHand')) setFlag('seenNote'); }
    /** §9.8 in-world stand-in drawings (no text) */
    function drawing(kind, w, h) {
      const d = el('div.rm2-draw.' + kind);
      d.style.width = w + 'px'; d.style.height = h + 'px';
      if (/^box/.test(kind)) d.append(el('i.inner'), el('i.card'), el('i.pol'), el('i.flap'));
      else d.append(el('i.gap'), el('i.slab'), el('i.box'));
      return d;
    }

    /* ---------- M0: pick the phone up → alarm ring (media) → gotPhone (§3.1 완료 조작) ---------- */
    let boxLifted = false, picking = false;
    async function pickPhone(c, st, render) {
      if (picking || flag('gotPhone')) return;
      picking = true;
      caption(data.cap.phoneCase);
      boxLifted = true; st.lifted = true; render();
      await sleep(900);
      let p;
      try {
        if (G.hooks && G.hooks.has && G.hooks.has('alarm:ring')) p = G.hooks.call('alarm:ring', 'a2310');
        else if (G.clockApp && G.clockApp.ring) p = G.clockApp.ring('a2310');
      } catch (e) { console.error('[room] alarm:ring', e); }
      if (!p || typeof p.then !== 'function') p = fallbackRing();
      try { await p; } catch (e) {}
      setFlag('gotPhone');
      finish('gotPhone');
    }
    /** only when media's ring screen is missing (partial build): the §4.7.1 screen, same strings */
    function fallbackRing() {
      return new Promise((res) => {
        const a = data.closeups.box.alarm;
        const knob = el('button.rm2-ringknob', { 'data-qa': 'alarm.slide' }, '해제 ›');
        const scr = el('div.rm2-ring', null, el('b', null, T(a.time)), el('span', null, T(a.title)), el('span.p', null, T(a.playing)), el('div.rm2-ringtrack', null, knob));
        root.appendChild(scr);
        let sx = null, dx = 0;
        knob.addEventListener('pointerdown', (e) => { sx = e.clientX; try { knob.setPointerCapture(e.pointerId); } catch (er) {} });
        knob.addEventListener('pointermove', (e) => { if (sx == null) return; dx = clamp(e.clientX - sx, 0, 200); knob.style.transform = 'translateX(' + dx + 'px)'; });
        const up = () => { if (sx == null) return; sx = null; if (dx > 120) { scr.remove(); res(); } else { dx = 0; knob.style.transform = ''; } };
        knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
        knob.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { scr.remove(); res(); } });
      });
    }

    /* ---------- back / close ---------- */
    function back() {
      if (cu.length) { if (cuTop().def.noBack) return true; cuBack(); return true; }
      if (cur() && cur().kind === 'sub') { exitAllSubs(); return true; }
      if (eye) return true;                      // eye views consume back (ARCH §4.15)
      close('closed');
      return true;
    }
    inst.back = back;
    let done = false;
    function finish(via) {
      if (done) return; done = true;
      if (o.onDone) { try { o.onDone({ via }); } catch (e) {} }
      if (via === 'gotPhone') {
        root.classList.add('rm2-blackout');
        let off = null;
        const rm = () => { if (off) { try { G.bus.off('lock:show', rm); } catch (e) {} off = null; } close('gotPhone'); };
        try { if (G.bus) { G.bus.on('lock:show', rm); off = true; } } catch (e) {}
        setTimeout(rm, 4000);
        return;
      }
      if (via === 'handle') { closeAfterDoorCard(); return; }
      if (via === 'until') { root.classList.add('rm2-fadeout'); setTimeout(() => close('until'), 650); return; }
    }
    /** B20: the lit door stays the backdrop of the 01:10 card (ending.js — a translucent layer above the eye view) and goes
     *  down synchronously on the first ending step after the handle tap — the card's [계속] (setStep 'k0110': vars.endStep
     *  changes first, then 'end:step'; whichever comes first). The eye view hides banners (#screen.eye-mode), so it is gone
     *  before any 'end:step' listener runs. Safety: no bus / no ending module → the old 3.6 s; the 01:10 card never came up
     *  within 10 s of play time (broken chain) → close; never later than 120 s. */
    function closeAfterDoorCard() {
      const bus = G.bus, en = G.ending;
      if (!bus || typeof bus.on !== 'function' || !en) { setTimeout(() => close('handle'), 3600); return; }
      const t0 = now();
      let played = 0, last = t0, poll = 0, off = false;
      const shut = () => {
        if (off) return; off = true;
        clearInterval(poll);
        try { bus.off('end:step', shut); bus.off('var:endStep', shut); } catch (e) {}
        close('handle');
      };
      bus.on('end:step', shut); bus.on('var:endStep', shut);
      poll = setInterval(() => {
        if (inst.closed) { shut(); return; }
        const t = now();
        let running = !document.hidden;
        try { if (G.clock && typeof G.clock.running === 'function') running = !!G.clock.running(); } catch (e) {}
        if (running) played += Math.min(500, t - last);
        last = t;
        let cardUp = true;
        try { if (typeof en.isCardUp === 'function') cardUp = !!en.isCardUp(); } catch (e) {}
        if (t - t0 >= 120000 || (!cardUp && played >= 10000)) shut();
      }, 250);
    }
    inst.finish = finish;
    function close(why, fromShell) {
      if (inst.closed) return;
      inst.closed = true;
      cancelAnimationFrame(zAnim);
      window.removeEventListener('keydown', onKey);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', inst.layout);
      scenes.forEach(killScene); cu.forEach((c) => c.snow && c.snow.kill());
      const i = insts.indexOf(inst); if (i >= 0) insts.splice(i, 1);
      if (offBack) { try { offBack(); } catch (e) {} offBack = null; }
      if (entry && !fromShell) {
        try { if (G.phone && G.phone.top && G.phone.top() === entry && G.phone.pop) G.phone.pop(true); else root.remove(); } catch (e) { root.remove(); }
      }
      if (layer) { layer.classList.remove('in', 'rm2-fadein'); setTimeout(() => layer.remove(), why === 'gotPhone' ? 0 : 320); }
      if (eye && !insts.some((x) => x.mode === 'eye')) screenEl().classList.remove('eye-mode');
      if (!done && o.onDone) { done = true; try { o.onDone({ via: 'closed' }); } catch (e) {} }
      if (o.onClose) { try { o.onClose(); } catch (e) {} }
      const t = topInst();
      if (t) { t.layout(); t.live(); const s = t.state(); emit('room:view', { view: s.view, sub: s.sub, zoom: s.zoom, mode: s.mode }); }
      else emit('room:close', { mode: eye ? 'eye' : 'camera' });
    }
    inst.close = close;

    /* ---------- api ---------- */
    const api = {
      root,
      get mode() { return eye ? 'eye' : 'camera'; },
      get view() { return V[vi].id; },
      get sub() { const c = cur(); return c && c.kind === 'sub' ? c.id : null; },
      get zoom() { const c = cur(); return c ? c.z : 1; },
      get flash() { return flash; },
      get closeupId() { const c = cuTop(); return c ? c.id : null; },
      setView(id) { const i = typeof id === 'number' ? id : data.indexOf(id); if (i >= 0) { exitAllSubs(); setView(i, i === vi ? 0 : 1, { silent: true }); } },
      enterSub(id) { const def = data.subs[id]; if (!def) return; if (def.parent === 'roof_rail' && !(cur() && cur().id === 'roof_rail')) { setView(data.indexOf('r2_window'), 0, { silent: true }); enterSub('roof_rail', null, data.subs.roof_rail.enterZ); } else if (V[vi].id !== 'r2_window') setView(data.indexOf('r2_window'), 0, { silent: true }); enterSub(id, null, def.enterZ); },
      zoomTo, caption, closeup: (id) => openCloseup(id) || Promise.resolve(), close: () => close('closed'), setFlash,
      refresh: () => live(), dirSub: (t, a, m) => inst.dirSub(t, a, m),
    };
    inst.api = api;
    inst.state = () => ({ mode: eye ? 'eye' : 'camera', view: V[vi].id, sub: api.sub, zoom: +api.zoom.toFixed(2), closeup: api.closeupId, flash });

    setView(vi, 0, { silent: true });
    if (o.sub) api.enterSub(o.sub);
    if (cam) sfx('camOn');
    emit('room:open', { mode: eye ? 'eye' : 'camera' });
    if (FX.glow || FX.ajar || FX.beams) fxRun();
    return inst;
  }

  /* ======================= public API ======================= */
  let inited = false;
  R.init = function () {
    if (inited) return; inited = true;
    on('flag', refreshAll); on('flag:off', refreshAll);
    on('var', (e) => { const k = e && e.k; if (!k || /^(snow|footprints|ledState|climax|lureCount|user)$/.test(k)) refreshAll(); });
    on('clock:min', refreshAll);
    on('clock:jump', () => { FX.lastJumpAt = now(); refreshAll(); });
    on('settings', refreshAll);
    on('climax:drill', refreshAll);
    on('climax:wobble', () => insts.forEach((i) => { const r = i.api.root; r.classList.add('rm2-wobble'); clearTimeout(i.wobT); i.wobT = setTimeout(() => r.classList.remove('rm2-wobble'), 1500); }));
    on('flag:doorOpened', () => { if (!FX.lit) R.lightsOn(); });
    on('users:switching', () => insts.slice().forEach((i) => { if (i.mode === 'camlock' || i.mode === 'camera') i.close('switch'); }));
    on('lock:unlock', () => insts.slice().forEach((i) => { if (i.mode === 'camlock') i.close('unlock'); }));
    on('visibility', (e) => { if (e && !e.hidden) refreshAll(); });
    try { G.hooks && G.hooks.set && G.hooks.set('room:refreshLayers', () => { refreshNow(); return true; }); } catch (e) {}
    debugHelpers();
  };
  function ensureInit() { if (!inited) R.init(); }

  R.open = function (o) {
    o = o || {};
    ensureInit();
    if (!G.ROOM) { console.error('[room] G.ROOM missing'); return null; }
    if (o.mode === 'eye') return createRoom({ mode: 'eye', view: o.view || 'r2_door', sub: o.sub, pinch: o.pinch, onClose: o.onClose }).api;
    try { if (G.users && G.users.current && G.users.current() === 'dash') { warn('camera is {N}-only'); return null; } } catch (e) {}
    const ex = insts.find((i) => i.mode === 'camera' || i.mode === 'camlock');
    if (ex) {
      if (o.view) ex.api.setView(o.view);
      if (o.sub) ex.api.enterSub(o.sub);
      if (o.flash != null) ex.setFlash(!!o.flash);
      return ex.api;
    }
    let locked = !!o.fromLock;
    try { if (!locked && G.phone && G.phone.isLocked && G.phone.isLocked()) locked = true; } catch (e) {}
    return createRoom({ mode: locked ? 'camlock' : 'camera', view: o.view, sub: o.sub, flash: o.flash, onClose: o.onClose }).api;
  };
  R.close = function (o) { insts.slice().forEach((i) => { if (i.mode !== 'eye' || (o && o.all)) i.close('closed'); }); };
  R.isOpen = () => insts.some((i) => !i.closed);
  R.current = function () { const t = topInst(); return t ? t.state() : null; };
  R.flash = function (v) {
    const i = insts.slice().reverse().find((x) => x.mode !== 'eye');
    if (!i) return false;
    if (v !== undefined) i.setFlash(!!v);
    return i.flash();
  };
  R.refresh = function () { refreshNow(); };
  R.dirSub = function (text, az, ms) {
    const t = visibleInst();
    if (t) { t.dirSub(text, az, ms); return; }
    try { G.fx && G.fx.sub && G.fx.sub(T(text), ms, az != null ? { az } : undefined); } catch (e) {}
  };

  /** forced eye view (M7 window · M8 door) — DESIGN §2.6 ①, §3.17; ARCH §4.15 */
  R.forceView = function (o) {
    o = o || {};
    ensureInit();
    return new Promise((resolve) => {
      if (!G.ROOM) { resolve({ via: 'closed' }); return; }
      try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {}
      try { G.phone && G.phone.dismissModals && G.phone.dismissModals(); } catch (e) {}
      insts.slice().forEach((i) => { if (i.mode === 'eye') i.close('replaced'); });
      let inst = null;
      const check = () => { try { if (inst && !inst.closed && o.until && o.until()) inst.finish('until'); } catch (e) {} };
      inst = createRoom({ mode: 'eye', view: o.view || 'r2_door', sub: o.sub, pinch: !!o.pinch, handle: !!o.handle, lockMs: o.lockMs || 0,
        fadeIn: o.fadeIn !== false, onDone: (r) => { offs.forEach((f) => f && f()); resolve(r); } });
      const offs = [];
      if (o.until) {
        try { if (G.bus) { G.bus.on('tick', check); G.bus.on('clock:min', check); G.bus.on('flag', check); offs.push(() => { G.bus.off('tick', check); G.bus.off('clock:min', check); G.bus.off('flag', check); }); } } catch (e) {}
        const poll = setInterval(() => { if (!inst || inst.closed) { clearInterval(poll); return; } if (!document.hidden) check(); }, 500);
        offs.push(() => clearInterval(poll));
      }
    });
  };

  /** M0 cold open eye chain (§3.1) — resolves when gotPhone is set (ARCH §4.15) */
  R.eyeM0 = function (o) {
    o = o || {};
    ensureInit();
    return new Promise((resolve) => {
      if (flag('gotPhone') || !G.ROOM) { resolve(); return; }
      insts.slice().forEach((i) => { if (i.mode === 'eye') i.close('replaced'); });
      createRoom({ mode: 'eye', view: 'r2_door', m0: true, fadeIn: !o.resume, onDone: () => resolve() });
    });
  };

  /** B09 — the phone light in the tank-room door gap (§6.4-②) */
  R.playTankGlow = function (o) {
    o = o || {};
    const t = visibleInst(), st = t && t.state();
    if (!st || st.closeup || !((st.view === 'r2_window' && !st.sub) || st.sub === 'roof_tank')) return Promise.resolve(false);
    if (FX.glow) return Promise.resolve(false);
    const isLess = less();
    const hold = o.holdMs != null ? o.holdMs : (isLess ? 1200 : 2400);
    return new Promise((resolve) => {
      FX.glow = { t0: now(), variant: o.variant === 'hand' ? 'hand' : 'cap', hold, capMs: o.variant === 'hand' || isLess ? 0 : 600, resolve };
      fxRun();
    });
  };
  /** B14 4.8 s — the handle jerks down and springs back (door views) — the edge shake elsewhere is the caller's */
  R.handleJerk = function () { FX.handle = { t0: now() }; fxRun(); return R.isDoorVisible(); };
  R.isDoorVisible = function () { const t = visibleInst(), st = t && t.state(); return !!(st && ((st.view === 'r2_door' && !st.closeup) || st.closeup === 'doorlock')); };
  /** B17 — the tank door opens 40 cm and closes, silently */
  R.tankAjar = function () { return new Promise((resolve) => { FX.ajar = { t0: now(), resolve }; fxRun(); refreshAll(); }); };
  /** B16 — two police torches from the stair head ('direct' = whereTank, 'sweep' = round the roof first) */
  R.beams = function (mode, onDoor) { return new Promise((resolve) => { FX.beams = { t0: now(), mode: mode === 'direct' ? 'direct' : 'sweep', resolve, onDoor }; fxRun(); refreshAll(); }); };
  R.police = function (v) { FX.police = v == null ? null : !!v; refreshAll(); };
  R.doorGap = function (k) { FX.gap = k === undefined ? null : k; refreshAll(); };
  /** L8 — the ceiling light comes on (doorOpened) — 1.2 s, LED (no flicker) */
  R.lightsOn = function () {
    FX.lightsAt = now(); FX.lit = true;
    insts.forEach((i) => { const r = i.api.root; r.classList.add('lights-on'); setTimeout(() => r.classList.remove('lights-on'), 1300); });
    refreshNow();
  };
  R.closeup = function (id) { const t = topInst(); return t ? t.closeup(id) : Promise.resolve(); };

  /* ======================= DEBUG (window.haru — ARCH §6.2) ======================= */
  function debugHelpers() {
    if (!G.DEBUG) return;
    const h = (window.haru = window.haru || {});
    h.room = function (view, sub) { const a = R.open({ mode: 'camera', view: view || 'r2_door' }); if (a && sub) a.enterSub(sub); return a ? R.current() : null; };
    h.roomFx = FX;
  }
  if (G.DEBUG) debugHelpers();
})();

/* =========================================================
 * 하루를 위한 방탈출! 3 — the generic two-room renderer (appended · owner: room) — active only when G.ROOM.v === 3.
 * Everything above this block is the episode-2 renderer, byte-for-byte; with ep2 data (no `v`) every public call below
 * forwards to it unchanged (ARCH §4.1 · §4.2 room). Data: ep3/js/room/roomdata.js (G.ROOM v:3). CSS: ep3/css/room3.css (rm3-*).
 * DESIGN §2.3 (where · momAt) · §2.6 · §3.1 table · §3.2.1 (go: doors, first-tap caption) · §3.12 0° · §3.13 · §4.1.1 · §4.9 ·
 * §6.1.0-1 (no forced rotation, transitions ≥ 0.4 s) · §6.3 (live layers · "people leave, they do not vanish") · §7.1.2 (yaw) ·
 * §8.3-5/-6/-7 (CSS · DOM effects, hand rule) · §9.5-4/-5 (drag · ←/→ · Enter) · §9.8 (fallbacks). ARCH §2.3 (z 45) · §5.12 · §7.4.
 *
 * Public API (G.room, v3)
 *   init()                                       bus listeners + hook 'room:refreshLayers' (idempotent)
 *   open({ mode:'camera', room, view, closeup, fromLock, flash, onClose }) → api      the 카메라 app (app stack z 10; from the
 *                                                lock: its own z 45 layer above the lock, closes back to it). mode 'eye' → eye()
 *   eye({ view, closeup, fadeMs=0, spots=true, grade }) → eyeApi     eye view z 45 (no chrome) — reused while one is open
 *     eyeApi = { show({ view|closeup, ms=400, grade }) → Promise, spots(on), screenNode() → Element|null (c3_phone_ring(_lit) ring_q),
 *                dim(level 0–1 = how dark, ms=600) → Promise, close(ms=400) → Promise, state(), caption(text, ms) }
 *   close({ all }) · isOpen() · current() → { mode, room, view, closeup } | null
 *   where(v?, { view }?) → 'lv'|'sr'             the only writer of vars.where (bus 'room:where' {where, prev}); the optional
 *                                                view is where the next camera open lands (default sr → r3_sr_bed · lv → r3_door)
 *   set(key, value) · get(key) · state() → { …keys, mom, led, grade, winLights, where }   persisted in vars.room.st
 *     keys kongi('sleep'|'door'|'none'|'feet') jimin('sleep'|'gone') srGap(0|.25|.35|.45) srLamp('off'|'dim'|'lit')
 *          phoneGlow('off'|'ceil'|'ring'|'call'|'ended') kitchenLight(bool) stove('off'|'flame'|'steam') collar('hook'|'gone')
 *          + room-private momPos(null|'moving'|'sink' — overrides momAt for the pictures while 엄마 walks) · momBlanket(bool)
 *   pulse('boiler') · led('err3') → Promise · refresh() · dirSub(text, az, ms) · flash(on?) → bool · caption(text, ms)
 * Bus out: room:open {mode} · room:close {mode} · room:view {room, view, closeup, mode} · room:spot {id, view}
 *          room:closeup {id, open} · room:where {where, prev} · room:shot {view}
 * Bus in: flag · var · clock:min · clock:jump · settings · visibility · lock:unlock · state:load. Hook set: 'room:refreshLayers'.
 * Flags set (through G.ROOM spot data): kongiTail0 collarSeen soupSeen0 calSeen0 heightSeen drawingSeen drawingBack manualSeen
 *   orgelSpotSeen. Vars: vars.where · vars.room {room, view, closeup, flash, st, go, taps} · vars.shots.
 * data-qa: room.eye (data-view · data-closeup · focusable for ←/→) · room.camera (data-room · data-view) · camera only:
 *   room.view:<id> room.next room.prev room.close room.flash room.shutter room.zoom room.thumb · both: room.spot:<id> ·
 *   room.closeup.close room.flip.
 * HARD MODE: no hint text, no tutorial line, no out-of-world error text — every string comes from G.ROOM (DESIGN) through G.T.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const R = (G.room = G.room || {});
  const EP2 = { init: R.init, open: R.open, close: R.close, isOpen: R.isOpen, current: R.current, flash: R.flash,
    refresh: R.refresh, dirSub: R.dirSub, closeup: R.closeup };
  const isV3 = () => !!(G.ROOM && G.ROOM.v === 3);

  /* ======================= helpers ======================= */
  function el(tag, attrs) {
    const m = /^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i.exec(tag);
    const n = document.createElement((m && m[1]) || 'div');
    let kids = Array.prototype.slice.call(arguments, 2);
    if (attrs != null && (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object')) { kids.unshift(attrs); attrs = null; }
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, v) => { if (t === '.') n.classList.add(v); else n.id = v; });
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    [].concat.apply([], kids).forEach((c) => { if (c == null || c === false) return; n.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return n;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const D = () => G.ROOM;
  function warn() { if (G.DEBUG) try { console.warn.apply(console, ['[room3]'].concat([].slice.call(arguments))); } catch (e) {} }
  function flag(f) { try { return !!(G.flag && G.flag(f)); } catch (e) { return false; } }
  function setFlag(f) { if (!f) return; try { if (G.flag && !G.flag(f)) G.flag(f, true); } catch (e) { console.error('[room3] flag', f, e); } }
  function vars() { return (G.state && G.state.vars) || {}; }
  function save() { try { G.save && G.save(); } catch (e) {} }
  function emit(ev, data) { try { G.bus && G.bus.emit(ev, data); } catch (e) {} }
  function on(ev, fn) { try { if (G.bus) G.bus.on(ev, fn); } catch (e) {} }
  function sfx(name) { try { const f = G.audio && G.audio.sfx && G.audio.sfx[name]; if (typeof f === 'function') f(); } catch (e) {} }
  function cue(id, o) { if (!id) return; try { G.audio && G.audio.cue && G.audio.cue(id, o || {}); } catch (e) {} }
  function hasCue(id) { try { return !!(G.audio && G.audio._cues && G.audio._cues[id]); } catch (e) { return false; } }
  function E() { return G.ep || G.e3 || G.e2 || null; }
  function lowEnd() { try { const e = E(); return !!(e && e.lowEnd && e.lowEnd()); } catch (e) { return false; } }
  function reduceMotion() {
    let rm = false; try { rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    return rm || !!(G.settings && G.settings.reduceShake);
  }
  function reduceFlash() { return !!(G.settings && G.settings.reduceFlash) || reduceMotion(); }
  function screenEl() { return document.getElementById('screen') || document.body; }
  function clockNow() { try { return G.clock && G.clock.now ? G.clock.now() : new Date(); } catch (e) { return new Date(); } }
  function clockPassed(hm) { try { return !!(G.clock && G.clock.passed && G.clock.passed(hm)); } catch (e) { return false; } }
  /** player-facing text: `{h}` `{mm}` (in-game clock) first, then G.T (tokens · {$key}) — ARCH §1.1 */
  function T(s) {
    if (s == null) return '';
    s = String(s);
    if (s.indexOf('{h}') >= 0 || s.indexOf('{mm}') >= 0) { const d = clockNow(); s = s.replace(/\{h\}/g, String(d.getHours() % 12 || 12)).replace(/\{mm\}/g, String(d.getMinutes())); }
    try { if (G.T) return G.T(s); } catch (e) {}
    const name = (window.CONFIG && window.CONFIG.PLAYER_NAME) || '하루';
    return s.replace(/\{N[^}]*\}/g, name);
  }
  function imgUrl(k) { try { return D() ? D().img(k) : ''; } catch (e) { return ''; } }
  function hasImg(k) { try { return !!(D() && D().has(k)); } catch (e) { return false; } }
  function meta(img, k, def) { try { return D() && D().meta ? D().meta(img, k, def) : def; } catch (e) { return def; } }
  function call(fn, ctx, dflt) { if (typeof fn !== 'function') return fn === undefined ? dflt : fn; try { return fn(ctx); } catch (e) { console.error('[room3] data fn', e); return dflt; } }
  function pctBox(n, r) { n.style.left = r.x * 100 + '%'; n.style.top = r.y * 100 + '%'; n.style.width = r.w * 100 + '%'; n.style.height = r.h * 100 + '%'; return n; }
  function bbox(q) { let x0 = 1, y0 = 1, x1 = 0, y1 = 0; q.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
  /** CSS matrix3d mapping a w×h px element onto quad q (px; TL, TR, BR, BL) — the same Heckbert map as the ep2 block */
  function quadMatrix(w, h, q) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
    return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1].map((v) => +v.toFixed(8)).join(',') + ')';
  }
  const SVG = {
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flash: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M4 20 20 4M12 20h8v-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ======================= room state (ARCH §5.12 table — persisted in vars.room.st) ======================= */
  const DEF = { kongi: 'sleep', jimin: 'sleep', srGap: 0, srLamp: 'off', phoneGlow: 'off', kitchenLight: false, stove: 'off', collar: 'hook',
    momPos: null, momBlanket: false };
  function RS() {
    const v = vars();
    if (!v.room || typeof v.room !== 'object' || Array.isArray(v.room)) v.room = {};
    const r = v.room;
    if (!r.st || typeof r.st !== 'object') r.st = {};
    return r;
  }
  function get(k) { const s = RS().st; return s[k] !== undefined ? s[k] : DEF[k]; }
  function set(k, v) {
    const s = RS().st;
    if (s[k] === v) return;
    s[k] = v;
    save();
    refreshAll();
  }
  function momAt() { try { const e = E(); if (e && typeof e.momAt === 'function') return e.momAt() || 'table'; } catch (e) {} return vars().momAt || 'table'; }
  function momPos() { const p = get('momPos'); return p || momAt(); }
  function whereNow() { const w = vars().where; return w === 'sr' ? 'sr' : 'lv'; }
  function winLights() { return clockPassed('06:10') ? 3 : clockPassed('05:55') ? 2 : clockPassed('05:40') ? 1 : 0; }

  /* ======================= transient world effects (not persisted — §6.3 'live') ======================= */
  const FX = { errAt: -1e9, pulseAt: -1e9 };
  const ERR_MS = 1200, PULSE_MS = 60000, PULSE_FADE = 8000;
  function errOn() { return now() - FX.errAt < ERR_MS; }
  function pulseOn() { return now() - FX.pulseAt < PULSE_MS; }

  /* ======================= base image slot (crossfade · §9.8 fallbacks) ======================= */
  function BaseSlot(host, sc) {
    this.host = host; this.sc = sc; this.key = undefined; this.cur = null;
  }
  BaseSlot.prototype.set = function (key, fade) {
    if (key === this.key) return;
    this.key = key;
    const self = this, sc = this.sc, fbMap = (sc.def && sc.def.fb) || {};
    const old = Array.prototype.slice.call(this.host.querySelectorAll('img.rm3-base'));
    let src = key, filter = '';
    if (!hasImg(src) && fbMap[key]) { src = fbMap[key][0]; filter = fbMap[key][1]; }
    const drop = (ms) => old.forEach((n) => { n.style.transition = 'opacity ' + ms + 'ms linear'; n.style.opacity = '0'; setTimeout(() => n.remove(), ms + 60); });
    if (!src || !hasImg(src)) { this.fail(); return; }
    const im = el('img.rm3-base', { alt: '', draggable: 'false' });
    if (filter) im.style.filter = filter;
    const ms = fade == null ? 0 : fade;
    im.style.opacity = ms && old.length ? '0' : '1';
    let tried = false;
    im.onload = function () {
      if (self.key !== key) { im.remove(); return; }
      self.cur = im; sc.el && sc.el.classList.remove('rm3-noimg');
      if (!ms) { old.forEach((n) => n.remove()); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transition = 'opacity ' + ms + 'ms linear'; im.style.opacity = '1'; }));
      setTimeout(() => old.forEach((n) => { if (n.parentNode) n.remove(); }), ms + 80);
    };
    im.onerror = function () {
      if (!tried && fbMap[key] && src !== fbMap[key][0] && hasImg(fbMap[key][0])) { tried = true; src = fbMap[key][0]; im.style.filter = fbMap[key][1]; im.src = imgUrl(src); return; }
      im.remove();
      if (self.key !== key) return;
      if (!old.length) self.fail();             // keep whatever was there (nearest state — §9.8)
    };
    im.src = imgUrl(src);
    this.host.appendChild(im);
    if (!ms || !old.length) drop(0);
  };
  BaseSlot.prototype.fail = function () { const sc = this.sc; if (sc.el) sc.el.classList.add('rm3-noimg'); if (sc.onFail) try { sc.onFail(); } catch (e) {} };

  /* ======================= people / dog patches — "they leave, they do not vanish" (§6.3 rule 3) ======================= */
  function PatchLayer(host, spec, sc) { this.host = host; this.spec = spec; this.sc = sc; this.key = undefined; this.cur = null; this.shadow = null; }
  PatchLayer.prototype.img = function (key, cb) {
    const im = el('img.rm3-patch', { alt: '', draggable: 'false' });
    im.style.opacity = '0';
    const self = this;
    if (!hasImg(key)) { setTimeout(() => cb(null), 0); return im; }
    im.onload = () => cb(im);
    im.onerror = () => { im.remove(); cb(null); };
    im.src = imgUrl(key);
    this.host.appendChild(im);
    return im;
  };
  PatchLayer.prototype.dir = function (d) { return d === 'l' ? -6 : d === 'r' ? 6 : 0; };
  PatchLayer.prototype.set = function (key, first) {
    if (key === this.key) return;
    const prevKey = this.key, prev = this.cur, spec = this.spec, self = this;
    this.key = key;
    const calm = reduceMotion() || lowEnd();
    const ms = calm ? 250 : (spec.ms || 800);
    if (this.shadow && !key) { const sh = this.shadow; this.shadow = null; sh.classList.remove('on'); setTimeout(() => sh.remove(), 700); }
    const swap = !!(prevKey && key && prev);
    const swapMs = calm ? 250 : (spec.swapMs ? spec.swapMs(prevKey, key) : ms);
    if (prev && !first) {
      if (swap) { prev.style.transition = 'opacity ' + swapMs + 'ms linear'; prev.style.opacity = '0'; setTimeout(() => prev.remove(), swapMs + 60); }
      else {
        const dx = calm ? 0 : this.dir(spec.exit);
        prev.style.transition = 'opacity ' + ms + 'ms ease-in, transform ' + ms + 'ms ease-in';
        prev.style.opacity = '0'; prev.style.transform = 'translateX(' + dx + '%)';
        setTimeout(() => prev.remove(), ms + 60);
      }
    } else if (prev) prev.remove();
    this.cur = null;
    if (!key) return;
    const im = this.img(key, (ok) => {
      if (self.key !== key) { if (ok) ok.remove(); return; }
      if (!ok) { if (spec.shadow) self.showShadow(first); return; }
      self.cur = ok;
      if (first) { ok.style.transition = 'none'; ok.style.opacity = '1'; return; }
      if (swap) { ok.style.transition = 'none'; ok.style.opacity = '0'; void ok.offsetWidth; ok.style.transition = 'opacity ' + swapMs + 'ms linear'; ok.style.opacity = '1'; return; }
      const dx = calm ? 0 : self.dir(spec.enter);
      ok.style.transition = 'none'; ok.style.transform = 'translateX(' + dx + '%)'; ok.style.opacity = '0';
      void ok.offsetWidth;
      ok.style.transition = 'opacity ' + ms + 'ms ease-out, transform ' + ms + 'ms ease-out';
      ok.style.opacity = '1'; ok.style.transform = 'none';
    });
    void im;
  };
  /** §8.3-5 .momshadow — only when the x3_mom_hall patch is missing (§9.8 · §0.3 D1) */
  PatchLayer.prototype.showShadow = function (first) {
    if (this.shadow) return;
    const q = meta(this.sc.def.key, this.spec.shadow, null) || meta('r3_door', 'hall_q', [[0.37, 0.62], [0.6, 0.62], [0.63, 0.7], [0.35, 0.7]]);
    const b = bbox(q);
    const n = pctBox(el('i.rm3-momshadow'), { x: b.x - b.w * 0.1, y: b.y - b.h * 0.6, w: b.w * 0.7, h: b.h * 1.8 });
    this.host.appendChild(n);
    this.shadow = n;
    if (first) n.classList.add('on'); else requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('on')));
  };

  /* ======================= DOM effects (§8.3-5 · §8.3-6) ======================= */
  const FXB = {};
  /** doorlock LED: green breathing · led('err3') = 3 red blinks .15/.15 (reduced flash: 0.9 s once) → green (§8.3-5 .led3) */
  FXB.led = function (sc, p) {
    const pos = p || meta('r3_door', 'led_door', { x: 0.5525, y: 0.4675 });
    const n = el('i.rm3-led' + (sc.kind === 'cu' ? '.cu' : '')); n.style.left = pos.x * 100 + '%'; n.style.top = pos.y * 100 + '%';
    let errShown = false;
    return { node: n, update() {
      const e = errOn();
      if (e && !errShown) { n.classList.remove('err3', 'err3calm'); void n.offsetWidth; n.classList.add(reduceFlash() ? 'err3calm' : 'err3'); n.style.animationDelay = -(now() - FX.errAt) + 'ms'; }
      if (!e && errShown) n.classList.remove('err3', 'err3calm');
      errShown = e;
    } };
  };
  /** 세아 방 문틈 빛 .srspill — srGap 0 → .25 (수면등) → .35 → .45 (책상 스탠드) · 0.8–1.2 s (§8.3-5) */
  FXB.srspill = function () {
    const q = meta('r3_door', 'srdoor_q', [[0.905, 0.125], [1.0, 0.105], [1.0, 0.79], [0.905, 0.765]]);
    const b = bbox(q);
    const wrap = el('div.rm3-srspill');
    const wedge = pctBox(el('i.w'), b);
    wedge.style.clipPath = wedge.style.webkitClipPath = 'polygon(' + q.map((p) => ((p[0] - b.x) / b.w * 100) + '% ' + ((p[1] - b.y) / b.h * 100) + '%').join(',') + ')';
    const floor = pctBox(el('i.f'), { x: b.x - b.w * 1.6, y: b.y + b.h * 0.93, w: b.w * 2.8, h: b.h * 0.16 });
    wrap.append(wedge, floor);
    return { node: wrap, update() { const a = +get('srGap') || 0; wrap.style.opacity = String(clamp(a / 0.45, 0, 1)); } };
  };
  /** 05:30 부엌 천장등 번짐 .g3-spill on the 0° / 90° / 180° views (§8.3-4 CSS) */
  FXB.spill = function (sc) {
    return { node: null, update() { sc.el.classList.toggle('g3-spill', !!get('kitchenLight')); } };
  };
  /** 보일러 — 다용도실 문 아래 틈 호박색 .15, 60 s, fade 8 s (§6.3 · G.room.pulse) */
  FXB.boiler = function () {
    const u = meta('r3_veranda', 'util_door', { x: 0.03, y: 0.52 });
    const n = pctBox(el('i.rm3-util'), { x: Math.max(0, u.x - 0.03), y: 0.768, w: 0.075, h: 0.018 });
    return { node: n, update() { const o = pulseOn(); n.classList.toggle('on', o); } };
  };
  /** 건너편 창 .win3 a · b · c — clock ≥ 05:40 · 05:55 · 06:10 (§8.3-5) */
  FXB.wins = function () {
    const wrap = el('div.rm3-wins');
    const ws = ['a', 'b', 'c'].map((k) => {
      const q = meta('r3_veranda', 'win_' + k + '_q', null); if (!q) return null;
      const b = bbox(q), n = pctBox(el('i.rm3-win'), b);
      n.style.clipPath = n.style.webkitClipPath = 'polygon(' + q.map((p) => ((p[0] - b.x) / (b.w || 1) * 100) + '% ' + ((p[1] - b.y) / (b.h || 1) * 100) + '%').join(',') + ')';
      wrap.appendChild(n); return n;
    });
    return { node: wrap, update() { const k = winLights(); ws.forEach((n, i) => n && n.classList.toggle('on', i < k)); } };
  };
  /** 벽시계 바늘 = in-game clock, no second hand (§6.3 · §8.3-5) */
  FXB.clock = function () {
    const c = meta('r3_sofa', 'clock_c', { cx: 0.7975, cy: 0.2945, rx: 0.0275, ry: 0.0485, rot: 0 });
    const n = pctBox(el('div.rm3-clock', { html: '<svg viewBox="-1 -1 2 2" preserveAspectRatio="none"><line class="h" x1="0" y1="0" x2="0" y2="-0.5"/><line class="m" x1="0" y1="0" x2="0" y2="-0.72"/><circle r="0.05"/></svg>' }),
      { x: c.cx - c.rx, y: c.cy - c.ry, w: 2 * c.rx, h: 2 * c.ry });
    if (c.rot) n.style.transform = 'rotate(' + c.rot + 'deg)';
    const h = n.querySelector('.h'), m = n.querySelector('.m');
    return { node: n, update() { const d = clockNow(), mm = d.getMinutes(), hh = d.getHours() % 12; m.setAttribute('transform', 'rotate(' + mm * 6 + ')'); h.setAttribute('transform', 'rotate(' + (hh * 30 + mm * 0.5) + ')'); } };
  };
  /** 벽 달력 .cal3 — 2027년 1월 · 1일 = 금 · 24에 빨간 손 동그라미 · '우리 딸' (엄마 손 — Nanum Brush Script) · §8.3-5 */
  FXB.cal = function (sc) {
    const q = meta('r3_kitchen', 'cal_q', [[0.7665, 0.2245], [0.8065, 0.2165], [0.8015, 0.3735], [0.7585, 0.373]]);
    const C = (D().text && D().text.calendar) || {};
    const VW = 300, VH = 440;
    const box = el('div.rm3-cal3');
    box.style.width = VW + 'px'; box.style.height = VH + 'px';
    box.style.transform = quadMatrix(VW, VH, q.map((p) => [p[0] * sc.w, p[1] * sc.h]));
    const grid = el('div.g');
    (C.week || []).forEach((w, i) => grid.appendChild(el('b.' + (i === 0 ? 'sun' : i === 6 ? 'sat' : 'wd'), null, w)));
    for (let i = 0; i < (C.first || 0); i++) grid.appendChild(el('span'));
    for (let d = 1; d <= (C.days || 31); d++) {
      const dow = ((C.first || 0) + d - 1) % 7;
      const s = el('span' + (dow === 0 || (C.red || []).indexOf(d) >= 0 ? '.sun' : dow === 6 ? '.sat' : ''), null, String(d));
      if (d === C.circle) { s.classList.add('circ'); s.appendChild(el('i.ring', { html: '<svg viewBox="0 0 40 34"><path d="M30 6 C 18 0, 4 6, 5 17 C 6 29, 26 32, 34 22 C 39 15, 35 7, 26 5" fill="none" stroke="#d8262a" stroke-width="3" stroke-linecap="round"/></svg>' })); s.appendChild(el('em.note', { style: { fontFamily: D().hand && D().hand.mom } }, T(C.note || ''))); }
      grid.appendChild(s);
    }
    box.append(el('div.y', null, T(C.year || '')), el('div.m', null, T(C.month || '')), grid);
    return { node: box, update() {} };
  };
  /** 폰 화면빛 .ceilglow — phoneGlow 'ceil' / 'ring' (1.6 s pulse) / 'call' (ear) / 'ended' (on the table) — §8.3-5 */
  FXB.phoneglow = function () {
    const c = meta('r3_kitchen', 'ceil_glow', { x: 0.6, y: 0.08 });
    const wrap = el('div.rm3-pglow');
    const ceil = el('i.ceil'); ceil.style.left = c.x * 100 + '%'; ceil.style.top = c.y * 100 + '%';
    const ear = el('i.ear'); ear.style.left = '57%'; ear.style.top = '38%';
    const tbl = el('i.tbl'); tbl.style.left = '78.5%'; tbl.style.top = '51%';
    wrap.append(ceil, ear, tbl);
    return { node: wrap, update() {
      const g = get('phoneGlow'), off = flag('handover');
      ceil.className = 'ceil' + (!off && (g === 'ceil' || g === 'ring') ? ' on' : '') + (!off && g === 'ring' && !(E() && E().less && E().less()) ? ' pulse' : '');
      ear.classList.toggle('on', !off && g === 'call');
      tbl.classList.toggle('on', !off && g === 'ended');
    } };
  };
  /** 김 .steam3 — stove 'steam' (r3_kitchen pot_steam · c3_pot steam_o) · reduced motion = still (§8.3-5) */
  FXB.steam = function (sc) {
    const p = sc.kind === 'cu' ? meta(sc.imgKey || 'c3_pot', 'steam_o', { x: 0.7, y: 0.32 }) : meta('r3_kitchen', 'pot_steam', { x: 0.435, y: 0.383 });
    const n = el('div.rm3-steam' + (sc.kind === 'cu' ? '.cu' : ''), null, el('i'), el('i'));
    n.style.left = p.x * 100 + '%'; n.style.top = p.y * 100 + '%';
    return { node: n, update() { n.classList.toggle('on', get('stove') === 'steam'); } };
  };
  /** 불꽃 x3_flame on c3_pot_lit (screen) · .9 ↔ 1 at 1.2 Hz — not a flicker (§8.3-5) */
  FXB.flame = function () {
    const n = el('img.rm3-flame', { alt: '', draggable: 'false' });
    if (hasImg('x3_flame')) n.src = imgUrl('x3_flame');
    n.onerror = function () { this.classList.add('css'); this.removeAttribute('src'); };
    const fbq = meta('c3_pot_lit', 'burner_q', { cx: 0.585, cy: 0.715, rx: 0.14, ry: 0.055 });
    const css = el('i.rm3-flamecss'); pctBox(css, { x: fbq.cx - fbq.rx, y: fbq.cy - fbq.ry * 2.2, w: fbq.rx * 2, h: fbq.ry * 2.6 });
    const wrap = el('div.rm3-flamewrap', null, n, css);
    return { node: wrap, update() { const s = get('stove'); wrap.classList.toggle('on', s === 'flame' || s === 'steam'); wrap.classList.toggle('nopng', !hasImg('x3_flame') || !n.getAttribute('src')); } };
  };

  /* ---------- close-up DOM (clue text — mandatory, §9.8) ---------- */
  const DOMB = {};
  function handFont(who) { const h = D().hand || {}; return who === 'mom' ? h.mom : h.sea; }
  /** c3_manual: printed staff E5 A5 C6 ‖ B5 A5 E5 (3/4, no title) + 태엽 line (§3.13 · §8.3-6 ①) */
  DOMB.manual = function (sc) {
    const sq = bbox(meta('c3_manual', 'staff_q', [[0.108, 0.437], [0.905, 0.437], [0.905, 0.552], [0.108, 0.552]]));
    const pq = bbox(meta('c3_manual', 'print_q', [[0.135, 0.3], [0.885, 0.3], [0.885, 0.355], [0.135, 0.355]]));
    const txt = (D().text && D().text.manual) || {};
    const Y = { E5: 45, A5: 30, C6: 20, B5: 25 };            // treble staff: F5 40 · D5 50 · B4 60 · G4 70 · E4 80 (10 = one line step)
    const lines = [40, 50, 60, 70, 80].map((y) => '<line x1="6" x2="452" y1="' + y + '" y2="' + y + '"/>').join('');
    const xs = [112, 162, 212, 300, 350, 400];
    const notes = (txt.notes || ['E5', 'A5', 'C6', 'B5', 'A5', 'E5']).map((nm, i) => {
      const y = Y[nm] || 45, x = xs[i] || 112 + i * 50;
      let led = '';
      if (y <= 30) led += '<line class="ld" x1="' + (x - 10) + '" x2="' + (x + 10) + '" y1="30" y2="30"/>';
      if (y <= 20) led += '<line class="ld" x1="' + (x - 10) + '" x2="' + (x + 10) + '" y1="20" y2="20"/>';
      return led + '<ellipse cx="' + x + '" cy="' + y + '" rx="6.2" ry="4.4" transform="rotate(-22 ' + x + ' ' + y + ')"/><line class="st" x1="' + (x - 5.6) + '" x2="' + (x - 5.6) + '" y1="' + (y + 1.5) + '" y2="' + (y + 34) + '"/>';
    }).join('');
    const clef = '<path class="clef" d="M30 96 C 24 96 22 88 28 86 C 33 85 34 92 30 94 M30 94 C 34 70 38 40 36 18 C 34 6 26 10 27 22 C 28 34 40 44 42 56 C 44 70 30 78 22 70 C 15 62 22 50 32 50 C 42 50 44 64 36 68"/>';
    const svg = '<svg viewBox="0 0 460 100" preserveAspectRatio="none"><g class="lines">' + lines + '</g>' + clef +
      '<text class="ts" x="62" y="56">3</text><text class="ts" x="62" y="76">4</text>' + notes +
      '<line class="bar" x1="255" x2="255" y1="40" y2="80"/><line class="bar" x1="444" x2="444" y1="40" y2="80"/><line class="barB" x1="451" x2="451" y1="40" y2="80"/></svg>';
    const staff = pctBox(el('div.rm3-staff', { html: svg }), sq);
    const print = pctBox(el('div.rm3-print'), pq);
    print.appendChild(el('span', { style: { fontSize: (pq.h * sc.h * 0.62) + 'px' } }, T(txt.print || '')));
    return { node: el('div.rm3-dom.manual', null, staff, print) };
  };
  /** hand-written DOM line; `bounds` {x0, x1} (fractions) keeps the line on the paper — the size shrinks to fit (estimate:
   *  Hangul ≈ 1 em · space ≈ .35 em · other ≈ .55 em) */
  function drawText(sc, spec, txt, family, extra, bounds) {
    const t = T(txt);
    const n = el('span.rm3-hand', null, t);
    n.style.left = spec.x * 100 + '%'; n.style.top = spec.y * 100 + '%';
    let fs = spec.h * sc.h * 0.9;
    if (bounds) {
      const em = [...t].reduce((s, ch) => s + (/[ㄱ-ㆎ가-힣]/.test(ch) ? 1 : ch === ' ' ? 0.35 : 0.55), 0) || 1;
      const x0 = spec.align === 'left' ? spec.x : spec.align === 'right' ? null : null;
      let room = Infinity;
      if (spec.align === 'left') room = (bounds.x1 - x0) * sc.w;
      else if (spec.align === 'right') room = (spec.x - bounds.x0) * sc.w;
      else room = 2 * Math.min(spec.x - bounds.x0, bounds.x1 - spec.x) * sc.w;
      if (em * fs > room) fs = Math.max(12, room / em);
    }
    n.style.fontSize = Math.round(fs) + 'px';
    n.style.color = spec.color || '#333'; n.style.fontFamily = family;
    const tx = spec.align === 'left' ? '0' : spec.align === 'right' ? '-100%' : '-50%';
    n.style.transform = 'translate(' + tx + ',-50%) rotate(' + (spec.rot || 0) + 'deg)';
    if (extra) n.classList.add(extra);
    return n;
  }
  /** c3_drawing: crayon notes baked (paper fallback = SVG staff + six notes, 5th raised + smile) + child hand DOM (§8.3-6 ②) */
  DOMB.drawing = function (sc) {
    const t = (D().text && D().text.drawing) || {};
    const dt = meta('c3_drawing', 'draw_txt', {}) || {};
    const pos = { title: dt.title || { x: 0.5, y: 0.235, h: 0.07, rot: -3, color: '#e8862a' },
      wrong: dt.wrong || { x: 0.7107, y: 0.3378, h: 0.045, rot: 3, color: '#e2709a', align: 'left' },
      sig: dt.sig || { x: 0.83, y: 0.775, h: 0.024, rot: -2, color: '#3a6fd0', align: 'right' } };
    const wrap = el('div.rm3-dom.drawing');
    const fb = el('div.rm3-paperfb');
    const notes = meta('c3_drawing', 'notes', [[0.2769, 0.5138, 0.025, '#d23c3c'], [0.3741, 0.4705, 0.0217, '#e8862a'], [0.4713, 0.4259, 0.0241, '#8fbf3a'],
      [0.5685, 0.4409, 0.0233, '#3a6fd0'], [0.6657, 0.3478, 0.0241, '#e2709a'], [0.763, 0.5138, 0.0216, '#7b4fc0']]);
    const stf = meta('c3_drawing', 'staff', { lines_y: [0.4259, 0.4558, 0.4851, 0.5138, 0.5411], x0: 0.2161, x1: 0.8237 });
    const ar = sc.h / sc.w;
    let s = '<svg viewBox="0 0 1 ' + ar + '" preserveAspectRatio="none">';
    stf.lines_y.forEach((y) => { s += '<path d="M' + stf.x0 + ' ' + (y * ar) + ' Q ' + ((stf.x0 + stf.x1) / 2) + ' ' + ((y + 0.006) * ar) + ' ' + stf.x1 + ' ' + (y * ar) + '" stroke="#2a2a2a" stroke-width="0.006" fill="none" stroke-linecap="round"/>'; });
    notes.forEach((nt, i) => {
      const x = nt[0], y = nt[1] * ar, r = nt[2];
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + nt[3] + '"/><line x1="' + (x + r * 0.9) + '" x2="' + (x + r * 0.9) + '" y1="' + y + '" y2="' + (y - 0.09) + '" stroke="' + nt[3] + '" stroke-width="0.006"/>';
      if (i === 4) s += '<circle cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.2) + '" r="' + r * 0.13 + '" fill="#5a2a3a"/><circle cx="' + (x + r * 0.35) + '" cy="' + (y - r * 0.2) + '" r="' + r * 0.13 + '" fill="#5a2a3a"/><path d="M' + (x - r * 0.45) + ' ' + (y + r * 0.2) + ' Q ' + x + ' ' + (y + r * 0.7) + ' ' + (x + r * 0.45) + ' ' + (y + r * 0.2) + '" stroke="#5a2a3a" stroke-width="0.004" fill="none"/>';
    });
    s += '</svg>';
    fb.innerHTML = s;
    wrap.appendChild(fb);
    const fam = handFont('sea');
    const pq = bbox(meta('c3_drawing', 'paper_q', [[0.153, 0.15], [0.88, 0.157], [0.886, 0.832], [0.131, 0.837]]));
    const bnd = { x0: pq.x + 0.02, x1: pq.x + pq.w - 0.03 };
    wrap.append(drawText(sc, pos.title, t.title || '', fam, 'crayon', bnd), drawText(sc, pos.wrong, t.wrong || '', fam, 'crayon', bnd), drawText(sc, pos.sig, t.sig || '', fam, 'pencil', bnd));
    return { node: wrap };
  };
  /** c3_drawing_back: 엄마 글씨 (Nanum Brush Script · 볼펜 파랑 · multiply · −2°) */
  DOMB.drawingBack = function (sc) {
    const lines = (D().text && D().text.drawingBack) || [];
    const bt = meta('c3_drawing', 'back_txt', {}) || {};
    const l1 = bt.l1 || { x: 0.5, y: 0.4, h: 0.036, rot: -2, color: '#23305e' }, l2 = bt.l2 || { x: 0.5, y: 0.465, h: 0.032, rot: -2, color: '#23305e' };
    const wrap = el('div.rm3-dom.back', null, el('div.rm3-paperfb'));
    const bnd = { x0: 0.2, x1: 0.88 };
    wrap.append(drawText(sc, l1, lines[0] || '', handFont('mom'), 'pen', bnd), drawText(sc, l2, lines[1] || '', handFont('mom'), 'pen', bnd));
    return { node: wrap };
  };
  /** c3_doorframe: the 12 lines + labels are baked into the image; this DOM copy is drawn only when the image is missing (§9.8) */
  DOMB.doorframe = function (sc) {
    const marks = (D().text && D().text.doorframe) || [];
    const lines = meta('c3_doorframe', 'lines', null);
    const labels = meta('c3_doorframe', 'labels', null);
    const ex = meta('c3_doorframe', 'edge_x', 0.305), fw = meta('c3_doorframe', 'face_w', 0.395);
    const cm = [122, 127, 133, 138, 144, 150, 155, 158, 159.5, 160.5, 161, 161.5];
    const wrap = el('div.rm3-dom.frame', null, pctBox(el('i.face'), { x: ex, y: 0, w: fw, h: 1 }));
    marks.forEach((mk, i) => {
      const ln = lines && lines[i];
      const y = ln ? ln.y : (182 - cm[i]) / (182 - 98) * 0.84 + 0.08;
      const x0 = ln ? ln.x0 : ex + 0.012, x1 = ln ? ln.x1 : ex + fw * 0.55;
      wrap.appendChild(pctBox(el('i.ln'), { x: x0, y: y - 0.0012, w: x1 - x0, h: 0.0024 }));
      const lb = labels && labels[i];
      const box = lb && lb.box;
      const spec = box ? { x: box[0], y: (box[1] + box[3]) / 2, h: (box[3] - box[1]) * 0.95, rot: 0, align: 'left', color: '#4a4a52' }
        : { x: (i % 2 && i > 8) ? ex + 0.012 : x1 + 0.01, y: y - 0.01, h: 0.019, rot: 0, align: 'left', color: '#4a4a52' };
      wrap.appendChild(drawText(sc, spec, mk[0], handFont(mk[1] === 'mom' ? 'mom' : 'sea'), 'graphite'));
    });
    return { node: wrap };
  };

  /* ======================= scenes (one view or one close-up, natural image size, scaled by transform) ======================= */
  function viewDef(roomId, viewId) {
    const r = D().rooms[roomId]; if (!r) return null;
    return r.views.find((v) => v.id === viewId) || null;
  }
  function roomOfView(viewId) { const rs = D().rooms; for (const k in rs) if (rs[k].views.some((v) => v.id === viewId)) return k; return null; }
  function cuDef(id) { return (D().closeups || {})[id] || null; }

  function Scene(inst, kind, id, roomId) {
    const sc = this;
    this.inst = inst; this.kind = kind; this.id = id; this.room = roomId || null;
    this.def = kind === 'view' ? viewDef(roomId, id) : cuDef(id);
    const def = this.def || {};
    this.w = def.w || 1024; this.h = def.h || 1536;
    this.z = 1; this.cx = def.focus ? def.focus.x : 0.5; this.cy = def.focus ? def.focus.y : 0.5;
    this.el = el('div.rm3-frame.k-' + kind + '.' + id);
    this.el.style.width = this.w + 'px'; this.el.style.height = this.h + 'px';
    this.imgHost = el('div.rm3-imgs');
    this.baseHost = el('div.rm3-basehost');
    // in-room DOM effects (LED · door-gap light · clock hands · calendar · windows · boiler · steam) sit on the wall, under the
    // people / dog patches — 엄마 standing at the door hides the LED behind her (§6.3); the phone's light on her is above (fxHost)
    this.fxUnder = el('div.rm3-fx.under');
    this.imgHost.append(this.baseHost, this.fxUnder);
    this.el.appendChild(el('div.rm3-fbsil.' + id));
    this.el.appendChild(this.imgHost);
    this.base = new BaseSlot(this.baseHost, this);
    this.layers = (def.layers || []).map((spec) => { const box = el('div.rm3-pl.' + spec.id); this.imgHost.appendChild(box); return new PatchLayer(box, spec, this); });
    this.fx = [];
    this.fxHost = el('div.rm3-fx');
    this.el.appendChild(this.fxHost);
    (def.fx || []).forEach((name) => this.addFx(name));
    if (kind === 'cu') {
      if (def.led) this.addFx('led', call(def.led));
      if (def.flame) this.addFx('flame');
      if (def.steam) this.addFx('steam');
      if (def.dom && DOMB[def.dom]) {
        const b = DOMB[def.dom](this);
        this.dom = b.node;
        if (def.domOnlyOnFail) this.dom.classList.add('onfail');
        this.el.appendChild(this.dom);
      }
      if (def.screen) this.buildScreen();
    }
    this.spotsEl = el('div.rm3-spots');
    this.el.appendChild(this.spotsEl);
    this.spotsSig = '';
    this.onFail = () => {
      if (sc.screenHolder) {                       // §9.8: no photo → the DOM screen alone, centred on black
        sc.screenHolder.classList.add('flat');
        sc.cx = 0.5; sc.cy = 0.5;
        setTimeout(() => { try { sc.inst.layout && sc.inst.layout(); } catch (e) {} }, 0);
      }
      // §9.8: a missing close-up = the same base view cropped and enlarged (soft) + the DOM LED / caption it already has
      const ref = def.ref && meta('ref_rects', def.ref, null);
      if (ref && ref.src && hasImg(ref.src) && !sc.cropFb) {
        const c = (sc.cropFb = el('div.rm3-cropfb'));
        c.style.backgroundImage = 'url("' + imgUrl(ref.src) + '")';
        c.style.backgroundSize = (100 / ref.w) + '% ' + (100 / ref.h) + '%';
        c.style.backgroundPosition = (ref.w >= 1 ? 0 : ref.x / (1 - ref.w) * 100) + '% ' + (ref.h >= 1 ? 0 : ref.y / (1 - ref.h) * 100) + '%';
        sc.baseHost.appendChild(c);
      }
    };
    this.live(true);
  }
  const FX_OVER = { phoneglow: 1, flame: 1 };
  Scene.prototype.addFx = function (name, p) {
    const b = FXB[name] && FXB[name](this, p);
    if (!b) return;
    if (b.node) (FX_OVER[name] || this.kind === 'cu' ? this.fxHost : this.fxUnder).appendChild(b.node);
    this.fx.push(b);
  };
  Scene.prototype.buildScreen = function () {
    const inst = this.inst;
    const VW = 300, VH = 640;
    const key = this.imgKey || call(this.def.key) || this.id;
    const q = meta(key, this.def.screen, null) || meta('c3_phone_ring', 'ring_q', [[0.1992, 0.5527], [0.3779, 0.5098], [0.5801, 0.7598], [0.3945, 0.8447]]);
    const holder = (this.screenHolder = el('div.rm3-ringhold'));
    holder.style.width = VW + 'px'; holder.style.height = VH + 'px';
    holder.style.transform = quadMatrix(VW, VH, q.map((p) => [p[0] * this.w, p[1] * this.h]));
    if (!inst.ringNode) inst.ringNode = el('div.rm3-ringscr', { 'data-qa': 'room.screen' });
    holder.append(inst.ringNode, el('i.glass'));
    this.el.appendChild(holder);
  };
  /** live state → pictures (§6.3 rule 1: in view, as it happens) */
  Scene.prototype.live = function (first) {
    const def = this.def || {};
    const key = call(def.key, null, this.id) || this.id;
    this.imgKey = key;
    this.base.set(key, first ? 0 : 1200);
    this.layers.forEach((L) => L.set(call(L.spec.key, null, null) || null, first));
    this.fx.forEach((b) => { try { b.update && b.update(); } catch (e) { console.error('[room3] fx', e); } });
  };

  /* ======================= instances (camera · camlock · eye) ======================= */
  const insts = [];
  function topInst() { for (let i = insts.length - 1; i >= 0; i--) if (!insts[i].closed) return insts[i]; return null; }
  let refreshQ = 0;
  function refreshAll() {
    if (refreshQ) return;
    const run = () => { refreshQ = 0; insts.slice().forEach((i) => { try { i.live(); } catch (e) { console.error('[room3] live', e); } }); };
    refreshQ = (typeof requestAnimationFrame === 'function' && !document.hidden) ? requestAnimationFrame(run) : setTimeout(run, 0);
  }
  function refreshNow() { insts.slice().forEach((i) => { try { i.live(); } catch (e) { console.error('[room3] live', e); } }); }
  function anyEye() { return insts.some((i) => i.mode === 'eye' && !i.closed); }

  function createInst(mode, o) {
    o = o || {};
    const eye = mode === 'eye', cam = !eye;
    const inst = { mode, closed: false, o };
    const rs = RS();
    let room = o.room || (o.view && roomOfView(o.view)) || (eye ? 'lv' : (rs.room || whereNow()));
    if (!D().rooms[room]) room = 'lv';
    let views = D().rooms[room].views;
    let vi = Math.max(0, views.findIndex((v) => v.id === (o.view || (rs.room === room ? rs.view : '') || (room === 'sr' ? 'r3_sr_bed' : 'r3_door'))));
    let flashOn = cam && (o.flash != null ? !!o.flash : !!rs.flash);
    let spotsOn = o.spots !== false;
    let main = null;            // the current scene (view, or an eye close-up)
    let cu = null;              // camera close-up overlay scene
    let busy = false;           // a go: move is running

    /* ---------- DOM ---------- */
    const root = el('div.rm3-room.' + (eye ? 'rm3-eyeview' : 'rm3-cam'), eye
      ? { 'data-qa': 'room.eye', tabindex: '0', 'aria-label': '' }
      : { 'data-qa': 'room.camera' });
    root.dataset.status = 'light';
    if (G.DEBUG && !G.APP && R._debugRects) root.classList.add('rm3-debug');
    const vp = el('div.rm3-vp');
    const turnWrap = el('div.rm3-turn');
    vp.appendChild(turnWrap);
    const torch = el('div.rm3-torch');
    const capEl = el('div.rm3-cap');
    const subsEl = el('div.rm3-dirsubs');
    const dimEl = el('div.rm3-dim');
    const shotFx = el('div.rm3-shotfx');
    const cuLayer = el('div.rm3-culayer');
    root.append(vp, torch, el('div.rm3-vig'), subsEl, dimEl, capEl, shotFx);
    let dots = null, flashBtn = null, zoomBtn = null, thumb = null;
    if (cam) {
      const closeBtn = el('button.rm3-btn.rm3-close', { 'data-qa': 'room.close', 'aria-label': '닫기', html: SVG.close });
      flashBtn = el('button.rm3-btn.rm3-flashbtn', { 'data-qa': 'room.flash', 'aria-label': '손전등', html: SVG.flash });
      dots = el('div.rm3-dots');
      const prevBtn = el('button.rm3-turnbtn.left', { 'data-qa': 'room.prev', 'aria-label': '왼쪽', html: SVG.left });
      const nextBtn = el('button.rm3-turnbtn.right', { 'data-qa': 'room.next', 'aria-label': '오른쪽', html: SVG.right });
      zoomBtn = el('button.rm3-zoom', { 'data-qa': 'room.zoom' }, '1×');
      const shutter = el('button.rm3-shutter', { 'data-qa': 'room.shutter', 'aria-label': '촬영' }, el('i'));
      thumb = el('button.rm3-thumb', { 'data-qa': 'room.thumb', 'aria-label': '사진' });
      if (mode === 'camlock') thumb.style.visibility = 'hidden';
      const chrome = el('div.rm3-chrome', null,
        // the outer 30 px of the top corners belong to the game layer (엄마에게 보여 드리기 tab · ✎ tab, z 60 — ARCH §2.3);
        // story cards are bottom-anchored (z 150) — so ✕ and ‹ live at the top, just inside the tabs
        el('div.rm3-top', null, closeBtn, el('div.rm3-topmid', null, dots, flashBtn), el('span.rm3-topsp')),
        prevBtn, nextBtn,
        el('div.rm3-bottom', null, zoomBtn, el('div.rm3-mode', null, el('span', null, T('사진'))), el('div.rm3-row', null, thumb, shutter, el('span.rm3-rowsp'))));
      root.appendChild(chrome);
      closeBtn.addEventListener('click', () => close('closed'));
      flashBtn.addEventListener('click', () => { sfx('tap'); setFlash(!flashOn); });
      prevBtn.addEventListener('click', () => turn(-1));
      nextBtn.addEventListener('click', () => turn(1));
      zoomBtn.addEventListener('click', () => { sfx('tap'); const sc = cu || main; if (!sc) return; zoomTo(sc, sc.z > 1.4 ? 1 : 2); });
      shutter.addEventListener('click', shoot);
      thumb.addEventListener('click', () => {
        if (mode === 'camlock') return;
        try { if (G.phone && G.phone.isLocked && G.phone.isLocked()) return; } catch (e) {}
        close('closed');
        setTimeout(() => { try { G.phone && G.phone.openApp && G.phone.openApp('gallery', { album: 'camera' }); } catch (e) {} }, 260);
      });
      const shots = vars().shots || [];
      if (shots[0] && shots[0].key && hasImg(shots[0].key)) thumb.style.backgroundImage = 'url("' + imgUrl(shots[0].key) + '")';
      if (flashBtn) flashBtn.classList.toggle('on', flashOn);
    }
    root.appendChild(cuLayer);
    root.classList.toggle('flash-on', flashOn);

    /* ---------- mounting (ARCH §2.3: camera in #app-stack z 10 · camlock / eye in a z 45 layer) ---------- */
    let entry = null, layer = null, offBack = null;
    if (mode === 'camera' && G.phone && typeof G.phone.push === 'function') {
      entry = G.phone.push(root, { appId: 'camera', anim: 'fade', onBack: () => back(), onClose: () => close('shell', true) });
    } else {
      layer = el('div.rm3-layer' + (eye ? '.rm3-eye' : '.rm3-camlock'));
      layer.appendChild(root);
      screenEl().appendChild(layer);
      if (eye) screenEl().classList.add('eye-mode');
      const fadeMs = eye ? Math.max(0, o.fadeMs || 0) : 250;
      if (fadeMs) { layer.style.transition = 'opacity ' + fadeMs + 'ms ease'; requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('in'))); }
      else layer.classList.add('in', 'now');
      if (G.phone && typeof G.phone.pushBack === 'function') offBack = G.phone.pushBack(() => { if (inst.closed || insts.indexOf(inst) < 0) return false; return back(); });
    }
    insts.push(inst);

    /* ---------- layout (fit · zoom · pan) ---------- */
    let vw = 1, vh = 1;
    function measure() { const r = vp.getBoundingClientRect(); vw = Math.max(1, r.width); vh = Math.max(1, r.height); }
    function baseScale(sc, w, h) {
      const fit = sc.kind === 'cu' ? (sc.def && sc.def.fit) || 'contain' : 'view';
      if (fit === 'contain') return Math.min(w / sc.w, h / sc.h);
      if (fit === 'cover') return Math.max(w / sc.w, h / sc.h);
      if (eye) return Math.min(Math.max(w / sc.w, (h * 0.70) / sc.h), Math.max(w / sc.w, h / sc.h));   // eye view: the whole width, letterboxed
      return Math.max(w / sc.w, h / sc.h);                                                              // camera viewfinder (≈ 2:3)
    }
    function layout(sc, box) {
      if (!sc || inst.closed) return;
      let w = vw, h = vh;
      if (box) { const r = box.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height); }
      const s = baseScale(sc, w, h) * sc.z, W = sc.w * s, H = sc.h * s;
      let tx = w / 2 - sc.cx * W, ty = h / 2 - sc.cy * H;
      tx = W <= w ? (w - W) / 2 : clamp(tx, w - W, 0);
      ty = H <= h ? (h - H) / 2 : clamp(ty, h - H, 0);
      sc.cx = (w / 2 - tx) / W; sc.cy = (h / 2 - ty) / H;
      sc.s = s; sc.W = W; sc.H = H; sc.tx = tx; sc.ty = ty; sc.bw = w; sc.bh = h;
      sc.el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      sc.el.style.setProperty('--iz', String(1 / s));
      if (zoomBtn && sc === (cu || main)) zoomBtn.textContent = (sc.z > 1.05 ? (Math.round(sc.z * 10) / 10) : 1) + '×';
      if (sc === (cu || main)) applyYaw();
    }
    function relayout() { measure(); if (main) layout(main); if (cu) layout(cu, cu.box); }
    inst.layout = relayout;

    /* ---------- yaw (§7.1.2: view index·90 + (panX − .5)·50 (+6 on r3_door) · close-ups inherit their table value) ---------- */
    function sceneYaw(sc) {
      if (!sc) return 0;
      if (sc.kind === 'cu') return sc.def && sc.def.yaw != null ? sc.def.yaw : 0;
      const d = sc.def || {}, hW = Math.min(0.5, (sc.bw || vw) / (2 * (sc.W || 1)));
      const panX = hW >= 0.5 ? 0.5 : clamp((sc.cx - hW) / (1 - 2 * hW), 0, 1);
      return ((((d.yaw || 0) + (d.cam || 0) + (panX - 0.5) * 50) % 360) + 360) % 360;
    }
    inst.yaw = () => sceneYaw(cu || main);
    function applyYaw() { if (inst.closed || topInst() !== inst || document.hidden) return; try { G.audio && G.audio.setYaw && G.audio.setYaw(inst.yaw()); } catch (e) {} }

    /* ---------- scenes ---------- */
    function curView() { return views[vi]; }
    function setDots() {
      if (!dots) return;
      dots.innerHTML = '';
      views.forEach((v, k) => {
        const b = el('button.rm3-dot' + (k === vi ? '.on' : ''), { 'data-qa': 'room.view:' + v.id, 'aria-label': '' }, el('i'));
        b.addEventListener('click', () => { if (k !== vi) { sfx('tap'); showView(k, k > vi ? 1 : -1); } else if (cu) closeCloseup(); });
        dots.appendChild(b);
      });
    }
    function markRoot() {
      root.dataset.room = room;
      root.dataset.view = curView() ? curView().id : '';
      const cid = cu ? cu.id : main && main.kind === 'cu' ? main.id : '';
      if (cid) root.dataset.closeup = cid; else delete root.dataset.closeup;
      if (cam) {
        const scr = cu ? 'camera.closeup.' + cu.id : 'camera.' + curView().id;
        root.dataset.scr = scr;
        if (entry) entry.scr = scr;
        rs.room = room; rs.view = curView().id; rs.closeup = cu ? cu.id : null; save();
      }
    }
    function emitView() {
      emit('room:view', { room, view: curView() ? curView().id : null, closeup: cu ? cu.id : (main && main.kind === 'cu' ? main.id : null), mode: eye ? 'eye' : 'camera' });
    }
    /** replace the main scene. how: 'turn-r' | 'turn-l' (≥ 0.4 s slide) · number = crossfade ms · 0 = cut */
    function putScene(sc, how) {
      const old = main;
      main = sc;
      sc.z = 1;
      if (typeof how === 'number' && how > 0 && old) {
        sc.el.style.opacity = '0';
        turnWrap.appendChild(sc.el);
        measure(); layout(sc);
        requestAnimationFrame(() => requestAnimationFrame(() => { sc.el.style.transition = 'opacity ' + how + 'ms ease'; sc.el.style.opacity = '1'; }));
        setTimeout(() => { if (old.el.parentNode) old.el.remove(); }, how + 80);
      } else {
        turnWrap.appendChild(sc.el);
        if (old && old.el.parentNode) old.el.remove();
        measure(); layout(sc);
        if (how === 'turn-r' || how === 'turn-l') {
          turnWrap.classList.remove('turn-r', 'turn-l'); void turnWrap.offsetWidth;
          if (!reduceMotion()) turnWrap.classList.add(how);
        }
      }
      inst.spotsSig = '';
      renderSpots();
      hideCaption();
      markRoot();
      emitView();
      applyYaw();
    }
    function showView(i, dir, how) {
      vi = ((i % views.length) + views.length) % views.length;
      if (cu) closeCloseup(true);
      const sc = new Scene(inst, 'view', views[vi].id, room);
      putScene(sc, how != null ? how : dir ? (dir > 0 ? 'turn-r' : 'turn-l') : 0);
      if (dir && how == null) sfx('whoosh');
      setDots();
    }
    function setRoom(rid, viewId, how) {
      if (!D().rooms[rid]) return;
      room = rid; views = D().rooms[rid].views;
      const k = views.findIndex((v) => v.id === viewId);
      showView(k >= 0 ? k : 0, 0, how);
    }
    inst.setRoom = setRoom;
    function turn(d) {
      if (inst.closed || busy) return;
      if (cu) return;
      if (main && main.kind === 'cu') return;              // an eye cut (03:33 · END · hook) does not rotate
      showView(vi + d, d);
    }

    /* ---------- hotspots ---------- */
    const ctxFor = () => ({ eye, mode, n: (k) => { const t = (rs.taps = rs.taps || {}); t[k] = (t[k] | 0) + 1; save(); return t[k]; } });
    function spotList(sc) {
      if (!sc || !sc.def) return [];
      const ctx = { eye, mode, n: () => 0 };
      return (sc.def.spots || []).map((s) => {
        if (s.when && !call(s.when, ctx, false)) return null;
        const r = typeof s.rect === 'function' ? call(s.rect, ctx, null) : s.rect;
        return r ? { s, r } : null;
      }).filter(Boolean);
    }
    function renderSpotsOf(sc, host) {
      const list = spotsOn ? spotList(sc) : [];
      const sig = sc.id + '|' + list.map((x) => x.s.id + ':' + x.r.x + ',' + x.r.y + ',' + x.r.w + ',' + x.r.h).join(';');
      if (sig === sc.spotsSig) return;
      sc.spotsSig = sig;
      host.innerHTML = '';
      list.forEach(({ s, r }) => {
        const b = pctBox(el('button.rm3-spot', { 'data-qa': 'room.spot:' + s.id, dataset: { id: s.id }, 'aria-label': s.aria ? T(s.aria) : '' }), r);
        b.addEventListener('click', (e) => { e.stopPropagation(); if (dragMoved() || busy) return; tapSpot(s, sc); });
        host.appendChild(b);
      });
      if (sc.kind === 'cu' && sc.def && sc.def.flip && !eye) {
        const cq = sc.id === 'c3_drawing_back' ? meta('c3_drawing', 'back_corner_q', [[0.21, 0.74], [0.1, 0.74], [0.1, 0.85], [0.21, 0.85]])
          : meta('c3_drawing', 'corner_q', [[0.79, 0.74], [0.9, 0.74], [0.9, 0.85], [0.79, 0.85]]);
        const b = pctBox(el('button.rm3-spot.rm3-flip', { 'data-qa': 'room.flip', 'aria-label': '', html: SVG.flip }), bbox(cq));
        b.addEventListener('click', (e) => { e.stopPropagation(); if (dragMoved()) return; flip(sc); });
        host.appendChild(b);
      }
    }
    function renderSpots() { if (main) renderSpotsOf(main, main.spotsEl); if (cu) renderSpotsOf(cu, cu.spotsEl); }
    function tapSpot(s, sc) {
      sfx('tap');
      const viewId = sc.kind === 'view' ? sc.id : (curView() ? curView().id : null);
      emit('room:spot', { id: s.id, view: viewId });
      const ctx = ctxFor();
      const cap = call(s.caption, ctx, null);
      if (s.go) { goTap(s, typeof cap === 'string' ? cap : null); return; }
      const cue0 = call(s.cue, ctx, null);
      if (cue0) cue(cue0, s.src ? { src: s.src } : {});
      let cuId = null;
      if (s.closeup && (!s.closeupWhen || call(s.closeupWhen, ctx, false))) cuId = call(s.closeup, ctx, null);
      if (cuId && cam && cuDef(cuId)) {
        setFlag(call(s.flag, ctx, null));
        openCloseup(cuId, typeof cap === 'string' ? cap : null);
        return;
      }
      if (cap && typeof cap === 'object' && cap.text) {      // a 엄마 / 지민 line instead of a caption (§4.9.1 · §4.9.2 ⊕)
        setFlag(call(s.flag, ctx, null));
        try { if (G.cards && G.cards.say) G.cards.say(cap.who || null, cap.text, { id: 'room:tap' }); else caption(cap.text); } catch (e) { caption(cap.text); }
        return;
      }
      let text = cap;
      if (Array.isArray(cap)) text = cap[Math.min(cap.length - 1, ctx.n('cap:' + viewId + ':' + s.id) - 1)];
      if (text) { caption(text); setFlag(call(s.flag, ctx, null)); }
    }
    /** go: doors (§3.2.1 · §4.9 · §9.5-4): eye views = caption only · camera: first tap of that door = caption 1.2 s → 0.6 s
     *  crossfade · later taps move at once */
    async function goTap(s, capText) {
      if (eye || busy) { if (capText) caption(capText); return; }
      const dest = s.go;
      const go = (rs.go = rs.go || {});
      const first = !go[dest];
      busy = true;
      try {
        if (first) {
          go[dest] = 1; save();
          if (capText) caption(capText, 1800);
          await sleep(1200);
          if (inst.closed) return;
        }
        R.where(dest, { view: dest === 'sr' ? 'r3_sr_bed' : 'r3_door' });
        hideCaption(true);
        setRoom(dest, dest === 'sr' ? 'r3_sr_bed' : 'r3_door', first ? 600 : 400);
      } finally { busy = false; }
    }
    inst.goSpot = () => { const sc = main; if (!sc || sc.kind !== 'view' || cu) return false; const x = spotList(sc).find((y) => y.s.go); if (!x) return false; tapSpot(x.s, sc); return true; };

    /* ---------- captions (one line at the bottom — description only) ---------- */
    let capT = 0;
    function hideCaption(now2) { clearTimeout(capT); capEl.classList.remove('in'); if (now2) capEl.classList.add('quick'); else capEl.classList.remove('quick'); }
    function caption(text, ms) {
      const t = T(text); if (!t) return;
      clearTimeout(capT);
      capEl.classList.remove('quick');
      capEl.textContent = t;
      capEl.classList.remove('in'); void capEl.offsetWidth; capEl.classList.add('in');
      capT = setTimeout(() => capEl.classList.remove('in'), ms || Math.max(2800, t.length * 130));
    }
    inst.caption = caption;

    /* ---------- direction subtitles (§7.4 rule 1 — at the direction's place, no direction words) ---------- */
    inst.dirSub = function (text, az, ms) {
      const t = T(text); if (!t) return;
      const rel = az == null ? 0 : ((((az - inst.yaw()) % 360) + 540) % 360) - 180;
      const n = el('div.rm3-dirsub', null, t);
      let x = 50, y = 62;
      if (az != null) { if (Math.abs(rel) <= 28) x = 50 + (rel / 28) * 26; else if (Math.abs(rel) <= 135) x = rel > 0 ? 76 : 24; else { x = 50; y = 70; } }
      n.style.left = x + '%'; n.style.top = y + '%';
      subsEl.appendChild(n);
      Array.prototype.slice.call(subsEl.children, 0, -2).forEach((c) => c.remove());
      requestAnimationFrame(() => {
        const W = subsEl.clientWidth, w = n.offsetWidth;
        if (W && w) n.style.left = Math.max(10 + w / 2, Math.min(W - 10 - w / 2, (x / 100) * W)) + 'px';
        n.classList.add('in');
      });
      setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, ms || 2600);
    };

    /* ---------- camera close-ups (overlay with ‹ · pinch 1–3× · captions) ---------- */
    function openCloseup(id, capText) {
      const def = cuDef(id); if (!def) return;
      if (cu) closeCloseup(true);
      const sc = new Scene(inst, 'cu', id);
      const node = el('div.rm3-cu.' + (def.fit || 'contain'));
      const box = el('div.rm3-cubox');
      box.appendChild(sc.el);
      const bb = el('button.rm3-btn.rm3-cuback', { 'data-qa': 'room.closeup.close', 'aria-label': '돌아가기', html: SVG.back });
      bb.addEventListener('click', () => closeCloseup());
      node.append(box, bb);
      sc.box = box; sc.node = node;
      cuLayer.appendChild(node);
      cuLayer.classList.add('on');
      root.classList.add('rm3-hascu');
      cu = sc;
      attachInput(box, () => cu, true);
      requestAnimationFrame(() => {
        layout(sc, box);
        node.classList.add('in');
        // §9.5-4 · ARCH §5.12: the close-up grows out of its crop rectangle on the view (meta ref_rects — same mapping)
        const ref = def.ref && meta('ref_rects', def.ref, null), mv = main;
        if (!ref || !mv || mv.kind !== 'view' || ref.src !== mv.id || reduceMotion() || lowEnd() || !sc.W) return;
        const vr = vp.getBoundingClientRect(), br = box.getBoundingClientRect();
        const rx = vr.left - br.left + mv.tx + ref.x * mv.W, ry = vr.top - br.top + mv.ty + ref.y * mv.H, s0 = sc.s * (ref.w * mv.W) / sc.W;
        const fin = sc.el.style.transform;
        sc.el.style.transition = 'none';
        sc.el.style.transform = 'translate(' + rx + 'px,' + ry + 'px) scale(' + s0 + ')';
        void sc.el.offsetWidth;
        sc.el.style.transition = 'transform .25s ease-out';
        sc.el.style.transform = fin;
        setTimeout(() => { if (cu === sc) sc.el.style.transition = ''; }, 320);
      });
      renderSpotsOf(sc, sc.spotsEl);
      hideCaption(true);
      if (capText) setTimeout(() => { if (cu === sc) caption(capText); }, 120);
      markRoot();
      emit('room:closeup', { id, open: true });
      emitView();
      applyYaw();
    }
    function closeCloseup(silent) {
      const sc = cu; if (!sc) return;
      cu = null;
      if (!silent) sfx('back');
      sc.node.classList.remove('in');
      setTimeout(() => sc.node.remove(), 260);
      cuLayer.classList.remove('on');
      root.classList.remove('rm3-hascu');
      hideCaption(true);
      markRoot();
      emit('room:closeup', { id: sc.id, open: false });
      emitView();
      applyYaw();
    }
    function flip(sc) {
      const fl = sc.def && sc.def.flip; if (!fl || !fl.closeup) return;
      sfx('pageTurn');
      const next = new Scene(inst, 'cu', fl.closeup);
      next.box = sc.box; next.node = sc.node;
      next.z = sc.z; next.cx = sc.cx; next.cy = sc.cy;
      sc.box.appendChild(next.el);
      next.el.classList.add('rm3-flipin');
      setTimeout(() => sc.el.remove(), 380);
      emit('room:closeup', { id: sc.id, open: false });
      cu = next;
      layout(next, next.box);
      renderSpotsOf(next, next.spotsEl);
      setFlag(fl.flag);
      if (fl.caption) caption(fl.caption);
      markRoot();
      emit('room:closeup', { id: next.id, open: true });
      emitView();
    }
    inst.openCloseup = (id) => { if (cam) openCloseup(id, null); };

    /* ---------- input: swipe-turn · pan when zoomed · pinch / double tap / wheel (camera only) · ←/→ ---------- */
    let lastDrag = null;
    function dragMoved() { return !!(lastDrag && lastDrag.moved && now() - lastDrag.t1 < 350); }
    function attachInput(host, getSc, isCu) {
      const ps = new Map();
      let drag = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 };
      const zoomOk = () => cam;
      host.style.touchAction = 'none';
      host.addEventListener('pointerdown', (e) => {
        if (!isCu && cu) return;
        ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const sc = getSc(); if (!sc) return;
        if (ps.size === 1) drag = { x: e.clientX, y: e.clientY, cx: sc.cx, cy: sc.cy, t: now(), moved: false, id: e.pointerId, over: 0 };
        else if (ps.size === 2 && zoomOk()) {
          const a = Array.from(ps.values());
          pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, z0: sc.z };
          if (drag) drag.moved = true;
        }
      });
      host.addEventListener('pointermove', (e) => {
        if (!ps.has(e.pointerId)) return;
        ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const sc = getSc(); if (!sc) return;
        if (ps.size >= 2 && pinch) { const a = Array.from(ps.values()); sc.z = clamp(pinch.z0 * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / pinch.d, 1, 3); layout(sc, isCu ? sc.box : null); return; }
        if (!drag || drag.id !== e.pointerId) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; try { host.setPointerCapture(e.pointerId); } catch (er) {} }
        if (!drag.moved) return;
        const wantX = drag.cx - dx / (sc.W || 1), wantY = drag.cy - dy / (sc.H || 1);
        sc.cx = wantX; sc.cy = wantY;
        layout(sc, isCu ? sc.box : null);
        drag.over = (wantX - sc.cx) * (sc.W || 1);
        if (!isCu && sc.kind === 'view' && Math.abs(drag.over) > 4 && !reduceMotion()) turnWrap.style.transform = 'translateX(' + clamp(-drag.over * 0.3, -46, 46) + 'px)';
      });
      const up = (e) => {
        if (!ps.has(e.pointerId)) return;
        ps.delete(e.pointerId);
        if (ps.size < 2) pinch = null;
        const sc = getSc();
        if (drag && drag.id === e.pointerId) {
          turnWrap.style.transform = '';
          const d = drag, dx = e.clientX - d.x, dy = e.clientY - d.y, dt = now() - d.t;
          lastDrag = { moved: d.moved, t1: now() };
          if (d.moved && !isCu && sc && sc.kind === 'view' && sc.z <= 1.05 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            if (Math.abs(d.over) > 48 || Math.abs(dx) > 56 || (Math.abs(dx) > 24 && dt < 260)) turn(dx < 0 ? 1 : -1);
          } else if (d.moved && !isCu && sc && sc.kind === 'view' && Math.abs(d.over) > 60) turn(d.over > 0 ? 1 : -1);
          if (!d.moved && zoomOk() && e.pointerType !== 'mouse' && !e.target.closest('button')) {
            const t = now();
            if (t - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { dbl(e, sc); lastTap.t = 0; } else lastTap = { t, x: e.clientX, y: e.clientY };
          }
          drag = null;
        }
      };
      host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
      host.addEventListener('dblclick', (e) => { if (zoomOk() && !e.target.closest('button')) dbl(e, getSc()); });
      host.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!zoomOk()) return;
        const sc = getSc(); if (!sc) return;
        sc.z = clamp(sc.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 3);
        layout(sc, isCu ? sc.box : null);
      }, { passive: false });
      function dbl(e, sc) {
        if (!sc) return;
        if (sc.z > 1.4) { zoomTo(sc, 1); return; }
        const r = (isCu ? sc.box : vp).getBoundingClientRect();
        const ix = (e.clientX - r.left - sc.tx) / (sc.W || 1), iy = (e.clientY - r.top - sc.ty) / (sc.H || 1);
        zoomTo(sc, 2, ix, iy);
      }
    }
    function zoomTo(sc, z, fx, fy) {
      const z0 = sc.z, cx0 = sc.cx, cy0 = sc.cy, cx1 = fx != null ? fx : sc.cx, cy1 = fy != null ? fy : sc.cy, t0 = now();
      const box = sc === cu ? sc.box : null;
      const step = () => {
        if (inst.closed) return;
        const k = Math.min(1, (now() - t0) / 280), e = 1 - Math.pow(1 - k, 3);
        sc.z = z0 + (z - z0) * e; sc.cx = cx0 + (cx1 - cx0) * e; sc.cy = cy0 + (cy1 - cy0) * e;
        layout(sc, box);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    attachInput(vp, () => main, false);
    const onKey = (e) => {
      if (inst.closed || topInst() !== inst) return;
      const ae = document.activeElement;
      if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return;
      if (eye && ae && ae !== root && ae !== document.body && !root.contains(ae)) return;
      try { if ((G.notebook && G.notebook.isOpen && G.notebook.isOpen()) || (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())) return; } catch (er) {}
      if (cam && entry && G.phone && G.phone.top && G.phone.top() !== entry) return;
      if (e.key === 'ArrowLeft') { if (!cu) { turn(-1); e.preventDefault(); } }
      else if (e.key === 'ArrowRight') { if (!cu) { turn(1); e.preventDefault(); } }
      else if (e.key === 'Enter' && cam && !cu) { if (inst.goSpot()) e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    if (eye) root.addEventListener('pointerdown', () => { try { root.focus({ preventScroll: true }); } catch (e) {} });
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => relayout()); ro.observe(vp); } else window.addEventListener('resize', relayout);

    /* ---------- flashlight · shutter ---------- */
    function setFlash(v) {
      if (!cam) return;
      flashOn = !!v; rs.flash = flashOn; save();
      if (flashBtn) flashBtn.classList.toggle('on', flashOn);
      root.classList.toggle('flash-on', flashOn);
      sfx('flashlight');
    }
    inst.setFlash = setFlash;
    inst.flash = () => flashOn;
    function shoot() {
      if (hasCue('cam.shutter')) cue('cam.shutter'); else sfx('shutter');
      if (!reduceFlash()) { shotFx.classList.remove('go'); void shotFx.offsetWidth; shotFx.classList.add('go'); }
      const sc = cu || main, v = curView();
      const key = sc ? (sc.imgKey || sc.id) : v.key;
      const rec = { t: clockNow().getTime(), room, view: v.id, closeup: cu ? cu.id : null, key, zoom: +(sc ? sc.z : 1).toFixed(2) };
      const shots = (vars().shots = Array.isArray(vars().shots) ? vars().shots : []);
      shots.unshift(rec); if (shots.length > 30) shots.length = 30;
      save();
      if (thumb && hasImg(key)) thumb.style.backgroundImage = 'url("' + imgUrl(key) + '")';
      emit('room:shot', { view: v.id, closeup: rec.closeup });
    }

    /* ---------- live ---------- */
    function live() {
      if (inst.closed) return;
      root.classList.toggle('rm3-lowend', lowEnd());
      root.classList.toggle('rm3-calm', reduceMotion());
      if (main) main.live(false);
      if (cu) cu.live(false);
      renderSpots();
    }
    inst.live = live;

    /* ---------- back / close ---------- */
    function back() {
      if (cu) { closeCloseup(); return true; }
      if (eye) return true;                      // eye views consume back (no chrome — the scene owner closes them)
      close('closed');
      return true;
    }
    inst.back = back;
    function close(why, fromShell) {
      if (inst.closed) return;
      inst.closed = true;
      window.removeEventListener('keydown', onKey);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', relayout);
      const i = insts.indexOf(inst); if (i >= 0) insts.splice(i, 1);
      if (offBack) { try { offBack(); } catch (e) {} offBack = null; }
      if (entry && !fromShell) {
        try { if (G.phone && G.phone.top && G.phone.top() === entry && G.phone.pop) G.phone.pop(true); else root.remove(); } catch (e) { root.remove(); }
      }
      if (layer) { layer.classList.remove('in'); setTimeout(() => layer.remove(), why === 'now' ? 0 : (inst.closeMs != null ? inst.closeMs : 320) + 40); }
      if (eye && !anyEye()) screenEl().classList.remove('eye-mode');
      if (o.onClose) { try { o.onClose(); } catch (e) {} }
      const t = topInst();
      if (t) { t.layout(); t.live(); }
      emit('room:close', { mode: eye ? 'eye' : 'camera' });
    }
    inst.close = close;

    /* ---------- eye API (ARCH §5.12) ---------- */
    inst.show = function (p) {
      p = p || {};
      if (inst.closed) return Promise.resolve();
      const ms = p.ms != null ? p.ms : 400;
      if (p.grade !== undefined) setGrade(p.grade);
      if (p.closeup && cuDef(p.closeup)) {
        if (cu) closeCloseup(true);
        const sc = new Scene(inst, 'cu', p.closeup);
        putScene(sc, ms);
      } else if (p.view) {
        const rid = roomOfView(p.view) || room;
        room = rid; views = D().rooms[rid].views;
        vi = Math.max(0, views.findIndex((v) => v.id === p.view));
        const sc = new Scene(inst, 'view', p.view, rid);
        putScene(sc, ms);
        setDots();
      }
      return sleep(ms + 40);
    };
    function setGrade(g) { root.classList.remove('g3-0610', 'g3-blur'); if (g === '0610') root.classList.add('g3-0610'); else if (g === 'blur' || g === 'credits') root.classList.add('g3-blur'); }
    inst.spots = function (v) { spotsOn = v !== false; if (main) main.spotsSig = ''; if (cu) cu.spotsSig = ''; renderSpots(); };
    inst.screenNode = function () {
      const sc = main && main.kind === 'cu' ? main : cu;
      if (sc && sc.screenHolder && inst.ringNode) return inst.ringNode;
      return null;
    };
    inst.dim = function (level, ms) {
      ms = ms == null ? 600 : ms;
      dimEl.style.transition = 'opacity ' + ms + 'ms ease';
      dimEl.style.opacity = String(clamp(+level || 0, 0, 1));
      return sleep(ms + 20);
    };
    inst.closeEye = function (ms) {
      ms = ms == null ? 400 : ms;
      if (inst.closed) return Promise.resolve();
      inst.closeMs = ms;
      if (layer) layer.style.transition = 'opacity ' + ms + 'ms ease';
      close('closed');
      return sleep(ms + 40);
    };

    /* ---------- api ---------- */
    const api = {
      root,
      get mode() { return eye ? 'eye' : 'camera'; },
      get room() { return room; },
      get view() { return curView() ? curView().id : null; },
      get closeupId() { return cu ? cu.id : main && main.kind === 'cu' ? main.id : null; },
      get flash() { return flashOn; },
      setView(id) { const rid = roomOfView(id); if (!rid) return; if (rid !== room) setRoom(rid, id, 400); else { const k = views.findIndex((v) => v.id === id); if (k >= 0 && k !== vi) showView(k, k > vi ? 1 : -1); } },
      closeup: (id) => inst.openCloseup(id), close: () => close('closed'), setFlash, refresh: () => live(),
      caption: (t, ms) => caption(t, ms), dirSub: (t, a, m) => inst.dirSub(t, a, m),
    };
    inst.api = api;
    inst.state = () => ({ mode: eye ? 'eye' : 'camera', room, view: main && main.kind === 'cu' ? null : (curView() ? curView().id : null),
      closeup: cu ? cu.id : main && main.kind === 'cu' ? main.id : null, flash: flashOn });
    inst.eyeApi = {
      show: (p) => inst.show(p), spots: (v) => inst.spots(v), screenNode: () => inst.screenNode(),
      dim: (l, ms) => inst.dim(l, ms), close: (ms) => inst.closeEye(ms), state: () => inst.state(), caption: (t, ms) => caption(t, ms),
      get root() { return root; },
    };

    /* ---------- first picture ---------- */
    setGrade(o.grade);
    if (eye && o.closeup && cuDef(o.closeup)) { main = null; putScene(new Scene(inst, 'cu', o.closeup), 0); setDots(); }
    else showView(vi, 0, 0);
    if (cam && o.closeup && cuDef(o.closeup)) openCloseup(o.closeup, null);
    if (cam) sfx('camOn');
    emit('room:open', { mode: eye ? 'eye' : 'camera' });
    return inst;
  }

  /* ======================= public API (v3) ======================= */
  const V3 = {};
  let inited = false;
  V3.init = function () {
    if (inited) return; inited = true;
    on('flag', refreshAll);
    on('var', (e) => { const k = e && e.k; if (!k || /^(where|momAt|room|easy)$/.test(k)) refreshAll(); });
    on('clock:min', refreshAll);
    on('clock:jump', refreshAll);
    on('settings', refreshAll);
    on('state:load', refreshAll);
    on('visibility', (e) => { if (e && !e.hidden) { refreshAll(); const t = topInst(); if (t) t.layout(); } });
    on('lock:unlock', () => insts.slice().forEach((i) => { if (i.mode === 'camlock') i.close('unlock'); }));
    let lastMom = null, lastWhere = null;
    on('tick', () => { if (!insts.length) return; const m = momPos(), w = whereNow(); if (m !== lastMom || w !== lastWhere) { lastMom = m; lastWhere = w; refreshAll(); } });
    try { G.hooks && G.hooks.set && G.hooks.set('room:refreshLayers', () => { refreshNow(); return true; }); } catch (e) {}
    debugHelpers();
  };
  function ensureInit() { if (!inited) V3.init(); }
  function isLocked() { try { return !!(G.phone && G.phone.isLocked && G.phone.isLocked()); } catch (e) { return false; } }
  V3.open = function (o) {
    o = o || {};
    ensureInit();
    if (!D() || !D().rooms) { console.error('[room3] G.ROOM missing'); return null; }
    if (o.mode === 'eye') { const e = V3.eye(o); return e; }
    const ex = insts.find((i) => (i.mode === 'camera' || i.mode === 'camlock') && !i.closed);
    if (ex) {
      if (o.view || o.room) ex.api.setView(o.view || (o.room === 'sr' ? 'r3_sr_bed' : 'r3_door'));
      if (o.closeup) ex.openCloseup(o.closeup);
      if (o.flash != null) ex.setFlash(!!o.flash);
      return ex.api;
    }
    const locked = !!o.fromLock || isLocked();
    const i = createInst(locked ? 'camlock' : 'camera', o);
    return i ? i.api : null;
  };
  V3.eye = function (o) {
    o = o || {};
    ensureInit();
    if (!D() || !D().rooms) { console.error('[room3] G.ROOM missing'); return null; }
    const ex = insts.find((i) => i.mode === 'eye' && !i.closed);
    if (ex) {
      if (o.view || o.closeup) ex.show({ view: o.view, closeup: o.closeup, ms: o.fadeMs || 400, grade: o.grade });
      if (o.spots !== undefined) ex.spots(o.spots !== false);
      return ex.eyeApi;
    }
    const i = createInst('eye', { view: o.view || (o.closeup ? null : 'r3_door'), closeup: o.closeup, fadeMs: o.fadeMs || 0, spots: o.spots, grade: o.grade });
    return i ? i.eyeApi : null;
  };
  V3.close = function (o) { insts.slice().forEach((i) => { if (i.mode !== 'eye' || (o && o.all)) i.close('closed'); }); };
  V3.isOpen = () => insts.some((i) => !i.closed);
  V3.current = function () { const t = topInst(); return t ? t.state() : null; };
  V3.flash = function (v) {
    const i = insts.slice().reverse().find((x) => x.mode !== 'eye' && !x.closed);
    if (!i) return false;
    if (v !== undefined) i.setFlash(!!v);
    return i.flash();
  };
  V3.refresh = function () { refreshNow(); };
  V3.dirSub = function (text, az, ms) {
    const t = topInst();
    if (t && !document.hidden) { t.dirSub(text, az, ms); return; }
    try { G.fx && G.fx.sub && G.fx.sub(T(text), ms, az != null ? { az } : undefined); } catch (e) {}
  };
  V3.closeup = function (id) { const t = topInst(); if (t) t.openCloseup(id); return Promise.resolve(); };
  V3.caption = function (text, ms) { const t = topInst(); if (t) t.caption(text, ms); };
  V3.where = function (v, o) {
    const cur = whereNow();
    if (v === undefined) return cur;
    if (v !== 'lv' && v !== 'sr') return cur;
    const r = RS();
    if (o && o.view) { r.room = v; r.view = o.view; }
    else if (r.room !== v) { r.room = v; r.view = v === 'sr' ? 'r3_sr_bed' : 'r3_door'; }
    if (v === cur) { save(); return cur; }
    try { if (G.vars) G.vars('where', v); else vars().where = v; } catch (e) { vars().where = v; }
    emit('room:where', { where: v, prev: cur });
    refreshAll();
    return v;
  };
  V3.set = function (k, v) { set(k, v); };
  V3.get = function (k) { return get(k); };
  V3.state = function () {
    const s = Object.assign({}, DEF, RS().st);
    s.mom = momPos();
    s.led = errOn() ? 'red' : 'green';
    s.grade = get('kitchenLight') ? 'spill' : 'night';
    s.winLights = winLights();
    s.where = whereNow();
    return s;
  };
  V3.pulse = function (kind) { if (kind && kind !== 'boiler') return; FX.pulseAt = now(); refreshNow(); setTimeout(refreshAll, PULSE_MS + 20); };
  V3.led = function (pattern) {
    if (pattern && pattern !== 'err3') return Promise.resolve();
    FX.errAt = now();
    refreshNow();
    return new Promise((res) => setTimeout(() => { refreshAll(); res(); }, ERR_MS + 20));
  };

  /* ---------- dispatch: v3 data → the renderer above · anything else → the ep2 renderer, unchanged ---------- */
  const wrap = (name) => function () { return isV3() ? V3[name].apply(R, arguments) : (EP2[name] ? EP2[name].apply(R, arguments) : undefined); };
  ['init', 'open', 'close', 'isOpen', 'current', 'flash', 'refresh', 'dirSub', 'closeup'].forEach((n) => { R[n] = wrap(n); });
  // episode-3 additions (ARCH §5.12) — no-ops on the ep2 page (ep2 never calls them)
  R.eye = function (o) { return isV3() ? V3.eye(o) : null; };
  R.where = function (v, o) { return isV3() ? V3.where(v, o) : (v === undefined ? 'lv' : v); };
  R.set = function (k, v) { if (isV3()) V3.set(k, v); };
  R.get = function (k) { return isV3() ? V3.get(k) : undefined; };
  R.state = function () { return isV3() ? V3.state() : {}; };
  R.pulse = function (k) { if (isV3()) V3.pulse(k); };
  R.led = function (p) { return isV3() ? V3.led(p) : Promise.resolve(); };
  R.caption = function (t, ms) { if (isV3()) V3.caption(t, ms); };

  /* ======================= DEBUG (window.haru — ARCH §7.2: haru.where · haru.room · haru.rects) ======================= */
  function debugHelpers() {
    if (!G.DEBUG || !isV3()) return;
    const h = (window.haru = window.haru || {});
    h.where = (v) => R.where(v);
    h.room = function (view) { const rid = (view && roomOfView(view)) || whereNow(); const a = R.open({ mode: 'camera', room: rid, view: view || undefined }); return a ? R.current() : null; };
    h.rects = function (on) {
      R._debugRects = on === undefined ? !R._debugRects : !!on;
      insts.forEach((i) => { const r = i.api && i.api.root; if (r) r.classList.toggle('rm3-debug', !!R._debugRects && !G.APP); });
      return R._debugRects;
    };
    h.roomFx = FX;
  }
  if (isV3()) debugHelpers();
})();
