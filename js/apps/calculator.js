/* =========================================================
 * 계산기 (H3) — a real working calculator that hides 보관함 (vault).
 *   • history 🕘: old sums + '1124 = 1124' every night since 2025.11.25 (grouped by month)
 *   • type 1124 then '=' → •••• → glitch → card-flip into 보관함 (40 Hz drone swell)  [vaultOpen]
 *   • 보관함 folders: 세아 / {N} / 기타 (IMG_0606, IMG_0310)                          [vaultSeen]
 *   • IMG_0606 › 편집 › 노출: custom slider over a canvas (G.IMG.shaft_card_dark, gain = 1+17·e^1.6)
 *       ≥60 % for 1 s → G.foundFragment('06');  first time >92 % (JS1 budget) → his face 450 ms
 * API: G.vault.open() (debug) · G.vault.photoById(id) · G.vault.exposure(photo)
 * Bus: 'vault:open' · 'vault:folder' id · 'vault:js1' mode
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad, clamp } = G.util;
  const IMG = (k) => (G.IMG && G.IMG[k]) || '';
  const V = () => G.state.vars;
  const T = (s) => (G.T ? G.T(s) : s);
  const parseT = (t) => (G.chat && G.chat.parseT ? G.chat.parseT(t) : new Date(t));
  const sfx = (n, ...a) => { try { G.audio && G.audio.sfx[n] && G.audio.sfx[n](...a); } catch (e) {} };
  const note = (t) => { try { G.notebook && G.notebook.note && G.notebook.note(T(t)); } catch (e) {} };
  const VD = () => G.STORY.vault;
  const VLT = (G.vault = {});

  /* status-bar text colour for this module's screens ('dark' = dark text on a light background) */
  G.bus.on('screen:push', (e) => {
    const n = e && e.node; if (!n || !n.classList) return;
    let st = null;
    if (['calc-screen', 'vt-screen', 'ex-screen'].some((c) => n.classList.contains(c))) st = 'light';
    else if ([].some((c) => n.classList.contains(c))) st = 'dark';
    if (!st) return;
    n.dataset.status = st;
    if (G.phone.top && G.phone.top() === e) G.phone.statusTheme(st);
  });

  const ICON = {
    bg: 'linear-gradient(160deg,#ffb547,#ff7f11)',
    svg: '<svg viewBox="0 0 24 24"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4" fill="none" stroke="#fff" stroke-width="1.4" opacity=".55"/><path d="M7.5 5.6v3.8M5.6 7.5h3.8M14.4 7.5h4M5.8 15.2l3.4 3.4M9.2 15.2l-3.4 3.4M14.4 15.8h4M14.4 18.2h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  /* =========================================================
   * evaluator (precedence, parentheses, unary minus, Samsung-style %)
   * ========================================================= */
  const OPS = '+−×÷';
  function tokenize(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: 'n', v: parseFloat(s.slice(i, j)), raw: s.slice(i, j) }); i = j; continue; }
      if ('+−×÷()%'.includes(c)) out.push({ t: c });
      i++;
    }
    return out;
  }
  function evaluate(s) {
    const tk = tokenize(s); let i = 0;
    const peek = () => tk[i];
    const is = (t) => tk[i] && tk[i].t === t;
    function expr() {
      let left = term();
      while (is('+') || is('−')) {
        const op = tk[i++].t; const r = term();
        const rv = r.pct ? left.v * r.v : r.v;   // 200 + 10% = 220
        left = { v: op === '+' ? left.v + rv : left.v - rv };
      }
      return left;
    }
    function term() {
      let left = factor(); let n = 1;
      while (is('×') || is('÷')) {
        const op = tk[i++].t; const r = factor(); n++;
        if (op === '÷' && r.v === 0) throw new Error('div0');
        left = { v: op === '×' ? left.v * r.v : left.v / r.v };
      }
      return { v: left.v, pct: n === 1 && !!left.pct };
    }
    function factor() {
      let r = unary(); let pct = false;
      while (is('%')) { i++; r = { v: r.v / 100 }; pct = true; }
      return { v: r.v, pct };
    }
    function unary() {
      if (is('−')) { i++; return { v: -unary().v }; }
      if (is('+')) { i++; return unary(); }
      return primary();
    }
    function primary() {
      const t = tk[i++];
      if (!t) throw new Error('incomplete');
      if (t.t === 'n') { if (isNaN(t.v)) throw new Error('syntax'); return { v: t.v }; }
      if (t.t === '(') { const v = expr(); if (is(')')) i++; return { v: v.v }; }
      throw new Error('syntax');
    }
    if (!tk.length) throw new Error('empty');
    const r = expr();
    if (i < tk.length) throw new Error('syntax');
    if (!isFinite(r.v)) throw new Error('range');
    return r.v;
  }
  const group = (intStr) => intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function fmtNum(v) {
    if (Object.is(v, -0)) v = 0;
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e15 || a < 1e-9)) return v.toExponential(8).replace(/\.?0+e/, 'E').replace('E+', 'E');
    let s = String(parseFloat(v.toPrecision(12)));
    if (/e/i.test(s)) s = v.toFixed(10).replace(/\.?0+$/, '');
    const neg = s.startsWith('-'); if (neg) s = s.slice(1);
    const [ip, dp] = s.split('.');
    return (neg ? '−' : '') + group(ip) + (dp ? '.' + dp.slice(0, 10) : '');
  }
  // pretty-print the raw expression (thousand separators on every number as typed)
  function fmtExpr(s) { return s.replace(/[0-9]+(\.[0-9]*)?/g, (m) => { const [ip, dp] = m.split('.'); return group(ip) + (dp != null ? '.' + dp : ''); }); }

  /* =========================================================
   * history data
   * ========================================================= */
  function nightly() {
    const n = G.STORY.calc.nightly;
    const out = [];
    const d = new Date(n.from[0], n.from[1] - 1, n.from[2]);
    const end = new Date(n.to[0], n.to[1] - 1, n.to[2]);
    let k = 0;
    while (d <= end) {
      const last = +d === +end;
      // deterministic 02:00–03:59
      const h = last ? n.lastTime[0] : 2 + ((k * 7 + 3) % 2);
      const m = last ? n.lastTime[1] : (k * 37 + 11) % 60;
      out.push({ t: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime(), expr: n.expr, nightly: true });
      d.setDate(d.getDate() + 1); k++;
    }
    return out;
  }
  let NIGHT = null;
  function allHistory() {
    if (!NIGHT) NIGHT = nightly();
    const fixed = (G.STORY.calc.fixed || []).map((h) => ({ t: +parseT(h.t), expr: h.expr }));
    const mine = (V().calcHist || []).map((h) => Object.assign({ mine: true }, h));
    return fixed.concat(NIGHT, mine).sort((a, b) => a.t - b.t);
  }
  function resultOf(h) { if (h.res != null) return h.res; try { return fmtNum(evaluate(h.expr)); } catch (e) { return ''; } }

  /* =========================================================
   * calculator UI
   * ========================================================= */
  G.app('calculator', { name: '계산기', icon: ICON, open(p) { openCalc(p || {}); } });

  function openCalc(p) {
    let expr = '', justEq = false, histOpen = false, busy = false;
    const exprEl = el('div.calc-expr');
    const prevEl = el('div.calc-prev');
    const disp = el('div.calc-disp', null, exprEl, prevEl);
    const histBtn = el('button.calc-tool', { 'aria-label': '기록', html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.6V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' });
    const rulerBtn = el('button.calc-tool', { 'aria-label': '단위 변환', html: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 8v3M11 8v4M15 8v3M19 8v2" stroke="currentColor" stroke-width="1.5"/></svg>' });
    const delBtn = el('button.calc-tool.del', { 'aria-label': '지우기', html: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' });
    const tools = el('div.calc-tools', null, histBtn, rulerBtn, el('span.calc-sp'), delBtn);
    const KEYS = [['C', 'fn'], ['( )', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['+/−', 'num'], ['0'], ['.'], ['=', 'eq']];
    const pad = el('div.calc-pad', null, KEYS.map(([k, c]) => {
      const b = el('button.calc-key' + (c ? '.' + c : '.num'), { 'aria-label': k, dataset: { k } }, k === 'C' ? el('span.c', null, 'C') : k);
      b.addEventListener('pointerdown', () => { b.classList.add('down'); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => b.classList.remove('down')));
      b.addEventListener('click', () => press(k));
      return b;
    }));
    const hist = el('div.calc-hist');
    const lower = el('div.calc-lower', null, pad, hist);
    const body = el('div.calc', null, disp, tools, lower);
    const scr = G.ui.screen({ title: '', theme: 'dark', cls: 'calc-screen', body, bodyCls: 'nopad', header: false });

    function render() {
      const shown = fmtExpr(expr) || '0';
      exprEl.textContent = shown;
      exprEl.classList.toggle('result', justEq);
      const len = shown.length;
      exprEl.style.fontSize = (len > 22 ? 26 : len > 16 ? 32 : len > 11 ? 40 : 52) + 'px';
      let pv = '';
      if (!justEq && /[+−×÷%]/.test(expr.replace(/^−/, ''))) { try { pv = fmtNum(evaluate(expr)); } catch (e) { pv = ''; } }
      prevEl.textContent = pv;
      delBtn.disabled = !expr;
    }
    const last = () => expr.slice(-1);
    const isDigit = (c) => /[0-9]/.test(c);
    function curNumber() { const m = expr.match(/[0-9.]+$/); return m ? m[0] : ''; }
    function flash(msg) {
      prevEl.textContent = msg; prevEl.classList.add('err');
      setTimeout(() => { prevEl.classList.remove('err'); render(); }, 1400);
    }
    function press(k) {
      if (busy) return;
      sfx('tap');
      if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate(6); } catch (e) {}
      if (isDigit(k)) {
        if (justEq) { expr = ''; justEq = false; }
        if (last() === ')' || last() === '%') expr += '×';
        const n = curNumber();
        if (n.replace('.', '').length >= 15) { flash('15자리까지 입력할 수 있습니다'); return; }
        if (n === '0') expr = expr.slice(0, -1);
        expr += k;
      } else if (k === '.') {
        if (justEq) { expr = ''; justEq = false; }
        const n = curNumber();
        if (n.includes('.')) return;
        if (!n) { if (last() === ')' || last() === '%') expr += '×'; expr += '0'; }
        expr += '.';
      } else if (OPS.includes(k)) {
        justEq = false;
        if (!expr) { if (k === '−') expr = '−'; return render(); }
        if (last() === '(') { if (k === '−') expr += '−'; return render(); }
        if (OPS.includes(last())) expr = expr.slice(0, -1);
        if (last() === '.') expr = expr.slice(0, -1);
        if (!expr || expr === '−') { expr = k === '−' ? '−' : ''; return render(); }
        expr += k;
      } else if (k === '%') {
        justEq = false;
        if (isDigit(last()) || last() === ')') expr += '%';
      } else if (k === '( )') {
        if (justEq) justEq = false;
        const open = (expr.match(/\(/g) || []).length, close = (expr.match(/\)/g) || []).length;
        if (open > close && (isDigit(last()) || last() === ')' || last() === '%')) expr += ')';
        else { if (isDigit(last()) || last() === ')' || last() === '%') expr += '×'; expr += '('; }
      } else if (k === '+/−') {
        justEq = false;
        const n = curNumber();
        if (!n) { expr += '(−'; }
        else {
          const before = expr.slice(0, -n.length);
          if (before.endsWith('(−')) expr = before.slice(0, -2) + n;
          else expr = before + '(−' + n;
        }
      } else if (k === 'C') { expr = ''; justEq = false; }
      else if (k === '⌫') { if (justEq) justEq = false; expr = expr.slice(0, -1); }
      else if (k === '=') { equals(); return; }
      render();
    }
    function equals() {
      if (!expr) return;
      const raw = expr.replace(/,/g, '');
      if (raw === VD().code) { openVaultFx(); return; }
      let v;
      try { v = evaluate(raw); } catch (e) {
        if (e.message === 'div0') flash('0으로 나눌 수 없습니다');
        else if (e.message === 'range') flash('계산 범위를 초과했습니다');
        else flash('완성되지 않은 수식입니다');
        G.bus.emit('calc:error', raw);
        return;
      }
      const res = fmtNum(v);
      if (/[+−×÷%(]/.test(raw.replace(/^−/, ''))) {
        const h = (V().calcHist || []).concat([{ t: G.clock.now().getTime(), expr: raw, res }]).slice(-30);
        V().calcHist = h; G.save();
        if (histOpen) renderHist();
      }
      expr = res.replace(/,/g, ''); justEq = true;
      render();
      G.bus.emit('calc:eq', raw);
    }

    /* ---------- history ---------- */
    const openMonths = {};
    function renderHist() {
      hist.innerHTML = '';
      const items = allHistory();
      const groups = [];
      items.forEach((h) => {
        const d = new Date(h.t); const key = d.getFullYear() * 100 + d.getMonth();
        let g = groups[groups.length - 1];
        if (!g || g.key !== key) { g = { key, y: d.getFullYear(), m: d.getMonth() + 1, items: [] }; groups.push(g); }
        g.items.push(h);
      });
      const lastKey = groups.length ? groups[groups.length - 1].key : 0;
      const list = el('div.calc-hlist');
      groups.forEach((g) => {
        const isOpen = openMonths[g.key] != null ? openMonths[g.key] : g.key === lastKey || g.items.length <= 2;
        const head = el('button.calc-hgrp' + (isOpen ? '.open' : ''), null, el('span', null, `${g.y}년 ${g.m}월`), el('small', null, `${g.items.length}회`), el('i', { html: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }));
        head.addEventListener('click', () => { sfx('tap'); openMonths[g.key] = !isOpen; renderHist(); });
        list.appendChild(head);
        if (!isOpen) return;
        g.items.forEach((h) => {
          const d = new Date(h.t);
          const row = el('button.calc-hrow' + (h.nightly ? '.night' : ''), null,
            el('small', null, `${d.getMonth() + 1}월 ${d.getDate()}일 (${G.util.WEEK[d.getDay()]}) ${G.util.fmtKTime(d)}`),
            el('span.e', null, fmtExpr(h.expr)),
            el('span.r', null, '=' + resultOf(h)));
          row.addEventListener('click', () => { sfx('tap'); expr = h.expr; justEq = false; toggleHist(false); render(); });
          list.appendChild(row);
        });
      });
      const clr = el('button.calc-hclear', null, '기록 삭제');
      clr.addEventListener('click', () => { sfx('tap'); G.phone.toast('기록을 삭제할 수 없습니다 · 보관함 잠금 사용 중'); });
      hist.append(list, clr);
      requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }
    function toggleHist(on) {
      histOpen = on == null ? !histOpen : on;
      lower.classList.toggle('hist', histOpen);
      histBtn.classList.toggle('on', histOpen);
      histBtn.innerHTML = histOpen
        ? '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 7.5h8M8.5 12h1M11.5 12h1M14.5 12h1M8.5 15.5h1M11.5 15.5h1M14.5 15.5h1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.6V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
      if (histOpen) { renderHist(); G.bus.emit('calc:history'); G.flag('calcHistorySeen', true); }
    }
    histBtn.addEventListener('click', () => { sfx('tap'); toggleHist(); });
    rulerBtn.addEventListener('click', () => { sfx('tap'); G.phone.toast('단위 변환은 네트워크 연결이 필요합니다'); });
    delBtn.addEventListener('click', () => press('⌫'));
    let lp = null;
    delBtn.addEventListener('pointerdown', () => { lp = setTimeout(() => { expr = ''; justEq = false; render(); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => delBtn.addEventListener(ev, () => clearTimeout(lp)));

    /* ---------- desktop keyboard ---------- */
    const KMAP = { '/': '÷', '*': '×', 'x': '×', '-': '−', '+': '+', '%': '%', '.': '.', ',': '.', 'Enter': '=', '=': '=', 'Backspace': '⌫', 'Escape': 'C', 'Delete': 'C' };
    function onKey(e) {
      if (G.phone.top() !== entry || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.kb.in, .notebook.in, .dialog-wrap')) return;
      let k = /^[0-9]$/.test(e.key) ? e.key : KMAP[e.key];
      if (e.key === '(' || e.key === ')') k = '( )';
      if (!k) return;
      e.preventDefault(); press(k);
      const b = pad.querySelector(`[data-k="${CSS.escape(k)}"]`); if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); }
    }
    document.addEventListener('keydown', onKey);

    /* ---------- the vault transition ---------- */
    async function openVaultFx() {
      busy = true;
      exprEl.textContent = '••••'; exprEl.style.fontSize = '52px'; prevEl.textContent = '';
      exprEl.classList.add('dots');
      await sleep(260);
      try { G.fx.glitch(200); } catch (e) {}
      drone();
      await sleep(200);
      const bd = backdrop(scr);
      scr.classList.add('vt-flip-out');
      await sleep(270);
      scr.classList.remove('vt-flip-out');
      expr = ''; justEq = false; exprEl.classList.remove('dots'); render(); busy = false;
      const vs = openVault(scr);
      if (vs && vs.parentNode) vs.parentNode.insertBefore(bd, vs); // black behind the vault while it flips in
      setTimeout(() => bd.remove(), 500);
    }

    render();
    const entry = G.phone.push(scr, { onClose: () => document.removeEventListener('keydown', onKey) });
    if (p.history) toggleHist(true);
    if (p.vault && G.flag('vaultOpen')) openVault(scr);
  }

  // a black card table behind a flipping screen (so the home screen never shows through)
  function backdrop(node) { const bd = el('div.vt-backdrop'); if (node && node.parentNode) node.parentNode.insertBefore(bd, node); return bd; }
  function drone() {
    const A = G.audio;
    try {
      if (!A || !A.ok || !A.ok()) return;
      const t = A.now();
      A.osc('sine', 40, t, 4.2, 0.32, A.bus('sfx'), { a: 1.4, r: 1.6 });
      A.osc('sine', 80.6, t + 0.2, 3.8, 0.07, A.bus('sfx'), { a: 1.6, r: 1.4 });
      A.noise(t, 2.5, 0.04, A.bus('sfx'), { a: 1.2, filters: [{ type: 'lowpass', freq: 180 }] });
    } catch (e) {}
  }

  /* =========================================================
   * 보관함
   * ========================================================= */
  const LOCK = '<svg viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  function fileName(t) { const d = parseT(t); return `REMOTE_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad((d.getDate() * 7) % 60)}.jpg`; }
  function vaultPhoto(f, ph) {
    return {
      id: ph.id, key: ph.key, t: ph.t, folder: f.id, vault: true,
      get src() { return IMG(this.key); },
      info: () => Object.assign(
        { '파일': ph.file || fileName(ph.t), '앨범': `보관함 › ${T(f.name)}`, '기기': VD().info },
        ph.exposure && V().img0606Edited ? { '수정': '편집됨 · 방금 전 · 알 수 없는 기기' } : {}),
      noDelete: '보관함 사진은 관리자만 삭제할 수 있습니다',
      noShare: '보관함 사진은 공유할 수 없습니다',
      onEdit: ph.exposure ? (ctx) => exposureEditor(ctx.photo) : null,
      onView: () => {
        if (f.id === 'me') { G.flag('vaultSeen', true); note(f.note); }
        if (ph.note) note(ph.note);
        if (ph.exposure) G.bus.emit('vault:0606');
      },
    };
  }
  VLT.photoById = function (id) {
    if (!G.flag('vaultOpen')) return null;
    for (const f of VD().folders) { const ph = f.photos.find((x) => x.id === id); if (ph) return vaultPhoto(f, ph); }
    return null;
  };
  const totalCount = () => VD().folders.reduce((a, f) => a + (f.count || f.photos.length), 0);

  function openVault(calcScr) {
    const first = !G.flag('vaultOpen');
    G.flag('vaultOpen', true);
    if (first) { note('계산기 안에 사진이 숨겨져 있었다. 보관함.'); }
    G.bus.emit('vault:open');
    const body = el('div.vt-home');
    const scr = G.ui.screen({ title: '보관함', sub: `사진 ${totalCount()}장 · 마지막 업로드 ${VD().lastUpload}`, theme: 'dark', cls: 'vt-screen', body,
      right: [el('button.vt-more', { 'aria-label': '더 보기', html: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/></svg>', onclick: () => G.phone.toast('관리자 기기에서만 설정을 바꿀 수 있습니다') })] });
    scr.querySelector('.sv-title').prepend(el('span.vt-lock', { html: LOCK }));
    function render() {
      body.innerHTML = '';
      body.appendChild(el('div.vt-sync', null, el('i'), el('span', null, '원격 동기화 · SM-G991N'), el('small', null, '연결됨')));
      const g = el('div.vt-folders');
      VD().folders.forEach((f) => {
        const cover = f.photos[0];
        const b = el('button.vt-folder', null,
          el('div.vt-cover', { style: { backgroundImage: cover ? `url("${IMG(cover.key)}")` : 'none' } }, f.id === 'etc' ? el('div.vt-cover2', { style: { backgroundImage: `url("${IMG(f.photos[1].key)}")` } }) : null),
          el('div.vt-fname', null, T(f.name)),
          el('div.vt-fcount', null, `${f.count || f.photos.length}`));
        b.addEventListener('click', () => { sfx('tap'); openFolder(f); });
        g.appendChild(b);
      });
      body.appendChild(g);
      body.appendChild(el('div.vt-foot', null, '이 보관함은 다른 기기와 공유되고 있습니다.'));
    }
    render();
    let leaving = false;
    G.phone.push(scr, {
      anim: 'none',
      onBack: () => {
        if (leaving) return true; leaving = true;
        const bd = backdrop(scr);
        scr.classList.add('vt-flip-out');
        sfx('whoosh');
        setTimeout(() => {
          if (calcScr && calcScr.parentNode) calcScr.parentNode.insertBefore(bd, calcScr); // now behind the calculator
          G.phone.pop(true);
          if (calcScr && calcScr.isConnected) { calcScr.classList.add('vt-flip-in'); setTimeout(() => calcScr.classList.remove('vt-flip-in'), 440); }
          setTimeout(() => bd.remove(), 460);
        }, 260);
        return true;
      },
    });
    scr.classList.add('vt-flip-in');
    setTimeout(() => scr.classList.remove('vt-flip-in'), 450);
    return scr;
  }
  VLT.open = function () { G.phone.openApp('calculator'); setTimeout(() => openVault(G.phone.top() && G.phone.top().node), 50); };

  function openFolder(f) {
    G.flag('vaultSeen', true);
    if (f.note && f.id !== 'me') note(f.note);
    G.bus.emit('vault:folder', f.id);
    const list = f.photos.map((ph) => vaultPhoto(f, ph));
    const body = el('div.vt-folderbody');
    const g = el('div.gal-grid.vt-grid');
    list.forEach((p) => {
      const c = el('button.gal-cell.vt-cell', { style: { backgroundImage: `url("${p.src}")` }, 'aria-label': p.id }, el('span.vt-cell-t', null, p.t.slice(2, 10).replace(/-/g, '.')));
      if (p.id === 'IMG_0606') c.appendChild(el('span.vt-cell-n', null, 'IMG_0606'));
      c.addEventListener('click', () => { sfx('tap'); G.gallery.viewer(list, p, { cls: 'vt-viewer' }); });
      g.appendChild(c);
    });
    if (f.count && f.count > list.length) {
      const more = el('button.gal-cell.vt-cell.more', null, el('span', { html: LOCK }), el('b', null, `+${f.count - list.length}`));
      more.addEventListener('click', () => { sfx('tap'); G.phone.toast('SM-G991N에만 저장된 사진입니다'); });
      g.appendChild(more);
    }
    body.appendChild(g);
    if (f.more) body.appendChild(el('div.vt-foot', null, f.more));
    const scr = G.ui.screen({ title: T(f.name), sub: `사진 ${f.count || list.length}장`, theme: 'dark', cls: 'vt-screen', body });
    G.phone.push(scr);
    if (f.id === 'me') setTimeout(() => note(f.note), 400);
  }

  /* =========================================================
   * IMG_0606 — 편집 › 노출 (canvas + custom slider) — fragment 06 + JS1
   * ========================================================= */
  function loadImg(src) { const i = new Image(); i.decoding = 'async'; i.src = src; return i; }
  const ready = (i) => i && i.complete && i.naturalWidth > 0;
  function exposureEditor(photo) {
    const X = VD().exposure;
    const imCard = loadImg(IMG('shaft_card_dark'));
    const imFace = loadImg(IMG('shaft_face_dark'));
    const imFig = loadImg(IMG('fig_cap'));
    const cv = el('canvas.ex-cv'), cvFace = el('canvas.ex-cv.face'), grain = el('canvas.ex-grain');
    const banner = el('div.ex-banner', null, el('i', { html: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' }), el('span'));
    const stage = el('div.ex-stage', null, cv, cvFace, grain, banner);
    let e = 0, bri = 0, con = 0, mode = 'exp', dead = false, js1Running = false, faceOn = false, shoulderA = 0;
    const sExp = G.gallery.slider({ label: '노출', min: 0, max: 100, value: 0, fmt: (v) => String(Math.round(v)), onInput: (v, user) => { if (user) onExp(v / 100); } });
    const sBri = G.gallery.slider({ label: '밝기', min: -100, max: 100, value: 0, center: true, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v), onInput: (v) => { bri = v; applyFilter(); } });
    const sCon = G.gallery.slider({ label: '대비', min: -100, max: 100, value: 0, center: true, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v), onInput: (v) => { con = v; applyFilter(); } });
    const holder = el('div.ex-slider');
    const tabs = el('div.ex-tabs');
    const TABS = [['exp', '노출', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/></svg>'],
      ['bri', '밝기', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'],
      ['con', '대비', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v16M12 8h5M12 12h7M12 16h5" stroke="currentColor" stroke-width="1.4"/></svg>']];
    function renderTabs() {
      tabs.innerHTML = '';
      TABS.forEach(([k, l, ic]) => { const b = el('button.ex-tab' + (mode === k ? '.on' : ''), { html: ic + `<span>${l}</span>` }); b.addEventListener('click', () => { sfx('tap'); mode = k; renderTabs(); mountSlider(); }); tabs.appendChild(b); });
    }
    function mountSlider() { holder.innerHTML = ''; holder.appendChild({ exp: sExp, bri: sBri, con: sCon }[mode].node); }
    const cancelB = el('button.ex-hbtn', null, '취소'), doneB = el('button.ex-hbtn.done', null, '완료');
    const head = el('div.ex-head', null, cancelB, el('b', null, '편집'), doneB);
    const node = el('section.ex-screen', { dataset: { status: 'dark', theme: 'dark' } }, head, stage, holder, tabs);
    renderTabs(); mountSlider();

    const gain = (x) => 1 + 17 * Math.pow(Math.max(0, x), 1.6);
    function applyFilter() {
      const b = gain(e) * (1 + bri / 260);
      const c = 1 + con / 140;
      const f = `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)})`;
      cv.style.filter = f; cvFace.style.filter = f;
      // amplified sensor noise: strong while the picture is still unreadable (0–55 %), fades once the wall appears
      const nz = e < X.noiseEnd ? 0.07 + 0.33 * Math.sin(Math.min(1, e / X.noiseEnd) * Math.PI * 0.85) : 0.12 - 0.06 * clamp((e - X.noiseEnd) / 0.45, 0, 1);
      grain.style.opacity = nz.toFixed(3);
      const sa = clamp((e - X.shoulderFrom) / (X.js1At - X.shoulderFrom), 0, 1);
      if (Math.abs(sa - shoulderA) > 0.02 || (sa === 0) !== (shoulderA === 0)) { shoulderA = sa; draw(); }
    }
    /* ---------- canvas ---------- */
    let box = { x: 0, y: 0, w: 1, h: 1 }, sil = null;
    function size() {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      [cv, cvFace].forEach((c) => { c.width = Math.max(2, Math.round(r.width * dpr)); c.height = Math.max(2, Math.round(r.height * dpr)); });
      const iw = 1024, ih = 1536, s = Math.min(cv.width / iw, cv.height / ih);
      box = { w: iw * s, h: ih * s, x: (cv.width - iw * s) / 2, y: (cv.height - ih * s) / 2 };
      draw(); drawFace();
    }
    function silhouette() {
      if (sil || !ready(imFig)) return sil;
      try {
        // his cap, shoulder and body as a pure black cut-out (it reads against the faint back-light below)
        const c = document.createElement('canvas'); c.width = 300; c.height = 420;
        const x = c.getContext('2d');
        x.drawImage(imFig, 110, 20, 300, 420, 0, 0, 300, 420);
        x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, 300, 420);
        sil = c;
      } catch (er) { sil = null; }
      return sil;
    }
    function draw() {
      const x = cv.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
      if (ready(imCard)) x.drawImage(imCard, box.x, box.y, box.w, box.h);
      // 78–92 %: a shoulder at the right edge (dark mass occluding the lit wall, faint rim)
      const s = shoulderA > 0 ? silhouette() : null;
      if (s && !V().js1Spent) {
        const dw = box.w * 0.62, dh = dw * (420 / 300);
        const dx = box.x + box.w * 0.78, dy = box.y + box.h * 0.19;
        x.save();
        // a faint light leaking in from the right (raw ≈ 3, lifted by the exposure gain) …
        const cx = box.x + box.w * 1.0, cy = dy + dh * 0.28, r = box.w * 0.42;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(4,4,3,1)'); g.addColorStop(0.6, 'rgba(2,2,2,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.globalAlpha = shoulderA; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
        // … cut by the black shape of a cap and a shoulder, right in front of the lens
        x.drawImage(s, dx, dy, dw, dh);
        x.restore();
      }
    }
    function drawFace() {
      const x = cvFace.getContext('2d');
      x.clearRect(0, 0, cvFace.width, cvFace.height);
      if (ready(imFace)) { x.fillStyle = '#000'; x.fillRect(0, 0, cvFace.width, cvFace.height); x.drawImage(imFace, box.x, box.y, box.w, box.h); }
    }
    [imCard, imFace, imFig].forEach((i) => i.addEventListener('load', () => { draw(); drawFace(); }));
    /* ---------- grain ---------- */
    grain.width = 180; grain.height = 270;
    const gx = grain.getContext('2d');
    let grainT = null;
    function grainTick() {
      const img = gx.createImageData(180, 270); const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = (Math.random() ** 1.6) * 255; d[i] = v * 0.95; d[i + 1] = v; d[i + 2] = v * 0.9; d[i + 3] = 255; }
      gx.putImageData(img, 0, 0);
    }
    grainTick(); grainT = setInterval(() => { if (!document.hidden) grainTick(); }, 90);

    /* ---------- exposure logic ---------- */
    let fragTimer = null, lastE = 0;
    function onExp(x) {
      if (dead || js1Running) return;
      const prev = lastE; lastE = x; e = x;
      applyFilter();
      // fragment ③: ≥60 % held for 1 s
      if (e >= X.fragAt && !G.flag('frag06')) { if (!fragTimer) fragTimer = setTimeout(registerFrag, X.fragHoldMs); }
      else if (fragTimer) { clearTimeout(fragTimer); fragTimer = null; }
      // JS1: the first crossing above 92 %
      if (prev <= X.js1At && e > X.js1At && !V().js1Spent && G.flag('M2') && G.clock.playMinutes() >= 8) js1();
    }
    function registerFrag() {
      fragTimer = null;
      if (G.flag('frag06')) return;
      const ok = G.foundFragment ? G.foundFragment('06') : (G.flag('frag06', true), true);
      if (ok) { note(VD().fragNote); G.bus.emit('vault:fragment'); }
    }
    function showBanner(text, ms) {
      banner.querySelector('span').textContent = text;
      banner.classList.add('in');
      if (ms) setTimeout(() => banner.classList.remove('in'), ms);
    }
    function animateTo(target, ms, ease) {
      return new Promise((res) => {
        const from = e, t0 = performance.now();
        const step = (now) => {
          const k = clamp((now - t0) / ms, 0, 1);
          const v = from + (target - from) * ease(k);
          e = clamp(v, 0, 1); sExp.set(e * 100, true); applyFilter();
          if (k < 1 && !closed) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    const easeIn = (k) => k * k;
    const easeOutBack = (k) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
    async function js1() {
      const mode = G.settings.scares === 'off' ? 'off' : G.settings.scares === 'light' ? 'light' : 'full';
      js1Running = true; dead = true;
      V().js1Spent = true; V().js1At = Date.now(); G.save();
      try { G.director && G.director.hold && G.director.hold('js1', true); } catch (er) {}
      sExp.lock(true);
      if (fragTimer) { clearTimeout(fragTimer); fragTimer = null; }
      G.bus.emit('vault:js1', mode);
      const A = G.audio;
      if (mode === 'full') {
        try { A.silenceDrop && A.silenceDrop(60); } catch (er) {}
        sfx('stingJS1');
        await animateTo(1, 900, easeIn);           // the slider keeps moving on its own
        await sleep(80);
        faceOn = true; cvFace.style.transition = 'none'; cvFace.style.opacity = '1';
        if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate([0, 80, 40, 300]); } catch (er) {}
        try { G.fx.shake(300, 10); } catch (er) {}
        await sleep(450);
        cvFace.style.opacity = '0'; faceOn = false;
      } else if (mode === 'light') {
        try { A.sfx.heartbeat && A.sfx.heartbeat(58, 4); } catch (er) {}
        await animateTo(1, 1400, easeIn);
        cvFace.style.transition = 'opacity 1.3s ease-in'; cvFace.style.opacity = '0.85';
        await sleep(1900);
        cvFace.style.transition = 'opacity .9s'; cvFace.style.opacity = '0';
        await sleep(500);
      } else {
        await sleep(600);
      }
      V().img0606Edited = true; G.save();
      showBanner('알 수 없는 기기에서 편집 중…');
      try { A && A.sfx && A.sfx.keyErase && A.sfx.keyErase(); } catch (er) {}
      await animateTo(0, mode === 'full' ? 350 : 900, mode === 'full' ? easeOutBack : (k) => 1 - Math.pow(1 - k, 3));
      lastE = 0;
      showBanner('편집 완료 · 다른 기기', 1800);
      await sleep(1200);                             // input dead 1.2 s
      dead = false; js1Running = false; sExp.lock(false);
      try { G.director && G.director.hold && G.director.hold('js1', false); } catch (er) {}
      // the card was on screen ≥60 % well over a second
      if (!G.flag('frag06')) setTimeout(registerFrag, 600);
    }

    /* ---------- mount ---------- */
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      clearInterval(grainT); if (fragTimer) clearTimeout(fragTimer);
      ro.disconnect();
      G.phone.pop();
    }
    cancelB.addEventListener('click', () => { if (!js1Running) { sfx('tap'); close(); } });
    doneB.addEventListener('click', () => { if (!js1Running) { sfx('tap'); G.phone.toast(V().img0606Edited ? '저장할 수 없습니다 · 다른 기기에서 편집 중' : '보관함 사진은 원본만 저장됩니다'); close(); } });
    stage.addEventListener('contextmenu', (ev) => ev.preventDefault());
    G.phone.push(node, { anim: 'fade', onBack: () => { if (js1Running) return true; close(); return true; }, onClose: () => { closed = true; clearInterval(grainT); } });
    const ro = new ResizeObserver(() => size()); ro.observe(stage);
    applyFilter();
    G.bus.emit('vault:exposure');
    return node;
  }
  VLT.exposure = exposureEditor;
})();
