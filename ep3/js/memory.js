/* =========================================================
 * 하루를 위한 방탈출! 3 — M7 세아 방 · 엄마의 기억 (ep3/js/memory.js · owner: room) — B14 · B15 · no dread (S10)
 * DESIGN §2.2 #10 · §2.3 증명 9 · §3.13 (M7 cards · callback D / hum · closeups + 엄마's line · memEarly 30 s · fallback 150 s ·
 * the memory chain · M8 = memoryDone + 20 s · resume) · §4.11.2 · §6.2 B14 B15 · §6.3 / §8.3-7 (lamp · 엄마 at the bed end) ·
 * §9.2 resume rows · §9.4 D · §12.2 V5 V8.  ARCH §5.13 (G.memory) · §5.20 (sched ids mem:*) · §6.4 (G.STORY.setpiece.memory).
 *
 *   G.memory = { init(), resume(), active() → bool (the memory chain is on screen) }
 * Listens: 'flag:M7' (start) · 'flag:drawingSeen' (before M7 → vars.memEarly) · 'room:closeup' {id, open} (a 세아 방 close-up
 *   opened while 엄마 is in the room after M7 → her line → the memory) · 'flag:memoryDone' (→ M8 sched).
 * Sched (G.e3.sched): mem:early (pm(M7) + 30 s, only with memEarly) · mem:fb (pm(M7) + 150 s) · mem:M8 (pm(memoryDone) + 20 s).
 * Calls: G.cards.play · G.room.where('sr') / set / refresh · G.e3.momAt('sr') · G.e3.cb('D') · G.audio.cue/sub · G.director.mark.
 * Flags set: memoryStart memoryDone M8. Vars: vars.memEarly · vars.seq.m7 ('cards' | 'idle' | 'memory' | 'done').
 * Bus out: 'memory:start' · 'memory:done'.
 * Strings: G.STORY.setpiece.memory only (DESIGN §4.11.2 verbatim). 엄마 never instructs; the start is her action or the player's.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MEM = (G.memory = G.memory || {});

  const E = () => G.ep || G.e3 || null;
  const flag = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const setFlag = (n) => { try { if (G.flag && !G.flag(n)) G.flag(n, true); } catch (e) { console.error('[memory] flag', n, e); } };
  const V = () => (G.state && G.state.vars) || {};
  const pmNow = () => (G.state && typeof G.state.playMs === 'number' ? G.state.playMs : 0);
  const pmOf = (n) => { try { return G.pm ? G.pm(n) : null; } catch (e) { return null; } };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const emit = (ev, d) => { try { G.bus && G.bus.emit(ev, d); } catch (e) {} };
  const on = (ev, fn) => { try { G.bus && G.bus.on(ev, fn); } catch (e) {} };
  const cue = (id, o) => { try { G.audio && G.audio.cue && G.audio.cue(id, o || {}); } catch (e) {} };
  const sub = (id) => { try { G.audio && G.audio.sub && G.audio.sub(id); } catch (e) {} };
  const mark = (id) => { try { G.director && G.director.mark && G.director.mark(id); } catch (e) {} };
  const roomSet = (k, v) => { try { G.room && G.room.set && G.room.set(k, v); } catch (e) {} };
  const roomRefresh = () => { try { G.room && G.room.refresh && G.room.refresh(); } catch (e) {} };
  const where = (v, o) => { try { if (G.room && G.room.where) return G.room.where(v, o); } catch (e) {} if (v !== undefined) V().where = v; return V().where || 'lv'; };
  const momAt = (v) => { try { if (E() && E().momAt) return E().momAt(v); } catch (e) {} if (v !== undefined) V().momAt = v; return V().momAt || 'table'; };
  const cb = (k) => { try { return E() && E().cb ? E().cb(k) : undefined; } catch (e) { return undefined; } };
  const SP = () => (G.STORY && G.STORY.setpiece && G.STORY.setpiece.memory) || {};
  const seq = () => { const v = V(); if (!v.seq || typeof v.seq !== 'object') v.seq = { m1: null, m6: null, m7: null, m8: null }; return v.seq; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* persistent scheduler (core) — in-memory stand-in for partial builds */
  const LOCAL = { q: [], h: [] };
  const S = {
    core: () => !!(E() && E().sched && E().sched.at),
    at(at, id, data) { if (S.core()) return E().sched.at(at, id, data); S.cancel(id); LOCAL.q.push({ at, id, data }); return id; },
    cancel(id) { if (S.core()) return E().sched.cancel(id); LOCAL.q = LOCAL.q.filter((e) => e.id !== id); },
    has(id) { return S.core() ? E().sched.has(id) : LOCAL.q.some((e) => e.id === id); },
    on(key, fn) { if (S.core()) E().sched.on(key, fn); LOCAL.h.push({ key, fn }); },
  };
  function localRun() {
    if (S.core() || !LOCAL.q.length) return;
    const now = pmNow();
    LOCAL.q.slice().forEach((e) => {
      if (e.at > now) return;
      LOCAL.q = LOCAL.q.filter((x) => x !== e);
      const h = LOCAL.h.find((x) => e.id.indexOf(x.key) === 0);
      if (h) try { h.fn(e.data, e.id); } catch (err) { console.error('[memory] sched', e.id, err); }
    });
  }

  /** plain strings in the chain are 엄마's name cards (ARCH §6.4) */
  const norm = (s) => (typeof s === 'string' ? { who: '엄마', text: s } : s);
  function play(steps, id) {
    steps = [].concat(steps).filter(Boolean).map(norm);
    try {
      if (G.cards && G.cards.play) return Promise.resolve(G.cards.play(steps, { id: 'mem:' + (id || 'room'), mode: 'story' })).catch((e) => { console.error('[memory] cards', e); return { picks: {}, aborted: true }; });
    } catch (e) { console.error('[memory] cards', e); }
    let ms = 0;
    steps.forEach((s) => { if (s.run) try { s.run({}); } catch (e) {} if (s.wait) ms += s.wait; else if (typeof s.text === 'string') ms += s.text.length * 70 + (s.gapMs || 1600); });
    return new Promise((r) => setTimeout(() => r({ picks: {}, aborted: false }), Math.min(ms, 60000)));
  }

  /* ---------------- M7 (05:05): 엄마 goes to 세아 방 · {N} follows · the desk lamp · callback D or the hum ---------------- */
  let m7Running = false, pending = null, chainRunning = false;
  async function startM7(resumed) {
    if (m7Running || flag('memoryStart') || !flag('M7')) return;
    m7Running = true;
    seq().m7 = 'cards'; save();
    mark('B14');
    schedTimers();
    const d = SP();
    const steps = [].concat(d.m7 || []).map(norm);
    const at = (id) => steps.findIndex((s) => s && s.id === id);
    const ins = (id, run, after) => { const k = at(id); const r = { id: id + (after ? 'After' : 'Run'), run }; if (k < 0) steps.push(r); else steps.splice(after ? k + 1 : k, 0, r); };
    // B14 ledger: chair → slippers 270° → 30° (4 s) → door.sr → listener L0 → LS → switch.lamp → bed.creak
    ins('up', () => { roomSet('momPos', 'moving'); cue('chair.creak', { src: 'momSeat' }); cue('mom.slippers', { path: [{ dt: 0, src: 'momSeat' }, { dt: 4.0, src: 'srDoor' }] }); });
    ins('follow', () => { momAt('sr'); where('sr', { view: 'r3_sr_bed' }); cue('door.sr', { src: 'srDoor' }); roomRefresh(); });
    ins('lamp', () => { roomSet('srLamp', 'lit'); roomSet('srGap', 0.45); cue('switch.lamp', { src: 'srLamp' }); });
    ins('lamp', () => { roomSet('momPos', null); cue('bed.creak', { src: 'srMom' }); roomRefresh(); }, true);
    if (resumed) { applyM7State(); }
    else await play(steps, 'm7');
    if (flag('memoryStart')) { m7Running = false; return; }
    await sleep(3000);
    if (!flag('memoryStart')) {
      if (cb('D')) await play([d.cbD], 'cbD');                              // §9.4 D: '그 노래 끝까지 들었어요? 다섯째 음…'
      else {
        const hum = [].concat(d.hum || []).map(norm);
        const k = hum.findIndex((s) => s && s.id === 'hum');
        hum.splice(k < 0 ? 0 : k + 1, 0, { id: 'humRun', run: () => { cue('hum.mom', { src: 'srMom' }); sub('S14'); } });
        await play(hum, 'hum');
      }
    }
    m7Running = false;
    if (seq().m7 === 'cards') { seq().m7 = 'idle'; save(); }
    if (pending && !flag('memoryStart')) { const p = pending; pending = null; startMemory(p); }
  }
  function applyM7State() {
    momAt('sr'); where('sr', { view: 'r3_sr_bed' });
    roomSet('srLamp', 'lit'); roomSet('srGap', 0.45); roomSet('momPos', null);
    roomRefresh();
  }
  function schedTimers() {
    const t0 = pmOf('M7') != null ? pmOf('M7') : pmNow();
    if (V().memEarly && !flag('memoryStart') && !S.has('mem:early')) S.at(t0 + 30000, 'mem:early');
    if (!flag('memoryStart') && !S.has('mem:fb')) S.at(t0 + 150000, 'mem:fb');
  }

  /* ---------------- the memory (§3.13 기억) ---------------- */
  const CU_KIND = { c3_orgel_spot: 'orgel', c3_manual: 'manual', c3_doorframe: 'frame', c3_drawing: 'drawing', c3_drawing_back: 'drawing' };
  function sameRoom() { return (V().where || 'lv') === 'sr' && momAt() === 'sr' && !(G.room && G.room.get && G.room.get('momPos')); }
  function onCloseup(e) {
    if (!e || !e.open || !CU_KIND[e.id]) return;
    if (!flag('M7') || flag('memoryStart') || chainRunning) return;
    if (!sameRoom()) return;                                                // M7 전 · 엄마가 없는 방: captions only
    if (m7Running) { pending = CU_KIND[e.id]; return; }                     // after the M7 cards, in order
    startMemory(CU_KIND[e.id]);
  }
  /** kind: 'orgel' | 'manual' | 'frame' (her line → '엄마가 책상 위 그림을 집는다.') · 'drawing' (straight in) · 'early' · 'fallback' */
  async function startMemory(kind) {
    if (chainRunning || flag('memoryStart')) return;
    chainRunning = true;
    S.cancel('mem:early'); S.cancel('mem:fb');
    const d = SP(), lead = [];
    if (kind === 'orgel' || kind === 'manual' || kind === 'frame') {
      const line = (d.spots || {})[kind];
      if (line) await play([{ who: '엄마', text: line }], 'line');
    } else if (kind === 'early') await play([d.early], 'early');
    else if (kind === 'fallback') await play([d.fallback], 'fallback');
    if (flag('memoryStart')) { chainRunning = false; return; }
    setFlag('memoryStart');
    seq().m7 = 'memory'; save();
    mark('B15');
    emit('memory:start', { by: kind });
    if (kind === 'orgel' || kind === 'manual' || kind === 'frame') lead.push(d.pick);   // §3.13 ⊕ — the drawing is in her hands on every path
    await runChain(lead);
  }
  async function runChain(lead) {
    chainRunning = true;
    const d = SP();
    const steps = [].concat(lead || [], d.chain || []).filter(Boolean).map(norm);
    await play(steps, 'chain');
    // '…부엌에 가 있을게요.' — 엄마 gets up from the bed end and goes to the kitchen (B15 end)
    cue('bed.creak', { src: 'srMom' });
    cue('mom.slippers', { path: [{ dt: 0, src: 'srMom' }, { dt: 2.4, src: 'srDoor' }, { dt: 5.0, src: 'momSeat' }] });
    roomSet('momPos', 'moving');
    chainRunning = false;
    setFlag('memoryDone');
    seq().m7 = 'done'; save();
    emit('memory:done', {});
  }
  function schedM8() {
    if (flag('M8') || !flag('memoryDone')) return;
    const t = pmOf('memoryDone');
    if (!S.has('mem:M8')) S.at((t != null ? t : pmNow()) + 20000, 'mem:M8');
  }

  /* ---------------- resume (§3.22 · §9.2: M7 ∧ ¬memoryStart → sr B · memoryStart ∧ ¬memoryDone → chain from line 1) ---------------- */
  MEM.resume = function () {
    if (!flag('M7') || flag('M8')) return;
    if (flag('memoryDone')) { roomSet('momPos', 'moving'); schedM8(); return; }
    if (flag('memoryStart')) {
      applyM7State();
      if (!chainRunning) runChain([]);
      return;
    }
    if (seq().m7 === 'cards' || !seq().m7) { if (!m7Running) startM7(true); return; }
    applyM7State();
    schedTimers();
  };
  MEM.active = () => chainRunning;

  let inited = false;
  MEM.init = function () {
    if (inited) return; inited = true;
    S.on('mem:', (data, id) => {
      if (id === 'mem:early') { if (flag('M7') && !flag('memoryStart') && !chainRunning) { if (m7Running) pending = 'early'; else startMemory('early'); } return; }
      if (id === 'mem:fb') { if (flag('M7') && !flag('memoryStart') && !chainRunning) { if (m7Running) pending = 'fallback'; else startMemory('fallback'); } return; }
      if (id === 'mem:M8') { if (flag('memoryDone') && !flag('M8')) setFlag('M8'); }
    });
    // deferred one turn: a haru.jump past M7 (M8 · END) sets the later flags in the same turn — then the M7 cards never start
    on('flag:M7', () => setTimeout(() => { if (!seq().m7 && !flag('M8') && !flag('END')) startM7(false); }, 0));
    on('flag:drawingSeen', () => { if (!flag('M7')) { V().memEarly = true; save(); } });
    on('room:closeup', onCloseup);
    on('flag:memoryDone', () => schedM8());
    on('tick', localRun);
  };
})();
