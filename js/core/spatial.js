/* =========================================================
 * Spatial audio + extended cue library (design §7).
 * World azimuths: door 0°, bed 90°, window 180°, wardrobe 270° (turning right).
 * G.audio.at(az, {dist, closet, life}) -> input node for a room-anchored 3D source.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const A = G.audio;
  const S = A.sfx;
  let yaw = 0; // listener yaw (deg)
  const live = new Set();
  let closetIR = null;

  function ctx() { return A.ctx; }
  function ok() { return A.ok && A.ok(); }
  function now() { return A.ctx.currentTime; }
  function speaker() { return G.settings.audioMode === 'speaker'; }

  function makeIR(sec, decay, bright) {
    const c = ctx(), len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * (bright || 0.4); d[i] = lp * Math.pow(1 - i / len, decay); }
    }
    return b;
  }
  function closet() {
    if (!closetIR) {
      closetIR = ctx().createConvolver(); closetIR.buffer = makeIR(0.25, 3, 0.3);
      const g = ctx().createGain(); g.gain.value = 0.9; closetIR.connect(g); g.connect(A.bus('sfx'));
    }
    return closetIR;
  }

  /* ---------- 3D source ---------- */
  function relAz(az) { let r = (((az - yaw) % 360) + 540) % 360 - 180; return r; } // -180..180, 0 = front
  function place(e) {
    const c = ctx(); const r = (relAz(e.az) * Math.PI) / 180; const d = e.dist;
    const facing = Math.max(0, Math.cos(r));
    const t = c.currentTime;
    if (e.panner.positionX) {
      e.panner.positionX.setTargetAtTime(Math.sin(r) * d, t, 0.05);
      e.panner.positionZ.setTargetAtTime(-Math.cos(r) * d, t, 0.05);
      e.panner.positionY.setTargetAtTime(0, t, 0.05);
    } else if (e.panner.setPosition) e.panner.setPosition(Math.sin(r) * d, 0, -Math.cos(r) * d);
    else if (e.panner.pan) e.panner.pan.setTargetAtTime(Math.sin(r) * 0.9, t, 0.05);
    if (e.lp) e.lp.frequency.setTargetAtTime((e.lpBase || 700) + (e.lpRange || 3500) * facing, t, 0.08);
    if (e.fg) e.fg.gain.setTargetAtTime(0.35 + 0.65 * facing, t, 0.08);
  }
  A.at = function (az, o) {
    o = o || {};
    if (!ok()) return null;
    const c = ctx();
    const input = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
    const fg = c.createGain();
    let panner;
    if (speaker() || !c.createPanner) { panner = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); }
    else {
      panner = c.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 1; panner.rolloffFactor = 1.2; panner.maxDistance = 50;
    }
    input.connect(lp); lp.connect(fg); fg.connect(panner); panner.connect(A.bus(o.bus || 'sfx'));
    if (o.closet) { const s = c.createGain(); s.gain.value = o.closet === true ? 0.5 : o.closet; fg.connect(s); s.connect(closet()); }
    if (o.room !== false) { const s2 = c.createGain(); s2.gain.value = o.reverb != null ? o.reverb : 0.18; fg.connect(s2); s2.connect(A.reverb); }
    const e = { az, dist: o.dist || 1.6, panner, lp: o.noFacing ? null : lp, fg: o.noFacing ? null : fg, lpBase: o.lpBase, lpRange: o.lpRange, input };
    if (o.noFacing) lp.frequency.value = o.lp || 20000;
    live.add(e); place(e);
    const life = o.life != null ? o.life : 15;
    if (life !== Infinity) setTimeout(() => { live.delete(e); try { input.disconnect(); } catch (er) {} }, life * 1000);
    input.entry = e;
    input.move = (az2, sec) => { // glide azimuth over time
      const a0 = e.az, steps = Math.max(1, Math.round((sec || 1) * 20));
      let k = 0; const iv = setInterval(() => { k++; e.az = a0 + ((az2 - a0) * k) / steps; place(e); if (k >= steps) clearInterval(iv); }, 50);
    };
    input.setDist = (d) => { e.dist = d; place(e); };
    input.dispose = () => { live.delete(e); try { input.disconnect(); } catch (er) {} };
    return input;
  };
  A.setYaw = function (deg) { yaw = deg; if (!ok()) return; live.forEach(place); G.bus.emit('yaw', yaw); };
  A.getYaw = () => yaw;
  A.facing = (az) => Math.cos((relAz(az) * Math.PI) / 180);

  /* ---------- master utilities ---------- */
  A.setMono = function (on) {
    A._mono = !!on;
    if (ok()) {
      const t = now();
      A.stereoPath.gain.setTargetAtTime(on ? 0 : 1, t, 0.01);
      A.monoPath.gain.setTargetAtTime(on ? 1 : 0, t, 0.01);
      A.osc('sine', 60, t, 0.03, 0.05, A.bus('ui'), { a: 0.001, decay: true });
    }
    G.state.vars.mono = !!on; G.save();
    G.bus.emit('mono', !!on);
  };
  A.isMono = () => !!(A._mono || G.state.vars.mono);
  A.silenceDrop = function (ms) {
    if (!ok()) return; const t = now(); const g = A.master.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.012);
    g.setTargetAtTime(A.enabled ? A.volume : 0, t + (ms || 80) / 1000, 0.5);
  };
  A.fridge = function (on) { if (!ok() || !A._hum) return; const t = now(); A._hum[0].gain.setTargetAtTime(on ? 0.012 : 0, t, 0.1); A._hum[1].gain.setTargetAtTime(on ? 0.006 : 0, t, 0.1); };
  A.hearingLoss = function (sec) {
    if (!ok()) return; const f = A.hearing.frequency; const t = now();
    f.cancelScheduledValues(t); f.setValueAtTime(900, t); f.exponentialRampToValueAtTime(20000, t + (sec || 4));
  };

  /* ---------- message tones ---------- */
  S.msgFriend = function () { S.msgIn(); };
  S.msgMom = function () { if (!ok()) return; const t = now(); [76, 79, 84].forEach((m, i) => mar(t + i * 0.11, m + 0, 0.12, A.bus('ui'))); };
  S.msgHim = function () {
    if (!ok()) return; const c = ctx(), t = now() + 0.13;
    // 120 ms reverse-noise pre-roll
    const n = A.noise(t - 0.13, 0.13, 0.05, A.bus('ui'), { a: 0.12, filters: [{ type: 'bandpass', freq: 2500, Q: 0.7 }] });
    [[831, 0], [1245, 0.1]].forEach(([f, dt]) => {
      const o = c.createOscillator(); o.frequency.value = f;
      const v = c.createOscillator(); v.frequency.value = 6.5; const vg = c.createGain(); vg.gain.value = f * 0.007; v.connect(vg); vg.connect(o.frequency);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(0.13, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.32);
      o.connect(g); g.connect(A.bus('ui')); o.start(t + dt); v.start(t + dt); o.stop(t + dt + 0.4); v.stop(t + dt + 0.4);
    });
    if (G.settings.vibration && navigator.vibrate) try { navigator.vibrate([60, 60, 60]); } catch (e) {}
  };
  S.msgAlbum = function () { if (!ok()) return; const t = now(); A.osc('sine', 1568, t, 0.6, 0.09, A.bus('ui'), { decay: true, send: 0.2 }); A.osc('sine', 2093, t + 0.09, 0.7, 0.07, A.bus('ui'), { decay: true, send: 0.2 }); };
  S.tone = function (kind) { ({ him: S.msgHim, mom: S.msgMom, friend: S.msgFriend, album: S.msgAlbum }[kind] || S.notify)(); };

  function mar(t, midi, vel, out, detune) {
    const f = A.mtof(midi);
    A.osc('sine', f, t, 0.5, vel, out, { a: 0.002, decay: true, detune: detune || 0, send: 0.05 });
    A.osc('sine', f * 3.93, t, 0.12, vel * 0.22, out, { a: 0.001, decay: true });
    A.osc('sine', f * 9.4, t, 0.04, vel * 0.08, out, { a: 0.001, decay: true });
  }

  /* ---------- door lock ---------- */
  A.DOORKEY_HZ = { '1': 523.25, '2': 587.33, '3': 659.25, '4': 698.46, '5': 783.99, '6': 880, '7': 987.77, '8': 1046.5, '9': 1174.66, '0': 1318.51 };
  A.doorKey = function (d, o) {
    o = o || {}; if (!ok()) return; const f = A.DOORKEY_HZ[String(d)]; if (!f) return;
    const t = now();
    let out = A.bus('sfx');
    if (o.outside) { const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; const g = ctx().createGain(); g.gain.value = 0.7; lp.connect(g); g.connect(out); const s = ctx().createGain(); s.gain.value = 0.4; lp.connect(s); s.connect(A.reverb); out = lp; }
    A.osc('sine', f, t, 0.08, 0.16, out, { a: 0.003, r: 0.01 });
    A.osc('sine', f * 2, t, 0.08, 0.04, out, { a: 0.003, r: 0.01 });
    A.noise(t, 0.003, 0.08, out, { filters: [{ type: 'highpass', freq: 3000 }] });
  };
  function arp(midis, step, out, type) { const t = now(); midis.forEach((m, i) => A.osc(type || 'square', A.mtof(m), t + i * step, step + 0.03, 0.045, out, { a: 0.002, r: 0.01, filter: { freq: 5000 } })); }
  S.doorlockOpen = function () {
    if (!ok()) return; arp([84, 88, 91, 96], 0.04, A.bus('sfx'));
    setTimeout(() => { const t = now(); A.osc('sawtooth', 210, t, 0.45, 0.06, A.bus('sfx'), { a: 0.02, filter: { freq: 900, Q: 3 } }); A.noise(t + 0.45, 0.05, 0.4, A.bus('sfx'), { filters: [{ type: 'bandpass', freq: 1600, Q: 2 }] }); }, 220);
  };
  S.doorlockAutolock = function () { if (!ok()) return; arp([96, 91, 88, 84], 0.05, A.bus('sfx')); setTimeout(() => { const t = now(); A.noise(t, 0.05, 0.4, A.bus('sfx'), { filters: [{ type: 'bandpass', freq: 1600, Q: 2 }] }); }, 260); };
  S.doorlockAdmin = function () {
    if (!ok()) return; const t = now();
    A.osc('square', 2200, t, 0.35, 0.035, A.bus('sfx'), { a: 0.002, r: 0.01, filter: { freq: 5000 } });
    A.osc('square', 2200, t + 0.5, 0.35, 0.035, A.bus('sfx'), { a: 0.002, r: 0.01, filter: { freq: 5000 } });
    [84, 81, 77].forEach((m, i) => A.osc('square', A.mtof(m), t + 1.0 + i * 0.12, 0.12, 0.04, A.bus('sfx'), { a: 0.002, r: 0.01, filter: { freq: 5000 } }));
  };
  S.alarmTrap = function (sec) {
    if (!ok()) return; const t = now(); sec = sec || 3;
    const ws = ctx().createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); } ws.curve = curve;
    const g = ctx().createGain(); g.gain.value = 0.12; ws.connect(g); g.connect(A.bus('sfx'));
    for (let k = 0; k < sec / 0.25; k++) A.osc('square', k % 2 ? 3100 : 2400, t + k * 0.25, 0.24, 0.5, ws, { a: 0.002, r: 0.01 });
  };

  /* ---------- UI-ish ---------- */
  S.mfaAlert = function () { if (!ok()) return; const t = now(); [1300, 1600, 2000].forEach((f, i) => A.osc('sine', f, t + i * 0.075, 0.07, 0.12, A.bus('ui'), { a: 0.003, r: 0.01 })); };
  S.batteryLow = function (glitchy) { if (!ok()) return; const t = now(); A.osc('sine', 880, t, 0.18, 0.1, A.bus('ui')); A.osc('sine', 659, t + 0.2, 0.3, 0.1, A.bus('ui')); if (glitchy) setTimeout(() => S.glitch(), 300); };
  S.castEnd = function () { if (!ok()) return; const t = now(); const o = A.osc('sine', 1200, t, 0.18, 0.1, A.bus('ui'), { a: 0.005 }); o.frequency.exponentialRampToValueAtTime(400, t + 0.18); A.noise(t + 0.18, 0.01, 0.3, A.bus('ui'), { filters: [{ type: 'highpass', freq: 2000 }] }); };
  S.keyErase = function () { if (!ok()) return; const t = now(); A.noise(t, 0.012, 0.12, A.bus('ui'), { filters: [{ type: 'bandpass', freq: 4000, Q: 1 }] }); A.osc('sine', 180, t, 0.03, 0.05, A.bus('ui'), { a: 0.001, decay: true }); };

  /* ---------- room / diegetic (az-aware) ---------- */
  function out3d(o, def) { o = o || {}; const az = o.az != null ? o.az : def; if (az == null) return A.bus('sfx'); return A.at(az, { closet: o.closet, dist: o.dist, life: o.life || 12 }) || A.bus('sfx'); }
  S.knock = function (n, o) {
    o = o || {}; if (!ok()) return;
    n = n || 3; let t = now() + 0.02;
    const where = o.where || (o.az != null ? 'inside' : 'player');
    const out = where === 'behind' ? out3d({ az: (yaw + 180) % 360 }) : where === 'inside' ? out3d({ az: o.az != null ? o.az : 270, closet: 0.5 }) : (o.az != null ? out3d(o) : A.bus('sfx'));
    let lp = null;
    if (where === 'inside' || where === 'behind') { lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = where === 'inside' ? 1400 : 1600; lp.connect(out); }
    const dest = lp || out;
    const gap = o.gap || 0.42, vol = (o.vol || 0.9) * (where === 'player' ? 1.6 : 1);
    const f1 = where === 'player' ? 230 : 182, f2 = where === 'player' ? 520 : 410;
    for (let i = 0; i < n; i++) {
      const v = vol * (0.85 + Math.random() * 0.3);
      A.osc('sine', f1, t, 0.09, v * 0.6, dest, { a: 0.001, decay: true });
      A.osc('sine', f2, t, 0.06, v * 0.25, dest, { a: 0.001, decay: true });
      A.noise(t, 0.012, v * 0.5, dest, { filters: [{ type: 'bandpass', freq: 900, Q: 2 }] });
      t += gap * (0.85 + Math.random() * 0.3);
    }
  };
  S.scratchAt = function (dur, o) { o = o || {}; if (!ok()) return; const out = out3d(o, 270); const t = now(); dur = dur || 2.2; for (let i = 0; i < dur / 0.45; i++) A.noise(t + i * 0.45 + Math.random() * 0.1, 0.35, 0.18, out, { a: 0.06, filters: [{ type: 'bandpass', freq: 2200 + Math.random() * 800, to: 1200, Q: 6 }, { type: 'lowpass', freq: 2000 }] }); };
  S.rackFall = function (o) { if (!ok()) return; const out = out3d(o, 270); const t = now(); [0, 0.14, 0.31].forEach((dt) => { A.noise(t + dt, 0.02, 0.5, out, { filters: [{ type: 'highpass', freq: 800 }] }); [1200, 2700, 4100].forEach((f) => A.osc('sine', f * (0.97 + Math.random() * 0.06), t + dt, 0.3, 0.05, out, { a: 0.001, decay: true })); }); const th = A.osc('sine', 70, t + 0.4, 0.4, 0.5, out, { a: 0.002, decay: true }); th.frequency.exponentialRampToValueAtTime(40, t + 0.7); };
  S.bedCreak = function (o) { if (!ok()) return; const out = out3d(o, 90); const t = now(); const os = A.osc('sine', 310, t, 0.5, 0.06, out, { a: 0.05 }); os.frequency.linearRampToValueAtTime(280, t + 0.5); A.noise(t, 0.5, 0.06, out, { a: 0.08, filters: [{ type: 'bandpass', freq: 1200, Q: 3 }] }); };
  S.footsteps = function (n, o) {
    o = o || {}; if (!ok()) return; n = n || 4;
    const az0 = o.az != null ? o.az : 270, az1 = o.toAz != null ? o.toAz : az0;
    const src = A.at(az0, { dist: o.dist || 2.2, life: n * (o.gap || 1.1) + 3 });
    if (!src) return;
    if (az1 !== az0) src.move(az1, n * (o.gap || 1.1));
    if (o.toDist) { const d0 = o.dist || 2.2; let k = 0; const iv = setInterval(() => { k++; src.setDist(d0 + ((o.toDist - d0) * k) / n); if (k >= n) clearInterval(iv); }, (o.gap || 1.1) * 1000); }
    let t = now() + 0.05;
    for (let i = 0; i < n; i++) {
      const v = (o.vol || 0.7) * (0.85 + Math.random() * 0.3);
      const h = A.osc('sine', 70, t, 0.05, v * 0.7, src, { a: 0.002, decay: true }); h.frequency.exponentialRampToValueAtTime(45, t + 0.05);
      A.noise(t, 0.04, v * 0.35, src, { filters: [{ type: 'lowpass', freq: 300 }] });
      A.noise(t + 0.05, 0.06, v * 0.08, src, { filters: [{ type: 'bandpass', freq: 900, Q: 1 }] });
      if (Math.random() < 0.25) A.osc('sine', 900 + Math.random() * 300, t + 0.08, 0.15, 0.01, src, { a: 0.03 });
      t += (o.gap || 1.1) * (0.88 + Math.random() * 0.24);
    }
  };
  S.breathNear = function (sec, o) {
    if (typeof sec === 'object') { o = sec; sec = o.sec; }
    o = o || {}; if (!ok()) return; sec = typeof sec === 'number' ? sec : 6; const src = A.at(o.az != null ? o.az : (yaw + 300) % 360, { dist: o.dist || 0.5, life: (sec || 6) + 4, reverb: 0.05 }); if (!src) return;
    let t = now(); const end = t + (sec || 6);
    while (t < end) {
      A.noise(t, 1.6, 0.14, src, { a: 1.0, filters: [{ type: 'bandpass', freq: 700, Q: 0.8 }, { type: 'peaking', freq: 1600, Q: 1.5 }] });
      A.noise(t + 1.7, 1.1, 0.1, src, { a: 0.3, filters: [{ type: 'bandpass', freq: 600, Q: 0.8 }] });
      t += 3.0;
    }
  };
  S.doorguardClank = function (o) { if (!ok()) return; const out = out3d(o, 0); const t = now(); A.noise(t, 0.01, 0.6, out, { filters: [{ type: 'highpass', freq: 1500 }] }); [[920, 0.6], [2380, 0.3], [4100, 0.15]].forEach(([f, d]) => A.osc('sine', f, t, d, 0.12, out, { a: 0.001, decay: true })); };
  S.scrape = function (speed, o) { if (!ok()) return; const out = out3d(o, 0); const t = now(); const v = Math.min(1, Math.max(0.05, speed || 0.3)); A.noise(t, 0.12, 0.25 * v, out, { a: 0.02, filters: [{ type: 'bandpass', freq: 3000, Q: 4 }] }); };
  S.doorSlam = function (o) { if (!ok()) return; const out = out3d(o, 0); const t = now(); A.noise(t, 0.3, 0.9, out, { filters: [{ type: 'lowpass', freq: 150 }] }); const s = A.osc('sine', 55, t, 0.8, 0.9, out, { a: 0.002, decay: true }); s.frequency.exponentialRampToValueAtTime(30, t + 0.6); A.osc('sine', 640, t, 1, 0.05, out, { a: 0.001, decay: true }); A.osc('sine', 1720, t, 0.8, 0.03, out, { a: 0.001, decay: true }); };
  S.sensorLight = function () { if (!ok()) return; const t = now(); A.noise(t, 0.002, 0.6, A.bus('sfx'), { filters: [{ type: 'bandpass', freq: 3200, Q: 8 }] }); for (let i = 1; i <= 3; i++) A.osc('square', 100, t + 0.05 + i * 0.03, 0.01, 0.06, A.bus('sfx'), { a: 0.001, r: 0.002 }); };
  S.sirenWallpad = function (sec) { if (!ok()) return; const t = now(); sec = typeof sec === 'number' ? sec : 6; const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7; const g = ctx().createGain(); g.gain.value = 0.5; bp.connect(g); g.connect(A.bus('sfx')); for (let k = 0; k < sec / 0.42; k++) A.osc('square', k % 2 ? 770 : 960, t + k * 0.42, 0.42, 0.18, bp, { a: 0.005, r: 0.01 }); };
  S.paChime = function () { if (!ok()) return; const t = now(); [79, 76, 72, 67].forEach((m, i) => mar(t + i * 0.45, m, 0.16, A.bus('sfx'))); };
  S.neighbors = function () { if (!ok()) return; const t = now(); const out = A.at(0, { dist: 6, life: 10 }); A.noise(t, 1, 0.3, out, { a: 0.1, filters: [{ type: 'lowpass', freq: 400 }] }); setTimeout(() => S.footsteps(8, { az: 20, dist: 6, gap: 0.35, vol: 0.9 }), 900); };
  S.policeKnock = function () { if (!ok()) return; const out = out3d({ az: 0, dist: 1.2 }); let t = now(); for (let i = 0; i < 3; i++) { A.noise(t, 0.02, 0.7, out, { filters: [{ type: 'lowpass', freq: 1200 }] }); A.osc('sine', 450, t, 0.4, 0.2, out, { a: 0.001, decay: true }); A.osc('sine', 1100, t, 0.25, 0.08, out, { a: 0.001, decay: true }); t += 0.5; } A.noise(t + 0.3, 0.12, 0.2, out, { filters: [{ type: 'bandpass', freq: 2000, Q: 2 }] }); A.osc('sine', 1000, t + 0.45, 0.08, 0.08, out); };
  S.sirenPolice = function (sec) { if (!ok()) return; const c = ctx(); const t = now(); sec = typeof sec === 'number' ? sec : 10; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(3000, t + sec); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + sec * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + sec); lp.connect(g); g.connect(A.bus('sfx')); [0, 0.5].forEach((ph) => { const o = c.createOscillator(); o.type = 'sawtooth'; for (let k = 0; k < sec; k += 1) { o.frequency.setValueAtTime(650, t + k + ph * 0.5); o.frequency.linearRampToValueAtTime(1300, t + k + 0.5 + ph * 0.5); } o.connect(lp); o.start(t); o.stop(t + sec); }); };
  S.boiler = function () { if (!ok()) return; const out = out3d({ az: 0, dist: 3 }); const t = now(); for (let i = 0; i < 3; i++) A.noise(t + i * 0.18, 0.003, 0.4, out, { filters: [{ type: 'bandpass', freq: 4000, Q: 3 }] }); A.noise(t + 0.6, 0.6, 0.5, out, { a: 0.3, filters: [{ type: 'lowpass', freq: 120 }] }); A.osc('sine', 48, t + 0.9, 6, 0.06, out, { a: 0.5 }); A.osc('sine', 96, t + 0.9, 6, 0.03, out, { a: 0.5 }); };
  S.elevator = function () { if (!ok()) return; const out = out3d({ az: 0, dist: 5 }); const t = now(); A.osc('sine', 100, t, 3, 0.05, out, { a: 0.5 }); A.noise(t, 3, 0.1, out, { a: 0.5, filters: [{ type: 'lowpass', freq: 250 }] }); A.osc('sine', 1047, t + 3, 1.2, 0.05, out, { decay: true }); A.osc('sine', 1568, t + 3, 1.2, 0.04, out, { decay: true }); };
  S.creakWardrobe = function (o) { o = o || {}; const out = out3d(o, 270); if (!ok() || !out) return; const c = ctx(), t = now(); const dur = o.dur || 2.6; const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(85, t); for (let i = 1; i < 40; i++) osc.frequency.setValueAtTime(70 + Math.random() * 60, t + (dur * i) / 40); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.3); g.gain.setValueAtTime(0.22, t + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); [180, 620, 1450, 2900].forEach((f) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 8; osc.connect(bp); bp.connect(g); }); g.connect(out); osc.start(t); osc.stop(t + dur + 0.1); };
  S.panelSlide = function (o) { const out = out3d(o, 270); if (!ok()) return; const t = now(); A.noise(t, 1.4, 0.25, out, { a: 0.2, filters: [{ type: 'bandpass', freq: 600, Q: 0.6 }] }); A.osc('sine', 180, t + 1.4, 0.2, 0.3, out, { a: 0.001, decay: true }); A.osc('sine', 420, t + 1.4, 0.12, 0.15, out, { a: 0.001, decay: true }); };

  /* ---------- stingers ---------- */
  function hit(gainMul, out) {
    const t = now(); out = out || A.bus('sfx');
    const s = A.osc('sine', 48, t, 0.6, 0.9 * gainMul, out, { a: 0.002, decay: true }); s.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    A.noise(t, 0.4, 0.5 * gainMul, out, { filters: [{ type: 'lowpass', freq: 1200 }], send: 0.3 });
    [110, 116.5, 164.8, 174.6].forEach((f) => A.osc('sawtooth', f * (1 + (Math.random() - 0.5) * 0.008), t, 2.5, 0.07 * gainMul, out, { a: 0.003, decay: true, filter: { freq: 1200 }, send: 0.3 }));
  }
  S.stingJS1 = function () { if (!ok()) return; const t = now(); A.noise(t, 0.9, 0.3, A.bus('sfx'), { a: 0.85, filters: [{ type: 'highpass', freq: 400 }] }); setTimeout(() => hit(1), 980); };
  S.stingJS2 = function () {
    if (!ok()) return; hit(1.4);
    const t = now(); const c = ctx();
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1300, t); o.frequency.linearRampToValueAtTime(1900, t + 0.6);
    const d = c.createDelay(); d.delayTime.value = 0.0021; const fb = c.createGain(); fb.gain.value = 0.85; const g = c.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(d); d.connect(fb); fb.connect(d); d.connect(g); o.connect(g); g.connect(A.bus('sfx')); o.start(t); o.stop(t + 0.7);
    setTimeout(() => S.heartbeat(120, 8), 800);
    A.osc('sine', 7200, t + 1, 5, 0.006, A.bus('sfx'), { a: 0.05, decay: true });
  };

  /* ---------- ringtones / buzz ---------- */
  function loopMotif(notes, bpm, transpose, out, detuneDrift, dropEvery) {
    let stopped = false, timer, bar = 0;
    const beat = 60 / bpm;
    const play = () => {
      if (stopped || !ok()) return;
      const t = now() + 0.03;
      notes.forEach(([b, m], i) => {
        if (dropEvery && bar % dropEvery === dropEvery - 1 && i === notes.length - 1) return;
        mar(t + b * beat, m + transpose, 0.16, out, detuneDrift ? (Math.random() - 0.5) * 70 : 0);
      });
      bar++;
      timer = setTimeout(play, 8 * beat * 1000);
    };
    play();
    return { stop() { stopped = true; clearTimeout(timer); } };
  }
  const MOM_MOTIF = [[0, 84], [1, 88], [2, 91], [3, 88], [4, 86], [5, 89], [6, 93]];
  S.ringMom = function (o) {
    o = o || {}; if (!ok()) return { stop() {} };
    let out = A.bus('sfx');
    const c = ctx(); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400; const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2500; pk.gain.value = 5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.underBed ? 900 : 12000;
    const g = c.createGain(); g.gain.value = o.vol || 1;
    hp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(o.az != null ? (A.at(o.az, { dist: 1.2, life: 60 }) || out) : out);
    const m = loopMotif(MOM_MOTIF, 112, 0, hp);
    const bz = S.buzzWood({ out: lp, vol: 0.6 });
    return { stop() { m.stop(); bz.stop(); g.gain.setTargetAtTime(0, now(), 0.03); }, setMuffle(on) { lp.frequency.setTargetAtTime(on ? 900 : 12000, now(), 0.05); } };
  };
  S.ringHaru = function (o) {
    o = o || {}; if (!ok()) return { stop() {} };
    const src = A.at(o.az != null ? o.az : 270, { closet: 0.6, dist: 1.6, life: 120, lpBase: 700, lpRange: 2100 });
    const m = loopMotif(MOM_MOTIF, 92, -5, src, true, 3);
    return { stop() { m.stop(); try { src.dispose(); } catch (e) {} } };
  };
  S.buzzWood = function (o) {
    o = o || {}; if (!ok()) return { stop() {} };
    const c = ctx(); const out = o.out || (o.az != null ? A.at(o.az, { closet: 0.5, life: 120 }) : A.bus('sfx'));
    const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 150;
    const am = c.createOscillator(); am.frequency.value = 25; const amg = c.createGain(); amg.gain.value = 0.5; am.connect(amg);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = c.createGain(); g.gain.value = 0; amg.connect(g.gain);
    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(); am.start();
    let on = false, stopped = false, timer;
    const vol = (o.vol || 1) * 0.12;
    const cycle = () => { if (stopped) return; on = !on; g.gain.setTargetAtTime(on ? vol : 0, now(), 0.01); if (on && G.settings.vibration && navigator.vibrate) try { navigator.vibrate(800); } catch (e) {} timer = setTimeout(cycle, on ? 800 : 400); };
    cycle();
    return { stop() { stopped = true; clearTimeout(timer); g.gain.setTargetAtTime(0, now(), 0.02); setTimeout(() => { try { osc.stop(); am.stop(); } catch (e) {} }, 200); } };
  };

  /* ---------- GSM buzz (proximity tell) ---------- */
  let gsm = null;
  A.gsm = function (p) {
    if (!ok()) return;
    if (!p) { if (gsm) { gsm.g.gain.setTargetAtTime(0, now(), 0.2); gsm.stopped = true; const old = gsm; setTimeout(() => { try { old.osc.stop(); } catch (e) {} }, 800); gsm = null; } return; }
    if (!gsm) {
      const c = ctx(); const osc = c.createOscillator();
      const N = 40, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.125);
      osc.setPeriodicWave(c.createPeriodicWave(re, im)); osc.frequency.value = 217;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
      const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2000; pk.gain.value = 6;
      const gate = c.createGain(); gate.gain.value = 0; const g = c.createGain(); g.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (pan.pan) pan.pan.value = -0.2;
      osc.connect(hp); hp.connect(pk); pk.connect(gate); gate.connect(g); g.connect(pan); pan.connect(A.bus('sfx'));
      osc.start();
      gsm = { osc, gate, g, stopped: false };
      const sched = () => {
        if (!gsm || gsm.stopped) return;
        const t = now(); const burst = 0.06 + Math.random() * 0.29;
        if (Math.random() < 0.15) { for (let k = 0; k < 6; k++) { gate.gain.setValueAtTime(1, t + k * 0.125); gate.gain.setValueAtTime(0, t + k * 0.125 + 0.06); } }
        else { gate.gain.setValueAtTime(1, t); gate.gain.setValueAtTime(0, t + burst); }
        setTimeout(sched, (burst + 0.08 + Math.random() * 0.82) * 1000);
      };
      sched();
    }
    const db = -40 + 26 * Math.min(1, Math.max(0, p));
    gsm.g.gain.setTargetAtTime(Math.pow(10, db / 20), now(), 0.4);
  };

  /* ---------- music box (design §7.2 melody) ---------- */
  const MB = [[0, 76], [1, 81], [2, 84], [3, 83], [4, 81], [5, 76], [6, 77], [7, 81], [8, 86], [9, 84], [10, 83], [12, 76], [13, 81], [14, 84], [15, 83], [16, 81], [17, 79], [18, 77], [19, 76], [20, 74], [21, 76]];
  function tine(t, midi, vel, out, detuneCents) {
    const f = A.mtof(midi + 12) * Math.pow(2, (detuneCents || 0) / 1200);
    A.osc('sine', f, t, midi < 70 ? 2.2 : 1.6, vel, out, { a: 0.001, decay: true, send: 0.2 });
    A.osc('sine', f * 2, t, 0.6, vel * 0.22, out, { a: 0.001, decay: true });
    A.osc('sine', f * 5.4, t, 0.12, vel * 0.07, out, { a: 0.001, decay: true });
    A.noise(t, 0.004, vel * 0.3, out, { filters: [{ type: 'highpass', freq: 5000 }] });
  }
  A.musicBox = function (o) {
    o = o || {}; if (!ok()) return { stop() {} };
    const variant = o.variant || 'plain';
    let out = A.bus('music');
    if (o.az != null) { out = A.at(o.az, { closet: o.closet != null ? o.closet : 0.6, life: 40, lpBase: o.closet ? 500 : 700, lpRange: o.closet ? 1300 : 3500 }) || out; }
    const g = ctx().createGain(); g.gain.value = o.gain || 0.8; g.connect(out);
    const bpm = variant === 'warm' ? 76 : 84; const beat = 60 / bpm;
    const t0 = now() + 0.05;
    let notes = MB;
    if (variant === 'live') notes = MB.filter(([b]) => b < 6);
    if (variant === 'fragment') notes = [[0, 76], [1.3, 81], [2.8, 84]];
    let tt = t0, last = 0, mult = 1;
    const timers = [];
    notes.forEach(([b, m], i) => {
      let dt = (b - last) * beat;
      if (variant === 'winddown' && b >= 12) { mult *= 1.12; dt *= mult; }
      tt += dt; last = b;
      const vel = variant === 'fragment' ? 0.07 : variant === 'warm' ? 0.06 : 0.08;
      tine(tt, m, vel, g, (Math.random() - 0.5) * 8);
      if (variant === 'winddown' && i === 19) tine(tt + 0.012, m, vel * 0.6, g, 0); // flam
    });
    if (variant === 'winddown') { const tEnd = tt + 1.2; A.noise(tEnd, 0.006, 0.2, g, { filters: [{ type: 'highpass', freq: 3000 }] }); A.noise(tEnd + 0.25, 0.006, 0.2, g, { filters: [{ type: 'highpass', freq: 3000 }] }); }
    if (variant === 'warm') {
      // soft pad Am - F - Dm - E -> A
      const chords = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59], [57, 61, 64]];
      chords.forEach((ch, i) => ch.forEach((m) => { [-6, 6].forEach((det) => A.osc('sawtooth', A.mtof(m), t0 + i * 3 * beat * 1.4, 3 * beat * 1.5, 0.012, g, { a: 0.6, r: 0.8, detune: det, filter: { freq: 1200 } })); }));
    }
    return { stop() { g.gain.setTargetAtTime(0, now(), 0.3); timers.forEach(clearTimeout); }, duration: tt - t0 + 1.6 };
  };

  /* ---------- TTS voice files ---------- */
  const voiceCache = {};
  A.voice = function (id) {
    if (voiceCache[id]) return voiceCache[id];
    voiceCache[id] = new Promise((res) => {
      if (!A.ctx || location.protocol === 'file:') { res(null); return; }
      fetch('assets/audio/' + id + '.wav').then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => {
        if (!ab) return res(null);
        A.ctx.decodeAudioData(ab, (b) => res(b), () => res(null));
      }).catch(() => res(null));
    });
    return voiceCache[id];
  };
  /** play a voice line (3D optional) with subtitle. Returns Promise resolved when done */
  A.say = async function (id, sub, o) {
    o = o || {};
    if (sub) G.fx.sub(G.T(sub), o.subMs || 3200, { cls: o.subCls });
    const buf = await A.voice(id);
    if (!buf || !ok()) { await new Promise((r) => setTimeout(r, o.subMs || 2500)); return; }
    let out = 'voice';
    const h = A.playBuffer(buf, { bus: 'voice', gain: o.gain || 1 });
    if (h && o.az != null) { try { h.analyser.disconnect(); const p = A.at(o.az, { dist: o.dist || 0.6, life: buf.duration + 3, reverb: 0.05, bus: 'voice' }); if (p) h.analyser.connect(p); } catch (e) {} }
    await new Promise((r) => setTimeout(r, buf.duration * 1000 + 100));
  };
})();
