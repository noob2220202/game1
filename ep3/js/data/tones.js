/* =========================================================
 * ep3/js/data/tones.js — G.tones: 엄마 폰's notification sound (owner: audio)
 * DESIGN_EP3 §4.13 (소리 열: 문자 = 기본 문자음 '딩동' + navigator.vibrate(80) · 0 = 무음) · §7.2 D (`sms.mom` · `msg.inapp`) ·
 * §9.7 (진동) · ARCH_EP3 §5.17 · §4.2 phone.js (h). One sound exists on this phone: the default SMS tone. His tone does not
 * exist in ep3 (§0 · §6.4-③ budget 0) and Settings never shows a tone picker (§5.0-2 ⑦).
 *   list                          [{ id:'sms', label:'기본', cue:'sms.mom' }]
 *   for({ app, chat }) → 'sms' | null       only the 메시지 app rings (톡 · 캘린더 · 모임 · 시계 · 사진 = 0 tonight — §4.13)
 *   play(id | 'inapp', { gainDb, vibrate=true })   ONLY shell G.phone.notify calls it. 'sms' → cue sms.mom (+ G.audio.vibrate('sms')
 *                                   = [80] when vibrate !== false ∧ G.settings.vibration !== false); 'inapp' → msg.inapp (no vibration)
 *   vibKey(id) → 'sms'              read by shell notify in soundMode 'vibrate' (G.audio.vibrate(G.tones.vibKey(id)))
 *   cap: 0                          no "4th tone of a chat → vibrate only" rule in ep3 (shell notify skips it when cap === 0)
 *   getDefault() → 'sms' · get(id)  compatibility with the engine settings reader (never drawn in ep3)
 * Muting (vars.soundMode · vars.dndNow · vars.dnd) is shell's — this table never reads it.
 * Flags / vars set: none. Data + lazy functions only — no cross-owner call at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const LIST = [{ id: 'sms', label: '기본', cue: 'sms.mom', vib: 'sms' }];
  const entry = (id) => LIST.find((t) => t.id === id) || null;
  const warn = (...a) => { if (G.DEBUG) console.warn('[tones]', ...a); };

  const T = (G.tones = {
    list: LIST,
    cap: 0,
    get: entry,
    getDefault() { return 'sms'; },
    for(o) { o = o || {}; return o.app === 'sms' ? 'sms' : null; },
    vibKey() { return 'sms'; },
    play(id, o) {
      o = o || {};
      if (id == null) return;
      const A = G.audio;
      if (!A) return;
      if (id === 'inapp') { if (A.cue) A.cue('msg.inapp', { gainDb: o.gainDb || 0 }); return; }   // the open conversation's small pop
      const t = entry(id);
      if (!t) { warn('play: unknown tone', id); return; }
      if (A.cue) A.cue(t.cue, { gainDb: o.gainDb || 0 });
      if (o.vibrate !== false && !(G.settings && G.settings.vibration === false) && A.vibrate) A.vibrate(t.vib);
    },
    preview() { return false; },                 // no tone screen in ep3
    setDefault() { warn('setDefault: ep3 has one tone'); },
    getChat() { return null; },
    setChat() { warn('setChat: ep3 has no per-chat tones (ARCH §1)'); },
    ledger() { return 0; },                      // his tone: 0 (§6.4-③)
  });
  void T;
})();
