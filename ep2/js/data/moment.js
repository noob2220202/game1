/* =========================================================
 * ep2/js/data/moment.js — 모먼트 (SNS) data · owner: social
 * DESIGN §3.7 · §3.10 · §3.12 · §3.13 · §3.14 · §3.18 · §4.1.1–§4.1.8 · §4.10.6–§4.10.8 (strings verbatim)
 * ARCH §5.7 schema. Load-time: defines data only (no cross-owner calls).
 *
 * Rules: every player-facing string carries tokens ({N…} {MAKER_CONTACT} {MAKER_ID} {mapoOrg} {$key})
 * and is expanded by the renderer with G.T at render time. Every line *he* wrote is tagged his:true
 * (§3.20.3 ledger #11–#24). Conditional lines are lazy functions. Times: t = 'YYYY-MM-DD HH:MM' (in-game, 24 h).
 *
 * Message-id index (used by engine/apps/moment.js and by the save, which stores ids only — §9.2):
 *   jimin_0412 base j1…j34, jvm, j51 · fake base f1920 fsys f1921 f2250 · fakeM5 f0016a/b/c
 *   tonight r2345…r0016 · c1 lines c1_1 c1_2 c1_3 c1_3a c1_5 c1_6 c1_6v c1_7 c1_7v c1_8 c1_9 c1_10
 *   cW1 cW2 cWm cD1…cD4 cS1 cS2 cP1 cP2a cP2b cA1…cA3 cK1 cK2 cE1…cE3 · pool pl_* · scripts j0200a…d jRight jNone jWrong1
 *   jT1y jT1n jT2 jT3 jT4 · jM1…jM7 (jM4y/jM4n)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const J = (d, rows) => rows.map((r) => Object.assign({ id: r[0], from: r[1], t: d + ' ' + r[2], text: r[3] }, r[4] || {}));

  G.STORY.moment = {
    /* ---------------- screen text (all DESIGN §4.1 — ⊕ lines included) ---------------- */
    ui: {
      tabs: { home: '홈', search: '검색', plus: '＋', messages: '메시지', profile: '프로필' },
      appName: '모먼트',
      messages: '메시지', requests: '요청', newMsg: '새 메시지',
      requestsEmpty: '메시지 요청이 없습니다',
      restrictedRow: '제한된 계정의 메시지 {n}',        // + ' ›' chevron (§4.1.2) — n ≥ 1 only
      restrictedTitle: '제한된 계정의 메시지',
      posts: '게시물 {n}',
      editProfile: '프로필 편집', follow: '팔로우', message: '메시지', unrestrict: '제한 해제',
      noPosts: '아직 게시물이 없습니다', todayBadge: '오늘 만든 프로필', viewProfile: '프로필 보기',
      likes: '좋아요 {n}개', comments: '댓글 {n}',
      restrictedComments: '제한된 계정의 댓글 보기', restrictedCommentsHead: '제한된 계정의 댓글 {k}개', restrictedTag: '제한됨',
      recent: '최근 검색', clearAll: '모두 지우기', searchPh: '검색',
      inputPh: '메시지 입력…', send: '보내기', keep: '두기', noAnswer: '대답하지 않는다', read: '읽음',
      voice: '음성 메시지',
      settings: '설정', privacy: '개인정보 보호', notif: '알림', loginAct: '로그인 활동',
      restrictedAccounts: '제한된 계정', restrictedAccountsN: '제한된 계정  {n}', blockedAccountsN: '차단된 계정  {n}',
      msgRequests: '메시지 요청  모든 사람', perChat: '대화별 알림음  2',
      restrictedOnFmt: '제한함 {d}',
      switchAccount: '계정 전환',
      chatTone: '메시지 알림 소리  —', chatToneGrey: '대화가 없습니다',
      ok: '확인', cancel: '취소', block: '차단',
    },
    feedEmpty: ['모두 확인했습니다', '최근 3일 동안 올라온 새 게시물을 모두 확인했습니다.'],

    /* ---------------- accounts ---------------- */
    me: { n: { name: '{N}', handle: null, avatar: 'initial', postCount: 3 }, dash: { account: 'fake' } },

    /* {N}'s own old posts (all before 11-24 — §3.13 Where ③, §4.1.1 table). Grid order = newest first. */
    posts: [
      { id: 'p3', date: '11월 22일', img: 'n_post_3', likes: 14, restricted: ['rc2', 'rc3', 'rc4', 'rc5', 'rc6', 'rc7'] },
      { id: 'p2', date: '11월 12일', img: 'n_post_2', likes: 9, restricted: ['rc1'] },
      { id: 'p1', date: '9월 20일', img: 'n_post_1', likes: 12, restricted: [] },
    ],
    /* the hidden past — 7 restricted comments (§3.13 · §4.1.6 ③) */
    restrictedComments: [
      { id: 'rc1', post: 'p2', t: '2026-11-30 20:02', when: '11월 30일 오후 8:02', text: '폰 찾았어?' },
      { id: 'rc2', post: 'p3', t: '2026-12-10 21:30', when: '12월 10일 오후 9:30', text: '이사 축하해! 오늘 고생했다 ㅋㅋ' },
      { id: 'rc3', post: 'p3', t: '2026-12-10 21:31', when: '12월 10일 오후 9:31', text: '모먼트는 이제 안 하나 봐' },
      { id: 'rc4', post: 'p3', t: '2026-12-13 20:20', when: '12월 13일 오후 8:20', text: '집들이 언제 해?' },
      { id: 'rc5', post: 'p3', t: '2026-12-17 07:50', when: '12월 17일 오전 7:50', text: '너 괜찮은 거 맞지' },
      { id: 'rc6', post: 'p3', t: '2026-12-20 09:00', when: '12월 20일 오전 9:00', text: '눈 왔다! 옥상 계단 미끄러우니까 조심해' },
      { id: 'rc7', post: 'p3', t: '2026-12-22 21:00', when: '12월 22일 오후 9:00', text: '이브에 들를까? 케이크 사 갈게' },
    ],

    profiles: {
      fake: {
        name: '{MAKER_CONTACT}', badge: '오늘 만든 프로필', handle: () => (G.e2 && G.e2.makerHandle && G.e2.makerHandle() ? '@{MAKER_ID}_' : null),
        stats: '게시물 0    팔로워 0    팔로잉 1', empty: '아직 게시물이 없습니다', menu: ['이 계정 정보', '제한', '차단', '신고'],
        info: [['가입한 날짜', '2026년 12월'], ['계정 위치', '정보 없음'], ['이전 사용자 이름', '0개']], infoFoot: '게시물 0 · 팔로워 0',
        card: '게시물 0 · 팔로워 0',
      },
      real: {
        name: '{MAKER_CONTACT}', handle: () => (G.e2 && G.e2.makerHandle && G.e2.makerHandle() ? '@{MAKER_ID}' : null),
        stats: '게시물 0 · 팔로워 64 · 팔로잉 71', empty: '아직 게시물이 없습니다', menu: ['이 계정 정보'],
        info: [['가입한 날짜', '오래된 계정'], ['계정 위치', '대한민국'], ['이전 사용자 이름', '0개']], restrictedOn: '제한함 2026.11.26 오후 9:30',
      },
      jimin_0412: {
        name: '지민', handle: 'jimin_0412', avatar: 'avatar_jimin', initial: '지',
        blocked: ['jimin_0412', '사용자를 찾을 수 없습니다', '게시물 없음'], bio: '🍜 먹는 게 제일 좋아 · @seah_y 베프',
      },
      seah_y: {
        name: '윤세아', handle: '@seah_y', bio: '음향과 · 소리 모으는 사람 🎧', stats: '게시물 36 · 팔로워 212 · 팔로잉 180',
        avatar: 'avatar_sea', initial: '윤',
        /* ep1 public posts verbatim (js/data/moment.js) minus the two 2026-11-24 posts (38 → 36) — §4.1.8 · §8.1 exception.
           LIVE is off: the music-box post is a still frame. Images resolve to ../assets/img/ through G.e2.img. */
        grid: [
          { id: 'p1122', t: '2025-11-22 21:10', caption: '가끔은 혼자인 게 좋아', img: 'mo_mug', likes: 23, comments: [{ h: 'jimin_0412', text: '세아야 요즘 글 왜 이래… 괜찮아?' }, { h: 'seah_y', text: 'ㅋㅋ 뭔소리 나 멀쩡함' }] },
          { id: 'p1121', t: '2025-11-21 22:48', caption: '누가 내 귤 먹었냐 (나임)', img: 'mo_mandarin', likes: 31, comments: [{ h: 'jimin_0412', text: 'ㅋㅋㅋㅋ 범인 자수함' }] },
          { id: 'p1120', t: '2025-11-20 18:20', caption: '에구 콩이 산책 너무 좋아함 ㅠ', img: 'dog_park', likes: 44, comments: [{ h: 'dahye.k', text: '콩이 귀여워ㅠㅠㅠ' }] },
          { id: 'p1119', t: '2025-11-19 02:30', caption: '뒤늦게 정주행 시작함… 잠이 안 와', img: 'mo_laptop', likes: 18, comments: [{ h: 'jimin_0412', text: '뭐 보는데 나도' }] },
          { id: 'p1118', t: '2025-11-18 17:41', caption: '장 보러 가는 길 하늘 미쳤다', img: 'mo_sky', likes: 52, comments: [] },
          { id: 'p1117', t: '2025-11-17 15:05', caption: '옷 정리하다가 작년 사진 발견ㅋㅋ', img: 'mo_clothes', likes: 27, comments: [{ h: 'jimin_0412', text: '작년 사진 나도 보여줘' }] },
          { id: 'p1115', t: '2025-11-15 20:12', caption: '내 보물 1호 🎵 소리까지 들려주고 싶다', img: 'sea_orgel_live', likes: 61, comments: [{ h: 'jimin_0412', text: '그게 뭔데 소리 들려줘ㅋㅋ' }, { h: 'seah_y', text: '사진 꾹 눌러봐ㅋㅋ' }] },
          { id: 'p1011', t: '2025-10-11 23:02', caption: '믹스 끝나면 모노 체크 필수 ㅋㅋ 위상 뒤집힌 소리는 합치면 사라짐 (전공자만 웃음)', img: 'mo_mixdesk', likes: 38, comments: [{ h: 'sound_mj', text: '아 이거 ㄹㅇ' }, { h: 'jimin_0412', text: '무슨 말인지 1도 모르겠음' }] },
          { id: 'p0902', t: '2025-09-02 20:30', caption: '소리로 그린 콩이 🐶 녹음 앱에서 주파수 보기로 바꿔서 들어봐!', img: 'dog_face', likes: 74, comments: [{ h: 'jimin_0412', text: '헐 천재' }, { h: 'prof.lee_sound', text: '좋은 아이디어네요. 졸업작품에도 응용해 보세요.' }] },
          { id: 'p0317', t: '2025-03-17 12:00', caption: '콩이 우리집 온 지 2년 🎂', img: 'dog_bed', likes: 58, comments: [{ h: 'jimin_0412', text: '콩이 생일 축하해 🎉' }] },
          { id: 'p0901', t: '2024-09-01 21:15', caption: '드디어 내 방!! 404호 🏠', img: 'dog_bed', pos: '30% 40%', zoom: 1.9, likes: 40, comments: [{ h: 'jimin_0412', text: '집들이 언제' }, { h: 'seah_y', text: '콩이가 허락하면ㅋㅋ' }] },
        ],
        dates: { p1122: '2025년 11월 22일', p1121: '2025년 11월 21일', p1120: '2025년 11월 20일', p1119: '2025년 11월 19일', p1118: '2025년 11월 18일', p1117: '2025년 11월 17일', p1115: '2025년 11월 15일', p1011: '2025년 10월 11일', p0902: '2025년 9월 2일', p0317: '2025년 3월 17일', p0901: '2024년 9월 1일' },
        menu: ['메시지 알림 소리  —'],
      },
      sagongsa: { name: 'sagongsa', sub: '비공개 계정', stats: '게시물 0 · 팔로워 0 · 팔로잉 1', avatar: 'black' },
      n: { name: '{N}', posts: '게시물 3' },
    },

    /* search — normalized partial match (§4.1.1 table). 'maker2' = first ≥ 2 letters of {MAKER_CONTACT}. */
    search: [
      { match: 'maker2', results: [['{MAKER_CONTACT}', '제한됨', 'real'], ['{MAKER_CONTACT}', '새 계정', 'fake']] },
      { match: ['seah', '세아', '윤세아'], results: [['seah_y', '윤세아', 'seah_y']] },
      { match: ['jimin', '지민'], results: [['jimin_0412', '지민', 'jimin_0412']] },
      { match: ['sagongsa', '사공사'], results: [['sagongsa', '비공개 계정', 'sagongsa']] },
    ],
    recentSearch: { n: [['seah_y', '윤세아', 'seah_y'], ['jimin_0412', '지민', 'jimin_0412']], dash: [['{N}', '', 'n']] },

    /* ---------------- DM threads ---------------- */
    threads: {
      /* §4.1.3 verbatim (⊕ lines included — none of them his). Right = '나' ({N}'s account — he typed). */
      jimin_0412: [].concat(
        J('2026-11-26', [
          ['j1', 'me', '21:12', '저 404호에 이사 왔던 사람이에요.', { his: true }],
          ['j2', 'them', '21:12', '헐'], ['j3', 'them', '21:12', '혹시 {N} 씨…?'],
          ['j4', 'them', '21:12', '괜찮으세요?? 뉴스 봤어요ㅠㅠ'], ['j5', 'them', '21:12', '저 세아 친구 지민이에요'],
          ['j6', 'me', '21:14', '경찰이 비밀로 하래요, 어머님께도 아직 말하지 말아 주세요', { his: true }],
          ['j7', 'them', '21:14', '아 네네 알겠어요'], ['j8', 'them', '21:14', '근데 진짜 괜찮은 거죠?'],
        ]),
        J('2026-11-28', [
          ['j9', 'me', '23:02', '세아 씨는 어떤 사람이었어요?', { his: true }],
          ['j10', 'them', '23:02', '세아는요 ㅋㅋ 맨날 소리 녹음하고 다녔어요'],
          ['j11', 'them', '23:02', '길 가다가 멈춰서 폰 들이대고ㅋㅋ'], ['j12', 'them', '23:02', '보고 싶다 그러면 안 되는데ㅠ'],
        ]),
        J('2026-12-01', [['j13', 'them', '18:40', '오늘 첫눈 온대요ㅋㅋ'], ['j14', 'them', '18:40', '세아는 첫눈 오면 맨날 콩이 데리고 나갔는데']]),
        J('2026-12-04', [['j15', 'them', '20:15', '', { img: 'kongi_old' }], ['j16', 'them', '20:15', '어머님이 콩이 사진 보내 주셨어요 콩이 요즘 현관에서 안 움직인대요ㅠ']]),
        J('2026-12-12', [['j17', 'them', '20:10', '이사는 잘 하셨어요?'], ['j18', 'me', '23:01', '네. 새 집 좋아요.', { his: true }]]),
        J('2026-12-15', [['j19', 'them', '07:40', '아침에 {mapoOrg} 한파 문자 소리에 깼어요ㅠㅠ'], ['j20', 'them', '07:40', '거기도 울렸어요?'], ['j21', 'me', '22:31', '네 저도요.', { his: true }]]),
        J('2026-12-16', [['j22', 'them', '18:20', '오늘 형사님 만나고 왔어요'], ['j23', 'them', '18:20', '세아 오르골 사진 보여 주셨어요'], ['j24', 'them', '18:20', '글로 쓰면 울 것 같아서ㅠ 내일 녹음해서 보낼게요']]),
        [{ id: 'jvm', from: 'them', t: '2026-12-17 21:40', vm: { dur: 14, buffer: 'jiminVM', unplayed: true,
          subs: [{ t0: 0.0, t1: 4.2, text: '형사님이 세아 오르골 사진 보여 주셨어요.' }, { t0: 4.4, t1: 9.6, text: '{N} 씨가 감았을 때 한 마디만 나왔다면서요.' },
                 { t0: 9.8, t1: 14.0, text: '세아가 9월에 고친 건데…' }] } }],
        J('2026-12-17', [['j25', 'them', '21:40', '형사님이 보여 주신 거 얘기예요'], ['j26', 'them', '21:40', '시간 날 때 들어 주세요'],
                         ['j27', 'me', '22:20', '사진 고마워요.', { his: true }], ['j28', 'them', '22:24', '?? 사진이요?'], ['j29', 'them', '22:24', '음성인데…ㅋㅋ']]),
        J('2026-12-20', [['j30', 'them', '19:12', '{N} 씨 요즘 답장이 짧으시네요ㅋㅋ'], ['j31', 'them', '19:12', '아니에요 바쁘시죠']]),
        J('2026-12-24', [
          ['j32', 'them', '22:43', '{N} 씨, 하나만요. 그날 경찰 오기 직전에 세아 오르골 감아 봤다면서요. 어땠어요?'],
          ['j33', 'me', '22:44', '그냥 끝까지 나오던데요 ㅎ', { his: true }],
          ['j34', 'them', '22:47', '…아니구나.'],
          ['j51', 'me', '22:51', '지민 씨', { his: true, failed: true }],
        ])),

      /* §4.1.5 / §3.12 — the fake account he made at 18:40 on '—' */
      fake: [
        { id: 'f1920', from: 'them', t: '2026-12-24 19:20', text: '{N야} 나 새 계정 만들었어. 예전 거 털렸어', his: true },
        { id: 'fsys', sys: '{$reqAccepted}', t: '2026-12-24 19:21' },
        { id: 'f1921', from: 'me', t: '2026-12-24 19:21', text: 'ㅇㅋ', his: true },
        { id: 'f2250', from: 'them', t: '2026-12-24 22:50', text: '{N야} 집이야?', his: true, unread: true },
      ],
      fakeM5: [
        { id: 'f0016a', text: '{N야} 메리 크리스마스.', his: true },
        { id: 'f0016b', text: '나 너네 옥상 왔어.', his: true },
        { id: 'f0016c', text: '문 열어 줘.', his: true },
      ],
      fakeChip: '어디야? 진짜 너야?',

      /* tonight's 12 (§3.13 · §4.1.6 ④) — delivered by the in-game clock, silent while restricted */
      tonight: [
        { id: 'r2345', at: '23:45', text: '야 톡 왜 안 읽어' }, { id: 'r2346', at: '23:46', text: '전화가 꺼져 있대' },
        { id: 'r2348', at: '23:48', text: '{N야} 자?' }, { id: 'r2352', at: '23:52', text: '메리 크리스마스 이브!!' },
        { id: 'r2355', at: '23:55', text: '모먼트 안 하는 거 아는데 여기라도 보냄 ㅋㅋ' }, { id: 'r2358', at: '23:58', text: '너 괜찮은 거 맞지' },
        { id: 'r0001', at: '00:01', text: '메리 크리스마스!!' }, { id: 'r0003', at: '00:03', text: '근데 진짜 이상하다 톡이 안 가' },
        { id: 'r0007', at: '00:07', text: '혹시 폰 또 잃어버린 거 아니지' },
        { id: 'r0010', at: '00:10', text: '답이 없어서 112에 전화했어 나도 갈게', report: true },
        { id: 'r0013', at: '00:13', text: '택시 잡았어' }, { id: 'r0016', at: '00:16', text: '나 그쪽으로 간다?' },
      ],

      /* C1 dialogue (§4.1.6 ⑥ — ms = typing dots before the line) */
      c1: {
        chip0: '나 {N}. 톡 안 돼. 그 사람이 내 옛날 폰을 문 앞에 두고 갔어',
        replies1: [['헐 {N야}!!', 3000], ['왜 톡 안 읽어 전화도 꺼져 있고', 1600], ['무슨 일이야 너 지금 어디야', 2000]],
        r3a: '혹시 나라고 하는 계정 있으면 그거 나 아니야!! 나 아직 가는 중이야',
        chip4: () => (G.flag && G.flag('M2') ? '집. 문 잠갔어. 새 폰은 초기화됐어' : '집. 문 잠갔어. 새 폰은 꺼져 있어'),
        chip4a: '집. 문 잠갔어. 새 폰은 초기화됐어', chip4b: '집. 문 잠갔어. 새 폰은 꺼져 있어',
        lines: {
          c1_1: '헐 {N야}!!', c1_2: '왜 톡 안 읽어 전화도 꺼져 있고', c1_3: '무슨 일이야 너 지금 어디야',
          c1_3a: '혹시 나라고 하는 계정 있으면 그거 나 아니야!! 나 아직 가는 중이야',
          c1_5: '거기 있어 나 가는 중이야', c1_6: '112도 할게!!', c1_6v: '112엔 아까 했어 한 번 더 할게!!',
          c1_7: '112 했어 순찰 보내 준대', c1_7v: '했어 순찰 보내 준대',
          c1_8: '근데 이브라 좀 늦을 수 있대', c1_9: '문 절대 열지 마',
          c1_10: '경찰이 그 사람 어디 숨어 있었는지 알면 말해 달래',
          cW1: '물탱크실?? 옥상 거기?', cW2: '그대로 전할게!!', cWm: '알겠어 그대로 전할게!',
          cD1: '뭐???', cD2: '112 다시 했어 긴급으로!!', cD3: '5분 안에 온대', cD4: '문 열지 마 제발',
          cS1: '알았어. 안 올라가.', cS2: '아래에서 기다릴게',
          cP1: '경찰 거의 다 왔대!!', cP2a: '경찰 도착했대!!', cP2b: '나도 거의 다 왔어',
          cA1: '도착했어', cA2: '경찰분들이 위로 못 가게 해', cA3: '나 1층에 있어',
          cK1: '형사님 올라가셨어', cK2: '나 여기 있어',
          cE1: '{N야}', cE2: '올라간다 지금', cE3: '경찰분이 괜찮대',
        },
        chipD: '누가 문에 드릴 대고 있어', chipS: '옥상에 그 사람 있어. 올라오지 마', chipE: '응. 이제 올라와',
        timing: { c1_1: 3000, c1_2: 1600, c1_3: 2000, c1_3a: 2200, c1_5: 2400, c1_6: 1200, c1_7wait: 15000, c1_8: 2000, c1_9: 1500,
                  chip4Timeout: 20000, whereAfterC1: 40000, b11AfterM5: 20000, p1AfterC2: 28000, p2AfterM7: 5000 },
        at: { A: '00:44', K: '01:12' },
      },
      /* free-input reaction pool (§4.1.6 ⊕) — one line each per stage, then 응응 */
      pool: { preM6: ['응 보고 있어', '가는 중이야!!'], m6: ['문 열지 마', '조금만 기다려 거의 다 왔대'], m7: ['경찰 왔대!!'],
              after0044: ['나 1층이야', '경찰분들 위에 올라갔어'], after0110: ['괜찮아?? 나 여기 있어'], exhausted: '응응' },
    },

    /* ---------------- '—' side (§3.10 · §4.1.7) ---------------- */
    dashView: {
      stats: '게시물 0 · 팔로워 0 · 팔로잉 1', listName: '{N}',
      listRow: '회원님: {N야} 집이야?', listWhen: '오후 10:50', listRowM5: '회원님: 문 열어 줘.', listWhenM5: '오전 12:16',
      draft: '{N야} 메리 크리스마스. 나 너네 옥상 왔어. 문 열어 줘.', draftNote: '임시 저장 · 오후 9:58',
      switcher: [['{MAKER_CONTACT}', '✓', 'fake'], ['sagongsa', '로그아웃됨', 'sagongsa'], ['＋ 계정 추가', '', 'add']],
      sagongsaSheet: 'sagongsa로 다시 로그인하려면 비밀번호가 필요합니다.',
      limitSheet: '{$newAcctLimit}', sendBlocked: '{$newAcctSend}',
    },

    restrictedScreen: { desc: '제한한 사람의 댓글은 그 사람에게만 보이고, 메시지는 요청함으로 가며 알림이 오지 않습니다.' },
    settings: [['개인정보 보호 ›', 'privacy'], ['알림 ›', 'notif'], ['로그인 활동 ›', 'login']],
    loginActivity: '이 기기 · 지금 활동 중',
    requestsEmpty: '메시지 요청이 없습니다',

    /* ---------------- END tail scripts (§3.18 · §4.10.6–§4.10.8) — played by G.moment.play(id) on request from flow ---------------- */
    scripts: {
      j0200: [{ id: 'j0200a', from: 'them', at: '02:00', text: '{N} 씨.' }, { id: 'j0200b', from: 'them', text: '형사님한테 연락 받았어요. 지금 그 폰 {N} 씨가 들고 있다고.' },
              { id: 'j0200c', from: 'them', text: '미안해요. 하나만 다시 물어볼게요.' }, { id: 'j0200d', from: 'them', text: '그날 경찰 오기 직전에 세아 오르골 감아 봤다면서요. 어땠어요?' },
              { input: 'jiminAnswer', noAnswer: '대답하지 않는다' }],
      jRight: '…{N} 씨구나.', jNone: '…괜찮아요. 형사님이 {N} 씨 맞대요.', jWrong1: '…괜찮아요. 천천히요.',
      jTail: [{ id: 'jT1', from: 'them', text: (cb) => (cb('jimin') ? '그날 신고한 거 저예요. 늦어서 미안해요…' : '그날 저는 자고 있었어요. 미안해요.') },
              { id: 'jT2', from: 'them', text: '한 달 동안 {N} 씨인 줄 알고 얘기했어요. 세아 얘기도 많이 했어요.' }, { chip: '지민 씨 잘못 아니에요.' },
              { id: 'jT3', from: 'them', text: '……' }, { id: 'jT4', from: 'them', text: '고마워요.' }],
      j0205: [{ id: 'jM1', from: 'them', text: '어머님이 전해 달래요.' }, { id: 'jM2', from: 'them', at: '02:05', text: '{N} 씨 괜찮아요? 콩이가 산타 모자 썼어요' },
              { id: 'jM3', from: 'them', img: 'kongi_santa' },
              { id: 'jM4', from: 'them', text: (cb) => (cb('mom') ? '어머님이 그러셨어요. 그날 이후로 03:33에 전화 안 해요. 대신 그 시간에 콩이랑 물 마셔요.' : '어머님이 그러셨어요. 아직도 03:33에 깨요. 그래도 괜찮아요.') },
              { id: 'jM5', from: 'them', text: '어머님이 {N} 씨 한번 보고 싶대요. 다음 달에 같이 대전 가요.' }, { chip: '네. 같이 가요.' },
              { id: 'jM6', from: 'them', text: 'ㅠㅠ 네' }, { id: 'jM7', from: 'them', text: '어머님께 말씀드릴게요' }],
      m0212: [{ id: 'cE1', from: 'them', text: '{N야}' }, { id: 'cE2', from: 'them', text: '올라간다 지금' }, { id: 'cE3', from: 'them', text: '경찰분이 괜찮대' }, { chip: '응. 이제 올라와' }],
      /* restored text of the player's free-input lines after a tab close (§9.2) */
      restoreAnswerOk: '한 마디만 나왔어요', restoreWhereOk: '옥상 물탱크실', restoreOther: '…',
    },

    /* 03:33 hook voice message — rendered by flow hook.js (S22) with core voiceBubble */
    hookVM: { dur: 12, buffer: 'hook.seahY', when: '오전 3:33', t: '2026-12-25 03:33', subs: [{ t0: 1.7, t1: 8.4, text: '[허밍]' }] },
  };
})();
