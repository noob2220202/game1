/* =========================================================
 * 인터넷 (owner: media) — DESIGN §4.7.5 · §3.21 인터넷 기록 · §9.5 (no attack 'how-to' anywhere).
 * Start screen: `다온` · search box `검색어 입력` (in-game keyboard, predict bar, ctx 'browserSearch') ·
 * `최근 방문` = the top 3 rows of the record · `열린 탭 0`. ⋮ › `기록` = 19 fixed rows grouped by date
 * (the player's own searches stack on top under `오늘` — text kept in the session store only).
 * Record rows open saved pages (다온 cloud → login dead end, tank-winter results, building, battery).
 * New searches = fixed results (normalised partial match, longest key wins); anything else →
 * `'{q}'에 대한 검색 결과가 없습니다.` Articles A (ep1 original) / B. No URL bar, no tabs, no QR.
 *
 * Public API : G.browser = { open(), openPage(id), search(q), history() }
 * Bus        : none (ARCH §4.21 lists no browser events)
 * data-qa    : browser.search · browser.menu · browser.history · browser.row:<i> · browser.recent:<i>
 *              (+ browser.result:<i> · browser.login)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[browser] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, I = MU.ICON;
  const BD = () => (G.STORY && G.STORY.browser) || { start: {}, history: [], pages: {}, search: [], noResult: [] };
  const BR = (G.browser = G.browser || {});

  /* ---------------- player's searches today (session store only — never the save) ---------------- */
  const SKEY = 'md:browserSearches';
  function mySearches() { try { const v = JSON.parse(MU.sessGet(SKEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function addSearch(q) { const l = mySearches(); l.unshift({ q, t: MU.now().getTime() }); MU.sessSet(SKEY, JSON.stringify(l.slice(0, 30))); }

  /* ---------------- app ---------------- */
  MU.app('browser', {
    name: '인터넷',
    icon: (G.ICONS && G.ICONS.browser) || { bg: 'linear-gradient(160deg,#5ab0ff,#2563eb)', svg: I.globe },
    badge: () => 0,
    open(p) {
      p = p || {};
      start();
      if (p.page) BR.openPage(p.page);
      else if (p.view === 'history') history();
    },
  });
  BR.open = () => { if (G.phone && G.phone.openApp) G.phone.openApp('browser', {}); };

  function moreBtn(getScr) { return MU.iconBtn(I.more, '더보기', 'browser.menu', () => { const s = getScr(); MU.menu(s, [{ label: (BD().menu || [])[0], qa: 'browser.history', onClick: history }]); }); }
  function searchPill(prefill) {
    const b = el('button.md2-br-pill', { type: 'button' }, el('span.md2-br-pic', { html: I.search }), el('span', null, prefill ? prefill : T(BD().start.placeholder)));
    b.classList.toggle('ph', !prefill);
    MU.qa(b, 'browser.search');
    b.addEventListener('click', () => { MU.sfx('tap'); searchScreen(prefill || ''); });
    return b;
  }
  function rowNode(h, qa, onClick) {
    const r = el('button.md2-br-row', { type: 'button' }, el('span.md2-br-fav', { html: I.globe }), el('span.md2-br-rt', null, T(h.title)), h.when ? el('span.md2-br-when', null, T(h.when)) : null);
    MU.qa(r, qa);
    r.addEventListener('click', () => { MU.sfx('tap'); onClick(); });
    return r;
  }
  const openRow = (h) => () => { if (h.q != null) results(h.q, true); else if (h.page) BR.openPage(h.page); };

  function start() {
    const S = BD().start || {};
    let scr = null;
    const recent = el('div.md2-br-recent', null, (BD().history || []).slice(0, S.recentN || 3).map((h, i) => rowNode(h, 'browser.recent:' + i, openRow(h))));
    const body = el('div.md2-br-start', null,
      el('div.md2-br-logo', null, T(S.logo || '')),
      searchPill(''),
      el('div.md2-br-sec', null, T(S.recentTitle || '')),
      recent,
      el('div.md2-br-tabs', null, T(S.tabs || '')));
    scr = MU.screen({ title: '', cls: 'md2-br', body, right: [moreBtn(() => scr)] });
    MU.push(scr);
  }

  function searchScreen(prefill) {
    let scr = null;
    const submit = (v) => { const q = String(v || '').trim(); if (!q) return; try { G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} addSearch(q); results(q, false, scr); };
    let f = null, node;
    if (G.ui && G.ui.field) {
      f = G.ui.field({ placeholder: T(BD().start.placeholder), mode: 'ko', predict: true, ctx: 'browserSearch', qa: 'browser.field', onSubmit: submit });
      if (prefill) f.set(prefill);
      node = f.node;
    } else node = el('div.md2-br-fph', null, T(BD().start.placeholder));
    node.classList.add('md2-br-field');
    const go = MU.iconBtn(I.search, '검색', 'browser.go', () => submit(f ? f.value : ''));
    const body = el('div.md2-br-sbody', null, el('div.md2-br-sbar', null, node, go));
    scr = MU.screen({ title: '', cls: 'md2-br', body });
    MU.push(scr, { onClose: () => { try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} } });
    if (f) setTimeout(() => { if (scr.isConnected) f.focus(); }, 260);
  }

  /* ---------------- fixed results ---------------- */
  function match(q) {
    const nq = MU.norm(q);
    if (!nq) return null;
    if ((BD().noResult || []).some((k) => MU.norm(T(k)) === nq)) return null;
    let best = null;
    (BD().search || []).forEach((row) => {
      row.keys.forEach((k) => {
        const kt = T(k), nk = MU.norm(kt);
        if (!nk) return;
        let score = 0;
        if (nq.includes(nk)) score = 1000 + nk.length;            // the query contains the key
        else if (nq.length >= 2 && nk.includes(nq)) score = nq.length;   // the key contains the query
        if (score && (!best || score > best.score)) best = { row, key: kt, score };
      });
    });
    return best;
  }
  BR.search = function (q) { results(q, false); };
  function results(q, fromHistory, replaceScr) {
    const hit = match(q);
    const body = el('div.md2-br-res');
    if (!hit) {
      const parts = MU.STR('noResult').split('{q}');
      body.appendChild(el('div.md2-empty', null, el('span.md2-empty-ic', { html: I.search }), el('b', null, parts.map((p) => T(p)).join(q))));
    } else {
      hit.row.results.forEach((r, i) => {
        const o = typeof r === 'string' ? { title: r } : r;
        let title = T(o.title);
        if (hit.row.org) title = title.split('{org}').join(hit.key);
        const tappable = !!(o.page || o.action);
        const row = el(tappable ? 'button.md2-br-hit' : 'div.md2-br-hit', tappable ? { type: 'button' } : null, el('span.md2-br-hfav', { html: I.globe }), el('span', null, title));
        MU.qa(row, 'browser.result:' + i);
        if (tappable) row.addEventListener('click', () => { MU.sfx('tap'); if (o.action === 'emergency') { if (G.phoneApp && G.phoneApp.call) G.phoneApp.call('1366', { emergency: true }); else MU.toast(MU.STR('noSimEmergency')); } else BR.openPage(o.page); });
        body.appendChild(row);
      });
    }
    let scr = null;
    const top = el('div.md2-br-qbar', null, searchPill(q));
    scr = MU.screen({ title: '', cls: 'md2-br', body: el('div', null, top, body), right: [moreBtn(() => scr)] });
    if (replaceScr && G.phone && G.phone.top && G.phone.top() && G.phone.top().node === replaceScr && G.phone.pop) G.phone.pop(true);
    MU.push(scr);
  }

  /* ---------------- 기록 ---------------- */
  function history() {
    const body = el('div.md2-br-hist');
    let i = 0, last = null;
    const mine = mySearches();
    if (mine.length) {
      body.appendChild(el('div.md2-br-day', null, T(BD().today || '')));
      mine.forEach((s) => { body.appendChild(rowNode({ title: s.q, when: MU.fmtK(new Date(s.t)) }, 'browser.row:' + i++, openRow({ q: s.q }))); });
    }
    (BD().history || []).forEach((h) => {
      const d = MU.parseT(h.d);
      const lab = d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '';
      if (lab !== last) { body.appendChild(el('div.md2-br-day', null, lab)); last = lab; }
      body.appendChild(rowNode(h, 'browser.row:' + i++, openRow(h)));
    });
    MU.push(MU.screen({ title: T(BD().historyTitle || ''), cls: 'md2-br', body }));
  }
  BR.history = history;

  /* ---------------- saved pages ---------------- */
  BR.openPage = function (id) {
    const pg = (BD().pages || {})[id];
    if (!pg) return null;
    let body;
    if (id === 'daonLogin' || pg.fields) body = loginPage(pg);
    else if (pg.kind === 'article') body = el('article.md2-art', null,
      pg.source ? el('div.md2-art-src', null, T(pg.source)) : null,
      el('h2.md2-art-h', null, T(pg.title)),
      pg.meta ? el('div.md2-art-meta', null, T(pg.meta)) : null,
      (pg.body || []).map((p) => el('p', null, T(p))));
    else if (pg.results) body = el('div.md2-br-res', null, el('div.md2-br-ph', null, T(pg.title)),
      pg.results.map((r) => el('div.md2-br-hit', null, el('span.md2-br-hfav', { html: I.globe }), el('span', null, T(r)))));
    else body = el('div.md2-br-pagebody', null, el('h2.md2-art-h', null, T(pg.title)), (pg.body || []).map((p) => el('p', null, T(p))));
    const scr = MU.screen({ title: '', cls: 'md2-br md2-br-page', body });
    MU.push(scr);
    return scr;
  };
  function loginPage(pg) {
    const fields = [];
    const mk = (ph, i) => {
      if (!(G.ui && G.ui.field)) return el('div.md2-br-fph', null, T(ph));
      const f = G.ui.field({ placeholder: T(ph), mode: 'en', password: i === 1, predict: i !== 1, ctx: i === 1 ? 'daonPw' : 'daonId' });
      fields.push(f); f.node.classList.add('md2-br-lf'); return f.node;
    };
    const after = el('div.md2-br-after');
    const btn = el('button.md2-br-login', { type: 'button' }, T(pg.button));
    MU.qa(btn, 'browser.login');
    btn.addEventListener('click', () => {
      MU.sfx('tap');
      try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {}
      after.innerHTML = '';
      (pg.after || []).forEach((l) => after.appendChild(el('p', null, T(l))));
      if (pg.grey) after.appendChild(el('small', null, T(pg.grey)));
      after.classList.add('on');
    });
    return el('div.md2-br-loginbox', null, el('div.md2-br-cloud', { html: I.cloudOff }), el('b.md2-br-lt', null, T(pg.title)),
      (pg.fields || []).map(mk), btn, after);
  }
})();
