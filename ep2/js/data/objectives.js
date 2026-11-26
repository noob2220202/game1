/* =========================================================
 * ep2/js/data/objectives.js (flow) — G.OBJECTIVES, DESIGN_EP2 §2.2 · §2.4 show/done table,
 * hints = §3.x T1–T3 verbatim (T3 states the answer). Array order = hint-tab priority (§2.4).
 *
 * Record: { id, title: string | () => string, optional, grayAfterM7, show() → bool, done() → bool,
 *           doneMark?() → bool (what counts as a quiet check — door: C2 only), hints:[T1, T2, T3] }
 * Titles are words that are already on screen when the card appears (§2.4 제목 규칙) — never detectors.
 * Exceptions registered with the DEBUG title check: 이 폰 · —의 홈 · 지민의 질문 (§2.4, §10 A).
 * Pure data: no cross-owner calls at load time; every predicate is lazy and guarded.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const f = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const v = (k) => { try { return G.vars ? G.vars(k) : (G.state && G.state.vars ? G.state.vars[k] : undefined); } catch (e) { return undefined; } };
  const factCount = () => {
    try { if (G.e2 && G.e2.factCount) return G.e2.factCount() || 0; } catch (e) {}
    const n = v('factCount');
    if (typeof n === 'number') return n;
    return ['factSmart', 'factFinger', 'factKbd', 'factCbs', 'factJimin', 'factDash'].filter(f).length;
  };

  G.OBJECTIVES = [
    { id: 'box', title: '상자', show: () => true, done: () => f('gotPhone'),
      hints: ['문밖에서 나는 소리.', '현관문을 눌러 열어 봐. 문 앞에 뭐가 있다.', '현관 → 문 → 상자 → 폰을 집고 알람을 밀어 끈다.'] },

    { id: 'phone', title: '이 폰', show: () => f('M1'), done: () => factCount() >= 4,
      hints: ["한 달 동안 이 폰은 내 손에 없었다. 이 폰이 '알아서' 하는 것들을 봐.",
        '잠금화면 문구, 설정(잠금 화면 · 생체 인식 · 키보드), 재난 알림과 타임라인, 모먼트 메시지.',
        "스마트 잠금 목록 · 지문 2 · 개인 단어 목록 · [마포구청]이 온 날의 알림 상세와 같은 날 타임라인 · 지민 대화 끝까지 · '—'의 홈 — 이 중 넷."] },

    { id: 'smart', title: '잠금 해제됨', show: () => f('M1'), done: () => f('factSmart'),
      hints: ['아무것도 안 눌렀는데 폰이 열렸다.', '잠금화면 문구를 다시 봐. 설정에서 잠금 화면을 찾아.',
        '설정 › 잠금 화면 › 스마트 잠금 — saemal_rooftop · 지정 2026.12.10 23:16 · 사용자: 나.'] },

    { id: 'finger', title: '지문', show: () => f('bioOpened'), done: () => f('factFinger'),
      hints: ['잠금화면 아래에 늘 있는 아이콘.', '설정 › 보안 및 개인정보 › 생체 인식. 지문이 몇 개야?',
        '지문 2 · 나 (2026.11.25)를 열어 봐. 지우려면 삭제 → 내 지문으로 확인.'] },

    { id: 'kbd', title: '키보드', show: () => f('kbdListOpened') || (v('kbdHisSeen') || 0) >= 3 || f('factKbd'), done: () => f('factKbd'),
      hints: ['이 폰에 뭔가 쳐 보면, 키보드가 먼저 말을 건다.', '메모 앱에서 ㅅ, ㅁ, 0을 쳐 봐. 아니면 설정 › 일반 › 키보드 › 개인 단어 목록.',
        '개인 단어 목록: 11-26 0310, 11-28 세아·식구·집·2구·방음, 12-11 물탱크실·옥상, 12-24 그냥·끝까지. 내가 친 말이 아니다.'] },

    { id: 'cbs', title: '재난 알림', show: () => f('cbsOpened') || f('tlOpened'), done: () => f('factCbs'),
      hints: ['이 폰은 매일 밤 어디 있었고, 새벽엔 어디 있었을까.', "재난 알림의 발신 기관과 시각, 그리고 '수신 사유'. 그다음 같은 날 타임라인.",
        "[마포구청]은 전부 06:00–06:40, '현재 위치'로 받았다. 같은 시각 타임라인은 '일시 중지'. 그는 새벽마다 이 폰을 들고 마포구에 다녀왔다."] },

    { id: 'jimin', title: '지민', show: () => f('jiminOpened'), done: () => f('factJimin'),
      hints: ['지민은 그 사람과 한 달을 얘기했다. 마지막에 뭘 물었지?', '모먼트 메시지의 지민 대화를 끝까지. 12월 17일 음성 메시지도 있다.',
        '22:43 오르골 질문 → 그의 오답 → "…아니구나." → 차단. 음성 메시지 0:14를 틀면 진짜 답이 들린다: 한 마디.'] },

    { id: 'dash', title: '—', show: () => f('dashSeen'), done: () => f('M3'),
      hints: ['빠른 설정 맨 아래, 사람이 둘이다.', '그 사람이 가장 자주 친 숫자. 메모에 0을 쳐 보거나, 개인 단어 목록이나 인터넷 기록을 봐.',
        "'—'의 PIN은 0310."] },

    { id: 'home', title: '—의 홈', show: () => f('M3'), done: () => f('factDash'),
      hints: ["여기가 그 사람의 '집'이다. 뭘 남겼을까.", "'—'의 메모, 갤러리 앨범 두 개와 숨긴 항목, 모먼트, 설정 › 사용자.",
        "메모 '—', 갤러리 › 0310·옥상, ⋮ › 숨긴 항목 보기, 모먼트 — 이 중 셋."] },

    { id: 'tone', title: '알림 소리', optional: true, show: () => f('soundSettingsOpened') || f('perChatSeen'), done: () => f('toneRestored'),
      hints: ['이 폰의 알림 소리, 원래 내 소리였나?', '설정 › 소리 및 진동 › 알림 소리.',
        "'—'(추가한 소리 · 11월 25일)를 다른 소리로 바꾼다. 아래 '대화별 알림음'도 봐."] },

    { id: 'fake', title: () => (f('fakeLineSeen') ? '문 열어 줘' : '오늘 만든 프로필'), grayAfterM7: true,
      show: () => f('fakeLineSeen') || f('fakeKnown'), done: () => f('fakeKnown'),
      hints: ['정말 {MAKER_CONTACT}의 말투야?', "이 대화의 프로필을 열어 봐. 그리고 '—'의 모먼트는 누구로 로그인돼 있었지?",
        "'오늘 만든 프로필' — 이 계정 정보: 2026년 12월 가입, 팔로워 0. '—'의 모먼트가 이 계정이다. 진짜는 숨겨져 있다."] },

    { id: 'real', title: '{MAKER_CONTACT}', grayAfterM7: true,
      show: () => f('hiddenSeen') || f('fakeKnown'), done: () => f('C1'),
      hints: ['진짜 {MAKER_CONTACT}에게서는 오늘 밤 왜 아무 말이 없지?', "모먼트 메시지의 '요청'을 맨 아래까지. 아니면 모먼트 설정 › 개인정보 보호 › 제한된 계정.",
        '요청 › 제한된 계정의 메시지 › 제한 해제 → {MAKER_CONTACT}에게 보낸다.'] },

    { id: 'where', title: '어디 숨어 있었는지', optional: true, grayAfterM7: true,
      show: () => f('whereAsked'), done: () => f('whereTank'),
      hints: ['그는 14일 동안 밤마다 이 옥상에 있었다. 어디?', '키보드가 12월 11일에 배운 말, 그날 새벽의 검색, 폴라로이드를 찍은 자리, 창밖 철문의 글씨.',
        '물탱크실. {MAKER_CONTACT}에게 "옥상 물탱크실"이라고 보낸다.'] },

    { id: 'door', title: '문', grayAfterM7: true,
      show: () => f('M6'), done: () => f('C2') || f('M7'), doneMark: () => f('C2'),
      hints: ['그가 이 폰에 남긴 것 중에, 지금 그를 문 앞에서 떼어 낼 수 있는 게 있다.',
        '04:44 알람은 어디로, 얼마나 크게 울리게 돼 있었지? 블루투스를 봐. 빈집에서 나는 소리는 누가 듣지?',
        "블루투스 › 2층_스피커 연결 → 녹음 '우리' 재생 → 볼륨을 끝까지."] },

    { id: 'answer', title: '지민의 질문', show: () => f('jiminReturn'), done: () => f('END'),
      hints: ['그 사람은 이 질문에 틀렸다. 그는 소리를 듣지 않는 사람이다.', '지민의 12월 17일 음성 메시지를 들어 봐(위로 올리면 있다).',
        '"한 마디만 나왔어요."'] },
  ];

  // DEBUG title auto-check exceptions (§2.4 · §10 A) — generic nouns, never solution words.
  G.OBJECTIVES.titleExceptions = ['phone', 'home', 'answer'];
})();
