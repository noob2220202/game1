/* =========================================================
 * ep3/js/data/objectives.js (flow) — G.OBJECTIVES: the 13 notebook cards of DESIGN_EP3 §2.2 · §2.4 (show/done table) with
 * the §4.15 hint texts verbatim (T3 states the answer). Array order = hint-tab priority (§2.4). ARCH_EP3 §6.20.
 *   Record: { id, title, optional, greyAfter, show() → bool, done() → bool, hints:[T1, T2, T3] }
 *   greyAfter:'M8' (engine/notebook.js option) for block · dnd · album — left after M8 they turn quietly grey (hints readable).
 * Titles are strings already on screen when the card appears (§2.4 제목 규칙) — exceptions registered for the DEBUG
 * title auto-check (flow main.js): call · phone · soup@gotPhone (= soup only when it appeared through the gotPhone branch).
 * `easy` / `rec` appear when the 03:35 cards `easyCard` / `recCard` are drawn — flow call.js writes vars.fl.cardsDrawn.
 * Pure data: every predicate is lazy and guarded; no cross-owner call at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const f = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  const seen = (id) => { try { const fl = G.state && G.state.vars && G.state.vars.fl; return !!(fl && fl.cardsDrawn && fl.cardsDrawn[id]); } catch (e) { return false; } };
  const stage = (k) => { try { return G.state && G.state.stage ? G.state.stage[k] : undefined; } catch (e) { return undefined; } };

  G.OBJECTIVES = [
    { id: 'call', title: '엄마', show: () => true, done: () => f('gotPhone'),
      hints: ['식탁에 누가 앉아 있다.', '부엌(270°)의 엄마를 눌러 본다.',
        '엄마를 누르고 기다린다. 3시 33분에 일이 일어난다. 통화가 끝나면 엄마가 휴대전화를 민다 — 잠금화면을 위로 민다.'] },

    { id: 'easy', title: '큰 글씨', show: () => seen('easyCard'), done: () => f('easyOff'),
      hints: ['엄마는 "세아가 큰 글씨로 해 놔서, 나는 이것밖에 몰라요."라고 했다.',
        "이 홈 화면은 엄마가 고른 게 아니다. 켜져 있다는 스위치는 보이는데, 그 안의 목록은 보이지 않는다. 큰 글씨 화면은 설정에서 고른 '모드'다.",
        "설정 › 디스플레이 › 쉬운 모드를 끈다. (설정 검색에 '글씨'나 '쉬운'을 쳐도 된다.)"] },

    { id: 'phone', title: '엄마 폰', show: () => f('gotPhone'), done: () => f('nameKnown') && f('blockBottom') && (f('albumOpened') || f('M5')),
      hints: ['엄마가 건 1년은 톡에 있다. 이 폰에 닿으려던 것이 그것뿐이었을까.',
        '녹음에는 듣기 말고도 볼 것이 있다. 세아가 막아 둔 전화도 기록은 남는다. 엄마의 콩이 사진은 엄마 혼자 보는 게 아니다.',
        "통화 녹음 › ⋯ › 텍스트 변환의 0:21 · 전화 › ⋮ › 설정 › 번호 차단 › 차단된 통화(맨 아래까지) · 사진 › 공유 앨범 '콩이' › 멤버와 현관 사진의 정보. 앞의 둘은 꼭 봐야 한다."] },

    { id: 'rec', title: '녹음', show: () => seen('recCard'), done: () => f('recPlayerOpened'),
      hints: ['엄마는 "녹음은 된대요. 형사님이 해 놨어요."라고 했다. 녹음은 전화 기능 안에 있다.',
        '쉬운 모드의 전화엔 메뉴가 없다. 표준 화면의 전화 앱 오른쪽 위 ⋮ › 설정. 최근 기록의 🎙도 같은 곳으로 간다.',
        "전화 › ⋮ › 설정 › 통화 녹음 › 녹음된 통화 › '세아 💛 · 보이스톡'."] },

    { id: 'text', title: '텍스트 변환', show: () => f('textAnyOpened'), done: () => f('nameKnown'),
      hints: ['녹음 파일의 메뉴(⋯ · 목록의 ⋮)엔 듣기 말고도 할 수 있는 게 있다.',
        '텍스트 변환의 흐린 글자는 기계가 잘 못 알아들은 곳이다. 줄을 누르면 그 자리부터 들린다.',
        "'세아 💛 · 보이스톡' 녹음의 ⋯ › 텍스트 변환 → 0:21의 흐린 '{N야}' 줄을 눌러 끝까지 듣는다. 내 이름이다."] },

    { id: 'block', title: '차단된 통화', show: () => f('blockOpened'), done: () => f('blockBottom') && f('momBlock'), greyAfter: 'M8',
      hints: ['세아는 엄마 폰에 큰 글씨 말고도 해 준 것이 있다. 막아 둔 전화는 울리지 않고, 최근 기록에도 섞이지 않는다.',
        '전화 › ⋮ › 설정 › 번호 차단 › 차단된 통화. 끝까지 내려 날짜와 시각을 본다. 그 화면을 엄마에게도 보여 드린다.',
        "13통 모두 매달 24일 오전 3:31, 0초. 맨 아래까지 본 뒤, 엄마가 있는 곳에서 그 화면을 띄우고 '엄마에게 보여 드리기'를 누른다. 엄마가 세아 방에 있으면 카메라로 현관(0°)을 보고 오른쪽의 세아 방 문을 누르면 들어간다."] },

    { id: 'dnd', title: '방해 금지', optional: true, show: () => f('dndOpened'), done: () => f('momDnd'), greyAfter: 'M8',
      hints: ['2025년 11월 24일 오전 3:31, 엄마의 폰은 울리지 않았다.',
        '엄마는 밤마다 전화가 울리지 않게 해 두고 잤다. 설정 › 알림 › 방해 금지 — 예외와 마지막 사용, 사용 기록.',
        "'반복 전화 허용 — 3분 안에 같은 번호로 다시 걸려 오면 울립니다.' 엄마가 있는 곳에서 이 화면을 띄우고 '엄마에게 보여 드리기'(선택 — 엄마가 세아 방에 있으면 카메라로 현관(0°) 오른쪽의 세아 방 문을 누르면 들어간다)."] },

    { id: 'album', title: "공유 앨범 '콩이'", show: () => f('albumOpened'), done: () => f('albumDone'), greyAfter: 'M8',
      hints: ['콩이 사진을 엄마 혼자 보는 게 아니다.',
        "공유 앨범 '콩이' › ⋮ › 멤버. 그리고 엄마가 올린 현관 사진의 정보(ⓘ).",
        "sagongsa · 참여 2025-03-10 15:24. 현관 콩이 사진마다 '봄 · sagongsa'. 11월 30일 사진 가장자리엔 현관 호수가 보인다."] },

    { id: 'door', title: '현관', show: () => f('M6'), done: () => f('doorDone'),
      hints: ['현관 쪽에서 소리가 났다.', '카메라로 현관(0°)을 본다. 세아 방에 있으면 방문을 눌러 거실로 나온다.',
        '현관을 보면 된다. 아무도 문을 열지 않는다. 기다리면 지나간다. 112는 걸어도, 안 걸어도 된다.'] },

    { id: 'room', title: '세아 방', show: () => f('M7'), done: () => f('memoryDone'),
      hints: ['엄마가 멈춘 곳은 노래의 다섯 번째 음이다.', '세아 방 책상. 어릴 적 세아가 그린 것이 있다. 오르골 설명서와 같은 노래다. 하나만 다르다.',
        "엄마가 세아 방에 있을 때 책상 위 그림('틀린 음!')을 연다. 설명서 · 오르골 자리 · 문틀을 열어도 된다."] },

    { id: 'play', title: '식탁', show: () => f('M8'), done: () => f('END'),
      hints: ['엄마는 그 녹음 속 자기 목소리를 들을 수 없다.',
        "텍스트 변환의 줄을 누르면 그 자리부터 재생된다. 엄마에게 필요한 건 '옛날 녹음이 아니라는' 증거다.",
        '엄마가 식탁에 앉아 있을 때 0:08 [허밍] 줄(또는 0:16 · 0:21)을 눌러 0:33까지 그대로 들려준다. 엄마가 자리를 떴으면 다시 앉을 때까지 기다린다.'] },

    { id: 'soup', title: '미역국', show: () => f('soupSeen0') || f('gotPhone'), done: () => f('END'),
      hints: ['엄마는 "미역국 끓여 놨어요. 아침에 같이 먹어요."라고 했다.', '아침은 오늘 밤의 일이 끝나면 온다. 따로 찾을 것은 없다.',
        '따로 할 일은 없다. 이 밤이 끝나면 아침에 엄마가 미역국을 데운다.'] },

    { id: 'easyBack', title: '큰 글씨로 다시 해 두기', optional: true, show: () => f('easyBackChip'), done: () => stage('easyBack') != null,
      hints: ['엄마가 손을 내밀었다. 폰을 돌려드릴 때다.', '엄마가 쓸 줄 아는 화면은 하나뿐이다.',
        "'큰 글씨로 다시 해 두기'나 '그대로 드리기' 중 하나를 누른다. 어느 쪽이든 이야기는 같다(선택)."] },
  ];
  G.OBJECTIVES.titleExceptions = ['call', 'phone', 'soup@gotPhone'];
})();
