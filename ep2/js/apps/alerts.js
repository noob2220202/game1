/* =========================================================
 * alerts — new app module ② (owner: media) — DESIGN §5.5 · §3.6 · §4.6.9 · §4.6.10 · §9.6 ② · §1.2.3.
 * Two home icons, ONE data source:
 *   재난 알림 (app 'alerts')   A1 수신 기록 (tabs 전체 · 긴급재난문자 · 안전안내문자, header line,
 *                              15 rows newest first) → A2 알림 상세 (seconds, 수신 사유) · A3 ⚙ 설정
 *   타임라인 (app 'timeline')  T1 month (dots 10–24, 25 after midnight; later days grey; ‹ 11월 = no record)
 *                              → T2 one day, DERIVED from G.STORY.days by the §1.2.3 rule (never hand-written)
 * The two apps never link to each other (the cross-check is the player's — T2-4 view-only puzzle).
 * Nothing here plays a sound (재난 알림음 never sounds). No map, no address, no '마포구' in the timeline.
 * factCbs = ∃ d ∈ {12-11,13,15,17,19,21,23} : d ∈ cbsDays ∧ d ∈ tlDays (order free).
 * seenCbs = [마포구청] rows ≥ 60 % visible at once ≥ min(3, ⌈fitRows / 2⌉) (IntersectionObserver).
 *
 * Public API : G.alerts = { init(), list(filter?) → rows, detail(id), timeline('12-15') → [{from, to, label, kind}],
 *              fmt12('05:39') → '오전 5:39', openSettings(), openTimeline(d?), selfCheck() → string[] }
 * Flags set  : cbsOpened tlOpened factCbs seenCbs        Vars set: cbsDays tlDays cbsMapoRows (+ vars.md.cbsOff)
 * Bus        : 'alerts:open' · 'timeline:day' {d}
 * Settings   : registers screen 'alerts.settings' with G.settingsApp (init)
 * data-qa    : alerts.tab:all|emergency|safety · alerts.row:<d> · alerts.gear · tl.day:<d> · tl.row:<i> · tl.prev
 *              (+ tl.next · tl.menu · alerts.set:<key>)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[alerts] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, I = MU.ICON, pad = MU.pad;
  const DAYS = () => (G.STORY && G.STORY.days) || {};
  const CBS = () => (G.STORY && G.STORY.cbs) || [];
  const MAPO = () => (G.STORY && G.STORY.cbsMapo) || {};
  const MMETA = () => (G.STORY && G.STORY.cbsMapoMeta) || { org: '{mapoOrg}', office: '{mapoOffice}', kind: '안전안내문자' };
  const UI = () => (G.STORY && G.STORY.cbsUI) || { tabs: [] };
  const TL = () => (G.STORY && G.STORY.tlUI) || {};
  const A = (G.alerts = G.alerts || {});

  A.fmt12 = function (hm) { return MU.fmt12(hm); };
  const dateOf = (d) => { const m = String(d).match(/^(\d{2})-(\d{2})$/); return m ? new Date(2026, +m[1] - 1, +m[2]) : null; };
  const dow = (d) => MU.WEEK[(dateOf(d) || new Date(2026, 11, 24)).getDay()];
  const shiftD = (d, n) => { const x = dateOf(d); x.setDate(x.getDate() + n); return `${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const toMin = (hm) => { const m = String(hm || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : NaN; };
  const MAPO_DAYS = () => Object.keys(DAYS()).filter((d) => DAYS()[d].mapo);
  const fmtSec = (hms) => { const m = String(hms).match(/^(\d{1,2}):(\d{2}):(\d{2})$/); return m ? `${MU.fmt12(m[1] + ':' + m[2])}:${m[3]}` : ''; };

  /* =========================================================
   * data → rows (single source)
   * ========================================================= */
  A.list = function (filter) {
    const rows = CBS().map((r) => ({ id: r.d, d: r.d, t: r.t, org: r.org, office: r.office, kind: r.kind, text: r.text, mapo: false }));
    Object.keys(MAPO()).forEach((d) => {
      const day = DAYS()[d]; if (!day || !day.mapo) return;
      const [sec, text] = MAPO()[d];
      rows.push({ id: d, d, t: `${day.mapo}:${sec}`, org: MMETA().org, office: MMETA().office, kind: MMETA().kind, text, mapo: true });
    });
    rows.sort((a, b) => (a.d === b.d ? (a.t < b.t ? 1 : -1) : a.d < b.d ? 1 : -1));
    const k = filter === 'emergency' ? '긴급재난문자' : filter === 'safety' ? '안전안내문자' : null;
    return k ? rows.filter((r) => r.kind === k) : rows;
  };

  /** §1.2.3 render rule → [{from, to, label, kind:'place'|'pause'|'off'|'on'|'none'}] ; [] = no record */
  A.timeline = function (d) {
    const D = DAYS(), L = TL();
    const lab = (k) => T(L[k] || '');
    const afterMidnight = isAfterMidnight();
    if (d === '12-10') {
      const on = (D['12-11'] || {}).on;
      return [{ from: '00:00', to: on, label: lab('noneLabel'), kind: 'none' }, { from: on, to: null, label: lab('onLabel'), kind: 'on' }, { from: on, to: '24:00', label: lab('placeFirst'), kind: 'place' }];
    }
    if (d === '12-25') return afterMidnight ? [{ from: '00:00', to: lab('now'), label: lab('place'), kind: 'place', live: true }] : [];
    const day = D[d];
    if (!day) return [];
    const out = [
      { from: '00:00', to: day.pause[0], label: lab('place'), kind: 'place' },
      { from: day.pause[0], to: day.pause[1], label: lab('pauseLabel'), kind: 'pause' },
      { from: day.pause[1], to: day.off, label: lab('place'), kind: 'place' },
      { from: day.off, to: null, label: lab('offLabel'), kind: 'off' },
    ];
    if (day.later) {
      day.later.forEach((x) => {
        if (x[1] === 'on') out.push({ from: x[0], to: null, label: lab('onLabel'), kind: 'on' });
        else if (x[2] === 'pause') out.push({ from: x[0], to: x[1], label: lab('pauseLabel'), kind: 'pause' });
        else if (x[2] === 'here') out.push({ from: x[0], to: afterMidnight ? '24:00' : lab('now'), label: lab('place'), kind: 'place', live: !afterMidnight });
      });
      return out;
    }
    const next = D[shiftD(d, 1)];
    if (next && next.on) out.push({ from: next.on, to: null, label: lab('onLabel'), kind: 'on' }, { from: next.on, to: '24:00', label: lab('place'), kind: 'place' });
    return out;
  };
  function isAfterMidnight() {
    try { if (G.clock && G.clock.minutes) return G.clock.minutes() >= 1440; } catch (e) {}
    const n = MU.now(); return n.getMonth() === 11 && n.getDate() >= 25;
  }

  /* ---------------- flags / vars ---------------- */
  const getArr = (k) => { const v = G.vars ? G.vars(k) : null; return Array.isArray(v) ? v : []; };
  function addDay(k, d) { const a = getArr(k); if (a.includes(d)) return; if (G.vars) G.vars(k, a.concat([d])); checkFact(); }
  function checkFact() {
    if (MU.flag('factCbs')) return;
    const c = getArr('cbsDays'), t = getArr('tlDays');
    if (MAPO_DAYS().some((d) => c.includes(d) && t.includes(d))) MU.flag('factCbs', true);
  }

  /* =========================================================
   * A1 수신 기록
   * ========================================================= */
  let filterTab = 'all';
  function listScreen(p) {
    p = p || {};
    if (p.tab) filterTab = p.tab;
    const U = UI();
    const tabs = el('div.md2-chips');
    const head = el('div.md2-cbs-head', null, T(U.head));
    const listBox = el('div.md2-cbs-list');
    const gear = MU.iconBtn(I.gear, '설정', 'alerts.gear', () => A.openSettings());
    const scr = MU.screen({ title: T(U.title), cls: 'md2-cbs', body: el('div', null, tabs, head, listBox), right: [gear] });
    let io = null;
    const seen = new Set();
    function count() {
      const n = seen.size;
      if (n > ((G.vars && G.vars('cbsMapoRows')) || 0) && G.vars) G.vars('cbsMapoRows', n);
      if (MU.flag('seenCbs')) return;
      const sc = scr.body || scr.querySelector('.sv-body');
      const row = listBox.querySelector('.md2-cbs-row');
      const rh = row ? row.getBoundingClientRect().height : 72;
      const fit = Math.max(1, Math.floor(((sc && sc.clientHeight) || 640) / Math.max(1, rh)));
      if (n >= Math.min(3, Math.ceil(fit / 2))) MU.flag('seenCbs', true);
    }
    function observe() {
      if (io) io.disconnect(); seen.clear();
      const mapoRows = Array.from(listBox.querySelectorAll('.md2-cbs-row.mapo'));
      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver((ents) => {
          ents.forEach((e) => { if (e.intersectionRatio >= 0.6) seen.add(e.target); else seen.delete(e.target); });
          count();
        }, { root: scr.body || null, threshold: [0, 0.6, 1] });
        mapoRows.forEach((r) => io.observe(r));
      } else {
        const sc = scr.body;
        const fn = () => { const R = sc.getBoundingClientRect(); seen.clear(); mapoRows.forEach((r) => { const b = r.getBoundingClientRect(); const vis = Math.max(0, Math.min(b.bottom, R.bottom) - Math.max(b.top, R.top)); if (b.height && vis / b.height >= 0.6) seen.add(r); }); count(); };
        sc && sc.addEventListener('scroll', fn, { passive: true }); setTimeout(fn, 60);
      }
    }
    function render() {
      tabs.innerHTML = '';
      (U.tabs || []).forEach(([k, l]) => {
        const b = el('button.md2-chip' + (filterTab === k ? '.on' : ''), { type: 'button' }, T(l));
        MU.qa(b, 'alerts.tab:' + k);
        b.addEventListener('click', () => { if (filterTab === k) return; MU.sfx('tap'); filterTab = k; render(); });
        tabs.appendChild(b);
      });
      listBox.innerHTML = '';
      A.list(filterTab).forEach((r) => {
        const hm = r.t.slice(0, 5);
        const row = el('button.md2-cbs-row' + (r.mapo ? '.mapo' : ''), { type: 'button' },
          el('span.md2-cbs-when', null, el('b', null, `${r.d.replace('-', '.')}(${dow(r.d)})`), el('small', null, MU.fmt12(hm))),
          el('span.md2-cbs-main', null, el('span.md2-cbs-org', null, el('b', null, T(r.office)), ' ', T(r.kind)), el('span.md2-cbs-text', null, T(r.text))));
        MU.qa(row, 'alerts.row:' + r.d);
        row.addEventListener('click', () => { MU.sfx('tap'); A.detail(r.id); });
        listBox.appendChild(row);
      });
      listBox.appendChild(el('div.md2-cbs-foot', null, T(U.foot)));
      if (scr.body) scr.body.scrollTop = 0;
      requestAnimationFrame(observe);
    }
    render();
    MU.push(scr, { onClose: () => { if (io) io.disconnect(); }, onResume: () => requestAnimationFrame(observe) });
    MU.flag('cbsOpened', true);
    try { G.phone && G.phone.renderHome && G.phone.renderHome(); } catch (e) {}
    MU.emit('alerts:open');
    return scr;
  }

  /* A2 알림 상세 */
  A.detail = function (id) {
    const r = A.list('all').find((x) => x.id === id);
    if (!r) return null;
    const U = UI();
    const dt = dateOf(r.d);
    const recv = `2026.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())} ${fmtSec(r.t)}`;
    const kv = (k, v) => el('div.md2-kv', null, el('span', null, T(k)), el('b', null, v));
    const body = el('div.md2-cbs-detail', null,
      el('div.md2-cbs-dh', null, T(r.office), ' ', T(r.kind)),
      el('p.md2-cbs-dt', null, T(r.text)),
      el('hr.md2-hr'),
      kv(U.from, `${T(r.org)} · ${T(r.kind)}`),
      kv(U.recv, recv),
      kv(U.reason, T(r.mapo ? U.reasonMapo : U.reasonHome)),
      kv(U.route, T(U.routeValue)));
    const scr = MU.screen({ title: '', cls: 'md2-cbs', body });
    MU.push(scr);
    addDay('cbsDays', r.d);
    return scr;
  };

  /* A3 ⚙ 재난 알림 설정 (also delegated to settings as 'alerts.settings') */
  function settingsBody() {
    const off = () => MU.md().cbsOff || [];
    return el('div.md2-rows', null, ((G.STORY && G.STORY.cbsSettings) || []).map((s) => {
      const val = el('span.md2-set-v', null, off().includes(s.key) ? T(UI().off) : T(s.value));
      const row = el('div.md2-set' + (s.grey ? '.grey' : ''), null, el('span.md2-set-m', null, el('b', null, T(s.label)), val));
      MU.qa(row, 'alerts.set:' + s.key);
      if (s.toggle) row.appendChild(MU.toggle(!off().includes(s.key), 'alerts.toggle:' + s.key, (on) => {
        const o = off().filter((k) => k !== s.key); if (!on) o.push(s.key);
        MU.mdSet({ cbsOff: o }); val.textContent = on ? T(s.value) : T(UI().off);
      }));
      return row;
    }));
  }
  A.openSettings = function () {
    MU.push(MU.screen({ title: T(UI().settingsTitle), cls: 'md2-cbs md2-plain', body: settingsBody() }));
  };

  /* =========================================================
   * 타임라인 T1 · T2
   * ========================================================= */
  function monthScreen(p) {
    p = p || {};
    const L = TL();
    let mon = 12;
    const body = el('div.md2-tl');
    const menuBtn = MU.iconBtn(I.more, '더보기', 'tl.menu', () => MU.menu(scr, [{ label: (L.menu || [])[0], qa: 'tl.settings', onClick: () => {
      if (G.settingsApp && G.settingsApp.open) G.settingsApp.open('location'); else G.hooks && G.hooks.call('settings:screen', 'location');
    } }]));
    const scr = MU.screen({ title: T(L.title), sub: T(L.sub), cls: 'md2-tlscr', body, right: [menuBtn] });
    function render() {
      body.innerHTML = '';
      const prev = MU.iconBtn(I.prev, '이전', 'tl.prev', () => { if (mon === 12) { mon = 11; render(); } });
      const next = MU.iconBtn(I.next, '다음', 'tl.next', () => { if (mon === 11) { mon = 12; render(); } });
      prev.disabled = mon === 11; next.disabled = mon === 12;
      body.appendChild(el('div.md2-cal-head', null, prev, el('b', null, T(mon === 12 ? L.month : L.monthPrev)), next));
      body.appendChild(el('div.md2-cal-week', null, (L.week || MU.WEEK).map((w, i) => el('span' + (i === 0 ? '.sun' : i === 6 ? '.sat' : ''), null, w))));
      const g = el('div.md2-cal-grid');
      const first = new Date(2026, mon - 1, 1).getDay(), days = new Date(2026, mon, 0).getDate();
      for (let i = 0; i < first; i++) g.appendChild(el('span.md2-cal-pad'));
      const today = isAfterMidnight() ? 25 : 24;
      for (let dd = 1; dd <= days; dd++) {
        const d = `${pad(mon)}-${pad(dd)}`;
        const dw = (first + dd - 1) % 7;
        const future = mon === 12 && dd > today;
        const has = mon === 12 && dd >= 10 && dd <= today;
        const b = el('button.md2-cal-d' + (dw === 0 ? '.sun' : dw === 6 ? '.sat' : '') + (future ? '.future' : '') + (mon === 12 && dd === today ? '.today' : '') + (has ? '.has' : ''), { type: 'button', 'aria-label': `${mon}월 ${dd}일` },
          el('span', null, String(dd)), has ? el('i.md2-dot') : null);
        MU.qa(b, 'tl.day:' + d);
        if (future || mon === 11) b.disabled = true;
        else b.addEventListener('click', () => { MU.sfx('tap'); dayScreen(d); });
        g.appendChild(b);
      }
      body.appendChild(g);
      if (mon === 11) body.appendChild(el('div.md2-empty', null, el('b', null, T(L.monthEmpty))));
    }
    render();
    MU.push(scr, { onResume: render });
    MU.flag('tlOpened', true);
    if (p.d) dayScreen(p.d);
    return scr;
  }

  function dayScreen(d) {
    const L = TL();
    const dt = dateOf(d);
    const rows = A.timeline(d);
    const body = el('div.md2-tl-day');
    if (!rows.length) body.appendChild(el('div.md2-empty', null, el('b', null, T(L.dayEmpty))));
    rows.forEach((r, i) => {
      const time = r.to ? `${r.from}–${r.to}` : r.from;
      const row = el('button.md2-tl-row.' + r.kind, { type: 'button' },
        el('span.md2-tl-time', null, time), el('i.md2-tl-pin'), el('span.md2-tl-lab', null, r.label));
      MU.qa(row, 'tl.row:' + i);
      row.addEventListener('click', () => {
        if (r.kind === 'pause') { MU.sfx('tap'); MU.toast(T(L.paused)); }
        else if (r.kind === 'place') {
          MU.sfx('tap');
          const nx = row.nextElementSibling;
          if (nx && nx.classList.contains('md2-tl-card')) { nx.remove(); return; }
          row.after(el('div.md2-tl-card', null, el('span', { html: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0113 0c0 4.9-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>' }), T(L.placeCard)));
        }
      });
      body.appendChild(row);
    });
    const title = dt ? `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${MU.WEEK[dt.getDay()]}요일` : '';
    MU.push(MU.screen({ title, cls: 'md2-tlscr', body }));
    if (rows.length) addDay('tlDays', d);
    MU.emit('timeline:day', { d });
  }
  A.openTimeline = function (d) { if (G.phone && G.phone.openApp) G.phone.openApp('timeline', d ? { d } : {}); };

  /* =========================================================
   * apps
   * ========================================================= */
  const ICON_FB = {
    alerts: { bg: 'linear-gradient(160deg,#ff9f43,#e8590c)', svg: '<svg viewBox="0 0 24 24"><path d="M12 3.5L2.8 19.5h18.4z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.5v5M12 16.8v.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>' },
    timeline: { bg: 'linear-gradient(160deg,#4dd4ac,#0f9d76)', svg: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0113 0c0 4.9-6.5 11-6.5 11z" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="10" r="2.4" fill="#fff"/></svg>' },
  };
  MU.app('alerts', {
    name: '재난 알림',
    icon: (G.ICONS && G.ICONS.alerts) || ICON_FB.alerts,
    badge: (user) => {
      if ((user || MU.user()) !== 'n' || MU.flag('cbsOpened')) return 0;
      const n = ((G.state && G.state.notifs) || []).find((x) => x && x.id === 'N03');
      return n && !n.read ? 1 : 0;
    },
    open(p) { p = p || {}; listScreen(p); if (p.id) A.detail(p.id); },
  });
  MU.app('timeline', {
    name: '타임라인',
    icon: (G.ICONS && G.ICONS.timeline) || ICON_FB.timeline,
    badge: () => 0,
    open(p) { monthScreen(p || {}); },
  });

  /* =========================================================
   * self-check (§9.6 ② 자동 검산 ①–⑤ + §4.6.9 / §4.6.10 tables) — DEBUG boot
   * ========================================================= */
  const EXPECT_TL = {   // §4.6.10 table transcription: pause0 pause1 off nextOn
    '12-11': '05:38 07:12 07:16 22:07', '12-12': '05:41 07:09 07:13 22:52', '12-13': '05:40 07:14 07:18 22:19', '12-14': '05:36 07:08 07:11 22:33',
    '12-15': '05:42 07:11 07:15 22:26', '12-16': '05:39 07:10 07:14 22:48', '12-17': '05:40 07:13 07:17 22:14', '12-18': '05:37 07:07 07:12 22:39',
    '12-19': '05:41 07:12 07:16 22:05', '12-20': '05:40 07:10 07:13 22:57', '12-21': '05:43 07:15 07:19 22:21', '12-22': '05:38 07:09 07:12 22:44',
    '12-23': '05:40 07:11 07:15 22:30',
  };
  const EXPECT_CBS = ['12-24 22:52:14 E 긴급재난문자', '12-23 06:15:42 M 안전안내문자', '12-22 23:40:09 E 긴급재난문자', '12-21 06:29:51 M 안전안내문자',
    '12-20 23:10:33 E 안전안내문자', '12-19 06:00:27 M 안전안내문자', '12-18 22:58:46 E 긴급재난문자', '12-17 06:37:12 M 안전안내문자',
    '12-16 23:21:05 E 긴급재난문자', '12-15 06:11:08 M 안전안내문자', '12-14 22:47:31 E 긴급재난문자', '12-13 06:22:19 M 안전안내문자',
    '12-12 23:05:57 E 긴급재난문자', '12-11 06:04:38 M 안전안내문자', '12-10 23:02:44 E 긴급재난문자'];
  /** is the phone on (and in its 'here' interval) at d hm? evening → after that night's power-on; morning → before the pause */
  function onAt(d, hm) {
    const D = DAYS(), m = toMin(hm);
    if (m >= 12 * 60) {
      if (d === '12-24') return m >= toMin('18:00');
      const nx = D[shiftD(d, 1)]; return !!(nx && m >= toMin(nx.on));
    }
    const day = D[d]; return !!(day && m < toMin(day.pause[0]));
  }
  A.selfCheck = function () {
    const err = [], D = DAYS();
    // ① every [마포구청] inside that morning's pause
    MAPO_DAYS().forEach((d) => { const x = D[d]; const m = toMin(x.mapo); if (!(m >= toMin(x.pause[0]) && m <= toMin(x.pause[1]))) err.push(`① ${d} mapo ${x.mapo} outside pause ${x.pause.join('–')}`); });
    // ② every [은평구청] after that night's power-on
    CBS().forEach((r) => { if (!onAt(r.d, r.t.slice(0, 5))) err.push(`② ${r.d} ${r.t} before power-on`); });
    // ③ everything he did with this phone after 12-10 sits inside an 'on' interval
    const acts = [['12-12', '23:01'], ['12-15', '22:31'], ['12-17', '22:20'], ['12-21', '23:40'], ['12-21', '23:52'], ['12-22', '23:31'], ['12-22', '23:33'], ['12-23', '23:05']];
    try {
      const gal = (G.STORY.gallery && G.STORY.gallery.dash && G.STORY.gallery.dash.albums) || [];
      gal.forEach((a) => a.items.forEach((it) => {
        (it.info || []).forEach((line) => { const m = String(line).match(/저장 2026\.(\d{2})\.(\d{2}) (오전|오후) (\d{1,2}):(\d{2})/); if (m) { let h = +m[4] % 12; if (m[3] === '오후') h += 12; acts.push([`${m[1]}-${m[2]}`, `${pad(h)}:${m[5]}`]); } });
        if (a.id === 'roof' && it.t) { const p = MU.parseT(it.t); acts.push([`${pad(p.getMonth() + 1)}-${pad(p.getDate())}`, `${pad(p.getHours())}:${pad(p.getMinutes())}`]); }
      }));
      ((G.STORY.browser && G.STORY.browser.history) || []).forEach((h) => {
        const p = MU.parseT(h.d); const m = String(h.when).match(/(오전|오후) (\d{1,2}):(\d{2})/); if (!p || !m) return;
        if (p < new Date(2026, 11, 10, 23)) return;
        let hh = +m[2] % 12; if (m[1] === '오후') hh += 12; acts.push([`${pad(p.getMonth() + 1)}-${pad(p.getDate())}`, `${pad(hh)}:${m[3]}`]);
      });
    } catch (e) { err.push('③ data read failed: ' + e.message); }
    acts.forEach(([d, hm]) => { if (d === '12-10') { if (toMin(hm) < toMin((D['12-11'] || {}).on)) err.push(`③ 12-10 ${hm} before 22:41`); return; } if (!onAt(d, hm)) err.push(`③ ${d} ${hm} outside power-on`); });
    // ④ hotspot last connect = today's pause start
    try {
      const w = ((G.STORY.security && G.STORY.security.wifi) || []).find((x) => x.id === 'SM-G991N_0A3F');
      if (w) { const line = typeof w.line === 'function' ? w.line() : w.line; if (!String(line).includes(A.fmt12(D['12-24'].pause[0]))) err.push('④ hotspot line ≠ 12-24 pause start'); }
    } catch (e) { err.push('④ ' + e.message); }
    // ⑤ days ↔ bible §10.5 snapshot
    const snap = Object.keys(D).sort().map((d) => { const x = D[d]; return `${d} ${x.on} ${x.pause[0]}-${x.pause[1]} ${x.mapo || '-'} ${x.off}`; });
    const want = (G.STORY && G.STORY.daysSnapshot) || [];
    if (want.length && snap.join('|') !== want.join('|')) err.push('⑤ days ≠ bible §10.5 snapshot');
    // §4.6.10 rendered timeline
    Object.keys(EXPECT_TL).forEach((d) => {
      const [p0, p1, off, on] = EXPECT_TL[d].split(' ');
      const got = A.timeline(d).map((r) => (r.to ? `${r.from}–${r.to} ${r.label}` : `${r.from} ${r.label}`)).join('|');
      const L = TL();
      const exp = [`00:00–${p0} ${T(L.place)}`, `${p0}–${p1} ${T(L.pauseLabel)}`, `${p1}–${off} ${T(L.place)}`, `${off} ${T(L.offLabel)}`, `${on} ${T(L.onLabel)}`, `${on}–24:00 ${T(L.place)}`].join('|');
      if (got !== exp) err.push(`T ${d}: ${got} ≠ ${exp}`);
    });
    // §4.6.9 list (order, seconds, kind, office)
    const got = A.list('all').map((r) => `${r.d} ${r.t} ${r.mapo ? 'M' : 'E'} ${r.kind}`);
    if (got.join('|') !== EXPECT_CBS.join('|')) err.push('A1 list ≠ §4.6.9 table');
    if (A.list('all').length !== 15) err.push('A1 count ≠ 15');
    return err;
  };

  /* =========================================================
   * init (flow main → G.alerts.init)
   * ========================================================= */
  let inited = false;
  A.init = function () {
    if (inited) return; inited = true;
    try {
      if (G.settingsApp && G.settingsApp.register) {
        G.settingsApp.register('alerts.settings', { title: T(UI().settingsTitle), render: () => settingsBody(), keywords: UI().keywords || [] });
      }
    } catch (e) { console.error('[alerts] settings register', e); }
    if (G.DEBUG) {
      const e = A.selfCheck();
      if (e.length) console.error('[alerts] selfCheck', e); else console.info('[alerts] selfCheck ok');
    }
  };
  MU.on('app:open', (id) => { if (id === 'settings' || id === 'alerts' || id === 'timeline') A.init(); });   // settings search can reach 'alerts.settings' even if flow never called init
  if (G.DEBUG && window.haru) window.haru.alerts = { selfCheck: () => A.selfCheck(), timeline: (d) => A.timeline(d), list: (f) => A.list(f) };
})();
