/* =========================================================
 * Room view — room 404 seen through 세아's phone camera (design §5 카메라, §6.3, §7.1).
 * 4 directions (door 0°, bed 90°, window 180°, wardrobe 270°), drag / arrows look-around
 * (no hardware sensors — client override in ARCH.md), 1×/2×/8× zoom pill + pinch, flashlight cone, state layers (evaluated only in
 * setView()), hotspots -> close-ups, door sticker QR chip, wardrobe knock-back, night mode.
 *
 * G.room.open({mode:'camera'|'lockscreen', view:index|id, onClose, onFlip}) -> api
 * G.room.isOpen(), G.room.current(), G.room.setRingGlow(0..1), G.room.dirSub(text, az, ms)
 * api: {root, view, zoom, flash, setView(i|id), refresh(), zoomTo(z, cx, cy), caption(text, ms),
 *       closeup({title, src|node, text, onOpen, onClose}), close(), layer(id), glint(ms),
 *       spotEl(id), setFlash(on)}
 * Hooks provided: 'room:refreshLayers'. Bus: 'room:open', 'room:view'(id), 'room:spot'(id),
 *       'room:close', 'room:photo', 'room:flash', 'room:zoom'(z), 'room:knock'(n)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep, clamp } = G.util;
  const R = (G.room = {});

  let cur = null;
  let ringGlow = 0;

  R.isOpen = () => !!cur;
  R.current = () => cur;
  R.setRingGlow = function (v) { ringGlow = v || 0; if (cur) cur._ringGlow(ringGlow); };
  /** flash is disabled by 절전 모드 between M7 and M8 unless the climax grants it */
  R.flashGrant = false;
  /** draw a DOM sticker when room_door.jpg has none baked in (it does now) */
  R.cssSticker = false;
  R.flashAllowed = () => !(G.flag('M7') && !G.flag('M8')) || R.flashGrant;

  function sfx(name) { const A = G.audio; const f = A && A.sfx && A.sfx[name]; if (!f) return undefined; try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { return undefined; } }
  function IMG(k) { return G.ROOM.img(k); }
  function T(s) { return G.T ? G.T(s) : s; }
  function speakerMode() { return (G.settings && G.settings.audioMode === 'speaker') || (G.state && G.state.vars.audioMode === 'speaker') || (G.settings && G.settings.sound === false); }
  function relAz(az) { const y = (G.audio && G.audio.getYaw) ? G.audio.getYaw() : 0; return ((((az - y) % 360) + 540) % 360) - 180; }
  /** subtitle with a direction arrow (speaker / muted mode) */
  R.dirSub = function (text, az, ms) {
    let t = text;
    if (az != null && speakerMode()) { const r = relAz(az); const arrow = Math.abs(r) > 135 ? '▼' : Math.abs(r) < 25 ? '▲' : r < 0 ? '◀' : '▶'; t = r < 0 || Math.abs(r) > 135 ? arrow + ' ' + text : text + ' ' + arrow; }
    G.fx && G.fx.sub(t, ms || 2600, { cls: 'dir' });
  };

  const QR_SVG = (function () {
    // decorative QR-like pattern (the real QR lives in G.IMG.door_sticker)
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" shape-rendering="crispEdges"><rect width="25" height="25" fill="#fff"/>';
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#111"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#111"/>`;
    s += finder(0, 0) + finder(18, 0) + finder(0, 18);
    let seed = 404;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
      if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue;
      if (rnd() < 0.47) s += `<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`;
    }
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(s + '</svg>');
  })();

  function viewIndex(v) {
    const V = G.ROOM.views;
    if (typeof v === 'string') { const i = V.findIndex((x) => x.id === v); return i < 0 ? 0 : i; }
    return ((Math.round(+v || 0) % V.length) + V.length) % V.length;
  }

  R.open = function (opts) {
    opts = opts || {};
    if (cur) { if (opts.view != null) cur.setView(opts.view); return cur; }
    const data = G.ROOM;
    const V = data.views;
    const vars = G.state.vars;
    let vi = viewIndex(opts.view != null ? opts.view : vars.roomView || 0);
    let flash = !!vars.flash && R.flashAllowed();
    let z = 1, cx = 0.5, cy = 0.5, tx = 0, ty = 0;
    let W = 1, H = 1, sw = 1, sh = 1;
    let applied = {};
    let light = { x: 0.5, y: 0.52 };
    let closed = false;
    const lit = () => G.flag('M8');

    /* ---------- DOM ---------- */
    const root = el('div.room.rv' + (opts.mode === 'lockscreen' ? '.from-lock' : ''));
    const stageEl = el('div.room-stage.rv-stage');
    const baseImg = el('img.rv-img', { alt: '', draggable: 'false' });
    const litImg = el('img.rv-img', { alt: '', draggable: 'false' });
    const darkLayers = el('div.rv-layers');
    const litLayers = el('div.rv-layers');
    const darkG = el('div.rv-dark', null, baseImg, darkLayers);
    const litG = el('div.rv-lit', null, litImg, litLayers);
    const glowG = el('div.rv-glow');
    const marks = el('div.rv-marks');
    const spots = el('div.room-spots.rv-spots');
    const frame = el('div.rv-frame', null, darkG, litG, glowG, marks, spots);
    const turnWrap = el('div.rv-turn', null, frame);
    stageEl.appendChild(turnWrap);

    const label = el('div.room-label.rv-label');
    const hint = el('div.room-hint.rv-hint', null, '드래그해서 둘러보기 · 두 손가락으로 확대 · 플래시로 비추기');
    const flashBtn = el('button.cam-flash.rv-flash', { 'aria-label': '플래시', html: ICON.flash });
    const closeBtn = el('button.cam-close', { 'aria-label': '닫기', html: ICON.close });
    const leftBtn = el('button.room-turn.rv-turnbtn.left', { 'aria-label': '왼쪽으로', html: ICON.left });
    const rightBtn = el('button.room-turn.rv-turnbtn.right', { 'aria-label': '오른쪽으로', html: ICON.right });
    const shutter = el('button.cam-shutter.rv-shutter', { 'aria-label': '촬영' }, el('i'), el('span.rv-moon', { html: ICON.moon }));
    const thumb = el('button.cam-thumb', { 'aria-label': '갤러리' });
    const flip = el('button.cam-flip', { 'aria-label': '카메라 전환', html: ICON.flip });
    const dirs = el('div.room-dirs.rv-dirs', null, V.map((v, i) => el('i', { dataset: { i } })));
    const zoomPill = el('div.rv-zoom', null, [1, 2, 8].map((p) => el('button', { dataset: { z: p } }, p + '×')));
    const modes = el('div.cam-modes', null, el('span', null, '야간'), el('span', null, '동영상'), el('b', null, '사진'), el('span', null, '인물'), el('span', null, '파노라마'));
    const bottom = el('div.cam-bottom.rv-bottom', null, zoomPill, modes, el('div.cam-row', null, thumb, shutter, flip));
    const top = el('div.cam-top.rv-top', null, closeBtn, el('div.cam-top-mid', null, label), el('div.rv-topr', null, flashBtn));
    const nightChip = el('button.rv-chip.rv-night', { html: ICON.moon + '<span>야간 모드 3초</span>' });
    const qrChip = el('button.rv-chip.rv-qr', { html: ICON.link + '<span>haesolvil.kr/as?unit=404</span>' });
    const knockBtn = el('button.rv-knock', { 'aria-label': '노크하기', html: ICON.knuckle + '<span>노크하기</span>' });
    const captionEl = el('div.rv-caption');
    root.append(stageEl, el('div.room-grain'), el('div.rv-vig'), el('div.cam-grid'), top, leftBtn, rightBtn, dirs, nightChip, qrChip, knockBtn, captionEl, hint, bottom);
    if (opts.mode === 'lockscreen') root.appendChild(el('div.room-locknote', null, '🔒 잠금 상태 — 카메라만 사용 가능'));

    const ov = G.phone.overlay(root, { onBack: () => close() });
    G.phone.statusTheme('light');
    sfx('camOn');

    /* ---------- geometry ---------- */
    function measure() {
      const r = stageEl.getBoundingClientRect();
      sw = Math.max(1, r.width); sh = Math.max(1, r.height);
      const v = V[vi]; const iw = v.w || 1024, ih = v.h || 1536;
      const sc = Math.max(sw / iw, sh / ih);
      W = iw * sc; H = ih * sc;
    }
    const PAD_B = 210; // px hidden behind the shutter row / zoom pill
    function hx1() { return Math.min(0.5, sw / (2 * W)); }
    function panX() { const h = hx1(); return h >= 0.5 ? 0.5 : clamp((cx - h) / (1 - 2 * h), 0, 1); }
    function fromPanX(p) { const h = hx1(); return h + clamp(p, 0, 1) * (1 - 2 * h); }
    function layout() {
      if (closed) return;
      measure();
      frame.style.width = W + 'px'; frame.style.height = H + 'px';
      frame.style.setProperty('--fw', W + 'px');
      frame.style.setProperty('--iz', String(1 / z));
      // horizontal: cover; vertical: may tilt down so the bottom of the image clears the camera controls
      tx = clamp(sw / 2 - cx * W * z, Math.min(0, sw - W * z), Math.max(0, (sw - W * z) / 2));
      if (W * z < sw) tx = (sw - W * z) / 2;
      ty = clamp(sh / 2 - cy * H * z, Math.min(0, sh - PAD_B - H * z), 0);
      cx = (sw / 2 - tx) / (W * z); cy = (sh / 2 - ty) / (H * z);
      frame.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
      applyLight();
      updatePill();
      scheduleChips();
      const yaw = vi * 90 + (panX() - 0.5) * 50;
      if (G.audio && G.audio.setYaw) G.audio.setYaw(((yaw % 360) + 360) % 360);
    }
    function applyLight() {
      const px = light.x * sw, py = light.y * sh;
      const rad = Math.max(sw, sh) * 0.36;
      const lx = (px - tx) / z, ly = (py - ty) / z, lr = rad / z;
      const m = `radial-gradient(circle ${lr}px at ${lx}px ${ly}px, #000 0%, rgba(0,0,0,.92) 35%, rgba(0,0,0,.35) 70%, transparent 100%)`;
      litG.style.webkitMaskImage = m; litG.style.maskImage = m;
      root.classList.toggle('flash-on', flash && !lit());
    }
    function screenPos(p) { return { x: tx + p.x * W * z, y: ty + p.y * H * z }; }
    function inCenter(p, frac) { const s = screenPos(p); return Math.abs(s.x - sw / 2) <= (frac * sw) / 2 && Math.abs(s.y - sh / 2) <= (frac * sh) / 2; }

    /* ---------- view + layers ---------- */
    function setImg(img, src, fallback) {
      img.onerror = fallback ? () => { img.onerror = null; img.src = fallback; } : null;
      if (img.getAttribute('src') !== src) img.src = src;
    }
    function layerImg(key, box, v, cls) {
      if (!G.ROOM.has(key)) return null;
      const i = el('img.rv-layer' + (cls ? '.' + cls : ''), { alt: '', draggable: 'false' });
      place(i, box);
      i.onload = () => { if (i.naturalWidth === v.w && i.naturalHeight === v.h) place(i, { x: 0, y: 0, w: 1, h: 1 }); i.classList.add('ok'); };
      i.onerror = () => i.remove();
      i.src = IMG(key);
      return i;
    }
    function place(n, b) { Object.assign(n.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }); }
    function sticker(box) {
      const s = el('div.rv-sticker');
      place(s, box);
      const im = el('img', { alt: '', draggable: 'false' });
      im.onload = () => s.classList.add('img');
      im.onerror = () => { im.remove(); if (!R.cssSticker) s.remove(); };
      if (G.ROOM.has('door_sticker')) im.src = IMG('door_sticker');
      if (R.cssSticker) s.append(el('div.stk-fb', null,
        el('div.stk-l', null, el('b', null, '해솔빌 관리사무소'), el('span.stk-tel', null, '☎ 02-338-5120'), el('span', null, '평일 09:00–18:00'), el('span.stk-qrlbl', null, '시설 고장신고 QR ▶')),
        el('div.stk-qr', { style: { backgroundImage: `url("${QR_SVG}")` } })));
      else s.classList.add('bare');
      s.append(im);
      return s;
    }
    function renderLayers(v) {
      darkLayers.innerHTML = ''; litLayers.innerHTML = ''; glowG.innerHTML = ''; marks.innerHTML = '';
      applied = {};
      const st = (vars.roomLayers = vars.roomLayers || {});
      const rec = (st[v.id] = {});
      const isLit = lit();
      if (!(isLit && v.litKey)) {
        (v.layers || []).forEach((L) => {
          let k = null;
          try { k = L.pick ? L.pick() : null; } catch (e) { k = null; }
          if (!k) return;
          if (L.kind !== 'glint' && !G.ROOM.has(k) && !(L.kind === 'sticker' && R.cssSticker)) return; // asset not available: layer not shown
          applied[L.id] = k; rec[L.id] = k;
          if (L.kind === 'glint') { const gl = el('i.rv-glint'); gl.style.left = L.at.x * 100 + '%'; gl.style.top = L.at.y * 100 + '%'; glowG.appendChild(gl); return; }
          const box = G.ROOM.boxOf(k, L.box);
          if (L.kind === 'sticker') { if (G.ROOM.has(k) || R.cssSticker) { darkLayers.appendChild(sticker(box)); litLayers.appendChild(sticker(box)); } return; }
          const a = L.litOnly ? null : layerImg(k, box, v), b = layerImg(k, box, v, L.kind === 'fingers' ? 'fingers' : '');
          if (a) darkLayers.appendChild(a);
          if (b) litLayers.appendChild(b);
        });
      }
      // light-emitting things (not darkened by the room filter)
      (v.glows || []).forEach((g) => {
        if (isLit) return;
        if (g.kind === 'led') { const d = el('i.rv-led'); d.style.left = g.at.x * 100 + '%'; d.style.top = g.at.y * 100 + '%'; glowG.appendChild(d); }
        if (g.kind === 'ring') { const d = el('i.rv-ringglow'); place(d, g.box); glowG.appendChild(d); ringEl = d; d.style.setProperty('--rg', String(ringGlow)); d.classList.toggle('on', ringGlow > 0); }
      });
      if (v.id === 'door' && !isLit) { qrBr = el('div.rv-qrbr', null, el('i'), el('i'), el('i'), el('i')); place(qrBr, G.ROOM.boxOf('door_sticker', G.ROOM.B.sticker)); marks.appendChild(qrBr); } else qrBr = null;
      G.save();
    }
    let ringEl = null, qrBr = null;
    function renderSpots(v) {
      spots.innerHTML = '';
      const list = lit() && v.litHotspots ? v.litHotspots : (v.hotspots || []);
      list.forEach((h) => {
        let ok = true;
        try { ok = !h.when || h.when(); } catch (e) { ok = false; }
        if (!ok) return;
        const s = el('button.room-spot.rv-spot', { 'aria-label': h.label || '', dataset: { id: h.id }, style: { left: h.x * 100 + '%', top: h.y * 100 + '%', width: h.w * 100 + '%', height: h.h * 100 + '%' } });
        s.addEventListener('click', (e) => { e.stopPropagation(); if (drag && drag.moved) return; tapSpot(h); });
        spots.appendChild(s);
      });
    }
    function setView(i, dir, o) {
      o = o || {};
      const prev = vi;
      vi = viewIndex(i);
      vars.roomView = vi;
      const v = V[vi];
      const isLit = lit();
      root.classList.toggle('lit-room', isLit);
      const key = isLit && v.litKey ? v.litKey : v.key;
      setImg(baseImg, IMG(key), isLit && v.litKey ? IMG(v.key) : null);
      setImg(litImg, IMG(key), isLit && v.litKey ? IMG(v.key) : null);
      label.textContent = v.name;
      dirs.querySelectorAll('i').forEach((n, k) => n.classList.toggle('on', k === vi));
      renderLayers(v);
      renderSpots(v);
      measure();
      if (!o.keepZoom) { z = 1; cy = 0.5; }
      cx = o.panX != null ? fromPanX(o.panX) : 0.5;
      if (dir) {
        turnWrap.classList.remove('turn-l', 'turn-r'); void turnWrap.offsetWidth; turnWrap.classList.add(dir > 0 ? 'turn-r' : 'turn-l');
        if (!o.silent) sfx('whoosh');
      }
      layout();
      if (prev !== vi || !o.quiet) G.bus.emit('room:view', v.id);
      try { v.onEnter && v.onEnter(api); } catch (e) { console.error(e); }
      hideCaption();
    }
    async function tapSpot(h) {
      if (G.climax && G.climax.spot && G.climax.spot(h.id, api) === true) return;
      if (h.minZoom && z < h.minZoom) { api.caption('너무 멀다. 확대해 보자.'); return; }
      if (h.needLight !== false && !flash && !lit()) {
        sfx('tap');
        api.caption(R.flashAllowed() ? '너무 어두워서 잘 안 보인다. 플래시를 켜자.' : '너무 어둡다. …플래시를 쓸 수 없다.');
        if (R.flashAllowed()) { flashBtn.classList.remove('nudge'); void flashBtn.offsetWidth; flashBtn.classList.add('nudge'); }
        G.bus.emit('room:dark-tap', h.id);
        return;
      }
      sfx('tap');
      G.bus.emit('room:spot', h.id);
      try { if (h.tap) h.tap(api); } catch (e) { console.error('[room] spot', h.id, e); }
    }

    /* ---------- zoom ---------- */
    let zAnim = 0;
    function zoomTo(nz, fx, fy, instant) {
      nz = clamp(nz, 1, 8);
      cancelAnimationFrame(zAnim);
      const z0 = z, cx0 = cx, cy0 = cy, cx1 = fx != null ? fx : cx, cy1 = fy != null ? fy : cy;
      if (instant) { z = nz; cx = cx1; cy = cy1; layout(); G.bus.emit('room:zoom', z); return; }
      const t0 = performance.now(), dur = 300;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        z = z0 + (nz - z0) * e; cx = cx0 + (cx1 - cx0) * e; cy = cy0 + (cy1 - cy0) * e;
        layout();
        if (k < 1) zAnim = requestAnimationFrame(step); else G.bus.emit('room:zoom', z);
      };
      zAnim = requestAnimationFrame(step);
    }
    function updatePill() {
      const ps = [1, 2, 8];
      zoomPill.querySelectorAll('button').forEach((b, i) => {
        const p = ps[i], nxt = ps[i + 1];
        const on = z >= p - 0.02 && (nxt == null || z < nxt - 0.02);
        b.classList.toggle('on', on);
        b.textContent = on && Math.abs(z - p) > 0.05 ? z.toFixed(1) + '×' : p + '×';
      });
    }
    zoomPill.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      sfx('tap'); zoomTo(+b.dataset.z);
    });

    /* ---------- input: drag / pinch / wheel ---------- */
    let drag = null;
    const ptrs = new Map();
    stageEl.style.touchAction = 'none';
    stageEl.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = stageEl.getBoundingClientRect();
      if (ptrs.size === 1) {
        drag = { x: e.clientX, y: e.clientY, cx, cy, t: Date.now(), moved: false, id: e.pointerId };
        light = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
        applyLight();
      } else if (ptrs.size === 2) {
        const ps = [...ptrs.values()];
        const mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, z0: z, ix: (mx - tx) / (W * z), iy: (my - ty) / (H * z) };
        if (drag) drag.moved = true;
        try { stageEl.setPointerCapture(e.pointerId); } catch (er) {}
      }
    });
    let pinch = null;
    stageEl.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = stageEl.getBoundingClientRect();
      if (ptrs.size >= 2 && pinch) {
        const ps = [...ptrs.values()];
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        const mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        z = clamp(pinch.z0 * (d / pinch.d), 1, 8);
        cx = (sw / 2 - (mx - pinch.ix * W * z)) / (W * z);
        cy = (sh / 2 - (my - pinch.iy * H * z)) / (H * z);
        layout();
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; try { stageEl.setPointerCapture(e.pointerId); } catch (er) {} }
      light = { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
      if (drag.moved) {
        cx = drag.cx - dx / (W * z); cy = drag.cy - dy / (H * z);
        layout();
      } else applyLight();
    });
    const endPtr = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x, dt = Date.now() - drag.t;
        if (drag.moved && z <= 1.05 && Math.abs(dx) > 80 && dt < 380 && ((dx > 0 && panX() <= 0.02) || (dx < 0 && panX() >= 0.98))) turn(dx > 0 ? -1 : 1);
        const d = drag; setTimeout(() => { if (drag === d) drag = null; }, 0);
      }
      if (ptrs.size === 1) { const [id, p] = [...ptrs.entries()][0]; drag = { x: p.x, y: p.y, cx, cy, t: Date.now(), moved: true, id }; }
      if (G.bus) G.bus.emit('room:zoom', z);
    };
    stageEl.addEventListener('pointerup', endPtr); stageEl.addEventListener('pointercancel', endPtr);
    stageEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = stageEl.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      const ix = (mx - tx) / (W * z), iy = (my - ty) / (H * z);
      z = clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 8);
      cx = (sw / 2 - (mx - ix * W * z)) / (W * z); cy = (sh / 2 - (my - iy * H * z)) / (H * z);
      layout();
    }, { passive: false });

    function turn(d) {
      setView(vi + d, d);
    }
    leftBtn.addEventListener('click', () => turn(-1));
    rightBtn.addEventListener('click', () => turn(1));
    const onKey = (e) => {
      if (closed || ov.node.nextElementSibling) return; // something is on top of the room
      if (e.key === 'ArrowLeft') { turn(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { turn(1); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') zoomTo(z * 2);
      else if (e.key === '-') zoomTo(z / 2);
    };
    window.addEventListener('keydown', onKey);

    /* ---------- flash ---------- */
    function setFlash(on, silent) {
      if (on && !R.flashAllowed()) { api.caption('배터리 부족으로 플래시를 사용할 수 없습니다.'); on = false; }
      flash = !!on; vars.flash = flash; G.save();
      if (!silent) sfx('flashlight', flash);
      flashBtn.classList.toggle('on', flash);
      flashBtn.classList.remove('nudge');
      applyLight();
      if (flash) G.flag('usedFlash', true);
      G.bus.emit('room:flash', flash);
    }
    flashBtn.addEventListener('click', () => setFlash(!flash));
    flashBtn.classList.toggle('on', flash);

    /* ---------- chips: QR / night mode / knock ---------- */
    let chipRaf = 0, qrSince = 0, qrTimer = 0;
    function scheduleChips() { if (!chipRaf) chipRaf = requestAnimationFrame(updateChips); }
    function climaxOn() { return !!(G.climax && G.climax.running); }
    function updateChips() {
      chipRaf = 0;
      if (closed) return;
      const v = V[vi], isLit = lit();
      const B = G.ROOM.B;
      // door sticker QR: >=2x, QR in the central 60% for 400 ms
      const sb = G.ROOM.boxOf('door_sticker', B.sticker);
      const qrOk = v.id === 'door' && !isLit && z >= 1.95 && inCenter({ x: sb.x + sb.w * 0.8, y: sb.y + sb.h / 2 }, 0.6) && !climaxOn();
      if (qrOk) {
        if (!qrSince) { qrSince = performance.now(); clearTimeout(qrTimer); qrTimer = setTimeout(scheduleChips, 430); }
        if (performance.now() - qrSince >= 400 && !qrChip.classList.contains('show')) { qrChip.classList.add('show'); if (qrBr) qrBr.classList.add('show'); sfx('tap'); G.bus.emit('room:qr'); }
      } else { qrSince = 0; qrChip.classList.remove('show'); if (qrBr) qrBr.classList.remove('show'); }
      // wardrobe gap night mode (H3 alt)
      const nOk = v.id === 'wardrobe' && !isLit && z >= 1.95 && !G.flag('frag06') && inCenter(B.gapCenter, 0.5) && !climaxOn();
      nightChip.classList.toggle('show', nOk);
      if (!nOk && night.armed && !night.busy) setNight(false);
      // knock-back
      knockBtn.classList.toggle('show', v.id === 'wardrobe' && !isLit && G.flag('M1') && !climaxOn());
      root.classList.toggle('zoomed', z > 1.05);
    }
    qrChip.addEventListener('click', () => {
      sfx('tap');
      G.flag('qrScanned', true);
      close();
      setTimeout(() => G.phone.openApp('browser', { page: 'qr404' }), 260);
    });

    /* knock-back (P2): 1–3 taps -> echoed from inside (1.1–1.6 s, muffled);
     * >=4 -> 3 s silence -> ONE knock from directly behind the player; wardrobe never answers again */
    let seq = 0, seqTimer = 0;
    knockBtn.addEventListener('click', () => {
      sfx('knock', 1, { where: 'player' });
      knockBtn.classList.remove('hit'); void knockBtn.offsetWidth; knockBtn.classList.add('hit');
      vars.knockCount = (vars.knockCount || 0) + 1; G.save();
      G.bus.emit('room:knock', vars.knockCount);
      seq++;
      clearTimeout(seqTimer);
      seqTimer = setTimeout(endKnockSeq, 1100 + Math.random() * 500);
    });
    function endKnockSeq() {
      const n = seq; seq = 0;
      if (!n) return;
      if (G.flag('knockSilenced')) return;
      G.flag('knockedBack', true);
      if (n <= 3) {
        sfx('knock', n, { az: 270, where: 'inside', gap: 0.42 });
        R.dirSub(n === 1 ? '(옷장 안에서… 똑.)' : n === 2 ? '(옷장 안에서… 똑, 똑.)' : '(옷장 안에서… 똑, 똑, 똑.)', 270, 2400);
      } else {
        G.flag('knockSilenced', true);
        setTimeout(() => {
          sfx('knock', 1, { where: 'behind' });
          R.dirSub('(…바로 뒤에서. 똑.)', ((G.audio && G.audio.getYaw ? G.audio.getYaw() : 0) + 180) % 360, 2600);
        }, 3000);
      }
    }

    /* night mode 3 s (H3 alt for fragment 06) */
    const night = { armed: false, busy: false };
    function setNight(on) {
      night.armed = !!on;
      nightChip.classList.toggle('on', night.armed);
      shutter.classList.toggle('night', night.armed);
      root.classList.toggle('night-armed', night.armed);
    }
    nightChip.addEventListener('click', () => {
      sfx('tap');
      setNight(!night.armed);
      if (night.armed) api.caption('야간 모드 · 셔터를 3초 동안 꾹 누르고 계세요.', 2600);
    });
    function nightCapture(ev) {
      if (night.busy) return;
      night.busy = true;
      hideCaption();
      const ring = el('div.rv-nring', null,
        el('div.nr-circle', { html: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="bg"/><circle cx="50" cy="50" r="44" class="fg"/></svg>' }, el('b', null, '3')),
        el('div.nr-text', null, '움직이지 마세요'),
        el('div.nr-sub', null, '셔터를 누른 채로'));
      root.appendChild(ring); requestAnimationFrame(() => ring.classList.add('in'));
      const fg = ring.querySelector('.fg'), num = ring.querySelector('b');
      const C = 2 * Math.PI * 44; fg.style.strokeDasharray = C;
      let t0 = performance.now(), resets = 0, done = false, raf = 0;
      const sp = ev ? { x: ev.clientX, y: ev.clientY } : null;
      sfx('breathNear', 3.6, { az: 270, dist: 0.55 });
      G.audio && G.audio.duck && G.audio.duck(0.5, 3.5);
      const reset = (why) => {
        if (resets >= 2) return;
        resets++; t0 = performance.now();
        api.caption(why, 1500);
        ring.classList.remove('shake'); void ring.offsetWidth; ring.classList.add('shake');
      };
      // hold the shutter 3 s; pointer drift > 8 px resets (max 2 resets) — no motion sensor (ARCH override)
      const onUp = () => { if (!done) finish(false); };
      const onMove = (e) => { if (sp && Math.hypot(e.clientX - sp.x, e.clientY - sp.y) > 8) { sp.x = e.clientX; sp.y = e.clientY; reset('흔들렸어요. 다시 3초…'); } };
      shutter.addEventListener('pointerup', onUp); shutter.addEventListener('pointercancel', onUp); shutter.addEventListener('pointermove', onMove);
      const tick = () => {
        if (done) return;
        const k = Math.min(1, (performance.now() - t0) / 3000);
        fg.style.strokeDashoffset = String(C * (1 - k));
        num.textContent = String(Math.max(1, 3 - Math.floor(k * 3)));
        if (k >= 1) { finish(true); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      function finish(ok) {
        done = true; cancelAnimationFrame(raf);
        shutter.removeEventListener('pointerup', onUp); shutter.removeEventListener('pointercancel', onUp); shutter.removeEventListener('pointermove', onMove);
        ring.classList.remove('in'); setTimeout(() => ring.remove(), 300);
        night.busy = false;
        if (!ok) { api.caption('셔터를 3초 동안 누르고 있어 주세요.', 2200); return; }
        sfx('shutter');
        nightResult();
      }
    }
    async function nightResult() {
      setNight(false);
      const proc = el('div.rv-proc', null, el('i'), el('span', null, '처리 중…'));
      root.appendChild(proc); requestAnimationFrame(() => proc.classList.add('in'));
      await sleep(1100);
      proc.remove();
      const src = IMG('gap_night');
      let zv = null;
      const photo = el('div.rv-nightphoto', null,
        el('div.np-fb', null, el('div.np-eye'), el('div.np-card', null, el('small', null, '현관 도어락 관리자 카드'), el('b', null, '● ● ● ● 0 6'))));
      if (G.ROOM.has('gap_night')) { zv = G.ui.zoomViewer(src, { maxScale: 6 }); zv.classList.add('np-zoom'); photo.classList.add('img'); photo.appendChild(zv); }
      photo.appendChild(el('span.np-tag', { html: ICON.moon + ' 야간 모드' }));
      if (zv) setTimeout(() => { try { zv.zoomTo(0.52, 0.48, 2.2); } catch (e) {} }, 1500);
      api.closeup({
        title: '방금 찍은 사진',
        node: photo,
        text: '틈 안쪽, 한참 깊은 곳. 합판 벽에 카드 한 장. 맨 끝 두 자리… <b>0 6</b>.',
        onOpen() {
          G.foundFragment && G.foundFragment('06');
          G.flag('nightShot', true);
          try { G.notebook && G.notebook.note('옷장 틈 안쪽 깊은 곳에 카드. ●●●●06'); } catch (e) {}
          const shots = vars.shots || [];
          shots.unshift({ view: 'wardrobe', src, night: true, t: G.clock.now().getTime() });
          vars.shots = shots.slice(0, 20); G.save();
          thumb.style.backgroundImage = `url("${src}")`;
        },
      });
    }

    /* ---------- shutter / thumb / flip / close ---------- */
    shutter.addEventListener('pointerdown', (e) => {
      if (!night.armed) return;
      e.preventDefault();
      night.suppress = true; // the click that follows this press is not a normal photo
      try { shutter.setPointerCapture(e.pointerId); } catch (er) {}
      nightCapture(e);
    });
    shutter.addEventListener('click', () => {
      if (night.suppress) { night.suppress = false; return; }
      if (night.armed || night.busy) return;
      sfx('shutter');
      G.fx.flash('#fff', 350);
      const v = V[vi];
      G.bus.emit('room:photo', { view: v.id, flash, panX: panX(), zoom: z, layers: Object.assign({}, applied) });
      const key = lit() && v.litKey ? v.litKey : v.key;
      const shots = vars.shots || [];
      shots.unshift({ view: v.id, src: IMG(key), flash, zoom: +z.toFixed(2), t: G.clock.now().getTime() });
      vars.shots = shots.slice(0, 20); G.save();
      thumb.style.backgroundImage = `url("${shots[0].src}")`;
      if (opts.mode === 'lockscreen') api.caption('잠금 상태에서는 사진을 볼 수 없습니다', 1800);
    });
    thumb.addEventListener('click', () => {
      if (opts.mode === 'lockscreen' || G.phone.isLocked()) { api.caption('잠금을 해제해야 볼 수 있습니다', 1800); return; }
      close(); G.phone.openApp('gallery', { album: 'recent' });
    });
    flip.addEventListener('click', () => { G.bus.emit('camera:flip'); if (opts.onFlip) opts.onFlip(); else api.caption('전면 카메라를 사용할 수 없습니다'); });
    closeBtn.addEventListener('click', () => close());
    if ((vars.shots || [])[0]) thumb.style.backgroundImage = `url("${vars.shots[0].src}")`;

    const ro = new ResizeObserver(() => layout()); ro.observe(stageEl);
    function close() {
      if (closed) return;
      closed = true;
      ro.disconnect(); cancelAnimationFrame(zAnim); clearTimeout(qrTimer); clearTimeout(seqTimer);
      window.removeEventListener('keydown', onKey);
      ov.close();
      if (cur === api) cur = null;
      G.bus.emit('room:close');
      opts.onClose && opts.onClose();
    }

    /* ---------- caption ---------- */
    let capTimer = 0;
    function hideCaption() { clearTimeout(capTimer); captionEl.classList.remove('in'); }

    /* ---------- close-up viewer ---------- */
    function closeup(c) {
      const viewer = c.node || (c.src ? G.ui.zoomViewer(c.src, { maxScale: c.maxScale || 6, onChange: c.onZoom }) : el('div'));
      const capt = el('div.cu-caption', null, c.text ? el('p', { html: T(c.text) }) : null);
      const node = el('div.closeup.rv-cu' + (c.cls ? '.' + c.cls : ''), null,
        el('div.cu-top', null, el('button.cu-back', { 'aria-label': '돌아가기', html: ICON.left }), el('div.cu-title', null, c.title || '')),
        el('div.cu-body', null, viewer), capt);
      if (c.filter && viewer.setFilter) viewer.setFilter(c.filter);
      let doneFlag = false;
      const o2 = G.phone.overlay(node, { onBack: () => done() });
      function done() { if (doneFlag) return; doneFlag = true; o2.close(); sfx('back'); c.onClose && c.onClose(); }
      node.querySelector('.cu-back').addEventListener('click', done);
      try { c.onOpen && c.onOpen(node, done); } catch (e) { console.error(e); }
      return { node, close: done, caption: capt };
    }

    const api = {
      root, closeup, close, setFlash,
      setView: (i, o) => setView(i, o && o.dir ? o.dir : 0, o),
      refresh: () => setView(vi, 0, { keepZoom: true, panX: panX(), quiet: true }),
      zoomTo: (nz, fx, fy, instant) => zoomTo(nz, fx, fy, instant),
      get view() { return V[vi]; },
      get viewIndex() { return vi; },
      get zoom() { return z; },
      get flash() { return flash; },
      layer: (id) => applied[id] || null,
      spotEl: (id) => spots.querySelector(`[data-id="${id}"]`),
      say(text, ms) { G.fx.sub(T(text), ms || 2600); },
      caption(text, ms) {
        clearTimeout(capTimer);
        captionEl.textContent = T(text);
        captionEl.classList.remove('in'); void captionEl.offsetWidth; captionEl.classList.add('in');
        capTimer = setTimeout(() => captionEl.classList.remove('in'), ms || Math.max(2600, T(text).length * 120));
      },
      /** catchlight in the wardrobe gap (B04). Only visible if the wardrobe view is showing. */
      glint(ms) {
        if (V[vi].id !== 'wardrobe') return false;
        const g = el('i.rv-glint.flash'); const p = G.ROOM.B.glint; g.style.left = p.x * 100 + '%'; g.style.top = p.y * 100 + '%';
        glowG.appendChild(g); setTimeout(() => g.remove(), ms || 70); return true;
      },
      _ringGlow(v) { if (ringEl) { ringEl.style.setProperty('--rg', String(v)); ringEl.classList.toggle('on', v > 0); } },
      _setLights(on) { root.classList.toggle('lights-on', !!on); },
    };
    cur = api;
    setView(vi);
    const seen = G.state.seen || (G.state.seen = {});
    seen.roomHintN = (seen.roomHintN || 0) + 1;
    if (seen.roomHintN > 2) hint.style.display = 'none';
    else setTimeout(() => hint.classList.add('fade'), 3800);
    G.bus.emit('room:open', { mode: opts.mode || 'camera' });
    // climax resume: room opened while M7..END is pending
    setTimeout(() => { if (cur === api && G.climax && G.climax.onRoomOpen) G.climax.onRoomOpen(api); }, 0);
    return api;
  };

  /* layers are evaluated only in setView(); this hook just re-renders hotspots/chips of the
   * visible view (never its layers — design §6.3 "never change a layer while its view is visible"). */
  G.hooks && G.hooks.set('room:refreshLayers', function (force) {
    if (!cur) return null;
    if (force) cur.refresh();
    else { const id = cur.view.id; const st = G.state.vars.roomLayers || {}; return st[id] || {}; }
    return true;
  });
  /* H5: viewing the sticker's QR page proves 관리실 = him (story-data's page also sets it; this is a
   * deferred safety net so its own note still fires first) */
  G.bus.on('browser:page', (id) => { if (id === 'qr404') setTimeout(() => { if (!G.flag('managerExposed')) G.flag('managerExposed', true); }, 0); });

  /* debug helper: computed layer state for every view (what setView would apply now) */
  R.layerState = function () {
    const out = {};
    G.ROOM.views.forEach((v) => { out[v.id] = {}; (v.layers || []).forEach((L) => { try { const k = L.pick(); if (k) out[v.id][L.id] = k; } catch (e) {} }); });
    return out;
  };

  const ICON = {
    flash: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 13.5a3 3 0 015-2.2M15 12.5a3 3 0 01-5 2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 9.5v2h-2M10 16.5v-2h2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" fill="currentColor"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    knuckle: '<svg viewBox="0 0 24 24"><path d="M7 11V7.5a1.6 1.6 0 013.2 0V6a1.6 1.6 0 013.2 0v.6a1.6 1.6 0 013.2 0v1a1.6 1.6 0 013.1.6v5.3c0 4-2.6 6.5-6.5 6.5h-1.3C8.6 20 6 17.6 6 14.3V12a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10.2 7.5V11M13.4 6.6V11M16.6 7.6V11" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 9.5l1.6.8M2.3 13h1.8M2.8 16.5l1.5-.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  };
  R.ICON = ICON;
})();
