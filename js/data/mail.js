/* =========================================================
 * js/data/mail.js — 메일 (DESIGN §4.3; account seah.y@hanmail.net)
 * G.STORY.mails = [{id, from, addr, subj, body(string|fn→string|Node), t, show(), unread, preview}]
 * G.STORY.mailTpl.otp(code) → live mail object pushed by 해솔홈 (P5) via G.mail.push
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  G.STORY.mailAccount = 'seah.y@hanmail.net';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SEA_MAIL = [
    '이 메일이 도착했는데 내가 예약을 취소하지 않았다면,',
    '나는 아마 못 나간 거겠지.',
    '',
    '그럼 이 폰을 들고 있는 너는, 나간 거야. 그치?',
    '그래서 1년 뒤 아침 7시로 맞춰 놨어. 아침이면 좋겠어서.',
    '',
    '부탁 하나만 할게.',
    '우리 엄마한테 이 메일 좀 보여줘.',
    '',
    '엄마. 그날 전화 못 받은 거, 절대 엄마 잘못 아니야.',
    '콩이 산책은 하루에 두 번. 간식은 저녁에만.',
    '그리고 엄마,',
    '하루에 한 번만 나 생각해줘. 딱 한 번만.',
    '나머지 시간은 엄마 하고 싶은 거 하면서 살아.',
    '',
    '이름도 모르는 너한테.',
    '고마워. 진짜로.',
    '',
    '— 세아',
  ].join('\n');
  G.STORY.seaMailText = SEA_MAIL;

  G.STORY.mails = [
    /* END — 세아's scheduled mail (visible only after END; LEAD's ending scene shows its own card) */
    {
      id: 'sea_1yr', from: '윤세아', addr: 'seah.y@hanmail.net', tag: '예약 발송',
      subj: '1년 뒤에 이 메일을 읽을 누군가에게', t: '2026-11-24 07:00',
      show: () => G.flag('END'), star: true,
      preview: '이 메일이 도착했는데 내가 예약을 취소하지 않았다면,',
      body: () => {
        const name = G.NAME || '하루';
        let html = esc(SEA_MAIL);
        if (name === '하루') html = html.replace('하루에 한 번만', '<span class="ml-penu">하루에 한 번만</span>');
        return `<div class="ml-sched">예약 발송: 2025.11.23 23:58 → 2026.11.24 07:00</div><div class="ml-letter">${html}</div>`;
      },
      onOpen: () => {
        if ((G.NAME || '하루') !== '하루') return;
        setTimeout(() => {
          const u = document.querySelector('.ml-penu');
          if (u) { u.classList.add('on'); try { G.audio && G.audio.sfx.pen(); } catch (e) {} }
          try { G.notebook && G.notebook.note && G.notebook.note('…하루에 한 번만.'); } catch (e) {}
        }, 1500);
      },
    },

    /* 해솔홈 security notice (extra identity source for P7; never read by 세아) */
    {
      id: 'hs_newdev', from: '해솔홈', addr: 'no-reply@haesolhome.kr', subj: '[해솔홈] 새로운 기기에서 로그인했습니다', t: '2026-11-24 02:58',
      preview: 'Galaxy S21 (SM-G991N) · 서울 마포구',
      body: `<div class="ml-brand hs">해솔홈 <small>Haesol Smart Living</small></div>
<p>안녕하세요, 해솔홈입니다.<br>회원님의 홈(해솔빌 404호)에 새로운 기기가 로그인했습니다.</p>
<table class="ml-tbl"><tr><th>기기</th><td>Galaxy S21 (SM-G991N)</td></tr><tr><th>계정</th><td>sagongsa (관리자)</td></tr><tr><th>위치</th><td>서울 마포구 · 404호(실내)</td></tr><tr><th>일시</th><td>2026.11.24 02:58</td></tr></table>
<p>본인이 아니라면 앱에서 <b>비밀번호 찾기</b>로 계정을 확인하고, <b>기기 관리</b>에서 해당 기기를 차단하세요.</p>
<p class="ml-foot">본 메일은 발신 전용입니다.</p>`,
    },

    /* 관리비 — warns about the fake 관리실 (H5) */
    {
      id: 'fee_2611', from: '해솔빌 관리사무소', addr: 'noreply@haesolvil.kr', subj: '[해솔빌] 11월 관리비 고지서', t: '2026-11-01 09:00',
      preview: '404호 관리비 87,400원',
      body: `<div class="ml-brand hv">해솔빌 관리사무소</div>
<p><b>404호</b> 입주민께, 2026년 11월분 관리비를 안내드립니다.</p>
<table class="ml-tbl"><tr><th>일반관리비</th><td>32,000원</td></tr><tr><th>청소·경비</th><td>18,500원</td></tr><tr><th>승강기 유지</th><td>6,200원</td></tr><tr><th>세대 전기</th><td>21,900원</td></tr><tr><th>세대 수도</th><td>8,800원</td></tr><tr class="sum"><th>합계</th><td>87,400원</td></tr></table>
<p>납부기한: 2026.11.30 · 가상계좌는 관리사무소 게시판을 확인해 주세요.</p>
<div class="ml-warn">※ 관리사무소는 새벽 시간에 개인 문자·메신저를 보내지 않습니다. '관리실'을 사칭한 연락에 주의하세요. 문의 02-338-5120</div>`,
    },

    /* flavor: a year of mail nobody opened */
    {
      id: 'moa_2611', from: '모아마켓', addr: 'news@moamarket.kr', subj: '[광고] 세아님만을 위한 11월 혜택이 도착했어요', t: '2026-11-20 11:30',
      preview: '장바구니에 담아 둔 상품이 아직 기다리고 있어요',
      body: `<div class="ml-brand mo">모아마켓</div><p>세아님, 장바구니에 담아 둔 상품이 아직 기다리고 있어요.</p><table class="ml-tbl"><tr><th>강아지 겨울 패딩 (S)</th><td>담은 날 2025.11.19</td></tr><tr><th>LED 무드등</th><td>담은 날 2025.11.21</td></tr></table><p class="ml-foot">수신을 원하지 않으시면 수신거부를 눌러 주세요.</p>`,
    },
    {
      id: 'school_2602', from: '한빛예술대학교 학사지원팀', addr: 'haksa@hanbit-arts.ac.kr', subj: '[한빛예대] 2026학년도 1학기 휴학 연장 안내', t: '2026-02-10 10:00',
      preview: '윤세아 학생의 학적 처리 관련 안내드립니다',
      body: `<div class="ml-brand sc">한빛예술대학교</div><p>음향디자인과 4학년 윤세아 학생,</p><p>가족분의 요청에 따라 2026학년도 1학기 학적이 <b>휴학(연장)</b>으로 처리되었습니다.<br>복학을 원하시면 언제든 학과 사무실로 연락 주세요.</p><p>— 음향디자인과 사무실 드림. 모두가 기다리고 있습니다.</p>`,
    },

    /* 2025 — 세아's own mail */
    {
      id: 'school_1115', from: '한빛예대 음향디자인과', addr: 'sound@hanbit-arts.ac.kr', subj: '[졸업작품] 중간 발표 일정 안내', t: '2025-11-15 13:20',
      preview: '작품명: 「들리지 않는 방」(가제)', read: true,
      body: `<div class="ml-brand sc">한빛예대 음향디자인과</div><p>4학년 졸업작품 중간 발표 일정을 안내합니다.</p><table class="ml-tbl"><tr><th>학생</th><td>윤세아</td></tr><tr><th>작품명</th><td>「들리지 않는 방」(가제)</td></tr><tr><th>일시</th><td>11/21(금) 14:00</td></tr><tr><th>장소</th><td>B103 (스튜디오 2)</td></tr></table><p>발표 10분 · 시연 5분. 스테레오/모노 재생 환경을 모두 준비해 오세요.</p>`,
    },
    {
      id: 'moa_1027', from: '모아마켓', addr: 'order@moamarket.kr', subj: '주문하신 상품이 배송 완료되었습니다', t: '2025-10-28 13:21',
      preview: '문틈 막이 바람막이 2m (화이트) 외 1건', read: true,
      body: `<div class="ml-brand mo">모아마켓</div><p>세아님, 주문하신 상품이 배송 완료되었습니다.</p><table class="ml-tbl"><tr><th>상품</th><td>문틈 막이 바람막이 2m (화이트) 외 1건</td></tr><tr><th>함께 주문</th><td>도어 가드 보조 잠금장치</td></tr><tr><th>받는 곳</th><td>해솔빌 404호 (문 앞)</td></tr></table><p class="ml-foot">상품은 마음에 드셨나요? 리뷰를 남겨 주세요.</p>`,
    },
  ];

  /* live mail templates */
  G.STORY.mailTpl = {
    otp: (code) => ({
      from: '해솔홈', addr: 'no-reply@haesolhome.kr', subj: '[해솔홈] 본인확인 인증번호 안내', otp: true,
      preview: `요청하신 인증번호는 [ ${code} ] 입니다.`,
      body: `<div class="ml-brand hs">해솔홈 <small>Haesol Smart Living</small></div>
<p>안녕하세요, 해솔홈입니다.</p>
<p>요청하신 인증번호는</p><div class="ml-otp">[ ${code} ]</div><p>입니다.</p>
<p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
<div class="ml-warn">※ 해솔홈은 절대 전화·메시지로 '승인 요청을 대신 눌러 달라'고 하지 않습니다. 로그인 승인 요청을 받았는데 본인이 시도한 것이 아니라면 반드시 [거부]를 눌러 주세요.</div>`,
    }),
  };
})();
