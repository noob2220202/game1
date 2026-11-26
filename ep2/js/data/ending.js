/* =========================================================
 * ep2/js/data/ending.js (flow, optional) — G.STORY.ending: every card string of DESIGN_EP2 §3.17 · §3.19 ·
 * §4.10.2–§4.10.11, verbatim (⊕ lines included). Tokens are expanded by the renderer (G.T) at render time.
 * Lazy functions receive (f, v) = (flag reader, vars reader) so a line can depend on the run's state.
 * Read by ep2/js/ending.js; Kang's lines are cards (no chat), jimin / mom / {MAKER} chat lines are social's scripts.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  G.STORY.ending = {
    kang: '강수진',

    // 01:10 — B20 (after the door opens) §4.10.2
    k0110: { time: '오전 1:10', scene: ['문 앞에 강수진이 서 있다. 손전등을 바닥으로 내린다.'] },

    // 01:20 — '—' chip §3.17 · §4.10.3
    k0120: {
      time: '오전 1:20',
      lines: ["'—' 사용자 지우지 않으셨죠? 다행이에요.", '그 사람 메모랑 사진이 다 거기 있어요. 오늘 밤엔 그 사람이 다시 못 들어오게만 해 두죠.'],
      chips: [
        { id: 'lock', label: '전환 막아 두기', stage: ['e2_dash', 'locked'], lockDash: true, reply: ['네. 데이터는 그대로 남아요.'] },
        { id: 'keep', label: '그대로 두기', stage: ['e2_dash', 'kept'], reply: ['알겠어요. 오늘 저희가 사진으로 다 남겨 둘게요.'] },
      ],
    },

    // 01:40 — Kang's phone photo ① + near share §3.17 · §4.10.4
    k0140: {
      time: '오전 1:40',
      scene: ['강수진이 자기 휴대전화 화면을 보여 준다.'],
      img: 'pol_case',
      lines: ['11월 23일, 404호로 온 상자예요. 같은 케이스였어요.', '물탱크실 사진도 있어요. 보기 힘드시면 안 보셔도 돼요.'],
      share: { from: '강수진의 휴대전화', count: 4 },
      declined: ['알겠어요.'],
    },

    // 01:50 — the returned phone §3.17 · §4.10.5
    k0150: {
      time: '오전 1:50',
      lines: ['이 폰은 내일 아침 서에서 받을게요.', '원본을 내셔도 되고, 복제하고 돌려받는 방법도 있어요.'],
      chips: [
        { id: 'police', label: '원본 제출할게요', stage: ['e2_phone', 'police'] },
        { id: 'kept', label: '복제하고 돌려받을게요', stage: ['e2_phone', 'kept'] },
      ],
      after: ['오늘 밤엔 이 폰, {N} 님 곁에 두고 갈게요. 그 사람이 이 폰으로 연락해 오면 저희도 바로 알 수 있어요.'],
      wifi: '와이파이는 켜 둘게요.',
      out: ['강수진이 옥상으로 나간다. 물탱크실 쪽에 손전등 불빛이 여럿 오간다.'],
    },

    // 02:12 — {MAKER} §3.19 ① · §4.10.8 (C1: the DM is social's script m0212, then this card)
    k0212: {
      time: '오전 2:12',
      c1: ['계단을 뛰어 올라오는 발소리.'],
      noC1: ['계단을 뛰어 올라오는 발소리. 문 앞에서 경찰과 이야기하는 {MAKER_CONTACT}의 목소리.'],
    },

    // 02:15 — Kang's wrap (no chips, lines flow by themselves, one [계속]) §3.17 · §4.10.8′
    k0215: {
      time: '오전 2:15',
      scene: ['강수진이 옥상에서 돌아와 문 앞에 선다.'],
      lines: (f, v) => {
        const out = [];
        out.push(f('fingerDeleted') ? '지문 2, 지우셨네요. 잘하셨어요.' : '지문 2는요, 감식팀도 못 꺼낸대요. 내일 서에서 같이 지워요.');
        if (!f('toneRestored')) out.push('알림음도 그 사람이 바꿔 둔 거예요.');
        out.push('seah_y 계정엔 저희가 접속 알림을 걸어 뒀어요.');
        out.push('23시 41분에 그 사람이 계정 비밀번호를 또 바꿨어요. 내일 서에서 같이 되찾아요.');
        out.push('그 사람은 처음부터 이 폰을 열 수 있었어요. 404호 이사 날 밤부터 {N} 님을 보고 있었거든요. 폰 여시는 손까지요.');
        out.push('그래서 비밀번호는 그대로 두고, 지문이랑 잠금 해제만 더해 둔 거예요.');
        const by = v('sirenBy');
        const video = v('c2Src') === 'video';
        if (by === 'c2') out.push(video ? '옆 건물 2층 창가에서 스피커가 나왔어요. 그 소리 때문에 길 건너 주민 두 분이 신고하셨대요.'
          : '옆 건물 2층 창가에서 스피커가 나왔어요. 오르골 소리 때문에 길 건너 주민 두 분이 신고하셨대요.');
        else if (by === 'early') out.push(video ? '옆 건물 2층 창가에서 스피커가 나왔어요. 아까 그 소리로 길 건너에서 신고가 몇 번 들어와서, 순찰차가 조금 일찍 붙었대요.'
          : '옆 건물 2층 창가에서 스피커가 나왔어요. 아까 그 오르골 소리로 길 건너에서 신고가 몇 번 들어와서, 순찰차가 조금 일찍 붙었대요.');
        else out.push('옆 건물 2층 창가에 스피커가 있었어요.');
        out.push('그 스피커, 04시 44분 알람에 묶여 있었어요. 작게 틀어서 {N} 님을 난간 쪽으로 나오게 하려던 거예요.');
        out.push('새 폰을 지우면 {N} 님한테 남는 건 이 폰 하나니까요.');
        if (f('C1b')) out.push('{MAKER_CONTACT} 님이 드릴 소리 얘기로 다시 신고하셔서 순찰차가 바로 붙었어요.');
        else if (f('C1')) out.push('{MAKER_CONTACT} 님 신고가 먼저 들어와 있었어요.');
        else out.push('{MAKER_CONTACT} 님이 오시는 길에 먼저 신고하셨어요. 지민 씨 전화도 받았고요. 늦어서 죄송해요.');
        out.push(f('whereTank') ? '물탱크실이라고 말씀해 주셔서 순찰팀이 바로 옥상으로 올라갔어요.' : '옥상 물탱크실에 있었어요. 14일이요.');
        out.push('그 사람은 난간 넘어 옆 건물로 나갔어요. 지금 찾고 있어요.');
        if (f('makerStayDown')) out.push('올라오지 말라고 하셨다면서요. 끝까지 1층에서 기다리셨어요.');
        if (f('fakeReplied')) out.push('그 계정에 보내신 메시지는 저희가 확인할게요. 잘못하신 거 없어요.');
        return out;
      },
    },

    // 02:20 — letter (only when CONFIG.LETTERS.ep2) §4.10.9
    l0220: { time: '오전 2:20', head: '{MAKER}의 편지' },

    // 02:30 — credits §4.10.10
    credits: {
      title: '{N를} 위한 방탈출! 2 · 돌려줄게',
      maker: '만든 사람 {MAKER} · {N}에게',
      voice: '목소리: AI 음성 · 사진: AI 생성 + 직접 편집 · 소리: 전부 직접 합성',
      stats: '플레이 {m}분 · 힌트 {n}회',
      data: '이 게임은 아무 데이터도 보내지 않았어요. 카메라도, 마이크도 쓰지 않았어요.',
      ms: 20000,
    },

    // check card (after the credits only) §4.10.11
    check: [
      "폰을 잃어버렸다면 비밀번호를 바꾸고 '모든 기기에서 로그아웃'까지 한 뒤,",
      "계정의 '로그인된 기기·웹 세션' 목록을 직접 열어 남은 게 없는지 확인하세요.",
      '설정 › 생체 인식에 모르는 지문이, 설정 › 사용자에 모르는 사용자가 없는지 확인하세요.',
      "스마트 잠금의 '신뢰할 수 있는 장소·네트워크·기기'와 블루투스 '저장된 기기'도 확인하세요.",
      '스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366',
    ],

    next: '계속',
  };
})();
