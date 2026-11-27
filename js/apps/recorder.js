/* =========================================================
 * 녹음 (DESIGN H1, H2, §4.7) — list + player (파형 | 주파수, 0.75×, 5초 뒤로, 구간 반복,
 * 텍스트 보기, 음높이 보기) + a mini-player chip that keeps a recording playing across apps.
 *
 * Engine (G.recorder): play(rec|id, offset) · pause() · toggle(id) · seek(t) · back5() ·
 *   setRate(id, r) · setLoop(id, on) · pos() · current() · isPlaying(id?) · stopAll()
 * '잡음 (지우지 마)' is mixed live (never baked): stereo  L = noiseA + .12·voice, R = noiseB + .12·voice;
 *   모노 오디오 on → L = n, R = −n (same buffer) + voice centred, so the master mono sum cancels the
 *   noise. The display analyser also gets the word '모노' (5–8 kHz, 3–9 s). Hearing '이, 구' in mono
 *   (continuous run through it) → G.foundFragment('29') → offer to switch mono off (auto after 10 s).
 * '소리 감지 녹음' → flag doorlockHeard once both beeps have played.
 * Shared state: vars.pitchBars (mirrors the door keypad's vars.pitchView; emits 'pitchView').
 * Listens: 'mono', 'settings:mono', 'pitchView', flag:M7 (stops playback).
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad } = G.util;
  const T = (s) => (G.T ? G.T(s) : s);
  const V = () => G.state.vars;
  const R = (G.recorder = G.recorder || {});
  const cache = {};
  const sess = {};
  const subs = new Set();
  let S = null; // current playback session
  let raf = 0;

  /* ---------------- helpers ---------------- */
  function sfx(name, ...a) { try { const f = G.audio && G.audio.sfx && G.audio.sfx[name]; if (f) return f(...a); } catch (e) {} return undefined; }
  function svg(p, vb) { return `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${p}</svg>`; }
  const ICON = {
    play: svg('<path d="M8 5.2v13.6a.8.8 0 001.2.7l10.6-6.8a.8.8 0 000-1.4L9.2 4.5A.8.8 0 008 5.2z" fill="currentColor"/>'),
    pause: svg('<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
    back5: svg('<path d="M12 4.5a7.5 7.5 0 11-7.2 9.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 1.8v5.4L8.4 4.5z" fill="currentColor"/><text x="12" y="15.6" text-anchor="middle" font-size="7.6" font-weight="700" fill="currentColor" font-family="-apple-system,Arial">5</text>'),
    loop: svg('<path d="M4 12V9.5A3.5 3.5 0 017.5 6H18m0 0l-3-3m3 3l-3 3M20 12v2.5a3.5 3.5 0 01-3.5 3.5H6m0 0l3 3m-3-3l3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    ear: svg('<path d="M7 9a5 5 0 0110 0c0 3-3 3.6-3 6.5a2.5 2.5 0 01-4.6 1.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 9.4a2 2 0 014 0c0 1.2-1.2 1.4-1.2 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0012 0M12 17v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  };
  const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${pad(r)}`; };
  function parseT(t) { if (G.chat && G.chat.parseT) return G.chat.parseT(t); const m = String(t || '').match(/(\d+)-(\d+)-(\d+)(?:[ T](\d+):(\d+))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; }
  function dateLabel(r) { const d = parseT(r.t); return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${G.util.fmtKTime(d)}` : ''; }
  const recs = () => (G.STORY.recordings || []).filter((r) => !r.show || r.show());
  const byId = (id) => (G.STORY.recordings || []).find((r) => r.id === id);
  function state(id) { return sess[id] || (sess[id] = { rate: 1, loop: null, mode: 'wave', transcript: false, maxPos: 0, heardCues: {} }); }
  function ac() { return G.audio && G.audio.ctx; }
  // the context is enough: with sound switched off the master is silent but the analyser (spectrum,
  // pitch bars, captions) still runs — the visual path must work muted.
  function ready() { const c = ac(); return !!(c && c.state !== 'closed'); }
  function isMono() { try { return !!(G.audio && G.audio.isMono && G.audio.isMono()); } catch (e) { return false; } }
  function pitchOn() { return !!(V().pitchBars || V().pitchView); }
  function setPitch(on) { V().pitchBars = !!on; V().pitchView = !!on; G.save(); G.bus.emit('pitchView', !!on); notify('pitch'); }
  function notify(kind) { subs.forEach((fn) => { try { fn(kind); } catch (e) { console.error('[recorder]', e); } }); if (kind !== 'tick') miniUpdate(); }
  R.sub = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  function prefetch() { try { if (location.protocol !== 'file:' && G.audio && G.audio.voice && ac()) { G.audio.voice('v_sea_mono'); G.audio.voice('v_him_shh'); } } catch (e) {} }

  /* ---------------- engine ---------------- */
  function load(rec) {
    if (!cache[rec.id]) {
      cache[rec.id] = Promise.resolve().then(() => rec.render(G.audio)).then((d) => { if (!d) throw new Error('empty render'); return d; })
        .catch((e) => { console.warn('[recorder] render failed', rec.id, e); delete cache[rec.id]; return null; });
    }
    return cache[rec.id];
  }
  R.load = (id) => { const r = typeof id === 'string' ? byId(id) : id; return r && ready() ? load(r) : Promise.resolve(null); };
  function syncCoreMono() {
    const a = G.audio; if (!a || !a.monoPath || !a.setMono) return;
    const want = isMono(), active = a.monoPath.gain.value > 0.5;
    if (want !== active) { try { a.setMono(want); } catch (e) {} }
  }
  function build(rec, data, off, rate, loop) {
    const ctx = ac(), out = G.audio.bus('voice');
    const nodes = [], srcs = [];
    const disp = ctx.createGain(); disp.channelCount = 1; disp.channelCountMode = 'explicit'; disp.channelInterpretation = 'speakers';
    const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0;
    const db = rec.db || [-95, -35]; an.minDecibels = db[0]; an.maxDecibels = db[1];
    disp.connect(an); nodes.push(disp, an);
    const src = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; if (loop) { s.loop = true; s.loopStart = loop[0]; s.loopEnd = loop[1]; } srcs.push(s); return s; };
    const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; nodes.push(g); return g; };
    let setMono = null;
    if (rec.mode === 'phase') {
      const coreMono = !!G.audio.monoPath;
      const m0 = isMono();
      const sA = src(data.noiseA), sB = src(data.noiseB), sN = src(data.n), sV = src(data.voice);
      const merS = ctx.createChannelMerger(2), merM = ctx.createChannelMerger(2); nodes.push(merS, merM);
      sA.connect(merS, 0, 0); sB.connect(merS, 0, 1);
      const inv = gain(-1); sN.connect(merM, 0, 0); sN.connect(inv); inv.connect(merM, 0, 1);
      const gS = gain(m0 ? 0 : 1), gM = gain(m0 && coreMono ? 1 : 0), gV = gain(m0 ? 0.55 : 0.12);
      merS.connect(gS); merM.connect(gM); sV.connect(gV);
      [gS, gM, gV].forEach((g) => { g.connect(out); g.connect(disp); });
      if (data.word) { const sW = src(data.word); const ga = gain(0.04), gd = gain(2.4); sW.connect(ga); ga.connect(out); sW.connect(gd); gd.connect(an); }
      setMono = (m) => {
        const t = ctx.currentTime;
        gS.gain.setTargetAtTime(m ? 0 : 1, t, 0.002);
        gM.gain.setTargetAtTime(m && coreMono ? 1 : 0, t, 0.002);
        gV.gain.setTargetAtTime(m ? 0.55 : 0.12, t, 0.03);
      };
    } else {
      const s = src(data); const g = gain(1); s.connect(g); g.connect(out); g.connect(disp);
    }
    srcs.forEach((s) => s.start(0, off));
    return { srcs, nodes, analyser: an, setMono, t0: ctx.currentTime };
  }
  function stopNodes() {
    if (!S || !S.srcs) return;
    const { srcs, nodes } = S;
    S.srcs = null;
    srcs.forEach((s) => { try { s.onended = null; s.stop(); } catch (e) {} });
    setTimeout(() => { srcs.concat(nodes).forEach((n) => { try { n.disconnect(); } catch (e) {} }); }, 80);
  }
  R.pos = function () {
    if (!S) return 0;
    if (!S.playing || !S.srcs) return S.off;
    const p = S.off + (ac().currentTime - S.t0) * S.rate;
    if (S.loop && p >= S.loop[1]) { const [a, b] = S.loop; return a + ((p - a) % (b - a)); }
    return Math.min(S.rec.dur, p);
  };
  R.current = () => (S ? S.rec : null);
  R.isPlaying = (id) => !!(S && S.playing && (!id || S.rec.id === id));
  R.play = async function (rec, off) {
    if (typeof rec === 'string') rec = byId(rec);
    if (!rec) return false;
    if (!ready()) { G.phone.toast('소리를 켜야 재생할 수 있습니다'); return false; }
    try { if (ac().state === 'suspended') ac().resume(); } catch (e) {}
    const st = state(rec.id);
    const token = (R._token = {});
    const wasSame = S && S.rec === rec;
    if (off == null) off = wasSame ? R.pos() : 0;
    notify('loading');
    const data = await load(rec);
    if (R._token !== token) return false;
    if (!data) { G.phone.toast('이 파일을 재생할 수 없습니다'); notify('state'); return false; }
    if (S) { S.playing = false; stopNodes(); }
    if (rec.mode === 'phase') syncCoreMono();
    if (off >= rec.dur - 0.05) off = 0;
    if (st.loop && (off < st.loop[0] || off >= st.loop[1] - 0.02)) off = st.loop[0];
    const g = build(rec, data, off, st.rate, st.loop);
    S = Object.assign({ rec, data, playing: true, paused: false, off, rate: st.rate, loop: st.loop, lastPos: off, monoFrom: null, cue: -1 }, g);
    const mySrcs = g.srcs;
    g.srcs[0].onended = () => { if (S && S.srcs === mySrcs && S.playing && !S.loop) ended(); };
    G.bus.emit('recorder:play', { id: rec.id, rate: st.rate, mode: st.mode });
    startLoop();
    notify('state');
    return true;
  };
  R.pause = function (byUser) {
    if (!S || !S.playing) return;
    S.off = R.pos(); S.playing = false; S.paused = byUser !== false;
    stopNodes();
    notify('state');
  };
  R.toggle = function (id) {
    const rec = typeof id === 'string' ? byId(id) : id;
    if (S && S.rec === rec && S.playing) R.pause(true); else R.play(rec);
  };
  R.seek = function (t) {
    if (!S) return;
    t = Math.max(0, Math.min(S.rec.dur - 0.05, t));
    if (S.playing) R.play(S.rec, t); else { S.off = t; S.lastPos = t; S.monoFrom = null; notify('seek'); }
  };
  R.back5 = function () {
    if (!S) return;
    const p = R.pos();
    let t = Math.max(0, p - 5);
    if (S.loop && t < S.loop[0]) t = S.loop[0];
    sfx('tap');
    R.seek(t);
  };
  R.setRate = function (id, r) {
    const st = state(id); st.rate = r;
    if (S && S.rec.id === id) { if (S.playing) R.play(S.rec, R.pos()); else S.rate = r; }
    notify('rate');
  };
  R.setLoop = function (id, on, range) {
    const st = state(id);
    st.loop = on ? (range || st.lastLoop || [0, 3]) : null;
    if (on) st.lastLoop = st.loop;
    if (S && S.rec.id === id) { if (S.playing) R.play(S.rec, R.pos()); else S.loop = st.loop; }
    notify('loop');
  };
  R.stopAll = function () { if (!S) return; S.playing = false; stopNodes(); S = null; cancelAnimationFrame(raf); notify('state'); };
  R.getBuffer = () => null; // legacy
  R._session = () => S; // debug

  function ended() {
    const rec = S.rec;
    S.playing = false; stopNodes();
    S.paused = false; S.off = 0; S.ended = true;
    notify('ended');
    G.bus.emit('recorder:end', { id: rec.id });
    setTimeout(() => { if (S && S.ended && !S.playing) { miniUpdate(); } }, 50);
  }

  /* ---------------- per-frame: hooks, captions ---------------- */
  function startLoop() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!S || !S.playing) { raf = 0; notify('tick'); return; }
      const pos = R.pos();
      try { hooks(pos); } catch (e) { console.error('[recorder hooks]', e); }
      S.lastPos = pos;
      notify('tick');
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function hooks(pos) {
    const rec = S.rec, st = state(rec.id);
    const jumped = pos < S.lastPos - 0.05 || pos - S.lastPos > 0.75;
    if (!jumped) st.maxPos = Math.max(st.maxPos, pos);
    if (rec.id === 'doorlock' && rec.heardAt && pos >= rec.heardAt && st.maxPos >= rec.heardAt && !G.flag('doorlockHeard')) {
      G.flag('doorlockHeard', true);
      G.bus.emit('recorder:heard', 'doorlock');
    }
    if (rec.id === 'kongi' && st.mode === 'spec' && pos > 4.4 && !G.flag('kongiDrawSeen')) {
      G.flag('kongiDrawSeen', true);
    }
    if (rec.mode === 'phase') phaseHooks(rec, st, pos, jumped);
  }
  function phaseHooks(rec, st, pos, jumped) {
    const mono = isMono();
    const rel = pos - rec.voiceAt;
    if (mono) {
      if (S.monoFrom == null || jumped) S.monoFrom = pos;
      rec.cues.forEach((c, i) => { if (rel >= c[0] + 0.35 && S.monoFrom <= rec.voiceAt + c[0] + 0.25) st.heardCues[i] = 1; });
      const a = rec.voiceAt + rec.segment[0];
      if (!G.flag('frag29') && S.monoFrom <= a + 0.2 && pos >= a + 1.3) register29();
    } else S.monoFrom = null;
    // captions (mono: the whisper; stereo: [치지직—]) — pushed as subtitles when the player isn't on screen
    let cue = -2;
    if (mono) { cue = rec.cues.findIndex((c) => rel >= c[0] && rel < c[1] + 0.25); }
    if (cue !== S.cue) {
      S.cue = cue;
      if (!playerVisible() && cue >= 0) { const c = rec.cues[cue]; G.fx.sub(T(c[2]), Math.max(1400, (c[1] - c[0]) * 1000 / (S.rate || 1) + 300), { cls: 'whisper' }); }
    }
  }
  R.caption = function (rec) {
    if (!S || S.rec !== rec || !S.playing) return '';
    if (rec.mode !== 'phase') return '';
    if (!isMono()) return rec.stereoCaption || '';
    const rel = R.pos() - rec.voiceAt;
    const c = rec.cues.find((x) => rel >= x[0] && rel < x[1] + 0.25);
    return c ? T(c[2]) : '';
  };

  /* ---------------- H2: fragment 29 + mono-off offer ---------------- */
  let offer = null;
  function register29() {
    if (G.flag('frag29')) return;
    if (G.foundFragment) G.foundFragment('29'); else G.flag('frag29', true);
    G.bus.emit('recorder:mono29');
    setTimeout(offerMonoOff, 2600);
  }
  function offerMonoOff() {
    if (offer || !isMono()) return;
    const card = el('div.rc-offer', { role: 'alertdialog' },
      el('div.rc-offer-t', null, '모노 오디오를 끌까요?'),
      el('button.rc-offer-b', null, '끄기'));
    const at = Date.now();
    const close = () => { if (!offer) return; clearInterval(offer.iv); card.classList.remove('in'); setTimeout(() => card.remove(), 300); offer = null; };
    const off = (auto) => { close(); if (isMono() && G.audio.setMono) { G.audio.setMono(false); G.phone.toast(auto ? '모노 오디오가 꺼졌습니다' : '모노 오디오 꺼짐'); } };
    card.querySelector('.rc-offer-b').addEventListener('click', () => { sfx('tap'); off(false); });
    document.getElementById('screen').appendChild(card);
    requestAnimationFrame(() => card.classList.add('in'));
    offer = { card, iv: setInterval(() => {
      if (!isMono()) return close();
      const busy = S && S.playing && S.rec.mode === 'phase';
      if (Date.now() - at >= 10000 && !busy) off(true);
    }, 500) };
  }
  function onMono(on) {
    if (S && S.playing && S.setMono) { S.setMono(!!on); S.monoFrom = null; }
    notify('mono');
  }
  G.bus.on('mono', onMono);
  G.bus.on('settings:mono', onMono);
  G.bus.on('pitchView', () => subs.forEach((fn) => { try { fn('pitch'); } catch (e) {} }));
  G.bus.on('flag:M7', () => R.stopAll());

  /* =========================================================
   * Mini-player chip (status-bar pill under the clock)
   * ========================================================= */
  let mini = null, miniIv = 0;
  function playerVisible() {
    const top = G.phone && G.phone.top && G.phone.top();
    return !!(S && top && top.node && top.node.dataset && top.node.dataset.rec === S.rec.id && !top.node.classList.contains('covered'));
  }
  function miniBuild() {
    if (mini) return mini;
    const main = el('button.rc-mini-main', { 'aria-label': '녹음 열기' }, el('span.rc-eq', null, el('i'), el('i'), el('i')), el('span.rc-mini-t'), el('span.rc-mini-time'));
    const back = el('button.rc-mini-b', { 'aria-label': '5초 뒤로', html: ICON.back5 });
    const play = el('button.rc-mini-b.play', { 'aria-label': '재생/일시정지', html: ICON.pause });
    const x = el('button.rc-mini-b.x', { 'aria-label': '닫기', html: ICON.close });
    mini = el('div.rc-mini', null, main, back, play, x);
    main.addEventListener('click', () => { if (!S) return; sfx('tap'); G.phone.openApp('recorder', { rec: S.rec.id }); });
    back.addEventListener('click', (e) => { e.stopPropagation(); R.back5(); });
    play.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); if (S) R.toggle(S.rec); });
    x.addEventListener('click', (e) => { e.stopPropagation(); sfx('back'); R.stopAll(); });
    document.getElementById('screen').appendChild(mini);
    return mini;
  }
  function miniShouldShow() {
    if (!S || (!S.playing && !S.paused)) return false;
    if (playerVisible()) return false;
    if (G.phone.isLocked && G.phone.isLocked()) return false;
    if (document.querySelector('.notebook.in, .qp-wrap, .call-screen, .cinema, .title-screen, .cx-black')) return false;
    return true;
  }
  function miniUpdate() {
    const show = miniShouldShow();
    if (!show) { if (mini) mini.classList.remove('in'); if (!S) { clearInterval(miniIv); miniIv = 0; } return; }
    miniBuild();
    mini.classList.add('in');
    mini.classList.toggle('paused', !S.playing);
    mini.querySelector('.rc-mini-t').textContent = T(S.rec.title);
    mini.querySelector('.rc-mini-main').setAttribute('aria-label', T(S.rec.title) + ' — 녹음 열기');
    mini.querySelector('.rc-mini-time').textContent = fmt(R.pos());
    mini.querySelector('.play').innerHTML = S.playing ? ICON.pause : ICON.play;
    if (!miniIv) miniIv = setInterval(miniUpdate, 400);
  }
  G.bus.on('screen:push', () => setTimeout(miniUpdate, 30));
  G.bus.on('screen:pop', () => setTimeout(miniUpdate, 30));
  G.bus.on('home', () => setTimeout(miniUpdate, 30));
  G.bus.on('app:open', () => setTimeout(miniUpdate, 30));

  /* =========================================================
   * App: list
   * ========================================================= */
  G.app('recorder', {
    name: '녹음',
    icon: G.ICONS.recorder,
    open(p) {
      prefetch();
      const list = el('div.rc-list');
      const recBtn = el('button.rc-rec', { 'aria-label': '녹음' }, el('i'));
      recBtn.addEventListener('click', () => { sfx('error'); G.phone.toast('마이크를 사용할 수 없습니다 · 관리자 정책'); });
      const body = el('div.rc-listbody', null, el('div.rc-big', null, '모든 녹음'), el('div.rc-count'), list);
      const scr = G.ui.screen({ title: '녹음', theme: 'dark', cls: 'rc-screen rc-home', body, footer: el('div.rc-recbar', null, recBtn) });
      scr.dataset.status = 'light';
      function render() {
        list.innerHTML = '';
        const all = recs();
        scr.querySelector('.rc-count').textContent = `녹음 파일 ${all.length}개`;
        all.forEach((r) => {
          const on = S && S.rec === r && S.playing;
          const row = el('button.rc-row' + (on ? '.on' : ''), { 'aria-label': T(r.title) },
            el('div.rc-row-main', null,
              el('div.rc-row-t', null, on ? el('span.rc-eq.live', null, el('i'), el('i'), el('i')) : null, T(r.title)),
              el('div.rc-row-s', null, r.tag ? el('span.rc-tag', null, el('span.rc-tag-ic', { html: ICON.ear }), r.tag) : null, dateLabel(r))),
            el('div.rc-row-d', null, fmt(r.dur)));
          row.addEventListener('click', () => { sfx('tap'); openPlayer(r); });
          list.appendChild(row);
        });
      }
      render();
      const unsub = R.sub((k) => { if (k === 'state' || k === 'ended') render(); });
      G.phone.push(scr, { onResume: render, onClose: unsub });
      if (p && p.rec) { const r = byId(p.rec); if (r) openPlayer(r, true); }
    },
  });

  /* =========================================================
   * Player
   * ========================================================= */
  const PAL = [[0, 0, 0, 6], [0.14, 28, 12, 68], [0.32, 101, 21, 110], [0.5, 174, 48, 92], [0.66, 229, 92, 48], [0.8, 248, 148, 30], [0.92, 250, 208, 60], [1, 252, 250, 190]];
  const LUT = (() => { const l = new Uint8ClampedArray(256 * 3); for (let i = 0; i < 256; i++) { const t = Math.pow(i / 255, 1.35); let k = 0; while (k < PAL.length - 2 && t > PAL[k + 1][0]) k++; const a = PAL[k], b = PAL[k + 1], f = (t - a[0]) / (b[0] - a[0]); for (let c = 0; c < 3; c++) l[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f; } return l; })();
  const KEY_LO = Math.log2(523.25), KEY_HI = Math.log2(1318.51);
  const pitchH = (hz) => 12 + 88 * ((Math.log2(hz) - KEY_LO) / (KEY_HI - KEY_LO));

  function openPlayer(rec, instant) {
    const st = state(rec.id);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // ---- DOM ----
    const tagRow = rec.tag ? el('div.rc-tags', null, el('span.rc-tag', null, el('span.rc-tag-ic', { html: ICON.ear }), rec.tag), rec.sub ? el('span.rc-tagsub', null, rec.sub) : null) : null;
    const segWave = el('button.rc-seg-b', null, '파형'), segSpec = el('button.rc-seg-b', null, '주파수');
    const seg = el('div.rc-seg', { role: 'tablist' }, segWave, segSpec);
    const axis = el('div.rc-axis');
    const cv = el('canvas.rc-cv');
    const loading = el('div.rc-loading', null, '불러오는 중…');
    const cvWrap = el('div.rc-cvwrap', null, cv, axis, loading);
    const cap = el('div.rc-cap', { 'aria-live': 'polite' });
    const disp = el('div.rc-disp', null, el('div.rc-disp-top', null, el('span.rc-disp-l'), seg), cvWrap, cap);
    const pitchBox = rec.pitches ? el('div.rc-pitch', null, el('div.rc-pitch-in')) : null;
    const fill = el('i.rc-fill'), knob = el('i.rc-knob'), loopR = el('i.rc-loopr'), hA = el('i.rc-h.a'), hB = el('i.rc-h.b');
    const bar = el('div.rc-bar', { role: 'slider', 'aria-label': '재생 위치' }, el('i.rc-track'), loopR, fill, knob, hA, hB);
    const tCur = el('span'), tDur = el('span', null, fmt(rec.dur));
    const scrub = el('div.rc-scrub', null, bar, el('div.rc-times', null, tCur, tDur));
    const bBack = el('button.rc-cb', { 'aria-label': '5초 뒤로' }, el('span.rc-cb-ic', { html: ICON.back5 }), el('small', null, '5초 뒤로'));
    const bPlay = el('button.rc-playbtn', { 'aria-label': '재생', html: ICON.play });
    const bLoop = el('button.rc-cb', { 'aria-label': '구간 반복' }, el('span.rc-cb-ic', { html: ICON.loop }), el('small', null, '구간 반복'));
    const ctrls = el('div.rc-ctrls', null, bBack, bPlay, bLoop);
    const cRate = el('button.rc-chip', null, '0.75×');
    const cText = el('button.rc-chip', null, '텍스트 보기');
    const cPitch = rec.pitches ? el('button.rc-chip', null, '음높이 보기') : null;
    const chips = el('div.rc-chips', null, cRate, cText, cPitch);
    const trans = el('div.rc-trans');
    const note = rec.note ? el('div.rc-note', null, T(rec.note)) : null;
    const body = el('div.rc-p', null, tagRow, disp, pitchBox, scrub, ctrls, chips, trans, note);
    const scr = G.ui.screen({ title: T(rec.title), sub: dateLabel(rec) + ' · ' + fmt(rec.dur), theme: 'dark', cls: 'rc-screen rc-player', body });
    scr.dataset.status = 'light';
    scr.dataset.rec = rec.id;

    // ---- data (render lazily) ----
    let data = null, peaks = null, peaksMono = null, specC = st.specC || null;
    const cur = () => (S && S.rec === rec ? S : null);
    if (!ready()) { loading.textContent = '소리를 켜야 재생할 수 있습니다'; }
    else load(rec).then((d) => { data = d; loading.classList.add('gone'); if (!d) { loading.textContent = '이 파일을 재생할 수 없습니다'; loading.classList.remove('gone'); } computePeaks(); draw(); });

    function computePeaks() {
      if (!data) return;
      const W = Math.max(60, Math.floor(cv.width / dpr / 3));
      const pk = (fn, len) => { const out = new Float32Array(W); for (let k = 0; k < W; k++) { const a = Math.floor((k / W) * len), b = Math.floor(((k + 1) / W) * len); let m = 0; for (let i = a; i < b; i += 4) { const v = Math.abs(fn(i)); if (v > m) m = v; } out[k] = m; } return out; };
      if (rec.mode === 'phase') {
        const A = data.noiseA.getChannelData(0), Vd = data.voice.getChannelData(0), vr = data.voice.sampleRate / data.noiseA.sampleRate;
        peaks = pk((i) => A[i] + 0.12 * (Vd[Math.floor(i * vr)] || 0), A.length);
        peaksMono = pk((i) => 0.55 * (Vd[Math.floor(i * vr)] || 0), A.length);
      } else {
        const L = data.getChannelData(0), Rr = data.numberOfChannels > 1 ? data.getChannelData(1) : L;
        peaks = pk((i) => (L[i] + Rr[i]) * 0.5, L.length);
      }
    }

    // ---- canvas ----
    function size() {
      const w = Math.max(200, cvWrap.clientWidth), h = cvWrap.clientHeight || 172;
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (cv.width !== W || cv.height !== H) {
        cv.width = W; cv.height = H;
        if (!specC || specC.width !== W || specC.height !== H) {
          const nc = document.createElement('canvas'); nc.width = W; nc.height = H;
          const x = nc.getContext('2d'); x.fillStyle = '#000006'; x.fillRect(0, 0, W, H);
          if (specC) x.drawImage(specC, 0, 0, W, H);
          specC = st.specC = nc;
        }
        computePeaks();
      }
    }
    function drawAxis() {
      axis.innerHTML = '';
      if (st.mode !== 'spec') return;
      const mx = rec.maxHz || 8000;
      for (let f = 2000; f < mx; f += 2000) axis.appendChild(el('span', { style: { bottom: (f / mx) * 100 + '%' } }, f / 1000 + 'k'));
    }
    let lastX = -1;
    function paintSpec(pos) {
      const s = cur(); if (!s || !s.playing || !s.analyser || !specC) return;
      const an = s.analyser, bins = an.frequencyBinCount;
      if (!st.fbuf || st.fbuf.length !== bins) st.fbuf = new Uint8Array(bins);
      an.getByteFrequencyData(st.fbuf);
      const W = specC.width, H = specC.height, x1 = Math.min(W - 1, Math.floor((pos / rec.dur) * W));
      let x0 = lastX >= 0 && x1 >= lastX && x1 - lastX < W * 0.08 ? lastX + 1 : x1;
      if (x0 > x1) return;
      const cw = x1 - x0 + 1, img = specC.getContext('2d').createImageData(cw, H), dd = img.data;
      const nyq = ac().sampleRate / 2, mx = rec.maxHz || 8000;
      for (let y = 0; y < H; y++) {
        const f0 = (1 - (y + 1) / H) * mx, f1 = (1 - y / H) * mx;
        const b0 = Math.max(0, Math.floor((f0 / nyq) * bins)), b1 = Math.min(bins - 1, Math.max(b0, Math.ceil((f1 / nyq) * bins)));
        let v = 0; for (let b = b0; b <= b1; b++) if (st.fbuf[b] > v) v = st.fbuf[b];
        const r = LUT[v * 3], g = LUT[v * 3 + 1], bl = LUT[v * 3 + 2];
        for (let k = 0; k < cw; k++) { const o = (y * cw + k) * 4; dd[o] = r; dd[o + 1] = g; dd[o + 2] = bl; dd[o + 3] = 255; }
      }
      specC.getContext('2d').putImageData(img, x0, 0);
      lastX = x1;
    }
    function draw() {
      size();
      const x = cv.getContext('2d'), W = cv.width, H = cv.height;
      const pos = cur() ? R.pos() : 0, px = (pos / rec.dur) * W;
      x.clearRect(0, 0, W, H);
      const loop = st.loop;
      if (st.mode === 'spec') {
        if (specC) x.drawImage(specC, 0, 0);
      } else {
        x.fillStyle = '#0b0b0e'; x.fillRect(0, 0, W, H);
        x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
        const pk = rec.mode === 'phase' && isMono() ? peaksMono : peaks;
        if (pk) {
          const n = pk.length, bw = W / n;
          for (let k = 0; k < n; k++) {
            const h = Math.max(1.5 * dpr, Math.min(1, pk[k] * 1.15) * H * 0.86);
            const cx = k * bw;
            x.fillStyle = cx < px ? '#ff453a' : 'rgba(235,235,245,.34)';
            x.fillRect(cx + bw * 0.2, (H - h) / 2, Math.max(1, bw * 0.6), h);
          }
        }
      }
      if (loop) { x.fillStyle = 'rgba(255,214,10,.12)'; x.fillRect((loop[0] / rec.dur) * W, 0, ((loop[1] - loop[0]) / rec.dur) * W, H); }
      if (cur()) { x.fillStyle = '#fff'; x.fillRect(Math.min(W - 2 * dpr, px), 0, 2 * dpr, H); }
    }

    // ---- UI sync ----
    function syncControls() {
      const s = cur(), playing = !!(s && s.playing);
      bPlay.innerHTML = playing ? ICON.pause : ICON.play;
      bPlay.setAttribute('aria-label', playing ? '일시정지' : '재생');
      bPlay.classList.toggle('on', playing);
      segWave.classList.toggle('on', st.mode === 'wave'); segSpec.classList.toggle('on', st.mode === 'spec');
      scr.querySelector('.rc-disp-l').textContent = st.mode === 'spec' ? `0–${(rec.maxHz || 8000) / 1000} kHz` : (rec.mode === 'phase' ? (isMono() ? '모노' : '스테레오') : '');
      cRate.classList.toggle('on', st.rate !== 1);
      cText.classList.toggle('on', st.transcript);
      bLoop.classList.toggle('on', !!st.loop);
      if (cPitch) cPitch.classList.toggle('on', pitchOn());
      if (pitchBox) pitchBox.classList.toggle('show', pitchOn());
      trans.classList.toggle('show', st.transcript);
      drawAxis();
      syncScrub();
      renderPitch(); renderTrans();
    }
    function syncScrub() {
      const s = cur(), pos = s ? R.pos() : 0;
      const pct = Math.min(100, (pos / rec.dur) * 100);
      if (!dragging) { fill.style.width = pct + '%'; knob.style.left = pct + '%'; tCur.textContent = fmt(pos); }
      const L = st.loop;
      [loopR, hA, hB].forEach((n) => n.classList.toggle('on', !!L));
      if (L) { loopR.style.left = (L[0] / rec.dur) * 100 + '%'; loopR.style.width = ((L[1] - L[0]) / rec.dur) * 100 + '%'; hA.style.left = (L[0] / rec.dur) * 100 + '%'; hB.style.left = (L[1] / rec.dur) * 100 + '%'; }
      cap.textContent = R.caption(rec);
      cap.classList.toggle('whisper', rec.mode === 'phase' && isMono());
    }
    let pitchKey = '';
    function renderPitch() {
      if (!pitchBox) return;
      const inner = pitchBox.firstChild;
      const upto = st.maxPos;
      const key = pitchOn() + ':' + rec.pitches.filter((p) => upto >= p.t).length;
      if (key === pitchKey) return; pitchKey = key;
      inner.innerHTML = '';
      const grid = el('div.rc-grid'); ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((k) => { const HZ = (G.audio && G.audio.DOORKEY_HZ) || {}; if (HZ[k]) grid.appendChild(el('i', { style: { bottom: pitchH(HZ[k]) + '%' } })); });
      inner.appendChild(grid);
      let group = null;
      rec.pitches.forEach((p) => {
        const shown = upto >= p.t;
        if (p.kind === 'melody') {
          if (!group) { group = el('span.rc-pg', null, el('span.rc-pg-l', null, '삐리릭')); inner.appendChild(group); }
          group.appendChild(el('i.rc-pb.mel' + (shown ? '.in' : ''), { style: { height: pitchH(p.hz) + '%' } }));
          if (shown) group.classList.add('in');
          return;
        }
        if (p.kind === 'bark') { inner.appendChild(el('i.rc-pb.bark' + (shown ? '.in' : ''), null, el('span', null, '멍'))); return; }
        inner.appendChild(el('i.rc-pb.key' + (shown ? '.in' : ''), { style: { height: pitchH(p.hz) + '%' } }));
      });
    }
    let transKey = '';
    function renderTrans() {
      if (!st.transcript) { if (transKey) { trans.innerHTML = ''; transKey = ''; } return; }
      let rows;
      if (rec.mode === 'phase') {
        const heard = rec.cues.map((c, i) => (st.heardCues[i] ? { t: rec.voiceAt + c[0], text: T(c[2]) } : null)).filter(Boolean);
        rows = heard.length ? heard : rec.transcript;
      } else rows = rec.transcript || [];
      const pos = cur() ? R.pos() : -1;
      const idx = rows.reduce((a, r, i) => (pos >= r.t ? i : a), -1);
      const key = rows.length + ':' + idx;
      if (key === transKey) return; transKey = key;
      trans.innerHTML = '';
      trans.appendChild(el('div.rc-trans-h', null, '음성 텍스트 변환'));
      rows.forEach((r, i) => trans.appendChild(el('div.rc-tr' + (i === idx ? '.on' : ''), null, el('small', null, fmt(r.t)), el('span', null, r.text))));
    }

    // ---- events ----
    bPlay.addEventListener('click', () => { sfx('tap'); if (cur() && cur().playing) R.pause(true); else { lastX = -1; R.play(rec, cur() ? undefined : 0); } });
    bBack.addEventListener('click', () => { if (!cur()) { R.play(rec, 0); return; } R.back5(); });
    bLoop.addEventListener('click', () => { sfx('tap'); R.setLoop(rec.id, !st.loop); if (st.loop && !(cur() && cur().playing)) R.play(rec, st.loop[0]); });
    segWave.addEventListener('click', () => { if (st.mode === 'wave') return; sfx('tap'); st.mode = 'wave'; syncControls(); draw(); });
    segSpec.addEventListener('click', () => { if (st.mode === 'spec') return; sfx('tap'); st.mode = 'spec'; lastX = -1; G.bus.emit('recorder:spectrum', rec.id); syncControls(); draw(); });
    cRate.addEventListener('click', () => { sfx('tap'); R.setRate(rec.id, st.rate === 1 ? 0.75 : 1); });
    cText.addEventListener('click', () => { sfx('tap'); st.transcript = !st.transcript; transKey = ''; syncControls(); });
    if (cPitch) cPitch.addEventListener('click', () => { sfx('tap'); setPitch(!pitchOn()); pitchKey = ''; });

    // scrub + loop handles
    let dragging = null;
    function posFromX(cx) { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (cx - r.left) / r.width)) * rec.dur; }
    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault(); bar.setPointerCapture(e.pointerId);
      const t = posFromX(e.clientX), L = st.loop;
      if (L && Math.abs(t - L[0]) < rec.dur * 0.04) dragging = 'a';
      else if (L && Math.abs(t - L[1]) < rec.dur * 0.04) dragging = 'b';
      else { dragging = 'pos'; scrubTo(t); }
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const t = posFromX(e.clientX);
      if (dragging === 'pos') scrubTo(t);
      else { const L = st.loop.slice(); if (dragging === 'a') L[0] = Math.max(0, Math.min(L[1] - 0.5, t)); else L[1] = Math.min(rec.dur, Math.max(L[0] + 0.5, t)); st.loop = L; st.lastLoop = L; syncScrub(); draw(); }
    });
    const up = (e) => {
      if (!dragging) return;
      const d = dragging; dragging = null;
      if (d === 'pos') { const t = posFromX(e.clientX); lastX = -1; if (cur()) R.seek(t); else { R.play(rec, t).then(() => {}); } }
      else R.setLoop(rec.id, true, st.loop);
    };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    function scrubTo(t) { const pct = (t / rec.dur) * 100; fill.style.width = pct + '%'; knob.style.left = pct + '%'; tCur.textContent = fmt(t); }

    const unsub = R.sub((kind) => {
      if (!scr.isConnected) return;
      if (kind === 'tick') { const s = cur(); if (s && s.playing && st.mode === 'spec') paintSpec(R.pos()); syncScrub(); renderPitch(); renderTrans(); draw(); return; }
      if (kind === 'loading') { if (!data) loading.classList.remove('gone'); }
      if (kind === 'seek' || kind === 'state') lastX = -1;
      syncControls(); draw();
    });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { draw(); }) : null;
    if (ro) ro.observe(cvWrap);
    G.phone.push(scr, { anim: instant ? 'none' : undefined, onClose: () => { unsub(); if (ro) ro.disconnect(); setTimeout(miniUpdate, 40); }, onResume: () => { syncControls(); draw(); } });
    G.bus.emit('recorder:open', rec.id);
    requestAnimationFrame(() => { syncControls(); draw(); });
  }
})();
