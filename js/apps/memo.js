/* =========================================================
 * 메모 (DESIGN P3 / P4 / H4, §4.2; client override: no shake → ↶ / ⋯ / 3-finger / Ctrl+Z)
 *  - list: 🔒 이 폰을 찾은 사람에게 · 장보기 · 음향학 과제 메모 · 비번들
 *  - P3 lock: password field (forced English layout + jamo legends). 'kongi' → '그건 너무 쉽잖아 ㅋ'.
 *    zhddl → flags P3 (+ memo_letter, memoUnlocked).
 *  - P4: at 6 s (or when ¶3 is scrolled up) a red remote caret erases the letter from the end
 *    (banner '✎ 알 수 없는 기기에서 편집 중…') down to title + 2 lines → '편집 완료 · 다른 기기'.
 *    Undo (↶ · ⋯ › 실행 취소 · three-finger swipe left · Ctrl/Cmd+Z) → '실행 취소: 삭제' →
 *    reverse rewind; his inserted line passes in a heavier weight and erases itself; he types
 *    a reaction that deletes itself; memo pinned '📌 이 기기에 고정됨'. Flags P4 + M2.
 *    Auto-hint (notebook T1) 45 s after the erase finished.
 *  - page 2 (H4): '→ 🔒 2쪽' chip; any input containing 옷장 → flag acrostic + notebook note.
 * Hooks provided: 'memo:startErase'. Bus: memo:open, memo:fail, memo:erase('start'|'done'),
 * memo:undo, memo:restored. Saved: vars.memoState ('erased'|'restored'), vars.memoErasedTo.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const T = (s) => (G.T ? G.T(s) : s);
  const V = () => G.state.vars;
  const LT = () => G.STORY.memoLetter;

  /* ---------- small helpers / core shims ---------- */
  function sfx(name, ...a) { try { const f = G.audio && G.audio.sfx && G.audio.sfx[name]; if (f) return f(...a); } catch (e) {} return undefined; }
  const keyErase = () => (G.audio && G.audio.sfx && G.audio.sfx.keyErase ? sfx('keyErase') : sfx('key'));
  function rewTick(vol) {
    // reversed key click (envelope swells into the click) — "reverse click buffer"
    const A = G.audio; if (!A || !A.ok || !A.ok() || !A.noise) return;
    try { const t = A.now(); A.noise(t, 0.032, vol || 0.07, A.bus('ui'), { a: 0.028, filters: [{ type: 'bandpass', freq: 3600, Q: 1.1 }] }); } catch (e) {}
  }
  function vibrate(p) { if (G.settings && G.settings.vibration !== false && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
  function parseT(t) {
    if (G.chat && G.chat.parseT) return G.chat.parseT(t);
    const m = String(t || '').match(/(\d+)-(\d+)-(\d+)(?:[ T](\d+):(\d+))?/);
    return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  function fmtD(d) { return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : ''; }
  function fmtDT(d) { return d ? `${fmtD(d)} ${G.util.fmtKTime(d)}` : ''; }
  function svg(p, vb) { return `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${p}</svg>`; }
  const ICON = {
    lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.7" class="shackle"/>'),
    undo: svg('<path d="M9 7L4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9.5a5 5 0 010 10H11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    redo: svg('<path d="M15 7l4.5 4.5L15 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11.5H9.5a5 5 0 000 10H13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    more: svg('<circle cx="5.5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18.5" cy="12" r="1.8" fill="currentColor"/>'),
    pin: svg('<path d="M14.5 3.5l6 6-2.2.8-3.8 3.8.4 4.4-1.6 1.6-4-4-4.8 4.8-.9-.9 4.8-4.8-4-4 1.6-1.6 4.4.4 3.8-3.8z" fill="currentColor"/>'),
    pen: svg('<path d="M4 20l1-4.2L15.6 5.2a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.2 19 4 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  };
  function unlocked() { return G.flag('P3') || G.flag('memo_letter') || G.flag('memoUnlocked'); }
  function restored() { return G.flag('M2') || V().memoState === 'restored'; }
  let live = null; // the open letter view controller

  /* =========================================================
   * App + list
   * ========================================================= */
  G.app('memo', {
    name: '메모',
    icon: G.ICONS.memo,
    open(p) {
      const wrap = el('div.mm-list');
      const scr = G.ui.screen({ title: '메모', cls: 'mm-screen', body: wrap });
      scr.dataset.status = 'dark';
      function render() {
        wrap.innerHTML = '';
        const all = (G.STORY.memos || []).filter((m) => !m.show || m.show());
        const pinnedId = restored() ? 'letter' : null;
        const list = all.slice().sort((a, b) => (a.id === pinnedId ? -1 : b.id === pinnedId ? 1 : +parseT(b.t) - +parseT(a.t)));
        wrap.appendChild(el('div.mm-count', null, `메모 ${list.length}개`));
        list.forEach((m) => wrap.appendChild(card(m, m.id === pinnedId)));
      }
      render();
      G.phone.push(scr, { onResume: render });
      if (p && p.memo) { const m = (G.STORY.memos || []).find((x) => x.id === p.memo); if (m) openMemo(m); }
    },
  });

  function card(m, pinned) {
    const isLetter = m.special === 'letter';
    const locked = isLetter && !unlocked();
    const d = parseT(m.t);
    let preview = '';
    if (locked) preview = '잠긴 메모';
    else if (isLetter) preview = restored() ? T(LT().page1).split('\n').filter(Boolean).slice(1, 3).join(' ') : (V().memoState === 'erased' ? LT().keep.split('\n').filter(Boolean).slice(1).join(' ') : T(LT().page1).split('\n').filter(Boolean).slice(1, 3).join(' '));
    else if (m.checklist) preview = m.checklist.join(' · ');
    else preview = T(m.body || '').replace(/\s+/g, ' ');
    const meta = isLetter && V().memoState === 'erased' && !restored() ? '수정됨 · 다른 기기' : fmtD(d);
    const c = el('button.mm-card' + (locked ? '.locked' : '') + (pinned ? '.pinned' : ''), { 'aria-label': (locked ? '잠긴 메모 ' : '') + T(m.title) },
      el('div.mm-card-top', null,
        locked ? el('span.mm-ic.mm-ic-lock', { html: ICON.lock }) : null,
        pinned ? el('span.mm-ic.mm-ic-pin', { html: ICON.pin }) : null,
        el('span.mm-card-t', null, T(m.title))),
      el('div.mm-card-p', null, preview),
      el('div.mm-card-d', null, pinned ? '이 기기에 고정됨 · ' + fmtD(d) : meta));
    c.addEventListener('click', () => { sfx('tap'); openMemo(m); });
    return c;
  }

  function openMemo(m) {
    G.state.seen['memo:' + m.id] = true; G.save();
    if (m.special === 'letter') { if (!unlocked()) return lockScreen(); return letterView(); }
    simpleView(m);
  }

  function simpleView(m) {
    const d = parseT(m.t);
    const doc = el('div.mm-doc');
    doc.appendChild(el('div.mm-meta', null, fmtDT(d)));
    doc.appendChild(el('h2.mm-h', null, T(m.title)));
    if (m.checklist) doc.appendChild(el('div.mm-check', null, m.checklist.map((x) => el('div.mm-ci', null, el('i'), el('span', null, T(x))))));
    else doc.appendChild(el('div.mm-text', null, T(m.body || '')));
    const scr = G.ui.screen({ title: '', cls: 'mm-screen mm-view', body: doc });
    scr.dataset.status = 'dark';
    G.phone.push(scr);
    G.bus.emit('memo:open', m.id);
  }

  /* =========================================================
   * P3 — lock screen
   * ========================================================= */
  function lockScreen() {
    const L = LT().lock;
    let fails = 0;
    const err = el('div.mm-err', { 'aria-live': 'polite' });
    const tip = el('div.mm-tip', null, el('small', null, '세아의 메시지'), el('span', null, L.tooEasyMsg));
    const field = G.ui.field({ placeholder: '비밀번호', password: true, showJamo: true, submitLabel: '확인', maxLength: 24, onSubmit: (v) => check(v) });
    const langPill = el('button.mm-lang', { 'aria-label': '입력 언어: 영문' }, 'A');
    langPill.addEventListener('click', () => { sfx('error'); shake(); err.textContent = L.onlyLatin; });
    const lockIc = el('div.mm-lockic', { html: ICON.lock });
    const box = el('div.mm-lockbox', null,
      lockIc,
      el('div.mm-lock-t', null, T(LT().title)),
      el('div.mm-lock-s', null, '잠긴 메모입니다. 비밀번호를 입력하세요.'),
      el('div.mm-hintpill', null, el('b', null, '힌트'), el('span', null, L.hint)),
      el('div.mm-fieldrow', null, field.node, langPill),
      tip, err,
      el('button.mm-btn', { onclick: () => check(field.value) }, '확인'));
    const scr = G.ui.screen({ title: '잠긴 메모', cls: 'mm-screen mm-lockscr', body: box });
    scr.dataset.status = 'dark';
    // desktop: a Korean IME sends 'Process' keys — map by physical key code like a real password field
    const onKey = (e) => {
      if (!field.node.classList.contains('focus') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'Process' && e.keyCode !== 229) return;
      const m = /^Key([A-Z])$/.exec(e.code || '');
      if (!m) return;
      e.preventDefault();
      field.seq.push(e.shiftKey ? m[1] : m[1].toLowerCase()); field.update();
    };
    document.addEventListener('keydown', onKey, true);
    G.phone.push(scr, { onClose: () => document.removeEventListener('keydown', onKey, true) });
    setTimeout(() => field.focus(), 380);
    function shake() { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
    async function check(v) {
      const nv = G.util.normalize(v).replace(/[^a-z0-9ㄱ-ㅣ가-힣-]/g, '');
      if (!nv) { shake(); return; }
      if (L.answers.includes(nv)) {
        G.ui.hideKeyboard();
        err.textContent = ''; tip.classList.remove('in');
        sfx('unlock');
        lockIc.classList.add('open'); box.classList.add('ok');
        G.flag('memo_letter', true); G.flag('memoUnlocked', true); G.flag('P3', true);
        G.notebook && G.notebook.note && G.notebook.note("메모 비밀번호: '콩이'를 영어 자판 그대로 → zhddl", { silent: true });
        await sleep(520);
        G.phone.pop(true);
        letterView();
        return;
      }
      fails++;
      sfx('error'); vibrate(90); shake();
      err.textContent = fails > 1 ? `${L.wrong} (${fails}회)` : L.wrong;
      tip.classList.toggle('in', L.tooEasy.includes(nv));
      G.bus.emit('memo:fail', { id: 'letter', value: v, fails });
      field.clear();
    }
  }

  /* =========================================================
   * P4 — the letter view (erase → undo → pinned), page 2 (H4)
   * ========================================================= */
  function letterView() {
    const L = LT();
    const P1 = T(L.page1);
    const KEEP = T(L.keep).length;
    const HIS = '\n' + T(L.hisLine);
    const INS = P1.indexOf(T(L.hisAfter)) + T(L.hisAfter).length;
    const st = { alive: true, timers: [], n: P1.length, phase: 'fresh', dialog: false, raf: 0 };
    if (restored()) st.phase = 'restored';
    else if (V().memoState === 'erased') { st.phase = 'erased'; st.n = Math.max(KEEP, Math.min(P1.length, V().memoErasedTo || KEEP)); }

    // ---- DOM ----
    const banner = el('div.mm-banner', { 'aria-live': 'polite' }, el('span.mm-bn-ic'), el('span.mm-bn-t'));
    const bnWrap = el('div.mm-bnwrap', null, banner);
    const metaD = el('span.mm-meta-d', null, fmtDT(parseT(L.t)));
    const metaS = el('span.mm-meta-s');
    const meta = el('div.mm-meta', null, metaD, metaS);
    const textBox = el('div.mm-text.mm-letter-text');
    const page2Box = el('div.mm-p2wrap');
    const doc = el('div.mm-doc.mm-letter', null, meta, textBox, page2Box);
    const undoBtn = el('button.mm-tb', { 'aria-label': '실행 취소', html: ICON.undo });
    const redoBtn = el('button.mm-tb', { 'aria-label': '다시 실행', html: ICON.redo, disabled: true });
    const moreBtn = el('button.mm-tb', { 'aria-label': '더보기', html: ICON.more });
    const body = el('div.mm-letter-body', null, bnWrap, doc);
    const scr = G.ui.screen({ title: '', cls: 'mm-screen mm-view mm-letterscr', body, right: [undoBtn, redoBtn, moreBtn] });
    scr.dataset.status = 'dark';
    const scroller = () => scr.body;

    // live text: a | his | b + caret
    const sa = document.createTextNode('');
    const hisEl = el('span.mm-his');
    const sb = document.createTextNode('');
    const caret = el('span.mm-caret', { dataset: { who: T(L.caretFlag) } });

    function setBanner(kind) {
      banner.className = 'mm-banner' + (kind ? ' on ' + kind : '');
      bnWrap.classList.toggle('on', !!kind);
      const text = kind ? L.banners[kind] : '';
      banner.querySelector('.mm-bn-t').textContent = text;
      // the design texts for editing/rewind/pinned carry their own glyph (✎ ↶ 📌); add an icon only when they don't
      banner.querySelector('.mm-bn-ic').innerHTML = kind && /^[\u0000-\u024F\uAC00-\uD7A3]/.test(text) ? ICON.pen : '';
    }
    function setMeta() {
      if (st.phase === 'restored') { metaS.textContent = ''; metaS.className = 'mm-meta-s'; }
      else if (st.phase === 'erased') { metaS.textContent = '수정됨 · 방금 · 다른 기기에서'; metaS.className = 'mm-meta-s warn'; }
      else if (st.phase === 'erasing') { metaS.textContent = '다른 기기에서 편집 중'; metaS.className = 'mm-meta-s warn'; }
      else { metaS.textContent = ''; metaS.className = 'mm-meta-s'; }
      undoBtn.classList.toggle('ready', st.phase === 'erased' || st.phase === 'erasing');
      undoBtn.disabled = st.phase === 'restored' || st.phase === 'rewinding' || st.phase === 'reacting';
    }
    function liveMode() {
      textBox.innerHTML = ''; page2Box.innerHTML = '';
      textBox.append(sa, hisEl, sb, caret);
    }
    function setLive(n, hisN, caretAt) {
      sa.data = P1.slice(0, Math.min(n, INS));
      hisEl.textContent = HIS.slice(0, hisN || 0);
      sb.data = n > INS ? P1.slice(INS, n) : '';
      // caret position: 'a' (after sa), 'his' (after his), 'b' (after sb)
      if (caretAt === 'his') textBox.insertBefore(caret, sb); else textBox.appendChild(caret);
      if (caretAt === 'a') textBox.insertBefore(caret, hisEl);
    }
    function finalMode() {
      textBox.innerHTML = ''; page2Box.innerHTML = '';
      const line = T(L.page2Line);
      const i = P1.indexOf(line);
      if (i < 0) { textBox.textContent = P1; } else {
        textBox.append(document.createTextNode(P1.slice(0, i + line.length) + '  '));
        const chip = el('button.mm-p2chip', { 'aria-label': '2쪽 열기' }, '→ ', G.flag('acrostic') ? '' : el('span.mm-p2lock', { html: ICON.lock }), '2쪽');
        chip.addEventListener('click', () => { sfx('tap'); openPage2(); });
        textBox.append(chip, document.createTextNode(P1.slice(i + line.length)));
      }
      const pc = el('button.mm-p2card' + (G.flag('acrostic') ? '.open' : ''), null,
        el('span.mm-p2-ic', { html: G.flag('acrostic') ? ICON.pen : ICON.lock }),
        el('span.mm-p2-main', null, el('b', null, '2쪽'), el('small', null, G.flag('acrostic') ? '열림 · 세아가 남긴 다음 장' : '잠긴 페이지 · ' + L.page2Lock.prompt)),
        el('span.mm-p2-go', { html: svg('<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/>') }));
      pc.addEventListener('click', () => { sfx('tap'); openPage2(); });
      page2Box.appendChild(pc);
    }
    function freshMode() { textBox.innerHTML = ''; page2Box.innerHTML = ''; sa.data = P1; textBox.append(sa); }

    // ---- caret follow (smooth auto-scroll) ----
    function follow() {
      cancelAnimationFrame(st.raf);
      const step = () => {
        if (!st.alive || !st.following) return;
        const sc = scroller(); if (!sc) return;
        const cr = caret.getBoundingClientRect(), sr = sc.getBoundingClientRect();
        if (cr.height) {
          const target = sr.top + sr.height * 0.52;
          const dy = cr.top - target;
          if (Math.abs(dy) > 2) sc.scrollTop += dy * 0.16;
        }
        st.raf = requestAnimationFrame(step);
      };
      st.following = true;
      st.raf = requestAnimationFrame(step);
    }
    function stopFollow() { st.following = false; cancelAnimationFrame(st.raf); }
    const wait = (ms) => new Promise((r) => { const t = setTimeout(r, ms); st.timers.push(t); });

    // ---- phases ----
    async function startErase() {
      if (st.phase !== 'fresh' || !st.alive) return false;
      st.phase = 'erasing';
      V().memoState = 'erased'; V().memoErasedTo = KEEP; G.save();
      setBanner('editing'); setMeta();
      liveMode(); caret.className = 'mm-caret red live'; setLive(st.n, 0, 'b');
      vibrate([30, 40, 30]);
      G.bus.emit('memo:erase', 'start');
      G.notebook && G.notebook.note && G.notebook.note('누가 지금 이 메모를 지우고 있다. 다른 기기에서.', { silent: true });
      follow();
      const t0 = Date.now(); let lastVib = Date.now();
      while (st.alive && st.phase === 'erasing' && st.n > KEEP) {
        const el2 = Date.now() - t0;
        let k = 1;
        if (el2 > 3800) { // held backspace: word by word, then line chunks
          const max = el2 > 10000 ? 12 : 6;
          const s = P1.slice(Math.max(KEEP, st.n - max), st.n);
          const cut = Math.max(s.lastIndexOf(' '), s.lastIndexOf('\n'));
          k = cut > 0 ? s.length - cut : s.length;
        }
        const from = Math.max(KEEP, st.n - k);
        const removed = P1.slice(from, st.n);
        st.n = from;
        setLive(st.n, 0, 'b');
        keyErase();
        if (removed.includes('\n') && Date.now() - lastVib > 1300) { vibrate(22); lastVib = Date.now(); }
        await wait(72);
      }
      if (!st.alive || st.phase !== 'erasing') return true;
      finishErase();
      return true;
    }
    function finishErase() {
      st.phase = 'erased';
      V().memoState = 'erased'; V().memoErasedTo = st.n; G.save();
      setBanner('done'); setMeta();
      caret.className = 'mm-caret red idle';
      setTimeout(() => { if (st.phase === 'erased') { caret.className = 'mm-caret gone'; stopFollow(); } }, 1600);
      G.bus.emit('memo:erase', 'done');
      armAutoHint();
    }
    function armAutoHint() {
      clearTimeout(st.hintT);
      st.hintT = setTimeout(() => { if (st.alive && st.phase === 'erased' && G.notebook && G.notebook.autoHint) G.notebook.autoHint('P4'); }, 45000);
      st.timers.push(st.hintT);
    }

    async function requestUndo() {
      if (!st.alive || st.dialog) return;
      if (st.phase === 'fresh' || st.phase === 'restored') { sfx('error'); G.phone.toast(st.phase === 'restored' ? '실행 취소할 항목이 없습니다 · 이 기기에 고정됨' : '실행 취소할 항목이 없습니다'); return; }
      if (st.phase !== 'erasing' && st.phase !== 'erased') return;
      if (st.phase === 'erasing') { finishErase(); await sleep(250); }
      st.dialog = true;
      sfx('tap');
      const ok = await G.phone.dialog({ title: L.undoTitle, buttons: [{ label: '취소', value: false }, { label: '실행 취소', value: true, style: 'primary' }] });
      st.dialog = false;
      if (!ok || !st.alive || st.phase !== 'erased') return;
      rewind();
    }

    async function rewind() {
      st.phase = 'rewinding';
      clearTimeout(st.hintT);
      G.bus.emit('memo:undo');
      setBanner('rewind'); setMeta();
      liveMode(); caret.className = 'mm-caret blue live';
      setLive(st.n, 0, 'b');
      sfx('whoosh');
      follow();
      await wait(380);
      let step = 0;
      while (st.alive && st.n < P1.length) {
        step++;
        const k = Math.min(9, 2 + Math.floor(step / 14));
        let to = Math.min(P1.length, st.n + k);
        if (st.n < INS && to >= INS && !st.hisDone) {
          st.n = INS; setLive(st.n, 0, 'a'); rewTick();
          await hisPass();
          if (!st.alive) return;
          continue;
        }
        st.n = to;
        setLive(st.n, 0, st.n <= INS ? 'a' : 'b');
        rewTick();
        await wait(42);
      }
      if (!st.alive) return;
      if (!st.hisDone) { st.n = P1.length; await hisPass(); if (!st.alive) return; }
      setLive(P1.length, 0, 'b');
      await wait(700);
      await reaction();
    }
    async function hisPass() {
      // his line: restored by the rewind (heavier), a beat, then his typing is undone letter by letter
      for (let h = 1; h <= HIS.length && st.alive; h++) { setLive(st.n, h, 'his'); rewTick(0.05); await wait(30); }
      if (!st.alive) return;
      try { G.audio && G.audio.silenceDrop && G.audio.silenceDrop(90); } catch (e) {}
      caret.className = 'mm-caret red live';
      await wait(1150);
      for (let h = HIS.length - 1; h >= 0 && st.alive; h--) { setLive(st.n, h, 'his'); keyErase(); await wait(h > HIS.length - 4 ? 140 : 82); }
      st.hisDone = true;
      caret.className = 'mm-caret blue live';
      await wait(260);
    }
    async function reaction() {
      st.phase = 'reacting'; setMeta();
      const R = '\n\n' + T(L.reaction);
      const tail = el('span.mm-his.mm-react');
      textBox.insertBefore(tail, caret);
      textBox.appendChild(caret);
      caret.className = 'mm-caret red live';
      setBanner('editing');
      vibrate([30, 40, 30]);
      for (let i = 1; i <= R.length && st.alive; i++) { tail.textContent = R.slice(0, i); if (R[i - 1] !== '\n') sfx('key'); await wait(R[i - 1] === '\n' ? 60 : 150); }
      if (!st.alive) return;
      await wait(1500);
      for (let i = R.length - 1; i >= 0 && st.alive; i--) { tail.textContent = R.slice(0, i); if (R[i] !== '\n') keyErase(); await wait(R[i] === '\n' ? 40 : 95); }
      if (!st.alive) return;
      tail.remove();
      complete(true);
    }
    function complete(animated) {
      if (st.phase === 'restored') return;
      st.phase = 'restored';
      V().memoState = 'restored'; V().memoErasedTo = P1.length; G.save();
      stopFollow();
      G.flag('P4', true);
      G.flag('M2', true);
      G.bus.emit('memo:restored');
      if (G.notebook && G.notebook.note) {
        G.notebook.note(T('메모에 그 사람이 쓴 줄: "다 읽었어 세아야. 이제 {N} 차례."'), { silent: true });
      }
      if (!st.alive) return;
      setBanner('pinned'); setMeta();
      if (animated) { banner.classList.add('pop'); sfx('lockClick'); vibrate(15); }
      caret.className = 'mm-caret gone';
      finalMode();
    }

    // ---- undo triggers: ↶ · ⋯ › 실행 취소 · three-finger swipe left · Ctrl/Cmd+Z ----
    undoBtn.addEventListener('click', () => requestUndo());
    redoBtn.addEventListener('click', () => {});
    moreBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); menu(); });
    let tf = null;
    scr.addEventListener('touchstart', (e) => { if (e.touches.length >= 3) tf = { x: avgX(e.touches), fired: false }; }, { passive: true });
    scr.addEventListener('touchmove', (e) => { if (!tf || tf.fired || e.touches.length < 3) return; if (avgX(e.touches) - tf.x < -55) { tf.fired = true; requestUndo(); } }, { passive: true });
    scr.addEventListener('touchend', (e) => { if (e.touches.length < 3) tf = null; }, { passive: true });
    function avgX(ts) { let s = 0; for (let i = 0; i < ts.length; i++) s += ts[i].clientX; return s / ts.length; }
    const onKey = (e) => {
      if (!st.alive || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if ((e.key || '').toLowerCase() !== 'z' && e.code !== 'KeyZ') return;
      const top = G.phone.top && G.phone.top();
      if (top && top.node !== scr) return;
      e.preventDefault(); requestUndo();
    };
    document.addEventListener('keydown', onKey);

    function menu() {
      const can = st.phase === 'erased' || st.phase === 'erasing';
      const item = (label, fn, dis) => { const b = el('button.mm-mi' + (dis ? '.dis' : ''), { disabled: !!dis }, label); b.addEventListener('click', () => { ov.close(); fn && fn(); }); return b; };
      const box = el('div.mm-menu', null,
        item('실행 취소', () => requestUndo(), !can),
        item('다시 실행', null, true),
        item('메모 정보', () => info()),
        item('공유', () => G.phone.toast(G.flag('netFree') ? '공유할 수 있는 앱이 없습니다' : '전송 실패 · 관리자 네트워크에서 발신이 제한되었습니다')));
      const back = el('div.mm-menu-wrap', null, box);
      back.addEventListener('click', (e) => { if (e.target === back) ov.close(); });
      const ov = G.phone.overlay(back, { onBack: () => ov.close() });
    }
    function info() {
      const rows = L.info.map(([a, b]) => [a, b]);
      if (st.phase === 'erased' || st.phase === 'erasing' || st.phase === 'rewinding' || st.phase === 'reacting' || st.phase === 'restored') rows.push(['방금', `수정 · 다른 기기 (${(P1.length - KEEP).toLocaleString()}자 삭제)`]);
      if (st.phase === 'restored') rows.push(['방금', '실행 취소 · 이 기기'], ['방금', '고정 · 이 기기']);
      const sheet = el('div.mm-sheet', null, el('div.mm-sheet-grab'), el('div.mm-sheet-t', null, '메모 정보'),
        el('div.mm-sheet-rows', null, rows.map(([a, b]) => el('div.mm-sheet-row' + (/다른 기기/.test(b) ? '.warn' : ''), null, el('small', null, a), el('span', null, b)))),
        el('button.mm-btn.ghost', { onclick: () => ov.close() }, '닫기'));
      const back = el('div.mm-sheet-wrap', null, sheet);
      back.addEventListener('click', (e) => { if (e.target === back) ov.close(); });
      const ov = G.phone.overlay(back, { onBack: () => ov.close() });
    }

    function openPage2() {
      if (G.flag('acrostic')) return page2View();
      page2Lock(() => { finalMode(); page2View(); });
    }

    // ---- lifecycle ----
    st.api = { startErase, requestUndo, state: () => st.phase };
    live = st.api;
    G.phone.push(scr, {
      onClose: () => {
        st.alive = false; stopFollow();
        st.timers.forEach(clearTimeout);
        document.removeEventListener('keydown', onKey);
        if (st.phase === 'erasing') { V().memoState = 'erased'; V().memoErasedTo = KEEP; G.save(); }
        if (st.phase === 'rewinding' || st.phase === 'reacting') complete(false);
        if (live === st.api) live = null;
      },
    });
    G.bus.emit('memo:open', 'letter');
    setMeta();
    if (st.phase === 'restored') { setBanner('pinned'); finalMode(); }
    else if (st.phase === 'erased') { setBanner('done'); liveMode(); caret.className = 'mm-caret gone'; setLive(st.n, 0, 'b'); armAutoHint(); }
    else {
      setBanner(null); freshMode();
      // erase starts at 6 s, or as soon as ¶3 has been scrolled up into the upper part of the screen
      const t6 = setTimeout(() => startErase(), 6000); st.timers.push(t6);
      const trig = P1.indexOf(T(L.triggerLine));
      const onScroll = () => {
        if (st.phase !== 'fresh') { scr.body.removeEventListener('scroll', onScroll); return; }
        try {
          const r = document.createRange(); r.setStart(sa, trig); r.setEnd(sa, trig + 1);
          const rr = r.getBoundingClientRect(), sr = scr.body.getBoundingClientRect();
          if (rr.top < sr.top + sr.height * 0.4) { scr.body.removeEventListener('scroll', onScroll); startErase(); }
        } catch (e) {}
      };
      scr.body.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  /* ---------- page 2 (H4 acrostic) ---------- */
  function page2Lock(onOpen) {
    const P = LT().page2Lock;
    const err = el('div.mm-err', { 'aria-live': 'polite' });
    const field = G.ui.field({ placeholder: '첫 글자들', mode: 'ko', submitLabel: '확인', maxLength: 30, onSubmit: (v) => check(v) });
    const lockIc = el('div.mm-lockic', { html: ICON.lock });
    const box = el('div.mm-lockbox', null,
      lockIc,
      el('div.mm-lock-t', null, P.title),
      el('div.mm-quote', null, P.prompt),
      el('div.mm-fieldrow', null, field.node),
      err,
      el('button.mm-btn', { onclick: () => check(field.value) }, '확인'));
    const scr = G.ui.screen({ title: '잠긴 페이지', cls: 'mm-screen mm-lockscr', body: box });
    scr.dataset.status = 'dark';
    G.phone.push(scr);
    setTimeout(() => field.focus(), 380);
    async function check(v) {
      const nv = G.util.normalize(v).replace(/[^ㄱ-ㅣ가-힣a-z0-9]/g, '');
      if (!nv) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); return; }
      if (nv.includes(P.contains)) {
        G.ui.hideKeyboard();
        sfx('unlock'); lockIc.classList.add('open'); box.classList.add('ok');
        G.flag('acrostic', true);
        G.notebook && G.notebook.note && G.notebook.note('그 사람 계정: sagongsa (사공사… 404?)');
        G.notebook && G.notebook.note && G.notebook.note('세아의 마지막 글, 시간 순서대로: 옷장 뒤에 누가… 있어.');
        await sleep(480);
        G.phone.pop(true);
        onOpen && onOpen();
        return;
      }
      sfx('error'); vibrate(80);
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      err.textContent = P.reversed.some((r) => nv.startsWith(r)) ? P.reversedMsg : P.wrong;
      G.bus.emit('memo:fail', { id: 'page2', value: v });
      field.clear();
    }
  }
  function page2View() {
    const doc = el('div.mm-doc.mm-letter', null,
      el('div.mm-meta', null, el('span.mm-meta-d', null, fmtDT(parseT(LT().t))), el('span.mm-meta-s.pinned', null, '2쪽')),
      el('div.mm-text.mm-letter-text', null, T(LT().page2)));
    const scr = G.ui.screen({ title: '', cls: 'mm-screen mm-view mm-letterscr', body: el('div.mm-letter-body', null, doc) });
    scr.dataset.status = 'dark';
    G.phone.push(scr);
    G.bus.emit('memo:open', 'page2');
  }

  /* ---------- hooks ---------- */
  if (G.hooks && G.hooks.set) G.hooks.set('memo:startErase', () => (live ? live.startErase() : false));
  G.memo = { undo: () => (live ? live.requestUndo() : false), state: () => (live ? live.state() : null) };
})();
