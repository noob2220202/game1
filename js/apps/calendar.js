/* =========================================================
 * 캘린더 — DESIGN §4.7. Month grid with event bars, day agenda, all-events list,
 * event detail ('추가한 사람: 알 수 없는 기기'). Lives in the '기타' folder.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function evs() { return (G.STORY.events || []).filter((e) => !e.show || e.show()); }
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const IC = {
    list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="6" r="1.3" fill="currentColor"/><circle cx="4" cy="12" r="1.3" fill="currentColor"/><circle cx="4" cy="18" r="1.3" fill="currentColor"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    today: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="12" y="17.5" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" font-family="sans-serif">24</text></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M5 4h10l4 4v12H5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 12h8M8 16h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    dev: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.5 18h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 20.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };
  function whenText(e) { return e.allDay ? '종일' : e.time ? `${Number(e.time.slice(0, 2)) < 12 ? '오전' : '오후'} ${Number(e.time.slice(0, 2)) % 12 || 12}:${e.time.slice(3)}` : ''; }
  function dateText(k) { const [y, m, d] = k.split('-').map(Number); return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(y, m - 1, d).getDay()]})`; }

  G.app('calendar', {
    name: '캘린더',
    icon: G.ICONS.calendar,
    folder: '기타',
    open(p) {
      const now = G.clock.now();
      let y = now.getFullYear(), m = now.getMonth(), sel = key(now), mode = 'month';
      if (p && p.date) { const [yy, mm] = p.date.split('-').map(Number); y = yy; m = mm - 1; sel = p.date; }
      const wrap = el('div.cal-wrap');
      const modeBtn = el('button', { 'aria-label': '목록 보기', html: IC.list, onclick: () => { G.audio.sfx.tap(); mode = mode === 'month' ? 'list' : 'month'; modeBtn.innerHTML = mode === 'month' ? IC.list : IC.grid; render(); } });
      const todayBtn = el('button', { 'aria-label': '오늘', html: IC.today, onclick: () => { G.audio.sfx.tap(); const n = G.clock.now(); y = n.getFullYear(); m = n.getMonth(); sel = key(n); mode = 'month'; modeBtn.innerHTML = IC.list; render(); } });
      const scr = G.ui.screen({ title: '캘린더', cls: 'cal-screen', right: [todayBtn, modeBtn], body: wrap });
      let sx = null;
      wrap.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      wrap.addEventListener('touchend', (e) => { if (mode !== 'month' || sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60 && e.target.closest('.cal-grid')) shift(dx < 0 ? 1 : -1); });
      function shift(d) { m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } G.audio.sfx.tap(); render(); }
      function render() {
        wrap.innerHTML = '';
        scr.querySelector('.sv-title').textContent = mode === 'month' ? `${y}년 ${m + 1}월` : '모든 일정';
        if (mode === 'list') { wrap.appendChild(listAll()); return; }
        const head = el('div.cal-nav', null,
          el('button', { 'aria-label': '이전 달', onclick: () => shift(-1) }, '‹'),
          el('b', null, `${y}년 ${m + 1}월`),
          el('button', { 'aria-label': '다음 달', onclick: () => shift(1) }, '›'));
        const grid = el('div.cal-grid');
        WEEK.forEach((d, i) => grid.appendChild(el('div.cal-dow' + (i === 0 ? '.sun' : i === 6 ? '.sat' : ''), null, d)));
        const first = new Date(y, m, 1).getDay(); const days = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.appendChild(el('div.cal-day.empty'));
        const all = evs();
        const tk = key(G.clock.now());
        for (let d = 1; d <= days; d++) {
          const dt = new Date(y, m, d); const k = key(dt);
          const es = all.filter((e) => e.date === k);
          const c = el('button.cal-day' + (k === tk ? '.today' : '') + (k === sel ? '.sel' : '') + (dt.getDay() === 0 ? '.sun' : dt.getDay() === 6 ? '.sat' : ''), null,
            el('b', null, String(d)),
            el('div.cal-bars', null, es.slice(0, 2).map((e) => el('i', { style: { background: e.color || '#888' } }, T(e.title)))),
            es.length > 2 ? el('small', null, `+${es.length - 2}`) : null);
          c.addEventListener('click', () => { sel = k; G.audio.sfx.tap(); render(); });
          grid.appendChild(c);
        }
        const list = el('div.cal-agenda');
        const es = all.filter((e) => e.date === sel);
        list.appendChild(el('div.ca-h', null, dateText(sel)));
        if (!es.length) list.appendChild(el('div.ca-empty', null, '일정 없음'));
        es.forEach((e) => list.appendChild(evRow(e)));
        if (es.length) G.bus.emit('calendar:day', sel);
        wrap.append(head, grid, list);
      }
      render();
      G.phone.push(scr);
    },
  });
  function evRow(e, showDate) {
    const r = el('button.cal-ev' + (e.creepy ? '.creepy' : ''), null,
      el('i.bar', { style: { background: e.color || '#888' } }),
      el('div', null,
        el('div.t', null, T(e.title)),
        el('div.s', null, [showDate ? dateText(e.date) : null, whenText(e), e.by ? '추가한 사람: ' + T(e.by) : null].filter(Boolean).join(' · '))));
    r.addEventListener('click', () => { G.audio.sfx.tap(); detail(e); });
    return r;
  }
  function listAll() {
    const all = evs().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const wrap = el('div.cal-list');
    let lastM = null;
    all.forEach((e) => {
      const mk = e.date.slice(0, 7);
      if (mk !== lastM) { const [yy, mm] = mk.split('-').map(Number); wrap.appendChild(el('div.cl-m', null, `${yy}년 ${mm}월`)); lastM = mk; }
      wrap.appendChild(evRow(e, true));
    });
    return wrap;
  }
  function detail(e) {
    const row = (ic, a, b, cls) => el('div.ce-row' + (cls ? '.' + cls : ''), null, el('span', { html: ic }), el('div', null, el('b', null, T(a)), b ? el('small', null, T(b)) : null));
    const body = el('div.cal-detail', null,
      el('div.ce-top', null, el('i', { style: { background: e.color || '#888' } }), el('h3', null, T(e.title))),
      row(IC.clock, dateText(e.date), whenText(e)),
      e.note ? row(IC.note, e.note) : null,
      row(IC.bell, e.allDay ? '알림 없음' : '30분 전 알림'),
      e.by ? row(IC.dev, '추가한 사람: ' + e.by, e.added ? '추가됨 ' + e.added : null, 'warn') : row(IC.dev, '세아의 Galaxy', '내 캘린더'),
      e.by ? el('button.ce-del', { onclick: () => { G.audio.sfx.error(); G.phone.toast('다른 기기에서 관리하는 일정은 삭제할 수 없습니다'); } }, '일정 삭제') : null);
    G.phone.push(G.ui.screen({ title: '일정', cls: 'cal-screen', body }));
    G.bus.emit('calendar:event', e.title);
    if (e.by && !G.state.vars['calNote_' + e.date]) {
      G.state.vars['calNote_' + e.date] = 1; G.save();
      if (e.date === '2026-11-23') SD.note('캘린더 “{N} 입주” — 추가한 사람: 알 수 없는 기기. 어젯밤 11시 41분.');
      if (e.date === '2026-03-10') SD.note('“♥ 1주년” 2026.03.10 — 옷장 수리 기사가 온 날(2025.03.10)에서 딱 1년. 누구의 기념일이지?');
    }
  }
})();
