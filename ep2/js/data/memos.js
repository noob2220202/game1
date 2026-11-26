/* =========================================================
 * ep2 data · memos.js (owner: media) — DESIGN §4.4 · §3.10 메모 · §3.20.1 / §9.4 callbacks.
 * '—': one memo '—', read mode only (no keyboard, no pencil, no share/delete, no ＋ 새 메모).
 *      lines(cb) is evaluated at render with G.e2.cb (fixed at introDone) — callback lines are absent
 *      (not blank) when there is no ep1 record. All lines are his (ledger #2–#10, his:true).
 * {N}: '메모 없음' + ＋ 새 메모 → editor (in-game keyboard, predict bar ctx 'memo').
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.memos = {
    title: '메모',
    n: { empty: '메모 없음', newLabel: '＋ 새 메모', placeholder: '메모 입력', justNow: '방금' },
    dash: [
      { id: 'dash1', title: '—', edited: '수정 2026.12.24 오후 10:49', readOnly: true, flag: 'dashMemo', his: true,
        lines: (cb) => [
          cb('e1done') && cb('knock') ? ({ answered: '노크 잘하더라. 여기선 안 해?', four: '네 번 두드렸지. 그때 알았어, 너 똑똑한 거.', none: '그날 대답 안 한 거, 잘했어.' })[cb('knock')] || null : null,
          '돌려줄게.',
          '네가 세아 걸 엄마한테 돌려줬잖아. 그래서 나도 돌려주는 거야.',
          '내 집도 보여 줘야 공평하잖아.',
          cb('e1done') && cb('min') != null ? `${cb('min')}분. 세아는 1년 걸렸는데.` : null,
          cb('trap') ? '*0404# 누른 거 기억해.' : null,
          cb('vault') ? '보관함, 네 사진까지 봤지.' : null,
          '지문 남겨 둘게. 다음에 열어 보려고.',
          '04:44엔 작게 틀 거야. 너한테만 들리게.',
        ].filter(Boolean) },
    ],
  };
})();
