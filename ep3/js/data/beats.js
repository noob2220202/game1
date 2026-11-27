/* =========================================================
 * ep3/js/data/beats.js (flow) — G.BEATDATA3 (+ the alias G.BEATDATA2 the director reads): every beat id of DESIGN_EP3 §6.2
 * (B00–B21 · W01–W05 · W11 · W12 · W12b), the §6.1.6 micro list, the §6.1.5 tension table and the ARCH_EP3 §5.16 data
 * options (zones · safeKinds · ambience · midnight · microActive · microGap · microForbidden · targetT · vignette · loops).
 * Record format = §6.1.2 (cls without 'jump'): { id, cls, kind, owner, when(s), until(s), where, defer, delayMs, run(ctx) }.
 *   Only owner:'director' records with a run() are evaluated by engine/director.js (W05 · W11 · W12). Every other record is
 *   documentation of the runner map (ARCH §5.16) — its owner runs it and calls G.director.mark(id).
 * Snapshot `s` (engine): flag pm pmOf clock passed user room app firedAt vars lastJump · helpers here: where() momAt()
 *   jumpedOver(s, hm) (from the director's last clock:jump — DESIGN §6.1.7 compensation: boiler +2 s after a jump over 04:10).
 * Grief episode: jumps 0 · no cls:'jump' · no sting.* cue · no silenceDrop · the fridge never stops. HARD MODE — no nudges.
 * Pure data at load time: every when/run is lazy and guards each call into another owner.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* ---------- guarded helpers (called only while the director evaluates / runs) ---------- */
  function A() { return G.audio || {}; }
  function cue(id, o) { try { const a = A(); return a.cue ? a.cue(id, o || {}) : undefined; } catch (e) { console.error('[beats] cue', id, e); return undefined; } }
  function sub(id, o) { try { const a = A(); if (a.sub) a.sub(id, o || {}); } catch (e) { console.error('[beats] sub', id, e); } }
  function pulse(kind) { try { if (G.room && G.room.pulse) G.room.pulse(kind); } catch (e) { console.error('[beats] pulse', e); } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function pm() { return (G.state && G.state.playMs) || 0; }
  function pmOf(n) { try { const v = G.pm ? G.pm(n) : null; return v == null ? null : v; } catch (e) { return null; } }
  function E() { return G.ep || G.e3 || G.e2 || {}; }
  function where() { try { const e = E(); if (e.where) return e.where(); } catch (e) {} return (G.state && G.state.vars && G.state.vars.where) || 'lv'; }
  function momAt() { try { const e = E(); if (e.momAt) return e.momAt(); } catch (e) {} return (G.state && G.state.vars && G.state.vars.momAt) || 'table'; }
  function less() { try { const e = E(); return e.less ? !!e.less() : !!(G.settings && G.settings.scares !== 'full'); } catch (e) { return false; } }
  function toMin(hm) { try { if (G.clock && G.clock.toMin) return G.clock.toMin(hm); } catch (e) {} const p = String(hm).split(':').map(Number); return (p[0] < 12 ? 1440 : 0) + p[0] * 60 + p[1]; }
  /** did the last clock jump skip over `hm`? (skipped list, or from < hm ≤ to) */
  function jumpedOver(s, hm) {
    const j = s && s.lastJump;
    if (!j) return false;
    if (Array.isArray(j.skipped) && j.skipped.indexOf(hm) >= 0) return true;
    const m = toMin(hm);
    return j.from != null && j.to != null && toMin(j.from) < m && m <= toMin(j.to);
  }
  // the '퍽' of boiler.fire lands ≈ 0.8 s after the relay click (딸깍 → 틱틱틱 0.6 s → 퍽) — glow and subtitle sit on it (§6.3 · §7.4)
  const PUH_MS = 800;
  function boiler(n, subId) {
    cue('boiler.fire', { n, src: 'boiler' });
    setTimeout(() => { pulse('boiler'); if (subId) sub(subId, { az: 90 }); }, PUH_MS);
  }

  /* ---------- beats (§6.2) ---------- */
  const beats = [
    { id: 'B00', cls: 'micro', kind: 'world', owner: 'scenes', note: '§3.0 title → content warning → earphone test (bell.small 270° → 90°) → (recap)' },
    { id: 'B01', cls: 'relief', kind: 'world', owner: 'scenes', note: 'introDone → M0 03:20: 2 s black → amb.fridge 2.0 · amb.clock 4.0 · breath.jimin 6.0 · breath.kongi + amb.air + amb.apt 8.0 → r3_door eye view 9.0 (1.2 s)' },
    { id: 'W01', cls: 'micro', kind: 'world', owner: 'director', note: 'loop (BD().loops) — mom.idle every 25–50 s at 270° while 엄마 sits at the table (03:20 → preroll)' },
    { id: 'B02', cls: 'relief', kind: 'show', owner: 'scenes', note: 'first 270° view ∨ M0 + 40 s = momLine1 — 엄마 first line (cb.A / neutral) + chair.creak → +4 s 오늘이 세아 생일이에요.' },
    { id: 'W02', cls: 'micro', kind: 'world', owner: 'none', note: '03:31 — nothing (QA: no new source 03:30:30–03:31:59)' },
    { id: 'B03', cls: 'dread', kind: 'world', owner: 'call0333', note: 'preroll t −20 (03:32:40): phone.flip / glass.set (cb.A) + situation card' },
    { id: 'B04', cls: 'dread', kind: 'world', owner: 'call0333', note: 'M1 03:33:00 first ring (callRing) → 03:33:06 callAnswered → 03:33:39 callEnded — §3.1 table, S01–S05, vibrate ring3 once' },
    { id: 'B05', cls: 'relief', kind: 'world', owner: 'call0333', note: '03:34 (jump callEnd) phone.set → ≈50 phone.slide + c3_mom_hands → handover cards 1–6' },
    { id: 'B06', cls: 'relief', kind: 'world', owner: 'call0333', note: 'handover card 6 → chair · slippers 270°→30° · door.sr · switch.lamp · kongi.settle → handover · momAt sr → lock' },
    { id: 'B07', cls: 'relief', kind: 'world', owner: 'easymode', note: 'gotPhone (shell lock — ui.unlock, G.EP.LOCK.beat)' },
    { id: 'W03', cls: 'micro', kind: 'world', owner: 'director', note: 'loop (BD().loops) — mom.srIdle every 70–140 s while momAt sr (03:35–04:40), never in S4' },
    { id: 'B08', cls: 'relief', kind: 'world', owner: 'easymode', note: 'M2 easyOff — E8 unfold (ui.tap + ez.unfold)' },
    { id: 'W04', cls: 'micro', kind: 'world', owner: 'comms', note: 'M2 + 40 s — 03:41 SMS (kang341, banner + sms.mom through notify)' },
    { id: 'B09', cls: 'relief', kind: 'show', owner: 'core', note: 'mono1 — leaving the sea0333 text screen after nameKnown (G.e3.mono queue)' },
    { id: 'B10', cls: 'micro', kind: 'world', owner: 'core', note: 'M3 · M4 · M5 — status-bar clock only' },

    /* W05 — 04:10 boiler 1 (+2 s after a jump over it) · S10 on the first firing only */
    { id: 'W05', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('gotPhone') && !s.flag('M8') && s.passed('04:10'),
      until: (s) => s.flag('M8'),
      delayMs: (s) => (jumpedOver(s, '04:10') ? 2000 : 0),
      run: () => { boiler(1, 'S10'); } },

    { id: 'B11', cls: 'relief', kind: 'show', owner: 'core', note: 'mono2 — first close of a door photo after albumDone (G.e3.mono queue · M6 window rule)' },
    { id: 'B12', cls: 'micro', kind: 'world', owner: 'door', defer: 'm6', note: 'M5 + 60 s wait → M6 defer ≤ 40 s (S1 S2 S4 S7 S8 S9 clear 3 s) — room door.js' },
    { id: 'B13', cls: 'dread', kind: 'world', owner: 'door', defer: 'm6', note: 'M6 04:40:00 — the 04:40 set piece (big dread 1 · jumps 0) — room door.js' },
    { id: 'B14', cls: 'relief', kind: 'world', owner: 'memory', note: 'M7 05:05 cards → sr B · callback D / hum.mom — room memory.js' },

    /* W11 — 05:10 boiler 2, or memoryDone + 6 s while still before M8 (§6.1.7 · §0.3 D15) · S11 mood */
    { id: 'W11', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('M7') && !s.flag('M8') && (s.passed('05:10') || (s.flag('memoryDone') && s.pm() >= s.pmOf('memoryDone') + 6000)),
      until: (s) => s.flag('M8'),
      run: () => { boiler(2, 'S11'); } },

    { id: 'B15', cls: 'relief', kind: 'world', owner: 'memory', note: 'memory cards (memoryStart → memoryDone) — room memory.js' },
    { id: 'B16', cls: 'relief', kind: 'world', owner: 'climax', note: 'M8 cards → playArmed — room climax.js' },
    { id: 'B17', cls: 'relief', kind: 'world', owner: 'climax', note: 'playback sessions after playArmed — room climax.js' },
    { id: 'B18', cls: 'relief', kind: 'world', owner: 'ending', note: 'END 05:30 — END cut, the first 딸랑 (collarOn), settle cut — flow ending.js' },
    { id: 'B19', cls: 'relief', kind: 'world', owner: 'ending', note: 'tail 05:35–06:00 — cards + chips only — flow ending.js' },

    /* W12 — 05:40 first bus (the END card row holds 05:40 until ending jumps on) · S22 mood */
    { id: 'W12', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('END') && s.passed('05:40'),
      until: (s) => s.flag('HOOK'),
      run: () => { cue('bus.far', { src: 'road' }); sub('S22', { az: 90 }); } },
    { id: 'W12b', cls: 'micro', kind: 'world', owner: 'ending', note: 'second bus (bus.far −2 dB) 2 s after the 05:40 지민 line 그거 하면서… — flow ending.js' },

    { id: 'B20', cls: 'relief', kind: 'world', owner: 'ending', note: '06:00 c3_window card → credits (piano.ab · S21) → check card (all sound → 0 in 2 s)' },
    { id: 'B21', cls: 'sting', kind: 'world', owner: 'hook', note: 'HOOK 06:10 — black 2 s → c3_phone_ring blocked messages → pushed line + boiler.fire n 3 (the soft sting 1, no subtitle)' },
  ];

  /* ---------- micro ambience (§6.1.6) — where = vars.where (sr rows use LS azimuths, outside the front-door rule) ---------- */
  const between = (a, b) => a + Math.random() * (b - a);
  const micro = [
    { id: 'm.creak', weight: 3, az: [[120, 310]], where: 'lv', run: ({ az }) => cue('m.creak', { az, dist: between(2, 4), el: between(-10, 30) }) },
    { id: 'm.fridgeTick', weight: 1, az: [[255, 255]], where: 'lv', run: ({ az }) => cue('m.fridgeTick', { az, dist: 3.5, el: 0 }) },
    { id: 'm.kongiSigh', weight: 2, az: [[30, 30]], where: 'lv', when: (s) => !s.flag('M6'), run: () => cue('m.kongiSigh', { src: 'kongiSr' }) },
    { id: 'm.jiminTurn', weight: 1, az: [[185, 185]], where: 'lv', when: (s) => !s.flag('jiminUp'), run: ({ az }) => cue('m.jiminTurn', { az, dist: 2.4, el: -10 }) },
    { id: 'm.carFar', weight: 2, az: [[60, 120]], where: 'lv', run: ({ az }) => cue('m.carFar', { az, dist: 60, el: -40 }) },
    { id: 'm.gust', weight: 1, az: [[90, 90]], where: 'lv', run: ({ az }) => cue('m.gust', { az, dist: 3 }) },
    { id: 'm.upstairs', weight: 1, az: [[195, 205]], where: 'lv', once: true, when: (s) => !s.flag('M5'),
      run: ({ az }) => cue('m.upstairs', { az, dist: 4, el: 70 }) },
    { id: 'm.srWindow', weight: 2, az: [[160, 160]], where: 'sr', run: ({ az }) => cue('m.srWindow', { az, dist: 1.7, listener: 'LS' }) },
    { id: 'm.creak', key: 'm.creak.sr', weight: 2, az: [[0, 150]], where: 'sr', run: ({ az }) => cue('m.creak', { az, dist: between(1.2, 2.4), listener: 'LS' }) },
  ];

  G.BEATDATA3 = {
    beats, micro,
    tension: { M0: 0.10, M1: 0.25, gotPhone: 0.20, M2: 0.28, M3: 0.38, M4: 0.48, M5: 0.60, M6: 0.80, M6peak: 0.92, M6patrol: 0.55,
      M6sms: 0.45, M7: 0.25, M8: 0.12, END: 0, HOOK: 0.30 },          // §6.1.5 — the data function targetT(s) below wins
    /** §6.1.5 table: a plain number converges over 20 s; { T, ms } sets the convergence time */
    targetT(s) {
      const t = (G.BEATDATA3 && G.BEATDATA3.tension) || {};
      if (s.flag('HOOK')) return { T: t.HOOK, ms: 3000 };
      if (s.flag('END')) return { T: t.END, ms: 3000 };
      if (s.flag('M8')) return t.M8;
      if (s.flag('M7')) return t.M7;
      if (s.flag('M6')) {
        if (s.flag('kang502')) return t.M6sms;
        if (s.flag('patrol')) return t.M6patrol;
        const m6 = s.pmOf('M6');
        const el = m6 === Infinity ? 0 : s.pm() - m6;
        if (s.flag('bip') || el >= 900) return { T: t.M6peak, ms: 4000 };   // t 0.9 → .92 by 04:40:05
        return t.M6;
      }
      for (const m of ['M5', 'M4', 'M3', 'M2', 'gotPhone', 'M1', 'M0']) if (s.flag(m)) return t[m];
      return 0;
    },
    zones: (base) => ({
      S1: base.S1, S2: base.S2, S3: base.S3,
      S4: (() => { try { const st = G.callrec && G.callrec.state ? G.callrec.state() : null; return !!((st && st.playing) || (G.callrec && G.callrec.sinceStopMs && G.callrec.sinceStopMs() < 2000)); } catch (e) { return false; } })(),
      S5: (() => { try { return !!(G.callrec && G.callrec.textOpen && G.callrec.textOpen()); } catch (e) { return false; } })(),
      S6: ['M1', 'M2', 'M3', 'M4', 'M5'].some((m) => { const t = pmOf(m); return t != null && flag(m) && pm() - t < 20000; }),   // §6.1.3 S6 = M1–M5 + 20 s
      S7: (() => { try { return !!(G.cards && G.cards.showing && G.cards.showing()); } catch (e) { return false; } })(),
      S8: (() => { try { return !!(G.chips && G.chips.isOpen && G.chips.isOpen()); } catch (e) { return false; } })(),
      S9: (() => { try { return !!((G.phone && G.phone.inCall && G.phone.inCall()) || (G.phone && G.phone.modalOpen && G.phone.modalOpen())); } catch (e) { return false; } })(),
      S10: flag('M7') && !flag('HOOK'),
    }),
    safeKinds: { show: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'], mono: ['S1', 'S2', 'S3', 'S4', 'S6', 'S7', 'S8', 'S9'],
      world: ['S1', 'S2'], m6: ['S1', 'S2', 'S4', 'S7', 'S8', 'S9'], micro: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'] },
    ambience: { drone: false, gsm: false, endWind: false }, midnight: false,
    microActive: (s) => s.flag('gotPhone') && !s.flag('M6'),
    microGap: () => 110000 + Math.random() * 60000,
    microForbidden: [[335, 360], [0, 25]],
    /** §6.1.5 — .20 + .30T; END .10; HOOK back on the T law (T .30 for the cut, vignette only); 덜 무섭게 0 */
    vignette: (T) => (less() ? 0 : (flag('END') && !flag('HOOK')) ? 0.10 : 0.20 + 0.30 * T),
    loops: [   // repeating world loops — not beats; not persisted, restart on resume
      { id: 'W01', when: (s) => s.flag('M0') && !(s.vars && s.vars.seq && s.vars.seq.m1) && !s.flag('M1'),
        gapMs: () => 25000 + Math.random() * 25000,
        run: () => cue('mom.idle', { src: 'momSeat' }) },
      { id: 'W03', when: (s, z) => momAt() === 'sr' && !s.flag('M6') && !(z && z.S4),
        gapMs: () => 70000 + Math.random() * 70000,
        run: () => cue('mom.srIdle', { src: 'srMom' }) },
    ],
    // snapshot helpers for other readers (QA)
    where, momAt, jumpedOver,
  };
  G.BEATDATA2 = G.BEATDATA3;   // §9.1 alias — engine/director.js keeps reading BEATDATA2
})();
