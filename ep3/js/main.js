/* =========================================================
 * ep3/js/main.js (flow) — boot + resume (DESIGN_EP3 §3.22 · §9.2 다시 열기 · §6.1.8 · §9.5-4 back/Esc · §9.7 wake lock ·
 * §9.8 preload · §10 A title auto-check · ARCH_EP3 §5.1 init order · §8.2 first boot · §8.3 resume).
 *   Engine check, second lock (fail-closed): if the series engine did not open the page (gate.js never ran or G.gate.released()
 *   is not true) this file shuts it — no init, no storage write, location.replace('../series/'). Episode 3 itself is open.
 *   boot(): load save → settings (--ts, body classes, body.ep3) → inits in ARCH §5.1 order (each optional) → G.e3.seriesBoot()
 *           → HOOK ∧ ¬patched ⇒ the boot patch (G.hook.bootPatch) → title (or the warning directly after a 처음부터 reload).
 *   resumeFrom(state, {fromTitle}): unlock (gesture) + G.clock.start() → the ARCH §8.3 row for the saved state.
 *   Esc (one action per press): keyboard close → pause close → notebook close → G.phone.back() while canBack() → pause.
 *   Two-finger tap (both touches end within 300 ms, moved < 10 px; a pinch is never a tap) → pause. Desktop ⏸ beside the
 *   frame (data-qa pause.btn). Wake lock at introDone + on visible (no prompt; rejection ignored).
 *   Preload (§9.8): the title background alone first, then G.PRELOAD + 'start' (on its load / error, at the first resume /
 *   #start, or after 6 s); then by progress: m0idle (M0 + 30 s idle) · gotPhone · m2 · m5 · m7 (requestIdleCallback, 2 s fallback).
 *   DEBUG: ?jump=<id> → haru.jump after boot (core) · notebook-title auto-check (card title ∈ strings drawn before the card
 *   appeared; G.OBJECTIVES.titleExceptions — 'id' always, 'id@flag' only while that flag is on) → console + haru.titleCheck().
 * API: G.main = { boot(), resumeFrom(state, opts) }
 * Never defines G.T / G.NAME (core). No look-away logic, no reload reactions (§9.2: he never reacts to reloads).
 * data-qa: pause.btn
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const M = (G.main = G.main || {});

  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[main]', e); return d; } }

  /* ---------- engine check, fail-closed (§9.9) — the second lock behind gate.js ---------- */
  function released() {
    try {
      // ARCH §5.5: only e3.js / gate.js read the series record — no gate module = closed
      return !!(G.gate && typeof G.gate.released === 'function' && G.gate.released());
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
  function E() { return G.e3 || G.ep || G.e2 || null; }
  function el(tag, attrs, ...kids) { return G.util && G.util.el ? G.util.el(tag, attrs, ...kids) : document.createElement('div'); }

  /* ---------- settings → page ---------- */
  function applySettings() {
    const s = G.settings || {};
    const ts = Number(s.textSize) || 1;
    document.documentElement.style.setProperty('--ts', String(ts));
    const b = document.body;
    if (b) {
      b.classList.add('ep3');
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
  function idle(fn, ms) { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: ms || 4000 }); else setTimeout(fn, 2000); }
  function group(name) {
    if (loadedGroups[name]) return;
    const g = G.PRELOAD_GROUPS && G.PRELOAD_GROUPS[name];
    if (!g) return;
    loadedGroups[name] = true;
    idle(() => preload(g));
  }
  let startFired = false;
  function preloadStart() {
    if (startFired) return; startFired = true;
    preload(G.PRELOAD || []);
    if (G.PRELOAD_GROUPS && G.PRELOAD_GROUPS.start) { loadedGroups.start = true; preload(G.PRELOAD_GROUPS.start); }
  }
  /** the title background first, alone — no <link rel=preload> (the engine check must be able to bounce first) */
  const TITLE_WAIT_MS = 6000;
  function titleFirst() {
    const src = safe(() => { const e = E(); return e && e.img ? e.img('t3_title') : (G.IMG && G.IMG.t3_title) || ''; }, '');
    if (!src) { preloadStart(); return; }
    const i = new Image();
    i.decoding = 'async';
    i.onload = i.onerror = () => preloadStart();
    setTimeout(preloadStart, TITLE_WAIT_MS);
    i.src = src; kept.push(i);
  }
  let m0idleArmed = false;
  function preloadByProgress() {
    if (flag('introDone')) preloadStart();
    if (flag('M0') && !m0idleArmed) { m0idleArmed = true; setTimeout(() => group('m0idle'), flag('M1') ? 0 : 30000); }
    if (flag('gotPhone')) group('gotPhone');
    if (flag('M2')) group('m2');
    if (flag('M5')) group('m5');
    if (flag('M7')) group('m7');
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
    if (!stage || document.querySelector('.fl3-deskpause')) return;
    const label = ((G.STORY && G.STORY.cards && G.STORY.cards.pause) || {}).head || '일시정지';
    const b = el('button.fl3-deskpause', { 'data-qa': 'pause.btn', 'aria-label': label }, '⏸');
    b.addEventListener('click', (e) => { e.stopPropagation(); pause(); });
    stage.appendChild(b);
    const sync = () => b.classList.toggle('on', !!(G.scenes && G.scenes.inGame && G.scenes.inGame()));
    setInterval(sync, 700);   // UI visibility only
    sync();
  }

  /* ---------- DEBUG: notebook title auto-check (§10 A · §2.4 제목 규칙) ---------- */
  function titleCheck() {
    const seen = new Set();
    const bad = [];
    const okIds = new Set();
    const skip = (n) => !!(n && n.closest && n.closest('.notebook, .nb-fab'));
    const addText = (t) => { t = String(t || '').trim(); if (t) seen.add(t); };
    const collect = (node) => {
      if (!node) return;
      if (node.nodeType === 3) { const p = node.parentElement; if (!skip(p)) { addText(node.textContent); if (p) addText(p.textContent); } return; }
      if (node.nodeType !== 1 || skip(node)) return;
      addText(node.textContent);
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { if (!skip(n.parentElement)) addText(n.textContent); }
    };
    const root = scr();
    if (!root || !window.MutationObserver) return;
    collect(root);
    new MutationObserver((ms) => ms.forEach((m) => {
      if (m.type === 'characterData') { collect(m.target); return; }
      m.addedNodes.forEach(collect);
      // slow card reveals add a character at a time — keep the whole line of the card box too
      if (m.target && m.target.nodeType === 1 && m.target.closest && m.target.closest('.c3-card, .fl3-fcard')) addText(m.target.textContent);
    })).observe(root, { childList: true, subtree: true, characterData: true });
    const raw = (G.OBJECTIVES && G.OBJECTIVES.titleExceptions) || ['call', 'phone', 'soup@gotPhone'];
    const always = new Set(), when = {};
    raw.forEach((x) => { const [id, f] = String(x).split('@'); if (f) when[id] = f; else always.add(id); });
    setInterval(() => {
      if (!(G.notebook && G.notebook.isOpen && G.notebook.isOpen())) return;
      (G.OBJECTIVES || []).forEach((o) => {
        if (okIds.has(o.id) || always.has(o.id)) return;
        let on = false; try { on = !o.show || !!o.show(); } catch (e) {}
        if (!on) return;
        okIds.add(o.id);
        const title = String(G.T ? G.T(typeof o.title === 'function' ? o.title() : o.title) : o.title);
        let found = false;
        for (const s of seen) { if (s.indexOf(title) >= 0) { found = true; break; } }
        if (!found && when[o.id] && flag(when[o.id])) found = true;   // e.g. soup appeared through the gotPhone branch
        if (!found) { bad.push({ id: o.id, title }); console.warn('[QA §10 A] notebook card title not drawn on screen before the card appeared:', o.id, title); }
      });
    }, 1000);
    window.haru = window.haru || {};
    window.haru.titleCheck = () => bad.slice();
  }

  /* ---------- boot (ARCH §5.1 · §8.2) ---------- */
  M.boot = function () {
    if (M._booted) return;
    if (!released()) { shutGate(); return; }     // fail closed: nothing below runs
    M._booted = true;
    if (document.body) { document.body.classList.add('ep3'); if (G.DEBUG && !G.APP) document.body.classList.add('debug'); }
    safe(() => { if (G.hasSave && G.hasSave() && G.load) G.load(); });
    applySettings();
    if (G.bus) G.bus.on('settings', applySettings);
    // ARCH §5.1 init order (each optional and idempotent)
    call(G.fx, 'init');
    call(G.phone, 'init');
    call(G.audio, 'init');
    call(G.media, 'init');
    call(E(), 'init');
    call(G.cards, 'init');
    call(G.lock, 'init');
    call(G.easy, 'init');
    call(G.room, 'init');
    call(G.phoneApp, 'init');
    call(G.callrec, 'init');
    call(G.sms, 'init');
    call(G.talk, 'init');
    call(G.gallery, 'init');
    call(G.calendarApp, 'init');
    call(G.show, 'init');
    call(G.notebook, 'init');
    call(G.director, 'init');
    call(G.call, 'init');
    call(G.door, 'init');
    call(G.memory, 'init');
    call(G.climax, 'init');
    call(G.ending, 'init');
    call(G.hook, 'init');
    call(G.scenes, 'init');
    call(E(), 'seriesBoot');
    call(G.hook, 'bootPatch');                    // HOOK ∧ ¬patched → patch from the saved stage (§9.3 ⑤ · §3.22)
    if (G.bus) {
      G.bus.on('flag', preloadByProgress);
      G.bus.on('flag:introDone', () => { wakeLock(); });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && flag('introDone')) wakeLock(); });
    document.addEventListener('keydown', onKey);
    if (scr()) twoFinger(scr());
    deskPause();
    if (G.DEBUG) titleCheck();
    // 처음부터 reloads the page with #start → straight to the warning (the tap was the title button)
    if (/^#start$/.test(location.hash || '')) {
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
      preloadStart();
      call(G.scenes, 'warn');
    } else { titleFirst(); call(G.scenes, 'title'); }
    const jm = /[?&]jump=([A-Za-z0-9]+)/.exec(location.search);
    if (G.DEBUG && jm) setTimeout(() => { M._played = true; if (window.haru && window.haru.jump) window.haru.jump(jm[1]); else console.warn('[main] haru.jump missing'); }, 400);
  };

  /* ---------- resume (ARCH §8.3 — also the tail of core's haru.jump) ---------- */
  function dropOverlays() {
    document.querySelectorAll('#screen > .fl3-title, #screen > .fl3-pre').forEach((n) => { n.classList.remove('in'); n.classList.add('out'); setTimeout(() => n.remove(), 700); });
    safe(() => G.scenes && G.scenes._dropTitle && G.scenes._dropTitle());
  }
  function stopRunning() {                          // a jump mid-game: whatever flow piece runs gives way
    call(G.scenes, 'abort');
    call(G.call, 'abort');
    if (!flag('END') || flag('HOOK')) call(G.ending, 'abort');
    safe(() => G.flow && G.flow.closeCards && G.flow.closeCards('replace'));
    const eye = safe(() => G.scenes && G.scenes.eye && G.scenes.eye(), null);
    if (eye) { safe(() => G.flow && G.flow.eyeClose && G.flow.eyeClose(eye, 300)); call(G.scenes, '_setEye', null); }
    document.querySelectorAll('#screen > .fl3-black').forEach((n) => n.remove());
  }
  M.resumeFrom = function (state, opts) {
    opts = opts || {};
    const fromTitle = opts.fromTitle !== undefined ? !!opts.fromTitle : !M._played;
    M._played = true;
    safe(() => G.audio && G.audio.unlock && G.audio.unlock());
    safe(() => G.clock && G.clock.start && G.clock.start());
    dropOverlays();
    if (!fromTitle) stopRunning();
    wakeLock();
    preloadStart();
    preloadByProgress();
    const vars = (G.state && G.state.vars) || {};
    const seq = vars.seq || {};
    if (!flag('introDone') || flag('hookDone')) { call(G.scenes, 'title'); return; }
    if (flag('HOOK')) { call(G.hook, 'resume'); return; }
    call(G.director, 'start');
    call(G.room, 'refresh');
    if (!flag('M0')) {
      const needRecap = !!safe(() => { const e = E(); return e && e.cb ? e.cb('E') : false; }, false) && !flag('recapShown');
      (async () => { if (needRecap) await call(G.scenes, 'recap'); call(G.scenes, 'coldOpen'); })();
      return;
    }
    call(G.notebook, 'show', true);
    if (!flag('M1') && !seq.m1 && !flag('handover')) { call(G.scenes, 'coldOpen', { resume: true }); return; }
    if (!flag('handover')) { call(G.call, 'resume'); return; }
    // past the handover no eye view survives a jump (an M0 / 03:33 eye left open would sit over the lock or the home) —
    // END / tail / hook pieces re-open their own eye views from their resume
    if (!fromTitle) safe(() => G.room && G.room.close && G.room.close({ all: true }));
    if (!flag('gotPhone')) { call(G.lock, 'show', 'n'); return; }
    // gotPhone — the phone home (easy / standard from vars.easy); the app stack is not restored (§9.2)
    call(G.phone, 'home');
    if (flag('END')) { call(G.ending, 'resume', vars.endStep || null); return; }
    if (flag('M8')) { call(G.climax, 'resume'); return; }
    if (flag('M7')) { call(G.memory, 'resume'); return; }
    if (flag('M5') || flag('M6')) call(G.door, 'resume');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => M.boot());
  else M.boot();
})();
