/* =========================================================
 * Room 404 data — 4 views seen through the phone camera (design §5 카메라, §6.3).
 * All positions are FRACTIONS of the 1024x1536 view image (x,y = top-left, w,h = size).
 *
 * G.ROOM = {
 *   img(key)            -> URL for an asset key (G.IMG first, then assets/img/<key>.(jpg|png))
 *   boxes               -> default boxes for patch/stage overlays (LEAD may override per key via G.IMG_BOX)
 *   keypad              -> door-lock close-up layout (fractions of the keypad image)
 *   gapStage()          -> current wardrobe gap stage 0..4 (design §6.3 formula)
 *   glassState()        -> 'full' | 'half' | 'empty'
 *   views: [{id, name, az, key, litKey?, w, h, layers:[...], glows:[...], hotspots:[...], litHotspots:[...]}]
 * }
 * layer: {id, pick() -> asset key | null, box:{x,y,w,h}, cls?, kind?:'sticker'|'glint'|'fingers'}
 *        (an image whose natural size equals the view size is placed full-frame automatically)
 * hotspot: {id, x,y,w,h, label, needLight (default true), minZoom, when(), tap(api)}
 * Overlay images may not exist yet at dev time: every <img> hides itself on error.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const PNG = /^(patch_|gap_stage_|fingers_gap|fig_cap|shaft_card_dark|shaft_face_dark)/;
  function img(key) {
    if (!key) return '';
    if (G.IMG && G.IMG[key]) return G.IMG[key];
    return 'assets/img/' + key + (PNG.test(key) ? '.png' : '.jpg');
  }
  const flag = (f) => !!(G.flag && G.flag(f));
  const T = (s) => (G.T ? G.T(s) : s);
  const note = (s) => { try { G.notebook && G.notebook.note && G.notebook.note(T(s)); } catch (e) {} };

  /* ---------- measured regions (fractions of the 1024x1536 frames) ---------- */
  const B = {
    // door view
    doorSlab: { x: 0.305, y: 0.33, w: 0.32, h: 0.445 },
    keypad: { x: 0.548, y: 0.476, w: 0.074, h: 0.064 },
    keypadLed: { x: 0.582, y: 0.503 },
    handle: { x: 0.488, y: 0.522, w: 0.066, h: 0.04 },
    peephole: { x: 0.432, y: 0.438, w: 0.05, h: 0.042 },
    sticker: { x: 0.421, y: 0.484, w: 0.074, h: 0.036 },
    guard: { x: 0.505, y: 0.385, w: 0.115, h: 0.06 },
    shoes: { x: 0.285, y: 0.8, w: 0.105, h: 0.075 },
    parcel: { x: 0.545, y: 0.74, w: 0.125, h: 0.095 },
    // bed view
    duvet: { x: 0.33, y: 0.56, w: 0.49, h: 0.1 },
    underBed: { x: 0.42, y: 0.715, w: 0.39, h: 0.1 },
    glassBed: { x: 0.83, y: 0.585, w: 0.09, h: 0.075 },
    dent: { x: 0.45, y: 0.575, w: 0.25, h: 0.075 },
    glassPatchBed: { x: 0.852, y: 0.596, w: 0.038, h: 0.04 },
    // window view
    windowPane: { x: 0.325, y: 0.255, w: 0.445, h: 0.28 },
    desk: { x: 0.645, y: 0.585, w: 0.355, h: 0.105 },
    boxes: { x: 0.79, y: 0.735, w: 0.21, h: 0.265 },
    glassWin: { x: 0.215, y: 0.625, w: 0.08, h: 0.075 },
    // wardrobe view
    wardrobe: { x: 0.3, y: 0.205, w: 0.42, h: 0.635 },
    gapLine: { x: 0.5, y: 0.215, w: 0.036, h: 0.615 },
    gapCenter: { x: 0.517, y: 0.52 },
    handles: { x: 0.482, y: 0.552, w: 0.068, h: 0.034 },
    rack: { x: 0.18, y: 0.52, w: 0.135, h: 0.365 },
    gapStage: { x: 0.47, y: 0.2, w: 0.094, h: 0.65 },
    fingers: { x: 0.475, y: 0.48, w: 0.05, h: 0.09 },
    glint: { x: 0.5145, y: 0.452 },
    rackFallen: { x: 0.08, y: 0.68, w: 0.3, h: 0.22 },
    // lit nest (room_lit_nest replaces the wardrobe view after 비상벨)
    nestOrgel: { x: 0.43, y: 0.6, w: 0.15, h: 0.08 },
    nestPolaroids: { x: 0.37, y: 0.28, w: 0.28, h: 0.17 },
    nestBlanket: { x: 0.34, y: 0.68, w: 0.34, h: 0.12 },
  };

  /* default boxes for overlay images by asset key (G.IMG_BOX[key] wins) */
  const boxes = {
    patch_doorguard_latched: B.guard,
    patch_doorguard_open: B.guard,
    patch_duvet_dent: B.dent,
    patch_glass_half: B.glassPatchBed,
    patch_glass_empty: B.glassPatchBed,
    gap_stage_1: B.gapStage, gap_stage_2: B.gapStage, gap_stage_3: B.gapStage, gap_stage_4: B.gapStage,
    fingers_gap: B.fingers,
    patch_rack_fallen: B.rackFallen,
    door_sticker: B.sticker,
  };
  function boxOf(key, fallback) { return (G.IMG_BOX && G.IMG_BOX[key]) || boxes[key] || fallback; }

  /* ---------- room state (§6.3) ---------- */
  function gapStage() {
    const f = G.fragCount ? G.fragCount() : 0;
    const bonus = +((G.state && G.state.vars && G.state.vars.lookAwayBonus) || 0);
    const cap = flag('M7') ? 4 : flag('M4') ? 3 : flag('M2') ? 2 : 1;
    return Math.max(0, Math.min(f + (flag('M5') ? 1 : 0) + bonus, cap));
  }
  function glassState() { return flag('M4') ? 'empty' : flag('F2') ? 'half' : 'full'; }
  function rackFallen() {
    if (flag('rackFallen')) return true;
    const t = G.state && G.state.flags && G.state.flags.M6;
    return !!t && Date.now() - t > 20000;
  }
  function guardLatched() { return flag('F3') || flag('M7'); }

  /* ---------- shared captions ---------- */
  const GLASS_TEXT = {
    full: '자기 전에 떠 둔 물 한 컵.',
    half: '…물이 반으로 줄어 있다. 나는 안 마셨다.',
    empty: '…컵이 비어 있다. 바닥에 물기도 없다.',
  };
  function glassTap(api) {
    const s = glassState();
    api.caption(GLASS_TEXT[s]);
    if (s !== 'full') note('물컵이 줄어 있다. 내가 마신 게 아니다.');
  }

  const R = (G.ROOM = {
    img, boxes, boxOf, B, gapStage, glassState, rackFallen, guardLatched,
    /* door-lock keypad close-up: panel box over G.IMG.keypad (fractions of that image).
     * LEAD: if keys are measured on the generated image, set keys area here. */
    keypad: { w: 1024, h: 1536, panel: { x: 0.2, y: 0.14, w: 0.6, h: 0.74 } },
    views: [
      /* ---------------- 0° 현관 ---------------- */
      {
        id: 'door', name: '현관', az: 0, key: 'room_door', w: 1024, h: 1536,
        layers: [
          { id: 'guard', pick: () => (guardLatched() ? 'patch_doorguard_latched' : 'patch_doorguard_open'), box: B.guard },
          { id: 'sticker', kind: 'sticker', pick: () => 'door_sticker', box: B.sticker },
        ],
        glows: [{ id: 'keypad', kind: 'led', at: B.keypadLed }],
        hotspots: [
          { id: 'doorlock', ...B.keypad, label: '도어락', needLight: false,
            tap(api) { if (G.hooks && G.hooks.has && G.hooks.has('door:keypad')) G.hooks.call('door:keypad'); else if (G.door) G.door.open(); } },
          { id: 'handle', ...B.handle, label: '문 손잡이', needLight: false,
            tap(api) {
              G.audio && G.audio.sfx.lockClick && G.audio.sfx.lockClick();
              api.caption('…잠겨 있다. 손잡이가 꿈쩍도 안 한다.');
              note('현관은 도어락으로 잠겨 있다. 비밀번호 여섯 자리.');
            } },
          { id: 'peephole', ...B.peephole, label: '현관 렌즈', tap(api) { R.peephole(api); } },
          { id: 'sticker', ...B.sticker, label: '스티커',
            tap(api) {
              if (api.zoom >= 2) { api.caption('작은 스티커. 관리사무소 번호랑 QR 코드가 있다.'); return; }
              api.caption('문에 작은 스티커가 붙어 있다. 너무 작아서 안 보인다. 확대해 볼까?');
            } },
          { id: 'guard', ...B.guard, label: '도어가드', when: () => guardLatched(),
            tap(api) {
              api.caption('…도어가드가 걸려 있다. 아까는 분명 열려 있었는데.');
              note('도어가드가 혼자 걸려 있었다.');
            } },
          { id: 'shoes', ...B.shoes, label: '운동화', tap(api) { api.caption('내 운동화. 어제 이사 오면서 벗어 둔 그대로다.'); } },
          { id: 'parcel', ...B.parcel, label: '택배 상자', tap(api) { api.caption('택배 상자. 아직 못 뜯었다.'); } },
        ],
      },
      /* ---------------- 90° 침대 ---------------- */
      {
        id: 'bed', name: '침대', az: 90, key: 'room_bed', w: 1024, h: 1536,
        layers: [
          { id: 'dent', pick: () => (flag('F1') && !flag('F2') ? 'patch_duvet_dent' : null), box: B.dent },
          { id: 'glass', pick: () => ({ full: null, half: 'patch_glass_half', empty: 'patch_glass_empty' })[glassState()], box: B.glassPatchBed },
        ],
        hotspots: [
          { id: 'underbed', ...B.underBed, label: '침대 밑', tap(api) { R.bowl(api); } },
          { id: 'duvet', ...B.duvet, label: '이불',
            tap(api) {
              if (api.layer('dent')) { api.caption('…이불 가장자리가 움푹 눌려 있다. 누가 앉았다 간 것처럼.'); note('침대에 누가 앉았던 자국.'); }
              else api.caption('내가 자던 자리. 이불이 아직 미지근하다.');
            } },
          { id: 'glass', ...B.glassBed, label: '물컵', tap: glassTap },
        ],
      },
      /* ---------------- 180° 창문 ---------------- */
      {
        id: 'window', name: '창문', az: 180, key: 'room_window', w: 1024, h: 1536,
        layers: [],
        hotspots: [
          { id: 'window', ...B.windowPane, label: '창문', needLight: false, tap(api) { R.windowView(api); } },
          { id: 'desk', ...B.desk, label: '책상', tap(api) { api.caption('책상. 노트북은 배터리가 없다. 충전기는 아직 상자 어딘가에.'); } },
          { id: 'boxes', ...B.boxes, label: '이삿짐', tap(api) { api.caption('이삿짐 상자들. 테이프도 다 못 뜯었다.'); } },
          { id: 'glass2', ...B.glassWin, label: '물컵', tap: glassTap },
        ],
      },
      /* ---------------- 270° 옷장 ---------------- */
      {
        id: 'wardrobe', name: '옷장', az: 270, key: 'room_wardrobe', litKey: 'room_lit_nest', w: 1024, h: 1536,
        layers: [
          { id: 'gap', pick: () => { const g = gapStage(); return g ? 'gap_stage_' + g : null; }, box: B.gapStage },
          { id: 'fingers', kind: 'fingers', litOnly: true, pick: () => (gapStage() === 3 ? 'fingers_gap' : null), box: B.fingers },
          { id: 'glint', kind: 'glint', pick: () => (gapStage() >= 4 ? 'glint' : null), at: B.glint },
          { id: 'rack', pick: () => (rackFallen() ? 'patch_rack_fallen' : null), box: B.rackFallen },
        ],
        glows: [{ id: 'ring', kind: 'ring', box: B.gapLine }],
        hotspots: [
          { id: 'gap', ...B.gapLine, label: '옷장 틈',
            tap(api) {
              if (api.zoom >= 2) { api.caption(flag('frag06') ? '…다시 들여다보고 싶지 않다.' : '틈 안쪽이 새까맣다. 카메라로도 안 보인다. …야간 모드라면?'); return; }
              api.caption(flag('frag06') ? '…다시 들여다보고 싶지 않다.' : '문틈이 새까맣다. 가까이 확대해 볼까?');
            } },
          { id: 'handles', ...B.handles, label: '옷장 손잡이',
            tap(api) {
              G.audio && G.audio.sfx.creakWardrobe && G.audio.sfx.creakWardrobe({ az: 270, dur: 0.5 });
              api.caption('…안 열린다. 안쪽에서 뭔가가 걸려 있는 것처럼.');
            } },
          { id: 'wardrobe', ...B.wardrobe, label: '붙박이장',
            tap(api) {
              api.zoomTo(2, B.gapCenter.x, 0.5);
              api.caption(flag('M1') ? '붙박이장. 관리실은 절대 열지 말라고 했다.' : '붙박이장. 문틈이 새까맣다.');
            } },
          { id: 'rack', ...B.rack, label: '빨래 건조대',
            tap(api) {
              if (api.layer('rack')) { api.caption('건조대가 쓰러져 있다. …아무도 안 건드렸는데.'); note('건조대가 혼자 쓰러졌다.'); }
              else api.caption('빨래 건조대. 아직 아무것도 안 널었다.');
            } },
        ],
        litHotspots: [
          { id: 'orgel', ...B.nestOrgel, label: '오르골', needLight: false,
            tap(api) {
              const mb = G.audio && G.audio.musicBox ? G.audio.musicBox({ variant: 'warm', gain: 0.7 }) : null;
              if (mb) setTimeout(() => mb.stop(), 2600);
              api.caption('세아의 오르골. 태엽을 감자 한 마디가 흘러나온다.');
            } },
          { id: 'polaroids', ...B.nestPolaroids, label: '폴라로이드', needLight: false,
            tap(api) { api.caption('세아의 사진. 그리고… 내 사진. …1년 동안, 저 안에서.', 4200); } },
          { id: 'blanket', ...B.nestBlanket, label: '담요', needLight: false,
            tap(api) { api.caption('개어 둔 담요, 음식 포장지. 누군가 여기서 살았다.'); } },
        ],
      },
    ],
  });

  /* ---------- close-ups ---------- */
  R.bowl = function (api) {
    const src = img('bowl_closeup');
    const ov = el('div.cu-bowl', null,
      el('img.cu-bowl-img', { src, alt: '', draggable: 'false', onerror: function () { this.style.display = 'none'; this.parentNode.classList.add('fallback'); } }),
      el('div.cu-bowl-fb', null, el('div.bowl-dish'), el('div.bowl-sticker', null, '콩이 ♥', el('br'), el('small', null, 'since 2023.03.17'))));
    api.closeup({
      title: '침대 밑',
      node: ov,
      text: '먼지 쌓인 강아지 밥그릇. 이름 스티커가 붙어 있다. <b>콩이 ♥ since 2023.03.17</b>',
      onOpen() { note('콩이… 3월 17일부터?'); G.flag && G.flag('bowlSeen', true); },
    });
  };
  R.peephole = function (api) {
    const src = img(flag('M6') ? 'hallway_eps' : 'hallway');
    const lens = el('div.cu-peep', null,
      el('div.peep-lens', null, el('img', { src, alt: '', draggable: 'false', onerror: function () { this.style.display = 'none'; } }), el('div.peep-vig')));
    api.closeup({
      title: '현관 렌즈',
      node: lens,
      text: flag('M7') ? '…아무것도 안 보인다. 렌즈 바로 앞이 막혀 있는 것처럼.' : '복도는 캄캄하다. 센서등이 꺼져 있다. …아무도 없는 것 같다.',
    });
  };
  R.windowView = function (api) {
    const g = gapStage();
    const box = el('div.cu-window', null,
      el('img.win-base', { src: img('room_window'), alt: '', draggable: 'false' }),
      el('img.win-refl' + (g >= 2 ? '.dark-gap' : ''), { src: img('room_wardrobe'), alt: '', draggable: 'false' }),
      el('div.win-rain'), el('div.win-rain.r2'));
    api.closeup({
      title: '창문',
      node: box,
      text: g >= 2 ? '비가 그칠 생각을 안 한다. 유리에 방이 비친다. …옷장 문이 조금 열려 있다.' : '비가 그칠 생각을 안 한다. 4층. 창문은 손바닥만큼만 열린다. 유리에 방이 희미하게 비친다.',
    });
  };

  function el() { return G.util.el.apply(null, arguments); }
})();
