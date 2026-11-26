/* =========================================================
 * ep2 data · gallery.js (owner: media) — DESIGN §4.5 · §3.10 갤러리 · §3.17 01:40 · §4.10.4 · §9.4 ring.
 * G.STORY.gallery.n         {N}: empty state + 카메라 album (items = vars.shots, room camera)
 * G.STORY.gallery.received  01:40 near-share 받은 파일 (4) + 강수진's one-line remarks (§4.10.4)
 * G.STORY.gallery.dash      '—': 0310 (11 + 214 grey cells) · 옥상 (14 + video) · 숨긴 항목 · ⋮ menu
 * Items: key = G.IMG key (resolved by G.e2.img) · t = capture time (sort, newest first) · info = the
 * info-sheet lines verbatim. Videos: frames for G.ui.framePlayer, buffer = G.audio.buffer id,
 * reach = { 'sec': flagName } (fires only when PLAYBACK crosses it). Lazy (cb) => … evaluated at render.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const roofInfo = (when) => [when, '카메라 · 이 휴대전화 · 위치 정보 없음'];
  const ROOF_T = [
    ['01', '2026-12-11 01:06', '2026.12.11 오전 1:06'], ['02', '2026-12-12 01:03', '2026.12.12 오전 1:03'],
    ['03', '2026-12-13 01:09', '2026.12.13 오전 1:09'], ['04', '2026-12-14 01:02', '2026.12.14 오전 1:02'],
    ['05', '2026-12-15 01:07', '2026.12.15 오전 1:07'], ['06', '2026-12-16 01:04', '2026.12.16 오전 1:04'],
    ['07', '2026-12-17 01:08', '2026.12.17 오전 1:08'], ['08', '2026-12-18 01:01', '2026.12.18 오전 1:01'],
    ['09', '2026-12-19 01:05', '2026.12.19 오전 1:05'], ['10', '2026-12-20 01:03', '2026.12.20 오전 1:03'],
    ['11', '2026-12-21 01:06', '2026.12.21 오전 1:06'], ['12', '2026-12-22 01:02', '2026.12.22 오전 1:02'],
    ['13', '2026-12-23 01:07', '2026.12.23 오전 1:07'], ['14', '2026-12-24 01:04', '2026.12.24 오전 1:04'],
  ];

  G.STORY.gallery = {
    title: '갤러리',
    n: { empty: ['사진 없음', '다온 클라우드 계정이 없습니다'], cameraAlbum: '카메라', cameraInfo: '카메라 · 이 휴대전화' /* items from vars.shots */ },

    received: {
      album: '받은 파일', info: '받은 파일 · 강수진의 휴대전화 · 2026.12.25 오전 1:40', speaker: '강수진',
      items: [
        { id: 'r1', key: 'pol_case', kang: null },
        { id: 'r2', key: 'pol_tank_in', kang: '물탱크실 안이에요.' },
        { id: 'r3', key: 'pol_tally', kang: null },
        { id: 'r4', key: 'pol_sticker', kang: null, seen: ['photo4Seen', 'seenHangyeol'], fallbackText: '한결' },   // §9.8: DOM sticker card if the image is missing
      ],
    },

    dash: {
      albums: [
        { id: '0310', name: '0310', count: '11개 · 이 기기에 저장됨', ghost: { n: 214, text: '{$ghost}' }, flag: 'dashA0310',
          items: [
            { id: 'a1', key: 'n_room_4', t: '2026-12-21 22:05', info: ['2026.12.21 오후 10:05 · 다른 기기', '저장 2026.12.22 오전 1:15 · 다온 클라우드에서 다운로드'] },
            { id: 'a2', key: 'n_roof_snow', t: '2026-12-20 08:05', info: ['2026.12.20 오전 8:05 · 다른 기기', '저장 2026.12.21 오전 1:13'] },
            { id: 'a3', key: 'n_room_3', t: '2026-12-16 20:30', info: ['2026.12.16 오후 8:30 · 다른 기기', '저장 2026.12.17 오전 1:16'] },
            { id: 'a4', key: 'n_room_2', t: '2026-12-12 09:14', info: ['2026.12.12 오전 9:14 · 다른 기기', '저장 2026.12.13 오전 1:11'] },
            { id: 'a5', key: 'n_sill', t: '2026-12-11 08:20', info: ['2026.12.11 오전 8:20 · 다른 기기', '저장 2026.12.12 오전 1:15'] },
            { id: 'a6', key: 'n_lock_new', t: '2026-12-10 18:12', info: ['2026.12.10 오후 6:12 · 다른 기기', '저장 2026.12.11 오전 1:12'] },
            { id: 'a7', key: 'n_room_1', t: '2026-12-10 16:51', info: ['2026.12.10 오후 4:51 · 다른 기기', '저장 2026.12.10 오후 11:40'] },
            { id: 'a8', key: 'n_sky', t: '2026-12-10 15:31', info: ['2026.12.10 오후 3:31 · 다른 기기', '저장 2026.12.10 오후 11:40'] },
            { id: 'a9', t: '2026-12-10 15:24', thumb: 'move_f2',
              video: { dur: 18, buffer: 'vid.move',
                       frames: [{ key: 'move_f1', t0: 0, t1: 5.5 }, { key: 'move_f2', t0: 5.5, t1: 8.6 }, { key: 'move_f3', t0: 8.6, t1: 13 }, { key: 'move_f4', t0: 13, t1: 18 }],
                       subs: [{ t0: 0, t1: 8, text: '[바람 소리]', kind: 'mood' }, { t0: 9, t1: 11.2, text: '[철문 삐걱이는 소리]', kind: 'info' }],
                       reach: { '10.0': 'seenHinge' } },
              info: ['동영상 · 0:18 · 2026.12.10 오후 3:24 · 다른 기기', '저장 2026.12.10 오후 11:40'] },
            { id: 'a10', key: 'n_boxes', t: '2026-12-10 15:10', info: ['2026.12.10 오후 3:10 · 다른 기기', '저장 2026.12.10 오후 11:40'] },
            { id: 'a11', key: 'contract_cap', t: '2026-12-03 16:06', info: ['스크린샷 · 2026.12.03 오후 4:06 · 이 휴대전화'] },
          ] },
        { id: 'roof', name: '옥상', count: '15개 · 이 기기에 저장됨', flag: 'dashARoof',
          items: ROOF_T.map(([n, t, when]) => ({ id: 'w' + n, key: 'win_shot_' + n, t, info: roofInfo(when) })).concat([
            { id: 'rv', t: '2026-12-21 23:40', thumb: 'roofvid_f2',
              video: { dur: 12, buffer: 'vid.roof',
                       frames: [{ key: 'roofvid_f1', t0: 0, t1: 4 }, { key: 'roofvid_f2', t0: 4, t1: 8.5 }, { key: 'roofvid_f3', t0: 8.5, t1: 12 }],
                       subs: [{ t0: 0, t1: 4, text: '[바람 소리]', kind: 'mood' }, { t0: 5, t1: 8, text: '[휘파람]', kind: 'info' }],
                       reach: { '8.0': 'seenWhistle' } },
              info: ['동영상 · 0:12 · 2026.12.21 오후 11:40 · 카메라 · 이 휴대전화'] },
          ]) },
      ],
      hidden: { title: '숨긴 항목', flag: 'dashHidden',
        items: [
          { id: 'h1', key: 'inn_key', t: '2026-11-25 14:52', info: ['카메라 · 이 휴대전화 · 2026.11.25 오후 2:52 · 위치 정보 없음'], seen: 'seenKey404', hideIfMissing: true },
          { id: 'h2', t: '2026-11-24 03:20', thumb: 'rec_voicetalk', show: (cb) => !!cb('ring'),
            video: { dur: 7, buffer: 'ringHaru7', frames: [{ key: 'rec_voicetalk', t0: 0, t1: 7 }],
                     subs: [{ t0: 0, t1: 5, text: '[벨소리]', kind: 'info' }] },
            info: ['화면 녹화 · 0:07 · 2026.11.24'] },
        ] },
      menu: ['숨긴 항목 보기', '설정'], settingsTitle: '설정',
      settingsRow: (cb) => `숨긴 항목 ${cb('ring') ? 2 : 1}`,
      noShareNoDelete: true,
    },
  };
})();
