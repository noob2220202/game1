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
})();
