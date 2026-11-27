/* =========================================================
 * ep3/js/gate.js — engine check + the title's one link back to the episode picker (core · ARCH_EP3 §5.5 · DESIGN_EP3 §9.9).
 *   = ep2/js/gate.js with isReleased(2) → isReleased(3) and fl2-title / fl2-t-smalls / fl2-small → fl3-*.
 *   Loaded in ep3/index.html right after ../engine/series.js and before any engine / flow script (the first executing code).
 *   Episode 3 opens by its direct URL with no parameters (RELEASES[3] = 0 in engine/series.js — the one source). The page stays
 *   fail-closed for a broken series engine: if engine/series.js is missing or G.series.isReleased(3) is not true, the page hides
 *   its body, stops parsing (window.stop — no later <script> runs) and replaces itself with the picker (../series/ · file: →
 *   ../series/index.html). Then nothing boots: no ep3 save, no 'eps.3 started', no listener, no timer, no storage.
 * Exposes G.gate = { released() → bool, titleLink(node) → <a> | null }
 *   titleLink(node): puts the single quiet '다른 이야기' link (a.fl3-small · data-qa title.series) into node.
 *   Also automatic, like ep2: whenever a .fl3-title scene is added to #screen, the link is appended to its .fl3-t-smalls row
 *   unless the title already holds one (never two links — §10 K).
 * Player-facing text: '다른 이야기' only (DESIGN §4.0 · G.STORY.cards.title.series). No storage, no network, no timers.
 * ========================================================= */
(function () {
  'use strict';
  var W = window, D = document, L = W.location;
  var picker = '../series/' + (L.protocol === 'file:' ? 'index.html' : '');
  var S = W.G && W.G.series;
  var open = false;
  try { open = !!(S && S.isReleased && S.isReleased(3)); } catch (e) { open = false; }

  if (!open) {
    try { if (D.body) D.body.style.visibility = 'hidden'; } catch (e) {}
    try { W.stop(); } catch (e) {}          // abort the parser: no later <script> runs
    L.replace(picker);
    return;
  }

  /* ---------- the title link back to the picker ---------- */
  var href = picker;
  var LABEL = '다른 이야기';
  function label() {
    try { var c = W.G && W.G.STORY && W.G.STORY.cards && W.G.STORY.cards.title; if (c && typeof c.series === 'string' && c.series) return c.series; } catch (e) {}
    return LABEL;
  }
  function makeLink() {
    var a = D.createElement('a');
    a.className = 'fl3-small';
    a.href = href;
    a.setAttribute('data-qa', 'title.series');
    a.style.display = 'inline-flex';
    a.style.alignItems = 'center';
    a.textContent = label();
    return a;
  }
  function titleOf(node) { return node && node.closest ? (node.closest('.fl3-title') || node) : node; }
  function titleLink(node) {
    if (!node || node.nodeType !== 1) return null;
    var scope = titleOf(node);
    var have = scope.querySelector ? scope.querySelector('[data-qa="title.series"]') : null;
    if (have) { if (have.parentNode !== node && node !== scope) node.appendChild(have); return have; }   // move, never duplicate
    var a = makeLink();
    node.appendChild(a);
    return a;
  }
  function addLink(node) {
    if (!node || node.nodeType !== 1 || !node.classList || !node.classList.contains('fl3-title')) return;
    if (node.querySelector('[data-qa="title.series"]')) return;
    var row = node.querySelector('.fl3-t-smalls');
    if (!row) return;
    row.appendChild(makeLink());
  }
  function watch() {
    var scr = D.getElementById('screen');
    if (!scr) return;
    Array.prototype.forEach.call(scr.children, addLink);
    if (!W.MutationObserver) return;
    // direct children only (scenes are appended to #screen) — the callback runs after the title has its rows
    new W.MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, addLink); });
    }).observe(scr, { childList: true });
  }
  W.G = W.G || {};
  W.G.gate = { released: function () { try { return !!(S && S.isReleased && S.isReleased(3)); } catch (e) { return false; } }, titleLink: titleLink };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', watch); else watch();
})();
