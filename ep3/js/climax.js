/* =========================================================
 * 하루를 위한 방탈출! 3 — 식탁 · the climax (ep3/js/climax.js · owner: room) — B16 · B17 · music 0 · sting 0 · scare 0
 * DESIGN §0.1 #4 #12 #28 · §2.2 #11 · §2.3 증명 10 · §3.14 (M8 cards · judging · position cards · head turn-away 40 s · tail line ·
 * pause 4 s · 240 s fallback · success chip) · §4.11.3 · §4.11.4 · §6.2 B16 B17 + the 엄마 body-sound ledger · §9.6 judging
 * contract (verbatim, below) · §9.2 resume row · §12.2 V11 (away sessions) · §10 I (8 cases).
 * ARCH §5.13 (G.climax · judging contract · G67 rec:time head rule) · §5.18 hooks (end:start · callrec:noSig) · §6.4.
 *
 *   G.climax = { init(), resume(), state() → { armed, seatedMs, away, fails } }
 * Listens: 'flag:M8' (entry cards) · 'rec:session' / 'rec:time' (comms callrec — the only judging source; volume / output blind) ·
 *   'tick' (the 240 s seated timer — playMs, stops while 엄마 stands at the sink, deferred while a valid session plays).
 * Sched (G.e3.sched): climax:back (vars.momAwayUntil — 엄마 sits down again).
 * Calls: G.cards.play · G.room.where('lv') / set / refresh · G.e3.momAt('lv') · G.e3.stage('e3_played', …) ·
 *   G.hooks.call('callrec:noSig', sess) · G.hooks.call('end:start', { by:'played'|'fallback' }) · G.audio.cue/amb/setYaw ·
 *   G.director.mark('B16'|'B17').
 * Flags set: playArmed played playFallback. Vars: vars.play (current session) · vars.playFails {head, tail} · vars.momAwayUntil ·
 *   vars.seatedMs · vars.seq.m8 ('cards' | 'armed' | 'result'). Stage: e3_played (played → true · playFallback → false).
 * Bus out: 'climax:m8cards' (the show button goes away) · 'climax:armed' · 'climax:result' {by, path:'A'|'B'|null}.
 * Strings: G.STORY.setpiece.climax only (DESIGN §4.11.3 · §4.11.4 verbatim). 엄마 never asks for the recording to be played.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const CX = (G.climax = G.climax || {});

  const E = () => G.ep || G.e3 || null;
  const flag = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const setFlag = (n) => { try { if (G.flag && !G.flag(n)) G.flag(n, true); } catch (e) { console.error('[climax] flag', n, e); } };
  const V = () => (G.state && G.state.vars) || {};
  const pmNow = () => (G.state && typeof G.state.playMs === 'number' ? G.state.playMs : 0);
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const emit = (ev, d) => { try { G.bus && G.bus.emit(ev, d); } catch (e) {} };
  const on = (ev, fn) => { try { G.bus && G.bus.on(ev, fn); } catch (e) {} };
  const cue = (id, o) => { try { G.audio && G.audio.cue && G.audio.cue(id, o || {}); } catch (e) {} };
  const amb = (id, onOff, o) => { try { G.audio && G.audio.amb && G.audio.amb(id, onOff, o || { fade: 0.8 }); } catch (e) {} };
  const mark = (id) => { try { G.director && G.director.mark && G.director.mark(id); } catch (e) {} };
  const roomSet = (k, v) => { try { G.room && G.room.set && G.room.set(k, v); } catch (e) {} };
  const roomRefresh = () => { try { G.room && G.room.refresh && G.room.refresh(); } catch (e) {} };
  const where = (v, o) => { try { if (G.room && G.room.where) return G.room.where(v, o); } catch (e) {} if (v !== undefined) V().where = v; return V().where || 'lv'; };
  const momAt = (v) => { try { if (E() && E().momAt) return E().momAt(v); } catch (e) {} if (v !== undefined) V().momAt = v; return V().momAt || 'table'; };
  const stage = (k, v) => { try { if (E() && E().stage) { E().stage(k, v); return; } } catch (e) {} if (G.state) { G.state.stage = G.state.stage || {}; G.state.stage[k] = v; save(); } };
  const SP = () => (G.STORY && G.STORY.setpiece && G.STORY.setpiece.climax) || {};
  const seq = () => { const v = V(); if (!v.seq || typeof v.seq !== 'object') v.seq = { m1: null, m6: null, m7: null, m8: null }; return v.seq; };
  const fails = () => { const v = V(); if (!v.playFails || typeof v.playFails !== 'object') v.playFails = { head: 0, tail: 0 }; return v.playFails; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** wait n ms of play time (pause menu / hidden tab stop it) */
  function waitPlay(ms) {
    const until = pmNow() + ms;
    return new Promise((res) => {
      if (!G.bus) { setTimeout(res, ms); return; }
      const fn = () => { if (pmNow() >= until) { try { G.bus.off('tick', fn); } catch (e) {} res(); } };
      G.bus.on('tick', fn);
    });
  }

  const LOCAL = { q: [], h: [] };
  const S = {
    core: () => !!(E() && E().sched && E().sched.at),
    at(at, id, data) { if (S.core()) return E().sched.at(at, id, data); S.cancel(id); LOCAL.q.push({ at, id, data }); return id; },
    cancel(id) { if (S.core()) return E().sched.cancel(id); LOCAL.q = LOCAL.q.filter((e) => e.id !== id); },
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
      if (h) try { h.fn(e.data, e.id); } catch (err) { console.error('[climax] sched', e.id, err); }
    });
  }

  const norm = (s) => (typeof s === 'string' ? { who: '엄마', text: s } : s);
  function play(steps, id, o) {
    steps = [].concat(steps).filter(Boolean).map(norm);
    const opts = Object.assign({ id: 'climax:' + (id || 'm8'), mode: 'story' }, o || {});
    try {
      if (G.cards && G.cards.play) return Promise.resolve(G.cards.play(steps, opts)).catch((e) => { console.error('[climax] cards', e); return { picks: {}, aborted: true }; });
    } catch (e) { console.error('[climax] cards', e); }
    const picks = {};
    let ms = 0;
    steps.forEach((s) => {
      if (s.run) try { s.run({}); } catch (e) {}
      if (s.chips) { picks[s.id] = s.timeoutPick ? { id: s.timeoutPick } : (s.keepOnTimeout ? null : null); ms += s.timeoutMs || 0; }
      else if (s.wait) ms += s.wait; else if (typeof s.text === 'string') ms += s.text.length * 70 + (s.gapMs || 1600);
    });
    return new Promise((r) => setTimeout(() => r({ picks, aborted: false }), Math.min(ms, 60000)));
  }

  /* ======================= M8 (05:15) — 엄마 at the table · {N} sits opposite · '…세아 소리, 들었어요?' → playArmed ======================= */
  let m8Running = false;
  async function startM8(resumed) {
    if (m8Running || !flag('M8') || flag('playArmed') && !resumed) return;
    m8Running = true;
    seq().m8 = 'cards'; save();
    emit('climax:m8cards', {});
    mark('B16');
    const steps = [].concat(SP().m8 || []).map(norm);
    const at = (id) => steps.findIndex((s) => s && s.id === id);
    const ins = (id, run, tag) => { const k = at(id); const r = { id: id + tag, run }; if (k < 0) steps.push(r); else steps.splice(k, 0, r); };
    // B16 ledger: chair (LT 270° 1 m) → listener LS → LT (0.8 s) → {N}'s chair → 엄마's breath while she sits
    ins('sit', () => { momAt('lv'); roomSet('momPos', null); roomRefresh(); cue('chair.creak', { src: 'momSeat' }); }, 'Run');
    ins('seat', () => {
      where('lv', { view: 'r3_kitchen' });
      try { G.audio && G.audio.setYaw && G.audio.setYaw(270); } catch (e) {}            // §7.1.2: M8 card = LT yaw 270° (엄마)
      cue('chair.self', {});
      amb('breath.mom', true, { fade: 1.2 });
    }, 'Run');
    ins('armed', () => arm(), 'Run');
    await play(steps, 'm8');
    arm();
    m8Running = false;
  }
  function arm() {
    if (flag('playArmed')) return;
    setFlag('playArmed');                               // from here on the recording plays on the table (rec.table) in 'lv'
    seq().m8 = 'armed';
    const v = V();
    if (typeof v.seatedMs !== 'number') v.seatedMs = 0;
    fails();
    save();
    emit('climax:armed', {});
  }

  /* ======================= judging (§9.6 contract — events from comms callrec) ======================= */
  const J = { headFired: {}, cur: null, pos: {}, pausedAt: null, pausedSess: null, waitShown: {}, busy: false, done: false };
  const away = () => pmNow() < (V().momAwayUntil || 0);
  function live() { return flag('playArmed') && !flag('played') && !flag('playFallback') && !J.done; }
  function track(e) {
    const playing = e.state === 'play' || e.state === 'resume' || (e.state == null && J.cur && J.cur.sess === e.sess && J.cur.playing);
    J.cur = { sess: e.sess, a: e.a, b: e.b, out: e.out, away: !!e.away, by: e.by, line: e.line, playing: e.state ? playing : true };
    V().play = { sess: e.sess, s0: e.s0 != null ? e.s0 : e.a, a: e.a, b: e.b, by: e.by, line: e.line, away: !!e.away };
  }
  function onSession(e) {
    if (!e || e.id !== 'sea0333' || !flag('playArmed') || flag('played') || flag('playFallback') || J.done) return;
    track(e);
    if (e.state === 'play' && e.by === 'line' && e.line === 21) {                       // a grey-line session after playArmed: no sigName
      try { if (G.hooks && G.hooks.has && G.hooks.has('callrec:noSig')) G.hooks.call('callrec:noSig', e.sess); } catch (err) {}
    }
    if (e.state === 'pause') { J.pausedAt = pmNow(); J.pausedSess = e.sess; } else { J.pausedAt = null; J.pausedSess = null; }
    if (e.state === 'end' || e.state === 'abort') { if (J.cur) J.cur.playing = false; }
    /* ---- §9.6 code (verbatim logic) ---- */
    if (e.out !== 'table') return;                       // 세아 방 재생 — 판정 0 · 카드 0
    if (e.away) return;                                  // sink 40 s session — 끝까지 판정 0 · 카드 0 (§12.2 V11)
    const head = e.a < 7.5, valid = e.a >= 7.5 && e.a <= 21.0;
    if (head && e.b >= 0.9 && !J.headFired[e.sess]) { J.headFired[e.sess] = 1; turnAway(); return; }
    if (e.state === 'end' && valid) return success(e.a <= 12.6 ? 'A' : 'B');
    if (e.state === 'end' && e.a > 21.0) return tailLine();
  }
  /** 'rec:time' {id, t, sess, a, b, out, away} (100 ms) — the head rule (ARCH G67) + the position-bound cards / body sounds */
  function onTime(e) {
    if (!e || e.id !== 'sea0333' || !live()) return;
    if (!J.cur || J.cur.sess !== e.sess) J.cur = { sess: e.sess, a: e.a, b: e.b, out: e.out, away: !!e.away, playing: true };
    else { J.cur.b = e.b; J.cur.out = e.out; J.cur.away = !!e.away; J.cur.playing = true; }
    if (J.pausedSess === e.sess) { J.pausedAt = null; J.pausedSess = null; }
    if (e.out !== 'table' || e.away) return;
    const head = e.a < 7.5, valid = e.a >= 7.5 && e.a <= 21.0;
    if (head && e.b >= 0.9 && !J.headFired[e.sess]) { J.headFired[e.sess] = 1; turnAway(); return; }
    if (!valid) return;
    const b = e.b != null ? e.b : e.t;
    const path = e.a <= 12.6 ? 'A' : 'B';
    const P = (J.pos[e.sess] = J.pos[e.sess] || {});
    const once = (k, mark0, fn) => { if (!P[k] && b >= mark0 && e.a <= mark0 + 0.05) { P[k] = 1; fn(); } };
    const at = SP().at || {};
    if (path === 'A') {
      once('cloth', 8.6, () => cue('cloth.rustle', { src: 'momSeat' }));
      once('fifth', 12.6, () => { posCard(at.fifth, e.sess); breathHold(16.0 - 12.6); });
      once('exhale', 16.0, () => cue('mom.exhale', { src: 'momSeat' }));
      once('name', 21.3, () => posCard(at.name, e.sess, '엄마'));
      once('mouth', 26.6, () => { posCard(at.mouth, e.sess); cue('hand.mouth', { src: 'momSeat' }); });
    } else {
      once('name', 21.3, () => posCard(at.name, e.sess, '엄마'));
      once('fifth', 26.6, () => { posCard(at.fifth, e.sess); breathHold(3.4); });
      once('exhale', 30.0, () => cue('mom.exhale', { src: 'momSeat' }));
    }
  }
  function posCard(text, sess, who) {
    if (!text) return;
    play([{ who: who || null, text, gapMs: 1400 }], 'pos', { mode: 'story' });
  }
  function breathHold(sec) {
    amb('breath.mom', false, { fade: 0.3 });
    setTimeout(() => { if (flag('playArmed') && !flag('END')) amb('breath.mom', true, { fade: 1.2 }); }, Math.round(sec * 1000));
  }

  /* s0 < 7.5 entering [0.9, 7.4] — +0.5 s 엄마 turns away → '…잠깐만요.' → stands at the sink for 40 s (§3.14 · B17 ledger) */
  async function turnAway() {
    if (J.done) return;
    fails().head++;
    const v = V();
    v.momAwayUntil = Math.round(pmNow() + 2100 + 40000);   // the lead-in (+0.5 · +1.6 s) then 40 s standing — sessions now are 'away'
    save();
    S.at(v.momAwayUntil, 'climax:back');
    J.pausedAt = null;
    await waitPlay(500);
    cue('cloth.rustle', { src: 'momSeat' }); cue('chair.turn', { src: 'momSeat' });
    const head = [].concat(SP().head || []).map(norm);
    const k = head.findIndex((s) => s && s.id === 'stand');
    head.splice(k < 0 ? head.length : k, 0, { id: 'standRun', run: () => {
      cue('chair.creak', { src: 'momSeat' });
      cue('mom.slippers', { path: [{ dt: 0, src: 'momSeat' }, { dt: 1.6, src: 'sink' }] });
      roomSet('momPos', 'sink'); roomRefresh();
    } });
    await play(head, 'head');
  }
  function sitBack() {
    if (J.done || flag('END')) { roomSet('momPos', null); return; }
    cue('mom.slippers', { path: [{ dt: 0, src: 'sink' }, { dt: 1.6, src: 'momSeat' }] });
    setTimeout(() => cue('chair.creak', { src: 'momSeat' }), 1600);
    roomSet('momPos', null); roomRefresh();
    play([SP().back], 'back');
  }
  /* s0 > 21.0 reaching 33.0 — +2 s '엄마는 말없이 화면만 본다.' → '…형사님이 들려준 거랑 같네요.' */
  async function tailLine() {
    fails().tail++; save();
    await waitPlay(2000);
    if (J.done) return;
    play(SP().tail, 'tail');
  }

  /* ---- success (played) → 2 s silence → her two lines + 지민 → chip (8 s → '…네.') → '……' → END (end:start) ---- */
  async function success(path) {
    if (J.done) return;
    J.done = true;
    setFlag('played');
    stage('e3_played', true);
    seq().m8 = 'result'; save();
    mark('B17');
    emit('climax:result', { by: 'played', path });
    await waitPlay(2000);                                  // 33.0 + 2 s — fridge and clock only
    const d = SP();
    await play([].concat(d.after || []), 'after');
    const sc = d.success;
    if (sc) {
      await play([{ id: sc.id, chips: sc.chips, timeoutMs: sc.timeoutMs, timeoutPick: sc.timeoutPick }], 'win');
      if (sc.then) await play([sc.then], 'win');
    }
    handOff('played');
  }
  /* ---- fallback: seatedMs ≥ 240 s and no valid session playing (§3.14 폴백 · stage e3_played false) ---- */
  async function fallback() {
    if (J.done) return;
    J.done = true;
    seq().m8 = 'result'; save();
    const steps = [].concat(SP().fallback || []).map(norm);
    await play(steps, 'fallback');
    setFlag('playFallback');
    stage('e3_played', false);
    emit('climax:result', { by: 'fallback', path: null });
    handOff('fallback');
  }
  function handOff(by) {
    amb('breath.mom', false, { fade: 1.2 });               // ARCH §5.17: breath.mom off at END ①
    roomSet('momPos', null);                               // 엄마 is at the table for the END cut (§6.3 END 컷)
    try {
      if (G.hooks && G.hooks.has && G.hooks.has('end:start')) G.hooks.call('end:start', { by });
      else if (G.ending && G.ending.start) G.ending.start({ by });
      else if (G.DEBUG) console.warn('[climax] end:start missing (partial build)');
    } catch (e) { console.error('[climax] end:start', e); }
  }

  /* ---- the seated timer (tick · playMs) + the 4 s pause card ---- */
  function validPlaying() {
    const c = J.cur;
    return !!(c && c.playing && c.out === 'table' && !c.away && c.a >= 7.5 && c.a <= 21.0);
  }
  function onTick(p) {
    localRun();
    if (!live() || m8Running) return;
    const dt = p && typeof p.dt === 'number' ? Math.min(1000, p.dt) : 250;
    const v = V();
    if (!away()) v.seatedMs = (v.seatedMs | 0) + dt;
    if (J.pausedAt != null && pmNow() - J.pausedAt >= 4000) {
      const s = J.pausedSess;
      J.pausedAt = null;
      if (s != null && !J.waitShown[s] && J.cur && J.cur.sess === s && J.cur.out === 'table' && !J.cur.away && J.cur.a >= 7.5 && J.cur.a <= 21.0) {
        J.waitShown[s] = 1;
        play([SP().wait], 'wait');                         // '엄마는 기다린다.' — once per pause, inside the same session
      }
    }
    if ((v.seatedMs | 0) >= 240000 && !validPlaying()) fallback();
  }

  /* ======================= resume (§3.22: 엄마 at the table · playArmed · playFails kept · 240 s = max(remaining, 120 s)) ======================= */
  CX.resume = function () {
    if (!flag('M8') || flag('END')) return;
    momAt('lv'); where('lv', { view: 'r3_kitchen' }); roomSet('momPos', null); roomRefresh();
    amb('breath.mom', true, { fade: 0.8 });
    const v = V();
    v.play = null;                                         // a new session
    J.cur = null; J.pausedAt = null;
    if (flag('played')) { J.done = true; handOff('played'); return; }
    if (flag('playFallback')) { J.done = true; handOff('fallback'); return; }
    if (!flag('playArmed')) { if (!m8Running) startM8(true); return; }
    v.seatedMs = Math.min(v.seatedMs | 0, 120000);         // remaining 240 s timer = max(remaining, 120 s)
    if ((v.momAwayUntil || 0) > pmNow()) { roomSet('momPos', 'sink'); if (!S.has('climax:back')) S.at(v.momAwayUntil, 'climax:back'); }
    save();
  };
  CX.state = () => ({ armed: flag('playArmed'), seatedMs: V().seatedMs | 0, away: away(), fails: Object.assign({}, fails()) });

  let inited = false;
  CX.init = function () {
    if (inited) return; inited = true;
    S.on('climax:', (data, id) => { if (id === 'climax:back') sitBack(); });
    on('flag:M8', () => setTimeout(() => { if (!seq().m8 && !flag('END') && !flag('playArmed')) startM8(false); }, 0));   // (a jump past M8 / an armed jump skips the cards)
    on('rec:session', onSession);
    on('rec:time', onTime);
    on('tick', onTick);
    on('flag:END', () => { J.done = true; });
  };
})();
