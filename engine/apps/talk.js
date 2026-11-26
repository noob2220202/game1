/* =========================================================
 * engine/apps/talk.js — shared chat renderer (G.chat) + 톡 app (logged-out, read-only) · owner: social
 * DESIGN §4.2 · §3.21 톡 · §3.20.1 / §9.4 '윤세아' room · ARCH §3.3 · §4.19 · §6.3
 *
 * Public API
 *   G.chat (social-internal, also used by engine/apps/moment.js):
 *     view(spec) → api      chat screen builder (skins 'moment' | 'talk'); api = { scr, add(m), set(list), update(m),
 *                           typing(on), setRead(id), setChips(list, onPick, onDismiss), setComposer(node), setBands(nodes),
 *                           fill(list, gapMs) → Promise, scrollEnd(smooth), rows }
 *       resolved message m = { id, from:'me'|'them', sys, text, t (Date|ms|'YYYY-MM-DD HH:MM'), time (label override),
 *                              img, vm, deleted, label, fail, read, name, avatar }   (text is already G.T-expanded / raw)
 *     T(s) · str(key) (G.e2.STR with an exact local fallback) · img(key) · parseT(t) · fmtK(d) · dayLabel(d) · avatar(spec, px)
 *     screen(o) (G.ui.screen fallback) · messages(kind, id) · push/edit/typing/open/list (thin, for ARCH §4.19 compatibility)
 *   G.talk = { open(thread), root(), relogin() }   · app 'talk' (open params {thread})
 * Bus emitted: 'chat:open' {thread} (톡 rooms: thread = 'talk:<id>')
 * Flags set: none. Storage: none (the ep1 save is read only inside G.STORY.talk.seaRoomMessages at room-open).
 * data-qa: talk.thread:<id> · talk.relogin · chat.msg:<id>
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.util || {};
  const el = U.el || function (tag, attrs, ...kids) {
    const m = String(tag).match(/^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i);
    const n = document.createElement((m && m[1]) || 'div');
    if (attrs != null && (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object')) { kids.unshift(attrs); attrs = null; }
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, v) => { if (t === '.') n.classList.add(v); else n.id = v; });
    if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v); else if (k === 'html') n.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v); else if (k === 'dataset') Object.assign(n.dataset, v); else n.setAttribute(k, v === true ? '' : v); }
    kids.flat(Infinity).forEach((c) => { if (c == null || c === false) return; n.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return n;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const C = (G.chat = G.chat || {});
  C.el = el;

  /* ---------------- text / strings ---------------- */
  // exact copies of ARCH §4.5 G.e2.STR (used only if core's e2.js is missing — partial builds)
  const STR0 = {
    sendFail: 'ⓘ 전송되지 않음', smsSent: '인증번호를 문자로 보냈습니다', unrestricted: '{MAKER_CONTACT}님을 제한 해제했습니다.',
    noReadReceipt: '상대방에게 읽음 표시가 전송되지 않습니다', restrictedNote: '이 계정은 제한되어 있습니다. 제한을 해제하면 메시지가 받은 메시지함으로 이동합니다.',
    restrictedBar: '제한한 계정입니다', newAcctSend: '새 계정을 보호하기 위해 일부 활동이 제한됩니다. 이 기기에서는 메시지를 보낼 수 없습니다.',
    newAcctLimit: '새 계정을 보호하기 위해 일부 활동이 제한됩니다.', activityTitle: '활동 제한',
    activity: '비정상적인 로그인 활동이 감지되어 12월 26일까지 게시물과 댓글을 올릴 수 없습니다. 메시지는 보낼 수 있습니다.',
    mailSync: '계정이 없어 동기화할 수 없습니다 · 마지막 동기화 2026.12.24 18:02', talkOut: '다른 기기에서 로그인되어 로그아웃되었습니다 · 2026.11.25',
    reqAccepted: '메시지 요청을 수락했습니다 · 오후 7:21', codeWrong: '인증번호가 일치하지 않습니다.', talkNoSend: '로그아웃 상태에서는 메시지를 보낼 수 없습니다.',
    mailNoOpen: '계정이 없어 열 수 없습니다', offline: '인터넷에 연결되어 있지 않습니다', seahOnly: 'seah_y님은 팔로우하는 계정의 메시지만 받습니다.',
    blockQ: '{MAKER_CONTACT}님을 차단할까요?', blocked: '차단한 계정입니다', reported: '신고해 주셔서 감사합니다.',
    noResultMoment: "'{q}'에 대한 결과가 없습니다.", unplayed: '재생 안 됨', loading: '불러오는 중…',
  };
  C.str = function (k) { const S = G.e2 && G.e2.STR; return (S && S[k]) || STR0[k] || ''; };
  function makerName() {
    try { if (G.e2 && G.e2.maker) return G.e2.maker(); } catch (e) {}
    const c = window.CONFIG || {};
    if (c.MAKER_CONTACT) return c.MAKER_CONTACT;
    return c.MAKER_NAME && c.MAKER_NAME !== '너의 친구' ? c.MAKER_NAME : '친구';
  }
  C.makerName = makerName;
  /* G.T is core's; this fallback only keeps a partial build readable */
  function localT(s) {
    s = String(s).replace(/\{\$(\w+)\}/g, (m, k) => C.str(k) || m);
    const name = ((window.CONFIG || {}).PLAYER_NAME) || '하루';
    const last = name.charCodeAt(name.length - 1) - 0xac00;
    const bat = last >= 0 && last <= 11171 && last % 28 !== 0;
    const J = { 야: bat ? '아' : '야', 아: bat ? '아' : '야', 가: bat ? '이' : '가', 는: bat ? '은' : '는', 를: bat ? '을' : '를', 랑: bat ? '이랑' : '랑', 이: bat ? '이' : '', 의: '의' };
    return s.replace(/\{MAKER_CONTACT\}/g, makerName()).replace(/\{MAKER_ID\}/g, (window.CONFIG || {}).MAKER_HANDLE || '')
      .replace(/\{N(야|아|가|는|를|랑|이|의)?\}/g, (m, j) => name + (j ? J[j] : ''))
      .replace(/\{(police|policeShort|court|mapoOrg|eunpyeongOrg|mapo|eunpyeong|mapoOffice|eunpyeongOffice)\}/g, (m, k) => ((G.STORY && G.STORY.names) || {})[k] || m);
  }
  C.T = function (s) {
    if (s == null) return '';
    if (typeof s !== 'string') return s;
    try { return G.T ? G.T(s) : localT(s); } catch (e) { return localT(s); }
  };
  const T = C.T;

  /* ---------------- images ---------------- */
  C.img = function (key) {
    if (!key) return '';
    try { if (G.e2 && G.e2.img) return G.e2.img(key); } catch (e) {}
    try { if (G.sd && G.sd.img) return G.sd.img(key); } catch (e) {}
    if (G.IMG && G.IMG[key]) return G.IMG[key];
    if (/[/.]/.test(key)) return key;
    return 'assets/img/' + key + (/^(p_|js_|m_|door_handle|icon)/.test(key) ? '.png' : '.jpg');
  };
  /** <img> inside a box; missing file → quiet grey box (no out-of-world error text — ARCH §7.4) */
  C.imgBox = function (key, cls, o) {
    o = o || {};
    const box = el('span.so2-imgbox' + (cls ? '.' + cls : ''));
    const url = C.img(key);
    if (!url) { box.classList.add('so2-noimg'); return box; }
    const im = new Image();
    im.alt = ''; im.draggable = false; im.decoding = 'async';
    if (o.pos) im.style.objectPosition = o.pos;
    if (o.zoom) { im.style.transform = 'scale(' + o.zoom + ')'; im.style.transformOrigin = o.pos || '50% 50%'; }
    im.onerror = () => { im.remove(); box.classList.add('so2-noimg'); };
    im.src = url;
    box.appendChild(im);
    return box;
  };

  /* ---------------- time ---------------- */
  C.parseT = function (t) {
    if (t == null || t === '') return null;
    if (t instanceof Date) return t;
    if (typeof t === 'number') return new Date(t);
    const m = String(t).match(/(\d+)-(\d+)-(\d+)(?:[ T](\d+):(\d+))?/);
    return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  };
  C.fmtK = function (d) {
    d = C.parseT(d); if (!d) return '';
    try { if (G.e2 && G.e2.fmtK) return G.e2.fmtK(d); } catch (e) {}
    const h = d.getHours();
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}`;
  };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  C.dayLabel = function (d) { d = C.parseT(d); return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일` : ''; };
  C.now = function () { try { return G.clock && G.clock.now ? G.clock.now() : new Date(2026, 11, 24, 23, 12); } catch (e) { return new Date(2026, 11, 24, 23, 12); } };
  /** list label: same in-game day → '오후 10:51', else '11월 24일' */
  C.whenLabel = function (t) {
    const d = C.parseT(t); if (!d) return '';
    const now = C.now();
    if (now - d < 24 * 3600e3 && now - d > -3600e3) return C.fmtK(d);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  /* ---------------- avatars ---------------- */
  const AV_BG = ['#8e9aaf', '#a3b18a', '#c9a27e', '#9d8cb5', '#7fa7b5', '#b58c8c'];
  /** spec: { img, initial, name, black, url } */
  C.avatar = function (spec, size) {
    spec = spec || {};
    const px = size || 40;
    const a = el('span.so2-av' + (spec.black ? '.black' : ''), { style: { width: px + 'px', height: px + 'px', fontSize: Math.round(px * 0.42) + 'px' }, 'aria-hidden': 'true' });
    if (spec.black) return a;
    const label = spec.initial || Array.from(T(spec.name || '') || '?')[0] || '?';
    let h = 0; for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    a.style.background = spec.bg || AV_BG[h % AV_BG.length];
    a.appendChild(el('span.so2-av-i', null, label));
    const url = spec.url || (spec.img ? C.img(spec.img) : '');
    if (url) {
      const im = new Image(); im.alt = ''; im.draggable = false;
      im.onload = () => a.appendChild(im);
      im.onerror = () => {};
      im.src = url;
    }
    return a;
  };
  C.makerAvatar = function (size) {
    let url = '';
    try { url = (G.e2 && G.e2.makerAvatar && G.e2.makerAvatar()) || ''; } catch (e) {}
    return C.avatar({ name: '{MAKER_CONTACT}', url, bg: '#9aa5b4' }, size);
  };

  /* ---------------- screens ---------------- */
  const BACK_SVG = '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  C.screen = function (o) {
    let scr = null;
    if (G.ui && G.ui.screen) { try { scr = G.ui.screen(o); } catch (e) { console.error('[social] ui.screen', e); } }
    if (!scr) {   // fallback = ep1 builder shape (node.body, node.head)
      const head = o.header === false ? null : el('header.sv-head', null,
        o.back === false ? el('span.sv-sp') : el('button.sv-back', { 'aria-label': '뒤로', 'data-qa': 'nav.back', html: BACK_SVG, onclick: () => G.phone && G.phone.back && G.phone.back() }),
        el('div.sv-titles', null, el('div.sv-title', null, o.title || ''), o.sub ? el('div.sv-sub', null, o.sub) : null), el('div.sv-right', null, o.right || []));
      const body = el('div.sv-body' + (o.bodyCls ? '.' + o.bodyCls : ''));
      if (o.body) body.appendChild(o.body);
      scr = el('section' + (o.cls ? '.' + o.cls.split(' ').join('.') : ''), { dataset: { theme: o.theme || 'light' } }, head, body, o.footer || null);
      scr.body = body; scr.head = head;
    }
    scr.dataset.status = o.theme === 'dark' ? 'light' : 'dark';   // dark status-bar text on our light screens
    return scr;
  };
  C.pushScreen = function (scr, opts) {
    if (G.phone && G.phone.push) return G.phone.push(scr, opts || {});
    const st = document.getElementById('app-stack') || document.body; st.appendChild(scr); return { node: scr };
  };
  C.tap = function () { try { G.audio && G.audio.sfx && G.audio.sfx.tap && G.audio.sfx.tap(); } catch (e) {} };

  /* ---------------- keyboard: keep the composer above the in-game keyboard ---------------- */
  function kbSync(on) {
    const scr = document.getElementById('screen'); if (!scr) return;
    if (!on) { scr.classList.remove('so2-kbopen'); return; }
    requestAnimationFrame(() => {
      const kb = document.querySelector('.kb');
      const h = kb ? kb.getBoundingClientRect().height : 0;
      scr.style.setProperty('--so2-kbh', Math.round(h || 260) + 'px');
      scr.classList.add('so2-kbopen');
      Object.values(views).forEach((v) => { if (v && v.scr && v.scr.isConnected) { setTimeout(() => v.scrollEnd(false), 40); setTimeout(() => v.scrollEnd(true), 320); } });
    });
  }
  if (G.bus && G.bus.on) G.bus.on('keyboard', (on) => kbSync(!!on));

  /* =========================================================
   * Chat view
   * ========================================================= */
  const views = {};   // key → api (open views, for keyboard scroll)
  let viewSeq = 0;
  function sameMinute(a, b) {
    const da = C.parseT(a.t), db = C.parseT(b.t);
    if (!da || !db) return !da && !db && a.time === b.time;
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
  }
  const dayKey = (m) => { const d = C.parseT(m.t); return d ? d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate() : null; };
  const INFO_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.5v6M12 7.4v.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const SEND_SVG = '<svg viewBox="0 0 24 24"><path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  C.SEND_SVG = SEND_SVG; C.INFO_SVG = INFO_SVG;
  function typingDots() { return el('span.so2-dots', null, el('i'), el('i'), el('i')); }
  C.typingDots = typingDots;

  C.view = function (spec) {
    spec = spec || {};
    const skin = spec.skin || 'moment';
    const key = 'v' + (++viewSeq);
    const body = el('div.so2-cbody');
    const bands = el('div.so2-bands');
    const chips = el('div.so2-chips');
    const compWrap = el('div.so2-compwrap');
    const footer = el('div.so2-cfoot', null, chips, compWrap);
    const scr = C.screen({ title: '', back: spec.back !== false, right: spec.right || [], cls: 'so2-chat so2-sk-' + skin + (spec.cls ? ' ' + spec.cls : ''), body, footer, bodyCls: 'so2-cscroll' });
    if (spec.qa) scr.dataset.qa = spec.qa;
    // title: avatar + name (+ badge) + sub — tap → spec.onTitle
    const tt = el(spec.onTitle ? 'button.so2-ch-title' : 'div.so2-ch-title', { onclick: spec.onTitle ? () => { C.tap(); spec.onTitle(); } : null },
      spec.avatar || null,
      el('span.so2-ch-tt', null, el('span.so2-ch-name', null, el('span.so2-ch-n', null, spec.title || ''), spec.badge ? el('span.so2-badge', null, spec.badge) : null),
        spec.sub ? el('span.so2-ch-sub', null, spec.sub) : null));
    const titles = scr.head && scr.head.querySelector('.sv-titles');
    if (titles) { titles.innerHTML = ''; titles.appendChild(tt); } else if (scr.head) scr.head.insertBefore(tt, scr.head.firstChild ? scr.head.firstChild.nextSibling : null);
    if (scr.body && scr.body.parentNode === scr) scr.insertBefore(bands, scr.body); else scr.appendChild(bands);
    if (!footer.parentNode) scr.appendChild(footer);
    const sc = scr.body || body;   // scroll container

    let lead = spec.lead ? el('div.so2-lead', null, spec.lead) : null;
    const tail = el('div.so2-tail', null, spec.tail || null);
    const list = el('div.so2-msgs');
    body.append(lead || '', list, tail);
    const rows = {};
    let last = null;
    let typingRow = null;

    function avatarFor(m) {
      if (!spec.avatarFor) return null;
      return spec.avatarFor(m);
    }
    function bubble(m) {
      if (spec.special) { const n = spec.special(m); if (n) return n; }
      if (m.deleted) return el('div.so2-bub.so2-deleted', null, el('i', { html: INFO_SVG }), m.label || '');
      if (m.img) {
        const b = el('div.so2-bub.so2-imgb', null, C.imgBox(m.img, 'so2-bimg'));
        return b;
      }
      return el('div.so2-bub', null, m.text || '');
    }
    function rowNode(m, prev) {
      const frag = document.createDocumentFragment();
      const dk = dayKey(m);
      if (dk != null && (!prev || dayKey(prev) !== dk)) frag.appendChild(el('div.so2-day', null, el('span', null, C.dayLabel(m.t))));
      if (m.sys) {
        const n = el('div.so2-sys', { 'data-qa': 'chat.msg:' + (m.id || '') }, m.sys);
        if (m.id) rows[m.id] = n;
        frag.appendChild(n);
        return frag;
      }
      const me = m.from === 'me';
      const dayBreak = dk != null && prev && dayKey(prev) !== dk;
      const first = !prev || prev.sys || prev.from !== m.from || dayBreak || !sameMinute(prev, m);
      const timeTxt = m.time || C.fmtK(m.t);
      const col = el('div.so2-col', null,
        !me && first && spec.names ? el('div.so2-name', null, m.name || spec.title || '') : null,
        bubble(m),
        m.fail ? el('div.so2-fail', null, C.str('sendFail')) : null);
      const row = el('div.so2-row' + (me ? '.me' : '') + (first ? '.first' : ''), { 'data-qa': 'chat.msg:' + (m.id || ''), dataset: { mid: m.id || '' } },
        !me && spec.avatarFor ? (first ? avatarFor(m) : el('span.so2-avsp')) : null,
        col,
        first && timeTxt ? el('span.so2-time', null, timeTxt) : null);
      if (m.id) rows[m.id] = row;
      frag.appendChild(row);
      return frag;
    }
    function add(m, o) {
      o = o || {};
      const nb = nearBottom();
      list.appendChild(rowNode(m, last));
      last = m;
      if (typingRow) list.appendChild(typingRow);
      if (m.read) api.setRead(m.id);
      if (o.scroll !== false && (nb || m.from === 'me' || o.force)) scrollEnd(o.smooth !== false);
    }
    function set(arr) {
      list.innerHTML = ''; last = null;
      Object.keys(rows).forEach((k) => delete rows[k]);
      let lastRead = null;
      (arr || []).forEach((m) => { list.appendChild(rowNode(m, last)); last = m; if (m.from === 'me' && m.read) lastRead = m.id; });
      if (typingRow) list.appendChild(typingRow);
      if (lastRead) api.setRead(lastRead);
    }
    function update(m) {
      const old = rows[m.id]; if (!old) return;
      const col = old.querySelector('.so2-col');
      if (!col) return;
      const f = col.querySelector('.so2-fail');
      if (m.fail && !f) col.appendChild(el('div.so2-fail', null, C.str('sendFail')));
      if (!m.fail && f) f.remove();
      if (m.read) api.setRead(m.id);
    }
    function nearBottom() { return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160; }
    function scrollEnd(smooth) {
      try { sc.scrollTo({ top: sc.scrollHeight + 999, behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { sc.scrollTop = sc.scrollHeight; }
    }
    const api = {
      key, scr, body, rows, add, set, update, scrollEnd,
      typing(on) {
        if (on && !typingRow) {
          typingRow = el('div.so2-row.first.so2-typing', null, spec.avatarFor ? avatarFor({ from: 'them' }) : null, el('div.so2-col', null, el('div.so2-bub.so2-tybub', null, typingDots())));
          const nb = nearBottom();
          list.appendChild(typingRow);
          if (nb) scrollEnd(true);
        } else if (!on && typingRow) { typingRow.remove(); typingRow = null; }
      },
      setRead(id) {
        list.querySelectorAll('.so2-read').forEach((n) => n.remove());
        const r = id && rows[id]; if (!r) return;
        const col = r.querySelector('.so2-col');
        if (col) col.appendChild(el('div.so2-read', null, spec.readLabel || '읽음'));
      },
      setChips(arr, onPick, onDismiss) {
        chips.innerHTML = '';
        (arr || []).forEach((c) => {
          if (c.kind === 'button') {
            chips.appendChild(el('button.so2-chip.so2-chip-alt', { 'data-qa': c.qa || 'chat.chip', onclick: () => { C.tap(); c.onClick && c.onClick(); } }, c.text));
            return;
          }
          const b = el('button.so2-chip', { 'data-qa': 'chat.chip', dataset: { chip: c.key }, onclick: () => { C.tap(); onPick && onPick(c); } }, el('span', null, c.text), el('i.so2-pen', { 'aria-hidden': 'true' }, '✎'));
          chips.appendChild(b);
          if (c.dismiss) chips.appendChild(el('button.so2-chip.so2-chip-x', { 'data-qa': 'chat.chip.dismiss', onclick: () => { C.tap(); onDismiss && onDismiss(c); } }, c.dismissLabel || ''));
        });
        chips.classList.toggle('in', chips.childNodes.length > 0);
      },
      setComposer(node) { compWrap.innerHTML = ''; if (node) compWrap.appendChild(node); },
      setBands(nodes) { bands.innerHTML = ''; (nodes || []).filter(Boolean).forEach((n) => bands.appendChild(n)); },
      setLead(node) { if (lead) lead.remove(); lead = node ? el('div.so2-lead', null, node) : null; if (lead) body.insertBefore(lead, list); },
      setTail(node) { tail.innerHTML = ''; if (node) tail.appendChild(node); },
      /** append messages one by one (N09 fill — 0.12 s) */
      fill(arr, gap) {
        return new Promise((res) => {
          let i = 0;
          const step = () => { if (i >= arr.length || !scr.isConnected) { res(); return; } add(arr[i++], { force: true, smooth: false }); setTimeout(step, gap || 120); };
          step();
        });
      },
      close() { delete views[key]; },
    };
    views[key] = api;
    return api;
  };
  C.views = views;

  /* thin ARCH §4.19 compatibility layer (kind 'moment' is handled by engine/apps/moment.js) */
  C.messages = function (kind, id) {
    if (kind === 'moment' && G.moment && G.moment.messages) return G.moment.messages(id);
    if (kind === 'talk') { const th = TK.thread(id); return th ? TK.messagesOf(th) : []; }
    return [];
  };
  C.push = function (kind, id, msg, opts) { if (kind === 'moment' && G.moment && G.moment.push) return G.moment.push(id, msg, opts); return Promise.resolve(null); };
  C.typing = function (kind, id, ms) { if (kind === 'moment' && G.moment && G.moment.typing) return G.moment.typing(id, ms); return Promise.resolve(); };
  C.edit = function () { return null; };
  C.open = function (kind, id) { if (kind === 'moment' && G.moment) return G.moment.open({ thread: id }); if (kind === 'talk') return TK.open(id); return null; };
  C.list = function (kind) { if (kind === 'talk') return TK.root(); if (kind === 'moment' && G.moment) return G.moment.open({ tab: 'messages' }); return null; };

  /* =========================================================
   * 톡 — logged out (§4.2)
   * ========================================================= */
  const TK = (G.talk = G.talk || {});
  const TD = () => (G.STORY && G.STORY.talk) || { threads: [] };
  TK.thread = (id) => (TD().threads || []).find((t) => t.id === id);
  TK.messagesOf = function (th) {
    let arr = [];
    try { arr = typeof th.messages === 'function' ? th.messages() : th.messages || []; } catch (e) { console.error('[social] talk messages', e); arr = []; }
    return arr.map((m, i) => ({
      id: m.id || th.id + ':' + i, from: m.from === 'me' ? 'me' : 'them', t: m.t, time: m.time,
      text: m.e1 ? String(m.text || '') : T(m.text || ''), deleted: !!m.deleted, label: m.label ? T(m.label) : '',
    }));
  };
  function talkAvatar(th, px) {
    if (th.avatar === 'maker') return C.makerAvatar(px);
    return C.avatar({ img: th.avatar, initial: th.initial, name: th.name }, px);
  }
  function banner(withButton) {
    const d = TD();
    return el('div.so2-tk-banner', { role: 'status' },
      el('span.so2-tk-bi', { html: INFO_SVG }),
      el('span.so2-tk-bt', null, T(d.banner || '{$talkOut}')),
      withButton ? el('button.so2-tk-relog', { 'data-qa': 'talk.relogin', onclick: () => { C.tap(); TK.relogin(); } }, T(d.relogLabel || '다시 로그인')) : null);
  }
  TK.root = function () {
    const d = TD();
    const listEl = el('div.so2-tk-list');
    (d.threads || []).forEach((th) => {
      listEl.appendChild(el('button.so2-tk-row', { 'data-qa': 'talk.thread:' + th.id, onclick: () => { C.tap(); TK.open(th.id); } },
        talkAvatar(th, 48),
        el('span.so2-tk-main', null, el('span.so2-tk-name', null, T(th.name)), el('span.so2-tk-prev', null, T(th.preview || ''))),
        el('span.so2-tk-when', null, T(th.day || ''))));
    });
    const body = el('div', null, banner(true), listEl, el('div.so2-tk-foot', null, T(d.listFoot || '')));
    const scr = C.screen({ title: (G.apps && G.apps.talk && G.apps.talk.name) || '톡', back: true, body, cls: 'so2-tk so2-tk-root' });
    C.pushScreen(scr, { appId: 'talk' });
    return scr;
  };
  TK.open = function (id) {
    const th = TK.thread(id); if (!th) return null;
    const msgs = TK.messagesOf(th);
    const api = C.view({
      skin: 'talk', title: T(th.name), names: true, readLabel: '',
      avatarFor: () => talkAvatar(th, 38),
      lead: th.head ? el('div.so2-note', null, T(th.head)) : null,
      tail: th.foot ? el('div.so2-note', null, T(th.foot)) : null,
      qa: 'talk.room:' + id,
    });
    api.setBands([banner(true)]);
    api.set(msgs);
    api.setComposer(el('div.so2-compband', null, T(TD().noSend || '{$talkNoSend}')));
    C.pushScreen(api.scr, { anim: 'slide', onClose: () => api.close() });
    requestAnimationFrame(() => api.scrollEnd(false));
    setTimeout(() => api.scrollEnd(false), 60);
    if (G.bus) G.bus.emit('chat:open', { thread: 'talk:' + id });
    return api.scr;
  };
  TK.relogin = function () {
    const r = TD().relogin || {};
    const msg = el('div.so2-tk-err');
    let field = null;
    const submit = () => { C.tap(); if (field) field.clear(); msg.textContent = T(r.wrong || '{$codeWrong}'); try { G.audio && G.audio.sfx && G.audio.sfx.error && G.audio.sfx.error(); } catch (e) {} };
    if (G.ui && G.ui.field) {
      field = G.ui.field({ placeholder: T(r.field || '인증번호 6자리'), mode: 'en', ctx: 'smsCode', predict: false, numRow: true, maxLength: 6, submitLabel: T(r.submit || '확인'), onSubmit: submit, onChange: () => { msg.textContent = ''; }, qa: 'talk.code' });
      field.node.classList.add('so2-tk-field');
      field.node.dataset.qa = 'talk.code';
    }
    const body = el('div.so2-tk-login', null,
      el('div.so2-tk-sent', null, T(r.sent || '{$smsSent}')),
      field ? field.node : null,
      el('div.so2-tk-grey', null, T(r.grey || 'SIM 없음')),
      msg,
      el('button.so2-btn.primary.so2-tk-ok', { 'data-qa': 'talk.code.ok', onclick: submit }, T(r.submit || '확인')));
    const scr = C.screen({ title: T(r.title || '휴대전화 번호로 로그인'), body: el('div', null, banner(false), body), cls: 'so2-tk' });
    C.pushScreen(scr, { anim: 'slide', onClose: () => { try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} } });
    return scr;
  };

  if (G.app) {
    G.app('talk', {
      name: '톡',
      icon: G.ICONS && G.ICONS.talk,
      badge: () => 0,   // all of {MAKER}'s three messages are already read — he read them (§4.2)
      open(p) {
        TK.root();
        if (p && p.thread && TK.thread(p.thread)) TK.open(p.thread);
      },
    });
  }
})();
