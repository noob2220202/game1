/* =========================================================
 * 메일 — inbox + reader (DESIGN §4.3; account seah.y@hanmail.net)
 * G.STORY.mails = [{id, from, addr, subj, body(string|fn|Node), t, show(), unread, read, preview, tag, star, onOpen}]
 * Live: G.mail.push({from, addr, subj, body(string), preview, ...}) → stored in vars.liveMails (serializable),
 *       banner + badge. G.mail.open(id) opens a mail directly.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad } = G.util;
  const M = (G.mail = {});
  const T = (s) => (G.T ? G.T(s) : s);
  const parseT = (t) => (G.chat && G.chat.parseT ? G.chat.parseT(t) : t ? new Date(t) : null);

  function all() {
    return (G.STORY.mails || []).filter((m) => !m.show || m.show()).concat(G.state.vars.liveMails || [])
      .sort((a, b) => +(parseT(b.t) || 0) - +(parseT(a.t) || 0));
  }
  function isUnread(m) { return !G.state.read['mail:' + m.id] && m.unread !== false && !m.read; }
  M.all = all;
  M.unread = () => all().filter(isUnread).length;
  M.push = function (m) {
    m = Object.assign({ id: 'live' + Date.now(), t: G.clock.now().getTime(), unread: true }, m);
    G.state.vars.liveMails = (G.state.vars.liveMails || []).concat([m]); G.save();
    G.phone.notify({ app: 'mail', title: T(m.from), body: T(m.subj), route: { app: 'mail', params: { mail: m.id } } });
    G.phone.refreshBadges && G.phone.refreshBadges();
    G.bus.emit('mail:new', m);
    if (M._render) M._render();
    return m;
  };
  M.open = function (id) { G.phone.openApp('mail', { mail: id }); };

  /* status-bar text colour for this module's screens ('dark' = dark text on a light background) */
  G.bus.on('screen:push', (e) => {
    const n = e && e.node; if (!n || !n.classList) return;
    let st = null;
    if ([].some((c) => n.classList.contains(c))) st = 'light';
    else if (['ml-screen'].some((c) => n.classList.contains(c))) st = 'dark';
    if (!st) return;
    n.dataset.status = st;
    if (G.phone.top && G.phone.top() === e) G.phone.statusTheme(st);
  });

  const COLORS = ['#5b8def', '#ef8a5b', '#3fb68b', '#a06cd5', '#e0607e', '#d4a72c', '#4aa3c7'];
  function avatar(m, big) {
    const name = T(m.from || '?');
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const bg = m.otp || /해솔홈/.test(name) ? '#0f1b26' : COLORS[h % COLORS.length];
    return el('span.ml-av' + (big ? '.big' : ''), { style: { background: bg } }, name.replace(/^\[.*?\]\s*/, '').slice(0, 1));
  }
  function when(m) {
    const d = parseT(m.t); if (!d) return '';
    const now = G.clock.now();
    if (d.toDateString() === now.toDateString()) return G.util.fmtKTime(d);
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }
  function previewOf(m) {
    if (m.preview) return T(m.preview);
    const b = typeof m.body === 'string' ? m.body : '';
    return T(b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 60);
  }

  G.app('mail', {
    name: '메일',
    icon: G.ICONS.mail,
    badge: () => M.unread(),
    open(p) {
      const wrap = el('div.ml-list');
      const search = el('button.ml-search', { html: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>메일 검색</span>' });
      search.addEventListener('click', () => G.phone.toast('검색하려면 네트워크 연결이 필요합니다'));
      const scr = G.ui.screen({ title: '받은편지함', sub: G.STORY.mailAccount || '', cls: 'ml-screen', body: el('div', null, search, wrap) });
      function render() {
        wrap.innerHTML = '';
        const list = all();
        const n = list.filter(isUnread).length;
        wrap.appendChild(el('div.ml-count', null, n ? `읽지 않은 메일 ${n}개` : '모든 메일을 읽었습니다'));
        list.forEach((m) => {
          const un = isUnread(m);
          const row = el('button.ml-row' + (un ? '.unread' : '') + (m.otp ? '.otp' : ''), null,
            avatar(m),
            el('div.ml-main', null,
              el('div.ml-top', null, el('b', null, T(m.from)), m.tag ? el('em', null, m.tag) : null, el('small', null, when(m))),
              el('div.ml-subj', null, T(m.subj)),
              el('div.ml-prev', null, previewOf(m))),
            m.star ? el('i.ml-star', { html: '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="#f5b400"/></svg>' }) : null);
          row.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); view(m); });
          wrap.appendChild(row);
        });
      }
      M._render = render;
      render();
      G.phone.push(scr, { onResume: render, onClose: () => { M._render = null; } });
      if (p && p.mail) { const m = all().find((x) => x.id === p.mail); if (m) view(m); }
    },
  });

  function view(m) {
    const d = parseT(m.t);
    const b = typeof m.body === 'function' ? m.body() : m.body;
    const body = el('div.mail-view.ml-view', null,
      el('div.mv-subj', null, T(m.subj)),
      m.tag ? el('span.ml-tag', null, m.tag) : null,
      el('div.ml-from', null, avatar(m, true),
        el('div', null,
          el('div.ml-fn', null, el('b', null, T(m.from)), el('small', null, m.addr ? `<${m.addr}>` : '')),
          el('div.ml-to', null, `받는 사람: ${G.STORY.mailAccount || '나'}`),
          el('div.ml-date', null, d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${G.util.fmtKTime(d)}` : ''))),
      b instanceof Node ? b : el('div.mv-body.ml-body', { html: T(b || '') }));
    const right = [el('button', { 'aria-label': '답장', html: '<svg viewBox="0 0 24 24"><path d="M10 6L4 12l6 6M4.5 12H15a5 5 0 015 5v1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>', onclick: () => G.phone.toast(G.flag('netFree') ? '보낼 수 없습니다 · 계정 인증이 필요합니다' : '전송 실패 · 관리자 네트워크에서 발신이 제한되었습니다') })];
    G.phone.push(G.ui.screen({ title: '', body, right, cls: 'ml-screen' }));
    G.state.read['mail:' + m.id] = true; G.save(); G.phone.refreshBadges && G.phone.refreshBadges();
    G.bus.emit('mail:open', m.id);
    m.onOpen && m.onOpen();
  }
})();
