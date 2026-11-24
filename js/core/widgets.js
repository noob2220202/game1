/* =========================================================
 * Reusable widgets: PIN pad, pattern lock, pinch-zoom image viewer,
 * spectrogram renderer, typing indicator, etc.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep, clamp } = G.util;
  const UI = (G.ui = G.ui || {});

  /* ---------------- PIN pad ----------------
   * UI.pinPad({length:4, onSubmit: async(code)=>true|false|'msg', theme:'dark', title, sub, keys:'default'|'phone', onKey})
   * returns node with .reset() */
  UI.pinPad = function (o) {
    const len = o.length || 4;
    let code = '';
    let busy = false;
    const dots = el('div.pin-dots', null, Array.from({ length: len }, () => el('i')));
    const msg = el('div.pin-msg', null, o.sub || '');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', o.leftKey || '', '0', '⌫'];
    const sublabels = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' };
    const pad = el('div.pin-pad', null, keys.map((k) => {
      if (!k) return el('span');
      const b = el('button.pin-key' + (k === '⌫' ? '.del' : ''), { 'aria-label': k === '⌫' ? '지우기' : k },
        el('b', null, k === '⌫' ? '' : k), k !== '⌫' && o.letters !== false && sublabels[k] ? el('small', null, sublabels[k]) : null);
      if (k === '⌫') b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>';
      b.addEventListener('click', () => press(k));
      return b;
    }));
    const node = el('div.pinpad-wrap' + (o.theme === 'light' ? '.light' : ''), null,
      o.title ? el('div.pin-title', null, o.title) : null, dots, msg, pad);
    function render() { dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < code.length)); }
    async function press(k) {
      if (busy) return;
      if (k === '⌫') { code = code.slice(0, -1); G.audio && G.audio.sfx.key(); render(); return; }
      if (code.length >= len) return;
      code += k;
      if (o.dtmf && G.audio) G.audio.sfx.dtmf(k); else G.audio && G.audio.sfx.key();
      o.onKey && o.onKey(k, code);
      render();
      if (code.length === len) {
        busy = true;
        await sleep(160);
        const r = await o.onSubmit(code);
        if (r === true) { node.classList.add('ok'); }
        else {
          node.classList.add('wrong');
          G.audio && G.audio.sfx.error();
          if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate(120); } catch (e) {}
          if (typeof r === 'string') msg.textContent = r;
          await sleep(500);
          node.classList.remove('wrong');
          code = ''; render();
        }
        busy = false;
      }
    }
    node.reset = () => { code = ''; render(); busy = false; node.classList.remove('ok'); };
    node.setMsg = (t) => { msg.textContent = t; };
    node.setBusy = (b) => { busy = b; };
    return node;
  };

  /* ---------------- Pattern lock (3x3) ----------------
   * UI.patternLock({onSubmit: async(seq:number[] 1..9)=>bool, size}) */
  UI.patternLock = function (o) {
    const size = o.size || 270;
    const node = el('div.pattern-wrap', { style: { width: size + 'px', height: size + 'px' } });
    const cv = el('canvas.pattern-canvas'); const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
    node.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const pts = []; const gap = size / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) pts.push({ x: gap * c + gap / 2, y: gap * r + gap / 2 });
    let seq = [], cur = null, active = false, state = 'idle';
    function draw() {
      ctx.clearRect(0, 0, size, size);
      const col = state === 'wrong' ? '#ff453a' : state === 'ok' ? '#30d158' : '#fff';
      if (seq.length) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); seq.forEach((i, k) => { const p = pts[i - 1]; k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        if (cur && active) ctx.lineTo(cur.x, cur.y);
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      pts.forEach((p, i) => {
        const on = seq.includes(i + 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, on ? 10 : 7, 0, Math.PI * 2); ctx.fillStyle = on ? col : 'rgba(255,255,255,.75)'; ctx.fill();
        if (on) { ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2); ctx.fillStyle = state === 'wrong' ? 'rgba(255,69,58,.18)' : 'rgba(255,255,255,.12)'; ctx.fill(); }
      });
    }
    function pos(e) { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * size, y: ((e.clientY - r.top) / r.height) * size }; }
    function hit(p) {
      pts.forEach((q, i) => {
        if (Math.hypot(q.x - p.x, q.y - p.y) < gap * 0.32 && !seq.includes(i + 1)) {
          // auto-include a skipped middle point (like real Android)
          const last = seq[seq.length - 1];
          if (last) { const a = pts[last - 1]; const mid = pts.findIndex((m) => Math.abs(m.x - (a.x + q.x) / 2) < 1 && Math.abs(m.y - (a.y + q.y) / 2) < 1); if (mid >= 0 && !seq.includes(mid + 1)) seq.push(mid + 1); }
          seq.push(i + 1);
          G.audio && G.audio.sfx.key();
          if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate(8); } catch (e) {}
        }
      });
    }
    cv.addEventListener('pointerdown', (e) => { if (state !== 'idle') return; cv.setPointerCapture(e.pointerId); active = true; seq = []; cur = pos(e); hit(cur); draw(); });
    cv.addEventListener('pointermove', (e) => { if (!active) return; cur = pos(e); hit(cur); draw(); });
    const up = async () => {
      if (!active) return; active = false; cur = null;
      if (seq.length < 2) { seq = []; draw(); return; }
      const ok = await o.onSubmit(seq.slice());
      state = ok ? 'ok' : 'wrong'; draw();
      if (!ok) { G.audio && G.audio.sfx.error(); }
      await sleep(ok ? 400 : 700);
      if (!ok) { state = 'idle'; seq = []; draw(); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.style.touchAction = 'none';
    draw();
    return node;
  };

  /* ---------------- Pinch-zoom image viewer ----------------
   * UI.zoomViewer(src, {maxScale:10, onChange({scale, cx, cy}), filter, overlay:node})
   * cx, cy = normalized image coords (0..1) of the viewport center.          */
  UI.zoomViewer = function (src, o) {
    o = o || {};
    const maxS = o.maxScale || 8;
    const box = el('div.zoom-box');
    const inner = el('div.zoom-inner');
    const img = el('img.zoom-img', { src, alt: '', draggable: 'false' });
    inner.appendChild(img);
    if (o.overlay) inner.appendChild(o.overlay);
    box.appendChild(inner);
    let iw = 1, ih = 1, fit = 1, s = 1, x = 0, y = 0, bw = 1, bh = 1;
    const pointers = new Map();
    let start = null, lastTap = 0;
    function layout() {
      const r = box.getBoundingClientRect(); bw = r.width; bh = r.height;
      iw = img.naturalWidth || 1; ih = img.naturalHeight || 1;
      fit = Math.min(bw / iw, bh / ih);
      inner.style.width = iw + 'px'; inner.style.height = ih + 'px';
      if (s === 1) { x = (bw - iw * fit) / 2; y = (bh - ih * fit) / 2; }
      apply();
    }
    function bound() {
      const W = iw * fit * s, H = ih * fit * s;
      x = W <= bw ? (bw - W) / 2 : clamp(x, bw - W, 0);
      y = H <= bh ? (bh - H) / 2 : clamp(y, bh - H, 0);
    }
    function apply(anim) {
      bound();
      inner.style.transition = anim ? 'transform .28s cubic-bezier(.2,.9,.3,1)' : 'none';
      inner.style.transform = `translate(${x}px,${y}px) scale(${fit * s})`;
      const cx = (bw / 2 - x) / (iw * fit * s), cy = (bh / 2 - y) / (ih * fit * s);
      box.dataset.zoom = s.toFixed(2);
      o.onChange && o.onChange({ scale: s, cx, cy });
    }
    function zoomAt(px, py, ns, anim) {
      ns = clamp(ns, 1, maxS);
      const k = ns / s;
      x = px - (px - x) * k; y = py - (py - y) * k; s = ns;
      apply(anim);
    }
    img.addEventListener('load', layout);
    if (img.complete) setTimeout(layout, 0);
    new ResizeObserver(layout).observe(box);
    box.style.touchAction = 'none';
    box.addEventListener('pointerdown', (e) => {
      box.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = snapshot();
      const now = Date.now();
      if (pointers.size === 1 && now - lastTap < 280) {
        const r = box.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, s > 1.5 ? 1 : 3, true);
        lastTap = 0;
      } else lastTap = now;
    });
    function snapshot() {
      const ps = Array.from(pointers.values());
      const r = box.getBoundingClientRect();
      if (ps.length >= 2) return { s, x, y, d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), mx: (ps[0].x + ps[1].x) / 2 - r.left, my: (ps[0].y + ps[1].y) / 2 - r.top };
      if (ps.length === 1) return { s, x, y, px: ps[0].x, py: ps[0].y };
      return null;
    }
    box.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = Array.from(pointers.values());
      const r = box.getBoundingClientRect();
      if (ps.length >= 2 && start && start.d) {
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        const mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        const ns = clamp(start.s * (d / start.d), 1, maxS);
        const k = ns / start.s;
        s = ns; x = mx - (start.mx - start.x) * k; y = my - (start.my - start.y) * k;
        apply();
      } else if (ps.length === 1 && start && start.px != null) {
        x = start.x + (ps[0].x - start.px); y = start.y + (ps[0].y - start.py);
        apply();
      }
    });
    const end = (e) => { pointers.delete(e.pointerId); start = snapshot(); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    box.addEventListener('wheel', (e) => { e.preventDefault(); const r = box.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    box.zoomTo = (nx, ny, ns) => { s = clamp(ns, 1, maxS); x = bw / 2 - nx * iw * fit * s; y = bh / 2 - ny * ih * fit * s; apply(true); };
    box.reset = () => { s = 1; layout(); };
    box.img = img;
    box.setFilter = (f) => { img.style.filter = f; };
    return box;
  };

  /* ---------------- Spectrogram renderer ----------------
   * UI.spectrogram(canvas, analyser, {maxHz, scroll:true}) -> {stop()}
   * Draws a scrolling spectrogram (time left->right, freq bottom->top).          */
  UI.spectrogram = function (canvas, analyser, o) {
    o = o || {};
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    const sr = (G.audio.ctx && G.audio.ctx.sampleRate) || 44100;
    const maxHz = o.maxHz || 8000;
    const maxBin = Math.min(bins, Math.floor((maxHz / (sr / 2)) * bins));
    const colW = o.colW || 2;
    let raf = 0, stopped = false, last = 0;
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
    function color(v) {
      // black -> deep blue -> magenta -> orange -> white
      const t = v / 255;
      const r = clamp(Math.round(255 * Math.min(1, t * 2.2 - 0.4)), 0, 255);
      const g = clamp(Math.round(255 * Math.max(0, t * 2 - 1.05)), 0, 255);
      const b = clamp(Math.round(255 * (t < 0.5 ? t * 1.8 : 1.6 - t * 1.4)), 0, 255);
      return `rgb(${r},${g},${b})`;
    }
    function frame(ts) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (ts - last < (o.interval || 22)) return; last = ts;
      analyser.getByteFrequencyData(data);
      // scroll left
      ctx.drawImage(canvas, colW, 0, W - colW, H, 0, 0, W - colW, H);
      for (let yy = 0; yy < H; yy++) {
        const bin = Math.floor((1 - yy / H) * maxBin);
        const v = data[bin];
        ctx.fillStyle = color(v);
        ctx.fillRect(W - colW, yy, colW, 1);
      }
    }
    raf = requestAnimationFrame(frame);
    return { stop() { stopped = true; cancelAnimationFrame(raf); } };
  };
  /* simple waveform renderer */
  UI.waveform = function (canvas, analyser, color) {
    const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0, stopped = false;
    function frame() {
      if (stopped) return; raf = requestAnimationFrame(frame);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, W, H); ctx.strokeStyle = color || '#ff453a'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < W; i++) { const v = data[Math.floor((i / W) * data.length)] / 128 - 1; const yy = H / 2 + v * H * 0.9; i ? ctx.lineTo(i, yy) : ctx.moveTo(i, yy); }
      ctx.stroke();
    }
    frame();
    return { stop() { stopped = true; cancelAnimationFrame(raf); } };
  };

  /* typing indicator bubble */
  UI.typing = function () { return el('div.typing', null, el('i'), el('i'), el('i')); };

  /* long-press helper */
  UI.onLongPress = function (node, fn, ms) {
    let t = null;
    const start = () => { t = setTimeout(() => { t = null; fn(); }, ms || 550); };
    const cancel = () => { if (t) clearTimeout(t); t = null; };
    node.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach((ev) => node.addEventListener(ev, ev === 'pointermove' ? (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel(); } : cancel));
    node.addEventListener('contextmenu', (e) => e.preventDefault());
  };
})();
