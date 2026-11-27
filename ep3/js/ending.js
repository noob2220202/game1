/* =========================================================
 * ep3/js/ending.js (flow) — END → 생일 미역국 (B18) · tail 05:35–06:00 (B19) · credits → check card (B20)
 * (DESIGN_EP3 §3.15 · §3.16-1·2 · §4.12.1–§4.12.4 · §6.2 B18–B20 + END ledger · §6.3 END cut · §3.17.2 · §9.3 ④ ·
 *  ARCH_EP3 §5.14 · §6.3 · §8.3).
 *   hook 'end:start' {by:'played'|'fallback'} (room climax) → END cut: eye c3_mom_hands → ① 엄마가 일어나 부엌 불을 켠다.
 *   (chair · slippers · switch.light · room kitchenLight) → ② c3_pot · stove.ignite · stove.flame loop · room stove 'flame'
 *   (+40 s 'steam' + soup.simmer) → ③ "괜찮대요. 우리 딸이 괜찮대요." + v3_mom_okay — the moment the line is drawn:
 *   flag END + G.e3.commit() (commit ①, same function) → +4 s ④–⑥ the cut dims to .6, sound only (collar 'gone' ·
 *   kongi 'none' · the night's first 딸랑 = collarOn + S20) → ⑦ kongi.trot → settle cut r3_kitchen (kongi 'feet').
 *   Tail on the settle cut: 05:35 (jimin · callback B · four bowls = soupServed · [잘 먹겠습니다. ✎] · callback C) → 05:40
 *   (W12 bus is the director's · 지민 lines · W12b second bus 2 s after the last one · 강수진 relay · played / fallback) →
 *   05:4x facts (DND supplement when ¬momDnd incl. G.show.dndChip({ctx:'tail', timeoutMs:10000}) · album supplement) →
 *   05:55 `{N} 씨, 폰.` (eye closes → the phone home) · `엄마가 손을 내민다.` · chip easyBack (drawn = easyBackChip; big →
 *   G.easy.set(true) + stage easyBack true · keep → false — written the moment it is picked) → 06:00 c3_window card + [계속]
 *   (end.next) → credits (~20 s, tap = skip · piano.ab · S21 · house −6 dB) → check card [계속] (all sound → 0 in 2 s) →
 *   G.hook.start(). Clock: jump 05:35 · 05:40 · 05:55 · 06:00 at the tail steps (the END row is 'card').
 * Resume (§3.22 · §6.1.8): END ∧ ¬HOOK → the settle-cut state (no END sound sequence again · kongi feet · stove loop on) →
 *   the next tail step after vars.endStep (a pending chip is shown again; a chip already picked is not asked twice).
 * API: G.ending = { init(), start({by}), resume(step), abort() }  · hook 'end:start'
 * Flags set: END collarOn soupServed easyBackChip · stage (G.e3.stage): easyBack · vars: endStep ('e0530' 'e0530c' 'e0535'
 *   'e0540' 'e0545' 'e0555' 'e0600' 'cred' 'check' 'hook') · marks B18 B19 B20 W12b. Bus out: 'end:step' {step}.
 * data-qa: end.next credits.skip check.continue (cards/chips are core's: card card.next chip.opt:<id> …)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const EN = (G.ending = G.ending || {});

  /* ---------- helpers ---------- */
  const F = () => G.flow || {};
  function el(tag, attrs, ...kids) { return F().el ? F().el(tag, attrs, ...kids) : (G.util && G.util.el ? G.util.el(tag, attrs, ...kids) : document.createElement('div')); }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[ending]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n) { try { G.flag(n, true); } catch (e) { console.error('[ending] flag', n, e); } }
  function E() { return G.ep || G.e3 || G.e2 || null; }
  function cb(k) { return safe(() => { const e = E(); return e && e.cb ? e.cb(k) : undefined; }, undefined); }
  function wait(ms) { return F().wait ? F().wait(ms) : new Promise((r) => setTimeout(r, ms)); }
  function cue(id, o) { return safe(() => (G.audio && G.audio.cue ? G.audio.cue(id, o || {}) : undefined)); }
  function sub(id, o) { safe(() => { if (G.audio && G.audio.sub) G.audio.sub(id, o || {}); }); }
  function amb(id, on, o) { safe(() => { if (G.audio && G.audio.amb) G.audio.amb(id, on, o || {}); }); }
  function mark(id) { safe(() => G.director && G.director.mark && G.director.mark(id)); }
  function jump(hm) { safe(() => G.clock && G.clock.jump && G.clock.jump(hm)); }
  function play(script, opts) { return F().play ? F().play(script, Object.assign({ mode: 'story' }, opts || {})) : Promise.resolve({ picks: {}, aborted: false }); }
  function roomSet(k, v, o) { safe(() => G.room && G.room.set && G.room.set(k, v, o || {})); }
  function show(eye, x) { return F().eyeShow ? F().eyeShow(eye, x) : Promise.resolve(); }
  function dim(eye, lv, ms) { return safe(() => (eye && eye.dim ? Promise.resolve(eye.dim(lv, ms)).catch(() => null) : wait(ms || 0)), Promise.resolve()); }
  function scr() { return document.getElementById('screen'); }
  function D() { return (G.STORY && G.STORY.ending) || {}; }
  function vset(k, v) { try { if (G.vars) G.vars(k, v); else G.state.vars[k] = v; } catch (e) {} }
  function vget(k) { try { return G.vars ? G.vars(k) : G.state.vars[k]; } catch (e) { return undefined; } }
  function stage(k, v) { safe(() => { const e = E(); if (e && e.stage) e.stage(k, v); else if (G.state && G.state.stage) { G.state.stage[k] = v; G.save && G.save(); } }); }
  function setStep(step) { vset('endStep', step); safe(() => G.save && G.save(true)); safe(() => G.bus && G.bus.emit('end:step', { step })); }
  const gap = () => 1200 + Math.round(Math.random() * 800);             // 줄마다 1.2–2.0초 (§3.15)
  const withGaps = (steps) => (F().prep ? F().prep(steps) : steps).map((s) => (s.chips || s.run || s.wait != null ? s : Object.assign({ gapMs: gap() }, s)));

  let eye = null, chainGen = 0, chainRunning = false;
  function closeEye(ms) { const e = eye; eye = null; return F().eyeClose ? F().eyeClose(e, ms) : Promise.resolve(); }

  /* ---------- END (B18 · §3.15 · §6.2 END ledger · §6.3 END cut) ---------- */
  let endDone = false;
  /** the END line is on screen: END + commit ① in this one function (§9.3 ④) + v3_mom_okay in the same frame */
  function onEndLine() {
    if (endDone) return;
    endDone = true;
    safe(() => G.audio && G.audio.playVoice && G.audio.playVoice('v3_mom_okay', { src: 'stove' }));
    setFlag('END');
    safe(() => { const e = E(); if (e && e.commit) e.commit(); });
    setStep('e0530');
  }
  function settleState() {
    roomSet('kitchenLight', true); roomSet('stove', 'steam'); roomSet('collar', 'gone'); roomSet('kongi', 'feet');
    amb('stove.flame', true, { fade: 0.8 }); amb('soup.simmer', true, { fade: 0.8 }); amb('breath.kongi', true, { fade: 0.8 });
  }
  async function endSequence(my) {
    const d = D(); const end = d.end || [];
    const ok = () => my === chainGen;
    safe(() => G.callrec && G.callrec.stop && G.callrec.stop());
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    mark('B18');
    eye = F().eye ? F().eye({ closeup: 'c3_mom_hands', fadeMs: 600, spots: false }) : null;
    await wait(1200);
    if (!ok()) return;
    // ① 엄마가 일어나 부엌 불을 켠다.
    amb('breath.mom', false, { fade: 1 });
    cue('chair.creak', { src: 'momSeat' });
    const p1 = play([Object.assign({ gapMs: 1400 }, end[0])], { id: 'end:end' });
    await wait(600);
    cue('mom.slippers', { path: [{ dt: 0, src: 'momSeat' }, { dt: 1.2, src: 'kitchenSwitch' }], n: 3 });
    await wait(1200);
    cue('switch.light', { src: 'kitchenSwitch' });
    roomSet('kitchenLight', true, { ms: 1200 });
    await p1;
    if (!ok()) return;
    // ② the pot — stove.ignite · the flame loop · +40 s steam and simmer
    cue('mom.slippers', { path: [{ dt: 0, src: 'kitchenSwitch' }, { dt: 1.0, src: 'stove' }], n: 2 });
    await show(eye, { closeup: 'c3_pot', ms: 400 });
    cue('stove.ignite', { src: 'stove' });
    roomSet('stove', 'flame', { ms: 400 });
    amb('stove.flame', true, { fade: 1.2 });
    wait(40000).then(() => { if (!flag('HOOK')) { roomSet('stove', 'steam'); amb('soup.simmer', true, { fade: 4 }); } });
    // ② card → ③ the END line (drawn ⇒ END + commit) → +4 s
    const r = play([Object.assign({ gapMs: 1500 }, end[1]), Object.assign({ gapMs: 4000 }, end[2])],
      { id: 'end:end', onStep: (s) => { if (s && s.id === 'END') onEndLine(); } });
    const offShow = G.bus && G.bus.on ? G.bus.on('card:show', (e) => { if (e && e.step === 'END') onEndLine(); }) : null;
    await r;
    if (typeof offShow === 'function') offShow();
    onEndLine();                                                       // the script ran (fallback / missing onStep): END holds now
    if (!ok()) return;
    await afterEndLine(my);
  }
  /** ④–⑦ — the cut dims, sound only; then the settle cut */
  async function afterEndLine(my) {
    const d = D(); const end = d.end || [];
    const ok = () => my === chainGen;
    dim(eye, 0.6, 600);
    // ④ to the hook by the shoe cabinet (the bell is held in her hand — no ring yet)
    cue('mom.slippers', { path: [{ dt: 0, src: 'stove' }, { dt: 1.4, az: 300, dist: 1.8 }, { dt: 2.8, az: 340, dist: 2.6 }, { dt: 4.2, az: 5, dist: 4.0 }, { dt: 5.5, src: 'hook' }], n: 9 });
    roomSet('collar', 'gone');
    await play([Object.assign({ gapMs: 2600 }, end[3])], { id: 'end:end' });
    if (!ok()) return;
    // ⑤ 콩이 stands up at Sea's door
    cue('mom.slippers', { path: [{ dt: 0, src: 'hook' }, { dt: 2.0, src: 'kongiSr' }], n: 3 });
    const p5 = play([Object.assign({ gapMs: 1800 }, end[4])], { id: 'end:end' });
    await wait(2000);
    cue('kongi.stand', { src: 'kongiSr' });
    roomSet('kongi', 'none');
    amb('breath.kongi', false, { fade: 1 });
    await p5;
    if (!ok()) return;
    // ⑥ the night's first bell
    cue('kongi.bell', { src: 'kongiSr' });
    setFlag('collarOn');
    sub('S20', { az: 48 });
    await wait(1400);
    if (!ok()) return;
    // ⑦ to the kitchen — the settle cut fades in when the steps reach 252°
    cue('mom.slippers', { path: [{ dt: 0, src: 'kongiSr' }, { dt: 1.5, az: 30, dist: 4.4 }, { dt: 3.0, az: 0, dist: 3.6 }, { dt: 4.2, az: 320, dist: 2.4 }, { dt: 5.2, az: 290, dist: 1.6 }, { dt: 6.0, src: 'stove' }], n: 10 });
    const p7 = play([Object.assign({ gapMs: 2200 }, end[5])], { id: 'end:end' });
    await wait(800);
    cue('kongi.trot', { path: [{ dt: 0, src: 'kongiSr' }, { dt: 6.0, src: 'kongiFeet' }] });
    await wait(6000);
    if (!ok()) return;
    cue('kongi.tail', { src: 'kongiFeet', n: 4 });
    roomSet('kongi', 'feet');
    amb('breath.kongi', true, { fade: 2 });
    await show(eye, { view: 'r3_kitchen', ms: 800 });
    dim(eye, 0, 800);
    await p7;
    setStep('e0530c');
  }

  /* ---------- tail (B19 · §3.15 · §4.12.2) ---------- */
  async function t0535(my) {
    const t = D().tail || {};
    jump('05:35'); mark('B19');
    let served = false;
    await play(withGaps(t.t0535 || []), { id: 'end:tail', onStep: (s) => {
      if (!s) return;
      if (s.id === 'jiminSits') { cue('mom.slippers', { path: [{ dt: 0, az: 140, dist: 3.5 }, { dt: 2.4, az: 240, dist: 1.1 }], n: 5, who: 'jimin' }); setTimeout(() => cue('chair.creak', { az: 240, dist: 1.1 }), 2500); }
      if (s.id === 'soupServed' && !served) {
        served = true; setFlag('soupServed');
        cue('ladle', { src: 'stove', n: 4 });          // §7.2 G ×4 (sound3 spaces them 0.9 s)
        [600, 1500, 2400, 3300].forEach((ms) => setTimeout(() => cue('bowl.set', { az: 270, dist: 1.0 }), ms));
        setTimeout(() => cue('spoons', { az: 270, dist: 1.0 }), 5200);
      }
    } });
    if (!served) setFlag('soupServed');
    if (my === chainGen) setStep('e0535');
  }
  async function t0540(my) {
    const t = D().tail || {};
    jump('05:40');
    await wait(2600);                                                  // W12 — the first bus (director · 05:40) comes alone
    if (my !== chainGen) return;
    let soundAllAt = null;
    await play(withGaps(t.t0540 || []), { id: 'end:tail', onStep: (s) => { if (s && s.id === 'soundAll') soundAllAt = Date.now(); } });
    if (my !== chainGen) return;
    // W12b — the second bus 2 s after `그거 하면서, 세아 소리 다 들어 볼 거예요.` (§6.1.7 · ARCH §9 G59)
    (async () => { await wait(soundAllAt ? Math.max(0, 2000 - (Date.now() - soundAllAt)) : 0); cue('bus.far', { src: 'road', gainDb: -2 }); sub('S22', { az: 90 }); mark('W12b'); })();
    const k = t.kang || {};
    const relay = (flag('kangNameSent') ? k.sent : k.other) || [];
    const fin = flag('played') ? k.played : flag('playFallback') ? k.fallback : null;
    await play(withGaps(relay.concat(fin ? [fin] : [])), { id: 'end:tail' });
    if (my === chainGen) setStep('e0540');
  }
  async function t0545(my) {
    const t = D().tail || {};
    const dn = t.dndFacts || {}, al = t.albumFacts || {};
    if (!flag('momDnd')) {
      const lines = (flag('mom331') ? [] : (dn.no331 || [])).concat(dn.lines || []);
      if (lines.length) await play(withGaps(lines.map((x) => ({ who: '엄마', text: x }))), { id: 'end:tail' });
      if (my !== chainGen) return;
      if (!flag('dndChipSaid')) {
        let said = false;
        if (G.show && typeof G.show.dndChip === 'function') said = !!(await Promise.resolve(safe(() => G.show.dndChip({ ctx: 'tail', timeoutMs: 10000 }), false)).catch(() => false));
        else {
          const ch = (G.STORY && G.STORY.show && G.STORY.show.dndChip) || null;
          if (ch && F().ask) { const pick = await F().ask(Object.assign({}, ch, { timeoutMs: 10000, timeoutPick: null })); said = !!(pick && pick.id === 'say'); }
        }
        if (my !== chainGen) return;
        if (said && dn.said) await play([{ who: '엄마', text: dn.said, gapMs: gap() }], { id: 'end:tail' });
      }
    }
    if (my !== chainGen) return;
    const album = [];
    if (!flag('bomSeen') && al.noBom) album.push({ who: '엄마', text: al.noBom });
    if (!flag('albumDone') && al.noAlbum) album.push({ who: '엄마', text: al.noAlbum });
    if (album.length) await play(withGaps(album), { id: 'end:tail' });
    if (my === chainGen) setStep('e0545');
  }
  async function t0555(my) {
    const t = D().tail || {};
    jump('05:55');
    const steps = t.t0555 || [];
    const chipStep = steps.find((s) => s && s.chips) || null;
    const lines = steps.filter((s) => s && !s.chips);
    // `{N} 씨, 폰.` — the eye view closes and the phone home shows (§6.3 END cut)
    await play(withGaps(lines.slice(0, 1)), { id: 'end:tail' });
    if (my !== chainGen) return;
    safe(() => G.phone && G.phone.closeAll && G.phone.closeAll(true));   // the app stack under the eye view → home
    await closeEye(600);
    safe(() => G.phone && G.phone.home && G.phone.home());
    await play(withGaps(lines.slice(1)), { id: 'end:tail' });
    if (my !== chainGen) return;
    let choice = safe(() => (G.state && G.state.stage ? G.state.stage.easyBack : null), null);
    if (choice == null && chipStep) {
      setFlag('easyBackChip');
      const r = await play([chipStep], { id: 'end:tail', onStep: (s) => { if (s && s.chips) setFlag('easyBackChip'); } });
      if (my !== chainGen) return;
      const pick = r && r.picks ? r.picks[chipStep.id] : null;
      choice = pick && pick.id === 'big';
      stage('easyBack', !!choice);                                     // written the moment it is picked (§3.15)
      safe(() => G.save && G.save(true));
    } else if (!flag('easyBackChip')) setFlag('easyBackChip');
    if (choice) {
      await play(withGaps(t.big || []), { id: 'end:tail', onStep: (s) => {
        if (s && s.id === 'bigOn') safe(() => { if (G.easy && G.easy.set && !(G.easy.on && G.easy.on())) G.easy.set(true); });
      } });
      safe(() => { if (G.easy && G.easy.set && !(G.easy.on && G.easy.on())) G.easy.set(true, { silent: true }); });
    } else {
      await play(withGaps(t.keep || []), { id: 'end:tail' });
    }
    if (my === chainGen) setStep('e0555');
  }
  async function t0600(my) {
    const t = D().tail || {};
    jump('06:00');
    if (eye) await closeEye(300);
    eye = F().eye ? F().eye({ closeup: 'c3_window', fadeMs: 1000, spots: false }) : null;
    await wait(1200);
    if (my !== chainGen) return;
    await play([Object.assign({ gapMs: 1600 }, t.t0600 || {})], { id: 'end:tail' });
    if (my !== chainGen) return;
    await nextButton(t.next || '계속');
    if (my === chainGen) setStep('e0600');
  }
  /** the one explicit [계속] of the tail (06:00 → credits — ARCH §5.6 · data-qa end.next) */
  function nextButton(label) {
    return new Promise((res) => {
      const b = el('button.fl3-next', { 'data-qa': 'end.next' }, label);
      const bar = el('div.fl3-nextbar', null, b);
      (scr() || document.body).appendChild(bar);
      requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('in')));
      const rb = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => true) : null), null);
      b.addEventListener('click', () => {
        if (b._done) return; b._done = true;
        safe(() => G.audio && G.audio.sfx && G.audio.sfx.tap && G.audio.sfx.tap());
        if (typeof rb === 'function') safe(rb);
        bar.classList.remove('in'); setTimeout(() => bar.remove(), 500);
        res();
      });
    });
  }

  /* ---------- credits → check card (B20 · §3.16-1·2 · §4.12.4) ---------- */
  function checkLine(text) {
    const s = String(text);
    const parts = s.split(' · ');
    if (parts.length < 2) return el('p', null, s);
    const p = el('p.fl3-check-help');
    parts.forEach((x, i) => { if (i) p.appendChild(el('span.fl3-sep', null, ' · ')); p.appendChild(el('span.fl3-nw', null, x)); });
    return p;
  }
  function fitCheckLine(p) {
    if (!p || !p.isConnected) return;
    const parts = Array.from(p.querySelectorAll('.fl3-nw')), seps = Array.from(p.querySelectorAll('.fl3-sep'));
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
  const HOUSE = ['amb.fridge', 'amb.clock', 'amb.apt', 'stove.flame', 'soup.simmer', 'breath.kongi', 'breath.jimin', 'amb.wind90'];
  async function credits() {
    const lines = D().credits || [];
    mark('B20');
    safe(() => G.notebook && G.notebook.close && G.notebook.close());
    safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
    HOUSE.forEach((id) => amb(id, true, { gainDb: -6, fade: 3 }));
    const mins = Math.round(((G.state && G.state.playMs) || 0) / 60000);
    const hints = (G.state && G.state.hintsUsed) || 0;
    const ttl = String(T(lines[0] || ''));
    const cut = ttl.lastIndexOf(' · ');
    const glue = (s) => s.replace(/ (\S{1,3})$/, ' $1');
    const titleNode = cut > 0
      ? el('div.fl3-cred-title', null, el('span.fl3-cred-l1', null, glue(ttl.slice(0, cut))), el('span.fl3-cred-l2', null, ttl.slice(cut + 3)))
      : el('div.fl3-cred-title', null, glue(ttl));
    const voiceNode = checkLine(T(lines[2] || '')); voiceNode.classList.add('dim');
    const stats = T(String(lines[5] || '').replace('{m}', String(mins)).replace('{n}', String(hints)));
    const bg = el('div.fl3-cred-bg');
    const src = safe(() => (F().img ? F().img('c3_window') : ''), '');
    if (src) bg.style.backgroundImage = `url("${src}")`;
    const scene = el('div.fl3-scene.fl3-credits', { 'data-qa': 'credits.skip', role: 'button' }, bg,
      el('div.fl3-cred-in', null,
        titleNode,
        el('p.fl3-cred-maker', null, T(lines[1] || '')),
        voiceNode,
        el('p.dim', null, T(lines[3] || '')),
        el('p.dim', null, T(lines[4] || '')),
        el('p.small', null, stats)));
    (scr() || document.body).appendChild(scene);
    requestAnimationFrame(() => scene.classList.add('in'));
    const fitV = () => fitCheckLine(voiceNode);
    requestAnimationFrame(() => requestAnimationFrame(fitV));
    safe(() => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(fitV)); });
    window.addEventListener('resize', fitV);
    const rb = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => true) : null), null);
    // the eye view (c3_window) under the credits is no longer needed
    setTimeout(() => { if (eye) closeEye(0); }, 1200);
    await wait(1600);
    cue('piano.ab'); sub('S21');
    await new Promise((res) => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      scene.addEventListener('click', fin);
      wait(20000).then(fin);
    });
    setStep('cred');
    window.removeEventListener('resize', fitV);
    if (typeof rb === 'function') safe(rb);
    scene.classList.remove('in'); scene.classList.add('out');
    setTimeout(() => scene.remove(), 800);
  }
  async function check() {
    const arr = D().check || [];
    const nxt = el('button.fl3-next.fl3-check-next', { 'data-qa': 'check.continue' }, D().checkNext || (D().tail && D().tail.next) || '계속');
    const scene = el('div.fl3-scene.fl3-check', null, el('div.fl3-check-in', null, arr.map((x) => checkLine(T(x)))), nxt);
    (scr() || document.body).appendChild(scene);
    requestAnimationFrame(() => scene.classList.add('in'));
    // the check card is silent: every sound fades to 0 over 2 s (§6.2 B20)
    safe(() => G.audio && G.audio.hush && G.audio.hush(true, { roomDb: -90, fade: 2 }));
    HOUSE.concat(['amb.air', 'amb.boilerPump', 'breath.mom']).forEach((id) => amb(id, false, { fade: 2 }));
    const fit = () => scene.querySelectorAll('p.fl3-check-help').forEach(fitCheckLine);
    requestAnimationFrame(() => requestAnimationFrame(fit));
    safe(() => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(fit)); });
    window.addEventListener('resize', fit);
    const rb = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => true) : null), null);
    const tapped = new Promise((res) => nxt.addEventListener('click', () => { safe(() => G.audio.sfx.tap()); res(); }, { once: true }));
    await wait(1200);
    nxt.classList.add('in');
    await tapped;
    window.removeEventListener('resize', fit);
    setStep('check');
    if (typeof rb === 'function') safe(rb);
    scene.classList.add('fade-black');
    setTimeout(() => scene.remove(), 1600);
  }

  /* ---------- the chain ---------- */
  const ORDER = ['e0530', 'e0530c', 'e0535', 'e0540', 'e0545', 'e0555', 'e0600', 'cred', 'check', 'hook'];
  async function runFrom(after) {
    if (chainRunning) return;
    chainRunning = true;
    const my = ++chainGen;
    try {
      let i = after ? ORDER.indexOf(after) + 1 : 0;
      if (i < 0) i = 0;
      for (; i < ORDER.length; i++) {
        if (my !== chainGen) return;
        const s = ORDER[i];
        if (s === 'e0530') { if (!flag('END')) await endSequence(my); else if (!vget('endStep')) setStep('e0530'); }
        else if (s === 'e0530c') { if (vget('endStep') === 'e0530' && eye && !endResumed) await afterEndLine(my); else setStep('e0530c'); }
        else if (s === 'e0535') await t0535(my);
        else if (s === 'e0540') await t0540(my);
        else if (s === 'e0545') await t0545(my);
        else if (s === 'e0555') await t0555(my);
        else if (s === 'e0600') await t0600(my);
        else if (s === 'cred') await credits();
        else if (s === 'check') await check();
        else if (s === 'hook') { setStep('hook'); safe(() => G.hook && G.hook.start && G.hook.start()); }
      }
    } catch (e) { console.error('[ending] chain', e); }
    finally { if (my === chainGen) chainRunning = false; }
  }

  /* ---------- start / resume ---------- */
  let endResumed = false;
  EN.start = function (o) {
    if (!EN._inited) EN.init();
    if (flag('HOOK')) return;
    if (flag('END')) { EN.resume(); return; }
    endResumed = false;
    runFrom(null);
  };
  /** resume(step) — ARCH §8.3: END ∧ ¬HOOK → settle-cut state (no END sound sequence again) → the step after `step` */
  EN.resume = async function (step) {
    if (!EN._inited) EN.init();
    if (flag('HOOK') || chainRunning) return;
    if (!flag('END')) return;
    if (step === undefined || step === null) step = vget('endStep') || 'e0530';
    if (step === 'e0530') step = 'e0530c';                             // ④–⑦ are the END sound sequence: never again (§6.1.8)
    endResumed = true;
    if (step === 'hook') { safe(() => G.hook && G.hook.start && G.hook.start()); return; }
    const i = ORDER.indexOf(step);
    // the tail before 05:55 plays on the settle cut; from 05:55 on the phone home is under the cards
    settleState();
    if (!flag('collarOn')) setFlag('collarOn');
    if (i < ORDER.indexOf('e0545') + 1 && !eye && F().eye) eye = F().eye({ view: 'r3_kitchen', fadeMs: 800, spots: false });
    await wait(900);
    runFrom(step);
  };
  /** a debug jump / resume elsewhere: the running chain gives way (its eye view closes) */
  EN.abort = function () { chainGen++; chainRunning = false; if (eye) closeEye(300); };
  EN.init = function () {
    if (EN._inited) return; EN._inited = true;
    safe(() => G.hooks && G.hooks.set && G.hooks.set('end:start', (o) => EN.start(o || {})));
  };
  // the hook must exist before room climax can call it (registration only — no cross-owner call at load time)
  safe(() => G.hooks && G.hooks.set && G.hooks.set('end:start', (o) => EN.start(o || {})));
})();
