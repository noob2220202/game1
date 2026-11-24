/* =========================================================
 * 녹음 (voice recorder): list of recordings rendered procedurally,
 * player with waveform / 주파수 보기 (live spectrogram), speed, reverse.
 * G.STORY.recordings = [{id, title, t, dur, show(), build():AudioBuffer, onPlay(h), onEnd(), note}]
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const cache = {};
  let playing = null; // {h, stopViz, id}

  function getBuffer(r, reverse) {
    const k = r.id + (reverse ? ':rev' : '');
    if (cache[k]) return cache[k];
    if (!G.audio.ctx) return null;
    let b = cache[r.id] || (cache[r.id] = r.build());
    if (reverse) {
      const rb = G.audio.ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
      for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), d = rb.getChannelData(c); for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i]; }
      b = cache[k] = rb;
    }
    return b;
  }
  function stopAll() { if (playing) { playing.h && playing.h.stop(); playing.stopViz && playing.stopViz(); playing.raf && cancelAnimationFrame(playing.raf); playing = null; } }
  G.recorder = { stopAll, getBuffer };

  G.app('recorder', {
    name: '녹음',
    icon: G.ICONS.recorder,
    open() {
      const wrap = el('div');
      const scr = G.ui.screen({ title: '녹음', theme: 'dark', cls: 'rec-screen', body: wrap });
      let openId = null;
      function render() {
        wrap.innerHTML = '';
        const recs = (G.STORY.recordings || []).filter((r) => !r.show || r.show());
        recs.forEach((r) => {
          const d = G.chat.parseT(r.t);
          const item = el('div.rec-item' + (openId === r.id ? '.open' : ''), null,
            el('div.rt', null, G.T(r.title)),
            el('div.rs', null, el('span', null, d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${G.util.fmtKTime(d)}` : ''), el('span', null, r.dur || '')));
          item.addEventListener('click', (e) => { if (e.target.closest('.rec-player')) return; stopAll(); openId = openId === r.id ? null : r.id; render(); });
          if (openId === r.id) item.appendChild(player(r));
          wrap.appendChild(item);
        });
      }
      render();
      G.phone.push(scr, { onClose: stopAll });
    },
  });

  function player(r) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = el('canvas.rec-canvas'); cv.width = 340 * dpr; cv.height = 150 * dpr;
    const prog = el('i');
    let mode = 'wave', rate = 1, reverse = false;
    const playBtn = el('button.rec-play', { html: playSvg() });
    const modes = el('div.rec-modes');
    function renderModes() {
      modes.innerHTML = '';
      const b = (label, on, fn) => { const n = el('button.rec-small' + (on ? '.on' : ''), null, label); n.addEventListener('click', (e) => { e.stopPropagation(); G.audio.sfx.tap(); fn(); renderModes(); }); modes.appendChild(n); };
      b('파형', mode === 'wave', () => { mode = 'wave'; restartViz(); });
      b('주파수 보기', mode === 'spec', () => { mode = 'spec'; restartViz(); G.bus.emit('recorder:spectrum', r.id); });
      b('0.5x', rate === 0.5, () => { rate = rate === 0.5 ? 1 : 0.5; if (playing) toggle(true); });
      b('2x', rate === 2, () => { rate = rate === 2 ? 1 : 2; if (playing) toggle(true); });
      b('⟲ 거꾸로', reverse, () => { reverse = !reverse; G.bus.emit('recorder:reverse', { id: r.id, on: reverse }); if (playing) toggle(true); });
    }
    renderModes();
    function restartViz() {
      if (!playing || !playing.h) return;
      playing.stopViz && playing.stopViz();
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
      playing.stopViz = (mode === 'spec' ? G.ui.spectrogram(cv, playing.h.analyser, { maxHz: r.maxHz || 8000, colW: 2 * dpr }) : G.ui.waveform(cv, playing.h.analyser, '#ff453a')).stop;
    }
    function toggle(restart) {
      if (!G.audio.ctx) { G.phone.toast('소리를 켜야 재생할 수 있습니다'); return; }
      if (playing && playing.id === r.id && !restart) { stopAll(); playBtn.innerHTML = playSvg(); return; }
      stopAll();
      const buf = getBuffer(r, reverse);
      if (!buf) return;
      const h = G.audio.playBuffer(buf, { rate, fftSize: 2048, smoothing: 0.1, onEnd: () => { if (playing && playing.h === h) { playing.stopViz && playing.stopViz(); cancelAnimationFrame(playing.raf); playing = null; playBtn.innerHTML = playSvg(); prog.style.width = '100%'; r.onEnd && r.onEnd({ reverse, rate, mode }); G.bus.emit('recorder:end', { id: r.id, reverse, rate, mode }); } } });
      if (!h) return;
      playing = { h, id: r.id };
      playBtn.innerHTML = pauseSvg();
      restartViz();
      const tick = () => { if (!playing || playing.h !== h) return; prog.style.width = Math.min(100, (h.position() / buf.duration) * 100) + '%'; playing.raf = requestAnimationFrame(tick); };
      tick();
      r.onPlay && r.onPlay({ reverse, rate, mode, handle: h });
      G.bus.emit('recorder:play', { id: r.id, reverse, rate, mode });
    }
    playBtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    const box = el('div.rec-player', null, cv, el('div.rec-prog', null, prog), el('div.rec-ctrls', null, playBtn), modes, r.note ? el('div', { style: { fontSize: '12.5px', color: '#888', marginTop: '10px', lineHeight: '1.5' } }, G.T(r.note)) : null);
    return box;
  }
  function playSvg() { return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#fff"/></svg>'; }
  function pauseSvg() { return '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="#fff"/></svg>'; }
})();
