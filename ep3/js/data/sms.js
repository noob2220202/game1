/* =========================================================
 * ep3/js/data/sms.js — 메시지 data (comms · DESIGN_EP3 §3.4 · §3.12 · §3.20.2 · §4.4 · §4.13 · ARCH_EP3 §6.12).
 * Read by engine/apps/sms.js (and through G.sms.renderThread by the easy-mode E5 screen).
 *   list     — conversation list rows (preview / when = §4.4.1 원문 · the 강수진 row is computed from its thread)
 *   threads  — static history (from 'them'|'me', d, hm, text) · `[{police}]` = G.STORY.names.police (never the literal)
 *   live     — delivered at run time by G.sms.deliver(id) (stamp = in-game clock at delivery · notif id = §4.13)
 *   chips    — 강수진 input-bar chips (queue rule ARCH §5.10) · reply = live id · keep = live id ([두기] reply, k341 only)
 * Lazy text (functions) is evaluated at render time; nothing here runs cross-owner code at load time.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};
  const flagOn = (n) => !!(G.flag && G.flag(n));

  G.STORY.sms = {
    title: '메시지',
    list: [
      { id: 'kang', name: '강수진 형사님', contact: 'kang' },
      { id: 'office', name: '[관리사무소]', preview: '1월 수도 검침이 1월 26일(화)에 있습니다.', readOnly: true },
      { id: 'web', name: '[Web발신]', preview: '급식실 겨울방학 근무 안내', readOnly: true },
      { id: 'parcel', name: '[택배]', preview: '고객님의 상품이 문 앞에 배송되었습니다. 11/30 18:36', readOnly: true },
    ],
    threads: {
      kang: [
        { id: 'k1225', from: 'them', d: '2026-12-25', hm: '09:40', text: '[{police}] 어머님, 강수진입니다. 오늘 오전에 전화드려도 될까요?' },
        { id: 'k1226a', from: 'them', d: '2026-12-26', hm: '13:30', text: '대전역 도착했습니다. 2시까지 찾아뵐게요.' },
        { id: 'k1226b', from: 'them', d: '2026-12-26', hm: '16:30', text: '오늘 시간 내 주셔서 감사합니다. 통화 녹음은 켜 두었습니다. 다른 설정은 손대지 않았어요.' },
        { id: 'k1226c', from: 'them', d: '2026-12-26', hm: '16:31', text: '세아 씨 톡과 앨범은 그대로 두시고, 새 사진은 올리지 말아 주세요. 연락은 문자로 부탁드립니다.' },
        { id: 'k1226d', from: 'me', d: '2026-12-26', hm: '17:02', text: '네 형사님 고맙습니다' },
        { id: 'k0115', from: 'them', d: '2027-01-15', hm: '10:20', text: '어머님, 크리스마스 새벽 메시지는 해외 회사라 회신이 오래 걸린대요. 계속 확인하고 있습니다.' },
        { id: 'k0121a', from: 'them', d: '2027-01-21', hm: '18:00', text: '어머님, 24일이 세아 씨 생일이죠. 무슨 일 있으시면 언제든 문자 주세요.' },
        { id: 'k0121b', from: 'me', d: '2027-01-21', hm: '18:12', text: '네 고마워요' },
      ],
      office: [{ id: 'o0120', from: 'them', d: '2027-01-20', hm: '09:30', text: '[관리사무소] 1월 수도 검침이 1월 26일(화)에 있습니다. 계량기 동파에 주의해 주세요.' }],
      web: [{ id: 'w1229', from: 'them', d: '2026-12-29', hm: '14:00', text: '[Web발신] 급식실 겨울방학 근무 안내 — 방학 중 조리실 소독·점검 일정은 조리팀 단톡방에서 안내드립니다. 따뜻한 연말 보내세요.' }],
      parcel: [{ id: 'p1130', from: 'them', d: '2026-11-30', hm: '18:36', text: '[택배] 고객님의 상품이 문 앞에 배송되었습니다. 11/30 18:36' }],
    },
    live: {
      k0341: { notif: 'N01', flag: 'kang341', text: '[{police}] 어머님, 강수진입니다. 방금 세아 씨 톡 계정에 접속 알림이 왔어요. 혹시 연락 오셨나요?' },
      k0341r: { notif: 'N02', texts: ['{N} 님, 고맙습니다.', '접속은 PC 버전이었어요. 어디서인지는 메신저 회사 회신이 와야 알 수 있어요. 며칠 걸립니다.', '녹음은 그대로 두세요. 아침에 받으러 가겠습니다.'] },
      k0341keep: { notif: 'N02p', text: '어머님, 주무시면 아침에 다시 연락드릴게요. 녹음은 그대로 두세요.' },
      kcall: { notif: 'N03', text: '[{police}] 지금 통화가 어렵습니다. 문자로 부탁드립니다.' },
      kname: { notif: 'N04', texts: ['…합성일 수도 있어요.', '확인 중입니다.'] },
      kblock: { notif: 'N05', texts: ['그 번호는 저희가 확인하겠습니다.', '알려 주셔서 고맙습니다.'] },
      k702: { notif: 'N06', text: '앨범 기록은 보전 요청하겠습니다. 어머님 앨범은 지금처럼 두셔도 됩니다.' },
      k0502: { notif: 'N07', flag: 'kang502', texts: [
        '[{police}] 어머님, 강수진입니다. 대전 지구대에서 연락받았습니다. 복도와 계단엔 아무도 없었다고 합니다.',
        '공동현관 CCTV는 아침에 관리사무소와 같이 확인하겠습니다.',
        () => (flagOn('kang341Sent')
          ? '어디서 접속했는지는 며칠 걸립니다. 크리스마스 새벽 메시지도 아직 회신을 기다리고 있습니다.'
          : '새벽 3시 33분 접속은 PC 버전이었고, 통화는 33초였어요. 어디서 접속했는지는 회사 회신이 와야 알 수 있어요. 며칠 걸립니다. 크리스마스 새벽 메시지도 아직 회신을 기다리고 있습니다.'),
        '아침 첫차로 대전에 내려가겠습니다. 문은 열지 마세요.',
      ] },
      kask: { notif: 'N08', text: '말씀드릴 수 없는 게 있어요. 죄송해요.' },
      kfree: { notif: 'N09', text: '네, 확인했습니다.', repeat: true },
    },
    chips: [
      { id: 'k341', when: 'kang341', until: 'kang502', flag: 'kang341Sent', reply: 'k0341r', keep: 'k0341keep',
        text: '{N}입니다. 어머님 폰으로 보내요. 3시 33분에 세아 씨 톡으로 보이스톡이 왔고, 어머님이 받으셨어요. 33초였고 녹음돼 있어요.' },
      { id: 'kname', when: 'nameKnown', flag: 'kangNameSent', reply: 'kname', text: '녹음 0:21에 제 이름이 들려요.' },
      { id: 'kblock', when: 'blockBottom', flag: 'kangBlockSent', reply: 'kblock', text: '어머님 폰 차단된 통화에 같은 번호가 13통 있어요. 매달 24일 오전 3시 31분이에요.' },
      { id: 'k702', when: 'saw702', flag: 'kang702Sent', reply: 'k702', text: '11월 30일 공유 앨범 사진에 현관 호수가 보여요.', bomSuffix: ' 그 사진들을 sagongsa가 봤다고 나와요.' },   // suffix frozen when drawn (§12.2 V30)
      { id: 'kask', when: 'kang502', flag: 'kangAskSent', reply: 'kask', text: '지금 어디까지 찾으셨어요?' },
    ],
    chipKeep: '두기',                                 // [두기] (§3.4) — [보내기] = the send button after the chip fills the field
    inputPh: '메시지 입력',
    menu: ['설정', '차단된 메시지'],                  // ⋮ (§4.4.1)
    settings: { title: '설정', rows: ['알림', '번호 및 스팸 차단', '글자 크기'] },
    emptyThread: '{$noChat}',                          // E5 / contact `문자` for a person with no conversation (§4.4.4 ⊕)
    replyMs: 40000, keepMs: 60000, callSmsMs: 60000, freeLimitMs: 600000, gapMs: [2000, 4000],
  };
})();
