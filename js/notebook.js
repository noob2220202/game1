/* =========================================================
 * 하루의 수첩 — objectives, tiered hints, code fragments.
 * Data: G.OBJECTIVES = [{id, title, show():bool, done():bool, hints:[t1,t2,t3]}]
 *       G.FRAGMENTS  = [{id, label, answer, show():bool}]
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const NB = (G.notebook = {});
  let fab = null;

  NB.init = function () {
    if (fab) return;
    fab = el('button.nb-fab', { 'aria-label': '수첩', html: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 3v18M4 7h4M4 12h4M4 17h4M10 8h6M10 11.5h5" stroke="currentColor" stroke-width="1.4"/></svg>' });
    fab.addEventListener('click', () => { G.audio && G.audio.sfx.pageTurn(); NB.open(); });
    document.getElementById('screen').appendChild(fab);
    G.bus.on('flag', () => NB.ping());
  };
  NB.show = function (on) { if (fab) fab.classList.toggle('hide', !on); };
  NB.ping = function () { if (fab) { fab.classList.add('ping'); } };

  NB.current = function () {
    return (G.OBJECTIVES || []).filter((o) => (!o.show || o.show()) && !(o.done && o.done()));
  };

  NB.open = function () {
    if (fab) fab.classList.remove('ping');
    const paper = el('div.nb-paper');
    const wrap = el('div.notebook', null, paper);
    const close = () => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 250); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    render();
    document.getElementById('screen').appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));

    function render() {
      paper.innerHTML = '';
      paper.appendChild(el('div.nb-head', null, el('div.nb-title', null, G.T('{N의} 수첩')), el('button.nb-close', { onclick: close }, '닫기 ✕')));
      const objs = (G.OBJECTIVES || []).filter((o) => !o.show || o.show());
      const active = objs.filter((o) => !(o.done && o.done()));
      const done = objs.filter((o) => o.done && o.done());
      paper.appendChild(el('div.nb-sec', null, '해야 할 것'));
      if (!active.length) paper.appendChild(el('div.nb-note', null, '…'));
      active.forEach((o) => {
        paper.appendChild(el('div.nb-obj', null, el('span.chk', null, '□'), el('span', null, G.T(o.title))));
        const tier = G.state.hints[o.id] || 0;
        const hb = el('div.nb-hints');
        (o.hints || []).slice(0, tier).forEach((h) => hb.appendChild(el('div.nb-hint', null, G.T(h))));
        if (tier < (o.hints || []).length) {
          const labels = ['힌트 보기', '더 자세한 힌트', '정답 보기'];
          const b = el('button.nb-hint-btn', null, labels[Math.min(tier, 2)] + (tier === 2 ? ' 😱' : ''));
          b.addEventListener('click', async () => {
            if (tier === 2) {
              const ok = await G.phone.dialog({ title: '정답을 볼까요?', text: '스스로 풀었을 때의 쾌감이 사라집니다…', buttons: [{ label: '조금 더 해볼래', value: false }, { label: '볼래', value: true, style: 'danger' }] });
              if (!ok) return;
            }
            G.state.hints[o.id] = tier + 1; G.state.hintsUsed++; G.save();
            G.audio && G.audio.sfx.pen();
            G.bus.emit('hint', { id: o.id, tier: tier + 1 });
            render();
          });
          hb.appendChild(b);
        }
        paper.appendChild(hb);
      });
      // fragments
      const frags = (G.FRAGMENTS || []).filter((f) => !f.show || f.show());
      if (frags.length) {
        paper.appendChild(el('div.nb-sec', null, G.FRAGMENTS_TITLE || '알아낸 숫자'));
        const row = el('div.nb-frags');
        frags.forEach((f) => {
          const v = G.state.fragments[f.id] || '';
          const ok = G.util.normalize(v) === G.util.normalize(f.answer);
          const inp = el('input', { value: v, maxlength: f.answer.length, inputmode: f.inputmode || 'numeric', placeholder: '?'.repeat(f.answer.length), autocomplete: 'off' });
          const box = el('div.nb-frag' + (ok ? '.ok' : ''), null, el('span', null, G.T(f.label)), inp);
          inp.addEventListener('input', () => {
            G.state.fragments[f.id] = inp.value; G.save();
            const good = G.util.normalize(inp.value) === G.util.normalize(f.answer);
            box.classList.toggle('ok', good);
            if (good) { G.audio && G.audio.sfx.success(); G.flag('frag_' + f.id, true); }
          });
          row.appendChild(box);
        });
        paper.appendChild(row);
        if (G.FRAGMENTS_NOTE) paper.appendChild(el('div.nb-note', null, G.T(G.FRAGMENTS_NOTE)));
      }
      if (done.length) {
        paper.appendChild(el('div.nb-sec', null, '한 것'));
        done.forEach((o) => paper.appendChild(el('div.nb-obj.done', null, el('span.chk', null, '☑'), el('span', null, G.T(o.title)))));
      }
      const mins = Math.floor(G.state.playMs / 60000);
      paper.appendChild(el('div.nb-stats', null, `플레이 ${mins}분 · 힌트 ${G.state.hintsUsed}회`));
    }
  };
})();
