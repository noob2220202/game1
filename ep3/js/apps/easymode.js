/* =========================================================
 * ep3/js/apps/easymode.js — new module ① `easymode` (shell · ARCH_EP3 §5.8 · DESIGN_EP3 §5.4 E1–E10 · §9.6 ① · §3.3 · §4.2 ·
 * §4.3.1 · §4.4.4 · §4.7.2 · §4.1.3 E9 · §5.7). Class prefix ez3-. Data: G.STORY.easy (data/easy.js). CSS: css/easy.css.
 *
 * Public API — G.easy
 *   init()                         settings screens · text scale · DEBUG haru.easy (idempotent)
 *   on() → bool                    vars.easy (default true)
 *   set(on, { silent }) → Promise  E8 unfold / fold 0.9 s (silent = instant) · no confirm · first false ⇒ flag easyOff (+ director
 *                                  mark 'B08' · cue 'ez.unfold') · unfold goes to the home so the phone is seen opening · fold
 *                                  closes the stack only when a screen hidden in easy mode is open (+ G.callrec.stop())
 *   homeSpec() → spec · renderHome(node, api)     the G.EP.HOME getter's EASY.render (E2 쉬운 홈)
 *   lockSkin(node) → { time, date }               E1 (engine/apps/lock.js binds the gestures / buttons)
 *   phone({ tab:'pad'|'recent'|'contacts' })      E3 · contact detail E4 — every call = G.phoneApp.dial(…, {from:'easy', big:true})
 *   sms(contactId)                                E5 — one big conversation via G.sms.renderThread(node, id, {big:true})
 *   gate(kind:'rec'|'spam')                       E6 → settings key easy.gate.<kind> (flag easyGate, bus easy:gate)
 *   ringScreen(node, { from, kind, phase:'ring'|'call'|'ended', sec })   E9 into room's screen node — updates in place
 *   scale() → number                              current phone text factor (1.3 easy × 글자 크기 step)
 * Settings keys registered (G.settingsApp.register): display · display.font · display.zoom · display.easy · easy.gate.rec ·
 *   easy.gate.spam (data-scr settings.display* · easy.gate.*).
 * Bus emitted: easy:change {on, first} · easy:gate {kind} · app:open 'phone' (easy phone). Hooks called: none.
 * Flags set: easyOff (first switch-off) · easyGate (first gate drawn). Vars: easy · sh.fontStep · sh.fontBold · sh.lpDelay ·
 *   sh.zoom · sh.gate (fallback when G.callrec is absent).
 * Calls (guarded): G.phone.* (shell) · G.phoneApp.dial / recents / contacts (comms) · G.sms.renderThread (comms) ·
 *   G.callrec.setting / state / stop (comms) · G.settingsApp (shell) · G.ui.inputSource (core) · G.audio.cue / sfx (audio) ·
 *   G.director.mark (flow) · G.e3.img / fmtDate / fmt12 / less (core).
 * data-qa: easy.home · easy.tile:<appId> · easy.clock · easy.date · easy.toggle · easy.phone.tab:pad|recent|contacts ·
 *   easy.key:<d> · easy.del · easy.call · easy.contact:<id> · easy.sms · easy.recent.row:<i> · easy.sheet.call · easy.sheet.sms ·
 *   easy.gate:rec|spam · easy.gate.switch · easy.ring · settings.slider:font · settings.row:<key> · lock.time · lock.emergency ·
 *   lock.camera
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UTIL = G.util || {};
  const el = UTIL.el || function (tag) { return document.createElement(String(tag).split(/[.#]/)[0] || 'div'); };
  const pad = UTIL.pad || ((n) => String(n).padStart(2, '0'));
  const sleep = UTIL.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { console.error('[easy] lazy', e); s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[easy]', e); return d; } };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const cue = (id, o) => { try { return G.audio && G.audio.cue ? G.audio.cue(id, o) : undefined; } catch (e) { return undefined; } };
  const vget = (k, d) => { const v = G.state && G.state.vars ? G.state.vars[k] : undefined; return v === undefined ? d : v; };
  const vset = (k, v) => { if (G.vars) G.vars(k, v); else if (G.state && G.state.vars) G.state.vars[k] = v; };
  const SH = () => { const v = (G.state && G.state.vars) || {}; if (!v.sh || typeof v.sh !== 'object') v.sh = {}; return v.sh; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const D = () => (G.STORY && G.STORY.easy) || {};
  const PH = () => G.phone || {};
  const img = (k) => { try { if (G.e3 && G.e3.img) return G.e3.img(k) || ''; if (G.e2 && G.e2.img) return G.e2.img(k) || ''; } catch (e) {} return (G.IMG && G.IMG[k]) || ''; };
  const reduced = () => { try { return !!((G.settings && G.settings.reduceShake) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)); } catch (e) { return false; } };
  const less = () => !!(G.e3 && G.e3.less && safe(() => G.e3.less(), false));
  const shortHm = () => { if (G.phone && G.phone.shortHm) return G.phone.shortHm(); const s = G.clock && G.clock.hm ? G.clock.hm() : '03:35'; const m = /^(\d{1,2}):(\d{2})/.exec(s); return m ? ((+m[1] % 12 || 12) + ':' + m[2]) : s; };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const kDate = () => { const d = G.clock && G.clock.now ? G.clock.now() : new Date(2027, 0, 24); return UTIL.fmtKDate ? UTIL.fmtKDate(d) : `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`; };
  const fmt12 = (h) => { if (G.e3 && G.e3.fmt12) return safe(() => G.e3.fmt12(h), String(h || '')); const m = /^(\d{1,2}):(\d{2})/.exec(String(h || '')); if (!m) return String(h || ''); const H = +m[1]; return `${H < 12 ? '오전' : '오후'} ${H % 12 || 12}:${m[2]}`; };
  const fmtDate = (d) => (G.e3 && G.e3.fmtDate ? safe(() => G.e3.fmtDate(d), String(d || '')) : String(d || ''));

  /* glyphs (engine-style SVG — no emoji glyphs on screen, §5.0-5) */
  const SV = {
    call: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
    msg: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3.5c5 0 9 3.3 9 7.4s-4 7.4-9 7.4c-.9 0-1.8-.1-2.6-.3L5 20l1-3.6C4.2 15 3 13.1 3 10.9 3 6.8 7 3.5 12 3.5z"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    end: '<svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3c-2-.7-5-.7-7 0v3l-3 1.5z" fill="currentColor"/></svg>',
    spk: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>',
  };
  const iconFor = (id) => {
    const I = G.ICONS || {};
    const k = 'easy' + id.charAt(0).toUpperCase() + id.slice(1);
    return I[k] || (G.apps && G.apps[id] && G.apps[id].icon) || I[id] || { bg: '#8a8a90', svg: '' };
  };

  const E = (G.easy = G.easy || {});
  E.on = function () { return vget('easy', true) !== false; };

  /* =========================================================
   * E10 — phone text scale (easy ×1.3 · 설정 › 글자 크기와 스타일 step) — phone layers only (G.phone.textScale)
   * ========================================================= */
  const FONT_F = [0.82, 0.88, 0.93, 0.96, 0.98, 1, 1.1, 1.2];              // 8 steps · 'now 6' = 1 (§4.7.2)
  const fontStep = () => { const n = +SH().fontStep; const F = (D().display && D().display.font) || {}; return n >= 1 && n <= 8 ? n : (F.now || 6); };
  E.scale = function () { return (E.on() ? 1.3 : 1) * (FONT_F[fontStep() - 1] || 1); };
  function applyScale() {
    const scr = document.getElementById('screen');
    if (scr) {
      scr.classList.toggle('ez3-on', E.on()); scr.classList.toggle('ez3-bold', !!SH().fontBold);
      scr.style.setProperty('--ez-base', String(Number(G.settings && G.settings.textSize) || 1));   // easy home: 28 px × the 90–130 % size (§9.5-5)
    }
    if (PH().textScale) safe(() => PH().textScale(E.scale()));
  }
  E._applyScale = applyScale;

  /* =========================================================
   * E2 — 쉬운 홈 (§3.3 · §4.2.2 · §5.1): big clock (date line → 캘린더) + 6 tiles, cream, one page (sideways = bounce)
   * ========================================================= */
  E.homeSpec = function () { return (G.EP && G.EP.HOME && G.EP.HOME.n) || null; };
  E.renderHome = function (node, api) {
    if (!node) return null;
    api = api || {};
    node.classList.add('ez3-home');
    node.setAttribute('data-qa', 'easy.home');
    node.dataset.scr = 'easy.home';
    if (api.setWallpaper) api.setWallpaper('', 'easy');
    const time = el('div.ez3-time', { dataset: { live: 'time' } }, api.hm ? api.hm() : shortHm());
    const date = el('button.ez3-date', { 'data-qa': 'easy.date', dataset: { live: 'date' } }, api.date ? api.date() : kDate());
    date.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); open('calendar', api); });
    const clock = el('div.ez3-clock', { 'data-qa': 'easy.clock' }, time, date);
    const grid = el('div.ez3-grid');
    (D().home || []).forEach(([id, label]) => {
      const ic = iconFor(id);
      const a = G.apps && G.apps[id];
      const badge = a && a.badge ? safe(() => +a.badge('n') || 0, 0) : 0;
      const t = el('button.ez3-tile', { 'data-qa': 'easy.tile:' + id, 'aria-label': T(label), dataset: { app: id } },
        el('span.ez3-ti', { style: { background: ic.bg }, html: ic.svg || '' }), el('span.ez3-tl', null, T(label)),
        badge ? el('span.ez3-badge', null, badge > 99 ? '99+' : String(badge)) : null);
      t.addEventListener('click', () => { sfx('tap'); if (id === 'phone') E.phone({ tab: 'pad' }); else open(id, api); });
      grid.appendChild(t);
    });
    node.append(clock, grid);
    bounce(node);
    return node;                                                          // (phone.js sets the dark status text when the home is on top)
  };
  function open(id, api) {
    if (api && api.openApp) { api.openApp(id); return; }
    if (PH().openApp) PH().openApp(id);
  }
  /* one page only: a sideways drag nudges the home and springs back (§3.3 '옆으로 밀기 = 살짝 튕기고 제자리') */
  function bounce(node) {
    if (node._ez3b) return; node._ez3b = true;
    let sx = null, sy = 0, on = false;
    node.addEventListener('pointerdown', (e) => { if (!node.classList.contains('ez3-home')) return; sx = e.clientX; sy = e.clientY; on = false; });
    node.addEventListener('pointermove', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!on && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) on = true;
      if (on) { const v = Math.max(-26, Math.min(26, dx * 0.22)); node.style.transition = 'none'; node.style.transform = `translateX(${v}px)`; }
    });
    const end = () => { if (sx == null) return; sx = null; if (!on) return; on = false; node.style.transition = 'transform .32s cubic-bezier(.2,1.4,.4,1)'; node.style.transform = ''; setTimeout(() => { node.style.transition = ''; }, 360); };
    node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end); node.addEventListener('pointerleave', end);
  }

  /* =========================================================
   * E1 — 쉬운 잠금화면 (§3.1 · §4.2.1 · §5.3) — drawn into lock.js's surface node
   * ========================================================= */
  E.lockSkin = function (node) {
    if (!node) return null;
    const L = D().lock || {};
    const time = el('div.ez3-lk-time.lk-time', { 'data-qa': 'lock.time' }, shortHm());
    const date = el('div.ez3-lk-date.lk-date', null, T(L.date || kDate()));
    const swipe = el('div.ez3-lk-swipe', null, T(L.swipe || '{$swipeOpen}'));
    const em = el('button.ez3-lk-em', { 'data-qa': 'lock.emergency' }, T(L.emergency || '{$emergency}'));
    const cam = el('button.lk-round.ez3-lk-cam', { 'aria-label': '카메라', 'data-qa': 'lock.camera', html: SV.cam });
    node.append(el('div.ez3-lk-top.lk-top', null, time, date), swipe, el('div.lk-bottom.ez3-lk-bottom', null, em, cam));
    return { time, date };
  };

  /* =========================================================
   * E8 — 펼침 / 접힘 0.9 s (§3.3 · §5.2 · §5.4 E8 · §9.8 reduced = 0.2 s fade)
   * ========================================================= */
  const HIDDEN_APPS = /^(sms|mail|browser|memo|voicerec|files|weather|clock)$/;
  function hiddenInEasy(e) {
    if (!e) return false;
    const scr = (e.node && e.node.dataset && e.node.dataset.scr) || e.scr || '';
    if (/^easy\./.test(scr)) return false;
    if (HIDDEN_APPS.test(e.appId || '')) return true;
    if (/^(callrec\.|sms\.|phone\.)/.test(scr)) return true;
    if (e.appId === 'phone') return true;                               // the standard phone (its ⋮ · all-time recents · logs)
    return false;
  }
  const SIX = () => (D().home || []).map((r) => r[0]);
  const rootRect = () => { const r = document.getElementById('screen'); return r ? r.getBoundingClientRect() : { left: 0, top: 0 }; };
  function rectOf(n) { const r = n.getBoundingClientRect(); const o = rootRect(); return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }; }
  function ghost(n, layer) {
    const r = rectOf(n);
    const c = n.cloneNode(true);
    c.removeAttribute('data-qa'); c.querySelectorAll('[data-qa]').forEach((x) => x.removeAttribute('data-qa'));
    Object.assign(c.style, { position: 'absolute', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', margin: '0', transition: 'none' });
    layer.appendChild(c);
    return c;
  }
  const anim = (n, kf, o) => { try { return n && n.animate ? n.animate(kf, Object.assign({ fill: 'both' }, o)) : null; } catch (e) { return null; } };
  function morphLayer(cls) {
    const scr = document.getElementById('screen');
    if (!scr) return null;
    const l = el('div.ez3-morph' + (cls ? '.' + cls : ''), { 'aria-hidden': 'true' });
    const h = document.getElementById('home');
    const ts = h ? (h.style.getPropertyValue('--ts') || '').trim() : '';
    if (ts) l.style.setProperty('--ts', ts);                              // ghosts keep the outgoing home's text size
    scr.appendChild(l);
    return l;
  }
  let busy = null;
  E.set = function (on, o) {
    o = o || {};
    on = !!on;
    if (busy) return busy.then(() => E.set(on, o));
    if (on === E.on()) { applyScale(); return Promise.resolve(); }
    busy = transition(on, o).catch((e) => console.error('[easy] set', e)).then(() => { busy = null; });
    return busy;
  };
  async function transition(on, o) {
    const first = !on && !flag('easyOff');
    const P = PH();
    const homeEl = document.getElementById('home');
    const animate = !o.silent && !!homeEl && !!(homeEl.animate);
    const rm = reduced();
    if (!o.silent) { sfx('tap'); cue(on ? 'ez.fold' : 'ez.unfold'); }
    if (P.closeFolder) safe(() => P.closeFolder());
    if (!on) {
      // unfold: the phone opens in front of the player (B08) — leave the settings screen for the home
      if (P.stackDepth && P.stackDepth() > 0 && !o.silent) { safe(() => P.home()); await sleep(rm ? 120 : 260); }
    } else {
      // fold: screens hidden in easy mode leave (stack cleared → easy home); a running recording stops (callrec: reason 'fold')
      const entries = P.stackEntries ? P.stackEntries() : [];
      if (entries.some(hiddenInEasy)) { safe(() => P.closeAll(true)); }
      if (G.callrec && G.callrec.stop) safe(() => { const s = G.callrec.state ? G.callrec.state() : null; if (!s || s.playing || s.id) G.callrec.stop('fold'); });
    }
    const homeVisible = !!homeEl && !(P.stackDepth && P.stackDepth() > 0) && !(P.isLocked && P.isLocked());
    const doAnim = animate && homeVisible;
    // FIRST: rects of the six apps on the outgoing home + ghosts of the rest
    const before = {};
    let top = null, under = null;
    if (doAnim) {
      top = morphLayer(); under = morphLayer('under');
      SIX().forEach((id) => {
        const n = homeEl.querySelector(on ? '.app-icon[data-app="' + id + '"]' : '.ez3-tile[data-app="' + id + '"]');
        if (n) before[id] = { r: rectOf(n), g: ghost(n, top) };
      });
      Array.from(homeEl.querySelectorAll(on ? '.home-widget, .app-icon, .dock' : '.ez3-clock')).forEach((n) => {
        if (on && n.classList.contains('app-icon') && SIX().indexOf(n.dataset.app) >= 0 && !n.closest('.sh3-fgrid')) return;
        const g = ghost(n, top);
        if (on && n.classList.contains('dock')) g.querySelectorAll('.app-icon').forEach((x) => { if (SIX().indexOf(x.dataset.app) >= 0) x.style.visibility = 'hidden'; });
        anim(g, [{ opacity: 1 }, { opacity: 0 }], { duration: rm ? 200 : 350, easing: 'ease-out' });
      });
      const wp = document.querySelector('#screen > .wallpaper');
      if (wp) { const w = wp.cloneNode(true); w.style.zIndex = '0'; under.appendChild(w); anim(w, [{ opacity: 1 }, { opacity: 0 }], { duration: rm ? 200 : 900, easing: 'ease-in-out' }); }
      if (P.holdHome) P.holdHome(1100);
    }
    // the switch itself
    vset('easy', on);
    if (first) {
      setFlag('easyOff');                                                    // core e3 → M2 (clock 03:40)
      if (G.director && G.director.mark) safe(() => G.director.mark('B08'));
    }
    applyScale();
    if (P.renderHome) safe(() => P.renderHome());
    if (P.statusTheme && homeVisible && P.homeStatus) safe(() => P.statusTheme(P.homeStatus()));
    G.bus && G.bus.emit('easy:change', { on, first });
    // LAST + PLAY
    if (doAnim) {
      const dur = rm ? 200 : 900;
      SIX().forEach((id) => {
        const n = homeEl.querySelector(on ? '.ez3-tile[data-app="' + id + '"]' : '.app-icon[data-app="' + id + '"]');
        const b = before[id];
        if (!n || !b) { if (n) anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: dur }); return; }
        const a = rectOf(n);
        const s = Math.max(0.05, Math.min(b.r.w / Math.max(1, a.w), b.r.h / Math.max(1, a.h)));
        const dx = (b.r.x + b.r.w / 2) - (a.x + a.w / 2), dy = (b.r.y + b.r.h / 2) - (a.y + a.h / 2);
        const sG = Math.max(0.05, Math.min(a.w / Math.max(1, b.r.w), a.h / Math.max(1, b.r.h)));
        if (rm) {
          anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: dur });
          anim(b.g, [{ opacity: 1 }, { opacity: 0 }], { duration: dur });
          return;
        }
        anim(n, [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: dur, easing: 'cubic-bezier(.45,0,.2,1)' });
        anim(b.g, [{ transform: 'none', opacity: 1 }, { transform: `translate(${-dx}px, ${-dy}px) scale(${sG})`, opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.45,0,.2,1)' });
      });
      // everything else of the incoming home fades in 0.35 s late (§5.4 E8)
      Array.from(homeEl.querySelectorAll(on ? '.ez3-clock' : '.home-widget, .app-icon, .dock')).forEach((n) => {
        if (!on && n.classList.contains('app-icon') && SIX().indexOf(n.dataset.app) >= 0) return;
        if (!on && n.classList.contains('dock')) { anim(n, [{ backgroundColor: 'rgba(255,255,255,0)' }, { backgroundColor: 'rgba(255,255,255,.16)' }], { duration: dur, delay: 0 }); return; }
        anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: rm ? 200 : 550, delay: rm ? 0 : 350, easing: 'ease-out' });
      });
      await sleep(dur + 80);
      if (top) top.remove(); if (under) under.remove();
      homeEl.querySelectorAll('*').forEach((n) => { try { (n.getAnimations ? n.getAnimations() : []).forEach((a) => a.cancel()); } catch (e) {} });
    }
  }

  /* =========================================================
   * E3 / E4 — 쉬운 전화 (§3.3 · §4.3.1 · §5.4) — no ⋮ · recents 30 days · contact cards → [전화] [문자]
   * ========================================================= */
  const dialData = () => (G.STORY && G.STORY.dial) || {};
  function contacts() {
    let list = null;
    if (G.phoneApp && G.phoneApp.contacts) list = safe(() => G.phoneApp.contacts(), null);
    if (!Array.isArray(list)) list = dialData().contacts || [];
    const byId = {}; list.forEach((c) => { if (c && c.id) byId[c.id] = c; });
    const order = D().contacts || list.map((c) => c.id);
    return order.map((id) => byId[id] || null).filter(Boolean);
  }
  const contactById = (id) => contacts().find((c) => c.id === id) || ((dialData().contacts || []).find((c) => c.id === id)) || null;
  const digitsOf = (s) => String(s || '').replace(/\D/g, '');
  function contactByNumber(num) { const d = digitsOf(num); if (!d) return null; return contacts().find((c) => c.number && digitsOf(c.number) === d) || null; }
  function recents(days) {
    let rows = null;
    if (G.phoneApp && G.phoneApp.recents) rows = safe(() => G.phoneApp.recents({ days }), null);
    if (Array.isArray(rows)) return rows;
    // partial build: the data rows inside the window, newest first (comms owns the real merge)
    const today = (G.STORY && G.STORY.events && G.STORY.events.today) || '2027-01-24';
    const t0 = Date.parse(today + 'T00:00:00') - days * 86400000;
    return (dialData().recents || []).filter((r) => Date.parse(r.d + 'T00:00:00') >= t0)
      .map((r) => Object.assign({ name: (contactById(r.who) || {}).name || r.number || '' }, r))
      .sort((a, b) => (b.d + b.hm).localeCompare(a.d + a.hm));
  }
  function durText(r) {
    const L = dialData().recentLabel || {};
    if (r.noAnswer) return T(L.noAnswer || '응답 없음');
    if (r.dir === 'missed') return '';
    const s = Math.max(0, Math.round(+r.sec || 0));
    if (r.sec == null) return '';
    return s < 60 ? `${s}초` : (s % 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${Math.floor(s / 60)}분`);
  }
  function dial(target) {
    if (!target) return Promise.resolve(null);
    if (G.phoneApp && typeof G.phoneApp.dial === 'function') return Promise.resolve(safe(() => G.phoneApp.dial(target, { from: 'easy', big: true }), null));
    if (PH().callScreen) {                                                   // partial build: the plain '그 밖' simulation (§3.2.3)
      const c = contactById(target) || contactByNumber(target);
      return PH().callScreen({ id: 'easy', name: c ? c.name : target, kind: 'cell', big: true, script: async (api) => { await api.wait(4000); await api.card('신호가 간다. 받지 않는다.'); } });
    }
    return Promise.resolve(null);
  }
  E._dial = dial;
  function avatarNode(c, cls) {
    const box = el('span.ez3-av' + (cls ? '.' + cls : ''));
    const src = c && c.id === 'sea' && c.avatar ? img(c.avatar) : '';           // E3: only 세아 💛 is a photo, the rest initial circles
    const initial = () => { box.innerHTML = ''; box.classList.add('ini'); box.textContent = Array.from(T((c && c.name) || ''))[0] || ''; };
    if (src) { const im = el('img', { src, alt: '' }); im.onerror = () => initial(); box.appendChild(im); } else initial();
    return box;
  }
  let phoneScr = null;
  E.phone = function (o) {
    o = o || {};
    const P = PH();
    if (!P.push || !G.ui || !G.ui.screen) return null;
    const PD = D().phone || {};
    if (phoneScr && phoneScr.isConnected && P.top && P.top() && P.top().node === phoneScr) { phoneScr._tab(o.tab || 'pad'); return phoneScr; }
    if (P.closeAll) P.closeAll(true);
    P.currentApp = 'phone';
    G.bus && G.bus.emit('app:open', 'phone');
    const tabsRow = el('div.ez3-tabs', { role: 'tablist' });
    const pane = el('div.ez3-pane');
    const body = el('div.ez3-pbody', null, tabsRow, pane);
    const scr = G.ui.screen({ title: PD.title || '전화', cls: 'ez3-scr ez3-phone', body, bodyCls: 'nopad' });
    scr.dataset.scr = 'easy.phone';
    phoneScr = scr;
    let cur = null, cleanup = [];
    const clean = () => { cleanup.forEach((f) => safe(() => f())); cleanup = []; };
    const tabs = PD.tabs || [['pad', '키패드'], ['recent', '최근 기록'], ['contacts', '연락처']];
    const btns = {};
    tabs.forEach(([k, label]) => {
      const b = el('button.ez3-tab', { 'data-qa': 'easy.phone.tab:' + k, role: 'tab' }, T(label));
      b.addEventListener('click', () => { sfx('tap'); show(k); });
      btns[k] = b; tabsRow.appendChild(b);
    });
    function show(k) {
      if (!btns[k]) k = 'pad';
      if (cur === k) return;
      cur = k; clean(); pane.innerHTML = '';
      Object.keys(btns).forEach((x) => { btns[x].classList.toggle('on', x === k); btns[x].setAttribute('aria-selected', String(x === k)); });
      scr.dataset.tab = k;
      if (k === 'pad') padPane(pane, scr, cleanup);
      else if (k === 'recent') recentPane(pane);
      else contactsPane(pane);
    }
    scr._tab = show;
    show(o.tab || 'pad');
    P.push(scr, { appId: 'phone', onClose: () => { clean(); if (phoneScr === scr) phoneScr = null; } });
    return scr;
  };
  /* 키패드 — big digits (key 72 px · number 40 px) · the matching contact's name above · [📞] · ⌫ · physical keys (§4.3.1 · §9.5-1) */
  function padPane(pane, scr, cleanup) {
    const PD = D().phone || {};
    const digits = [];
    const nameEl = el('div.ez3-pad-name');
    const numEl = el('div.ez3-pad-num', { 'aria-live': 'polite' });
    const fmt = (s) => { if (/^010\d{0,8}$/.test(s)) { return s.length > 7 ? `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}` : s.length > 3 ? `${s.slice(0, 3)}-${s.slice(3)}` : s; } return s; };
    const draw = () => { const s = digits.join(''); numEl.textContent = fmt(s); const c = contactByNumber(s); nameEl.textContent = c ? T(c.name) : ''; };
    const press = (k) => { if (digits.length >= 20) return; digits.push(k); sfx('key'); draw(); };
    const back = () => { if (!digits.length) return; digits.pop(); sfx('key'); draw(); };
    const call = () => { const s = digits.join(''); if (!s) return; sfx('tap'); digits.length = 0; draw(); dial(s); };
    const grid = el('div.ez3-keys');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].forEach((k) => {
      const b = el('button.ez3-key', { 'data-qa': 'easy.key:' + k, 'aria-label': k }, el('b', null, k));
      b.addEventListener('click', () => press(k));
      grid.appendChild(b);
    });
    const callB = el('button.ez3-callb', { 'data-qa': 'easy.call', 'aria-label': T(PD.call || '전화'), html: SV.call });
    callB.addEventListener('click', call);
    const delB = el('button.ez3-delb', { 'data-qa': 'easy.del', 'aria-label': '지우기', html: SV.del });
    delB.addEventListener('click', back);
    const padNode = el('div.ez3-pad', null, el('div.ez3-pad-disp', null, nameEl, numEl), grid, el('div.ez3-pad-row', null, el('span.ez3-sp'), callB, delB));
    pane.appendChild(padNode);
    draw();
    // S1 '키패드 숫자' (DESIGN §6.1.3 · ARCH §4.2 widgets)
    if (G.ui && G.ui.inputSource) { const off = safe(() => G.ui.inputSource(() => padNode.isConnected && !scr.classList.contains('covered') && digits.length > 0), null); if (typeof off === 'function') cleanup.push(off); }
    const onKey = (e) => {
      if (!padNode.isConnected || scr.classList.contains('covered') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen()) return;
      if (G.notebook && G.notebook.isOpen && safe(() => G.notebook.isOpen(), false)) return;
      if (PH().modalOpen && PH().modalOpen()) return;
      if (/^[0-9*#]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (e.key === 'Enter' && digits.length) { e.preventDefault(); call(); }
    };
    document.addEventListener('keydown', onKey);
    cleanup.push(() => document.removeEventListener('keydown', onKey));
  }
  /* 최근 기록 — the last 30 days, date groups, no footer text · row → [전화 걸기] [문자 보내기] (no call detail) */
  function recentPane(pane) {
    const rows = recents(D().recentDays || 30);
    const L = dialData().recentLabel || {};
    const list = el('div.ez3-recents');
    let lastD = null, i = 0;
    rows.forEach((r) => {
      if (r.d !== lastD) { lastD = r.d; list.appendChild(el('div.ez3-rhead', null, fmtDate(r.d))); }
      const dirL = T(L[r.dir] || '');
      const name = T(r.name || (contactById(r.who) || {}).name || r.number || '');
      const row = el('button.ez3-rrow' + (r.dir === 'missed' ? '.missed' : ''), { 'data-qa': 'easy.recent.row:' + i, dataset: r.row ? { row: r.row } : {} },
        el('span.ez3-rmain', null, el('b.ez3-rname', null, name), el('span.ez3-rsub', null, [dirL, durText(r)].filter(Boolean).join('  '))),
        el('span.ez3-rtime', null, fmt12(r.hm)),
        r.rec ? el('span.ez3-rrec', { 'aria-label': '녹음', html: SV.mic }) : null);
      row.addEventListener('click', () => { sfx('tap'); rowSheet(name, r.who || r.number || r.n || ''); });
      list.appendChild(row);
      i++;
    });
    pane.appendChild(list);
  }
  function rowSheet(name, target) {
    const S = D().sheet || ['전화 걸기', '문자 보내기'];
    const P = PH();
    if (!P.sheet) return;
    P.sheet({ title: name, kind: 'sheet', cls: 'ez3-sheet', qa: 'easy.sheet', mount: (fin, box) => {
      const c = el('button.ez3-sbtn.call', { 'data-qa': 'easy.sheet.call' }, el('span', { html: SV.call }), T(S[0]));
      const m = el('button.ez3-sbtn.sms', { 'data-qa': 'easy.sheet.sms' }, el('span', { html: SV.msg }), T(S[1]));
      c.addEventListener('click', () => { sfx('tap'); fin('call'); dial(target); });
      m.addEventListener('click', () => { sfx('tap'); fin('sms'); E.sms(target); });
      box.appendChild(el('div.ez3-sbtns', null, c, m));
    } });
  }
  /* 연락처 — big cards in the §3.3 order → E4 detail */
  function contactsPane(pane) {
    const grid = el('div.ez3-cards');
    contacts().forEach((c) => {
      const b = el('button.ez3-card', { 'data-qa': 'easy.contact:' + c.id, dataset: { contact: c.id } }, avatarNode(c), el('span.ez3-cname', null, T(c.name)));
      b.addEventListener('click', () => { sfx('tap'); contactDetail(c); });
      grid.appendChild(b);
    });
    pane.appendChild(grid);
  }
  function contactDetail(c) {
    const P = PH();
    const PD = D().phone || {};
    const det = PD.detail || ['전화', '문자'];
    const callB = el('button.ez3-dbtn.call', { 'data-qa': 'easy.call' }, el('span', { html: SV.call }), T(det[0]));
    const smsB = el('button.ez3-dbtn.sms', { 'data-qa': 'easy.sms' }, el('span', { html: SV.msg }), T(det[1]));
    callB.addEventListener('click', () => { sfx('tap'); dial(c.id); });
    smsB.addEventListener('click', () => { sfx('tap'); E.sms(c.id); });
    const body = el('div.ez3-detail', null, avatarNode(c, 'big'), el('div.ez3-dname', null, T(c.name)), el('div.ez3-dbtns', null, callB, smsB));
    const scr = G.ui.screen({ title: '', cls: 'ez3-scr ez3-contact', body });
    scr.dataset.scr = 'easy.contact.' + c.id;
    P.push(scr, { appId: 'phone' });
  }

  /* =========================================================
   * E5 — 쉬운 문자 (§3.3 · §4.4.4): one conversation, big text, no ⋮, no ← to a list (closing = home)
   * ========================================================= */
  E.sms = function (id) {
    const P = PH();
    if (!id || !P.push || !G.ui || !G.ui.screen) return null;
    const c = contactById(id);
    const t = ((G.STORY && G.STORY.sms && G.STORY.sms.list) || []).find((x) => x.id === id);
    const name = T((c && c.name) || (t && t.name) || id);
    if (P.closeAll) P.closeAll(true);
    P.currentApp = 'sms';
    const scr = G.ui.screen({ title: name, back: false, cls: 'ez3-scr ez3-sms', body: null, bodyCls: 'nopad' });
    scr.dataset.scr = 'easy.sms.' + id;
    scr.dataset.status = 'dark';
    let api = null;
    if (G.sms && typeof G.sms.renderThread === 'function') api = safe(() => G.sms.renderThread(scr.body, id, { big: true }), null);
    if (!api && !scr.body.childNodes.length) scr.body.appendChild(el('div.ez3-nochat', null, T(D().noChat || '{$noChat}')));
    if (P.markRead) safe(() => P.markRead((n) => n.chat === 'sms:' + id));
    P.push(scr, { appId: 'sms', anim: 'up', onClose: () => { if (api && api.destroy) safe(() => api.destroy()); } });
    return scr;
  };

  /* =========================================================
   * E6 — 스위치만 있는 화면 (§3.3 표 · §5.4 E6): settings keys easy.gate.rec / easy.gate.spam
   * ========================================================= */
  const GATE_KEY = { rec: 'recAuto', spam: 'spamSw' };
  function gateSetting(kind, v) {
    const key = GATE_KEY[kind];
    if (G.callrec && typeof G.callrec.setting === 'function') return !!safe(() => (v === undefined ? G.callrec.setting(key) : G.callrec.setting(key, !!v)), true);
    const g = SH().gate || (SH().gate = {});                                // partial build only (comms owns the state)
    if (v !== undefined) { g[key] = !!v; save(); }
    return g[key] !== false;
  }
  E.gate = function (kind) {
    kind = kind === 'spam' ? 'spam' : 'rec';
    if (G.settingsApp && G.settingsApp.open) return G.settingsApp.open('easy.gate.' + kind);
    return null;
  };

  /* =========================================================
   * E7 — 디스플레이 · 글자 크기와 스타일 · 화면 확대 · 쉬운 모드 (§3.3 · §4.7.2) — registered on G.settingsApp
   * ========================================================= */
  function stepSlider(value, o) {
    o = o || {};
    const n = o.steps || 8;
    let v = Math.max(1, Math.min(n, value | 0 || 1));
    const ticks = el('span.ez3-ticks', null, Array.from({ length: n }, () => el('i')));
    const knob = el('b.ez3-knob');
    const s = el('div.ez3-step', { role: 'slider', tabindex: 0, 'aria-valuemin': 1, 'aria-valuemax': n, 'aria-label': T(o.label || ''), 'data-qa': o.qa || null }, el('span.ez3-track', null, ticks), knob);
    const draw = () => { const p = (v - 1) / (n - 1) * 100; knob.style.left = p + '%'; s.setAttribute('aria-valuenow', String(v)); Array.from(ticks.children).forEach((t, i) => t.classList.toggle('on', i < v)); };
    const set = (x) => { const nv = Math.max(1, Math.min(n, Math.round(x))); if (nv === v) return; v = nv; draw(); sfx('tap'); if (o.onChange) o.onChange(v); };
    const pos = (e) => { const r = s.getBoundingClientRect(); return 1 + ((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1); };
    s.style.touchAction = 'none';
    let drag = false;
    s.addEventListener('pointerdown', (e) => { e.stopPropagation(); drag = true; try { s.setPointerCapture(e.pointerId); } catch (er) {} set(pos(e)); });
    s.addEventListener('pointermove', (e) => { if (drag) set(pos(e)); });
    const up = () => { drag = false; };
    s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
    s.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(v + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(v - 1); }
      else if (e.key === 'Home') { e.preventDefault(); set(1); } else if (e.key === 'End') { e.preventDefault(); set(n); }
    });
    draw();
    s.value = () => v;
    return s;
  }
  let registered = false;
  function registerSettings() {
    const A = G.settingsApp;
    if (registered || !A || !A.register || !A.ui) return;
    registered = true;
    const U = A.ui;
    const DD = () => D().display || {};
    const R = () => DD().rows || {};
    A.register('display', {
      title: () => DD().screen || '디스플레이',
      render(api) {
        api.on('easy:change', api.refresh);
        const r = R();
        const sl = U.slider ? U.slider(62, { label: T(r.brightness) }) : el('span');
        return el('div', null, U.group(null, [
          U.row({ title: r.theme && r.theme[0], meta: r.theme && r.theme[1] }),
          el('div.sh2-slrow', null, el('span', null, T(r.brightness)), sl),
          U.row({ key: 'display.font', title: r.font }),
          U.row({ key: 'display.zoom', title: r.zoom }),
          U.row({ key: 'display.easy', title: r.easy, meta: E.on() ? DD().sw : DD().swOff }),
          U.row({ title: r.timeout && r.timeout[0], meta: r.timeout && r.timeout[1] }),
        ]));
      },
    });
    A.register('display.font', {
      title: () => (DD().font || {}).title || '글자 크기와 스타일',
      render(api) {
        const F = DD().font || {};
        const prev = el('div.ez3-preview', null, T(F.preview));
        const paint = () => { prev.style.fontSize = Math.round(17 * (FONT_F[fontStep() - 1] || 1) * (E.on() ? 1.3 : 1)) + 'px'; prev.style.fontWeight = SH().fontBold ? '700' : ''; };
        paint();
        const st = stepSlider(fontStep(), { steps: F.steps || 8, label: T(F.size), qa: 'settings.slider:font', onChange: (v) => { SH().fontStep = v; save(); applyScale(); paint(); } });
        const bold = U.toggle(!!SH().fontBold, (v) => { SH().fontBold = !!v; save(); applyScale(); paint(); }, { label: T(F.bold), qa: 'settings.toggle:fontBold' });
        void api;
        return el('div', null,
          el('div.sh2-gw', null, el('div.sh2-group.ez3-prevbox', null, prev)),
          U.group(null, [el('div.sh2-slrow.ez3-steprow', null, el('span', null, T(F.size)), st), U.row({ title: F.bold, right: bold }), U.row({ title: F.face && F.face[0], meta: F.face && F.face[1] })]),
          U.group(null, [U.row({ key: 'display.easy', title: F.easyLink })]));
      },
    });
    A.register('display.zoom', {
      title: () => (DD().zoom || {}).title || '화면 확대',
      render() {
        const Z = DD().zoom || {};
        const prev = el('div.ez3-preview', null, T(Z.preview));
        const sl = U.slider ? U.slider(SH().zoom == null ? 50 : SH().zoom, { label: T(Z.title), onEnd: (v) => { SH().zoom = v; save(); } }) : el('span');
        return el('div', null, el('div.sh2-gw', null, el('div.sh2-group.ez3-prevbox', null, prev)),
          U.group(null, [el('div.sh2-slrow.ez3-zoomrow', null, el('small', null, T(Z.small)), sl, el('small', null, T(Z.big)))]));
      },
    });
    A.register('display.easy', {
      title: () => DD().title || '쉬운 모드',
      render(api) {
        const X = DD();
        api.on('easy:change', api.refresh);
        const on = E.on();
        const tg = U.toggle(on, (v) => { E.set(!!v); }, { label: T(X.title), qa: 'easy.toggle' });
        const lp = X.longPress || [];
        const lpSheet = () => {
          const opts = X.longPressOptions || [];
          const cur = SH().lpDelay == null ? opts.length - 1 : SH().lpDelay;
          if (!PH().sheet) return;
          PH().sheet({ title: lp[0], kind: 'sheet', qa: 'easy.longpress', mount: (fin, box) => {
            box.appendChild(el('div.sh2-group', null, opts.map((t, i) => {
              const r = el('button.sh2-row.radio' + (i === cur ? '.sel' : ''), { 'data-qa': 'sheet.btn:' + i }, el('span.sh2-radio' + (i === cur ? '.on' : '')), el('span.sh2-main', null, el('span.sh2-t', null, T(t))));
              r.addEventListener('click', () => { sfx('tap'); SH().lpDelay = i; save(); fin(i); api.refresh(); });
              return r;
            })));
          } });
        };
        const lpMeta = () => { const opts = X.longPressOptions || []; const i = SH().lpDelay; return i == null ? lp[1] : opts[i]; };
        return el('div.ez3-easyset', null,
          U.group(null, [U.row({ title: on ? X.sw : X.swOff, right: tg, cls: 'big' })]),
          el('div.sh2-foot.ez3-desc', null, T(X.desc)),
          U.group(null, [U.row({ title: lp[0], meta: lpMeta(), onClick: lpSheet, qa: 'settings.row:display.easy.longpress' })]));
      },
    });
    ['rec', 'spam'].forEach((kind) => {
      A.register('easy.gate.' + kind, {
        scr: 'easy.gate.' + kind, cls: 'ez3-gate',
        title: () => ((D().gates || {})[kind] || {}).title || '',
        onOpen(api) {
          if (api.scr) api.scr.setAttribute('data-qa', 'easy.gate:' + kind);
          setFlag('easyGate');
          G.bus && G.bus.emit('easy:gate', { kind });
        },
        render(api) {
          const g = (D().gates || {})[kind] || {};
          const on = gateSetting(kind);
          const tg = U.toggle(on, (v) => { gateSetting(kind, v); setTimeout(api.refresh, 30); }, { label: T(g.title), qa: 'easy.gate.switch' });
          const rows = (g.rows || []).map(([t, m]) => U.row({ title: t, meta: m }));
          return el('div.ez3-gatebody', null,
            U.group(null, [U.row({ title: on ? g.sw : g.swOff, right: tg, cls: 'big' })]),
            el('div.sh2-foot.ez3-desc', null, T(g.desc)),
            rows.length ? U.group(null, rows) : null);
        },
      });
    });
  }

  /* =========================================================
   * E9 — 쉬운 착신 화면 (§4.1.3 · §5.4 E9) — mom's screen inside c3_phone_ring (inert to taps) · updates in place
   * ========================================================= */
  E.ringScreen = function (node, o) {
    if (!node) return null;
    o = o || {};
    const R = D().ring || {};
    let st = node._ez3ring;
    if (!st || !st.root.isConnected) {
      const avBox = el('span.ez3-rs-av');
      const src = img(R.avatar || 'avatar_sea');
      const ini = () => { avBox.innerHTML = SV.person; avBox.classList.add('ini'); };
      if (src) { const im = el('img', { src, alt: '' }); im.onerror = ini; avBox.appendChild(im); } else ini();
      const root = el('div.ez3-ring', { 'data-qa': 'easy.ring', 'aria-hidden': 'true', dataset: { scr: 'easy.ring' } },
        el('div.ez3-rs-top', null, el('div.ez3-rs-name', null, T(R.name || '')), el('div.ez3-rs-sub')), avBox, el('div.ez3-rs-btns'));
      node.appendChild(root);
      st = node._ez3ring = { root, sub: root.querySelector('.ez3-rs-sub'), btns: root.querySelector('.ez3-rs-btns'), phase: null, sec: 0, off: null, t: 0, offT: 0 };
      const fit = () => { const w = node.clientWidth || root.clientWidth || 240; root.style.fontSize = Math.max(7, Math.min(22, w / 15)) + 'px'; };
      fit();
      if (typeof ResizeObserver !== 'undefined') { st.ro = new ResizeObserver(fit); st.ro.observe(node); }
    }
    const phase = o.phase === 'call' || o.phase === 'ended' ? o.phase : 'ring';
    const fmtS = (s) => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    if (st.phase !== phase) {
      st.phase = phase;
      st.root.dataset.phase = phase;
      if (st.off) { st.off(); st.off = null; }
      clearTimeout(st.offT);
      st.root.classList.remove('off');
      st.root.classList.toggle('still', less() || reduced());
      st.btns.innerHTML = '';
      const circle = (cls, svg, label) => el('div.ez3-rs-b.' + cls, null, el('span', { html: svg }), el('small', null, T(label || '')));
      if (phase === 'ring') {
        st.sub.textContent = T(R.kind || '');
        st.btns.append(circle('decline', SV.end, R.decline), circle('accept', SV.call, R.accept));
      } else if (phase === 'call') {
        const b = R.callBtns || [];
        st.sec = o.sec != null ? Math.max(0, o.sec | 0) : 0;
        st.sub.textContent = fmtS(st.sec);
        st.btns.append(circle('op', SV.spk, b[0]), circle('op', SV.mute, b[1]), circle('decline', SV.end, b[2]));
        if (G.bus) {                                                      // the call timer runs by itself (play seconds); a later sec re-bases it
          st.acc = st.sec * 1000;
          st.off = G.bus.on('tick', (e) => { st.acc += (e && e.dt) || 250; const s = Math.floor(st.acc / 1000); if (s !== st.sec) { st.sec = s; st.sub.textContent = fmtS(s); } });
        }
      } else {
        st.sub.textContent = T(R.ended || '');
        st.offT = setTimeout(() => { if (st.root.isConnected) st.root.classList.add('off'); }, 1500);
      }
    }
    if (phase === 'call' && o.sec != null) { st.sec = Math.max(0, o.sec | 0); st.acc = st.sec * 1000; st.sub.textContent = fmtS(st.sec); }
    return {
      node: st.root,
      update: (o2) => E.ringScreen(node, o2),
      destroy() { if (st.off) st.off(); clearTimeout(st.offT); if (st.ro) safe(() => st.ro.disconnect()); st.root.remove(); node._ez3ring = null; },
    };
  };

  /* =========================================================
   * init
   * ========================================================= */
  let inited = false;
  E.init = function () {
    registerSettings();
    if (inited) return; inited = true;
    applyScale();
    if (G.bus) {
      G.bus.on('state:load', () => applyScale());
      G.bus.on('state:reset', () => applyScale());
      G.bus.on('settings', () => applyScale());
    }
    if (G.DEBUG) { window.haru = window.haru || {}; window.haru.easy = (on) => E.set(on === undefined ? !E.on() : !!on, { silent: true }); }
  };
  registerSettings();                                                       // settings.js (shell) is loaded before this file
})();
