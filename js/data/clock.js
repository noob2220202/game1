/* =========================================================
 * js/data/clock.js — 시계 › 알람 (DESIGN §4.7).
 * 04:44 · {N} is managed by another device: can't toggle/delete until END.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.alarms = [
    { id: 'a0444', h: 4, m: 44, label: '{N}', on: true, repeat: '1회 · 11월 24일 (화)', managed: '이 알람은 다른 기기에서 관리됩니다' },
    { id: 'a0700', h: 7, m: 0, label: '콩이 산책', on: false, repeat: '매일' },
    { id: 'a0820', h: 8, m: 20, label: '1교시 ㅠ', on: false, repeat: '월, 수' },
  ];
})();
