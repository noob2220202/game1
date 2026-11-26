/* =========================================================
 * engine/series.js — 시리즈 기록 haru-escape.series.v1 (SERIES bible §7 · DESIGN_EP2 §9.3 · ARCH_EP2 §4.6)
 *
 * Standalone IIFE: no dependency on G.util / G.state helpers. Loaded by BOTH episodes:
 *   ep1 index.html (patch P-2, before js/scenes.js) and ep2/index.html (before engine/core/base.js).
 *
 * Public API (G.series):
 *   ensure() → rec                  create / migrate / backfill-safe; parse failure → '.bak' once; 8 KB cap; memory mode
 *   get('eps.1.st') → any           ep(n) → {st, on, min, hints, src, canon} (never null)
 *   s(key) → value (DEFAULTS fallback) · seen(id) → bool · sea() → string[]
 *   stage(key, value)               writes window.G.state.stage[key] (episode save only) + G.save()
 *   commit(n, payload?, opts?) → bool   payload {ep, s, seen, sea}; first completion only unless opts.overwrite;
 *                                   seen OR · sea ∪ · last = max · rev + 1 · immediate write
 *   patch(fn(rec)) → bool           read → fn on a copy → protected merge (done/canon/seen:true never go down, sea ∪) → write
 *   backfillEp1() → rec             bible §7.4 code (idempotent)
 *   endEp1() → bool                 P-2: ep1 END → eps.1 src 'live', canon true, s.e1_*, seen.e1_*
 *   clearAll() · readOnly() → bool · memory() → bool · DEFAULTS · SEEN_KEYS · KEY
 *   _fixture({rec, e1, blocked})    DEBUG QA profiles (§9.3 S1–S10) — switches to memory mode, never touches storage
 * Multi-tab: every write re-reads the stored record and field-merges (st max · canon OR · seen OR · sea ∪ · rev = max + 1);
 *   the 'storage' event only invalidates the read cache.
 * Privacy (bible §7.7): only bool / small int / fixed enums / dates are written. Never names, free text, UA, times.
 * ========================================================= */
(function () {
  'use strict';
  var W = window;
  var G = (W.G = W.G || {});
  if (G.series && G.series.__engine) return;   // idempotent (both pages may include it once)

  var KEY = 'haru-escape.series.v1', BAK = KEY + '.bak', E1KEY = 'haru-escape.save.v1';
  var V = 1, CAP = 8192, SEA_MAX = 16;

  /* SERIES_DEFAULTS — bible §7.2 S1 table + ep1 backfill keys (§7.4 / §7.5). Unregistered writes are ignored + warned. */
  var DEFAULTS = {
    e1_knock: 'none', e1_knocks: 0, e1_jimin: false, e1_momRead: false, e1_momTold: false,
    e1_manager: false, e1_slip: false, e1_ring: false, e1_trap: false, e1_vault: false, e1_js1: false,
    e1_acrostic: false, e1_alarmDel: false, e1_cafe: false, e1_bell: false, e1_live: 0, e1_lookAways: 0,
    e1_reloads: 0, e1_mfaFails: 0, e1_doorWrong: 0,
    e2_finger: 'deleted', e2_dash: 'locked', e2_fakeReply: false, e2_jimin: false, e2_phone: 'police',
    e3_played: true, e3_dnd: false, e4_gyul: false, e5_shed: 'waited', e6_fast: false, e7_first: 'road', e8_first: 'mom',
  };
  /* seen key registry (bible §7.2 'seen 키 등록표') */
  var SEEN_KEYS = [
    'e1_qr', 'e1_eps', 'e1_piyo', 'e1_memory', 'e1_sensorLog',
    'e2_cbs', 'e2_kbd', 'e2_note', 'e2_key404', 'e2_whistle', 'e2_hangyeol', 'e2_piyo', 'e2_hinge',
    'e3_block', 'e3_dndLog', 'e3_grey', 'e4_scar', 'e4_whistle', 'e4_locked', 'e5_height',
    'e6_settle', 'e6_wipe', 'e6_door05', 'e7_voice', 'e7_wall546', 'e8_kit1012', 'e9_vest', 'e10_home',
    'e11_fifth', 'e12_voucher', 'e13_night', 'e14_del0420', 'e17_redact', 'e18_key', 'e19_mom', 'e22_guest',
  ];
  var RANK = { none: 0, started: 1, done: 2 };

  /* ---------------- small helpers (local — no G.util here) ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function clamp(x, a, b) { x = Number(x); if (!isFinite(x)) x = 0; return Math.max(a, Math.min(b, x)); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function defEp(src) { return { st: 'none', on: null, min: null, hints: null, src: src || 'default', canon: false }; }
  var warned = {};
  function warn(k, msg) { if (warned[k]) return; warned[k] = 1; try { console.warn('[series] ' + msg); } catch (e) {} }

  /* ---------------- storage layer ---------------- */
  var memory = false;    // storage unusable → everything lives in `mem`
  var mem = null;        // in-memory record (memory mode / fixture)
  var memRaw = null;     // fixture: raw string to simulate a corrupt record
  var ro = false;        // future schema version → read only
  var cache = null;      // last good read (invalidated by 'storage')
  var fixtureE1;         // undefined = read real ep1 save; null/object = fixture

  function lsGet(k) {
    if (memory) return null;
    try { return W.localStorage.getItem(k); } catch (e) { memory = true; return null; }
  }
  function lsSet(k, v) {
    if (memory) return false;
    try { W.localStorage.setItem(k, v); return true; } catch (e) { memory = true; return false; }
  }

  function freshRec() { return { v: V, rev: 0, created: ymd(new Date()), last: 0, eps: {}, s: {}, seen: {}, sea: [] }; }

  function migrate(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    if (r.v == null) r.v = 1;                                  // pre-v1 draft → v1 + defaults
    if (typeof r.v !== 'number' || r.v > V) ro = true;          // a later episode wrote a newer schema
    if (typeof r.rev !== 'number') r.rev = 0;
    if (typeof r.created !== 'string') r.created = ymd(new Date());
    if (typeof r.last !== 'number') r.last = 0;
    if (!r.eps || typeof r.eps !== 'object') r.eps = {};
    Object.keys(r.eps).forEach(function (n) { var e = r.eps[n]; if (!e || typeof e !== 'object') { r.eps[n] = defEp(); return; } var d = defEp(); Object.keys(d).forEach(function (k) { if (!has(e, k)) e[k] = d[k]; }); });
    if (!r.s || typeof r.s !== 'object') r.s = {};
    if (!r.seen || typeof r.seen !== 'object') r.seen = {};
    if (!Array.isArray(r.sea)) r.sea = [];
    return r;
  }

  /** read → migrated record or null (no record). Parse failure → '.bak' once and null. */
  function read() {
    var raw;
    if (memory) {
      if (memRaw != null) { raw = memRaw; } else return mem ? migrate(clone(mem)) : null;
    } else raw = lsGet(KEY);
    if (raw == null) return null;
    var r = null;
    try { r = JSON.parse(raw); } catch (e) { r = undefined; }
    if (r === undefined || (r !== null && typeof r !== 'object')) {
      if (!memory && lsGet(BAK) == null) lsSet(BAK, raw);       // keep the broken original once
      warn('parse', 'record unreadable — kept a .bak copy and started a new record');
      memRaw = null;
      return null;
    }
    r = migrate(r);
    if (r) cache = clone(r);
    return r;
  }

  /** field merge of a stored record `a` with our record `b` (b wins for plain values). */
  function merge(a, b) {
    if (!a) return b;
    var out = clone(b);
    out.rev = Math.max(a.rev | 0, b.rev | 0);
    out.last = Math.max(a.last | 0, b.last | 0);
    if (a.created && (!out.created || a.created < out.created)) out.created = a.created;
    Object.keys(a.eps || {}).forEach(function (n) {
      var x = a.eps[n], y = out.eps[n];
      if (!y) { out.eps[n] = clone(x); return; }
      if (x.canon && !y.canon) { out.eps[n] = clone(x); return; }  // first completion stays locked
      if ((RANK[x.st] | 0) > (RANK[y.st] | 0)) y.st = x.st;
      if (x.canon) y.canon = true;
      if (!y.on && x.on) y.on = x.on;
    });
    Object.keys(a.s || {}).forEach(function (k) { if (!has(out.s, k)) out.s[k] = a.s[k]; });
    Object.keys(a.seen || {}).forEach(function (k) { if (a.seen[k] === true) out.seen[k] = true; });
    (a.sea || []).forEach(function (id) { if (out.sea.indexOf(id) < 0 && out.sea.length < SEA_MAX) out.sea.push(id); });
    return out;
  }

  /** write a record (merging the latest stored copy first). true = landed in the session's store. */
  function write(rec) {
    if (ro) { warn('ro', 'future record version — read-only, write skipped'); return false; }
    var stored = memory ? (mem ? clone(mem) : null) : null;
    if (!memory) { var raw = lsGet(KEY); if (raw != null) { try { stored = migrate(JSON.parse(raw)); } catch (e) { stored = null; } } }
    if (ro) return false;
    var out = merge(stored, rec);
    out.v = V;
    out.rev = (out.rev | 0) + 1;
    if (out.sea.length > SEA_MAX) out.sea = out.sea.slice(0, SEA_MAX);
    var json = JSON.stringify(out);
    if (json.length > CAP) { warn('cap', 'record would exceed 8 KB — write refused'); return false; }
    cache = clone(out);
    if (memory) { mem = out; return true; }
    if (lsSet(KEY, json)) return true;
    mem = out;                                                   // storage just failed → memory mode
    return true;
  }

  function current() { return read() || (cache ? clone(cache) : null); }

  /* ---------------- public ---------------- */
  var S = {};
  S.__engine = 1;
  S.KEY = KEY;
  S.DEFAULTS = DEFAULTS;
  S.SEEN_KEYS = SEEN_KEYS;

  S.ensure = function () {
    var r = read();
    if (r) return r;
    r = freshRec();
    write(r);
    return current() || r;
  };

  S.get = function (path) {
    var r = current(); if (!r || !path) return r ? clone(r) : undefined;
    var parts = String(path).split('.'), o = r;
    for (var i = 0; i < parts.length; i++) { if (o == null) return undefined; o = o[parts[i]]; }
    return o && typeof o === 'object' ? clone(o) : o;
  };

  S.ep = function (n) {
    var r = current(), e = r && r.eps && r.eps[String(n)];
    var d = defEp();
    if (e) Object.keys(e).forEach(function (k) { d[k] = e[k]; });
    return d;
  };

  S.s = function (key) {
    var r = current();
    if (r && r.s && has(r.s, key) && r.s[key] !== undefined) return r.s[key];
    return DEFAULTS[key];
  };
  S.seen = function (id) { var r = current(); return !!(r && r.seen && r.seen[id] === true); };
  S.sea = function () { var r = current(); return r && Array.isArray(r.sea) ? r.sea.slice() : []; };
  S.readOnly = function () { current(); return ro; };
  S.memory = function () { return memory; };

  /* ---------------- release table (DESIGN_EP2 §12 MT-A · SERIES §4.1 운영 규칙) ----------------
   * The ONE source of episode release instants (epoch ms, written as Date.UTC = KST − 9 h so no date / clock string
   * ships in deployed files — §10 K). Never rendered: no page shows a release date (SERIES §4.1).
   * isReleased(n): ep1 → always true · a listed episode → Date.now() ≥ its instant, or the page URL carries ?preview=1
   * (the maker's phone test before release — no debug UI) · anything unlisted → false.
   * Readers: series/series.js (picker windows) · ep2/js/gate.js (ep2 gate) · js/main.js (ep1 P-3 link). */
  var RELEASES = { 2: Date.UTC(2026, 11, 24, 12, 0) };
  S.releases = RELEASES;
  S.isReleased = function (n) {
    n = n | 0;
    if (n === 1) return true;
    if (!has(RELEASES, String(n))) return false;
    try { if (/[?&]preview=1\b/.test(W.location.search || '')) return true; } catch (e) {}
    var t = Number(RELEASES[n]);
    return isFinite(t) && Date.now() >= t;
  };

  S.stage = function (key, value) {
    var st = W.G && W.G.state;
    if (!st) return;
    st.stage = st.stage || {};
    st.stage[key] = value;
    try { if (W.G.save) W.G.save(); } catch (e) {}
  };

  function cleanS(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) {
      if (!has(DEFAULTS, k)) { warn('s:' + k, 'unregistered s key ignored: ' + k); return; }
      var v = obj[k], t = typeof DEFAULTS[k];
      if (v === undefined) return;
      if (t === 'boolean') v = !!v;
      else if (t === 'number') v = clamp(Math.round(v), 0, 600);
      else if (typeof v !== 'string') return;
      out[k] = v;
    });
    return out;
  }
  function orSeen(dst, src) {
    Object.keys(src || {}).forEach(function (k) {
      if (SEEN_KEYS.indexOf(k) < 0) { warn('seen:' + k, 'unregistered seen key ignored: ' + k); return; }
      if (src[k] === true) dst[k] = true;
    });
  }
  function addSea(rec, ids) {
    (ids || []).forEach(function (id) { if (typeof id === 'string' && /^sig_/.test(id) && rec.sea.indexOf(id) < 0 && rec.sea.length < SEA_MAX) rec.sea.push(id); });
  }

  /** payload from the episode save's stage (bible v1.1 form) when the caller passes none */
  function payloadFromStage(n) {
    var st = (W.G && W.G.state) || {}, stage = st.stage || {}, s = {};
    Object.keys(stage).forEach(function (k) { if (k.indexOf('e' + n + '_') === 0 && stage[k] != null) s[k] = stage[k]; });
    return { ep: { st: 'done', on: ymd(new Date()), min: clamp(Math.round((st.playMs || 0) / 60000), 0, 600), hints: clamp(st.hintsUsed | 0, 0, 99), src: 'play', canon: true }, s: s, seen: {} };
  }

  S.commit = function (n, payload, opts) {
    n = String(n | 0);
    opts = opts || {};
    payload = payload || payloadFromStage(n);
    var rec = S.ensure();
    if (ro) return false;
    rec = clone(rec);
    var cur = rec.eps[n] || defEp(), pe = payload.ep || {};
    var first = !(cur.st === 'done' && cur.canon);
    if (first) {
      rec.eps[n] = { st: 'done', on: cur.on || (typeof pe.on === 'string' ? pe.on : ymd(new Date())),
        min: pe.min == null ? null : clamp(Math.round(pe.min), 0, 600), hints: pe.hints == null ? null : clamp(pe.hints | 0, 0, 99),
        src: typeof pe.src === 'string' ? pe.src : 'play', canon: true };
      Object.assign(rec.s, cleanS(payload.s));
    } else if (opts.overwrite) {                                  // '이번 선택을 이야기로 남기기' only — `on` is kept
      if (pe.min != null) cur.min = clamp(Math.round(pe.min), 0, 600);
      if (pe.hints != null) cur.hints = clamp(pe.hints | 0, 0, 99);
      cur.st = 'done'; cur.canon = true;
      rec.eps[n] = cur;
      Object.assign(rec.s, cleanS(payload.s));
    }
    orSeen(rec.seen, payload.seen);
    addSea(rec, payload.sea);
    rec.last = Math.max(rec.last | 0, n | 0);
    if (!opts.overwrite && !first) {
      // replay without overwrite: s/min/hints stay; a plain merge must not resurrect our older values over the canon ones
      var stored = current();
      if (stored && stored.eps[n]) rec.eps[n] = stored.eps[n];
      if (stored) Object.keys(stored.s || {}).forEach(function (k) { rec.s[k] = stored.s[k]; });
    }
    return write(rec);
  };

  S.patch = function (fn) {
    var base = S.ensure();
    if (ro) return false;
    var orig = clone(base), next = clone(base);
    try { fn(next); } catch (e) { try { console.error('[series] patch', e); } catch (er) {} return false; }
    next = migrate(next) || orig;
    // monotone protection
    Object.keys(orig.eps).forEach(function (k) {
      var a = orig.eps[k], b = next.eps[k];
      if (!b) { next.eps[k] = a; return; }
      if ((RANK[b.st] | 0) < (RANK[a.st] | 0)) b.st = a.st;
      if (a.canon && !b.canon) b.canon = true;
    });
    Object.keys(orig.seen).forEach(function (k) { if (orig.seen[k] === true) next.seen[k] = true; });
    var seenOut = {}; Object.keys(next.seen).forEach(function (k) { if (SEEN_KEYS.indexOf(k) >= 0) { if (next.seen[k] === true) seenOut[k] = true; } else warn('seen:' + k, 'unregistered seen key ignored: ' + k); });
    next.seen = seenOut;
    var sOut = {}; Object.keys(next.s).forEach(function (k) { if (has(DEFAULTS, k)) sOut[k] = next.s[k]; else if (!has(orig.s, k)) warn('s:' + k, 'unregistered s key ignored: ' + k); else sOut[k] = next.s[k]; });
    next.s = sOut;
    var sea = orig.sea.slice(); next.sea.forEach(function (id) { if (typeof id === 'string' && sea.indexOf(id) < 0 && sea.length < SEA_MAX) sea.push(id); });
    next.sea = sea;
    next.last = Math.max(orig.last | 0, next.last | 0);
    next.rev = orig.rev;
    return write(next);
  };

  /* ---------------- ep1 backfill (bible §7.4 code, verbatim logic) ---------------- */
  function readEp1Save() {
    if (fixtureE1 !== undefined) return fixtureE1 ? clone(fixtureE1) : null;
    var s = null;
    try { s = JSON.parse(W.localStorage.getItem(E1KEY)); } catch (e) { s = null; }
    return s;
  }
  function orMerge(dst, src) { Object.keys(src).forEach(function (k) { if (src[k]) dst[k] = true; }); }

  function e1Fields(s, done) {
    var f = s.flags || {}, v = s.vars || {}, F = function (k) { return !!f[k]; };
    return {
      s: {
        e1_knock: F('knockSilenced') ? 'four' : F('knockedBack') ? 'answered' : 'none',
        e1_knocks: clamp(v.knockCount | 0, 0, 20), e1_jimin: F('jiminTold'),
        e1_momRead: F('momRead'), e1_momTold: F('momTold'),
        e1_manager: F('managerExposed'), e1_slip: F('managerSlip'), e1_ring: F('ringHeard'),
        e1_trap: F('trap0404'), e1_vault: F('vaultSeen'), e1_js1: !!v.js1Spent, e1_acrostic: F('acrostic'),
        e1_alarmDel: F('alarmDeleted'), e1_cafe: F('cafePhoto'), e1_bell: F('bellPressed'),
        e1_live: clamp(v.liveSeenCount | 0, 0, 9), e1_lookAways: clamp(v.lookAways | 0, 0, 99),
        e1_reloads: clamp(v.reloads | 0, 0, 99), e1_mfaFails: clamp(v.mfaFails | 0, 0, 9),
        e1_doorWrong: clamp(v.doorWrong | 0, 0, 99),
      },
      seen: { e1_qr: F('qrSeen') || F('qrScanned'), e1_eps: F('epsNotice'), e1_piyo: F('kongiDrawSeen'),
        e1_memory: F('memoryCompared'), e1_sensorLog: F('sensorLogSeen') },
      ep: { on: done && typeof f.END === 'number' ? ymd(f.END) : null,
        min: clamp(Math.round((s.playMs || 0) / 60000), 0, 600), hints: clamp(s.hintsUsed | 0, 0, 99) },
    };
  }

  function backfillInto(rec) {
    if (rec.eps['1'] && rec.eps['1'].canon) return rec;              // 첫 완료 정사는 잠금
    var s = readEp1Save();
    if (!s || s.v !== 1) { if (!rec.eps['1']) rec.eps['1'] = defEp('default'); return rec; }
    var f = s.flags || {}, F = function (k) { return !!f[k]; };
    var done = F('END'), played = done || F('M1') || F('introDone');
    if (!played) { if (!rec.eps['1']) rec.eps['1'] = defEp('default'); return rec; }
    var x = e1Fields(s, done);
    rec.eps['1'] = { st: done ? 'done' : 'started', on: x.ep.on, min: x.ep.min, hints: x.ep.hints, src: 'backfill', canon: done };
    Object.assign(rec.s, x.s);
    orMerge(rec.seen, x.seen);
    if (done) rec.last = Math.max(rec.last | 0, 1);
    return rec;
  }

  S.backfillEp1 = function () {
    var rec = S.ensure();
    if (ro) return rec;
    var before = JSON.stringify(rec);
    var next = backfillInto(clone(rec));
    if (JSON.stringify(next) !== before) write(next);
    return current() || next;
  };

  /** P-2: ep1 END. Reads the live ep1 state when called on the ep1 page (its save is debounced), else localStorage. */
  S.endEp1 = function () {
    try {
      var g = W.G, s = null;
      if (g && g.SAVE_KEY === E1KEY && g.state && g.state.flags) s = g.state;
      else s = readEp1Save();
      if (!s || !s.flags) return false;
      var rec = clone(S.ensure());
      if (ro) return false;
      var done = !!s.flags.END;
      if (!done) { var r0 = backfillInto(rec); return write(r0); }
      var x = e1Fields(s, true);
      if (!(rec.eps['1'] && rec.eps['1'].canon)) {
        rec.eps['1'] = { st: 'done', on: x.ep.on || ymd(new Date()), min: x.ep.min, hints: x.ep.hints, src: 'live', canon: true };
        Object.assign(rec.s, x.s);
      }
      orMerge(rec.seen, x.seen);
      rec.last = Math.max(rec.last | 0, 1);
      return write(rec);
    } catch (e) { try { console.error('[series] endEp1', e); } catch (er) {} return false; }
  };

  S.clearAll = function () {
    if (!memory) { try { W.localStorage.removeItem(KEY); W.localStorage.removeItem(BAK); } catch (e) {} }
    mem = null; memRaw = null; cache = null; ro = false;
  };

  /** DEBUG QA fixture (DESIGN §9.3 S1–S10): memory mode, real storage untouched.
   *  fx.rec: record object | null | 'corrupt' (string) · fx.e1: ep1 save object | null · fx.blocked: simulate no storage */
  S._fixture = function (fx) {
    fx = fx || {};
    memory = true; ro = false; cache = null; mem = null; memRaw = null;
    if (typeof fx.rec === 'string') memRaw = fx.rec;
    else if (fx.rec) mem = clone(fx.rec);
    fixtureE1 = fx.e1 === undefined ? null : fx.e1;
    return true;
  };

  G.series = S;

  if (W.addEventListener) W.addEventListener('storage', function (e) { if (e && e.key === KEY) { cache = null; ro = false; } });
})();
