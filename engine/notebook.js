/* =========================================================
 * engine/notebook.js (flow) — `{N의} 수첩` for episode 2 (DESIGN_EP2 §2.4 · §4.0 수첩 · ARCH §4.17).
 * Always reachable: ✎ tab at the right edge (z 60 — over apps, lock, eye views, dialogs, switch shell).
 * Tabs: 할 일 (objective cards, show/done policy from G.OBJECTIVES) · 힌트 (3 tiers, 2 s hold,
 *       T2 = T1 + 60 s, T3 = T2 + 60 s, T3 = the answer) · 메모 (player-written only, predict:false).
 * HARD MODE: no auto-notes, no leads, no fragments, no '새 단서' dot, no ping, no toast, no idle nudge.
 *   note / lead / leadDone / flash / autoHint exist as NO-OPS (DEBUG warns) so stale callers never break.
 * A newly finished card is checked quietly: the pen sound plays once, the first time the check is drawn
 * inside the open notebook (never while it is closed — a sound outside the notebook would be a detector).
 *
 * API: G.notebook = { init(), open(tab='todo'|'hint'|'memo', objectiveId?), close(), isOpen(), refresh(),
 *                     current() → [objective], show(on), note(){}, lead(){}, leadDone(){}, flash(){}, autoHint(){} }
 * Bus out: 'notebook:open' {tab} · 'notebook:close' · 'hint' {id, tier}
 * Saved: G.state.hints {id: tier} · G.state.hintsUsed · vars.nb = { tab, hintAt:{id: playMs}, memo, doneSeen:{id:1} }
 * DEBUG: window.haru.notebook(id, tier) reveals a tier ignoring waits.
 * data-qa: nb.fab nb.close nb.tab:todo|hint|memo nb.card:<id> nb.hint:<id>:<tier> nb.memo
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const NB = (G.notebook = G.notebook || {});
  const HOLD_MS = 2000;
  const TIER_GAP_MS = 60000;

  /* ---------- small local helpers (no dependency on other flow files) ---------- */
  function el(tag, attrs, ...kids) {
    if (G.util && G.util.el) return G.util.el(tag, attrs, ...kids);
    const m = tag.match(/^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i);
    const n = document.createElement((m && m[1]) || 'div');
    if (attrs != null && (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object')) { kids.unshift(attrs); attrs = null; }
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, val) => { if (t === '.') n.classList.add(val); else n.id = val; });
    if (attrs) for (const k in attrs) { const val = attrs[k]; if (val == null || val === false) continue; if (k.startsWith('on') && typeof val === 'function') n.addEventListener(k.slice(2).toLowerCase(), val); else if (k === 'html') n.innerHTML = val; else if (k === 'style' && typeof val === 'object') Object.assign(n.style, val); else if (k === 'dataset') Object.assign(n.dataset, val); else n.setAttribute(k, val === true ? '' : val); }
    kids.flat(Infinity).forEach((c) => { if (c == null || c === false) return; n.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return n;
  }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  const DEBUG = () => !!G.DEBUG;
  function sfx(name) { try { const fn = G.audio && G.audio.sfx && G.audio.sfx[name]; if (fn) fn(); } catch (e) {} }
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function flag(n) { return safe(() => !!G.flag(n), false); }
  function state() { return G.state || (G.state = { vars: {}, hints: {}, hintsUsed: 0, playMs: 0 }); }
  function nbv() {
    const vars = state().vars || (state().vars = {});
    const nb = vars.nb && typeof vars.nb === 'object' ? vars.nb : (vars.nb = {});
    if (!nb.hintAt) nb.hintAt = {};
    if (!nb.doneSeen) nb.doneSeen = {};
    if (typeof nb.memo !== 'string') nb.memo = '';
    return nb;
  }
  function save() { try { G.save && G.save(); } catch (e) {} }
  function playMs() { return (G.state && G.state.playMs) || 0; }
  function screenEl() { return document.getElementById('screen'); }
  function svg(path, vb) { return `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${path}</svg>`; }
  function warnNoop(name) { return function () { if (DEBUG()) console.warn('[notebook] ' + name + '() is a no-op in episode 2 (hard mode)'); }; }
  function titleOf(o) { return T(typeof o.title === 'function' ? safe(o.title, '') : o.title); }

  /* ---------- objectives ---------- */
  function shown() { return (G.OBJECTIVES || []).filter((o) => safe(() => !o.show || !!o.show(), false)); }
  function isDone(o) { return safe(() => !!(o.done && o.done()), false); }
  function checked(o) { return safe(() => !!(o.doneMark ? o.doneMark() : o.done && o.done()), false); }
  function isGrey(o) { return !!o.grayAfterM7 && flag('M7') && !checked(o); }
  NB.current = function () { return shown().filter((o) => !isDone(o) && !isGrey(o)); };
  function hintable() { return shown().filter((o) => isGrey(o) || !isDone(o)); }   // grey cards keep their hints readable
  function primary() { const a = NB.current(); return a.find((o) => !o.optional) || a[0] || hintable()[0] || null; }

  /* ---------- hints ---------- */
  function tierOf(id) { return (state().hints && state().hints[id]) || 0; }
  function waitLeft(id, nextTier) {
    if (nextTier <= 1) return 0;
    const at = nbv().hintAt[id];
    if (at == null) return 0;
    return Math.max(0, at + TIER_GAP_MS - playMs());
  }
  function reveal(id, tier, opts) {
    const st = state();
    st.hints = st.hints || {};
    if (tierOf(id) >= tier) return false;
    st.hints[id] = tier;
    nbv().hintAt[id] = playMs();
    st.hintsUsed = (st.hintsUsed || 0) + 1;
    save();
    justRevealed = { id, tier };
    setTimeout(() => { if (justRevealed && justRevealed.id === id && justRevealed.tier === tier) justRevealed = null; }, 1600);
    try { G.bus && G.bus.emit('hint', { id, tier }); } catch (e) {}
    return true;
  }

  /* ---------- DOM state ---------- */
  let fab = null, wrap = null, sheet = null, body = null, tabsEl = null, statsEl = null, ticker = 0;
  let tab = 'todo', selObj = null, justRevealed = null, removeBack = null, memoField = null, memoSaveT = 0;
  let inited = false, fabShown = false, holdingNow = false, pendingRender = false;
  function soft() { if (!wrap) return; if (holdingNow) { pendingRender = true; return; } render(); }

  NB.init = function () {
    if (inited) return;
    inited = true;
    const scr = screenEl();
    if (!scr) { inited = false; return; }
    fab = el('button.nb-fab.nbk-fab.hide', { 'aria-label': T('{N의} 수첩'), 'data-qa': 'nb.fab',
      html: svg('<path d="M6.5 3.5h10a2 2 0 012 2v13a2 2 0 01-2 2h-10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 3.5v17M4.5 7.5h4M4.5 12h4M4.5 16.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 9.5h5M11 12.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>') });
    fab.addEventListener('click', (e) => { e.stopPropagation(); sfx('pageTurn'); NB.open(); });
    // a hold on the ✎ is never a gesture for anything else underneath
    fab.addEventListener('pointerdown', (e) => e.stopPropagation());
    scr.appendChild(fab);
    watchBanners(scr);
    if (G.bus) {
      G.bus.on('flag', soft);
      G.bus.on('flag:off', soft);
      G.bus.on('var:kbdHisSeen', soft);
      G.bus.on('keyboard', (on) => { if (sheet) sheet.classList.toggle('kb', !!on); });
    }
    const nb = nbv();
    if (nb.tab === 'todo' || nb.tab === 'hint' || nb.tab === 'memo') tab = nb.tab;
    if (fabShown) fab.classList.remove('hide');
  };
  /* The ✎ docks in the app-header row (notebook.css). Notification banners (#banners, z 70, shell) drop over that row for
     ~4 s; while any is down the tab slides to just below the lowest one so it stays reachable (DESIGN §2.3 ⑧) and covers
     no banner text, then slides back. Layout px (offsetTop), so the desktop-scaled phone works too. */
  function watchBanners(scr, tries) {
    const bn = document.getElementById('banners');
    if (!bn) { if ((tries || 0) < 20) setTimeout(() => watchBanners(scr, (tries || 0) + 1), 500); return; }
    if (!window.MutationObserver) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!fab) return;
      let bottom = 0;
      if (getComputedStyle(bn).display !== 'none') {
        bn.querySelectorAll(':scope > .banner.in').forEach((b) => { bottom = Math.max(bottom, bn.offsetTop + b.offsetTop + b.offsetHeight); });
      }
      if (bottom > 0) fab.style.setProperty('--nb-top', Math.round(bottom + 6) + 'px');
      else fab.style.removeProperty('--nb-top');
    };
    new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(update); })
      .observe(bn, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    update();
  }
  NB.show = function (on) {
    fabShown = !!on;
    if (!fab) return;
    fab.classList.toggle('hide', !on);
  };
  NB.isOpen = function () { return !!wrap; };
  NB.refresh = function () { if (wrap) render(); };

  /* ---------- open / close ---------- */
  NB.open = function (which, objId) {
    if (!inited) NB.init();
    if (!screenEl()) return;
    if (objId) { selObj = objId; if (!which) which = 'hint'; }
    if (which === 'todo' || which === 'hint' || which === 'memo') tab = which;
    if (wrap) { render(); return; }
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    const grab = el('div.nbk-grab', null, el('i'));
    tabsEl = el('div.nbk-tabs', { role: 'tablist' });
    body = el('div.nbk-body');
    const head = el('div.nbk-head', null,
      el('div.nbk-title', null, T('{N의} 수첩')),
      el('button.nbk-close', { 'aria-label': '닫기', 'data-qa': 'nb.close', onclick: () => NB.close() }, '닫기'));
    sheet = el('div.nbk-sheet', { role: 'dialog', 'aria-label': T('{N의} 수첩') }, grab, head, tabsEl, body);
    wrap = el('div.notebook.nbk-wrap', null, sheet);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) wrap._down = true; });
    wrap.addEventListener('click', (e) => { if (wrap && e.target === wrap && wrap._down) NB.close(); if (wrap) wrap._down = false; });
    dragToClose(grab); dragToClose(head);
    screenEl().appendChild(wrap);
    if (fab) fab.classList.add('hide-open');
    removeBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => { NB.close(); return true; }) : null), null);
    render();
    requestAnimationFrame(() => wrap && wrap.classList.add('in'));
    clearInterval(ticker);
    ticker = setInterval(tick, 500);   // UI countdown only (reads playMs; no game logic)
    try { G.bus && G.bus.emit('notebook:open', { tab }); } catch (e) {}
  };
  NB.close = function () {
    if (!wrap) return;
    const w = wrap;
    if (memoField) { flushMemo(); safe(() => memoField.blur && memoField.blur()); }
    wrap = null; sheet = null; body = null; tabsEl = null; statsEl = null; memoField = null;
    clearInterval(ticker);
    if (typeof removeBack === 'function') safe(removeBack); removeBack = null;
    w.classList.remove('in'); w.classList.add('out');
    setTimeout(() => w.remove(), 280);
    if (fab) fab.classList.remove('hide-open');
    sfx('pageTurn');
    try { G.bus && G.bus.emit('notebook:close'); } catch (e) {}
  };
  function dragToClose(handle) {
    let y0 = null;
    handle.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; try { handle.setPointerCapture(e.pointerId); } catch (er) {} });
    handle.addEventListener('pointermove', (e) => { if (y0 == null || !sheet) return; const dy = Math.max(0, e.clientY - y0); sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; });
    const end = (e) => { if (y0 == null || !sheet) { y0 = null; return; } const dy = e.clientY - y0; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) NB.close(); };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }

  /* ---------- render ---------- */
  const TABS = [['todo', '할 일'], ['hint', '힌트'], ['memo', '메모']];
  function render() {
    if (!wrap) return;
    const keepScroll = body ? body.scrollTop : 0;
    const sameTab = body && body.dataset.tab === tab;
    nbv().tab = tab;
    tabsEl.innerHTML = '';
    TABS.forEach(([id, label]) => {
      const b = el('button.nbk-tab' + (tab === id ? '.on' : ''), { role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', 'data-qa': 'nb.tab:' + id }, label);
      b.addEventListener('click', () => { if (tab === id) return; sfx('pageTurn'); if (memoField) flushMemo(); tab = id; render(); if (body) body.scrollTop = 0; });
      tabsEl.appendChild(b);
    });
    if (tab === 'memo' && memoField && sameTab) { updateStats(); return; }   // never rebuild the field under the player's fingers
    memoField = null;
    body.innerHTML = '';
    body.dataset.tab = tab;
    if (tab === 'todo') renderTodo();
    else if (tab === 'hint') renderHint();
    else renderMemo();
    statsEl = el('div.nbk-stats');
    body.appendChild(statsEl);
    updateStats();
    if (sameTab) body.scrollTop = keepScroll;
  }
  function updateStats() {
    if (!statsEl) return;
    const mins = Math.floor(playMs() / 60000);
    statsEl.textContent = `플레이 ${mins}분 · 힌트 ${state().hintsUsed || 0}회`;
  }

  /* ----- 할 일 ----- */
  function renderTodo() {
    body.appendChild(el('div.nbk-sec', null, '지금 할 일'));
    const list = el('div.nbk-objs');
    const all = shown();
    const active = all.filter((o) => !isDone(o) && !isGrey(o));
    const grey = all.filter(isGrey);
    const done = all.filter((o) => !isGrey(o) && isDone(o));
    const doneSeen = nbv().doneSeen;
    let penned = false;
    const row = (o, kind) => {
      const fresh = kind === 'done' && !doneSeen[o.id];
      const box = el('span.nbk-box' + (kind === 'done' ? '.on' : '') + (fresh ? '.fresh' : ''),
        kind === 'done' ? { html: svg('<path d="M5 12.5l4.2 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>') } : null);
      const b = el('button.nbk-obj.' + kind + (o.optional ? '.opt' : ''), { 'data-qa': 'nb.card:' + o.id },
        box,
        el('span.nbk-obj-t', null, titleOf(o), o.optional ? el('small.nbk-optional', null, ' (선택)') : null),
        el('span.nbk-obj-go', { html: svg('<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') }));
      b.addEventListener('click', () => { sfx('pageTurn'); selObj = o.id; tab = 'hint'; render(); if (body) body.scrollTop = 0; });
      if (fresh) { doneSeen[o.id] = 1; penned = true; }
      return b;
    };
    active.forEach((o) => list.appendChild(row(o, 'todo')));
    grey.forEach((o) => list.appendChild(row(o, 'grey')));
    done.forEach((o) => list.appendChild(row(o, 'done')));
    body.appendChild(list);
    if (penned) { save(); setTimeout(() => sfx('pen'), 260); }   // the quiet check: one pen stroke, no toast
  }

  /* ----- 힌트 ----- */
  function renderHint() {
    const list = hintable();
    if (!list.length) { body.appendChild(el('div.nbk-line.muted', null, '지금은 힌트가 필요 없어 보인다.')); return; }
    let o = list.find((x) => x.id === selObj) || primary() || list[0];
    selObj = o.id;
    if (list.length > 1) {
      const chips = el('div.nbk-chips', { role: 'tablist' });
      list.forEach((x) => {
        const c = el('button.nbk-chip' + (x.id === o.id ? '.on' : '') + (isGrey(x) ? '.grey' : ''), null, titleOf(x));
        c.addEventListener('click', () => { sfx('tap'); selObj = x.id; render(); });
        chips.appendChild(c);
      });
      body.appendChild(chips);
      requestAnimationFrame(() => { const on = chips.querySelector('.on'); if (on) chips.scrollLeft = Math.max(0, on.offsetLeft - 6); });
    }
    body.appendChild(el('div.nbk-sec' + (isGrey(o) ? '.grey' : ''), null, titleOf(o)));
    const tier = tierOf(o.id);
    const hints = o.hints || [];
    const box = el('div.nbk-hints');
    hints.forEach((h, i) => {
      const n = i + 1;
      if (n <= tier) {
        const fresh = justRevealed && justRevealed.id === o.id && justRevealed.tier === n;
        box.appendChild(el('div.nbk-hint.shown', { 'data-qa': `nb.hint:${o.id}:${n}` }, el('span.nbk-hn', null, `힌트 ${n}`), el('div.nbk-ht' + (fresh ? '.fresh' : ''), null, T(h))));
        return;
      }
      if (n > tier + 1) {
        box.appendChild(el('div.nbk-hint.locked', { 'data-qa': `nb.hint:${o.id}:${n}` }, el('span.nbk-hn', null, `힌트 ${n}`), el('div.nbk-hl', null, n - 1 === 1 ? '힌트 1을 먼저 봐.' : '힌트 2를 먼저 봐.')));
        return;
      }
      const left = waitLeft(o.id, n);
      if (left > 0) { box.appendChild(waitCard(o, n, left)); return; }
      box.appendChild(holdCard(o, n));
    });
    body.appendChild(box);
    body.appendChild(el('div.nbk-line.small', null, '힌트는 1분 간격으로 하나씩 열려요. 봐도 불이익은 없어요.'));
  }
  const RING_LEN = 94.25;   // 2πr, r = 15
  function ringSvg(frac) {
    const off = (RING_LEN * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2);
    return `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" style="stroke-dashoffset:${off}"/></svg>`;
  }
  function mmss(ms) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function waitCard(o, n, left) {
    const ring = el('span.nbk-ring.wait', { html: ringSvg(1 - left / TIER_GAP_MS) });
    const num = el('span.nbk-cdnum', null, mmss(left));
    const card = el('div.nbk-hint.locked.waiting', { 'data-qa': `nb.hint:${o.id}:${n}`, dataset: { obj: o.id, tier: String(n) } },
      el('span.nbk-hn', null, `힌트 ${n}`), el('span.nbk-wait', null, ring, num));
    card._ring = ring; card._num = num;
    return card;
  }
  function holdCard(o, n) {
    const ring = el('span.nbk-ring', { html: '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg"/></svg>' });
    const card = el('button.nbk-hint.hold', { 'data-qa': `nb.hint:${o.id}:${n}`, 'aria-label': `힌트 ${n}` },
      el('span.nbk-hn', null, `힌트 ${n}`),
      el('span.nbk-hold', null, ring, el('span', null, n === 3 ? '꾹 눌러서 정답 보기' : '꾹 눌러서 보기')));
    let t = 0, holding = false, x0 = 0, y0 = 0;
    const start = (e) => {
      if (holding) return; holding = true; holdingNow = true;
      if (e) { x0 = e.clientX || 0; y0 = e.clientY || 0; if (e.pointerId != null && card.setPointerCapture) { try { card.setPointerCapture(e.pointerId); } catch (er) {} } }
      card.classList.add('holding');
      sfx('pen');
      t = setTimeout(() => {
        holding = false; holdingNow = false; pendingRender = false; card.classList.remove('holding'); card.classList.add('done');
        reveal(o.id, n);
        sfx('pageTurn');
        try { if (navigator.vibrate && G.settings && G.settings.vibration !== false) navigator.vibrate(20); } catch (er) {}
        setTimeout(render, 160);
      }, HOLD_MS);
    };
    const stop = () => { if (!holding) return; holding = false; holdingNow = false; clearTimeout(t); card.classList.remove('holding'); if (pendingRender) { pendingRender = false; setTimeout(soft, 0); } };
    card.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); start(e); });
    card.addEventListener('pointermove', (e) => { if (holding && Math.hypot((e.clientX || 0) - x0, (e.clientY || 0) - y0) > 10) stop(); });
    card.addEventListener('pointerup', stop);
    card.addEventListener('pointercancel', stop);
    card.addEventListener('lostpointercapture', stop);
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    card.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
    card.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') stop(); });
    return card;
  }
  function tick() {
    if (!body) return;
    updateStats();
    if (tab !== 'hint') return;
    let reload = false;
    body.querySelectorAll('.nbk-hint.waiting').forEach((c) => {
      const left = waitLeft(c.dataset.obj, +c.dataset.tier);
      if (left <= 0) { reload = true; return; }
      if (c._num) c._num.textContent = mmss(left);
      if (c._ring) c._ring.innerHTML = ringSvg(1 - left / TIER_GAP_MS);
    });
    if (reload) render();
  }

  /* ----- 메모 ----- */
  function renderMemo() {
    const wrapM = el('div.nbk-memo', { 'data-qa': 'nb.memo' });
    const nb = nbv();
    const mk = G.ui && G.ui.field;
    if (mk) {
      try {
        memoField = G.ui.field({ placeholder: '적어 두기', mode: 'ko', predict: false, ctx: 'nbMemo', numRow: true, maxLength: 2000,
          onChange: (val) => { nbv().memo = String(val || ''); clearTimeout(memoSaveT); memoSaveT = setTimeout(save, 400); },
          onSubmit: (val) => { nbv().memo = String(val || ''); save(); safe(() => G.ui.hideKeyboard && G.ui.hideKeyboard()); } });
        if (nb.memo && memoField.set) memoField.set(nb.memo);
        const node = memoField.node || memoField;
        if (node && node.classList) node.classList.add('nbk-memo-field');
        if (node instanceof Node) wrapM.appendChild(node);
        // the paper itself is the tap target (≥ 44 px) — tapping anywhere on the lines focuses the field
        wrapM.addEventListener('click', (e) => { if (memoField && memoField.focus && !(e.target.closest && e.target.closest('.kb'))) memoField.focus(); });
      } catch (e) { console.error('[notebook] memo field', e); memoField = null; }
    }
    if (!memoField) wrapM.appendChild(el('div.nbk-memo-ph', null, nb.memo || '적어 두기'));
    body.appendChild(wrapM);
  }
  function flushMemo() {
    try { if (memoField && typeof memoField.value === 'string') nbv().memo = memoField.value; else if (memoField && typeof memoField.value === 'function') nbv().memo = String(memoField.value() || ''); } catch (e) {}
    clearTimeout(memoSaveT); save();
  }

  /* ---------- hard-mode no-ops (QA grep §10 A: only these definitions may exist) ---------- */
  NB.note = warnNoop('note');
  NB.lead = warnNoop('lead');
  NB.leadDone = warnNoop('leadDone');
  NB.flash = function () { warnNoop('flash')(); return Promise.resolve(); };
  NB.autoHint = warnNoop('autoHint');
  NB.ping = warnNoop('ping');

  /* ---------- DEBUG ---------- */
  if (G.DEBUG || /[?&]debug=1\b/.test(location.search)) {
    window.haru = window.haru || {};
    window.haru.notebook = function (id, tier) {
      const o = (G.OBJECTIVES || []).find((x) => x.id === id);
      if (!o) return false;
      tier = Math.max(1, Math.min(3, tier || tierOf(id) + 1));
      for (let k = tierOf(id) + 1; k <= tier; k++) reveal(id, k);
      if (wrap) render();
      return tierOf(id);
    };
  }
})();
