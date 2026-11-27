/* =========================================================
 * engine/director.js (flow) — episode-2 horror director (DESIGN_EP2 §6.1 · ARCH §4.18). Data-driven: reads
 * G.BEATDATA2 (ep2/js/data/beats.js) and runs only records whose owner is 'director'.
 *   safe zones S1–S10 (§6.1.3) · defer world / wait / wait30 · delayMs · show-beat spacing ≥ 25 s,
 *   dread ≤ 1/60 s (M0–M5) and ≤ 1/40 s (M5–M6) · simultaneous world beats: lower class +1.5 s ·
 *   tension T (§6.1.5, converges over 20 s; M7 1.0 → .3 in 40 s) → G.audio.tension(T) + G.fx.setVignette(.30 + .40T)
 *   drone on M1…M8 (off over 8 s at M8), −100 cent while the user is '—' (2 s; back over 4 s) · END: wind −9 dB,
 *   drone 0, GSM 0 · micro ambience m.* (M1 → M6 only, (120 − 75T)·(0.7–1.3) s, never 50–80° / 105–125°) ·
 *   clock-jump compensation for 00:00 (B07 +2 s, sched 'dir:B07') · JS budget (vars.dir.jsSpent).
 * REMOVED for ep2 (hard mode / world rule): watcher lines, his chat voice, wrong-password taunts, look-away log,
 *   tab-title/favicon tricks, idle nudges, knock, mirroring cut, notebook pings. Nothing here reacts to the
 *   player's UI actions with a scare; failures never trigger beats (§6.1.4).
 * Timing: logic runs on core's 250 ms 'tick' (playMs) at 1 s granularity + debounced bus events; it never ticks
 *   while hidden or paused (G.clock.running()).
 *
 * API: G.director = { init(), start(), stop(), safe(kind), zones(), mark(id), fired(id) → pm|null, spend(id) → bool,
 *                     T() → number, hold(name, on), run(id) (debug skipTo) }
 * Bus out: 'dir:beat' {id}. Flags set here: tankGlow (B09), b09Cue (B09′). Vars: vars.dir {fired, jsSpent, himTone, T, dropped}.
 * Sched ids: 'dir:B07', 'dir:b09cue'.
 *
 * Episode-3 data options (ARCH_EP3 §4.2 · §5.16 — each is read from BD() only when present; absent ⇒ the ep2 path above,
 * byte-for-byte the same behaviour — ep2's beats.js defines none of them):
 *   zones(base) → {S1…S10}         the safe-zone table is data (base = the ep2 computation; H = holds is kept)
 *   safeKinds {kind:[zones]}       replaces BOTH safe(kind) and the hard-coded zoneBlocks() used for show beats: a kind
 *                                  blocks while any listed zone or a hold is on (no ep2 M6–M7 climax exception)
 *   ambience {drone, gsm, endWind} only the listed true ones run (ep3: all false) · midnight:false → no 00:00 compensation
 *   targetT(s) → T | {T, ms}       replaces the tension map and the ep2 M7 fast curve (ms = convergence time, default 20 s)
 *   vignette(T) → v                replaces .30 + .40T
 *   microActive(s) · microGap(T)   replace M1→M6 and (120 − 75T)(0.7–1.3) s · micro records gain where:'lv'|'sr'|'any' ·
 *                                  when(s) · once (vars.dir.fired) · run({az, s}); safeKinds.micro zones skip the turn;
 *                                  microForbidden applies to non-'sr' rows only (sr rows are in the LS frame)
 *   loops [{id, when(s, z), gapMs(), run()}]   repeating world loops (W01 · W03): first due = now + gapMs(); mark(id) on the
 *                                  first run only; when() false drops the timer. In memory only (restart on resume).
 *   beat where:'lv'|'sr' (= (G.ep||G.e2).where()) · beat delayMs may be a function (s) → ms · snapshot s.lastJump
 *   {from, to, skipped, pm} (the last clock:jump) · vars.dir.dropped stays an object {id: pm} (an array is converted).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const D = (G.director = G.director || {});
  const BD = () => G.BEATDATA2 || { beats: [], micro: [], tension: {} };
  const RANK = { micro: 0, relief: 1, dread: 2, sting: 3, jump: 4 };

  let inited = false, started = false;
  const pendingMarks = [];
  const holds = new Set();
  let monoShowing = false;
  let accMs = 0, lastEvalPm = -1, evalTimer = 0;
  let lastShowPm = -Infinity, lastDreadPm = -Infinity;
  const readySince = {};     // id → pm when when()+where first held (delayMs / wait30 cap)
  const waitSince = {};      // id → pm when a wait30 beat started waiting
  const worldDelay = {};     // id → pm before which a shifted world beat must not run
  let running = {};          // id → true while an async run is in flight
  let nextMicroPm = null;
  let prevMin = null;
  let endApplied = false, m8Applied = false, droneOn = false;
  let tCur = 0;
  let lastJump = null;       // the last 'clock:jump' payload + pm (snapshot s.lastJump — ep3 data reads it)
  const loopNext = {};       // loop id → pm of its next run (in memory only)
  const opt = (k) => { const bd = BD(); return bd && bd[k] != null ? bd[k] : null; };
  function curWhere() {
    return safeCall(() => { const e = G.ep || G.e2; if (e && e.where) return e.where(); return (G.state && G.state.vars && G.state.vars.where) || 'lv'; }, 'lv');
  }

  /* ---------- guarded access ---------- */
  function safeCall(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function flag(n) { return safeCall(() => !!G.flag(n), false); }
  function pm() { return (G.state && G.state.playMs) || 0; }
  function pmOf(n) {
    const v = safeCall(() => (G.pm ? G.pm(n) : null), null);
    if (v != null) return v;
    const p = G.state && G.state.vars && G.state.vars.pm;
    return p && p[n] != null ? p[n] : null;
  }
  function dir() {
    const vars = (G.state && G.state.vars) || {};
    const d = vars.dir && typeof vars.dir === 'object' && !Array.isArray(vars.dir) ? vars.dir : (vars.dir = {});
    if (!d.fired || Array.isArray(d.fired)) d.fired = {};
    if (!d.jsSpent) d.jsSpent = { b09: false, b14: false };
    if (typeof d.himTone !== 'number') d.himTone = 0;
    if (Array.isArray(d.dropped)) { const o = {}; d.dropped.forEach((id) => { if (typeof id === 'string') o[id] = pm(); }); d.dropped = o; }   // JSON would drop string keys of an array
    if (!d.dropped || typeof d.dropped !== 'object') d.dropped = {};
    return d;
  }
  function save() { safeCall(() => G.save && G.save()); }
  function less() { return safeCall(() => (G.e2 && G.e2.less ? !!G.e2.less() : (G.settings && G.settings.scares !== 'full')), false); }
  function speaker() { return safeCall(() => (G.e2 && G.e2.speaker ? !!G.e2.speaker() : (G.settings && G.settings.audioMode === 'speaker')), false); }
  function isRunning() { return safeCall(() => (G.clock && G.clock.running ? !!G.clock.running() : !document.hidden), !document.hidden); }
  function clockMin() { return safeCall(() => (G.clock && G.clock.minutes ? G.clock.minutes() : null), null); }
  function toMin(hm) {
    const v = safeCall(() => (G.clock && G.clock.toMin ? G.clock.toMin(hm) : null), null);
    if (v != null) return v;
    const [h, m] = String(hm).split(':').map(Number);
    return (h < 12 ? 1440 : 0) + h * 60 + m;
  }
  function passed(hm) {
    const v = safeCall(() => (G.clock && G.clock.passed ? G.clock.passed(hm) : null), null);
    if (v != null) return !!v;
    const m = clockMin();
    return m != null && m >= toMin(hm);
  }
  function user() { return safeCall(() => (G.users && G.users.current ? G.users.current() : (G.state.vars.user || 'n')), 'n'); }
  function roomSnap() {
    const open = safeCall(() => !!(G.room && G.room.isOpen && G.room.isOpen()), false);
    const cur = open ? safeCall(() => (G.room.current && G.room.current()) || {}, {}) : {};
    return { open, mode: cur.mode || null, view: cur.view || null, sub: cur.sub || null, zoom: cur.zoom || 1, closeup: cur.closeup || null };
  }
  function topApp() { return safeCall(() => { const t = G.phone && G.phone.top && G.phone.top(); return t ? t.appId || t.id || null : null; }, null); }
  function cb(k) { return safeCall(() => (G.e2 && G.e2.cb ? G.e2.cb(k) : null), null); }

  /* ---------- fired / mark / spend ---------- */
  D.fired = function (id) { const f = dir().fired[id]; return f == null ? null : f; };
  D.mark = function (id) {
    if (!id) return;
    if (!inited || !G.state) { pendingMarks.push([id, pm()]); return; }
    const d = dir();
    if (d.fired[id] == null) { d.fired[id] = pm(); save(); }
    if (id === 'B09') lastDreadPm = pm();
    safeCall(() => G.bus && G.bus.emit('dir:beat', { id }));
  };
  function unmark(id) { const d = dir(); delete d.fired[id]; save(); }
  D.spend = function (id) {
    const d = dir();
    if (d.jsSpent[id]) return false;
    d.jsSpent[id] = true; save();
    return true;
  };
  D.hold = function (name, on) { if (on) holds.add(name); else holds.delete(name); schedEval(); };

  /* ---------- safe zones (§6.1.3) ---------- */
  D.zones = function () {
    const p = pm();
    const z = {};
    z.S1 = safeCall(() => (G.ui && G.ui.inputActive ? !!G.ui.inputActive() : !!(G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())), false);
    z.S2 = safeCall(() => !!(G.notebook && G.notebook.isOpen && G.notebook.isOpen()), false);
    z.S3 = monoShowing || holds.has('recap') || holds.has('mono');
    z.S4 = safeCall(() => !!(G.users && G.users.switching && G.users.switching()), false);
    z.S5 = safeCall(() => { const st = G.media && G.media.state && G.media.state(); return !!(st && st.playing && (st.from === 'voice' || st.from === 'gallery')); }, false);
    z.S6 = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].some((m) => { const t = pmOf(m); return t != null && flag(m) && p - t < 20000; });
    z.S7 = (() => { const t = pmOf('toneRestored'); return t != null && p - t < 40000; })();
    z.S8 = safeCall(() => !!(G.climax && G.climax.safeZone && G.climax.safeZone()), false) || (() => { const t = pmOf('tankGlow'); return t != null && p - t < 45000; })();
    z.S9 = safeCall(() => !!(G.phone && G.phone.modalOpen && G.phone.modalOpen()), false);
    z.S10 = flag('M8') && !flag('HOOK');
    z.H = holds.size > 0;
    const zf = opt('zones');
    if (typeof zf === 'function') {                                    // ep3: the table is data (ARCH_EP3 §5.16)
      const r = safeCall(() => zf(z), null);
      if (r && typeof r === 'object') { const out = Object.assign({}, r); out.H = z.H; return out; }
    }
    return z;
  };
  function climaxNow() { return flag('M6') && !flag('M7'); }
  /** ep3 safeKinds: does `kind` block now? (any listed zone or a hold) — null when the option is absent (ep2 path) */
  function kindBlocks(kind, z) {
    const sk = opt('safeKinds');
    if (!sk || typeof sk !== 'object') return null;
    const list = sk[kind] || sk.show || [];
    if (z.H) return true;
    return list.some((k) => !!z[k]);
  }
  D.safe = function (kind) {
    const z = D.zones();
    kind = kind || 'show';
    const kb = kindBlocks(kind, z);
    if (kb !== null) return !kb;
    if (kind === 'world') return !z.S1 && !z.S2;                      // decorations (shake / vignette pulse) allowed
    if (kind === 'jump') return !z.S1 && !z.S2;
    if (kind === 'mono') return !(z.S1 || z.S2 || z.S3 || z.S4 || z.S5 || z.S6 || z.S8 || z.H);   // ignores S10 (mono4)
    // show
    if (z.S1 || z.S2 || z.S9 || z.S10 || z.H) return false;
    if (climaxNow()) return true;                                      // M6–M7: S3–S7 do not apply
    return !(z.S3 || z.S4 || z.S5 || z.S6 || z.S7 || z.S8);
  };
  function zoneBlocks(z, onlyS1S2) {
    if (z.S1 || z.S2 || z.H) return true;
    if (onlyS1S2) return false;
    const kb = kindBlocks('show', z);
    if (kb !== null) return kb;
    if (z.S9 || z.S10) return true;
    if (climaxNow()) return false;
    return z.S3 || z.S4 || z.S5 || z.S6 || z.S7 || z.S8;
  }

  /* ---------- snapshot ---------- */
  function snap() {
    return {
      flag, pm, pmOf: (f) => { const v = pmOf(f); return v == null ? Infinity : v; },
      clock: () => safeCall(() => G.clock.now(), new Date()), passed,
      user: user(), room: roomSnap(), app: topApp(),
      firedAt: (id) => D.fired(id), vars: (G.state && G.state.vars) || {},
      lastJump,
    };
  }
  function whereOk(b, s) {
    const w = b.where || 'any';
    if (w === 'any') return true;
    if (w === 'lv' || w === 'sr') return curWhere() === w;              // ep3: {N}'s space (vars.where)
    if (w.startsWith('room:')) { const list = w.slice(5).split(','); return s.room.open && (list.includes(s.room.view) || list.includes(s.room.sub)); }
    if (w.startsWith('user:')) return s.user === w.slice(5);
    if (w.startsWith('app:')) return s.app === w.slice(4);
    return true;
  }
  function milestoneIdx() {
    const order = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'END'];
    let k = -1; order.forEach((m, i) => { if (flag(m)) k = i; });
    return k;
  }

  /* ---------- running a beat ---------- */
  function ctxFor(s, z) {
    return { less: less(), speaker: speaker(), user: s.user, view: s.room.view, zones: z, cb, mark: D.mark, decor: !z.S1 && !z.S2, s, director: D };
  }
  async function runBeat(b, s, z) {
    if (!b || running[b.id]) return;
    if (D.fired(b.id) != null && !b._force) return;
    running[b.id] = true;
    D.mark(b.id);
    if (b.kind === 'show') { lastShowPm = pm(); if (b.cls === 'dread') lastDreadPm = pm(); }
    let res;
    try { res = b.run ? await b.run(ctxFor(s || snap(), z || D.zones())) : undefined; }
    catch (e) { console.error('[director] beat', b.id, e); }
    running[b.id] = false;
    if (res === false && !b._force) {
      // the beat could not happen (e.g. the view changed under it) — allow it again until its `until`
      unmark(b.id); readySince[b.id] = null;
    }
  }
  function findBeat(id) { return (BD().beats || []).find((x) => x.id === id) || null; }
  D.run = function (id) {   // haru.skipTo — ignores when/until/safe
    const b = findBeat(id);
    if (!b || !b.run) return false;
    const copy = Object.assign({}, b, { _force: true });
    runBeat(copy, snap(), D.zones());
    return true;
  };

  /* ---------- evaluation (one show beat per evaluation; world beats on time) ---------- */
  function evaluate() {
    evalTimer = 0;
    if (!started || !G.state) return;
    if (!isRunning()) return;
    const p = pm();
    const s = snap();
    const z = D.zones();
    const d = dir();
    const due = [];
    let showDone = false;
    for (const b of BD().beats || []) {
      if (b.owner !== 'director' || !b.run) continue;
      if (D.fired(b.id) != null || d.dropped[b.id] || running[b.id]) continue;
      let dropNow = false;
      if (b.until) dropNow = safeCall(() => !!b.until(s), false);
      if (dropNow) { d.dropped[b.id] = p; readySince[b.id] = null; save(); continue; }
      const ok = safeCall(() => !!(b.when && b.when(s)), false) && whereOk(b, s);
      if (!ok) { readySince[b.id] = null; waitSince[b.id] = null; continue; }
      if (readySince[b.id] == null) readySince[b.id] = p;
      const dly = typeof b.delayMs === 'function' ? safeCall(() => +b.delayMs(s) || 0, 0) : b.delayMs;
      if (dly && p - readySince[b.id] < dly) continue;
      if (b.kind === 'world' || b.defer === 'world') { due.push(b); continue; }
      // show beats
      if (showDone) continue;
      if (b.defer === 'wait30') {
        if (z.S1 || z.S2 || z.H) continue;                                   // input / notebook: no cap
        if (zoneBlocks(z, false)) {
          if (waitSince[b.id] == null) waitSince[b.id] = p;
          if (p - waitSince[b.id] < 30000) continue;
        }
      } else if (zoneBlocks(z, false)) continue;                             // 'wait'
      if (p - lastShowPm < 25000) continue;
      if (b.cls === 'dread' && !flag('M6')) {
        const gap = flag('M5') ? 40000 : 60000;
        if (p - lastDreadPm < gap) continue;
      }
      showDone = true;
      runBeat(b, s, z);
    }
    if (due.length) {
      due.sort((a, b) => (RANK[b.cls] || 0) - (RANK[a.cls] || 0));
      due.forEach((b, i) => {
        if (i === 0) { if (worldDelay[b.id] && p < worldDelay[b.id]) return; runBeat(b, s, z); return; }
        if (!worldDelay[b.id]) worldDelay[b.id] = p + 1500 * i;            // lower class shifted +1.5 s
        if (p >= worldDelay[b.id]) runBeat(b, s, z);
      });
    }
    lastEvalPm = p;
  }
  function schedEval() {
    if (!started || evalTimer) return;
    evalTimer = setTimeout(evaluate, 30);
  }

  /* ---------- tension (§6.1.5) ---------- */
  /** ep3: data targetT(s) → number | {T, ms} — null when the option is absent (ep2 path) */
  function dataTarget() {
    const bd = BD();
    if (!bd || typeof bd.targetT !== 'function') return null;
    const r = safeCall(() => bd.targetT(snap()), null);
    if (r == null) return { T: 0, ms: 20000 };
    if (typeof r === 'number') return { T: r, ms: 20000 };
    return { T: +r.T || 0, ms: r.ms > 0 ? +r.ms : 20000 };
  }
  function targetT() {
    const dt = dataTarget();
    if (dt) return dt.T;
    const tt = BD().tension || {};
    if (flag('END')) return tt.END != null ? tt.END : 0;
    if (flag('M8')) return tt.M8 != null ? tt.M8 : 0.2;
    if (flag('M7')) {
      const t0 = pmOf('M7');
      const el = t0 == null ? 0 : pm() - t0;
      const hi = tt.M7 != null ? tt.M7 : 1, lo = tt.M7end != null ? tt.M7end : 0.3;
      return Math.max(lo, hi - (hi - lo) * Math.min(1, el / 40000));
    }
    for (const m of ['M6', 'M5', 'M4', 'M3', 'M2', 'M1', 'M0']) if (flag(m)) return tt[m] != null ? tt[m] : 0;
    return 0;
  }
  D.T = function () { return tCur; };
  function stepTension(dtMs) {
    const dt = dataTarget();
    if (dt) {                                                          // ep3: data target + its own convergence time (≈ 95 % in ms)
      tCur += (dt.T - tCur) * (1 - Math.exp(-dtMs / Math.max(300, dt.ms / 3)));
      if (Math.abs(dt.T - tCur) < 0.002) tCur = dt.T;
      dir().T = Math.round(tCur * 1000) / 1000;
      applyTension();
      return;
    }
    const target = targetT();
    if (flag('M7') && !flag('M8')) {
      // the M7 curve is itself the 40 s fall — follow it closely (fast attack to 1.0)
      tCur += (target - tCur) * Math.min(1, dtMs / 1500);
    } else {
      tCur += (target - tCur) * (1 - Math.exp(-dtMs / 6700));   // ≈ 95 % in 20 s
    }
    if (Math.abs(target - tCur) < 0.002) tCur = target;
    dir().T = Math.round(tCur * 1000) / 1000;
    applyTension();
  }
  function applyTension() {
    safeCall(() => { if (G.audio && G.audio.tension) G.audio.tension(tCur); });
    const vf = opt('vignette');
    const vig = typeof vf === 'function' ? safeCall(() => Math.max(0, Math.min(1, +vf(tCur) || 0)), 0) : 0.30 + 0.40 * tCur;
    safeCall(() => {
      if (G.fx && G.fx.setVignette) G.fx.setVignette(vig);
      else { const scr = document.getElementById('screen'); if (scr) scr.style.setProperty('--vig', String(vig)); }
    });
  }

  /* ---------- ambience driven by state (drone, '—' detune, M8, END) ---------- */
  function amb(id, on, o) { safeCall(() => { if (G.audio && G.audio.amb) G.audio.amb(id, on, o || {}); }); }
  function syncAmbience() {
    const am = opt('ambience');
    if (am && typeof am === 'object') {                                // ep3: only what the data turns on (ep3: nothing)
      if (am.drone) {
        const want = flag('M1') && !flag('M8');
        if (want && !droneOn) { droneOn = true; amb('drone', true, { fade: 4 }); }
        if (!want && droneOn) { droneOn = false; amb('drone', false, { fade: 8 }); }
      }
      if (flag('END') && !endApplied) {
        endApplied = true;
        if (am.endWind) amb('roofWind', true, { gainDb: -9, fade: 6 });
        if (am.gsm) safeCall(() => { const g = G.audio && G.audio.gsmTank; if (g && g.fadeTo) g.fadeTo(0, 3000); });
      }
      return;
    }
    const wantDrone = flag('M1') && !flag('M8');
    if (wantDrone && !droneOn) { droneOn = true; amb('drone', true, { fade: 4 }); }
    if (flag('M8') && !m8Applied) { m8Applied = true; droneOn = false; amb('drone', false, { fade: 8 }); }
    if (flag('END') && !endApplied) {
      endApplied = true;
      amb('roofWind', true, { gainDb: -9, fade: 6 });
      amb('drone', false, { fade: 3 });
      safeCall(() => { const g = G.audio && G.audio.gsmTank; if (g && g.fadeTo) g.fadeTo(0, 3000); });
    }
  }
  function onSwitched(e) {
    const to = e && e.to;
    safeCall(() => {
      if (!G.audio || !G.audio.droneDetune) return;
      if (to === 'dash') G.audio.droneDetune(-100, 2); else if (to === 'n') G.audio.droneDetune(0, 4);
    });
    schedEval();
  }

  /* ---------- 00:00 compensation (§6.1.7) ---------- */
  function sched() { return G.e2 && G.e2.sched ? G.e2.sched : null; }
  function checkMidnight() {
    if (opt('midnight') === false) return;                             // ep3: the night never crosses 00:00
    const m = clockMin();
    if (m == null) return;
    const MID = 1440;
    if (D.fired('B07') == null && m >= MID) {
      const sc = sched();
      const pending = sc && sc.has ? safeCall(() => sc.has('dir:B07'), false) : false;
      if (!pending) {
        if (prevMin != null && prevMin < MID && m === MID) runBeat(findBeat('B07'));            // the clock flowed into 00:00
        else if (sc && sc.after) safeCall(() => sc.after(2000, 'dir:B07'));                       // skipped (jump) or resumed past it
        else setTimeout(() => runBeat(findBeat('B07')), 2000);
      }
    }
    prevMin = m;
  }

  /* ---------- micro ambience (§6.1.6) ---------- */
  function inForbidden(az) { return (BD().microForbidden || [[50, 80], [105, 125]]).some(([a, b]) => az >= a && az <= b); }
  /** ep3 record fields (where · when · once) filter the list; ep2 records carry none of them → the same list */
  function microEligible(x, s) {
    if (!x || !x.id) return false;
    if (x.where && x.where !== 'any' && x.where !== curWhere()) return false;
    if (x.when && !safeCall(() => !!x.when(s), false)) return false;
    if (x.once && D.fired(x.key || x.id) != null) return false;
    return true;
  }
  function pickMicro(s) {
    const list = (BD().micro || []).filter((x) => microEligible(x, s));
    if (!list.length) return null;
    const tot = list.reduce((a, x) => a + (x.weight || 1), 0);
    let r = Math.random() * tot;
    for (const x of list) { r -= x.weight || 1; if (r <= 0) return x; }
    return list[list.length - 1];
  }
  function microTick() {
    const ma = opt('microActive');
    const s = typeof ma === 'function' ? snap() : null;
    const active = typeof ma === 'function' ? safeCall(() => !!ma(s), false) : flag('M1') && !flag('M6');
    if (!active) { nextMicroPm = null; return; }
    const p = pm();
    const mg = opt('microGap');
    const gapMs = typeof mg === 'function'
      ? () => Math.max(1000, safeCall(() => +mg(tCur) || 120000, 120000))
      : () => (120 - 75 * tCur) * 1000 * (0.7 + Math.random() * 0.6);
    if (nextMicroPm == null) { nextMicroPm = p + gapMs(); return; }
    if (p < nextMicroPm) return;
    nextMicroPm = p + gapMs();
    if (kindBlocks('micro', D.zones()) === true) return;              // ep3: a turn that falls in S1–S10 is skipped (§6.1.6)
    const m = pickMicro(s || snap());
    if (!m) return;
    const sr = m.where === 'sr';                                       // sr rows are in the LS frame — the front-door rule is L0's
    let az = 0;
    for (let tries = 0; tries < 6; tries++) {
      const ranges = m.az || [[0, 360]];
      const [a, b] = ranges[Math.floor(Math.random() * ranges.length)];
      az = Math.round(a + Math.random() * (b - a)) % 360;
      if (sr || !inForbidden(az)) break;
    }
    if (!sr && inForbidden(az)) return;
    if (m.once) D.mark(m.key || m.id);
    if (typeof m.run === 'function') safeCall(() => m.run({ az, s: s || snap() }));
    else safeCall(() => { if (G.audio && G.audio.cue) G.audio.cue(m.id, { az, el: m.el }); });
    if (m.sub) safeCall(() => { if (G.audio && G.audio.sub) G.audio.sub(m.sub, { az }); });
  }

  /* ---------- ep3 world loops (BD().loops — W01 · W03) ---------- */
  function loopTick() {
    const loops = opt('loops');
    if (!Array.isArray(loops) || !loops.length) return;
    const p = pm(), s = snap(), z = D.zones();
    loops.forEach((L) => {
      if (!L || !L.id) return;
      const on = safeCall(() => !!(L.when && L.when(s, z)), false);
      if (!on) { loopNext[L.id] = null; return; }
      const gap = () => Math.max(1000, safeCall(() => +L.gapMs() || 30000, 30000));
      if (loopNext[L.id] == null) { loopNext[L.id] = p + gap(); return; }
      if (p < loopNext[L.id]) return;
      loopNext[L.id] = p + gap();
      if (D.fired(L.id) == null) D.mark(L.id);
      safeCall(() => L.run && L.run({ s, zones: z }));
    });
  }

  /* ---------- tick ---------- */
  function onTick(e) {
    if (!started) return;
    let dt = 250;
    if (e && typeof e.dt === 'number') dt = e.dt;
    else if (e instanceof Date) dt = 1000;                 // ep1-style emitter fallback
    if (!isRunning()) return;
    accMs += Math.max(0, Math.min(dt, 1000));
    if (accMs < 1000) return;
    const step = accMs; accMs = 0;
    stepTension(step);
    syncAmbience();
    checkMidnight();
    microTick();
    loopTick();
    evaluate();
  }

  /* ---------- sched handlers ---------- */
  function registerSched() {
    const sc = sched();
    if (!sc || !sc.on) return;
    safeCall(() => sc.on('dir:B07', () => runBeat(findBeat('B07'))));
    safeCall(() => sc.on('dir:b09cue', () => runBeat(findBeat('B09p'))));
  }
  function ensureB09Cue() {
    if (!flag('M4') || D.fired('B09p') != null) return;
    const sc = sched(); const t = pmOf('M4');
    if (!sc || t == null) return;
    if (!safeCall(() => sc.has('dir:b09cue'), false)) safeCall(() => sc.at(t + 30000, 'dir:b09cue'));
  }

  /* ---------- lifecycle ---------- */
  D.init = function () {
    if (inited) return;
    inited = true;
    dir();
    pendingMarks.splice(0).forEach(([id, at]) => { const d = dir(); if (d.fired[id] == null) d.fired[id] = at; safeCall(() => G.bus && G.bus.emit('dir:beat', { id })); });
    registerSched();
    if (!G.bus) return;
    G.bus.on('tick', onTick);
    ['flag', 'flag:off', 'keyboard', 'notebook:open', 'notebook:close', 'media:play', 'media:stop', 'room:view', 'room:zoom',
      'room:open', 'room:close', 'app:open', 'screen:push', 'screen:pop', 'home', 'clock:min', 'users:switching', 'lock:unlock']
      .forEach((ev) => G.bus.on(ev, schedEval));
    G.bus.on('mono:show', () => { monoShowing = true; });
    G.bus.on('mono:hide', () => { monoShowing = false; schedEval(); });
    G.bus.on('users:switched', onSwitched);
    G.bus.on('clock:jump', (j) => { if (j && typeof j === 'object') lastJump = { from: j.from, to: j.to, skipped: j.skipped || [], pm: pm() }; checkMidnight(); schedEval(); });
    G.bus.on('flag:M4', () => { ensureB09Cue(); });
    G.bus.on('visibility', (v) => { if (v && !v.hidden) { accMs = 0; schedEval(); } });
  };
  D.start = function () {
    if (!inited) D.init();
    if (started) return;
    started = true;
    tCur = typeof dir().T === 'number' ? dir().T : targetT();
    applyTension();
    droneOn = false; m8Applied = false; endApplied = false;
    syncAmbience();
    if (user() === 'dash') safeCall(() => G.audio && G.audio.droneDetune && G.audio.droneDetune(-100, 0.5));
    ensureB09Cue();
    prevMin = null;
    checkMidnight();
    schedEval();
  };
  D.stop = function () { started = false; clearTimeout(evalTimer); evalTimer = 0; };
  D.isStarted = function () { return started; };
  D.isSafe = function () { return D.safe('show'); };   // ep1 name (G.sd.isSafe compatibility)

  /* ---------- DEBUG: haru.skipTo (G.DEBUG only — config.ep2.js folds ?debug=1 in and ignores it on the release host) ---------- */
  if (G.DEBUG) {
    window.haru = window.haru || {};
    window.haru.skipTo = function (id) {
      id = String(id || '').replace('′', 'p');
      if (D.run(id)) return true;
      // runners owned by other flow files
      const map = { B20: () => G.ending && G.ending.debugM8 && G.ending.debugM8(), B23: () => G.hook && G.hook.start && G.hook.start(),
        B01: () => G.scenes && G.scenes.coldOpen && G.scenes.coldOpen(),
        // ep3 runners (records that are documentation-only in ep3's beats.js — inert on ep2, whose B04 has its own run)
        B04: () => G.call && G.call.startNow && G.call.startNow(), B18: () => G.ending && G.ending.start && G.ending.start({ by: 'played' }),
        B21: () => G.hook && G.hook.start && G.hook.start() };
      if (map[id]) { map[id](); D.mark(id); return true; }
      console.warn('[director] skipTo: no runnable record for', id);
      return false;
    };
  }
})();
