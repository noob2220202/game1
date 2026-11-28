/* =========================================================
 * ep3/js/scenes.js (flow) — B00 · B01 · B02 and the out-of-world screens (DESIGN_EP3 §3.0 · §3.1 M0 · §4.0 · §4.1.1–§4.1.2 ·
 * §6.2 B00–B02 · §9.7 · ARCH_EP3 §3.2 flow · §5.14 · §8.2).
 *   title `{N를} 위한 방탈출! 3` · `엄마의 번호` · [시작] | [이어하기] [처음부터] · `다른 이야기`
 *   (G.gate.titleLink) · `06:10 다시 보기` (END) · `이번 선택 남기기` (replay) · in-app web-view card — no made-by line
 *   → content warning [계속] (= G.audio.unlock()) → earphone test (bell.small 270° → 90°: [들려요] · [스피커예요] (audioMode
 *   'speaker') · [안 들려요] / 8 s → sound card [다시 듣기] [소리 없이 할게요]) → [시작] = unlock + G.audio.prepare() +
 *   introDone + G.e3.seriesStart() + G.clock.start() → '지난 이야기' (cb.E only — 4 lines on black, 3.2 s each, tap = next,
 *   [건너뛰기] → recapShown) → M0 cold open B01: M0 · 2 s black · amb.fridge 2.0 · amb.clock 4.0 · breath.jimin 6.0 ·
 *   breath.kongi + amb.air + amb.apt 8.0 · G.room.eye({view:'r3_door', fadeMs:1200}) 9.0 (resume: the 8 s version) ·
 *   director start · sched 'flow:momLine1' (M0 + 40 s) — first 270° view or that sched → 엄마 first line (cb.A / neutral) +
 *   chair.creak = momLine1 (B02) → +4 s → (calSeen0 or +15 s) · 엄마 taps 1 · 2 · then the caption line.
 * Pause menu ⏸ (hook 'pause:open'): G.clock.pause() + bus 'pause' {open:true}; close → G.clock.resume().
 * Also defines G.flow — the private helper set the other flow files (call · ending · hook · main) share: card play through
 *   core G.cards (fallback renderer for partial builds), chip ask, eye view through room G.room.eye (fallback layer), timers.
 * Layers: `.fl3-scene` z 200 (title · warning · ear test · recap · pause) · fallback eye `.fl3-eyefb` z 45 · fallback cards
 *   `.fl3-fcard` z 150. No player-facing text outside DESIGN (G.STORY.cards · G.e3.STR · G.e3.MONO).
 * API: G.scenes = { init(), title(), warn(), coldOpen({resume}), recap(), pause(), closePause(), isPauseOpen(), titleUp(),
 *                   inGame(), eye() → eyeApi|null, abort(), momBusy() }
 * Flags set: introDone recapShown M0 momLine1 · vars: momTaps (+ fl.recanonDone) · marks B00 B01 B02 · settings: audioMode (test),
 *   pause options. Sched: 'flow:momLine1'. Hooks set: 'pause:open'. Bus listened: room:view · room:spot.
 * data-qa: title.start title.continue title.restart title.hookReplay title.recanon title.series(gate) title.inapp.ok warn.ok
 *   ear.ok ear.speaker ear.none ear.retry ear.silent ear.start recap.skip pause.resume pause.title pause.opt:<key>:<value>
 *   dialog.btn:cancel|erase|change
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const SC = (G.scenes = G.scenes || {});

  /* =====================================================================
   * G.flow — shared flow helpers
   * ===================================================================== */
  const FL = (G.flow = G.flow || {});
  function el(tag, attrs, ...kids) {
    if (G.util && G.util.el) return G.util.el(tag, attrs, ...kids);
    const m = String(tag).match(/^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i);
    const n = document.createElement((m && m[1]) || 'div');
    if (attrs != null && (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object')) { kids.unshift(attrs); attrs = null; }
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, v) => { if (t === '.') n.classList.add(v); else n.id = v; });
    if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v); else if (k === 'html') n.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v); else if (k === 'dataset') Object.assign(n.dataset, v); else n.setAttribute(k, v === true ? '' : v); }
    kids.flat(Infinity).forEach((c) => { if (c == null || c === false) return; n.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return n;
  }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[flow]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n) { try { G.flag(n, true); } catch (e) { console.error('[flow] flag', n, e); } }
  function E() { return G.ep || G.e3 || G.e2 || null; }
  function cb(k) { return safe(() => { const e = E(); return e && e.cb ? e.cb(k) : undefined; }, undefined); }
  function vars() { return (G.state && G.state.vars) || {}; }
  function vget(k) { try { return G.vars ? G.vars(k) : vars()[k]; } catch (e) { return undefined; } }
  function vset(k, v) { try { if (G.vars) G.vars(k, v); else vars()[k] = v; } catch (e) {} }
  function flv() { const v = vars(); if (!v.fl || typeof v.fl !== 'object') v.fl = {}; return v.fl; }
  function pm() { return (G.state && G.state.playMs) || 0; }
  function pmOf(n) { return safe(() => (G.pm ? G.pm(n) : null), null); }
  function running() { try { return G.clock && G.clock.running ? !!G.clock.running() : !document.hidden; } catch (e) { return !document.hidden; } }
  function scale() { try { const s = G.clock && G.clock._scale ? G.clock._scale() : 1; return s > 0 ? s : 1; } catch (e) { return 1; } }
  /** game-running time (pause menu / hidden tab stop it; haru.time(x) speeds it like playMs) */
  function wait(ms) {
    return new Promise((res) => {
      let left = Math.max(0, ms || 0), last = performance.now();
      const step = () => {
        const now = performance.now();
        if (running()) left -= Math.min(250, now - last) * scale();
        last = now;
        if (left <= 0) res(); else setTimeout(step, Math.min(100, Math.max(16, left / scale())));
      };
      setTimeout(step, Math.min(100, Math.max(16, left)));
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));     // UI-only waits (before the clock runs)
  /** wait until pred() holds or `ms` of game time pass (polls on game time) */
  async function waitFor(pred, ms) {
    let left = ms == null ? Infinity : ms;
    while (left > 0) { if (safe(pred, false)) return true; await wait(120); left -= 120; }
    return !!safe(pred, false);
  }
  function A() { return G.audio || {}; }
  function cue(id, o) { return safe(() => (A().cue ? A().cue(id, o || {}) : undefined)); }
  function sub(id, o) { safe(() => { if (A().sub) A().sub(id, o || {}); }); }
  function amb(id, on, o) { safe(() => { if (A().amb) A().amb(id, on, o || {}); }); }
  function unlock() { return safe(() => (A().unlock ? A().unlock() : Promise.resolve(false)), Promise.resolve(false)); }
  function mark(id) { safe(() => G.director && G.director.mark && G.director.mark(id)); }
  function sfxTap() { safe(() => A().sfx && A().sfx.tap && A().sfx.tap()); }
  function scr() { return document.getElementById('screen'); }
  function img(key) { return safe(() => { const e = E(); return e && e.img ? e.img(key) : (G.IMG && G.IMG[key]) || ''; }, ''); }
  function STR(k) { return safe(() => { const e = E(); return (e && e.STR && e.STR[k]) || ''; }, ''); }
  function saveSettings() { safe(() => (G.saveSettings ? G.saveSettings() : null)); }
  function C() { return (G.STORY && G.STORY.cards) || {}; }
  function sched() { const e = E(); return e && e.sched ? e.sched : null; }
  function scene(cls, attrs) { const n = el('div.fl3-scene' + (cls ? '.' + cls : ''), attrs || null); (scr() || document.body).appendChild(n); requestAnimationFrame(() => n.classList.add('in')); return n; }
  function removeScene(n, ms) { if (!n) return; n.classList.remove('in'); n.classList.add('out'); setTimeout(() => n.remove(), ms || 500); }

  /** resolve a DESIGN data step list now: lazy texts (cb) → string, null/empty → dropped; plain strings = 엄마 name cards */
  function prep(steps, who) {
    const out = [];
    (Array.isArray(steps) ? steps : [steps]).forEach((s) => {
      if (s == null) return;
      if (typeof s === 'string') { out.push({ who: who === undefined ? '엄마' : who, text: s }); return; }
      if (typeof s === 'function') { const r = safe(() => s(cb), null); if (r != null) prep(r, who).forEach((x) => out.push(x)); return; }
      if (s.chips || s.run || s.wait != null || s.when) { out.push(Object.assign({}, s)); return; }
      let t = s.text;
      if (typeof t === 'function') t = safe(() => t(cb), null);
      if (Array.isArray(t)) { t.forEach((x) => out.push(Object.assign({}, s, { text: x }))); return; }
      if (t == null || t === '') return;
      out.push(Object.assign({}, s, { text: String(t) }));
    });
    return out;
  }

  /* ---------- fallback card layer (only when core's G.cards is missing — partial builds) ---------- */
  const FB = {
    root: null, removeBack: null, tapper: null,
    open() {
      if (this.root && this.root.isConnected) return this.root;
      this.root = el('div.fl3-fcard', { 'data-qa': 'card' });
      (scr() || document.body).appendChild(this.root);
      requestAnimationFrame(() => this.root && this.root.classList.add('in'));
      this.removeBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => { if (FB.tapper) FB.tapper(); return true; }) : null), null);
      return this.root;
    },
    close() {
      const r = this.root; this.root = null; this.tapper = null;
      if (typeof this.removeBack === 'function') safe(this.removeBack); this.removeBack = null;
      if (r) { r.classList.remove('in'); setTimeout(() => r.remove(), 400); }
    },
    async line(step) {
      const root = this.open();
      root.innerHTML = '';
      const box = el('div.fl3-fbox' + (step.who ? '.named' : ''), { 'data-qa': 'card.next', role: 'button', tabindex: '0' },
        step.who ? el('b.fl3-fwho', null, step.who) : null, el('div.fl3-ftext', null, T(step.text)));
      root.appendChild(box);
      const len = String(T(step.text)).length;
      let tapped = false;
      await new Promise((res) => {
        this.tapper = () => { if (!tapped) { tapped = true; res(); } };
        box.addEventListener('click', () => { sfxTap(); this.tapper && this.tapper(); });
        if (step.tap === false) this.tapper = () => {};
        wait(Math.min(9000, len * 70) + (step.gapMs != null ? step.gapMs : 1600)).then(res);
      });
    },
    async chips(step) {
      const root = this.open();
      root.innerHTML = '';
      const row = el('div.fl3-fchips');
      root.appendChild(row);
      return await new Promise((res) => {
        let done = false;
        const fin = (pick) => { if (done) return; done = true; row.remove(); res(pick); };
        (step.chips || []).forEach((c) => {
          row.appendChild(el('button.fl3-fchip', { 'data-qa': 'chip.opt:' + c.id, onclick: () => { sfxTap(); fin({ id: c.id, text: c.label, edited: false }); } }, T(c.label) + (c.edit ? ' ✎' : '')));
        });
        if (step.timeoutMs) wait(step.timeoutMs).then(() => fin(step.timeoutPick ? { id: step.timeoutPick, text: '', edited: false } : null));
      });
    },
  };
  async function fallbackPlay(script, opts) {
    const picks = {};
    try {
      for (let i = 0; i < script.length; i++) {
        const s = script[i];
        if (s.when) { if (!safe(() => s.when(picks), true)) i++; continue; }
        if (opts && opts.onStep) safe(() => opts.onStep(s, i));
        if (s.wait != null) { await wait(s.wait); continue; }
        if (s.run) { await Promise.resolve(safe(() => s.run({ picks }), null)); continue; }
        if (s.chips) { picks[s.id] = await FB.chips(s); continue; }
        await FB.line(s);
      }
    } finally { FB.close(); }
    return { picks, aborted: false };
  }
  /** play a card script through core G.cards (ARCH_EP3 §5.6) — the shape every flow caller uses */
  FL.play = function (script, opts) {
    const s = prep(script);
    opts = Object.assign({ mode: 'story' }, opts || {});
    if (!s.length) return Promise.resolve({ picks: {}, aborted: false });
    if (G.cards && typeof G.cards.play === 'function') {
      return Promise.resolve(safe(() => G.cards.play(s, opts), null)).then((r) => r || { picks: {}, aborted: false }).catch((e) => { console.error('[flow] cards', e); return { picks: {}, aborted: true }; });
    }
    return fallbackPlay(s, opts);
  };
  FL.ask = function (step) {
    if (G.chips && typeof G.chips.ask === 'function') return Promise.resolve(safe(() => G.chips.ask(step), null)).catch(() => null);
    return fallbackPlay([step], {}).then((r) => r.picks[step.id] || null);
  };
  FL.cardsShowing = function () { return safe(() => !!((G.cards && G.cards.showing && G.cards.showing()) || (FB.root && FB.root.isConnected)), false); };
  FL.closeCards = function (reason) { safe(() => G.cards && G.cards.close && G.cards.close({ reason: reason || 'replace' })); safe(() => G.chips && G.chips.close && G.chips.close(reason || 'replace')); FB.close(); };

  /* ---------- eye views (room G.room.eye — fallback layer for partial builds) ---------- */
  function fbEye(o) {
    const root = el('div.fl3-eyefb', { 'data-qa': 'room.eye', tabindex: '-1' });
    const pic = el('div.fl3-eyefb-pic');
    const scrN = el('div.fl3-eyefb-screen');
    root.append(pic, scrN);
    (scr() || document.body).appendChild(root);
    safe(() => scr() && scr().classList.add('eye-mode'));
    let cur = {};
    const draw = (k) => { const src = img(k); pic.style.backgroundImage = src ? `url("${src}")` : ''; pic.classList.toggle('noimg', !src); };
    const api = {
      _fb: true,
      show(x) {
        x = x || {};
        cur = { view: x.view || null, closeup: x.closeup || null };
        root.dataset.view = cur.view || cur.closeup || '';
        if (cur.closeup) root.dataset.closeup = cur.closeup; else delete root.dataset.closeup;
        draw(cur.closeup || cur.view);
        scrN.classList.toggle('on', /^c3_phone_ring/.test(cur.closeup || ''));
        return wait(x.ms != null ? x.ms : 400);
      },
      spots() {}, screenNode() { return scrN.classList.contains('on') ? scrN : null; },
      dim(level, ms) { pic.style.transition = `opacity ${(ms || 600) / 1000}s`; pic.style.opacity = String(1 - (+level || 0)); return wait(ms || 600); },
      close(ms) { root.classList.add('out'); setTimeout(() => { root.remove(); if (!document.querySelector('#screen > .fl3-eyefb')) safe(() => scr() && scr().classList.remove('eye-mode')); }, ms || 400); return wait(ms || 400); },
      state() { return Object.assign({}, cur); },
    };
    api.show({ view: o.view, closeup: o.closeup, ms: 0 });
    requestAnimationFrame(() => root.classList.add('in'));
    return api;
  }
  /** open an eye view (z 45 — ARCH_EP3 §5.12) */
  FL.eye = function (o) {
    o = Object.assign({ fadeMs: 400, spots: false }, o || {});
    if (G.room && typeof G.room.eye === 'function') {
      const api = safe(() => G.room.eye(o), null);
      if (api) return api;
    }
    return fbEye(o);
  };
  FL.eyeShow = function (eye, x) { return safe(() => (eye && eye.show ? Promise.resolve(eye.show(x)).catch(() => null) : Promise.resolve()), Promise.resolve()); };
  FL.eyeClose = function (eye, ms) { return safe(() => (eye && eye.close ? Promise.resolve(eye.close(ms)).catch(() => null) : Promise.resolve()), Promise.resolve()); };
  FL.roomSet = function (key, v, o) { safe(() => G.room && G.room.set && G.room.set(key, v, o || {})); };

  Object.assign(FL, { el, T, safe, flag, setFlag, E, cb, vget, vset, flv, pm, pmOf, running, wait, sleep, waitFor, cue, sub, amb, unlock, mark,
    sfxTap, scr, img, STR, prep, sched, scene, removeScene, saveSettings });

  /* in-scene confirm (system dialogs sit under the z-200 scenes, so the title draws its own) */
  function confirmBox(host, text, buttons) {
    return new Promise((res) => {
      const box = el('div.fl3-confirm', { role: 'dialog' }, el('div.fl3-confirm-in', null, el('p', null, T(text)),
        el('div.fl3-confirm-btns', null, buttons.map((b) => el('button.fl3-btn' + (b.primary ? '.primary' : ''), { 'data-qa': 'dialog.btn:' + b.qa, onclick: () => { sfxTap(); box.remove(); res(b.value); } }, b.label)))));
      host.appendChild(box);
    });
  }

  /* =====================================================================
   * TITLE (B00 · §3.0 · §4.0 · §4.12.7)
   * ===================================================================== */
  let titleEl = null;
  SC.titleUp = function () { return !!titleEl; };
  SC._dropTitle = function () { titleEl = null; };
  SC.inGame = function () { return flag('introDone') && !titleEl && !preEl; };
  SC.title = function () {
    if (titleEl) return titleEl;
    safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
    const d = C().title || {};
    const f = (G.state && G.state.flags) || {};
    const has = !!f.introDone, ended = !!f.END, hooked = !!f.HOOK;
    const v0 = vars();
    const replay = !!v0.replay, committed = !!v0.committed, recanonDone = !!(v0.fl && v0.fl.recanonDone);
    const nameLine = T(d.name || '{N를} 위한 방탈출! 3');
    const cut = nameLine.lastIndexOf(' 위한 ');
    const nameNode = cut > 0
      ? el('h1.fl3-t-name', null, nameLine.slice(0, cut + 3), el('br'), el('em', null, nameLine.slice(cut + 4)))
      : el('h1.fl3-t-name', null, nameLine);
    const btns = el('div.fl3-t-btns');
    const smalls = el('div.fl3-t-smalls');
    if (has && !hooked) btns.appendChild(el('button.fl3-btn.primary', { 'data-qa': 'title.continue', onclick: () => cont() }, d.cont || '이어하기'));
    // mid-game: [이어하기] [시작] (§4.0 — 시작 over a save = the 처음부터 confirm) · after the hook: [처음부터] (§9.2)
    if (has) btns.appendChild(el('button.fl3-btn' + (hooked ? '.primary' : ''), { 'data-qa': 'title.restart', onclick: () => restart() }, hooked ? (d.fresh || '처음부터') : (d.start || '시작')));
    else btns.appendChild(el('button.fl3-btn.primary', { 'data-qa': 'title.start', onclick: () => { sfxTap(); fresh(); } }, d.start || '시작'));
    if (ended) smalls.appendChild(el('button.fl3-small', { 'data-qa': 'title.hookReplay', onclick: () => hookReplay() }, d.hookReplay || '06:10 다시 보기'));
    const recanonBtn = ended && replay && committed && !recanonDone
      ? el('button.fl3-small', { 'data-qa': 'title.recanon', onclick: () => recanon() }, d.recanon || '이번 선택 남기기') : null;
    const note = recanonBtn ? el('div.fl3-t-note', { role: 'status', 'aria-live': 'polite' }) : null;
    if (recanonBtn) smalls.append(recanonBtn, note);
    const bg = el('div.fl3-t-bg');
    const src = img('t3_title');
    if (src) bg.style.backgroundImage = `url("${src}")`;
    titleEl = scene('fl3-title', { 'aria-label': nameLine });
    titleEl.append(bg, el('div.fl3-t-in', null,
      nameNode,
      el('div.fl3-t-sub', null, d.sub || '엄마의 번호'),
      btns,
      smalls));
    // `다른 이야기` — gate.js owns the link; a stand-in only if it drew nothing
    safe(() => { if (G.gate && typeof G.gate.titleLink === 'function') G.gate.titleLink(smalls); });
    requestAnimationFrame(() => {
      if (!titleEl || titleEl.querySelector('[data-qa="title.series"]')) return;
      smalls.appendChild(el('a.fl3-small', { 'data-qa': 'title.series', href: '../series/' + (location.protocol === 'file:' ? 'index.html' : '') }, d.series || '다른 이야기'));
    });
    const ua = String(navigator.userAgent || '');
    if (!G.APP && /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua)) {
      const ia = d.inapp || [];
      const txt = /KAKAOTALK/i.test(ua) ? String(ia[0] || '') : String(ia[0] || '').replace('카카오톡', '이 앱');
      const card = el('div.fl3-confirm.fl3-inapp', null, el('div.fl3-confirm-in', null, el('p', null, txt),
        el('div.fl3-confirm-btns', null, el('button.fl3-btn', { 'data-qa': 'title.inapp.ok', onclick: () => card.remove() }, ia[1] || '그냥 할래요'))));
      titleEl.appendChild(card);
    }
    return titleEl;

    function cont() {
      sfxTap();
      unlock();
      const t = titleEl; titleEl = null; removeScene(t, 900);
      safe(() => (G.main && G.main.resumeFrom ? G.main.resumeFrom(G.state, { fromTitle: true }) : null));
    }
    async function restart() {
      sfxTap();
      const ok = await confirmBox(titleEl, STR('restart3') || '{$restart3}',
        [{ label: d.cancel || '취소', value: false, qa: 'cancel' }, { label: d.erase || '지우기', value: true, primary: true, qa: 'erase' }]);
      if (!ok) return;
      safe(() => G.resetSave && G.resetSave());
      safe(() => { const e = E(); if (e && e.session && e.session.clear) e.session.clear(); });
      try { location.hash = 'start'; } catch (e) {}
      location.reload();
    }
    async function hookReplay() {
      sfxTap();
      unlock();
      const t = titleEl; titleEl = null; removeScene(t, 600);
      safe(() => G.clock && G.clock.start && G.clock.start());
      await sleep(400);
      safe(() => G.hook && (G.hook.replay ? G.hook.replay() : G.hook.start({ replay: true })));
    }
    async function recanon() {
      sfxTap();
      const ok = await confirmBox(titleEl, STR('recanonQ') || '{$recanonQ}',
        [{ label: d.cancel || '취소', value: false, qa: 'cancel' }, { label: d.change || '바꾸기', value: true, primary: true, qa: 'change' }]);
      if (!ok) return;
      const v = vars();
      const tries0 = v.commitTries | 0;
      const done = !!safe(() => { const e = E(); return e && e.commit ? e.commit({ overwrite: true }) : false; }, false) && (v.commitTries | 0) === tries0;
      if (!done) return;                         // failure: nothing changes, no text (§4.12.7)
      flv().recanonDone = true;
      safe(() => { const e = E(); if (e && e.hookPatch) e.hookPatch(true); });   // ⑤ after the overwrite (§9.3 ⑥) — monotone
      safe(() => G.save && G.save(true));
      if (recanonBtn && recanonBtn.parentNode) recanonBtn.remove();
      if (!note) return;
      note.textContent = d.recanonDone || '바꿨어요.';
      note.classList.add('in');
      setTimeout(() => { note.classList.add('fade'); setTimeout(() => { note.classList.remove('in', 'fade'); note.textContent = ''; }, 800); }, 3000);
    }
  };
  function fresh() {
    const t = titleEl; titleEl = null; removeScene(t, 500);
    if (G.hasSave && safe(() => G.hasSave(), false) && !flag('introDone')) safe(() => G.resetSave && G.resetSave());
    SC.warn();
  }

  /* =====================================================================
   * CONTENT WARNING → EARPHONE TEST → [시작]
   * ===================================================================== */
  let preEl = null;
  SC.warn = function () {
    if (preEl) preEl.remove();
    const w = C().warn || [];
    preEl = scene('fl3-pre');
    preEl.appendChild(el('div.fl3-pre-in', null,
      el('div.fl3-warn', null, el('p', null, w[0] || '')),
      el('button.fl3-btn.primary.wide', { 'data-qa': 'warn.ok', onclick: () => { unlock(); sfxTap(); earTest(); } }, w[w.length - 1] || '계속')));
  };

  function earTest() {
    if (!preEl) preEl = scene('fl3-pre');
    preEl.innerHTML = '';
    const d = C().ear || {};
    const okB = el('button.fl3-ear-ok', { 'data-qa': 'ear.ok' }, d.ok || '들려요');
    const spk = el('button.fl3-small', { 'data-qa': 'ear.speaker' }, d.speaker || '스피커예요');
    const none = el('button.fl3-small', { 'data-qa': 'ear.none' }, d.none || '안 들려요');
    const start = el('button.fl3-btn.primary.wide', { 'data-qa': 'ear.start', disabled: true }, d.start || '시작');
    const wave = el('div.fl3-ear-wave', { 'aria-hidden': 'true' }, el('i.l'), el('i.c'), el('i.r'));
    const guide = el('div.fl3-ear-guide', { 'aria-live': 'polite' }, d.line || '종소리를 들어 보세요.');
    const inner = el('div.fl3-pre-in.fl3-ear', null,
      el('div.fl3-ear-head', null, d.head || ''),
      guide,
      wave, okB,
      el('div.fl3-ear-alt', null, spk, none),
      start);
    preEl.appendChild(inner);

    let done = false, timer = 0, card = null, ringT = 0;
    const cardUp = () => !!(card && card.isConnected);
    const s = G.settings || (G.settings = {});
    const finish = (mode) => {
      done = true; clearTimeout(timer); clearTimeout(ringT);
      s.audioMode = mode; saveSettings();
      okB.disabled = true;
      inner.classList.add('done');
      guide.style.minHeight = guide.offsetHeight + 'px';
      guide.textContent = mode === 'ear' ? '✓ 이어폰' : '스피커';
      guide.classList.add('res');
      spk.disabled = true; none.disabled = true;
      start.disabled = false;
      requestAnimationFrame(() => start.classList.add('ready'));
    };
    const armSilence = () => { clearTimeout(timer); timer = setTimeout(() => { if (!done) soundCard(); }, 8000); };
    /** the small hand bell passes from 270° to 90° (§3.0 · §6.2 B00 — head-locked, 1.0 m) */
    const bell = () => {
      if (done || cardUp()) return;
      inner.dataset.ring = 'l'; cue('bell.small', { az: 270 });
      clearTimeout(ringT);
      ringT = setTimeout(() => { if (done || cardUp()) return; inner.dataset.ring = 'r'; cue('bell.small', { az: 90 }); }, 900);
      armSilence();
    };
    okB.addEventListener('click', () => { if (done || cardUp()) return; sfxTap(); finish('ear'); });
    spk.addEventListener('click', () => { if (done) return; sfxTap(); finish('speaker'); });
    none.addEventListener('click', () => { if (done) return; sfxTap(); soundCard(); });
    start.addEventListener('click', () => { if (start.disabled) return; sfxTap(); begin(); });
    function soundCard() {
      clearTimeout(timer);
      if (cardUp() || done || !preEl) return;
      const close = () => { if (card) card.remove(); card = null; };
      card = el('div.fl3-confirm', { role: 'dialog' }, el('div.fl3-confirm-in', null,
        el('p', null, T(d.soundCard || '{$soundCard}')),
        el('div.fl3-confirm-btns', null,
          el('button.fl3-btn', { 'data-qa': 'ear.retry', onclick: () => { sfxTap(); close(); unlock(); setTimeout(() => bell(), 500); } }, d.retry || '다시 듣기'),
          el('button.fl3-btn', { 'data-qa': 'ear.silent', onclick: () => { sfxTap(); close(); s.subs = 'all'; finish('speaker'); } }, d.silent || '소리 없이 할게요'))));
      preEl.appendChild(card);
    }
    setTimeout(() => { if (!done) bell(); }, 700);
  }

  async function begin() {
    unlock();
    safe(() => A().prepare && A().prepare());
    setFlag('introDone');
    safe(() => { const e = E(); if (e && e.seriesStart) e.seriesStart(); });
    safe(() => G.clock && G.clock.start && G.clock.start());
    mark('B00');
    safe(() => G.save && G.save(true));
    const p = preEl; preEl = null;
    const black = scene('fl3-black');
    black.classList.add('in');
    if (p) removeScene(p, 400);
    if (cb('E') && !flag('recapShown')) await SC.recap(black);
    await SC.coldOpen({ black });
  }

  /* =====================================================================
   * '지난 이야기' — 4 lines on black (notebook hand · 3.2 s each · tap = next · [건너뛰기]) — §3.0 · §4.0 R1
   * ===================================================================== */
  const RECAP_FALLBACK = ['두 달 전 24일, 404호. 나는 세아의 폰으로 문을 열고 나왔다.',
    '지난달 24일, 그 사람이 내 옛 폰을 돌려줬다. 한 달 동안 나인 척 살던 폰이었다.',
    '크리스마스 새벽, 세아의 계정에서 음성 메시지가 왔다. 오르골을 흥얼거리는 소리였다.',
    '세아는 아직 돌아오지 않았다. 오늘은 세아 엄마의 집에서 잔다.'];
  SC.recap = async function (host) {
    const lines = safe(() => { const e = E(); return e && e.MONO && Array.isArray(e.MONO.recap) && e.MONO.recap.length ? e.MONO.recap : null; }, null) || RECAP_FALLBACK;
    const own = !host;
    host = host || scene('fl3-black');
    host.classList.add('fl3-recap');
    safe(() => G.director && G.director.hold && G.director.hold('recap', true));
    let skipped = false, wake = null;
    const skip = el('button.fl3-skip', { 'data-qa': 'recap.skip' }, (C().recap && C().recap.skip) || '건너뛰기');
    skip.addEventListener('click', (e) => { e.stopPropagation(); if (skipped) return; skipped = true; sfxTap(); skip.remove(); if (wake) wake(); });
    const tapNext = () => { if (wake) wake(); };
    host.addEventListener('click', tapNext);
    host.appendChild(skip);
    const lineEl = el('div.fl3-recap-line', { 'aria-live': 'polite' });
    host.appendChild(lineEl);
    const core = safe(() => { const e = E(); return e && typeof e.mono === 'function' && typeof e.recapNext === 'function' && typeof e.recapSkip === 'function' ? e : null; }, null);
    try {
      if (core) {
        // core's monologue channel renders the 4 lines (G.e3.mono('recap') — tap = recapNext, [건너뛰기] = recapSkip)
        const p = Promise.resolve(safe(() => core.mono('recap'), false)).catch(() => false);
        wake = () => { if (skipped) safe(() => core.recapSkip()); else safe(() => core.recapNext()); };
        await p;
      } else for (const line of lines) {
        if (skipped) break;
        await new Promise((res) => { wake = res; setTimeout(res, 450); });
        if (skipped) break;
        lineEl.textContent = T(line);
        lineEl.classList.add('in');
        await new Promise((res) => { wake = res; setTimeout(res, 3200); });
        lineEl.classList.remove('in');
      }
    } finally {
      wake = null;
      host.removeEventListener('click', tapNext);
      if (skip.parentNode) skip.remove();
      setTimeout(() => lineEl.remove(), 700);
      setFlag('recapShown');
      safe(() => G.director && G.director.hold && G.director.hold('recap', false));
    }
    if (own) removeScene(host);
    await sleep(skipped ? 300 : 900);
  };

  /* =====================================================================
   * M0 COLD OPEN — B01 (§3.1 · §6.2 B01) → eye view r3_door → 엄마 (B02)
   * ===================================================================== */
  let gen = 0, coldRunning = false, eyeApi = null;
  SC.eye = function () { return eyeApi; };
  SC._setEye = function (e) { eyeApi = e; };
  SC.abort = function () { gen++; coldRunning = false; momGen++; momBusy = false; };
  SC.coldOpen = async function (opts) {
    opts = opts || {};
    if (coldRunning) return;
    coldRunning = true;
    const my = ++gen;
    try {
      safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
      const black = opts.black || scene('fl3-black');
      black.classList.add('in');
      const resume = !!opts.resume || flag('M0');
      if (!flag('M0')) setFlag('M0');
      safe(() => G.director && G.director.start && G.director.start());
      ensureMomSched();
      safe(() => G.call && G.call.arm && G.call.arm());
      safe(() => A().setYaw && A().setYaw(0));
      // sound first — one layer every 2 s (§3.1 · §6.2 B01); resume = the shortened 8 s version (§3.22)
      const L = resume ? [0.8, 1.9, 3.0, 4.1, 5.2, 6.8] : [2.0, 4.0, 6.0, 8.0, 9.0, 0];
      let t = 0;
      const at = async (sec) => { await wait((sec - t) * 1000); t = sec; return my === gen; };
      if (!(await at(L[0]))) return;
      amb('amb.fridge', true, { fade: 1.5 }); if (!resume) sub('S15', { az: 255 });
      if (!(await at(L[1]))) return;
      amb('amb.clock', true, { fade: 1.5 }); if (!resume) sub('S16', { az: 180 });
      if (!(await at(L[2]))) return;
      if (!flag('jiminUp')) amb('breath.jimin', true, { fade: 1.5 });
      if (!resume) sub('S17a', { az: 185 });
      if (!(await at(L[3]))) return;
      amb('breath.kongi', true, { fade: 1.5 }); amb('amb.air', true, { fade: 1.5 }); amb('amb.apt', true, { fade: 1.5 });
      if (!resume) sub('S17b', { az: 30 });
      if (!(await at(L[4]))) return;
      // 9.0 s — the 0° eye view fades in (03:20 grading · the table lamp at 270° is the only warm light)
      eyeApi = FL.eye({ view: 'r3_door', fadeMs: resume ? 900 : 1200, spots: true });
      if (!resume) mark('B01');
      removeScene(black, resume ? 900 : 1400);
      safe(() => G.notebook && G.notebook.show && G.notebook.show(true));
      if (flag('momLine1')) momLineDone = true;
    } finally { if (my === gen) coldRunning = false; }
  };

  /* ---------- 엄마 (B02 · §3.1 · §4.1.2) ---------- */
  let momGen = 0, momBusy = false, momLineDone = false;
  SC.momBusy = function () { return momBusy; };
  function preroll() { const s = vars().seq; return !!(s && s.m1) || flag('M1'); }
  function ensureMomSched() {
    if (flag('momLine1') || !flag('M0')) return;
    const sc = sched(), t0 = pmOf('M0');
    if (!sc || t0 == null) { const left = Math.max(0, (t0 == null ? pm() : t0) + 40000 - pm()); wait(left).then(() => firstLine()); return; }
    if (!safe(() => sc.has('flow:momLine1'), false)) safe(() => sc.at(t0 + 40000, 'flow:momLine1'));
  }
  async function firstLine() {
    if (flag('momLine1') || momBusy || preroll() || !flag('M0')) return;
    const my = momGen;
    momBusy = true;
    try {
      const m = C().m0 || {};
      safe(() => { const sc = sched(); if (sc && sc.cancel) sc.cancel('flow:momLine1'); });
      mark('B02');
      cue('chair.creak', { src: 'momSeat' });   // 엄마 turns toward {N} (270° 2.6 m)
      const then = m.momThen || [];
      await FL.play([{ id: 'momFirst', who: '엄마', text: m.momFirst, gapMs: 1000 }, { id: 'momThen1', who: '엄마', text: then[0] }],
        { id: 'flow:m0', onStep: (s) => { if (s && s.id === 'momFirst') setFlag('momLine1'); } });
      setFlag('momLine1');
      if (my !== momGen) return;
      // the third line once the calendar was seen, or 15 s later
      await waitFor(() => flag('calSeen0') || my !== momGen, 15000);
      if (my !== momGen || preroll()) return;
      await FL.play([{ id: 'momThen2', who: '엄마', text: then[1] }], { id: 'flow:m0' });
      momLineDone = true;
    } finally { if (my === momGen) momBusy = false; }
  }
  async function momTap() {
    if (!flag('M0') || preroll() || flag('handover')) return;
    // vars.momTaps = every tap on 엄마 (§2.5 · §11.2 ≥ 3 — the tap that brings her first line counts, and so does one made
    // while her line chain is still running); the line order uses its own counter (fl.momLine) so no line is skipped
    vset('momTaps', (vget('momTaps') | 0) + 1);
    if (!flag('momLine1')) { firstLine(); return; }
    if (momBusy) return;
    const m = C().m0 || {};
    const fl = flv(), n = fl.momLine | 0;
    fl.momLine = n + 1;
    const taps = m.momTaps || [];
    const my = momGen;
    momBusy = true;
    try {
      if (n < taps.length) await FL.play([{ id: 'momTap' + (n + 1), who: '엄마', text: taps[n] }], { id: 'flow:m0' });
      else {
        // 3rd tap on: the caption line (room's caption channel when it offers one, else a situation card)
        const cap = m.momTapCaption || '';
        if (G.room && typeof G.room.caption === 'function') safe(() => G.room.caption(cap, { spot: 'mom' }));
        else await FL.play([{ id: 'momCap', who: null, text: cap }], { id: 'flow:m0' });
      }
    } finally { if (my === momGen) momBusy = false; }
  }
  function onView(e) {
    if (!e || flag('momLine1') || !flag('M0') || preroll()) return;
    if (e.view === 'r3_kitchen' && !e.closeup) firstLine();
  }
  function onSpot(e) { if (e && e.id === 'mom') momTap(); }

  /* =====================================================================
   * PAUSE MENU ⏸ (§4.0 일시정지) — the game clock stops (sched · director · playMs all ride on it)
   * ===================================================================== */
  let pauseEl = null, pauseBack = null;
  SC.isPauseOpen = function () { return !!pauseEl; };
  SC.pause = function () {
    if (pauseEl || titleEl || preEl || !flag('introDone')) return;
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    safe(() => G.clock && G.clock.pause && G.clock.pause());
    safe(() => G.bus && G.bus.emit('pause', { open: true }));
    const s = G.settings || {};
    const d = C().pause || {};
    const rows = d.rows || [];
    const seg = (key, opts, o) => {
      o = o || {};
      const box = el('div.fl3-seg');
      const pick = () => {
        if (!o.nearest) return String(s[key]);
        const cur = Number(s[key]) || o.dflt || 0;
        return String(opts.reduce((a, [v]) => (Math.abs(v - cur) < Math.abs(a - cur) ? v : a), opts[0][0]));
      };
      const draw = () => { const v = pick(); box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', v === b.dataset.v)); };
      opts.forEach(([v, label]) => {
        const b = el('button', { 'data-qa': `pause.opt:${key}:${v}`, dataset: { v: String(v) } }, label);
        b.addEventListener('click', () => { sfxTap(); s[key] = v; saveSettings(); draw(); });
        box.appendChild(b);
      });
      draw();
      return box;
    };
    const toggle = (key, label) => {
      const b = el('button.fl3-tog');
      const draw = () => { const on = !!s[key]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.dataset.qa = `pause.opt:${key}:${!on}`; };
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', () => { sfxTap(); s[key] = !s[key]; saveSettings(); draw(); });
      draw();
      return b;
    };
    const R = (i) => rows[i] || [];
    const row = (label, ctl, note) => el('div.fl3-prow', null, el('span.fl3-plabel', null, label), ctl, note ? el('p.fl3-pnote', null, note) : null);
    const resume = el('button.fl3-btn.primary.wide', { 'data-qa': 'pause.resume', onclick: () => { sfxTap(); SC.closePause(); } }, d.resume || '계속하기');
    const toTitle = el('button.fl3-btn.wide', { 'data-qa': 'pause.title', onclick: () => { sfxTap(); toTitleScreen(); } }, d.title || '처음 화면으로');
    pauseEl = scene('fl3-pause', { role: 'dialog' });
    pauseEl.appendChild(el('div.fl3-pause-in', null,
      el('div.fl3-pause-head', null, d.head || '일시정지'),
      resume,
      el('div.fl3-prows', null,
        row(R(0)[0], seg('scares', [['full', R(0)[1]], ['light', R(0)[2]]])),
        row(R(1)[0], seg('textSize', [[0.9, R(1)[1]], [1, R(1)[2]], [1.15, R(1)[3]]], { nearest: true, dflt: 1 })),
        row(R(2)[0], seg('audioMode', [['ear', R(2)[1]], ['speaker', R(2)[2]]]), '목소리는 AI 음성입니다.'),
        row(R(3)[0], seg('subs', [['info', R(3)[1]], ['all', R(3)[2]]])),
        row(R(4)[0], seg('vibration', [[true, R(4)[1]], [false, R(4)[2]]])),
        row(R(5)[0], el('div.fl3-togs', null, toggle('reduceShake', R(5)[1]), toggle('reduceFlash', R(5)[2])))),
      toTitle));
    pauseBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => { SC.closePause(); return true; }) : null), null);
  };
  SC.closePause = function () {
    if (!pauseEl) return;
    const p = pauseEl; pauseEl = null;
    if (typeof pauseBack === 'function') safe(pauseBack); pauseBack = null;
    removeScene(p, 300);
    safe(() => G.clock && G.clock.resume && G.clock.resume());
    safe(() => G.bus && G.bus.emit('pause', { open: false }));
  };
  function toTitleScreen() {
    safe(() => G.save && G.save(true));
    safe(() => G.hook && G.hook.patchNow && G.hook.patchNow());
    const b = scene('fl3-black');
    setTimeout(() => { try { location.reload(); } catch (e) {} }, 400);
    return b;
  }

  /* ---------- init ---------- */
  SC.init = function () {
    if (SC._inited) return; SC._inited = true;
    safe(() => G.hooks && G.hooks.set && G.hooks.set('pause:open', () => SC.pause()));
    safe(() => { const sc = sched(); if (sc && sc.on) sc.on('flow:momLine1', () => firstLine()); });
    if (G.bus) {
      G.bus.on('room:view', onView);
      G.bus.on('room:spot', onSpot);
    }
  };
  // hook registration must not wait for boot (shell's ⏸ may be wired before main runs)
  safe(() => G.hooks && G.hooks.set && G.hooks.set('pause:open', () => SC.pause()));
})();
