/* =========================================================
 * 캘린더 (owner: media) — DESIGN §4.7.3 · §3.21 캘린더 · §0.2 T17 (account deleted → device copies,
 * grey band) · §4.8 N05 (00:00 notification payload G.STORY.events.notif0000, raised by flow B07).
 * Month `2026년 12월` (dots 10 · 24 · 25) → tap a day = that day's events below the grid →
 * tap an event = detail (title · when · rows verbatim). Other months: empty grid. No create / edit.
 * Today = the in-game date (12-24, or 12-25 after midnight).
 *
 * Public API : G.calendarApp = { open(day) }        (day 'YYYY-MM-DD')
 * Bus        : none (ARCH §4.21 lists no calendar events)
 * data-qa    : cal.day:<d> (d = 'YYYY-MM-DD') · cal.event:<id> (+ cal.prev / cal.next)
 *
 * ---- ep3 branch (G.STORY.events.v === 3 — ep2 data has no `v` · ARCH_EP3 §3.3 · §4.1) ----
 * DESIGN_EP3 §3.20.2 · §4.8.1 · §12.2 V28: months 2024-11 → 2027-03 (prev / next stop at the range) · today circled ·
 * a dot under every day with an event · the picked day's list below (else {$noEvent}) · repeats yearly 'MM-DD' /
 * weekly 0–6 / from–to span · detail = title / date · time / `반복` · `메모` rows only (no 만든 날 · 수정일 · 알림 ·
 * 추가한 기기). `+` = a title sheet (in-game keyboard) → one line on that day, session store only (progress 0).
 * Public API : G.calendarApp = { init(), open(day) }
 * Flags set  : calCake (detail of id 1126 — data `flag`)     Storage: session 'md:cal' (player-typed titles only)
 * data-scr   : calendar.month · calendar.event.<id> (data `scr`: 1126 · 0124) · calendar.event
 * data-qa    : cal.day:<YYYY-MM-DD> · cal.event:<id> · cal.prev · cal.next · cal.add · cal.add.field · cal.add.save
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[calendar] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, pad = MU.pad;
  const ED = () => (G.STORY && G.STORY.events) || { items: [], week: MU.WEEK, year: 2026, mon: 12 };
  const CAL = (G.calendarApp = G.calendarApp || {});
  const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const eventsOn = (k) => (ED().items || []).filter((e) => e.day === k);
  const isV3 = () => ED().v === 3;   // ep3 data marker (ARCH_EP3 §4.1-3)

  MU.app('calendar', {
    name: '캘린더',
    icon: (G.ICONS && G.ICONS.calendar) || { bg: '#fff', svg: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3" fill="none" stroke="#e5484d" stroke-width="1.8"/><path d="M4 10h16" stroke="#e5484d" stroke-width="1.8"/></svg>' },
    badge: () => 0,
    open(p) { p = p || {}; if (isV3()) { month3(p.day || null); return; } month(p.day || null); },
  });
  CAL.open = function (day) { if (G.phone && G.phone.openApp) G.phone.openApp('calendar', { day }); else if (isV3()) month3(day); else month(day); };
  CAL.init = function () {};   // ARCH_EP3 §5.1 init protocol (nothing to arm — the calendar is read on open)

  function month(dayParam) {
    const E = ED();
    let y = E.year || 2026, m = E.mon || 12;
    const today = MU.now();
    let sel = dayParam || key(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const ps = String(dayParam || '').match(/^(\d{4})-(\d{2})/);
    if (ps) { y = +ps[1]; m = +ps[2]; }
    const body = el('div.md2-cal');
    const scr = MU.screen({ title: T(E.title || '캘린더'), cls: 'md2-calscr', body });
    function render() {
      body.innerHTML = '';
      if (E.banner) body.appendChild(el('div.md2-band', null, T(E.banner)));
      const prev = MU.iconBtn(MU.ICON.prev, '이전', 'cal.prev', () => { m--; if (m < 1) { m = 12; y--; } render(); });
      const next = MU.iconBtn(MU.ICON.next, '다음', 'cal.next', () => { m++; if (m > 12) { m = 1; y++; } render(); });
      body.appendChild(el('div.md2-cal-head', null, prev, el('b', null, `${y}년 ${m}월`), next));
      body.appendChild(el('div.md2-cal-week', null, (E.week || MU.WEEK).map((w, i) => el('span' + (i === 0 ? '.sun' : i === 6 ? '.sat' : ''), null, w))));
      const g = el('div.md2-cal-grid');
      const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
      for (let i = 0; i < first; i++) g.appendChild(el('span.md2-cal-pad'));
      const tk = key(today.getFullYear(), today.getMonth() + 1, today.getDate());
      for (let d = 1; d <= days; d++) {
        const k = key(y, m, d), dow = (first + d - 1) % 7;
        const has = eventsOn(k).length > 0;
        const b = el('button.md2-cal-d' + (dow === 0 ? '.sun' : dow === 6 ? '.sat' : '') + (k === sel ? '.sel' : '') + (k === tk ? '.today' : ''), { type: 'button', 'aria-label': `${m}월 ${d}일` },
          el('span', null, String(d)), has ? el('i.md2-dot') : null);
        MU.qa(b, 'cal.day:' + k);
        b.addEventListener('click', () => { MU.sfx('tap'); sel = k; render(); });
        g.appendChild(b);
      }
      body.appendChild(g);
      const evs = eventsOn(sel);
      const agenda = el('div.md2-cal-agenda');
      evs.forEach((ev) => {
        const row = el('button.md2-cal-ev', { type: 'button' }, el('i.md2-cal-bar'), el('span.md2-cal-evm', null, el('b', null, T(ev.title)), el('small', null, T(ev.when))));
        MU.qa(row, 'cal.event:' + ev.id);
        row.addEventListener('click', () => { MU.sfx('tap'); detail(ev); });
        agenda.appendChild(row);
      });
      body.appendChild(agenda);
    }
    render();
    MU.push(scr, { onResume: render });
    if (dayParam) { const ev = eventsOn(dayParam)[0]; if (ev) detail(ev); }
  }

  function detail(ev) {
    const body = el('div.md2-cal-detail', null,
      el('div.md2-cal-dh', null, el('i.md2-cal-bar'), el('div', null, el('b', null, T(ev.title)), el('small', null, T(ev.when)))),
      el('div.md2-rows', null, (ev.rows || []).map(([k, v]) => el('div.md2-kv', null, el('span', null, T(k)), v ? el('b', null, T(v)) : null))));
    MU.push(MU.screen({ title: '', cls: 'md2-calscr', body }));
  }

  /* =========================================================================================================
   * ep3 — G.STORY.events.v === 3 (DESIGN_EP3 §4.8.1). Nothing below runs on the ep2 page.
   * ========================================================================================================= */
  const FB3 = { noEvent: '일정 없음' };   // = G.e3.STR (DESIGN §10 A) — only for partial builds
  const T3 = (s) => T(typeof s === 'string' ? s.replace(/\{\$([a-zA-Z0-9_]+)\}/g, (m, k) => MU.STR(k) || FB3[k] || m) : s);
  const W3 = MU.WEEK || ['일', '월', '화', '수', '목', '금', '토'];
  const IC3 = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const parseDay = (k) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  function todayKey() { let d = null; try { d = MU.now(); } catch (e) { d = null; } if (!d || isNaN(d.getTime())) return ED().today || '2027-01-24'; return key(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  /** §0.1 #18 — a date outside the in-game year carries its year */
  function dayText(d) {
    const yr = +todayKey().slice(0, 4);
    return (d.getFullYear() !== yr ? `${d.getFullYear()}년 ` : '') + `${d.getMonth() + 1}월 ${d.getDate()}일 (${W3[d.getDay()]})`;
  }
  /* player-made events (`+` sheet): free text → session store only, never the save (ARCH_EP3 §8.1-7) */
  const UKEY = 'md:cal';
  function userEvents() { try { const v = JSON.parse(MU.sessGet(UKEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function addUserEvent(day, title) { const l = userEvents(); l.push({ id: 'u' + (l.length + 1), day, title, user: true }); MU.sessSet(UKEY, JSON.stringify(l.slice(-40))); }
  function eventsOn3(k) {
    const d = parseDay(k), dow = d.getDay(), md = k.slice(5);
    const fixed = (ED().items || []).filter((e) => (e.day && e.day === k) || (e.yearly && e.yearly === md) ||
      (e.weekly != null && e.weekly === dow) || (e.from && e.to && k >= e.from && k <= e.to));
    const all = fixed.concat(userEvents().filter((u) => u.day === k));
    return all.map((e, i) => ({ e, i })).sort((a, b) => ((a.e.hm ? 1 : 0) - (b.e.hm ? 1 : 0)) || String(a.e.hm || '').localeCompare(String(b.e.hm || '')) || a.i - b.i).map((x) => x.e);
  }
  const whenOf = (ev) => (ev.hm ? MU.fmt12(ev.hm) : T3((ED().labels || {}).allDay || ''));

  function month3(dayParam) {
    const E = ED();
    const tk = todayKey();
    let sel = /^\d{4}-\d{2}-\d{2}$/.test(String(dayParam || '')) ? dayParam : tk;
    let y = +sel.slice(0, 4), m = +sel.slice(5, 7);
    const mi = (s) => { const a = String(s || '').split('-'); return +a[0] * 12 + (+a[1] - 1); };
    const lo = E.range ? mi(E.range[0]) : -Infinity, hi = E.range ? mi(E.range[1]) : Infinity;
    const body = el('div.md2-cal.md3-cal');
    let scr = null;
    const add = MU.iconBtn(IC3.plus, '추가', 'cal.add', () => addSheet());
    scr = MU.screen({ title: T3(E.title || '캘린더'), cls: 'md2-calscr md3-calscr', body, right: [add] });
    scr.dataset.scr = 'calendar.month';
    MU.noMenu(scr);
    function render() {
      body.innerHTML = '';
      const cur = y * 12 + (m - 1);
      const keepDay = () => { const dd = Math.min(+sel.slice(8, 10) || 1, new Date(y, m, 0).getDate()); sel = key(y, m, dd); };   // same day number in the new month
      const prev = MU.iconBtn(MU.ICON.prev, '이전', 'cal.prev', () => { if (y * 12 + (m - 1) <= lo) return; m--; if (m < 1) { m = 12; y--; } keepDay(); render(); });
      const next = MU.iconBtn(MU.ICON.next, '다음', 'cal.next', () => { if (y * 12 + (m - 1) >= hi) return; m++; if (m > 12) { m = 1; y++; } keepDay(); render(); });
      if (cur <= lo) prev.style.visibility = 'hidden';
      if (cur >= hi) next.style.visibility = 'hidden';
      body.appendChild(el('div.md2-cal-head', null, prev, el('b', null, `${y}년 ${m}월`), next));
      body.appendChild(el('div.md2-cal-week', null, (E.week || W3).map((w, i) => el('span' + (i === 0 ? '.sun' : i === 6 ? '.sat' : ''), null, T3(w)))));
      const g = el('div.md2-cal-grid');
      const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
      for (let i = 0; i < first; i++) g.appendChild(el('span.md2-cal-pad'));
      for (let d = 1; d <= days; d++) {
        const k = key(y, m, d), dow = (first + d - 1) % 7;
        const evd = eventsOn3(k), has = evd.some((e) => !e.from), span = evd.some((e) => e.from);   // a multi-day span = a thin bar, not a dot
        const b = el('button.md2-cal-d.md3-cal-d' + (dow === 0 ? '.sun' : dow === 6 ? '.sat' : '') + (k === sel ? '.sel' : '') + (k === tk ? '.today' : ''),
          { type: 'button', 'aria-label': `${m}월 ${d}일` }, el('span', null, String(d)), has ? el('i.md2-dot') : null, span ? el('i.md3-cal-span') : null);
        MU.qa(b, 'cal.day:' + k);
        b.addEventListener('click', () => { MU.sfx('tap'); sel = k; render(); });
        g.appendChild(b);
      }
      body.appendChild(g);
      const evs = eventsOn3(sel);
      const agenda = el('div.md2-cal-agenda.md3-cal-agenda');
      agenda.appendChild(el('div.md3-cal-sel', null, dayText(parseDay(sel))));
      if (!evs.length) agenda.appendChild(el('div.md3-cal-none', null, T3(E.empty || '')));
      evs.forEach((ev) => {
        const row = el('button.md2-cal-ev', { type: 'button' }, el('i.md2-cal-bar'), el('span.md2-cal-evm', null, el('b', null, T3(ev.title)), el('small', null, whenOf(ev))));
        MU.qa(row, 'cal.event:' + ev.id);
        row.addEventListener('click', () => { MU.sfx('tap'); detail3(ev, sel); });
        agenda.appendChild(row);
      });
      body.appendChild(agenda);
    }
    /* `+` — title sheet (in-game keyboard, predict off) · saves one line on the picked day (session only · progress 0) */
    let sheet = null;
    function addSheet() {
      if (sheet || !(G.ui && G.ui.field)) return;
      const day = sel;
      let f = null, removeBack = null;
      const close = () => {
        if (!sheet) return;
        const n = sheet; sheet = null;
        if (removeBack) removeBack();
        try { G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {}
        n.classList.remove('in'); setTimeout(() => n.remove(), 260);
      };
      const save = () => {
        const v = String((f && (typeof f.text === 'function' ? f.text() : f.value)) || '').trim();
        if (v) { addUserEvent(day, v); MU.sfx('tap'); }
        close(); render();
      };
      f = G.ui.field({ placeholder: '', mode: 'ko', predict: false, ctx: 'calAdd', qa: 'cal.add.field', onSubmit: save, maxLength: 40 });
      f.node.classList.add('md3-cal-field');
      const ok = MU.iconBtn(IC3.check, '저장', 'cal.add.save', () => save());
      sheet = el('div.md2-panel.md3-cal-sheet', { 'data-kb-keep': '' }, el('i.md2-grab'),
        el('div.md3-cal-sd', null, dayText(parseDay(day))), el('div.md3-cal-srow', null, f.node, ok));
      scr.appendChild(sheet);
      requestAnimationFrame(() => sheet && sheet.classList.add('in'));
      try { if (G.phone && G.phone.pushBack) removeBack = G.phone.pushBack(() => { if (!sheet) return false; close(); return true; }); } catch (e) {}
      setTimeout(() => { try { if (sheet && f) f.focus(); } catch (e) {} }, 280);
    }
    render();
    const entry = MU.push(scr, { onResume: render, onClose: () => { if (sheet) { const n = sheet; sheet = null; n.remove(); } } });
    if (entry && typeof entry === 'object') { try { entry.scr = scr.dataset.scr; } catch (e) {} }
  }

  function detail3(ev, k) {
    const L = ED().labels || {};
    const dateLine = ev.span ? T3(ev.span) : dayText(parseDay(k));
    const rows = [];
    if (ev.yearly) rows.push([L.repeat, L.yearly]);
    if (ev.weekly != null) rows.push([L.repeat, L.weekly]);
    if (ev.memo) rows.push([L.memo, ev.memo]);
    const body = el('div.md2-cal-detail.md3-cal-detail',
      el('div.md2-cal-dh', null, el('i.md2-cal-bar'), el('div', null, el('b', null, T3(ev.title)), el('small', null, `${dateLine} · ${whenOf(ev)}`))),
      rows.length ? el('div.md3-kvs', null, rows.map(([a, b]) => el('div.md3-kv', null, el('span', null, T3(a || '')), el('b', null, T3(b || ''))))) : null);
    const scr = MU.screen({ title: '', cls: 'md2-calscr md3-calscr', body });
    scr.dataset.scr = ev.scr || 'calendar.event';
    MU.noMenu(scr);
    const entry = MU.push(scr);
    if (entry && typeof entry === 'object') { try { entry.scr = scr.dataset.scr; } catch (e) {} }
    if (ev.flag && !MU.flag(ev.flag)) MU.flag(ev.flag, true);
  }

  if (G.DEBUG && window.haru && isV3()) window.haru.calendar = { open: (day) => CAL.open(day), on: (k) => eventsOn3(k).map((e) => e.id) };
})();
