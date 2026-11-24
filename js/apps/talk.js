/* =========================================================
 * Chat engine (shared by 톡 and 메시지) + 톡 app.   DESIGN §4.1
 * Data: G.STORY.talk / G.STORY.sms (see js/data/talk.js for the schema)
 *
 * Public API (used by director / other modules):
 *   G.chat.push(kind, threadId, msg, {notify=true, typingMs, silent, tone, read}) -> Promise<msg>
 *        msg: {from:'me'|'them', text, img, blur, call, sys, card, deleted}
 *        tone: 'him'|'mom'|'friend'|'album' (defaults to the thread's tone)
 *   G.chat.edit(kind, threadId, msgId, patch)        e.g. {deleted:true}
 *   G.chat.typing(kind, threadId, ms) -> Promise      typing dots (chat open) / '입력 중…' in list
 *   G.chat.open(kind, id) / G.chat.list(kind, title) / G.chat.messages / unread / parseT
 *   G.talk.slip()       — 관리실 [사진] slip → 삭제 → '죄송합니다 잘못 보냈네요 ^^' (sets managerSlip)
 *   G.talk.profile(id)  — open a profile card
 * Thread ids (톡): 'mom', 'haru', 'manager', 'jimin', 'parcel'
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);

  /* ---------- core shims (LEAD adds these; fall back gracefully) ---------- */
  const netFree = () => G.flag('netFree') || G.flag('M6');
  const mirroring = () => (G.mirroring ? G.mirroring() : G.flag('M1') && !G.flag('M5'));
  function softTick() {
    const A = G.audio;
    try {
      if (A && A.osc && A.ok && A.ok() && A.bus) A.osc('sine', 2100 + Math.random() * 500, A.now(), 0.02, 0.022, A.bus('ui'), { a: 0.001, decay: true });
      else if (A && A.sfx && A.sfx.key) A.sfx.key();
    } catch (e) {}
  }
  function ringStart(kind) {
    const A = G.audio;
    try {
      if (kind === 'mom' && A.sfx.ringMom) return A.sfx.ringMom();
      if (A.ringtone) return A.ringtone(false);
    } catch (e) {}
    return { stop() {} };
  }
  const stopRing = (r) => { try { r && (r.stop ? r.stop() : typeof r === 'function' && r()); } catch (e) {} };

  const C = (G.chat = G.chat || {});
  const openViews = {}; // key -> view api
  const typingState = {}; // key -> until(ms)

  function parseT(t) {
    if (!t) return null;
    if (t instanceof Date) return t;
    if (typeof t === 'number') return new Date(t);
    const m = String(t).match(/(\d+)-(\d+)-(\d+)(?:[ T](\d+):(\d+))?/);
    return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  C.parseT = parseT;
  const K = (kind, id) => kind + ':' + id;
  C.threads = function (kind) { return (G.STORY[kind] || []).filter((t) => !t.show || t.show()); };
  C.thread = function (kind, id) { return (G.STORY[kind] || []).find((t) => t.id === id); };
  C.base = function (kind, id) {
    const th = C.thread(kind, id);
    const b = th ? (typeof th.messages === 'function' ? th.messages() : th.messages || []) : [];
    return b.filter((m) => !m.show || m.show());
  };
  C.live = function (kind, id) { return G.state.threads[K(kind, id)] || []; };
  C.messages = function (kind, id) { return C.base(kind, id).concat(C.live(kind, id)); };
  const incoming = (m) => m.from !== 'me' && !m.sys && !m.typing;
  C.readPtr = function (kind, id) { const r = G.state.read[K(kind, id)]; return typeof r === 'number' ? r : null; };
  C.unread = function (kind, id) {
    const all = C.messages(kind, id);
    const rp = C.readPtr(kind, id);
    if (rp == null) {
      const nb = C.base(kind, id).length;
      return all.reduce((a, m, i) => a + ((i < nb ? m.unread : incoming(m)) ? 1 : 0), 0);
    }
    let n = 0;
    for (let i = rp; i < all.length; i++) if (incoming(all[i])) n++;
    return n;
  };
  C.totalUnread = function (kind) { return C.threads(kind).reduce((a, t) => a + C.unread(kind, t.id), 0); };
  C.markRead = function (kind, id) { G.state.read[K(kind, id)] = C.messages(kind, id).length; G.save(); G.phone.refreshBadges && G.phone.refreshBadges(); };
  C.missedCount = function (kind, id) { return C.messages(kind, id).filter((m) => m.call === 'missed').length; };
  C.isOpen = function (kind, id) { return !!openViews[K(kind, id)]; };

  /** push a live message. */
  C.push = async function (kind, id, msg, opts) {
    opts = opts || {};
    const key = K(kind, id);
    const th = C.thread(kind, id);
    if (opts.typingMs) await C.typing(kind, id, opts.typingMs);
    msg = Object.assign({ t: G.clock.now().getTime(), id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, msg);
    if (msg.from == null) msg.from = 'them';
    (G.state.threads[key] = G.state.threads[key] || []).push(msg);
    G.save();
    const view = openViews[key];
    const tone = opts.tone || msg.tone || (th && th.tone) || 'friend';
    if (view) {
      view.append(msg);
      if (opts.read !== false) C.markRead(kind, id);
      if (!opts.silent && msg.from !== 'me') SD.tone(tone);
    } else if (opts.notify !== false && msg.from !== 'me' && !msg.sys) {
      G.phone.notify({
        app: kind, title: T((th && th.name) || '알 수 없음'),
        body: msg.deleted ? '삭제된 메시지입니다.' : msg.img ? (msg.text ? '사진 · ' + T(msg.text) : '사진을 보냈습니다.') : msg.call ? '보이스톡 부재중' : msg.card ? T(msg.card.title) : T(msg.text || ''),
        route: { app: kind, params: { thread: id } }, tone, silent: !!opts.silent,
        cls: msg.creepy ? 'creepy' : '', img: msg.img ? SD.img(msg.img) : null, blur: msg.blur || 0,
      });
    }
    G.phone.refreshBadges && G.phone.refreshBadges();
    G.bus.emit('chat:msg', { kind, id, msg });
    return msg;
  };
  /** patch a live message in place (e.g. {deleted:true}) */
  C.edit = function (kind, id, msgId, patch) {
    const list = G.state.threads[K(kind, id)] || [];
    const m = list.find((x) => x.id === msgId);
    if (!m) return null;
    Object.assign(m, patch);
    G.save();
    const v = openViews[K(kind, id)];
    if (v) v.replace(m);
    G.bus.emit('chat:edit', { kind, id, msg: m });
    return m;
  };
  C.typing = async function (kind, id, ms) {
    const key = K(kind, id);
    typingState[key] = Date.now() + ms;
    const v = openViews[key];
    if (v) v.typing(true);
    G.bus.emit('chat:typing', { kind, id, on: true });
    await sleep(ms);
    if (typingState[key] <= Date.now() + 30) {
      delete typingState[key];
      const v2 = openViews[key];
      if (v2) v2.typing(false);
      G.bus.emit('chat:typing', { kind, id, on: false });
    }
  };
  C.isTyping = (kind, id) => (typingState[K(kind, id)] || 0) > Date.now();

  /* ---------------- avatars ---------------- */
  const SIL = '<svg viewBox="0 0 40 40"><circle cx="20" cy="15.5" r="7.2" fill="#fff"/><path d="M6.5 38c0-8 6-12.5 13.5-12.5S33.5 30 33.5 38z" fill="#fff"/></svg>';
  function avatarNode(spec, name, cls) {
    spec = spec || {};
    const a = el('div.chat-av' + (cls ? '.' + cls : ''));
    a.style.background = spec.bg || '#9aa8b6';
    const face = el('span.av-face', null, spec.silhouette ? null : (spec.emoji || spec.initial || T(name || '?').slice(0, 1)));
    if (spec.silhouette) face.innerHTML = SIL;
    a.appendChild(face);
    if (spec.img) {
      const ph = el('span.av-img');
      SD.bg(ph, spec.img);
      a.appendChild(ph);
    }
    return a;
  }
  C.avatarNode = function (src, name) { return avatarNode(typeof src === 'string' ? { img: src } : src, name); };

  /* ---------------- icons ---------------- */
  const IC = {
    call: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M14.5 3.5l6 6-2 .8-3.6 3.6.4 4.1-1.4 1.4-3.6-3.6L5 20.5l-.5-.5 4.7-5.3-3.6-3.6L7 9.7l4.1.4 3.6-3.6z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M12 4c4.97 0 9 3.13 9 7s-4.03 7-9 7c-.6 0-1.2-.05-1.78-.14L6 20.5l.9-3.6C4.5 15.6 3 13.4 3 11c0-3.87 4.03-7 9-7z" fill="currentColor"/></svg>',
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2" fill="currentColor"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="#fff" stroke-width="1.6"/></svg>',
  };

  /* =========================================================
   * Conversation screen
   * ========================================================= */
  function fmtDay(d) { return SD.dayLabel(d); }
  function monthKey(d) { return d.getFullYear() * 100 + d.getMonth(); }
  function preview(m) {
    if (!m) return '';
    if (m.deleted) return '삭제된 메시지입니다.';
    if (m.call) return m.call === 'missed' ? '보이스톡 부재중' : m.call === 'declined' ? '보이스톡 거절됨' : '보이스톡';
    if (m.card) return T(m.card.title);
    if (m.img) return m.text ? T(m.text) : '사진';
    if (m.share) return '메일을 공유했습니다.';
    return T(m.text || m.sys || '');
  }
  C.preview = preview;

  C.open = function (kind, id, opts) {
    opts = opts || {};
    const th = C.thread(kind, id);
    if (!th) return null;
    const isTalk = kind === 'talk';
    const key = K(kind, id);
    const all = C.messages(kind, id);
    const rp = C.readPtr(kind, id);
    const nb = C.base(kind, id).length;
    const isUnread = (m, i) => (rp == null ? (i < nb ? !!m.unread : false) : false) && incoming(m);

    const body = el('div.chat-body');
    const right = [];
    if (isTalk && th.compose !== 'channel') {
      const callBtn = el('button.ch-call', { 'aria-label': '보이스톡', html: IC.call, onclick: () => voiceCall(th) });
      right.push(callBtn);
      if (id === 'haru' && G.state.vars.haruCallPulse) { callBtn.classList.add('pulse'); G.state.vars.haruCallPulse = 0; G.save(); }
    }
    if (isTalk) right.push(el('button', { 'aria-label': '프로필', html: IC.menu, onclick: () => TK.profile(id) }));
    const sub = typeof th.sub === 'function' ? th.sub() : th.sub;
    const scr = G.ui.screen({ title: T(th.name), sub: sub ? T(sub) : (kind === 'sms' && th.number ? th.number : null), cls: (isTalk ? 'talk-screen' : 'sms-screen') + (id === 'haru' ? ' haru-room' : ''), right, body });
    if (isTalk) { const tt = scr.querySelector('.sv-titles'); tt.style.cursor = 'pointer'; tt.addEventListener('click', () => TK.profile(id)); }

    /* ---- message rendering ---- */
    let lastDay = null;
    const nodeById = {};
    function dayDivider(d) { return el('div.chat-date', null, el('span', { html: IC.cal }), fmtDay(d)); }
    function sameGroup(a, b) {
      if (!a || !b || a.sys || b.sys || a.card || b.card) return false;
      if ((a.from === 'me') !== (b.from === 'me')) return false;
      const da = parseT(a.t), db = parseT(b.t);
      return da && db && da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
    }
    function bubbleFor(m) {
      if (m.deleted) return el('div.bubble.deleted', null, el('i', { html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5v5.5M12 16v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }), '삭제된 메시지입니다.');
      if (m.call) {
        const lbl = m.call === 'missed' ? '보이스톡 부재중' : m.call === 'declined' ? '보이스톡 거절됨' : m.call === 'failed' ? '보이스톡 연결 실패' : m.call === 'noanswer' ? '보이스톡 응답 없음' : '보이스톡';
        return el('div.bubble.callb.' + m.call, null, el('span.clb-ic', { html: IC.call }), el('span', null, el('b', null, lbl), m.dur ? el('small', null, m.dur) : null));
      }
      if (m.card) {
        const c = m.card;
        return el('div.bubble.card', null, el('div.cd-head', null, T(th.name)), el('div.cd-title', null, T(c.title)),
          c.rows ? el('div.cd-rows', null, c.rows.map(([k, v]) => el('div', null, el('span', null, T(k)), el('b', null, T(v))))) : null,
          c.foot ? el('div.cd-foot', null, T(c.foot)) : null);
      }
      if (m.share) {
        return el('div.bubble.share', null, el('div.sh-ic', { html: IC.mail }), el('div', null, el('b', null, T(m.share.title)), el('small', null, T(m.share.sub || ''))));
      }
      if (m.img) {
        const im = SD.imgEl(m.img);
        if (m.blur) im.style.filter = `blur(${m.blur}px)`;
        const b = el('div.bubble.img', null, im);
        b.addEventListener('click', () => { if (G.gallery && G.gallery.viewSingle && !m.blur) G.gallery.viewSingle(SD.img(m.img), { title: T(th.name), photoId: m.photoId, t: m.t }); });
        return b;
      }
      return el('div.bubble' + (m.creepy ? '.creepy' : ''), null, T(m.text || ''));
    }
    function msgNode(m, i, prev, next, unread) {
      const frag = document.createDocumentFragment();
      const d = parseT(m.t);
      if (d) {
        const dk = d.toDateString();
        if (dk !== lastDay) { frag.appendChild(dayDivider(d)); lastDay = dk; prev = null; }
      }
      if (m.sys) { frag.appendChild(el('div.chat-sys', null, T(m.sys))); return frag; }
      const me = m.from === 'me';
      const first = !sameGroup(prev, m);
      const last = !sameGroup(m, next);
      const bub = bubbleFor(m);
      if (m.onTap) bub.addEventListener('click', () => m.onTap(bub));
      const extra = [];
      if (m.img && m.text && !m.deleted) extra.push(el('div.bubble', null, T(m.text)));
      const col = el('div.chat-col', null,
        !me && isTalk && first ? el('div.chat-name', null, T(m.name || th.name)) : null,
        bub, extra);
      const rc = (unread || (me && m.pending)) ? el('span.rc', null, '1') : null;
      const meta = el('div.chat-meta', null, rc, last && d ? el('span.ct', null, G.util.fmtKTime(d)) : null);
      const fail = me && m.fail ? el('button.ch-fail', { 'aria-label': '전송 실패', onclick: () => failMenu(m) }, '!') : null;
      const row = el('div.chat-row' + (me ? '.me' : '') + (first ? '.first' : '') + (last ? '.last' : '') + (fail ? '.failed' : ''),
        { dataset: { mid: m.id || '' } },
        !me && isTalk ? (first ? avatarNode(m.avatar || th.avatar, th.name) : el('div.chat-av-sp')) : null,
        col, fail, fail ? null : meta);
      if (m.sending) row.classList.add('sending');
      if (m.id) nodeById[m.id] = row;
      frag.appendChild(row);
      return frag;
    }

    /* ---- collapsing (month groups) ---- */
    function buildItems(list) {
      const items = []; // {type:'msg', i} | {type:'grp', from, to}
      let i = 0;
      while (i < list.length) {
        const m = list[i];
        if (m.grp) {
          const d = parseT(m.t); const mk = monthKey(d);
          let j = i;
          while (j + 1 < list.length && list[j + 1].grp && monthKey(parseT(list[j + 1].t)) === mk) j++;
          items.push({ type: 'grp', from: i, to: j, mk });
          i = j + 1;
        } else { items.push({ type: 'msg', i }); i++; }
      }
      // label: whole month, or a day range when the month is split
      const perMonth = {};
      items.forEach((it) => { const mk = it.type === 'grp' ? it.mk : monthKey(parseT(list[it.i].t)); perMonth[mk] = (perMonth[mk] || 0) + 1; });
      items.forEach((it) => { if (it.type === 'grp') it.split = perMonth[it.mk] > 1; });
      return items;
    }
    const groups = [];
    function groupNode(it) {
      const a = parseT(all[it.from].t), b = parseT(all[it.to].t);
      const n = it.to - it.from + 1;
      const label = it.split ? `${a.getFullYear()}년 ${a.getMonth() + 1}월 ${a.getDate()}일${a.getDate() !== b.getDate() ? '~' + b.getDate() + '일' : ''}` : `${a.getFullYear()}년 ${a.getMonth() + 1}월`;
      let lastText = null;
      for (let k = it.to; k >= it.from; k--) if (all[k].text && !all[k].call) { lastText = all[k]; break; }
      let unreadN = 0;
      for (let k = it.from; k <= it.to; k++) if (isUnread(all[k], k)) unreadN++;
      const badge = unreadN ? el('span.chg-rc', null, String(unreadN)) : null;
      const node = el('button.chat-grp', null,
        el('div.chg-top', null, el('span.chg-l', null, `${label} · 메시지 ${n}개 펼치기`), el('span.chg-chev', { html: IC.chev }), badge),
        lastText ? el('div.chg-prev', null, (lastText.from === 'me' ? '나: ' : T(th.name) + ': ') + T(lastText.text)) : null);
      const g = { node, it, badge, unreadN, expanded: false };
      node.addEventListener('click', () => expand(g));
      groups.push(g);
      return node;
    }
    function expand(g) {
      if (g.expanded) return;
      g.expanded = true;
      G.audio && G.audio.sfx.tap();
      const box = el('div.chat-grp-open');
      const saved = lastDay; lastDay = null;
      for (let k = g.it.from; k <= g.it.to; k++) box.appendChild(msgNode(all[k], k, all[k - 1], all[k + 1], g.readDone ? false : isUnread(all[k], k)));
      lastDay = saved;
      // keep the scroll anchored to the pill
      const sb = scr.body; const before = sb.scrollHeight; const top = sb.scrollTop;
      const pillTop = g.node.offsetTop;
      g.node.replaceWith(box);
      box.classList.add('in');
      if (pillTop < top) sb.scrollTop = top + (sb.scrollHeight - before);
      g.box = box;
    }

    function renderAll() {
      body.innerHTML = '';
      lastDay = null;
      const items = buildItems(all);
      items.forEach((it, n) => {
        if (it.type === 'grp') { body.appendChild(groupNode(it)); lastDay = null; return; }
        const i = it.i;
        body.appendChild(msgNode(all[i], i, all[i - 1], all[i + 1], isUnread(all[i], i)));
      });
    }
    renderAll();

    /* ---- typing bubble ---- */
    let typingEl = null;
    function setTyping(on) {
      if (on && !typingEl) {
        typingEl = el('div.chat-row.first.last.typing-row', null, isTalk ? avatarNode(th.avatar, th.name) : null, el('div.chat-col', null, el('div.bubble.typing-b', null, G.ui.typing())));
        body.appendChild(typingEl); scrollEnd(true);
      }
      if (!on && typingEl) { typingEl.remove(); typingEl = null; }
    }
    /* ---- scrolling ---- */
    const newPill = el('button.chat-newpill', { onclick: () => scrollEnd(true) }, '새 메시지 ↓');
    function nearBottom() { const s = scr.body; return s.scrollHeight - s.scrollTop - s.clientHeight < 140; }
    function scrollEnd(smooth) { const s = scr.body; s.scrollTo({ top: s.scrollHeight + 999, behavior: smooth ? 'smooth' : 'auto' }); newPill.classList.remove('in'); }

    /* ---- composer ---- */
    const chipsBar = el('div.chat-chips');
    let field = null, sendBtn = null;
    const composer = el('div.chat-input');
    if (th.compose === 'channel') {
      composer.classList.add('readonly');
      composer.appendChild(el('div.ci-note', null, '알림 전용 채널입니다. 답장을 받지 않습니다.'));
    } else if (kind === 'sms') {
      composer.classList.add('readonly');
      composer.appendChild(el('div.ci-note', null, 'SIM 카드 없음 · 문자를 보낼 수 없습니다'));
    } else {
      field = G.ui.field({ placeholder: '메시지 입력', mode: 'ko', submitLabel: '전송', onSubmit: (v) => doSend(v), onChange: (v) => sendBtn.classList.toggle('on', !!v.trim()) });
      field.node.classList.add('ci-field');
      sendBtn = el('button.ci-send', { 'aria-label': '전송', html: IC.send, onclick: () => doSend(field.value) });
      composer.append(field.node, sendBtn);
    }
    scr.append(newPill, chipsBar, composer);
    function renderChips() {
      chipsBar.innerHTML = '';
      const list = chipsFor(th) || [];
      list.forEach((c) => {
        const b = el('button.chip', null, T(c));
        b.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); if (field) { field.set(T(c)); sendBtn.classList.add('on'); field.node.classList.add('flash'); setTimeout(() => field.node.classList.remove('flash'), 500); } });
        chipsBar.appendChild(b);
      });
      chipsBar.classList.toggle('in', list.length > 0);
    }
    function doSend(v) {
      v = String(v || '').trim();
      if (!v) return;
      field.clear(); sendBtn.classList.remove('on');
      G.audio && G.audio.sfx.msgSend && G.audio.sfx.msgSend();
      send(th, v).then(renderChips);
      renderChips();
    }

    /* ---- view api ---- */
    const view = {
      append(m) {
        const list = C.messages(kind, id);
        const i = list.indexOf(m);
        all.push(m);
        const nb2 = nearBottom();
        const prevNode = m.id && nodeById[m.id];
        if (prevNode) prevNode.remove();
        if (typingEl) { typingEl.remove(); typingEl = null; }
        const frag = msgNode(m, i, list[i - 1], null, false);
        // previous bubble of the same group loses its time stamp
        const rowsNow = body.querySelectorAll(':scope > .chat-row:not(.typing-row)');
        const prevRow = rowsNow[rowsNow.length - 1];
        if (prevRow && sameGroup(list[i - 1], m)) { prevRow.classList.remove('last'); const ct = prevRow.querySelector('.ct'); if (ct) ct.remove(); }
        const node = frag.lastChild;
        if (node && node.classList && sameGroup(list[i - 1], m)) node.classList.remove('first');
        body.appendChild(frag);
        if (C.isTyping(kind, id)) setTyping(true);
        if (nb2 || m.from === 'me') scrollEnd(true); else newPill.classList.add('in');
        renderChips();
      },
      replace(m) {
        const old = nodeById[m.id];
        if (!old) return;
        const list = C.messages(kind, id); const i = list.indexOf(m);
        const keep = lastDay; lastDay = parseT(m.t) && parseT(m.t).toDateString();
        const frag = msgNode(m, i, list[i - 1], list[i + 1], false);
        lastDay = keep;
        const node = frag.lastChild;
        if (old.classList.contains('first')) node.classList.add('first'); else node.classList.remove('first');
        old.replaceWith(frag);
      },
      typing: setTyping,
      chips: renderChips,
      scr,
    };
    openViews[key] = view;
    const offFlag = G.bus.on('flag', () => renderChips());
    G.phone.push(scr, { onClose: () => { if (openViews[key] === view) delete openViews[key]; offFlag(); G.ui.hideKeyboard && G.ui.hideKeyboard(); }, anim: 'slide' });
    requestAnimationFrame(() => scrollEnd(false));
    setTimeout(() => scrollEnd(false), 60);
    if (C.isTyping(kind, id)) setTyping(true);
    renderChips();

    /* ---- read receipts vanish ---- */
    const firstRead = rp == null && all.some((m, i) => isUnread(m, i));
    C.markRead(kind, id);
    G.state.seen[key] = true; G.save();
    if (firstRead) receiptsVanish(kind, id, body, groups, all, isUnread);
    G.bus.emit('chat:open', { kind, id });
    th.onOpen && th.onOpen(scr);
    if (isTalk && TK.onOpen[id]) TK.onOpen[id](scr, firstRead);
    return scr;
  };

  /** the (1)s disappear: oldest -> newest, accelerating; mom's version ticks (design §4.1) */
  function receiptsVanish(kind, id, body, groups, all, isUnread) {
    const dramatic = kind === 'talk' && id === 'mom';
    const seq = [];
    all.forEach((m, i) => { if (isUnread(m, i)) seq.push(i); });
    const grpOf = (i) => groups.find((g) => i >= g.it.from && i <= g.it.to);
    let gap = dramatic ? 30 : 9;
    let k = 0;
    const rcByIndex = new Map();
    // map visible receipt nodes by message order (rows are rendered in order)
    const visible = Array.from(body.querySelectorAll('.chat-row .rc'));
    const visIdx = seq.filter((i) => { const g = grpOf(i); return !g || g.expanded; });
    visIdx.forEach((i, n) => rcByIndex.set(i, visible[n]));
    function step() {
      if (k >= seq.length) { groups.forEach((g) => { g.readDone = true; }); return; }
      const i = seq[k++];
      const g = grpOf(i);
      if (g && !g.expanded) {
        g.unreadN--;
        if (g.badge) { g.badge.textContent = String(Math.max(0, g.unreadN)); if (g.unreadN <= 0) g.badge.classList.add('gone'); }
      } else if (g && g.box) {
        const rc = g.box.querySelector('.rc:not(.gone)');
        if (rc) rc.classList.add('gone');
      } else {
        const rc = rcByIndex.get(i);
        if (rc) rc.classList.add('gone');
      }
      if (dramatic) softTick();
      gap = dramatic ? Math.max(5, gap * 0.986) : gap;
      setTimeout(step, gap);
    }
    setTimeout(step, dramatic ? 650 : 250);
  }

  /* =========================================================
   * Thread list
   * ========================================================= */
  function whenLabel(d) {
    if (!d) return '';
    const now = G.clock.now();
    if (d.toDateString() === now.toDateString()) return G.util.fmtKTime(d);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '어제';
    return d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  }
  function sortedThreads(kind) {
    return C.threads(kind).slice().sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const la = C.messages(kind, a.id), lb = C.messages(kind, b.id);
      const ta = la.length ? +parseT(la[la.length - 1].t) : 0, tb = lb.length ? +parseT(lb[lb.length - 1].t) : 0;
      return tb - ta;
    });
  }
  C.rows = function (kind, onOpen) {
    const wrap = el('div.chat-list');
    sortedThreads(kind).forEach((th) => {
      const ms = C.messages(kind, th.id); const last = ms[ms.length - 1];
      const d = last && parseT(last.t);
      const unread = C.unread(kind, th.id);
      const typing = C.isTyping(kind, th.id);
      const nameText = kind === 'sms' && th.number && !th.name ? th.number : T(th.name);
      const row = el('button.cl-row', null,
        kind === 'talk' ? avatarNode(th.avatar, th.name, 'cl-av') : el('div.cl-av.sms-av', { html: IC.person }),
        el('div.cl-main', null,
          el('div.cl-name', null, el('span', null, nameText), th.pinned ? el('i.cl-pin', { html: IC.pin }) : null),
          el('div.cl-prev' + (typing ? '.typing' : ''), null, typing ? '입력 중…' : preview(last))),
        el('div.cl-side', null, el('div.cl-when', null, whenLabel(d)), unread ? el('span.cl-badge', null, unread > 999 ? '999+' : String(unread)) : null));
      row.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); onOpen ? onOpen(th) : C.open(kind, th.id); });
      wrap.appendChild(row);
    });
    if (!wrap.childNodes.length) wrap.appendChild(el('div.empty-state', null, '대화가 없습니다'));
    return wrap;
  };
  /** generic list screen (used by 메시지) */
  C.list = function (kind, title, opts) {
    opts = opts || {};
    const holder = el('div');
    const scr = G.ui.screen({ title, back: true, body: holder, right: opts.right, cls: opts.cls });
    function render() { holder.innerHTML = ''; if (opts.top) holder.appendChild(opts.top()); holder.appendChild(C.rows(kind)); }
    render();
    const offs = [G.bus.on('chat:msg', (e) => { if (e.kind === kind) render(); }), G.bus.on('chat:edit', (e) => { if (e.kind === kind) render(); }), G.bus.on('chat:typing', (e) => { if (e.kind === kind) render(); })];
    G.phone.push(scr, { onClose: () => offs.forEach((f) => f()), onResume: render });
    return scr;
  };

  /* =========================================================
   * Sending
   * ========================================================= */
  const FAIL_TEXT = '전송 실패 · 관리자 네트워크에서 발신이 제한되었습니다.';
  const failNoted = {};
  async function send(th, text) {
    const kind = 'talk', id = th.id;
    if (id === 'haru') {
      const m = await C.push(kind, id, { from: 'me', text, pending: true }, { notify: false });
      await sleep(700 + Math.random() * 700);
      C.edit(kind, id, m.id, { pending: false });
      const v = G.state.vars;
      if (!v.haruReplied) {
        v.haruReplied = 1; G.save();
        SD.note('이 방만 메시지가 간다. 그 사람이 허락한 방이니까.');
        await sleep(900);
        await C.push(kind, id, { text: G.STORY.talkReplies.haruFirstReply }, { typingMs: 1800, tone: 'him' });
      } else {
        await sleep(600);
        await C.typing(kind, id, 1400);
      }
      return;
    }
    if (!netFree()) {
      const m = await C.push(kind, id, { from: 'me', text, sending: true }, { notify: false });
      await sleep(900);
      C.edit(kind, id, m.id, { sending: false, fail: true });
      G.audio && G.audio.sfx.error();
      failBanner();
      G.bus.emit('talk:sendFail', { id, text });
      return;
    }
    const m = await C.push(kind, id, { from: 'me', text, pending: true }, { notify: false });
    G.bus.emit('talk:send', { id, text });
    if (TK.scripts[id]) await TK.scripts[id](text, m);
  }
  function failBanner() {
    const v = Object.values(openViews).find(Boolean);
    const scr = v && v.scr;
    if (!scr) { G.phone.toast(FAIL_TEXT); return; }
    let b = scr.querySelector('.chat-failbar');
    if (!b) { b = el('div.chat-failbar', null, el('b', null, '!'), el('span', null, FAIL_TEXT)); scr.appendChild(b); }
    b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('in'), 3600);
  }
  async function failMenu(m) {
    const th = Object.keys(openViews).map((k) => k.split(':')).find(([kind]) => kind === 'talk');
    const id = th ? th[1] : null;
    if (!id) return;
    const r = await G.phone.dialog({ title: '전송 실패', text: '메시지를 보내지 못했습니다.', buttons: [{ label: '재전송', value: 'retry', style: 'primary' }, { label: '삭제', value: 'del', style: 'danger' }, { label: '취소', value: null }] });
    const list = G.state.threads[K('talk', id)] || [];
    if (r === 'del') {
      const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); G.save();
      const v = openViews[K('talk', id)]; if (v) { const n = v.scr.querySelector(`[data-mid="${m.id}"]`); if (n) n.remove(); }
    } else if (r === 'retry') {
      const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); G.save();
      const v = openViews[K('talk', id)]; if (v) { const n = v.scr.querySelector(`[data-mid="${m.id}"]`); if (n) n.remove(); }
      send(C.thread('talk', id), m.text);
    }
  }

  /* =========================================================
   * 보이스톡 screens
   * ========================================================= */
  function vtScreen(th, o) {
    const status = el('div.tvc-status', null, o.status || '');
    const sub = el('div.tvc-sub', null, o.sub || '');
    const decline = el('button.tvc-btn.decline', { 'aria-label': '거절', html: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>' });
    const accept = el('button.tvc-btn.accept', { 'aria-label': '수락', html: IC.call });
    const btns = o.incoming
      ? el('div.tvc-actions', null, el('div.tvc-bw', null, decline, el('span', null, '거절')), el('div.tvc-bw', null, accept, el('span', null, '수락')))
      : el('div.tvc-actions', null, el('div.tvc-bw', null, decline, el('span', null, '종료')));
    const bg = el('div.tvc-bg');
    if (th.avatar && th.avatar.img) SD.bg(bg, th.avatar.img);
    const node = el('div.tvc' + (o.incoming ? '.incoming' : ''), null, bg,
      el('div.tvc-top', null, el('div.tvc-kind', null, '보이스톡'), avatarNode(th.avatar, th.name, 'tvc-av'), el('div.tvc-name', null, T(th.name)), status, sub),
      btns);
    const ov = G.phone.overlay(node, { modal: 'hard' });
    const restore = SD.statusOverlay('light');
    return {
      node, decline, accept,
      status(t, cls) { status.textContent = t; status.className = 'tvc-status' + (cls ? ' ' + cls : ''); },
      sub(t) { sub.textContent = t; },
      close(ms) { setTimeout(() => { ov.close(); restore(); }, ms || 0); },
    };
  }
  async function voiceCall(th) {
    G.audio && G.audio.sfx.tap();
    if (th.id === 'haru') {
      if (G.hooks && G.hooks.has && G.hooks.has('talk:call')) { G.hooks.call('talk:call', 'haru'); return; }
      // fallback (room-climax hook missing): plain no-answer call
      const v = vtScreen(th, { status: '연결 중…' });
      await new Promise((r) => { try { G.audio.ringback(2, r); } catch (e) { setTimeout(r, 6000); } });
      v.status('상대방이 응답하지 않습니다'); G.audio.sfx.callEnd && G.audio.sfx.callEnd(); v.close(1400);
      return;
    }
    const v = vtScreen(th, { status: '연결 중…' });
    let ended = false;
    v.decline.addEventListener('click', () => { if (ended) return; ended = true; v.status('통화 종료'); G.audio.sfx.callEnd && G.audio.sfx.callEnd(); v.close(700); });
    if (!netFree()) {
      await sleep(1500);
      if (ended) return;
      ended = true;
      G.audio.sfx.error && G.audio.sfx.error();
      v.status('연결 실패', 'red'); v.sub('관리자 네트워크에서 발신이 제한되었습니다.');
      C.push('talk', th.id, { from: 'me', call: 'failed' }, { notify: false, silent: true });
      v.close(2300);
      return;
    }
    await new Promise((r) => { try { G.audio.ringback(2, r); } catch (e) { setTimeout(r, 6000); } });
    if (ended) return;
    ended = true;
    v.status('상대방이 응답하지 않습니다'); v.sub('메시지를 남겨 보세요.');
    G.audio.sfx.callEnd && G.audio.sfx.callEnd();
    C.push('talk', th.id, { from: 'me', call: 'noanswer' }, { notify: false, silent: true });
    v.close(1800);
  }

  /* =========================================================
   * 톡 app: 친구 / 채팅 tabs, profiles
   * ========================================================= */
  const TK = (G.talk = G.talk || {});
  TK.onOpen = {};
  TK.scripts = {};
  let tab = 'chats';

  TK.profile = function (id) {
    const me = id === 'me';
    const th = me ? Object.assign({ id: 'me' }, G.STORY.talkMe) : C.thread('talk', id);
    if (!th) return;
    G.audio && G.audio.sfx.tap();
    const pf = th.profile || {};
    const bg = el('div.pf-bg');
    if (pf.bgImg) SD.bg(bg, pf.bgImg); else bg.style.background = pf.bg || 'linear-gradient(#8aa,#344)';
    const actions = me ? [] : [
      el('button.pf-act', { onclick: () => { ov.close(); if (!C.isOpen('talk', id)) C.open('talk', id); } }, el('span', { html: IC.chat }), '1:1 채팅'),
      th.compose !== 'channel' ? el('button.pf-act', { onclick: () => { ov.close(); voiceCall(th); } }, el('span', { html: IC.call }), '보이스톡') : null,
    ];
    const node = el('div.pf-wrap', null, bg, el('div.pf-shade'),
      el('button.pf-close', { 'aria-label': '닫기', html: IC.close, onclick: () => ov.close() }),
      el('div.pf-main', null,
        avatarNode(th.avatar, th.name, 'pf-av'),
        el('div.pf-name', null, T(th.name)),
        th.status ? el('div.pf-status', null, T(th.status)) : null,
        pf.info ? el('div.pf-info', null, pf.info.map((x) => el('div', null, T(x)))) : null,
        actions.length ? el('div.pf-acts', null, actions) : null));
    const restore = SD.statusOverlay('light');
    const ov0 = G.phone.overlay(node, { onBack: () => ov.close() });
    const ov = { close() { ov0.close(); restore(); } };
    G.bus.emit('talk:profile', id);
    if (id === 'manager') {
      if (!G.flag('managerExposed')) SD.note('톡 관리실: 010-8817-3302로 추가됨 (2025.03.08). 문 스티커 번호는 02로 시작했는데…');
      G.flag('managerExposed', true);
    }
  };

  function friendsTab() {
    const wrap = el('div.fr-list');
    const meRow = el('button.fr-me', { onclick: () => TK.profile('me') }, avatarNode(G.STORY.talkMe.avatar, '세아', 'fr-av-me'), el('div', null, el('b', null, G.STORY.talkMe.name), el('small', null, G.STORY.talkMe.status)));
    wrap.appendChild(meRow);
    const fr = C.threads('talk').filter((t) => t.compose !== 'channel');
    wrap.appendChild(el('div.fr-sec', null, `친구 ${fr.length}`));
    fr.forEach((th) => {
      wrap.appendChild(el('button.fr-row', { onclick: () => TK.profile(th.id) }, avatarNode(th.avatar, th.name, 'fr-av'), el('div', null, el('b', null, T(th.name)), th.status ? el('small', null, T(th.status)) : null)));
    });
    return wrap;
  }

  G.app('talk', {
    name: '톡',
    icon: G.ICONS.talk,
    dock: true,
    badge: () => C.totalUnread('talk'),
    open(p) {
      const holder = el('div');
      const tabs = el('div.tk-tabs');
      const titleEl = el('div.tk-title');
      const head = el('header.tk-head', null, titleEl);
      const scr = el('section.tk-screen', { dataset: { status: 'light', theme: 'light' } }, head, el('div.sv-body.tk-body', null, holder), tabs);
      scr.body = scr.querySelector('.sv-body');
      function render() {
        holder.innerHTML = ''; tabs.innerHTML = '';
        titleEl.textContent = tab === 'friends' ? '친구' : '채팅';
        holder.appendChild(tab === 'friends' ? friendsTab() : C.rows('talk'));
        [['friends', '친구', IC.person], ['chats', '채팅', IC.chat]].forEach(([k, l, ic]) => {
          const b = el('button' + (tab === k ? '.on' : ''), null, el('span', { html: ic }), el('small', null, l), k === 'chats' && C.totalUnread('talk') ? el('i.tk-dot', null, String(Math.min(999, C.totalUnread('talk')))) : null);
          b.addEventListener('click', () => { if (tab === k) return; G.audio.sfx.tap(); tab = k; render(); });
          tabs.appendChild(b);
        });
      }
      render();
      const offs = ['chat:msg', 'chat:edit', 'chat:typing', 'flag'].map((ev) => G.bus.on(ev, () => render()));
      G.phone.push(scr, { onClose: () => offs.forEach((f) => f()), onResume: render });
      if (p && p.thread) { tab = 'chats'; render(); C.open('talk', p.thread); }
    },
  });

  /* =========================================================
   * Scripts
   * ========================================================= */
  const R = () => G.STORY.talkReplies || {};
  const V = () => G.state.vars;
  async function readMine(id, ms) {
    await sleep(ms || 1200);
    (G.state.threads[K('talk', id)] || []).forEach((m) => { if (m.from === 'me' && m.pending) C.edit('talk', id, m.id, { pending: false }); });
  }
  async function say(id, lines, typing) {
    for (const l of [].concat(lines)) await C.push('talk', id, { text: l }, { typingMs: typing || 1500 + Math.min(2200, l.length * 60) });
  }
  function chipsFor(th) {
    if (th.id !== 'mom' && th.id !== 'jimin') return null;
    const r = R()[th.id]; if (!r) return null;
    if (th.id === 'mom' && G.flag('END')) {
      const st = V().momEnd || 0;
      if (V().momEndBusy) return [];
      if (st === 0) return r.endChips;
      if (st === 1) return [r.endShare];
      return [];
    }
    if (!netFree()) return null;
    const st = V()['reply_' + th.id] || 0;
    if (V()['replyBusy_' + th.id]) return [];
    if (st === 0) return r.chips1;
    if (st === 1) return r.chips2;
    return [];
  }
  const HELP = /옷장|신고|112|경찰|갇|사람|살려|도와|구해|누가/;
  TK.scripts.jimin = async function (text) {
    const r = R().jimin, v = V();
    const st = v.reply_jimin || 0;
    if (v.replyBusy_jimin) { readMine('jimin', 1500); return; }
    v.replyBusy_jimin = 1; G.save();
    try {
      if (st === 0) {
        await readMine('jimin', 1400);
        await say('jimin', r.reply1);
        v.reply_jimin = 1;
      } else if (st === 1) {
        await readMine('jimin', 900);
        if (HELP.test(text) || text === T(r.chips2[0])) {
          await say('jimin', r.reply2, 1300);
          v.reply_jimin = 2; G.flag('jiminTold', true);
          SD.note('지민이 112에 신고했다.');
        } else if (!v.jiminConfused) { v.jiminConfused = 1; await say('jimin', r.confused); }
      } else {
        await readMine('jimin', 900);
        if (!v.jiminAfter) { v.jiminAfter = 1; await say('jimin', r.after); }
      }
    } finally { v.replyBusy_jimin = 0; G.save(); const vw = openViews[K('talk', 'jimin')]; vw && vw.chips(); }
  };
  TK.scripts.mom = async function (text) {
    const r = R().mom, v = V();
    if (G.flag('END')) return momEnding(text);
    const st = v.reply_mom || 0;
    if (v.replyBusy_mom) { readMine('mom', 1500); return; }
    v.replyBusy_mom = 1; G.save();
    try {
      if (st === 0) {
        await readMine('mom', 1600);
        // she types… stops… types… (×3, ~20 s)
        for (let i = 0; i < 3; i++) { await C.typing('talk', 'mom', 3800 + i * 600); await sleep(2200); }
        await say('mom', r.reply1, 1200);
        v.reply_mom = 1;
      } else if (st === 1) {
        await readMine('mom', 900);
        if (HELP.test(text) || /폰|세아/.test(text)) {
          await say('mom', r.reply2, 1400);
          v.reply_mom = 2; G.flag('momTold', true);
        } else if (!v.momConfused) { v.momConfused = 1; await say('mom', r.confused); }
      } else {
        await readMine('mom', 900);
        if (!v.momAfter) { v.momAfter = 1; await say('mom', r.after); }
      }
    } finally { v.replyBusy_mom = 0; G.save(); const vw = openViews[K('talk', 'mom')]; vw && vw.chips(); }
  };
  async function momEnding(text) {
    const r = R().mom, v = V();
    if (v.momEndBusy) return;
    const st = v.momEnd || 0;
    v.momEndBusy = 1; G.save();
    try {
      if (st === 0) {
        await readMine('mom', 1500);
        await C.typing('talk', 'mom', 6000);
        await say('mom', r.endReply1, 800);
        v.momEnd = 1;
      } else if (st === 1) {
        // share the scheduled mail card (replace the plain text bubble)
        const list = G.state.threads[K('talk', 'mom')] || [];
        const last = list[list.length - 1];
        if (last && last.from === 'me' && last.text === T(r.endShare)) {
          C.edit('talk', 'mom', last.id, { text: undefined, share: { title: '1년 뒤에 이 메일을 읽을 누군가에게', sub: '윤세아 · 예약 메일' } });
        }
        await readMine('mom', 1500);
        let mb = null;
        await C.typing('talk', 'mom', 10000);
        await say('mom', r.endReply2[0], 600);
        await sleep(2600);
        try { mb = G.audio.musicBox && G.audio.musicBox({ variant: 'warm' }); } catch (e) {}
        await say('mom', r.endReply2[1], 2400);
        await sleep(1800);
        await C.push('talk', 'mom', { img: r.endPhoto }, { typingMs: 2400 });
        await say('mom', r.endReply3, 2600);
        if (G.flag('momTold') || G.flag('momRead')) { await sleep(1200); await say('mom', r.endReply4, 3400); }
        v.momEnd = 2;
        G.flag('momEnding', true);
        G.bus.emit('talk:momEnding');
        void mb;
      }
    } finally { v.momEndBusy = 0; G.save(); const vw = openViews[K('talk', 'mom')]; vw && vw.chips(); }
  }
  TK.momEnding = momEnding;

  /* ---------- 엄마 first open: receipts vanish → her live messages → auto-declined 보이스톡 ---------- */
  TK.onOpen.mom = function (scr, firstRead) {
    if (!firstRead || G.flag('momRead')) return;
    G.flag('momRead', true);
    V().momSeq = 0; V().momSeqAt = G.state.playMs; G.save();
    setTimeout(runMomSeq, 1500);
  };
  let momRunning = false;
  async function runMomSeq() {
    if (momRunning) return;
    const v = V();
    if (!G.flag('momRead') || (v.momSeq || 0) >= 99 || G.flag('END')) return;
    momRunning = true;
    try {
      // +25 s (real) after reading, then wait for a safe zone
      while (G.state.playMs - (v.momSeqAt || 0) < 25000) await sleep(1000);
      const lines = R().momRead || [];
      while ((v.momSeq || 0) < lines.length) {
        await SD.waitSafe();
        await C.push('talk', 'mom', { text: lines[v.momSeq] }, { typingMs: v.momSeq === 0 ? 2400 : 1600 + Math.random() * 900, tone: 'mom' });
        v.momSeq = (v.momSeq || 0) + 1; G.save();
        await sleep(700);
      }
      if (v.momSeq === lines.length) {
        await sleep(1800);
        await SD.waitSafe();
        if (!(G.flag('M7') && !G.flag('END'))) await momIncoming();
        v.momSeq = lines.length + 1; G.save();
      }
      if (v.momSeq === lines.length + 1) {
        if (mirroring()) {
          await sleep(3000);
          const line = (G.BEATDATA && G.BEATDATA.momRead) || '엄마한테 연락하지 마.';
          const haru = G.state.threads[K('talk', 'haru')] || [];
          G.flag('haruThread', true);
          if (!haru.some((m) => m.text === line)) await C.push('talk', 'haru', { text: line }, { tone: 'him', typingMs: 1400 });
        }
        v.momSeq = 99; G.save();
      }
    } finally { momRunning = false; }
  }
  async function momIncoming() {
    const th = C.thread('talk', 'mom');
    const auto = mirroring();
    const v = vtScreen(th, { incoming: true, status: '보이스톡 수신 중…' });
    const ring = ringStart('mom');
    try { G.audio.sfx.buzz && G.audio.sfx.buzz([800, 400, 800, 400, 800]); } catch (e) {}
    let done = false;
    const finish = (type, label, cls) => {
      if (done) return; done = true;
      stopRing(ring);
      v.status(label, cls);
      G.audio.sfx.callEnd && G.audio.sfx.callEnd();
      C.push('talk', 'mom', { from: 'them', call: type }, { notify: false, silent: true });
      v.close(1300);
    };
    if (auto) {
      v.node.classList.add('locked');
      await sleep(8400); // two ring cycles
      v.decline.classList.add('pressed');
      await sleep(320);
      finish('declined', '통화 거절됨', 'red');
    } else {
      v.decline.addEventListener('click', () => finish('declined', '거절됨'));
      v.accept.addEventListener('click', () => { if (done) return; v.sub(netFree() ? '상대방이 통화를 종료했습니다.' : '관리자 네트워크에서 통화가 제한되었습니다.'); finish('missed', '통화 연결 실패', 'red'); });
      await sleep(8400);
      finish('missed', '부재중');
    }
    await sleep(1400);
  }
  // resume after reload
  setInterval(() => {
    try {
      const v = G.state.vars;
      if (G.flag('momRead') && (v.momSeq || 0) < 99 && G.flag('M1') && !momRunning && !(G.phone.isLocked && G.phone.isLocked())) runMomSeq();
    } catch (e) {}
  }, 3000);

  /* ---------- 관리실 slip (H5 / F2) ---------- */
  TK.slip = async function () {
    if (G.flag('managerSlip')) return;
    G.flag('managerSlip', true);
    const m = await C.push('talk', 'manager', { img: 'vault_haru_sleep', blur: 6, text: '아직 안 자네 ㅎ', slip: 1 }, { tone: 'friend' });
    await sleep(1200);
    C.edit('talk', 'manager', m.id, { deleted: true });
    await sleep(2600);
    await C.push('talk', 'manager', { text: (G.BEATDATA && G.BEATDATA.managerSorry) || '죄송합니다 잘못 보냈네요 ^^' }, { typingMs: 1600, tone: 'friend' });
  };

  /* ---------- {N} room: typing dots whenever the player types anywhere (mirroring, after F1, max 3) ---------- */
  G.bus.on('keyboard', (on) => {
    try {
      if (!on || !mirroring() || !G.flag('F1')) return;
      const v = G.state.vars;
      if ((v.haruTypeDots || 0) >= 3) return;
      v.haruTypeDots = (v.haruTypeDots || 0) + 1; G.save();
      setTimeout(() => C.typing('talk', 'haru', 4200), 900);
    } catch (e) {}
  });
  /* keep the composer above the in-game keyboard */
  G.bus.on('keyboard', (on) => {
    if (!on) return;
    requestAnimationFrame(() => {
      const kb = document.querySelector('.kb');
      const scr = document.getElementById('screen');
      if (kb && scr) scr.style.setProperty('--kbh', kb.offsetHeight + 'px');
      Object.values(openViews).forEach((v) => { if (v && v.scr && v.scr.isConnected) { const b = v.scr.body; setTimeout(() => b.scrollTo({ top: b.scrollHeight + 999, behavior: 'smooth' }), 60); } });
    });
  });
  /* F2: the 📞 in his room pulses once (next open) */
  G.bus.on('flag:F2', () => { G.state.vars.haruCallPulse = 1; G.save(); });
})();
