/* =========================================================
 * ep3 data · clock.js (owner: media) → G.STORY.alarms (v:3) — read by engine/apps/clock.js.
 * DESIGN_EP3 §3.20.2 시계 · §4.8.3 (알람 `오전 6:30 · 월–금 · 꺼짐` — 방학 · no '다른 기기가 관리' text) ·
 * §5.2 시계 row · §5.6 (끈다: 알람 울림 화면 · '다른 기기가 관리하는 알람') · §5.0-3 (no long-press delete).
 * The toggle really moves (vars.md.alarmOn) but nothing rings tonight (Sunday) — progress 0.
 * world = the single `세계 시각` row (`서울` — the in-game clock).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.alarms = {
    v: 3,
    title: '시계',
    n: [ { id: 'a0630', time: '오전 6:30', hm: '06:30', repeat: '월–금', on: false, detail: [['반복', '월–금']] } ],
    tabs: [['alarm', '알람'], ['world', '세계 시각'], ['sw', '스톱워치'], ['timer', '타이머']],
    world: '서울',
  };
})();
