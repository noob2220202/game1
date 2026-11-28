/* =========================================================
 * ep3/js/sound3.js — 하루를 위한 방탈출! 3 「엄마의 번호」 — the episode's sound layer (owner: audio)
 * Loads after engine/core/audio.js · spatial.js · media.js and core e3.js (ARCH_EP3 §2.1); registers everything ep3 hears on
 * G.audio through the engine registration options (ARCH §4.2 · DESIGN §7.1.7). No <audio>/<video>, no microphone, no
 * speechSynthesis; the only files are the three TTS lines (G.AUDIO_FILES). DESIGN §7 (sound design) · §6.1.5 · §6.1.8 · §6.2
 * ledgers · §6.4 · §9.7 · §3.7 · §4.13 · §4.14 · §0.3 D13 · D44.
 *
 * Public API (on G.audio):
 *   listener() → 'L0'|'LS'|'LT'        HOOK ? L0 : M8 ? LT : where === 'sr' ? LS : L0 — long-lived sources move in 0.8 s (§7.1.2)
 *   place(src, lis?) → { az, dist, el, via, ir, wet, trim }   §7.1.2 table; src ∈ keypad hallIn hook kongiDoor hallOut firedoor
 *        srDoor kongiSr srMom srLamp srWindow veranda boiler pipe sofa clock fridge momSeat momPhone stove sink kitchenSwitch
 *        kongiFeet upstairs road (+ kongiBell)
 *   cue(id, { src, az, dist, el, path:[{dt, src|az, dist, el}], n, less, gainDb, … })   every §7.2 cue (list below)
 *   leak(on)                           03:33 leak.earpiece — the recording's sea stem only, from r 0.6 at t 6.6 (call.js)
 *   playVoice('v3_mom_call', { src:'momSeat', cuts:[[a,b]…] | true, cut:k })  live TTS (cuts at file time a, i.e. call at t 6.6);
 *        playVoice('v3_mom_okay', { src:'stove' }) · ep2 ids go to the engine playVoice unchanged
 *   recReady() → bool · nameKey() → string · renameReset()   rec.sea0333 is rendered per PLAYER_NAME (name stem only re-rendered)
 *   buffer('rec.sea0333' | 'rec.sea0333.sea' | 'rec.plain.<id>' | 'hum.mom')   (engine A.buffer → defineBuffer below)
 *   media chains 'ear' · 'table' (G.media routes through G.EP.mediaRoute()) · 'ear' playback ducks amb/sfx/world −8 dB LP 2 kHz
 * House layers (A.amb ids — 'amb.' prefix optional): apt fridge clock air wind90 boilerPump breath.jimin breath.kongi breath.mom
 *   stove.flame soup.simmer — levels persisted in vars.au.amb (engine), restored 0.8 s on reload (defineRestore). amb.fridge never
 *   stops (no off API — hush only); amb.wind90 starts with amb.apt; tension → amb.air only (A.TENSION_AMBS = ['air']).
 * Cue ids: mom.idle mom.srIdle pipe.floor m.creak m.fridgeTick m.kongiSigh m.jiminTurn m.carFar m.gust m.upstairs m.srWindow ·
 *   kongi.sniff kongi.tail kongi.claws kongi.bark2 kongi.settle kongi.sigh kongi.stand kongi.trot kongi.bell ·
 *   chair.creak chair.turn chair.self bed.creak mom.slippers steps.jimin cloth.rustle door.sr mom.gasp breath.mom mom.exhale
 *   hand.mouth jimin.wake jimin.murmur buzz.jimin · ring.talk ring.talk.stop buzz.table talk.end talk.dial call.ringback
 *   call.connect call.line call.end call.beep sms.mom ez.unfold ez.fold ui.tap ui.key ui.back ui.msgSend ui.error ui.unlock
 *   ui.whoosh ui.pen ui.pageTurn cam.shutter phone.flip phone.set phone.slide glass.set · door.err3 hall.steps2 firedoor.latch
 *   firedoor.clunk bus.far · switch.light switch.lamp stove.ignite ladle bowl.set spoons · piano.ab boiler.fire hum.mom
 *   (+ engine bell.small · msg.inapp · cloth.rustle is redefined here for the ep3 places). Looping cues return { stop(fade) }.
 * Bus listened: room:where var:where flag:M6 M7 M8 HOOK END jiminUp kang502 M1 · media:play media:stop media:out · settings ·
 *   end:step / var:endStep (credits −6 dB · check card 2 s to 0) · dir:beat (B03 resume check). Bus emitted: 'audio:listener'.
 * Persisted: vars.au (engine amb levels + pump {from, until}). Flags set: none. data-qa: audio.resume (engine chip).
 * DEBUG: window.haru.audio += listener place cal measure measureAmb monitor levels recCheck vibLog renders.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const A = G.audio;
  if (!A || !A.defineCue || !A.defineVia || !A.defineAmb || !A.at) { if (G.DEBUG) console.warn('[sound3] engine audio (audio.js · spatial.js) missing — ep3 sound layer not installed'); return; }
  const db = A.db, clamp = A.clamp;
  const TAU = Math.PI * 2;
  const warn = (...a) => { if (G.DEBUG) console.warn('[sound3]', ...a); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const now = () => (A.ctx ? A.ctx.currentTime : 0);
  const ok = () => A.ok();
  const flag = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const V = () => (G.state && G.state.vars) || {};
  const pmNow = () => (G.state && G.state.playMs) || 0;
  const def = (id, fn) => A.defineCue(id, fn);
  const spk = () => A.speakerMode();
  const isLess = (o) => (o && o.less != null ? !!o.less : A.less());
  const E3 = () => G.ep || G.e3 || G.e2 || null;
  const idle = (fn, ms) => { if (window.requestIdleCallback) requestIdleCallback(() => fn(), { timeout: ms || 3000 }); else setTimeout(fn, Math.min(ms || 2000, 2000)); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[sound3]', e); return d; } };

  /* =========================================================
   * 1. Engine registrations (§7.1.3 · §7.1.7)
   * ========================================================= */
  A.TENSION_AMBS = ['air'];                         // tension → amb.air and nothing else (§6.1.5) — the drone never starts
  A.HUSH_ROOM = 'apt';
  A.defineDuck(['amb', 'sfx', 'world']);            // '귀에 댄 폰' ducking stages (§7.1.1)
  const DOORFACE = [3500, 1500, 0.7];               // '문 너머는 어느 쪽을 보든 비슷하다' — lpRange 1500
  A.defineVia('frontDoor', { lp: 1800, p1: [310, 6, 4], g: -12, face: DOORFACE });
  A.defineVia('hallOut', { lp: 900, p1: [310, 4, 4], g: -14, face: DOORFACE });
  A.defineVia('srDoor', { lp: 3000, g: -4, face: DOORFACE });
  A.defineVia('srFront', { lp: 1200, p1: [310, 6, 4], g: -18, face: DOORFACE });
  A.defineVia('veranda', { lp: 2400, p1: [2100, 2, 6], g: -8, face: DOORFACE });
  A.defineVia('wall3', { lp: 600, g: -14 });        // DESIGN 'wall' (LP 600 · −14) — the ep2 key 'wall' is kept as is (new keys only)
  A.defineIR('irLiving', [0.5, 2.8, 0.45]);
  A.defineIR('irSea', [0.35, 3.0, 0.5]);
  A.defineIR('irHall', [1.1, 2.6, 0.35, [[9, 0.5], [23, 0.35]]]);

  /* =========================================================
   * 2. Listeners · places (§7.1.2) — [az, dist, el, via, ir, wet, trimDb]
   * ========================================================= */
  const PLACE = {
    keypad: { L0: [0, 5.4, -5, 'frontDoor', 'irHall', 0.25], LT: [19, 5.7, -5, 'frontDoor', 'irHall', 0.25], LS: [190, 6.9, -5, 'srFront', 'irHall', 0.25] },
    hallIn: { L0: [8, 4.2, 5, 'inRoom', 'irLiving', 0.3], LT: [17, 4.9, 5, 'inRoom', 'irLiving', 0.3], LS: [192, 4.2, 5, 'srDoor', 'irLiving', 0.3] },
    hook: { L0: [354, 4.7, 5, 'inRoom', 'irLiving', 0.3], LT: [18, 5.0, 5, 'inRoom', 'irLiving', 0.3], LS: [190, 4.6, 5, 'srDoor', 'irLiving', 0.3] },
    kongiDoor: { L0: [2, 4.6, -10, 'inRoom', 'irLiving', 0.35], LT: [20, 5.0, -10, 'inRoom', 'irLiving', 0.35], LS: [192, 4.4, -10, 'srDoor', 'irLiving', 0.35] },
    hallOut: { L0: [0, 6.2, 0, 'hallOut', 'irHall', 0.45], LT: [17, 6.6, 0, 'hallOut', 'irHall', 0.45], LS: [191, 8.5, 0, 'srFront', 'irHall', 0.45] },
    firedoor: { L0: [345, 8, 0, 'hallOut', 'irStair', 0.5], LT: [359, 7.7, 0, 'hallOut', 'irStair', 0.5], LS: [186, 10, 0, 'srFront', 'irStair', 0.5] },
    srDoor: { L0: [30, 4.0, 0, 'inRoom', 'irLiving', 0.3], LT: [48, 5.2, 0, 'inRoom', 'irLiving', 0.3], LS: [200, 1.7, 0, 'inRoom', 'irSea', 0.3] },
    kongiSr: { L0: [30, 3.8, -15, 'inRoom', 'irLiving', 0.3], LT: [50, 5.0, -15, 'inRoom', 'irLiving', 0.3], LS: [200, 1.9, -35, 'inRoom', 'irSea', 0.3] },
    kongiBell: { L0: [30, 3.8, -15, 'inRoom', 'irLiving', 0.3], LT: [48, 5.0, -25, 'inRoom', 'irLiving', 0.3], LS: [200, 1.9, -35, 'inRoom', 'irSea', 0.3] },
    srMom: { L0: [34, 5.2, -10, 'srDoor', 'irSea', 0.3], LT: [50, 6.0, -10, 'srDoor', 'irSea', 0.3], LS: [165, 1.2, -15, 'inRoom', 'irSea', 0.3] },
    srLamp: { L0: [35, 5.0, 0, 'srDoor', 'irSea', 0.3], LT: [50, 6.0, 0, 'srDoor', 'irSea', 0.3], LS: [10, 1.3, 0, 'inRoom', 'irSea', 0.3] },
    srWindow: { L0: [33, 5.6, 5, 'srDoor', 'irSea', 0.3], LT: [50, 6.2, 5, 'srDoor', 'irSea', 0.3], LS: [160, 1.7, 5, 'inRoom', 'irSea', 0.3] },
    veranda: { L0: [90, 3.2, 0, 'veranda', null, 0], LT: [90, 5.1, 0, 'veranda', null, 0], LS: [196, 6.5, 0, 'veranda', null, 0] },
    boiler: { L0: [90, 4.5, 0, 'veranda', 'irLiving', 0.2, -2], LT: [90, 6.4, 0, 'veranda', 'irLiving', 0.2, -2], LS: [196, 6.2, 0, 'srDoor', 'irLiving', 0.2, -8] },
    pipe: { L0: [0, 2, -70, 'inRoom', null, 0], LT: [0, 2, -70, 'inRoom', null, 0], LS: [0, 2, -70, 'inRoom', null, 0] },
    sofa: { L0: [185, 2.4, -10, 'inRoom', 'irLiving', 0.25], LT: [152, 2.7, -10, 'inRoom', 'irLiving', 0.25], LS: [213, 8.0, -10, 'srDoor', 'irLiving', 0.25] },
    clock: { L0: [180, 3.15, 18, 'inRoom', null, 0], LT: [148, 3.55, 12, 'inRoom', null, 0], LS: [215, 7.0, 10, 'srDoor', null, 0] },
    fridge: { L0: [255, 3.5, 0, 'inRoom', null, 0], LT: [238, 1.7, 0, 'inRoom', null, 0], LS: [210, 8.6, 0, 'srDoor', null, 0] },
    momSeat: { L0: [272, 2.5, 5, 'inRoom', 'irLiving', 0.3], LT: [270, 1.0, 5, 'inRoom', 'irLiving', 0.3], LS: [212, 7.8, 5, 'srDoor', 'irLiving', 0.3] },
    momPhone: { L0: [274, 3.0, -8, 'inRoom', 'irLiving', 0.3], LT: [270, 0.7, -30, 'inRoom', 'irLiving', 0.3], LS: [212, 7.8, -8, 'srDoor', 'irLiving', 0.3] },
    stove: { L0: [273, 3.4, 0, 'inRoom', 'irLiving', 0.3], LT: [275, 1.5, 0, 'inRoom', 'irLiving', 0.3], LS: [210, 8.5, 0, 'srDoor', 'irLiving', 0.3] },
    sink: { L0: [281, 3.7, 0, 'inRoom', 'irLiving', 0.3], LT: [292, 1.8, 0, 'inRoom', 'irLiving', 0.3], LS: [212, 8.6, 0, 'srDoor', 'irLiving', 0.3] },
    kitchenSwitch: { L0: [285, 3.4, 10, 'inRoom', 'irLiving', 0.3], LT: [303, 1.7, 10, 'inRoom', 'irLiving', 0.3], LS: [212, 8.4, 10, 'srDoor', 'irLiving', 0.3] },
    kongiFeet: { L0: [262, 2.6, -30, 'inRoom', 'irLiving', 0.2], LT: [252, 0.95, -50, 'inRoom', 'irLiving', 0.2], LS: [212, 8.0, -30, 'srDoor', 'irLiving', 0.2] },
    upstairs: { L0: [200, 4, 70, 'wall3', null, 0], LT: [180, 4.4, 70, 'wall3', null, 0], LS: [210, 5.5, 70, 'wall3', null, 0] },
    road: { L0: [90, 60, -20, 'veranda', 'irFar', 0.3], LT: [90, 60, -20, 'veranda', 'irFar', 0.3], LS: [196, 60, -20, 'veranda', 'irFar', 0.3] },
  };
  function where() { try { const e = E3(); if (e && e.where) return e.where() === 'sr' ? 'sr' : 'lv'; } catch (e) {} return V().where === 'sr' ? 'sr' : 'lv'; }
  function listener() { if (flag('HOOK')) return 'L0'; if (flag('M8')) return 'LT'; return where() === 'sr' ? 'LS' : 'L0'; }
  function place(src, lis) {
    const e = PLACE[src]; if (!e) return null;
    const r = e[lis || listener()] || e.L0;
    return { src, az: r[0], dist: r[1], el: r[2], via: r[3], ir: r[4], wet: r[5], trim: r[6] || 0 };
  }
  A.listener = listener;
  A.place = (src, lis) => place(src, lis);
  /** resolve a cue's position: caller az/dist/el/via override the place of `src` (or of the cue's default source) */
  function pos(o, defSrc, lis) {
    o = o || {};
    const P = place(o.src || defSrc, lis) || { src: null, az: 0, dist: 2, el: 0, via: 'inRoom', ir: null, wet: 0, trim: 0 };
    if (o.az != null) P.az = +o.az; if (o.dist != null) P.dist = +o.dist; if (o.el != null) P.el = +o.el;
    if (o.via && A.hasVia(o.via)) P.via = o.via; if (o.ir !== undefined) P.ir = o.ir; if (o.wet != null) P.wet = +o.wet;
    P.explicit = o.az != null || o.dist != null;
    return P;
  }
  const distG = (d) => 0.5 / Math.max(0.5, d || 0.5);          // engine distance law (spatial.js REF 0.5)
  const pathRef = (P) => distG(P.dist) * db(A.viaGainDb(P.via));

  /* ---------------- level calibration (§7.1.6 targets, measured after the master compressor with haru.audio.measure) ----------------
     KSYS = what the engine adds between a node input and A.out at 0.5 m facing (HRTF/equal-power panner, master .9, compressor
     makeup); CAL3 = per-cue trims (dB) of each recipe's own crest. Both measured in Chromium (work/harness/audio_cal.js). */
  const KSYS = db(0);
  const CAL3 = {                                    // measured 2026-11-27 (Chromium · iPhone 13 profile · facing the source · medians)
    'mom.idle': -2.5, 'm.creak': 4.5, 'm.fridgeTick': -0.5, 'm.kongiSigh': -1, 'm.jiminTurn': 0, 'm.carFar': -13.5, 'm.gust': -1,
    'm.upstairs': -5.5, 'm.srWindow': -20, 'pipe.floor': -3.5,
    'mom.srIdle': 4, 'kongi.sniff': 0, 'kongi.tail': { L0: -3, LT: -3.5 }, 'kongi.claws': 0.5, 'kongi.bark2': { L0: -4, LS: -4 }, 'kongi.settle': -3.5, 'kongi.sigh': -2.5,
    'kongi.bell': -4.5, 'kongi.trot': -1.5, 'kongi.stand': -3.5,
    'chair.creak': 0, 'cloth.rustle': 0, 'door.sr': 2, 'mom.gasp': -6, 'breath.mom': -2, 'mom.slippers': -3, 'jimin.wake': -3.5, 'jimin.murmur': -1.5,
    'buzz.jimin': -11, 'chair.turn': 0, 'mom.exhale': -4, 'hand.mouth': -6, 'steps.jimin': -5.5, 'chair.self': -8, 'bed.creak': 1,
    'ring.talk': -8, 'buzz.table': -11.5, 'talk.end': -7.5, 'phone.flip': 2, 'phone.set': 1.5, 'phone.slide': -4.5, 'glass.set': -5.5,
    'sms.mom': -4, 'talk.dial': -4.5, 'call.ringback': -5.5, 'call.connect': -4.5, 'call.end': -4.5, 'call.beep': -4.5, 'call.line': -4.5, 'ez.unfold': -4.5, 'ez.fold': -4.5,
    'door.err3': { L0: -3.5, LS: -1.5 }, 'hall.steps2': -6, 'firedoor.latch': -3, 'firedoor.clunk': -5.5, 'bus.far': -15.5,
    'switch.light': 0.5, 'switch.lamp': 1.5, 'stove.ignite': -1.5, 'ladle': -4.5, 'bowl.set': -7.5, 'spoons': -6,
    'piano.ab': -6, 'boiler.fire': -3.5, 'hum.mom': -5.5,
    'rec.ear': -4.5, 'leak.earpiece': -7, 'rec.table': -9,
    'v3_mom_call': -6.5, 'v3_mom_okay': -9.5,   // peak-anchored ≈ −15 dBFS (the −14 master cap) → active RMS ≈ −28 / −23 (§7.1.6 −26 / −22)
  };
  function calOf(id, lis) { const c = CAL3[id]; if (c == null) return 0; if (typeof c === 'number') return c; return c[lis] != null ? c[lis] : c.L0 != null ? c.L0 : 0; }
  /** level spec → amplitude at a node input: spec = number (L0 dBFS) | { L0, LS, LT, ref } (ref = the listener whose value anchors physics) */
  function ampFor(id, spec, srcKey, P, lis, o) {
    const sp = typeof spec === 'number' ? { L0: spec } : (spec || { L0: -46 });
    const ref = sp.ref || (sp.L0 != null ? 'L0' : sp.LT != null ? 'LT' : 'LS');
    let T, Pr, trim = 0;
    if (sp[lis] != null) { T = sp[lis]; Pr = P; }
    else {
      T = sp[ref]; const P0 = srcKey && !P.explicit ? place(srcKey, ref) : null;
      Pr = P0 || P; trim = P0 ? (P.trim || 0) - (P0.trim || 0) : 0;
    }
    T += trim + calOf(id, lis) + ((o && o.gainDb) || 0);
    return { g: db(T) / (pathRef(Pr) * KSYS), T };
  }
  /** one-shot spatial node for cue `id` at its place (or the caller's) — returns { n, P, lis, t, T } or null */
  function mk(id, o, src, spec, x) {
    o = o || {}; x = x || {};
    if (!ok()) return null;
    const lis = o.listener || listener();
    const P = pos(o, src, lis);
    const a = ampFor(id, spec, o.src || src, P, lis, { gainDb: (o.gainDb || 0) + (x.db || 0) });
    const n = A.at(P.az, { dist: P.dist, el: P.el, via: P.via, ir: P.ir || null, wet: P.wet || 0, bus: x.bus || 'sfx', life: x.life || 4,
      quiet: a.T < -44, noHrtf: !!x.noHrtf, noFacing: !!x.noFacing, gain: a.g * (x.mul || 1) });
    if (!n) return null;
    return { n, P, lis, t: now() + 0.02, T: a.T };
  }
  /** a path for a node: keys [{dt, src|az, dist, el}] resolved for the listener */
  function pathOf(keys, lis) {
    return (keys || []).map((k) => {
      const p = k.src ? place(k.src, lis) : null;
      return { dt: k.dt || 0, az: k.az != null ? k.az : p ? p.az : undefined, dist: k.dist != null ? k.dist : p ? p.dist : undefined, el: k.el != null ? k.el : p ? p.el : undefined };
    });
  }
  function arc(az) { try { A.arc && A.arc(az); } catch (e) {} }   // speaker mode only (engine checks)

  /* =========================================================
   * 3. DSP helpers (realtime + offline)
   * ========================================================= */
  function rngS(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; }; }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /** RBJ biquad as a per-sample closure (lowpass · highpass · bandpass · notch · peaking) */
  function BQ(type, f, Q, sr, gdb) {
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * (Q || 0.707));
    let b0, b1, b2, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else if (type === 'notch') { b0 = 1; b1 = -2 * cs; b2 = 1; }
    else if (type === 'peaking') { const Ag = Math.pow(10, (gdb || 0) / 40); b0 = 1 + al * Ag; b1 = -2 * cs; b2 = 1 - al * Ag; a0 = 1 + al / Ag; a2 = 1 - al / Ag; }
    else { b0 = al; b1 = 0; b2 = -al; }
    b0 /= a0; b1 /= a0; b2 /= a0; const A1 = a1 / a0, A2 = a2 / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function pinkGen(r) { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; return () => { const w = r(); b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; return o * 0.11; }; }
  function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
  const isr = (t, sr) => Math.round(t * sr);
  function peakOf(d, i0, i1) { let m = 0; for (let i = Math.max(0, i0 || 0), e = Math.min(d.length, i1 == null ? d.length : i1); i < e; i++) { const v = Math.abs(d[i]); if (v > m) m = v; } return m; }
  function rmsOf(d, i0, i1) { let s = 0, n = 0; for (let i = Math.max(0, i0 || 0), e = Math.min(d.length, i1 == null ? d.length : i1); i < e; i++) { s += d[i] * d[i]; n++; } return Math.sqrt(s / Math.max(1, n)); }
  /** RMS over the 10 ms frames that are within 20 dB of the loudest frame ('active' RMS — the meta rms_db convention) */
  function activeRms(d, sr, i0, i1) {
    const fr = Math.max(1, Math.round(0.01 * sr)), list = [];
    for (let s = i0; s + fr <= i1; s += fr) list.push(rmsOf(d, s, s + fr));
    const mx = list.reduce((m, v) => Math.max(m, v), 0); if (!mx) return 0;
    let s2 = 0, n = 0; list.forEach((v) => { if (v >= mx * 0.1) { s2 += v * v; n++; } }); return Math.sqrt(s2 / Math.max(1, n));
  }
  const toDb = (x) => 20 * Math.log10(Math.max(1e-12, x));
  /** feed-forward compressor in JS — returns the gain envelope (linear) */
  function compEnv(d, sr, thrDb, ratio, attS, relS, i0, i1) {
    const g = new Float32Array(d.length); g.fill(1);
    const aA = Math.exp(-1 / (attS * sr)), aR = Math.exp(-1 / (relS * sr));
    let env = 0;
    for (let i = i0 || 0, e = i1 == null ? d.length : i1; i < e; i++) {
      const x = Math.abs(d[i]); env = x > env ? aA * env + (1 - aA) * x : aR * env + (1 - aR) * x;
      const lv = toDb(env), over = lv - thrDb;
      g[i] = over > 0 ? db(-over * (1 - 1 / ratio)) : 1;
    }
    return g;
  }
  /** resample channel 0 of an AudioBuffer to sr (linear) */
  function resample(buf, sr, maxSec) {
    const src = buf.getChannelData(0), ratio = buf.sampleRate / sr, n = Math.min(Math.floor(src.length / ratio), maxSec ? Math.round(maxSec * sr) : Infinity);
    const out = new Float32Array(Math.max(0, n));
    for (let i = 0; i < n; i++) { const p = i * ratio, k = Math.floor(p), f = p - k; out[i] = (src[k] || 0) + ((src[k + 1] || 0) - (src[k] || 0)) * f; }
    return out;
  }
  function offline(ch, sec, sr) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return null;
    try { return new OAC(ch, Math.ceil(sec * sr), sr); } catch (e) { return null; }
  }
  function renderOff(c) {
    return new Promise((res) => {
      let done = false; const fin = (b) => { if (!done) { done = true; res(b || null); } };
      try { c.oncomplete = (ev) => fin(ev.renderedBuffer); const p = c.startRendering(); if (p && p.then) p.then(fin, () => fin(null)); } catch (e) { fin(null); }
    });
  }
  function srcOf(c, arr, t) { const b = c.createBuffer(1, arr.length, c.sampleRate); b.copyToChannel ? b.copyToChannel(arr, 0) : b.getChannelData(0).set(arr); const s = c.createBufferSource(); s.buffer = b; s.start(t || 0); return s; }
  function voiceT(id, ms) {
    let p; try { p = Promise.resolve(A.voice(id)).catch(() => null); } catch (e) { p = Promise.resolve(null); }
    return Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms || 6000))]);
  }

  /* -- Korean syllable tables (1편 js/data/recordings.js FORM · 2편 formantPhrase) -- */
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const VMAP = { 'ㅏ': 'ㅏ', 'ㅑ': 'ㅏ', 'ㅘ': 'ㅏ', 'ㅓ': 'ㅓ', 'ㅕ': 'ㅓ', 'ㅝ': 'ㅓ', 'ㅗ': 'ㅗ', 'ㅛ': 'ㅗ', 'ㅜ': 'ㅜ', 'ㅠ': 'ㅜ', 'ㅡ': 'ㅡ', 'ㅣ': 'ㅣ', 'ㅟ': 'ㅣ', 'ㅢ': 'ㅣ', 'ㅐ': 'ㅐ', 'ㅒ': 'ㅐ', 'ㅔ': 'ㅐ', 'ㅖ': 'ㅐ', 'ㅙ': 'ㅐ', 'ㅚ': 'ㅐ', 'ㅞ': 'ㅐ' };
  const FORM = { 'ㅏ': [850, 1300, 2700], 'ㅓ': [650, 1100, 2600], 'ㅗ': [450, 850, 2600], 'ㅜ': [350, 950, 2400], 'ㅡ': [400, 1500, 2600], 'ㅣ': [320, 2500, 3200], 'ㅐ': [500, 2000, 2700] };
  const hangul = (s) => Array.from(String(s || '')).filter((ch) => ch >= '가' && ch <= '힣');
  const sylParts = (ch) => { const code = ch.charCodeAt(0) - 0xac00; return { cho: CHO[Math.floor(code / 588)], jung: JUNG[Math.floor((code % 588) / 28)], jong: code % 28 }; };
  /** voiced formant phrase (2편 formantPhrase, f0 parameter): syllable rhythm only — never intelligible (cards carry the words) */
  function voicedPhrase(syl, sr, o) {
    o = o || {};
    const per = o.per || 0.13, f0 = o.f0 || 220, r = o.rng || rngS(5);
    const total = syl.length * per + 0.12, n = Math.ceil(total * sr), out = new Float32Array(n);
    let ph = 0;
    const hiss = BQ('highpass', 3500, 0.8, sr), hissB = BQ('bandpass', Math.min(5200, sr * 0.4), 1.2, sr), post = BQ('highpass', 90, 0.7, sr);
    syl.forEach((ch, k) => {
      const { cho, jung, jong } = sylParts(ch);
      const F = FORM[VMAP[jung] || 'ㅓ'], t0 = k * per + 0.02;
      const fric = 'ㅅㅆㅈㅉㅊ'.includes(cho) ? 0.05 : 'ㅎ'.includes(cho) ? 0.03 : 'ㄱㄲㅋㄷㄸㅌㅂㅃㅍ'.includes(cho) ? 0.012 : 0;
      const nasal = 'ㄴㅁ'.includes(cho) ? 0.025 : 0;
      const f1 = BQ('bandpass', F[0], 5, sr), f2 = BQ('bandpass', Math.min(F[1], sr * 0.42), 7, sr), f3 = BQ('bandpass', Math.min(F[2], sr * 0.44), 9, sr), nm = BQ('lowpass', 350, 0.7, sr);
      const vEnd = per * (jong ? 0.82 : 0.92), i0 = Math.floor(t0 * sr), len = Math.floor((vEnd + 0.03) * sr);
      for (let i = 0; i < len && i0 + i < n; i++) {
        const t = i / sr, gt = t0 + t;
        const fz = f0 * (1.08 - 0.16 * (gt / total)) * (1 + 0.03 * Math.sin(TAU * 0.9 * gt + k));
        const dt = fz / sr; ph += dt; if (ph >= 1) ph -= 1;
        const s0 = (2 * ph - 1) - blep(ph, dt), w = r();
        let v = 0;
        if (t < fric) { const e = Math.min(1, t / 0.006); v += (cho === 'ㅎ' ? (f1(w) + f2(w) * 0.7) * 0.6 : hissB(hiss(w)) * 0.9) * e; }
        else if (t < fric + nasal) v += nm(s0) * 0.5 * Math.min(1, (t - fric) / 0.01);
        const tv = t - fric - nasal;
        if (tv >= 0 && t < vEnd) { const e = Math.min(1, tv / 0.015) * Math.min(1, (vEnd - t) / 0.025); const s = s0 * 0.9 + w * 0.04; v += (f1(s) + f2(s) * 0.75 + f3(s) * 0.35) * e * 1.6; }
        if (jong && t >= vEnd) v += nm(s0) * 0.35 * Math.max(0, 1 - (t - vEnd) / 0.03);
        out[i0 + i] += v;
      }
    });
    for (let i = 0; i < n; i++) out[i] = post(out[i]);
    return out;
  }
  /** 1편 whisper(): unvoiced formant noise per syllable (onset fricatives · 25 ms / 60 ms envelope) — §7.2 F whisper.name */
  function whisperInto(out, sr, t0, per, syl, r) {
    syl.forEach((ch, k) => {
      const { cho, jung, jong } = sylParts(ch);
      const F = FORM[VMAP[jung] || 'ㅓ'];
      const st = t0 + k * per, d = per * (jong ? 0.92 : 0.84);
      const i0 = Math.floor(st * sr), len = Math.floor(d * sr);
      const f1 = BQ('bandpass', F[0], 5, sr), f2 = BQ('bandpass', F[1], 7, sr), f3 = BQ('bandpass', F[2], 9, sr), hiss = BQ('highpass', 3200, 0.8, sr);
      const fric = 'ㅅㅆㅈㅉㅊ'.includes(cho) ? 0.07 : 'ㅎ'.includes(cho) ? 0.05 : 'ㄱㄲㅋㄷㄸㅌㅂㅃㅍ'.includes(cho) ? 0.014 : 0;
      for (let i = 0; i < len && i0 + i < out.length; i++) {
        const t = i / sr, w = r();
        const env = Math.min(1, t / 0.025) * Math.min(1, (d - t) / 0.06);
        let v = (f1(w) + f2(w) * 0.75 + f3(w) * 0.35) * env * (t < fric ? 0.35 : 1);
        if (t < fric) v += hiss(w) * 0.5 * (1 - t / fric);
        out[i0 + i] += v;
      }
    });
  }
  /** a breathy syllable-less whisper over [t0, t1] (neutral-vowel formant noise · §0.3 D13) */
  function breathWhisperInto(out, sr, t0, t1, r) {
    const F = FORM['ㅓ'], f1 = BQ('bandpass', F[0], 4, sr), f2 = BQ('bandpass', F[1], 6, sr), f3 = BQ('bandpass', F[2], 7, sr), hiss = BQ('highpass', 2600, 0.7, sr);
    const i0 = Math.floor(t0 * sr), len = Math.floor((t1 - t0) * sr), d = t1 - t0;
    for (let i = 0; i < len && i0 + i < out.length; i++) {
      const t = i / sr, w = r(), env = Math.min(1, t / 0.12) * Math.min(1, (d - t) / 0.25) * (0.85 + 0.15 * Math.sin(Math.PI * t / d));
      out[i0 + i] += ((f1(w) + f2(w) * 0.7 + f3(w) * 0.3) * 0.8 + hiss(w) * 0.35) * env;
    }
  }

  /* -- the formant hum /m/ (2편 renderHook hum.sea — same renderer, same note table form) -- */
  const NOTE = { E4: 329.6276, A4: 440, C5: 523.2511, B4: 493.8833, Bb4: 466.1638 };
  const SEA_V = { glide: 0.06, vibHz: 5.2, vibCent: 18, jitter: 0.004, shimmer: 0.03, breath: 0.03 };
  const MOM_V = { glide: 0.06, vibHz: 4.6, vibCent: 14, jitter: 0.008, shimmer: 0.05, breath: 0.06 };
  const SEA_F = { tilt: 3000, nasal: [270, 2.7, 2.2], f2: [2200, 4, db(-18) * 4], f3: [3000, 5, db(-24) * 4], notch: [1000, 3], lp: 2500, direct: 0.12, gain: 1.4 };
  const MOM_F = { tilt: 3000, nasal: [250, 2.7, 2.2], f2: [2000, 4, db(-16) * 4], f3: [2800, 5, db(-22) * 4], notch: [950, 3], lp: 2200, direct: 0.12, gain: 1.4 };
  /** glottal excitation (saw + polyBLEP + breath) for a phrase of notes {f, t0, t1, vd, fadeOut, lvl:[a,b], rise:{to,dur}, cut:[a,b]} */
  function humExcite(out, sr, notes, P, gain, r) {
    const first = notes[0].t0, last = notes[notes.length - 1], g2 = P.glide / 2;
    const i0 = Math.max(0, Math.floor((first - 0.01) * sr)), i1 = Math.min(out.length, Math.ceil((last.t1 + 0.005) * sr));
    let ph = 0, jit = 1, shim = 1, k = 0;
    for (let i = i0; i < i1; i++) {
      const t = i / sr;
      while (k < notes.length - 1 && t >= notes[k + 1].t0 - g2) k++;
      const N = notes[k];
      let f = N.f;
      if (N.rise) { const x = clamp((t - N.t0) / N.rise.dur, 0, 1); f = N.f * Math.pow(N.rise.to / N.f, x); }
      if (k > 0 && t < N.t0 + g2) { const fp = notes[k - 1].f, x = clamp((t - (N.t0 - g2)) / P.glide, 0, 1); f = fp * Math.pow(f / fp, x * x * (3 - 2 * x)); }
      const age = t - N.t0, vdel = N.vd != null ? N.vd : 0.3;
      const depth = clamp((age - vdel) / 0.25, 0, 1) * P.vibCent;
      f *= Math.pow(2, (depth * Math.sin(TAU * P.vibHz * age)) / 1200) * jit;
      const dt = f / sr; ph += dt; if (ph >= 1) { ph -= 1; jit = 1 + r() * P.jitter; shim = 1 + r() * P.shimmer; }
      let env = clamp((t - first) / 0.12, 0, 1);
      if (t > N.t1 && k < notes.length - 1) env *= 0.75;                 // legato dip between notes (2편)
      if (t > N.t1 && k === notes.length - 1) env = 0;
      if (N.fadeOut) env *= clamp((N.t1 - t) / N.fadeOut, 0, 1);
      if (N.lvl) env *= N.lvl[0] + (N.lvl[1] - N.lvl[0]) * clamp((t - N.t0) / (N.t1 - N.t0), 0, 1);
      if (N.cut) env *= t < N.cut[0] ? 1 : clamp((N.cut[1] - t) / (N.cut[1] - N.cut[0]), 0, 1);
      if (env <= 0) continue;
      const s = (2 * ph - 1) - blep(ph, dt) + r() * P.breath;
      out[i] += s * env * shim * Math.pow(f / 329.6, 0.9) * gain;
    }
  }
  /* WebAudio lowpass/highpass Q is in dB — the JS copies of the 2편 node graphs convert it so the colour is the same */
  const qdb = (q) => Math.pow(10, q / 20);
  /** the 2편 hum formant network in JS: tilt LP → nasal / F2 / F3 band-passes + direct → notch → LP → gain (in place) */
  function formantJS(x, sr, F, i0, i1) {
    const tilt = BQ('lowpass', F.tilt, qdb(0.5), sr), b1 = BQ('bandpass', F.nasal[0], F.nasal[1], sr), b2 = BQ('bandpass', F.f2[0], F.f2[1], sr), b3 = BQ('bandpass', F.f3[0], F.f3[1], sr);
    const nt = BQ('notch', F.notch[0], F.notch[1], sr), lp = BQ('lowpass', F.lp, qdb(0.7), sr);
    for (let i = i0 || 0, e = i1 == null ? x.length : i1; i < e; i++) {
      const t = tilt(x[i]);
      x[i] = lp(nt(b1(t) * F.nasal[2] + b2(t) * F.f2[2] + b3(t) * F.f3[2] + t * F.direct)) * F.gain;
    }
    return x;
  }
  /** messenger-call texture (HP 120 · LP 7 kHz · irSmall .25 — the 'narrow room', no place information): JS EQ + one mono
   *  OfflineAudioContext convolution of [i0, i1) (the only costly step — one render for the whole sea stem) */
  async function messengerJS(x, sr, i0, i1, seed) {
    const hp = BQ('highpass', 120, qdb(0.707), sr), lp = BQ('lowpass', 7000, qdb(0.707), sr);
    for (let i = i0; i < i1; i++) x[i] = lp(hp(x[i]));
    const len = i1 - i0, tail = Math.round(0.45 * sr), c = offline(1, (len + tail) / sr, sr);
    if (!c) return x;
    const ir = c.createBuffer(1, Math.floor(0.4 * sr), sr), r = rngS(seed || 33), d = ir.getChannelData(0); let l = 0;
    for (let i = 0; i < d.length; i++) { l += (r() - l) * 0.42; d[i] = l * Math.pow(1 - i / d.length, 3); }   // irSmall [0.4, 3, .42] (engine IRDEF), seeded
    const src = srcOf(c, x.subarray(i0, i1)), cv = c.createConvolver(); cv.buffer = ir; const wg = c.createGain(); wg.gain.value = 0.25;
    src.connect(cv); cv.connect(wg); wg.connect(c.destination);
    const b = await renderOff(c); if (!b) return x;
    const w = b.getChannelData(0);
    for (let i = 0; i < w.length && i0 + i < x.length; i++) x[i0 + i] += w[i];
    return x;
  }

  /* -- realtime one-shot helpers -- */
  const ENV = {
    sin2: (x) => Math.pow(Math.sin(Math.PI * x), 2),
    sin: (x) => Math.sin(Math.PI * x),
    swell: (a, r) => (x) => clamp(Math.min(x / Math.max(1e-3, a), (1 - x) / Math.max(1e-3, r)), 0, 1),
    inhale: (x) => Math.pow(Math.sin(Math.PI * x * 0.5 + 0.0001), 1.5) * clamp((1 - x) / 0.12, 0, 1),
    exhale: (x) => clamp(x / 0.08, 0, 1) * Math.pow(1 - x, 1.4),
    gasp: (x) => clamp(x / 0.086, 0, 1) * (x > 0.977 ? clamp((1 - x) / 0.023, 0, 1) : 1),
  };
  const NY = () => ((A.ctx && A.ctx.sampleRate) || 48000) / 2;
  /** gain that brings band-limited white noise (bandwidth bw Hz) to ≈ peak 1 */
  const nbw = (bw) => 1 / Math.max(0.01, 0.577 * Math.sqrt(Math.min(1, bw / NY())) * 3.2);
  const nb = (f, Q) => nbw(f / (Q || 0.7));
  function burst(t, dur, peak, out, filters, o) {
    o = o || {};
    const c = A.ctx, B = A.noiseBuffers(c);
    const s = c.createBufferSource(); s.buffer = o.brown ? B.brown : o.pink ? B.pink : B.white; s.loop = true;
    let n = s;
    (filters || []).forEach((fd) => {
      const f = c.createBiquadFilter(); f.type = fd[0]; f.frequency.setValueAtTime(fd[1], t);
      if (fd[4]) f.frequency.exponentialRampToValueAtTime(fd[4], t + dur);
      f.Q.value = fd[2] || 0.707; if (fd[3] != null) f.gain.value = fd[3]; n.connect(f); n = f;
    });
    const g = c.createGain(); g.gain.value = 0;
    const N = 64, cv = new Float32Array(N), sh = o.shape || ENV.sin2;
    for (let i = 0; i < N; i++) cv[i] = Math.max(0, sh(i / (N - 1))) * peak;
    try { g.gain.setValueCurveAtTime(cv, Math.max(t, now() + 0.005), Math.max(0.01, dur)); } catch (e) { g.gain.setValueAtTime(peak, t); g.gain.linearRampToValueAtTime(0, t + dur); }
    n.connect(g);
    let last = g;
    if (o.am) {
      const am = c.createGain(); am.gain.value = 1 - o.am[1]; const lfo = c.createOscillator(); lfo.frequency.value = o.am[0];
      const lg = c.createGain(); lg.gain.value = o.am[1]; lfo.connect(lg); lg.connect(am.gain); g.connect(am); last = am; lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    last.connect(out);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
    A.stats.sources++;
    return s;
  }
  const click = (t, peak, out, f, Q, dur) => A.noise(t, dur || 0.002, peak * nb(f, Q || 2), out, { filters: [{ type: 'bandpass', freq: f, Q: Q || 2 }] });
  const tone = (f, t, dur, peak, out, o) => A.osc((o && o.type) || 'sine', f, t, dur, peak, out, Object.assign({ a: 0.001, decay: true }, o || {}));
  /** stick-slip impulse train (f0 → f1 Hz over dur) through a resonator bank — chairs, beds, hinges */
  /* rendered in JS (impulse train → resonator bank → peak 1), like the 2편 renderHinge — a realtime single-sample train into
     narrow band-passes is ≈ 30 dB too weak and unstable */
  function stickSlip(t, dur, f0, f1, out, gain, modes, o) {
    o = o || {};
    const c = A.ctx, sr = c.sampleRate, len = Math.ceil((dur + 0.12) * sr), imp = new Float32Array(len);
    let tt = 0;
    while (tt < dur) {
      const f = f0 * Math.pow(f1 / f0, tt / dur), e = Math.min(1, tt / (o.att || 0.04), (dur - tt) / (o.rel || 0.08));
      const i = Math.floor(tt * sr); if (i + 1 < len) { const a = e * rnd(0.6, 1); imp[i] += a; imp[i + 1] -= a * 0.5; }
      tt += (1 / f) * (1 + rnd(-0.25, 0.25));
    }
    const ms = (modes || [[420, 12, 1], [980, 12, 0.6], [2100, 12, 0.3]]).map(([f, q, g]) => ({ bq: BQ('bandpass', f, q, sr), g }));
    const body = o.body ? BQ('lowpass', o.body, 0.7, sr) : null;
    const b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) { const x = imp[i]; let y = 0; for (let k = 0; k < ms.length; k++) y += ms[k].bq(x) * ms[k].g; if (body) y += body(x) * (o.bodyGain || 0.5); d[i] = y; }
    const pk = peakOf(d) || 1; for (let i = 0; i < len; i++) d[i] /= pk;
    const s = c.createBufferSource(); s.buffer = b;
    const g = c.createGain(); g.gain.value = gain; s.connect(g); g.connect(out);
    s.start(Math.max(t, now()));
    A.stats.sources++;
    return s;
  }
  /** wait until the AudioContext runs (iOS interruption / hidden), then fn(elapsedSec); gives up after maxSec */
  function whenRunning(fn, maxSec) {
    const t0 = performance.now();
    const tryIt = () => {
      const el = (performance.now() - t0) / 1000;
      if (A.ctx && A.ctx.state === 'running' && !document.hidden) { fn(el); return; }
      if (el > (maxSec || 30)) return;
      setTimeout(tryIt, 100);
    };
    tryIt();
  }

  /* =========================================================
   * 4. House layers (§7.1.4 · §7.2 A) — A.defineAmb · levels in vars.au.amb (engine) · positions follow the listener
   * ========================================================= */
  let HT = 0;                                       // house trim dB (credits −6 — §6.2 B20)
  const LAY = {};                                   // spatial layer records { id, srcFn, vias, at, w, key }
  const LSPEC = {
    apt: { L0: -52, LS: -54 }, fridge: { L0: -42, LT: -40, LS: -52 }, clock: { L0: -46, LS: -60 }, 'breath.jimin': { L0: -46 },
    'breath.kongi': (k) => (k === 'kongiFeet' ? { LT: -48, ref: 'LT' } : { L0: -52 }), air: { L0: -37 }, wind90: { L0: -56 },
    boilerPump: { L0: -50 }, 'stove.flame': { LT: -48, ref: 'LT' }, 'soup.simmer': { LT: -50, ref: 'LT' }, 'breath.mom': { LT: -46, ref: 'LT' },
  };
  const AMBCAL = {                                  // per-layer recipe trims (dB), measured vs LSPEC (work/harness/audio_cal2.js) — continuous
    apt: 15.5, fridge: 5, clock: 5, wind90: 11, boilerPump: 5, 'stove.flame': 13.5, air: 17,   // layers: window RMS · clock: tick peak ·
    'breath.jimin': 5, 'breath.kongi': 10, 'breath.mom': 7, 'soup.simmer': 4.5,           // breaths: active-breath RMS (≈ peak − 11) · soup: bubble peak
  };
  const specOf = (id, key) => { const s = LSPEC[id]; return typeof s === 'function' ? s(key) : s || { L0: -50 }; };
  function viaW(vias, via) { const w = {}; vias.forEach((v) => { w[v] = v === via ? 1 : 0; }); if (vias.indexOf(via) < 0) w[vias[0]] = 1; return w; }
  function spatialLayer(api, id, srcFn, vias, o) {
    o = o || {};
    const lis = listener(), key = srcFn(), P = place(key, lis), sp = specOf(id, key);
    const amp0 = ampFor(null, sp, key, P, lis, {});
    const w = viaW(vias, P.via);
    const at = A.at(P.az, { dist: P.dist, el: P.el, via: w, ir: P.ir || null, wet: P.wet || 0, bus: 'amb', life: Infinity, quiet: (sp.L0 || sp.LT || -50) < -44,
      noHrtf: !!o.noHrtf || ((navigator.hardwareConcurrency || 8) <= 4 && !!o.lowCpu), noFacing: !!o.noFacing });
    const R = LAY[id] = { id, srcFn, vias, at, w, key, base0: amp0.g };
    const L = api.mkLayer({ base: amp0.g * db(AMBCAL[id] || 0), out: at || A.bus('amb'), tmul: () => (o.tmul ? o.tmul() : 1) * R.mulNow * db(HT) });
    R.mulNow = 1;
    L.at = at; R.L = L;
    return L;
  }
  function relocate(id, sec) {
    const R = LAY[id]; if (!R || !R.at || !A.ctx) return;
    const lis = listener(), key = R.srcFn(), P = place(key, lis);
    if (!P) return;
    const w = viaW(R.vias, P.via), sp = specOf(id, key);
    const a = ampFor(null, sp, key, P, lis, {});
    R.mulNow = R.base0 ? a.g / R.base0 : 1;
    const st = R.at.state ? R.at.state() : null;
    try {
      R.at.path([{ dt: 0, az: st ? st.az : P.az, dist: st ? st.dist : P.dist, el: st ? st.el : P.el, via: Object.assign({}, R.w) },
        { dt: Math.max(0.03, sec || 0.03), az: P.az, dist: P.dist, el: P.el, via: w }]);
    } catch (e) {}
    R.w = w; R.key = key;
    if (R.L && R.L.level > 0) R.L.apply(sec || 0.05);
  }
  /* -- apt room tone: uncorrelated brown ×2 (±0.5) → LP 220 (LS 260) — no HRTF -- */
  A.defineAmb('apt', (api) => {
    const c = A.ctx;
    const L = api.mkLayer({ base: db(-52) * db(AMBCAL.apt || 0) * 0.5, tmul: () => (listener() === 'LS' ? db(-2) : 1) * (flag('END') ? db(1) : 1) * db(HT) });
    const s = c.createBufferSource(); s.buffer = A._brown; s.loop = true;
    const sp = c.createChannelSplitter(2); s.connect(sp);
    const pl = c.createStereoPanner(), pr = c.createStereoPanner(); pl.pan.value = -0.5; pr.pan.value = 0.5;
    sp.connect(pl, 0); sp.connect(pr, 1);
    const lp = A.filter('lowpass', 220, 0.6); pl.connect(lp); pr.connect(lp); lp.connect(L.g);
    s.start(now(), Math.random() * 3); L.nodes.push(s);
    L.relis = (sec) => { lp.frequency.setTargetAtTime(listener() === 'LS' ? 260 : 220, now(), Math.max(0.02, (sec || 0.8) / 3)); };
    L.relis(0.05);
    return L;
  }, -52);
  /* -- fridge: compressor harmonics + fan + whine — never stops (§7.2 A) -- */
  const FR_H = [[60, -8], [120, 0], [180, -9], [240, -15], [360, -22]];
  const frHarm = (f, g) => (spk() ? (f === 60 ? -60 : f <= 240 ? g + 4 : g) : g);
  A.defineAmb('fridge', (api) => {
    const c = A.ctx;
    const L = spatialLayer(api, 'fridge', () => 'fridge', ['inRoom', 'srDoor'], { lowCpu: true });
    const mod = c.createGain(); mod.gain.value = 1; mod.connect(L.g);
    const am = c.createOscillator(); am.frequency.value = 0.13; const amg = c.createGain(); amg.gain.value = db(1.5) - 1; am.connect(amg); amg.connect(mod.gain); am.start();
    const wob = c.createOscillator(); wob.frequency.value = 0.071; wob.start();
    L.harm = FR_H.map(([f, g]) => {
      const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = db(frHarm(f, g)) * 0.42; o.connect(og); og.connect(mod);
      const wg = c.createGain(); wg.gain.value = f * 0.003; wob.connect(wg); wg.connect(o.frequency); o.start(); L.nodes.push(o); return { f, g, og };
    });
    const fan = c.createBufferSource(); fan.buffer = A._pink; fan.loop = true;
    const fhp = A.filter('highpass', 250, 0.7), flp = A.filter('lowpass', 900, 0.7), fg = A.gainNode(db(-16) * nbw(650) * 0.42, mod);
    fan.connect(fhp); fhp.connect(flp); flp.connect(fg); fan.start(now(), Math.random() * 3);
    const wh = c.createOscillator(); wh.frequency.value = 1100; const whg = A.gainNode(db(-34) * 0.42, mod); wh.connect(whg);
    const dr = c.createOscillator(); dr.frequency.value = 0.05; const drg = A.gainNode(8, wh.frequency); dr.connect(drg); wh.start(); dr.start();
    L.nodes.push(am, wob, fan, wh, dr);
    L.mode = () => { const t = now(); L.harm.forEach((h) => h.og.gain.setTargetAtTime(db(frHarm(h.f, h.g)) * 0.42, t, 0.3)); };
    return L;
  }, -42);
  /* -- wall clock: quartz tick 1 Hz real seconds (tick / tock ±3 % · −1 dB) -- */
  A.defineAmb('clock', (api) => {
    const L = spatialLayer(api, 'clock', () => 'clock', ['inRoom', 'srDoor'], { lowCpu: true });
    let next = Math.ceil(now() + 0.1), k = 0;
    L.kills.push(A.every((t) => {
      if (L.level <= 0) { next = Math.ceil(t + 0.1); return; }
      while (next < t + 0.3) {
        const tock = (k++ % 2) === 1, f = 1250 * (tock ? 0.97 : 1.03), g = tock ? db(-1) : 1;
        click(next, 0.55 * g, L.g, 3200, 2, 0.0015);
        tone(f, next, 0.006, 0.6 * g, L.g, { a: 0.0003 });
        next += 1;
      }
    }));
    return L;
  }, -46);
  /* -- breath loops: 지민 (sleeping, 4.8 s ±8 % + a deep sigh every 60–90 s) · 콩이 (2.4 s) · 엄마 (seated 0.25 Hz, hold/move) -- */
  function breathLoop(L, cycle) {
    let next = now() + 0.3, held = 0;
    L.hold = (sec) => { held = now() + (sec || 3); };
    L.kills.push(A.every((t) => {
      if (L.level <= 0) { next = t + 0.3; return; }
      if (t < held) { next = Math.max(next, held); return; }
      while (next < t + 0.4) next += cycle(next, L.g);
    }));
  }
  A.defineAmb('breath.jimin', (api) => {
    const L = spatialLayer(api, 'breath.jimin', () => 'sofa', ['inRoom', 'srDoor']);
    let sigh = now() + rnd(60, 90);
    breathLoop(L, (t, out) => {
      const deep = t >= sigh; if (deep) sigh = t + rnd(60, 90);
      const k = rnd(0.92, 1.08) * (deep ? 1.35 : 1), g = deep ? 1.4 : 1;
      burst(t, 1.7 * k, g * nb(500, 0.9), out, [['bandpass', 500, 0.9]], { shape: ENV.sin2 });
      burst(t, 1.7 * k, g * 0.5 * nb(1100, 1.4), out, [['bandpass', 1100, 1.4]], { shape: ENV.sin2 });
      burst(t + 2.0 * k, 2.4 * k, g * 0.85 * nb(400, 0.8), out, [['bandpass', 400, 0.8], ['highshelf', 2000, 0.7, -4]], { shape: ENV.exhale });
      return 4.8 * k;
    });
    return L;
  }, -46);
  const kongiKey = () => (flag('collarOn') || (G.room && G.room.get && safe(() => G.room.get('kongi'), null) === 'feet') ? 'kongiFeet' : 'kongiSr');
  A.defineAmb('breath.kongi', (api) => {
    const L = spatialLayer(api, 'breath.kongi', kongiKey, ['inRoom'], { lowCpu: true });
    breathLoop(L, (t, out) => {
      const k = rnd(0.94, 1.06);
      burst(t, 0.5 * k, 0.8 * nb(1400, 1.2), out, [['bandpass', 1400, 1.2]], { shape: ENV.inhale });
      burst(t + 0.62 * k, 0.9 * k, nb(900, 1), out, [['bandpass', 900, 1]], { shape: ENV.exhale, am: [40, 0.15] });
      return 2.4 * k;
    });
    return L;
  }, -52);
  A.defineAmb('breath.mom', (api) => {
    const L = spatialLayer(api, 'breath.mom', () => (LAY['breath.mom'] && LAY['breath.mom'].over) || 'momSeat', ['inRoom', 'srDoor']);
    breathLoop(L, (t, out) => {
      const k = rnd(0.9, 1.1);
      burst(t, 1.6 * k, 0.8 * nb(700, 1), out, [['bandpass', 700, 1]], { shape: ENV.sin2 });
      burst(t + 1.7 * k, 2.2 * k, nb(500, 1), out, [['bandpass', 500, 1]], { shape: ENV.exhale });
      return 4.0 * k;
    });
    return L;
  }, -46);
  /* -- '공기 압' (tension's only target): brown ×2 → LP 160 → 0.04 Hz ±2 dB · gain .03 + .30T · 0 when 덜 무섭게 ∨ speaker ∨ M7 -- */
  A.defineAmb('air', (api) => {
    const c = A.ctx;
    const L = api.mkLayer({ base: db(-37) * db(AMBCAL.air || 0) * 0.5,
      tmul: () => (A.less() || spk() || flag('M7') || flag('HOOK') ? 0 : 0.03 + 0.30 * api.T()) * db(HT) });
    const s = c.createBufferSource(); s.buffer = A._brown; s.loop = true;
    const sp = c.createChannelSplitter(2); s.connect(sp);
    const pl = c.createStereoPanner(), pr = c.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7;
    sp.connect(pl, 1); sp.connect(pr, 0);
    const lp = A.filter('lowpass', 160, 0.5), mod = c.createGain(); mod.gain.value = 1;
    pl.connect(lp); pr.connect(lp); lp.connect(mod); mod.connect(L.g);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.04; const lg = A.gainNode(db(2) - 1, mod.gain); lfo.connect(lg); lfo.start();
    s.start(now(), Math.random() * 3); L.nodes.push(s, lfo);
    const ap = L.apply; L.apply = (f) => ap(flag('M7') ? Math.max(8, f || 0) : f);   // M7: 8 s fade (§7.1.4)
    return L;
  }, -37);
  /* -- veranda wind: pink → HP 200 · LP 600 → 0.06 Hz ±30 % → veranda 90° 3.2 m (stereo panner — no HRTF) -- */
  A.defineAmb('wind90', (api) => {
    const c = A.ctx;
    const L = spatialLayer(api, 'wind90', () => 'veranda', ['veranda'], { noHrtf: true });
    const s = c.createBufferSource(); s.buffer = A._pink; s.loop = true;
    const hp = A.filter('highpass', 200, 0.7), lp = A.filter('lowpass', 600, 0.7), mod = c.createGain(); mod.gain.value = 1;
    s.connect(hp); hp.connect(lp); lp.connect(mod); const g = A.gainNode(nbw(400) * 0.4, L.g); mod.connect(g);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06; const lg = A.gainNode(0.3, mod.gain); lfo.connect(lg); lfo.start();
    s.start(now(), Math.random() * 3); L.nodes.push(s, lfo);
    L.gust = () => { const t = now() + 0.02; mod.gain.cancelScheduledValues(t); mod.gain.setValueAtTime(1, t); mod.gain.linearRampToValueAtTime(db(4), t + 0.6); mod.gain.linearRampToValueAtTime(1, t + 1.6); };
    return L;
  }, -56);
  /* -- boiler pump (ignition + 5 s → 15 min; the hook: until leaving): 60 + 120 Hz hum −10 dB + water BP 400 −12 dB -- */
  A.defineAmb('boilerPump', (api) => {
    const c = A.ctx;
    const L = spatialLayer(api, 'boilerPump', () => 'boiler', ['veranda', 'srDoor']);
    const hum = c.createGain(); hum.gain.value = db(-10) * 1.8; hum.connect(L.g);
    L.hz = [[60, 1], [120, 0.5]].map(([f, g]) => { const o = c.createOscillator(); o.frequency.value = spk() ? f * 2 : f; const og = A.gainNode(g, hum); o.connect(og); o.start(); L.nodes.push(o); return { o, f }; });
    const w = c.createBufferSource(); w.buffer = A._white; w.loop = true; const bp = A.filter('bandpass', 400, 0.9), wg = A.gainNode(db(-12) * nb(400, 0.9) * 0.6, L.g);
    w.connect(bp); bp.connect(wg); w.start(now(), Math.random() * 2); L.nodes.push(w);
    L.mode = () => L.hz.forEach((h) => h.o.frequency.setTargetAtTime(spk() ? h.f * 2 : h.f, now(), 0.2));
    return L;
  }, -50);
  /* -- stove flame (END ② → hook) · soup simmer (END ② + 40 s →) -- */
  A.defineAmb('stove.flame', (api) => {
    const c = A.ctx;
    const L = spatialLayer(api, 'stove.flame', () => 'stove', ['inRoom', 'srDoor']);
    const s = c.createBufferSource(); s.buffer = A._white; s.loop = true;
    const hp = A.filter('highpass', 300, 0.7), lp = A.filter('lowpass', 1200, 0.7), mod = c.createGain(); mod.gain.value = 0.9;
    s.connect(hp); hp.connect(lp); lp.connect(mod); const g = A.gainNode(nbw(900) * 0.45, L.g); mod.connect(g);
    const lfo = c.createOscillator(); lfo.frequency.value = 5; const lg = A.gainNode(0.1, mod.gain); lfo.connect(lg); lfo.start();
    s.start(now(), Math.random() * 2); L.nodes.push(s, lfo);
    let nf = now();
    L.kills.push(A.every((t) => { if (t >= nf) { lfo.frequency.setTargetAtTime(rnd(3, 7), t, 0.2); nf = t + rnd(0.4, 1.2); } }));
    return L;
  }, -48);
  A.defineAmb('soup.simmer', (api) => {
    const L = spatialLayer(api, 'soup.simmer', () => 'stove', ['inRoom', 'srDoor'], { noHrtf: true });
    let next = now() + 0.2;
    L.kills.push(A.every((t) => {
      if (L.level <= 0) { next = t + 0.2; return; }
      while (next < t + 0.3) {
        const f = rnd(280, 380), d = rnd(0.015, 0.04);
        tone(f, next, d, rnd(0.4, 1) * db(-8) * 2, L.g, { a: 0.002, to: f * rnd(1.4, 1.8), glide: d, lin: true });
        next += 1 / rnd(2, 6);
      }
    }));
    return L;
  }, -50);
  /* -- A.amb wrapper: amb.fridge has no off switch (hush excepted) · amb.wind90 rides with amb.apt · layers re-place on (re)start -- */
  const amb0 = A.amb;
  A.amb = function (id, on, o) {
    const key = String(id || '').replace(/^amb\./, '');
    o = o || {};
    const off = on === false || on === 0;
    if (key === 'fridge' && off && !o.force) { warn('amb.fridge never stops (§7.1.4) — ignored'); return undefined; }
    if (!off && LAY[key] && A.ambient[key]) relocate(key, 0.05);
    const r = amb0.call(A, id, on, o);
    if (key === 'apt' && !off) { const a = A._au(); if (!(a.amb && a.amb.wind90 > 0) && !A.ambient.wind90) amb0.call(A, 'wind90', true, { fade: o.fade != null ? o.fade : 1.5 }); }
    return r;
  };

  /* =========================================================
   * 5. Cues — §7.2 A–H (levels §7.1.6 · places §7.1.2 · callers ARCH §5.17)
   * ========================================================= */
  /* ---------- A. house · micro (§6.1.6) ---------- */
  def('mom.idle', (o) => {
    const k = mk('mom.idle', o, 'momSeat', -48); if (!k) return;
    const w = o.kind || pick(['cloth', 'cup', 'breath']);
    if (w === 'cloth') A.noise(k.t, 0.12, nb(2200, 1.2), k.n, { a: 0.03, filters: [{ type: 'bandpass', freq: 1500, to: 3000, Q: 1.2 }] });
    else if (w === 'cup') { A.noise(k.t, 0.002, 0.9, k.n, { filters: [{ type: 'highpass', freq: 1500 }] }); tone(1800, k.t, 0.04, 0.7, k.n); tone(4100, k.t, 0.02, 0.4, k.n); }
    else burst(k.t, 1.0, nb(700, 1.2) * 0.7, k.n, [['bandpass', 700, 1.2]], { shape: ENV.exhale });
  });
  def('mom.srIdle', (o) => {
    const k = mk('mom.srIdle', o, 'srMom', { L0: -54, LS: -46 }); if (!k) return;
    if ((o.kind || pick(['bed', 'cloth'])) === 'bed') stickSlip(k.t, 0.3, 150, 300, k.n, 0.6, [[150, 6, 1], [300, 6, 0.6], [900, 8, 0.4]]);
    else A.noise(k.t, 0.12, nb(2200, 1.2), k.n, { a: 0.03, filters: [{ type: 'bandpass', freq: 1500, to: 3000, Q: 1.2 }] });
  });
  def('pipe.floor', (o) => {
    const k = mk('pipe.floor', o, 'pipe', -56, { bus: 'amb', life: 46 }); if (!k) return;
    const c = A.ctx, dur = o.dur || 40, sw = c.createGain(); sw.gain.value = 0.7; sw.connect(k.n);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.3; const lg = A.gainNode(0.3, sw.gain); lfo.connect(lg); lfo.start(k.t); lfo.stop(k.t + dur + 0.1);
    burst(k.t, dur, nbw(600) * 0.6, sw, [['highpass', 300, 0.7], ['lowpass', 900, 0.7]], { shape: ENV.swell(0.08, 0.15) });
    for (let tt = k.t + rnd(0.5, 2); tt < k.t + dur - 0.5; tt += rnd(1, 3)) tone(400, tt, 0.02, 0.5, k.n, { a: 0.002, to: 900, glide: 0.02 });
  });
  def('m.creak', (o) => {
    const k = mk('m.creak', o, null, -52, { bus: 'amb', life: 2 }); if (!k) return;
    click(k.t, 1, k.n, 2000, 6, 0.01);
    if (Math.random() < 0.3) click(k.t + 0.18, db(-4), k.n, 2000, 6, 0.01);
  });
  def('m.fridgeTick', (o) => {
    const k = mk('m.fridgeTick', Object.assign({}, o, { az: null, dist: null, el: null }), 'fridge', -48, { bus: 'amb', life: 2 }); if (!k) return;
    click(k.t, 1, k.n, 1400, 2, 0.006); tone(900, k.t, 0.02, 0.5, k.n);
  });
  function kongiSigh(o, spec, id) {
    const k = mk(id || 'kongi.sigh', o, kongiKey(), spec || -48, { bus: id === 'm.kongiSigh' ? 'amb' : 'sfx', life: 3 }); if (!k) return;
    click(k.t, 0.6, k.n, 1400, 2, 0.04);
    burst(k.t + 0.03, 0.9, nb(800, 1), k.n, [['bandpass', 800, 1]], { shape: ENV.exhale });
  }
  def('m.kongiSigh', (o) => { if (flag('M6') && !flag('kongiBack')) return; kongiSigh(Object.assign({}, o, { az: null, dist: null, el: null }), -50, 'm.kongiSigh'); });
  def('kongi.sigh', (o) => kongiSigh(o));
  def('m.jiminTurn', (o) => {
    if (flag('jiminUp')) return;
    const k = mk('m.jiminTurn', Object.assign({}, o, { az: null, dist: null, el: null }), 'sofa', -48, { bus: 'amb', life: 3 }); if (!k) return;
    burst(k.t, 0.28, nbw(1900), k.n, [['bandpass', 1200, 0.6]], { shape: ENV.sin });
    burst(k.t + 0.32, 0.26, nbw(1900) * 0.8, k.n, [['bandpass', 1200, 0.6]], { shape: ENV.sin });
    stickSlip(k.t + 0.15, 0.3, 90, 160, k.n, db(-6), [[90, 5, 1], [160, 5, 0.6]]);
  });
  def('m.carFar', (o) => {
    const lis = listener();
    const k = mk('m.carFar', lis === 'LS' ? { src: 'road' } : Object.assign({ src: 'road' }, o), 'road', -56, { bus: 'amb', life: 7, noFacing: true }); if (!k) return;
    burst(k.t, 4, nbw(300) * 0.7, k.n, [['lowpass', 300, 0.7]], { brown: true, shape: ENV.sin2 });
    burst(k.t, 4, db(-20) * nb(1500, 1), k.n, [['bandpass', 1500, 1]], { shape: ENV.sin2 });
  });
  def('m.gust', (o) => {
    const W = A.ambient.wind90; if (W && W.gust && W.level > 0) W.gust();
    const k = mk('m.gust', Object.assign({}, o, { az: null, dist: null, el: null }), 'veranda', -54, { bus: 'amb', life: 3 }); if (!k) return;
    burst(k.t, 1.5, db(4) * nbw(900) * 0.5, k.n, [['highpass', 300, 0.7, null, 1200]], { pink: true, shape: ENV.swell(0.4, 0.4) });
    for (let i = 0, n = rndi(2, 3); i < n; i++) click(k.t + rnd(0.4, 1.2), 0.5, k.n, Math.random() < 0.5 ? 2100 : 3400, 6, 0.004);
  });
  def('m.upstairs', (o) => {
    const k = mk('m.upstairs', Object.assign({}, o, { az: null, dist: null, el: null }), 'upstairs', -54, { bus: 'amb', life: 9 }); if (!k) return;
    burst(k.t, 6, nbw(600) * 0.8, k.n, [['lowpass', 600, 0.7]], { shape: ENV.swell(1 / 6, 3 / 6) });
    burst(k.t + 5.4, 0.4, nbw(300), k.n, [['lowpass', 300, 0.7]], { shape: ENV.sin });
  });
  def('m.srWindow', (o) => {
    const k = mk('m.srWindow', Object.assign({}, o, { az: null, dist: null, el: null }), 'srWindow', -58, { bus: 'amb', life: 5 }); if (!k) return;
    burst(k.t, 3, nb(3200, 8), k.n, [['highpass', 1800, 0.7], ['bandpass', 3200, 8]], { shape: ENV.sin2 });
  });

  /* ---------- B. 콩이 ---------- */
  def('kongi.sniff', (o) => {
    const k = mk('kongi.sniff', o, 'kongiSr', -46, { life: 2 }); if (!k) return;
    burst(k.t, 0.09, nb(1200, 2), k.n, [['bandpass', 1200, 2]], { shape: ENV.exhale, am: [70, 0.3] });
    burst(k.t, 0.09, db(-6) * nb(2600, 3), k.n, [['bandpass', 2600, 3]], { shape: ENV.exhale, am: [70, 0.3] });
  });
  function tailHit(t, out, g) {
    A.noise(t, 0.04, db(-12) * nb(3000, 1.2) * g, out, { a: 0.01, filters: [{ type: 'bandpass', freq: 3000, Q: 1.2 }] });
    tone(140, t + 0.035, 0.035, g, out, { a: 0.001, to: 85, glide: 0.03 });
    A.noise(t + 0.035, 0.012, 0.5 * nbw(1200) * g, out, { filters: [{ type: 'lowpass', freq: 1200 }] });
  }
  def('kongi.tail', (o) => {
    const end = flag('END') || o.end;
    const k = mk('kongi.tail', o, end ? 'kongiFeet' : 'kongiSr', end ? { LT: -40, ref: 'LT' } : { L0: -40 }, { life: 3 }); if (!k) return;
    const n = o.n || (end ? 4 : 2), gap = end ? 0.18 : 0.28;
    for (let i = 0; i < n; i++) tailHit(k.t + i * gap, k.n, rnd(0.85, 1));
  });
  function claw(t, out, g) { const f = rnd(3500, 5500); A.noise(t, 0.0015, g * nb(f, 3), out, { filters: [{ type: 'bandpass', freq: f, Q: 3 }] }); tone(2000, t, 0.004, g * 0.5, out); }
  function doorT() { try { return G.door && G.door.t ? G.door.t() : null; } catch (e) { return null; } }
  def('kongi.claws', (o) => {
    const dt0 = doorT();
    const walk = o.mode ? o.mode === 'walk' : o.walk != null ? !!o.walk : flag('kongiBack') || (dt0 != null && dt0 > 100);
    const lessOn = isLess(o), dur = o.dur || (walk ? 2.4 : 2.0);
    const from = walk ? 'kongiDoor' : 'kongiSr', to = walk ? 'kongiSr' : 'kongiDoor';
    const keys = o.path && o.path.length > 1 ? o.path : [{ dt: 0, src: from }, { dt: dur, src: to }];
    const o2 = Object.assign({}, o, { path: null, src: keys[0].src || o.src, az: keys[0].src ? o.az : keys[0].az, dist: keys[0].src ? o.dist : keys[0].dist });
    const k = mk('kongi.claws', o2, from, walk ? { L0: -40, LS: -38 } : { L0: -36, LS: -34 }, { life: dur + 3, db: !walk && lessOn ? -4 : 0 }); if (!k) return;
    if (!(o.az != null && !o.path)) k.n.path(pathOf(keys, k.lis));
    if (walk) { for (let tt = 0; tt < dur; tt += 1 / 6 * rnd(0.85, 1.15)) claw(k.t + tt, k.n, rnd(0.5, 1)); }
    else { for (let tt = 0; tt < dur; tt += 0.28) for (let j = 0; j < 4; j++) claw(k.t + tt + j * rnd(0.03, 0.05), k.n, rnd(0.5, 1)); }
  });
  /* bark: 1편 renderDoorlock '왈' (voiced pulse + breath → formants 700 / 1400 / 2600 · 12 ms attack · τ 55 ms · tanh 1.6) */
  let BARK = null;
  function barkBufs() {
    const c = A.ctx, sr = c.sampleRate;
    if (BARK && BARK.sr === sr) return BARK.b;
    const one = (fa, fb, seed) => {
      const dur = 0.18, len = Math.floor(0.36 * sr), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), r = rngS(seed);
      const f1 = BQ('bandpass', 700, 3, sr), f2 = BQ('bandpass', 1400, 4, sr), f3 = BQ('bandpass', 2600, 5, sr);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const s = i / sr, f0 = fa + (fb - fa) * Math.min(1, s / dur);
        ph += f0 / sr; if (ph >= 1) ph -= 1;
        const src = s < dur ? (ph < 0.12 ? 1 - ph / 0.12 : 0) * 1.6 - 0.2 + r() * 0.35 : r() * 0.05 * Math.exp(-(s - dur) / 0.02);
        const env = s < 0.012 ? s / 0.012 : Math.exp(-(s - 0.012) / 0.055);
        d[i] = Math.tanh((f1(src) * 1.2 + f2(src) * 0.85 + f3(src) * 0.35) * env * 1.6);
      }
      const pk = peakOf(d) || 1; for (let i = 0; i < len; i++) d[i] /= pk;
      return b;
    };
    BARK = { sr, b: [one(660, 420, 44), one(627, 399, 45)] };
    return BARK.b;
  }
  def('kongi.bark2', (o) => {
    const lessOn = isLess(o);
    const k = mk('kongi.bark2', o, 'kongiDoor', { L0: -16, LS: -20 }, { life: 3 }); if (!k) return;
    const c = A.ctx, [b1, b2] = barkBufs();
    const sum = c.createGain(); sum.connect(k.n);
    const dl = c.createDelay(0.1); dl.delayTime.value = 0.014; const dg = A.gainNode(db(-8), k.n); sum.connect(dl); dl.connect(dg);   // steel-door reflection
    const play = (b, t, g) => { const s = c.createBufferSource(); s.buffer = b; const gg = A.gainNode(g, sum); s.connect(gg); s.start(t); A.stats.sources++; };
    play(b1, k.t, 1);
    if (!lessOn) play(b2, k.t + 0.32, db(-2));                     // 덜 무섭게 = the first bark only (§6.1.8)
    arc(k.P.az);
  });
  def('kongi.settle', (o) => {
    const k = mk('kongi.settle', o, 'kongiSr', -46, { life: 4 }); if (!k) return;
    claw(k.t, k.n, 0.8); claw(k.t + 0.12, k.n, 0.7);
    tone(90, k.t + 0.3, 0.06, 0.9, k.n, { a: 0.003 }); A.noise(k.t + 0.3, 0.04, 0.5 * nbw(400), k.n, { filters: [{ type: 'lowpass', freq: 400 }] });
    setTimeout(() => kongiSigh(o, -48), 700);
  });
  def('kongi.stand', (o) => {
    const k = mk('kongi.stand', o, 'kongiSr', { LT: -46, ref: 'LT' }, { life: 3 }); if (!k) return;
    for (let i = 0; i < 3; i++) claw(k.t + i * 0.12, k.n, rnd(0.7, 1));
  });
  const BELL = [[4186, 0.5], [5274, 0.32], [6645, 0.2], [7902, 0.14]];
  function bellStrike(t, g, out, inh) { BELL.forEach(([f, d], i) => tone(f * (1 + inh), t, d * 0.3 * 4, g * [0.5, 0.35, 0.22, 0.15][i], out, { a: 0.0008 })); }
  def('kongi.bell', (o) => {
    const k = mk('kongi.bell', o, 'kongiBell', { LT: -28, ref: 'LT' }, { life: 3 }); if (!k) return;
    [[0, 1], [0.15, 0.6], [0.37, 0.35]].forEach(([dt, g]) => bellStrike(k.t + dt, g, k.n, rnd(-0.002, 0.002)));
    arc(k.P.az);
  });
  def('kongi.trot', (o) => {
    const dur = o.dur || 6;
    const k = mk('kongi.trot', o, 'kongiBell', { LT: -44, ref: 'LT' }, { life: dur + 3 }); if (!k) return;
    const keys = k.lis === 'LT' ? [{ dt: 0, az: 46, dist: 5.0 }, { dt: 1.4, az: 30, dist: 4.4 }, { dt: 2.6, az: 0, dist: 3.6 }, { dt: 3.8, az: 320, dist: 2.4 }, { dt: 4.9, az: 290, dist: 1.6 }, { dt: dur, az: 252, dist: 0.95, el: -50 }]
      : [{ dt: 0, src: 'kongiSr' }, { dt: dur * 0.5, az: 330, dist: 2.6 }, { dt: dur, src: 'kongiFeet' }];
    const own = o.path && o.path.length > 2 ? o.path : null;   // a 2-key path (sr door → feet) would cut behind the sofa — keep the hall route
    if (own) k.n.path(pathOf(own, k.lis)); else if (!k.P.explicit) k.n.path(pathOf(keys, k.lis));
    let step = 0;
    for (let tt = 0; tt < dur; tt += 1 / 8 * rnd(0.85, 1.15)) {
      claw(k.t + tt, k.n, rnd(0.5, 1));
      if (++step % rndi(2, 3) === 0) { const [f, d] = BELL[rndi(0, 3)]; tone(f, k.t + tt, rnd(0.06, 0.12), db(-8) * 0.3, k.n, { a: 0.0008 }); }
    }
  });

  /* ---------- C. people ---------- */
  function creak(t, dur, out, g) {
    stickSlip(t, dur, 180, 320, out, g, [[420, 12, 1], [980, 12, 0.6], [2100, 12, 0.3]]);
    A.noise(t, 0.2, db(-8) * nb(600, 1) * g * 0.6, out, { a: 0.03, filters: [{ type: 'bandpass', freq: 600, Q: 1 }] });
  }
  def('chair.creak', (o) => { const k = mk('chair.creak', o, 'momSeat', { L0: -46, LT: -45 }); if (!k) return; creak(k.t, rnd(0.25, 0.4), k.n, 1); });
  def('chair.turn', (o) => {
    const k = mk('chair.turn', o, 'momSeat', { LT: -44, ref: 'LT' }); if (!k) return;
    creak(k.t, 0.15, k.n, 0.8);
    A.noise(k.t + 0.05, 0.12, nb(2200, 1.2) * 0.7, k.n, { a: 0.03, filters: [{ type: 'bandpass', freq: 1500, to: 4000, Q: 1.1 }] });
  });
  def('chair.self', (o) => {
    const k = mk('chair.self', Object.assign({ az: A.getYaw(), dist: 0.3, el: -40 }, o), null, -46, { noFacing: true }); if (!k) return;   // {N}'s own chair — 0.3 m · front · below
    A.noise(k.t, 0.3, nbw(900) * 0.8, k.n, { a: 0.04, flat: true, r: 0.1, filters: [{ type: 'lowpass', freq: 900 }] });
    tone(110, k.t + 0.28, 0.04, 0.8, k.n, { a: 0.002 });
  });
  def('bed.creak', (o) => {
    const k = mk('bed.creak', o, 'srMom', { LS: -44, ref: 'LS' }); if (!k) return;
    stickSlip(k.t, 0.4, 120, 220, k.n, 0.9, [[120, 5, 1], [220, 6, 0.7], [900, 8, 0.3]]);
    tone(300, k.t + 0.05, 0.3, db(-28), k.n, { a: 0.004 });
  });
  function slipperStep(t, out, g) {
    tone(110, t, 0.03, db(-10) * g, out, { a: 0.001, to: 70, glide: 0.03 });
    A.noise(t + 0.005, 0.09, g * nb(1800, 0.9), out, { a: 0.015, filters: [{ type: 'bandpass', freq: 1800, Q: 0.9 }] });
    A.noise(t + 0.1, 0.004, db(-14) * g * nbw(6000), out, { filters: [{ type: 'highpass', freq: 3000 }] });
  }
  function walker(id, o, spec, stepFn, gap) {
    o = o || {};
    const keys = o.path && o.path.length ? o.path : o.from ? [{ dt: 0, src: o.from }, { dt: o.dur || (o.n || 4) * gap, src: o.to || o.from }] : null;
    const first = keys ? keys[0] : null;
    const o2 = first ? Object.assign({}, o, { src: first.src || o.src, az: first.az, dist: first.dist, el: first.el, path: null }) : o;
    const span = keys ? keys[keys.length - 1].dt || 0 : (o.n ? (o.n - 1) * gap : 0);
    const k = mk(id, o2, first && first.src ? first.src : 'momSeat', spec, { life: span + 4 }); if (!k) return undefined;
    if (keys && keys.length > 1) k.n.path(pathOf(keys, k.lis));
    const n = o.n || Math.max(1, Math.round(span / gap) + 1);
    let tt = 0;
    for (let i = 0; i < n; i++) { stepFn(k.t + tt, k.n, rnd(0.85, 1.1)); tt += gap * rnd(0.92, 1.08); }
    return { dur: tt, stop() { try { k.n.release(0.1); } catch (e) {} } };
  }
  /* mom.slippers: −44 at 2.6 m (the level follows the walk — physics) */
  function sockStep(t, out, g) {
    tone(120, t, 0.025, g, out, { a: 0.001, to: 75, glide: 0.025 });
    A.noise(t + 0.005, 0.05, db(-16) * g * nb(2200, 1), out, { a: 0.01, filters: [{ type: 'bandpass', freq: 2200, Q: 1 }] });
  }
  def('mom.slippers', (o) => (o.who === 'jimin' ? walker('steps.jimin', o, { LT: -46, ref: 'LT' }, sockStep, 0.52) : walker('mom.slippers', o, { L0: -44 }, slipperStep, 0.6)));
  def('steps.jimin', (o) => walker('steps.jimin', o, { LT: -46, ref: 'LT' }, sockStep, 0.52));
  def('cloth.rustle', (o) => {
    const k = mk('cloth.rustle', o, 'momSeat', -46, { life: 3 }); if (!k) return;
    A.noise(k.t, 0.12, nb(2500, 1.1), k.n, { a: 0.03, filters: [{ type: 'bandpass', freq: 1500, to: 4000, Q: 1.1 }] });
    A.noise(k.t + 0.18, 0.09, 0.8 * nb(2500, 1.1), k.n, { a: 0.025, filters: [{ type: 'bandpass', freq: 1700, to: 3800, Q: 1.1 }] });
  });
  def('door.sr', (o) => {
    const k = mk('door.sr', o, 'srDoor', -44, { life: 3 }); if (!k) return;
    stickSlip(k.t, 0.6, 380, 620, k.n, 0.8, [[900, 10, 1], [2300, 10, 0.55]]);
  });
  def('mom.gasp', (o) => {
    const k = mk('mom.gasp', o, 'momSeat', -38, { life: 2 }); if (!k) return;
    burst(k.t, 0.35, nb(1100, 1.2), k.n, [['bandpass', 1100, 1.2]], { shape: ENV.gasp });
    burst(k.t, 0.35, db(-6) * nb(2400, 2), k.n, [['bandpass', 2400, 2]], { shape: ENV.gasp });
  });
  def('breath.mom', (o) => {
    if (o.once) {                                    // 03:33 t 40.5 — one trembling exhale (6 Hz AM 8 %)
      const k = mk('breath.mom', o, 'momSeat', -42, { life: 3 }); if (!k) return undefined;
      burst(k.t, 1.6, nb(600, 0.9), k.n, [['bandpass', 600, 0.9]], { shape: ENV.exhale, am: [6, 0.08] });
      return undefined;
    }
    const L = A.ambient['breath.mom'], R = LAY['breath.mom'];
    if (o.hold && L && L.hold) { L.hold(+o.hold); return undefined; }   // climax 12.6 / 26.6 — the breath stops (3.4 s)
    if (o.src && R) { R.over = o.src; relocate('breath.mom', o.ms != null ? o.ms / 1000 : 1.2); }   // to the sink and back (§6.2 B17)
    if (o.on === false) { A.amb('breath.mom', false, o); return undefined; }
    if (o.on === true || !L || !(L.level > 0)) A.amb('breath.mom', o.level != null ? o.level : true, o);
    else if (o.gainDb != null) A.amb('breath.mom', true, o);
    return undefined;
  });
  ['breath.jimin', 'breath.kongi', 'stove.flame', 'soup.simmer'].forEach((id) => def(id, (o) => { A.amb(id, o.on === false ? false : o.level != null ? o.level : true, o); }));
  def('mom.exhale', (o) => {
    const k = mk('mom.exhale', o, 'momSeat', { LT: -40, ref: 'LT' }, { life: 4 }); if (!k) return;
    burst(k.t, 2.4, nb(600, 0.8), k.n, [['bandpass', 600, 0.8]], { shape: ENV.exhale, am: [6, 0.08] });
  });
  def('hand.mouth', (o) => {
    const k = mk('hand.mouth', o, 'momSeat', { LT: -44, ref: 'LT' }, { life: 2 }); if (!k) return;
    burst(k.t, 0.2, nbw(1200), k.n, [['highpass', 300, 0.7], ['lowpass', 1500, 0.7]], { shape: ENV.sin });
  });
  def('jimin.wake', (o) => {
    const k = mk('jimin.wake', o, 'sofa', { L0: -40, LS: -54 }, { life: 4 }); if (!k) return;
    [0, 0.32, 0.62].forEach((dt, i) => burst(k.t + dt, 0.3, nbw(1900) * (1 - i * 0.15), k.n, [['bandpass', 1200, 0.6]], { shape: ENV.sin }));
    stickSlip(k.t + 0.2, 0.5, 90, 160, k.n, 0.7, [[90, 5, 1], [160, 5, 0.6], [300, 6, 0.3]]);
  });
  let MURMUR = null;
  function murmurBuf() {
    const c = A.ctx; if (MURMUR && MURMUR.sampleRate === 22050) return MURMUR;
    const sr = 22050, n = Math.round(14 * sr), d = new Float32Array(n), r = rngS(443);
    const lines = ['네 같이 있는 사람이 방금 신고했어요', '현관 비밀번호를 누가 눌렀어요', '틀렸고요', '지금은 아무 소리도 안 나요', '네 네'];
    let t = 0.3;
    lines.forEach((s) => { const ph = voicedPhrase(hangul(s), sr, { f0: 225, per: 0.14, rng: r }); const i0 = Math.floor(t * sr); for (let i = 0; i < ph.length && i0 + i < n; i++) d[i0 + i] += ph[i]; t += ph.length / sr + rnd(1.0, 1.8); });
    const lp = BQ('lowpass', 900, 0.7, sr), lp2 = BQ('lowpass', 900, 0.7, sr); for (let i = 0; i < n; i++) d[i] = lp2(lp(d[i]));
    const g = 1 / (activeRms(d, sr, 0, n) || 1); for (let i = 0; i < n; i++) d[i] *= g;      // active RMS = 1 → the cue sets dBFS RMS
    const b = c.createBuffer(1, n, sr); b.getChannelData(0).set(d); MURMUR = b; return b;
  }
  def('jimin.murmur', (o) => {
    const dflt = listener() === 'LS' ? { az: 212, dist: 7.8, via: 'srDoor' } : { az: 280, dist: 2.4 };   // 지민 on the phone by the kitchen (§6.2 B13 t 46)
    const k = mk('jimin.murmur', Object.assign(dflt, o), null, { L0: -44, LS: -58 }, { life: 18 }); if (!k) return undefined;
    const b = murmurBuf(), s = A.ctx.createBufferSource(); s.buffer = b; s.connect(k.n); s.start(k.t); A.stats.sources++;
    return { stop(f) { try { k.n.release(f || 0.3); } catch (e) {} } };
  });
  def('buzz.jimin', (o) => {
    const k = mk('buzz.jimin', o, 'momPhone', { L0: -38, LS: -54 }, { life: 5 }); if (!k) return;
    motorBuzz(k.n, k.t, [[0, 0.4], [0.6, 0.4], [2.0, 0.4], [2.6, 0.4]], 150, 400, 25);
  });
  /* the phone's vibration motor on the wooden table (buzz.table · buzz.jimin): square → LP · AM · wood BP 320 */
  function motorBuzz(out, t, segs, hz, lpHz, amHz) {
    const c = A.ctx, os = c.createOscillator(); os.type = 'square'; os.frequency.value = hz;
    const lp = A.filter('lowpass', lpHz, 0.7), g = c.createGain(); g.gain.value = 0;                 // g = the on/off envelope
    const amN = c.createGain(); amN.gain.value = 0.65; const am = c.createOscillator(); am.frequency.value = amHz; const amg = A.gainNode(0.35, amN.gain); am.connect(amg);
    const wood = A.filter('bandpass', 320, 3), wg = A.gainNode(db(-6) * 3, out);
    os.connect(lp); lp.connect(g); g.connect(amN); amN.connect(out); amN.connect(wood); wood.connect(wg);
    const end = segs.reduce((m, s) => Math.max(m, s[0] + s[1]), 0);
    segs.forEach(([dt, d]) => { g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(1, t + dt + 0.01); g.gain.setValueAtTime(1, t + dt + d - 0.01); g.gain.linearRampToValueAtTime(0, t + dt + d); });
    os.start(t); am.start(t); os.stop(t + end + 0.1); am.stop(t + end + 0.1);
    A.stats.sources += 2;
    return { os, g, stop() { const tt = now(); g.gain.cancelScheduledValues(tt); g.gain.setTargetAtTime(0, tt, 0.004); try { os.stop(tt + 0.05); am.stop(tt + 0.05); } catch (e) {} } };
  }

  /* ---------- D. phone · UI ---------- */
  /* ring.talk — the virtual messenger ring (1편 marimba timbre · D5 F♯5 A5 + octave −8 dB · 1.6 s bar · first note 120 ms fade-in) */
  let RING = null, TBUZZ = null;
  function marimba(t, f, v, out, a) {
    tone(f, t, 0.6, v, out, { a: a || 0.002 });
    tone(f * 4, t, 0.12, v * 0.25, out, { a: Math.min(a || 0.001, 0.01) });
    A.osc('triangle', f * 2, t, 0.25, v * 0.15, out, { a: Math.min(a || 0.001, 0.01), decay: true });
  }
  function phoneSpk(c, out, hp) { const h = A.filter('highpass', hp || 400, 0.7), p = A.filter('peaking', 2500, 1, 4), l = A.filter('lowpass', 8000, 0.7); h.connect(p); p.connect(l); l.connect(out); return h; }
  def('ring.talk', (o) => {
    if (RING && !RING.done) return RING.h;
    const lessOn = isLess(o);
    const k = mk('ring.talk', o, 'momPhone', -20, { bus: 'world', life: 60, db: lessOn ? -6 : 0 }); if (!k) return undefined;
    const c = A.ctx, master = c.createGain(); master.gain.value = 1;
    master.connect(phoneSpk(c, k.n, 400));
    const period = o.period || 1.6, max = Math.min(o.n || 18, 18);
    const R = RING = { done: false, i: 0, next: k.t };
    const bar = (t0, first) => {
      [[0, 587.33], [0.14, 739.99], [0.28, 880]].forEach(([dt, f], j) => marimba(t0 + dt, f, 0.9, master, first && j === 0 ? 0.12 : 0.002));
      [[0.5, 1174.66], [0.64, 1479.98], [0.78, 1760]].forEach(([dt, f]) => marimba(t0 + dt, f, 0.9 * db(-8), master));
    };
    const off = A.every((t) => { while (!R.done && R.i < max && R.next < t + 0.4) { bar(R.next, R.i === 0); R.i++; R.next += period; } if (R.i >= max && t > R.next + 1) h.stop(0.05); });
    const h = R.h = {
      stop(fade) {
        if (R.done) return; R.done = true; off();
        const t = now(), f = fade != null ? fade : 0.008;
        master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + Math.max(0.004, f));
        setTimeout(() => { try { k.n.release(0.05); } catch (e) {} }, 400);
        if (TBUZZ) TBUZZ.stop();
      },
      playing: () => !R.done,
    };
    arc(k.P.az);
    return h;
  });
  def('ring.talk.stop', () => { if (RING) RING.h.stop(0.008); if (TBUZZ) TBUZZ.stop(); });
  def('buzz.table', (o) => {
    if (TBUZZ && !TBUZZ.done) return TBUZZ;
    const lessOn = isLess(o);
    const k = mk('buzz.table', o, 'momPhone', -30, { life: 60, db: lessOn ? -6 : 0 }); if (!k) return undefined;
    const period = o.period || 1.6, n = Math.min(o.n || 18, 18), segs = [];
    for (let i = 0; i < n; i++) segs.push([i * period, 0.8]);
    const m = motorBuzz(k.n, k.t, segs, 165, 450, 28);
    const T = TBUZZ = { done: false, stop() { if (T.done) return; T.done = true; m.stop(); setTimeout(() => { try { k.n.release(0.05); } catch (e) {} }, 300); } };
    setTimeout(() => { T.done = true; }, (n * period + 0.5) * 1000);
    return T;
  });
  def('talk.end', (o) => {
    const k = mk('talk.end', Object.assign({ dist: 2.5, el: 10 }, o), 'momPhone', -34, { bus: 'world', life: 2 }); if (!k) return;
    const h = A.filter('highpass', 500, 0.7), l = A.filter('lowpass', 4000, 0.7); h.connect(l); l.connect(k.n);
    A.osc('sine', 987.77, k.t, 0.11, 1, h, { a: 0.004, r: 0.01 }); A.osc('sine', 739.99, k.t + 0.15, 0.11, 1, h, { a: 0.004, r: 0.01 });
  });
  /* phone-UI outputs (call screen · SMS tone) — the ui bus, centre, phone-speaker colour */
  const UICAL = {};
  function uiOut(id, tdb, hp, lp) {
    const c = A.ctx, g = c.createGain(); g.gain.value = db(tdb + (UICAL[id] || 0) + calOf(id, 'L0')) / (0.55 * KSYS);
    const h = A.filter('highpass', hp || 300, 0.7), l = A.filter('lowpass', lp || 8000, 0.7); g.connect(h); h.connect(l); l.connect(A.bus('ui'));
    return g;
  }
  function loopCue(id, tdb, hp, lp, period, maxSec, fn) {
    if (!ok()) return undefined;
    const out = uiOut(id, tdb, hp, lp), t0 = now() + 0.02;
    let next = t0, done = false;
    const off = A.every((t) => { if (done) return; if (t - t0 > maxSec) { h.stop(); return; } while (next < t + 0.4 && next - t0 < maxSec) { fn(next, out); next += period; } });
    const h = { stop(f) { if (done) return; done = true; off(); const t = now(); out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, Math.max(0.003, (f || 0.02) / 3)); setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 400); }, playing: () => !done };
    return h;
  }
  def('talk.dial', (o) => loopCue('talk.dial', -30, 400, 8000, 2.0, o.maxSec || 30, (t, out) => {
    [880, 1108.73].forEach((f) => A.osc('sine', f, t, 0.3, 0.5, out, { a: 0.02, r: 0.08 }));
  }));
  def('call.ringback', (o) => loopCue('call.ringback', -32, 300, 3400, 3.0, o.maxSec || 60, (t, out) => {
    [440, 480].forEach((f) => A.osc('sine', f, t, 1.0, db(-6), out, { a: 0.01, r: 0.01 }));
  }));
  def('call.connect', () => { if (!ok()) return; const out = uiOut('call.connect', -30, 300, 3400), t = now() + 0.01; click(t, 1, out, 1000, 1.5, 0.003); });
  def('call.line', (o) => {
    if (!ok()) return undefined;
    const out = uiOut('call.line', -62, 300, 3400), c = A.ctx, s = c.createBufferSource(); s.buffer = A._pink; s.loop = true;
    const g = A.gainNode(nbw(3100) * 0.6, out); s.connect(g); s.start(now(), Math.random() * 2);
    const max = setTimeout(() => h.stop(), (o.maxSec || 120) * 1000);
    const h = { stop() { clearTimeout(max); const t = now(); out.gain.setTargetAtTime(0, t, 0.02); try { s.stop(t + 0.2); } catch (e) {} }, playing: () => true };
    return h;
  });
  def('call.end', () => { if (!ok()) return; const out = uiOut('call.end', -30, 300, 3400), t = now() + 0.01; A.osc('sine', 620, t, 0.15, 1, out, { a: 0.005, r: 0.02 }); A.osc('sine', 480, t + 0.18, 0.2, 1, out, { a: 0.005, r: 0.03 }); });
  def('call.beep', (o) => { if (!ok()) return; const out = uiOut('call.beep', -30, 300, 3400), t = now() + 0.01; A.osc('sine', (o && o.hz) || 1000, t, (o && o.s) || 0.5, 1, out, { a: 0.005, r: 0.01 }); });
  /* sms.mom '딩동': F♯6 → 0.16 s → D6 (bell partials f · 2.76f · 5.4f) · HP 500 — peak −16 (the −14 master cap wins over §7.1.6's −12) */
  def('sms.mom', (o) => {
    if (!ok()) return;
    const out = uiOut('sms.mom', -16 + ((o && o.gainDb) || 0), 500, 9000), t = now() + 0.01;
    [[1479.98, 0, 0.35], [1174.66, 0.16, 0.5]].forEach(([f, dt, tau]) => {
      tone(f, t + dt, tau * 4, 0.62, out, { a: 0.002 }); tone(f * 2.76, t + dt, tau * 2.5, 0.62 * 0.22, out, { a: 0.001 }); tone(f * 5.4, t + dt, tau * 1.2, 0.62 * 0.07, out, { a: 0.001 });
    });
  });
  def('ez.unfold', () => { if (!ok()) return; A.sfx.tap && A.sfx.tap(); const out = uiOut('ez.unfold', -44, 300, 9000); click(now() + 0.03, 1, out, 2200, 1.5, 0.006); });
  def('ez.fold', () => { if (!ok()) return; A.sfx.tap && A.sfx.tap(); const out = uiOut('ez.fold', -44, 300, 9000); click(now() + 0.03, 1, out, 1800, 1.5, 0.006); });
  ['tap', 'key', 'back', 'msgSend', 'error', 'unlock', 'whoosh', 'pen', 'pageTurn'].forEach((n) => def('ui.' + n, () => { try { A.sfx[n] && A.sfx[n](); } catch (e) {} }));
  def('cam.shutter', () => { try { A.sfx.shutter && A.sfx.shutter(); } catch (e) {} });
  function contact(t, out, g) { click(t, g, out, 2000, 2, 0.003); tone(1400, t, 0.015, g * 0.6, out); }
  def('phone.flip', (o) => { const k = mk('phone.flip', o, 'momPhone', -36); if (!k) return; contact(k.t, k.n, 1); contact(k.t + 0.03, k.n, db(-6)); });
  def('phone.set', (o) => { const k = mk('phone.set', o, 'momPhone', -40); if (!k) return; contact(k.t, k.n, 1); });
  def('phone.slide', (o) => {
    const k = mk('phone.slide', Object.assign({}, o, { path: null }), 'momPhone', -38, { life: 3 }); if (!k) return;
    const keys = o.path && o.path.length ? o.path : [{ dt: 0, src: 'momPhone' }, { dt: 0.5, az: 270, dist: 1.8 }];
    k.n.path(pathOf(keys, k.lis));
    burst(k.t, 0.45, nb(2500, 0.7), k.n, [['bandpass', 2500, 0.7], ['lowpass', 3000, 0.7, null, 1500]], { shape: ENV.swell(0.15, 0.3) });
    burst(k.t, 0.45, db(-12) * nbw(300), k.n, [['lowpass', 300, 0.7]], { shape: ENV.swell(0.15, 0.3) });
  });
  def('glass.set', (o) => {
    const k = mk('glass.set', o, 'momPhone', -36); if (!k) return;
    A.noise(k.t, 0.002, 0.7 * nbw(20000), k.n, { filters: [{ type: 'highpass', freq: 2000 }] });
    [[1950, 0.06, 1], [4400, 0.035, 0.6], [7100, 0.02, 0.35]].forEach(([f, d, g]) => tone(f, k.t, d, g * 0.7, k.n));
    tone(180, k.t, 0.02, 0.4, k.n);
  });

  /* ---------- E. the door · outside ---------- */
  /* door.err3 '삐삐삐': 1편 S.doorlockError timbre (square 2200 · a 1 ms · r 5 ms · LP 5 kHz) × 3 at 0.12 s + piezo BP 2.2 k (Q 4 +3 dB) */
  def('door.err3', (o) => {
    const lessOn = isLess(o);
    const k = mk('door.err3', o, 'keypad', { L0: -24, LS: -30 }, { bus: 'world', life: 4, db: lessOn ? -6 : 0 }); if (!k) return;
    const pz = A.filter('peaking', 2200, 4, 3), lp = A.filter('lowpass', 5000, 0.7); lp.connect(pz); pz.connect(k.n);
    [0, 0.12, 0.24].forEach((dt) => A.osc('square', 2200, k.t + dt, 0.08, 0.6, lp, { a: 0.001, r: 0.005 }));
    arc(k.P.az);
  });
  function hallStep(t, out, g) {
    tone(95, t, 0.03, g, out, { a: 0.001, to: 55, glide: 0.03 });
    A.noise(t, 0.025, 0.6 * g * nbw(900), out, { filters: [{ type: 'lowpass', freq: 900 }] });
    A.noise(t + 0.01, 0.04, db(-8) * g * nb(1200, 1), out, { a: 0.006, filters: [{ type: 'bandpass', freq: 1200, Q: 1 }] });
  }
  def('hall.steps2', (o) => {
    const lessOn = isLess(o), dur = o.dur || 8, gap = 0.58;
    const keys = { L0: [{ dt: 0, az: 340, dist: 6.9 }, { dt: dur / 2, az: 0, dist: 6.2 }, { dt: dur, az: 20, dist: 6.9 }],
      LT: [{ dt: 0, az: 350, dist: 6.3 }, { dt: dur / 2, az: 17, dist: 6.6 }, { dt: dur, az: 38, dist: 7.9 }],
      LS: [{ dt: 0, az: 188, dist: 8.5 }, { dt: dur, az: 194, dist: 8.5 }] };
    const hs = [];
    [0, 1].forEach((p) => {
      const lis = listener(), K = keys[lis] || keys.L0;
      const k = mk('hall.steps2', Object.assign({}, o, { az: K[0].az, dist: K[0].dist, src: 'hallOut' }), 'hallOut', { L0: -44, LS: -52 }, { bus: 'world', life: dur + 4, db: (lessOn ? -6 : 0) + (p ? -2 : 0) });
      if (!k) return;
      k.n.path(K);
      for (let tt = p * 0.27; tt < dur; tt += gap * rnd(0.95, 1.05)) hallStep(k.t + tt, k.n, rnd(0.85, 1.05));
      hs.push(k);
      if (!p) arc(K[0].az);
    });
    return { stop() { hs.forEach((k) => { try { k.n.release(0.2); } catch (e) {} }); } };
  });
  def('firedoor.latch', (o) => {
    if (listener() === 'LS') return;                 // 세아 방: 걸쇠는 들리지 않는다 (§6.2 B13)
    const k = mk('firedoor.latch', o, 'firedoor', -52, { bus: 'world', life: 4 }); if (!k) return;
    A.noise(k.t, 0.002, 0.6 * nbw(20000), k.n, { filters: [{ type: 'highpass', freq: 1500 }] });
    tone(2300, k.t, 0.02, 0.8, k.n); tone(5100, k.t, 0.02, 0.4, k.n);
  });
  def('firedoor.clunk', (o) => {
    const lessOn = isLess(o);
    const k = mk('firedoor.clunk', o, 'firedoor', { L0: -40, LS: -48 }, { bus: 'world', life: 5, db: lessOn ? -6 : 0 }); if (!k) return;
    tone(1600, k.t, 0.12, 0.6, k.n); tone(3900, k.t, 0.06, 0.4, k.n);
    tone(70, k.t + 0.005, 0.2, 1, k.n, { a: 0.003, to: 50, glide: 0.2 });
    A.noise(k.t + 0.005, 0.08, 0.6 * nbw(250), k.n, { filters: [{ type: 'lowpass', freq: 250 }] });
  });
  def('bus.far', (o) => {
    const k = mk('bus.far', o, 'road', { L0: -50, LT: -52 }, { bus: 'world', life: 11, noFacing: true }); if (!k) return;
    const c = A.ctx, dur = 6;
    if (!k.P.explicit) k.n.path([{ dt: 0, az: k.lis === 'LS' ? 190 : 80 }, { dt: dur, az: k.lis === 'LS' ? 200 : 100 }]);
    const am = c.createGain(); am.gain.value = 0.8; am.connect(k.n);
    const lfo = c.createOscillator(); lfo.frequency.value = 38; const lg = A.gainNode(0.2, am.gain); lfo.connect(lg); lfo.start(k.t); lfo.stop(k.t + dur + 0.1);
    burst(k.t, dur, nbw(300) * 0.8, am, [['lowpass', 300, 0.7]], { brown: true, shape: ENV.swell(2.5 / 6, 3 / 6) });
    burst(k.t, dur, db(-20) * nb(1500, 1), k.n, [['bandpass', 1500, 1]], { shape: ENV.swell(2.5 / 6, 3 / 6) });
  });

  /* ---------- G. kitchen · END ---------- */
  def('switch.light', (o) => {
    const k = mk('switch.light', o, 'kitchenSwitch', { LT: -32, ref: 'LT' }, { life: 2 }); if (!k) return;
    click(k.t, 1, k.n, 3500, 2, 0.002); tone(1200, k.t, 0.015, 0.45, k.n);
  });
  def('switch.lamp', (o) => {
    const k = mk('switch.lamp', o, 'srLamp', { LS: -36, L0: -46 }, { life: 2 }); if (!k) return;
    click(k.t, 1, k.n, 4000, 2, 0.0015); tone(2400, k.t, 0.008, 0.5, k.n);
  });
  def('stove.ignite', (o) => {
    const k = mk('stove.ignite', o, 'stove', { LT: -32, ref: 'LT' }, { life: 3 }); if (!k) return;
    for (let i = 0; i < 4; i++) { const t = k.t + i / 7; A.noise(t, 0.001, 0.7 * nbw(20000), k.n, { filters: [{ type: 'highpass', freq: 4000 }] }); tone(2800, t, 0.006, 0.8, k.n); }
    burst(k.t + 4 / 7, 0.25, db(-6) * nbw(1200), k.n, [['lowpass', 700, 0.7, null, 1800]], { shape: ENV.swell(0.08, 0.5) });
  });
  def('ladle', (o) => {
    const n = o.n || 1;
    for (let i = 0; i < n; i++) setTimeout(() => {
      const k = mk('ladle', o, 'stove', { LT: -44, ref: 'LT' }, { life: 3 }); if (!k) return;
      tone(2100, k.t, 0.25, 0.8, k.n); tone(5300, k.t, 0.1, 0.32, k.n);
      burst(k.t + 0.2, 0.6, 0.7 * nbw(900), k.n, [['bandpass', 1000, 1.1]], { shape: ENV.swell(0.1, 0.4) });
    }, i * 900);
  });
  const SEATS = [[270, 0.6], [250, 0.9], [290, 0.9], [225, 0.8]];   // LT: 엄마 · 지민 · {N} … and 세아's seat (§7.2 G)
  let bowlK = 0;                                   // four single calls (ending.js) → the four seats in order, 세아's last
  def('bowl.set', (o) => {
    const list = o.n ? SEATS.slice(0, o.n) : [SEATS[o.i != null ? clamp(o.i | 0, 0, 3) : (bowlK++ % 4)]];
    list.forEach(([az, d], i) => setTimeout(() => {
      const k = mk('bowl.set', Object.assign({}, o, { az, dist: d, el: -20 }), null, { LT: -42, L0: -42 }, { life: 2 }); if (!k) return;
      A.noise(k.t, 0.002, 0.6 * nbw(20000), k.n, { filters: [{ type: 'highpass', freq: 1500 }] });
      [[1100, 0.08, 1], [2600, 0.04, 0.6], [4200, 0.02, 0.35]].forEach(([f, dd, g]) => tone(f, k.t, dd, g * 0.7, k.n));
      tone(200, k.t, 0.025, 0.5, k.n);
    }, i * 900));
  });
  let SPOONS = null;
  def('spoons', (o) => {
    if (o.on === false) { if (SPOONS) SPOONS.stop(); return undefined; }
    if (SPOONS && !SPOONS.done) return SPOONS;
    let timer = null;
    const S = SPOONS = { done: false, stop() { S.done = true; clearTimeout(timer); } };
    const one = () => {
      if (S.done) return;
      const [az, d] = SEATS[rndi(0, 2)];
      const k = mk('spoons', { az, dist: d, el: -20 }, null, { LT: -52, L0: -52 }, { life: 2 });
      if (k) { tone(3400, k.t, 0.06, 0.8, k.n); tone(6100, k.t, 0.05, 0.4, k.n); }
      timer = setTimeout(one, rnd(3000, 7000));
    };
    timer = setTimeout(one, rnd(800, 2500));
    return S;
  });

  /* ---------- H. start and end · the boiler ---------- */
  /* piano.ab — 2편 piano.two recipe on A4 → (2.4 s) → B♭4 · irLiving .3 · centre · peak −24 (no third, no resolution) */
  def('piano.ab', (o) => {
    if (!ok()) return;
    const c = A.ctx, out = c.createGain(); out.gain.value = db(-24 + calOf('piano.ab', 'L0') + ((o && o.gainDb) || 0)) / (KSYS * 0.75);
    const felt = A.filter('lowpass', 2500, 0.7); felt.connect(out); out.connect(A.bus('music'));
    const cv = c.createConvolver(); cv.buffer = A.irBuffer(c, 'irLiving'); const s = A.gainNode(0.3, cv); out.connect(s); cv.connect(A.bus('music'));
    const t0 = now() + 0.05;
    [[440, 0], [466.1638, 2.4]].forEach(([f0, dt]) => {
      for (let n = 1; n <= 8; n++) { const fn = n * f0 * Math.sqrt(1 + 0.0004 * n * n); tone(fn, t0 + dt, 3.5 / Math.sqrt(n), 0.42 / Math.pow(n, 1.4), felt, { a: 0.003 }); }
      A.noise(t0 + dt, 0.006, 0.2, felt, { filters: [{ type: 'lowpass', freq: 2000 }] });
    });
  });
  /** fixed-seed LP noise strike: identical samples every play, so the '퍽' peak does not wander with a random buffer offset */
  let punchBuf = null, punchCtx = null;
  function punchNoise(t, dur, peak, out, freq) {
    const c = A.ctx;
    if (!punchBuf || punchCtx !== c) {
      punchCtx = c; punchBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.3), c.sampleRate);
      const d = punchBuf.getChannelData(0); let x = 20240610;
      for (let i = 0; i < d.length; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; d[i] = (x / 2147483648) - 1; }
    }
    const src = c.createBufferSource(); src.buffer = punchBuf;
    const f = A.filter('lowpass', freq, 0.8), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t, 0); src.stop(t + dur + 0.05);
  }
  /* boiler.fire — relay '딸깍' → igniter ×8 (≈13 Hz) → +0.80 '퍽' → +0.90 fan 4 s → pump (+5 s, 15 min · hook: until leaving) */
  def('boiler.fire', (o) => {
    const n3 = (o.n || 1) >= 3, lessOn = n3 && isLess(o);
    if (n3 && A._hush) hookRelease(0.3);           // the 06:10 sting must sound through the hook's black (replay included)
    const k = mk('boiler.fire', o, 'boiler', n3 ? -22 : -30, { bus: 'world', life: 9, db: lessOn ? -9 : 0 }); if (!k) return;
    const c = A.ctx, t = k.t;
    click(t, db(-18), k.n, 2500, 2, 0.0015); tone(900, t, 0.01, db(-18) * 0.5, k.n);
    for (let i = 0; i < 8; i++) A.noise(t + 0.15 + i / 13, 0.001, db(-22) * rnd(0.5, 0.8) * nbw(20000), k.n, { filters: [{ type: 'highpass', freq: 3000 }] });
    const tp = t + 0.8, puff = c.createGain(); puff.gain.value = 1;
    if (lessOn) { const lp = A.filter('lowpass', 200, 0.7); puff.connect(lp); lp.connect(k.n); } else puff.connect(k.n);
    if (spk()) {                                    // speaker mode: 80 Hz → 160 + 240 Hz (−4 dB) + LP 600 noise strike (§6.4-①)
      tone(160, tp, 0.15, 0.8, puff, { a: 0.008 }); tone(240, tp, 0.15, 0.8 * db(-4), puff, { a: 0.008 });
      A.noise(tp, 0.08, 0.5 * nbw(600), puff, { filters: [{ type: 'lowpass', freq: 600 }] });
    } else {
      tone(80, tp, 0.15, 1, puff, { a: 0.008 });
      punchNoise(tp, 0.08, 0.5 * nbw(200), puff, 200);
      tone(40, tp, 0.25, db(-10), puff, { a: 0.02 });
    }
    const fan = c.createGain(); fan.gain.value = 1; fan.connect(k.n);
    burst(t + 0.9, 4, db(-18) * nbw(400), fan, [['bandpass', 120, 0.8, null, 600]], { brown: true, shape: (x) => clamp(x / 0.1, 0, 1) * (1 - 0.5 * x) * clamp((1 - x) / 0.15, 0, 1) });
    A.osc('sine', 95, t + 0.9, 4, db(-24), fan, { a: 0.4, r: 0.6 }); A.osc('sine', 190, t + 0.9, 4, db(-34), fan, { a: 0.4, r: 0.6 });
    // the pump (persisted: vars.au.pump = { from, until } in playMs)
    const a = A._au(), p0 = pmNow();
    a.pump = { from: p0 + 5000, until: n3 ? -1 : p0 + 5000 + 15 * 60000 }; A._saveSoon();
    setTimeout(() => { A.amb('boilerPump', true, { fade: 2, gainDb: lessOn ? -9 : 0 }); }, 5000);
    if (!n3) setTimeout(() => A.cue('pipe.floor', { dur: 40 }), 30000);
  });
  /* the pump stops by itself 15 min (playMs) after it started — checked on the core tick */
  function pumpAlive() { const p = A._au().pump; return !!(p && (p.until === -1 || pmNow() < p.until)); }

  /* ---------- hum.mom (M7 neutral — cb.D false): 엄마 hums the same notes; the fifth rises toward B♭4 and breaks at +80 cent ---------- */
  let HUMMOM = null;
  function renderHumMom() {
    if (HUMMOM) return HUMMOM;
    const SR = 32000, n = Math.round(6.2 * SR);
    HUMMOM = (async () => {
      if (!A.ctx) return null;
      const d = new Float32Array(n), r = rngS(507);
      humExcite(d, SR, [{ f: NOTE.E4, t0: 0.0, t1: 0.9, vd: 0.35 }, { f: NOTE.A4, t0: 1.05, t1: 1.95, vd: 0.35 }, { f: NOTE.C5, t0: 2.1, t1: 3.0, vd: 0.35 },
        { f: NOTE.B4, t0: 3.15, t1: 4.05, vd: 0.35 }, { f: NOTE.A4, t0: 4.2, t1: 4.72, vd: 9, rise: { to: NOTE.A4 * Math.pow(2, 80 / 1200), dur: 0.4 }, cut: [4.6, 4.72] }], MOM_V, 1, r);
      formantJS(d, SR, MOM_F);
      const hr = activeRms(d, SR, 0, isr(4.72, SR)) || 1;
      // the breath that catches at the break (BP 1.1 kHz · 60 ms) · 4.72–5.40 silence · 5.40–6.20 soft exhale (BP 600 · −8 dB)
      const cb = BQ('bandpass', 1100, 1.5, SR), c0 = isr(4.6, SR), c1 = isr(4.66, SR), ct = new Float32Array(c1 - c0);
      for (let i = 0; i < ct.length; i++) ct[i] = cb(r()) * Math.sin(Math.PI * i / ct.length);
      const cr = rmsOf(ct) || 1; for (let i = 0; i < ct.length; i++) d[c0 + i] += ct[i] * (hr * db(-14) / cr);
      const ebp = BQ('bandpass', 600, 1, SR), i54 = isr(5.4, SR), i62 = isr(6.2, SR);
      const eb = new Float32Array(i62 - i54); for (let i = 0; i < eb.length; i++) { const x = i / eb.length; eb[i] = ebp(r()) * ENV.exhale(x); }
      const ebr = activeRms(eb, SR, 0, eb.length) || 1; for (let i = 0; i < eb.length; i++) d[i54 + i] += eb[i] * (hr * db(-8) / ebr);
      for (let i = 0; i < n; i++) d[i] /= hr;           // active RMS of the hum = 1 → the cue sets −30 dBFS RMS
      const b = A.ctx.createBuffer(1, n, SR); b.getChannelData(0).set(d);
      return b;
    })().catch((e) => { console.error('[sound3] hum.mom', e); HUMMOM = null; return null; });
    return HUMMOM;
  }
  def('hum.mom', (o) => {
    const k = mk('hum.mom', o, 'srMom', { LS: -30, ref: 'LS' }, { bus: 'voice', life: 12 }); if (!k) return undefined;
    let src = null, stopped = false;
    renderHumMom().then((b) => { if (!b || stopped || !ok()) return; src = A.ctx.createBufferSource(); src.buffer = b; src.connect(k.n); src.start(Math.max(now() + 0.01, k.t)); A.stats.sources++; });
    return { stop(f) { stopped = true; try { k.n.release(f || 0.3); } catch (e) {} } };
  });

  /* =========================================================
   * 6. TTS (§7.3): v3_mom_call (live 3 cuts · the recording's near stem) · v3_mom_okay · v3_sea_name (recording only)
   * ========================================================= */
  const pv2 = A.playVoice;
  A.playVoice = function (id, o) { if (/^v3_/.test(String(id || ''))) return playVoice3(String(id), o || {}); return pv2 ? pv2.call(A, id, o) : null; };
  function playVoice3(id, o) {
    const meta = (G.AUDIO_META && G.AUDIO_META[id]) || {};
    const isCall = id === 'v3_mom_call';
    let cuts = Array.isArray(o.cuts) ? o.cuts : o.cuts === true ? meta.cuts_s : null;
    if (o.cut != null && Array.isArray(meta.cuts_s) && meta.cuts_s[o.cut]) { const c0 = meta.cuts_s[o.cut]; cuts = [[c0[0], c0[1], -c0[0]]]; }
    const dur = meta.dur_s || (isCall ? 6.8 : 3.0);
    let ended = false, timer = null;
    const nodes = [];
    const end = () => { if (ended) return; ended = true; clearTimeout(timer); try { o.onEnd && o.onEnd(); } catch (e) { console.error(e); } };
    const h = { id, duration: dur, stopped: false, playing: () => !ended && !h.stopped,
      stop(f) { h.stopped = true; nodes.forEach((n) => { try { n.release(f || 0.08); } catch (e) {} }); end(); } };
    timer = setTimeout(end, (dur + 2) * 1000);
    voiceT(id, 6000).then((buf) => {
      if (h.stopped || !buf) return;                    // no file → subtitles / cards only (the caller's), timers unchanged (§7.1.7)
      whenRunning((lost) => {
        if (h.stopped || !ok()) return;
        const P = pos(o, isCall ? 'momSeat' : 'stove');
        const rms = meta.rms_active_dbfs != null ? meta.rms_active_dbfs : -20;
        const a = ampFor(id, isCall ? { L0: -26 } : { LT: -22, ref: 'LT' }, o.src || (isCall ? 'momSeat' : 'stove'), P, listener(), { gainDb: (o.gainDb || 0) - rms });
        const n = A.at(P.az, { dist: P.dist, el: isCall ? 5 : P.el, via: P.via, ir: 'irLiving', wet: isCall ? 0.5 : 0.3, bus: 'voice', life: dur + 4, gain: a.g });
        if (!n) return;
        nodes.push(n);
        // the TTS takes have a 13–17 dB crest (peak −3…−6.5 dBFS at −20 RMS): a gentle voice compressor keeps the §7.1.6 RMS
        // targets (−26 · −22) under the −14 dBFS master cap (§6.4-③ — no exception)
        const vc = A.ctx.createDynamicsCompressor(); vc.threshold.value = -32; vc.ratio.value = 8; vc.knee.value = 4; vc.attack.value = 0.001; vc.release.value = 0.12; vc.connect(n);
        const t0 = now() + 0.02, segs = cuts ? cuts.map((c) => [c[0], c[1], c[2] || 0]) : [[0, buf.duration, 0]];
        segs.forEach(([s0, s1, shift]) => {
          const startAt = s0 + shift, from = Math.max(s0, s0 + (lost - startAt > 0 ? lost - startAt : 0));   // the context came back late: only what is left
          if (from >= s1 - 0.02) return;
          const src = A.ctx.createBufferSource(); src.buffer = buf; src.connect(vc);
          src.start(t0 + Math.max(0, startAt - lost), from, Math.max(0.02, s1 - from)); A.stats.sources++;
        });
      }, dur);
    });
    return h;
  }

  /* =========================================================
   * 7. The recording rec.sea0333 (§7.2 F track table · §3.7 timeline) — 33.0 s · mono 32 kHz · stems near · sea · name
   *    rendered once after unlock in idle time (fixed seeds); the name stem is cached per PLAYER_NAME; leak = sea stem only.
   * ========================================================= */
  const RSR = 32000, RDUR = 33.0, RN = Math.round(RSR * RDUR);
  const REC = { base: null, premix: null, seaBuf: null, mixBuf: null, name: null, nameP: null, check: null, nameInfo: null };
  const nameOf = () => { try { return String(G.NAME || (window.CONFIG && window.CONFIG.PLAYER_NAME) || '하루').trim() || '하루'; } catch (e) { return '하루'; } };
  const nameYa = () => { try { return G.T ? G.T('{N야}') : nameOf() + '야'; } catch (e) { return nameOf() + '야'; } };
  const n = (sec) => Math.round(sec * RSR);
  const HUM0 = [{ f: NOTE.E4, t0: 1.5, t1: 2.35 }, { f: NOTE.A4, t0: 2.5, t1: 3.35 }, { f: NOTE.C5, t0: 3.5, t1: 4.35 }, { f: NOTE.B4, t0: 4.5, t1: 5.35 },
    { f: NOTE.Bb4, t0: 5.5, t1: 6.5, vd: 0.4 }, { f: NOTE.E4, t0: 6.55, t1: 7.2, fadeOut: 0.6 }];
  const HUM1 = [{ f: NOTE.E4, t0: 8.6, t1: 9.5 }, { f: NOTE.A4, t0: 9.6, t1: 10.5 }, { f: NOTE.C5, t0: 10.6, t1: 11.5 }, { f: NOTE.B4, t0: 11.6, t1: 12.5 },
    { f: NOTE.Bb4, t0: 12.6, t1: 13.8, vd: 0.4 }, { f: NOTE.E4, t0: 13.9, t1: 15.4, fadeOut: 0.9 }];
  const HUM2 = [{ f: NOTE.E4, t0: 22.6, t1: 23.5 }, { f: NOTE.A4, t0: 23.6, t1: 24.5 }, { f: NOTE.C5, t0: 24.6, t1: 25.5 }, { f: NOTE.B4, t0: 25.6, t1: 26.5 },
    { f: NOTE.Bb4, t0: 26.6, t1: 27.8, vd: 0.4 }, { f: NOTE.E4, t0: 27.9, t1: 29.4 }, { f: NOTE.E4, t0: 29.4, t1: 30.9, lvl: [0.5, 0] }];
  /** near stem (엄마): kitchen room tone + v3_mom_call at r 0.6 → phone mic (HP 150 · LP 7 k · AGC −28 / 3:1) · close breath 6.6–7.4 */
  function renderNear(vbuf) {
    const d = new Float32Array(RN), r = rngS(601), i06 = n(0.6), i74 = n(7.4), i744 = n(7.44);
    let voice = false;
    if (vbuf) {
      const v = resample(vbuf, RSR, 7.4 - 0.6), hp = BQ('highpass', 150, 0.707, RSR), lp = BQ('lowpass', 7000, 0.707, RSR);
      for (let i = 0; i < v.length; i++) v[i] = lp(hp(v[i]));
      const g = compEnv(v, RSR, -28, 3, 0.008, 0.3); for (let i = 0; i < v.length; i++) v[i] *= g[i];
      const pk = peakOf(v, 0, n(6.0)) || 1, s = db(-14) / pk;
      for (let i = 0; i < v.length && i06 + i < i74; i++) d[i06 + i] = v[i] * s;
      voice = true;
    }
    const pg = pinkGen(r), lpt = BQ('lowpass', 2000, 0.7, RSR), rt = new Float32Array(i74 - i06);
    for (let i = 0; i < rt.length; i++) rt[i] = lpt(pg());
    const rr = rmsOf(rt) || 1; for (let i = 0; i < rt.length; i++) d[i06 + i] += rt[i] * (db(-58) / rr);
    const bp = BQ('bandpass', 900, 0.8, RSR), i66 = n(6.6), br = new Float32Array(i74 - i66);
    for (let i = 0; i < br.length; i++) br[i] = bp(r()) * ENV.exhale(i / br.length);
    const bpk = peakOf(br) || 1; for (let i = 0; i < br.length; i++) d[i66 + i] += br[i] * (db(-34) / bpk);
    for (let i = i74; i < i744; i++) d[i] *= 1 - (i - i74) / (i744 - i74);          // the far end's noise suppression closes (40 ms)
    for (let i = i744; i < RN; i++) d[i] = 0;
    for (let i = 0; i < i06; i++) d[i] = 0;
    return { d, voice };
  }
  /** sea stem (세아 💛): hums 0·1·2 + breaths + radio.faint through the messenger texture · light 2:1 · floor −48 */
  async function renderSea() {
    const r = rngS(333), T = {}; let tm = performance.now();
    // hums 0 · 1 · 2 (formant /m/ — hum 0 sits 22 dB under hums 1 · 2, i.e. ≈ −34 dB under 엄마's voice)
    const hum = new Float32Array(RN);
    humExcite(hum, RSR, HUM0, SEA_V, db(-22), r); humExcite(hum, RSR, HUM1, SEA_V, 1, r); humExcite(hum, RSR, HUM2, SEA_V, 1, r);
    formantJS(hum, RSR, SEA_F, n(1.4), n(31.0));
    // breaths (BP 900 Q .8): small inhales −36 · breaths −34
    const br = new Float32Array(RN), bp = BQ('bandpass', 900, 0.8, RSR);
    [[7.9, 8.5, -2, 'inhale'], [16.2, 17.9, 0, 'sin2'], [18.4, 20.2, 0, 'sin2'], [22.0, 22.5, -2, 'inhale'], [31.0, 32.4, 0, 'sin2']].forEach(([a, b, g, sh]) => {
      const i0 = n(a), len = n(b) - i0, f = ENV[sh]; for (let i = 0; i < len; i++) br[i0 + i] += bp(r()) * f(i / len) * db(g);
    });
    T.js = Math.round(performance.now() - tm); tm = performance.now();
    const gH = db(-20) / (Math.max(peakOf(hum, n(8.6), n(15.4)), peakOf(hum, n(22.6), n(30.9))) || 1), gB = db(-34) / (peakOf(br, n(16.0), n(20.4)) || 1);
    const sea = new Float32Array(RN);
    for (let i = 0; i < RN; i++) sea[i] = hum[i] * gH + br[i] * gB;
    await messengerJS(sea, RSR, n(0.6), RN - n(0.45), 33);
    T.conv = Math.round(performance.now() - tm); tm = performance.now();
    // light 2:1 compression of the line, then the hum peaks back to −20 dBFS
    const env = compEnv(sea, RSR, -24, 2, 0.01, 0.15, n(0.6), RN);
    for (let i = 0; i < RN; i++) sea[i] *= env[i];
    const mk2 = db(-20) / (Math.max(peakOf(sea, n(8.6), n(15.4)), peakOf(sea, n(22.6), n(30.9))) || 1);
    for (let i = 0; i < RN; i++) sea[i] *= mk2;
    // radio.faint (30.00–30.90 · ★S3-5): meaningless formant murmur f0 150 · 0.11 s syllables + carrier hiss −8 dB · in 0.15 / out 0.2
    // → AM band (HP 300 · LP 1.2 k) → the same line texture → −46 dBFS RMS (no words · no music · no place)
    const i30 = n(30.0), i309 = n(30.9), rlen = n(1.5), ra = new Float32Array(rlen), SYL = ['머', '너', '아', '오', '으', '디', '바', '어', '모', '느', '가', '이'];
    const syl = []; for (let i = 0; i < 9; i++) syl.push(SYL[Math.floor(((r() + 1) / 2) * SYL.length) % SYL.length]);
    const mur = voicedPhrase(syl, RSR, { f0: 150, per: 0.11, rng: r }), hb = BQ('bandpass', 2500, 3, RSR), mr = rmsOf(mur) || 1;
    const a1 = BQ('highpass', 300, qdb(0.707), RSR), a2 = BQ('lowpass', 1200, qdb(0.707), RSR), rw = i309 - i30;
    for (let i = 0; i < rw; i++) { const x = i / rw, e = Math.min(1, x / (0.15 / 0.9), (1 - x) / (0.2 / 0.9)); ra[i] = a2(a1(((mur[i] || 0) / mr + hb(r()) * db(-8) * 6) * e)); }
    for (let i = rw; i < rlen; i++) ra[i] = a2(a1(0));
    await messengerJS(ra, RSR, 0, rlen - n(0.45), 34);
    const gR = db(-46) / (rmsOf(ra, 0, rw) || 1);
    for (let i = 0; i < rlen && i30 + i < RN; i++) sea[i30 + i] += ra[i] * gR;
    const radioDb = toDb(rmsOf(ra, 0, rw) * gR);
    T.post = Math.round(performance.now() - tm);
    // the open line: pink floor −48 RMS from r 0.6 (5 ms in) · 20 ms fade at 32.98–33.00 · digital 0 before 0.6
    const pg = pinkGen(rngS(48)), fl = new Float32Array(RN - n(0.6)); for (let i = 0; i < fl.length; i++) fl[i] = pg();
    const fr = rmsOf(fl) || 1, i06 = n(0.6), fin = n(0.005);
    for (let i = 0; i < fl.length; i++) sea[i06 + i] += fl[i] * (db(-48) / fr) * Math.min(1, i / fin);
    for (let i = 0; i < i06; i++) sea[i] = 0;
    for (let i = n(32.98); i < RN; i++) sea[i] *= (RN - i) / (RN - n(32.98));
    return { sea, radioDb, T };
  }
  /** name stem 21.00–21.80: v3_sea_name.wav when the name is '하루' (file present), else whisper.name (§7.2 F · §4.14.2 · D13) */
  async function renderName(name) {
    const out = new Float32Array(RN), i21 = n(21.0), i218 = n(21.8);
    let mode = 'none', vbuf = null;
    if (name === '하루') { vbuf = await voiceT('v3_sea_name', 6000); if (vbuf) mode = 'file'; }
    const raw = new Float32Array(n(1.0));            // 21.0 … 22.0 (the whisper itself ≤ 0.8 s)
    if (mode === 'file') {
      const v = resample(vbuf, RSR, 0.8), fl = n(0.03);
      for (let i = 0; i < v.length; i++) raw[i] = v[i] * Math.min(1, i / fl, (v.length - i) / fl);
    } else {
      const r = rngS(21), N = nameOf(), syl = hangul(N), ya = hangul(nameYa());
      const allHangul = syl.length > 0 && syl.length === Array.from(N.replace(/\s+/g, '')).length;
      if (allHangul && syl.length <= 4 && ya.length) { const per = Math.min(0.27, 0.8 / ya.length); whisperInto(raw, RSR, 0, per, ya, r); mode = 'whisper'; }
      else { breathWhisperInto(raw, RSR, 0, 0.8, r); mode = 'breath'; }
    }
    // HP 200 · LP 6 k → the same messenger line (no gain, EQ, NR, speed after this — §7.2 F)
    const shaped = new Float32Array(n(1.6)), h2 = BQ('highpass', 200, qdb(0.707), RSR), l6 = BQ('lowpass', 6000, qdb(0.707), RSR);
    for (let i = 0; i < raw.length; i++) shaped[i] = l6(h2(raw[i]));
    await messengerJS(shaped, RSR, 0, raw.length, 33);
    for (let i = 0; i < shaped.length && i21 + i < RN; i++) out[i21 + i] = shaped[i];
    for (let i = n(21.0) + n(1.3); i < Math.min(RN, n(21.0) + n(1.6)); i++) out[i] *= Math.max(0, (n(21.0) + n(1.6) - i) / n(0.3));
    let g;
    const pk = peakOf(out, i21, i218) || 1;
    if (mode === 'file') g = db(-30) / pk;
    else {
      const meta = (G.AUDIO_META && G.AUDIO_META.v3_sea_name) || {}, tgt = meta.rms_db != null ? meta.rms_db : -38;
      const ar = activeRms(out, RSR, i21, i218) || 1; g = db(tgt) / ar;
      const p = toDb(pk * g); if (p > -30) g *= db(-30 - p); else if (p < -31) g *= db(-31 - p);   // peak −30 ± 1 (self-check)
    }
    for (let i = 0; i < RN; i++) out[i] *= g;
    return { d: out, mode };
  }
  function selfCheck(near, sea, name, mix, radioDb) {
    const z = (d, a, b) => { for (let i = a; i < b; i++) if (d[i] !== 0) return false; return true; };
    const humPk = Math.max(peakOf(sea, n(8.6), n(15.4)), peakOf(sea, n(22.6), n(30.9)));
    const f1 = medianPitch(sea, RSR, 12.6, 13.8), f2 = medianPitch(sea, RSR, 26.6, 27.8);
    const ck = { len: mix.length === RN, zeroHead: z(mix, 0, n(0.6)), nearTailZero: z(near, n(7.44), RN), namePeakDb: +toDb(peakOf(name, n(21.0), n(21.8))).toFixed(2),
      humPeakDb: +toDb(humPk).toFixed(2), fifthHz: [+f1.toFixed(2), +f2.toFixed(2)], radioRmsDb: +radioDb.toFixed(2) };
    ck.ok = ck.len && ck.zeroHead && ck.nearTailZero && Math.abs(ck.namePeakDb + 30) <= 1 && Math.abs(ck.humPeakDb + 20) <= 1 &&
      Math.abs(f1 - 466.2) <= 1 && Math.abs(f2 - 466.2) <= 1 && Math.abs(ck.radioRmsDb + 46) <= 2;
    return ck;
  }
  /** autocorrelation pitch, median over 40 ms frames (10 ms hop) inside [t0, t1] (300–700 Hz search) */
  function medianPitch(d, sr, t0, t1) {
    const win = Math.round(0.04 * sr), hop = Math.round(0.01 * sr), minL = Math.floor(sr / 700), maxL = Math.ceil(sr / 300), res = [];
    for (let s = Math.round(t0 * sr); s + win + maxL < Math.round(t1 * sr); s += hop) {
      let e0 = 0; for (let i = 0; i < win; i++) e0 += d[s + i] * d[s + i];
      if (e0 < 1e-9) continue;
      let best = -2, bl = minL; const ac = {};
      for (let L = minL; L <= maxL; L++) { let num = 0, e1 = 0; for (let i = 0; i < win; i++) { const y = d[s + i + L]; num += d[s + i] * y; e1 += y * y; } const v = num / Math.sqrt(e0 * e1 + 1e-12); ac[L] = v; if (v > best) { best = v; bl = L; } }
      let p = 0; if (bl > minL && bl < maxL) { const y0 = ac[bl - 1], y1 = ac[bl], y2 = ac[bl + 1], den = y0 - 2 * y1 + y2; if (den) p = clamp(0.5 * (y0 - y2) / den, -0.5, 0.5); }
      res.push(sr / (bl + p));
    }
    if (!res.length) return 0;
    res.sort((a, b) => a - b); return res[Math.floor(res.length / 2)];
  }
  function mkBuf(arr) { if (!A.ctx) return null; const b = A.ctx.createBuffer(1, arr.length, RSR); if (b.copyToChannel) b.copyToChannel(arr, 0); else b.getChannelData(0).set(arr); return b; }
  function ensureBase() {
    if (REC.base) return REC.base;
    if (!A.ctx) return Promise.resolve(null);
    const t0 = performance.now();
    REC.base = (async () => {
      const call = await voiceT('v3_mom_call', 8000);
      const nr = renderNear(call);
      const se = await renderSea(); if (!se) { REC.base = null; return null; }
      const premix = new Float32Array(RN); for (let i = 0; i < RN; i++) premix[i] = nr.d[i] + se.sea[i];
      REC.premix = premix; REC.seaBuf = mkBuf(se.sea); REC._near = nr.d; REC._sea = se.sea; REC._radioDb = se.radioDb; REC.nearVoice = nr.voice;
      REC.baseMs = Math.round(performance.now() - t0);
      return true;
    })().catch((e) => { console.error('[sound3] rec.sea0333 render', e); REC.base = null; return null; });
    return REC.base;
  }
  function ensureRec() {
    const name = nameOf();
    if (REC.mixBuf && REC.name === name) return Promise.resolve(REC.mixBuf);
    if (REC.nameP && REC.nameFor === name) return REC.nameP;
    REC.nameFor = name;
    REC.nameP = ensureBase().then(async (ok1) => {
      if (!ok1) { REC.nameP = null; REC.nameFor = null; return null; }     // never cache a failed render
      const t0 = performance.now(), nm = await renderName(name);
      if (REC.nameFor !== name) return REC.nameP;      // renamed meanwhile
      const mix = new Float32Array(RN); for (let i = 0; i < RN; i++) mix[i] = REC.premix[i] + nm.d[i];
      REC.mixBuf = mkBuf(mix); REC.name = name; REC.nameInfo = { mode: nm.mode, ms: Math.round(performance.now() - t0) };
      if (REC._near) { REC.check = Object.assign(selfCheck(REC._near, REC._sea, nm.d, mix, REC._radioDb), { name: nm.mode, baseMs: REC.baseMs, nearVoice: REC.nearVoice }); REC._near = null; REC._sea = null; }
      else if (REC.check) { REC.check.namePeakDb = +toDb(peakOf(nm.d, n(21.0), n(21.8))).toFixed(2); REC.check.name = nm.mode; }
      if (G.DEBUG && REC.check && !REC.check.ok) console.warn('[sound3] rec.sea0333 self-check', JSON.stringify(REC.check));
      return REC.mixBuf;
    }).catch((e) => { console.error('[sound3] rec name stem', e); REC.nameP = null; return null; });
    return REC.nameP;
  }
  A.recReady = () => !!(REC.mixBuf && REC.name === nameOf());
  A.nameKey = () => REC.name || nameOf();
  A.renameReset = function () { REC.mixBuf = null; REC.name = null; REC.nameP = null; REC.nameFor = null; if (A.ctx) idle(() => ensureRec(), 2000); };
  A.defineBuffer('rec.sea0333', () => (A.ctx ? ensureRec() : Promise.resolve(null)));
  A.defineBuffer('rec.sea0333.sea', () => (A.ctx ? ensureBase().then((x) => (x ? REC.seaBuf : null)) : Promise.resolve(null)));

  /* ---------- leak.earpiece (03:33 live): sea stem → HP 400 · LP 3.4 k · tanh(2x) → 270° 2.5 m +10° · irLiving .3 → world ---------- */
  let LEAK = null;
  A.leak = function (on) {
    if (!on) { if (LEAK) { LEAK.stop(); LEAK = null; } return; }
    if (LEAK) return;
    const L = LEAK = { stopped: false, n: null, stop() { L.stopped = true; if (L.n) { try { L.n.release(0.08); } catch (e) {} } } };
    if (!REC.seaBuf) { warn('leak: rec.sea0333 not rendered yet — the live call goes on without the leak (§9.7)'); return; }
    whenRunning((lost) => {
      if (L.stopped || !ok()) return;
      const off = 0.6 + lost; if (off >= RDUR - 0.1) return;
      const c = A.ctx, P = { az: 270, dist: 2.5, el: 10, via: 'inRoom' };
      const a = ampFor('leak.earpiece', { L0: -42 }, null, Object.assign({ explicit: true }, P), 'L0', { gainDb: 20 - 3.6 });   // stem hum −20 dBFS → tanh stage ≈ −16.4
      const nd = A.at(P.az, { dist: P.dist, el: P.el, via: 'inRoom', ir: 'irLiving', wet: 0.3, bus: 'world', life: RDUR + 3, gain: a.g });
      if (!nd) return; L.n = nd;
      const s = c.createBufferSource(); s.buffer = REC.seaBuf;
      const hp = A.filter('highpass', 400, 0.707), lp = A.filter('lowpass', 3400, 0.707), pre = A.gainNode(5), sh = c.createWaveShaper(), post = A.gainNode(0.2), g2 = c.createGain();
      const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; cv[i] = Math.tanh(2 * x) / Math.tanh(2) * 0.96; } sh.curve = cv;
      s.connect(hp); hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(post); post.connect(g2); g2.connect(nd);
      const t = now() + 0.02; g2.gain.setValueAtTime(1, t);
      const at22 = t + (22.0 - off); if (at22 > t) { g2.gain.setValueAtTime(1, at22); g2.gain.linearRampToValueAtTime(db(-2), at22 + 0.5); } else g2.gain.setValueAtTime(db(-2), t);
      s.start(t, off); A.stats.sources++;
    }, 30);
  };

  /* ---------- rec.plain.<id> (§7.2 F): cellular narrowband formant murmur of the transcript lines · 8 kHz · one cached at a time ---------- */
  const F0 = { '나': 205, '지민이': 225, '정육점 사장님': 115, '박 권사님': 195, '교회 사무실': 220, '시장 떡집': 125 };
  let PLAIN = null;
  function renderPlain(id) {
    const recs = G.STORY && G.STORY.recordings, rec = Array.isArray(recs) ? recs.find((x) => x && x.id === id) : null;
    if (!rec || !A.ctx) return Promise.resolve(null);
    return new Promise((res) => idle(() => {
      try {
        const sr = 8000, dur = +rec.dur || 30, N = Math.round(dur * sr), d = new Float32Array(N), r = rngS(hash(id));
        const T = (s) => { try { return G.T ? G.T(String(s)) : String(s); } catch (e) { return String(s); } };
        const lines = (rec.lines || []).filter((l) => l && typeof l.t === 'number' && !l.end).sort((a, b) => a.t - b.t);
        const who = (l) => (l.sp === 'me' ? '나' : rec.who);
        const put = (syl, t, f0, g, maxSec) => {
          if (!syl.length) return;
          let s = syl; const per = 0.13 * rnd(0.92, 1.08); if (maxSec && s.length * per > maxSec) s = s.slice(0, Math.max(1, Math.floor(maxSec / per)));
          const ph = voicedPhrase(s, sr, { f0, per, rng: r }), i0 = Math.round(t * sr);
          for (let i = 0; i < ph.length && i0 + i < N; i++) d[i0 + i] += ph[i] * g;
        };
        lines.forEach((l, k) => { const nx = k + 1 < lines.length ? lines[k + 1].t : dur; put(hangul(T(l.text).replace(/\[[^\]]*\]/g, '')), l.t + 0.08, F0[who(l)] || 200, 1, Math.max(0.3, nx - l.t - 0.25)); });
        const MUM = ['네', '응', '그래요', '아니', '그거', '음', '그러니까', '맞아요', '어'];
        for (let k = 0; k < lines.length; k++) {
          const a = lines[k].t + 3.0, b = (k + 1 < lines.length ? lines[k + 1].t : dur) - 1.0;
          for (let t = a + rnd(0.5, 2); t < b; t += rnd(2.5, 6)) put(hangul(pick(MUM)), t, F0[k % 2 ? '나' : rec.who] || 200, db(-6), b - t);
        }
        const h1 = BQ('highpass', 300, 0.707, sr), h2 = BQ('highpass', 300, 0.707, sr), l1 = BQ('lowpass', 3400, 0.707, sr), l2 = BQ('lowpass', 3400, 0.707, sr);
        for (let i = 0; i < N; i++) d[i] = l2(l1(h2(h1(d[i]))));
        const pk = peakOf(d) || 1, kk = 1.5, tn = Math.tanh(kk);
        for (let i = 0; i < N; i++) d[i] = (Math.tanh(kk * (d[i] / pk) * 0.8) / tn) * db(-16);
        const pg = pinkGen(r), fl = BQ('lowpass', 3400, 0.707, sr), fh = BQ('highpass', 300, 0.707, sr), tmp = new Float32Array(N);
        for (let i = 0; i < N; i++) tmp[i] = fh(fl(pg()));
        const fr = rmsOf(tmp) || 1; for (let i = 0; i < N; i++) d[i] += tmp[i] * (db(-52) / fr);
        const b = A.ctx.createBuffer(1, N, sr); b.getChannelData(0).set(d);
        res(b);
      } catch (e) { console.error('[sound3] rec.plain', id, e); res(null); }
    }, 600));
  }
  A.defineBuffer('rec.plain.*', (bid) => {
    const id = String(bid).slice('rec.plain.'.length);
    if (PLAIN && PLAIN.id === id) return PLAIN.p;
    const p = renderPlain(id);
    PLAIN = { id, p };                                 // the previous one is released (≤ 8 MB — §7.3 '나가면 버린다')
    p.then((b) => { if (!b && PLAIN && PLAIN.id === id) PLAIN = null; });
    return p;
  });
  A.defineBuffer('hum.mom', () => (A.ctx ? renderHumMom() : Promise.resolve(null)));

  /* =========================================================
   * 8. Media chains (§7.1.5): 'ear' (the phone at the ear) · 'table' (the phone speaker on the table, after playArmed in lv)
   * ========================================================= */
  const volLaw = (v) => clamp(Math.pow(clamp(+v || 0, 0, 100) / 60, 1.6), 0, 2.5);
  let EAR = null, TABLE = null;
  A.defineMediaChain('ear', () => {
    const c = A.ctx, input = c.createGain(), mono = c.createGain();
    mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.2; an.minDecibels = -100; an.maxDecibels = -20;
    input.connect(mono); input.connect(an);
    const hp = A.filter('highpass', 250, 0.707), lp = A.filter('lowpass', 7000, 0.707), pk = A.filter('peaking', 2600, 1, 2);
    const vol = c.createGain(), trim = c.createGain(); trim.gain.value = db(calOf('rec.ear', 'L0'));
    const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (pan.pan) pan.pan.value = spk() ? 0 : 0.2;
    mono.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(vol); vol.connect(trim); trim.connect(pan); pan.connect(A.bus('music'));
    const ch = EAR = { input, kind: 'ear', latency: 0, analyser: an,
      setVolume(v, tau) { vol.gain.setTargetAtTime(volLaw(v), now(), tau != null ? tau : 0.08); },
      mode() { if (pan.pan) pan.pan.setTargetAtTime(spk() ? 0 : 0.2, now(), 0.05); },
      dispose() { [input, mono, an, hp, lp, pk, vol, trim, pan].forEach((x) => { try { x.disconnect(); } catch (e) {} }); } };
    return ch;
  });
  A.defineMediaChain('table', () => {
    const c = A.ctx, input = c.createGain(), mono = c.createGain();
    mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.2; an.minDecibels = -100; an.maxDecibels = -20;
    input.connect(mono); input.connect(an);
    const hp = A.filter('highpass', 350, 0.707), lp = A.filter('lowpass', 7500, 0.707), pk = A.filter('peaking', 1200, 2, 3);
    const pre = A.gainNode(4), sh = c.createWaveShaper(), post = A.gainNode(0.25);
    const cv = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = (i / 1023.5) - 1; cv[i] = Math.tanh(1.3 * x) / Math.tanh(1.3); } sh.curve = cv;
    const sum = c.createGain(), dl = c.createDelay(0.05); dl.delayTime.value = 0.0016; const dg = A.gainNode(db(-6), sum);
    const vol = c.createGain();
    mono.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(pre); pre.connect(sh); sh.connect(post); post.connect(sum); post.connect(dl); dl.connect(dg); sum.connect(vol);
    const P = place('momPhone', 'LT');
    const a = ampFor('rec.table', { LT: 0, ref: 'LT' }, null, Object.assign({ explicit: true }, P), 'LT', {});
    const at = A.at(270, { dist: 0.7, el: -30, via: 'inRoom', ir: 'irLiving', wet: 0.18, bus: 'music', life: Infinity, gain: a.g * db(2) });
    const toAt = A.gainNode(spk() ? 0 : 1, at || A.bus('music')), toBus = A.gainNode(spk() ? db(calOf('rec.table', 'L0')) : 0, A.bus('music'));
    vol.connect(toAt); vol.connect(toBus);
    const ch = TABLE = { input, kind: 'table', latency: 0, analyser: an,
      setVolume(v, tau) { vol.gain.setTargetAtTime(volLaw(v), now(), tau != null ? tau : 0.08); },
      mode() { const t = now(); toAt.gain.setTargetAtTime(spk() ? 0 : 1, t, 0.05); toBus.gain.setTargetAtTime(spk() ? db(calOf('rec.table', 'L0')) : 0, t, 0.05); },
      dispose() { [input, mono, an, hp, lp, pk, pre, sh, post, sum, dl, dg, vol, toAt, toBus].forEach((x) => { try { x.disconnect(); } catch (e) {} }); if (at) at.release(0.3); } };
    return ch;
  });

  /* =========================================================
   * 9. Preparation · restore · lifecycle (§9.7 · §6.1.8 · ARCH §8.3)
   * ========================================================= */
  A.definePrepare(function prepare3() {
    ['v3_mom_call', 'v3_mom_okay', 'v3_sea_name'].forEach((id) => { try { A.voice(id); } catch (e) {} });   // file:// → null (subtitles)
    // the 33 s render waits for the [시작] tap (introDone — §9.7 '같은 탭 뒤'), so the earphone-test bell never stutters
    if (flag('introDone')) idle(() => { ensureRec(); }, 2500);
    else { let done = false; const go = () => { if (!done) { done = true; idle(() => { ensureRec(); }, 1500); } }; try { G.bus.on('flag:introDone', go); } catch (e) {} setTimeout(go, 45000); }
    if (flag('kang502') && !cbD()) idle(() => renderHumMom(), 5000);
  });
  function cbD() { try { const e = E3(); return !!(e && e.cb && e.cb('D')); } catch (e) { return false; } }
  A.defineRestore(function restore3() {
    if (!flag('M0')) return;
    const lv = (A._au().amb) || {}, hook = flag('HOOK');
    Object.keys(lv).forEach((id) => {
      const l = lv[id]; if (!(l > 0) || !A.hasAmb(id)) return;
      if (hook && id !== 'fridge' && id !== 'clock' && !(id === 'boilerPump' && flag('boilerSting'))) return;
      if (id === 'breath.jimin' && flag('jiminUp')) return;
      if (id === 'breath.kongi' && flag('M6') && !flag('kongiBack')) return;         // at the front door 04:40–05:03 (no sound — §6.1.0-4)
      if (id === 'boilerPump' && !pumpAlive()) return;
      if ((id === 'stove.flame' || id === 'soup.simmer') && !flag('END')) return;
      if (id === 'breath.mom' && (!flag('M8') || flag('END'))) return;
      if (id === 'air' && flag('M7')) return;
      A.amb(id, l, { fade: 0.8, restore: true });
    });
    LIS = null; updListener(0.05);
  });
  /* --- listener changes: every long-lived source moves in 0.8 s; M8 card = LT yaw 270° (엄마 쪽) · hook = L0 yaw 270° --- */
  let LIS = null;
  function updListener(sec) {
    const l = listener(); if (l === LIS) return;
    const prev = LIS; LIS = l;
    if (!A.ctx) return;
    Object.keys(LAY).forEach((id) => relocate(id, sec != null ? sec : 0.8));
    Object.keys(A.ambient).forEach((id) => { const L = A.ambient[id]; if (L && L.relis) L.relis(sec); if (L && L.level > 0 && !LAY[id]) L.apply(sec != null ? sec : 0.8); });
    if (prev && ((l === 'LT' && prev !== 'LT') || (flag('HOOK') && prev === 'LT'))) { try { A.setYaw(270); } catch (e) {} }
    try { G.bus && G.bus.emit && G.bus.emit('audio:listener', { listener: l, prev }); } catch (e) {}
  }
  /* --- the hook (§6.4-①): black 2 s (flow: hush roomDb −90) → fridge + clock only, 1 s fade-in · the sting releases on replays --- */
  let hookTimer = null, hookReleased = false;
  function hookRelease(fade) {
    clearTimeout(hookTimer);
    Object.keys(A.ambient).forEach((id) => { if (id !== 'fridge' && id !== 'clock') { const L = A.ambient[id]; if (L && L.level > 0) A.amb(id, false, { fade: 0.2, force: true }); } });
    HT = 0;
    A.hush(false, { fade: fade != null ? fade : 1.0 });
    ['fridge', 'clock'].forEach((id) => { const L = A.ambient[id]; if (!L || !(L.level > 0)) A.amb(id, true, { fade: fade != null ? fade : 1.0 }); });
    hookReleased = true;
  }
  function onEndStep(step) {
    if (step === 'cred') { HT = -6; Object.keys(A.ambient).forEach((id) => { const L = A.ambient[id]; if (L && L.level > 0) L.apply(2); }); }
    else if (step === 'check') { if (!A._hush) A.hush(true, { roomDb: -90, fade: 2 }); }
  }
  /* --- ducking: 'ear' playback pulls amb/sfx/world −8 dB LP 2 kHz (τ 0.3 s · back 0.6 s after it stops) --- */
  let ducked = false;
  function duck(on) { if (on === ducked) return; ducked = on; A.duck(on, { db: -8, lp: 2000, tau: 0.3, release: 0.6 }); }
  function mediaPlaying() { try { const st = G.media && G.media.state && G.media.state(); return st && st.playing ? st.target : null; } catch (e) { return null; } }
  /* --- iOS: the context must run at the 03:32:40 preroll; if it does not, the set piece goes on screen-first + the resume chip --- */
  function ensureRunning() {
    if (!A.ctx || document.hidden || !A.enabled) return;
    if (A.ctx.state === 'running') return;
    let p; try { p = A.ctx.resume(); } catch (e) { p = null; }
    Promise.race([Promise.resolve(p), new Promise((r) => setTimeout(r, 450))]).then(() => { if (A.ctx && A.ctx.state !== 'running' && !document.hidden && A._chip) A._chip(true); });
  }
  A.ensureRunning = ensureRunning;
  A.onInit(() => {
    const on = (ev, fn) => { try { G.bus && G.bus.on && G.bus.on(ev, fn); } catch (e) {} };
    ['room:where', 'var:where', 'flag:M7', 'flag:M8', 'flag:HOOK', 'state:load'].forEach((ev) => on(ev, () => setTimeout(() => updListener(), 0)));
    on('flag:HOOK', () => { hookReleased = false; clearTimeout(hookTimer); hookTimer = setTimeout(() => { if (!hookReleased) hookRelease(1.0); }, 2000); });
    on('flag:M7', () => { const L = A.ambient.air; if (L) L.apply(8); });
    on('flag:END', () => { const L = A.ambient.apt; if (L) L.apply(3); });
    on('flag:jiminUp', () => { const L = A.ambient['breath.jimin']; if (L && L.level > 0) setTimeout(() => A.amb('breath.jimin', false, { fade: 1.5 }), 1500); });
    on('flag:kang502', () => { if (!cbD()) setTimeout(() => idle(() => renderHumMom(), 3000), 10000); });
    on('flag:M1', () => ensureRunning());
    on('dir:beat', (e) => { if (e && e.id === 'B03') ensureRunning(); });
    on('end:step', (e) => onEndStep(e && (e.step || e.id)));
    on('var:endStep', (e) => onEndStep(e && e.v));
    on('media:play', (e) => { duck(!!(e && e.target === 'ear')); });
    on('media:out', (e) => { duck(!!(e && e.target === 'ear' && mediaPlaying() === 'ear')); });
    on('media:stop', () => { duck(mediaPlaying() === 'ear'); });
    on('settings', () => {
      const L = A.ambient; Object.keys(L).forEach((id) => { if (L[id] && L[id].mode) L[id].mode(); });
      if (L.air) L.air.apply(1.5);
      if (EAR) EAR.mode(); if (TABLE) TABLE.mode();
    });
    on('tick', () => { const L = A.ambient.boilerPump; if (L && L.level > 0 && !pumpAlive() && !flag('HOOK')) A.amb('boilerPump', false, { fade: 8 }); });
    // a new night (처음부터 after the hook): the house falls silent — the cold open layers it again from the 2 s black (§6.2 B01)
    on('state:reset', () => {
      clearTimeout(hookTimer); HT = 0; LIS = null;
      Object.keys(A.ambient).forEach((id) => { const L = A.ambient[id]; if (L && L.level > 0) A.amb(id, false, { fade: 0.3, force: true, restore: true }); });
      if (RING) RING.h.stop(0.05); if (TBUZZ) TBUZZ.stop(); if (SPOONS) SPOONS.stop(); if (LEAK) A.leak(false);
      if (A._hush) A.hush(false, { fade: 0.3 });
    });
  });

  /* =========================================================
   * 10. DEBUG — haru.audio (§6.4-③ checks · §7.1.6 calibration)
   * ========================================================= */
  if (G.DEBUG) {
    const H = (window.haru = window.haru || {}), HA = (H.audio = H.audio || {});
    let MON = null;
    const stereoMeter = (ms) => new Promise((res) => {
      if (!ok()) return res(null);
      const c = A.ctx, sp = c.createChannelSplitter(2), aL = c.createAnalyser(), aR = c.createAnalyser(); aL.fftSize = aR.fftSize = 2048;
      A.out.connect(sp); sp.connect(aL, 0); sp.connect(aR, 1);
      const bL = new Float32Array(2048), bR = new Float32Array(2048); let pk = 0, s = 0, cnt = 0;
      const t0 = performance.now();
      const iv = setInterval(() => {
        aL.getFloatTimeDomainData(bL); aR.getFloatTimeDomainData(bR);
        for (let i = 0; i < 2048; i++) { const a = Math.abs(bL[i]), b = Math.abs(bR[i]); if (a > pk) pk = a; if (b > pk) pk = b; s += Math.max(a * a, b * b); cnt++; }
        if (performance.now() - t0 >= ms) { clearInterval(iv); try { A.out.disconnect(sp); } catch (e) {} res({ peakDb: +toDb(pk).toFixed(1), rmsDb: +toDb(Math.sqrt(s / Math.max(1, cnt))).toFixed(1) }); }
      }, 20);
    });
    Object.assign(HA, {
      listener, place: (s, l) => place(s, l), cal: CAL3, ambCal: AMBCAL, uiCal: UICAL, rec: () => ({ ready: A.recReady(), name: REC.name, info: REC.nameInfo, check: REC.check }),
      recCheck: () => REC.check, vibLog: () => A.vibLog.slice(), meter3: stereoMeter, layers: () => Object.keys(LAY).map((id) => ({ id, key: LAY[id].key, mul: LAY[id].mulNow })),
      /** play cue `id` alone (facing its source) and meter the master after the compressor */
      measure(id, o, ms, src) {
        o = o || {}; const P = pos(o, o.src || src); try { A.setYaw(P.az); } catch (e) {}
        return new Promise((r) => setTimeout(r, 120)).then(() => { const m = stereoMeter(ms || 2500); const h = A.cue(id, o); return m.then((v) => { try { h && h.stop && h.stop(0.02); } catch (e) {} return v; }); });
      },
      measureAmb(id, ms, o) { const R0 = place((o && o.src) || ({ fridge: 'fridge', clock: 'clock', 'breath.jimin': 'sofa', 'breath.kongi': 'kongiSr', boilerPump: 'boiler', wind90: 'veranda', 'stove.flame': 'stove', 'soup.simmer': 'stove', 'breath.mom': 'momSeat' })[id] || 'fridge'); if (R0) A.setYaw(R0.az); A.amb(id, true, { fade: 0.05, restore: true }); return new Promise((r) => setTimeout(r, 1500)).then(() => stereoMeter(ms || 4000)).then((m) => { A.amb(id, false, { fade: 0.05, force: true, restore: true }); return m; }); },
      /** §6.4-③ master monitor: peak ≤ −14 dBFS · no 50 ms RMS rise > +18 dB over the loudest 50 ms of the previous 250 ms */
      monitor(onOff) {
        if (!onOff) { if (MON) { try { MON.node.disconnect(); A.out.disconnect(MON.node); } catch (e) {} MON = null; } return; }
        if (MON || !ok()) return;
        const c = A.ctx, blk = Math.round(c.sampleRate * 0.05), node = c.createScriptProcessor(2048, 2, 1), z = c.createGain(); z.gain.value = 0;
        MON = { node, maxPeak: 0, rises: [], hist: [], acc: 0, n: 0, pk: 0 };
        node.onaudioprocess = (ev) => {
          const L = ev.inputBuffer.getChannelData(0), R = ev.inputBuffer.numberOfChannels > 1 ? ev.inputBuffer.getChannelData(1) : L;
          for (let i = 0; i < L.length; i++) {
            const a = Math.abs(L[i]), b = Math.abs(R[i]), m = a > b ? a : b; if (m > MON.maxPeak) MON.maxPeak = m;
            MON.acc += m * m; MON.n++;
            if (MON.n >= blk) {
              const rdb = toDb(Math.sqrt(MON.acc / MON.n)), prevMax = MON.hist.reduce((x, y) => Math.max(x, y), -60);
              if (rdb - Math.max(prevMax, -60) > 18) MON.rises.push({ pm: pmNow(), db: +(rdb - prevMax).toFixed(1), rms: +rdb.toFixed(1) });
              MON.hist.push(rdb); if (MON.hist.length > 5) MON.hist.shift(); MON.acc = 0; MON.n = 0;
            }
          }
        };
        A.out.connect(node); node.connect(z); z.connect(c.destination);
      },
      levels: () => (MON ? { maxPeakDb: +toDb(MON.maxPeak).toFixed(1), rises: MON.rises.slice(0, 40) } : null),
    });
  }
})();
