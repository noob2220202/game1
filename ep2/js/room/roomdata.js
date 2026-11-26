/* =========================================================
 * 하루를 위한 방탈출! 2 — room data (ep2/js/room/roomdata.js · owner: room)
 * G.ROOM = the 601 rooftop studio and its roof, as seen through 방 보기 (camera app) and the eye views.
 * DESIGN §2.6 (anchors) · §3.1 (box chain) · §3.8 (new phone) · §3.15 L1–L8 · §4.7.6 captions (verbatim) ·
 * §4.7.7 new-phone screens · §6.3 matrix · §7.1.2 yaw · §8.3-2/-3/-9 · ARCH §5.20.
 *
 * Coordinates: FRACTIONS (0–1) of the image they sit on (views 1024×1536, plate/rail 1536×1024, squares 1024²).
 * Measured values come from G.IMGMETA (assets agent, ARCH §5.1) with the fallbacks below when a key is missing.
 * Hotspot rects were measured on the shipped images (same method as ep1).
 *
 * Data only — no cross-owner call runs at load time. Every string is DESIGN text (⊕ included) and is expanded with
 * G.T at render time by engine/room/room.js. Lines he wrote carry his:true (ledger — §3.20.3).
 *
 * G.ROOM = {
 *   img(key) → url · has(key) → bool · meta(key, fallback) · world() → state snapshot (snow, light, …)
 *   views: [{ id, az, key, w, h, mask?, outside?, hotspots:[…] }]        order = [r2_door, r2_window, r2_bed, r2_desk]
 *   subs:  { roof_tank, roof_rail, rail_window }                         window telephoto sub-views (§8.3-2)
 *   closeups: { p2_door_open, box, note_card, polaroid, landlord, peephole, doorlock, newphone }
 *   cap: { … }   §4.7.6 captions (strings or lazy functions)
 * }
 * hotspot: { id, x, y, w, h, coord:'plate'?, when()?, cap?, open?, sub?, act? }
 *   cap  = caption key in G.ROOM.cap · open = closeup id · sub = sub-view id · act = engine action name
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* ---------------- tiny guarded readers (never throw, never call other owners at load) ---------------- */
  const flag = (f) => { try { return !!(G.flag && G.flag(f)); } catch (e) { return false; } };
  const V = (k) => { try { const s = G.state && G.state.vars; return s ? s[k] : undefined; } catch (e) { return undefined; } };
  const META = (k, fb) => { const m = G.IMGMETA; return (m && m[k] != null) ? m[k] : fb; };

  const PNG = /^(p_|js_|m_|door_handle|icon|r2_window_mask)/;
  function img(key) {
    if (!key) return '';
    try { if (G.e2 && typeof G.e2.img === 'function') { const u = G.e2.img(key); if (u) return u; } } catch (e) {}
    if (G.IMG && G.IMG[key]) return G.IMG[key];
    return 'assets/img/' + key + (PNG.test(key) ? '.png' : '.jpg');
  }
  /** is this key known? (when the registry exists only registered keys are requested → no 404 noise) */
  function has(key) { return !!key && (!G.IMG || !!G.IMG[key]); }

  /* ---------------- in-game clock helpers (core G.clock; fallbacks for partial builds) ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowDate() { try { return G.clock && G.clock.now ? G.clock.now() : new Date(2026, 11, 24, 23, 10); } catch (e) { return new Date(2026, 11, 24, 23, 10); } }
  function hm() {
    try { if (G.clock && typeof G.clock.hm === 'function') return G.clock.hm(); } catch (e) {}
    const d = nowDate(); return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /** minutes on the 12-24 00:00 scale (HH < 12 ⇒ next day) — same rule as core G.clock.toMin */
  function toMin(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return 0; const h = +m[1]; return (h < 12 ? 24 + h : h) * 60 + (+m[2]); }
  function passed(t) {
    try { if (G.clock && typeof G.clock.passed === 'function') return !!G.clock.passed(t); } catch (e) {}
    return toMin(hm()) >= toMin(t);
  }
  function fmt12(t) {
    try { if (G.e2 && typeof G.e2.fmt12 === 'function') return G.e2.fmt12(t); } catch (e) {}
    const m = /^(\d{1,2}):(\d{2})/.exec(t || '00:00'); const h = +m[1];
    return (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + ':' + m[2];
  }

  /* ---------------- world state (§3.15 L1–L8 · §8.3-3) ---------------- */
  function snow() {
    const s = V('snow');
    if (typeof s === 'number') return Math.max(0, Math.min(2, s));
    if (!flag('M0')) return 0;
    return passed('00:20') ? 2 : passed('23:50') ? 1 : 0;     // core owns vars.snow; this is the partial-build fallback
  }
  /** L2 옥상등 — roofLight flag (climax), with a clock fallback when climax is absent */
  function roofLightOn() {
    if (flag('roofLight')) return true;
    if (G.climax) return false;
    return !passed('00:22') || passed('00:50');
  }
  function taped() { return flag('peepholeTaped') && !flag('doorOpened'); }
  function footprints() { const f = V('footprints'); return typeof f === 'number' ? f : (flag('doorOpened') ? 2 : flag('M7') ? 1 : 0); }
  function ledState() { const l = V('ledState'); return l === 'blue' || l === 'off' ? l : 'green'; }
  function lureCount() { const n = V('lureCount'); return typeof n === 'number' ? n : 0; }
  function cl() { return V('climax') || {}; }
  /** M7 police lights (L7) 00:36–00:50 */
  function policeOn() { return flag('M7') && !passed('00:50') && !flag('doorOpened'); }
  /** B16 reached the tank door (police opened it) */
  function tankOpened() { return !!cl().b16Done || passed('01:10') || flag('M8'); }
  /** the room ceiling light (L8) */
  function lit() { return flag('doorOpened'); }
  /** plate/telephoto state suffix */
  function plateState() { return roofLightOn() ? ['s0', 's1', 's2'][snow()] : 's2d'; }

  function world() {
    return { snow: snow(), light: roofLightOn(), taped: taped(), footprints: footprints(), led: ledState(), police: policeOn(),
      tankOpened: tankOpened(), lit: lit(), plate: plateState(), hm: hm() };
  }

  /* ---------------- §4.7.6 captions (verbatim) ---------------- */
  const RAIL = '난간 너머 한 층 낮은 옆 건물 옥상. 그 아래 2층 창은 불이 꺼져 있다. ';
  const cap = {
    door: '현관 철문. 안에서 잠겨 있다.',
    lock: () => (flag('M6') && !flag('M7') ? '붉은 불이 깜박인다.' : '숫자식 도어락. 이사 날 새로 달았다.'),
    peephole: () => (taped() ? '아무것도 보이지 않는다.' : '눈 내리는 옥상 바닥.'),
    box: '상자. 받는 사람: 601호 {N}.',
    landlord: '5층 주인이 붙여 둔 쪽지.',
    window: () => ['창 너머 옥상. 눈이 흩날린다.', '창 너머 옥상. 눈이 얇게 쌓였다.', '창 너머 옥상. 눈이 소복이 쌓였다.'][snow()],
    tank: () => {
      if (passed('01:10') || flag('M8')) return '녹슨 철문이 열려 있다.';
      if (cl().b16Done) return '녹슨 철문이 열려 있다. 손전등 불빛이 안을 비춘다.';
      return "녹슨 철문. 바랜 글씨로 '물탱크실'. 자물쇠는 걸쳐만 있다. 문틈이 손가락 하나만큼 벌어져 있다.";
    },
    stairs: () => (roofLightOn() ? '계단 입구. 옥상등이 켜져 있다.' : '계단 입구. 옥상등이 꺼져 있다.'),
    rail: () => {
      const l = ledState();
      if (l === 'off') return RAIL + '창가의 불빛이 꺼져 있다.';
      return RAIL + (l === 'blue' ? '창가에 쌀알만 한 파란 불빛.' : '창가에 쌀알만 한 초록 불빛.');
    },
    steps: () => {
      if (!flag('doorOpened') && !passed('01:10')) return '눈 위에 발자국이 한 줄로 오갔다.';
      return (flag('C2') || lureCount() >= 1) ? '눈 위에 발자국. 난간 쪽으로도 여러 번 오갔다.' : '눈 위에 발자국. 한 줄은 난간 쪽으로 나 있다.';
    },
    bed: '침대. 이불이 개어져 있다.',
    boxes: '아직 풀지 않은 상자 두 개.',
    clock: () => '벽시계. ' + fmt12(hm()) + '.',
    sink: '작은 싱크대. 수도꼭지에서 물이 가늘게 떨어진다.',
    newphone: '새 폰. 충전 중이다.',
    mug: '머그컵. 식었다.',
    phoneCase: '새 투명 젤리 케이스. 안엔 아무것도 없다.',
  };

  /* ---------------- measured geometry (IMGMETA first) ---------------- */
  const GEO = {
    glass: () => META('glass_q', [[0.2852, 0.2956], [0.7764, 0.3021], [0.7734, 0.5352], [0.2832, 0.5378]]),
    panes: () => META('glass_panes', null),
    tankRect: () => META('tank_rect', { x: 0.14, y: 0.175, w: 0.28, h: 0.63 }),
    railRect: () => META('rail_rect', { x: 0.55, y: 0.27, w: 0.45, h: 0.45 }),
    railwinRect: () => META('railwin_rect', { x: 0.6, y: 0.45, w: 0.3, h: 0.45 }),
    /** plate door rect ↔ roof_tank door rect (the telephoto is a re-shoot — map door to door, meta tank_door_map) */
    tankMap: () => META('tank_door_map', { plate: { x: 0.207, y: 0.245, w: 0.145, h: 0.49 }, tank: { x: 0.235, y: 0.11, w: 0.533, h: 0.822 } }),
    gapPlate: () => (META('gap_tank', {}).plate) || [[0.346, 0.255], [0.353, 0.255], [0.353, 0.733], [0.346, 0.733]],
    gapTank: () => (META('gap_tank', {}).tank) || [[0.768, 0.115], [0.791, 0.115], [0.791, 0.93], [0.768, 0.93]],
    ledLock: () => META('led_lock', { x: 0.537, y: 0.462 }),
    ledLockCu: () => META('led_lock_cu', { x: 0.428, y: 0.418 }),
    ledRail: () => META('led_rail', { x: 0.675, y: 0.94 }),
    ledRailwin: () => META('led_railwin', { x: 0.305, y: 0.568 }),
    doorGap: () => META('door_gap', [[0.517, 0.262], [0.836, 0.262], [0.836, 0.74], [0.517, 0.74], [0.517, 0.262]]),
    clockBed: () => META('clock_bed', { cx: 0.528, cy: 0.297, r: 0.0445 }),
    npDesk: () => META('np_desk_q', [[0.7627, 0.5742], [0.7939, 0.5801], [0.8008, 0.5853], [0.7617, 0.5768]]),
    npCu: () => META('np_cu_q', [[0.3896, 0.1875], [0.7568, 0.2083], [0.6465, 0.7721], [0.2383, 0.735]]),
    boxPhone: () => META('box_phone_q', [[0.4453, 0.4154], [0.5986, 0.4206], [0.6172, 0.6289], [0.4385, 0.6302]]),
    lidName: () => META('lid_name_q', [[0.5032, 0.6994], [0.6464, 0.7023], [0.6481, 0.7301], [0.5002, 0.7271]]),
    lidNameLifted: () => META('lid_name_q_lifted', META('lid_name_q', [[0.5032, 0.6994], [0.6464, 0.7023], [0.6481, 0.7301], [0.5002, 0.7271]])),
    peepDisc: () => META('peephole_disc', { cx: 0.5134, cy: 0.532, r: 0.3967 }),
    beamOrigin: () => META('beam_origin', { x: 0.06, y: 0.58 }),
    handlePivot: () => META('handle_pivot', { x: 0.428, y: 0.78 }),
    /** the lock panel on r2_door (drill tremble crop) */
    lockPanel: { x: 0.519, y: 0.448, w: 0.04, h: 0.078 },
  };

  /* ---------------- views (index·90° = §7.1.2 yaw) ---------------- */
  const views = [
    /* ---------------- 0° 현관 ---------------- */
    { id: 'r2_door', az: 0, key: 'r2_door', w: 1024, h: 1536,
      handleKey: 'door_handle_r2',
      hotspots: [
        { id: 'door', x: 0.505, y: 0.262, w: 0.325, h: 0.48, cap: 'door', when: () => flag('M0') },
        { id: 'box', x: 0.112, y: 0.505, w: 0.247, h: 0.092, cap: 'box', open: 'box', when: () => flag('gotPhone') },
        { id: 'landlord', x: 0.53, y: 0.378, w: 0.125, h: 0.09, cap: 'landlord', open: 'landlord' },
        { id: 'peephole', x: 0.645, y: 0.377, w: 0.03, h: 0.026, cap: 'peephole', open: 'peephole' },
        { id: 'lock', x: 0.515, y: 0.446, w: 0.07, h: 0.08, cap: 'lock', open: 'doorlock' },
      ],
      /** M0 eye view (cold open): the whole door opens it — nothing else is a hotspot (§3.1, §4.7.6 'M0 전') */
      m0Spots: [{ id: 'door', x: 0.505, y: 0.262, w: 0.325, h: 0.48, act: 'openDoorM0' }],
      /** M8 eye view: the handle is the only hotspot (§3.17 B20 — no floating button, no text) */
      handleSpots: [{ id: 'handle', x: 0.515, y: 0.492, w: 0.08, h: 0.042, act: 'handle' }],
    },
    /* ---------------- 90° 창 ---------------- */
    { id: 'r2_window', az: 90, key: 'r2_window', w: 1024, h: 1536, mask: 'r2_window_mask', refl: 'p_win_refl',
      outside: {
        w: 1536, h: 1024, margin: 0.0,
        plate: () => 'roof_plate_' + plateState(),
        /** §9.8: a missing plate state degrades to the nearest one (+ brightness for s2d) */
        plateFallback: { roof_plate_s2d: ['roof_plate_s2', 0.3], roof_plate_s2: ['roof_plate_s1', 1], roof_plate_s1: ['roof_plate_s0', 1] },
        steps: { dark: 'p_steps1_d', lit: 'p_steps1', two: 'p_steps2' },
        ajar: { dark: 'p_tank_ajar_plate', lit: 'p_tank_ajar_plate_lit' },
        glow: { light: 'p_tank_glow_plate', hand: 'js_tank_hand_plate', cap: 'js_tank_cap_plate' },
      },
      hotspots: [
        { id: 'window', x: 0.283, y: 0.296, w: 0.493, h: 0.242, cap: 'window' },
        { id: 'stairs', coord: 'plate', x: 0.0, y: 0.1, w: 0.135, h: 0.72, cap: 'stairs' },
        { id: 'steps', coord: 'plate', x: 0.02, y: 0.735, w: 0.5, h: 0.265, cap: 'steps', when: () => footprints() >= 1 },
        { id: 'tank', coord: 'plate', x: 0.2, y: 0.235, w: 0.165, h: 0.51, cap: 'tank', sub: 'roof_tank' },
        { id: 'rail', coord: 'plate', x: 0.62, y: 0.36, w: 0.38, h: 0.6, cap: 'rail', sub: 'roof_rail' },
      ],
    },
    /* ---------------- 180° 침대 ---------------- */
    { id: 'r2_bed', az: 180, key: 'r2_bed', w: 1024, h: 1536, wallClock: true,
      hotspots: [
        { id: 'bed', x: 0.075, y: 0.525, w: 0.68, h: 0.225, cap: 'bed' },
        { id: 'boxes', x: 0.024, y: 0.596, w: 0.262, h: 0.205, cap: 'boxes' },
        { id: 'clock', x: 0.48, y: 0.265, w: 0.095, h: 0.064, cap: 'clock' },
      ],
    },
    /* ---------------- 270° 책상 ---------------- */
    { id: 'r2_desk', az: 270, key: 'r2_desk', w: 1024, h: 1536, newPhone: true,
      hotspots: [
        { id: 'sink', x: 0.17, y: 0.47, w: 0.21, h: 0.095, cap: 'sink' },
        { id: 'mug', x: 0.687, y: 0.552, w: 0.046, h: 0.032, cap: 'mug' },
        { id: 'newphone', x: 0.755, y: 0.566, w: 0.052, h: 0.026, cap: 'newphone', open: 'newphone' },
      ],
    },
  ];

  /* ---------------- window telephoto sub-views (§8.3-2) — zoom of the same view, back = 1× ---------------- */
  const subs = {
    roof_tank: { id: 'roof_tank', parent: 'r2_window', az: 70, w: 1024, h: 1536, enterZ: 2, maxZ: 6, focus: { x: 0.5, y: 0.46 },
      key: () => 'roof_tank_' + plateState(),
      fallback: { roof_tank_s2d: ['roof_tank_s2', 0.3], roof_tank_s2: ['roof_tank_s1', 1], roof_tank_s1: ['roof_tank_s0', 1] },
      steps: { dark: 'p_steps1_tank_d', lit: 'p_steps1_tank' },
      ajar: { dark: 'p_tank_ajar', lit: 'p_tank_ajar_lit' },
      glow: { light: 'p_tank_glow', hand: 'js_tank_hand', cap: 'js_tank_cap' },
      hotspots: [
        { id: 'tank', x: 0.2, y: 0.08, w: 0.62, h: 0.86, cap: 'tank' },
        { id: 'steps', x: 0.0, y: 0.94, w: 1, h: 0.06, cap: 'steps', when: () => footprints() >= 1 },
      ] },
    roof_rail: { id: 'roof_rail', parent: 'r2_window', az: 115, w: 1536, h: 1024, enterZ: 2, maxZ: 6, focus: { x: 0.66, y: 0.86 },
      key: () => 'roof_rail_' + plateState(),
      fallback: { roof_rail_s2d: ['roof_rail_s2', 0.3], roof_rail_s2: ['roof_rail_s1', 1], roof_rail_s1: ['roof_rail_s0', 1] },
      led: () => GEO.ledRail(), ledPx: 4,
      railSteps: 'p_rail_steps',
      hotspots: [{ id: 'rail', x: 0.0, y: 0.32, w: 1, h: 0.68, cap: 'rail' }] },
    rail_window: { id: 'rail_window', parent: 'roof_rail', az: 115, w: 1024, h: 1024, enterZ: 5, maxZ: 8,
      key: () => 'rail_window_' + plateState(),
      fallback: { rail_window_s2d: ['rail_window_s2', 0.3], rail_window_s2: ['rail_window_s1', 1], rail_window_s1: ['rail_window_s0', 1] },
      led: () => GEO.ledRailwin(), ledPx: 9,
      hotspots: [{ id: 'rail', x: 0, y: 0, w: 1, h: 1, cap: 'rail' }] },
  };

  /* ---------------- close-ups (§2.6 — eight + the box states) ---------------- */
  const closeups = {
    /** M0 only: the door 30 cm open, the box on the snowy threshold (caption 0) */
    p2_door_open: { key: 'p2_door_open', w: 1024, h: 1536, fit: 'cover', snow: true, noBack: true, yaw: 0,
      spots: [{ id: 'box', x: 0.455, y: 0.66, w: 0.14, h: 0.12, open: 'box' }] },
    /** the box — M0 on the roof floor (phone in it) / later on the shoe cabinet (phone taken) */
    box: { w: 1024, h: 1536, fit: 'cover', yaw: 0, maxZ: 3,
      key: (st) => (st.m0 ? (st.lifted ? 'box_top_lifted' : 'box_top') : 'box_top_lifted_in'),
      fallbackKey: (st) => (st.m0 ? 'box_top' : 'box_top_in'),
      lid: { x: 0.205, y: 0.668, w: 0.61, h: 0.15, zoomTo: { x: 0.43, y: 0.72, z: 2.6 } },
      /* measured on box_top (the card shows on both sides of the phone; the polaroid corner bottom-left) */
      spotsPhone: [
        { id: 'note', x: 0.638, y: 0.462, w: 0.056, h: 0.206, open: 'note_card' },
        { id: 'note', x: 0.37, y: 0.462, w: 0.042, h: 0.098, open: 'note_card' },
        { id: 'polaroid', x: 0.305, y: 0.56, w: 0.07, h: 0.098, open: 'polaroid' },
        { id: 'phone', x: 0.412, y: 0.372, w: 0.226, h: 0.288, act: 'pickPhone' },
        { id: 'lid', x: 0.205, y: 0.668, w: 0.61, h: 0.15, act: 'lid' },
      ],
      /* measured on box_top_lifted (phone taken: the card and the polaroid under it) */
      spotsLifted: [
        { id: 'polaroid', x: 0.316, y: 0.553, w: 0.138, h: 0.117, open: 'polaroid' },
        { id: 'note', x: 0.458, y: 0.466, w: 0.236, h: 0.204, open: 'note_card' },
        { id: 'lid', x: 0.205, y: 0.668, w: 0.61, h: 0.15, act: 'lid' },
      ],
      /** the phone's screen inside the box (measured — meta box_phone_q starts below the notch) */
      phoneQuad: [[0.43, 0.388], [0.619, 0.388], [0.62, 0.636], [0.429, 0.636]],
      /** the alarm on the phone screen inside the box (§3.1 ③ · §4.7.1 strings) */
      alarm: { time: '오후 11:10', title: '문 앞', playing: '♪ 우리' } },
    /** the card: front '돌려줄게. —' (his — ledger #1) · back = the ep1 admin-card form (§3.1 ②) */
    note_card: { w: 1024, h: 1024, fit: 'contain', yaw: 0, maxZ: 3,
      front: 'note_card_front', back: 'note_card_back',
      frontText: { text: '돌려줄게. —', his: true },
      backText: ['현관 도어락 관리자 카드', '관리자 비밀번호'] },
    /** polaroid_601 — no writing front or back (§3.1 ④), pinch 1–3× */
    polaroid: { w: 1024, h: 1536, fit: 'contain', yaw: 0, maxZ: 3, front: 'polaroid_601', back: 'polaroid_601_back' },
    /** the landlord's note + the older yellow sticky (§3.16 · §4.7.6 — DOM fallback is mandatory, §9.8) */
    landlord: { key: 'landlord_note', w: 1024, h: 1024, fit: 'contain', yaw: 0, maxZ: 4, cap: 'landlord',
      domFallback: ['601호에게', '24일부터 27일까지 아들네 다녀와요.', '4층은 여행 가고 3층은 아직 비어 있어요.', '1층 2층 가게도 연휴엔 문 닫는대요.',
        '옆 건물 2층이 몇 달째 비어 있는데', '밤에 소리 나거나 불빛 보이면 112에 신고하래요.', '수도 얼지 않게 조금씩 틀어 두세요.', '— 5층 주인  12.18'],
      sticky: ['옥탑 Wi-Fi', 'saemal_rooftop', '비밀번호 saemal0601', '12.10'] },
    /** 외시경 (L1 · L3) */
    peephole: { w: 1024, h: 1024, fit: 'contain', yaw: 0, maxZ: 2, cap: 'peephole', snow: true,
      key: () => (taped() ? 'peep_tape' : flag('doorOpened') ? 'peephole_s2' : 'peephole_s' + snow()) },
    /** 도어락 안쪽 패널 + 손잡이 2프레임 (표시 문구 0 — LED만) */
    doorlock: { key: 'doorlock_in', handleKey: 'door_handle', w: 1024, h: 1536, fit: 'cover', yaw: 0, maxZ: 3, cap: 'lock' },
    /** 책상 위 새 폰 (§3.8 · §4.7.7) — screen = DOM (matrix3d on np_cu_q) */
    newphone: { key: 'newphone', w: 1024, h: 1536, fit: 'cover', yaw: 270, maxZ: 3, cap: 'newphone',
      power: { x: 0.745, y: 0.3, w: 0.07, h: 0.11 },
      screens: {
        battery0: '0%', battery2: '2%',
        wipe: '{$wipe}',
        boot: '시작하는 중',
        frp: { sim: 'SIM 없음', head: '기기 보호', line: '{$frp}', small: '이 기기는 초기화되었습니다. 계속하려면 이 기기에서 쓰던 계정을 인증하세요.',
          field: '인증 코드', next: '다음', emergency: '긴급 통화', emergencyFail: '{$noSimEmergency}' },
      } },
  };

  /** §4.7.7 which new-phone screen is on now (clock ∧ M2) */
  function newPhoneScreen() {
    if (!flag('M2')) return passed('23:30') ? 'battery2' : 'battery0';
    if (passed('23:43')) return 'frp';
    if (passed('23:42')) return 'boot';
    return 'wipe';
  }

  G.ROOM = {
    img, has, META, GEO, world, cap, views, subs, closeups,
    hm, passed, toMin, fmt12, snow, roofLightOn, taped, footprints, ledState, policeOn, tankOpened, lit, plateState, newPhoneScreen,
    /** view index by id (−1 when unknown) */
    indexOf(id) { for (let i = 0; i < views.length; i++) if (views[i].id === id) return i; return -1; },
  };
})();
