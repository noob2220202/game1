/* =========================================================
 * ep2/js/main.js (flow) — boot + resume (DESIGN_EP2 §9.2 다시 열기 규칙 · §6.1.8 재개표 · §9.7 · §9.8 · §5.3 ·
 * ARCH §4.1 init order · §8 first boot / resume).
 *   Release gate, second lock: before release (no ?debug=1 / ?preview=1) this file shuts the page even if gate.js never
 *   ran — no init, no storage write, location.replace('../series/').
 *   boot(): load save → settings (--ts, body classes) → inits in ARCH §4.1 order (each optional) → preload 'start' →
 *           G.e2.seriesBoot() → title (or the warning directly after a 시작하기/처음부터 reset reload).
 *   resumeFrom(state, {fromTitle}): unlock (gesture) + G.clock.start() → the §8.2 row for the saved state.
 *   Esc (one action per press): keyboard close → pause menu close → notebook close → G.phone.back() while canBack()
 *   → pause. Two-finger tap (both touches end within 300 ms, moved < 10 px; a pinch is never a tap) → pause.
 *   Desktop ⏸ above the phone frame (data-qa pause.btn). Wake lock on start + on visible (no prompt; rejection ignored).
 *   Preload: the title background alone first, then G.PRELOAD + 'start' (on its load / error, at the first resume /
 *   #start / introDone, or after 6 s if the request hangs); lazy groups m1/m2/m3/m4/m7 via requestIdleCallback
 *   (2 s timeout fallback).
 *   DEBUG: ?jump=<id> → haru.jump after boot; notebook-title auto-check (card title ∈ strings drawn so far,
 *   except 이 폰 · —의 홈 · 지민의 질문 · 상자) → console + window.haru.titleCheck().
 * API: G.main = { boot(), resumeFrom(state, opts) }
 * Never defines G.T / G.NAME (core). No look-away logic, no reload reactions (§9.2: he never reacts to reloads).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const M = (G.main = G.main || {});

  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[main]', e); return d; } }

  /* ---------- release gate, fail-closed (DESIGN §12 MT-A · SERIES §4.1) ----------
   * ep2/js/gate.js is the gate; this is the second lock for when it never ran (404, blocked, cached error). Same rule:
   * ?debug=1 / ?preview=1 or G.series.isReleased(2); a missing series engine or any error = closed. Checked when this
   * file runs (before DOMContentLoaded / moment.js's load-time init) and again at the top of boot(). Closed → nothing is
   * initialised, every storage write of this page becomes a no-op (base.js saves on pagehide; moment.js inits on load),
   * and the page replaces itself with the picker. */
  function released() {
    try {
      if (/[?&](debug|preview)=1\b/.test(location.search || '')) return true;
      return !!(G.series && typeof G.series.isReleased === 'function' && G.series.isReleased(2));
    } catch (e) { return false; }
  }
  let gateShut = false;
  function shutGate() {
    if (gateShut) return; gateShut = true;
    M._booted = true;
    try { document.documentElement.style.visibility = 'hidden'; } catch (e) {}
    const noop = function () { return undefined; };
    try { G.save = noop; G.saveSettings = noop; G.resetSave = noop; } catch (e) {}
    try { const SP = window.Storage && window.Storage.prototype; if (SP) { SP.setItem = noop; SP.removeItem = noop; SP.clear = noop; } } catch (e) {}
    try { location.replace('../series/' + (location.protocol === 'file:' ? 'index.html' : '')); } catch (e) {}
  }
  if (!released()) { shutGate(); return; }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function call(obj, fn, ...a) { try { if (obj && typeof obj[fn] === 'function') return obj[fn](...a); } catch (e) { console.error('[main] ' + fn, e); } return undefined; }
  function scr() { return document.getElementById('screen'); }

  /* ---------- settings → page ---------- */
  function applySettings() {
    const s = G.settings || {};
    const ts = Number(s.textSize) || 1;
    document.documentElement.style.setProperty('--ts', String(ts));
    const b = document.body;
    if (b) {
      b.classList.toggle('reduce-shake', !!s.reduceShake);
      b.classList.toggle('reduce-flash', !!s.reduceFlash);
      b.classList.toggle('less-scary', s.scares && s.scares !== 'full');
      b.classList.toggle('speaker-mode', s.audioMode === 'speaker');
    }
    safe(() => { if (G.audio && G.audio.setEnabled && s.sound != null) G.audio.setEnabled(s.sound !== false); });
    safe(() => { if (G.audio && G.audio.setVolume && typeof s.volume === 'number') G.audio.setVolume(s.volume); });
  }

  /* ---------- preload (§9.8 지연 로드 묶음) ---------- */
  const kept = [];
  const loadedGroups = {};
  function preload(list) { (list || []).forEach((src) => { if (!src) return; const i = new Image(); i.decoding = 'async'; i.src = src; kept.push(i); }); }
  function idle(fn) { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 4000 }); else setTimeout(fn, 2000); }
  function group(name) {
    if (loadedGroups[name]) return;
    const g = G.PRELOAD_GROUPS && G.PRELOAD_GROUPS[name];
    if (!g) return;
    loadedGroups[name] = true;
    idle(() => preload(g));
  }
  /** first group (cold open — G.PRELOAD + 'start'), fired once: after the title background, on any progress, or at once */
  let startFired = false;
  function preloadStart() {
    if (startFired) return; startFired = true;
    preload(G.PRELOAD || []);
    if (G.PRELOAD_GROUPS && G.PRELOAD_GROUPS.start) { loadedGroups.start = true; preload(G.PRELOAD_GROUPS.start); }
  }
  /** the title background is requested first, alone (§9.8 — on a slow link it must not queue behind ~1 MB of cold-open
   *  images); the start group follows on its load / error, or when the player leaves the title (resume / #start /
   *  introDone call preloadStart too). The timer only covers a title request that hangs without an error: it is not
   *  1.5 s, because at 1.6 Mbps the title image itself needs ~3 s next to the title's web fonts, so a short timer fired
   *  first and the group competed with it again (QA F69: title bg 15.7 s with 1.5 s vs ≈ 12 s when it waits).
   *  No <link rel=preload> in the HTML: that would fetch before gate.js can redirect a pre-release visit. */
  const TITLE_WAIT_MS = 6000;
  function titleFirst() {
    const src = safe(() => (G.e2 && G.e2.img ? G.e2.img('title_ep2') : (G.IMG && G.IMG.title_ep2) || ''), '');
    if (!src) { preloadStart(); return; }
    const i = new Image();
    i.decoding = 'async';
    i.onload = i.onerror = () => preloadStart();
    setTimeout(preloadStart, TITLE_WAIT_MS);
    i.src = src; kept.push(i);
  }
  function preloadByProgress() {
    if (flag('introDone')) { preloadStart(); group('m1'); }
    if (flag('M1')) group('m2');
    if (flag('M2')) group('m3');
    if (flag('M3')) group('m4');
    if (flag('M5')) group('m7');
  }

  /* ---------- wake lock (§9.7) ---------- */
  let wake = null;
  async function wakeLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request || document.hidden) return;
    try { if (wake && !wake.released) return; wake = await navigator.wakeLock.request('screen'); } catch (e) { /* silently ignore */ }
  }

  /* ---------- pause entry points ---------- */
  function pause() { if (G.scenes && G.scenes.inGame && G.scenes.inGame()) call(G.scenes, 'pause'); }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (safe(() => G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen(), false)) { call(G.ui, 'hideKeyboard'); return; }
    if (safe(() => G.scenes && G.scenes.isPauseOpen && G.scenes.isPauseOpen(), false)) { call(G.scenes, 'closePause'); return; }
    if (safe(() => G.scenes && G.scenes.titleUp && G.scenes.titleUp(), false)) return;
    if (safe(() => G.notebook && G.notebook.isOpen && G.notebook.isOpen(), false)) { call(G.notebook, 'close'); return; }
    if (safe(() => G.phone && G.phone.canBack && G.phone.canBack(), false)) { call(G.phone, 'back'); return; }
    pause();
  }
  function twoFinger(root) {
    let g = null;
    const pts = (list) => Array.from(list).map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    root.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2 && !g) g = { t0: performance.now(), start: pts(e.touches), ends: {}, moved: false };
      else if (e.touches.length > 2) g = null;
    }, { passive: true, capture: true });
    root.addEventListener('touchmove', (e) => {
      if (!g) return;
      Array.from(e.touches).forEach((t) => { const s = g.start.find((p) => p.id === t.identifier); if (s && Math.hypot(t.clientX - s.x, t.clientY - s.y) >= 10) g.moved = true; });
    }, { passive: true, capture: true });
    root.addEventListener('touchend', (e) => {
      if (!g) return;
      const now = performance.now();
      Array.from(e.changedTouches).forEach((t) => { const s = g.start.find((p) => p.id === t.identifier); if (s) { g.ends[t.identifier] = now; if (Math.hypot(t.clientX - s.x, t.clientY - s.y) >= 10) g.moved = true; } });
      const ends = Object.values(g.ends);
      if (ends.length >= 2) {
        const ok = !g.moved && Math.max(...ends) - Math.min(...ends) <= 300 && Math.max(...ends) - g.t0 <= 450;
        g = null;
        if (ok) pause();
      } else if (e.touches.length === 0) g = null;
    }, { passive: true, capture: true });
    root.addEventListener('touchcancel', () => { g = null; }, { passive: true, capture: true });
  }
  function deskPause() {
    const stage = document.getElementById('stage');
    if (!stage || document.querySelector('.fl2-deskpause')) return;
    const b = G.util.el('button.fl2-deskpause', { 'data-qa': 'pause.btn', 'aria-label': '일시정지' }, '⏸');
    b.addEventListener('click', (e) => { e.stopPropagation(); pause(); });
    stage.appendChild(b);
    const sync = () => b.classList.toggle('on', !!(G.scenes && G.scenes.inGame && G.scenes.inGame()));
    setInterval(sync, 700);   // UI visibility only
    sync();
  }

  /* ---------- DEBUG: notebook title auto-check (§10 A) ---------- */
  function titleCheck() {
    const seen = new Set();
    const bad = [];
    const okIds = new Set();
    const skip = (n) => !!(n && n.closest && n.closest('.notebook, .nb-fab'));
    const collect = (node) => {
      if (!node) return;
      if (node.nodeType === 3) { const p = node.parentElement; if (!skip(p)) { const t = (node.textContent || '').trim(); if (t) seen.add(t); } return; }
      if (node.nodeType !== 1 || skip(node)) return;
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { if (!skip(n.parentElement)) { const t = (n.textContent || '').trim(); if (t) seen.add(t); } }
    };
    const root = scr();
    if (!root || !window.MutationObserver) return;
    collect(root);
    new MutationObserver((ms) => ms.forEach((m) => { if (m.type === 'characterData') collect(m.target); else m.addedNodes.forEach(collect); }))
      .observe(root, { childList: true, subtree: true, characterData: true });
    const exc = new Set((G.OBJECTIVES && G.OBJECTIVES.titleExceptions) || ['phone', 'home', 'answer', 'box']);
    // a card is judged the first time the player can see it (the notebook is open) — the corpus is what was drawn before
    setInterval(() => {
      if (!(G.notebook && G.notebook.isOpen && G.notebook.isOpen())) return;
      (G.OBJECTIVES || []).forEach((o) => {
        if (okIds.has(o.id) || exc.has(o.id)) return;
        let on = false; try { on = !o.show || !!o.show(); } catch (e) {}
        if (!on) return;
        okIds.add(o.id);
        const title = String(G.T ? G.T(typeof o.title === 'function' ? o.title() : o.title) : o.title);
        let found = false;
        for (const s of seen) { if (s.indexOf(title) >= 0) { found = true; break; } }
        if (!found) { bad.push({ id: o.id, title }); console.warn('[QA §10 A] notebook card title not drawn on screen before the card appeared:', o.id, title); }
      });
    }, 1000);
    window.haru = window.haru || {};
    window.haru.titleCheck = () => bad.slice();
  }

  /* ---------- boot (ARCH §4.1 · §8.1) ---------- */
  M.boot = function () {
    if (M._booted) return;
    if (!released()) { shutGate(); return; }     // fail closed: nothing below (init · seriesBoot · save) runs
    M._booted = true;
    if (G.DEBUG && !G.APP && document.body) document.body.classList.add('debug');   // no debug class under G.APP
    safe(() => { if (G.hasSave && G.hasSave() && G.load) G.load(); });
    applySettings();
    if (G.bus) G.bus.on('settings', applySettings);
    // init order (each optional)
    call(G.fx, 'init');
    call(G.phone, 'init');
    call(G.audio, 'init');
    call(G.media, 'init');
    call(G.e2, 'init');
    call(G.security, 'init');
    call(G.lock, 'init');
    call(G.room, 'init');
    call(G.climax, 'init');
    call(G.notebook, 'init');
    call(G.director, 'init');
    call(G.moment, 'init');
    call(G.alerts, 'init');
    call(G.ending, 'init');
    call(G.hook, 'init');
    call(G.scenes, 'init');
    call(G.e2, 'seriesBoot');
    // preload: the title background first, then the cold-open group (titleFirst); later groups follow progress
    if (G.bus) {
      G.bus.on('flag', preloadByProgress);
      G.bus.on('flag:introDone', () => { wakeLock(); });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && flag('introDone')) wakeLock(); });
    document.addEventListener('keydown', onKey);
    if (scr()) twoFinger(scr());
    deskPause();
    if (G.DEBUG) titleCheck();
    // a 시작하기 / 처음부터 reset reloads the page with #start → straight to the warning (the tap was the title button)
    if (/^#start$/.test(location.hash || '')) {
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
      preloadStart();
      call(G.scenes, 'warn');
    } else { titleFirst(); call(G.scenes, 'title'); }
    const jm = /[?&]jump=([A-Za-z0-9]+)/.exec(location.search);
    if (G.DEBUG && jm) setTimeout(() => { M._played = true; if (window.haru && window.haru.jump) window.haru.jump(jm[1]); else console.warn('[main] haru.jump missing'); }, 400);
  };

  /* ---------- resume (ARCH §8.2) ---------- */
  M.resumeFrom = function (state, opts) {
    opts = opts || {};
    const fromTitle = opts.fromTitle !== undefined ? !!opts.fromTitle : !M._played;
    M._played = true;
    safe(() => G.audio && G.audio.unlock && G.audio.unlock());
    safe(() => G.clock && G.clock.start && G.clock.start());
    safe(() => {   // the title (if up) gives way
      document.querySelectorAll('.fl2-title').forEach((n) => { n.classList.remove('in'); n.classList.add('out'); setTimeout(() => n.remove(), 700); });
      if (G.scenes) G.scenes._dropTitle && G.scenes._dropTitle();
    });
    wakeLock();
    preloadStart();
    preloadByProgress();
    const vars = (G.state && G.state.vars) || {};
    if (!flag('introDone') || flag('hookDone')) { call(G.scenes, 'title'); return; }
    if (flag('HOOK')) { call(G.hook, 'resume'); return; }
    call(G.scenes, 'ambience');
    call(G.director, 'start');
    call(G.room, 'refresh');
    if (!flag('gotPhone')) {
      if (!flag('M0')) {
        const needRecap = !safe(() => G.e2.cbPreview.e1done, false) && !flag('recapShown');
        (async () => { if (needRecap) await call(G.scenes, 'recap'); call(G.scenes, 'coldOpen'); })();
      } else {
        const b01 = safe(() => (G.director && G.director.fired ? G.director.fired('B01') : null), null);
        call(G.scenes, 'coldOpen', { resume: b01 != null });
      }
      return;
    }
    call(G.notebook, 'show', true);
    if (flag('doorOpened') || flag('END')) { call(G.ending, 'resume', vars.endStep || null); return; }
    // M8 ∧ ¬doorOpened: the forced door view comes up and the door then puts {N} on the home (§9.2) — no lock under it
    if (fromTitle && !flag('M8')) call(G.lock, 'show', vars.user || 'n');
    if (flag('M8')) { call(G.ending, 'resume', vars.endStep || null); return; }
    if (flag('M6') && !flag('M7')) call(G.climax, 'resume');
    if (flag('M7')) { call(G.climax, 'resume'); call(G.ending, 'resume', vars.endStep || null); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => M.boot());
  else M.boot();
})();
