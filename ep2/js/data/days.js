/* =========================================================
 * ep2 data · days.js (owner: media) — DESIGN §1.2.3 = bible §10.5 table, §9.6 ② verbatim.
 * G.STORY.days is the ONLY source of the power/location record: the 타임라인 rows, the
 * [마포구청] receive times (cbs.js) and the hotspot line in shell's data/security.js are all
 * derived from it (G.alerts.timeline / G.alerts.fmt12). Nothing here is hand-written per screen.
 *   on    = power-on of the PREVIOUS night (12-11.on = 12-10 22:41)
 *   pause = [start, end] of 'location history paused' that morning · mapo = [마포구청] receive (HH:MM)
 *   off   = power-off that morning · 12-24.later = the evening of today (18:00 on → pause → 22:30 here)
 * Also: G.STORY.tlUI — the timeline app's fixed screen strings (DESIGN §4.6.10 / §5.5 / §1.2.3).
 * No code runs at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.days = {
    '12-11': { dow: '금', on: '22:41', pause: ['05:38', '07:12'], mapo: '06:04', off: '07:16' },   // on = 12-10 22:41 (처음 방문)
    '12-12': { dow: '토', on: '22:07', pause: ['05:41', '07:09'], mapo: null,    off: '07:13' },
    '12-13': { dow: '일', on: '22:52', pause: ['05:40', '07:14'], mapo: '06:22', off: '07:18' },
    '12-14': { dow: '월', on: '22:19', pause: ['05:36', '07:08'], mapo: null,    off: '07:11' },
    '12-15': { dow: '화', on: '22:33', pause: ['05:42', '07:11'], mapo: '06:11', off: '07:15' },
    '12-16': { dow: '수', on: '22:26', pause: ['05:39', '07:10'], mapo: null,    off: '07:14' },
    '12-17': { dow: '목', on: '22:48', pause: ['05:40', '07:13'], mapo: '06:37', off: '07:17' },
    '12-18': { dow: '금', on: '22:14', pause: ['05:37', '07:07'], mapo: null,    off: '07:12' },
    '12-19': { dow: '토', on: '22:39', pause: ['05:41', '07:12'], mapo: '06:00', off: '07:16' },
    '12-20': { dow: '일', on: '22:05', pause: ['05:40', '07:10'], mapo: null,    off: '07:13' },
    '12-21': { dow: '월', on: '22:57', pause: ['05:43', '07:15'], mapo: '06:29', off: '07:19' },
    '12-22': { dow: '화', on: '22:21', pause: ['05:38', '07:09'], mapo: null,    off: '07:12' },
    '12-23': { dow: '수', on: '22:44', pause: ['05:40', '07:11'], mapo: '06:15', off: '07:15' },
    '12-24': { dow: '목', on: '22:30', pause: ['05:39', '07:10'], mapo: null,    off: '07:14',
               later: [['18:00', 'on'], ['18:00', '22:30', 'pause'], ['22:30', null, 'here']] },   // 18:01 웹 세션 로그아웃 · 18:02 계정 삭제 · 22:55 상자
  };

  /* Timeline screen strings (DESIGN §4.6.10 · §5.5 · §1.2.3 render rule) */
  G.STORY.tlUI = {
    title: '타임라인',
    sub: '이 기기의 위치 기록',
    month: '2026년 12월',
    monthPrev: '2026년 11월',
    monthEmpty: '이 달에는 기록이 없습니다',
    dayEmpty: '{$tlNone}',              // 이 날짜에는 기록이 없습니다
    paused: '{$tlPaused}',              // 이 시간에는 위치 기록이 일시 중지되었습니다
    place: '새말동',
    placeFirst: '새말동 · 처음 방문한 곳',
    placeCard: '새말동 · 처음 방문 2026.12.10',
    pauseLabel: '위치 기록 일시 중지됨',
    offLabel: '기기 꺼짐',
    onLabel: '기기 켜짐',
    noneLabel: '기록 없음',
    now: '지금',
    menu: ['설정'],
    week: ['일', '월', '화', '수', '목', '금', '토'],
  };

  /* QA snapshot of the bible §10.5 table (§9.6 ② self-check ⑤): 'MM-DD on pause0-pause1 mapo off' */
  G.STORY.daysSnapshot = [
    '12-11 22:41 05:38-07:12 06:04 07:16', '12-12 22:07 05:41-07:09 - 07:13', '12-13 22:52 05:40-07:14 06:22 07:18',
    '12-14 22:19 05:36-07:08 - 07:11', '12-15 22:33 05:42-07:11 06:11 07:15', '12-16 22:26 05:39-07:10 - 07:14',
    '12-17 22:48 05:40-07:13 06:37 07:17', '12-18 22:14 05:37-07:07 - 07:12', '12-19 22:39 05:41-07:12 06:00 07:16',
    '12-20 22:05 05:40-07:10 - 07:13', '12-21 22:57 05:43-07:15 06:29 07:19', '12-22 22:21 05:38-07:09 - 07:12',
    '12-23 22:44 05:40-07:11 06:15 07:15', '12-24 22:30 05:39-07:10 - 07:14',
  ];
})();
