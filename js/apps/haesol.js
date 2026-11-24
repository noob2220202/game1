/* =========================================================
 * 해솔홈 (Haesol Smart Living) — DESIGN P5 · P6 · P7 · P8(비상벨)
 *
 * P5  splash → login (seah.y, password always wrong) → 비밀번호 찾기 → 보안질문 '나의 보물 1호는?'
 *     (오르골 + variants) → OTP mail (G.mail.push, random 6 digits in vars.otp) → 인증번호 → dashboard  [M4]
 *     (client override: no face login)
 * P6  [원격 잠금 해제] snaps back while G.mirroring() + his lines (3 taunts; no system toast after — client: no hints).
 *     Cutting the share before ever trying → '…처음부터 보고 있었어.'
 * P7  기기 관리: wrong block taunt · block sagongsa (needs !mirroring) → MFA bombing ×5 (#3 number matching)
 *     deny all → 보호하기 → checklist  [M6, netFree, remoteAdmin='none'];  허용/47 → 승인됨 + taunt (assist after 2)
 * P8  G.hooks 'haesol:openBell' → red 비상벨 overlay, resolves on a 2 s hold
 * Dashboard: 도어락 · CCTV 4F/1F (live timestamp; EPS ajar after M6) · 실내 카메라 (offline) ·
 *            옷장 문 센서 이벤트 로그 (vars.lookLog) · 기기 관리 · 로그인 기록 · 비상벨 · 계정 보호
 * Bus: 'haesol:login' · 'haesol:otp' · 'haesol:snap' n · 'haesol:block' {id, ok} · 'haesol:mfa' result · 'haesol:bell'
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad, clamp } = G.util;
  const H = (G.haesol = {});
  const V = () => G.state.vars;
  const T = (s) => (G.T ? G.T(s) : s);
  const IMG = (k) => (G.IMG && G.IMG[k]) || '';
  const sfx = (n, ...a) => { try { G.audio && G.audio.sfx[n] && G.audio.sfx[n](...a); } catch (e) {} };
  const note = (t) => { try { G.notebook && G.notebook.note && G.notebook.note(T(t)); } catch (e) {} };
  const mirroring = () => (G.mirroring ? G.mirroring() : G.flag('M1') && !G.flag('M5'));
  const vib = (p) => { if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate(p); } catch (e) {} };
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const hhmmss = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  /* status-bar text colour for this module's screens ('dark' = dark text on a light background) */
  G.bus.on('screen:push', (e) => {
    const n = e && e.node; if (!n || !n.classList) return;
    let st = null;
    if (['hh-screen'].some((c) => n.classList.contains(c))) st = 'light';
    else if ([].some((c) => n.classList.contains(c))) st = 'dark';
    if (!st) return;
    n.dataset.status = st;
    if (G.phone.top && G.phone.top() === e) G.phone.statusTheme(st);
  });
  /* dark full-screen overlays: light status text while open */
  function statusOverlay() {
    try { G.phone.statusTheme('light'); } catch (e) {}
    return () => { try { const t = G.phone.top && G.phone.top(); G.phone.statusTheme(t && t.node ? t.node.dataset.status || 'light' : 'light'); } catch (e) {} };
  }

  const IC = {
    logo: '<svg viewBox="0 0 24 24"><path d="M3.5 11.2L12 4l8.5 7.2" fill="none" stroke="#4fd1c5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9.5h12V10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><rect x="10" y="13" width="4" height="6.5" rx=".8" fill="#4fd1c5"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="15.5" r="1.4" fill="#0e1620"/></svg>',
    unlock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 017.6-1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M3 8.5A1.5 1.5 0 014.5 7h9A1.5 1.5 0 0115 8.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 15.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15 10.5l5-3v9l-5-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    camoff: '<svg viewBox="0 0 24 24"><path d="M3 8.5A1.5 1.5 0 014.5 7h9A1.5 1.5 0 0115 8.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 15.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15 10.5l5-3v9l-5-3M3 4l18 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    sensor: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="9" height="17" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="16" y="8" width="3" height="8" rx="1" fill="currentColor"/><path d="M11 12h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    devices: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 18h6M9 14v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="16.5" y="8" width="4.5" height="11" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    history: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 102.2-5.3M4.5 4.5v3.2h3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4.3l2.8 1.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.6 2H4.4z" fill="currentColor"/><path d="M10 20.5a2 2 0 004 0" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.6c0 4.4-3.1 8-7.5 9.4-4.4-1.4-7.5-5-7.5-9.4V6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.8 12.2l2.3 2.3 4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5M12 17v.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.8" width="10" height="18.4" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.5 18h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    hub: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M5 5a10 10 0 000 14M19 5a10 10 0 010 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    robot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="9" r="2" fill="currentColor"/><path d="M7 15h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 3v18M10 8h6M10 11.5h5" stroke="currentColor" stroke-width="1.4"/></svg>',
  };

  /* ---------------- his voice (톡 '{N}' thread, his tone) ---------------- */
  async function him(text, typing) {
    try {
      G.flag('haruThread', true);
      await G.chat.push('talk', 'haru', { from: 'them', text: T(text), creepy: true }, { tone: 'him', typingMs: typing == null ? 700 : typing });
    } catch (e) {}
  }
  /* door-lock motor from the door direction (3D) */
  function doorMotor() {
    const A = G.audio;
    try {
      if (!A || !A.ok || !A.ok()) return;
      const out = (A.at && A.at(0, { dist: 3.2, life: 4 })) || A.bus('sfx');
      const t = A.now();
      A.osc('sawtooth', 210, t, 0.46, 0.08, out, { a: 0.02, filter: { freq: 900, Q: 3 } });
      A.osc('sawtooth', 158, t + 0.04, 0.4, 0.05, out, { a: 0.02, filter: { freq: 700, Q: 2 } });
      A.noise(t + 0.46, 0.1, 0.5, out, { filters: [{ type: 'bandpass', freq: 1600, Q: 2 }] });
    } catch (e) {}
    G.fx.sub('(현관 쪽에서 — 위이잉, 철컥)', 1800);
  }

  /* =========================================================
   * app shell
   * ========================================================= */
  let root = null; // {scr, body, render()}
  G.app('haesol', {
    name: '해솔홈',
    icon: G.ICONS.home,
    badge: () => (G.flag('M4') && !G.flag('M6') && G.flag('M5') ? 1 : 0),
    open(p) { openApp(p || {}); },
  });

  function openApp(p) {
    const body = el('div.hh-rootbody');
    const scr = G.ui.screen({ title: '해솔홈', theme: 'dark', cls: 'hh-screen hh-root', body, header: false });
    let stage = 'splash';
    const R = (root = { scr, body, render });
    function render() {
      if (root !== R) return;
      body.innerHTML = '';
      if (stage === 'splash') body.appendChild(splash());
      else if (G.flag('M4')) body.appendChild(dashboard());
      else body.appendChild(loginView());
    }
    render();
    G.phone.push(scr, { onResume: () => { if (stage !== 'splash') render(); }, onClose: () => { if (root === R) root = null; } });
    setTimeout(() => {
      if (root !== R) return; // left the app during the splash
      stage = 'main'; render();
      if (!G.flag('M4') && V().hsOtpSent && V().otp) otpScreen(true);
      if (p.screen && G.flag('M4')) openSub(p.screen);
    }, p.noSplash ? 0 : 1150);
  }
  H.open = (screen) => G.phone.openApp('haesol', { screen });
  function rerender() { if (root) root.render(); }
  G.bus.on('flag', (f) => { if (['M5', 'M6', 'M4'].includes(f)) rerender(); });

  function splash() {
    return el('div.hh-splash', null,
      el('div.hh-splash-logo', { html: IC.logo }),
      el('div.hh-splash-name', null, '해솔홈'),
      el('div.hh-splash-sub', null, 'Haesol Smart Living'),
      el('div.hh-splash-foot', null, '해솔빌 입주민 전용 스마트홈'));
  }

  /* keep a form's action button above the in-game keyboard */
  function keepAbove(target) {
    setTimeout(() => {
      const sv = target.closest('.sv-body'); const kb = document.querySelector('.kb.in');
      if (!sv || !kb) return;
      const over = target.getBoundingClientRect().bottom + 14 - kb.getBoundingClientRect().top;
      if (over > 0) sv.scrollTo ? sv.scrollTo({ top: sv.scrollTop + over, behavior: 'smooth' }) : (sv.scrollTop += over);
    }, 320);
  }

  /* =========================================================
   * P5 — login / 비밀번호 찾기 / OTP
   * ========================================================= */
  function brand() { return el('div.hh-brand', null, el('i', { html: IC.logo }), el('div', null, el('b', null, '해솔홈'), el('small', null, 'Haesol Smart Living'))); }
  function loginView() {
    const pw = G.ui.field({ password: true, placeholder: '비밀번호', cls: 'hh-fld', onSubmit: () => doLogin() });
    pw.set('********');
    const err = el('div.hh-err');
    const btn = el('button.hh-btn.primary', null, '로그인');
    const find = el('button.hh-link', null, '비밀번호 찾기');
    const wrap = el('div.hh-login', null,
      brand(),
      el('div.hh-lbl', null, '아이디'),
      el('div.hh-id', null, el('span', null, 'seah.y'), el('small', null, '저장된 아이디')),
      el('div.hh-lbl', null, '비밀번호'),
      pw.node,
      err,
      btn,
      el('div.hh-links', null, find, el('i'), el('button.hh-link.dim', { onclick: () => G.phone.toast('아이디는 seah.y입니다') }, '아이디 찾기'), el('i'), el('button.hh-link.dim', { onclick: () => G.phone.toast('해솔빌 입주민 인증이 필요합니다') }, '회원가입')),
      el('div.hh-foot', null, '해솔빌 관리사무소 · 02-338-5120'));
    let busy = false;
    async function doLogin() {
      if (busy) return; busy = true;
      pw.blur();
      btn.classList.add('loading'); btn.textContent = '';
      await sleep(750);
      btn.classList.remove('loading'); btn.textContent = '로그인';
      const n = (V().hsLoginFails = (V().hsLoginFails || 0) + 1); G.save();
      err.textContent = `아이디 또는 비밀번호가 일치하지 않습니다. (${n}회)`;
      wrap.classList.remove('hh-shake'); void wrap.offsetWidth; wrap.classList.add('hh-shake');
      sfx('error'); vib(120);
      try { G.director && G.director.wrongPassword && G.director.wrongPassword(); } catch (e) {}
      G.bus.emit('haesol:loginFail', n);
      busy = false;
    }
    pw.node.addEventListener('click', () => keepAbove(btn));
    btn.addEventListener('click', () => { sfx('tap'); doLogin(); });
    find.addEventListener('click', () => { sfx('tap'); pw.blur(); questionScreen(); });
    return wrap;
  }

  const ANSWERS = ['오르골', '오르골상자', '오르골박스', '뮤직박스', 'musicbox', '오르곤', '오르굴', 'dhfmrhf', '오르골함', '작은오르골', '나무오르골', 'orgel', '오르겔'];
  function normAns(s) { return String(s || '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''); }
  function steps(n) { return el('div.hh-steps', null, ['본인확인', '인증번호', '완료'].map((s, i) => el('div' + (i + 1 < n ? '.done' : i + 1 === n ? '.on' : ''), null, el('i', null, i + 1 < n ? '✓' : String(i + 1)), el('span', null, s)))); }
  function questionScreen() {
    const err = el('div.hh-err');
    const f = G.ui.field({ placeholder: '답변 입력', mode: 'ko', cls: 'hh-fld', submitLabel: '확인', onSubmit: () => check() });
    const next = el('button.hh-btn.primary', null, '다음');
    const body = el('div.hh-form', null,
      steps(1),
      el('div.hh-h', null, '비밀번호 찾기'),
      el('div.hh-p', null, '가입할 때 등록한 본인확인 질문에 답해 주세요.'),
      el('div.hh-lbl', null, '아이디'), el('div.hh-id', null, el('span', null, 'seah.y')),
      el('div.hh-q', null, el('small', null, '본인확인 질문'), el('b', null, '나의 보물 1호는?')),
      f.node, err, next);
    const scr = G.ui.screen({ title: '비밀번호 찾기', theme: 'dark', cls: 'hh-screen', body });
    G.phone.push(scr);
    f.node.addEventListener('click', () => keepAbove(next));
    setTimeout(() => { f.focus(); keepAbove(next); }, 380);
    let busy = false;
    async function check() {
      if (busy) return;
      const v = normAns(f.value);
      if (!v) { err.textContent = '답변을 입력해 주세요.'; return; }
      busy = true; f.blur();
      next.classList.add('loading'); next.textContent = '';
      await sleep(600);
      next.classList.remove('loading'); next.textContent = '다음';
      if (ANSWERS.includes(v) || /오르골|뮤직박스|musicbox/.test(v)) {
        sfx('success');
        G.flag('hsQuestion', true);
        await sendOtp();
        G.phone.pop(true);
        otpScreen(false);
      } else {
        const n = (V().hsQFails = (V().hsQFails || 0) + 1); G.save();
        err.textContent = '답변이 일치하지 않습니다.';
        sfx('error'); vib(100);
        body.classList.remove('hh-shake'); void body.offsetWidth; body.classList.add('hh-shake');
        f.clear();
        G.bus.emit('haesol:questionFail', n);
      }
      busy = false;
    }
    next.addEventListener('click', () => { sfx('tap'); check(); });
  }
  async function sendOtp() {
    if (!V().otp) { V().otp = String(Math.floor(100000 + Math.random() * 900000)); }
    V().hsOtpSent = true; G.save();
    G.bus.emit('haesol:otp');
    const code = V().otp;
    setTimeout(() => {
      try { if (G.mail && G.mail.push) G.mail.push(Object.assign(G.STORY.mailTpl.otp(code), { id: 'otp' + Date.now() })); } catch (e) { console.error(e); }
    }, 1600);
  }
  function otpScreen(resumed) {
    let code = '';
    const boxes = el('div.hh-otp', null, Array.from({ length: 6 }, () => el('i')));
    const err = el('div.hh-err');
    const keys = el('div.hh-kp', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => {
      if (!k) return el('span');
      const b = el('button.hh-key' + (k === '⌫' ? '.del' : ''), { 'aria-label': k === '⌫' ? '지우기' : k }, k === '⌫' ? '' : k);
      if (k === '⌫') b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
      b.addEventListener('click', () => press(k));
      return b;
    }));
    const resend = el('button.hh-link.dim', null, '인증번호 재전송');
    const openMail = el('button.hh-link', null, '메일 앱 열기');
    const body = el('div.hh-form.otp', null,
      steps(2),
      el('div.hh-h', null, '인증번호 입력'),
      el('div.hh-p', null, `${G.STORY.mailAccount || 'seah.y@hanmail.net'}(으)로 인증번호를 보냈습니다. (유효 5분)`),
      resumed ? el('div.hh-p.dim', null, '받은 인증번호 6자리를 입력해 주세요.') : null,
      boxes, err, el('div.hh-links', null, openMail, el('i'), resend), keys);
    const scr = G.ui.screen({ title: '비밀번호 찾기', theme: 'dark', cls: 'hh-screen', body });
    function render() { boxes.querySelectorAll('i').forEach((b, i) => { b.textContent = code[i] || ''; b.classList.toggle('on', i === code.length); }); }
    let busy = false;
    async function press(k) {
      if (busy) return;
      sfx('key');
      if (k === '⌫') { code = code.slice(0, -1); err.textContent = ''; render(); return; }
      if (code.length >= 6) return;
      code += k; render();
      if (code.length === 6) {
        busy = true; await sleep(350);
        if (code === V().otp) { await loginOk(); }
        else {
          err.textContent = '인증번호가 일치하지 않습니다.';
          sfx('error'); vib(100);
          boxes.classList.remove('hh-shake'); void boxes.offsetWidth; boxes.classList.add('hh-shake');
          await sleep(450); code = ''; render();
        }
        busy = false;
      }
    }
    function onKey(e) {
      if (G.phone.top() !== entry || document.querySelector('.kb.in, .notebook.in, .dialog-wrap')) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
    }
    document.addEventListener('keydown', onKey);
    resend.addEventListener('click', () => { sfx('tap'); sendOtp(); G.phone.toast('인증번호를 다시 보냈습니다'); });
    openMail.addEventListener('click', () => { sfx('tap'); G.phone.openApp('mail'); });
    render();
    const entry = G.phone.push(scr, { onClose: () => document.removeEventListener('keydown', onKey) });
  }
  async function loginOk() {
    sfx('success'); vib([30, 40, 30]);
    const r = await G.phone.dialog({ title: '임시 로그인되었습니다', text: '보안을 위해 비밀번호를 변경하세요.', buttons: [{ label: '나중에', value: 'later' }, { label: '변경하기', value: 'change', style: 'primary' }] });
    if (r === 'change') G.phone.toast('관리자(sagongsa)의 승인이 필요합니다');
    V().m4At = G.clock.now().getTime(); V().hsOtpSent = false; G.save();
    G.flag('M4', true);
    G.bus.emit('haesol:login');
    // back to the app root (dashboard)
    while (G.phone.stackDepth() > 1 && G.phone.top() && G.phone.top().node !== (root && root.scr)) G.phone.pop(true);
    rerender();
  }

  /* =========================================================
   * dashboard
   * ========================================================= */
  function lockState() {
    if (G.flag('M6')) return { cls: 'ok', title: '원격 관리자: 없음', sub: '현관 관리자 잠금 · 키패드에서 관리자 비밀번호 입력 필요 · 관리자 PIN 변경 없음' };
    return { cls: 'bad', title: '원격 관리자 잠금', sub: '설정 02:59 · 요청 SM-G991N · 관리자 PIN 변경 없음' };
  }
  function dashboard() {
    const now = G.clock.now();
    const hero = G.flag('M6')
      ? el('div.hh-hero.ok', null, el('i', { html: IC.shield }), el('div', null, el('b', null, '계정이 보호되었습니다'), el('small', null, '다른 기기 0대 · 외부 비밀번호 입력 차단')))
      : el('div.hh-hero.bad', null, el('i', { html: IC.alert }), el('div', null, el('b', null, '원격 관리자 잠금 중'), el('small', null, '다른 기기(SM-G991N)가 이 집을 관리하고 있습니다')));
    const ls = lockState();
    const sw = el('button.hh-switch' + (G.flag('M6') ? '.on' : ''), { 'aria-label': '원격 잠금 해제', role: 'switch' }, el('i'));
    const door = el('div.hh-tile.wide.door', null,
      el('div.hh-tl', null, el('span.hh-ti.' + ls.cls, { html: G.flag('M6') ? IC.unlock : IC.lock }), el('div', null, el('b', null, '도어락'), el('small', null, '404호 현관'))),
      el('div.hh-door-state.' + ls.cls, null, ls.title),
      el('div.hh-door-sub', null, ls.sub),
      el('div.hh-door-row', null, el('span', null, '원격 잠금 해제'), sw));
    sw.addEventListener('click', (e) => { e.stopPropagation(); remoteUnlock(sw); });
    door.addEventListener('click', () => { sfx('tap'); openSub('door'); });

    const cctvImg = el('div.hh-cctvthumb', { style: { backgroundImage: `url("${IMG(G.flag('M6') ? 'hallway_eps' : 'hallway')}")` } }, el('span.hh-osd', null, 'CAM 04 · 4F'), el('span.hh-rec', null, '● LIVE'));
    const tile = (cls, icon, title, sub, fn, extra) => {
      const t = el('button.hh-tile' + (cls ? '.' + cls : ''), null, el('div.hh-tl', null, el('span.hh-ti', { html: icon }), el('div', null, el('b', null, title), sub ? el('small', null, sub) : null)), extra || null);
      t.addEventListener('click', () => { sfx('tap'); fn(); });
      return t;
    };
    const grid = el('div.hh-grid', null,
      door,
      tile('cctv', IC.cam, 'CCTV', '4F 복도 · 1F 현관', () => openSub('cctv'), cctvImg),
      tile('off', IC.camoff, '실내 카메라', '오프라인', () => openSub('indoor'), el('div.hh-tsub', null, '설치 2025.03.10 · 등록 sagongsa')),
      tile('sensor', IC.sensor, '옷장 문 센서', '설치 2025.03.10', () => openSub('sensor'), el('div.hh-tstate.bad', null, '열림 · 닫히지 않음')),
      tile('', IC.devices, '기기 관리', `기기 ${devices().length}대`, () => openSub('devices'), el('div.hh-tsub' + (G.flag('M6') ? '' : '.warn'), null, G.flag('M6') ? '다른 기기 0대' : '관리자 기기 1대 · SM-G991N')),
      tile('', IC.history, '로그인 기록', '최근 02:58', () => openSub('logins'), el('div.hh-tsub', null, 'SM-G991N · 404호(실내)')),
      tile('bell', IC.bell, '비상벨', G.flag('M6') ? '관리자 잠금 해제 후 1회 사용 가능' : '관리자 잠금 중 사용 불가', () => G.phone.toast(G.flag('M6') ? '비상벨 · 관리자 잠금 해제 후 1회 사용 가능' : '비상벨 · 관리자 잠금 중 사용 불가')),
      (V().mfaStarted || G.flag('M6')) ? tile(G.flag('M6') ? 'safe' : 'warn', IC.shield, '계정 보호', G.flag('M6') ? '보호됨' : `의심스러운 로그인 시도 ${V().mfaSeen || 0}회`, () => openSub('protect')) : null);
    const top = el('div.hh-top', null,
      el('div', null, el('div.hh-home', null, '404호'), el('div.hh-addr', null, `해솔빌 · 서울 마포구 · ${hhmm(now)}`)),
      el('div.hh-topbtns', null,
        el('button', { 'aria-label': '알림', html: IC.bell, onclick: () => { sfx('tap'); openSub('logins'); } }),
        el('button', { 'aria-label': '닫기', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', onclick: () => G.phone.back() })));
    return el('div.hh-dash', null, top, hero, grid, el('div.hh-foot', null, '해솔홈 3.2.1 · 해솔빌 입주민 전용'));
  }
  function openSub(id) {
    ({ door: doorScreen, cctv: cctvScreen, indoor: indoorScreen, sensor: sensorScreen, devices: devicesScreen, logins: loginsScreen, protect: protectScreen }[id] || (() => {}))();
  }
  function sub(title, body, o) {
    o = o || {};
    const scr = G.ui.screen({ title, sub: o.sub || null, theme: 'dark', cls: 'hh-screen hh-sub' + (o.cls ? ' ' + o.cls : ''), body });
    G.phone.push(scr, { onClose: o.onClose, onResume: o.onResume });
    return scr;
  }

  /* ---------------- P6: remote unlock snap-back ---------------- */
  const SNAP_LINES = ['다 보여 ㅎ', '계속 해봐', '그거 누르는 거 다 보여, {N야}'];
  let snapBusy = false;
  async function snapBack(sw, kind) {
    const n = (V().hsSnaps = (V().hsSnaps || 0) + 1); G.save();
    G.bus.emit('haesol:snap', n);
    if (n <= 3) await him(SNAP_LINES[n - 1], 500);
  }
  async function remoteUnlock(sw) {
    if (snapBusy) return;
    sfx('tap');
    if (G.flag('M6')) { G.phone.toast('원격 관리자 잠금이 해제되어 있습니다.', 2600); return; }
    snapBusy = true;
    sw.classList.add('on', 'busy');
    vib(10);
    await sleep(800);
    sw.classList.remove('on');
    doorMotor();
    vib([20, 30, 20]);
    sw.classList.add('nope');
    setTimeout(() => sw.classList.remove('nope', 'busy'), 420);
    if (mirroring()) await snapBack(sw, 'unlock');
    else {
      await G.phone.dialog({ title: '해제할 수 없습니다', text: '원격 관리자 잠금은 잠금을 설정한 관리자 기기(SM-G991N)에서만 해제할 수 있습니다.', buttons: [{ label: '확인', value: true, style: 'primary' }] });
    }
    snapBusy = false;
  }
  // sharp players who cut the screen share before ever trying the unlock
  G.bus.on('flag:M5', () => {
    if ((V().hsSnaps || 0) > 0) return;
    setTimeout(() => { G.phone.toast('…처음부터 보고 있었어.', 3200); note('…처음부터 보고 있었어. 화면 공유로.'); }, 3600);
  });

  /* ---------------- 도어락 detail ---------------- */
  function doorScreen() {
    const body = el('div.hh-pad');
    function render() {
      body.innerHTML = '';
      const ls = lockState();
      const sw = el('button.hh-switch' + (G.flag('M6') ? '.on' : ''), { role: 'switch', 'aria-label': '원격 잠금 해제' }, el('i'));
      sw.addEventListener('click', () => remoteUnlock(sw));
      body.append(
        el('div.hh-big.' + ls.cls, null, el('span', { html: G.flag('M6') ? IC.unlock : IC.lock }), el('div', null, el('b', null, G.flag('M6') ? '관리자 잠금 (현관)' : '잠김 · 관리자 잠금'), el('small', null, ls.sub))),
        el('div.hh-card', null, el('div.hh-row', null, el('span', null, '원격 잠금 해제'), sw)),
        el('div.hh-sec', null, '설정'),
        el('div.hh-card', null,
          el('div.hh-row', null, el('span', null, '원격 관리자'), el('small' + (G.flag('M6') ? '.ok' : '.bad'), null, G.flag('M6') ? '없음' : 'sagongsa · SM-G991N')),
          el('div.hh-row', null, el('span', null, '관리자 PIN'), el('small.bad', null, '변경 없음 (2025.03.10 등록)')),
          el('div.hh-row', null, el('span', null, '보안 모드'), el('small', null, G.flag('M6') ? '외부 비밀번호 입력 차단' : '꺼짐')),
          el('div.hh-row', null, el('span', null, '자동 잠금'), el('small', null, '켜짐'))),
        el('div.hh-sec', null, '최근 기록'),
        el('div.hh-card.log', null,
          (G.flag('M6') ? [[hhmm(new Date(V().m6At || G.clock.now().getTime())), '원격 관리자 잠금 해제 · 계정 보호', 'ok']] : []).concat([
            ['02:59', '원격 관리자 잠금 설정 · 요청 SM-G991N', 'bad'],
            ['02:58', '새 기기 로그인 · SM-G991N'],
            ['2025.11.24 03:30', '실내 키패드 · 관리자 잠금 (사용자: 관리자)', 'bad'],
            ['2025.11.20 03:33', '실내 키패드 · 관리자 잠금 설정 → 07:00 해제'],
            ['2025.03.10 15:20', '관리자 등록 · sagongsa'],
          ]).map(([t, s, c]) => el('div.hh-log' + (c ? '.' + c : ''), null, el('small', null, t), el('span', null, s)))));
    }
    render();
    sub('도어락', body, { sub: '404호 현관', onResume: render });
  }

  /* ---------------- CCTV ---------------- */
  function cctvScreen() {
    let cam = 'cam4', iv = null;
    const view = el('div.hh-cctv');
    const tabs = el('div.hh-camtabs');
    const events = el('div.hh-card.log');
    const body = el('div.hh-pad.cctvbody', null, tabs, view, el('div.hh-sec', null, '움직임 기록'), events);
    function render() {
      tabs.innerHTML = '';
      [['cam4', 'CAM 04 · 4F 복도'], ['cam1', 'CAM 01 · 1F 현관']].forEach(([k, l]) => { const b = el('button' + (cam === k ? '.on' : ''), null, l); b.addEventListener('click', () => { sfx('tap'); cam = k; render(); }); tabs.appendChild(b); });
      view.innerHTML = '';
      const src = cam === 'cam4' ? IMG(G.flag('M6') ? 'hallway_eps' : 'hallway') : IMG('building');
      const img = el('img.hh-cimg' + (cam === 'cam1' ? '.c1' : ''), { src, alt: '' });
      img.onerror = () => img.remove();
      const osd = el('span.hh-osd');
      [img, cam === 'cam1' ? el('div.hh-rain') : null, el('div.hh-cnoise'), el('div.hh-scan'), osd, el('span.hh-rec', null, '● REC'), el('span.hh-osd2', null, cam === 'cam4' ? 'IR · 1080p' : 'IR · 720p')].forEach((n) => { if (n) view.appendChild(n); });
      const tick = () => { const d = G.clock.now(); osd.textContent = `${cam === 'cam4' ? 'CAM 04 · 4F 복도' : 'CAM 01 · 1F 현관'} · 2026-11-24 ${hhmmss(d)}`; };
      tick(); clearInterval(iv); iv = setInterval(tick, 1000);
      events.innerHTML = '';
      const ev = cam === 'cam4'
        ? (G.flag('M6') ? [[hhmm(new Date((V().m6At || G.clock.now().getTime()) + 40000)), '움직임 감지 · EPS실 문 앞', 'bad']] : []).concat([['02:41', '움직임 감지 · 404호 앞'], ['00:09', '움직임 감지 · EPS실 문 앞'], ['어제 23:12', '움직임 감지 · 엘리베이터']])
        : [['01:52', '움직임 감지 · 공동현관 (배달)'], ['어제 23:40', '움직임 감지 · 공동현관']];
      ev.forEach(([t, s, c]) => events.appendChild(el('div.hh-log' + (c ? '.' + c : ''), null, el('small', null, t), el('span', null, s))));
      if (cam === 'cam4' && G.flag('M6') && !G.flag('epsSeen')) { G.flag('epsSeen', true); setTimeout(() => note('CCTV — 404호 옆 EPS실 문이 열려 있다.'), 1200); }
    }
    render();
    try { G.audio && G.audio.amb && G.audio.amb('hallway', true); } catch (e) {}
    sub('CCTV', body, { sub: '실시간', cls: 'cctv', onClose: () => { clearInterval(iv); try { G.audio && G.audio.amb && G.audio.amb('hallway', false); } catch (e) {} } });
  }

  function indoorScreen() {
    const status = el('div.hh-offmsg', null, el('i', { html: IC.camoff }), el('b', null, '카메라 오프라인'), el('small', null, '마지막 연결: 2025.11.24 03:31'));
    const view = el('div.hh-cctv.off', null, el('div.hh-cnoise.strong'), status);
    const retry = el('button.hh-btn.sec', null, '다시 연결');
    retry.addEventListener('click', async () => {
      sfx('tap'); retry.classList.add('loading'); retry.textContent = '';
      await sleep(1600);
      retry.classList.remove('loading'); retry.textContent = '다시 연결';
      G.phone.toast('카메라에 연결할 수 없습니다');
    });
    const body = el('div.hh-pad', null, view,
      el('div.hh-card', null,
        el('div.hh-row', null, el('span', null, '상태'), el('small.bad', null, '오프라인')),
        el('div.hh-row', null, el('span', null, '설치'), el('small', null, '2025.03.10')),
        el('div.hh-row', null, el('span', null, '등록'), el('small.bad', null, 'sagongsa')),
        el('div.hh-row', null, el('span', null, '위치'), el('small', null, '404호 · 붙박이장 위'))),
      retry);
    sub('실내 카메라', body, { sub: '404호' });
  }

  /* ---------------- 옷장 문 센서 · 이벤트 로그 (look-away log, §6.4) ---------------- */
  function sensorLines() {
    const lines = [
      { t: new Date(2026, 10, 24, 2, 47, 10), s: T('옷장 문 열림 ({N} 수면 중)'), c: 'open' },
      { t: new Date(2026, 10, 24, 2, 51, 44), s: '옷장 문 닫힘' },
      { t: new Date(2026, 10, 24, 3, 33, 41), s: '세아의 Galaxy 화면 켜짐', c: 'scr' },
    ];
    (V().lookLog || []).forEach((e) => {
      const t0 = +e.t, dur = Math.max(1500, +e.dur || 0);
      const open = Math.min(2000, dur * 0.4);
      lines.push({ t: new Date(t0), s: '세아의 Galaxy 화면 꺼짐', c: 'scr' });
      lines.push({ t: new Date(t0 + open), s: '옷장 문 열림', c: 'open' });
      lines.push({ t: new Date(t0 + Math.max(open + 500, dur - 600)), s: '옷장 문 닫힘' });
      lines.push({ t: new Date(t0 + dur + 1000), s: '세아의 Galaxy 화면 켜짐', c: 'scr' });
    });
    lines.sort((a, b) => a.t - b.t);
    return lines;
  }
  function sensorScreen() {
    const logEl = el('div.hh-term');
    const body = el('div.hh-pad', null,
      el('div.hh-big.bad', null, el('span', { html: IC.sensor }), el('div', null, el('b', null, '열림'), el('small', null, '현재 상태 · 배터리 64%'))),
      el('div.hh-card', null,
        el('div.hh-row', null, el('span', null, '설치'), el('small', null, '2025.03.10')),
        el('div.hh-row', null, el('span', null, '등록'), el('small.bad', null, 'sagongsa')),
        el('div.hh-row', null, el('span', null, '알림'), el('small', null, '관리자에게만'))),
      el('div.hh-sec', null, '이벤트 로그 · 2026.11.24 (화)'),
      logEl);
    let iv = null;
    function render() {
      logEl.innerHTML = '';
      sensorLines().forEach((l) => logEl.appendChild(el('div.hh-tl2' + (l.c ? '.' + l.c : ''), null, el('small', null, hhmmss(l.t)), el('span', null, l.s))));
      const last = el('div.hh-tl2.open.last', null, el('small'), el('span', null, '옷장 문 열림 · 닫히지 않음'));
      logEl.appendChild(last);
      const tick = () => { last.querySelector('small').textContent = hhmmss(new Date(G.clock.now().getTime() - 3000)); };
      tick(); clearInterval(iv); iv = setInterval(tick, 1000);
      requestAnimationFrame(() => { const sv = logEl.closest('.sv-body'); if (sv) sv.scrollTop = sv.scrollHeight; });
    }
    render();
    sub('옷장 문 센서', body, { sub: '404호 · 붙박이장', onResume: render, onClose: () => clearInterval(iv) });
    if (!G.flag('sensorLogSeen')) G.flag('sensorLogSeen', true);
    G.bus.emit('haesol:sensorLog');
  }

  /* ---------------- 로그인 기록 ---------------- */
  function loginsScreen() {
    const rows = [];
    if (G.flag('M4')) rows.push(['2026.11.24 ' + hhmm(new Date(V().m4At || G.clock.now().getTime())), '세아의 Galaxy · 이 기기', '404호 · 임시 로그인']);
    rows.push(['2026.11.24 02:58', 'SM-G991N · sagongsa', '404호(실내)', 'bad'], ['2025.11.25 04:02', 'SM-G991N · sagongsa', '404호(실내)', 'bad'], ['2025.11.20 03:31', '세아의 Galaxy', '404호'], ['2025.03.10 15:20', 'SM-G991N · sagongsa (최초 등록)', '404호', 'bad'], ['2024.09.01 21:02', '세아의 Galaxy (최초 등록)', '404호']);
    const body = el('div.hh-pad', null, el('div.hh-card.log', null, rows.map(([t, d, w, c]) => el('div.hh-log2' + (c ? '.' + c : ''), null, el('b', null, d), el('small', null, `${t} · ${w}`)))),
      el('div.hh-note', null, '내가 로그인하지 않았다면 기기 관리에서 해당 기기를 차단하세요.'));
    sub('로그인 기록', body);
  }

  /* =========================================================
   * P7 — 기기 관리 · 차단 · MFA bombing
   * ========================================================= */
  function devices() {
    const list = [
      { id: 'me', name: '세아의 Galaxy', sub: '이 기기 · 404호 · 접속 중', icon: IC.phone, self: true },
      { id: 'hub', name: '거실 허브', sub: '404호 · 온라인', icon: IC.hub },
      { id: 'robot', name: '로봇청소기 콩콩이', sub: '404호 · 오프라인', icon: IC.robot, off: true },
      { id: 'sensor', name: '옷장 문 센서', sub: '404호 · 온라인', icon: IC.sensor },
    ];
    if (!G.flag('M6')) list.push({ id: 'sagongsa', name: 'sagongsa', sub: 'Galaxy S21 (SM-G991N) · 404호(실내) · 마지막 접속 방금', icon: IC.phone, admin: true });
    return list;
  }
  let devRender = null;
  function devicesScreen() {
    const body = el('div.hh-pad');
    function render() {
      body.innerHTML = '';
      const card = el('div.hh-card.devs');
      devices().forEach((d) => {
        const blk = d.self ? el('span.hh-tag', null, '이 기기') : el('button.hh-block', null, '차단');
        const row = el('div.hh-dev' + (d.admin ? '.admin' : '') + (d.off ? '.off' : ''), { dataset: { id: d.id } },
          el('span.hh-di', { html: d.icon }),
          el('div.hh-dm', null, el('b', null, d.name, d.admin ? el('em', null, '관리자') : null), el('small', null, d.sub)),
          blk);
        if (!d.self) blk.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); block(d, row); });
        row.addEventListener('click', () => { sfx('tap'); devDetail(d); });
        card.appendChild(row);
      });
      body.appendChild(card);
      if (G.flag('M6')) body.appendChild(el('div.hh-note.ok', null, '✔ 차단된 기기: sagongsa · Galaxy S21 (SM-G991N)'));
      else body.appendChild(el('div.hh-note', null, '모르는 기기가 있다면 차단하세요. 차단된 기기는 이 집의 기기를 제어할 수 없습니다.'));
    }
    render();
    devRender = render;
    sub('기기 관리', body, { sub: `404호 · ${devices().length}대`, onResume: render, onClose: () => { devRender = null; } });
    G.bus.emit('haesol:devices');
  }
  function devDetail(d) {
    const rows = d.id === 'sagongsa'
      ? [['모델', 'Galaxy S21 (SM-G991N)'], ['계정', 'sagongsa'], ['권한', '관리자'], ['위치', '404호(실내)'], ['등록', '2025.03.10 15:20'], ['마지막 접속', '방금']]
      : d.self ? [['모델', 'Galaxy S23 (SM-S911N)'], ['계정', 'seah.y'], ['권한', '일반 (임시 로그인)'], ['위치', '404호']]
        : [['종류', d.name], ['위치', '404호'], ['상태', d.off ? '오프라인' : '온라인'], ['등록', d.id === 'sensor' ? '2025.03.10 · sagongsa' : '2024.09.01 · seah.y']];
    G.phone.dialog({ title: d.name, html: true, text: rows.map(([k, v]) => `<div class="hh-dlgrow"><span>${k}</span><b${/관리자|sagongsa|실내/.test(v) ? ' class="bad"' : ''}>${G.util.esc(v)}</b></div>`).join(''), buttons: [{ label: '닫기', value: true, style: 'primary' }] });
  }
  let blockBusy = false;
  async function block(d, row) {
    if (blockBusy || mfaRunning) return;
    const ok = await G.phone.dialog({ title: `'${d.name}' 기기를 차단할까요?`, text: d.id === 'sagongsa' ? '이 기기의 해솔홈 접근 권한과 관리자 권한이 즉시 해제됩니다.' : '차단된 기기는 이 집의 기기를 제어할 수 없습니다.', buttons: [{ label: '취소', value: false }, { label: '차단', value: true, style: 'danger' }] });
    if (!ok) return;
    blockBusy = true;
    if (d.id !== 'sagongsa') {
      row.classList.add('blocked'); row.querySelector('small').textContent = '차단됨';
      G.phone.toast('차단 완료');
      await sleep(1000);
      G.phone.toast('관리자 잠금 유지 · 요청 기기 SM-G991N', 2600);
      if (mirroring()) him('그거 아닌데 ㅎ', 600);
      else sfx('knock', 1, { az: 270, where: 'inside', vol: 0.55 });
      await sleep(1600);
      row.classList.remove('blocked'); row.querySelector('small').textContent = d.sub;
      G.bus.emit('haesol:block', { id: d.id, ok: false });
      blockBusy = false;
      return;
    }
    // his device
    if (mirroring()) {
      row.classList.add('pending'); row.querySelector('small').textContent = '차단 중…';
      await sleep(800);
      row.classList.remove('pending'); row.classList.add('nope'); row.querySelector('small').textContent = d.sub;
      setTimeout(() => row.classList.remove('nope'), 420);
      doorMotor();
      G.phone.toast('차단이 취소되었습니다 · 관리자 기기에서 거부함', 2400);
      await snapBack(null, 'block');
      G.bus.emit('haesol:block', { id: d.id, ok: false, mirroring: true });
      blockBusy = false;
      return;
    }
    row.classList.add('blocked'); row.querySelector('small').textContent = '차단됨 · 로그아웃 중…';
    G.phone.toast('차단 완료');
    G.bus.emit('haesol:block', { id: d.id, ok: true });
    note('sagongsa(SM-G991N)를 차단했다.');
    await sleep(2000);
    blockBusy = false;
    startMFA();
  }

  let mfaRunning = false;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  async function startMFA() {
    if (mfaRunning) return;
    mfaRunning = true;
    V().mfaStarted = true; G.save();
    try { G.director && G.director.hold && G.director.hold('mfa', true); } catch (e) {}
    const assist = (V().mfaFails || 0) >= 2;
    const TIMES = assist ? [8, 8, 8, 8, 8] : [7, 6, 5, 4, 3];
    const dots = el('div.hh-mfadots', null, Array.from({ length: 5 }, () => el('i')));
    const cardHost = el('div.hh-mfahost');
    // (the notebook FAB sits above overlays, so the 수첩 stays reachable during the bombing)
    const wrap = el('div.mfa.hh-mfa' + (assist ? '.assist' : ''), null, el('div.hh-mfabg'), cardHost, el('div.hh-mfafoot', null, el('span', null, '거부함'), dots));
    const ov = G.phone.overlay(wrap, { modal: 'hard' });
    const restoreStatus = statusOverlay();
    let denied = 0, failed = false, baited = false, bpm = 82;
    const gsm = (p) => { try { if (G.flag('M5') && G.audio && G.audio.gsm) G.audio.gsm(p); } catch (e) {} };
    G.bus.emit('haesol:mfa', 'start');
    await sleep(350);
    while (denied < 5 && !failed) {
      const i = denied;
      V().mfaSeen = Math.max(V().mfaSeen || 0, i + 1); G.save();
      bpm += 10;
      const r = await prompt(i, TIMES[i]);
      if (r === 'deny') {
        denied++;
        dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k < denied));
        sfx('back');
        await sleep(assist ? 1100 : 700);
      } else if (r === 'timeout') {
        // the request just gets re-sent — never a fail
        await sleep(350);
      } else failed = true;
    }
    async function prompt(i, sec) {
      return new Promise((resolve) => {
        const numberMatch = i === 2;
        let done = false;
        const finish = (v) => { if (done) return; done = true; clearTimeout(tm); card.classList.add('out'); setTimeout(() => card.remove(), 260); resolve(v); };
        const bar = el('div.hh-mfabar', null, el('i'));
        const head = el('div.hh-mfahead', null, el('span.hh-mfaic', { html: IC.logo }), el('b', null, '해솔홈'), el('small', null, '지금'));
        let content, btns;
        if (!numberMatch) {
          const deny = el('button.hh-mb.deny', null, '거부');
          const allow = el('button.hh-mb.allow', null, '허용');
          deny.addEventListener('click', () => { sfx('tap'); finish('deny'); });
          allow.addEventListener('click', () => { sfx('tap'); finish('allow'); });
          btns = el('div.hh-mbtns', null, assist ? [deny, allow] : shuffle([deny, allow]));
          content = el('div', null, el('div.hh-mfat', null, '해솔홈 로그인 요청'), el('div.hh-mfal', null, '기기: SM-G991N · 서울 마포구'), el('div.hh-mfal.near', null, '요청 위치: 이 기기로부터 1m 이내'));
        } else {
          const msg = el('div.hh-mfal.err');
          const nums = (assist ? ['47', '18', '92'] : shuffle(['47', '18', '92'])).map((n) => {
            const b = el('button.hh-mnum', null, n);
            b.addEventListener('click', () => {
              sfx('tap');
              if (n === '47') { finish('allow47'); return; }
              card.classList.remove('hh-shake'); void card.offsetWidth; card.classList.add('hh-shake');
              msg.textContent = '숫자가 일치하지 않습니다.'; sfx('error');
            });
            return b;
          });
          const notMe = el('button.hh-mb.deny.wide', null, '요청하지 않았어요');
          notMe.addEventListener('click', () => { sfx('tap'); finish('deny'); });
          btns = el('div', null, el('div.hh-mnums', null, nums), msg, el('div.hh-mbtns', null, notMe));
          content = el('div', null, el('div.hh-mfat', null, '해솔홈 로그인 요청'), el('div.hh-mfal', null, '다른 기기에 표시된 숫자를 선택하세요'), el('div.hh-mfal.near', null, '요청 위치: 이 기기로부터 1m 이내'));
          if (!baited) { baited = true; setTimeout(() => { him('47 눌러. 그럼 문 열어줄게.', 300); gsm(0.85); setTimeout(() => gsm(0.4), 1600); }, 700); }
        }
        const card = el('div.hh-mfacard', null, bar, head, content, btns);
        cardHost.appendChild(card);
        requestAnimationFrame(() => card.classList.add('in'));
        sfx('mfaAlert'); vib([90, 60, 90]);
        sfx('heartbeat', bpm, Math.max(3, Math.round((sec * bpm) / 60)));
        gsm(0.55 + i * 0.07); setTimeout(() => gsm(0.4), 900);
        const fill = bar.querySelector('i');
        fill.style.transition = 'none'; fill.style.transform = 'scaleX(1)';
        requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transition = `transform ${sec}s linear`; fill.style.transform = 'scaleX(0)'; }));
        const tm = setTimeout(() => finish('timeout'), (numberMatch ? sec + 3 : sec) * 1000);
      });
    }
    // result
    if (!failed) {
      const card = el('div.hh-mfacard.big', null,
        el('div.hh-mfaic2.warn', { html: IC.shield }),
        el('div.hh-mfat', null, '의심스러운 로그인 시도 5회'),
        el('div.hh-mfal', null, '계정을 보호할까요?'),
        el('div.hh-mbtns', null, el('button.hh-mb.primary.wide', null, '보호하기')));
      cardHost.appendChild(card); requestAnimationFrame(() => card.classList.add('in'));
      sfx('notify');
      await new Promise((r) => card.querySelector('button').addEventListener('click', () => { sfx('tap'); r(); }, { once: true }));
      const items = ['다른 모든 기기에서 로그아웃되었습니다', '원격 관리자 잠금이 해제되었습니다', '도어락 보안 모드: 외부 비밀번호 입력 차단', '네트워크 제한이 해제되었습니다'];
      card.innerHTML = '';
      card.append(el('div.hh-mfaic2.ok', { html: IC.shield }), el('div.hh-mfat', null, '계정 보호 중…'));
      const list = el('div.hh-checks'); card.appendChild(list);
      gsm(0.15);
      for (const t of items) { await sleep(520); const r = el('div.hh-check', null, el('i', { html: IC.check }), el('span', null, t)); list.appendChild(r); requestAnimationFrame(() => r.classList.add('in')); sfx('tap'); vib(15); }
      card.querySelector('.hh-mfat').textContent = '계정이 보호되었습니다';
      protect();
      await sleep(500);
      const okB = el('button.hh-mb.primary.wide', null, '확인');
      card.appendChild(el('div.hh-mbtns', null, okB));
      await new Promise((r) => okB.addEventListener('click', () => { sfx('tap'); r(); }, { once: true }));
      ov.close();
      G.bus.emit('haesol:mfa', 'protected');
    } else {
      const card = el('div.hh-mfacard.big', null, el('div.hh-mfaic2.ok', { html: IC.check }), el('div.hh-mfat', null, '로그인 승인됨'), el('div.hh-mfal', null, 'SM-G991N 기기에서 로그인했습니다.'));
      cardHost.appendChild(card); requestAnimationFrame(() => card.classList.add('in'));
      sfx('doorlockAdmin');
      await sleep(1500);
      ov.close();
      V().mfaFails = (V().mfaFails || 0) + 1; G.save();
      G.phone.toast('관리자 잠금 재설정 (SM-G991N)', 2600);
      doorMotor();
      await sleep(700);
      him('고마워 {N야} ㅎ', 900);
      G.bus.emit('haesol:mfa', 'fail');
    }
    restoreStatus();
    try { G.director && G.director.hold && G.director.hold('mfa', false); } catch (e) {}
    mfaRunning = false;
    if (devRender) devRender();
    rerender();
  }
  function protect() {
    V().remoteAdmin = 'none'; V().m6At = G.clock.now().getTime(); G.save();
    G.flag('netFree', true);
    G.flag('M6', true);
    G.phone.notify({ app: 'haesol', title: '계정이 보호되었습니다', body: '원격 관리자 잠금 해제' });
    note('계정 보호 완료. 원격 관리자 없음.');
    G.phone.refreshBadges && G.phone.refreshBadges();
  }
  H.startMFA = startMFA;
  H.mfaActive = () => mfaRunning; // read by G.OBJECTIVES (P7mfa hints while the bombing runs)

  function protectScreen() {
    const body = el('div.hh-pad');
    if (G.flag('M6')) {
      body.append(el('div.hh-big.ok', null, el('span', { html: IC.shield }), el('div', null, el('b', null, '보호됨'), el('small', null, '다른 기기 0대 · 원격 관리자 없음'))),
        el('div.hh-card', null, ['다른 모든 기기에서 로그아웃되었습니다', '원격 관리자 잠금이 해제되었습니다', '도어락 보안 모드: 외부 비밀번호 입력 차단', '네트워크 제한이 해제되었습니다'].map((t) => el('div.hh-check.in', null, el('i', { html: IC.check }), el('span', null, t)))));
    } else {
      body.append(el('div.hh-big.bad', null, el('span', { html: IC.alert }), el('div', null, el('b', null, `의심스러운 로그인 시도 ${V().mfaSeen || 0}회`), el('small', null, '요청 기기: SM-G991N · 1m 이내'))),
        el('div.hh-note', null, '내가 요청하지 않은 로그인 승인 요청은 모두 [거부]하세요. 기기 관리에서 기기를 차단하면 다시 확인할 수 있습니다.'));
    }
    sub('계정 보호', body);
  }

  /* =========================================================
   * P8 — 비상벨 (climax step 9). Resolves after a 2 s hold.
   * ========================================================= */
  G.hooks.set('haesol:openBell', function () {
    return new Promise((resolve) => {
      const R = 54, C = 2 * Math.PI * R;
      const ring = el('div.hh-bellring', { html: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" class="bg"/><circle cx="60" cy="60" r="${R}" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>` });
      const btn = el('button.hh-bellbtn', { 'aria-label': '비상벨' }, ring, el('span.hh-bellic', { html: IC.bell }));
      const status = el('div.hh-bellstatus', null, '2초간 길게 눌러 호출');
      const wrap = el('div.hh-bell', null,
        el('div.hh-bellhead', null, el('i', { html: IC.logo }), el('b', null, '해솔홈'), el('small', null, '404호')),
        el('div.hh-belltitle', null, '비상벨'),
        el('div.hh-bellsub', null, '관리자 잠금이 해제되어 1회 사용할 수 있습니다'),
        btn, status,
        el('div.hh-bellfoot', null, '경비실 · 관리사무소로 바로 연결됩니다'));
      const ov = G.phone.overlay(wrap, { modal: 'hard' });
      const restoreStatus = statusOverlay();
      sfx('notify'); vib([60, 40, 60]);
      G.flag('bellShown', true);
      const fg = ring.querySelector('.fg');
      let t0 = 0, raf = 0, done = false, holding = false;
      function frame(now) {
        if (!holding || done) return;
        const k = clamp((now - t0) / 2000, 0, 1);
        fg.style.strokeDashoffset = String(C * (1 - k));
        if (k >= 1) { complete(); return; }
        raf = requestAnimationFrame(frame);
      }
      function down(e) {
        if (done || holding) return;
        if (e && e.preventDefault) e.preventDefault();
        holding = true; t0 = performance.now();
        btn.classList.add('hold'); status.textContent = '누르고 있어요…';
        vib(30); sfx('tap');
        raf = requestAnimationFrame(frame);
      }
      function up() {
        if (!holding || done) return;
        holding = false; cancelAnimationFrame(raf);
        btn.classList.remove('hold');
        fg.style.transition = 'stroke-dashoffset .3s'; fg.style.strokeDashoffset = String(C);
        setTimeout(() => { fg.style.transition = ''; }, 320);
        status.textContent = '2초간 길게 눌러 호출';
      }
      async function complete() {
        done = true; holding = false;
        btn.classList.remove('hold'); btn.classList.add('fired');
        status.textContent = '호출 중… 경비실에 연결합니다';
        vib([200, 80, 200]);
        G.flag('bellPressed', true);
        G.bus.emit('haesol:bell');
        document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku);
        await sleep(700);
        ov.close(); restoreStatus();
        resolve(true);
      }
      btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch (er) {} down(e); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, up));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      const kd = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) down(); } };
      const ku = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); up(); } };
      document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
    });
  });
})();
