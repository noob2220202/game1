/* =========================================================
 * ep3/js/data/settings.js — 엄마 폰 설정 data (shell · ARCH_EP3 §6.6 · §5.21 · DESIGN_EP3 §3.3 · §3.9 · §4.7.1–§4.7.4 · §9.5-2).
 * → G.STORY.settings (v:3 — the switch engine/apps/settings.js branches on). Read by engine/apps/settings.js and
 *   ep3/js/apps/easymode.js only. Strings are DESIGN text (⊕ lines included), raw tokens ({$key}) expanded by G.T at render.
 * Search rows: ONE schema { kw:[…], title, where, open?:'settings:<key>'|'callrec:<screenId>', easy?:'gate:rec'|'gate:spam'|'hide',
 *   gen?:true } — easy:'gate:*' = easy-mode-only row (opens the E6 gate), easy:'hide' = standard-only row, no easy = both modes;
 *   gen = an ordinary row of §4.7.1 ⊕ (listed after the §3.3 table rows). Matching = G.e3.norm, bidirectional includes.
 * No code runs at load except defining the object.
 * ========================================================= */
window.G = window.G || {};
(function (G) {
  'use strict';
  const REC = ['녹음', '통화녹음', '자동녹음', '녹취', '레코드', 'record'];                       // §3.3 / §4.7.1 row 1 (+ 최근 검색어 '통화 녹음')
  const BLK = ['차단', '스팸', '광고', '수신거부', '거부', '막기', 'block', 'spam'];               // §4.7.1 row 2
  const DND = ['방해', '방해금지', '무음', '조용', '밤', '수면', '알림끄기', '반복', 'dnd'];       // §4.7.1 row 3
  const EASY = ['쉬운', '쉬움', '쉽게', '쉬운모드', '간편', '간편모드', '간단', '단순', '큰글씨', '큰글자', '글씨', '글자', '큰', '크게',
    '표준', '표준모드', '모드', '홈화면', '홈', '안경', '노인', '어르신', 'easy', 'simple'];         // §4.7.1 row 4 (24어)
  const FONT = ['글씨', '글자', '큰', '크게'];
  G.STORY = G.STORY || {};
  G.STORY.settings = {
    v: 3,
    title: '설정', searchPh: '설정 검색',
    /* 첫 화면 (§3.3 sketch — [key, title, sub]) */
    root: [['wifi', 'Wi-Fi', () => (G.phone && G.phone.wifi && !G.phone.wifi.on() ? '꺼짐' : '집')],
      ['bt', '블루투스', () => (G.state && G.state.vars && G.state.vars.sh && G.state.vars.sh.btUi ? '켜짐' : '꺼짐')],
      ['sound', '소리 및 진동', ''], ['notif', '알림', '앱 알림 · 방해 금지'],
      ['display', '디스플레이', '밝기 · 글자 크기 · 쉬운 모드'], ['wallpaper', '배경화면', ''], ['lock', '잠금 화면', '밀어서 열기'],
      ['battery', '배터리', () => `${G.battery ? G.battery() : 72}%`], ['access', '접근성', ''], ['general', '일반', '언어 · 날짜 및 시간'], ['about', '휴대전화 정보', '']],
    recent: ['통화 녹음'],                                    // `최근 검색어` — × hides it for this page session only (§9.5-2)
    search: [
      // §3.3 / §4.7.1 table — each keyword group reaches every row of its mode (ARCH §9 G62)
      { kw: REC, title: '통화 자동 녹음', where: '전화', easy: 'gate:rec' },
      { kw: REC, title: '통화 녹음', where: '전화 설정', easy: 'hide', open: 'callrec:rec.settings' },
      { kw: REC, title: '녹음된 통화', where: '전화 설정', easy: 'hide', open: 'callrec:rec.list' },
      { kw: BLK, title: '스팸 및 사기 의심 전화 차단', where: '전화', easy: 'gate:spam' },
      { kw: BLK, title: '번호 차단', where: '전화 설정', easy: 'hide', open: 'callrec:block' },
      { kw: BLK, title: '차단된 통화', where: '전화 설정', easy: 'hide', open: 'callrec:block.calls' },
      { kw: BLK, title: '번호 및 스팸 차단', where: '메시지 설정', easy: 'hide', open: 'callrec:block' },
      { kw: DND, title: '방해 금지', where: '알림', open: 'settings:dnd' },
      { kw: EASY, title: '쉬운 모드', where: '디스플레이', open: 'settings:display.easy' },
      { kw: FONT, title: '글자 크기와 스타일', where: '디스플레이', open: 'settings:display.font' },
      // ordinary rows (§4.7.1 ⊕ — 쉬운 · 표준 같음)
      { gen: true, kw: ['와이파이', 'wifi', '인터넷'], title: 'Wi-Fi', where: '', open: 'settings:wifi' },
      { gen: true, kw: ['블루투스'], title: '블루투스', where: '', open: 'settings:bt' },
      { gen: true, kw: ['소리', '벨소리', '진동', '음량', '볼륨'], title: '소리 및 진동', where: '', open: 'settings:sound' },
      { gen: true, kw: ['소리', '벨소리', '진동', '음량', '볼륨'], title: '벨소리', where: '소리 및 진동', open: 'settings:sound' },
      { gen: true, kw: ['알림'], title: '알림', where: '', open: 'settings:notif' },
      { gen: true, kw: ['알림'], title: '앱 알림', where: '알림', open: 'settings:notif.apps' },
      { gen: true, kw: ['밝기', '화면'], title: '밝기', where: '디스플레이', open: 'settings:display' },
      { gen: true, kw: ['밝기', '화면'], title: '화면 자동 꺼짐', where: '디스플레이', open: 'settings:display' },
      { gen: true, kw: ['확대'], title: '화면 확대', where: '디스플레이', open: 'settings:display.zoom' },
      { gen: true, kw: ['배경', '바탕'], title: '배경화면', where: '', open: 'settings:wallpaper' },
      { gen: true, kw: ['잠금', '비밀번호', '패턴'], title: '잠금 화면', where: '', open: 'settings:lock' },
      { gen: true, kw: ['잠금', '비밀번호', '패턴'], title: '화면 잠금 방식', where: '잠금 화면', open: 'settings:lock' },
      { gen: true, kw: ['배터리', '충전', '절전'], title: '배터리', where: '', open: 'settings:battery' },
      { gen: true, kw: ['언어', '날짜', '시간'], title: '언어', where: '일반', open: 'settings:general' },
      { gen: true, kw: ['언어', '날짜', '시간'], title: '날짜 및 시간', where: '일반', open: 'settings:general' },
      { gen: true, kw: ['번호', '전화번호', '내번호', '이름', '정보', '기기'], title: '휴대전화 정보', where: '', open: 'settings:about' },
      { gen: true, kw: ['접근성'], title: '접근성', where: '', open: 'settings:access' },
    ],
    /* 방해 금지 (§3.9 · §4.7.3) */
    dnd: {
      title: '방해 금지',
      now: ['지금 사용', false],
      scheduleHead: '일정', schedule: ['매일 오후 11:00 – 오전 7:00', '사용 안 함'], schedOn: '사용 중',
      scheduleRows: [['일정 이름', '매일'], ['시작', '오후 11:00'], ['끝', '오전 7:00'], ['요일', '매일']],
      exceptionsHead: '예외', exceptions: [['전화 · 반복 전화 허용', '켜짐', '{$repeatCall}'], ['알림 · 없음', '']],
      last: '마지막 사용 · 2025.11.24 오전 7:00', logRow: '사용 기록', off: '꺼짐',
      callsTitle: '전화', callsOptions: [['all', '모든 전화'], ['contacts', '연락처만'], ['fav', '즐겨찾기만'], ['none', '없음']], callsDefault: 'none',
      repeatTitle: '반복 전화 허용', repeatDesc: '{$repeatCall}',
    },
    /* 사용 기록 — generated daily rows `2025.11.23 (일) 오후 11:00 – 11.24 (월) 오전 7:00   일정` (365 rows, newest first) */
    dndLog: { from: '2024-11-24', to: '2025-11-23', start: '오후 11:00', end: '오전 7:00', kind: '일정', foot: '{$dndLogFoot}',
      today: '오늘', nowKind: '사용 중' },
    about: [['이름', '엄마 폰'], ['전화번호', '010-0718-2215'], ['SIM', '있음']],
    kbd: [['예측 텍스트', '꺼짐']],
    /* the other screens (§4.7.4 — real-phone wording, view-only, progress 0) */
    screens: {
      recentHead: '최근 검색어',
      wifi: { title: 'Wi-Fi', on: '켜짐', off: '꺼짐', current: '', connected: '연결됨', scanning: '다른 네트워크 검색 중…' },
      bt: { title: '블루투스', on: '켜짐', off: '꺼짐', searching: '주변 기기 검색 중…', none: '찾은 기기 없음' },
      sound: { title: '소리 및 진동', mode: '소리 모드', modes: [['sound', '소리'], ['vibrate', '진동'], ['mute', '무음']],
        rows: [['벨소리', '기본 벨소리'], ['알림 소리', '딩동'], ['진동 패턴', '기본']], volume: '음량',
        sliders: [['벨소리', 40], ['미디어', 60], ['알림', 30], ['시스템', 30]] },
      notif: { title: '알림', apps: '앱 알림', dnd: '방해 금지', on: '켜짐', off: '꺼짐', lockNotif: ['잠금 화면 알림', '내용 표시'], popup: ['알림 팝업 스타일', '간단히'],
        appList: [['phone', '전화'], ['sms', '메시지'], ['talk', '톡'], ['gallery', '사진'], ['calendar', '캘린더'], ['moim', '모임'], ['clock', '시계']] },
      wallpaper: { title: '배경화면', lock: '잠금 화면 — 콩이', home: '홈 화면 — 콩이 산책', lockKey: 'kongi_old', homeKey: 'p3_home_wall' },
      lock: { title: '잠금 화면', method: ['화면 잠금 방식', '밀어서 열기'], methods: ['밀어서 열기', '패턴', 'PIN', '비밀번호'], wall: ['잠금 화면 배경', '콩이'], notif: ['알림', '내용 표시'] },
      battery: { title: '배터리', rows: [['절전 모드', '꺼짐'], '충전 중 아님'] },
      access: { title: '접근성', rows: ['시인성 향상', '상호작용 및 조작', ['음성 안내', '꺼짐']] },
      general: { title: '일반', rows: [['언어', '한국어'], ['날짜 및 시간', '자동'], ['키보드', '기본 키보드', 'general.kbd']], kbdTitle: '키보드' },
      about: { title: '휴대전화 정보', rows: [['이름', '엄마 폰'], ['전화번호', '010-0718-2215'], ['모델 이름', '휴대전화'], ['SIM', '있음'], ['소프트웨어 정보', '', 'about.sw']],
        swTitle: '소프트웨어 정보', swText: '최신 소프트웨어입니다.' },
    },
  };
})(window.G);
