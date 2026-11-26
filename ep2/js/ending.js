/* =========================================================
 * ep2/js/ending.js (flow) — M8 → END → tail → credits → check card (DESIGN_EP2 §3.17 · §3.18 · §3.19 · §4.10 ·
 * §6.2 B20/B21/B22/W07/B21′ · ARCH §3.2 flow · §4.19). v1.3 order (§0.1 #20): before END only what commit needs
 * ('—' chip → e2_dash, photo ① + near share → seen.e2_hangyeol, phone chip → e2_phone); after END:
 * jimin tail → mom (02:05) → {MAKER} (02:12) → Kang's wrap (02:15) → letter (02:20) → credits (02:30) → check card.
 *
 * B20 (sched 'end:m8' = pm(M7) + 72 000): boots.snow 55° → 0° → 1.5 s → flag M8 + v2_kang_door + S18 + door-gap torch
 *   → voice end + 1.5 s → G.room.forceView({view:'r2_door', handle:true}) → handle: doorlock.open + S26 + doorOpen(6000)
 *   + lightsOn + switch.click + doorlock.close (soft) → doorOpened, peepholeTaped off, footprints 2, bt.retire(),
 *   room601 warm → card k0110 → [계속] → G.users.forceN() if '—' (or a lock is still up) → C1: card aside, clock 01:12,
 *   {MAKER}'s K banners (moment.js, on end:step k0110) → 01:20 …
 * Cards: layer `.fl2-card` (z 150). It is HIDDEN while shell/media UIs it calls are up (lockDash, nearShare, gallery
 * receive) and shown again when they resolve. Back / Esc are consumed while a card is up (G.phone.pushBack).
 * END: hook 'end:reached' ({right}) — called by social at the exact moment `…{N} 씨구나.` / `…괜찮아요. 형사님이 {N} 씨
 *   맞대요.` is appended → answeredRight (if right), stage e2_jimin, flag END, G.e2.commit().
 *
 * API: G.ending = { init(), resume(step), debugM8() }
 * Flags set: M8 doorOpened peepholeTaped(off) dashChoiceDone pol1Shown nearbyTaken phoneChoiceDone jiminReturn
 *            answeredRight kangWrapDone END · vars: endStep, footprints(2) · stage (via G.e2.stage): e2_dash e2_phone e2_jimin
 * Bus out: 'end:step' {step}. Sched: 'end:m8'. Hooks set: 'end:reached'. data-qa: card.continue card.chip:<id>
 *   credits.skip check.continue.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const EN = (G.ending = G.ending || {});

  /* ---------- local helpers ---------- */
  function el(tag, attrs, ...kids) {
    if (G.util && G.util.el) return G.util.el(tag, attrs, ...kids);
    const n = document.createElement('div'); n.className = String(tag).split('.').slice(1).join(' '); kids.flat().forEach((k) => k != null && n.append(k)); return n;
  }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[ending]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n, v) { try { G.flag(n, v === undefined ? true : v); } catch (e) { console.error('[ending] flag', n, e); } }
  function vget(k) { try { return G.vars ? G.vars(k) : G.state.vars[k]; } catch (e) { return undefined; } }
  function vset(k, val) { try { if (G.vars) G.vars(k, val); else G.state.vars[k] = val; } catch (e) {} }
  function D() { return (G.STORY && G.STORY.ending) || {}; }
  function running() { try { return G.clock && G.clock.running ? !!G.clock.running() : !document.hidden; } catch (e) { return !document.hidden; } }
  function wait(ms) {   // counts only while the game runs (pause menu / hidden tab stop it)
    return new Promise((res) => {
      let left = ms, last = performance.now();
      const step = () => { const now = performance.now(); if (running()) left -= Math.min(250, now - last); last = now; if (left <= 0) res(); else setTimeout(step, Math.min(120, Math.max(16, left))); };
      setTimeout(step, Math.min(120, Math.max(16, ms)));
    });
  }
  const gap = () => wait(800 + Math.random() * 700);   // 0.8–1.5 s between lines (§4.10 card format)
  function cue(id, o) { return safe(() => (G.audio && G.audio.cue ? G.audio.cue(id, o || {}) : undefined)); }
  function sub(id, o) { safe(() => { if (G.audio && G.audio.sub) G.audio.sub(id, o || {}); }); }
  function amb(id, on, o) { safe(() => { if (G.audio && G.audio.amb) G.audio.amb(id, on, o || {}); }); }
  function mark(id) { safe(() => { if (G.director && G.director.mark) G.director.mark(id); }); }
  function jump(hm) { safe(() => { if (G.clock && G.clock.jump) G.clock.jump(hm); }); }
  function stage(k, v) { safe(() => { if (G.e2 && G.e2.stage) G.e2.stage(k, v); else if (G.state && G.state.stage) { G.state.stage[k] = v; G.save && G.save(); } }); }
  function setStep(step) { vset('endStep', step); safe(() => G.save && G.save(true)); safe(() => G.bus && G.bus.emit('end:step', { step })); }
  function img(key) { return safe(() => (G.e2 && G.e2.img ? G.e2.img(key) : (G.IMG && G.IMG[key]) || ''), ''); }
  function user() { return safe(() => (G.users && G.users.current ? G.users.current() : 'n'), 'n'); }
  function screenEl() { return document.getElementById('screen'); }
  function lockShown() { return safe(() => (G.lock && G.lock.isShown ? !!G.lock.isShown() : !!document.querySelector('#lock:not(.hidden)')), false); }
  function forceN() { return safe(() => (G.users && G.users.forceN ? G.users.forceN() : null), null); }
  function online() { return safe(() => { const w = G.phone && G.phone.wifi; return !(w && w.connected && !w.connected()); }, true); }
  /** social's persisted thread (read only): has line `id` reached G.state.threads['moment:<thread>']? */
  function hasLine(thread, id) { return safe(() => (((G.state && G.state.threads) || {})['moment:' + thread] || []).some((e) => e && e.id === id), false); }

  /* ---------- the card layer (z 150) ---------- */
  const Card = {
    root: null, inner: null, body: null, foot: null, removeBack: null, lastSpk: null,
    open(step, time) {
      // the in-game keyboard (z 450) sits above the card layer (z 150): a card always takes the screen without it
      safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
      if (!this.root) {
        this.body = el('div.fl2-cbody');
        this.foot = el('div.fl2-cfoot');
        this.inner = el('div.fl2-cin', null, this.body);
        this.root = el('div.fl2-card', { role: 'dialog', 'aria-live': 'polite' }, this.inner, this.foot);
        screenEl().appendChild(this.root);
        requestAnimationFrame(() => this.root && this.root.classList.add('in'));
        // back / Esc are consumed while a card is visible; while the layer is hidden (lockDash, near share, received
        // viewer are up) they pass through to those screens
        this.removeBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => !!(Card.root && !Card.root.classList.contains('hidden-layer'))) : null), null);
      }
      this.root.dataset.step = step || '';
      this.root.classList.remove('hidden-layer');
      this.body.innerHTML = ''; this.foot.innerHTML = ''; this.lastSpk = null;
      if (time) this.body.appendChild(el('div.fl2-ctime', null, time));
      return this;
    },
    scroll() { const b = this.inner; if (b) requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; }); },
    add(node) { if (!this.body) return node; this.body.appendChild(node); requestAnimationFrame(() => node.classList.add('in')); this.scroll(); return node; },
    scene(text) { this.lastSpk = null; return this.add(el('p.fl2-cscene', null, T(text))); },
    say(text, who) {
      who = who || D().kang || '강수진';
      if (this.lastSpk !== who) { this.add(el('div.fl2-cspk', null, who)); this.lastSpk = who; }
      return this.add(el('div.fl2-cline', null, T(text)));
    },
    me(text) { this.lastSpk = null; return this.add(el('div.fl2-cme', null, T(text))); },
    picture(key) {
      const src = img(key);
      const fig = el('div.fl2-cimg');
      if (src) { const im = el('img', { src, alt: '' }); im.addEventListener('error', () => fig.classList.add('noimg')); fig.appendChild(im); } else fig.classList.add('noimg');
      return this.add(fig);
    },
    chips(list) {
      return new Promise((res) => {
        this.foot.innerHTML = '';
        const row = el('div.fl2-chips');
        list.forEach((c) => {
          const b = el('button.fl2-chip', { 'data-qa': 'card.chip:' + c.id }, T(c.label));
          b.addEventListener('click', () => { if (row._done) return; row._done = true; safe(() => G.audio && G.audio.sfx && G.audio.sfx.tap && G.audio.sfx.tap()); this.foot.innerHTML = ''; res(c); });
          row.appendChild(b);
        });
        this.foot.appendChild(row);
        requestAnimationFrame(() => row.classList.add('in'));
      });
    },
    next() {
      return new Promise((res) => {
        this.foot.innerHTML = '';
        const b = el('button.fl2-next', { 'data-qa': 'card.continue' }, D().next || '계속');
        b.addEventListener('click', () => { if (b._done) return; b._done = true; safe(() => G.audio && G.audio.sfx && G.audio.sfx.tap && G.audio.sfx.tap()); this.foot.innerHTML = ''; res(); });
        this.foot.appendChild(b);
        requestAnimationFrame(() => b.classList.add('in'));
      });
    },
    hide() { if (this.root) this.root.classList.add('hidden-layer'); },
    show() { safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard()); if (this.root) this.root.classList.remove('hidden-layer'); },
    async close() {
      const r = this.root; if (!r) return;
      this.root = null; this.inner = null; this.body = null; this.foot = null;
      if (typeof this.removeBack === 'function') safe(this.removeBack); this.removeBack = null;
      r.classList.remove('in'); r.classList.add('out');
      await new Promise((res) => setTimeout(res, 420));
      r.remove();
    },
  };
  async function lines(card, arr) { for (const t of arr || []) { await gap(); card.say(t); } }

  /* ---------- B20 / M8 (§3.17 01:10 · §6.2 B20) ---------- */
  let m8Running = false;
  async function m8Sequence() {
    if (m8Running || flag('doorOpened')) return;
    m8Running = true;
    try {
      if (!flag('M8')) {
        mark('B20');
        cue('boots.snow', { n: 8, from: { az: 55, dist: 7 }, to: { az: 0, dist: 1 }, slow: true, dur: 5 });
        await wait(5200);
        await wait(1500);
        setFlag('M8');
        safe(() => G.room && G.room.doorGap && G.room.doorGap('torch'));
        sub('S18', { az: 0 });
        await new Promise((res) => {
          let done = false; const fin = () => { if (!done) { done = true; res(); } };
          const h = safe(() => (G.audio && G.audio.playVoice ? G.audio.playVoice('v2_kang_door', { az: 0, dist: 0.5, via: 'door', onEnd: fin }) : null), null);
          wait(h ? 7000 : 4600).then(fin);      // TTS missing → subtitles only, same pacing (§4.9.1 실패 대비)
        });
        await wait(1500);
      }
      await doorView();
    } finally { m8Running = false; }
  }
  async function doorView() {
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    safe(() => G.phone && G.phone.dismissModals && G.phone.dismissModals());
    safe(() => G.room && G.room.doorGap && G.room.doorGap('torch'));
    if (G.room && G.room.forceView) {
      await safe(() => G.room.forceView({ view: 'r2_door', handle: true }), Promise.resolve());
    } else console.warn('[ending] G.room.forceView missing — door opens without the eye view (partial build)');
    await openDoor();
  }
  async function openDoor() {
    if (flag('doorOpened')) return runFrom(vget('endStep') || null);
    cue('doorlock.open'); sub('S26');
    safe(() => G.audio && G.audio.doorOpen && G.audio.doorOpen(6000));
    await wait(700);
    safe(() => G.room && G.room.lightsOn && G.room.lightsOn());
    cue('switch.click', { az: 0, dist: 1 });
    amb('room601', true, { warm: true });
    setFlag('doorOpened');
    setFlag('peepholeTaped', false);
    vset('footprints', 2);
    safe(() => G.media && G.media.bt && G.media.bt.retire && G.media.bt.retire());
    safe(() => G.room && G.room.doorGap && G.room.doorGap(null));
    wait(5300).then(() => cue('doorlock.close', { soft: true }));
    await wait(900);
    await runFrom(null);
  }

  /* ---------- the card steps ---------- */
  async function k0110() {
    const d = D().k0110 || {};
    const c = Card.open('k0110', d.time);
    for (const s of d.scene || []) { await wait(400); c.scene(s); }
    await c.next();
    setStep('k0110');
    // from here to END the user is {N}, on the home, never behind the lock screen (§3.17 · §9.2): '—' → the 2 s shell;
    // a lock still up under the door view (reload at the door, a lock before M8) goes without the shell (forceN on {N})
    if (user() === 'dash') { await Card.close(); await forceN(); }
    else if (lockShown()) await forceN();
  }
  /** C1 only — {MAKER}'s K lines `형사님 올라가셨어` / `나 여기 있어`, stamped 오전 1:12, come after the door opens and before
   *  the 01:20 card (§4.10.1 · §12.9 #13). moment.js lets them go on end:step 'k0110' once the user is {N} (or when the
   *  clock passes 01:12). Banners sit under the card layer (#banners z 70 < .fl2-card z 150) and the status bar there still
   *  reads 01:10, so the card steps aside, the clock moves to 01:12 and the 01:20 card waits for the second line (≤ 5 s,
   *  then 1.6 s to read it). Offline the lines stay queued with their 1:12 stamp (§5.6) — no wait then. Resume-safe. */
  async function kBeat() {
    if (!flag('C1') || hasLine('real', 'cK2') || !online()) return;
    await Card.close();
    jump('01:12');
    await new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; if (off) safe(off); res(); };
      const off = G.bus ? G.bus.on('chat:msg', (e) => { if (e && e.thread === 'real' && e.msg && e.msg.id === 'cK2') fin(); }) : null;
      if (hasLine('real', 'cK2')) fin();
      wait(5000).then(fin);
    });
    await wait(1600);
  }
  async function k0120() {
    const d = D().k0120 || {};
    await kBeat();
    jump('01:20'); mark('B21');
    const c = Card.open('k0120', d.time);
    await lines(c, d.lines);
    await wait(500);
    const chip = await c.chips(d.chips || []);
    c.me(chip.label);
    if (chip.lockDash) {
      c.hide();
      await safe(() => (G.users && G.users.lockDash ? G.users.lockDash() : G.hooks && G.hooks.has && G.hooks.has('users:lockDash') ? G.hooks.call('users:lockDash') : null), null);
      c.show();
    }
    if (chip.stage) stage(chip.stage[0], chip.stage[1]);
    setFlag('dashChoiceDone');
    await lines(c, chip.reply);
    await wait(500);
    await c.next();
    setStep('k0120');
  }
  async function k0140() {
    const d = D().k0140 || {};
    jump('01:40');
    const c = Card.open('k0140', d.time);
    for (const s of d.scene || []) { await wait(400); c.scene(s); }
    await gap(); c.picture(d.img || 'pol_case');
    const ls = d.lines || [];
    await gap(); if (ls[0]) c.say(ls[0]);
    setFlag('pol1Shown');
    for (const t of ls.slice(1)) { await gap(); c.say(t); }
    await wait(500);
    await c.next();
    c.hide();
    const share = d.share || { from: '강수진의 휴대전화', count: 4 };
    let r = 'decline';
    if (G.phone && G.phone.nearShare) r = await safe(() => G.phone.nearShare({ from: share.from, count: share.count }), 'decline');
    else console.warn('[ending] G.phone.nearShare missing');
    if (r === 'accept') {
      setFlag('nearbyTaken');
      await safe(() => (G.gallery && G.gallery.receive ? G.gallery.receive() : G.hooks && G.hooks.has && G.hooks.has('gallery:receive') ? G.hooks.call('gallery:receive') : null), null);
      setStep('k0140');
      return;
    }
    c.show();
    await lines(c, d.declined || ['알겠어요.']);
    await wait(400);
    await c.next();
    setStep('k0140');
  }
  async function k0150() {
    const d = D().k0150 || {};
    jump('01:50');
    const c = Card.open('k0150', d.time);
    await lines(c, d.lines);
    await wait(500);
    const chip = await c.chips(d.chips || []);
    c.me(chip.label);
    if (chip.stage) stage(chip.stage[0], chip.stage[1]);
    setFlag('phoneChoiceDone');
    await lines(c, d.after);
    const wifi = G.phone && G.phone.wifi;
    const needWifi = !!(wifi && wifi.connected && !safe(() => wifi.connected(), true));
    if (needWifi) { await gap(); c.say(d.wifi || '와이파이는 켜 둘게요.'); safe(() => wifi.restore && wifi.restore()); }
    for (const s of d.out || []) { await gap(); c.scene(s); }
    await wait(500);
    await c.next();
    setStep('k0150');
    await Card.close();
  }
  function waitClock(hm, maxMs) {
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; off && off(); res(); };
      const passed = () => safe(() => (G.clock && G.clock.passed ? G.clock.passed(hm) : false), false);
      if (passed()) return fin();
      const off = G.bus ? G.bus.on('clock:min', () => { if (passed()) fin(); }) : null;
      wait(maxMs).then(fin);
    });
  }
  let endResolve = null;
  const endReached = () => (flag('END') ? Promise.resolve() : new Promise((res) => { endResolve = res; }));
  async function j0200() {
    if (!flag('jiminReturn')) {
      safe(() => G.clock && G.clock.run && G.clock.run(1.5, '02:00'));
      await waitClock('02:00', 16000);
      jump('02:00');
      setFlag('jiminReturn');
      mark('B22');
      safe(() => G.phone && G.phone.notify && G.phone.notify({ id: 'N16', app: 'moment', chat: 'jimin_0412', title: 'jimin_0412', body: '{N} 씨.', user: 'n',
        route: { app: 'moment', params: { thread: 'jimin_0412' } } }));
      safe(() => G.moment && G.moment.play && G.moment.play('j0200'));
    }
    await endReached();
  }
  function onEndReached(o) {
    if (flag('END')) { if (endResolve) { endResolve(); endResolve = null; } return; }
    const right = !!(o && o.right);
    if (right) setFlag('answeredRight');
    stage('e2_jimin', right);
    setFlag('END');
    setStep('j0200');
    safe(() => G.e2 && G.e2.commit && G.e2.commit());
    if (endResolve) { endResolve(); endResolve = null; }
  }
  async function play(id) {
    if (!(G.moment && G.moment.play)) { console.warn('[ending] G.moment.play missing:', id); return null; }
    return safe(() => G.moment.play(id), null);
  }
  async function j0205(resumed) {
    await wait(resumed ? 600 : 1800);
    // always through MO.play: 'done' resolves at once, a running tail (reload mid-exchange — chip jTail pending) waits on
    // its persisted queue, a tail never started (reload right after END) starts now → jT1–jT4 exactly once (§9.2)
    await play('jTail');
    await wait(1200);
    jump('02:05'); mark('W07');
    await play('j0205');
    await wait(1500);
    setStep('j0205');
  }
  async function m0212() {
    const d = D().k0212 || {};
    jump('02:12');
    const c1 = flag('C1');
    if (c1) { await play('m0212'); await wait(1200); }
    cue('steps.stairs', { az: 55 });
    const c = Card.open('k0212', d.time);
    for (const s of (c1 ? d.c1 : d.noC1) || []) { await wait(500); c.scene(s); }
    await wait(600);
    await c.next();
    setStep('m0212');
  }
  async function k0215() {
    const d = D().k0215 || {};
    jump('02:15'); mark('B21p');
    const c = Card.open('k0215', d.time);
    for (const s of d.scene || []) { await wait(400); c.scene(s); }
    const arr = typeof d.lines === 'function' ? safe(() => d.lines(flag, vget), []) : d.lines || [];
    await lines(c, arr);
    await wait(700);
    await c.next();
    setFlag('kangWrapDone');
    setStep('k0215');
  }
  async function l0220() {
    const letter = (window.CONFIG && window.CONFIG.LETTERS && window.CONFIG.LETTERS.ep2) || '';
    if (!String(letter).trim()) { setStep('l0220'); return; }
    const d = D().l0220 || {};
    jump('02:20');
    const c = Card.open('l0220', d.time);
    c.root.classList.add('letter');
    c.add(el('div.fl2-letter', null, el('div.fl2-letter-head', null, T(d.head || '{MAKER}의 편지')), el('div.fl2-letter-text', null, String(letter))));
    await wait(1200);
    await c.next();
    setStep('l0220');
  }
  async function credits() {
    await Card.close();
    const d = D().credits || {};
    jump('02:30');
    safe(() => G.notebook && G.notebook.close && G.notebook.close());
    safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
    amb('room601', false, { fade: 4 }); amb('tank', false, { fade: 4 }); amb('cityFar', false, { fade: 4 });
    amb('roofWind', true, { gainDb: -18, fade: 4 });
    const mins = Math.round(((G.state && G.state.playMs) || 0) / 60000);
    const stats = String(d.stats || '플레이 {m}분 · 힌트 {n}회').replace('{m}', mins).replace('{n}', (G.state && G.state.hintsUsed) || 0);
    // two block lines like the title screen — `{N를} 위한 방탈출! 2` / `돌려줄게` — so no line ever starts or ends with the
    // '·' (the full string is wider than a 360 px phone at 100 %). Line 1 keeps '방탈출! 2' together (no lone '2').
    const ttl = String(T(d.title || '{N를} 위한 방탈출! 2 · 돌려줄게'));
    const cut = ttl.lastIndexOf(' · ');
    const glue = (s) => s.replace(/ (\S{1,3})$/, '\u00a0$1');
    const titleNode = cut > 0
      ? el('div.fl2-cred-title', null,
        el('span.fl2-cred-l1', null, glue(ttl.slice(0, cut))), el('span.fl2-cred-l2', null, ttl.slice(cut + 3)))
      : el('div.fl2-cred-title', null, glue(ttl));
    const scr = el('div.fl2-scene.fl2-credits', { 'data-qa': 'credits.skip', role: 'button' },
      el('div.fl2-cred-in', null,
        titleNode,
        el('p.fl2-cred-maker', null, T(d.maker || '만든 사람 {MAKER} · {N}에게')),
        el('p.dim', null, d.voice || ''),
        el('p.small', null, stats),
        el('p.dim', null, d.data || '')));
    screenEl().appendChild(scr);
    requestAnimationFrame(() => scr.classList.add('in'));
    const rb = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => true) : null), null);
    await wait(1600);
    cue('piano.two'); sub('S25');
    await new Promise((res) => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      scr.addEventListener('click', fin);
      wait(d.ms || 20000).then(fin);
    });
    setStep('cred');
    if (typeof rb === 'function') safe(rb);
    scr.classList.remove('in'); scr.classList.add('out');
    setTimeout(() => scr.remove(), 700);
  }
  /** check-card line. One with ' · ' (the help line `스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366`) is built as
   *  nowrap parts joined by separator spans, so each number stays with its label; the data string is unchanged. */
  function checkLine(text) {
    const s = String(text);
    const parts = s.split(' · ');
    if (parts.length < 2) return el('p', null, s);
    const p = el('p.fl2-check-help');
    parts.forEach((x, i) => {
      if (i) p.appendChild(el('span.fl2-sep', null, ' · '));
      p.appendChild(el('span.fl2-nw', null, x));
    });
    return p;
  }
  /** a part that no longer fits after its separator starts its own line and that separator goes (never `…112 ·` / a line
   *  opening with '·'); a part wider than the whole line may wrap inside (very large text). Re-entrant: resets first. */
  function fitCheckLine(p) {
    if (!p || !p.isConnected) return;
    const parts = Array.from(p.querySelectorAll('.fl2-nw')), seps = Array.from(p.querySelectorAll('.fl2-sep'));
    seps.forEach((x) => { x.hidden = false; });
    parts.forEach((x) => x.classList.remove('own', 'wrap'));
    const w = p.clientWidth;
    if (!w) return;
    parts.forEach((x) => { if (x.getBoundingClientRect().width > w + 0.5) x.classList.add('wrap'); });
    for (let i = 1; i < parts.length; i++) {
      const prev = parts[i - 1].getClientRects(), cur = parts[i].getClientRects();
      if (!prev.length || !cur.length) continue;
      if (cur[0].top > prev[prev.length - 1].top + 2) { seps[i - 1].hidden = true; parts[i].classList.add('own'); }
    }
  }
  async function check() {
    const arr = D().check || [];
    const nxt = el('button.fl2-next.fl2-check-next', { 'data-qa': 'check.continue' }, D().next || '계속');
    const scr = el('div.fl2-scene.fl2-check', null, el('div.fl2-check-in', null, arr.map((t) => checkLine(T(t)))), nxt);
    screenEl().appendChild(scr);
    requestAnimationFrame(() => scr.classList.add('in'));
    // the help line is laid out once the card has a size, again when the web font lands / the text size or viewport changes
    const fit = () => scr.querySelectorAll('p.fl2-check-help').forEach(fitCheckLine);
    requestAnimationFrame(() => requestAnimationFrame(fit));
    safe(() => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(fit)); });
    window.addEventListener('resize', fit);
    const offSettings = G.bus ? G.bus.on('settings', () => requestAnimationFrame(fit)) : null;
    const rb = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => true) : null), null);
    const tapped = new Promise((res) => nxt.addEventListener('click', () => { safe(() => G.audio.sfx.tap()); res(); }, { once: true }));
    await wait(1200);
    nxt.classList.add('in');
    await tapped;
    window.removeEventListener('resize', fit);
    if (typeof offSettings === 'function') safe(offSettings);
    setStep('check');
    if (typeof rb === 'function') safe(rb);
    scr.classList.add('fade-black');
    setTimeout(() => scr.remove(), 900);
  }

  /* ---------- the chain ---------- */
  const ORDER = ['k0110', 'k0120', 'k0140', 'k0150', 'j0200', 'j0205', 'm0212', 'k0215', 'l0220', 'cred', 'check', 'hook'];
  let chainRunning = false;
  async function runFrom(after, opts) {
    if (chainRunning) return;
    chainRunning = true;
    opts = opts || {};
    try {
      let i = after ? ORDER.indexOf(after) + 1 : 0;
      if (i < 0) i = 0;
      // END already happened (resume) → straight to j0205: the jimin tail (resumed once through MO.play), then 02:05 …
      // (§6.1.8 'END 뒤 · 훅 전' · §9.2 'END ∧ ¬HOOK')
      if (flag('END') && i <= ORDER.indexOf('j0200')) { i = ORDER.indexOf('j0205'); opts.resumedTail = true; }
      for (; i < ORDER.length; i++) {
        const s = ORDER[i];
        if (s === 'k0110') await k0110();
        else if (s === 'k0120') await k0120();
        else if (s === 'k0140') await k0140();
        else if (s === 'k0150') await k0150();
        else if (s === 'j0200') { await Card.close(); await j0200(); }
        else if (s === 'j0205') { await Card.close(); await j0205(!!opts.resumedTail); }
        else if (s === 'm0212') await m0212();
        else if (s === 'k0215') await k0215();
        else if (s === 'l0220') await l0220();
        else if (s === 'cred') await credits();
        else if (s === 'check') await check();
        else if (s === 'hook') { setStep('hook'); safe(() => G.hook && G.hook.start && G.hook.start()); }
      }
    } catch (e) { console.error('[ending] chain', e); }
    finally { chainRunning = false; }
  }

  /* ---------- init / resume ---------- */
  function scheduleM8() {
    if (flag('M8') || !flag('M7')) return;
    const sc = G.e2 && G.e2.sched; const t = safe(() => (G.pm ? G.pm('M7') : null), null);
    if (!sc || t == null) return;
    if (!safe(() => sc.has('end:m8'), false)) safe(() => sc.at(t + 72000, 'end:m8'));
  }
  EN.init = function () {
    if (EN._inited) return; EN._inited = true;
    safe(() => G.hooks && G.hooks.set && G.hooks.set('end:reached', onEndReached));
    safe(() => G.e2 && G.e2.sched && G.e2.sched.on && G.e2.sched.on('end:m8', () => { m8Sequence(); }));
    if (G.bus) {
      G.bus.on('flag:M7', scheduleM8);
      G.bus.on('flag:END', () => { if (endResolve) { endResolve(); endResolve = null; } });
    }
  };
  /** The chat steps (02:00 question · jimin tail · 02:05 · C1's 02:12 DM) wait on a reply the player sends in 모먼트.
   *  Nothing re-announces them after a reload (no second banner, no tone — ledger §4.8), so the thread the pending step
   *  waits on is brought back on screen through the same route the N16 / N11 banner tap takes (§6.1.8 · §9.2).
   *  Reads social's persisted script states (vars.so.script — read only). */
  function pendingThread(step) {
    const sc = ((vget('so') || {}).script) || {};
    const at = step ? ORDER.indexOf(step) : -1;
    if (flag('jiminReturn') && at < ORDER.indexOf('j0205') && !(sc.jTail === 'done' && sc.j0205 === 'done')) return 'jimin_0412';
    if (at === ORDER.indexOf('j0205') && flag('C1') && sc.m0212 === 'run') return 'real';
    return null;
  }
  function showThread(th) {
    if (!th) return;
    if (safe(() => G.moment && G.moment.isOpen && G.moment.isOpen(th), false)) return;
    if (G.phone && G.phone.route) safe(() => G.phone.route({ app: 'moment', params: { thread: th } }));
    else if (G.moment && G.moment.open) safe(() => G.moment.open({ thread: th }));
  }
  /** resume(step) — ARCH §8.2: M8 ∧ ¬doorOpened → forced door view; doorOpened ∧ ¬END → {N} forced + next card;
   *  END ∧ ¬HOOK → the jimin tail (once — resumed if it was mid-way) → 02:05 … (commit retry is core's).
   *  A pending chat step re-opens its thread after the forced {N} home. `step` = last completed endStep. */
  EN.resume = async function (step) {
    if (!EN._inited) EN.init();
    if (flag('HOOK')) return;
    if (!flag('M8')) { scheduleM8(); return; }
    if (!flag('doorOpened')) { await m8Sequence(); return; }
    if (step === undefined) step = vget('endStep') || null;
    if (step === 'hook') { safe(() => G.hook && G.hook.start && G.hook.start()); return; }
    // doorOpened ∧ ¬HOOK: the user is always {N} from here (shell lands on {N}'s home, no lock screen)
    await safe(() => (G.users && G.users.forceN ? G.users.forceN() : null), null);
    showThread(pendingThread(step));
    await runFrom(step, { resumedTail: flag('END') });
  };
  EN.debugM8 = function () { return m8Sequence(); };
  EN.isCardUp = function () { return !!Card.root; };
})();
