/* =========================================================
 * engine/apps/moment.js — 모먼트 (SNS · DMs) · owner: social
 * DESIGN §3.7 · §3.10 (dashMoment/draftSeen) · §3.12 · §3.13 · §3.14 · §3.18 · §4.1.1–§4.1.8 · §4.8 N06–N11 N10′ N14 N16
 *        §4.10.6–§4.10.8 chat parts · §5.1/§5.2 모먼트 rows · §5.7 ③ · §9.2 (threads keep ids only) · §9.5-5
 * ARCH §3.2 social · §4.19 · §4.24 (timed events go through G.e2.sched — never twice) · §6.3 data-qa
 *
 * Public API (G.moment)
 *   init()                                   registers sched handlers + bus listeners (idempotent; also lazily on first use)
 *   open({ tab:'home'|'search'|'messages'|'profile', thread, profile })
 *   push(thread, msg, { notify=true, typingMs, coalesce=true, nid }) → Promise<entry>   msg = data id | { from, text, … }
 *   play(scriptId) → Promise<{ chip, right }>   'j0200' 'jTail' 'j0205' 'm0212'  (idempotent across reloads)
 *   isOpen(thread) → bool · hiddenCount() → int · state() → { fake, realUnres, c1Pm } · messages(thread) · typing(thread, ms)
 *   openThread(id) · profile(id) · unrestrict('real'|'fake')
 * Hooks called: 'end:reached' {right} (flow) — at the exact append of jRight / jNone · 'settings:screen' 'notif.perChat' (shell)
 * Sched ids (G.e2.sched, owner prefix 'social:'): q:<thread> (scripted lines / typing), m5b m5c, B11, where, chip4, P1, P2
 * Bus emitted: 'chat:open' {thread} · 'chat:msg' {thread, msg} · 'moment:thread' {id}
 * Bus listened: flag:M5 flag:C2 flag:M6 flag:M7 flag:M8 · clock:min clock:jump · wifi:change · notify:shown · users:switched ·
 *        end:step (flow — 'k0110' lets K go, §12.9 #13)
 * Flags set (ARCH §4.4 — sole setter): jiminOpened factJimin vmPlayed dashMoment draftSeen fakeKnown fakeReplied hiddenSeen
 *        C1 C1b makerStayDown makerArrived whereAsked whereTank fakeLineSeen ; stage e2_fakeReply (via G.e2.stage)
 * Saved state: vars.so (enums / ints / ids only) · G.state.threads['moment:<id>'] = [{id, t, from?, chip?, edited?, slot?, ok?, read?, fail?}]
 *        free text only in G.e2.session (sessionStorage) — never a name, never G.T output (§10 F).
 * Hard rules: he never reacts to UI actions — only to messages that reach his account (fake reply → 읽음 + 0.5 s GSM).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const C = G.chat || {};
  const el = C.el || (G.util && G.util.el);
  const T = (s) => (C.T ? C.T(s) : s);
  const STR = (k) => (C.str ? C.str(k) : '');
  const MO = (G.moment = G.moment || {});
  const D = () => (G.STORY && G.STORY.moment) || {};
  const UI = (k) => ((D().ui || {})[k]) || '';
  const TH = () => D().threads || {};
  const tap = () => C.tap && C.tap();
  const fl = (n) => (G.F && G.F[n]) || n;
  const flag = (n) => { try { return !!(G.flag && G.flag(fl(n))); } catch (e) { return false; } };
  const setFlag = (n) => { try { if (G.flag && !G.flag(fl(n))) G.flag(fl(n), true); } catch (e) { console.error('[social] flag', n, e); } };
  const pm = () => (G.state && G.state.playMs) || 0;
  const pmOf = (n) => { try { if (G.pm) { const v = G.pm(fl(n)); if (v != null) return v; } } catch (e) {} const P = G.state && G.state.vars && G.state.vars.pm; return P && P[n] != null ? P[n] : null; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const user = () => { try { return (G.users && G.users.current && G.users.current()) || 'n'; } catch (e) { return 'n'; } };
  const isDash = () => user() === 'dash';
  const cb = (k) => { try { return G.e2 && G.e2.cb ? G.e2.cb(k) : false; } catch (e) { return false; } };
  const online = () => { try { const w = G.phone && G.phone.wifi; return !(w && w.connected && !w.connected()); } catch (e) { return true; } };
  const mark = (id) => { try { G.director && G.director.mark && G.director.mark(id); } catch (e) {} };
  const hook = (name, arg) => { try { if (G.hooks && G.hooks.call) return G.hooks.call(name, arg); } catch (e) { console.error('[social] hook', name, e); } return undefined; };
  const refreshBadges = () => { try { if (G.phone && G.phone.refreshBadges) G.phone.refreshBadges(); } catch (e) {} };
  const toast = (s) => { try { G.phone && G.phone.toast && G.phone.toast(T(s)); } catch (e) {} };

  /* ---------------- persisted social state ---------------- */
  let TMP = null;
  function so() {
    const v = G.state && G.state.vars;
    let s;
    if (v) { s = v.so = v.so || {}; } else { s = TMP = TMP || {}; }
    if (!s._v) Object.assign(s, { _v: 1, fake: 'normal', realUnres: false, realFilled: false, tonight: {}, seq: 0, q: {}, typ: {}, chip: {}, done: {}, pool: {}, script: {}, recentGone: [], liked: {}, fakeChipGone: 0, dSent: 0, sSent: 0, wMinus: 0, wrongOnce: 0, queue: [] });
    return s;
  }
  function live(thread) {
    const st = G.state; if (!st) return [];
    st.threads = st.threads || {};
    return (st.threads['moment:' + thread] = st.threads['moment:' + thread] || []);
  }
  const sess = {
    set(id, text) { try { if (G.e2 && G.e2.session) return G.e2.session.set(id, text); } catch (e) {} MEM[id] = text; },
    get(id) { try { if (G.e2 && G.e2.session) { const v = G.e2.session.get(id); if (v != null) return v; } } catch (e) {} return MEM[id] != null ? MEM[id] : null; },
  };
  const MEM = {};

  /* ---------------- clock helpers ---------------- */
  function dateOf(hm) { const [h, m] = String(hm).split(':').map(Number); return new Date(2026, 11, h < 12 ? 25 : 24, h, m); }
  const now = () => (C.now ? C.now() : new Date());
  const nowMs = () => +now();
  function fmtStamp(t) { try { if (C.fmtK) return C.fmtK(t); } catch (e) {} const d = new Date(t), h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`; }
  function passed(hm) { try { if (G.clock && G.clock.passed) return G.clock.passed(hm); } catch (e) {} return nowMs() >= +dateOf(hm); }
  const stamp = (at) => (at ? Math.max(nowMs(), +dateOf(at)) : nowMs());
  /** a new line never sorts before the thread's last one (K keeps its own 01:12 story stamp — §4.10.1 · §12.9 #13) */
  function notBefore(thread, t) { const a = live(thread), l = a.length ? +a[a.length - 1].t || 0 : 0; return Math.max(t, l); }

  /* ---------------- answers (core's E2 with §9.5-5 verbatim fallback) ---------------- */
  function norm(s) { try { if (G.e2 && G.e2.norm) return G.e2.norm(s); } catch (e) {} return String(s || '').normalize('NFC').trim().replace(/[\s\p{P}\p{S}\p{Extended_Pictographic}]/gu, '').toLowerCase(); }
  function whereOk(s) { try { if (G.e2 && G.e2.whereOk) return !!G.e2.whereOk(s); } catch (e) {} return /물탱크|탱크|저수조/.test(norm(s)); }
  const NEG_STOP = /(안|못)(멈|멎|끊|짧)|(멈추|멎|끊기)지(않|안)|끊김(이)?없|멈춤(이)?없/;
  const END_NEG = /끝까지(는|도)?(안|못|아니)|끝까지(는|도)?(나오|나와|울리|가)[가-힣]{0,2}(않|안|못)/;
  function answerOk(raw) {
    try { if (G.e2 && G.e2.answerOk) return !!G.e2.answerOk(raw); } catch (e) {}
    const n = norm(raw);
    if (/한마디도/.test(n)) return false;
    if (/끝까지/.test(n) && !END_NEG.test(n)) return false;
    if (NEG_STOP.test(n)) return false;
    if (/한마디|1마디|한두마디|두마디만|한소절|1소절/.test(n)) return true;
    if (END_NEG.test(n)) return true;
    if (/멈췄|멈춤|멈추|멈춰|멈춘|멎|끊겼|끊김|끊기|끊긴|끊어|말았|짧았|짧던|짧더/.test(n)) return true;
    if (/(짧게|조금|잠깐|금방|거의안)[가-힣]{0,6}(나오|나왔|나와|울리|울렸|울려|흘러|멈|멎|끊|말았|끝나|끝났)/.test(n)) return true;
    return false;
  }

  /* ---------------- scheduler (G.e2.sched — playMs based, persistent; local fallback for partial builds) ---------------- */
  const LOCAL = {};
  const SCH = {
    ok() { return !!(G.e2 && G.e2.sched && G.e2.sched.at); },
    at(at, id, data) {
      SCH.cancel(id);
      if (SCH.ok()) { try { G.e2.sched.at(at, id, data || {}); return; } catch (e) { console.error('[social] sched', e); } }
      LOCAL[id] = setTimeout(() => { delete LOCAL[id]; dispatch(data || {}, id); }, Math.max(0, at - pm()));
    },
    after(ms, id, data) { SCH.at(pm() + Math.max(0, ms || 0), id, data); },
    cancel(id) { if (SCH.ok()) { try { G.e2.sched.cancel(id); } catch (e) {} } if (LOCAL[id]) { clearTimeout(LOCAL[id]); delete LOCAL[id]; } },
    has(id) { if (SCH.ok()) { try { return !!G.e2.sched.has(id); } catch (e) {} } return !!LOCAL[id]; },
  };
  const QTHREADS = ['real', 'fake', 'jimin_0412'];
  const SCHED_IDS = QTHREADS.map((t) => 'social:q:' + t).concat(['social:m5b', 'social:m5c', 'social:B11', 'social:where', 'social:chip4', 'social:P1', 'social:P2']);
  function dispatch(data, id) {
    try {
      if (id.indexOf('social:q:') === 0) return onQ(id.slice(9));
      switch (id) {
        case 'social:m5b': return pushFakeM5(1);
        case 'social:m5c': return pushFakeM5(2);
        case 'social:B11': if (!so().done.c1_3a) enqueue('real', [{ id: 'c1_3a', ms: 1400, act: ['b11'] }]); return;
        case 'social:where':
          if (!flag('whereTank') && !flag('whereAsked')) { deliver('real', { id: 'c1_10' }); setFlag('whereAsked'); }
          return;
        case 'social:chip4': if (so().chip.real === 'c4a' || so().chip.real === 'c4b') { so().chip.real = null; step5(); } return;
        case 'social:P1': if (flag('C1') && !so().done.P1) { so().done.P1 = 1; enqueue('real', [{ id: 'cP1', ms: 1200 }]); } return;
        case 'social:P2': if (flag('C1') && !flag('C2') && !so().done.P2) { so().done.P2 = 1; enqueue('real', [{ id: 'cP2a', ms: 1200 }, { id: 'cP2b', ms: 1600 }]); } return;
      }
    } catch (e) { console.error('[social] sched handler', id, e); }
  }

  /* ---------------- message index (ids → data) ---------------- */
  let IDX = null;
  function idx() {
    if (IDX) return IDX;
    const X = {};
    const th = TH();
    (th.jimin_0412 || []).forEach((m) => { X[m.id] = m; });
    (th.fake || []).forEach((m) => { X[m.id] = m; });
    (th.fakeM5 || []).forEach((m) => { X[m.id] = Object.assign({ from: 'them' }, m); });
    (th.tonight || []).forEach((m) => { X[m.id] = Object.assign({ from: 'them' }, m); });
    const c1 = th.c1 || {};
    Object.keys(c1.lines || {}).forEach((k) => { X[k] = { id: k, from: 'them', text: c1.lines[k] }; });
    const pool = th.pool || {};
    ['preM6', 'm6', 'm7', 'after0044', 'after0110'].forEach((st) => (pool[st] || []).forEach((t, i) => { X['pl_' + st + '_' + i] = { id: 'pl_' + st + '_' + i, from: 'them', text: t }; }));
    X.pl_x = { id: 'pl_x', from: 'them', text: pool.exhausted || '응응' };
    const sc = D().scripts || {};
    ['j0200', 'jTail', 'j0205', 'm0212'].forEach((k) => (sc[k] || []).forEach((m) => { if (m.id) X[m.id] = Object.assign({ from: 'them' }, m); }));
    ['jRight', 'jNone', 'jWrong1'].forEach((k) => { X[k] = { id: k, from: 'them', text: sc[k] || '' }; });
    // variants of lazy lines (fixed at enqueue time so a reload renders the same sentence)
    const lazy = (arr, id) => (arr || []).find((m) => m.id === id);
    const jT1 = lazy(sc.jTail, 'jT1'), jM4 = lazy(sc.j0205, 'jM4');
    if (jT1) { X.jT1y = { id: 'jT1y', from: 'them', text: typeof jT1.text === 'function' ? jT1.text(() => true) : jT1.text }; X.jT1n = { id: 'jT1n', from: 'them', text: typeof jT1.text === 'function' ? jT1.text(() => false) : jT1.text }; }
    if (jM4) { X.jM4y = { id: 'jM4y', from: 'them', text: typeof jM4.text === 'function' ? jM4.text(() => true) : jM4.text }; X.jM4n = { id: 'jM4n', from: 'them', text: typeof jM4.text === 'function' ? jM4.text(() => false) : jM4.text }; }
    IDX = X;
    return X;
  }
  const BASE = { jimin_0412: () => TH().jimin_0412 || [], fake: () => TH().fake || [], real: () => [], seah_y: () => [] };

  /* ---------------- chips ---------------- */
  function chipText(key) {
    const th = TH(), c1 = th.c1 || {}, sc = D().scripts || {};
    const chipOf = (arr) => ((arr || []).find((x) => x.chip) || {}).chip || '';
    switch (key) {
      case 'c0': return c1.chip0 || '';
      case 'c4a': return c1.chip4a || '';
      case 'c4b': return c1.chip4b || '';
      case 'D': return c1.chipD || '';
      case 'S': return c1.chipS || '';
      case 'fake': return th.fakeChip || '';
      case 'jTail': return chipOf(sc.jTail);
      case 'j0205': return chipOf(sc.j0205);
      case 'm0212': return c1.chipE || chipOf(sc.m0212);
    }
    return '';
  }
  function chipsFor(thread) {
    const s = so(), out = [];
    const add = (key, extra) => out.push(Object.assign({ key, text: T(chipText(key)) }, extra || {}));
    if (thread === 'fake') {
      if (flag('M5') && !s.fakeChipGone && s.fake !== 'blocked') add('fake', { dismiss: true, dismissLabel: T(UI('keep') || '두기') });
    } else if (thread === 'real') {
      if (!s.realUnres) return out;
      if (!flag('C1')) { add('c0'); return out; }
      if (s.chip.real === 'c4a' || s.chip.real === 'c4b') add(s.chip.real);
      if (flag('M6') && !flag('M7') && !s.dSent && !flag('C1b')) add('D');
      if (flag('M6') && !flag('M8') && !s.sSent && !flag('makerStayDown')) add('S');
      if (s.chip.real === 'm0212') add('m0212');
    } else if (thread === 'jimin_0412') {
      if (s.chip.jimin_0412 === 'jTail' || s.chip.jimin_0412 === 'j0205') add(s.chip.jimin_0412);
    }
    return out;
  }

  /* ---------------- resolving entries → displayable messages ---------------- */
  function myText(e) {
    const t = sess.get(e.id);
    if (t != null) return String(t);
    const sc = D().scripts || {};
    if (e.slot === 'answer') return e.ok ? T(sc.restoreAnswerOk || '한 마디만 나왔어요') : (sc.restoreOther || '…');
    if (e.slot === 'where') return e.ok ? T(sc.restoreWhereOk || '옥상 물탱크실') : (sc.restoreOther || '…');
    if (e.chip) return T(chipText(e.chip));
    return sc.restoreOther || '…';
  }
  function resolve(thread, e) {
    const X = idx();
    if (e.from === 'me' && !X[e.id]) return { id: e.id, from: 'me', text: myText(e), t: e.t, fail: !!e.fail, read: !!e.read, raw: true };
    const d = X[e.id] || e;
    let text = d.text;
    if (typeof text === 'function') text = text(cb);
    return {
      id: e.id, from: d.sys ? 'sys' : (d.from === 'me' ? 'me' : 'them'), sys: d.sys ? T(d.sys) : null,
      text: T(text || ''), img: d.img || null, vm: d.vm || null, t: e.t != null ? e.t : d.t,
      fail: !!(e.fail || d.failed), read: !!e.read, his: !!d.his,
    };
  }
  MO.messages = function (thread) {
    const base = (BASE[thread] ? BASE[thread]() : []).map((m) => resolve(thread, m));
    return base.concat(live(thread).map((e) => resolve(thread, e)));
  };
  const lastMsg = (thread) => { const a = MO.messages(thread); return a.length ? a[a.length - 1] : null; };

  /* ---------------- read / unread ---------------- */
  function unread(thread) {
    if (thread === 'real' && !so().realUnres) return 0;
    if (thread === 'fake' && so().fake !== 'normal') return 0;
    const base = BASE[thread] ? BASE[thread]() : [];
    const all = base.concat(live(thread));
    const rp = G.state && G.state.read ? G.state.read['moment:' + thread] : null;
    const inc = (m) => { const d = idx()[m.id] || m; return m.from !== 'me' && d.from !== 'me' && !d.sys; };
    let n = 0;
    if (typeof rp !== 'number') {
      base.forEach((m) => { if (m.unread) n++; });
      live(thread).forEach((m) => { if (inc(m)) n++; });
      return n;
    }
    for (let i = rp; i < all.length; i++) if (inc(all[i])) n++;
    return n;
  }
  function markRead(thread) {
    if (!G.state) return;
    G.state.read = G.state.read || {};
    G.state.read['moment:' + thread] = (BASE[thread] ? BASE[thread]().length : 0) + live(thread).length;
    save(); refreshBadges();
  }
  MO.unreadTotal = function () { return ['jimin_0412', 'fake', 'real'].reduce((a, t) => a + unread(t), 0); };

  /* ---------------- views ---------------- */
  const views = {};   // thread → { api, kind:'chat'|'restricted'|'dash', refresh() }
  MO.isOpen = function (thread) {
    const v = views[thread];
    if (!v || !v.api.scr.isConnected || v.api.scr.classList.contains('covered')) return false;
    if (G.phone && G.phone.isLocked && G.phone.isLocked()) return false;
    if (v.kind === 'dash') return false;
    return !isDash();
  };

  /* ---------------- notifications (shell routes tones / banners / users) ---------------- */
  const THREAD_TITLE = { fake: '{MAKER_CONTACT}', real: '{MAKER_CONTACT}', jimin_0412: 'jimin_0412', seah_y: 'seah_y' };
  function notifyFor(thread, entry, opts) {
    if (!G.phone || !G.phone.notify) return;
    const d = idx()[entry.id] || {};
    let body = typeof d.text === 'function' ? d.text(cb) : d.text;
    try {
      G.phone.notify({
        id: opts.nid, app: 'moment', chat: thread, user: 'n',
        title: THREAD_TITLE[thread] || '', body: body || '',     // raw tokens — expanded by shell at render (§10 F)
        route: { app: 'moment', params: { thread } }, coalesce: opts.coalesce !== false,
        when: opts.when || undefined,                            // a line stamped ahead of a held clock keeps its own time
      });
    } catch (e) { console.error('[social] notify', e); }
  }

  /** append an entry to a thread (live), update an open view, notify */
  function pushEntry(thread, entry, opts) {
    opts = opts || {};
    const incoming = entry.from !== 'me';
    if (incoming && opts.network !== false && !online()) {   // offline → queue, original timestamp kept (§5.6 · ARCH G29)
      so().queue.push({ thread, entry, opts: { nid: opts.nid || null, notify: opts.notify !== false, coalesce: opts.coalesce !== false, when: opts.when || null } });
      save();
      return entry;
    }
    if (entry.t == null) entry.t = nowMs();
    live(thread).push(entry);
    save();
    const v = views[thread];
    const m = resolve(thread, entry);
    if (v && v.api.scr.isConnected && v.kind !== 'restricted') { v.add ? v.add(entry, m) : v.api.add(m); }
    else if (v && v.kind === 'restricted' && v.api.scr.isConnected) v.api.add(m);
    if (incoming && opts.notify !== false) notifyFor(thread, entry, opts);
    if (MO.isOpen(thread)) markRead(thread);
    if (entry.id === 'f0016c' && v && v.api.scr.isConnected) setFlag('fakeLineSeen');
    refreshBadges();
    if (G.bus) G.bus.emit('chat:msg', { thread, msg: entry });
    rootRefresh();
    return entry;
  }
  function flushQueue() {
    if (!online()) return;
    const s = so(); const q = s.queue.splice(0, s.queue.length);
    q.forEach((x) => pushEntry(x.thread, x.entry, Object.assign({}, x.opts, { network: false })));
  }
  function deliver(thread, it) {
    const entry = { id: it.id, t: it.t != null ? it.t : notBefore(thread, stamp(it.at)) };   // it.t = an exact story time (K · 01:12)
    let nid = it.nid || null, notify = it.notify;
    if (notify == null) {
      if (thread === 'real') { nid = nid || ((it.n11 ? 'N11:' : 'N10:') + it.id); notify = true; }
      else notify = !!nid;
    }
    return pushEntry(thread, entry, { nid, notify, when: it.when || null });
  }

  /* ---------------- script queue (typing dots → line), persisted in vars.so.q ---------------- */
  function enqueue(thread, items) {
    const s = so();
    const q = (s.q[thread] = s.q[thread] || []);
    items.forEach((it) => q.push(it));
    save();
    if (!SCH.has('social:q:' + thread)) scheduleHead(thread);
  }
  const queueBusy = (thread) => !!((so().q[thread] || []).length);
  function scheduleHead(thread) {
    const s = so(); const q = s.q[thread] || [];
    if (!q.length) { setTyping(thread, false); return; }
    const it = q[0];
    SCH.after(it.ms || 0, 'social:q:' + thread, { thread });
    setTyping(thread, it.typ != null ? !!it.typ : !!it.id);
  }
  function onQ(thread) {
    const s = so(); const q = s.q[thread] || [];
    if (!q.length) { setTyping(thread, false); return; }
    const it = q.shift(); save();
    setTyping(thread, false);
    if (it.id) deliver(thread, it);
    [].concat(it.act || []).forEach((a) => runAct(a, thread, it));
    scheduleHead(thread);
  }
  function setTyping(thread, on) {
    so().typ[thread] = on ? 1 : 0;
    const v = views[thread];
    if (v && v.kind === 'chat') v.api.typing(on);
    rootRefresh();
  }
  MO.typing = function (thread, ms) { setTyping(thread, true); return new Promise((r) => setTimeout(() => { setTyping(thread, false); r(); }, ms || 1200)); };

  /* ---------------- actions run right after a queued line ---------------- */
  function runAct(a, thread) {
    const s = so();
    if (a === 'mono3') { try { G.e2 && G.e2.mono && G.e2.mono('mono3'); } catch (e) {} return; }
    if (a === 'chip4') { s.chip.real = flag('M2') ? 'c4a' : 'c4b'; SCH.after(((TH().c1 || {}).timing || {}).chip4Timeout || 20000, 'social:chip4'); return refreshView('real'); }
    if (a === 'b11') { s.done.c1_3a = 1; mark('B11'); return; }
    if (a === 'C1b') { setFlag('C1b'); return refreshView('real'); }   // climax jumps the clock to 00:27 on flag:C1b (ARCH §4.16)
    if (a === 'stayDown') { setFlag('makerStayDown'); return refreshView('real'); }
    if (a === 'arrived') { setFlag('makerArrived'); return; }
    if (a === 'read') {
      const arr = live(thread);
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].from === 'me') { arr[i].read = true; break; }
      save();
      const v = views[thread];
      if (v && v.api.scr.isConnected) { const e = arr.filter((x) => x.from === 'me').pop(); if (e) v.api.setRead(e.id); }
      return;
    }
    if (a === 'gsm') {
      try { G.audio && G.audio.gsmTank && G.audio.gsmTank.pulse && G.audio.gsmTank.pulse({ peak: 0.22, upMs: 100, holdMs: 300, downMs: 100, arc: true }); } catch (e) {}
      try { G.audio && G.audio.sub && G.audio.sub('S05', { az: 70 }); } catch (e) {}
      return;
    }
    if (a === 'answerMode') {
      if (s.earlyOk) { s.script.j0200 = 'judged'; save(); enqueue('jimin_0412', [{ id: 'jRight', ms: 2500, act: ['endRight'] }]); return refreshView('jimin_0412'); }
      s.script.j0200 = 'answer'; return refreshView('jimin_0412');
    }
    if (a === 'endRight' || a === 'endNone') {
      s.script.j0200 = 'done'; s.scriptRes = s.scriptRes || {}; s.scriptRes.j0200 = { chip: a === 'endRight' ? 'right' : 'none', right: a === 'endRight' };
      save();
      hook('end:reached', { right: a === 'endRight' });   // flow sets END · answeredRight · stage.e2_jimin · commit (ARCH §4.20)
      refreshView('jimin_0412');
      resolveScript('j0200');
      return;
    }
    if (a.indexOf('chip:') === 0) { s.chip[thread] = a.slice(5); save(); return refreshView(thread); }
    if (a.indexOf('resolve:') === 0) { const k = a.slice(8); s.script[k] = 'done'; s.scriptRes = s.scriptRes || {}; s.scriptRes[k] = s.scriptRes[k] || { chip: 'sent' }; save(); resolveScript(k); return; }
  }

  /* ---------------- tonight (23:45 … 00:16, by the in-game clock) + clock-timed maker lines ---------------- */
  function clockTick() {
    if (!G.state) return;
    const s = so();
    if (online()) {
      for (const it of (TH().tonight || [])) {
        if (s.tonight[it.id]) continue;
        if (!passed(it.at)) break;
        if (flag('C1')) { s.tonight[it.id] = 'x'; continue; }     // C1 first → the remaining scheduled lines are cancelled (§3.13)
        s.tonight[it.id] = 'd';
        const restricted = !s.realUnres;
        pushEntry('real', { id: it.id, t: +dateOf(it.at) }, { notify: !restricted, nid: 'N10p:' + it.id, network: false });
        if (restricted && !s.done.B06) { s.done.B06 = 1; mark('B06'); }
      }
    }
    const at = ((TH().c1 || {}).at) || { A: '00:44', K: '01:12' };
    if (flag('C1') && passed(at.A) && !s.done.A) {
      s.done.A = 1; mark('B19');
      enqueue('real', [{ id: 'cA1', ms: 1000, n11: true }, { id: 'cA2', ms: 1600, n11: true }, { id: 'cA3', ms: 1400, n11: true, act: ['arrived'] }]);
    }
    // K (§3.13 · §4.1.6 K · §4.10.1 · §12.9 #13 — 01:12): K comes after the M8 door opens and before the 01:20 card. From M8
    // (01:10) the clock is held for the door scene and jumps to 01:20 on the next card, so K cannot wait for passed('01:12')
    // alone, and it must not go out at M8 itself (Kang's S18 at the door, status bar 01:10). It goes out once the 01:10
    // card is done — ending.js's end:step 'k0110', or vars.endStep set at all on a resume (k0110 is the first step) — or
    // when the clock passes 01:12 (fallback), and only while the user is {N}: a '—' user is switched to {N} right after
    // k0110 (G.users.forceN → users:switched re-runs this). ending.js then sets the 01:20 card aside, moves the clock to
    // 01:12 and waits for cK2 (banners sit under the card layer). Both lines carry the story stamp 오전 1:12 (thread time +
    // banner time), never the held or jumped clock.
    const doorCardDone = !!(G.state.vars && G.state.vars.endStep);
    if (flag('C1') && !s.done.K && !isDash() && (passed(at.K) || doorCardDone)) {
      s.done.K = 1;
      const t = +dateOf(at.K), when = fmtStamp(t);
      enqueue('real', [{ id: 'cK1', ms: 1200, n11: true, t, when }, { id: 'cK2', ms: 1400, n11: true, t, when }]);
    }
    save();
  }
  function cancelTonight() { const s = so(); (TH().tonight || []).forEach((it) => { if (!s.tonight[it.id]) s.tonight[it.id] = 'x'; }); save(); }
  const restrictedCount = () => { const s = so(); let n = 0; if (!s.realUnres) n += live('real').filter((e) => e.from !== 'me').length; if (s.fake === 'restricted') n += live('fake').filter((e) => e.from !== 'me').length; return n; };
  MO.hiddenCount = function () { const s = so(); return restrictedCount() + (s.realUnres ? 0 : (D().restrictedComments || []).length); };
  MO.state = function () { const s = so(); return { fake: s.fake, realUnres: !!s.realUnres, c1Pm: pmOf('C1') }; };

  /* ---------------- M5 — the three lines (B10 · N06–N08 · §5.7 ③) ---------------- */
  function pushFakeM5(i) {
    const s = so();
    if (s.fake === 'blocked') return;
    const ids = ['f0016a', 'f0016b', 'f0016c'], nids = ['N06', 'N07', 'N08'];
    if (live('fake').some((e) => e.id === ids[i])) return;
    pushEntry('fake', { id: ids[i] }, { nid: nids[i], notify: s.fake === 'normal', coalesce: false });
  }
  function onM5() {
    const s = so();
    if (s.fake !== 'blocked') { pushFakeM5(0); SCH.after(2500, 'social:m5b'); SCH.after(5000, 'social:m5c'); }
    if (flag('C1') && !s.done.c1_3a) SCH.at((pmOf('M5') || pm()) + (((TH().c1 || {}).timing || {}).b11AfterM5 || 20000) - 1400, 'social:B11');
    rootRefresh();
  }

  /* ---------------- sending ---------------- */
  function myEntry(thread, text, chipKey) {
    const s = so();
    const e = { id: 'me' + (++s.seq), from: 'me', t: notBefore(thread, nowMs()) };
    if (chipKey) { e.chip = chipKey; e.edited = text !== T(chipText(chipKey)); }
    else e.edited = true;
    if (e.edited) sess.set(e.id, text);
    return e;
  }
  function step5() {
    const v = so().tonight.r0010 === 'd';
    const tm = (TH().c1 || {}).timing || {};
    enqueue('real', [{ id: 'c1_5', ms: tm.c1_5 || 2400 }, { id: v ? 'c1_6v' : 'c1_6', ms: tm.c1_6 || 1200 },
      { id: null, ms: (tm.c1_7wait || 15000) - 1600, typ: false }, { id: v ? 'c1_7v' : 'c1_7', ms: 1600 },
      { id: 'c1_8', ms: tm.c1_8 || 2000 }, { id: 'c1_9', ms: tm.c1_9 || 1500 }]);
    refreshView('real');
  }
  function sendReal(text, chipKey) {
    const s = so();
    const e = myEntry('real', text, chipKey);
    if (!online()) { e.fail = true; pushEntry('real', e, { notify: false }); return; }
    if (flag('C1') && !chipKey) { e.slot = 'where'; e.ok = whereOk(text); }
    pushEntry('real', e, { notify: false });
    if (!flag('C1')) {
      setFlag('C1'); setFlag('fakeKnown');
      cancelTonight();
      const tm = (TH().c1 || {}).timing || {};
      const m5 = flag('M5');
      // the first message can already name the tank (§4.1.6 W+ 'whereAsked 전에 보내도 같은 반응') — its reply follows the first three lines
      const tankFirst = whereOk(text) && !flag('whereTank');
      if (tankFirst) setFlag('whereTank');
      enqueue('real', [{ id: 'c1_1', ms: tm.c1_1 || 3000 }, { id: 'c1_2', ms: tm.c1_2 || 1600 },
        { id: 'c1_3', ms: tm.c1_3 || 2000, act: m5 ? ['mono3'] : ['mono3', 'chip4'] }].concat(m5 ? [{ id: 'c1_3a', ms: tm.c1_3a || 2200, act: ['b11', 'chip4'] }] : [])
        .concat(tankFirst ? [{ id: 'cW1', ms: 1500 }, { id: 'cW2', ms: 1400 }] : []));
      SCH.at((pmOf('C1') || pm()) + (tm.whereAfterC1 || 40000), 'social:where');
      refreshView('real');
      return;
    }
    if (whereOk(text) && !flag('whereTank')) {
      setFlag('whereTank');
      enqueue('real', [{ id: 'cW1', ms: 1500 }, { id: 'cW2', ms: 1400 }]);
      return;
    }
    if (chipKey === 'D') { s.dSent = 1; enqueue('real', [{ id: 'cD1', ms: 1100 }, { id: 'cD2', ms: 1800 }, { id: 'cD3', ms: 1400 }, { id: 'cD4', ms: 1600, act: ['C1b'] }]); return refreshView('real'); }
    if (chipKey === 'S') { s.sSent = 1; enqueue('real', [{ id: 'cS1', ms: 1400 }, { id: 'cS2', ms: 1500, act: ['stayDown'] }]); return refreshView('real'); }
    if (s.chip.real === 'm0212') { s.chip.real = null; runAct('resolve:m0212', 'real'); return refreshView('real'); }
    if (s.chip.real === 'c4a' || s.chip.real === 'c4b') { s.chip.real = null; SCH.cancel('social:chip4'); step5(); return; }
    if (flag('whereAsked') && !flag('whereTank') && !s.wMinus) { s.wMinus = 1; enqueue('real', [{ id: 'cWm', ms: 1600 }]); return; }
    if (queueBusy('real')) return;   // a scripted line is waiting — no pool reply
    let st = 'preM6';
    if (flag('M8') || passed('01:10')) st = 'after0110';
    else if (flag('M7') && passed('00:44')) st = 'after0044';
    else if (flag('M7')) st = 'm7';
    else if (flag('M6')) st = 'm6';
    const pool = (TH().pool || {})[st] || [];
    const used = s.pool[st] || 0;
    const id = used < pool.length ? 'pl_' + st + '_' + used : 'pl_x';
    if (used < pool.length) s.pool[st] = used + 1;
    enqueue('real', [{ id, ms: 1500 }]);
  }
  function sendFake(text, chipKey) {
    const s = so();
    if (s.fake === 'blocked') return;
    const e = myEntry('fake', text, chipKey);
    if (!online()) { e.fail = true; pushEntry('fake', e, { notify: false }); return; }
    pushEntry('fake', e, { notify: false });
    setFlag('fakeReplied');
    try { G.e2 && G.e2.stage && G.e2.stage('e2_fakeReply', true); } catch (er) {}
    s.fakeChipGone = 1;
    refreshView('fake');
    // his account receives it: 1 s → 읽음 + 0.5 s GSM from the tank (70°) + S05 — and nothing else, ever (§3.12)
    enqueue('fake', [{ id: null, ms: 1000, typ: false, act: ['read', 'gsm'] }]);
  }
  function sendJimin(text, chipKey) {
    const s = so();
    const unblocked = !!s.script.j0200;
    const e = myEntry('jimin_0412', text, chipKey);
    if (!unblocked) { e.fail = true; pushEntry('jimin_0412', e, { notify: false }); return; }   // blocked: red ⓘ 전송되지 않음, no reason (§3.7)
    if (!online()) { e.fail = true; pushEntry('jimin_0412', e, { notify: false }); return; }
    if (s.script.j0200 === 'answer' && !chipKey) {
      const ok = answerOk(text);
      e.slot = 'answer'; e.ok = ok;
      pushEntry('jimin_0412', e, { notify: false });
      const items = [{ id: null, ms: 1000, typ: false, act: ['read'] }];
      if (ok) { s.script.j0200 = 'judged'; items.push({ id: 'jRight', ms: 2500, act: ['endRight'] }); }
      else if (!s.wrongOnce) {
        s.wrongOnce = 1;
        items.push({ id: null, ms: 1100, typ: true }, { id: null, ms: 600, typ: false }, { id: null, ms: 1100, typ: true }, { id: null, ms: 500, typ: false }, { id: 'jWrong1', ms: 1200 });
      }
      enqueue('jimin_0412', items);
      refreshView('jimin_0412');
      return;
    }
    // typed while the 02:00 lines are still arriving (before the question lands): a right answer is remembered ({slot, ok}
    // only — no text) and judged the moment answer mode opens; anything else stays a plain DM and the question still waits
    if (s.script.j0200 === 'lines' && !chipKey && answerOk(text)) { e.slot = 'answer'; e.ok = true; s.earlyOk = 1; }
    pushEntry('jimin_0412', e, { notify: false });
    const items = [{ id: null, ms: 1000, typ: false, act: ['read'] }];
    const ch = s.chip.jimin_0412;
    if (ch === 'jTail') { s.chip.jimin_0412 = null; items.push({ id: 'jT3', ms: 1400 }, { id: 'jT4', ms: 1200, act: ['resolve:jTail'] }); }
    else if (ch === 'j0205') { s.chip.jimin_0412 = null; items.push({ id: 'jM6', ms: 1000 }, { id: 'jM7', ms: 1400, act: ['resolve:j0205'] }); }
    enqueue('jimin_0412', items);
    refreshView('jimin_0412');
  }
  function noAnswer() {
    const s = so();
    if (s.script.j0200 !== 'answer') return;
    s.script.j0200 = 'judged';
    enqueue('jimin_0412', [{ id: 'jNone', ms: 1400, act: ['endNone'] }]);
    refreshView('jimin_0412');
  }

  /* ---------------- scripts on request from flow (§4.10.6–§4.10.8) ---------------- */
  const waiters = {};
  function resolveScript(k) {
    const r = (so().scriptRes || {})[k] || { chip: 'sent' };
    (waiters[k] || []).splice(0).forEach((fn) => { try { fn(r); } catch (e) {} });
  }
  MO.play = function (id) {
    ensureInit();
    const s = so();
    return new Promise((resolveP) => {
      if (s.script[id] === 'done') { resolveP((s.scriptRes || {})[id] || { chip: 'sent' }); return; }
      (waiters[id] = waiters[id] || []).push(resolveP);
      if (s.script[id]) return;   // already running (reload) — the persisted queue continues
      if (id === 'j0200') {
        s.script.j0200 = 'lines';
        // N16 (the 02:00 banner) is raised by flow ending.js right before play('j0200') — not here (one tone, ledger §4.8)
        enqueue('jimin_0412', [{ id: 'j0200a', ms: 0, at: '02:00', typ: false },{ id: 'j0200b', ms: 1400 }, { id: 'j0200c', ms: 1200 }, { id: 'j0200d', ms: 1600, act: ['answerMode'] }]);
      } else if (id === 'jTail') {
        s.script.jTail = 'run';
        enqueue('jimin_0412', [{ id: cb('jimin') ? 'jT1y' : 'jT1n', ms: 1400 }, { id: 'jT2', ms: 1600, act: ['chip:jTail'] }]);
      } else if (id === 'j0205') {
        s.script.j0205 = 'run';
        enqueue('jimin_0412', [{ id: 'jM1', ms: 1200 }, { id: 'jM2', ms: 1400, at: '02:05' }, { id: 'jM3', ms: 1600 }, { id: cb('mom') ? 'jM4y' : 'jM4n', ms: 1600 }, { id: 'jM5', ms: 1500, act: ['chip:j0205'] }]);
      } else if (id === 'm0212') {
        s.script.m0212 = 'run';
        enqueue('real', [{ id: 'cE1', ms: 1000, n11: true }, { id: 'cE2', ms: 1400, n11: true }, { id: 'cE3', ms: 1400, n11: true, act: ['chip:m0212'] }]);
      } else { s.script[id] = 'done'; resolveScript(id); }
      save();
      rootRefresh();
    });
  };

  /** ARCH §4.19 push(thread, msg, opts) — msg = data id or {from, text,…} (raw tokens only) */
  MO.push = function (thread, msg, opts) {
    ensureInit();
    opts = opts || {};
    const entry = typeof msg === 'string' ? { id: msg } : Object.assign({ id: 'x' + (++so().seq) }, msg);
    if (opts.typingMs) {
      return new Promise((r) => { setTyping(thread, true); setTimeout(() => { setTyping(thread, false); r(pushEntry(thread, entry, opts)); }, opts.typingMs); });
    }
    return Promise.resolve(pushEntry(thread, entry, opts));
  };

  /* ---------------- restriction / block ---------------- */
  MO.unrestrict = function (who) {
    const s = so();
    if (who === 'fake') { if (s.fake !== 'restricted') return false; s.fake = 'normal'; }
    else { if (s.realUnres) return false; s.realUnres = true; setFlag('hiddenSeen'); }
    save();
    toast(STR('unrestricted'));       // N14
    refreshBadges(); rootRefresh();
    Object.keys(views).forEach((k) => views[k].refresh && views[k].refresh());
    return true;
  };
  function seenHidden() { setFlag('hiddenSeen'); }
  function fakeMenuAct(item) {
    const s = so();
    if (item === 'info') { setFlag('fakeKnown'); return accountInfo('fake'); }
    if (item === 'restrict') { setFlag('fakeKnown'); if (s.fake === 'normal') { const d = now(); s.fake = 'restricted'; s.fakeRestrictedOn = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' ' + C.fmtK(d); save(); rootRefresh(); Object.keys(views).forEach((k) => views[k].refresh && views[k].refresh()); } return; }
    if (item === 'block') {
      setFlag('fakeKnown');
      const ask = G.phone && G.phone.dialog ? G.phone.dialog({ title: '', text: T(STR('blockQ')), buttons: [{ label: T(UI('cancel') || '취소'), value: 'cancel' }, { label: T(UI('block') || '차단'), value: 'block', style: 'danger' }] }) : Promise.resolve('block');
      ask.then((v) => {
        if (v !== 'block') return;
        s.fake = 'blocked'; s.fakeChipGone = 1; save();
        rootRefresh(); Object.keys(views).forEach((k) => views[k].refresh && views[k].refresh());
      });
      return;
    }
    if (item === 'report') { setFlag('fakeKnown'); toast(STR('reported')); }
  }

  /* =========================================================
   * UI helpers
   * ========================================================= */
  const IC = {
    home: '<svg viewBox="0 0 24 24"><path d="M3.5 10.5L12 3.8l8.5 6.7V20a1 1 0 01-1 1H15v-6h-6v6H4.5a1 1 0 01-1-1z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.6 15.6L20.5 20.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    dm: '<svg viewBox="0 0 24 24"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    heartF: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="currentColor"/></svg>',
    cmt: '<svg viewBox="0 0 24 24"><path d="M20.5 11.6a8.4 8.4 0 01-12.3 7.4L3.5 20.5l1.6-4.4A8.4 8.4 0 1120.5 11.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11.5a6 6 0 0012 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor"/></svg>',
  };
  const btnIcon = (svg, label, qa, fn) => el('button.so2-ib', { 'aria-label': label, 'data-qa': qa || null, html: svg, onclick: (e) => { e.stopPropagation(); tap(); fn && fn(); } });

  function avatarFor(id, px) {
    const P = (D().profiles || {})[id] || {};
    if (id === 'fake' || id === 'real') return C.makerAvatar(px);
    if (id === 'n') return C.avatar({ name: '{N}', bg: '#b9a7d6' }, px);
    if (id === 'sagongsa') return C.avatar({ black: true }, px);
    return C.avatar({ img: P.avatar, initial: P.initial, name: P.name }, px);
  }
  function nameOf(id) {
    const P = (D().profiles || {})[id] || {};
    if (id === 'jimin_0412') return 'jimin_0412';
    if (id === 'seah_y') return 'seah_y';
    return T(P.name || '');
  }
  function handleOf(id) { const P = (D().profiles || {})[id] || {}; const h = typeof P.handle === 'function' ? P.handle() : P.handle; return h ? T(h) : ''; }

  /** small system sheet (G.phone.sheet) with a dialog fallback */
  function sheet(o) {
    try { if (G.phone && G.phone.sheet) return G.phone.sheet(o); } catch (e) { console.error('[social] sheet', e); }
    if (G.phone && G.phone.dialog) return G.phone.dialog({ title: o.title, text: o.text, buttons: o.buttons });
    return Promise.resolve(null);
  }
  function activitySheet() { return sheet({ title: T(STR('activityTitle')), text: T(STR('activity')), buttons: [{ label: T(UI('ok') || '확인'), value: 'ok', style: 'primary' }], qa: 'moment.activity' }); }
  function newAcctSheet(text) { return sheet({ title: '', text: T(text), buttons: [{ label: T(UI('ok') || '확인'), value: 'ok', style: 'primary' }], qa: 'moment.limit' }); }
  /** sheet whose body holds our own buttons (data-qa moment.menu:<item>) — closes through G.phone.dismissModals */
  function bodySheet(title, bodyNode, qa) {
    return new Promise((res) => {
      let picked = null, done = false;
      const fin = () => { if (done) return; done = true; res(picked); };
      const pick = (v) => { picked = v; closer(); };
      let closer = () => {};
      if (G.phone && G.phone.sheet) {
        let shellFinish = null;   // shell's sheet passes its finish() through o.mount (ARCH §4.9 sheet)
        closer = () => { if (shellFinish) shellFinish(picked); else { try { G.phone.dismissModals && G.phone.dismissModals(); } catch (e) {} setTimeout(fin, 0); } };
        G.phone.sheet({ title, body: bodyNode, buttons: [{ label: T(UI('cancel') || '취소'), value: null }], qa: qa || 'moment.sheet', mount: (finish) => { shellFinish = finish; } }).then((v) => { if (v != null && picked == null) picked = v; fin(); }, fin);
      } else {
        const ovNode = el('div.so2-sheetwrap', { onclick: (e) => { if (e.target === ovNode) close2(); } }, el('div.so2-sheet', null, title ? el('div.so2-sheet-t', null, title) : null, bodyNode,
          el('button.so2-sheet-cancel', { onclick: () => close2() }, T(UI('cancel') || '취소'))));
        const ov = G.phone && G.phone.overlay ? G.phone.overlay(ovNode, { onBack: () => close2() }) : (document.getElementById('overlays') || document.body).appendChild(ovNode) && { close() { ovNode.remove(); } };
        function close2() { try { ov.close(); } catch (e) {} fin(); }
        closer = close2;
      }
      bodyNode._pick = pick;
    });
  }
  function menuSheet(items) {
    const body = el('div.so2-menu');
    const p = bodySheet('', body, 'moment.menuSheet');
    items.forEach((it) => body.appendChild(el('button.so2-menu-i' + (it.danger ? '.danger' : '') + (it.disabled ? '.disabled' : ''), { 'data-qa': 'moment.menu:' + it.id, onclick: () => { if (it.disabled) return; tap(); body._pick(it.id); } },
      el('span', null, it.label), it.sub ? el('small', null, it.sub) : null)));
    return p;
  }

  /* =========================================================
   * Chat screens
   * ========================================================= */
  function vmBubble(m) {
    const vm = m.vm; const subs = (vm.subs || []).map((x) => ({ t0: x.t0, t1: x.t1, text: T(x.text) }));
    const getBuffer = () => { try { return G.audio && G.audio.buffer ? Promise.resolve(G.audio.buffer(vm.buffer)) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
    const onFirstPlay = () => { if (m.id === 'jvm') setFlag('vmPlayed'); };
    if (G.ui && G.ui.voiceBubble) {
      try {
        const vb = G.ui.voiceBubble({ id: m.id, dur: vm.dur, getBuffer, subs, unplayed: m.id === 'jvm' ? !flag('vmPlayed') : !!vm.unplayed, from: 'voice', onFirstPlay, qa: 'vm' });
        if (vb && vb.node) return el('div.so2-bub.so2-vmwrap', null, vb.node);
      } catch (e) { console.error('[social] voiceBubble', e); }
    }
    return fallbackVM(m, vm, subs, getBuffer, onFirstPlay);
  }
  /** minimal voice-message bubble used only if core's G.ui.voiceBubble is missing (partial build) */
  function fallbackVM(m, vm, subs, getBuffer, onFirstPlay) {
    const unplayed = m.id === 'jvm' ? !flag('vmPlayed') : !!vm.unplayed;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const timeEl = el('span.so2-vm-time', null, `0:00 / ${fmt(vm.dur)}`);
    const tag = unplayed ? el('span.so2-vm-tag', null, el('i.so2-vm-dot'), '· ' + STR('unplayed')) : null;
    const bars = el('span.so2-vm-wave', { 'data-qa': 'vm.wave' });
    for (let i = 0; i < 26; i++) bars.appendChild(el('i', { style: { height: (6 + Math.round(Math.abs(Math.sin(i * 1.7 + 0.6)) * 16)) + 'px' } }));
    const sub = el('div.so2-vm-sub');
    const btn = el('button.so2-vm-play', { 'aria-label': '▶', 'data-qa': 'vm.play', html: IC.play });
    let playing = false, t0 = 0, pos = 0, raf = 0, handle = null, first = unplayed;
    function frame() {
      if (!playing) return;
      pos = Math.min(vm.dur, (performance.now() - t0) / 1000);
      timeEl.textContent = `${fmt(pos)} / ${fmt(vm.dur)}`;
      bars.style.setProperty('--p', (pos / vm.dur * 100).toFixed(1) + '%');
      const s = subs.find((x) => pos >= x.t0 && pos < x.t1); sub.textContent = s ? s.text : '';
      if (pos >= vm.dur) { stop(); return; }
      raf = requestAnimationFrame(frame);
    }
    function stop() { playing = false; cancelAnimationFrame(raf); btn.innerHTML = IC.play; sub.textContent = ''; try { handle && handle.stop && handle.stop(); } catch (e) {} handle = null; }
    btn.addEventListener('click', () => {
      tap();
      if (playing) { stop(); return; }
      playing = true; btn.innerHTML = IC.pause; t0 = performance.now(); pos = 0;
      if (first) { first = false; if (tag) tag.remove(); onFirstPlay(); }
      try { if (G.media && G.media.play) handle = G.media.play(getBuffer(), { from: 'voice', id: m.id }); } catch (e) {}
      raf = requestAnimationFrame(frame);
    });
    return el('div.so2-bub.so2-vm', null,
      el('div.so2-vm-row', null, el('span.so2-vm-mic', { html: IC.mic }), btn, bars, timeEl),
      el('div.so2-vm-meta', null, el('span', null, T(UI('voice') || '음성 메시지')), tag),
      sub);
  }
  function special(m) { return m.vm ? vmBubble(m) : null; }

  function offlineBand() { return online() ? null : el('div.so2-band.warn', null, STR('offline')); }

  /** normal DM (fake · real (unrestricted) · jimin_0412) */
  function chatView(id) {
    const s = so();
    const P = (D().profiles || {})[id] || {};
    const api = C.view({
      skin: 'moment', title: nameOf(id), badge: id === 'fake' ? T(P.badge || UI('todayBadge')) : null,
      sub: id === 'jimin_0412' ? T(P.name || '지민') : handleOf(id) || null,
      avatar: avatarFor(id, 34), onTitle: () => MO.profile(id), avatarFor: () => avatarFor(id, 28), special,
      readLabel: T(UI('read') || '읽음'),
      right: [btnIcon(C.INFO_SVG, 'ⓘ', 'moment.info', () => MO.profile(id))],
      qa: 'moment.chat:' + id,
    });
    if (id === 'jimin_0412') { api.scr.querySelector('.so2-ch-n').textContent = T(P.name || '지민'); const sb = api.scr.querySelector('.so2-ch-sub'); if (sb) sb.textContent = 'jimin_0412'; }
    if (id === 'fake') {
      api.setLead(el('div.so2-newcard', null, avatarFor('fake', 64), el('b', null, nameOf('fake')), el('small', null, T(P.card || '게시물 0 · 팔로워 0')),
        el('button.so2-btn', { 'data-qa': 'moment.profile:fake', onclick: () => { tap(); MO.profile('fake'); } }, T(UI('viewProfile') || '프로필 보기'))));
    }
    let field = null, sendBtn = null, pending = null;
    function composer() {
      const s2 = so();
      if (id === 'fake' && s2.fake === 'blocked') { api.setChips([]); return api.setComposer(el('div.so2-compband', null, STR('blocked'))); }
      const ctx = id === 'jimin_0412' ? (s2.script.j0200 === 'answer' ? 'jiminAnswer' : 'dm:jimin') : id === 'fake' ? 'dm:fake' : 'dm:real';
      // ctx switch (dm:jimin → jiminAnswer when the 02:00 question completes): keep the SAME field — a player who started typing
      // early keeps the text and the open keyboard stays bound to a live field
      if (field && field._ctx !== ctx && field.opts) { field.opts.ctx = ctx; field._ctx = ctx; }
      if (!field) {
        if (G.ui && G.ui.field) {
          field = G.ui.field({ placeholder: T(UI('inputPh') || '메시지 입력…'), mode: 'ko', ctx, predict: true, numRow: true, submitLabel: T(UI('send') || '보내기'), onSubmit: () => doSend(), onChange: (v) => { sendBtn && sendBtn.classList.toggle('on', !!String(v).trim()); if (!String(v).trim()) pending = null; }, qa: 'chat.input' });
          field._ctx = ctx;
          field.node.classList.add('so2-field');
          field.node.dataset.qa = 'chat.input';
        }
        sendBtn = el('button.so2-send', { 'aria-label': T(UI('send') || '보내기'), 'data-qa': 'chat.send', html: C.SEND_SVG, onclick: () => doSend() });
        api.setComposer(el('div.so2-comp', null, field ? field.node : null, sendBtn));
      }
      const chips = chipsFor(id);
      if (id === 'jimin_0412' && s2.script.j0200 === 'answer') chips.push({ kind: 'button', qa: 'chat.noAnswer', text: T(UI('noAnswer') || '대답하지 않는다'), onClick: () => noAnswer() });
      const box = api.scr.querySelector('.so2-chips');
      const sig = chips.map((c) => c.key || c.qa || c.text).join('|');
      const sc = api.scr.body, nb = !!sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160;
      api.setChips(chips, (c) => { if (!field) return; field.set(c.text); pending = c.key; sendBtn.classList.add('on'); field.node.classList.remove('so2-flash'); void field.node.offsetWidth; field.node.classList.add('so2-flash'); },
        () => { so().fakeChipGone = 1; save(); composer(); });
      if (box) {
        const n = box.childElementCount;
        box.classList.toggle('so2-wrap', n > 0 && n <= 3);   // every real chip set (max: c4 + D + S) stays fully visible
        if (sig !== box.dataset.sig) { box.dataset.sig = sig; if (nb) setTimeout(() => { if (api.scr.isConnected) api.scrollEnd(true); }, 280); }
      }
    }
    function doSend() {
      if (!field) return;
      const v = String(field.value || '').trim();
      if (!v) return;
      const chipKey = pending; pending = null;
      field.clear(); sendBtn.classList.remove('on');
      try { G.audio && G.audio.sfx && G.audio.sfx.msgSend && G.audio.sfx.msgSend(); } catch (e) {}
      if (id === 'real') sendReal(v, chipKey);
      else if (id === 'fake') sendFake(v, chipKey);
      else if (id === 'jimin_0412') sendJimin(v, chipKey);
      composer();
    }
    let jObs = null;
    function watchFactJimin() {
      if (id !== 'jimin_0412' || flag('factJimin')) return;
      const row = api.rows.j51; if (!row || !window.IntersectionObserver) { return; }
      let tm = 0;
      jObs = new IntersectionObserver((ents) => ents.forEach((en) => {
        if (en.isIntersecting && en.intersectionRatio >= 0.6) { tm = setTimeout(() => { setFlag('factJimin'); jObs && jObs.disconnect(); }, 400); }
        else clearTimeout(tm);
      }), { root: api.scr.body, threshold: [0, 0.6, 1] });
      jObs.observe(row);
    }
    const view = {
      api, kind: 'chat',
      add(entry, m) { api.add(m); if (entry.id === 'f0016c') setFlag('fakeLineSeen'); },
      refresh() {
        if (id === 'real' && !so().realUnres) return;
        if (id === 'fake' && so().fake === 'restricted') { G.phone && G.phone.pop && G.phone.pop(true); openRestricted('fake'); return; }
        api.setBands([offlineBand()]);
        composer();
      },
    };
    views[id] = view;
    const msgs = MO.messages(id);
    const fillN09 = id === 'real' && s.realUnres && !s.realFilled && msgs.some((m) => m.from === 'them');
    if (fillN09) {
      s.realFilled = true; save();
      // N09: one tone while the bubbles fill (banner 0 · in the ledger) — before the view registers as open
      try { G.phone && G.phone.notify && G.phone.notify({ id: 'N09', app: 'moment', chat: 'real', user: 'n', title: '{MAKER_CONTACT}', body: '', banner: false }); } catch (e) {}
    }
    if (!fillN09) api.set(msgs);
    view.refresh();
    C.pushScreen(api.scr, { anim: 'slide', appId: 'moment', onClose: () => { if (views[id] === view) delete views[id]; api.close(); jObs && jObs.disconnect(); try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} }, onResume: () => { markRead(id); view.refresh(); } });
    if (fillN09) api.fill(msgs, 120).then(() => watchFactJimin());
    if (so().typ[id] && queueBusy(id)) api.typing(true);
    requestAnimationFrame(() => api.scrollEnd(false));
    setTimeout(() => { api.scrollEnd(false); watchFactJimin(); }, 80);
    markRead(id);
    if (id === 'jimin_0412') setFlag('jiminOpened');
    if (id === 'fake' && live('fake').some((e) => e.id === 'f0016c')) setFlag('fakeLineSeen');
    if (G.bus) { G.bus.emit('chat:open', { thread: id }); G.bus.emit('moment:thread', { id }); }
    return api.scr;
  }

  /** restricted conversation — real (or fake after 제한) */
  function openRestricted(id) {
    seenHidden();
    const api = C.view({ skin: 'moment', title: nameOf(id), avatar: avatarFor(id, 34), avatarFor: () => avatarFor(id, 28), onTitle: () => MO.profile(id), special, qa: 'moment.chat:' + id + ':restricted' });
    api.setBands([el('div.so2-band', null, STR('noReadReceipt')), offlineBand()]);
    api.set(MO.messages(id).filter((m) => m.from !== 'sys'));
    const btn = el('button.so2-btn.primary.so2-unres', { 'data-qa': 'moment.unrestrict', onclick: () => {
      tap();
      MO.unrestrict(id);
      if (G.phone && G.phone.pop) G.phone.pop(true);
      setTimeout(() => MO.openThread(id), 60);
    } }, T(UI('unrestrict') || '제한 해제'));
    api.setComposer(el('div.so2-restrict', null, el('div.so2-restrict-note', null, STR('restrictedNote')), btn, el('div.so2-compband', null, STR('restrictedBar'))));
    const view = { api, kind: 'restricted', refresh() {} };
    views[id] = view;
    C.pushScreen(api.scr, { anim: 'slide', appId: 'moment', onClose: () => { if (views[id] === view) delete views[id]; api.close(); } });
    setTimeout(() => api.scrollEnd(false), 60);
    if (G.bus) G.bus.emit('moment:thread', { id: id + ':restricted' });
    return api.scr;
  }

  /** '—' side: the fake account's conversation with {N} — mirrored (right = this account) + the draft */
  function dashChat() {
    const dv = D().dashView || {};
    const api = C.view({ skin: 'moment', title: T(dv.listName || '{N}'), avatar: avatarFor('n', 34), avatarFor: () => avatarFor('n', 28), special, qa: 'moment.chat:dash' });
    const flip = (m) => Object.assign({}, m, { from: m.from === 'me' ? 'them' : 'me', fail: false, read: false });
    const render = () => api.set(MO.messages('fake').filter((m) => m.from !== 'sys').map(flip));
    render();
    const sendBtn = el('button.so2-send.on', { 'aria-label': T(UI('send') || '보내기'), 'data-qa': 'chat.send', html: C.SEND_SVG, onclick: () => { tap(); newAcctSheet(dv.sendBlocked || '{$newAcctSend}'); } });
    api.setComposer(el('div.so2-comp.so2-draftc', null,
      el('div.so2-draft', { 'data-qa': 'chat.input' }, el('div.so2-draft-t', null, T(dv.draft || '')), el('div.so2-draft-n', null, T(dv.draftNote || ''))), sendBtn));
    const view = { api, kind: 'dash', add(entry, m) { api.add(flip(m)); }, refresh() { render(); } };
    views.fake = view;
    C.pushScreen(api.scr, { anim: 'slide', appId: 'moment', onClose: () => { if (views.fake === view) delete views.fake; api.close(); } });
    setTimeout(() => api.scrollEnd(false), 60);
    setFlag('draftSeen');
    setFlag('fakeLineSeen');   // the draft draws '문 열어 줘.' on screen (§2.4 · ARCH G9 — 'chat')
    if (G.bus) G.bus.emit('moment:thread', { id: 'dash' });
    return api.scr;
  }

  MO.openThread = function (id) {
    ensureInit();
    const s = so();
    if (isDash()) { if (id === 'fake' || id === 'dash' || id === 'n') return dashChat(); return null; }
    if (id === 'seah_y') return MO.profile('seah_y');
    if (id === 'real' && !s.realUnres) return openRestricted('real');
    if (id === 'fake' && s.fake === 'restricted') return openRestricted('fake');
    if (!BASE[id]) return null;
    return chatView(id);
  };
  function refreshView(thread) { const v = views[thread]; if (v && v.refresh && v.api.scr.isConnected) v.refresh(); }

  /* =========================================================
   * Profiles · posts · info · settings · search
   * ========================================================= */
  const hideKb = () => { try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} };
  function pushScr(scr, opts) { hideKb(); return C.pushScreen(scr, Object.assign({ anim: 'slide', appId: 'moment' }, opts || {})); }
  function profileHead(id, o) {
    o = o || {};
    const P = (D().profiles || {})[id] || {};
    const h = handleOf(id);
    return el('div.so2-prof', { 'data-qa': 'moment.profile:' + id },
      el('div.so2-prof-top', null, avatarFor(id, 78),
        el('div.so2-prof-id', null,
          el('div.so2-prof-name', null, el('b', null, o.name || nameOf(id)), id === 'fake' ? el('span.so2-badge', null, T(P.badge || UI('todayBadge'))) : null),
          h ? el('div.so2-prof-handle', null, h) : null,
          o.stats ? el('div.so2-prof-stats', null, o.stats) : null)),
      o.bio ? el('div.so2-prof-bio', null, o.bio) : null);
  }
  MO.profile = function (id) {
    ensureInit();
    if (id === 'n') return pushScr(nProfileScreen(false));
    const s = so();
    const P = (D().profiles || {})[id] || {};
    const wrap = el('div.so2-pwrap');
    const right = [];
    let title = nameOf(id);
    if (id === 'fake') {
      wrap.appendChild(profileHead('fake', { stats: T(P.stats || '') }));
      const btns = el('div.so2-pbtns', null,
        el('button.so2-btn.primary', { 'data-qa': 'moment.follow', onclick: () => tap() }, T(UI('follow') || '팔로우')),
        el('button.so2-btn', { 'data-qa': 'moment.message:fake', onclick: () => { tap(); isDash() ? newAcctSheet('{$newAcctSend}') : MO.openThread('fake'); } }, T(UI('message') || '메시지')));
      wrap.appendChild(btns);
      wrap.appendChild(el('div.so2-noposts', null, T(P.empty || UI('noPosts'))));
      right.push(btnIcon(IC.more, '⋯', 'moment.menu', () => {
        if (isDash()) return;
        const items = [{ id: 'info', label: T((P.menu || [])[0] || '이 계정 정보') }, { id: 'restrict', label: T((P.menu || [])[1] || '제한') }, { id: 'block', label: T((P.menu || [])[2] || '차단'), danger: true }, { id: 'report', label: T((P.menu || [])[3] || '신고'), danger: true }];
        menuSheet(items).then((v) => { if (v) fakeMenuAct(v); });
      }));
    } else if (id === 'real') {
      wrap.appendChild(profileHead('real', { stats: T(P.stats || '') }));
      const btnRow = el('div.so2-pbtns');
      const renderBtn = () => {
        btnRow.innerHTML = '';
        if (!so().realUnres) btnRow.appendChild(el('button.so2-btn.primary', { 'data-qa': 'moment.unrestrict', onclick: () => { tap(); MO.unrestrict('real'); renderBtn(); } }, T(UI('unrestrict') || '제한 해제')));
        else btnRow.appendChild(el('button.so2-btn.primary', { 'data-qa': 'moment.message:real', onclick: () => { tap(); MO.openThread('real'); } }, T(UI('message') || '메시지')));
      };
      renderBtn();
      wrap.appendChild(btnRow);
      wrap.appendChild(el('div.so2-noposts', null, T(P.empty || UI('noPosts'))));
      right.push(btnIcon(IC.more, '⋯', 'moment.menu', () => menuSheet([{ id: 'info', label: T((P.menu || [])[0] || '이 계정 정보') }]).then((v) => { if (v === 'info') accountInfo('real'); })));
    } else if (id === 'jimin_0412') {
      if (!s.script.j0200) {
        const b = P.blocked || ['jimin_0412', '사용자를 찾을 수 없습니다', '게시물 없음'];
        title = b[0];
        wrap.appendChild(el('div.so2-prof.so2-blocked', { 'data-qa': 'moment.profile:jimin_0412' }, C.avatar({ name: '?', bg: '#d0d0d4', initial: ' ' }, 78), el('b', null, b[0]), el('div.so2-muted', null, T(b[1]))));
        wrap.appendChild(el('div.so2-noposts', null, T(b[2])));
      } else {
        wrap.appendChild(profileHead('jimin_0412', { name: T(P.name || '지민'), bio: T(P.bio || '') }));
        wrap.appendChild(el('div.so2-pbtns', null, el('button.so2-btn.primary', { 'data-qa': 'moment.message:jimin_0412', onclick: () => { tap(); MO.openThread('jimin_0412'); } }, T(UI('message') || '메시지'))));
      }
    } else if (id === 'seah_y') {
      title = 'seah_y';
      wrap.appendChild(profileHead('seah_y', { name: T(P.name || '윤세아'), stats: T(P.stats || ''), bio: T(P.bio || '') }));
      wrap.querySelector('.so2-prof-handle') && (wrap.querySelector('.so2-prof-handle').textContent = T(P.handle || '@seah_y'));
      wrap.appendChild(el('div.so2-pbtns', null, el('button.so2-btn', { 'data-qa': 'moment.message:seah_y', onclick: () => { tap(); toast(STR('seahOnly')); } }, T(UI('message') || '메시지'))));
      const grid = el('div.so2-grid');
      (P.grid || []).forEach((p) => grid.appendChild(el('button.so2-cell', { 'data-qa': 'moment.post:' + p.id, 'aria-label': '게시물', onclick: () => { tap(); postFeed('seah_y', p.id); } }, C.imgBox(p.img, 'so2-cellimg', { pos: p.pos, zoom: p.zoom }))));
      wrap.appendChild(grid);
      right.push(btnIcon(IC.more, '⋯', 'moment.menu', () => menuSheet([{ id: 'tone', label: T(UI('chatTone') || '메시지 알림 소리  —'), sub: T(UI('chatToneGrey') || '대화가 없습니다'), disabled: true }])));
    } else if (id === 'sagongsa') {
      wrap.appendChild(profileHead('sagongsa', { name: 'sagongsa', stats: T(P.stats || '') }));
      wrap.appendChild(el('div.so2-noposts.so2-private', null, el('span', { html: IC.lock }), T(P.sub || '비공개 계정')));
    } else return null;
    const scr = C.screen({ title, right, body: wrap, cls: 'so2-mo so2-mo-prof' });
    pushScr(scr);
    if (G.bus) G.bus.emit('moment:profile', id);
    return scr;
  };
  function accountInfo(id) {
    const P = (D().profiles || {})[id] || {};
    const rows = (P.info || []).map(([k, v]) => el('div.so2-info-row', null, el('span', null, T(k)), el('b', null, T(v))));
    const body = el('div.so2-info', null, el('div.so2-info-head', null, avatarFor(id, 72), el('b', null, nameOf(id))), rows, P.infoFoot ? el('div.so2-info-foot', null, T(P.infoFoot)) : null);
    const scr = C.screen({ title: T(((P.menu || [])[0]) || '이 계정 정보'), body, cls: 'so2-mo' });
    scr.dataset.qa = 'moment.info:' + id;
    pushScr(scr);
    if (id === 'fake') setFlag('fakeKnown');
  }

  /* {N}'s own profile (tab or pushed) */
  function nProfileBody() {
    const D0 = D(); const posts = D0.posts || [];
    const wrap = el('div.so2-pwrap');
    wrap.appendChild(el('div.so2-prof', { 'data-qa': 'moment.profile:n' },
      el('div.so2-prof-top', null, avatarFor('n', 78), el('div.so2-prof-id', null, el('div.so2-prof-name', null, el('b', null, T('{N}'))),
        el('div.so2-prof-stats', null, T((UI('posts') || '게시물 {n}').replace('{n}', String((D0.me && D0.me.n && D0.me.n.postCount) || posts.length))))))));
    wrap.appendChild(el('div.so2-pbtns', null, el('button.so2-btn', { 'data-qa': 'moment.editProfile', onclick: () => { tap(); activitySheet(); } }, T(UI('editProfile') || '프로필 편집'))));
    const grid = el('div.so2-grid');
    posts.forEach((p) => grid.appendChild(el('button.so2-cell', { 'data-qa': 'moment.post:' + p.id, onclick: () => { tap(); postFeed('n', p.id); } }, C.imgBox(p.img, 'so2-cellimg'))));
    wrap.appendChild(grid);
    return wrap;
  }
  function nProfileScreen() {
    return C.screen({ title: T('{N}'), body: nProfileBody(), cls: 'so2-mo so2-mo-prof', right: [btnIcon(IC.menu, '☰', 'moment.settings', () => settingsScreen())] });
  }

  /* post feed — {N}'s 3 posts (restricted comment rows) or seah_y's grid */
  function postFeed(owner, postId) {
    const s = so();
    const list = el('div.so2-feed');
    const ownerName = owner === 'n' ? T('{N}') : 'seah_y';
    const posts = owner === 'n' ? (D().posts || []) : (((D().profiles || {}).seah_y || {}).grid || []);
    const dates = owner === 'n' ? {} : (((D().profiles || {}).seah_y || {}).dates || {});
    posts.forEach((p) => {
      const liked = !!s.liked[p.id];
      const heart = el('button.so2-act' + (liked ? '.liked' : ''), { 'aria-label': '♥', html: liked ? IC.heartF : IC.heart });
      const likes = el('div.so2-likes');
      const setL = () => { const on = !!so().liked[p.id]; heart.innerHTML = on ? IC.heartF : IC.heart; heart.classList.toggle('liked', on); likes.textContent = T((UI('likes') || '좋아요 {n}개').replace('{n}', String((p.likes || 0) + (on ? 1 : 0)))); };
      heart.addEventListener('click', () => { tap(); const L = so().liked; if (L[p.id]) delete L[p.id]; else L[p.id] = 1; save(); setL(); });
      setL();
      const cmtBtn = el('button.so2-act', { 'aria-label': '💬', html: IC.cmt, onclick: () => { tap(); if (owner === 'n' && !isDash()) activitySheet(); } });
      const node = el('article.so2-post', { 'data-qa': 'moment.post:' + p.id, dataset: { pid: p.id } },
        el('div.so2-post-h', null, avatarFor(owner === 'n' ? 'n' : 'seah_y', 30), el('b', null, ownerName)),
        C.imgBox(p.img, 'so2-postimg', { pos: p.pos, zoom: p.zoom }),
        el('div.so2-acts', null, heart, cmtBtn),
        likes,
        p.caption ? el('div.so2-cap', null, el('b', null, ownerName), ' ', T(p.caption)) : null);
      if (owner === 'n') node.appendChild(commentsLine(p));
      else if ((p.comments || []).length) node.appendChild(el('div.so2-cmts', null, p.comments.map((c) => el('div.so2-cmt', null,
        c.h === 'jimin_0412' || c.h === 'seah_y' ? el('button.so2-h', { onclick: () => { tap(); MO.profile(c.h); } }, c.h) : el('b', null, c.h), ' ', T(c.text)))));
      node.appendChild(el('div.so2-date', null, T(owner === 'n' ? p.date : dates[p.id] || '')));
      list.appendChild(node);
    });
    const scr = C.screen({ title: '게시물', sub: ownerName, body: list, cls: 'so2-mo so2-mo-feed' });
    pushScr(scr);
    if (postId) requestAnimationFrame(() => { const n = list.querySelector(`[data-pid="${postId}"]`); if (n && scr.body) scr.body.scrollTop = n.offsetTop - 4; });
  }
  function commentsLine(p) {
    const s = so();
    const k = (p.restricted || []).length;
    const box = el('div.so2-cline');
    if (isDash()) {   // the fake account cannot see restricted comments either
      box.appendChild(el('div.so2-cnum', null, T((UI('comments') || '댓글 {n}').replace('{n}', String(s.realUnres ? k : 0)))));
      return box;
    }
    if (!s.realUnres) {
      box.appendChild(el('div.so2-cnum', null, T((UI('comments') || '댓글 {n}').replace('{n}', '0'))));
      if (k) {
        seenHidden();
        box.appendChild(el('button.so2-rc', { 'data-qa': 'moment.comments.restricted:' + p.id, onclick: () => { tap(); commentsSheet(p, true); } }, T(UI('restrictedComments') || '제한된 계정의 댓글 보기')));
      }
    } else {
      box.appendChild(el(k ? 'button.so2-cnum.tap' : 'div.so2-cnum', { 'data-qa': k ? 'moment.comments:' + p.id : null, onclick: k ? () => { tap(); commentsSheet(p, false); } : null }, T((UI('comments') || '댓글 {n}').replace('{n}', String(k)))));
    }
    return box;
  }
  function commentsSheet(p, restricted) {
    const all = (D().restrictedComments || []).filter((c) => (p.restricted || []).includes(c.id));
    const list = el('div.so2-csheet-list');
    const body = el('div.so2-csheet', null, list);
    const head = restricted ? T((UI('restrictedCommentsHead') || '제한된 계정의 댓글 {k}개').replace('{k}', String(all.length))) : T((UI('comments') || '댓글 {n}').replace('{n}', String(all.length)));
    all.forEach((c) => list.appendChild(el('div.so2-crow', null, C.makerAvatar(32),
      el('div.so2-cmain', null, el('div', null, el('b', null, T('{MAKER_CONTACT}')), ' ', T(c.text)),
        el('small', null, T(c.when), restricted ? el('span.so2-rtag', null, T(UI('restrictedTag') || '제한됨')) : null)))));
    const p2 = bodySheet(head, body, 'moment.comments');
    if (restricted) {
      seenHidden();
      body.appendChild(el('button.so2-btn.primary.so2-unres', { 'data-qa': 'moment.unrestrict', onclick: () => { tap(); body._pick('unres'); } }, T(UI('unrestrict') || '제한 해제')));
    }
    p2.then((v) => {
      if (v !== 'unres') return;
      MO.unrestrict('real');
      // re-render the comment lines of the open feed
      document.querySelectorAll('.so2-mo-feed .so2-post').forEach((n) => {
        const post = (D().posts || []).find((x) => x.id === n.dataset.pid);
        const old = n.querySelector('.so2-cline'); if (post && old) old.replaceWith(commentsLine(post));
      });
    });
  }

  /* ☰ › 설정 (§4.1.1) */
  function settingsScreen() {
    const rowsWrap = el('div.so2-set');
    (D().settings || [['개인정보 보호 ›', 'privacy'], ['알림 ›', 'notif'], ['로그인 활동 ›', 'login']]).forEach(([label, key]) => {
      rowsWrap.appendChild(el('button.so2-set-row', { 'data-qa': 'moment.set:' + key, onclick: () => { tap(); if (key === 'privacy') privacyScreen(); else if (key === 'notif') notifScreen(); else loginScreen(); } },
        el('span', null, T(label.replace(/\s*›\s*$/, ''))), el('i.so2-chev', { html: IC.chev })));
    });
    pushScr(C.screen({ title: T(UI('settings') || '설정'), body: rowsWrap, cls: 'so2-mo so2-mo-set' }));
  }
  function privacyScreen() {
    const wrap = el('div.so2-set');
    const render = () => {
      const s = so();
      wrap.innerHTML = '';
      const nR = (s.realUnres ? 0 : 1) + (s.fake === 'restricted' ? 1 : 0);
      const nB = s.fake === 'blocked' ? 1 : 0;
      wrap.appendChild(el('button.so2-set-row', { 'data-qa': 'moment.set:restricted', onclick: () => { tap(); restrictedAccounts(render); } }, el('span', null, T((UI('restrictedAccountsN') || '제한된 계정  {n}').replace('{n}', String(nR)))), el('i.so2-chev', { html: IC.chev })));
      wrap.appendChild(el('div.so2-set-row.static', null, el('span', null, T((UI('blockedAccountsN') || '차단된 계정  {n}').replace('{n}', String(nB))))));
      wrap.appendChild(el('div.so2-set-row.static', null, el('span', null, T(UI('msgRequests') || '메시지 요청  모든 사람'))));
    };
    render();
    pushScr(C.screen({ title: T(UI('privacy') || '개인정보 보호'), body: wrap, cls: 'so2-mo so2-mo-set' }), { onResume: render });
  }
  function restrictedAccounts(onChange) {
    seenHidden();
    const wrap = el('div.so2-set');
    const render = () => {
      const s = so();
      wrap.innerHTML = '';
      wrap.appendChild(el('div.so2-set-desc', null, T((D().restrictedScreen || {}).desc || '')));
      const row = (who, line) => el('div.so2-racc', { 'data-qa': 'moment.racc:' + who },
        el('button.so2-racc-who', { onclick: () => { tap(); MO.profile(who); } }, avatarFor(who, 40), el('span', null, el('b', null, nameOf(who)), el('small', null, line))),
        el('button.so2-btn.sm', { 'data-qa': 'moment.unrestrict', onclick: () => { tap(); MO.unrestrict(who); render(); onChange && onChange(); } }, T(UI('unrestrict') || '제한 해제')));
      if (!s.realUnres) wrap.appendChild(row('real', T(((D().profiles || {}).real || {}).restrictedOn || '')));
      if (s.fake === 'restricted') wrap.appendChild(row('fake', T((UI('restrictedOnFmt') || '제한함 {d}').replace('{d}', s.fakeRestrictedOn || ''))));
    };
    render();
    pushScr(C.screen({ title: T(UI('restrictedAccounts') || '제한된 계정'), body: wrap, cls: 'so2-mo so2-mo-set' }), { onResume: render });
  }
  function notifScreen() {
    const wrap = el('div.so2-set', null, el('button.so2-set-row', { 'data-qa': 'moment.set:perChat', onclick: () => { tap(); hook('settings:screen', 'notif.perChat'); } }, el('span', null, T(UI('perChat') || '대화별 알림음  2')), el('i.so2-chev', { html: IC.chev })));
    pushScr(C.screen({ title: T(UI('notif') || '알림'), body: wrap, cls: 'so2-mo so2-mo-set' }));
  }
  function loginScreen() {
    pushScr(C.screen({ title: T(UI('loginAct') || '로그인 활동'), body: el('div.so2-set', null, el('div.so2-set-row.static', null, el('span', null, T(D().loginActivity || '')))), cls: 'so2-mo so2-mo-set' }));
  }
  function switchScreen() {
    const dv = D().dashView || {};
    const wrap = el('div.so2-set');
    (dv.switcher || []).forEach(([name, meta, who]) => {
      const left = who === 'add' ? el('span.so2-av.so2-av-add', null, '') : avatarFor(who === 'sagongsa' ? 'sagongsa' : 'fake', 40);
      wrap.appendChild(el('button.so2-set-row.acc' + (who === 'add' ? '.dim' : ''), { 'data-qa': 'moment.account:' + who, onclick: () => {
        if (who !== 'sagongsa') return;
        tap(); sheet({ title: '', text: T(dv.sagongsaSheet || ''), buttons: [{ label: T(UI('cancel') || '취소'), value: 'cancel' }], qa: 'moment.sagongsa' });
      } }, left, el('span.so2-acc-n', null, T(name)), meta ? el('small.so2-acc-m', null, T(meta)) : null));
    });
    pushScr(C.screen({ title: T(UI('switchAccount') || '계정 전환'), body: wrap, cls: 'so2-mo so2-mo-set' }));
  }

  /* search (shared by the 검색 tab and ✎ new message) */
  function searchMatch(q) {
    const nq = norm(q); if (!nq) return null;
    const out = [];
    (D().search || []).forEach((row) => {
      let hit = false;
      if (row.match === 'maker2') { const mk = norm(T('{MAKER_CONTACT}')); hit = mk.length < 2 ? nq === mk : (nq.length >= 2 && (mk.indexOf(nq) === 0 || nq.indexOf(mk) >= 0)); }
      else hit = [].concat(row.match).some((k) => { const nk = norm(k); return (nq.length >= 2 && nk.indexOf(nq) >= 0) || nq.indexOf(nk) >= 0; });
      if (hit) row.results.forEach((r) => out.push(r));
    });
    return out;
  }
  function resultRow(r, onPick) {
    const [name, sub, id] = r;
    if (id === 'real' && !so().realUnres) seenHidden();
    return el('button.so2-res', { 'data-qa': 'moment.result:' + id, onclick: () => { tap(); onPick(id); } }, avatarFor(id, 44), el('span.so2-res-main', null, el('b', null, T(name)), sub ? el('small', null, T(sub)) : null));
  }
  function searchPanel(mode) {   // mode 'tab' | 'new'
    const panel = el('div.so2-search');
    const out = el('div.so2-sres');
    const pick = (id) => {
      hideKb();
      if (mode === 'new') {
        if (id === 'seah_y') { toast(STR('seahOnly')); return; }
        if (isDash()) { if (id === 'n') return MO.openThread('fake'); newAcctSheet('{$newAcctSend}'); return; }
        if (id === 'sagongsa') return MO.profile(id);
        if (id === 'real' || id === 'fake' || id === 'jimin_0412') return MO.openThread(id);
      }
      if (id === 'n') return pushScr(dashNProfile());
      MO.profile(id);
    };
    const renderRecent = () => {
      out.innerHTML = '';
      const s = so();
      const list = ((D().recentSearch || {})[isDash() ? 'dash' : 'n'] || []).filter((r) => !s.recentGone.includes(r[2]));
      if (!list.length) return;
      out.appendChild(el('div.so2-recent-h', null, el('b', null, T(UI('recent') || '최근 검색')), el('button.so2-link', { 'data-qa': 'moment.recent.clear', onclick: () => { tap(); list.forEach((r) => s.recentGone.push(r[2])); save(); renderRecent(); } }, T(UI('clearAll') || '모두 지우기'))));
      list.forEach((r) => {
        const row = resultRow(r, pick);
        row.classList.add('recent');
        out.appendChild(el('div.so2-recent-row', null, row, el('button.so2-ib.so2-rx', { 'aria-label': '✕', 'data-qa': 'moment.recent.x:' + r[2], html: IC.x, onclick: () => { tap(); s.recentGone.push(r[2]); save(); renderRecent(); } })));
      });
    };
    const render = (q) => {
      const qq = String(q || '').trim();
      if (!qq) return renderRecent();
      out.innerHTML = '';
      const res = searchMatch(qq) || [];
      if (!res.length) out.appendChild(el('div.so2-none', null, STR('noResultMoment').replace('{q}', qq)));
      res.forEach((r) => out.appendChild(resultRow(r, pick)));
    };
    let field = null;
    if (G.ui && G.ui.field) {
      field = G.ui.field({ placeholder: T(UI('searchPh') || '검색'), mode: 'ko', ctx: 'momentSearch', predict: true, numRow: true, onChange: (v) => render(v), onSubmit: (v) => render(v), qa: 'moment.search' });
      field.node.classList.add('so2-sfield');
      field.node.dataset.qa = 'moment.search';
    }
    panel.append(el('div.so2-sbar', null, el('span.so2-sic', { html: IC.search }), field ? field.node : null), out);
    renderRecent();
    panel._field = field;
    return panel;
  }
  /* {N}'s profile as seen from the fake account (dash search) */
  function dashNProfile() {
    const D0 = D(); const posts = D0.posts || [];
    const wrap = el('div.so2-pwrap');
    wrap.appendChild(el('div.so2-prof', { 'data-qa': 'moment.profile:n' }, el('div.so2-prof-top', null, avatarFor('n', 78), el('div.so2-prof-id', null, el('div.so2-prof-name', null, el('b', null, T('{N}'))),
      el('div.so2-prof-stats', null, T((UI('posts') || '게시물 {n}').replace('{n}', String(posts.length))))))));
    wrap.appendChild(el('div.so2-pbtns', null, el('button.so2-btn', { 'data-qa': 'moment.message:n', onclick: () => { tap(); MO.openThread('fake'); } }, T(UI('message') || '메시지'))));
    const grid = el('div.so2-grid');
    posts.forEach((p) => grid.appendChild(el('button.so2-cell', { 'data-qa': 'moment.post:' + p.id, onclick: () => { tap(); postFeed('n', p.id); } }, C.imgBox(p.img, 'so2-cellimg'))));
    wrap.appendChild(grid);
    return C.screen({ title: T('{N}'), body: wrap, cls: 'so2-mo so2-mo-prof' });
  }
  function newMessageScreen() {
    const panel = searchPanel('new');
    const scr = C.screen({ title: T(UI('newMsg') || '새 메시지'), body: panel, cls: 'so2-mo so2-mo-new' });
    pushScr(scr, { onClose: () => { try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} } });
  }
  function requestsScreen() {
    const wrap = el('div.so2-req');
    const render = () => {
      wrap.innerHTML = '';
      wrap.appendChild(el('div.so2-none.big', null, T(D().requestsEmpty || UI('requestsEmpty'))));
      const n = isDash() ? 0 : restrictedCount();
      if (n >= 1) {
        seenHidden();
        wrap.appendChild(el('button.so2-rrow', { 'data-qa': 'moment.restricted', onclick: () => { tap(); restrictedMessages(); } },
          el('span', null, T((UI('restrictedRow') || '제한된 계정의 메시지 {n}').replace('{n}', String(n)))), el('i.so2-chev', { html: IC.chev })));
      }
    };
    render();
    const off = G.bus ? G.bus.on('chat:msg', () => wrap.isConnected && render()) : null;
    pushScr(C.screen({ title: T(UI('requests') || '요청'), body: wrap, cls: 'so2-mo so2-mo-req' }), { onResume: render, onClose: () => off && off() });
  }
  function restrictedMessages() {
    seenHidden();
    const s = so();
    const who = [];
    if (!s.realUnres && live('real').some((e) => e.from !== 'me')) who.push('real');
    if (s.fake === 'restricted' && live('fake').some((e) => e.from !== 'me')) who.push('fake');
    if (who.length <= 1) return openRestricted(who[0] || 'real');
    const wrap = el('div.so2-tlist');
    who.forEach((w) => wrap.appendChild(threadRow(w)));
    pushScr(C.screen({ title: T(UI('restrictedTitle') || '제한된 계정의 메시지'), body: wrap, cls: 'so2-mo' }));
  }

  /* message list rows */
  function previewOf(thread) {
    const m = lastMsg(thread); if (!m) return '';
    if (m.vm) return T(UI('voice') || '음성 메시지');
    if (m.img) return '';
    let t = m.text || '';
    if (m.from === 'me' && m.fail) t += ' · ' + STR('sendFail');
    return t;
  }
  function threadRow(thread) {
    const m = lastMsg(thread);
    const un = unread(thread);
    const typingNow = !!so().typ[thread] && queueBusy(thread);
    const prev = previewOf(thread);
    if (thread === 'fake' && /문 열어 줘\./.test(prev)) setFlag('fakeLineSeen');
    const P = (D().profiles || {})[thread] || {};
    // IG-style row: preview · time on one line, unread dot after it (nothing pinned to the right edge — the notebook tab lives there)
    return el('button.so2-trow' + (un ? '.unread' : ''), { 'data-qa': 'moment.thread:' + thread, onclick: () => { tap(); MO.openThread(thread); } },
      avatarFor(thread, 50),
      el('span.so2-tmain', null,
        el('span.so2-tname', null, el('b', null, nameOf(thread)), thread === 'fake' ? el('span.so2-badge', null, T(P.badge || UI('todayBadge'))) : null),
        el('span.so2-tprev', null, typingNow ? C.typingDots() : el('span.so2-tp', null, prev), m && !typingNow ? el('span.so2-twhen', null, ' · ' + C.whenLabel(m.t)) : null, un ? el('i.so2-dot') : null)));
  }
  function inboxThreads() {
    const s = so();
    const arr = ['jimin_0412'];
    if (s.fake === 'normal' || s.fake === 'blocked') arr.push('fake');
    if (s.realUnres && live('real').length) arr.push('real');
    const tOf = (t) => { const m = lastMsg(t); const d = m && C.parseT(m.t); return d ? +d : 0; };
    return arr.sort((a, b) => tOf(b) - tOf(a));
  }

  /* =========================================================
   * Root screen (tabs)
   * ========================================================= */
  let root = null;   // { scr, tab, render() }
  function rootRefresh() { if (root && root.scr.isConnected && (root.tab === 'messages' || root.tab === 'profile')) root.render(); }
  function openRoot(tab) {
    const head = el('header.so2-rhead');
    const bodyIn = el('div.so2-rbody');
    const body = el('div.sv-body.so2-rscroll', null, bodyIn);
    const bar = el('nav.so2-tabbar');
    const scr = el('section.so2-mo.so2-root', { dataset: { status: 'dark', theme: 'light', qa: 'moment.root' } }, head, el('div.so2-bands.root'), body, bar);
    scr.body = body; scr.head = head;
    const bandsEl = scr.querySelector('.so2-bands');
    const R = { scr, tab: tab || 'home' };
    function setHead(title, right) { head.innerHTML = ''; head.append(el('div.so2-rtitle', null, title), el('div.so2-rright', null, right || [])); }
    R.render = function () {
      bodyIn.innerHTML = '';
      bandsEl.innerHTML = '';
      const ob = offlineBand(); if (ob) bandsEl.appendChild(ob);
      const dash = isDash();
      if (R.tab === 'home') {
        setHead(el('span.so2-logo', null, T(UI('appName') || '모먼트')), [btnIcon(IC.dm, T(UI('tabs').messages || '메시지'), 'moment.dm', () => { R.tab = 'messages'; R.render(); })]);
        const fe = D().feedEmpty || [];
        bodyIn.appendChild(el('div.so2-feedempty', null, el('span.so2-check', null, '✓'), el('b', null, T(fe[0] || '')), el('small', null, T(fe[1] || ''))));
      } else if (R.tab === 'search') {
        setHead(el('span.so2-logo.sm', null, T(UI('tabs').search || '검색')));
        const panel = searchPanel('tab');
        bodyIn.appendChild(panel);
      } else if (R.tab === 'messages') {
        setHead(el('span', null, T(UI('messages') || '메시지')), [
          el('button.so2-hbtn', { 'data-qa': 'moment.requests', onclick: () => { tap(); requestsScreen(); } }, T(UI('requests') || '요청')),
          btnIcon(IC.pen, T(UI('newMsg') || '새 메시지'), 'moment.new', () => newMessageScreen())]);
        const listEl = el('div.so2-tlist');
        if (dash) {
          const dv = D().dashView || {};
          const m5 = live('fake').some((e) => e.id === 'f0016c');
          const row = el('button.so2-trow', { 'data-qa': 'moment.thread:dash', onclick: () => { tap(); dashChat(); } }, avatarFor('n', 50),
            el('span.so2-tmain', null, el('span.so2-tname', null, el('b', null, T(dv.listName || '{N}'))),
              el('span.so2-tprev', null, el('span.so2-tp', null, T(m5 ? dv.listRowM5 : dv.listRow)), el('span.so2-twhen', null, ' · ' + T(m5 ? dv.listWhenM5 : dv.listWhen)))));
          if (m5) setFlag('fakeLineSeen');
          listEl.appendChild(row);
        } else inboxThreads().forEach((t) => listEl.appendChild(threadRow(t)));
        bodyIn.appendChild(listEl);
      } else if (R.tab === 'profile') {
        if (dash) {
          const P = (D().profiles || {}).fake || {};
          setHead(el('span', null, nameOf('fake')), [btnIcon(IC.menu, '☰', 'moment.settings', () => switchScreen())]);
          const wrap = el('div.so2-pwrap');
          wrap.appendChild(profileHead('fake', { stats: T((D().dashView || {}).stats || P.stats || '') }));
          wrap.appendChild(el('div.so2-pbtns', null, el('button.so2-btn', { 'data-qa': 'moment.editProfile', onclick: () => { tap(); newAcctSheet((D().dashView || {}).limitSheet || '{$newAcctLimit}'); } }, T(UI('editProfile') || '프로필 편집'))));
          wrap.appendChild(el('div.so2-noposts', null, T(P.empty || UI('noPosts'))));
          bodyIn.appendChild(wrap);
        } else {
          setHead(el('span', null, T('{N}')), [btnIcon(IC.menu, '☰', 'moment.settings', () => settingsScreen())]);
          bodyIn.appendChild(nProfileBody());
        }
      }
      bar.innerHTML = '';
      [['home', IC.home], ['search', IC.search], ['plus', IC.plus], ['messages', IC.dm], ['profile', null]].forEach(([k, ic]) => {
        const lab = T((UI('tabs') || {})[k] || k);
        const b = el('button.so2-tab' + (R.tab === k ? '.on' : ''), { 'aria-label': lab, 'data-qa': k === 'plus' ? 'moment.tab:plus' : 'moment.tab:' + k },
          ic ? el('span', { html: ic }) : (dash ? avatarFor('fake', 26) : avatarFor('n', 26)),
          k === 'messages' && !dash && MO.unreadTotal() ? el('i.so2-tabdot') : null);
        b.addEventListener('click', () => {
          tap();
          if (k === 'plus') { if (dash) newAcctSheet((D().dashView || {}).limitSheet || '{$newAcctLimit}'); else activitySheet(); return; }
          if (R.tab === k) return;
          try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {}
          R.tab = k; R.render(); body.scrollTop = 0;
        });
        bar.appendChild(b);
      });
    };
    root = R;
    R.render();
    C.pushScreen(scr, { appId: 'moment', onResume: () => R.render(), onClose: () => { if (root === R) root = null; try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} } });
    return R;
  }

  function appOpen(p) {
    ensureInit();
    p = p || {};
    const tab = p.tab || (p.thread ? 'messages' : 'home');
    openRoot(tab);
    if (isDash()) setFlag('dashMoment');
    if (p.thread) MO.openThread(p.thread);
    else if (p.profile) MO.profile(p.profile);
  }
  MO.open = function (p) {
    if (G.phone && G.phone.openApp && G.apps && G.apps.moment) return G.phone.openApp('moment', p || {});
    return appOpen(p);
  };

  /* =========================================================
   * init
   * ========================================================= */
  let inited = false;
  function ensureInit() { if (!inited) MO.init(); }
  MO.init = function () {
    if (inited) return; inited = true;
    so();
    if (G.e2 && G.e2.sched && G.e2.sched.on) SCHED_IDS.forEach((id) => { try { G.e2.sched.on(id, (data, sid) => dispatch(data || {}, sid || id)); } catch (e) { console.error('[social] sched.on', e); } });
    if (G.bus && G.bus.on) {
      G.bus.on('flag:' + fl('M5'), onM5);
      G.bus.on('flag:' + fl('C2'), () => { if (flag('C1') && !so().done.P1) SCH.at((pmOf('C2') || pm()) + (((TH().c1 || {}).timing || {}).p1AfterC2 || 28000) - 1200, 'social:P1'); });
      G.bus.on('flag:' + fl('M7'), () => { if (flag('C1') && !flag('C2') && !so().done.P2) SCH.at((pmOf('M7') || pm()) + (((TH().c1 || {}).timing || {}).p2AfterM7 || 5000) - 1200, 'social:P2'); });
      G.bus.on('flag:' + fl('M6'), () => refreshView('real'));
      G.bus.on('flag:' + fl('M8'), () => refreshView('real'));
      G.bus.on('end:step', (e) => { if (e && e.step === 'k0110') clockTick(); });   // K (01:12) — see clockTick
      G.bus.on('clock:min', clockTick);
      G.bus.on('clock:jump', clockTick);
      G.bus.on('wifi:change', () => { flushQueue(); clockTick(); rootRefresh(); Object.keys(views).forEach((k) => refreshView(k)); });
      G.bus.on('notify:shown', (e) => { if (e && e.id === 'N08') setFlag('fakeLineSeen'); });
      G.bus.on('users:switched', () => { root = null; clockTick(); });   // K waits for {N} (see clockTick)
    }
    clockTick();
    // resume queued lines (local fallback scheduler only — G.e2.sched persists its own)
    if (!SCH.ok()) QTHREADS.forEach((t) => { if ((so().q[t] || []).length) scheduleHead(t); });
  };

  // safety net: if flow's boot never calls G.moment.init (partial build), initialise once the page has loaded
  if (typeof window.addEventListener === 'function') window.addEventListener('load', () => setTimeout(ensureInit, 0));

  if (G.app) {
    G.app('moment', {
      name: '모먼트',
      icon: G.ICONS && G.ICONS.moment,
      badge: (u) => ((u || user()) === 'n' ? MO.unreadTotal() : 0),
      open: appOpen,
    });
  }

  /* DEBUG helpers (window.haru created by core e2.js when G.DEBUG) */
  if (G.DEBUG && window.haru) {
    window.haru.moment = {
      state: () => JSON.parse(JSON.stringify(so())),
      thread: (id) => MO.messages(id).map((m) => `${m.from}: ${m.text || (m.vm ? '[vm]' : m.img ? '[img]' : '')}`),
      unrestrict: () => MO.unrestrict('real'),
      tick: clockTick,
    };
  }
})();
