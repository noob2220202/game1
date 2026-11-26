/* =========================================================
 * ep2/js/gate.js — release gate + title link back to the episode picker (DESIGN_EP2 §12 MT-A · SERIES §4.1 · §7.9).
 *   Loaded in ep2/index.html right after ../engine/series.js and before any engine / flow script, so nothing boots,
 *   saves or touches haru-escape.series.v1 when the gate closes.
 *   Gate: before G.series.isReleased(2) (release table in engine/series.js — the one source) the page stops parsing and
 *   replaces itself with the picker (../series/). Bypass: ?debug=1 (QA drivers) or ?preview=1 (maker phone test; it is
 *   also honoured by isReleased itself). If engine/series.js is missing the gate stays closed.
 *   Title link: one quiet '다른 이야기' link (a.fl2-small, data-qa title.series) appended to the title's .fl2-t-smalls row
 *   whenever the title scene is added to #screen. It keeps ?preview=1. No shared ep2 flow file is edited.
 * No storage, no network, no timers. Player-facing text: '다른 이야기' only.
 * ========================================================= */
(function () {
  'use strict';
  var W = window, D = document, L = W.location;
  var q = L.search || '';
  var preview = /[?&]preview=1\b/.test(q);
  var debug = /[?&]debug=1\b/.test(q);
  var picker = '../series/' + (L.protocol === 'file:' ? 'index.html' : '');
  var S = W.G && W.G.series;
  var open = debug || preview;
  if (!open) { try { open = !!(S && S.isReleased && S.isReleased(2)); } catch (e) { open = false; } }

  if (!open) {
    try { if (D.body) D.body.style.visibility = 'hidden'; } catch (e) {}
    try { W.stop(); } catch (e) {}          // abort the parser: no later <script> runs
    L.replace(picker);
    return;
  }

  /* ---------- title link back to the picker ---------- */
  var href = picker + (preview ? '?preview=1' : '');
  function addLink(node) {
    if (!node || node.nodeType !== 1 || !node.classList || !node.classList.contains('fl2-title')) return;
    var row = node.querySelector('.fl2-t-smalls');
    if (!row || row.querySelector('[data-qa="title.series"]')) return;
    var a = D.createElement('a');
    a.className = 'fl2-small';
    a.href = href;
    a.setAttribute('data-qa', 'title.series');
    a.style.display = 'inline-flex';
    a.style.alignItems = 'center';
    a.textContent = '다른 이야기';
    row.appendChild(a);
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
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', watch); else watch();
})();
