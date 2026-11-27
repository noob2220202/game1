/* =========================================================
 * ep3 data · moim.js (owner: media) → G.STORY.browserApps · G.STORY.moim — read by engine/apps/browser.js.
 * DESIGN_EP3 §4.8.2 모임 (static church feed — no compose, no member list, no comment input, no church name) ·
 * §4.8.4 폴더 `내 파일` · `날씨` (static — lead approval R16 · §12.5-2) · §5.0-1 (browser appMode, not a module) ·
 * §5.2 · §0.3 D45 (내 파일 = category rows only — no counts, no sizes, rows do not react).
 * engine/apps/browser.js registers one app per G.STORY.browserApps entry (ids moim · files · weather — ARCH §5.2).
 * {daejeon} = G.STORY.names.daejeon (core) — the literal stays in config.ep3.js only (ARCH G48).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.browserApps = {
    moim: { name: '모임', icon: 'moim', appMode: 'moim' },
    files: { name: '내 파일', icon: 'files', appMode: 'files',
             page: { head: '내 파일', empty: '최근 파일 없음', rows: ['이미지', '동영상', '오디오', '문서', '다운로드'] } },
    weather: { name: '날씨', icon: 'weather', appMode: 'weather',
               page: { place: '{daejeon}', now: '맑음 −6°',
                       hours: [['오전 4시', '−6°'], ['오전 5시', '−7°'], ['오전 6시', '−7°'], ['오전 7시', '−7°'], ['오전 8시', '−5°']],
                       sunrise: '일출  오전 7:36' } },
  };

  G.STORY.moim = {
    title: '모임',
    group: '3구역 기도 모임 · 멤버 14',
    like: '♡', comment: '댓글',                                   // `♡ 14 · 댓글 6`
    posts: [
      { id: 'p0123', by: '김현숙', when: '2027.1.23 오후 7:50',
        text: '내일이 우리 딸 생일이에요. 세아 친구 둘이 왔어요. 기도 부탁드려요.', likes: 14,
        comments: [['박정자', '집사님 힘내세요. 기도할게요'], ['이순례', '세아 꼭 돌아올 거예요'], ['최영희', '친구들이 와서 다행이에요'],
                   ['한미숙', '내일 미역국 맛있게 드세요'], ['정순자', '기도합니다🙏'], ['윤옥분', '집사님 손 꼭 잡아요']] },
      { id: 'p0103', by: '모임', when: '2027.1.3', title: '새해 기도 제목',
        text: '김현숙 집사님: 딸 세아 자매가 무사히 집에 돌아오기를.' },
      { id: 'p1227', by: '모임', when: '2026.12.27', title: '성탄 예배', img: 'p3_church' },
      { id: 'p2601', by: '김현숙', when: '2026.1.23',
        text: '내일이 우리 딸 생일이에요. 미역국 끓여 놓고 기다리려고요.', likes: 21,
        comments: [['박정자', '세아 생일 축하해요. 집사님 기도할게요'], ['이순례', '미역국 냄새 여기까지 나요'], ['최영희', '꼭 돌아올 거예요'],
                   ['한미숙', '힘내세요 집사님'], ['정순자', '기도합니다🙏'], ['윤옥분', '세아야 생일 축하해'],
                   ['김말순', '집사님 혼자 있지 마세요'], ['조은희', '저도 기도할게요'], ['박정자', '내일 예배 끝나고 들를게요']] },
    ],
  };
})();
