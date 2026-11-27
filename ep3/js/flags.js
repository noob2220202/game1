/* =========================================================
 * ep3/js/flags.js — the state dictionary (core · ARCH_EP3 §5.4 · DESIGN_EP3 §2.5 + §9.2)
 * Exports
 *   G.F            name → same string (G.F.nameKnown === 'nameKnown') — reference names through it (typo safety)
 *   G.F.ALL        every flag name (§9.2 list) · G.F.SETTER {flag: 'owner · file'} — each name has exactly one setter
 *   G.VARS         var name → {type, def, owner, seed}
 *   G.STAGE_KEYS   ['e3_played', 'e3_dnd', 'easyBack'] (G.state.stage — written only through G.e3.stage)
 *   G.applyVarDefaults(state)   st.ep = 3 · REPLACES st.stage with the ep3 stage unless it already owns 'e3_played'
 *                  (engine fresh() hands it ep2's freshStage() — 'when missing' would leak e2_* keys into the ep3 save;
 *                  G.load() then merges the saved stage over this fresh ep3 one) · seeds missing vars (btOn false,
 *                  recAuto/spamSw/unknownBlock …) — only keys not present (ep2 seed rule). Called by base.js fresh()
 *                  and once here at load (base.js ran fresh() before this file existed — same as ep2/js/flags.js).
 * All flags are monotone (never cleared — §9.2); toggling state lives in vars. base.js warns (DEBUG) on any name ∉ G.F.ALL.
 * Runs no cross-owner code.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  /* [setter, names...] — ARCH §5.4 table (DESIGN §9.2 flag list, 1:1) */
  const TABLE = [
    ['flow · scenes', 'introDone', 'recapShown', 'M0', 'momLine1'],
    ['room · roomdata', 'kongiTail0', 'collarSeen', 'soupSeen0', 'calSeen0', 'heightSeen', 'drawingSeen', 'drawingBack', 'manualSeen', 'orgelSpotSeen'],
    ['flow · call', 'M1', 'callRing', 'callAnswered', 'callEnded', 'handover'],
    ['shell · lock', 'gotPhone'],
    ['shell · easymode', 'easyOff', 'easyGate', 'folderSeen'],
    ['core · e3', 'M2', 'M3', 'M4', 'M5', 'hookDone', 'mono1', 'mono2'],
    ['comms · sms', 'kang341', 'kang502', 'kang341Sent', 'kangNameSent', 'kangBlockSent', 'kang702Sent', 'kangAskSent'],
    ['comms · callrec', 'recListOpened', 'recPlayerOpened', 'recPlayed', 'textAnyOpened', 'textOpened', 'greySeen', 'heard21',
      'nameKnown', 'sigName', 'radioHeard', 'blockOpened', 'blockBottom'],
    ['comms · apps/phone.js', 'missedSeen', 'call112First'],
    ['shell · show', 'momBlock', 'mom331', 'momDnd', 'momMembers', 'momBom', 'glasses', 'dndChipSaid'],
    ['shell · settings', 'dndOpened', 'dndLogOpened'],
    ['media · gallery', 'albumOpened', 'membersSeen', 'bomSeen', 'albumDone', 'saw702'],
    ['media · calendar', 'calCake'],
    ['room · door', 'M6', 'bip', 'view0AfterM6', 'doorDone', 'jiminUp', 'jiminChipSent', 'jimin112', 'patrol', 'kongiBack', 'M7'],
    ['room · memory', 'memoryStart', 'memoryDone', 'M8'],
    ['room · climax', 'playArmed', 'played', 'playFallback'],
    ['flow · ending', 'END', 'collarOn', 'soupServed', 'easyBackChip'],
    ['flow · hook', 'HOOK', 'hookOpened', 'boilerSting'],
  ];
  const F = {};
  const SETTER = {};
  TABLE.forEach(([who, ...names]) => names.forEach((n) => { F[n] = n; SETTER[n] = who; }));
  SETTER.M6 = 'room · door (core · e3 fallback when G.door is missing)';
  SETTER.folderSeen = 'shell · phone.js folder open (easymode owner)';
  SETTER.hookDone = 'core · G.e3.hookPatch (called by flow hook)';
  const ALL = Object.keys(F);
  Object.defineProperty(F, 'ALL', { value: ALL, enumerable: false });
  Object.defineProperty(F, 'TOGGLE', { value: [], enumerable: false });        // ep3: every flag is monotone
  Object.defineProperty(F, 'SETTER', { value: SETTER, enumerable: false });
  G.F = F;

  /* Vars (ARCH §5.4). def = default; seed = cloned into fresh saves when the key is missing (owner-private objects that the
   * owner initialises itself are seed:false). */
  const V = (type, def, owner, seed) => ({ type, def, owner, seed: seed !== false });
  const EPD = (G.EP && G.EP.DEFAULTS) || {};
  G.VARS = {
    pm:            V('{flag: playMs}', {}, 'core (base.js)'),
    clock:         V('object', null, 'core (base.js)', false),
    sched:         V('[{at, id, data}]', [], 'core (G.e3.sched)'),
    battery:       V('int|null', null, 'core (G.e3 battery decay)'),
    hubK:          V('int 0–3', 0, 'core'),
    TB:            V('playMs|null', null, 'core'),
    momAt:         V("'table'|'sr'|'hall'|'lv'", 'table', 'core (G.e3.momAt — callers flow call · room door/memory/climax)'),
    where:         V("'lv'|'sr'", 'lv', 'room (G.room.where)'),
    momTaps:       V('int', 0, 'flow · scenes'),
    easy:          V('bool', true, 'shell · easymode'),
    showSeen:      V('{scr: 1}', {}, 'shell · show'),
    dndNow:        V('bool', false, 'shell (settings + QS)'),
    dndAt:         V('string|null', null, 'shell (settings + QS)'),
    soundMode:     V("'sound'|'vibrate'|'mute'", 'sound', 'shell (QS)'),
    kang:          V('{queue, sent, replyAt, freeAt}', { queue: [], sent: {}, replyAt: {}, freeAt: null }, 'comms · sms'),
    calls:         V('[{n, hm, sec, dir}]', [], 'comms · apps/phone.js'),
    call112:       V('int', 0, 'comms · apps/phone.js'),
    talkCalls:     V('int', 0, 'comms · talk'),
    gal:           V('{zoomMs, fullMs}', { zoomMs: 0, fullMs: 0 }, 'media · gallery'),
    shots:         V('[{t, view}]', [], 'room · camera'),
    m6Hold:        V('playMs|null', null, 'room · door'),
    memEarly:      V('bool', false, 'room · memory'),
    play:          V('{sess, s0, covered, pausedSec, by, line, away}|null', null, 'room · climax'),
    playFails:     V('{head, tail}', { head: 0, tail: 0 }, 'room · climax'),
    momAwayUntil:  V('playMs|null', null, 'room · climax'),
    seatedMs:      V('int', 0, 'room · climax'),
    seq:           V('{m1, m6, m7, m8}', { m1: null, m6: null, m7: null, m8: null }, 'flow call (m1) · room door/memory/climax (m6 m7 m8)'),
    endStep:       V("'e0530'|'e0530c'|'e0535'|'e0540'|'e0545'|'e0555'|'e0600'|'cred'|'check'|'hook'|null", null, 'flow · ending'),
    dir:           V('{fired:{id:pm}, T, dropped:{id:pm}}', null, 'flow · director (core writes dropped mono ids)', false),
    recAuto:       V('bool', true, 'comms (G.callrec.setting)'),
    spamSw:        V('bool', true, 'comms (G.callrec.setting)'),
    unknownBlock:  V('bool', false, 'comms (G.callrec.setting)'),
    btOn:          V('bool', false, 'core (no Bluetooth output in ep3 — ARCH §9 G45)'),
    phoneVol:      V('int 0–100', EPD.phoneVol != null ? EPD.phoneVol : 60, 'audio (G.media.setVolume)'),
    nb:            V('{tab, hintAt, memo, doneSeen}', null, 'flow · notebook', false),
    au:            V('object', null, 'audio', false),
    room:          V('{view, room, closeup, st}', null, 'room', false),
    replay:        V('bool', false, 'core (series fns)'),
    committed:     V('bool', false, 'core (series fns)'),
    commitTries:   V('int', 0, 'core (series fns)'),
    patched:       V('bool', false, 'core (series fns)'),
    e3: V('object', null, 'core', false), sh: V('object', null, 'shell', false), cm: V('object', null, 'comms', false),
    md: V('object', null, 'media', false), rm: V('object', null, 'room', false), fl: V('object', null, 'flow', false),
  };

  G.STAGE_KEYS = ['e3_played', 'e3_dnd', 'easyBack'];
  const freshStage = () => ({ e3_played: true, e3_dnd: false, easyBack: null });

  const copy = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  G.applyVarDefaults = function (state) {
    if (!state || typeof state !== 'object') return;
    state.ep = 3;
    if (!state.stage || typeof state.stage !== 'object' || !own(state.stage, 'e3_played')) state.stage = freshStage();
    if (!state.vars || typeof state.vars !== 'object') state.vars = {};
    Object.keys(G.VARS).forEach((k) => {
      const d = G.VARS[k];
      if (!d.seed || own(state.vars, k)) return;
      state.vars[k] = copy(d.def);
    });
  };
  if (G.state) G.applyVarDefaults(G.state);
})();
