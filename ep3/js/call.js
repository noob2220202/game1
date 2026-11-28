/* =========================================================
 * ep3/js/call.js (flow) — `call` · M1 03:33 set piece B03 · B04 · B05 · B06 (DESIGN_EP3 §3.1 · §4.1.3 · §4.1.4 · §6.2 03:33
 * ledger · §2.1 M1 · §3.22 · ARCH_EP3 §5.13 · §5.20 · §8.2 #11).
 *   sched 'call:pre' at max(pm(M0) + 90 000, pm(momLine1) + 25 000) → t −20 preroll (clock 03:32 · B03: phone.flip / cb.A
 *   glass.set + situation card · eye hotspots off until the handover) → t 0 = M1 + callRing (clock 03:33 via the M1 row) +
 *   G.audio.vibrate('ring3') ONCE (audio drops it when 덜 무섭게) + ring.talk · buzz.table · S01 → 0.4 kongi.sniff → 1.2 eye
 *   c3_phone_ring + E9 easy ring screen (G.easy.ringScreen, phase 'ring') → (card clears ≈2.5 · rings 2–4 over no text) → 4.8 chair → 6.0 callAnswered · ring stops · card ·
 *   0.6 s dissolve to r3_kitchen (엄마's back) · E9 phase 'call' → 6.6 leak.earpiece + v3_mom_call live (speech 7.0 · 9.0 · 11.0 —
 *   S02 S03 S04) → 14.6 S05 · 15.0 card · 18.6 mom.gasp → 39.0 callEnded · talk.end · E9 'ended' 0:33 → 40.5 breath.mom
 *   + 엄마 card → 43.0 clock jump 'callEnd' (03:34) · phone.set · c3_phone_ring `통화 종료 · 0:33` 1.5 s → screen off → ≈50
 *   phone.slide + c3_mom_hands + card → the 03:35 handover cards (gap 1.6 s · tap = next; easyCard / recCard drawn → notebook
 *   cards via vars.fl.cardsDrawn) → B06 sounds (chair · slippers 270° → 30° · door.sr · switch.lamp · kongi.settle) →
 *   handover · G.e3.momAt('sr') · room srGap .25 / srLamp 'dim' · clock jump '03:35' · eye.close(400) → G.lock.show('n').
 *   Every card here goes through core G.cards (G.flow.play); the 03:33 situation cards are tap:false (bound to the timeline).
 * Resume (§3.22 · ARCH §8.3): vars.seq.m1 ∈ pre · ring · call · end · hand (or M1 without handover) → the 03:35 handover cards from
 *   line 1 (the call never rings again); callRing callAnswered callEnded (and M1) are set; clock 03:35.
 * API: G.call = { init(), arm(), resume(), step() → vars.seq.m1, startNow() (DEBUG) }
 * Flags set: M1 callRing callAnswered callEnded handover · vars: seq.m1 · fl.cardsDrawn{recCard, easyCard} · marks B03 B04 B05 B06.
 * Sched: 'call:pre'. Bus listened: flag:momLine1 · flag:M0. No data-qa of its own (cards = core · eye = room · E9 = shell).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const CL = (G.call = G.call || {});

  /* ---------- helpers (G.flow from scenes.js, with tiny stand-ins) ---------- */
  const F = () => G.flow || {};
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[call]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n) { try { G.flag(n, true); } catch (e) { console.error('[call] flag', n, e); } }
  function E() { return G.ep || G.e3 || G.e2 || null; }
  function cb(k) { return safe(() => { const e = E(); return e && e.cb ? e.cb(k) : undefined; }, undefined); }
  function pm() { return (G.state && G.state.playMs) || 0; }
  function pmOf(n) { return safe(() => (G.pm ? G.pm(n) : null), null); }
  function wait(ms) { return F().wait ? F().wait(ms) : new Promise((r) => setTimeout(r, ms)); }
  function cue(id, o) { return safe(() => (G.audio && G.audio.cue ? G.audio.cue(id, o || {}) : undefined)); }
  function sub(id, o) { safe(() => { if (G.audio && G.audio.sub) G.audio.sub(id, o || {}); }); }
  function mark(id) { safe(() => G.director && G.director.mark && G.director.mark(id)); }
  function play(script, opts) { return F().play ? F().play(script, opts) : Promise.resolve({ picks: {}, aborted: false }); }
  function roomSet(k, v, o) { safe(() => G.room && G.room.set && G.room.set(k, v, o || {})); }
  function jump(hm) { safe(() => G.clock && G.clock.jump && G.clock.jump(hm)); }
  function sched() { const e = E(); return e && e.sched ? e.sched : null; }
  function C() { return (G.STORY && G.STORY.cards && G.STORY.cards.call) || {}; }
  function HO() { return (G.STORY && G.STORY.cards && G.STORY.cards.handover) || []; }
  function seqObj() {
    const v = (G.state && G.state.vars) || {};
    if (!v.seq || typeof v.seq !== 'object') v.seq = { m1: null, m6: null, m7: null, m8: null };
    return v.seq;
  }
  function setSeq(s) { seqObj().m1 = s; safe(() => G.save && G.save(true)); }
  CL.step = function () { return seqObj().m1 || null; };

  /* ---------- the eye view (scenes' cold-open eye, else a new one) ---------- */
  async function curEye() {
    let eye = safe(() => G.scenes && G.scenes.eye && G.scenes.eye(), null);
    if (eye) return eye;
    for (let i = 0; i < 25 && !eye; i++) { await wait(200); eye = safe(() => G.scenes && G.scenes.eye && G.scenes.eye(), null); }
    if (!eye && F().eye) { eye = F().eye({ view: 'r3_kitchen', fadeMs: 400, spots: false }); safe(() => G.scenes && G.scenes._setEye && G.scenes._setEye(eye)); }
    return eye;
  }
  function show(eye, x) { return F().eyeShow ? F().eyeShow(eye, x) : Promise.resolve(); }
  function spots(eye, on) { safe(() => eye && eye.spots && eye.spots(!!on)); }
  function screenNode(eye) { return safe(() => (eye && eye.screenNode ? eye.screenNode() : null), null); }

  /* ---------- E9 easy ring screen (shell) — a plain-DOM stand-in when easymode is absent ---------- */
  function ringScreen(node, o) {
    if (!node) return;
    if (G.easy && typeof G.easy.ringScreen === 'function') { safe(() => G.easy.ringScreen(node, Object.assign({ from: 'sea', kind: 'talk' }, o))); return; }
    const d = (G.STORY && G.STORY.easy && G.STORY.easy.ring) || {};
    const T = (s) => (G.T ? G.T(s) : s);
    const el = (F().el) || ((t) => document.createElement('div'));
    node.innerHTML = '';
    const src = safe(() => (F().img ? F().img(d.avatar || 'avatar_sea') : ''), '');
    const av = el('div.fl3-e9-av'); if (src) av.style.backgroundImage = `url("${src}")`;
    const mm = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    let rows;
    if (o.phase === 'ring') rows = [el('div.fl3-e9-btns', null, el('span.fl3-e9-no', null, T(d.decline || '')), el('span.fl3-e9-yes', null, T(d.accept || '')))];
    else if (o.phase === 'call') rows = [el('div.fl3-e9-t', null, mm(o.sec | 0)), el('div.fl3-e9-calls', null, (d.callBtns || []).map((b) => el('span', null, T(b))))];
    else rows = [el('div.fl3-e9-t', null, T(d.ended || ''))];
    node.appendChild(el('div.fl3-e9.' + (o.phase || 'ring'), null, el('div.fl3-e9-name', null, T(d.name || '')),
      o.phase === 'ended' ? null : el('div.fl3-e9-kind', null, T(d.kind || '')), av, rows));
  }

  /* ---------- scheduling the preroll (ARCH §5.20) ---------- */
  function preDue() {
    const t0 = pmOf('M0');
    if (t0 == null) return null;
    const ml = pmOf('momLine1');
    return Math.max(t0 + 90000, ml != null ? ml + 25000 : 0);
  }
  let fbTimer = null;
  CL.arm = function () {
    if (!flag('M0') || flag('M1') || CL.step() || flag('handover')) return;
    const due = preDue();
    if (due == null) return;
    const sc = sched();
    if (sc && sc.at) {
      const cur = safe(() => (sc.when ? sc.when('call:pre') : null), null);
      if (cur != null && Math.abs(cur - due) < 50) return;
      if (cur != null) safe(() => sc.cancel('call:pre'));
      safe(() => sc.at(due, 'call:pre'));
      return;
    }
    // no core scheduler (partial build): poll on the game tick
    if (fbTimer) return;
    fbTimer = true;
    const off = G.bus && G.bus.on ? G.bus.on('tick', () => { const d = preDue(); if (d != null && pm() >= d) { if (typeof off === 'function') off(); fbTimer = null; run(); } }) : null;
  };

  /* ---------- the set piece ---------- */
  let gen = 0, runningNow = false;
  /** reveal time of a card at 70 ms/char + 1.2 s per '…' (core G.cards rule) — to put situation cards on the call timeline */
  function revealMs(text) {   // exactly cards.js: 70 ms per char, an '…' that is neither doubled nor last holds 1.2 s instead of 70 ms
    const c = Array.from(String(G.T ? G.T(text) : text));
    let ms = 0;
    for (let k = 0; k < c.length; k++) ms += c[k] === '…' && c[k + 1] !== '…' && k < c.length - 1 ? 1200 : 70;
    return ms;
  }
  /** a timed card group: steps [{text, who, at}] (at = seconds on the call clock) — tap:false, gaps fill to the next line */
  function timed(steps, tailMs) {
    const out = steps.map((s, i) => {
      const next = steps[i + 1];
      const gap = next ? Math.max(120, (next.at - s.at) * 1000 - revealMs(s.text)) : (tailMs || 2600);
      return { who: s.who || null, text: s.text, tap: false, gapMs: gap };
    });
    return play(out, { id: 'call:0333' });
  }
  async function run() {
    if (runningNow || CL.step() || flag('M1') || flag('handover')) return;
    runningNow = true;
    const my = ++gen;
    const ok = () => my === gen;
    try {
      const c = C();
      const A = !!cb('A');
      const eye = await curEye();
      if (!ok()) return;
      // t −20 — preroll (B03)
      setSeq('pre'); mark('B03');
      spots(eye, false);
      jump('03:32');
      if (A) cue('glass.set', { src: 'momPhone' });
      else { cue('phone.flip', { src: 'momPhone' }); roomSet('phoneGlow', 'ceil'); }
      play([{ who: null, text: typeof c.pre === 'function' ? c.pre(cb) : c.pre, tap: false, gapMs: 4200 }], { id: 'call:0333' });
      let t = -20;
      const to = async (x) => { await wait((x - t) * 1000); t = x; return ok(); };
      if (!(await to(0))) return;
      // t 0 — the first ring = M1 (clock 03:33)
      setFlag('M1'); setFlag('callRing'); setSeq('ring'); mark('B04');
      safe(() => G.audio && G.audio.vibrate && G.audio.vibrate('ring3'));     // once (§7.1.7 · ARCH §1 — audio drops it when less)
      const ring = cue('ring.talk', { src: 'momPhone', n: 4, period: 1.6 });
      cue('buzz.table', { src: 'momPhone', n: 4, period: 1.6 });
      sub('S01', { az: 270 });
      roomSet('phoneGlow', A ? 'off' : 'ring');
      const ringLines = (typeof c.ring === 'function' ? c.ring(cb) : c.ring) || [];
      const g2 = ringLines.map((x, i) => ({ text: x, at: i * 1.2 }));
      timed(g2, 300);      // the ring line(s) clear by ≈2.5 s: rings 2–4 (1.6–4.8) play over an empty screen · the t2 card is not drawn
      if (!(await to(0.4))) return;
      cue('kongi.sniff', { src: 'kongiSr' });
      if (!(await to(1.2))) return;
      if (A) roomSet('phoneGlow', 'ring');
      await show(eye, { closeup: 'c3_phone_ring', ms: 400 });
      if (!ok()) return;
      t = Math.max(t, 1.6);
      const ringNode = screenNode(eye);
      ringScreen(ringNode, { phase: 'ring' });
      if (!(await to(4.8))) return;
      cue('chair.creak', { src: 'momSeat' });
      if (!(await to(6.0))) return;
      // t 6.0 — 엄마 answers: the ring stops mid-pattern, 0.6 s of silence (the recording's r 0.0–0.6)
      setFlag('callAnswered'); setSeq('call');
      timed([{ text: c.t6, at: 6.0 }], 3000);
      safe(() => { if (ring && typeof ring.stop === 'function') ring.stop(0.008); });
      roomSet('phoneGlow', 'call');
      if (ringNode && ringNode.isConnected) ringScreen(ringNode, { phase: 'call', sec: 0 });
      show(eye, { view: 'r3_kitchen', ms: 600 });
      if (!(await to(6.6))) return;
      safe(() => G.audio && G.audio.leak && G.audio.leak(true));
      const cuts = safe(() => (G.AUDIO_META && G.AUDIO_META.v3_mom_call && G.AUDIO_META.v3_mom_call.cuts_s) || null, null);
      safe(() => G.audio && G.audio.playVoice && G.audio.playVoice('v3_mom_call', { src: 'momSeat', cuts, live: true }));
      if (!(await to(7.0))) return; sub('S02', { az: 270 });
      if (!(await to(9.0))) return; sub('S03', { az: 270 });
      if (!(await to(11.0))) return; sub('S04', { az: 270 });
      if (!(await to(14.6))) return; sub('S05', { az: 270 });
      if (!(await to(15.0))) return;
      timed([{ text: c.t15, at: 15.0 }], 1800);      // observation only · gone before the gasp · the t19 card is not drawn — mom.gasp at 18.6 carries it
      if (!(await to(18.6))) return;
      cue('mom.gasp', { src: 'momSeat' });
      if (!(await to(39.0))) return;
      // t 39.0 — the line goes dead (callEnded · 0:33)
      setFlag('callEnded'); setSeq('end');
      cue('talk.end', { src: 'momPhone' });
      safe(() => G.audio && G.audio.leak && G.audio.leak(false));
      if (!(await to(40.5))) return;
      cue('breath.mom', { once: true, src: 'momSeat' });
      const g4 = play([{ who: (c.t40 && c.t40.who) || '엄마', text: c.t40 && c.t40.text, tap: false, gapMs: Math.max(120, 2500 - revealMs((c.t40 && c.t40.text) || '')) },
        { who: null, text: c.t43, tap: false, gapMs: Math.max(120, 7000 - revealMs(c.t43 || '')) },
        { who: null, text: c.t50, tap: false, gapMs: 2200 }], { id: 'call:0333' });
      if (!(await to(43.0))) return;
      // t 43.0 — 03:34: the phone is put down; 통화 종료 · 0:33 for 1.5 s, then the screen goes dark
      jump('callEnd'); mark('B05');
      cue('phone.set', { src: 'momPhone' });
      roomSet('phoneGlow', 'ended');
      await show(eye, { closeup: 'c3_phone_ring', ms: 400 });
      if (!ok()) return;
      t = Math.max(t, 43.4);
      const endNode = screenNode(eye);
      ringScreen(endNode, { phase: 'ended', sec: 33 });
      if (!(await to(44.9))) return;
      roomSet('phoneGlow', 'off');
      safe(() => { if (endNode && endNode.isConnected) endNode.replaceChildren(); });   // the screen goes dark (room's black holder)
      if (!(await to(50.0))) return;
      // ≈ 50 — 03:35: 엄마 slides the phone toward {N}
      cue('phone.slide', { src: 'momPhone', path: [{ dt: 0, src: 'momPhone' }, { dt: 0.5, az: 270, dist: 1.8 }] });
      await show(eye, { closeup: 'c3_mom_hands', ms: 600 });
      await g4;
      if (!ok()) return;
      await handover(eye, my);
    } catch (e) { console.error('[call] set piece', e); }
    finally { if (my === gen) runningNow = false; }
  }

  /* ---------- 03:35 handover (B05 cards → B06) ---------- */
  function drawn(id) {
    const v = (G.state && G.state.vars) || {};
    if (!v.fl || typeof v.fl !== 'object') v.fl = {};
    if (!v.fl.cardsDrawn || typeof v.fl.cardsDrawn !== 'object') v.fl.cardsDrawn = {};
    if (v.fl.cardsDrawn[id]) return;
    v.fl.cardsDrawn[id] = 1;
    safe(() => G.save && G.save());
    safe(() => G.notebook && G.notebook.refresh && G.notebook.refresh());
  }
  function b06Sounds(my) {
    (async () => {
      cue('chair.creak', { src: 'momSeat' });
      await wait(600); if (my !== gen) return;
      cue('mom.slippers', { path: [{ dt: 0, az: 270, dist: 2.6 }, { dt: 1.0, az: 300, dist: 2.2 }, { dt: 2.0, az: 345, dist: 2.0 },
        { dt: 3.0, az: 10, dist: 2.6 }, { dt: 4.2, az: 30, dist: 3.8 }], n: 7 });
      await wait(4300); if (my !== gen) return;
      cue('door.sr', { src: 'srDoor' });
      await wait(800); if (my !== gen) return;
      cue('switch.lamp', { src: 'srLamp' });
      roomSet('srGap', 0.25, { ms: 1200 }); roomSet('srLamp', 'dim', { ms: 1200 });
    })();
  }
  async function handover(eye, my) {
    if (my !== gen) return;
    setSeq('hand');
    const steps = HO().map((s) => Object.assign({ gapMs: 1600 }, s));
    let soundsOn = false;
    await play(steps, { id: 'call:handover', onStep: (s) => {
      if (!s || my !== gen) return;
      if (s.id === 'recCard' || s.id === 'easyCard') drawn(s.id);
      if (s.id === 'toRoom' && !soundsOn) { soundsOn = true; b06Sounds(my); }
      if (/콩이가 고개를 들었다가/.test(String(s.text || ''))) cue('kongi.settle', { src: 'kongiSr' });
    } });
    if (my !== gen) return;
    drawn('recCard'); drawn('easyCard');                         // the script ran through (fallback cards without onStep)
    if (!soundsOn) b06Sounds(my);
    setFlag('handover'); setSeq('done'); mark('B06');
    safe(() => { const e = E(); if (e && e.momAt) e.momAt('sr'); else if (G.state && G.state.vars) G.state.vars.momAt = 'sr'; });
    roomSet('srGap', 0.25, { ms: 1200 }); roomSet('srLamp', 'dim', { ms: 1200 });
    jump('03:35');
    // the z-45 eye view would cover the z-30 lock (ARCH §9 G66) — close it first, then the easy lock screen
    if (F().eyeClose) await F().eyeClose(eye, 400);
    safe(() => G.scenes && G.scenes._setEye && G.scenes._setEye(null));
    if (my !== gen) return;
    safe(() => G.lock && G.lock.show && G.lock.show('n'));
  }

  /* ---------- resume (§3.22: the call never rings again — handover cards from line 1) ---------- */
  CL.resume = async function () {
    if (flag('handover')) return;
    const s = CL.step();
    if (!s && !flag('M1')) { CL.arm(); return; }
    gen++; runningNow = false;
    const my = gen;
    safe(() => { const sc = sched(); if (sc && sc.cancel) sc.cancel('call:pre'); });
    ['M1', 'callRing', 'callAnswered', 'callEnded'].forEach((n) => { if (!flag(n)) setFlag(n); });
    jump('callEnd'); jump('03:35');
    roomSet('phoneGlow', 'off');
    let eye = safe(() => G.scenes && G.scenes.eye && G.scenes.eye(), null);
    if (eye) await show(eye, { closeup: 'c3_mom_hands', ms: 400 });
    else if (F().eye) { eye = F().eye({ closeup: 'c3_mom_hands', fadeMs: 800, spots: false }); safe(() => G.scenes && G.scenes._setEye && G.scenes._setEye(eye)); }
    spots(eye, false);
    await wait(900);
    if (my !== gen) return;
    runningNow = true;
    try { await handover(eye, my); } finally { if (my === gen) runningNow = false; }
  };
  CL.abort = function () { gen++; runningNow = false; };
  CL.startNow = function () {   // DEBUG (haru.skipTo('B04')): the preroll now
    if (!G.DEBUG) return false;
    safe(() => { const sc = sched(); if (sc && sc.cancel) sc.cancel('call:pre'); });
    run();
    return true;
  };

  /* ---------- init ---------- */
  CL.init = function () {
    if (CL._inited) return; CL._inited = true;
    safe(() => { const sc = sched(); if (sc && sc.on) sc.on('call:pre', () => run()); });
    if (G.bus) {
      G.bus.on('flag:momLine1', () => CL.arm());
      G.bus.on('flag:M0', () => CL.arm());
    }
  };
})();
