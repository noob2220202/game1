/* =========================================================
 * Scenes (LEAD): immersion setup (earphone test, motion, camera opt-in),
 * cold open (third-knock lie, ringing under the bed, time-slip lock screen),
 * lock-screen story data (P1), and the ENDING.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const SC = (G.scenes = {});

  /* ---------------- lock screen data (P1) ---------------- */
  G.STORY = G.STORY || {};
  G.STORY.lock = {
    wallpaper: G.IMG.dog_face,
    hint: () => '막내가 온 날 🐶',
    check: (code) => code === '0317',
    wrongMsg: (code, fails) => (fails >= 3 ? `PIN이 일치하지 않습니다 (${fails}회)\n힌트: 막내가 온 날 🐶` : `PIN이 일치하지 않습니다 (${fails}회)`),
    notifs: () => [
      { app: 'talk', title: '엄마', body: '부재중 보이스톡 (366)', when: '방금' },
      { app: 'talk', title: '엄마', body: '세아야 오늘로 1년이야. 엄마 오늘도 전화했어.', when: '방금' },
      { app: 'haesol', title: '해솔홈', body: '도어락: 원격 관리자 잠금이 설정되었습니다.', when: '34분 전' },
      { app: 'settings', appName: '배터리', title: '배터리 23%', body: '충전기를 연결하세요', when: '1분 전' },
    ],
    async emergency() {
      await G.phone.callScreen({ name: '긴급 통화', number: '112', async script(api) {
        api.status('연결 중…'); await sleep(2200);
        await api.sub('긴급 통화 연결 실패 · 셀룰러 신호 없음 (SIM 없음)', 2600, 'red');
      } });
      G.notebook && G.notebook.note && G.notebook.note('SIM이 없다. 112도 안 된다.');
    },
    onUnlock() {
      G.flag('M1', true); // milestone M1: unlocked (clock 03:38, mirroring on, director beats start)
      G.audio.amb('room', 0.9); G.audio.amb('rain', 0.6); G.audio.tension(0.15);
      G.notebook && G.notebook.show && G.notebook.show(true);
      G.phone.renderHome();
    },
    onShow() {},
  };
  // P1: after 3 wrong PINs the notebook (P1 hints) becomes reachable on the lock screen (design §3 P1)
  G.bus.on('lock:fail', (e) => {
    if (!e || e.fails < 3 || !G.notebook || !G.notebook.show || !G.phone.isLocked()) return;
    G.notebook.show(true);
    if (e.fails === 3 && G.notebook.ping) G.notebook.ping();
  });

  /* ---------------- immersion setup ---------------- */
  SC.immersion = function (done) {
    const s = G.settings;
    const scr = el('div.title-screen', { style: { justifyContent: 'center', zIndex: 320 } });
    const inner = el('div.title-inner', { style: { maxWidth: '340px', gap: '10px' } });
    scr.appendChild(inner);
    document.getElementById('screen').appendChild(scr);
    const row = (title, desc, btn) => el('div.imm-row', null, el('div.imm-main', null, el('b', null, title), el('span', null, desc)), btn);
    // earphone test
    const earBtn = el('button.imm-btn', null, '테스트');
    let earState = s.audioMode ? (s.audioMode === 'ear' ? '✓ 이어폰' : '스피커') : null;
    if (earState) earBtn.textContent = earState;
    earBtn.addEventListener('click', () => earTest(earBtn));
    inner.append(
      el('div.title-kicker', null, 'SETUP'),
      el('div', { style: { fontFamily: 'var(--serif)', fontSize: '20px', color: '#ddd', marginBottom: '6px', textAlign: 'center' } }, '몰입 설정'),
      row('🎧 이어폰 테스트', '이 게임의 소리에는 방향이 있습니다', earBtn),
      el('div.imm-note', null, '🔆 화면 밝기를 올리고, 어두운 곳에서 해주세요.'),
      el('div', { style: { fontSize: '11.5px', color: '#666', textAlign: 'center', margin: '8px 0' } }, '이 게임은 어떤 데이터도 서버로 보내지 않습니다.'),
      el('button.title-btn.primary', { style: { width: '100%' }, onclick: () => { scr.remove(); done(); } }, '시작'));

    async function earTest(btn) {
      G.audio.unlock();
      const ask = (q) => new Promise((res) => {
        const box = el('div.imm-ask', null, el('div', null, q),
          el('div.imm-ask-btns', null, ['왼쪽', '오른쪽', '모르겠어요 / 스피커'].map((l, i) => el('button.imm-btn', { onclick: () => { box.remove(); res(i); } }, l))));
        inner.appendChild(box);
      });
      const knock = async (pan) => {
        const A = G.audio; if (!A.ok()) return;
        const p = A.ctx.createStereoPanner(); p.pan.value = pan; p.connect(A.bus('sfx'));
        const t = A.now(); [0, 0.4].forEach((dt) => { A.osc('sine', 182, t + dt, 0.09, 0.6, p, { a: 0.001, decay: true }); A.noise(t + dt, 0.012, 0.4, p, { filters: [{ type: 'bandpass', freq: 900, Q: 2 }] }); });
      };
      btn.textContent = '…';
      await knock(-1); const a1 = await ask('어느 쪽에서 들렸나요?');
      if (a1 !== 0) { s.audioMode = 'speaker'; G.saveSettings(); btn.textContent = '스피커'; G.phone.toast('스피커 모드: 방향은 화면 표시로 알려드려요'); return; }
      await knock(1); const a2 = await ask('이번엔?');
      if (a2 !== 1) { s.audioMode = 'speaker'; btn.textContent = '스피커'; } else { s.audioMode = 'ear'; btn.textContent = '✓ 이어폰'; G.phone.toast('좋아요. 이 게임의 소리에는 방향이 있습니다.'); }
      G.saveSettings();
    }
  };
  /* ---------------- start / continue ---------------- */
  SC.start = async function (cont) {
    const st = G.state.vars, s = G.settings;
    st.motionOK = false; st.cameraOptIn = false; // client decision: no sensors, no camera
    if (!st.firstOpenReal) st.firstOpenReal = Date.now();
    G.state.vars.reloads = (G.state.vars.reloads || 0) + (cont ? 1 : 0);
    G.save();
    try { if (navigator.wakeLock) G._wake = await navigator.wakeLock.request('screen'); } catch (e) {}
    document.addEventListener('visibilitychange', async () => { if (!document.hidden && navigator.wakeLock) { try { G._wake = await navigator.wakeLock.request('screen'); } catch (e) {} } });
    G.notebook && G.notebook.init && G.notebook.init();
    if (cont && G.flag('M1')) {
      G.lockDone = true;
      G.phone.setLocked(false);
      G.audio.amb('room', 0.9); G.audio.amb('rain', 0.6); G.audio.amb('drone', 0.3);
      G.notebook && G.notebook.show && G.notebook.show(true);
      G.director.start(true);
      if (G.flag('END')) SC.ending(true);
      else if (G.flag('M7') && G.climax && G.climax.resume) setTimeout(() => G.climax.resume(), 800);
      return;
    }
    G.notebook && G.notebook.show && G.notebook.show(false);
    G.phone.setLocked(true); G.phone.lockLayer().innerHTML = '<div style="position:absolute;inset:0;background:#000"></div>';
    await coldOpen();
    G.director.start(false);
  };

  async function coldOpen() {
    const A = G.audio;
    const c = G.fx.cinema();
    await sleep(1400);
    // the third knock: ONE knock from directly behind (the earphone test had two)
    A.setYaw(0);
    A.sfx.knock(1, { az: 180, where: 'behind', vol: 1 });
    await sleep(2000);
    await c.type('(…똑.)', { cls: 'dim', speed: 80, sound: false, hold: 1400 });
    await c.clear();
    A.amb('rain', 0.5); A.amb('room', 0.7);
    await sleep(4000);
    // phone ringing under the bed (mom's nightly voice call)
    const ring = A.sfx.ringMom({ underBed: true, vol: 0.9 });
    await c.type('침대 밑에서 무언가가 울린다.', { speed: 60, hold: 600 });
    await new Promise((res) => {
      const b = el('button.cine-reach', null, el('i'), el('span', null, '손을 뻗는다'), el('small', null, '길게 누르기'));
      c.node.appendChild(b); requestAnimationFrame(() => b.classList.add('in'));
      let t = null;
      const start = (e) => { e.preventDefault(); b.classList.add('hold'); t = setTimeout(() => { b.remove(); res(); }, 600); };
      const cancel = () => { b.classList.remove('hold'); clearTimeout(t); };
      b.addEventListener('pointerdown', start); b.addEventListener('pointerup', cancel); b.addEventListener('pointerleave', cancel);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('keydown', function k(e) { if (e.code === 'Space' || e.key === 'Enter') { document.removeEventListener('keydown', k); b.remove(); res(); } });
    });
    ring.stop();
    A.sfx.tap();
    // lock screen with the REAL time, then it rolls to 03:33
    G.lock.show();
    const timeEl = document.querySelector('.lock-time');
    const real = new Date();
    G.state.vars.clockOverride = new Date(2026, 10, 24, real.getHours(), real.getMinutes()).getTime();
    G.phone.updateStatus && G.phone.updateStatus();
    if (timeEl) timeEl.textContent = `${real.getHours()}:${pad(real.getMinutes())}`;
    c.node.style.transition = 'opacity .5s'; c.node.style.opacity = '0';
    await sleep(500); c.node.remove();
    await sleep(1200);
    if (timeEl) { timeEl.classList.add('roll'); A.sfx.glitch(); G.fx.glitch(160); }
    await sleep(600);
    delete G.state.vars.clockOverride; G.save();
    G.phone.updateStatus && G.phone.updateStatus();
    if (timeEl) { timeEl.classList.remove('roll'); timeEl.textContent = '3:33'; }
    A.amb('drone', 0.15);
    G.flag('introDone', true);
    if (real.getHours() < 5) { await sleep(1500); G.fx.sub('지금, 진짜 새벽이네.', 3000); }
  }

  /* ---------------- ENDING ---------------- */
  G.hooks.set('end:start', () => SC.ending(false));
  const SEA_MAIL = `이 메일이 도착했는데 내가 예약을 취소하지 않았다면,
나는 아마 못 나간 거겠지.

그럼 이 폰을 들고 있는 너는, 나간 거야. 그치?
그래서 1년 뒤 아침 7시로 맞춰 놨어. 아침이면 좋겠어서.

부탁 하나만 할게.
우리 엄마한테 이 메일 좀 보여줘.

엄마. 그날 전화 못 받은 거, 절대 엄마 잘못 아니야.
콩이 산책은 하루에 두 번. 간식은 저녁에만.
그리고 엄마,
<u class="pen-u">하루에 한 번만</u> 나 생각해줘. 딱 한 번만.
나머지 시간은 엄마 하고 싶은 거 하면서 살아.

이름도 모르는 너한테.
고마워. 진짜로.

— 세아`;

  SC.ending = async function (replay) {
    if (SC._ending) return; SC._ending = true;
    const A = G.audio;
    G.flag('END', true);
    G.clock.freeze(7, 0);
    A.gsm(0); A.amb('drone', false, 3); A.amb('room', false, 4); A.amb('rain', 0.25, 20); A.tension(0);
    G.notebook && G.notebook.show && G.notebook.show(false);
    G.phone.closeAll(true);
    const stage = el('div.ending');
    document.getElementById('screen').appendChild(stage);
    const bg = el('div.end-bg', { style: { backgroundImage: `url("${G.IMG.dawn_exterior}")` } });
    stage.appendChild(bg);
    requestAnimationFrame(() => stage.classList.add('in'));
    birds(60);
    await sleep(3500);
    // scheduled mail notification
    A.sfx.notify();
    const note = el('div.end-notif', null, el('b', null, '메일 · 예약 메일'), el('span', null, '윤세아 — 1년 뒤에 이 메일을 읽을 누군가에게'));
    stage.appendChild(note); requestAnimationFrame(() => note.classList.add('in'));
    await waitTap(note);
    note.remove();
    const mail = el('div.end-mail', null,
      el('div.em-head', null, el('div.em-subj', null, '1년 뒤에 이 메일을 읽을 누군가에게'), el('div.em-meta', null, '윤세아 <seah.y@hanmail.net> · 예약 발송: 2025.11.23 23:58 → 2026.11.24 07:00')),
      el('div.em-body', { html: SEA_MAIL.replace(/\n/g, '<br>') }),
      el('button.end-next', null, '엄마에게 보여주기'));
    stage.appendChild(mail); requestAnimationFrame(() => mail.classList.add('in'));
    if (G.NAME === '하루') setTimeout(() => { const u = mail.querySelector('.pen-u'); if (u) u.classList.add('on'); A.sfx.pen(); G.notebook && G.notebook.note && G.notebook.note('…하루에 한 번만.'); }, 9000);
    await waitTap(mail.querySelector('.end-next'));
    mail.classList.remove('in'); await sleep(500); mail.remove();
    // mom thread (scripted)
    const chat = el('div.end-chat', null, el('div.ec-head', null, el('span.ec-av', { style: { backgroundImage: `url("${G.IMG.avatar_mom}")` } }), el('b', null, '엄마')));
    const body = el('div.ec-body'); chat.appendChild(body);
    stage.appendChild(chat); requestAnimationFrame(() => chat.classList.add('in'));
    const mb = A.musicBox({ variant: 'warm', gain: 0.5 });
    const bub = async (me, html, wait) => {
      if (!me) { const ty = el('div.ec-row', null, G.ui.typing()); body.appendChild(ty); await sleep(wait || 2500); ty.remove(); }
      const r = el('div.ec-row' + (me ? '.me' : ''), null, el('div.ec-b', { html }));
      body.appendChild(r); body.scrollTop = 1e6; me ? A.sfx.msgSend() : A.sfx.msgMom();
      await sleep(900);
    };
    await bub(true, '어머님, 저는 404호에 새로 이사 온 사람이에요. 세아 씨 폰을 찾았어요.');
    await bub(false, '…세아가 뭐라고 했어요?', 5000);
    await bub(true, '<div class="ec-card">✉️ 1년 뒤에 이 메일을 읽을 누군가에게<br><small>윤세아 · 예약 메일</small></div>');
    await bub(false, '…', 6000);
    await bub(false, '고마워요.', 3500);
    await bub(false, `<img src="${G.IMG.kongi_old}" alt="">`, 2500);
    await bub(false, '콩이가 아직도 현관에서 기다려요.', 3000);
    if (G.flag('momTold') || G.flag('momRead')) await bub(false, '오늘은 전화 안 할게요. 대신 내일 아침에 콩이 데리고 산책 갈게요.', 4000);
    await sleep(2500);
    const nx = el('button.end-next', null, '계속'); chat.appendChild(nx); await waitTap(nx);
    chat.classList.remove('in'); await sleep(600); chat.remove();
    // text card
    const lines = ['경찰은 404호 붙박이장 뒤 배관 점검구에서', '1년 치의 사진과 윤세아 씨의 물건들을 수거했다.', '', '윤세아 씨의 행방은 아직 찾지 못했다.', '그 남자는 아직 잡히지 않았다.'];
    if (G.flag('jiminTold')) lines.push('', '지민의 신고로 경찰은 04시 51분에 도착했다.');
    if (G.flag('managerExposed')) lines.push('', "해솔빌 관리사무소는 '관리실' 사칭 번호를 신고했다.");
    if (G.flag('momRead')) lines.push('', '그날 아침, 세아 엄마는 1년 만에 처음으로 전화를 걸지 않았다.');
    const card = el('div.end-card', null, lines.map((l) => el('p', null, l || ' ')));
    stage.appendChild(card); requestAnimationFrame(() => card.classList.add('in'));
    await sleep(9000 + lines.length * 400);
    const nx2 = el('button.end-next', null, '계속'); card.appendChild(nx2); await waitTap(nx2);
    card.classList.remove('in'); await sleep(700); card.remove();
    // credits
    const maker = (window.CONFIG && window.CONFIG.MAKER_NAME) || '';
    const mins = Math.round(G.state.playMs / 60000);
    const credits = el('div.end-credits', null,
      el('div.ecr-title', { html: `${G.NAME}${hasB(G.NAME) ? '을' : '를'} 위한<br><em>방탈출!</em>` }),
      el('p', null, '기획·제작 ', el('b', null, maker)), el('p', null, '주인공 ', el('b', null, G.NAME)),
      el('p.dim', null, '목소리: AI 음성 · 사진: AI 생성 + 직접 편집 · 소리: 전부 직접 합성'),
      el('p.dim', null, `플레이 ${mins}분 · 힌트 ${G.state.hintsUsed || 0}회`),
      el('p.dim', null, '이 게임은 아무 데이터도 보내지 않았어요. 카메라도, 마이크도 쓰지 않았어요.'));
    G.faceFrame = null;
    stage.appendChild(credits); requestAnimationFrame(() => credits.classList.add('in'));
    await sleep(9000);
    mb.stop();
    credits.classList.remove('in'); await sleep(900); credits.remove();
    // JS3 sting: black, his tone only, real time
    bg.style.opacity = '0'; A.amb('rain', false, 2);
    await sleep(3000);
    A.sfx.msgHim();
    const real = new Date();
    const sting = el('div.end-sting', null,
      el('div.es-banner', null, el('b', null, G.NAME), el('span', null, '지금')),
      el('div.es-msg', null, el('span.es-time', null, `${pad(real.getHours())}:${pad(real.getMinutes())}`), el('div.es-bubble', null, G.T(G.BEATDATA.js3))));
    stage.appendChild(sting); requestAnimationFrame(() => sting.classList.add('in'));
    if (G.settings.vibration && navigator.vibrate) try { navigator.vibrate([120, 80, 120]); } catch (e) {}
    await sleep(1200);
    sting.querySelector('.es-msg').appendChild(G.ui.typing());
    await sleep(2600);
    sting.querySelector('.typing') && sting.querySelector('.typing').remove();
    await sleep(2200);
    sting.classList.remove('in'); await sleep(800); sting.remove();
    // friend's letter
    const letter = (window.CONFIG && window.CONFIG.ENDING_LETTER) || '';
    const lt = el('div.end-letter', null,
      el('div.el-paper', null, el('div.el-text', null, letter), el('div.el-sign', null, '— ' + maker)),
      el('div.el-btns', null, el('button.title-btn.primary', { onclick: share }, '진짜로 보내기'), el('button.title-btn', { onclick: () => { G.resetSave(); location.reload(); } }, '처음부터')));
    stage.appendChild(lt); requestAnimationFrame(() => lt.classList.add('in'));
    G.save(true);
  };
  function hasB(s) { const c = s.charCodeAt(s.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; }
  async function share() {
    const text = `나 404호에서 탈출했어. 비번은 472906이었어. · ${G.NAME}`;
    const url = location.origin && location.origin !== 'null' ? location.origin + location.pathname : 'https://haru.pengueverything.cloud/';
    try { if (navigator.share) { await navigator.share({ title: '하루를 위한 방탈출!', text, url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text + ' ' + url); G.phone.toast('복사했어요. 친구에게 붙여넣어 보내 주세요.'); } catch (e) { G.phone.toast(text); }
  }
  function waitTap(node) { return new Promise((res) => node.addEventListener('click', () => { G.audio.sfx.tap(); res(); }, { once: true })); }
  function birds(sec) {
    const A = G.audio; if (!A.ok()) return;
    const end = Date.now() + sec * 1000;
    const chirp = () => {
      if (Date.now() > end || !A.ok()) return;
      const t = A.now(); const n = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) { const f = 3000 + Math.random() * 2500; const o = A.osc('sine', f, t + i * 0.09, 0.07, 0.025, A.bus('amb'), { a: 0.005, decay: true }); o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.6), t + i * 0.09 + 0.07); }
      setTimeout(chirp, 400 + Math.random() * 2600);
    };
    chirp();
    setTimeout(() => { const t = A.now(); A.noise(t, 6, 0.05, A.bus('amb'), { a: 3, brown: true, filters: [{ type: 'lowpass', freq: 350 }] }); }, 30000);
  }
})();
