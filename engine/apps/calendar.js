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

  MU.app('calendar', {
    name: '캘린더',
    icon: (G.ICONS && G.ICONS.calendar) || { bg: '#fff', svg: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3" fill="none" stroke="#e5484d" stroke-width="1.8"/><path d="M4 10h16" stroke="#e5484d" stroke-width="1.8"/></svg>' },
    badge: () => 0,
    open(p) { p = p || {}; month(p.day || null); },
  });
  CAL.open = function (day) { if (G.phone && G.phone.openApp) G.phone.openApp('calendar', { day }); else month(day); };

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
})();
