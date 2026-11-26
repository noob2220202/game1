/* =========================================================
 * ep2 data · clock.js (owner: media) — DESIGN §4.7.4 · §3.16 재료 · §4.7.1 알람 화면 · §3.20.1 cb.alarmDel.
 * Alarm DETAIL is a view-only screen: no preview button, no pencil / wheel / slider / output picker,
 * no reason text. The list offers only the on/off toggle and long-press → 삭제.
 * a0444 name: cb.alarmDel ? '또 지울 거야?' (his line #25, his:true) : '우리' (an alarm name — his:false).
 * a2310.ring = the cold-open ring screen (N04 visual) shown over the M0 eye view by G.clockApp.ring().
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const name0444 = (cb) => (cb('alarmDel') ? '또 지울 거야?' : '우리');

  G.STORY.alarms = {
    n: [
      { id: 'a0444', time: '오전 4:44', hm: '04:44', name: name0444, nameHis: (cb) => !!cb('alarmDel'), on: true, repeat: '반복 안 함',
        detail: [['알람 이름', name0444], ['반복 안 함', ''], ['알람 소리', '우리'], ['볼륨', '15%'],
                 ['소리 출력', '2층_스피커'], ['진동', '끔'], ['다시 울림', '끔']] },
      { id: 'a2310', time: '오후 11:10', hm: '23:10', name: '문 앞', on: false, repeat: '1회',
        detail: [['알람 이름', '문 앞'], ['1회', ''], ['알람 소리', '우리'], ['볼륨', '15%'], ['소리 출력', '이 휴대전화'], ['진동', '끔']],
        ring: { time: '오후 11:10', title: '문 앞', playing: '♪ 우리', slide: '해제 ›' } },
    ],
    dash: [
      { id: 'a0530', time: '오전 5:30', hm: '05:30', name: '', on: true, repeat: '매일 · 오늘 꺼짐',
        detail: [['알람 이름', '없음'], ['매일', ''], ['알람 소리', '기본'], ['오늘 알람 끔', '']] },
    ],
    title: '시계',
    tabs: [['alarm', '알람'], ['world', '세계 시각'], ['sw', '스톱워치'], ['timer', '타이머']],
    tabsEmpty: ['세계 시각', '스톱워치', '타이머'],
    deleteLabel: '삭제',
  };
})();
