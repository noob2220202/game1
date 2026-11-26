/* =========================================================
 * 하루를 위한 방탈출! 2 — Audio engine core (engine/core/audio.js · owner: audio)
 * Everything audible is synthesized live with WebAudio (DESIGN §7). Only the TTS lines are files
 * (G.AUDIO_BASE + id + '.wav', lazily decoded; missing → subtitles only). No <audio>/<video> elements,
 * no microphone, no speechSynthesis (ARCH §1, §7.3).
 *
 * Signal graph (§7.1.1):  sources → bus ui | voice | sfx | world | amb* | music | mediaOut
 *                          → master → hearing LPF → compressor (ep1 settings) → out
 *                          *amb → in-app LP 900 / −6 dB (room view closed) → roomLP (B08) → master
 *
 * Public API (this file; spatial.js adds the rest — see its header):
 *   G.audio.init()                       listeners only (no AudioContext). Called by flow G.main.boot(); also lazily by unlock().
 *   G.audio.unlock() → Promise<bool>     idempotent; AudioContext create/resume inside the gesture + iOS audioSession 'playback'
 *                                        + silent tick. true when the context runs. Starts idle preparation (TTS + render buffers).
 *   G.audio.ok() · .ctx · .bus(name) · .setEnabled(on) · .setVolume(v 0..1)   (extra bus 'jump' = B14 handle/sting, never silence-dropped)
 *   G.audio.sub(subId, { az, text, ms, force }) → void      G.SUBS lookup (§7.4 rules — info vs all, mono first + 0.5 s,
 *                                        c2Src video wording, same id de-duplicated), → G.room.dirSub(text, az, ms) when the
 *                                        room view is open and the sub has a direction, else G.fx.sub(text, ms, {az}).
 *   G.audio.subBusy() → bool             a sound subtitle is on screen now (climax: S07 "every 20 s when no other sub")
 *   G.audio.vibrate(key)                 'm2' 'him' 'n' 'fp' 'pin' 'drill' 'b14' (§7.1.7); 덜 무섭게 ⇒ drill/b14 0;
 *                                        no vibration API (iOS) ⇒ 2 px edge shake + low buzz (§9.7)
 *   G.audio.cue(id, opts) → handle|undefined   THE entry point for every §7.2 cue (registry in spatial.js). No-op before
 *                                        unlock and while the pause menu is open (ARCH §9 G33).
 *   G.audio.voice(id) → Promise<AudioBuffer|null>   G.AUDIO_FILES ids (array or {id:path}); file:// → null (no fetch)
 *   G.audio.silenceDrop(ms, { keep:['mediaOut'] })  §7.1.1 — keep ⇒ only the other buses τ 12 ms → 0, back τ 0.4 s
 *   G.audio.sfx.{tap,key,back,msgSend,error,unlock,whoosh,pen,pageTurn, …}()   ep1 UI cues kept (knock & ep1 stingers removed)
 *   G.audio.every(fn(ctxTime)) → off()   ctx-clock ticker (50 ms; silent while the context is not running)
 *   G.audio.restore()                    re-applies persisted loops (vars.au: ambiences + GSM) — called by unlock()
 *   G.audio.hush(on, { roomDb:-52 })     B23 black: ambience 0 except room tone −52 dBFS, world/sfx/mediaOut 0; the phone (ui/music/voice) stays
 *   G.audio.osc / noise / mtof / db / makeIR / renderBuffer / playBuffer   shared helpers (ep1 signatures)
 * Resume chip `🔈 소리 다시 켜기` (G.e2.STR.resume) at z 500 (ARCH §2.3), data-qa "audio.resume".
 * Bus events listened: settings · pause {open} · room:open · room:close · flag:gotPhone · mono:show · mono:hide
 * Flags set: none (tones.js sets toneRestored). Owner-private state: G.state.vars.au.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const A = (G.audio = G.audio || {});

  Object.assign(A, {
    ctx: null, master: null, buses: {}, enabled: true, volume: 0.9, ambient: {}, unlocked: false,
    paused: false, inApp: false, stats: { sources: 0, hrtf: 0 },
  });
  A.BUSES = ['ui', 'voice', 'sfx', 'world', 'amb', 'music', 'mediaOut'];
  const BUS_DEF = { ui: 0.55, voice: 1, sfx: 1, world: 1, amb: 0.8, music: 1, mediaOut: 1 };

  /* ---------------- small utils ---------------- */
  const S0 = () => G.settings || {};
  const warn = (...a) => { if (G.DEBUG) console.warn('[audio]', ...a); };
  const db = (x) => Math.pow(10, x / 20);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  A.db = db; A.mtof = mtof; A.clamp = clamp; A.warn = warn;
  A.speakerMode = () => S0().audioMode === 'speaker';
  A.less = () => { try { if (G.e2 && G.e2.less) return !!G.e2.less(); } catch (e) {} return !!S0().scares && S0().scares !== 'full'; };
  A.lowEnd = () => { try { return !!(G.e2 && G.e2.lowEnd && G.e2.lowEnd()); } catch (e) { return false; } };
  function vars() { return (G.state && G.state.vars) || null; }
  function au() { const v = vars(); if (!v) return {}; return (v.au = v.au || {}); }
  A._au = au;
  A._saveSoon = () => { try { G.save && G.save(); } catch (e) {} };

  function now() { return A.ctx ? A.ctx.currentTime : 0; }
  function ok() { return !!(A.enabled && A.ctx && A.ctx.state !== 'closed'); }
  A.ok = ok;
  A.now = now;

  /* =========================================================
   * Graph
   * ========================================================= */
  function build() {
    const c = A.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    A.comp = comp;
    A.master = c.createGain(); A.master.gain.value = A.enabled ? A.volume : 0;
    A.hearing = c.createBiquadFilter(); A.hearing.type = 'lowpass'; A.hearing.frequency.value = 20000; A.hearing.Q.value = 0.5;
    A.master.connect(A.hearing); A.hearing.connect(comp); comp.connect(c.destination);
    A.out = comp;
    A.BUSES.forEach((k) => { const g = c.createGain(); g.gain.value = BUS_DEF[k]; A.buses[k] = g; });
    A.BUSES.forEach((k) => { if (k !== 'amb') A.buses[k].connect(A.master); });
    // 'jump': the B14 handle + sting only — outside silenceDrop so the hit lands at full level the moment the silence ends
    A.buses.jump = c.createGain(); A.buses.jump.connect(A.master);
    // amb: in-app LP + −6 dB (§7.1.1), then B08 roomLP
    A.ambAppLP = c.createBiquadFilter(); A.ambAppLP.type = 'lowpass'; A.ambAppLP.frequency.value = 20000; A.ambAppLP.Q.value = 0.5;
    A.ambRoomLP = c.createBiquadFilter(); A.ambRoomLP.type = 'lowpass'; A.ambRoomLP.frequency.value = 20000; A.ambRoomLP.Q.value = 0.6;
    A.ambApp = c.createGain(); A.ambApp.gain.value = 1;
    A.buses.amb.connect(A.ambAppLP); A.ambAppLP.connect(A.ambRoomLP); A.ambRoomLP.connect(A.ambApp); A.ambApp.connect(A.master);
    A._busTarget = {}; A.BUSES.forEach((k) => { A._busTarget[k] = BUS_DEF[k]; });

    A._white = mkNoise(c, 4, 'white'); A._brown = mkNoise(c, 6, 'brown'); A._pink = mkNoise(c, 6, 'pink');
    A._noise = A._white;
    NB.set(c, { white: A._white, brown: A._brown, pink: A._pink });

    // small room reverb (ir601-like) used by `send` of the ep1 helpers
    A.reverb = c.createConvolver(); A.reverb.buffer = makeIR(c, 0.35, 2.6, 0.5);
    const rg = c.createGain(); rg.gain.value = 0.5; A.reverb.connect(rg); rg.connect(A.master);

    // the phone in the hand (§9.7): no spatialisation — phone speaker EQ HP 350 · LP 7 kHz · mono → ui
    const mono = c.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350; hp.Q.value = 0.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = 0.7;
    mono.connect(hp); hp.connect(lp); lp.connect(A.buses.ui);
    A._phoneSpk = mono;
  }
  A.bus = function (name) { return A.buses[name] || A.buses.sfx; };
  A.phoneOut = function () { return A._phoneSpk || A.bus('ui'); };

  /* ---------------- buffers ---------------- */
  const NB = new WeakMap();   // ctx → {white, brown, pink}
  function mkNoise(c, sec, kind) {
    const len = Math.floor(c.sampleRate * sec), ch = kind === 'white' ? 1 : 2;
    const b = c.createBuffer(ch, len, c.sampleRate);
    for (let k = 0; k < ch; k++) {
      const d = b.getChannelData(k);
      if (kind === 'white') { for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
      else if (kind === 'brown') { let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } }
      else { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; } }
      // loop seam
      const f = Math.min(len >> 3, 512); for (let i = 0; i < f; i++) { const g = i / f; d[i] = d[i] * g + d[len - f + i] * (1 - g); }
    }
    return b;
  }
  function bufs(c) { let b = NB.get(c); if (!b) { b = { white: mkNoise(c, 3, 'white'), brown: mkNoise(c, 4, 'brown'), pink: mkNoise(c, 4, 'pink') }; NB.set(c, b); } return b; }
  A.noiseBuffers = bufs;
  /** stereo impulse response (ep1 makeIR) + optional early reflections [[ms, gain], …] */
  function makeIR(c, sec, decay, bright, early) {
    const len = Math.max(64, Math.floor(c.sampleRate * sec));
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * (bright || 0.4); d[i] = lp * Math.pow(1 - i / len, decay); }
      (early || []).forEach(([ms, g], k) => { const i0 = Math.floor((ms / 1000) * c.sampleRate) + (ch ? 7 + k : 0); for (let i = 0; i < 48 && i0 + i < len; i++) d[i0 + i] += (Math.random() * 2 - 1) * g * Math.exp(-i / 10); });
    }
    return b;
  }
  A.makeIR = makeIR;

  /* ---------------- tiny graph helpers (work on any context, incl. OfflineAudioContext) ---------------- */
  function count(c) { if (c === A.ctx) A.stats.sources++; }
  function oscC(c, type, freq, t, dur, gainPeak, out, opts) {
    opts = opts || {};
    const o = c.createOscillator();
    if (type === 'pulse' && opts.wave) o.setPeriodicWave(opts.wave); else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) { if (opts.lin) o.frequency.linearRampToValueAtTime(opts.to, t + (opts.glide || dur)); else o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + (opts.glide || dur)); }
    if (opts.detune) o.detune.setValueAtTime(opts.detune, t);
    const g = c.createGain();
    const a = opts.a != null ? opts.a : 0.005, r = opts.r != null ? opts.r : 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, gainPeak), t + a);
    if (opts.decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(Math.max(0.0001, gainPeak), t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    o.connect(g);
    let last = g;
    if (opts.filter) { const f = c.createBiquadFilter(); f.type = opts.filter.type || 'lowpass'; f.frequency.value = opts.filter.freq; f.Q.value = opts.filter.Q || 0.7; if (opts.filter.gain != null) f.gain.value = opts.filter.gain; g.connect(f); last = f; }
    if (opts.pan != null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = opts.pan; last.connect(p); last = p; }
    last.connect(out);
    const sendTo = opts.sendTo || (c === A.ctx ? A.reverb : null);
    if (opts.send && sendTo) { const s = c.createGain(); s.gain.value = opts.send; last.connect(s); s.connect(sendTo); }
    o.start(t); o.stop(t + dur + 0.05);
    count(c);
    return o;
  }
  function noiseC(c, t, dur, gainPeak, out, opts) {
    opts = opts || {};
    const B = bufs(c);
    const src = c.createBufferSource(); src.buffer = opts.brown ? B.brown : opts.pink ? B.pink : B.white; src.loop = true;
    const off = Math.random() * 2;
    const g = c.createGain();
    const a = opts.a != null ? opts.a : 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, gainPeak), t + a);
    if (opts.flat) { g.gain.setValueAtTime(Math.max(0.0001, gainPeak), t + Math.max(a, dur - (opts.r || 0.05))); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.001, dur));
    let node = src;
    (opts.filters || []).forEach((fd) => {
      const f = c.createBiquadFilter(); f.type = fd.type; f.frequency.setValueAtTime(fd.freq, t);
      if (fd.to) f.frequency.exponentialRampToValueAtTime(fd.to, t + dur);
      f.Q.value = fd.Q || 0.8; if (fd.gain != null) f.gain.value = fd.gain; node.connect(f); node = f;
    });
    node.connect(g);
    let last = g;
    if (opts.pan != null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = opts.pan; g.connect(p); last = p; }
    last.connect(out);
    const sendTo = opts.sendTo || (c === A.ctx ? A.reverb : null);
    if (opts.send && sendTo) { const s = c.createGain(); s.gain.value = opts.send; last.connect(s); s.connect(sendTo); }
    src.start(t, off); src.stop(t + dur + 0.05);
    count(c);
    return src;
  }
  A.oscC = oscC; A.noiseC = noiseC;
  A.osc = (...a) => (A.ctx ? oscC(A.ctx, ...a) : null);
  A.noise = (...a) => (A.ctx ? noiseC(A.ctx, ...a) : null);
  A.gainNode = function (v, out, c) { c = c || A.ctx; const g = c.createGain(); g.gain.value = v; if (out) g.connect(out); return g; };
  A.filter = function (type, freq, Q, gain, c) { c = c || A.ctx; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q || 0.707; if (gain != null) f.gain.value = gain; return f; };
  /** chain(nodes…) connects them left→right and returns {input, output} */
  A.chain = function (...nodes) { nodes = nodes.filter(Boolean); for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return { input: nodes[0], output: nodes[nodes.length - 1] }; };

  /* ---------------- ctx-clock ticker (all long loops schedule against ctx.currentTime) ---------------- */
  const tickers = new Set();
  let tickTimer = null;
  A.every = function (fn) {
    tickers.add(fn);
    if (!tickTimer) tickTimer = setInterval(() => {
      if (!A.ctx || A.ctx.state !== 'running') return;
      const t = A.ctx.currentTime;
      tickers.forEach((f) => { try { f(t); } catch (e) { console.error('[audio] ticker', e); } });
    }, 50);
    return () => tickers.delete(fn);
  };

  /* =========================================================
   * Unlock · lifecycle (§9.7, §7.1.7)
   * ========================================================= */
  let inited = false;
  A.init = function () {
    if (inited) return; inited = true;
    applySettings();
    const on = (ev, fn) => { try { G.bus && G.bus.on && G.bus.on(ev, fn); } catch (e) {} };
    on('settings', applySettings);
    on('pause', (p) => { A.paused = !!(p && p.open); });
    on('room:open', updInApp); on('room:close', () => setTimeout(updInApp, 0)); on('flag:gotPhone', updInApp);
    on('flag:off:gotPhone', updInApp);
    on('flag:M0', () => { if (A._hush) A.hush(false); });
    on('mono:show', () => { monoOn = true; });
    on('mono:hide', () => { monoOn = false; monoEnd = performance.now(); flushSubs(); });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', () => { if (!document.hidden) resumeCtx(true); });
    window.addEventListener('pointerup', onPointer, true);
    window.addEventListener('pointerdown', () => { if (A.ctx && A.ctx.state !== 'running' && !document.hidden && A.enabled) resumeCtx(false); }, true);
    window.addEventListener('keydown', onPointer, true);
    (A._initHooks || []).forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  };

  A.unlock = function () {
    A.init();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!A.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { A.enabled = false; warn('no WebAudio — subtitles only'); return Promise.resolve(false); }
      try { A.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { A.ctx = new AC(); } catch (e2) { A.enabled = false; console.warn('[audio] no WebAudio', e2); return Promise.resolve(false); } }
      try { build(); } catch (e) { console.error('[audio] build', e); A.enabled = false; return Promise.resolve(false); }
      A.unlocked = true;
      A.ctx.onstatechange = onState;
      applySettings();
      // iOS needs real playback inside the gesture
      try { const b = A.ctx.createBuffer(1, 1, 22050); const s = A.ctx.createBufferSource(); s.buffer = b; s.connect(A.master); s.start(0); } catch (e) {}
      try { const o = A.ctx.createOscillator(); const g = A.ctx.createGain(); g.gain.value = 0.0001; o.connect(g); g.connect(A.master); o.start(); o.stop(A.ctx.currentTime + 0.05); } catch (e) {}
      updInApp();
      (A._readyHooks || []).forEach((f) => { try { f(); } catch (e) { console.error('[audio] ready hook', e); } });
    }
    const p = resumeCtx(false);
    return p.then((r) => { if (r) chip(false); return r; });
  };
  A.onInit = function (fn) { (A._initHooks = A._initHooks || []).push(fn); if (inited) fn(); };
  A.onReady = function (fn) { (A._readyHooks = A._readyHooks || []).push(fn); if (A.ctx) fn(); };

  function resumeCtx(fade) {
    if (!A.ctx) return Promise.resolve(false);
    if (A.ctx.state === 'running') { if (fade) fadeIn(0.8); return Promise.resolve(true); }
    if (document.hidden) return Promise.resolve(false);
    let p;
    try { p = A.ctx.resume(); } catch (e) { p = null; }
    const done = () => A.ctx.state === 'running';
    return Promise.race([Promise.resolve(p).then(done, done), new Promise((r) => setTimeout(() => r(done()), 450))]).then((r) => { if (r && fade) fadeIn(0.8); return r; });
  }
  function fadeIn(sec) {
    if (!A.master || A._hush) return;
    const t = now(), g = A.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(A.enabled ? A.volume : 0.0001, t + sec);
  }
  function onVis() {
    if (!A.ctx) return;
    if (document.hidden) { try { A.ctx.suspend(); } catch (e) {} }
    else resumeCtx(true);
  }
  function onState() {
    if (!A.ctx) return;
    if (A.ctx.state === 'running') chip(false);
  }
  let chipTimer = null;
  function onPointer() {
    if (!A.ctx || !A.enabled || document.hidden || S0().sound === false) return;
    if (A.ctx.state === 'running') return;
    resumeCtx(false).then((r) => {
      clearTimeout(chipTimer);
      if (!r) chipTimer = setTimeout(() => { if (A.ctx && A.ctx.state !== 'running' && !document.hidden) chip(true); }, 150);
    });
  }
  /* resume chip — app UI, never a hint (§9.7). z 500 (ARCH §2.3). */
  let chipEl = null;
  function chip(show) {
    if (!show) { if (chipEl) chipEl.style.display = 'none'; return; }
    if (!chipEl) {
      chipEl = document.createElement('button');
      chipEl.type = 'button';
      chipEl.setAttribute('data-qa', 'audio.resume');
      chipEl.textContent = (G.e2 && G.e2.STR && G.e2.STR.resume) || '🔈 소리 다시 켜기';
      chipEl.style.cssText = 'position:absolute;left:50%;bottom:calc(72px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:500;'
        + 'min-height:44px;min-width:44px;padding:0 20px;border-radius:22px;border:1px solid rgba(255,255,255,.18);background:rgba(28,28,30,.88);'
        + 'color:#fff;font:600 15px/1 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;'
        + 'letter-spacing:-.01em;box-shadow:0 6px 24px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);cursor:pointer;'
        + 'white-space:nowrap;touch-action:manipulation;-webkit-tap-highlight-color:transparent';
      const stop = (e) => e.stopPropagation();
      chipEl.addEventListener('pointerdown', stop); chipEl.addEventListener('pointerup', stop);
      chipEl.addEventListener('click', (e) => { e.stopPropagation(); A.unlock().then((r) => { if (r) chip(false); }); });
      (document.getElementById('screen') || document.body).appendChild(chipEl);
    }
    chipEl.style.display = '';
  }
  A._chip = chip;

  /* ---------------- settings ---------------- */
  let lastMode = null;
  function applySettings() {
    const s = S0();
    A.enabled = s.sound !== false;
    A.volume = typeof s.volume === 'number' ? clamp(s.volume, 0, 1) : 0.9;
    if (A.master && !A._hush) A.master.gain.setTargetAtTime(A.enabled ? A.volume : 0, now(), 0.05);
    const mode = A.speakerMode() ? 'speaker' : 'ear';
    if (lastMode && mode !== lastMode && A._onModeChange) { try { A._onModeChange(mode); } catch (e) { console.error(e); } }
    lastMode = mode;
    if (!A.enabled) chip(false);
  }
  A.applySettings = applySettings;
  A.setEnabled = function (on) { A.enabled = !!on; if (A.master && !A._hush) A.master.gain.setTargetAtTime(on ? A.volume : 0, now(), 0.05); };
  A.setVolume = function (v) { A.volume = clamp(+v || 0, 0, 1); if (A.master && A.enabled && !A._hush) A.master.gain.setTargetAtTime(A.volume, now(), 0.05); };

  /* ---------------- in-app rule (§7.1.1): amb −6 dB · LP 900 while the room view is closed ---------------- */
  function updInApp() {
    const room = !!(G.room && G.room.isOpen && G.room.isOpen());
    const has = !!(G.flag && G.flag('gotPhone'));
    A.inApp = has && !room;
    if (!A.ctx || !A.ambApp) return;
    const t = now();
    A.ambApp.gain.setTargetAtTime(A.inApp ? db(-6) : 1, t, 0.15);
    A.ambAppLP.frequency.setTargetAtTime(A.inApp ? 900 : 20000, t, 0.15);
  }
  A.updateInApp = updInApp;

  /* ---------------- silenceDrop (§7.1.1, B14) ---------------- */
  A.silenceDrop = function (ms, o) {
    if (!ok()) return; o = o || {};
    const t = now(), back = t + (ms || 80) / 1000;
    if (!o.keep || !o.keep.length) {
      const g = A.master.gain; g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.012); g.setTargetAtTime(A.enabled ? A.volume : 0, back, 0.4);
      return;
    }
    A.BUSES.forEach((k) => {
      if (o.keep.indexOf(k) >= 0) return;
      const g = A.buses[k].gain; g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.012); g.setTargetAtTime(A._busTarget[k], back, 0.4);
    });
  };
  /* B23 (§6.4-③): the world goes silent — every ambience 0 except the room tone at −52 dBFS, world/sfx/mediaOut buses 0.
     The phone itself (ui · music · voice: his tone, the voice message) stays live. Auto-released when a new night starts (flag:M0). */
  const HUSHED = ['world', 'sfx', 'mediaOut'];
  A.hush = function (on, o) {
    o = o || {};
    A._hush = !!on;
    if (!ok()) return;
    const t = now();
    HUSHED.forEach((k) => { const g = A.buses[k].gain; g.cancelScheduledValues(t); g.setTargetAtTime(on ? 0 : A._busTarget[k], t, on ? 0.05 : 0.6); });
    if (A._hushAmb) A._hushAmb(!!on, o.roomDb != null ? o.roomDb : -52);
    A.master.gain.setTargetAtTime(A.enabled ? A.volume : 0, t, 0.05);
  };

  /* =========================================================
   * Subtitles (§7.4)
   * ========================================================= */
  let monoOn = false, monoEnd = 0, lastSubEnd = 0;
  const subQ = [], lastShown = {};
  const DEDUPE = { S07: 10000, S01: 60000, S00: 60000 };
  A.sub = function (id, o) {
    o = o || {};
    const T = (G.SUBS && G.SUBS[id]) || null;
    let text = o.text != null ? o.text : T && T.text;
    if (!text) { warn('sub: unknown id', id); return; }
    const kind = o.kind || (T && T.kind) || 'info';
    const mode = S0().subs || 'info';
    if (mode === 'off' && kind !== 'voice') return;
    if (kind === 'mood' && mode !== 'all') return;
    let c2 = null; try { c2 = G.vars ? G.vars('c2Src') : null; } catch (e) {}
    if (o.text == null && T && T.video && c2 === 'video') text = T.video;
    const az = o.az !== undefined ? o.az : (T ? T.az : null);
    const ms = o.ms || (T && T.ms) || 3200;
    const tnow = performance.now();
    const dd = DEDUPE[id] != null ? DEDUPE[id] : 1200;
    if (!o.force && lastShown[id] && tnow - lastShown[id] < dd) return;
    lastShown[id] = tnow;
    const item = { text, az: typeof az === 'number' ? az : null, ms };
    if (monoOn || tnow < monoEnd + 500) { subQ.push(item); if (!monoOn) setTimeout(flushSubs, monoEnd + 520 - tnow); return; }
    render(item);
  };
  function flushSubs() {
    if (monoOn) return;
    const wait = monoEnd + 500 - performance.now();
    if (wait > 0) { setTimeout(flushSubs, wait + 10); return; }
    while (subQ.length) render(subQ.shift());
  }
  function render(it) {
    let t = it.text;
    try { t = G.T ? G.T(t) : t; } catch (e) {}
    lastSubEnd = performance.now() + it.ms;
    const roomOpen = !!(G.room && G.room.isOpen && G.room.isOpen());
    try {
      if (roomOpen && it.az != null && G.room.dirSub) G.room.dirSub(t, it.az, it.ms);
      else if (G.fx && G.fx.sub) G.fx.sub(t, it.ms, it.az != null ? { az: it.az } : {});
    } catch (e) { console.error('[audio] sub', e); }
  }
  A.subBusy = () => performance.now() < lastSubEnd;

  /* =========================================================
   * Vibration (§7.1.7 table, §9.7) — callers pass the key
   * ========================================================= */
  const VIB = { m2: [60, 80, 60], him: [60, 60, 60], n: [40], fp: [15], pin: [80], drill: [30], b14: [90, 40, 160] };
  A.VIB = VIB;
  let coarse = null;
  A.vibrate = function (key) {
    const p = Array.isArray(key) ? key : VIB[key];
    if (!p) { warn('vibrate: unknown key', key); return; }
    if ((key === 'drill' || key === 'b14') && A.less()) return;
    if (S0().vibration === false) return;
    if (navigator.vibrate) {
      // no vibrate before the first user gesture (Chrome logs an intervention error otherwise — debug jumps)
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      try { navigator.vibrate(p); } catch (e) {} return;
    }
    // iOS: no vibration API → 2 px edge shake + a low buzz at the same moment (§9.7)
    if (coarse == null) { try { coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; } }
    if (!coarse || key === 'fp') return;
    const total = p.reduce((s, x) => s + x, 0);
    try { G.fx && G.fx.edgeShake && G.fx.edgeShake(2, Math.min(400, total + 60)); } catch (e) {}
    if (!ok()) return;
    let t = now();
    for (let i = 0; i < p.length; i += 2) {
      const d = p[i] / 1000;
      oscC(A.ctx, 'sawtooth', 148, t, d, 0.035, A.bus('sfx'), { a: 0.006, r: 0.02, filter: { type: 'lowpass', freq: 380, Q: 2 } });
      t += d + (p[i + 1] || 0) / 1000;
    }
  };

  /* =========================================================
   * Cue dispatcher (registry filled by spatial.js)
   * ========================================================= */
  A._cues = A._cues || {};
  const ALIAS = { 'share.chime': 'nearby.chime', 'musicbox.box15': 'box15', 'gsm.tank': 'gsm' };
  A.cue = function (id, opts) {
    if (!ok() || A.paused) return undefined;
    if (id === 'hinge.none') return undefined;            // not a cue — a silence spec (§7.2 B)
    id = ALIAS[id] || id;
    if (/^amb\./.test(id)) { A.amb && A.amb(id.slice(4), opts == null ? true : opts.on != null ? opts.on : true, opts); return undefined; }
    const fn = A._cues[id];
    if (!fn) { warn('cue: unknown id', id); return undefined; }
    try { return fn(opts || {}); } catch (e) { console.error('[audio] cue ' + id, e); return undefined; }
  };
  A.defineCue = function (id, fn) { A._cues[id] = fn; };

  /* =========================================================
   * TTS voice files (§7.3) — lazily fetched + decoded, cached; never speechSynthesis
   * ========================================================= */
  const voiceCache = {};
  function voiceUrl(id) {
    const F = G.AUDIO_FILES;
    if (F && !Array.isArray(F) && typeof F === 'object' && typeof F[id] === 'string') return F[id];
    return (G.AUDIO_BASE || 'assets/audio/') + id + '.wav';
  }
  A.voiceUrl = voiceUrl;
  function decode(ab) {
    return new Promise((res) => {
      try {
        const p = A.ctx.decodeAudioData(ab, (b) => res(b), () => res(null));
        if (p && p.then) p.then(res, () => res(null));
      } catch (e) { res(null); }
    });
  }
  A.voice = function (id) {
    if (voiceCache[id]) return voiceCache[id];
    if (!A.ctx) return Promise.resolve(null);            // decode needs the context (after the start tap)
    const F = G.AUDIO_FILES;
    if (Array.isArray(F) && F.indexOf(id) < 0) warn('voice: id not in G.AUDIO_FILES', id);
    voiceCache[id] = new Promise((res) => {
      if (location.protocol === 'file:' || typeof fetch !== 'function') { res(null); return; }   // file:// → subtitles only (ARCH §7-1)
      let done = false;
      const to = setTimeout(() => { if (!done) { done = true; res(null); } }, 15000);
      fetch(voiceUrl(id)).then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => (ab ? decode(ab) : null))
        .then((b) => { if (!done) { done = true; clearTimeout(to); res(b || null); } })
        .catch(() => { if (!done) { done = true; clearTimeout(to); res(null); } });
    });
    return voiceCache[id];
  };

  /* ---------------- buffer playback (ep1 signature) ---------------- */
  A.playBuffer = function (buffer, opts) {
    opts = opts || {};
    if (!ok() || !buffer) return null;
    const c = A.ctx;
    const src = c.createBufferSource(); src.buffer = buffer;
    if (opts.rate) src.playbackRate.value = opts.rate;
    if (opts.loop) src.loop = true;
    const g = c.createGain(); g.gain.value = opts.gain != null ? opts.gain : 1;
    const an = c.createAnalyser(); an.fftSize = opts.fftSize || 2048; an.smoothingTimeConstant = opts.smoothing != null ? opts.smoothing : 0.2;
    an.minDecibels = -100; an.maxDecibels = -20;
    src.connect(g); g.connect(an);
    let last = an;
    if (opts.pan != null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = opts.pan; an.connect(p); last = p; }
    last.connect(opts.out || A.bus(opts.bus || 'voice'));
    const startAt = now() + (opts.when || 0);
    src.start(startAt, opts.offset || 0);
    count(c);
    const h = { src, gain: g, analyser: an, startAt, duration: buffer.duration / (opts.rate || 1), stopped: false,
      stop(fade) { if (h.stopped) return; h.stopped = true; try { if (fade) { g.gain.setTargetAtTime(0, now(), fade / 3); src.stop(now() + fade + 0.05); } else src.stop(); } catch (e) {} },
      position() { return (now() - startAt) * (opts.rate || 1) + (opts.offset || 0); } };
    src.onended = () => { h.stopped = true; opts.onEnd && opts.onEnd(); };
    return h;
  };
  /** Render a buffer procedurally: fn(dataL, dataR, sr) (ep1) */
  A.renderBuffer = function (seconds, fn, sr, c) {
    c = c || A.ctx; if (!c) return null;
    sr = sr || c.sampleRate;
    const b = c.createBuffer(2, Math.max(1, Math.floor(seconds * sr)), sr);
    fn(b.getChannelData(0), b.getChannelData(1), sr);
    return b;
  };

  /* =========================================================
   * UI sounds (ep1 `S.*` kept — §7.2 D `ui.*`)
   * ========================================================= */
  const S = (A.sfx = A.sfx || {});
  const ui = () => A.bus('ui');
  S.tap = function () { if (!ok()) return; const t = now(); A.osc('sine', 1800, t, 0.03, 0.08, ui(), { a: 0.001, decay: true }); };
  S.key = function () { if (!ok()) return; const t = now(); A.noise(t, 0.035, 0.12, ui(), { filters: [{ type: 'bandpass', freq: 3200, Q: 1.2 }] }); };
  S.back = function () { if (!ok()) return; const t = now(); A.osc('sine', 1200, t, 0.05, 0.06, ui(), { decay: true }); A.osc('sine', 900, t + 0.03, 0.05, 0.05, ui(), { decay: true }); };
  S.msgSend = function () { if (!ok()) return; const t = now(); A.noise(t, 0.18, 0.08, ui(), { filters: [{ type: 'bandpass', freq: 900, to: 4000, Q: 1.5 }] }); };
  S.error = function () { if (!ok()) return; const t = now(); A.osc('square', 180, t, 0.12, 0.06, ui(), { filter: { freq: 1200 } }); A.osc('square', 140, t + 0.14, 0.18, 0.06, ui(), { filter: { freq: 1200 } }); };
  S.unlock = function () { if (!ok()) return; const t = now(); A.noise(t, 0.08, 0.15, ui(), { filters: [{ type: 'highpass', freq: 2500 }] }); A.osc('sine', 660, t + 0.02, 0.1, 0.06, ui(), { decay: true }); };
  S.lockClick = function () { if (!ok()) return; const t = now(); A.noise(t, 0.05, 0.3, ui(), { filters: [{ type: 'bandpass', freq: 1800, Q: 2 }] }); A.osc('sine', 220, t, 0.06, 0.1, ui(), { decay: true }); };
  S.whoosh = function (gainDb) { if (!ok()) return; const t = now(); A.noise(t, 0.45, 0.12 * db(gainDb || 0), A.bus('sfx'), { a: 0.15, filters: [{ type: 'bandpass', freq: 300, to: 2400, Q: 0.8 }] }); };
  S.pageTurn = function () { if (!ok()) return; const t = now(); A.noise(t, 0.25, 0.12, ui(), { a: 0.05, filters: [{ type: 'bandpass', freq: 3000, Q: 0.7 }] }); };
  S.pen = function () { if (!ok()) return; const t = now(); A.noise(t, 0.3, 0.06, ui(), { a: 0.05, filters: [{ type: 'bandpass', freq: 5000, Q: 1.5 }] }); };
  S.shutter = function () { if (!ok()) return; const t = now(), b = A.bus('sfx'); A.noise(t, 0.05, 0.4, b, { filters: [{ type: 'highpass', freq: 1500 }] }); A.noise(t + 0.09, 0.07, 0.3, b, { filters: [{ type: 'bandpass', freq: 2500, Q: 1 }] }); };
  S.flashlight = function (on) { if (!ok()) return; const t = now(); A.noise(t, 0.03, 0.25, ui(), { filters: [{ type: 'bandpass', freq: on ? 2600 : 1800, Q: 3 }] }); };
  S.camOn = function () { if (!ok()) return; const t = now(); A.osc('sine', 120, t, 0.25, 0.05, ui(), { a: 0.02 }); A.noise(t, 0.2, 0.06, ui(), { filters: [{ type: 'bandpass', freq: 4000, Q: 2 }] }); };
  S.keyErase = function () { if (!ok()) return; const t = now(); A.noise(t, 0.012, 0.12, ui(), { filters: [{ type: 'bandpass', freq: 4000, Q: 1 }] }); A.osc('sine', 180, t, 0.03, 0.05, ui(), { a: 0.001, decay: true }); };
  S.success = function () { if (!ok()) return; const t = now(); [72, 76, 79].forEach((m, i) => A.osc('sine', mtof(m + 12), t + i * 0.09, 0.4, 0.09, ui(), { decay: true, send: 0.1 })); };
  /* DTMF — the real telephone keypad (전화 app keypad) */
  const DTMF = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477] };
  A.DTMF = DTMF;
  S.dtmf = function (k, dur, gain) { if (!ok() || !DTMF[k]) return; const t = now(); dur = dur || 0.16; gain = gain || 0.1; A.osc('sine', DTMF[k][0], t, dur, gain, ui(), { a: 0.004, r: 0.01 }); A.osc('sine', DTMF[k][1], t, dur, gain * 0.9, ui(), { a: 0.004, r: 0.01 }); };
  /* the phone's own vibration motor (pattern ms) — real vibration through G.audio.vibrate */
  S.buzz = function (pattern) { if (Array.isArray(pattern)) A.vibrate(pattern); };
  /* ep1 tricks are not reused in ep2 (ARCH §1): knock, stingers, glitch, whispers, ep1 notification tones … */
  ['knock', 'scratch', 'creak', 'thud', 'static', 'glitch', 'stinger', 'riser', 'breath', 'whisper', 'footsteps', 'heartbeat',
    'notify', 'msgIn', 'msgHim', 'msgMom', 'msgFriend', 'msgAlbum', 'tone', 'ringMom', 'ringHaru', 'stingJS1', 'stingJS2', 'doorSlam',
    'sirenPolice', 'policeKnock', 'scratchAt', 'rackFall', 'bedCreak', 'breathNear', 'sensorLight', 'alarmTrap', 'mfaAlert', 'castEnd', 'batteryLow']
    .forEach((k) => { if (!S[k]) S[k] = function () { warn('sfx.' + k + ' is not used in ep2 (route it through G.audio.cue / G.tones)'); return { stop() {} }; }; });
  A.speak = function () { warn('speechSynthesis is not used (§7.3)'); };
  A.stopSpeak = function () {};
  A.setMono = function () { warn('mono path is not used in ep2 (§7.1.1)'); };
  A.isMono = () => false;
  A.ringtone = function () { warn('ringtone not used'); return { stop() {} }; };

  /* ---------------- DEBUG meter (QA levels §7.1.6) — not in the app build (G.APP ∧ ¬G.DEBUG) ---------------- */
  if (!G.APP || G.DEBUG) A.meter = function (ms) {
    return new Promise((res) => {
      if (!ok()) return res(null);
      if (!A._meter) { A._meter = A.ctx.createAnalyser(); A._meter.fftSize = 2048; A.out.connect(A._meter); }
      const an = A._meter, buf = new Float32Array(an.fftSize);
      let sum = 0, n = 0, peak = 0;
      const t0 = performance.now();
      const iv = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) { const v = buf[i]; sum += v * v; n++; if (Math.abs(v) > peak) peak = Math.abs(v); }
        if (performance.now() - t0 >= (ms || 1000)) { clearInterval(iv); res({ rms: n ? 10 * Math.log10(sum / n + 1e-12) : -120, peak: 20 * Math.log10(peak + 1e-12) }); }
      }, 40);
    });
  };
})();
