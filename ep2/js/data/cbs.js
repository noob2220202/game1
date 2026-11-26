/* =========================================================
 * ep2 data · cbs.js (owner: media) — DESIGN §3.6 · §4.6.9 · §5.5 · §9.6 ② (client decision ①).
 * G.STORY.cbs       [은평구청] 8 rows (evening texts — not in the days table, so listed here).
 * G.STORY.cbsMapo   [마포구청] 7 rows: receive SECONDS + body only. The HH:MM comes from
 *                   G.STORY.days[d].mapo (single source — the two can never drift apart).
 * G.STORY.cbsSettings  ⚙ 재난 알림 설정 rows (§4.6.9).
 * G.STORY.cbsUI     fixed screen strings of the 재난 알림 app.
 * Organisation / district names are ALWAYS name tokens ({eunpyeongOrg} {mapoOffice} …) expanded by
 * G.T at render time — never literal (QA swap test §10 G).
 * Seconds are the §4.6.9 table values (canonical — §0.2 D16).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.cbs = [
    { d: '12-24', t: '22:52:14', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '오늘 22시 {eunpyeong} 대설주의보 발효. 내 집 앞 눈 치우기에 참여해 주세요.' },
    { d: '12-22', t: '23:40:09', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '한파경보 발효 중. 수도 계량기 동파에 유의 바랍니다.' },
    { d: '12-20', t: '23:10:33', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '안전안내문자', text: '연휴 기간 새말동 일대 빈집 무단침입 신고가 늘고 있습니다. 빈집에서 수상한 소리·불빛이 나면 112로 신고해 주세요.' },
    { d: '12-18', t: '22:58:46', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '도로 결빙 주의. 보행 시 낙상에 유의 바랍니다.' },
    { d: '12-16', t: '23:21:05', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '한파경보 지속. 노약자는 외출을 자제해 주세요.' },
    { d: '12-14', t: '22:47:31', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '대설주의보 발효. 차량 운행 시 감속 바랍니다.' },
    { d: '12-12', t: '23:05:57', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '한파경보 발효. 수도관 동파에 유의 바랍니다.' },
    { d: '12-10', t: '23:02:44', org: '{eunpyeongOrg}', office: '{eunpyeongOffice}', kind: '긴급재난문자', text: '한파주의보 발효. 외출 시 보온에 유의 바랍니다.' },
  ];

  /* [마포구청] 안전안내문자 — d: [seconds, body]. HH:MM = G.STORY.days[d].mapo */
  G.STORY.cbsMapo = {
    '12-23': ['42', '오늘 아침 출근길 빙판 주의. 대중교통을 이용해 주세요.'],
    '12-21': ['51', '수도관 동파 신고가 늘고 있습니다. 계량기함 보온에 유의 바랍니다.'],
    '12-19': ['27', '대설 예비특보. 내 집 앞 눈 치우기에 참여해 주세요.'],
    '12-17': ['12', '06시 20분경 관내 상가 화재 진화 완료. 연기 흡입에 주의 바랍니다.'],
    '12-15': ['08', '한파경보 발효 중. 홀로 계신 어르신 안부를 확인해 주세요.'],
    '12-13': ['19', '관내 이면도로 결빙. 차량은 서행해 주세요.'],
    '12-11': ['38', '오늘 아침 기온 영하 9도. 빙판길 낙상에 유의 바랍니다.'],
  };
  G.STORY.cbsMapoMeta = { org: '{mapoOrg}', office: '{mapoOffice}', kind: '안전안내문자' };

  /* ⚙ 재난 알림 설정 (§4.6.9) — toggle:true rows can be switched (records stay — 판정 0, 문구 0) */
  G.STORY.cbsSettings = [
    { key: 'emergency', label: '긴급재난문자', value: '켜짐', toggle: true },
    { key: 'safety', label: '안전안내문자', value: '켜짐', toggle: true },
    { key: 'location', label: '위치 기반 수신', value: '켜짐 · 2026.12.10 다른 기기에서 동기화됨', toggle: true },
    { key: 'region', label: '등록 지역', value: '{eunpyeong} 새말동' },
    { key: 'route', label: '수신 경로', value: '데이터(Wi-Fi)' },
    { key: 'sound', label: '알림 소리', value: '기본 경보음', grey: true },
  ];

  G.STORY.cbsUI = {
    title: '재난 알림',
    tabs: [['all', '전체'], ['emergency', '긴급재난문자'], ['safety', '안전안내문자']],
    head: '등록 지역 {eunpyeong} 새말동 · 위치 기반 수신 켜짐 (2026.12.10부터) · 데이터로 수신 중 (SIM 없음)',
    foot: '2026.12.10 이전 기록 없음',
    from: '발신', recv: '수신', reason: '수신 사유', route: '수신 경로',
    reasonMapo: '현재 위치(기기 위치 기반) · 등록 지역 아님',
    reasonHome: '등록 지역 · 현재 위치',
    routeValue: '데이터(Wi-Fi)',
    settingsTitle: '재난 알림 설정',
    off: '꺼짐',
    keywords: ['재난', '경보', '안전', '문자'],
  };
})();
