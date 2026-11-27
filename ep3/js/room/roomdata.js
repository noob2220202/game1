/* =========================================================
 * 하루를 위한 방탈출! 3 — the flat as seen through 방 보기 and the eye views (ep3/js/room/roomdata.js · owner: room)
 * G.ROOM (v:3) — read only by engine/room/room.js (the generic renderer) and ep3 room set pieces.
 * DESIGN §2.6 · §3.1 table · §3.2.1 · §3.12 0° · §3.13 · §4.1.1 · §4.9 · §4.9.1 · §4.9.2 · §6.3 · §8.3-1/-5/-6/-7/-9 · §9.8.
 * ARCH §5.12 · §6.5 · §7.4 (data-qa spot ids).
 *
 * Coordinates are FRACTIONS (0–1) of the image they sit on (views 1024×1536 · square closeups 1024²); hotspot rects were
 * measured on the shipped images (every tap target gets ≥ 44 CSS px from the renderer's ::after area).
 * Schema (engine contract):
 *   G.ROOM = { v:3, img(k) → url, has(k) → bool, meta(img, k, def), rooms:{ lv:{listener, views:[…]}, sr:{…} }, closeups:{…},
 *              hand:{ mom, sea } (font families) }
 *   view  = { id, yaw, cam, key: string|fn, fb:{ key:[fallbackKey, filter] }, layers:[layer], fx:[name], spots:[spot] }
 *   layer = { id, key: () → imgKey|null, enter:'l'|'r'|'f', exit:'l'|'r'|'f', ms, swapMs, shadow }
 *   spot  = { id, rect: {x,y,w,h} | () → rect|null, when(ctx), caption: string|string[]|(ctx) → string|string[]|{who,text}|null,
 *             flag: string|(ctx) → string|null, cue, closeup: string|(ctx) → string|null, closeupWhen(ctx), go:'sr'|'lv' }
 *     ctx = { eye:bool, mode, n(key) → tap count (incremented) }  ·  caption arrays = [first tap, later taps]
 *     a caption returning {who, text} is a name card (G.cards) instead of a caption line
 *   closeup = { key: string|fn, w, h, fit:'contain'|'cover', focus:{x,y}, yaw, dom, led, screen, flame, steam, spots, flip }
 * Captions are raw DESIGN strings (tokens; `{h}`/`{mm}` = in-game clock, replaced by the renderer before G.T).
 * Data only: functions here read state lazily (G.flag · G.room.get/state); nothing runs at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* ---------- lazy state readers (never called at load) ---------- */
  const f = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const st = (k) => { try { return G.room && G.room.get ? G.room.get(k) : undefined; } catch (e) { return undefined; } };
  const mom = () => { try { return G.room && G.room.state ? G.room.state().mom : 'table'; } catch (e) { return 'table'; } };
  const meta = (img, k, def) => (G.IMGMETA && G.IMGMETA[img] && G.IMGMETA[img][k] != null ? G.IMGMETA[img][k] : def);
  const atTable = () => { const m = mom(); return m === 'table' || m === 'lv'; };
  const lit = () => st('srLamp') === 'lit';

  /* ---------- captions with time variants (§4.1.1 · §4.9.1) ---------- */
  const CAP_SRDOOR_M0 = '세아 방 문이 반쯤 열려 있다. 문 앞에 콩이가 웅크리고 잔다.';
  const CAP_TABLE_LV = () => (st('momBlanket') ? '식탁의 엄마. 어깨에 담요가 덮여 있다.' : '식탁의 엄마. 두 손으로 컵을 감싸고 있다.');
  function srdoorCap() {
    if (!f('handover') && !f('gotPhone')) return CAP_SRDOOR_M0;
    if (f('kongiBack') || f('M7')) return '세아 방 문이 반쯤 열려 있다. 문 앞에 콩이가 엎드려 있다.';
    if (f('M6') && st('kongi') === 'door') return '세아 방 문이 열려 있다. 문 앞이 비어 있다.';
    return '세아 방 문이 반쯤 열려 있다. 문틈으로 작은 불빛. 문 앞에 콩이가 웅크리고 잔다.';
  }
  function tableCap() {
    if (f('M8')) return null;
    const m = mom();
    if (m === 'table') return '식탁의 엄마. 엎어 둔 휴대전화 옆에 물 한 컵.';
    if (m === 'lv') return CAP_TABLE_LV();
    return '식탁이 비어 있다. 물컵 하나.';
  }

  /* ---------- rects ---------- */
  const RECT = {
    door: { x: 0.37, y: 0.32, w: 0.21, h: 0.30 }, panel: { x: 0.515, y: 0.425, w: 0.075, h: 0.09 },
    shoes: { x: 0.165, y: 0.44, w: 0.135, h: 0.10 }, hook: { x: 0.295, y: 0.37, w: 0.07, h: 0.13 },
    mat: { x: 0.37, y: 0.622, w: 0.24, h: 0.075 }, srdoor: { x: 0.775, y: 0.08, w: 0.225, h: 0.47 },
    kongiSleep: { x: 0.50, y: 0.69, w: 0.275, h: 0.17 }, kongiDoor: { x: 0.35, y: 0.52, w: 0.20, h: 0.16 },
    veranda: { x: 0.16, y: 0.29, w: 0.78, h: 0.46 },
    jimin: { x: 0.0, y: 0.53, w: 0.54, h: 0.22 }, frames: { x: 0.71, y: 0.62, w: 0.24, h: 0.11 },
    clock: { x: 0.745, y: 0.25, w: 0.11, h: 0.09 }, outlet: { x: 0.915, y: 0.70, w: 0.085, h: 0.10 },
    mom: { x: 0.44, y: 0.34, w: 0.27, h: 0.47 }, tableMom: { x: 0.71, y: 0.44, w: 0.19, h: 0.18 },
    tableEmpty: { x: 0.37, y: 0.44, w: 0.52, h: 0.20 }, stove: { x: 0.30, y: 0.34, w: 0.14, h: 0.10 },
    calendar: { x: 0.735, y: 0.20, w: 0.11, h: 0.19 },
    orgel: { x: 0.595, y: 0.325, w: 0.195, h: 0.07 }, manual: { x: 0.225, y: 0.42, w: 0.10, h: 0.085 },
    drawing: { x: 0.325, y: 0.495, w: 0.125, h: 0.055 },
    frame: { x: 0.395, y: 0.15, w: 0.10, h: 0.58 }, bed: { x: 0.47, y: 0.53, w: 0.53, h: 0.25 },
    window: { x: 0.79, y: 0.14, w: 0.21, h: 0.23 }, srout: { x: 0.13, y: 0.11, w: 0.265, h: 0.50 },
    momBed: { x: 0.60, y: 0.38, w: 0.33, h: 0.42 },
  };

  /* ---------- views (index·90° = §7.1.2 yaw · r3_door camera +6° · sr 0° / 180°) ---------- */
  const lvViews = [
    { id: 'r3_door', yaw: 0, cam: 6, key: 'r3_door', w: 1024, h: 1536,
      layers: [
        { id: 'hook', key: () => (st('collar') === 'gone' ? 'x3_hook_empty' : null), enter: 'f', exit: 'f', ms: 600 },
        { id: 'kongi', key: () => ({ sleep: 'x3_kongi_sleep', door: 'x3_kongi_door' })[st('kongi')] || null, enter: 'f', exit: 'f', ms: 800,
          swapMs: (a, b) => (b === 'x3_kongi_door' ? 400 : 600) },
        { id: 'momHall', key: () => (mom() === 'hall' ? 'x3_mom_hall' : null), enter: 'r', exit: 'l', ms: 800, shadow: 'hall_q' },
      ],
      fx: ['led', 'srspill', 'spill'],
      spots: [
        { id: 'door', rect: RECT.door, caption: (c) => (!c.eye && f('M6') ? '도어락 안쪽 패널. 초록 불빛.' : '현관. 도어락 안쪽 패널에 작은 초록 불빛.'),
          closeup: 'c3_lockpanel', closeupWhen: (c) => !c.eye && f('M6') },
        { id: 'shoes', rect: RECT.shoes, caption: '신발장 위에 분홍 실내화 한 켤레.' },
        { id: 'mat', rect: RECT.mat, caption: '현관 매트 옆, 비어 있는 작은 방석.' },
        { id: 'hook', rect: RECT.hook, caption: '신발장 옆 고리에 분홍 목줄. 작은 방울이 달려 있다.', flag: 'collarSeen',
          closeup: 'c3_shoes', closeupWhen: (c) => !c.eye },
        { id: 'panel', rect: RECT.panel, when: (c) => !c.eye, caption: '도어락 안쪽 패널. 초록 불빛.', closeup: 'c3_lockpanel' },
        { id: 'kongi', rect: () => (st('kongi') === 'sleep' ? RECT.kongiSleep : st('kongi') === 'door' ? RECT.kongiDoor : null),
          caption: () => (st('kongi') === 'door' ? '콩이가 현관문 앞에 서서 문을 보고 있다. 꼬리가 내려가 있다.' : '콩이가 고개를 든다. 꼬리가 바닥을 두 번 친다.'),
          flag: () => (f('M6') ? null : 'kongiTail0'), cue: () => (st('kongi') === 'door' ? null : 'kongi.tail'), src: 'kongiSr' },
        { id: 'srdoor', go: 'sr', rect: RECT.srdoor, caption: srdoorCap, aria: '세아 방' },
      ] },
    { id: 'r3_veranda', yaw: 90, key: 'r3_veranda', w: 1024, h: 1536, fx: ['boiler', 'wins', 'spill'],
      spots: [{ id: 'veranda', rect: RECT.veranda, caption: '베란다 너머, 건너편 동의 창이 다 꺼져 있다.' }] },
    { id: 'r3_sofa', yaw: 180, key: 'r3_sofa', w: 1024, h: 1536,
      layers: [{ id: 'jimin', key: () => (st('jimin') === 'sleep' ? 'x3_jimin_sleep' : null), enter: 'l', exit: 'l', ms: 800 }],
      fx: ['clock', 'spill'],
      spots: [
        { id: 'jimin', rect: RECT.jimin, caption: () => (st('jimin') === 'sleep' ? ['소파에서 지민이 잔다. 담요가 반쯤 흘러내렸다.', '지민은 깊이 잠들어 있다.']
          : '소파가 비어 있다. 팔걸이에 담요 하나가 개어져 있다.') },
        { id: 'frames', rect: RECT.frames, caption: 'TV장 위 액자 셋. 콩이, 콩이, 교복 입은 뒷모습.' },
        { id: 'clock', rect: RECT.clock, caption: '{h}시 {mm}분.' },
        { id: 'outlet', rect: RECT.outlet, caption: '내 폰은 콘센트에서 충전 중이다.' },
      ] },
    { id: 'r3_kitchen', yaw: 270, key: () => (st('kitchenLight') ? 'r3_kitchen_lit' : 'r3_kitchen'), w: 1024, h: 1536,
      fb: { r3_kitchen_lit: ['r3_kitchen', 'brightness(1.5) contrast(.9)'] },
      layers: [
        { id: 'phone', key: () => (st('phoneGlow') === 'off' && !f('handover') && !f('gotPhone') ? 'x3_phone_down' : null), enter: 'f', exit: 'f', ms: 300 },
        { id: 'mom', key: () => (atTable() ? (st('kitchenLight') ? 'x3_mom_table_lit' : 'x3_mom_table') : null), enter: 'r', exit: 'r', ms: 800, swapMs: () => 1200 },
        { id: 'kongi', key: () => (st('kongi') === 'feet' ? 'x3_kongi_feet' : null), enter: 'f', exit: 'f', ms: 800 },
      ],
      fx: ['cal', 'phoneglow', 'steam'],
      spots: [
        { id: 'table', rect: () => (f('M8') ? null : atTable() ? RECT.tableMom : RECT.tableEmpty), caption: tableCap },
        { id: 'stove', rect: RECT.stove, caption: '가스레인지 위에 냄비 하나. 미역국이다.', flag: 'soupSeen0' },
        { id: 'calendar', rect: RECT.calendar, caption: '벽 달력. 1월 24일에 빨간 동그라미.', flag: 'calSeen0' },
        // M0 / M1: flow scenes answers room:spot 'mom' (cards) — the room draws nothing for that tap (§4.1.2)
        { id: 'mom', rect: () => (atTable() && !f('M8') ? RECT.mom : null),
          caption: (c) => {
            if (mom() !== 'lv' || !f('M6') || f('M7')) return null;
            if (c.n('momLv') === 1) return { who: '엄마', text: '…괜찮아요. 콩이가 있잖아요.' };   // §4.9.1 ⊕ (04:41–05:05)
            return CAP_TABLE_LV();
          } },
      ] },
  ];
  const srViews = [
    { id: 'r3_sr_desk', yaw: 0, key: () => (lit() ? 'r3_sr_desk' : 'r3_sr_desk_dim'), w: 1024, h: 1536,
      fb: { r3_sr_desk_dim: ['r3_sr_desk', 'brightness(.42)'] },
      spots: [
        { id: 'orgel', rect: RECT.orgel, caption: '책장 가운데, 작은 레이스 받침이 비어 있다.', closeup: 'c3_orgel_spot', flag: 'orgelSpotSeen' },
        { id: 'manual', rect: RECT.manual, caption: '오르골 설명서. 뒷면에 곡의 첫 두 마디가 인쇄돼 있다.', closeup: 'c3_manual', flag: 'manualSeen' },
        { id: 'drawing', rect: RECT.drawing, caption: '어버이날 그림. 다섯 번째 음표만 높이 그려져 있다.', closeup: 'c3_drawing', flag: 'drawingSeen' },
      ] },
    { id: 'r3_sr_bed', yaw: 180, key: () => (lit() ? 'r3_sr_bed' : 'r3_sr_bed_dim'), w: 1024, h: 1536,
      fb: { r3_sr_bed_dim: ['r3_sr_bed', 'brightness(.42)'] },
      layers: [{ id: 'mom', key: () => (mom() === 'sr' ? (lit() ? 'x3_mom_bed' : 'x3_mom_bed_dim') : null), enter: 'l', exit: 'l', ms: 800, swapMs: () => 1200 }],
      spots: [
        { id: 'frame', rect: RECT.frame, caption: '문틀에 연필 줄이 촘촘하다.', closeup: 'c3_doorframe', flag: 'heightSeen' },
        { id: 'bed', rect: RECT.bed, caption: '작은 침대. 이불이 반듯하게 개어져 있다.' },
        { id: 'window', rect: RECT.window, caption: '창밖은 아직 어둡다.' },
        { id: 'srout', go: 'lv', rect: RECT.srout, caption: '세아 방 문. 거실이 보인다.', aria: '거실' },
        { id: 'mom', rect: () => (mom() === 'sr' ? RECT.momBed : null),
          caption: (c) => {
            if (!f('M7')) return '엄마는 침대 끝에 앉아 두 손을 무릎에 올려 두고 있다.';
            if (!f('memoryStart') && c.n('momSr') === 1) return { who: '엄마', text: '세아 방은 그대로 뒀어요.' };   // §4.9.2 ⊕
            return '엄마는 침대 끝에 앉아 있다.';
          } },
      ] },
  ];

  /* ---------- close-ups (§2.6 · §8.3-5/-6 · §9.8 — DOM fallbacks for manual / drawing / doorframe are mandatory) ---------- */
  const closeups = {
    c3_lockpanel: { key: 'c3_lockpanel', w: 1024, h: 1536, fit: 'contain', yaw: 0, ref: 'ref_lock', led: () => meta('c3_lockpanel', 'led_lock', { x: 0.508, y: 0.614 }),
      spots: [{ id: 'handle', rect: { x: 0.12, y: 0.68, w: 0.46, h: 0.10 }, caption: '현관문은 잠겨 있다.' }] },   // §4.9.1 ⊕ (문 손잡이)
    c3_shoes: { key: () => (st('collar') === 'gone' ? 'c3_shoes_nocollar' : 'c3_shoes'), w: 1024, h: 1536, fit: 'contain', yaw: 0, ref: 'ref_shoes',
      fb: { c3_shoes_nocollar: ['c3_shoes', ''] } },
    c3_orgel_spot: { key: 'c3_orgel_spot', w: 1024, h: 1024, fit: 'cover', focus: { x: 0.5, y: 0.55 }, yaw: 0, ref: 'ref_shelf' },
    c3_manual: { key: 'c3_manual', w: 1024, h: 1536, fit: 'contain', yaw: 0, dom: 'manual', paper: '#efe6cf' },
    c3_drawing: { key: 'c3_drawing', w: 1024, h: 1536, fit: 'contain', yaw: 0, dom: 'drawing', paper: '#ece2c6',
      flip: { caption: '뒷면에 엄마 글씨.', closeup: 'c3_drawing_back', flag: 'drawingBack' } },
    c3_drawing_back: { key: 'c3_drawing_back', w: 1024, h: 1536, fit: 'contain', yaw: 0, dom: 'drawingBack', paper: '#e9dfc4',
      flip: { caption: '어버이날 그림. 다섯 번째 음표만 높이 그려져 있다.', closeup: 'c3_drawing' } },
    c3_doorframe: { key: 'c3_doorframe', w: 1024, h: 1536, fit: 'contain', yaw: 200, dom: 'doorframe', domOnlyOnFail: true },
    c3_phone_ring: { key: () => (st('kitchenLight') ? 'c3_phone_ring_lit' : 'c3_phone_ring'), w: 1024, h: 1024, fit: 'cover', focus: { x: 0.39, y: 0.68 }, yaw: 270,
      fb: { c3_phone_ring_lit: ['c3_phone_ring', 'brightness(1.35)'] }, screen: 'ring_q' },
    c3_phone_ring_lit: { key: 'c3_phone_ring_lit', w: 1024, h: 1024, fit: 'cover', focus: { x: 0.39, y: 0.68 }, yaw: 270, fb: { c3_phone_ring_lit: ['c3_phone_ring', 'brightness(1.35)'] }, screen: 'ring_q' },
    c3_mom_hands: { key: 'c3_mom_hands', w: 1024, h: 1024, fit: 'cover', focus: { x: 0.5, y: 0.5 }, yaw: 270, ref: 'ref_table' },
    c3_pot: { key: () => (st('kitchenLight') ? 'c3_pot_lit' : 'c3_pot'), w: 1024, h: 1024, fit: 'cover', focus: { x: 0.6, y: 0.52 }, yaw: 270,
      fb: { c3_pot_lit: ['c3_pot', 'brightness(1.5) contrast(.9)'] }, flame: true, steam: true, ref: 'ref_stove' },
    c3_window: { key: 'c3_window', w: 1024, h: 1536, fit: 'cover', yaw: 90, ref: 'ref_glass' },
  };

  G.ROOM = {
    v: 3,
    img(k) {
      if (!k) return '';
      try { if (G.e3 && typeof G.e3.img === 'function') { const u = G.e3.img(k); if (u) return u; } } catch (e) {}
      return (G.IMG && G.IMG[k]) || '';
    },
    has(k) { return !!(k && G.IMG && G.IMG[k]); },
    meta,
    rooms: { lv: { listener: 'L0', views: lvViews }, sr: { listener: 'LS', views: srViews } },
    closeups,
    /** §3.13 · §4.9.2 · §8.3-6 — the clue text drawn as DOM (identical strings to DESIGN; positions from G.IMGMETA when present) */
    text: {
      drawing: { title: '내 노래', wrong: '틀린 음!', sig: '윤세아 1학년 3반 · 2008. 5. 8' },
      drawingBack: ['세아가 어버이날에 그려 준 거', '다섯째 음을 일부러 틀림 — "엄마 나 괜찮아"래'],
      manual: { print: '태엽은 끝까지 감지 마세요.', notes: ['E5', 'A5', 'C6', 'B5', 'A5', 'E5'] },
      doorframe: [['7 · 09.1.24', 'mom'], ['8 · 10.1.24', 'mom'], ['9 · 11.1.24', 'mom'], ['10 · 12.1.24', 'mom'], ['11 · 13.1.24', 'mom'],
        ['ㅅㅇ 12 · 14.1.24', 'sea'], ['ㅅㅇ 13 · 15.1.24', 'sea'], ['ㅅㅇ 14 · 16.1.24', 'sea'], ['ㅅㅇ 15 · 17.1.24', 'sea'],
        ['ㅅㅇ 16 · 18.1.24', 'sea'], ['ㅅㅇ 17 · 19.1.24', 'sea'], ['ㅅㅇ 18 · 20.1.24', 'sea']],
      calendar: { year: '2027', month: '1', week: ['일', '월', '화', '수', '목', '금', '토'], first: 5, days: 31, circle: 24, note: '우리 딸', red: [1] },
    },
    hand: { mom: "'Nanum Brush Script', cursive", sea: "'Gamja Flower', cursive" },   // §8.3-6 손 규칙 · §0.3 D30 (his pen face 0)
  };
})();
