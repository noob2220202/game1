/* =========================================================
 * 하루를 위한 방탈출! — Audio engine
 * Everything is synthesized live with WebAudio (no audio files needed),
 * except buffers we render procedurally at boot (spectrogram recording, etc).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  const A = {
    ctx: null,
    master: null,
    buses: {},
    enabled: true,
    volume: 0.9,
    ambient: {},
    _noise: null,
    _impulse: null,
    unlocked: false,
  };

  function now() { return A.ctx.currentTime; }

  /* ---------- boot / unlock (must be called from a user gesture) ---------- */
  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    try {
      // iOS: route WebAudio through the media channel so the silent switch does not mute it
      if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) {} }
      const AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      console.warn('[audio] no WebAudio', e);
      A.enabled = false;
      return;
    }
    const ctx = A.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    A.master = ctx.createGain();
    A.master.gain.value = A.volume;
    // master -> [stereo | mono-sum] -> hearing LPF -> compressor -> out
    A.hearing = ctx.createBiquadFilter(); A.hearing.type = 'lowpass'; A.hearing.frequency.value = 20000; A.hearing.Q.value = 0.5;
    A.stereoPath = ctx.createGain(); A.stereoPath.gain.value = 1;
    A.monoPath = ctx.createGain(); A.monoPath.gain.value = 0;
    const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
    const sumL = ctx.createGain(), sumR = ctx.createGain(); sumL.gain.value = 0.5; sumR.gain.value = 0.5;
    A.master.connect(A.stereoPath); A.stereoPath.connect(A.hearing);
    A.master.connect(split);
    split.connect(sumL, 0); split.connect(sumL, 1); split.connect(sumR, 0); split.connect(sumR, 1);
    sumL.connect(merge, 0, 0); sumR.connect(merge, 0, 1);
    merge.connect(A.monoPath); A.monoPath.connect(A.hearing);
    A.hearing.connect(comp); comp.connect(ctx.destination);
    A.comp = comp;

    // reverb send (small room / closet-ish)
    A.reverb = ctx.createConvolver();
    A.reverb.buffer = makeImpulse(2.2, 2.6);
    const revGain = ctx.createGain(); revGain.gain.value = 0.55;
    A.reverb.connect(revGain); revGain.connect(A.master);

    ['sfx', 'ui', 'amb', 'voice', 'music'].forEach((k) => {
      const g = ctx.createGain(); g.connect(A.master); A.buses[k] = g;
    });
    A.buses.ui.gain.value = 0.55;
    A.buses.amb.gain.value = 0.8;
    A._noise = makeNoiseBuffer(4);
    A._brown = makeBrownBuffer(6);
    A.unlocked = true;

    // iOS sometimes needs a tick of real playback in the gesture
    const o = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(A.master); o.start(); o.stop(ctx.currentTime + 0.05);

    document.addEventListener('visibilitychange', () => {
      if (!A.ctx) return;
      if (document.hidden) A.ctx.suspend && A.ctx.suspend();
      else A.ctx.resume && A.ctx.resume();
    });
  };

  A.setEnabled = function (on) {
    A.enabled = on;
    if (A.master) A.master.gain.setTargetAtTime(on ? A.volume : 0, now(), 0.05);
  };
  A.setVolume = function (v) {
    A.volume = v;
    if (A.master && A.enabled) A.master.gain.setTargetAtTime(v, now(), 0.05);
  };

  /* ---------- buffers ---------- */
  function makeNoiseBuffer(sec) {
    const ctx = A.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeBrownBuffer(sec) {
    const ctx = A.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }
  function makeImpulse(sec, decay) {
    const ctx = A.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  /* ---------- tiny graph helpers ---------- */
  function bus(name) { return A.buses[name] || A.buses.sfx; }
  function env(param, t, a, peak, d, sustain, r, end) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    if (end != null) {
      param.setValueAtTime(Math.max(0.0001, sustain), end);
      param.exponentialRampToValueAtTime(0.0001, end + r);
    }
  }
  function osc(type, freq, t, dur, gainPeak, out, opts) {
    opts = opts || {};
    const ctx = A.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.a != null ? opts.a : 0.005, r = opts.r != null ? opts.r : 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainPeak, t + a);
    if (opts.decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(gainPeak, t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    o.connect(g);
    let last = g;
    if (opts.filter) { const f = ctx.createBiquadFilter(); f.type = opts.filter.type || 'lowpass'; f.frequency.value = opts.filter.freq; f.Q.value = opts.filter.Q || 0.7; g.connect(f); last = f; }
    if (opts.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = opts.pan; last.connect(p); last = p; }
    last.connect(out);
    if (opts.send) { const s = ctx.createGain(); s.gain.value = opts.send; last.connect(s); s.connect(A.reverb); }
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, gainPeak, out, opts) {
    opts = opts || {};
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = opts.brown ? A._brown : A._noise; src.loop = true;
    const off = Math.random() * 2;
    const g = ctx.createGain();
    const a = opts.a != null ? opts.a : 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainPeak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src;
    (opts.filters || []).forEach((fd) => {
      const f = ctx.createBiquadFilter(); f.type = fd.type; f.frequency.setValueAtTime(fd.freq, t);
      if (fd.to) f.frequency.exponentialRampToValueAtTime(fd.to, t + dur);
      f.Q.value = fd.Q || 0.8; node.connect(f); node = f;
    });
    node.connect(g);
    let last = g;
    if (opts.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = opts.pan; g.connect(p); last = p; }
    last.connect(out);
    if (opts.send) { const s = ctx.createGain(); s.gain.value = opts.send; last.connect(s); s.connect(A.reverb); }
    src.start(t, off); src.stop(t + dur + 0.05);
    return src;
  }

  function ok() { return A.enabled && A.ctx && A.ctx.state !== 'closed'; }

  /* =========================================================
   * Sound cues
   * ========================================================= */
  const S = (A.sfx = {});

  S.tap = function () { if (!ok()) return; const t = now(); osc('sine', 1800, t, 0.03, 0.08, bus('ui'), { a: 0.001, decay: true }); };
  S.key = function () { if (!ok()) return; const t = now(); noise(t, 0.035, 0.12, bus('ui'), { filters: [{ type: 'bandpass', freq: 3200, Q: 1.2 }] }); };
  S.back = function () { if (!ok()) return; const t = now(); osc('sine', 1200, t, 0.05, 0.06, bus('ui'), { decay: true }); osc('sine', 900, t + 0.03, 0.05, 0.05, bus('ui'), { decay: true }); };

  S.notify = function () {
    if (!ok()) return; const t = now(), b = bus('ui');
    osc('sine', 1318.5, t, 0.35, 0.22, b, { decay: true, send: 0.05 });
    osc('sine', 1975.5, t + 0.11, 0.5, 0.18, b, { decay: true, send: 0.05 });
    osc('sine', 3951, t + 0.11, 0.25, 0.03, b, { decay: true });
  };
  S.msgSend = function () { if (!ok()) return; const t = now(); noise(t, 0.18, 0.08, bus('ui'), { filters: [{ type: 'bandpass', freq: 900, to: 4000, Q: 1.5 }] }); };
  S.msgIn = function () { if (!ok()) return; const t = now(); osc('sine', 880, t, 0.12, 0.12, bus('ui'), { decay: true }); osc('sine', 1320, t + 0.07, 0.18, 0.1, bus('ui'), { decay: true }); };
  S.error = function () { if (!ok()) return; const t = now(); osc('square', 180, t, 0.12, 0.06, bus('ui'), { filter: { freq: 1200 } }); osc('square', 140, t + 0.14, 0.18, 0.06, bus('ui'), { filter: { freq: 1200 } }); };
  S.unlock = function () { if (!ok()) return; const t = now(); noise(t, 0.08, 0.15, bus('ui'), { filters: [{ type: 'highpass', freq: 2500 }] }); osc('sine', 660, t + 0.02, 0.1, 0.06, bus('ui'), { decay: true }); };
  S.lockClick = function () { if (!ok()) return; const t = now(); noise(t, 0.05, 0.3, bus('ui'), { filters: [{ type: 'bandpass', freq: 1800, Q: 2 }] }); osc('sine', 220, t, 0.06, 0.1, bus('ui'), { decay: true }); };
  S.shutter = function () {
    if (!ok()) return; const t = now(), b = bus('sfx');
    noise(t, 0.05, 0.4, b, { filters: [{ type: 'highpass', freq: 1500 }] });
    noise(t + 0.09, 0.07, 0.3, b, { filters: [{ type: 'bandpass', freq: 2500, Q: 1 }] });
  };
  S.whoosh = function () { if (!ok()) return; const t = now(); noise(t, 0.45, 0.12, bus('sfx'), { a: 0.15, filters: [{ type: 'bandpass', freq: 300, to: 2400, Q: 0.8 }] }); };
  S.flashlight = function (on) { if (!ok()) return; const t = now(); noise(t, 0.03, 0.25, bus('ui'), { filters: [{ type: 'bandpass', freq: on ? 2600 : 1800, Q: 3 }] }); };

  // vibration buzz (also triggers real vibration on Android)
  S.buzz = function (pattern) {
    pattern = pattern || [400, 200, 400];
    if (G.settings && G.settings.vibration !== false && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
    if (!ok()) return;
    let t = now();
    const b = bus('sfx');
    for (let i = 0; i < pattern.length; i += 2) {
      const d = pattern[i] / 1000;
      osc('sawtooth', 148, t, d, 0.09, b, { a: 0.01, r: 0.03, filter: { type: 'lowpass', freq: 380, Q: 2 } });
      osc('square', 74, t, d, 0.05, b, { a: 0.01, r: 0.03, filter: { type: 'lowpass', freq: 260 } });
      t += d + (pattern[i + 1] || 0) / 1000;
    }
  };

  /* DTMF — the real telephone keypad frequencies */
  const DTMF = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477] };
  A.DTMF = DTMF;
  S.dtmf = function (k, dur, gain, when, out) {
    if (!ok() || !DTMF[k]) return; const t = when || now();
    dur = dur || 0.16; gain = gain || 0.12; out = out || bus('ui');
    osc('sine', DTMF[k][0], t, dur, gain, out, { a: 0.004, r: 0.01 });
    osc('sine', DTMF[k][1], t, dur, gain * 0.9, out, { a: 0.004, r: 0.01 });
  };

  // Korean phone ringback tone (440+480Hz, 1s on / 2s off)
  A.ringback = function (times, onDone) {
    if (!ok()) { if (onDone) setTimeout(onDone, (times || 2) * 3000); return { stop() {} }; }
    const t0 = now(); const g = A.ctx.createGain(); g.gain.value = 1; g.connect(bus('voice'));
    for (let i = 0; i < (times || 2); i++) {
      osc('sine', 440, t0 + i * 3, 1, 0.06, g, { a: 0.01, r: 0.02 });
      osc('sine', 480, t0 + i * 3, 1, 0.06, g, { a: 0.01, r: 0.02 });
    }
    const tm = setTimeout(() => onDone && onDone(), (times || 2) * 3000 - 500);
    return { stop() { clearTimeout(tm); g.gain.setTargetAtTime(0, now(), 0.02); } };
  };
  A.busyTone = function (times) {
    if (!ok()) return; const t0 = now();
    for (let i = 0; i < (times || 4); i++) { osc('sine', 480, t0 + i * 1, 0.5, 0.05, bus('voice')); osc('sine', 620, t0 + i * 1, 0.5, 0.05, bus('voice')); }
  };

  // Ringtone (original melody, marimba-ish). Returns stopper.
  A.ringtone = function (creepy) {
    if (!ok()) return { stop() {} };
    const g = A.ctx.createGain(); g.gain.value = 1; g.connect(bus('sfx'));
    const notes = creepy
      ? [[0, 69], [0.22, 72], [0.44, 76], [0.66, 75], [0.88, 72], [1.32, 69], [1.54, 68], [1.98, 69]]
      : [[0, 76], [0.2, 79], [0.4, 84], [0.6, 83], [0.8, 79], [1.2, 81], [1.4, 79], [1.8, 76]];
    let stopped = false, timer;
    const loop = () => {
      if (stopped) return;
      const t = now() + 0.02;
      notes.forEach(([dt, m]) => marimba(t + dt, m, 0.16, g, creepy ? -25 : 0));
      S.buzz([500, 300]);
      timer = setTimeout(loop, 2800);
    };
    loop();
    return { stop() { stopped = true; clearTimeout(timer); g.gain.setTargetAtTime(0, now(), 0.03); } };
  };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function marimba(t, midi, vel, out, detune) {
    const f = mtof(midi);
    osc('sine', f, t, 0.6, vel, out, { a: 0.002, decay: true, detune: detune || 0, send: 0.08 });
    osc('sine', f * 4.0, t, 0.12, vel * 0.25, out, { a: 0.001, decay: true });
    osc('triangle', f * 2, t, 0.25, vel * 0.15, out, { a: 0.001, decay: true });
  }

  /* Music box motif (오르골). The recurring theme. 'broken' detunes & slows like a dying spring. */
  /* Original melody (not based on any existing tune) */
  A.MUSICBOX_THEME = [
    [0.0, 81], [0.3, 76], [0.6, 79], [0.9, 77], [1.2, 76], [1.5, 72], [1.8, 74], [2.4, 76],
    [2.7, 81], [3.0, 84], [3.3, 83], [3.6, 79], [3.9, 81], [4.5, 76],
    [4.8, 77], [5.1, 76], [5.4, 74], [5.7, 72], [6.0, 71], [6.3, 72], [6.6, 74], [7.2, 69],
  ];
  A.musicBox = function (opts) {
    opts = opts || {};
    if (!ok()) return { stop() {} };
    const out = A.ctx.createGain(); out.gain.value = opts.gain || 0.7; out.connect(bus('music'));
    const rate = opts.rate || 1;
    let stopped = false, timer;
    const play = () => {
      if (stopped) return;
      const t0 = now() + 0.05;
      A.MUSICBOX_THEME.forEach(([dt, m], i) => {
        let tt = t0 + dt / rate;
        let det = 0;
        if (opts.broken) { const k = i / A.MUSICBOX_THEME.length; tt = t0 + (dt / rate) * (1 + k * 0.5); det = -k * 60 + (Math.random() - 0.5) * 30; }
        const f = mtof(m + 12);
        osc('sine', f, tt, 1.4, 0.07, out, { a: 0.001, decay: true, detune: det, send: 0.25 });
        osc('sine', f * 3.01, tt, 0.25, 0.02, out, { a: 0.001, decay: true, detune: det });
        osc('sine', f * 5.4, tt, 0.08, 0.012, out, { a: 0.001, decay: true });
      });
      const len = (A.MUSICBOX_THEME[A.MUSICBOX_THEME.length - 1][0] / rate) * (opts.broken ? 1.5 : 1) + 1.2;
      if (opts.loop) timer = setTimeout(play, len * 1000);
    };
    play();
    return { stop() { stopped = true; clearTimeout(timer); out.gain.setTargetAtTime(0, now(), 0.3); } };
  };

  /* Horror cues */
  S.knock = function (n, opts) {
    opts = opts || {}; if (!ok()) return;
    n = n || 3; let t = now() + 0.02;
    const vol = opts.vol || 0.9, pan = opts.pan != null ? opts.pan : 0.35, gap = opts.gap || 0.42;
    for (let i = 0; i < n; i++) {
      const v = vol * (0.85 + Math.random() * 0.3);
      osc('sine', 120 + Math.random() * 15, t, 0.18, v * 0.6, bus('sfx'), { a: 0.001, decay: true, pan, send: 0.4 });
      osc('sine', 260 + Math.random() * 30, t, 0.06, v * 0.25, bus('sfx'), { a: 0.001, decay: true, pan, send: 0.3 });
      noise(t, 0.07, v * 0.4, bus('sfx'), { filters: [{ type: 'bandpass', freq: 650, Q: 1.5 }], pan, send: 0.5 });
      t += gap * (0.85 + Math.random() * 0.3);
    }
  };
  S.scratch = function (dur, opts) {
    opts = opts || {}; if (!ok()) return;
    const t = now(); dur = dur || 2.2; const pan = opts.pan != null ? opts.pan : 0.4;
    const strokes = Math.floor(dur / 0.45);
    for (let i = 0; i < strokes; i++) {
      const tt = t + i * 0.45 + Math.random() * 0.1;
      noise(tt, 0.35, 0.18 * (opts.vol || 1), bus('sfx'), { a: 0.06, filters: [{ type: 'bandpass', freq: 2200 + Math.random() * 800, to: 1200, Q: 6 }, { type: 'highpass', freq: 700 }], pan, send: 0.35 });
    }
  };
  S.creak = function (dur, opts) {
    opts = opts || {}; if (!ok()) return;
    const ctx = A.ctx, t = now(); dur = dur || 2.4;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(opts.f || 95, t);
    for (let i = 1; i < 30; i++) o.frequency.setValueAtTime((opts.f || 95) * (0.8 + Math.random() * 0.6) * (1 + i / 60), t + (dur * i) / 30);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'peaking'; bp2.frequency.value = 2400; bp2.gain.value = 8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * (opts.vol || 1), t + 0.25);
    g.gain.setValueAtTime(0.3 * (opts.vol || 1), t + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(bp2); bp2.connect(g);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = opts.pan != null ? opts.pan : 0.3; g.connect(p); p.connect(bus('sfx')); } else g.connect(bus('sfx'));
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(A.reverb);
    o.start(t); o.stop(t + dur + 0.1);
  };
  S.thud = function (vol) { if (!ok()) return; const t = now(); const o = osc('sine', 70, t, 0.6, (vol || 1) * 0.8, bus('sfx'), { a: 0.002, decay: true, send: 0.4 }); o.frequency.exponentialRampToValueAtTime(35, t + 0.5); noise(t, 0.15, (vol || 1) * 0.3, bus('sfx'), { filters: [{ type: 'lowpass', freq: 400 }] }); };
  S.heartbeat = function (bpm, beats) {
    if (!ok()) return; bpm = bpm || 70; beats = beats || 4; const t0 = now(); const step = 60 / bpm;
    for (let i = 0; i < beats; i++) {
      [0, 0.16].forEach((dt, j) => {
        const t = t0 + i * step + dt;
        const o = osc('sine', j ? 52 : 60, t, 0.25, j ? 0.55 : 0.75, bus('sfx'), { a: 0.004, decay: true });
        o.frequency.exponentialRampToValueAtTime(32, t + 0.2);
      });
    }
  };
  S.static = function (dur, vol) { if (!ok()) return; const t = now(); noise(t, dur || 0.4, (vol || 0.25), bus('sfx'), { a: 0.005, filters: [{ type: 'highpass', freq: 600 }, { type: 'peaking', freq: 3000, Q: 1 }] }); };
  S.glitch = function () {
    if (!ok()) return; const t = now();
    for (let i = 0; i < 7; i++) {
      const tt = t + i * 0.045 + Math.random() * 0.02;
      if (Math.random() < 0.5) osc('square', 80 + Math.random() * 1400, tt, 0.04, 0.07, bus('sfx'), { a: 0.001, r: 0.005 });
      else noise(tt, 0.04, 0.2, bus('sfx'), { filters: [{ type: 'bandpass', freq: 500 + Math.random() * 5000, Q: 4 }] });
    }
  };
  S.stinger = function () {
    // jumpscare: dissonant cluster + noise burst + sub boom
    if (!ok()) return; const t = now(), b = bus('sfx');
    [55, 58.27, 61.74, 116.5, 123.5, 233, 246.9, 493.9, 523.3].forEach((f, i) => {
      osc(i % 2 ? 'sawtooth' : 'square', f * 2, t, 1.6, 0.06, b, { a: 0.005, decay: true, send: 0.3, filter: { freq: 5000 } });
    });
    noise(t, 0.9, 0.7, b, { a: 0.003, filters: [{ type: 'highpass', freq: 300 }], send: 0.3 });
    const o = osc('sine', 90, t, 1.5, 1, b, { a: 0.003, decay: true }); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
  };
  S.riser = function (dur) {
    if (!ok()) return; const t = now(); dur = dur || 4; const b = bus('sfx');
    noise(t, dur, 0.25, b, { a: dur * 0.9, filters: [{ type: 'bandpass', freq: 200, to: 5000, Q: 2 }], send: 0.4 });
    const o = osc('sawtooth', 55, t, dur, 0.08, b, { a: dur * 0.9, r: 0.05, filter: { freq: 1800 } }); o.frequency.exponentialRampToValueAtTime(220, t + dur);
  };
  S.breath = function (n, opts) {
    // slow heavy breathing (for voicemail / calls)
    opts = opts || {}; if (!ok()) return; let t = now() + 0.05; n = n || 3;
    const out = opts.out || bus('voice');
    for (let i = 0; i < n; i++) {
      noise(t, 1.4, 0.16 * (opts.vol || 1), out, { a: 0.9, brown: false, filters: [{ type: 'bandpass', freq: 900, Q: 0.9 }, { type: 'lowpass', freq: 2600 }], pan: opts.pan || 0 });
      noise(t + 1.5, 1.8, 0.12 * (opts.vol || 1), out, { a: 0.25, filters: [{ type: 'bandpass', freq: 600, Q: 0.8 }, { type: 'lowpass', freq: 1800 }], pan: opts.pan || 0 });
      t += 3.6;
    }
  };
  S.whisper = function (dur, opts) {
    // unintelligible whisper texture (formant-filtered noise with syllable envelopes)
    opts = opts || {}; if (!ok()) return; const t0 = now(); dur = dur || 2; const out = opts.out || bus('voice');
    let t = t0;
    while (t < t0 + dur) {
      const syl = 0.08 + Math.random() * 0.18;
      const f1 = 400 + Math.random() * 600, f2 = 1400 + Math.random() * 1600;
      noise(t, syl, 0.12 * (opts.vol || 1), out, { a: syl * 0.3, filters: [{ type: 'bandpass', freq: f2, Q: 4 }, { type: 'peaking', freq: f1, Q: 2 }], pan: opts.pan != null ? opts.pan : (Math.random() - 0.5) * 0.6, send: 0.3 });
      t += syl + Math.random() * 0.12;
    }
  };
  S.footsteps = function (n, opts) {
    opts = opts || {}; if (!ok()) return; let t = now(); n = n || 4;
    for (let i = 0; i < n; i++) {
      const v = (opts.vol || 0.6) * (opts.approach ? (0.3 + (0.7 * i) / n) : 1);
      const o = osc('sine', 90, t, 0.2, v * 0.7, bus('sfx'), { a: 0.002, decay: true, pan: opts.pan || 0, send: 0.4 }); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      noise(t, 0.08, v * 0.25, bus('sfx'), { filters: [{ type: 'lowpass', freq: 900 }], pan: opts.pan || 0, send: 0.3 });
      t += opts.gap || 0.55;
    }
  };
  S.doorlockBeep = function () { if (!ok()) return; const t = now(); osc('square', 2730, t, 0.06, 0.05, bus('sfx'), { a: 0.001, r: 0.005, filter: { freq: 6000 } }); };
  S.doorlockError = function () { if (!ok()) return; const t = now(); for (let i = 0; i < 4; i++) osc('square', 2200, t + i * 0.12, 0.08, 0.05, bus('sfx'), { a: 0.001, r: 0.005, filter: { freq: 5000 } }); };
  S.doorlockOpen = function () {
    if (!ok()) return; const t = now();
    [72, 76, 79, 84].forEach((m, i) => osc('square', mtof(m + 12), t + i * 0.12, 0.14, 0.04, bus('sfx'), { a: 0.002, r: 0.02, filter: { freq: 5000 } }));
    setTimeout(() => { const tt = now(); noise(tt, 0.25, 0.5, bus('sfx'), { filters: [{ type: 'bandpass', freq: 1400, Q: 1.5 }] }); osc('sine', 160, tt, 0.15, 0.3, bus('sfx'), { decay: true }); noise(tt + 0.25, 0.12, 0.4, bus('sfx'), { filters: [{ type: 'bandpass', freq: 2200, Q: 2 }] }); }, 650);
  };
  S.doorlockMotor = function () { if (!ok()) return; const t = now(); osc('sawtooth', 210, t, 0.45, 0.06, bus('sfx'), { a: 0.02, filter: { freq: 900, Q: 3 } }); noise(t + 0.45, 0.1, 0.4, bus('sfx'), { filters: [{ type: 'bandpass', freq: 1600, Q: 2 }] }); };
  S.glassTap = function () { if (!ok()) return; const t = now(); osc('sine', 2600, t, 0.2, 0.08, bus('sfx'), { decay: true, send: 0.3 }); osc('sine', 3900, t, 0.1, 0.04, bus('sfx'), { decay: true }); };
  S.camOn = function () { if (!ok()) return; const t = now(); osc('sine', 120, t, 0.25, 0.05, bus('ui'), { a: 0.02 }); noise(t, 0.2, 0.06, bus('ui'), { filters: [{ type: 'bandpass', freq: 4000, Q: 2 }] }); };
  S.success = function () { if (!ok()) return; const t = now(); [72, 76, 79].forEach((m, i) => osc('sine', mtof(m + 12), t + i * 0.09, 0.4, 0.09, bus('ui'), { decay: true, send: 0.1 })); };
  S.pageTurn = function () { if (!ok()) return; const t = now(); noise(t, 0.25, 0.12, bus('ui'), { a: 0.05, filters: [{ type: 'bandpass', freq: 3000, Q: 0.7 }] }); };
  S.pen = function () { if (!ok()) return; const t = now(); noise(t, 0.3, 0.06, bus('ui'), { a: 0.05, filters: [{ type: 'bandpass', freq: 5000, Q: 1.5 }] }); };
  S.callEnd = function () { if (!ok()) return; const t = now(); osc('sine', 620, t, 0.15, 0.08, bus('ui')); osc('sine', 480, t + 0.18, 0.2, 0.08, bus('ui')); };
  S.powerDown = function () { if (!ok()) return; const t = now(); const o = osc('sine', 600, t, 0.8, 0.15, bus('sfx'), { a: 0.01, decay: true }); o.frequency.exponentialRampToValueAtTime(40, t + 0.7); noise(t, 0.4, 0.15, bus('sfx'), { filters: [{ type: 'lowpass', freq: 2000, to: 100 }] }); };
  S.bootChime = function () { if (!ok()) return; const t = now(); [64, 71, 76, 83].forEach((m, i) => osc('sine', mtof(m), t + i * 0.13, 1.2, 0.07, bus('ui'), { decay: true, send: 0.3 })); };

  /* =========================================================
   * Ambient layers (looping). A.amb('room', true/false)
   * ========================================================= */
  const AMB = {
    room() {
      // room tone + fridge hum + slow breathing LFO
      const ctx = A.ctx, g = ctx.createGain(); g.gain.value = 0;
      const src = ctx.createBufferSource(); src.buffer = A._brown; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const ng = ctx.createGain(); ng.gain.value = 0.22;
      src.connect(lp); lp.connect(ng); ng.connect(g);
      const hum = ctx.createOscillator(); hum.frequency.value = 60; const hg = ctx.createGain(); hg.gain.value = 0.012; hum.connect(hg); hg.connect(g);
      const hum2 = ctx.createOscillator(); hum2.frequency.value = 120; const hg2 = ctx.createGain(); hg2.gain.value = 0.006; hum2.connect(hg2); hg2.connect(g);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.08; lfo.connect(lg); lg.connect(ng.gain);
      g.connect(bus('amb')); src.start(); hum.start(); hum2.start(); lfo.start();
      A._hum = [hg, hg2];
      return { g, nodes: [src, hum, hum2, lfo], target: 1 };
    },
    rain() {
      const ctx = A.ctx, g = ctx.createGain(); g.gain.value = 0;
      const src = ctx.createBufferSource(); src.buffer = A._noise; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
      const ng = ctx.createGain(); ng.gain.value = 0.035;
      src.connect(hp); hp.connect(lp); lp.connect(ng); ng.connect(g);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = -0.4; g.connect(p); p.connect(bus('amb')); } else g.connect(bus('amb'));
      src.start();
      // droplets on the window
      let alive = true;
      const drop = () => { if (!alive) return; if (ok() && g.gain.value > 0.05) { const t = now(); osc('sine', 1800 + Math.random() * 2500, t, 0.03, 0.012 * g.gain.value, bus('amb'), { a: 0.001, decay: true, pan: -0.5 + Math.random() * 0.3 }); } setTimeout(drop, 60 + Math.random() * 260); };
      drop();
      return { g, nodes: [src], target: 1, kill() { alive = false; } };
    },
    drone() {
      // tension drone, intensity controlled with A.tension(0..1)
      const ctx = A.ctx, g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 4;
      const nodes = [];
      [36.7, 36.9, 55.2, 73.4, 77.8].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = i < 2 ? 0.06 : 0.035; o.connect(og); og.connect(lp); o.start(); nodes.push(o);
      });
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.push(lfo);
      lp.connect(g); g.connect(bus('amb'));
      const s = ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(A.reverb);
      A._droneFilter = lp;
      return { g, nodes, target: 0.5 };
    },
    hallway() {
      // fluorescent buzz for hallway CCTV
      const ctx = A.ctx, g = ctx.createGain(); g.gain.value = 0;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 8;
      const og = ctx.createGain(); og.gain.value = 0.03; o.connect(bp); bp.connect(og); og.connect(g);
      const src = ctx.createBufferSource(); src.buffer = A._noise; src.loop = true; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; const ngain = ctx.createGain(); ngain.gain.value = 0.015; src.connect(hp); hp.connect(ngain); ngain.connect(g);
      g.connect(bus('amb')); o.start(); src.start();
      return { g, nodes: [o, src], target: 1 };
    },
  };
  A.amb = function (name, on, fade) {
    if (!ok()) return; fade = fade == null ? 1.5 : fade;
    let l = A.ambient[name];
    if (on) {
      if (!l) { if (!AMB[name]) return; l = A.ambient[name] = AMB[name](); }
      l.g.gain.cancelScheduledValues(now());
      l.g.gain.setTargetAtTime(typeof on === 'number' ? on : l.target, now(), fade / 3);
    } else if (l) {
      l.g.gain.setTargetAtTime(0, now(), fade / 3);
    }
  };
  A.tension = function (x) {
    // 0..1 — drives drone loudness and brightness
    if (!ok()) return;
    A.amb('drone', 0.15 + x * 0.85, 3);
    if (A._droneFilter) A._droneFilter.frequency.setTargetAtTime(160 + x * 900, now(), 1.5);
  };
  A.duck = function (amount, sec) {
    // briefly duck ambience (for calls / reveals)
    if (!ok()) return; const b = A.buses.amb; const t = now();
    b.gain.cancelScheduledValues(t); b.gain.setTargetAtTime(1 - amount, t, 0.1);
    b.gain.setTargetAtTime(0.8, t + (sec || 2), 0.8);
  };

  /* =========================================================
   * Buffer playback (for procedurally rendered recordings)
   * Returns {stop, analyser, el}
   * ========================================================= */
  A.playBuffer = function (buffer, opts) {
    opts = opts || {};
    if (!ok() || !buffer) return null;
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    if (opts.rate) src.playbackRate.value = opts.rate;
    const g = ctx.createGain(); g.gain.value = opts.gain || 1;
    const an = ctx.createAnalyser(); an.fftSize = opts.fftSize || 2048; an.smoothingTimeConstant = opts.smoothing != null ? opts.smoothing : 0.2;
    an.minDecibels = -100; an.maxDecibels = -20;
    src.connect(g); g.connect(an);
    let last = an;
    if (opts.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = opts.pan; an.connect(p); last = p; }
    last.connect(bus(opts.bus || 'voice'));
    const startAt = now();
    src.start(0, opts.offset || 0);
    const h = { src, analyser: an, startAt, duration: buffer.duration / (opts.rate || 1), stopped: false,
      stop() { if (h.stopped) return; h.stopped = true; try { src.stop(); } catch (e) {} },
      position() { return (now() - startAt) * (opts.rate || 1) + (opts.offset || 0); } };
    src.onended = () => { h.stopped = true; opts.onEnd && opts.onEnd(); };
    return h;
  };

  /* Render a buffer procedurally: fn(dataL, dataR, sr) */
  A.renderBuffer = function (seconds, fn, sr) {
    if (!A.ctx) return null;
    sr = sr || A.ctx.sampleRate;
    const len = Math.floor(seconds * sr);
    const b = A.ctx.createBuffer(2, len, sr);
    fn(b.getChannelData(0), b.getChannelData(1), sr);
    return b;
  };

  /* =========================================================
   * Procedural recordings
   * ========================================================= */
  /** Render text into the audio spectrum: shows up in a spectrogram (주파수 보기).
   *  opts: {dur, start, fMin, fMax, font, bed:(L,R,sr,len)=>void, gain} */
  A.spectroText = function (text, opts) {
    opts = opts || {};
    const sr = 22050, dur = opts.dur || 8, start = opts.start || 1.2, textDur = opts.textDur || (dur - start - 1);
    const fMin = opts.fMin || 1800, fMax = opts.fMax || 6800;
    // rasterize
    const rows = 56, cols = Math.max(40, Math.round(textDur * 26));
    const c = document.createElement('canvas'); c.width = cols; c.height = rows;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, cols, rows);
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.font = opts.font || `900 ${rows * 0.92}px Arial, sans-serif`;
    // squeeze horizontally to fit
    const w = x.measureText(text).width; const sx = Math.min(1, (cols * 0.92) / w);
    x.save(); x.translate(cols / 2, rows / 2 + 2); x.scale(sx, 1); x.fillText(text, 0, 0); x.restore();
    const px = x.getImageData(0, 0, cols, rows).data;
    const amp = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) amp[r * cols + k] = px[(r * cols + k) * 4] / 255;
    return A.renderBuffer(dur, (L, R) => {
      const n = L.length;
      const freqs = [], phases = [];
      for (let r = 0; r < rows; r++) { freqs.push(fMax - (r / (rows - 1)) * (fMax - fMin)); phases.push(Math.random() * 6.28); }
      const s0 = Math.floor(start * sr), s1 = Math.floor((start + textDur) * sr);
      const g = (opts.gain || 0.9) / Math.sqrt(rows);
      for (let r = 0; r < rows; r++) {
        const w = (2 * Math.PI * freqs[r]) / sr; let ph = phases[r];
        for (let i = s0; i < s1; i++) {
          const pos = ((i - s0) / (s1 - s0)) * (cols - 1);
          const k = Math.floor(pos), f = pos - k;
          const a = amp[r * cols + k] * (1 - f) + amp[r * cols + Math.min(cols - 1, k + 1)] * f;
          if (a > 0.02) { const v = Math.sin(ph) * a * g; L[i] += v; R[i] += v; }
          ph += w;
        }
      }
      if (opts.bed) opts.bed(L, R, sr, n);
      // soft clip
      for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * 1.2) * 0.9; R[i] = Math.tanh(R[i] * 1.2) * 0.9; }
    }, sr);
  };
  /** helpers to paint sound beds into raw buffers */
  A.paint = {
    knock(L, R, sr, t, vol, pan) {
      const i0 = Math.floor(t * sr), len = Math.floor(0.25 * sr); vol = vol || 0.6; pan = pan || 0;
      for (let i = 0; i < len && i0 + i < L.length; i++) {
        const e = Math.exp(-i / (sr * 0.03));
        const v = (Math.sin((2 * Math.PI * 110 * i) / sr) * 0.7 + (Math.random() * 2 - 1) * 0.35 * Math.exp(-i / (sr * 0.008))) * e * vol;
        L[i0 + i] += v * (1 - Math.max(0, pan)); R[i0 + i] += v * (1 + Math.min(0, pan));
      }
    },
    scratch(L, R, sr, t, dur, vol) {
      const i0 = Math.floor(t * sr), len = Math.floor(dur * sr); let lp = 0, lp2 = 0;
      for (let i = 0; i < len && i0 + i < L.length; i++) {
        const env = Math.sin((Math.PI * i) / len) * (0.6 + 0.4 * Math.sin(i / (sr * 0.004)));
        const nz = Math.random() * 2 - 1; lp += (nz - lp) * 0.35; lp2 += (lp - lp2) * 0.5;
        const v = (lp - lp2) * env * (vol || 0.5) * 2.2;
        L[i0 + i] += v; R[i0 + i] += v * 0.8;
      }
    },
    roomTone(L, R, sr, vol) {
      let b = 0;
      for (let i = 0; i < L.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; const v = b * (vol || 0.25) * 3 + Math.sin((2 * Math.PI * 60 * i) / sr) * 0.004; L[i] += v; R[i] += v; }
    },
    breath(L, R, sr, t, dur, vol) {
      const i0 = Math.floor(t * sr), len = Math.floor(dur * sr); let lp = 0, bp = 0;
      for (let i = 0; i < len && i0 + i < L.length; i++) {
        const x = i / len; const env = Math.pow(Math.sin(Math.PI * x), 2);
        const nz = Math.random() * 2 - 1; lp += (nz - lp) * 0.25; bp += (lp - bp) * 0.08;
        const v = (lp - bp) * env * (vol || 0.4);
        L[i0 + i] += v; R[i0 + i] += v;
      }
    },
    dtmf(L, R, sr, t, key, dur, vol) {
      const f = A.DTMF[key]; if (!f) return; const i0 = Math.floor(t * sr), len = Math.floor((dur || 0.25) * sr);
      for (let i = 0; i < len && i0 + i < L.length; i++) {
        const e = Math.min(1, i / (sr * 0.004), (len - i) / (sr * 0.004));
        const v = (Math.sin((2 * Math.PI * f[0] * i) / sr) + Math.sin((2 * Math.PI * f[1] * i) / sr)) * 0.5 * e * (vol || 0.35);
        L[i0 + i] += v; R[i0 + i] += v;
      }
    },
    tone(L, R, sr, t, freq, dur, vol) {
      const i0 = Math.floor(t * sr), len = Math.floor(dur * sr);
      for (let i = 0; i < len && i0 + i < L.length; i++) { const e = Math.min(1, i / (sr * 0.01), (len - i) / (sr * 0.05)); const v = Math.sin((2 * Math.PI * freq * i) / sr) * e * (vol || 0.2); L[i0 + i] += v; R[i0 + i] += v; }
    },
  };

  /* ---------- TTS (always pair with subtitles) ---------- */
  A.speak = function (text, opts) {
    opts = opts || {};
    try {
      if (!('speechSynthesis' in window) || !G.settings || G.settings.voice === false) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = opts.rate || 0.82; u.pitch = opts.pitch != null ? opts.pitch : 0.4; u.volume = opts.volume || 0.9;
      const vs = speechSynthesis.getVoices().filter((v) => /ko/i.test(v.lang));
      if (vs.length) u.voice = vs[opts.voiceIndex || 0] || vs[0];
      speechSynthesis.speak(u);
    } catch (e) {}
  };
  A.stopSpeak = function () { try { speechSynthesis.cancel(); } catch (e) {} };

  A.osc = (...a) => osc(...a);
  A.noise = (...a) => noise(...a);
  A.mtof = mtof;
  A.ok = ok;
  A.now = () => A.ctx.currentTime;
  A.bus = bus;
  G.audio = A;
})();
