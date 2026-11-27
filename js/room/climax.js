/* =========================================================
 * P8 — 문 열기 / 클라이맥스 (design §3 P8 steps 1–11, beats B24–B30) and
 * H6 — 내 번호로 온 메시지 (call "{N}" -> your ringtone rings inside the wardrobe).
 * Never a game over: every waiting step has a max wait + equal fallback, every fail costs time only,
 * '조금 쉽게' after 2 fails. Progress: flags M7, M8 (END is set by the END scene).
 *
 * Hiding = press-and-hold anywhere (no orientation sensor — client override in ARCH.md).
 * G.climax = {running, step, start(step), resume(), codeAccepted(), spot(id, roomApi), onRoomOpen(api)}
 * Hooks provided: 'door:codeAccepted', 'talk:call'(threadId)
 * Hooks consumed: 'haesol:openBell' (Promise; own red-bell fallback if missing), 'end:start'
 * Vars: climaxStep ('handle'|'ajar'|'hide'|'call'|'quiet'|'guard'|'open'|'slam'|'bell'|'lights'|'nest'|'police'|'swipe'),
 *       climaxFails, climaxAssist, h6Calls, h6Declined; flags ringHeard
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep, clamp } = G.util;
  const C = (G.climax = { running: false, step: null });

  function sfx(name) { const A = G.audio; const f = A && A.sfx && A.sfx[name]; if (!f) return undefined; try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { return undefined; } }
  function T(s) { return G.T ? G.T(s) : s; }
  function IMG(k) { return G.ROOM ? G.ROOM.img(k) : 'assets/img/' + k + '.jpg'; }
  function V() { return G.state.vars; }
  function note(s) { try { G.notebook && G.notebook.note && G.notebook.note(T(s)); } catch (e) {} }
  function nbFlash(s) { if (G.notebook && G.notebook.flash) { try { G.notebook.flash(T(s)); return; } catch (e) {} } G.fx.sub(T(s), 3600, { cls: 'hand' }); }
  function dirSub(text, az, ms) { if (G.room && G.room.dirSub) G.room.dirSub(T(text), az, ms); else G.fx.sub(T(text), ms || 2600); }
  function vibrate(p) { if (G.settings && G.settings.vibration !== false && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
  function scaresOff() { return G.settings && G.settings.scares === 'off'; }
  function hasHook(n) { return !!(G.hooks && G.hooks.has && G.hooks.has(n)); }
  /** voice line with subtitle; speechSynthesis fallback only for PA / police / power-off (design §4.10) */
  async function say(id, text, o) {
    o = o || {};
    const A = G.audio;
    G.fx.sub(T(text), o.subMs || Math.max(2600, text.length * 140), { cls: o.cls });
    let buf = null;
    try { buf = A && A.voice ? await A.voice(id) : null; } catch (e) { buf = null; }
    if (buf && A.playBuffer) {
      const h = A.playBuffer(buf, { bus: 'voice', gain: o.gain || 1 });
      if (h && o.az != null && A.at) { try { h.analyser.disconnect(); const p = A.at(o.az, { dist: o.dist || 0.6, life: buf.duration + 3, reverb: 0.05, bus: 'voice' }); if (p) h.analyser.connect(p); else h.analyser.connect(A.bus('voice')); } catch (e) {} }
      await sleep(buf.duration * 1000 + 120);
    } else {
      if (o.tts && A && A.speak) A.speak(T(text), o.tts);
      await sleep(o.subMs || 2600);
    }
  }
  function tapeStop() {
    const A = G.audio; if (!A || !A.ctx || !A.ok || !A.ok()) return;
    try {
      A.silenceDrop && A.silenceDrop(260);
      const c = A.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.45);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.45);
      const g = c.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(f); f.connect(g); g.connect(A.bus('sfx')); o.start(t); o.stop(t + 0.55);
    } catch (e) {}
  }

  /* ---------------- run state ---------------- */
  let run = null;          // {tok, ov, root, black, wake, cleanup:[]}
  let tokSeq = 0;
  const ABORT = { abort: true };
  function alive(r) { if (!run || run !== r) throw ABORT; }
  function setStep(s) {
    C.step = s; V().climaxStep = s; G.save();
    G.bus.emit('climax:step', s);
  }
  function fails() { return V().climaxFails || 0; }
  function addFail(where) {
    V().climaxFails = fails() + 1; G.save();
    G.bus.emit('climax:fail', where);
    if (fails() >= 2 && !V().climaxAssist && run) run.showAssist();
  }
  function assist() { return !!V().climaxAssist; }

  function ensureOverlay(r) {
    if (r.ov && r.root.isConnected) return r.root;
    const root = el('div.cx');
    const stage = el('div.cx-stage');
    const cap = el('div.cx-cap');
    const mid = el('div.cx-mid');
    const assistBtn = el('button.cx-assist', null, '조금 쉽게');
    root.append(stage, mid, cap, assistBtn);
    assistBtn.addEventListener('click', () => {
      V().climaxAssist = true; G.save();
      assistBtn.classList.remove('show');
      sfx('tap');
      nbFlash('괜찮아, 천천히.');
      G.bus.emit('climax:assist');
    });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    r.ov = G.phone.overlay(root, { modal: 'hard' });
    r.root = root; r.stage = stage; r.cap = cap; r.mid = mid; r.assistBtn = assistBtn;
    if (fails() >= 2 && !assist()) assistBtn.classList.add('show');
    return root;
  }
  function closeOverlay(r) { if (r.ov) { r.ov.close(); r.ov = null; } }
  function caption(r, text, ms, cls) {
    ensureOverlay(r);
    const line = el('p' + (cls ? '.' + cls : ''), null, T(text));
    const box = cls === 'center' ? r.mid : r.cap;
    r.cap.innerHTML = ''; r.mid.innerHTML = ''; box.appendChild(line);
    requestAnimationFrame(() => line.classList.add('in'));
    if (ms) setTimeout(() => { line.classList.remove('in'); }, ms);
    return line;
  }
  function blackout(r, on) {
    if (!r.black) { r.black = el('div.cx-black'); r.black.addEventListener('contextmenu', (e) => e.preventDefault()); document.getElementById('screen').appendChild(r.black); }
    r.black.classList.toggle('on', !!on);
  }
  async function wakeLock(r, on) {
    try {
      if (on && !r.wake && navigator.wakeLock) r.wake = await navigator.wakeLock.request('screen');
      if (!on && r.wake) { r.wake.release(); r.wake = null; }
    } catch (e) {}
  }
  function powerSave(on) {
    const ph = document.getElementById('phone');
    if (ph) ph.classList.toggle('power-save', !!on);
  }

  /* =========================================================
   * entry points
   * ========================================================= */
  C.codeAccepted = function () {
    if (C.running) return;
    if (G.flag('M8')) { C.resume(); return; }
    const first = !G.flag('M7');
    G.flag('M7', true);
    if (first) {
      G.bus.emit('climax:begin');
      powerSave(true);
      if (G.audio && G.audio.isMono && G.audio.isMono()) { G.audio.setMono(false); G.phone.toast('모노 오디오가 꺼졌습니다'); }
      if (G.room && G.room.isOpen() && G.room.current().flash) G.room.current().setFlash(false, true);
      G.state.vars.flash = false; G.save();
      setTimeout(() => G.phone.toast('배터리 부족 · 플래시가 꺼졌습니다', 2600), 900);
    }
    C.start('handle');
  };
  C.resume = function () {
    if (C.running || G.flag('END')) return false;
    if (G.flag('M8')) { C.start('nest'); return true; }
    if (G.flag('M7')) { powerSave(true); C.start('handle'); return true; }
    return false;
  };
  C.onRoomOpen = function () {
    if (C.running || G.flag('END')) return;
    if (G.flag('M7') || G.flag('M8')) C.resume();
  };
  /** room hotspot interception while the climax runs */
  C.spot = function (id, api) {
    if (!C.running || !run) return false;
    if (run.spotHandler) return run.spotHandler(id, api) === true;
    return false;
  };

  /** true while the climax or the H6 call is running (director: treat as a safe zone) */
  C.safeZone = () => !!C.running || !!(G.h6 && G.h6.active);

  C.start = function (from) {
    if (run) teardown(run);
    const r = (run = { tok: ++tokSeq, cleanup: [] });
    r.showAssist = () => { ensureOverlay(r); r.assistBtn.classList.add('show'); };
    C.running = true;
    G.bus.emit('scripted', true);
    wakeLock(r, true);
    sequence(r, from || 'handle').catch((e) => {
      if (e !== ABORT) { console.error('[climax]', e); }
    });
  };
  function teardown(r) {
    (r.cleanup || []).forEach((f) => { try { f(); } catch (e) {} });
    r.cleanup = [];
    closeOverlay(r);
    if (r.black) { r.black.remove(); r.black = null; }
    wakeLock(r, false);
    if (run === r) run = null;
    C.running = !!run;
    if (!run) { G.bus.emit('scripted', false); G.room && (G.room.flashGrant = false); }
  }

  /* =========================================================
   * the sequence
   * ========================================================= */
  const ORDER = ['handle', 'ajar', 'hide', 'quiet', 'guard', 'open', 'slam', 'bell', 'lights', 'nest', 'police', 'swipe'];
  async function sequence(r, from) {
    let i = Math.max(0, ORDER.indexOf(from));
    if (from === 'call') i = ORDER.indexOf('hide');
    for (; i < ORDER.length; i++) {
      alive(r);
      await STEPS[ORDER[i]](r);
    }
  }

  const STEPS = {
    /* 1a. tap the handle (room view, door) */
    async handle(r) {
      setStep('handle');
      let api = G.room.isOpen() ? G.room.current() : G.room.open({ view: 'door' });
      if (api.view.id !== 'door') api.setView('door', { dir: -1 });
      api.zoomTo(1, 0.5, 0.5, true);
      const prompt = el('div.cx-prompt', null, el('span', null, '손잡이를 잡아 당긴다'));
      const bigBtn = el('button.cx-bigbtn', null, '문을 연다');
      api.root.append(prompt, bigBtn);
      requestAnimationFrame(() => prompt.classList.add('in'));
      const pulse = () => { const s = api.spotEl('handle'); if (s) s.classList.add('cx-pulse'); };
      pulse();
      const offView = G.bus.on('room:view', (id) => { if (id === 'door') setTimeout(pulse, 30); });
      // closing the camera here just pauses the climax; reopening the camera resumes it (onRoomOpen)
      const offClose = G.bus.on('room:close', () => { if (run === r && C.step === 'handle') setTimeout(() => teardown(r), 0); });
      r.cleanup.push(offView, offClose, () => { prompt.remove(); bigBtn.remove(); });
      await new Promise((res) => {
        const t = setTimeout(() => bigBtn.classList.add('show'), 15000);
        r.spotHandler = (id) => { if (id === 'handle' || id === 'doorlock' || id === 'guard') { clearTimeout(t); res(); return true; } return false; };
        bigBtn.addEventListener('click', () => { clearTimeout(t); res(); });
        r.cleanup.push(() => clearTimeout(t));
      });
      alive(r);
      r.spotHandler = null;
      offView(); offClose(); prompt.remove(); bigBtn.remove();
      sfx('tap');
    },

    /* 1b. the door opens 10 cm and stops: door guard. panel slides behind-left. */
    async ajar(r) {
      setStep('ajar');
      ensureOverlay(r);
      r.stage.innerHTML = '';
      const scene = el('div.cx-scene.ajar', null,
        el('div.cx-ajar-fb', null, el('div.slit'), el('div.ubar')),
        el('img', { src: IMG('door_ajar_guard'), alt: '', draggable: 'false', onload: function () { this.parentNode.classList.add('img'); }, onerror: function () { this.remove(); } }));
      r.stage.appendChild(scene);
      requestAnimationFrame(() => scene.classList.add('in'));
      if (G.room.isOpen()) setTimeout(() => G.room.isOpen() && G.room.current().close(), 400);
      sfx('doorlockMotor');
      await sleep(500); alive(r);
      sfx('doorguardClank', { az: 0 });
      G.fx.shake(260, 4);
      scene.classList.add('stop');
      caption(r, '도어가드가 걸려 있다. …내가 건 적 없는데.');
      await sleep(2000); alive(r);
      G.audio && G.audio.fridge && G.audio.fridge(false);
      sfx('panelSlide', { az: 270 });
      dirSub('(등 뒤 왼쪽에서… 판자가 밀리는 소리)', 270, 3000);
      G.audio && G.audio.gsm && G.audio.gsm(0.85);
      await sleep(2200); alive(r);
      nbFlash(HIDE_LINE);
      await sleep(1600); alive(r);
    },

    /* 2–4. hide face-down; 22 s binaural script; mom calls -> decline */
    async hide(r) {
      let from = 'creak';
      for (;;) {
        alive(r);
        setStep('hide');
        const res = await hideAndListen(r, from);
        alive(r);
        setStep('call');
        const c = await momCall(r);
        if (r.hideDetach) { r.hideDetach(); r.hideDetach = null; }
        alive(r);
        if (c === 'declined') return;
        // fail: rushing steps -> thud -> black -> again (no scare spent)
        addFail('call');
        sfx('footsteps', 3, { az: 300, dist: 1.6, toDist: 0.3, gap: 0.27, vol: 1.1 });
        await sleep(950); alive(r);
        sfx('thud', 0.7);
        blackout(r, true);
        await sleep(1000); alive(r);
        caption(r, '숨을 고르고, 다시.', 2400, 'center');
        await sleep(2400); alive(r);
        blackout(r, false);
        from = 'sit';
      }
    },

    /* 5. he goes back. "지금이야." flashlight 5 s */
    async quiet(r) {
      setStep('quiet');
      ensureOverlay(r);
      r.stage.innerHTML = '';
      r.stage.appendChild(el('div.cx-scene.dark'));
      await sleep(3000); alive(r);
      sfx('breathNear', 2.6, { az: 285, dist: 0.7 });
      await sleep(2600); alive(r);
      sfx('footsteps', 4, { az: 285, toAz: 268, dist: 0.9, toDist: 2.6, gap: 1.0, vol: 0.6 });
      dirSub('(발소리가… 옷장 쪽으로 멀어진다)', 270, 3200);
      await sleep(4300); alive(r);
      sfx('panelSlide', { az: 270 });
      await sleep(1500); alive(r);
      sfx('creakWardrobe', { az: 270, dur: 1.8 });
      await sleep(1600); alive(r);
      nbFlash('지금이야.');
      await sleep(900); alive(r);
    },

    /* 6. door guard: drag the U-bar right; scrape = speed; too fast -> he stops, "…?" */
    async guard(r) {
      setStep('guard');
      G.room.flashGrant = true;
      await doorGuard(r);
      alive(r);
      G.room.flashGrant = false;
    },

    /* 7. door swings open -> black hallway -> sensor light -> JS2 */
    async open(r) {
      setStep('open');
      ensureOverlay(r);
      const scene = r.stage.querySelector('.cx-scene');
      if (scene) scene.classList.add('swing');
      sfx('creak', 0.9, { pan: 0, vol: 0.6 });
      caption(r, '', 10);
      await sleep(700); alive(r);
      r.stage.innerHTML = ''; r.stage.appendChild(el('div.cx-scene.dark'));
      await sleep(700); alive(r);
      sfx('sensorLight');
      await sleep(120); alive(r);
      const jsSpent = (V().jsSpent = V().jsSpent || {});
      jsSpent.js2 = true; G.save();
      G.bus.emit('js2');
      const src = IMG('js2_hallway');
      if (scaresOff()) {
        // dread version: slow fade, no sting, no shake
        const im = el('div.cx-scene.js2dread', null, el('img', { src, alt: '', draggable: 'false', onerror: function () { this.remove(); } }));
        r.stage.appendChild(im);
        requestAnimationFrame(() => im.classList.add('in'));
        G.audio && G.audio.amb && G.audio.amb('hallway', true, 1);
        await sleep(3400); alive(r);
        im.classList.remove('in');
        await sleep(700);
      } else {
        G.audio && G.audio.amb && G.audio.amb('hallway', true, 0.1);
        vibrate([0, 80, 40, 300]);
        // shim: fx.jumpscare plays the generic stinger; route it to sting_js2 for this scare
        const S = G.audio && G.audio.sfx, generic = S && S.stinger;
        if (S && S.stingJS2) S.stinger = S.stingJS2;
        try { await G.fx.jumpscare(src, { sting: 'stingJS2', ms: 900, shakeMs: 400 }); } finally { if (S) S.stinger = generic; }
        G.audio && G.audio.hearingLoss && G.audio.hearingLoss(4);
      }
      alive(r);
    },

    /* 8. slam; outside keypad 4-7-2-9-0-6 fails; toasts */
    async slam(r) {
      setStep('slam');
      ensureOverlay(r);
      r.stage.innerHTML = ''; r.stage.appendChild(el('div.cx-scene.dark'));
      caption(r, '몸이 먼저 문을 닫았다.', 2600, 'center');
      sfx('doorSlam', { az: 0 });
      G.fx.shake(320, 7);
      G.audio && G.audio.amb && G.audio.amb('hallway', false, 0.4);
      await sleep(450); alive(r);
      sfx('doorlockAutolock');
      await sleep(2000); alive(r);
      dirSub('(문밖에서… 도어락 누르는 소리)', 0, 3000);
      for (const d of '472906') {
        G.audio && G.audio.doorKey && G.audio.doorKey(d, { outside: true });
        await sleep(330);
      }
      await sleep(350); alive(r);
      sfx('doorlockError');
      await sleep(700); alive(r);
      G.phone.toast('도어락 · 보안 모드: 외부 비밀번호 입력이 차단되었습니다', 2800);
      sfx('heartbeat', 120, 8);
      await sleep(3000); alive(r);
      G.phone.toast('해솔홈 · 차단된 기기(SM-G991N)의 요청이 거부되었습니다', 2800);
      await sleep(5000); alive(r);
      // 9a. he is coming back through the shaft
      sfx('scratchAt', 2.4, { az: 270 });
      dirSub('(옷장 안쪽 벽에서… 긁는 소리)', 270, 3000);
      await sleep(1800); alive(r);
      sfx('knock', 2, { az: 270, where: 'inside', gap: 0.5 });
      await sleep(1400); alive(r);
    },

    /* 9b. 해솔홈 opens by itself: 비상벨 red, hold 2 s */
    async bell(r) {
      setStep('bell');
      closeOverlay(r);
      if (G.room.isOpen()) G.room.current().close();
      let fb = null;
      const p = hasHook('haesol:openBell') ? G.hooks.call('haesol:openBell') : null;
      await new Promise((res) => {
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(t); if (fb) fb.close(); res(); };
        const t = setTimeout(() => { fb = ownBell(finish); }, p && typeof p.then === 'function' ? 40000 : 0);
        if (p && typeof p.then === 'function') p.then(finish, () => { clearTimeout(t); if (!fb) fb = ownBell(finish); });
        r.cleanup.push(() => { clearTimeout(t); if (fb) fb.close(); });
      });
      alive(r);
    },

    /* 10. siren, lights, PA, neighbors, (police siren) */
    async lights(r) {
      setStep('lights');
      G.flag('M8', true);
      G.clock && G.clock.freeze && G.clock.freeze(4, 44);
      powerSave(false);
      G.room.flashGrant = false;
      G.audio && G.audio.gsm && G.audio.gsm(0);
      sfx('sirenWallpad', 9);
      G.fx.flash('#fff', 1100);
      const api = G.room.isOpen() ? G.room.current() : G.room.open({ view: 'wardrobe' });
      api.setView('wardrobe');
      api.refresh();
      api.zoomTo(1, 0.5, 0.66, true); // frame the nest (orgel sits low in the frame)
      api._setLights(true);
      setTimeout(() => api._setLights(false), 2600);
      await sleep(900); alive(r);
      sfx('paChime');
      await sleep(2000); alive(r);
      say('v_pa', '404호에서 비상 호출이 접수되었습니다. 경비원이 올라갑니다.', { tts: { pitch: 1, rate: 1 }, subMs: 4200 });
      await sleep(3600); alive(r);
      sfx('neighbors');
      setTimeout(() => say('v_neighbor', '(옆집) 뭐야?!', { subMs: 2000 }), 700);
      if (G.flag('jiminTold')) setTimeout(() => sfx('sirenPolice', 14), 1800);
      G.audio && G.audio.fridge && G.audio.fridge(true);
      await sleep(1500); alive(r);
      if (G.room.isOpen()) G.room.current().caption('옷장 문이 활짝 열려 있다. 뒤판이 안쪽으로 밀려 있다.', 4200);
    },

    /* 11a. lit nest hotspots (optional) */
    async nest(r) {
      setStep('nest');
      if (!G.flag('M8')) G.flag('M8', true);
      powerSave(false);
      const api = G.room.isOpen() ? G.room.current() : G.room.open({ view: 'wardrobe' });
      if (api.view.id !== 'wardrobe') { api.setView('wardrobe', { dir: 1 }); api.zoomTo(1, 0.5, 0.66, true); }
      r.spotHandler = (id, a) => { if (id === 'doorlock') { a.caption('…이제 비밀번호는 필요 없다.'); return true; } return false; };
      const seen = new Set();
      await new Promise((res) => {
        const t0 = Date.now();
        const tMax = setTimeout(res, 20000);
        const off = G.bus.on('room:spot', (id) => {
          seen.add(id);
          if (seen.has('orgel') && seen.has('polaroids')) {
            off(); clearTimeout(tMax);
            setTimeout(res, Math.max(4200, 8000 - (Date.now() - t0)));
          }
        });
        r.cleanup.push(off, () => clearTimeout(tMax));
      });
      alive(r);
    },

    /* 11b. police at the door */
    async police(r) {
      setStep('police');
      r.spotHandler = (id, api) => { if (id === 'doorlock' || id === 'handle') { api.caption('문밖에 경찰이 와 있다.'); return true; } return false; };
      sfx('policeKnock');
      dirSub('(현관에서 쾅, 쾅, 쾅)', 0, 2200);
      await sleep(1700); alive(r);
      await say('v_police', '경찰입니다. 문 열어주세요.', { tts: { pitch: 0.8, rate: 0.95 }, subMs: 3000 });
      alive(r);
    },

    /* 11c. swipe the handle -> white -> 방탈출 성공 -> END */
    async swipe(r) {
      setStep('swipe');
      const api = G.room.isOpen() ? G.room.current() : G.room.open({ view: 'door' });
      if (api.view.id !== 'door') api.setView('door', { dir: -1 });
      api.zoomTo(1, 0.5, 0.5, true);
      await swipeHandle(r, api.root);
      alive(r);
      sfx('doorlockOpen');
      const white = el('div.cx-white', null, el('div.cx-win', null, '방탈출 성공'));
      document.getElementById('screen').appendChild(white);
      requestAnimationFrame(() => white.classList.add('in'));
      await sleep(1100);
      white.classList.add('text');
      await sleep(2600);
      if (G.room.isOpen()) G.room.current().close();
      setStep('end');
      teardown(r);
      G.bus.emit('climax:end');
      if (hasHook('end:start')) G.hooks.call('end:start');
      else { G.flag('END', true); }
      setTimeout(() => { white.classList.add('out'); setTimeout(() => white.remove(), 1200); }, 2200);
    },
  };

  /* ---------------- hide + binaural script ---------------- */
  // 세아's line (memo p.1), adapted to the hold-to-hide mechanic (no face-down sensor)
  const HIDE_LINE = '그 사람이 옷장에서 나오면 화면 빛을 가려. 빛 보고 와. 숨도 참아.';
  const SCRIPT = [
    { id: 'creak', at: 0, run() { sfx('creakWardrobe', { az: 270, dur: 2.6 }); dirSub('(옷장 문이… 열린다)', 270, 2600); } },
    { id: 'walk', at: 2.8, run() { sfx('footsteps', 4, { az: 270, toAz: 90, dist: 2.2, gap: 1.1, vol: 0.6 }); dirSub('(양말 신은 발소리. 침대 쪽으로.)', 180, 3600); } },
    { id: 'sit', at: 7.4, run() { sfx('bedCreak', { az: 90 }); setTimeout(() => sfx('bedCreak', { az: 90 }), 650); dirSub('(침대가 삐걱인다. …앉았다.)', 90, 2800); } },
    { id: 'approach', at: 10.6, run() { sfx('footsteps', 3, { az: 90, toAz: 285, dist: 2.0, toDist: 0.6, gap: 1.1, vol: 0.65 }); dirSub('(발소리가… 다가온다.)', 300, 3000); } },
    { id: 'breath', at: 14.2, run() { sfx('breathNear', 6, { az: 285, dist: 0.35 }); dirSub('(숨소리. 바로 옆에서.)', 285, 4200); } },
    { id: 'whisper', at: 20.2, run() { say('v_him_ear', '{N야}… 자?', { az: 285, dist: 0.3, subMs: 2400, cls: 'whisper' }); } },
    { id: 'end', at: 22.8 },
  ];
  async function hideAndListen(r, from) {
    ensureOverlay(r);
    r.stage.innerHTML = '';
    r.cap.innerHTML = ''; r.mid.innerHTML = '';
    const big = fails() >= 1 || assist();
    const holdBtn = el('button.cx-hold', { 'aria-label': '꾹 눌러 숨기' }, el('i'), el('i'), el('span.cx-hold-ic', { html: '<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 013 0V10m0-1.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v4.5c0 3.6-2.4 6-6 6h-1c-2.4 0-3.7-1.2-5-3.2L4.6 14a1.5 1.5 0 012.5-1.6L9 14.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
    const hideBox = el('div.cx-hide' + (big ? '.big' : ''), null,
      el('div.cx-hide-t', null, from === 'creak' ? '화면을 꾹 눌러 빛을 가리세요' : '다시 꾹 눌러 빛을 가리세요'),
      el('div.cx-hide-s', null, '아무 곳이나 누르고 있으면 화면이 꺼져요 · 손을 떼면 빛이 새어 나가요' + (G.APP ? '' : ' (PC: 마우스 또는 Space)')),
      holdBtn);
    r.stage.appendChild(el('div.cx-scene.dark'));
    r.stage.appendChild(hideBox);
    requestAnimationFrame(() => hideBox.classList.add('in'));
    const bigT = setTimeout(() => hideBox.classList.add('big'), 20000);

    let hidden = false, via = null, holdT = 0;
    const listeners = new Set();
    function setHidden(h, how) {
      if (h === hidden) return;
      hidden = h; via = h ? how : null;
      blackout(r, h);
      if (h) { G.audio && G.audio.setYaw && G.audio.setYaw(0); V().faceDownCount = (V().faceDownCount || 0) + 1; G.bus.emit('facedown', true); }
      else G.bus.emit('facedown', false);
      listeners.forEach((f) => f(h));
    }
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.cx-assist, .nb-fab, .notebook, .cx-callui')) return;
      if (r.callActive) return;
      clearTimeout(holdT);
      holdT = setTimeout(() => setHidden(true, 'hold'), 180);
    };
    const onUp = () => { clearTimeout(holdT); if (hidden && via === 'hold') setHidden(false); };
    const onKD = (e) => { if (e.code === 'Space' && !e.repeat && !r.callActive) { e.preventDefault(); setHidden(true, 'key'); } };
    const onKU = (e) => { if (e.code === 'Space') { e.preventDefault(); if (hidden && via === 'key') setHidden(false); } };
    r.root.addEventListener('pointerdown', onDown);
    blackout(r, false); r.black.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU);
    const detach = () => {
      clearTimeout(bigT); clearTimeout(holdT);
      r.root && r.root.removeEventListener('pointerdown', onDown);
      r.black && r.black.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU);
    };
    r.cleanup.push(detach);
    r.hideDetach = detach;
    r.hideCtl = { get hidden() { return hidden; }, on: (f) => { listeners.add(f); return () => listeners.delete(f); }, setHidden };

    // wait to hide
    if (!hidden) await new Promise((res) => { const off = r.hideCtl.on((h) => { if (h) { off(); res(); } }); r.cleanup.push(off); });
    alive(r);
    hideBox.classList.remove('in');

    // run the script from `from`; lifting early -> penalty (or pause in assist mode)
    let segIdx = Math.max(0, SCRIPT.findIndex((s) => s.id === from));
    for (;;) {
      const result = await new Promise((res) => {
        const timers = [];
        const base = SCRIPT[segIdx].at;
        let curIdx = segIdx;
        SCRIPT.slice(segIdx).forEach((s, k) => {
          timers.push(setTimeout(() => {
            curIdx = segIdx + k;
            if (s.id === 'end') { off(); res({ done: true }); return; }
            try { s.run(); } catch (e) {}
          }, (s.at - base) * 1000));
        });
        const off = r.hideCtl.on((h) => { if (!h) { timers.forEach(clearTimeout); off(); res({ lifted: true, at: curIdx }); } });
        r.cleanup.push(() => { timers.forEach(clearTimeout); off(); });
      });
      alive(r);
      if (result.done) return 'done';
      // lifted early
      tapeStop();
      if (assist()) {
        caption(r, '…괜찮아. 다시 눌러.', 2200, 'center');
        segIdx = Math.max(SCRIPT.findIndex((s) => s.id === 'sit'), result.at);
      } else {
        addFail('lift');
        caption(r, '…빛이 샜다.', 2400, 'center');
        await sleep(350);
        sfx('footsteps', 2, { az: 300, dist: 1.4, toDist: 0.8, gap: 0.32, vol: 0.95 });
        segIdx = SCRIPT.findIndex((s) => s.id === 'approach');
      }
      hideBox.querySelector('.cx-hide-t').textContent = '다시 꾹 눌러 빛을 가리세요';
      // let the penalty line read first (the hold still works meanwhile)
      const tShow = setTimeout(() => { if (!r.hideCtl.hidden) hideBox.classList.add('in'); }, 2300);
      r.cleanup.push(() => clearTimeout(tShow));
      await new Promise((res) => { const off = r.hideCtl.on((h) => { if (h) { off(); res(); } }); r.cleanup.push(off); });
      alive(r);
      hideBox.classList.remove('in');
    }
  }

  /* ---------------- mom calls (must decline) ---------------- */
  async function momCall(r) {
    ensureOverlay(r);
    r.cap.innerHTML = ''; r.mid.innerHTML = '';
    const vars = V();
    const callFails = vars.climaxCallFails || 0;
    const windowMs = assist() ? 25000 : callFails >= 1 ? 12000 : 6000;
    const wide = assist() || callFails >= 2;
    const avatarSrc = (function () {
      try {
        const th = G.chat && G.chat.thread && G.chat.thread('talk', 'mom');
        let a = th && th.avatar;
        if (a && typeof a === 'object') a = a.img;
        if (a && !/[/.]/.test(a)) a = G.IMG && G.IMG[a];
        return a || (G.IMG && G.IMG.avatar_mom) || null;
      } catch (e) { return null; }
    })();
    const ui = el('div.cx-callui' + (wide ? '.wide' : ''), null,
      el('div.cu-blur'),
      el('div.cc-top', null,
        el('div.cc-av', avatarSrc ? { style: { backgroundImage: `url("${avatarSrc}")` } } : null, avatarSrc ? null : '엄'),
        el('div.cc-name', null, '엄마', G.flag('momRead') ? el('small', null, ' (367)') : null),
        el('div.cc-sub', null, '보이스톡')),
      el('div.cc-btns', null,
        el('div.cc-b', null, el('button.cc-dec', { 'aria-label': '거절', html: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>' }), el('span', null, '거절')),
        el('div.cc-b.acc', null, el('button.cc-acc', { 'aria-label': '수락', html: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>' }), el('span', null, '수락'))));
    r.stage.innerHTML = '';
    r.stage.appendChild(ui);
    requestAnimationFrame(() => ui.classList.add('in', 'jitter'));
    r.callActive = true;
    G.bus.emit('call:start', 'mom-climax');
    const ring = sfx('ringMom', { vol: 1 }) || { stop() {} };
    vibrate([800, 400, 800, 400, 800, 400, 800]);
    dirSub('(휴대폰이 울린다! …엄마?)', null, 2600);
    if (r.hideCtl && r.hideCtl.hidden) setTimeout(() => { if (r.callActive) G.fx.sub('(손을 떼고… 끊어야 해)', 2200, { cls: 'whisper' }); }, 1200);
    const res = await new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; clearTimeout(t); resolve(v); };
      const t = setTimeout(() => fin('timeout'), windowMs);
      ui.querySelector('.cc-dec').addEventListener('click', () => fin('declined'));
      ui.querySelector('.cc-acc').addEventListener('click', () => fin('accepted'));
      r.cleanup.push(() => { clearTimeout(t); fin('abort'); });
    });
    try { ring.stop(); } catch (e) {}
    vibrate(0);
    r.callActive = false;
    G.bus.emit('call:end', 'mom-climax');
    ui.classList.remove('jitter');
    if (r.hideCtl && r.hideCtl.hidden) r.hideCtl.setHidden(false);
    if (res === 'declined') {
      sfx('callEnd');
      ui.querySelector('.cc-sub').textContent = '통화 거절됨';
      ui.classList.add('ended');
      await sleep(900);
      ui.remove();
      return 'declined';
    }
    vars.climaxCallFails = callFails + 1; G.save();
    ui.querySelector('.cc-sub').textContent = res === 'accepted' ? '연결됨' : '부재중';
    if (res === 'accepted') { sfx('callEnd'); }
    await sleep(500);
    ui.remove();
    return res;
  }

  /* ---------------- door guard drag ---------------- */
  function doorGuard(r) {
    ensureOverlay(r);
    r.stage.innerHTML = '';
    const scene = el('div.cx-scene.ajar.guard.in.stop.lit', null,
      el('div.cx-ajar-fb', null, el('div.slit'), el('div.ubar')),
      el('img', { src: IMG('door_ajar_guard'), alt: '', draggable: 'false', onload: function () { this.parentNode.classList.add('img'); }, onerror: function () { this.remove(); } }));
    const knob = el('div.cg-knob', { html: '<svg viewBox="0 0 120 60"><path d="M14 30h70a18 18 0 0118 18v0M14 30h70a18 18 0 0018-18v0" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><circle cx="14" cy="30" r="10" fill="currentColor"/></svg>' });
    const fill = el('div.cg-fill');
    const track = el('div.cg-track', null, fill, el('div.cg-end'), knob);
    const hint = el('div.cg-hint', null, '오른쪽으로 천천히 밀어');
    const holdBtn = el('button.cg-holdbtn', null, '길게 눌러 천천히 밀기');
    const ui = el('div.cx-guard', null, el('div.cg-label', null, '도어가드'), track, hint, holdBtn);
    r.stage.append(scene, ui);
    caption(r, '5초만.', 2200, 'center');
    const dim = setTimeout(() => scene.classList.remove('lit'), 5000);
    setTimeout(() => hint.classList.add('show'), 3500);
    if (assist()) holdBtn.classList.add('show');
    const offA = G.bus.on('climax:assist', () => holdBtn.classList.add('show'));

    // his footsteps in the shaft drift from the wardrobe toward the front door (EPS)
    let stepAz = 255, paused = 0;
    const walker = setInterval(() => {
      if (paused > Date.now()) return;
      stepAz = Math.min(350, stepAz + 9);
      sfx('footsteps', 1, { az: stepAz, dist: 3.2, vol: 0.32 });
    }, 1150);

    return new Promise((resolve) => {
      let L = 1, x = 0, dragging = false, lastX = 0, lastT = 0, v = 0, fastN = 0, frozenUntil = 0, done = false, lastScrape = 0, idleT = 0;
      const measure = () => { L = Math.max(1, track.clientWidth - knob.offsetWidth); };
      measure();
      const v0 = () => L / 1300; // px per ms for a 1.3 s travel
      const setX = (nx) => {
        x = clamp(nx, 0, L);
        knob.style.transform = `translateX(${x}px)`;
        fill.style.width = (x + knob.offsetWidth / 2) + 'px';
        const p = x / L;
        scene.style.setProperty('--gp', String(p));
        G.audio && G.audio.gsm && G.audio.gsm(Math.max(0.15, 0.85 - 0.6 * p));
        if (p >= 0.985 && !done) finish();
      };
      const move = (nx) => {
        const now = performance.now();
        if (now < frozenUntil) return;
        const dt = Math.max(1, now - lastT);
        const dx = nx - x;
        if (dx <= 0) { lastT = now; return; }
        const inst = dx / dt;
        v = v * 0.6 + inst * 0.4;
        if (!assist() && v > 2.6 * v0() && x / L > 0.06) {
          fastN++;
          if (fastN >= 2) { tooFast(); return; }
        } else fastN = Math.max(0, fastN - 1);
        setX(nx);
        if (now - lastScrape > 80) { lastScrape = now; sfx('scrape', clamp((v / v0()) * 0.45, 0.06, 1), { az: 0 }); }
        lastT = now;
        clearTimeout(idleT); idleT = setTimeout(() => { if (!done) r.showAssist(); }, 25000);
      };
      function tooFast() {
        fastN = 0; v = 0;
        frozenUntil = performance.now() + 2000;
        paused = Date.now() + 2600;
        dragging = false;
        sfx('scrape', 1, { az: 0 });
        knob.classList.remove('freeze'); void knob.offsetWidth; knob.classList.add('freeze');
        G.fx.sub('…?', 2000, { cls: 'whisper' });
        caption(r, '…멈춰. 들었을지도 몰라.', 2000, 'center');
        V().guardFast = (V().guardFast || 0) + 1;
        if (V().guardFast >= 2) addFail('guard');
      }
      knob.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (performance.now() < frozenUntil) return;
        try { knob.setPointerCapture(e.pointerId); } catch (er) {}
        dragging = true; measure(); lastX = e.clientX; lastT = performance.now(); v = 0;
        knob.classList.add('grab');
      });
      knob.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const nx = x + (e.clientX - lastX); lastX = e.clientX;
        move(nx);
      });
      const up = () => { dragging = false; knob.classList.remove('grab'); };
      knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
      // assist / keyboard: move at the ideal speed while held
      let autoRaf = 0, autoOn = false;
      const autoLoop = (t) => {
        if (!autoOn || done) return;
        const now = performance.now();
        if (now >= frozenUntil) { setX(x + v0() * 16 * 0.9); if (now - lastScrape > 90) { lastScrape = now; sfx('scrape', 0.35, { az: 0 }); } }
        autoRaf = requestAnimationFrame(autoLoop);
      };
      const autoStart = () => { if (autoOn) return; measure(); autoOn = true; autoRaf = requestAnimationFrame(autoLoop); };
      const autoStop = () => { autoOn = false; cancelAnimationFrame(autoRaf); };
      holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); autoStart(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => holdBtn.addEventListener(ev, autoStop));
      const kd = (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); autoStart(); } };
      const ku = (e) => { if (e.key === 'ArrowRight') autoStop(); };
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
      const cleanup = () => { clearInterval(walker); clearTimeout(dim); clearTimeout(idleT); autoStop(); offA(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
      r.cleanup.push(cleanup);
      function finish() {
        done = true; cleanup();
        sfx('doorguardClank', { az: 0 });
        knob.classList.add('done');
        hint.classList.remove('show');
        setTimeout(() => { ui.classList.add('out'); resolve(); }, 650);
      }
    });
  }

  /* ---------------- swipe the handle ---------------- */
  function swipeHandle(r, host) {
    return new Promise((resolve) => {
      const knob = el('div.cs-knob', { html: '<svg viewBox="0 0 24 24"><path d="M4 12h12M12 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
      const label = el('span.cs-label', null, '밀어서 문 열기');
      const track = el('div.cs-track', null, label, knob);
      const box = el('div.cx-swipe', null, el('div.cs-t', null, '손잡이를 잡고 민다'), track);
      host.appendChild(box);
      requestAnimationFrame(() => box.classList.add('in'));
      let L = 1, x = 0, drag = false, sx = 0, done = false;
      const measure = () => { L = Math.max(1, track.clientWidth - knob.offsetWidth - 8); };
      const setX = (nx, anim) => { x = clamp(nx, 0, L); knob.style.transition = anim ? 'transform .3s cubic-bezier(.2,.9,.3,1)' : 'none'; knob.style.transform = `translateX(${x}px)`; label.style.opacity = String(1 - x / L); };
      knob.addEventListener('pointerdown', (e) => { e.preventDefault(); measure(); drag = true; sx = e.clientX - x; try { knob.setPointerCapture(e.pointerId); } catch (er) {} });
      knob.addEventListener('pointermove', (e) => { if (drag) setX(e.clientX - sx); });
      const up = () => { if (!drag) return; drag = false; if (x >= L * 0.85) complete(); else setX(0, true); };
      knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
      track.addEventListener('click', (e) => { if (e.target === track || e.target === label) { knob.classList.remove('nudge'); void knob.offsetWidth; knob.classList.add('nudge'); } });
      const kd = (e) => { if (e.key === 'Enter' || e.key === 'ArrowRight') complete(); };
      window.addEventListener('keydown', kd);
      r.cleanup.push(() => { window.removeEventListener('keydown', kd); box.remove(); });
      function complete() {
        if (done) return; done = true;
        measure(); setX(L, true);
        window.removeEventListener('keydown', kd);
        sfx('tap');
        setTimeout(() => { box.remove(); resolve(); }, 350);
      }
    });
  }

  /* ---------------- fallback 비상벨 (if the 해솔홈 hook is missing) ---------------- */
  function ownBell(onDone) {
    const ring = el('div.cb-ring', { html: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="bg"/><circle cx="50" cy="50" r="46" class="fg"/></svg>' });
    const btn = el('button.cb-btn', { 'aria-label': '비상벨' }, ring, el('span.cb-ic', { html: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 016 6v4l2 3H4l2-3V9a6 6 0 016-6zM9.5 19a2.5 2.5 0 005 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' }), el('b', null, '비상벨'));
    const node = el('div.cx-bell', null,
      el('div.cb-head', null, el('b', null, '해솔홈'), el('span', null, '404호 · 비상 호출')),
      btn,
      el('div.cb-t', null, '비상벨 · 2초간 길게 눌러 호출'),
      el('div.cb-s', null, '경비실과 관리사무소로 즉시 연결됩니다'));
    const ov = G.phone.overlay(node, { modal: 'hard' });
    const fg = ring.querySelector('.fg'); const Cc = 2 * Math.PI * 46; fg.style.strokeDasharray = Cc; fg.style.strokeDashoffset = Cc;
    let t0 = 0, raf = 0, fin = false;
    const loop = () => {
      const k = Math.min(1, (performance.now() - t0) / 2000);
      fg.style.strokeDashoffset = String(Cc * (1 - k));
      if (k >= 1) { fin = true; sfx('success'); node.classList.add('done'); setTimeout(onDone, 300); return; }
      raf = requestAnimationFrame(loop);
    };
    btn.addEventListener('pointerdown', (e) => { if (fin) return; e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (er) {} t0 = performance.now(); btn.classList.add('hold'); raf = requestAnimationFrame(loop); vibrate(40); });
    const stop = () => { if (fin) return; cancelAnimationFrame(raf); btn.classList.remove('hold'); fg.style.strokeDashoffset = Cc; };
    btn.addEventListener('pointerup', stop); btn.addEventListener('pointercancel', stop);
    G.bus.emit('bell:shown');
    return { close() { cancelAnimationFrame(raf); ov.close(); } };
  }

  G.hooks && G.hooks.set('door:codeAccepted', () => C.codeAccepted());

  /* =========================================================
   * H6 — call "{N}" (the player's own account)
   * ========================================================= */
  const H6 = (G.h6 = { active: false });
  function isHaruThread(id) {
    if (id === 'haru' || id === 'me' || id === 'player') return true;
    try { const th = G.chat && G.chat.thread && G.chat.thread('talk', id); return !!th && (th.name === '{N}' || th.name === '{N} (내 폰)' || T(th.name) === (G.NAME || '하루')); } catch (e) { return false; }
  }
  H6.call = function (threadId) {
    if (!isHaruThread(threadId)) return false;
    if (H6.active) { H6.restore && H6.restore(); return true; }
    if (C.running) { G.phone.toast('지금은 전화를 걸 수 없습니다'); return true; }
    const vars = V();
    vars.h6Calls = (vars.h6Calls || 0) + 1; G.save();
    if (vars.h6Declined) powerOffCall(threadId); else firstCall(threadId);
    return true;
  };
  G.hooks && G.hooks.set('talk:call', (threadId) => H6.call(threadId));

  function callUI(threadId, statusText) {
    const name = T('{N} (내 폰)');
    const timeEl = el('div.vt-status', null, statusText);
    const camBtn = el('button.vt-op', null, el('span', { html: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' }), el('small', null, '카메라'));
    const spkBtn = el('button.vt-op', null, el('span', { html: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' }), el('small', null, '스피커'));
    const micBtn = el('button.vt-op', null, el('span', { html: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' }), el('small', null, '마이크 끄기'));
    const endBtn = el('button.vt-end', { 'aria-label': '통화 종료', html: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>' });
    const minBtn = el('button.vt-min', { 'aria-label': '최소화', html: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    const node = el('div.vt', null,
      el('div.vt-bg'),
      el('div.vt-top', null, minBtn, el('span.vt-kind', null, '보이스톡')),
      el('div.vt-mid', null, el('div.vt-av', { html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>' }), el('div.vt-name', null, name), timeEl),
      el('div.vt-ops', null, micBtn, spkBtn, camBtn),
      el('div.vt-endrow', null, endBtn));
    let ov = G.phone.overlay(node, { modal: 'soft', onBack: () => minimize() });
    // dark call screen: white status-bar text while it is up (talk's own call screen does the same)
    const stLight = () => { try { G.phone.statusTheme('light'); } catch (e) {} };
    const stRestore = () => { try { const t = G.phone.top && G.phone.top(); G.phone.statusTheme(t && t.node ? t.node.dataset.status || 'light' : 'light'); } catch (e) {} };
    stLight();
    const bar = el('button.vt-bar', null, el('i'), el('span.vb-t', null, '보이스톡'), el('span.vb-s', null, statusText));
    document.getElementById('screen').appendChild(bar);
    let minimized = false;
    function minimize() {
      if (minimized || !ov) return;
      minimized = true; ov.close(); ov = null;
      bar.classList.add('show');
      stRestore();
    }
    function restore() {
      if (!minimized) return;
      minimized = false; bar.classList.remove('show');
      node.classList.remove('out');
      ov = G.phone.overlay(node, { modal: 'soft', onBack: () => minimize() });
      stLight();
    }
    bar.addEventListener('click', () => { sfx('tap'); restore(); });
    minBtn.addEventListener('click', () => { sfx('tap'); minimize(); });
    micBtn.addEventListener('click', () => { micBtn.classList.toggle('on'); sfx('tap'); });
    spkBtn.addEventListener('click', () => { spkBtn.classList.toggle('on'); sfx('tap'); });
    camBtn.addEventListener('click', () => {
      sfx('tap'); minimize();
      G.phone.home && G.phone.home();
      setTimeout(() => { if (G.camera && G.camera.rear) G.camera.rear(); else G.room.open(); }, 120);
    });
    const api = {
      node, minimize, restore,
      status(t) { timeEl.textContent = t; bar.querySelector('.vb-s').textContent = t; },
      onEnd: null,
      close(delay) {
        setTimeout(() => {
          bar.classList.remove('show'); setTimeout(() => bar.remove(), 400);
          if (ov) { ov.close(); ov = null; stRestore(); }
          H6.active = false; H6.restore = null;
        }, delay || 0);
      },
    };
    endBtn.addEventListener('click', () => { sfx('callEnd'); api.onEnd && api.onEnd(); });
    H6.active = true; H6.restore = restore;
    return api;
  }

  function firstCall(threadId) {
    const ui = callUI(threadId, '연결 중…');
    G.bus.emit('call:start', 'h6');
    const A = G.audio;
    const phone = sfx('ringHaru', { az: 270 }) || { stop() {} };
    const buzz = sfx('buzzWood', { az: 270 }) || { stop() {} };
    let rings = 0, ended = false, timers = [];
    const glow = (v) => { G.room && G.room.setRingGlow && G.room.setRingGlow(v); };
    function stopAll() {
      timers.forEach(clearTimeout); timers = [];
      try { phone.stop(); } catch (e) {} try { buzz.stop(); } catch (e) {}
      if (rb) try { rb.stop(); } catch (e) {}
      glow(0);
      G.bus.emit('call:end', 'h6');
    }
    let rb = null;
    function ring() {
      if (ended) return;
      rings++;
      rb = A && A.ringback ? A.ringback(1) : null;
      glow(1);
      timers.push(setTimeout(() => glow(0.25), 1000));
      if (rings === 2) {
        if (speakerish()) dirSub('[옷장 쪽에서 진동 소리]', 270, 3000);
        else G.fx.sub('(…어디선가 벨소리가 들린다)', 2600);
      }
      if (rings === 3 && !speakerish()) dirSub('(…내 벨소리?)', 270, 2400);
      if (rings >= 5) { timers.push(setTimeout(declined, 520)); return; }
      timers.push(setTimeout(ring, 3000));
    }
    function declined() {
      if (ended) return; ended = true;
      stopAll();
      sfx('callEnd');
      ui.status('통화 거절됨');
      G.flag('ringHeard', true);
      V().h6Declined = true; G.save();
      note('내 폰이… 옷장 안에서 울렸다.');
      ui.close(1300);
      setTimeout(() => {
        if (G.chat && G.chat.push) G.chat.push('talk', threadId || 'haru', { from: 'them', text: '…전화하지 마.' }, { tone: 'him' });
        setTimeout(() => { sfx('knock', 1, { az: 270, where: 'inside', vol: 0.6 }); dirSub('(옷장 안에서… 똑.)', 270, 2200); }, 900);
      }, 3000);
    }
    ui.onEnd = () => {
      if (ended) return; ended = true;
      stopAll();
      ui.status('통화 종료');
      if (rings >= 2) { G.flag('ringHeard', true); note('내 폰이… 옷장 안에서 울렸다?'); }
      ui.close(700);
    };
    timers.push(setTimeout(ring, 700));
  }
  function speakerish() { return (G.settings && (G.settings.audioMode === 'speaker' || G.settings.sound === false)) || V().audioMode === 'speaker'; }

  async function powerOffCall(threadId) {
    const ui = callUI(threadId, '연결 중…');
    let ended = false;
    ui.onEnd = () => { ended = true; G.audio && G.audio.stopSpeak && G.audio.stopSpeak(); ui.status('통화 종료'); ui.close(500); };
    await sleep(1400);
    if (ended) return;
    ui.status('연결 실패');
    await say('v_poweroff', '전화기가 꺼져 있어 삐 소리 후 음성사서함으로 연결됩니다.', { tts: { pitch: 1, rate: 1.05 }, subMs: 3600 });
    if (ended) return;
    const A = G.audio;
    if (A && A.osc && A.ok && A.ok()) { try { A.osc('sine', 1000, A.ctx.currentTime, 0.5, 0.08, A.bus('voice')); } catch (e) {} }
    await sleep(700);
    if (ended) return;
    ended = true;
    sfx('callEnd');
    ui.status('통화 종료');
    ui.close(900);
  }

  /* ---------------- debug ---------------- */
  if (!G.APP_BUILD) C.debug = {   // QA only: not in the app build (CONFIG.APP === true)
    jump(step) { C.start(step); },
    hide(on) { if (run && run.hideCtl) run.hideCtl.setHidden(!!on, 'key'); },
    state() { return { running: C.running, step: C.step, fails: fails(), assist: assist() }; },
  };
})();
