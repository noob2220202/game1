/* =========================================================
 * js/data/gallery.js — 갤러리 · 계산기 보관함 data (DESIGN §3 H3, P5, §4.6)
 *
 * G.STORY.photos   [{id, key|src, t, albums, info, live, memory}]   (세아's camera roll)
 * G.STORY.albums   [{id, name, ...}]                                  (album list order)
 * G.STORY.shared   공유 앨범 '콩이' (members, photos, activity, his photo)
 * G.STORY.memories [{id, title, photo, compare}]                       ('1년 전 오늘')
 * G.STORY.vault    계산기 보관함 (code 1124; folders 세아 / {N} / 기타)
 * G.STORY.calc     계산기 기록 (fixed lines + every night '1124 = 1124')
 * Image keys resolve through G.IMG (js/data/assets.js) at render time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const I = (k) => (G.IMG && G.IMG[k]) || '';
  const DEV = '세아의 Galaxy (SM-S911N)';
  const LOC = '서울 마포구 해솔동';

  /* ---------------- 세아's camera roll (2025) ---------------- */
  function cam(id, key, t, extra) {
    const d = t.replace(/[-: ]/g, '');
    return Object.assign({
      id, key, t, albums: ['camera'],
      get src() { return I(this.key); },
      info: { '파일': `${d.slice(0, 8)}_${d.slice(8, 12)}${String(10 + (d.charCodeAt(9) % 49)).padStart(2, '0')}.jpg`, '기기': DEV, '위치': LOC },
    }, extra || {});
  }
  G.STORY.photos = [
    cam('IMG_1124', 'sea_room_1yr', '2025-11-24 03:29', {
      memory: true,
      info: { '파일': '20251124_032912.jpg', '기기': DEV, '플래시': '켜짐', 'ISO': '3200', '위치': '서울 마포구 해솔빌 404호' },
    }),
    cam('IMG_1122', 'mo_mug', '2025-11-22 21:08'),
    cam('IMG_1121', 'mo_mandarin', '2025-11-21 22:45'),
    cam('IMG_1120', 'dog_park', '2025-11-20 18:12'),
    cam('IMG_1119', 'mo_laptop', '2025-11-19 02:28'),
    cam('IMG_1118', 'mo_sky', '2025-11-18 17:39'),
    cam('IMG_1117', 'mo_clothes', '2025-11-17 15:01'),
    // LIVE photo (P5 clue). Long-press plays frames + 오르골. After the 3rd playback the still keeps the 1 cm gap.
    {
      id: 'IMG_1115', t: '2025-11-15 20:10', albums: ['camera', 'live'],
      get src() { return I(G.state && G.state.vars.liveGap ? 'sea_orgel_live_1' : 'sea_orgel_live'); },
      live: { frames: ['sea_orgel_live', 'sea_orgel_live_1', 'sea_orgel_live_2'], sub: '♪ 작은 오르골 소리' },
      info: { '파일': '20251115_201007.heic', '종류': 'LIVE 사진 · 소리 포함', '기기': DEV, '위치': '서울 마포구 해솔빌 404호' },
    },
    cam('IMG_1011', 'mo_mixdesk', '2025-10-11 22:58'),
    cam('IMG_0902', 'dog_face', '2025-09-02 20:20'),
    cam('IMG_0317', 'dog_bed', '2025-03-17 11:52'),
  ];

  /* ---------------- albums (order shown in 앨범 tab) ---------------- */
  G.STORY.albums = [
    { id: 'camera', name: '카메라' },
    { id: 'mine', name: '내가 찍은 사진', empty: '아직 찍은 사진이 없어요.\n카메라로 방 안을 찍으면 여기에 모여요.' },
    { id: 'live', name: 'LIVE', sub: '꾹 누르면 움직이는 사진' },
    { id: 'shared', name: "공유 앨범 '콩이'", shared: true },
  ];

  /* ---------------- 공유 앨범 '콩이' ---------------- */
  G.STORY.shared = {
    id: 'shared',
    name: "공유 앨범 '콩이'",
    created: '2024-09-01',
    members: [
      { name: '세아', avatar: 'avatar_sea', role: '만든 사람' },
      { name: '엄마', avatar: 'avatar_mom' },
      { name: 'sagongsa', avatar: null, black: true, joined: '2025-03-10 15:24' },
    ],
    photos: [
      { id: 'SH_2603', key: 'dog_face', t: '2026-03-17 09:12', by: '엄마', caption: '세아야 오늘 콩이 온 날이다. 콩이 잘 있어. 밥도 잘 먹고.', comments: [] },
      { id: 'SH_1120', key: 'dog_park', t: '2025-11-20 18:15', by: '세아', caption: '산책 너무 좋아함 ㅠ', comments: [{ by: '엄마', text: '콩이 신났네 ㅎㅎ 춥게 다니지 마' }] },
      { id: 'SH_0902', key: 'dog_face', t: '2025-09-02 20:31', by: '세아', caption: '소리로 그린 콩이 🐶', comments: [{ by: '엄마', text: '이게 무슨 소리야 ㅎㅎ 아무튼 귀엽다' }] },
      { id: 'SH_0317', key: 'dog_bed', t: '2025-03-17 12:01', by: '세아', caption: '콩이 우리집 온 지 2년 🎂', comments: [{ by: '엄마', text: '우리 막내 생일 축하해 ♥' }, { by: '세아', text: '엄마 케이크 사 왔어?ㅋㅋ' }] },
    ],
    // P6 psychological peak (M5 + 30 s). Client override: always haru_fallback (no camera composite).
    face: {
      id: 'SH_FACE', key: 'haru_fallback', by: 'sagongsa', shotT: '2026-11-24 04:25',
      comment: '화면 끊어도 다 보여, {N야}.',
      info: { '기기': 'Galaxy S21 (SM-G991N)', '업로드': 'sagongsa', '촬영 위치': '404호(실내)', '원본': '보관함 · 동기화됨' },
    },
    activity: [
      { t: '2026-03-17 09:12', text: '엄마님이 사진 1장을 추가했습니다' },
      { t: '2025-03-10 15:24', text: 'sagongsa님이 참여했습니다', sus: true },
      { t: '2024-09-02 08:40', text: '엄마님이 참여했습니다' },
      { t: '2024-09-01 21:30', text: "세아님이 공유 앨범 '콩이'를 만들었습니다" },
    ],
  };

  /* ---------------- 추억 ---------------- */
  G.STORY.memories = [
    { id: '1yr', title: '1년 전 오늘', photo: 'IMG_1124', compare: 'room_wardrobe', note: '…1년 전 오늘, 같은 시간. 같은 옷장.' },
  ];

  /* ---------------- 계산기 보관함 (H3) ---------------- */
  G.STORY.vault = {
    code: '1124',
    info: '세아의 Galaxy · 원격 촬영 · 업로드: SM-G991N',
    lastUpload: '02:47',
    folders: [
      {
        id: 'sea', name: '세아', count: 41,
        more: '41장 중 6장만 이 기기에 있습니다. 나머지는 SM-G991N에 저장되어 있습니다.',
        note: '누군가 1년 가까이, 옷장 틈에서 세아가 자는 걸 찍었다.',
        photos: [
          { id: 'V_1120', key: 'vault_sea_6', t: '2025-11-20 03:33' },
          { id: 'V_1021', key: 'vault_sea_5', t: '2025-10-21 02:58' },
          { id: 'V_0930', key: 'vault_sea_4', t: '2025-09-30 03:05' },
          { id: 'V_0711', key: 'vault_sea_3', t: '2025-07-11 03:20' },
          { id: 'V_0618', key: 'vault_sea_2', t: '2025-06-18 02:40' },
          { id: 'V_0402', key: 'vault_sea_1', t: '2025-04-02 03:12' },
        ],
      },
      {
        id: 'me', name: '{N}',
        note: '02:47. 내가 자고 있을 때. 옷장 틈에서 찍혔다.',
        photos: [
          { id: 'V_H0247', key: 'vault_haru_sleep', t: '2026-11-24 02:47' },
          { id: 'V_H2110', key: 'vault_haru_boxes', t: '2026-11-23 21:10' },
        ],
      },
      {
        id: 'etc', name: '기타',
        photos: [
          { id: 'IMG_0606', key: 'shaft_card_dark', t: '2026-11-24 02:53', exposure: true, file: 'IMG_0606.png' },
          { id: 'IMG_0310', key: 'vault_0310', t: '2025-03-10 14:07', file: 'IMG_0310.jpg', note: '2025.03.10 14:07 — 옷장 안에서 찍힌 사진. 세아가 \'수리 기사\'에게 문을 열어 주고 있다.' },
        ],
      },
    ],
    // exposure editor (IMG_0606): gain = 1 + 17·e^1.6 ; stages in fractions of the slider
    exposure: { noiseEnd: 0.55, cardFrom: 0.55, shoulderFrom: 0.78, js1At: 0.92, fragAt: 0.6, fragHoldMs: 1000 },
    fragNote: '③ 0 6 — 그 사람 벽에 붙은 카드. 앞 네 자리는… 내 사진으로 가려져 있었다.',
  };

  /* ---------------- 계산기 기록 ---------------- */
  G.STORY.calc = {
    fixed: [
      { t: '2025-08-30 21:14', expr: '650000×12' },
      { t: '2025-09-13 23:40', expr: '37800÷3' },
      { t: '2025-11-03 10:05', expr: '24×7' },
    ],
    // every night since she vanished: someone opens the vault (2025-11-25 → today)
    nightly: { from: [2025, 11, 25], to: [2026, 11, 24], expr: '1124', lastTime: [2, 46] },
  };
})();
