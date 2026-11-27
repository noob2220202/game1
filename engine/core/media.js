/* =========================================================
 * engine/core/media.js — G.media: the phone's single media-playback / output route (core · DESIGN_EP2 §7.1.5, §9.7
 * 블루투스 시뮬레이션 · ARCH_EP2 §4.8). Recorder, gallery videos and voice messages play through here; alarms, ringtones,
 * notification tones and world sounds never do (so they can never satisfy C2). No Web Bluetooth — all simulated.
 *
 * G.media.init()
 * G.media.play(src, { loop=false, from:'recorder'|'gallery'|'voice', id, offset=0, dur, onEnd, onTime(t) }) → handle
 *     src: AudioBuffer | Promise<AudioBuffer|null> | buffer id ('rec.uri' …, via G.audio.buffer) | null (silent run of `dur` s)
 *     handle: { id, from, target, duration, playing(), loading(), pause(), resume(), stop(), seek(t), position() → s }
 *     A new play stops the previous one (single media stream, like a real phone).
 * G.media.out() → 'bt'|'phone'   (btConnected && !musicCut ? 'bt' : 'phone'); route change while playing = 80 ms crossfade,
 *     the BT path is always 0.2 s late (DelayNode).
 * G.media.state() → { playing, from, id, target, pos, vol:{bt, phone} }
 * G.media.setVolume(target, v, {source:'ui'|'remote'}) · getVolume(target) · stopAll() · cut({pop=true})
 * G.media.bt = { on(), setOn(b), state() → 'off'|'idle'|'connecting'|'connected'|'gone', connect() → Promise<'ok'|'off'|'notfound'>,
 *                disconnect(), connected(), retire() }
 * Flags written: btConnected (TOGGLE) · btPlaying (TOGGLE) · musicCut.   Vars written: btOn btVol phoneVol ledState.
 * Bus: 'media:play' {id, from, target[, reroute]} · 'media:stop' {id, from, reason:'end'|'stop'|'cut'|'replace'} ·
 *      'media:vol' {target, v, source} · 'media:out' {target} · 'bt:change' {state} · 'bt:cut'
 * DSP chains come from audio: G.audio.mediaChain(kind) → { input, setVolume(v, tauSec), dispose() } (fallback built here).
 * Disconnect / cut while playing on the speaker pauses playback (Android "becoming noisy"), so nothing blares from the phone.
 * from:'voice' clips may carry AudioBuffer.mediaTrimDb (G.audio.jiminVM: +10 dB) — applied on the phone route only.
 *
 * Episode 3 (owner: audio · ARCH_EP3 §4.2 · DESIGN_EP3 §7.1.5) — active only when G.EP.mediaRoute is a function:
 *   out() = G.EP.mediaRoute() → 'ear' | 'table'. Each playback connects its source to one gain per route kind ('ear', 'table'),
 *   each into chain(kind) = G.audio.mediaChain(kind); gain 1 on h.target, 0 on the other — no DelayNode (the 0.2 s is ep2 BT only).
 *   Listens room:where · var:where · flag:playArmed (handlers return at once without G.EP.mediaRoute) → reroute: 80 ms crossfade
 *   + bus 'media:out' {target}. The ep2 "speaker went away → pause" branch applies to 'bt' only. from:'callrec' is a valid source.
 *   Volume of the ear/table chains = vars.phoneVol (no ep3 volume UI — the chains are calibrated at 60).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const M = (G.media = G.media || {});
  const bus = G.bus;
  const flag = (n) => !!(G.flag && G.flag(n));
  const V = (k, v) => (v === undefined ? G.vars(k) : G.vars(k, v));
  const ES = () => { const v = G.state.vars; if (!v.e2 || typeof v.e2 !== 'object') v.e2 = {}; return v.e2; };
  const STR = (k, d) => (G.e2 && G.e2.STR && G.e2.STR[k]) || d;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------------- time base (AudioContext time when running, else visible wall time) ---------------- */
  let hiddenAt = null, hiddenTotal = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt != null) { hiddenTotal += performance.now() - hiddenAt; hiddenAt = null; }
  });
  const visNow = () => ((hiddenAt != null ? hiddenAt : performance.now()) - hiddenTotal) / 1000;
  const actx = () => (G.audio && G.audio.ctx && typeof G.audio.ctx.createGain === 'function' ? G.audio.ctx : null);
  const ctxRunning = () => { const c = actx(); return !!(c && c.state === 'running'); };

  /* ---------------- output chains ---------------- */
  const chains = {};
  function fallbackChain(kind) {
    const c = actx(); if (!c) return null;
    const input = c.createGain(), out = c.createGain();
    let tail = input;
    if (kind === 'bt') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; input.connect(lp); tail = lp; }
    tail.connect(out);
    let dest = c.destination;
    try { if (G.audio && G.audio.bus) { const b = G.audio.bus(kind === 'bt' ? 'mediaOut' : 'music'); if (b && b.connect) dest = b; } } catch (e) {}
    out.connect(dest);
    const law = (v) => Math.pow(clamp(v, 0, 100) / 100, 1.6) * (kind === 'bt' ? 0.22 : 1);
    return { input, setVolume(v, tau) { try { out.gain.setTargetAtTime(law(v), c.currentTime, tau || 0.08); } catch (e) { out.gain.value = law(v); } }, dispose() { try { input.disconnect(); out.disconnect(); } catch (e) {} } };
  }
  function chain(kind) {
    if (chains[kind]) return chains[kind];
    let ch = null;
    try { if (G.audio && G.audio.mediaChain) ch = G.audio.mediaChain(kind); } catch (e) { console.error('[media] mediaChain', e); }
    if (!ch || !ch.input) ch = fallbackChain(kind);
    if (ch) { chains[kind] = ch; try { ch.setVolume(M.getVolume(kind), 0.01); } catch (e) {} }
    return ch;
  }

  /* ---------------- state ---------------- */
  let cur = null;          // current handle
  let btConn = null;       // pending connect promise
  let btBusy = false;      // 'connecting'
  let rafId = 0;

  /* ep3 route layer: G.EP.mediaRoute() → 'ear'|'table' (absent in ep2 ⇒ the bt/phone logic below, unchanged) */
  const routeFn = () => (G.EP && typeof G.EP.mediaRoute === 'function' ? G.EP.mediaRoute : null);
  const ROUTES = ['ear', 'table'];
  M.out = () => {
    const rf = routeFn();
    if (rf) { let r = null; try { r = rf(); } catch (e) { console.error('[media] mediaRoute', e); } return ROUTES.indexOf(r) >= 0 ? r : 'ear'; }
    return flag('btConnected') && !flag('musicCut') ? 'bt' : 'phone';
  };
  M.getVolume = (target) => { const v = V(target === 'bt' ? 'btVol' : 'phoneVol'); return Number.isFinite(v) ? v : target === 'bt' ? 15 : 60; };
  M.state = () => ({
    playing: !!(cur && cur.playing()), from: cur ? cur.from : null, id: cur ? cur.id : null,
    target: cur && cur.playing() ? cur.target : M.out(), pos: cur ? cur.position() : 0,
    vol: { bt: M.getVolume('bt'), phone: M.getVolume('phone') },
  });
  function syncBtPlaying() {
    const on = !!(cur && cur.playing() && cur.target === 'bt');
    if (on !== flag('btPlaying')) G.flag('btPlaying', on);
  }

  M.setVolume = function (target, v, opts) {
    target = target === 'bt' ? 'bt' : 'phone';
    const source = (opts && opts.source) || 'ui';
    v = clamp(Math.round(Number(v) || 0), 0, 100);
    V(target === 'bt' ? 'btVol' : 'phoneVol', v);
    const ch = chains[target];
    if (ch) { try { ch.setVolume(v, source === 'remote' ? 0.3 : 0.08); } catch (e) {} }
    bus.emit('media:vol', { target, v, source });
    return v;
  };

  /* ---------------- playback handle ---------------- */
  /** voice-message trim on the phone route only (§10 H 대사 −16 LUFS 근처): a clip may carry `mediaTrimDb` on its AudioBuffer
   *  (G.audio.jiminVM tags the TTS voicemail, mastered ≈ 10 dB under the dialogue target for this chain — the rendered hook voice
   *  is already at target and carries none). The Bluetooth path never gets it, so the C2 / 2층_스피커 calibration is untouched. */
  function phoneTrim(h) {
    const d = h.from === 'voice' && h._buf ? Number(h._buf.mediaTrimDb) : 0;
    return Number.isFinite(d) && d !== 0 ? Math.pow(10, clamp(d, -24, 18) / 20) : 1;
  }
  function makeHandle(src, o) {
    const h = {
      id: o.id || 'media' + Date.now().toString(36), from: o.from || 'recorder', loop: !!o.loop,
      target: M.out(), duration: o.dur || 0, _buf: null, _loading: true, _playing: false, _ended: false, _stopped: false,
      _pos: Math.max(0, o.offset || 0), _t0: 0, _ctxClock: false, _nodes: null, o,
    };
    h.loading = () => h._loading;
    h.playing = () => h._playing && !h._stopped;
    const now = () => (h._ctxClock && actx() ? actx().currentTime : visNow());
    h.position = function () {
      if (!h._playing) return h._pos;
      let p = now() - h._t0;
      if (h.duration > 0) p = h.loop ? p % h.duration : Math.min(p, h.duration);
      return Math.max(0, p);
    };
    function killNodes() {
      const n = h._nodes; h._nodes = null;
      if (!n) return;
      try { n.src.onended = null; n.src.stop(); } catch (e) {}
      if (n.gs) { setTimeout(() => { try { n.src.disconnect(); } catch (e) {} Object.keys(n.gs).forEach((k) => { try { n.gs[k].disconnect(); } catch (e) {} }); }, 150); return; }
      setTimeout(() => { try { n.src.disconnect(); n.gP.disconnect(); n.gB.disconnect(); n.dly.disconnect(); } catch (e) {} }, 150);
    }
    function startAt(offset) {
      h._ctxClock = ctxRunning() && !!h._buf;
      const c = actx();
      if (h._buf && c && h._ctxClock && routeFn()) {        // ep3: one gain per route kind, no delay
        const s = c.createBufferSource(); s.buffer = h._buf; s.loop = h.loop;
        const gs = {};
        ROUTES.forEach((k) => { const ch = chain(k), g = c.createGain(); g.gain.value = h.target === k ? 1 : 0; s.connect(g); if (ch) g.connect(ch.input); gs[k] = g; });
        s.onended = () => { if (h._nodes && h._nodes.src === s && !h.loop) ended(); };
        try { s.start(0, clamp(offset, 0, Math.max(0, h._buf.duration - 0.001))); } catch (e) { console.error('[media] start', e); }
        h._nodes = { src: s, gs };
      } else if (h._buf && c && h._ctxClock) {
        const pc = chain('phone'), bc = chain('bt');
        const s = c.createBufferSource(); s.buffer = h._buf; s.loop = h.loop;
        const gP = c.createGain(), gB = c.createGain(), dly = c.createDelay(1);
        dly.delayTime.value = 0.2;
        h._vt = phoneTrim(h);
        gP.gain.value = h.target === 'phone' ? h._vt : 0; gB.gain.value = h.target === 'bt' ? 1 : 0;
        s.connect(gP); s.connect(dly); dly.connect(gB);
        if (pc) gP.connect(pc.input); if (bc) gB.connect(bc.input);
        s.onended = () => { if (h._nodes && h._nodes.src === s && !h.loop) ended(); };
        try { s.start(0, clamp(offset, 0, Math.max(0, h._buf.duration - 0.001))); } catch (e) { console.error('[media] start', e); }
        h._nodes = { src: s, gP, gB, dly };
      }
      h._t0 = now() - offset;
      h._playing = true;
      kick();
    }
    function ended() {
      if (!h._playing || h._stopped) return;
      h._pos = h.duration; h._playing = false; h._ended = true;
      killNodes();
      if (cur === h) { syncBtPlaying(); bus.emit('media:stop', { id: h.id, from: h.from, reason: 'end' }); }
      try { if (o.onEnd) o.onEnd(); } catch (e) { console.error('[media] onEnd', e); }
    }
    h._ended_ = ended;
    h.pause = function (reason) {
      if (!h._playing) return;
      h._pos = h.position(); h._playing = false; killNodes();
      if (cur === h) { syncBtPlaying(); bus.emit('media:stop', { id: h.id, from: h.from, reason: reason || 'stop' }); }
    };
    h.resume = function () {
      if (h._playing || h._stopped || h._loading) return;
      if (!h.loop && h.duration > 0 && h._pos >= h.duration - 0.02) h._pos = 0;
      if (cur && cur !== h) { cur.stop('replace'); }
      cur = h; h.target = M.out();
      startAt(h._pos);
      syncBtPlaying();
      bus.emit('media:play', { id: h.id, from: h.from, target: h.target });
    };
    h.stop = function (reason) {
      if (h._stopped) return;
      const was = h._playing;
      h._pos = h.position(); h._playing = false; h._stopped = true; killNodes();
      if (cur === h) { cur = null; syncBtPlaying(); if (was || reason) bus.emit('media:stop', { id: h.id, from: h.from, reason: reason || 'stop' }); }
    };
    h.seek = function (t) {
      t = clamp(Number(t) || 0, 0, h.duration || 0);
      if (h._playing) { killNodes(); startAt(t); } else h._pos = t;
    };
    h._reroute = function (to, ms) {
      const old = h.target; h.target = to;
      const n = h._nodes, c = actx();
      if (n && c) {
        const t = c.currentTime, tau = (ms || 80) / 1000 / 3;
        if (n.gs) { Object.keys(n.gs).forEach((k) => { try { const p = n.gs[k].gain; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.setTargetAtTime(k === to ? 1 : 0, t, tau); } catch (e) {} }); }
        else { try { n.gP.gain.setTargetAtTime(to === 'phone' ? (h._vt || 1) : 0, t, tau); n.gB.gain.setTargetAtTime(to === 'bt' ? 1 : 0, t, tau); } catch (e) {} }
      }
      return old !== to;
    };
    h._begin = function (buf) {
      h._loading = false;
      h._buf = buf || null;
      if (h._buf && h._buf.duration) h.duration = h._buf.duration;
      if (h._stopped) return;
      if (!h.duration) { h._playing = false; h._ended = true; if (cur === h) { cur = null; syncBtPlaying(); } try { if (o.onEnd) o.onEnd(); } catch (e) {} return; }
      startAt(h._pos);
      syncBtPlaying();
      bus.emit('media:play', { id: h.id, from: h.from, target: h.target });
    };
    return h;
  }

  /* rAF loop: onTime callbacks + end detection for silent / ctx-less runs (UI animation only while visible) */
  function kick() { if (!rafId) rafId = requestAnimationFrame(loop); }
  function loop() {
    rafId = 0;
    const h = cur;
    if (!h || !h._playing) return;
    const p = h.position();
    if (!h.loop && h.duration > 0 && p >= h.duration - 0.005 && !(h._nodes && h._ctxClock)) h._ended_();
    else if (!h.loop && h.duration > 0 && p >= h.duration + 0.25) h._ended_();   // safety net if onended was lost
    if (h.o.onTime) { try { h.o.onTime(h.position()); } catch (e) {} }
    if (cur && cur._playing) rafId = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cur && cur._playing) kick(); });

  M.play = function (src, o) {
    o = o || {};
    if (cur) cur.stop('replace');
    const h = makeHandle(src, o);
    cur = h;
    let p;
    if (typeof src === 'string') p = G.audio && G.audio.buffer ? Promise.resolve(G.audio.buffer(src)) : Promise.resolve(null);
    else p = Promise.resolve(src);
    p.then((buf) => h._begin(buf && typeof buf.getChannelData === 'function' ? buf : null), (e) => { console.error('[media] buffer', e); h._begin(null); });
    return h;
  };
  M.stopAll = function () { if (cur) cur.stop('stop'); };

  /* route changes (BT connect / disconnect / cut) */
  let lastRoute = null;
  function reroute(reason) {
    const to = M.out();
    const h = cur;
    if (routeFn()) {                                       // ep3 ear ⇄ table (80 ms crossfade · nothing pauses)
      if (h && h._playing) { if (h._reroute(to, 80)) bus.emit('media:out', { target: to }); }
      else if (h) h.target = to;
      if (!(h && h._playing) && to !== lastRoute) bus.emit('media:out', { target: to });
      lastRoute = to;
      return;
    }
    if (!h || !h._playing) { bus.emit('media:out', { target: to }); return; }
    if (to === 'phone' && h.target === 'bt') {            // speaker went away → pause (Android 'becoming noisy')
      h.pause(reason === 'cut' ? 'cut' : 'stop');
      bus.emit('media:out', { target: to });
      return;
    }
    if (h._reroute(to, 80)) {
      syncBtPlaying();
      bus.emit('media:out', { target: to });
      if (to === 'bt') bus.emit('media:play', { id: h.id, from: h.from, target: 'bt', reroute: true });
    }
  }

  /* ---------------- media.cut (climax only) ---------------- */
  M.cut = function (opts) {
    opts = opts || {};
    if (flag('musicCut')) return;
    const h = cur, playingOut = !!(h && h._playing && h.target === 'bt');
    if (playingOut) {
      const n = h._nodes, c = actx();
      if (n && c) { try { n.gB.gain.cancelScheduledValues(c.currentTime); n.gB.gain.setValueAtTime(n.gB.gain.value, c.currentTime); n.gB.gain.linearRampToValueAtTime(0, c.currentTime + 0.008); } catch (e) {} }
      if (opts.pop !== false) { try { if (G.audio && G.audio.cue) G.audio.cue('media.cut'); } catch (e) {} }
    }
    G.flag('musicCut', true);
    V('ledState', 'off');
    const st = ES();
    if (!st.btCutToast) { st.btCutToast = true; try { if (G.phone && G.phone.toast) G.phone.toast(G.T ? G.T(STR('btCut', '2층_스피커 연결 끊김')) : STR('btCut', '2층_스피커 연결 끊김')); } catch (e) {} }
    if (flag('btConnected')) G.flag('btConnected', false);
    setTimeout(() => reroute('cut'), playingOut ? 12 : 0);
    bus.emit('bt:cut');
    bus.emit('bt:change', { state: M.bt.state() });
  };

  /* ---------------- Bluetooth simulation (§9.7) ---------------- */
  const gone = () => flag('musicCut') || !!ES().btRetired;
  M.bt = {
    on() { return V('btOn') !== false; },
    setOn(b) {
      b = !!b;
      if (b === M.bt.on()) return;
      V('btOn', b);
      if (!b) {
        btBusy = false;
        if (flag('btConnected')) { G.flag('btConnected', false); try { if (G.audio && G.audio.cue) G.audio.cue('bt.disconnect'); } catch (e) {} reroute('stop'); }
        if (!gone()) V('ledState', 'green');
      }
      bus.emit('bt:change', { state: M.bt.state() });
    },
    state() {
      if (!M.bt.on()) return 'off';
      if (gone()) return btBusy ? 'connecting' : 'gone';
      if (btBusy) return 'connecting';
      return flag('btConnected') ? 'connected' : 'idle';
    },
    connected() { return flag('btConnected') && !flag('musicCut'); },
    connect() {
      if (!M.bt.on()) return Promise.resolve('off');
      if (M.bt.connected()) return Promise.resolve('ok');
      if (btConn) return btConn;
      btBusy = true;
      bus.emit('bt:change', { state: 'connecting' });
      const isGone = gone();
      btConn = new Promise((res) => {
        setTimeout(() => {
          btConn = null; btBusy = false;
          if (!M.bt.on()) { bus.emit('bt:change', { state: M.bt.state() }); res('off'); return; }
          if (isGone || gone()) { bus.emit('bt:change', { state: M.bt.state() }); res('notfound'); return; }
          G.flag('btConnected', true);
          V('ledState', 'blue');
          try { if (G.audio && G.audio.cue) G.audio.cue('bt.connect'); } catch (e) {}
          reroute('connect');
          bus.emit('bt:change', { state: 'connected' });
          res('ok');
        }, isGone ? 4000 : 2500);
      });
      return btConn;
    },
    disconnect() {
      if (!flag('btConnected')) return;
      G.flag('btConnected', false);
      if (!gone()) V('ledState', 'green');
      try { if (G.audio && G.audio.cue) G.audio.cue('bt.disconnect'); } catch (e) {}
      reroute('stop');
      bus.emit('bt:change', { state: M.bt.state() });
    },
    retire() {
      const st = ES();
      if (st.btRetired) return;
      st.btRetired = true;
      V('ledState', 'off');
      if (flag('btConnected')) { G.flag('btConnected', false); reroute('stop'); }
      if (G.save) G.save();
      bus.emit('bt:change', { state: M.bt.state() });
    },
  };

  let inited = false;
  M.init = function () {
    if (inited) return; inited = true;
    const v = G.state.vars, D = (G.EP && G.EP.DEFAULTS) || {};
    if (v.btOn === undefined) v.btOn = true;
    if (!Number.isFinite(v.btVol)) v.btVol = D.btVol != null ? D.btVol : 15;
    if (!Number.isFinite(v.phoneVol)) v.phoneVol = D.phoneVol != null ? D.phoneVol : 60;
    if (!v.ledState) v.ledState = 'green';
    const fix = () => {
      if (flag('btPlaying') && !(cur && cur._playing)) G.flag('btPlaying', false);   // nothing plays after a reload
      const want = gone() ? 'off' : flag('btConnected') ? 'blue' : 'green';
      if (V('ledState') !== want) V('ledState', want);
    };
    fix();
    // ep3 route changes (inert on ep2: no G.EP.mediaRoute) — sr → lv after playArmed crossfades ear → table in 80 ms
    const onRoute = () => { if (!routeFn()) return; reroute('route'); };
    bus.on('room:where', onRoute); bus.on('var:where', onRoute); bus.on('flag:playArmed', onRoute);
    bus.on('state:load', () => { if (cur) cur.stop('stop'); fix(); });
    bus.on('state:reset', () => { if (cur) cur.stop('stop'); btConn = null; btBusy = false; });
  };
})();
