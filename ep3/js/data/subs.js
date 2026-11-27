/* =========================================================
 * ep3/js/data/subs.js — G.SUBS: the episode-3 sound-subtitle table S01–S23 (owner: audio)
 * DESIGN_EP3 §7.4 (ids · length · place · kind) = §4.14.3 (text — copied to the character · §0.3 D29). ARCH_EP3 §5.17 · §6.19.
 * Rendered by G.audio.sub(id, { az, text, ms, i }) (engine/core/audio.js):
 *   kind 'info'  — 정보 자막, default ON (⏸ 소리 자막 › 정보만) · 'mood' — 분위기 자막, only with ⏸ 소리 자막 › 모두 ·
 *   'voice' — speech (S02–S04, always unless subtitles are off).
 *   az = degrees in the CURRENT listener's frame (L0 거실 · LS 세아 방 · LT 식탁 — §7.1.2); a function picks the LS value while
 *   {N} is in 세아 방 (G.audio.listener() === 'LS'). null = bottom centre. G.room.dirSub draws it at that direction when the room
 *   view is open, else G.fx.sub at the bottom (§7.4 rule 1 — no direction words in the text).
 *   S07less replaces S07 automatically while 덜 무섭게 (engine rule `<id>less`).
 *   S17 · S18 · S23 are arrays of variants — call the named variant (S17a S17b · S18chair S18slip S18door S18blanket ·
 *   S23run S23walk) or G.audio.sub('S17', { i }) with its index.
 *   player:true = drawn INSIDE the callrec player by comms (S12 over 8.6–15.4 · 22.6–30.9, S13 while a plain recording plays) —
 *   this table is only their text source.
 * Intentionally empty (no entry, never call — §7.4 rule 4 · D28): the recording's 0:21 whisper, the 0:30 radio-like sound, the
 *   0th hum, the 03:33 whisper leak, the B13 4-second silence, the 06:10 boiler sting, everything of his (none exists).
 * Rule 3 (callers): no sound subtitle while a card on screen says the same event; a monologue goes first, subtitles +0.5 s.
 * Callers (ARCH §5.17 cue table): flow scenes S15–S17 · flow call S01–S05 · room door S06–S09 S19 S23 · flow director S10 S11 S22 ·
 *   comms callrec S12 S13 · room memory S14 · flow ending S20 S21 · S18 the owner of the movement.
 * Data only — no code runs at load time (the az functions are lazy).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const lis = () => { try { return (G.audio && G.audio.listener && G.audio.listener()) || 'L0'; } catch (e) { return 'L0'; } };
  const W = (l0, ls) => () => (lis() === 'LS' ? ls : l0);           // listener-dependent azimuth (L0 / LT value, LS value)

  const S17a = { text: '[소파 — 잠든 숨소리]', kind: 'mood', ms: 2000, az: 185 };
  const S17b = { text: '[세아 방 문 앞 — 작은 숨소리]', kind: 'mood', ms: 2000, az: 30 };
  const S18chair = { text: '[의자 소리]', kind: 'mood', ms: 1600, az: null };
  const S18slip = { text: '[슬리퍼 소리]', kind: 'mood', ms: 1600, az: null };
  const S18door = { text: '[문이 작게 삐걱인다]', kind: 'mood', ms: 1600, az: W(30, 200) };
  const S18blanket = { text: '[담요 스치는 소리]', kind: 'mood', ms: 1600, az: null };
  const S23run = { text: '[콩이가 달려간다]', kind: 'mood', ms: 1600, az: W(15, 196) };
  const S23walk = { text: '[콩이 발소리]', kind: 'mood', ms: 1600, az: W(15, 196) };

  G.SUBS = {
    S01: { text: '[식탁 — 톡 착신음]', kind: 'info', ms: 3200, az: 270 },
    S02: { text: '엄마: 여보세요?', kind: 'voice', ms: 1800, az: 270 },
    S03: { text: '엄마: …세아야?', kind: 'voice', ms: 1800, az: 270 },
    S04: { text: '엄마: 세아야, 엄마야.', kind: 'voice', ms: 2400, az: 270 },
    S05: { text: '[수화기 너머 — 아주 작은 허밍]', kind: 'info', ms: 3200, az: 270 },
    S06: { text: '[현관 · 삐삐삐]', kind: 'info', ms: 2400, az: W(0, 190) },
    S07: { text: '[콩이가 현관을 향해 짧게 두 번 짖는다]', kind: 'info', ms: 3000, az: W(0, 192) },
    S07less: { text: '[콩이가 현관을 향해 짧게 짖는다]', kind: 'info', ms: 3000, az: W(0, 192) },
    S08: { text: '[문 너머 — 두 사람 발소리]', kind: 'info', ms: 3200, az: W(0, 191) },
    S09: { text: '[멀리서 — 방화문 닫히는 소리]', kind: 'mood', ms: 1600, az: W(345, 186) },
    S10: { text: '[베란다 — 보일러가 켜진다]', kind: 'info', ms: 2400, az: W(90, 196) },
    S11: { text: '[보일러가 켜진다]', kind: 'mood', ms: 1600, az: W(90, 196) },
    S12: { text: '[통화 녹음 — 허밍]', kind: 'info', ms: 3200, az: null, player: true, windows: [[8.6, 15.4], [22.6, 30.9]] },
    S13: { text: '[통화 소리]', kind: 'info', ms: 3200, az: null, player: true },
    S14: { text: '[허밍]', kind: 'info', ms: 4700, az: 165 },
    S15: { text: '[냉장고 소리]', kind: 'mood', ms: 2400, az: 255 },
    S16: { text: '[벽시계 소리]', kind: 'mood', ms: 1600, az: 180 },
    S17: [S17a, S17b], S17a, S17b,
    S18: [S18chair, S18slip, S18door, S18blanket], S18chair, S18slip, S18door, S18blanket,
    S19: { text: '[휴대전화 진동 — 식탁]', kind: 'mood', ms: 1600, az: W(275, 212) },
    S20: { text: '[방울 — 딸랑]', kind: 'info', ms: 2000, az: 48 },
    S21: { text: '♪', kind: 'mood', ms: 2000, az: null },
    S22: { text: '[멀리서 버스 지나가는 소리]', kind: 'mood', ms: 2000, az: 90 },
    S23: [S23run, S23walk], S23run, S23walk,
  };
})();
