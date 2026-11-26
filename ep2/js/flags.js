/* =========================================================
 * ep2/js/flags.js — the state dictionary (core · DESIGN_EP2 §2.5 + §9.2 · ARCH_EP2 §4.4)
 * Exports
 *   G.F            name → same string (G.F.factSmart === 'factSmart') — reference names through it (typo safety)
 *   G.F.ALL        every flag name · G.F.TOGGLE non-monotone flags · G.F.SETTER {flag: 'owner · file'}
 *   G.VARS         var name → {type, def, owner}
 *   G.applyVarDefaults(state)   fills missing cross-owner var defaults (called by base.js fresh() and once here)
 * Each name has exactly one setter (G.F.SETTER / G.VARS[k].owner); readers are free. Runs no cross-owner code.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* [setter, names...] — ARCH §4.4 table (★ = added by the contract) */
  const TABLE = [
    ['flow · scenes', 'introDone', 'recapShown', 'M0'],
    ['shell · lock', 'M1'],
    ['core · e2', 'M2', 'M4', 'M5', 'factDash', 'mono1', 'mono2', 'mono3', 'mono4'],
    ['shell · security', 'M3', 'factSmart', 'smartRemoved', 'trustDevSeen', 'kbdListOpened', 'factKbd', 'seenKbd'],
    ['room · climax', 'M6', 'M7', 'lureEarly', 'C2', 'roofLight', 'peepholeTaped'],
    ['flow · ending', 'M8', 'END', 'doorOpened', 'dashChoiceDone', 'pol1Shown', 'nearbyTaken', 'phoneChoiceDone', 'jiminReturn', 'answeredRight', 'kangWrapDone'],
    ['flow · hook', 'HOOK', 'hookDone', 'hookOpened', 'hookZoom', 'hookFull'],
    ['room · room/roomdata', 'gotPhone', 'boxNote', 'boxHand', 'polaroidSeen', 'seenNote', 'newPhoneSeen'],
    ['shell · lock/security', 'fingerIconTouched', 'bioOpened', 'factFinger', 'fingerDeleted'],
    ['media · alerts', 'cbsOpened', 'tlOpened', 'factCbs', 'seenCbs'],
    ['social · moment', 'jiminOpened', 'factJimin', 'vmPlayed', 'dashMoment', 'draftSeen', 'fakeKnown', 'fakeReplied', 'hiddenSeen',
      'C1', 'C1b', 'makerStayDown', 'makerArrived', 'whereAsked', 'whereTank', 'fakeLineSeen'],
    ['shell · phone/security', 'dashSeen', 'pinPadOpened', 'dashUsers'],
    ['media · memo', 'dashMemo'],
    ['media · gallery', 'dashA0310', 'dashARoof', 'dashHidden', 'seenKey404', 'seenWhistle', 'seenHinge', 'photo4Seen', 'seenHangyeol'],
    ['shell · settings', 'soundSettingsOpened', 'perChatSeen'],
    ['audio · tones', 'toneRestored'],
    ['core · media', 'btConnected', 'btPlaying', 'musicCut'],
    ['flow · director', 'tankGlow', 'b09Cue'],
  ];
  const F = {};
  const SETTER = {};
  TABLE.forEach(([who, ...names]) => names.forEach((n) => { F[n] = n; SETTER[n] = who; }));
  // shared setter notes (ARCH §4.4): peepholeTaped on = climax (B12), off = ending (doorOpened); M6 fallback = core e2 when G.climax is absent
  SETTER.peepholeTaped = 'room · climax (on) / flow · ending (off)';
  SETTER.M6 = 'room · climax (core · e2 fallback if G.climax is missing)';

  const ALL = Object.keys(F);
  const TOGGLE = ['btConnected', 'btPlaying', 'roofLight', 'peepholeTaped'];
  Object.defineProperty(F, 'ALL', { value: ALL, enumerable: false });
  Object.defineProperty(F, 'TOGGLE', { value: TOGGLE, enumerable: false });
  Object.defineProperty(F, 'SETTER', { value: SETTER, enumerable: false });
  G.F = F;

  /* Vars (ARCH §4.4). def = default (cloned into fresh saves when `seed` is true — only cross-owner primitives / arrays;
   * owner-private objects are left for their owner to initialise). */
  const V = (type, def, owner, seed) => ({ type, def, owner, seed: seed !== false });
  const EPD = (G.EP && G.EP.DEFAULTS) || {};
  G.VARS = {
    pm:            V('{flag: playMs}', {}, 'core'),
    factCount:     V('int 0–6', 0, 'core'),
    kbdHisSeen:    V('int', 0, 'shell'),
    kbdHisSet:     V('string[]', [], 'shell'),
    kbdSeedSeen:   V('string[]', [], 'shell'),
    cbsDays:       V('string[] (MM-DD)', [], 'media'),
    tlDays:        V('string[] (MM-DD)', [], 'media'),
    cbsMapoRows:   V('int', 0, 'media'),
    pinTries:      V('int', 0, 'shell'),
    user:          V("'n'|'dash'", 'n', 'shell'),
    toneDefault:   V("'dash'|'water'|'toktok'|'bell'", 'dash', 'audio'),
    toneChatFake:  V("'dash'|'water'|'toktok'|'bell'", 'dash', 'audio'),
    smartGone:     V("⊂ ['saemal_rooftop','2층_스피커']", [], 'shell'),
    wifiOn:        V('bool', true, 'shell'),
    wifiSaved:     V('string[]', ['saemal_rooftop', 'SM-G991N_0A3F', 'Haesol_404'], 'shell'),
    btOn:          V('bool', true, 'core (G.media.bt.setOn)'),
    btVol:         V('int 0–100', EPD.btVol != null ? EPD.btVol : 15, 'core (G.media.setVolume)'),
    phoneVol:      V('int 0–100', EPD.phoneVol != null ? EPD.phoneVol : 60, 'core (G.media.setVolume)'),
    ledState:      V("'green'|'blue'|'off'", 'green', 'core (G.media.bt)'),
    wobbles:       V('int', 0, 'room · climax'),
    lureCount:     V('int 0–2', 0, 'room · climax'),
    sirenBy:       V("'c2'|'early'|'c1b'|'time'|null", null, 'room · climax'),
    c2Src:         V("'rec'|'video'|null", null, 'room · climax'),
    m5HoldPm:      V('int|null', null, 'core'),
    snow:          V('0–2', 0, 'core'),
    footprints:    V('0–2', 0, 'room · climax (1) / flow · ending (2)'),
    hookPlays:     V('int', 0, 'flow · hook'),
    soundMode:     V("'sound'|'vibrate'|'mute'", 'sound', 'shell'),
    dnd:           V('bool', false, 'shell'),
    kbdPredictOff: V("⊂ ['n','dash']", [], 'shell'),
    shots:         V('[{t, view}]', [], 'room · camera'),
    sched:         V('[{at, id, data}]', [], 'core'),
    climax:        V('{drillPm, c2HoldPm, lureEarlyPm, m6DuePm, sirenAtPm, phase}', null, 'room (m6DuePm: core)', false),
    endStep:       V("'k0110'|'k0120'|'k0140'|'k0150'|'j0200'|'j0205'|'m0212'|'k0215'|'l0220'|'cred'|'check'|'hook'|null", null, 'flow'),
    clock:         V('object', null, 'core', false),
    battery:       V('int|null', null, 'core (debug)'),
    dir:           V('{fired:{id:pm}, jsSpent:{b09,b14}, himTone:int, T:num}', null, 'flow (himTone: audio)', false),
    room:          V('object', null, 'room', false),
    nb:            V('object', null, 'flow', false),
    replay:        V('bool', false, 'core (series fns)'),
    committed:     V('bool', false, 'core (series fns)'),
    commitTries:   V('int', 0, 'core (series fns)'),
    patched:       V('bool', false, 'core (series fns)'),
    sh: V('object', null, 'shell', false), so: V('object', null, 'social', false), md: V('object', null, 'media', false),
    au: V('object', null, 'audio', false), e2: V('object', null, 'core', false),
  };

  const copy = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
  G.applyVarDefaults = function (state) {
    if (!state || !state.vars) return;
    Object.keys(G.VARS).forEach((k) => {
      const d = G.VARS[k];
      if (!d.seed || Object.prototype.hasOwnProperty.call(state.vars, k)) return;
      state.vars[k] = copy(d.def);
    });
  };
  if (G.state) G.applyVarDefaults(G.state);
})();
