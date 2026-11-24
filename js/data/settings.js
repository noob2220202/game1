/* =========================================================
 * js/data/settings.js — 설정 data (DESIGN §4.8, H2/H3/H5/P6).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const liveHas = (id, s) => ((G.state && G.state.threads && G.state.threads['talk:' + id]) || []).some((m) => m.text && String(m.text).includes(s));

  G.STORY.settings = {
    wifi: [
      { name: 'Haesol_404', connected: true, lock: true, sub: () => (G.flag('M6') || G.flag('netFree') ? '연결됨 · 관리자 네트워크' : '연결됨 · 관리자 네트워크 (일부 서비스 제한)'), signal: 4 },
      { name: 'Haesol_403', lock: true, signal: 3 },
      { name: 'Haesol_Guest', lock: true, signal: 2, sub: '관리자 승인 필요' },
      { name: 'U+Net3F21', lock: true, signal: 2 },
      { name: 'iptime_5G', lock: true, signal: 1 },
    ],

    /* 알림 기록 — story entries (today, game time). Live notifications are merged in by the app. */
    notifHistory: [
      { t: '2026-11-24 04:04', app: 'talk', title: '관리실', body: '[사진] 아직 안 자네 ㅎ', img: 'vault_haru_sleep', deletedNote: '보낸 사람이 삭제한 메시지', show: () => G.flag('managerSlip'), slip: true },
      { t: '2026-11-24 03:39', app: 'talk', title: '관리실', body: '404호 새로 입주하신 분 맞으시죠?', show: () => liveHas('manager', '새로 입주하신') },
      { t: '2026-11-24 03:33', app: 'talk', title: '엄마', body: '부재중 보이스톡' },
      { t: '2026-11-24 03:33', app: 'talk', title: '엄마', body: '세아야 오늘로 1년이야. 엄마 오늘도 전화했어.' },
      { t: '2026-11-24 03:32', app: 'settings', appName: '배터리', title: '배터리 23%', body: '충전기를 연결하세요' },
      { t: '2026-11-24 03:12', app: 'memo', title: '메모', body: "'이 폰을 찾은 사람에게' 열람됨 · 다른 기기", sus: true },
      { t: '2026-11-24 02:59', app: 'haesol', title: '해솔홈', body: '도어락 원격 관리자 잠금 설정 (요청 기기: SM-G991N · 관리자 PIN 변경 없음)', sus: true },
      { t: '2026-11-24 02:58', app: 'haesol', title: '해솔홈', body: '새 기기 SM-G991N 로그인', sus: true },
      { t: '2026-11-24 02:47', app: 'calculator', title: '계산기', body: '사진 1장 저장됨', sus: true },
      { t: '2026-11-24 00:12', app: 'settings', appName: '화면 공유', title: '화면 공유', body: '화면 공유 시작됨 · sagongsa의 Galaxy', sus: true },
      { t: '2026-11-24 00:01', app: 'talk', title: '엄마', body: '숫자 1만 없어지면 엄마는 돼.' },
      { t: '2026-11-24 00:01', app: 'talk', title: '엄마', body: '세아야 답장 안 해도 돼. 읽기만 해.' },
      { t: '2026-11-24 00:00', app: 'talk', title: '지민', body: '1년이야. 보고 싶다 세아야' },
      { t: '2026-11-23 20:06', app: 'talk', title: '지민', body: '이상하게 화가 나' },
      { t: '2026-11-23 20:05', app: 'talk', title: '지민', body: '니 방에 오늘 누가 이사 왔더라' },
      { t: '2026-11-23 18:42', app: 'talk', title: '해솔빌 404호 이사 (택배)', body: '[택배] 고객님의 상품이 문 앞에 배송되었습니다' },
    ],

    /* 디지털 웰빙 (H3) */
    wellbeing: {
      avg: '3시간 17분',
      week: [['수', 196], ['목', 201], ['금', 188], ['토', 205], ['일', 199], ['월', 194], ['화', 41]],
      apps: [
        { id: 'calculator', name: '계산기', time: '2시간 41분', min: 161, hot: true },
        { id: 'talk', name: '톡', time: '14분', min: 14 },
        { id: 'gallery', name: '갤러리', time: '9분', min: 9 },
        { id: 'haesol', name: '해솔홈', time: '6분', min: 6 },
        { id: 'settings', name: '설정', time: '4분', min: 4 },
        { id: 'memo', name: '메모', time: '2분', min: 2 },
        { id: 'recorder', name: '녹음', time: '1분', min: 1 },
      ],
      // calculator: average minutes per hour of day (since 2025.11.25)
      calcHours: [0, 0, 58, 60, 43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },

    /* 저장공간 (H3) */
    storage: {
      total: 128, used: 41.6,
      cats: [['이미지', 9.8, '#ff9f0a'], ['동영상', 6.1, '#ff375f'], ['오디오', 3.4, '#5e5ce6'], ['문서', 0.6, '#64d2ff'], ['앱', 12.3, '#30d158'], ['시스템', 9.4, '#8e8e93']],
      apps: [
        { id: 'calculator', name: '계산기', size: '2.1GB', sub: '이미지·동영상 2.0GB', gb: 2.1, hot: true },
        { id: 'gallery', name: '갤러리', size: '1.3GB', gb: 1.3 },
        { id: 'talk', name: '톡', size: '986MB', gb: 0.98 },
        { id: 'recorder', name: '녹음', size: '612MB', gb: 0.61 },
        { id: 'moment', name: '모먼트', size: '420MB', gb: 0.42 },
        { id: 'mail', name: '메일', size: '210MB', gb: 0.21 },
        { id: 'haesol', name: '해솔홈', size: '96MB', gb: 0.096 },
        { id: 'browser', name: '인터넷', size: '88MB', gb: 0.088 },
        { id: 'memo', name: '메모', size: '12MB', gb: 0.012 },
      ],
    },

    /* 배터리 */
    battery: [
      { name: '시스템 서비스 (화면 공유)', pct: 64, hot: true },
      { name: '화면', pct: 17 },
      { name: '톡', pct: 6 },
      { name: '해솔홈', pct: 4 },
      { name: '계산기', pct: 3 },
      { name: '기타', pct: 6 },
    ],

    about: [
      ['기기 이름', '세아의 Galaxy'],
      ['모델 이름', 'SM-S911N'],
      ['전화번호', '알 수 없음 (SIM 없음)'],
      ['일련번호', 'R3CT40*****'],
      ['IMEI', '35 291811 ****** 4'],
      ['소프트웨어 버전', '7.0 · 보안 패치 2025년 11월 1일'],
      ['Wi-Fi MAC 주소', '9c:2e:a1:**:**:04'],
    ],

    /* search index: keywords → screen */
    search: [
      { title: '모노 오디오', path: '손쉬운 사용 › 오디오', go: 'audio', hl: 'mono', k: ['모노', '하나', '합쳐', '채널', '소리', '오디오', '좌우', '왼쪽', '오른쪽', '스테레오', 'mono', '이어폰', '청각'] },
      { title: '화면 공유(스마트뷰)', path: '연결', go: 'cast', k: ['화면공유', '화면 공유', '스마트뷰', '미러링', '공유', '캐스트', '네모', '아이콘', 'tv', '티비', '연결', 'cast'] },
      { title: '알림 기록', path: '알림', go: 'notifHistory', k: ['알림', '기록', '삭제', '알림기록', '지운', '메시지'] },
      { title: '디지털 웰빙', path: '디지털 웰빙', go: 'wellbeing', k: ['웰빙', '사용 시간', '사용시간', '앱 사용', '스크린타임', '시간', '많이'] },
      { title: '저장공간', path: '배터리 및 디바이스 케어', go: 'storage', k: ['저장', '공간', '용량', 'gb', '메모리', '스토리지'] },
      { title: '배터리', path: '배터리', go: 'battery', k: ['배터리', '충전', '절전', '전원'] },
      { title: 'Wi-Fi', path: '연결', go: 'wifi', k: ['wifi', 'wi-fi', '와이파이', '네트워크', '인터넷', 'haesol'] },
      { title: '블루투스', path: '연결', go: 'bt', k: ['블루투스', 'bluetooth', '버즈', '이어폰'] },
      { title: '흔들어서 실행 취소', path: '손쉬운 사용', go: 'access', hl: 'shake', k: ['흔들', '실행 취소', '실행취소', '되돌리', '복구', 'undo'] },
      { title: '글자 크기', path: '디스플레이', go: 'display', k: ['글자', '크기', '폰트', '텍스트', '글씨'] },
      { title: '휴대전화 정보', path: '휴대전화 정보', go: 'about', k: ['정보', '모델', 'imei', '전화번호', '기기 이름', '버전'] },
      { title: '소리 및 진동', path: '소리 및 진동', go: 'sound', k: ['볼륨', '음량', '진동', '무음', '벨소리'] },
    ],
  };
})();
