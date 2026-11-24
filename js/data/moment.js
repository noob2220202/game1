/* =========================================================
 * js/data/moment.js — 모먼트 (SNS) data. DESIGN §3 H4 (acrostic), §4.6, P5.
 * Newest first, the eight last posts' first syllables read bottom-up:
 *   옷 장 뒤 에 누 가 (세아, 25.11.17–22)  +  있 어 (tonight, from her account)
 * post: {id, t, caption, img, pos, zoom, filter, live, photoId, likes, likedBy:[handle], comments:[{h, text, t}]}
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const J = 'jimin_0412', S = 'seah_y';
  G.STORY.moment = {
    me: S,
    profiles: {
      seah_y: {
        handle: S, name: '윤세아', bio: '음향과 · 소리 모으는 사람 🎧',
        avatar: { img: 'avatar_sea', fallback: 'dog_face' },
        postCount: 38, followers: 212, following: 180,
        posts: [
          { id: 'p0247', t: '2026-11-24 02:47', caption: '어서 와, {N야}.', img: 'mo_bed_blur', alt: 'vault_haru_sleep', altFilter: 'blur(6px) brightness(.55)', likes: 1, likedBy: ['sagongsa'], comments: [] },
          { id: 'p0241', t: '2026-11-24 02:41', caption: '있지, 새 이웃이 이사 왔어', img: 'mo_sneakers', alt: 'room_door', altPos: '50% 92%', altZoom: 3.2, likes: 1, likedBy: ['sagongsa'], comments: [] },
          { id: 'p1122', t: '2025-11-22 21:10', caption: '가끔은 혼자인 게 좋아', img: 'mo_mug', likes: 23, comments: [{ h: J, text: '세아야 요즘 글 왜 이래… 괜찮아?', t: '2025-11-22 23:31' }, { h: S, text: 'ㅋㅋ 뭔소리 나 멀쩡함', t: '2025-11-22 23:40' }] },
          { id: 'p1121', t: '2025-11-21 22:48', caption: '누가 내 귤 먹었냐 (나임)', img: 'mo_mandarin', likes: 31, comments: [{ h: J, text: 'ㅋㅋㅋㅋ 범인 자수함', t: '2025-11-21 22:55' }] },
          { id: 'p1120', t: '2025-11-20 18:20', caption: '에구 콩이 산책 너무 좋아함 ㅠ', img: 'dog_park', likes: 44, comments: [{ h: 'dahye.k', text: '콩이 귀여워ㅠㅠㅠ', t: '2025-11-20 19:02' }] },
          { id: 'p1119', t: '2025-11-19 02:30', caption: '뒤늦게 정주행 시작함… 잠이 안 와', img: 'mo_laptop', likes: 18, comments: [{ h: J, text: '뭐 보는데 나도', t: '2025-11-19 09:12' }] },
          { id: 'p1118', t: '2025-11-18 17:41', caption: '장 보러 가는 길 하늘 미쳤다', img: 'mo_sky', likes: 52, comments: [] },
          { id: 'p1117', t: '2025-11-17 15:05', caption: '옷 정리하다가 작년 사진 발견ㅋㅋ', img: 'mo_clothes', likes: 27, comments: [{ h: J, text: '작년 사진 나도 보여줘', t: '2025-11-17 15:30' }] },
          { id: 'p1115', t: '2025-11-15 20:12', caption: '내 보물 1호 🎵 소리까지 들려주고 싶다', img: 'sea_orgel_live', live: true, photoId: 'IMG_1115', likes: 61, comments: [{ h: J, text: '그게 뭔데 소리 들려줘ㅋㅋ', t: '2025-11-15 20:20' }, { h: S, text: '사진 꾹 눌러봐ㅋㅋ', t: '2025-11-15 20:21' }] },
          { id: 'p1011', t: '2025-10-11 23:02', caption: '믹스 끝나면 모노 체크 필수 ㅋㅋ 위상 뒤집힌 소리는 합치면 사라짐 (전공자만 웃음)', img: 'mo_mixdesk', likes: 38, comments: [{ h: 'sound_mj', text: '아 이거 ㄹㅇ', t: '2025-10-11 23:10' }, { h: J, text: '무슨 말인지 1도 모르겠음', t: '2025-10-11 23:14' }] },
          { id: 'p0902', t: '2025-09-02 20:30', caption: '소리로 그린 콩이 🐶 녹음 앱에서 주파수 보기로 바꿔서 들어봐!', img: 'dog_face', likes: 74, comments: [{ h: J, text: '헐 천재', t: '2025-09-02 20:41' }, { h: 'prof.lee_sound', text: '좋은 아이디어네요. 졸업작품에도 응용해 보세요.', t: '2025-09-03 09:10' }] },
          { id: 'p0317', t: '2025-03-17 12:00', caption: '콩이 우리집 온 지 2년 🎂', img: 'dog_bed', likes: 58, comments: [{ h: J, text: '콩이 생일 축하해 🎉', t: '2025-03-17 12:20' }] },
          { id: 'p0901', t: '2024-09-01 21:15', caption: '드디어 내 방!! 404호 🏠', img: 'dog_bed', pos: '30% 40%', zoom: 1.9, likes: 40, comments: [{ h: J, text: '집들이 언제', t: '2024-09-01 21:20' }, { h: S, text: '콩이가 허락하면ㅋㅋ', t: '2024-09-01 21:22' }] },
        ],
      },
      sagongsa: {
        handle: 'sagongsa', name: '', bio: '', private: true,
        avatar: { black: true },
        postCount: 0, followers: 0, following: 1, followingList: [S],
      },
      jimin_0412: {
        handle: J, name: '지민', bio: '🍜 먹는 게 제일 좋아 · @seah_y 베프',
        avatar: { img: 'avatar_jimin', initial: '지', bg: 'linear-gradient(160deg,#a8d8c8,#4ea38a)' },
        postCount: 54, followers: 301, following: 288, posts: [], unloadable: true,
      },
    },
  };
})();
