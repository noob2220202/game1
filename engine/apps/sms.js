/* =========================================================
 * engine/apps/sms.js — 메시지 (comms · NEW in ep3 — never loaded by ep2). ep1 js/apps/sms.js port on the shared chat renderer
 * (G.chat.viewIn, engine/apps/talk.js) — no 'SIM 카드 없음' banner.
 * DESIGN_EP3 §3.4 · §3.12 (05:02) · §3.20.2 · §4.4 · §4.13 · §5.2 메시지 · §9.5-1 sms:kang · ARCH_EP3 §5.10 · §5.18 · §6.12.
 *
 * Public API  G.sms = { init(), open(threadId, {list}), isOpen(threadId) → bool, deliver(msgId, {silent}) → Promise<bool>,
 *                       renderThread(node, threadId, {big}) → {destroy()}, threads() → [{id, name, last, unread}],
 *                       kangCalled() (phone app — a call to 강수진 after kang341 → the one 1-min `kcall` SMS), unread() → int }
 * App id      sms (메시지 · dock) — open({thread}) · in easy mode the shell routes banners to G.easy.sms (no list there)
 * Hooks set   'chat:isOpen' (threadId) → bool — for 'sms:<id>' AND 'talk:<id>' threads (shell G.phone.notify reads it)
 * Hooks call  'callrec:open' ('block' · 'block.msgs')
 * Sched       comms:k341 (pm(M2) + 40 s) · comms:kr:<chip> (+40 s) · comms:kkeep (+60 s) · comms:kcall (+60 s) · comms:kfree (+40 s)
 * Bus emit    'chat:open' {thread:'sms:<id>'} · 'chat:msg' {thread, id}
 * Bus listen  flag:M2 · flag:kang341 · flag:nameKnown · flag:blockBottom · flag:saw702 · flag:kang502 · state:load
 * Flags set   kang341 · kang502 (on delivery of the first text) · kang341Sent · kangNameSent · kangBlockSent · kang702Sent · kangAskSent
 * Vars        kang {queue, sent, kept, replyAt, freeAt, frozen, started, delivered, kcall, pend, n} · cm.smsSeen
 * Saved       G.state.threads['sms:<id>'] = [{id, from:'them', live, i, d, hm} | {id, from:'me', chip, edited, bom, d, hm} |
 *             {id, from:'me', free:1, d, hm}] — ids only; edited / free text lives in the session store 'sms:<msgId>'
 * Notify      G.phone.notify({ id:'N01'…, app:'sms', title:'강수진 형사님', body:<raw text>, chat:'sms:kang',
 *             route:{ app:'sms', params:{ thread:'kang' } } }) — later texts of one delivery reuse the id (banner updates)
 * data-scr    sms.list · sms.<id> (sms.kang) · sms.settings · sms.search
 * data-qa     sms.thread:<id> · sms.menu · sms.menu.settings · sms.menu.blocked · sms.settings.block · sms.search ·
 *             chat.input · chat.send · chat.chip · chat.chip.dismiss · chat.msg:<id>
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.util || {};
  const S = (G.sms = G.sms || {});
  const el = U.el || ((G.chat && G.chat.el) || null);
  if (!el) { console.error('[comms] sms: G.util missing'); return; }
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------------- small helpers ---------------- */
  const SD = () => (G.STORY && G.STORY.sms) || { list: [], threads: {}, live: {}, chips: [] };
  const C = () => G.chat || {};
  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { console.error('[comms] sms text', e); s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const raw = (s) => { if (typeof s === 'function') { try { return String(s() || ''); } catch (e) { return ''; } } return s == null ? '' : String(s); };
  const STR = (k) => (G.e3 && G.e3.STR && G.e3.STR[k]) || (G.e2 && G.e2.STR && G.e2.STR[k]) || '';
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const pmNow = () => (G.state && G.state.playMs) || 0;
  const pmOf = (n) => (G.pm ? G.pm(n) : (G.state && G.state.vars && G.state.vars.pm && G.state.vars.pm[n]) || null);
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const tap = () => { try { G.audio && G.audio.sfx && G.audio.sfx.tap && G.audio.sfx.tap(); } catch (e) {} };
  const now = () => { try { return G.clock && G.clock.now ? G.clock.now() : new Date(2027, 0, 24, 3, 40); } catch (e) { return new Date(2027, 0, 24, 3, 40); } };
  const stamp = () => { const d = now(); return { d: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hm: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
  const sess = { get(k) { try { return G.e3 && G.e3.session ? G.e3.session.get(k) : null; } catch (e) { return null; } }, set(k, v) { try { if (G.e3 && G.e3.session) G.e3.session.set(k, v); } catch (e) {} } };
  const easyOn = () => { try { return !!(G.easy && G.easy.on && G.easy.on()); } catch (e) { return false; } };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const pd = (s) => { const m = String(s || '').match(/(\d+)-(\d+)-(\d+)/); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
  const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /** §0.1 #18 — today '오늘' · this year '1월 15일 (금)' · other years '2026년 12월 25일 (금)' */
  function dayLabel(d) {
    const ymd = ymdOf(d);
    try { if (G.e3 && G.e3.fmtDate) { const r = G.e3.fmtDate(ymd); if (r) return r; } } catch (e) {}
    const t = now();
    if (ymd === ymdOf(t)) return '오늘';
    return (d.getFullYear() === t.getFullYear() ? '' : d.getFullYear() + '년 ') + `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
  }
  /** list column: today → '오전 3:41' · this year → '1월 20일' · other years → '2026. 12. 29.' */
  function whenLabel(d, hm) {
    const dd = pd(d); if (!dd) return '';
    const t = now();
    if (d === ymdOf(t)) return (C().fmtK ? C().fmtK(d + ' ' + hm) : hm);
    if (dd.getFullYear() === t.getFullYear()) return `${dd.getMonth() + 1}월 ${dd.getDate()}일`;
    return `${dd.getFullYear()}. ${dd.getMonth() + 1}. ${dd.getDate()}.`;
  }
  const K = () => {
    const v = (G.state && G.state.vars) || {};
    let k = v.kang;
    if (!k || typeof k !== 'object') k = v.kang = {};
    ['sent', 'kept', 'replyAt', 'frozen', 'delivered'].forEach((x) => { if (!k[x] || typeof k[x] !== 'object') k[x] = {}; });
    if (!Array.isArray(k.queue)) k.queue = [];
    if (k.freeAt === undefined) k.freeAt = null;
    return k;
  };
  const CM = () => { const v = (G.state && G.state.vars) || {}; if (!v.cm || typeof v.cm !== 'object') v.cm = {}; return v.cm; };
  const TH = (id) => { const s = G.state || {}; if (!s.threads || typeof s.threads !== 'object') s.threads = {}; const k = 'sms:' + id; if (!Array.isArray(s.threads[k])) s.threads[k] = []; return s.threads[k]; };
  const chipOf = (key) => (SD().chips || []).find((c) => c.id === key) || null;
  const contact = (id) => { const d = G.STORY && G.STORY.dial; return (d && (d.contacts || []).find((c) => c.id === id)) || null; };
  const listRow = (id) => (SD().list || []).find((r) => r.id === id) || null;
  function threadName(id) { const r = listRow(id); if (r) return r.name; const c = contact(id); return c ? c.name : id; }

  /* ---------------- scheduler (G.e3.sched — persistent playMs; local fallback only for partial builds) ---------------- */
  const LOC = { h: [], q() { const c = CM(); if (!Array.isArray(c.lsched)) c.lsched = []; return c.lsched; } };
  const LOCAL = {
    at(at, id, data) { const q = LOC.q(), e = { at: Math.round(at), id }; if (data !== undefined) e.data = data; const i = q.findIndex((x) => x.id === id); if (i >= 0) q[i] = e; else q.push(e); save(); return id; },
    after(ms, id, data) { return LOCAL.at(pmNow() + ms, id, data); },
    cancel(id) { const c = CM(); c.lsched = LOC.q().filter((e) => (id.endsWith('*') ? e.id.indexOf(id.slice(0, -1)) !== 0 : e.id !== id)); save(); },
    has(id) { return LOC.q().some((e) => e.id === id); },
    on(key, fn) { LOC.h.push({ key, fn }); },
  };
  function locRun() {
    const q = LOC.q(); if (!q.length) return;
    const pm = pmNow();
    q.filter((e) => e.at <= pm).forEach((e) => {
      const i = LOC.q().indexOf(e); if (i < 0) return; LOC.q().splice(i, 1); save();
      const h = LOC.h.find((x) => e.id === x.key || (x.key.endsWith(':') && e.id.indexOf(x.key) === 0));
      if (h) { try { h.fn(e.data, e.id); } catch (err) { console.error('[comms] sched', e.id, err); } }
    });
  }
  const SC = () => (G.e3 && G.e3.sched && G.e3.sched.at ? G.e3.sched : LOCAL);

  /* ---------------- messages ---------------- */
  function liveText(L, i) { if (!L) return ''; const arr = Array.isArray(L.texts) ? L.texts : [L.text]; return raw(arr[i] != null ? arr[i] : arr[0]); }
  function chipText(c) {
    if (!c) return '';
    let t = raw(c.text);
    if (c.bomSuffix) { const fz = K().frozen[c.id]; const on = fz != null ? !!fz : flag('bomSeen'); if (on) t += c.bomSuffix; }
    return t;
  }
  /** one stored entry → a renderer message (null = nothing to draw: free text whose session copy is gone) */
  function resolve(id, x) {
    const t = x.d + ' ' + x.hm;
    if (x.live) return { id: x.id, t, from: 'them', text: liveText(SD().live[x.live], x.i || 0) };
    if (x.chip) {
      if (x.edited) { const s = sess.get('sms:' + x.id); if (s != null) return { id: x.id, t, from: 'me', text: s, raw: true }; }
      const c = chipOf(x.chip); let txt = c ? raw(c.text) : '';
      if (c && c.bomSuffix && x.bom) txt += c.bomSuffix;
      return { id: x.id, t, from: 'me', text: txt };
    }
    const s = sess.get('sms:' + x.id);
    return s != null ? { id: x.id, t, from: 'me', text: s, raw: true } : null;
  }
  function messages(id) {
    const base = ((SD().threads || {})[id] || []).map((m) => ({ id: m.id, t: m.d + ' ' + m.hm, from: m.from, text: m.text }));
    TH(id).forEach((x) => { const m = resolve(id, x); if (m) base.push(m); });
    return base;
  }
  const themCount = (id) => TH(id).filter((x) => x.from === 'them').length;
  S.unread = function () {
    const seen = CM().smsSeen || {};
    return Object.keys((G.state && G.state.threads) || {}).filter((k) => k.indexOf('sms:') === 0)
      .reduce((a, k) => a + Math.max(0, themCount(k.slice(4)) - (seen[k.slice(4)] || 0)), 0);
  };
  function markRead(id) {
    const c = CM(); c.smsSeen = c.smsSeen || {};
    const n = themCount(id);
    if ((c.smsSeen[id] || 0) !== n) { c.smsSeen[id] = n; save(); }
    try { if (G.phone && G.phone.markRead) G.phone.markRead((x) => x.chat === 'sms:' + id); } catch (e) {}
    try { if (G.phone && G.phone.refreshBadges) G.phone.refreshBadges(); } catch (e) {}
  }

  /* ---------------- 강수진 chip queue (ARCH_EP3 §5.10 — "생긴 순서대로 한 번에 하나") ---------------- */
  const done = (k, c) => !!(k.sent[c.id] || k.kept[c.id]);
  function queueStart() {
    const k = K();
    if (k.started || !flag('kang341')) return;
    k.started = true;
    k.queue = [];
    (SD().chips || []).forEach((c) => {
      if (done(k, c)) return;
      if (c.id === 'k341') { if (!(c.until && flag(c.until))) k.queue.push(c.id); return; }
      if (flag(c.when) && !(c.until && flag(c.until))) k.queue.push(c.id);
    });
    save(); refreshChips();
  }
  function queueOn(fl) {
    const k = K();
    if (!k.started) { if (fl === 'kang341') queueStart(); return; }
    let ch = false;
    (SD().chips || []).forEach((c) => {
      if (c.until === fl) { const i = k.queue.indexOf(c.id); if (i >= 0) { k.queue.splice(i, 1); ch = true; } }
      if (c.when === fl && c.id !== 'k341' && !done(k, c) && k.queue.indexOf(c.id) < 0) { k.queue.push(c.id); ch = true; }
    });
    if (ch) { save(); refreshChips(); }
  }
  function queueRepair() {   // resume: every chip whose fact is on and not yet handled sits in the queue (data order)
    const k = K();
    if (!flag('kang341')) return;
    if (!k.started) { queueStart(); return; }
    let ch = false;
    (SD().chips || []).forEach((c) => {
      const want = !done(k, c) && (c.id === 'k341' ? !(c.until && flag(c.until)) : flag(c.when) && !(c.until && flag(c.until)));
      const at = k.queue.indexOf(c.id);
      if (want && at < 0) { k.queue.push(c.id); ch = true; }
      if (!want && at >= 0) { k.queue.splice(at, 1); ch = true; }
    });
    if (ch) save();
  }
  const head = () => { const k = K(); return k.queue.length ? chipOf(k.queue[0]) : null; };

  /* ---------------- delivery (§4.13 notification spec · ARCH_EP3 §5.7) ---------------- */
  const views = new Set();   // open thread views { id, api, host }
  function viewsOf(id) { return Array.from(views).filter((v) => v.id === id && v.api.scr.isConnected); }
  function deliverStep(id, L, texts, i, silent) {
    const k = K();
    const st = stamp();
    const mid = id + (L.repeat ? '#' + (k.n = (k.n || 0) + 1) : '') + (texts.length > 1 ? '.' + i : '');
    const th = (L.thread || 'kang');
    TH(th).push({ id: mid, from: 'them', live: id, i, d: st.d, hm: st.hm });
    save();
    if (i === 0 && L.flag) setFlag(L.flag);
    const vs = viewsOf(th);
    vs.forEach((v) => v.api.add({ id: mid, t: st.d + ' ' + st.hm, from: 'them', text: liveText(L, i) }));
    if (!silent && G.phone && G.phone.notify) {
      try { G.phone.notify({ id: L.notif, app: 'sms', title: threadName(th), body: liveText(L, i), chat: 'sms:' + th, route: { app: 'sms', params: { thread: th } }, count: i + 1 }); }   // count = k-th text of this delivery (panel '새 메시지 {k}개')
      catch (e) { console.error('[comms] notify', e); }
    }
    if (S.isOpen(th)) markRead(th);
    else { try { G.phone && G.phone.refreshBadges && G.phone.refreshBadges(); } catch (e) {} }
    G.bus && G.bus.emit('chat:msg', { thread: 'sms:' + th, id: mid });
  }
  S.deliver = function (id, o) {
    o = o || {};
    const L = (SD().live || {})[id];
    if (!L) { console.warn('[comms] sms.deliver: unknown', id); return Promise.resolve(false); }
    const k = K();
    if (!L.repeat && k.delivered[id]) return Promise.resolve(false);
    k.delivered[id] = (k.delivered[id] || 0) + 1;
    const texts = Array.isArray(L.texts) ? L.texts : [L.text];
    const gaps = SD().gapMs || [2000, 4000];
    return new Promise((res) => {
      let i = 0;
      const step = () => {
        deliverStep(id, L, texts, i, !!o.silent);
        i++;
        if (i < texts.length) { k.pend = { id, i, silent: !!o.silent }; save(); setTimeout(step, o.silent ? 0 : gaps[0] + Math.random() * (gaps[1] - gaps[0])); }
        else { k.pend = null; save(); res(true); }
      };
      step();
    });
  };
  function resumePending() {
    const k = K(), p = k.pend;
    if (!p || !p.id) return;
    const L = (SD().live || {})[p.id]; if (!L) { k.pend = null; return; }
    const texts = Array.isArray(L.texts) ? L.texts : [L.text];
    for (let i = p.i; i < texts.length; i++) deliverStep(p.id, L, texts, i, true);
    k.pend = null; save();
  }
  /** a call to 강수진 (G.phoneApp.dial) — the 1-min SMS only after kang341 and only once (§3.2.3 · ARCH_EP3 §5.10) */
  S.kangCalled = function () {
    const k = K();
    if (!flag('kang341') || k.kcall) return false;
    k.kcall = 'sched'; save();
    SC().after(SD().callSmsMs || 60000, 'comms:kcall');
    return true;
  };

  /* ---------------- send (chips · free text) ---------------- */
  function sendIn(id, text, chipKey) {
    const st = stamp();
    const k = K();
    k.n = (k.n || 0) + 1;
    const mid = 'me' + k.n;
    let entry;
    const c = chipKey ? chipOf(chipKey) : null;
    if (id === 'kang' && c && k.queue[0] === c.id) {
      const edited = String(text).trim() !== T(chipText(c)).trim();
      entry = { id: mid, from: 'me', chip: c.id, edited, d: st.d, hm: st.hm };
      if (c.bomSuffix) entry.bom = K().frozen[c.id] ? 1 : 0;
      if (edited) sess.set('sms:' + mid, text);
      k.queue.shift();
      k.sent[c.id] = pmNow();
      if (c.flag) setFlag(c.flag);
      if (c.reply) { SC().after(SD().replyMs || 40000, 'comms:kr:' + c.id, { chip: c.id }); k.replyAt[c.id] = pmNow() + (SD().replyMs || 40000); }
    } else {
      entry = { id: mid, from: 'me', free: 1, d: st.d, hm: st.hm };
      sess.set('sms:' + mid, text);
      if (id === 'kang' && (k.freeAt == null || pmNow() - k.freeAt >= (SD().freeLimitMs || 600000))) {
        k.freeAt = pmNow();
        SC().after(SD().replyMs || 40000, 'comms:kfree', { live: 'kfree' });
      }
    }
    TH(id).push(entry);
    save();
    viewsOf(id).forEach((v) => v.api.add({ id: mid, t: st.d + ' ' + st.hm, from: 'me', text, raw: true }, { force: true }));
    refreshChips();
    G.bus && G.bus.emit('chat:msg', { thread: 'sms:' + id, id: mid });
  }
  function keep(key) {
    const k = K(), c = chipOf(key);
    const i = k.queue.indexOf(key); if (i < 0) return;
    k.queue.splice(i, 1);
    k.kept[key] = pmNow();
    if (c && c.keep) SC().after(SD().keepMs || 60000, 'comms:kkeep', { live: c.keep });
    save();
    viewsOf('kang').forEach((v) => { if (v.api.pending && v.api.pending() === key && v.comp && v.comp.field) { try { v.comp.field.clear(); } catch (e) {} } });
    refreshChips();
  }
  function chipsFor(v) {
    if (v.id !== 'kang') { v.api.setChips([]); return; }
    const c = head();
    if (!c) { v.api.setChips([]); return; }
    const k = K();
    if (c.bomSuffix && k.frozen[c.id] == null) { k.frozen[c.id] = flag('bomSeen') ? 1 : 0; save(); }   // frozen when first drawn (V30)
    v.api.setChips([{ key: c.id, text: T(chipText(c)), dismiss: true, dismissLabel: T(SD().chipKeep || '') }], (x) => v.api.pickChip && v.api.pickChip(x), (x) => keep(x.key));
  }
  function refreshChips() { Array.from(views).forEach((v) => { if (v.api.scr.isConnected) chipsFor(v); else views.delete(v); }); }

  /* ---------------- thread view (standard · easy E5 through renderThread) ---------------- */
  function buildView(id, o) {
    o = o || {};
    const readOnly = !!(listRow(id) && listRow(id).readOnly);
    const api = C().viewIn({ skin: 'sms', title: threadName(id), header: o.header, scr: o.header === false ? null : 'sms.' + id, qa: 'sms.room:' + id,
      dayLabel: (d) => dayLabel(d), big: !!o.big });
    const msgs = messages(id);
    api.setItems(msgs);
    if (!msgs.length) api.body.appendChild(el('div.cm3-empty', null, T(SD().emptyThread || '{$noChat}')));
    const v = { id, api, comp: null };
    if (!readOnly) v.comp = api.composer({ ctx: 'sms:' + id, placeholder: SD().inputPh || '', onSend: (text, chipKey) => { const e = api.body.querySelector('.cm3-empty'); if (e) e.remove(); sendIn(id, text, chipKey); } });
    views.add(v);
    chipsFor(v);
    return v;
  }
  S.renderThread = function (node, id, o) {
    o = o || {};
    if (!node || !C().viewIn) return { destroy() {} };
    const v = buildView(id, { header: false, big: o.big !== false });
    v.host = node;
    node.appendChild(v.api.scr);
    requestAnimationFrame(() => v.api.scrollEnd(false));
    setTimeout(() => { v.api.scrollEnd(false); if (S.isOpen(id)) markRead(id); }, 80);
    G.bus && G.bus.emit('chat:open', { thread: 'sms:' + id });
    return { api: v.api, destroy() { views.delete(v); v.api.close(); if (v.api.scr.parentNode) v.api.scr.remove(); } };
  };
  function pushThread(id) {
    const v = buildView(id, {});
    const scr = v.api.scr;
    const push = (G.phone && G.phone.push) ? G.phone.push.bind(G.phone) : (n) => { const h = document.getElementById('app-stack') || document.body; h.appendChild(n); };
    push(scr, { anim: 'slide', appId: 'sms', onClose: () => { views.delete(v); v.api.close(); }, onResume: () => { if (S.isOpen(id)) markRead(id); } });
    requestAnimationFrame(() => v.api.scrollEnd(false));
    setTimeout(() => { v.api.scrollEnd(false); if (S.isOpen(id)) markRead(id); }, 80);
    G.bus && G.bus.emit('chat:open', { thread: 'sms:' + id });
    return scr;
  }
  S.isOpen = function (id) {
    if (document.hidden) return false;
    let top = null; try { top = G.phone && G.phone.top && G.phone.top(); } catch (e) {}
    return viewsOf(id).some((v) => top && top.node && (top.node === v.api.scr || top.node.contains(v.api.scr)));
  };

  /* ---------------- list · ⋮ · settings · search ---------------- */
  function lastOf(id) {
    const m = messages(id); if (!m.length) return null;
    const x = m[m.length - 1]; const [d, hm] = String(x.t).split(' ');
    return { text: x.raw ? x.text : T(x.text), d, hm };
  }
  S.threads = function () {
    const rows = (SD().list || []).map((r) => {
      let last = lastOf(r.id);
      if (last && r.preview && !TH(r.id).length) last = Object.assign({}, last, { text: T(r.preview) });   // §4.4.1 list preview (the thread body carries its [header])
      return { id: r.id, name: r.name, last, unread: Math.max(0, themCount(r.id) - ((CM().smsSeen || {})[r.id] || 0)) };
    });
    Object.keys((G.state && G.state.threads) || {}).forEach((k) => {
      if (k.indexOf('sms:') !== 0) return; const id = k.slice(4);
      if (rows.some((r) => r.id === id) || !TH(id).length) return;
      rows.push({ id, name: threadName(id), last: lastOf(id), unread: 0 });
    });
    return rows.filter((r) => r.last).sort((a, b) => ((b.last.d + b.last.hm) > (a.last.d + a.last.hm) ? 1 : (b.last.d + b.last.hm) < (a.last.d + a.last.hm) ? -1 : 0));
  };
  const SVG = {
    more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="18.5" r="1.9" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const screen = (o) => (C().screen ? C().screen(o) : (G.ui && G.ui.screen ? G.ui.screen(o) : el('section')));
  const pushScr = (scr, opts) => { if (G.phone && G.phone.push) return G.phone.push(scr, opts || {}); const h = document.getElementById('app-stack') || document.body; h.appendChild(scr); return { node: scr }; };
  function rowNode(r) {
    const nm = T(r.name), ini = Array.from(nm.replace(/^\[/, ''))[0] || '';
    const av = C().avatar ? C().avatar({ name: nm, initial: ini, bg: '#9aa7b8' }, 46) : null;
    return el('button.cm3-srow' + (r.unread ? '.unread' : ''), { type: 'button', 'data-qa': 'sms.thread:' + r.id, onclick: () => { tap(); pushThread(r.id); } },
      av,
      el('span.cm3-smain', null, el('b', null, T(r.name)), el('span.cm3-sprev', null, r.last ? r.last.text : '')),
      el('span.cm3-sside', null, el('small', null, r.last ? whenLabel(r.last.d, r.last.hm) : ''), r.unread ? el('i.cm3-sbadge', null, String(r.unread)) : null));
  }
  function listScreen() {
    const listBox = el('div.cm3-slist');
    const render = () => { listBox.innerHTML = ''; S.threads().forEach((r) => listBox.appendChild(rowNode(r))); };
    const btn = (svg, label, qa, fn) => el('button.so2-ib', { type: 'button', 'aria-label': label, 'data-qa': qa, html: svg, onclick: (e) => { e.stopPropagation(); tap(); fn(); } });
    let scr = null;
    const right = [btn(SVG.search, '검색', 'sms.search', () => searchScreen()), btn(SVG.more, '메뉴', 'sms.menu', () => menu(scr))];
    scr = screen({ title: T(SD().title || '메시지'), back: true, body: listBox, right, cls: 'so2-tk cm3-sms' });
    scr.dataset.scr = 'sms.list';
    render();
    const offs = [];
    const re = () => { if (scr.isConnected) render(); };
    if (G.bus) { offs.push(G.bus.on('chat:msg', re)); }
    pushScr(scr, { appId: 'sms', onResume: re, onClose: () => offs.forEach((f) => f && f()) });
    return scr;
  }
  function menu(scr) {
    const m = SD().menu || [];
    const items = [
      { label: m[0], qa: 'sms.menu.settings', onClick: () => settingsScreen() },
      { label: m[1], qa: 'sms.menu.blocked', onClick: () => G.hooks && G.hooks.call('callrec:open', 'block.msgs') },
    ];
    if (G.mdu && G.mdu.menu) G.mdu.menu(scr, items);
    else items[0].onClick();
  }
  function settingsScreen() {
    const st = SD().settings || {};
    const rows = st.rows || [];
    const body = el('div.cm3-rows', null,
      el('div.cm3-row.plain', null, el('span', null, T(rows[0] || ''))),
      el('button.cm3-row', { type: 'button', 'data-qa': 'sms.settings.block', onclick: () => { tap(); G.hooks && G.hooks.call('callrec:open', 'block'); } }, el('span', null, T(rows[1] || '')), el('i.cm3-chev', { html: SVG.chev })),
      el('div.cm3-row.plain', null, el('span', null, T(rows[2] || ''))));
    const scr = screen({ title: T(st.title || ''), back: true, body, cls: 'so2-tk cm3-sms' });
    scr.dataset.scr = 'sms.settings';
    pushScr(scr, { anim: 'slide' });
  }
  function searchScreen() {
    const out = el('div.cm3-slist');
    const norm = (s) => { try { if (G.e3 && G.e3.norm) return G.e3.norm(s); } catch (e) {} return String(s || '').replace(/\s+/g, '').toLowerCase(); };
    function render(q) {
      out.innerHTML = '';
      const nq = norm(q || '');
      if (!nq) return;
      const hits = S.threads().filter((r) => messages(r.id).some((m) => norm(m.raw ? m.text : T(m.text)).indexOf(nq) >= 0) || norm(T(r.name)).indexOf(nq) >= 0);
      if (!hits.length) { out.appendChild(el('div.cm3-empty', null, T(STR('noResult') || "'{q}'에 대한 검색 결과가 없습니다.").replace('{q}', q))); return; }
      hits.forEach((r) => out.appendChild(rowNode(r)));
    }
    let field = null;
    if (G.ui && G.ui.field) field = G.ui.field({ placeholder: T(SD().searchPh || '검색'), mode: 'ko', ctx: 'smsSearch', predict: false, numRow: true, onChange: (v) => render(v), onSubmit: (v) => render(v), qa: 'sms.search.field' });
    const body = el('div.cm3-search', null, field ? el('div.cm3-sfield', null, field.node) : null, out);
    const scr = screen({ title: '', back: true, body, cls: 'so2-tk cm3-sms' });
    scr.dataset.scr = 'sms.search';
    pushScr(scr, { anim: 'slide', onClose: () => { try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} } });
    if (field) setTimeout(() => field.focus(), 60);
  }
  /** open a thread (contact `문자` · banner route). opts.list=false → the thread only (pushed over the current stack) */
  S.open = function (id, o) {
    o = o || {};
    if (!id) return listScreen();
    if (o.list) listScreen();
    return pushThread(id);
  };

  /* ---------------- app ---------------- */
  let opening = false;
  if (typeof G.app === 'function') {
    G.app('sms', {
      name: '메시지',
      icon: G.ICONS && G.ICONS.sms,
      badge: () => S.unread(),
      open(p) {
        p = p || {};
        if (easyOn() && G.easy && G.easy.sms && !opening) { opening = true; try { G.easy.sms(p.thread || 'kang'); } finally { opening = false; } return; }
        listScreen();
        if (p.thread) pushThread(p.thread);
      },
    });
  }

  /* ---------------- init ---------------- */
  let inited = false;
  S.init = function () {
    if (inited) return; inited = true;
    const sc = SC();
    sc.on('comms:k341', () => { if (!flag('kang341')) S.deliver('k0341'); });
    (SD().chips || []).forEach((c) => sc.on('comms:kr:' + c.id, () => { if (c.reply) S.deliver(c.reply); }));   // exact ids — no prefix matching needed
    sc.on('comms:kkeep', (data) => S.deliver((data && data.live) || 'k0341keep'));
    sc.on('comms:kcall', () => { K().kcall = 'done'; S.deliver('kcall'); });
    sc.on('comms:kfree', () => S.deliver('kfree'));
    if (sc === LOCAL && G.bus) G.bus.on('tick', locRun);
    const armK341 = () => { if (flag('M2') && !flag('kang341') && !sc.has('comms:k341') && !K().delivered.k0341) { const p = pmOf('M2'); sc.at((p != null ? p : pmNow()) + 40000, 'comms:k341'); } };
    if (G.bus) {
      G.bus.on('flag:M2', armK341);
      ['kang341', 'nameKnown', 'blockBottom', 'saw702', 'kang502'].forEach((f) => G.bus.on('flag:' + f, () => queueOn(f)));
      G.bus.on('flag:bomSeen', () => refreshChips());
      G.bus.on('state:load', () => { armK341(); queueRepair(); resumePending(); refreshChips(); });
    }
    armK341(); queueRepair(); resumePending();
  };
  // chat:isOpen for SMS and talk threads (ARCH_EP3 §5.18 — this file is the implementer)
  if (G.hooks && G.hooks.set) {
    G.hooks.set('chat:isOpen', (th) => {
      const s = String(th || '');
      let m = /^sms:(.+)$/.exec(s); if (m) return S.isOpen(m[1]);
      m = /^talk:(.+)$/.exec(s); if (m) return !!(G.talk && G.talk.isOpen && G.talk.isOpen(m[1]));
      return false;
    });
  }
})();
