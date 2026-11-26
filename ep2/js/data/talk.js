/* =========================================================
 * ep2/js/data/talk.js — 톡 (logged out · read-only records) · owner: social
 * DESIGN §3.21 톡 · §4.2 (strings verbatim) · §3.20.1 / §9.4 '윤세아' room (seaRoomMessages — v1.3 code)
 * ARCH §5.6 schema. This file never defines G.sd (it only reads it) and never writes any storage.
 * Privacy (§9.4 · §10 F): the ep1 save is READ at room-open time only; nothing from it is cached or saved.
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  /* player's ep1 line → max 40 chars (넘으면 …) — §3.20.1 */
  function clip40(s) {
    const a = Array.from(String(s || ''));
    return a.length > 40 ? a.slice(0, 40).join('') + '…' : a.join('');
  }

  /* §9.4 v1.3 code (verbatim logic; guards added only where another owner's data may be missing) */
  function seaRoomMessages() {                          // called every time the room opens (memory only)
    const out = [], T = G.T || ((s) => s);
    let e1 = null;
    const showMine = !G.settings || G.settings.e1MyMsgs !== false;   // 일시정지 › 개인정보 › '내가 보낸 말 다시 보이기' — default ON
    try { const s = JSON.parse(localStorage.getItem('haru-escape.save.v1')); if (s && s.v === 1 && s.threads) e1 = s.threads['talk:haru'] || null; } catch (e) {}
    const ok = (m) => m && typeof m.text === 'string' && m.text.trim() && !m.sys && !m.call && !m.deleted && !/🙂/.test(m.text);
    if (Array.isArray(e1) && e1.some(ok)) {
      const list = e1.filter(ok).map((m, i) => ({ m, i })).sort((a, b) => (a.m.t || 0) - (b.m.t || 0) || a.i - b.i).map((x) => x.m);
      let mine = showMine ? list.filter((m) => m.from === 'me') : [];   // the ep1 player's lines (sent from Sea's phone) → '윤세아' (left)
      if (mine.length > 6) mine = mine.slice(0, 3).concat(mine.slice(-3));   // first three + last three
      list.forEach((m) => {
        if (m.from === 'me' && !mine.includes(m)) return;
        const text = m.from === 'me' ? clip40(m.text) : m.text;            // his ep1 words verbatim, the player's 40 chars
        out.push({ from: m.from === 'me' ? 'them' : 'me', text, t: m.t, e1: m.from === 'me' });   // right = 나 (he, on {N}'s account)
      });
    } else {
      const lines = (G.STORY.e1canon && G.STORY.e1canon.haruLines) || [];
      lines.forEach((l) => out.push({ from: 'me', text: T(l.text), t: l.t }));
    }
    out.push({ from: 'me', deleted: true, label: '삭제된 메시지입니다', time: '오전 7:02', t: '2026-11-24 07:02' });   // ep1 JS3 slot — no recovery UI, no 🙂
    return out;
  }

  G.STORY.talk = {
    banner: '{$talkOut}',                                  // G.e2.STR.talkOut + [다시 로그인]
    relogLabel: '다시 로그인',
    listFoot: '이 기기에 저장된 대화만 표시됩니다.',
    noSend: '{$talkNoSend}',                               // every room's input slot
    threads: [
      { id: 'maker', name: '{MAKER_CONTACT}', preview: '폰 찾았어?', day: '11월 24일', avatar: 'maker',
        head: '이전 대화는 이 기기에 저장되어 있지 않습니다.',
        foot: '이 기기의 대화는 2026.11.25 오후 4:40 이후 업데이트되지 않습니다.',
        messages: [
          { id: 'tm1', from: 'them', t: '2026-11-24 07:58', text: '{N야} 괜찮아? 뉴스 봤어', read: true },
          { id: 'tm2', from: 'them', t: '2026-11-24 08:30', text: '전화 좀 받아!!', read: true },
          { id: 'tm3', from: 'them', t: '2026-11-24 12:10', text: '폰 찾았어?', read: true },
        ] },
      { id: 'sea', name: '윤세아', avatar: 'avatar_sea', initial: '윤', preview: '삭제된 메시지입니다', day: '11월 24일',
        foot: '이 기기의 대화는 2026.11.25 오후 4:40 이후 업데이트되지 않습니다.',
        messages: () => seaRoomMessages() },
    ],
    relogin: { title: '휴대전화 번호로 로그인', sent: '{$smsSent}', field: '인증번호 6자리', grey: 'SIM 없음', submit: '확인', wrong: '{$codeWrong}' },
  };
  G.STORY.talk.seaRoomMessages = seaRoomMessages;
})();
