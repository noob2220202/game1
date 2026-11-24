/* =========================================================
 * Visual FX: glitch, static, shake, flash, vignette pulse, jumpscare,
 * subtitles, fade-to-black, tab title / favicon tricks.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep } = G.util;
  const FX = (G.fx = {});

  let layer, staticCanvas, staticCtx, staticAlpha = 0, staticRAF = null;

  FX.init = function () {
    layer = document.getElementById('fx-layer');
    staticCanvas = el('canvas.fx-static');
    staticCanvas.width = 160; staticCanvas.height = 284;
    staticCtx = staticCanvas.getContext('2d');
    layer.appendChild(staticCanvas);
    layer.appendChild(el('div.fx-vignette'));
    layer.appendChild(el('div.fx-scan'));
    layer.appendChild(el('div.fx-flash'));
    layer.appendChild(el('div.fx-subs'));
    loopStatic();
  };

  function scaresOn() { return G.settings.scares !== 'off'; }
  function scaresLight() { return G.settings.scares === 'light'; }

  /* ---------- TV static ---------- */
  function loopStatic() {
    staticRAF = requestAnimationFrame(loopStatic);
    if (staticAlpha <= 0.001) { if (staticCanvas.style.opacity !== '0') staticCanvas.style.opacity = '0'; return; }
    const w = staticCanvas.width, h = staticCanvas.height;
    const img = staticCtx.createImageData(w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    staticCtx.putImageData(img, 0, 0);
    staticCanvas.style.opacity = String(staticAlpha);
  }
  FX.static = function (alpha, ms) {
    staticAlpha = alpha;
    if (ms) setTimeout(() => { staticAlpha = 0; }, ms);
  };

  /* ---------- glitch (screen tearing + RGB split) ---------- */
  FX.glitch = function (ms, strong) {
    ms = ms || 450;
    const root = document.getElementById('phone');
    if (!root) return;
    root.classList.remove('glitch', 'glitch-strong'); void root.offsetWidth;
    root.classList.add(strong ? 'glitch-strong' : 'glitch');
    FX.static(strong ? 0.35 : 0.18, ms);
    if (G.audio) G.audio.sfx.glitch();
    setTimeout(() => root.classList.remove('glitch', 'glitch-strong'), ms);
  };

  FX.shake = function (ms, px) {
    const root = document.getElementById('stage');
    root.style.setProperty('--shake', (px || 6) + 'px');
    root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
    setTimeout(() => root.classList.remove('shake'), ms || 500);
  };

  FX.flash = function (color, ms) {
    const f = layer.querySelector('.fx-flash');
    f.style.background = color || '#fff';
    f.style.transition = 'none'; f.style.opacity = '0.85';
    requestAnimationFrame(() => { f.style.transition = `opacity ${ms || 600}ms ease-out`; f.style.opacity = '0'; });
  };

  FX.vignette = function (strength) {
    document.documentElement.style.setProperty('--vig', String(strength));
  };
  FX.pulse = function (times) {
    const v = layer.querySelector('.fx-vignette');
    v.classList.remove('pulse'); void v.offsetWidth; v.classList.add('pulse');
    v.style.animationIterationCount = times || 3;
  };

  /* ---------- jumpscare ---------- */
  FX.jumpscare = async function (imgSrc, opts) {
    opts = opts || {};
    if (!scaresOn()) { FX.glitch(300); return; }
    const light = scaresLight();
    const j = el('div.fx-jump', null, el('img', { src: imgSrc, alt: '' }));
    if (light) j.classList.add('light');
    layer.appendChild(j);
    if (G.audio) { if (!light) G.audio.sfx.stinger(); else G.audio.sfx.glitch(); G.audio.sfx.buzz([60, 40, 200]); }
    FX.shake(700, light ? 4 : 14);
    FX.static(0.3, 500);
    await sleep(opts.ms || (light ? 380 : 650));
    j.classList.add('out');
    await sleep(250);
    j.remove();
  };

  /* ---------- subtitles (used for calls / voices) ---------- */
  FX.sub = async function (text, ms, opts) {
    opts = opts || {};
    const box = layer.querySelector('.fx-subs');
    const line = el('div.sub' + (opts.cls ? '.' + opts.cls : ''), null, text);
    box.appendChild(line);
    requestAnimationFrame(() => line.classList.add('in'));
    await sleep(ms || 2600);
    line.classList.remove('in'); line.classList.add('out');
    setTimeout(() => line.remove(), 500);
  };

  /* ---------- full-screen black with typed text (cinematics) ---------- */
  FX.cinema = function () {
    const c = el('div.cinema');
    document.getElementById('stage').appendChild(c);
    requestAnimationFrame(() => c.classList.add('in'));
    const api = {
      node: c,
      async type(text, opts) {
        opts = opts || {};
        const line = el('p.cine-line' + (opts.cls ? '.' + opts.cls : ''));
        c.appendChild(line);
        const speed = opts.speed || 55;
        for (const ch of text) {
          line.textContent += ch;
          if (ch !== ' ' && G.audio && opts.sound !== false) G.audio.sfx.key();
          await sleep(ch === '.' || ch === ',' || ch === '…' ? speed * 5 : speed);
          if (api.skipTyping) { line.textContent = text; break; }
        }
        api.skipTyping = false;
        await sleep(opts.hold || 900);
        return line;
      },
      clear() { c.querySelectorAll('.cine-line').forEach((n) => n.classList.add('fade')); return sleep(700).then(() => c.querySelectorAll('.cine-line').forEach((n) => n.remove())); },
      async close() { c.classList.remove('in'); await sleep(900); c.remove(); },
      waitTap(label) {
        return new Promise((res) => {
          const b = el('button.cine-next', null, label || '계속');
          c.appendChild(b);
          requestAnimationFrame(() => b.classList.add('in'));
          b.addEventListener('click', () => { if (G.audio) G.audio.sfx.tap(); b.remove(); res(); }, { once: true });
        });
      },
    };
    c.addEventListener('click', () => { api.skipTyping = true; });
    return api;
  };

  /* ---------- browser tab title & favicon (meta trick) ---------- */
  const baseTitle = document.title;
  let titleTimer = null;
  FX.setTitle = function (t) { document.title = t || baseTitle; };
  FX.blinkTitle = function (msgs, interval) {
    clearInterval(titleTimer); let i = 0;
    titleTimer = setInterval(() => { document.title = msgs[i++ % msgs.length]; }, interval || 1200);
  };
  FX.stopTitle = function () { clearInterval(titleTimer); document.title = baseTitle; };
  FX.setFavicon = function (emojiOrColor) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64);
      x.font = '48px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emojiOrColor, 32, 36);
      let link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = c.toDataURL();
    } catch (e) {}
  };
})();
