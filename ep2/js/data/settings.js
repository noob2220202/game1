/* =========================================================
 * ep2 data — 설정 (DESIGN §4.6.0–§4.6.8 · §4.6.11 · §4.6.12 · §5.3 · §5.6 · §5.7; ARCH §5.5 · §4.22)
 * owner: shell. Reader: engine/apps/settings.js (+ ep2/js/apps/security.js for its delegated keys).
 *   G.STORY.settings = { root, account, search, connect, wifi, bt, btScreen, volume, sound, tone, perChat, notif, display,
 *                        wallpaper, location, accounts, battery, about, general, security, dash }
 * Every string is DESIGN text (⊕ lines included) or a fragment of it; tokens are expanded with G.T at render.
 * Lazy values (functions) are evaluated at render time only.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const curUser = () => (G.users && G.users.current ? G.users.current() : 'n');
  const T = (s) => (G.T ? G.T(s) : s);
  const batt = () => (G.battery ? G.battery() : 67);

  G.STORY.settings = {
    title: '설정',
    searchPh: '설정 검색',
    /* §4.6.0 첫 화면 (no '—' here — dashSeen only via QS · 설정 › 사용자; no 디지털 웰빙 · 저장공간 · 알림 기록 rows) */
    root: [
      { key: 'connect', title: '연결', sub: 'Wi-Fi · 블루투스 · 비행기 모드', icon: 'wifi', bg: '#3e91ff' },
      { key: 'sound', title: '소리 및 진동', sub: '소리 모드 · 볼륨 · 알림 소리', icon: 'sound', bg: '#8b6cf6' },
      { key: 'notif', title: '알림', sub: '앱 알림 · 방해 금지', icon: 'bell', bg: '#f26d50' },
      { key: 'display', title: '디스플레이', sub: '밝기 · 글자 크기', icon: 'display', bg: '#34c27a' },
      { key: 'wallpaper', title: '배경화면', sub: '배경화면 · 잠금화면 위젯', icon: 'wall', bg: '#e45fa0' },
      { key: 'lock', title: '잠금 화면', sub: '화면 잠금 유형 · 스마트 잠금', icon: 'lock', bg: '#2fb0a6' },
      { key: 'bio', title: '보안 및 개인정보', sub: '생체 인식 · 내 디바이스 찾기', icon: 'shield', bg: '#4f6bd8' },
      { key: 'location', title: '위치', sub: '위치 서비스 · 최근 위치 요청', icon: 'pin', bg: '#3fa45b' },
      { key: 'users', title: '사용자', sub: () => `현재 사용자: ${curUser() === 'n' ? T('{N}') : '—'}`, icon: 'users', bg: '#5b8def' },
      { key: 'accounts', title: '계정 및 백업', sub: '계정 관리', icon: 'cloud', bg: '#4a90d9' },
      { key: 'general', title: '일반', sub: '키보드 · 언어 · 날짜 및 시간', icon: 'general', bg: '#7d8794' },
      { key: 'battery', title: '배터리', sub: () => `${batt()}%`, icon: 'batt', bg: '#2fbf71' },
      { key: 'about', title: '휴대전화 정보', sub: '{N}의 휴대전화', icon: 'info', bg: '#8e8e93' },
    ],
    account: { title: '{N}', sub: '다온 계정 없음 ›' },
    /* §4.6.0 설정 검색 — normalised partial match; results [title, path, key] ('app:<id>' opens an app) */
    search: [
      { keys: ['잠금', '신뢰', '스마트', '자동', '해제'], results: [['스마트 잠금', '잠금 화면', 'lock.smart'], ['화면 잠금 유형', '잠금 화면', 'lock']] },
      { keys: ['지문', '생체', '손가락'], results: [['생체 인식', '보안 및 개인정보', 'bio.finger']] },
      { keys: ['사용자', '사람', '프로필', '전환', '—'], results: [['사용자', '사용자', 'users']] },
      { keys: ['키보드', '예측', '단어', '사전', '자판'], results: [['개인 단어 목록', '일반 › 키보드 › 예측 텍스트', 'kbd.words']] },
      { keys: ['와이파이', 'wifi', '네트워크', '핫스팟', 'saemal'], results: [['Wi-Fi', '연결', 'wifi'], ['저장된 네트워크', '연결 › Wi-Fi', 'wifi.saved']] },
      { keys: ['블루투스', 'bluetooth', '스피커', '연결', '2층'], results: [['블루투스', '연결', 'bt']] },
      { keys: ['소리', '알림음', '벨소리', '음량', '볼륨', '진동'],
        results: [['알림 소리', '소리 및 진동', 'sound.notif'], ['볼륨', '소리 및 진동', 'volume'], ['대화별 알림음', '알림 › 앱 알림 › 모먼트', 'notif.perChat']] },
      { keys: ['위치', '타임라인', '기록', '동선'], results: [['위치', '', 'location'], ['타임라인', '', 'app:timeline']] },
      { keys: ['재난', '경보', '안전', '문자'], results: [['재난 알림 설정', '재난 알림', 'alerts.settings']] },
      { keys: ['계정', '로그인', '다온', '백업'], results: [['계정 관리', '계정 및 백업', 'accounts.manage']] },
      { keys: ['분실', '찾기'], results: [['내 디바이스 찾기', '보안 및 개인정보', 'bio']] },
      { keys: ['위젯', '배경'], results: [['배경화면', '', 'wallpaper']] },
      { keys: ['배터리', '충전'], results: [['배터리', '', 'battery']] },
      { keys: ['정보', '모델', 'sim', '유심', '번호'], results: [['휴대전화 정보', '', 'about']] },
    ],
    /* 연결 */
    connect: { title: '연결', wifi: 'Wi-Fi', bt: '블루투스', airplane: '비행기 모드', notConnected: '연결 안 됨' },
    /* §4.6.6 연결 › Wi-Fi */
    wifi: {
      title: 'Wi-Fi', on: '켜짐', off: '꺼짐', current: '현재 네트워크', available: '사용 가능한 네트워크', connected: '연결됨',
      auto: 'Wi-Fi 자동으로 켜기 · 자주 쓰는 장소 근처에서', saved: '저장된 네트워크', savedShort: '저장된 네트워크', del: '삭제',
      pwPh: '비밀번호', join: '연결', cancel: '취소', notConnected: '연결 안 됨',
    },
    /* §4.6.7 · §5.6 연결 › 블루투스 */
    btScreen: {
      title: '블루투스', on: '켜짐', off: '꺼짐', phoneName: '이 휴대전화 이름', name: '{N}의 휴대전화', saved: '저장된 기기', available: '사용 가능한 기기',
      notConnected: '연결 안 됨', searching: '검색 중…', none: '주변에 기기가 없습니다',
      detail: { name: '이름', rename: '이름 변경', kind: '종류', added: '등록', by: '추가한 사람: 나', last: '마지막 연결', connectedNow: '연결됨',
        vol: '미디어 볼륨', call: '통화 오디오', callOff: '꺼짐', disconnect: '연결 해제', cancel: '취소', cut: '연결 끊기', ok: '확인' },
    },
    /* §4.6.7 볼륨 패널 · 설정 › 소리 및 진동 › 볼륨 */
    volume: { title: '볼륨', mediaBt: '미디어 · 2층_스피커', mediaPhone: '미디어 · 이 휴대전화', ring: '벨소리', notif: '알림', system: '시스템' },
    /* §4.6.8 소리 및 진동 */
    sound: { title: '소리 및 진동', mode: '소리 모드', modes: [['sound', '소리'], ['vibrate', '진동'], ['mute', '무음']], volume: '볼륨',
      notifTone: '알림 소리', ringtone: '벨소리', ringtoneMeta: '기본' },
    tone: { title: '알림 소리', reset: '기본값으로 재설정', perChat: '대화별 알림음' },
    /* §3.11 · §4.6.8 대화별 알림음 */
    perChat: [
      { chat: 'seah_y', label: 'seah_y', line: '설정 2026.11.27 오전 3:33 · 나', grey: '대화가 없습니다', locked: true },
      { chat: 'fake', label: '{MAKER_CONTACT}', line: '설정 2026.12.24 오후 7:22 · 나', changedLine: '설정 방금 · 나' },
    ],
    /* 알림 (§4.6.0 sub `앱 알림 · 방해 금지`) */
    notif: { title: '알림', apps: '앱 알림', dnd: '방해 금지', moment: '모먼트' },
    /* §4.6.11 디스플레이 */
    display: { title: '디스플레이', brightness: '밝기', textSize: '글자 크기', dark: '어두운 모드',
      sizes: [[0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']], sample: '가' },
    /* 배경화면 · 잠금화면 위젯 (§4.6.0 · §4.6.4) */
    wallpaper: { title: '배경화면', home: '배경화면', widget: '잠금화면 위젯', dashMeta: '내 사진' },
    /* §4.6.11 위치 */
    location: { title: '위치', on: '켜짐', services: '위치 서비스', recentHead: '최근 위치 요청',
      rows: [['타임라인', '켜짐 · 2026.12.10부터'], ['재난 알림 위치 기반 수신', '켜짐']], recent: [['재난 알림', '오늘 오후 10:52'], ['타임라인', '지금']] },
    /* §4.6.11 계정 및 백업 › 계정 관리 */
    accounts: { title: '계정 및 백업', manage: '계정 관리', empty: '추가된 계정이 없습니다', add: '계정 추가', loginTitle: '다온 계정',
      id: '아이디', pw: '비밀번호', login: '로그인', sim: 'SIM 없음' },
    /* §4.6.11 배터리 */
    battery: { title: '배터리', usageHead: '사용량 (마지막 충전 이후)', usage: '화면 38% · 모먼트 17% · 시스템 15% · 블루투스 6% · 기타 24%' },
    /* §4.6.11 휴대전화 정보 */
    about: { title: '휴대전화 정보', name: '{N}의 휴대전화', model: '스마트폰 (128GB)', number: '알 수 없음', sim: 'SIM 없음', uptimeFrom: '18:00',
      rows: { name: '휴대전화 이름', model: '모델명', number: '전화번호', sim: 'SIM 상태', uptime: '작동 시간', sw: '소프트웨어 정보' } },
    /* 일반 (ARCH §4.22 key `general`) */
    general: { title: '일반', kbd: '키보드', lang: '언어', date: '날짜 및 시간' },
    /* §4.6.3 보안 및 개인정보 */
    securityTitle: '보안 및 개인정보',
    security: [['생체 인식', '지문 2개'], ['화면 잠금 유형', 'PIN · 지문'], ['내 디바이스 찾기', '꺼짐 · 2026.11.24 오전 4:51'], ['앱 권한', ''], ['보안 업데이트', '2026년 11월 1일']],
    fingerCount: (k) => `지문 ${k}개`,
    /* §4.6.12 '—' side */
    dash: { bio: '등록된 지문이 없습니다', lockType: 'PIN', wallpaper: '내 사진', account: '추가된 계정이 없습니다', name: '—' },
  };
})();
