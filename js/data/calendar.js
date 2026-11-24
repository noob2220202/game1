/* =========================================================
 * js/data/calendar.js — 캘린더 data (DESIGN §4.7).
 * event: {date:'YYYY-MM-DD', time, title, note, color, by, added, allDay}
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const UNK = '알 수 없는 기기';
  G.STORY.events = [
    { date: '2025-03-10', time: '14:00', title: '옷장 문 수리 (관리실 기사님)', note: '관리실에서 기사님 보내준다고 함. 옷장 문 열어두기', color: '#ff9f0a' },
    { date: '2025-03-17', allDay: true, title: '콩이 온 날 2주년 🐶', color: '#ff375f' },
    { date: '2025-05-14', time: '10:30', title: '음향학 실습 (방 IR 측정)', note: '박수 + 녹음기 챙기기', color: '#5e5ce6' },
    { date: '2025-08-30', allDay: true, title: '월세 💸', color: '#8e8e93' },
    { date: '2025-09-13', time: '19:00', title: '지민이랑 곱창', color: '#30d158' },
    { date: '2025-10-04', allDay: true, title: '추석 🎑 본가 (KTX 08:10)', color: '#30d158' },
    { date: '2025-10-20', time: '23:59', title: '졸작 주제 제출', note: '「들리지 않는 방」(가제)', color: '#5e5ce6' },
    { date: '2025-11-21', time: '14:00', title: '졸작 중간발표', note: 'B103 · 「들리지 않는 방」(가제)', color: '#5e5ce6' },
    { date: '2025-11-26', allDay: true, title: '엄마 생신 🎂', note: '케이크 예약하기!!', color: '#ff375f' },
    { date: '2025-12-20', allDay: true, title: '지민이랑 제주도 ✈️', color: '#30d158' },
    { date: '2026-03-10', allDay: true, title: '♥ 1주년', by: UNK, added: '2025.11.25 오전 4:12', color: '#ff2d55', creepy: true },
    { date: '2026-11-23', allDay: true, title: '{N} 입주', by: UNK, added: '2026.11.23 오후 11:41', color: '#ff2d55', creepy: true },
    { date: '2026-11-24', allDay: true, title: '1년', by: UNK, added: '2026.11.23 오후 11:42', color: '#ff2d55', creepy: true },
  ];
})();
