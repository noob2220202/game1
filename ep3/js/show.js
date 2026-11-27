/* =========================================================
 * ep3/js/show.js — `엄마에게 보여 드리기` (shell · ARCH_EP3 §5.9 · DESIGN_EP3 §3.2.2 · §4.0 · §4.10 · §5.3 · §5.8 · §12.2 V19 · V21).
 * A game-layer button (not an app): always the same place and shape from gotPhone until the M8 card chain starts. Pressing it
 * shows mom the current phone screen (G.phone.top()'s data-scr): if {N} is not where mom is → one position card (facts only);
 * otherwise the phone tilts 0.4 s toward her and the reaction of G.STORY.show for that screen id plays (react-mode cards).
 *
 * Public API — G.show
 *   init()                                   button · bus listeners · DEBUG haru.show(scr) (idempotent)
 *   enabled() → bool                         gotPhone ∧ ¬M8 card chain (bus 'climax:m8cards' · flag M8 · playArmed)
 *   dim() → bool                             opacity .4 + inert: S7 (card) ∨ S8 (chip sheet) ∨ S9 (call screen / modal) ∨ (M6 ∧ clock < 04:41)
 *   scr() → string                           top screen id · 'camera.<view>' · 'easy.home' · 'home'
 *   press() → Promise                        (data-qa show.btn)
 *   dndChip({ ctx:'show'|'tail', timeoutMs }) → Promise<bool>   the one DND chip (said ⇒ flag dndChipSaid) — flow ending calls it
 *                                            with ctx 'tail' (10 s); in the show reaction it runs inside the card script (20 s)
 * Bus emitted: show:press {scr} · show:react {scr, key, second}. Bus listened: flag · tick · card:show · card:hide · chips:open ·
 *   chips:close · call:start · call:end · climax:m8cards · state:load.
 * Flags set: momBlock · mom331 · momDnd · momMembers · momBom · glasses · dndChipSaid.  Stage: e3_dnd = true (via G.e3.stage at momDnd).
 * Vars: showSeen {key:1} (a chain seen to its end — then `엄마가 고개를 끄덕인다.`) · sh.showN (neutral rotation index).
 * Calls (guarded): G.cards.play / G.chips.ask (core) · G.e3.where / momAt / stage (core) · G.phone.top / inCall / modalOpen (shell) ·
 *   G.room.isOpen / current (room) · G.easy.on (shell) · G.clock (engine).
 * data-qa: show.btn.  Layer: .sh3-show z 60 (mobile: left-edge tab in the header row · desktop ≥ 600 px: outside the frame, top-left).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UTIL = G.util || {};
  const el = UTIL.el || function (tag) { return document.createElement(String(tag).split(/[.#]/)[0] || 'div'); };
  const sleep = UTIL.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const T = (s) => { if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[show]', e); return d; } };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const vget = (k, d) => { const v = G.state && G.state.vars ? G.state.vars[k] : undefined; return v === undefined ? d : v; };
  const vset = (k, v) => { if (G.vars) G.vars(k, v); else if (G.state && G.state.vars) G.state.vars[k] = v; };
  const SH = () => { const v = (G.state && G.state.vars) || {}; if (!v.sh || typeof v.sh !== 'object') v.sh = {}; return v.sh; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const D = () => (G.STORY && G.STORY.show) || {};
  const reduced = () => { try { return !!((G.settings && G.settings.reduceShake) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)); } catch (e) { return false; } };
  const ICON = (G.ICONS && G.ICONS.showHands && G.ICONS.showHands.svg) || '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7.4" y="1.8" width="9.2" height="13.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.7 4.3h2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.4 10.2c.8 2.7 2 5 3.8 6.9 1.5 1.6 3.4 2.6 5.8 2.6s4.3-1 5.8-2.6c1.8-1.9 3-4.2 3.8-6.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.4 17.2l1.7-2.6M17.6 17.2l-1.7-2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  const S = (G.show = G.show || {});
  let btn = null, m8chain = false, running = false, tiltOn = false;

  /* ---------------- state ---------------- */
  S.enabled = function () {
    if (!flag('gotPhone')) return false;
    if (m8chain || flag('M8') || flag('playArmed')) return false;          // §3.2.2 — M8 카드 직전까지 (M8부터 그리지 않는다)
    return true;
  };
  const clockBefore = (hm) => { try { return !(G.clock && G.clock.passed && G.clock.passed(hm)); } catch (e) { return false; } };
  S.dim = function () {
    if (running) return true;
    if (G.cards && G.cards.showing && safe(() => G.cards.showing(), false)) return true;                       // S7
    if (G.chips && G.chips.isOpen && safe(() => G.chips.isOpen(), false)) return true;                         // S8
    if (G.phone && ((G.phone.inCall && safe(() => G.phone.inCall(), false)) || (G.phone.modalOpen && safe(() => G.phone.modalOpen(), false)))) return true;   // S9
    if (flag('M6') && clockBefore('04:41')) return true;                                                       // 04:40:00–04:41
    return false;
  };
  /** the screen id mom would see now (DESIGN §5.8) */
  S.scr = function () {
    const P = G.phone || {};
    const top = P.top ? safe(() => P.top(), null) : null;
    const room = G.room && G.room.isOpen && safe(() => G.room.isOpen(), false) ? safe(() => G.room.current(), null) : null;
    if (room && room.mode === 'camera') {
      const rn = top && top.node;
      if (!rn || !(rn.dataset && rn.dataset.scr) || /^camera\./.test(rn.dataset.scr) || (rn.matches && rn.matches('[data-qa="room.camera"], .rm3-camera'))) {
        return 'camera.' + (room.closeup ? 'closeup.' + room.closeup : (room.view || ''));
      }
    }
    if (top) { const s = (top.node && top.node.dataset && top.node.dataset.scr) || top.scr; if (s) return s; return 'app.' + (top.appId || ''); }
    if (P.isLocked && safe(() => P.isLocked(), false)) return 'easy.lock';
    return G.easy && G.easy.on && safe(() => G.easy.on(), false) ? 'easy.home' : 'home';
  };

  /* ---------------- the button (always the same place · same shape — §3.2.2 · §10 A) ---------------- */
  function build() {
    if (btn) return btn;
    const label = T(D().label || '엄마에게 보여 드리기');
    btn = el('button.sh3-show', { type: 'button', 'data-qa': 'show.btn', 'aria-label': label, title: label },
      el('span.sh3-show-i', { html: ICON }), el('span.sh3-show-t', null, label));
    btn.addEventListener('click', (e) => { e.stopPropagation(); S.press(); });
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    const host = document.getElementById('stage') || document.body;
    host.appendChild(btn);
    return btn;
  }
  let lastVis = null, lastDim = null;
  function refresh() {
    const on = S.enabled();
    const scr = document.getElementById('screen');
    if (scr) scr.classList.toggle('sh3-gut', on);                         // header left gutter for the mobile tab (easy.css)
    if (!on) { if (btn) { btn.classList.remove('in'); btn.hidden = true; } lastVis = false; return; }
    build();
    if (lastVis !== true) { btn.hidden = false; requestAnimationFrame(() => btn && btn.classList.add('in')); lastVis = true; }
    const dim = S.dim();
    if (dim !== lastDim) {
      lastDim = dim;
      btn.classList.toggle('dim', dim);
      btn.setAttribute('aria-disabled', String(dim));
      btn.tabIndex = dim ? -1 : 0;
    }
    const eye = scr && scr.classList.contains('eye-mode');
    btn.classList.toggle('eye', !!eye);
  }
  S.refresh = refresh;

  /* ---------------- phone tilt toward mom (0.4 s — §3.2.2 · §4.10) ---------------- */
  function tilt(on, side) {
    const ph = document.getElementById('phone');
    if (!ph || reduced()) return;
    if (on && !tiltOn) { tiltOn = true; ph.classList.add('sh3-tilt', side === 'sr' ? 'to-r' : 'to-l'); }
    else if (!on && tiltOn) { tiltOn = false; ph.classList.remove('sh3-tilt', 'to-r', 'to-l'); }
  }

  /* ---------------- reactions ---------------- */
  function findReact(scr) {
    const R = D().react || {};
    if (R[scr]) return { key: scr, r: R[scr] };
    for (const k of Object.keys(R)) { const r = R[k]; if (Array.isArray(r.also) && r.also.indexOf(scr) >= 0) return { key: k, r }; }
    return null;
  }
  /** §5.9 — the 03:31 row of the top node is ≥ 60 % inside the viewport */
  function rowVisible(rowId) {
    const top = G.phone && G.phone.top ? safe(() => G.phone.top(), null) : null;
    const node = top && top.node;
    if (!node) return false;
    const row = node.querySelector('[data-row="' + rowId + '"]');
    if (!row) return false;
    const r = row.getBoundingClientRect();
    if (!r.height) return false;
    let lo = r.top, hi = r.bottom;
    const clip = (b) => { lo = Math.max(lo, b.top); hi = Math.min(hi, b.bottom); };
    const scrEl = document.getElementById('screen'); if (scrEl) clip(scrEl.getBoundingClientRect());
    let p = row.parentElement;
    while (p && p !== node.parentElement) {
      const cs = safe(() => getComputedStyle(p), null);
      if (cs && /(auto|scroll|hidden)/.test(cs.overflowY + cs.overflow)) clip(p.getBoundingClientRect());
      p = p.parentElement;
    }
    return Math.max(0, hi - lo) / r.height >= 0.6;
  }
  function photoCtx() {
    const top = G.phone && G.phone.top ? safe(() => G.phone.top(), null) : null;
    const n = top && top.node;
    if (!n) return {};
    const p = (n.dataset && n.dataset.photo) || ((n.querySelector && n.querySelector('[data-photo]')) || { dataset: {} }).dataset.photo;
    return { photo: p || null };
  }
  const nameCard = (t) => (typeof t === 'string' ? { who: '엄마', text: t } : t);
  /** DESIGN lines → G.cards steps (strings = 엄마 · functions evaluated with ctx · {dndChip} · {ifSaid, ifSilent}) */
  function toSteps(lines, ctx, key) {
    const out = [];
    (lines || []).forEach((ln, i) => {
      if (typeof ln === 'function') { const v = safe(() => ln(ctx), null); if (v != null && v !== '') out.push(nameCard(v)); return; }
      if (ln && ln.dndChip) {
        const C = D().dndChip || {};
        out.push({ id: C.id || 'dndSay', chips: C.chips || [], timeoutMs: 20000, timeoutPick: 'none' });
        out.push({ id: 'dndSaid', run: (c) => { const p = c.picks[C.id || 'dndSay']; if (p && p.id === 'say') setFlag('dndChipSaid'); } });
        return;
      }
      if (ln && (ln.ifSaid || ln.ifSilent)) {
        const C = D().dndChip || {};
        const said = (p) => !!(p[C.id || 'dndSay'] && p[C.id || 'dndSay'].id === 'say');
        out.push({ id: key + ':said', when: (p) => said(p), steps: (ln.ifSaid || []).map(nameCard) });
        out.push({ id: key + ':silent', when: (p) => !said(p), steps: (ln.ifSilent || []).map(nameCard) });
        return;
      }
      if (ln != null) out.push(Object.assign({ id: key + ':' + i }, nameCard(ln)));
    });
    return out;
  }
  async function play(script, id) {
    if (!G.cards || !G.cards.play) return { aborted: true };
    return (await safe(() => G.cards.play(script, { id: 'show:' + id, mode: 'react' }), null)) || { aborted: true };
  }
  /** run the reaction of a screen id (no position check — the debug helper uses it directly) */
  async function react(scr) {
    const Dd = D();
    let found = findReact(scr);
    if (found && found.r.needRow && scr === found.key && !rowVisible(found.r.needRow)) found = null;   // phone.recent: the 03:31 row must be on screen
    if (found && found.r.beforeM8 && flag('M8')) found = null;
    const steps = [];
    if (flag('easyOff') && !flag('glasses')) { setFlag('glasses'); steps.push({ id: 'glasses', who: null, text: Dd.glasses }); }   // §3.2.2 — once, after easyOff
    let key = null, second = false;
    if (!found) {
      const N = Dd.neutral || [];
      if (N.length) { const i = (SH().showN | 0) % N.length; SH().showN = i + 1; save(); steps.push(Object.assign({ id: 'neutral' }, N[i])); }
      key = 'neutral';
    } else {
      key = found.key;
      const r = found.r;
      const seen = vget('showSeen', {}) || {};
      second = !!seen[key];
      if (r.flag) setFlag(r.flag);                                            // the check is that mom saw it (kept even if M6 cuts the chain)
      if (r.flag === 'momDnd' || (r.stage && r.stage[0] === 'e3_dnd')) { if (G.e3 && G.e3.stage) safe(() => G.e3.stage(r.stage ? r.stage[0] : 'e3_dnd', r.stage ? r.stage[1] : true)); }
      if (second) steps.push({ id: 'again', who: null, text: Dd.again });
      else steps.push(...toSteps(r.lines, photoCtx(), key));
    }
    G.bus && G.bus.emit('show:react', { scr, key, second });
    const m6At = flag('M6');
    const res = await play(steps, key);
    const cut = !!(res && res.aborted) || (!m6At && flag('M6'));
    if (!cut && found && !second) { const seen = Object.assign({}, vget('showSeen', {}) || {}); seen[key] = 1; vset('showSeen', seen); }
    return !cut;
  }
  S.press = async function () {
    if (running || !S.enabled() || S.dim()) return;
    const scr = S.scr();
    G.bus && G.bus.emit('show:press', { scr });
    sfx('tap');
    const where = G.e3 && G.e3.where ? safe(() => G.e3.where(), 'lv') : (vget('where', 'lv') === 'sr' ? 'sr' : 'lv');
    const momAt = G.e3 && G.e3.momAt ? safe(() => G.e3.momAt(), 'sr') : vget('momAt', 'sr');
    const momSpace = momAt === 'sr' ? 'sr' : (momAt === 'lv' || momAt === 'table') ? 'lv' : 'hall';
    running = true; refresh();
    try {
      if (momSpace !== where) {                                               // facts only, no flag (§3.2.2)
        const W = D().where || {};
        await play([{ id: 'where', who: null, text: W[momAt] || W[momSpace] || '' }], 'where');
        return;
      }
      tilt(true, momSpace);                                                   // the phone leans toward her 0.4 s …
      await sleep(reduced() ? 0 : 400);
      setTimeout(() => tilt(false), 250);                                     // … and comes back as her reaction starts (text stays crisp)
      await react(scr);
    } catch (e) { console.error('[show] press', e); }
    finally { tilt(false); running = false; refresh(); }
  };

  /** the one DND chip (ARCH §9 G24) — flow ending's tail calls it (ctx 'tail', 10 s); returns whether it was said */
  S.dndChip = async function (o) {
    o = o || {};
    const C = D().dndChip || {};
    if (!G.chips || !G.chips.ask) return false;
    const r = await safe(() => G.chips.ask({ id: C.id || 'dndSay', chips: C.chips || [], timeoutMs: o.timeoutMs || (o.ctx === 'tail' ? 10000 : 20000), timeoutPick: 'none',
      mode: o.ctx === 'show' ? 'react' : 'story' }), null);
    const said = !!(r && r.id === 'say');
    if (said) setFlag('dndChipSaid');
    return said;
  };

  /* ---------------- init ---------------- */
  let inited = false;
  S.init = function () {
    if (inited) return; inited = true;
    const B = G.bus;
    if (B) {
      ['flag', 'card:show', 'card:hide', 'chips:open', 'chips:close', 'call:start', 'call:end', 'state:load', 'clock:min', 'clock:jump', 'quickpanel', 'screen:push', 'screen:pop'].forEach((ev) => B.on(ev, () => refresh()));
      let n = 0;
      B.on('tick', () => { if (++n % 2 === 0) refresh(); });                 // modal sheets open / close without a bus event of their own
      B.on('climax:m8cards', () => { m8chain = true; refresh(); });
    }
    try { new MutationObserver(() => refresh()).observe(document.getElementById('screen') || document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    refresh();
    if (G.DEBUG) { window.haru = window.haru || {}; window.haru.show = (scr) => react(scr || S.scr()); }
  };
})();
