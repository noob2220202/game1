/* =========================================================
 * ep3/js/apps/callrec.js — module ② 통화 녹음 · 텍스트 변환 · 번호 차단 (comms · new app module 2 of 2)
 * DESIGN_EP3 §3.6 · §3.7 · §3.8 · §3.14 (세션) · §3.16 (hook) · §4.3.3–§4.3.6 · §5.5 C1–C11 · §5.8 · §9.5-4 · §9.6 ② ·
 * §12.2 V1 V2 V11 · ARCH_EP3 §5.10 · §5.13 · §5.18 · §6.10 · §6.11 · §7.2 · §7.4.
 *
 * Public API  G.callrec = {
 *   init(), open(screenId, params)   'settings' 'settings.spam' 'settings.reject' 'settings.ring' 'rec.settings' 'rec.list'
 *                                    'rec.player' 'rec.text' 'block' 'block.spam' 'block.calls' 'block.call' 'block.msgs'
 *                                    'block.msg' 'voice'  (= hook 'callrec:open')
 *   recordings(), openList({scrollTo}), openPlayer(id), openText(id),
 *   play(id, {by:'play'|'line'|'seek', line, at}) → handle · pause() · resume() · seek(t) · stop(reason) · state() → {id, t, playing, sess}
 *   session() → {id, sess, s0, by, line, a, b, pausedSec, away, noSig} | null · textOpen() → bool (S5) · sinceStopMs() (S4 '+2 s')
 *   out() → 'ear'|'table' · setting('recAuto'|'spamSw'|'unknownBlock', v?) → bool (only reader/writer of those vars)
 *   blocked: { calls(), messages(), openCalls(), openMessages(), pushMessage(row, {silent}) }
 *   renderBlockedMsgs(node, {hook}) → { push(row) → Promise }   (06:10 hook cut — standard UI, 0.5 s silent slide)
 * }
 * Sessions (§3.14 · §9.6): start = ▶ · line tap · scrub release; pause ≤ 15 s playMs keeps it ('pause'/'resume'), > 15 s → 'abort'
 *   (pause15); scrub · another recording · easy fold · stop → 'abort'; reaching dur → 'end'. covered = [a, b] (one interval, 100 ms
 *   poll of the media position — volume/output independent). away = any poll with playMs < vars.momAwayUntil (sticky). Hidden tab /
 *   pause menu pause the media but never break a session. No buffer ⇒ G.media's silent run of the same length (positions,
 *   lines, events and judging unchanged). DEBUG haru.recRate(x) drives a silent timer at x×.
 * Bus emit    'rec:list' · 'rec:player' {id} · 'rec:session' {id, sess, by, line, s0, a, b, state, reason, out, away} ·
 *             'rec:time' {id, t, sess, a, b, out, away} (100 ms) · 'rec:text' {id, open} · 'block:open' · 'block:bottom'
 * Bus listen  pause {open} · visibility {hidden} · easy:change {on} · state:load · tick (20 s text-screen clock)
 * Hooks set   callrec:open (screenId, params) · callrec:noSig (sess)
 * Flags set   recListOpened recPlayerOpened recPlayed textAnyOpened · (sea0333 only) textOpened greySeen heard21 nameKnown
 *             sigName radioHeard · blockOpened blockBottom
 * Vars        recAuto spamSw unknownBlock (setting()) · cm.{sessN, seaPlayed, recWhich, mine[], blockMsgs[]}
 * App id      voicerec (음성 녹음 — folder) → open('voice')
 * data-scr    callrec.settings · callrec.settings.spam · callrec.settings.reject · callrec.settings.ring · callrec.rec.settings ·
 *             callrec.list · callrec.player (sheet: callrec.player.info) · callrec.text · callrec.block · callrec.block.spam ·
 *             callrec.blocked · callrec.blocked.number · callrec.blockedMsgs · callrec.blockedMsgs.msg · callrec.voice
 * data-qa     callrec.row:block|rec|spam|reject|ring|list · callrec.spam.row · callrec.rec.which · settings.toggle:recAuto ·
 *             rec.item:<id> · rec.item.more:<id> · rec.more · rec.more.text · rec.more.detail · rec.play · rec.seek ·
 *             rec.line:<t> · rec.mini.play · rec.mini.seek · rec.voice.chip:all|plain|call · block.add · block.unknown ·
 *             block.spam · block.calls · block.msgs · block.row:<i> · block.msg:<i> · block.pad.key:<d> · block.pad.del ·
 *             block.pad.ok · block.mine.del:<i>
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.util || {};
  const el = U.el;
  if (!el) { console.error('[comms] callrec: G.util missing'); return; }
  const CR = (G.callrec = G.callrec || {});
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------------- helpers ---------------- */
  const RECS = () => (G.STORY && G.STORY.recordings) || [];
  const UI = () => (G.STORY && G.STORY.callrecUI) || {};
  const BL = () => (G.STORY && G.STORY.blocked) || { calls: [], messages: [] };
  const recById = (id) => RECS().find((r) => r.id === id) || null;
  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const pmNow = () => (G.state && G.state.playMs) || 0;
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const emit = (ev, d) => { try { G.bus && G.bus.emit(ev, d); } catch (e) {} };
  const CMV = () => { const v = (G.state && G.state.vars) || {}; if (!v.cm || typeof v.cm !== 'object') v.cm = {}; return v.cm; };
  const now = () => { try { return G.clock && G.clock.now ? G.clock.now() : new Date(2027, 0, 24, 3, 50); } catch (e) { return new Date(2027, 0, 24, 3, 50); } };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const pd = (s) => { const m = String(s || '').match(/(\d+)-(\d+)-(\d+)/); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
  const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDay = (ymd) => {
    try { if (G.e3 && G.e3.fmtDate) { const r = G.e3.fmtDate(ymd); if (r) return r; } } catch (e) {}
    const d = pd(ymd); if (!d) return '';
    if (ymd === ymdOf(now())) return '오늘';
    return (d.getFullYear() === now().getFullYear() ? '' : d.getFullYear() + '년 ') + `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
  };
  const fmt12 = (hm) => {
    try { if (G.e3 && G.e3.fmt12) { const r = G.e3.fmt12(hm); if (r) return r; } } catch (e) {}
    const m = String(hm || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return '';
    const h = +m[1]; return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m[2]}`;
  };
  const mss = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const isTop = (node) => { try { const t = G.phone && G.phone.top && G.phone.top(); return !!(t && t.node === node) && node.isConnected; } catch (e) { return false; } };
  const visClock = (() => { let hid = null, tot = 0; document.addEventListener('visibilitychange', () => { if (document.hidden) hid = performance.now(); else if (hid != null) { tot += performance.now() - hid; hid = null; } }); return () => ((hid != null ? hid : performance.now()) - tot) / 1000; })();
  const SVG = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a.8.8 0 001.2.7l10.6-6.8a.8.8 0 000-1.4L9.2 4.5A.8.8 0 008 5.2z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="18.5" r="1.9" fill="currentColor"/></svg>',
    moreH: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 11.5a6 6 0 0012 0M12 17.5v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  /* ---------------- screens (shell G.ui.screen · data-scr per ARCH_EP3 §5.10 mapping) ---------------- */
  const SCR = { settings: 'callrec.settings', 'settings.spam': 'callrec.settings.spam', 'settings.reject': 'callrec.settings.reject', 'settings.ring': 'callrec.settings.ring',
    'rec.settings': 'callrec.rec.settings', 'rec.list': 'callrec.list', 'rec.player': 'callrec.player', 'rec.text': 'callrec.text', block: 'callrec.block',
    'block.spam': 'callrec.block.spam', 'block.calls': 'callrec.blocked', 'block.call': 'callrec.blocked.number', 'block.msgs': 'callrec.blockedMsgs',
    'block.msg': 'callrec.blockedMsgs.msg', voice: 'callrec.voice' };
  CR.SCR = SCR;
  function screen(id, title, body, o) {
    o = o || {};
    let node;
    const opt = { title: T(title || ''), back: true, body, right: o.right || [], footer: o.footer || null, cls: 'cr3-scr' + (o.cls ? ' ' + o.cls : ''), theme: o.theme || 'light' };
    if (G.ui && G.ui.screen) node = G.ui.screen(opt);
    else {
      node = el('section.cr3-scr', null, el('header.sv-head', null, el('button.sv-back', { type: 'button', 'data-qa': 'nav.back', onclick: () => G.phone && G.phone.back && G.phone.back() }, '‹'), el('div.sv-titles', null, el('div.sv-title', null, T(title || ''))), el('div.sv-right', null, o.right || [])), el('div.sv-body', null, body));
      node.body = node.querySelector('.sv-body');
    }
    node.dataset.scr = SCR[id] || id;
    node.dataset.status = o.theme === 'dark' ? 'light' : 'dark';
    node.addEventListener('contextmenu', (e) => e.preventDefault());
    return node;
  }
  function push(node, o) {
    o = o || {};
    const appId = (G.phone && G.phone.currentApp) || 'phone';
    if (G.phone && G.phone.push) return G.phone.push(node, Object.assign({ anim: 'slide', appId }, o));
    const h = document.getElementById('app-stack') || document.getElementById('screen') || document.body; h.appendChild(node); return { node };
  }
  const rowBtn = (qa, label, value, onClick, o) => {
    o = o || {};
    const b = el(onClick ? 'button.cr3-row' : 'div.cr3-row.plain', { type: onClick ? 'button' : null, 'data-qa': qa || null, onclick: onClick ? () => { sfx('tap'); onClick(); } : null },
      el('span.cr3-row-t', null, T(label)), value != null && value !== '' ? el('span.cr3-row-v', null, T(value)) : null, o.tail || null, onClick && o.chev !== false ? el('i.cr3-chev', { html: SVG.chev }) : null);
    return b;
  };
  function toggle(on, qa, fn) {
    if (G.mdu && G.mdu.toggle) return G.mdu.toggle(on, qa, fn);
    const t = el('button.cr3-tg' + (on ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'data-qa': qa });
    t.addEventListener('click', (e) => { e.stopPropagation(); const v = !t.classList.contains('on'); t.classList.toggle('on', v); t.setAttribute('aria-checked', v ? 'true' : 'false'); sfx('tap'); fn && fn(v); });
    return t;
  }
  function sheet(o) {
    if (G.phone && G.phone.sheet) {
      return G.phone.sheet({ title: o.title, body: o.body, buttons: (o.buttons || []).map((b) => ({ label: b[1], value: b[0] })), cls: o.cls,
        mount: (fin, box) => { (o.buttons || []).forEach((b) => { const n = box.querySelector('[data-qa="sheet.btn:' + b[0] + '"]'); if (n && b[2]) n.setAttribute('data-qa', b[2]); }); if (o.scr) box.dataset.scr = o.scr; if (o.mount) o.mount(fin, box); },
        onClose: o.onClose });
    }
    return Promise.resolve((o.buttons && o.buttons[0] && o.buttons[0][0]) || null);
  }
  /** "drawn": ≥ 60 % visible for 200 ms (playMs while the clock runs — DESIGN §9.5-4) and the screen is the top */
  function watchDrawn(node, scr, cb) {
    let vis = false, since = null, done = false, tmr = 0, io = null;
    const t = () => (G.clock && G.clock.running && G.clock.running() ? pmNow() : performance.now());
    const check = () => {
      clearTimeout(tmr);
      if (done || !node.isConnected) return;
      if (vis && isTop(scr) && !document.hidden) { if (since == null) since = t(); if (t() - since >= 200) { done = true; if (io) io.disconnect(); cb(); return; } }
      else since = null;
      if (vis) tmr = setTimeout(check, 100);
    };
    if (!('IntersectionObserver' in window)) { vis = true; check(); return () => { done = true; }; }
    io = new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting && e.intersectionRatio >= 0.6; check(); }), { threshold: [0, 0.6, 1] });
    io.observe(node);
    return () => { done = true; clearTimeout(tmr); if (io) io.disconnect(); };
  }

  /* ---------------- settings (the three switches — ARCH_EP3 §5.4 vars) ---------------- */
  const SET_DEF = { recAuto: true, spamSw: true, unknownBlock: false };
  CR.setting = function (key, v) {
    if (!(key in SET_DEF)) return false;
    const vars = (G.state && G.state.vars) || {};
    if (v === undefined) return vars[key] === undefined ? SET_DEF[key] : !!vars[key];
    if (G.vars) G.vars(key, !!v); else vars[key] = !!v;
    emit('callrec:setting', { key, v: !!v });
    return !!v;
  };

  /* =========================================================
   * playback · sessions
   * ========================================================= */
  const P = { h: null, id: null, s: null, lastStop: null, poll: 0, rate: 1, ending: false, autoPaused: null, lastT: null, held: {} };
  const bufs = {};
  function bufP(rec) {
    if (!rec || !rec.buffer) return Promise.resolve(null);
    if (!bufs[rec.id]) {
      let b = null; try { b = G.audio && G.audio.buffer ? G.audio.buffer(rec.buffer) : null; } catch (e) { b = null; }
      bufs[rec.id] = Promise.resolve(b).then((x) => (x && typeof x.getChannelData === 'function' ? x : null), () => null);
    }
    return bufs[rec.id];
  }
  function releaseBuf(id) { if (id && id !== 'sea0333' && P.id !== id && !Array.from(views).some((v) => v.id === id)) delete bufs[id]; }
  CR.out = function () {
    try { if (G.media && typeof G.media.out === 'function') { const o = G.media.out(); if (o === 'ear' || o === 'table') return o; } } catch (e) {}   // audio's route (one source)
    try { if (G.EP && typeof G.EP.mediaRoute === 'function') return G.EP.mediaRoute() === 'table' ? 'table' : 'ear'; } catch (e) {}
    const where = (G.state && G.state.vars && G.state.vars.where) || 'lv';
    return flag('playArmed') && where === 'lv' ? 'table' : 'ear';
  };
  const awayNow = () => { const u = G.state && G.state.vars && G.state.vars.momAwayUntil; return Number.isFinite(u) && pmNow() < u; };
  /** silent timer handle (no G.media · DEBUG recRate) — same surface as a G.media handle */
  function virtualHandle(rec, offset) {
    const h = { id: rec.id, duration: rec.dur, _pos: offset, _t0: 0, _play: false, _stop: false };
    h.loading = () => false;
    h.playing = () => h._play && !h._stop;
    h.position = () => (h._play ? Math.min(h.duration, h._pos + (visClock() - h._t0) * P.rate) : h._pos);
    h.pause = () => { if (!h._play) return; h._pos = h.position(); h._play = false; };
    h.resume = () => { if (h._play || h._stop) return; if (h._pos >= h.duration - 0.02) h._pos = 0; h._t0 = visClock(); h._play = true; };
    h.stop = () => { h._pos = h.position(); h._play = false; h._stop = true; };
    h.seek = (t) => { h._pos = clamp(t, 0, h.duration); if (h._play) h._t0 = visClock(); };
    h.resume();
    return h;
  }
  function startMedia(rec, offset) {
    if (P.rate !== 1 || !(G.media && G.media.play)) { try { if (G.media && G.media.stopAll) G.media.stopAll(); } catch (e) {} return virtualHandle(rec, offset); }
    let h = null;
    try { h = G.media.play(bufP(rec), { from: 'callrec', id: rec.id, offset, dur: rec.dur, onEnd: () => { if (P.h === h) onEnded(); } }); } catch (e) { console.error('[comms] media.play', e); }
    return h || virtualHandle(rec, offset);
  }
  const sessPayload = (S, state, reason) => ({ id: S.id, sess: S.sess, by: S.by, line: S.line, s0: S.s0, a: S.a, b: S.b, state, reason: reason || null, out: CR.out(), away: !!S.away, pausedSec: S.pausedSec });
  function endSession(state, reason) {
    const S = P.s; if (!S) return;
    P.s = null;
    P.lastStop = pmNow();
    emit('rec:session', sessPayload(S, state, reason));
    uiAll();
  }
  function ensurePoll() { if (!P.poll) P.poll = setInterval(pollTick, 100); }
  function stopPollMaybe() { if (P.poll && !P.s && !(P.h && P.h.playing && P.h.playing())) { clearInterval(P.poll); P.poll = 0; } }
  function onEnded() {
    if (P.ending) return; P.ending = true;
    const rec = recById(P.id); const S = P.s;
    if (S && rec) { S.b = rec.dur; judgeFlags(S); emit('rec:time', { id: S.id, t: rec.dur, sess: S.sess, a: S.a, b: S.b, out: CR.out(), away: !!S.away }); endSession('end'); }
    P.lastStop = pmNow();
    P.ending = false;
    uiAll(); stopPollMaybe();
  }
  /** the sea0333-only flags (§3.7 · §9.6 ② · §12.2 V1) */
  function judgeFlags(S) {
    if (S.id !== 'sea0333') return;
    if (flag('textOpened')) {
      const from = S.tA != null ? Math.max(S.a, S.tA) : S.a;
      if (from <= 21.0 && S.b >= 22.0) { setFlag('heard21'); setFlag('nameKnown'); }
    }
    if (S.by === 'line' && S.line === 21 && S.b >= 22.0 && !S.armedAtStart && !S.noSig) setFlag('sigName');
    if (S.by === 'line' && S.line === 30 && S.b >= 30.9) setFlag('radioHeard');
  }
  function pollTick() {
    const h = P.h, S = P.s;
    if (!h) { stopPollMaybe(); return; }
    const rec = recById(P.id);
    const pos = h.position ? h.position() : 0;
    const playing = h.playing ? h.playing() : false;
    const loading = h.loading ? h.loading() : false;
    if (S && S.state === 'play') {
      if (playing) {
        if (pos >= S.b - 0.35 && pos <= S.b + 1.6) S.b = Math.max(S.b, pos);
        if (awayNow()) S.away = true;
        if (S.id === 'sea0333') {   // recPlayed = ≥ 3 s of the recording actually played (position advance — rate / volume independent)
          const cm = CMV();
          if (P.lastT != null && pos > P.lastT && pos - P.lastT < 1.6) cm.seaPlayed = (cm.seaPlayed || 0) + (pos - P.lastT) * 1000;
          P.lastT = pos;
          if ((cm.seaPlayed || 0) >= 3000) setFlag('recPlayed');
        }
        judgeFlags(S);
        emit('rec:time', { id: S.id, t: pos, sess: S.sess, a: S.a, b: S.b, out: CR.out(), away: !!S.away });
        if (rec && pos >= rec.dur - 0.03 && !h.o) onEnded();   // silent timer end
      } else if (!loading && !P.autoPaused) {
        if (rec && pos >= rec.dur - 0.06) onEnded();
        else { endSession('abort', 'stop'); }
      }
    } else if (S && S.state === 'pause') {
      if (pmNow() - S.pausePm > 15000) endSession('abort', 'pause15');
    }
    if (!(S && S.id === 'sea0333' && playing)) P.lastT = null;
    uiAll(true);
    stopPollMaybe();
  }
  CR.play = function (id, o) {
    o = o || {};
    const rec = recById(id); if (!rec) return null;
    const by = o.by || 'play';
    let start = by === 'line' ? Number(o.line) : (o.at != null ? Number(o.at) : null);
    if (by === 'play' && P.s && P.s.id === id && P.s.state === 'pause') { CR.resume(); return P.h; }
    if (start == null) {   // ▶ — continue from a held position on the same recording, else from the start
      const pos = P.h && P.id === id && P.h.position ? P.h.position() : 0;
      start = pos < rec.dur - 0.25 ? pos : 0;
    }
    start = clamp(start || 0, 0, Math.max(0, rec.dur - 0.05));
    if (P.s) endSession('abort', P.s.id !== id ? 'replace' : by === 'seek' ? 'scrub' : 'restart');
    if (P.h && P.h.stop) { try { P.h.stop('replace'); } catch (e) {} }
    P.id = id; P.autoPaused = null;
    P.h = startMedia(rec, start);
    const cm = CMV(); cm.sessN = (cm.sessN | 0) + 1; save();
    // tA = the position when textOpened came on during this session (heard21 counts only what plays after it — §3.7)
    P.s = { id, sess: cm.sessN, s0: start, by, line: by === 'line' ? Number(o.line) : null, a: start, b: start, pausedSec: 0, away: awayNow(), noSig: false,
      armedAtStart: flag('playArmed'), state: 'play', tA: null, textAtStart: flag('textOpened') };
    if (P.held) delete P.held[id];
    P.lastT = null;
    emit('rec:session', sessPayload(P.s, 'play'));
    ensurePoll(); uiAll();
    return P.h;
  };
  CR.pause = function (reason) {
    if (!P.h || !(P.h.playing && P.h.playing())) return;
    try { P.h.pause(); } catch (e) {}
    P.lastStop = pmNow();
    if (P.s && P.s.state === 'play' && !reason) { P.s.state = 'pause'; P.s.pausePm = pmNow(); emit('rec:session', sessPayload(P.s, 'pause')); }
    uiAll();
  };
  CR.resume = function () {
    const S = P.s;
    if (!P.h) return;
    if (S && S.state === 'pause') { S.pausedSec += Math.max(0, pmNow() - S.pausePm) / 1000; S.state = 'play'; try { P.h.resume(); } catch (e) {} P.lastT = null; emit('rec:session', sessPayload(S, 'resume')); }
    else if (!S) { CR.play(P.id, { by: 'play' }); return; }
    else { try { P.h.resume(); } catch (e) {} }
    ensurePoll(); uiAll();
  };
  /** scrub release (§9.5-4): playing → new session 'seek' from t · paused/stopped → abort + hold the position */
  CR.seek = function (t) {
    if (!P.id) return;
    const rec = recById(P.id); if (!rec) return;
    t = clamp(Number(t) || 0, 0, rec.dur);
    const playing = !!(P.h && P.h.playing && P.h.playing());
    if (playing) { CR.play(P.id, { by: 'seek', at: t }); return; }
    if (P.s) endSession('abort', 'scrub');
    if (P.h && P.h.seek) { try { P.h.seek(t); } catch (e) {} }
    P.held = P.held || {}; P.held[P.id] = t;
    uiAll();
  };
  CR.stop = function (reason) {
    if (P.s) endSession('abort', reason || 'stop');
    if (P.h && P.h.stop) { try { P.h.stop('stop'); } catch (e) {} }
    P.lastStop = pmNow(); P.autoPaused = null;
    uiAll(); stopPollMaybe();
  };
  CR.state = function () { return { id: P.id, t: P.h && P.h.position ? P.h.position() : 0, playing: !!(P.h && P.h.playing && P.h.playing()), sess: P.s ? P.s.sess : null }; };
  CR.session = function () { const S = P.s; return S ? { id: S.id, sess: S.sess, s0: S.s0, by: S.by, line: S.line, a: S.a, b: S.b, pausedSec: S.pausedSec, away: !!S.away, noSig: !!S.noSig } : null; };
  CR.sinceStopMs = function () { if (P.h && P.h.playing && P.h.playing()) return 0; return P.lastStop == null ? Infinity : Math.max(0, pmNow() - P.lastStop); };
  CR.recordings = function () { return RECS().slice(); };
  function onTextOpenedDuring() { if (P.s && P.s.id === 'sea0333' && !P.s.textAtStart && P.s.tA == null) P.s.tA = P.s.b; }

  /* =========================================================
   * views (player · text · list) — UI refresh from the poll
   * ========================================================= */
  const views = new Set();
  function uiAll(fromPoll) { views.forEach((v) => { if (!v.node.isConnected) { views.delete(v); if (v.onGone) v.onGone(); return; } try { v.update(fromPoll); } catch (e) { console.error('[comms] callrec ui', e); } }); }
  function curPos(id) { if (P.held && P.held[id] != null && !(P.id === id && P.h && P.h.playing && P.h.playing())) return P.held[id]; return P.id === id && P.h && P.h.position ? P.h.position() : 0; }
  /** scrub release on a recording: the current one → CR.seek · any other → hold the position for its next ▶ (no session) */
  function scrubTo(id, t) {
    if (P.id === id && P.h && ((P.h.playing && P.h.playing()) || P.s)) { CR.seek(t); return; }
    P.held = P.held || {}; P.held[id] = t;
    if (P.id === id && P.h && P.h.seek) { try { P.h.seek(t); } catch (e) {} }
    uiAll();
  }
  const isPlaying = (id) => P.id === id && !!(P.h && P.h.playing && P.h.playing());
  /** custom slider (no native input — ARCH_EP3 §8.1-9) */
  function slider(id, qa, getDur, onRelease) {
    const fill = el('i.cr3-sl-fill'), thumb = el('i.cr3-sl-th');
    const node = el('div.cr3-slider', { role: 'slider', tabindex: 0, 'aria-valuemin': '0', 'data-qa': qa }, el('i.cr3-sl-track', null, fill), thumb);
    let drag = null;
    const fromX = (x) => { const r = node.getBoundingClientRect(); return clamp((x - r.left) / Math.max(1, r.width), 0, 1) * getDur(); };
    const show = (t) => { const d = getDur() || 1; const p = clamp(t / d, 0, 1) * 100; fill.style.width = p + '%'; thumb.style.left = p + '%'; node.setAttribute('aria-valuenow', String(Math.round(t))); node.setAttribute('aria-valuemax', String(Math.round(d))); };
    node.addEventListener('pointerdown', (e) => { drag = { t: fromX(e.clientX) }; try { node.setPointerCapture(e.pointerId); } catch (err) {} node.classList.add('drag'); show(drag.t); e.preventDefault(); });
    node.addEventListener('pointermove', (e) => { if (!drag) return; drag.t = fromX(e.clientX); show(drag.t); if (node._onPreview) node._onPreview(drag.t); });
    const up = () => { if (!drag) return; const t = drag.t; drag = null; node.classList.remove('drag'); if (node._onPreview) node._onPreview(null); onRelease(t); };
    node.addEventListener('pointerup', up); node.addEventListener('pointercancel', () => { drag = null; node.classList.remove('drag'); });
    node.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const t = clamp(curPos(id) + (e.key === 'ArrowRight' ? 5 : -5), 0, getDur()); onRelease(t); } });
    node.show = (t) => { if (!drag) show(t); };
    node.dragging = () => !!drag;
    return node;
  }
  function moreSheet(id) {
    const m = UI().more || [];
    return sheet({ buttons: [['text', m[0], 'rec.more.text'], ['detail', m[1], 'rec.more.detail']] }).then((v) => {
      if (v === 'text') CR.openText(id);
      else if (v === 'detail') detailSheet(id);
    });
  }
  function detailRows(rec) {
    if (rec.detail) return rec.detail;
    const U2 = UI(), K = U2.detailKeys || [], d = pd(rec.d);
    const kind = (U2.detailKind || {})[rec.kind] || '', dir = (U2.detailDir || {})[rec.dir] || '';
    const date = d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEK[d.getDay()]}) ${fmt12(rec.hm)}` : '';
    const vals = U2.detailVals || {};
    return [[K[0], `${rec.who} (${kind} · ${dir})`], [K[1], date], [K[2], mss(rec.dur)], [K[3], vals.how || ''], [K[4], vals.where || '']];
  }
  function detailSheet(id) {
    const rec = recById(id); if (!rec) return;
    const body = el('div.cr3-kvs', null, detailRows(rec).map((r) => el('div.cr3-kv', null, el('span', null, T(r[0])), el('b', null, T(r[1])))));
    sheet({ body, scr: 'callrec.player.info', cls: 'cr3-info' });
  }
  const subOf = (rec) => {
    const S = (G.SUBS || {})[rec.id === 'sea0333' ? 'S12' : 'S13'];
    return T((S && S.text) || (rec.id === 'sea0333' ? UI().playerSub : UI().plainSub) || '');
  };
  const titleOf = (rec) => T(rec.title || rec.who);
  const subLine = (rec) => T(rec.sub || `${fmtDay(rec.d)} ${fmt12(rec.hm)} · ${mss(rec.dur)} · ${UI().plainKind || ''}`);
  /** static waveform — 200 bars from the rendered buffer when it exists, else a fixed shape from the transcript (§5.5 C4) */
  function waveBars(rec, box) {
    const N = 200;
    const shape = new Array(N).fill(0).map((_, i) => {
      const t = (i + 0.5) / N * rec.dur;
      let a = 0.06;
      if (rec.id === 'sea0333') {
        if (t >= 0.6 && t < 7.4) a = 0.55; else if ((t >= 8.6 && t < 15.4) || (t >= 22.6 && t < 30.9)) a = 0.42; else if ((t >= 16 && t < 20.4) || (t >= 21 && t < 21.8) || (t >= 31 && t < 32.4)) a = 0.12;
      } else {
        const ln = (rec.lines || []).filter((l) => !l.end && l.t <= t).pop();
        if (ln && t - ln.t < 3.4) a = 0.34 + 0.18 * Math.abs(Math.sin(i * 1.7));
      }
      return a * (0.75 + 0.25 * Math.abs(Math.sin(i * 12.9898)));
    });
    const bars = shape.map((a) => el('i', { style: { height: Math.max(4, Math.round(a * 100)) + '%' } }));
    box.append(...bars);
    bufP(rec).then((buf) => {
      if (!buf || !box.isConnected) return;
      try {
        const ch = buf.getChannelData(0), step = Math.max(1, Math.floor(ch.length / N));
        let mx = 0; const pk = [];
        for (let i = 0; i < N; i++) { let m = 0; for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 8) { const v = Math.abs(ch[j]); if (v > m) m = v; } pk.push(m); if (m > mx) mx = m; }
        if (mx > 0) pk.forEach((m, i) => { bars[i].style.height = Math.max(4, Math.round(Math.pow(m / mx, 0.7) * 100)) + '%'; });
      } catch (e) {}
    });
  }

  /* ---------------- C4 player ---------------- */
  CR.openPlayer = function (id) {
    const rec = recById(id); if (!rec) return null;
    const timeL = el('span.cr3-tcur', null, '0:00');
    const timeR = el('span.cr3-tdur', null, mss(rec.dur));
    const loadL = el('div.cr3-loading');
    const sub = el('div.cr3-psub');
    const wave = el('div.cr3-wave'); const cursor = el('i.cr3-wave-cur');
    const waveBox = el('div.cr3-wavebox', null, wave, cursor);
    waveBars(rec, wave);
    const sl = slider(id, 'rec.seek', () => rec.dur, (t) => scrubTo(id, t));
    sl._onPreview = (t) => { if (t != null) timeL.textContent = mss(t); };
    const playB = el('button.cr3-pbtn', { type: 'button', 'aria-label': '재생', 'data-qa': 'rec.play', html: SVG.play });
    playB.addEventListener('click', () => { sfx('tap'); togglePlay(id); });
    const moreB = el('button.cr3-ib', { type: 'button', 'aria-label': '더보기', 'data-qa': 'rec.more', html: SVG.moreH, onclick: (e) => { e.stopPropagation(); sfx('tap'); moreSheet(id); } });
    const body = el('div.cr3-player', null,
      el('div.cr3-ptitle', null, el('b', null, titleOf(rec)), el('small', null, subLine(rec))),
      waveBox, el('div.cr3-ptime', null, timeL, el('span', null, ' / '), timeR), sl, el('div.cr3-pctl', null, playB), loadL, sub);
    const scr = screen('rec.player', '', body, { right: [moreB], cls: 'cr3-playerv' });
    const v = { id, node: scr, kind: 'player', update() {
      const pos = curPos(id), pl = isPlaying(id), ld = P.id === id && P.h && P.h.loading && P.h.loading();
      if (!sl.dragging()) timeL.textContent = mss(pos);
      sl.show(pos);
      cursor.style.left = clamp(pos / rec.dur, 0, 1) * 100 + '%';
      playB.innerHTML = pl ? SVG.pause : SVG.play; playB.setAttribute('aria-label', pl ? '일시정지' : '재생');
      loadL.textContent = ld ? T(UI().loading || '{$loading}') : '';
      const inHum = rec.id !== 'sea0333' || (rec.hum || []).some(([a, b]) => pos >= a && pos < b);
      sub.textContent = pl && inHum ? subOf(rec) : '';
    }, onGone: () => releaseBuf(id) };
    views.add(v);
    push(scr, { onClose: () => { views.delete(v); setTimeout(() => releaseBuf(id), 0); } });
    v.update();
    if (id === 'sea0333') setFlag('recPlayerOpened');
    emit('rec:player', { id });
    return scr;
  };
  function togglePlay(id) {
    if (isPlaying(id)) CR.pause();
    else if (P.s && P.s.id === id && P.s.state === 'pause') CR.resume();
    else { const at = curPos(id); CR.play(id, { by: 'play', at: at < (recById(id).dur - 0.25) ? at : 0 }); }
  }

  /* ---------------- C5 text ---------------- */
  const converted = {};
  CR.openText = function (id) {
    const rec = recById(id); if (!rec) return null;
    const box = el('div.cr3-text');
    const foot = el('div.cr3-mini');
    const scr = screen('rec.text', UI().textTitle || '', box, { cls: 'cr3-textv', footer: foot });
    let v = null, rows = [], offs = [];
    function build() {
      box.innerHTML = '';
      const d = pd(rec.d);
      box.appendChild(el('div.cr3-thead', null,
        el('b', null, T(rec.textHead || `${rec.who} · ${mss(rec.dur)}`)),
        el('span', null, d ? `${fmtDay(rec.d)} ${fmt12(rec.hm)}` : '')));
      const list = el('div.cr3-lines');
      rows = (rec.lines || []).map((ln) => {
        const sp = ln.sp === 'me' ? T(UI().me || '나') : ln.sp === 'them' ? T(rec.who) : '';
        let txt;
        if (ln.lowWord && !ln.low) {
          const full = T(ln.text), w = T(ln.lowWord), i = full.indexOf(w);
          txt = i >= 0 ? el('span.cr3-lt', null, full.slice(0, i), el('span.cr3-low', null, w), full.slice(i + w.length)) : el('span.cr3-lt', null, full);
        } else txt = el('span.cr3-lt' + (ln.low ? '.cr3-low' : ''), null, T(ln.text));
        const r = el('button.cr3-line' + (ln.end ? '.end' : ''), { type: 'button', 'data-qa': 'rec.line:' + ln.t }, el('span.cr3-lts', null, mss(ln.t)), el('span.cr3-lsp', null, sp), txt);
        r.addEventListener('click', () => {
          r.classList.add('press'); setTimeout(() => r.classList.remove('press'), 120);
          if (ln.end) return;
          sfx('tap'); CR.play(id, { by: 'line', line: ln.t });
        });
        list.appendChild(r);
        return { r, ln };
      });
      box.appendChild(list);
      const tl = el('span.cr3-tcur', null, '0:00');
      const pb = el('button.cr3-mbtn', { type: 'button', 'aria-label': '재생', 'data-qa': 'rec.mini.play', html: SVG.play, onclick: () => { sfx('tap'); togglePlay(id); } });
      const sl = slider(id, 'rec.mini.seek', () => rec.dur, (t) => scrubTo(id, t));
      sl._onPreview = (t) => { if (t != null) tl.textContent = mss(t); };
      foot.innerHTML = '';
      foot.append(pb, sl, el('span.cr3-mtime', null, tl, el('span', null, ' / ' + mss(rec.dur))));
      v = { id, node: scr, kind: 'text', update() {
        const pos = curPos(id), pl = isPlaying(id), act = P.id === id && (pl || (P.s && P.s.id === id));
        if (!sl.dragging()) tl.textContent = mss(pos);
        sl.show(pos);
        pb.innerHTML = pl ? SVG.pause : SVG.play;
        let cur = -1;
        if (act) rows.forEach((x, i) => { if (!x.ln.end && x.ln.t <= pos + 0.05) cur = i; });
        rows.forEach((x, i) => x.r.classList.toggle('cur', i === cur));
      }, onGone: () => releaseBuf(id) };
      views.add(v);
      v.update();
      // flags: textAnyOpened (any) · textOpened + greySeen (sea0333 only — §12.2 V1)
      setFlag('textAnyOpened');
      if (id === 'sea0333') {
        if (!flag('textOpened')) { setFlag('textOpened'); onTextOpenedDuring(); }
        const grey = rows.find((x) => x.ln.t === 21);
        if (grey) offs.push(watchDrawn(grey.r, scr, () => setFlag('greySeen')));
      }
      emit('rec:text', { id, open: true });
      textScr = { scr, id, acc: 0 };
    }
    function converting() {
      box.innerHTML = ''; foot.innerHTML = '';
      box.appendChild(el('div.cr3-conv', null, el('i.cr3-spin'), el('span', null, T(UI().converting || '{$converting}'))));
    }
    textNode = scr;
    push(scr, { onClose: () => { offs.forEach((f) => f && f()); if (v) views.delete(v); if (textScr && textScr.scr === scr) textScr = null; if (textNode === scr) textNode = null; emit('rec:text', { id, open: false }); setTimeout(() => releaseBuf(id), 0); } });
    if (converted[id]) build();
    else { converting(); setTimeout(() => { converted[id] = true; if (scr.isConnected) build(); }, 2000); }
    return scr;
  };
  let textScr = null;     // { scr, id, acc } — the nameKnown 20 s clock (sea0333 text screen continuously on top)
  let textNode = null;    // the C5 node (S5 — open from the push, the 2.0 s conversion included)
  CR.textOpen = function () { return !!(textNode && isTop(textNode) && !document.hidden); };

  /* ---------------- C3 list · C11 voice ---------------- */
  function groups(recs) { const out = []; recs.forEach((r) => { const g = out[out.length - 1]; if (g && g.d === r.d) g.items.push(r); else out.push({ d: r.d, items: [r] }); }); return out; }
  /** title pieces split at ' · ': the dot travels with the token after it (textContent unchanged) */
  function titleToks(rec) {
    const parts = titleOf(rec).split(' · ');
    return parts.map((t, i) => el('span.cr3-tok', null, i ? '· ' + t : t + (parts.length > 1 ? ' ' : '')));
  }
  function recRow(rec, scr) {
    const main = el('button.cr3-ritem', { type: 'button', 'data-qa': 'rec.item:' + rec.id },
      el('span.cr3-rname', null, titleToks(rec)), el('span.cr3-rhm', null, fmt12(rec.hm)), el('span.cr3-rdur', null, mss(rec.dur)));
    main.addEventListener('click', () => { if (main._lp) { main._lp = false; return; } sfx('tap'); CR.openPlayer(rec.id); });
    let lpT = 0;
    main.addEventListener('pointerdown', () => { clearTimeout(lpT); lpT = setTimeout(() => { main._lp = true; sfx('tap'); moreSheet(rec.id); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach((ev) => main.addEventListener(ev, (e) => { if (ev === 'pointermove' && Math.abs(e.movementY || 0) < 3) return; clearTimeout(lpT); }));
    main.addEventListener('contextmenu', (e) => e.preventDefault());
    const more = el('button.cr3-rmore', { type: 'button', 'aria-label': '더보기', 'data-qa': 'rec.item.more:' + rec.id, html: SVG.more, onclick: (e) => { e.stopPropagation(); sfx('tap'); moreSheet(rec.id); } });
    return el('div.cr3-rrow', { dataset: { rec: rec.id } }, main, more);
  }
  function recList(box, scr) {
    groups(RECS()).forEach((g) => { box.appendChild(el('div.cr3-day', null, fmtDay(g.d))); g.items.forEach((r) => box.appendChild(recRow(r, scr))); });
  }
  CR.openList = function (o) {
    o = o || {};
    const box = el('div.cr3-reclist');
    const scr = screen('rec.list', UI().listTitle || '', box, { cls: 'cr3-listv' });
    recList(box, scr);
    push(scr);
    setFlag('recListOpened');
    emit('rec:list');
    if (o.scrollTo) {
      setTimeout(() => {
        const r = box.querySelector('[data-rec="' + o.scrollTo + '"]'); if (!r) return;
        try { r.scrollIntoView({ block: 'center' }); } catch (e) {}
        r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 400);
      }, 380);
    }
    return scr;
  };
  function openVoice() {
    const V = UI().voice || {};
    const chips = el('div.md2-chips.cr3-chips');
    const content = el('div.cr3-reclist');
    const box = el('div.cr3-voice', null, chips, content);
    const scr = screen('voice', V.head || '', box, { cls: 'cr3-listv' });
    let cur = 'all';
    function render() {
      chips.innerHTML = ''; content.innerHTML = '';
      (V.chips || []).forEach(([k, l]) => chips.appendChild(el('button.md2-chip' + (k === cur ? '.on' : ''), { type: 'button', 'data-qa': 'rec.voice.chip:' + k, onclick: () => { if (k === cur) return; sfx('tap'); cur = k; render(); } }, T(l))));
      if (cur === 'plain') content.appendChild(el('div.cr3-empty', null, el('i', { html: SVG.mic }), el('span', null, T(V.empty || '{$noRec}'))));
      else { recList(content, scr); setFlag('recListOpened'); }
    }
    render();
    push(scr);
    return scr;
  }

  /* ---------------- C1 · C1a · C1b · C1c · C2 ---------------- */
  function openSettings() {
    const u = UI();
    const go = { block: () => CR.open('block'), rec: () => CR.open('rec.settings'), spam: () => CR.open('settings.spam'), reject: () => CR.open('settings.reject'), ring: () => CR.open('settings.ring') };
    const body = el('div.cr3-rows', null, (u.settings || []).map(([k, l]) => rowBtn('callrec.row:' + k, l, null, go[k])));
    push(screen('settings', u.settingsTitle || '', body));
  }
  function openSpamSettings() {
    const u = UI(), r = u.spamRow || [];
    const body = el('div.cr3-rows', null, rowBtn('callrec.spam.row', r[0], r[1], () => CR.open('block.spam')));
    push(screen('settings.spam', u.spamTitle || '', body));
  }
  function openReject() { const u = UI(); push(screen('settings.reject', u.rejectTitle || '', el('div.cr3-rows', null, (u.reject || []).map((t) => rowBtn(null, t, null, null))))); }
  function openRing() { const u = UI(); push(screen('settings.ring', u.ringTitle || '', el('div.cr3-rows', null, (u.ring || []).map(([k, val]) => rowBtn(null, k, val, null))))); }
  function openRecSettings() {
    const u = UI(), rs = u.recSettings || [];
    const vars = CMV();
    const stateL = el('span.cr3-row-v');
    const setL = (on) => { stateL.textContent = T(on ? (rs[0] || [])[1] : (rs[0] || [])[2]); };
    setL(CR.setting('recAuto'));
    const tg = toggle(CR.setting('recAuto'), 'settings.toggle:recAuto', (on) => { CR.setting('recAuto', on); setL(on); });
    const whichV = el('span.cr3-row-v', null, T(vars.recWhich || (rs[1] || [])[1]));
    const body = el('div.cr3-rows', null,
      el('div.cr3-row.plain', null, el('span.cr3-row-t', null, T((rs[0] || [])[0])), stateL, tg),
      rowBtn('callrec.rec.which', (rs[1] || [])[0], null, () => {
        const opts = u.recWhich || [];
        sheet({ buttons: opts.map((o, i) => ['w' + i, o, 'callrec.rec.which:' + i]) }).then((val) => { if (!val) return; const t = opts[+String(val).slice(1)]; CMV().recWhich = t; save(); whichV.textContent = T(t); });
      }, { tail: whichV }),
      rowBtn('callrec.row:list', (rs[2] || [])[0], null, () => CR.open('rec.list')));
    push(screen('rec.settings', u.recTitle || '', body));
  }

  /* ---------------- C6 · C6b · C7 · C7a · C8 · C8a ---------------- */
  const mine = () => { const c = CMV(); if (!Array.isArray(c.mine)) c.mine = []; return c.mine; };
  const extraMsgs = () => { const c = CMV(); if (!Array.isArray(c.blockMsgs)) c.blockMsgs = []; return c.blockMsgs; };
  CR.blocked = {
    calls() { const b = BL(); return (b.calls || []).map((d, i) => ({ i, d, hm: b.hm, number: b.number, tag: b.tag })); },
    messages() { const b = BL(); const ex = extraMsgs().map((id) => (b.hook && b.hook.id === id ? b.hook : null)).filter(Boolean); return ex.concat(b.messages || []); },
    openCalls() { return CR.open('block.calls'); },
    openMessages() { return CR.open('block.msgs'); },
    pushMessage(row) { if (!row || !row.id) return; const ex = extraMsgs(); if (ex.indexOf(row.id) < 0) { ex.unshift(row.id); save(); } },
  };
  function fmtNum(s) { const d = String(s || '').replace(/\D/g, ''); const m = d.match(/^(01\d)(\d{3,4})(\d{4})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : d; }
  function openBlock() {
    const b = BL(), rows = (b.block || {}).rows || [];
    const label = (k) => (rows.find((r) => r[0] === k) || [])[1] || '';
    const box = el('div.cr3-rows');
    const scr = screen('block', b.title || '', box);
    function render() {
      box.innerHTML = '';
      box.appendChild(rowBtn('block.add', label('add'), null, () => addSheet(render), { tail: el('i.cr3-plus', { html: SVG.plus }), chev: false }));
      box.appendChild(el('div.cr3-row.plain', null, el('span.cr3-row-t', null, T(label('unknown'))), toggle(CR.setting('unknownBlock'), 'block.unknown', (on) => CR.setting('unknownBlock', on))));
      box.appendChild(rowBtn('block.spam', label('spam'), (b.block || {}).spamOn, () => CR.open('block.spam')));
      box.appendChild(rowBtn('block.calls', label('calls'), String((b.calls || []).length), () => CR.open('block.calls')));
      box.appendChild(rowBtn('block.msgs', label('msgs'), String(CR.blocked.messages().length), () => CR.open('block.msgs')));
      const m = mine();
      if (!m.length) box.appendChild(el('div.cr3-none', null, T((b.block || {}).none || '{$noBlocked}')));
      else {
        box.appendChild(el('div.cr3-day', null, T(b.mineHead || '')));
        m.forEach((num, i) => box.appendChild(el('div.cr3-row.plain', null, el('span.cr3-row-t', null, fmtNum(num)),
          el('button.cr3-ib', { type: 'button', 'aria-label': '해제', 'data-qa': 'block.mine.del:' + i, html: SVG.x, onclick: () => { sfx('tap'); mine().splice(i, 1); save(); render(); } }))));
      }
    }
    render();
    push(scr, { onResume: render });
  }
  /** `전화번호 추가 +` → 차단할 번호 (digits only — contacts cannot be picked · §0.3 D20) · S1 while digits are typed */
  function addSheet(after) {
    const b = BL(), P2 = b.pad || {};
    let n = '';
    const num = el('div.cr3-padnum');
    const upd = () => { num.textContent = n.length > 3 && /^01/.test(n) ? fmtNum(n) : n; };
    const keys = el('div.cr3-pad', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => {
      if (!k) return el('span');
      const bt = el('button.cr3-pkey', { type: 'button', 'data-qa': k === 'del' ? 'block.pad.del' : 'block.pad.key:' + k, html: k === 'del' ? SVG.del : '', 'aria-label': k === 'del' ? '지우기' : k });
      if (k !== 'del') bt.textContent = k;
      bt.addEventListener('click', () => { if (k === 'del') n = n.slice(0, -1); else if (n.length < 13) n += k; sfx('key'); upd(); });
      return bt;
    }));
    const body = el('div.cr3-padbox', null, num, keys);
    let off = null;
    try { if (G.ui && G.ui.inputSource) off = G.ui.inputSource(() => body.isConnected && n.length > 0); } catch (e) {}
    sheet({ title: P2.title, body, buttons: [['ok', P2.ok, 'block.pad.ok']], cls: 'cr3-padsheet', onClose: () => { if (off) off(); } }).then((v) => {
      if (off) { off(); off = null; }
      if (v !== 'ok' || !n) return;
      const m = mine(); if (m.indexOf(n) < 0) { m.push(n); save(); }
      if (after) after();
    });
  }
  function openBlockSpam() {
    const b = BL(), s = b.spamScreen || [];
    const body = el('div.cr3-rows', null, el('div.cr3-desc', null, T(s[0] || '')), s[1] ? rowBtn(null, s[1][0], s[1][1], null) : null);
    push(screen('block.spam', b.spamTitle || '', body));
  }
  function openBlockedCalls() {
    const b = BL();
    const box = el('div.cr3-blist');
    const scr = screen('block.calls', b.callsTitle || '', box, { cls: 'cr3-blockedv' });
    const rowsEl = CR.blocked.calls().map((c) => {
      const r = el('button.cr3-brow', { type: 'button', 'data-qa': 'block.row:' + c.i },
        el('span.cr3-bd', null, fmtDay(c.d)), el('span.cr3-bt', null, fmt12(c.hm)), el('span.cr3-bn', null, c.number), el('span.cr3-btag', null, T(c.tag)));
      r.addEventListener('click', () => { sfx('tap'); CR.open('block.call', { i: c.i }); });
      box.appendChild(r);
      return r;
    });
    let off = null;
    push(scr, { onClose: () => off && off() });
    setFlag('blockOpened');
    emit('block:open');
    const last = rowsEl[rowsEl.length - 1];
    if (last) off = watchDrawn(last, scr, () => { setFlag('blockBottom'); emit('block:bottom'); });
    return scr;
  }
  function openBlockedNumber() {
    const b = BL();
    const body = el('div.cr3-bnum', null, el('b', null, b.number), el('div.cr3-kv', null, el('span', null, T(b.reasonKey || '')), el('b', null, T(b.reason || ''))));
    push(screen('block.call', '', body));
  }
  function msgRow(m, i, o) {
    o = o || {};
    const when = m.label ? T(m.label) : fmtDay(m.d);
    const r = el(o.static ? 'div.cr3-mrow' : 'button.cr3-mrow', { type: o.static ? null : 'button', 'data-qa': o.static ? null : 'block.msg:' + i },
      el('span.cr3-mtop', null, el('span.cr3-md', null, when), el('span.cr3-mn', null, m.number + ' ' + T(BL().msgTag || ''))),
      el('span.cr3-mt', null, T(m.text)));
    if (!o.static) r.addEventListener('click', () => { sfx('tap'); CR.open('block.msg', { i }); });
    return r;
  }
  function openBlockedMsgs() {
    const b = BL();
    const box = el('div.cr3-blist');
    CR.blocked.messages().forEach((m, i) => box.appendChild(msgRow(m, i)));
    push(screen('block.msgs', b.msgsTitle || '', box, { cls: 'cr3-blockedv' }));
  }
  function openBlockedMsg(i) {
    const m = CR.blocked.messages()[i | 0]; if (!m) return;
    const body = el('div.cr3-bmsg', null, el('span.cr3-md', null, m.label ? T(m.label) : fmtDay(m.d)), el('b', null, m.number + ' ' + T(BL().msgTag || '')), el('p', null, T(m.full || m.text)));
    push(screen('block.msg', '', body));
  }
  /** 06:10 hook cut — the C8 layout in room's screen node (standard UI), push = silent 0.5 s slide (§3.16 · §4.12.5) */
  CR.renderBlockedMsgs = function (node, o) {
    o = o || {};
    if (!node) return { push: () => Promise.resolve() };
    const b = BL();
    const list = el('div.cr3-blist');
    const root = el('div.cr3-hookscr' + (o.hook ? '.hook' : ''), { 'data-scr': 'callrec.blockedMsgs' }, el('div.cr3-hhead', null, T(b.msgsTitle || '')), list);
    (b.messages || []).forEach((m, i) => list.appendChild(msgRow(m, i, { static: true })));
    node.appendChild(root);
    return {
      node: root,
      push(row) {
        row = row || b.hook;
        CR.blocked.pushMessage(row, { silent: true });
        const r = msgRow(row, -1, { static: true });
        r.classList.add('cr3-new');
        list.insertBefore(r, list.firstChild);
        requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('in')));
        return new Promise((res) => setTimeout(res, 500));
      },
    };
  };

  /* ---------------- open (hook 'callrec:open') ---------------- */
  CR.open = function (id, params) {
    params = params || {};
    switch (id) {
      case 'settings': return openSettings();
      case 'settings.spam': return openSpamSettings();
      case 'settings.reject': return openReject();
      case 'settings.ring': return openRing();
      case 'rec.settings': return openRecSettings();
      case 'rec.list': return CR.openList(params);
      case 'rec.player': return CR.openPlayer(params.id || 'sea0333');
      case 'rec.text': return CR.openText(params.id || 'sea0333');
      case 'block': return openBlock();
      case 'block.spam': return openBlockSpam();
      case 'block.calls': return openBlockedCalls();
      case 'block.call': return openBlockedNumber(params.i);
      case 'block.msgs': return openBlockedMsgs();
      case 'block.msg': return openBlockedMsg(params.i);
      case 'voice': return openVoice();
      default: console.warn('[comms] callrec.open: unknown', id); return null;
    }
  };
  if (G.hooks && G.hooks.set) {
    G.hooks.set('callrec:open', (id, params) => CR.open(id, params));
    G.hooks.set('callrec:noSig', (sess) => { if (P.s && (sess == null || P.s.sess === sess)) P.s.noSig = true; });
  }
  if (typeof G.app === 'function') {
    G.app('voicerec', { name: '음성 녹음', icon: (G.ICONS && (G.ICONS.voicerec || G.ICONS.recorder)) || null, badge: () => 0, open: () => CR.open('voice') });
  }

  /* ---------------- init ---------------- */
  let inited = false;
  CR.init = function () {
    if (inited) return; inited = true;
    if (G.bus) {
      // pause menu / hidden tab: the media pauses, the session survives (§9.6 — playMs stops, so no pause15)
      G.bus.on('pause', (e) => { if (e && e.open) { if (isPlaying(P.id)) { P.autoPaused = 'menu'; try { P.h.pause(); } catch (err) {} uiAll(); } } else if (P.autoPaused === 'menu') { P.autoPaused = null; try { P.h.resume(); } catch (err) {} uiAll(); } });
      G.bus.on('visibility', (e) => { if (e && e.hidden) { if (isPlaying(P.id)) { P.autoPaused = 'hidden'; try { P.h.pause(); } catch (err) {} } } else if (P.autoPaused === 'hidden') { P.autoPaused = null; try { P.h.resume(); } catch (err) {} uiAll(); } });
      G.bus.on('easy:change', (e) => { if (e && e.on) CR.stop('fold'); });
      G.bus.on('state:load', () => CR.stop('load'));
      G.bus.on('tick', (e) => {   // nameKnown's second path: greySeen ∧ the sea0333 text screen continuously on top for 20 s (playMs)
        const dt = (e && e.dt) || 0;
        if (!textScr || textScr.id !== 'sea0333') return;
        const nbOpen = !!(G.notebook && G.notebook.isOpen && G.notebook.isOpen());
        if (isTop(textScr.scr) && !document.hidden && !nbOpen) textScr.acc += dt; else textScr.acc = 0;
        if (flag('greySeen') && textScr.acc >= 20000) setFlag('nameKnown');
      });
    }
    // desktop Space = play / pause while the player (C4) or the transcript (C5) is the top screen (§5.5 C4 · §9.5-4)
    document.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen()) return;
      const v = Array.from(views).find((x) => (x.kind === 'player' || x.kind === 'text') && isTop(x.node));
      if (!v) return;
      e.preventDefault(); togglePlay(v.id);
    });
    if (G.DEBUG) {
      const H = (window.haru = window.haru || {});
      H.play = (t, o) => { o = o || {}; const line = o.line !== false; return CR.play('sea0333', line ? { by: 'line', line: t } : { by: 'play', at: t }); };
      H.recRate = (x) => {
        x = Math.max(0.1, +x || 1);
        const was = P.rate; P.rate = x;
        if (P.h && P.s && isPlaying(P.id) && was !== x) {   // hand the running session over to the silent timer at the same position
          const rec = recById(P.id), pos = P.h.position();
          try { P.h.stop('replace'); } catch (e) {}
          P.h = x === 1 ? startMedia(rec, pos) : virtualHandle(rec, pos);
          if (x !== 1) { try { G.media && G.media.stopAll && G.media.stopAll(); } catch (e) {} }
        }
        return x;
      };
      H.callrec = () => ({ state: CR.state(), session: CR.session(), since: CR.sinceStopMs(), out: CR.out(), textOpen: CR.textOpen() });
    }
  };
})();
