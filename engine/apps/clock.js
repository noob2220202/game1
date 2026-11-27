/* =========================================================
 * 시계 (owner: media) — DESIGN §4.7.4 (both users) · §3.16 재료 · §4.7.1 / §3.1 알람 화면 (N04 visual) ·
 * §3.20.1 cb.alarmDel · §5.6 (no '다른 기기가 관리하는 알람' reason text).
 * Tabs 알람 · 세계 시각 · 스톱워치 · 타이머 (the last three are default screens with no content;
 * the world clock shows the in-game clock, whose seconds loop 57→58→59 while capped — engine rule).
 * Alarm list: on/off toggle + long-press → `삭제` only. Detail = VIEW-ONLY screen: rows do not react,
 * no pencil / time wheel / volume slider / output picker / [저장], NO preview button, no reason text.
 * Ring screen (cold open): G.clockApp.ring('a2310') → layer .md2-ring (z 46, above the M0 eye view):
 * `오후 11:10` · `문 앞` · `♪ 우리` (moving bars) · [해제 ›] slide → resolves. It plays NO sound
 * (the alarm sound is flow's G.audio.box15). No 다시 울림 button.
 *
 * Public API : G.clockApp = { ring(alarmId) → Promise<void>, ringing() → bool }
 * Hooks set  : 'alarm:ring'
 * Bus        : emits 'alarm:ringing' {id}; listens 'tick' / 'clock:min' (display only)
 * Vars       : vars.md.alarmOn {id: bool} · vars.md.alarmDel {id: true}
 * data-qa    : clock.alarm:<id> clock.toggle:<id> alarm.slide (+ clock.tab:<id>, clock.delete)
 *
 * ---- ep3 (G.STORY.alarms.v === 3 — ep2 data has no `v` · ARCH_EP3 §3.3: data only, ring screen unused) ----
 * DESIGN_EP3 §4.8.3 · §5.0-3 · §5.6: one alarm `오전 6:30 · 월–금 · 꺼짐` (toggle moves, nothing rings · progress 0) ·
 * NO long-press `삭제` (the only long-press in ep3 is the notebook hint) · `세계 시각` = one `서울` row (data `world`) ·
 * data-scr clock.<tab> · clock.alarm.detail. 타이머 runs like a real one (timerTabV3 — wheels 시·분·초, countdown, silent end ·
 * data-qa clock.timer.start · clock.timer.reset · clock.timer.col:h|m|s).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[clock] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, pad = MU.pad;
  const AD = () => (G.STORY && G.STORY.alarms) || { n: [], dash: [], tabs: [['alarm', '알람']] };
  const isV3 = () => AD().v === 3;   // ep3 data marker (ARCH_EP3 §4.1-3)
  const CA = (G.clockApp = G.clockApp || {});
  CA.open = function (o) { if (G.phone && G.phone.openApp) G.phone.openApp('clock', o || {}); };   // ARCH_EP3 §5.11 (additive)
  const IC = {
    alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9.5V13l2.5 1.8M4.5 5.5l3-2.5M19.5 5.5l-3-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    world: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5M12 3.5C9.4 5.9 8.4 8.8 8.4 12s1 6.1 3.6 8.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    sw: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 13.5V9.5M10 2.8h4M18 6.5l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };
  const list = (user) => (AD()[user === 'dash' ? 'dash' : 'n'] || []).filter((a) => !(MU.md().alarmDel || {})[a.id]);
  const isOn = (a) => { const v = (MU.md().alarmOn || {})[a.id]; return typeof v === 'boolean' ? v : !!a.on; };
  const splitTime = (s) => { const m = String(s || '').match(/^(오전|오후)\s*(.+)$/); return m ? [m[1], m[2]] : ['', String(s || '')]; };

  let tab = 'alarm';
  MU.app('clock', {
    name: '시계',
    icon: (G.ICONS && G.ICONS.clock) || { bg: 'linear-gradient(160deg,#3a3a40,#141416)', svg: IC.alarm },
    badge: () => 0,
    open(p) {
      p = p || {};
      if (p.tab) tab = p.tab;
      const user = p.user || MU.user();
      const wrap = el('div.md2-clk-wrap');
      const tabs = el('nav.md2-tabs.dark');
      const scr = MU.screen({ title: '', theme: 'dark', cls: 'md2-clk', body: wrap, footer: tabs });
      let stopTab = null;
      function render() {
        if (stopTab) { stopTab(); stopTab = null; }
        wrap.innerHTML = ''; tabs.innerHTML = '';
        (AD().tabs || []).forEach(([k, l]) => {
          const b = el('button.md2-tab' + (tab === k ? '.on' : ''), { type: 'button', html: (IC[k] || '') + `<span>${T(l)}</span>` });
          MU.qa(b, 'clock.tab:' + k);
          b.addEventListener('click', () => { if (tab === k) return; MU.sfx('tap'); tab = k; render(); });
          tabs.appendChild(b);
        });
        MU.setTitle(scr, T(((AD().tabs || []).find((t) => t[0] === tab) || [])[1] || ''));
        if (isV3()) { scr.dataset.scr = 'clock.' + tab; const top = G.phone && G.phone.top && G.phone.top(); if (top && top.node === scr) top.scr = scr.dataset.scr; }
        if (tab === 'alarm') alarmTab(wrap, user, render);
        else if (tab === 'world') stopTab = worldTab(wrap);
        else if (tab === 'sw') stopTab = swTab(wrap);
        else stopTab = timerTab(wrap);
      }
      render();
      MU.push(scr, { onClose: () => { if (stopTab) stopTab(); }, onResume: render });
    },
  });

  /* ---------------- 알람 ---------------- */
  function alarmTab(wrap, user, rerender) {
    const box = el('div.md2-alarms');
    list(user).forEach((a) => {
      const on = isOn(a);
      const [ap, hm] = splitTime(a.time);
      const nm = T(a.name);
      const tg = MU.toggle(on, 'clock.toggle:' + a.id, (v) => {
        const m = Object.assign({}, MU.md().alarmOn || {}); m[a.id] = v; MU.mdSet({ alarmOn: m });
        card.classList.toggle('off', !v);
      });
      const card = el('div.md2-alarm' + (on ? '' : '.off'), { role: 'button', tabindex: 0 },
        el('div.md2-al-main', null,
          el('div.md2-al-time', null, ap ? el('small', null, ap) : null, hm),
          el('div.md2-al-sub', null, nm ? el('b', null, nm) : null, el('span', null, T(a.repeat || '')))),
        tg);
      MU.qa(card, 'clock.alarm:' + a.id);
      card.addEventListener('click', () => { MU.sfx('tap'); detail(a); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); detail(a); } });
      if (isV3()) card.addEventListener('contextmenu', (e) => e.preventDefault());   // ep3: no long-press menu (§5.0-3)
      else longPress(card, () => askDelete(a, rerender));
      box.appendChild(card);
    });
    wrap.appendChild(box);
  }
  function longPress(node, fn) {
    let t = null, sx = 0, sy = 0, fired = false;
    node.addEventListener('pointerdown', (e) => { fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => { t = null; fired = true; fn(); }, 560); });
    node.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(t); t = null; } });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => node.addEventListener(ev, () => { clearTimeout(t); t = null; }));
    node.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
    node.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  /** long-press → a single `삭제` action (a real alarm app's selection action; no text beyond the label) */
  function askDelete(a, rerender) {
    MU.sfx('tap');
    const label = T(AD().deleteLabel || '삭제');
    const doDel = () => { const d = Object.assign({}, MU.md().alarmDel || {}); d[a.id] = true; MU.mdSet({ alarmDel: d }); rerender(); };
    if (G.phone && G.phone.sheet) {
      Promise.resolve(G.phone.sheet({ buttons: [{ label, value: 'delete', style: 'danger' }], qa: 'clock.delete' })).then((v) => { if (v === 'delete') doDel(); });
      return;
    }
    const scr = document.querySelector('.md2-clk.in') || document.querySelector('.md2-clk');
    if (scr) MU.menu(scr, [{ label, qa: 'sheet.btn:delete', onClick: doDel }]);
  }
  function detail(a) {
    const [ap, hm] = splitTime(a.time);
    const rows = el('div.md2-al-rows', null, (a.detail || []).map(([k, v]) => el('div.md2-al-row', null, el('span', null, T(k)), v ? el('b', null, T(v)) : null)));
    const body = el('div.md2-al-detail', null, el('div.md2-al-big', null, ap ? el('small', null, ap) : null, hm), rows);
    const scr = MU.screen({ title: '', theme: 'dark', cls: 'md2-clk md2-al-view', body });
    MU.noMenu(scr);
    if (isV3()) scr.dataset.scr = 'clock.alarm.detail';
    MU.push(scr);
  }

  /* ---------------- 세계 시각 / 스톱워치 / 타이머 (default screens) ---------------- */
  function worldTab(wrap) {
    const face = el('div.md2-wt-face', null, el('i.h'), el('i.m'), el('i.s'), el('b'));
    const big = el('div.md2-wt-time'), date = el('div.md2-wt-date');
    const city = AD().world ? el('div.md3-wt-city', null, T(AD().world)) : null;   // ep3 `서울` row (absent in ep2 data)
    wrap.append(el('div.md2-wt', null, face, city, big, date));
    function upd() {
      const d = MU.now();
      big.textContent = `${MU.fmtK(d)}:${pad(d.getSeconds())}`;
      date.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${MU.WEEK[d.getDay()]}요일`;
      const hh = (d.getHours() % 12) + d.getMinutes() / 60, mm = d.getMinutes() + d.getSeconds() / 60;
      face.querySelector('.h').style.transform = `rotate(${hh * 30}deg)`;
      face.querySelector('.m').style.transform = `rotate(${mm * 6}deg)`;
      face.querySelector('.s').style.transform = `rotate(${d.getSeconds() * 6}deg)`;
    }
    upd();
    const offs = [MU.on('tick', upd), MU.on('clock:min', upd), MU.on('clock:jump', upd)];
    return () => offs.forEach((f) => f && f());
  }
  let swStart = null, swAcc = 0;
  function swTab(wrap) {
    const disp = el('div.md2-sw');
    const btn = el('button.md2-sw-btn', { type: 'button', 'aria-label': '시작' });
    const reset = el('button.md2-sw-btn.sec', { type: 'button', 'aria-label': '초기화', html: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 102.1-5M5 4v4h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    const ms = () => swAcc + (swStart ? performance.now() - swStart : 0);
    const fmt = (t) => `${pad(Math.floor(t / 60000))}:${pad(Math.floor(t / 1000) % 60)}.${pad(Math.floor(t / 10) % 100)}`;
    function sync() { btn.innerHTML = swStart ? MU.ICON.pause : MU.ICON.play; btn.classList.toggle('run', !!swStart); reset.style.visibility = !swStart && ms() ? 'visible' : 'hidden'; disp.textContent = fmt(ms()); }
    btn.addEventListener('click', () => { MU.sfx('tap'); if (swStart) { swAcc += performance.now() - swStart; swStart = null; } else swStart = performance.now(); sync(); });
    reset.addEventListener('click', () => { MU.sfx('tap'); swAcc = 0; swStart = null; sync(); });
    wrap.append(el('div.md2-sw-wrap', null, disp, el('div.md2-sw-btns', null, reset, btn)));
    sync();
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); if (!document.hidden && swStart) disp.textContent = fmt(ms()); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }
  /* ep3 (v3 data only): the 타이머 runs like a real one (DESIGN_EP3 §4.8.3 — '스톱워치·타이머는 실제처럼 돈다', progress 0):
   * three snap wheels 시 · 분 · 초 → ▶ → a real-time countdown (like the stopwatch) with ‖ / ▶ and 초기화. At 0 the display
   * blinks for 3 s and the wheels come back — silent (no tone, no vibration: ARCH_EP3 §1 vibrate allow-list). The state lives
   * in this module, so it survives tab switches and closing the app (a real timer keeps running). ep2 keeps the static screen. */
  const TM = { setMs: 0, end: 0, left: 0, run: false, on: false, vals: [0, 0, 0] };
  function timerTabV3(wrap) {
    const ROW = 52, MAX = [99, 59, 59], LBL = ['시', '분', '초'];
    const fmt = (t) => { const s = Math.ceil(t / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
    const msLeft = () => (TM.run ? Math.max(0, TM.end - performance.now()) : TM.left);
    const chosen = () => ((TM.vals[0] * 60 + TM.vals[1]) * 60 + TM.vals[2]) * 1000;
    const box = el('div.md3-tm');
    const disp = el('div.md2-sw.md3-tm-disp');
    const wheels = el('div.md3-tm-wheels');
    const start = el('button.md2-sw-btn', { type: 'button', 'aria-label': '시작' });
    const reset = el('button.md2-sw-btn.sec', { type: 'button', 'aria-label': '초기화', html: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 102.1-5M5 4v4h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    MU.qa(start, 'clock.timer.start'); MU.qa(reset, 'clock.timer.reset');
    let blinkT = null;
    const cols = MAX.map((mx, i) => {
      const list = el('div.md3-tm-list');
      for (let v = 0; v <= mx; v++) list.appendChild(el('div.md3-tm-n', null, pad(v)));
      const col = el('div.md3-tm-col', { tabindex: 0, role: 'spinbutton', 'aria-label': LBL[i], 'aria-valuemin': 0, 'aria-valuemax': mx, 'aria-valuenow': TM.vals[i] }, list);
      MU.qa(col, 'clock.timer.col:' + 'hms'[i]);
      let st = null;
      const read = () => { const v = Math.max(0, Math.min(mx, Math.round(col.scrollTop / ROW))); if (v !== TM.vals[i]) { TM.vals[i] = v; col.setAttribute('aria-valuenow', v); sync(); } };
      col.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(read, 90); }, { passive: true });
      col.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); e.stopPropagation();
        const v = Math.max(0, Math.min(mx, TM.vals[i] + (e.key === 'ArrowDown' ? 1 : -1)));
        col.scrollTop = v * ROW; TM.vals[i] = v; col.setAttribute('aria-valuenow', v); sync();
      });
      return el('div.md3-tm-unit', null, el('span.md3-tm-lbl', null, LBL[i]), col);
    });
    cols.forEach((c) => wheels.appendChild(c));
    function sync() {
      const setup = !TM.on;
      wheels.style.display = setup ? '' : 'none';
      disp.style.display = setup ? 'none' : '';
      reset.style.visibility = setup ? 'hidden' : 'visible';
      start.innerHTML = TM.run ? MU.ICON.pause : MU.ICON.play;
      start.classList.toggle('run', TM.run);
      start.setAttribute('aria-label', TM.run ? '일시정지' : '시작');
      start.disabled = setup && !chosen();
      if (!setup) disp.textContent = fmt(msLeft());
    }
    function finish() {
      TM.run = false; TM.left = 0; disp.textContent = fmt(0); disp.classList.add('md3-tm-done');
      clearTimeout(blinkT);
      blinkT = setTimeout(() => { disp.classList.remove('md3-tm-done'); TM.on = false; sync(); }, 3000);
      sync();
    }
    start.addEventListener('click', () => {
      MU.sfx('tap');
      if (!TM.on) { TM.setMs = chosen(); if (!TM.setMs) return; TM.on = true; TM.run = true; TM.end = performance.now() + TM.setMs; }
      else if (TM.run) { TM.left = msLeft(); TM.run = false; }
      else if (TM.left > 0) { TM.run = true; TM.end = performance.now() + TM.left; }
      sync();
    });
    reset.addEventListener('click', () => { MU.sfx('tap'); clearTimeout(blinkT); disp.classList.remove('md3-tm-done'); TM.on = false; TM.run = false; TM.left = 0; sync(); });
    box.append(wheels, disp, el('div.md2-sw-btns', null, reset, start));
    wrap.append(el('div.md2-sw-wrap.md3-tm-wrap', null, box));
    if (TM.on && TM.run && msLeft() <= 0) { TM.on = false; TM.run = false; TM.left = 0; }   // ran out while the tab was away
    sync();
    requestAnimationFrame(() => cols.forEach((c, i) => { const col = c.querySelector('.md3-tm-col'); if (col) col.scrollTop = TM.vals[i] * ROW; }));
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || !TM.run) return;
      const t = msLeft();
      if (t <= 0) finish(); else disp.textContent = fmt(t);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(blinkT); if (disp.classList.contains('md3-tm-done')) TM.on = false; };
  }
  function timerTab(wrap) {
    if (isV3()) return timerTabV3(wrap);
    const btn = el('button.md2-sw-btn', { type: 'button', 'aria-label': '시작', html: MU.ICON.play, disabled: true });
    wrap.append(el('div.md2-sw-wrap', null, el('div.md2-sw', null, '00:00:00'), el('div.md2-sw-btns', null, btn)));
    return null;
  }

  /* ---------------- ring screen (cold open · N04) ---------------- */
  let ringing = null;
  CA.ringing = () => !!ringing;
  CA.ring = function (alarmId) {
    if (ringing) return ringing.promise;
    const a = (AD().n || []).concat(AD().dash || []).find((x) => x.id === (alarmId || 'a2310')) || (AD().n || [])[1] || {};
    const R = a.ring || { time: a.time, title: T(a.name), playing: '', slide: '' };
    const host = document.getElementById('screen') || document.body;
    const knob = el('div.md2-ring-knob', { html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.8V13l2.2 1.6M5 6l3-2.5M19 6l-3-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
    const label = el('span.md2-ring-lbl', null, T(R.slide));
    const track = el('div.md2-ring-track', { role: 'slider', tabindex: 0, 'aria-label': T(R.slide), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, label, knob);
    MU.qa(track, 'alarm.slide');
    const node = el('div.md2-ring', { dataset: { theme: 'dark' } },
      el('div.md2-ring-top', null, el('div.md2-ring-time', null, T(R.time)), el('div.md2-ring-title', null, T(R.title))),
      el('div.md2-ring-mid', null, el('span.md2-ring-eq', null, el('i'), el('i'), el('i'), el('i')), el('span', null, T(R.playing))),
      el('div.md2-ring-bot', null, track));
    let resolveFn;
    const promise = new Promise((res) => { resolveFn = res; });
    ringing = { promise, id: a.id };
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    let removeBack = null;
    try { if (G.phone && G.phone.pushBack) removeBack = G.phone.pushBack(() => !!ringing); } catch (e) {}   // back does nothing while it rings (slide only)
    // slide
    let drag = false, x0 = 0, f = 0;
    const maxX = () => Math.max(40, track.clientWidth - knob.offsetWidth - 8);
    const setF = (v) => { f = Math.max(0, Math.min(1, v)); knob.style.transform = `translateX(${f * maxX()}px)`; label.style.opacity = String(1 - f * 1.4); track.setAttribute('aria-valuenow', Math.round(f * 100)); };
    function finish() {
      if (!ringing) return;
      ringing = null;
      if (removeBack) removeBack();
      node.classList.add('done'); node.classList.remove('in');
      setTimeout(() => node.remove(), 420);
      resolveFn();
    }
    track.addEventListener('pointerdown', (e) => { drag = true; x0 = e.clientX - f * maxX(); try { track.setPointerCapture(e.pointerId); } catch (er) {} knob.style.transition = 'none'; });
    track.addEventListener('pointermove', (e) => { if (drag) setF((e.clientX - x0) / maxX()); });
    const up = () => { if (!drag) return; drag = false; knob.style.transition = ''; if (f > 0.62) { setF(1); finish(); } else setF(0); };
    track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up); track.addEventListener('lostpointercapture', up);
    track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setF(1); finish(); } });
    node.addEventListener('contextmenu', (e) => e.preventDefault());
    setTimeout(() => { try { track.focus({ preventScroll: true }); } catch (e) {} }, 300);
    MU.emit('alarm:ringing', { id: a.id });
    return promise;
  };
  if (G.hooks && G.hooks.set) G.hooks.set('alarm:ring', (id) => CA.ring(id));
  if (G.DEBUG && window.haru) window.haru.ring = (id) => CA.ring(id || 'a2310');
})();
