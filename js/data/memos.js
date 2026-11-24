/* =========================================================
 * js/data/memos.js — 메모 data (DESIGN §3 P3/P4/H4, §4.2)
 * G.STORY.memos       — list rows (newest first by t)
 * G.STORY.memoLetter  — the locked letter "이 폰을 찾은 사람에게" (page 1 / page 2 / erase script)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const PAGE1 = [
    '이 폰을 찾은 사람에게.',
    '',
    '그 사람은 내 문자, 사진, 메모를 다 봐.',
    '이 화면도. 아마 지금 이 글도.',
    '근데 소리는 못 들어. 화면만 보거든.',
    '그래서 진짜 중요한 건 전부 소리에 숨겼어. 나 음향과잖아 ㅎ',
    '',
    '세 가지만 기억해.',
    '① 화면 맨 위, 배터리 옆에 작은 네모 아이콘이 있으면 그 사람이 지금 보고 있는 거야.',
    '② 네가 안 보면, 그 사람은 움직여.',
    '③ 옷장 쪽에서 노크 소리가 나도 절대 대답하지 마. 그 사람은 그걸로 사람이 깼는지 확인해.',
    '',
    "현관 도어락은 그 사람이 '관리자 잠금'으로 잠가.",
    '관리자 비밀번호는 여섯 자리야. 내가 아는 걸 세 군데에 나눠 숨겼어.',
    " ① 11월 20일 새벽 '소리 감지 녹음'. 도어락 소리를 잘 들어. 앞에 두 번은 들려.",
    " ② '잡음 (지우지 마)'. 두 귀로 들으면 절대 안 들려. 소리를 하나로 합쳐.",
    ' ③ 마지막 두 자리는 못 알아냈어. 근데 그 사람은 뭐든 사진으로 찍어 둬.',
    '    그 사람이 숨긴 사진 속에 있을 거야.',
    '',
    '비밀번호만으로는 안 열려. 그 사람이 다른 데서 다시 잠가.',
    '그 사람을 먼저 끊어.',
    "그 사람이 '허용' 누르라고 하면 절대 누르지 마.",
    '',
    '관리실은 믿지 마. 진짜 관리실 번호는 문에 붙어 있어.',
    '',
    '그 사람이 옷장에서 나오면 화면 빛을 가려. 빛 보고 와. 숨도 참아.',
    '',
    '내가 마지막에 올린 글들, 첫 글자만 읽어. 시간 순서대로.',
    '',
    '미안해. 너는 꼭 나가.',
  ].join('\n');

  const PAGE2 = [
    '2쪽.',
    '',
    '처음엔 내가 예민한 줄 알았어.',
    '3월에 옷장 고친다고 기사님 왔을 때부터 이상했는데.',
    '',
    '10월에 저장공간 보다가 알았어. 계산기가 2.1GB야.',
    '사진이 들어 있는 거야. 근데 난 못 열었어.',
    '',
    "화면 위 네모 아이콘은 '화면 공유'래. 우리 집엔 TV도 없는데.",
    '끄면 다음 날 또 켜져 있어. 그래서 이제 안 꺼. 끄면 그 사람이 알아.',
    '',
    '22일 밤엔 자는 척하고 봤어. 문 앞에서 누르는 손가락.',
    '가운데 두 자리. 여기엔 안 써. 잡음 녹음에 넣어 뒀어.',
    '',
    '그 사람 계정 이름도 봤어. sagongsa. 사공사.',
    '우리 집 호수로 이름을 지은 거야.',
    '',
    '옷장 안쪽 벽, 두드리면 통통 소리 나. 비어 있어.',
    '엄마한테는 말 못 했어. 걱정할까 봐. 바보같이.',
    '',
    '지민아. 이거 보면 내 글 순서대로 다시 읽어줘.',
  ].join('\n');

  G.STORY.memoLetter = {
    id: 'letter',
    title: '이 폰을 찾은 사람에게',
    t: '2025-11-23 23:58',
    page1: PAGE1,
    page2: PAGE2,
    /** what survives the live erase (title + first 2 lines) */
    keep: '이 폰을 찾은 사람에게.\n\n그 사람은 내 문자, 사진, 메모를 다 봐.',
    /** the paragraph whose arrival on screen starts the erase early (¶3) */
    triggerLine: '세 가지만 기억해.',
    /** the line that links to page 2 */
    page2Line: '내가 마지막에 올린 글들, 첫 글자만 읽어. 시간 순서대로.',
    /** his line that passes during the undo rewind (heavier weight), inserted after hisAfter */
    hisAfter: '이 화면도. 아마 지금 이 글도.',
    hisLine: '다 읽었어 세아야. 이제 {N} 차례.',
    /** his live reaction typed & deleted after the undo. (DESIGN had '흔들지 마.' for shake-to-undo;
     *  the client override removed shaking, so he reacts to the undo itself.) */
    reaction: '되돌리지 마.',
    banners: {
      editing: '✎ 알 수 없는 기기에서 편집 중…',
      done: '편집 완료 · 다른 기기',
      rewind: '↶ 실행 취소 중…',
      pinned: '📌 이 기기에 고정됨',
    },
    caretFlag: '알 수 없는 기기',
    undoTitle: '실행 취소: 삭제',
    info: [
      ['2025. 11. 23. 오후 11:58', '작성 · 이 기기'],
      ['2026. 11. 24. 오전 3:12', '열람 · 다른 기기'],
    ],
    lock: {
      hint: '우리집 막내 · 영문 소문자 5자',
      answers: ['zhddl'],
      wrong: '비밀번호가 틀렸습니다',
      onlyLatin: '영문만 입력할 수 있어요',
    },
    page2Lock: {
      title: '2쪽',
      prompt: '내가 올린 마지막 글들, 첫 글자만. 시간 순서대로.',
      contains: '옷장',
      wrong: '비밀번호가 일치하지 않습니다',
    },
  };

  G.STORY.memos = [
    { id: 'letter', special: 'letter', title: G.STORY.memoLetter.title, t: G.STORY.memoLetter.t },
    { id: 'shopping', title: '장보기', t: '2025-11-22 18:40', checklist: ['콩이 사료', '귤', '우유', '테이프'] },
    { id: 'acoustics', title: '음향학 과제 메모', t: '2025-11-20 16:05',
      body: '위상 상쇄 실험: 같은 소리 + 위상 뒤집은 소리 = 0\n스테레오에선 각각 다른 잡음, 모노로 합치면 잡음만 사라지게 → 이거 써먹을 데 있을 듯' },
    { id: 'pw', title: '비번들', t: '2025-11-20 09:12', body: '와이파이 Haesol_404\n현관: 관리실이 바꿈ㅡㅡ' },
  ];
})();
