/* =========================================================
 * ep3/js/e3.js — episode-3 state helpers + the ep2 facade (core · ARCH_EP3 §5.3 · §4.3 · §7 · DESIGN_EP3 §2.1 §2.4 §3.11
 * §3.17 §6.1.3 §9.1 §9.3 §11.4)
 *
 * G.e3 (= G.e2 = G.ep, alias window.E3) — assigned at LOAD (data files and G.T need STR / MONO / img before boot)
 *   text / identity  STR (system-string whitelist = DESIGN §10 A) · MONO · img(key) · less() · speaker() · lowEnd()
 *                    maker() (ep2 rule, never drawn) · makerHandle() → '' · makerAvatar() → ''
 *   formatting       norm(s) · fmt12('05:39') · fmtK(date) · ymd(date) · clamp(x,a,b) · dow(ymd) · fmtDate(ymd|Date, {today})
 *   state            stage(key, value) (only writer of G.state.stage) · session.set/get/clear (sessionStorage[G.EP.SESSION_KEY])
 *                    sched.at/after/cancel/has/when/on/list (persistent playMs scheduler, vars.sched) · momAt(v?) (only writer
 *                    of vars.momAt) · where() · hub() · m6Due() · battery() · led() · grade() · layers(view)
 *   monologue        mono(id) → Promise<bool> ('mono1' | 'mono2' queued + safe-zone wait + M6 window drop · 'recap' = the 4
 *                    recap lines in a row) · recapNext() (tap = next line) · recapSkip() ([건너뛰기])
 *   series           cbPreview · ep3Done · cb(key) · seriesBoot() · seriesStart() · commit(opts?) → bool · hookPatch(soft?)
 *   ep2 stubs        requestM2() answerOk() whereOk() → false · world() facts() → {} · factCount() → 0
 *   init()           sched handlers 'e3:*' · hub evaluator · M2 on easyOff · battery · mono triggers · commit retry · DEBUG UI
 * G.sd — the ep2 helper set (T img bg imgEl tone(no-op) isSafe waitSafe statusOverlay dayLabel rng pd ymd day + note/lead no-ops)
 * window.haru (DEBUG only, created at load): state flags vars flag jump time speed cb series(+.fixture) name type clearSave
 *   clearSeries budget hub sched — owners add their own helpers in their files.
 * Flags set here: M2 M3 M4 M5 mono1 mono2 hookDone (+ M6 only as the fallback when G.door is missing at dueAt + 40 s).
 * Vars set here: hubK TB battery momAt sched e3 replay committed commitTries patched · dir.dropped (mono ids, object form).
 * Bus emitted: 'm6:due' {dueAt} · 'mono:show' {id} · 'mono:hide' {id}.
 * Bus listened: flag · rec:text · gallery:photo · screen:push · state:load · state:reset.
 * This is the only ep3 file (with gate.js) that talks to the series engine (ARCH §5.5 · DESIGN §10 G grep rule).
 * ========================================================= */
(function () {
  'use strict';
  const W = window;
  const G = (W.G = W.G || {});
  const E3 = (G.e3 = G.e3 || {});
  G.e2 = E3; G.ep = E3; W.E3 = E3;                 // ARCH §4.1-2 — engine code reads G.e2 (old) / (G.ep || G.e2) (new)
  if (G.DEBUG) W.haru = W.haru || {};              // created at load so later files can add their helpers (ARCH §7.2)

  /* DEBUG: ?name=지은 sets the player name before boot (ARCH §7.1) — G.T reads CONFIG at render time */
  if (G.DEBUG) {
    try {
      const m = /[?&]name=([^&#]+)/.exec(location.search);
      if (m) { W.CONFIG = W.CONFIG || {}; W.CONFIG.PLAYER_NAME = decodeURIComponent(m[1].replace(/\+/g, ' ')); }
    } catch (e) {}
  }

  const bus = { on: (e, f) => (G.bus ? G.bus.on(e, f) : () => {}), emit: (e, d) => { if (G.bus) G.bus.emit(e, d); } };
  const CFG = () => W.CONFIG || {};
  const pmNow = () => (G.state ? G.state.playMs : 0);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const warned = {};
  const dwarn = (k, ...a) => { if (!G.DEBUG || warned[k]) return; warned[k] = 1; console.warn('[e3]', ...a); };
  const flag = (n) => !!(G.flag && G.state && G.flag(n));
  const pm = (n) => (G.pm && G.state ? G.pm(n) : null);
  const V = () => (G.state && G.state.vars) || {};
  const ES = () => { const v = V(); if (!v.e3 || typeof v.e3 !== 'object') v.e3 = {}; return v.e3; };
  const save = (now) => { try { if (G.save) G.save(now); } catch (e) {} };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[e3]', e); return d; } };

  /* ---------------- system strings (= DESIGN §10 A allow-list + §4.0 common phone strings — ARCH §5.3, exact) ----------------
   * ep2-only keys (pinWrong, noSimCall …) are absent on purpose: if an engine path ever draws one, its fallback string
   * surfaces in the §10 A whitelist scan. Add a key only with a DESIGN reference. */
  E3.STR = Object.freeze({
    noResult: "'{q}'에 대한 검색 결과가 없습니다.",
    converting: '텍스트로 바꾸는 중…',
    textNote: '자동 변환 · 흐린 글자는 인식이 불확실한 부분입니다.',
    connecting: '연결 중…',
    callEnd: '통화 종료',
    noAnswer: '상대방이 응답하지 않습니다',
    connFail: '연결 실패',
    powerOff: '전화기가 꺼져 있어 삐 소리 후 음성사서함으로 연결됩니다.',
    swipeOpen: '위로 밀어서 열기',
    emergency: '긴급 통화',
    photoDeleted: '삭제된 사진입니다',
    memoEmpty: '메모 없음',
    noRec: '녹음 없음',
    noChat: '대화 내용이 없습니다',
    noEvent: '일정 없음',
    noNotif: '알림 없음',
    noBlocked: '직접 차단한 번호 없음',
    dndLogFoot: '최근 365개의 기록만 보관합니다.',
    recFoot: '녹음 파일은 이 휴대전화에만 저장됩니다.',
    recAuto: '통화가 끝나면 자동으로 녹음됩니다.',
    spamShort: '스팸으로 신고된 번호의 전화와 문자를 자동으로 막습니다.',
    spamLong: '스팸으로 신고된 번호의 전화와 문자를 자동으로 막습니다. 막은 전화는 울리지 않고 최근 기록에 남지 않습니다.',
    easyDesc: '더 큰 글씨와 단순한 홈 화면, 단순한 앱 화면을 사용합니다.',
    repeatCall: '3분 안에 같은 번호로 다시 걸려 오면 울립니다.',
    loading: '불러오는 중…',
    exitAgain: '한 번 더 누르면 종료됩니다',
    resume: '🔈 소리 다시 켜기',
    restart3: '진행 상황이 지워집니다.',
    recanonQ: '이번 선택으로 바꿀까요?',
    soundCard: '소리가 들리지 않으면 무음 모드를 끄고 볼륨을 올려 주세요.',
  });

  /* ---------------- monologue lines (§2.4 · §3.0 · §4.14.4) ---------------- */
  E3.MONO = Object.freeze({
    mono1: '…내 이름이다.',
    mono2: '…이 사진도 봤구나.',
    recap: Object.freeze(['두 달 전 24일, 404호. 나는 세아의 폰으로 문을 열고 나왔다.',
      '지난달 24일, 그 사람이 내 옛 폰을 돌려줬다. 한 달 동안 나인 척 살던 폰이었다.',
      '크리스마스 새벽, 세아의 계정에서 음성 메시지가 왔다. 오르골을 흥얼거리는 소리였다.',
      '세아는 아직 돌아오지 않았다. 오늘은 세아 엄마의 집에서 잔다.']),
  });

  /* ---------------- identity (facade only — {MAKER} appears on screen only in the credits line, §0.3 D24) ---------------- */
  E3.maker = function () {
    const c = CFG();
    const mc = typeof c.MAKER_CONTACT === 'string' ? c.MAKER_CONTACT.trim() : '';
    if (mc) return mc;
    const mn = typeof c.MAKER_NAME === 'string' ? c.MAKER_NAME.trim() : '';
    return !mn || mn === '너의 친구' ? '친구' : mn;
  };
  E3.makerHandle = () => '';
  E3.makerAvatar = () => '';
  E3.less = () => !!(G.settings && G.settings.scares !== 'full');
  E3.speaker = () => !!(G.settings && (G.settings.audioMode === 'speaker' || G.settings.sound === false));
  let slowFrame = false;
  try { requestAnimationFrame((t1) => requestAnimationFrame((t2) => { slowFrame = t2 - t1 > 24; })); } catch (e) {}
  E3.lowEnd = () => !!((navigator.deviceMemory && navigator.deviceMemory <= 2) || slowFrame);

  /* ---------------- image resolver (§8.3-1 'assets.js 규칙') ----------------
   * G.IMG[key] (assets.js — '' = the file is missing → the renderer's §9.8 fallback) · ep1 reuse keys → ../assets/img/<key>.jpg
   * · kongi_santa → ../ep2/assets/img/kongi_santa.jpg · raw paths pass through · ep3 keys without a registry (assets.js not
   * loaded) → assets/img/<key>.jpg ('.png' for x3_* · icon_*) · anything else unknown → ''. */
  const REUSE1 = /^(avatar_sea|avatar_mom|avatar_jimin|avatar_sagongsa|kongi_old|dog_face|dog_park|dog_bed)$/;
  const EP3KEY = /^(r3|x3|c3|p3|t3)_[a-z0-9_]+$|^(og_ep3|icon_ep3|icon_ep3_192)$/;
  E3.img = function (key) {
    if (!key) return '';
    key = String(key);
    if (G.IMG && Object.prototype.hasOwnProperty.call(G.IMG, key)) return G.IMG[key] || '';
    if (/[/.]/.test(key)) return key;
    if (REUSE1.test(key)) return '../assets/img/' + key + '.jpg';
    if (key === 'kongi_santa') return '../ep2/assets/img/kongi_santa.jpg';
    if (G.IMG) return '';                                       // registry loaded and the key is not in it → missing
    if (!EP3KEY.test(key)) return '';
    return 'assets/img/' + key + (/^(x3_|icon_)/.test(key) ? '.png' : '.jpg');
  };

  /* ---------------- formatting (§0.1 #18 — non-2027 dates carry the year · today = '오늘') ---------------- */
  let STRIP;
  try { STRIP = new RegExp('[\\s\\p{P}\\p{S}\\p{Extended_Pictographic}\\u200d\\ufe0e\\ufe0f]', 'gu'); }
  catch (e) { STRIP = /[\s!-\/:-@\[-`{-~ -⁯　-〿＀-￯←-⯿\ud83c-􏰀-\udfff️‍]/g; }
  E3.norm = function (s) {
    let t = String(s == null ? '' : s);
    try { t = t.normalize('NFC'); } catch (e) {}
    return t.trim().replace(STRIP, '').toLowerCase();
  };
  const pad = (n) => String(n).padStart(2, '0');
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  E3.clamp = (x, a, b) => Math.max(a, Math.min(b, Number(x) || 0));
  E3.fmt12 = function (hm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ''));
    if (!m) return String(hm || '');
    const h = +m[1], mi = +m[2];
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(mi)}`;
  };
  E3.fmtK = function (d) { d = d instanceof Date ? d : new Date(d); return E3.fmt12(pad(d.getHours()) + ':' + pad(d.getMinutes())); };
  E3.ymd = function (d) { d = d instanceof Date ? d : new Date(d == null ? Date.now() : d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  function parseDay(x) {
    if (x instanceof Date) return new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(x || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function gameToday() {
    try { const d = G.clock && G.clock.now ? G.clock.now() : null; if (d && !isNaN(d.getTime())) return d; } catch (e) {}
    return new Date(2027, 0, 24);
  }
  E3.dow = function (x) { const d = parseDay(x); return d ? WEEK[d.getDay()] : ''; };
  /** '2026-12-24' → '2026년 12월 24일 (목)' · this (in-game) year → '1월 23일 (토)' · the in-game today → '오늘' ({today:false} off) */
  E3.fmtDate = function (x, o) {
    const d = parseDay(x);
    if (!d) return String(x == null ? '' : x);
    const now = gameToday();
    if (!(o && o.today === false) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return '오늘';
    const md = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
    return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
  };

  /* ---------------- stage (only writer of G.state.stage — §9.3 ③) ---------------- */
  const STAGE_KEYS = ['e3_played', 'e3_dnd', 'easyBack'];
  E3.stage = function (key, value) {
    if (STAGE_KEYS.indexOf(key) < 0) { dwarn('stage:' + key, 'unknown stage key', key); return; }
    if (!G.state) return;
    G.state.stage = G.state.stage || {};
    G.state.stage[key] = value;
    save();
  };

  /* ---------------- free-text session store (§9.2 자유 입력 · ARCH §8.1-7) ---------------- */
  const SS_KEY = () => (G.EP && G.EP.SESSION_KEY) || 'haru-escape.ep3.session';
  let ssMem = {};
  const ssRead = () => { try { const r = JSON.parse(sessionStorage.getItem(SS_KEY()) || '{}'); return r && typeof r === 'object' ? r : {}; } catch (e) { return ssMem; } };
  E3.session = {
    set(id, text) { const o = ssRead(); o[id] = String(text == null ? '' : text); ssMem = o; try { sessionStorage.setItem(SS_KEY(), JSON.stringify(o)); } catch (e) {} },
    get(id) { const o = ssRead(); return Object.prototype.hasOwnProperty.call(o, id) ? o[id] : null; },
    clear() { ssMem = {}; try { sessionStorage.removeItem(SS_KEY()); } catch (e) {} },
  };

  /* ---------------- persistent playMs scheduler (vars.sched — ids owner-prefixed, ARCH §5.0) ---------------- */
  const handlers = [];
  const Q = () => { const v = V(); if (!Array.isArray(v.sched)) v.sched = []; return v.sched; };
  function matchKey(key, id) { return key === id || (key.endsWith('*') && id.indexOf(key.slice(0, -1)) === 0) || (key.endsWith(':') && id.indexOf(key) === 0); }
  E3.sched = {
    at(at, id, data) {
      if (!id || !G.state) return null;
      const q = Q(), e = { at: Math.round(Number(at) || 0), id: String(id) };
      if (data !== undefined) e.data = data;
      const i = q.findIndex((x) => x.id === e.id);
      if (i >= 0) q[i] = e; else q.push(e);
      q.sort((a, b) => a.at - b.at);
      save();
      return e.id;
    },
    after(ms, id, data) { return E3.sched.at(pmNow() + (Number(ms) || 0), id, data); },
    cancel(id) {
      if (!G.state) return;
      const q = Q(), key = String(id);
      const keep = q.filter((e) => !(key.endsWith('*') ? e.id.indexOf(key.slice(0, -1)) === 0 : e.id === key));
      if (keep.length !== q.length) { V().sched = keep; save(); }
    },
    has(id) { return !!G.state && Q().some((e) => e.id === id); },
    when(id) { if (!G.state) return null; const e = Q().find((x) => x.id === id); return e ? e.at : null; },
    on(key, fn) { if (typeof fn === 'function') handlers.push({ key: String(key), fn }); },
    list() { return G.state ? Q().map((e) => Object.assign({}, e)) : []; },
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
      save();
      try { h.fn(e.data, e.id); } catch (err) { console.error('[e3 sched]', id, err); }
    });
  }

  /* ---------------- places (§2.3) ---------------- */
  const MOM_AT = ['table', 'sr', 'hall', 'lv'];
  /** reader; with v the only writer of vars.momAt (callers: flow call 'sr' · room door 'hall','lv' · memory 'sr' · climax 'lv') */
  E3.momAt = function (v) {
    if (v !== undefined) {
      if (MOM_AT.indexOf(v) < 0) { dwarn('momAt:' + v, 'bad momAt', v); return E3.momAt(); }
      if (G.vars && G.state && G.vars('momAt') !== v) G.vars('momAt', v);
      return v;
    }
    const m = V().momAt;
    return MOM_AT.indexOf(m) >= 0 ? m : 'table';
  };
  E3.where = () => (V().where === 'sr' ? 'sr' : 'lv');

  /* ---------------- hub (§2.1 · §3.11 · §12.2 V8) ---------------- */
  const HUB = ['nameKnown', 'blockBottom', 'albumDone'];
  E3.hub = function () {
    const items = {}; HUB.forEach((f) => { items[f] = flag(f); });
    return { k: HUB.filter(flag).length, TB: V().TB != null ? V().TB : null, items };
  };
  E3.m6Due = () => (flag('M5') && pm('M5') != null ? pm('M5') + 60000 : null);
  E3.battery = () => (G.battery ? G.battery() : 72);
  /* room owns these values (§8.3-5) — thin delegations (ARCH §9 G31) */
  const roomState = () => safe(() => (G.room && G.room.state ? G.room.state() : null), null) || {};
  E3.led = () => roomState().led || 'green';
  E3.grade = () => roomState().grade || null;
  E3.layers = (view) => safe(() => (G.room && G.room.layers ? G.room.layers(view) : (roomState().layers || {})[view] || null), null);

  /* ---------------- monologue channel (§2.4 · §6.1.3 'wait' + M6 window · §0.3 D4) ---------------- */
  const MONO_MS = 3200;
  const monoWait = {};
  let monoBusy = false;
  /** the director answers when it exists (BD().safeKinds.mono = S1 S2 S3 S4 S6 S7 S8 S9); this local copy is the partial-build fallback */
  function monoSafe() {
    try {
      if (G.director && G.director.safe) return !!G.director.safe('mono');
      if (G.ui && (G.ui.inputActive ? G.ui.inputActive() : G.ui.keyboardOpen && G.ui.keyboardOpen())) return false;   // S1
      if (G.notebook && G.notebook.isOpen && G.notebook.isOpen()) return false;                                     // S2
      if (G.callrec && G.callrec.state && (G.callrec.state().playing || (G.callrec.sinceStopMs && G.callrec.sinceStopMs() < 2000))) return false;   // S4
      const p = pmNow();
      if (['M1', 'M2', 'M3', 'M4', 'M5'].some((m) => pm(m) != null && p - pm(m) < 20000)) return false;          // S6
      if (G.cards && G.cards.showing && G.cards.showing()) return false;                                            // S7
      if (G.chips && G.chips.isOpen && G.chips.isOpen()) return false;                                              // S8
      if ((G.phone && G.phone.inCall && G.phone.inCall()) || (G.phone && G.phone.modalOpen && G.phone.modalOpen())) return false;   // S9
    } catch (e) { return false; }
    return true;
  }
  /** §6.1.3 M6 window: a line whose turn falls in [M6 due − 12 s, M7) is dropped (D4) — END and after: no monologue (§4.14.4) */
  function inM6Window() {
    if (flag('END')) return true;
    if (flag('M7')) return false;
    if (flag('M6')) return true;
    const due = E3.m6Due();
    return due != null && pmNow() >= due - 12000;
  }
  function dropMono(id) {
    const v = V(), p = Math.round(pmNow());
    const d = v.dir && typeof v.dir === 'object' && !Array.isArray(v.dir) ? v.dir : (v.dir = {});
    if (!d.dropped || typeof d.dropped !== 'object' || Array.isArray(d.dropped)) d.dropped = {};
    if (d.dropped[id] == null) d.dropped[id] = p;
    const st = ES();
    st.dropped = Array.isArray(st.dropped) ? st.dropped : [];
    if (st.dropped.indexOf(id) < 0) st.dropped.push(id);
    dwarn('drop:' + id, 'monologue dropped by the M6 window:', id);
    save();
  }
  const isDropped = (id) => { const d = ES().dropped; return Array.isArray(d) && d.indexOf(id) >= 0; };
  let recapRun = null;
  E3.mono = function (id) {
    if (id === 'recap') return playRecap();
    if (typeof E3.MONO[id] !== 'string') return Promise.resolve(false);
    if (flag(id) || isDropped(id)) return Promise.resolve(false);
    const st = ES();
    st.monoQ = Array.isArray(st.monoQ) ? st.monoQ : [];
    if (st.monoQ.indexOf(id) < 0) { st.monoQ.push(id); save(); }
    return new Promise((res) => { (monoWait[id] = monoWait[id] || []).push(res); pumpMono(); });
  };
  function settle(id, v) { (monoWait[id] || []).forEach((r) => r(v)); delete monoWait[id]; }
  async function pumpMono() {
    if (monoBusy || recapRun || !G.state) return;
    const st = ES(), q = Array.isArray(st.monoQ) ? st.monoQ : (st.monoQ = []);
    while (q.length && (flag(q[0]) || isDropped(q[0]))) settle(q.shift(), false);
    if (!q.length) return;
    if (!(G.clock && G.clock.running && G.clock.running())) return;   // paused / hidden / not started
    if (!monoSafe()) return;
    const id = q[0];
    if (inM6Window()) { q.shift(); dropMono(id); settle(id, false); return; }
    monoBusy = true;
    G.flag(id, true);                                               // the flag means "the line was displayed"
    bus.emit('mono:show', { id });
    try { await (G.fx && G.fx.mono ? G.fx.mono(E3.MONO[id], MONO_MS) : sleep(MONO_MS)); } catch (e) { console.error('[e3 mono]', e); }
    const i = q.indexOf(id); if (i >= 0) q.splice(i, 1);
    save();
    monoBusy = false;
    bus.emit('mono:hide', { id });
    settle(id, true);
  }
  /** the 4 recap lines (§3.0 · §4.0 R1): 3.2 s each on the monologue channel, recapNext() = tap → next line, recapSkip() =
   *  [건너뛰기] (resolves false). Not queued, not gated (it runs before the cold open). recapShown is flow's flag. */
  function playRecap() {
    if (recapRun) return recapRun.p;
    const run = { skipped: false };
    run.p = (async () => {
      const lines = E3.MONO.recap;
      for (let i = 0; i < lines.length && !run.skipped; i++) {
        bus.emit('mono:show', { id: 'recap', line: i });
        try { await (G.fx && G.fx.mono ? G.fx.mono(lines[i], MONO_MS, { cls: 'c3-recap' }) : sleep(MONO_MS)); } catch (e) { console.error('[e3 recap]', e); }
        bus.emit('mono:hide', { id: 'recap', line: i });
      }
      recapRun = null;
      setTimeout(pumpMono, 0);
      return !run.skipped;
    })();
    recapRun = run;
    return run.p;
  }
  E3.recapNext = () => { if (recapRun && G.fx && G.fx.monoNext) G.fx.monoNext(); };
  E3.recapSkip = () => { if (!recapRun) return; recapRun.skipped = true; if (G.fx && G.fx.monoClear) G.fx.monoClear(); };

  /* ---------------- ep2 facade stubs (never used by ep3 code — ARCH §4.3) ---------------- */
  E3.requestM2 = () => false;
  E3.answerOk = () => false;
  E3.whereOk = () => false;
  E3.world = () => ({});
  E3.facts = () => ({});
  E3.factCount = () => 0;
  E3.nUiVisible = () => !(G.phone && G.phone.isLocked && G.phone.isLocked());

  /* ---------------- 1·2편 callbacks & series (§3.17 · §9.3 — the code there is normative) ---------------- */
  const NEUTRAL = { _v: 1, A: false, A1: false, B: 'none', C: false, D: false, E: true };
  E3.cbPreview = Object.assign({}, NEUTRAL);
  E3.ep3Done = false;
  E3.cb = function (k) {
    const c = G.state && G.state.cb && G.state.cb._v === 1 ? G.state.cb : (E3.cbPreview || NEUTRAL);
    if (k === undefined) return Object.assign({}, c);
    return Object.prototype.hasOwnProperty.call(c, k) ? c[k] : NEUTRAL[k];
  };
  let fixtureApplied = false;
  E3.seriesBoot = function () {                       // ① 타이틀 로드
    const S = G.series;
    if (G.DEBUG && !fixtureApplied) {
      fixtureApplied = true;
      const m = /[?&]series=(S\d{1,2})\b/.exec(location.search);
      if (m && FIXTURES[m[1]]) applyFixture(m[1]);
    }
    if (!S) { dwarn('series', 'engine/series.js missing — neutral callbacks'); E3.cbPreview = Object.assign({}, NEUTRAL); E3.ep3Done = false; return; }
    try { S.ensure(); S.backfillEp1(); } catch (e) {}
    let e1 = { st: 'none' }, e2 = { st: 'none' };
    try { e1 = S.ep(1); } catch (e) {}
    try { e2 = S.ep(2); } catch (e) {}
    const s = (k) => { try { return S.s(k); } catch (e) { return undefined; } };
    let sea = []; try { sea = S.sea(); } catch (e) {}
    const d1 = e1.st === 'done', d2 = e2.st === 'done';            // 선택형 = 그 편 done일 때만(SERIES §7.5) · '했다'형(sea) = 그대로
    E3.cbPreview = {
      _v: 1,
      A:  d1 && (s('e1_momRead') === true || s('e1_momTold') === true),
      A1: d1 && s('e1_momRead') === true,
      B:  d2 ? (s('e2_jimin') === true ? 'yes' : 'no') : 'none',
      C:  d2 && s('e2_phone') === 'kept',
      D:  Array.isArray(sea) && sea.indexOf('sig_fifth') >= 0,
      E:  !d2,
    };
    try { E3.ep3Done = S.ep(3).st === 'done'; } catch (e) { E3.ep3Done = false; }
    retryCommit('boot');
    if (G.state && flag('HOOK') && !V().patched) patchSeries();    // §3.22 · §9.3 ⑤ — patch from stage (hookDone untouched)
  };
  E3.seriesStart = function () {                      // ② introDone
    if (!G.state) return;
    const st = G.state;
    if (!st.cb || st.cb._v !== 1) st.cb = Object.assign({ _v: 1 }, E3.cbPreview || NEUTRAL);
    st.vars.replay = !!E3.ep3Done;
    try {
      if (G.series && G.series.ep(3).st === 'none')
        G.series.patch((r) => { r.eps['3'] = Object.assign({ st: 'none', on: null, min: null, hints: null, src: 'default', canon: false }, r.eps['3'], { st: 'started', src: 'play' }); });
    } catch (e) {}
    save(true);
  };
  const seenE3 = () => ({ e3_block: flag('blockBottom'), e3_dndLog: flag('dndOpened'), e3_grey: flag('greySeen'),
    e3_height: flag('heightSeen'), e3_radio: flag('radioHeard'), e3_cake: flag('calCake') });
  E3.commit = function (opts) {                       // ④ END — called by flow ending in the function that draws the 05:30 line
    if (!G.state) return false;
    const v = G.state.vars, st = G.state.stage || {};
    if (v.committed && !(opts && opts.overwrite)) return true;
    const payload = {
      ep:   { st: 'done', on: E3.ymd(new Date()), min: E3.clamp(Math.round(G.state.playMs / 60000), 0, 600),
              hints: E3.clamp(G.state.hintsUsed | 0, 0, 99), src: 'play', canon: true },
      s:    { e3_played: st.e3_played !== false, e3_dnd: !!st.e3_dnd },
      seen: seenE3(),
      sea:  flag('sigName') ? ['sig_name'] : [],
    };
    let ok = false;
    try { ok = !!(G.series && G.series.commit(3, payload, opts || {})); } catch (e) { ok = false; }
    if (ok) v.committed = true; else { v.commitTries = (v.commitTries | 0) + 1; dwarn('commit' + v.commitTries, 'series commit not stored (try ' + v.commitTries + ')'); }
    save(true);
    return ok;
  };
  /** §9.3: END ∧ ¬committed ∧ tries < 5 → quiet retry (UI 0) on the next 'screen:push' / boot. While the series engine is in
   *  memory mode (storage failed this session) only the boot retry runs — an in-session retry cannot land. */
  function retryCommit(why) {
    const v = G.state && G.state.vars;
    if (!v || !flag('END') || v.committed || (v.commitTries | 0) >= 5) return;
    if (why !== 'boot') { let mm = false; try { mm = !!(G.series && G.series.memory && G.series.memory()); } catch (e) {} if (mm) return; }
    E3.commit();
  }
  function patchSeries() {
    const stg = (G.state && G.state.stage) || {};
    const seen = seenE3();
    let ok = false;
    try {
      ok = !!(G.series && G.series.patch((r) => {
        r.s = r.s || {}; r.seen = r.seen || {}; r.sea = Array.isArray(r.sea) ? r.sea : [];
        if (stg.easyBack === true) r.s.e3_easyBack = true;                         // false → true only
        Object.keys(seen).forEach((k) => { if (seen[k]) r.seen[k] = true; });     // re-OR
        if (flag('sigName') && r.sea.indexOf('sig_name') < 0 && r.sea.length < 16) r.sea.push('sig_name');   // idempotent
      }));
    } catch (e) { ok = false; }
    if (ok && G.state) G.state.vars.patched = true;
    return ok;
  }
  /** ⑤ hook end — soft = pagehide / hidden while the hook is up: patch yes, hookDone only after hookOpened (dir B28) */
  E3.hookPatch = function (soft) {
    if (!G.state) return;
    if (soft && typeof soft === 'object') soft = !!soft.soft;
    patchSeries();
    if (!soft || flag('hookOpened')) { if (!flag('hookDone')) G.flag('hookDone', true); }
    save(true);
  };

  /* ---------------- evaluation: M2 · hub → M3 M4 M5 · M6 due · battery (ARCH §5.3) ---------------- */
  function evalHub() {
    const v = V(), p = pmNow();
    if (flag('easyOff') && !flag('M2')) G.flag('M2', true);
    const k = HUB.filter(flag).length;
    if ((v.hubK | 0) !== k) G.vars('hubK', k);
    if (v.TB == null && flag('nameKnown') && flag('blockBottom')) {
      const a = pm('nameKnown'), b = pm('blockBottom');
      G.vars('TB', a != null && b != null ? Math.max(a, b) : Math.round(p));
    }
    if (flag('M2') && !flag('M3') && k >= 1 && pm('M2') != null && p >= pm('M2') + 120000) G.flag('M3', true);
    else if (flag('M3') && !flag('M4') && k >= 2 && pm('M3') != null && p >= pm('M3') + 120000) G.flag('M4', true);
    else if (flag('M4') && !flag('M5') && pm('M4') != null && p >= pm('M4') + 120000) {
      const TB = V().TB;
      if (k === 3 || (TB != null && p >= TB + 180000)) G.flag('M5', true);
    }
  }
  function evalBattery() {
    if (!flag('gotPhone') || !G.EP || !G.EP.CLOCK) return;
    const rows = G.EP.CLOCK.ms || [];
    let i = -1; for (let j = 0; j < rows.length; j++) if (flag(rows[j][0])) i = j;
    if (i < 0 || rows[i][4] == null) return;
    const row = rows[i][4], next = rows[i + 1] && rows[i + 1][4] != null ? rows[i + 1][4] : row;
    const at = pm(rows[i][0]);
    const val = Math.max(Math.min(next, row), row - Math.floor(Math.max(0, pmNow() - (at == null ? pmNow() : at)) / 180000));
    if (V().battery !== val) G.vars('battery', val);
  }
  function scheduleM6() {
    if (!flag('M5') || flag('M6')) return;
    const st = ES(), due = E3.m6Due();
    if (due == null) return;
    if (!st.m6Emitted && !E3.sched.has('e3:m6due')) E3.sched.at(due, 'e3:m6due', { dueAt: due });
    if (st.m6Emitted && !E3.sched.has('e3:m6fb')) E3.sched.at(due + 40000, 'e3:m6fb', { dueAt: due });
  }
  function evaluate() {
    if (!G.state || !flag('introDone')) return;
    evalHub();
    evalBattery();
    pumpMono();
  }

  let inited = false;
  E3.init = function () {
    if (inited) return; inited = true;
    E3.sched.on('e3:m6due', (d) => {
      if (flag('M6')) return;
      const dueAt = (d && d.dueAt) || E3.m6Due() || Math.round(pmNow());
      ES().m6Emitted = true;
      E3.sched.at(dueAt + 40000, 'e3:m6fb', { dueAt });
      save();
      bus.emit('m6:due', { dueAt });
    });
    E3.sched.on('e3:m6fb', () => {                    // ARCH §5.3 — only when room door.js is not on the page
      if (flag('M6') || G.door) return;
      dwarn('m6fb', 'G.door missing — core sets M6 (fallback)');
      safe(() => { if (G.cards && G.cards.close) G.cards.close({ reason: 'm6' }); });
      safe(() => { if (G.chips && G.chips.close) G.chips.close('m6'); });
      G.flag('M6', true);
    });
    bus.on('flag', (name) => {
      if (name === 'M5') scheduleM6();
      if (name === 'M6') { E3.sched.cancel('e3:m6due'); E3.sched.cancel('e3:m6fb'); }
      evaluate();
    });
    bus.on('rec:text', (e) => { if (e && e.id === 'sea0333' && e.open === false && flag('nameKnown') && !flag('mono1')) E3.mono('mono1'); });
    bus.on('gallery:photo', (e) => { if (e && e.door === true && e.open === false && flag('albumDone') && !flag('mono2')) E3.mono('mono2'); });
    bus.on('screen:push', () => retryCommit());
    bus.on('state:load', () => { scheduleM6(); retryCommit(); });
    bus.on('state:reset', () => { E3.session.clear(); });
    if (G.clock && G.clock.onTick) G.clock.onTick(() => { runSched(); evaluate(); if (G.DEBUG && !G.APP) debugTick(); });
    scheduleM6();
    if (G.DEBUG) { wrapVibrate(); debugUI(); }
  };

  /* ---------------- G.sd — shared helpers for story-data apps (ep2 e2.js set, same behaviour) ---------------- */
  const SD = (G.sd = G.sd || {});
  SD.T = (s) => (G.T ? G.T(s) : s);
  SD.img = E3.img;
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
    if (url) im.src = url; else setTimeout(() => im.onerror && im.onerror(), 0);
    return im;
  };
  SD.note = function () { dwarn('sd.note', 'G.sd.note is a no-op in ep3 (hard mode)'); };
  SD.lead = function () { dwarn('sd.lead', 'G.sd.lead is a no-op in ep3 (hard mode)'); };
  SD.tone = function () { dwarn('sd.tone', 'G.sd.tone is a no-op in ep3 — notification sounds go through G.phone.notify'); };
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
  SD.dayLabel = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
  SD.rng = function (seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  SD.pd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  SD.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /** day('2026-12-12', [['them','20:10','text', {extra}], …], common) */
  SD.day = function (date, rows, common) {
    return (rows || []).map((r) => Object.assign({ from: r[0], t: date + ' ' + r[1], text: r[2] }, common || {}, r[3] || {}));
  };

  /* ---------------- DEBUG: series QA fixtures (§9.3 S1–S13 — memory mode, real storage untouched) ---------------- */
  const T0 = new Date(2026, 10, 24, 5, 0).getTime();
  const e1Save = (flags, vars, playMs, hints) => ({ v: 1, flags: Object.assign({ introDone: T0 - 3600000 }, flags), vars: vars || {}, playMs: playMs || 0,
    hintsUsed: hints | 0, threads: {}, notifs: [], read: {}, fragments: {}, seen: {} });
  const E1_DONE = (extra) => e1Save(Object.assign({ M1: T0 - 3000000, END: T0 }, extra), {}, 2820000, 3);
  const EP1 = { st: 'done', on: '2026-11-24', min: 47, hints: 3, src: 'live', canon: true };
  const EP2 = (st) => (st === 'done' ? { st: 'done', on: '2026-12-25', min: 44, hints: 1, src: 'play', canon: true } : { st: 'started', on: null, min: null, hints: null, src: 'play', canon: false });
  const rec = (eps, s, seen, sea, extra) => Object.assign({ v: 1, rev: 4, created: '2026-11-24', last: eps[3] ? 3 : eps[2] && eps[2].st === 'done' ? 2 : 1, eps, s: s || {}, seen: seen || {}, sea: sea || [] }, extra || {});
  const FIXTURES = {
    S1: { rec: null, e1: null },
    S2: { rec: null, e1: E1_DONE({ momRead: T0 - 200000 }) },
    S3: { rec: null, e1: E1_DONE({ momTold: T0 - 200000 }) },
    S4: { rec: null, e1: e1Save({ M1: T0 - 3000000, momRead: T0 - 200000 }, {}, 1500000, 1) },
    S5: { rec: rec({ 1: EP1, 2: EP2('done') }, { e2_jimin: true, e2_phone: 'kept' }, { e2_piyo: true }, ['sig_piyo', 'sig_fifth']), e1: null },
    S6: { rec: rec({ 1: EP1, 2: EP2('done') }, { e2_jimin: false, e2_phone: 'police' }, {}, []), e1: null },
    S7: { rec: rec({ 1: EP1, 2: EP2('started') }, {}, {}, []), e1: null },
    S8: { rec: rec({ 1: EP1, 2: EP2('done'), 3: { st: 'done', on: '2027-01-24', min: 46, hints: 2, src: 'play', canon: true } },
      { e2_jimin: true, e2_phone: 'police', e3_played: true, e3_dnd: false, e3_easyBack: true }, { e3_block: true, e3_grey: true }, ['sig_fifth', 'sig_name']), e1: null },
    S9: { rec: { v: 2, rev: 9, created: '2026-11-24', last: 4, eps: { 1: { st: 'done', canon: true }, 2: { st: 'done', canon: true } }, s: {}, seen: {}, sea: [], future: { x: 1 } }, e1: null },
    S10: { rec: null, e1: null, blocked: true },     // the engine fixture store accepts writes — real blocked storage = ep3_branches.js
    S11: { rec: rec({ 1: EP1, 2: EP2('done'), 3: { st: 'done', on: '2027-01-24', min: 45, hints: 0, src: 'play', canon: true } },
      { e2_jimin: false, e2_phone: 'police', e3_played: true, e3_dnd: false }, { e3_block: true, e3_grey: true }, []), e1: null },
    S12: { rec: null, e1: null },                    // post-diff watchdog: same as S1 — e3_height/radio/cake + e3_easyBack must land
    S13: { rec: rec({ 1: EP1, 2: EP2('started') }, {}, {}, []), e1: null },
  };
  function applyFixture(id) {
    const fx = FIXTURES[id];
    if (!fx || !G.series || !G.series._fixture) return false;
    G.series._fixture(JSON.parse(JSON.stringify(fx)));
    console.info('[e3] series QA profile', id, '(memory mode — real storage untouched)');
    return true;
  }
  E3._fixtures = G.DEBUG ? FIXTURES : null;

  /* ---------------- DEBUG: budget meter + error lines (z 900) ---------------- */
  const vibLog = [];
  function wrapVibrate() {
    try {
      const nav = navigator;
      if (typeof nav.vibrate !== 'function' || nav.vibrate.__e3) return;
      const orig = nav.vibrate.bind(nav);
      const spy = function (p) { vibLog.push({ p: Array.isArray(p) ? p.slice() : p, pm: Math.round(pmNow()) }); return orig(p); };
      spy.__e3 = true;
      nav.vibrate = spy;
    } catch (e) {}
  }
  function countHis() {
    let n = 0; const seen = new Set();
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 8 || seen.has(o)) return;
      seen.add(o);
      if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
      if (o.his === true) n += 1;
      Object.keys(o).forEach((k) => { if (k !== 'his') walk(o[k], depth + 1); });
    };
    try { walk(G.STORY || {}, 0); } catch (e) {}
    return n;
  }
  if (!G.APP || G.DEBUG) E3.budget = function () {   // QA only: left out of the app build (G.APP && !G.DEBUG)
    const dir = V().dir || {}, fired = dir.fired || {};
    const recs = safe(() => ((G.BEATDATA3 || G.BEATDATA2 || {}).beats || []), []) || [];
    const jumps = recs.filter((b) => b && b.cls === 'jump' && fired[b.id] != null).length;
    return {
      hisLines: countHis(),
      jumps,
      stings: flag('boilerSting') ? 1 : 0,
      monos: ['mono1', 'mono2'].filter(flag).length + (flag('recapShown') ? 4 : 0),
      vibrate: vibLog.length,
      vibrations: vibLog.map((x) => x.p),
      audioVibrate: safe(() => (G.audio && G.audio.stats ? G.audio.stats.vibrate | 0 : 0), 0),     // audio's own counter (A.stats.vibrate · A.vibLog)
      audioVibLog: safe(() => (G.audio && Array.isArray(G.audio.vibLog) ? G.audio.vibLog.slice(-20) : []), []),
      imgKeys: G.IMG ? Object.keys(G.IMG).filter((k) => typeof G.IMG[k] === 'string' && /^assets\//.test(G.IMG[k])).length : 0,
    };
  };
  let dbgBox = null, dbgErr = null, dbgN = 0;
  function debugUI() {
    if (!G.DEBUG || G.APP || dbgBox || !document.body) return;
    const host = document.getElementById('phone') || document.body;
    dbgBox = document.createElement('div'); dbgBox.className = 'c2-debug-meter c3-debug-meter'; dbgBox.setAttribute('data-qa', 'debug.meter');
    dbgErr = document.createElement('div'); dbgErr.className = 'c2-debug-err';
    dbgErr.addEventListener('click', () => { dbgErr.innerHTML = ''; });
    host.appendChild(dbgBox); host.appendChild(dbgErr);
  }
  function debugTick() {
    if (++dbgN % 8) return;
    debugUI();
    if (!dbgBox) return;
    const b = E3.budget();
    const okVib = (p) => (Array.isArray(p) ? p.join(',') === '400,200,400' || p.join(',') === '80' : p === 80);   // ARCH §1: ring3 · sms only
    const over = b.hisLines > 1 || b.jumps > 0 || b.stings > 1 || b.monos > 6 || !b.vibrations.every(okVib);
    dbgBox.classList.toggle('over', over);
    dbgBox.textContent = `his ${b.hisLines}/1 · jump ${b.jumps}/0 · sting ${b.stings}/1 · mono ${b.monos}/6 · vib ${b.vibrate} · ${G.clock ? G.clock.hm() : ''} · ${Math.round(pmNow() / 1000)}s`;
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
  if (G.DEBUG) {
    const ce = console.error.bind(console);
    console.error = function (...a) { ce(...a); debugError(a.map((x) => (x && x.message) || (typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x))).join(' ')); };
    W.addEventListener('error', (e) => debugError('error: ' + (e.message || e)));
    W.addEventListener('unhandledrejection', (e) => debugError('promise: ' + ((e.reason && e.reason.message) || e.reason)));
  }

  /* ---------------- DEBUG: haru.jump prerequisite table (ARCH §7.3 — cumulative) ---------------- */
  const roomSet = (k, v) => ({ fn: () => { if (G.room && G.room.set) G.room.set(k, v); } });
  const marks = (...ids) => ids.map((id) => ({ mark: id }));
  const seq = (k, v) => ({ fn: () => { const s = V().seq && typeof V().seq === 'object' ? Object.assign({}, V().seq) : { m1: null, m6: null, m7: null, m8: null }; s[k] = v; G.vars('seq', s); } });
  const JUMP = [
    ['M0', [{ f: 'introDone' }, { f: 'recapShown', when: () => !!E3.cb('E') }, { f: 'M0' }, ...marks('B00', 'B01')]],
    ['M1', [{ f: 'momLine1' }, { f: 'M1' }, { f: 'callRing' }, { f: 'callAnswered' }, { f: 'callEnded' }, { f: 'handover' }, seq('m1', 'done'),
      { momAt: 'sr' }, roomSet('srGap', 0.25), roomSet('srLamp', 'dim'), { clock: '03:35' }, ...marks('B02', 'B03', 'B04', 'B05', 'B06')]],
    ['gotPhone', [{ f: 'gotPhone' }, { lock: 'hide' }]],
    ['M2', [{ f: 'easyOff' }, { easy: false }, { f: 'M2' }]],
    ['M3', [{ sms: 'k0341', f: 'kang341' }, { f: 'recListOpened' }, { f: 'recPlayerOpened' }, { f: 'recPlayed' }, { f: 'textAnyOpened' }, { f: 'textOpened' },
      { f: 'greySeen' }, { f: 'heard21' }, { f: 'nameKnown' }, { f: 'M3' }]],
    ['M4', [{ f: 'blockOpened' }, { f: 'blockBottom' }, { tb: true }, { f: 'M4' }]],
    ['M5', [{ f: 'albumOpened' }, { f: 'membersSeen' }, { f: 'bomSeen' }, { f: 'albumDone' }, { f: 'M5' }]],
    ['M6', [{ f: 'M6' }, seq('m6', null)]],
    ['M7', [{ f: 'bip' }, { f: 'view0AfterM6' }, { f: 'doorDone' }, { f: 'jiminUp' }, { f: 'jimin112' }, { f: 'patrol' }, { sms: 'k0502', f: 'kang502' }, { f: 'kongiBack' },
      roomSet('jimin', 'gone'), roomSet('kongi', 'sleep'), { f: 'M7' }, { where: 'sr' }, { momAt: 'sr' }, roomSet('srLamp', 'lit'), roomSet('srGap', 0.45), ...marks('B12', 'B13')]],
    ['M8', [{ f: 'memoryStart' }, { f: 'memoryDone' }, { f: 'M8' }, { where: 'lv' }, { momAt: 'lv' }, ...marks('B14', 'B15'), { f: 'playArmed', when: (o) => !!o.armed }]],
    ['END', [{ f: 'playArmed' }, { f: 'played' }, { st: ['e3_played', true] }, { f: 'END' }, { v: ['endStep', 'e0530'] }, ...marks('B16', 'B17', 'B18')]],
    ['HOOK', [{ f: 'collarOn' }, { f: 'soupServed' }, { f: 'easyBackChip' }, { st: ['easyBack', true] }, { v: ['endStep', 'hook'] }, { f: 'HOOK' }]],
  ];
  function jump(id, opts) {
    opts = opts || {};
    if (!G.state) return false;
    const idx = JUMP.findIndex((r) => r[0] === id);
    if (idx < 0) { console.warn('[haru.jump] unknown id', id, JUMP.map((r) => r[0])); return false; }
    const ops = [];
    JUMP.slice(0, idx + 1).forEach((r) => ops.push(...r[1]));
    const want = (o) => o.f && !flag(o.f) && (!o.when || o.when(opts));
    const nf = ops.filter(want).length;
    if (G.state.playMs < (nf + 1) * 1000) G.state.playMs = (nf + 1) * 1000;
    if (G.clock && !G.clock.started()) G.clock.start();
    let k = 0;
    const pmv = G.state.vars.pm = G.state.vars.pm || {};
    ops.forEach((o) => {
      try {
        if (o.when && !o.when(opts)) return;
        if (o.sms) {                                      // comms delivers silently (sets its flag); raw flag when comms is absent
          if (!flag(o.f)) {
            if (pmv[o.f] == null) pmv[o.f] = Math.round(G.state.playMs - (nf - k) * 1000);
            if (G.sms && G.sms.deliver) { try { G.sms.deliver(o.sms, { silent: true }); } catch (e) { console.error('[haru.jump] deliver', e); } }
            k++;
            if (!flag(o.f)) G.flag(o.f, true);
          }
          return;
        }
        if (o.f) { if (!flag(o.f)) { if (pmv[o.f] == null) pmv[o.f] = Math.round(G.state.playMs - (nf - k) * 1000); k++; G.flag(o.f, true); } }
        else if (o.v) G.vars(o.v[0], o.v[1]);
        else if (o.st) E3.stage(o.st[0], o.st[1]);
        else if (o.momAt) E3.momAt(o.momAt);
        else if (o.where) { if (G.room && G.room.where) G.room.where(o.where); else G.vars('where', o.where); }
        else if (o.clock) { if (G.clock && G.clock.jump) G.clock.jump(o.clock); }
        else if (o.tb) { if (V().TB == null) G.vars('TB', Math.round(G.state.playMs)); }
        else if (o.easy !== undefined) { if (G.easy && G.easy.set) G.easy.set(o.easy, { silent: true }); else G.vars('easy', o.easy); }
        else if (o.mark) { if (G.director && G.director.mark) G.director.mark(o.mark); else { const d = (G.state.vars.dir = G.state.vars.dir || {}); d.fired = d.fired || {}; if (d.fired[o.mark] == null) d.fired[o.mark] = Math.round(G.state.playMs); } }
        else if (o.lock === 'hide') { if (G.lock && G.lock.hide) G.lock.hide(); }
        else if (o.fn) o.fn();
      } catch (e) { console.error('[haru.jump]', o, e); }
      if (o.f === 'introDone' && (!G.state.cb || G.state.cb._v !== 1)) E3.seriesStart();
    });
    if (opts.commit && flag('END')) E3.commit();
    save(true);
    safe(() => { if (G.hooks && G.hooks.has && G.hooks.has('room:refreshLayers')) G.hooks.call('room:refreshLayers'); });
    try { if (G.main && G.main.resumeFrom) G.main.resumeFrom(G.state); } catch (e) { console.error('[haru.jump] resumeFrom', e); }
    return true;
  }
  E3._jumpTable = G.DEBUG ? JUMP.map((r) => r[0]) : null;

  /* ---------------- DEBUG: window.haru core helpers (ARCH §7.2) ---------------- */
  if (G.DEBUG) {
    const H = W.haru;
    const copy = (o) => JSON.parse(JSON.stringify(o));
    H.state = () => copy(G.state);
    H.flags = () => { const f = G.state.flags, p = G.state.vars.pm || {}; return Object.keys(f).sort((a, b) => (p[a] == null ? f[a] : p[a]) - (p[b] == null ? f[b] : p[b]) || f[a] - f[b]); };
    H.vars = () => copy(G.state.vars);
    H.flag = (name, on) => G.flag(name, on === undefined ? true : !!on);
    H.jump = jump;
    H.time = (x) => {
      if (typeof x === 'string') return !!(G.clock && G.clock.jump && G.clock.jump(x));
      return G.clock && G.clock._scale ? G.clock._scale(x == null ? 1 : x) : 1;
    };
    H.speed = (x) => H.time(x == null ? 1 : Number(x));
    H.cb = (o) => {
      o = o || {};
      E3.cbPreview = Object.assign({}, E3.cbPreview || NEUTRAL, o);
      if (G.state && G.state.cb && G.state.cb._v === 1 && flag('introDone')) { Object.assign(G.state.cb, o); save(true); }
      return E3.cb();
    };
    H.series = (p) => { if (!applyFixture(p)) { console.warn('[haru.series] profiles', Object.keys(FIXTURES)); return null; } E3.seriesBoot(); return Object.assign({}, E3.cbPreview); };
    H.series.fixture = (p) => H.series(p);
    H.name = (n) => {
      W.CONFIG = W.CONFIG || {};
      W.CONFIG.PLAYER_NAME = String(n == null ? '' : n);
      safe(() => { if (G.audio && G.audio.renameReset) G.audio.renameReset(); });
      return G.NAME;
    };
    H.type = (text) => { const f = G.ui && G.ui.focusedField && G.ui.focusedField(); if (!f) { console.warn('[haru.type] no focused field'); return false; } f.insert(String(text)); return true; };
    H.clearSave = () => { if (G.resetSave) G.resetSave(); E3.session.clear(); };
    H.clearSeries = () => { if (G.series && G.series.clearAll) G.series.clearAll(); };
    H.budget = () => E3.budget();
    H.hub = () => E3.hub();
    H.sched = () => E3.sched.list();
  }
})();
