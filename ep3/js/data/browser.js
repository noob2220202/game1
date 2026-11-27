/* =========================================================
 * ep3 data · browser.js (owner: media) → G.STORY.browser (v:3) — read by engine/apps/browser.js (folder 인터넷).
 * DESIGN_EP3 §4.8.4 인터넷 · §5.2 📁 인터넷 · §0.3 D16 (device how-to searches → {$noResult} — hard mode: the only
 * hint channel is the notebook) · §5.6 (끈다: 2편 기록 19줄 · 다른 기기 탭 · QR).
 * Start `다온` · search `검색어 입력` · `최근 방문` 0 · `열린 탭 0` · ⋮ › `기록` → `방문 기록이 없습니다`
 * (the player's own searches of tonight stack under `오늘` — text in the session store only, never the save).
 * Fixed results: normalised partial match (engine rule — the longest key contained in the query wins, then a key
 * containing a ≥ 2-char query); `noResult` = exact device how-to / clue words that always answer {$noResult}.
 * Articles A (ep1 original) and B (ep2 original) are reused verbatim — geography through name tokens.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const ART_A = '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"';
  const ART_B = "해솔빌 '벽 속 은신' 사건 한 달… 용의자 아직 못 찾아";

  G.STORY.browser = {
    v: 3,
    start: { logo: '다온', placeholder: '검색어 입력', recentTitle: '최근 방문', recentN: 0, tabs: '열린 탭 0' },
    menu: ['기록'], historyTitle: '기록', today: '오늘', historyEmpty: '방문 기록이 없습니다',
    history: [],

    pages: {
      articleA: { kind: 'article', source: '한울일보 · 사회', title: ART_A,
                  meta: '입력 2026.11.20 06:00 · 수정 2026.11.20 06:12 · 김도윤 기자',
                  body: ['지난해 11월 24일 새벽 {mapo}의 한 오피스텔에서 실종된 윤모(24) 씨의 행방이 1년째 묘연하다.',
                         '경찰은 외부 출입 흔적이 없다는 점에 주목했지만 단서를 찾지 못했다.',
                         '윤 씨의 어머니는 "딸 번호를 아직 살려 두고 매일 밤 전화를 건다"고 말했다.',
                         '윤 씨가 살던 404호에는 최근 새 세입자가 입주했다.'] },
      articleB: { kind: 'article', source: '한울일보 · 사회 · 2026.12.21 · 김도윤 기자', title: ART_B,
                  body: ['지난달 24일 새벽 서울 {mapo} 해솔동의 한 오피스텔 404호에서, 새 입주자 A씨가 벽 안쪽 배관 공간에 숨어 있던 남성에게 감시당하다 비상벨을 눌러 빠져나온 사건이 한 달째 풀리지 않고 있다.',
                         '경찰은 이 공간에서 1년 전 같은 호실에서 실종된 윤모(24) 씨의 물건이 나온 점에 주목해 두 사건의 관련성을 수사하고 있다. 경찰 관계자는 "용의자가 쓰던 휴대전화 기종은 확인했지만 신원은 특정하지 못했다"고 말했다.',
                         'A씨는 경찰의 보호를 받으며 거처를 옮긴 것으로 알려졌다.'] },
    },

    search: [
      { keys: ['112', '경찰', '신고', '긴급'], results: ['112 — 범죄 신고는 112, 문자 신고도 됩니다.'] },
      { keys: ['1366', '여성긴급전화', '상담', '스토킹'], results: ['여성긴급전화 1366 · 24시간 전화 상담'] },
      { keys: ['미역국'], results: ['소고기 미역국 끓이는 법 — 미역 불리기, 참기름에 고기 볶기, 국간장으로 간하기'] },
      { keys: ['날씨', '대전', '{daejeon}'], results: ['{daejeon} · 맑음 · −6°C'] },
      { keys: ['윤세아', '실종', '해솔빌', '404'], results: [{ title: ART_A, page: 'articleA' }, { title: ART_B, page: 'articleB' }] },
    ],
    noResult: ['통화 녹음', '녹음', '텍스트 변환', '차단', '스팸', '쉬운 모드', '큰 글씨', '글씨', '방해 금지', '공유 앨범',
               'sagongsa', '010-0658-2741', '고향의 봄'],
  };
})();
