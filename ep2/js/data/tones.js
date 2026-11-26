/* =========================================================
 * ep2/js/data/tones.js — G.tones: notification-tone registry, routing, settings, previews, his-tone ledger (owner: audio)
 * DESIGN §3.11 (원장), §4.8 (소리 열), §7.2 D, §9.7 (알림음 라우팅), ARCH §4.10.
 * Diegetic rule: the receiving phone's settings decide the sound.
 *   list                          [{id, label, sub, cue}] — 알림 소리 rows in screen order (labels verbatim §3.11)
 *   getDefault() → id             vars.toneDefault ('dash' = his sound until restored)
 *   setDefault(id, {preview=true, screenKey='sound.notif'})   id ≠ 'dash' ⇒ flag toneRestored (§3.11, §0.2 T15); plays it once
 *   getChat(chat) → id|null       'seah_y' → 'dash' (unchangeable — 0 messages) · 'fake' → vars.toneChatFake · else null (= default)
 *   setChat('fake', id, {preview=true, screenKey})          other chats are not changeable (DEBUG warn)
 *   for({app, chat}) → id|null    chat seah_y → 'dash' · chat fake → toneChatFake · app 'alerts' → null (재난 알림 = silent) · else default
 *   play(id|'inapp', {ledger=true, vibrate=true, gainDb=0})  — ONLY shell calls this (G.phone.notify; settings previews go through preview)
 *        'dash' + ledger ⇒ vars.dir.himTone++ (DEBUG warn > 11); vibration from G.audio.vibrate: his [60,60,60] · {N}'s [40]; 'inapp' = msg.inapp
 *   preview(id, {screenKey}) → bool   settings preview; his sound once per screenKey and ≤ 2 in total (원장 "설정 미리 듣기 ≤ 2"),
 *        revisiting the same screen previews silently. Persisted in vars.au.prev.
 * Flags set: toneRestored. Vars set: toneDefault, toneChatFake, dir.himTone (ledger counter), au.prev.
 * Data + lazy functions only — no cross-owner call at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const LIST = [
    { id: 'dash', label: '—', sub: '추가한 소리 · 2026.11.25', cue: 'him.tone', vib: 'him' },
    { id: 'water', label: '물방울', cue: 'tone.drop', vib: 'n' },
    { id: 'toktok', label: '톡톡', sub: '(기본)', cue: 'n.tone', vib: 'n' },
    { id: 'bell', label: '종소리', cue: 'tone.chime', vib: 'n' },
  ];
  const IDS = LIST.map((t) => t.id);
  const warn = (...a) => { if (G.DEBUG) console.warn('[tones]', ...a); };
  function getVar(k) { try { if (G.vars) return G.vars(k); } catch (e) {} return G.state && G.state.vars ? G.state.vars[k] : undefined; }
  function setVar(k, v) { try { if (G.vars) { G.vars(k, v); return; } } catch (e) {} if (G.state && G.state.vars) G.state.vars[k] = v; }
  function save() { try { G.save && G.save(); } catch (e) {} }
  function au() { const v = G.state && G.state.vars; if (!v) return {}; return (v.au = v.au || {}); }
  const entry = (id) => LIST.find((t) => t.id === id) || null;

  const T = (G.tones = {
    list: LIST,
    get: entry,
    getDefault() { const d = getVar('toneDefault'); return IDS.indexOf(d) >= 0 ? d : 'dash'; },
    setDefault(id, o) {
      o = o || {};
      if (IDS.indexOf(id) < 0) { warn('setDefault: unknown tone', id); return; }
      setVar('toneDefault', id);
      if (id !== 'dash') { try { if (G.flag && !G.flag('toneRestored')) G.flag('toneRestored', true); } catch (e) {} }
      save();
      if (o.preview !== false) T.preview(id, { screenKey: o.screenKey || 'sound.notif' });
    },
    getChat(chat) {
      if (chat === 'seah_y') return 'dash';
      if (chat === 'fake') { const x = getVar('toneChatFake'); return IDS.indexOf(x) >= 0 ? x : 'dash'; }
      return null;
    },
    setChat(chat, id, o) {
      o = o || {};
      if (chat !== 'fake') { warn('setChat: only the fake chat is changeable', chat); return; }
      if (IDS.indexOf(id) < 0) { warn('setChat: unknown tone', id); return; }
      setVar('toneChatFake', id); save();
      if (o.preview !== false) T.preview(id, { screenKey: o.screenKey || 'notif.perChat.fake' });
    },
    for(o) {
      o = o || {};
      if (o.chat === 'seah_y') return 'dash';
      if (o.chat === 'fake') return T.getChat('fake');
      if (o.app === 'alerts') return null;
      return T.getDefault();
    },
    play(id, o) {
      o = o || {};
      if (id == null) return;
      const A = G.audio;
      if (id === 'inapp') { A && A.cue && A.cue('msg.inapp', { gainDb: o.gainDb || 0 }); return; }   // in-app pop — outside the ledger
      const t = entry(id);
      if (!t) { warn('play: unknown tone', id); return; }
      if (A && A.cue) A.cue(t.cue, { gainDb: o.gainDb || 0 });
      if (o.vibrate !== false && A && A.vibrate) A.vibrate(t.vib);
      if (id === 'dash' && o.ledger !== false) ledger();
    },
    preview(id, o) {
      o = o || {};
      if (!entry(id)) return false;
      const key = o.screenKey || 'settings';
      if (id === 'dash') {
        const a = au(); a.prev = a.prev || {};
        if (a.prev[key] || Object.keys(a.prev).length >= 2) return false;            // revisit ⇒ silent preview; his previews ≤ 2
        a.prev[key] = 1; save();
      }
      T.play(id, { ledger: true, vibrate: false, gainDb: o.gainDb || 0 });
      return true;
    },
    ledger() { const d = G.state && G.state.vars && G.state.vars.dir; return (d && d.himTone) || 0; },
  });
  function ledger() {
    const v = G.state && G.state.vars; if (!v) return;
    const d = (v.dir = v.dir || {});
    d.himTone = (d.himTone || 0) + 1;
    if (d.himTone > 11) warn('his-tone ledger', d.himTone, '> 11 (§3.11 원장)');
    save();
  }
})();
