/* =========================================================
 * ep3/js/data/show.js — `엄마에게 보여 드리기` reactions (shell · ARCH_EP3 §6.8 · DESIGN_EP3 §3.2.2 · §3.8 · §3.9 · §3.10 · §4.10).
 * → G.STORY.show. Read by ep3/js/show.js only. Keys of `react` = DESIGN §5.8 screen ids (data-scr); `also` = other screen ids
 * with the same reaction. Plain strings = name cards of 엄마; { who:null, text } = situation cards; functions are evaluated at
 * render (null = skipped). Every string is DESIGN §4.10 text, verbatim. No code runs at load.
 * ========================================================= */
window.G = window.G || {};
(function (G) {
  'use strict';
  G.STORY = G.STORY || {};
  G.STORY.show = {
    label: '엄마에게 보여 드리기',
    where: { sr: '엄마는 세아 방에 있다.', lv: '엄마는 식탁에 있다.', table: '엄마는 식탁에 있다.', hall: '엄마는 현관 앞에 서 있다.' },
    glasses: '엄마가 안경을 찾아 쓴다.', again: '엄마가 고개를 끄덕인다.',
    neutral: [{ who: null, text: '엄마가 화면을 본다. …' }, { who: '엄마', text: '이건 잘 모르겠어요.' }, { who: null, text: '엄마가 화면을 한참 보다가 고개를 젓는다.' }],
    react: {
      'callrec.blocked': { flag: 'momBlock', also: ['callrec.blocked.number'], lines: [{ who: null, text: '엄마가 화면을 손가락으로 천천히 내린다.' },
        '…다 24일이네요.', '…', '24일은 원래 우리 세아 생일이에요.', '…그 사람이 그걸 가져갔네요.', '한 번도 안 울렸어요. 한 번도.',
        '세아가 이상한 전화 다 막아 놨다고 했었는데.', () => (G.flag('mom331') ? '…이것도 3시 31분이네요.' : null)] },
      'phone.recent': { flag: 'mom331', needRow: 'sea-20251124-0331', also: ['phone.contact.sea.log'], lines: ['3시 31분. 세아가 나한테 전화한 시간이에요.',
        '나는 자고 있었어요.', '밤엔 전화 안 울리게 해 놓고 잤어요. 아침 일찍 나가니까요.', () => (G.flag('momBlock') ? '…그 사람도 3시 31분이었네요.' : null)] },
      'settings.dnd': { flag: 'momDnd', stage: ['e3_dnd', true], also: ['settings.dnd.log'], lines: [{ who: null, text: '엄마가 화면을 오래 본다.' },
        '그날 이후로 한 번도 안 켰어요.', '…', '밤에 세아 전화 올까 봐요.', '3분 안에 또 오면 울리는 거였대요. …나중에 알았어요.', '세아는 한 번 걸었어요.',
        { dndChip: true },                                                     // → the dndChip sheet (20 s · `[아무 말도 하지 않는다]` on timeout)
        { ifSaid: ['…그 애는 그걸 미리 써 놨네요.', '고마워요, {N} 씨.'], ifSilent: [{ who: null, text: '엄마가 화면을 덮는다. 한참 뒤 고개를 끄덕인다.' }] }] },
      'gallery.shared.members': { flag: 'momMembers', lines: ['처음엔 세아 학교 사람인 줄 알았어요.', '크리스마스 지나고 형사님이 말해 줬어요. 그 사람이라고.',
        '지우면 그 사람이 안대요. 그래서 그대로 뒀어요.', '그 뒤로는 안 올렸어요.'] },
      'gallery.photo.door': { flag: 'momBom', lines: ['…세아 보라고 올린 거예요. 콩이가 현관에서 기다린다고.',
        (ctx) => (ctx && ctx.photo === '1130' ? '…이건 택배 받느라 문 열어 놨을 때예요.' : null), { who: null, text: '엄마가 눈을 감는다.' }] },
      'gallery.shared.activity': { lines: [{ who: null, text: '엄마가 화면을 본다.' }, '…형사님이 지운 거래요. 그 사람이 올린 거요.'] },
      'talk.sea': { lines: ['1년 동안 그 시간에 걸었어요.', '…', '오늘은 세아가 걸었네요.'] },
      'talk.self': { lines: ['세아가 하나하나 불러 줬어요. 나는 받아 적기만 했어요.'] },
      'callrec.list': { beforeM8: true, also: ['callrec.player', 'callrec.player.info', 'callrec.text'], lines: [{ who: null, text: '엄마가 화면에서 눈을 돌린다.' }, '…그건 못 보겠어요.'] },
      'gallery.photo.soup2601': { lines: ['작년에도 끓였어요. 세아 거랑 두 그릇.'] },
      'gallery.photo.cake2411': { lines: ['그때 세아가 케이크 들고 저 현관에 서 있었어요.'] },
      'calendar.event.1126': { lines: ['케이크 사 온다고 했어요. 그 주에…'] },
      'calendar.event.0124': { lines: ['매년 써 놔요. 안 써도 아는데.'] },
      'sms.kang': { also: ['easy.sms.kang'], lines: ['형사님이 문자로 하재요. 전화는 안 하고.'] },
    },
    dndChip: { id: 'dndSay', chips: [{ id: 'say', label: '세아 씨가 그 메일에 썼어요. 절대 엄마 잘못 아니라고.', edit: true, verb: 'say' },
      { id: 'none', label: '아무 말도 하지 않는다', verb: 'pick' }] },
  };
})(window.G);
