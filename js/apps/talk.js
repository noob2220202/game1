/* =========================================================
 * Chat engine (shared by 톡 and 문자) + 톡 app.
 * Data: G.STORY.talk = [{id, name, avatar, members, pinned, show(), messages:[msg]}]
 * msg: {from:'me'|'them'|<name>, text, img, t:'YYYY-MM-DD HH:MM', sys, deleted, voice:{dur, onPlay}, read:false, creepy}
 * Live messages: G.chat.push('talk', threadId, msg, {notify:true, typingMs})
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;

  const C = (G.chat = {});
  const openViews = {}; // key -> {append(msg)}

  function parseT(t) { if (!t) return null; if (t instanceof Date) return t; if (typeof t === 'number') return new Date(t); const m = String(t).match(/(\d+)-(\d+)-(\d+)[ T](\d+):(\d+)/); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) : null; }
  C.parseT = parseT;
  C.threads = function (kind) { return (G.STORY[kind] || []).filter((t) => !t.show || t.show()); };
  C.thread = function (kind, id) { return (G.STORY[kind] || []).find((t) => t.id === id); };
  C.messages = function (kind, id) {
    const th = C.thread(kind, id);
    const base = th ? (typeof th.messages === 'function' ? th.messages() : th.messages) : [];
    const live = G.state.threads[kind + ':' + id] || [];
    return base.filter((m) => !m.show || m.show()).concat(live);
  };
  C.unread = function (kind, id) {
    const all = C.messages(kind, id);
    const readUpTo = G.state.read[kind + ':' + id];
    const th = C.thread(kind, id);
    if (readUpTo == null) return th && th.unread != null ? th.unread + (G.state.threads[kind + ':' + id] || []).length : 0;
    return Math.max(0, all.length - readUpTo);
  };
  C.totalUnread = function (kind) { return C.threads(kind).reduce((a, t) => a + C.unread(kind, t.id), 0); };
  C.markRead = function (kind, id) { G.state.read[kind + ':' + id] = C.messages(kind, id).length; G.save(); G.phone.refreshBadges(); };

  /** push a live message. opts: {notify, typingMs, silent} */
  C.push = async function (kind, id, msg, opts) {
    opts = opts || {};
    const key = kind + ':' + id;
    const view = openViews[key];
    if (opts.typingMs && view) { view.typing(true); await sleep(opts.typingMs); view.typing(false); }
    msg = Object.assign({ t: G.clock.now().getTime() }, msg);
    (G.state.threads[key] = G.state.threads[key] || []).push(msg);
    G.save();
    if (view) { view.append(msg); C.markRead(kind, id); G.audio && G.audio.sfx.msgIn(); }
    else if (opts.notify !== false) {
      const th = C.thread(kind, id);
      G.phone.notify({ app: kind, title: (th && th.name) || '알 수 없음', body: msg.deleted ? '삭제된 메시지입니다.' : msg.img ? '사진을 보냈습니다.' : msg.text, route: { app: kind, params: { thread: id } }, cls: msg.creepy ? 'creepy' : '' });
    }
    G.phone.refreshBadges();
    G.bus.emit('chat:msg', { kind, id, msg });
    return msg;
  };

  function avatarNode(src, name) {
    const a = el('div.chat-av');
    if (src) a.style.backgroundImage = `url("${src}")`;
    else { a.textContent = (name || '?').slice(0, 1); a.style.cssText += 'display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;'; }
    return a;
  }
  C.avatarNode = avatarNode;

  function fmtDay(d) { return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${G.util.WEEK[d.getDay()]}요일`; }

  /** render a conversation screen */
  C.open = function (kind, id) {
    const th = C.thread(kind, id);
    if (!th) return;
    const isTalk = kind === 'talk';
    const body = el('div.chat-body');
    const right = [];
    if (th.menu) right.push(el('button', { 'aria-label': '메뉴', html: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2"/></svg>', onclick: () => th.menu() }));
    const scr = G.ui.screen({ title: G.T(th.name), sub: th.sub ? G.T(th.sub) : (th.members ? th.members + '명' : null), cls: (isTalk ? 'talk-screen' : 'sms-screen'), right, body });
    const input = el('div.chat-input', null, el('div.ci-box', null, th.inputHint ? G.T(th.inputHint) : (isTalk ? '메시지 입력' : '문자 메시지')), el('button.ci-send', { html: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12l16-8-6 16-2-6z" fill="currentColor"/></svg>' }));
    scr.appendChild(input);
    input.addEventListener('click', () => { if (th.onCompose) th.onCompose(); else G.phone.toast(th.noReply ? G.T(th.noReply) : '이 폰으로는 답장을 보낼 수 없을 것 같다…'); });

    let lastDay = null, lastFrom = null, lastMin = null;
    function msgNode(m) {
      const d = parseT(m.t);
      const frag = document.createDocumentFragment();
      if (d) {
        const dk = d.toDateString();
        if (dk !== lastDay) { frag.appendChild(el('div.chat-date', null, fmtDay(d))); lastDay = dk; lastFrom = null; }
      }
      if (m.sys) { frag.appendChild(el('div.chat-sys', null, G.T(m.sys))); lastFrom = null; return frag; }
      const me = m.from === 'me';
      let bubble;
      if (m.deleted) bubble = el('div.bubble.deleted', null, '🚫 삭제된 메시지입니다.');
      else if (m.img) {
        bubble = el('div.bubble.img', null, el('img', { src: m.img, alt: '' }));
        bubble.addEventListener('click', () => G.gallery && G.gallery.viewSingle(m.img, { title: th.name, photoId: m.photoId }));
      } else if (m.voice) {
        bubble = el('div.bubble.voice', null, el('span', { html: '▶' }), el('span', null, '음성메시지 ' + (m.voice.dur || '0:07')));
        bubble.addEventListener('click', () => m.voice.onPlay && m.voice.onPlay(bubble));
      } else bubble = el('div.bubble' + (m.creepy ? '.creepy' : ''), null, G.T(m.text || ''));
      if (m.onTap && !m.img) bubble.addEventListener('click', () => m.onTap(bubble));
      const minuteKey = d ? d.getHours() * 60 + d.getMinutes() : null;
      const showName = !me && isTalk && (lastFrom !== m.from || lastMin !== minuteKey);
      const meta = el('div.chat-meta', null, m.read === false && me ? el('span.unread', null, '1') : null, d ? el('span', null, G.util.fmtKTime(d)) : null);
      const col = el('div.chat-col', null, showName ? el('div.chat-name', null, G.T(m.name || th.name)) : null, bubble);
      const row = el('div.chat-row' + (me ? '.me' : ''), null,
        !me && isTalk ? (showName ? avatarNode(m.avatar || th.avatar, m.name || th.name) : el('div', { style: { width: '38px', flex: 'none' } })) : null,
        col, meta);
      frag.appendChild(row);
      lastFrom = m.from; lastMin = minuteKey;
      return frag;
    }
    C.messages(kind, id).forEach((m) => body.appendChild(msgNode(m)));
    let typingEl = null;
    const key = kind + ':' + id;
    openViews[key] = {
      append(m) { body.appendChild(msgNode(m)); scr.body.scrollTo({ top: 1e7, behavior: 'smooth' }); },
      typing(on) {
        if (on && !typingEl) { typingEl = el('div.chat-row', null, isTalk ? avatarNode(th.avatar, th.name) : null, G.ui.typing()); body.appendChild(typingEl); scr.body.scrollTo({ top: 1e7, behavior: 'smooth' }); }
        if (!on && typingEl) { typingEl.remove(); typingEl = null; }
      },
    };
    G.phone.push(scr, { onClose: () => { delete openViews[key]; }, anim: 'slide' });
    requestAnimationFrame(() => { scr.body.scrollTop = th.scrollTop != null ? th.scrollTop : 1e7; });
    C.markRead(kind, id);
    G.state.seen[key] = true; G.save();
    G.bus.emit('chat:open', { kind, id });
    th.onOpen && th.onOpen(scr);
    return scr;
  };

  /** thread list screen */
  C.list = function (kind, title, opts) {
    opts = opts || {};
    const listWrap = el('div.chat-list');
    const scr = G.ui.screen({ title, back: true, body: listWrap, right: opts.right });
    function render() {
      listWrap.innerHTML = '';
      const ths = C.threads(kind).slice().sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const la = C.messages(kind, a.id), lb = C.messages(kind, b.id);
        const ta = la.length ? +parseT(la[la.length - 1].t) : 0, tb = lb.length ? +parseT(lb[lb.length - 1].t) : 0;
        return tb - ta;
      });
      listWrap.appendChild(G.ui.list(ths.map((th) => {
        const ms = C.messages(kind, th.id); const last = ms[ms.length - 1] || {};
        const d = parseT(last.t);
        const unread = C.unread(kind, th.id);
        const now = G.clock.now();
        const when = !d ? '' : d.toDateString() === now.toDateString() ? G.util.fmtKTime(d) : (d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`);
        const iconHtml = th.avatar ? `<img src="${th.avatar}" alt="">` : `<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#9aa;color:#fff;font-weight:700">${(th.name || '?').slice(0, 1)}</span>`;
        return {
          icon: iconHtml,
          title: G.T(th.name) + (th.members ? ` <${th.members}>` : ''),
          sub: last.deleted ? '삭제된 메시지입니다.' : last.img ? '사진' : last.voice ? '음성메시지' : G.T(last.text || last.sys || ''),
          meta: el('div', null, el('div', null, when), unread ? el('span.chat-unread', null, unread > 300 ? '300+' : String(unread)) : null),
          chevron: false,
          onClick: () => C.open(kind, th.id),
        };
      })));
    }
    render();
    const off = G.bus.on('chat:msg', (e) => { if (e.kind === kind) render(); });
    G.phone.push(scr, { onClose: off, onResume: render });
    return scr;
  };

  /* ---------------- 톡 app ---------------- */
  G.app('talk', {
    name: '톡',
    icon: G.ICONS.talk,
    dock: true,
    badge: () => C.totalUnread('talk'),
    open(p) {
      C.list('talk', '채팅');
      if (p && p.thread) C.open('talk', p.thread);
    },
  });
})();
