/* =========================================================
 * js/data/recordings.js — 녹음 files (DESIGN H1, H2, §4.7, §7.3). Everything is rendered at
 * runtime (never baked): render(A) -> Promise<AudioBuffer> or, for mode 'phase', the layer set
 * {noiseA, noiseB, n, voice, word} that js/apps/recorder.js mixes live (모노 오디오 trick).
 * Fields: id, title, t, dur, tag, maxHz, pitches[], transcript[], cues[] (voice-relative), note
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const SR = 22050;
  const TAU = Math.PI * 2;

  /* ---------------- tiny offline DSP ---------------- */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s / 4294967296) * 2 - 1; }; }
  /** RBJ biquad as a per-sample closure */
  function BQ(type, f, Q, sr) {
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * (Q || 0.707));
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    if (type === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    b0 /= a0; b1 /= a0; b2 /= a0; const A1 = a1 / a0, A2 = a2 / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function pinkGen(r) { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; return () => { const w = r(); b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; return o * 0.11; }; }
  /** small Schroeder reverb: mono send -> stereo wet added into L/R */
  function reverb(send, L, R, sr, wet, fb) {
    const k = sr / 44100, combs = [1116, 1188, 1277, 1356].map((d) => Math.round(d * k)), aps = [225, 341].map((d) => Math.round(d * k));
    const n = send.length; fb = fb || 0.74;
    const out = new Float32Array(n);
    combs.forEach((d, ci) => { const buf = new Float32Array(d); let idx = 0, lp = 0; for (let i = 0; i < n; i++) { const y = buf[idx]; lp = y * 0.7 + lp * 0.3; buf[idx] = send[i] + lp * fb; idx = (idx + 1) % d; out[i] += y * 0.25 * (ci % 2 ? 0.9 : 1); } });
    aps.forEach((d) => { const buf = new Float32Array(d); let idx = 0; for (let i = 0; i < n; i++) { const b = buf[idx]; const y = -out[i] + b; buf[idx] = out[i] + b * 0.5; idx = (idx + 1) % d; out[i] = y; } });
    for (let i = 0, j = 7; i < n; i++, j++) { L[i] += out[i] * wet; R[i] += (j < n ? out[j] : 0) * wet; }
  }
  function normalize(L, R, peak) { let m = 1e-9; for (let i = 0; i < L.length; i++) { m = Math.max(m, Math.abs(L[i]), Math.abs(R ? R[i] : 0)); } const g = (peak || 0.8) / m; for (let i = 0; i < L.length; i++) { L[i] *= g; if (R) R[i] *= g; } }
  /** copy an AudioBuffer (any rate, channel 0) into float arrays at sr, starting at t seconds */
  function mixBuffer(buf, L, R, sr, t, gain) {
    if (!buf) return;
    const src = buf.getChannelData(0), ratio = buf.sampleRate / sr, i0 = Math.floor(t * sr);
    for (let i = 0; i0 + i < L.length; i++) { const p = i * ratio, k = Math.floor(p); if (k + 1 >= src.length) break; const v = (src[k] + (src[k + 1] - src[k]) * (p - k)) * gain; L[i0 + i] += v; if (R) R[i0 + i] += v; }
  }
  function voiceT(id, ms) {
    const A = G.audio;
    if (!A || !A.voice || location.protocol === 'file:') return Promise.resolve(null); // fetch() can't read file:// — use the synth fallback
    let p; try { p = Promise.resolve(A.voice(id)).catch(() => null); } catch (e) { p = Promise.resolve(null); }
    return Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms || 1800))]);
  }
  const KEY_HZ = () => (G.audio && G.audio.DOORKEY_HZ) || { '1': 523.25, '2': 587.33, '3': 659.25, '4': 698.46, '5': 783.99, '6': 880, '7': 987.77, '8': 1046.5, '9': 1174.66, '0': 1318.51 };

  /* ---------------- formant whisper (fallback when a TTS file is missing) ---------------- */
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const VMAP = { 'ㅏ': 'ㅏ', 'ㅑ': 'ㅏ', 'ㅘ': 'ㅏ', 'ㅓ': 'ㅓ', 'ㅕ': 'ㅓ', 'ㅝ': 'ㅓ', 'ㅗ': 'ㅗ', 'ㅛ': 'ㅗ', 'ㅜ': 'ㅜ', 'ㅠ': 'ㅜ', 'ㅡ': 'ㅡ', 'ㅣ': 'ㅣ', 'ㅟ': 'ㅣ', 'ㅢ': 'ㅣ', 'ㅐ': 'ㅐ', 'ㅒ': 'ㅐ', 'ㅔ': 'ㅐ', 'ㅖ': 'ㅐ', 'ㅙ': 'ㅐ', 'ㅚ': 'ㅐ', 'ㅞ': 'ㅐ' };
  const FORM = { 'ㅏ': [850, 1300, 2700], 'ㅓ': [650, 1100, 2600], 'ㅗ': [450, 850, 2600], 'ㅜ': [350, 950, 2400], 'ㅡ': [400, 1500, 2600], 'ㅣ': [320, 2500, 3200], 'ㅐ': [500, 2000, 2700] };
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function whisper(out, sr, t0, t1, text, seed, gain) {
    const sy = Array.from(text).filter((c) => c >= '가' && c <= '힣');
    if (!sy.length) return;
    const r = rng(seed || 7), per = (t1 - t0) / sy.length;
    sy.forEach((ch, k) => {
      const code = ch.charCodeAt(0) - 0xac00, cho = CHO[Math.floor(code / 588)], jung = JUNG[Math.floor((code % 588) / 28)], jong = code % 28;
      const F = FORM[VMAP[jung] || 'ㅓ'];
      const st = t0 + k * per, d = per * (jong ? 0.92 : 0.84);
      const i0 = Math.floor(st * sr), len = Math.floor(d * sr);
      const f1 = BQ('bandpass', F[0], 5, sr), f2 = BQ('bandpass', F[1], 7, sr), f3 = BQ('bandpass', F[2], 9, sr), hiss = BQ('highpass', 3200, 0.8, sr);
      const fric = 'ㅅㅆㅈㅉㅊ'.includes(cho) ? 0.07 : 'ㅎ'.includes(cho) ? 0.05 : 'ㄱㄲㅋㄷㄸㅌㅂㅃㅍ'.includes(cho) ? 0.014 : 0;
      for (let i = 0; i < len && i0 + i < out.length; i++) {
        const t = i / sr, w = r();
        const env = Math.min(1, t / 0.025) * Math.min(1, (d - t) / 0.06);
        let v = (f1(w) * 1.0 + f2(w) * 0.75 + f3(w) * 0.35) * env * (t < fric ? 0.35 : 1);
        if (t < fric) v += hiss(w) * 0.5 * (1 - t / fric);
        out[i0 + i] += v * (gain || 1);
      }
    });
  }

  /* =========================================================
   * 소리 감지 녹음 — vm_doorlock (19 s), recipe §7.3
   * ========================================================= */
  async function renderDoorlock(A) {
    const shh = await voiceT('v_him_shh', 1800);
    return A.renderBuffer(19, (L, R, sr) => {
      const n = L.length, r = rng(1120), send = new Float32Array(n);
      // rain bed (pink LP 3k, slow swell) + room tone + far drips
      const pL = pinkGen(rng(11)), pR = pinkGen(rng(12)), lpL = BQ('lowpass', 3000, 0.7, sr), lpR = BQ('lowpass', 3000, 0.7, sr);
      let br = 0;
      for (let i = 0; i < n; i++) {
        const s = i / sr, a = 0.07 * (0.82 + 0.18 * Math.sin(TAU * 0.11 * s + 1));
        L[i] += lpL(pL()) * a; R[i] += lpR(pR()) * a;
        br = (br + 0.02 * r()) / 1.02; const v = br * 0.5 + Math.sin(TAU * 60 * s) * 0.0025; L[i] += v; R[i] += v;
      }
      for (let k = 0; k < 70; k++) { const t = Math.abs(r()) * 18.8, i0 = Math.floor(t * sr), f = 2200 + Math.abs(r()) * 2600, g = 0.006 + Math.abs(r()) * 0.01; for (let i = 0; i < sr * 0.03 && i0 + i < n; i++) { const v = Math.sin((TAU * f * i) / sr) * Math.exp(-i / (sr * 0.006)) * g; L[i0 + i] += v * 0.7; R[i0 + i] += v; } }
      // inside keypad tones (shared table): F5 at 1.20 s, B5 at 1.70 s — 80 ms, sine + 2nd harmonic .25, 3 ms click
      const HZ = KEY_HZ();
      const key = (t, f) => {
        const i0 = Math.floor(t * sr), len = Math.floor(0.08 * sr);
        for (let i = 0; i < len; i++) {
          const e = Math.min(1, i / (sr * 0.003), (len - i) / (sr * 0.006));
          const v = (Math.sin((TAU * f * i) / sr) + 0.25 * Math.sin((TAU * 2 * f * i) / sr)) * e * 0.2;
          L[i0 + i] += v; R[i0 + i] += v * 0.96; send[i0 + i] += v * 0.5;
        }
        for (let i = 0; i < sr * 0.003; i++) { const v = r() * 0.05 * (1 - i / (sr * 0.003)); L[i0 + i] += v; R[i0 + i] += v; }
      };
      key(1.2, HZ['4']); key(1.7, HZ['7']);
      // 콩이 barks ('왈': voiced pulse + breath → formants 700 / 1400 / 2600, pitch drop) replacing the next 4 beeps
      [2.2, 2.65, 3.05, 3.5].forEach((t, k) => {
        const i0 = Math.floor(t * sr), dur = 0.13 + k * 0.01, len = Math.floor(dur * sr);
        const f1 = BQ('bandpass', 700 + k * 30, 3, sr), f2 = BQ('bandpass', 1400, 4, sr), f3 = BQ('bandpass', 2600, 5, sr);
        let ph = 0;
        for (let i = 0; i < len; i++) {
          const s = i / sr, f0 = 640 - 230 * (s / dur) + k * 12;
          ph += f0 / sr; if (ph >= 1) ph -= 1;
          const src = (ph < 0.12 ? 1 - ph / 0.12 : 0) * 1.6 - 0.2 + r() * 0.35;
          const env = s < 0.012 ? s / 0.012 : Math.exp(-(s - 0.012) / 0.055);
          let v = (f1(src) * 1.2 + f2(src) * 0.85 + f3(src) * 0.35) * env * 0.9;
          v = Math.tanh(v * 1.6) * 0.55;
          L[i0 + i] += v * 0.92; R[i0 + i] += v; send[i0 + i] += v * 0.6;
        }
      });
      // admin-lock confirm melody C6–A5–F5 (descending, '관리자 잠금 설정')
      [1046.5, 880, 698.46].forEach((f, k) => {
        const i0 = Math.floor((4.3 + k * 0.12) * sr), len = Math.floor(0.11 * sr);
        for (let i = 0; i < len; i++) {
          const e = Math.min(1, i / (sr * 0.003), (len - i) / (sr * 0.008));
          let v = 0; for (let h = 1; h <= 7 && f * h < 5000; h += 2) v += Math.sin((TAU * f * h * i) / sr) / h;
          v *= e * 0.075;
          L[i0 + i] += v; R[i0 + i] += v; send[i0 + i] += v * 0.5;
        }
      });
      // a man's whisper "쉿." — close and dry (TTS file, or a synthesized sh)
      if (shh) mixBuffer(shh, L, R, sr, 6.0, 0.95);
      else {
        const i0 = Math.floor(6.0 * sr), hp = BQ('highpass', 1800, 0.7, sr), bp = BQ('bandpass', 3300, 0.9, sr);
        for (let i = 0; i < sr * 0.5; i++) { const s = i / sr, e = Math.min(1, s / 0.05) * (s < 0.38 ? 1 : Math.max(0, 1 - (s - 0.38) / 0.06)); const v = bp(hp(r())) * e * 0.9; L[i0 + i] += v; R[i0 + i] += v; }
        const wv = new Float32Array(n); whisper(wv, sr, 6.36, 6.5, '이', 5, 0.35); for (let i = 0; i < n; i++) if (wv[i]) { L[i] += wv[i]; R[i] += wv[i]; }
      }
      // 6 s of near silence, then slow breathing close to the phone (9–19 s)
      for (let c = 0; c < 4; c++) {
        const t = 9.2 + c * 3.1;
        [[t, 1.6, 0.075], [t + 1.8, 1.1, 0.05]].forEach(([s0, d, g]) => {
          const i0 = Math.floor(s0 * sr), len = Math.floor(d * sr), b1 = BQ('bandpass', 700, 0.8, sr), b2 = BQ('bandpass', 1600, 1.5, sr);
          for (let i = 0; i < len && i0 + i < n; i++) { const x = i / len, e = Math.pow(Math.sin(Math.PI * x), 2), w = r(); const v = (b1(w) + b2(w) * 0.6) * e * g; L[i0 + i] += v * 0.9; R[i0 + i] += v; }
        });
      }
      reverb(send, L, R, sr, 0.32);
      for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1); }
    }, SR);
  }

  /* =========================================================
   * 잡음 (지우지 마) — runtime layers for the 모노 오디오 trick (§H2). The phase trick is never baked:
   * noiseA / noiseB (independent) for stereo, n (played as L = n, R = −n) for mono, the whisper,
   * and the word '모노' (5–8 kHz, 3–9 s) for the spectrum display.
   * ========================================================= */
  const NOISE_VOICE_AT = 0.8;
  const NOISE_CUES = [
    [0.0, 1.5, '이거 들리면…'], [1.8, 3.4, '나 없는 거겠지.'], [3.8, 4.6, '괜찮아.'], [5.05, 6.05, '두 번째는…'],
    [6.25, 7.95, '이, 구.'], [8.15, 11.0, '이구야. 자는 척하면서 봤어.'], [11.5, 13.5, '그 사람 손가락.'],
    [13.75, 15.6, '…그리고 옷장 안쪽 벽,'], [16.0, 17.2, '두드리면 통통 소리 나. 비어 있어.'], [17.2, 19.4, '콩이가 맨날 거기 대고 짖었어.'],
  ];
  function noiseLayer(len, sr, seed) {
    const d = new Float32Array(len), r = rng(seed), hp = BQ('highpass', 160, 0.7, sr), tilt = BQ('lowpass', 7500, 0.6, sr);
    let burst = 0, burstLeft = 0, cr = 0;
    for (let i = 0; i < len; i++) {
      if (burstLeft-- <= 0) { burst = Math.random() < 0.3 ? 0.35 + Math.abs(r()) * 0.5 : 0; burstLeft = Math.floor((0.06 + Math.abs(r()) * 0.3) * sr); }
      let v = tilt(r()) * (0.34 + burst * 0.22);
      if (Math.abs(r()) < 50 / sr * 2) cr = r() > 0 ? 0.55 + Math.abs(r()) * 0.4 : -(0.55 + Math.abs(r()) * 0.4);
      v += cr; cr *= 0.82;
      d[i] = hp(v) * 0.82;
    }
    for (let i = 0; i < sr * 0.03; i++) { const g = i / (sr * 0.03); d[i] *= g; d[len - 1 - i] *= g; }
    return d;
  }
  async function renderNoise(A) {
    const ctx = A.ctx, dur = 24, sr = SR, len = dur * sr;
    const mk = (data, rate) => { const b = ctx.createBuffer(1, data.length, rate || sr); b.getChannelData(0).set(data); return b; };
    const tts = await voiceT('v_sea_mono', 2200);
    let voice;
    if (tts) {
      const vr = tts.sampleRate, vb = ctx.createBuffer(1, dur * vr, vr), dst = vb.getChannelData(0), src = tts.getChannelData(0), o = Math.floor(NOISE_VOICE_AT * vr);
      let m = 1e-9; for (let i = 0; i < src.length; i++) m = Math.max(m, Math.abs(src[i]));
      for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] = (src[i] / m) * 0.85;
      voice = vb;
    } else {
      const w = new Float32Array(len);
      NOISE_CUES.forEach(([a, b, text], k) => whisper(w, sr, NOISE_VOICE_AT + a, NOISE_VOICE_AT + b, text, 31 + k, 1));
      normalize(w, null, 0.8);
      voice = mk(w);
    }
    let word = null;
    try {
      word = A.spectroText ? A.spectroText('모노', { dur, start: 3, textDur: 6, fMin: 5000, fMax: 8000, gain: 0.95, font: '900 52px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif' }) : null;
    } catch (e) { word = null; }
    return { dur, noiseA: mk(noiseLayer(len, sr, 101)), noiseB: mk(noiseLayer(len, sr, 202)), n: mk(noiseLayer(len, sr, 303)), voice, word, tts: !!tts };
  }

  /* =========================================================
   * 콩이 그림 — dog_face bitmap → spectrogram (rows linear 1.2–9 kHz, gamma 1.8) via additive
   * random-phase synthesis, with a soft "삐요" carrier.
   * ========================================================= */
  const DOG_N = 96;
  const DOG_BITS = 'AAAAAAAAAAAAAAAAAAAAAAABBBCCCDEFEFFFIWVWXZaegijjjjkmmlmmmljkiigecQFDCCBBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBCCCDDDFGGGGGKYaZbdeiknoopprsqrrsssrqpnmkiUGDDCCCBBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBCCDDEEEFGHHHHLbddegimopwurrrywwzyzzwvuusqnTHEDDDCCCBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACCCDDDEFFGIHIIILdgikmkertrsmbWxmlkrvvq31yyvoYHFEEDDDCCBBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCCDEEEFFFGJJJJILgijmgeVacQSXLPVRPSQPOf2po3xybHFEEEEDDCCCBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBABDDDEFFGGGHJJKKJMbhYdNPNONJJJHKILIJHHHOdSf225aHFEFEEDDDDCCBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBABDDEFFGGHHJLKKJJNaUPMKJKNJLLIJHGIHHHIIJULPdkiOHEEFEEEEEDDCCBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACCBBACDEFGHHHIIKMLKLLNOQNKMLKNNNNQOKKLMJOMMLLIKPNNIHEDEDDFEEEEDCCCBAAAAAAAAAAAAAAAAAAAAAAAAAAAAACCBBACEFGHHIIHHLMKKKLLLNLNROOQQPRXZRPNSNQPQPLKJKIHIIFEEDEFFFEEEDDCCBBAAAAAAAAAAAAAAAAAAAAAAAAAAACCBBADFGGIJIIIILMKMMMOORUVZVUUVUVaYTRQVQTZUQNNLKKJMKIHFEDEEFFEEDDDCCBBAAAAAAAAAAAAAAAAAAAAAAAAAADCCBAEFGHJIHJJIMNMOMNVUTYfeacZWWWYVSTTVSWYSRQTPNMOOONKIEDDEFFEEEDDDCCBAAAAAAAAAAAAAAAAAAAAAAAAAADCCBAFGHHJJJJJKKLPVSPYcadcdedZSZYUZYWUSUXTVWWVUTPQRSRPLGEEEFFEEEEEDCCCBAAAAAAAAAAAAAAAAAAAAAAAAAECBAAGIHHIJJJMMKMPZbUXeihecZUaXTaUabWVWbWZZXWWXXUTTWSQNJIGFFEDEEEEDDDCBAAAAAAAAAAAAAAAAAAAAAAAAADCBAAHJJIKLKLLMNRSXfZYcghdfRNUcRVccdaWbgYfZXXWXZbYYXVTROLLKIGEDEEEDDDCBAAAAAAAAAAAAAAAAAAAAAAAAACBBABKLJKKMMKOPQXYXUWYWgggfRVXXXXefhdXbgfhZUXXXbddbYYaVSSSQMJGDEEEEDDDBBAAAAAAAAAAAAAAAAAAAAAAAABBAADLLKLMMMLTTTVZQRYdaadgfXfebbadglgZagkhWRXaYddhhYcbUTWUUPJKKFEFEDDDCBBAAAAAAAAAAAAAAAAAABAAAABAAAELLNLMOMPVbYSOPYdkmhegheggfcZdioecfgjhVRZbaffgheeXYXVYURPUOGGEEEEDBBBAAAAAAAAAAAAAAAAAABAAAABAAAHMMOOOQRSVebYQVffmqnkfimbfgaahpldlghmiXVaZhfdXgjgcbbbWUTTWNIFFEEEDCBBAAAAAAAAAAAAAAAAAABAAAABAABJPPNOTTWYZciadhknlqpkfagZieZhorhgqhiliZcedlgYalpiffiaaWUZUQOJHEDEECBBBBBAAAAAAAAAAAAAAABAAAABAADMSTSRUWXcfeiPYghqsutscQaYlbdinpdpojmmejjinlhZhongejfhdadaYXURKGFEECCBBBBBAAAAAAAAAAAAAABAAAABAAFPUUXWXXZfljeWRfgkqtwwaTabjddkjhkvooqkonntsrihhoocfckjiddeddVTQNKGECCBBBBBAAAAAAAAAAAAAABAAAABAAHSXWYbcbadlpbZYcgfgnqsbchgffefkiouyrhptqzrqqsruzeiilumgfmkldcbYVQKFCCCCCCBAAAAAAAAAAAAAABAAAAABHQWbYaceeccimhbeZljeeeifdhlpjiinlnwzmjttzqjphu97mrmgywldlmmjhkhgZVOHECCCCCCCAAAAAAAAAAAAAAAAAAEKSYbZabdegdcfefhfYckgXacaahqwxxrrsqsrnmmt0hjkc07ysoduvsjkorrtuhllebWQLIHGHHIHFCAAAAAAAAAAABAAAAEJSabdeeddegddeifgfUchYYbdnqprtttmsssosklsrgjdcuyyriihoqomow03okupmojdXespkeYSMHBAAAAAAAAAAAAAAGNVaaddhijedZZcffghgYUXVWcjpxomlgosqigmullrmldZes1ymmbmmxwnjruoqtutvwtjfmysnhbVPJDAAAAAAAAAAABCHRYdYZgnqmnbSSRNYcbbecUSVcfjq2ukbYbleUZsxgeksodajnttpcfjqpiclsuz035+85vnmu1vpkeYSMGAAAAAAAAAAEGHQVVVZfljhhmgVWWSbjibXVXbkspmr4teVYZfYYi2yjdipqifplp1qkiihhhpxv48/////5zsnmxysmgbVPJAAAAAAAABBCHQVVbfmnjgigZVcgkhhlleUXils51qt2tfdefhort6vkZkppijholwqlknou025177+////2ytojnuvphbWRLAAAAAAABBDKYYWiruuhhjfbTTXjoljmlZbkptx5yl55ullpoqytw30rimtlnhimkytjnsy+3415/9+979731xurkfidYWNECAAAAAAAAILRUTeprseWVdgeSNVcgghiecmsyz30mswtwqkoprz2733ytskqrnsns4uhqsxswvvz47510xyz00xulaVRNLGCBAAAAAAAFGIPKZonqiaeWaifLQYaYcdbbllp02phniZnuvqot5288y2x6shrrwzvvrkjqw2uuv4wqv2340xwz0zwlVJFDDCCBABAAAABEGQIOkmoqjidaemaSUWUOXaaimrwy1vtwhTmtzzy92n34zsq1mkqw1snnljnsv4024+5wq69z06/655vlYJFDDCCBABAAAAEFRNLahinmmdhginYOYYROUZjpx11vz45zfYmy1xz1jrzwqiokptszvnllnfuys257474yt++02+///5wufQHEEDCCBBAAAAHWRMYdeonphbfmhoUSXTSYagprqvsot05lYkv65wythuqqoouflyzqtvrrjk27037961wv2/zs2////72xnWIFEDCCABAAAGWPLUdYekohcUeglnRRUUadkorwxnmsuvrfj06zxrrxmlnpphidjumjsxhbiv8570//1yzywpkp4811465zpaOHFEDCAAAAAVKHMVYgmlfgUUcgwgWcbZaimow0rkpuunkq0z1wtv03wovpZckgqujiwqcgr01yu47xvz1vtv25yroz+776ufQIGFDCAAAAHQHMWeksqkfYUZj21hhmkebcju2tionmjgqxyv5+/+/9zx4sjsoozvvxzkpr1zusx6vqvuou5+71rpy5//64thRHFEDCAAAAMKKXghpmhYXiol29/cTkokddoxrknliecipty765688/432ryytv36sypkx3zsuyyvttmkpvxzyxx223//94tfQIGFDDAAACNKSYaikcOTt1uy+/vTPdxypntypfbadgn14z2/9+775466nhzstvx2Zfrw142z41xxwrqyvstuux92w65885wkUJGFDDAAADIRZZdhWMOl0y03/3bLOds24q00cWZdijox8/54///97595inviqrpdbtz0420855xmiryqms1us54u0/7587wocNHFEEAABENYZaeVRNftvy306fRORcp141zhaZepyuqu2/5688//88/4xvsxrrsr322381wx23yqgnqlm1/ut7st2//9797xjQJHFEAABITVVcWWQXkqp6vyrZWRPVv8/5micZj1uTPRap4+////98+/zpzqku23731w0phmutz0spqsuv/71zsvyz////6vgQMKFEAACPPRbZcXZdnpz3pmfdNNThw4+rkhYaksEGHCAIk4/////+/1txylrrxuzuhhfZey5zvwxtnnw2y5xmmy5668//6ugTOKGEAAAGTYfeWZckkv1xikbWPPSesw4qqffcePBEPCCCMp5/////7uszyrolsxolhgkm42wxuzywtou3utskjp09/8+80rgUNKGFAAAHaheYYbnirrxoZjgNSWYjgq2usjXgcDCFHBADCUs+////xxstzwolovpopmn47zrx1uswtrtw4xtrx168+78+2tkZRMGFAABUnbYYZpnlufknZmaQYbjjgwyxlWZqhBCHGBBECNhy4+/ytpolky1rznqhcgo1rmquvww0rvwotxuuy15//3583tmeUPGFABHhcTbWftnwgYdmZlZTfkgk04ujXbfqpGAFCBCHFLYmxyuodckag3013hgegifjmonmv1y1uqsqpwvtww29/8+62tnfTSMGCDQeRVbVku1pWWekZfUOkonvnhfcejnrsZBBFFDFLOTgmpfYZchffrv7ofdmokkmnjkw2sruoqkrppwvvsz396/81ulbWLAACFYYSbcTisugWblnYeUVoomadimnghloplWEAACFKQWXcgiiihigmlhrtjirqwidedftmiuqjtgipswx1ww6858+7yoSCABBBGWQVhZUfhobcnmoYgWbpffnqqmhjdlnqopfUOONRRTSQUjvzljijlh1witnzujcaihgikpmfymghrvuzy1/+49+5wWGABAAADSQYhWaTYeasqooZhXdgeornnmjlojoqrnjfZVXWNSXWejx0puhfjpvp4xv/xidZchdqpokhxukhighu407/2990oPAAAAAADRSeeZaPWaeuvucdfXjhnpotpnmjnmnnnokidbXUSbagrsuw00vjlnnzxo170ookYZYepqiqwxolkmtv34566+/8lWDAAAAAAJUicaYSXhko4rVhhWkdkkifgeUSUYioronkcZadieVUrutttkgljkqmjs005644lXPOoqsrx882yv001999/976zYJAAAAAABQkbcXUdlmqzgRgjWcYdbXbhhcYdhkqxvgaccecakfWhlilpihlicgkrxwlflyxkcUQt3xy+y2wwu11385+/+661vMBAAAAAANnbdXXismpzcTjbRTUZWZggXXdju2627yoidggifeYdfdelkslkjimtoeLEERrot0qrx27vkwtxy24441388943rYCAAAAAAUvfhXchwqnucUhYPXOSWbcYOTgiq2/////0rko0xigecfhdinopkfehTDAAABNw43vxxz0uluvxts67441279113ZGAAAAAAWufcellzupueViXOSQTXbZWTXlrv9///////wsxyvoifiihlnqpodXUGAAABAAZ2ypv0usuouz1mlxvy221890strKAAAAAASxedqqpzvpqpfjbRQTWejZSRZju49/////6y9w1wvsmmmkotuoiigTKCCABKAAK2vmrvvwuo2wysmvuxz44596simVBAAAAAJxbhsuqusoqwvjgTTVZegZZZcmuz027///xhpukwtqqsuv0zwuneaWPBACAACCRzxmrpuystyutuvw0534+5572gbSFAAAAABktjyynuxosuzsmQTWZfcehoknooqkkw231iemmowtzzy5yvzyongYTKACDFFFWwuourqv0xstsy3x0+4557465qcNHAAAAAAGz0rqm0ysuvuxpWUcovtoqnlopnoquuwyzvejppvy193x1yzuologZTHAABDOUtxrtpnu10sos223x179467z1yfQGAAAAAAAGfect2yxuwswmdZfhozrhglmmmpxxqmrwtjnurwzz81qwy0smqokecUKHJWiZgxwrqvxuusmpwy3yx58+672sukTHAAAAAABBDMUkvy1urrrrgVWclhfimoihkswnkprqvruwuy0xz2uv31ztsvoiojhjnpmcaornnqsxvqrt25754314646yqjaIAAAAACDDFFITerux2zwwvRSecfnqlghfhoonruttqxvvuvytv4v25y21uxtstuyxuqkfbgolllpslotr2016523532yvohcJAAAABBEFEDGMNORSgxstxcVafqqmiifjmlpuyxtssomprsmlw0z75211tuwquvwwtrmgdfmqimokebpyz0u01253310qffdOBAAAABEHHFDIKKJIIQSSg0jVmvrsunggmknusppncWbhhhfjry788+74xu0tuzwsssmhglnmiolliWky1xy0z234200xZSUSDAAAABDFLHGELPLKKLMNWbfXlstzullljkmklnjFAAEPYYWcp6978786zz4y2zwtvutmkmpfionslZlu0xwy401523zweMNKGAAABBCEJMIHJPOMLLPOKNYPYmrsrphhimsnigHABABFOWQUo059/++74z552320zwsqpklddprrhemusuvu011221ztmLIEDAAABCBDEOPJILRRLKQQMLLIPdlnilnknoolgTAAAAADHPMQbp7//+9/87652594yvwspgjedqspghrqtsrvwz52zxrrkQECBAAAABCCDJTPMIPTNMOQNKKPSTinbbloknijhIAFNDADGJMTVdz///8//97521950w1xvhffjsumlavtnsss0113zyfcfUDBAAAAAADCFFOXPMKSQOPTSKIPSNZkmklnkikkhGAOVJEEHGOTWXn8//////922y140vvzuhZijnqqkinpsttuy674zvcRaSEBAAABBBBDFEHVTPJPVOPUSISTOTSblgfbehjndNABDFAEFGLMUUj/////+++52123zvswwhVmgkprhirkmyvty655zscNXPIAAABBBBBBEHFOYTMLRSRQKGRmaNNQgkhhdimnfSAAAABFEGFGMTo/+++/9//763692wxsthZndjoqkfsokuxvy/86xmgMTKIAAABCCCEDCIHHWYRNNVSLIOTaeOMLThijlroolWGCAADEFBALQYy+//+79/+/7++4ztuvtbckajmpkfqpptxx2083rjfROGIAAAABCDDEEFIHPdYRNWQIMVNViaOOUpjehhoppePGGFCDIBAGUl6479/67///+585wyuvoVimdimojhpsnux00x3xngWTRDHBAAABCDEFEFGJLYcVQOLNSPXjonTNOiregegsskaMIEEHJDCLg153866+///+/520wwyraUnrceorjirpkv2201uqjeTMODFBAAAABDFEGGGIKRgZQJNfcVjkijXOMSgmemkfjjaTTOIIGJRmy02x6437++9//72zxuscUcsodbpuklvrku0z12qqibTJJCBAAAAABCEEGHIILMaeQJPjtbWeScmTPTRfbbggcZWRQUYZcqwx4y32457488++/50vuqeWYlqpgdozsrxrlsz34xpmgbSJCAAAAAAAABDEHJKJKLTeQNRZkVcYYlnYQSPTundYbbVRQRhtx34210554577699984yuocYflplqmgo21xvpjmy43rllcXSFAAAAAAAAABCEGIJKKLOTKTSUifXaptaVTUUOc0obYZacZafu1x35z042z64/8/991vrmaZfntipprkpzzxxvrkr1wkihYWPBAAAAAAAAAABDFHKKKMMNPSOZmldimjOYhWUSOkufceabkssvxy454z11x6594891uspgcbjuxgqpvrr1yrxwvoovsigcXVKAAAAAAAAAAAACEGIKLLLMYURUcmhmbOQemlVSWWjjtxaafmuxz3440222x53635zrtyrlkgp02jlusuty0nsxzsmlmjdYUSEAAAAAAAAAAAABCEHKLMJLSbWXmsvnbUcjmmfUWXWcmfgihbmolutqqwzvtuzuqpnuruzxwrty0pqvvvvwwlqx0wogbbYUQOBAAAAAAAAAAAAABDFIKJGKRXUgy6rgkecnnnicXaaffZktoiornuvrotwvosqnosrrppwy1yuvwquwy01zqnvyxwngYURNOHAAAAAAAAAAAAAAACEHIGGMTPOaqwdh3dSluibifedfgkvsxkkgvllvpttsptlkmmkcdqzywwxz0uw0v23wsuxtqnkidUNJJDAAAAAAAAAAAAAAAACFHFFLTSUXglWgscfgudbpkfbZZadgdiomnbemghghrmlkkgabdt4243z10wzyx1wt0xsomjhdbQHIFAAAAAAAAAAAAAAAAABDEEEHKNQWfstupfyuZYdmngdbZbYVSYklnxpfmhdjmkkmidSXds4343z11styxwv0yuojhgdZWGDFBAAAAAAAAAAAAAAAAAABCDEINNOWhqsuuosiXaegljfdbZZbbZZdmehtrnhkjjmngjWXfuz47301ysvuvy4yvmhgedaYODDBAAAAAAAAAAAAAAAAAAAABCDIMPSWbgilwvqbXigchkheddbbbefhuqbisffgkrwnnkioknqu343ztx0wz0ytoigcbYXUHDAAAAAAAAAAAAAAAAAAAAAAABDGKNRRSbmotsplgknclxmieeffdhlpwz0Wlmkiiowhbppvxsflz0z0v022yvuupkhfaWPIBAAAAAAAAAAAAAAAAAAAAAAAAABFJMMLQZgkhiokSWpupqvthfghjlpsss/jjnnonmqnklloqmgp236311zxropgOUWRKCBAAAAAAAAAAAAAAAAAAAAAAAAAAAACGKKOQRXbgpuhXbo2wmxlpnghjloqj1ytunoxsrqvtmmjksnu04+z20uolhdPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACGJLLLSZgijXclkkopsZeqenrprsnosx6yljsvwnuusytsuw086yxywogXVOABBBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFILNOUafgYYdlacnjYYdfrty0w202zxwskpywxx0t00w2421xuwuskdVRNBABBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFIKKNVabdZZZWbnhfadzyozwwvtryq5wtvxyvs0s251y0zwrrrqnebVNKCABAAAAAAAAAAAAAAAAAAA';
  function embeddedBits() {
    const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const a = new Float32Array(DOG_N * DOG_N);
    for (let i = 0; i < a.length; i++) a[i] = Math.max(0, B.indexOf(DOG_BITS[i])) / 63;
    return { rows: DOG_N, cols: DOG_N, data: a };
  }
  function imageBits() {
    // same processing as the embedded copy: crop the face, saturation·√value, percentile stretch, gamma 1.8, vignette.
    return new Promise((res) => {
      if (!G.IMG || !G.IMG.dog_face) return res(null);
      const img = new Image();
      const to = setTimeout(() => res(null), 2500);
      img.onload = () => {
        clearTimeout(to);
        try {
          const N = DOG_N, c = document.createElement('canvas'); c.width = N; c.height = N;
          const x = c.getContext('2d'); const W = img.naturalWidth, H = img.naturalHeight;
          x.drawImage(img, 0.03 * W, 0.02 * H, 0.96 * W, 0.64 * H, 0, 0, N, N);
          const px = x.getImageData(0, 0, N, N).data; // throws on a tainted canvas (file://)
          const v = new Float32Array(N * N);
          for (let i = 0; i < N * N; i++) { const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); v[i] = ((mx - mn) / (mx + 1e-6)) * Math.sqrt(mx); }
          const s = Array.from(v).sort((a, b) => a - b), lo = s[Math.floor(s.length * 0.05)], hi = s[Math.floor(s.length * 0.98)];
          for (let y = 0; y < N; y++) for (let k = 0; k < N; k++) {
            const i = y * N + k; let a = Math.min(1, Math.max(0, (v[i] - lo) / (hi - lo || 1)));
            const dx = (k / (N - 1) - 0.5) / 0.56, dy = (y / (N - 1) - 0.52) / 0.6, d = Math.sqrt(dx * dx + dy * dy);
            v[i] = Math.round(Math.pow(a, 1.8) * Math.min(1, Math.max(0, (1 - d) / 0.18)) * 63) / 63;
          }
          res({ rows: N, cols: N, data: v });
        } catch (e) { res(null); }
      };
      img.onerror = () => { clearTimeout(to); res(null); };
      img.src = G.IMG.dog_face;
    });
  }
  async function renderKongi(A) {
    const bits = (await imageBits()) || embeddedBits();
    return A.renderBuffer(8, (L, R, sr) => {
      const n = L.length, r = rng(317);
      for (let i = 0, b = 0; i < n; i++) { b = (b + 0.02 * r()) / 1.02; L[i] += b * 0.12; R[i] += b * 0.12; }
      // 삐요
      const piyo = (t) => {
        [[t, 0.17, 2250, 2350], [t + 0.22, 0.3, 1950, 1350]].forEach(([s0, d, fa, fb]) => {
          const i0 = Math.floor(s0 * sr), len = Math.floor(d * sr); let ph = 0;
          for (let i = 0; i < len; i++) { const x = i / len, f = fa + (fb - fa) * x + Math.sin(TAU * 6 * i / sr) * 18; ph += (TAU * f) / sr; const e = Math.min(1, x / 0.08, (1 - x) / 0.25); const v = Math.sin(ph) * e * 0.1; L[i0 + i] += v; R[i0 + i] += v; }
        });
      };
      piyo(0.55); piyo(6.7);
      // the picture: 2.25–5.65 s (≈ square on a 0–10 kHz display), rows top = 9 kHz
      const R0 = bits.rows, C0 = bits.cols, fMin = 1200, fMax = 9000, t0 = 2.25, t1 = 5.65;
      const s0 = Math.floor(t0 * sr), s1 = Math.floor(t1 * sr), span = s1 - s0, g = 0.95 / Math.sqrt(R0);
      for (let row = 0; row < R0; row++) {
        let mx = 0; for (let k = 0; k < C0; k++) mx = Math.max(mx, bits.data[row * C0 + k]);
        if (mx < 0.03) continue;
        const f = fMax - (row / (R0 - 1)) * (fMax - fMin), w = (TAU * f) / sr, cw = Math.cos(w), sw = Math.sin(w);
        let ph = Math.random() * TAU, c = Math.cos(ph), s = Math.sin(ph);
        for (let i = 0; i < span; i++) {
          const pos = (i / span) * (C0 - 1), k = Math.floor(pos), fr = pos - k;
          const a = bits.data[row * C0 + k] * (1 - fr) + bits.data[row * C0 + Math.min(C0 - 1, k + 1)] * fr;
          const nc = c * cw - s * sw; s = s * cw + c * sw; c = nc;
          if (a > 0.02) { const edge = Math.min(1, i / (sr * 0.01), (span - i) / (sr * 0.01)); const v = s * a * g * edge; L[s0 + i] += v; R[s0 + i] += v; }
          if ((i & 1023) === 0) { const m = Math.sqrt(c * c + s * s); c /= m; s /= m; }
        }
      }
      normalize(L, R, 0.78);
    }, SR);
  }

  /* =========================================================
   * 콩이 코골이ㅋㅋ (11 s) — small-dog snoring, a nasal whistle, the collar bell
   * ========================================================= */
  function renderSnore(A) {
    return Promise.resolve(A.renderBuffer(11, (L, R, sr) => {
      const n = L.length, r = rng(730);
      for (let i = 0, b = 0; i < n; i++) { b = (b + 0.02 * r()) / 1.02; L[i] += b * 0.25; R[i] += b * 0.25; }
      [0.5, 3.15, 5.85, 8.4].forEach((t, k) => {
        const inh = 0.85 + k * 0.04, i0 = Math.floor(t * sr), len = Math.floor(inh * sr);
        const b1 = BQ('bandpass', 520, 1.3, sr), b2 = BQ('bandpass', 1150, 2, sr);
        for (let i = 0; i < len; i++) { const x = i / len, s = i / sr, e = Math.pow(Math.sin(Math.PI * x), 1.4), am = Math.pow(0.5 + 0.5 * Math.sin(TAU * (31 + k * 3) * s), 2), w = r(); const v = (b1(w) * 1.3 + b2(w) * 0.6) * e * (0.25 + 0.75 * am) * 0.5; L[i0 + i] += v; R[i0 + i] += v * 0.95; }
        const j0 = Math.floor((t + inh + 0.15) * sr), jl = Math.floor(1.0 * sr), b3 = BQ('bandpass', 1650, 1.1, sr);
        let ph = 0;
        for (let i = 0; i < jl && j0 + i < n; i++) { const x = i / jl, e = Math.pow(Math.sin(Math.PI * x), 2); ph += (TAU * (2300 + Math.sin(TAU * 5 * i / sr) * 35)) / sr; const v = b3(r()) * e * 0.12 + Math.sin(ph) * e * 0.012 * (k % 2 ? 1 : 0.4); L[j0 + i] += v; R[j0 + i] += v; }
      });
      [[9.55, 1], [9.7, 0.6], [9.92, 0.35]].forEach(([t, g]) => {
        const i0 = Math.floor(t * sr);
        [[4186, 0.5], [5274, 0.32], [6645, 0.2], [7902, 0.14]].forEach(([f, d]) => { for (let i = 0; i < d * sr && i0 + i < n; i++) { const v = Math.sin((TAU * f * (1 + 0.002 * g) * i) / sr) * Math.exp(-i / (sr * d * 0.3)) * 0.03 * g; L[i0 + i] += v * 1.1; R[i0 + i] += v * 0.8; } });
      });
      normalize(L, R, 0.6);
    }, SR));
  }

  /* =========================================================
   * 음향학 실습 - 방 IR 측정 (6 s) — two claps + room tail; the 2nd (near the wardrobe) rings hollow
   * ========================================================= */
  function renderIR(A) {
    return Promise.resolve(A.renderBuffer(6, (L, R, sr) => {
      const n = L.length, r = rng(514);
      for (let i = 0, b = 0; i < n; i++) { b = (b + 0.02 * r()) / 1.02; L[i] += b * 0.15; R[i] += b * 0.15; }
      const clap = (t, hollow) => {
        const i0 = Math.floor(t * sr), bp = BQ('bandpass', 1500, 0.7, sr), hp = BQ('highpass', 400, 0.7, sr);
        for (let i = 0; i < sr * 0.03; i++) { const s = i / sr, e = s < 0.0012 ? s / 0.0012 : Math.exp(-(s - 0.0012) / 0.006); const v = hp(bp(r()) * 3) * e * 0.9; L[i0 + i] += v; R[i0 + i] += v * 0.97; }
        const lpL = BQ('lowpass', 5000, 0.6, sr), lpR = BQ('lowpass', 4600, 0.6, sr), tau = 0.6 / 6.9, len = Math.floor(0.9 * sr);
        for (let i = 0; i < len; i++) { const s = i / sr, e = Math.exp(-s / tau) * Math.min(1, s / 0.004); L[i0 + i] += lpL(r()) * e * 0.22; R[i0 + i] += lpR(r()) * e * 0.22; }
        if (hollow) { const hl = Math.floor(1.6 * sr); for (let i = 0; i < hl; i++) { const s = i / sr, e = Math.exp(-s / 0.38) * Math.min(1, s / 0.02); const v = (Math.sin(TAU * 186 * s) + 0.4 * Math.sin(TAU * 93 * s + 1)) * e * 0.07; L[i0 + i] += v * 1.15; R[i0 + i] += v * 0.75; } }
      };
      clap(0.7, false); clap(3.1, true);
      normalize(L, R, 0.8);
    }, SR));
  }

  /* =========================================================
   * The list (newest first)
   * ========================================================= */
  const HZ = KEY_HZ();
  G.STORY.recordings = [
    {
      id: 'noise', title: '잡음 (지우지 마)', t: '2025-11-21 01:12', dur: 24, mode: 'phase', maxHz: 10000, db: [-74, -22],
      voiceAt: NOISE_VOICE_AT, cues: NOISE_CUES, segment: [6.25, 7.95], stereoCaption: '[치지직—]',
      transcript: [{ t: 0, text: '[치지직—] (음성을 인식할 수 없습니다)' }],
      render: renderNoise,
    },
    {
      id: 'doorlock', title: '소리 감지 녹음', t: '2025-11-20 03:33', dur: 19, tag: '자동', tagIcon: 'ear', sub: '소리 감지로 자동 녹음됨', maxHz: 8000, db: [-96, -38],
      heardAt: 1.85,
      pitches: [
        { t: 1.2, hz: HZ['4'], kind: 'key' }, { t: 1.7, hz: HZ['7'], kind: 'key' },
        { t: 2.2, kind: 'bark' }, { t: 2.65, kind: 'bark' }, { t: 3.05, kind: 'bark' }, { t: 3.5, kind: 'bark' },
        { t: 4.3, hz: 1046.5, kind: 'melody' }, { t: 4.42, hz: 880, kind: 'melody' }, { t: 4.54, hz: 698.46, kind: 'melody' },
      ],
      transcript: [{ t: 1.2, text: '[삐]' }, { t: 1.7, text: '[삐]' }, { t: 2.2, text: '[개 짖는 소리]' }, { t: 4.3, text: '[삐리릭]' }, { t: 6.0, text: '(남성) "쉿."' }, { t: 9.2, text: '[숨소리]' }],
      render: renderDoorlock,
    },
    {
      id: 'kongi', title: '콩이 그림', t: '2025-09-02 21:47', dur: 8, maxHz: 10000, db: [-78, -36],
      transcript: [{ t: 0.55, text: '[삐요]' }, { t: 2.25, text: '[지이이잉—]' }, { t: 6.7, text: '[삐요]' }],
      render: renderKongi,
    },
    {
      id: 'snore', title: '콩이 코골이ㅋㅋ', t: '2025-07-30 01:08', dur: 11, maxHz: 8000, db: [-92, -38],
      transcript: [{ t: 0.5, text: '[쌕… 쌕…]' }, { t: 3.2, text: '[코 고는 소리]' }, { t: 9.55, text: '[딸랑]' }],
      render: renderSnore,
    },
    {
      id: 'ir', title: '음향학 실습 - 방 IR 측정', t: '2025-05-14 15:32', dur: 6, maxHz: 8000, db: [-96, -34],
      note: '측정 메모: RT60 ≈ 0.6초. 두 번째(옷장 앞)만 낮은 소리가 혼자 오래 울림 — 벽 안이 비었나?',
      transcript: [{ t: 0.7, text: '[짝!]' }, { t: 0.8, text: '[울림]' }, { t: 3.1, text: '[짝!]' }, { t: 3.2, text: '[웅— 낮은 울림]' }],
      render: renderIR,
    },
  ];
  G.STORY.recordingsDSP = { whisper, BQ, rng };
})();
