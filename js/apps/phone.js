/* =========================================================
 * 전화: 키패드 (real DTMF tones), 최근기록, 연락처, 음성사서함, calling.
 * G.STORY.contacts = [{id, name, number, avatar, memo, show()}]
 * G.STORY.calls    = [{name|number, t, type:'missed'|'in'|'out', dur, count}]
 * G.STORY.voicemail= [{id, from, number, t, dur, play(api), transcript, show()}]
 * G.STORY.dial(number, api) -> handled? (custom call scripts; return false for default)
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const PH = (G.phoneApp = {});

  function contactFor(num) {
    const n = String(num).replace(/\D/g, '');
    return (G.STORY.contacts || []).find((c) => String(c.number).replace(/\D/g, '') === n && (!c.show || c.show()));
  }
  PH.contactFor = contactFor;
  function fmtNum(n) {
    const d = String(n).replace(/[^\d*#]/g, '');
    if (/^01\d{8,9}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    if (/^02\d{7,8}$/.test(d)) return d.length === 10 ? `02-${d.slice(2, 6)}-${d.slice(6)}` : `02-${d.slice(2, 5)}-${d.slice(5)}`;
    if (/^0\d{9,10}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return d;
  }
  PH.fmtNum = fmtNum;

  const ICON = {
    keypad: '<svg viewBox="0 0 24 24">' + [6, 12, 18].map((x) => [5, 10.5, 16].map((y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor"/>`).join('')).join('') + '<circle cx="12" cy="21" r="1.9" fill="currentColor"/></svg>',
    recent: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    contacts: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>',
    vm: '<svg viewBox="0 0 24 24"><circle cx="6.5" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.5" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 16h11" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  G.app('phone', {
    name: '전화',
    icon: G.ICONS.phone,
    dock: true,
    badge: () => (G.STORY.calls || []).filter((c) => c.type === 'missed' && !G.state.seen.calls).reduce((a, c) => a + (c.count || 1), 0) + (G.state.vars.liveMissed || 0) * (G.state.seen.calls2 ? 0 : 1),
    open(p) {
      let tab = (p && p.tab) || 'recent';
      const body = el('div');
      const tabs = el('div.ph-tabs');
      const scr = G.ui.screen({ title: '전화', body, cls: 'dial-screen' });
      scr.appendChild(tabs);
      function render() {
        body.innerHTML = ''; tabs.innerHTML = '';
        [['keypad', '키패드'], ['recent', '최근기록'], ['contacts', '연락처'], ['vm', '음성사서함']].forEach(([k, l]) => {
          const b = el('button' + (tab === k ? '.on' : ''), { html: ICON[k] + `<span>${l}</span>` });
          b.addEventListener('click', () => { G.audio.sfx.tap(); tab = k; render(); });
          tabs.appendChild(b);
        });
        scr.querySelector('.sv-title').textContent = { keypad: '키패드', recent: '최근기록', contacts: '연락처', vm: '음성사서함' }[tab];
        if (tab === 'keypad') body.appendChild(keypad(p && p.number));
        if (tab === 'recent') { body.appendChild(recents()); G.state.seen.calls = true; G.state.seen.calls2 = true; G.save(); G.phone.refreshBadges(); }
        if (tab === 'contacts') body.appendChild(contacts());
        if (tab === 'vm') body.appendChild(voicemail());
        G.bus.emit('phone:tab', tab);
      }
      render();
      G.phone.push(scr, { onResume: render });
    },
  });

  function keypad(prefill) {
    let num = prefill || '';
    const numEl = el('div.dial-num');
    const nameEl = el('div.dial-name');
    const subs = { '1': '', '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '*': '', '0': '+', '#': '' };
    function upd() { numEl.textContent = fmtNum(num); const c = contactFor(num); nameEl.textContent = c ? G.T(c.name) : ''; }
    const pad = el('div.dial-pad', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => {
      const b = el('button.dial-key', null, el('b', null, k), el('small', null, subs[k]));
      b.addEventListener('pointerdown', () => { G.audio.sfx.dtmf(k, 0.18, 0.13); });
      b.addEventListener('click', () => { if (num.length < 16) num += k; upd(); G.bus.emit('dial:key', { key: k, num }); });
      return b;
    }));
    const del = el('button.del', { html: '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9l5 6M17 9l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>' });
    del.addEventListener('click', () => { num = num.slice(0, -1); upd(); });
    G.ui.onLongPress(del, () => { num = ''; upd(); });
    const go = el('button.go', { html: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>' });
    go.addEventListener('click', () => { if (num) PH.call(num); });
    upd();
    return el('div', null, numEl, nameEl, pad, el('div.dial-call', null, el('span', { style: { width: '40px' } }), go, del));
  }

  function recents() {
    const list = (G.STORY.calls || []).concat(G.state.vars.liveCalls || []).slice().sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t));
    if (!list.length) return el('div.empty-state', null, '최근 기록이 없습니다');
    const node = G.ui.list(list.map((c) => {
      const ct = c.number ? contactFor(c.number) : null;
      const name = c.name || (ct && ct.name) || fmtNum(c.number) || '알 수 없음';
      const d = G.chat.parseT(c.t);
      return {
        cls: 'recent-row',
        title: G.T(name) + (c.count > 1 ? ` (${c.count})` : ''),
        sub: `${c.type === 'missed' ? '부재중 전화' : c.type === 'in' ? '수신 전화' : '발신 전화'}${c.dur ? ' · ' + c.dur : ''}${c.label ? ' · ' + G.T(c.label) : ''}`,
        meta: d ? `${d.getMonth() + 1}/${d.getDate()} ${G.util.fmtKTime(d)}` : '',
        onClick: () => { if (c.number) PH.call(c.number); else G.phone.toast('발신번호 표시제한 번호입니다'); },
      };
    }));
    node.querySelectorAll('.recent-row').forEach((r, i) => { if (list[i].type === 'missed') r.querySelector('.lr-title').classList.add('missed'); });
    return node;
  }

  function contacts() {
    const list = (G.STORY.contacts || []).filter((c) => !c.show || c.show()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return G.ui.list(list.map((c) => ({
      icon: c.avatar ? `<img src="${c.avatar}" alt="">` : `<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#c7c7cc;color:#fff;font-weight:700">${G.T(c.name).slice(0, 1)}</span>`,
      title: G.T(c.name),
      sub: fmtNum(c.number) + (c.memo ? ' · ' + G.T(c.memo) : ''),
      onClick: () => contactCard(c),
    })));
  }
  function contactCard(c) {
    const body = el('div', { style: { padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' } },
      el('div.call-avatar', { style: { width: '96px', height: '96px' }, html: c.avatar ? `<img src="${c.avatar}">` : '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg>' }),
      el('div', { style: { fontSize: '26px', fontWeight: '600' } }, G.T(c.name)),
      el('div', { style: { color: '#888' } }, fmtNum(c.number)),
      c.memo ? el('div', { style: { color: '#666', fontSize: '14px', whiteSpace: 'pre-line', textAlign: 'center', marginTop: '6px', background: '#f4f4f6', padding: '10px 14px', borderRadius: '10px' } }, G.T(c.memo)) : null,
      (c.extra || []).map((x) => el('div', { style: { color: '#666', fontSize: '13.5px' } }, G.T(x))),
      el('button.btn.accent', { style: { marginTop: '16px' }, onclick: () => PH.call(c.number) }, '📞 전화 걸기'));
    G.phone.push(G.ui.screen({ title: '연락처', body }));
    G.bus.emit('contact:open', c.id);
    c.onOpen && c.onOpen();
  }

  function voicemail() {
    const list = (G.STORY.voicemail || []).filter((v) => !v.show || v.show());
    if (!list.length) return el('div.empty-state', null, '음성 메시지가 없습니다');
    const wrap = el('div');
    list.forEach((v) => {
      const d = G.chat.parseT(v.t);
      const sub = el('div', { style: { fontSize: '13px', color: '#888', marginTop: '4px', whiteSpace: 'pre-line', lineHeight: '1.5' } }, v.transcript ? '📝 ' + G.T(v.transcript) : '');
      const btn = el('button.btn', { style: { marginTop: '10px', padding: '8px 16px', fontSize: '14px' } }, '▶ 재생');
      let busy = false;
      btn.addEventListener('click', async () => {
        if (busy) return; busy = true; btn.textContent = '■ 재생 중…';
        G.audio.duck(0.7, 12);
        try { await v.play({ sub: (t, ms, cls) => G.fx.sub(G.T(t), ms, { cls }) }); } catch (e) { console.error(e); }
        btn.textContent = '▶ 다시 재생'; busy = false;
        G.flag('vm_' + v.id, true);
        G.bus.emit('voicemail:played', v.id);
      });
      wrap.appendChild(el('div.rec-item', { style: { borderBottom: '.5px solid #e5e5ea' } },
        el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, el('b', null, G.T(v.from || fmtNum(v.number) || '알 수 없음')), el('span', { style: { fontSize: '12px', color: '#888' } }, d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${G.util.fmtKTime(d)}` : '')),
        el('div', { style: { fontSize: '12.5px', color: '#888' } }, v.dur || ''), sub, btn));
    });
    return wrap;
  }

  /** place a call */
  PH.call = async function (number) {
    const c = contactFor(number);
    G.state.vars.liveCalls = (G.state.vars.liveCalls || []).concat([{ number, t: G.clock.now().getTime(), type: 'out' }]); G.save();
    G.bus.emit('call:out', number);
    const handler = G.STORY.dial;
    await G.phone.callScreen({
      name: c ? G.T(c.name) : fmtNum(number), number: c ? fmtNum(number) : '', incoming: false, avatar: c && c.avatar ? `<img src="${c.avatar}">` : null,
      async script(api) {
        if (handler) { const r = await handler(String(number).replace(/[^\d*#]/g, ''), api, c); if (r !== false) return; }
        api.status('연결 중…');
        await new Promise((res) => { const rb = G.audio.ringback(2, res); api._rb = rb; });
        if (api.isEnded()) return;
        await api.sub('지금 거신 전화는 사용자의 사정으로 연결할 수 없습니다.', 2600, 'sfx');
      },
    });
  };
})();
