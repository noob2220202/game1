/* =========================================================
 * ep2/js/data/subs.js — G.SUBS: the sound-subtitle table S00–S28 (owner: audio)
 * DESIGN §7.4 = §4.9.2 (same table, same numbers), copied verbatim. Rendered by G.audio.sub(id, {az, text, ms}):
 *   kind 'info'  — 정보 자막 (default ON, ⏸ 소리 자막 › 정보만) · 'mood' — 분위기 자막 (only ⏸ 소리 자막 › 모두) ·
 *   'voice' — speech (always). No direction words; direction comes from HRTF / speaker-mode arcs / G.room.dirSub(az).
 *   `video` = wording when vars.c2Src === 'video' (§0.2 E5: '오르골' → '소리').
 *   `player:true` = drawn INSIDE a player by its owner (voiceBubble / framePlayer / recorder / hook overlay);
 *   G.SUBS is still their text source (t0/t1 = playback window in seconds).
 * Intentionally empty (no entry, never call): cold open 0–16 s · B03 · B09 · B17 00:39 · notification tones · the hook's 삐요.
 * S06/S13 have no fixed azimuth ("그 순간의 방위") — the caller passes { az }.
 * S09 is split by btVol: S09a < 50 · S09b 50–89 · S09c ≥ 90. S24 (m.gust) = '[바람]', S24g = '[돌풍]', S24v = video '[바람 소리]'.
 * S18 keeps the name token {police} (expanded by G.T at render — §9.6; the audio file itself says 서강경찰서).
 * Data only — no code runs at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.SUBS = {
    S00: { text: '♪ (작게 — 오르골)', kind: 'info', ms: 3000, az: 0 },
    S01: { text: '[지지직… 아주 작게]', kind: 'info', ms: 2400, az: 70 },
    S02: { text: '[부팅음]', kind: 'info', ms: 2000, az: 270 },
    S03: { text: '[멀리서 종소리]', kind: 'info', ms: 2400, az: null },
    S04: { text: '[지직—]', kind: 'info', ms: 1600, az: 70 },
    S05: { text: '[지직]', kind: 'info', ms: 800, az: 70 },
    S06: { text: '[눈 밟는 소리 — 아주 작게]', kind: 'info', ms: 2400, az: null },
    S07: { text: '[드릴 소리]', kind: 'info', ms: 2400, az: 0 },
    S08: { text: '[드릴 소리가 잠깐 멎는다]', kind: 'info', ms: 1500, az: 0 },
    S09a: { text: '♪ (멀리서, 아주 작게 — 오르골)', video: '♪ (멀리서, 아주 작게 — 소리)', kind: 'info', ms: 3000, az: 115, btVol: [0, 49] },
    S09b: { text: '♪ (멀리서 — 오르골)', video: '♪ (멀리서 — 소리)', kind: 'info', ms: 3000, az: 115, btVol: [50, 89] },
    S09c: { text: '♪ (멀리서, 크게 — 오르골)', video: '♪ (멀리서, 크게 — 소리)', kind: 'info', ms: 3000, az: 115, btVol: [90, 100] },
    S10: { text: '[드릴 소리가 멎는다]', kind: 'info', ms: 1600, az: 0 },
    S11: { text: '[철컥]', kind: 'info', ms: 1200, az: 0 },
    S12: { text: '[문 너머, 숨소리]', kind: 'info', ms: 1600, az: 0 },
    S13: { text: '[눈 밟는 소리 — 멀어진다]', kind: 'info', ms: 2400, az: null },
    S14: { text: '♪ (오르골이 뚝 끊긴다)', video: '♪ (소리가 뚝 끊긴다)', kind: 'info', ms: 2000, az: 115 },
    S14v: { text: '♪ (소리가 뚝 끊긴다)', kind: 'info', ms: 2000, az: 115 },
    S15: { text: '[사이렌]', kind: 'info', ms: 3000, az: null },
    S16: { text: '[멀리서 — 덜컥]', kind: 'info', ms: 2000, az: 115 },
    S17: { text: '[무전 잡음]', kind: 'info', ms: 2000, az: 70 },
    S18: { text: '(문 너머) {police} 강수진입니다. 밖은 확인했어요. 천천히 여셔도 돼요.', kind: 'voice', ms: 5300, az: 0 },   // v2_kang_door 4.97 s + 0.3 s (§7.4 — as long as the playback)
    S19: { kind: 'voice', player: true, text: '형사님이 세아 오르골 사진 보여 주셨어요.',
      lines: [
        { t0: 0.0, t1: 4.2, text: '형사님이 세아 오르골 사진 보여 주셨어요.' },
        { t0: 4.4, t1: 9.6, text: '{N} 씨가 감았을 때 한 마디만 나왔다면서요.' },
        { t0: 9.8, t1: 14.0, text: '세아가 9월에 고친 건데…' },
      ] },
    S20: { text: '[철문 삐걱이는 소리]', kind: 'info', player: true, t0: 9.0, t1: 11.2 },
    S21: { text: '[휘파람]', kind: 'info', player: true, t0: 5.0, t1: 8.0 },
    S22: { text: '[허밍]', kind: 'info', player: true, t0: 1.7, t1: 8.4 },
    S23: { text: '[딸깍]', kind: 'mood', ms: 1200, az: 55 },
    S24: { text: '[바람]', kind: 'mood', ms: 1600, az: null },
    S24g: { text: '[돌풍]', kind: 'mood', ms: 1600, az: null },
    S24v: { text: '[바람 소리]', kind: 'mood', player: true, windows: { 'vid.move': [0, 8], 'vid.roof': [0, 4] } },
    S25: { text: '♪', kind: 'mood', ms: 2000, az: null },
    S26: { text: '♪ (도어락 열림)', kind: 'info', ms: 1600, az: 0 },
    S27: { text: '♪ (오르골)', kind: 'info', player: true, t0: 0, t1: 27 },
    S27b: { text: '[딸깍 딸깍]', kind: 'info', player: true, t0: 27, t1: 31 },
    S28: { text: '[벨소리]', kind: 'info', player: true, t0: 0, t1: 5 },
  };
  /** S09 id for a Bluetooth volume (climax: on bt play start + every volume step change) */
  G.SUBS.s09For = function (btVol) { return btVol >= 90 ? 'S09c' : btVol >= 50 ? 'S09b' : 'S09a'; };
  Object.defineProperty(G.SUBS, 's09For', { enumerable: false });
})();
