/* =========================================================
 * js/data/objectives.js — 하루의 수첩 data (DESIGN §2.4, §3; client override in ARCH.md)
 * G.OBJECTIVES  = [{id, title, optional, show():bool, done():bool, hints:[T1,T2,T3]}]
 *                 Array order = priority for the 힌트 tab (main path first, optional last).
 * G.LEADS       = built-in hub leads — intentionally empty (no unsolicited pointers).
 * G.FRAGMENT_SLOTS = the three code slots ①②③ (fixed left→right order).
 * Flags read: M1 M2 M4 M5 M6 M7 M8 END, P3 (memo unlocked), frag47/29/06, acrostic, managerExposed,
 *             ringHeard, F2, doorlockHeard, momRead, deviceBlocked (P7 block; aliases accepted),
 *             vars.climaxStep (room-climax), vars.fired.B08 (director).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const f = (n) => !!(G.flag && G.flag(n));
  const any = (...ns) => ns.some(f);
  const vars = () => (G.state && G.state.vars) || {};
  const frags = () => (G.fragCount ? G.fragCount() : ['47', '29', '06'].filter((id) => f('frag' + id)).length);
  const hub = () => f('M2') || frags() > 0;
  const memoOpen = () => any('P3', 'memo_letter', 'memoUnlocked');
  const blocked = () => any('deviceBlocked', 'P7block', 'blocked', 'mfaStarted', 'mfa') || !!vars().deviceBlocked || !!vars().mfaActive || !!(G.haesol && G.haesol.mfaActive && G.haesol.mfaActive());
  const climax = () => f('M7') && !f('M8') && !f('END');
  const step = (...ids) => climax() && ids.includes(vars().climaxStep);

  G.OBJECTIVES = [
    { id: 'P1', title: '잠금 풀기', show: () => true, done: () => f('M1'),
      hints: ['잠금화면 힌트: 막내가 온 날. 이 집 막내는 누구일까?', '휴대폰을 뒤집어 봐. 케이스 안에 사진이 있어. 번들거리면 손가락으로 밀어 봐.', '콩이가 온 날은 3월 17일. 비밀번호는 0317.'] },
    { id: 'P3', title: '잠긴 메모', show: () => f('M1'), done: () => memoOpen() || f('M2'),
      hints: ['막내는 콩이. 근데 한글이 안 들어가네.', "지민이가 'dkssud'를 놀렸던 대화를 봐. 한/영 안 바꾸고 치면?", 'ㅋㅗㅇㅇㅣ 자리를 영어로: z h d d l.'] },
    { id: 'P4', title: '지워지는 메모', show: () => memoOpen(), done: () => f('M2'),
      hints: ['지워진 지 몇 초밖에 안 됐어. 되돌릴 수 있지 않을까?', '세아가 지민이한테 알려준 꿀팁: 메모 날렸을 때 살린 방법.', '메모 위 ↶ (또는 ⋯ › 실행 취소)'] },

    { id: 'H1', title: '조각 ①', show: () => hub() || f('doorlockHeard'), done: () => f('frag47'),
      hints: ['도어락은 버튼마다 소리 높이가 달라.', "녹음을 틀어 둔 채로 문 쪽 도어락을 눌러 비교해 봐. '음높이 보기'를 켜면 눈으로도 보여. 들리는 건 앞의 두 번뿐.", '4(파)와 7(시). 조각 ①은 47.'] },
    { id: 'H2', title: '조각 ②', show: () => hub(), done: () => f('frag29'),
      hints: ['세아는 "하나로 합쳐"라고 했어. 세아 전공이 뭐였지?', '폰 설정 어딘가에 왼쪽·오른쪽 소리를 하나로 합치는 기능이 있어(손쉬운 사용).', "설정 › 손쉬운 사용 › 모노 오디오를 켜고 '잡음'을 다시 틀어. 조각 ②는 29."] },
    { id: 'H3', title: '조각 ③', show: () => hub(), done: () => f('frag06'),
      hints: ['이 폰에서 제일 많이 쓴 앱이 뭘까? 설정을 봐.', '계산기가 사진을 2GB나 갖고 있대. 계산 기록에 매일 같은 숫자가 있어.', '계산기에 1124 =. 기타 폴더의 까만 사진을 편집 › 노출로 밝혀. 조각 ③은 06. (또는 카메라로 옷장 틈을 2배 확대하고 야간 모드)'] },
    { id: 'P5', title: '관리자 잠금', show: () => hub() || f('M4'), done: () => f('M4'),
      hints: ['도어락은 해솔홈이 관리해. 비밀번호는 모르니까… 찾기?', '세아의 보물 1호. LIVE 사진은 꾹 누르면 소리가 나.', '보안 질문 답은 오르골. 인증번호는 메일 앱에 와 있어.'] },
    { id: 'P6', title: '도어락 원격 잠금', show: () => f('M4'), done: () => f('M5'),
      hints: ['그 사람은 내가 뭘 누르는지 어떻게 이렇게 빨리 알까?', '이 폰 화면을 같이 보고 있는 거라면? 배터리 옆 작은 네모 아이콘. 맨 위를 끌어내려 봐.', '빠른 설정 › 화면 공유 [중지] (또는 설정 › 연결 › 화면 공유 › 연결 끊기).'] },
    { id: 'P7block', title: '그 사람 기기', show: () => f('M5'), done: () => blocked() || f('M6'),
      hints: ["어느 기기가 '404호(실내)'에 있지?", 'sagongsa = 사공사 = 404. 그 사람 계정.', '기기 관리 › sagongsa (SM-G991N) › 차단.'] },
    { id: 'P7mfa', title: '로그인 요청', show: () => f('M5') && blocked(), done: () => f('M6'),
      hints: ['네가 로그인한 게 아니잖아.', '숫자를 누르라는 건 그 사람이 들어오려는 거야. 전부 거부.', "거부 ×5 (숫자 화면에선 '요청하지 않았어요') → 보호하기."] },
    { id: 'P8door', title: '문', show: () => (f('M6') || frags() === 3) && !f('M7'), done: () => f('M7'),
      hints: ['세아가 나눠 숨긴 조각 세 개를 ① ② ③ 순서대로 이으면 여섯 자리.', '비밀번호만으로는 안 열려. 그 사람을 먼저 끊고(차단·보호하기), 카메라 › 현관문 › 도어락.', '도어락에 4 7 2 9 0 6 그리고 확인(#).'] },

    // ---- climax steps (P8; room-climax drives vars.climaxStep) ----
    { id: 'P8handle', title: '문을 연다', show: () => step('handle'), done: () => !step('handle'),
      hints: ['문이 풀렸어. 이제 나가.', '현관문 손잡이.', '화면의 손잡이를 눌러.'] },
    { id: 'P8hide', title: '숨는다', show: () => step('ajar', 'hide'), done: () => !step('ajar', 'hide'),
      hints: ['세아가 그 사람이 나오면 뭘 하라고 했지?', '화면 빛을 숨겨. 소리도 내지 마.', '화면을 꾹 눌러 빛을 가려. 다 지나갈 때까지 손을 떼지 마.'] },
    { id: 'P8call', title: '전화가 울린다', show: () => step('call'), done: () => !step('call'),
      hints: ['소리가 나면 들켜.', '빨리 끊어.', "'거절'을 눌러."] },
    { id: 'P8guard', title: '도어가드 풀기', show: () => step('quiet', 'guard'), done: () => !step('quiet', 'guard'),
      hints: ['문이 왜 10cm에서 멈췄지?', '문 위쪽에 걸쇠가 걸려 있어. 천천히, 조용히.', '문 위쪽 U자 걸쇠를 오른쪽으로 천천히 밀어.'] },
    { id: 'P8bell', title: '도움 부르기', show: () => step('slam', 'bell'), done: () => f('M8') || !step('slam', 'bell'),
      hints: ['이제는 소리를 내야 해. 누군가를 불러.', '해솔홈에 비상벨이 있었지.', '해솔홈 비상벨을 2초 길게 눌러.'] },
    { id: 'P8out', title: '밖으로', show: () => f('M8') && !f('END'), done: () => f('END'),
      hints: ['밖에 누가 왔어.', '이번엔 진짜야. 문을 열어 줘.', '손잡이를 밀어서 문을 열어.'] },

    // ---- optional / soft (listed last) ----
    { id: 'P2', title: '이 폰은 누구 거지?', optional: true, show: () => f('M1') && !memoOpen(), done: () => memoOpen() || f('momRead') || f('M2'),
      hints: ['잠금화면 이름: 세아 💛 콩이. 이 폰 주인은 세아야.', '톡에서 엄마, 지민이와의 대화를 읽어 봐. 그리고 메모 앱.', "메모 앱에 '이 폰을 찾은 사람에게'라는 잠긴 메모가 있어."] },
    { id: 'H4', title: '2쪽', optional: true, show: () => hub() && !f('M7'), done: () => f('acrostic'),
      hints: ['세아는 그 사람이 폰을 본다는 걸 알았어. 그래서 누구나 보는 곳에 숨겼어. 모먼트.', 'SNS는 최신 글이 위야. 맨 아래(가장 오래된 글)부터 첫 글자만.', "옷·장·뒤·에·누·가 … 그리고 오늘 밤 올라온 '있어'. 메모 2쪽에 '옷장'만 써도 돼."] },
    { id: 'H5', title: '관리실', optional: true, show: () => (hub() || !!(vars().fired || {}).B08) && !f('M7'), done: () => f('managerExposed'),
      hints: ['관리실 번호, 진짜 맞을까?', "현관문 쪽을 카메라로 확대해 봐. 스티커가 있어. 그리고 연락처 '관리실'의 수정 날짜.", '스티커 02-338-5120 ≠ 연락처 010-8817-3302. 세아가 사라진 다음 날 누가 번호를 바꿨어.'] },
    { id: 'H6', title: '내 폰', optional: true, show: () => f('F2') && !f('M7'), done: () => f('ringHeard'),
      hints: ['폰 잃어버리면 제일 먼저 뭘 하지?', '"{N}" 대화방, 그거 네 계정이잖아. 전화 걸어 봐.', '톡 › {N} › 📞 그리고 카메라를 켜서 소리 나는 쪽을 봐. (이어폰 추천)'] },
  ];

  /** hub leads: none. (Client: no unsolicited pointers — the player finds the places from 세아's letter.) */
  G.LEADS = [];

  G.FRAGMENT_SLOTS = [
    { id: '47', mark: '①', label: '앞 두 자리', note: '① 4 7 — 앞의 두 번만 들렸다.' },
    { id: '29', mark: '②', label: '가운데 두 자리', note: '② 2 9 — 세아가 직접 봤다.' },
    { id: '06', mark: '③', label: '마지막 두 자리', note: '③ 0 6 — 그 사람 벽에 붙은 카드. 앞 네 자리는… 내 사진으로 가려져 있었다.' },
  ];
})();
