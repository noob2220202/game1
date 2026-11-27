/* =========================================================
 * ep2/js/e2.js — episode-2 state helpers (core · ARCH_EP2 §4.5 · DESIGN_EP2 §2.1 §2.4 §3.20 §9.2 §9.3 §9.5-5)
 *
 * G.e2 (alias window.E2)
 *   identity/text   maker() makerHandle() makerAvatar() less() speaker() img(key) STR MONO
 *   facts           factCount() facts() dashCount()
 *   milestones      requestM2(reason) nUiVisible() m4Ready() m5DueAt() m6DueAt() sirenDueAt()
 *   scheduler       sched.at(pm,id,data) .after(ms,id,data) .cancel(id|'prefix*') .has(id) .when(id) .on(idOrPrefix, fn)
 *   monologue       mono(id) → Promise<bool>
 *   answers         norm(s) answerOk(s) whereOk(s)
 *   formatting      fmt12('05:39') fmtK(date) ymd(date) clamp(x,a,b)
 *   series          cbPreview cb(key) ep2Done seriesBoot() seriesStart() commit(opts?) hookPatch() stage(key, value)
 *   misc            session.set/get/clear · world() · lowEnd() · init()
 * G.sd — shared helpers for story-data apps (moved from ep1 js/data/talk.js): T img bg imgEl tone(no-op) isSafe waitSafe
 *   statusOverlay dayLabel rng pd ymd day + note/lead (no-ops).
 * window.haru (DEBUG only, created at load): state flags vars flag fact jump time clearSave clearSeries series type
 *   answer answerTable budget.
 * Flags set here: M2 M4 M5 factDash mono1–mono4 (M6 only as the stub when G.climax is absent).
 * Vars set here: factCount snow m5HoldPm sched e2 replay committed commitTries patched (+ climax.m6DuePm).
 * Bus emitted: 'm6:due' {prelude} · 'mono:show' {id} · 'mono:hide' {id}.
 * Bus listened: flag · users:switched · lock:unlock · home:show · clock:min · clock:jump · screen:push · state:load.
 * This is the only ep2 file that talks to the series engine (DESIGN §10 G grep rule).
 * ========================================================= */
(function () {
  'use strict';
  const W = window;
  const G = (W.G = W.G || {});
  const E2 = (G.e2 = G.e2 || {});
  W.E2 = E2;
  if (G.DEBUG) W.haru = W.haru || {};            // created at load so later files can add their helpers (ARCH §6.2)

  const bus = G.bus || { on() { return () => {}; }, emit() {} };
  const CFG = () => W.CONFIG || {};
  const pmNow = () => (G.state ? G.state.playMs : 0);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const warned = {};
  const dwarn = (k, ...a) => { if (!G.DEBUG || warned[k]) return; warned[k] = 1; console.warn('[e2]', ...a); };
  const flag = (n) => !!(G.flag && G.flag(n));
  const pm = (n) => (G.pm ? G.pm(n) : null);
  const ES = () => { const v = G.state.vars; if (!v.e2 || typeof v.e2 !== 'object') v.e2 = {}; return v.e2; };

  /* ---------------- system strings (§10 A whitelist — ARCH §4.5) ---------------- */
  E2.STR = {
    pinWrong: 'PIN이 올바르지 않습니다',
    pinLock: '{s}초 후에 다시 시도하세요',
    verify: '지문을 대거나 PIN을 입력하세요',
    verifyTitle: '본인 확인',
    pinCurrent: '현재 PIN을 입력하세요',
    fpDeleteQ: '이 지문을 삭제할까요?',
    noSimEmergency: 'SIM 없음 · 긴급 통화를 연결할 수 없습니다',
    noSimCall: 'SIM 없음 · 전화를 걸 수 없습니다',
    connecting: '연결 중…',
    btConnected: '연결됨 · 미디어 오디오',
    btCut: '2층_스피커 연결 끊김',
    btNotFound: '기기를 찾을 수 없습니다',
    switching: '사용자 전환 중…',
    sendFail: 'ⓘ 전송되지 않음',
    smsSent: '인증번호를 문자로 보냈습니다',
    unrestricted: '{MAKER_CONTACT}님을 제한 해제했습니다.',
    noReadReceipt: '상대방에게 읽음 표시가 전송되지 않습니다',
    restrictedNote: '이 계정은 제한되어 있습니다. 제한을 해제하면 메시지가 받은 메시지함으로 이동합니다.',
    restrictedBar: '제한한 계정입니다',
    newAcctSend: '새 계정을 보호하기 위해 일부 활동이 제한됩니다. 이 기기에서는 메시지를 보낼 수 없습니다.',
    newAcctLimit: '새 계정을 보호하기 위해 일부 활동이 제한됩니다.',
    activityTitle: '활동 제한',
    activity: '비정상적인 로그인 활동이 감지되어 12월 26일까지 게시물과 댓글을 올릴 수 없습니다. 메시지는 보낼 수 있습니다.',
    tlPaused: '이 시간에는 위치 기록이 일시 중지되었습니다',
    tlNone: '이 날짜에는 기록이 없습니다',
    mailSync: '계정이 없어 동기화할 수 없습니다 · 마지막 동기화 2026.12.24 18:02',
    talkOut: '다른 기기에서 로그인되어 로그아웃되었습니다 · 2026.11.25',
    reqAccepted: '메시지 요청을 수락했습니다 · 오후 7:21',
    wipe: '원격 초기화 중… (요청: 다른 기기)',
    frp: '이전 계정 인증 — 인증 코드를 문자로 보냈습니다',
    share: '강수진의 휴대전화 · 사진 4개를 보내려고 합니다',
    exitAgain: '한 번 더 누르면 종료됩니다',
    noSwitch: '이 사용자로 전환할 수 없습니다',
    addUserQ: '새 사용자를 추가할까요?',
    addUserNeed: '사용자를 추가하려면 다온 계정이 필요합니다.',
    needDaon: '다온 계정이 필요합니다',
    codeWrong: '인증번호가 일치하지 않습니다.',
    talkNoSend: '로그아웃 상태에서는 메시지를 보낼 수 없습니다.',
    mailNoOpen: '계정이 없어 열 수 없습니다',
    newDeviceCode: '새 기기에서 로그인하려면 문자로 받은 인증 코드가 필요합니다',
    offline: '인터넷에 연결되어 있지 않습니다',
    seahOnly: 'seah_y님은 팔로우하는 계정의 메시지만 받습니다.',
    blockQ: '{MAKER_CONTACT}님을 차단할까요?',
    blocked: '차단한 계정입니다',
    reported: '신고해 주셔서 감사합니다.',
    wifiDelQ: 'saemal_rooftop 네트워크를 삭제할까요?',
    pwEnter: '비밀번호 입력',
    trustNetDelQ: '신뢰할 수 있는 네트워크에서 삭제할까요?',
    trustDevDelQ: '신뢰할 수 있는 기기에서 삭제할까요?',
    btDisconnectQ: '연결을 끊을까요?',
    noDevices: '주변에 기기가 없습니다',
    fpAdded: '지문이 등록되었습니다',
    fpTouch: '화면의 지문 아이콘에 손가락을 대세요',
    fpTouchMany: '화면의 지문 아이콘에 손가락을 여러 번 대세요',
    ghost: '원본을 불러올 수 없습니다 · 계정 없음',
    noResult: "'{q}'에 대한 검색 결과가 없습니다.",
    noResultMoment: "'{q}'에 대한 결과가 없습니다.",
    cloudLogin: '다온 클라우드 · 로그인이 필요합니다',
    resume: '🔈 소리 다시 켜기',
    soundCard: '소리가 들리지 않으면 무음 모드를 끄고 볼륨을 올려 주세요.',
    restart2: '진행 상황이 지워집니다.',
    unplayed: '재생 안 됨',
    loading: '불러오는 중…',
    recanonQ: '이번 선택으로 바꿀까요?',
  };
  Object.freeze(E2.STR);

  /* ---------------- monologue lines (§2.4 · §4.9.3 · §4.0 recap) ---------------- */
  E2.MONO = {
    mono1: '…내 폰인데, 내가 모르는 내가 있다.',
    mono2: '…한 달 동안, 내 폰 안에 그 사람이 살았다.',
    mono3: '…진짜다.',
    mono4: '…세아?',
    recap: ['지난달 24일, 404호. 옷장 뒤에 그 사람이 있었다.', '나는 세아의 폰으로 문을 열고 나왔다.',
      '세아는 아직 돌아오지 않았다. 그 사람도 잡히지 않았다.', '그리고 내 폰은, 그 사람이 가져갔다.'],
  };

  /* ---------------- identity / text ---------------- */
  E2.maker = function () {
    const c = CFG();
    const mc = typeof c.MAKER_CONTACT === 'string' ? c.MAKER_CONTACT.trim() : '';
    if (mc) return mc;
    const mn = typeof c.MAKER_NAME === 'string' ? c.MAKER_NAME.trim() : '';
    return !mn || mn === '너의 친구' ? '친구' : mn;
  };
  E2.makerHandle = () => { const h = CFG().MAKER_HANDLE; return typeof h === 'string' ? h.trim().replace(/^@/, '') : ''; };
  E2.makerAvatar = function () {
    const a = CFG().MAKER_AVATAR;
    if (typeof a !== 'string' || !a.trim()) return '';
    const s = a.trim();
    if (/^(https?:|data:|blob:|\/|\.\.\/)/i.test(s)) return s;
    return '../' + s.replace(/^\.\//, '');                        // root-relative (js/config.js) → from ep2/index.html
  };
  E2.less = () => !!(G.settings && G.settings.scares !== 'full');
  E2.speaker = () => !!(G.settings && (G.settings.audioMode === 'speaker' || G.settings.sound === false));

  const E1_REUSE = /^(avatar_jimin|avatar_sea|kongi_old|sea_orgel_live|icon|mo_[a-z0-9_]+|dog_[a-z0-9_]+)$/;
  E2.img = function (key) {
    if (!key) return '';
    key = String(key);
    if (G.IMG && G.IMG[key]) return G.IMG[key];
    if (/[/.]/.test(key)) return key;                             // raw path passes through
    if (E1_REUSE.test(key)) return '../assets/img/' + key + (key === 'icon' ? '.png' : '.jpg');
    const png = /^(p_|js_|m_|door_handle|icon)/.test(key) || /_mask$/.test(key);
    return 'assets/img/' + key + (png ? '.png' : '.jpg');
  };

  /* ---------------- facts ---------------- */
  const FACTS = ['factSmart', 'factFinger', 'factKbd', 'factCbs', 'factJimin', 'factDash'];
  const DASH6 = ['dashMemo', 'dashA0310', 'dashARoof', 'dashHidden', 'dashMoment', 'dashUsers'];
  E2.facts = () => { const o = {}; FACTS.forEach((f) => { o[f] = flag(f); }); return o; };
  E2.factCount = () => FACTS.filter(flag).length;
  E2.dashCount = () => DASH6.filter(flag).length;
  function recomputeFacts() {
    if (!flag('factDash') && E2.dashCount() >= 3) G.flag('factDash', true);   // re-enters via the 'flag' listener
    const fc = E2.factCount();
    if (G.vars('factCount') !== fc) G.vars('factCount', fc);
  }

  /* ---------------- users / visibility helpers ---------------- */
  const curUser = () => { try { if (G.users && G.users.current) return G.users.current(); } catch (e) {} return (G.state.vars.user) || 'n'; };
  E2.nUiVisible = function () {
    try {
      if (curUser() !== 'n') return false;
      if (G.phone && G.phone.isLocked && G.phone.isLocked()) return false;
      if (G.users && G.users.switching && G.users.switching()) return false;
    } catch (e) { return false; }
    return true;
  };

  /* ---------------- milestone formulas (§2.1 v1.3 · §0.2 D1/D14/T6) ---------------- */
  E2.requestM2 = function (reason) {
    if (flag('M1') && !flag('M2')) { dwarn('m2', 'M2 by', reason || 'request'); G.flag('M2', true); }
  };
  E2.m4Ready = function () {
    if (!flag('M3') || curUser() !== 'n') return false;
    const fc = E2.factCount(), m3 = pm('M3');
    return (flag('factDash') && fc >= 4) || (m3 != null && pmNow() >= m3 + 480000 && fc >= 2);
  };
  E2.m5DueAt = () => { const t = pm('M4'); return flag('M4') && t != null ? t + 150000 : null; };
  E2.m6DueAt = function () {
    const m5 = pm('M5');
    if (!flag('M5') || m5 == null) return Infinity;
    const c1 = flag('C1') && pm('C1') != null ? pm('C1') + 45000 : Infinity;
    const b09 = flag('tankGlow') && pm('tankGlow') != null ? pm('tankGlow') + 120000 : -Infinity;
    const cl = G.state.vars.climax;
    const lure = cl && cl.lureEarlyPm != null ? cl.lureEarlyPm + 130000 : -Infinity;
    return Math.max(Math.min(m5 + 210000, Math.max(m5 + 45000, c1, b09)), lure);
  };
  E2.sirenDueAt = function () {
    if (flag('C2') && pm('C2') != null) return pm('C2') + 33000;
    if (!flag('M6') || pm('M6') == null) return Infinity;
    const c1b = flag('C1b') && pm('C1b') != null ? pm('C1b') + 150000 : Infinity;
    const lc = G.state.vars.lureCount | 0;
    return lc >= 2 ? Math.min(pm('M6') + 90000, c1b) : Math.min(pm('M6') + 240000, c1b);
  };

  /* ---------------- persistent playMs scheduler ---------------- */
  const handlers = [];
  const Q = () => { const v = G.state.vars; if (!Array.isArray(v.sched)) v.sched = []; return v.sched; };
  function matchKey(key, id) { return key === id || (key.endsWith('*') && id.indexOf(key.slice(0, -1)) === 0) || (key.endsWith(':') && id.indexOf(key) === 0); }
  E2.sched = {
    at(at, id, data) {
      if (!id) return null;
      const q = Q(), e = { at: Math.round(Number(at) || 0), id: String(id) };
      if (data !== undefined) e.data = data;
      const i = q.findIndex((x) => x.id === e.id);
      if (i >= 0) q[i] = e; else q.push(e);
      q.sort((a, b) => a.at - b.at);
      if (G.save) G.save();
      return e.id;
    },
    after(ms, id, data) { return E2.sched.at(pmNow() + (Number(ms) || 0), id, data); },
    cancel(id) {
      const q = Q(), key = String(id);
      const keep = q.filter((e) => !(key.endsWith('*') ? e.id.indexOf(key.slice(0, -1)) === 0 : e.id === key));
      if (keep.length !== q.length) { G.state.vars.sched = keep; if (G.save) G.save(); }
    },
    has(id) { return Q().some((e) => e.id === id); },
    when(id) { const e = Q().find((x) => x.id === id); return e ? e.at : null; },
    on(key, fn) { if (typeof fn === 'function') handlers.push({ key: String(key), fn }); },
    list() { return Q().map((e) => Object.assign({}, e)); },
  };
  function runSched() {
    const now = pmNow(), q = Q();
    if (!q.length || q[0].at > now) return;
    const due = q.filter((e) => e.at <= now).map((e) => e.id);
    due.forEach((id) => {
      const qq = Q(), i = qq.findIndex((e) => e.id === id);
      if (i < 0 || qq[i].at > pmNow()) return;
      const h = handlers.find((x) => matchKey(x.key, id));
      if (!h) { dwarn('sched:' + id, 'no handler (yet) for due event', id); return; }
      const e = qq[i]; qq.splice(i, 1);
      if (G.save) G.save();
      try { h.fn(e.data, e.id); } catch (err) { console.error('[e2 sched]', id, err); }
    });
  }

  /* ---------------- monologue channel (§2.4 · §4.9.3 · §6.1.3 'wait') ---------------- */
  const monoWait = {};
  let monoBusy = false, monoCur = null, m4AfterLine = false;
  function monoSafe() {
    try {
      if (G.director && G.director.safe) return !!G.director.safe('mono');
      if (G.ui && (G.ui.inputActive ? G.ui.inputActive() : G.ui.keyboardOpen && G.ui.keyboardOpen())) return false;
      if (G.notebook && G.notebook.isOpen && G.notebook.isOpen()) return false;
      if (G.users && G.users.switching && G.users.switching()) return false;
      if (G.phone && G.phone.modalOpen && G.phone.modalOpen()) return false;
      const ms = G.media && G.media.state && G.media.state();
      if (ms && ms.playing && (ms.from === 'voice' || ms.from === 'gallery')) return false;
    } catch (e) { return false; }
    return true;
  }
  E2.mono = function (id) {
    if (typeof E2.MONO[id] !== 'string') return Promise.resolve(false);
    if (flag(id)) return Promise.resolve(false);
    const st = ES();
    st.monoQ = Array.isArray(st.monoQ) ? st.monoQ : [];
    if (st.monoQ.indexOf(id) < 0) { st.monoQ.push(id); if (G.save) G.save(); }
    return new Promise((res) => { (monoWait[id] = monoWait[id] || []).push(res); pumpMono(); });
  };
  function monoQueued(id) { const q = ES().monoQ; return Array.isArray(q) && q.indexOf(id) >= 0; }
  /** M4 must wait while mono2 is queued (not yet shown), on screen, or in its +0.8 s tail ('e2:M4m' pending). Derived from live
   *  state only: after a reload monoBusy is false, a shown mono2 is flagged (its stale queue entry is dropped), and the persisted
   *  'e2:M4m' still fires at its playMs — so the hold never outlives the line. */
  function mono2Hold() {
    if (monoBusy && monoCur === 'mono2') return true;
    if (!flag('mono2') && monoQueued('mono2')) return true;
    return E2.sched.has('e2:M4m');
  }
  const MONO_MS = 3200, M4_AFTER_MONO2 = 800;                       // §2.1 · §3.7: 'mono2(3.2초)가 먼저, 끝난 뒤 0.8초에 M4'
  async function pumpMono() {
    if (monoBusy) return;
    const st = ES(), q = Array.isArray(st.monoQ) ? st.monoQ : (st.monoQ = []);
    while (q.length && flag(q[0])) { const done = q.shift(); (monoWait[done] || []).forEach((r) => r(false)); delete monoWait[done]; }
    if (!q.length) return;
    if (!(G.clock && G.clock.running && G.clock.running())) return;   // paused / hidden / not started
    if (!monoSafe()) return;
    const id = q[0];
    monoBusy = true; monoCur = id;                                  // set before the flag: its 'flag' listener runs evaluate()
    // M4 = the line's 3.2 s on screen + 0.8 s, counted from the moment it shows (persisted playMs event — survives a reload;
    // the fx fade-out after the 3.2 s is not part of the line's time). Queued before the flag so no evaluate() slips in.
    if (id === 'mono2' && !flag('M4')) E2.sched.at(pmNow() + MONO_MS + M4_AFTER_MONO2, 'e2:M4m');
    G.flag(id, true);                                               // the flag means "the line was displayed"
    bus.emit('mono:show', { id });
    try { await (G.fx && G.fx.mono ? G.fx.mono(E2.MONO[id], MONO_MS) : sleep(MONO_MS)); } catch (e) { console.error('[e2 mono]', e); }
    const i = q.indexOf(id); if (i >= 0) q.splice(i, 1);
    if (id === 'mono2' && m4AfterLine) { m4AfterLine = false; if (!flag('M4')) E2.sched.after(M4_AFTER_MONO2, 'e2:M4m'); }
    if (G.save) G.save();
    monoBusy = false; monoCur = null;
    bus.emit('mono:hide', { id });
    (monoWait[id] || []).forEach((r) => r(true)); delete monoWait[id];
  }

  /* ---------------- answers (§9.5-5 — verbatim) ---------------- */
  let STRIP;
  try { STRIP = new RegExp('[\\s\\p{P}\\p{S}\\p{Extended_Pictographic}\\u200d\\ufe0e\\ufe0f]', 'gu'); }   // + emoji joiners / variation selectors
  catch (e) { STRIP = /[\s!-\/:-@\[-`{-~ -⁯　-〿＀-￯←-⯿\uD83C-􏰀-\uDFFF️]/g; }
  E2.norm = function (s) {
    let t = String(s == null ? '' : s);
    try { t = t.normalize('NFC'); } catch (e) {}
    return t.trim().replace(STRIP, '').toLowerCase();
  };
  const NEG_STOP = /(안|못)(멈|멎|끊|짧)|(멈추|멎|끊기)지(않|안)|끊김(이)?없|멈춤(이)?없/;   // 멈춤 낱말에 '바로 붙은' 부정만
  const END_NEG = /끝까지(는|도)?(안|못|아니)|끝까지(는|도)?(나오|나와|울리|가)[가-힣]{0,2}(않|안|못)/;
  E2.answerOk = function (raw) {
    const n = E2.norm(raw);                                   // 공백·문장부호·이모지 제거, 소문자
    if (/한마디도/.test(n)) return false;                       // 아무것도 안 나왔다
    if (/끝까지/.test(n) && !END_NEG.test(n)) return false;     // '그냥 끝까지' · '끝까지 나왔어요' · '끝까지 나왔는데 안 좋았어요'
    if (NEG_STOP.test(n)) return false;                         // '안 멈췄어요' · '끊김 없이' · '멈추지 않고' · '안 짧았어요'
    if (/한마디|1마디|한두마디|두마디만|한소절|1소절/.test(n)) return true;
    if (END_NEG.test(n)) return true;                           // '끝까지 안 나왔어요' · '끝까지 나오진 않았어요'
    if (/멈췄|멈춤|멈추|멈춰|멈춘|멎|끊겼|끊김|끊기|끊긴|끊어|말았|짧았|짧던|짧더/.test(n)) return true;
    if (/(짧게|조금|잠깐|금방|거의안)[가-힣]{0,6}(나오|나왔|나와|울리|울렸|울려|흘러|멈|멎|끊|말았|끝나|끝났)/.test(n)) return true;
    return false;                                                // '잠깐만요' · '조금 이상했어요'처럼 소리 동사가 없으면 통과 0
  };
  E2.whereOk = (s) => /물탱크|탱크|저수조/.test(E2.norm(s));

  /* ---------------- formatting ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  E2.clamp = (x, a, b) => Math.max(a, Math.min(b, Number(x) || 0));
  E2.fmt12 = function (hm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ''));
    if (!m) return String(hm || '');
    const h = +m[1], mi = +m[2];
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(mi)}`;
  };
  E2.fmtK = function (d) { d = d instanceof Date ? d : new Date(d); return E2.fmt12(pad(d.getHours()) + ':' + pad(d.getMinutes())); };
  E2.ymd = function (d) { d = d instanceof Date ? d : new Date(d == null ? Date.now() : d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  /* ---------------- ep1 callbacks & series (§3.20 · §9.3 — code there is normative) ---------------- */
  const CANON = () => (G.STORY && G.STORY.e1canon) || {};
  const NEUTRAL = { _v: 1, e1done: false, min: null, knock: null, alarmDel: false, trap: false, vault: false, ring: false, manager: false, jimin: false, mom: false, js1: false };
  E2.cbPreview = Object.assign({}, NEUTRAL);
  E2.ep2Done = false;
  E2.cb = function (key) {
    const c = G.state && G.state.cb && G.state.cb._v === 1 ? G.state.cb : (E2.cbPreview || NEUTRAL);
    if (key === undefined) return Object.assign({}, c);
    return Object.prototype.hasOwnProperty.call(c, key) ? c[key] : NEUTRAL[key];
  };

  let fixtureApplied = false;
  E2.seriesBoot = function () {                       // ① 타이틀 로드
    const S = G.series;
    if (G.DEBUG && !fixtureApplied) {
      fixtureApplied = true;
      const m = /[?&]series=(S\d{1,2})\b/.exec(location.search);
      if (m && FIXTURES[m[1]]) applyFixture(m[1]);
    }
    if (!S) { dwarn('series', 'engine/series.js missing — neutral callbacks'); E2.cbPreview = Object.assign({}, NEUTRAL); E2.ep2Done = false; return; }
    try { S.ensure(); S.backfillEp1(); } catch (e) {}
    let e1 = { st: 'none' };
    try { e1 = S.ep(1); } catch (e) {}
    const s = (k) => { try { return S.s(k); } catch (e) { return undefined; } };
    if (typeof CANON().cbFrom === 'function') E2.cbPreview = CANON().cbFrom(e1, s);
    else {
      const done = e1.st === 'done', started = done || e1.st === 'started';
      E2.cbPreview = {                                  // 선택형 = done일 때만, '했다'형 = started에서도(바이블 §7.5)
        _v: 1, e1done: done,
        min: done && Number.isFinite(e1.min) ? e1.min : null,
        knock: done && ['answered', 'four', 'none'].includes(s('e1_knock')) ? s('e1_knock') : null,
        alarmDel: done && s('e1_alarmDel') === true,
        trap: started && s('e1_trap') === true, vault: started && s('e1_vault') === true,
        ring: started && s('e1_ring') === true, manager: started && s('e1_manager') === true,
        jimin: done && s('e1_jimin') === true, mom: done && (s('e1_momRead') === true || s('e1_momTold') === true),
        js1: done && s('e1_js1') === true,
      };
    }
    try { E2.ep2Done = S.ep(2).st === 'done'; } catch (e) { E2.ep2Done = false; }
    retryCommit('boot');
    if (G.DEBUG && G.alerts && G.alerts.selfCheck) { try { const errs = G.alerts.selfCheck() || []; errs.forEach((x) => console.error('[alerts.selfCheck]', x)); } catch (e) {} }
  };
  E2.seriesStart = function () {                      // ② introDone
    if (!G.state.cb || G.state.cb._v !== 1) G.state.cb = Object.assign({ _v: 1 }, E2.cbPreview || NEUTRAL);
    G.state.vars.replay = !!E2.ep2Done;
    try {
      if (G.series && G.series.ep(2).st === 'none')
        G.series.patch((r) => { r.eps['2'] = Object.assign({ st: 'none', on: null, min: null, hints: null, src: 'default', canon: false }, r.eps['2'], { st: 'started', src: 'play' }); });
    } catch (e) {}
    if (G.save) G.save(true);
  };
  E2.commit = function (opts) {                       // ④ END — called by flow ending ('end:reached')
    const v = G.state.vars, st = G.state.stage || {}, F = (k) => flag(k);
    if (v.committed && !(opts && opts.overwrite)) return true;
    const payload = {
      ep: { st: 'done', on: E2.ymd(new Date()), min: E2.clamp(Math.round(G.state.playMs / 60000), 0, 600),
            hints: E2.clamp(G.state.hintsUsed | 0, 0, 99), src: 'play', canon: true },
      s: { e2_finger:    st.e2_finger || (F('fingerDeleted') ? 'deleted' : 'kept'),
           e2_dash:      st.e2_dash || 'locked',
           e2_fakeReply: !!st.e2_fakeReply,
           e2_jimin:     F('answeredRight'),
           e2_phone:     st.e2_phone || 'police' },
      seen: { e2_cbs: F('seenCbs'), e2_kbd: F('seenKbd'), e2_note: F('seenNote'), e2_key404: F('seenKey404'),
              e2_whistle: F('seenWhistle'), e2_hangyeol: F('seenHangyeol'), e2_hinge: F('seenHinge') },
    };
    try {
      if (!G.series) throw new Error('series engine missing');
      const ok = G.series.commit(2, payload, opts || {});
      if (ok === false) throw new Error('series write failed');
      v.committed = true;
    } catch (e) { v.commitTries = (v.commitTries | 0) + 1; dwarn('commit' + v.commitTries, 'commit failed', e && e.message); }
    if (G.save) G.save(true);
    return !!v.committed;
  };
  /** §9.3: END ∧ ¬committed → quiet retry (max 5, UI 0) on the next screen change / boot. While the engine is in memory
   *  mode (storage failed this session — it stays failed until a reload) an in-session retry cannot land, so only 'boot'
   *  retries run then; the 5-try cap is spent across boots, not within one broken session. */
  function retryCommit(why) {
    const v = G.state && G.state.vars;
    if (!v || !flag('END') || v.committed || (v.commitTries | 0) >= 5) return;
    if (why !== 'boot') { let mm = false; try { mm = !!(G.series && G.series.memory && G.series.memory()); } catch (e) {} if (mm) return; }
    E2.commit();
  }
  /** ⑤ hook end (idempotent — monotone keys only). opts.soft = pagehide / hidden while the hook is up: the series patch is
   *  written, but `hookDone` only once the voice-message overlay was opened — an unopened 03:33 lock stays resumable
   *  (§9.2 'HOOK ∧ ¬hookDone → 03:33 잠금화면'). Explicit exits ([처음 화면으로] · back · home · pause menu) always end it. */
  E2.hookPatch = function (opts) {
    const F = (k) => flag(k), plays = G.state.vars.hookPlays | 0;
    try {
      if (!G.series) throw new Error('series engine missing');
      const ok = G.series.patch((r) => {
        r.seen = r.seen || {}; r.sea = Array.isArray(r.sea) ? r.sea : [];
        const add = (id) => { if (!r.sea.includes(id) && r.sea.length < 16) r.sea.push(id); };
        if (F('hookOpened')) r.seen.e2_piyo = true;                 // ★S2-7
        if (plays >= 2 || F('hookZoom')) add('sig_piyo');           // 두 번 이상 재생 또는 파형 첫 0.5 s 확대
        if (F('hookFull')) add('sig_fifth');                        // 끝까지 재생(다섯째 음)
      });
      if (ok === true) G.state.vars.patched = true;                 // false = not stored (read-only · storage failed)
    } catch (e) {}
    if (!(opts && opts.soft) || F('hookOpened')) { if (!F('hookDone')) G.flag('hookDone', true); }
    if (G.save) G.save(true);
  };
  const STAGE_KEYS = ['e2_finger', 'e2_dash', 'e2_fakeReply', 'e2_jimin', 'e2_phone'];
  E2.stage = function (key, value) {
    if (STAGE_KEYS.indexOf(key) < 0) { dwarn('stage:' + key, 'unknown stage key', key); return; }
    if (G.series && G.series.stage) G.series.stage(key, value);
    else { G.state.stage = G.state.stage || {}; G.state.stage[key] = value; if (G.save) G.save(); }
  };

  /* ---------------- free-text session store (§9.2 자유 입력) ---------------- */
  const SS_KEY = 'haru-escape.ep2.session';
  let ssMem = {};
  const ssRead = () => { try { const r = JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); return r && typeof r === 'object' ? r : {}; } catch (e) { return ssMem; } };
  E2.session = {
    set(id, text) { const o = ssRead(); o[id] = String(text == null ? '' : text); ssMem = o; try { sessionStorage.setItem(SS_KEY, JSON.stringify(o)); } catch (e) {} },
    get(id) { const o = ssRead(); return Object.prototype.hasOwnProperty.call(o, id) ? o[id] : null; },
    clear() { ssMem = {}; try { sessionStorage.removeItem(SS_KEY); } catch (e) {} },
  };

  /* ---------------- world helpers ---------------- */
  E2.world = () => ({
    snow: G.vars('snow') | 0, roofLight: flag('roofLight'), peepholeTaped: flag('peepholeTaped'), footprints: G.vars('footprints') | 0,
    ledState: G.vars('ledState') || 'green', tankGlow: flag('tankGlow'), doorOpened: flag('doorOpened'),
  });
  let slowFrame = false;
  try { requestAnimationFrame((t1) => requestAnimationFrame((t2) => { slowFrame = t2 - t1 > 24; })); } catch (e) {}
  E2.lowEnd = () => !!((navigator.deviceMemory && navigator.deviceMemory <= 2) || slowFrame);

  function snowFromClock() {
    if (!G.clock || !G.clock.minutes) return;
    const m = G.clock.minutes(), t1 = G.clock.toMin('23:50'), t2 = G.clock.toMin('00:20');
    const s = m >= t2 ? 2 : m >= t1 ? 1 : 0;
    if ((G.vars('snow') | 0) < s) G.vars('snow', s);
  }

  /* ---------------- evaluation (M2 · M4 · M5 · M6-due · mono1/mono2) ---------------- */
  let nVisSince = null;
  function trackVis() {
    const vis = E2.nUiVisible();
    if (vis) { if (nVisSince == null) nVisSince = pmNow(); } else nVisSince = null;
    return vis;
  }
  const nHeld = (ms) => nVisSince != null && pmNow() - nVisSince >= ms;

  function fireM5() {
    const st = ES();
    if (flag('M5') || st.m5 === 'buzz' || st.m5 === 'done') return;
    st.m5 = 'buzz';
    E2.sched.cancel('e2:M5hold');
    // §6.2 B10 덜 무섭게 'GSM −6 dB' — a gentler swell (.15 ≈ −36 dBFS) that still rises above the .08 base; a literal −6 dB
    // under the .22 peak would sit below the base on the gsmLin law and read as a dip (same choice as B09's less variant)
    const gsmPeak = E2.less() ? 0.15 : 0.22;
    try { if (G.audio && G.audio.gsmTank && G.audio.gsmTank.pulse) G.audio.gsmTank.pulse({ peak: gsmPeak, upMs: 300, holdMs: 1200, downMs: 600, arc: true }); } catch (e) { console.error(e); }
    try { if (G.audio && G.audio.sub) G.audio.sub('S04', { az: 70 }); } catch (e) { console.error(e); }
    try { if (G.director && G.director.mark) G.director.mark('B10'); } catch (e) {}
    E2.sched.after(2500, 'e2:M5set');
    if (G.save) G.save();
  }

  function evaluate() {
    if (!G.state || !flag('introDone')) return;
    const st = ES();
    const vis = trackVis();
    // M2 ⓐ fact ≥ 2 (ⓑ is the 'e2:M2' event, ⓒ is requestM2)
    if (flag('M1') && !flag('M2') && E2.factCount() >= 2) G.flag('M2', true);
    // M4 (with mono2 sequencing — §2.1: mono2 first, M4 0.8 s after it ends via 'e2:M4m')
    if (flag('M3') && !flag('M4')) {
      const mono2Pending = flag('factDash') && !flag('mono2');
      if (mono2Pending) { if (vis && !monoQueued('mono2')) E2.mono('mono2'); }
      else if (!mono2Hold() && E2.m4Ready() && vis && nHeld(1500)) G.flag('M4', true);
    }
    // M5 '—' hold (≤ 90 s)
    if (st.m5 === 'hold' && !flag('M5') && vis && nHeld(1500)) fireM5();
    // M6 due → climax
    if (flag('M5') && !flag('M6') && !st.m6Emitted && pmNow() >= E2.m6DueAt()) {
      st.m6Emitted = true;
      const cl = (G.state.vars.climax = Object.assign({}, G.state.vars.climax || {}));
      cl.m6DuePm = Math.round(pmNow());
      if (G.save) G.save();
      const prelude = !(G.clock && G.clock.passed && G.clock.passed('00:22'));
      bus.emit('m6:due', { prelude });
      if (!G.climax) { dwarn('climax', 'G.climax missing — M6 stub'); G.flag('M6', true); }
    }
    pumpMono();
  }

  function ensureSchedules() {
    if (flag('M1') && !flag('M2') && !E2.sched.has('e2:M2') && pm('M1') != null) E2.sched.at(pm('M1') + 360000, 'e2:M2');
    const st = ES();
    if (flag('M4') && !flag('M5') && !st.m5 && !E2.sched.has('e2:M5') && pm('M4') != null) E2.sched.at(pm('M4') + 150000, 'e2:M5');
    if (st.m5 === 'buzz' && !flag('M5') && !E2.sched.has('e2:M5set')) E2.sched.after(2500, 'e2:M5set');
  }

  let inited = false;
  E2.init = function () {
    if (inited) return; inited = true;
    E2.sched.on('e2:M2', () => { if (flag('M1') && !flag('M2')) G.flag('M2', true); });
    E2.sched.on('e2:M5', () => {
      if (flag('M5')) return;
      const st = ES();
      if (curUser() === 'dash') {                          // §0.2 T6 — wait for {N}'s screens, at most 90 s
        st.m5 = 'hold'; G.vars('m5HoldPm', Math.round(pmNow()));
        E2.sched.after(90000, 'e2:M5hold');
        if (G.save) G.save();
      } else fireM5();
    });
    E2.sched.on('e2:M5hold', () => fireM5());
    E2.sched.on('e2:M5set', () => { const st = ES(); st.m5 = 'done'; if (!flag('M5')) G.flag('M5', true); });
    E2.sched.on('e2:M4m', () => {
      if (flag('M4')) return;
      if (monoBusy && monoCur === 'mono2') { m4AfterLine = true; return; }   // the line showed late (fx chain) → 0.8 s after it ends
      if (E2.m4Ready()) G.flag('M4', true);
    });

    bus.on('flag', (name) => {
      recomputeFacts();
      if (name === 'M1' && !flag('M2') && pm('M1') != null) E2.sched.at(pm('M1') + 360000, 'e2:M2');
      if (name === 'M2') E2.sched.cancel('e2:M2');
      if (name === 'M4' && !flag('M5') && pm('M4') != null && !ES().m5) E2.sched.at(pm('M4') + 150000, 'e2:M5');
      if (name === 'M5') { E2.sched.cancel('e2:M5'); E2.sched.cancel('e2:M5hold'); E2.sched.cancel('e2:M5set'); ES().m5 = 'done'; }
      if (name === 'M6') ES().m6Emitted = true;
      evaluate();
    });
    bus.on('users:switched', () => { nVisSince = null; evaluate(); });
    bus.on('lock:unlock', () => evaluate());
    bus.on('home:show', (e) => {
      const u = (e && e.user) || curUser();
      if (u === 'n' && flag('factSmart') && flag('factFinger') && !flag('mono1')) E2.mono('mono1');
      evaluate();
    });
    bus.on('clock:min', snowFromClock);
    bus.on('clock:jump', snowFromClock);
    bus.on('screen:push', () => retryCommit());
    bus.on('state:load', () => { nVisSince = null; ensureSchedules(); retryCommit(); });
    bus.on('state:reset', () => { nVisSince = null; E2.session.clear(); });
    if (G.clock && G.clock.onTick) G.clock.onTick(() => { runSched(); evaluate(); if (G.DEBUG && !G.APP) debugTick(); });

    recomputeFacts();
    ensureSchedules();
    snowFromClock();
  };

  /* ---------------- G.sd — shared helpers for story-data apps (ep1 js/data/talk.js, same behaviour) ---------------- */
  const SD = (G.sd = G.sd || {});
  SD.T = (s) => (G.T ? G.T(s) : s);
  SD.img = E2.img;
  const okCache = {};
  SD.bg = function (node, key, opts) {
    opts = opts || {};
    const url = SD.img(key);
    if (!url) { node.classList.add('noimg'); return node; }
    node.style.backgroundImage = `url("${url}")`;
    if (opts.pos) node.style.backgroundPosition = opts.pos;
    if (opts.size) node.style.backgroundSize = opts.size;
    if (okCache[url] === false) { node.classList.add('noimg'); return node; }
    if (okCache[url] !== true) {
      const im = new Image();
      im.onload = () => { okCache[url] = true; };
      im.onerror = () => { okCache[url] = false; node.classList.add('noimg'); };
      im.src = url;
    }
    return node;
  };
  SD.imgEl = function (key, cls) {
    const url = SD.img(key);
    const im = document.createElement('img');
    if (cls) im.className = cls;
    im.alt = ''; im.draggable = false;
    im.onerror = () => { im.style.visibility = 'hidden'; if (im.parentNode) im.parentNode.classList.add('noimg'); };
    im.src = url;
    return im;
  };
  SD.note = function () { dwarn('sd.note', 'G.sd.note is a no-op in ep2 (hard mode)'); };
  SD.lead = function () { dwarn('sd.lead', 'G.sd.lead is a no-op in ep2 (hard mode)'); };
  SD.tone = function () { dwarn('sd.tone', 'G.sd.tone is a no-op in ep2 — notification sounds go through G.phone.notify'); };
  SD.isSafe = function () {
    try { if (G.director && G.director.safe) return !!G.director.safe('show'); } catch (e) {}
    if (G.ui && G.ui.inputActive && G.ui.inputActive()) return false;
    if (G.notebook && G.notebook.isOpen && G.notebook.isOpen()) return false;
    if (G.phone && G.phone.modalOpen && G.phone.modalOpen()) return false;
    return !document.hidden;
  };
  SD.waitSafe = async function (maxMs) {
    const t0 = Date.now();
    while (!SD.isSafe()) { await sleep(700); if (maxMs && Date.now() - t0 > maxMs) break; }
  };
  SD.statusOverlay = function (theme) {
    try { if (G.phone && G.phone.statusTheme) G.phone.statusTheme(theme || 'light'); } catch (e) {}
    return function () { try { const t = G.phone && G.phone.top && G.phone.top(); if (G.phone && G.phone.statusTheme) G.phone.statusTheme(t && t.node ? t.node.dataset.status || 'light' : 'light'); } catch (e) {} };
  };
  SD.dayLabel = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}요일`;
  SD.rng = function (seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  SD.pd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  SD.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /** day('2026-12-12', [['them','20:10','text', {extra}], …], common) */
  SD.day = function (date, rows, common) {
    return (rows || []).map((r) => Object.assign({ from: r[0], t: date + ' ' + r[1], text: r[2] }, common || {}, r[3] || {}));
  };

  /* ---------------- DEBUG: series QA fixtures (§9.3 S1–S10) ---------------- */
  const T0 = new Date(2026, 10, 24, 5, 0).getTime();
  const e1Save = (flags, vars, playMs, hints) => ({ v: 1, flags: Object.assign({ introDone: T0 - 3600000 }, flags), vars: vars || {}, playMs: playMs || 0, hintsUsed: hints | 0, threads: {}, notifs: [], read: {}, fragments: {}, seen: {} });
  const E1_DONE = (extra, vars) => e1Save(Object.assign({ M1: T0 - 3000000, END: T0 }, extra), vars, 2820000, 3);
  const doneRec = (extra) => Object.assign({ v: 1, rev: 4, created: '2026-11-24', last: 2,
    eps: { 1: { st: 'done', on: '2026-11-24', min: 47, hints: 3, src: 'live', canon: true }, 2: { st: 'done', on: '2026-12-25', min: 44, hints: 1, src: 'play', canon: true } },
    s: { e1_knock: 'none', e2_finger: 'kept', e2_dash: 'kept', e2_fakeReply: true, e2_jimin: false, e2_phone: 'kept' }, seen: { e2_cbs: true }, sea: [] }, extra || {});
  const FIXTURES = {
    S1: { rec: null, e1: null },
    S2: { rec: null, e1: e1Save({}, {}, 30000) },
    S3: { rec: null, e1: e1Save({ M1: T0 - 3000000, trap0404: T0, vaultSeen: T0, ringHeard: T0, managerExposed: T0, knockedBack: T0 }, {}, 900000, 1) },
    S4: { rec: null, e1: E1_DONE({ knockSilenced: T0, alarmDeleted: T0, jiminTold: T0, momRead: T0 }, { js1Spent: true }) },
    S5: { rec: null, e1: E1_DONE({}, {}) },
    S6: { rec: doneRec(), e1: E1_DONE({}, {}) },
    S7: { rec: { v: 2, rev: 9, created: '2026-11-24', last: 3, eps: { 1: { st: 'done', canon: true } }, s: {}, seen: {}, sea: [], future: { x: 1 } }, e1: null },
    S8: { rec: null, e1: null, blocked: true },
    S9: { rec: doneRec({ seen: { e2_cbs: true } }), e1: E1_DONE({}, {}) },
    S10: { rec: { v: 1, rev: 2, created: '2026-11-24', last: 0, eps: { 1: { st: 'started', on: null, min: null, hints: null, src: 'backfill', canon: false } }, s: {}, seen: {}, sea: [] },
           e1: E1_DONE({ knockSilenced: T0 }, {}) },
  };
  function applyFixture(id) {
    const fx = FIXTURES[id];
    if (!fx || !G.series || !G.series._fixture) return false;
    G.series._fixture(JSON.parse(JSON.stringify(fx)));
    console.info('[e2] series QA profile', id, '(memory mode — real storage untouched)');
    return true;
  }

  /* ---------------- DEBUG: budget meter + error lines (z 900) — never drawn under G.APP (app build / ?app=1 preview) ---------------- */
  function countHis() {
    let n = 0; const seen = new Set();
    const cbf = (k) => E2.cb(k);
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 7 || seen.has(o)) return;
      seen.add(o);
      if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
      const his = typeof o.his === 'function' ? !!o.his(cbf) : o.his === true;
      if (his) {
        if (typeof o.lines === 'function') { try { n += (o.lines(cbf) || []).filter(Boolean).length; } catch (e) { n += 1; } }
        else if (Array.isArray(o.lines)) n += o.lines.filter(Boolean).length;
        else n += 1;
      }
      if (typeof o.nameHis === 'function') { try { if (o.nameHis(cbf)) n += 1; } catch (e) {} }
      Object.keys(o).forEach((k) => { if (k !== 'his') walk(o[k], depth + 1); });
    };
    try { walk(G.STORY || {}, 0); } catch (e) {}
    try { walk(G.ROOM || {}, 0); } catch (e) {}       // the box note front '돌려줄게. —' (ledger #1) lives in G.ROOM.closeups
    return n;
  }
  if (!G.APP || G.DEBUG) E2.budget = function () {   // QA only: left out of the app build (G.APP ∧ ¬G.DEBUG)
    const dir = G.state.vars.dir || {}, fired = dir.fired || {};
    const monos = ['mono1', 'mono2', 'mono3', 'mono4'].filter(flag).length + (flag('recapShown') && !(E2.cb('e1done')) ? 4 : 0);
    return {
      hisLines: countHis(),
      himTone: dir.himTone | 0,
      jumps: fired.B14 != null ? 1 : 0,
      monos,
      tts: (flag('vmPlayed') ? 1 : 0) + (flag('M8') ? 1 : 0) + (fired.B14 != null && flag('C2') ? 1 : 0),
    };
  };
  let dbgBox = null, dbgErr = null, dbgN = 0;
  function debugUI() {
    if (dbgBox || !document.body || G.APP) return;
    const host = document.getElementById('phone') || document.body;
    dbgBox = document.createElement('div'); dbgBox.className = 'c2-debug-meter'; dbgBox.setAttribute('data-qa', 'debug.meter');
    dbgErr = document.createElement('div'); dbgErr.className = 'c2-debug-err';
    dbgErr.addEventListener('click', () => { dbgErr.innerHTML = ''; });
    host.appendChild(dbgBox); host.appendChild(dbgErr);
  }
  function debugTick() {
    if (++dbgN % 8) return;
    debugUI();
    if (!dbgBox) return;
    const b = E2.budget();
    const over = b.hisLines > 25 || b.himTone > 11 || b.jumps > 1 || b.monos > 8 || b.tts > 4;
    dbgBox.classList.toggle('over', over);
    dbgBox.textContent = `his ${b.hisLines}/25 · tone ${b.himTone}/11 · jump ${b.jumps}/1 · mono ${b.monos}/8 · tts ${b.tts}/4 · ${G.clock ? G.clock.hm() : ''} · ${Math.round(pmNow() / 1000)}s`;
  }
  function debugError(msg) {
    if (!G.DEBUG || G.APP) return;
    try {
      debugUI(); if (!dbgErr) return;
      const line = document.createElement('div'); line.textContent = String(msg).slice(0, 240);
      dbgErr.appendChild(line);
      while (dbgErr.childNodes.length > 5) dbgErr.removeChild(dbgErr.firstChild);
    } catch (e) {}
  }
  if (G.DEBUG && !G.APP) {
    const ce = console.error.bind(console);
    console.error = function (...a) { ce(...a); debugError(a.map((x) => (x && x.message) || (typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x))).join(' ')); };
    W.addEventListener('error', (e) => debugError('error: ' + (e.message || e)));
    W.addEventListener('unhandledrejection', (e) => debugError('promise: ' + ((e.reason && e.reason.message) || e.reason)));
  }

  /* ---------------- DEBUG: window.haru core helpers (ARCH §6.2) ---------------- */
  const JUMP = [
    ['M0', [{ f: 'introDone' }, { f: 'recapShown' }, { f: 'M0' }, { f: 'roofLight' }]],
    ['M1', [{ f: 'gotPhone' }, { f: 'boxNote' }, { f: 'boxHand' }, { f: 'polaroidSeen' }, { f: 'seenNote' }, { user: 'n' }, { f: 'M1' }, { lock: 'hide' }]],
    ['M2', [{ f: 'factSmart' }, { f: 'bioOpened' }, { f: 'factFinger' }, { f: 'M2' }]],
    ['M3', [{ f: 'kbdListOpened' }, { f: 'factKbd' }, { f: 'cbsOpened' }, { f: 'tlOpened' }, { v: ['cbsDays', ['12-15']] }, { v: ['tlDays', ['12-15']] },
      { f: 'factCbs' }, { f: 'dashSeen' }, { f: 'pinPadOpened' }, { user: 'dash' }, { f: 'M3' }]],
    ['M4', [{ f: 'dashMemo' }, { f: 'dashA0310' }, { f: 'dashARoof' }, { user: 'n' }, { f: 'mono2' }, { f: 'M4' }]],
    ['M5', [{ f: 'b09Cue' }, { f: 'M5' }]],
    ['M6', [{ off: 'roofLight' }, { f: 'peepholeTaped' }, { mark: 'B12' }, { mark: 'B13' }, { f: 'M6' }]],
    ['M7', [{ f: 'M7' }, { v: ['sirenBy', 'time'] }, { v: ['footprints', 1] }, { mark: 'B15' }, { mark: 'B17' }, { mark: 'B18' }]],
    ['M8', [{ f: 'roofLight' }, { mark: 'B16' }, { mark: 'W06' }, { f: 'M8' }]],
    ['END', [{ f: 'doorOpened' }, { off: 'peepholeTaped' }, { v: ['footprints', 2] }, { fn: () => G.media && G.media.bt && G.media.bt.retire && G.media.bt.retire() },
      { user: 'n' }, { stage: ['e2_dash', 'locked'] }, { f: 'dashChoiceDone' }, { f: 'pol1Shown' }, { stage: ['e2_phone', 'police'] }, { f: 'phoneChoiceDone' },
      { f: 'jiminReturn' }, { stage: ['e2_jimin', true] }, { f: 'answeredRight' }, { f: 'END' }]],
    ['HOOK', [{ f: 'kangWrapDone' }, { f: 'HOOK' }]],
  ];
  function jump(id, opts) {
    opts = opts || {};
    const idx = JUMP.findIndex((r) => r[0] === id);
    if (idx < 0) { console.warn('[haru.jump] unknown id', id, JUMP.map((r) => r[0])); return false; }
    const ops = [];
    JUMP.slice(0, idx + 1).forEach((r) => ops.push(...r[1]));
    const nf = ops.filter((o) => o.f && !flag(o.f)).length;
    if (G.state.playMs < (nf + 1) * 1000) G.state.playMs = (nf + 1) * 1000;
    if (G.clock && !G.clock.started()) G.clock.start();
    let k = 0;
    const pmv = G.state.vars.pm = G.state.vars.pm || {};
    ops.forEach((o) => {
      try {
        if (o.f) { if (!flag(o.f)) { if (pmv[o.f] == null) pmv[o.f] = Math.round(G.state.playMs - (nf - k) * 1000); k++; G.flag(o.f, true); } }
        else if (o.off) G.flag(o.off, false);
        else if (o.v) G.vars(o.v[0], o.v[1]);
        else if (o.user) G.vars('user', o.user);
        else if (o.stage) E2.stage(o.stage[0], o.stage[1]);
        else if (o.mark) { if (G.director && G.director.mark) G.director.mark(o.mark); else { const d = (G.state.vars.dir = G.state.vars.dir || {}); d.fired = d.fired || {}; if (d.fired[o.mark] == null) d.fired[o.mark] = Math.round(G.state.playMs); } }
        else if (o.lock === 'hide') { if (G.lock && G.lock.hide) G.lock.hide(); }
        else if (o.fn) o.fn();
      } catch (e) { console.error('[haru.jump]', o, e); }
      if (o.f === 'introDone' && (!G.state.cb || G.state.cb._v !== 1)) E2.seriesStart();
    });
    if (opts.commit && flag('END')) E2.commit();
    G.save(true);
    try { if (G.main && G.main.resumeFrom) G.main.resumeFrom(G.state); } catch (e) { console.error('[haru.jump] resumeFrom', e); }
    return true;
  }
  if (G.DEBUG) {
    const H = W.haru;
    const copy = (o) => JSON.parse(JSON.stringify(o));
    H.state = () => copy(G.state);
    H.flags = () => { const f = G.state.flags, p = G.state.vars.pm || {}; return Object.keys(f).sort((a, b) => (p[a] == null ? f[a] : p[a]) - (p[b] == null ? f[b] : p[b]) || f[a] - f[b]); };
    H.vars = () => copy(G.state.vars);
    H.flag = (name, on) => G.flag(name, on === undefined ? true : !!on);
    H.fact = (name) => G.flag(name, true);
    H.jump = jump;
    H.time = (scale) => (G.clock && G.clock._scale ? G.clock._scale(scale == null ? 1 : scale) : 1);
    H.clearSave = () => { G.resetSave(); E2.session.clear(); };
    H.clearSeries = () => { if (G.series && G.series.clearAll) G.series.clearAll(); };
    H.series = (p) => { if (!applyFixture(p)) { console.warn('[haru.series] profiles', Object.keys(FIXTURES)); return null; } E2.seriesBoot(); return Object.assign({}, E2.cbPreview); };
    H.type = (text) => { const f = G.ui && G.ui.focusedField && G.ui.focusedField(); if (!f) { console.warn('[haru.type] no focused field'); return false; } f.insert(String(text)); return true; };
    /** §10 D — the 38-sentence QA table (true = must be accepted) — DEBUG builds only (QA data, no runtime user) */
    E2.ANSWER_TABLE = [
      ['한 마디만 나왔어요', true], ['한마디 나오고 멈췄어요', true], ['짧게 나오다 멈췄어요', true], ['끝까지 안 나왔어요', true],
      ['끝까지 안 나오고 금방 멈췄어요', true], ['끝까지 나오진 않았어요', true], ['끝까지는 못 갔어요', true], ['금방 멎었어요', true],
      ['멎었어요', true], ['멈춰 버렸어요', true], ['멈추었어요', true], ['끊어졌어요', true], ['조금만 나오다 말았어요', true],
      ['한두 마디 나오다 끊겼어요', true], ['1소절', true], ['한 소절만요', true], ['중간에 끊겼어요', true], ['금방 끝났어요', true],
      ['짧았어요', true], ['거의 안 나왔어요', true], ['조금 나오고 끝', true], ['멈추고 안 나왔어요', true], ['한마디!!', true],
      ['그냥 끝까지 나오던데요 ㅎ', false], ['끝까지 다 나왔어요', false], ['안 멈췄어요', false], ['끊김 없이 잘 나왔어요', false],
      ['한마디도 안 나왔어요', false], ['잠깐만요', false], ['예뻤어요', false], ['기억 안 나요', false], ['계속 나왔어요', false],
      ['끝까지 나왔는데 안 좋았어요', false], ['멈추지 않고 계속 나왔어요', false], ['안 짧았어요', false], ['모르겠어요', false],
      ['조금 이상했어요', false], ['끝까지 울렸어요', false],
    ];
    H.answer = (s) => E2.answerOk(s);
    H.answerTable = () => E2.ANSWER_TABLE.filter(([s, exp]) => E2.answerOk(s) !== exp).map(([s, exp]) => ({ s, expected: exp }));
    H.budget = () => E2.budget();
    H.sched = () => E2.sched.list();
  }
})();
