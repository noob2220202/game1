/* =========================================================
 * 하루를 위한 방탈출! 2 — Spatial audio + the ep2 cue library (engine/core/spatial.js · owner: audio)
 * World (DESIGN §1.2.4 / §7.1.2): listener in the middle of 601, front door 0°, clockwise —
 *   door 0° · window 90° · bed 180° · desk 270° · water-tank iron door 70° 6 m · stairs/roof light 55° 7 m ·
 *   rail 100–130° 5–6 m · next building 2F speaker 115° −30° 12 m · church 200° +5° far · alley/police 140–250° −40°.
 *
 * Public API (added to G.audio):
 *   at(az, { dist, el, via:'inRoom'|'door'|'doorDirect'|'window'|'wall'|'auto'|{via:w}, ir, wet, life, bus:'world',
 *            fixed, quiet, slap, gain, noFacing }) → input GainNode | null
 *        node.move(az, sec, {dist, el}) · node.path([{dt, az, dist, el, via}]) · node.setDist(d, sec) · node.release(sec) · node.dispose()
 *   setYaw(deg) · getYaw() · facing(az)
 *   amb(id, on|level, { fade, db|gainDb (relative), dbfs (absolute), warm }) — ids roofWind room601 tank cityFar snow drone ('amb.' prefix ok)
 *   tension(T) · droneDetune(cents, sec) · roomLP(hz, ms) · heartbeat(on, { bpm }) · doorOpen(ms|'hold') · doorClose()
 *   gsmTank = { start(p=.08), set(p, rampMs), pulse({peak, upMs, holdMs, downMs, arc}), fadeTo(p, ms), level(), started() }   (70°, fixed)
 *   drill = { start(), wobble() → Promise, hesitate(ms=250), stopC2() → Promise, stopFallback() → Promise, playing(), near() }
 *   box15 = { start() → { stage('closed'|'doorOpen'|'inHand'), cut(), stop() } }
 *   buffer(id) → Promise<AudioBuffer|null>   'rec.uri' 'vid.move' 'vid.roof' 'hook.seahY' 'ringHaru7' + alias 'jiminVM'
 *   jiminVM() → Promise<AudioBuffer|null> · playVoice(id, { az, dist, via, onEnd, gainDb }) → handle
 *   mediaChain('phone'|'bt') → { input, setVolume(v 0–100, tauSec), dispose(), latency, analyser, kind }
 *        (the 0.2 s Bluetooth latency is G.media's DelayNode — the chain adds none; chain.latency = 0)
 *   cue(id, opts) — every §7.2 / ARCH §4.13 cue id (registry at the bottom of this file)
 * Bus events listened (init): media:play · media:vol (speaker-mode arcs) · var:snow · users:switched (drone −100 cent, §6.1.5)
 * Persisted (vars.au): amb levels, warm, GSM {on, p}, tone previews (tones.js).
 *
 * Episode-3 registration options (ARCH_EP3 §4.2 · DESIGN_EP3 §7.1.7 — called by ep3/js/sound3.js at load; ep2 calls none of
 * them, so every table / path below is exactly the ep2 one when they are absent):
 *   defineVia(key, {lp, p1:[f,dB,Q], p2, sh, g, opens, face:[lpBase, lpRange, gBase]}) · defineIR(key, [len, decay, bright, early])
 *        — new keys only (an existing key warns in DEBUG and is ignored)
 *   defineAmb(id, factory(api) → layer, nominalDbfs)   api = { mkLayer, loopSrc, T() }   (new ids only)
 *   TENSION_AMBS (default ['roofWind','drone'])         layers re-applied by tension(T); the drone auto-starts only when listed
 *   defineMediaChain(kind, factory() → chain)           consulted by mediaChain(kind) before 'phone' | 'bt'
 *   defineBuffer(id | 'prefix.*', fn(id) → Promise<AudioBuffer|null>)   consulted by buffer(id) first (the fn owns its cache)
 *   definePrepare(fn) · defineRestore(fn)               replace the ep2 preparation list (+ the flag:END → hook.seahY render and
 *                                                       the GSM restore) / the ep2 restore — ep3 never fetches a v2_* file
 *   HUSH_ROOM (default 'room601')                       the ambience that stays at roomDb under hush
 *   buffer(id) / voice resolve every /^v\d+_/ id through G.AUDIO_FILES (ep2: /^v2_/)
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const A = G && G.audio;
  if (!A) return;
  const db = A.db, clamp = A.clamp, mtof = A.mtof, warn = A.warn;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));
  const now = () => A.ctx.currentTime;
  const ok = () => A.ok();
  const flag = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const gvar = (k) => { try { return G.vars ? G.vars(k) : (G.state && G.state.vars ? G.state.vars[k] : undefined); } catch (e) { return undefined; } };
  const def = (id, fn) => A.defineCue(id, fn);
  let prepFn = null, restoreFn = null;               // ep3 definePrepare / defineRestore (see the bottom of this file)

  /* ---------------- calibration trims (§7.1.6 level targets, measured with haru.audio.meter) ---------------- */
  const CAL = A.CAL = {
    wind: 0.154, room: 0.0203, tank: 0.9, city: 4.95, snow: 0.18, drone: 0.25, gsm: 105, drill: 0.72, step: 5.4, bell: 8.7,
    siren: 18.3, bt: 2.94, phone: 0.56, box: 22.4, boxHand: -8, tts: 0.7, ui: 2.6, boot: 5, hb: 0.09,
    // bt level correction by volume (dB) so 15 % ≈ −46 · 50 % ≈ −34 · 90 % ≈ −26 · 100 % ≈ −24 dBFS RMS facing the window (§7.1.5 보정)
    btCorr: [[0, 19.4], [15, 19.4], [50, 11.9], [90, 8.1], [100, 4.4]],
  };

  /* =========================================================
   * Spatial core
   * ========================================================= */
  let yaw = 0;
  const live = new Set();
  const REF = 0.5;
  const distGain = (d) => REF / Math.max(REF, d || REF);
  const wetDist = (d) => Math.min(4, Math.sqrt(Math.max(1, (d || REF) / REF)));
  const wrap = (a) => ((a % 360) + 360) % 360;
  const rel = (az, fixed) => ((((az - (fixed ? 0 : yaw)) % 360) + 540) % 360) - 180;
  const shortest = (from, to) => from + (((((to - from) % 360) + 540) % 360) - 180);

  const IRDEF = {
    ir601: [0.35, 2.6, 0.5], irRoof: [1.6, 3.2, 0.32, [[31, 0.55], [72, 0.38]]], irSteel: [0.4, 4.2, 0.6],
    irFar: [3.0, 2.2, 0.22], irStair: [2.8, 2.5, 0.3], irCloset: [0.25, 3, 0.3], irSmall: [0.4, 3, 0.42], irVoice: [0.25, 3, 0.45],
  };
  const irCache = new WeakMap();
  function irBuffer(c, key) {
    let m = irCache.get(c); if (!m) { m = {}; irCache.set(c, m); }
    if (!m[key]) { const d = IRDEF[key] || IRDEF.ir601; m[key] = A.makeIR(c, d[0], d[1], d[2], d[3]); }
    return m[key];
  }
  A.irBuffer = irBuffer;
  function convOn(c, key) { const v = c.createConvolver(); v.buffer = irBuffer(c, key); return v; }

  /* transmission filters per path (§7.1.3) — shared per (via, bus): direct + IR wet pass the same node */
  const VIA = {
    inRoom: { lp: 20000, g: 0 },
    door: { lp: 1200, p1: [310, 6, 4], g: -10, opens: true },
    doorVoice: { lp: 2000, p1: [310, 3, 4], g: -6, opens: true },        // voices behind the door (§9.7: LP 2 kHz, 310 Hz weak)
    doorDirect: { lp: 5000, p1: [310, 9, 4], g: 0 },
    window: { lp: 3200, p1: [2100, 2, 6], p2: [3400, 2, 6], sh: -6, g: -7, opens: true },
    wall: { lp: 800, g: -12 },
  };
  const FACE = { inRoom: [700, 3500, 0.35], window: [700, 3500, 0.35], door: [3500, 1500, 0.7], doorVoice: [3500, 1500, 0.7], doorDirect: [3500, 1500, 0.7] };
  /* ep3 registrations — new keys only (ep2 keys stay byte-identical) */
  A.defineVia = function (key, spec) {
    if (!key || !spec) return false;
    if (VIA[key]) { warn('defineVia: "' + key + '" is an existing key — ignored'); return false; }
    VIA[key] = { lp: spec.lp || 20000, p1: spec.p1 || null, p2: spec.p2 || null, sh: spec.sh || 0, g: spec.g || 0, opens: !!spec.opens };
    if (Array.isArray(spec.face)) FACE[key] = spec.face.slice(0, 3);
    return true;
  };
  A.hasVia = (key) => !!VIA[key];
  A.viaGainDb = (key) => (VIA[key] ? VIA[key].g || 0 : 0);
  A.defineIR = function (key, d) {
    if (!key || !Array.isArray(d)) return false;
    if (IRDEF[key]) { warn('defineIR: "' + key + '" is an existing key — ignored'); return false; }
    IRDEF[key] = d.slice();
    return true;
  };
  const chains = {}, wets = {};
  let openness = 0, openTimer = null;
  function viaChain(via, bus) {
    via = VIA[via] ? via : 'inRoom';
    const key = via + '|' + bus;
    if (chains[key]) return chains[key];
    const c = A.ctx, d = VIA[via];
    const input = c.createGain();
    const lp = A.filter('lowpass', d.lp, 0.7);
    const p1 = A.filter('peaking', d.p1 ? d.p1[0] : 1000, d.p1 ? d.p1[2] : 1, d.p1 ? d.p1[1] : 0);
    const p2 = A.filter('peaking', d.p2 ? d.p2[0] : 1000, d.p2 ? d.p2[2] : 1, d.p2 ? d.p2[1] : 0);
    const sh = A.filter('highshelf', 2000, 0.7, d.sh || 0);
    const out = c.createGain(); out.gain.value = db(d.g || 0);
    input.connect(lp); lp.connect(p1); p1.connect(p2); p2.connect(sh); sh.connect(out); out.connect(A.bus(bus));
    const ch = chains[key] = { via, bus, input, lp, p1, p2, sh, out, d };
    applyOpen(ch, 0);
    return ch;
  }
  function applyOpen(ch, tau) {
    const d = ch.d, o = d.opens ? openness : 0, t = now();
    const set = (p, v) => { p.cancelScheduledValues(t); if (tau) p.setTargetAtTime(v, t, tau); else p.setValueAtTime(v, t); };
    set(ch.lp.frequency, d.lp * Math.pow(16000 / d.lp, o));
    set(ch.p1.gain, (d.p1 ? d.p1[1] : 0) * (1 - o));
    set(ch.p2.gain, (d.p2 ? d.p2[1] : 0) * (1 - o));
    set(ch.sh.gain, (d.sh || 0) * (1 - o));
    set(ch.out.gain, db((d.g || 0) * (1 - o)));
  }
  function wetNode(ir, via, bus) {
    via = VIA[via] ? via : 'inRoom';
    const key = ir + '|' + via + '|' + bus;
    if (wets[key]) return wets[key].input;
    const c = A.ctx;
    const conv = convOn(c, ir);
    const boost = c.createGain(); boost.gain.value = ir === 'irRoof' && VIA[via].opens ? 1 + openness : 1;
    conv.connect(boost); boost.connect(viaChain(via, bus).input);
    wets[key] = { input: conv, boost, ir, via };
    return conv;
  }
  /** "문을 여는 순간 바깥이 들어온다" (§7.1.3) — door/window filters lift over 0.4 s, irRoof wet +6 dB */
  A.doorOpen = function (ms) {
    clearTimeout(openTimer);
    setOpen(1);
    if (typeof ms === 'number' && ms > 0) openTimer = setTimeout(() => A.doorClose(), ms);
  };
  A.doorClose = function () { clearTimeout(openTimer); setOpen(0); };
  function setOpen(o) {
    openness = o;
    if (!ok()) return;
    Object.keys(chains).forEach((k) => applyOpen(chains[k], 0.13));
    Object.keys(wets).forEach((k) => { const w = wets[k]; if (w.ir === 'irRoof' && VIA[w.via].opens) w.boost.gain.setTargetAtTime(1 + o, now(), 0.13); });
    const W = A.ambient.roofWind; if (W && W.outside) W.outside(!!o);
  }
  A.isDoorOpen = () => openness > 0;

  function makePanner(e) {
    const c = A.ctx;
    if (A.speakerMode() || !c.createPanner) { e.kind = 'stereo'; e.hrtf = false; return c.createStereoPanner ? c.createStereoPanner() : c.createGain(); }
    const p = c.createPanner();
    const hrtf = !e.noHrtf && !A.lowEnd() && A.stats.hrtf < 10;          // ≤ 10 HRTF panners (§7.1.7)
    p.panningModel = hrtf ? 'HRTF' : 'equalpower';
    p.distanceModel = 'linear'; p.refDistance = 1; p.maxDistance = 10000; p.rolloffFactor = 0;   // distance law is ours (dg)
    e.kind = 'panner'; e.hrtf = hrtf; if (hrtf) A.stats.hrtf++;
    return p;
  }
  function autoVia(az) { const a = wrap(az), dz = Math.min(a, 360 - a), wd = clamp((45 - dz) / 30, 0, 1); return { door: wd, window: 1 - wd }; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function stateAt(e, t) {
    const m = e.motion;
    if (!m) return { az: e.az, dist: e.dist, el: e.el, via: null };
    const k = m.keys, n = k.length;
    if (t <= k[0].t) return k[0];
    if (t >= k[n - 1].t) return k[n - 1];
    for (let i = 0; i < n - 1; i++) {
      if (t < k[i + 1].t) {
        const a = k[i], b = k[i + 1], f = (t - a.t) / Math.max(1e-6, b.t - a.t);
        let via = null;
        if (a.via && b.via) { via = {}; Object.keys(e.dry).forEach((v) => { via[v] = lerp(a.via[v] || 0, b.via[v] || 0, f); }); } else via = a.via || b.via || null;
        return { t, az: lerp(a.az, b.az, f), dist: lerp(a.dist, b.dist, f), el: lerp(a.el, b.el, f), via };
      }
    }
    return k[n - 1];
  }
  function setP(p, v, t, mode) {
    if (!p || !isFinite(v)) return;
    if (mode === 'ramp') p.linearRampToValueAtTime(v, t); else if (mode === 'set') p.setValueAtTime(v, t); else p.setTargetAtTime(v, t, 0.04);
  }
  function apply(e, t, s, mode) {
    const r = (rel(s.az, e.fixed) * Math.PI) / 180, sp = e.kind !== 'panner';
    const elr = ((sp ? 0 : s.el) * Math.PI) / 180, d = Math.max(0.05, s.dist);
    const P = e.panner;
    if (!sp) {
      const x = Math.sin(r) * Math.cos(elr) * d, y = Math.sin(elr) * d, z = -Math.cos(r) * Math.cos(elr) * d;
      if (P.positionX) { setP(P.positionX, x, t, mode); setP(P.positionY, y, t, mode); setP(P.positionZ, z, t, mode); }
      else if (P.setPosition) P.setPosition(x, y, z);
    } else if (P.pan) setP(P.pan, Math.sin(r) * 0.9, t, mode);
    const fac = Math.max(0, Math.cos(r));
    if (e.face) { setP(e.lp.frequency, e.face[0] + e.face[1] * fac, t, mode); setP(e.fg.gain, e.face[2] + (1 - e.face[2]) * fac, t, mode); }
    setP(e.dg.gain, distGain(d) * (e.quiet && A.speakerMode() ? 2 : 1), t, mode);
    const vw = e.auto ? autoVia(s.az) : (s.via || e.viaW);
    Object.keys(e.dry).forEach((v) => {
      const w = vw[v] != null ? vw[v] : 0;
      setP(e.dry[v].gain, w, t, mode);
      if (e.wet[v]) setP(e.wet[v].gain, e.wetLvl * w * wetDist(d), t, mode);
    });
  }
  function eParams(e) {
    const P = e.panner, a = [e.dg.gain, e.lp.frequency, e.fg.gain];
    if (P.positionX) a.push(P.positionX, P.positionY, P.positionZ); else if (P.pan) a.push(P.pan);
    Object.keys(e.dry).forEach((v) => { a.push(e.dry[v].gain); if (e.wet[v]) a.push(e.wet[v].gain); });
    return a;
  }
  const STEP = 0.1;
  function reschedule(e, smooth) {
    if (e.disposed || !A.ctx) return;
    const t = now();
    eParams(e).forEach((p) => { try { p.cancelScheduledValues(t); } catch (er) {} });
    const m = e.motion;
    if (m && m.keys[m.keys.length - 1].t > t) {
      apply(e, t, stateAt(e, t), 'set');
      e.schedUntil = t;
      extend(e, t);
      if (!e.legacy && !e.panner.positionX && e.kind === 'panner') e.legacy = true;
    } else {
      if (m) { const s = m.keys[m.keys.length - 1]; e.az = s.az; e.dist = s.dist; e.el = s.el; if (s.via) e.viaW = s.via; e.motion = null; }
      apply(e, t, { az: e.az, dist: e.dist, el: e.el, via: null }, smooth ? 'target' : 'set');
    }
  }
  function extend(e, t) {
    const m = e.motion; if (!m) return;
    const tEnd = m.keys[m.keys.length - 1].t;
    let tt = e.schedUntil;
    while (tt < Math.min(tEnd, t + 1.0)) { tt = Math.min(tEnd, tt + STEP); apply(e, tt, stateAt(e, tt), 'ramp'); }
    e.schedUntil = tt;
    if (tt >= tEnd) { const s = m.keys[m.keys.length - 1]; e.az = s.az; e.dist = s.dist; e.el = s.el; if (s.via) e.viaW = s.via; e.motion = null; }
  }
  let motionTick = null;
  function ensureMotionTick() {
    if (motionTick) return;
    motionTick = A.every((t) => {
      live.forEach((e) => {
        if (!e.motion || e.disposed) return;
        if (e.legacy) { apply(e, t, stateAt(e, t), 'target'); if (t >= e.motion.keys[e.motion.keys.length - 1].t) e.motion = null; return; }
        if (e.schedUntil < t + 0.5) extend(e, t);
      });
    });
  }
  function dispose(e) {
    if (e.disposed) return; e.disposed = true;
    live.delete(e);
    if (e.hrtf) { A.stats.hrtf = Math.max(0, A.stats.hrtf - 1); e.hrtf = false; }
    [e.input, e.lp, e.fg, e.dg, e.panner, e.slapIn].forEach((n) => { try { n && n.disconnect(); } catch (er) {} });
    Object.keys(e.dry).forEach((v) => { try { e.dry[v].disconnect(); } catch (er) {} if (e.wet[v]) try { e.wet[v].disconnect(); } catch (er) {} });
  }

  A.at = function (az, o) {
    o = o || {};
    if (!ok()) return null;
    const c = A.ctx;
    const e = { az: +az || 0, dist: o.dist != null ? +o.dist : 1.6, el: +o.el || 0, bus: o.bus || 'world', fixed: !!o.fixed,
      quiet: !!o.quiet, noHrtf: !!o.noHrtf, auto: o.via === 'auto', motion: null, disposed: false, dry: {}, wet: {}, schedUntil: 0 };
    let vias;
    if (e.auto) vias = ['door', 'window'];
    else if (o.via && typeof o.via === 'object') vias = Object.keys(o.via).filter((v) => VIA[v]);
    else vias = [VIA[o.via] ? o.via : 'inRoom'];
    if (!vias.length) vias = ['inRoom'];
    e.viaW = {}; vias.forEach((v) => { e.viaW[v] = o.via && typeof o.via === 'object' ? +o.via[v] || 0 : 1; });
    if (e.auto) e.viaW = autoVia(e.az);
    const prim = vias.slice().sort((a, b) => (e.viaW[b] || 0) - (e.viaW[a] || 0))[0];
    e.face = o.noFacing ? null : (o.lpBase != null ? [o.lpBase, o.lpRange != null ? o.lpRange : 3500, o.gBase != null ? o.gBase : 0.35] : FACE[e.auto ? 'window' : prim] || null);
    const input = c.createGain(); input.gain.value = o.gain != null ? o.gain : 1;
    const lp = A.filter('lowpass', 20000, 0.6), fg = c.createGain(), dg = c.createGain();
    input.connect(lp); lp.connect(fg); fg.connect(dg);
    if (o.slap) {                                    // slap180 (§7.1.3): one 180 ms reflection from the building opposite, −10 dB, LP 2 kHz
      const dl = c.createDelay(0.5); dl.delayTime.value = 0.18;
      const sl = A.filter('lowpass', 2000, 0.7), sg = c.createGain(); sg.gain.value = db(-10);
      input.connect(dl); dl.connect(sl); sl.connect(sg); sg.connect(lp); e.slapIn = dl;
    }
    e.panner = makePanner(e); dg.connect(e.panner);
    vias.forEach((v) => { const g = c.createGain(); g.gain.value = e.viaW[v]; e.panner.connect(g); g.connect(viaChain(v, e.bus).input); e.dry[v] = g; });
    e.wetLvl = 0;
    if (o.ir && IRDEF[o.ir] && (o.wet == null || o.wet > 0)) {
      e.wetLvl = o.wet != null ? +o.wet : 0.3;
      vias.forEach((v) => { const g = c.createGain(); g.gain.value = 0; dg.connect(g); g.connect(wetNode(o.ir, v, e.bus)); e.wet[v] = g; });
    }
    Object.assign(e, { input, lp, fg, dg });
    live.add(e);
    reschedule(e, false);
    A.stats.sources++;
    const life = o.life != null ? o.life : 15;
    if (life !== Infinity) setTimeout(() => dispose(e), life * 1000);
    input.entry = e;
    input.move = (az2, sec, o2) => {
      o2 = o2 || {}; if (e.disposed || !A.ctx) return;
      const t = now(), s = stateAt(e, t);
      e.motion = { keys: [{ t, az: s.az, dist: s.dist, el: s.el, via: s.via || null },
        { t: t + Math.max(0.03, sec || 1), az: shortest(s.az, az2 != null ? az2 : s.az), dist: o2.dist != null ? o2.dist : s.dist, el: o2.el != null ? o2.el : s.el, via: o2.via || null }] };
      ensureMotionTick(); reschedule(e);
    };
    input.path = (keys) => {
      if (e.disposed || !A.ctx || !keys || !keys.length) return;
      const t = now(); let prev = null; const s0 = stateAt(e, t);
      e.motion = { keys: keys.map((k) => {
        let a = k.az != null ? k.az : (prev ? prev.az : s0.az); if (prev) a = shortest(prev.az, a);
        const kk = { t: t + (k.dt || 0), az: a, dist: k.dist != null ? k.dist : (prev ? prev.dist : s0.dist), el: k.el != null ? k.el : (prev ? prev.el : s0.el), via: k.via || null };
        prev = kk; return kk; }) };
      ensureMotionTick(); reschedule(e);
    };
    input.setDist = (d, sec) => input.move(null, sec || 0.05, { dist: d });
    input.setAz = (a, sec) => input.move(a, sec || 0.05);
    input.state = () => stateAt(e, now());
    input.release = (sec) => { if (e.disposed) return; sec = sec || 0.2; try { input.gain.setTargetAtTime(0, now(), sec / 3); } catch (er) {} setTimeout(() => dispose(e), sec * 1000 + 300); };
    input.dispose = () => dispose(e);
    return input;
  };
  let yawAt = 0, yawTimer = null;
  function applyYaw() { yawTimer = null; yawAt = performance.now(); if (A.ctx) live.forEach((e) => { if (!e.fixed) reschedule(e, true); }); }
  A.setYaw = function (deg) {                     // room drags call this per pointer move — re-place at most every 30 ms (trailing call kept)
    yaw = wrap(+deg || 0);
    const since = performance.now() - yawAt;
    if (since >= 30) applyYaw(); else if (!yawTimer) yawTimer = setTimeout(applyYaw, 30 - since);
    try { G.bus && G.bus.emit && G.bus.emit('yaw', yaw); } catch (er) {}
  };
  A.getYaw = () => yaw;
  A.facing = (az) => Math.cos((rel(az) * Math.PI) / 180);
  function arc(az, ms) { if (!A.speakerMode()) return; try { G.fx && G.fx.dirArc && G.fx.dirArc(az, ms || 1200); } catch (er) {} }
  A.arc = arc;

  /* speaker ↔ earphone switch at runtime: swap every live panner (and the speaker-mode tank harmonics) */
  A._onModeChange = function () {
    if (!A.ctx) return;
    live.forEach((e) => {
      if (e.disposed) return;
      const old = e.panner;
      if (e.hrtf) { A.stats.hrtf = Math.max(0, A.stats.hrtf - 1); e.hrtf = false; }
      const np = makePanner(e);
      try { e.dg.disconnect(e.panner); } catch (er) { try { e.dg.disconnect(); } catch (er2) {} Object.keys(e.wet).forEach((v) => e.dg.connect(e.wet[v])); }
      try { old.disconnect(); } catch (er) {}
      e.dg.connect(np); Object.keys(e.dry).forEach((v) => np.connect(e.dry[v]));
      e.panner = np; e.legacy = false;
      reschedule(e, false);
    });
    if (A.ambient.tank && A.ambient.tank.level > 0) { const lv = A.ambient.tank.level; A.ambient.tank.kill(); delete A.ambient.tank; A.amb('tank', lv, { fade: 0.6 }); }
  };

  /* =========================================================
   * Ambience (§7.2 A) — layers live on the amb bus, levels = base · level · tension · hush
   * ========================================================= */
  const AMB = {};
  let T = 0.15;
  function mkLayer(o) {
    const g = A.ctx.createGain(); g.gain.value = 0; g.connect(o.out || A.bus('amb'));
    const L = Object.assign({ g, level: 0, base: 1, hushMul: null, tmul: () => 1, kills: [], nodes: [] }, o);
    L.apply = (fade) => {
      const v = L.base * L.level * L.tmul() * (L.hushMul != null ? L.hushMul : 1);
      const t = now(); L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(v, t, Math.max(0.01, (fade != null ? fade : 1.5) / 3));
    };
    L.kill = () => { L.kills.forEach((f) => { try { f(); } catch (er) {} }); L.nodes.forEach((n) => { try { n.stop ? n.stop() : n.disconnect(); } catch (er) {} }); try { L.g.disconnect(); } catch (er) {} if (L.at) L.at.dispose(); };
    return L;
  }
  function loopSrc(buf, out) { const s = A.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(out); s.start(now(), Math.random() * 2); return s; }

  AMB.roofWind = () => {
    const c = A.ctx;
    const L = mkLayer({ base: CAL.wind, tmul: () => 0.55 + 0.35 * T });
    const src = c.createBufferSource(); src.buffer = A._pink; src.loop = true;
    const sp = c.createChannelSplitter(2); src.connect(sp);
    const pl = c.createStereoPanner(), pr = c.createStereoPanner(); pl.pan.value = -0.6; pr.pan.value = 0.6;
    sp.connect(pl, 0); sp.connect(pr, 1);
    const hp = A.filter('highpass', 180, 0.7), lp = A.filter('lowpass', 700, 0.7);
    pl.connect(hp); pr.connect(hp); hp.connect(lp);
    const mod = c.createGain(); mod.gain.value = 1; lp.connect(mod);
    const outG = c.createGain(); outG.gain.value = 1; mod.connect(outG); outG.connect(L.g);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(mod.gain);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.013; const lg2 = c.createGain(); lg2.gain.value = 0.12; lfo2.connect(lg2); lg2.connect(mod.gain);
    // rail whistle component (outside version only)
    const wbp = A.filter('bandpass', 1400, 8), wg = c.createGain(); wg.gain.value = 0; sp.connect(wbp, 0); wbp.connect(wg); wg.connect(outG);
    // gust branch
    const gsrc = c.createBufferSource(); gsrc.buffer = A._pink; gsrc.loop = true;
    const gbp = A.filter('bandpass', 300, 0.9), gg = c.createGain(); gg.gain.value = 0;
    gsrc.connect(gbp); gbp.connect(gg); gg.connect(L.g);
    src.start(now(), Math.random() * 3); gsrc.start(now(), Math.random() * 3); lfo.start(); lfo2.start();
    L.nodes.push(src, gsrc, lfo, lfo2);
    let outside = false, snow = 0;
    const filt = (tau) => {
      const t = now(), sm = snow >= 2 ? 0.9 : 1;
      hp.frequency.setTargetAtTime(outside ? 120 : 180, t, tau); lp.frequency.setTargetAtTime((outside ? 3000 : 700) * sm, t, tau);
      outG.gain.setTargetAtTime(outside ? db(9) : 1, t, tau); wg.gain.setTargetAtTime(outside ? db(-30) * 3 : 0, t, tau);
    };
    L.outside = (on) => { outside = !!on; filt(0.13); };
    L.setSnow = (s) => { snow = s || 0; filt(2); };
    L.setSnow(gvar('snow') || 0);
    // gusts every 18–45 s: 2 s HP sweep 300 → 1200 Hz, +6 dB, glass ticks at the window (90°)
    L.gust = (strong) => {
      if (!ok()) return; const t = now() + 0.02;
      gbp.frequency.cancelScheduledValues(t); gbp.frequency.setValueAtTime(300, t); gbp.frequency.exponentialRampToValueAtTime(1200, t + 2);
      gg.gain.cancelScheduledValues(t); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(strong ? 1.4 : 1.0, t + 0.7); gg.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      const win = A.at(90, { dist: 1.5, via: 'inRoom', bus: 'amb', life: 4, quiet: true });
      if (win) { for (let i = 0, n = rndi(3, 6); i < n; i++) { const tt = t + rnd(0.4, 1.8); A.noise(tt, 0.004, rnd(0.08, 0.2), win, { filters: [{ type: 'bandpass', freq: Math.random() < 0.5 ? 2100 : 3400, Q: 9 }] }); } }
    };
    let nextGust = now() + rnd(18, 45);
    L.kills.push(A.every((t) => { if (L.level > 0 && t >= nextGust) { L.gust(false); nextGust = t + rnd(18, 45); } }));
    if (openness > 0) L.outside(true);
    return L;
  };
  AMB.room601 = () => {
    const L = mkLayer({ base: CAL.room });
    const lp = A.filter('lowpass', 240, 0.6), wg = A.ctx.createGain(); wg.gain.value = 1;
    loopSrc(A._brown, lp); lp.connect(wg); wg.connect(L.g);
    L.nodes.push(lp);
    L.warm = (on) => { const t = now(); lp.frequency.setTargetAtTime(on ? 320 : 240, t, 1.2); wg.gain.setTargetAtTime(on ? db(2) : 1, t, 1.2); };
    return L;
  };
  AMB.tank = () => {
    const c = A.ctx, spk = A.speakerMode();
    const at = A.at(70, { dist: 6, via: 'window', bus: 'amb', life: Infinity, quiet: true, noHrtf: (navigator.hardwareConcurrency || 8) <= 4 });
    const L = mkLayer({ base: CAL.tank * (spk ? 0.6 : 1), out: at || A.bus('amb') }); L.at = at;
    const am = c.createGain(); am.gain.value = 0.85; am.connect(L.g);
    const amo = c.createOscillator(); amo.frequency.value = 3; const amg = c.createGain(); amg.gain.value = 0.15; amo.connect(amg); amg.connect(am.gain); amo.start();
    const fr = spk ? [[114, 0], [152, -6], [228, -14]] : [[38, 0], [76, -6], [114, -14]];   // speaker: 38/76 → 114/152 Hz (§7.1.7)
    fr.forEach(([f, g]) => { const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = db(g) * 0.5; o.connect(og); og.connect(am); o.start(); L.nodes.push(o); });
    L.nodes.push(amo);
    let next = now() + rnd(7, 19);
    L.kills.push(A.every((t) => { if (L.level > 0 && t >= next) { const f = rnd(1200, 2400); A.osc('sine', f, t + 0.02, 0.06, db(-8) * 0.5, L.g, { a: 0.001, decay: true }); next = t + rnd(7, 19); } }));
    return L;
  };
  AMB.cityFar = () => {
    const c = A.ctx;
    const at = A.at(200, { el: -40, dist: 40, via: 'wall', bus: 'amb', life: Infinity, noFacing: true });
    const L = mkLayer({ base: CAL.city, out: at || A.bus('amb') }); L.at = at;
    const lp = A.filter('lowpass', 250, 0.6), sw = c.createGain(); sw.gain.value = 1;
    loopSrc(A._brown, lp); lp.connect(sw); sw.connect(L.g);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.03; const lg = c.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(sw.gain); lfo.start();
    L.nodes.push(lfo);
    return L;
  };
  AMB.snow = () => {
    const at = A.at(90, { dist: 1.5, via: 'inRoom', bus: 'amb', life: Infinity, quiet: true, lpBase: 6000, lpRange: 6000, gBase: 0.35 });
    const L = mkLayer({ base: CAL.snow, out: at || A.bus('amb') }); L.at = at;
    let next = now() + 0.1;
    L.kills.push(A.every((t) => {
      if (L.level <= 0) { next = t + 0.2; return; }
      const dens = (gvar('snow') || 1) >= 2 ? 1.5 : 1;
      while (next < t + 0.2) { A.noise(next, rnd(0.001, 0.003), rnd(0.2, 1) * 0.5, L.g, { filters: [{ type: 'highpass', freq: 4000, Q: 0.7 }] }); next += 1 / (rnd(5, 12) * dens); }
    }));
    return L;
  };
  AMB.drone = () => {
    const c = A.ctx;
    const L = mkLayer({ base: CAL.drone, tmul: () => 0.15 + 0.85 * T });
    const lp = A.filter('lowpass', 160 + 900 * T, 4);
    L.oscs = [];
    [36.7, 36.9, 55.2, 73.4, 77.8].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = A._droneCents || 0;
      const og = c.createGain(); og.gain.value = i < 2 ? 0.06 : 0.035; o.connect(og); og.connect(lp); o.start(); L.nodes.push(o); L.oscs.push(o);
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); L.nodes.push(lfo);
    lp.connect(L.g);
    const s = c.createGain(); s.gain.value = 0.25; L.g.connect(s); s.connect(A.reverb);
    L.lp = lp;
    return L;
  };
  const AMB_NOMINAL = { roofWind: -36, room601: -50, tank: -46, cityFar: -52, snow: -58, drone: -42 };   // dBFS at level 1 (§7.1.6, T = .5)
  /* ep3 registration: defineAmb(id, factory(api) → layer, nominalDbfs) — new ids only */
  A.defineAmb = function (id, factory, nominal) {
    id = String(id || '').replace(/^amb\./, '');
    if (!id || typeof factory !== 'function') return false;
    if (AMB[id]) { warn('defineAmb: "' + id + '" is an existing id — ignored'); return false; }
    AMB[id] = () => factory({ mkLayer, loopSrc, T: () => T });
    AMB_NOMINAL[id] = nominal != null ? +nominal : -50;
    return true;
  };
  A.hasAmb = (id) => !!AMB[String(id || '').replace(/^amb\./, '')];
  A.ambNominal = (id) => AMB_NOMINAL[String(id || '').replace(/^amb\./, '')];
  A.TENSION_AMBS = ['roofWind', 'drone'];           // ep3 sets ['air'] (the drone then never auto-starts — §6.1.1 · G17)
  A.HUSH_ROOM = 'room601';                          // ep3 sets its room tone ('apt')
  const hushRid = () => (A.HUSH_ROOM && AMB[A.HUSH_ROOM] ? A.HUSH_ROOM : 'room601');
  A.amb = function (id, on, o) {
    o = o || {};
    id = String(id || '').replace(/^amb\./, '');
    if (!AMB[id]) { warn('amb: unknown id', id); return; }
    // level: on (bool | linear multiple of the nominal) × gainDb/db (relative dB). dbfs (absolute) — and, defensively, a gainDb
    // below −40 (no sane relative ambience gain) — are read as an absolute dBFS target against the layer's nominal level.
    const rdb = o.db != null ? o.db : o.gainDb;
    const abs = o.dbfs != null ? o.dbfs : (rdb != null && rdb < -40 ? rdb : null);
    const lvl = on === false || on === 0 ? 0 : (typeof on === 'number' ? on : 1) * (abs != null ? db(abs - (AMB_NOMINAL[id] || -50)) : rdb != null ? db(rdb) : 1);
    const a = A._au(); a.amb = a.amb || {}; a.amb[id] = lvl; if (id === 'room601' && o.warm != null) a.warm = !!o.warm;
    if (!o.restore) A._saveSoon();
    if (!ok()) return;
    let L = A.ambient[id];
    if (lvl > 0 && !L) { try { L = A.ambient[id] = AMB[id](); } catch (er) { console.error('[audio] amb ' + id, er); return; } if (id === 'room601' && a.warm) L.warm(true); }
    if (!L) return;
    L.level = lvl;
    if (o.lpScale != null && L.setSnow) L.setSnow(o.lpScale < 1 ? 2 : 0);
    if (A._hush) L.hushMul = id === hushRid() ? hushRoom : 0;
    L.apply(o.fade != null ? o.fade : 1.5);
    if (id === 'room601' && o.warm != null && L.warm) L.warm(!!o.warm);
  };
  A.tension = function (x) {
    T = clamp(+x || 0, 0, 1);
    if (!ok()) return;
    const a = A._au(), list = Array.isArray(A.TENSION_AMBS) ? A.TENSION_AMBS : ['roofWind', 'drone'];
    if (list.indexOf('drone') >= 0 && !A.ambient.drone && !(a.amb && a.amb.drone === 0) && flag('M1') && !flag('M8')) A.amb('drone', true, { fade: 3 });
    list.forEach((k) => { const L = A.ambient[k]; if (L && L.level > 0) L.apply(3); });
    const D = A.ambient.drone; if (D && D.lp) D.lp.frequency.setTargetAtTime(160 + 900 * T, now(), 1.5);
  };
  A.getTension = () => T;
  A.droneDetune = function (cents, sec) {
    A._droneCents = +cents || 0;
    const D = A.ambient.drone; if (!D || !ok()) return;
    const t = now(); D.oscs.forEach((o) => { o.detune.cancelScheduledValues(t); o.detune.setValueAtTime(o.detune.value, t); o.detune.linearRampToValueAtTime(A._droneCents, t + Math.max(0.05, sec || 2)); });
  };
  let roomLPTimer = null;
  A.roomLP = function (hz, ms) {
    if (!ok()) return; clearTimeout(roomLPTimer);
    const f = A.ambRoomLP.frequency, t = now();
    f.cancelScheduledValues(t); f.setTargetAtTime(hz || 20000, t, 0.3);
    if (hz && ms) roomLPTimer = setTimeout(() => { if (ok()) A.ambRoomLP.frequency.setTargetAtTime(20000, now(), 1.5); }, ms);
  };
  let hushRoom = db(-2);
  A._hushAmb = function (on, roomDb, fade) {
    const rid = hushRid(), nom = AMB_NOMINAL[rid] != null ? AMB_NOMINAL[rid] : -50;
    hushRoom = db((roomDb != null ? roomDb : -52) - nom);   // room601 nominal −50 dBFS → −52 (ep2) · ep3 roomDb −90 ⇒ ≈ 0
    if (on && !A.ambient[rid] && hushRoom > db(-30)) A.amb(rid, 1, { fade: 0.1, restore: true });
    Object.keys(A.ambient).forEach((id) => { const L = A.ambient[id]; L.hushMul = on ? (id === rid ? hushRoom : 0) : null; L.apply(fade != null ? fade : on ? 0.15 : 1.5); });
  };

  /* ---------------- heartbeat bed (§6.1.5; speaker mode → vignette pulse) ---------------- */
  let HB = null;
  A.heartbeat = function (on, o) {
    o = o || {};
    if (!on) { if (HB) { HB.off(); HB = null; } return; }
    if (A.less() || !ok()) return;
    if (HB) { if (o.bpm) HB.bpm = o.bpm; return; }
    HB = { bpm: o.bpm || null, next: now() + 0.1 };
    HB.off = A.every((t) => {
      while (HB && HB.next < t + 0.2) {
        const tb = HB.next;
        if (A.speakerMode()) pulseVig(tb - t);
        else [[0, 60, 0.75], [0.16, 52, 0.55]].forEach(([dt, f, g]) => A.osc('sine', f, tb + dt, 0.25, g * CAL.hb, A.bus('sfx'), { a: 0.004, decay: true, to: 32, glide: 0.2 }));
        HB.next += 60 / ((HB.bpm || 72) + (drill.near() ? 12 : 0));   // 72 → 84 bpm while the drill is at 0.6 m
      }
    });
  };
  function pulseVig(delay) {
    setTimeout(() => {
      try {
        const sc = document.getElementById('screen'); if (!sc || !G.fx || !G.fx.setVignette) return;
        const cur = parseFloat(getComputedStyle(sc).getPropertyValue('--vig')) || 0.6;
        G.fx.setVignette(Math.min(1, cur + 0.1)); setTimeout(() => G.fx.setVignette(cur), 180);
      } catch (er) {}
    }, Math.max(0, delay * 1000));
  }

  /* =========================================================
   * GSM buzz — 70° · 6 m · via window, never moves (§7.1.4)
   * ========================================================= */
  const GSM = { node: null, base: 0, started: false };
  const gsmLin = (p) => (p > 0 ? db(-40 + 26 * Math.min(1, p)) * CAL.gsm : 0);
  function gsmPersist() { const a = A._au(); a.gsm = { on: GSM.started, p: GSM.base }; A._saveSoon(); }
  function gsmBuild() {
    if (GSM.node || !ok()) return;
    const c = A.ctx, osc = c.createOscillator();
    const N = 40, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.125);
    osc.setPeriodicWave(c.createPeriodicWave(re, im)); osc.frequency.value = 217;
    const hp = A.filter('highpass', 250, 0.7), pk = A.filter('peaking', 2000, 1, 6);
    const gate = c.createGain(); gate.gain.value = 0; const lvl = c.createGain(); lvl.gain.value = 0;
    const out = A.at(70, { dist: 6, via: 'window', ir: 'irRoof', wet: 0.35, bus: 'world', life: Infinity, quiet: true });
    osc.connect(hp); hp.connect(pk); pk.connect(gate); gate.connect(lvl); lvl.connect(out || A.bus('world'));
    osc.start();
    let next = now() + 0.05;
    const on = (t0, t1) => { gate.gain.setValueAtTime(0, t0); gate.gain.linearRampToValueAtTime(1, t0 + 0.002); gate.gain.setValueAtTime(1, t1); gate.gain.linearRampToValueAtTime(0, t1 + 0.002); };
    const off = A.every((t) => {
      while (next < t + 0.25) {
        const st = next;
        if (Math.random() < 0.15) { for (let k = 0; k < 6; k++) on(st + k * 0.125, st + k * 0.125 + 0.06); next = st + 0.75 + rnd(0.08, 0.9); }   // 8 Hz stutter
        else { const b = rnd(0.06, 0.35); on(st, st + b); next = st + b + rnd(0.08, 0.9); }
      }
    });
    GSM.node = { osc, gate, lvl, out, off };
    A.stats.sources++;
  }
  function gsmKill() { const n = GSM.node; if (!n) return; GSM.node = null; n.off(); try { n.osc.stop(); } catch (er) {} if (n.out) n.out.release(0.2); }
  function gsmRamp(p, ms) {
    if (!GSM.node) return;
    const g = GSM.node.lvl.gain, t = now();
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(gsmLin(p), t + Math.max(0.02, (ms || 400) / 1000));
  }
  const gsmTank = A.gsmTank = {
    start(p) {
      p = p == null ? 0.08 : +p;
      if (GSM.started && GSM.node) return;
      if (!GSM.started) GSM.base = p;
      GSM.started = true; gsmPersist();
      if (!ok() || GSM.base <= 0) return;
      gsmBuild(); gsmRamp(GSM.base, 1200);
    },
    set(p, rampMs) {
      p = Math.max(0, +p || 0); const up = p > GSM.base;
      GSM.base = p; GSM.started = true; gsmPersist();
      if (!ok()) return;
      if (!GSM.node && p > 0) gsmBuild();
      gsmRamp(p, rampMs != null ? rampMs : 400);
      if (up && p >= 0.15) arc(70);
    },
    pulse(o) {
      o = o || {};
      const peak = o.peak != null ? o.peak : 0.22, up = (o.upMs != null ? o.upMs : 300) / 1000, hold = (o.holdMs != null ? o.holdMs : 1200) / 1000, down = (o.downMs != null ? o.downMs : 600) / 1000;
      if (!GSM.started) { GSM.started = true; GSM.base = 0.08; gsmPersist(); }      // B09′ rule: settles at .08 after the pulse
      if (!ok()) return;
      if (!GSM.node) gsmBuild();
      const g = GSM.node.lvl.gain, t = now();
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(gsmLin(peak), t + up); g.setValueAtTime(gsmLin(peak), t + up + hold); g.linearRampToValueAtTime(gsmLin(GSM.base), t + up + hold + down);
      if (o.arc !== false && peak >= 0.15) arc(70);
    },
    fadeTo(p, ms) {
      gsmTank.set(p, ms);
      if (!(p > 0)) setTimeout(() => { if (!(GSM.base > 0)) gsmKill(); }, (ms || 400) + 300);
    },
    level() { return GSM.base; },
    started() { const a = A._au(); return GSM.started || !!(a.gsm && a.gsm.on); },
  };
  A.gsm = function (p) { gsmTank.set(p); };
  def('gsm', (o) => { gsmTank.set(o.p != null ? o.p : 0.08, o.rampMs); });

  /* =========================================================
   * Ep2 one-shot recipes (§7.2 B–G)
   * ========================================================= */
  const surfBySnow = () => { const s = gvar('snow') || 0; return s >= 2 ? 'deep' : s >= 1 ? 'snowy' : 'dry'; };
  /** one footstep on roof gravel (§7.2 B) — works on any context (also used inside vid.move) */
  function stepAt(c, out, t, o) {
    const g = o.g || 1, surf = o.surface || 'dry';
    A.oscC(c, 'sine', 85, t, 0.05, 0.55 * g, out, { a: 0.002, decay: true, to: 55, glide: 0.03 });
    A.noiseC(c, t, 0.025, 0.35 * g, out, { filters: [{ type: 'lowpass', freq: 400 }] });
    if (o.heavy) A.oscC(c, 'sine', 70, t, 0.07, 0.7 * g, out, { a: 0.002, decay: true, to: 48, glide: 0.05 });
    let tt = t + 0.004;
    for (let i = 0, n = surf === 'deep' ? rndi(2, 3) : rndi(4, 6); i < n; i++) { A.noiseC(c, tt, rnd(0.003, 0.008), rnd(0.3, 1) * 0.32 * g, out, { filters: [{ type: 'bandpass', freq: rnd(2000, 6000), Q: 1.4 }] }); tt += rnd(0.006, 0.02); }
    const toe = t + rnd(0.08, 0.14);
    for (let i = 0, n = surf === 'deep' ? 1 : rndi(2, 3); i < n; i++) A.noiseC(c, toe + i * rnd(0.008, 0.02), rnd(0.003, 0.007), rnd(0.25, 0.7) * 0.25 * g, out, { filters: [{ type: 'bandpass', freq: rnd(2000, 6000), Q: 1.4 }] });
    if (surf !== 'dry') {                         // 뽀득 — BP 120–400 Hz noise with 35–60 Hz AM
      const dur = surf === 'deep' ? 0.14 : 0.09, amg = c.createGain(); amg.gain.value = 0.5; amg.connect(out);
      const am = c.createOscillator(); am.frequency.value = rnd(35, 60); const amd = c.createGain(); amd.gain.value = 0.5; am.connect(amd); amd.connect(amg.gain);
      am.start(t); am.stop(t + dur + 0.1);
      A.noiseC(c, t + 0.01, dur, 0.9 * g, amg, { a: 0.012, filters: [{ type: 'bandpass', freq: rnd(120, 400), Q: 1.2 }] });
    }
  }
  /** a walk: n steps along from → (path) → to; `via:'auto'` crossfades door ↔ window by azimuth */
  function walk(o) {
    o = o || {};
    const surf = o.surface || surfBySnow();
    const n = Math.max(1, o.n || 7);
    const gap = o.gap || (o.dur ? o.dur / n : rnd(0.55, 0.7));
    const from = o.from || (o.path && o.path[0]) || { az: 0, dist: 1 };
    const to = o.to || (o.path && o.path[o.path.length - 1]) || from;
    const span = Math.max(0.05, (n - 1) * gap);
    const src = A.at(from.az, { dist: from.dist != null ? from.dist : 6, el: o.el || 0, via: o.via || 'auto', ir: 'irRoof', wet: 0.3, bus: 'world', life: span + 4 + (o.delay || 0), quiet: true });
    if (!src) return undefined;
    const pts = o.path && o.path.length > 1 ? o.path : [from, to];
    const moving = pts.some((p) => p.az !== from.az || (p.dist != null && p.dist !== from.dist));
    if (moving) src.path(pts.map((p, i) => ({ dt: (o.delay || 0) + (span * i) / (pts.length - 1), az: p.az, dist: p.dist != null ? p.dist : from.dist })));
    const lpF = { dry: 20000, snowy: 1800, deep: 1100 }[surf] || 20000, lvl = { dry: 0, snowy: -7, deep: -11 }[surf] || 0;
    const lp = A.filter('lowpass', lpF, 0.7), out = A.gainNode(db(lvl + (o.gainDb || 0)) * CAL.step, src); lp.connect(out);
    let t = now() + 0.05 + (o.delay || 0);
    for (let i = 0; i < n; i++) { stepAt(A.ctx, lp, t, { surface: surf, g: rnd(0.85, 1.15), heavy: o.heavy }); t += gap * rnd(0.9, 1.1); }
    if (moving) setTimeout(() => arc(from.az), (o.delay || 0) * 1000);
    return { src, dur: span, stop() { src.release(0.1); } };
  }
  def('gravel.step', (o) => walk(o));
  def('boots.snow', (o) => {                       // police boots: deep + heavy heel; B16 two people 0.27 s apart, B20 one, slow
    const people = o.people || (o.slow ? 1 : 2), n = o.n || 8, gap = o.gap || (o.dur ? o.dur / n : o.slow ? 0.8 : 0.6);
    const base = { surface: 'deep', heavy: true, n, gap, from: o.from || { az: 55, dist: 7 }, to: o.to || { az: 70, dist: 6 }, gainDb: (o.gainDb || 0) + 5, path: o.path };
    const hs = [];
    for (let i = 0; i < people; i++) hs.push(walk(Object.assign({}, base, { delay: i * 0.27, gainDb: base.gainDb - i * 1.5 })));
    return { stop() { hs.forEach((h) => h && h.stop()); }, dur: (n - 1) * gap };
  });
  def('cloth.rustle', (o) => {
    const src = A.at(0, { dist: o.dist || 1.0, via: 'door', ir: 'irRoof', wet: 0.15, bus: 'world', life: 3, quiet: true }); if (!src) return;
    const t = now() + 0.02, g = 0.5 * db(o.gainDb || 0);
    A.noise(t, 0.12, g, src, { a: 0.03, filters: [{ type: 'bandpass', freq: 1500, to: 4000, Q: 1.1 }] });
    A.noise(t + 0.18, 0.09, g * 0.8, src, { a: 0.025, filters: [{ type: 'bandpass', freq: 1700, to: 3800, Q: 1.1 }] });
  });
  def('switch.click', (o) => {
    const az = o.az != null ? o.az : 55, dist = o.dist != null ? o.dist : 7, near = dist <= 1.5;
    const src = A.at(az, { dist, via: near ? 'inRoom' : 'window', ir: near ? null : 'irRoof', wet: 0.3, bus: near ? 'sfx' : 'world', life: 3, quiet: !near }); if (!src) return;
    const t = now() + 0.02, g = (near ? 0.3 : 3.5) * db(o.gainDb || 0);
    A.noise(t, 0.002, g, src, { filters: [{ type: 'bandpass', freq: 3500, Q: 2 }] });
    A.osc('sine', 1200, t, 0.015, g * 0.35, src, { a: 0.001, decay: true });
  });
  def('rail.creak', (o) => {
    const c = A.ctx, src = A.at(115, { dist: 6, via: 'window', ir: 'irRoof', wet: 0.35, bus: 'world', life: 4, quiet: true }); if (!src) return;
    const t = now() + 0.02, g = 7 * db(o.gainDb || 0);
    const os = c.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(400, t);
    for (let i = 1; i < 16; i++) os.frequency.setValueAtTime(rnd(300, 500), t + (0.4 * i) / 16);
    const eg = c.createGain(); eg.gain.setValueAtTime(0.0001, t); eg.gain.linearRampToValueAtTime(g * 0.25, t + 0.06); eg.gain.setValueAtTime(g * 0.22, t + 0.34); eg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    [[900, 8], [2300, 9]].forEach(([f, q]) => { const b = A.filter('bandpass', f, q); os.connect(b); b.connect(eg); });
    eg.connect(src); os.start(t); os.stop(t + 0.5);
    A.osc('sine', 2300, t + 0.38, 1.2, g * 0.05, src, { a: 0.001, decay: true });
  });
  def('door.far', (o) => {
    const src = A.at(115, { dist: 14, el: -10, via: 'window', ir: 'irRoof', wet: 0.5, bus: 'world', life: 4, quiet: true, lpBase: 700, lpRange: 800 }); if (!src) return;
    const t = now() + 0.02, g = 5 * db(o.gainDb || 0);
    A.osc('sine', 120, t, 0.22, g * 0.6, src, { a: 0.002, decay: true, to: 80, glide: 0.2 });
    A.noise(t, 0.06, g * 0.35, src, { filters: [{ type: 'bandpass', freq: 600, Q: 1.4 }] });
    [0.05, 0.11, 0.19].forEach((dt) => A.noise(t + dt, 0.004, g * 0.25, src, { filters: [{ type: 'bandpass', freq: 1800, Q: 5 }] }));
  });
  /* one bell, one pitch — no melody (§7.2 B). f0 196 Hz; partials ratio·gain·decay */
  const BELL = [[0.5, 0.6, 7], [1, 1, 5], [1.19, 0.5, 3.5], [1.5, 0.35, 2.5], [2, 0.7, 2.6], [3, 0.25, 1.2], [4, 0.15, 0.8]];
  def('church.bell', (o) => {
    const n = Math.max(1, o.n || 1), gap = o.gap || 3.2;
    const src = A.at(200, { dist: 40, el: 5, via: 'wall', ir: 'irFar', wet: 0.6, bus: 'world', life: n * gap + 9, noFacing: true }); if (!src) return;
    const lp = A.filter('lowpass', 1500, 0.7), g0 = A.gainNode(CAL.bell * db(o.gainDb || 0), src); lp.connect(g0);
    let t = now() + 0.05;
    for (let i = 0; i < n; i++) {
      BELL.forEach(([r, g, d]) => A.osc('sine', 196 * r * (1 + rnd(-0.0006, 0.0006)), t, d, g * 0.22, lp, { a: 0.003, decay: true }));
      A.noise(t, 0.006, 0.3, lp, { filters: [{ type: 'bandpass', freq: 2000, Q: 1.5 }] });
      t += gap + rnd(-0.04, 0.04);
    }
    return { stop() { src.release(0.6); } };
  });
  def('steps.stairs', (o) => {                     // 02:12 sneakers up the stairwell two steps at a time (W07)
    const src = A.at(55, { dist: 12, el: -20, via: 'window', ir: 'irStair', wet: 0.6, bus: 'world', life: 10, quiet: true }); if (!src) return;
    src.path([{ dt: 0, az: 55, dist: 12, el: -20 }, { dt: 6, az: 55, dist: 5, el: -5 }]);
    let t = now() + 0.05; const end = t + 6, g = 3 * db(o.gainDb || 0);
    while (t < end) {
      [0, rnd(0.09, 0.13)].forEach((dt) => { A.noise(t + dt, 0.008, g * 0.5, src, { filters: [{ type: 'bandpass', freq: 1500, Q: 1.2 }] }); A.osc('sine', 120, t + dt, 0.06, g * 0.5, src, { a: 0.002, decay: true, to: 70, glide: 0.05 }); });
      t += 0.32 * rnd(0.85, 1.2);
    }
  });
  def('radio.squelch', (o) => {                    // police radio, no speech (§7.2 F) — 70°, 6 m
    const src = A.at(70, { dist: 6, via: 'window', ir: 'irRoof', wet: 0.3, bus: 'world', life: 3, quiet: true }); if (!src) return;
    const t = now() + 0.02, g = 1.6 * db(o.gainDb || 0), d = rnd(0.12, 0.2);
    A.noise(t, d, g, src, { a: 0.004, flat: true, r: 0.02, filters: [{ type: 'bandpass', freq: 2200, Q: 2.2 }] });
    if (o.beep || Math.random() < 0.35) A.osc('sine', 1000, t + d + 0.06, 0.08, g * 0.18, src, { a: 0.003, r: 0.01 });
  });
  /* Korean patrol car (§7.2 F): wail 650↔1300 Hz / 1.2 s, yelp (0.28 s) from 8 s before arrival,
     230° → 140°, −20° → −40°, 300 → 25 m (28 s), Doppler +2 % → 0, air LP 400 → 3.5 kHz, wall → window at 150° (0.8 s),
     8 s parked, 4 s off (1.2 kHz → 300 Hz). mode 'fadeIn' = the fallback path's first 8 s fade-in. */
  def('siren.police', (o) => {
    const c = A.ctx, ARR = 28, PARK = 8, OFF = 4, TOT = ARR + PARK + OFF;
    const src = A.at(230, { dist: 300, el: -20, via: { wall: 1, window: 0 }, ir: 'irFar', wet: 0.35, bus: 'world', life: TOT + 6, noFacing: true });
    if (!src) return;
    const tx = (230 - 150) / 90 * ARR, dAt = (t) => 300 - (275 * t) / ARR, elAt = (t) => -20 - (20 * t) / ARR, azAt = (t) => 230 - (90 * t) / ARR;
    const keys = [];
    for (let s = 0; s < tx; s += 4) keys.push({ dt: s, az: azAt(s), dist: dAt(s), el: elAt(s), via: { wall: 1, window: 0 } });
    keys.push({ dt: tx, az: azAt(tx), dist: dAt(tx), el: elAt(tx), via: { wall: 1, window: 0 } });
    keys.push({ dt: tx + 0.8, az: azAt(tx + 0.8), dist: dAt(tx + 0.8), el: elAt(tx + 0.8), via: { wall: 0, window: 1 } });
    keys.push({ dt: ARR, az: 140, dist: 25, el: -40, via: { wall: 0, window: 1 } });
    src.path(keys);
    const t0 = now() + 0.05;
    const horn = A.filter('bandpass', 1300, 0.8), drive = c.createWaveShaper();
    const cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = (i / 255.5) - 1; cv[i] = Math.tanh(x * 2) / Math.tanh(2); } drive.curve = cv;
    const air = A.filter('lowpass', 400, 0.7); air.frequency.setValueAtTime(400, t0); air.frequency.exponentialRampToValueAtTime(3500, t0 + ARR);
    const og = c.createGain(); og.gain.value = CAL.siren * db(o.gainDb || 0);
    if (o.mode === 'fadeIn') { og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(CAL.siren * db(o.gainDb || 0), t0 + 8); }
    og.gain.setValueAtTime(CAL.siren * db(o.gainDb || 0), t0 + ARR + PARK); og.gain.linearRampToValueAtTime(0.0001, t0 + TOT);
    const comp = c.createGain(); comp.gain.setValueAtTime(db(8), t0); comp.gain.linearRampToValueAtTime(1, t0 + ARR);
    horn.connect(drive); drive.connect(air); air.connect(comp); comp.connect(og); og.connect(src);
    const oscs = [['sawtooth', 0.22], ['square', 0.09]].map(([type, g]) => { const os = c.createOscillator(); os.type = type; const gg = c.createGain(); gg.gain.value = g; os.connect(gg); gg.connect(horn); return os; });
    const F = (fn) => oscs.forEach((os) => fn(os.frequency, os.detune));
    F((f, dt) => { f.setValueAtTime(650, t0); dt.setValueAtTime(34, t0); dt.linearRampToValueAtTime(0, t0 + ARR); });
    let t = t0, up = true;
    while (t < t0 + ARR - 8) { const nt = Math.min(t0 + ARR - 8, t + 0.6); F((f) => f.linearRampToValueAtTime(up ? 1300 : 650, nt)); up = !up; t = nt; }
    while (t < t0 + ARR + PARK) { const nt = t + 0.14; F((f) => f.linearRampToValueAtTime(up ? 1300 : 650, nt)); up = !up; t = nt; }
    F((f) => { f.linearRampToValueAtTime(1200, t + 0.1); f.exponentialRampToValueAtTime(300, t0 + TOT); });
    oscs.forEach((os) => { os.start(t0); os.stop(t0 + TOT + 0.1); });
    A.stats.sources += 2;
    arc(230);
    return { stop(fade) { const tt = now(); og.gain.cancelScheduledValues(tt); og.gain.setTargetAtTime(0, tt, (fade || 1) / 3); src.release((fade || 1) + 0.3); }, arrive: ARR, total: TOT };
  });
  /* earphone test bell (§7.2 G) — head-locked (yaw 0), 1.0 m, in room */
  def('bell.small', (o) => {
    const src = A.at(o.az != null ? o.az : 270, { dist: 1.0, via: 'inRoom', bus: 'sfx', fixed: true, life: 3, noFacing: true }); if (!src) return;
    const t = now() + 0.03, f = 1319, g = 0.32 * db(o.gainDb || 0);
    [[1, 1, 0.9], [2.0, 0.4, 0.5], [2.76, 0.25, 0.3], [5.4, 0.1, 0.12]].forEach(([r, gg, d]) => A.osc('sine', f * r, t, d, g * gg, src, { a: 0.001, decay: true }));
    A.noise(t, 0.003, g * 0.5, src, { filters: [{ type: 'highpass', freq: 3000 }] });
  });
  def('piano.two', (o) => {                        // credits: A3 → (2.4 s) → E4 — no third, no resolution (§7.2 F)
    const c = A.ctx, out = c.createGain(); out.gain.value = 0.32 * db(o.gainDb || 0);
    const felt = A.filter('lowpass', 2500, 0.7); felt.connect(out); out.connect(A.bus('music'));
    const s = c.createGain(); s.gain.value = 0.3; out.connect(s); s.connect(A.reverb);
    const t0 = now() + 0.05;
    [[220, 0], [329.63, 2.4]].forEach(([f0, dt]) => {
      for (let n = 1; n <= 8; n++) { const fn = n * f0 * Math.sqrt(1 + 0.0004 * n * n); A.osc('sine', fn, t0 + dt, 3.5 / Math.sqrt(n), 0.18 / Math.pow(n, 1.4), felt, { a: 0.003, decay: true }); }
      A.noise(t0 + dt, 0.006, 0.12, felt, { filters: [{ type: 'lowpass', freq: 2000 }] });
    });
  });

  /* ---------------- the door (§7.2 C) ---------------- */
  let lastSting = 0;
  function sting(o) {
    if (performance.now() - lastSting < 300) return; lastSting = performance.now();
    const c = A.ctx, out = c.createGain(); out.gain.value = db(o && o.gainDb || 0); out.connect(A.bus('jump'));
    const s = c.createGain(); s.gain.value = 0.2; out.connect(s); s.connect(A.reverb);
    const t = now() + 0.005;
    A.osc('sine', 55, t, 0.5, 0.63, out, { a: 0.002, decay: true, to: 38, glide: 0.5 });
    A.noise(t, 0.15, 0.4, out, { filters: [{ type: 'lowpass', freq: 1500 }] });
    [2400, 5100].forEach((f) => { [-7, 7].forEach((ct) => A.osc('sine', f, t, 0.6, db(-18) * 0.35, out, { a: 0.001, decay: true, detune: ct })); });
  }
  def('sting.soft2', (o) => { if (o.less || A.less()) return; sting(o); });
  def('handle.jerk', (o) => {
    const less = o.less != null ? !!o.less : A.less(), spk = A.speakerMode();
    if (spk) arc(0, 600);                            // the one ▲ for B14 (climax draws none while the cue runs)
    const src = A.at(0, { dist: 0.4, el: -5, via: 'doorDirect', ir: 'irSteel', wet: 0.25, bus: 'jump', life: 3 }); if (!src) return;
    const g = 0.85 * db((less ? -12 : 0) + (spk ? 3 : 0) + (o.gainDb || 0)), t = now() + 0.005;   // with sting: peak ≈ −1 dBFS after the compressor
    A.noise(t, 0.002, g, src, { filters: [{ type: 'highpass', freq: 2000 }] });
    const modes = (tt, gm) => [[1900, 0.25, 0.5], [4600, 0.12, 0.3], [7100, 0.06, 0.15]].forEach(([f, d, gg]) => A.osc('sine', f, tt, d, gg * gm, src, { a: 0.0008, decay: true }));
    modes(t, g);
    modes(t + 0.14, g * db(-4));
    [0, 0.025, 0.05].forEach((dt) => A.noise(t + 0.16 + dt, 0.003, g * 0.4, src, { filters: [{ type: 'bandpass', freq: 3500, Q: 4 }] }));
    A.osc('sine', 80, t + 0.02, 0.27, g * 1.1, src, { a: 0.002, decay: true, to: 55, glide: 0.25 });
    A.noise(t + 0.02, 0.08, g * 0.5, src, { filters: [{ type: 'lowpass', freq: 200 }] });
    if (!less && o.sting !== false) sting({});
  });
  function breathOut(o) {
    o = o || {};
    const src = A.at(0, { dist: o.dist || 0.3, via: 'doorVoice', bus: 'voice', life: 3 }); if (!src) return;
    const t = now() + 0.02, g = 0.55 * db(o.gainDb || 0);
    const pk = A.filter('peaking', 1600, 1.5, 6), lp = A.filter('lowpass', 2000, 0.7); pk.connect(lp); lp.connect(src);
    const n = A.noise(t, 1.4, g, pk, { a: 0.15, filters: [{ type: 'bandpass', freq: 700, Q: 0.8 }] });
    return n;
  }
  def('breath.out', (o) => { breathOut(o); });
  function doorlockArp(midis, step, gain, out) { const t = now() + 0.01; midis.forEach((m, i) => A.osc('square', mtof(m), t + i * step, step + 0.03, 0.045 * gain, out, { a: 0.002, r: 0.01, filter: { freq: 5000 } })); }
  def('doorlock.close', (o) => {
    const src = A.at(0, { dist: 0.8, via: 'inRoom', bus: 'sfx', life: 3, noFacing: true }); if (!src) return;
    const g = db((o.soft ? -8 : 0) + (o.gainDb || 0));
    doorlockArp([96, 91, 88, 84], 0.05, g, src);
    A.noise(now() + 0.27, 0.05, 0.4 * g, src, { filters: [{ type: 'bandpass', freq: 1600, Q: 2 }] });
  });
  def('doorlock.open', (o) => {
    const src = A.at(0, { dist: 0.8, via: 'inRoom', bus: 'sfx', life: 3, noFacing: true }); if (!src) return;
    const g = db(o.gainDb || 0), t = now();
    doorlockArp([84, 88, 91, 96], 0.04, g, src);
    A.osc('sawtooth', 210, t + 0.22, 0.45, 0.06 * g, src, { a: 0.02, filter: { freq: 900, Q: 3 } });
    A.noise(t + 0.67, 0.05, 0.4 * g, src, { filters: [{ type: 'bandpass', freq: 1600, Q: 2 }] });
  });

  /* ---------------- the phone in the hand (§7.2 D) — phone speaker EQ, mono, no spatialisation ---------------- */
  const PH = () => A.phoneOut();
  function mar(t, f, vel, out) {
    A.osc('sine', f, t, 0.5, vel, out, { a: 0.002, decay: true });
    A.osc('sine', f * 3.93, t, 0.12, vel * 0.2, out, { a: 0.001, decay: true });
    A.osc('sine', f * 9.4, t, 0.04, vel * 0.05, out, { a: 0.001, decay: true });
  }
  function toneOut(o, extraDb) { const g = A.ctx.createGain(); g.gain.value = db((o.gainDb || 0) + (extraDb || 0)) * CAL.ui; g.connect(PH()); return g; }
  def('him.tone', (o) => {                         // ep1 S.msgHim verbatim (vibration [60,60,60] is added by G.tones.play)
    const c = A.ctx, out = toneOut(o), t = now() + 0.13;
    A.noise(t - 0.13, 0.13, 0.05, out, { a: 0.12, filters: [{ type: 'bandpass', freq: 2500, Q: 0.7 }] });
    [[831, 0], [1245, 0.1]].forEach(([f, dt]) => {
      const os = c.createOscillator(); os.frequency.value = f;
      const v = c.createOscillator(); v.frequency.value = 6.5; const vg = c.createGain(); vg.gain.value = f * 0.007; v.connect(vg); vg.connect(os.frequency);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(0.13, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.32);
      os.connect(g); g.connect(out); os.start(t + dt); v.start(t + dt); os.stop(t + dt + 0.4); v.stop(t + dt + 0.4);
    });
    A.stats.sources += 4;
  });
  def('n.tone', (o) => { const out = toneOut(o), t = now() + 0.01; mar(t, 587.33, 0.12, out); mar(t + 0.12, 783.99, 0.12, out); });
  def('tone.drop', (o) => {
    const out = toneOut(o), t = now() + 0.01;
    A.osc('sine', 1400, t, 0.12, 0.12, out, { a: 0.002, decay: true, to: 2600, glide: 0.045 });
    A.osc('sine', 1800, t + 0.09, 0.12, 0.12 * db(-4), out, { a: 0.002, decay: true, to: 3200, glide: 0.045 });
  });
  def('tone.chime', (o) => {
    const out = toneOut(o), t = now() + 0.01, s = A.ctx.createGain(); s.gain.value = 0.2; out.connect(s); s.connect(A.reverb);
    [[1568, 1, 0.9], [3920, 0.3, 0.4], [5480, 0.1, 0.2]].forEach(([f, g, d]) => A.osc('sine', f, t, d, 0.11 * g, out, { a: 0.002, decay: true }));
  });
  def('msg.inapp', (o) => { const out = toneOut(o, -10), t = now() + 0.01; A.osc('sine', 1000, t, 0.025, 0.12, out, { a: 0.002, r: 0.008 }); A.osc('sine', 1500, t + 0.055, 0.025, 0.12, out, { a: 0.002, r: 0.008 }); });
  def('fp.ok', (o) => { const out = toneOut(o), t = now(); A.osc('sine', 2400, t, 0.008, 0.08, out, { a: 0.001, r: 0.004 }); const g = toneOut(o, -4); A.noise(t, 0.08, 0.15, g, { filters: [{ type: 'highpass', freq: 2500 }] }); A.osc('sine', 660, t + 0.02, 0.1, 0.06, g, { decay: true }); A.vibrate('fp'); });
  def('pin.error', (o) => { const out = toneOut(o, -4), t = now(); A.osc('square', 180, t, 0.12, 0.06, out, { filter: { freq: 1200 } }); A.osc('square', 140, t + 0.14, 0.18, 0.06, out, { filter: { freq: 1200 } }); A.vibrate('pin'); });
  def('bt.connect', (o) => { const out = toneOut(o), t = now() + 0.01; A.osc('sine', 1046.5, t, 0.07, 0.1, out, { a: 0.003, r: 0.02 }); A.osc('sine', 1568, t + 0.08, 0.09, 0.1 * db(-6), out, { a: 0.003, r: 0.03 }); });
  def('bt.disconnect', (o) => { const out = toneOut(o), t = now() + 0.01; A.osc('sine', 1568, t, 0.09, 0.1 * db(-6), out, { a: 0.003, r: 0.03 }); A.osc('sine', 1046.5, t + 0.1, 0.07, 0.1, out, { a: 0.003, r: 0.02 }); });
  def('nearby.chime', (o) => { const out = toneOut(o, -8), t = now() + 0.01; [1318.5, 1760].forEach((f) => A.osc('sine', f, t, 0.6, 0.1, out, { a: 0.03, decay: true })); });
  def('user.switch', (o) => {
    A.sfx.whoosh(-8);
    const out = toneOut(o, -6), t = now() + 0.05, a = o.dir === 'toN' ? [987.77, 1318.5] : [1318.5, 987.77];
    a.forEach((f, i) => A.osc('sine', f, t + i * 0.08, 0.08, 0.08, out, { a: 0.003, r: 0.02 }));
  });
  /* new phone on the desk (270°, 1.0 m, −20°) — B05 / W02 */
  def('boot.chime', (o) => {
    const src = A.at(270, { dist: 1.0, el: -20, via: 'inRoom', ir: 'ir601', wet: 0.2, bus: 'sfx', life: 4 }); if (!src) return;
    const hp = A.filter('highpass', 400, 0.7), g = A.gainNode(CAL.boot * db(o.gainDb || 0), src); hp.connect(g);   // 덜 무섭게 −3 dB = caller's gainDb (B05)
    const t = now() + 0.02;
    [1046.5, 1318.5, 1760].forEach((f, i) => { A.osc('sine', f, t + i * 0.13, 0.9, 0.16, hp, { a: 0.003, decay: true }); A.osc('triangle', f, t + i * 0.13, 0.9, 0.16 * db(-10), hp, { a: 0.003, decay: true }); });
  });
  def('buzz.desk', (o) => {
    const c = A.ctx, src = A.at(270, { dist: 1.0, el: -20, via: 'inRoom', ir: 'ir601', wet: 0.15, bus: 'sfx', life: 3 }); if (!src) return;
    const os = c.createOscillator(); os.type = 'square'; os.frequency.value = 150;
    const am = c.createOscillator(); am.frequency.value = 25; const amg = c.createGain(); amg.gain.value = 0.5; am.connect(amg);
    const lp = A.filter('lowpass', 400, 0.7), g = c.createGain(); g.gain.value = 0; amg.connect(g.gain);
    os.connect(lp); lp.connect(g); g.connect(src);
    const t = now() + 0.02, v = 0.064 * db(o.gainDb || 0);
    [[0, 0.25], [0.33, 0.25]].forEach(([dt, d]) => { g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(v, t + dt + 0.01); g.gain.setValueAtTime(v, t + dt + d - 0.01); g.gain.linearRampToValueAtTime(0, t + dt + d); });
    os.start(t); am.start(t); os.stop(t + 0.7); am.stop(t + 0.7);
  });

  /* =========================================================
   * The drill at the door (§7.2 C, §6.2 climax table) — 0°, −10°, 1.2 m ↔ 0.6 m, doorDirect, irSteel .3
   * ========================================================= */
  let D = null;
  /* §7.1.6 drill peak −6 dBFS (after the master compressor, whose makeup adds ≈ +3 dB): the 0.6 m spin sat on its RMS target
     (−13) but its crest (sawtooth + Gibbs, the 310 Hz door resonance, bite thumps) put the peaks at −4.5…−2 dBFS. The crest is
     rebuilt by the door / HRTF / irSteel filtering, so the limiter sits AFTER the spatial chain: the drill's own output bus
     'drillOut' (dry + wet) → soft limiter (linear to KNEE, tanh knee to CEIL — dBFS at the bus, i.e. before world / master) →
     world. Mostly the near spin's peaks reach the knee; measured A/B: peaks −4.2 → −6.5 dBFS, RMS within 0.2 dB. */
  const DLIM = { knee: db(-12.8), ceil: db(-10), makeup: 1, range: 0.5 };   // bus RMS at 0.6 m ≈ −15.1 dBFS; comp makeup ≈ +3.4 dB
  let dCurve = null;
  function drillCurve() {
    if (dCurve) return dCurve;
    const N = 8192, cv = new Float32Array(N), k = DLIM.knee, r = DLIM.ceil - DLIM.knee, R = DLIM.range;
    for (let i = 0; i < N; i++) {
      const x = ((i / (N - 1)) * 2 - 1) * R, a = Math.abs(x);       // the shaper's ±1 input = ±RANGE (input gain 1 / RANGE)
      const y = a <= k ? a : k + r * Math.tanh((a - k) / r);
      cv[i] = Math.sign(x) * y * DLIM.makeup;
    }
    return (dCurve = cv);
  }
  function drillBus() {
    const c = A.ctx, cur = A.buses.drillOut;
    if (cur && cur.context === c) return 'drillOut';
    const inp = c.createGain(); inp.gain.value = 1 / DLIM.range;
    const ws = c.createWaveShaper(); ws.curve = drillCurve(); ws.oversample = '4x';
    inp.connect(ws); ws.connect(A.buses.world);
    A.buses.drillOut = inp;                          // not in A.BUSES: silenceDrop / hush act on 'world' after it
    return 'drillOut';
  }
  function dBuild() {
    const c = A.ctx;
    const out = A.at(0, { dist: 1.2, el: -10, via: 'doorDirect', ir: 'irSteel', wet: 0.3, bus: drillBus(), life: Infinity });
    const master = c.createGain(); master.gain.value = 0; master.connect(out || A.bus('world'));
    const motorG = c.createGain(); motorG.gain.value = 0.0001;
    const mlp = A.filter('lowpass', 2500, 0.7); mlp.connect(motorG); motorG.connect(master);
    const saw = c.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 40; const sawG = A.gainNode(0.32, mlp); saw.connect(sawG);
    const sq = c.createOscillator(); sq.type = 'square'; sq.frequency.value = 20; const sqG = A.gainNode(0.32 * db(-12), mlp); sq.connect(sqG);
    const gear = c.createOscillator(); gear.frequency.value = 120; const gearG = A.gainNode(0.32 * db(-18), motorG); gear.connect(gearG);
    const fm = c.createOscillator(); fm.frequency.value = 7; const fmG = A.gainNode(9, gear.frequency); fm.connect(fmG);
    // brush noise BP 6 kHz, amplitude-modulated by the motor
    const bsrc = c.createBufferSource(); bsrc.buffer = A._white; bsrc.loop = true;
    const bbp = A.filter('bandpass', 6000, 1.2), bam = c.createGain(); bam.gain.value = 0.5; const bamd = A.gainNode(0.5, bam.gain);
    saw.connect(bamd); bsrc.connect(bbp); bbp.connect(bam); const bG = A.gainNode(db(-24) * 0.9, motorG); bam.connect(bG);
    // bit — metal (under load only)
    const nsrc = c.createBufferSource(); nsrc.buffer = A._white; nsrc.loop = true;
    const nb = A.filter('bandpass', 3200, 2), bitAM = c.createGain(); bitAM.gain.value = 0.6;
    const bitG = c.createGain(); bitG.gain.value = 0; bitAM.connect(bitG); bitG.connect(master);
    nsrc.connect(nb);
    [[1100, 1], [2700, 0.6], [4300, 0.35]].forEach(([f, g]) => { const r = A.filter('bandpass', f, 25); const rg = A.gainNode(g * 1.6, bitAM); nb.connect(r); r.connect(rg); });
    const jit = c.createOscillator(); jit.type = 'square'; jit.frequency.value = 30; const jitG = A.gainNode(0.4, bitAM.gain); jit.connect(jitG);
    [saw, sq, gear, fm, bsrc, nsrc, jit].forEach((n) => n.start());
    A.stats.sources += 7;
    const nodes = { out, master, motorG, saw, sq, gear, bitG, jit, srcs: [saw, sq, gear, fm, bsrc, nsrc, jit] };
    return nodes;
  }
  function dSetF(t, f, glide, kind) {
    const apply = (p, k) => { if (kind === 'set') p.setValueAtTime(f * k, t); else if (kind === 'lin') p.linearRampToValueAtTime(f * k, t + glide); else p.exponentialRampToValueAtTime(Math.max(1, f * k), t + glide); };
    apply(D.n.saw.frequency, 1); apply(D.n.sq.frequency, 0.5); apply(D.n.gear.frequency, 3);
  }
  function dParams() { return [D.n.saw.frequency, D.n.sq.frequency, D.n.gear.frequency, D.n.motorG.gain, D.n.bitG.gain]; }
  function dCancel(t) { dParams().forEach((p) => { p.cancelScheduledValues(t); p.setValueAtTime(Math.max(0.0001, p.value), t); }); D.shots = D.shots.filter((s) => { if (s.t > t) { try { s.n.stop(t); } catch (er) {} return false; } return s.t + 1 > t; }); }
  function dShot(n, t) { if (n) D.shots.push({ n, t }); }
  function dSpin(ts, len) {
    const n = D.n; len = len || 4.0;
    D.near = !D.near; const dist = D.near ? 0.6 : 1.2;
    D.spinStart = ts; D.spinEnd = ts + len;
    if (n.out) n.out.path([{ dt: Math.max(0, ts - now()), dist: D.near ? 1.2 : 0.6 }, { dt: Math.max(0, ts - now()) + 0.3, dist }]);
    D.distAt = { t: ts + 0.3, near: D.near };
    // spin-up 0.25 s (40 Hz → 190 no-load), load glide 0.3 s → 150 Hz
    dSetF(ts, 40, 0, 'set'); dSetF(ts, 190, 0.25, 'exp'); dSetF(ts + 0.4, 190, 0, 'set'); dSetF(ts + 0.4, 150, 0.3, 'exp');
    n.motorG.gain.setValueAtTime(0.0001, ts); n.motorG.gain.exponentialRampToValueAtTime(1, ts + 0.08);
    n.bitG.gain.setValueAtTime(0, ts + 0.42); n.bitG.gain.linearRampToValueAtTime(1, ts + 0.5);
    for (let tj = ts + 0.4; tj < ts + len; tj += rnd(0.15, 0.4)) n.jit.frequency.setValueAtTime(rnd(20, 40), tj);   // 20–40 Hz random chatter AM
    // bites every 1.5–3 s: door thump 80 → 55 Hz + motor −10 % for 0.2 s
    for (let tb = ts + rnd(0.9, 1.6); tb < ts + len - 0.4; tb += rnd(1.5, 3)) {
      dShot(A.osc('sine', 80, tb, 0.2, 0.55, n.master, { a: 0.003, decay: true, to: 55, glide: 0.18 }), tb);   // .9 → .55: the thump no longer drives the limiter hard
      dSetF(tb, 150, 0, 'set'); dSetF(tb, 135, 0.05, 'exp'); dSetF(tb + 0.2, 135, 0, 'set'); dSetF(tb + 0.2, 150, 0.08, 'exp');
      const dl = (tb - now()) * 1000;
      setTimeout(() => { if (D && D.state === 'run' && performance.now() - D.lastVib >= 2000) { D.lastVib = performance.now(); A.vibrate('drill'); } }, Math.max(0, dl));
    }
    // spin-down 0.5 s (→ 25 Hz)
    const te = ts + len;
    n.bitG.gain.setValueAtTime(1, te); n.bitG.gain.linearRampToValueAtTime(0, te + 0.05);
    dSetF(te, 150, 0, 'set'); dSetF(te, 25, 0.5, 'exp');
    n.motorG.gain.setValueAtTime(1, te); n.motorG.gain.exponentialRampToValueAtTime(0.0001, te + 0.5);
    // the rest: the bit tip scraping the lock face (3–5 ticks, −30 dB)
    for (let i = 0, k = rndi(3, 5); i < k; i++) { const tt = te + 0.7 + rnd(0, 1.0); dShot(A.noise(tt, 0.003, db(-30) * 3, n.master, { filters: [{ type: 'bandpass', freq: 3000, Q: 3 }] }), tt); }
  }
  const drill = A.drill = {
    start(o) {
      o = o || {};
      if (!ok()) return;
      if (D && D.state !== 'off') return;
      const n = dBuild();
      D = { n, state: 'run', near: false, shots: [], lastVib: 0, next: 0, first: true };
      const t = now() + 0.05;
      const cl = gvar('climax'), pm = G.state && G.state.playMs;
      let phase = o.phase != null ? o.phase : 0, fade = o.fadeMs != null ? o.fadeMs / 1000 : 0.05;
      if (o.phase == null && cl && cl.drillPm != null && pm != null && pm - cl.drillPm > 1500) { phase = ((pm - cl.drillPm) / 1000) % 6; fade = 4; }  // resume: same cycle position, 4 s fade
      const lvl = CAL.drill * (A.less() ? db(-6) : 1);
      n.master.gain.setValueAtTime(0.0001, t); n.master.gain.linearRampToValueAtTime(lvl, t + fade);
      if (phase < 3.6) { dSpin(t, 4.0 - phase); D.next = t + 6 - phase; } else D.next = t + (6 - phase);
      D.off = A.every((tt) => { if (D && D.state === 'run' && D.next < tt + 0.3) { dSpin(D.next); D.next += 6; } });
      if (phase < 3.6) arc(0);
    },
    wobble() {                                      // 0.35 spin-down → 1.15 stop → 0.25 spin-up (1.5 s)
      if (!D || D.state !== 'run' || !ok()) return Promise.resolve();
      const t = now(), spinning = t >= D.spinStart && t < D.spinEnd + 0.4;
      dCancel(t);
      if (spinning) { dSetF(t, 25, 0.35, 'exp'); D.n.motorG.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); D.n.bitG.gain.linearRampToValueAtTime(0, t + 0.05); }
      const ts = t + 1.25;
      D.near = !D.near;                              // keep the current distance
      dSpin(ts, 4.0); D.next = ts + 6;
      return new Promise((r) => setTimeout(r, 1500));
    },
    hesitate(ms) {                                  // B14 0.8 s · 2.0 s: rotation cut 0.25 s (he lets go of the trigger)
      if (!D || D.state !== 'run' || !ok()) return;
      const t = now(), d = (ms || 250) / 1000; if (!(t >= D.spinStart && t < D.spinEnd)) return;
      const g = D.n.motorG.gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.exponentialRampToValueAtTime(0.12, t + 0.03); g.setValueAtTime(0.12, t + d); g.exponentialRampToValueAtTime(1, t + d + 0.05);
      dSetF(t, 150, 0, 'set'); dSetF(t, 110, 0.05, 'exp'); dSetF(t + d, 110, 0, 'set'); dSetF(t + d, 150, 0.1, 'exp');
      if (D.spinEnd < t + d + 0.2) { /* the spin was ending anyway */ } else {
        const te = D.spinEnd; D.n.motorG.gain.setValueAtTime(1, te); D.n.motorG.gain.exponentialRampToValueAtTime(0.0001, te + 0.5); dSetF(te, 150, 0, 'set'); dSetF(te, 25, 0.5, 'exp');
      }
    },
    stopC2() {                                      // hard stop 0.12 s + bit 'ting' 2.7 kHz 0.2 s (§6.4-① t = 3.0)
      if (!D || D.state === 'off' || !ok()) return Promise.resolve();
      const t = now(); dCancel(t);
      dSetF(t, 25, 0.12, 'exp'); D.n.motorG.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); D.n.bitG.gain.linearRampToValueAtTime(0, t + 0.03);
      A.osc('sine', 2700, t + 0.1, 0.2, 0.25, D.n.master, { a: 0.001, decay: true });
      dEnd(1.2);
      return new Promise((r) => setTimeout(r, 150));
    },
    stopFallback() {                                // finish the current rotation, then stop (siren path — no jump)
      if (!D || D.state === 'off') return Promise.resolve();
      const t = ok() ? now() : 0;
      D.state = 'ending'; D.next = Infinity;
      const left = t >= D.spinStart && t < D.spinEnd ? D.spinEnd - t + 0.55 : 0;
      setTimeout(() => dEnd(0.2), left * 1000);
      return new Promise((r) => setTimeout(r, left * 1000 + 50));
    },
    playing() { return !!(D && D.state !== 'off'); },
    near() { if (!D || D.state === 'off' || !A.ctx) return false; const s = D.distAt; return !!(s && (now() >= s.t ? s.near : !s.near)); },
  };
  function dEnd(after) {
    if (!D) return; const d = D; D = null; d.state = 'off';
    if (d.off) d.off();
    setTimeout(() => { d.n.srcs.forEach((s) => { try { s.stop(); } catch (er) {} }); if (d.n.out) d.n.out.dispose(); }, (after || 0.2) * 1000 + 400);
  }

  /* =========================================================
   * Media chains for G.media (§7.1.5) — phone speaker / 2층_스피커
   * ========================================================= */
  const btChains = new Set();
  function btCorr(v) { const T = CAL.btCorr; for (let i = 0; i < T.length - 1; i++) if (v <= T[i + 1][0]) { const f = (v - T[i][0]) / (T[i + 1][0] - T[i][0]); return T[i][1] + (T[i + 1][1] - T[i][1]) * f; } return T[T.length - 1][1]; }
  const MCH = {};                                    // ep3: defineMediaChain('ear' | 'table', factory)
  A.defineMediaChain = function (kind, factory) { if (!kind || typeof factory !== 'function') return false; MCH[kind] = factory; return true; };
  A.mediaChain = function (kind) {
    const dummy = { input: null, setVolume() {}, dispose() {}, latency: 0, kind, analyser: null };
    if (!ok()) return dummy;
    if (MCH[kind]) { try { const ch = MCH[kind](); if (ch && ch.input) return ch; } catch (er) { console.error('[audio] mediaChain ' + kind, er); } return dummy; }
    const c = A.ctx;
    const input = c.createGain();
    const mono = c.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.2; an.minDecibels = -100; an.maxDecibels = -20;
    input.connect(mono); input.connect(an);
    if (kind !== 'bt') {                            // phone: HP 450 · 2.8 kHz +5 dB · LP 9 kHz · (v/100)^1.6 · centre, music bus
      const hp = A.filter('highpass', 450, 0.7), pk = A.filter('peaking', 2800, 1, 5), lp = A.filter('lowpass', 9000, 0.7);
      const vol = c.createGain(); vol.gain.value = 0; const trim = A.gainNode(CAL.phone, A.bus('music'));
      mono.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(vol); vol.connect(trim);
      const ch = { input, kind: 'phone', latency: 0, analyser: an,
        setVolume(v, tau) { const x = clamp(+v || 0, 0, 100) / 100; vol.gain.setTargetAtTime(Math.pow(x, 1.6), now(), tau != null ? tau : 0.08); },
        dispose() { [input, mono, hp, pk, lp, vol, trim, an].forEach((n) => { try { n.disconnect(); } catch (er) {} }); } };
      return ch;
    }
    // bt: cheap BT speaker EQ → soft clip k = 1 + 3·max(0, v−85)/15 → (v/100)^1.6 → air LP 1200 + 2300·(v/100)^1.2 → slap180 → irRoof .35 → 115° −30° 12 m via window
    const hp1 = A.filter('highpass', 180, 0.707), hp2 = A.filter('highpass', 180, 0.707), pk = A.filter('peaking', 3000, 1.2, 4), lp = A.filter('lowpass', 11000, 0.7);
    const pre = c.createGain(), sh = c.createWaveShaper(), post = c.createGain();
    const cv = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = (i / 1023.5) - 1; cv[i] = Math.tanh(4 * x); } sh.curve = cv; sh.oversample = '2x';
    const vol = c.createGain(); vol.gain.value = 0;
    const air = A.filter('lowpass', 1200, 0.7), corr = c.createGain(); corr.gain.value = 1;
    const at = A.at(115, { el: -30, dist: 12, via: 'window', ir: 'irRoof', wet: 0.35, bus: 'mediaOut', slap: true, life: Infinity });
    const trim = A.gainNode(CAL.bt, at || A.bus('mediaOut'));
    mono.connect(hp1); hp1.connect(hp2); hp2.connect(pk); pk.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(post); post.connect(vol); vol.connect(air); air.connect(corr); corr.connect(trim);
    const ch = { input, kind: 'bt', latency: 0, analyser: an, v: 0,
      setVolume(v, tau) {
        v = clamp(+v || 0, 0, 100); ch.v = v; const x = v / 100, t = now(), ta = tau != null ? tau : 0.08;
        const k = 1 + (3 * Math.max(0, v - 85)) / 15;
        pre.gain.setTargetAtTime(k / 4, t, ta); post.gain.setTargetAtTime(1 / Math.tanh(k), t, ta);
        vol.gain.setTargetAtTime(Math.pow(x, 1.6), t, ta);
        air.frequency.setTargetAtTime(1200 + 2300 * Math.pow(x, 1.2), t, ta);
        corr.gain.setTargetAtTime(db(btCorr(v)), t, ta);
      },
      dispose() { btChains.delete(ch); [input, mono, hp1, hp2, pk, lp, pre, sh, post, vol, air, corr, trim, an].forEach((n) => { try { n.disconnect(); } catch (er) {} }); if (at) at.release(0.3); } };
    ch.setVolume(15, 0.001);
    btChains.add(ch);
    return ch;
  };
  /* media.cut (§7.2 E): mediaOut 8 ms cut + speaker power 'pop' (60 Hz 30 ms + LP 1 kHz noise 5 ms, 115°, −40) — no pop when nothing plays */
  def('media.cut', (o) => {
    const t = now(), g = A.buses.mediaOut.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.008);
    A._busTarget.mediaOut = 0;                       // musicCut is permanent
    let playing = true; try { const st = G.media && G.media.state && G.media.state(); if (st && st.target === 'bt') playing = !!st.playing; } catch (er) {}
    if (o.pop !== false && playing) {
      const src = A.at(115, { dist: 12, el: -30, via: 'window', bus: 'world', life: 2 });
      if (src) { A.osc('sine', 60, t + 0.004, 0.03, 0.9, src, { a: 0.001, r: 0.01 }); A.noise(t + 0.004, 0.005, 0.5, src, { filters: [{ type: 'lowpass', freq: 1000 }] }); }
    }
  });

  /* =========================================================
   * Offline renders (§7.2 E/G, §9.7 미디어 렌더) — mono 32 kHz, built after unlock in idle time
   * ========================================================= */
  const SR = 32000;
  function offline(sec, sr) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    try { return new OAC(1, Math.ceil(sec * (sr || SR)), sr || SR); } catch (e) { try { return new OAC(1, Math.ceil(sec * 44100), 44100); } catch (e2) { return null; } }
  }
  function renderOff(c) {
    return new Promise((res) => {
      let done = false; const fin = (b) => { if (!done) { done = true; res(b || null); } };
      try { c.oncomplete = (ev) => fin(ev.renderedBuffer); const p = c.startRendering(); if (p && p.then) p.then(fin, () => fin(null)); } catch (e) { fin(null); }
    });
  }
  function peakOf(b, from, to) { let m = 1e-9; for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = from || 0, n = Math.min(d.length, to || d.length); i < n; i++) { const v = Math.abs(d[i]); if (v > m) m = v; } } return m; }
  function rmsOf(d, from, to) { let s = 0, n = 0; for (let i = from || 0, e = Math.min(d.length, to || d.length); i < e; i++) { s += d[i] * d[i]; n++; } return Math.sqrt(s / Math.max(1, n)); }
  function scaleBuf(b, g) { for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= g; } }
  function addPink(d, sr, dbfs, from, to) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; const tmp = new Float32Array(Math.min(d.length, to || d.length) - (from || 0));
    for (let i = 0; i < tmp.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; tmp[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; }
    const g = db(dbfs) / (rmsOf(tmp) || 1);
    for (let i = 0; i < tmp.length; i++) d[(from || 0) + i] += tmp[i] * g;
  }
  function jsBuf(c, sec) { return c.createBuffer(1, Math.ceil(sec * c.sampleRate), c.sampleRate); }
  function bufSrc(c, buf, t, out, gain) { const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = gain != null ? gain : 1; s.connect(g); g.connect(out); s.start(t || 0); return s; }
  function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
  function phoneVideoChain(c, o) {                 // HP 150 · LP 8 kHz · AGC (§7.2 B hinge.cry colouring)
    const hp = A.filter('highpass', 150, 0.7, null, c), lp = A.filter('lowpass', 8000, 0.7, null, c), comp = c.createDynamicsCompressor();
    comp.threshold.value = o.th != null ? o.th : -24; comp.ratio.value = o.ratio || 6; comp.attack.value = o.att || 0.003; comp.release.value = o.rel || 0.25; comp.knee.value = 4;
    const mk = c.createGain(); mk.gain.value = db(o.makeup != null ? o.makeup : 10);
    hp.connect(lp); lp.connect(comp); comp.connect(mk); mk.connect(c.destination);
    return hp;
  }
  /* the ep1 music box (js/core/spatial.js MB + tine), rendered offline */
  const MB = [[0, 76], [1, 81], [2, 84], [3, 83], [4, 81], [5, 76], [6, 77], [7, 81], [8, 86], [9, 84], [10, 83], [12, 76], [13, 81], [14, 84], [15, 83], [16, 81], [17, 79], [18, 77], [19, 76], [20, 74], [21, 76]];
  A.MB = MB;
  function tineC(c, t, midi, vel, out, cents) {
    const f = mtof(midi + 12) * Math.pow(2, (cents || 0) / 1200);
    A.oscC(c, 'sine', f, t, midi < 70 ? 2.2 : 1.6, vel, out, { a: 0.001, decay: true });
    A.oscC(c, 'sine', f * 2, t, 0.6, vel * 0.22, out, { a: 0.001, decay: true });
    A.oscC(c, 'sine', f * 5.4, t, 0.12, vel * 0.07, out, { a: 0.001, decay: true });
    A.noiseC(c, t, 0.004, vel * 0.3, out, { filters: [{ type: 'highpass', freq: 5000 }] });
  }
  /** rec.uri (0:31.0): the wardrobe recording of 2026-11-24 04:22 — winddown variant (§7.2 E) */
  async function renderRecUri() {
    const c = offline(31); if (!c) return null;
    const mic = c.createBiquadFilter(); mic.type = 'highpass'; mic.frequency.value = 120;
    const lp = A.filter('lowpass', 9000, 0.7, null, c), agc = c.createDynamicsCompressor();
    agc.threshold.value = -30; agc.ratio.value = 4; agc.attack.value = 0.01; agc.release.value = 0.4; agc.knee.value = 6;
    const mk = c.createGain(); mk.gain.value = db(12);
    mic.connect(lp); lp.connect(agc); agc.connect(mk); mk.connect(c.destination);
    const mel = c.createGain(); mel.connect(mic);
    const clo = c.createConvolver(); clo.buffer = irBuffer(c, 'irCloset'); const cs = c.createGain(); cs.gain.value = 0.45; mel.connect(cs); cs.connect(clo); clo.connect(mic);
    const B = A.noiseBuffers(c); const fl = c.createBufferSource(); fl.buffer = B.pink; fl.loop = true; const flg = c.createGain(); flg.gain.value = db(-52); fl.connect(flg); flg.connect(mic); fl.start(0);
    const vel = 0.08;
    A.noiseC(c, 0.0, 0.3, vel * db(-30) * 6, mel, { a: 0.05, flat: true, r: 0.08, filters: [{ type: 'lowpass', freq: 3000 }] });   // phone handling
    const q = 0.88, d0 = (1.7 * (1 - q)) / (1 - Math.pow(q, 13)); let tr = 0.4;                                                         // ratchet ×14, faster
    for (let k = 0; k < 14; k++) { A.noiseC(c, tr, 0.002, vel * db(-18) * 4, mel, { filters: [{ type: 'bandpass', freq: 4500, Q: 2 }] }); A.oscC(c, 'sine', 1100, tr, 0.006, vel * db(-18) * 2, mel, { a: 0.0005, decay: true }); tr += d0 * Math.pow(q, k); }
    let W = 0, last = 0, mult = 1;                                                                                                       // winddown: from beat 12, ×1.12 cumulative
    MB.forEach(([b]) => { let u = b - last; if (b >= 12) { mult *= 1.12; u *= mult; } W += u; last = b; });
    const beat = (26.4 - 2.6) / W;
    let tt = 2.6; last = 0; mult = 1;
    MB.forEach(([b, m], i) => {
      let dt = (b - last) * beat; if (b >= 12) { mult *= 1.12; dt *= mult; } tt += dt; last = b;
      tineC(c, tt, m, vel, mel, rnd(-4, 4));
      if (i === 19) tineC(c, tt + 0.012, m, vel * 0.6, mel, 0);                                                                          // flam
    });
    [26.6, 26.9].forEach((t) => A.noiseC(c, t, 0.006, 0.12, mel, { filters: [{ type: 'highpass', freq: 3000 }] }));                       // 딸깍 딸깍
    A.noiseC(c, 30.4, 0.3, vel * 0.25, mel, { a: 0.05, filters: [{ type: 'bandpass', freq: 1400, Q: 0.8 }] });                             // rustle (record stop)
    const b = await renderOff(c); if (!b) return null;
    scaleBuf(b, 0.6 / peakOf(b));
    const d = b.getChannelData(0), fr = rmsOf(d, Math.floor(28 * b.sampleRate), Math.floor(30 * b.sampleRate));
    if (20 * Math.log10(fr + 1e-9) < -57) addPink(d, b.sampleRate, -55);                                                                  // floor ≈ −54 dBFS
    return b;
  }
  /** hinge.cry: stick-slip impulse train → resonator bank (§7.2 B) — inside vid.move only */
  async function renderHinge() {
    const c = offline(2.4); if (!c) return null;
    const imp = jsBuf(c, 2.4), d = imp.getChannelData(0), sr = c.sampleRate;
    let t = 0;
    while (t < 2.2) {
      const f = t < 1.4 ? 120 * Math.pow(290 / 120, t / 1.4) : 290 * Math.pow(170 / 290, (t - 1.4) / 0.8);
      const e = Math.min(1, t / 0.08, (2.2 - t) / 0.15), i = Math.floor(t * sr);
      if (i + 1 < d.length) { const a = e * rnd(0.7, 1); d[i] += a; d[i + 1] -= a * 0.5; }
      t += (1 / f) * (1 + rnd(-0.25, 0.25));
    }
    const am = c.createGain(); am.gain.value = 0.6; am.connect(c.destination);
    for (let tt = 0, hi = true; tt < 2.3; tt += 1 / rnd(7, 13), hi = !hi) am.gain.linearRampToValueAtTime(hi ? 1 : 0.2, tt);   // irregular 'catch' AM 40 %
    const s = c.createBufferSource(); s.buffer = imp;
    [[420, 1], [1130, 0.8], [2210, 0.6], [3480, 0.35], [5150, 0.2]].forEach(([f, g]) => { const r = A.filter('bandpass', f, 18, null, c); const rg = A.gainNode(g, am, c); s.connect(r); r.connect(rg); });
    const lo = A.filter('bandpass', 95, 4, null, c); const lg = A.gainNode(1.2, am, c); s.connect(lo); lo.connect(lg);
    s.start(0);
    const b = await renderOff(c); if (!b) return null;
    scaleBuf(b, 1 / peakOf(b));
    return b;
  }
  /** vid.move (0:18 — 2026.12.10 오후 3:2x): daytime roof, outdoor wind, far car, birds, two close steps, hinge 9.0–11.2 */
  async function renderVidMove() {
    const hinge = await renderHinge();
    const c = offline(18); if (!c) return null;
    const col = phoneVideoChain(c, { th: -24, ratio: 6, att: 0.003, rel: 0.25, makeup: 10 });
    const mix = c.createGain(); mix.connect(col);
    const B = A.noiseBuffers(c);
    const w = c.createBufferSource(); w.buffer = B.pink; w.loop = true;
    const whp = A.filter('highpass', 120, 0.7, null, c), wlp = A.filter('lowpass', 3000, 0.7, null, c), wg = c.createGain(); wg.gain.value = 0.15;
    w.connect(whp); whp.connect(wlp); wlp.connect(wg); wg.connect(mix); w.start(0, Math.random() * 2);
    [[1.5, 3.5], [6.0, 4.0], [12.5, 4.5]].forEach(([t0, d]) => { wg.gain.setValueAtTime(0.15, t0); wg.gain.linearRampToValueAtTime(rnd(0.35, 0.5), t0 + d * 0.4); wg.gain.linearRampToValueAtTime(0.15, t0 + d); });
    const car = c.createBufferSource(); car.buffer = B.brown; car.loop = true; const clp = A.filter('lowpass', 400, 0.7, null, c), cg = c.createGain(); cg.gain.setValueAtTime(0.0001, 0);
    cg.gain.linearRampToValueAtTime(0.25, 8); cg.gain.linearRampToValueAtTime(0.02, 15); car.connect(clp); clp.connect(cg); cg.connect(mix); car.start(0);
    [4.1, 4.36].forEach((t) => A.oscC(c, 'sine', 2400, t, 0.12, 0.06, mix, { a: 0.008, r: 0.03, to: 3600, glide: 0.12 }));                  // birds
    const st = c.createGain(); st.gain.value = 1.6; st.connect(mix);
    stepAt(c, st, 0.12, { surface: 'dry', g: 1 }); stepAt(c, st, 0.78, { surface: 'dry', g: 0.9 });                                            // the filmer's two steps
    if (hinge) bufSrc(c, hinge, 9.0, mix, 2.2);
    const b = await renderOff(c); if (!b) return null;
    scaleBuf(b, db(-4) / peakOf(b));
    return b;
  }
  /* 「고향의 봄」(홍난파 1926 — public domain; melody only, no lyrics/title) first three notes, checked against the
     public score (조선동요백곡집, B♭ major: F F D = 솔 솔 미), whistled in C: G5 G5 E5 (§7.2 E, §0.2 D10, §10 H) */
  const WHISTLE = [[5.0, 5.9, 783.99], [6.05, 6.65, 783.99], [6.8, 7.9, 659.26]];
  async function renderVidRoof() {
    const c = offline(12); if (!c) return null;
    const col = phoneVideoChain(c, { th: -32, ratio: 4, att: 0.01, rel: 0.4, makeup: 14 });
    const mix = c.createGain(); mix.connect(col);
    const B = A.noiseBuffers(c);
    const w = c.createBufferSource(); w.buffer = B.pink; w.loop = true;
    const whp = A.filter('highpass', 150, 0.7, null, c), wlp = A.filter('lowpass', 1500, 0.7, null, c), wg = c.createGain(); wg.gain.value = 0.25;
    w.connect(whp); whp.connect(wlp); wlp.connect(wg); wg.connect(mix); w.start(0, Math.random() * 2);
    wg.gain.setValueAtTime(0.25, 0); wg.gain.linearRampToValueAtTime(0.4, 2.5); wg.gain.linearRampToValueAtTime(0.22, 4.5); wg.gain.linearRampToValueAtTime(0.3, 10);
    const car = c.createBufferSource(); car.buffer = B.brown; car.loop = true; const clp = A.filter('lowpass', 300, 0.7, null, c), cg = c.createGain(); cg.gain.value = 0.05;
    car.connect(clp); clp.connect(cg); cg.connect(mix); car.start(0);
    // lip whistle: sine + 2nd harmonic −24 dB, late 5 Hz ±15 cent vibrato, 40 ms portamento, first 50 ms from −30 cent
    const sr = c.sampleRate, wb = jsBuf(c, 12), d = wb.getChannelData(0); let ph = 0, prevF = null;
    WHISTLE.forEach(([t0, t1, f]) => {
      const i0 = Math.floor(t0 * sr), i1 = Math.floor(t1 * sr), dur = t1 - t0, fs = prevF || f * Math.pow(2, -30 / 1200), gl = prevF ? 0.04 : 0.05;
      for (let i = i0; i < i1; i++) {
        const tt = (i - i0) / sr;
        let fr = tt < gl ? fs + (f - fs) * (tt / gl) : f;
        const vd = clamp((tt - 0.3) / 0.2, 0, 1) * 15; fr *= Math.pow(2, (vd * Math.sin(TAU * 5 * tt)) / 1200);
        ph += (TAU * fr) / sr;
        const e = Math.min(1, tt / 0.03, (dur - tt) / 0.07) * (0.9 + 0.1 * Math.sin(Math.PI * tt / dur));
        d[i] = (Math.sin(ph) + db(-24) * Math.sin(2 * ph)) * e;
      }
      prevF = f;
    });
    bufSrc(c, wb, 0, mix, 0.035);
    const br = c.createBufferSource(); br.buffer = B.white; br.loop = true; const bbp = A.filter('bandpass', 784, 6, null, c), bg = c.createGain(); bg.gain.value = 0;
    br.connect(bbp); bbp.connect(bg); bg.connect(mix); br.start(0);
    WHISTLE.forEach(([t0, t1, f]) => { bbp.frequency.setValueAtTime(f, t0); bg.gain.setValueAtTime(0, t0); bg.gain.linearRampToValueAtTime(0.035 * db(-18) * 4, t0 + 0.03); bg.gain.setValueAtTime(0.035 * db(-18) * 4, t1 - 0.07); bg.gain.linearRampToValueAtTime(0, t1); });
    const b = await renderOff(c); if (!b) return null;
    scaleBuf(b, db(-6) / peakOf(b));
    return b;
  }
  /** hook.seahY (0:12.0): voice-message texture, piyo.mouth 0–0.40 + hum.sea 1.70–8.40 (§7.2 G) */
  const HUM = [[64, 1.70, 2.55, 0.3], [69, 2.60, 3.45, 0.3], [72, 3.50, 4.35, 0.3], [71, 4.40, 5.25, 0.3], [70, 5.30, 6.50, 0.4], [64, 6.55, 8.40, 0.3]];
  async function renderHook() {
    const c = offline(12); if (!c) return null;
    const sr = c.sampleRate;
    const hp = A.filter('highpass', 120, 0.7, null, c), lp = A.filter('lowpass', 7500, 0.7, null, c), agc = c.createDynamicsCompressor();
    agc.threshold.value = -24; agc.ratio.value = 2; agc.attack.value = 0.01; agc.release.value = 0.3;
    hp.connect(lp); lp.connect(agc); agc.connect(c.destination);
    const room = c.createConvolver(); room.buffer = irBuffer(c, 'irSmall'); const rs = c.createGain(); rs.gain.value = 0.25; lp.connect(rs); rs.connect(room); room.connect(agc);
    const B = A.noiseBuffers(c);
    // ① piyo.mouth — 1편 renderKongi '삐요' outline compressed 0.52 → 0.40 s, blown by mouth
    const pb = jsBuf(c, 0.5), pd = pb.getChannelData(0); let ph = 0, wob = 0, wobT = 0;
    [[0.0, 0.13, 2250, 2350], [0.17, 0.4, 1950, 1350]].forEach(([s0, s1, fa, fb]) => {
      const i0 = Math.floor(s0 * sr), n = Math.floor((s1 - s0) * sr);
      for (let i = 0; i < n; i++) {
        const x = i / n, tt = s0 + i / sr;
        if (tt >= wobT) { wob += rnd(-15, 15); wob = clamp(wob, -30, 30); wobT = tt + 1 / 8; }
        const f = (fa + (fb - fa) * x) * Math.pow(2, wob / 1200);
        ph += (TAU * f) / sr;
        const e = Math.min(1, x / 0.08, (1 - x) / 0.25) * (1 - 0.2 * (0.5 + 0.5 * Math.sin(TAU * 11 * tt)));
        pd[i0 + i] += (Math.sin(ph) + db(-26) * Math.sin(2 * ph)) * e * 0.5;
      }
    });
    bufSrc(c, pb, 0, hp, 1);
    [[0.0, 0.13, 2300], [0.17, 0.4, 1700]].forEach(([s0, s1, f]) => A.noiseC(c, Math.max(0, s0 - 0.015), s1 - s0 + 0.015, 0.5 * db(-16) * 3, hp, { a: 0.012, flat: true, r: 0.05, filters: [{ type: 'bandpass', freq: f, Q: 6 }] }));
    // ③ soft inhale · ⑤ exhale
    A.noiseC(c, 1.1, 0.5, db(-30) * 6, hp, { a: 0.35, filters: [{ type: 'bandpass', freq: 900, Q: 0.8 }] });
    A.noiseC(c, 8.6, 0.8, db(-30) * 6, hp, { a: 0.12, filters: [{ type: 'bandpass', freq: 700, Q: 0.8 }] });
    // ④ hum.sea — formant hum /m/: glottal saw (LP 3 kHz, −12 dB/oct) + 3 % breath → nasal 270 Hz (BW 100), notch 1 kHz, weak 2.2 / 3.0 kHz → LP 2.5 kHz
    const hb = jsBuf(c, 12), hd = hb.getChannelData(0);
    let gph = 0, jit = 1, shim = 1;
    const i0 = Math.floor(HUM[0][1] * sr), i1 = Math.floor(HUM[HUM.length - 1][2] * sr);
    for (let i = i0; i < i1; i++) {
      const t = i / sr;
      let k = 0; for (let j = 0; j < HUM.length; j++) if (t >= HUM[j][1] - 0.03) k = j;
      const [m, t0, t1, nv] = HUM[k]; let f = mtof(m);
      if (k > 0 && t < t0 + 0.03) { const fp = mtof(HUM[k - 1][0]), x = clamp((t - (t0 - 0.03)) / 0.06, 0, 1); f = fp * Math.pow(f / fp, x * x * (3 - 2 * x)); }
      const age = t - t0, vd = clamp((age - nv) / 0.25, 0, 1) * 18; f *= Math.pow(2, (vd * Math.sin(TAU * 5.2 * age)) / 1200) * jit;
      const dt = f / sr; gph += dt; if (gph >= 1) { gph -= 1; jit = 1 + rnd(-0.004, 0.004); shim = 1 + rnd(-0.03, 0.03); }
      let env = Math.min(1, (t - HUM[0][1]) / 0.12);
      if (k === HUM.length - 1) env *= clamp(1 - (t - 7.1) / 1.3, 0, 1);
      if (t > t1 && k < HUM.length - 1) env *= 0.75;
      hd[i] = ((2 * gph - 1) - blep(gph, dt) + rnd(-1, 1) * 0.03) * env * shim * Math.pow(f / 329.6, 0.9);   // even loudness across the 270 Hz nasal resonance
    }
    const hs = c.createBufferSource(); hs.buffer = hb;
    const tilt = A.filter('lowpass', 3000, 0.5, null, c), nasal = A.filter('bandpass', 270, 2.7, null, c), f2 = A.filter('bandpass', 2200, 4, null, c), f3 = A.filter('bandpass', 3000, 5, null, c);
    const sum = c.createGain(), notch = A.filter('notch', 1000, 3, null, c), hlp = A.filter('lowpass', 2500, 0.7, null, c), hg = c.createGain(); hg.gain.value = 1.4;
    hs.connect(tilt); tilt.connect(nasal); tilt.connect(f2); tilt.connect(f3);
    nasal.connect(A.gainNode(2.2, sum, c)); f2.connect(A.gainNode(db(-18) * 4, sum, c)); f3.connect(A.gainNode(db(-24) * 4, sum, c)); tilt.connect(A.gainNode(0.12, sum, c));
    sum.connect(notch); notch.connect(hlp); hlp.connect(hg); hg.connect(hp); hs.start(0);
    const b = await renderOff(c); if (!b) return null;
    const hdx = b.getChannelData(0);
    scaleBuf(b, db(-6) / peakOf(b, Math.floor(1.6 * b.sampleRate), Math.floor(8.5 * b.sampleRate)));
    for (let i = 0; i < hdx.length; i++) if (hdx[i] > 0.98) hdx[i] = 0.98; else if (hdx[i] < -0.98) hdx[i] = -0.98;
    for (let i = hdx.length - Math.floor(0.05 * b.sampleRate); i < hdx.length; i++) hdx[i] *= (hdx.length - i) / (0.05 * b.sampleRate);
    addPink(hdx, b.sampleRate, -48);                // noise floor −48 dBFS, no background (§10.3)
    return b;
  }
  /** ringHaru7: 7 s of the bell that rang that night (1편 ringHaru — phone-internal, no closet reverb; ARCH §9 G23) */
  const MOM_MOTIF = [[0, 84], [1, 88], [2, 91], [3, 88], [4, 86], [5, 89], [6, 93]];
  async function renderRing7() {
    const c = offline(7); if (!c) return null;
    const hp = A.filter('highpass', 300, 0.7, null, c), lp = A.filter('lowpass', 9000, 0.7, null, c); hp.connect(lp); lp.connect(c.destination);
    const beat = 60 / 92;
    for (let bar = 0; bar < 2; bar++) MOM_MOTIF.forEach(([b, m], i) => {
      if (bar % 3 === 2 && i === MOM_MOTIF.length - 1) return;
      const t = 0.05 + bar * 8 * beat + b * beat; if (t > 6.9) return;
      const f = mtof(m - 5) * Math.pow(2, rnd(-35, 35) / 1200);
      A.oscC(c, 'sine', f, t, 0.5, 0.16, hp, { a: 0.002, decay: true });
      A.oscC(c, 'sine', f * 3.93, t, 0.12, 0.16 * 0.22, hp, { a: 0.001, decay: true });
      A.oscC(c, 'sine', f * 9.4, t, 0.04, 0.16 * 0.08, hp, { a: 0.001, decay: true });
    });
    const b = await renderOff(c); if (!b) return null;
    scaleBuf(b, 0.6 / peakOf(b));
    return b;
  }
  const RENDERS = { 'rec.uri': renderRecUri, 'vid.move': renderVidMove, 'vid.roof': renderVidRoof, 'hook.seahY': renderHook, 'ringHaru7': renderRing7 };
  const bufCache = {};
  const BUFDEF = {};                                 // ep3: defineBuffer(id | 'prefix.*', fn) — the fn owns its cache
  A.defineBuffer = function (id, fn) { if (!id || typeof fn !== 'function') return false; BUFDEF[id] = fn; return true; };
  function bufDef(id) {
    if (BUFDEF[id]) return BUFDEF[id];
    const k = Object.keys(BUFDEF).find((p) => p.slice(-2) === '.*' && id.indexOf(p.slice(0, -1)) === 0);
    return k ? BUFDEF[k] : null;
  }
  A.buffer = function (id) {
    if (id === 'jiminVM') return A.jiminVM();
    const bd = id && typeof id === 'string' ? bufDef(id) : null;
    if (bd) { try { return Promise.resolve(bd(id)).catch((e) => { console.error('[audio] buffer ' + id, e); return null; }); } catch (e) { console.error('[audio] buffer ' + id, e); return Promise.resolve(null); } }
    if (bufCache[id]) return bufCache[id];
    if (!RENDERS[id]) { if (/^v\d+_/.test(id)) return A.voice(id); warn('buffer: unknown id', id); return Promise.resolve(null); }
    bufCache[id] = RENDERS[id]().catch((e) => { console.error('[audio] render ' + id, e); return null; });
    return bufCache[id];
  };
  A.bufferReady = (id) => !!bufCache[id];

  /* =========================================================
   * Voices (§7.3, §0.2 T12, §9.7 TTS)
   * ========================================================= */
  const META = (id) => (G.AUDIO_META && G.AUDIO_META[id]) || {};
  const VOICE_DUR = { v2_kang_door: 4.97, v2_him_breath: 1.7, v2_jimin_vm: 14, v2_jimin_vm_a: 3.82, v2_jimin_vm_b: 9.06 };
  const playerName = () => { try { return String(G.NAME || (window.CONFIG && window.CONFIG.PLAYER_NAME) || '하루').trim() || '하루'; } catch (e) { return '하루'; } };
  /* formant fallback for '{N} 씨가' — 1편 포먼트 표 (js/data/recordings.js FORM), voiced, female ~240 Hz */
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const VMAP = { 'ㅏ': 'ㅏ', 'ㅑ': 'ㅏ', 'ㅘ': 'ㅏ', 'ㅓ': 'ㅓ', 'ㅕ': 'ㅓ', 'ㅝ': 'ㅓ', 'ㅗ': 'ㅗ', 'ㅛ': 'ㅗ', 'ㅜ': 'ㅜ', 'ㅠ': 'ㅜ', 'ㅡ': 'ㅡ', 'ㅣ': 'ㅣ', 'ㅟ': 'ㅣ', 'ㅢ': 'ㅣ', 'ㅐ': 'ㅐ', 'ㅒ': 'ㅐ', 'ㅔ': 'ㅐ', 'ㅖ': 'ㅐ', 'ㅙ': 'ㅐ', 'ㅚ': 'ㅐ', 'ㅞ': 'ㅐ' };
  const FORM = { 'ㅏ': [850, 1300, 2700], 'ㅓ': [650, 1100, 2600], 'ㅗ': [450, 850, 2600], 'ㅜ': [350, 950, 2400], 'ㅡ': [400, 1500, 2600], 'ㅣ': [320, 2500, 3200], 'ㅐ': [500, 2000, 2700] };
  function BQ(type, f, Q, sr) {
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * (Q || 0.707));
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    b0 /= a0; b1 /= a0; b2 /= a0; const A1 = a1 / a0, A2 = a2 / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function formantPhrase(text, sr) {
    const syl = Array.from(text).filter((ch) => ch >= '가' && ch <= '힣');
    const per = 0.135, total = syl.length * per + 0.12, n = Math.ceil(total * sr), out = new Float32Array(n);
    let ph = 0;
    const hiss = BQ('highpass', 3500, 0.8, sr), hissB = BQ('bandpass', 5200, 1.2, sr), post = BQ('highpass', 100, 0.7, sr), post2 = BQ('lowpass', 8000, 0.7, sr);
    syl.forEach((ch, k) => {
      const code = ch.charCodeAt(0) - 0xac00, cho = CHO[Math.floor(code / 588)], jung = JUNG[Math.floor((code % 588) / 28)], jong = code % 28;
      const F = FORM[VMAP[jung] || 'ㅓ'], t0 = k * per + 0.02;
      const fric = 'ㅅㅆㅈㅉㅊ'.includes(cho) ? 0.055 : 'ㅎ'.includes(cho) ? 0.035 : 'ㄱㄲㅋㄷㄸㅌㅂㅃㅍ'.includes(cho) ? 0.012 : 0;
      const nasal = 'ㄴㅁ'.includes(cho) ? 0.03 : 0;
      const f1 = BQ('bandpass', F[0], 5, sr), f2 = BQ('bandpass', F[1], 7, sr), f3 = BQ('bandpass', F[2], 9, sr), nm = BQ('lowpass', 350, 0.7, sr);
      const vEnd = per * (jong ? 0.82 : 0.95), i0 = Math.floor(t0 * sr), len = Math.floor((vEnd + 0.03) * sr);
      for (let i = 0; i < len && i0 + i < n; i++) {
        const t = i / sr, gt = t0 + t;
        const f0 = 248 - 46 * (gt / total) + (k === syl.length - 2 ? 10 * Math.sin(Math.PI * clamp(t / per, 0, 1)) : 0);
        const dt = f0 / sr; ph += dt; if (ph >= 1) ph -= 1;
        const src = (2 * ph - 1) - blep(ph, dt), w = Math.random() * 2 - 1;
        let v = 0;
        if (t < fric) { const e = Math.min(1, t / 0.006); v += (cho === 'ㅎ' ? (f1(w) + f2(w) * 0.7) * 0.6 : hissB(hiss(w)) * 0.9) * e; }
        else if (t < fric + nasal) { v += nm(src) * 0.5 * Math.min(1, (t - fric) / 0.01); }
        const tv = t - fric - nasal;
        if (tv >= 0 && t < vEnd) { const e = Math.min(1, tv / 0.015) * Math.min(1, (vEnd - t) / 0.025); const s = src * 0.9 + w * 0.04; v += (f1(s) * 1.0 + f2(s) * 0.75 + f3(s) * 0.35) * e * 1.6; }
        if (jong && t >= vEnd) v += nm(src) * 0.35 * Math.max(0, 1 - (t - vEnd) / 0.03);
        out[i0 + i] += v;
      }
    });
    for (let i = 0; i < n; i++) out[i] = post2(post(out[i]));
    return out;
  }
  const vmCache = {};
  /* The v2_jimin_vm* TTS files sit ≈ 10 dB under the dialogue target once they pass the phone chain at media volume 60
     (−27.6 LUFS measured vs §10 H −16 / Kang through the door −17.2). G.media applies this trim on the phone route only
     (never on 2층_스피커 — C2 calibration), so the voicemail lands ≈ −17.5 LUFS; the hook voice (hook.seahY, ≈ −18.4) carries none. */
  const VM_PHONE_TRIM_DB = 10;
  const tagVM = (b) => { if (b && typeof b === 'object') { try { b.mediaTrimDb = VM_PHONE_TRIM_DB; } catch (e) {} } return b; };
  A.jiminVM = function () {
    const name = playerName();
    if (name === '하루') return Promise.resolve(A.voice('v2_jimin_vm')).then(tagVM);
    if (vmCache[name]) return vmCache[name];
    if (!A.ctx) return Promise.resolve(null);       // TTS decode needs the context (after the start tap) — don't cache a miss
    vmCache[name] = Promise.all([A.voice('v2_jimin_vm_a'), A.voice('v2_jimin_vm_b')]).then(([a, b]) => {
      if (!a || !b || !A.ctx) return null;
      const sr = a.sampleRate, ad = a.getChannelData(0), bd = b.getChannelData(0);
      const vm = META('v2_jimin_vm'), nameAt = (vm.name_part_s && vm.name_part_s[0]) || 4.4;
      const nm = formantPhrase(name + ' 씨가', sr);
      // level-match the synthetic words to the speech around them
      const ra = rmsOf(ad, Math.floor(0.6 * sr), Math.floor(3.6 * sr)) || 0.05, rn = rmsOf(nm) || 1;
      const gN = (ra / rn) * 0.9;
      const ov = 0.12, bAt = nameAt + nm.length / sr - ov, len = Math.ceil(Math.max(14, bAt + b.duration) * sr);
      const buf = A.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      for (let i = 0; i < ad.length && i < len; i++) d[i] += ad[i];
      const ni = Math.floor(nameAt * sr), fade = Math.floor(ov * sr);
      for (let i = 0; i < nm.length && ni + i < len; i++) { const e = Math.min(1, i / (0.01 * sr), (nm.length - i) / fade); d[ni + i] += nm[i] * gN * e; }
      const bi = Math.floor(bAt * sr);
      for (let i = 0; i < bd.length && bi + i < len; i++) d[bi + i] += bd[i] * Math.min(1, i / fade);
      return tagVM(buf);
    }).catch(() => null);
    return vmCache[name];
  };
  /** spatial one-shot voice (B20 Kang 0° .5 m via door · B14 breath 0° .3 m via door → fallback breath.out) */
  A.playVoice = function (id, o) {
    o = o || {};
    const dur = META(id).dur_s || VOICE_DUR[id] || 3;
    let ended = false, timer = null, src = null;
    const end = () => { if (ended) return; ended = true; clearTimeout(timer); try { o.onEnd && o.onEnd(); } catch (e) { console.error(e); } };
    const h = { id, duration: dur, stopped: false,
      stop() { h.stopped = true; try { src && src.stop(); } catch (e) {} clearTimeout(timer); },
      playing() { return !ended && !h.stopped; } };
    const fallback = () => {
      if (h.stopped) return;
      if (id === 'v2_him_breath' && ok()) breathOut({ dist: o.dist || 0.3, gainDb: o.gainDb });
      timer = setTimeout(end, (id === 'v2_him_breath' ? 1.6 : dur) * 1000);
    };
    if (!ok()) { fallback(); return h; }
    A.voice(id).then((buf) => {
      if (h.stopped) return;
      if (!buf || !ok()) { fallback(); return; }
      h.duration = buf.duration;
      const via = !o.via || o.via === 'door' ? 'doorVoice' : o.via;
      const out = A.at(o.az != null ? o.az : 0, { dist: o.dist != null ? o.dist : 0.5, el: o.el || 0, via, ir: o.ir || (via === 'doorVoice' ? 'irRoof' : null), wet: o.wet != null ? o.wet : 0.25, bus: 'voice', life: buf.duration + 5 });
      const d = buf.getChannelData(0); let pk = 1e-6; for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
      const g = db(o.gainDb || 0) * CAL.tts * (0.5 / pk) * (via === 'doorVoice' ? db(6) : 1);
      src = A.ctx.createBufferSource(); src.buffer = buf; const gg = A.gainNode(g, out || A.bus('voice')); src.connect(gg);
      src.onended = end; src.start(now() + 0.02); A.stats.sources++;
      timer = setTimeout(end, (buf.duration + 1.5) * 1000);   // safety if onended never fires (suspended ctx)
    });
    return h;
  };

  /* =========================================================
   * Cold-open alarm (§7.2 E musicbox.box15): rec.uri → phone chain at 15 % → box LP 1.1 kHz → door →
   * 0° · 1.3 m · −40° (floor) · 40 s period. stage 'doorOpen' lifts the door, 'inHand' lifts the box and moves it to the hand.
   * ========================================================= */
  A.box15 = {
    start() {
      const nil = { stage() {}, cut() {}, stop() {} };
      if (!ok()) return nil;
      const c = A.ctx;
      const sp = A.at(0, { dist: 1.3, el: -40, via: 'door', ir: 'irRoof', wet: 0.15, bus: 'world', life: Infinity });
      const boxLP = A.filter('lowpass', 1100, 0.7); boxLP.connect(sp || A.bus('world'));
      const toBox = c.createGain(); toBox.gain.value = 1; toBox.connect(boxLP);
      const hand = c.createGain(); hand.gain.value = 0; hand.connect(A.bus('sfx'));
      const hp = A.filter('highpass', 450, 0.7), pk = A.filter('peaking', 2800, 1, 5), lp = A.filter('lowpass', 9000, 0.7);
      const mg = c.createGain(); mg.gain.value = Math.pow(0.15, 1.6) * CAL.box;
      hp.connect(pk); pk.connect(lp); lp.connect(mg); mg.connect(toBox); mg.connect(hand);
      const h = { stopped: false, srcs: [], next: 0, off: null, stageName: 'closed' };
      A.buffer('rec.uri').then((buf) => {
        if (h.stopped || !buf || !ok()) return;
        h.next = now() + 0.05;
        h.off = A.every((t) => {
          if (h.stopped) return;
          if (h.next < t + 0.5) { const s = c.createBufferSource(); s.buffer = buf; s.connect(hp); s.start(h.next); h.srcs.push(s); A.stats.sources++; h.next += 40; if (h.srcs.length > 3) h.srcs.shift(); }
        });
      });
      h.stage = (s) => {
        if (!ok() || h.stopped) return; h.stageName = s; const t = now();
        if (s === 'doorOpen') { A.doorOpen('hold'); }
        else if (s === 'inHand') {
          boxLP.frequency.setTargetAtTime(16000, t, 0.1);
          toBox.gain.setTargetAtTime(0, t + 0.05, 0.1); hand.gain.setTargetAtTime(db(CAL.boxHand), t + 0.05, 0.1);
        } else if (s === 'closed') { boxLP.frequency.setTargetAtTime(1100, t, 0.1); toBox.gain.setTargetAtTime(1, t, 0.1); hand.gain.setTargetAtTime(0, t, 0.1); }
      };
      const kill = (fade) => {
        if (h.stopped) return; h.stopped = true; if (h.off) h.off();
        const t = now(); mg.gain.cancelScheduledValues(t); mg.gain.setValueAtTime(mg.gain.value, t); mg.gain.linearRampToValueAtTime(0, t + fade);
        setTimeout(() => { h.srcs.forEach((s) => { try { s.stop(); } catch (e) {} }); if (sp) sp.dispose(); }, fade * 1000 + 200);
      };
      h.cut = () => kill(0.03);                    // [해제 ›] — 30 ms cut mid-bar
      h.stop = () => kill(0.3);
      return h;
    },
  };

  def('box15', () => A.box15.start());

  /* =========================================================
   * Micro ambience m.* (§6.1.6) — information 0; never 50–80° or 105–125°
   * ========================================================= */
  const safeAz = (az, lo, hi) => { let a = az != null ? wrap(az) : rnd(lo, hi); if (a >= 50 && a <= 80) a = a < 65 ? 45 : 85; if (a >= 105 && a <= 125) a = a < 115 ? 100 : 130; return a; };
  def('m.gust', (o) => {
    const W = A.ambient.roofWind;
    if (W && W.level > 0) W.gust(!!o.strong);
    const src = A.at(90, { dist: 1.5, via: 'inRoom', bus: 'amb', life: 4, quiet: true }); if (!src) return;
    for (let i = 0, n = rndi(1, 2); i < n; i++) { const t = now() + rnd(0.5, 1.4); A.noise(t, 0.012, 0.5, src, { filters: [{ type: 'bandpass', freq: 1400, Q: 3 }] }); A.osc('sine', 260, t, 0.05, 0.12, src, { a: 0.001, decay: true }); }
  });
  def('m.carFar', (o) => {
    const src = A.at(safeAz(o.az, 150, 250), { dist: 60, el: -40, via: 'wall', bus: 'amb', life: 6, noFacing: true }); if (!src) return;
    const t = now() + 0.05, lp = A.filter('lowpass', 300, 0.7); lp.connect(src);
    A.noise(t, 4, 6, lp, { brown: true, a: 2, filters: [{ type: 'lowpass', freq: 300 }] });
  });
  def('m.pipe', (o) => {
    const src = A.at(safeAz(o.az, 200, 330), { dist: 2, via: 'inRoom', bus: 'amb', life: 4, quiet: true }); if (!src) return;
    const lp = A.filter('lowpass', 1200, 0.7); lp.connect(src); let t = now() + 0.05;
    for (let i = 0, n = rndi(2, 4); i < n; i++) { A.osc('sine', rnd(1600, 2200), t, 0.04, 0.12, lp, { a: 0.001, decay: true }); t += rnd(0.5, 1.1); }
  });
  def('m.tarp', (o) => {
    const az = o.az != null ? o.az : (Math.random() < 0.5 ? rnd(150, 170) : rnd(300, 340));
    const c = A.ctx, src = A.at(safeAz(az), { dist: 5, via: 'window', bus: 'amb', life: 3, quiet: true }); if (!src) return;
    const t = now() + 0.05, am = c.createGain(); am.gain.value = 0.5; am.connect(src);
    const os = c.createOscillator(); os.frequency.value = 20; const od = A.gainNode(0.5, am.gain); os.connect(od); os.start(t); os.stop(t + 0.9);
    A.noise(t, 0.8, 1.8, am, { a: 0.1, filters: [{ type: 'bandpass', freq: 600, Q: 1 }] });
  });
  def('m.roomTick', (o) => {
    const src = A.at(safeAz(o.az, 180, 300), { dist: 2, via: 'inRoom', bus: 'amb', life: 2, quiet: true }); if (!src) return;
    A.noise(now() + 0.02, 0.01, 3.5, src, { filters: [{ type: 'bandpass', freq: 2000, Q: 6 }] });
  });

  /* =========================================================
   * init / ready hooks · restore · preparation
   * ========================================================= */
  A.onInit(() => {
    const on = (ev, fn) => { try { G.bus && G.bus.on && G.bus.on(ev, fn); } catch (e) {} };
    let lastStep = null;
    const step = (v) => (v >= 90 ? 2 : v >= 50 ? 1 : 0);
    on('media:play', (p) => { if (p && p.target === 'bt') { arc(115); lastStep = step(gvar('btVol') || 0); } });
    on('media:vol', (p) => { if (!p || p.target !== 'bt') return; const s = step(p.v || 0); if (lastStep != null && s !== lastStep) { try { const st = G.media && G.media.state && G.media.state(); if (!st || (st.playing && st.target === 'bt')) arc(115); } catch (e) {} } lastStep = s; });
    on('var:snow', (p) => { const W = A.ambient.roofWind; if (W && W.setSnow) W.setSnow(p && p.v != null ? p.v : gvar('snow')); });
    on('users:switched', (p) => { if (!p) return; if (p.to === 'dash') A.droneDetune(-100, 2); else if (p.from === 'dash') A.droneDetune(0, 4); });
    on('flag:END', () => { if (!prepFn) A.buffer('hook.seahY'); });    // ep3 (definePrepare): no ep2 hook render
    on('settings', () => {                         // 덜 무섭게 toggled live: drill −6 dB, no heartbeat (§6.1.8)
      if (D && D.state === 'run' && ok()) D.n.master.gain.setTargetAtTime(CAL.drill * (A.less() ? db(-6) : 1), now(), 0.3);
      if (A.less() && HB) A.heartbeat(false);
    });
  });
  /* ep3: definePrepare(fn) replaces the ep2 list below (no v2_* fetch, no ep2 render, no flag:END hook render);
     defineRestore(fn) replaces the ep2 restore (house layers live in the episode's own module) */
  A.definePrepare = function (fn) { prepFn = typeof fn === 'function' ? fn : null; return !!prepFn; };
  A.defineRestore = function (fn) { restoreFn = typeof fn === 'function' ? fn : null; return !!restoreFn; };
  A.restore = function () {
    if (restoreFn) { if (ok()) { try { restoreFn(); } catch (e) { console.error('[audio] restore', e); } } return; }
    if (!ok() || !flag('M0')) return;
    const a = A._au(), hook = flag('HOOK') && !flag('hookDone');
    if (a.amb) Object.keys(a.amb).forEach((id) => { const lv = a.amb[id]; if (!(lv > 0)) return; if (hook && id !== 'room601') return; A.amb(id, lv, { fade: 1.2, warm: id === 'room601' ? !!a.warm : undefined, restore: true }); });
    if (!prepFn && !hook && a.gsm && a.gsm.on && a.gsm.p > 0 && !GSM.node) { GSM.started = true; GSM.base = a.gsm.p; gsmBuild(); gsmRamp(GSM.base, 1500); }
    if (gvar('user') === 'dash') A.droneDetune(-100, 0.1);
  };
  const idle = (fn, ms) => { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: ms || 3000 }); else setTimeout(fn, ms ? Math.min(ms, 2000) : 2000); };
  let prepped = false;
  A.prepare = function () {
    if (prepped || !A.ctx) return; prepped = true;
    if (prepFn) { try { prepFn(); } catch (e) { console.error('[audio] prepare', e); } return; }
    setTimeout(() => { A.buffer('rec.uri').then(() => idle(() => A.buffer('vid.move').then(() => idle(() => A.buffer('vid.roof').then(() => idle(() => A.buffer('ringHaru7'))))))); }, 30);
    idle(() => { A.voice('v2_kang_door'); A.voice('v2_him_breath'); A.jiminVM(); }, 4000);
    if (flag('END')) idle(() => A.buffer('hook.seahY'), 6000);
  };
  A.onReady(() => { A.restore(); A.prepare(); });

  /* ---------------- DEBUG helpers (window.haru.audio) ---------------- */
  if (G.DEBUG) {
    window.haru = window.haru || {};
    window.haru.audio = {
      unlock: () => A.unlock(), cue: (id, o) => A.cue(id, o), sub: (id, o) => A.sub(id, o), meter: (ms) => A.meter(ms),
      stats: () => Object.assign({ live: live.size, yaw, openness, gsm: GSM.base, drill: drill.playing(), ambient: Object.keys(A.ambient) }, A.stats),
      buffer: (id) => A.buffer(id), play: (id, o) => A.buffer(id).then((b) => A.playBuffer(b, Object.assign({ bus: 'music' }, o || {}))),
      amb: (id, on) => A.amb(id, on), gsm: A.gsmTank, drill, box15: () => A.box15.start(), cal: CAL,
      drillNodes: () => (D ? D.n : null),          // level probes (QA: §7.1.6 drill peak check)
    };
  }
})();
