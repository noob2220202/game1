/* =========================================================
 * ep2 data — the two users of this phone (DESIGN §3.2 · §3.9 · §4.6.2 · §5.2 · §5.7 · §9.6 ①)
 * owner: shell. Readers: shell (phone.js · lock.js · security.js), social (dash view), media (per-user data).
 *   G.STORY.users = { n, dash, listFrom, nDetail }
 * Strings carry tokens ({N}, {MAKER_CONTACT}, name tokens) and are expanded with G.T at render time.
 * No cross-owner code runs at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.users = {
    n: {
      id: 'n', name: '{N}', role: '관리자', home: 'n', wall: 'n_wall', lock: 'n_wall',
      widget: '우리 집 ♥ since 2026.12.10',
      // N01–N03 — already on the lock screen when the phone is picked up (§3.2 · §4.8). Seeded silently on flag:gotPhone.
      seedNotifs: [
        { id: 'N01', app: 'moment', chat: 'fake', title: '{MAKER_CONTACT}', body: '{N야} 집이야?', when: '오후 10:50', t: '22:50',
          route: { app: 'moment', params: { thread: 'fake' } } },
        { id: 'N02', app: 'moment', chat: 'jimin_0412', title: '', body: '메시지를 보내지 못했습니다', when: '오후 10:51', t: '22:51',
          route: { app: 'moment', params: { thread: 'jimin_0412' } } },
        { id: 'N03', app: 'alerts', title: '{eunpyeongOffice}', body: '오늘 22시 {eunpyeong} 대설주의보 발효…', when: '오후 10:52', t: '22:52',
          route: { app: 'alerts' } },
      ],
    },
    dash: {
      id: 'dash', name: '—', added: '2026.11.25', pin: '0310', home: 'dash', wall: 'old_room', lock: 'old_room_lock',
      allowSwitch: true, calls: false, deletable: false,   // no '사용자 삭제' row at all (§3.9)
    },
    // 설정 › 사용자 — the list as seen from each user (the '—' side is reversed: §3.10 · §4.6.2)
    listFrom: {
      n: [['n', '{N} (나)', '관리자'], ['dash', '—', '추가됨 2026.11.25']],
      dash: [['dash', '— (나)', ''], ['n', '{N}', '관리자']],
    },
    // `{N} (나)` detail (§4.6.2 ⊕)
    nDetail: ['이름  {N}', '관리자', '이 휴대전화의 첫 사용자'],
    // `—` detail (§3.9 · §4.6.2)
    dashDetail: {
      title: '—', added: '추가됨 2026.11.25', switchBtn: '사용자 전환',
      calls: '전화 및 SMS 허용', allow: '이 사용자로 전환 허용',
    },
    addUser: '＋ 사용자 추가',
  };
})();
