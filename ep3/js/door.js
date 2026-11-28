/* =========================================================
 * 하루를 위한 방탈출! 3 — 04:40 현관 (ep3/js/door.js · owner: room) — B12 · B13 · big dread 1 · jumps 0
 * DESIGN §2.1 (M6 · M7 rows) · §2.3 증명 8 · §3.12 (table · 05:02 · 0° view · resume) · §4.11.1 · §6.1.3 (defer:'m6') ·
 * §6.2 B12/B13 + 04:40 sound ledger · §6.3 / §8.3-7 (layer changes) · §9.2 resume rows · §12.2 V15 V19 V20.
 * ARCH §5.13 (G.door) · §5.20 (sched ids door:*) · §6.4 (G.STORY.setpiece.door) · §8.3 resume · §9 G20 G25.
 *
 *   G.door = { init(), resume(), t() → seconds since the 04:40 sequence started | null }
 * Listens: bus 'm6:due' {dueAt} (core) → defer while G.director.safe('m6') is false — 3 s clear, ≤ 40 s; at 40 s the card layer
 *   closes (G.cards.close({reason:'m6'}) + G.chips.close('m6')) and M6 comes 0.4 s later · 'flag:M6' (core fallback / haru.jump)
 *   · 'flag:kang502' (→ M7 at pm(kang502) + 45 s) · 'room:view' (0° after M6 → view0AfterM6 · doorDone) · 'tick' (defer).
 * Sched (G.e3.sched, persisted): door:max · door:t<s> (t 0.9 · 2.2 · 4.4 · 9 · 11.5 · 14 · 15 · 16.5 · 18 · 30 · 46 · 100 · 140 ·
 *   152 · 176 · 182) · door:done (+60 s) · door:M7.
 * Calls: G.cards.play (story cards · the 지민 chip sheet) · G.sms.deliver('k0502') (t 176) · G.e3.momAt('hall'|'lv') ·
 *   G.room.set/led/refresh · G.audio.cue/amb/sub · G.director.safe('m6') / mark('B12'|'B13').
 * Flags set: M6 bip view0AfterM6 doorDone jiminUp jiminChipSent jimin112 patrol kongiBack M7 (core sets M6 only as its fallback;
 *   kang502 is comms' — set here only when G.sms is missing, so a partial build never soft-locks).
 * Vars: vars.m6Hold (defer start pm) · vars.seq.m6 (last step id) · vars.rm.m6base (t 0 pm when the sequence was replayed).
 * Bus out: 'door:step' {t, id}. Data-qa: none (cards are core's).
 * Strings: only G.STORY.setpiece.door (DESIGN §4.11.1 verbatim). No hint, no instruction, no scare on any failure path.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const DOOR = (G.door = G.door || {});

  /* ---------------- guarded helpers ---------------- */
  const E = () => G.ep || G.e3 || null;
  const flag = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const setFlag = (n) => { try { if (G.flag && !G.flag(n)) G.flag(n, true); } catch (e) { console.error('[door] flag', n, e); } };
  const V = () => (G.state && G.state.vars) || {};
  const pmNow = () => (G.state && typeof G.state.playMs === 'number' ? G.state.playMs : 0);
  const pmOf = (n) => { try { return G.pm ? G.pm(n) : null; } catch (e) { return null; } };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const emit = (ev, d) => { try { G.bus && G.bus.emit(ev, d); } catch (e) {} };
  const on = (ev, fn) => { try { G.bus && G.bus.on(ev, fn); } catch (e) {} };
  const cue = (id, o) => { try { G.audio && G.audio.cue && G.audio.cue(id, o || {}); } catch (e) {} };
  const amb = (id, onOff, o) => { try { G.audio && G.audio.amb && G.audio.amb(id, onOff, o || { fade: 0.8 }); } catch (e) {} };
  const sub = (id) => { try { G.audio && G.audio.sub && G.audio.sub(id); } catch (e) {} };
  const less = () => { try { return !!(E() && E().less && E().less()); } catch (e) { return false; } };
  const mark = (id) => { try { G.director && G.director.mark && G.director.mark(id); } catch (e) {} };
  const roomSet = (k, v) => { try { G.room && G.room.set && G.room.set(k, v); } catch (e) {} };
  const roomRefresh = () => { try { G.room && G.room.refresh && G.room.refresh(); } catch (e) {} };
  const momAt = (v) => { try { if (E() && E().momAt) return E().momAt(v); } catch (e) {} if (v !== undefined) V().momAt = v; return V().momAt || 'table'; };
  const SP = () => (G.STORY && G.STORY.setpiece && G.STORY.setpiece.door) || {};
  const cb = (k) => { try { return E() && E().cb ? E().cb(k) : undefined; } catch (e) { return undefined; } };
  const seq = () => { const v = V(); if (!v.seq || typeof v.seq !== 'object') v.seq = { m1: null, m6: null, m7: null, m8: null }; return v.seq; };
  const RM = () => { const v = V(); if (!v.rm || typeof v.rm !== 'object') v.rm = {}; return v.rm; };

  /* ---------------- persistent scheduler (core G.e3.sched — local in-memory fallback for partial builds) ---------------- */
  const LOCAL = { q: [], h: [] };
  const S = {
    core: () => !!(E() && E().sched && E().sched.at),
    at(at, id, data) { if (S.core()) return E().sched.at(at, id, data); S.cancel(id); LOCAL.q.push({ at, id, data }); return id; },
    cancel(id) { if (S.core()) return E().sched.cancel(id); LOCAL.q = LOCAL.q.filter((e) => (id.endsWith('*') ? e.id.indexOf(id.slice(0, -1)) !== 0 : e.id !== id)); },
    has(id) { return S.core() ? E().sched.has(id) : LOCAL.q.some((e) => e.id === id); },
    on(key, fn) { if (S.core()) E().sched.on(key, fn); LOCAL.h.push({ key, fn }); },
  };
  function localRun() {
    if (S.core() || !LOCAL.q.length) return;
    const now = pmNow();
    LOCAL.q.slice().forEach((e) => {
      if (e.at > now) return;
      LOCAL.q = LOCAL.q.filter((x) => x !== e);
      const h = LOCAL.h.find((x) => e.id.indexOf(x.key) === 0);
      if (h) try { h.fn(e.data, e.id); } catch (err) { console.error('[door] sched', e.id, err); }
    });
  }

  /* ---------------- cards (core G.cards — a silent timed stand-in only when it is missing) ---------------- */
  function play(steps, id) {
    steps = [].concat(steps).filter(Boolean);
    try {
      if (G.cards && G.cards.play) return Promise.resolve(G.cards.play(steps, { id: 'door:' + (id || '0440'), mode: 'story' })).catch((e) => { console.error('[door] cards', e); return { picks: {}, aborted: true }; });
    } catch (e) { console.error('[door] cards', e); }
    // partial build: no card layer — keep the timeline and the outcomes (timeoutPick) without drawing anything
    const picks = {};
    let ms = 0;
    steps.forEach((s) => { if (s.chips) { picks[s.id] = s.timeoutPick ? { id: s.timeoutPick } : null; ms += s.timeoutMs || 0; } else if (s.wait) ms += s.wait; else if (s.text) ms += String(typeof s.text === 'function' ? '' : s.text).length * 70 + (s.gapMs || 1600); });
    steps.forEach((s) => { if (s.run) try { s.run({ id, picks }); } catch (e) {} });
    return new Promise((r) => setTimeout(() => r({ picks, aborted: false }), Math.min(ms, 60000)));
  }

  /* ---------------- §6.1.3 defer:'m6' — S1 S2 S4 S7 S8 S9 clear for 3 s, at most 40 s ---------------- */
  function safeM6() {
    try { if (G.director && G.director.safe) return !!G.director.safe('m6'); } catch (e) {}
    // stand-in (director missing): the same six zones
    try {
      if (G.ui && G.ui.inputActive && G.ui.inputActive()) return false;
      if (G.notebook && G.notebook.isOpen && G.notebook.isOpen()) return false;
      if (G.callrec && G.callrec.state && G.callrec.state().playing) return false;
      if (G.callrec && G.callrec.sinceStopMs && G.callrec.sinceStopMs() < 2000) return false;
      if (G.cards && G.cards.showing && G.cards.showing()) return false;
      if (G.chips && G.chips.isOpen && G.chips.isOpen()) return false;
      if (G.phone && ((G.phone.inCall && G.phone.inCall()) || (G.phone.modalOpen && G.phone.modalOpen()))) return false;
    } catch (e) {}
    return true;
  }
  const DEF = { on: false, clearSince: null, forcing: false };
  function startDefer(dueAt) {
    if (flag('M6') || !flag('M5')) return;
    if (DEF.on) return;
    DEF.on = true; DEF.clearSince = null; DEF.forcing = false;
    const v = V(), p = Math.round(pmNow());
    // fresh due (core's m6:due lands ≤ one tick late) → count from dueAt itself so M6 comes at dueAt + 40.0 s, not 40 s
    // after the tick that delivered the event; on every resume the defer restarts from 0 (ARCH §8.3)
    v.m6Hold = (typeof dueAt === 'number' && dueAt <= p && p - dueAt < 1500) ? Math.round(dueAt) : p;
    save();
    S.at(v.m6Hold + 39600, 'door:max');              // the card layer closes at t −0.4 (§12.2 V19) …
    mark('B12');
  }
  function deferTick() {
    if (!DEF.on || DEF.forcing) return;
    if (flag('M6')) { DEF.on = false; return; }
    const p = pmNow();
    if (safeM6()) { if (DEF.clearSince == null) DEF.clearSince = p; if (p - DEF.clearSince >= 3000) fireM6(); }
    else DEF.clearSince = null;
    const hold = V().m6Hold;
    if (hold != null && p >= hold + 39600) forceM6();
  }
  /** … and M6 itself at hold + 40.0 s of play time (tick-driven, so a paused game does not fire it) */
  function forceTick() {
    if (!DEF.on || !DEF.forcing || flag('M6')) return;
    const hold = V().m6Hold;
    if (hold == null || pmNow() >= hold + 40000) fireM6();
  }
  function forceM6() {
    if (!DEF.on || DEF.forcing || flag('M6')) return;
    DEF.forcing = true;
    // §3.12 · §6.1.3 · §12.2 V19: the card layer's reaction chains / chip sheets close 0.4 s before t 0 (no pick · flags stay);
    // an input field inside an app (S1) stays as it is — only sound and subtitles flow over it
    try { if (G.cards && G.cards.close && G.cards.showing && G.cards.showing()) G.cards.close({ reason: 'm6' }); } catch (e) {}
    try { if (G.chips && G.chips.close && G.chips.isOpen && G.chips.isOpen()) G.chips.close('m6'); } catch (e) {}
    forceTick();                                     // (a resume past hold + 40 s fires at once)
  }

  /* ---------------- the 04:40 sequence (§3.12 table · §6.2 ledger — t from 04:40:00) ---------------- */
  const STEPS = [
    { t: 0.9, id: 'bip' }, { t: 2.2, id: 'dash' }, { t: 4.4, id: 'bark' }, { t: 9, id: 'mom9' }, { t: 11.5, id: 'hall' },
    { t: 14, id: 'kongiya' }, { t: 15, id: 'jiminWake' }, { t: 16.5, id: 'jiminQ' }, { t: 18, id: 'chip' }, { t: 30, id: 'back' },
    { t: 46, id: 'call112' }, { t: 100, id: 'jidae' }, { t: 140, id: 'patrol' }, { t: 152, id: 'patrolCall' }, { t: 176, id: 'sms' },
    { t: 182, id: 'kongiBack' },
  ];
  const idx = (id) => STEPS.findIndex((s) => s.id === id);
  const base = () => { const b = RM().m6base; return b != null ? b : (pmOf('M6') != null ? pmOf('M6') : pmNow()); };
  let running = false;

  function fireM6() {
    DEF.on = false; DEF.forcing = false;
    S.cancel('door:max');
    if (!flag('M6')) setFlag('M6');                  // → flag:M6 listener starts the sequence (also core fallback · haru.jump)
    else startSequence();
  }
  function startSequence(replay) {
    if (running || flag('M7')) return;
    if (flag('bip') && !replay) return;
    running = true;
    const rm = RM();
    rm.m6base = replay ? Math.round(pmNow()) : (pmOf('M6') != null ? pmOf('M6') : Math.round(pmNow()));
    seq().m6 = 't0';
    save();
    mark('B12'); mark('B13');
    momCheckView0();
    schedFrom(-1);
    S.at(rm.m6base + 60000, 'door:done');
    emit('door:step', { t: 0, id: 't0' });
  }
  function schedFrom(lastIdx) {
    const b = base();
    STEPS.forEach((s, i) => { if (i > lastIdx) S.at(b + Math.round(s.t * 1000), 'door:t' + s.t); });
  }
  function stepFired(t) {
    const s = STEPS.find((x) => 'door:t' + x.t === t);
    if (!s || !flag('M6')) return;
    if (flag('M7') && s.id !== 'kongiBack') return;
    const cur = seq().m6, ci = cur ? idx(cur) : -1;
    if (ci >= idx(s.id)) return;                     // already ran (resume safety)
    seq().m6 = s.id; save();
    emit('door:step', { t: s.t, id: s.id });
    try { ACT[s.id](); } catch (e) { console.error('[door] step', s.id, e); }
  }

  const P = { kongiSr: 'kongiSr', kongiDoor: 'kongiDoor', srDoor: 'srDoor', hallIn: 'hallIn', momSeat: 'momSeat' };
  const ACT = {
    /* t 0.9 — '삐삐삐' (same pitch ×3, behind the steel door) + the panel LED blinks red ×3 in the same beat (§8.3-5) */
    bip() {
      setFlag('bip');
      cue('door.err3', { src: 'keypad' });
      try { G.room && G.room.led && G.room.led('err3'); } catch (e) {}
      sub('S06');
    },
    /* t 2.2 — 콩이 dashes 30° → 0° (claws only — the collar hangs on its hook, no bell) */
    dash() {
      amb('breath.kongi', false, { fade: 0.4 });
      cue('kongi.claws', { path: [{ dt: 0, src: P.kongiSr }, { dt: 2.0, src: P.kongiDoor }] });
      roomSet('kongi', 'door');
      sub('S23run');
    },
    /* t 4.4 — two short barks (덜 무섭게: one — audio) */
    bark() { cue('kongi.bark2', { src: P.kongiDoor }); sub(less() ? 'S07less' : 'S07'); },
    /* t 9 — 세아 방 door hinge · 엄마 leaves the bed (her slippers lead the picture) */
    mom9() {
      cue('door.sr', { src: P.srDoor });
      sub('S18door');
      if ((V().where || 'lv') === 'sr') cue('bed.creak', { src: 'srMom' });
      cue('mom.slippers', { path: [{ dt: 0, src: P.srDoor }, { dt: 2.5, src: P.hallIn }] });
      roomSet('srGap', 0.35);
      roomSet('momPos', 'moving');
    },
    /* t 11.5 — 04:40:11 엄마 stands at the door, does not touch it */
    hall() {
      momAt('hall');
      roomSet('momPos', null);
      roomRefresh();
      cue('cloth.rustle', { src: P.hallIn });
      play(SP().t11, '0440');
    },
    kongiya() { play(SP().t14, '0440'); },
    /* t 15 — 지민 wakes: the sofa empties (she leaves the frame toward the kitchen) */
    jiminWake() {
      cue('jimin.wake', { src: 'sofa' });
      amb('breath.jimin', false, { fade: 0.6 });
      roomSet('jimin', 'gone');
    },
    jiminQ() { setFlag('jiminUp'); play(SP().t16, '0440'); },
    /* t 18 — chip [밖에서 누가 도어락을 눌렀어요. 저도 들었어요. ✎] [말하기] / [두기] (20 s → 두기 · callback B) */
    async chip() {
      const d = SP();
      const c = d.chip && Object.assign({}, d.chip, { timeoutMs: Math.min(d.chip.timeoutMs || 10000, 10000) });   // 10 s: the keep-reply lands before the t 30 card (§3.12 order)
      if (!c) return;
      const r = await play([c], '0440');
      const pick = r && r.picks ? r.picks[c.id] : null;
      if (pick && pick.id && pick.id !== 'keep') {
        setFlag('jiminChipSent');
        const line = typeof d.chipReply === 'function' ? d.chipReply(cb) : d.chipReply;
        if (line) play([{ who: '지민', text: line }], '0440');
      } else if (d.keepReply) play([{ who: '지민', text: d.keepReply }], '0440');   // callback B line moves to the 05:35 tail (flow)
    },
    /* t 30 — 04:41 엄마 backs away to the table */
    back() {
      momAt('lv');
      roomSet('srGap', 0.25);
      roomRefresh();
      cue('mom.slippers', { path: [{ dt: 0, src: P.hallIn }, { dt: 3.2, src: P.momSeat }] });
      setTimeout(() => cue('chair.creak', { src: P.momSeat }), 3200);
      play(SP().t30, '0440');
    },
    /* t 46 — 04:43 지민 calls 112 (her murmur, never intelligible) */
    call112() {
      setFlag('jimin112');
      cue('jimin.murmur', { src: 'sink' });
      const f = (n) => flag(n);
      const lines = typeof SP().t46 === 'function' ? SP().t46(f) : SP().t46;
      play(lines, '0440');
    },
    jidae() { play(SP().t100, '0440'); },
    /* t 140 — 04:55 two pairs of steps in the corridor · the fire door · 콩이: ears only (no sound) */
    patrol() {
      setFlag('patrol');
      cue('firedoor.latch', { src: 'firedoor' });
      cue('hall.steps2', { src: 'hallOut' });
      sub('S08');
      setTimeout(() => { if (!flag('M7')) { cue('firedoor.clunk', { src: 'firedoor' }); sub('S09'); } }, 10000);
    },
    /* t 152 — 04:57 the patrol calls 지민 back · the blanket on 엄마's shoulders · 지민 leans by the kitchen entrance */
    patrolCall() {
      cue('buzz.jimin', { src: 'momPhone' });
      sub('S19');
      const lines = [].concat(SP().t152 || []);
      const k = lines.findIndex((s) => s && s.id === 'blanket');
      const run = { id: 'blanketRun', run: () => { roomSet('momBlanket', true); cue('cloth.rustle', { src: P.momSeat }); } };
      if (k >= 0) lines.splice(k, 0, run); else lines.push(run);
      play(lines, '0440');
    },
    /* t 176 — 05:02 the 강수진 SMS (all paths · comms owns the text and kang502) */
    sms() {
      let ok = false;
      try { if (G.sms && G.sms.deliver) { G.sms.deliver('k0502'); ok = true; } } catch (e) { console.error('[door] k0502', e); }
      if (!ok) { if (G.DEBUG) console.warn('[door] G.sms missing — kang502 set here (partial build)'); setFlag('kang502'); }
    },
    /* t 182 — 05:03 콩이 walks back to the 세아 방 door · a sigh */
    kongiBack() {
      cue('kongi.claws', { path: [{ dt: 0, src: P.kongiDoor }, { dt: 2.4, src: P.kongiSr }], walk: true });
      sub('S23walk');
      setTimeout(() => { roomSet('kongi', 'sleep'); setFlag('kongiBack'); }, 400);
      setTimeout(() => { cue('kongi.sigh', { src: P.kongiSr }); amb('breath.kongi', true, { fade: 1.2 }); }, 3000);
    },
  };

  /* ---------------- 0° after M6 → view0AfterM6 · doorDone (§3.12 0° 뷰) ---------------- */
  function seeDoor() { if (!flag('M6')) return; setFlag('view0AfterM6'); setFlag('doorDone'); }
  function momCheckView0() {
    try { const c = G.room && G.room.current && G.room.current(); if (c && c.view === 'r3_door' && c.mode === 'camera') seeDoor(); } catch (e) {}
  }

  /* ---------------- M7 = pm(kang502) + 45 s ---------------- */
  function schedM7() {
    if (flag('M7') || !flag('kang502')) return;
    const k = pmOf('kang502');
    const at = (k != null ? k : pmNow()) + 45000;
    if (!S.has('door:M7')) S.at(at, 'door:M7');
  }

  /* ---------------- resume (§3.22 · §9.2 · ARCH §8.3) ---------------- */
  /** the 04:41 end state: 엄마 at the table · 콩이 at the door (until 05:03) · 지민 awake · an unsent chip goes to the tail */
  function endState(ci) {
    if (ci < idx('back')) { momAt('lv'); roomSet('srGap', 0.25); }
    roomSet('momPos', null);
    roomSet('jimin', 'gone');
    amb('breath.jimin', false, { fade: 0 });
    if (ci < idx('kongiBack')) { roomSet('kongi', 'door'); amb('breath.kongi', false, { fade: 0 }); }
    else roomSet('kongi', 'sleep');
    if (ci >= idx('patrolCall') && ci < STEPS.length) roomSet('momBlanket', true);
    setFlag('jiminUp');
    roomRefresh();
  }
  DOOR.resume = function () {
    if (flag('M7')) { running = false; return; }
    if (flag('M5') && !flag('M6')) {
      const due = E() && E().m6Due ? E().m6Due() : (pmOf('M5') != null ? pmOf('M5') + 60000 : null);
      DEF.on = false;
      if (V().m6Hold != null || (due != null && pmNow() >= due)) startDefer();
      return;
    }
    if (!flag('M6')) return;
    if (!flag('bip')) {                                 // t < 0.9 → the sequence again from t 0 (§3.22)
      S.cancel('door:t*'); S.cancel('door:done');
      running = false;
      startSequence(true);
      return;
    }
    running = true;
    const cur = seq().m6, ci = Math.max(cur ? idx(cur) : idx('bip'), idx('bip'));
    endState(ci);
    // '삐삐삐' and the barks never again — the remaining steps keep their times from t 0 (04:41 end state → next card)
    S.cancel('door:t*');
    schedFrom(Math.max(ci, idx('chip')));
    if (!flag('doorDone')) { const at = base() + 60000; if (pmNow() >= at) setFlag('doorDone'); else S.at(at, 'door:done'); }
    if (seq().m6 && idx(seq().m6) < idx('chip')) { seq().m6 = 'chip'; save(); }
    schedM7();
  };
  DOOR.t = function () { if (!flag('M6')) return null; return Math.max(0, (pmNow() - base()) / 1000); };

  /* ---------------- init ---------------- */
  let inited = false;
  DOOR.init = function () {
    if (inited) return; inited = true;
    S.on('door:', (data, id) => {
      if (id === 'door:max') { forceM6(); return; }
      if (id === 'door:done') { if (flag('M6')) setFlag('doorDone'); return; }
      if (id === 'door:M7') { if (!flag('M7') && flag('kang502')) setFlag('M7'); return; }
      stepFired(id);
    });
    on('m6:due', (e) => startDefer(e && e.dueAt));
    on('flag:M6', () => { DEF.on = false; S.cancel('door:max'); startSequence(); });
    on('flag:kang502', () => schedM7());
    on('flag:M7', () => { running = false; S.cancel('door:done'); S.cancel('door:max'); STEPS.forEach((x) => { if (x.id !== 'kongiBack') S.cancel('door:t' + x.t); }); });
    on('room:view', (e) => { if (e && e.view === 'r3_door' && e.mode === 'camera') seeDoor(); });
    on('tick', () => { deferTick(); forceTick(); localRun(); });
  };
})();
