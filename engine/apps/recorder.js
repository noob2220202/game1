/* =========================================================
 * 녹음 (owner: media) — DESIGN §4.7.8 · §3.16 재료/조작 2–3 · §0.2 D5 (🔁 starts ON) · §7.1.5 · §9.7.
 * {N}'s user only (the '—' home has no recorder). One file, 우리 (0:31, 2026.11.24 오전 4:22).
 * List → player: ▶/❚❚ · waveform · `0:00 / 0:31` · seek bar · 🔁 · 🔊 (G.phone.volume) ·
 * `출력: 이 휴대전화` / `출력: 2층_스피커` (display only — no output picker) · ⓘ 정보 (rows verbatim).
 * In-player subtitles only for phone output (S27 `♪ (오르골)` → 0:27 `[딸깍 딸깍]`); bluetooth output
 * shows none here (climax shows S09). No record button, no text view, no spectrum, no speed,
 * no delete / rename menu, long-press does nothing — 우리 is the climax medium and evidence.
 * All playback goes through G.media (single media stream, route by G.media.out()). Playback keeps
 * running when the player screen is left (like a real recorder) until paused, replaced or finished.
 *
 * Public API : G.recorder = { play(id, offset?), pause(), toggle(id), seek(t), current() → {id, pos, playing}|null,
 *              isPlaying(id?) → bool, loop() → bool, setLoop(on) }
 * Bus        : listens 'media:stop' 'media:out' 'bt:change'
 * Vars       : vars.md.recLoop (bool — remembers the last playback setting, default = data loopDefault)
 * data-qa    : rec.item:<id> rec.play rec.loop rec.vol rec.info (+ rec.seek)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[recorder] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, I = MU.ICON;
  const RD = () => (G.STORY && G.STORY.recordings) || { n: [] };
  const R = (G.recorder = G.recorder || {});
  const recs = () => (MU.user() === 'dash' ? RD().dash || [] : RD().n || []);
  const byId = (id) => (RD().n || []).concat(RD().dash || []).find((r) => r.id === id) || null;

  /* ---------------- engine ---------------- */
  let S = null;          // { rec, handle, playing, pos, t0, loopAtStart, lastPos, bufPending }
  const subs = new Set();
  const notify = (k) => subs.forEach((fn) => { try { fn(k); } catch (e) { console.error('[recorder]', e); } });
  R.sub = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  R.loop = function () { const v = MU.md().recLoop; if (typeof v === 'boolean') return v; const r = (RD().n || [])[0]; return !r || r.loopDefault !== false; };
  R.setLoop = function (on) { MU.mdSet({ recLoop: !!on }); notify('loop'); };
  function bufferOf(rec) { try { if (G.audio && G.audio.buffer) return G.audio.buffer(rec.buffer); } catch (e) {} return Promise.resolve(null); }
  function rawPos() {
    if (!S) return 0;
    if (S.handle && S.handle.position) { try { const p = S.handle.position(); if (isFinite(p)) return p; } catch (e) {} }
    if (!S.playing) return S.pos;
    return S.pos + (document.hidden ? 0 : (performance.now() - S.t0) / 1000);
  }
  R.pos = function () { if (!S) return 0; const d = S.rec.dur; const p = rawPos(); return S.loopAtStart ? ((p % d) + d) % d : Math.min(d, p); };
  R.current = function () { return S ? { id: S.rec.id, pos: R.pos(), playing: S.playing } : null; };
  R.isPlaying = function (id) { return !!(S && S.playing && (!id || S.rec.id === id)); };

  R.play = function (idOrRec, offset) {
    const rec = typeof idOrRec === 'string' ? byId(idOrRec) : idOrRec;
    if (!rec) return null;
    const from = offset != null ? offset : (S && S.rec === rec ? R.pos() : 0);
    stopHandle();
    const loop = R.loop();
    S = { rec, handle: null, playing: true, pos: from >= rec.dur - 0.05 ? 0 : from, t0: performance.now(), loopAtStart: loop, lastPos: from, bufPending: true };
    const sess = S;
    const buf = bufferOf(rec);
    Promise.resolve(buf).then(() => { sess.bufPending = false; notify('state'); });
    if (G.media && G.media.play) {
      try {
        sess.handle = G.media.play(buf, {
          loop, from: 'recorder', id: rec.id, offset: sess.pos,
          onEnd: () => { if (S === sess && sess.playing) ended(); },
          onTime: (t) => { if (S === sess) watch(t); },
        });
      } catch (e) { console.error('[recorder] media.play', e); sess.handle = null; }
    }
    notify('state');
    tickStart();
    return sess.handle;
  };
  R.pause = function () { if (!S || !S.playing) return; S.pos = R.pos(); stopHandle(); S.playing = false; notify('state'); };
  R.toggle = function (id) { if (S && S.playing && (!id || S.rec.id === id)) R.pause(); else R.play(id || (S && S.rec.id) || 'uri'); };
  R.seek = function (t) {
    if (!S) return;
    t = Math.max(0, Math.min(S.rec.dur, t));
    if (S.playing) {
      if (S.handle && S.handle.seek) { try { S.handle.seek(t); S.lastPos = t; notify('seek'); return; } catch (e) {} }
      R.play(S.rec, t); return;
    }
    S.pos = t; notify('seek');
  };
  R.stopAll = function () { if (!S) return; stopHandle(); S.playing = false; S.pos = 0; notify('state'); };
  function stopHandle() { if (S && S.handle) { const h = S.handle; S.handle = null; try { h.stop(); } catch (e) {} } }
  function ended() { stopHandle(); if (S) { S.playing = false; S.pos = 0; } notify('ended'); }
  /** loop toggled while playing: ON → restart at the end of this pass · OFF → stop when the pass wraps */
  function watch(t) {
    if (!S || !S.playing) return;
    const d = S.rec.dur;
    const p = S.loopAtStart ? ((t % d) + d) % d : t;
    if (S.loopAtStart && !R.loop() && p + 0.25 < S.lastPos) { ended(); return; }
    if (!S.loopAtStart && t >= d - 0.02) { if (R.loop()) { R.play(S.rec, 0); return; } ended(); return; }
    S.lastPos = p;
  }
  let raf = 0;
  function tickStart() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!S || !S.playing) return;
      raf = requestAnimationFrame(step);
      if (document.hidden) { if (!S.handle) { S.pos = R.pos(); S.t0 = performance.now(); } return; }
      const t = rawPos();
      if (!S.handle) {   // no media engine: UI-only timer (subtitles + scrub still run — §9.8)
        if (t >= S.rec.dur) { if (S.loopAtStart && R.loop()) { S.pos = 0; S.t0 = performance.now(); } else { ended(); return; } }
      }
      watch(t);
      notify('tick');
    };
    raf = requestAnimationFrame(step);
  }
  MU.on('media:stop', (d) => { if (!S || !d || d.id !== S.rec.id || !S.playing) return; if (d.reason === 'end') return; S.pos = R.pos(); S.handle = null; S.playing = false; notify('state'); });
  MU.on('visibility', (d) => { if (S && S.playing && !S.handle && d && !d.hidden) S.t0 = performance.now(); });

  /* ---------------- list ---------------- */
  MU.app('recorder', {
    name: '녹음',
    icon: (G.ICONS && G.ICONS.recorder) || { bg: 'linear-gradient(160deg,#ff5f57,#c9302c)', svg: I.vol },
    badge: () => 0,
    open(p) {
      p = p || {};
      const list = el('div.md2-rec-list');
      const scr = MU.screen({ title: T(RD().title || '녹음'), theme: 'dark', cls: 'md2-rec', body: list });
      MU.noMenu(scr);
      function render() {
        list.innerHTML = '';
        recs().forEach((r) => {
          const on = R.isPlaying(r.id);
          const row = el('button.md2-rec-row' + (on ? '.on' : ''), { type: 'button', 'aria-label': T(r.title) },
            el('span.md2-rec-main', null,
              el('b', null, on ? el('i.md2-eq', null, el('i'), el('i'), el('i')) : null, T(r.title)),
              el('small', null, T(r.line))),
            el('span.md2-rec-dur', null, MU.fmtDur(r.dur)));
          MU.qa(row, 'rec.item:' + r.id);
          row.addEventListener('click', () => { MU.sfx('tap'); player(r); });
          list.appendChild(row);
        });
      }
      render();
      const off = R.sub((k) => { if (k !== 'tick') render(); });
      MU.push(scr, { onResume: render, onClose: off });
      if (p.id) { const r = byId(p.id); if (r) player(r); }
    },
  });

  /* ---------------- player ---------------- */
  function synthPeaks(n) {   // shape of a music box winding down (used until / unless the render buffer exists)
    const out = new Float32Array(n);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const beat = x < 0.87 ? Math.abs(Math.sin(i * (1.7 - x * 0.9))) : (i % 9 === 0 ? 0.45 : 0.04);
      out[i] = Math.max(0.05, (0.35 + 0.45 * beat) * (x < 0.87 ? 1 - x * 0.35 : 0.6) * (0.75 + 0.25 * rnd()));
    }
    return out;
  }
  function realPeaks(buf, n) {
    try {
      const ch = buf.getChannelData(0), L = ch.length, out = new Float32Array(n);
      let mx = 0;
      for (let k = 0; k < n; k++) { const a = Math.floor((k / n) * L), b = Math.floor(((k + 1) / n) * L); let m = 0; for (let i = a; i < b; i += 8) { const v = Math.abs(ch[i]); if (v > m) m = v; } out[k] = m; if (m > mx) mx = m; }
      if (mx > 0) for (let k = 0; k < n; k++) out[k] = Math.max(0.04, out[k] / mx);
      return out;
    } catch (e) { return null; }
  }

  function player(rec) {
    const cv = el('canvas.md2-wave');
    const cap = el('div.md2-rec-cap', { 'aria-live': 'polite' });
    const fill = el('i.md2-rb-fill'), knob = el('i.md2-rb-knob');
    const bar = el('div.md2-rb', { role: 'slider', 'aria-label': '재생 위치', 'aria-valuemin': 0, 'aria-valuemax': rec.dur }, el('i.md2-rb-track'), fill, knob);
    MU.qa(bar, 'rec.seek');
    const tCur = el('span.md2-rec-t');
    const tDur = el('span.md2-rec-t', null, MU.fmtDur(rec.dur));
    const bLoop = el('button.md2-rc-btn', { type: 'button', 'aria-label': '반복', html: I.loop });
    MU.qa(bLoop, 'rec.loop');
    const bPlay = el('button.md2-rc-play', { type: 'button', 'aria-label': '재생', html: I.play });
    MU.qa(bPlay, 'rec.play');
    const bVol = el('button.md2-rc-btn', { type: 'button', 'aria-label': '볼륨', html: I.vol });
    MU.qa(bVol, 'rec.vol');
    const outLine = el('div.md2-rec-out');
    const body = el('div.md2-rec-p', null,
      el('div.md2-rec-head', null, el('b', null, T(rec.title)), el('small', null, T(rec.line))),
      el('div.md2-wave-box', null, cv),
      cap,
      el('div.md2-rec-scrub', null, bar, el('div.md2-rec-times', null, tCur, tDur)),
      el('div.md2-rec-ctl', null, bLoop, bPlay, bVol),
      outLine);
    const bInfo = MU.iconBtn(I.info, '정보', 'rec.info', () => toggleInfo());
    const scr = MU.screen({ title: '', theme: 'dark', cls: 'md2-rec md2-rec-player', body, right: [bInfo] });
    MU.noMenu(scr);
    let peaks = null, info = null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bufferOf(rec).then((b) => { if (b) { peaks = realPeaks(b, 120); draw(); } });
    const mine = () => !!(S && S.rec === rec);
    function draw() {
      const w = Math.max(120, cv.clientWidth || 300), h = cv.clientHeight || 120;
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const x = cv.getContext && cv.getContext('2d'); if (!x) return;
      const pk = peaks || (draw.syn || (draw.syn = synthPeaks(120)));
      const pos = mine() ? R.pos() : 0, px = (pos / rec.dur) * W;
      x.clearRect(0, 0, W, H);
      const n = pk.length, bw = W / n;
      for (let k = 0; k < n; k++) {
        const hh = Math.max(2 * dpr, pk[k] * H * 0.86), cx = k * bw;
        x.fillStyle = cx < px ? '#ff6b5e' : 'rgba(235,235,245,.3)';
        x.fillRect(cx + bw * 0.22, (H - hh) / 2, Math.max(1, bw * 0.56), hh);
      }
      if (mine()) { x.fillStyle = '#fff'; x.fillRect(Math.min(W - 2 * dpr, px), 0, 2 * dpr, H); }
    }
    let dragging = false;
    function out() { try { return G.media && G.media.out ? G.media.out() : 'phone'; } catch (e) { return 'phone'; } }
    function sync() {
      const playing = mine() && S.playing;
      const pos = mine() ? R.pos() : 0;
      bPlay.innerHTML = playing ? I.pause : I.play;
      bPlay.setAttribute('aria-label', playing ? '일시정지' : '재생');
      bPlay.classList.toggle('on', playing);
      bLoop.classList.toggle('on', R.loop());
      bLoop.setAttribute('aria-pressed', R.loop() ? 'true' : 'false');
      if (!dragging) {
        const pct = Math.min(100, (pos / rec.dur) * 100);
        fill.style.width = pct + '%'; knob.style.left = pct + '%';
        bar.setAttribute('aria-valuenow', pos.toFixed(1));
        tCur.textContent = playing && S.bufPending ? MU.STR('loading') : MU.fmtDur(pos);
      }
      const o = out();
      outLine.textContent = T(o === 'bt' ? RD().outBt : RD().outPhone);
      const s = playing && o !== 'bt' ? (rec.subsPhone || []).find((x) => pos >= x.t0 && pos < x.t1) : null;
      cap.textContent = s ? T(s.text) : '';
      cap.classList.toggle('on', !!s);
    }
    function toggleInfo() {
      if (info && info.open) { info.close(); info = null; return; }
      info = MU.panel(scr, rec.info || [], { title: T(RD().infoTitle || ''), cls: 'dark', onClose: () => { info = null; } });
    }
    bPlay.addEventListener('click', () => { MU.sfx('tap'); if (mine() && S.playing) R.pause(); else R.play(rec); });
    bLoop.addEventListener('click', () => { MU.sfx('tap'); R.setLoop(!R.loop()); });
    bVol.addEventListener('click', () => { MU.sfx('tap'); try { G.phone && G.phone.volume && G.phone.volume({ focus: 'media' }); } catch (e) { console.error('[recorder] volume', e); } });
    const posX = (cx) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (cx - r.left) / r.width)) * rec.dur; };
    const show = (t) => { const pct = (t / rec.dur) * 100; fill.style.width = pct + '%'; knob.style.left = pct + '%'; tCur.textContent = MU.fmtDur(t); };
    bar.addEventListener('pointerdown', (e) => { e.preventDefault(); dragging = true; try { bar.setPointerCapture(e.pointerId); } catch (er) {} show(posX(e.clientX)); });
    bar.addEventListener('pointermove', (e) => { if (dragging) show(posX(e.clientX)); });
    const up = (e) => { if (!dragging) return; dragging = false; const t = posX(e.clientX); if (mine()) R.seek(t); else { R.play(rec, t); } };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', () => { dragging = false; sync(); });
    bar.tabIndex = 0;
    bar.addEventListener('keydown', (e) => { if (!mine()) return; if (e.key === 'ArrowRight') { R.seek(R.pos() + 2); e.preventDefault(); } if (e.key === 'ArrowLeft') { R.seek(R.pos() - 2); e.preventDefault(); } });
    const onKey = (e) => { if (!MU.isTop(scr) || (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())) return; if (e.key === ' ' && document.activeElement === document.body) { bPlay.click(); e.preventDefault(); } };
    document.addEventListener('keydown', onKey);
    const offs = [R.sub(() => { if (scr.isConnected) { sync(); draw(); } }), MU.on('media:out', sync), MU.on('bt:change', sync)];
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
    if (ro) ro.observe(cv);
    MU.push(scr, { onClose: () => { offs.forEach((f) => f && f()); if (ro) ro.disconnect(); document.removeEventListener('keydown', onKey); }, onResume: () => { sync(); draw(); } });
    requestAnimationFrame(() => { sync(); draw(); });
  }

  if (G.DEBUG && window.haru) window.haru.recorder = { play: (id) => R.play(id || 'uri'), pause: () => R.pause(), state: () => R.current() };
})();
