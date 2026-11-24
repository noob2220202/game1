/* =========================================================
 * Room view — the locked room seen through the phone camera.
 * 4 directions, drag to look around, flashlight cone that follows the finger,
 * hotspots -> close-ups. Data comes from G.ROOM (story.js).
 *
 * G.room.open({mode:'camera'|'lockscreen', onClose})
 * G.ROOM = { views:[{id, name, src, litSrc?, hotspots:[{id, x,y,w,h (0..1 in image), needLight, label, tap(ctx)}]}] }
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep, clamp } = G.util;
  const R = (G.room = {});

  let cur = null; // current open instance

  R.isOpen = () => !!cur;
  R.current = () => cur;

  R.open = function (opts) {
    opts = opts || {};
    if (cur) return cur;
    const data = G.ROOM;
    let vi = G.state.vars.roomView || 0;
    let flash = !!G.state.vars.flash;
    let panX = 0.5; // 0..1 horizontal look position within the cropped image
    const root = el('div.room' + (opts.mode === 'lockscreen' ? '.from-lock' : ''));
    const stageEl = el('div.room-stage');
    const baseImg = el('img.room-img.base', { alt: '', draggable: 'false' });
    const litImg = el('img.room-img.lit', { alt: '', draggable: 'false' });
    const spots = el('div.room-spots');
    const frame = el('div.room-frame', null, baseImg, litImg, spots);
    stageEl.appendChild(frame);
    const grain = el('div.room-grain');
    const label = el('div.room-label');
    const hint = el('div.room-hint', null, '드래그해서 둘러보기 · 화면을 길게 누르면 비추는 방향이 바뀝니다');
    const flashBtn = el('button.cam-flash', { 'aria-label': '플래시', html: flashSvg() });
    const closeBtn = el('button.cam-close', { 'aria-label': '닫기', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
    const leftBtn = el('button.room-turn.left', { 'aria-label': '왼쪽으로', html: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    const rightBtn = el('button.room-turn.right', { 'aria-label': '오른쪽으로', html: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    const shutter = el('button.cam-shutter', { 'aria-label': '촬영' }, el('i'));
    const thumb = el('button.cam-thumb', { 'aria-label': '갤러리' });
    const flip = el('button.cam-flip', { 'aria-label': '카메라 전환', html: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 13.5a3 3 0 015-2.2M15 12.5a3 3 0 01-5 2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 9.5v2h-2M10 16.5v-2h2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' });
    const dirs = el('div.room-dirs', null, data.views.map((v, i) => el('i', { dataset: { i } })));
    const modes = el('div.cam-modes', null, el('span', null, '타임랩스'), el('span', null, '동영상'), el('b', null, '사진'), el('span', null, '인물'), el('span', null, '파노라마'));
    const bottom = el('div.cam-bottom', null, modes, el('div.cam-row', null, thumb, shutter, flip));
    const top = el('div.cam-top', null, closeBtn, el('div.cam-top-mid', null, label), flashBtn);
    root.append(stageEl, grain, el('div.cam-grid'), top, leftBtn, rightBtn, dirs, hint, bottom);
    if (opts.mode === 'lockscreen') root.appendChild(el('div.room-locknote', null, '🔒 잠금 상태 — 카메라만 사용 가능'));

    const ov = G.phone.overlay(root, { onBack: () => close() });
    G.phone.statusTheme('light');
    G.audio && G.audio.sfx.camOn();

    let light = { x: 0.5, y: 0.55 };
    function applyLight() {
      const r = stageEl.getBoundingClientRect();
      const px = light.x * r.width, py = light.y * r.height;
      const rad = Math.max(r.width, r.height) * 0.36;
      const mask = `radial-gradient(circle ${rad}px at ${px}px ${py}px, #000 0%, rgba(0,0,0,.92) 35%, rgba(0,0,0,.35) 70%, transparent 100%)`;
      litImg.style.webkitMaskImage = mask; litImg.style.maskImage = mask;
      // mask is relative to the image box; convert
      const fr = frame.getBoundingClientRect();
      const ix = px - (fr.left - r.left), iy = py - (fr.top - r.top);
      const m2 = `radial-gradient(circle ${rad}px at ${ix}px ${iy}px, #000 0%, rgba(0,0,0,.92) 35%, rgba(0,0,0,.35) 70%, transparent 100%)`;
      litImg.style.webkitMaskImage = m2; litImg.style.maskImage = m2;
      root.classList.toggle('flash-on', flash);
    }
    function layout() {
      const v = data.views[vi];
      const r = stageEl.getBoundingClientRect();
      const iw = v.w || 1024, ih = v.h || 1536;
      const sc = Math.max(r.width / iw, r.height / ih);
      const W = iw * sc, H = ih * sc;
      frame.style.width = W + 'px'; frame.style.height = H + 'px';
      const maxPan = Math.max(0, W - r.width);
      frame.style.transform = `translate(${-maxPan * panX}px, ${(r.height - H) / 2}px)`;
      applyLight();
    }
    function setView(i, dir) {
      vi = (i + data.views.length) % data.views.length;
      G.state.vars.roomView = vi; G.save();
      const v = data.views[vi];
      const src = typeof v.src === 'function' ? v.src() : v.src;
      const lit = typeof v.litSrc === 'function' ? v.litSrc() : (v.litSrc || src);
      baseImg.src = src; litImg.src = lit;
      label.textContent = v.name;
      dirs.querySelectorAll('i').forEach((n, k) => n.classList.toggle('on', k === vi));
      panX = 0.5;
      spots.innerHTML = '';
      (v.hotspots || []).forEach((h) => {
        if (h.when && !h.when()) return;
        const s = el('button.room-spot', { 'aria-label': h.label || '', style: { left: h.x * 100 + '%', top: h.y * 100 + '%', width: h.w * 100 + '%', height: h.h * 100 + '%' } });
        s.addEventListener('click', (e) => { e.stopPropagation(); tapSpot(h); });
        spots.appendChild(s);
      });
      if (dir) { frame.classList.remove('turn-l', 'turn-r'); void frame.offsetWidth; frame.classList.add(dir > 0 ? 'turn-r' : 'turn-l'); G.audio && G.audio.sfx.whoosh(); }
      layout();
      G.bus.emit('room:view', v.id);
      v.onEnter && v.onEnter(api);
    }
    async function tapSpot(h) {
      if (h.needLight !== false && !flash) {
        G.audio && G.audio.sfx.tap();
        G.phone.toast('너무 어두워서 잘 안 보인다. 플래시를 켜자.');
        G.bus.emit('room:dark-tap', h.id);
        return;
      }
      G.audio && G.audio.sfx.tap();
      G.bus.emit('room:spot', h.id);
      if (h.tap) h.tap(api);
    }

    // drag to look around + move flashlight
    let drag = null;
    stageEl.style.touchAction = 'none';
    stageEl.addEventListener('pointerdown', (e) => {
      stageEl.setPointerCapture(e.pointerId);
      const r = stageEl.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, panX, t: Date.now(), moved: false };
      light = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      applyLight();
    });
    stageEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = stageEl.getBoundingClientRect();
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      const fr = frame.getBoundingClientRect();
      const maxPan = Math.max(1, fr.width - r.width);
      panX = clamp(drag.panX - dx / maxPan, 0, 1);
      light = { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
      layout();
    });
    const endDrag = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dt = Date.now() - drag.t;
      // quick flick past the edge -> turn
      if (Math.abs(dx) > 90 && dt < 350 && ((dx > 0 && panX <= 0.001) || (dx < 0 && panX >= 0.999))) setView(vi + (dx > 0 ? -1 : 1), dx > 0 ? -1 : 1);
      drag = null;
    };
    stageEl.addEventListener('pointerup', endDrag); stageEl.addEventListener('pointercancel', endDrag);

    leftBtn.addEventListener('click', () => setView(vi - 1, -1));
    rightBtn.addEventListener('click', () => setView(vi + 1, 1));
    flashBtn.addEventListener('click', () => {
      flash = !flash; G.state.vars.flash = flash; G.save();
      G.audio && G.audio.sfx.flashlight(flash);
      flashBtn.classList.toggle('on', flash);
      applyLight();
      if (flash) G.flag('usedFlash', true);
      G.bus.emit('room:flash', flash);
    });
    flashBtn.classList.toggle('on', flash);
    shutter.addEventListener('click', async () => {
      G.audio && G.audio.sfx.shutter();
      G.fx.flash('#fff', 350);
      const v = data.views[vi];
      G.bus.emit('room:photo', { view: v.id, flash, panX });
      const shots = G.state.vars.shots || [];
      shots.unshift({ view: v.id, src: flash ? (typeof v.litSrc === 'function' ? v.litSrc() : (v.litSrc || v.src)) : (typeof v.src === 'function' ? v.src() : v.src), flash, t: G.clock.now().getTime() });
      G.state.vars.shots = shots.slice(0, 20); G.save();
      thumb.style.backgroundImage = `url("${shots[0].src}")`;
      if (opts.mode === 'lockscreen') G.phone.toast('잠금 상태에서는 사진을 볼 수 없습니다');
    });
    thumb.addEventListener('click', () => {
      if (opts.mode === 'lockscreen') { G.phone.toast('잠금을 해제해야 볼 수 있습니다'); return; }
      close(); G.phone.openApp('gallery', { album: 'recent' });
    });
    flip.addEventListener('click', () => { G.bus.emit('camera:flip'); if (opts.onFlip) opts.onFlip(); else G.phone.toast('전면 카메라를 사용할 수 없습니다'); });
    closeBtn.addEventListener('click', () => close());
    const shots = G.state.vars.shots || [];
    if (shots[0]) thumb.style.backgroundImage = `url("${shots[0].src}")`;

    const ro = new ResizeObserver(layout); ro.observe(stageEl);
    function close() {
      if (!cur) return;
      ro.disconnect();
      ov.close();
      cur = null;
      G.bus.emit('room:close');
      opts.onClose && opts.onClose();
    }

    /* ---------- close-up viewer ---------- */
    function closeup(c) {
      // c: {src, title, text, zoom:true, node, onOpen, onClose, filter}
      const viewer = c.node || (c.src ? G.ui.zoomViewer(c.src, { maxScale: c.maxScale || 6, onChange: c.onZoom }) : el('div'));
      const capt = el('div.cu-caption', null, c.text ? el('p', { html: c.text }) : null);
      const node = el('div.closeup', null,
        el('div.cu-top', null, el('button.cu-back', { 'aria-label': '돌아가기', html: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' }), el('div.cu-title', null, c.title || '')),
        el('div.cu-body', null, viewer), capt);
      if (c.filter && viewer.setFilter) viewer.setFilter(c.filter);
      const o2 = G.phone.overlay(node, { onBack: () => done() });
      function done() { o2.close(); c.onClose && c.onClose(); }
      node.querySelector('.cu-back').addEventListener('click', done);
      c.onOpen && c.onOpen(node, done);
      return { node, close: done, caption: capt };
    }

    const api = {
      root, closeup, close, setView: (i) => setView(i), refresh: () => setView(vi), get view() { return data.views[vi]; }, get flash() { return flash; },
      say(text, ms) { G.fx.sub(text, ms || 2600); },
    };
    cur = api;
    setView(vi);
    setTimeout(() => hint.classList.add('fade'), 3500);
    return api;
  };

  function flashSvg() { return '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'; }
})();
