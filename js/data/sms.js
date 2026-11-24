/* =========================================================
 * js/data/sms.js — 메시지 (SMS) data (DESIGN §4.7). SIM 없음 → read-only.
 * Threads display the contact name when the number matches a contact
 * (the 2025 repair SMS came from 010-8817-3302 = today's '관리실' contact).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.sms = [
    {
      id: 'repair', name: '관리실', number: '010-8817-3302',
      messages: [
        { from: 'them', t: '2025-03-08 10:02', text: '[해솔빌] 붙박이장 수리 기사 방문 3/10(월) 14시 예정' },
        { from: 'them', t: '2025-03-10 13:55', text: '[해솔빌] 기사님 곧 도착 예정입니다. 404호 옷장 문 열어두세요.' },
      ],
    },
    {
      id: 'parcel', name: '모아택배', number: '1600-0000',
      messages: [
        { from: 'them', t: '2025-10-28 13:18', text: '[Web발신]\n[모아택배] 고객님의 택배가 도착했습니다.\n보관 장소: 문 앞 (해솔빌 404호)\n상품: 문틈 막이 바람막이 2m 외 1건' },
      ],
    },
    {
      id: 'school', name: '한빛예대', number: '02-0000-1004',
      messages: [
        { from: 'them', t: '2025-02-10 10:00', text: '[Web발신]\n[한빛예대] 2025-1학기 수강신청 기간 안내 (2/11~2/13). 학사 포털에서 확인하세요.' },
        { from: 'them', t: '2025-08-11 10:00', text: '[Web발신]\n[한빛예대] 2025-2학기 수강신청 기간 안내 (8/12~8/14). 4학년은 졸업작품 과목을 반드시 신청하세요.' },
      ],
    },
    {
      id: 'vet', name: '해솔동물병원', number: '02-0000-2580',
      messages: [
        { from: 'them', t: '2025-06-20 11:30', text: '[Web발신]\n[해솔동물병원] 콩이 보호자님, 종합백신 추가 접종일(6/27)이 다가왔어요 🐶' },
      ],
    },
  ];
})();
