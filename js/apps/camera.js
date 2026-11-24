/* =========================================================
 * 카메라 app: rear = the room (G.room), front = REAL selfie camera via getUserMedia
 * (optional; falls back to a dark fake feed). Story hooks:
 * G.STORY.camera = { onSelfie(api) }  api: {video, overlay, faceCount(n), box(x,y,w,h), close(), real:boolean}
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const CAM = (G.camera = {});
  let stream = null;

  G.app('camera', {
    name: '카메라',
    icon: G.ICONS.camera,
    dock: true,
    open(p) { CAM.rear(p); },
  });

  CAM.rear = function (p) {
    G.room.open({ mode: (p && p.mode) || 'camera', onFlip: () => { G.room.current().close(); CAM.front(); } });
  };

  CAM.stop = function () { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; G.bus.emit('camera:real', false); } };

  CAM.front = async function () {
    const root = el('div.room.selfie');
    const video = el('video', { playsinline: true, autoplay: true, muted: true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: 'brightness(.75) contrast(1.15) saturate(.7)' } });
    video.muted = true; video.setAttribute('playsinline', '');
    const fake = el('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, #2a2622 0%, #0b0a09 60%, #000 100%)' } });
    const overlay = el('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
    const faceBox = el('div.face-box', { style: { position: 'absolute', left: '30%', top: '30%', width: '40%', height: '30%', border: '1.5px solid #ffd60a', borderRadius: '10px', opacity: 0, transition: 'all .5s' } });
    const faceLbl = el('div', { style: { position: 'absolute', top: 'calc(var(--sb-h) + 60px)', left: 0, right: 0, textAlign: 'center', fontSize: '12px', color: '#ffd60a', letterSpacing: '1px' } }, '');
    const closeBtn = el('button.cam-close', { 'aria-label': '닫기', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
    const flip = el('button.cam-flip', { 'aria-label': '카메라 전환', html: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 13.5a3 3 0 015-2.2M15 12.5a3 3 0 01-5 2.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' });
    const shutter = el('button.cam-shutter', { 'aria-label': '촬영' }, el('i'));
    root.append(fake, video, overlay, faceBox, faceLbl, el('div.room-grain'),
      el('div.cam-top', null, closeBtn, el('div.cam-top-mid', null, el('div.room-label', null, '전면 카메라')), el('span', { style: { width: '40px' } })),
      el('div.cam-bottom', null, el('div.cam-modes', null, el('span', null, '동영상'), el('b', null, '사진'), el('span', null, '인물')), el('div.cam-row', null, el('span', { style: { width: '46px' } }), shutter, flip)));
    const ov = G.phone.overlay(root, { onBack: () => close() });
    let real = false;
    function close() { CAM.stop(); ov.close(); G.bus.emit('camera:front-close'); }
    closeBtn.addEventListener('click', close);
    flip.addEventListener('click', () => { close(); setTimeout(() => CAM.rear(), 250); });
    shutter.addEventListener('click', () => { G.audio.sfx.shutter(); G.fx.flash('#fff', 300); G.bus.emit('camera:selfie-shot'); });

    if (G.settings.camera !== false && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }, audio: false });
        video.srcObject = stream; await video.play().catch(() => {});
        real = true; fake.style.display = 'none';
        G.bus.emit('camera:real', true);
      } catch (e) { real = false; }
    }
    if (!real) video.style.display = 'none';
    const api = {
      video, overlay, root, real,
      faceCount(n) { faceLbl.textContent = n ? `얼굴 ${n}` : ''; },
      box(x, y, w, h, color) { faceBox.style.opacity = 1; Object.assign(faceBox.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%', borderColor: color || '#ffd60a' }); },
      hideBox() { faceBox.style.opacity = 0; },
      close,
      isOpen: () => document.body.contains(root),
    };
    G.bus.emit('camera:front', api);
    if (G.STORY.camera && G.STORY.camera.onSelfie) G.STORY.camera.onSelfie(api);
    else { await sleep(800); api.box(0.3, 0.3, 0.4, 0.3); api.faceCount(1); }
    return api;
  };
})();
