/* =========================================================
 * engine/core/fx.js — screen FX for episode 2 (core · ARCH_EP2 §4.23, §2.3 layer #fx-layer z 300 / .c2-black z 460)
 *
 * G.fx.init()
 * G.fx.sub(text, ms=3200, {az, cls, replace}) → Promise   bottom sound-subtitle channel (G.audio.sub decides when/what);
 *                                                replace = a class name: lines carrying it are swapped out, not stacked
 * G.fx.subScope({cls, replace}, fn)              opts for every G.fx.sub rendered synchronously inside fn (via G.audio.sub)
 * G.fx.mono(text, ms=3200, {cls}?) → Promise    monologue channel (separate layer, no sound, no toast) — G.e2.mono, recap.
 *                                                ep3 additions (inert unless called): opts.cls (extra class on the line, e.g. the
 *                                                ep3 recap hand) · G.fx.monoNext() ends the line on screen now (recap tap) ·
 *                                                G.fx.monoClear() fades the line on screen and drops the queued ones ([건너뛰기])
 * G.fx.dirArc(az, ms=1200)                       speaker-mode edge arc ◀ ▶ ▲ ▼ relative to G.audio.getYaw()
 * G.fx.edgeShake(px=3, ms=300)                   no-op with G.settings.reduceShake or G.e2.less() — and always with G.EP.noShake
 *                                                (ep3: no shake class anywhere, ARCH §1 · DESIGN_EP3 §9.7 V10; ep2 never sets it)
 * G.fx.setVignette(v)                            sets --vig on #screen (+ #phone so #fx-layer inherits). The value law is the
 *                                                director's (§6.1: .30 + .40·T); the look depends on the visible surface:
 *                                                #phone.c2-room (room / eye / camera view on top) = radial falloff, else an
 *                                                edge shade that follows the screen rectangle (core.css)
 * G.fx.black(ms) → Promise                       full black cover (resolves after ms, then fades out 0.6 s)
 * ep1 names: shake(ms, px) → edgeShake · vignette(s) → setVignette · setTitle blinkTitle stopTitle setFavicon glitch
 *   jumpscare static cinema flash pulse → no-ops (forbidden ep1 tricks; DEBUG warns). Every text goes through G.T.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const FX = (G.fx = G.fx || {});
  const T = (s) => (G.T ? G.T(s) : s);
  const warned = {};
  const dwarn = (k) => { if (G.DEBUG && !warned[k]) { warned[k] = 1; console.warn('[fx] ' + k + '() is a no-op in ep2'); } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  let layer = null, subsBox = null, monoBox = null, arcBox = null, vigEl = null;

  FX.init = function () {
    if (layer && layer.isConnected) return;
    layer = document.getElementById('fx-layer');
    if (!layer) {
      layer = mk('div'); layer.id = 'fx-layer';
      (document.getElementById('phone') || document.body).appendChild(layer);
    }
    vigEl = mk('div', 'c2-vignette');
    arcBox = mk('div', 'c2-arcs');
    subsBox = mk('div', 'c2-subs');
    monoBox = mk('div', 'c2-mono');
    subsBox.setAttribute('aria-live', 'polite');
    monoBox.setAttribute('aria-live', 'polite');
    layer.append(vigEl, arcBox, subsBox, monoBox);
    wireRoom();
    syncRoom();
  };
  const ready = () => { if (!layer || !layer.isConnected) FX.init(); };

  /* ---------- sound subtitles ---------- */
  let subScope = null;
  FX.sub = async function (text, ms, opts) {
    opts = Object.assign({}, subScope, opts);
    ready();
    const line = mk('div', 'c2-sub' + (opts.cls ? ' ' + opts.cls : ''), T(String(text == null ? '' : text)));
    if (opts.az != null) line.dataset.az = String(Math.round(opts.az));
    // opts.replace (a class name): a newer line of the same family takes the old line's place instead of stacking under it
    // (S09 music-box tiers during one volume drag). It shows at once — an in-place text change, not a second fade-in.
    let replaced = false;
    if (opts.replace) {
      Array.prototype.slice.call(subsBox.children).forEach((c) => { if (c.classList.contains(opts.replace)) { c.remove(); replaced = true; } });
    }
    if (replaced) line.classList.add('in');
    subsBox.appendChild(line);
    while (subsBox.children.length > 3) subsBox.removeChild(subsBox.firstChild);
    if (!replaced) requestAnimationFrame(() => line.classList.add('in'));
    await sleep(ms || 3200);
    line.classList.remove('in'); line.classList.add('out');
    await sleep(450);
    line.remove();
  };
  /** G.fx.subScope({cls, replace}, fn) → fn()'s result. Every G.fx.sub line rendered synchronously inside fn gets these opts
   *  (explicit opts win). Lets a caller that routes through G.audio.sub (which owns the subtitle mode · mono queue · wording
   *  and forwards only {az}) still tag its line; a line the audio layer defers (mono queue) renders later without them. */
  FX.subScope = function (opts, fn) {
    const prev = subScope;
    subScope = Object.assign({}, prev, opts);
    try { return fn(); } finally { subScope = prev; }
  };

  /* ---------- monologue (one line at a time) ---------- */
  let monoChain = Promise.resolve();
  let monoGen = 0, monoCut = null;                 // ep3: monoNext / monoClear (never called on the ep2 page)
  FX.mono = function (text, ms, opts) {
    ready();
    const gen = monoGen;
    const run = async () => {
      if (gen !== monoGen) return;                 // cleared while queued
      const line = mk('div', 'c2-mono-line' + (opts && opts.cls ? ' ' + opts.cls : ''), T(String(text == null ? '' : text)));
      monoBox.appendChild(line);
      requestAnimationFrame(() => requestAnimationFrame(() => line.classList.add('in')));
      await new Promise((res) => { const t = setTimeout(done, ms || 3200); function done() { clearTimeout(t); if (monoCut === done) monoCut = null; res(); } monoCut = done; });
      line.classList.remove('in'); line.classList.add('out');
      await sleep(700);
      line.remove();
    };
    const p = monoChain.then(run, run);
    monoChain = p.catch(() => {});
    return p;
  };
  /** ep3 — end the monologue line on screen now (it still fades out 0.7 s) */
  FX.monoNext = function () { if (monoCut) monoCut(); };
  /** ep3 — fade the line on screen and drop every queued line (their promises resolve at once) */
  FX.monoClear = function () { monoGen++; if (monoCut) monoCut(); };

  /* ---------- speaker-mode direction arc ---------- */
  FX.dirArc = function (az, ms) {
    ready();
    const yaw = G.audio && G.audio.getYaw ? Number(G.audio.getYaw()) || 0 : 0;
    const rel = ((((Number(az) || 0) - yaw) % 360) + 540) % 360 - 180;   // −180…180, 0 = in front
    const side = Math.abs(rel) <= 45 ? 'top' : Math.abs(rel) >= 135 ? 'bottom' : rel > 0 ? 'right' : 'left';
    const glyph = { top: '▲', bottom: '▼', left: '◀', right: '▶' }[side];
    const arc = mk('div', 'c2-arc ' + side);
    arc.appendChild(mk('i', null, glyph));
    arc.setAttribute('aria-hidden', 'true');
    arcBox.appendChild(arc);
    requestAnimationFrame(() => arc.classList.add('in'));
    setTimeout(() => { arc.classList.remove('in'); setTimeout(() => arc.remove(), 500); }, ms || 1200);
    return side;
  };

  /* ---------- edge shake ---------- */
  FX.edgeShake = function (px, ms) {
    if (G.EP && G.EP.noShake) return;              // ep3 (ARCH §4.2 fx.js) — ep2 never defines G.EP.noShake
    if ((G.settings && G.settings.reduceShake) || (G.e2 && G.e2.less && G.e2.less())) return;
    const root = document.getElementById('phone');
    if (!root) return;
    root.style.setProperty('--c2-shake', (px || 3) + 'px');
    root.classList.remove('c2-shake'); void root.offsetWidth; root.classList.add('c2-shake');
    clearTimeout(root._c2shake);
    root._c2shake = setTimeout(() => root.classList.remove('c2-shake'), ms || 300);
  };

  /* ---------- vignette ---------- */
  FX.setVignette = function (v) {
    ready();
    const val = Math.max(0, Math.min(1, Number(v) || 0));
    ['screen', 'phone'].forEach((id) => { const n = document.getElementById(id); if (n) n.style.setProperty('--vig', String(val)); });
    if (vigEl) vigEl.classList.toggle('on', val > 0.001);
    if (!roomWired) wireRoom();   // FX.init may have run before G.bus existed
    syncRoom();   // the director calls this every second — a cheap backstop for the bus-driven sync below
  };
  /* Is the room the visible surface? An eye / camlock layer (.rm2-eye, z 45 over the phone UI) or the camera screen on top of
     the app stack. Read-only use of room.js / phone.js state (both owned elsewhere). */
  function roomVisible() {
    try {
      if (!(G.room && G.room.isOpen && G.room.isOpen())) return false;
      const scr = document.getElementById('screen');
      if (scr && scr.querySelector(':scope > .rm2-eye')) return true;
      // ep3 room (ARCH §5.12): eye views .rm3-eye / data-qa room.eye (z 45) · camera mode root data-qa room.camera — absent on ep2
      if (scr && scr.querySelector(':scope > .rm3-eye, :scope > [data-qa="room.eye"]')) return true;
      const top = G.phone && G.phone.top ? G.phone.top() : null;
      const n = top && top.node;
      if (n && n.isConnected && n.classList && n.classList.contains('rm3-room')) return true;
      if (n && n.isConnected && n.matches && (n.matches('[data-qa="room.camera"]') || n.querySelector('[data-qa="room.camera"]'))) return true;
      return !!(n && n.classList && n.classList.contains('rm2-room') && n.isConnected);
    } catch (e) { return false; }
  }
  function syncRoom() {
    const ph = document.getElementById('phone');
    if (ph) ph.classList.toggle('c2-room', roomVisible());
  }
  let roomWired = false;
  function wireRoom() {
    if (roomWired || !G.bus || !G.bus.on) return;
    roomWired = true;
    const later = () => requestAnimationFrame(syncRoom);
    ['room:open', 'room:close', 'room:view', 'screen:push', 'screen:pop', 'home', 'app:open', 'lock:show', 'lock:unlock', 'users:switched']
      .forEach((ev) => { try { G.bus.on(ev, () => { syncRoom(); later(); }); } catch (e) {} });
  }
  if (!G.APP || G.DEBUG) FX.roomLook = roomVisible;   // QA / debug: which vignette look is in force (not in the app build)

  /* ---------- black cover ---------- */
  FX.black = async function (ms) {
    const host = document.getElementById('phone') || document.body;
    const b = mk('div', 'c2-black');
    b.setAttribute('aria-hidden', 'true');
    host.appendChild(b);
    await sleep(Math.max(0, ms || 0));
    b.classList.add('out');
    setTimeout(() => b.remove(), 650);
  };

  /* ---------- ep1 names ---------- */
  FX.shake = function (ms, px) { FX.edgeShake(px, ms); };
  FX.vignette = function (s) { FX.setVignette(s); };
  ['setTitle', 'blinkTitle', 'stopTitle', 'setFavicon', 'glitch', 'static', 'flash', 'pulse'].forEach((k) => { FX[k] = function () { dwarn(k); }; });
  FX.jumpscare = function () { dwarn('jumpscare'); return Promise.resolve(); };
  FX.cinema = function () {
    dwarn('cinema');
    const api = { node: mk('div'), skipTyping: false, type: () => Promise.resolve(null), clear: () => Promise.resolve(), close: () => Promise.resolve(), waitTap: () => Promise.resolve() };
    return api;
  };
})();
