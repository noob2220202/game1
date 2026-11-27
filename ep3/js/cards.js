/* =========================================================
 * ep3/js/cards.js — the shared card + chip layer (core · ARCH_EP3 §5.6 · §2.3 · DESIGN_EP3 §4 '읽는 법' · §3.2.2 · §6.1.3 S7/S8
 * · §9.5-4 칩 · §12.2 V19). Every name card (엄마 · 지민), situation card, set-piece card, reaction card and tail card goes
 * through this one renderer; every chip sheet (04:40 지민 · 방해 금지 · M8 [네. ✎] · 꼬리 · 폴백 · 성공 뒤) through G.chips.
 * (The 강수진 input-bar chips are G.chat chips — comms — not chip sheets, §9.5-4 · ARCH §9 G37.)
 *
 * G.cards.play(script, opts) → Promise<{ picks:{ [stepId]: {id, text, edited} | null }, aborted:bool }>
 *   script = Step[] (nested arrays are flattened · null / '' steps are skipped · a plain string = a name card of opts.who
 *   (default '엄마') · a function step is called (opts.arg, ctx) and its result (step | steps) is spliced in):
 *     { id?, who:'엄마'|'지민'|null, text: string | (arg, ctx) => string|null, gapMs=1600, tap=true }   name / situation card
 *        text is raw (tokens) — rendered through G.T · '…' = a 1.2 s pause during the reveal (§4.1.2 ⊕) · null text = skipped
 *     { id, chips:[{ id, label, edit=false, verb:'say'|'send'|'pick' }], timeoutMs, timeoutPick=null, keepOnTimeout=false }
 *        chip sheet (G.chips.ask). keepOnTimeout ⇒ after timeoutMs the script goes on and the chip stays until tapped or the
 *        script ends (then it closes with null) — the M8 [네. ✎] 15 s rule (§3.14).
 *     { id, when:(picks) => bool [, steps:[…]] }   with steps: run them only if true · without: skip the next step unless true
 *     { id, run: async (ctx) => void }              owner callback (ctx = { id, picks, stepId, aborted(), say(who, text) })
 *     { wait: ms }
 *   opts: { id:'<owner>:<name>' (required), mode:'story'|'react', speedMs=70, abortable=true, onStep(step, i), echo=true
 *           (a said / sent chip line is shown as {N}'s own card — the DESIGN chip text or the edited sentence), who='엄마'
 *           (plain-string steps), arg=G.e3.cb (first argument of lazy text functions), replace=false (abort the running script
 *           instead of queueing behind it) }
 *   Advance rule (ARCH §5.6 — one rule for every caller): a text card reveals at speedMs/char, waits gapMs and advances by
 *   itself; a tap (card.next · Android back · Enter/Space on the focused card) during the reveal completes it, after the reveal
 *   advances at once. tap:false = taps ignored on that step. Nothing ever waits for a tap. Time counts only while the game runs
 *   (pause menu · hidden tab · G.cards.hide(true) stop it). A second play() queues behind the running script; when the running
 *   script is on the gap of its last card the gap ends at once (timed callers stay on time).
 * G.cards.say(who, text, o?) → Promise · G.cards.showing() → bool (S7 — a card is visible or its gap is pending)
 * G.cards.close({ reason:'m6'|'replace'|'end' }) — aborts running + queued scripts (0.4 s fade) → they resolve {aborted:true};
 *   flags already set stay. abortable:false scripts survive every reason except 'end'.
 * G.cards.current() → { id, stepId } | null · G.cards.hide(on) (flow hides story cards while a phone UI it opened is up)
 * G.chips.ask({ id, chips, timeoutMs, timeoutPick, ctx, mode }) → Promise<{ id, text, edited } | null>
 *   pick / say chips commit on tap; edit:true → the sentence goes into G.ui.field({predict:false, ctx:'chip:<id>'}) with
 *   [두기] (→ { id:'keep' }) and [말하기] (verb 'say') / [보내기] (verb 'send'). Edited text → G.e3.session.set('chip:<id>', text)
 *   and edited:true. timeoutMs counts only while no chip field is open (an opened chip is an answer in progress);
 *   timeoutPick null ⇒ null · 'keep' ⇒ {id:'keep'} · a chip id ⇒ that chip as is.
 * G.chips.isOpen() → bool (S8) · G.chips.close(reason) (resolves a pending ask with null)
 * Bus: 'card:show' {id, step, who} · 'card:hide' {id, aborted} · 'chips:open' {id} · 'chips:close' {id, pick, reason}
 * Layer: .c3-card (#screen, z 150). story = full width, bottom-anchored, root pointer-events:none, never over the top 56 px
 *   (the ✎ notebook tab z 60 stays tappable) · react = the compact card under the phone screen (show reactions). While it is up
 *   it consumes Android back / Esc through G.phone.pushBack (back = a tap · in an open chip editor = back to the chips) and
 *   hides the in-game keyboard unless a chip field owns it. Text size follows --ts (G.settings.textSize, game layer).
 *   #phone gets .c3-cards-up + --c3-ch (stack height) so sound subtitles and the monologue sit above the cards (core3.css).
 * data-qa: card (layer) · card.next (the current card box) · chip.opt:<chipId> · chip.field · chip.send · chip.keep
 * Player-facing strings: only the caller's DESIGN text + the button labels '말하기' · '보내기' · '두기' (DESIGN §4 읽는 법 · §9.5-4).
 * No flags, no vars, no storage (except the session store for edited chip text).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const D = document;
  const T = (s) => (G.T ? G.T(s) : s);
  const warned = {};
  const dwarn = (k, ...a) => { if (!G.DEBUG || warned[k]) return; warned[k] = 1; console.warn('[cards]', ...a); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[cards]', e); return d; } };
  const emit = (ev, d) => safe(() => { if (G.bus) G.bus.emit(ev, d); });
  const mk = (tag, cls, txt) => { const n = D.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const reduce = () => !!(G.settings && G.settings.reduceShake);
  const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.1-4.2L15.6 5.3a1.6 1.6 0 012.3 0l.8.8a1.6 1.6 0 010 2.3L8.2 18.9z M13.8 7.1l3.1 3.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const VERB = { say: '말하기', send: '보내기' };
  const KEEP = '두기';
  const ELL = '…';
  const ELL_MS = 1200;

  /* ---------------- time that only runs while the game runs ---------------- */
  let hiddenLayer = false;
  function running() {
    if (D.hidden || hiddenLayer) return false;
    try { if (G.clock && G.clock.started && G.clock.started()) return !!G.clock.running(); } catch (e) {}
    return true;
  }
  /** resolves after `ms` of running time, or as soon as stop() is true (polled) — returns 'time' | 'stop' */
  function waitRun(ms, stop) {
    return new Promise((res) => {
      let left = Math.max(0, ms || 0), last = performance.now();
      const step = () => {
        if (stop && stop()) { res('stop'); return; }
        const now = performance.now();
        if (running()) left -= Math.min(250, now - last);
        last = now;
        if (left <= 0) { res('time'); return; }
        setTimeout(step, Math.max(12, Math.min(50, left)));
      };
      if (left <= 0 && !(stop && stop())) { res('time'); return; }
      setTimeout(step, Math.max(12, Math.min(50, left)));
    });
  }

  /* ---------------- the layer ---------------- */
  let L = null;          // { root, scrim, stack, chipBox, mode, offBack, ro }
  function screenEl() { return D.getElementById('screen') || D.body; }
  function phoneEl() { return D.getElementById('phone'); }
  function ensureLayer(mode) {
    mode = mode === 'react' ? 'react' : 'story';
    if (L && L.root.isConnected) {
      if (L.closing) { L.closing = false; clearTimeout(L.closeT); L.root.classList.remove('out'); L.root.classList.add('in'); }
      setMode(mode);
      return L;
    }
    const root = mk('div', 'c3-card');
    root.setAttribute('data-qa', 'card');
    root.setAttribute('role', 'region');
    const scrim = mk('div', 'c3-scrim');
    const stack = mk('div', 'c3-stack');
    const chipBox = mk('div', 'c3-chipbox');
    stack.appendChild(chipBox);
    root.append(scrim, stack);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    screenEl().appendChild(root);
    L = { root, scrim, stack, chipBox, mode: null, offBack: null, ro: null, closing: false, closeT: 0 };
    setMode(mode);
    root.classList.toggle('c3-hidden', hiddenLayer);
    requestAnimationFrame(() => { if (L && L.root === root) root.classList.add('in'); });
    L.offBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(onBack) : null), null);
    if (typeof ResizeObserver !== 'undefined') { L.ro = new ResizeObserver(measure); L.ro.observe(stack); }
    const ph = phoneEl(); if (ph) ph.classList.add('c3-cards-up');
    measure();
    return L;
  }
  function setMode(mode) {
    if (!L || L.mode === mode) return;
    if (L.mode) L.stack.querySelectorAll('.c3-cbox').forEach((b) => b.remove());   // story ⇄ react: start a clean stack
    L.mode = mode;
    L.root.classList.toggle('story', mode === 'story');
    L.root.classList.toggle('react', mode === 'react');
  }
  function measure() {
    const ph = phoneEl();
    if (!ph) return;
    if (!L || !L.root.isConnected || hiddenLayer) { ph.style.removeProperty('--c3-ch'); return; }
    const r = L.stack.getBoundingClientRect(), s = screenEl().getBoundingClientRect();
    const h = Math.max(0, Math.round(s.bottom - r.top));
    ph.style.setProperty('--c3-ch', h + 'px');
  }
  function dropLayer(fast) {
    if (!L) return;
    const lay = L;
    if (lay.closing) return;
    lay.closing = true;
    lay.root.classList.remove('in'); lay.root.classList.add('out');
    const fin = () => {
      if (L !== lay || !lay.closing) return;
      if (typeof lay.offBack === 'function') safe(lay.offBack);
      if (lay.ro) safe(() => lay.ro.disconnect());
      lay.root.remove();
      L = null;
      const ph = phoneEl(); if (ph) { ph.classList.remove('c3-cards-up'); ph.style.removeProperty('--c3-ch'); }
    };
    lay.closeT = setTimeout(fin, fast ? 0 : 400);
  }
  function maybeDropLayer() { if (!cur && !queue.length && !sheet) dropLayer(); }
  function onBack() {
    if (!L || hiddenLayer || L.closing) return false;
    if (sheet && sheet.editing) { sheet.unedit(); return true; }
    if (cur && cur.tap) cur.tap();
    return true;                                              // back never aborts a script and never leaves the screen under a card
  }
  function keyboardOff() {
    safe(() => {
      if (!(G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())) return;
      const f = G.ui.focusedField && G.ui.focusedField();
      if (sheet && sheet.field && f === sheet.field) return;   // a chip field owns the keyboard
      G.ui.hideKeyboard();
    });
  }

  /* ---------------- cards ---------------- */
  const MAX_VISIBLE = 2;   // the current card + the one before it (older ones leave — the phone UI under the stack stays usable)
  function addBox(st, who, me) {
    const box = mk('div', 'c3-cbox' + (who ? ' named' : me ? ' me' : ' scene'));
    if (who) box.appendChild(mk('div', 'c3-cwho', T(who)));
    const txt = mk('div', 'c3-ctext');
    txt.setAttribute('aria-hidden', 'true');
    box.appendChild(txt);
    box.setAttribute('role', 'button');
    box.tabIndex = 0;
    L.stack.querySelectorAll('.c3-cbox').forEach((b) => { b.classList.add('old'); b.removeAttribute('data-qa'); b.tabIndex = -1; });
    const boxes = L.stack.querySelectorAll('.c3-cbox');
    for (let i = 0; i < boxes.length - (MAX_VISIBLE - 1); i++) boxes[i].remove();
    L.stack.insertBefore(box, L.chipBox);
    box.setAttribute('data-qa', 'card.next');
    if (st && st.id != null) box.dataset.step = String(st.id);
    if (who) box.dataset.who = who;
    requestAnimationFrame(() => box.classList.add('in'));
    return { box, txt };
  }

  const queue = [];
  let cur = null;          // running job
  function norm(script) {
    const out = [];
    const walk = (x) => { if (x == null || x === '' || x === false) return; if (Array.isArray(x)) x.forEach(walk); else out.push(x); };
    walk(script);
    return out;
  }

  async function showText(job, st, raw, me) {
    let text = raw;
    if (typeof text === 'function') text = safe(() => text(job.arg, job.ctx), null);
    if (text == null || text === '') return;
    text = String(T(String(text)));
    ensureLayer(job.opts.mode);
    keyboardOff();
    const who = me ? null : (st.who == null ? null : String(st.who));
    const { box, txt } = addBox(st, who, me);
    box.setAttribute('aria-label', (who ? T(who) + ' ' : '') + text);
    const stepId = st.id != null ? st.id : job.i;
    job.stepId = stepId;
    emit('card:show', { id: job.id, step: stepId, who, me: !!me });
    if (job.opts.onStep) safe(() => job.opts.onStep(st, job.i));
    measure();
    const canTap = st.tap !== false;
    let skipReveal = false, skipGap = false, revealed = false;
    job.tap = () => { if (!canTap) return; if (!revealed) skipReveal = true; else skipGap = true; };
    const onTap = (e) => { if (e && e.type === 'keydown') { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); } job.tap(); };
    box.addEventListener('click', onTap);
    box.addEventListener('keydown', onTap);
    // reveal (70 ms/char · '…' run = one 1.2 s pause)
    const speed = Math.max(0, job.opts.speedMs == null ? 70 : job.opts.speedMs);
    const chars = Array.from(text);
    let shown = '';
    for (let k = 0; k < chars.length; k++) {
      if (job.aborted) break;
      if (skipReveal) { shown = text; break; }
      shown += chars[k];
      txt.textContent = shown;
      if (k % 6 === 0) measure();
      const pause = chars[k] === ELL && chars[k + 1] !== ELL && k < chars.length - 1 ? ELL_MS : speed;
      if (pause > 0) await waitRun(pause, () => skipReveal || job.aborted);
    }
    txt.textContent = text;
    revealed = true;
    box.classList.add('done');
    measure();
    if (job.aborted) return;
    // gap (auto-advance) — a queued script ends the last card's gap at once
    const gap = st.gapMs == null ? 1600 : Math.max(0, st.gapMs);
    const last = job.i >= job.steps.length - 1;
    await waitRun(gap, () => skipGap || job.aborted || (last && queue.length > 0) || job.cutGap);
    job.cutGap = false;
    box.removeEventListener('click', onTap);
    box.removeEventListener('keydown', onTap);
    job.tap = null;
  }

  async function chipStep(job, st) {
    if (job.pending) { safe(() => G.chips.close('replace')); job.pending = null; }
    const keep = !!st.keepOnTimeout && st.timeoutMs > 0;
    const p = G.chips.ask({ id: st.id, chips: st.chips, timeoutMs: keep ? 0 : st.timeoutMs, timeoutPick: st.timeoutPick, ctx: st.ctx, mode: job.opts.mode, _job: job });
    let res;
    if (keep) {
      let got = false;
      p.then((r) => { got = true; res = r; });
      await waitRun(st.timeoutMs, () => got || job.aborted);
      if (!got) {
        job.pending = { id: st.id };
        job.picks[st.id] = null;
        p.then((r) => {
          if (!job.pending || job.pending.id !== st.id) return;
          job.pending = null;
          job.picks[st.id] = r;
          if (r && r.text && echoOn(job, st, r) && !job.aborted && !job.done) {
            job.late = job.late.then(() => showText(job, { id: st.id + ':said', gapMs: 1200 }, r.text, true));
          }
        });
        return;
      }
    } else res = await p;
    job.picks[st.id] = res == null ? null : res;
    if (res && res.text && echoOn(job, st, res) && !job.aborted) await showText(job, { id: st.id + ':said', gapMs: 1200 }, res.text, true);
  }
  function echoOn(job, st, res) {
    if (job.opts.echo === false || !res || res.id === 'keep') return false;
    const c = (st.chips || []).find((x) => x && x.id === res.id);
    return !!(c && (c.verb === 'say' || c.verb === 'send'));
  }

  async function runJob(job) {
    job.steps = norm(job.script);
    job.i = 0;
    job.late = Promise.resolve();
    job.ctx = {
      id: job.id, picks: job.picks, get stepId() { return job.stepId; },
      aborted: () => job.aborted,
      say: (who, text) => showText(job, { who }, text),
    };
    while (job.i < job.steps.length && !job.aborted) {
      let st = job.steps[job.i];
      if (typeof st === 'function') {
        const r = safe(() => st(job.arg, job.ctx), null);
        job.steps.splice(job.i, 1, ...norm(r));
        continue;
      }
      if (typeof st === 'string') st = { who: job.opts.who === undefined ? '엄마' : job.opts.who, text: st };
      if (!st || typeof st !== 'object') { job.i++; continue; }
      if (typeof st.when === 'function' && st.text == null && !st.chips && !st.run) {
        const ok = !!safe(() => st.when(job.picks), false);
        if (Array.isArray(st.steps)) { job.steps.splice(job.i, 1, ...(ok ? norm(st.steps) : [])); continue; }
        job.i += ok ? 1 : 2;
        continue;
      }
      try {
        if (st.run) { await st.run(job.ctx); }
        else if (st.chips) { await chipStep(job, st); }
        else if (st.wait != null && st.text == null) { await waitRun(st.wait, () => job.aborted); }
        else if (st.text != null) { await showText(job, st, st.text); }
      } catch (e) { console.error('[cards] step', job.id, st.id, e); }
      job.i++;
    }
    try { await job.late; } catch (e) {}
    job.done = true;
    if (job.pending) { job.pending = null; safe(() => G.chips.close('end')); }
  }

  async function pump() {
    if (cur || !queue.length) return;
    const job = queue.shift();
    cur = job;
    try { await runJob(job); } catch (e) { console.error('[cards] run', job.id, e); }
    cur = null;
    emit('card:hide', { id: job.id, aborted: !!job.aborted });
    job.resolve({ picks: job.picks, aborted: !!job.aborted });
    if (queue.length) pump(); else maybeDropLayer();
  }

  const CARDS = (G.cards = G.cards || {});
  CARDS.play = function (script, opts) {
    opts = Object.assign({}, opts || {});
    if (!opts.id) dwarn('noid', 'G.cards.play without opts.id');
    return new Promise((resolve) => {
      const job = { id: opts.id || 'cards', opts, script, resolve, picks: {}, aborted: false, done: false, pending: null, tap: null, stepId: null,
        arg: opts.arg !== undefined ? opts.arg : (G.e3 && G.e3.cb ? G.e3.cb : undefined) };
      if (opts.replace && (cur || queue.length)) CARDS.close({ reason: 'replace' });
      queue.push(job);
      pump();
    });
  };
  CARDS.say = function (who, text, o) {
    o = o || {};
    const st = Object.assign({ who: who == null ? null : who, text }, o.step || {});
    if (o.gapMs != null) st.gapMs = o.gapMs;
    if (o.tap === false) st.tap = false;
    return CARDS.play([st], Object.assign({}, o, { id: o.id || 'say' }));
  };
  CARDS.showing = () => !!(cur && !hiddenLayer && L && !L.closing);
  CARDS.current = () => (cur ? { id: cur.id, stepId: cur.stepId } : null);
  CARDS.close = function (o) {
    const reason = (o && o.reason) || 'end';
    const keepOn = (j) => reason !== 'end' && j.opts.abortable === false;
    for (let i = queue.length - 1; i >= 0; i--) {
      const j = queue[i];
      if (keepOn(j)) continue;
      queue.splice(i, 1);
      j.aborted = true;
      emit('card:hide', { id: j.id, aborted: true });
      j.resolve({ picks: j.picks, aborted: true });
    }
    if (cur && !keepOn(cur)) cur.aborted = true;
    if (sheet && !(cur && keepOn(cur) && sheet.job === cur)) G.chips.close(reason);
    if (!cur || cur.aborted) { if (L) dropLayer(); }
  };
  CARDS.hide = function (on) {
    hiddenLayer = !!on;
    if (L) L.root.classList.toggle('c3-hidden', hiddenLayer);
    if (hiddenLayer) keyboardOffIfChip();
    measure();
  };
  function keyboardOffIfChip() { safe(() => { const f = G.ui && G.ui.focusedField && G.ui.focusedField(); if (sheet && f && f === sheet.field) G.ui.hideKeyboard(); }); }
  CARDS.init = function () {
    if (CARDS._inited) return; CARDS._inited = true;
    if (G.bus) G.bus.on('state:reset', () => CARDS.close({ reason: 'end' }));
  };

  /* ---------------- chip sheets ---------------- */
  let sheet = null;        // { id, job, res(), field, editing, unedit() }
  const CHIPS = (G.chips = G.chips || {});
  CHIPS.isOpen = () => !!(sheet && !hiddenLayer);
  CHIPS.close = function (reason) { if (sheet) sheet.finish(null, reason || 'close'); };
  CHIPS.ask = function (o) {
    o = o || {};
    if (sheet) sheet.finish(null, 'replace');
    const id = String(o.id || 'chips');
    const list = (o.chips || []).filter((c) => c && c.id != null);
    return new Promise((resolve) => {
      const lay = ensureLayer(o.mode || (cur && cur.opts.mode) || 'story');
      keyboardOff();
      const box = lay.chipBox;
      box.innerHTML = '';
      const row = mk('div', 'c3-chips');
      const editBox = mk('div', 'c3-chipedit');
      box.append(row, editBox);
      const me = { id, job: o._job || null, field: null, editing: false, done: false };
      sheet = me;
      let timeLeftStop = false;
      const finish = (res, reason) => {
        if (me.done) return;
        me.done = true;
        timeLeftStop = true;
        safe(() => { const f = G.ui && G.ui.focusedField && G.ui.focusedField(); if (me.field && f === me.field) G.ui.hideKeyboard(); });
        if (sheet === me) sheet = null;
        if (box.contains(row)) { row.remove(); editBox.remove(); }
        measure();
        emit('chips:close', { id, pick: res ? res.id : null, reason: reason || (res ? 'pick' : 'none') });
        resolve(res);
        setTimeout(maybeDropLayer, 0);
      };
      me.finish = finish;
      const chipText = (c) => String(T(String(typeof c.label === 'function' ? safe(() => c.label(), '') : c.label || '')));
      const pickRes = (c) => ({ id: c.id, text: chipText(c), edited: false });
      list.forEach((c) => {
        const b = mk('button', 'c3-chip' + (c.edit ? ' edit' : ''));
        b.type = 'button';
        b.setAttribute('data-qa', 'chip.opt:' + c.id);
        b.appendChild(mk('span', null, chipText(c)));
        if (c.edit) { const ic = mk('i', 'c3-pen'); ic.innerHTML = PENCIL; b.appendChild(ic); }
        b.addEventListener('click', () => {
          if (me.done || me.editing) return;
          safe(() => G.audio && G.audio.sfx && G.audio.sfx.tap && G.audio.sfx.tap());
          if (c.edit) openEditor(c); else finish(pickRes(c), 'pick');
        });
        row.appendChild(b);
      });
      function openEditor(c) {
        me.editing = true;
        row.classList.add('away');
        editBox.innerHTML = '';
        const label = chipText(c);
        const verb = VERB[c.verb] || VERB.say;
        const send = mk('button', 'c3-chip-send', verb); send.type = 'button'; send.setAttribute('data-qa', 'chip.send');
        const keep = mk('button', 'c3-chip-keep', KEEP); keep.type = 'button'; keep.setAttribute('data-qa', 'chip.keep');
        const doSend = () => {
          if (me.done) return;
          const text = me.field ? me.field.text().trim() : label;
          if (!text) return;
          const edited = !!(G.e3 && G.e3.norm ? G.e3.norm(text) !== G.e3.norm(label) : text !== label);
          if (edited) safe(() => G.e3 && G.e3.session && G.e3.session.set('chip:' + id, text));
          safe(() => G.audio && G.audio.sfx && G.audio.sfx.msgSend && G.audio.sfx.msgSend());
          finish({ id: c.id, text, edited }, 'pick');
        };
        let field = null;
        if (G.ui && G.ui.field) {
          field = G.ui.field({ mode: 'ko', predict: false, ctx: 'chip:' + id, qa: 'chip.field', cls: 'c3-chip-fld', maxLength: 120,
            multiline: false, submitLabel: verb, onSubmit: doSend,
            onChange: (t) => send.classList.toggle('off', !String(t || '').trim()) });
          field.insert(label);
          me.field = field;
        }
        const fieldNode = field ? field.node : (() => { const n = mk('div', 'fld c3-chip-fld', label); n.setAttribute('data-qa', 'chip.field'); return n; })();
        const btns = mk('div', 'c3-chip-btns', null);
        btns.append(keep, send);
        editBox.append(fieldNode, btns);
        editBox.classList.add('on');
        send.addEventListener('click', doSend);
        keep.addEventListener('click', () => { if (!me.done) finish({ id: 'keep', text: null, edited: false }, 'keep'); });
        measure();
      }
      me.unedit = () => {
        if (!me.editing || me.done) return;
        keyboardOffIfChip();
        me.editing = false;
        me.field = null;
        editBox.classList.remove('on');
        editBox.innerHTML = '';
        row.classList.remove('away');
        measure();
      };
      requestAnimationFrame(() => { row.classList.add('in'); measure(); });
      emit('chips:open', { id });
      // timeout — running time only, paused while a chip field is open
      if (o.timeoutMs > 0) {
        (async () => {
          let left = o.timeoutMs;
          while (!me.done && left > 0) {
            if (me.editing) { await waitRun(250, () => timeLeftStop || !me.editing); continue; }
            const chunk = Math.min(left, 250);
            const r = await waitRun(chunk, () => timeLeftStop || me.editing);
            if (r === 'time') left -= chunk;
          }
          if (me.done) return;
          const tp = o.timeoutPick;
          if (tp == null) finish(null, 'timeout');
          else if (tp === 'keep') finish({ id: 'keep', text: null, edited: false }, 'timeout');
          else { const c = list.find((x) => x.id === tp); finish(c ? pickRes(c) : null, 'timeout'); }
        })();
      }
    });
  };
})();
