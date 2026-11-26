/* =========================================================
 * ep2 data · calendar.js (owner: media) — DESIGN §4.7.3 · §3.21 캘린더 · §0.2 T17 · §4.8 N05.
 * The account was deleted at 18:02, so these are the copies left on this device (grey band).
 * notif0000 is raised by flow's director at 00:00 (B07): G.phone.notify(G.STORY.events.notif0000).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.events = {
    title: '캘린더',
    banner: '계정 없음 · 동기화되지 않은 일정이 표시됩니다',
    month: '2026년 12월', year: 2026, mon: 12, dots: [10, 24, 25],
    week: ['일', '월', '화', '수', '목', '금', '토'],
    items: [
      { id: 'move', day: '2026-12-10', title: '이사', when: '12월 10일 (목) · 하루 종일', rows: [['캘린더', '다온 캘린더'], ['마지막 동기화 2026.12.24 오후 6:02', '']] },
      { id: 'eve', day: '2026-12-24', title: '크리스마스 이브', when: '12월 24일 (목) · 하루 종일', rows: [['대한민국 기념일', '']] },
      { id: 'xmas', day: '2026-12-25', title: '크리스마스', when: '12월 25일 (금) · 하루 종일', rows: [['공휴일', ''], ['알림 오전 12:00', '']] },
    ],
    notif0000: { id: 'N05', app: 'calendar', title: '크리스마스', body: '하루 종일', when: '오전 12:00', route: { app: 'calendar', params: { day: '2026-12-25' } } },
  };
})();
