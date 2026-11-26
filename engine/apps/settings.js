/* =========================================================
 * 설정 (ep2) — owner: shell. DESIGN §4.6.0–§4.6.8 · §4.6.11 · §4.6.12 · §5.3 · §5.6 · §5.7; ARCH §4.22 (settings:screen)
 *   Screen registry by key. settings.js keys: root search connect wifi wifi.saved wifi.net bt bt.device sound volume sound.notif
 *     notif notif.apps notif.apps.moment notif.perChat notif.perChat.fake display wallpaper location accounts accounts.manage
 *     accounts.login battery about general
 *   security.js keys: lock lock.smart lock.smart.item bio bio.finger bio.fingerDetail bio.fingerAdd users users.detail users.n
 *     kbd kbd.predict kbd.words wifi.saved.saemal_rooftop  ·  media: alerts.settings
 * API: G.settingsApp = { open(key, params) → Promise<bool>, register(key, {title, render(api) → Node, verify, onOpen, keywords}), has(key),
 *                        ui:{ row, group, foot, hero, toggle, slider } }
 *      hook 'settings:screen' (key, params) → bool · G.app('settings', { open({key, params}) })
 * Every row that opens a key renders data-qa="settings.row:<key>".
 * Flags set: soundSettingsOpened (알림 소리 · {N}) · perChatSeen (대화별 알림음 · {N}). Vars: soundMode · dnd · sh.*
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UTIL = G.util || {};
  const el = UTIL.el;
  const pad = UTIL.pad || ((n) => String(n).padStart(2, '0'));

  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { console.error('[settings] lazy', e); s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const STR = (k) => T((G.e2 && G.e2.STR && G.e2.STR[k]) || '');
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[settings]', e); return d; } };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const vget = (k, d) => { const v = G.state && G.state.vars ? G.state.vars[k] : undefined; return v === undefined ? d : v; };
  const vset = (k, v) => { if (G.vars) G.vars(k, v); };
  const SH = () => { const v = (G.state && G.state.vars) || {}; if (!v.sh) v.sh = {}; return v.sh; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const S = () => (G.STORY && G.STORY.settings) || {};
  const user = () => (G.users && G.users.current ? G.users.current() : 'n');
  const isDash = () => user() === 'dash';
  const PH = () => G.phone || {};
  const ui = () => (G.phone && G.phone.ui) || {};
  const now = () => (G.clock && G.clock.now ? G.clock.now() : new Date(2026, 11, 24, 23, 12));

  /* ---------------- glyphs (white on round colour) ---------------- */
  const W = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const GL = {
    wifi: `<svg viewBox="0 0 24 24"><path ${W} d="M2.5 9a14 14 0 0119 0M5.5 12.2a9.5 9.5 0 0113 0M8.6 15.4a5 5 0 016.8 0"/><circle cx="12" cy="19" r="1.6" fill="#fff"/></svg>`,
    sound: `<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path ${W} d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/></svg>`,
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" fill="#fff"/><circle cx="12" cy="20.5" r="1.6" fill="#fff"/></svg>',
    display: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#fff"/><path ${W} d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`,
    wall: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" ${W}/><path ${W} d="M4 16l4.5-4.5 4 4 2.5-2.5L20 18"/><circle cx="15.5" cy="8.5" r="1.6" fill="#fff"/></svg>`,
    lock: '<svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="#fff"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="#fff" stroke-width="2"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z" fill="#fff"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-6.1-6-11a6 6 0 0112 0c0 4.9-6 11-6 11z" fill="#fff"/><circle cx="12" cy="10" r="2.2" fill="#3fa45b"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" fill="#fff"/><path d="M3 19c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6z" fill="#fff"/><circle cx="16.5" cy="9" r="2.5" fill="#fff" opacity=".75"/><path d="M15.5 13.6c2.9.2 5.5 2 5.5 5.4h-4" fill="#fff" opacity=".75"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 9.5a4.3 4.3 0 01-.5 8.5z" fill="#fff"/></svg>',
    general: `<svg viewBox="0 0 24 24"><path ${W} d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.8" fill="#fff"/><circle cx="15" cy="12" r="1.8" fill="#fff"/><circle cx="8" cy="17" r="1.8" fill="#fff"/></svg>`,
    batt: '<svg viewBox="0 0 24 24"><rect x="3" y="7.5" width="16" height="9" rx="2" fill="none" stroke="#fff" stroke-width="2"/><rect x="5" y="9.5" width="9" height="5" rx="1" fill="#fff"/><path d="M20.5 10.5v3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" ${W}/><path ${W} d="M12 11v5.5M12 7.8v.2"/></svg>`,
    bt: `<svg viewBox="0 0 24 24"><path ${W} d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9"/></svg>`,
    plane: '<svg viewBox="0 0 24 24"><path d="M21 15.5l-8-4.5V5a1.5 1.5 0 00-3 0v6L2 15.5V17l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-4.5l8 2.5z" fill="#fff"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13.2l1.7 1.3-1.8 3.1-2-.8a7.6 7.6 0 01-2 1.2l-.3 2.1h-3.6l-.3-2.1a7.6 7.6 0 01-2-1.2l-2 .8-1.8-3.1 1.7-1.3a7.8 7.8 0 010-2.4L3.4 9.5l1.8-3.1 2 .8a7.6 7.6 0 012-1.2l.3-2.1h3.6l.3 2.1a7.6 7.6 0 012 1.2l2-.8 1.8 3.1-1.7 1.3a7.8 7.8 0 010 2.4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    lockSm: '<svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    wifiSm: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0119 0M5.5 12.2a9.5 9.5 0 0113 0M8.6 15.4a5 5 0 016.8 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><rect x="6" y="2.8" width="12" height="18.4" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="14.6" r="3.3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="7.2" r="1.2" fill="currentColor"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="18.5" r="1.8" fill="currentColor"/></svg>',
  };
  const roundIc = (bg, g) => el('span.sh2-ic', { style: { background: bg }, html: GL[g] || '' });

  /* =========================================================
   * building blocks (exported to security.js as G.settingsApp.ui)
   * ========================================================= */
  /** row({title, sub, meta, right, key, params, onClick, qa, cls, disabled, chev, icon, grey}) */
  function row(o) {
    o = o || {};
    const act = !!(o.key || o.onClick) && !o.disabled && !o.grey;
    const r = el((act ? 'button' : 'div') + '.sh2-row' + (o.cls ? '.' + o.cls.split(' ').join('.') : '') + (o.grey ? '.grey' : ''),
      { 'data-qa': o.qa || (o.key ? 'settings.row:' + o.key : null) },
      o.icon || null,
      el('span.sh2-main', null, el('span.sh2-t', null, T(o.title)), o.sub instanceof Node ? el('span.sh2-s', null, o.sub) : (o.sub != null && T(o.sub) !== '' ? el('span.sh2-s', null, T(o.sub)) : null)),
      o.right || (o.meta != null && T(o.meta) !== '' ? el('span.sh2-meta', null, T(o.meta)) : null),
      act && o.chev !== false && !o.right ? el('span.sh2-chev', { html: GL.chev }) : null);
    if (act) r.addEventListener('click', (e) => { sfx('tap'); if (o.onClick) o.onClick(e, r); else APP.open(o.key, o.params || {}); });
    return r;
  }
  const group = (title, rows, foot) => el('div.sh2-gw', null, title ? el('div.sh2-gh', null, T(title)) : null,
    el('div.sh2-group', null, (rows || []).filter(Boolean)), foot ? el('div.sh2-foot', null, T(foot)) : null);
  const foot = (t) => el('div.sh2-foot', null, T(t));
  const hero = (big, small, icon) => el('div.sh2-hero', null, icon || null, el('b', null, T(big)), small ? el('small', null, T(small)) : null);
  const toggle = (on, fn, o) => (ui().toggle ? ui().toggle(on, fn, o) : el('span'));
  const slider = (v, o) => (ui().slider ? ui().slider(v, o) : el('span'));
  const btnRow = (label, fn, o) => {
    o = o || {};
    const b = el('button.sh2-action' + (o.danger ? '.danger' : '') + (o.primary ? '.primary' : ''), { 'data-qa': o.qa || null }, T(label));
    b.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); fn(); });
    return b;
  };

  /* =========================================================
   * registry + navigation
   * ========================================================= */
  const REG = {};
  const APP = (G.settingsApp = G.settingsApp || {});
  APP.register = function (key, def) { REG[key] = def; };
  APP.has = (key) => !!REG[key];
  APP.ui = { row, group, foot, hero, toggle, slider, btnRow, GL, roundIc };

  /** open a key: from the home → the 설정 app with that screen on top of its root; inside any app → pushed on top (back returns there) */
  APP.open = async function (key, params) {
    params = Object.assign({}, params || {});
    if (!key || key === 'root') { PH().openApp && PH().openApp('settings'); return true; }
    if (String(key).indexOf('app:') === 0) { PH().openApp && PH().openApp(String(key).slice(4)); return true; }
    if (!REG[key]) {
      if (key === 'alerts.settings' && G.alerts && G.alerts.openSettings) { safe(() => G.alerts.openSettings()); return true; }
      console.warn('[settings] unknown screen', key); return false;
    }
    if (!(PH().stackDepth && PH().stackDepth())) { PH().openApp('settings', { key, params }); return true; }
    return pushKey(key, params);
  };
  async function pushKey(key, params) {
    const def = REG[key];
    if (!def) return false;
    const need = typeof def.verify === 'function' ? safe(() => def.verify(params), false) : !!def.verify;
    if (need && !params.verified) {
      const ok = G.security && G.security.verify ? await G.security.verify({ reason: key }) : true;
      if (!ok) return false;
      params.verified = true;
    }
    const offs = [];
    let scr = null, entry = null, first = true, own = [];
    const runOwn = () => { own.forEach((f) => { try { f && f(); } catch (e) {} }); own = []; };
    const api = {
      key, params, get user() { return user(); }, get scr() { return scr; }, T, STR,
      open: (k, p) => APP.open(k, p),
      back: () => { if (PH().top && entry && PH().top() === entry) PH().pop(); },
      refresh: () => { if (!scr) return; runOwn(); const y = scr.body.scrollTop; scr.body.innerHTML = ''; scr.body.appendChild(safe(() => def.render(api), el('div'))); scr.body.scrollTop = y; },
      own: (fn) => own.push(fn),                        // disposed on the next refresh and on close
      onClose: (fn) => offs.push(fn),
      on: (ev, fn) => { if (first && G.bus) offs.push(G.bus.on(ev, fn)); },   // registered once (first render only)
      setTitle: (t) => { const n = scr && scr.querySelector('.sv-title'); if (n) n.textContent = T(t); },
      row, group, foot, hero, toggle, slider, btnRow, GL,
    };
    const body = safe(() => def.render(api), el('div'));
    first = false;
    const title = T(typeof def.title === 'function' ? safe(() => def.title(api), '') : def.title);
    scr = G.ui.screen({ title, cls: 'sh2-st' + (def.cls ? ' ' + def.cls : ''), body, right: def.right ? safe(() => def.right(api), null) : null });
    scr.dataset.settingsKey = key;
    entry = PH().push(scr, { onClose: () => { runOwn(); offs.forEach((f) => { try { f && f(); } catch (e) {} }); }, onResume: () => { if (def.resume !== false) api.refresh(); } });
    if (def.onOpen) safe(() => def.onOpen(api));
    G.bus && G.bus.emit('settings:screen', { key });
    return true;
  }
  APP.pushKey = pushKey;
  if (G.hooks && G.hooks.set) G.hooks.set('settings:screen', (key, params) => { APP.open(key, params); return !!(REG[key] || String(key).indexOf('app:') === 0 || key === 'root'); });

  G.app('settings', {
    name: '설정',
    icon: (G.ICONS && G.ICONS.settings) || { bg: 'linear-gradient(160deg,#9aa0a6,#5f6368)', svg: GL.gear },
    open(p) {
      p = p || {};
      root();
      const key = p.key || p.screen;
      if (key && key !== 'root') setTimeout(() => pushKey(key, Object.assign({}, p.params || {})), 0);
    },
  });

  /* =========================================================
   * 첫 화면 (§4.6.0)
   * ========================================================= */
  function root() {
    const D = S();
    const body = el('div.sh2-root');
    const search = el('button.sh2-search', { 'data-qa': 'settings.search' }, el('span', { html: GL.search }), el('span.sh2-search-ph', null, T(D.searchPh || '설정 검색')));
    search.addEventListener('click', () => { sfx('tap'); searchScreen(); });
    const acc = D.account || {};
    const name = isDash() ? '—' : T(acc.title || '{N}');
    const av = isDash() ? '—' : (G.phone && G.phone._initial ? G.phone._initial() : name.slice(0, 1));
    const card = el('button.sh2-acct', { 'data-qa': 'settings.account' }, el('span.sh2-acct-av' + (isDash() ? '.dash' : ''), null, av),
      el('span.sh2-acct-m', null, el('b', null, name), el('small', null, T(acc.sub || ''))));
    card.addEventListener('click', () => { sfx('tap'); APP.open('accounts'); });
    const rows = (D.root || []).map((r) => row({ key: r.key, title: r.title, sub: r.sub, icon: roundIc(r.bg, r.icon) }));
    const groups = [rows.slice(0, 3), rows.slice(3, 5), rows.slice(5, 9), rows.slice(9)];
    body.append(search, card, ...groups.map((g) => group(null, g)));
    const scr = G.ui.screen({ title: D.title || '설정', cls: 'sh2-st sh2-st-root', body });
    PH().push(scr, { onResume: () => { const n = scr.querySelectorAll('.sh2-row .sh2-s'); (D.root || []).forEach((r, i) => { if (n[i] && typeof r.sub === 'function') n[i].textContent = T(r.sub); }); } });
  }

  /* 설정 검색 (§4.6.0 표 — 정규화 부분 일치, 예측 바가 뜨는 일반 입력칸) */
  const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[\s\-_·]+/g, '');
  function searchMatches(q) {
    const n = norm(q);
    if (!n) return [];
    const out = [], seen = {};
    (S().search || []).forEach((row) => {
      const hit = row.keys.some((k) => { const kk = norm(k); return kk && (kk.includes(n) || n.includes(kk)); });
      if (hit) row.results.forEach((r) => { if (!seen[r[2]]) { seen[r[2]] = 1; out.push(r); } });
    });
    return out;
  }
  APP.search = searchMatches;
  function searchScreen() {
    const results = el('div.sh2-results');
    let field = null;
    const draw = (q) => {
      results.innerHTML = '';
      const raw = String(q || '').trim();
      if (!raw) return;
      const hits = searchMatches(raw);
      if (!hits.length) { results.appendChild(el('div.sh2-noresult', null, STR('noResult').replace('{q}', raw))); return; }
      results.appendChild(group(null, hits.map(([title, path, key]) => row({ title, sub: path || null, key,
        onClick: () => { if (field && G.ui.hideKeyboard) G.ui.hideKeyboard(); APP.open(key, {}); } }))));
    };
    if (G.ui.field) {
      field = G.ui.field({ placeholder: T(S().searchPh || '설정 검색'), mode: 'ko', ctx: 'settingsSearch', predict: true, qa: 'settings.searchField', submitLabel: '검색',
        onChange: (v) => draw(v), onSubmit: (v) => { G.ui.hideKeyboard && G.ui.hideKeyboard(); draw(v); } });
      field.node.classList.add('sh2-sfield');
    }
    const back = el('button.sv-back', { 'aria-label': '뒤로', 'data-qa': 'settings.back', html: (G.phone.SVG && G.phone.SVG.back) || '' });
    back.addEventListener('click', () => PH().back());
    const head = el('header.sv-head.sh2-shead', null, back, el('div.sh2-sbox', null, el('span', { html: GL.search }), field ? field.node : null));
    const body = el('div.sv-body', null, results);
    const scr = el('section.sh2-st.sh2-st-search', { dataset: { status: 'dark', theme: 'light' } }, head, body);
    scr.body = body; scr.head = head;
    PH().push(scr, { anim: 'fade' });
    if (field) setTimeout(() => field.focus(), 120);
  }

  /* =========================================================
   * 연결 · Wi-Fi · 블루투스 (§4.6.6 · §4.6.7 · §5.6)
   * ========================================================= */
  const btState = () => (PH().btState ? PH().btState() : 'idle');
  APP.register('connect', {
    title: () => S().connect.title,
    render(api) {
      const C = S().connect;
      const W = PH().wifi;
      const bst = btState();
      const air = !!SH().airplane;
      const at = toggle(air, (on) => { setAirplane(on); setTimeout(api.refresh, 30); }, { label: C.airplane });
      api.on('wifi:change', api.refresh); api.on('bt:change', api.refresh);
      return el('div', null, group(null, [
        row({ key: 'wifi', title: C.wifi, sub: W && W.connected() ? 'saemal_rooftop' : '', icon: roundIc('#3e91ff', 'wifi') }),
        row({ key: 'bt', title: C.bt, sub: bst === 'connected' ? PH().btName() : '', icon: roundIc('#3e91ff', 'bt') }),
        row({ title: C.airplane, icon: roundIc('#ff9f43', 'plane'), right: at }),
      ]));
    },
  });
  function setAirplane(on) {
    const sh = SH(); const W = PH().wifi; const bt = G.media && G.media.bt;
    if (on) { sh.apPrev = { wifi: W ? W.on() : true, bt: PH().btOn ? PH().btOn() : true }; sh.airplane = true; if (W) W.setOn(false); if (bt) safe(() => bt.setOn(false)); }
    else { const p = sh.apPrev || { wifi: true, bt: true }; sh.airplane = false; if (W && p.wifi) W.setOn(true); if (bt && p.bt) safe(() => bt.setOn(true)); }
    save();
  }

  APP.register('wifi', {
    title: () => S().wifi.title,
    right(api) {
      const b = el('button.sh2-more', { 'aria-label': '⋮', html: GL.more });
      b.addEventListener('click', (e) => {
        e.stopPropagation(); sfx('tap');
        const m = el('div.sh2-menu', null, row({ key: 'wifi.saved', title: S().wifi.saved, chev: false }));
        const close = () => { m.remove(); document.removeEventListener('pointerdown', out, true); };
        const out = (ev) => { if (!m.contains(ev.target)) close(); };
        m.addEventListener('click', () => setTimeout(close, 0));
        (api.scr || document.body).appendChild(m);
        setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
      });
      return [b];
    },
    render(api) {
      const D = S().wifi; const W = PH().wifi;
      api.on('wifi:change', api.refresh);
      const on = W.on();
      const tg = toggle(on, (v) => { W.setOn(v); }, { label: D.title, qa: 'wifi.toggle' });
      const wrap = el('div', null, group(null, [row({ title: D.title, meta: on ? D.on : D.off, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(on ? D.on : D.off)), tg), cls: 'big' })]));
      if (on) {
        const saved = W.saved();
        if (saved.includes('saemal_rooftop')) {
          const gear = el('button.sh2-gear', { 'aria-label': '⚙', 'data-qa': 'wifi.gear:saemal_rooftop', html: GL.gear });
          gear.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); APP.open('wifi.saved.saemal_rooftop'); });
          wrap.appendChild(group(D.current, [row({ title: 'saemal_rooftop', sub: D.connected, qa: 'wifi.net:saemal_rooftop', icon: el('span.sh2-wfic', { html: GL.wifiSm }),
            onClick: () => APP.open('wifi.saved.saemal_rooftop'), right: gear })]));
        }
        const avail = ((G.STORY.security && G.STORY.security.available) || []).slice();
        if (!saved.includes('saemal_rooftop')) avail.unshift('saemal_rooftop');
        wrap.appendChild(group(D.available, avail.map((ssid) => row({ title: ssid, qa: 'wifi.net:' + ssid, icon: el('span.sh2-wfic', { html: GL.wifiSm }),
          right: el('span.sh2-lockic', { html: GL.lockSm }), onClick: () => joinSheet(ssid) }))));
      }
      const at = toggle(W.auto(), (v) => { W.setAuto(v); }, { label: D.auto });
      const ap = String(D.auto).split(' · ');   // 'Wi-Fi 자동으로 켜기' + '자주 쓰는 장소 근처에서' (§4.6.6)
      wrap.appendChild(group(null, [row({ title: ap[0], sub: ap.slice(1).join(' · '), right: at, qa: 'wifi.auto' })]));
      return wrap;
    },
  });
  /** `비밀번호 입력` (STR.pwEnter) — in-game keyboard, password field (no predict bar) */
  function joinSheet(ssid) {
    const D = S().wifi;
    let field = null;
    const msg = el('div.sh2-pwmsg');
    const body = el('div.sh2-pw', null, el('div.sh2-pw-ssid', null, ssid));
    if (G.ui.field) {
      field = G.ui.field({ placeholder: T(D.pwPh), mode: 'en', password: true, predict: false, ctx: 'wifiPw', qa: 'wifi.pw', submitLabel: T(D.join),
        onSubmit: () => tryJoin() });
      field.node.classList.add('sh2-pwfield');
      body.appendChild(field.node);
    }
    body.appendChild(msg);
    let close = null;
    const tryJoin = () => {
      const v = field ? field.value : '';
      if (PH().wifi.join(ssid, v)) { G.ui.hideKeyboard && G.ui.hideKeyboard(); close && close('ok'); return; }
      sfx('error'); body.classList.remove('shake'); void body.offsetWidth; body.classList.add('shake'); if (field) field.clear();
    };
    PH().sheet({ title: STR('pwEnter'), body, kind: 'sheet', qa: 'wifi.join', buttons: [], mount: (fin, box) => {
      close = fin;
      box.appendChild(el('div.sht-btns', null,
        el('button.sht-btn', { 'data-qa': 'sheet.btn:cancel', onclick: () => { sfx('tap'); G.ui.hideKeyboard && G.ui.hideKeyboard(); fin('cancel'); } }, T(D.cancel)),
        el('button.sht-btn.primary', { 'data-qa': 'sheet.btn:ok', onclick: () => { sfx('tap'); tryJoin(); } }, T(D.join))));
      if (field) setTimeout(() => field.focus(), 200);
    }, onClose: () => { G.ui.hideKeyboard && G.ui.hideKeyboard(); } });
  }
  APP.joinSheet = joinSheet;
  APP.register('wifi.saved', {
    title: () => S().wifi.saved,
    render(api) {
      const W = PH().wifi; api.on('wifi:change', api.refresh);
      const saved = W.saved();
      const nets = ((G.STORY.security && G.STORY.security.wifi) || []).filter((n) => saved.includes(n.id));
      return el('div', null, group(null, nets.map((n) => {
        const sub = n.id === 'saemal_rooftop' ? (W.connected() ? S().wifi.connected : S().wifi.savedShort) : T(n.line);
        const k = n.id === 'saemal_rooftop' ? 'wifi.saved.saemal_rooftop' : 'wifi.net';
        return row({ title: n.id, sub, key: k, params: { ssid: n.id }, qa: 'settings.row:' + (n.id === 'saemal_rooftop' ? k : 'wifi.saved.' + n.id) });
      })));
    },
  });
  /* saved network detail (hotspot · Haesol_404) — §4.6.6 */
  APP.register('wifi.net', {
    title: (api) => api.params.ssid || '',
    render(api) {
      const n = ((G.STORY.security && G.STORY.security.wifi) || []).find((x) => x.id === api.params.ssid) || { detail: [] };
      const rows = (n.detail || []).map((d) => { const s = T(d); const i = s.indexOf('  '); return i > 0 ? row({ title: s.slice(0, i), meta: s.slice(i).trim() }) : row({ title: s }); });
      return el('div', null, hero(api.params.ssid || ''), group(null, rows),
        el('div.sh2-actions', null, btnRow(S().wifi.del, () => { PH().wifi.forget(api.params.ssid); api.back(); }, { qa: 'wifi.forget', danger: true })));
    },
  });

  APP.register('bt', {
    title: () => S().btScreen.title,
    render(api) {
      const D = S().btScreen;
      api.on('bt:change', api.refresh); api.on('flag', api.refresh); api.on('flag:off', api.refresh);
      const on = PH().btOn ? PH().btOn() : true;
      const bt = G.media && G.media.bt;
      const tg = toggle(on, (v) => { if (bt) safe(() => bt.setOn(v)); }, { label: D.title, qa: 'bt.toggle' });
      const wrap = el('div', null,
        group(null, [row({ title: D.title, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(on ? D.on : D.off)), tg), cls: 'big' })]),
        group(null, [row({ title: D.phoneName, meta: D.name })]));
      if (on) {
        const st = btState();
        const gear = el('button.sh2-gear', { 'aria-label': '⚙', 'data-qa': 'bt.gear', html: GL.gear });
        gear.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); APP.open('bt.device'); });
        wrap.appendChild(group(D.saved, [row({ title: PH().btName(), sub: PH().btLabel(), qa: 'bt.device:2층_스피커', cls: st === 'connected' ? 'on' : '',
          icon: el('span.sh2-wfic', { html: GL.speaker }), onClick: () => PH().btTap(), right: gear })]));
        const scan = el('div.sh2-scan', null, T(api._searched ? (D.none || STR('noDevices')) : D.searching));
        wrap.appendChild(group(D.available, [scan]));
        if (!api._searched && !api._searchT) api._searchT = setTimeout(() => { api._searched = true; api.refresh(); }, 2500);
      }
      return wrap;
    },
    onOpen(api) { api.onClose(() => clearTimeout(api._searchT)); },
  });
  /* 2층_스피커 ⚙ (§3.16 · §4.6.7) — no [등록 해제] */
  APP.register('bt.device', {
    title: () => PH().btName(),
    render(api) {
      const D = S().btScreen.detail; const B = (G.STORY.security && G.STORY.security.bt) || {};
      api.on('bt:change', api.refresh); api.on('flag', api.refresh);
      const st = btState();
      const ren = el('button.sh2-link', { 'data-qa': 'bt.rename' }, T(D.rename));
      ren.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); renameSheet({ title: D.rename, value: PH().btName(), ctx: 'btRename', key: 'btRename', after: api.refresh }); });
      const volRow = PH().mediaVolumeRow ? PH().mediaVolumeRow({ target: 'bt', qa: 'bt.vol', title: D.vol, label: D.vol }) : el('div');
      api.own(() => volRow.dispose && volRow.dispose());
      const volHead = volRow.querySelector && volRow.querySelector('.vol-top');
      if (volHead) { volHead.classList.add('tap'); volHead.addEventListener('click', () => { sfx('tap'); PH().volume && PH().volume({ focus: 'media' }); }); }
      const rows = [
        row({ title: D.name, meta: PH().btName(), right: el('span.sh2-tgwrap', null, el('span.sh2-meta', null, PH().btName()), ren) }),
        row({ title: D.kind, meta: B.kind }),
        row({ title: D.added, meta: B.added }),
        row({ title: D.by }),
        row({ title: D.last, meta: st === 'connected' ? D.connectedNow : B.last }),
        el('div.sh2-volrow', null, volRow),
        row({ title: D.call, meta: D.callOff }),
      ];
      const wrap = el('div', null, hero(PH().btName(), PH().btLabel(), el('span.sh2-ic.big', { style: { background: '#3e91ff' }, html: GL.bt })), group(null, rows));
      if (st === 'connected') wrap.appendChild(el('div.sh2-actions', null, btnRow(D.disconnect, () => { const bt = G.media && G.media.bt; if (bt) safe(() => bt.disconnect()); }, { qa: 'bt.disconnect' })));
      return wrap;
    },
  });
  /** rename sheet — free text lives only in the session store (ARCH §9 G49) */
  function renameSheet(o) {
    let field = null;
    const body = el('div.sh2-pw');
    if (G.ui.field) {
      field = G.ui.field({ placeholder: T(o.value || ''), mode: 'ko', predict: true, ctx: o.ctx, qa: 'rename.field', maxLength: 20, submitLabel: '확인', onSubmit: () => done() });
      field.node.classList.add('sh2-pwfield');
      body.appendChild(field.node);
    }
    let fin = null;
    const done = () => {
      const v = field ? String(field.value || '').trim() : '';
      if (v && G.e2 && G.e2.session && G.e2.session.set) safe(() => G.e2.session.set(o.key, v));
      G.ui.hideKeyboard && G.ui.hideKeyboard();
      fin && fin('ok');
      o.after && o.after();
    };
    PH().sheet({ title: o.title, body, kind: 'sheet', qa: 'rename', mount: (f, box) => {
      fin = f;
      box.appendChild(el('div.sht-btns', null,
        el('button.sht-btn', { 'data-qa': 'sheet.btn:cancel', onclick: () => { sfx('tap'); G.ui.hideKeyboard && G.ui.hideKeyboard(); f('cancel'); } }, '취소'),
        el('button.sht-btn.primary', { 'data-qa': 'sheet.btn:ok', onclick: () => { sfx('tap'); done(); } }, '확인')));
      if (field) setTimeout(() => field.focus(), 200);
    }, onClose: () => { G.ui.hideKeyboard && G.ui.hideKeyboard(); } });
  }
  APP.renameSheet = renameSheet;

  /* =========================================================
   * 소리 및 진동 · 볼륨 · 알림 소리 · 대화별 알림음 (§3.11 · §4.6.7 · §4.6.8)
   * ========================================================= */
  const TONES_FB = [{ id: 'dash', label: '—', sub: '추가한 소리 · 2026.11.25' }, { id: 'water', label: '물방울' }, { id: 'toktok', label: '톡톡', sub: '(기본)' }, { id: 'bell', label: '종소리' }];
  const toneList = () => (G.tones && G.tones.list) || TONES_FB;
  const toneLabel = (id) => { const t = toneList().find((x) => x.id === id); return t ? t.label : '—'; };
  const defTone = () => (isDash() ? (SH().dashTone || 'dash') : (G.tones && G.tones.getDefault ? safe(() => G.tones.getDefault(), 'dash') : vget('toneDefault', 'dash')));
  APP.register('sound', {
    title: () => S().sound.title,
    render(api) {
      const D = S().sound;
      const mode = vget('soundMode', 'sound');
      const seg = el('div.sh2-seg', null, D.modes.map(([v, l]) => {
        const b = el('button' + (mode === v ? '.on' : ''), { 'data-qa': 'sound.mode:' + v }, T(l));
        b.addEventListener('click', () => { sfx('tap'); vset('soundMode', v); api.refresh(); });
        return b;
      }));
      return el('div', null,
        group(null, [el('div.sh2-segrow', null, el('span', null, T(D.mode)), seg)]),
        group(null, [
          row({ key: 'volume', title: D.volume }),
          row({ key: 'sound.notif', title: D.notifTone, meta: toneLabel(defTone()) }),
          row({ title: D.ringtone, meta: D.ringtoneMeta }),
        ]));
    },
  });
  APP.register('volume', {
    title: () => S().volume.title,
    render(api) {
      const V = S().volume;
      const media = PH().mediaVolumeRow ? PH().mediaVolumeRow({ qa: 'sound.vol:media' }) : el('div');
      api.own(() => media.dispose && media.dispose());
      const deco = (label, v) => el('div.vol-row', null, el('div.vol-top', null, el('span.vol-h', null, T(label))), slider(v, { label }));
      return el('div', null, group(null, [el('div.sh2-volcard', null, media, deco(V.ring, 40), deco(V.notif, 30), deco(V.system, 30))]));
    },
    resume: false,
  });
  /** a tone radio list (default tone or a chat's tone) */
  function toneRows(api, sel, choose) {
    return toneList().map((t) => {
      const on = sel === t.id;
      const r = row({ title: t.label, sub: t.sub || '', qa: 'tone.opt:' + t.id, cls: 'radio' + (on ? ' sel' : ''), icon: el('span.sh2-radio' + (on ? '.on' : '')), chev: false,
        onClick: () => choose(t.id) });
      return r;
    });
  }
  function preview(id, screenKey) {
    if (!G.tones) return;
    if (G.tones.preview) safe(() => G.tones.preview(id, { screenKey }));
    else if (G.tones.play) safe(() => G.tones.play(id, { ledger: id === 'dash' }));
  }
  APP.register('sound.notif', {
    title: () => S().tone.title,
    onOpen() { if (!isDash()) setFlag('soundSettingsOpened'); },
    render(api) {
      const D = S().tone;
      const dash = isDash();
      const choose = (id) => {
        if (dash) { SH().dashTone = id; save(); preview(id, 'sound.notif.dash'); api.refresh(); return; }
        if (G.tones && G.tones.setDefault) {
          if (G.tones.preview) { safe(() => G.tones.setDefault(id, { preview: false })); preview(id, 'sound.notif'); }
          else safe(() => G.tones.setDefault(id, { preview: true }));
        } else vset('toneDefault', id);
        api.refresh();
      };
      const wrap = el('div', null, group(null, toneRows(api, defTone(), choose)));
      wrap.appendChild(el('div.sh2-actions', null, btnRow(D.reset, () => choose('toktok'), { qa: 'tone.reset' })));
      if (!dash) wrap.appendChild(group(null, [row({ key: 'notif.perChat', title: D.perChat, meta: '2', qa: 'tone.perChat' })]));
      return wrap;
    },
  });
  APP.register('notif.perChat', {
    title: () => S().tone.perChat,
    onOpen() { if (!isDash()) setFlag('perChatSeen'); },
    render() {
      if (isDash()) return el('div.sh2-empty', null, '없음');
      const getChat = (c) => (G.tones && G.tones.getChat ? safe(() => G.tones.getChat(c), 'dash') : (c === 'fake' ? vget('toneChatFake', 'dash') : 'dash'));
      return el('div', null, group(null, (S().perChat || []).map((p) => {
        const changed = p.chat === 'fake' && SH().perChatChanged;
        const sub = el('span.sh2-pc', null, el('span', null, T(changed ? p.changedLine : p.line)), p.grey ? el('span.sh2-pc-g', null, T(p.grey)) : null);
        return row({ title: p.label, sub, meta: toneLabel(getChat(p.chat)), qa: 'perchat.row:' + p.chat, grey: !!p.locked, key: p.locked ? null : 'notif.perChat.' + p.chat });
      })));
    },
  });
  APP.register('notif.perChat.fake', {
    title: () => T('{MAKER_CONTACT}'),
    render(api) {
      const cur = G.tones && G.tones.getChat ? safe(() => G.tones.getChat('fake'), 'dash') : vget('toneChatFake', 'dash');
      const choose = (id) => {
        if (G.tones && G.tones.setChat) safe(() => G.tones.setChat('fake', id)); else vset('toneChatFake', id);
        SH().perChatChanged = true; save();
        preview(id, 'notif.perChat');
        api.refresh();
      };
      return el('div', null, group(null, toneRows(api, cur, choose)));
    },
  });
  APP.register('notif', {
    title: () => S().notif.title,
    render(api) {
      const D = S().notif;
      const dnd = toggle(!!vget('dnd', false), (v) => { vset('dnd', v); }, { label: D.dnd, qa: 'notif.dnd' });
      void api;
      return el('div', null, group(null, [row({ key: 'notif.apps', title: D.apps }), row({ title: D.dnd, right: dnd })]));
    },
  });
  APP.register('notif.apps', {
    title: () => S().notif.apps,
    render() {
      const home = (G.EP && G.EP.HOME && G.EP.HOME[user()]) || { apps: [], dock: [] };
      const ids = (home.apps || []).concat(home.dock || []).filter((id) => G.apps && G.apps[id]);
      return el('div', null, group(null, ids.map((id) => {
        const a = G.apps[id];
        const icon = el('span.sh2-appic', { style: { background: (a.icon && a.icon.bg) || '#888' }, html: (a.icon && a.icon.svg) || '' });
        return id === 'moment' ? row({ key: 'notif.apps.moment', title: a.name, icon }) : row({ title: a.name, icon });
      })));
    },
  });
  APP.register('notif.apps.moment', {
    title: () => S().notif.moment,
    render() { return el('div', null, group(null, [row({ key: 'notif.perChat', title: S().tone.perChat, meta: isDash() ? '' : '2' })])); },
  });

  /* =========================================================
   * 디스플레이 · 배경화면 (§4.6.11 · §4.6.4)
   * ========================================================= */
  APP.register('display', {
    title: () => S().display.title,
    render(api) {
      const D = S().display;
      const cur = (G.settings && G.settings.textSize) || 1;
      const near = D.sizes.reduce((a, o) => (Math.abs(o[0] - cur) < Math.abs(a - cur) ? o[0] : a), D.sizes[0][0]);
      const seg = el('div.sh2-ts', null, D.sizes.map(([v, l], i) => {
        const b = el('button' + (v === near ? '.on' : ''), { 'data-qa': 'display.textSize:' + v }, el('b', { style: { fontSize: 13 + i * 3 + 'px' } }, T(D.sample)), el('small', null, l));
        b.addEventListener('click', () => {
          sfx('tap');
          if (G.settings) { G.settings.textSize = v; if (G.saveSettings) G.saveSettings(); }
          const scr = document.getElementById('screen'); if (scr) scr.style.setProperty('--ts', String(v));
          api.refresh();
        });
        return b;
      }));
      const dark = toggle(!!SH().darkMode, (v) => { SH().darkMode = v; save(); }, { label: D.dark });
      return el('div', null,
        group(null, [el('div.sh2-slrow', null, el('span', null, T(D.brightness)), slider(62, { label: D.brightness }))]),
        group(D.textSize, [seg]),
        group(null, [row({ title: D.dark, right: dark })]));
    },
  });
  APP.register('wallpaper', {
    title: () => S().wallpaper.title,
    render() {
      const D = S().wallpaper;
      const u = user();
      const US = (G.STORY && G.STORY.users) || {};
      const U = US[u] || {};
      const src = (k) => (G.e2 && G.e2.img ? G.e2.img(k) : (G.IMG && G.IMG[k])) || '';
      const thumb = (k, cls) => { const t = el('div.sh2-wthumb' + (cls ? '.' + cls : '')); const s = src(k); if (s) { t.style.backgroundImage = `url("${s}")`; const im = new Image(); im.onerror = () => { t.style.backgroundImage = ''; t.classList.add('wall-' + k, 'wall-missing'); }; im.src = s; } else t.classList.add('wall-' + k, 'wall-missing'); return t; };
      const prev = el('div.sh2-wprev', null, thumb(U.lock || (u === 'dash' ? 'old_room_lock' : 'n_wall'), 'lock'), thumb(U.wall || (u === 'dash' ? 'old_room' : 'n_wall'), 'home'));
      const rows = [row({ title: D.home, meta: u === 'dash' ? D.dashMeta : '' })];
      if (u === 'n') rows.push(row({ title: D.widget, sub: (US.n || {}).widget || '', onClick: () => { G.lock && G.lock.widgetPreview && G.lock.widgetPreview(); }, qa: 'settings.row:wallpaper.widget' }));
      return el('div', null, prev, group(null, rows));
    },
  });

  /* =========================================================
   * 위치 · 계정 및 백업 · 배터리 · 휴대전화 정보 · 일반 (§4.6.11 · ARCH §4.22)
   * ========================================================= */
  APP.register('location', {
    title: () => S().location.title,
    render() {
      const D = S().location;
      const tg = toggle(SH().locOff !== true, (v) => { SH().locOff = !v; save(); }, { label: D.title });
      return el('div', null,
        group(null, [row({ title: D.title, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(D.on)), tg), cls: 'big' })]),
        group(D.services, D.rows.map(([t, m]) => row({ title: t, meta: m }))),
        group(D.recentHead, D.recent.map(([t, m]) => row({ title: t, meta: m }))));
    },
  });
  APP.register('accounts', {
    title: () => S().accounts.title,
    render() { return el('div', null, group(null, [row({ key: 'accounts.manage', title: S().accounts.manage })])); },
  });
  APP.register('accounts.manage', {
    title: () => S().accounts.manage,
    render() {
      const D = S().accounts;
      return el('div', null, el('div.sh2-empty', null, T(isDash() ? S().dash.account : D.empty)),
        el('div.sh2-actions', null, btnRow(D.add, () => APP.open('accounts.login'), { qa: 'accounts.add', primary: true })));
    },
  });
  APP.register('accounts.login', {
    title: () => S().accounts.loginTitle,
    render(api) {
      const D = S().accounts;
      const mk = (ph, ctx, pw) => { if (!G.ui.field) return el('div'); const f = G.ui.field({ placeholder: T(ph), mode: 'en', password: !!pw, predict: false, ctx, qa: 'accounts.' + ctx }); f.node.classList.add('sh2-pwfield'); return f.node; };
      const out = el('div.sh2-login-out');
      const go = () => {
        out.innerHTML = '';
        out.append(el('div.sh2-login-msg', null, STR('newDeviceCode')), el('div.sh2-login-msg', null, STR('smsSent')), el('div.sh2-login-sim', null, T(D.sim)));
      };
      void api;
      return el('div.sh2-login', null, el('div.sh2-fields', null, mk(D.id, 'daonId', false), mk(D.pw, 'daonPw', true)),
        el('div.sh2-actions', null, btnRow(D.login, () => { G.ui.hideKeyboard && G.ui.hideKeyboard(); go(); }, { qa: 'accounts.login', primary: true })), out);
    },
  });
  APP.register('battery', {
    title: () => S().battery.title,
    render(api) {
      const D = S().battery;
      const b = G.battery ? G.battery() : 67;
      api.on('clock:min', api.refresh);
      return el('div', null,
        el('div.sh2-batt', null, el('div.sh2-batt-big', null, String(b), el('small', null, '%')), el('div.sh2-batt-bar', null, el('i', { style: { width: Math.max(3, b) + '%' } }))),
        group(D.usageHead, [row({ title: D.usage, cls: 'wrap' })]));
    },
  });
  function uptime() {
    const d = now();
    const from = new Date(2026, 11, 24, 18, 0, 0).getTime();
    const s = Math.max(0, Math.floor((d.getTime() - from) / 1000));
    return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  APP.register('about', {
    title: () => S().about.title,
    render(api) {
      const D = S().about; const R = D.rows;
      const up = el('span.sh2-meta.mono.sh2-uptime', null, uptime());
      let last = '';
      api.on('tick', () => { const u = uptime(); if (u === last) return; last = u; const n = api.scr && api.scr.querySelector('.sh2-uptime'); if (n) n.textContent = u; });
      return el('div', null,
        hero(D.name, D.model, el('span.sh2-phoneic')),
        group(null, [row({ title: R.name, meta: D.name }), row({ title: R.model, meta: D.model }), row({ title: R.number, meta: D.number }),
          row({ title: R.sim, meta: D.sim }), row({ title: R.uptime, right: up }), row({ title: R.sw })]));
    },
  });
  APP.register('general', {
    title: () => S().general.title,
    render() {
      const D = S().general;
      return el('div', null, group(null, [row({ key: 'kbd', title: D.kbd }), row({ title: D.lang }), row({ title: D.date })]));
    },
  });

  APP.ui.fmtUptime = uptime;
  APP.toneLabel = toneLabel;
  APP.isDash = isDash;
  APP.flag = flag;
})();
