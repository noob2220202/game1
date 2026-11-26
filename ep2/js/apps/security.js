/* =========================================================
 * security (ep2 new module ①) — owner: shell. DESIGN §3.3 · §3.4 · §3.5 · §3.9 · §3.10 (사용자 · 키보드) · §4.6.2–§4.6.5
 *   · §4.6.12 · §5.4 (S1–S5 · 셸 · 예측 공급) · §9.5-2 · §9.6 ①; ARCH §4.9 · §4.11 · §4.22 · §5.2–§5.4
 * API: G.security = { init(), verify({reason, pinOnly}) → Promise<bool>, fingerAuth (alias), trustState() → 'network'|'device'|null,
 *        autoUnlocked() · smartUnlocked() → bool, deleteFinger(id) → Promise<bool>, removeTrusted(id), open(screenKey),
 *        predict(user, token, ctx) → [{w, his, seed}], fingers() }
 *      registers hook 'kbd:predict' and settings keys: lock lock.smart lock.smart.item bio bio.finger bio.fingerDetail bio.fingerAdd
 *        users users.detail users.n kbd kbd.predict kbd.words wifi.saved.saemal_rooftop
 * Bus: security:finger {ok, where} · security:screen {key}. Listens kbd:shown (→ kbdHisSet/kbdHisSeen/factKbd · kbdSeedSeen/seenKbd).
 * Flags set: factSmart · trustDevSeen · smartRemoved · bioOpened · factFinger · fingerDeleted (+ stage e2_finger 'deleted' via G.e2.stage)
 *   · fingerIconTouched (verify icon) · kbdListOpened · factKbd · seenKbd · dashSeen · dashUsers.  Vars: smartGone · kbdHisSeen ·
 *   kbdHisSet · kbdSeedSeen · kbdPredictOff · sh.fp* (added/deleted print ids — no free text: renamed labels live in G.e2.session)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UTIL = G.util || {};
  const el = UTIL.el;
  const SEC = (G.security = G.security || {});

  const T = (s) => { if (typeof s === 'function') { try { s = s(); } catch (e) { s = ''; } } if (s == null) return ''; return G.T ? G.T(String(s)) : String(s); };
  const STR = (k) => T((G.e2 && G.e2.STR && G.e2.STR[k]) || '');
  const flag = (n) => !!(G.flag && G.flag(n));
  const setFlag = (n) => { if (G.flag && !G.flag(n)) G.flag(n, true); };
  const safe = (fn, d) => { try { return fn(); } catch (e) { console.error('[security]', e); return d; } };
  const sfx = (n) => { try { G.audio && G.audio.sfx && G.audio.sfx[n] && G.audio.sfx[n](); } catch (e) {} };
  const cue = (id, o) => { try { return G.audio && G.audio.cue ? G.audio.cue(id, o) : undefined; } catch (e) {} };
  const vib = (k) => { try { G.audio && G.audio.vibrate && G.audio.vibrate(k); } catch (e) {} };
  const vget = (k, d) => { const v = G.state && G.state.vars ? G.state.vars[k] : undefined; return v === undefined ? d : v; };
  const vset = (k, v) => { if (G.vars) G.vars(k, v); };
  const SH = () => { const v = (G.state && G.state.vars) || {}; if (!v.sh) v.sh = {}; return v.sh; };
  const save = () => { try { G.save && G.save(); } catch (e) {} };
  const D = () => (G.STORY && G.STORY.security) || {};
  const KB = () => (G.STORY && G.STORY.kbd) || {};
  const user = () => (G.users && G.users.current ? G.users.current() : 'n');
  const PH = () => G.phone || {};
  const sess = { get: (k) => (G.e2 && G.e2.session && G.e2.session.get ? safe(() => G.e2.session.get(k), null) : null),
    set: (k, v) => { if (G.e2 && G.e2.session && G.e2.session.set) safe(() => G.e2.session.set(k, v)); } };

  /* =========================================================
   * smart lock / trust (§3.3 · §5.4 S2 · §9.6 ① autoUnlocked)
   * ========================================================= */
  const gone = () => { const v = vget('smartGone', []); return Array.isArray(v) ? v : []; };
  SEC.trustState = function () {
    const g = gone();
    if (PH().wifi && PH().wifi.connected() && !g.includes('saemal_rooftop')) return 'network';
    const bt = G.media && G.media.bt;
    const btc = bt && bt.connected ? safe(() => bt.connected(), false) : flag('btConnected');
    if (btc && !g.includes('2층_스피커')) return 'device';
    return null;
  };
  SEC.autoUnlocked = () => !!SEC.trustState();
  SEC.smartUnlocked = SEC.autoUnlocked;
  SEC.removeTrusted = function (id) {
    const g = gone().slice();
    if (!g.includes(id)) { g.push(id); vset('smartGone', g); }
    setFlag('smartRemoved');
    G.bus && G.bus.emit('lock:refresh');
  };

  /* =========================================================
   * 본인 확인 시트 (§5.3 · §5.4 · §9.5-2) — finger always passes for {N}; PIN never does (the game never decides {N}'s PIN)
   * pinOnly ({N}'s last own print) → `현재 PIN을 입력하세요`, no finger icon, always fails. '—' user: PIN only ('0310').
   * ========================================================= */
  function fingerBtn(q, done) {
    if (G.lock && G.lock.fingerButton) return G.lock.fingerButton(q, done);
    if (G.ui && G.ui.holdButton) return G.ui.holdButton({ ms: 800, size: 64, ring: true, qa: q, onDone: done });
    const b = el('button.sh2-hold', { 'data-qa': q }); b.addEventListener('click', done); return b;
  }
  const vLock = { left() { const u = SH().vfUntil || 0; return Math.max(0, Math.ceil((u - Date.now()) / 1000)); }, start() { SH().vfUntil = Date.now() + 30000; save(); } };
  SEC.verify = function (o) {
    o = o || {};
    const dash = user() === 'dash';
    const pinOnly = !!o.pinOnly || dash;
    const V = D().verify || {};
    return new Promise((resolve) => {
      let fin = null, mode = pinOnly ? 'pin' : 'finger', timer = 0;
      const body = el('div.sh2-verify');
      const ok = (where) => { if (!fin) return; cue('fp.ok'); G.bus && G.bus.emit('security:finger', { ok: true, where: 'verify' }); if (where === 'finger') setFlag('fingerIconTouched'); fin(true); };
      const pinPad = () => {
        const padNode = G.ui.pinPad({ dots: true, maxLength: 16, submitLabel: V.ok || '확인', theme: 'light', qa: 'pin',
          async onSubmit(code) {
            if (vLock.left() > 0) return STR('pinLock').replace('{s}', String(vLock.left()));
            if (dash) { const want = (G.STORY.users && G.STORY.users.dash && G.STORY.users.dash.pin) || '0310'; if (String(code) === want) { setTimeout(() => ok('pin'), 80); return true; } }
            SH().vfFails = (SH().vfFails || 0) + 1; save();
            cue('pin.error'); vib('pin');
            if (SH().vfFails % 5 === 0) { vLock.start(); countdown(padNode); return STR('pinLock').replace('{s}', '30'); }
            return STR('pinWrong');
          } });
        if (vLock.left() > 0) setTimeout(() => countdown(padNode), 0);
        return padNode;
      };
      const countdown = (padNode) => {
        clearInterval(timer);
        const tick = () => { const s = vLock.left(); if (s <= 0) { clearInterval(timer); padNode.setBusy && padNode.setBusy(false); padNode.setMsg && padNode.setMsg(''); return; } padNode.setBusy && padNode.setBusy(true); padNode.setMsg && padNode.setMsg(STR('pinLock').replace('{s}', String(s))); };
        setTimeout(tick, 600); timer = setInterval(tick, 1000);
      };
      const btn = (label, q, fn) => { const b = el('button.vf-btn', { 'data-qa': q }, T(label)); b.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); fn(); }); return b; };
      const draw = () => {
        body.innerHTML = '';
        if (mode === 'finger') {
          body.append(el('div.vf-text', null, STR('verify')),
            el('div.vf-finger', null, fingerBtn('verify.finger', () => ok('finger'))),
            el('div.vf-btns', null, btn(V.usePin || 'PIN 사용', 'verify.pin', () => { mode = 'pin'; draw(); }), btn(V.cancel || '취소', 'verify.cancel', () => fin && fin(false))));
        } else {
          body.append(el('div.vf-text', null, pinOnly ? STR('pinCurrent') : STR('verify')), el('div.vf-pad', null, pinPad()),
            el('div.vf-btns', null, btn(V.cancel || '취소', 'verify.cancel', () => fin && fin(false))));
        }
      };
      draw();
      PH().sheet({ title: STR('verifyTitle'), body, kind: 'verify', qa: 'verify', cls: 'sh2-sheet-verify',
        mount: (f) => { fin = f; }, onClose: (v) => { clearInterval(timer); resolve(v === true); } });
    });
  };
  SEC.fingerAuth = SEC.verify;

  /* =========================================================
   * fingerprints (§3.4 · §4.6.3 · §5.4 S3) — last own print undeletable
   * ========================================================= */
  SEC.fingers = function () {
    const sh = SH(); const del = sh.fpDeleted || []; const add = sh.fpAdded || [];
    const out = [];
    (D().fingers || []).forEach((f, i) => { if (!del.includes(f.id)) out.push(Object.assign({}, f, { k: i + 1, own: f.id !== 'f2' })); });
    add.forEach((a) => { if (!del.includes(a.id)) out.push({ id: a.id, name: '{N}', k: a.k, own: true, mine: true }); });
    return out;
  };
  const FT = () => D().fingerText || {};
  function fpLabel(f) {
    const ren = sess.get('fpRename:' + f.id);
    if (f.label && !ren) return T(f.label);
    const lab = FT().label || ((k, n) => `지문 ${k} · ${n}`);
    return lab(f.k, ren || T(f.name));
  }
  const ownCount = () => SEC.fingers().filter((f) => f.own).length;
  SEC.deleteFinger = async function (id) {
    const f = SEC.fingers().find((x) => x.id === id);
    if (!f) return false;
    const v = await PH().dialog({ text: STR('fpDeleteQ'), buttons: [{ label: '취소', value: 'cancel' }, { label: T(FT().del || '삭제'), value: 'delete', style: 'danger' }] });
    if (v !== 'delete') return false;
    if (f.own && ownCount() <= 1) { await SEC.verify({ reason: 'fpDeleteLast', pinOnly: true }); return false; }   // never succeeds (§3.4)
    const ok = await SEC.verify({ reason: 'fpDelete' });
    if (!ok) return false;
    const sh = SH(); sh.fpDeleted = (sh.fpDeleted || []).concat(id); save();
    if (id === 'f2') {
      setFlag('fingerDeleted');
      if (G.e2 && G.e2.stage) safe(() => G.e2.stage('e2_finger', 'deleted'));
    }
    return true;
  };

  /* =========================================================
   * keyboard learning — the 'kbd:predict' provider (§5.4 · §9.6 ① · ARCH §4.11 · §5.4)
   * ========================================================= */
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const SPLIT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
    'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
  const sp = (j) => SPLIT[j] || j;
  function jamo(s) {
    let out = '';
    for (const ch of String(s || '').replace(/\s+/g, '')) {
      const c = ch.charCodeAt(0) - 0xac00;
      if (c >= 0 && c <= 11171) out += CHO[Math.floor(c / 588)] + sp(JUNG[Math.floor((c % 588) / 28)]) + sp(JONG[c % 28]);
      else out += sp(ch.toLowerCase());
    }
    return out;
  }
  function chosung(s) {
    let out = '';
    for (const ch of String(s || '').replace(/\s+/g, '')) {
      const c = ch.charCodeAt(0) - 0xac00;
      if (c >= 0 && c <= 11171) out += CHO[Math.floor(c / 588)];
      else if (/[ㄱ-ㅎ]/.test(ch)) out += ch;
      else out += ch.toLowerCase();
    }
    return out;
  }
  SEC._jamo = jamo; SEC._chosung = chosung;
  const NOPREDICT = /^(nbMemo|wifiPw|daonPw|smsCode)$/;
  /** kbd:predict(user, token, ctx) → ≤ 3 [{w, his, seed}] — his words first in table order, then system words */
  SEC.predict = function (u, token, ctx) {
    const K = KB();
    const tok = String(token || '').replace(/\s+/g, '');
    if (!tok || NOPREDICT.test(ctx || '')) return [];
    const who = u === 'dash' ? 'dash' : 'n';
    const Dk = K[who] || {};
    const never = new Set((Dk.never || (K.n && K.n.never)) || []);
    const HIS = new Set((K.n && K.n.his) || []);
    const SEED = new Set((K.n && K.n.seed) || []);
    let words = [];
    if (Dk.prefix && Dk.prefix[tok]) words = Dk.prefix[tok].slice();
    else {
      const pool = [];
      (Dk.words || []).forEach((x, i) => pool.push({ w: x.w, r: x.rank != null ? x.rank : i }));
      if (who === 'n') pool.push({ w: '문', r: 50 });                       // '문' is his (§3.5 표 '그') but not a list word
      (K.system || []).forEach((w, i) => pool.push({ w, r: 100 + i }));
      const cons = /^[ㄱ-ㅎ]+$/.test(tok), digits = /^\d+$/.test(tok);
      const jt = jamo(tok);
      const hit = pool.filter((p) => {
        if (cons) return chosung(p.w).indexOf(tok) === 0;
        if (digits) return p.w.replace(/\s+/g, '').indexOf(tok) === 0;
        return jamo(p.w).indexOf(jt) === 0;
      }).sort((a, b) => a.r - b.r);
      const seen = new Set();
      hit.forEach((p) => { if (!seen.has(p.w)) { seen.add(p.w); words.push(p.w); } });
    }
    words = words.filter((w) => !never.has(w));
    if (ctx === 'momentSearch') {                                           // never spell {MAKER_CONTACT} in the moment search (§3.13 ④)
      const mk = (G.e2 && G.e2.maker ? safe(() => G.e2.maker(), '') : T('{MAKER_CONTACT}')).replace(/\s+/g, '');
      if (mk) words = words.filter((w) => { const ww = w.replace(/\s+/g, ''); return !(mk.indexOf(ww) >= 0 || ww.indexOf(mk) >= 0); });
    }
    return words.slice(0, 3).map((w) => ({ w, his: who === 'n' && HIS.has(w), seed: who === 'n' && SEED.has(w) }));
  };
  /** kbd:shown — a word drawn ≥ 250 ms (core). Count {N}'s side only (§9.5-1). */
  function onShown(e) {
    if (!e || e.user !== 'n' || !Array.isArray(e.words)) return;
    const K = KB(); const HIS = new Set((K.n && K.n.his) || []); const SEED = new Set((K.n && K.n.seed) || []);
    const set = new Set(vget('kbdHisSet', []) || []); const seeds = new Set(vget('kbdSeedSeen', []) || []);
    let ch = false, chs = false;
    e.words.forEach((x) => { const w = x && (x.w || x); if (HIS.has(w) && !set.has(w)) { set.add(w); ch = true; } if (SEED.has(w) && !seeds.has(w)) { seeds.add(w); chs = true; } });
    if (ch) { vset('kbdHisSet', Array.from(set)); vset('kbdHisSeen', set.size); if (set.size >= 3) setFlag('factKbd'); }
    if (chs) seedSeen(seeds);
  }
  function seedSeen(seeds) { vset('kbdSeedSeen', Array.from(seeds)); if (seeds.size >= 2) setFlag('seenKbd'); }

  /* =========================================================
   * settings screens (ARCH §4.22) — registered into engine/apps/settings.js
   * ========================================================= */
  const APP = () => G.settingsApp || {};
  const U = () => APP().ui || {};
  const row = (o) => U().row(o), group = (t, r, f) => U().group(t, r, f), hero = (a, b, c) => U().hero(a, b, c);
  const toggle = (on, fn, o) => U().toggle(on, fn, o), btnRow = (l, fn, o) => U().btnRow(l, fn, o);
  const isDash = () => user() === 'dash';
  /* 등록된 지문 확인 glow (§3.4 — the moment the player sees 지문 2 never light): long enough to compare the two rows */
  const GLOW_MS = 3000;
  function unGlow(api) {
    clearTimeout(api._glowT); api._glowT = 0; api._glow = null; api._glowUntil = 0;
    const s = api.scr; if (s) s.querySelectorAll('.sh2-row.fp.glow').forEach((n) => n.classList.remove('glow'));
  }
  /** a row whose value is a date/time — keep '오후 2:31' on one line (§10 H 360 px · 130 %) */
  function oneLine(r) { const m = r && r.querySelector('.sh2-meta'); if (m) { m.style.whiteSpace = 'nowrap'; m.style.maxWidth = 'none'; } return r; }
  function reg(key, def) { if (G.settingsApp && G.settingsApp.register) G.settingsApp.register(key, def); }
  SEC.open = function (key, params) { G.bus && G.bus.emit('security:screen', { key }); return G.settingsApp && G.settingsApp.open ? G.settingsApp.open(key, params) : false; };

  function registerScreens() {
    /* ---------- S1 잠금 화면 (verify on entry — §5.4 S1 · §4.6.4) ---------- */
    reg('lock', {
      title: () => (D().lockScreen || {}).title,
      verify: true,
      render(api) {
        const L = D().lockScreen || {};
        const dash = isDash();
        api.on('var', (e) => { if (e && e.k === 'smartGone') api.refresh(); });
        const k = dash ? 0 : 2 - gone().length;
        const rows = [row({ title: L.type, meta: dash ? L.typeDash : L.typeN, onClick: dash ? null : () => { SEC.verify({ reason: 'lockType', pinOnly: true }); }, chev: false })];
        if (!dash) {
          rows.push(row({ key: 'lock.smart', params: { verified: true }, title: L.smart, sub: L.smartSub ? L.smartSub(k) : '' }));
          rows.push(row({ title: L.widget, sub: L.widgetText, onClick: () => G.lock && G.lock.widgetPreview && G.lock.widgetPreview(), qa: 'settings.row:lock.widget' }));
        }
        rows.push(row({ title: L.notif, meta: L.notifMeta }));
        return el('div', null, group(null, rows));
      },
    });
    /* ---------- S2 스마트 잠금 (§3.3 원문) ---------- */
    reg('lock.smart', {
      title: () => (D().smartText || {}).title,
      verify: true,                                   // reached directly (search / deep link) → verify; from `lock` → params.verified
      onOpen() { if (!isDash()) setFlag('factSmart'); },
      render(api) {
        const X = D().smartText || {}; const sm = D().smart || {};
        const dash = isDash();
        api.on('var', (e) => { if (e && e.k === 'smartGone') api.refresh(); });
        const g = gone();
        const devs = dash ? [] : (sm.devices || []).filter((d) => !g.includes(d.id));
        const nets = dash ? [] : (sm.networks || []).filter((d) => !g.includes(d.id));
        const item = (d) => row({ title: d.id, sub: d.line, qa: 'smart.item:' + d.id, key: 'lock.smart.item', params: { id: d.id, verified: true }, cls: 'indent' });
        const onBody = toggle(!!SH().onBody, (v) => { SH().onBody = v; save(); }, { label: X.onBody });
        const wrap = el('div', null, group(null, [
          row({ title: X.places, meta: X.none }),
          row({ title: X.devices, meta: String(devs.length) }), ...devs.map(item),
          row({ title: X.networks, meta: String(nets.length) }), ...nets.map(item),
          row({ title: X.onBody, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(SH().onBody ? X.on : X.off)), onBody) }),
        ]));
        if (devs.some((d) => d.id === '2층_스피커')) setFlag('trustDevSeen');
        return wrap;
      },
    });
    reg('lock.smart.item', {
      title: (api) => api.params.id || '',
      verify: (p) => !p.verified,
      render(api) {
        const X = D().smartText || {}; const sm = D().smart || {};
        const id = api.params.id;
        const net = (sm.networks || []).find((d) => d.id === id); const dev = (sm.devices || []).find((d) => d.id === id);
        const it = net || dev || { detail: [] };
        const det = it.detail || [];
        const wrap = el('div', null,
          el('div.sh2-trust', null, el('b', null, id), el('div.sh2-trust-k', null, T(det[0] || '')), el('p', null, T(det[1] || ''), el('br'), T(det[2] || ''))),
          group(null, [row({ title: X.at, meta: it.at || '' }), row({ title: X.who, meta: it.who || '' })]),
          el('div.sh2-actions', null, btnRow(X.del || '삭제', async () => {
            const v = await PH().dialog({ text: STR(net ? 'trustNetDelQ' : 'trustDevDelQ'), buttons: [{ label: '취소', value: 'cancel' }, { label: T(X.del || '삭제'), value: 'delete', style: 'danger' }] });
            if (v !== 'delete') return;
            SEC.removeTrusted(id);
            api.back();
          }, { qa: 'smart.delete', danger: true })));
        return wrap;
      },
    });
    /* ---------- 보안 및 개인정보 (§4.6.3 — never verifies) ---------- */
    reg('bio', {
      title: () => (G.STORY.settings && G.STORY.settings.securityTitle) || '보안 및 개인정보',
      render(api) {
        const ST = G.STORY.settings || {};
        const rowsD = ST.security || [];
        const dash = isDash();
        api.on('flag', (n) => { if (n === 'fingerDeleted') api.refresh(); });
        const cnt = ST.fingerCount ? ST.fingerCount(SEC.fingers().length) : '';
        const out = [];
        rowsD.forEach(([t, m], i) => {
          if (i === 0) out.push(row({ key: 'bio.finger', title: t, meta: dash ? '' : cnt }));
          else if (i === 1) out.push(row({ title: t, meta: dash ? (ST.dash || {}).lockType : m, onClick: dash ? null : () => SEC.verify({ reason: 'lockType', pinOnly: true }), chev: false }));
          else if (i === 2) out.push(row({ title: t, meta: m, onClick: () => PH().toast(STR('needDaon')), chev: false, qa: 'settings.row:bio.findMy' }));
          else out.push(row({ title: t, meta: m }));
        });
        return el('div', null, group(null, out));
      },
    });
    /* ---------- S3 지문 (verify → bioOpened) ---------- */
    reg('bio.finger', {
      title: () => FT().title || '지문',
      verify: (p) => !p.verified,
      onOpen() { if (!isDash()) setFlag('bioOpened'); },
      render(api) {
        const X = FT();
        if (isDash()) return el('div.sh2-empty', null, T((G.STORY.settings && G.STORY.settings.dash && G.STORY.settings.dash.bio) || X.none));
        const list = SEC.fingers();
        const lit = (id) => api._glow === id && Date.now() < (api._glowUntil || 0);
        const rows = list.map((f) => row({ title: fpLabel(f), qa: 'bio.finger:' + f.id, key: 'bio.fingerDetail', params: { id: f.id, verified: true }, cls: 'fp' + (lit(f.id) ? ' glow' : '') }));
        const check = el('div.sh2-fpcheck' + (api._check ? '.open' : ''));
        if (api._check) {
          check.append(el('div.fc-text', null, STR('fpTouch')),
            el('div.fc-btn', null, (G.lock && G.lock.fingerButton ? G.lock.fingerButton('bio.check', () => {
              const own = SEC.fingers().find((f) => f.id === 'f1') || SEC.fingers().find((f) => f.own);
              api._glow = own ? own.id : null; api._glowUntil = Date.now() + GLOW_MS; api._check = false;
              cue('fp.ok'); setFlag('factFinger');
              G.bus && G.bus.emit('security:finger', { ok: true, where: 'check' });
              api.refresh();
              clearTimeout(api._glowT);
              api._glowT = setTimeout(() => unGlow(api), GLOW_MS);
            }) : el('span'))));
        }
        const wrap = el('div', null,
          group(X.registered, rows),
          group(null, [
            row({ key: 'bio.fingerAdd', params: { verified: true }, title: X.add, qa: 'bio.add', chev: false, cls: 'add' }),
            row({ title: X.check, qa: 'bio.checkOpen', onClick: () => { api._check = !api._check; api.refresh(); }, chev: false }),
          ]),
          check);
        // the next tap on this screen ends the glow — class only (no re-render under the finger, so that tap still lands)
        wrap.addEventListener('pointerdown', () => { if (api._glow) unGlow(api); }, true);
        return wrap;
      },
    });
    reg('bio.fingerDetail', {
      title: (api) => { const f = SEC.fingers().find((x) => x.id === api.params.id); return f ? `지문 ${f.k}` : ''; },
      verify: (p) => !p.verified,
      onOpen(api) { if (api.params.id === 'f2' && !isDash()) setFlag('factFinger'); },
      render(api) {
        const X = FT();
        const f = SEC.fingers().find((x) => x.id === api.params.id);
        if (!f) return el('div');
        const ren = sess.get('fpRename:' + f.id);
        const rows = [row({ title: X.name, meta: ren || T(f.name) })];
        if (f.added) rows.push(oneLine(row({ title: X.added, meta: f.added })));
        if (f.lastUsed) rows.push(oneLine(row({ title: X.lastUsed, meta: f.lastUsed })));
        return el('div', null, hero(fpLabel(f), '', el('span.sh2-fpic', { html: (G.lock && G.lock.ICON && G.lock.ICON.finger) || '' })), group(null, rows),
          el('div.sh2-actions.two', null,
            btnRow(X.rename || '이름 변경', () => { G.settingsApp.renameSheet && G.settingsApp.renameSheet({ title: X.rename, value: ren || T(f.name), ctx: 'fpRename', key: 'fpRename:' + f.id, after: api.refresh }); }, { qa: 'bio.rename' }),
            btnRow(X.del || '삭제', async () => { const ok = await SEC.deleteFinger(f.id); if (ok) api.back(); }, { qa: 'bio.delete', danger: true })));
      },
    });
    /* ＋ 지문 추가 — 0.8 s × 3 → 지문이 등록되었습니다 (§4.6.3 · §0.2 E7 — no flag) */
    reg('bio.fingerAdd', {
      title: () => FT().enrollTitle || '지문 등록',
      verify: (p) => !p.verified,
      resume: false,
      render(api) {
        let n = 0;
        const prog = el('div.sh2-enroll-ring', null, el('i'));
        const setP = () => { prog.style.setProperty('--p', String(n / 3)); };
        setP();
        const hold = G.lock && G.lock.fingerButton ? G.lock.fingerButton('bio.enroll', () => {
          n++; setP(); cue('fp.ok');
          if (n >= 3) {
            const sh = SH(); const add = sh.fpAdded || [];
            let k = SEC.fingers().length + 1; let id = 'f' + (3 + add.length); while (SEC.fingers().some((x) => x.id === id)) id += 'x';
            sh.fpAdded = add.concat({ id, k }); save();
            PH().toast(STR('fpAdded'));
            setTimeout(() => api.back(), 500);
          }
        }) : el('span');
        return el('div.sh2-enroll', null, el('div.en-text', null, STR('fpTouchMany')), prog, el('div.en-btn', null, hold));
      },
    });
    /* ---------- S4 사용자 (§3.9 · §4.6.2 · §3.10 reversed list) ---------- */
    reg('users', {
      title: () => '사용자',
      render(api) {
        const UU = G.STORY.users || {};
        const me = user();
        const list = (UU.listFrom && UU.listFrom[me]) || [];
        const rows = list.map(([id, label, meta]) => {
          if (me === 'dash') return row({ title: label, meta, qa: 'users.row:' + id });            // no reaction (§5.4 S4)
          return row({ title: label, meta, qa: 'users.row:' + id, key: id === 'dash' ? 'users.detail' : 'users.n' });
        });
        if (me === 'n') rows.push(row({ title: UU.addUser || '＋ 사용자 추가', qa: 'users.row:add', onClick: () => PH().addUserFlow && PH().addUserFlow(), chev: false, cls: 'add' }));
        return el('div', null, group(null, rows));
      },
      onOpen() {
        if (isDash()) { setFlag('dashUsers'); setFlag('dashSeen'); }
        else setFlag('dashSeen');                     // `—` is drawn in this list
      },
    });
    reg('users.detail', {
      title: () => '—',
      render(api) {
        const X = (G.STORY.users && G.STORY.users.dashDetail) || {};
        const locked = !!(G.users && G.users.dashLocked && G.users.dashLocked()) || !!api._turnOff;
        const allow = toggle(!locked, null, { label: X.allow, disabled: true, qa: 'users.allow' });
        const calls = toggle(false, null, { label: X.calls, disabled: true, qa: 'users.calls' });
        api._allow = allow;
        const sw = btnRow(X.switchBtn || '사용자 전환', () => {
          if (G.users && !G.users.canSwitch('dash')) { PH().toast(STR('noSwitch')); return; }
          G.users && G.users.switchTo('dash');
        }, { qa: 'users.switch', primary: true });
        return el('div', null,
          el('div.sh2-user-hero', null, el('span.sh2-uav.dash', null, '—'), el('b', null, X.title || '—'), el('small', null, T(X.added))),
          el('div.sh2-actions', null, sw),
          group(null, [
            row({ title: X.calls, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, '꺼짐'), calls), cls: 'locked' }),
            row({ title: X.allow, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl.allow', null, locked ? '꺼짐' : '켜짐'), allow), cls: 'locked' }),
          ]));
      },
    });
    reg('users.n', {
      title: () => '{N}',
      render() {
        const lines = ((G.STORY.users && G.STORY.users.nDetail) || []).map((s) => { const t = T(s); const i = t.indexOf('  '); return i > 0 ? row({ title: t.slice(0, i), meta: t.slice(i).trim() }) : row({ title: t }); });
        const av = G.phone && G.phone._initial ? G.phone._initial() : '';
        return el('div', null, el('div.sh2-user-hero', null, el('span.sh2-uav', null, av), el('b', null, T('{N}'))), group(null, lines));
      },
    });
    /* ---------- S5 키보드 · 예측 텍스트 · 개인 단어 목록 (§5.4 S5 · §4.6.5 · §3.5) ---------- */
    const predictOn = () => !((vget('kbdPredictOff', []) || []).includes(user()));
    reg('kbd', {
      title: () => (KB().text || {}).kbdTitle,
      render() {
        const X = KB().text || {};
        const auto = toggle(!!SH().kbdAutoFix, (v) => { SH().kbdAutoFix = v; save(); }, { label: X.autoFix });
        const snd = toggle(SH().kbdSound !== false, (v) => { SH().kbdSound = v; save(); }, { label: X.keySound });
        return el('div', null, group(null, [
          row({ title: X.lang, meta: X.langMeta }),
          row({ key: 'kbd.predict', title: X.predict, meta: predictOn() ? X.on : X.off }),
          row({ key: 'kbd.words', title: X.words, cls: 'indent' }),
          row({ title: X.autoFix, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(SH().kbdAutoFix ? X.on : X.off)), auto) }),
          row({ title: X.keySound, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(SH().kbdSound !== false ? X.on : X.off)), snd) }),
        ]));
      },
    });
    reg('kbd.predict', {
      title: () => (KB().text || {}).predict,
      render(api) {
        const X = KB().text || {};
        const tg = toggle(predictOn(), (v) => {
          const u = user(); let off = (vget('kbdPredictOff', []) || []).slice();
          off = v ? off.filter((x) => x !== u) : (off.includes(u) ? off : off.concat(u));
          vset('kbdPredictOff', off);
          setTimeout(api.refresh, 20);
        }, { label: X.predictShow, qa: 'kbd.predictToggle' });
        const sp = toggle(SH().kbdAutoSpace !== false, (v) => { SH().kbdAutoSpace = v; save(); }, { label: X.autoSpace });
        return el('div', null, group(null, [
          row({ title: X.predictShow, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(predictOn() ? X.on : X.off)), tg) }),
          row({ key: 'kbd.words', title: X.words }),
          row({ title: X.autoSpace, right: el('span.sh2-tgwrap', null, el('span.sh2-tgl', null, T(SH().kbdAutoSpace !== false ? X.on : X.off)), sp) }),
        ]));
      },
    });
    reg('kbd.words', {
      title: () => (KB().text || {}).words,
      right(api) {
        const X = KB().text || {};
        const b = el('button.sh2-sort', { 'data-qa': 'kbd.sort' }, T(X.sortRecent));
        b.addEventListener('click', (e) => {
          e.stopPropagation(); sfx('tap');
          api._freq = !api._freq;
          b.textContent = T(api._freq ? X.sortFreq : X.sortRecent);
          api.refresh();
        });
        return [b];
      },
      onOpen(api) {
        if (!isDash()) { setFlag('kbdListOpened'); setFlag('factKbd'); }
        api.onClose(() => { if (api._io) api._io.disconnect(); });
      },
      render(api) {
        const X = KB().text || {};
        const who = isDash() ? 'dash' : 'n';
        const words = ((KB()[who] || {}).words || []).slice();
        if (api._freq) words.sort((a, b) => (a.rank || 0) - (b.rank || 0));
        const maxR = words.reduce((m, w) => Math.max(m, w.rank || 0), 1);
        const rows = words.map((w) => {
          const right = api._freq
            ? el('span.sh2-freq', null, el('i', { style: { width: Math.round(18 + 72 * (1 - ((w.rank || 1) - 1) / Math.max(1, maxR))) + '%' } }))
            : el('span.sh2-meta', null, T(X.addedPrefix) + w.added);
          const r = el('div.sh2-row.word', { 'data-qa': 'kbd.word:' + w.w, 'data-w': w.w }, el('span.sh2-main', null, el('span.sh2-t', null, w.w)), right);
          r.addEventListener('contextmenu', (e) => e.preventDefault());   // read-only: long-press does nothing
          return r;
        });
        const g = group(null, rows);
        if (who === 'n') {
          const SEED = new Set((KB().n && KB().n.seed) || []);
          if (api._io) api._io.disconnect();
          const mark = (w) => { const seeds = new Set(vget('kbdSeedSeen', []) || []); if (!seeds.has(w)) { seeds.add(w); seedSeen(seeds); } };
          if (window.IntersectionObserver) {
            api._io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting && en.intersectionRatio >= 0.6) mark(en.target.dataset.w); }), { threshold: [0.6] });
            setTimeout(() => rows.forEach((r) => { if (SEED.has(r.dataset.w)) api._io && api._io.observe(r); }), 60);
          } else rows.forEach((r) => { if (SEED.has(r.dataset.w)) mark(r.dataset.w); });
        }
        return el('div', null, g);
      },
    });
    /* ---------- Wi-Fi saemal_rooftop ⚙ (§3.3 두 번째 경로 · §4.6.6) ---------- */
    reg('wifi.saved.saemal_rooftop', {
      title: () => 'saemal_rooftop',
      onOpen() { if (!isDash() && !gone().includes('saemal_rooftop') && PH().wifi && PH().wifi.saved().includes('saemal_rooftop')) setFlag('factSmart'); },
      render(api) {
        const net = (D().wifi || []).find((w) => w.id === 'saemal_rooftop') || {};
        const W = PH().wifi;
        api.on('wifi:change', api.refresh);
        const saved = W && W.saved().includes('saemal_rooftop');
        const line = T(net.line || '');
        const rows = [row({ title: W && W.connected() ? line : line.replace(/^연결됨 · /, ''), cls: 'wrap' })];
        if (!isDash() && !gone().includes('saemal_rooftop')) rows.push(row({ title: net.smart, cls: 'wrap' }));
        (net.extra || []).forEach((s) => { const t = T(s); const i = t.indexOf('  '); rows.push(i > 0 ? row({ title: t.slice(0, i), meta: t.slice(i).trim() }) : row({ title: t })); });
        const wrap = el('div', null, hero('saemal_rooftop', '', el('span.sh2-ic.big', { style: { background: '#3e91ff' }, html: (U().GL || {}).wifi || '' })), group(null, rows));
        if (saved) wrap.appendChild(el('div.sh2-actions', null, btnRow('삭제', async () => {
          const v = await PH().dialog({ text: STR('wifiDelQ'), buttons: [{ label: '취소', value: 'cancel' }, { label: '삭제', value: 'delete', style: 'danger' }] });
          if (v !== 'delete') return;
          W.forget('saemal_rooftop');
          api.back();
        }, { qa: 'wifi.forget', danger: true })));
        return wrap;
      },
    });
  }

  /* =========================================================
   * 01:20 `전환 막아 두기` — the '—' detail screen with `이 사용자로 전환 허용` turning (꺼짐) for 2 s (§4.10.3 · §4.6.2)
   * ========================================================= */
  SEC._lockDash = function () {
    return new Promise((resolve) => {
      const done = () => resolve();
      if (!G.settingsApp || !G.settingsApp.pushKey) { SH().dashLocked = true; save(); done(); return; }
      Promise.resolve(G.settingsApp.pushKey('users.detail', { verified: true, lockAnim: true })).then(() => {
        setTimeout(() => {
          SH().dashLocked = true; save();
          const top = PH().top && PH().top();
          const scr = top && top.node;
          const t = scr && scr.querySelector('[data-qa="users.allow"]');
          if (t && t.set) t.set(false); else if (t) t.classList.remove('on');
          const lab = scr && scr.querySelector('.sh2-tgl.allow'); if (lab) lab.textContent = '꺼짐';
          sfx('tap');
          setTimeout(() => {
            const t2 = PH().top && PH().top();
            if (t2 && t2.node === scr) PH().pop(true);
            done();
          }, 2000);
        }, 600);
      });
    });
  };

  /* =========================================================
   * init
   * ========================================================= */
  let inited = false;
  SEC.init = function () {
    if (inited) return; inited = true;
    if (!registered) { registerScreens(); registered = true; }
    G.bus && G.bus.on('kbd:shown', onShown);
  };
  // the predict provider + settings keys exist as soon as this file loads (same owner as settings.js — not a cross-owner call)
  if (G.hooks && G.hooks.set) G.hooks.set('kbd:predict', (u, token, ctx) => SEC.predict(u, token, ctx));
  let registered = false;
  if (G.settingsApp && G.settingsApp.register) { registerScreens(); registered = true; }
  if (G.DEBUG) { window.haru = window.haru || {}; window.haru.predict = (u, t, c) => SEC.predict(u, t, c); }
})();
