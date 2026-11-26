/* =========================================================
 * 하루를 위한 방탈출! 2 — climax (ep2/js/climax.js · owner: room)
 * The M5 → M8 run-up: B12 · B13 · compressed prelude (§0.2 D1, §6.1.7) · M6 drill · wobble · C2 watcher · early lure #1/#2
 * (§0.2 #21, §3.16) · B14 (§6.4-①, the one jump) · siren (G.e2.sirenDueAt — §2.1 M7 row) · M7 forced window view with
 * B15 · B17 · B18 · B16 · W06 · 00:50 roof light (§3.17, §6.2) · resume after reload (§6.1.8 재개표, ARCH §8.2).
 *
 * G.climax = {
 *   init()            sched handlers 'climax:*' · bus: m6:due · flag:M0 · flag:C1b · flag:M8 · clock:min · clock:jump · media:*
 *   state() → { phase:'pre'|'prelude'|'drill'|'b14'|'m7'|'after', lureCount, wobbles, sirenAtPm }
 *   safeZone() → bool  B14 t ∈ [0, 45 s] (director S8)
 *   resume()          §6.1.8 rows (drill · B14 · lure · M7) — called by flow main.js after a reload
 *   drillT0() → performance-time of the current drill cycle origin | null   (room: lock-panel tremble sync)
 * }
 * C2 watcher: every 100 ms while G.clock.running() (the one allowed extra poll — ARCH §4.3): G.media.state() target 'bt' ∧
 *   playing ∧ btVol ≥ 90 ∧ connected, continuously 1.5 s of visible play time. Edge-triggered (needs a drop between judgements).
 *   M6 ∧ ¬M7 → C2 → B14.  ¬M6 → early lure (1: +60 s volume back to 15 'remote' · 2: +45 s G.media.cut()).
 * Flags set: M6 · M7 · C2 · lureEarly · roofLight (TOGGLE: on at M0, off at B12, on at 00:50) · peepholeTaped (on at B12).
 * Vars set: wobbles · lureCount · sirenBy · c2Src · footprints (→ 1 at M7) · climax {drillPm, c2HoldPm, lureEarlyPm, sirenAtPm,
 *   phase, fired, b16, b16Done, beamsDone, lurePending} (m6DuePm: core).
 * Bus out: climax:prelude · climax:drill {on, t0} · climax:wobble · climax:lure {n} · climax:c2 · climax:siren {by} · climax:beat {id}
 * Beats marked (G.director.mark): B12 B13 B14 B15 B16 B17 B18 W06.  He never reacts to the screen — only to sound on 2층_스피커.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const C = (G.climax = G.climax || {});

  /* ======================= guarded helpers ======================= */
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());
  function flag(f) { try { return !!(G.flag && G.flag(f)); } catch (e) { return false; } }
  function setFlag(f, v) { try { if (!G.flag) return; if (v === false) { if (G.flag(f)) G.flag(f, false); } else if (!G.flag(f)) G.flag(f, true); } catch (e) { console.error('[climax] flag', f, e); } }
  function V(k) { try { return G.vars ? G.vars(k) : (G.state && G.state.vars[k]); } catch (e) { return undefined; } }
  function setV(k, v) { try { if (G.vars) G.vars(k, v); else if (G.state) G.state.vars[k] = v; } catch (e) {} }
  function cl() { const v = (G.state && G.state.vars) || {}; if (!v.climax || typeof v.climax !== 'object') v.climax = {}; return v.climax; }
  function save() { try { G.save && G.save(); } catch (e) {} }
  function playMs() { return (G.state && G.state.playMs) || 0; }
  function pm(f) {
    try { if (G.pm) { const p = G.pm(f); if (p != null) return p; } } catch (e) {}
    const v = G.state && G.state.vars && G.state.vars.pm; return v && v[f] != null ? v[f] : null;
  }
  function less() { try { if (G.e2 && G.e2.less) return !!G.e2.less(); } catch (e) {} return !!(G.settings && G.settings.scares && G.settings.scares !== 'full'); }
  function A() { return G.audio || {}; }
  function cue(id, o) { try { const a = A(); return a.cue ? a.cue(id, o || {}) : undefined; } catch (e) { console.error('[climax] cue', id, e); return undefined; } }
  function call(obj, fn) { try { if (obj && typeof obj[fn] === 'function') return obj[fn].apply(obj, [].slice.call(arguments, 2)); } catch (e) { console.error('[climax]', fn, e); } return undefined; }
  function emit(ev, d) { try { G.bus && G.bus.emit(ev, d); } catch (e) {} }
  function on(ev, fn) { try { G.bus && G.bus.on(ev, fn); } catch (e) {} }
  function passed(t) {
    try { if (G.clock && typeof G.clock.passed === 'function') return !!G.clock.passed(t); } catch (e) {}
    return !!(G.ROOM && G.ROOM.passed && G.ROOM.passed(t));
  }
  function jump(k) { try { G.clock && G.clock.jump && G.clock.jump(k); } catch (e) { console.error('[climax] jump', k, e); } }
  function running() {
    try { if (G.clock && typeof G.clock.running === 'function') return !!G.clock.running(); } catch (e) {}
    return !document.hidden;
  }
  function mark(id) { const c = cl(); c.fired = c.fired || {}; if (c.fired[id] == null) c.fired[id] = playMs(); save(); try { G.director && G.director.mark && G.director.mark(id); } catch (e) {} emit('climax:beat', { id }); }
  function fired(id) {
    const c = cl(); if (c.fired && c.fired[id] != null) return true;
    try { return !!(G.director && G.director.fired && G.director.fired(id) != null); } catch (e) { return false; }
  }
  /** §7.4 subtitles go through audio (G.SUBS, info/all, mono first); verbatim fallback only for partial builds */
  const SUB_FB = { S06: '[눈 밟는 소리 — 아주 작게]', S07: '[드릴 소리]', S08: '[드릴 소리가 잠깐 멎는다]', S09a: '♪ (멀리서, 아주 작게 — 오르골)', S09b: '♪ (멀리서 — 오르골)',
    S09c: '♪ (멀리서, 크게 — 오르골)', S10: '[드릴 소리가 멎는다]', S11: '[철컥]', S12: '[문 너머, 숨소리]', S13: '[눈 밟는 소리 — 멀어진다]', S14: '♪ (오르골이 뚝 끊긴다)',
    S14v: '♪ (소리가 뚝 끊긴다)', S15: '[사이렌]', S16: '[멀리서 — 덜컥]', S17: '[무전 잡음]' };
  const SUB_AZ = { S06: 70, S07: 0, S08: 0, S09a: 115, S09b: 115, S09c: 115, S10: 0, S11: 0, S12: 0, S13: 70, S14: 115, S14v: 115, S16: 115, S17: 70, S23: 55 };
  const SUB_INFO = { S23: true };   // mood subtitles: only through audio (subs 'all')
  let lastSubAt = 0;
  /** o.cls / o.replace tag the bottom-channel line (G.fx.sub): S09 tiers replace each other instead of stacking */
  function sub(id, o) {
    o = o || {};
    lastSubAt = now();
    const az = o.az != null ? o.az : SUB_AZ[id];
    const tag = o.cls || o.replace ? { cls: o.cls, replace: o.replace } : null;
    try {
      if (A().sub) {
        const go = () => A().sub(id, Object.assign({ az, text: o.text, ms: o.ms }, tag));
        if (tag && G.fx && G.fx.subScope) G.fx.subScope(tag, go); else go();
        return;
      }
      if (SUB_INFO[id]) return;
      const t = o.text || SUB_FB[id]; if (!t) return;
      if (G.room && G.room.isOpen && G.room.isOpen() && az != null) G.room.dirSub(t, az, o.ms || 2400); else if (G.fx && G.fx.sub) G.fx.sub(t, o.ms || 2400, tag || undefined);
    } catch (e) {}
  }
  const S09_TAG = { cls: 's09', replace: 's09' };
  /** S09 / S14 wording: '오르골' → '소리' for gallery videos & voice messages (§0.2 E5, ARCH §4.8 c2Src) */
  function subText(id, from) {
    if (from === 'recorder' || from == null) return undefined;
    const s = (G.SUBS && G.SUBS[id] && G.SUBS[id].text) || SUB_FB[id];
    return s ? s.replace('오르골', '소리') : undefined;
  }
  function surface() { return passed('00:20') ? 'deep' : passed('23:50') ? 'snowy' : 'dry'; }
  function steps(fromAz, toAz, n, dur, gainDb, fromDist, toDist) {
    cue('gravel.step', { surface: surface(), n, from: { az: fromAz, dist: fromDist || (fromAz === 0 ? 1 : fromAz === 115 ? 9 : 6) },
      to: { az: toAz, dist: toDist || (toAz === 0 ? 1 : toAz === 115 ? 9 : 6) }, dur, gainDb: gainDb || 0 });
  }

  /* ======================= scheduler: core G.e2.sched (persistent, playMs) with a local fallback ======================= */
  const handlers = {};
  const S = {
    on(id, fn) { handlers[id] = fn; try { if (G.e2 && G.e2.sched && G.e2.sched.on) G.e2.sched.on(id, (d, i) => fn(d, i)); } catch (e) {} },
    at(t, id, d) {
      try { if (G.e2 && G.e2.sched && G.e2.sched.at) { G.e2.sched.at(t, id, d); return; } } catch (e) {}
      const q = (cl().q = cl().q || []); S.cancel(id); q.push({ at: t, id, d }); save();
    },
    after(ms, id, d) { S.at(playMs() + ms, id, d); },
    cancel(id) {
      try { if (G.e2 && G.e2.sched && G.e2.sched.cancel) { G.e2.sched.cancel(id); return; } } catch (e) {}
      const q = cl().q; if (q) cl().q = q.filter((x) => x.id !== id);
    },
    has(id) {
      try { if (G.e2 && G.e2.sched && G.e2.sched.has) return !!G.e2.sched.has(id); } catch (e) {}
      return !!(cl().q || []).some((x) => x.id === id);
    },
    local() {
      if (G.e2 && G.e2.sched && G.e2.sched.at) return;
      const q = cl().q; if (!q || !q.length) return;
      const t = playMs(), due = q.filter((x) => x.at <= t);
      if (!due.length) return;
      cl().q = q.filter((x) => x.at > t); save();
      due.forEach((x) => { const fn = handlers[x.id]; if (fn) try { fn(x.d, x.id); } catch (e) { console.error('[climax] sched', x.id, e); } });
    },
  };

  /* ======================= local pausable timeline (sub-second choreography — advances only while running) ======================= */
  let tlNow = 0;
  const TL = [];
  function later(ms, fn, tag) { TL.push({ at: tlNow + ms, fn, tag: tag || '' }); }
  function cancelTag(tag) { for (let i = TL.length - 1; i >= 0; i--) if (TL[i].tag === tag) TL.splice(i, 1); }
  function runTL() {
    for (let guard = 0; guard < 50; guard++) {
      let k = -1;
      for (let i = 0; i < TL.length; i++) if (TL[i].at <= tlNow && (k < 0 || TL[i].at < TL[k].at)) k = i;
      if (k < 0) return;
      const it = TL.splice(k, 1)[0];
      try { it.fn(); } catch (e) { console.error('[climax] step', it.tag, e); }
    }
  }

  /* ======================= state ======================= */
  let phase = 'pre';
  let drillT0 = null, wobbleUntil = 0;
  function setPhase(p) { phase = p; cl().phase = p; save(); }
  C.state = function () { return { phase, lureCount: V('lureCount') || 0, wobbles: V('wobbles') || 0, sirenAtPm: cl().sirenAtPm != null ? cl().sirenAtPm : null }; };
  C.safeZone = function () { const t = pm('C2'); return flag('C2') && t != null && playMs() - t >= 0 && playMs() - t <= 45000; };
  C.drillT0 = function () { return phase === 'drill' && drillT0 != null ? drillT0 : null; };
  C.drillSpinning = function () { if (phase !== 'drill' || drillT0 == null || now() < wobbleUntil) return false; return ((now() - drillT0) % 6000) < 4000; };
  C.running = false;   // ep1 name read by old code paths — the climax has no modal UI in ep2

  /* ======================= M0 · B12 · B13 · prelude ======================= */
  function roofLightOn() { if (!flag('roofLight')) setFlag('roofLight', true); }
  /** B12 — 00:22 by the clock: stair-head light off, he walks to the door, tapes the peephole, walks back (§6.2) */
  function b12(full) {
    if (fired('B12')) return;
    mark('B12');
    cue('switch.click', { az: 55, dist: 7, gainDb: -6 });
    sub('S23', { az: 55 });
    setFlag('roofLight', false);
    if (!full) { setFlag('peepholeTaped', true); return; }
    later(2000, () => steps(55, 0, 8, 8000, -8, 7, 1), 'b12');
    later(12000, () => setFlag('peepholeTaped', true), 'b12');
    later(14000, () => steps(0, 70, 8, 8000, -8, 1, 6), 'b12');
  }
  /** B13 — 00:23: very quiet deep-snow steps 70° → 0° (6 s) */
  function b13() {
    if (fired('B13')) return;
    mark('B13');
    steps(70, 0, 8, 6000, -10, 6, 1);
    sub('S06', { az: 70 });
  }
  /** core: m6:due {prelude} once M6 = max(min(M5+210, max(M5+45, C1+45, B09+120)), lure+130) holds (§2.1 · §0.2 D14) */
  function onM6Due(p) {
    if (flag('M6') || phase === 'prelude' || phase === 'drill') return;
    const c = cl(); if (c.m6DuePm == null) c.m6DuePm = playMs(); save();
    const prelude = !fired('B12') && (p ? !!p.prelude : !passed('00:22'));
    if (prelude) {
      // 8 s compressed prelude: t0 B12 (light + peephole at once, no round trip) · t1.5 B13 steps · t4 00:23 · t8 drill = M6
      setPhase('prelude'); emit('climax:prelude');
      cancelTag('b12');
      b12(false); jump('00:22');
      later(1500, b13, 'prelude');
      later(4000, () => jump('00:23'), 'prelude');
      later(8000, startDrill, 'prelude');
      return;
    }
    if (!fired('B13')) { setPhase('prelude'); b13(); later(4500, startDrill, 'prelude'); return; }
    startDrill();
  }

  /* ======================= M6 — the drill ======================= */
  /** §6.1.5 heartbeat bed = a state, not a one-shot: T ≥ .8 ∧ M6 ∧ ¬M7 while the drill runs (B14 t = 3.0 — the drill's hard
   *  stop — and the siren end it). Earphones → the bed; speaker mode → vignette pulse (A.heartbeat routes it per beat);
   *  덜 무섭게 → nothing (§6.1.8). Re-judged on every climax tick: T is still at the M5 level (.70) when the drill starts and
   *  crosses .8 ≈ 4.6 s later (director τ 6.7 s), and 덜 무섭게 can be switched on or off mid-drill. */
  let hbWant = false;
  function heartbeatSync() {
    let T = 0.9; try { if (G.director && G.director.T) T = G.director.T(); } catch (e) {}
    let drilling = false; try { drilling = !!(A().drill && A().drill.playing && A().drill.playing()); } catch (e) {}
    const want = (phase === 'drill' || phase === 'b14') && drilling && flag('M6') && !flag('M7') && T >= 0.8 && !less();
    if (want) call(A(), 'heartbeat', true, { bpm: 72 });           // idempotent while the bed runs; retries until audio is up
    else if (hbWant) call(A(), 'heartbeat', false);
    hbWant = want;
  }
  function heartbeatOn() { heartbeatSync(); }
  function drillSubLoop() {
    later(20000, () => {
      if (phase !== 'drill') return;
      let busy = false; try { busy = !!(A().subBusy && A().subBusy()); } catch (e) {}
      if (!busy && now() - lastSubAt > 3000) sub('S07');
      drillSubLoop();
    }, 'drillsub');
  }
  function startDrill(resumed) {
    if (phase === 'drill' && !resumed) return;
    cancelTag('b12'); cancelTag('prelude');
    if (!flag('peepholeTaped') && !flag('doorOpened')) setFlag('peepholeTaped', true);
    if (flag('roofLight') && !passed('00:50')) setFlag('roofLight', false);
    setPhase('drill');
    drillT0 = now();
    const c = cl(); if (c.drillPm == null) c.drillPm = playMs(); save();
    if (!flag('M6')) setFlag('M6');
    call(A().drill, 'start');
    sub('S07');
    drillSubLoop();
    heartbeatOn();
    emit('climax:drill', { on: true, t0: drillT0 });
    scheduleSiren();
  }
  function wobble() {
    if (phase !== 'drill') return;
    call(A().drill, 'wobble');
    wobbleUntil = now() + 1500;
    if (drillT0 != null) drillT0 += 1500;
    setV('wobbles', (V('wobbles') || 0) + 1);
    sub('S08');
    emit('climax:wobble');
  }

  /* ======================= media: wobble · S09 steps (§3.16 표, §7.4 S09) ======================= */
  let lastStep = null, lastFrom = null, btPlayingId = null;
  function step(v) { return v >= 90 ? 'S09c' : v >= 50 ? 'S09b' : 'S09a'; }
  function btVol() { try { if (G.media && G.media.getVolume) return G.media.getVolume('bt'); } catch (e) {} const v = V('btVol'); return typeof v === 'number' ? v : 15; }
  function onBtStart(from, id) {
    btPlayingId = id || null; lastFrom = from || null;
    const s = step(btVol()); lastStep = s;
    sub(s, Object.assign({ text: subText(s, from) }, S09_TAG));
    if (phase === 'drill') wobble();
  }
  function onMediaPlay(e) { if (e && e.target === 'bt') onBtStart(e.from, e.id); }
  function onMediaOut(e) {
    if (!e || e.target !== 'bt') return;
    try { const st = G.media && G.media.state && G.media.state(); if (st && st.playing) onBtStart(st.from, st.id); } catch (er) {}
  }
  function onMediaVol(e) {
    if (!e || e.target !== 'bt') return;
    let playing = false, from = lastFrom;
    try { const st = G.media && G.media.state && G.media.state(); playing = !!(st && st.playing && st.target === 'bt'); if (st && st.from) from = st.from; } catch (er) {}
    if (!playing) return;
    const s = step(e.v != null ? e.v : btVol());
    if (s !== lastStep) { lastStep = s; sub(s, Object.assign({ text: subText(s, from) }, S09_TAG)); }
  }

  /* ======================= C2 watcher (§3.16 판정 C2 · §9.7 판정) ======================= */
  let acc = 0, armed = true;
  function watch(dt) {
    if (!flag('gotPhone') || flag('M7')) { acc = 0; return; }
    let st = null; try { st = G.media && G.media.state ? G.media.state() : null; } catch (e) {}
    let conn = false; try { conn = G.media && G.media.bt && G.media.bt.connected ? !!G.media.bt.connected() : flag('btConnected'); } catch (e) { conn = flag('btConnected'); }
    const vol = st && st.vol && typeof st.vol.bt === 'number' ? st.vol.bt : btVol();
    const ok = !!(st && st.playing && st.target === 'bt' && conn && !flag('musicCut') && vol >= 90);
    if (!ok) { acc = 0; armed = true; return; }
    if (!armed) return;
    if (phase === 'prelude') { acc = Math.min(1500, acc + dt); return; }        // judged the moment the drill starts
    acc += dt;
    if (acc < 1500) return;
    acc = 0; armed = false;
    judge(st);
  }
  function judge(st) {
    const src = st && st.from === 'recorder' ? 'rec' : 'video';
    if (flag('M6') && !flag('M7') && !flag('C2') && phase === 'drill') { setV('c2Src', src); c2(); return; }
    if (!flag('M6') && phase === 'pre') {
      const c = cl();
      if (c.lurePending || (V('lureCount') || 0) >= 2) return;
      setV('c2Src', src);
      lure();
    }
  }

  /* ======================= early lure #1 / #2 (§0.2 #21) ======================= */
  function lure() {
    const n = Math.min(2, (V('lureCount') || 0) + 1);
    setV('lureCount', n);
    setFlag('lureEarly');
    const c = cl(); c.lureEarlyPm = playMs(); c.lurePending = true; save();
    emit('climax:lure', { n });
    // he goes to the speaker: tiny steps 70° → 115° (+5–15 s), S06 at +10 s; back 115° → 70° at +120 s
    later(5000 + Math.random() * 10000, () => steps(70, 115, 6, 5000, -10), 'lure');
    later(10000, () => sub('S06', { az: 100 }), 'lure');
    later(120000, () => steps(115, 70, 6, 5000, -10), 'lure');
    if (n === 1) S.after(60000, 'climax:lure1back');
    else S.after(45000, 'climax:lure2cut');
  }
  /** lure #1 + 60 s: he presses the speaker's volume button — absolute volume sync, the slider goes back to 15 (toast 0) */
  function lure1back() {
    cl().lurePending = false; save();
    try { G.media && G.media.setVolume && G.media.setVolume('bt', 15, { source: 'remote' }); } catch (e) { console.error(e); }
    acc = 0; armed = true;                 // the volume is his again — the next 1.5 s at ≥ 90 % is a new judgement
  }
  /** lure #2 + 45 s: he pulls the plug — musicCut (permanent), LED off, '2층_스피커 연결 끊김' */
  function lure2cut() {
    cl().lurePending = false; save();
    let playing = false; try { playing = !!(G.media && G.media.state && G.media.state().playing && G.media.state().target === 'bt'); } catch (e) {}
    try { G.media && G.media.cut && G.media.cut({ pop: playing }); } catch (e) { console.error(e); }
    if (playing) sub(V('c2Src') === 'video' ? 'S14v' : 'S14');
  }

  /* ======================= B14 — C2 success (§6.4-①) ======================= */
  function c2() {
    setFlag('C2');
    setPhase('b14');
    const c = cl(); c.c2HoldPm = playMs(); save();
    mark('B14');
    try { G.director && G.director.spend && G.director.spend('b14'); } catch (e) {}
    emit('climax:c2');
    jump('C2');
    cancelTag('drillsub');
    const t0 = pm('C2') != null ? pm('C2') : playMs();
    S.cancel('climax:siren'); S.at(t0 + 33000, 'climax:siren'); c.sirenAtPm = t0 + 33000;
    S.at(t0 + 25000, 'climax:b14cut');
    save();
    // 0.8 · 2.0 — the rotation catches twice (he hesitates)
    later(800, () => call(A().drill, 'hesitate', 250), 'b14');
    later(2000, () => call(A().drill, 'hesitate', 250), 'b14');
    // 3.0 — spin-down + ping → 1.8 s of silence (only the far music box stays)
    later(3000, () => {
      call(A().drill, 'stopC2');
      jump('drillStop');
      // input focus delays the handle by 0.8 s (below) → the silence lasts until the hit (§6.4-①);
      // 덜 무섭게 or the notebook open (S2 → the less version, same test as the hit) → '무음은 0.3초만'
      let foc = false; try { foc = !!(G.ui && G.ui.inputActive && G.ui.inputActive()); } catch (e) {}
      call(A(), 'silenceDrop', b14Less() ? 300 : foc ? 2600 : 1800, { keep: ['mediaOut'] });
      call(A(), 'heartbeat', false);
      sub('S10', { ms: 1700 });
      emit('climax:drill', { on: false });
    }, 'b14');
    // 4.8 — the handle (input focus ⇒ +0.8 s, everything after shifts; notebook open ⇒ less-scary version)
    later(4800, () => {
      let d = 0; try { if (G.ui && G.ui.inputActive && G.ui.inputActive()) d = 800; } catch (e) {}
      later(d, b14Jump, 'b14');
      later(d + 800, b14Breath, 'b14');
      later(d + 2200, () => { steps(0, 70, 5, 3000, -6, 1, 6); sub('S13', { az: 70 }); later(3000, () => steps(70, 115, 5, 3000, -8, 6, 9), 'b14'); }, 'b14');
      later(d + 22200, () => steps(115, 70, 8, 6000, -12, 9, 6), 'b14');
    }, 'b14');
  }
  function b14Less() { let nb = false; try { nb = !!(G.notebook && G.notebook.isOpen && G.notebook.isOpen()); } catch (e) {} return less() || nb; }
  function b14Jump() {
    if (flag('M7')) return;
    const lz = b14Less();
    cue('handle.jerk', { less: lz });
    cue('sting.soft2', { less: lz });
    sub('S11', { ms: 1200 });
    let doorSeen = false;
    try { doorSeen = !!(G.room && G.room.handleJerk && G.room.handleJerk({ less: lz })); } catch (e) {}
    if (!lz) {
      call(A(), 'vibrate', 'b14');
      if (!doorSeen && !(G.settings && G.settings.reduceShake)) call(G.fx, 'edgeShake', 3, 300);
    }
    // speaker mode: the handle.jerk cue draws the ▲ arc itself (spatial.js) — draw it here only when the cue could not run
    let audioUp = false; try { audioUp = !!(A().ok && A().ok() && !A().paused); } catch (e) {}
    if (!audioUp && G.settings && G.settings.audioMode === 'speaker') call(G.fx, 'dirArc', 0, 600);
  }
  function b14Breath() {
    if (flag('M7')) return;
    const lz = b14Less();
    try { if (A().playVoice) A().playVoice('v2_him_breath', { az: 0, dist: 0.3, via: 'door', gainDb: lz ? -6 : 0 }); else cue('breath.out', {}); } catch (e) { cue('breath.out', {}); }
    sub('S12', { ms: 1600 });
  }
  /** B14 25 s — he pulls the speaker's plug mid-bar (00:33) */
  function b14cut() {
    let playing = false; try { playing = !!(G.media && G.media.state && G.media.state().playing && G.media.state().target === 'bt'); } catch (e) {}
    if (!flag('musicCut')) { try { G.media && G.media.cut && G.media.cut({ pop: playing }); } catch (e) { console.error(e); } }
    jump('musicCut');
    if (playing) sub(V('c2Src') === 'video' ? 'S14v' : 'S14');
  }

  /* ======================= M7 — the siren (§2.1 M7 · §3.16 C2 없이 · §3.17) ======================= */
  function sirenDue() {
    try { if (G.e2 && G.e2.sirenDueAt) { const t = G.e2.sirenDueAt(); if (isFinite(t)) return t; } } catch (e) {}
    const m6 = pm('M6') != null ? pm('M6') : playMs(), c1b = pm('C1b') != null ? pm('C1b') + 150000 : Infinity;
    if (flag('C2')) return (pm('C2') || playMs()) + 33000;
    return (V('lureCount') || 0) >= 2 ? Math.min(m6 + 90000, c1b) : Math.min(m6 + 240000, c1b);
  }
  function scheduleSiren() {
    if (!flag('M6') || flag('M7')) return;
    const t = sirenDue();
    cl().sirenAtPm = t; save();
    S.cancel('climax:siren'); S.at(t, 'climax:siren');
  }
  function sirenBy() {
    if (flag('C2')) return 'c2';
    const m6 = pm('M6') != null ? pm('M6') : playMs(), c1b = pm('C1b') != null ? pm('C1b') + 150000 : Infinity;
    if ((V('lureCount') || 0) >= 2) return c1b < m6 + 90000 ? 'c1b' : 'early';
    return c1b < m6 + 240000 ? 'c1b' : 'time';
  }
  function siren() {
    if (flag('M7') || !flag('M6')) return;
    const by = sirenBy();
    const wasDrill = phase === 'drill';
    setV('sirenBy', by);
    setFlag('M7');
    setV('footprints', 1);
    setPhase('m7');
    S.cancel('climax:siren');
    cancelTag('drillsub'); cancelTag('b14');
    const c = cl(); c.sirenPm = playMs(); save();
    mark('B15');
    emit('climax:siren', { by });
    cue('siren.police', { mode: by === 'c2' ? 'arrive' : 'fadeIn' });
    sub('S15', { ms: 3000 });
    call(A(), 'heartbeat', false);
    if (wasDrill) {
      // fallback path: the drill finishes the rotation it is in and stops — no silence drop, no handle, no breath
      call(A().drill, 'stopFallback');
      emit('climax:drill', { on: false });
      later(4000, () => { steps(0, 70, 7, 6000, -10, 1, 6); sub('S06', { az: 0 }); }, 'm7');
    }
    const t = pm('M7') != null ? pm('M7') : playMs();
    S.at(t + 18000, 'climax:b17');
    S.at(t + 30000, 'climax:b18');
    openForced(true);
  }
  /** the forced window eye view: ~40 s, first 6 s input-locked, until 00:47 ∧ the torches are done (§3.17 · W06) */
  function openForced(withLock) {
    if (!G.room || !G.room.forceView) return;
    G.room.forceView({ view: 'r2_window', lockMs: withLock ? 6000 : 0, pinch: true,
      until: () => flag('M8') || (passed('00:47') && !!cl().beamsDone) || passed('00:50') });
  }
  function b17() {
    if (fired('B17') || !flag('M7')) return;
    mark('B17');
    try { G.room && G.room.tankAjar && G.room.tankAjar(); } catch (e) {}
    // hinge.none — no sound, no subtitle (★S2-8)
  }
  /** B18 00:41 (§6.2 · §4.9.2 S16 = B18): the whole beat lands inside 00:41–00:43 so `[멀리서 — 덜컥]` precedes B16's
   *  `[무전 잡음]` even on the whereTank path (00:44 ≈ M7 + 34.5 s at m7rate 1.5) — §4.10.1 order 사이렌 → 덜컥 → 무전 잡음 */
  let s16Pending = false, afterS16 = [];
  function s16Shown() { s16Pending = false; const q = afterS16; afterS16 = []; q.forEach((f) => later(600, f, 'm7')); }
  function b18() {
    if (fired('B18') || !flag('M7')) return;
    mark('B18');
    try { const g = A().gsmTank; g && g.fadeTo && g.fadeTo(0, 4000); } catch (e) {}
    steps(70, 115, 6, 3400, -10, 6, 9);              // gap 3.4 / 6 = 0.57 s (gait 0.55–0.70) · last step ≈ +2.8 s
    s16Pending = true;
    later(3300, () => cue('rail.creak', { az: 115, dist: 6 }), 'm7');
    later(4000, () => { cue('door.far', { az: 115, dist: 14 }); sub('S16', { ms: 2000 }); s16Shown(); }, 'm7');
  }
  /** run fn now, or 0.6 s after S16 if B18's far door is still to come (in-session only — a reload drops the wait) */
  function afterFarDoor(fn) {
    if (!s16Pending) { fn(); return; }
    afterS16.push(fn);
    later(4600, () => { const i = afterS16.indexOf(fn); if (i >= 0) { afterS16.splice(i, 1); fn(); } }, 'm7');   // never wait longer than B18 itself
  }
  /** B16 — the patrol reaches the roof: torches straight to the tank door (whereTank, 00:44) or round the roof first (00:47) */
  function b16() {
    const c = cl();
    if (c.b16 || !flag('M7')) return;
    const mode = flag('whereTank') ? 'direct' : 'sweep';
    c.b16 = mode; save();
    mark('B16');
    cue('boots.snow', { n: 8, people: 2, from: { az: 55, dist: 7 }, to: { az: 70, dist: 6 } });   // ×2명 (audio staggers the two)
    later(900, () => afterFarDoor(() => { cue('radio.squelch', { az: 70 }); sub('S17', { ms: 2000 }); }), 'm7');
    const reached = () => { const k = cl(); if (k.b16Done) return; k.b16Done = true; k.b16DonePm = playMs(); save(); later(2000, () => { cl().beamsDone = true; save(); }, 'm7'); try { G.room && G.room.refresh && G.room.refresh(); } catch (e) {} };
    try { if (G.room && G.room.beams) G.room.beams(mode, reached); else later(mode === 'direct' ? 1500 : 6000, reached, 'm7'); } catch (e) { later(1500, reached, 'm7'); }
    squelchLoop(true);
  }
  let squelching = false;
  function squelchLoop(first) {
    if (squelching && first) return;
    squelching = true;
    later(12000 + Math.random() * 18000, () => {
      if (flag('M8') || !flag('M7')) { squelching = false; return; }
      if (!fired('W06')) mark('W06');
      cue('radio.squelch', { az: 70 });
      squelchLoop(false);
    }, 'w06');
  }
  function roofLightBack() {
    if (flag('roofLight')) return;
    setFlag('roofLight', true);
    cue('switch.click', { az: 55, dist: 7 });
    sub('S23', { az: 55 });
  }

  /* ======================= clock-bound beats (catch up on clock:jump — §6.1.7) ======================= */
  function clockCheck() {
    if (!flag('M0')) return;
    if (!flag('M6') && phase === 'pre') {
      if (passed('00:22') && !fired('B12')) b12(true);
      if (passed('00:23') && !fired('B13')) b13();
    }
    if (flag('M7') && !flag('M8')) {
      if (!cl().b16 && passed(flag('whereTank') ? '00:44' : '00:47')) b16();
      if (passed('00:50') && !flag('roofLight')) roofLightBack();
    }
  }

  /* ======================= the 100 ms loop (only while G.clock.running()) ======================= */
  let loopOn = false, last = 0;
  function loop() {
    const t = now(), dt = Math.min(400, t - (last || t)); last = t;
    if (running()) {
      tlNow += dt;
      runTL();
      try { watch(dt); } catch (e) { console.error('[climax] watch', e); }
      try { heartbeatSync(); } catch (e) { console.error('[climax] heartbeat', e); }
      S.local();
    }
    setTimeout(loop, running() ? 100 : 250);
  }

  /* ======================= init · resume ======================= */
  let inited = false;
  C.init = function () {
    if (inited) return; inited = true;
    phase = cl().phase && /^(pre|drill|b14|m7|after)$/.test(cl().phase) ? cl().phase : 'pre';
    S.on('climax:siren', siren);
    S.on('climax:lure1back', lure1back);
    S.on('climax:lure2cut', lure2cut);
    S.on('climax:b14cut', b14cut);
    S.on('climax:b17', b17);
    S.on('climax:b18', b18);
    on('m6:due', onM6Due);
    on('flag:M0', () => { if (!passed('00:22')) roofLightOn(); });
    on('flag:C1b', () => { jump('C1b'); scheduleSiren(); });
    on('flag:M8', () => { setPhase('after'); cancelTag('w06'); squelching = false; });
    on('clock:min', clockCheck);
    on('clock:jump', clockCheck);
    on('media:play', onMediaPlay);
    on('media:out', onMediaOut);
    on('media:vol', onMediaVol);
    // reload during the 8 s prelude: core emits m6:due only once — the first running tick after a resume starts the drill
    let guard = false;
    on('tick', () => {
      if (guard) return; guard = true;
      if (flag('M5') && !flag('M6') && cl().m6DuePm != null && phase === 'pre') startDrill();
    });
    if (!loopOn) { loopOn = true; last = now(); setTimeout(loop, 100); }
    debugHelpers();
  };

  /** §6.1.8 재개표 / ARCH §8.2 — after a reload (flow main.js calls this once the saved state is back) */
  C.resume = function () {
    if (!inited) C.init();
    const c = cl();
    if (flag('M8') || flag('END')) { setPhase('after'); return; }
    if (flag('M7')) {
      setPhase('m7');
      const t = pm('M7') != null ? pm('M7') : playMs();
      if (!fired('B17') && !S.has('climax:b17')) S.at(t + 18000, 'climax:b17');
      if (!fired('B18') && !S.has('climax:b18')) S.at(t + 30000, 'climax:b18');
      if (fired('B18')) { try { const g = A().gsmTank; g && g.fadeTo && g.fadeTo(0, 50); } catch (e) {} }
      if (c.b16 && !c.b16Done) { c.b16Done = true; c.beamsDone = true; save(); }
      if (c.b16) squelchLoop(true);
      if (!passed('00:47')) openForced(false);      // re-opens without the 6 s input lock (ARCH §9 G32)
      clockCheck();
      return;
    }
    if (flag('C2')) {
      // B14 in progress → t = 25 s state: music cut, LED off; no jump, no breath; siren at C2 + 33 s
      setPhase('b14');
      if (!flag('musicCut')) { try { G.media && G.media.cut && G.media.cut({ pop: false }); } catch (e) {} }
      call(A(), 'heartbeat', false);
      const t = (pm('C2') || playMs()) + 33000;
      if (!S.has('climax:siren')) S.at(t, 'climax:siren');
      c.sirenAtPm = t; save();
      return;
    }
    if (flag('M6')) {
      // drill restarts at its cycle position (audio fades it in), wobbles kept, siren deadline unchanged
      startDrill(true);
      return;
    }
    if (c.m6DuePm != null) { startDrill(); return; }   // reload during the 8 s prelude: straight to the drill
    setPhase('pre');
    clockCheck();
  };

  /* ======================= DEBUG (window.haru.climax — §10 I five cases) ======================= */
  function debugHelpers() {
    if (!G.DEBUG) return;
    const h = (window.haru = window.haru || {});
    h.climax = function (what) {
      if (what === 'drill') { if (!flag('M6')) { if (!fired('B12')) b12(false); mark('B13'); startDrill(); } return C.state(); }
      if (what === 'c2') { if (!flag('M6')) { if (!fired('B12')) b12(false); mark('B13'); startDrill(); } if (!flag('C2')) { setV('c2Src', 'rec'); c2(); } return C.state(); }
      if (what === 'lure1' || what === 'lure2') {
        if (flag('M6')) { console.warn('[climax] lures happen before M6'); return C.state(); }
        const want = what === 'lure1' ? 1 : 2;
        while ((V('lureCount') || 0) < want) { cl().lurePending = false; setV('c2Src', 'rec'); lure(); if ((V('lureCount') || 0) === 1 && want === 2) lure1back(); }
        return C.state();
      }
      if (what === 'siren') { if (!flag('M6')) { if (!fired('B12')) b12(false); mark('B13'); startDrill(); } siren(); return C.state(); }
      return C.state();
    };
  }
  if (G.DEBUG) debugHelpers();
})();
