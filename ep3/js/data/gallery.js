/* =========================================================
 * ep3 data · gallery.js (owner: media) → G.STORY.gallery (v:3) — read by engine/apps/gallery.js (v3 branch).
 * DESIGN_EP3 §3.10 (shared album '콩이' — members · activity · ⓘ 올린 사람 / 봄 · 702) · §3.20.2 사진 · §4.6 (strings
 * verbatim) · §8.1 (3,041 grid: dated photos once at their own date, the rest = runtime CSS variants of five 콩이
 * photos — p3_kongi_1130 is never varied) · §0.3 D39 · §12.2 V25 (kongi_old: grid cell = taken 2026-11-21,
 * shared album = uploaded 12-04) · V31 (avatar row → 멤버, activity 'sagongsa님이 참여했습니다' → member detail).
 * Strings are raw (tokens) — the renderer expands them with G.T. Times are in-game local 'YYYY-MM-DD HH:MM'.
 * Image fields are asset keys resolved by G.e3.img (missing → grey cell, §9.8).
 * No LIVE / 1년 전 오늘 / 추억 / 숨긴 항목 / 'new photo' banner / delete / share / edit (§5.0-2 ③ · §5.6).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.gallery = {
    v: 3,
    name: '사진',                                         // app label (home · easy tile)
    tabs: [['photos', '사진'], ['albums', '앨범']],
    head: '사진', total: 3041, albumsTitle: '앨범',        // head = `사진 3,041` (count + room-camera shots)
    cameraLabel: '카메라',                                 // ⓘ second line of every camera-roll photo
    today: '오늘',                                         // shutter shots: `오늘 오전 {h}:{mm}` (§4.6.1)

    /* camera roll — §8.1 · §3.20.2 */
    grid: {
      dated: [   // mom's photos with a fixed date — each exactly once, in its own date cell
        { key: 'p3_cake_2411', t: '2024-11-23 19:40', id: 'cake2411', scr: 'gallery.photo.cake2411' },
        { key: 'p3_soup_2601', t: '2026-01-24 07:12', id: 'soup2601', scr: 'gallery.photo.soup2601' },
        { key: 'dog_face', t: '2026-03-17 09:12' },
        { key: 'kongi_old', t: '2026-11-21 07:50', door: '1204' },          // taken 11-21, uploaded to the album 12-04 (V25)
        { key: 'p3_kongi_1130', t: '2026-11-30 18:40', door: '1130', saw702: true },
        { key: 'p3_kongi_1213', t: '2026-12-13 19:05', door: '1213' },
        { key: 'kongi_santa', t: '2026-12-24 21:30', door: '1224' },
      ],
      filler: {  // the remaining 3,034 cells: object-position 9 × mirror 2 × tone 4 = 72 variants, fixed seed
        keys: ['kongi_old', 'dog_face', 'dog_bed', 'kongi_santa', 'p3_kongi_1213'],
        variants: 72, seed: 3041,
        from: '2023-03-17', to: '2027-01-23',
        after: { kongi_santa: '2026-12-24', p3_kongi_1213: '2026-12-13' },   // a variant never predates its picture
        skip: [['2025-11-24', '2025-12-07']],
        ensure: [['2027-01-23', 3]],                                          // the newest group = `1월 23일 (토)` (§4.6.1)
        hours: [7, 21],
      },
    },

    albums: [
      { id: 'camera', name: '카메라' },                                       // count = the grid (3,041 + shots)
      { id: 'old', name: '옛날 사진',
        items: [ { id: 'child_back', key: 'p3_child_back', t: '2025-07-20 15:10' },
                 { id: 'child_hands', key: 'p3_child_hands', t: '2025-07-20 15:11' } ] },
      { id: 'shared', name: "공유 앨범 '콩이'", count: 8, flag: 'albumOpened',
        head: "공유 앨범 '콩이' · 멤버 3 · 사진 8",
        menu: ['멤버', '활동', '앨범 정보'],
        membersTitle: '멤버 3', activityTitle: '활동', infoTitle: '앨범 정보',
        info: [['만든 사람', '세아 · 2024.09.01']],
        members: [
          { id: 'sea', name: '세아', avatar: 'avatar_sea', role: '만든 사람', detail: ['세아', '만든 사람', '공유한 사진 3'] },
          { id: 'mom', name: '나', avatar: 'avatar_mom', detail: ['나', '2024년 9월 2일 오전 8:40 참여', '공유한 사진 5'] },
          { id: 'sagongsa', name: 'sagongsa', avatar: 'avatar_sagongsa', black: true, role: '참여 2025-03-10 15:24',
            detail: ['sagongsa', '2025년 3월 10일 오후 3:24 참여', '공유한 사진 0'], seen: 'membersSeen' },
        ],
        // newest first · cap = mom's hand · ep1 photos keep the ep1 caption/comments (author 엄마 → 나)
        photos: [
          { id: '1224', key: 'kongi_santa', t: '2026-12-24 21:30', door: true,
            cap: '콩이 산타 됐어. 세아야 메리 크리스마스',
            up: '나 · 2026.12.24 오후 9:30', bom: 'sagongsa · 2026.12.25 오전 3:21' },
          { id: '1213', key: 'p3_kongi_1213', t: '2026-12-13 19:05', door: true,
            cap: '오늘도 현관',
            up: '나 · 2026.12.13 오후 7:05', bom: 'sagongsa · 2026.12.14 오전 12:40' },
          { id: '1204', key: 'kongi_old', t: '2026-12-04 08:20', door: true,
            cap: '콩이 주둥이가 하얘졌어. 그래도 아침마다 현관에 있어',
            up: '나 · 2026.12.04 오전 8:20', bom: 'sagongsa · 2026.12.05 오전 1:12' },
          { id: '1130', key: 'p3_kongi_1130', t: '2026-11-30 18:40', door: true, saw702: true,
            cap: '세아야 택배 왔는데 콩이가 제일 먼저 나와. 너 오는 줄 알고',
            up: '나 · 2026.11.30 오후 6:40', bom: 'sagongsa · 2026.11.30 오후 11:47' },
          { id: '2603', key: 'dog_face', t: '2026-03-17 09:12',
            cap: '세아야 오늘 콩이 온 날이다. 콩이 잘 있어. 밥도 잘 먹고.',
            up: '나 · 2026.03.17 오전 9:12', bom: 'sagongsa · 2026.03.18 오전 2:40' },
          { id: '1120', key: 'dog_park', t: '2025-11-20 18:15',
            cap: '산책 너무 좋아함 ㅠ', comments: [['나', '콩이 신났네 ㅎㅎ 춥게 다니지 마']],
            up: '세아 · 2025.11.20 오후 6:15', bom: '나 · sagongsa' },
          { id: '0902', key: 'dog_face', t: '2025-09-02 20:31',
            cap: '소리로 그린 콩이 🐶', comments: [['나', '이게 무슨 소리야 ㅎㅎ 아무튼 귀엽다']],
            up: '세아 · 2025.09.02 오후 8:31', bom: '나 · sagongsa' },
          { id: '0317', key: 'dog_bed', t: '2025-03-17 12:01',
            cap: '콩이 우리집 온 지 2년 🎂', comments: [['나', '우리 막내 생일 축하해 ♥'], ['세아', '엄마 케이크 사 왔어?ㅋㅋ']],
            up: '세아 · 2025.03.17 오후 12:01', bom: '나 · sagongsa' },
        ],
        // newest first · link: 'photo:<id>' opens that photo · 'deleted' → `삭제된 사진입니다` · 'member:<id>' → member detail
        activity: [
          ['2026.12.24 오후 9:30', '내가 사진 1장을 추가했습니다', 'photo:1224'],
          ['2026.12.13 오후 7:05', '내가 사진 1장을 추가했습니다', 'photo:1213'],
          ['2026.12.04 오전 8:20', '내가 사진 1장을 추가했습니다', 'photo:1204'],
          ['2026.11.30 오후 6:40', '내가 사진 1장을 추가했습니다', 'photo:1130'],
          ['2026.11.25 오후 3:02', '세아님이 사진 1장을 삭제했습니다', 'deleted'],
          ['2026.11.24 오전 4:31', 'sagongsa님이 사진 1장을 추가했습니다', 'deleted'],
          ['2026.03.17 오전 9:12', '내가 사진 1장을 추가했습니다', 'photo:2603'],
          ['2025.03.10 오후 3:24', 'sagongsa님이 참여했습니다', 'member:sagongsa'],
          ['2024.09.02 오전 8:40', '내가 참여했습니다'],
          ['2024.09.01 오후 9:30', "세아님이 공유 앨범 '콩이'를 만들었습니다"],
        ] },
    ],

    infoLabels: { up: '올린 사람', bom: '봄' },
    deleted: '{$photoDeleted}',
  };
})();
