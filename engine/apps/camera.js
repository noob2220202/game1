/* =========================================================
 * 하루를 위한 방탈출! 2 — 카메라 app = 방 보기 (engine/apps/camera.js · owner: room)
 * DESIGN §2.6 ② (방 보기 = the phone's camera app, {N}'s user only) · §4.7.6 · §9.5-4 · ARCH §3.2 room · §4.19 open params.
 * The camera chrome (close · flashlight · 1×/2×/8× pill · shutter → vars.shots · direction dots · turn arrows) is drawn by
 * engine/room/room.js in camera mode; this file only registers the app and routes its open params.
 *
 *   G.app('camera', { name:'카메라', icon, open({ view, sub, flash }) })        open params (ARCH §4.19): camera { view, flash }
 *   G.camera = { open(params) → room api | null, rear(params) (ep1 alias), stop() (no-op), isLive() → false }
 * No getUserMedia, no permission prompt, no front camera (ARCH §1 — the ep1 simulated selfie view is gone in ep2).
 * Load order: after engine/room/room.js and engine/core/phone.js (G.app) — registration is guarded for partial builds.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const CAM = (G.camera = G.camera || {});

  CAM.open = function (p) {
    p = p || {};
    if (!G.room || typeof G.room.open !== 'function') { console.warn('[camera] G.room missing'); return null; }
    // camera mode exists only for {N} (§2.6) — '—' has no camera icon; resume / deep links are guarded here too
    try { if (G.users && G.users.current && G.users.current() === 'dash') return null; } catch (e) {}
    const o = { mode: 'camera', view: p.view, sub: p.sub, fromLock: !!p.fromLock };
    if (p.flash != null) o.flash = !!p.flash;
    return G.room.open(o);
  };
  CAM.rear = CAM.open;                       // ep1 name (shell's QS tile may still call it)
  CAM.stop = function () {};                 // nothing real is ever opened
  CAM.isLive = function () { return false; };

  function icon() {
    const ic = G.ICONS && G.ICONS.camera;
    if (ic) return ic;
    return { bg: 'linear-gradient(160deg,#4a4f57,#23262b)', svg: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.6-2h6.8L17 8h3v11H4z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="#fff" stroke-width="1.6"/></svg>' };
  }
  if (typeof G.app === 'function') {
    G.app('camera', { name: '카메라', icon: icon(), open(p) { CAM.open(p || {}); }, badge() { return 0; } });
  } else {
    console.warn('[camera] G.app missing — camera app not registered');
  }
})();
