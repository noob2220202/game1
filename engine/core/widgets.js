/* =========================================================
 * engine/core/widgets.js — reusable widgets (core · DESIGN_EP2 §9.1 widgets row, §9.5-2/-3 · ARCH_EP2 §4.12)
 *
 * G.ui.pinPad({ length, dots=true, maxLength=16, submitLabel:'확인', onSubmit(code) → Promise<true|false|string>, title, sub,
 *               theme:'dark'|'light', qa='pin', letters=true, leftKey, onKey, silentError }) → node (.reset() .setMsg(t) .setBusy(b) .code())
 *     length ⇒ auto-submit at length (ep1). No length / dots:false ⇒ free length: no placeholder dots (the pad never tells the
 *     PIN's length — '자릿수 점 없음'), each entered digit is shown as one bullet, [확인] submits. Keys: <qa>.key:<d> · <qa>.ok ·
 *     <qa>.del. Physical digits / Backspace / Enter while visible and no keyboard is open. Never creates a predict bar.
 *     setBusy(b) = the caller's lockout (e.g. 30 s after 5 wrong tries): a state of its own, separate from the pad's internal
 *     submit wait — a submit finishing never lifts it; every setBusy call clears the entered digits; keys and [확인] are ignored
 *     while it is on (and during the wrong-answer shake).
 *     A wrong answer shakes the pad and plays sfx.error + vibrate('pin'); silentError:true ⇒ the caller already gave that
 *     feedback itself (e.g. cue 'pin.error' = ui.error −4 dB + [80], §7) — the shake and the message stay, no second buzz.
 * G.ui.holdButton({ ms=800, size=64, ring=true, onDone, onCancel, qa, label }) → node   (fingerprint icon, ring fills in ms;
 *     cancel on > 10 px move / early release; Space when focused; G.audio.vibrate('fp') on done; data-qa = qa verbatim)
 * G.ui.voiceBubble({ id, dur, getBuffer, subs:[{t0,t1,text}], unplayed, from:'voice', zoom=false, label='음성 메시지',
 *                    seek=true, onFirstPlay, onTime(t), onEnd({full}), onZoom({t0,t1,z,px}), qa='vm' })
 *     → { node, play(), pause(), playing(), pos() }      🎤 · ▶/❚❚ · waveform · 0:00 / 0:14 · no speed button, no transcript
 * G.ui.framePlayer({ id, frames:[{key,t0,t1}], dur, getBuffer, subs:[{t0,t1,text,kind}], from:'gallery', onReach:{'10.0':fn},
 *                    onTime, onEnd, qa='video' }) → { node, play(), pause(), seek(t), pos() }   (no video element)
 * G.ui.inputActive() → bool   keyboard open ∨ a mounted, visible pinPad ∨ any registered input source returns true
 * G.ui.inputSource(fn) → remove()   ep3 (ARCH_EP3 §4.2 widgets): extra S1 predicates — the comms / easymode dial pads register
 *     () => padNode.isConnected && padVisible && digits.length > 0 (DESIGN_EP3 §6.1.3 S1 '키패드 숫자 · 차단할 번호 입력').
 *     ep2 registers nothing ⇒ inputActive() is unchanged there.
 * ep1 kept: G.ui.zoomViewer · G.ui.patternLock · G.ui.waveform · G.ui.typing · G.ui.onLongPress   (ep1 spectrogram removed)
 * All playback goes through G.media.play (core media.js). Strings: G.e2.STR (unplayed / loading) + DESIGN player text.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep, clamp } = G.util;
  const UI = (G.ui = G.ui || {});
  const T = (s) => (G.T ? G.T(s) : s);
  const STR = (k, d) => (G.e2 && G.e2.STR && G.e2.STR[k]) || d;
  const sfx = (k) => { try { if (G.audio && G.audio.sfx && G.audio.sfx[k]) G.audio.sfx[k](); } catch (e) {} };
  function vibrate(key, pattern) {
    try { if (G.audio && G.audio.vibrate) { G.audio.vibrate(key); return; } } catch (e) {}
    if (navigator.vibrate && G.settings && G.settings.vibration) { try { navigator.vibrate(pattern); } catch (e) {} }
  }
  const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const visible = (n) => !!(n && n.isConnected && n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden');

  /* =========================================================
   * PIN pad
   * ========================================================= */
  const pads = new Set();
  UI.pinPad = function (o) {
    o = o || {};
    const len = o.length | 0;
    const free = !len || o.dots === false;
    const maxLen = o.maxLength || 16;
    const qa = o.qa || 'pin';
    let code = '', busy = false, locked = false;   // busy = our own submit wait · locked = the caller's lockout (setBusy)
    const dots = free ? el('div.pin-entry', { 'aria-live': 'polite' }) : el('div.pin-dots', null, Array.from({ length: len }, () => el('i')));
    const msg = el('div.pin-msg', null, o.sub ? T(o.sub) : '');
    const sublabels = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].concat(free ? ['⌫', '0', 'ok'] : [o.leftKey || '', '0', '⌫']);
    const DEL_SVG = '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>';
    const pad = el('div.pin-pad', null, keys.map((k) => {
      if (!k) return el('span');
      if (k === 'ok') {
        const b = el('button.pin-key.ok', { type: 'button', 'data-qa': qa + '.ok' }, el('b', null, T(o.submitLabel || '확인')));
        b.addEventListener('click', () => submit());
        return b;
      }
      if (k === '⌫') {
        const b = el('button.pin-key.del', { type: 'button', 'aria-label': '지우기', 'data-qa': qa + '.del' });
        b.innerHTML = DEL_SVG;
        b.addEventListener('click', () => press('⌫'));
        return b;
      }
      const b = el('button.pin-key', { type: 'button', 'aria-label': k, 'data-qa': qa + '.key:' + k }, el('b', null, k), o.letters !== false && sublabels[k] ? el('small', null, sublabels[k]) : null);
      b.addEventListener('click', () => press(k));
      return b;
    }));
    const node = el('div.pinpad-wrap' + (o.theme === 'light' ? '.light' : '') + (free ? '.free' : ''), { 'data-qa': o.qa ? o.qa : null },
      o.title ? el('div.pin-title', null, T(o.title)) : null, dots, msg, pad);
    function render() {
      // free length (incl. dots:false = '—' pad, 자릿수 점 없음 §4.0): no placeholder row, one bullet per entered digit
      if (free) dots.textContent = '•'.repeat(code.length);
      else dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < code.length));
    }
    async function submit() {
      if (busy || locked) return;
      if (free && !code.length) return;
      busy = true;
      await sleep(120);
      let r = false;
      try { r = await o.onSubmit(code); } catch (e) { console.error('[pinPad]', e); r = false; }
      if (r === true) node.classList.add('ok');
      else {
        node.classList.add('wrong');
        if (!o.silentError) { sfx('error'); vibrate('pin', [80]); }   // silentError: the caller's own error cue already played
        if (typeof r === 'string') msg.textContent = T(r);
        await sleep(500);
        node.classList.remove('wrong');
        code = ''; render();
      }
      busy = false;   // never touches `locked`: a lockout started inside onSubmit outlives this submit
    }
    function press(k) {
      if (busy || locked || node.classList.contains('wrong')) return;
      if (k === '⌫') { code = code.slice(0, -1); sfx('key'); render(); return; }
      if (code.length >= (free ? maxLen : len)) return;
      code += k;
      if (o.dtmf && G.audio && G.audio.sfx && G.audio.sfx.dtmf) G.audio.sfx.dtmf(k); else sfx('key');
      if (o.onKey) o.onKey(k, code);
      render();
      if (!free && code.length === len) submit();
    }
    node.reset = () => { code = ''; render(); busy = false; node.classList.remove('ok'); };
    node.setMsg = (t) => { msg.textContent = t == null ? '' : T(String(t)); };
    // external lockout: on/off both drop whatever was typed (nothing typed before or during a lockout survives it)
    node.setBusy = (b) => { locked = !!b; node.classList.toggle('busy', locked); code = ''; render(); };
    node.code = () => code;
    node._press = press; node._submit = submit; node._free = free;
    pads.add(node);
    return node;
  };
  function topPad() { let p = null; pads.forEach((n) => { if (!n.isConnected) { pads.delete(n); return; } if (visible(n)) p = n; }); return p; }
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (UI.keyboardOpen && UI.keyboardOpen()) return;
    const p = topPad(); if (!p) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); p._press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); p._press('⌫'); }
    else if (e.key === 'Enter' && p._free) { e.preventDefault(); p._submit(); }
  });
  const inputSources = [];
  UI.inputSource = function (fn) {
    if (typeof fn !== 'function') return function () {};
    inputSources.push(fn);
    return function remove() { const i = inputSources.indexOf(fn); if (i >= 0) inputSources.splice(i, 1); };
  };
  UI.inputActive = function () {
    if (UI.keyboardOpen && UI.keyboardOpen()) return true;
    if (topPad()) return true;
    for (let i = 0; i < inputSources.length; i++) { try { if (inputSources[i]()) return true; } catch (e) {} }
    return false;
  };

  /* =========================================================
   * Hold button — the on-screen fingerprint (0.8 s ring)
   * ========================================================= */
  const FP_PATHS = [
    'M50 22c-15 0-27 12-27 27v6', 'M77 55v-6c0-15-12-27-27-27', 'M31 64c2-5 3-10 3-15 0-9 7-16 16-16s16 7 16 16v4',
    'M40 75c4-7 6-16 6-26 0-2 2-4 4-4s4 2 4 4c0 12-2 23-7 32', 'M58 79c3-7 5-15 5-24', 'M28 39c2-4 5-8 9-11',
    'M66 66c-1 5-3 10-5 15', 'M50 49c0 14-4 26-11 35',
  ];
  UI.holdButton = function (o) {
    o = o || {};
    const ms = o.ms || 800, size = o.size || 64;
    const R = 46, C = +(2 * Math.PI * R).toFixed(2);
    const node = el('button.c2-hold' + (o.ring === false ? '.noring' : ''), { type: 'button', 'aria-label': o.label ? T(o.label) : null, 'data-qa': o.qa || null });
    node.style.width = size + 'px'; node.style.height = size + 'px';
    node.style.setProperty('--hold-ms', ms + 'ms');
    node.style.setProperty('--c2-c', String(C));
    node.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${o.ring === false ? '' : `<circle class="c2-hold-track" cx="50" cy="50" r="${R}"/><circle class="c2-hold-ring" cx="50" cy="50" r="${R}" transform="rotate(-90 50 50)"/>`}<g class="c2-hold-fp">${FP_PATHS.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;
    let timer = null, holding = false, done = false, sx = 0, sy = 0, pid = null;
    function start() {
      if (holding) return;
      holding = true; done = false;
      node.classList.remove('done'); node.classList.add('holding');
      timer = setTimeout(finish, ms);
    }
    function finish() {
      timer = null; if (!holding) return;
      done = true; holding = false;
      node.classList.remove('holding'); node.classList.add('done');
      vibrate('fp', [15]);
      try { if (o.onDone) o.onDone(); } catch (e) { console.error('[holdButton]', e); }
      setTimeout(() => node.classList.remove('done'), 420);
    }
    function cancel() {
      if (!holding) return;
      holding = false; clearTimeout(timer); timer = null;
      node.classList.remove('holding');
      try { if (o.onCancel) o.onCancel(); } catch (e) { console.error('[holdButton]', e); }
    }
    node.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      pid = e.pointerId; sx = e.clientX; sy = e.clientY;
      try { node.setPointerCapture(e.pointerId); } catch (er) {}
      start();
    });
    node.addEventListener('pointermove', (e) => { if (holding && e.pointerId === pid && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => node.addEventListener(ev, (e) => { if (e.pointerId === pid || ev !== 'pointerup') cancel(); }));
    node.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
    node.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); cancel(); } });
    node.addEventListener('blur', cancel);
    node.addEventListener('contextmenu', (e) => e.preventDefault());
    node.addEventListener('click', (e) => e.preventDefault());
    node.reset = () => { cancel(); node.classList.remove('done'); };
    return node;
  };

  /* =========================================================
   * Shared playback glue (G.media)
   * ========================================================= */
  let uid = 0;
  function startMedia(buf, o) {
    if (G.media && G.media.play) return G.media.play(buf, o);
    // no media engine: a silent clock so the UI still runs (§9.8)
    const dur = (buf && buf.duration) || o.dur || 0;
    let t0 = performance.now() - (o.offset || 0) * 1000, paused = null, stopped = false;
    const h = { id: o.id, from: o.from, target: 'phone', duration: dur,
      playing: () => !stopped && paused == null && h.position() < dur,
      position: () => (stopped ? 0 : paused != null ? paused : Math.min(dur, (performance.now() - t0) / 1000)),
      pause() { if (paused == null) paused = h.position(); }, resume() { if (paused != null) { t0 = performance.now() - paused * 1000; paused = null; } },
      stop() { stopped = true; }, seek(t) { t0 = performance.now() - t * 1000; if (paused != null) paused = t; } };
    const chk = () => { if (stopped) return; if (paused == null && h.position() >= dur) { stopped = true; if (o.onEnd) o.onEnd(); return; } setTimeout(chk, 100); };
    chk();
    return h;
  }
  function peaksOf(buf, n) {
    try {
      const ch = buf.getChannelData(0), step = Math.max(1, Math.floor(ch.length / n)), out = new Float32Array(n);
      let max = 0;
      for (let i = 0; i < n; i++) {
        let s = 0; const a = i * step, b = Math.min(ch.length, a + step);
        for (let j = a; j < b; j += 4) s = Math.max(s, Math.abs(ch[j]));
        out[i] = s; max = Math.max(max, s);
      }
      if (max > 0) for (let i = 0; i < n; i++) out[i] = Math.pow(out[i] / max, 0.7);
      return out;
    } catch (e) { return null; }
  }
  function pseudoPeaks(id, n) {
    let h = 2166136261; const s = String(id || 'vm'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = (G.sd && G.sd.rng) ? G.sd.rng(h >>> 0) : Math.random;
    const out = new Float32Array(n); let v = 0.4;
    for (let i = 0; i < n; i++) { v = clamp(v + (rnd() - 0.5) * 0.35, 0.12, 1); out[i] = v * (0.55 + 0.45 * Math.sin(i / 6 + rnd())); }
    return out;
  }

  /* =========================================================
   * Voice-message bubble
   * ========================================================= */
  UI.voiceBubble = function (o) {
    o = o || {};
    const id = o.id || 'vm' + (++uid);
    const qa = o.qa || 'vm';
    const dur0 = o.dur || 0;
    let dur = dur0, buf, bufP = null, h = null, unplayed = !!o.unplayed, firstDone = !unplayed, loading = false;
    let fullRun = true, z = 1, w0 = 0, raf = 0, peaks = null, hiPeaks = null;
    const playBtn = el('button.c2-vm-play', { type: 'button', 'data-qa': qa + '.play', 'aria-label': '▶' });
    const canvas = el('canvas.c2-vm-wave');
    const wave = el('div.c2-vm-wavebox', { 'data-qa': qa + '.wave' }, canvas);
    const timeEl = el('span.c2-vm-time');
    const tag = el('span.c2-vm-tag');
    const subEl = el('div.c2-vm-sub');
    const labelTxt = o.label === undefined ? '음성 메시지' : o.label;
    const node = el('div.c2-vm' + (o.cls ? '.' + o.cls : ''), { 'data-vm': id },
      el('div.c2-vm-row', null, playBtn, wave),
      el('div.c2-vm-meta', null, el('span.c2-vm-mic', null, '🎤'), labelTxt ? el('span.c2-vm-label', null, T(labelTxt)) : null, timeEl, tag),
      subEl);
    function setPlayIcon(p) { playBtn.classList.toggle('on', !!p); playBtn.setAttribute('aria-label', p ? '❚❚' : '▶'); playBtn.innerHTML = p ? '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>'; }
    function pos() { return h ? h.position() : 0; }
    function isPlaying() { return !!(h && h.playing()); }
    function renderMeta() {
      const p = pos();
      if (loading) timeEl.textContent = STR('loading', '불러오는 중…');
      else timeEl.textContent = (!firstDone && !h) ? fmtT(dur) : fmtT(p) + ' / ' + fmtT(dur);
      tag.textContent = unplayed ? '· ' + STR('unplayed', '재생 안 됨') : '';
      node.classList.toggle('unplayed', unplayed);
      const s = (o.subs || []).find((x) => p >= x.t0 && p < x.t1);
      const show = s && (isPlaying() || (h && p > 0));
      subEl.textContent = show ? T(s.text) : '';
      subEl.classList.toggle('on', !!show);
    }
    function ensurePeaks() {
      if (peaks) return;
      if (buf) { peaks = peaksOf(buf, 48); hiPeaks = peaksOf(buf, 1200); }
      if (!peaks) { peaks = pseudoPeaks(id, 48); hiPeaks = pseudoPeaks(id + ':hi', 1200); }
    }
    function win() { const span = dur / z; w0 = clamp(w0, 0, Math.max(0, dur - span)); return [w0, w0 + span]; }
    function draw() {
      ensurePeaks();
      const r = wave.getBoundingClientRect(); if (!r.width) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
      const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const [a, b] = win(), bw = 3 * dpr, gap = 2 * dpr, n = Math.max(8, Math.floor(W / (bw + gap)));
      const src = z > 1.01 ? hiPeaks : peaks, p = pos();
      const cs = getComputedStyle(node);
      const on = cs.getPropertyValue('--vm-on').trim() || '#0a84ff', off = cs.getPropertyValue('--vm-off').trim() || 'rgba(120,120,128,.45)';
      for (let i = 0; i < n; i++) {
        const t = a + ((i + 0.5) / n) * (b - a);
        const v = dur > 0 ? src[Math.min(src.length - 1, Math.floor((t / dur) * src.length))] : 0.3;
        const bh = Math.max(2 * dpr, v * H * 0.92);
        ctx.fillStyle = h && t <= p ? on : off;
        const x = i * (bw + gap);
        ctx.fillRect(x, (H - bh) / 2, bw, bh);
      }
    }
    function loop() {
      raf = 0;
      renderMeta(); draw();
      if (o.onTime && h) { try { o.onTime(pos()); } catch (e) {} }
      if (isPlaying() && !document.hidden) raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    function getBuf() {
      if (bufP) return bufP;
      bufP = Promise.resolve(typeof o.getBuffer === 'function' ? o.getBuffer() : null).then((b) => { buf = b || null; if (buf && buf.duration) dur = buf.duration > 0.1 ? buf.duration : dur0; peaks = null; return buf; }, () => (buf = null));
      return bufP;
    }
    async function play() {
      if (h && !h.playing() && h.position() > 0 && h.position() < dur - 0.05 && h.resume) { h.resume(); setPlayIcon(true); kick(); return; }
      if (!firstDone) { firstDone = true; unplayed = false; try { if (o.onFirstPlay) o.onFirstPlay(); } catch (e) {} }
      if (buf === undefined) { loading = true; renderMeta(); await getBuf(); loading = false; }
      fullRun = true;
      if (h) { try { h.stop(); } catch (e) {} }
      h = startMedia(buf, { id, from: o.from || 'voice', dur, onEnd: () => { setPlayIcon(false); renderMeta(); draw(); try { if (o.onEnd) o.onEnd({ full: fullRun }); } catch (e) {} } });
      setPlayIcon(true); kick();
    }
    function pause() { if (h && h.playing()) { h.pause(); setPlayIcon(false); renderMeta(); draw(); } }
    playBtn.addEventListener('click', (e) => { e.stopPropagation(); if (isPlaying()) pause(); else play(); });
    G.bus.on('media:stop', (e) => { if (e && e.id === id && e.reason !== 'end') { setPlayIcon(false); renderMeta(); draw(); } });

    /* waveform: tap = seek, double-tap = 2× → 4× → 1×, pinch / wheel / '+' '−' = zoom, drag = pan when zoomed */
    function zoomTo(nz, cx) {
      nz = clamp(nz, 1, 32);
      const [a, b] = win(); const t = a + clamp(cx, 0, 1) * (b - a);
      z = nz; const span = dur / z; w0 = t - clamp(cx, 0, 1) * span; win();
      draw();
      if (o.onZoom) { const [x0, x1] = win(); try { o.onZoom({ t0: x0, t1: x1, z, px: wave.getBoundingClientRect().width }); } catch (e) {} }
    }
    const ptrs = new Map(); let start = null, lastTap = 0, moved = false, tapTimer = null;
    function seekAt(cx) { if (o.seek === false || !h || !(dur > 0)) return; const [a, b] = win(); h.seek(a + cx * (b - a)); fullRun = false; renderMeta(); draw(); }
    wave.style.touchAction = o.zoom ? 'none' : 'manipulation';
    wave.addEventListener('pointerdown', (e) => {
      try { wave.setPointerCapture(e.pointerId); } catch (er) {}
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = Array.from(ptrs.values()), r = wave.getBoundingClientRect();
      start = ps.length >= 2 ? { z, d: Math.abs(ps[0].x - ps[1].x) || 1, cx: ((ps[0].x + ps[1].x) / 2 - r.left) / r.width } : { z, x: e.clientX, w0 };
      moved = false;
    });
    wave.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = Array.from(ptrs.values()), r = wave.getBoundingClientRect();
      if (ps.length >= 2 && start && start.d && o.zoom) { moved = true; zoomTo(start.z * (Math.abs(ps[0].x - ps[1].x) / start.d), start.cx); }
      else if (ps.length === 1 && start && start.x != null && Math.abs(e.clientX - start.x) > 6) {
        moved = true;
        if (o.zoom && z > 1.01) { w0 = start.w0 - ((e.clientX - start.x) / r.width) * (dur / z); win(); draw(); if (o.onZoom) { const [x0, x1] = win(); o.onZoom({ t0: x0, t1: x1, z, px: r.width }); } }
      }
    });
    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size) { start = null; return; }
      if (moved) return;
      const r = wave.getBoundingClientRect(), cx = clamp((e.clientX - r.left) / r.width, 0, 1), now = Date.now();
      if (o.zoom && now - lastTap < 300) { lastTap = 0; clearTimeout(tapTimer); tapTimer = null; zoomTo(z < 1.5 ? 2 : z < 3 ? 4 : 1, cx); return; }
      lastTap = now;
      if (o.zoom) { clearTimeout(tapTimer); tapTimer = setTimeout(() => { tapTimer = null; seekAt(cx); }, 300); }   // wait: may be a double-tap
      else seekAt(cx);
    };
    wave.addEventListener('pointerup', end); wave.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); });
    if (o.zoom) {
      wave.addEventListener('wheel', (e) => { e.preventDefault(); const r = wave.getBoundingClientRect(); zoomTo(z * (e.deltaY < 0 ? 1.25 : 0.8), (e.clientX - r.left) / r.width); }, { passive: false });
      node.tabIndex = 0;
      node.addEventListener('keydown', (e) => {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(z * 1.5, dur ? clamp((pos() - win()[0]) / (dur / z), 0, 1) : 0); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(z / 1.5, 0.5); }
      });
    }
    setPlayIcon(false); renderMeta();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => draw()).observe(wave);
    requestAnimationFrame(() => draw());
    return { node, play, pause, playing: isPlaying, pos };
  };

  /* =========================================================
   * Frame player — image frames + WebAudio track (no video element)
   * ========================================================= */
  UI.framePlayer = function (o) {
    o = o || {};
    const id = o.id || 'video' + (++uid);
    const qa = o.qa || 'video';
    const frames = (o.frames || []).slice().sort((a, b) => a.t0 - b.t0);
    let dur = o.dur || (frames.length ? frames[frames.length - 1].t1 : 0);
    let buf, bufP = null, h = null, raf = 0, last = 0, seeked = false, curFrame = -1, loading = false;
    const reached = {};
    const imgSrc = (k) => (G.e2 && G.e2.img ? G.e2.img(k) : (G.IMG && G.IMG[k]) || '');
    const imgA = el('img.c2-fp-img', { alt: '', draggable: 'false' });
    imgA.onerror = () => { imgA.style.visibility = 'hidden'; };
    imgA.onload = () => { imgA.style.visibility = ''; };
    const stage = el('div.c2-fp-stage', null, imgA);
    const bigPlay = el('button.c2-fp-big', { type: 'button', 'aria-label': '▶' }, el('i'));
    const subEl = el('div.c2-fp-sub');
    const playBtn = el('button.c2-fp-play', { type: 'button', 'data-qa': qa + '.play', 'aria-label': '▶' });
    const fill = el('i.c2-fp-fill'), knob = el('b.c2-fp-knob');
    const bar = el('div.c2-fp-bar', { role: 'slider', 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(dur)), 'aria-valuenow': '0', 'data-qa': qa + '.seek', tabindex: 0 }, el('span.c2-fp-track', null, fill, knob));
    const timeEl = el('span.c2-fp-time');
    const volBtn = el('button.c2-fp-vol', { type: 'button', 'data-qa': qa + '.vol', 'aria-label': '🔊' }, '🔊');
    const outEl = el('div.c2-fp-out');
    const node = el('div.c2-fp', { 'data-video': id }, stage, subEl, bigPlay,
      el('div.c2-fp-ctrl', null, playBtn, bar, timeEl, volBtn), outEl);
    function setIcon(p) { playBtn.innerHTML = p ? '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>'; playBtn.setAttribute('aria-label', p ? '❚❚' : '▶'); node.classList.toggle('playing', !!p); }
    const pos = () => (h ? h.position() : last);
    const isPlaying = () => !!(h && h.playing());
    function renderOut() {
      const bt = G.media && G.media.out ? G.media.out() === 'bt' : false;
      outEl.textContent = bt ? '출력: 2층_스피커' : '출력: 이 휴대전화';
    }
    function showFrame(p) {
      let i = frames.findIndex((f) => p >= f.t0 && p < f.t1);
      if (i < 0) i = p >= dur && frames.length ? frames.length - 1 : 0;
      if (i === curFrame || !frames[i]) return;
      curFrame = i;
      imgA.style.visibility = '';
      imgA.src = imgSrc(frames[i].key);
      if (!(G.settings && G.settings.reduceShake)) { imgA.classList.remove('drift'); void imgA.offsetWidth; imgA.style.setProperty('--fp-d', Math.max(1, frames[i].t1 - frames[i].t0) + 's'); imgA.classList.add('drift'); }
    }
    function render() {
      const p = pos();
      showFrame(p);
      const r = dur > 0 ? clamp(p / dur, 0, 1) : 0;
      fill.style.width = (r * 100) + '%'; knob.style.left = (r * 100) + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(p)));
      timeEl.textContent = loading ? STR('loading', '불러오는 중…') : fmtT(p) + ' / ' + fmtT(dur);
      const all = G.settings && G.settings.subs === 'all';
      const s = (o.subs || []).find((x) => p >= x.t0 && p < x.t1 && (x.kind !== 'mood' || all));
      subEl.textContent = s && (isPlaying() || p > 0) ? T(s.text) : '';
      subEl.classList.toggle('on', !!subEl.textContent);
    }
    function crossings(prev, cur) {
      if (!o.onReach) return;
      Object.keys(o.onReach).forEach((k) => {
        const t = parseFloat(k);
        if (reached[k] || !(t > prev && t <= cur)) return;
        reached[k] = true;
        try { o.onReach[k](t); } catch (e) { console.error('[framePlayer] onReach', e); }
      });
    }
    function loop() {
      raf = 0;
      const p = pos();
      if (isPlaying()) { if (!seeked) crossings(last, p); seeked = false; }
      last = p;
      render();
      if (o.onTime) { try { o.onTime(p); } catch (e) {} }
      G.bus.emit('video:time', { id, t: p });
      if (isPlaying() && !document.hidden) raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    function getBuf() {
      if (bufP) return bufP;
      bufP = Promise.resolve(typeof o.getBuffer === 'function' ? o.getBuffer() : null).then((b) => (buf = b || null), () => (buf = null));
      return bufP;
    }
    async function play() {
      if (h && !h.playing() && h.position() > 0 && h.position() < dur - 0.05 && h.resume) { h.resume(); setIcon(true); kick(); return; }
      if (buf === undefined) { loading = true; render(); await getBuf(); loading = false; }
      const from = h && h.position() < dur - 0.05 ? h.position() : 0;
      if (from === 0) last = 0;
      if (h) { try { h.stop(); } catch (e) {} }
      h = startMedia(buf, { id, from: o.from || 'gallery', dur, offset: from, onEnd: () => { last = dur; setIcon(false); render(); try { if (o.onEnd) o.onEnd(); } catch (e) {} } });
      setIcon(true); kick();
    }
    function pause() { if (h && h.playing()) { h.pause(); setIcon(false); render(); } }
    function seek(t) {
      t = clamp(Number(t) || 0, 0, dur);
      seeked = true; last = t;
      if (h) h.seek(t);
      curFrame = -1; render();
    }
    playBtn.addEventListener('click', (e) => { e.stopPropagation(); if (isPlaying()) pause(); else play(); });
    bigPlay.addEventListener('click', (e) => { e.stopPropagation(); if (isPlaying()) pause(); else play(); });
    stage.addEventListener('click', () => { if (isPlaying()) pause(); else play(); });
    volBtn.addEventListener('click', (e) => { e.stopPropagation(); if (G.phone && G.phone.volume) G.phone.volume({ focus: 'media' }); });
    // scrubbing (seek — never counts as 'reaching' a time)
    const scrubAt = (x) => { const r = bar.getBoundingClientRect(); seek(((x - r.left) / r.width) * dur); };
    bar.addEventListener('pointerdown', (e) => { e.preventDefault(); try { bar.setPointerCapture(e.pointerId); } catch (er) {} bar._drag = true; scrubAt(e.clientX); });
    bar.addEventListener('pointermove', (e) => { if (bar._drag) scrubAt(e.clientX); });
    ['pointerup', 'pointercancel'].forEach((ev) => bar.addEventListener(ev, () => { bar._drag = false; }));
    bar.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); seek(pos() + 5); } else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(pos() - 5); } });
    const offs = [G.bus.on('media:out', renderOut), G.bus.on('bt:change', renderOut),
      G.bus.on('media:stop', (e) => { if (e && e.id === id && e.reason !== 'end') { setIcon(false); render(); } })];
    node._dispose = () => offs.forEach((f) => f());
    setIcon(false); renderOut(); render();
    return { node, play, pause, seek, pos };
  };

  /* =========================================================
   * ep1 widgets kept: pattern lock, zoom viewer, waveform, typing, long-press
   * ========================================================= */
  UI.patternLock = function (o) {
    const size = o.size || 270;
    const node = el('div.pattern-wrap', { style: { width: size + 'px', height: size + 'px' } });
    const cv = el('canvas.pattern-canvas'); const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
    node.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const pts = []; const gap = size / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) pts.push({ x: gap * c + gap / 2, y: gap * r + gap / 2 });
    let seq = [], cur = null, act = false, state = 'idle';
    function draw() {
      ctx.clearRect(0, 0, size, size);
      const col = state === 'wrong' ? '#ff453a' : state === 'ok' ? '#30d158' : '#fff';
      if (seq.length) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); seq.forEach((i, k) => { const p = pts[i - 1]; if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        if (cur && act) ctx.lineTo(cur.x, cur.y);
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      pts.forEach((p, i) => { const on = seq.includes(i + 1); ctx.beginPath(); ctx.arc(p.x, p.y, on ? 10 : 7, 0, Math.PI * 2); ctx.fillStyle = on ? col : 'rgba(255,255,255,.75)'; ctx.fill(); });
    }
    function ppos(e) { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * size, y: ((e.clientY - r.top) / r.height) * size }; }
    function hit(p) { pts.forEach((q, i) => { if (Math.hypot(q.x - p.x, q.y - p.y) < gap * 0.32 && !seq.includes(i + 1)) { seq.push(i + 1); sfx('key'); } }); }
    cv.addEventListener('pointerdown', (e) => { if (state !== 'idle') return; cv.setPointerCapture(e.pointerId); act = true; seq = []; cur = ppos(e); hit(cur); draw(); });
    cv.addEventListener('pointermove', (e) => { if (!act) return; cur = ppos(e); hit(cur); draw(); });
    const up = async () => {
      if (!act) return; act = false; cur = null;
      if (seq.length < 2) { seq = []; draw(); return; }
      const ok = await o.onSubmit(seq.slice());
      state = ok ? 'ok' : 'wrong'; draw();
      if (!ok) sfx('error');
      await sleep(ok ? 400 : 700);
      if (!ok) { state = 'idle'; seq = []; draw(); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.style.touchAction = 'none';
    draw();
    return node;
  };

  /* Pinch-zoom image viewer — UI.zoomViewer(src, {maxScale, onChange({scale, cx, cy}), overlay}) (ep1) */
  UI.zoomViewer = function (src, o) {
    o = o || {};
    const maxS = o.maxScale || 8;
    const box = el('div.zoom-box');
    const inner = el('div.zoom-inner');
    const img = el('img.zoom-img', { src, alt: '', draggable: 'false' });
    img.onerror = () => { img.style.visibility = 'hidden'; box.classList.add('noimg'); };
    inner.appendChild(img);
    if (o.overlay) inner.appendChild(o.overlay);
    box.appendChild(inner);
    let iw = 1, ih = 1, fit = 1, s = 1, x = 0, y = 0, bw = 1, bh = 1;
    const pointers = new Map();
    let start = null, lastTap = 0;
    function layout() {
      const r = box.getBoundingClientRect(); bw = r.width; bh = r.height;
      iw = img.naturalWidth || 1; ih = img.naturalHeight || 1;
      fit = Math.min(bw / iw, bh / ih);
      inner.style.width = iw + 'px'; inner.style.height = ih + 'px';
      if (s === 1) { x = (bw - iw * fit) / 2; y = (bh - ih * fit) / 2; }
      apply();
    }
    function bound() { const Wd = iw * fit * s, Hd = ih * fit * s; x = Wd <= bw ? (bw - Wd) / 2 : clamp(x, bw - Wd, 0); y = Hd <= bh ? (bh - Hd) / 2 : clamp(y, bh - Hd, 0); }
    function apply(anim) {
      bound();
      inner.style.transition = anim ? 'transform .28s cubic-bezier(.2,.9,.3,1)' : 'none';
      inner.style.transform = `translate(${x}px,${y}px) scale(${fit * s})`;
      const cx = (bw / 2 - x) / (iw * fit * s), cy = (bh / 2 - y) / (ih * fit * s);
      box.dataset.zoom = s.toFixed(2);
      if (o.onChange) o.onChange({ scale: s, cx, cy });
    }
    function zoomAt(px, py, ns, anim) { ns = clamp(ns, 1, maxS); const k = ns / s; x = px - (px - x) * k; y = py - (py - y) * k; s = ns; apply(anim); }
    img.addEventListener('load', layout);
    if (img.complete) setTimeout(layout, 0);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(box);
    box.style.touchAction = 'none';
    function snapshot() {
      const ps = Array.from(pointers.values()); const r = box.getBoundingClientRect();
      if (ps.length >= 2) return { s, x, y, d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), mx: (ps[0].x + ps[1].x) / 2 - r.left, my: (ps[0].y + ps[1].y) / 2 - r.top };
      if (ps.length === 1) return { s, x, y, px: ps[0].x, py: ps[0].y };
      return null;
    }
    box.addEventListener('pointerdown', (e) => {
      box.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = snapshot();
      const now = Date.now();
      if (pointers.size === 1 && now - lastTap < 280) { const r = box.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s > 1.5 ? 1 : 3, true); lastTap = 0; } else lastTap = now;
    });
    box.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = Array.from(pointers.values()); const r = box.getBoundingClientRect();
      if (ps.length >= 2 && start && start.d) {
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        const mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        const ns = clamp(start.s * (d / start.d), 1, maxS); const k = ns / start.s;
        s = ns; x = mx - (start.mx - start.x) * k; y = my - (start.my - start.y) * k; apply();
      } else if (ps.length === 1 && start && start.px != null) { x = start.x + (ps[0].x - start.px); y = start.y + (ps[0].y - start.py); apply(); }
    });
    const end = (e) => { pointers.delete(e.pointerId); start = snapshot(); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    box.addEventListener('wheel', (e) => { e.preventDefault(); const r = box.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    box.zoomTo = (nx, ny, ns) => { s = clamp(ns, 1, maxS); x = bw / 2 - nx * iw * fit * s; y = bh / 2 - ny * ih * fit * s; apply(true); };
    box.reset = () => { s = 1; layout(); };
    box.img = img;
    box.setFilter = (f) => { img.style.filter = f; };
    return box;
  };

  /* simple live waveform renderer (ep1) */
  UI.waveform = function (canvas, analyser, color) {
    const ctx = canvas.getContext('2d'); const Wd = canvas.width, Hd = canvas.height;
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0, stopped = false;
    function frame() {
      if (stopped) return; raf = requestAnimationFrame(frame);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, Wd, Hd); ctx.strokeStyle = color || '#ff453a'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < Wd; i++) { const v = data[Math.floor((i / Wd) * data.length)] / 128 - 1; const yy = Hd / 2 + v * Hd * 0.9; if (i) ctx.lineTo(i, yy); else ctx.moveTo(i, yy); }
      ctx.stroke();
    }
    frame();
    return { stop() { stopped = true; cancelAnimationFrame(raf); } };
  };

  /* typing indicator bubble (ep1) */
  UI.typing = function () { return el('div.typing', null, el('i'), el('i'), el('i')); };

  /* long-press helper (ep1) */
  UI.onLongPress = function (node, fn, ms) {
    let t = null;
    const start = () => { t = setTimeout(() => { t = null; fn(); }, ms || 550); };
    const cancel = () => { if (t) clearTimeout(t); t = null; };
    node.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach((ev) => node.addEventListener(ev, ev === 'pointermove' ? (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel(); } : cancel));
    node.addEventListener('contextmenu', (e) => e.preventDefault());
  };
})();
