/* =========================================================
 * ep2 data · recordings.js (owner: media) — DESIGN §4.7.8 · §3.16 · §0.2 D5 · §0.1 #11.
 * {N}'s recorder holds exactly one file, 우리 (ep1 B17 wind-down, recorded 2026-11-24 04:22 on this
 * phone; renamed 2026-12-21 23:52). 🔁 starts ON (he left it on at the 22:41 speaker test).
 * buffer = G.audio.buffer id; subsPhone = in-player subtitles when the output is 이 휴대전화 (S27).
 * Bluetooth output → no in-player subtitles (climax shows S09).
 * '—' has no recorder app (home 5). No delete / rename anywhere (§4.7.8).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.recordings = {
    title: '녹음',
    n: [
      { id: 'uri', title: '우리', dur: 31, line: '2026.11.24 오전 4:22', buffer: 'rec.uri', loopDefault: true,
        info: [['파일 이름', '우리'], ['길이', '0:31'], ['녹음', '2026.11.24 오전 4:22'], ['이름 변경', '2026.12.21 오후 11:52'], ['위치 정보 없음', '']],
        subsPhone: [{ t0: 0, t1: 27, text: '♪ (오르골)' }, { t0: 27, t1: 31, text: '[딸깍 딸깍]' }] },
    ],
    dash: [],
    infoTitle: '정보',
    outPhone: '출력: 이 휴대전화',
    outBt: '출력: 2층_스피커',
  };
})();
