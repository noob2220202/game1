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
    node.append(el('div.lock-top', null, dateEl, timeEl), notifs,
      el('div.lock-swipe', null, '위로 밀어서 잠금 해제'),
      el('div.lock-bottom', null,
        el('button.lock-round', { 'aria-label': '손전등', html: '<svg viewBox="0 0 24 24"><path d="M8 3h8v3l-2 4v10.5a1.5 1.5 0 01-1.5 1.5h-1A1.5 1.5 0 0110 20.5V10L8 6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>', onclick: () => { G.audio.sfx.flashlight(true); G.phone.toast('손전등은 카메라에서 켤 수 있어요 📷'); G.bus.emit('lock:torch'); } }),
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
