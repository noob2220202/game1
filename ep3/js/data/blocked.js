/* =========================================================
 * ep3/js/data/blocked.js — 번호 차단 data (comms · DESIGN_EP3 §3.8 · §3.16 · §3.19 · §4.3.6 · §4.12.5 · ARCH_EP3 §6.11).
 * G.STORY.blocked — read by ep3/js/apps/callrec.js (C6–C8a) and, through G.callrec.renderBlockedMsgs, by the 06:10 hook.
 *   calls    — the 13 dates, newest first (every row: `{fmtDate}  오전 3:31   010-0658-2741   광고 · 0초` — all with year)
 *   messages — the four blocked ads (C8 · hook cut) + the full text shown on tap (C8a ⊕)
 *   hook     — his only new line tonight (§3.19 — `!` 0 · `?` 1 · `ㅎ`/`ㅋ` 0 · `🙂` 0) — `his:true` (QA counts exactly 1)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.blocked = {
    calls: ['2026-12-24', '2026-11-24', '2026-10-24', '2026-09-24', '2026-08-24', '2026-07-24', '2026-06-24', '2026-05-24', '2026-04-24', '2026-03-24',
            '2026-02-24', '2026-01-24', '2025-12-24'],
    number: '010-0658-2741', hm: '03:31', tag: '광고 · 0초', reasonKey: '차단 사유', reason: '광고 (스팸 자동 차단)', spamSince: '2025.07.20',
    title: '번호 차단', callsTitle: '차단된 통화', msgsTitle: '차단된 메시지', mineHead: '직접 차단한 번호',
    block: { rows: [['add', '전화번호 추가'], ['unknown', '알 수 없는 번호 차단'], ['spam', '스팸 및 사기 의심 전화 차단'], ['calls', '차단된 통화'], ['msgs', '차단된 메시지']],
             none: '{$noBlocked}', spamOn: '사용 중' },
    spamTitle: '스팸 및 사기 의심 전화 차단',
    spamScreen: ['{$spamLong}', ['사용 시작', '2025.07.20']],
    pad: { title: '차단할 번호', ok: '차단' },
    msgTag: '(광고)',
    messages: [
      { id: 'm0119', d: '2027-01-19', number: '010-0927-4410', text: '[Web발신] (광고) 겨울 보약 특가 안내…', full: '[Web발신] (광고) 겨울 보약 특가 안내 — 한 달분 주문 시 한 달분 더.' },
      { id: 'm0107', d: '2027-01-07', number: '010-0384-1196', text: '[Web발신] (광고) 저금리 대환 대출…', full: '[Web발신] (광고) 저금리 대환 대출 — 한도 조회만 해 보세요.' },
      { id: 'm1230', d: '2026-12-30', number: '010-0715-6023', text: '[Web발신] (광고) 새해 운세 무료 확인…', full: '[Web발신] (광고) 새해 운세 무료 확인 — 올해 운세를 지금 확인하세요.' },
      { id: 'm1112', d: '2026-11-12', number: '010-0549-3307', text: '[Web발신] (광고) 김장 절임배추 예약…', full: '[Web발신] (광고) 김장 절임배추 예약 — 20kg 한 상자 특가.' },
    ],
    hook: { id: 'hook0610', d: '2027-01-24', hm: '06:10', label: '오전 6:10', number: '010-0658-2741', text: '다음 달엔 세아 학교에 가 볼게. 지민이도 오지?', his: true },
  };
})();
