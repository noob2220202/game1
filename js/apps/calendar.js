/* =========================================================
 * 캘린더: month grid with event dots, day agenda.
 * G.STORY.events = [{date:'YYYY-MM-DD', title, note, color, time, show(), by}]
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad } = G.util;
  function evs() { return (G.STORY.events || []).filter((e) => !e.show || e.show()); }
  function key(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  G.app('calendar', {
    name: '캘린더',
    icon: G.ICONS.calendar,
    open(p) {
      const now = G.clock.now();
      let y = now.getFullYear(), m = now.getMonth(), sel = key(now);
      if (p && p.date) { const [yy, mm, dd] = p.date.split('-').map(Number); y = yy; m = mm - 1; sel = p.date; }
      const wrap = el('div');
      const scr = G.ui.screen({ title: '캘린더', body: wrap });
      function render() {
        wrap.innerHTML = '';
        const head = el('div.cal-head', null, el('button', { onclick: () => { m--; if (m < 0) { m = 11; y--; } render(); } }, '‹'), el('b', null, `${y}년 ${m + 1}월`), el('button', { onclick: () => { m++; if (m > 11) { m = 0; y++; } render(); } }, '›'));
        const grid = el('div.cal-grid');
        ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => grid.appendChild(el('div.cal-dow', null, d)));
        const first = new Date(y, m, 1).getDay(); const days = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.appendChild(el('div'));
        const all = evs();
        for (let d = 1; d <= days; d++) {
          const dt = new Date(y, m, d); const k = key(dt);
          const es = all.filter((e) => e.date === k);
          const c = el('button.cal-day' + (k === key(now) ? '.today' : '') + (k === sel ? '.sel' : '') + (dt.getDay() === 0 ? '.sun' : dt.getDay() === 6 ? '.sat' : ''), null, el('b', null, String(d)), es.length ? el('div.dots', null, es.slice(0, 3).map((e) => el('i', { style: { background: e.color || '#888' } }))) : null);
          c.addEventListener('click', () => { sel = k; G.audio.sfx.tap(); render(); });
          grid.appendChild(c);
        }
        const list = el('div.cal-events');
        const es = all.filter((e) => e.date === sel);
        const [sy, sm, sd] = sel.split('-').map(Number);
        list.appendChild(el('div', { style: { fontWeight: '700', margin: '6px 2px 10px' } }, `${sm}월 ${sd}일 ${G.util.WEEK[new Date(sy, sm - 1, sd).getDay()]}요일`));
        if (!es.length) list.appendChild(el('div', { style: { color: '#999', fontSize: '14px', padding: '6px 2px' } }, '일정 없음'));
        es.forEach((e) => list.appendChild(el('div.cal-ev', null, el('div.bar', { style: { background: e.color || '#888' } }), el('div', null, el('div.t', null, G.T(e.title)), el('div.s', null, [e.time, e.note ? G.T(e.note) : null, e.by ? '생성: ' + G.T(e.by) : null].filter(Boolean).join('\n'))))));
        if (es.length) G.bus.emit('calendar:day', sel);
        wrap.append(head, grid, list);
      }
      render();
      G.phone.push(scr);
    },
  });
})();
