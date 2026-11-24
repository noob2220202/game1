/* =========================================================
 * Lock screen: clock, notifications preview, camera shortcut (works while locked),
 * emergency call, PIN entry with hint & lockout.
 * G.STORY.lock = { wallpaper, hint, check(code)->bool, onUnlock(), notifs()->[{app,title,body,t}],
 *                  wrongMsg(code, fails), emergency(), onShow() }
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const LK = (G.lock = {});
  let node = null;

  LK.show = function () {
    const S = G.STORY.lock;
    const layer = G.phone.lockLayer();
    layer.innerHTML = '';
    G.phone.setLocked(true);
    node = el('div.lock', { style: { backgroundImage: `url("${S.wallpaper}")` } });
    const timeEl = el('div.lock-time');
    const dateEl = el('div.lock-date');
    const notifs = el('div.lock-notifs');
    node.append(el('div.lock-top', null, dateEl, timeEl, el('div.lock-owner', null, '세아 💛 콩이')), notifs,
      el('div.lock-swipe', null, '위로 밀어서 잠금 해제'),
      el('div.lock-bottom', null,
        el('button.lock-round', { 'aria-label': '휴대폰 뒤집기', html: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 9a9 9 0 013-5M21 15a9 9 0 01-3 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6 1.5V4.5H3M18 22.5V19.5h3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>', onclick: (e) => { e.stopPropagation(); G.audio.sfx.whoosh(); LK.flipCase(); } }),
        el('button.lock-round.cam', { 'aria-label': '카메라', html: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', onclick: () => { G.audio.sfx.tap(); G.bus.emit('lock:camera'); G.camera.rear({ mode: 'lockscreen' }); } })));
    layer.appendChild(node);
    function tick() {
      const d = G.clock.now();
      timeEl.textContent = `${d.getHours()}:${pad(d.getMinutes())}`;
      dateEl.textContent = G.util.fmtKDate(d);
    }
    tick();
    const off = G.bus.on('tick', tick);
    function renderNotifs() {
      notifs.innerHTML = '';
      const list = (S.notifs ? S.notifs() : []).concat((G.state.notifs || []).filter((n) => n.lock).map((n) => n));
      list.slice(0, 4).forEach((n) => {
        const a = G.apps[n.app] || {};
        const d = n.t ? G.chat.parseT(n.t) : null;
        notifs.appendChild(el('div.lock-notif', null,
          el('span.ln-icon', { style: { background: (a.icon && a.icon.bg) || '#444' }, html: (a.icon && a.icon.svg) || '' }),
          el('div.ln-main', null, el('div.ln-top', null, el('span', null, a.name || ''), el('span', null, n.when || (d ? G.util.fmtKTime(d) : '지금'))), el('div.ln-title', null, G.T(n.title || '')), el('div.ln-body', null, G.T(n.body || '')))));
      });
    }
    renderNotifs();
    const off2 = G.bus.on('lock:refresh', renderNotifs);
    // swipe up / tap -> PIN
    let sy = null;
    node.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; }, { passive: true });
    node.addEventListener('touchend', (e) => { if (sy != null && sy - e.changedTouches[0].clientY > 60) openPin(); sy = null; });
    node.addEventListener('click', (e) => { if (e.target.closest('.lock-bottom') || e.target.closest('.lock-pin')) return; openPin(); });
    LK._cleanup = () => { off(); off2(); };
    S.onShow && S.onShow();
  };

  /* ---------- P1 path (a): the back of the phone, a polaroid in the clear case, glare over the date ---------- */
  LK.flipCase = function () {
    const meta = (G.IMGMETA && G.IMGMETA.case_date) || { x: 0.535, y: 0.615, w: 0.127, h: 0.052 };
    const img = el('img.case-img', { src: G.IMG.case_back, alt: '' });
    const glare = el('div.case-glare');
    const stage = el('div.case-stage', null, img, glare);
    const tip = el('div.case-tip', null, '케이스 안에 사진이 끼워져 있다. 날짜 쪽이 빛에 번들거린다…');
    const ghost = el('div.case-ghost', null, '☝ 빛을 손가락으로 밀어 보세요');
    const root = el('div.case-view', null, el('button.cu-back', { 'aria-label': '돌아가기', html: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' }), stage, tip, ghost);
    const ov = G.phone.overlay(root, { onBack: () => close() });
    let off = { x: 0, y: 0 }, revealed = false, dragging = null;
    function rect() {
      const r = stage.getBoundingClientRect(); const iw = img.naturalWidth || 1024, ih = img.naturalHeight || 1536;
      const sc = Math.min(r.width / iw, r.height / ih); const w = iw * sc, h = ih * sc;
      return { x: (r.width - w) / 2, y: (r.height - h) / 2, w, h };
    }
    function place() {
      const R = rect();
      const cx = R.x + (meta.x + meta.w / 2) * R.w, cy = R.y + (meta.y + meta.h / 2) * R.h;
      const size = Math.max(110, meta.w * R.w * 1.9);
      glare.style.width = glare.style.height = size + 'px';
      glare.style.left = cx - size / 2 + off.x + 'px'; glare.style.top = cy - size / 2 + off.y + 'px';
      const d = Math.hypot(off.x, off.y);
      if (!revealed && d > size * 0.55) {
        revealed = true; G.flag('caseDateSeen', true); G.audio.sfx.pen();
        tip.textContent = '“콩이 우리집 온 날 ♥ 3.17”';
        G.notebook && G.notebook.note && G.notebook.note('케이스 속 폴라로이드: 콩이 우리집 온 날 3.17');
      }
    }
    img.addEventListener('load', place); setTimeout(place, 60);
    stage.style.touchAction = 'none';
    stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); dragging = { x: e.clientX - off.x, y: e.clientY - off.y }; ghost.classList.remove('in'); });
    stage.addEventListener('pointermove', (e) => { if (!dragging) return; off = { x: e.clientX - dragging.x, y: e.clientY - dragging.y }; place(); });
    stage.addEventListener('pointerup', () => { dragging = null; });
    root.querySelector('.cu-back').addEventListener('click', () => close());
    function close() { ov.close(); }
    G.bus.emit('lock:flip');
  };

  let pinOpen = false;
  function openPin() {
    if (pinOpen) return;
    pinOpen = true;
    const S = G.STORY.lock;
    G.audio.sfx.whoosh();
    let fails = G.state.vars.lockFails || 0;
    const pin = el('div.lock-pin');
    const pad_ = G.ui.pinPad({
      length: S.length || 4,
      title: 'PIN 입력',
      sub: '',
      async onSubmit(code) {
        const until = G.state.vars.lockUntil || 0;
        if (Date.now() < until) return `${Math.ceil((until - Date.now()) / 1000)}초 후에 다시 시도하세요`;
        if (S.check(code)) { unlock(); return true; }
        fails++; G.state.vars.lockFails = fails; G.save();
        G.bus.emit('lock:fail', { code, fails });
        if (fails % 5 === 0) { G.state.vars.lockUntil = Date.now() + 15000; G.save(); return '잘못된 PIN을 5회 입력했습니다.\n15초 후에 다시 시도하세요.'; }
        return (S.wrongMsg && S.wrongMsg(code, fails)) || `PIN이 일치하지 않습니다 (${fails}회)`;
      },
    });
    const hint = S.hint ? el('div.lock-hint', null, '💡 ' + G.T(S.hint())) : null;
    pin.append(hint, pad_, el('div.lock-pin-foot', null,
      el('button', { onclick: () => emergency() }, '긴급 통화'),
      el('button', { onclick: () => close() }, '취소')));
    node.appendChild(pin);
    requestAnimationFrame(() => pin.classList.add('in'));
    function close() { pin.classList.remove('in'); setTimeout(() => pin.remove(), 250); pinOpen = false; }
    LK._closePin = close;
    G.bus.emit('lock:pin');
  }
  G.bus.on('lock:back', () => { if (LK._closePin && pinOpen) LK._closePin(); });

  async function emergency() {
    const S = G.STORY.lock;
    if (S.emergency) return S.emergency();
    await G.phone.callScreen({ name: '긴급 통화', number: '112', async script(api) { api.status('연결 중…'); await sleep(2500); await api.sub('긴급 통화를 연결할 수 없습니다.', 2400, 'sfx'); } });
  }

  async function unlock() {
    const S = G.STORY.lock;
    G.audio.sfx.unlock();
    G.state.vars.lockFails = 0; G.save();
    pinOpen = false;
    node.style.transition = 'transform .45s cubic-bezier(.4,0,.2,1), opacity .45s';
    node.style.transform = 'translateY(-100%)'; node.style.opacity = '0';
    await sleep(450);
    LK._cleanup && LK._cleanup();
    G.phone.setLocked(false);
    G.phone.lockLayer().innerHTML = '';
    G.flag('unlocked', true);
    S.onUnlock && S.onUnlock();
  }
  LK.isLocked = () => G.phone.isLocked();
})();
