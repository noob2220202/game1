/* =========================================================
 * js/data/phone.js — 전화 data (DESIGN §4.4). No SIM: every call fails.
 * contacts: [{id, name, number, memo, rows:[[k,v]], created, edited, by, show(), onOpen()}]
 * calls:    [{name|number, t, type:'out'|'in'|'missed', dur, note}]
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const last4 = () => String((window.CONFIG && window.CONFIG.HARU_LAST4) || '0404').replace(/\D/g, '').slice(-4).padStart(4, '0');

  G.STORY.contacts = [
    { id: 'mom', name: '엄마 ♥', number: '010-0718-2215', fav: true, avatar: { emoji: '🌷', bg: 'linear-gradient(160deg,#ffd6e0,#f7a1b5)' }, talk: 'mom' },
    { id: 'jimin', name: '지민', number: '010-0412-8830', fav: true, avatar: { initial: '지', bg: 'linear-gradient(160deg,#a8d8c8,#4ea38a)' }, talk: 'jimin', memo: '베프 · 생일 4/12 🎂' },
    {
      id: 'manager', name: '관리실', number: '010-8817-3302', avatar: { emoji: '🏢', bg: 'linear-gradient(160deg,#5b7aa6,#2d4466)' }, talk: 'manager',
      memo: '해솔빌 관리사무소',
      created: '2024.08.31 오후 2:12 · 이 기기',
      edited: '2025.11.25 오전 4:10 · 다른 기기',
      exposes: true,
    },
    {
      id: 'haru', name: '{N}', number: () => '010-0835-' + last4(), avatar: { silhouette: true, bg: '#c5ced8' },
      memo: '새로 이사 온 사람',
      created: '2026.11.23 오후 11:41 · 다른 기기',
      talk: 'haru',
    },
    { id: 'vet', name: '해솔동물병원', number: '02-0000-2580', avatar: { emoji: '🐾', bg: 'linear-gradient(160deg,#ffe3a3,#e0a52b)' }, memo: '콩이 주치의 김 선생님' },
    { id: 'dept', name: '한빛예대 음향디자인과 사무실', number: '02-0000-1004', avatar: { emoji: '🎧', bg: 'linear-gradient(160deg,#c6c9ff,#6a6fd8)' } },
  ];

  G.STORY.calls = [
    { name: '엄마 ♥', number: '010-0718-2215', t: '2025-11-24 03:31', type: 'out', note: '응답 없음' },
    { name: '지민', number: '010-0412-8830', t: '2025-11-20 03:41', type: 'out', dur: '0:42' },
    { name: '엄마 ♥', number: '010-0718-2215', t: '2025-11-10 20:14', type: 'in', dur: '12:03' },
    { name: '엄마 ♥', number: '010-0718-2215', t: '2025-11-03 21:30', type: 'out', dur: '8:40' },
    { number: '010-0231-7745', t: '2025-10-28 13:16', type: 'in', dur: '0:21', label: '택배 기사' },
    { name: '지민', number: '010-0412-8830', t: '2025-10-21 22:05', type: 'in', dur: '1:12:08' },
    { name: '엄마 ♥', number: '010-0718-2215', t: '2025-10-14 08:40', type: 'missed' },
    { name: '해솔동물병원', number: '02-0000-2580', t: '2025-09-27 14:10', type: 'out', dur: '2:31' },
    { name: '엄마 ♥', number: '010-0718-2215', t: '2025-09-14 19:40', type: 'in', dur: '6:12' },
    { number: '010-8817-3302', t: '2025-03-10 13:52', type: 'in', dur: '0:38' },
  ];
})();
