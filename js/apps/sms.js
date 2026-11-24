/* =========================================================
 * 메시지 (SMS) — DESIGN §4.7. Banner 'SIM 카드 없음'; read-only threads.
 * Uses the shared chat engine (G.chat) from talk.js. Lives in the '기타' folder.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el } = G.util;
  function banner() {
    return el('div.sms-banner', null,
      el('span.sb-ic', { html: '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' }),
      el('div', null, el('b', null, 'SIM 카드 없음'), el('small', null, '문자 메시지를 보내거나 받을 수 없습니다.')));
  }
  G.app('sms', {
    name: '메시지',
    icon: G.ICONS.sms,
    folder: '기타',
    badge: () => G.chat.totalUnread('sms'),
    open(p) {
      G.chat.list('sms', '메시지', { cls: 'sms-list-screen', top: banner });
      if (p && p.thread) G.chat.open('sms', p.thread);
      G.bus.emit('sms:open');
    },
  });
})();
