/* =========================================================
 * Horror director (design §6): progress-keyed beats, safe zones, his watcher
 * lines, look-away log, tension curve, idle nudges, mirroring cut.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { sleep } = G.util;
  const D = (G.director = {});
  const BD = () => G.BEATDATA;
  let started = false;
  const holds = new Set();
  let lastBeatAt = 0, lastFlagAt = Date.now(), reliefUntil = 0, kbOpen = false;

  function fired(id) { return !!(G.state.vars.fired || {})[id]; }
  function fire(id) { G.state.vars.fired = Object.assign({}, G.state.vars.fired, { [id]: Date.now() }); G.save(); }
  function since(flag) { const t = G.state.flags[flag]; return t ? (Date.now() - t) / 1000 : -1; }
  D.hold = function (name, on) { if (on) holds.add(name); else holds.delete(name); };
  D.safe = function () {
    if (holds.size || kbOpen) return false;
    if (G.climax && G.climax.safeZone && G.climax.safeZone()) return false;
    if (G.flag('M7') && !G.flag('END')) return false;
    if (Date.now() < reliefUntil) return false;
    if (document.querySelector('.notebook.in, .call-screen, .dialog-wrap, .mfa, .cinema')) return false;
    if (G.state.vars.js1At && Date.now() - G.state.vars.js1At < 45000) return false;
    return true;
  };
  G.bus.on('keyboard', (on) => { kbOpen = on; });
  G.bus.on('flag', () => { lastFlagAt = Date.now(); });
  // leads opened here/elsewhere with in-memory done predicates are lost on reload: close them from the flag too
  G.bus.on('flag:ringHeard', () => { G.notebook && G.notebook.leadDone && G.notebook.leadDone('callme'); });
  G.bus.on('flag:frag47', () => { G.notebook && G.notebook.leadDone && G.notebook.leadDone('doorAB'); });

  /* ---------- his voice ---------- */
  D.his = async function (lines, o) {
    o = o || {};
    if (!Array.isArray(lines)) lines = [lines];
    G.flag('haruThread', true);
    for (const raw of lines) {
      const text = G.T(raw);
      await G.chat.push('talk', 'haru', { from: 'them', text, creepy: true }, { tone: 'him', typingMs: o.typing != null ? o.typing : 1200, notify: true });
      await sleep(o.gap != null ? o.gap : 1800);
    }
  };
  D.manager = async function (lines, gap) {
    for (const t of lines) { await G.chat.push('talk', 'manager', { from: 'them', text: G.T(t) }, { tone: 'friend', typingMs: 900 }); await sleep(gap || 1500); }
  };

  /* ---------- tension ---------- */
  const TT = [['M7', 1], ['M6', 0.85], ['M5', 0.75], ['M4', 0.65], ['F3', 0.6], ['F2', 0.5], ['F1', 0.4], ['M2', 0.3], ['M1', 0.15]];
  D.T = function () { if (G.flag('M8')) return 0.2; for (const [f, v] of TT) if (G.flag(f)) return v; return 0.05; };
  function applyTension() {
    const T = D.T();
    if (G.audio.ok && G.audio.ok()) { G.audio.tension(T); G.audio.amb('rain', 0.6 + 0.4 * T); }
    document.documentElement.style.setProperty('--vig', String(0.35 + T * 0.45));
    document.body.classList.toggle('dread', T >= 0.5);
  }

  /* ---------- mirroring cut (P6 / M5) ---------- */
  G.cutMirroring = async function () {
    if (!G.mirroring()) return;
    G.flag('M5', true);
    G.phone.updateStatus && G.phone.updateStatus();
    G.audio.sfx.castEnd();
    G.fx.glitch(120);
    G.phone.toast('화면 공유가 중지되었습니다');
    G.notebook && G.notebook.note && G.notebook.note('화면 공유를 끊었다. 이제 그 사람은 화면을 못 본다.');
    await sleep(1500);
    const burst = BD().cutBurst;
    G.flag('haruThread', true);
    for (let i = 0; i < burst.length; i++) {
      await G.chat.push('talk', 'haru', { from: 'them', text: G.T(burst[i]), creepy: true }, { tone: 'him', typingMs: 300, notify: true });
      await sleep(i < 4 ? 1300 : 700);
    }
    await sleep(1200);
    G.audio.sfx.knock(3, { az: 270, where: 'inside', vol: 0.9 });
    G.audio.gsm(0.35);
  };

  /* ---------- beats ---------- */
  const BEATS = [
    { id: 'B05', when: () => G.state.vars.firstRoomLookAt && (Date.now() - G.state.vars.firstRoomLookAt) / 1000 > 40 && G.room && G.room.isOpen(), run: () => G.audio.sfx.boiler() },
    { id: 'B06', when: () => since('M1') > 20, run: () => G.phone.notify({ app: 'gallery', title: '1년 전 오늘', body: '2025년 11월 24일의 추억을 확인하세요', route: { app: 'gallery', params: { memories: true } } }) },
    { id: 'B08', when: () => since('M1') > 60, run: () => D.manager(BD().managerFirst) },
    { id: 'B11', when: () => G.flag('M2'), safeOnly: false, run: () => { G.audio.sfx.pen(); G.audio.sfx.pageTurn(); G.notebook && G.notebook.ping && G.notebook.ping(); } },
    { id: 'B12', when: () => G.flag('F1'), run: async () => {
      await D.his(G.flag('knockedBack') ? BD().firstContactKnock : BD().firstContact, { gap: 2000 });
      G.notebook && G.notebook.note && G.notebook.note('…내 계정이다. 내 폰, 누가 갖고 있어.');
      setTimeout(() => G.audio.sfx.elevator(), 60000);
      G.hooks.call('room:refreshLayers');
    } },
    { id: 'B13', when: () => G.flag('F2') && fired('B12'), run: async () => {
      G.audio.sfx.batteryLow(true);
      G.phone.notify({ app: 'settings', appName: '배터리', title: '배터리 4%', body: '절전 모드를 켜세요' });
      G.hooks.call('room:refreshLayers');
      await sleep(4000);
      await D.his(BD().f2, { gap: 2200 });
      G.notebook && G.notebook.lead && G.notebook.lead('callme', '내 번호로 걸어 볼까? (톡 › ' + G.NAME + ')', () => G.flag('ringHeard'));
      await sleep(9000);
      managerSlip();
    } },
    { id: 'B15', when: () => G.flag('F3') && fired('B13'), run: async () => {
      G.hooks.call('room:refreshLayers');
      await D.his(G.flag('vaultSeen') ? BD().f3Seen : BD().f3);
    } },
    { id: 'B17', when: () => since('M4') > 45, run: () => {
      G.audio.musicBox({ variant: 'winddown', az: 270, closet: 0.7 });
      G.fx.sub('(옷장 안에서… 오르골 소리?)', 5000);
      G.notebook && G.notebook.note && G.notebook.note('세아 오르골이 저 안에 있다.');
    } },
    { id: 'B20', when: () => since('M5') > 30, run: () => G.hooks.call('gallery:addSharedFace') },
    { id: 'B22', when: () => G.flag('M6'), safeOnly: false, run: () => { G.audio.gsm(0.12); setTimeout(() => G.audio.gsm(0), 6000); G.audio.sfx.success(); } },
    { id: 'B23', when: () => since('M6') > 20, run: () => { G.audio.sfx.rackFall({ az: 270 }); G.state.vars.rackFallen = true; G.save(); } },
  ];

  async function managerSlip() {
    // 관리실 sends a photo, deletes it 1.2 s later. The 알림 기록 keeps it.
    G.flag('managerSlip', true);
    const thumb = G.IMG.vault_haru_sleep;
    G.phone.notify({ app: 'talk', title: '관리실', body: '[사진] 아직 안 자네 ㅎ', route: { app: 'talk', params: { thread: 'manager' } }, cls: 'blurthumb', duration: 1400 });
    const m = await G.chat.push('talk', 'manager', { from: 'them', img: thumb, deletedLater: true }, { notify: false });
    await sleep(1300);
    if (m) { m.deleted = true; m.img = null; G.save(); }
    G.bus.emit('chat:msg', { kind: 'talk', id: 'manager', msg: m });
    await sleep(2500);
    D.manager([BD().managerSorry]);
  }

  /* ---------- fragments: relief window ---------- */
  G.bus.on('fragment', ({ id, count }) => {
    reliefUntil = Date.now() + 20000;
    G.audio.musicBox({ variant: 'fragment' });
    G.audio.sfx.pen();
    G.phone.toast(`조각 ${count}/3 — ${id}`);
    applyTension();
  });

  /* ---------- watcher: he comments on what you open ---------- */
  let watchCount = 0, lastWatch = 0;
  G.bus.on('app:open', (id) => {
    if (!G.mirroring() || !G.flag('F1')) return;
    const line = BD().watcher[id];
    if (!line || watchCount >= 10 || Date.now() - lastWatch < 75000) return;
    const k = 'watch_' + id; if (G.state.vars[k]) return;
    G.state.vars[k] = 1; watchCount++; lastWatch = Date.now();
    setTimeout(() => { if (G.mirroring()) D.his(line, { typing: 1500 }); }, 4000 + Math.random() * 5000);
  });
  let wrongCount = 0;
  G.bus.on('memo:fail', () => maybeWrong());
  G.bus.on('lock:fail', () => {});
  function maybeWrong() { if (!G.mirroring() || !G.flag('F1') || wrongCount >= 2) return; if (Math.random() < 0.3) { wrongCount++; D.his(BD().wrongPw); } }
  D.wrongPassword = maybeWrong;

  /* ---------- look-away log (rule ②) ---------- */
  let hiddenAt = null, hiddenGame = null;
  function onHide() {
    if (!started || !G.flag('M1')) return;
    hiddenAt = Date.now(); hiddenGame = G.clock.now().getTime();
    if (G.mirroring() && G.flag('M2')) { G.fx.setTitle(G.T('{N야} 어디 가?')); G.fx.setFavicon('👁'); }
  }
  function onShow() {
    if (hiddenAt == null) return;
    const dur = Date.now() - hiddenAt; hiddenAt = null;
    G.fx.setTitle(); G.fx.setFavicon('🚪');
    if (dur < 1500) return;
    const log = G.state.vars.lookLog || [];
    log.push({ t: hiddenGame, dur });
    G.state.vars.lookLog = log.slice(-8);
    G.state.vars.lookAways = (G.state.vars.lookAways || 0) + 1;
    G.state.vars.lookBonus = Math.min(2, (G.state.vars.lookBonus || 0) + (dur > 4000 ? 1 : 0));
    G.save();
    G.hooks.has('room:refreshLayers') && G.hooks.call('room:refreshLayers');
    if (dur > 4000 && G.mirroring() && G.flag('F1')) {
      const n = (G.state.vars.returnMsgs || 0);
      if (n < 3 && Date.now() - (G.state.vars.returnMsgAt || 0) > 90000) {
        G.state.vars.returnMsgs = n + 1; G.state.vars.returnMsgAt = Date.now(); G.save();
        const m = Math.floor(dur / 60000), s = Math.floor((dur % 60000) / 1000);
        const line = BD().returnLines[n].replace('{m}', m).replace('{s}', s).replace('{n}', G.state.vars.lookAways);
        setTimeout(() => D.his(line), 1500);
        if (G.room && G.room.isOpen()) G.audio.sfx.creakWardrobe({ az: 270, dur: 1.6 });
      }
    }
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);

  /* ---------- room hooks ---------- */
  G.bus.on('room:view', (v) => {
    if (!G.state.vars.firstRoomLookAt) {
      G.state.vars.firstRoomLookAt = Date.now(); G.save();
      // first look: teach the flashlight if the player hasn't found it
      setTimeout(() => { if (!G.flag('usedFlash') && G.room && G.room.isOpen()) G.fx.sub('너무 어둡다. 오른쪽 위 ⚡ 플래시를 켜 보자.', 3200); }, 2600);
    }
    // B04: first look at the wardrobe -> a 2-frame catchlight in the gap (once, silent). room.js has the glint API.
    if (v === 'wardrobe' && !fired('B04') && !G.flag('M7')) {
      fire('B04');
      setTimeout(() => { const r = G.room && G.room.current && G.room.current(); if (r && r.glint) r.glint(70); }, 900);
    }
    if (G.flag('M1') && !fired('B07') && v !== 'wardrobe' && D.safe()) {
      fire('B07');
      setTimeout(() => { G.audio.sfx.knock(2, { az: 270, where: 'inside', vol: 0.5, gap: 0.6 }); G.flag('knockInvite', true); G.fx.sub('(옷장 쪽에서… 똑, 똑)', 2600); }, 2200);
    }
  });

  /* ---------- micro ambience & idle nudges ---------- */
  let nextMicro = Date.now() + 60000;
  function micro() {
    const T = D.T();
    if (Date.now() < nextMicro) return;
    nextMicro = Date.now() + (120 - 80 * T) * 1000 * (0.7 + Math.random() * 0.6);
    if (!G.audio.ok || !G.audio.ok() || G.flag('M7')) return;
    const A = G.audio, r = Math.random();
    if (r < 0.3) A.noise(A.now(), 2.5, 0.05, A.at(110, { dist: 6 }) || A.bus('amb'), { a: 1.2, filters: [{ type: 'lowpass', freq: 600 }] }); // pipe upstairs
    else if (r < 0.55) A.noise(A.now(), 4, 0.04, A.at(180, { dist: 12 }) || A.bus('amb'), { a: 1.8, brown: true, filters: [{ type: 'lowpass', freq: 300 }] }); // distant car
    else if (r < 0.8) A.noise(A.now(), 0.01, 0.12, A.at(200 + Math.random() * 140, { dist: 2.5 }) || A.bus('amb'), { filters: [{ type: 'bandpass', freq: 2000, Q: 6 }] }); // wall tick
    else if (G.flag('M1') && !G.flag('M8')) G.audio.sfx.knock(1, { az: 270, where: 'inside', vol: 0.35 });
  }
  function idle() {
    if (!G.flag('M1') || G.flag('M7')) return;
    const idleS = (Date.now() - lastFlagAt) / 1000;
    if (idleS > 150 && !G.state.vars.nudge150At || (G.state.vars.nudge150At && Date.now() - G.state.vars.nudge150At > 150000 && idleS > 150)) {
      G.state.vars.nudge150At = Date.now(); G.save();
      G.audio.sfx.knock(1, { az: 270, where: 'inside', vol: 0.4 });
    }
    if (idleS > 240 && (!G.state.vars.nudge240At || Date.now() - G.state.vars.nudge240At > 240000)) {
      G.state.vars.nudge240At = Date.now(); G.save();
      G.notebook && G.notebook.ping && G.notebook.ping();
      G.phone.toast('📓 수첩에 새 단서가 있어요');
    }
  }

  /* ---------- main loop ---------- */
  async function tick() {
    if (!started || document.hidden) return;
    if (G.flag('END')) return;
    micro(); idle();
    const now = Date.now();
    for (const b of BEATS) {
      if (fired(b.id)) continue;
      let ok = false; try { ok = b.when(); } catch (e) { ok = false; }
      if (!ok) continue;
      if (b.safeOnly !== false && (!D.safe() || now - lastBeatAt < 8000)) continue;
      fire(b.id); lastBeatAt = now;
      try { await b.run(); } catch (e) { console.error('[beat]', b.id, e); }
      break;
    }
  }
  D.start = function (cont) {
    if (started) return;
    started = true;
    applyTension();
    G.bus.on('flag', applyTension);
    setInterval(tick, 1000);
    if (cont && G.mirroring() && G.flag('F1')) setTimeout(() => D.his(BD().reloadLine), 6000);
    if (G.flag('M5') && !G.flag('M6')) G.audio.gsm(0.35);
  };
  D.fired = fired; D.fire = fire;
  D.isSafe = D.safe; // G.sd.isSafe (js/data/talk.js) looks for this name; without it scripted chat beats ignored holds/relief/JS1 windows
})();
