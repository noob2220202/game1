/* =========================================================
 * ep3 data · mail.js (owner: media) → G.STORY.mailAccount (mode:'in') · G.STORY.mails — engine/apps/mail.js.
 * DESIGN_EP3 §4.8.4 폴더 › 메일 (받은편지함 3통 · read-only · no compose / reply / forward · no trash · no
 * sync banner) · §5.2 📁 메일 · §5.6 (끈다: 동기화 배너 · 휴지통). Text only — no address, no unit number (§4.8.4).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.mailAccount = { mode: 'in', head: '받은편지함' };

  G.STORY.mails = [
    { id: 'church', from: '교회 소식', subj: '[교회 소식지] 2027년 1월호', date: '1월 2일',
      body: ['새해 첫 주일 예배 안내와 구역 모임 일정입니다. 추운 날씨에 건강 조심하세요.'] },
    { id: 'kitchen', from: '급식실 공지', subj: '겨울방학 중 조리실 소독·점검 일정', date: '2026년 12월 28일',
      body: ['방학 중 조리실 소독은 2월 둘째 주, 냉동고 점검은 1월 셋째 주입니다. 자세한 일정은 조리팀 단톡방에서 안내합니다.'] },
    { id: 'shop', from: '온라인 장터', subj: '[주문 확인] 콩이 간식 외 1건이 발송되었습니다', date: '2026년 11월 28일',
      body: ['주문하신 상품이 발송되었습니다.', '받는 분: 김현숙'] },
  ];
})();
