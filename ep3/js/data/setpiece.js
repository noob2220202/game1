/* =========================================================
 * 하루를 위한 방탈출! 3 — set-piece card scripts (ep3/js/data/setpiece.js · owner: room)
 * G.STORY.setpiece = { door, memory, climax } — read by ep3/js/door.js · memory.js · climax.js (ARCH §6.4).
 * DESIGN §3.12 · §3.13 · §3.14 · §4.11.1–§4.11.4 — every string verbatim (raw tokens; the card renderer expands them
 * with G.T at render time). Card step format = ARCH §5.6: { who:'엄마'|'지민'|null, text } (situation card = who null);
 * in `memory.chain` and `climax.after` a plain string means who '엄마'. Lazy entries are functions evaluated at render:
 * `chipReply(cb)` (cb = G.e3.cb) and `door.t46(f)` (f = flag reader).
 * Data only — no code runs at load time except the assignment below.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.setpiece = {
    door: { // §3.12 table — t in seconds from M6 (04:40:00)
      t11: { who: null, text: '엄마가 세아 방에서 나와 현관 앞에 선다. 문에 손대지 않는다.' },
      t14: [{ who: '엄마', text: '…콩이야.' }, { who: null, text: '콩이는 문을 보고 서 있다.' }],
      t16: { who: '지민', text: '…방금 뭐예요?' },
      chip: { id: 'jimin0440', chips: [{ id: 'say', label: '밖에서 누가 도어락을 눌렀어요. 저도 들었어요.', edit: true, verb: 'say' }], timeoutMs: 20000, timeoutPick: 'keep' },
      chipReply: (cb) => ({ yes: '그날 오르골 얘기 답해 줬을 때부터요, {N} 씨 말은 그냥 믿어져요.', no: '그날 끝내 대답은 안 했잖아요. 그래도 오늘 보니까 알겠어요. {N} 씨 맞아요.',
        none: '…콩이도 들었나 봐요.' })[cb('B')] || '…콩이도 들었나 봐요.',
      keepReply: '……',
      t30: { who: null, text: '엄마가 식탁으로 물러난다. 손이 떨린다.' },
      t46: (f) => [{ who: null, text: '지민이 자기 휴대전화로 112에 전화한다.' },
        { who: '지민', text: f('call112First') ? '…네. 같이 있는 사람이 방금 신고했어요. 현관 비밀번호를 누가 눌렀어요. 틀렸고요.'
          : '…네. 현관 비밀번호를 누가 눌렀어요. 틀렸고요. 지금은 아무 소리도 안 나요.' },
        { who: null, text: '지민이 주소를 불러 준다.' }],
      t100: [{ who: '지민', text: '지구대에서 온대요. 문 열지 말래요.' }, { who: null, text: '지민이 휴대전화 진동을 켜 손에 쥔다.' }],
      t152: [{ who: null, text: '지민이 전화를 받는다.' }, { who: '지민', text: '…네. 네. …아무도 없어요? 계단도요? …네. 감사합니다.' },
        { who: '지민', text: '복도랑 계단, 아무도 없대요.' }, { who: '지민', text: '공동현관 CCTV는 아침에 관리사무소에서 같이 본대요.' },
        { who: null, text: '지민이 엄마 어깨에 담요를 덮어 준다.', id: 'blanket' }, { who: null, text: '지민이 부엌 입구 벽에 기대어 선다.' }],
      view0: { kongi: '콩이가 현관문 앞에 서서 문을 보고 있다. 꼬리가 내려가 있다.', panel: '도어락 안쪽 패널. 초록 불빛.' },
    },
    memory: { // §3.13 · §4.11.2
      m7: [{ who: null, text: '엄마가 일어나 세아 방으로 간다.', id: 'up' }, { who: null, text: '{N}도 따라간다.', id: 'follow' },
        { who: null, text: '엄마가 세아 방 스탠드를 켠다.', id: 'lamp' }],
      cbD: { who: '엄마', text: '그 노래 끝까지 들었어요? 다섯째 음…' },
      hum: [{ who: null, text: '엄마가 오르골 노래를 흥얼거린다.', id: 'hum' }, { who: null, text: '다섯 번째 음에서 엄마의 목소리가 올라가다 멈춘다.' }],
      spots: { orgel: '오르골 자리예요. 서울 갈 때 들고 갔어요. …지금은 경찰서에 있대요. 돌려준대요.', manual: '세아가 그거 보고 계이름 외웠어요. 미, 라, 도, 시, 라, 미.',
        frame: '생일마다 쟀어요. 열두 살부터는 자기가 썼어요. 엄마 글씨 못생겼다고.' },
      early: { who: null, text: '엄마가 책상 위 그림을 본다.' }, pick: { who: null, text: '엄마가 책상 위 그림을 집는다.' },
      fallback: { who: null, text: '엄마가 책상에서 종이 한 장을 집는다.' },
      chain: ['세아는 오르골 따라 부를 때 다섯 번째 음을 꼭 틀렸어요.', '엄마 웃기려고.', '…', "'엄마 나 괜찮아'라는 뜻이었어요.",
        '넘어져서 무릎이 까져도, 주사 맞고 나와서도. 꼭 그 음을 틀렸어요.', '크리스마스 지나고 형사님이 들려준 거요… 다섯째 음에서 그만 틀어 달라고 했어요.',
        '옛날 녹음일 수도 있대서요.', '옛날 거면… 지금 말고.', '오늘 그 전화도요. …내 목소리만 생각나요. 세아야, 세아야, 하고만 있었어요.',
        { who: null, text: '엄마가 그림을 책상에 내려놓는다.' }, '…부엌에 가 있을게요.'],          // plain strings = who '엄마'
      momIdle: '엄마는 침대 끝에 앉아 두 손을 무릎에 올려 두고 있다.', after: '세아 방은 그대로 뒀어요.',
    },
    climax: { // §3.14 · §4.11.3 · §4.11.4
      m8: [{ who: null, text: '엄마가 식탁에 앉는다. 두 손을 모은다.', id: 'sit' },
        { who: null, text: '{N}도 맞은편에 앉는다. 콩이는 세아 방 문 앞에 엎드려 있다. 지민은 부엌 입구에 서 있다.', id: 'seat' },
        { who: '엄마', text: '{N} 씨.' }, { wait: 3000 }, { who: '엄마', text: '…세아 소리, 들었어요?' },
        { id: 'yes', chips: [{ id: 'yes', label: '네.', edit: true, verb: 'say' }], timeoutMs: 15000, keepOnTimeout: true },
        { who: '엄마', text: '……' }, { who: null, text: '엄마가 두 손을 식탁 위에 올려 둔다.', id: 'armed' }],
      at: { fifth: '다섯 번째 음에서 엄마의 숨이 멎는다.', name: '…{N} 씨 이름이에요.', mouth: '엄마가 입을 막는다.' },
      after: ['…그때도 뭐라고 한 것 같았어요. 나는 못 알아들었어요.', { who: null, text: '부엌 입구의 지민이 고개를 숙인다.' }],
      head: [{ who: null, text: '엄마가 고개를 돌린다.' }, { who: '엄마', text: '…잠깐만요.' }, { who: null, text: '엄마가 일어나 싱크대 쪽으로 가 선다.', id: 'stand' }],
      back: { who: null, text: '엄마가 다시 앉는다.' }, wait: { who: null, text: '엄마는 기다린다.' },
      tail: [{ who: null, text: '엄마는 말없이 화면만 본다.' }, { who: '엄마', text: '…형사님이 들려준 거랑 같네요.' }],
      fallback: [{ who: '엄마', text: '…나중에 들을게요. 세아 오면, 그때 같이.' },
        { id: 'fifth', chips: [{ id: 'fifth', label: '다섯째 음, 올라가 있었어요.', edit: true, verb: 'say' }], timeoutMs: 10000, timeoutPick: 'fifth' },
        { who: '엄마', text: '{N} 씨가 들었으면 됐어요.' }],
      success: { id: 'win', chips: [{ id: 'know', label: '세아 씨는 제가 404호에 오기 전엔 제 이름을 알 수 없었어요.', edit: true, verb: 'say' },
        { id: 'yes', label: '…네.', verb: 'pick' }], timeoutMs: 8000, timeoutPick: 'yes', then: { who: '엄마', text: '……' } },
    },
  };
})();
