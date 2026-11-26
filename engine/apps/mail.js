/* =========================================================
 * engine/apps/mail.js — 메일 (saved inbox · read-only) · owner: social
 * DESIGN §4.3 · §3.21 메일 · §3.20.1 cb.manager · §5.1 메일 row · §9.6 names (police via {police})
 * ARCH §3.3 · §4.19 (G.mail = { open(id), folder(name) }) · §6.3 (mail.item:<id> · mail.folder:<name>)
 *
 * Data: G.STORY.mailAccount { head, account, banner, folders:[[id,label]], attach, fromLabel, toLabel, to }
 *       G.STORY.mails [{ id, folder:'inbox'|'trash', from, fromFull, subj, date, sent, body:(cb)=>string[], footer, deletedNote, redact }]
 * Behaviour: no compose / reply / forward; every bracketed '[…]' segment is a link button → toast G.e2.STR.mailNoOpen.
 * All mails are read (no badge). Flags set: none. Storage: none.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const C = G.chat || {};
  const el = C.el || (G.util && G.util.el);
  const T = (s) => (C.T ? C.T(s) : s);
  const STR = (k) => (C.str ? C.str(k) : '');
  const tap = () => C.tap && C.tap();
  const M = (G.mail = G.mail || {});
  const ACC = () => (G.STORY && G.STORY.mailAccount) || {};
  const ALL = () => (G.STORY && G.STORY.mails) || [];
  const cb = (k) => { try { return G.e2 && G.e2.cb ? G.e2.cb(k) : false; } catch (e) { return false; } };
  let folder = 'inbox';
  let render = null;

  const COLORS = ['#5b7fd6', '#6b9e8a', '#a07fc2', '#c98a5b', '#5aa0b8'];
  function avatar(name, big) {
    const n = T(name || '?').replace(/^\[.*?\]\s*/, '');
    let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return el('span.so2-ml-av' + (big ? '.big' : ''), { style: { background: COLORS[h % COLORS.length] }, 'aria-hidden': 'true' }, Array.from(n)[0] || '?');
  }
  /** text with '[…]' link segments → buttons (no network, no account) */
  function richLine(line, cls) {
    const node = el('div.' + (cls || 'so2-ml-line'));
    const parts = String(T(line)).split(/(\[[^\]]+\])/);
    parts.forEach((p) => {
      if (!p) return;
      if (/^\[[^\]]+\]$/.test(p)) {
        node.appendChild(el('button.so2-ml-link', { onclick: (e) => { e.stopPropagation(); tap(); G.phone && G.phone.toast && G.phone.toast(T(ACC().attach || '{$mailNoOpen}')); } }, p));
      } else node.appendChild(document.createTextNode(p));
    });
    if (!String(line).trim()) node.classList.add('gap');
    if (/^s*·/.test(String(line))) node.classList.add('bul');
    return node;
  }

  function listScreen() {
    const acc = ACC();
    const holder = el('div.so2-ml-list');
    const folders = el('div.so2-ml-folders');
    const scr = (C.screen || G.ui.screen)({ title: T(acc.head || '받은편지함'), sub: T(acc.account || ''), body: el('div', null, el('div.so2-band.grey', null, T(acc.banner || '{$mailSync}')), folders, holder), cls: 'so2-ml' });
    function draw() {
      folders.innerHTML = '';
      (acc.folders || [['inbox', '받은편지함'], ['trash', '휴지통 1']]).forEach(([id, label]) => {
        folders.appendChild(el('button.so2-ml-folder' + (folder === id ? '.on' : ''), { 'data-qa': 'mail.folder:' + id, onclick: () => { if (folder === id) return; tap(); folder = id; draw(); } }, T(label)));
      });
      const tt = scr.querySelector('.sv-title');
      const fl = (acc.folders || []).find((x) => x[0] === folder);
      if (tt) tt.textContent = folder === 'trash' ? T(fl ? fl[1] : '휴지통 1').replace(/\s*\d+$/, '') : T(acc.head || '받은편지함');
      holder.innerHTML = '';
      ALL().filter((m) => (m.folder || 'inbox') === folder).forEach((m) => {
        holder.appendChild(el('button.so2-ml-row', { 'data-qa': 'mail.item:' + m.id, onclick: () => { tap(); view(m); } },
          avatar(m.from),
          el('span.so2-ml-main', null,
            el('span.so2-ml-top', null, el('b', null, T(m.from)), el('small', null, T(m.date || ''))),
            el('span.so2-ml-subj', null, T(m.subj)),
            m.deletedNote ? el('span.so2-ml-del', null, T(m.deletedNote)) : el('span.so2-ml-prev', null, previewOf(m)))));
      });
    }
    render = draw;
    draw();
    (C.pushScreen || ((s, o) => G.phone.push(s, o)))(scr, { appId: 'mail', onClose: () => { if (render === draw) render = null; } });
    return scr;
  }
  function bodyOf(m) { try { return (typeof m.body === 'function' ? m.body(cb) : m.body || []).filter((x) => x != null); } catch (e) { console.error('[social] mail body', e); return []; } }
  function previewOf(m) {
    const b = bodyOf(m);
    const line = b.find((x) => String(x).trim()) || '';
    return T(String(line).replace(/^\s*·\s*/, ''));
  }
  function view(m) {
    const acc = ACC();
    const lines = bodyOf(m);
    const body = el('div.so2-ml-view' + (m.redact ? '.redact' : ''),
      el('div.so2-ml-vsubj', null, T(m.subj)),
      m.deletedNote ? el('div.so2-ml-del', null, T(m.deletedNote)) : null,
      el('div.so2-ml-from', null, avatar(m.from, true),
        el('div.so2-ml-fromt', null,
          el('div', null, el('span.so2-ml-k', null, T(acc.fromLabel || '보낸 사람')), el('b', null, T(m.fromFull || m.from))),
          el('div', null, el('span.so2-ml-k', null, T(acc.toLabel || '받는 사람')), el('span', null, T(acc.to || '{N}'))),
          el('div.so2-ml-date', null, T(m.sent || '')))),
      el('div.so2-ml-body', null, lines.map((l) => richLine(l))),
      m.footer ? el('div.so2-ml-foot', null, m.footer.map((l) => richLine(l, 'so2-ml-fline'))) : null);
    const scr = (C.screen || G.ui.screen)({ title: '', body, cls: 'so2-ml so2-ml-reader' });
    scr.dataset.qa = 'mail.view:' + m.id;
    (C.pushScreen || ((s, o) => G.phone.push(s, o)))(scr, { anim: 'slide', appId: 'mail' });
    if (G.bus) G.bus.emit('mail:open', m.id);
  }

  M.open = function (id) {
    const m = ALL().find((x) => x.id === id);
    if (G.phone && G.phone.openApp && G.apps && G.apps.mail) return G.phone.openApp('mail', { id });
    if (m) { folder = m.folder || 'inbox'; listScreen(); view(m); }
  };
  M.folder = function (name) { folder = name === 'trash' ? 'trash' : 'inbox'; if (render) render(); else if (G.phone && G.phone.openApp) G.phone.openApp('mail', { folder }); };
  M.unread = () => 0;

  if (G.app) {
    G.app('mail', {
      name: '메일',
      icon: G.ICONS && G.ICONS.mail,
      badge: () => 0,   // every saved mail is already read (§4.3)
      open(p) {
        p = p || {};
        const m = p.id ? ALL().find((x) => x.id === p.id) : null;
        folder = p.folder === 'trash' || (m && m.folder === 'trash') ? 'trash' : 'inbox';
        listScreen();
        if (m) view(m);
      },
    });
  }
})();
