/* =========================================================
 * ep3 data · memos.js (owner: media) → G.STORY.memos (v:3) — read by engine/apps/memo.js.
 * DESIGN_EP3 §4.8.4 폴더 › 메모 · §5.2 📁 메모 · §0.1 #9 · §0.3 D45: `메모 없음`, no new-memo button (in-game
 * simplification — mom's notes live in 톡 `나와의 채팅`; the player's own notes are the notebook 메모 tab).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.memos = { v: 3, title: '메모', empty: '{$memoEmpty}', newButton: false };
})();
