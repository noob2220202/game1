/* =========================================================
 * 인터넷 — DESIGN §4.5. Real-browser chrome (URL bar, toolbar, tabs, history, bookmarks).
 * - opens on the 열린 탭 (news, opened 2026.11.20 by 다른 기기)
 * - 기록: meta first row (location.host · firstOpenReal), his searches, 세아's 2025 searches
 * - 탭 › 다른 기기의 탭 · Galaxy (SM-G991N): rows by state, frozen after M5 ('마지막 동기화 N분 전')
 * - 북마크 › 입주민 카페: EPS notice, 403호 post + black photo that brightens when held in view
 * - page 'qr404' (H5) sets managerExposed
 * API: G.browser.openPage(id), G.phone.openApp('browser', {page:'qr404'})
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);
  const BR = (G.browser = {});
  const page = (id) => (G.STORY.pages || {})[id];
  const mirroring = () => (G.mirroring ? G.mirroring() : G.flag('M1') && !G.flag('M5'));

  const IC = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 11-2.1-5M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hist: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    device: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5M12 3.5C9.4 5.9 8.4 8.8 8.4 12s1 6.1 3.6 8.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  };

  /* =========================================================
   * chrome: URL bar + page + toolbar (each page is one pushed screen)
   * ========================================================= */
  function chrome(content, o) {
    const urlBar = el('button.br-url', { onclick: () => searchSheet(o.url) },
      o.home ? el('span.bu-ic', { html: IC.globe }) : el('span.bu-ic.secure', { html: IC.lock }),
      el('span.bu-t', null, o.home ? '검색어 또는 URL 입력' : T(o.url)),
      o.home ? null : el('span.bu-r', { html: IC.reload }));
    const top = el('div.br-top', null, urlBar);
    const prog = el('div.br-prog');
    top.appendChild(prog);
    const bodyEl = el('div.sv-body.br-scroll', null, content);
    const tb = (ic, label, fn, dis) => el('button.br-tb' + (dis ? '.dis' : ''), { 'aria-label': label, html: ic, onclick: () => { if (dis) return; G.audio.sfx.tap(); fn(); } });
    const tools = el('div.br-tools', null,
      tb(IC.back, '뒤로', () => G.phone.back()),
      tb(IC.fwd, '앞으로', () => {}, true),
      tb(IC.home, '홈', () => openHome()),
      tb(IC.star, '북마크', () => bookmarks()),
      el('button.br-tb.tabs', { 'aria-label': '탭', onclick: () => { G.audio.sfx.tap(); tabsView(); } }, el('span', null, '1')),
      tb(IC.menu, '메뉴', () => menuSheet()));
    const scr = el('section.br-screen', { dataset: { status: 'light', theme: 'light' } }, top, bodyEl, tools);
    scr.body = bodyEl;
    requestAnimationFrame(() => { prog.classList.add('go'); setTimeout(() => prog.classList.add('done'), 520); });
    return scr;
  }

  G.app('browser', {
    name: '인터넷',
    icon: G.ICONS.browser,
    dock: true,
    open(p) {
      if (p && p.page) { BR.openPage(p.page); return; }
      if (p && p.view === 'history') { historyView(); return; }
      if (p && p.view === 'tabs') { tabsView(); return; }
      BR.openPage('news');
    },
  });

  BR.openPage = function (id, opts) {
    const pg = page(id);
    if (!pg) return BR.offline(id);
    const content = el('div.br-page', null, pg.render());
    const scr = chrome(content, { url: pg.url, home: pg.kind === 'home' });
    G.phone.push(scr, { anim: opts && opts.anim });
    G.state.seen['page:' + id] = true;
    const v = G.state.vars;
    v.brVisited = v.brVisited || {};
    if (!v.brVisited[id] && pg.kind !== 'home') { v.brVisited[id] = G.clock.now().getTime(); }
    G.save();
    G.bus.emit('browser:page', id);
    try { pg.onOpen && pg.onOpen(scr); } catch (e) { console.error(e); }
    return scr;
  };
  function openHome() { BR.openPage('home'); }
  BR.offline = function (site) {
    const content = el('div.br-offline', null, el('div.bo-ic', { html: IC.globe }), el('b', null, '페이지를 열 수 없습니다'), el('span', null, '관리자 네트워크에서 이 주소로의 연결을 제한했습니다.'), el('small', null, 'ERR_NETWORK_ACCESS_DENIED'));
    G.phone.push(chrome(content, { url: site || 'about:blank' }));
  };
  BR.search = function (q) {
    G.bus.emit('browser:search', q);
    const r = G.STORY.search ? G.STORY.search(q) : null;
    if (typeof r === 'string') return BR.openPage(r);
    const content = el('div.br-page', null, r instanceof Node ? r : el('div.empty-state', null, '검색 결과를 불러올 수 없습니다.'));
    G.phone.push(chrome(content, { url: 'search.daon.net/?q=' + encodeURIComponent(q) }));
  };

  /* ---------- URL / search sheet ---------- */
  function searchSheet(cur) {
    const field = G.ui.field({ placeholder: '검색어 또는 URL 입력', submitLabel: '이동', onSubmit: (v) => { v = String(v || '').trim(); if (!v) return; G.ui.hideKeyboard(); ov.close(); BR.search(v); } });
    const sugg = el('div.bs-sugg', null, (G.STORY.bookmarks || []).map(page).filter(Boolean).map((pg) => el('button', { onclick: () => { G.ui.hideKeyboard(); ov.close(); BR.openPage(Object.keys(G.STORY.pages).find((k) => G.STORY.pages[k] === pg)); } }, el('span', { html: IC.star }), T(pg.title))));
    const box = el('div.br-sheet', null, el('div.bs-row', null, field.node, el('button.bs-x', { onclick: () => { G.ui.hideKeyboard(); ov.close(); } }, '취소')), el('div.bs-h', null, '북마크'), sugg);
    const ov = G.phone.overlay(el('div.br-sheet-wrap', null, box), { onBack: () => { G.ui.hideKeyboard(); ov.close(); } });
    setTimeout(() => field.focus(), 200);
  }

  /* ---------- menu ---------- */
  function menuSheet() {
    const item = (ic, l, fn) => el('button.bm-item', { onclick: () => { G.audio.sfx.tap(); ov.close(); fn(); } }, el('span', { html: ic }), el('small', null, l));
    const box = el('div.br-menu', null,
      item(IC.hist, '방문 기록', historyView),
      item(IC.star, '북마크', bookmarks),
      item(IC.device, '탭', tabsView),
      item(IC.home, '홈', openHome));
    const ov = G.phone.overlay(el('div.br-menu-wrap', { onclick: (e) => { if (e.target.classList.contains('br-menu-wrap')) ov.close(); } }, box), { onBack: () => ov.close() });
  }

  /* ---------- home ---------- */
  BR.homePage = function () {
    const tiles = [['cafe', '입주민 카페', '#2e7d6b', '🏢'], ['news', '한울일보', '#1e3a8a', '📰'], ['haesol_web', '해솔홈', '#0f1b26', '🏠'], ['as_lookup', '관리사무소', '#5b7aa6', '🛠️']];
    return el('div.br-home', null,
      el('div.bh-logo', null, '인터넷'),
      el('button.bh-search', { onclick: () => searchSheet('') }, el('span', { html: '🔍' }), '검색어 또는 URL 입력'),
      el('div.bh-tiles', null, tiles.map(([id, l, c, e]) => el('button.bh-tile', { onclick: () => { G.audio.sfx.tap(); BR.openPage(id); } }, el('span', { style: { background: c } }, e), el('small', null, l)))),
      el('div.bh-sec', null, '최근 방문'),
      historyList(5));
  };

  /* ---------- history ---------- */
  function metaRow() {
    const real = G.state.vars.firstOpenReal || G.state.startedAt || Date.now();
    const d = new Date(real);
    const host = location.host || 'haru.pengueverything.cloud';
    return { meta: true, title: T('{N를} 위한 방탈출!'), url: host, when: `오늘 ${pad(d.getHours())}:${pad(d.getMinutes())}`, sec: '오늘' };
  }
  function historyItems() {
    const base = (G.STORY.history || []).filter((h) => !h.show || h.show()).slice().sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t));
    const v = G.state.vars.brVisited || {};
    const extra = Object.keys(v).filter((id) => !['news', 'home'].includes(id) && !base.some((h) => h.page === id) && page(id)).map((id) => ({ page: id, title: page(id).title, when: '방금', t: v[id], sec: '오늘', fresh: true }));
    extra.sort((a, b) => b.t - a.t);
    return [metaRow()].concat(extra, base);
  }
  function historyList(limit) {
    const wrap = el('div.br-hist');
    let lastSec = null;
    historyItems().slice(0, limit || 99).forEach((h) => {
      if (!limit && h.sec !== lastSec) { wrap.appendChild(el('div.bh-day', null, h.sec === '2025년' ? '2025년' : h.sec)); lastSec = h.sec; }
      const pg = h.page ? page(h.page) : null;
      const row = el('button.bh-row' + (h.meta ? '.meta' : ''), null,
        el('span.bh-fav', { html: h.meta ? '<b>!</b>' : IC.globe }),
        el('span.bh-main', null, el('b', null, T(h.title || (pg && pg.title) || '')), el('small', null, T(h.url || (pg && pg.url) || ''))),
        el('span.bh-when', null, h.when || ''));
      row.addEventListener('click', () => {
        G.audio.sfx.tap();
        if (h.meta) { G.phone.toast('지금 보고 있는 페이지입니다'); G.bus.emit('browser:meta'); return; }
        if (pg) BR.openPage(h.page); else BR.offline(h.url);
      });
      wrap.appendChild(row);
    });
    return wrap;
  }
  function historyView() {
    const scr = G.ui.screen({ title: '방문 기록', cls: 'br-list-screen', body: historyList() });
    G.phone.push(scr);
    G.bus.emit('browser:history');
  }
  BR.history = historyView;

  /* ---------- bookmarks ---------- */
  function bookmarks() {
    const ids = G.STORY.bookmarks || [];
    const body = el('div.br-bm', null, ids.map((id) => {
      const pg = page(id); if (!pg) return null;
      return el('button.bh-row', { onclick: () => { G.audio.sfx.tap(); BR.openPage(id); } }, el('span.bh-fav.star', { html: IC.star }), el('span.bh-main', null, el('b', null, T(pg.title)), el('small', null, pg.url)));
    }));
    G.phone.push(G.ui.screen({ title: '북마크', cls: 'br-list-screen', body }));
  }

  /* ---------- tabs (this device + 다른 기기의 탭) ---------- */
  function syncRows() {
    const v = G.state.vars;
    if (G.flag('M5')) {
      if (!v.syncFrozen) v.syncFrozen = { ids: computeRows(true).map((r) => r.id), at: G.clock.now().getTime() };
      return v.syncFrozen.ids.map((id) => (G.STORY.syncedTabs || []).find((r) => r.id === id)).filter(Boolean);
    }
    return computeRows(false);
  }
  function computeRows(atCut) {
    const o = { mirroring: atCut ? true : mirroring() };
    return (G.STORY.syncedTabs || []).filter((r) => { try { return r.when(o); } catch (e) { return false; } }).slice(0, 4);
  }
  G.bus.on('flag:M5', () => { const v = G.state.vars; if (!v.syncFrozen) { v.syncFrozen = { ids: computeRows(true).map((r) => r.id), at: G.clock.now().getTime() }; G.save(); } });
  function syncLabel() {
    const v = G.state.vars;
    if (G.flag('M5') && v.syncFrozen) {
      const m = Math.max(2, 2 + Math.floor((G.clock.now().getTime() - v.syncFrozen.at) / 60000));
      return `마지막 동기화 ${m}분 전`;
    }
    return '방금 전';
  }
  function tabsView() {
    const pg = page('news');
    const thumb = el('button.tab-card', { onclick: () => { G.audio.sfx.tap(); BR.openPage('news'); } },
      el('div.tc-head', null, el('span', { html: IC.globe }), el('b', null, T(pg.title))),
      el('div.tc-body', null, el('div.tc-src', null, '한울일보 · 사회'), el('div.tc-h', null, T(pg.title)), el('div.tc-l'), el('div.tc-l'), el('div.tc-l.s')),
      el('div.tc-foot', null, '다른 기기에서 연 탭 · ' + (pg.openedBy || '2026.11.20')));
    const rowsBox = el('div.sync-rows');
    const head = el('div.sync-head', null, el('span', { html: IC.device }), el('div', null, el('b', null, '다른 기기의 탭'), el('small.sync-when', null, `Galaxy (SM-G991N) · ${syncLabel()}`)));
    function renderRows() {
      rowsBox.innerHTML = '';
      syncRows().forEach((r) => {
        const row = el('button.sync-row', null, el('span.bh-fav', { html: IC.globe }), el('span.bh-main', null, el('b', null, T(r.title)), el('small', null, r.url)));
        row.addEventListener('click', () => { G.audio.sfx.tap(); if (r.page) BR.openPage(r.page); else G.phone.toast('다른 기기의 탭은 이 기기에서 열 수 없습니다'); });
        rowsBox.appendChild(row);
      });
      head.querySelector('.sync-when').textContent = `Galaxy (SM-G991N) · ${syncLabel()}`;
    }
    renderRows();
    const body = el('div.tabs-view', null, el('div.tv-sec', null, '이 기기의 탭 1'), thumb, el('div.sync-card', null, head, rowsBox));
    const scr = G.ui.screen({ title: '탭', cls: 'br-list-screen tabs-screen', body });
    const offs = [G.bus.on('flag', renderRows), G.bus.on('tick', () => { const w = head.querySelector('.sync-when'); if (w) w.textContent = `Galaxy (SM-G991N) · ${syncLabel()}`; })];
    G.phone.push(scr, { onClose: () => offs.forEach((f) => f()) });
    G.state.seen.syncTabs = true; G.save();
    G.bus.emit('browser:tabs');
  }
  BR.tabs = tabsView;

  /* =========================================================
   * page helpers used by js/data/browser.js
   * ========================================================= */
  BR.article = function (o) {
    return el('div.art', null,
      o.source ? el('div.art-src', null, T(o.source)) : null,
      el('div.art-h', null, T(o.title)),
      el('div.art-meta', null, T(o.meta || '')),
      (o.blocks || []).map((b) => {
        if (typeof b === 'string') return el('div.art-p', { html: T(b) });
        if (b.img) return [el('div.art-img', null, SD.imgEl(b.img)), b.cap ? el('div.art-cap', null, T(b.cap)) : null];
        if (b.related) return el('div.art-rel', null, el('b', null, '관련 기사'), b.related.map((x) => el('button', { onclick: () => BR.offline('news.hanul.kr') }, T(x))));
        return b;
      }),
      (o.comments || []).length ? el('div.art-cmh', null, `댓글 ${o.comments.length}`) : null,
      (o.comments || []).map((c) => el('div.comment' + (c.creepy ? '.creepy' : ''), null,
        el('div.cm-top', null, el('b', null, T(c.name)), el('small', null, T(c.t || ''))),
        el('div', null, T(c.text)), c.node || null)));
  };
  BR.board = function (o) {
    return el('div.board', null,
      el('div.bd-head', null, el('div.bd-logo', null, '🏢'), el('div', null, el('b', null, T(o.name)), el('small', null, T(o.sub || '')))),
      el('div.bd-tabs', null, el('span.on', null, '전체글'), el('span', null, '공지'), el('span', null, '자유게시판')),
      o.posts.map((p) => {
        const row = el('button.bd-row' + (p.notice ? '.notice' : ''), null,
          el('div.bd-t', null, p.notice ? el('em', null, '공지') : null, T(p.title), p.n ? el('span.bd-n', null, `[${p.n}]`) : null),
          el('div.bd-m', null, `${p.by} · ${p.date}`));
        row.addEventListener('click', () => { G.audio.sfx.tap(); if (p.page) BR.openPage(p.page); else BR.offline('cafe.haesolvil.kr'); });
        return row;
      }));
  };

  /* ---------- the black photo (403호 post, comment by '404', today 03:31) ---------- */
  BR.darkPhoto = function () {
    const p = G.state.vars.cafePhotoP || 0;
    const base = el('div.dp-base'); SD.bg(base, 'haru_fallback_dark');
    const lit = el('div.dp-lit'); SD.bg(lit, 'haru_fallback');
    const box = el('div.dark-photo', null, base, lit, el('div.dp-grain'));
    box._set = (x) => { lit.style.opacity = String(Math.min(1, x)); lit.style.filter = `brightness(${(0.05 + 0.85 * x).toFixed(3)})`; base.style.filter = `brightness(${(0.6 + 0.6 * x).toFixed(3)})`; };
    box._set(p);
    return box;
  };
  BR.watchDarkPhoto = function (scr) {
    const box = scr.querySelector('.dark-photo');
    if (!box) return;
    const sc = scr.body;
    let ratio = 0, lastTop = sc.scrollTop, lastT = performance.now(), speed = 0, hold = 0, raf = 0, alive = true;
    let io = null;
    try { io = new IntersectionObserver((e) => { ratio = e[0].intersectionRatio; }, { root: sc, threshold: [0, 0.5, 0.9, 1] }); io.observe(box); } catch (e) { ratio = 1; }
    function frame(t) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, t - lastT); lastT = t;
      const top = sc.scrollTop;
      const v = (Math.abs(top - lastTop) / Math.max(1, dt)) * 1000; lastTop = top;
      speed = speed * 0.8 + v * 0.2;
      const vars = G.state.vars;
      let p = vars.cafePhotoP || 0;
      const isTop = G.phone.top && G.phone.top() && G.phone.top().node === scr;
      if (isTop && ratio >= 0.9 && speed < 50 && !document.hidden) {
        hold += dt;
        if (hold >= 1200 && p < 1) {
          p = Math.min(1, p + dt / 3500);
          vars.cafePhotoP = p;
          box._set(p);
          if (p >= 1) reveal();
        }
      } else hold = 0;
    }
    raf = requestAnimationFrame(frame);
    const saver = setInterval(() => G.save(), 1500);
    function reveal() {
      if (G.flag('cafePhoto')) return;
      G.flag('cafePhoto', true);
      G.save();
      try {
        const A = G.audio;
        if (A.duck) A.duck(0.45, 4);
        if (A.osc && A.ok && A.ok()) { const o = A.osc('sine', 46, A.now(), 1.4, 0.32, A.bus('sfx'), { a: 0.08, decay: true }); o && o.frequency && o.frequency.exponentialRampToValueAtTime(30, A.now() + 1.2); }
        else if (A.sfx.thud) A.sfx.thud(0.6);
      } catch (e) {}
      SD.note('카페 사진… 이 침대. 휴대폰 불빛. 지금 나다.');
    }
    // stop when the page closes
    const mo = new MutationObserver(() => { if (!scr.isConnected) { alive = false; cancelAnimationFrame(raf); clearInterval(saver); io && io.disconnect(); mo.disconnect(); G.save(); } });
    mo.observe(document.getElementById('app-stack') || document.body, { childList: true });
  };

  /* ---------- QR facility record ---------- */
  BR.facility = function () {
    const rows = [
      ['2019.06.14', '리모델링: EPS실–404호 배관 점검구(60×90cm) 합판 폐쇄', '관리사무소', '완료', ''],
      ['2025.03.10', '붙박이장 문 수리', '—', '접수 내역 없음', 'bad'],
      ['2025.04.02', '붙박이장 뒤 벽에서 긁는 소리', '윤세아', '보류', 'hold'],
      ['2025.11.20', '도어락 관리자 잠금 오류', '—', '접수 내역 없음', 'bad'],
    ];
    return el('div.fac', null,
      el('div.fac-brand', null, el('span', null, '해솔빌 관리사무소'), el('small', null, '시설 고장신고 시스템')),
      el('div.fac-h', null, '해솔빌 시설 고장신고 이력 · 404호'),
      el('table.fac-t', null,
        el('thead', null, el('tr', null, ['일자', '내용', '신고자', '처리'].map((h) => el('th', null, h)))),
        el('tbody', null, rows.map((r) => el('tr', null, el('td', null, r[0]), el('td', null, r[1]), el('td', null, r[2]), el('td', null, el('b.' + (r[4] || 'ok'), null, r[3])))))),
      el('div.fac-foot', null, '관리사무소는 새벽에 개인 문자·톡을 보내지 않습니다. 관리실 사칭에 주의하세요. ☎ 02-338-5120'),
      el('div.fac-last', null, ''));
  };
  BR.typeLast = async function (scr) {
    const n = scr.querySelector('.fac-last');
    if (!n) return;
    const text = '이 기록을 열람한 기기: 2대 · 마지막 열람: 방금 전';
    await sleep(1600);
    for (let i = 1; i <= text.length; i++) { if (!scr.isConnected) return; n.textContent = text.slice(0, i); if (i % 2) try { G.audio.sfx.key(); } catch (e) {} await sleep(i < 14 ? 110 : 70); }
    n.classList.add('done');
  };
  BR.asLookup = function () {
    const field = G.ui.field({ placeholder: '호수 (예: 101)', mode: 'en', submitLabel: '조회', maxLength: 4, onSubmit: (v) => go(v) });
    const err = el('div.as-err');
    function go(v) {
      G.ui.hideKeyboard();
      v = String(v || '').replace(/\D/g, '');
      if (v === '404') { BR.openPage('qr404'); return; }
      err.textContent = v ? `${v}호의 공개 이력이 없습니다.` : '호수를 입력하세요.';
      G.audio.sfx.error();
    }
    return el('div.fac', null,
      el('div.fac-brand', null, el('span', null, '해솔빌 관리사무소'), el('small', null, '시설 고장신고 시스템')),
      el('div.fac-h', null, '고장신고 이력 조회'),
      el('div.as-box', null, el('small', null, '세대 호수를 입력하면 처리 이력을 볼 수 있습니다.'), field.node, el('button.as-go', { onclick: () => go(field.value) }, '조회'), err),
      el('div.fac-foot', null, '평일 09:00–18:00 · ☎ 02-338-5120\n문 옆 스티커의 QR로도 조회할 수 있습니다.'));
  };
})();
