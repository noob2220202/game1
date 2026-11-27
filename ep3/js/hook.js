/* =========================================================
 * ep3/js/hook.js (flow) — B21 · HOOK 06:10 (DESIGN_EP3 §3.16-3·5 · §4.12.5 · §6.4-① · §9.3 ⑤ · ARCH_EP3 §5.14 · §8.3).
 *   t 0 black (G.fx.black(2000) + a fl3-black cover until t 3) + G.audio.hush(true, {roomDb:-90}) · every house layer off ·
 *   HOOK + hookOpened (the HOOK clock row is fixed 06:10) → t 2.0 amb.fridge + amb.clock only, 1 s fade-in → t 3.0
 *   G.room.eye({closeup:'c3_phone_ring', grade:'0610'}) 0.6 s → comms G.callrec.renderBlockedMsgs(eye.screenNode(), {hook:true})
 *   (메시지 › 차단된 메시지, 4 rows — standard UI) → t 4.6 push(G.STORY.blocked.hook) and IN THE SAME FRAME
 *   G.audio.cue('boiler.fire', {n:3}) + flag boilerSting (the one soft sting · no subtitle · no notification · no vibration)
 *   → +3 s `[처음 화면으로]` (hook.home, no nudge text) → G.e3.hookPatch() → title (fresh page).
 *   Back / home on the hook screen and pagehide / hidden while it is up → G.e3.hookPatch(true) (soft — core sets hookDone only
 *   after hookOpened). Replay (`훅 다시 보기` on the title) runs the same cut; the patch is monotone, so it is safe again.
 * API: G.hook = { init(), start({replay}), resume(), replay(), isUp(), patchNow(), bootPatch() }
 * Flags set: HOOK hookOpened boilerSting (hookDone = core, inside G.e3.hookPatch) · marks B21. data-qa: hook.home.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const HK = (G.hook = G.hook || {});

  const F = () => G.flow || {};
  function el(tag, attrs, ...kids) { return F().el ? F().el(tag, attrs, ...kids) : (G.util && G.util.el ? G.util.el(tag, attrs, ...kids) : document.createElement('div')); }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[hook]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n) { try { G.flag(n, true); } catch (e) {} }
  function E() { return G.ep || G.e3 || G.e2 || null; }
  function wait(ms) { return F().wait ? F().wait(ms) : new Promise((r) => setTimeout(r, ms)); }
  function amb(id, on, o) { safe(() => { if (G.audio && G.audio.amb) G.audio.amb(id, on, o || {}); }); }
  function scr() { return document.getElementById('screen'); }
  const HOUSE_OFF = ['amb.apt', 'amb.air', 'amb.wind90', 'amb.boilerPump', 'breath.jimin', 'breath.kongi', 'breath.mom', 'stove.flame', 'soup.simmer'];

  let up = false, starting = false, finished = false, eye = null, bar = null, removeBack = null, gen = 0, upAt = 0;

  /* ---------- the blocked-message screen: comms renders it; a plain stand-in for partial builds ---------- */
  function fallbackBlocked(node) {
    const B = (G.STORY && G.STORY.blocked) || {};
    const fmt = (d) => safe(() => { const e = E(); return e && e.fmtDate ? e.fmtDate(d) : d; }, d);
    const head = ((B.block && B.block.rows) || [])[4] || '';
    const list = el('div.fl3-hb-list');
    const row = (when, num, text) => el('div.fl3-hb-row', null, el('div.fl3-hb-top', null, el('span.fl3-hb-when', null, when), el('span.fl3-hb-num', null, num + ' (광고)')), el('div.fl3-hb-text', null, T(text)));
    (B.messages || []).forEach((m) => list.appendChild(row(fmt(m.d), m.number, m.text)));
    node.innerHTML = '';
    node.appendChild(el('div.fl3-hb', null, el('div.fl3-hb-head', null, head), list));
    return {
      push(r) {
        const n = row(r.label || r.hm || '', r.number || '', r.text || '');
        n.classList.add('new');
        list.insertBefore(n, list.firstChild);
        requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('in')));
        return wait(500);
      },
    };
  }
  function renderBlocked(node) {
    if (!node) return null;
    if (G.callrec && typeof G.callrec.renderBlockedMsgs === 'function') {
      const r = safe(() => G.callrec.renderBlockedMsgs(node, { hook: true }), null);
      if (r && typeof r.push === 'function') return r;
    }
    return fallbackBlocked(node);
  }

  /* ---------- [처음 화면으로] ---------- */
  function showHome() {
    if (bar) return;
    const label = ((G.STORY && G.STORY.ending && G.STORY.ending.hook) || {}).home || '처음 화면으로';
    const b = el('button.fl3-hookhome', { 'data-qa': 'hook.home' }, label);
    b.addEventListener('click', (e) => { e.stopPropagation(); finish(false); });
    bar = el('div.fl3-hookbar', null, b);
    (scr() || document.body).appendChild(bar);
    requestAnimationFrame(() => requestAnimationFrame(() => bar && bar.classList.add('in')));
  }

  function prepScreen() {
    safe(() => G.notebook && G.notebook.close && G.notebook.close());
    safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    safe(() => F().closeCards && F().closeCards('end'));
    safe(() => G.phone && G.phone.dismissModals && G.phone.dismissModals());
    safe(() => G.room && G.room.isOpen && G.room.isOpen() && G.room.close && G.room.close({ all: true }));
    safe(() => G.phone && G.phone.closeAll && G.phone.closeAll(true));
    safe(() => G.callrec && G.callrec.stop && G.callrec.stop());
    // 06:10 — the kitchen light has been on since 05:30 (a replay / reload restores it too): c3_phone_ring → its _lit plate
    safe(() => G.room && G.room.set && G.room.set('kitchenLight', true));
  }

  HK.start = async function (opts) {
    opts = opts || {};
    if (starting || up) return;
    starting = true; finished = false;
    const my = ++gen;
    try {
      safe(() => G.director && G.director.mark && G.director.mark('B21'));
      safe(() => G.director && G.director.start && G.director.start());   // T .30 over 3 s (vignette only) — also on a replay
      prepScreen();
      // t 0 — black 2 s, every bus to 0 (room tone included)
      const black = F().scene ? F().scene('fl3-black') : null;
      if (black) black.classList.add('in');
      safe(() => G.fx && G.fx.black && G.fx.black(2000));
      safe(() => G.audio && G.audio.hush && G.audio.hush(true, { roomDb: -90 }));
      HOUSE_OFF.concat(['amb.clock']).forEach((id) => amb(id, false, { fade: 0.2 }));   // amb.fridge has no off switch (§7.1.4) — the hush silences it
      if (!flag('HOOK')) setFlag('HOOK');
      if (!flag('hookOpened')) setFlag('hookOpened');
      safe(() => G.save && G.save(true));
      up = true; upAt = performance.now();
      if (!removeBack) removeBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => { finish(true); return true; }) : null), null);
      await wait(2000);
      if (my !== gen) return;
      // t 2.0 — only the fridge and the wall clock fade in (the cut looks at the phone alone)
      safe(() => G.audio && G.audio.hush && G.audio.hush(false));
      amb('amb.fridge', true, { fade: 1 }); amb('amb.clock', true, { fade: 1 });
      await wait(1000);
      if (my !== gen) return;
      // t 3.0 — the same place, the same phone (06:10 grading — the kitchen light is on)
      eye = F().eye ? F().eye({ closeup: 'c3_phone_ring', grade: '0610', fadeMs: 600, spots: false }) : null;
      if (black && F().removeScene) F().removeScene(black, 600);
      await wait(250);
      const node = safe(() => (eye && eye.screenNode ? eye.screenNode() : null), null);
      const screen = renderBlocked(node);
      await wait(1350);
      if (my !== gen) return;
      // t 4.6 — the new line slides in silently, and in the same frame the boiler fires the third time (soft sting 1)
      const hookRow = (G.STORY && G.STORY.blocked && G.STORY.blocked.hook) || null;
      if (screen && hookRow) safe(() => screen.push(hookRow));
      safe(() => G.audio && G.audio.cue && G.audio.cue('boiler.fire', { n: 3, src: 'boiler' }));
      setFlag('boilerSting');
      safe(() => G.room && G.room.pulse && G.room.pulse('boiler'));
      await wait(3000);
      if (my !== gen) return;
      showHome();
    } finally { starting = false; }
  };
  HK.replay = function () { return HK.start({ replay: true }); };
  HK.isUp = function () { return up; };
  /** boot (ARCH §8.3 'HOOK ∧ ¬hookDone'): the series patch from the saved stage when it never went through */
  HK.bootPatch = function () {
    if (!flag('HOOK')) return;
    const v = (G.state && G.state.vars) || {};
    if (!v.patched) safe(() => { const e = E(); if (e && e.hookPatch) e.hookPatch(true); });
  };
  /** resume = the ending screen (title with 훅 다시 보기) after the boot patch */
  HK.resume = function () {
    HK.bootPatch();
    safe(() => G.scenes && G.scenes.title && G.scenes.title());
  };

  /* ---------- leaving the hook (§9.3 ⑤) ---------- */
  function patch(soft) {
    safe(() => { const e = E(); if (e && e.hookPatch) e.hookPatch(!!soft); });
    safe(() => G.save && G.save(true));
  }
  function finish(soft) {
    if (finished) return;
    finished = true; up = false; gen++;
    patch(soft);
    if (typeof removeBack === 'function') safe(removeBack); removeBack = null;
    const b = el('div.fl3-scene.fl3-black');
    (scr() || document.body).appendChild(b);
    requestAnimationFrame(() => b.classList.add('in'));
    safe(() => G.audio && G.audio.hush && G.audio.hush(true, { roomDb: -90 }));
    setTimeout(() => { try { location.reload(); } catch (e) { safe(() => G.scenes && G.scenes.title && G.scenes.title()); } }, 800);
  }
  /** the pause menu's 처음 화면으로 while the hook is up = leaving the hook screen */
  HK.patchNow = function () { if (up && !finished) { finished = true; up = false; patch(true); } };

  HK.init = function () {
    if (HK._inited) return; HK._inited = true;
    // (a 'home' emitted by the closeAll of the cut's own preparation is not the player leaving)
    if (G.bus) G.bus.on('home', () => { if (up && !finished && performance.now() - upAt > 1500) finish(true); });
    const leave = () => { if (up && !finished) patch(true); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
  };
})();
