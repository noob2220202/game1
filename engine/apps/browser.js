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
 *
 * ---- ep3 (G.STORY.browser.v === 3 · G.STORY.browserApps — both absent in ep2 · ARCH_EP3 §3.3 · §4.2) ----
 * DESIGN_EP3 §4.8.4 · §5.0-1 · §5.2 · §0.3 D16 · §12.5-2 (R16): folder 인터넷 = the same start / search / results /
 * pages as ep2 (data-driven) with `최근 방문` 0 · `열린 탭 0` · ⋮ › `기록` → `방문 기록이 없습니다` (+ tonight's own
 * searches under `오늘`, session store only) · predict bar off · device how-to queries → {$noResult}.
 * appMode pages — one app per G.STORY.browserApps entry, registered here at load (ARCH_EP3 §5.2 · G73):
 *   moim    = static church feed (`3구역 기도 모임 · 멤버 14` · posts · post detail with ♡ / 댓글 · no compose)
 *   files   = `내 파일` / `최근 파일 없음` / five category rows (no counts, rows do not react)
 *   weather = {daejeon} · `맑음 −6°` · five hours · `일출  오전 7:36` (no location permission, no current location)
 * Public API (ep3 additions): G.browser.open({ appMode:'moim'|'files'|'weather'|undefined, page })
 * data-scr   : browser.start browser.search browser.results browser.history browser.page · moim.feed moim.post.<id>
 *              files weather      data-qa: moim.post:<id> · files.row:<i> (+ the ep2 browser values above)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[browser] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, I = MU.ICON;
  const BD = () => (G.STORY && G.STORY.browser) || { start: {}, history: [], pages: {}, search: [], noResult: [] };
  const BR = (G.browser = G.browser || {});
  const isV3 = () => BD().v === 3;   // ep3 data marker (ARCH_EP3 §4.1-3)
  /** ep3 only: data-scr on a pushed screen (the show table · QA) — ep2 DOM stays untouched */
  function tag3(scr, id) { if (isV3() && scr) scr.dataset.scr = id; return scr; }

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
      if (p.appMode && isApp3(p.appMode)) { appPage3(p.appMode, p); return; }
      start();
      if (p.page) BR.openPage(p.page);
      else if (p.view === 'history') history();
    },
  });
  BR.open = function (o) {
    o = o || {};
    if (o.appMode && isApp3(o.appMode)) {   // ep3 appMode pages (moim · files · weather)
      if (G.phone && G.phone.openApp && G.apps && G.apps[o.appMode]) G.phone.openApp(o.appMode, o); else appPage3(o.appMode, o);
      return;
    }
    if (G.phone && G.phone.openApp) G.phone.openApp('browser', o.page ? { page: o.page } : {});
  };

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
    tag3(scr, 'browser.start');
    MU.push(scr);
  }

  function searchScreen(prefill) {
    let scr = null;
    const submit = (v) => { const q = String(v || '').trim(); if (!q) return; try { G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} addSearch(q); results(q, false, scr); };
    let f = null, node;
    if (G.ui && G.ui.field) {
      f = G.ui.field({ placeholder: T(BD().start.placeholder), mode: 'ko', predict: !isV3(), ctx: 'browserSearch', qa: 'browser.field', onSubmit: submit });
      if (prefill) f.set(prefill);
      node = f.node;
    } else node = el('div.md2-br-fph', null, T(BD().start.placeholder));
    node.classList.add('md2-br-field');
    const go = MU.iconBtn(I.search, '검색', 'browser.go', () => submit(f ? f.value : ''));
    const body = el('div.md2-br-sbody', null, el('div.md2-br-sbar', null, node, go));
    scr = MU.screen({ title: '', cls: 'md2-br', body });
    tag3(scr, 'browser.search');
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
    tag3(scr, 'browser.results');
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
    if (!body.firstChild && BD().historyEmpty) body.appendChild(el('div.md2-empty.tall', null, el('span.md2-empty-ic', { html: I.globe }), el('b', null, T(BD().historyEmpty))));   // ep3 · no record
    MU.push(tag3(MU.screen({ title: T(BD().historyTitle || ''), cls: 'md2-br', body }), 'browser.history'));
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
    tag3(scr, 'browser.page');
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

  /* =========================================================================================================
   * ep3 appMode pages (G.STORY.browserApps — absent in ep2 ⇒ nothing below registers or runs on the ep2 page)
   * ========================================================================================================= */
  const APPS3 = () => (G.STORY && G.STORY.browserApps) || {};
  function isApp3(id) { return !!APPS3()[id]; }
  const IC3 = {
    moim: { bg: 'linear-gradient(160deg,#ffb36b,#f0763a)', svg: '<svg viewBox="0 0 24 24"><circle cx="8.5" cy="9" r="3" fill="#fff"/><circle cx="15.5" cy="9" r="3" fill="#fff" opacity=".85"/><path d="M3.5 19c0-3 2.3-5 5-5s5 2 5 5zM10.5 19c0-3 2.3-5 5-5s5 2 5 5z" fill="#fff"/></svg>' },
    folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7a2 2 0 012-2h4.2l2 2h6.8a2 2 0 012 2v8.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  };
  /** 'A  B' (two spaces — a label / value line in DESIGN) → [A, B] */
  const kv3 = (s) => { const m = String(s || '').split(/\s{2,}/); return m.length > 1 ? [m[0], m.slice(1).join(' ')] : [m[0]]; };
  function push3(scr, scrId, appId) {
    scr.dataset.scr = scrId;
    MU.noMenu(scr);
    const e = MU.push(scr, { appId });
    if (e && typeof e === 'object') { try { e.scr = scrId; } catch (er) {} }
    return e;
  }
  function appPage3(id, p) {
    const A = APPS3()[id] || {};
    const mode = A.appMode || id;
    if (mode === 'moim') moimFeed3(id);
    else if (mode === 'files') files3(id, A.page || {});
    else if (mode === 'weather') weather3(id, A.page || {});
  }
  const MD3 = () => (G.STORY && G.STORY.moim) || { posts: [] };
  function postNode3(p, full) {
    const M = MD3();
    const parts = [el('div.md3-mp-by', null, `${T(p.by || '')} · ${T(p.when || '')}`)];
    if (p.title) parts.push(el('b.md3-mp-t', null, T(p.title)));
    if (p.text) parts.push(el('p.md3-mp-x', null, T(p.text)));
    if (p.img) { const im = MU.imgEl(p.img, 'md3-mp-img', (i) => { i.parentNode && i.parentNode.classList.add('miss'); }); parts.push(el('div.md3-mp-ph', null, im)); }
    if (p.likes != null) parts.push(el('div.md3-mp-meta', null, `${T(M.like || '')} ${p.likes} · ${T(M.comment || '')} ${(p.comments || []).length}`));
    return el(full ? 'div.md3-mp.full' : 'button.md3-mp', full ? null : { type: 'button' }, parts);
  }
  function moimFeed3(appId) {
    const M = MD3();
    const list = el('div.md3-moim', null, el('div.md3-moim-g', null, T(M.group || '')));
    (M.posts || []).forEach((p) => {
      const card = postNode3(p, false);
      MU.qa(card, 'moim.post:' + p.id);
      card.addEventListener('click', () => { MU.sfx('tap'); moimPost3(p, appId); });
      list.appendChild(card);
    });
    push3(MU.screen({ title: T(M.title || ''), cls: 'md2-br md3-moimscr', body: list }), 'moim.feed', appId);
  }
  function moimPost3(p, appId) {
    const body = el('div.md3-moim.post', null, postNode3(p, true),
      (p.comments || []).length ? el('div.md3-mc', null, p.comments.map(([who, txt]) => el('div.md3-mc-r', null, el('b', null, T(who)), el('span', null, T(txt))))) : null);
    push3(MU.screen({ title: T(MD3().title || ''), cls: 'md2-br md3-moimscr', body }), 'moim.post.' + p.id, appId);
  }
  function files3(appId, P) {
    const rows = (P.rows || []).map((r, i) => { const n = el('div.md3-files-r', null, el('span.md3-files-ic', { html: IC3.folder }), el('span', null, T(r))); MU.qa(n, 'files.row:' + i); return n; });
    const body = el('div.md3-files', null, el('div.md3-files-empty', null, T(P.empty || '')), el('div.md3-files-rows', null, rows));
    push3(MU.screen({ title: T(P.head || ''), cls: 'md2-br md3-filesscr', body }), 'files', appId);
  }
  function weather3(appId, P) {
    const sun = kv3(T(P.sunrise || ''));
    const body = el('div.md3-wx', null,
      el('div.md3-wx-place', null, T(P.place || '')),
      el('div.md3-wx-now', null, T(P.now || '')),
      el('div.md3-wx-hours', null, (P.hours || []).map(([h, t]) => el('div.md3-wx-h', null, el('small', null, T(h)), el('b', null, T(t))))),
      el('div.md3-wx-sun', null, el('span', null, sun[0] || ''), sun[1] ? el('b', null, sun[1]) : null));
    push3(MU.screen({ title: '', theme: 'dark', cls: 'md2-br md3-wxscr', body }), 'weather', appId);
  }
  // registration at load (shell's G.app exists — core phone.js loads before every app file · ARCH_EP3 §2.1)
  Object.keys(APPS3()).forEach((id) => {
    const A = APPS3()[id];
    MU.app(id, {
      get name() { return T(A.name || ''); },
      get icon() { return (G.ICONS && G.ICONS[A.icon || id]) || IC3[id] || (G.ICONS && G.ICONS.browser) || { bg: '#888', svg: I.globe }; },
      badge: () => 0,
      open(p) { appPage3(id, p || {}); },
    });
  });
  BR.page3 = appPage3;
})();
