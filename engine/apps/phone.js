/* =========================================================
 * 전화 (owner: media) — DESIGN §4.7.2 · §4.7.1 [긴급 통화] · §4.0 실패 문구 · §5.1 독 `전화`.
 * No SIM: 키패드 → any number `SIM 없음 · 전화를 걸 수 없습니다` (G.e2.STR.noSimCall),
 *         112 · 119 · 1366 → `SIM 없음 · 긴급 통화를 연결할 수 없습니다` (STR.noSimEmergency).
 * `최근 기록` → `최근 기록 없음` · `연락처` → `연락처 없음` / `계정이 없습니다`. No SMS app, no call UI.
 * Lock-screen [긴급 통화] → hook 'phone:emergency' → emergency dialer overlay (above the lock layer).
 *
 * This file also defines G.mdu — the small helper set shared by every media file
 * (gallery recorder clock browser memo calendar alerts). It is the first media file in the
 * ARCH §2.1 load order; later media files only read it.
 *
 * Public API : G.phoneApp = { emergency(), call(number) }
 * Hooks      : sets 'phone:emergency'
 * App ids    : phone        data-qa: dial.key:<d> · dial.call
 * Data       : G.STORY.dial (ep2/js/data/phone.js)
 *
 * ep3: owner comms (ARCH_EP3 §3.1). G.STORY.dial.sim === true (ep3/js/data/dial.js) switches to the standard phone of
 * 엄마's phone — see the 'ep3 (owner: comms)' block at the end of this file. G.mdu stays frozen (additive only); the ep2
 * SIM-less dialer above is byte-for-byte the same when the marker is absent.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  if (!G.util || !G.util.el) { console.error('[media] G.util missing (engine/core/base.js)'); return; }

  /* =========================================================
   * G.mdu — media shared helpers (no cross-owner calls at load time)
   * ========================================================= */
  const MU = (G.mdu = G.mdu || {});
  const elf = function (tag, attrs, ...ch) { return G.util.el(tag, attrs, ...ch); };
  MU.el = elf;
  // system strings: G.e2.STR first (core whitelist), these are the DESIGN-verbatim fallbacks
  const STR_FB = {
    ghost: '원본을 불러올 수 없습니다 · 계정 없음', tlNone: '이 날짜에는 기록이 없습니다', tlPaused: '이 시간에는 위치 기록이 일시 중지되었습니다',
    noResult: "'{q}'에 대한 검색 결과가 없습니다.", noSimCall: 'SIM 없음 · 전화를 걸 수 없습니다', noSimEmergency: 'SIM 없음 · 긴급 통화를 연결할 수 없습니다',
    cloudLogin: '다온 클라우드 · 로그인이 필요합니다', newDeviceCode: '새 기기에서 로그인하려면 문자로 받은 인증 코드가 필요합니다',
    smsSent: '인증번호를 문자로 보냈습니다', loading: '불러오는 중…', offline: '인터넷에 연결되어 있지 않습니다',
  };
  MU.STR = (k) => (G.e2 && G.e2.STR && G.e2.STR[k]) || STR_FB[k] || '';
  /** text expansion: {$key} (system strings) first, then G.T (name / player / maker tokens) */
  MU.T = function (s) {
    if (typeof s === 'function') { try { s = s(MU.cb); } catch (e) { console.error('[media] T', e); s = ''; } }
    if (typeof s !== 'string') return s == null ? '' : String(s);
    s = s.replace(/\{\$([a-zA-Z0-9_]+)\}/g, (m, k) => MU.STR(k) || m);
    if (G.T) { try { return G.T(s); } catch (e) { console.error('[media] G.T', e); } }
    const N = (G.STORY && G.STORY.names) || {};
    return s.replace(/\{([a-zA-Z]+)\}/g, (m, k) => (N[k] != null ? N[k] : m));
  };
  MU.img = function (key) {
    if (!key) return '';
    try { if (G.e2 && G.e2.img) { const u = G.e2.img(key); if (u) return u; } } catch (e) {}
    return (G.IMG && G.IMG[key]) || '';
  };
  MU.cb = function (key) { try { return G.e2 && G.e2.cb ? G.e2.cb(key) : null; } catch (e) { return null; } };
  MU.F = (n) => (G.F && G.F[n]) || n;
  MU.flag = function (n, v) { return v === undefined ? !!(G.flag && G.flag(MU.F(n))) : G.flag && G.flag(MU.F(n), v); };
  MU.user = function () { try { if (G.users && G.users.current) return G.users.current(); } catch (e) {} return (G.state && G.state.vars && G.state.vars.user) || 'n'; };
  MU.md = function () { const v = G.state && G.state.vars; const m = v && v.md; return m && typeof m === 'object' ? m : {}; };
  /** owner-private persisted state vars.md (never free text, never G.T output) */
  MU.mdSet = function (patch) {
    const next = Object.assign({}, MU.md(), patch);
    if (G.vars) G.vars('md', next); else if (G.state) { G.state.vars.md = next; G.save && G.save(); }
    return next;
  };
  MU.sfx = function (n) { try { const f = G.audio && G.audio.sfx && G.audio.sfx[n]; if (f) f(); } catch (e) {} };
  MU.toast = function (t, ms) { try { G.phone && G.phone.toast && G.phone.toast(t, ms); } catch (e) { console.error('[media] toast', e); } };
  MU.emit = function (ev, d) { try { G.bus && G.bus.emit(ev, d); } catch (e) {} };
  MU.on = function (ev, fn) { return G.bus && G.bus.on ? G.bus.on(ev, fn) : () => {}; };
  MU.qa = function (node, v) { if (node && v) node.setAttribute('data-qa', v); return node; };
  MU.pad = (n) => String(n).padStart(2, '0');
  MU.now = function () { try { if (G.clock && G.clock.now) return G.clock.now(); } catch (e) {} return new Date(2026, 11, 24, 23, 12); };
  /** '05:39' → '오전 5:39' (G.e2.fmt12 when present) */
  MU.fmt12 = function (hm) {
    try { if (G.e2 && G.e2.fmt12) { const r = G.e2.fmt12(hm); if (r) return r; } } catch (e) {}
    const m = String(hm || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return '';
    const h = +m[1]; return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m[2]}`;
  };
  MU.fmtK = function (d) { return MU.fmt12(`${d.getHours()}:${MU.pad(d.getMinutes())}`); };
  /** 'YYYY-MM-DD HH:MM' → Date (in-game, local) */
  MU.parseT = function (t) { const m = String(t || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; };
  MU.fmtDur = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${MU.pad(s % 60)}`; };
  MU.WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  /** standard screen (shell G.ui.screen; minimal fallback so partial builds still render) */
  MU.screen = function (o) {
    let node;
    if (G.ui && G.ui.screen) node = G.ui.screen(o);
    else {
      const head = o.header === false ? null : elf('header.sv-head', null,
        o.back === false ? elf('span.sv-sp') : elf('button.sv-back', { 'aria-label': '뒤로', 'data-qa': 'nav.back', onclick: () => G.phone && G.phone.back && G.phone.back() }, '‹'),
        elf('div.sv-titles', null, elf('div.sv-title', null, o.title || ''), o.sub ? elf('div.sv-sub', null, o.sub) : null),
        elf('div.sv-right', null, o.right || []));
      const body = elf('div.sv-body' + (o.bodyCls ? '.' + o.bodyCls : ''), null, o.body || null);
      node = elf('section' + (o.cls ? '.' + o.cls.split(' ').join('.') : ''), { dataset: { theme: o.theme || 'light' } }, head, body, o.footer || null);
      node.body = body; node.head = head;
    }
    node.classList.add('md2-scr');
    node.dataset.status = o.theme === 'dark' ? 'light' : 'dark';   // status-bar text colour (dark = dark text)
    return node;
  };
  MU.setTitle = function (scr, title, sub) {
    const t = scr.querySelector('.sv-title'); if (t) t.textContent = title || '';
    const titles = scr.querySelector('.sv-titles'); if (!titles) return;
    let s = titles.querySelector('.sv-sub');
    if (sub) { if (!s) { s = elf('div.sv-sub'); titles.appendChild(s); } s.textContent = sub; } else if (s) s.remove();
  };
  MU.push = function (node, opts) {
    if (G.phone && G.phone.push) return G.phone.push(node, opts || {});
    const host = document.getElementById('screen'); if (host) host.appendChild(node); return { node };
  };
  MU.back = function () { if (G.phone && G.phone.back) G.phone.back(); };
  MU.isTop = function (scr) { try { const t = G.phone && G.phone.top && G.phone.top(); return !!(t && t.node === scr) && scr.isConnected; } catch (e) { return false; } };
  /** a header icon button */
  MU.iconBtn = function (svg, label, qa, fn) {
    const b = elf('button.md2-hbtn', { 'aria-label': label, html: svg, type: 'button' });
    MU.qa(b, qa);
    b.addEventListener('click', (e) => { e.stopPropagation(); MU.sfx('tap'); fn && fn(e); });
    return b;
  };
  /** '—' screens and the evidence recordings: long-press / context menu does nothing */
  MU.noMenu = function (node) { node.addEventListener('contextmenu', (e) => e.preventDefault()); return node; };
  /** <img> that degrades to the in-world grey cell (never an error text) */
  MU.imgEl = function (key, cls, onMissing) {
    const src = MU.img(key);
    const i = elf('img' + (cls ? '.' + cls : ''), { alt: '', draggable: 'false', decoding: 'async', loading: 'lazy' });
    const miss = () => { i.classList.add('md2-miss'); i.removeAttribute('src'); onMissing && onMissing(i); };
    i.addEventListener('error', miss);
    if (src) i.src = src; else setTimeout(miss, 0);
    return i;
  };
  /** free-text store (sessionStorage via core; memory fallback) — never in the save */
  const memSess = {};
  MU.sessGet = function (k) { try { if (G.e2 && G.e2.session) { const v = G.e2.session.get(k); return v == null ? null : v; } } catch (e) {} return memSess[k] != null ? memSess[k] : null; };
  MU.sessSet = function (k, v) { memSess[k] = v; try { if (G.e2 && G.e2.session) G.e2.session.set(k, v); } catch (e) {} };
  /** normalise for matching (G.e2.norm when present) */
  MU.norm = function (s) {
    try { if (G.e2 && G.e2.norm) return G.e2.norm(s); } catch (e) {}
    let t = String(s || '').normalize('NFC').trim();
    try { t = t.replace(/[\s\p{P}\p{S}]/gu, ''); } catch (e) { t = t.replace(/[\s.,!?'"~\-–—·:;()[\]{}<>/\\|@#$%^&*+=_`]/g, ''); }
    return t.toLowerCase();
  };
  MU.ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowBack: '<svg viewBox="0 0 24 24"><path d="M20 12H5M11 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="18.5" r="1.9" fill="currentColor"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v6M12 7.6v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.8l1.6 2.4 2.8-.7.7 2.8 2.4 1.6-1.3 2.6 1.3 2.6-2.4 1.6-.7 2.8-2.8-.7L12 21.2l-1.6-2.4-2.8.7-.7-2.8-2.4-1.6L5.8 12 4.5 9.4l2.4-1.6.7-2.8 2.8.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a.8.8 0 001.2.7l10.6-6.8a.8.8 0 000-1.4L9.2 4.5A.8.8 0 008 5.2z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.8a4.5 4.5 0 010 6.4M18 6.4a8 8 0 010 11.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    loop: '<svg viewBox="0 0 24 24"><path d="M4 12V9.5A3.5 3.5 0 017.5 6H18m0 0l-3-3m3 3l-3 3M20 12v2.5a3.5 3.5 0 01-3.5 3.5H6m0 0l3 3m-3-3l3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cloudOff: '<svg viewBox="0 0 24 24"><path d="M7 18h10.5a3.5 3.5 0 00.6-6.95A5.5 5.5 0 007.6 9.2 4.4 4.4 0 007 18z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5M12 3.5C9.4 5.9 8.4 8.8 8.4 12s1 6.1 3.6 8.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  /** in-screen bottom panel (info sheets) — lives inside the screen, closes on back */
  MU.panel = function (host, rows, o) {
    o = o || {};
    const panel = elf('div.md2-panel' + (o.cls ? '.' + o.cls : ''), null, elf('i.md2-grab'),
      o.title ? elf('div.md2-panel-h', null, o.title) : null,
      rows.map((r) => (Array.isArray(r)
        ? elf('div.md2-pi', null, elf('span.md2-pi-k', null, MU.T(r[0])), r[1] ? elf('span.md2-pi-v', null, MU.T(r[1])) : null)
        : elf('div.md2-pi.one', null, MU.T(r)))));
    host.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('in'));
    let removeBack = null;
    const api = { node: panel, open: true, close() { if (!api.open) return; api.open = false; if (removeBack) removeBack(); panel.classList.remove('in'); setTimeout(() => panel.remove(), 260); o.onClose && o.onClose(); } };
    try { if (G.phone && G.phone.pushBack) removeBack = G.phone.pushBack(() => { if (!api.open || !panel.isConnected) return false; api.close(); return true; }); } catch (e) {}
    let sy = null;
    panel.addEventListener('pointerdown', (e) => { sy = e.clientY; });
    panel.addEventListener('pointerup', (e) => { if (sy != null && e.clientY - sy > 40) api.close(); sy = null; });
    return api;
  };
  /** small dropdown menu anchored top-right inside a screen */
  MU.menu = function (scr, items) {
    const wrap = elf('div.md2-menu-wrap');
    const box = elf('div.md2-menu', null, items.map((it) => {
      const b = elf('button.md2-menu-i', { type: 'button' }, MU.T(it.label));
      MU.qa(b, it.qa);
      b.addEventListener('click', (e) => { e.stopPropagation(); MU.sfx('tap'); close(); it.onClick && it.onClick(); });
      return b;
    }));
    wrap.appendChild(box);
    let removeBack = null, open = true;
    function close() { if (!open) return; open = false; if (removeBack) removeBack(); wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 180); }
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    scr.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    try { if (G.phone && G.phone.pushBack) removeBack = G.phone.pushBack(() => { if (!open || !wrap.isConnected) return false; close(); return true; }); } catch (e) {}
    return { close };
  };
  /** grey toggle switch (md2-tg) */
  MU.toggle = function (on, qa, fn) {
    const t = elf('button.md2-tg' + (on ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false' });
    MU.qa(t, qa);
    t.addEventListener('click', (e) => { e.stopPropagation(); const v = !t.classList.contains('on'); t.classList.toggle('on', v); t.setAttribute('aria-checked', v ? 'true' : 'false'); MU.sfx('tap'); fn && fn(v); });
    return t;
  };
  MU.debug = function () { return !!G.DEBUG; };
  /** app registration guarded for partial builds (shell's G.app missing → kept for later, no throw) */
  MU.app = function (id, def) {
    if (typeof G.app === 'function') { try { G.app(id, def); } catch (e) { console.error('[media] G.app', id, e); } }
    else { (G.pendingApps = G.pendingApps || []).push([id, def]); console.warn('[media] G.app missing — deferred', id); }
  };

  /* =========================================================
   * 전화 app
   * ========================================================= */
  const D = () => (G.STORY && G.STORY.dial) || { status: 'SIM 없음', tabs: [['keypad', '키패드'], ['recent', '최근 기록'], ['contacts', '연락처']], recentsEmpty: '최근 기록 없음', contactsEmpty: ['연락처 없음', '계정이 없습니다'], emergencyTitle: '긴급 통화', emergencyNumbers: ['112', '119', '1366'] };
  const el = MU.el;
  const PH = (G.phoneApp = G.phoneApp || {});
  const IC = {
    keypad: '<svg viewBox="0 0 24 24">' + [6, 12, 18].map((x) => [4.5, 10, 15.5].map((y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor"/>`).join('')).join('') + '<circle cx="12" cy="21" r="1.9" fill="currentColor"/></svg>',
    recent: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    contacts: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>',
    sim: '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  const SUBS = { '1': '', '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '*': '', '0': '+', '#': '' };
  const digits = (n) => String(n || '').replace(/[^\d*#+]/g, '');

  /** any call attempt (no SIM) — real-phone failure text only, never a hint */
  PH.call = function (number, opts) {
    const n = digits(number);
    if (!n) { MU.sfx('error'); return false; }
    const em = (opts && opts.emergency) || D().emergencyNumbers.includes(n);
    MU.sfx('error');
    MU.toast(MU.STR(em ? 'noSimEmergency' : 'noSimCall'));
    return false;
  };

  function keypad(o) {
    o = o || {};
    let n = '';
    const numEl = el('div.md2-dial-num');
    const del = el('button.md2-dial-del', { type: 'button', 'aria-label': '지우기', html: IC.del });
    function upd() { numEl.textContent = n; numEl.classList.toggle('long', n.length > 12); del.style.visibility = n ? 'visible' : 'hidden'; }
    function press(k) { if (n.length < 20) n += k; MU.sfx('key'); upd(); }
    const pad = el('div.md2-dial-pad', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => {
      const b = el('button.md2-dial-key', { type: 'button', 'aria-label': k }, el('b', null, k), el('small', null, SUBS[k]));
      MU.qa(b, 'dial.key:' + k);
      b.addEventListener('click', () => press(k));
      return b;
    }));
    del.addEventListener('click', () => { n = n.slice(0, -1); MU.sfx('tap'); upd(); });
    del.addEventListener('contextmenu', (e) => e.preventDefault());
    let lpT = null;
    del.addEventListener('pointerdown', () => { clearTimeout(lpT); lpT = setTimeout(() => { n = ''; upd(); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => del.addEventListener(ev, () => clearTimeout(lpT)));
    const go = el('button.md2-dial-go', { type: 'button', 'aria-label': '통화', html: IC.call });
    MU.qa(go, 'dial.call');
    go.addEventListener('click', () => { PH.call(n, { emergency: o.emergency }); });
    upd();
    const node = el('div.md2-kp', null,
      el('div.md2-kp-sim', { html: IC.sim + `<span>${MU.T(D().status)}</span>` }),
      numEl, pad, el('div.md2-dial-call', null, el('span.md2-sp'), go, del));
    // desktop: physical digits / Backspace / Enter while this keypad is the visible top
    node.keyHandler = function (e) {
      if (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen()) return false;
      if (/^[0-9*#]$/.test(e.key)) { press(e.key); return true; }
      if (e.key === 'Backspace') { n = n.slice(0, -1); upd(); return true; }
      if (e.key === 'Enter') { go.click(); return true; }
      return false;
    };
    return node;
  }

  function emptyBlock(lines) { return el('div.md2-empty', null, el('span.md2-empty-ic', { html: IC.recent }), lines.map((t, i) => el(i ? 'small' : 'b', null, MU.T(t)))); }

  let lastTab = 'keypad';
  MU.app('phone', {
    name: '전화',
    icon: (G.ICONS && G.ICONS.phone) || { bg: 'linear-gradient(160deg,#4cd964,#1fae44)', svg: IC.call },
    badge: () => 0,
    open(p) {
      p = p || {};
      if (SIM()) { E3.open(p); return; }   // ep3 standard phone (G.STORY.dial.sim === true) — ep2 never sets it
      if (p.emergency) { PH.emergency(); return; }
      let tab = p.tab || lastTab;
      const body = el('div.md2-ph-body');
      const tabs = el('nav.md2-tabs');
      const scr = MU.screen({ title: '', cls: 'md2-ph', body, footer: tabs });
      let kp = null;
      function render() {
        lastTab = tab;
        body.innerHTML = ''; tabs.innerHTML = '';
        D().tabs.forEach(([k, l]) => {
          const b = el('button.md2-tab' + (tab === k ? '.on' : ''), { type: 'button', html: IC[k] + `<span>${MU.T(l)}</span>` });
          b.addEventListener('click', () => { if (tab === k) return; MU.sfx('tap'); tab = k; render(); });
          tabs.appendChild(b);
        });
        MU.setTitle(scr, MU.T((D().tabs.find((t) => t[0] === tab) || [])[1] || ''));
        kp = null;
        if (tab === 'keypad') { kp = keypad(); body.appendChild(kp); }
        if (tab === 'recent') body.appendChild(emptyBlock([D().recentsEmpty]));
        if (tab === 'contacts') body.appendChild(emptyBlock(D().contactsEmpty));
      }
      render();
      const onKey = (e) => { if (kp && MU.isTop(scr) && kp.keyHandler(e)) e.preventDefault(); };
      document.addEventListener('keydown', onKey);
      MU.push(scr, { onClose: () => document.removeEventListener('keydown', onKey) });
    },
  });

  /** lock-screen [긴급 통화] dialer — an overlay so it sits above the lock layer (ARCH §2.3 #overlays) */
  let emOpen = null;
  PH.emergency = function () {
    if (SIM()) { E3.emergency(); return; }
    if (emOpen) return;
    const kp = keypad({ emergency: true });
    const head = el('div.md2-em-head', null,
      MU.iconBtn(MU.ICON.back, '뒤로', 'nav.back', () => close()),
      el('b', null, MU.T(D().emergencyTitle)));
    const node = el('div.md2-em', { dataset: { theme: 'light' } }, head, kp);
    let ov = null;
    const onKey = (e) => { if (emOpen && kp.keyHandler(e)) e.preventDefault(); };
    const theme = (t) => { try { G.phone && G.phone.statusTheme && G.phone.statusTheme(t); } catch (e) {} };
    function close() {
      if (!emOpen) return; emOpen = null;
      document.removeEventListener('keydown', onKey);
      let top = null; try { top = G.phone && G.phone.top && G.phone.top(); } catch (e) {}
      theme(G.phone && G.phone.isLocked && G.phone.isLocked() ? 'light' : (top && top.node && top.node.dataset.status) || 'light');
      if (ov && ov.close) ov.close(); else node.remove();
    }
    if (G.phone && G.phone.overlay) ov = G.phone.overlay(node, { onBack: close });
    else { const host = document.getElementById('screen'); if (host) host.appendChild(node); requestAnimationFrame(() => node.classList.add('in')); }
    emOpen = { close };
    theme('dark');
    document.addEventListener('keydown', onKey);
  };
  if (G.hooks && G.hooks.set) G.hooks.set('phone:emergency', () => PH.emergency());

  /* =========================================================
   * ep3 (owner: comms) — the standard phone of 엄마's phone. Active only when G.STORY.dial.sim === true (ep3 data);
   * ep2 (SIM-less dialer above) and G.mdu are untouched (ARCH_EP3 §4.2 apps/phone.js).
   * DESIGN_EP3 §3.2.3 · §3.8 (03:31) · §3.20.2 · §4.3.1 · §4.3.2 · §4.3.7 · §5.2 전화 · §5.8 · ARCH_EP3 §5.10.
   *
   * G.phoneApp (ep3 additions) = {
   *   init(), open({ tab:'pad'|'recent'|'contacts', contact, recentId }),
   *   dial(numberOrContactId, { from:'pad'|'contact'|'recent'|'detail'|'lock'|'easy', big }) → Promise  — the single entry
   *       point for every call (standard · lock 긴급 통화 · easymode E3). Results = G.STORY.dial.results (flags read live) →
   *       G.phone.callScreen(spec) (shell; a minimal local fallback only for partial builds) → vars.calls (recents).
   *       112 → vars.call112++ · result ② (bip ∧ ¬jimin112) → flag call112First · 강수진 → G.sms.kangCalled() (1-min SMS
   *       only after kang341, once). Never adds to the call recordings. No real tel: / dialling (ARCH_EP3 §1).
   *   emergency()  — the lock `긴급 통화` keypad overlay `.cm3-emerg` (z 46, above the lock, below the call screen)
   *   contacts() → [{ id, name, number?, avatar?, label?, fav? }] (data as is)
   *   recents({ days }) → newest first [{ id, who, name, number, d, hm, dir:'in'|'out'|'missed', sec, noAnswer, rec, row }]
   *   missedRowVisible() → bool (DEBUG/QA)
   * }
   * Hooks set   phone:emergency (above) · Hooks call  callrec:open ('settings' | 'rec.list' | 'block')
   * Flags set   missedSeen (03:31 row ≥ 60 % · 200 ms — recents and 세아 💛 › 통화 기록) · call112First
   * Vars        calls [{ n, who, num, d, hm, sec, dir, na }] · call112 · cm.ph {tab}
   * data-scr    phone.pad · phone.recent · phone.contacts · phone.contact.<id> · phone.contact.<id>.log (phone.contact.sea.log) ·
   *             phone.calldetail
   * data-qa     phone.tab:pad|recent|contacts · phone.menu · phone.menu.settings · phone.menu.rec · phone.menu.block ·
   *             phone.recent.search · phone.recent.row:<id> · phone.recent.info:<id> · phone.contact:<id> · phone.contact.fav:<id> ·
   *             phone.contact.call · phone.contact.sms · phone.contact.log · phone.detail.rec · phone.detail.call · phone.detail.sms ·
   *             dial.key:<d> · dial.del · dial.call · emerg.close
   * ========================================================= */
  const SIM = () => !!(G.STORY && G.STORY.dial && G.STORY.dial.sim === true);
  const E3 = {};
  const T3 = (s) => MU.T(s);
  const flag3 = (n) => !!(G.flag && G.flag(n));
  const setFlag3 = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const pm3 = () => (G.state && G.state.playMs) || 0;
  const easyOn3 = () => { try { return !!(G.easy && G.easy.on && G.easy.on()); } catch (e) { return false; } };
  const CMV = () => { const v = (G.state && G.state.vars) || {}; if (!v.cm || typeof v.cm !== 'object') v.cm = {}; return v.cm; };
  const p2 = MU.pad;
  const ymdOf3 = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const pd3 = (s) => { const m = String(s || '').match(/(\d+)-(\d+)-(\d+)/); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
  const todayYmd = () => ymdOf3(MU.now());
  /** §0.1 #18 — '오늘' · '1월 23일 (토)' · '2026년 12월 28일 (월)' (G.e3.fmtDate when present) */
  E3.fmtDay = function (ymd) {
    try { if (G.e3 && G.e3.fmtDate) { const r = G.e3.fmtDate(ymd); if (r) return r; } } catch (e) {}
    const d = pd3(ymd); if (!d) return '';
    if (ymd === todayYmd()) return '오늘';
    return (d.getFullYear() === MU.now().getFullYear() ? '' : d.getFullYear() + '년 ') + `${d.getMonth() + 1}월 ${d.getDate()}일 (${MU.WEEK[d.getDay()]})`;
  };
  /** '1분 2초' · '41초' · '2분' · '0초' */
  E3.dur = function (s) { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60), r = s % 60; return m ? (r ? `${m}분 ${r}초` : `${m}분`) : `${r}초`; };
  const DD = () => G.STORY.dial || {};
  PH.contacts = function () { return (DD().contacts || []).slice(); };
  const contactById = (id) => (DD().contacts || []).find((c) => c.id === id) || null;
  const onlyDigits = (n) => String(n || '').replace(/[^\d*#+]/g, '');
  const contactByNumber = (n) => { const d = onlyDigits(n); return d ? (DD().contacts || []).find((c) => c.number && onlyDigits(c.number) === d) || null : null; };
  /** '01006582741' → '010-0658-2741' (display only) */
  const fmtNum = (n) => { const d = onlyDigits(n); const m = d.match(/^(01\d)(\d{3,4})(\d{4})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : d; };

  /* ---------------- recents (fixed + seeded + tonight's simulated calls) ---------------- */
  let seedCache = null;
  function rng3(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seeded() {
    if (seedCache) return seedCache;
    const sd = DD().seed; const out = [];
    if (!sd) return (seedCache = out);
    const rnd = rng3(sd.rng || 0x3e3), fixed = DD().recents || [];
    const from = pd3(sd.from), to = pd3(sd.to);
    const toMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
    const lo = toMin((sd.hm || [])[0] || '08:00'), hi = toMin((sd.hm || [])[1] || '21:30');
    for (let y = from.getFullYear(), mo = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && mo <= to.getMonth()); mo++, (mo > 11 && (mo = 0, y++))) {
      const key = `${y}-${p2(mo + 1)}`;
      const nFixed = fixed.filter((r) => r.d.slice(0, 7) === key).length;
      const want = (sd.perMonth || [2, 4])[0] + Math.floor(rnd() * ((sd.perMonth || [2, 4])[1] - (sd.perMonth || [2, 4])[0] + 1));
      const n = Math.max(0, want - nFixed);
      const d0 = (y === from.getFullYear() && mo === from.getMonth()) ? from.getDate() : 1;
      const d1 = (y === to.getFullYear() && mo === to.getMonth()) ? to.getDate() : new Date(y, mo + 1, 0).getDate();
      for (let i = 0; i < n; i++) {
        const day = d0 + Math.floor(rnd() * (d1 - d0 + 1));
        const mins = lo + Math.floor(rnd() * (hi - lo + 1));
        const who = sd.names[Math.floor(rnd() * sd.names.length)];
        const sec = (sd.sec || [20, 540])[0] + Math.floor(rnd() * ((sd.sec || [20, 540])[1] - (sd.sec || [20, 540])[0] + 1));
        out.push({ d: `${y}-${p2(mo + 1)}-${p2(day)}`, hm: `${p2(Math.floor(mins / 60))}:${p2(mins % 60)}`, who, dir: rnd() < 0.55 ? 'in' : 'out', sec, seed: 1 });
      }
    }
    return (seedCache = out);
  }
  function rowOf(r, i) {
    const c = r.who ? contactById(r.who) : null;
    const id = r.id || r.row || `${r.who || onlyDigits(r.number)}-${String(r.d).replace(/-/g, '')}-${String(r.hm).replace(':', '')}`;
    return { id, who: r.who || null, name: c ? c.name : (r.name || fmtNum(r.number)), number: c ? (c.number || '') : (r.number || ''), d: r.d, hm: r.hm,
      dir: r.dir, sec: r.sec || 0, noAnswer: !!r.noAnswer, rec: r.rec || null, row: r.row, _o: i };
  }
  function allRecents() {
    const list = [];
    (DD().recents || []).forEach((r, i) => list.push(rowOf(r, 1000 + i)));
    seeded().forEach((r, i) => list.push(rowOf(r, 5000 + i)));
    const calls = (G.state && G.state.vars && Array.isArray(G.state.vars.calls)) ? G.state.vars.calls : [];
    calls.forEach((x, i) => list.push(Object.assign(rowOf({ id: 'call' + i, who: x.who, number: x.num || x.n, d: x.d, hm: x.hm, dir: x.dir || 'out', sec: x.sec, noAnswer: !!x.na }, -i), { sim: true })));
    list.sort((a, b) => { const ka = a.d + ' ' + a.hm, kb = b.d + ' ' + b.hm; return ka < kb ? 1 : ka > kb ? -1 : a._o - b._o; });
    return list;
  }
  PH.recents = function (o) {
    o = o || {};
    let list = allRecents();
    if (o.days) { const t = pd3(todayYmd()); t.setDate(t.getDate() - o.days); const cut = ymdOf3(t); list = list.filter((r) => r.d >= cut); }
    return list.map((r) => ({ id: r.id, who: r.who, name: r.name, number: r.number, d: r.d, hm: r.hm, dir: r.dir, sec: r.sec, noAnswer: r.noAnswer, rec: r.rec, row: r.row }));
  };
  const dirLabel = (r) => { const L = DD().recentLabel || {}; return L[r.dir] || ''; };
  const lenLabel = (r) => (r.dir === 'missed' ? '' : r.noAnswer ? (DD().recentLabel || {}).noAnswer || '' : E3.dur(r.sec));

  /* ---------------- "drawn" watcher (60 % · 200 ms playMs — DESIGN §9.5-4) ---------------- */
  function watchDrawn(node, scr, cb) {
    let vis = false, since = null, done = false, tmr = 0, io = null;
    const t = () => (G.clock && G.clock.running && G.clock.running() ? pm3() : (performance.now ? performance.now() : Date.now()));
    const check = () => {
      clearTimeout(tmr);
      if (done || !node.isConnected) return;
      if (vis && MU.isTop(scr) && !document.hidden) {
        if (since == null) since = t();
        if (t() - since >= 200) { done = true; if (io) io.disconnect(); cb(); return; }
      } else since = null;
      if (vis) tmr = setTimeout(check, 100);
    };
    if (!('IntersectionObserver' in window)) { vis = true; check(); return () => { done = true; }; }
    io = new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting && e.intersectionRatio >= 0.6; check(); }), { threshold: [0, 0.6, 1] });
    io.observe(node);
    return () => { done = true; clearTimeout(tmr); if (io) io.disconnect(); };
  }
  PH.missedRowVisible = function () {
    try {
      const top = G.phone && G.phone.top && G.phone.top(); if (!top || !top.node) return false;
      const r = top.node.querySelector('[data-row="sea-20251124-0331"]'); if (!r) return false;
      const a = r.getBoundingClientRect(), b = (top.node.body || top.node).getBoundingClientRect();
      const vis = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return a.height > 0 && vis / a.height >= 0.6;
    } catch (e) { return false; }
  };

  /* ---------------- call simulation (§3.2.3 · §4.3.7) ---------------- */
  const whenOk = (w) => !w || String(w).split('&').every((t) => { t = t.trim(); return t[0] === '!' ? !flag3(t.slice(1)) : flag3(t); });
  const sleep3 = (ms) => new Promise((r) => setTimeout(r, ms));
  /** minimal call screen for partial builds only (shell's G.phone.callScreen is the real one — ARCH_EP3 §5.7) */
  PH._callScreen = function (spec) {
    return new Promise((resolve) => {
      const host = document.getElementById('screen'); if (!host) { resolve({ sec: 0, by: 'script' }); return; }
      let ended = false, secs = 0, tmr = 0, by = 'script';
      const st = el('div.cm3-call-st', null, MU.STR('connecting') || '');
      const tm = el('div.cm3-call-tm');
      const cards = el('div.cm3-call-cards');
      const endB = el('button.cm3-call-end', { type: 'button', 'aria-label': MU.STR('callEnd') || '', 'data-qa': 'call.end', html: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>' });
      const node = el('div.cm3-call' + (spec.big ? '.big' : ''), { 'data-qa': 'call.screen' }, el('div.cm3-call-n', null, T3(spec.name || spec.number || '')), st, tm, cards, el('div.cm3-call-row', null, endB));
      host.appendChild(node);
      requestAnimationFrame(() => node.classList.add('in'));
      const fin = () => { if (ended) return; ended = true; clearInterval(tmr); st.textContent = T3('{$callEnd}'); setTimeout(() => { node.remove(); resolve({ sec: secs, by }); }, 1000); };
      endB.addEventListener('click', () => { by = 'user'; fin(); });
      const api = {
        get ended() { return ended; },
        status(t) { if (!ended) st.textContent = T3(t); },
        card(t) { if (ended) return Promise.resolve(); const who = t && typeof t === 'object' ? t.who : null; cards.appendChild(el('div.cm3-call-card', null, who ? el('b', null, T3(who) + ' ') : null, T3(t && typeof t === 'object' ? t.text : t))); return sleep3(1600); },
        beep() { return sleep3(700); }, connect() { st.textContent = ''; api.timer(true); }, ring() {}, line() {}, wait: (ms) => sleep3(ms),
        timer(on) { clearInterval(tmr); if (on) tmr = setInterval(() => { secs++; tm.textContent = MU.fmtDur(secs); }, 1000); }, end() { fin(); },
      };
      G.bus && G.bus.emit('call:start', { id: spec.id, kind: spec.kind, number: spec.number, name: spec.name });
      Promise.resolve().then(() => (spec.script ? spec.script(api) : null)).then(() => fin(), () => fin());
    });
  };
  /** call scripts for shell G.phone.callScreen — its ringback runs from the start until status() / connect() / end()
   *  (api: status · card(text | {who, text}) → Promise · beep → Promise · connect · ring(on) · wait(ms, playMs) · end · ended) */
  function scriptFor(target, res, row, ctx) {
    return async function (api) {
      const wait = async (ms) => { if (ctx.ended || api.ended) return; await (api.wait ? api.wait(ms) : sleep3(ms)); };
      const card = async (t) => { if (ctx.ended || api.ended || !t) return; if (api.card) await api.card(t); else await wait(2000); };
      if (res === 'powerOff') {           // ep1 powerOffCall order — 연결 중… → 연결 실패 → 안내 (상태 줄 3.6 s) → 1 kHz 0.5 s → 통화 종료 (no voice, no ringback)
        const P = DD().powerOff || [];
        if (api.ring) api.ring(false);
        await wait(1400);
        if (api.status) api.status(T3(P[0] || '{$connFail}'));
        await wait(1000);
        if (api.status) api.status(T3(P[1] || '{$powerOff}'));
        await wait(3600);
        const bp = P.find((x) => x && typeof x === 'object') || { beepHz: 1000, beepS: 0.5 };
        if (api.beep && !api.ended) await api.beep(bp.beepHz || 1000, bp.beepS || 0.5);
        await wait(300);
        if (api.end) api.end(T3(typeof P[3] === 'string' ? P[3] : '{$callEnd}'));
        return;
      }
      if (row.ringSec) {                  // 강수진 — 신호 30 s → 응답 없음
        await wait(Math.max(0, row.ringSec * 1000 - (Date.now() - ctx.t0)));
        if (api.status) api.status(T3(row.status || ''));
        await wait(1500);
        if (api.end) api.end();
        return;
      }
      if (row.connect || row.sec) {       // connected: 112 · 119 · 1366 · 관리사무소 after bip (연결음 2–6 s)
        await wait(2400 + Math.random() * 2000);
        if (api.ended) return;
        if (api.connect) api.connect();
        ctx.connectedAt = Date.now(); ctx.connectedPm = (G.state && G.state.playMs) || 0;
        await wait(1200);
        if (row.say) await card(row.say);
        if (row.flag && !api.ended) setFlag3(row.flag);   // ② the operator takes the address — set as the card starts (§3.2.3 · §12.2 V15)
        await card(row.card);
        const len = (row.sec || 12) * 1000;
        await wait(Math.max(1200, len - (((G.state && G.state.playMs) || 0) - ctx.connectedPm)));
        if (api.end) api.end();
        return;
      }
      // no answer (지민이 · 관리사무소 before bip · everyone else) — the ringback keeps going under the card
      await wait(3600);
      await card(row.card);
      if (row.say) await card(row.who ? { who: row.who, text: row.say } : row.say);
      await wait(4200);
      if (api.end) api.end();
    };
  }
  PH.dial = function (target, o) {
    o = o || {};
    const R = DD().results || {};
    let c = contactById(target);
    const number = c ? (c.number || '') : onlyDigits(target);
    if (!c && number) c = contactByNumber(number);
    if (!c && !number) { MU.sfx('error'); return Promise.resolve(false); }
    let res = (c && R[c.id]) || (number && (R[number] || R[fmtNum(number)])) || R.other || 'powerOff';
    let row = null;
    if (res !== 'powerOff') { row = ((res && res.rows) || []).find((x) => whenOk(x.when)) || ((R.other && R.other.rows) || [])[0] || {}; }
    const name = (res && res.name) || (c ? c.name : fmtNum(number));
    const v = (G.state && G.state.vars) || {};
    if (number === '112') { if (G.vars) G.vars('call112', (v.call112 | 0) + 1); else v.call112 = (v.call112 | 0) + 1; }
    if (c && c.id === 'kang') { try { G.sms && G.sms.kangCalled && G.sms.kangCalled(); } catch (e) { console.error('[comms] kangCalled', e); } }
    const ctx = { t0: Date.now(), ended: false, connectedAt: null };
    const spec = { id: 'call' + (((v.calls || []).length) | 0), name, number: c && c.number ? c.number : (number ? fmtNum(number) : ''),
      kind: (res && res.kind) || 'cell', avatar: c && c.avatar ? c.avatar : null, big: o.big != null ? !!o.big : easyOn3(), from: o.from || 'pad',
      script: scriptFor(target, res, row || {}, ctx) };
    const cs = (G.phone && G.phone.callScreen) || PH._callScreen;
    const finish = (r) => {
      ctx.ended = true;
      const st = MU.now();
      // recents keep the call's own length (§4.3.7 — 112 = 41 s): the data sec when the script ended the call, the elapsed
      // play seconds (capped at the data sec) when {N} hung up — never the live screen timer (time acceleration inflates it)
      const pmSec = ctx.connectedAt ? Math.round(Math.max(0, (((G.state && G.state.playMs) || 0) - (ctx.connectedPm || 0))) / 1000) : 0;
      let sec = ctx.connectedAt ? ((r && Number.isFinite(r.sec) && r.sec > 0) ? r.sec : Math.round((Date.now() - ctx.connectedAt) / 1000)) : 0;
      if (ctx.connectedAt && row && row.sec) sec = (r && r.by === 'user') ? Math.max(1, Math.min(row.sec, pmSec)) : row.sec;
      const na = !ctx.connectedAt && res !== 'powerOff' && !!(row && (row.noAnswer || row.ringSec));
      const calls = Array.isArray(v.calls) ? v.calls.slice() : [];
      calls.push({ n: c ? c.id : number, who: c ? c.id : null, num: number, d: ymdOf3(st), hm: `${p2(st.getHours())}:${p2(st.getMinutes())}`, sec: na ? 0 : sec, dir: 'out', na: na ? 1 : 0 });
      if (G.vars) G.vars('calls', calls); else v.calls = calls;
      E3.refresh();
      return r;
    };
    let pr = null;
    try { pr = cs(spec); } catch (e) { console.error('[comms] callScreen', e); }
    return Promise.resolve(pr).then(finish, finish);
  };
  PH.call = (function (old) { return function (number, opts) { return SIM() ? PH.dial(number, opts) : old(number, opts); }; })(PH.call);

  /* ---------------- keypad (standard · lock overlay) ---------------- */
  function keypad3(o) {
    o = o || {};
    let n = '';
    const nameEl = el('div.cm3-kp-name');
    const numEl = el('div.md2-dial-num');
    const del = el('button.md2-dial-del', { type: 'button', 'aria-label': '지우기', html: IC.del, 'data-qa': 'dial.del' });
    function upd() {
      numEl.textContent = n.length > 3 && /^\d+$/.test(n) && /^01/.test(n) ? fmtNum(n) : n;
      numEl.classList.toggle('long', n.length > 12); del.style.visibility = n ? 'visible' : 'hidden';
      const c = contactByNumber(n); nameEl.textContent = c ? T3(c.name) : '';
    }
    function press(k) { if (n.length < 20) n += k; MU.sfx('key'); upd(); }
    const pad = el('div.md2-dial-pad', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => {
      const b = el('button.md2-dial-key', { type: 'button', 'aria-label': k }, el('b', null, k), el('small', null, SUBS[k]));
      MU.qa(b, 'dial.key:' + k);
      b.addEventListener('click', () => press(k));
      return b;
    }));
    del.addEventListener('click', () => { n = n.slice(0, -1); MU.sfx('tap'); upd(); });
    del.addEventListener('contextmenu', (e) => e.preventDefault());
    let lpT = null;
    del.addEventListener('pointerdown', () => { clearTimeout(lpT); lpT = setTimeout(() => { n = ''; upd(); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => del.addEventListener(ev, () => clearTimeout(lpT)));
    const go = el('button.md2-dial-go', { type: 'button', 'aria-label': '통화', html: IC.call });
    MU.qa(go, 'dial.call');
    go.addEventListener('click', () => { if (!n) { MU.sfx('error'); return; } const num = n; PH.dial(num, { from: o.from || 'pad' }); });
    upd();
    const node = el('div.md2-kp.cm3-kp', null, nameEl, numEl, pad, el('div.md2-dial-call', null, el('span.md2-sp'), go, del));
    node.keyHandler = function (e) {
      if (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen()) return false;
      if (/^[0-9*#]$/.test(e.key)) { press(e.key); return true; }
      if (e.key === 'Backspace') { n = n.slice(0, -1); upd(); return true; }
      if (e.key === 'Enter') { go.click(); return true; }
      return false;
    };
    node.digits = () => n;
    // S1 '키패드 숫자' (DESIGN §6.1.3) — core G.ui.inputSource (ARCH_EP3 §4.2 widgets)
    try { if (G.ui && G.ui.inputSource) node._offInput = G.ui.inputSource(() => node.isConnected && node.offsetParent !== null && (o.visible ? o.visible() : true) && n.length > 0); } catch (e) {}
    node.dispose = () => { if (node._offInput) { try { node._offInput(); } catch (e) {} node._offInput = null; } };
    return node;
  }

  /* ---------------- screens ---------------- */
  const SVG3 = {
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 11.5a6 6 0 0012 0M12 17.5v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    msg: '<svg viewBox="0 0 24 24"><path d="M4 5.5h16v10.5H9l-4.5 3.5V16H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    in: '<svg viewBox="0 0 24 24"><path d="M17 7L7 17M15 17H7V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    miss: '<svg viewBox="0 0 24 24"><path d="M4 8l6 6 4-4 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const callrecOpen = (id, params) => { if (G.hooks && G.hooks.call) G.hooks.call('callrec:open', id, params); };
  function avatarOf(c, px) {
    const box = el('span.cm3-av', { style: { width: px + 'px', height: px + 'px', fontSize: Math.round(px * 0.42) + 'px' } }, el('span', null, Array.from(T3(c ? c.name : '') || '?')[0] || ''));
    if (c && c.avatar) { const u = MU.img(c.avatar); if (u) { const im = new Image(); im.alt = ''; im.onload = () => box.appendChild(im); im.src = u; } }
    return box;
  }
  function recentRow(r, scr, opts) {
    const missed = r.dir === 'missed';
    const rowEl = el('div.cm3-rrow' + (missed ? '.missed' : ''), { 'data-qa': 'phone.recent.row:' + r.id, role: 'button', tabindex: 0, dataset: r.row ? { row: r.row } : {} },
      el('span.cm3-rdir', { html: missed ? SVG3.miss : r.dir === 'in' ? SVG3.in : SVG3.out }),
      el('span.cm3-rmain', null, el('b', null, T3(r.name)), el('small', null, [dirLabel(r), lenLabel(r)].filter(Boolean).join('  '))),
      el('span.cm3-rside', null, el('small', null, MU.fmt12(r.hm)), r.rec ? el('i.cm3-rmic', { html: SVG3.mic, 'aria-label': '녹음' }) : null),
      opts && opts.noInfo ? null : el('button.cm3-rinfo', { type: 'button', 'aria-label': '정보', 'data-qa': 'phone.recent.info:' + r.id, html: MU.ICON.info, onclick: (e) => { e.stopPropagation(); MU.sfx('tap'); callDetail(r); } }));
    rowEl.addEventListener('click', () => { MU.sfx('tap'); if (r.who || r.number) PH.dial(r.who || r.number, { from: 'recent' }); });
    rowEl.addEventListener('contextmenu', (e) => e.preventDefault());
    if (r.row === 'sea-20251124-0331' && scr) { const off = watchDrawn(rowEl, scr, () => setFlag3('missedSeen')); scr._offs = (scr._offs || []).concat(off); }
    return rowEl;
  }
  function recentsBody(scr, o) {
    o = o || {};
    const box = el('div.cm3-recents');
    const listEl = el('div.cm3-rlist');
    let q = '';
    function render() {
      listEl.innerHTML = '';
      (scr._offs || []).forEach((f) => { try { f(); } catch (e) {} }); scr._offs = [];
      let rows = PH.recents({ days: o.days });
      if (q) { const nq = MU.norm(q); rows = rows.filter((r) => MU.norm(T3(r.name)).indexOf(nq) >= 0 || (r.number && onlyDigits(r.number).indexOf(onlyDigits(q)) >= 0 && onlyDigits(q))); }
      let day = null;
      rows.forEach((r) => {
        if (r.d !== day) { day = r.d; listEl.appendChild(el('div.cm3-rday', null, E3.fmtDay(r.d))); }
        listEl.appendChild(recentRow(r, scr, o));
      });
      if (!rows.length && q) listEl.appendChild(el('div.cm3-empty', null, T3('{$noResult}').replace('{q}', q)));
    }
    if (!o.days && G.ui && G.ui.field) {
      const f = G.ui.field({ placeholder: T3(DD().searchPh || '검색'), mode: 'ko', ctx: 'phoneSearch', predict: false, numRow: true, onChange: (v) => { q = String(v || '').trim(); render(); }, onSubmit: (v) => { q = String(v || '').trim(); render(); }, qa: 'phone.recent.search' });
      f.node.classList.add('cm3-sfld');
      box.appendChild(el('div.cm3-sbox', null, el('i', { html: MU.ICON.search }), f.node));
    }
    box.appendChild(listEl);
    render();
    box.render = render;
    return box;
  }
  function contactsBody(scr, o) {
    o = o || {};
    const box = el('div.cm3-contacts');
    const all = PH.contacts();
    const order = (DD().order || all.map((c) => c.id)).map(contactById).filter(Boolean);
    const row = (c, qa) => el('button.cm3-crow', { type: 'button', 'data-qa': qa, onclick: () => { MU.sfx('tap'); contactDetail(c, o); } }, avatarOf(c, 40), el('span', null, T3(c.name)));
    box.appendChild(el('div.cm3-chead', null, T3((DD().contactsHead || '').replace('{n}', all.length))));
    const fav = all.filter((c) => c.fav);
    if (fav.length) { box.appendChild(el('div.cm3-rday', null, T3(DD().favHead || ''))); fav.forEach((c) => box.appendChild(row(c, 'phone.contact.fav:' + c.id))); box.appendChild(el('div.cm3-gap')); }
    order.forEach((c) => box.appendChild(row(c, 'phone.contact:' + c.id)));
    return box;
  }
  function numberLine(c) { return c.number ? c.number : T3(c.label || ''); }
  function smsTo(c) { try { if (G.sms && G.sms.open) G.sms.open(c.sms || c.id, { list: false }); } catch (e) { console.error('[comms] sms.open', e); } }
  function contactDetail(c, o) {
    o = o || {};
    const btns = DD().detailBtns || ['', ''];
    const body = el('div.cm3-cdet', null,
      avatarOf(c, 96), el('b.cm3-cdet-n', null, T3(c.name)), el('span.cm3-cdet-num', null, numberLine(c)),
      el('div.cm3-cdet-btns', null,
        el('button.cm3-cbtn', { type: 'button', 'data-qa': 'phone.contact.call', onclick: () => { MU.sfx('tap'); PH.dial(c.id, { from: 'contact' }); } }, el('i', { html: IC.call }), el('span', null, T3(btns[0]))),
        el('button.cm3-cbtn', { type: 'button', 'data-qa': 'phone.contact.sms', onclick: () => { MU.sfx('tap'); smsTo(c); } }, el('i', { html: SVG3.msg }), el('span', null, T3(btns[1])))),
      o.easy ? null : el('button.cm3-row', { type: 'button', 'data-qa': 'phone.contact.log', onclick: () => { MU.sfx('tap'); contactLog(c); } }, el('span', null, T3(DD().logRow || '')), el('i.cm3-chev', { html: SVG3.chev })));
    const scr = MU.screen({ title: '', cls: 'cm3-ph cm3-cdetv', body });
    scr.dataset.scr = 'phone.contact.' + c.id;
    MU.push(scr, { appId: 'phone' });
  }
  function personRows(c) { return PH.recents().filter((r) => r.who === c.id); }
  function contactLog(c) {
    const box = el('div.cm3-log', null, el('div.cm3-log-h', null, el('b', null, T3(c.name)), el('span', null, numberLine(c))));
    const scr = MU.screen({ title: '', cls: 'cm3-ph cm3-logv', body: box });
    personRows(c).forEach((r) => {
      const missed = r.dir === 'missed';
      const line = el('div.cm3-lrow' + (missed ? '.missed' : ''), { dataset: r.row ? { row: r.row } : {}, 'data-qa': 'phone.log.row:' + r.id },
        el('span.cm3-ld', null, E3.fmtDay(r.d)), el('span.cm3-lt', null, MU.fmt12(r.hm)),
        el('span.cm3-ll', null, missed ? dirLabel(r) : [dirLabel(r), lenLabel(r)].filter(Boolean).join(' · ')));
      if (r.row === 'sea-20251124-0331') { const off = watchDrawn(line, scr, () => setFlag3('missedSeen')); scr._offs = (scr._offs || []).concat(off); }
      box.appendChild(line);
    });
    scr.dataset.scr = 'phone.contact.' + c.id + '.log';
    MU.push(scr, { appId: 'phone', onClose: () => (scr._offs || []).forEach((f) => { try { f(); } catch (e) {} }) });
  }
  function callDetail(r) {
    const c = r.who ? contactById(r.who) : null;
    const line = (x) => [E3.fmtDay(x.d) + ' ' + MU.fmt12(x.hm), dirLabel(x), lenLabel(x)].filter(Boolean).join(' · ');
    const btns = DD().detailBtns || ['', ''];
    const others = (c ? personRows(c) : PH.recents().filter((x) => x.number && x.number === r.number)).filter((x) => x.id !== r.id);
    const body = el('div.cm3-cdet', null,
      c ? avatarOf(c, 80) : null, el('b.cm3-cdet-n', null, T3(r.name)),
      el('span.cm3-cdet-line', null, line(r)),
      r.rec ? el('button.cm3-row', { type: 'button', 'data-qa': 'phone.detail.rec', onclick: () => { MU.sfx('tap'); if (G.callrec && G.callrec.openList) G.callrec.openList({ scrollTo: r.rec }); else callrecOpen('rec.list', { scrollTo: r.rec }); } }, el('span', null, T3((DD().recRow || '').replace('{n}', 1))), el('i.cm3-chev', { html: SVG3.chev })) : null,
      el('div.cm3-cdet-btns', null,
        el('button.cm3-cbtn', { type: 'button', 'data-qa': 'phone.detail.call', onclick: () => { MU.sfx('tap'); PH.dial(r.who || r.number, { from: 'detail' }); } }, el('i', { html: IC.call }), el('span', null, T3(btns[0]))),
        c ? el('button.cm3-cbtn', { type: 'button', 'data-qa': 'phone.detail.sms', onclick: () => { MU.sfx('tap'); smsTo(c); } }, el('i', { html: SVG3.msg }), el('span', null, T3(btns[1]))) : null),
      others.length ? el('div.cm3-others', null, others.map((x) => el('div.cm3-orow', null, line(x)))) : null);
    const scr = MU.screen({ title: '', cls: 'cm3-ph cm3-cdetv', body });
    scr.dataset.scr = 'phone.calldetail';
    MU.push(scr, { appId: 'phone' });
  }
  const openScreens = new Set();
  E3.refresh = function () { openScreens.forEach((s) => { if (!s.isConnected) { openScreens.delete(s); return; } if (s._refresh) s._refresh(); }); };
  E3.open = function (p) {
    p = p || {};
    if (easyOn3() && G.easy && G.easy.phone && !E3._inEasy && !p.standard) {   // easy mode: the shell's big phone (E3/E4)
      E3._inEasy = true; try { G.easy.phone({ tab: p.tab || 'pad' }); } finally { E3._inEasy = false; } return;
    }
    const easyFallback = easyOn3();        // partial build without easymode.js: same app, the easy-mode cuts applied
    const cmv = CMV(); cmv.ph = cmv.ph || {};
    let tab = p.tab || cmv.ph.tab || 'pad';
    if (tab === 'keypad') tab = 'pad';
    const body = el('div.md2-ph-body');
    const tabs = el('nav.md2-tabs');
    let scr = null;
    const right = easyFallback ? [] : [MU.iconBtn(MU.ICON.more, '메뉴', 'phone.menu', () => phoneMenu(scr))];
    scr = MU.screen({ title: '', cls: 'md2-ph cm3-ph', body, footer: tabs, right });
    let kp = null, rb = null;
    const tabIc = { pad: IC.keypad, recent: IC.recent, contacts: IC.contacts };
    function render() {
      cmv.ph.tab = tab;
      if (kp && kp.dispose) kp.dispose();
      (scr._offs || []).forEach((f) => { try { f(); } catch (e) {} }); scr._offs = [];
      body.innerHTML = ''; tabs.innerHTML = '';
      (DD().tabs || []).forEach(([k, l]) => {
        const b = el('button.md2-tab' + (tab === k ? '.on' : ''), { type: 'button', 'data-qa': 'phone.tab:' + k, html: (tabIc[k] || '') + `<span>${MU.T(l)}</span>` });
        b.addEventListener('click', () => { if (tab === k) return; MU.sfx('tap'); tab = k; render(); });
        tabs.appendChild(b);
      });
      MU.setTitle(scr, MU.T((DD().tabs.find((t) => t[0] === tab) || [])[1] || ''));
      scr.dataset.scr = tab === 'pad' ? 'phone.pad' : tab === 'recent' ? 'phone.recent' : 'phone.contacts';
      kp = null; rb = null;
      if (tab === 'pad') { kp = keypad3({ from: 'pad', visible: () => MU.isTop(scr) }); body.appendChild(kp); }
      if (tab === 'recent') { rb = recentsBody(scr, { days: easyFallback ? ((G.STORY.easy && G.STORY.easy.recentDays) || 30) : 0 }); body.appendChild(rb); }
      if (tab === 'contacts') body.appendChild(contactsBody(scr, { easy: easyFallback }));
    }
    scr._refresh = () => { if (rb && rb.render) rb.render(); };
    render();
    openScreens.add(scr);
    const onKey = (e) => { if (kp && MU.isTop(scr) && kp.keyHandler(e)) e.preventDefault(); };
    document.addEventListener('keydown', onKey);
    MU.push(scr, { appId: 'phone', onClose: () => { document.removeEventListener('keydown', onKey); if (kp && kp.dispose) kp.dispose(); (scr._offs || []).forEach((f) => { try { f(); } catch (e) {} }); openScreens.delete(scr); } });
    if (p.contact && contactById(p.contact)) contactDetail(contactById(p.contact), { easy: easyFallback });
  };
  PH.open = function (p) { if (G.phone && G.phone.openApp) G.phone.openApp('phone', p || {}); else E3.open(p); };
  function phoneMenu(scr) {
    const m = DD().menu || [];
    MU.menu(scr, [
      { label: m[0], qa: 'phone.menu.settings', onClick: () => callrecOpen('settings') },
      { label: m[1], qa: 'phone.menu.rec', onClick: () => callrecOpen('rec.list') },
      { label: m[2], qa: 'phone.menu.block', onClick: () => callrecOpen('block') },
    ]);
  }
  /* lock 긴급 통화 keypad — `.cm3-emerg` z 46 in #screen (above the lock 30, below the call screen 47 — ARCH_EP3 §2.3) */
  let em3 = null;
  E3.emergency = function () {
    if (em3) return;
    const host = document.getElementById('screen'); if (!host) return;
    let kp = null;
    const close = () => {
      if (!em3) return; const n = em3.node; const rb = em3.rmBack; em3 = null;
      document.removeEventListener('keydown', onKey);
      if (kp && kp.dispose) kp.dispose();
      if (rb) rb();
      n.classList.remove('in'); setTimeout(() => n.remove(), 240);
      try { const top = G.phone && G.phone.top && G.phone.top(); G.phone && G.phone.statusTheme && G.phone.statusTheme(G.phone.isLocked && G.phone.isLocked() ? 'light' : (top && top.node && top.node.dataset.status) || 'light'); } catch (e) {}
    };
    kp = keypad3({ from: 'lock', visible: () => !!em3 });
    const head = el('div.md2-em-head', null, MU.iconBtn(MU.ICON.back, '뒤로', 'emerg.close', () => close()), el('b', null, T3(DD().emergencyTitle || '{$emergency}')));
    const node = el('div.cm3-emerg.md2-em', { dataset: { theme: 'light', scr: 'phone.emergency' }, 'data-qa': 'phone.emergency' }, head, kp);
    const onKey = (e) => { if (em3 && kp.keyHandler(e)) e.preventDefault(); };
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    let rmBack = null;
    try { if (G.phone && G.phone.pushBack) rmBack = G.phone.pushBack(() => { if (!em3) return false; if (G.phone.inCall && G.phone.inCall()) return false; close(); return true; }); } catch (e) {}
    em3 = { node, close, rmBack };
    try { G.phone && G.phone.statusTheme && G.phone.statusTheme('dark'); } catch (e) {}
    document.addEventListener('keydown', onKey);
  };
  PH.emergencyClose = function () { if (em3) em3.close(); };
  PH.init = function () {
    if (!SIM() || PH._inited) return; PH._inited = true;
    if (G.bus) G.bus.on('state:load', () => E3.refresh());
    if (G.DEBUG) { window.haru = window.haru || {}; window.haru.recents = () => PH.recents(); }
  };
})();
