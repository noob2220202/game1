/* =========================================================
 * ep3/js/data/easy.js — module ① easymode data (shell · ARCH_EP3 §6.7 · DESIGN_EP3 §9.6 ① · §3.3 · §4.2 · §4.3.1 · §4.4.4 ·
 * §4.7.2 · §5.4 E1–E10). → G.STORY.easy. Read by ep3/js/apps/easymode.js (and engine/apps/lock.js for the plain fallback).
 * Strings = DESIGN text verbatim (⊕ lines included); {$key} tokens expand through G.T (G.e3.STR). No code runs at load.
 * ========================================================= */
window.G = window.G || {};
(function (G) {
  'use strict';
  G.STORY = G.STORY || {};
  G.STORY.easy = {
    /* E2 쉬운 홈 — 2열 3행 (§3.3 · §4.2.2 · §0.1 #9) */
    home: [['phone', '전화'], ['talk', '톡'], ['camera', '카메라'], ['gallery', '사진'], ['moim', '모임'], ['settings', '설정']],
    recentDays: 30,                                           // E3 최근 기록 = 최근 30일 (2026-12-25 강수진 형사님 … 1월 23일 지민이) — 끝 문구 0
    contacts: ['sea', 'jimin', 'kang', 'kwon', 'butcher', 'ricecake', 'churchOffice', 'kitchenChief', 'vet', 'office'],   // §3.3 순서
    /* E6 '스위치만 있는 화면' (§3.3 표 원문) */
    gates: {
      rec:  { title: '통화 자동 녹음', sw: '켜짐', swOff: '꺼짐', desc: '{$recAuto}', rows: [['녹음할 통화', '모든 통화']] },
      spam: { title: '스팸 및 사기 의심 전화 차단', sw: '사용 중', swOff: '사용 안 함', desc: '{$spamShort}' },
    },
    /* E7 디스플레이 › 쉬운 모드 · 디스플레이 · 글자 크기와 스타일 · 화면 확대 (§3.3 · §4.7.2) */
    display: {
      title: '쉬운 모드', sw: '사용 중', swOff: '사용 안 함', desc: '{$easyDesc}', longPress: ['길게 누르기 지연 시간', '길게 (1.5초)'],
      longPressOptions: ['짧게 (0.5초)', '보통 (1초)', '길게 (1.5초)'],
      screen: '디스플레이',
      rows: { theme: ['라이트 / 다크', '라이트'], brightness: '밝기', font: '글자 크기와 스타일', zoom: '화면 확대', easy: '쉬운 모드', timeout: ['화면 자동 꺼짐', '1분'] },
      font: { title: '글자 크기와 스타일', preview: '가나다라마바사 Aa 123', size: '글자 크기', steps: 8, now: 6, bold: '글자 굵게', face: ['글꼴', '기본'], easyLink: '쉬운 모드' },
      zoom: { title: '화면 확대', preview: '가나다라마바사 Aa 123', small: '작게', big: '크게' },
    },
    /* E1 쉬운 잠금화면 (§3.1 · §4.2.1) */
    lock: { date: '1월 24일 일요일', swipe: '{$swipeOpen}', emergency: '{$emergency}' },
    /* E9 쉬운 착신 화면 (§4.1.3 · §5.4 E9) */
    ring: { name: '세아 💛', kind: '보이스톡', avatar: 'avatar_sea', decline: '거절', accept: '받기', ended: '통화 종료 · 0:33', callBtns: ['스피커', '음소거', '종료'] },
    /* E3 쉬운 전화 (§3.3 · §4.3.1) */
    phone: { title: '전화', tabs: [['pad', '키패드'], ['recent', '최근 기록'], ['contacts', '연락처']], call: '전화', del: '⌫',
      detail: ['전화', '문자'] },
    sheet: ['전화 걸기', '문자 보내기'],
    noChat: '{$noChat}',
  };
})(window.G);
