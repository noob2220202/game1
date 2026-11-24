/* =========================================================
 * 메일: inbox (+ live mails like OTP), message view.
 * G.STORY.mails = [{id, from, addr, subj, body(string|fn|Node), t, show(), unread, onOpen}]
 * Live: G.mail.push({from, subj, body, ...})
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el } = G.util;
  const M = (G.mail = {});
  function all() { return (G.STORY.mails || []).filter((m) => !m.show || m.show()).concat(G.state.vars.liveMails || []).sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t)); }
  function isUnread(m) { return !G.state.read['mail:' + m.id] && m.unread !== false; }
  M.push = function (m) {
    m = Object.assign({ id: 'live' + Date.now(), t: G.clock.now().getTime(), unread: true }, m);
    G.state.vars.liveMails = (G.state.vars.liveMails || []).concat([m]); G.save();
    G.phone.notify({ app: 'mail', title: m.from, body: m.subj, route: { app: 'mail', params: { mail: m.id } } });
    G.phone.refreshBadges();
    G.bus.emit('mail:new', m);
    if (M._render) M._render();
    return m;
  };
  G.app('mail', {
    name: '메일',
    icon: G.ICONS.mail,
    badge: () => all().filter(isUnread).length,
    open(p) {
      const wrap = el('div');
      const scr = G.ui.screen({ title: '받은편지함', sub: G.STORY.mailAccount || '', body: wrap });
      function render() {
        wrap.innerHTML = '';
        const list = all();
        wrap.appendChild(G.ui.list(list.map((m) => {
          const d = G.chat.parseT(m.t); const now = G.clock.now();
          return { cls: 'mail-row' + (isUnread(m) ? '.unread' : ''), title: G.T(m.from), sub: G.T(m.subj), meta: d ? (d.toDateString() === now.toDateString() ? G.util.fmtKTime(d) : `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`) : '', onClick: () => view(m) };
        })));
      }
      M._render = render;
      render();
      G.phone.push(scr, { onResume: render, onClose: () => { M._render = null; } });
      if (p && p.mail) { const m = all().find((x) => x.id === p.mail); if (m) view(m); }
    },
  });
  function view(m) {
    const d = G.chat.parseT(m.t);
    const b = typeof m.body === 'function' ? m.body() : m.body;
    const body = el('div.mail-view', null,
      el('div.mv-subj', null, G.T(m.subj)),
      el('div.mv-from', { html: `<b>${G.util.esc(G.T(m.from))}</b> &lt;${G.util.esc(m.addr || '')}&gt;<br>받는 사람: ${G.util.esc(G.STORY.mailAccount || '나')}<br>${d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${G.util.fmtKTime(d)}` : ''}` }),
      b instanceof Node ? b : el('div.mv-body', { html: G.T(b || '') }));
    G.phone.push(G.ui.screen({ title: '', body }));
    G.state.read['mail:' + m.id] = true; G.save(); G.phone.refreshBadges();
    G.bus.emit('mail:open', m.id);
    m.onOpen && m.onOpen();
  }
})();
