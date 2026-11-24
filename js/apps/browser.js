/* =========================================================
 * 인터넷 (browser): start page, history, bookmarks, pages, search.
 * G.STORY.pages = { id: {title, url, t?, render():Node, onOpen} }
 * G.STORY.history = [{page|url, title, t, show()}]
 * G.STORY.bookmarks = [pageId]
 * G.STORY.search(q) -> pageId | Node | null
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el } = G.util;
  const BR = (G.browser = {});

  function page(id) { return (G.STORY.pages || {})[id]; }

  G.app('browser', {
    name: '인터넷',
    icon: G.ICONS.browser,
    open(p) {
      if (p && p.page) { BR.openPage(p.page); return; }
      const body = el('div');
      const searchField = G.ui.field({ placeholder: '검색어 또는 주소 입력', submitLabel: '검색', onSubmit: (v) => { G.ui.hideKeyboard(); doSearch(v); } });
      const scr = G.ui.screen({ title: '인터넷', body });
      body.append(el('div.br-search', null, searchField.node));
      const bms = (G.STORY.bookmarks || []).map(page).filter(Boolean);
      if (bms.length) {
        body.append(el('div.section-title', null, '북마크'));
        body.append(G.ui.list(bms.map((pg) => ({ title: G.T(pg.title), sub: pg.url, onClick: () => BR.openPage(pg.id) }))));
      }
      body.append(el('div.section-title', null, '방문 기록'));
      body.append(history());
      G.phone.push(scr);
    },
  });

  function history() {
    const list = (G.STORY.history || []).filter((h) => !h.show || h.show()).slice().sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t));
    const wrap = el('div.br-hist');
    let lastDay = null;
    list.forEach((h) => {
      const d = G.chat.parseT(h.t);
      const dk = d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : '';
      if (dk !== lastDay) { wrap.appendChild(el('div.br-hist-day', null, dk)); lastDay = dk; }
      const pg = h.page ? page(h.page) : null;
      wrap.appendChild(G.ui.list([{ title: G.T(h.title || (pg && pg.title) || h.url), sub: (h.q ? '🔍 ' : '') + (h.url || (pg && pg.url) || '') + (d ? ' · ' + G.util.fmtKTime(d) : ''), cls: h.cls, onClick: () => { if (pg) BR.openPage(pg.id); else if (h.q) doSearch(h.q); else G.phone.toast('페이지를 불러올 수 없습니다 (오프라인)'); } }]));
    });
    if (!list.length) wrap.appendChild(el('div.empty-state', null, '기록이 없습니다'));
    return wrap;
  }

  function doSearch(q) {
    G.bus.emit('browser:search', q);
    const r = G.STORY.search ? G.STORY.search(q) : null;
    if (typeof r === 'string') return BR.openPage(r);
    if (r instanceof Node) return G.phone.push(G.ui.screen({ title: q, body: r }));
    G.phone.push(G.ui.screen({ title: q, body: el('div.empty-state', null, `'${q}'에 대한 결과를 불러올 수 없습니다.\n인터넷 연결을 확인하세요.`) }));
  }
  BR.search = doSearch;

  BR.openPage = function (id) {
    const pg = page(id);
    if (!pg) return;
    const body = el('div', null, el('div.br-bar', null, el('div.br-url', null, '🔒 ' + pg.url)), el('div.br-page', null, pg.render()));
    const scr = G.ui.screen({ title: G.T(pg.title), body });
    G.phone.push(scr);
    G.state.seen['page:' + id] = true; G.save();
    G.bus.emit('browser:page', id);
    pg.onOpen && pg.onOpen(scr);
  };
  /* helpers for writing pages */
  BR.article = function (o) {
    return el('div', null,
      o.source ? el('div', { style: { padding: '12px 18px 0', fontSize: '12px', color: '#2563eb', fontWeight: '700' } }, o.source) : null,
      el('div.art-h', null, G.T(o.title)),
      el('div.art-meta', null, G.T(o.meta || '')),
      (o.blocks || []).map((b) => typeof b === 'string' ? el('div.art-p', { html: G.T(b) }) : b.img ? [el('img.art-img', { src: b.img, alt: '' }), b.cap ? el('div.art-cap', null, G.T(b.cap)) : null] : b),
      (o.comments || []).length ? el('div', { style: { padding: '16px 18px 6px', fontWeight: '700', fontSize: '14px' } }, `댓글 ${o.comments.length}`) : null,
      (o.comments || []).map((c) => el('div.comment', null, el('b', { style: c.creepy ? { color: '#b91c1c' } : null }, G.T(c.name)), el('small', null, c.t || ''), el('div', null, G.T(c.text)))));
  };
})();
