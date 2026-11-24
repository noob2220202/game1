/* =========================================================
 * js/data/talk.js — 톡 story data (DESIGN §4.1) + small shared helpers
 * for the story-data apps (G.sd). Loaded before every app file.
 *
 * Thread: {id, name, avatar:{img, emoji, bg, initial}, pinned, status, profile:{bg, info:[...]},
 *          show(), messages:[msg], sub(), tone, compose:'restricted'|'allow'|'channel'}
 * msg:    {from:'me'|'them', t:'YYYY-MM-DD HH:MM', text, call:'missed'|'declined'|'out',
 *          sys, card:{title, rows, foot}, img, unread:true (shows (1) until read),
 *          grp:true (collapsible into a month group), deleted}
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  /* ---------------- shared helpers for story-data apps ---------------- */
  const SD = (G.sd = G.sd || {});
  SD.T = (s) => (G.T ? G.T(s) : s);
  /** asset key -> url (G.IMG first; raw paths pass through) */
  SD.img = function (key) {
    if (!key) return '';
    if (G.IMG && G.IMG[key]) return G.IMG[key];
    if (/[/.]/.test(key)) return key;
    return 'assets/img/' + key + '.jpg';
  };
  const okCache = {};
  /** set a background image on a node; adds .noimg (styled placeholder) if it fails to load */
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
  /** <img> that hides itself (and marks parent .noimg) when missing */
  SD.imgEl = function (key, cls) {
    const url = SD.img(key);
    const im = document.createElement('img');
    if (cls) im.className = cls;
    im.alt = '';
    im.draggable = false;
    im.onerror = () => { im.style.visibility = 'hidden'; im.parentNode && im.parentNode.classList.add('noimg'); };
    im.src = url;
    return im;
  };
  SD.note = function (t) { try { if (G.notebook && G.notebook.note) G.notebook.note(SD.T(t)); } catch (e) {} };
  SD.lead = function (id, t) { try { if (G.notebook && G.notebook.lead) G.notebook.lead(id, SD.T(t)); } catch (e) {} };
  /** message tones: 'him'|'mom'|'friend'|'album' (shim until core adds them) */
  SD.tone = function (t) {
    const A = G.audio, S = A && A.sfx;
    if (!S) return;
    try {
      if (S.tone) return S.tone(t);
      const f = S[{ him: 'msgHim', mom: 'msgMom', friend: 'msgFriend', album: 'msgAlbum' }[t]] || S.msgIn;
      f && f.call(S);
    } catch (e) {}
  };
  /** a "safe zone" check used before scripted live beats (design §6.1) */
  SD.isSafe = function () {
    try { if (G.director && G.director.isSafe) return !!G.director.isSafe(); } catch (e) {}
    const scr = document.getElementById('screen');
    if (!scr) return false;
    if (scr.classList.contains('kb-open')) return false;
    if (document.querySelector('.notebook.in, .notebook')) return false;
    if (document.querySelector('#overlays [data-modal], .call-screen, .vt-call')) return false;
    if (G.phone && G.phone.isLocked && G.phone.isLocked()) return false;
    if (G.flag('M7') && !G.flag('END')) return false;
    return !document.hidden;
  };
  SD.waitSafe = async function (maxMs) {
    const t0 = Date.now();
    while (!SD.isSafe()) { await new Promise((r) => setTimeout(r, 700)); if (maxMs && Date.now() - t0 > maxMs) break; }
  };
  SD.dayLabel = function (d) { return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}요일`; };
  /** deterministic PRNG (mulberry32) */
  SD.rng = function (seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const pad = (n) => String(n).padStart(2, '0');
  /** 'YYYY-MM-DD' -> local Date (never UTC-parse date-only strings) */
  const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  SD.pd = pd;
  SD.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /* ---------------- builders ---------------- */
  // day('2025-06-03', [['them','14:02','text', {extra}], ...], {grp, unread})
  function day(date, rows, common) {
    return rows.map((r) => Object.assign({ from: r[0], t: date + ' ' + r[1], text: r[2] }, common || {}, r[3] || {}));
  }
  const ME = 'me', TH = 'them';

  /* =========================================================
   * 엄마 📌
   * ========================================================= */
  function momMessages() {
    const out = [];
    // ordinary life before (collapsible)
    out.push(...day('2025-09-14', [[TH, '19:20', '세아야 추석에 내려오니?'], [ME, '19:31', '응 토요일 아침 ktx!'], [TH, '19:32', '콩이도 데려와'], [ME, '19:32', '당연하지ㅋㅋ 콩이가 주인공임']], { grp: 1 }));
    out.push(...day('2025-09-21', [[TH, '21:05', '오르골 고쳤어?'], [ME, '21:40', '응 태엽 다시 감았더니 됨!!'], [TH, '21:41', '그거 너 어릴 때 엄마가 사준 거잖아'], [ME, '21:41', '그니까 보물 1호지 ㅎㅎ']], { grp: 1 }));
    out.push(...day('2025-10-05', [[TH, '12:10', '밥은 먹고 다니니'], [ME, '12:44', '먹었어 먹었어'], [TH, '12:45', '김치 보낼게'], [ME, '12:45', '앗싸 💛']], { grp: 1 }));
    out.push(...day('2025-10-20', [[ME, '22:02', '엄마 나 졸작 주제 정했다'], [ME, '22:02', '들리지 않는 방'], [TH, '22:15', '무섭다 얘 ㅋㅋ'], [ME, '22:16', '소리 작품이야ㅋㅋㅋ']], { grp: 1 }));
    out.push(...day('2025-11-02', [[TH, '20:30', '날 추워졌다 보일러 틀고 자'], [ME, '20:52', '응응']], { grp: 1 }));
    out.push(...day('2025-11-16', [[TH, '18:12', '다음주에 반찬 가지러 올래?'], [ME, '18:40', '이번 주는 졸작 땜에 바빠ㅠ 다음에 갈게'], [TH, '18:41', '그래 무리하지 마']], { grp: 1 }));
    out.push(...day('2025-11-21', [[TH, '17:05', '발표 잘했어?'], [ME, '17:30', '응 그럭저럭!'], [ME, '17:31', '엄마 근데'], [TH, '17:31', '응?'], [ME, '17:34', '아냐 나중에 얘기할게 ㅎㅎ']], { grp: 1 }));
    out.push(...day('2025-11-23', [[TH, '22:10', '잘 자 우리 딸'], [ME, '22:12', '엄마도 잘 자 💛']], { grp: 1 }));
    // the night (always expanded)
    out.push(...day('2025-11-24', [
      [ME, '03:33', '엄마 나'],
      [TH, '07:10', '세아야 새벽에 왜? 무슨 일 있어?'],
      [TH, '07:10', '엄마가 전화 못 받았네 미안해'],
      [TH, '07:11', '', { call: 'missed', text: undefined }],
      [TH, '07:12', '전화 좀 받아'],
    ]));
    // a year of nightly 03:33 missed voice calls + her messages (unread (1))
    const lines = {
      '2025-11-25': ['06:40', '세아야 엄마 지금 올라가'],
      '2025-12-01': ['20:12', '콩이는 엄마가 데려왔어. 걱정하지 마'],
      '2025-12-25': ['18:47', '오늘 너 좋아하는 김치찜 했어'],
      '2026-01-01': ['00:03', '새해 복 많이 받아 우리 딸'],
      '2026-02-03': ['21:30', '엄마가 요금은 계속 낼게. 번호 살려둘게'],
      '2026-03-17': ['19:05', '콩이 오늘 우리집 온 날이다. 간식 줬어'],
      '2026-05-08': ['16:20', '지민이가 꽃 보냈더라. 니 몫까지래'],
      '2026-08-20': ['08:15', '콩이 밥 잘 먹어'],
      '2026-11-20': ['22:40', '세아야 다음주면 1년이야'],
    };
    const start = new Date(2025, 10, 25), end = new Date(2026, 10, 23);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = SD.ymd(d);
      const grp = d < new Date(2026, 10, 20) ? 1 : 0;
      out.push({ from: TH, t: k + ' 03:33', call: 'missed', unread: 1, grp });
      if (lines[k]) out.push({ from: TH, t: k + ' ' + lines[k][0], text: lines[k][1], unread: 1, grp });
    }
    // tonight
    out.push(...day('2026-11-24', [
      [TH, '00:01', '세아야 답장 안 해도 돼. 읽기만 해.'],
      [TH, '00:01', '숫자 1만 없어지면 엄마는 돼.'],
      [TH, '03:33', '세아야 오늘로 1년이야. 엄마 오늘도 전화했어.'],
      [TH, '03:33', '', { call: 'missed', text: undefined }],
    ], { unread: 1 }));
    return out;
  }

  /* =========================================================
   * 지민
   * ========================================================= */
  function jiminMessages() {
    const out = [];
    const F = { grp: 1 };
    // ---- before (filler banter is collapsible; clue days verbatim & expanded)
    out.push(...day('2025-03-02', [[TH, '23:10', '개강 ㅠㅠㅠ'], [ME, '23:12', '나 4학년이라니 실화냐'], [TH, '23:12', '졸작 생각만 해도 토나옴ㅋㅋ']], F));
    out.push(...day('2025-03-10', [
      [ME, '16:02', '오늘 옷장 수리 기사님 옴'],
      [ME, '16:02', '관리실에서 보내줬는데 엄청 친절하심ㅋㅋ'],
      [TH, '16:05', '오 그 삐걱거리던 옷장?'],
      [ME, '16:06', 'ㅇㅇ 근데 한 시간 넘게 옷장 안에서 뭘 하시더라'],
      [ME, '16:06', '원래 그렇게 오래 걸림?'],
      [TH, '16:09', '몰라ㅋㅋ 붙박이장이라 그런가'],
    ]));
    out.push(...day('2025-03-17', [[ME, '09:30', '오늘 콩이 온 지 2년!!'], [TH, '09:41', '헐 콩이 생일이네'], [TH, '09:41', '간식 사갈게ㅋㅋ']], F));
    out.push(...day('2025-04-12', [[TH, '13:20', '벚꽃 보러 가자'], [ME, '13:22', '콩이도??'], [TH, '13:22', '당연 콩이가 메인']], F));
    out.push(...day('2025-04-26', [[ME, '15:48', '과제 녹음하러 한강 감'], [TH, '15:50', '뭐 녹음하는데'], [ME, '15:52', '물소리ㅋㅋ 바람 땜에 망함']], F));
    out.push(...day('2025-05-14', [[ME, '23:05', '방 IR 측정 과제 했는데 우리집 울림 개심함'], [TH, '23:07', 'IR이 뭔데'], [ME, '23:08', '박수 치고 녹음하는 거ㅋㅋ']], F));
    out.push(...day('2025-06-03', [
      [TH, '14:02', 'ㅋㅋㅋㅋㅋ너 또 한영키'],
      [TH, '14:02', "'dkssud' 이게 뭐냐고ㅋㅋㅋ"],
      [ME, '14:03', '안녕이라고 친 거임ㅋㅋㅋㅋ'],
      [TH, '14:04', '이거 비번으로 쓰면 아무도 모르겠다'],
      [ME, '14:04', '오 천재? 메모 비번 이렇게 바꿔야지'],
      [ME, '14:05', '우리집 막내 이름으로 ㅎㅎ'],
    ]));
    out.push(...day('2025-06-21', [[TH, '18:00', '종강!!!!!!'], [ME, '18:01', '살았다'], [TH, '18:01', '치킨']], F));
    out.push(...day('2025-07-05', [[ME, '11:12', '콩이 미용함'], [ME, '11:12', '털 다 밀어서 다른 개 됨ㅋㅋㅋ'], [TH, '11:20', '사진 보내봐 ㅋㅋㅋ']], F));
    out.push(...day('2025-07-19', [
      [ME, '00:41', '야 카톡 삭제해도 알림기록에 다 남는 거 알았음??'],
      [ME, '00:41', '설정-알림-알림 기록 ㅋㅋ 개꿀팁'],
      [TH, '00:44', '헐 전남친 삭제한 거 다 보이겠네'],
      [ME, '00:44', 'ㅋㅋㅋㅋㅋ'],
    ]));
    out.push(...day('2025-07-30', [[ME, '02:10', '콩이 코고는 거 녹음함ㅋㅋㅋ'], [TH, '09:02', '그걸 왜 녹음해ㅋㅋㅋ'], [ME, '09:30', '음향과의 숙명']], F));
    out.push(...day('2025-08-14', [
      [ME, '21:15', '아 그리고 폰 흔들면 실행취소 되는 거 앎??'],
      [ME, '21:15', '메모 과제 다 날렸다가 흔들어서 살림ㅋㅋㅋ'],
      [TH, '21:18', '헐 대박 몰랐어'],
      [TH, '21:18', '근데 그거 세게 흔들다 폰 날리겠다'],
    ]));
    out.push(...day('2025-08-30', [[ME, '10:05', '월세 또 올랐어'], [ME, '10:05', '65만원 실화냐'], [TH, '10:11', '헐ㅠ 일 년이면 얼마야']], F));
    out.push(...day('2025-09-02', [[ME, '20:40', '내 모먼트 봤냐 콩이 그림ㅋㅋ'], [TH, '20:42', '그거 어떻게 한 거야??'], [ME, '20:43', '녹음 앱 주파수 보기로 틀어봐ㅋㅋ']], F));
    out.push(...day('2025-09-13', [[TH, '22:30', '곱창 3명 37800원'], [TH, '22:30', '1인 12600 보내'], [ME, '22:31', '계좌 ㄱㄱ']], F));
    out.push(...day('2025-10-02', [
      [ME, '01:20', '요즘 폰 맨 위에 네모난 아이콘이 자꾸 떠 있음'],
      [ME, '01:20', '이거 뭐임'],
      [TH, '01:26', '스마트뷰 아님? 티비 연결했냐'],
      [ME, '01:27', '우리집 티비 없는데;;'],
      [TH, '01:27', '그럼 몰라ㅋㅋ 껐다 켜봐'],
      [TH, '01:28', '아 근데 너 그 오르골 아직도 들고 다니냐ㅋㅋ'],
      [ME, '01:30', '보물 1호인데 당연하지;; 엄마가 사준 거란 말이야'],
    ]));
    out.push(...day('2025-10-11', [[ME, '19:02', '믹싱 수업 교수님이 모노 체크 안 했다고 혼냄ㅠ'], [TH, '19:05', '모노가 뭐임'], [ME, '19:06', '설명하면 길어 걍 전공자 개그임ㅋㅋ']], F));
    out.push(...day('2025-10-27', [[ME, '13:40', '문틈 바람막이 샀다'], [ME, '13:40', '도어가드도'], [TH, '13:44', '도어가드?'], [ME, '13:46', '문에 다는 걸쇠 같은 거 ㅎㅎ 그냥']], F));
    out.push(...day('2025-11-08', [[TH, '15:20', '졸작 발표 언제야'], [ME, '15:21', '21일'], [TH, '15:21', '꽃 들고 갈게']], F));
    out.push(...day('2025-11-19', [[ME, '02:12', '지민아 혹시 밤에 우리집 쪽 창문 봐?'], [TH, '02:20', '??? 갑자기'], [ME, '02:21', '아냐 그냥ㅋㅋ']]));
    out.push(...day('2025-11-22', [[ME, '23:51', '지민아 내 모먼트 글들 잘 봐줘'], [ME, '23:51', '순서대로'], [TH, '23:55', 'ㅋㅋ 뭔소리야 좋아요 다 눌렀는데'], [ME, '23:56', 'ㅎㅎ 고마워']]));
    out.push(...day('2025-11-24', [[ME, '03:30', '지민아'], [TH, '08:12', '?? 왜 새벽에'], [TH, '12:40', '세아야 전화 왜 안 받아'], [TH, '21:03', '너 어디야 진짜']]));

    // ---- after (every bubble keeps its (1)) — key lines verbatim
    const U = { unread: 1 };
    const keys = {
      '2025-11-25': [['09:14', '세아야 제발 전화 좀'], ['22:40', '어머님이랑 경찰서 다녀왔어']],
      '2025-12-24': [['23:59', '메리 크리스마스…'], ['23:59', '콩이는 어머님이 데려가셨어. 잘 지내']],
      '2026-03-17': [['19:30', '오늘 콩이 온 날이래. 어머님이 사진 보내주심']],
      '2026-07-02': [['02:14', '나 아직 밤마다 너네 집 창문 봐'], ['02:15', '불 꺼져 있는 거 알면서']],
      '2026-11-23': [['20:05', '니 방에 오늘 누가 이사 왔더라'], ['20:06', '이상하게 화가 나']],
    };
    // filler pools by period (지민: fast, ㅋㅋ/ㅠㅠ, typos early; quieter later)
    const pools = [
      ['2025-11-26', '2025-11-30', 6, ['세아야', '세아야ㅑ 제발', '어디야', '전화 좀 받아 제발 ㅠㅠ', '전화하면 꺼져 있다고 나와', '너네 집 갔는데 아무도 없어', '콩이만 있었어 계속 짖더라', '경찰이 실종 신고 받아줬어', 'cctv 다 본대', '세아야 장난이면 이제 그만해', '화 안 낼게 진짜로', '그냥 1만 없어지면 돼', '교수님도 연락 안 된대', '과 단톡방 난리 났어', '어머님 계속 우셔', '나 오늘 학교 안 갔어', '세아야 밥은 먹고 있어?', '어디든 괜찮으니까 연락만 해', '제발', '꿈에서 너 봤어', '자꾸 니 목소리 들리는 것 같아', '전단지 만들었어', '니 사진 제일 예쁜 걸로 골랐어', '역 앞에 붙이고 왔어', '사람들이 많이 봐줬어', '오늘 첫눈 왔어', '세아야 추워', '너 목도리 우리집에 두고 갔잖아', '그거 가지러라도 와', '보고 싶다']],
      ['2025-12-01', '2025-12-23', 2, ['경찰은 단서가 없대', '외부 출입 흔적이 없대 그게 말이 돼?', '오늘 콩이 보러 어머님 댁 갔어', '콩이가 니 옷 냄새 맡고 안 떨어져', '기말 망했어ㅋㅋ 너 있었으면 같이 망했을 텐데', '나 요즘 잠을 못 자', '새벽에 자꾸 깨', '3시 반만 되면 깨 이상하게', '어머님이 매일 밤 전화하신대', '나도 해볼까 하다가 무서워서 못 하겠어', '니 프사 그대로네', '니 모먼트 계속 들어가 봐', '너 마지막 글들 다시 봤어', '가끔은 혼자인 게 좋다며', '혼자 있지 마 제발', '오늘 학교 앞 붕어빵 팔더라', '니가 팥 좋아했잖아', '한 개 더 샀어 바보같이', '세아야', '교수님이 니 졸작 파일 보관해 두신대', '「들리지 않는 방」', '제목 왜 그렇게 지었어', '방학했어', '이번 방학엔 같이 제주도 가기로 했잖아', '나 혼자는 안 가', '세아야 크리스마스 다가와', '거리에 캐럴 나와', '듣기 싫어', '오늘은 좀 괜찮았어', '아니 거짓말', '보고 싶다', '잘 자', '어머님이 너 방 짐 아직 못 빼셨대', '집주인이 기다려 준대', '세아야 어디야', '오늘 너네 동네 갔다 왔어', '편의점 아저씨가 너 안부 물어보더라', '콩이 간식 사갔어', '잘 자 세아야', '내일 또 올게']],
      ['2025-12-26', '2025-12-31', 1, ['연말이다', '올해 제일 길었다', '세아야', '종 치는 거 혼자 봤어', '내년엔 꼭', '보고 싶다']],
      ['2026-01-01', '2026-01-31', 0.5, ['새해야', '올해는 꼭 돌아와', '떡국 먹었어', '어머님 댁에서 콩이랑 잤어', '콩이가 니 방 앞에서 자', '추워 진짜', '세아야', '눈 엄청 와', '너 눈 오면 녹음기 들고 나갔잖아', '뽀득뽀득 소리 좋다고', '나도 녹음해 봤어 이상하게 안 좋더라', '방학인데 아무것도 안 해', '잘 자', '보고 싶다', '세아야 나 알바 시작했어', '카페야 ㅋㅋ 니가 맨날 가던 데']],
      ['2026-02-01', '2026-02-28', 0.45, ['세아야', '설날이야', '어머님이 니 몫까지 전 부치셨어', '나 그거 먹고 울었어', '개강 준비', '휴학할까 고민 중', '어머님이 하지 말래', '니가 들으면 혼낼 거라고', '맞지', '잘 자', '보고 싶다', '오늘 바람 엄청 불어']],
      ['2026-03-01', '2026-03-31', 0.45, ['개강했어', '니 자리 비워놨어 맨 뒤 창가', '교수님이 니 작품 전시하재', '「들리지 않는 방」 제목 그대로', '나 그 방 못 들어가겠어', '콩이 살쪘대 ㅋㅋ', '어머님이 간식 너무 줘', '오늘 너네 집 앞 지나갔어', '불 꺼져 있더라', '봄 온다', '벚꽃 피면 너랑 가기로 했는데', '세아야']],
      ['2026-04-01', '2026-04-30', 0.38, ['벚꽃 폈어', '혼자 봤어', '사진 찍었는데 보낼 데가 없네', '니 폰으로 보내 볼게', '아 사진은 안 보내지네', '세아야', '중간고사 ㅠ', '도서관에서 너랑 듣던 노래 나왔어', '바로 나왔어 ㅋㅋ', '보고 싶다', '잘 자']],
      ['2026-05-01', '2026-05-31', 0.35, ['오월이다', '어버이날이라 어머님 꽃 보내드렸어', '니 몫까지', '어머님이 전화로 웃으셨어 오랜만에', '세아야', '축제 기간이야', '너 작년에 공연 음향 했잖아', '올해 음향 개판이더라 ㅋㅋ', '니가 했어야 됐는데', '잘 자', '보고 싶다']],
      ['2026-06-01', '2026-06-30', 0.33, ['더워졌어', '종강했어', '너 에어컨 맨날 18도로 틀었잖아', '나 지금 18도야', '추워 죽겠어 ㅋㅋ', '세아야', '졸작 전시 날짜 잡혔대', '잘 자', '보고 싶다', '오늘 비 와']],
      ['2026-07-03', '2026-07-31', 0.33, ['장마야', '비 오는 날 니가 녹음하러 나갔던 거 생각나', '졸작 전시 했어', '사람들이 니 방에 오래 있다 갔어', '아무 소리도 안 나는데', '다들 뭔가 들었대', '세아야', '잘 자', '보고 싶다']],
      ['2026-08-01', '2026-08-31', 0.3, ['여름 끝나간다', '어머님이랑 콩이 데리고 바다 갔어', '콩이 물 무서워해 ㅋㅋ 너 닮았어', '세아야', '개강 싫다', '잘 자', '보고 싶다', '오늘 매미 소리 미쳤어', '너라면 녹음했겠지']],
      ['2026-09-01', '2026-09-30', 0.3, ['개강', '나 4학년 됐어', '졸작 주제 아직 못 정함', '니 꺼 따라 하고 싶은데 안 돼', '추석이야 어머님 댁 왔어', '콩이가 현관에서 안 움직여', '누가 올 것처럼', '세아야', '잘 자']],
      ['2026-10-01', '2026-10-31', 0.3, ['가을이다', '니가 좋아하던 귤 나왔어', '한 봉지 샀어', '반은 니 꺼', '세아야', '오늘 니 생각 많이 났어', '아니 맨날 나', '잘 자', '보고 싶다']],
      ['2026-11-01', '2026-11-22', 0.32, ['11월이야', '다음주면 1년이야', '어머님이 번호 계속 살려두신대', '나도 계속 보낼게', '집주인이 니 방 내놨대', '누가 이사 온대', '싫다', '세아야']],
    ];
    const rnd = SD.rng(0x5ea);
    const filler = [];
    pools.forEach(([a, b, perDay, lines]) => {
      const d0 = pd(a), d1 = pd(b);
      const days = [];
      for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) days.push(SD.ymd(d));
      // spread the lines over days in order: N lines per day (perDay may be fractional)
      let li = 0;
      let acc = 0;
      days.forEach((k) => {
        if (keys[k]) return;
        acc += perDay;
        let n = Math.floor(acc); acc -= n;
        if (perDay >= 1 && li < lines.length && n === 0) n = 1;
        const hours = [];
        for (let i = 0; i < n && li < lines.length; i++) hours.push(1 + Math.floor(rnd() * 22));
        hours.sort((x, y) => x - y);
        hours.forEach((h) => {
          if (li >= lines.length) return;
          const mm = Math.floor(rnd() * 60);
          filler.push({ from: TH, t: `${k} ${pad(h)}:${pad(mm)}`, text: lines[li++], unread: 1, grp: 1 });
        });
      });
      // leftover lines go on the last days
      while (li < lines.length) { const k = days[days.length - 1 - (li % 3)]; filler.push({ from: TH, t: `${k} 23:${pad(Math.min(59, 10 + (li % 50)))}`, text: lines[li++], unread: 1, grp: 1 }); }
    });
    // pad to exactly 214 unread with quiet repeats (she keeps writing)
    const keyCount = Object.values(keys).reduce((a, v) => a + v.length, 0) + 1; // + 11.24 00:00
    const repeats = ['세아야', '보고 싶다', '잘 자', '답장 안 해도 돼', '오늘도 왔어', 'ㅠㅠ'];
    let ri = 0;
    const rnd2 = SD.rng(0x214);
    while (filler.length + keyCount < 214) {
      const base = new Date(2026, 0, 3);
      base.setDate(base.getDate() + Math.floor(rnd2() * 300));
      const k = SD.ymd(base);
      if (keys[k] || k === '2026-05-08') continue;
      filler.push({ from: TH, t: `${k} ${pad(21 + Math.floor(rnd2() * 3))}:${pad(Math.floor(rnd2() * 60))}`, text: repeats[ri++ % repeats.length], unread: 1, grp: 1 });
    }
    Object.keys(keys).forEach((k) => keys[k].forEach(([hm, text]) => filler.push({ from: TH, t: k + ' ' + hm, text, unread: 1, key: 1 })));
    filler.push({ from: TH, t: '2026-11-24 00:00', text: '1년이야. 보고 싶다 세아야', unread: 1 });
    filler.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
    // key days are never collapsed
    return out.concat(filler.map((m) => (m.key ? Object.assign(m, { grp: 0 }) : m)));
  }

  /* =========================================================
   * 관리실 (him, persona A)
   * ========================================================= */
  const managerMessages = [].concat(
    day('2025-03-08', [[TH, '10:05', '안녕하세요 해솔빌 관리실입니다 ^^'], [TH, '10:05', '404호 붙박이장 문 수리 접수되어 3/10(월) 14시에 기사님 방문 예정입니다.'], [ME, '10:21', '네 감사합니다!']]),
    day('2025-03-10', [[TH, '18:30', '수리 잘 되셨나요? 불편하신 점 있으면 언제든 연락주세요 ^^']]),
    day('2025-04-02', [[ME, '02:51', '관리실님 혹시 404호 옆에 빈 공간 있나요? 밤마다 옷장 뒤에서 긁는 소리가 나요'], [TH, '09:12', '404호는 끝 세대라 옆은 벽이에요 ^^ 배관 소리일 거예요']]),
    day('2025-11-20', [[ME, '03:41', '새벽에 도어락이 안 열려요. 관리자 잠금이라고 떠요'], [TH, '03:44', '확인해 보니 일시적 오류네요 ^^ 아침엔 풀릴 거예요'], [TH, '03:44', '옷장은 여시지 마세요. 아직 수리 중이라서요']])
  );

  /* =========================================================
   * 해솔빌 404호 이사 (택배) — notification channel
   * ========================================================= */
  const parcelMessages = [
    { from: TH, t: '2024-08-29 19:02', card: { title: '[이사] 예약이 확정되었습니다', rows: [['주소', '해솔빌 404호'], ['일시', '8월 31일(토) 오전 9시']], foot: '이사 당일 기사님이 연락드립니다.' } },
    { from: TH, t: '2024-08-31 13:40', card: { title: '[이사] 이사가 완료되었습니다', rows: [['주소', '해솔빌 404호']], foot: '새 집에서 행복하세요 🏠' } },
    { from: TH, t: '2025-10-28 13:20', card: { title: '[택배] 고객님의 상품이 문 앞에 배송되었습니다', rows: [['상품', '문틈 막이 바람막이 2m 외 1건'], ['받는 곳', '해솔빌 404호 (문 앞)']], foot: '배송 완료' } },
    { from: TH, t: '2026-11-23 18:42', card: { title: '[택배] 고객님의 상품이 문 앞에 배송되었습니다', rows: [['받는 곳', '해솔빌 404호 (문 앞)'], ['수령인', '{N}']], foot: '배송 완료' } },
  ];

  let momCache = null, jiminCache = null;
  G.STORY.talk = [
    {
      id: 'mom', name: '엄마', pinned: true, tone: 'mom', compose: 'restricted',
      avatar: { img: 'avatar_mom', emoji: '🌷', bg: 'linear-gradient(160deg,#ffd6e0,#f7a1b5)' },
      status: '콩이랑 산책 🐾',
      profile: { bg: 'linear-gradient(170deg,#f6c9d3 0%,#c98aa0 55%,#6b4a5a 100%)' },
      messages: () => momCache || (momCache = momMessages()),
      sub: () => `부재중 보이스톡 ${G.chat ? G.chat.missedCount('talk', 'mom') : 366}`,
    },
    {
      id: 'haru', name: '{N}', tone: 'him', compose: 'allow',
      avatar: { initial: '', bg: '#c5ced8', silhouette: true },
      status: '{N}',
      profile: { bg: 'linear-gradient(170deg,#9aa4ad,#56606a)' },
      show: () => G.flag('F1') || G.flag('haruThread'),
      messages: [],
    },
    {
      id: 'manager', name: '관리실', tone: 'friend', compose: 'restricted',
      avatar: { img: 'avatar_manager', emoji: '🏢', bg: 'linear-gradient(160deg,#5b7aa6,#2d4466)' },
      status: '해솔빌 관리실 · 24시간 상담 ^^',
      profile: { bg: 'linear-gradient(170deg,#7d93b5,#33415a)', info: ['친구 추가 2025.03.08', '전화번호로 추가됨 010-8817-3302'] },
      messages: managerMessages,
    },
    {
      id: 'jimin', name: '지민', tone: 'friend', compose: 'restricted',
      avatar: { img: 'avatar_jimin', initial: '지', bg: 'linear-gradient(160deg,#a8d8c8,#4ea38a)' },
      status: '기다릴게',
      profile: { bg: 'linear-gradient(170deg,#b5e0d2,#3f7f6d)' },
      messages: () => jiminCache || (jiminCache = jiminMessages()),
    },
    {
      id: 'parcel', name: '해솔빌 404호 이사 (택배)', tone: 'friend', compose: 'channel',
      avatar: { emoji: '📦', bg: 'linear-gradient(160deg,#ffcf86,#f08a24)' },
      status: '알림 전용 채널',
      profile: { bg: 'linear-gradient(170deg,#ffd9a0,#b86a1e)', info: ['알림 전용 채널 · 답장을 받지 않습니다'] },
      messages: parcelMessages,
    },
  ];
  // 세아's own profile (톡 › 친구 › 내 프로필)
  G.STORY.talkMe = { name: '윤세아', status: '🎧 소리 모으는 중', avatar: { img: 'avatar_sea', emoji: '🐶', bg: 'linear-gradient(160deg,#f6d7b0,#d79b5b)' }, profile: { bgImg: 'dog_park' } };

  /* ---------- scripted reply sets (after M6 / END) ---------- */
  G.STORY.talkReplies = {
    jimin: {
      chips1: ['저 세아 씨 폰을 주운 사람이에요. 404호에 새로 이사 왔어요.'],
      reply1: ['…네?', '세아 폰을 왜'],
      chips2: ['옷장 뒤에 누가 있어요. 112에 신고해 주세요.'],
      reply2: ['잠깐만요 옷장 뒤?', '지금 112 신고할게요!!', '문 열리면 바로 나가요 제발'],
      confused: '네? 무슨 말이에요… 세아는요?',
      after: '경찰 가고 있대요. 조금만 버텨요',
    },
    mom: {
      chips1: ['저 세아 아니에요. 404호에 새로 이사 온 사람이에요.'],
      reply1: ['…누구세요?'],
      chips2: ['세아 씨 폰을 찾았어요. 옷장 뒤에 누가 있어요.'],
      reply2: ['404호요?', '지금 갈게요. 경찰에 신고할게요'],
      confused: '…누구세요?',
      after: '지금 가고 있어요',
      // END (§3 END step 3)
      endChips: ['어머님, 저는 404호에 새로 이사 온 사람이에요. 세아 씨 폰을 찾았어요.', '세아 씨가 남긴 메일이 있어요.'],
      endReply1: ['…세아가 뭐라고 했어요?'],
      endShare: '메일 공유',
      endReply2: ['…', '고마워요.'],
      endPhoto: 'kongi_old',
      endReply3: ['콩이가 아직도 현관에서 기다려요.'],
      endReply4: '오늘은 전화 안 할게요. 대신 내일 아침에 콩이 데리고 산책 갈게요.',
    },
    // mom's live lines on first read (§4.1)
    momRead: ['세아야?', '읽었어???', '세아야 엄마야', '전화 받아'],
    haruFirstReply: '…',
  };
})();
