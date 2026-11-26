/* =========================================================
 * 메모 (owner: media) — DESIGN §4.4 · §3.10 메모 · §3.21 메모({N}) · §5.1/§5.2 · §9.5-1 (predict bar).
 * '—' : one memo `—` · `수정 2026.12.24 오후 10:49` · preview = first line → READ MODE only
 *       (no keyboard, no pencil, no share/delete, no ＋ 새 메모, long-press does nothing) → flag dashMemo.
 *       Body = G.STORY.memos.dash[0].lines(cb) with the boot-fixed ep1 callbacks (G.e2.cb) — absent
 *       callback lines are simply not there.
 * {N} : `메모 없음` + [＋ 새 메모] → editor = in-game keyboard field (predict bar ON, ctx 'memo') ·
 *       placeholder `메모 입력` · title = first line · autosave · time `방금` → in-game time.
 *       Player text is free text → kept only in the session store (G.e2.session, sessionStorage —
 *       ARCH §7 rule 7); the save keeps ids + in-game edit times (vars.md.memos) and nothing else.
 *
 * Public API : G.memo = { open(user, id) }
 * Flags set  : dashMemo
 * data-qa    : memo.new · memo.item:<id> · memo.editor
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[memo] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T;
  const MD = () => (G.STORY && G.STORY.memos) || { n: { empty: '', newLabel: '', placeholder: '' }, dash: [] };
  const MM = (G.memo = G.memo || {});
  const NOTE = '<svg viewBox="0 0 24 24"><path d="M6 3.5h9l4 4V20a.5.5 0 01-.5.5h-12A.5.5 0 016 20z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 10h7M9 13.5h7M9 17h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  /* ---------------- {N}'s own memos (ids in the save, text in the session store) ---------------- */
  const textOf = (id) => { const v = MU.sessGet('md:memo:' + id); return typeof v === 'string' ? v : ''; };
  function myMemos() { return (MU.md().memos || []).filter((m) => m && m.id && textOf(m.id).trim()).slice().sort((a, b) => (b.t || 0) - (a.t || 0)); }
  function saveMemo(id, text) {
    const list = (MU.md().memos || []).filter((m) => m && m.id !== id);
    if (String(text || '').trim()) { MU.sessSet('md:memo:' + id, text); list.push({ id, t: MU.now().getTime() }); }
    else MU.sessSet('md:memo:' + id, '');
    MU.mdSet({ memos: list });
  }
  function whenLabel(t) {
    if (!t) return '';
    const now = MU.now().getTime();
    if (Math.abs(now - t) < 60000) return T(MD().n.justNow || '');
    return MU.fmtK(new Date(t));
  }

  MU.app('memo', {
    name: '메모',
    icon: (G.ICONS && G.ICONS.memo) || { bg: 'linear-gradient(160deg,#ffd84d,#f5b301)', svg: NOTE },
    badge: () => 0,
    open(p) {
      p = p || {};
      const user = p.user || MU.user();
      listScreen(user);
      if (p.id) MM.open(user, p.id, true);
    },
  });

  function listScreen(user) {
    const body = el('div.md2-memo-list');
    const footer = user === 'dash' ? null : el('div.md2-memo-foot');
    const scr = MU.screen({ title: T(MD().title || '메모'), cls: 'md2-memo', body, footer });
    if (user === 'dash') MU.noMenu(scr);
    function render() {
      body.innerHTML = '';
      if (user === 'dash') {
        (MD().dash || []).forEach((m) => {
          const lines = linesOf(m);
          const card = el('button.md2-memo-card', { type: 'button' },
            el('b', null, T(m.title)), el('span.md2-memo-prev', null, lines[0] || ''), el('small', null, T(m.edited)));
          MU.qa(card, 'memo.item:' + m.id);
          card.addEventListener('click', () => { MU.sfx('tap'); readView(m); });
          body.appendChild(card);
        });
        return;
      }
      const mine = myMemos();
      if (!mine.length) body.appendChild(el('div.md2-empty.tall', null, el('span.md2-empty-ic', { html: NOTE }), el('b', null, T(MD().n.empty))));
      mine.forEach((m) => {
        const txt = textOf(m.id);
        const nl = txt.indexOf('\n');
        const title = (nl >= 0 ? txt.slice(0, nl) : txt).trim();
        const rest = nl >= 0 ? txt.slice(nl + 1).trim().split('\n')[0] : '';
        const card = el('button.md2-memo-card', { type: 'button' }, el('b', null, title), rest ? el('span.md2-memo-prev', null, rest) : null, el('small', null, whenLabel(m.t)));
        MU.qa(card, 'memo.item:' + m.id);
        card.addEventListener('click', () => { MU.sfx('tap'); editor(m.id, render); });
        body.appendChild(card);
      });
      if (footer && !footer.firstChild) {
        const nb = el('button.md2-memo-new', { type: 'button' }, T(MD().n.newLabel));
        MU.qa(nb, 'memo.new');
        nb.addEventListener('click', () => { MU.sfx('tap'); editor(null, render); });
        footer.appendChild(nb);
      }
    }
    render();
    MU.push(scr, { onResume: render });
  }

  function linesOf(m) {
    let ls = [];
    try { ls = typeof m.lines === 'function' ? m.lines((k) => MU.cb(k)) : m.lines || []; } catch (e) { console.error('[memo] lines', e); }
    return ls.map((l) => T(l));
  }

  /* '—' read mode */
  function readView(m) {
    const body = el('div.md2-memo-read', null,
      el('div.md2-memo-rh', null, el('b', null, T(m.title)), el('small', null, T(m.edited))),
      el('div.md2-memo-text', null, linesOf(m).map((l) => el('p', null, l))));
    const scr = MU.screen({ title: '', cls: 'md2-memo md2-memo-r', body });
    MU.noMenu(scr);
    MU.push(scr);
    if (m.flag) MU.flag(m.flag, true);
  }

  /* {N} editor */
  function editor(id, onSaved) {
    const mid = id || 'm' + Date.now().toString(36);
    let text = id ? textOf(id) : '';
    const meta = el('small.md2-memo-when', null, id ? whenLabel(((MU.md().memos || []).find((x) => x.id === id) || {}).t) : '');
    let f = null, saveT = null;
    const flush = () => { clearTimeout(saveT); saveT = null; saveMemo(mid, text); if (text.trim()) meta.textContent = T(MD().n.justNow || ''); };
    if (G.ui && G.ui.field) {
      f = G.ui.field({
        placeholder: T(MD().n.placeholder), mode: 'ko', predict: true, ctx: 'memo', qa: 'memo.editor',
        onChange: (v) => { text = v; clearTimeout(saveT); saveT = setTimeout(flush, 600); },
        onSubmit: () => { if (f && f.insert) f.insert('\n'); else if (f && f.blur) f.blur(); },
      });
      if (text) f.set(text);
    }
    const fieldNode = f ? f.node : el('div.md2-memo-ph', null, T(MD().n.placeholder));
    MU.qa(fieldNode, 'memo.editor');
    fieldNode.classList.add('md2-memo-field');
    const body = el('div.md2-memo-ed', null, meta, fieldNode);
    body.addEventListener('click', (e) => { if (f && e.target === body) f.focus(); });
    const scr = MU.screen({ title: '', cls: 'md2-memo md2-memo-e', body });
    MU.push(scr, { onClose: () => { flush(); try { G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard(); } catch (e) {} onSaved && onSaved(); } });
    if (f && !id) setTimeout(() => { if (scr.isConnected) f.focus(); }, 320);
  }

  MM.open = function (user, id) {
    user = user || MU.user();
    if (user === 'dash') { const m = (MD().dash || []).find((x) => x.id === id) || (MD().dash || [])[0]; if (m) readView(m); return; }
    if (id && textOf(id)) editor(id);
  };
})();
