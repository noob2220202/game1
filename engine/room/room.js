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
    if (DEBUG()) root.classList.add('rm2-debug');
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
      requestAnimationFrame(() => n.classList.add('in'));
      setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, ms || 2600);
    };

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
      let s = 1, cx = 0.5, cy = 0.5, bw = 1, bh = 1, f = 1, moved = false;
      const vw = { box, inner, moved: () => moved, get scale() { return s; } };
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
      const ps = new Map(); let st = null, pin = null, lt = 0;
      box.style.touchAction = 'none';
      box.addEventListener('pointerdown', (e) => {
        ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ps.size === 1) { st = { x: e.clientX, y: e.clientY, cx, cy }; moved = false; }
        else if (ps.size === 2) { const a = Array.from(ps.values()); pin = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, s0: s }; moved = true; }
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
      function dbl(e) { const r = inner.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; if (s > 1.3) vw.zoomTo(0.5, 0.5, 1); else vw.zoomTo(x, y, Math.min(2, maxZ)); }
      box.addEventListener('wheel', (e) => { e.preventDefault(); s = clamp(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, maxZ); apply(); }, { passive: false });
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
        bb.addEventListener('click', () => closeCloseup());
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
            const z = d.lid.zoomTo; if (c.viewer.scale > 1.4) c.viewer.zoomTo(0.5, 0.5, 1); else c.viewer.zoomTo(z.x, z.y, z.z);
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
    function lidName(host, q, w, h) {
      const qq = q.map((p) => [p[0] * w, p[1] * h]);
      const VW = 220, VH = 60;
      const name = T('{N}');
      const n = el('span.rm2-lidname', null, name);
      const box = el('div.rm2-lid'); box.style.width = VW + 'px'; box.style.height = VH + 'px'; box.style.transform = quadMatrix(VW, VH, qq);
      if ([...name].length > 6) { box.classList.add('long'); n.style.fontSize = Math.max(22, Math.round(54 * 6 / [...name].length)) + 'px'; }
      box.appendChild(n); host.appendChild(box);
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
      if (cu.length) { if (cuTop().def.noBack) return true; closeCloseup(); return true; }
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
      if (via === 'handle') { setTimeout(() => close('handle'), 3600); return; }
      if (via === 'until') { root.classList.add('rm2-fadeout'); setTimeout(() => close('until'), 650); return; }
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
