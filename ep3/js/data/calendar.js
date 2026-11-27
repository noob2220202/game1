/* =========================================================
 * ep3 data · calendar.js (owner: media) → G.STORY.events (v:3) — read by engine/apps/calendar.js (v3 branch).
 * DESIGN_EP3 §3.20.2 캘린더 · §4.8.1 (strings verbatim) · §12.2 V28 (no '만든 날' / 수정일 / 알림 / 추가한 기기 rows).
 * Month view 2024-11 → 2027-03 (today 2027-01-24 circled · dots on days with events · agenda of the picked day,
 * else {$noEvent}). Repeats: yearly 'MM-DD' · weekly 0–6 (0 = 일) · from/to span. Detail = title / date · time /
 * (반복 · 메모 rows only). id 1126's detail sets calCake (§3.18 ★S3-6 · seen.e3_cake). 2월 이후 단발 일정 0.
 * scr = the show table key (§5.8 · ARCH §6.8 'calendar.event.1126' · 'calendar.event.0124'); others 'calendar.event'.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.events = {
    v: 3,
    title: '캘린더',
    range: ['2024-11', '2027-03'], today: '2027-01-24',
    week: ['일', '월', '화', '수', '목', '금', '토'],
    labels: { allDay: '하루 종일', repeat: '반복', yearly: '매년', weekly: '매주', memo: '메모' },
    items: [
      { id: '0124', yearly: '01-24', title: '우리 딸 생일 🎂', scr: 'calendar.event.0124' },
      { id: '0317', yearly: '03-17', title: '콩이 온 날' },
      { id: '1126', day: '2025-11-26', title: '내 생일 🎂', memo: '세아가 케이크 사 온대', scr: 'calendar.event.1126', flag: 'calCake' },
      { id: 'kang', day: '2026-12-26', hm: '14:00', title: '강 형사님 오심' },
      { id: 'guests', day: '2027-01-23', hm: '18:30', title: '지민이랑 {N} 씨 옴 🍲' },
      { id: 'sunday', weekly: 0, hm: '11:00', title: '주일 예배' },
      { id: 'break', from: '2026-12-31', to: '2027-03-01', span: '2026.12.31 – 2027.3.1', title: '방학 (급식 없음)' },
    ],
    empty: '{$noEvent}',
  };
})();
