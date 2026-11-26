/* =========================================================
 * ep2 data · phone.js (owner: media, ADDED by ARCH) — DESIGN §4.7.2 · §4.7.1 · §4.0 실패 문구.
 * No SIM: any number → G.e2.STR.noSimCall · 112 / 119 / 1366 → G.e2.STR.noSimEmergency.
 * The lock-screen [긴급 통화] dialer (hook 'phone:emergency') uses emergencyTitle.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.dial = {
    title: '전화',
    status: 'SIM 없음',
    tabs: [['keypad', '키패드'], ['recent', '최근 기록'], ['contacts', '연락처']],
    recentsEmpty: '최근 기록 없음',
    contactsEmpty: ['연락처 없음', '계정이 없습니다'],
    emergencyTitle: '긴급 통화',
    emergencyNumbers: ['112', '119', '1366'],
  };
})();
