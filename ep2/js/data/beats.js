/* =========================================================
 * ep2/js/data/beats.js (flow) — G.BEATDATA2: every beat of DESIGN_EP2 §6.2 (+ §3.15 anchors, §6.1.6 micro,
 * §6.1.5 tension). Record format = §6.1.2 + `owner` (ARCH §4.18):
 *   { id, cls:'micro'|'dread'|'relief'|'jump'|'sting', kind:'world'|'show', owner, when(s), until(s),
 *     where:'any'|'room:<view>,<view>'|'user:n'|'app:<id>', defer:'world'|'wait'|'wait30', delayMs, run(ctx) }
 * Only `owner:'director'` records are evaluated/run by engine/director.js. Every other record is documentation
 * of the runner map (the owner runs it and calls G.director.mark(id)); haru.skipTo can still reach some of them.
 * Snapshot `s` (director): flag(f) pm() pmOf(f) clock() passed(hm) user room:{open,mode,view,sub,zoom} app firedAt(id) vars
 * ctx: { less, speaker, user, view, zones, cb, mark, decor, s }
 * No watcher lines, no look-away, no nudges, no knock — HARD MODE (ARCH §1). Primed ids are ASCII: B09′ → 'B09p'.
 * Pure data at load time: run()/when() are lazy and guard every call into other owners.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* guarded helpers (called only when a beat runs) */
  function A() { return G.audio || {}; }
  function cue(id, o) { try { const a = A(); return a.cue ? a.cue(id, o || {}) : undefined; } catch (e) { console.error('[beats] cue', id, e); } }
  function sub(id, o) { try { const a = A(); if (a.sub) a.sub(id, o || {}); } catch (e) { console.error('[beats] sub', id, e); } }
  function gsm() { return A().gsmTank || null; }
  function gsmStarted() { try { const g = gsm(); return !!(g && g.started && g.started()); } catch (e) { return false; } }
  function vibrate(key, ctx) { if (ctx && ctx.less) return; try { const a = A(); if (a.vibrate) a.vibrate(key); } catch (e) {} }
  const inWindow = (s) => !!(s.room && s.room.open && s.room.mode !== 'eye' && (s.room.view === 'r2_window' || s.room.sub === 'roof_tank'));

  const beats = [
    /* ---------- B00–B03: flow scenes / shell lock (documentation — they mark themselves) ---------- */
    { id: 'B00', cls: 'micro', kind: 'world', owner: 'scenes', note: '§3.0 title → content warning → earphone test (bell.small 270° → 90°)' },
    { id: 'B01', cls: 'dread', kind: 'world', owner: 'scenes', note: '§3.1 cold open 22 s: roofWind + bells ×2 · 4.0 cloth.rustle · 6.0 gravel dry ×7 0°→70° · 10.5–13.0 hinge.none · 13.0 box15 · 16.0 eye view r2_door (mark B01) + S00' },
    { id: 'B02', cls: 'micro', kind: 'world', owner: 'scenes', note: 'gotPhone → box15.cut() → wind 1.2 s → doorlock.close → lock screen' },
    { id: 'B03', cls: 'micro', kind: 'world', owner: 'lock', note: 'M1 — first unlock, no sound (silence is the signal)' },

    /* ---------- B04: first window view after M1 → GSM .08 at 70° (show · wait) ---------- */
    { id: 'B04', cls: 'micro', kind: 'show', owner: 'director', where: 'room:r2_window', defer: 'wait',
      when: (s) => s.flag('M1') && inWindow(s) && !gsmStarted(),
      until: (s) => s.firedAt('B09p') != null || gsmStarted(),
      run: () => { const g = gsm(); if (g && g.start) g.start(0.08); sub('S01', { az: 70 }); } },

    { id: 'W01', cls: 'micro', kind: 'world', owner: 'room', note: '23:30 newphone 0% → 2% (layer)' },

    /* ---------- B05: M2 23:41 — desk boot chime (world) ---------- */
    { id: 'B05', cls: 'dread', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('M2'),
      run: (ctx) => {
        cue('boot.chime', { az: 270, dist: 1.0, el: -20, gainDb: ctx.less ? -3 : 0 });
        cue('buzz.desk', { n: 2, az: 270, dist: 1.0 });
        vibrate('m2', ctx);
        sub('S02', { az: 270 });
      } },

    /* ---------- W02: 23:43 ∧ M2 — reboot chime −8 dB (world). Dropped if the clock jumped past it. ---------- */
    { id: 'W02', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('M2') && s.passed('23:43'),
      until: (s) => s.passed('23:45'),
      run: () => { cue('boot.chime', { az: 270, dist: 1.0, el: -20, gainDb: -8 }); sub('S02', { az: 270 }); } },

    { id: 'B06', cls: 'micro', kind: 'world', owner: 'social', note: '23:45~ restricted messages pile up — no sound, no badge' },
    { id: 'W03', cls: 'micro', kind: 'world', owner: 'social', note: 'tonight messages by clock (silent)' },

    /* ---------- W04: 23:50 snow L1 0→1 (room layer) + amb.snow + snowy steps (world) ---------- */
    { id: 'W04', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.passed('23:50'),
      run: (ctx) => { try { const a = A(); if (a.amb) a.amb('snow', true, { fade: ctx.s.passed('23:52') ? 8 : 60 }); } catch (e) {} } },

    /* ---------- B08: M3 — room tone LP 1.2 kHz 30 s (less 20 s); the drone −1 semitone follows the '—' user ---------- */
    { id: 'B08', cls: 'dread', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('M3'),
      run: (ctx) => { try { const a = A(); if (a.roomLP) a.roomLP(1200, ctx.less ? 20000 : 30000); } catch (e) {} } },

    /* ---------- B07: 00:00 — calendar N05 + church bell ×12 + S03 (world, event-driven: clock passes 00:00 → now,
         clock jumped over it → sched 'dir:B07' +2 000 ms — §6.1.7). `when` stays false: the director triggers it. ---------- */
    { id: 'B07', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: () => false,
      run: () => {
        try {
          const ev = (G.STORY && G.STORY.events && G.STORY.events.notif0000) || null;
          if (ev && G.phone && G.phone.notify) G.phone.notify(Object.assign({}, ev, { id: 'N05', user: 'n' }));
        } catch (e) { console.error('[beats] B07 notify', e); }
        cue('church.bell', { n: 12, gap: 3.2, az: 200 });
        sub('S03');                                     // §7.4 S03 position '하단' (subs.js az null) — not a direction sub
      } },

    /* ---------- B09′ ('B09p'): M4 + 30 s — GSM .08 → .15 for 2 s, anywhere (world) → flag b09Cue ---------- */
    { id: 'B09p', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.flag('M4') && s.pm() >= s.pmOf('M4') + 30000,
      run: () => {
        const first = !gsmStarted();
        try { const g = gsm(); if (g && g.pulse) g.pulse({ peak: 0.15, upMs: 500, holdMs: 1000, downMs: 500, arc: true }); } catch (e) {}
        if (first) sub('S01', { az: 70 });
        try { G.flag('b09Cue', true); } catch (e) {}
      } },

    /* ---------- B09: the phone light in the tank-room door gap (big dread 1 · show · wait · 1.5 s settle) ---------- */
    { id: 'B09', cls: 'dread', kind: 'show', owner: 'director', where: 'room:r2_window,roof_tank', defer: 'wait', delayMs: 1500,
      when: (s) => s.flag('M4') && s.pm() >= s.pmOf('M4') + 30000 && inWindow(s),
      until: (s) => s.flag('M6') || s.pm() >= Math.min(s.flag('M5') ? s.pmOf('M5') + 90000 : Infinity, s.firedAt('B12') != null ? s.firedAt('B12') : Infinity),
      run: async (ctx) => {
        if (!G.room || !G.room.playTankGlow) return false;
        const variant = ctx.cb('js1') ? 'hand' : 'cap';
        const p = G.room.playTankGlow({ variant, holdMs: ctx.less ? 1200 : 2400 });
        if (!ctx.less) setTimeout(() => { try { const g = gsm(); if (g && g.pulse) g.pulse({ peak: 0.22, upMs: 600, holdMs: 600, downMs: 800, arc: true }); } catch (e) {} }, 300);
        let ok = false;
        try { ok = !!(await p); } catch (e) { ok = false; }
        if (ok) { try { G.flag('tankGlow', true); } catch (e) {} if (G.director && G.director.spend) G.director.spend('b09'); }
        return ok;
      } },

    { id: 'B10', cls: 'dread', kind: 'world', owner: 'core', note: 'M5 00:16 — pre-buzz −2.5 s (S04) → social N06–N08' },

    /* ---------- W05: 00:20 snow L1 1→2 — deep steps, wind LP −10 % (world) ---------- */
    { id: 'W05', cls: 'micro', kind: 'world', owner: 'director', where: 'any', defer: 'world',
      when: (s) => s.passed('00:20'),
      run: (ctx) => { try { const a = A(); if (a.amb) a.amb('roofWind', true, { lpScale: 0.9, fade: ctx.s.passed('00:22') ? 8 : 20 }); } catch (e) {} } },

    { id: 'B11', cls: 'relief', kind: 'world', owner: 'social', note: 'M5 + 20 s ∧ C1 — 혹시 나라고 하는 계정…' },
    { id: 'B12', cls: 'dread', kind: 'world', owner: 'climax', note: '00:22 roof light off · peephole black (or prelude t 0)' },
    { id: 'B13', cls: 'dread', kind: 'world', owner: 'climax', note: '00:23 deep steps 70° → 0° → drill M6 00:24' },
    { id: 'B14', cls: 'jump', kind: 'world', owner: 'climax', note: 'C2 — §6.4-① (S1 → +0.8 s · S2 → less version; spend(b14))' },
    { id: 'B15', cls: 'relief', kind: 'world', owner: 'climax', note: 'M7 00:36 siren · forced window view' },
    { id: 'B17', cls: 'dread', kind: 'world', owner: 'climax', note: '00:39 tank door opens 40 cm silently (no subtitle)' },
    { id: 'B18', cls: 'relief', kind: 'world', owner: 'climax', note: '00:41 GSM fades out at 70°, steps 70°→115°, rail creak, far door' },
    { id: 'B16', cls: 'relief', kind: 'world', owner: 'climax', note: '00:44 (whereTank) / 00:47 police torches' },
    { id: 'B19', cls: 'relief', kind: 'world', owner: 'social', note: '00:44 ∧ C1 — maker lines' },
    { id: 'W06', cls: 'micro', kind: 'world', owner: 'climax', note: '00:44–01:09 radio squelch; 00:50 roof light on' },
    { id: 'B20', cls: 'relief', kind: 'world', owner: 'ending', note: '01:10 M8 — boots → Kang TTS → door eye view → handle' },
    { id: 'B21', cls: 'relief', kind: 'world', owner: 'ending', note: '01:20 · 01:40 · 01:50 Kang cards' },
    { id: 'B22', cls: 'relief', kind: 'world', owner: 'ending', note: '02:00 jimin → END (social appends, flow end:reached)' },
    { id: 'W07', cls: 'micro', kind: 'world', owner: 'ending', note: '02:05 · 02:12 · 02:15 · 02:20 · 02:30 tail' },
    { id: 'B21p', cls: 'relief', kind: 'world', owner: 'ending', note: "02:15 Kang's wrap (no chips)" },
    { id: 'B23', cls: 'sting', kind: 'world', owner: 'hook', note: '03:33 his tone (N17) = HOOK' },
  ];

  /* §6.1.6 micro ambience — information 0; never 50–80° (tank room / stairs) nor 105–125° (next-door window) */
  const micro = [
    { id: 'm.gust', az: [[90, 90]], weight: 3, sub: 'S24' },          // gust is omni; the window frame rattles at 90° (the window is no answer)
    { id: 'm.carFar', az: [[150, 250]], el: -40, weight: 2 },
    { id: 'm.pipe', az: [[200, 330]], weight: 2 },
    { id: 'm.tarp', az: [[150, 170], [300, 340]], weight: 2 },
    { id: 'm.roomTick', az: [[180, 300]], weight: 2 },
  ];
  const forbidden = [[50, 80], [105, 125]];

  G.BEATDATA2 = {
    beats,
    micro,
    microForbidden: forbidden,
    tension: { M0: 0.10, M1: 0.15, M2: 0.30, M3: 0.40, M4: 0.55, M5: 0.70, M6: 0.90, M7: 1.0, M7end: 0.3, M8: 0.2, END: 0 },
    rank: { micro: 0, relief: 1, dread: 2, sting: 3, jump: 4 },
  };
})();
