/* 문자 (SMS) app — uses the shared chat engine */
(function () {
  'use strict';
  const G = window.G;
  G.app('sms', {
    name: '메시지',
    icon: G.ICONS.sms,
    dock: true,
    badge: () => G.chat.totalUnread('sms'),
    open(p) {
      G.chat.list('sms', '메시지');
      if (p && p.thread) G.chat.open('sms', p.thread);
    },
  });
})();
