/* =========================================================
 * ep3/js/data/cards.js (flow) — G.STORY.cards: title · content warning · earphone test · pause · M0 엄마 · 03:33 situation
 * cards · 03:35 handover (DESIGN_EP3 §3.0 · §3.1 · §4.0 · §4.1.2–§4.1.4 · ARCH_EP3 §6.2). Strings verbatim from DESIGN;
 * tokens ({N…} · {$key}) are expanded by the renderer with G.T. Conditional lines are lazy (cb) => string, evaluated at render
 * by flow (scenes.js · call.js) with G.e3.cb. Readers: flow scenes / call. Pure data — no cross-owner code at load time.
 * (The four recap lines are core's G.e3.MONO.recap.)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.cards = {
    title: { name: '{N를} 위한 방탈출! 3', sub: '엄마의 번호', start: '시작', cont: '이어하기', small: '약 45분 · 이어폰 권장', series: '다른 이야기',
      hookReplay: '훅 다시 보기', recanon: '이번 선택을 이야기로 남기기', fresh: '처음부터',
      inapp: ["카카오톡 안에서는 소리가 제대로 나오지 않을 수 있어요. 오른쪽 위 ⋯ → '다른 브라우저로 열기'를 눌러 주세요.", '그냥 할래요'],
      // §4.0 / §9.2 — the 처음부터 confirm ({$restart3}) and the recanon confirm ({$recanonQ}) buttons + its one-line result (§4.12.7 ⊕)
      cancel: '취소', erase: '지우기', change: '바꾸기', recanonDone: '이번 선택으로 바꿨어요.',
      desk: '🎧 이어폰을 끼고 조용한 곳에서 하세요. 휴대폰으로 하면 더 가까이 들립니다.' },
    warn: ['이 이야기에는 실종과 스토킹 · 감금 · 납치 소재, 그리고 가족을 기다리는 마음이 나옵니다.',
      "언제든 일시정지 메뉴에서 '덜 무섭게'를 켤 수 있어요.", '계속'],
    ear: { head: '🎧 이어폰 테스트', line: '작은 종소리가 한쪽에서 다른 쪽으로 지나가요.', ok: '들려요', speaker: '스피커예요', none: '안 들려요',
      okLine: '좋아요. 이 이야기의 소리에는 방향이 있어요.', speakerLine: '스피커로도 끝까지 할 수 있어요.', soundCard: '{$soundCard}',
      retry: '다시 듣기', silent: '소리 없이 할게요', start: '시작', foot: '이 게임은 어떤 데이터도 서버로 보내지 않습니다.' },
    recap: { skip: '건너뛰기' },
    pause: { head: '일시정지', resume: '계속하기', rows: [['공포 연출', '보통', '덜 무섭게'], ['글자 크기', '작게', '보통', '크게'],
      ['소리', '이어폰', '스피커(방향 표시)'], ['소리 자막', '정보만', '모두'], ['진동', '켬', '끔'], ['화면 효과', '흔들림 줄이기', '깜빡임 줄이기']],
      title: '처음 화면으로' },
    m0: {
      momFirst: (cb) => (cb('A') ? '깼어요? …그날 이후로 이 시간엔 전화 안 해요. 콩이랑 물 마셔요. 오늘은 생일이라… 먼저 눈이 떠졌어요.'
        : '깼어요? 나는 이 시간에 늘 깨요. …세아한테 전화하는 시간이라서요.'),
      momThen: ['오늘이 세아 생일이에요.', '미역국 끓여 놨어요. 아침에 같이 먹어요.'],      // +4 s · (calSeen0 or +15 s)
      momTaps: ['콩이 목줄은 밤엔 빼 둬요. 방울 소리에 깰까 봐요.', '나는 괜찮아요.'], momTapCaption: '엄마는 엎어 둔 폰 위에 손을 얹고 있다.' },
    call: {   // §3.1 table / §4.1.3 — t = first ring
      pre: (cb) => (cb('A') ? '엄마가 물컵을 내려놓는다.' : '엄마가 엎어 둔 휴대전화를 뒤집는다.'),
      ring: (cb) => (cb('A') ? ['엎어 둔 휴대전화가 식탁 위에서 떤다.', '엄마가 휴대전화를 뒤집는다.'] : ['엄마의 손가락이 닿기 전에, 휴대전화가 먼저 운다.']),
      t2: '엄마의 손이 멈춘다.', t6: '엄마가 받는다.', t15: '엄마는 아무 말도 하지 않는다.', t19: '숨을 쉬지 않는 것 같다.',
      t40: { who: '엄마', text: '세아야? …세아야.' }, t43: '엄마가 휴대전화를 내려놓는다. 오래.', t50: '엄마가 휴대전화를 {N} 쪽으로 민다.' },
    handover: [{ who: '엄마', text: '…그 오르골 노래였어요.' }, { who: '엄마', text: '나는 못 듣겠어요. {N} 씨가 들어 줘요.' },
      { who: '엄마', text: '녹음은 된대요. 형사님이 해 놨어요.', id: 'recCard' }, { who: '엄마', text: '세아가 큰 글씨로 해 놔서, 나는 이것밖에 몰라요.', id: 'easyCard' },
      { who: '엄마', text: '내가 무슨 소리를 냈는지도… 그것도 못 듣겠어요.' }, { who: '엄마', text: '세아 방에 있을게요.' },
      { who: null, text: '엄마가 세아 방으로 들어간다. 문을 반쯤 열어 둔다.', id: 'toRoom' }, { who: null, text: '콩이가 고개를 들었다가 다시 눕는다.' }],
  };
})();
