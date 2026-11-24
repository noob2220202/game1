/* =========================================================
 * 카메라 app: rear = the room (G.room); front = a dark in-game selfie view.
 * CLIENT OVERRIDE (docs/ARCH.md): no getUserMedia, no permission prompts — the front camera is
 * a simulated feed only. Story hook kept for compatibility:
 * G.STORY.camera = { onSelfie(api) }  api: {video:null, overlay, faceCount(n), box(x,y,w,h), close(), real:false}
 * CAM.stop() is kept (no-op safe) so older callers never leave anything running.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const CAM = (G.camera = {});

  G.app('camera', {
    name: '카메라',
    icon: G.ICONS.camera,
    dock: true,
    open(p) { CAM.rear(p); },
  });

  CAM.rear = function (p) {
    p = p || {};
    return G.room.open({ mode: p.mode || 'camera', view: p.view, onFlip: () => { const r = G.room.current(); if (r) r.close(); CAM.front(); } });
  };

  let frontApi = null;
  CAM.stop = function () { /* no real camera is ever opened */ };
  CAM.isLive = () => false;

  CAM.front = async function () {
    if (frontApi && frontApi.isOpen()) return frontApi;
    const root = el('div.room.selfie');
    // simulated front camera: near-black room, faint screen glow on an out-of-focus face-shaped shadow
    const fake = el('div.selfie-fake', null, el('div.sf-glow'), el('div.sf-shadow'));
    const overlay = el('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
    const faceBox = el('div.face-box', { style: { position: 'absolute', left: '30%', top: '30%', width: '40%', height: '30%', border: '1.5px solid #ffd60a', borderRadius: '10px', opacity: 0, transition: 'all .5s' } });
    const faceLbl = el('div', { style: { position: 'absolute', top: 'calc(var(--sb-h) + 60px)', left: 0, right: 0, textAlign: 'center', fontSize: '12px', color: '#ffd60a', letterSpacing: '1px' } }, '');
    const closeBtn = el('button.cam-close', { 'aria-label': '닫기', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
    const flip = el('button.cam-flip', { 'aria-label': '카메라 전환', html: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 13.5a3 3 0 015-2.2M15 12.5a3 3 0 01-5 2.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' });
    const shutter = el('button.cam-shutter', { 'aria-label': '촬영' }, el('i'));
    root.append(fake, overlay, faceBox, faceLbl, el('div.room-grain'),
      el('div.cam-top', null, closeBtn, el('div.cam-top-mid', null, el('div.room-label', null, '전면 카메라')), el('span', { style: { width: '40px' } })),
      el('div.cam-bottom', null, el('div.cam-modes', null, el('span', null, '동영상'), el('b', null, '사진'), el('span', null, '인물')), el('div.cam-row', null, el('span', { style: { width: '46px' } }), shutter, flip)));
    let closed = false;
    const ov = G.phone.overlay(root, { onBack: () => close() });
    function close() {
      if (closed) return;
      closed = true;
      ov.close();
      if (frontApi === api) frontApi = null;
      G.bus.emit('camera:front-close');
    }
    closeBtn.addEventListener('click', () => close());
    flip.addEventListener('click', () => { close(); setTimeout(() => CAM.rear(), 250); });
    shutter.addEventListener('click', () => { G.audio.sfx.shutter(); G.fx.flash('#fff', 300); G.bus.emit('camera:selfie-shot'); });

    const api = (frontApi = {
      video: null, overlay, root, real: false,
      faceCount(n) { faceLbl.textContent = n ? `얼굴 ${n}` : ''; },
      box(x, y, w, h, color) { faceBox.style.opacity = 1; Object.assign(faceBox.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%', borderColor: color || '#ffd60a' }); },
      hideBox() { faceBox.style.opacity = 0; },
      close,
      isOpen: () => !closed && document.body.contains(root),
    });
    G.bus.emit('camera:front', api);
    if (G.STORY.camera && G.STORY.camera.onSelfie) G.STORY.camera.onSelfie(api);
    else { await sleep(900); if (!closed) { api.box(0.3, 0.3, 0.4, 0.3); api.faceCount(1); } }
    return api;
  };
})();
