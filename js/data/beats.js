/* Director data: watcher lines, his chat lines, micro ambience (design §4.1 {NAME} table, §6) */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.BEATDATA = {
    // shown (as his chat messages) when the player opens an app while mirroring, after F1
    watcher: {
      gallery: '사진 구경 재밌어?',
      memo: '거긴 이제 아무것도 없을 텐데',
      calculator: '계산 잘해?',
      recorder: '그거 그냥 잡음이야',
      moment: '세아 글 예쁘지',
      haesol: '거기 들어가서 뭐 하게',
      settings: '뭐 찾아?',
    },
    wrongPw: '틀렸네 ㅎ',
    returnLines: ['어디 갔다 왔어? {m}분 {s}초.', '화면 껐지. 그 사이에 나 좀 움직였어.', '이번이 {n}번째야.'],
    reloadLine: '새로고침? 그런다고 나가지는 거 아니야.',
    firstContactKnock: ['똑똑 해줘서 고마워 ㅎ', '{N야}.'],
    firstContact: ['착하네. 대답 안 하고.', '{N야}.'],
    momRead: '엄마한테 연락하지 마.',
    f2: ['배터리 4%네.', '얼마 안 남았다 우리.'],
    f3Seen: '사진 잘 봤어?',
    f3: '찾아봐. 다 있어.',
    cutBurst: ['…{N야}?', '화면 왜 안 보여', '뭐 했어', '다시 켜', '{N야}', '대답해', '대답해', '대답해'],
    managerFirst: [
      '404호 새로 입주하신 분 맞으시죠?',
      '새벽에 도어락 오류 신고가 들어와서 연락드려요 ^^',
      '문이 안 열리시면 도어락에 *0404# 눌러보세요. 초기화됩니다.',
      '그리고 붙박이장은 경첩이 고장나서 절대 여시면 안 됩니다. 다쳐요.',
    ],
    managerSorry: '죄송합니다 잘못 보냈네요 ^^',
    js3: '재밌었어? 다음 집에서 봐 🙂',
  };
})();
