/* =========================================================
 * Phone shell: status bar, home screen, app registry & navigation stack,
 * notification banners, dialogs, toasts, call screen.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep, pad, fmtTime } = G.util;

  const P = (G.phone = {});
  const apps = (G.apps = {});
  const order = [];
  let root, statusBar, homeEl, stackEl, lockEl, overlayEl, bannerEl, homeBar, wallpaperEl;
  const stack = []; // [{appId, node, onBack, onClose}]

  /* ---------------- registry ---------------- */
  /** G.app('gallery', { name, icon:{bg, svg}, open(params), dock:bool, hidden:()=>bool, badge:()=>n }) */
  G.app = function (id, def) { def.id = id; apps[id] = def; if (!order.includes(id)) order.push(id); if (homeEl) P.renderHome(); };

  /* ---------------- init ---------------- */
  P.init = function () {
    root = document.getElementById('screen');
    wallpaperEl = el('div.wallpaper');
    homeEl = el('div#home.layer');
    stackEl = el('div#app-stack.layer');
    lockEl = el('div#lock.layer.hidden');
    overlayEl = el('div#overlays.layer');
    bannerEl = el('div#banners');
    statusBar = buildStatusBar();
    homeBar = el('div.home-bar', { role: 'button', 'aria-label': '홈' }, el('i'));
    root.append(wallpaperEl, homeEl, stackEl, lockEl, overlayEl, bannerEl, statusBar, homeBar);

    // home indicator: tap or swipe up -> home
    let sy = null;
    homeBar.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; }, { passive: true });
    homeBar.addEventListener('touchend', (e) => { if (sy != null && sy - e.changedTouches[0].clientY > 20) P.home(); sy = null; });
    homeBar.addEventListener('click', () => P.home());

    // Trap browser/Android back button -> phone back
    try {
      history.replaceState({ haru: 0 }, '');
      history.pushState({ haru: 1 }, '');
      window.addEventListener('popstate', () => { history.pushState({ haru: 1 }, ''); P.back(); });
    } catch (e) {}

    P.renderHome();
    setInterval(updateStatus, 1000);
    updateStatus();
    G.bus.on('flag', () => { P.renderHome(); });
  };

  /* ---------------- status bar ---------------- */
  function buildStatusBar() {
    return el('div#statusbar',
      el('span.sb-time', null, '3:33'),
      el('span.sb-notch'),
      el('span.sb-right', null,
        el('span.sb-signal', { html: '<i></i><i></i><i></i><i></i>' }),
        el('span.sb-net', null, 'LTE'),
        el('span.sb-batt', null, el('b.sb-pct', null, '15'), el('span.sb-battbody', null, el('span.sb-battfill')))));
  }
  function updateStatus() {
    const d = G.clock.now();
    const t = `${d.getHours()}:${pad(d.getMinutes())}`;
    statusBar.querySelector('.sb-time').textContent = t;
    const b = P.battery();
    statusBar.querySelector('.sb-pct').textContent = b;
    const fill = statusBar.querySelector('.sb-battfill');
    fill.style.width = Math.max(4, b) + '%';
    fill.classList.toggle('low', b <= 15);
    const bars = G.state.vars.signal != null ? G.state.vars.signal : 1;
    statusBar.querySelectorAll('.sb-signal i').forEach((n, i) => n.classList.toggle('on', i < bars));
    statusBar.querySelector('.sb-net').textContent = bars === 0 ? '서비스 없음' : 'LTE';
    G.bus.emit('tick', d);
  }
  P.battery = function () {
    // 15% at start, -1% every ~3 min of play, never below 3% (story can override)
    if (G.state.vars.battery != null) return G.state.vars.battery;
    return Math.max(3, 15 - Math.floor(G.state.playMs / 180000));
  };
  P.statusTheme = function (theme) { statusBar.classList.toggle('dark', theme === 'dark'); };
  P.updateStatus = updateStatus;

  /* ---------------- home screen ---------------- */
  P.setWallpaper = function (src) { wallpaperEl.style.backgroundImage = `url("${src}")`; };
  P.renderHome = function () {
    if (!homeEl) return;
    homeEl.innerHTML = '';
    const d = G.clock.now();
    const widget = el('div.home-widget', null,
      el('div.hw-time', null, `${pad(d.getHours())}:${pad(d.getMinutes())}`),
      el('div.hw-date', null, G.util.fmtKDate(d)),
      el('div.hw-weather', null, '🌧  비 · 4°  해솔동'));
    homeEl.appendChild(widget);
    const grid = el('div.app-grid');
    const dock = el('div.dock');
    order.forEach((id) => {
      const a = apps[id];
      if (a.hidden && a.hidden()) return;
      const icon = P.iconNode(a);
      (a.dock ? dock : grid).appendChild(icon);
    });
    homeEl.append(grid, el('div.page-dots', null, el('i.on'), el('i')), dock);
  };
  G.bus.on('tick', (d) => {
    if (!homeEl) return;
    const t = homeEl.querySelector('.hw-time');
    if (t) t.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  P.iconNode = function (a) {
    const badge = a.badge ? a.badge() : 0;
    const n = el('button.app-icon', { 'aria-label': a.name, dataset: { app: a.id } },
      el('span.ai-img', { style: { background: a.icon.bg }, html: a.icon.svg }),
      badge ? el('span.ai-badge', null, badge > 99 ? '99+' : String(badge)) : null,
      a.dock ? null : el('span.ai-label', null, a.name));
    n.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); P.openApp(a.id); });
    return n;
  };
  P.refreshBadges = function () { P.renderHome(); };

  /* ---------------- navigation ---------------- */
  P.openApp = function (id, params) {
    const a = apps[id];
    if (!a) return;
    // opening an app from home clears the stack
    if (!params || !params.keepStack) P.closeAll(true);
    P.currentApp = id;
    G.bus.emit('app:open', id);
    try { a.open(params || {}); } catch (e) { console.error('[app]', id, e); }
  };
  /** push a screen node. opts: {onBack():bool (return true to consume), onClose(), anim:'slide'|'up'|'fade'|'none', appId} */
  P.push = function (node, opts) {
    opts = opts || {};
    const entry = Object.assign({ node, appId: P.currentApp }, opts);
    node.classList.add('screen-view');
    node.classList.add('anim-' + (opts.anim || (stack.length ? 'slide' : 'zoom')));
    stackEl.appendChild(node);
    stack.push(entry);
    requestAnimationFrame(() => node.classList.add('in'));
    if (stack.length > 1) stack[stack.length - 2].node.classList.add('covered');
    P.statusTheme(node.dataset.status || 'light');
    G.bus.emit('screen:push', entry);
    return entry;
  };
  P.pop = function (silent) {
    const top = stack.pop();
    if (!top) return;
    if (!silent && G.audio) G.audio.sfx.back();
    top.node.classList.remove('in'); top.node.classList.add('out');
    top.onClose && top.onClose();
    setTimeout(() => top.node.remove(), 320);
    const prev = stack[stack.length - 1];
    if (prev) { prev.node.classList.remove('covered'); P.statusTheme(prev.node.dataset.status || 'light'); prev.onResume && prev.onResume(); }
    else { P.currentApp = null; P.statusTheme('light'); P.renderHome(); }
    G.bus.emit('screen:pop', top);
  };
  P.back = function () {
    // overlays (dialogs, call screens) first
    const ov = overlayEl.lastElementChild;
    if (ov && ov._onBack) { ov._onBack(); return; }
    if (ov && ov.dataset.modal === 'hard') return;
    if (!lockEl.classList.contains('hidden')) { G.bus.emit('lock:back'); return; }
    const top = stack[stack.length - 1];
    if (!top) return;
    if (top.onBack && top.onBack() === true) return;
    P.pop();
  };
  P.closeAll = function (silent) {
    while (stack.length) { const e = stack.pop(); e.onClose && e.onClose(); e.node.remove(); }
    P.currentApp = null;
    if (!silent) P.renderHome();
    P.statusTheme('light');
  };
  P.home = function () {
    if (!lockEl.classList.contains('hidden')) return;
    const ov = overlayEl.lastElementChild;
    if (ov && ov.dataset.modal) return;
    if (!stack.length) return;
    G.audio && G.audio.sfx.whoosh();
    const nodes = stack.slice();
    stack.length = 0;
    nodes.forEach((e) => { e.onClose && e.onClose(); e.node.classList.add('to-home'); setTimeout(() => e.node.remove(), 300); });
    P.currentApp = null; P.statusTheme('light'); P.renderHome();
    G.bus.emit('home');
  };
  P.top = function () { return stack[stack.length - 1]; };
  P.stackDepth = function () { return stack.length; };

  /* ---------------- standard screen builder ----------------
   * G.ui.screen({title, sub, back:true, right:[nodes], theme:'light'|'dark', cls, body:node, footer:node}) */
  const UI = (G.ui = G.ui || {});
  UI.screen = function (o) {
    const head = o.header === false ? null : el('header.sv-head',
      o.back === false ? el('span.sv-sp') : el('button.sv-back', { 'aria-label': '뒤로', onclick: () => P.back(), html: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      el('div.sv-titles', null, el('div.sv-title', null, o.title || ''), o.sub ? el('div.sv-sub', null, o.sub) : null),
      el('div.sv-right', null, o.right || []));
    const body = el('div.sv-body' + (o.bodyCls ? '.' + o.bodyCls : ''));
    if (o.body) body.appendChild(o.body);
    const node = el('section' + (o.cls ? '.' + o.cls.split(' ').join('.') : ''), { dataset: { status: o.theme === 'dark' ? 'dark' : 'light', theme: o.theme || 'light' } }, head, body, o.footer || null);
    node.body = body; node.head = head;
    return node;
  };
  UI.list = function (items) {
    return el('div.list', null, items.map((it) => {
      const row = el('button.list-row' + (it.cls ? '.' + it.cls : ''), { onclick: it.onClick ? () => { G.audio && G.audio.sfx.tap(); it.onClick(); } : null, disabled: it.disabled },
        it.icon ? el('span.lr-icon', { html: it.icon }) : null,
        el('span.lr-main', null, el('span.lr-title', null, it.title), it.sub ? el('span.lr-sub', null, it.sub) : null),
        it.meta ? el('span.lr-meta', null, it.meta) : null,
        it.chevron !== false && it.onClick ? el('span.lr-chev', { html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>' }) : null);
      return row;
    }));
  };

  /* ---------------- overlays ---------------- */
  P.overlay = function (node, opts) {
    opts = opts || {};
    if (opts.modal) node.dataset.modal = opts.modal;
    if (opts.onBack) node._onBack = opts.onBack;
    overlayEl.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    return { node, close() { node.classList.remove('in'); node.classList.add('out'); setTimeout(() => node.remove(), 300); } };
  };
  /** OS-style alert. buttons: [{label, style:'primary'|'danger'|'', value}] -> Promise<value> */
  P.dialog = function (o) {
    return new Promise((resolve) => {
      let ov;
      const btns = (o.buttons || [{ label: '확인', value: true, style: 'primary' }]).map((b) =>
        el('button.dlg-btn' + (b.style ? '.' + b.style : ''), { onclick: () => { G.audio && G.audio.sfx.tap(); ov.close(); resolve(b.value); } }, b.label));
      let input = null;
      if (o.input) {
        input = el('input.dlg-input', { type: o.input.type || 'text', placeholder: o.input.placeholder || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: o.input.inputmode || null, maxlength: o.input.maxlength || null });
        btns.forEach((b, i) => { const v = (o.buttons || [])[i]; if (v && v.value === 'submit') { b.onclick = null; b.addEventListener('click', () => { ov.close(); resolve({ value: input.value }); }); } });
      }
      const node = el('div.dialog-wrap', null, el('div.dialog', null,
        o.title ? el('div.dlg-title', null, o.title) : null,
        o.text ? el('div.dlg-text', { html: o.html ? o.text : null }, o.html ? null : o.text) : null,
        input,
        el('div.dlg-btns' + (btns.length > 2 ? '.vertical' : ''), null, btns)));
      ov = P.overlay(node, { modal: 'soft', onBack: () => { ov.close(); resolve(null); } });
      if (input) setTimeout(() => input.focus(), 250);
    });
  };
  P.toast = function (text, ms) {
    const t = el('div.toast', null, text);
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms || 2200);
  };

  /* ---------------- notifications ----------------
   * G.phone.notify({app:'talk', title, body, icon, onTap, silent, vibrate, sticky}) */
  const queue = [];
  let showing = false;
  P.notify = function (n) {
    n.time = G.clock.now().getTime();
    n.id = n.id || 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
    G.state.notifs.unshift({ id: n.id, app: n.app, title: n.title, body: n.body, time: n.time, route: n.route || null });
    G.state.notifs = G.state.notifs.slice(0, 40);
    G.save();
    queue.push(n);
    G.bus.emit('notify', n);
    if (!showing) nextBanner();
  };
  async function nextBanner() {
    const n = queue.shift();
    if (!n) { showing = false; return; }
    showing = true;
    const a = apps[n.app] || {};
    if (!n.silent && G.audio) { G.audio.sfx.notify(); if (n.vibrate !== false) G.audio.sfx.buzz([180]); }
    const b = el('div.banner' + (n.cls ? '.' + n.cls : ''), null,
      el('span.bn-icon', { style: { background: (a.icon && a.icon.bg) || '#333' }, html: (a.icon && a.icon.svg) || '' }),
      el('div.bn-main', null,
        el('div.bn-top', null, el('b', null, a.name || n.appName || ''), el('span', null, '지금')),
        el('div.bn-title', null, n.title || ''),
        n.body ? el('div.bn-body', null, n.body) : null));
    let closed = false;
    const close = () => { if (closed) return; closed = true; b.classList.remove('in'); setTimeout(() => { b.remove(); nextBanner(); }, 280); };
    b.addEventListener('click', () => {
      close();
      if (!lockEl.classList.contains('hidden')) return; // locked: tapping does nothing
      if (n.onTap) n.onTap(); else if (n.route) P.route(n.route);
    });
    let sy = 0;
    b.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; }, { passive: true });
    b.addEventListener('touchmove', (e) => { if (sy - e.touches[0].clientY > 18) close(); }, { passive: true });
    bannerEl.appendChild(b);
    requestAnimationFrame(() => b.classList.add('in'));
    setTimeout(close, n.duration || 4200);
  }
  /** route: {app, params} */
  P.route = function (r) { if (!r) return; P.openApp(r.app, r.params || {}); };

  /* ---------------- lock layer handle ---------------- */
  P.lockLayer = function () { return lockEl; };
  P.isLocked = function () { return !lockEl.classList.contains('hidden'); };
  P.setLocked = function (on) {
    lockEl.classList.toggle('hidden', !on);
    homeBar.classList.toggle('on-lock', on);
    if (!on) P.renderHome();
  };

  /* ---------------- call screen ----------------
   * P.callScreen({name, number, incoming:true, avatar, script: async (api)=>{}, onDecline})
   * api: {sub(text,ms), status(text), end(), answered:Promise} */
  P.callScreen = function (o) {
    return new Promise((resolve) => {
      let ring = null, timer = null, secs = 0, ended = false;
      const statusEl = el('div.call-status', null, o.incoming ? '휴대전화' : '발신 중…');
      const timeEl = el('div.call-time');
      const subs = el('div.call-subs');
      const node = el('div.call-screen' + (o.creepy ? '.creepy' : ''), null,
        el('div.call-top', null,
          el('div.call-avatar', { html: o.avatar || '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>' }),
          el('div.call-name', null, o.name || '알 수 없음'),
          el('div.call-number', null, o.number || ''),
          statusEl, timeEl),
        subs,
        el('div.call-actions'));
      const actions = node.querySelector('.call-actions');
      const ov = P.overlay(node, { modal: 'hard' });
      const api = {
        node,
        status(t) { statusEl.textContent = t; },
        async sub(t, ms, cls) {
          const line = el('div.cs-line' + (cls ? '.' + cls : ''), null, t);
          subs.appendChild(line); requestAnimationFrame(() => line.classList.add('in'));
          subs.scrollTop = 1e6;
          await sleep(ms || 2400);
        },
        end(reason) {
          if (ended) return; ended = true;
          if (ring) ring.stop(); clearInterval(timer);
          G.audio && G.audio.stopSpeak();
          G.audio && G.audio.sfx.callEnd();
          statusEl.textContent = reason || '통화 종료';
          node.classList.add('ended');
          setTimeout(() => { ov.close(); resolve(api.result || 'ended'); }, 1100);
        },
        isEnded() { return ended; },
      };
      const startTimer = () => { timer = setInterval(() => { secs++; timeEl.textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`; }, 1000); };
      const endBtn = el('button.call-btn.end', { 'aria-label': '종료', html: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>', onclick: () => { api.result = api.result || 'hangup'; api.end(); } });
      if (o.incoming) {
        ring = G.audio ? G.audio.ringtone(o.creepy) : null;
        const ans = el('button.call-btn.answer', { 'aria-label': '받기', html: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>' });
        const dec = el('button.call-btn.end', { 'aria-label': '거절', html: endBtn.innerHTML });
        actions.append(el('div.cb-wrap', null, dec, el('span', null, '거절')), el('div.cb-wrap', null, ans, el('span', null, '받기')));
        dec.addEventListener('click', () => { api.result = 'declined'; if (ring) ring.stop(); o.onDecline && o.onDecline(); api.end('거절됨'); });
        ans.addEventListener('click', async () => {
          if (ring) ring.stop(); ring = null;
          actions.innerHTML = ''; actions.append(el('div.cb-wrap', null, endBtn, el('span', null, '종료')));
          statusEl.textContent = '통화 중'; startTimer(); node.classList.add('live');
          api.result = 'answered';
          try { await o.script(api); } catch (e) { console.error(e); }
          if (!ended) api.end();
        });
        if (o.autoMissMs) setTimeout(() => { if (!ended && ring) { api.result = 'missed'; o.onMiss && o.onMiss(); api.end('부재중'); } }, o.autoMissMs);
      } else {
        actions.append(el('div.cb-wrap', null, endBtn, el('span', null, '종료')));
        (async () => {
          try { await o.script(Object.assign(api, { connected() { statusEl.textContent = '통화 중'; startTimer(); node.classList.add('live'); } })); } catch (e) { console.error(e); }
          if (!ended) api.end();
        })();
      }
    });
  };
})();
