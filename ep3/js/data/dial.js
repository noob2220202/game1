/* =========================================================
 * ep3/js/data/dial.js — 전화 data (comms · DESIGN_EP3 §3.2.3 · §3.8 · §3.20.2 · §4.3.1 · §4.3.2 · §4.3.7 · ARCH_EP3 §6.9).
 * Readers: engine/apps/phone.js (sim branch: G.STORY.dial.sim === true) · shell easymode E3/E4 through G.phoneApp.contacts() /
 * recents({days}) (never this object directly for results — every call goes through G.phoneApp.dial).
 *   contacts — the ten, in the easy-card order (§3.3) · number only for 세아 💛 · 지민이 (§4.3.2 번호 표시 규칙 · §0.3 D21)
 *   order    — 표준 연락처 가나다순 (§4.3.2 ⊕)
 *   recents  — fixed rows (newest first not required — the renderer sorts) · `rec` = recording id (🎙 · 녹음 1 ›) ·
 *              `row` = stable data-row (03:31 — the show test and missedSeen read it)
 *   seed     — the ordinary filler months (§4.3.2: 2–4 a month incl. fixed rows · 08:00–21:30 · 0:20–9:00 · seed 0x3e3)
 *   results  — §3.2.3 / §4.3.7 (first matching row wins; flags read live) · powerOff = ep1 powerOffCall order (§12.2 V42)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.dial = {
    sim: true,
    tabs: [['pad', '키패드'], ['recent', '최근 기록'], ['contacts', '연락처']],
    menu: ['설정', '통화 녹음', '번호 차단'],
    contacts: [
      { id: 'sea', name: '세아 💛', number: '010-0592-1163', avatar: 'avatar_sea', fav: true, log: 'sea' },
      { id: 'jimin', name: '지민이', number: '010-0412-8830', avatar: 'avatar_jimin', fav: true },
      { id: 'kang', name: '강수진 형사님', label: '휴대전화', sms: 'kang' },
      { id: 'kwon', name: '박 권사님', label: '휴대전화' },
      { id: 'butcher', name: '정육점 사장님', label: '휴대전화' },
      { id: 'ricecake', name: '시장 떡집', label: '휴대전화' },
      { id: 'churchOffice', name: '교회 사무실', label: '일반 전화' },
      { id: 'kitchenChief', name: '급식실 실장님', label: '휴대전화' },
      { id: 'vet', name: '동물병원', label: '휴대전화' },
      { id: 'office', name: '관리사무소', label: '일반 전화' },
    ],
    order: ['kang', 'office', 'churchOffice', 'kitchenChief', 'vet', 'kwon', 'sea', 'ricecake', 'butcher', 'jimin'],
    contactsHead: '연락처 {n}', favHead: '즐겨찾기', logRow: '통화 기록', recRow: '녹음 {n}',
    detailBtns: ['전화', '문자'],
    searchPh: '검색',
    recents: [
      // the last 30 days (§4.3.1 — the easy list is exactly these rows)
      { d: '2027-01-23', hm: '17:42', who: 'jimin', dir: 'in', sec: 62, rec: 'jimin0123' },
      { d: '2027-01-23', hm: '10:30', who: 'butcher', dir: 'out', sec: 41, rec: 'butcher0123' },
      { d: '2027-01-21', hm: '19:20', who: 'kwon', dir: 'in', sec: 200, rec: 'kwon0121' },
      { d: '2027-01-10', hm: '14:05', who: 'jimin', dir: 'out', sec: 251, rec: 'jimin0110' },
      { d: '2027-01-05', hm: '18:10', who: 'vet', dir: 'out', noAnswer: true },
      { d: '2026-12-28', hm: '11:02', who: 'churchOffice', dir: 'in', sec: 90, rec: 'church1228' },
      { d: '2026-12-27', hm: '15:15', who: 'ricecake', dir: 'out', sec: 52, rec: 'ricecake1227' },
      { d: '2026-12-25', hm: '10:20', who: 'kang', dir: 'in', sec: 372 },
      // older (§4.3.2 ⊕ fixed rows)
      { d: '2026-12-14', hm: '16:30', who: 'jimin', dir: 'in', sec: 760 },
      { d: '2026-12-03', hm: '19:02', who: 'kitchenChief', dir: 'in', sec: 125 },
      { d: '2026-11-26', hm: '20:10', who: 'jimin', dir: 'in', sec: 542 },
      { d: '2026-11-24', hm: '09:12', who: 'jimin', dir: 'in', sec: 890 },
      { d: '2026-10-07', hm: '17:40', who: 'vet', dir: 'in', sec: 72 },
      { d: '2026-09-24', hm: '21:15', who: 'jimin', dir: 'out', sec: 210 },
      { d: '2026-08-18', hm: '10:02', who: 'jimin', dir: 'in', sec: 301 },
      { d: '2026-07-03', hm: '16:20', who: 'churchOffice', dir: 'in', sec: 120 },
      { d: '2026-05-08', hm: '16:25', who: 'jimin', dir: 'out', sec: 453 },
      { d: '2026-02-16', hm: '20:00', who: 'jimin', dir: 'in', sec: 368 },
      { d: '2026-01-24', hm: '07:30', who: 'jimin', dir: 'in', sec: 190 },
      { d: '2025-12-01', hm: '14:30', who: 'vet', dir: 'out', sec: 122 },
      { d: '2025-11-25', hm: '10:05', who: 'jimin', dir: 'out', sec: 160 },
      // 세아 💛 (= e1canon.seaCalls — §3.8 · §4.3.2)
      { d: '2025-11-24', hm: '08:02', who: 'sea', dir: 'out', sec: 0 },
      { d: '2025-11-24', hm: '07:15', who: 'sea', dir: 'out', sec: 0 },
      { d: '2025-11-24', hm: '07:13', who: 'sea', dir: 'out', sec: 0 },
      { d: '2025-11-24', hm: '03:31', who: 'sea', dir: 'missed', row: 'sea-20251124-0331' },
      { d: '2025-11-10', hm: '20:14', who: 'sea', dir: 'out', sec: 723 },
      { d: '2025-11-03', hm: '21:30', who: 'sea', dir: 'in', sec: 520 },
      { d: '2025-10-14', hm: '08:40', who: 'sea', dir: 'out', noAnswer: true },
      { d: '2025-09-14', hm: '19:40', who: 'sea', dir: 'out', sec: 372 },
    ],
    seed: { from: '2025-09-15', to: '2026-12-24', perMonth: [2, 4], hm: ['08:00', '21:30'], sec: [20, 540], rng: 0x3e3,
            names: ['churchOffice', 'kitchenChief', 'vet', 'jimin', 'kwon', 'ricecake', 'butcher', 'office'] },
    recentLabel: { in: '수신', out: '발신', missed: '부재중', noAnswer: '응답 없음' },
    emergencyTitle: '{$emergency}',
    results: {
      '112': { name: '112 · 긴급 통화', kind: 'emergency', rows: [
        { when: '!bip', card: '상황실 경찰관이 사건 번호를 확인한다. 담당 형사에게 바로 넘기겠다고 한다.', sec: 41 },
        { when: 'bip&!jimin112', card: '상황실 경찰관이 주소를 확인한다. 지구대를 바로 보내겠다고 한다. 문은 열지 말라고 한다.', sec: 40, flag: 'call112First' },
        { when: 'jimin112&!patrol', card: '같은 주소로 방금 신고가 들어왔다고 한다. 같은 출동으로 합친다고 한다. 문은 열지 말라고 한다.', sec: 38 },
        { when: 'patrol', card: '지구대가 복도와 계단을 다녀갔다고 한다. 담당 형사에게도 전달됐다고 한다.', sec: 35 } ] },
      '119': { name: '119 · 긴급 통화', kind: 'emergency', rows: [{ card: '구급이나 화재가 아니면 112로 연결해 드린다고 한다.', connect: true }] },
      '1366': { name: '1366', kind: 'cell', rows: [{ card: '상담원이 받는다. 지금 위험하면 112로 신고하라고 한다. 아침에 다시 걸어도 된다고 한다.', connect: true }] },
      sea: 'powerOff', '010-0592-1163': 'powerOff', '010-0658-2741': 'powerOff',
      kang: { rows: [{ ringSec: 30, status: '응답 없음', noAnswer: true, then: { sms: 'kcall', afterMs: 60000, once: true } }] },
      jimin: { rows: [
        { when: '!bip', card: '신호가 간다. 받지 않는다. 소파 쪽은 조용하다.', noAnswer: true },
        { when: 'bip', card: '지민이 휴대전화 화면을 보고 고개를 든다.', who: '지민', say: '저 여기 있어요.', noAnswer: true } ] },
      office: { rows: [
        { when: '!bip', card: '신호가 간다. 받지 않는다.', noAnswer: true },
        { when: 'bip', say: '경비실입니다.', card: '공동현관 카메라는 아침에 소장님이 같이 보신대요.', connect: true } ] },
      other: { rows: [{ card: '신호가 간다. 받지 않는다.', noAnswer: true }] },
    },
    powerOff: ['{$connFail}', '{$powerOff}', { beepHz: 1000, beepS: 0.5 }, '{$callEnd}'],   // ep1 powerOffCall order · no voice
  };
})();
