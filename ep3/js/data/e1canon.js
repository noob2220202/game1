/* =========================================================
 * ep3/js/data/e1canon.js — episode-1 canonical text, copied verbatim (comms · DESIGN_EP3 §9.1 '1 · 2편과 공유하는 것' ·
 * §3.20.1 · §4.5.2 · ARCH_EP3 §6.14). Sources (ep1 files are NOT edited):
 *   js/data/talk.js  momMessages()  — 2025-09-14 … 2026-11-24 03:33 (sides as on 세아's phone: 'mom' = 엄마, 'sea' = 세아)
 *   js/data/talk.js  momRead        — the four live lines of A′
 *   js/scenes.js     END chat       — the 404호 exchange (A″) + the cb.A last line
 *   js/data/mail.js  SEA_MAIL       — 세아's scheduled mail (letter body, line by line)
 *   js/data/phone.js calls          — the mother-side mirror of 세아's call log (seaCalls; 08:02 · 07:15 · 07:13 = DESIGN §3.8)
 *
 * G.STORY.e1canon = {
 *   before          [[ymd, [[side, 'HH:MM', text], …]], …]   2025-09-14 … 11-23 (ep1 grp days)
 *   night           [ymd, [[side, 'HH:MM', text|null, call?], …]]   2025-11-24 (always expanded)
 *   yearLines       { ymd: ['HH:MM', text] }                  엄마's lines between 2025-11-25 and 2026-11-23 (+ nightly 03:33 call)
 *   yearFrom/yearTo 'YYYY-MM-DD'                             the nightly 03:33 call run (ep1: start … end inclusive)
 *   tonight         [ymd, [[side, 'HH:MM', text|null, call?], …]]   2026-11-24 00:01 … 03:33 (ep1 'tonight')
 *   momLines()      → [[ymd, hm, side, text]]                  every text line above, flattened (QA / docs)
 *   momRoomReversed() → msgs                                  ① day blocks for 엄마's 세아 💛 room: 세아 = 'them', 엄마 = 'me'
 *   momRead · endDialog · endA · seaMail{title, from, sched, body[]} · seaCalls
 * }
 * Data only — no cross-owner code at load time. Strings are ep1's to the character (no tokens — never G.T'd differently).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  // ep1 momMessages() — the eight 'ordinary life before' days (grp: 1), verbatim
  const before = [
    ['2025-09-14', [['mom', '19:20', '세아야 추석에 내려오니?'], ['sea', '19:31', '응 토요일 아침 ktx!'], ['mom', '19:32', '콩이도 데려와'], ['sea', '19:32', '당연하지ㅋㅋ 콩이가 주인공임']]],
    ['2025-09-21', [['mom', '21:05', '오르골 고쳤어?'], ['sea', '21:40', '응 태엽 다시 감았더니 됨!!'], ['mom', '21:41', '그거 너 어릴 때 엄마가 사준 거잖아'], ['sea', '21:41', '그니까 보물 1호지 ㅎㅎ']]],
    ['2025-10-05', [['mom', '12:10', '밥은 먹고 다니니'], ['sea', '12:44', '먹었어 먹었어'], ['mom', '12:45', '김치 보낼게'], ['sea', '12:45', '앗싸 💛']]],
    ['2025-10-20', [['sea', '22:02', '엄마 나 졸작 주제 정했다'], ['sea', '22:02', '들리지 않는 방'], ['mom', '22:15', '무섭다 얘 ㅋㅋ'], ['sea', '22:16', '소리 작품이야ㅋㅋㅋ']]],
    ['2025-11-02', [['mom', '20:30', '날 추워졌다 보일러 틀고 자'], ['sea', '20:52', '응응']]],
    ['2025-11-16', [['mom', '18:12', '다음주에 반찬 가지러 올래?'], ['sea', '18:40', '이번 주는 졸작 땜에 바빠ㅠ 다음에 갈게'], ['mom', '18:41', '그래 무리하지 마']]],
    ['2025-11-21', [['mom', '17:05', '발표 잘했어?'], ['sea', '17:30', '응 그럭저럭!'], ['sea', '17:31', '엄마 근데'], ['mom', '17:31', '응?'], ['sea', '17:34', '아냐 나중에 얘기할게 ㅎㅎ']]],
    ['2025-11-23', [['mom', '22:10', '잘 자 우리 딸'], ['sea', '22:12', '엄마도 잘 자 💛']]],
  ];
  // the night (always expanded)
  const night = ['2025-11-24', [
    ['sea', '03:33', '엄마 나'],
    ['mom', '07:10', '세아야 새벽에 왜? 무슨 일 있어?'],
    ['mom', '07:10', '엄마가 전화 못 받았네 미안해'],
    ['mom', '07:11', null, 'call'],
    ['mom', '07:12', '전화 좀 받아'],
  ]];
  // a year of nightly 03:33 voice calls + her messages (ep1 `lines`)
  const yearLines = {
    '2025-11-25': ['06:40', '세아야 엄마 지금 올라가'],
    '2025-12-01': ['20:12', '콩이는 엄마가 데려왔어. 걱정하지 마'],
    '2025-12-25': ['18:47', '오늘 너 좋아하는 김치찜 했어'],
    '2026-01-01': ['00:03', '새해 복 많이 받아 우리 딸'],
    '2026-02-03': ['21:30', '엄마가 요금은 계속 낼게. 번호 살려둘게'],
    '2026-03-17': ['19:05', '콩이 오늘 우리집 온 날이다. 간식 줬어'],
    '2026-05-08': ['16:20', '지민이가 꽃 보냈더라. 니 몫까지래'],
    '2026-08-20': ['08:15', '콩이 밥 잘 먹어'],
    '2026-11-20': ['22:40', '세아야 다음주면 1년이야'],
  };
  // ep1 'tonight' (2026-11-24 — before the player's night)
  const tonight = ['2026-11-24', [
    ['mom', '00:01', '세아야 답장 안 해도 돼. 읽기만 해.'],
    ['mom', '00:01', '숫자 1만 없어지면 엄마는 돼.'],
    ['mom', '03:33', '세아야 오늘로 1년이야. 엄마 오늘도 전화했어.'],
    ['mom', '03:33', null, 'call'],
  ]];

  // ep1 js/data/mail.js SEA_MAIL — verbatim, one entry per line ('' = blank line)
  const SEA_MAIL = [
    '이 메일이 도착했는데 내가 예약을 취소하지 않았다면,',
    '나는 아마 못 나간 거겠지.',
    '',
    '그럼 이 폰을 들고 있는 너는, 나간 거야. 그치?',
    '그래서 1년 뒤 아침 7시로 맞춰 놨어. 아침이면 좋겠어서.',
    '',
    '부탁 하나만 할게.',
    '우리 엄마한테 이 메일 좀 보여줘.',
    '',
    '엄마. 그날 전화 못 받은 거, 절대 엄마 잘못 아니야.',
    '콩이 산책은 하루에 두 번. 간식은 저녁에만.',
    '그리고 엄마,',
    '하루에 한 번만 나 생각해줘. 딱 한 번만.',
    '나머지 시간은 엄마 하고 싶은 거 하면서 살아.',
    '',
    '이름도 모르는 너한테.',
    '고마워. 진짜로.',
    '',
    '— 세아',
  ];

  const sideTo = (s) => (s === 'sea' ? 'them' : 'me');   // 엄마's phone: 세아 = left ('them'), 엄마 = right ('me' — 나)

  G.STORY.e1canon = {
    before, night, yearLines, tonight,
    yearFrom: '2025-11-25', yearTo: '2026-11-23',
    momLines() {
      const out = [];
      const push = (ymd, rows) => rows.forEach((r) => { if (r[2]) out.push([ymd, r[1], r[0], r[2]]); });
      before.forEach(([ymd, rows]) => push(ymd, rows));
      push(night[0], night[1]);
      Object.keys(yearLines).sort().forEach((k) => out.push([k, yearLines[k][0], 'mom', yearLines[k][1]]));
      push(tonight[0], tonight[1]);
      return out;
    },
    /** ① — 2025-09-14 … 11-23, sides swapped (ep1 grp days → one fold in ep3) */
    momRoomReversed() {
      const out = [];
      before.forEach(([ymd, rows]) => rows.forEach((r, i) => out.push({ id: 'e1.' + ymd.replace(/-/g, '') + '.' + i, t: ymd + ' ' + r[1], from: sideTo(r[0]), text: r[2], e1: true })));
      return out;
    },
    sideTo,
    // ep1 talk.js momRead (A′ — cb.A1)
    momRead: ['세아야?', '읽었어???', '세아야 엄마야', '전화 받아'],
    // ep1 scenes.js END chat (A″) — ['me'] = the ep1 player on 세아's phone (→ 'them' here), ['mom'] = 엄마 (→ 'me')
    endDialog: [
      ['me', '어머님, 저는 404호에 새로 이사 온 사람이에요. 세아 씨 폰을 찾았어요.'],
      ['mom', '…세아가 뭐라고 했어요?'],
      ['me', { mail: true }],
      ['mom', '…'],
      ['mom', '고마워요.'],
      ['mom', { img: 'kongi_old' }],
      ['mom', '콩이가 아직도 현관에서 기다려요.'],
    ],
    endA: '오늘은 전화 안 할게요. 대신 내일 아침에 콩이 데리고 산책 갈게요.',
    seaMail: { title: '1년 뒤에 이 메일을 읽을 누군가에게', from: '윤세아', sched: '예약 발송: 2025.11.23 23:58 → 2026.11.24 07:00', body: SEA_MAIL },
    // 엄마-side mirror of ep1 G.STORY.calls (세아 out 03:31 응답 없음 = 엄마 부재중 …) — [ymd, 'HH:MM', dir, sec | 'noAnswer']
    seaCalls: [
      ['2025-11-24', '08:02', 'out', 0], ['2025-11-24', '07:15', 'out', 0], ['2025-11-24', '07:13', 'out', 0], ['2025-11-24', '03:31', 'missed'],
      ['2025-11-10', '20:14', 'out', 723], ['2025-11-03', '21:30', 'in', 520], ['2025-10-14', '08:40', 'out', 'noAnswer'], ['2025-09-14', '19:40', 'out', 372],
    ],
  };
})();
