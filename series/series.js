/* =========================================================
 * series/series.js — root episode picker 'MT-A 불 켜진 집' (SERIES §7.3 '루트 에피소드 선택 화면 방문' · §7.4 · §7.9 ·
 * §4.1 운영 규칙 · DESIGN_EP2 §12).
 *   Visit: G.series.ensure() → backfillEp1() (bible §7.4) → read-only status per episode. Nothing else is written.
 *   A night building drawn in SVG: one window per released episode home (404 = ep1, 601 = ep2 옥탑, 702 = ep3 — a window of the
 *   second building behind the villa on the right: a Daejeon apartment block, 16 floors, no text — DESIGN_EP3 §9.9). A
 *   window is lit when that episode is done / canon in haru-escape.series.v1, dark otherwise; ♪ on a lit window whose 세아
 *   signal was found (ep3: seen.e3_grey or sea has sig_name).
 *   The first released, unfinished episode gets a subtle row border (.rec, no label) — order is never enforced (gifts are not locked).
 *   Every episode is open (G.series.isReleased is true for 1-3).
 *   Footer (bible §7.1 · §7.7 · DESIGN_EP2 §9.2): '시리즈 기록 지우기' = haru-escape.series.v1 + .bak only (G.series.clearAll);
 *   '모든 기록 지우기' = that + every episode save (ep1 CONFIG.SAVE_KEY, haru-escape.ep<n>.save.v1, their backups, the
 *   ep<n> free-text session store). Settings (haru-escape.settings.v1) stay. Both behind a two-step in-page confirm;
 *   a series-only clear is re-derived from an existing ep1 save on the re-render (backfillEp1 — bible §7.4, expected).
 * QA: <html data-released data-lit data-sig data-rec> · data-qa picker.win:<room> · picker.ep:<n> ·
 *   picker.clear.series · picker.clear.all · picker.dlg (data-step 1|2) · picker.dlg.cancel · picker.dlg.ok.
 * No storage of its own, no network, no timers that write. Works on file:// and http(s).
 * ========================================================= */
(function () {
  'use strict';
  var W = window, D = document, L = W.location;
  var G = W.G || {};
  var S = G.series || null;
  var CFG = W.CONFIG || {};
  var FILE = L.protocol === 'file:';
  var REDUCE = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var E1KEY = typeof CFG.SAVE_KEY === 'string' && CFG.SAVE_KEY ? CFG.SAVE_KEY : 'haru-escape.save.v1';   // ep1 js/core/base.js default
  var SKEY = S && S.KEY ? S.KEY : 'haru-escape.series.v1';

  /* ---------- name (same particle rule as ep1 js/main.js) ---------- */
  var NAME = typeof CFG.PLAYER_NAME === 'string' && CFG.PLAYER_NAME.trim() ? CFG.PLAYER_NAME.trim() : '하루';
  function batchim(s) { var c = s.charCodeAt(s.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; }
  var NREUL = NAME + (batchim(NAME) ? '을' : '를');

  /* ---------- building geometry (viewBox 320 × 360) ---------- */
  var VW = 320, VH = 360, GROUND = 330, FH = 52, BX = 50, BW = 220;
  var COLS = [68, 119, 169, 220], WW = 32, WH = 26;
  function top(f) { return GROUND - FH * f; }
  var WINS = {};                                   // room → {x, y, w, h}
  [2, 3, 4, 5].forEach(function (f) { COLS.forEach(function (x, i) { WINS[f + '0' + (i + 1)] = { x: x, y: top(f) + 10, w: WW, h: WH }; }); });
  WINS['101'] = { x: COLS[0], y: top(1) + 12, w: WW, h: WH };
  WINS['104'] = { x: COLS[3], y: top(1) + 12, w: WW, h: WH };
  WINS['601'] = { x: 80, y: 24, w: 34, h: 24 };    // 옥탑
  /* second building (ep3 — DESIGN_EP3 §9.9): one Daejeon apartment block, behind the villa on the right, drawn first.
   * 16 floors · floor height 13 · ground 330 → roof y = 330 − 208 = 122. 3 dark decor windows per floor (x 283 · 293 · 303,
   * 8 × 6 — not WINS); the 7th-floor 293 cell is WINS['702'] (= 02호). The ep2 villa geometry above is unchanged. */
  var B2 = { x: 278, w: 38, fh: 13, floors: 16 };
  function b2Top(f) { return GROUND - B2.fh * f; }
  WINS['702'] = { x: B2.x + 15, y: b2Top(7) + 4, w: 8, h: 6 };   // = x 293 · y 243

  /* ---------- episodes (only homes that exist get a window; future ones stay unlabeled dark panes) ---------- */
  var EPS = [
    { n: 1, room: '404', title: NREUL + ' 위한 방탈출!', sub: '여기 있어', href: '../ep1.html', rec: 'right', seen: [], sea: [] },
    { n: 2, room: '601', title: NREUL + ' 위한 방탈출! 2', sub: '돌려줄게', href: FILE ? '../ep2/index.html' : '../ep2/', rec: 'left',
      seen: ['e2_piyo'], sea: ['sig_piyo', 'sig_fifth'] },
    { n: 3, room: '702', title: NREUL + ' 위한 방탈출! 3', sub: '엄마의 번호', href: FILE ? '../ep3/index.html' : '../ep3/', rec: 'left',
      seen: ['e3_grey'], sea: ['sig_name'] },
  ];

  function safe(fn, d) { try { return fn(); } catch (e) { try { console.error('[picker]', e); } catch (er) {} return d; } }
  function el(tag, cls, text) { var n = D.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function pct(v, of) { return (v / of * 100).toFixed(3) + '%'; }

  /* ---------- status (read-only after ensure + backfill) ---------- */
  function status() {
    if (S) { safe(function () { S.ensure(); }); safe(function () { S.backfillEp1(); }); }
    var sea = S ? safe(function () { return S.sea(); }, []) : [];
    var list = EPS.map(function (e) {
      var rel = e.n === 1 || !!(S && safe(function () { return S.isReleased(e.n); }, false));
      var ep = S ? safe(function () { return S.ep(e.n); }, {}) : {};
      var done = rel && (ep.st === 'done' || ep.canon === true);
      var sig = done && (e.seen.some(function (k) { return !!safe(function () { return S.seen(k); }, false); }) ||
        e.sea.some(function (k) { return sea.indexOf(k) >= 0; }));
      return { e: e, rel: rel, done: done, sig: !!sig, rec: false };
    });
    for (var i = 0; i < list.length; i++) if (list[i].rel && !list[i].done) { list[i].rec = true; break; }
    return list;
  }

  /* ---------- SVG facade ---------- */
  function winSvg(room) {
    var r = WINS[room], x = r.x, y = r.y, w = r.w, h = r.h, cx = x + w / 2, my = y + Math.round(h * 0.45);
    return '<g class="win' + (w < 16 ? ' small' : '') + '" id="w' + room + '">' +
      '<g class="w-on"><rect class="w-halo" x="' + (x - 6) + '" y="' + (y - 6) + '" width="' + (w + 12) + '" height="' + (h + 12) + '" rx="4" filter="url(#pkGlow)"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#pkWarm)"/></g>' +
      '<rect class="w-pane" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>' +
      '<path class="w-mull" d="M' + cx + ' ' + y + 'V' + (y + h) + 'M' + x + ' ' + my + 'H' + (x + w) + '"/>' +
      '<rect class="w-frame" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/></g>';
  }
  /* the second building, drawn before the villa (behind it): body, 3 dark decor windows per floor, rooftop water tank */
  function building2() {
    var top = b2Top(B2.floors), s = '<g class="pk-b2">' +
      '<rect x="' + B2.x + '" y="' + top + '" width="' + B2.w + '" height="' + (GROUND - top) + '" fill="#11131a"/>' +
      '<rect x="' + (B2.x + 9) + '" y="' + (top - 9) + '" width="14" height="9" fill="#141720"/>' +
      '<rect x="' + (B2.x + 8) + '" y="' + (top - 10) + '" width="16" height="2" fill="#1b1e27"/>';
    for (var f = 1; f <= B2.floors; f++) {
      [B2.x + 5, B2.x + 15, B2.x + 25].forEach(function (x) {
        if (f === 7 && x === WINS['702'].x) return;               // WINS['702'] draws this one
        s += '<rect x="' + x + '" y="' + (b2Top(f) + 4) + '" width="8" height="6" fill="#0b0d12"/>';
      });
    }
    return s + '</g>';
  }
  function facade() {
    var s = '<svg class="pk-svg" viewBox="0 0 ' + VW + ' ' + VH + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="pkWarm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9b4"/><stop offset=".55" stop-color="#f6b964"/><stop offset="1" stop-color="#e38e3c"/></linearGradient>' +
      '<linearGradient id="pkWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#191c26"/><stop offset="1" stop-color="#0f1117"/></linearGradient>' +
      '<filter id="pkGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '<linearGradient id="pkStreet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#08090c" stop-opacity="0"/><stop offset=".22" stop-color="#08090c"/><stop offset=".78" stop-color="#08090c"/><stop offset="1" stop-color="#08090c" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="pkCurb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c1f27" stop-opacity="0"/><stop offset=".22" stop-color="#1c1f27"/><stop offset=".78" stop-color="#1c1f27"/><stop offset="1" stop-color="#1c1f27" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      // street (fades out at both ends — no hard edge against the sky)
      '<rect x="0" y="' + GROUND + '" width="' + VW + '" height="' + (VH - GROUND) + '" fill="url(#pkStreet)"/>' +
      '<rect x="0" y="' + GROUND + '" width="' + VW + '" height="1" fill="url(#pkCurb)"/>' +
      '<ellipse cx="160" cy="' + (GROUND + 3) + '" rx="46" ry="5" fill="#ffbe6e" opacity=".07"/>' +
      building2() +
      // roof: 옥탑 unit, water tank, antenna
      '<rect x="62" y="10" width="92" height="6" fill="#1f232d"/>' +
      '<rect x="66" y="16" width="84" height="46" fill="#161920"/>' +
      '<rect x="124" y="30" width="18" height="32" fill="#0c0e13" stroke="#23262f"/>' +
      '<path d="M204 62V54M236 62V54" stroke="#1f232d" stroke-width="3"/>' +
      '<rect x="198" y="28" width="44" height="27" rx="3" fill="#1a1d25"/>' +
      '<ellipse cx="220" cy="28" rx="22" ry="5" fill="#232733"/>' +
      '<path d="M262 62V24M254 32H270M256 40H268" stroke="#22262f" stroke-width="1.4" fill="none"/>' +
      // main block
      '<rect x="46" y="62" width="228" height="8" fill="#1c1f28"/>' +
      '<rect x="' + BX + '" y="70" width="' + BW + '" height="' + (GROUND - 70) + '" fill="url(#pkWall)"/>';
    for (var f = 1; f <= 4; f++) s += '<path d="M' + BX + ' ' + top(f) + 'H' + (BX + BW) + '" stroke="#1b1e27" stroke-width="1"/>';
    // entrance with a dim lamp (not a window — never counts as a lit home)
    s += '<rect x="136" y="' + (top(1) + 8) + '" width="48" height="5" fill="#20242e"/>' +
      '<rect x="146" y="' + (top(1) + 14) + '" width="28" height="' + (GROUND - top(1) - 14) + '" fill="#0b0d12" stroke="#262a34"/>' +
      '<circle cx="160" cy="' + (top(1) + 4) + '" r="10" fill="#ffc782" opacity=".1" filter="url(#pkGlow)"/>' +
      '<circle cx="160" cy="' + (top(1) + 4) + '" r="1.8" fill="#ffd393" opacity=".8"/>';
    Object.keys(WINS).forEach(function (room) { s += winSvg(room); });
    return s + '</svg>';
  }

  /* ---------- navigation (short fade; modifier clicks stay native) ---------- */
  function go(ev) {
    if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    var href = this.href;
    D.body.classList.add('pk-leave');
    setTimeout(function () { L.href = href; }, REDUCE ? 0 : 320);
  }

  /* ---------- clearing (bible §7.1 · §7.6 clearAll · §7.7) — every storage access guarded (memory mode / blocked) ---------- */
  function quiet(fn) { try { fn(); } catch (e) {} }
  function storeKeys(st) {
    var out = [];
    quiet(function () { for (var i = 0; i < st.length; i++) { var k = st.key(i); if (k != null) out.push(k); } });
    return out;
  }
  function isEpSave(k) {   // ep1 save (+ any '<key>.*' backup) · haru-escape.ep<n>.save.v<k> (+ backups)
    return k === E1KEY || k.indexOf(E1KEY + '.') === 0 || /^haru-escape\.ep\d{1,2}\.save\.v\d+(\.|$)/.test(k);
  }
  function clearSeries() {                       // haru-escape.series.v1 + .bak (engine also drops its memory copy)
    if (S && S.clearAll) { S.clearAll(); return; }
    quiet(function () { W.localStorage.removeItem(SKEY); W.localStorage.removeItem(SKEY + '.bak'); });
  }
  function clearEverything() {                   // series + every episode save; settings stay
    var ls = null, ss = null;
    quiet(function () { ls = W.localStorage; });
    quiet(function () { ss = W.sessionStorage; });
    if (ls) storeKeys(ls).filter(isEpSave).forEach(function (k) { quiet(function () { ls.removeItem(k); }); });
    if (ss) storeKeys(ss).filter(function (k) { return /^haru-escape\.ep\d{1,2}\.session$/.test(k); })
      .forEach(function (k) { quiet(function () { ss.removeItem(k); }); });
    clearSeries();
  }
  var ASK = {
    series: { title: '시리즈 기록을 지울까요?', text: '각 편의 진행 상황은 그대로 남아요.', run: clearSeries },
    all: { title: '모든 기록을 지울까요?', text: '모든 편의 진행 상황과 시리즈 기록이 사라져요.', run: clearEverything },
  };
  var SURE = { title: '정말 지울까요?', text: '되돌릴 수 없어요.' };

  /* ---------- two-step in-page confirm (never window.confirm) → Promise<bool> ----------
   * Focus starts on 취소; Esc / backdrop / 취소 = no. '지우기' is ignored for a beat after each step appears, so one
   * double tap can never pass both steps. */
  var ARM_MS = 450;
  function confirm2(first) {
    return new Promise(function (resolve) {
      var prev = D.activeElement, step = 0, shown = 0;
      var wrap = el('div', 'pk-dlg-wrap');
      var box = el('div', 'pk-dlg');
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'pkDlgT');
      box.setAttribute('aria-describedby', 'pkDlgX');
      box.setAttribute('data-qa', 'picker.dlg');
      var t = el('h2', 'pk-dlg-title'); t.id = 'pkDlgT';
      var x = el('p', 'pk-dlg-text'); x.id = 'pkDlgX';
      var btns = el('div', 'pk-dlg-btns');
      var no = el('button', 'pk-dlg-btn', '취소'); no.type = 'button'; no.setAttribute('data-qa', 'picker.dlg.cancel');
      var ok = el('button', 'pk-dlg-btn danger', '지우기'); ok.type = 'button'; ok.setAttribute('data-qa', 'picker.dlg.ok');
      btns.appendChild(no); btns.appendChild(ok);
      box.appendChild(t); box.appendChild(x); box.appendChild(btns);
      wrap.appendChild(box);
      function show(s) {
        step++; shown = Date.now();
        t.textContent = s.title; x.textContent = s.text;
        box.setAttribute('data-step', String(step));
        box.classList.remove('pk-dlg-in'); void box.offsetWidth; box.classList.add('pk-dlg-in');
        quiet(function () { no.focus(); });
      }
      function close(v) {
        D.removeEventListener('keydown', onKey, true);
        root.removeAttribute('aria-hidden'); quiet(function () { root.inert = false; });
        wrap.remove();
        if (prev && prev.focus && D.contains(prev)) quiet(function () { prev.focus(); });
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(false); }
        else if (e.key === 'Tab') { e.preventDefault(); (D.activeElement === no ? ok : no).focus(); }
      }
      no.addEventListener('click', function () { close(false); });
      ok.addEventListener('click', function () {
        if (Date.now() - shown < ARM_MS) return;
        if (step === 1) show(SURE); else close(true);
      });
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(false); });
      D.addEventListener('keydown', onKey, true);
      root.setAttribute('aria-hidden', 'true'); quiet(function () { root.inert = true; });
      D.body.appendChild(wrap);
      show(first);
    });
  }
  var asking = false;
  function ask(kind) {
    if (asking || !ASK[kind]) return;
    asking = true;
    confirm2(ASK[kind]).then(function (yes) {
      asking = false;
      if (!yes) return;
      safe(ASK[kind].run);
      safe(render);                              // ensure() + backfillEp1() again (bible §7.3 · §7.4)
    });
  }

  /* ---------- render ---------- */
  var root = D.getElementById('picker');
  var bldg, list;
  function build() {
    root.textContent = '';
    var head = el('header', 'pk-head');
    var h1 = el('h1', 'pk-name', NREUL + ' 위한 ');
    h1.appendChild(el('em', null, '방탈출!'));
    head.appendChild(h1);
    bldg = el('div', 'pk-bldg');
    bldg.innerHTML = facade();
    list = el('nav', 'pk-list');
    list.setAttribute('aria-label', NREUL + ' 위한 방탈출!');
    var foot = el('footer', 'pk-foot');
    [['series', '시리즈 기록 지우기'], ['all', '모든 기록 지우기']].forEach(function (b) {
      var n = el('button', 'pk-clear', b[1]);
      n.type = 'button';
      n.setAttribute('data-qa', 'picker.clear.' + b[0]);
      n.addEventListener('click', function () { ask(b[0]); });
      foot.appendChild(n);
    });
    root.appendChild(head); root.appendChild(bldg); root.appendChild(list); root.appendChild(foot);
  }

  function render() {
    var st = status();
    // windows: reset, then light / label released homes
    Array.prototype.forEach.call(bldg.querySelectorAll('.pk-win'), function (n) { n.remove(); });
    Array.prototype.forEach.call(bldg.querySelectorAll('.win.lit'), function (n) { n.classList.remove('lit'); });
    list.textContent = '';
    var lit = [], rel = [], sig = [], rec = '';
    st.forEach(function (x, i) {
      if (!x.rel) return;                                         // unreleased: an ordinary dark window, nothing else
      var e = x.e, r = WINS[e.room], href = e.href;
      rel.push(e.n);
      if (x.done) lit.push(e.n);
      if (x.sig) sig.push(e.n);
      if (x.rec) rec = String(e.n);
      var g = bldg.querySelector('#w' + e.room);
      if (g && x.done) { g.classList.add('lit'); g.style.setProperty('--d', (0.25 + i * 0.35) + 's'); }

      var a = el('a', 'pk-win' + (x.done ? ' lit' : ''));
      a.href = href;
      a.setAttribute('data-qa', 'picker.win:' + e.room);
      a.setAttribute('aria-hidden', 'true');
      a.tabIndex = -1;
      a.style.left = pct(r.x, VW); a.style.top = pct(r.y, VH); a.style.width = pct(r.w, VW); a.style.height = pct(r.h, VH);
      a.appendChild(el('span', 'pk-num', e.room));
      if (x.sig) a.appendChild(el('span', 'pk-sig', '♪'));
      a.addEventListener('click', go);
      bldg.appendChild(a);

      var row = el('a', 'pk-row' + (x.done ? ' lit' : '') + (x.rec ? ' rec' : ''));
      row.href = href;
      row.setAttribute('data-qa', 'picker.ep:' + e.n);
      row.setAttribute('aria-label', e.room + ' · ' + e.title + (e.sub ? ' · ' + e.sub : ''));
      row.appendChild(el('span', 'pk-glyph'));
      row.appendChild(el('span', 'pk-room', e.room));
      var t = el('span', 'pk-titles');
      t.appendChild(el('span', 'pk-title', e.title));
      if (e.sub) t.appendChild(el('span', 'pk-sub', e.sub));
      row.appendChild(t);
      if (x.sig) row.appendChild(el('span', 'pk-note', '♪'));
      row.appendChild(el('span', 'pk-chev', '›'));
      row.addEventListener('click', go);
      list.appendChild(row);
    });
    var h = D.documentElement;
    h.setAttribute('data-released', rel.join(','));
    h.setAttribute('data-lit', lit.join(','));
    h.setAttribute('data-sig', sig.join(','));
    h.setAttribute('data-rec', rec);
  }

  function boot() {
    if (!root) return;
    build();
    render();
    // another tab finished an episode → re-read; back/forward cache → fresh state, fade undone
    W.addEventListener('storage', function (e) { if (!e || !e.key || e.key === SKEY || e.key === E1KEY) safe(render); });
    W.addEventListener('pageshow', function (e) { D.body.classList.remove('pk-leave'); if (e && e.persisted) safe(render); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
