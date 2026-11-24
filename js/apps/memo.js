/* =========================================================
 * 메모: notes list, locked notes (in-game keyboard; password fields switch to
 * the English layout like real Korean phones), recently deleted folder w/ restore.
 * G.STORY.memos = [{id, title, t, body (string|fn->string|Node), folder:'all'|'deleted', show(),
 *                   locked:{answer:[..], hint, check(v), onUnlock, wrongMsg(v)}, onOpen}]
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;

  function memos(folder) {
    return (G.STORY.memos || []).filter((m) => (!m.show || m.show()) && ((m.folder || 'all') === folder || (folder === 'all' && m.folder === 'deleted' && (G.state.vars.restoredMemos || {})[m.id])) && !(folder === 'deleted' && (G.state.vars.restoredMemos || {})[m.id]));
  }
  function fmt(t) { const d = G.chat.parseT(t); return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : ''; }

  G.app('memo', {
    name: '메모',
    icon: G.ICONS.memo,
    open(p) {
      const wrap = el('div');
      const scr = G.ui.screen({ title: '메모', cls: 'memo-screen', body: wrap });
      function render() {
        wrap.innerHTML = '';
        const list = memos('all').sort((a, b) => (a.pinned === b.pinned ? +G.chat.parseT(b.t) - +G.chat.parseT(a.t) : a.pinned ? -1 : 1));
        wrap.appendChild(G.ui.list(list.map((m) => ({
          title: (m.locked && !G.flag('memo_' + m.id) ? '🔒 ' : (m.pinned ? '📌 ' : '')) + G.T(m.title),
          sub: m.locked && !G.flag('memo_' + m.id) ? '잠긴 메모' : fmt(m.t) + '  ' + preview(m),
          cls: 'memo-row',
          onClick: () => openMemo(m),
        }))));
        const del = memos('deleted');
        if ((G.STORY.memos || []).some((m) => m.folder === 'deleted')) {
          wrap.appendChild(el('div.section-title', null, '폴더'));
          wrap.appendChild(G.ui.list([{ title: '🗑 최근 삭제된 항목', meta: String(del.length), onClick: openDeleted }]));
        }
      }
      render();
      G.phone.push(scr, { onResume: render });
      if (p && p.memo) { const m = (G.STORY.memos || []).find((x) => x.id === p.memo); if (m) openMemo(m); }
    },
  });
  function preview(m) { const b = typeof m.body === 'function' ? m.body() : m.body; return typeof b === 'string' ? G.T(b).replace(/\s+/g, ' ').slice(0, 40) : ''; }

  function openDeleted() {
    const wrap = el('div');
    const scr = G.ui.screen({ title: '최근 삭제된 항목', cls: 'memo-screen', body: wrap });
    function render() {
      wrap.innerHTML = '';
      wrap.appendChild(el('div.section-title', null, '삭제된 메모는 30일 후 완전히 삭제됩니다.'));
      const list = memos('deleted');
      if (!list.length) wrap.appendChild(el('div.empty-state', null, '비어 있음'));
      wrap.appendChild(G.ui.list(list.map((m) => ({ title: G.T(m.title), sub: (m.deletedLabel ? G.T(m.deletedLabel) : '') + ' ' + preview(m), onClick: () => openMemo(m, true) }))));
    }
    render();
    G.phone.push(scr, { onResume: render });
    G.bus.emit('memo:deleted-folder');
  }

  function openMemo(m, fromDeleted) {
    if (m.locked && !G.flag('memo_' + m.id)) return lockScreen(m);
    const doc = el('div.memo-doc');
    const b = typeof m.body === 'function' ? m.body() : m.body;
    doc.appendChild(el('span.md-date', null, fmt(m.t) + (m.timeLabel ? ' ' + m.timeLabel : '')));
    if (b instanceof Node) doc.appendChild(b); else doc.appendChild(el('div', { html: G.T(b || '') }));
    const right = [];
    if (fromDeleted && m.restorable !== false) right.push(el('button', { onclick: async () => {
      G.state.vars.restoredMemos = Object.assign({}, G.state.vars.restoredMemos, { [m.id]: true }); G.save();
      G.audio && G.audio.sfx.success(); G.phone.toast('메모가 복구되었습니다');
      m.onRestore && m.onRestore(); G.bus.emit('memo:restore', m.id);
    } }, '복구'));
    const scr = G.ui.screen({ title: '', cls: 'memo-screen', body: doc, right });
    G.phone.push(scr);
    G.state.seen['memo:' + m.id] = true; G.save();
    G.bus.emit('memo:open', m.id);
    m.onOpen && m.onOpen(scr);
  }

  function lockScreen(m) {
    const L = m.locked;
    const err = el('div.mp-err');
    let fails = 0;
    const field = G.ui.field({ placeholder: '비밀번호', password: true, showJamo: !!L.showJamo, submitLabel: '확인', onSubmit: (v) => check(v) });
    const pw = el('div.memo-pw', null,
      el('span', { html: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' }),
      el('div', { style: { fontWeight: '700', fontSize: '17px' } }, G.T(m.title)),
      el('div', { style: { fontSize: '13px', color: '#888' } }, '이 메모는 잠겨 있습니다'),
      L.hint ? el('div.mp-hint', null, '힌트: ' + G.T(L.hint)) : null,
      field.node, err,
      el('button.btn.block', { style: { maxWidth: '260px' }, onclick: () => check(field.value) }, '확인'));
    const scr = G.ui.screen({ title: '잠긴 메모', cls: 'memo-screen', body: pw });
    G.phone.push(scr);
    setTimeout(() => field.focus(), 350);
    async function check(v) {
      const ok = L.check ? L.check(v) : (L.answer || []).some((a) => G.util.normalize(a) === G.util.normalize(v));
      if (ok) {
        G.ui.hideKeyboard();
        G.audio && G.audio.sfx.unlock();
        G.flag('memo_' + m.id, true);
        await sleep(300);
        G.phone.pop(true);
        L.onUnlock && L.onUnlock();
        openMemo(m);
      } else {
        fails++;
        G.audio && G.audio.sfx.error();
        pw.classList.remove('wrong'); void pw.offsetWidth;
        err.textContent = (L.wrongMsg && L.wrongMsg(v, fails)) || '비밀번호가 일치하지 않습니다';
        G.bus.emit('memo:fail', { id: m.id, value: v, fails });
        field.clear();
      }
    }
  }
})();
