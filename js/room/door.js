/* =========================================================
 * Door-lock keypad close-up (design H1, P2 trap, P8 code).
 * Keys play the shared C-major table (G.audio.doorKey). 6-slot display, * = 지우기, # = 확인.
 *  - H1: after the recording was heard (flag doorlockHeard), pressing 4 then 7 within 4 s
 *        registers fragment 47.
 *  - *0404#  : trap (alarm, red flash ≤3 Hz, 3 knocks inside the wardrobe, 관리실 message).
 *  - 4729#   : "…두 자리가 더 있어." (not counted as wrong)
 *  - 472906# : before M6 -> admin relock + his 'ㅋ' (or a knock); after M6 -> M7, climax.
 *  - wrong   : 삐삐삐 + 1 knock inside wardrobe; every 5th wrong -> 20 s 입력 제한.
 * G.door = {open(), close(), isOpen(), press(key), enter(str)}   Hooks: 'door:keypad'
 * Vars: doorWrong, doorLockUntil, pitchView (shared '음높이 보기' toggle), trap0404 flag.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const { el, sleep } = G.util;
  const D = (G.door = {});
  const CODE = '472906';
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const HZ = { '1': 523.25, '2': 587.33, '3': 659.25, '4': 698.46, '5': 783.99, '6': 880, '7': 987.77, '8': 1046.5, '9': 1174.66, '0': 1318.51 };

  function sfx(name) { const A = G.audio; const f = A && A.sfx && A.sfx[name]; if (!f) return undefined; try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { return undefined; } }
  function keyTone(d, o) { if (G.audio && G.audio.doorKey) { try { G.audio.doorKey(d, o); } catch (e) {} } }
  function T(s) { return G.T ? G.T(s) : s; }
  function note(s) { try { G.notebook && G.notebook.note && G.notebook.note(T(s)); } catch (e) {} }
  function himTone() { return 'him'; }

  let inst = null;
  D.isOpen = () => !!inst;

  D.open = function () {
    if (inst) return inst;
    const vars = G.state.vars;
    let buf = '', star = false, busy = false, last = { k: null, t: 0 }, nudgeT = 0;
    // geometry in fractions of the keypad photo (G.ROOM.keypad); the plate shows only `crop`
    const KP = Object.assign({
      crop: { x: 0.17, y: 0.1, w: 0.66, h: 0.62 }, panel: { x: 0.258, y: 0.152, w: 0.46, h: 0.586 },
      lcd: { x: 0.33, y: 0.198, w: 0.36, h: 0.068 }, grid: { x: 0.3185, y: 0.271, w: 0.381, h: 0.376 },
    }, (G.ROOM && G.ROOM.keypad) || {});
    const box = (n, b) => Object.assign(n.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' });

    const slots = el('div.dk-slots', null, [0, 1, 2, 3, 4, 5].map(() => el('i')));
    const lcdMsg = el('div.dk-msg');
    const lcd = el('div.dk-lcd', null, slots, lcdMsg);
    const grid = el('div.dk-grid', null, KEYS.map((k) => el('button.dk-key', { dataset: { k }, 'aria-label': k === '*' ? '지우기' : k === '#' ? '확인' : k },
      el('b', null, k === '*' ? '✱' : k === '#' ? '#' : k), k === '*' ? el('small', null, '지우기') : k === '#' ? el('small', null, '확인') : null)));
    const panel = el('div.dk-panel');
    const img = el('img.dk-img', { alt: '', draggable: 'false' });
    const inner = el('div.dk-inner', null, img, panel, lcd, grid);
    const plate = el('div.dk-plate', null, inner);
    const cr = KP.crop;
    Object.assign(inner.style, { width: 100 / cr.w + '%', height: 100 / cr.h + '%', left: (-cr.x / cr.w) * 100 + '%', top: (-cr.y / cr.h) * 100 + '%' });
    plate.style.aspectRatio = String((cr.w * 1024) / (cr.h * 1536));
    box(panel, KP.panel); box(lcd, KP.lcd); box(grid, KP.grid);
    img.onload = () => plate.classList.add('has-img');
    img.onerror = () => img.remove();
    img.src = G.ROOM ? G.ROOM.img('keypad') : 'assets/img/keypad.jpg';

    const bars = el('div.dk-bars', null, el('div.dk-bars-in'));
    const pitchBtn = el('button.dk-pitch', { 'aria-pressed': 'false' }, el('span.dk-pitch-ic', { html: '<svg viewBox="0 0 24 24"><path d="M4 18V12M9 18V6M14 18V9M19 18V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' }), '음높이 보기');
    const status = el('div.dk-status');
    const back = el('button.cu-back', { 'aria-label': '돌아가기', html: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' });
    const flashEl = el('div.dk-alarm');
    const node = el('div.closeup.dk', null,
      el('div.cu-top', null, back, el('div.cu-title', null, '도어락'), el('span.dk-sp'), pitchBtn),
      el('div.dk-body', null, plate, bars),
      el('div.dk-foot', null, status),
      flashEl);
    const ov = G.phone.overlay(node, { onBack: () => close() });
    back.addEventListener('click', () => close());

    function close() {
      if (!inst) return;
      inst = null;
      document.removeEventListener('keydown', onKey);
      clearInterval(lockTicker);
      ov.close();
      sfx('back');
      G.bus.emit('door:keypad-close');
    }

    /* ---------- display ---------- */
    function render() {
      slots.querySelectorAll('i').forEach((s, i) => { s.textContent = buf[i] || ''; s.classList.toggle('on', i < buf.length); });
    }
    let msgTimer = 0;
    function msg(text, cls, ms) {
      clearTimeout(msgTimer);
      lcdMsg.textContent = text; lcd.className = 'dk-lcd' + (cls ? ' ' + cls : '');
      if (ms) msgTimer = setTimeout(() => { lcdMsg.textContent = ''; lcd.className = 'dk-lcd'; }, ms);
    }
    function setStatus(t) { status.textContent = T(t || ''); }
    function defaultStatus() {
      if (G.flag('M7') && !G.flag('M8')) return '';
      if (G.flag('M6')) return '보안 모드 · 외부 비밀번호 입력 차단 · 실내 입력 가능';
      return '원격 관리자 잠금 · 해솔홈';
    }
    setStatus(defaultStatus());

    /* ---------- pitch bars (same scale as the recorder's bars: C5..E6) ---------- */
    function setPitch(on) {
      vars.pitchView = !!on; G.save();
      pitchBtn.classList.toggle('on', !!on); pitchBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      node.classList.toggle('pitch-on', !!on);
      G.bus.emit('pitchView', !!on);
    }
    pitchBtn.addEventListener('click', () => { sfx('tap'); setPitch(!vars.pitchView); });
    setPitch(!!vars.pitchView);
    const lo = Math.log2(HZ['1']), hi = Math.log2(HZ['0']);
    function pitchBar(k) {
      const f = HZ[k]; if (!f) return;
      const h = 12 + 88 * ((Math.log2(f) - lo) / (hi - lo));
      const b = el('i', { style: { height: h + '%' } }, el('span', null, k));
      const inner = bars.firstChild;
      inner.appendChild(b);
      while (inner.children.length > 8) inner.firstChild.remove();
      requestAnimationFrame(() => b.classList.add('in'));
    }

    /* ---------- lockout ---------- */
    let lockTicker = 0;
    function lockedLeft() { return Math.max(0, Math.ceil(((vars.doorLockUntil || 0) - Date.now()) / 1000)); }
    function showLock() {
      clearInterval(lockTicker);
      const tick = () => {
        const s = lockedLeft();
        if (!s) { clearInterval(lockTicker); msg('', ''); node.classList.remove('locked'); setStatus(defaultStatus()); return; }
        node.classList.add('locked');
        msg(`입력 제한 ${s}초`, 'err');
        setStatus('잘못된 비밀번호를 5회 입력했습니다. 잠시 후 다시 시도하세요.');
      };
      tick(); lockTicker = setInterval(tick, 500);
    }
    if (lockedLeft()) showLock();

    /* ---------- input ---------- */
    function press(k) {
      if (!inst || busy) return;
      const btn = grid.querySelector(`[data-k="${k}"]`);
      if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
      if (lockedLeft()) { sfx('doorlockBeep'); return; }
      if (k === '*') { sfx('doorlockBeep'); buf = ''; star = true; render(); msg('', ''); clearTimeout(nudgeT); return; }
      if (k === '#') { sfx('doorlockBeep'); confirm(); return; }
      keyTone(k);
      if (vars.pitchView) pitchBar(k);
      if (buf.length >= 6) buf = buf.slice(1);
      buf += k; render();
      // six digits and no 확인: real locks need '#' — nudge once the player pauses
      clearTimeout(nudgeT);
      if (buf.length === 6) nudgeT = setTimeout(() => { if (inst && buf.length === 6 && !busy && !lockedLeft()) setStatus('# (확인)을 눌러 입력을 마치세요'); }, 2500);
      G.bus.emit('door:key', k);
      // H1: 4 then 7 within 4 s, after the 소리 감지 녹음 was played
      const now = Date.now();
      if (k === '7' && last.k === '4' && now - last.t < 4000 && G.flag('doorlockHeard') && !G.flag('frag47')) {
        setTimeout(() => {
          if (G.foundFragment) G.foundFragment('47');
          G.fx && G.fx.sub('…녹음 속 소리랑 똑같다. 파, 시.', 3200);
          note('녹음 속 두 번의 삑 = 4, 7');
        }, 350);
      }
      last = { k, t: now };
    }
    D.press = press;
    D.enter = (s) => { String(s).split('').forEach((c, i) => setTimeout(() => press(c), i * 160)); };

    async function confirm() {
      const code = buf, wasStar = star;
      clearTimeout(nudgeT); setStatus(defaultStatus());
      buf = ''; star = false; render();
      if (!code) { msg('', ''); return; }
      if (wasStar && code === '0404') return trap();
      if (code === CODE) return G.flag('M6') ? accept() : adminRelock();
      if (code === '4729') {
        busy = true;
        await sleep(250); sfx('doorlockError'); msg('오류', 'err', 1400);
        await sleep(700);
        G.fx && G.fx.sub(T('…두 자리가 더 있어.'), 2600);
        note('4 7 2 9 … 두 자리가 더 있어.');
        busy = false;
        return;
      }
      return wrong();
    }

    async function wrong() {
      busy = true;
      await sleep(200);
      sfx('doorlockError');
      msg('비밀번호 오류', 'err', 1500);
      node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake');
      vars.doorWrong = (vars.doorWrong || 0) + 1; G.save();
      G.bus.emit('door:wrong', vars.doorWrong);
      setTimeout(() => {
        sfx('knock', 1, { az: 270, where: 'inside' });
        G.room && G.room.dirSub ? G.room.dirSub('(옷장 안에서… 똑.)', 270, 2000) : null;
      }, 1100);
      await sleep(600);
      busy = false;
      if (vars.doorWrong % 5 === 0) { vars.doorLockUntil = Date.now() + 20000; G.save(); showLock(); }
    }

    async function trap() {
      busy = true;
      G.flag('trap0404', true);
      G.bus.emit('door:trap');
      msg('경보', 'alarm');
      setStatus('침입 경보');
      sfx('alarmTrap', 3);
      const reduce = (G.settings && (G.settings.reduceFlash || G.settings.flashes === 'low')) || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      flashEl.classList.add(reduce ? 'slow' : 'on');
      G.audio && G.audio.sfx.buzz && G.audio.sfx.buzz([300, 200, 300, 200, 300]);
      await sleep(3100);
      flashEl.classList.remove('on', 'slow');
      msg('', ''); setStatus(defaultStatus());
      await sleep(900);
      sfx('knock', 3, { az: 270, where: 'inside', gap: 1.15 });
      G.room && G.room.dirSub ? G.room.dirSub('(옷장 안에서… 똑. 똑. 똑.)', 270, 3200) : null;
      busy = false;
      if (!G.flag('M5') && !G.flag('trapReplied')) {
        G.flag('trapReplied', true);
        setTimeout(() => {
          if (G.chat && G.chat.push) G.chat.push('talk', 'manager', { from: 'them', text: '그 번호 아니에요 ^^ 다시 알아볼게요' }, { tone: 'friend' });
        }, 4200);
      }
      if (!G.flag('managerExposed')) { G.flag('managerExposed', true); }
      note('관리실이 알려준 *0404#… 경보가 울렸다. 관리실 = 그 사람?');
    }

    async function adminRelock() {
      busy = true;
      await sleep(180);
      sfx('doorlockOpen');
      msg('열림', 'ok');
      await sleep(900);
      sfx('doorlockAdmin');
      msg('관리자 잠금 재설정', 'err');
      setStatus('관리자 잠금 재설정 (SM-G991N)');
      node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake');
      G.bus.emit('door:relock');
      await sleep(1500);
      if (G.mirroring && G.mirroring()) {
        if (G.chat && G.chat.push) G.chat.push('talk', 'haru', { from: 'them', text: 'ㅋ' }, { tone: himTone() });
      } else {
        sfx('knock', 1, { az: 270, where: 'inside' });
        G.room && G.room.dirSub ? G.room.dirSub('(옷장 안에서… 똑.)', 270, 2000) : null;
      }
      note('그 사람을 먼저 끊어야 해.');
      G.flag('codeKnown', true);
      await sleep(1200);
      msg('', ''); setStatus(defaultStatus());
      busy = false;
    }

    async function accept() {
      busy = true;
      await sleep(150);
      sfx('doorlockOpen');
      msg('열림', 'ok');
      node.classList.add('open');
      G.flag('codeKnown', true);
      await sleep(1100);
      close();
      if (G.hooks && G.hooks.has && G.hooks.has('door:codeAccepted')) G.hooks.call('door:codeAccepted');
      else if (G.climax && G.climax.codeAccepted) G.climax.codeAccepted();
    }

    grid.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.dk-key'); if (!b) return;
      e.preventDefault();
      press(b.dataset.k);
    });
    const onKey = (e) => {
      if (!inst || ov.node.nextElementSibling) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === '*' || e.key === 'Backspace' || e.key === 'Delete') press('*');
      else if (e.key === '#' || e.key === 'Enter') press('#');
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);

    inst = { node, close, press };
    render();
    G.bus.emit('door:keypad');
    if (!G.state.seen.keypadIntro) {
      G.state.seen.keypadIntro = true; G.save();
      setTimeout(() => { if (inst && G.fx) G.fx.sub('버튼마다 소리 높이가 다르다.', 2400); }, 700);
    }
    return inst;
  };
  D.close = () => { if (inst) inst.close(); };

  G.hooks && G.hooks.set('door:keypad', () => D.open());
})();
