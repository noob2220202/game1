/* =========================================================
 * ep3/js/data/ending.js (flow) — G.STORY.ending: END sequence · tail 05:35–06:00 · credits · check card · hook
 * (DESIGN_EP3 §3.15 · §3.16 · §4.12 · ARCH_EP3 §6.3). Strings verbatim from DESIGN (⊕ lines included); tokens expanded by
 * the renderer (G.T). Lazy lines (cb) => string | null are evaluated by flow ending.js at render; null = the line is skipped.
 * Josa after the name always goes through a token ({N가} {N의} …), never a raw particle. {MAKER} appears only in the credits line. Readers: flow ending / hook.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const f = (n) => { try { return !!(G.flag && G.flag(n)); } catch (e) { return false; } };
  G.STORY = G.STORY || {};
  G.STORY.ending = {
    end: [{ who: null, text: '엄마가 일어나 부엌 불을 켠다.', id: 'e1' }, { who: null, text: '가스레인지 위 미역국 냄비에 불이 붙는다.', id: 'e2' },
      { who: '엄마', text: '괜찮대요. 우리 딸이 괜찮대요.', id: 'END' },                                   // drawn ⇒ END + commit ①
      { who: null, text: '엄마가 신발장 고리에서 목줄을 가져온다.', id: 'e4' }, { who: null, text: '세아 방 문 앞의 콩이가 일어난다.', id: 'e5' },
      { who: null, text: '엄마가 콩이에게 목줄을 채운다. 콩이가 엄마를 따라 부엌으로 간다.', id: 'e7' }],
    tail: { // §3.15 / §4.12.2 — order fixed; lazy lines read cb and flags
      t0535: [{ who: null, text: '지민이 부엌 입구에서 식탁으로 와 앉는다.', id: 'jiminSits' },
        { who: '지민', text: (cb) => (f('jiminChipSent') ? null : ({ yes: '그날 오르골 얘기 답해 줬을 때부터요, {N} 씨 말은 그냥 믿어져요.',
          no: '그날 끝내 대답은 안 했잖아요. 그래도 오늘 보니까 알겠어요. {N} 씨 맞아요.', none: '{N} 씨랑 같이 오니까 덜 무서워요.' })[cb('B')] || null) },
        { who: null, text: '엄마가 미역국을 네 그릇 뜬다. 한 그릇은 빈 자리 앞에 놓는다.', id: 'soupServed' },
        { who: '엄마', text: '세아 생일엔 늘 이렇게 놨어요. 작년에도요.' }, { who: '엄마', text: '세아가 좋아하던 거예요. 소고기 많이 넣었어요.' },
        { id: 'eat', chips: [{ id: 'eat', label: '잘 먹겠습니다.', edit: true, verb: 'say' }] },
        { who: '엄마', text: '많이 먹어요. 세아 몫까지.' },
        { who: '엄마', text: (cb) => (cb('C') ? '그 폰 아직 갖고 있어요? …나도 세아 번호 못 없앴어요.' : null) }],
      t0540: [{ who: '지민', text: '다음 달에 교수님이 세아 작품 정리하는 거 맡기셨어요.' }, { who: '엄마', text: '…세아가 좋아하겠다.' },
        { who: '지민', text: '그거 하면서, 세아 소리 다 들어 볼 거예요.', id: 'soundAll' }],
      kang: { sent: [{ who: null, text: '엄마가 {N의} 손에 있는 자기 폰을 본다. 형사님의 문자가 떠 있다.' }, { who: '엄마', text: '…합성일 수도 있대요. 확인 중이래요.' }],
        other: [{ who: null, text: '지민이 휴대전화를 본다. 아까 형사님께 보낸 문자의 답이다.' }, { who: '지민', text: '형사님이 합성일 수도 있대요. 그래도 확인해 보신대요.' }],
        played: { who: '엄마', text: '…괜찮아요. 나는 들었어요.' }, fallback: { who: '엄마', text: '…괜찮아요. {N} 씨가 들었잖아요.' } },
      dndFacts: { no331: ['그날 밤엔 전화 안 울리게 해 놓고 잤어요. 아침 일찍 나가니까요.'],
        lines: ['같은 번호로 3분 안에 또 오면 울리는 거였대요. …나중에 알았어요.', '세아는 한 번 걸었어요.', '그날 이후로 한 번도 안 켰어요.'],
        said: '…그 애는 그걸 미리 써 놨네요.' },              // chip = G.show.dndChip({ ctx:'tail', timeoutMs:10000 }) when ¬dndChipSaid
      albumFacts: { noBom: '현관에서 기다리는 콩이 사진도… 그 사람이 다 봤대요.',
        noAlbum: '형사님이 앨범에 그 사람 그대로 두래서, 그대로 뒀어요. 콩이 사진은… 이제 안 올려요.' },
      t0555: [{ who: '엄마', text: '{N} 씨, 폰.', id: 'phonePlease' }, { who: null, text: '엄마가 손을 내민다.' },
        { id: 'easyBack', chips: [{ id: 'big', label: '큰 글씨로 다시 해 두기', verb: 'pick' }, { id: 'keep', label: '그대로 드리기', verb: 'pick' }] }],
      big: [{ who: null, text: '{N가} 설정을 열어 쉬운 모드를 켠다. 홈 화면이 다시 큰 아이콘 여섯 개가 된다.', id: 'bigOn' }, { who: '엄마', text: '…세아가 해 준 거랑 똑같네요.' }],
      keep: [{ who: '엄마', text: '이게 원래 모양이에요? …천천히 배울게요. 세아 오면 물어보고요.' }],
      t0600: { who: null, text: '일요일 아침 여섯 시. 창밖은 아직 어둡다. 건너편 동에 불이 둘 켜져 있다.' }, next: '계속' },
    credits: ['{N를} 위한 방탈출! 3 · 엄마의 번호', '만든 사람 {MAKER} · {N}에게', '목소리: AI 음성 · 사진: AI 생성 + 직접 편집 · 소리: 전부 직접 합성',
      '통화 녹음·텍스트 변환의 동작은 게임 속 단순화입니다.', '이 게임은 아무 데이터도 보내지 않았어요.', '플레이 {m}분 · 힌트 {n}회'],
    check: ["가족 폰에 스팸 차단을 켜 드렸다면, 가끔 '차단된 통화·메시지' 기록을 같이 열어 보세요.", '가족·공유 앨범의 멤버 목록에 모르는 계정이 없는지 확인하세요.',
      '공유하는 사진에 집 호수가 보이면, 그 앨범을 누가 보는지 먼저 확인하세요.', '스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366'],
    checkNext: '계속',
    hook: { home: '처음 화면으로' },
  };
})();
