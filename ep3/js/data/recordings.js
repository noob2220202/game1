/* =========================================================
 * ep3/js/data/recordings.js — 통화 녹음 data (comms · DESIGN_EP3 §3.6 · §3.7 · §4.3.4 · §4.3.5 · §9.6 ② · ARCH_EP3 §6.10).
 * G.STORY.recordings = [rec…] newest first — the C3 list, the C4 player, the C5 transcript (to the letter).
 *   rec = { id, who, kind:'talk'|'cell', dir:'in'|'out', d:'YYYY-MM-DD', hm:'HH:MM', dur (s), buffer (G.audio.buffer id),
 *           sub (player subtitle line — DESIGN 원문/⊕), detail? (세부 정보 rows — computed for plain ones), lines:[…] }
 *   line = { t (s), sp:'me'|'them'|null, text, low:true (whole line grey) | lowWord:'…' (the one grey word), end:true }
 * Speakers render '나' (me) / rec.who (them). `{N야}` is a G.T token (받침 → '○○아'). The grey colour is #9aa0a6.
 * G.STORY.callrecUI = every fixed callrec screen string (C1–C11).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.recordings = [
    { id: 'sea0333', who: '세아 💛', kind: 'talk', dir: 'in', d: '2027-01-24', hm: '03:33', dur: 33, buffer: 'rec.sea0333', title: '세아 💛 · 보이스톡',
      sub: '오늘 오전 3:33 · 0:33 · 톡 보이스톡', textHead: '세아 💛 · 보이스톡 · 0:33',
      detail: [['통화 상대', '세아 💛 (톡 보이스톡 · 수신)'], ['녹음 일시', '2027.01.24 (일) 오전 3:33:06'], ['길이', '0:33'], ['녹음 방식', '자동 녹음'], ['저장 위치', '이 휴대전화']],
      hum: [[8.6, 15.4], [22.6, 30.9]],
      lines: [
        { t: 1, sp: 'me', text: '여보세요?' }, { t: 3, sp: 'me', text: '…세아야?' }, { t: 5, sp: 'me', text: '세아야, 엄마야.' },
        { t: 8, sp: 'them', text: '[허밍]' }, { t: 16, sp: 'them', text: '[숨소리]' }, { t: 21, sp: 'them', text: '{N야}', low: true },
        { t: 22, sp: 'them', text: '[허밍]' }, { t: 30, sp: 'them', text: '[알 수 없음]', low: true }, { t: 31, sp: 'them', text: '[숨소리]' },
        { t: 33, sp: null, text: '통화 종료', end: true } ] },
    { id: 'jimin0123', who: '지민이', kind: 'cell', dir: 'in', d: '2027-01-23', hm: '17:42', dur: 62, buffer: 'rec.plain.jimin0123',
      lines: [
        { t: 0, sp: 'them', text: '어머님, 저희 방금 대전역 내렸어요.' }, { t: 4, sp: 'me', text: '추운데 택시 타고 와.' },
        { t: 7, sp: 'them', text: '네. {N} 씨랑 같이 가요.' }, { t: 11, sp: 'me', text: '미역국 데워 놓을게.', lowWord: '데워' },
        { t: 14, sp: 'them', text: '금방 가요.' }, { t: 18, sp: 'me', text: '길 막히면 천천히 와.' },
        { t: 22, sp: 'them', text: '네, 어머님. 택시 줄이 좀 길어요.' }, { t: 58, sp: 'them', text: '네, 이따 봬요.' },
        { t: 62, sp: null, text: '통화 종료', end: true } ] },
    { id: 'butcher0123', who: '정육점 사장님', kind: 'cell', dir: 'out', d: '2027-01-23', hm: '10:30', dur: 41, buffer: 'rec.plain.butcher0123',
      lines: [
        { t: 0, sp: 'them', text: '사모님, 양지 한 근 빼 놨어요.' }, { t: 4, sp: 'me', text: '국거리로 썰어 주세요.', lowWord: '썰어' },
        { t: 7, sp: 'them', text: '네, 이따 오세요.' }, { t: 10, sp: 'me', text: '고마워요, 사장님.' },
        { t: 41, sp: null, text: '통화 종료', end: true } ] },
    { id: 'kwon0121', who: '박 권사님', kind: 'cell', dir: 'in', d: '2027-01-21', hm: '19:20', dur: 200, buffer: 'rec.plain.kwon0121',
      lines: [
        { t: 0, sp: 'them', text: '집사님, 이번 주일 구역 예배는 우리 집에서 해요.' }, { t: 5, sp: 'me', text: '권사님, 저는 이번 주는 못 가요.' },
        { t: 8, sp: 'me', text: '24일이 우리 세아 생일이라서요.' }, { t: 12, sp: 'them', text: '아… 그래요. 우리가 [알 수 없음] 기도할게요.', lowWord: '[알 수 없음]' },
        { t: 17, sp: 'me', text: '고마워요, 권사님.' }, { t: 21, sp: 'them', text: '미역국은 끓였어요?' },
        { t: 24, sp: 'me', text: '내일 장 봐서 끓이려고요.' }, { t: 28, sp: 'them', text: '세아 친구들도 온다면서요.' },
        { t: 31, sp: 'me', text: '네. 토요일에 와요.' }, { t: 35, sp: 'them', text: '잘됐네요. 집사님 혼자 있지 말고요.' },
        { t: 65, sp: 'them', text: '요즘 날이 추워서 새벽 기도에 사람이 없어요.' }, { t: 70, sp: 'me', text: '저도 요즘은 못 나갔어요.' },
        { t: 150, sp: 'them', text: '콩이는 잘 있어요?' }, { t: 153, sp: 'me', text: '네. 아직도 현관에서 기다려요.' },
        { t: 192, sp: 'them', text: '그럼 주일에 또 전화할게요.' }, { t: 195, sp: 'me', text: '네, 들어가세요.' },
        { t: 200, sp: null, text: '통화 종료', end: true } ] },
    { id: 'jimin0110', who: '지민이', kind: 'cell', dir: 'out', d: '2027-01-10', hm: '14:05', dur: 251, buffer: 'rec.plain.jimin0110',
      lines: [
        { t: 0, sp: 'me', text: '지민아, 바쁘니?' }, { t: 2, sp: 'them', text: '아니에요 어머님.' },
        { t: 4, sp: 'me', text: '24일이 세아 생일이야. 미역국 끓일 거야.' }, { t: 9, sp: 'me', text: '{N} 씨랑 같이 와 줄래?' },
        { t: 13, sp: 'them', text: '…네. 꼭 갈게요.' }, { t: 17, sp: 'them', text: '형사님이 어머님 폰에 녹음 켜 놓으셨다면서요.' },
        { t: 21, sp: 'me', text: '응. 나는 그게 어디 있는지도 몰라.', lowWord: '몰라' }, { t: 25, sp: 'them', text: '기차는 토요일 저녁으로 끊을게요.' },
        { t: 29, sp: 'me', text: '그래. 저녁 같이 먹자.' }, { t: 70, sp: 'me', text: '요즘은 잠이 좀 오니?' },
        { t: 74, sp: 'them', text: '…조금요. 어머님은요?' }, { t: 78, sp: 'me', text: '나는 괜찮아.' },
        { t: 238, sp: 'them', text: '어머님 감기 조심하세요.' }, { t: 242, sp: 'me', text: '응, 너도.' },
        { t: 246, sp: 'them', text: '토요일에 봬요.' }, { t: 251, sp: null, text: '통화 종료', end: true } ] },
    { id: 'church1228', who: '교회 사무실', kind: 'cell', dir: 'in', d: '2026-12-28', hm: '11:02', dur: 90, buffer: 'rec.plain.church1228',
      lines: [
        { t: 0, sp: 'them', text: '집사님, 신년 예배 주보에 기도 제목 올려 드릴까요?' }, { t: 5, sp: 'me', text: '네. 우리 세아요.' },
        { t: 8, sp: 'them', text: '네, [알 수 없음] 올려 둘게요.', lowWord: '[알 수 없음]' }, { t: 12, sp: 'me', text: '고마워요.' },
        { t: 15, sp: 'them', text: '신년 예배 때 뵐게요, 집사님.' }, { t: 90, sp: null, text: '통화 종료', end: true } ] },
    { id: 'ricecake1227', who: '시장 떡집', kind: 'cell', dir: 'out', d: '2026-12-27', hm: '15:15', dur: 52, buffer: 'rec.plain.ricecake1227',
      lines: [
        { t: 0, sp: 'me', text: '사장님, 떡국 떡 두 봉지 남겨 주세요.', lowWord: '봉지' }, { t: 4, sp: 'them', text: '네, 내일 오전에 오세요.' },
        { t: 8, sp: 'me', text: '네, 고마워요.' }, { t: 52, sp: null, text: '통화 종료', end: true } ] },
  ];

  G.STORY.callrecUI = {
    settingsTitle: '전화 설정',
    settings: [['block', '번호 차단'], ['rec', '통화 녹음'], ['spam', '스팸 보호'], ['reject', '빠른 거절 메시지'], ['ring', '벨소리 및 진동']],
    recTitle: '통화 녹음',
    recSettings: [['통화 자동 녹음', '켜짐', '꺼짐'], ['녹음할 통화', '모든 통화'], ['녹음된 통화', '']],
    recWhich: ['모든 통화', '저장되지 않은 번호', '선택한 번호'],
    recFoot: '{$recFoot}',
    listTitle: '녹음된 통화',
    more: ['텍스트 변환', '세부 정보'],
    textTitle: '텍스트 변환', textHead: '{$textNote}', converting: '{$converting}', loading: '{$loading}',
    me: '나',
    playerSub: '[통화 녹음 — 허밍]', plainSub: '[통화 소리]',                       // S12 · S13 (G.SUBS text wins when present)
    plainKind: '전화', detailKind: { cell: '전화', talk: '톡 보이스톡' }, detailDir: { in: '수신', out: '발신' },
    detailKeys: ['통화 상대', '녹음 일시', '길이', '녹음 방식', '저장 위치'], detailVals: { how: '자동 녹음', where: '이 휴대전화' },
    spamTitle: '스팸 보호', spamRow: ['스팸 및 사기 의심 전화 차단', '사용 중'],
    rejectTitle: '빠른 거절 메시지', reject: ['지금은 통화할 수 없어요.', '잠시 후 다시 걸게요.', '회의 중이에요.', '운전 중이에요.'],
    ringTitle: '벨소리 및 진동', ring: [['벨소리', '기본 벨소리'], ['진동 패턴', '기본'], ['전화 받을 때 진동', '켜짐']],
    voice: { head: '음성 녹음', chips: [['all', '전체'], ['plain', '일반'], ['call', '통화 녹음']], empty: '{$noRec}' },
  };
})();
