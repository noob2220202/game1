/* =========================================================
 * ep2/js/config.ep2.js — episode-2 constants (core · ARCH_EP2 §4.2, DESIGN_EP2 §9.1). Loads right after ../js/config.js,
 * before the engine. Defines: CONFIG.SAVE_KEY, G.AUDIO_BASE, G.EP (+ CLOCK, HOME, QS, DEFAULTS), G.STORY.names, G.APP, G.DEBUG.
 * Personalisation (PLAYER_NAME, MAKER_*) stays in the shared root js/config.js.
 * ========================================================= */
window.CONFIG = window.CONFIG || {};
window.CONFIG.SAVE_KEY = 'haru-escape.ep2.save.v1';
window.G = window.G || {};
(function (G) {
  'use strict';
  G.AUDIO_BASE = 'assets/audio/';                    // relative to ep2/index.html
  G.EP = { n: 2, title: '하루를 위한 방탈출! 2', sub: '돌려줄게', screenTitle: '{N를} 위한 방탈출! 2', estMin: 45 };
  G.EP.CLOCK = {                                       // §9.1 verbatim (rate = real seconds per in-game minute; cap = stop at)
    t0: [2026, 11, 24],                                // JS month 11 = December. Times 00:00–11:59 belong to 12-25.
    ms: [ ['M0', '23:10', null, null, 67], ['M1', '23:12', 12, '23:40', 67], ['M2', '23:41', 50, '23:51', 66],
          ['M3', '23:52', 30, '00:03', 65], ['M4', '00:04', 12.5, '00:15', 64], ['M5', '00:16', 26, '00:23', 63],
          ['M6', '00:24', 30, '00:35', 62], ['M7', '00:36', 'beat', '01:09', 61], ['M8', '01:10', 'card', null, 60],
          ['END', '02:00', 'card', null, 59], ['HOOK', '03:33', 'fixed', null, 58] ],
    jump: { C1b: '00:27', C2: '00:29', drillStop: '00:31', musicCut: '00:33', b17: '00:39', b18: '00:41' },
    m7beat: [[0, '00:36'], [18, '00:39'], [30, '00:41']], m7rate: 1.5,
  };
  G.EP.HOME = {
    n:    { apps: ['talk', 'moment', 'mail', 'gallery', 'camera', 'memo', 'browser', 'recorder', 'clock', 'calendar', 'alerts', 'timeline'],
            dock: ['phone', 'settings'], wall: 'n_wall', widget: 'clock' },
    dash: { apps: ['gallery', 'memo', 'moment', 'clock', 'settings'], dock: [], wall: 'old_room', widget: null },
  };
  G.EP.QS = { tiles: ['wifi', 'bt', 'flash'], userRow: true };   // §4.6.1 / §0.2 E1 — no DND / sound-mode / airplane tiles
  G.EP.DEFAULTS = { e1MyMsgs: true, phoneVol: 60, btVol: 15, audioMode: 'ear', subs: 'info', scares: 'full' };

  G.STORY = G.STORY || {};
  G.STORY.names = {                                    // §9.6 v1.3 · client decision ① — the only source of 구/기관 names
    eunpyeong: '은평구', mapo: '마포구',
    eunpyeongOrg: '은평구청', mapoOrg: '마포구청',
    eunpyeongOffice: '[은평구청]', mapoOffice: '[마포구청]',
    police: '서강경찰서', policeShort: '서강서',
    court: '서울서강지법',
  };

  // G.APP — the app-store build (docs/APP_RELEASE.md): CONFIG.APP === true, or the ?app=1 preview off the production host.
  // Under G.APP: the credits show the title block only and no debug visual renders (meter, error lines, hotspot outlines,
  // body.debug). The real app build (CONFIG.APP === true) also forces G.DEBUG off whatever CONFIG.DEBUG / ?debug=1 say, so
  // no window.haru helper, series _fixture or skipTo is ever defined; debug-only APIs outside window.haru (G.ending.debugM8,
  // G.clock._scale, G.audio.meter, G.fx.roomLook, G.e2.budget) are left out whenever G.APP && !G.DEBUG.
  // The ?app=1 preview keeps the normal G.DEBUG rule, so QA can open ?app=1&debug=1 and still jump.
  const offProd = !/pengueverything\.cloud$/.test(location.hostname);
  const appBuild = window.CONFIG.APP === true;
  G.APP = appBuild || (/[?&]app=1\b/.test(location.search) && offProd);
  G.DEBUG = !appBuild && (!!window.CONFIG.DEBUG || (/[?&]debug=1\b/.test(location.search) && offProd));
})(window.G);
