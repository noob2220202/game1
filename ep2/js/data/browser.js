/* =========================================================
 * ep2 data · browser.js (owner: media) — DESIGN §4.7.5 · §3.21 인터넷 기록 · §9.5 (no attack 'how-to').
 * G.STORY.browser.start    first screen (다온 · 검색어 입력 · 최근 방문 3 = top 3 history rows · 열린 탭 0)
 * G.STORY.browser.history  19 rows, newest first (all inside his 'on' intervals — §1.2.3 검산)
 * G.STORY.browser.pages    saved pages opened from history rows / results
 * G.STORY.browser.search   fixed results (normalised partial match); noResult list → G.e2.STR.noResult
 * Results: string = a plain result row; { title, page } opens a saved page; { title, action:'emergency' }
 * = number tap → STR.noSimEmergency. District / office names are name tokens (G.T at render).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const ALBUM = "다온 클라우드 – 앨범 '0310'";
  const TANK = ['[건물관리 블로그] 옥상 물탱크실 겨울나기 — 배관 보온재, 문틈 바람막이', '물탱크실 출입문 녹 제거와 경첩 손질', '옥상 물탱크실 출입 통제 안내문 양식'];
  const BUILDING = '새말빌라 · 서울 {eunpyeong} 새말동 · 다세대주택 · 지상 5층 + 옥탑 · 1–2층 근린생활시설';
  const WEATHER = '{eunpyeong} 새말동 · 눈 · −7°C · 대설주의보';
  const BATTERY = '보조배터리에 연결하면 콘센트 없이도 며칠 동안 대기할 수 있습니다. 대기 중엔 초록 불, 연결되면 파란 불이 켜집니다.';

  G.STORY.browser = {
    start: { logo: '다온', placeholder: '검색어 입력', recentTitle: '최근 방문', recentN: 3, tabs: '열린 탭 0' },
    menu: ['기록'], historyTitle: '기록', today: '오늘',

    history: [
      { d: '2026-12-24', when: '오후 6:01', title: '다온 계정 – 로그아웃', page: 'daonLogin' },
      { d: '2026-12-23', when: '오전 1:12', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-22', when: '오후 10:58', title: '블루투스 스피커 보조배터리 연결', page: 'btBattery' },
      { d: '2026-12-22', when: '오전 1:15', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-21', when: '오전 1:13', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-20', when: '오전 1:14', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-19', when: '오전 1:11', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-18', when: '오전 1:12', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-17', when: '오전 1:16', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-16', when: '오전 1:10', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-15', when: '오전 1:13', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-14', when: '오전 1:14', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-13', when: '오전 1:11', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-12', when: '오전 1:15', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-11', when: '오전 4:02', title: '옥상 물탱크실 겨울 바람 막는 법', page: 'tankWinter' },
      { d: '2026-12-11', when: '오전 1:12', title: ALBUM, page: 'daonLogin' },
      { d: '2026-12-10', when: '오후 11:38', title: '다온 클라우드 – 최근 항목', page: 'daonLogin' },
      { d: '2026-12-03', when: '오후 4:12', title: '새말빌라 {eunpyeong} 새말동', page: 'saemalBuilding' },
      { d: '2026-11-26', when: '오전 3:05', title: ALBUM, page: 'daonLogin' },
    ],

    pages: {
      daonLogin: { title: '{$cloudLogin}', button: '로그인', fields: ['아이디', '비밀번호'],
                   after: ['{$newDeviceCode}', '{$smsSent}'], grey: 'SIM 없음' },
      tankWinter: { title: '옥상 물탱크실 겨울 바람 막는 법', results: TANK },
      saemalBuilding: { title: '새말빌라 {eunpyeong} 새말동', body: [BUILDING] },
      btBattery: { title: '블루투스 스피커 보조배터리 연결', body: [BATTERY] },
      articleA: { kind: 'article', source: '한울일보 · 사회', title: '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"',
                  meta: '입력 2026.11.20 06:00 · 수정 2026.11.20 06:12 · 김도윤 기자',
                  body: ['지난해 11월 24일 새벽 마포구의 한 오피스텔에서 실종된 윤모(24) 씨의 행방이 1년째 묘연하다.',   // ep1 original (exempt literal — §10 G)
                         '경찰은 외부 출입 흔적이 없다는 점에 주목했지만 단서를 찾지 못했다.',
                         '윤 씨의 어머니는 "딸 번호를 아직 살려 두고 매일 밤 전화를 건다"고 말했다.',
                         '윤 씨가 살던 404호에는 최근 새 세입자가 입주했다.'] },
      articleB: { kind: 'article', source: '한울일보 · 사회 · 2026.12.21 · 김도윤 기자',
                  title: "해솔빌 '벽 속 은신' 사건 한 달… 용의자 아직 못 찾아",
                  body: ['지난달 24일 새벽 서울 마포구 해솔동의 한 오피스텔 404호에서, 새 입주자 A씨가 벽 안쪽 배관 공간에 숨어 있던 남성에게 감시당하다 비상벨을 눌러 빠져나온 사건이 한 달째 풀리지 않고 있다.',   // hand-written geography (exempt — §10 G)
                         '경찰은 이 공간에서 1년 전 같은 호실에서 실종된 윤모(24) 씨의 물건이 나온 점에 주목해 두 사건의 관련성을 수사하고 있다. 경찰 관계자는 "용의자가 쓰던 휴대전화 기종은 확인했지만 신원은 특정하지 못했다"고 말했다.',
                         'A씨는 경찰의 보호를 받으며 거처를 옮긴 것으로 알려졌다.'] },
    },

    // order of rows does not matter: the longest key contained in the query wins (then a key that
    // contains the query, ≥ 2 chars). keys/org may be tokens (expanded + normalised at match time).
    search: [
      { keys: ['112', '경찰', '신고', '긴급'], results: ['긴급신고 앱 · 휴대전화 본인 인증(문자) 후 사용 가능', '112 문자신고 — 휴대전화 문자로만 접수됩니다'] },
      { keys: ['1366', '여성긴급전화', '상담'], results: [{ title: '여성긴급전화 1366 · 24시간 전화 상담', action: 'emergency' }] },
      { keys: ['스마트 잠금', '잠금 해제'], results: ['[도움말] 스마트 잠금 — 신뢰할 수 있는 장소·기기·네트워크에 있을 때 휴대전화가 잠금 해제 상태를 유지합니다.'] },
      { keys: ['지문', '생체'], results: ['[도움말] 지문 — 등록된 지문은 생체 인식 설정에서 확인하고 삭제할 수 있습니다.'] },
      { keys: ['사용자', '다중 사용자'], results: ['[도움말] 사용자 — 한 휴대전화를 여러 사람이 각자의 홈 화면과 앱으로 쓸 수 있습니다.'] },
      { keys: ['재난문자', '재난 알림', '안전안내문자'], results: ['[도움말] 재난문자는 휴대전화가 있는 곳을 기준으로 받습니다. 등록 지역 밖에 있어도 그곳의 문자가 올 수 있습니다.'] },
      { keys: ['{mapoOrg}', '{eunpyeongOrg}'], org: true, results: ['{org} · 재난 안전 안내 — 안전안내문자 발송 기준'] },
      { keys: ['물탱크실', '물탱크'], results: TANK },
      { keys: ['새말빌라', '새말동'], results: [{ title: BUILDING, page: 'saemalBuilding' }, WEATHER] },
      { keys: ['날씨'], results: [WEATHER] },
      { keys: ['블루투스 스피커'], results: [{ title: BATTERY, page: 'btBattery' }] },
      { keys: ['해솔빌', '윤세아', '404', '실종'], results: [{ title: '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"', page: 'articleA' },
                                                         { title: "해솔빌 '벽 속 은신' 사건 한 달… 용의자 아직 못 찾아", page: 'articleB' }] },
    ],
    noResult: ['0310', '한결', 'sagongsa', '—', '고향의 봄'],
  };
})();
