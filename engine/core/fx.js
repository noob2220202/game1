/* =========================================================
 * engine/core/fx.js — screen FX for episode 2 (core · ARCH_EP2 §4.23, §2.3 layer #fx-layer z 300 / .c2-black z 460)
 *
 * G.fx.init()
 * G.fx.sub(text, ms=3200, {az, cls}) → Promise   bottom sound-subtitle channel (G.audio.sub decides when/what)
 * G.fx.mono(text, ms=3200) → Promise             monologue channel (separate layer, no sound, no toast) — G.e2.mono, recap
 * G.fx.dirArc(az, ms=1200)                       speaker-mode edge arc ◀ ▶ ▲ ▼ relative to G.audio.getYaw()
 * G.fx.edgeShake(px=3, ms=300)                   no-op with G.settings.reduceShake or G.e2.less()
 * G.fx.setVignette(v)                            sets --vig on #screen (+ #phone so #fx-layer inherits)
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
  };
  const ready = () => { if (!layer || !layer.isConnected) FX.init(); };

  /* ---------- sound subtitles ---------- */
  FX.sub = async function (text, ms, opts) {
    opts = opts || {};
    ready();
    const line = mk('div', 'c2-sub' + (opts.cls ? ' ' + opts.cls : ''), T(String(text == null ? '' : text)));
    if (opts.az != null) line.dataset.az = String(Math.round(opts.az));
    subsBox.appendChild(line);
    while (subsBox.children.length > 3) subsBox.removeChild(subsBox.firstChild);
    requestAnimationFrame(() => line.classList.add('in'));
    await sleep(ms || 3200);
    line.classList.remove('in'); line.classList.add('out');
    await sleep(450);
    line.remove();
  };

  /* ---------- monologue (one line at a time) ---------- */
  let monoChain = Promise.resolve();
  FX.mono = function (text, ms) {
    ready();
    const run = async () => {
      const line = mk('div', 'c2-mono-line', T(String(text == null ? '' : text)));
      monoBox.appendChild(line);
      requestAnimationFrame(() => requestAnimationFrame(() => line.classList.add('in')));
      await sleep(ms || 3200);
      line.classList.remove('in'); line.classList.add('out');
      await sleep(700);
      line.remove();
    };
    const p = monoChain.then(run, run);
    monoChain = p.catch(() => {});
    return p;
  };

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
  };

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
