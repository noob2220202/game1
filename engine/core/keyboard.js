/* =========================================================
 * engine/core/keyboard.js — in-game keyboard (두벌식 + QWERTY, real hangul composition) with the ep2 predict bar
 * and number row (core · DESIGN_EP2 §9.5-1/-2, §5.3 · ARCH_EP2 §4.11). No native <input> anywhere.
 *
 * const f = G.ui.field({ placeholder, mode:'ko'|'en', password=false, predict=true, ctx, numRow=true, onSubmit(v),
 *                        onChange(v), maxLength, submitLabel, qa, cls, multiline=false })
 *   → { node, value, text(), set(v), insert(text), focus(), blur(), clear(), setPassword(on) }
 * G.ui.showKeyboard(field) · G.ui.hideKeyboard() · G.ui.keyboardOpen() → bool · G.ui.focusedField() → field|null
 * G.ui.composeHangul(seq) · G.ui.keyboardMode(m) · G.ui.EN2KO
 * Predict bar iff predict && !password && focused && user ∉ vars.kbdPredictOff. Words come only from the hook
 *   'kbd:predict' (user, token, ctx) → [{w, his, seed}] (≤ 3, left = most frequent); token = text after the last
 *   space/newline (composing syllable included); empty token → three empty cells.
 * A word drawn ≥ 250 ms continuously → bus 'kbd:shown' {user, ctx, words:[{w,his,seed}]} (once per word per focus).
 * Tap a cell (or desktop Ctrl+1/2/3) → token replaced by the word + ' '. Esc is NOT handled here (main.js owns it).
 * Bus: 'keyboard' (true|false) · 'kbd:shown'. Back: registers G.phone.pushBack(close) while open.
 * data-qa: kb · kb.key:<char> · kb.lang · kb.space · kb.back · kb.submit · kb.shift · kb.sym · kb.predict:<0|1|2>
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const UI = (G.ui = G.ui || {});
  const el = (G.util && G.util.el) || function (tag) { return document.createElement(tag.split('.')[0] || 'div'); };

  /* ---------------- hangul automaton (ep1) ---------------- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VCOMB = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
  const JCOMB = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
  const JSPLIT = {}; Object.keys(JCOMB).forEach((k) => { JSPLIT[JCOMB[k]] = [k[0], k[1]]; });
  const isC = (c) => CHO.includes(c);
  const isV = (c) => JUNG.includes(c);
  function syl(cho, jung, jong) {
    if (!cho && !jung) return '';
    if (cho && !jung) return cho;
    if (!cho && jung) return jung;
    const ji = JONG.indexOf(jong || '');
    return String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + Math.max(0, ji));
  }
  UI.composeHangul = function (seq) {
    let out = '';
    let cho = '', jung = '', jong = [];
    const flush = () => { out += syl(cho, jung, jong.length === 2 ? JCOMB[jong.join('')] : jong[0] || ''); cho = ''; jung = ''; jong = []; };
    for (const t of seq) {
      if (isC(t)) {
        if (!cho && !jung) { cho = t; }
        else if (cho && !jung) { flush(); cho = t; }
        else if (!cho && jung) { flush(); cho = t; }
        else if (!jong.length) { if (JONG.includes(t)) jong = [t]; else { flush(); cho = t; } }
        else if (jong.length === 1 && JCOMB[jong[0] + t]) { jong = [jong[0], t]; }
        else { flush(); cho = t; }
      } else if (isV(t)) {
        if (cho && !jung) { jung = t; }
        else if (cho && jung && !jong.length) { if (VCOMB[jung + t]) jung = VCOMB[jung + t]; else { flush(); jung = t; } }
        else if (jong.length) { const move = jong.pop(); flush(); cho = move; jung = t; }
        else if (!cho && jung) { if (VCOMB[jung + t]) jung = VCOMB[jung + t]; else { flush(); jung = t; } }
        else { jung = t; }
      } else { flush(); out += t; }
    }
    flush();
    return out;
  };
  /** text → key tokens (syllables decomposed so composition continues exactly as if typed) */
  function tokens(str) {
    const out = [];
    for (const ch of String(str || '')) {
      const c = ch.charCodeAt(0) - 0xac00;
      if (c < 0 || c > 11171) { out.push(ch); continue; }
      out.push(CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)]);
      const j = JONG[c % 28];
      if (j) { if (JSPLIT[j]) out.push(JSPLIT[j][0], JSPLIT[j][1]); else out.push(j); }
    }
    return out;
  }

  const KO = [['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'], ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'], ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ']];
  const KO_SHIFT = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' };
  const EN = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
  const NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const SYM = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['-', '/', ':', ';', '(', ')', '₩', '&', '@', '"'], ['.', ',', '?', '!', "'", '#', '%']];
  const SYM_NR = [['+', '×', '÷', '=', '/', '_', '<', '>', '[', ']'], ['!', '@', '#', '₩', '%', '^', '&', '*', '(', ')'], ['-', "'", '"', ':', ';', ',', '?']];
  const EN2KO = {}; EN.forEach((r, i) => r.forEach((k, j) => { EN2KO[k] = KO[i][j]; }));
  const KO2EN = {}; Object.keys(EN2KO).forEach((k) => { KO2EN[EN2KO[k]] = k; });
  UI.EN2KO = EN2KO;

  /* ---------------- helpers ---------------- */
  const curUser = () => { try { if (G.users && G.users.current) return G.users.current(); } catch (e) {} return (G.state && G.state.vars && G.state.vars.user) || 'n'; };
  function predictOn(f) {
    if (!f || f.opts.password || f.opts.predict === false) return false;
    const off = (G.vars && G.vars('kbdPredictOff')) || [];
    return !(Array.isArray(off) && off.indexOf(curUser()) >= 0);
  }
  const lastBreak = (t) => Math.max(t.lastIndexOf(' '), t.lastIndexOf('\n'));
  function vib(ms) { if (navigator.vibrate && G.settings && G.settings.vibration) { try { navigator.vibrate(ms); } catch (e) {} } }

  /* ---------------- keyboard singleton ---------------- */
  let kb = null, active = null, shift = false, mode = 'ko', sym = false;
  let predictRow = null, cells = [], cellWords = [null, null, null];
  let shownSet = new Set(), shownTimers = {}, backOff = null;

  function build() {
    const screen = document.getElementById('screen') || document.body;
    kb = el('div.kb');
    kb.setAttribute('data-qa', 'kb');
    kb.setAttribute('role', 'group');
    screen.appendChild(kb);
    kb.addEventListener('pointerdown', (e) => e.preventDefault());
    kb.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', onPhysicalKey);
  }
  function key(label, cls, fn, opts) {
    opts = opts || {};
    const b = el('button.kb-key.' + cls.split(' ').filter(Boolean).join('.'), { type: 'button', 'data-qa': opts.qa || null, 'aria-label': opts.aria || null },
      opts.sub ? el('small', null, opts.sub) : null, el('span', null, label));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); if (G.audio && G.audio.sfx && G.audio.sfx.key) { try { G.audio.sfx.key(); } catch (er) {} } vib(5); });
    b.addEventListener('pointerup', () => { if (!b.classList.contains('down')) return; b.classList.remove('down'); fn(); });
    b.addEventListener('pointerleave', () => b.classList.remove('down'));
    b.addEventListener('pointercancel', () => b.classList.remove('down'));
    return b;
  }
  function render() {
    if (!kb) return;
    kb.innerHTML = '';
    const f = active;
    kb.classList.toggle('pw', !!(f && f.opts.password));
    // predict bar (3 cells, 44 px) — only for predicting fields
    predictRow = null; cells = []; cellWords = [null, null, null];
    if (predictOn(f)) {
      predictRow = el('div.kb-predict');
      for (let i = 0; i < 3; i++) {
        const c = el('button.kb-cell', { type: 'button', 'data-qa': 'kb.predict:' + i });
        c.addEventListener('pointerdown', (e) => e.preventDefault());
        c.addEventListener('click', () => { const w = cellWords[i]; if (w) accept(w); });
        cells.push(c); predictRow.appendChild(c);
      }
      kb.appendChild(predictRow);
    }
    const numRow = !f || f.opts.numRow !== false;
    if (numRow && !sym) {
      const r = el('div.kb-row.num');
      NUM.forEach((k) => r.appendChild(key(k, 'ch', () => typeCh(k), { qa: 'kb.key:' + k })));
      kb.appendChild(r);
    }
    const rows = sym ? (numRow ? SYM_NR : SYM) : (mode === 'ko' ? KO : EN);
    if (sym && numRow) {
      const r = el('div.kb-row.num');
      NUM.forEach((k) => r.appendChild(key(k, 'ch', () => typeCh(k), { qa: 'kb.key:' + k })));
      kb.appendChild(r);
    }
    rows.forEach((r, ri) => {
      const row = el('div.kb-row');
      if (ri === 2 && !sym) row.appendChild(key('⇧', 'shift' + (shift ? ' on' : ''), () => { shift = !shift; render(); }, { qa: 'kb.shift' }));
      r.forEach((k) => {
        let label = k;
        if (!sym && mode === 'ko' && shift && KO_SHIFT[k]) label = KO_SHIFT[k];
        if (!sym && mode === 'en' && shift) label = k.toUpperCase();
        const sub = !sym && mode === 'en' && f && f.opts.showJamo ? EN2KO[k] : null;
        row.appendChild(key(label, 'ch', () => { typeCh(label); if (shift) { shift = false; render(); } }, { sub, qa: 'kb.key:' + label }));
      });
      if (ri === 2) row.appendChild(key('⌫', 'del', () => del(), { qa: 'kb.back', aria: '지우기' }));
      kb.appendChild(row);
    });
    const multi = f && f.opts.multiline;
    const bottom = el('div.kb-row.bottom', null,
      key(sym ? (mode === 'ko' ? '가' : 'ABC') : '!#1', 'fn', () => { sym = !sym; shift = false; render(); }, { qa: 'kb.sym' }),
      f && f.opts.password ? null : key('한/영', 'fn lang', () => { mode = mode === 'ko' ? 'en' : 'ko'; shift = false; render(); }, { qa: 'kb.lang' }),
      key(mode === 'ko' ? '스페이스' : 'space', 'space', () => typeCh(' '), { qa: 'kb.space' }),
      key(multi ? '↵' : (f && f.opts.submitLabel ? f.opts.submitLabel : '완료'), 'fn go', () => (multi ? typeCh('\n') : submit()), { qa: 'kb.submit' }));
    kb.appendChild(bottom);
    updatePredict();
    measure();
  }
  function measure() {
    if (!kb) return;
    requestAnimationFrame(() => {
      const h = kb.classList.contains('in') ? kb.offsetHeight : 0;
      ['screen', 'phone'].forEach((id) => { const n = document.getElementById(id); if (n) n.style.setProperty('--kbh', h + 'px'); });
    });
  }

  /* ---------------- predictions ---------------- */
  function clearShownTimers() { Object.keys(shownTimers).forEach((w) => clearTimeout(shownTimers[w])); shownTimers = {}; }
  function updatePredict() {
    if (!predictRow || !active) return;
    const f = active, text = f.text();
    const token = text.slice(lastBreak(text) + 1);
    let words = [];
    if (token && G.hooks && G.hooks.has && G.hooks.has('kbd:predict')) {
      const r = G.hooks.call('kbd:predict', curUser(), token, f.opts.ctx || null);
      if (Array.isArray(r)) words = r.map((x) => (typeof x === 'string' ? { w: x } : x)).filter((x) => x && typeof x.w === 'string' && x.w).slice(0, 3);
    }
    const drawn = new Set();
    for (let i = 0; i < 3; i++) {
      const it = words[i] || null;
      cellWords[i] = it ? it.w : null;
      cells[i].textContent = it ? it.w : '';
      cells[i].disabled = !it;
      cells[i].classList.toggle('empty', !it);
      if (it) drawn.add(it.w);
    }
    // 250 ms "shown" rule
    Object.keys(shownTimers).forEach((w) => { if (!drawn.has(w)) { clearTimeout(shownTimers[w]); delete shownTimers[w]; } });
    words.forEach((it) => {
      if (shownSet.has(it.w) || shownTimers[it.w]) return;
      const fieldAt = active;
      shownTimers[it.w] = setTimeout(() => {
        delete shownTimers[it.w];
        if (active !== fieldAt || cellWords.indexOf(it.w) < 0 || shownSet.has(it.w)) return;
        shownSet.add(it.w);
        G.bus.emit('kbd:shown', { user: curUser(), ctx: fieldAt.opts.ctx || null, words: [{ w: it.w, his: !!it.his, seed: !!it.seed }] });
      }, 250);
    });
  }
  function accept(w) {
    const f = active; if (!f) return;
    const text = f.text(), base = text.slice(0, lastBreak(text) + 1);
    let next = base + w + ' ';
    if (f.opts.maxLength && next.length > f.opts.maxLength) next = next.slice(0, f.opts.maxLength);
    f.seq = Array.from(next);
    f.update();
  }

  /* ---------------- typing ---------------- */
  function typeCh(ch) {
    const f = active; if (!f) return;
    if (f.opts.maxLength && f.text().length >= f.opts.maxLength && ch !== ' ') return;
    f.seq.push(ch); f.update();
  }
  function del() { const f = active; if (!f) return; f.seq.pop(); f.update(); }
  function submit() { const f = active; if (!f) return; if (f.opts.onSubmit) f.opts.onSubmit(f.text()); }

  function onPhysicalKey(e) {
    if (!active || e.metaKey || e.altKey) return;
    if (e.ctrlKey) {                                                 // hidden convenience: Ctrl+1/2/3 = predict cells
      const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
      if (n != null && cellWords[n]) { e.preventDefault(); accept(cellWords[n]); }
      return;
    }
    if (e.key === 'Escape') return;                                  // main.js owns Esc
    if (e.key === 'Backspace') { e.preventDefault(); del(); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (active.opts.multiline) typeCh('\n'); else submit(); return; }
    if (e.key === 'HangulMode' || e.key === 'Lang1' || (e.key === 'Process' && e.code === 'AltRight')) { if (!active.opts.password) { mode = mode === 'ko' ? 'en' : 'ko'; render(); } e.preventDefault(); return; }
    if (e.key.length !== 1) return;
    e.preventDefault();
    let ch = e.key;
    const low = ch.toLowerCase();
    if (mode === 'ko' && EN2KO[low]) { ch = EN2KO[low]; if (e.shiftKey && KO_SHIFT[ch]) ch = KO_SHIFT[ch]; }
    else if (/[ㄱ-ㅣ]/.test(ch) && mode === 'en' && KO2EN[ch]) ch = KO2EN[ch];
    typeCh(ch);
  }

  UI.showKeyboard = function (field) {
    if (!kb) build();
    if (active && active !== field) { active.node.classList.remove('focus'); }
    if (active !== field) { shownSet = new Set(); clearShownTimers(); }
    active = field;
    field.node.classList.add('focus');
    mode = field.opts.password ? 'en' : (field.opts.mode || 'ko');
    shift = false; sym = false;
    kb.classList.add('in');
    render();
    const scr = document.getElementById('screen'); if (scr) scr.classList.add('kb-open');
    const ph = document.getElementById('phone'); if (ph) ph.classList.add('kb-open');
    if (!backOff && G.phone && G.phone.pushBack) { try { backOff = G.phone.pushBack(() => { if (!active) return false; UI.hideKeyboard(); return true; }); } catch (e) { backOff = null; } }
    G.bus.emit('keyboard', true);
  };
  UI.hideKeyboard = function () {
    if (!kb) return;
    const was = !!active || kb.classList.contains('in');
    kb.classList.remove('in');
    const scr = document.getElementById('screen'); if (scr) scr.classList.remove('kb-open');
    const ph = document.getElementById('phone'); if (ph) ph.classList.remove('kb-open');
    if (active) active.node.classList.remove('focus');
    active = null;
    clearShownTimers();
    if (backOff) { try { backOff(); } catch (e) {} backOff = null; }
    measure();
    if (was) G.bus.emit('keyboard', false);
  };
  UI.keyboardOpen = () => !!(kb && active && kb.classList.contains('in'));
  UI.focusedField = () => active;
  UI.keyboardMode = function (m) { mode = m; if (kb && active) render(); };
  if (G.bus) {
    G.bus.on('screen:pop', () => UI.hideKeyboard());
    // a screen pushed over the focused field (banner → another chat, profile, …) takes the keyboard away from it
    G.bus.on('screen:push', (entry) => { if (!active) return; const n = entry && entry.node; if (n && n.contains && n.contains(active.node)) return; UI.hideKeyboard(); });
    G.bus.on('home', () => UI.hideKeyboard());
    G.bus.on('app:open', () => UI.hideKeyboard());          // app switch via banner/notification must not leave a stale keyboard
    G.bus.on('users:switching', () => UI.hideKeyboard());
    G.bus.on('var:kbdPredictOff', () => { if (active) render(); });
  }

  /* ---------------- field ---------------- */
  UI.field = function (opts) {
    opts = Object.assign({ predict: true, numRow: true }, opts || {});
    const textEl = el('span.fld-text');
    const ph = el('span.fld-ph', null, opts.placeholder ? (G.T ? G.T(opts.placeholder) : opts.placeholder) : '');
    const node = el('div.fld' + (opts.cls ? '.' + opts.cls : '') + (opts.multiline ? '.multi' : ''), { role: 'textbox', tabindex: 0, 'data-qa': opts.qa || null }, ph, textEl, el('i.fld-caret'));
    const f = {
      node, opts, seq: [],
      text() { return UI.composeHangul(f.seq); },
      get value() { return f.text(); },
      set(v) { f.seq = Array.from(v == null ? '' : String(v)); f.update(true); },
      insert(text) {
        const toks = tokens(text);
        for (const t of toks) { if (f.opts.maxLength && f.text().length >= f.opts.maxLength && t !== ' ') break; f.seq.push(t); }
        f.update();
      },
      update(silent) {
        const t = f.text();
        textEl.textContent = opts.password ? '•'.repeat(t.length) : t;
        ph.style.display = t ? 'none' : '';
        if (active === f) updatePredict();
        if (!silent && opts.onChange) opts.onChange(t);
      },
      focus() { UI.showKeyboard(f); },
      blur() { if (active === f) UI.hideKeyboard(); },
      clear() { f.seq = []; f.update(); },
      setPassword(on) { opts.password = on; f.update(true); if (active === f) { mode = on ? 'en' : (opts.mode || 'ko'); render(); } },
    };
    node.addEventListener('click', (e) => { e.stopPropagation(); f.focus(); });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' && active !== f) { e.preventDefault(); f.focus(); } });
    f.update(true);
    return f;
  };
})();
