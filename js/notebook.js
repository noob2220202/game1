/* =========================================================
 * 하루의 수첩 (DESIGN §2.4) — always reachable (✎ tab at the top-right edge).
 * Tabs: 할 일 (objectives + open leads) · 조각 (①②③ code slots) · 힌트 (3 tiers, 2-s hold,
 *       60 s between tiers unless G.settings.easy) · 메모 (auto-notes).
 *
 * API (others call these):
 *   G.notebook.init() / show(on) / open(tab?, objectiveId?) / close() / ping() / isOpen()
 *   G.notebook.note(text, {silent}?)   — add an auto-note (deduped, {N} tokens ok; silent = no toast)
 *   G.notebook.lead(id, text, doneFn?) — add an open lead;  G.notebook.leadDone(id)
 *   G.notebook.flash(text, ms?)        — handwriting overlay (returns Promise)
 *   G.notebook.autoHint(objectiveId)   — reveal tier 1 without a hold + pop a small hint card
 *   G.notebook.current()               — active objectives (priority order)
 * Data: G.OBJECTIVES, G.LEADS, G.FRAGMENT_SLOTS (js/data/objectives.js)
 * Saved: vars.nbNotes, nbLeads, nbSeen, nbHintAt, nbTab, nbFragNew, nbPing; state.hints, hintsUsed.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const NB = (G.notebook = G.notebook || {});
  const T = (s) => (G.T ? G.T(s) : s);
  const V = () => G.state.vars;
  const HOLD_MS = 2000;
  const TIER_GAP_MS = 60000;

  let fab = null, wrap = null, sheet = null, body = null, tabsEl = null, ticker = 0;
  let tab = null, selObj = null, fragInput = null; // fragInput = {id, digits}
  let toastEl = null, toastTimer = 0, justRevealed = null, hintPop = null;

  function sfx(name, ...a) { try { const f = G.audio && G.audio.sfx && G.audio.sfx[name]; if (f) f(...a); } catch (e) {} }
  function bag(k, def) { const v = V(); if (v[k] == null) v[k] = def; return v[k]; }
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function flag(n) { return !!G.flag(n); }
  function frags() { return G.fragCount ? G.fragCount() : 0; }
  function hub() { return flag('M2') || frags() > 0; }
  function easy() { return !!(G.settings && (G.settings.easy || G.settings.hintMode === 'easy' || G.settings.difficulty === 'easy')); }
  function svg(path, vb) { return `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${path}</svg>`; }

  /* ---------------- objectives ---------------- */
  function objs() { return (G.OBJECTIVES || []).filter((o) => safe(() => !o.show || o.show(), false)); }
  function isDone(o) { return safe(() => !!(o.done && o.done()), false); }
  NB.current = function () { return objs().filter((o) => !isDone(o)); };
  function primary() { const a = NB.current(); return a.find((o) => !o.optional) || a[0] || null; }
  function unseen() { const seen = bag('nbSeen', {}); return NB.current().filter((o) => !seen[o.id]); }
  function markSeen() { const seen = bag('nbSeen', {}); NB.current().forEach((o) => { seen[o.id] = 1; }); G.save(); }

  /* ---------------- hints ---------------- */
  function tierOf(id) { return (G.state.hints && G.state.hints[id]) || 0; }
  function availIn(id, nextTier) {
    if (nextTier <= 1 || easy()) return 0;
    const at = bag('nbHintAt', {})[id];
    if (at == null) return 0;
    return Math.max(0, at + TIER_GAP_MS - G.state.playMs);
  }
  function reveal(id, tier, auto) {
    G.state.hints = G.state.hints || {};
    if (tierOf(id) >= tier) return;
    G.state.hints[id] = tier;
    bag('nbHintAt', {})[id] = G.state.playMs;
    if (!auto) G.state.hintsUsed = (G.state.hintsUsed || 0) + 1;
    G.save();
    justRevealed = { id, tier };
    setTimeout(() => { if (justRevealed && justRevealed.id === id && justRevealed.tier === tier) justRevealed = null; }, 1500);
    G.bus.emit('hint', { id, tier, auto: !!auto });
  }

  /* ---------------- leads ---------------- */
  const leadFns = {};
  function leads() { return bag('nbLeads', []); }
  NB.lead = function (id, text, doneFn) {
    if (typeof doneFn === 'function') leadFns[id] = doneFn;
    const L = leads();
    if (L.some((l) => l.id === id)) return;
    L.push({ id, text: T(text), done: false, at: Date.now() });
    G.save();
    NB.ping();
    if (isOpen()) render();
  };
  NB.leadDone = function (id) {
    const l = leads().find((x) => x.id === id);
    if (l && !l.done) { l.done = true; G.save(); if (isOpen()) render(); }
  };
  function syncLeads() {
    if (flag('M2')) (G.LEADS || []).forEach((d) => { leadFns[d.id] = d.done; if (!leads().some((l) => l.id === d.id)) leads().push({ id: d.id, text: T(d.text), done: false, at: Date.now() }); });
    let ch = false;
    leads().forEach((l) => { if (!l.done && leadFns[l.id] && safe(leadFns[l.id], false)) { l.done = true; ch = true; } });
    if (ch) G.save();
  }

  /* ---------------- notes ---------------- */
  NB.note = function (text, opts) {
    opts = opts || {};
    text = T(String(text || '')).trim();
    if (!text) return;
    const N = bag('nbNotes', []);
    if (N.some((n) => n.text === text)) return;
    N.push({ text, t: G.clock ? G.clock.now().getTime() : Date.now() });
    G.save();
    G.bus.emit('notebook:note', text);
    if (isOpen()) { if (tab === 'notes') render(); return; }
    NB.ping();
    if (!opts.silent) microToast('✎ ' + text);
  };

  /* ---------------- fab ---------------- */
  NB.init = function () {
    if (!fab) {
      fab = el('button.nb-fab.nbk-fab', { 'aria-label': '수첩 열기', html: svg('<path d="M6.5 3.5h10a2 2 0 012 2v13a2 2 0 01-2 2h-10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 3.5v17M4.5 7.5h4M4.5 12h4M4.5 16.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 9.5h5M11 12.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>') });
      fab.addEventListener('click', (e) => { e.stopPropagation(); sfx('pageTurn'); NB.open(); });
      document.getElementById('screen').appendChild(fab);
      G.bus.on('flag', onFlag);
      G.bus.on('fragment', onFragment);
      hookBack();
      document.addEventListener('keydown', (e) => { if (isOpen() && e.key === 'Escape') { e.preventDefault(); NB.close(); } });
    }
    syncLeads();
    if (V().nbPing || unseen().length) fab.classList.add('ping');
  };
  NB.show = function (on) { if (fab) fab.classList.toggle('hide', !on); };
  NB.ping = function () { if (!fab) return; V().nbPing = true; fab.classList.remove('ping'); void fab.offsetWidth; fab.classList.add('ping'); };
  function isOpen() { return !!wrap; }
  NB.isOpen = isOpen;

  function onFlag(name) {
    syncLeads();
    if (name === 'M2') { NB.note('세아가 남긴 메모. 비밀번호 여섯 자리를 세 군데에 나눠 숨겼다.', { silent: true }); }
    if (hintPop && hintPop._obj && isDone(hintPop._obj)) dropHintPop();
    if (unseen().length && !isOpen()) NB.ping();
    if (isOpen()) render();
  }
  function onFragment(d) {
    const id = d && d.id; if (!id) return;
    bag('nbFragNew', {})[id] = 1; G.save();
    const slot = (G.FRAGMENT_SLOTS || []).find((s) => s.id === id);
    syncLeads();
    if (isOpen()) render();
    else NB.ping();
    if (slot && !isOpen()) microToast('✎ ' + slot.note);
  }
  function hookBack() {
    if (!G.phone || G.phone._nbBackWrapped || typeof G.phone.back !== 'function') return;
    const orig = G.phone.back;
    G.phone.back = function () { if (isOpen()) { NB.close(); return; } return orig.apply(this, arguments); };
    G.phone._nbBackWrapped = true;
  }

  /* ---------------- open / close ---------------- */
  NB.open = function (which, objId) {
    if (!fab) NB.init();
    if (objId) selObj = objId;
    if (which) tab = which;
    else if (!isOpen()) tab = unseen().length ? 'todo' : (tab || V().nbTab || 'todo');
    if (isOpen()) { render(); return; }
    V().nbPing = false; G.save();
    fab.classList.remove('ping');
    fab.classList.add('hide-open');
    hideToast(); dropHintPop();
    G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard();
    const grab = el('div.nbk-grab', null, el('i'));
    tabsEl = el('div.nbk-tabs', { role: 'tablist' });
    body = el('div.nbk-body');
    const head = el('div.nbk-head', null,
      el('div.nbk-title', null, T('{N의} 수첩')),
      el('button.nbk-close', { 'aria-label': '수첩 닫기', onclick: () => NB.close() }, '닫기'));
    sheet = el('div.nbk-sheet', { role: 'dialog', 'aria-label': '수첩' }, grab, head, tabsEl, body);
    wrap = el('div.notebook.nbk-wrap', null, sheet);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) wrap._down = true; });
    wrap.addEventListener('click', (e) => { if (e.target === wrap && wrap._down) NB.close(); if (wrap) wrap._down = false; });
    dragToClose(grab);
    dragToClose(head);
    document.getElementById('screen').appendChild(wrap);
    render();
    requestAnimationFrame(() => wrap && wrap.classList.add('in'));
    clearInterval(ticker);
    ticker = setInterval(tick, 500);
    G.bus.emit('notebook:open', tab);
  };
  NB.close = function () {
    if (!wrap) return;
    const w = wrap;
    wrap = null; sheet = null; body = null; fragInput = null;
    clearInterval(ticker);
    w.classList.remove('in'); w.classList.add('out');
    setTimeout(() => w.remove(), 280);
    if (fab) fab.classList.remove('hide-open');
    sfx('pageTurn');
    G.bus.emit('notebook:close');
  };
  function dragToClose(handle) {
    let y0 = null;
    handle.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; handle.setPointerCapture && handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', (e) => { if (y0 == null || !sheet) return; const dy = Math.max(0, e.clientY - y0); sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; });
    const end = (e) => { if (y0 == null || !sheet) { y0 = null; return; } const dy = e.clientY - y0; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) NB.close(); };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }

  /* ---------------- render ---------------- */
  const TABS = [['todo', '할 일'], ['frag', '조각'], ['hint', '힌트'], ['notes', '메모']];
  function render() {
    if (!wrap) return;
    syncLeads();
    V().nbTab = tab;
    tabsEl.innerHTML = '';
    const newObj = unseen().length > 0;
    const newFrag = Object.keys(bag('nbFragNew', {})).length > 0;
    TABS.forEach(([id, label]) => {
      const dot = (id === 'todo' && newObj) || (id === 'frag' && newFrag);
      const b = el('button.nbk-tab' + (tab === id ? '.on' : ''), { role: 'tab', 'aria-selected': tab === id ? 'true' : 'false' }, label, dot ? el('i.nbk-dot') : null);
      b.addEventListener('click', () => { if (tab === id) return; sfx('pageTurn'); tab = id; fragInput = null; render(); body.scrollTop = 0; });
      tabsEl.appendChild(b);
    });
    body.innerHTML = '';
    if (tab === 'todo') renderTodo();
    else if (tab === 'frag') renderFrag();
    else if (tab === 'hint') renderHint();
    else renderNotes();
    const mins = Math.floor((G.state.playMs || 0) / 60000);
    body.appendChild(el('div.nbk-stats', null, `플레이 ${mins}분 · 힌트 ${G.state.hintsUsed || 0}회${easy() ? ' · 쉬움' : ''}`));
  }

  function renderTodo() {
    const act = NB.current();
    const seen = bag('nbSeen', {});
    const sec = (t) => el('div.nbk-sec', null, t);
    body.appendChild(sec('지금 할 일'));
    if (!act.length) body.appendChild(el('div.nbk-line.muted', null, '…'));
    const list = el('div.nbk-objs');
    act.forEach((o) => {
      const row = el('button.nbk-obj' + (o.optional ? '.opt' : ''), { 'aria-label': T(o.title) + ' — 힌트 보기' },
        el('span.nbk-box'),
        el('span.nbk-obj-t', null, T(o.title)),
        o.optional ? el('span.nbk-tag', null, '선택') : null,
        !seen[o.id] ? el('span.nbk-new', null, '새 단서') : null,
        el('span.nbk-obj-go', { html: svg('<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') }));
      row.addEventListener('click', () => { sfx('pageTurn'); selObj = o.id; tab = 'hint'; render(); });
      list.appendChild(row);
    });
    body.appendChild(list);
    markSeen();

    const L = leads();
    if (L.length) {
      body.appendChild(sec('단서'));
      const ll = el('div.nbk-leads');
      L.slice().sort((a, b) => (a.done === b.done ? a.at - b.at : a.done ? 1 : -1)).forEach((l) => ll.appendChild(el('div.nbk-lead' + (l.done ? '.done' : ''), null, el('i', null, l.done ? '●' : '○'), el('span', null, l.text))));
      body.appendChild(ll);
    }
    const done = objs().filter(isDone).filter((o) => !o.id.startsWith('P8') || o.id === 'P8door');
    if (done.length) {
      body.appendChild(sec('한 일'));
      const dl = el('div.nbk-objs.done');
      done.forEach((o) => dl.appendChild(el('div.nbk-obj.done', null, el('span.nbk-box.on', { html: svg('<path d="M5 12.5l4.2 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>') }), el('span.nbk-obj-t', null, T(o.title)))));
      body.appendChild(dl);
    }
  }

  /* ----- 조각 ----- */
  function renderFrag() {
    const slots = G.FRAGMENT_SLOTS || [];
    if (!hub()) {
      body.appendChild(el('div.nbk-sec', null, '조각'));
      body.appendChild(el('div.nbk-line.muted', null, '아직 아무것도 모른다.'));
      body.appendChild(el('div.nbk-line.small', null, '세아가 뭔가 남겨 뒀을지도.'));
      return;
    }
    body.appendChild(el('div.nbk-sec', null, '현관 도어락 · 관리자 비밀번호'));
    body.appendChild(el('div.nbk-line.small', null, '여섯 자리. 세 군데에 나눠 숨겼다.'));
    const fresh = bag('nbFragNew', {});
    const row = el('div.nbk-slots');
    slots.forEach((s) => {
      const found = flag('frag' + s.id);
      const typing = fragInput && fragInput.id === s.id ? fragInput.digits : '';
      const digits = el('div.nbk-digits');
      for (let i = 0; i < 2; i++) {
        const ch = found ? s.id[i] : (typing[i] || '');
        const d = el('span.nbk-digit' + (found ? '.ink' : ch ? '.pencil' : '') + (found && fresh[s.id] ? '.write' : ''), null, ch || '');
        if (found && fresh[s.id]) d.style.animationDelay = (0.25 + i * 0.45) + 's';
        digits.appendChild(d);
      }
      const box = el('button.nbk-slot' + (found ? '.found' : '') + (fragInput && fragInput.id === s.id ? '.active' : ''), { 'aria-label': `조각 ${s.mark} ${found ? s.id : '비어 있음'}` },
        el('span.nbk-slot-mark', null, s.mark), digits, el('span.nbk-slot-l', null, s.label));
      if (!found) box.addEventListener('click', () => { sfx('tap'); fragInput = fragInput && fragInput.id === s.id ? null : { id: s.id, digits: '' }; render(); });
      row.appendChild(box);
    });
    body.appendChild(row);
    if (fragInput) body.appendChild(keypad());
    // notes under the slots
    const notes = el('div.nbk-fragnotes');
    slots.forEach((s) => { if (flag('frag' + s.id)) notes.appendChild(el('div.nbk-line' + (fresh[s.id] ? '.write' : ''), null, T(s.note))); });
    if (notes.children.length) body.appendChild(notes);
    if (slots.length && slots.every((s) => flag('frag' + s.id))) {
      body.appendChild(el('div.nbk-code', null, el('small', null, '도어락'), el('b', null, slots.map((s) => s.id.split('').join(' ')).join('  '))));
    } else if (!fragInput) body.appendChild(el('div.nbk-line.small', null, '알아낸 숫자는 칸을 눌러 직접 적을 수도 있다.'));
    if (Object.keys(fresh).length) { setTimeout(() => { V().nbFragNew = {}; G.save(); }, 2400); }
  }
  function keypad() {
    const pad = el('div.nbk-pad');
    const msg = el('div.nbk-padmsg', null, fragInput.msg || '');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach((k) => {
      if (!k) { pad.appendChild(el('span')); return; }
      const b = el('button.nbk-key' + (k === '⌫' ? '.del' : ''), { 'aria-label': k === '⌫' ? '지우기' : k }, k);
      b.addEventListener('click', () => {
        if (!fragInput || fragInput.busy) return;
        sfx('key');
        if (k === '⌫') fragInput.digits = fragInput.digits.slice(0, -1);
        else if (fragInput.digits.length < 2) fragInput.digits += k;
        fragInput.msg = '';
        if (fragInput.digits.length === 2) return submitFrag();
        render();
      });
      pad.appendChild(b);
    });
    return el('div.nbk-padwrap', null, msg, pad);
  }
  async function submitFrag() {
    const fi = fragInput; fi.busy = true; render();
    await sleep(260);
    if (fragInput !== fi) return;
    if (fi.digits === fi.id) {
      sfx('pen');
      fragInput = null;
      if (G.foundFragment) G.foundFragment(fi.id); else { G.flag('frag' + fi.id, true); render(); }
    } else {
      sfx('error');
      const slotEl = body && body.querySelector('.nbk-slot.active');
      if (slotEl) { slotEl.classList.remove('shake'); void slotEl.offsetWidth; slotEl.classList.add('shake'); }
      await sleep(520);
      if (fragInput !== fi) return;
      fi.digits = ''; fi.busy = false; fi.msg = '…아닌 것 같다.';
      render();
    }
  }

  /* ----- 힌트 ----- */
  function renderHint() {
    const act = NB.current();
    if (!act.length) { body.appendChild(el('div.nbk-line.muted', null, '지금은 힌트가 필요 없어 보인다.')); return; }
    let o = act.find((x) => x.id === selObj) || primary() || act[0];
    selObj = o.id;
    if (act.length > 1) {
      const chips = el('div.nbk-chips');
      act.forEach((x) => {
        const c = el('button.nbk-chip' + (x.id === o.id ? '.on' : ''), null, T(x.title));
        c.addEventListener('click', () => { sfx('tap'); selObj = x.id; render(); });
        chips.appendChild(c);
      });
      body.appendChild(chips);
      requestAnimationFrame(() => { const on = chips.querySelector('.on'); if (on) chips.scrollLeft = Math.max(0, on.getBoundingClientRect().left - chips.getBoundingClientRect().left + chips.scrollLeft - 4); });
    }
    body.appendChild(el('div.nbk-sec', null, T(o.title)));
    const tier = tierOf(o.id);
    const hints = o.hints || [];
    const list = el('div.nbk-hints');
    hints.forEach((h, i) => {
      const n = i + 1;
      if (n <= tier) { const fresh = justRevealed && justRevealed.id === o.id && justRevealed.tier === n; list.appendChild(el('div.nbk-hint.shown', null, el('span.nbk-hn', null, `힌트 ${n}`), el('div.nbk-ht' + (fresh ? '.fresh' : ''), null, T(h)))); return; }
      if (n > tier + 1) { list.appendChild(el('div.nbk-hint.locked', null, el('span.nbk-hn', null, `힌트 ${n}`), el('div.nbk-hl', null, `힌트 ${n - 1}을 먼저 봐.`))); return; }
      const wait = availIn(o.id, n);
      if (wait > 0) {
        const cd = el('div.nbk-hl.nbk-cd', { dataset: { obj: o.id, tier: String(n) } }, countdown(wait));
        list.appendChild(el('div.nbk-hint.locked', null, el('span.nbk-hn', null, `힌트 ${n}`), cd));
        return;
      }
      list.appendChild(holdCard(o, n));
    });
    body.appendChild(list);
    body.appendChild(el('div.nbk-line.small', null, easy() ? '쉬움 모드: 힌트를 바로 볼 수 있어요.' : '힌트는 1분 간격으로 하나씩 열려요. 봐도 불이익은 없어요.'));
  }
  function countdown(ms) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)} 뒤에 볼 수 있어`; }
  function holdCard(o, n) {
    const ring = el('span.nbk-ring', { html: '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg"/></svg>' });
    const card = el('button.nbk-hint.hold', { 'aria-label': `힌트 ${n} 보기 — 2초간 길게 누르세요` },
      el('span.nbk-hn', null, `힌트 ${n}`),
      el('span.nbk-hold', null, ring, el('span', null, n === 3 ? '꾹 눌러서 정답 보기' : '꾹 눌러서 보기')),
      n === 3 ? el('span.nbk-warn', null, '정답이 바로 나와요') : null);
    let t = 0, holding = false;
    const start = (e) => {
      if (holding) return; holding = true;
      if (e && e.pointerId != null && card.setPointerCapture) { try { card.setPointerCapture(e.pointerId); } catch (er) {} }
      card.classList.add('holding');
      sfx('pen');
      t = setTimeout(() => { holding = false; card.classList.remove('holding'); card.classList.add('done'); reveal(o.id, n); sfx('pageTurn'); if (navigator.vibrate && G.settings.vibration !== false) { try { navigator.vibrate(20); } catch (er) {} } setTimeout(render, 160); }, HOLD_MS);
    };
    const stop = () => { if (!holding) return; holding = false; clearTimeout(t); card.classList.remove('holding'); };
    card.addEventListener('pointerdown', (e) => { e.preventDefault(); start(e); });
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
    if (tab !== 'hint') return;
    const cds = body.querySelectorAll('.nbk-cd');
    let reload = false;
    cds.forEach((c) => { const w = availIn(c.dataset.obj, +c.dataset.tier); if (w <= 0) reload = true; else c.textContent = countdown(w); });
    if (reload) render();
  }

  /* ----- 메모 ----- */
  function renderNotes() {
    body.appendChild(el('div.nbk-sec', null, '메모'));
    const N = bag('nbNotes', []);
    if (!N.length) { body.appendChild(el('div.nbk-line.muted', null, '아직 적은 게 없다.')); return; }
    const list = el('div.nbk-notes');
    N.slice().reverse().forEach((n) => { const d = new Date(n.t); list.appendChild(el('div.nbk-note', null, el('small', null, `${pad(d.getHours())}:${pad(d.getMinutes())}`), el('span', null, n.text))); });
    body.appendChild(list);
  }

  /* ---------------- small surfaces ---------------- */
  function screenEl() { return document.getElementById('screen'); }
  function quietTime() { return (G.flag('M7') && !G.flag('M8')) || !!document.querySelector('.cinema, .title-screen'); }
  function hideToast() { if (toastEl) { const t = toastEl; toastEl = null; t.classList.remove('in'); setTimeout(() => t.remove(), 300); } clearTimeout(toastTimer); }
  function microToast(text) {
    if (!fab || fab.classList.contains('hide') || quietTime()) return;
    hideToast();
    const short = text;
    toastEl = el('button.nbk-toast', { 'aria-label': '수첩 열기' }, short);
    toastEl.addEventListener('click', () => { hideToast(); NB.open('notes'); });
    screenEl().appendChild(toastEl);
    requestAnimationFrame(() => toastEl && toastEl.classList.add('in'));
    toastTimer = setTimeout(hideToast, 2300);
  }
  NB.autoHint = function (id) {
    const o = (G.OBJECTIVES || []).find((x) => x.id === id);
    if (!o || isDone(o) || !o.hints || !o.hints.length) return;
    if (tierOf(id) < 1) reveal(id, 1, true);
    if (isOpen() || quietTime()) { if (isOpen()) render(); return; }
    hideToast();
    dropHintPop();
    const card = el('button.nbk-hintpop', { 'aria-label': '수첩 힌트' }, el('small', null, '수첩 · 힌트 1'), el('span', null, T(o.hints[0])));
    card._obj = o;
    card.addEventListener('click', () => { dropHintPop(); NB.open('hint', id); });
    screenEl().appendChild(card);
    hintPop = card;
    sfx('pen');
    requestAnimationFrame(() => card.classList.add('in'));
    card._t = setTimeout(dropHintPop, 8000);
  };
  function dropHintPop() { const c = hintPop; if (!c) return; hintPop = null; clearTimeout(c._t); c.classList.remove('in'); setTimeout(() => c.remove(), 400); }
  NB.flash = function (text, ms) {
    text = T(String(text || ''));
    ms = ms || Math.max(2600, 1400 + text.length * 90);
    const lines = text.split('\n');
    const paper = el('div.nbk-flash-paper', null, lines.map((l, i) => el('div.nbk-flash-line', { style: { animationDelay: (0.15 + i * 0.5) + 's' } }, l)));
    const box = el('div.nbk-flash', { 'aria-live': 'polite' }, paper);
    screenEl().appendChild(box);
    sfx('pen');
    requestAnimationFrame(() => box.classList.add('in'));
    return new Promise((res) => setTimeout(() => { box.classList.remove('in'); box.classList.add('out'); setTimeout(() => { box.remove(); res(); }, 500); }, ms));
  };
})();
