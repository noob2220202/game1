/* =========================================================
 * Phone shell (ep2) — owner: shell. DESIGN §3.2 · §3.9 · §4.0 · §4.6.1 · §4.6.6 · §4.6.7 · §4.8 · §4.10.4 · §5.1–§5.4 · §5.7
 * ARCH §2.3 (layers) · §4.9 · §4.20 · §4.21 · §6.3.
 *
 * Public API
 *   G.app(id, { name, icon:{bg, svg}, open(params), badge(user) → int }) · G.apps
 *   G.ui.screen({ title, sub, back, right, theme, cls, bodyCls, body, footer, header }) → section   (ep1 builder; back = data-qa nav.back)
 *   G.ui.list([{ title, sub, meta, icon, onClick, disabled, chevron, cls, qa }]) → div.list
 *   G.phone.init() · openApp(id, params) · push(node, opts) · pop() · back() → bool · home() · closeAll(silent) · top() · stackDepth()
 *   G.phone.canBack() · pushBack(fn) → remove() · dismissModals() · modalOpen() · isLocked() · setLocked(on) · lockLayer()
 *   G.phone.renderHome() · refreshBadges() · iconNode(app) · setWallpaper(src) · statusTheme(t) · updateStatus() · route({app, params})
 *   G.phone.notify(o) → { id, banner } · notifList(user) · markRead(pred) · dismissNotif(id) · unread(user, app)
 *   G.phone.dialog(o) → Promise · sheet(o) → Promise · toast(text, ms) · overlay(node, opts) → {node, close()}
 *   G.phone.quickPanel() · closeQuickPanel() · volume({focus}) · nearShare({from, count}) → Promise<'accept'|'decline'>
 *   G.phone.wifi = { on, setOn, connected, saved, forget, join, restore, auto, setAuto }
 *   G.phone.btTap() (shared 2층_스피커 row behaviour) · G.phone.ui = { slider, toggle } (shell-internal builders)
 *   G.users = { current, switching, switchTo, forceN, canSwitch, dashHidden, dashLocked, unlockDash, lockDash }
 *   G.phone.user = G.users.current · G.phone.switchUser = G.users.switchTo
 * Bus emitted: app:open · screen:push · screen:pop · home · home:show {user} · quickpanel · qs:users {shown} · notify · notify:shown {id}
 *              users:switching {from,to} · users:switched {from,to} · users:dashUnlocked {first} · wifi:change {on, connected}
 * Hooks set: users:lockDash. Hooks called: pause:open.
 * Flags set: dashSeen (QS user row drawn), M3 (unlockDash — first '0310').  Vars: user · wifiOn · wifiSaved · soundMode · dnd · pinTries · sh.*
 * No 'tick' emitter here (core base.js owns the 250 ms tick); no G.tones calls except notify routing + in-app pop.
 *
 * ep3 additions (ARCH_EP3 §4.2 phone.js · §5.7 — every one is data-gated; with ep2's G.EP the ep2 path is unchanged):
 *   (a) G.EP.HOME[u].render(homeEl, api) — custom home (easy home); api = { openApp(id, params), iconNode(app, o),
 *       setWallpaper(src, key), hm() → 'H:MM', date() → '1월 24일 일요일', statusTheme(t) }
 *   (b) G.EP.HOME[u].apps items { folder:'<name>', apps:[ids] } → folder icon (data-qa home.folder) → overlay grid of
 *       home.app:<id> + scrim home.folder.close (tap outside · back · Esc · home close it) · first open: flag folderSeen +
 *       bus 'folder:open' {name}
 *   (c) G.EP.HOME[u].widgetOpen:'calendar' → the widget's time opens 시계, its date line (data-qa home.widget.date) opens
 *       the calendar (ep2: the whole widget opens 시계)
 *   (d) G.EP.STATUS {net, wifi} → status bar `LTE` + bars · Wi-Fi name · time as 'H:MM' · sound-mode / DND glyphs; no SIM 없음
 *   (e) G.EP.QS.tiles drawn in list order (wifi · bt · flash builders unchanged) + new ids 'sound' (소리 → 진동 → 무음 =
 *       vars.soundMode) and 'dnd' (tap = vars.dndNow · long-press 0.5 s = G.settingsApp.open(G.EP.QS.dndLong)); with
 *       G.EP.STATUS the Wi-Fi tile label = G.EP.STATUS.wifi and an empty panel says STR.noNotif
 *   (f) G.phone.callScreen(spec) → Promise<{sec, by}> · G.phone.inCall() — layer .sh3-call z 47 (data-qa call.screen ·
 *       call.end · call.btn:speaker|mute|keypad) · bus 'call:start' {id, kind, number, name} · 'call:end' {id, kind, number, sec, by}
 *   (g) push(): node.dataset.scr → entry.scr (and the 'screen:push' payload)
 *   (h) notify: hook 'chat:isOpen' (when set) instead of G.moment.isOpen · mute on vars.dnd ∨ vars.dndNow ∨ DND schedule ·
 *       vars.dndNow (or 앱 알림 off) → no banner, no sound, no vibration (panel + badge only) · vibrate key G.tones.vibKey ·
 *       no 3-tone cap when G.tones.cap === 0 · re-notify with the same unread id → entry.count++ (panel `새 메시지 {k}개`) ·
 *       easy mode: banner / panel tap on an sms entry → G.easy.sms(thread)
 *   (i) Wi-Fi with G.EP.STATUS = plain on/off (no saved list, no auto-on sched)
 *   (j) G.phone.textScale(f) — phone layers' --ts = G.settings.textSize × f (easymode E10 · display.font) · homeStatus()
 * ep3 bus out: folder:open · call:start · call:end.  ep3 flags set: folderSeen.  ep3 vars: dndNow · dndAt · soundMode · sh.*
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UTIL = G.util || {};
  const el = UTIL.el;
  const pad = UTIL.pad || ((n) => String(n).padStart(2, '0'));
  const sleep = UTIL.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  const P = (G.phone = G.phone || {});
  const apps = (G.apps = G.apps || {});
  let root, statusBar, homeEl, stackEl, lockEl, overlayEl, bannerEl, homeBar, wallpaperEl, switchEl, toastEl;
  const stack = [];           // [{node, appId, onBack, onClose, onResume}]
  const backStack = [];       // G.phone.pushBack handlers (LIFO)
  const overlays = [];        // [{node, kind, onBack, dismiss, modal}]

  /* ---------------- small helpers ---------------- */
  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { console.error('[phone] lazy text', e); s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const STR = (k) => T((G.e2 && G.e2.STR && G.e2.STR[k]) || '');
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const vget = (k, def) => { const v = G.state && G.state.vars ? G.state.vars[k] : undefined; return v === undefined ? def : v; };
  const vset = (k, v) => { if (G.vars) G.vars(k, v); };
  const SH = () => { const v = (G.state && G.state.vars) || {}; if (!v.sh) v.sh = {}; return v.sh; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const cue = (id, o) => { try { return G.audio && G.audio.cue ? G.audio.cue(id, o) : undefined; } catch (e) { console.error('[phone] cue', id, e); } };
  const vibrate = (k) => { try { if (G.audio && G.audio.vibrate) G.audio.vibrate(k); } catch (e) {} };
  const img = (key) => { try { if (G.e2 && G.e2.img) return G.e2.img(key) || ''; } catch (e) {} return (G.IMG && G.IMG[key]) || ''; };
  const now = () => (G.clock && G.clock.now ? G.clock.now() : new Date(2026, 11, 24, 23, 12));
  const hm = () => { if (G.clock && G.clock.hm) return G.clock.hm(); const d = now(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtK = (d) => { if (G.e2 && G.e2.fmtK) return G.e2.fmtK(d); const h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}`; };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const kDate = (d) => (UTIL.fmtKDate ? UTIL.fmtKDate(d) : `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`);
  const playMs = () => (G.state && G.state.playMs) || 0;
  const battery = () => { try { return G.battery ? G.battery() : 67; } catch (e) { return 67; } };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[phone]', e); return d; } };
  const qa = (node, v) => { if (node && v) node.setAttribute('data-qa', v); return node; };
  P._T = T; P._STR = STR;
  /* ep3 switch helpers (ARCH_EP3 §4.1-1: G.EP.STATUS is ep3-only) */
  const ST = () => (G.EP && G.EP.STATUS) || null;
  /** 'H:MM' (status bar · widgets · lock in ep3 — a real phone drops the leading zero) */
  const shortHm = () => { const s = hm(); const m = /^(\d{1,2}):(\d{2})/.exec(s); if (!m) return s; const h = +m[1] % 12 || 12; return h + ':' + m[2]; };
  const timeText = () => (ST() ? shortHm() : hm());
  P.shortHm = shortHm;
  const dndActive = () => !!vget('dnd', false) || !!vget('dndNow', false) || !!(ST() && SH().dndSched);

  /* glyphs */
  const SVG = {
    pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/></svg>',
    wifi: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0119 0M5.5 12.2a9.5 9.5 0 0113 0M8.6 15.4a5 5 0 016.8 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/></svg>',
    bt: '<svg viewBox="0 0 24 24"><path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flash: '<svg viewBox="0 0 24 24"><path d="M8 2.5h8v4l-2 3V21a1 1 0 01-1 1h-2a1 1 0 01-1-1V9.5l-2-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 13v2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13.2l1.7 1.3-1.8 3.1-2-.8a7.6 7.6 0 01-2 1.2l-.3 2.1h-3.6l-.3-2.1a7.6 7.6 0 01-2-1.2l-2 .8-1.8-3.1 1.7-1.3a7.8 7.8 0 010-2.4L3.4 9.5l1.8-3.1 2 .8a7.6 7.6 0 012-1.2l.3-2.1h3.6l.3 2.1a7.6 7.6 0 012 1.2l2-.8 1.8 3.1-1.7 1.3a7.8 7.8 0 010 2.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.6" fill="currentColor"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><rect x="6" y="2.8" width="12" height="18.4" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="14.6" r="3.3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="7.2" r="1.2" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8" stroke="currentColor" stroke-width="1.7"/></svg>',
    /* ep3 (status bar · quick panel · call screen) */
    bars: '<svg viewBox="0 0 24 24"><rect x="3" y="15" width="3.4" height="5" rx=".8" fill="currentColor"/><rect x="8.2" y="11.5" width="3.4" height="8.5" rx=".8" fill="currentColor"/><rect x="13.4" y="8" width="3.4" height="12" rx=".8" fill="currentColor"/><rect x="18.6" y="4.5" width="3.4" height="15.5" rx=".8" fill="currentColor" opacity=".38"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    vib: '<svg viewBox="0 0 24 24"><rect x="8" y="4" width="8" height="16" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 8.5v7M2 10v4M19.5 8.5v7M22 10v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    dnd: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M7.6 12h8.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    callEnd: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>',
    spk: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    pad: '<svg viewBox="0 0 24 24"><g fill="currentColor"><circle cx="6" cy="5" r="1.7"/><circle cx="12" cy="5" r="1.7"/><circle cx="18" cy="5" r="1.7"/><circle cx="6" cy="11" r="1.7"/><circle cx="12" cy="11" r="1.7"/><circle cx="18" cy="11" r="1.7"/><circle cx="6" cy="17" r="1.7"/><circle cx="12" cy="17" r="1.7"/><circle cx="18" cy="17" r="1.7"/><circle cx="12" cy="22" r="1.4"/></g></svg>',
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>',
  };
  P.SVG = SVG;
  // ARCH §4.2 labels — used only when an app has not registered (partial builds)
  const LABELS = { talk: '톡', moment: '모먼트', mail: '메일', gallery: '갤러리', camera: '카메라', memo: '메모', browser: '인터넷', recorder: '녹음',
    clock: '시계', calendar: '캘린더', alerts: '재난 알림', timeline: '타임라인', phone: '전화', settings: '설정',
    sms: '메시지', moim: '모임', voicerec: '음성 녹음', files: '내 파일', weather: '날씨' };     // ep3 ids (ARCH_EP3 §5.2 labels)
  const HOME_FALLBACK = {
    n: { apps: ['talk', 'moment', 'mail', 'gallery', 'camera', 'memo', 'browser', 'recorder', 'clock', 'calendar', 'alerts', 'timeline'], dock: ['phone', 'settings'], wall: 'n_wall', widget: 'clock' },
    dash: { apps: ['gallery', 'memo', 'moment', 'clock', 'settings'], dock: [], wall: 'old_room', widget: null },
  };
  const manifest = (u) => ((G.EP && G.EP.HOME && G.EP.HOME[u]) || HOME_FALLBACK[u] || HOME_FALLBACK.n);

  /* ---------------- registry ---------------- */
  /** G.app(id, { name, icon:{bg, svg}, open(params), badge(user) }) — home placement comes from G.EP.HOME[user] (ARCH §4.9) */
  G.app = function (id, def) { def.id = id; apps[id] = def; if (homeEl) scheduleHome(); };

  /* =========================================================
   * init (called by flow G.main.boot — ARCH §4.1)
   * ========================================================= */
  let inited = false;
  P.init = function () {
    if (inited) return; inited = true;
    root = document.getElementById('screen');
    if (!root) { console.error('[phone] #screen missing'); return; }
    wallpaperEl = el('div.wallpaper');
    homeEl = el('div#home.layer');
    stackEl = el('div#app-stack.layer');
    lockEl = el('div#lock.layer.hidden');
    overlayEl = el('div#overlays.layer');
    switchEl = el('div.sh2-switch.hidden', { 'data-qa': 'switch.shell', 'aria-live': 'polite' });
    bannerEl = el('div#banners');
    statusBar = buildStatusBar();
    homeBar = el('div.home-bar', { role: 'button', 'aria-label': '홈', 'data-qa': 'home.bar' }, el('i'));
    toastEl = el('div.sh2-toasts');
    overlayEl.appendChild(toastEl);
    root.append(wallpaperEl, homeEl, stackEl, lockEl, overlayEl, switchEl, bannerEl, statusBar, homeBar);

    // home indicator: tap or swipe up -> home
    let sy = null;
    homeBar.addEventListener('pointerdown', (e) => { sy = e.clientY; });
    homeBar.addEventListener('pointerup', (e) => { const up = sy != null && sy - e.clientY > 20; sy = null; if (up) P.home(); });
    homeBar.addEventListener('click', () => P.home());

    // Android back (history trap) — §9.5-4. Second back on the home within 2.5 s leaves the game.
    try {
      history.replaceState({ haru: 0 }, '');
      history.pushState({ haru: 1 }, '');
      let lastBack = 0, leaving = false;
      window.addEventListener('popstate', () => {
        if (leaving) return;
        if (P.back()) { try { history.pushState({ haru: 1 }, ''); } catch (e) {} return; }
        const t = Date.now();
        if (t - lastBack < 2500) { leaving = true; try { history.back(); } catch (e) {} return; }
        lastBack = t;
        try { history.pushState({ haru: 1 }, ''); } catch (e) {}
        P.toast(STR('exitAgain'));
      });
    } catch (e) {}

    // #screen is overflow:hidden but scrollIntoView() can still shift it — keep the device frame pinned
    root.addEventListener('scroll', () => { if (root.scrollLeft || root.scrollTop) { root.scrollLeft = 0; root.scrollTop = 0; } });
    // eye mode (room) / class changes on #screen → status + home visibility
    try { new MutationObserver(() => { updateStatus(true); checkHome(); if (root.classList.contains('eye-mode')) P.closeQuickPanel(); }).observe(root, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}

    // bus wiring (no load-time cross-owner calls — everything here runs after boot)
    const B = G.bus;
    if (B) {
      ['tick', 'clock:min', 'clock:jump', 'wifi:change', 'bt:change', 'media:out'].forEach((ev) => B.on(ev, () => updateStatus()));
      B.on('flag', (n) => { updateStatus(); scheduleHome(); if (n === 'doorOpened' || n === 'END') qsRefresh(); });
      B.on('flag:off', () => { updateStatus(); scheduleHome(); });
      B.on('var', (e) => { if (e && /^(btVol|phoneVol|wifiOn|wifiSaved|ledState|btOn|user|kbdPredictOff)$/.test(e.k)) { updateStatus(); qsRefresh(); } });
      B.on('clock:min', () => { refreshWidget(); qsRefresh(true); });
      B.on('flag:gotPhone', () => seedNotifs());
      B.on('notify', () => scheduleHome());
      B.on('chat:open', (e) => { const th = e && (e.thread || e.id); if (th) P.markRead((n) => n.chat === th); });
      B.on('moment:thread', (e) => { const th = e && (e.id || e.thread); if (th) P.markRead((n) => n.chat === th); });
      B.on('alerts:open', () => P.markRead((n) => n.app === 'alerts'));
      B.on('lock:unlock', (e) => onUnlockResume(e || {}));
      B.on('app:open', (id) => { if (!P.isLocked() && id) { SH().app = { id, user: USERS.current() }; save(); } });
      B.on('bt:change', () => qsRefresh());
      B.on('wifi:change', () => qsRefresh());
      B.on('room:open', () => { updateLockUnder(); qsRefresh(); });
      B.on('room:close', () => { updateLockUnder(); qsRefresh(); });
      // ep3 (inert on ep2: G.EP.STATUS / textScale are never set there)
      B.on('var', (e) => { if (ST() && e && /^(soundMode|dndNow)$/.test(e.k)) { updateStatus(true); qsRefresh(); } });
      B.on('settings', () => { if (txtScale != null) applyTextScale(); });
    }
    // Wi-Fi auto-on handler (persistent sched id — ARCH §4.24)
    try { if (G.e2 && G.e2.sched && G.e2.sched.on) G.e2.sched.on('shell:wifiAuto', () => wifiAutoFire()); } catch (e) { console.error('[phone] sched', e); }
    G.hooks && G.hooks.set && G.hooks.set('users:lockDash', () => USERS.lockDash());
    if (G.DEBUG) { window.haru = window.haru || {}; if (!ST()) window.haru.setUser = (id) => USERS.switchTo(id, { instant: true });   // ep3 has one user (ARCH_EP3 §7.2)
    window.haru.notifs = () => JSON.parse(JSON.stringify((G.state && G.state.notifs) || [])); }

    if (flag('gotPhone')) seedNotifs();
    P.renderHome();
    updateStatus(true);
  };

  /* =========================================================
   * status bar — §5.3 · ARCH §4.9 (⏸ 44 px · time · SIM 없음 · ᯤ saemal_rooftop · ᛒ · battery)
   * ========================================================= */
  function buildStatusBar() {
    const pause = el('button.sb-pause', { 'aria-label': '일시정지', 'data-qa': 'statusbar.pause', html: SVG.pause });
    pause.addEventListener('click', (e) => { e.stopPropagation(); G.hooks && G.hooks.call('pause:open'); });
    pause.addEventListener('pointerdown', (e) => e.stopPropagation());
    const S3 = ST();
    const sb = el('div#statusbar', { 'data-qa': 'statusbar' },
      el('span.sb-left', null, pause, el('span.sb-time', null, '')),
      el('span.sb-right', null,
        S3 ? el('span.sb-mode.sh3-sbmode') : null,
        S3 ? el('span.sb-net.sh3-net', null, el('b', null, T(S3.net || 'LTE')), el('i.sh3-bars', { html: SVG.bars })) : el('span.sb-net', null, 'SIM 없음'),
        el('span.sb-wifi', null, el('i', { html: SVG.wifi }), el('b', null, '')),
        el('span.sb-bt', { html: SVG.bt }),
        el('span.sb-batt', null, el('b.sb-pct', null, ''), el('span.sb-battbody', null, el('span.sb-battfill')))));
    // quick panel: pull down 8–40 px from the top edge (§9.5-4), or tap the status bar (outside ⏸)
    let sy = null, pulled = false;
    const allowedTarget = (t) => !!(t && t.closest && t.closest('#statusbar, #home, #app-stack, #lock, #banners, .wallpaper'));
    root.addEventListener('pointerdown', (e) => {
      sy = null; pulled = false;
      if (!allowedTarget(e.target) || (e.target.closest && e.target.closest('.sb-pause'))) return;
      const r = root.getBoundingClientRect(); const y = e.clientY - r.top;
      if (y >= 8 && y <= 40) sy = e.clientY;
    }, true);
    root.addEventListener('pointermove', (e) => { if (sy != null && e.clientY - sy > 40) { sy = null; pulled = true; P.quickPanel(); } }, true);
    root.addEventListener('pointerup', () => { sy = null; }, true);
    root.addEventListener('pointercancel', () => { sy = null; }, true);
    sb.addEventListener('click', () => { if (pulled) { pulled = false; return; } P.quickPanel(); });
    return sb;
  }
  let lastSB = '';
  function updateStatus(force) {
    if (!statusBar) return;
    const wifiC = P.wifi.connected();
    const btC = !!(G.media && G.media.bt && G.media.bt.connected ? safe(() => G.media.bt.connected(), false) : flag('btConnected'));
    const b = battery();
    const t = timeText();
    const S3 = ST();
    const ssid = S3 ? T(S3.wifi || '') : 'saemal_rooftop';
    const mode = S3 ? vget('soundMode', 'sound') + (vget('dndNow', false) ? '|dnd' : '') : '';
    const key = [t, b, wifiC, btC].join('|') + (S3 ? '|' + mode : '');
    root.classList.toggle('sh2-locked', P.isLocked() && !lockEl.classList.contains('sh2-under'));
    if (!force && key === lastSB) return;
    lastSB = key;
    if (S3) {
      const sm = statusBar.querySelector('.sh3-sbmode');
      if (sm) {
        const m = vget('soundMode', 'sound');
        sm.innerHTML = (vget('dndNow', false) ? '<i>' + SVG.dnd + '</i>' : '') + (m === 'vibrate' ? '<i>' + SVG.vib + '</i>' : m === 'mute' ? '<i>' + SVG.mute + '</i>' : '');
        sm.style.display = sm.innerHTML ? '' : 'none';
      }
    }
    statusBar.querySelector('.sb-time').textContent = t;
    statusBar.querySelector('.sb-pct').textContent = b + '%';
    const fill = statusBar.querySelector('.sb-battfill');
    fill.style.width = Math.max(4, Math.min(100, b)) + '%';
    const w = statusBar.querySelector('.sb-wifi');
    w.style.display = wifiC ? '' : 'none';
    w.querySelector('b').textContent = ssid;
    statusBar.querySelector('.sb-bt').style.display = btC ? '' : 'none';
  }
  P.updateStatus = () => updateStatus(true);
  P.battery = battery;
  /** status-bar text colour: 'dark' = dark text (light screens) · 'light' = white text */
  P.statusTheme = function (theme) { if (statusBar) statusBar.classList.toggle('dark', theme === 'dark'); };

  /* =========================================================
   * home — per user from G.EP.HOME (§5.1 · §5.2)
   * ========================================================= */
  const wallOk = {};
  P.setWallpaper = function (src, key) {
    if (!wallpaperEl) return;
    wallpaperEl.className = 'wallpaper' + (key ? ' wall-' + key : '');
    if (!src) { wallpaperEl.style.backgroundImage = ''; wallpaperEl.classList.add('wall-missing'); return; }
    if (wallOk[src] === false) { wallpaperEl.style.backgroundImage = ''; wallpaperEl.classList.add('wall-missing'); return; }
    wallpaperEl.style.backgroundImage = `url("${src}")`;
    if (wallOk[src] == null) {
      const im = new Image();
      im.onload = () => { wallOk[src] = true; };
      im.onerror = () => { wallOk[src] = false; if (wallpaperEl.style.backgroundImage.indexOf(src) >= 0) { wallpaperEl.style.backgroundImage = ''; wallpaperEl.classList.add('wall-missing'); } };
      im.src = src;
    }
  };
  let homeTimer = 0, homeHold = 0;
  function scheduleHome() {
    if (homeTimer) return;
    const wait = Math.max(30, homeHold - Date.now());            // ep3: holdHome() defers re-renders during the E8 unfold / fold
    homeTimer = setTimeout(() => { homeTimer = 0; if (Date.now() < homeHold) { scheduleHome(); return; } P.renderHome(); }, wait);
  }
  /** ep3 (easymode E8): keep scheduled home re-renders off the screen for ms (the transition owns the home DOM meanwhile) */
  P.holdHome = function (ms) { homeHold = Date.now() + Math.max(0, +ms || 0); };
  /** ep3: a snapshot of the app stack (easymode fold — 'hidden in easy mode' screens) */
  P.stackEntries = function () { return stack.slice(); };
  const appOf = (id) => apps[id] || { id, name: LABELS[id] || id, icon: (G.ICONS && G.ICONS[id]) || null, _missing: true };
  /** status-bar text colour over the home: dark on the easy home's cream (ep3), else light (ep2: always light) */
  function homeStatus() { const m = safe(() => manifest(USERS.current()), null); return m && m.easy ? 'dark' : 'light'; }
  P.homeStatus = homeStatus;
  const homeApi = () => ({ openApp: (id, p) => P.openApp(id, p), iconNode: (a, o) => P.iconNode(a, o), setWallpaper: (s, k) => P.setWallpaper(s, k),
    hm: shortHm, date: () => kDate(now()), statusTheme: (t) => P.statusTheme(t), img });
  P.renderHome = function () {
    if (!homeEl) return;
    const user = USERS.current();
    const m = manifest(user);
    P.setWallpaper(img(m.wall), m.wall);
    homeEl.innerHTML = '';
    homeEl.dataset.user = user;
    if (homeEl.dataset.mode) {                               // ep3: drop what a custom home put on #home last time
      Array.from(homeEl.classList).forEach((c) => { if (/^(ez3|sh3)-/.test(c)) homeEl.classList.remove(c); });
      homeEl.removeAttribute('data-qa'); delete homeEl.dataset.scr;
    }
    if (typeof m.render === 'function') {                    // ep3 (a) — custom home (easy home)
      homeEl.dataset.mode = m.easy ? 'easy' : 'custom';
      let drawn = false;
      try { const r = m.render(homeEl, homeApi()); drawn = r !== null && r !== false && homeEl.childNodes.length > 0; } catch (e) { console.error('[phone] home render', e); }
      if (!drawn) {                                           // partial build (renderer absent): a plain grid of the same apps
        homeEl.innerHTML = '';
        const ids = m.apps || (((G.STORY && G.STORY.easy && G.STORY.easy.home) || []).map((r) => r[0]));
        const grid = el('div.app-grid');
        ids.forEach((id) => grid.appendChild(P.iconNode(appOf(id), { user })));
        homeEl.appendChild(grid);
      }
      if (ST() && !stack.length && !P.isLocked()) P.statusTheme(homeStatus());
      checkHome();
      return;
    }
    if (ST()) homeEl.dataset.mode = 'std';
    if (m.widget === 'clock') {
      const d = now();
      if (m.widgetOpen) {                                     // ep3 (c) — time → 시계 · date line → widgetOpen (캘린더)
        const tb = el('button.hw-time', { 'aria-label': T(LABELS.clock) }, timeText());
        const db = el('button.hw-date', { 'data-qa': 'home.widget.date' }, kDate(d));
        tb.addEventListener('click', () => { sfx('tap'); P.openApp(apps.clock ? 'clock' : m.widgetOpen); });
        db.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); P.openApp(m.widgetOpen); });
        homeEl.appendChild(el('div.home-widget.sh3-widget', { 'data-qa': 'home.widget' }, tb, db));
      } else {
        const w = el('button.home-widget', { 'data-qa': 'home.widget', 'aria-label': LABELS.clock },
          el('div.hw-time', null, hm()), el('div.hw-date', null, kDate(d)));
        w.addEventListener('click', () => { sfx('tap'); P.openApp('clock'); });
        homeEl.appendChild(w);
      }
    } else homeEl.appendChild(el('div.home-spacer'));
    const grid = el('div.app-grid');
    (m.apps || []).forEach((id) => grid.appendChild(id && typeof id === 'object' && id.folder ? folderNode(id, user) : P.iconNode(appOf(id), { user })));
    homeEl.appendChild(grid);
    if (m.dock && m.dock.length) {
      const dock = el('div.dock' + (m.dock.length === 2 ? '.two' : ''));
      m.dock.forEach((id) => dock.appendChild(P.iconNode(appOf(id), { user, dock: true })));
      homeEl.appendChild(dock);
    }
    if (ST() && !stack.length && !P.isLocked()) P.statusTheme(homeStatus());
    checkHome();
  };
  function refreshWidget() {
    if (!homeEl) return;
    homeEl.querySelectorAll('.hw-time, [data-live="time"]').forEach((t) => { t.textContent = timeText(); });
    homeEl.querySelectorAll('.hw-date, [data-live="date"]').forEach((d) => { d.textContent = kDate(now()); });
  }
  P.refreshWidget = refreshWidget;

  /* ---------------- ep3 (b) — home folder `{ folder, apps }` (§2.6 · §4.2.3 · §5.2) ---------------- */
  let folderOv = null;
  function folderNode(f, user) {
    const ids = Array.isArray(f.apps) ? f.apps : [];
    const badge = ids.reduce((s, id) => s + (user === 'n' && apps[id] && apps[id].badge ? safe(() => +apps[id].badge(user) || 0, 0) : 0), 0);
    const mini = el('span.ai-img.sh3-fimg', null, ids.slice(0, 9).map((id) => {
      const ic = (apps[id] && apps[id].icon) || (G.ICONS && G.ICONS[id]) || { bg: '#8a8a90', svg: '' };
      return el('i', { style: { background: ic.bg }, html: ic.svg || '' });
    }));
    const name = T(f.folder);
    const n = el('button.app-icon.sh3-folder', { 'aria-label': name, 'data-qa': 'home.folder', dataset: { folder: f.folder } },
      mini, badge ? el('span.ai-badge', null, badge > 99 ? '99+' : String(badge)) : null, el('span.ai-label', null, name));
    n.addEventListener('click', () => { sfx('tap'); openFolder(f, user); });
    return n;
  }
  function closeFolder() { if (!folderOv) return; const o = folderOv; folderOv = null; o.close(); }
  function openFolder(f, user) {
    if (folderOv) return;
    const name = T(f.folder);
    const grid = el('div.sh3-fgrid', null, (Array.isArray(f.apps) ? f.apps : []).map((id) => {
      const node = P.iconNode(appOf(id), { user });
      node.addEventListener('click', () => closeFolder());
      return node;
    }));
    const panel = el('div.sh3-fpanel', { role: 'dialog', 'aria-label': name }, el('div.sh3-ftitle', null, name), grid);
    // tap outside the folder closes it (a real phone folder) — the band under the panel carries the QA hook (its centre is free)
    const above = el('div.sh3-fsp');
    const below = el('div.sh3-fsp.below', { 'data-qa': 'home.folder.close', role: 'button', 'aria-label': '닫기' });
    const wrap = el('div.sh3-folder-wrap', null, above, panel, below);
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target === above || e.target === below) closeFolder(); });
    folderOv = P.overlay(wrap, { kind: 'folder', modal: 'soft', onBack: () => closeFolder(), dismiss: () => closeFolder() });
    setFlag('folderSeen');
    G.bus && G.bus.emit('folder:open', { name: f.folder });
  }
  P.closeFolder = closeFolder;
  P.folderOpen = () => !!folderOv;
  P.iconNode = function (a, o) {
    o = o || {};
    const user = o.user || USERS.current();
    const icon = a.icon || (G.ICONS && G.ICONS[a.id]) || { bg: '#5a5a60', svg: '' };
    let badge = 0;
    if (user === 'n' && a.badge && !a._missing) badge = safe(() => +a.badge(user) || 0, 0);
    const name = T(a.name || LABELS[a.id] || '');
    const n = el('button.app-icon', { 'aria-label': name, 'data-qa': 'home.app:' + a.id, dataset: { app: a.id } },
      el('span.ai-img', { style: { background: icon.bg }, html: icon.svg || '' }),
      badge ? el('span.ai-badge', null, badge > 99 ? '99+' : String(badge)) : null,
      el('span.ai-label', null, name));
    n.addEventListener('click', () => { sfx('tap'); if (a._missing) { console.warn('[phone] app not registered:', a.id); return; } P.openApp(a.id); });
    return n;
  };
  P.refreshBadges = function () { scheduleHome(); };

  /* home:show — emitted whenever the home becomes visible (ARCH §4.9 · §4.21). Only once the phone is in use (M1). */
  let homeShown = false;
  function homeVisible() { return !!homeEl && !P.isLocked() && !stack.length && !switching && !(root && root.classList.contains('eye-mode')); }
  function checkHome() {
    const v = homeVisible();
    if (v && !homeShown) { homeShown = true; if (flag('M1')) G.bus && G.bus.emit('home:show', { user: USERS.current() }); }
    else if (!v) homeShown = false;
  }
  P._checkHome = checkHome;

  /* =========================================================
   * navigation stack (ep1 API kept)
   * ========================================================= */
  P.openApp = function (id, params) {
    const a = apps[id];
    if (!a) { console.warn('[phone] openApp: no app', id); return; }
    if (!params || !params.keepStack) P.closeAll(true);
    P.currentApp = id;
    G.bus && G.bus.emit('app:open', id);
    try { a.open(params || {}); } catch (e) { console.error('[app]', id, e); }
  };
  /** push a screen node. opts: {onBack():bool, onClose(), onResume(), anim:'slide'|'up'|'fade'|'none'|'zoom', appId} */
  P.push = function (node, opts) {
    opts = opts || {};
    const entry = Object.assign({ node, appId: P.currentApp }, opts);
    if (node.dataset && node.dataset.scr) entry.scr = node.dataset.scr;      // ep3 (g) — DESIGN §5.8 screen id (show · QA)
    node.classList.add('screen-view');
    node.classList.add('anim-' + (opts.anim || (stack.length ? 'slide' : 'zoom')));
    stackEl.appendChild(node);
    stack.push(entry);
    requestAnimationFrame(() => node.classList.add('in'));
    if (stack.length > 1) coverBelow(stack[stack.length - 2].node, node, opts);
    applyStatus(node);
    updateLockUnder();
    checkHome();
    G.bus && G.bus.emit('screen:push', entry);
    return entry;
  };
  /** the screen below a pushed one slides aside; once the new one is fully in and opaque it is hidden (no hidden twins for
   *  selectors / taps — e.g. two settings rows with the same data-qa on stacked screens). opts.keepBelow opts out. */
  function coverBelow(prevNode, topNode, opts) {
    prevNode.classList.add('covered');
    clearTimeout(prevNode._hidT);
    if (opts && opts.keepBelow) return;
    prevNode._hidT = setTimeout(() => {
      if (!prevNode.classList.contains('covered') || !topNode.isConnected) return;
      const cs = safe(() => getComputedStyle(topNode), null);
      const m = cs && /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(cs.backgroundColor || '');
      const opaque = (m && (m[4] == null || +m[4] >= 0.99)) || (cs && cs.backgroundImage && cs.backgroundImage !== 'none');
      if (opaque) prevNode.classList.add('sh2-hid');
    }, 420);
  }
  function uncover(node) { clearTimeout(node._hidT); node.classList.remove('sh2-hid', 'covered'); }
  function applyStatus(node) {
    if (!node) { P.statusTheme('light'); return; }
    if (!node.dataset.status) {
      // derive from the computed background once it is in the DOM (light background → dark text)
      requestAnimationFrame(() => {
        if (node.dataset.status) { if (P.top() && P.top().node === node) P.statusTheme(node.dataset.status); return; }
        const bg = safe(() => getComputedStyle(node).backgroundColor, '');
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || '');
        let st = 'light';
        if (m && (m[4] == null || +m[4] > 0.5)) { const L = 0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]; st = L > 150 ? 'dark' : 'light'; }
        node.dataset.status = st;
        if (P.top() && P.top().node === node) P.statusTheme(st);
      });
      return;
    }
    P.statusTheme(node.dataset.status);
  }
  P.pop = function (silent) {
    const top = stack.pop();
    if (!top) return;
    if (!silent) sfx('back');
    top.node.classList.remove('in'); top.node.classList.add('out');
    safe(() => top.onClose && top.onClose());
    setTimeout(() => top.node.remove(), 320);
    const prev = stack[stack.length - 1];
    if (prev) { uncover(prev.node); applyStatus(prev.node); safe(() => prev.onResume && prev.onResume()); }
    else { P.currentApp = null; P.statusTheme(homeStatus()); if (!P.isLocked()) { SH().app = null; save(); } P.renderHome(); }
    updateLockUnder();
    checkHome();
    G.bus && G.bus.emit('screen:pop', top);
  };
  /** Android back / Esc. Returns true when something consumed it (ARCH §4.9 order: handlers > overlays > lock > stack). */
  P.back = function () {
    for (let i = backStack.length - 1; i >= 0; i--) {
      const fn = backStack[i];
      let r = false;
      try { r = fn() === true; } catch (e) { console.error('[phone] back handler', e); }
      if (r) return true;
    }
    const ov = overlays[overlays.length - 1];
    if (ov) {
      if (ov.onBack) { safe(() => ov.onBack()); return true; }
      if (ov.modal === 'hard') return true;
      closeOverlayEntry(ov); return true;
    }
    if (stack.length && P.isLocked()) {       // something opened from the lock screen (camera, emergency dialer)
      const top = stack[stack.length - 1];
      if (top.onBack && safe(() => top.onBack(), false) === true) return true;
      P.pop(); return true;
    }
    if (P.isLocked()) return !!(G.lock && G.lock._back && safe(() => G.lock._back(), false));
    const top = stack[stack.length - 1];
    if (!top) return false;
    if (top.onBack && safe(() => top.onBack(), false) === true) return true;
    P.pop();
    return true;
  };
  P.canBack = function () {
    if (backStack.length || overlays.length || stack.length) return true;
    return !!(P.isLocked() && G.lock && G.lock._canBack && safe(() => G.lock._canBack(), false));
  };
  P.pushBack = function (fn) {
    backStack.push(fn);
    return function remove() { const i = backStack.lastIndexOf(fn); if (i >= 0) backStack.splice(i, 1); };
  };
  P.closeAll = function (silent) {
    while (stack.length) { const e = stack.pop(); safe(() => e.onClose && e.onClose()); e.node.remove(); }
    P.currentApp = null;
    P.statusTheme(homeStatus());
    updateLockUnder();
    if (!silent) P.renderHome(); else checkHome();
  };
  P.home = function () {
    // non-modal panels (QS, volume) close first
    P.closeQuickPanel(); closeKind('volume');
    // the home gesture backs out of soft sheets / dialogs like a real phone (resolved with null); hard modals still block
    overlays.slice().reverse().forEach((o) => { if (o.modal === 'soft') { if (o.dismiss) safe(() => o.dismiss()); else if (o.onBack) safe(() => o.onBack()); } });
    if (overlays.some((o) => o.modal === 'hard')) return;
    if (P.isLocked()) { if (stack.length) P.closeAll(true); return; }
    if (!stack.length) { checkHome(); return; }
    sfx('whoosh');
    const nodes = stack.slice();
    stack.length = 0;
    nodes.forEach((e) => { safe(() => e.onClose && e.onClose()); e.node.classList.add('to-home'); setTimeout(() => e.node.remove(), 300); });
    P.currentApp = null; P.statusTheme(homeStatus());
    SH().app = null; save();
    updateLockUnder();
    P.renderHome();
    G.bus && G.bus.emit('home');
  };
  P.top = function () { return stack[stack.length - 1]; };
  P.stackDepth = function () { return stack.length; };
  /** route: {app, params} */
  P.route = function (r) { if (!r || !r.app) return; P.openApp(r.app, r.params || {}); };

  /* =========================================================
   * standard screen builders (ep1 signatures — ARCH §4.9)
   * ========================================================= */
  const UI = (G.ui = G.ui || {});
  UI.screen = function (o) {
    o = o || {};
    const head = o.header === false ? null : el('header.sv-head',
      o.back === false ? el('span.sv-sp') : el('button.sv-back', { 'aria-label': '뒤로', 'data-qa': 'nav.back', onclick: () => P.back(), html: SVG.back }),
      el('div.sv-titles', null, el('div.sv-title', null, T(o.title || '')), o.sub ? el('div.sv-sub', null, T(o.sub)) : null),
      el('div.sv-right', null, o.right || []));
    const body = el('div.sv-body' + (o.bodyCls ? '.' + o.bodyCls.split(' ').join('.') : ''));
    if (o.body) body.appendChild(o.body);
    // data-status = status-bar TEXT colour: a light screen gets dark text
    const node = el('section' + (o.cls ? '.' + o.cls.split(' ').filter(Boolean).join('.') : ''),
      { dataset: { status: o.theme === 'dark' ? 'light' : 'dark', theme: o.theme || 'light' } }, head, body, o.footer || null);
    node.body = body; node.head = head;
    return node;
  };
  UI.list = function (items) {
    return el('div.list', null, (items || []).filter(Boolean).map((it) => {
      const row = el('button.list-row' + (it.cls ? '.' + it.cls.split(' ').join('.') : ''), { onclick: it.onClick ? () => { sfx('tap'); it.onClick(); } : null, disabled: it.disabled, 'data-qa': it.qa || null },
        it.icon ? el('span.lr-icon', { html: it.icon }) : null,
        el('span.lr-main', null, el('span.lr-title', null, T(it.title)), it.sub ? el('span.lr-sub', null, T(it.sub)) : null),
        it.meta ? el('span.lr-meta', null, T(it.meta)) : null,
        it.chevron !== false && it.onClick ? el('span.lr-chev', { html: SVG.chev }) : null);
      return row;
    }));
  };

  /* =========================================================
   * overlays · dialogs · sheets · toasts (ARCH §2.3 z 50)
   * ========================================================= */
  function closeOverlayEntry(o) {
    const i = overlays.indexOf(o); if (i >= 0) overlays.splice(i, 1);
    o.node.classList.remove('in'); o.node.classList.add('out');
    setTimeout(() => o.node.remove(), 280);
  }
  function closeKind(kind) { overlays.slice().forEach((o) => { if (o.kind === kind) (o.dismiss ? o.dismiss() : closeOverlayEntry(o)); }); }
  /** opts: {modal:'soft'|'hard', onBack, kind, dismiss} → {node, close()} */
  P.overlay = function (node, opts) {
    opts = opts || {};
    if (opts.modal) node.dataset.modal = opts.modal;
    const entry = { node, kind: opts.kind || 'other', onBack: opts.onBack || null, dismiss: opts.dismiss || null, modal: opts.modal || null };
    overlays.push(entry);
    overlayEl.insertBefore(node, toastEl);
    requestAnimationFrame(() => node.classList.add('in'));
    return { node, close() { closeOverlayEntry(entry); } };
  };
  P.dismissModals = function () {
    overlays.slice().reverse().forEach((o) => {
      if (o.dismiss) safe(() => o.dismiss());
      else if (o.onBack) safe(() => o.onBack());
      else closeOverlayEntry(o);
    });
    if (G.lock && G.lock._closeSheets) safe(() => G.lock._closeSheets());
  };
  P.modalOpen = function () { return overlays.some((o) => /^(dialog|sheet|verify|share)$/.test(o.kind)); };

  /** OS-style alert. buttons: [{label, style:'primary'|'danger'|'', value}] → Promise<value> (null when backed out) */
  P.dialog = function (o) {
    o = o || {};
    if (o.input) console.warn('[phone] dialog.input is not supported in ep2 (in-game keyboard only)');
    return new Promise((resolve) => {
      let done = false, ov = null;
      const finish = (v) => { if (done) return; done = true; ov.close(); resolve(v); };
      const list = o.buttons || [{ label: '확인', value: 'ok', style: 'primary' }];
      const btns = list.map((b) => el('button.dlg-btn' + (b.style ? '.' + b.style : ''), { 'data-qa': 'dialog.btn:' + String(b.value), onclick: () => { sfx('tap'); finish(b.value); } }, T(b.label)));
      const node = el('div.dialog-wrap', null, el('div.dialog', { role: 'alertdialog' },
        o.title ? el('div.dlg-title', null, T(o.title)) : null,
        o.text ? el('div.dlg-text', null, T(o.text)) : null,
        o.body || null,
        el('div.dlg-btns' + (btns.length > 2 ? '.vertical' : ''), null, btns)));
      node.addEventListener('click', (e) => { if (e.target === node) finish(null); });
      ov = P.overlay(node, { modal: 'soft', kind: 'dialog', onBack: () => finish(null), dismiss: () => finish(null) });
    });
  };
  /** bottom system sheet. {title, text, body:Node, buttons:[{label, value, style}], qa, kind, mount(close)} → Promise<value> */
  P.sheet = function (o) {
    o = o || {};
    return new Promise((resolve) => {
      let done = false, ov = null;
      const finish = (v) => { if (done) return; done = true; ov.close(); safe(() => o.onClose && o.onClose(v)); resolve(v); };
      const btns = (o.buttons || []).map((b) => el('button.sht-btn' + (b.style ? '.' + b.style : ''), { 'data-qa': 'sheet.btn:' + String(b.value), onclick: () => { sfx('tap'); finish(b.value); } }, T(b.label)));
      const box = el('div.sheet' + (o.cls ? '.' + o.cls : ''), { 'data-qa': o.qa || null, role: 'dialog' },
        el('div.sht-grab'),
        o.title ? el('div.sht-title', null, T(o.title)) : null,
        o.text ? el('div.sht-text', null, T(o.text)) : null,
        o.body || null,
        btns.length ? el('div.sht-btns' + (btns.length > 2 ? '.vertical' : ''), null, btns) : null);
      const wrap = el('div.sheet-wrap', null, box);
      wrap.addEventListener('click', (e) => { if (e.target === wrap && o.backdrop !== false) finish(null); });
      ov = P.overlay(wrap, { modal: 'soft', kind: o.kind || 'sheet', onBack: () => finish(null), dismiss: () => finish(null) });
      if (o.mount) safe(() => o.mount(finish, box));
    });
  };
  P.toast = function (text, ms) {
    const s = T(text);
    if (!s || !toastEl) return;
    const t = el('div.toast', { 'data-qa': 'toast', role: 'status' }, s);
    toastEl.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms || 2200);
  };

  /* =========================================================
   * notifications — per user, tone routing via G.tones (§4.8 · §5.3 · §5.7 ③ · §9.7; ARCH §4.9)
   * ========================================================= */
  const notifs = () => { if (!G.state) return []; if (!Array.isArray(G.state.notifs)) G.state.notifs = []; return G.state.notifs; };
  function upsert(n) {
    const list = notifs();
    const i = list.findIndex((x) => x.id === n.id);
    if (i >= 0) { const prev = list[i]; list.splice(i, 1); n = Object.assign(prev, n); }
    list.unshift(n);
    if (list.length > 60) list.length = 60;
    save();
    return n;
  }
  const chatOf = (o) => o.chat || (o.route && o.route.params && o.route.params.thread) || null;
  P.notifList = function (user) {
    user = user || USERS.current();
    return notifs().filter((n) => (n.user || 'n') === user && !n.read && !n.gone).sort((a, b) => (b.time || 0) - (a.time || 0));
  };
  /** groups same app+chat (§4.8 — `{제목} · 새 메시지 {k}개`) → [{head:n, items:[…]}] */
  P.notifGroups = function (user) {
    const out = []; const byKey = {};
    P.notifList(user).forEach((n) => {
      const k = n.chat ? n.app + '|' + n.chat : 'id|' + n.id;
      if (byKey[k]) byKey[k].items.push(n); else { byKey[k] = { head: n, items: [n] }; out.push(byKey[k]); }
    });
    return out;
  };
  P.unread = function (user, app) { return P.notifList(user).filter((n) => !app || n.app === app).reduce((s, n) => s + (n.count || 1), 0); };
  P.markRead = function (pred) { let ch = false; notifs().forEach((n) => { if (!n.read && safe(() => pred(n), false)) { n.read = true; ch = true; } }); if (ch) { save(); refreshLists(); } };
  P.dismissNotif = function (id) { notifs().forEach((n) => { if (n.id === id || (id && id.items && id.items.includes(n))) n.gone = true; }); save(); refreshLists(); };
  function refreshLists() { G.bus && G.bus.emit('lock:refresh'); qsRefresh(); }

  function seedNotifs() {
    const sh = SH(); if (sh.seeded) return;
    const list = (G.STORY && G.STORY.users && G.STORY.users.n && G.STORY.users.n.seedNotifs) || [];
    if (!list.length) return;
    list.slice().reverse().forEach((s) => {
      const [h, m] = String(s.t || '22:50').split(':').map(Number);
      upsert({ id: s.id, user: 'n', app: s.app, chat: chatOf(s), title: s.title || '', body: s.body || '', when: s.when || '', time: new Date(2026, 11, 24, h, m).getTime(), route: s.route || null, read: false });
    });
    sh.seeded = true; save(); refreshLists(); scheduleHome();
  }
  P._seed = seedNotifs;

  // tone routing state
  const lastTone = {};
  function toneFor(app, chat) {
    if (G.tones && G.tones.for) return safe(() => G.tones.for({ app, chat }), null);
    return app === 'alerts' ? null : 'dash';
  }
  function playTone(id, o) { if (G.tones && G.tones.play) safe(() => G.tones.play(id, o)); }
  function soundRoute(o, chat) {
    if (o.silent) return;
    const tid = toneFor(o.app, chat);
    if (tid == null) return;                                         // 재난 알림 never rings (§3.6)
    const key = chat || ('app:' + o.app);
    const pm = playMs();
    if (o.coalesce !== false && lastTone[key] != null && pm - lastTone[key] < 10000) return;   // one sound per 10 s (same chat)
    const mode = vget('soundMode', 'sound'); const dnd = dndActive();
    if (dnd || mode === 'mute') return;
    const sh = SH(); sh.chatTones = sh.chatTones || {};
    const count = chat ? (sh.chatTones[chat] || 0) : 0;
    const noCap = !!(G.tones && G.tones.cap === 0);                  // ep3: every §4.13 row rings (no 3-tone cap)
    if (mode === 'vibrate' || (chat && count >= 3 && !noCap)) {      // vibrate mode · 4th+ tone of the same chat → banner + vibrate only
      const vk = G.tones && typeof G.tones.vibKey === 'function' ? safe(() => G.tones.vibKey(tid), null) : (tid === 'dash' ? 'him' : 'n');
      if (vk && o.vibrate !== false && G.settings && G.settings.vibration !== false) vibrate(vk);
      lastTone[key] = pm;
      return;
    }
    playTone(tid, { gainDb: o.gainDb || 0, vibrate: o.vibrate !== false });
    lastTone[key] = pm;
    if (chat) { sh.chatTones[chat] = count + 1; save(); }
  }
  /** G.phone.notify({ app, title, body, user='n', chat, route, when, silent, coalesce=true, vibrate, id, banner=true, gainDb=0 }) → {id, banner} */
  P.notify = function (o) {
    o = Object.assign({}, o || {});
    const user = o.user || 'n';
    const id = o.id || ('n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const chat = chatOf(o);
    const cur = USERS.current();
    const isCur = user === cur && !switching;
    const hasHook = !!(G.hooks && G.hooks.has && G.hooks.has('chat:isOpen'));      // ep3 (h): comms answers for sms + talk threads
    const chatOpen = !!(isCur && chat && (hasHook ? safe(() => G.hooks.call('chat:isOpen', chat), false)
      : (G.moment && G.moment.isOpen && safe(() => G.moment.isOpen(chat), false))));
    let entry = null;
    if (o.banner !== false && !chatOpen) {
      const prev = ST() ? notifs().find((x) => x.id === id && !x.read && !x.gone) : null;   // ep3: a later text of the same delivery
      entry = upsert({ id, user, app: o.app, chat, title: o.title || '', body: o.body || '', when: o.when || fmtK(now()), time: now().getTime(), route: o.route || null, read: false, gone: false });
      if (ST()) { entry.count = prev ? (prev.count || 1) + 1 : 1; save(); }   // unread texts of one delivery (comms' o.count = k-th text overall — a read entry restarts at 1)
    }
    G.bus && G.bus.emit('notify', Object.assign({}, o, { id, user, chat }));
    if (!isCur) { refreshLists(); return { id, banner: false }; }
    if (chatOpen) {                                                  // the conversation is open → small in-app pop only
      const mode = vget('soundMode', 'sound');
      if (o.banner === false) soundRoute(o, chat);
      else if (!o.silent && mode === 'sound' && !dndActive()) playTone('inapp', { ledger: false, vibrate: false });
      return { id, banner: false };
    }
    if (o.banner === false) { soundRoute(o, chat); return { id, banner: false }; }   // N09 — tone only
    // ep3 (h): DND `지금 사용` (or the app's notifications switched off in 설정 › 알림 › 앱 알림) → panel + badge only (§4.13)
    if (ST() && (vget('dndNow', false) || (SH().appOff && SH().appOff[o.app]))) { refreshLists(); scheduleHome(); return { id, banner: false }; }
    soundRoute(o, chat);
    refreshLists();
    const shown = showBanner(entry);
    return { id, banner: shown };
  };

  /* banners (§4.8 형식: [앱 아이콘] {앱} · {시각} / 굵은 제목 / 본문 한 줄) */
  const bq = [];
  let showing = false, curBanner = null;
  function showBanner(n) {
    if (!n || !bannerEl) return false;
    if (root.classList.contains('eye-mode')) return false;
    const same = (a, b) => a && b && a.app === b.app && a.chat && a.chat === b.chat;
    if (curBanner && !bq.length && (curBanner.n.id === n.id || same(curBanner.n, n))) { curBanner.update(n); return true; }
    if (bq.length && (bq[bq.length - 1].id === n.id || same(bq[bq.length - 1], n))) { bq[bq.length - 1] = n; return true; }
    bq.push(n);
    if (!showing) nextBanner();
    return true;
  }
  function bannerApp(n) { const a = apps[n.app] || {}; const ic = a.icon || (G.ICONS && G.ICONS[n.app]) || { bg: '#333', svg: '' }; return { name: T(a.name || LABELS[n.app] || ''), ic }; }
  function nextBanner() {
    const n = bq.shift();
    if (!n) { showing = false; return; }
    if (switching) { bq.length = 0; showing = false; return; }
    showing = true;
    const { name, ic } = bannerApp(n);
    const titleEl = el('div.bn-title', null, T(n.title));
    const bodyEl = el('div.bn-body', null, T(n.body));
    const whenEl = el('span', null, n.when || '');
    const b = el('div.banner', { 'data-qa': 'banner:' + n.id, role: 'status' },
      el('span.bn-icon', { style: { background: ic.bg }, html: ic.svg || '' }),
      el('div.bn-main', null, el('div.bn-top', null, el('b', null, name), el('span', null, ' · '), whenEl), titleEl, bodyEl));
    if (!n.title) titleEl.style.display = 'none';
    let closed = false, timer = 0;
    // 280 ms ≥ the lock-screen fade-out (main.css, .25 s): the node never vanishes while still visible
    const close = () => { if (closed) return; closed = true; clearTimeout(timer); if (curBanner && curBanner.b === b) curBanner = null; b.classList.remove('in'); setTimeout(() => { b.remove(); nextBanner(); }, 280); };
    curBanner = { b, n, close, update(n2) {
      this.n = n2; b.setAttribute('data-qa', 'banner:' + n2.id);
      titleEl.textContent = T(n2.title); titleEl.style.display = n2.title ? '' : 'none';
      bodyEl.textContent = T(n2.body); whenEl.textContent = n2.when || '';
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
      clearTimeout(timer); timer = setTimeout(close, 4200);
      G.bus && G.bus.emit('notify:shown', { id: n2.id });
    } };
    b.addEventListener('click', () => {
      const cur = curBanner && curBanner.b === b ? curBanner.n : n;
      close();
      if (P.isLocked()) { if (!lockEl.classList.contains('sh2-under') && G.lock && G.lock._tapNotif) G.lock._tapNotif(cur); return; }
      cur.read = true; save(); refreshLists();
      P.closeQuickPanel();
      if (easyRoute(cur)) return;
      if (cur.route) P.route(cur.route);
    });
    let sy = null;
    b.addEventListener('pointerdown', (e) => { sy = e.clientY; });
    b.addEventListener('pointermove', (e) => { if (sy != null && sy - e.clientY > 18) { sy = null; close(); } });
    b.addEventListener('pointerup', () => { sy = null; });
    bannerEl.appendChild(b);
    requestAnimationFrame(() => b.classList.add('in'));
    timer = setTimeout(close, 4200);
    G.bus && G.bus.emit('notify:shown', { id: n.id });
  }
  function clearBanners() { bq.length = 0; if (curBanner) curBanner.close(); }
  /** ep3: in easy mode an sms notification opens the one big conversation (E5 · §3.3) instead of the 메시지 app */
  function easyRoute(n) {
    if (!n || n.app !== 'sms' || !G.easy || !G.easy.sms || !G.easy.on || !safe(() => G.easy.on(), false)) return false;
    const th = (n.route && n.route.params && n.route.params.thread) || (n.chat ? String(n.chat).replace(/^sms:/, '') : null);
    if (!th) return false;
    safe(() => G.easy.sms(th));
    return true;
  }

  /* =========================================================
   * lock layer handle (lock.js renders into it)
   * ========================================================= */
  P.lockLayer = function () { return lockEl; };
  P.isLocked = function () { return !!lockEl && !lockEl.classList.contains('hidden'); };
  P.setLocked = function (on) {
    if (!lockEl) return;
    lockEl.classList.toggle('hidden', !on);
    homeBar.classList.toggle('on-lock', !!on);
    if (on) P.closeQuickPanel();
    updateLockUnder();
    if (!on) P.renderHome(); else checkHome();
    updateStatus(true);
  };
  /** while locked, anything pushed on the app stack (camera, emergency dialer) is drawn above the lock (ARCH §4.9 lock row) */
  function updateLockUnder() {
    if (!lockEl) return;
    const under = P.isLocked() && stack.length > 0;
    lockEl.classList.toggle('sh2-under', under);
    homeBar.classList.toggle('on-lock', P.isLocked() && !under);
    if (root) root.classList.toggle('sh2-locked', P.isLocked() && !under);
  }

  /* =========================================================
   * shared control builders (settings.js / security.js use these — same owner)
   * ========================================================= */
  function toggle(on, fn, o) {
    o = o || {};
    const t = el('button.sh2-toggle' + (on ? '.on' : '') + (o.disabled ? '.dis' : ''), { role: 'switch', 'aria-checked': String(!!on), 'aria-label': T(o.label || ''), 'data-qa': o.qa || null });
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      if (o.disabled) return;                                          // grey toggles: no reaction at all (§4.6.2)
      const next = !t.classList.contains('on');
      const r = fn ? fn(next) : undefined;
      if (r === false) return;
      t.classList.toggle('on', next); t.setAttribute('aria-checked', String(next));
      sfx('tap');
    });
    t.set = (v) => { t.classList.toggle('on', !!v); t.setAttribute('aria-checked', String(!!v)); };
    return t;
  }
  /** int slider 0–100: role=slider aria-valuenow · drag · ←/→ ±5 · Home/End · wheel */
  function slider(value, o) {
    o = o || {};
    const fill = el('i.sl-fill'), knob = el('b.sl-knob');
    const s = el('div.sh2-slider', { role: 'slider', tabindex: 0, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': T(o.label || ''), 'data-qa': o.qa || null },
      el('span.sl-track', null, fill), knob);
    let v = Math.round(Math.max(0, Math.min(100, +value || 0)));
    const draw = () => { fill.style.width = v + '%'; knob.style.left = v + '%'; s.setAttribute('aria-valuenow', String(v)); };
    const set = (x, fire, end) => {
      const nv = Math.round(Math.max(0, Math.min(100, x)));
      const ch = nv !== v; v = nv; draw();
      if (fire && ch && o.onInput) o.onInput(v);
      if (end && o.onEnd) o.onEnd(v);
    };
    draw();
    s.style.touchAction = 'none';
    const pos = (e) => { const r = s.getBoundingClientRect(); return ((e.clientX - r.left) / Math.max(1, r.width)) * 100; };
    s.addEventListener('pointerdown', (e) => { e.stopPropagation(); try { s.setPointerCapture(e.pointerId); } catch (er) {} s.classList.add('drag'); set(pos(e), true); });
    s.addEventListener('pointermove', (e) => { if (s.classList.contains('drag')) set(pos(e), true); });
    const up = () => { if (!s.classList.contains('drag')) return; s.classList.remove('drag'); set(v, false, true); };
    s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
    s.addEventListener('click', (e) => e.stopPropagation());
    s.addEventListener('keydown', (e) => {
      const k = e.key; let d = 0;
      if (k === 'ArrowRight' || k === 'ArrowUp') d = 5; else if (k === 'ArrowLeft' || k === 'ArrowDown') d = -5;
      else if (k === 'Home') { e.preventDefault(); set(0, true, true); return; } else if (k === 'End') { e.preventDefault(); set(100, true, true); return; }
      if (d) { e.preventDefault(); e.stopPropagation(); set(v + d, true, true); }
    });
    s.addEventListener('wheel', (e) => { e.preventDefault(); set(v + (e.deltaY < 0 ? 5 : -5), true, true); }, { passive: false });
    s.setValue = (x) => { v = Math.round(Math.max(0, Math.min(100, +x || 0))); draw(); };
    s.value = () => v;
    return s;
  }
  P.ui = { toggle, slider };

  /* =========================================================
   * Wi-Fi state (§4.6.6 · §5.6 · §0.2 D11 — ARCH §4.9)
   * ========================================================= */
  const SAVED_DEF = ['saemal_rooftop', 'SM-G991N_0A3F', 'Haesol_404'];
  const wifiSaved = () => { const v = vget('wifiSaved', null); return Array.isArray(v) ? v.slice() : SAVED_DEF.slice(); };
  function wifiEmit() { G.bus && G.bus.emit('wifi:change', { on: P.wifi.on(), connected: P.wifi.connected() }); updateStatus(true); }
  function wifiAutoFire() { if (!P.wifi.on() && P.wifi.auto()) P.wifi.setOn(true); }
  let wifiFallbackTimer = 0;
  P.wifi = {
    on() { return vget('wifiOn', true) !== false; },
    setOn(b) {
      b = !!b;
      const was = P.wifi.on();
      vset('wifiOn', b);
      if (ST()) { if (was !== b) wifiEmit(); return; }          // ep3 (i): plain on/off — no saved list, no auto-on sched
      try {
        if (G.e2 && G.e2.sched) { G.e2.sched.cancel('shell:wifiAuto'); if (!b && P.wifi.auto()) G.e2.sched.after(90000, 'shell:wifiAuto'); }
        else { clearTimeout(wifiFallbackTimer); if (!b && P.wifi.auto()) wifiFallbackTimer = setTimeout(wifiAutoFire, 90000); }
      } catch (e) { console.error('[phone] wifi sched', e); }
      if (was !== b) wifiEmit();
    },
    connected() { if (ST()) return P.wifi.on(); return P.wifi.on() && wifiSaved().includes('saemal_rooftop'); },
    saved() { return wifiSaved(); },
    forget(ssid) { const s = wifiSaved(); const i = s.indexOf(ssid); if (i < 0) return false; s.splice(i, 1); vset('wifiSaved', s); wifiEmit(); return true; },
    join(ssid, pw) {
      const net = ((G.STORY.security && G.STORY.security.wifi) || []).find((w) => w.id === ssid);
      const want = (net && net.pw) || (ssid === 'saemal_rooftop' ? 'saemal0601' : null);
      if (!want || String(pw) !== want) return false;
      const s = wifiSaved(); if (!s.includes(ssid)) { s.unshift(ssid); vset('wifiSaved', s); }
      if (!P.wifi.on()) P.wifi.setOn(true); else wifiEmit();
      return true;
    },
    restore() {                                   // ending 01:50 — re-add + on; true if anything changed
      let ch = false;
      const s = wifiSaved(); if (!s.includes('saemal_rooftop')) { s.unshift('saemal_rooftop'); vset('wifiSaved', s); ch = true; }
      if (!P.wifi.on()) { P.wifi.setOn(true); ch = true; } else if (ch) wifiEmit();
      return ch;
    },
    auto() { return SH().wifiAuto !== false; },
    setAuto(b) { SH().wifiAuto = !!b; save(); if (!b) { try { G.e2 && G.e2.sched && G.e2.sched.cancel('shell:wifiAuto'); } catch (e) {} clearTimeout(wifiFallbackTimer); } else if (!P.wifi.on()) P.wifi.setOn(false); },
  };

  /* =========================================================
   * Bluetooth row behaviour shared by QS sheet + settings (§4.6.7 · §5.6 · §9.7) — state lives in core G.media.bt
   * ========================================================= */
  const BT = () => (G.media && G.media.bt) || null;
  P.btState = function () { const b = BT(); if (!b) return flag('btConnected') ? 'connected' : 'idle'; return safe(() => b.state(), 'idle'); };
  P.btOn = function () { const b = BT(); return b && b.on ? safe(() => b.on(), true) : vget('btOn', true) !== false; };
  P.btLabel = function () {
    const st = P.btState();
    if (st === 'connecting') return STR('connecting');
    if (st === 'connected') return STR('btConnected');
    return '연결 안 됨';
  };
  P.btTap = async function () {
    const b = BT(); if (!b) return;
    const st = P.btState();
    if (st === 'connecting') return;
    if (st === 'connected') {
      const v = await P.dialog({ text: STR('btDisconnectQ'), buttons: [{ label: '취소', value: 'cancel' }, { label: '연결 끊기', value: 'disconnect', style: 'danger' }] });
      if (v === 'disconnect') safe(() => b.disconnect());
      return;
    }
    if (!P.btOn()) safe(() => b.setOn(true));
    const r = await safe(() => b.connect(), Promise.resolve('notfound'));
    if (r === 'notfound') P.toast(STR('btNotFound'));
  };

  /* =========================================================
   * quick settings — §4.6.1 · §5.3 · §0.2 E1 (tiles: Wi-Fi · 블루투스 · 손전등 + user row)
   * ========================================================= */
  let qs = null;             // { ov, panel, render }
  let dashFlash = false;
  function qsRefresh(clockOnly) {
    if (!qs) return;
    if (clockOnly) { const h = qs.panel.querySelector('.qp-head b'); if (h) h.textContent = timeText(); return; }
    qs.render();
  }
  P.closeQuickPanel = function () { if (!qs) return; const q = qs; qs = null; q.ov.close(); };
  P.quickPanel = function () {
    if (qs || switching || !root || root.classList.contains('eye-mode')) return;
    if (G.ui && G.ui.hideKeyboard) safe(() => G.ui.hideKeyboard());
    sfx('whoosh');
    const panel = el('div.qp', { 'data-qa': 'qs.panel' });
    const wrap = el('div.qp-wrap', null, panel);
    const render = () => {
      const d = now();
      const locked = P.isLocked();
      const user = USERS.current();
      panel.innerHTML = '';
      const gear = el('button.qp-gear', { 'aria-label': T(LABELS.settings), html: SVG.gear });
      gear.addEventListener('click', () => { if (P.isLocked()) return; P.closeQuickPanel(); P.openApp('settings'); });
      if (locked) gear.classList.add('dim');
      panel.appendChild(el('div.qp-head', null, el('b', null, timeText()), el('span', null, kDate(d)), el('i.qp-sp'), gear));
      const tiles = el('div.qp-tiles');
      const build = {
        // Wi-Fi
        wifi() {
          const wOn = P.wifi.on(), wC = P.wifi.connected();
          const wTile = el('button.qp-tile' + (wOn ? '.on' : ''), { 'data-qa': 'qs.tile:wifi', 'aria-pressed': String(wOn) },
            el('span.qp-ic', { html: SVG.wifi }), el('span.qp-lb', null, el('b', null, 'Wi-Fi'), wC ? el('small', null, ST() ? T(ST().wifi || '') : 'saemal_rooftop') : null));
          wTile.addEventListener('click', () => { sfx('tap'); P.wifi.setOn(!P.wifi.on()); });
          return wTile;
        },
        // Bluetooth (tap = on/off · long-press 0.5 s or label tap → device list)
        bt() {
          const bOn = P.btOn(), bst = P.btState();
          const bTile = el('div.qp-tile' + (bOn ? '.on' : ''), { 'data-qa': 'qs.tile:bt', role: 'button', tabindex: 0, 'aria-pressed': String(bOn) },
            el('span.qp-ic', { html: SVG.bt }), el('span.qp-lb', null, el('b', null, bst === 'connected' ? '2층_스피커' : '블루투스')));
          let lp = null, lpFired = false;
          bTile.addEventListener('pointerdown', () => { lpFired = false; clearTimeout(lp); lp = setTimeout(() => { lpFired = true; btSheet(); }, 500); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bTile.addEventListener(ev, () => clearTimeout(lp)));
          bTile.addEventListener('contextmenu', (e) => e.preventDefault());
          bTile.addEventListener('click', (e) => {
            if (lpFired) { lpFired = false; return; }
            sfx('tap');
            if (e.target.closest('.qp-lb')) { btSheet(); return; }
            const b = BT(); if (b) safe(() => b.setOn(!P.btOn()));
          });
          bTile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btSheet(); } });
          return bTile;
        },
        // Flashlight ({N}: camera with flash · '—': visual toggle only — §5.3 · ARCH §9 G36)
        flash() {
          const roomCam = !!(G.room && G.room.isOpen && safe(() => G.room.isOpen(), false) && safe(() => (G.room.current() || {}).mode === 'camera', false));
          const fOn = user === 'dash' ? dashFlash : (roomCam && !!safe(() => G.room.flash(), false));
          const fTile = el('button.qp-tile' + (fOn ? '.on' : ''), { 'data-qa': 'qs.tile:flash', 'aria-pressed': String(fOn) },
            el('span.qp-ic', { html: SVG.flash }), el('span.qp-lb', null, el('b', null, '손전등')));
          fTile.addEventListener('click', () => {
            sfx('tap');
            if (USERS.current() === 'dash') { dashFlash = !dashFlash; render(); return; }
            if (roomCam && G.room.flash) { safe(() => G.room.flash(!fOn)); render(); return; }
            if (!G.room || !G.room.open) return;
            const fromLock = P.isLocked();
            P.closeQuickPanel();
            safe(() => G.room.open({ mode: 'camera', flash: true, fromLock }));
          });
          return fTile;
        },
        // ep3 — 소리 (소리 → 진동 → 무음 = vars.soundMode · §5.3)
        sound() {
          const m = vget('soundMode', 'sound');
          const lb = m === 'vibrate' ? '진동' : m === 'mute' ? '무음' : '소리';
          const t = el('button.qp-tile' + (m !== 'mute' ? '.on' : ''), { 'data-qa': 'qs.tile:sound', 'aria-pressed': String(m !== 'mute') },
            el('span.qp-ic', { html: m === 'vibrate' ? SVG.vib : m === 'mute' ? SVG.mute : SVG.sound }), el('span.qp-lb', null, el('b', null, lb)));
          t.addEventListener('click', () => {
            sfx('tap');
            const c = vget('soundMode', 'sound');
            vset('soundMode', c === 'sound' ? 'vibrate' : c === 'vibrate' ? 'mute' : 'sound');
            render();
          });
          return t;
        },
        // ep3 — 방해 금지 (tap = `지금 사용` · long-press 0.5 s = 설정 › 방해 금지 — §5.3 · §0.3 D19)
        dnd() {
          const on = !!vget('dndNow', false);
          const t = el('div.qp-tile' + (on ? '.on' : ''), { 'data-qa': 'qs.tile:dnd', role: 'button', tabindex: 0, 'aria-pressed': String(on) },
            el('span.qp-ic', { html: SVG.dnd }), el('span.qp-lb', null, el('b', null, '방해 금지')));
          let lp = null, lpFired = false;
          const openDnd = () => {
            if (P.isLocked()) return;
            P.closeQuickPanel();
            const key = (G.EP && G.EP.QS && G.EP.QS.dndLong) || 'dnd';
            if (G.settingsApp && G.settingsApp.open) safe(() => G.settingsApp.open(key));
          };
          t.addEventListener('pointerdown', () => { lpFired = false; clearTimeout(lp); lp = setTimeout(() => { lpFired = true; sfx('tap'); openDnd(); }, 500); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => t.addEventListener(ev, () => clearTimeout(lp)));
          t.addEventListener('contextmenu', (e) => e.preventDefault());
          t.addEventListener('click', () => { if (lpFired) { lpFired = false; return; } sfx('tap'); P.setDndNow(!vget('dndNow', false)); render(); });
          t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); P.setDndNow(!vget('dndNow', false)); render(); } });
          return t;
        },
      };
      const order = (G.EP && G.EP.QS && Array.isArray(G.EP.QS.tiles) && G.EP.QS.tiles.length) ? G.EP.QS.tiles : ['wifi', 'bt', 'flash'];
      order.forEach((id) => { const t = build[id] ? build[id]() : null; if (t) tiles.appendChild(t); });
      if (order.length === 4) tiles.classList.add('sh3-four');
      panel.appendChild(tiles);
      // brightness (decor)
      panel.appendChild(el('div.qp-bright', null, el('span.qp-sun', { html: SVG.sun }), slider(62, { label: '밝기' })));
      // user row — not drawn while locked ({N} lock), `[—]` hidden from doorOpened until END (§3.2 · §5.3 · ARCH §4.9)
      const showRow = !locked || user === 'dash';   // '—' lock keeps `[{N}]` reachable (soft-lock guard, §2.3-3)
      if (showRow && (!G.EP || !G.EP.QS || G.EP.QS.userRow !== false)) {
        const row = el('div.qp-users');
        const av = (id) => {
          const isCur = id === user;
          const grey = id === 'dash' && USERS.dashLocked();
          const b = el('button.qp-user' + (isCur ? '.cur' : '') + (grey ? '.grey' : ''), { 'data-qa': 'qs.user:' + id, 'aria-label': id === 'n' ? T('{N}') : '—' },
            el('span.qp-av' + (id === 'dash' ? '.dash' : ''), null, id === 'n' ? initial() : '—'));
          b.addEventListener('click', () => {
            sfx('tap');
            if (isCur) return;
            if (!USERS.canSwitch(id)) { P.toast(STR('noSwitch')); return; }
            P.closeQuickPanel();
            USERS.switchTo(id);
          });
          return b;
        };
        row.appendChild(av('n'));
        const dashDrawn = !USERS.dashHidden();
        if (dashDrawn) row.appendChild(av('dash'));
        if (!locked) {
          const add = el('button.qp-user.add', { 'data-qa': 'qs.user:add', 'aria-label': T('＋ 사용자 추가'), html: SVG.plus });
          add.addEventListener('click', async () => { sfx('tap'); P.closeQuickPanel(); await addUserFlow(); });
          row.appendChild(add);
        }
        panel.appendChild(row);
        if (dashDrawn) { setFlag('dashSeen'); G.bus && G.bus.emit('qs:users', { shown: true }); }
      }
      // notifications of the current user (§4.8 — same chat grouped `{제목} · 새 메시지 {k}개`)
      const groups = P.notifGroups(user);
      if (groups.length) {
        panel.appendChild(el('div.qp-nh', null, '알림'));
        const box = el('div.qp-notifs');
        groups.forEach((g) => box.appendChild(qsNotifRow(g)));
        panel.appendChild(box);
      } else if (ST()) panel.appendChild(el('div.qp-empty.sh3-qpempty', null, STR('noNotif')));   // ep3 — §4.13 `알림 없음`
      panel.appendChild(el('div.qp-grab'));
    };
    const ov = P.overlay(wrap, { kind: 'qs', onBack: () => P.closeQuickPanel(), dismiss: () => P.closeQuickPanel() });
    qs = { ov, panel, render };
    render();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) P.closeQuickPanel(); });
    let sy2 = null;
    panel.addEventListener('pointerdown', (e) => { if (e.target.closest('.sh2-slider, .qp-n')) return; sy2 = e.clientY; });
    panel.addEventListener('pointerup', (e) => { if (sy2 != null && sy2 - e.clientY > 50) P.closeQuickPanel(); sy2 = null; });
    G.bus && G.bus.emit('quickpanel');
  };
  function initial() { const n = T('{N}'); return n ? Array.from(n)[0] : ''; }
  P._initial = initial;
  function qsNotifRow(g) {
    const n = g.head, k = g.items.reduce((s, x) => s + (x.count || 1), 0);
    const { name, ic } = bannerApp(n);
    const title = n.title ? T(n.title) : name;
    const row = el('div.qp-n', { 'data-qa': 'notif:' + n.id, role: 'button', tabindex: 0 },
      el('span.bn-icon', { style: { background: ic.bg }, html: ic.svg || '' }),
      el('div.qp-nm', null, el('b', null, k > 1 ? `${title} · 새 메시지 ${k}개` : title), el('span', null, T(n.body))),
      el('small', null, n.when || ''));
    // swipe sideways to dismiss (§4.7.1 — the originals in each app stay)
    let sx = null, moved = false;
    row.addEventListener('pointerdown', (e) => { sx = e.clientX; moved = false; });
    row.addEventListener('pointermove', (e) => { if (sx == null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 8) { moved = true; row.style.transform = `translateX(${dx}px)`; row.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / 220)); } });
    const end = (e) => {
      if (sx == null) return; const dx = (e.clientX || sx) - sx; sx = null;
      if (Math.abs(dx) > 90) { row.classList.add('gone'); P.dismissNotif({ items: g.items }); return; }
      row.style.transform = ''; row.style.opacity = '';
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    row.addEventListener('click', () => {
      if (moved) return;
      sfx('tap');
      P.closeQuickPanel();
      if (P.isLocked()) { if (G.lock && G.lock._tapNotif) G.lock._tapNotif(n); return; }
      g.items.forEach((x) => { x.read = true; }); save(); refreshLists();
      if (easyRoute(n)) return;
      if (n.route) P.route(n.route);
    });
    return row;
  }
  async function addUserFlow() {
    const v = await P.dialog({ text: STR('addUserQ'), buttons: [{ label: '취소', value: 'cancel' }, { label: '추가', value: 'add', style: 'primary' }] });
    if (v === 'add') P.toast(STR('addUserNeed'), 2600);
  }
  P.addUserFlow = addUserFlow;

  /* QS 블루투스 device sheet (§4.6.1 · §9.5-3 — "실제 폰처럼 기기 목록 시트") */
  function btSheet() {
    if (overlays.some((o) => o.kind === 'btsheet')) return;
    const S = (G.STORY.settings && G.STORY.settings.btScreen) || {};
    const body = el('div.sh2-btsheet');
    let searchT = 0, searched = false, offs = [];
    const render = () => {
      body.innerHTML = '';
      const on = P.btOn();
      const tg = toggle(on, (v) => { const b = BT(); if (b) safe(() => b.setOn(v)); return undefined; }, { label: S.title || '블루투스' });
      body.appendChild(el('div.sh2-bs-head', null, el('b', null, T(S.title || '블루투스')), el('span', null, T(on ? (S.on || '켜짐') : (S.off || '꺼짐'))), tg));
      if (!on) return;
      body.appendChild(el('div.sh2-bs-gh', null, T(S.saved || '저장된 기기')));
      const st = P.btState();
      const dev = el('button.sh2-bs-dev' + (st === 'connected' ? '.on' : ''), { 'data-qa': 'bt.device:2층_스피커' },
        el('span.sh2-bs-ic', { html: SVG.speaker }), el('span.sh2-bs-m', null, el('b', null, btName()), el('small', null, P.btLabel())));
      dev.addEventListener('click', () => { sfx('tap'); P.btTap(); });
      body.appendChild(dev);
      body.appendChild(el('div.sh2-bs-gh', null, T(S.available || '사용 가능한 기기')));
      body.appendChild(el('div.sh2-bs-scan', null, searched ? T(S.none || STR('noDevices')) : T(S.searching || '검색 중…')));
    };
    const ref = () => render();
    P.sheet({ body, kind: 'btsheet', cls: 'sh2-sheet-bt', mount: () => {
      offs = [G.bus.on('bt:change', ref), G.bus.on('flag', ref), G.bus.on('flag:off', ref)];
      searchT = setTimeout(() => { searched = true; render(); }, 2500);
    }, onClose: () => { clearTimeout(searchT); offs.forEach((f) => f && f()); } });
    render();
  }
  function btName() { const s = G.e2 && G.e2.session && safe(() => G.e2.session.get('btRename'), null); return s || '2층_스피커'; }
  P.btName = btName;
  P.btSheet = btSheet;

  /* =========================================================
   * volume panel — §4.6.7 · §5.3 (G.phone.volume)
   * ========================================================= */
  const mediaOut = () => (G.media && G.media.out ? safe(() => G.media.out(), 'phone') : (flag('btConnected') && !flag('musicCut') ? 'bt' : 'phone'));
  const mediaVol = (t) => (G.media && G.media.getVolume ? safe(() => G.media.getVolume(t), 0) : (t === 'bt' ? vget('btVol', 15) : vget('phoneVol', 60)));
  const setMediaVol = (t, v) => { if (G.media && G.media.setVolume) safe(() => G.media.setVolume(t, v, { source: 'ui' })); else vset(t === 'bt' ? 'btVol' : 'phoneVol', v); };
  /** builds the 미디어 row (also used by 설정 › 소리 및 진동 › 볼륨 and the 2층_스피커 ⚙ screen) */
  P.mediaVolumeRow = function (o) {
    o = o || {};
    const V = (G.STORY.settings && G.STORY.settings.volume) || {};
    const fixed = o.target || null;               // 'bt' for the 2층_스피커 ⚙ row
    const tgt = () => fixed || mediaOut();
    const head = el('span.vol-h');
    const pct = el('b.vol-pct');
    const sl = slider(mediaVol(tgt()), { qa: o.qa || 'vol.slider:media', label: o.label || '미디어',
      onInput: (v) => { setMediaVol(tgt(), v); pct.textContent = v + '%'; } });
    const draw = () => { const t = tgt(); head.textContent = T(o.title || (t === 'bt' ? V.mediaBt : V.mediaPhone)); const v = mediaVol(t); sl.setValue(v); pct.textContent = v + '%'; };
    draw();
    const row = el('div.vol-row.media', null, el('div.vol-top', null, head, pct), sl);
    const offs = [G.bus.on('media:vol', (e) => { if (!e || e.target === tgt()) draw(); }), G.bus.on('media:out', draw), G.bus.on('bt:change', draw), G.bus.on('var', (e) => { if (e && /^(btVol|phoneVol)$/.test(e.k)) draw(); })];
    row.dispose = () => offs.forEach((f) => f && f());
    row.slider = sl;
    return row;
  };
  P.volume = function (o) {
    if (overlays.some((x) => x.kind === 'volume')) return;
    const V = (G.STORY.settings && G.STORY.settings.volume) || {};
    const media = P.mediaVolumeRow({});
    const deco = (label, val) => el('div.vol-row', null, el('div.vol-top', null, el('span.vol-h', null, T(label))), slider(val, { label }));
    const close = el('button.vol-close', { 'data-qa': 'vol.close', 'aria-label': '닫기', html: SVG.close });
    const panel = el('div.vol-panel', { 'data-qa': 'vol.panel', role: 'dialog' },
      el('div.vol-head', null, el('b', null, T(V.title || '볼륨')), close),
      media, deco(V.ring || '벨소리', 40), deco(V.notif || '알림', 30), deco(V.system || '시스템', 30));
    const wrap = el('div.vol-wrap', null, panel);
    let ov = null;
    const done = () => { media.dispose(); if (ov) ov.close(); ov = null; };
    close.addEventListener('click', () => { sfx('tap'); done(); });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(); });
    ov = P.overlay(wrap, { kind: 'volume', onBack: done, dismiss: done });
    setTimeout(() => { try { media.slider.focus({ preventScroll: true }); } catch (e) {} }, 60);
    void o;
  };

  /* =========================================================
   * near-share sheet — §4.10.4 (N15)
   * ========================================================= */
  P.nearShare = function (o) {
    void o;
    cue('nearby.chime');
    const parts = STR('share').split(' · ');
    return new Promise((resolve) => {
      let done = false, ov = null;
      const finish = (v) => { if (done) return; done = true; ov.close(); resolve(v); };
      const dec = el('button.share-btn', { 'data-qa': 'share.decline', onclick: () => { sfx('tap'); finish('decline'); } }, '거절');
      const acc = el('button.share-btn.primary', { 'data-qa': 'share.accept', onclick: () => { sfx('tap'); finish('accept'); } }, '받기');
      const box = el('div.share-box', { role: 'dialog' },
        el('div.share-top', null, el('span.share-ic', { html: SVG.share }), el('b', null, '근거리 공유')),
        el('div.share-from', null, parts[0] || ''), el('div.share-what', null, parts.slice(1).join(' · ')),
        el('div.share-btns', null, dec, acc));
      const wrap = el('div.share-wrap', null, box);
      ov = P.overlay(wrap, { modal: 'soft', kind: 'share', onBack: () => finish('decline'), dismiss: () => finish('decline') });
    });
  };

  /* =========================================================
   * ep3 (h) — DND `지금 사용` (shared by the QS tile and 설정 › 방해 금지 — §3.9 · §4.7.3) · vars.dndAt = in-game 'HH:MM'
   * ========================================================= */
  P.setDndNow = function (on) {
    on = !!on;
    vset('dndNow', on);
    vset('dndAt', on ? hm() : null);
    updateStatus(true);
  };

  /* =========================================================
   * ep3 (j) — phone text scale (easymode E10 · 설정 › 글자 크기와 스타일): phone layers' --ts = G.settings.textSize × f.
   * The game layer (cards · subtitles · notebook) keeps the root --ts. null / 1 = no override (ep2 never calls this).
   * ========================================================= */
  let txtScale = null;
  function applyTextScale() {
    if (!root) return;
    const nodes = [homeEl, stackEl, lockEl, overlayEl, bannerEl, switchEl].concat(Array.from(root.querySelectorAll('.sh3-call'))).filter(Boolean);
    if (txtScale == null || txtScale === 1) { nodes.forEach((n) => n.style.removeProperty('--ts')); return; }
    const base = Number(G.settings && G.settings.textSize) || 1;
    const v = String(Math.round(base * txtScale * 1000) / 1000);
    nodes.forEach((n) => n.style.setProperty('--ts', v));
  }
  P.textScale = function (f) { txtScale = (f == null || !isFinite(+f)) ? null : +f; applyTextScale(); };

  /* =========================================================
   * ep3 (f) — call screen (§5.3 통화 화면 · §4.3.7 · §3.2.3 — the ep1 P.callScreen contract, simulation UI only: no tel:,
   * no real dialling). Results come from the caller's script (comms G.STORY.dial.results). Layer .sh3-call z 47 (above the
   * lock, eye views and the emergency keypad; dialogs / sheets z 50 stay above it). No other phone in the room rings (§0.1 #34).
   *   spec = { id, name, number, kind:'cell'|'talk'|'emergency', avatar, big=false, script(api) }
   *   api  = { status(text) · card(text | {who, text}, {gapMs}) → Promise · beep(hz=1000, s=0.5) → Promise · connect() · line(on) ·
   *            ring(on) · wait(ms) → Promise (playMs) · timer(on) · end(label = STR.callEnd) · ended (getter) · node }
   *   ringback ('call.ringback' / talk 'talk.dial', one cycle per cue, repeated) runs from the start until connect() / a status
   *   other than STR.connecting / ring(false) / end. Red end (data-qa call.end) ends at any time → { by:'user' }.
   * ========================================================= */
  let callCur = null;
  P.inCall = function () { return !!callCur; };
  P.callScreen = function (spec) {
    spec = spec || {};
    if (callCur) { console.warn('[phone] callScreen: a call is already up'); return Promise.resolve({ sec: 0, by: 'busy' }); }
    return new Promise((resolve) => {
      const kind = spec.kind === 'talk' ? 'talk' : spec.kind === 'emergency' ? 'emergency' : 'cell';
      const big = !!spec.big;
      const id = spec.id || ('call' + Date.now().toString(36));
      const name = T(spec.name || spec.number || '');
      const number = spec.number && name.indexOf(T(spec.number)) < 0 ? T(spec.number) : '';
      const avSrc = spec.avatar ? img(spec.avatar) : '';
      const av = el('div.sh3-cs-av');
      if (avSrc) { const im = el('img', { src: avSrc, alt: '' }); im.onerror = () => { im.remove(); av.innerHTML = SVG.person; }; av.appendChild(im); }
      else av.innerHTML = SVG.person;
      const connecting = STR('connecting');
      const statusEl = el('div.sh3-cs-status', null, connecting);
      const timeEl = el('div.sh3-cs-time');
      const cards = el('div.sh3-cs-cards', { 'aria-live': 'polite' });
      const op = (k, label, svg) => {
        const b = el('button.sh3-cs-op', { 'data-qa': 'call.btn:' + k, 'aria-pressed': 'false' }, el('span.sh3-cs-opi', { html: svg }), el('small', null, label));
        b.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
        return b;
      };
      const endBtn = el('button.sh3-cs-end', { 'data-qa': 'call.end', 'aria-label': '종료' }, el('span', { html: SVG.callEnd }));
      const bottom = big
        ? el('div.sh3-cs-bigrow', null, op('speaker', '스피커', SVG.spk), el('div.sh3-cs-endw', null, endBtn, el('small', null, '종료')))
        : el('div.sh3-cs-std', null, el('div.sh3-cs-ops', null, op('speaker', '스피커', SVG.spk), op('mute', '음소거', SVG.mic), op('keypad', '키패드', SVG.pad)),
          el('div.sh3-cs-endw', null, endBtn));
      const node = el('div.sh3-call' + (big ? '.big' : '') + '.k-' + kind, { 'data-qa': 'call.screen', role: 'dialog', 'aria-label': name, dataset: { kind, scr: 'call.' + kind } },
        el('div.sh3-cs-top', null, av, el('div.sh3-cs-name', null, name), kind === 'talk' ? el('div.sh3-cs-kind', null, (typeof spec.label === 'string' && spec.label) || '보이스톡') : null,
          number ? el('div.sh3-cs-num', null, number) : null, statusEl, timeEl),
        cards, bottom);
      if (txtScale != null && txtScale !== 1) node.style.setProperty('--ts', String(Math.round((Number(G.settings && G.settings.textSize) || 1) * txtScale * 1000) / 1000));
      if (G.ui && G.ui.hideKeyboard) safe(() => G.ui.hideKeyboard());
      P.closeQuickPanel();
      root.appendChild(node);
      requestAnimationFrame(() => node.classList.add('in'));
      P.statusTheme('light');

      let ended = false, ringing = false, ringT = 0, sec = 0, timerOn = false, t0 = 0, lineH = null;
      const waits = [];
      const clockLive = () => !!(G.bus && G.state && G.clock && G.clock.started && safe(() => G.clock.started(), false));
      const waitMs = (ms) => new Promise((res) => {
        if (ended || !(ms > 0)) { res(); return; }
        if (!clockLive()) { const w = { res, t: setTimeout(() => { const i = waits.indexOf(w); if (i >= 0) waits.splice(i, 1); res(); }, ms) }; waits.push(w); return; }
        waits.push({ res, target: playMs() + ms });
      });
      const offTick = G.bus ? G.bus.on('tick', () => {
        const pm = playMs();
        for (let i = waits.length - 1; i >= 0; i--) if (waits[i].target != null && pm >= waits[i].target) { const w = waits.splice(i, 1)[0]; w.res(); }
        if (timerOn) { const s = Math.max(0, Math.floor((pm - t0) / 1000)); if (s !== sec) { sec = s; timeEl.textContent = Math.floor(s / 60) + ':' + pad(s % 60); } }
      }) : null;
      const ringCue = kind === 'talk' ? 'talk.dial' : 'call.ringback';
      const ringOnce = () => { if (!ringing || ended) return; cue(ringCue); ringT = setTimeout(ringOnce, 3000); };
      const ring = (on) => { on = !!on && !ended; if (on === ringing) return; ringing = on; clearTimeout(ringT); if (on) ringT = setTimeout(ringOnce, 500); };
      const stopLine = () => { if (lineH && typeof lineH.stop === 'function') safe(() => lineH.stop()); lineH = null; };
      const backOff = P.pushBack(() => !!callCur);           // a real in-call screen: back does not drop the call
      callCur = { id, kind, node };
      const close = (by) => {
        if (offTick) offTick();
        backOff();
        node.classList.add('out');
        setTimeout(() => node.remove(), 420);
        callCur = null;
        const top = P.top();
        P.statusTheme(top && top.node && top.node.dataset.status ? top.node.dataset.status : (P.isLocked() ? 'light' : homeStatus()));
        G.bus && G.bus.emit('call:end', { id, kind, number: spec.number || '', sec, by });
        resolve({ sec, by });
      };
      const finish = (by, label) => {
        if (ended) return;
        ended = true; ring(false); ringing = false; clearTimeout(ringT); stopLine();
        timerOn = false;
        statusEl.textContent = T(label || '') || STR('callEnd');
        node.classList.add('ended');
        cue(kind === 'talk' ? 'talk.end' : 'call.end');
        waits.splice(0).forEach((w) => { clearTimeout(w.t); w.res(); });
        setTimeout(() => close(by), 1000);
      };
      endBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); finish('user'); });
      const reveal = (line, text) => new Promise((res) => {
        const chars = Array.from(text);
        if (!chars.length || ended) { line.textContent = text; res(); return; }
        let i = 0;
        const stepT = () => { if (ended) { line.textContent = text; res(); return; } i++; line.textContent = chars.slice(0, i).join(''); if (i >= chars.length) { res(); return; } setTimeout(stepT, chars[i - 1] === '…' ? 400 : 70); };
        stepT();
      });
      const api = {
        node,
        get ended() { return ended; },
        status(t) { if (ended) return; const s = T(t || ''); statusEl.textContent = s; if (s !== connecting) ring(false); },
        ring(on) { ring(on); },
        async card(t, o) {
          if (ended) return;
          o = o || {};
          const who = t && typeof t === 'object' ? t.who : o.who;
          const text = T(t && typeof t === 'object' ? t.text : t);
          if (!text) return;
          const body = el('span.sh3-cs-ct');
          cards.appendChild(el('div.sh3-cs-card' + (who ? '.who' : ''), null, who ? el('b', null, T(who)) : null, body));
          await reveal(body, text);
          await waitMs(o.gapMs != null ? o.gapMs : 1600);
        },
        async beep(hz, s) { if (ended) return; s = s || 0.5; cue('call.beep', { hz: hz || 1000, s }); await waitMs(s * 1000 + 200); },
        connect() { if (ended) return; ring(false); cue('call.connect'); statusEl.textContent = ''; node.classList.add('live'); api.timer(true); },
        line(on) { if (ended) return; if (on) { stopLine(); lineH = cue('call.line') || null; } else stopLine(); },
        wait: waitMs,
        timer(on) { timerOn = !!on; if (timerOn) { t0 = playMs(); sec = 0; timeEl.textContent = '0:00'; } },
        end(label) { finish('script', label); },
      };
      G.bus && G.bus.emit('call:start', { id, kind, number: spec.number || '', name: spec.name || '' });
      ring(true);
      (async () => {
        try { if (typeof spec.script === 'function') await spec.script(api); else await waitMs(4000); }
        catch (e) { console.error('[phone] call script', e); }
        if (!ended) finish('script');
      })();
    });
  };

  /* =========================================================
   * users — two users on one device (§3.9 · §5.4 셸 · §5.7; ARCH §4.9)
   * ========================================================= */
  let switching = false;
  const USERS = (G.users = G.users || {});
  USERS.current = function () { const u = vget('user', 'n'); return u === 'dash' ? 'dash' : 'n'; };
  USERS.switching = function () { return switching; };
  USERS.dashHidden = function () { return flag('doorOpened') && !flag('END'); };          // `[—]` not drawn (§3.17)
  USERS.dashLocked = function () { return !!SH().dashLocked || !!(G.state && G.state.stage && G.state.stage.e2_dash === 'locked'); };
  USERS.canSwitch = function (id) {
    if (id === 'n') return true;
    if (id !== 'dash') return false;
    if (USERS.dashHidden() || USERS.dashLocked()) return false;
    const u = G.STORY.users && G.STORY.users.dash;
    return !u || u.allowSwitch !== false;
  };
  function showShell(to) {
    const u = (G.STORY.users && G.STORY.users[to]) || {};
    switchEl.innerHTML = '';
    switchEl.append(el('div.sw-av' + (to === 'dash' ? '.dash' : ''), null, to === 'n' ? initial() : '—'),
      el('div.sw-name', null, T(u.name || (to === 'n' ? '{N}' : '—'))),
      el('div.sw-text', null, STR('switching')));
    switchEl.classList.remove('hidden', 'out');
    requestAnimationFrame(() => switchEl.classList.add('in'));
  }
  function hideShell() {
    switchEl.classList.add('out'); switchEl.classList.remove('in');
    setTimeout(() => { switchEl.classList.add('hidden'); switchEl.classList.remove('out'); }, 320);
  }
  function leaveUserUI() {
    P.closeQuickPanel();
    P.dismissModals();
    if (G.ui && G.ui.hideKeyboard) safe(() => G.ui.hideKeyboard());
    if (G.room && G.room.isOpen && safe(() => G.room.isOpen(), false)) {
      const c = safe(() => G.room.current(), null);
      if (!c || c.mode !== 'eye') safe(() => G.room.close());
    }
    P.closeAll(true);
    SH().app = null;
    clearBanners();
  }
  /** 2 s full-screen shell → target lock screen (§5.4 셸). opts.instant skips the shell (debug). */
  USERS.switchTo = async function (id, o) {
    o = o || {};
    const from = USERS.current();
    if (switching || (id !== 'n' && id !== 'dash')) return;
    if (id === from) { if (o.instant && G.lock && G.lock.show) G.lock.show(id); return; }
    if (!USERS.canSwitch(id)) { P.toast(STR('noSwitch')); return; }
    if (id === 'dash' && flag('M1') && !flag('M2') && G.e2 && G.e2.requestM2) safe(() => G.e2.requestM2('dashSwitch'));
    switching = true;
    checkHome();
    G.bus && G.bus.emit('users:switching', { from, to: id });
    leaveUserUI();
    if (!o.instant) {
      showShell(id);
      cue('user.switch', { dir: id === 'dash' ? 'toDash' : 'toN' });
      await sleep(2000);
    }
    vset('user', id);
    save();
    if (G.lock && G.lock.show) safe(() => G.lock.show(id)); else P.setLocked(true);
    P.renderHome();
    if (!o.instant) hideShell();
    switching = false;
    updateStatus(true);
    checkHome();
    G.bus && G.bus.emit('users:switched', { from, to: id });
  };
  /** ending (doorOpened / resume): '—' → 2 s shell → {N} HOME, no lock screen (ARCH §4.9 · §3.17) */
  USERS.forceN = async function () {
    if (switching) { while (switching) await sleep(100); }
    const from = USERS.current();
    if (from === 'dash') {
      switching = true;
      G.bus && G.bus.emit('users:switching', { from, to: 'n' });
      leaveUserUI();
      showShell('n');
      cue('user.switch', { dir: 'toN' });
      await sleep(2000);
      vset('user', 'n'); save();
    }
    if (G.lock && G.lock.hide) safe(() => G.lock.hide()); else P.setLocked(false);
    if (P.isLocked()) P.setLocked(false);
    P.renderHome();
    if (from === 'dash') { hideShell(); switching = false; checkHome(); G.bus && G.bus.emit('users:switched', { from, to: 'n' }); }
    updateStatus(true);
  };
  /** '—' PIN — exactly '0310' (§3.9 · §9.5-2). First acceptance sets M3. Wrong → caller shows STR.pinWrong; every 5th → 30 s. */
  USERS.unlockDash = function (pin) {
    const want = (G.STORY.users && G.STORY.users.dash && G.STORY.users.dash.pin) || '0310';
    if (String(pin) === want) {
      const first = !flag('M3');
      if (first) G.flag && G.flag('M3', true);
      G.bus && G.bus.emit('users:dashUnlocked', { first });
      return true;
    }
    vset('pinTries', (vget('pinTries', 0) || 0) + 1);       // stored, never read (§3.9)
    SH().dashFails = (SH().dashFails || 0) + 1; save();
    return false;
  };
  USERS.dashFails = function () { return SH().dashFails || 0; };
  /** 01:20 chip `전환 막아 두기` (hook users:lockDash) — the 설정 › 사용자 › — screen turns the toggle off for 2 s (security.js) */
  USERS.lockDash = function () {
    if (G.security && G.security._lockDash) return Promise.resolve(safe(() => G.security._lockDash(), null)).then(() => { SH().dashLocked = true; save(); qsRefresh(); });
    SH().dashLocked = true; save(); qsRefresh();
    return Promise.resolve();
  };
  P.user = USERS.current;
  P.switchUser = USERS.switchTo;

  /* resume (ARCH §8.2 M1…M5): after the first unlock of this page load, reopen the saved app's first screen */
  let resumeChecked = false;
  function onUnlockResume(e) {
    if (resumeChecked) return;
    resumeChecked = true;
    if (e.first || e.how === 'notif') return;
    const r = SH().app;
    if (!r || !r.id || (r.user || 'n') !== (e.user || USERS.current())) return;
    setTimeout(() => {
      if (stack.length || P.isLocked()) return;
      if (r.id === 'camera' && G.room && G.room.open) { const rv = vget('room', null); safe(() => G.room.open({ mode: 'camera', view: rv && rv.view })); return; }
      if (apps[r.id]) P.openApp(r.id);
    }, 80);
  }
})();
