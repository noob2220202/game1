/* =========================================================
 * Lock screens (ep2) — owner: shell. DESIGN §3.2 · §3.9 · §3.19 ⑥⑦ · §4.0 (잠금 표) · §4.1.8 · §4.6.4 · §4.7.1 · §5.3 · §9.5-2/-3/-4
 *   {N} normal — clock · date · smart-lock line · widget line · N01–N03 · [긴급 통화] · ◉ finger (always on, 0.8 s) · [카메라]
 *               swipe ≥ 80 px / ↑ / Enter / desktop drag: trusted → open, else `PIN 입력` pad (any code → PIN이 올바르지 않습니다)
 *   '—'        — old_room_lock · clock/date only → PIN pad `—` / `PIN 입력` (no dots, [확인], '0310' via G.users.unlockDash)
 *   hook mode  — §4.1.8 (12월 25일 금요일 · 03:33 · trust line · widget · only N17) → onOpen(notif|null), never the home
 * API: G.lock = { init(), show(user='n', {mode:'normal'|'hook', onOpen}), hide(), isShown() }
 *      internal (shell): _tapNotif(n) · _back() · _canBack() · _closeSheets()
 * Bus emitted: lock:show {user, mode} · lock:unlock {user, how:'swipe'|'finger'|'notif'|'pin', first} · security:finger {ok, where}
 * Flags set: M1 (first entry into an unlocked {N} screen — requires gotPhone; not lock-camera, not QS) · fingerIconTouched · pinPadOpened
 * Director: mark('B03') at the first unlock (no sound). Hooks called: phone:emergency. Room: G.room.open({mode:'camera', fromLock:true}).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UTIL = G.util || {};
  const el = UTIL.el;
  const pad = UTIL.pad || ((n) => String(n).padStart(2, '0'));
  const sleep = UTIL.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const LK = (G.lock = G.lock || {});

  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const STR = (k) => T((G.e2 && G.e2.STR && G.e2.STR[k]) || '');
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[lock]', e); return d; } };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const cue = (id, o) => { try { return G.audio && G.audio.cue ? G.audio.cue(id, o) : undefined; } catch (e) {} };
  const vib = (k) => { try { G.audio && G.audio.vibrate && G.audio.vibrate(k); } catch (e) {} };
  const img = (k) => { try { if (G.e2 && G.e2.img) return G.e2.img(k) || ''; } catch (e) {} return (G.IMG && G.IMG[k]) || ''; };
  const now = () => (G.clock && G.clock.now ? G.clock.now() : new Date(2026, 11, 24, 23, 12));
  const hm = () => { if (G.clock && G.clock.hm) return G.clock.hm(); const d = now(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const kDate = (d) => (UTIL.fmtKDate ? UTIL.fmtKDate(d) : `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`);
  const SH = () => { const v = (G.state && G.state.vars) || {}; if (!v.sh) v.sh = {}; return v.sh; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };

  // §3.2 · §4.0 — exact lock-screen lines
  const TXT = {
    trustNet: '🔓 신뢰할 수 있는 네트워크에서 잠금 해제됨',
    trustDev: '🔓 신뢰할 수 있는 기기에서 잠금 해제됨',
    pinTitle: 'PIN 입력', emergency: '긴급 통화', camera: '카메라', cancel: '취소', ok: '확인', dash: '—',
    widgetTitle: '잠금화면 위젯', widgetEdit: '편집',
  };
  const ICON = {
    cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    finger: '<svg viewBox="0 0 24 24"><path d="M12 3.2a7.6 7.6 0 00-7.6 7.6M12 3.2a7.6 7.6 0 017.6 7.6v1.6M7.4 19.4A12 12 0 016.8 11a5.2 5.2 0 0110.4 0v2.4M10 20.6a15 15 0 01-.8-6.2V11a2.8 2.8 0 015.6 0v3.2a10 10 0 01-.6 3.8M12 11v3.6a8 8 0 001.6 4.8M17.4 16.6a9 9 0 01-.6 2.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };
  LK.ICON = ICON;

  let node = null, layer = null, user = 'n', mode = 'normal', opts = {}, offs = [], unlocking = false, opened = false;
  let pinView = null, pendingNotif = null, sheets = [], lockoutTimer = 0, pauseOpen = false, lastHM = '', swallowClick = false;

  /* ---------------- init ---------------- */
  let inited = false;
  LK.init = function () {
    if (inited) return; inited = true;
    document.addEventListener('keydown', (e) => {
      if (!LK.isShown() || unlocking || opened || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!topLevel()) return;
      if (pinView) return;                                      // the pad handles its own keys
      if (e.key === 'ArrowUp' || e.key === 'Enter') { e.preventDefault(); openGesture(); }
    });
    G.bus && G.bus.on('pause', (p) => { pauseOpen = !!(p && p.open); });
  };
  function topLevel() {
    const P = G.phone;
    if (!P || !P.isLocked || !P.isLocked()) return false;
    const lyr = P.lockLayer && P.lockLayer();
    if (lyr && lyr.classList.contains('sh2-under')) return false;
    if (P.modalOpen && P.modalOpen()) return false;
    if (pauseOpen) return false;
    if (G.notebook && G.notebook.isOpen && safe(() => G.notebook.isOpen(), false)) return false;
    if (G.ui && G.ui.keyboardOpen && safe(() => G.ui.keyboardOpen(), false)) return false;
    const scr = document.getElementById('screen');
    if (scr && scr.classList.contains('eye-mode')) return false;
    return true;
  }
  LK.isShown = function () { return !!node && !!(G.phone && G.phone.isLocked && G.phone.isLocked()); };

  function trustState() { return G.security && G.security.trustState ? safe(() => G.security.trustState(), null) : (G.phone && G.phone.wifi && G.phone.wifi.connected() ? 'network' : null); }

  /* ---------------- show ---------------- */
  LK.show = function (u, o) {
    o = o || {};
    user = u === 'dash' ? 'dash' : 'n';
    mode = o.mode === 'hook' ? 'hook' : 'normal';
    opts = o;
    const cur = G.users && G.users.current ? G.users.current() : 'n';
    if (cur !== user && G.vars) G.vars('user', user);
    cleanup();
    unlocking = false; opened = false; pendingNotif = null;
    layer = G.phone.lockLayer();
    layer.innerHTML = '';
    G.phone.setLocked(true);
    G.phone.statusTheme && G.phone.statusTheme('light');
    node = user === 'dash' ? buildDash() : buildN();
    layer.appendChild(node);
    requestAnimationFrame(() => node && node.classList.add('in'));
    const refresh = () => { if (!node) return; drawClock(); drawTrust(); };
    offs.push(
      G.bus.on('tick', () => { if (hm() !== lastHM) drawClock(); }),
      G.bus.on('clock:min', refresh), G.bus.on('clock:jump', refresh),
      G.bus.on('wifi:change', refresh), G.bus.on('bt:change', refresh), G.bus.on('flag', refresh), G.bus.on('flag:off', refresh),
      G.bus.on('var', (e) => { if (e && e.k === 'smartGone') refresh(); }),
      G.bus.on('lock:refresh', () => drawNotifs()));
    G.bus.emit('lock:show', { user, mode });
  };

  function wallStyle(n, key) {
    const src = img(key);
    n.classList.add('wall-' + key);
    if (!src) { n.classList.add('wall-missing'); return; }
    n.style.backgroundImage = `url("${src}")`;
    const im = new Image(); im.onerror = () => { n.style.backgroundImage = ''; n.classList.add('wall-missing'); }; im.src = src;
  }

  function buildN() {
    const U = (G.STORY.users && G.STORY.users.n) || {};
    const n = el('div.sh2-lock.n' + (mode === 'hook' ? '.hook' : ''), { 'data-qa': 'lock.surface' });
    wallStyle(n, U.lock || 'n_wall');
    const timeEl = el('div.lk-time'), dateEl = el('div.lk-date');
    const trust = el('div.lk-trust');
    const widget = el('div.lk-widget', null, T(U.widget || ''));
    const list = el('div.lk-notifs');
    const em = el('button.lk-btn.lk-em', { 'data-qa': 'lock.emergency' }, TXT.emergency);
    em.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); emergency(); });
    const cam = el('button.lk-round.lk-cam', { 'aria-label': TXT.camera, 'data-qa': 'lock.camera', html: ICON.cam });
    cam.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); camera(); });
    const finger = fingerButton('lock.finger', () => fingerDone());
    finger.classList.add('lk-finger');
    n.append(el('div.lk-top', null, timeEl, dateEl, trust, widget), list, el('div.lk-bottom', null, em, finger, cam));
    n._time = timeEl; n._date = dateEl; n._trust = trust; n._list = list;
    node = n;
    drawClock(); drawTrust(); drawNotifs();
    bindSurface(n);
    return n;
  }
  function buildDash() {
    const U = (G.STORY.users && G.STORY.users.dash) || {};
    const n = el('div.sh2-lock.dash', { 'data-qa': 'dashlock.surface' });
    wallStyle(n, U.lock || 'old_room_lock');
    const timeEl = el('div.lk-time'), dateEl = el('div.lk-date');
    n.append(el('div.lk-top', null, timeEl, dateEl));
    n._time = timeEl; n._date = dateEl;
    node = n;
    drawClock();
    bindSurface(n);
    return n;
  }
  function drawClock() {
    if (!node || !node._time) return;
    lastHM = hm();
    node._time.textContent = lastHM;
    node._date.textContent = kDate(now());
  }
  function drawTrust() {
    if (!node || !node._trust) return;
    const t = trustState();
    node._trust.textContent = t === 'network' ? TXT.trustNet : t === 'device' ? TXT.trustDev : '';
    node._trust.style.display = t ? '' : 'none';
  }
  function drawNotifs() {
    if (!node || !node._list || !G.phone.notifGroups) return;
    const list = node._list;
    list.innerHTML = '';
    let groups = G.phone.notifGroups('n');
    if (mode === 'hook') groups = groups.filter((g) => g.head.id === 'N17').map((g) => ({ head: g.head, items: [g.head] }));
    groups.slice(0, 5).reverse().forEach((g) => {   // the newest five, listed oldest first as in the §3.2 lock layout
      const n = g.head;
      const a = (G.apps && G.apps[n.app]) || {};
      const ic = a.icon || (G.ICONS && G.ICONS[n.app]) || { bg: '#444', svg: '' };
      const appName = T(a.name || '');
      const top = n.title ? `${appName} · ${T(n.title)}` : appName;
      const body = g.items.length > 1 ? `메시지 ${g.items.length}개` : T(n.body);
      const row = el('button.lk-n', { 'data-qa': 'lock.notif:' + n.id },
        el('span.ln-icon', { style: { background: ic.bg }, html: ic.svg || '' }),
        el('span.ln-main', null, el('span.ln-top', null, el('b', null, top), el('small', null, n.when || '')), el('span.ln-body', null, body)));
      row.addEventListener('click', (e) => { e.stopPropagation(); if (swallowClick) { swallowClick = false; return; } sfx('tap'); LK._tapNotif(n, g.items); });
      list.appendChild(row);
    });
  }

  /* ---------------- gestures ---------------- */
  function bindSurface(n) {
    let sy = null, sx = 0, t0 = 0, lp = 0, moved = false, pid = null;
    // swipes may start anywhere (notification rows included — §9.5-4); only the bottom shortcuts / pad / finger are excluded
    const skip = (t) => !!(t && t.closest && t.closest('.lk-bottom, .lk-pin, .lk-finger, [role="slider"]'));
    n.addEventListener('pointerdown', (e) => {
      if (unlocking || opened || skip(e.target) || pinView) return;
      sy = e.clientY; sx = e.clientX; t0 = Date.now(); moved = false; pid = e.pointerId;
      clearTimeout(lp);
      if (user === 'n') lp = setTimeout(() => { if (sy != null && !moved) { sy = null; widgetPreview(); } }, 650);
    });
    n.addEventListener('pointermove', (e) => {
      if (sy == null || e.pointerId !== pid) return;
      const dy = sy - e.clientY, dx = Math.abs(e.clientX - sx);
      if (Math.abs(dy) > 10 || dx > 10) { moved = true; clearTimeout(lp); }
      if (dy > 0) { const top = n.querySelector('.lk-top'); if (top) top.style.transform = `translateY(${-Math.min(60, dy * 0.35)}px)`; n.style.setProperty('--lk-fade', String(Math.max(0.4, 1 - dy / 300))); }
    });
    const end = (e) => {
      clearTimeout(lp);
      if (sy == null) return;
      const dy = sy - (e.clientY == null ? sy : e.clientY);
      sy = null;
      const top = n.querySelector('.lk-top'); if (top) top.style.transform = '';
      n.style.removeProperty('--lk-fade');
      if (dy >= 80) { if (e.target && e.target.closest && e.target.closest('.lk-n')) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 400); } openGesture(); }
      void t0;
    };
    n.addEventListener('pointerup', end);
    n.addEventListener('pointercancel', () => { clearTimeout(lp); sy = null; const top = n.querySelector('.lk-top'); if (top) top.style.transform = ''; });
    n.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function openGesture() {
    if (unlocking || opened || !node) return;
    if (user === 'dash') { openDashPin(); return; }
    if (trustState()) {
      if (mode === 'hook') { hookOpen(pendingNotif || null); return; }
      unlock('swipe');
      return;
    }
    openPin();
  }

  /* ---------------- finger (always-on icon, 0.8 s ring — §5.3 · §9.5-3) ---------------- */
  function fingerButton(qaName, onDone) {
    if (G.ui && G.ui.holdButton) {
      const b = G.ui.holdButton({ ms: 800, size: 64, ring: true, qa: qaName, label: '', onDone });
      if (b && !b.querySelector('svg')) { const ic = el('span.lk-fp-ic', { html: ICON.finger }); b.appendChild(ic); }
      return b;
    }
    // local fallback (core widgets missing): same 0.8 s pointer hold, Space when focused
    const b = el('button.sh2-hold', { 'data-qa': qaName, 'aria-label': '지문', html: ICON.finger + '<svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" pathLength="100"/></svg>' });
    let t = null, x0 = 0, y0 = 0;
    const cancel = () => { clearTimeout(t); t = null; b.classList.remove('hold'); };
    const start = (e) => { if (e) { e.stopPropagation(); x0 = e.clientX; y0 = e.clientY; } b.classList.add('hold'); clearTimeout(t); t = setTimeout(() => { t = null; b.classList.remove('hold'); vib('fp'); onDone(); }, 800); };
    b.style.touchAction = 'none';
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, cancel));
    b.addEventListener('keydown', (e) => { if (e.key === ' ' && !t) { e.preventDefault(); start(null); } });
    b.addEventListener('keyup', (e) => { if (e.key === ' ') cancel(); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', (e) => e.stopPropagation());
    return b;
  }
  LK.fingerButton = fingerButton;
  function fingerDone() {
    if (unlocking || opened) return;
    setFlag('fingerIconTouched');
    cue('fp.ok');
    G.bus.emit('security:finger', { ok: true, where: 'lock' });
    const n = pendingNotif; pendingNotif = null;
    if (mode === 'hook') { hookOpen(n || null); return; }
    if (n) { unlock('notif', n); return; }
    unlock('finger');
  }

  /* ---------------- notification taps ---------------- */
  LK._tapNotif = function (n) {
    if (!n || !LK.isShown() || unlocking || opened) return;
    if (user === 'dash') return;
    if (mode === 'hook' && n.id !== 'N17') return;
    if (trustState()) { if (mode === 'hook') hookOpen(n); else unlock('notif', n); return; }
    pendingNotif = n;
    openPin();
  };
  function hookOpen(n) {
    if (opened) return;
    opened = true;
    closePin();
    if (n) { n.read = true; save(); }
    const fn = opts && opts.onOpen;
    if (fn) safe(() => fn(n || null));
  }

  /* ---------------- {N} PIN entry (any code wrong — the game never decides {N}'s PIN) ---------------- */
  function startCountdown(padNode, base, rest) {
    clearInterval(lockoutTimer);
    const tick = () => {
      const s = base ? base() : 0;
      if (s <= 0) { clearInterval(lockoutTimer); padNode.setBusy && padNode.setBusy(false); padNode.setMsg && padNode.setMsg(rest || ''); return; }
      padNode.setBusy && padNode.setBusy(true);
      padNode.setMsg && padNode.setMsg(STR('pinLock').replace('{s}', String(s)));
    };
    tick();
    lockoutTimer = setInterval(tick, 1000);
  }
  /** wall-clock lockout seconds (UI only — the 30 s is real time like a real phone, §4.0) */
  function makeLock(key) {
    return {
      left() { const u = SH()[key] || 0; return Math.max(0, Math.ceil((u - Date.now()) / 1000)); },
      start() { SH()[key] = Date.now() + 30000; save(); },
    };
  }
  const nLock = makeLock('nPinUntil'), dLock = makeLock('dashPinUntil');
  function openPin() {
    if (pinView || !node) return;
    sfx('whoosh');
    const fails = () => SH().nPinFails || 0;
    const padNode = G.ui.pinPad({
      dots: true, maxLength: 16, submitLabel: TXT.ok, title: TXT.pinTitle, sub: '', theme: 'dark', qa: 'lock.pin',
      async onSubmit() {
        if (nLock.left() > 0) return STR('pinLock').replace('{s}', String(nLock.left()));
        SH().nPinFails = fails() + 1; save();
        cue('pin.error'); vib('pin');
        if (SH().nPinFails % 5 === 0) { nLock.start(); setTimeout(() => startCountdown(padNode, () => nLock.left()), 30); return STR('pinLock').replace('{s}', '30'); }
        return STR('pinWrong');
      },
    });
    const foot = el('div.lk-pin-foot', null,
      el('button', { 'data-qa': 'lock.emergency', onclick: (e) => { e.stopPropagation(); sfx('tap'); emergency(); } }, TXT.emergency),
      el('button', { onclick: (e) => { e.stopPropagation(); sfx('tap'); closePin(); } }, TXT.cancel));
    // the surface's 긴급 통화 is hidden under the pad — only one lock.emergency stays visible
    const em = node.querySelector('.lk-bottom .lk-em'); if (em) em.removeAttribute('data-qa');
    pinView = el('div.lk-pin', null, padNode, foot);
    node.appendChild(pinView);
    node.classList.add('pin-open');
    requestAnimationFrame(() => pinView && pinView.classList.add('in'));
    if (nLock.left() > 0) startCountdown(padNode, () => nLock.left());
    G.bus.emit('lock:pin', { user });
  }
  function closePin() {
    clearInterval(lockoutTimer);
    if (!pinView) return;
    const v = pinView; pinView = null;
    if (node) { node.classList.remove('pin-open'); const em = node.querySelector('.lk-bottom .lk-em'); if (em) em.setAttribute('data-qa', 'lock.emergency'); }
    v.classList.remove('in'); setTimeout(() => v.remove(), 220);
    pendingNotif = null;
  }

  /* ---------------- '—' PIN pad (no dots · [확인] · exactly '0310' — §3.9 · §9.5-2) ---------------- */
  function openDashPin() {
    if (pinView || !node) return;
    sfx('whoosh');
    setFlag('pinPadOpened');
    const padNode = G.ui.pinPad({
      dots: false, maxLength: 16, submitLabel: TXT.ok, title: TXT.dash, sub: TXT.pinTitle, theme: 'dark',
      async onSubmit(code) {
        if (dLock.left() > 0) return STR('pinLock').replace('{s}', String(dLock.left()));
        const ok = G.users && G.users.unlockDash ? G.users.unlockDash(code) : code === '0310';
        if (ok) { setTimeout(() => unlock('pin'), 60); return true; }
        cue('pin.error'); vib('pin');
        const f = G.users && G.users.dashFails ? G.users.dashFails() : 1;
        if (f % 5 === 0) { dLock.start(); setTimeout(() => startCountdown(padNode, () => dLock.left(), TXT.pinTitle), 30); return STR('pinLock').replace('{s}', '30'); }
        return STR('pinWrong');
      },
    });
    // the pad keeps its own sub line (`PIN 입력`) — wrong answers replace it, so restore it after the message
    const foot = el('div.lk-pin-foot.dash', null, el('button', { onclick: (e) => { e.stopPropagation(); sfx('tap'); closePin(); } }, TXT.cancel));
    pinView = el('div.lk-pin.dash', null, padNode, foot);
    node.appendChild(pinView);
    node.classList.add('pin-open');
    requestAnimationFrame(() => pinView && pinView.classList.add('in'));
    if (dLock.left() > 0) startCountdown(padNode, () => dLock.left(), TXT.pinTitle);
    G.bus.emit('lock:pin', { user });
  }

  /* ---------------- unlock / hide ---------------- */
  async function unlock(how, notif) {
    if (unlocking || !node) return;
    unlocking = true;
    clearInterval(lockoutTimer);
    const u = user;
    const first = u === 'n' && flag('gotPhone') && !flag('M1');
    if (how === 'pin' || how === 'finger' || how === 'notif') { if (how === 'pin') sfx('unlock'); }
    node.classList.add('leaving');
    await sleep(380);
    cleanup();
    if (first) { G.flag('M1', true); if (G.director && G.director.mark) safe(() => G.director.mark('B03')); }
    G.phone.setLocked(false);
    if (layer) layer.innerHTML = '';
    node = null;
    unlocking = false;
    const top = G.phone.top && G.phone.top();
    G.phone.statusTheme && G.phone.statusTheme(top && top.node && top.node.dataset.status ? top.node.dataset.status : 'light');
    G.bus.emit('lock:unlock', { user: u, how, first });
    if (notif) {
      notif.read = true; save(); G.bus.emit('lock:refresh');
      if (notif.route) G.phone.route(notif.route);
    }
  }
  LK.hide = function () {
    cleanup();
    if (layer) layer.innerHTML = '';
    node = null; unlocking = false; opened = false;
    if (G.phone && G.phone.isLocked && G.phone.isLocked()) G.phone.setLocked(false);
  };
  function cleanup() {
    offs.forEach((f) => { try { f && f(); } catch (e) {} }); offs = [];
    clearInterval(lockoutTimer);
    LK._closeSheets();
    pinView = null;
  }

  /* ---------------- back / sheets ---------------- */
  LK._back = function () {
    if (sheets.length) { LK._closeSheets(); return true; }
    if (pinView) { closePin(); return true; }
    return false;
  };
  LK._canBack = function () { return !!(pinView || sheets.length); };
  LK._closeSheets = function () { sheets.slice().forEach((f) => safe(() => f())); sheets = []; };

  /* ---------------- shortcuts ---------------- */
  function emergency() {
    if (G.hooks && G.hooks.has && G.hooks.has('phone:emergency')) { G.hooks.call('phone:emergency'); return; }
    if (G.phoneApp && G.phoneApp.emergency) safe(() => G.phoneApp.emergency());
  }
  function camera() {
    if (user !== 'n') return;
    if (G.room && G.room.open) safe(() => G.room.open({ mode: 'camera', fromLock: true }));
  }
  /* long-press on the lock surface → widget preview (read-only, edit grey — §4.6.4 · §5.4 S1 · §0.2 E6) */
  function widgetPreview() {
    if (!G.phone.sheet || user !== 'n') return;
    const U = (G.STORY.users && G.STORY.users.n) || {};
    const body = el('div.sh2-widget-prev', null,
      el('div.wp-card', null, T(U.widget || '')),
      el('button.wp-edit', { disabled: true, tabindex: -1 }, TXT.widgetEdit));
    G.phone.sheet({ title: TXT.widgetTitle, body, kind: 'sheet', qa: 'lock.widget' });
  }
  LK.widgetPreview = widgetPreview;
})();
