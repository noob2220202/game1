/* =========================================================
 * ep3/js/data/talk.js — 톡 (logged in · 엄마's account) data (comms · DESIGN_EP3 §3.20.1 · §4.5 · §5.1 톡 입력칸 규칙 ·
 * ARCH_EP3 §6.13). Read by engine/apps/talk.js when G.STORY.talk.mode === 'in'.
 *
 * Message shape (renderer contract — engine/apps/talk.js `C.viewIn`):
 *   { id, t:'YYYY-MM-DD HH:MM', from:'me'|'them', text?, call?:'noAnswer'|'done', img?, mail?, name? (group sender),
 *     unread? (draw '1' — 엄마's lines after 2026-11-24 07:07), fold? (month-fold key), strike? (last line struck through) }
 * rooms.sea(cb) / rooms.jimin(cb) are lazy (cb = G.e3.cb getter, frozen at introDone). Every string = DESIGN verbatim.
 * '1' unread marks never change tonight (§4.5.2). {N} tokens are expanded by the renderer (G.T).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const E1 = () => G.STORY.e1canon || {};
  const flagOn = (n) => !!(G.flag && G.flag(n));
  const cbv = (cb, k) => { try { return typeof cb === 'function' ? cb(k) : null; } catch (e) { return null; } };

  /* ---------------- 세아 💛 (§4.5.2 — 1편 momMessages() reversed: 세아 = left, 엄마 = right '나') ---------------- */
  function seaRoom(cb) {
    const E = E1();
    const out = [];
    let n = 0;
    const add = (m) => { m.id = m.id || 'sea.' + (n++); out.push(m); return m; };
    // ① 1편 정본 2025-09-14 … 11-23 — one fold `2025년 9월 – 11월 · 메시지 28`
    (E.momRoomReversed ? E.momRoomReversed() : []).forEach((m) => add(Object.assign({}, m, { fold: 'e1' })));
    // ② 2025-11-24 (expanded)
    if (E.night) E.night[1].forEach((r) => add({ t: E.night[0] + ' ' + r[1], from: E.sideTo(r[0]), text: r[3] ? undefined : r[2], call: r[3] ? 'noAnswer' : undefined }));
    // ③ 2025-11-25 … 2026-11-23 — nightly 03:33 voice call + her lines (month folds; 11-20 … 11-23 expanded — ep1 grp 0)
    const r4 = !!(G.STORY.talk && G.STORY.talk.r4);
    const yl = E.yearLines || {};
    for (let d = pd(E.yearFrom || '2025-11-25'), end = pd(E.yearTo || '2026-11-23'); d <= end; d.setDate(d.getDate() + 1)) {
      const k = ymd(d);
      const open = d >= new Date(2026, 10, 20) || (r4 && k === '2026-01-24');
      const fold = open ? undefined : k.slice(0, 7);
      add({ t: k + ' 03:33', from: 'me', call: 'noAnswer', fold });
      if (yl[k]) add({ t: k + ' ' + yl[k][0], from: 'me', text: yl[k][1], fold });
      if (r4 && k === '2026-01-24') add({ t: k + ' 21:40', from: 'me', text: '세아야 생일 축하해. 엄마 미역국 끓였어' });   // R4 (off — §12.5-3)
    }
    // ④ 2026-11-24 (expanded) — ep1 tonight + A′ (cb.A1) + A″ (everyone) + A (cb.A)
    if (E.tonight) E.tonight[1].forEach((r) => add({ t: E.tonight[0] + ' ' + r[1], from: E.sideTo(r[0]), text: r[3] ? undefined : r[2], call: r[3] ? 'noAnswer' : undefined }));
    if (cbv(cb, 'A1')) {
      const mr = E.momRead || [];
      [['03:41', mr[0]], ['03:41', mr[1]], ['03:42', mr[2]], ['03:42', mr[3]]].forEach(([hm, text]) => add({ t: '2026-11-24 ' + hm, from: 'me', text }));
      add({ t: '2026-11-24 03:43', from: 'me', call: 'noAnswer' });
    }
    const ed = E.endDialog || [];
    const edT = ['07:04', '07:05', '07:05', '07:06', '07:06', '07:06', '07:07'];
    ed.forEach((r, i) => {
      const m = { t: '2026-11-24 ' + edT[i], from: r[0] === 'me' ? 'them' : 'me' };
      if (typeof r[1] === 'string') m.text = r[1];
      else if (r[1] && r[1].mail) m.mail = true;
      else if (r[1] && r[1].img) m.img = r[1].img;
      add(m);
    });
    if (cbv(cb, 'A')) add({ t: '2026-11-24 07:07', from: 'me', text: E.endA });
    // ⑤ after 07:07 — every 엄마 line carries '1' (세아's account never reads them tonight)
    const A = !!cbv(cb, 'A');
    const after = [
      ['2026-11-25', '21:10', '세아야 메일 읽었어'], ['2026-11-25', '21:10', '하루에 한 번만 생각하라며'], ['2026-11-25', '21:10', '엄마는 그게 안 돼'],
      ['2026-11-26', '21:00', '세아야 오늘 엄마 생일이다. 작년에 케이크 사 온다고 했지'],
      ['2026-12-24', '21:32', '세아야 메리 크리스마스. 콩이 산타 됐어'],
      ['2026-12-26', '21:05', '세아야 보고 싶다'],
      ['2027-01-01', '00:02', '새해 복 많이 받아 우리 딸'],
      ['2027-01-23', '21:40', '세아야 내일 니 생일이야'], ['2027-01-23', '21:40', '미역국 끓여 놨어'],
    ];
    // neutral (¬cb.A): the 03:33 column goes on until 01-23 — folds 2026-11-25…30 · 2026-12 · 2027-01-01…22; 01-23 expanded
    const foldOf = (k) => (A ? undefined : k >= '2027-01-23' ? undefined : k < '2026-12-01' ? '2026-11-25' : k.slice(0, 7));
    const byDay = {};
    after.forEach((r) => { (byDay[r[0]] = byDay[r[0]] || []).push(r); });
    for (let d = new Date(2026, 10, 25), end = new Date(2027, 0, 23); d <= end; d.setDate(d.getDate() + 1)) {
      const k = ymd(d), fold = foldOf(k);
      if (!A) add({ t: k + ' 03:33', from: 'me', call: 'noAnswer', fold });
      (byDay[k] || []).forEach((r) => add({ t: r[0] + ' ' + r[1], from: 'me', text: r[2], unread: true, fold }));
    }
    // 2027-01-24 (expanded)
    add({ t: '2027-01-24 00:00', from: 'me', text: '세아야 생일 축하해 우리 딸', unread: true });
    add({ id: 'sea.call0333', t: '2027-01-24 03:33', from: 'them', call: 'done' });   // 처음으로 왼쪽
    return out;
  }

  /* ---------------- 지민이 (§4.5.3) ---------------- */
  function jiminRoom(cb) {
    const A = !!cbv(cb, 'A');
    const rows = [
      ['2026-03-17', '19:22', 'me', '지민아 오늘 콩이 온 날이야'],
      ['2026-03-17', '19:22', 'me', { img: 'dog_face' }],
      ['2026-03-17', '19:28', 'them', '어머님 ㅠㅠ 콩이 너무 귀여워요'],
      ['2026-05-08', '16:02', 'them', '어머님 꽃 잘 받으셨어요? 세아 몫까지예요'],
      ['2026-05-08', '16:03', 'me', '고마워 지민아'],
      ['2026-09-24', '21:02', 'them', '어머님 저 내일 아침 기차예요'],
      ['2026-09-24', '21:10', 'me', '그래 콩이가 기다린다'],
      ['2026-12-25', '01:52', 'them', '어머님 늦게 죄송해요'],
      ['2026-12-25', '01:52', 'them', '{N} 씨 무사해요. 경찰분들이랑 같이 있어요'],
      ['2026-12-25', '02:03', 'me', '{N} 씨 괜찮아요? 콩이가 산타 모자 썼어요'],
      ['2026-12-25', '02:03', 'me', { img: 'kongi_santa' }],
      ['2026-12-25', '02:04', 'me', A ? '그날 이후로 03:33에 전화 안 해요. 대신 그 시간에 콩이랑 물 마셔요.' : '아직도 03:33에 깨요. 그래도 괜찮아요.'],
      ['2026-12-25', '02:04', 'me', '{N} 씨 한번 보고 싶다. 다음 달에 같이 와'],
      ['2026-12-25', '02:06', 'them', '네 어머님 ㅠㅠ 꼭 같이 갈게요'],
      ['2027-01-10', '15:00', 'them', '어머님 기차표 끊었어요! 23일 토요일 저녁에 같이 가요'],
      ['2027-01-10', '15:00', 'me', '그래 조심히 와'],
      ['2027-01-23', '18:05', 'them', '어머님 택시 탔어요 ㅎㅎ 금방 간대요'],
      ['2027-01-23', '18:06', 'me', '응 미역국 데우고 있어'],
    ];
    return rows.map((r, i) => Object.assign({ id: 'jimin.' + i, t: r[0] + ' ' + r[1], from: r[2] }, typeof r[3] === 'string' ? { text: r[3] } : r[3]));
  }

  G.STORY.talk = {
    mode: 'in',
    r4: false,                                       // §12.5-3: R4 line off (live ep1 has no R4)
    tabs: [['friends', '친구'], ['chats', '채팅'], ['more', '더보기']],
    list: [
      { id: 'sea', name: '세아 💛', avatar: 'avatar_sea', pinned: true, preview: '보이스톡 0:33', when: '오전 3:33' },
      { id: 'jimin', name: '지민이', avatar: 'avatar_jimin', initial: '지', preview: '응 미역국 데우고 있어', when: '1월 23일' },
      { id: 'self', name: '나와의 채팅', avatar: 'avatar_mom', preview: '1/21 장보기', when: '1월 21일' },
      { id: 'group3', name: '3구역', members: 14, group: true, readOnly: true, preview: '감사합니다 권사님', when: '1월 20일' },
      { id: 'kitchen', name: '급식실 조리팀', members: 8, group: true, readOnly: true, preview: '현숙 조리사님은 이번엔 쉬세요', when: '1월 8일' },
    ],
    input: { sea: true, jimin: true, self: true },   // §5.1 — sent bubbles right · 세아 💛 keeps '1' · no reply
    unreadOnSend: { sea: true, jimin: true },        // the '1' on tonight's own lines (나와의 채팅: no read mark)
    inputPh: '메시지 입력',
    rooms: {
      sea: seaRoom,
      jimin: jiminRoom,
      self: [
        { id: 'self.0', t: '2025-07-20 21:30', from: 'me', text: '세아가 해 준 거 (25.7.20)\n글씨 크게 — 안경 안 써도 됨\n광고 전화는 저절로 막힘. 안 울림\n사진은 \'콩이\' 앨범에 올리면 세아도 봄' },
        { id: 'self.1', t: '2026-12-26 21:20', from: 'me', text: '12/26 형사님\n세아 노래 들음\n다섯 번째 음 틀렸음\n언제 녹음인지 모른대\n끝까지 못 들음\n전화 녹음 켜 놓음 (형사님이)\n톡, 앨범 지우지 말 것\n사진 올리지 말 것\n연락 오면 형사님께 문자 (전화 X)' },
        { id: 'self.2', t: '2027-01-21 21:10', from: 'me', text: '1/21 장보기\n미역\n소고기 국거리 한 근\n국간장\n참기름\n두부\n귤 (애들)\n콩이 간식\n케이크', strike: true },   // ~~케이크~~ (엄마가 친 줄)
      ],
      group3: [
        { id: 'g3.0', t: '2026-12-25 08:10', from: 'them', name: '박 권사님', text: '성탄 축하드립니다. 오늘 예배 후 친교실에서 떡 나눠요' },
        { id: 'g3.1', t: '2026-12-25 08:31', from: 'them', name: '이순례', text: '아멘 감사합니다' },
        { id: 'g3.2', t: '2027-01-03 13:40', from: 'them', name: '박 권사님', text: '새해 기도 제목 모임 앱에 올렸어요. 김현숙 집사님 가정 위해 같이 기도해요🙏' },
        { id: 'g3.3', t: '2027-01-20 20:00', from: 'them', name: '박 권사님', text: '이번 주일 구역 예배는 2시에 저희 집에서 합니다. 세아 자매 위해 계속 기도해 주세요🙏' },
        { id: 'g3.4', t: '2027-01-20 20:05', from: 'me', text: '감사합니다 권사님' },
      ],
      kitchen: [
        { id: 'k.0', t: '2026-12-30 14:10', from: 'them', name: '실장님', text: '방학 중 조리실 소독은 2월 둘째 주에 합니다' },
        { id: 'k.1', t: '2026-12-30 14:10', from: 'them', name: '실장님', text: '다들 방학 잘 보내세요' },
        { id: 'k.2', t: '2027-01-08 10:00', from: 'them', name: '실장님', text: '방학 중 냉동고 점검은 1월 셋째 주에 합니다' },
        { id: 'k.3', t: '2027-01-08 10:01', from: 'them', name: '실장님', text: '현숙 조리사님은 이번엔 쉬세요' },
      ],
    },
    // fold heads (⊕ §4.5.2): `{년} {월} · 보이스톡 {k}` (+ ` · 메시지 {m}`) · the ep1 block keeps its own head
    foldHead: { e1: '2025년 9월 – 11월 · 메시지 {m}' },
    callRow: { noAnswer: '보이스톡 · 응답 없음', done: '보이스톡 0:33' },
    mailCard: ['1년 뒤에 이 메일을 읽을 누군가에게', '윤세아 · 예약 메일'],
    redial: ['보이스톡으로 다시 걸기', '취소'],                 // tap on the left call row (§4.5.2 ⊕ · §4.5.6)
    callSheet: ['보이스톡', '페이스톡', '취소'],                // 📞 · profile 통화하기 (§4.5.1 ⊕)
    roomMenu: ['사진·동영상', '파일', '톡 알림 · 켜짐'],        // ≡ (§4.5.2 ⊕ — 나가기 · 삭제 0)
    jiminAfter: { card: '지민이 휴대전화 화면을 보고 고개를 든다.', who: '지민', say: '저 여기 있어요.' },   // §4.5.6 (bip 뒤)
    friends: {
      me: { head: '내 프로필', name: '김현숙', status: '콩이랑 산책 🐾', avatar: 'avatar_mom' },
      favHead: '즐겨찾기', fav: ['sea'],
      head: '친구 21',   // 21 names, 가나다 (DESIGN §4.5.1 ⊕ gives four + '…' — lead filled the rest from her world: church · 급식실 · 동네 가게; names only, no status)
      names: ['관리사무소', '교회 사무실', '급식실 실장님', '동물병원', '미용실', '미정 조리사님', '박 권사님', '반찬가게', '세탁소', '수선집', '시장 떡집', '약국', '오 권사님',
              '은숙 조리사님', '이순례', '정 집사님', '정육점 사장님', '지민이', '최 집사님', '콩이 미용실', '한의원'],
    },
    profile: { sea: { bg: 'dog_park', status: '🎧 소리 모으는 중', btns: ['1:1 채팅', '통화하기'] } },
    more: { rows: ['톡 설정', '공지사항'], settings: ['알림', '화면', '글자 크기'] },
    kinds: { voice: '보이스톡', face: '페이스톡' },
  };
})();
