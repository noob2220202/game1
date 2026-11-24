/* =========================================================
 * js/data/browser.js — 인터넷 data. DESIGN §4.5 (+ H5 QR page, P6 synced tabs).
 * pages:   {id: {title, url, kind, render(api) -> Node, onOpen(scr, api)}}
 * history: [{page|q, title, when, t, sec}]  (newest first; first row = meta, built by the app)
 * syncedTabs: rows chosen by state (app computes; frozen after M5)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const el = (...a) => G.util.el(...a);
  const T = (s) => (G.T ? G.T(s) : s);
  const B = () => G.browser;

  /* ---------- small page builders ---------- */
  function results(q, list, note) {
    return el('div.srp', null,
      el('div.srp-q', null, el('span', null, '🔍'), el('b', null, T(q))),
      note ? el('div.srp-note', null, T(note)) : null,
      list.map((r) => {
        const n = el('button.srp-item', null, el('small', null, r.site), el('b', null, T(r.title)), r.snip ? el('span', null, T(r.snip)) : null);
        n.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); if (r.page) B().openPage(r.page); else B().offline(r.site); });
        return n;
      }));
  }
  function qa(o) {
    return el('div.qa', null,
      el('div.qa-badge', null, o.site || '지식나눔'),
      el('div.qa-q', null, el('b', null, 'Q. '), T(o.q)),
      el('div.qa-meta', null, T(o.meta || '')),
      el('div.qa-a', null, el('div.qa-ah', null, el('b', null, 'A. '), el('span', null, T(o.who || '답변자'))), (o.a || []).map((p) => el('p', null, T(p)))),
      o.more ? el('div.qa-more', null, T(o.more)) : null);
  }

  /* ---------- pages ---------- */
  const P = (G.STORY.pages = {});

  P.home = { title: '홈', url: 'internet://home', kind: 'home', render: () => B().homePage() };

  P.news = {
    title: '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"', url: 'news.hanul.kr/society/261120', openedBy: '2026.11.20 오전 6:31',
    render: () => B().article({
      source: '한울일보 · 사회',
      title: '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"',
      meta: '입력 2026.11.20 06:00 · 수정 2026.11.20 06:12 · 김도윤 기자',
      blocks: [
        '지난해 11월 24일 새벽 마포구의 한 오피스텔에서 실종된 윤모(24) 씨의 행방이 1년째 묘연하다.',
        '경찰은 외부 출입 흔적이 없다는 점에 주목했지만 단서를 찾지 못했다.',
        '윤 씨의 어머니는 "딸 번호를 아직 살려 두고 매일 밤 전화를 건다"고 말했다.',
        '윤 씨가 살던 404호에는 최근 새 세입자가 입주했다.',
        { related: ['[단독] 실종 여대생 마지막 메시지 "엄마 나"', '"딸이 좋아하던 오르골, 아직 그 방에"… 어머니의 1년', '외부 출입 흔적 없는 실종… 경찰 "원점 재검토"'] },
      ],
    }),
  };

  P.cafe = {
    title: '해솔빌 입주민 카페', url: 'cafe.haesolvil.kr',
    render: () => B().board({
      name: '해솔빌 입주민 카페', sub: '멤버 86 · 해솔빌 입주민만 가입 가능',
      posts: [
        { title: '엘리베이터 정기 점검 안내 (11/26)', by: '관리사무소', date: '2026.11.20', n: 0 },
        { title: '택배 분실 조심하세요 ㅠ', by: '201호', date: '2025.10.30', n: 4 },
        { title: '주차장 2층 누수 신고했어요', by: '305호', date: '2025.08.19', n: 2 },
        { title: '밤마다 404호 쪽 벽에서 긁는 소리 나요ㅠ', by: '403호', date: '2025.05.11', n: 5, page: 'cafe_scratch', hot: true },
        { title: '분리수거 요일 바뀌었어요 (화·금)', by: '관리사무소', date: '2025.03.02', n: 1 },
        { title: '[공지] 4층 EPS실 출입 통제 안내', by: '관리사무소', date: '2024.11.02', n: 0, page: 'cafe_eps', notice: true },
      ],
    }),
  };
  P.cafe_eps = {
    title: '[공지] 4층 EPS실 출입 통제 안내', url: 'cafe.haesolvil.kr/notice/112',
    render: () => B().article({
      source: '해솔빌 입주민 카페 · 공지',
      title: '[공지] 4층 EPS실 출입 통제 안내',
      meta: '관리사무소 · 2024.11.02 · 조회 241',
      blocks: [
        '4층 EPS실 내부 배관 점검구는 2019년 리모델링 시 404호 붙박이장 뒤쪽까지 연결된 구조로, 합판으로 폐쇄되었습니다.',
        '무단 출입을 금합니다.',
        '<span style="color:#888;font-size:13px">※ EPS실: 전기·통신 설비실 (각 층 계단 옆)</span>',
      ],
    }),
    onOpen: () => { G.flag('epsNotice', true); G.sd.note('4층 EPS실 배관 점검구 → 404호 붙박이장 뒤까지 연결. 합판으로 막았다고?'); },
  };
  P.cafe_scratch = {
    title: '밤마다 404호 쪽 벽에서 긁는 소리 나요ㅠ', url: 'cafe.haesolvil.kr/free/2087',
    render: () => {
      const photo = B().darkPhoto();
      return B().article({
        source: '해솔빌 입주민 카페 · 자유게시판',
        title: '밤마다 404호 쪽 벽에서 긁는 소리 나요ㅠ',
        meta: '403호 · 2025.05.11 · 조회 97',
        blocks: [
          '새벽 2~4시쯤 404호 쪽 벽에서 뭔가 긁는 소리가 나요. 쥐인지 배관인지… 저만 그런가요?',
        ],
        comments: [
          { name: '402호', t: '2025.05.11', text: '저도 가끔요 쥐인가' },
          { name: '501호', t: '2025.05.12', text: '윗집인 줄 알았는데 404호 쪽이었구나' },
          { name: '관리사무소', t: '2025.05.13', text: '배관 점검 요청 드렸습니다. 불편을 드려 죄송합니다.' },
          { name: '403호', t: '2025.06.02', text: '아직도 나요… 요즘은 노크 같은 소리도' },
          { name: '404', t: '오늘 03:31', text: '저도 들려요', creepy: true, node: photo },
        ],
      });
    },
    onOpen: (scr) => B().watchDarkPhoto(scr),
  };

  P.qr404 = {
    title: '해솔빌 시설 고장신고 이력 · 404호', url: 'haesolvil.kr/as?unit=404',
    render: () => B().facility(),
    onOpen: (scr) => {
      if (!G.flag('managerExposed')) G.sd.note('관리사무소는 새벽에 톡을 안 보낸다. 3월 옷장 수리도, 11월 도어락 오류도 접수 내역이 없다. 관리실 = 그 사람.');
      G.flag('managerExposed', true);
      G.flag('qrSeen', true);
      B().typeLast(scr);
    },
  };
  P.as_lookup = {
    title: '해솔빌 관리사무소 · 시설 고장신고', url: 'haesolvil.kr/as',
    render: () => B().asLookup(),
  };

  // 세아's 2025 searches (cached answers — real hints)
  P.q_smartview = {
    title: '스마트뷰 화면공유 끄면 다시 켜짐', url: 'search.daon.net/qna?id=8812',
    render: () => qa({
      site: '지식나눔 · 스마트폰', q: '폰 맨 위에 네모난 아이콘이 계속 떠요. 스마트뷰(화면 공유)라는데 TV도 없고, 끄면 다음 날 또 켜져 있어요.',
      meta: '질문 2025.10.03 · 비공개', who: '폰박사 님 · 채택 답변',
      a: ['배터리 옆 네모(캐스트) 아이콘은 다른 기기로 화면을 보내고 있다는 표시예요.', '화면 맨 위를 아래로 끌어내리면 빠른 설정에 "화면 공유 중" 카드가 보입니다. 거기서 [중지]를 누르거나, 설정 › 연결 › 화면 공유(스마트뷰)에서 연결된 기기를 확인하고 [연결 끊기] 하세요.', '모르는 기기 이름이 보이면 누군가 원격으로 연결해 둔 것일 수 있어요. 바로 끊고 비밀번호를 바꾸세요.'],
      more: '이 답변이 도움이 되었나요? 👍 312',
    }),
  };
  P.q_phase = {
    title: '위상 상쇄 모노 체크 원리', url: 'search.daon.net/qna?id=9031',
    render: () => qa({
      site: '지식나눔 · 음향', q: '믹싱할 때 모노 체크를 왜 하나요? 위상이 뒤집히면 소리가 사라진다는데 무슨 뜻인지…',
      meta: '질문 2025.10.11', who: 'mixlab 님 · 채택 답변',
      a: ['똑같은 소리를 하나는 그대로, 하나는 위상을 뒤집어(+/−) 왼쪽·오른쪽에 넣으면, 두 귀로 들을 땐 멀쩡히 들려요.', '그런데 모노로 합치면(L+R) 둘이 정확히 상쇄돼서 그 소리만 0이 됩니다. 반대로 가운데에 있던 소리는 그대로 남아요.', '폰에도 "모노 오디오"(손쉬운 사용)가 있으니 이어폰 끼고 직접 켜 보세요.'],
      more: '이 답변이 도움이 되었나요? 👍 87',
    }),
  };
  P.q_orgel = {
    title: '오르골 태엽 고치는 법', url: 'search.daon.net/qna?id=7710',
    render: () => qa({
      site: '지식나눔 · 생활', q: '어릴 때 엄마가 사준 오르골인데 태엽이 헛돌아요. 고칠 수 있나요?',
      meta: '질문 2025.09.21', who: '수리공방 님',
      a: ['바닥 나사 네 개를 풀면 무브먼트가 보여요. 태엽 축에 걸린 멈춤쇠가 빠진 경우가 많아요.', '멈춤쇠를 제자리에 끼우고 천천히 감아 보세요. 소리가 나면 성공!'],
      more: '질문자: 됐어요!!! 감사합니다 ㅠㅠ 보물 1호 살렸다',
    }),
  };
  P.q_wall = {
    title: '벽 속 빈 공간 소리로 찾는 법', url: 'search.daon.net/qna?id=5521',
    render: () => qa({
      site: '지식나눔 · 집', q: '옷장 뒤 벽을 두드리면 소리가 달라요. 벽 속이 비어 있는지 소리로 알 수 있나요?',
      meta: '질문 2025.04.03 · 비공개', who: '인테리어 님',
      a: ['손가락 마디로 두드려 보세요. 꽉 찬 벽은 "딱딱", 속이 빈 곳은 "통통" 울려요.', '통통 울리는 범위가 넓으면 석고보드나 합판 뒤에 빈 공간이 있는 거예요. 배관 점검구일 수도 있어요.'],
    }),
  };
  // his searches (other device) — result lists only
  P.q_name = { title: '{N} 이름 뜻', url: 'search.daon.net/?q={N}+이름+뜻', render: () => results('{N} 이름 뜻', [{ site: '이름사전', title: "'{N}' — 이름 풀이와 뜻", snip: '한 해의 어느 날, 한 낮과 한 밤이 지나는 동안…' }, { site: '작명소 블로그', title: '{N이}라는 이름을 가진 사람들의 성격' }]) };
  P.q_newtenant = { title: '해솔빌 404호 새 입주자', url: 'search.daon.net/?q=해솔빌+404호', render: () => results('해솔빌 404호 새 입주자', [{ site: '방구하기', title: '해솔빌 404호 · 원룸 · 계약 완료', snip: '11월 23일 입주 · 붙박이장 있음 · 반려동물 X' }, { site: '해솔빌 입주민 카페', title: '밤마다 404호 쪽 벽에서 긁는 소리 나요ㅠ', page: 'cafe_scratch' }]) };
  P.q_door = { title: '자는 사람 안 깨우고 문 여는 법', url: 'search.daon.net/?q=자는+사람+안+깨우고', render: () => results('자는 사람 안 깨우고 문 여는 법', [{ site: '생활꿀팁', title: '도어락 버튼음 끄는 법 (무음 모드)' }, { site: '지식나눔', title: '새벽에 조용히 문 여닫는 방법 있나요?' }]) };
  P.q_hinge = { title: '옷장 경첩 소리 안 나게 하는 법', url: 'search.daon.net/?q=옷장+경첩+소리', render: () => results('옷장 경첩 소리 안 나게 하는 법', [{ site: '집수리', title: '붙박이장 경첩 삐걱 소리 — 윤활제로 5분 해결' }, { site: '지식나눔', title: '합판 문 소리 안 나게 미는 법' }]) };
  P.q_admin = { title: '도어락 관리자 모드 원격 설정', url: 'search.daon.net/?q=도어락+관리자+원격', render: () => results('도어락 관리자 모드 원격 설정', [{ site: '해솔홈 고객센터', title: '원격 관리자 잠금 설정·해제 방법' }, { site: '보안 블로그', title: '관리자 PIN, 한 번도 안 바꾸면 생기는 일', snip: '원격 잠금은 다시 걸 수 있어도, 관리자 PIN을 바꾸지 않으면 문 앞 키패드로 그대로 풀립니다.' }]) };
  P.q_statute = { title: '실종 1년 공소시효', url: 'search.daon.net/?q=실종+1년', render: () => results('실종 1년 공소시효', [{ site: '법률상담', title: '실종 선고와 공소시효의 차이' }, { site: '뉴스', title: '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"', page: 'news' }]) };
  P.q_112 = { title: '112 신고', url: 'search.daon.net/?q=112', render: () => results('112 신고', [{ site: '경찰청', title: '긴급 신고 112 · 문자 신고 #112', snip: '문자 신고는 휴대전화(SIM)가 있어야 합니다. 와이파이만 연결된 기기에서는 이용할 수 없습니다.' }]) };

  /* the in-app 해솔홈 web stub (synced tab 1) */
  P.haesol_web = {
    title: '해솔홈 - 404호 도어락 관리', url: 'home.haesolhome.kr/unit/404/doorlock',
    render: () => el('div.hs-webstub', null, el('div.hsw-logo', null, '해솔홈'), el('b', null, '해솔홈 웹은 앱에서만 이용할 수 있어요'), el('small', null, '도어락 · CCTV · 기기 관리'),
      el('button', { onclick: () => G.phone.openApp('haesol') }, '해솔홈 앱 열기')),
  };

  /* ---------- history (newest first; the meta row is added by the app) ---------- */
  G.STORY.history = [
    { page: 'q_name', title: '{N} 이름 뜻', when: '오늘 01:58', t: '2026-11-24 01:58', sec: '오늘' },
    { page: 'q_newtenant', title: '해솔빌 404호 새 입주자', when: '어제 23:40', t: '2026-11-23 23:40', sec: '어제' },
    { page: 'q_door', title: '자는 사람 안 깨우고 문 여는 법', when: '어제 23:12', t: '2026-11-23 23:12', sec: '어제' },
    { page: 'news', title: '해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"', when: '4일 전', t: '2026-11-20 06:31', sec: '이번 주' },
    { page: 'q_hinge', title: '옷장 경첩 소리 안 나게 하는 법', when: '3일 전', t: '2026-11-21 02:20', sec: '이번 주' },
    { page: 'q_admin', title: '도어락 관리자 모드 원격 설정', when: '5일 전', t: '2026-11-19 03:05', sec: '이번 주' },
    { page: 'q_statute', title: '실종 1년 공소시효', when: '2주 전', t: '2026-11-10 04:11', sec: '이번 달' },
    { page: 'q_smartview', title: '스마트뷰 화면공유 끄면 다시 켜짐', when: '2025.10.03', t: '2025-10-03 01:44', sec: '2025년' },
    { page: 'q_phase', title: '위상 상쇄 모노 체크 원리', when: '2025.10.11', t: '2025-10-11 23:30', sec: '2025년' },
    { page: 'q_orgel', title: '오르골 태엽 고치는 법', when: '2025.09.21', t: '2025-09-21 21:20', sec: '2025년' },
    { page: 'q_wall', title: '벽 속 빈 공간 소리로 찾는 법', when: '2025.04.03', t: '2025-04-03 03:02', sec: '2025년' },
  ];
  G.STORY.bookmarks = ['cafe', 'news'];

  /* ---------- 다른 기기의 탭 · Galaxy (SM-G991N) — rows in priority order (max 4) ---------- */
  G.STORY.syncedTabs = [
    { id: 'door', title: '해솔홈 - 404호 도어락 관리', url: 'home.haesolhome.kr', page: 'haesol_web', when: () => true },
    { id: 'rec', title: '녹음 파일 몰래 지우는 법', url: 'search.daon.net', when: () => !(G.flag('frag47') || G.flag('H1')) },
    { id: 'vault', title: '계산기 금고 앱 안 들키게 숨기는 법', url: 'search.daon.net', when: () => !(G.flag('frag06') || G.flag('H3')) },
    { id: 'secq', title: '해솔홈 보안 질문 바꾸는 법', url: 'search.daon.net', when: () => !G.flag('M4') },
    { id: 'cast', title: '화면 공유 끊김 방지 · 세아폰', url: 'search.daon.net', when: (o) => G.flag('M4') && (o.mirroring) },
    { id: 'name', title: '{N} 이름 뜻', url: 'search.daon.net', page: 'q_name', when: () => (G.fragCount ? G.fragCount() : 0) >= 2 },
  ];

  /* ---------- search ---------- */
  G.STORY.search = function (q) {
    const s = String(q || '').replace(/\s+/g, '').toLowerCase();
    const has = (...k) => k.some((x) => s.includes(x));
    if (!s) return null;
    if (has('haesolvil.kr/as?unit=404', 'unit=404')) return 'qr404';
    if (has('고장신고', '시설', '관리사무소', 'haesolvil', '해솔빌관리')) return 'as_lookup';
    if (has('eps', '배관', '점검구')) return 'cafe_eps';
    if (has('카페', '입주민', '긁는', '해솔빌')) return 'cafe';
    if (has('실종', '윤세아', '윤모', '세아')) return 'news';
    if (has('화면공유', '스마트뷰', '미러링', '캐스트', '네모아이콘')) return 'q_smartview';
    if (has('모노', '위상', '상쇄')) return 'q_phase';
    if (has('오르골', '뮤직박스', 'musicbox')) return 'q_orgel';
    if (has('빈공간', '통통', '벽속')) return 'q_wall';
    if (has('도어락', '관리자pin', '관리자잠금', '원격잠금')) return 'q_admin';
    if (has('112', '경찰', '신고')) return 'q_112';
    if (has('sagongsa', '사공사')) return results(q, [], `'${q}'에 대한 검색 결과가 없습니다.`);
    return results(q, [], '검색 결과를 불러올 수 없습니다.\n관리자 네트워크에서 외부 검색이 제한되었습니다.');
  };
})();
