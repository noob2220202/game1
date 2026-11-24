/* =========================================================
 * 전화 — DESIGN §4.4 (no SIM): 키패드, 최근기록, 연락처, 연락처 상세.
 * - any call → '전화를 걸 수 없음 · SIM 없음 (Wi-Fi 통화는 SIM이 필요합니다)'
 * - 112/119  → '긴급 통화 연결 실패 · 셀룰러 신호 없음'
 * - 관리실 contact card shows the 2025.11.25 04:10 edit by 다른 기기 → flag managerExposed
 * Hooks: G.STORY.dial(number, api, contact) may return !== false to take over a call.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);
  const PH = (G.phoneApp = {});

  const num = (c) => (typeof c.number === 'function' ? c.number() : c.number);
  const digits = (n) => String(n || '').replace(/[^\d*#]/g, '');
  function contacts() { return (G.STORY.contacts || []).filter((c) => !c.show || c.show()); }
  function contactFor(n) { const d = digits(n); if (!d) return null; return contacts().find((c) => digits(num(c)) === d); }
  PH.contactFor = contactFor;
  function fmtNum(n) {
    const d = digits(n);
    if (/^01\d{8,9}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    if (/^02\d{7,8}$/.test(d)) return d.length === 10 ? `02-${d.slice(2, 6)}-${d.slice(6)}` : `02-${d.slice(2, 5)}-${d.slice(5)}`;
    if (/^0\d{9,10}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    if (/^1\d{7}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
    return d;
  }
  PH.fmtNum = fmtNum;

  const ICON = {
    keypad: '<svg viewBox="0 0 24 24">' + [6, 12, 18].map((x) => [4.5, 10, 15.5].map((y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor"/>`).join('')).join('') + '<circle cx="12" cy="21" r="1.9" fill="currentColor"/></svg>',
    recent: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    contacts: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
    msg: '<svg viewBox="0 0 24 24"><path d="M12 3.5c5 0 9 3.3 9 7.4s-4 7.4-9 7.4c-.9 0-1.8-.1-2.6-.3L5 20l1-3.6C4.2 15 3 13.1 3 10.9 3 6.8 7 3.5 12 3.5z" fill="currentColor"/></svg>',
    talk: '<svg viewBox="0 0 24 24"><path d="M12 4c4.97 0 9 3.13 9 7s-4.03 7-9 7c-.6 0-1.2-.05-1.78-.14L6 20.5l.9-3.6C4.5 15.6 3 13.4 3 11c0-3.87 4.03-7 9-7z" fill="currentColor"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    in: '<svg viewBox="0 0 24 24"><path d="M17 7L7 17M15 17H7V9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    missed: '<svg viewBox="0 0 24 24"><path d="M4 8l6 6 4-4 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 13V8h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>',
    sim: '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  const SIL = '<svg viewBox="0 0 40 40"><circle cx="20" cy="15.5" r="7.2" fill="#fff"/><path d="M6.5 38c0-8 6-12.5 13.5-12.5S33.5 30 33.5 38z" fill="#fff"/></svg>';
  function avatar(c, cls) {
    const a = (c && c.avatar) || {};
    const n = el('span.ph-av' + (cls ? '.' + cls : ''), { style: { background: a.bg || '#c7c7cc' } });
    if (a.silhouette || !c) n.innerHTML = SIL; else n.textContent = a.emoji || a.initial || T(c.name).slice(0, 1);
    return n;
  }

  let lastTab = 'recent';
  G.app('phone', {
    name: '전화',
    icon: G.ICONS.phone,
    dock: true,
    badge: () => 0,
    open(p) {
      let tab = (p && p.tab) || lastTab;
      const body = el('div.ph-body');
      const tabs = el('div.ph-tabs');
      const scr = G.ui.screen({ title: '전화', body, cls: 'dial-screen' });
      scr.appendChild(tabs);
      function render() {
        lastTab = tab;
        body.innerHTML = ''; tabs.innerHTML = '';
        [['keypad', '키패드'], ['recent', '최근기록'], ['contacts', '연락처']].forEach(([k, l]) => {
          const b = el('button' + (tab === k ? '.on' : ''), { html: ICON[k] + `<span>${l}</span>` });
          b.addEventListener('click', () => { if (tab === k) return; G.audio.sfx.tap(); tab = k; render(); });
          tabs.appendChild(b);
        });
        scr.querySelector('.sv-title').textContent = { keypad: '키패드', recent: '최근기록', contacts: '연락처' }[tab];
        scr.classList.toggle('kp', tab === 'keypad');
        if (tab === 'keypad') body.appendChild(keypad(p && p.number));
        if (tab === 'recent') body.appendChild(recents());
        if (tab === 'contacts') body.appendChild(contactList());
        G.bus.emit('phone:tab', tab);
      }
      render();
      G.phone.push(scr, { onResume: render });
    },
  });

  /* ---------------- keypad ---------------- */
  function keypad(prefill) {
    let n = prefill || '';
    const numEl = el('div.dial-num');
    const nameEl = el('div.dial-name');
    const subs = { '1': '', '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '*': '', '0': '+', '#': '' };
    function upd() {
      numEl.textContent = fmtNum(n);
      numEl.classList.toggle('long', n.length > 11);
      const c = contactFor(n);
      nameEl.textContent = c ? T(c.name) : '';
      del.style.visibility = n ? 'visible' : 'hidden';
    }
    const padEl = el('div.dial-pad', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => {
      const b = el('button.dial-key', null, el('b', null, k), el('small', null, subs[k]));
      b.addEventListener('pointerdown', () => { try { G.audio.sfx.dtmf(k, 0.16, 0.12); } catch (e) {} });
      b.addEventListener('click', () => {
        if (n.length < 18) n += k;
        upd();
        G.bus.emit('dial:key', { key: k, num: n });
        if (n === '*#06#') { setTimeout(() => G.phone.dialog({ title: 'IMEI', text: 'IMEI 1  35 291811 ****** 4\nIMEI 2  35 291811 ****** 1\n\nS/N  R3CT40*****' }), 250); n = ''; upd(); }
      });
      return b;
    }));
    const del = el('button.del', { 'aria-label': '지우기', html: ICON.del });
    del.addEventListener('click', () => { n = n.slice(0, -1); upd(); });
    G.ui.onLongPress(del, () => { n = ''; upd(); });
    const go = el('button.go', { 'aria-label': '통화', html: ICON.call });
    go.addEventListener('click', () => { if (n) PH.call(n); else G.audio.sfx.error(); });
    upd();
    return el('div.kp-wrap', null, el('div.kp-sim', { html: ICON.sim + '<span>SIM 없음</span>' }), numEl, nameEl, padEl, el('div.dial-call', null, el('span.sp'), go, del));
  }

  /* ---------------- recents ---------------- */
  function recents() {
    const list = (G.STORY.calls || []).concat(G.state.vars.liveCalls || []).slice().sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t));
    const wrap = el('div.ph-recents');
    wrap.appendChild(el('div.ph-banner', null, el('span', { html: ICON.sim }), el('div', null, el('b', null, '2025년 11월 24일 이후 기록 없음'), el('small', null, 'SIM 없음 · 이 기기로 걸려 온 전화가 없습니다'))));
    let lastDay = null;
    list.forEach((c) => {
      const ct = c.number ? contactFor(c.number) : null;
      const d = G.chat.parseT(c.t);
      const dk = d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : '';
      if (dk && dk !== lastDay) { wrap.appendChild(el('div.ph-day', null, dk)); lastDay = dk; }
      const name = (ct && T(ct.name)) || (c.name && T(c.name)) || fmtNum(c.number) || '알 수 없음';
      const typeL = c.type === 'missed' ? '부재중' : c.type === 'in' ? '수신' : '발신';
      const row = el('div.ph-rec' + (c.type === 'missed' ? '.missed' : ''), null,
        avatar(ct, 'sm'),
        el('button.pr-main', { onclick: () => { G.audio.sfx.tap(); if (c.number) PH.call(c.number); } },
          el('div.pr-name', null, name),
          el('div.pr-sub', null, el('i.pr-type.' + c.type, { html: ICON[c.type] || ICON.out }), [ct ? '휴대전화' : (c.label || fmtNum(c.number)), typeL, c.note || c.dur].filter(Boolean).join(' · '))),
        el('div.pr-time', null, d ? G.util.fmtKTime(d) : ''),
        el('button.pr-info', { 'aria-label': '정보', html: ICON.info, onclick: () => { G.audio.sfx.tap(); if (ct) contactCard(ct); else unknownCard(c); } }));
      wrap.appendChild(row);
    });
    return wrap;
  }
  function unknownCard(c) {
    const body = el('div.ct-card', null, avatar(null, 'xl'), el('div.ct-name', null, fmtNum(c.number)), c.label ? el('div.ct-num', null, T(c.label)) : null,
      el('div.ct-actions', null, actBtn('call', '통화', () => PH.call(c.number)), actBtn('msg', '문자', () => noSim())));
    G.phone.push(G.ui.screen({ title: '', body, cls: 'ct-screen' }));
  }

  /* ---------------- contacts ---------------- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function initial(name) {
    const c = name.charCodeAt(0) - 0xac00;
    if (c >= 0 && c <= 11171) { const ch = CHO[Math.floor(c / 588)]; return { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' }[ch] || ch; }
    return /[a-z]/i.test(name[0]) ? name[0].toUpperCase() : '#';
  }
  function contactList() {
    const list = contacts().map((c) => ({ c, name: T(c.name) })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const wrap = el('div.ph-contacts');
    wrap.appendChild(el('div.ph-me', null, el('span.ph-av.lg', { html: '', style: { background: 'linear-gradient(160deg,#f6d7b0,#d79b5b)' } }, '🐶'),
      el('div', null, el('b', null, '윤세아'), el('small', null, '내 프로필 · 전화번호 없음 (SIM 없음)'))));
    const favs = list.filter((x) => x.c.fav);
    if (favs.length) {
      wrap.appendChild(el('div.ph-sec', null, '즐겨찾기'));
      favs.forEach((x) => wrap.appendChild(contactRow(x)));
    }
    let lastI = null;
    list.forEach((x) => {
      const i = initial(x.name);
      if (i !== lastI) { wrap.appendChild(el('div.ph-sec', null, i)); lastI = i; }
      wrap.appendChild(contactRow(x));
    });
    wrap.appendChild(el('div.ph-count', null, `연락처 ${list.length}개`));
    return wrap;
  }
  function contactRow(x) {
    return el('button.ph-ct', { onclick: () => { G.audio.sfx.tap(); contactCard(x.c); } }, avatar(x.c), el('span', null, x.name));
  }
  function actBtn(ic, label, fn) { return el('button.ct-act', { onclick: () => { G.audio.sfx.tap(); fn(); } }, el('span', { html: ICON[ic] }), el('small', null, label)); }
  function noSim() { G.audio.sfx.error(); G.phone.toast('SIM 카드가 없어 문자를 보낼 수 없습니다'); }

  function contactCard(c) {
    const talkOk = c.talk && G.chat && G.chat.thread('talk', c.talk) && (!G.chat.thread('talk', c.talk).show || G.chat.thread('talk', c.talk).show());
    const info = [];
    info.push(el('div.ct-row', null, el('div', null, el('small', null, '휴대전화'), el('b', null, fmtNum(num(c)))), el('div.ct-row-acts', null,
      el('button', { 'aria-label': '통화', html: ICON.call, onclick: () => PH.call(num(c)) }),
      el('button', { 'aria-label': '문자', html: ICON.msg, onclick: () => noSim() }))));
    if (c.memo) info.push(el('div.ct-row', null, el('div', null, el('small', null, '메모'), el('b', null, T(c.memo)))));
    if (c.created || c.edited) {
      info.push(el('div.ct-meta', null,
        el('div.ct-meta-h', null, '연락처 정보'),
        c.created ? el('div', null, el('span', null, '생성'), el('b', null, T(c.created))) : null,
        c.edited ? el('div.hl', null, el('span', null, '최종 수정'), el('b', null, T(c.edited))) : null));
    }
    const body = el('div.ct-card', null,
      avatar(c, 'xl'),
      el('div.ct-name', null, T(c.name)),
      el('div.ct-actions', null,
        actBtn('call', '통화', () => PH.call(num(c))),
        actBtn('msg', '문자', () => noSim()),
        talkOk ? actBtn('talk', '톡', () => G.phone.openApp('talk', { thread: c.talk })) : null),
      el('div.ct-box', null, info));
    G.phone.push(G.ui.screen({ title: '', body, cls: 'ct-screen' }));
    G.bus.emit('contact:open', c.id);
    if (c.exposes) {
      if (!G.flag('managerExposed')) SD.note('연락처 관리실 010-8817-3302 · 세아가 사라진 다음 날(2025.11.25 04:10) 다른 기기가 수정했다.');
      G.flag('managerExposed', true);
    }
    if (c.id === 'haru' && !G.state.vars.haruContactSeen) {
      G.state.vars.haruContactSeen = 1; G.save();
      SD.note('세아 폰에 내 연락처가 있다. 만든 건… 다른 기기. 어젯밤 11시 41분.');
    }
    c.onOpen && c.onOpen();
  }
  PH.contactCard = contactCard;

  /* ---------------- calling (no SIM) ---------------- */
  PH.call = async function (number) {
    const d = digits(number);
    const c = contactFor(d);
    const emergency = /^(112|119|911|122|113|182|1366)$/.test(d);
    G.state.vars.liveCalls = (G.state.vars.liveCalls || []).concat([{ number: d, t: G.clock.now().getTime(), type: 'out', note: emergency ? '긴급 통화 실패' : '연결 안 됨' }]);
    G.save();
    G.bus.emit('call:out', d);
    const handler = G.STORY.dial;
    await G.phone.callScreen({
      name: emergency ? '긴급 전화' : c ? T(c.name) : fmtNum(d), number: emergency ? d : c ? fmtNum(d) : '', incoming: false,
      async script(api) {
        if (handler) { try { const r = await handler(d, api, c); if (r !== false) return; } catch (e) { console.error(e); } }
        api.status(emergency ? '긴급 통화 연결 중…' : '발신 중…');
        await sleep(1100);
        if (api.isEnded()) return;
        G.audio.sfx.error && G.audio.sfx.error();
        if (emergency) {
          api.status('긴급 통화 연결 실패');
          await api.sub('셀룰러 신호 없음 (SIM 없음)', 2600, 'red');
          SD.note('SIM이 없다. 112도 안 된다.');
        } else {
          api.status('전화를 걸 수 없음');
          await api.sub('SIM 없음 (Wi-Fi 통화는 SIM이 필요합니다)', 2600, 'sfx');
        }
        api.end(emergency ? '긴급 통화 연결 실패' : '전화를 걸 수 없음');
      },
    });
  };
})();
