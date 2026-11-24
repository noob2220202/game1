/* =========================================================
 * In-game keyboard (두벌식 Korean + QWERTY) with real hangul composition.
 * Also maps a physical keyboard on desktop exactly like a Korean IME.
 *
 * const f = G.ui.field({placeholder, mode:'ko'|'en', password:false, onSubmit(v), onChange(v), maxLength, submitLabel})
 * f.node  -> the fake input element (tap to focus/open keyboard)
 * f.value / f.set(v) / f.focus() / f.blur()
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el } = G.util;
  const UI = (G.ui = G.ui || {});

  /* ---------------- hangul automaton ---------------- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VCOMB = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
  const JCOMB = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
  const isC = (c) => CHO.includes(c);
  const isV = (c) => JUNG.includes(c);
  function syl(cho, jung, jong) {
    if (!cho && !jung) return '';
    if (cho && !jung) return cho;
    if (!cho && jung) return jung;
    const ji = JONG.indexOf(jong || '');
    return String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + Math.max(0, ji));
  }
  /** compose an array of tokens (jamo or other chars) into a string */
  UI.composeHangul = function (seq) {
    let out = '';
    let cho = '', jung = '', jong = []; // jong: array of 1-2 consonants
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
        else if (jong.length) {
          const move = jong.pop();
          flush(); // previous syllable keeps its remaining final (if any)
          cho = move; jung = t;
        } else if (!cho && jung) { if (VCOMB[jung + t]) jung = VCOMB[jung + t]; else { flush(); jung = t; } }
        else { jung = t; }
      } else { flush(); out += t; }
    }
    flush();
    return out;
  };

  const KO = [['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'], ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'], ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ']];
  const KO_SHIFT = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' };
  const EN = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
  const EN2KO = {}; EN.forEach((r, i) => r.forEach((k, j) => { EN2KO[k] = KO[i][j]; }));
  const KO2EN = {}; Object.keys(EN2KO).forEach((k) => { KO2EN[EN2KO[k]] = k; });
  UI.EN2KO = EN2KO;

  /* ---------------- keyboard singleton ---------------- */
  let kb = null, active = null, shift = false, mode = 'ko', sym = false;
  function build() {
    kb = el('div.kb');
    document.getElementById('screen').appendChild(kb);
    kb.addEventListener('pointerdown', (e) => e.preventDefault());
    document.addEventListener('keydown', onPhysicalKey);
  }
  function render() {
    kb.innerHTML = '';
    const rows = sym ? [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['-', '/', ':', ';', '(', ')', '₩', '&', '@', '"'], ['.', ',', '?', '!', "'", '#', '%']] : (mode === 'ko' ? KO : EN);
    rows.forEach((r, ri) => {
      const row = el('div.kb-row');
      if (ri === 2) row.appendChild(key(sym ? '' : '⇧', 'shift' + (shift ? ' on' : ''), () => { shift = !shift; render(); }));
      r.forEach((k) => {
        let label = k;
        if (!sym && mode === 'ko' && shift && KO_SHIFT[k]) label = KO_SHIFT[k];
        if (!sym && mode === 'en' && shift) label = k.toUpperCase();
        const sub = !sym && mode === 'en' && active && active.opts.showJamo ? EN2KO[k] : null;
        const b = key(label, 'ch', () => { type(label); if (shift) { shift = false; render(); } }, sub);
        row.appendChild(b);
      });
      if (ri === 2) row.appendChild(key('⌫', 'del', () => del()));
      kb.appendChild(row);
    });
    const lang = active && active.opts.password ? null : key(mode === 'ko' ? '한/영' : '한/영', 'fn lang', () => { mode = mode === 'ko' ? 'en' : 'ko'; shift = false; render(); });
    const bottom = el('div.kb-row.bottom', null,
      key(sym ? (mode === 'ko' ? '가' : 'ABC') : '!#1', 'fn', () => { sym = !sym; render(); }),
      lang,
      key(mode === 'ko' ? '스페이스' : 'space', 'space', () => type(' ')),
      key(active && active.opts.submitLabel ? active.opts.submitLabel : '완료', 'fn go', () => submit()));
    kb.appendChild(bottom);
    const modeTag = el('div.kb-mode', null, active && active.opts.password ? '🔒 비밀번호 입력 — 영문 자판' : (mode === 'ko' ? '한국어' : 'English'));
    kb.prepend(modeTag);
  }
  function key(label, cls, fn, sub) {
    const b = el('button.kb-key.' + cls.split(' ').join('.'), null, sub ? el('small', null, sub) : null, el('span', null, label));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); G.audio && G.audio.sfx.key(); if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate(5); } catch (er) {} });
    b.addEventListener('pointerup', () => { b.classList.remove('down'); fn(); });
    b.addEventListener('pointerleave', () => b.classList.remove('down'));
    return b;
  }
  function type(ch) { if (!active) return; if (active.opts.maxLength && active.text().length >= active.opts.maxLength && ch !== ' ') return; active.seq.push(ch); active.update(); }
  function del() { if (!active) return; active.seq.pop(); active.update(); }
  function submit() { if (!active) return; const a = active; a.opts.onSubmit && a.opts.onSubmit(a.text()); }

  function onPhysicalKey(e) {
    if (!active || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') { e.preventDefault(); del(); return; }
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    if (e.key === 'Escape') { UI.hideKeyboard(); return; }
    if (e.key === 'HangulMode' || e.key === 'Lang1' || (e.key === 'Process' && e.code === 'AltRight')) { if (!active.opts.password) { mode = mode === 'ko' ? 'en' : 'ko'; render(); } e.preventDefault(); return; }
    if (e.key.length !== 1) return;
    e.preventDefault();
    let ch = e.key;
    // physical keyboard acts like a 두벌식 IME when the in-game keyboard is in 한국어 mode
    const low = ch.toLowerCase();
    if (mode === 'ko' && EN2KO[low]) { ch = EN2KO[low]; if (e.shiftKey && KO_SHIFT[ch]) ch = KO_SHIFT[ch]; }
    else if (/[ㄱ-ㅣ]/.test(ch) && mode === 'en' && KO2EN[ch]) ch = KO2EN[ch];
    type(ch);
  }

  UI.showKeyboard = function (field) {
    if (!kb) build();
    if (active && active !== field) active.node.classList.remove('focus');
    active = field;
    field.node.classList.add('focus');
    mode = field.opts.password ? 'en' : (field.opts.mode || 'ko');
    shift = false; sym = false;
    render();
    kb.classList.add('in');
    document.getElementById('screen').classList.add('kb-open');
    G.bus.emit('keyboard', true);
  };
  UI.hideKeyboard = function () {
    if (!kb) return;
    kb.classList.remove('in');
    document.getElementById('screen').classList.remove('kb-open');
    if (active) active.node.classList.remove('focus');
    active = null;
    G.bus.emit('keyboard', false);
  };
  UI.keyboardMode = function (m) { mode = m; if (kb && active) render(); };
  G.bus.on('screen:pop', () => UI.hideKeyboard());
  G.bus.on('home', () => UI.hideKeyboard());

  /* ---------------- field ---------------- */
  UI.field = function (opts) {
    opts = opts || {};
    const textEl = el('span.fld-text');
    const ph = el('span.fld-ph', null, opts.placeholder || '');
    const node = el('div.fld' + (opts.cls ? '.' + opts.cls : ''), { role: 'textbox', tabindex: 0 }, ph, textEl, el('i.fld-caret'));
    const f = {
      node, opts, seq: [],
      text() { return UI.composeHangul(f.seq); },
      get value() { return f.text(); },
      set(v) { f.seq = Array.from(v || ''); f.update(true); },
      update(silent) {
        const t = f.text();
        textEl.textContent = opts.password ? '•'.repeat(t.length) : t;
        ph.style.display = t ? 'none' : '';
        if (!silent) opts.onChange && opts.onChange(t);
      },
      focus() { UI.showKeyboard(f); },
      blur() { if (active === f) UI.hideKeyboard(); },
      clear() { f.seq = []; f.update(); },
      setPassword(on) { opts.password = on; f.update(true); },
    };
    node.addEventListener('click', (e) => { e.stopPropagation(); f.focus(); });
    f.update(true);
    return f;
  };
})();
