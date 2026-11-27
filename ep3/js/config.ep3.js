/* =========================================================
 * ep3/js/config.ep3.js — episode-3 constants (core · ARCH_EP3 §5.2 · DESIGN_EP3 §9.1 · §2.1).
 * Loads right after ../js/config.js and before the engine (engine/core/base.js reads CONFIG.SAVE_KEY and G.EP.CLOCK at load).
 * Defines: CONFIG.SAVE_KEY · G.AUDIO_BASE · G.EP (+ CLOCK, HOME getter, LOCK, VIB, STATUS, QS, KBD, mediaRoute, DEFAULTS,
 *   noShake, SESSION_KEY) · G.STORY.names · G.DEBUG. No new CONFIG key (ep3 reads PLAYER_NAME · MAKER_NAME only).
 * Engine switches set here (ARCH §3.3 'ep3 switch' column — ep2 never defines them):
 *   G.EP.noShake (fx.js edgeShake · audio iOS fallback) · G.EP.VIB (keyboard / notebook / audio vibration allow-list) ·
 *   G.EP.KBD.predict === false (keyboard predict bar forced off) · G.EP.LOCK (lock.js easy skin) · G.EP.STATUS · G.EP.QS tiles
 *   'sound'/'dnd' + userRow:false · G.EP.HOME render/folder/widgetOpen (phone.js) · G.EP.mediaRoute (media.js).
 * Literal place names live only here (G.STORY.names — data files write {police} · {daejeon} tokens, §0.1 #26 · §10 F).
 * Runs no cross-owner code: the HOME getter and mediaRoute are lazy (read at render / play time).
 * ========================================================= */
window.CONFIG = window.CONFIG || {};
window.CONFIG.SAVE_KEY = 'haru-escape.ep3.save.v1';               // engine/core/base.js reads it at load
window.G = window.G || {};
(function (G) {
  'use strict';
  G.AUDIO_BASE = 'assets/audio/';                                    // = /ep3/assets/audio/ (relative to ep3/index.html)
  G.EP = { n: 3, title: '하루를 위한 방탈출! 3', sub: '엄마의 번호', screenTitle: '{N를} 위한 방탈출! 3', estMin: 45,
           SESSION_KEY: 'haru-escape.ep3.session', noShake: true };
  G.EP.CLOCK = { t0: [2027, 0, 23],                                  // §2.1 one-line source, verbatim (toMin: hours < 12 → 01-24)
    ms: [ ['M0', '03:20', 12, '03:32', 72], ['M1', '03:33', 'card', null, 72], ['gotPhone', '03:35', 60, '03:39', 72],
          ['M2', '03:40', 40, '03:54', 71], ['M3', '03:55', 30, '04:14', 69], ['M4', '04:15', 30, '04:29', 67],
          ['M5', '04:30', 6.5, '04:39', 66], ['M6', '04:40', 'beat', '05:04', 65], ['M7', '05:05', 30, '05:14', 64],
          ['M8', '05:15', 20, '05:29', 63], ['END', '05:30', 'card', null, 62], ['HOOK', '06:10', 'fixed', null, 61] ],
    jump: { callEnd: '03:34' },
    m7beat: [[0, '04:40'], [30, '04:41'], [46, '04:43'], [100, '04:50'], [140, '04:55'], [176, '05:02']], m7rate: 15 };

  /* home specs (§2.6 · §5.1 · §5.2 · §0.3 D8) — the getter is read on every renderHome (easy ⇄ standard, §5.4) */
  const EASY = { easy: true, render: (node, api) => (G.easy && G.easy.renderHome ? G.easy.renderHome(node, api) : null), wall: null, dock: [] };
  const STD  = { apps: ['gallery', 'calendar', 'moim', 'clock', 'settings',
                        { folder: '엄마 안 써도 됨', apps: ['mail', 'browser', 'memo', 'voicerec', 'files', 'weather'] }],
                 dock: ['phone', 'sms', 'talk', 'camera'], wall: 'p3_home_wall', widget: 'clock', widgetOpen: 'calendar' };
  G.EP.HOME = { get n() { return (G.easy && G.easy.on && G.easy.on()) ? EASY : STD; } };
  G.EP.LOCK = { swipeOnly: true, wall: 'kongi_old', firstFlag: 'gotPhone', beat: 'B07', cue: 'ui.unlock', skin: 'easy',
                emergency: 'phone:emergency' };                     // ARCH §4.2 lock.js · §0.3 D42 (shown once, never relocks)
  G.EP.VIB = ['ring3', 'sms'];                                       // ARCH §1 — the only two vibration patterns of ep3
  G.EP.STATUS = { sim: true, net: 'LTE', wifi: '집' };              // §3.2.1 — no 'SIM 없음'
  G.EP.QS = { tiles: ['wifi', 'sound', 'flash', 'dnd'], userRow: false, dndLong: 'dnd' };   // §5.3 · §0.3 D19 (no BT tile)
  G.EP.KBD = { predict: false };                                     // §9.5-1 · §0.3 D38 — no predict bar anywhere in ep3
  G.EP.mediaRoute = () => (G.flag && G.flag('playArmed') && G.state && G.state.vars.where === 'lv') ? 'table' : 'ear';   // §7.1.5
  G.EP.DEFAULTS = { phoneVol: 60, audioMode: 'ear', subs: 'info', scares: 'full', btOn: false };

  G.STORY = G.STORY || {};
  G.STORY.names = { eunpyeong: '은평구', mapo: '마포구', eunpyeongOrg: '은평구청', mapoOrg: '마포구청',
    eunpyeongOffice: '[은평구청]', mapoOffice: '[마포구청]', police: '서강경찰서', policeShort: '서강서', court: '서울서강지법',
    daejeon: '대전 서구' };                                          // ARCH §1.1 — verbatim (§9.1 · §0.1 #26)

  G.DEBUG = !!window.CONFIG.DEBUG || (/[?&]debug=1\b/.test(location.search) && !/pengueverything\.cloud$/.test(location.hostname));
})(window.G);
