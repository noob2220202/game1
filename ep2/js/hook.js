/* =========================================================
 * ep2/js/hook.js (flow) — B23 · 03:33 HOOK (DESIGN_EP2 §3.19 ⑥–⑩ · §4.1.8 · §4.10.12 · §6.4-③ · ARCH §4.19).
 *   check card → G.fx.black(2000) (all beds off, room tone −52 dBFS) → G.clock.jump('03:33') + freeze →
 *   G.lock.show('n', {mode:'hook', onOpen}) → +1.4 s G.phone.notify(N17 · seah_y · 음성 메시지 — his tone through
 *   G.tones routing; 소리 모드/방해 금지 obeyed by shell; less → −6 dB, no vibration) → flag HOOK in the same tick.
 *   Tap on N17 or the open gesture → voice-message overlay (no input field — {N} does not answer him):
 *   [avatar] 윤세아 / seah_y · ── 2026년 12월 25일 금요일 ── · 🎤 0:12 · waveform (pinch / double tap zoom) · 오전 3:33.
 *   No autoplay. Each play → vars.hookPlays += 1; played to the end → hookFull; first 0.5 s zoomed to ≥ 50 % width →
 *   hookZoom; first playback end → G.e2.mono('mono4') → 6 s → [처음 화면으로]. 30 s with no input → [처음 화면으로].
 *   Leaving ([처음 화면으로], back, home on the hook screen) → G.e2.hookPatch() + hookDone. pagehide / hidden while up →
 *   the same monotone patch, but hookDone only once hookOpened (an unopened 03:33 lock resumes after a reload).
 * API: G.hook = { init(), start({replay}), resume(), replay(), isUp() }
 * Flags set: HOOK hookOpened hookZoom hookFull hookDone · vars: hookPlays. data-qa: hook.play hook.wave (voiceBubble qa 'hook')
 *   hook.home. No sound of its own except through shell/core (N17 tone, mono line).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const HK = (G.hook = G.hook || {});
  const IDLE_MS = 30000;

  function el(tag, attrs, ...kids) { return G.util.el(tag, attrs, ...kids); }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[hook]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n) { try { G.flag(n, true); } catch (e) {} }
  function running() { try { return G.clock && G.clock.running ? !!G.clock.running() : !document.hidden; } catch (e) { return !document.hidden; } }
  function wait(ms) {
    return new Promise((res) => {
      let left = ms, last = performance.now();
      const step = () => { const now = performance.now(); if (running() || (frozen && !document.hidden)) left -= Math.min(250, now - last); last = now; if (left <= 0) res(); else setTimeout(step, Math.min(120, Math.max(16, left))); };
      setTimeout(step, Math.min(120, Math.max(16, ms)));
    });
  }
  function amb(id, on, o) { safe(() => { if (G.audio && G.audio.amb) G.audio.amb(id, on, o || {}); }); }
  function less() { return safe(() => (G.e2 && G.e2.less ? !!G.e2.less() : G.settings.scares !== 'full'), false); }
  function img(key) { return safe(() => (G.e2 && G.e2.img ? G.e2.img(key) : (G.IMG && G.IMG[key]) || ''), ''); }
  function scr() { return document.getElementById('screen'); }

  let up = false, frozen = false, overlay = null, bar = null, homeBtn = null, removeBack = null, finished = false;
  let idleLeft = IDLE_MS, idleLast = 0, idleTimer = 0, firstEndDone = false, starting = false;

  /* ---------- [처음 화면으로] bar (z 150) ---------- */
  function ensureBar() {
    if (bar) return bar;
    homeBtn = el('button.fl2-hookhome', { 'data-qa': 'hook.home' }, '처음 화면으로');
    homeBtn.addEventListener('click', (e) => { e.stopPropagation(); finish('home'); });
    bar = el('div.fl2-hookbar', null, homeBtn);
    (overlay || scr()).appendChild(bar);
    return bar;
  }
  function showHome() { ensureBar(); requestAnimationFrame(() => bar && bar.classList.add('in')); }

  /* ---------- 30 s idle (running time; any input resets it) ---------- */
  function onInput() { if (!up) return; idleLeft = IDLE_MS; }
  function armIdle() {
    clearTimeout(idleTimer);
    idleLeft = IDLE_MS; idleLast = performance.now();
    const step = () => {
      if (!up) return;
      const now = performance.now();
      if (!document.hidden) idleLeft -= Math.min(250, now - idleLast);
      idleLast = now;
      if (idleLeft <= 0) { showHome(); return; }
      idleTimer = setTimeout(step, 200);
    };
    idleTimer = setTimeout(step, 200);
  }

  /* ---------- the overlay ---------- */
  function openOverlay() {
    if (overlay || finished) return;
    setFlag('hookOpened');
    safe(() => G.save && G.save());
    const prof = safe(() => (G.STORY.moment.profiles.seah_y) || {}, {}) || {};
    const vm = safe(() => (G.STORY.moment.hookVM) || {}, {}) || {};
    const av = el('span.fl2-hook-av');
    const src = img(prof.avatar || 'avatar_sea');
    if (src) av.style.backgroundImage = `url("${src}")`;
    const head = el('div.fl2-hook-head', null, av, el('div.fl2-hook-who', null, el('b', null, T(prof.name || '윤세아')), el('small', null, 'seah_y')));
    const bubbleBox = el('div.fl2-hook-vm');
    const row = el('div.fl2-hook-row', null, bubbleBox, el('span.fl2-hook-time', null, vm.when || '오전 3:33'));
    const body = el('div.fl2-hook-body', null, el('div.fl2-hook-day', null, '── 2026년 12월 25일 금요일 ──'), row);
    overlay = el('div.fl2-card.fl2-hook', { role: 'dialog' }, head, body);
    scr().appendChild(overlay);
    if (bar) overlay.appendChild(bar);
    requestAnimationFrame(() => overlay && overlay.classList.add('in'));
    bubbleBox.appendChild(makeBubble(vm));
  }
  function onPlayStart() {
    const n = (safe(() => G.vars('hookPlays'), 0) || 0) + 1;
    safe(() => G.vars('hookPlays', n));
  }
  async function onEnded() {
    setFlag('hookFull');
    if (firstEndDone) return;
    firstEndDone = true;
    if (G.e2 && G.e2.mono) await safe(() => G.e2.mono('mono4'), Promise.resolve());
    await wait(6000);
    if (up) showHome();
  }
  function onZoom(w) {
    if (!w) return;
    const t0 = Math.max(0, +w.t0 || 0), t1 = +w.t1 || 0;
    const span = t1 - t0;
    if (!(span > 0)) return;
    const overlap = Math.max(0, Math.min(t1, 0.5) - t0);
    if (overlap / span >= 0.5 && overlap >= 0.25) setFlag('hookZoom');   // the first 0.5 s fills ≥ 50 % of the width
  }
  let sawPlay = false;
  function makeBubble(vm) {
    const dur = vm.dur || 12;
    const subs = vm.subs || [{ t0: 1.7, t1: 8.4, text: '[허밍]' }];
    if (G.ui && G.ui.voiceBubble) {
      const vb = safe(() => G.ui.voiceBubble({
        id: 'hook', dur, from: 'voice', zoom: true, unplayed: false, subs, qa: 'hook',
        getBuffer: () => safe(() => (G.audio && G.audio.buffer ? G.audio.buffer(vm.buffer || 'hook.seahY') : Promise.resolve(null)), Promise.resolve(null)),
        onFirstPlay: () => { setTimeout(() => { if (!sawPlay) onPlayStart(); }, 400); },
        onEnd: () => { onEnded(); },
        onZoom,
      }), null);
      if (vb && (vb.node || vb instanceof Node)) return vb.node || vb;
    }
    return fallbackBubble(dur, subs);
  }
  // minimal stand-in when core's voiceBubble is missing (partial builds): same qa, timer + subtitles, no audio
  function fallbackBubble(dur, subs) {
    const t = el('span.fl2-vm-t', null, `0:00 / 0:${String(dur).padStart(2, '0')}`);
    const sub = el('div.fl2-vm-sub');
    const playB = el('button.fl2-vm-play', { 'data-qa': 'hook.play', 'aria-label': '재생' }, '▶');
    const wave = el('div.fl2-vm-wave', { 'data-qa': 'hook.wave' }, Array.from({ length: 28 }, (_, i) => el('i', { style: { height: (6 + Math.round(14 * Math.abs(Math.sin(i * 1.7)))) + 'px' } })));
    let playing = false;
    playB.addEventListener('click', async () => {
      if (playing) return; playing = true; onPlayStart(); playB.textContent = '❚❚';
      const t0 = performance.now();
      await new Promise((res) => { const step = () => { const s = (performance.now() - t0) / 1000; t.textContent = `0:${String(Math.min(dur, Math.floor(s))).padStart(2, '0')} / 0:${String(dur).padStart(2, '0')}`; const cur = subs.find((x) => s >= x.t0 && s <= x.t1); sub.textContent = cur ? cur.text : ''; if (s >= dur) res(); else requestAnimationFrame(step); }; requestAnimationFrame(step); });
      playing = false; playB.textContent = '▶'; sub.textContent = ''; onEnded();
    });
    return el('div.fl2-vm', null, el('div.fl2-vm-top', null, el('span', null, '🎤 0:' + String(dur).padStart(2, '0'))), el('div.fl2-vm-row', null, playB, wave, t), sub);
  }

  /* ---------- lock screen in hook mode ---------- */
  function showLock() {
    if (G.lock && G.lock.show) safe(() => G.lock.show('n', { mode: 'hook', onOpen: () => openOverlay() }));
    else { console.warn('[hook] G.lock.show missing — opening the overlay directly'); openOverlay(); }
  }
  function silenceWorld() {
    safe(() => G.media && G.media.stopAll && G.media.stopAll());
    ['roofWind', 'tank', 'cityFar', 'snow', 'drone'].forEach((id) => amb(id, false, { fade: 0.4 }));
    safe(() => { const g = G.audio && G.audio.gsmTank; if (g && g.fadeTo) g.fadeTo(0, 300); });
    amb('room601', true, { dbfs: -52, fade: 0.4 });
  }
  function prepScreen() {
    safe(() => G.notebook && G.notebook.close && G.notebook.close());
    safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    safe(() => G.phone && G.phone.dismissModals && G.phone.dismissModals());
    safe(() => G.room && G.room.isOpen && G.room.isOpen() && G.room.close());
    safe(() => G.phone && G.phone.closeAll && G.phone.closeAll(true));
    if (safe(() => G.users && G.users.current && G.users.current(), 'n') === 'dash') safe(() => G.users.switchTo && G.users.switchTo('n', { instant: true }));
  }
  function freezeAt0333() {
    safe(() => G.clock && G.clock.jump && G.clock.jump('03:33'));
    safe(() => G.clock && G.clock.freeze && G.clock.freeze());
    frozen = true;
  }
  function arm() {
    up = true; finished = false; firstEndDone = false;
    if (!removeBack) removeBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => { finish('back'); return true; }) : null), null);
    armIdle();
  }

  HK.start = async function (opts) {
    opts = opts || {};
    if (starting || up) return;
    starting = true;
    try {
      safe(() => G.director && G.director.mark && G.director.mark('B23'));
      prepScreen();
      silenceWorld();
      if (G.fx && G.fx.black) await safe(() => G.fx.black(2000), Promise.resolve());
      else await blackFallback(2000);
      freezeAt0333();
      showLock();
      arm();
      await wait(1400);
      safe(() => G.phone && G.phone.notify && G.phone.notify({ id: 'N17', app: 'moment', chat: 'seah_y', title: 'seah_y', body: '음성 메시지', user: 'n',
        when: '오전 3:33', gainDb: less() ? -6 : 0, vibrate: !less(), route: { app: 'moment', params: { thread: 'seah_y' } } }));
      setFlag('HOOK');
      safe(() => G.save && G.save(true));
    } finally { starting = false; }
  };
  function blackFallback(ms) {
    return new Promise((res) => {
      const b = el('div.fl2-scene.fl2-black.in');
      scr().appendChild(b);
      setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 600); res(); }, ms);
    });
  }
  HK.resume = function () {
    if (!flag('HOOK') || flag('hookDone') || up) return;
    prepScreen();
    silenceWorld();
    freezeAt0333();
    // the 03:33 notification is already in the store after a reload; if it is missing (debug jump), restore it silently —
    // his tone is never played twice (ledger §4.8)
    const has = safe(() => (G.state.notifs || []).some((n) => n && n.id === 'N17'), false);
    if (!has) safe(() => G.phone && G.phone.notify && G.phone.notify({ id: 'N17', app: 'moment', chat: 'seah_y', title: 'seah_y', body: '음성 메시지', user: 'n',
      when: '오전 3:33', silent: true, banner: true, route: { app: 'moment', params: { thread: 'seah_y' } } }));
    showLock();
    arm();
  };
  HK.replay = function () { return HK.start({ replay: true }); };
  HK.isUp = function () { return up; };
  HK.openOverlay = function () { if (up) openOverlay(); };   // = tapping N17 / the open gesture (used by tests)

  /* ---------- leaving the hook: patch (§9.3 ⑤) + hookDone ----------
   * explicit exit ([처음 화면으로] · back · home · pause menu) → hookDone always.
   * soft (pagehide / hidden while up) → the monotone series patch only; hookDone once hookOpened — so a reload on the
   * unopened 03:33 lock resumes it (main → HK.resume, §9.2 'HOOK ∧ ¬hookDone'). */
  function patch(soft) {
    safe(() => G.e2 && G.e2.hookPatch && G.e2.hookPatch({ soft: !!soft }));
    if (!soft || flag('hookOpened')) setFlag('hookDone');             // no-op when hookPatch already set it
    safe(() => G.save && G.save(true));
  }
  function finish(why) {
    if (!up && finished) return;
    finished = true; up = false;
    clearTimeout(idleTimer);
    patch();
    if (typeof removeBack === 'function') safe(removeBack); removeBack = null;
    safe(() => G.media && G.media.stopAll && G.media.stopAll());
    // back to the title screen (fresh boot: the title shows 훅 다시 보기 · 처음부터)
    const b = el('div.fl2-scene.fl2-black');
    scr().appendChild(b);
    requestAnimationFrame(() => b.classList.add('in'));
    setTimeout(() => { try { location.reload(); } catch (e) { safe(() => G.scenes && G.scenes.title && G.scenes.title()); } }, 650);
  }
  /** leaving through the pause menu's 처음 화면으로 while the hook is up = '훅 화면 이탈' (§3.19 ⑩) */
  HK.patchNow = function () { if (up && !finished) { finished = true; up = false; patch(); } };
  HK.init = function () {
    if (HK._inited) return; HK._inited = true;
    document.addEventListener('pointerdown', onInput, true);
    document.addEventListener('keydown', onInput, true);
    if (G.bus) {
      G.bus.on('home', () => { if (up) finish('home'); });
      G.bus.on('media:play', (e) => { if (up && overlay && e && (e.id === 'hook' || e.from === 'voice')) { sawPlay = true; onPlayStart(); } });
    }
    const leave = () => { if (up && !finished) patch(true); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
  };
})();
