/* =========================================================
 * 설정: Wi-Fi list, 알림 기록 (notification history incl. story-provided entries),
 * 디지털 웰빙, 연결된 기기, 휴대전화 정보, plus GAME options.
 * G.STORY.settings = { wifi:[{name, lock, signal, connected}], notifHistory:[{app, title, body, t}],
 *   devices:[{name, sub, bad}], about:{rows}, wellbeing:[{app, time}], extra:[{title, sub, onClick}] }
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el } = G.util;
  const ic = (bg, svg) => `<span class="set-ic" style="background:${bg};width:29px;height:29px;border-radius:7px;display:flex;align-items:center;justify-content:center">${svg}</span>`;
  const SV = {
    wifi: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0119 0M5.5 12.2a9.5 9.5 0 0113 0M8.6 15.4a5 5 0 016.8 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="#fff"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" fill="#fff"/><circle cx="12" cy="20.5" r="1.6" fill="#fff"/></svg>',
    hour: '<svg viewBox="0 0 24 24"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" fill="none" stroke="#fff" stroke-width="1.8"/></svg>',
    link: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="11" height="12" rx="2" fill="none" stroke="#fff" stroke-width="1.8"/><rect x="15" y="9" width="6" height="9" rx="1.5" fill="none" stroke="#fff" stroke-width="1.8"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    game: '<svg viewBox="0 0 24 24"><path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5.2 2L15 14H9l-1.8 2A3 3 0 012 14v-2a4 4 0 014-4z" fill="#fff"/></svg>',
  };
  function S() { return G.STORY.settings || {}; }

  G.app('settings', {
    name: '설정',
    icon: G.ICONS.settings,
    open() {
      const wrap = el('div');
      const scr = G.ui.screen({ title: '설정', cls: 'set-screen', body: wrap });
      const conn = (S().wifi || []).find((w) => w.connected);
      const grp = (rows) => { const g = el('div.set-group'); g.appendChild(G.ui.list(rows)); return g; };
      wrap.append(
        grp([{ icon: ic('#0a84ff', SV.wifi), title: 'Wi-Fi', meta: conn ? conn.name : '끔', onClick: wifi }, { icon: ic('#30b0c7', SV.link), title: '연결된 기기', onClick: devices }]),
        grp([{ icon: ic('#ff3b30', SV.bell), title: '알림', sub: '알림 기록', onClick: notifHistory }, { icon: ic('#5856d6', SV.hour), title: '디지털 웰빙', sub: '오늘 사용 시간', onClick: wellbeing }]),
        grp((S().extra || []).filter((x) => !x.show || x.show()).map((x) => ({ icon: x.icon || ic('#8e8e93', SV.info), title: G.T(x.title), sub: x.sub ? G.T(x.sub) : null, onClick: x.onClick }))),
        grp([{ icon: ic('#8e8e93', SV.info), title: '휴대전화 정보', onClick: about }]),
        el('div.section-title', null, '게임'),
        grp([{ icon: ic('#7f1d1d', SV.game), title: '게임 설정', sub: '사운드 · 진동 · 공포 연출 · 글자 크기', onClick: gameOptions }]));
      G.phone.push(scr);
    },
  });

  function wifi() {
    const list = S().wifi || [];
    G.phone.push(G.ui.screen({ title: 'Wi-Fi', cls: 'set-screen', body: el('div', null, el('div.set-group', null, G.ui.list(list.filter((w) => !w.show || w.show()).map((w) => ({ title: (w.connected ? '✓ ' : '') + G.T(w.name), sub: w.connected ? '연결됨' : (w.sub ? G.T(w.sub) : null), meta: (w.lock ? '🔒 ' : '') + '📶', onClick: () => (w.onClick ? w.onClick() : G.phone.toast(w.connected ? '연결되어 있습니다' : '비밀번호가 필요합니다')) }))))) }));
    G.bus.emit('settings:wifi');
  }
  function devices() {
    const list = S().devices || [];
    G.phone.push(G.ui.screen({ title: '연결된 기기', cls: 'set-screen', body: el('div.set-group', null, G.ui.list(list.filter((d) => !d.show || d.show()).map((d) => ({ title: G.T(d.name), sub: G.T(d.sub || ''), onClick: d.onClick })))) }));
    G.bus.emit('settings:devices');
  }
  function notifHistory() {
    const story = (S().notifHistory || []).filter((n) => !n.show || n.show());
    const live = (G.state.notifs || []).map((n) => ({ app: n.app, title: n.title, body: n.body, t: n.time }));
    const all = live.concat(story).sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t));
    const body = el('div', null, el('div.section-title', null, '최근 24시간 동안 받은 알림 (삭제된 메시지 포함)'),
      el('div.set-group', null, G.ui.list(all.map((n) => { const d = G.chat.parseT(n.t); const a = G.apps[n.app]; return { icon: a ? `<span style="width:29px;height:29px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:${a.icon.bg}">${a.icon.svg}</span>` : null, title: G.T(n.title || ''), sub: G.T(n.body || ''), meta: d ? G.util.fmtKTime(d) : '' }; }))));
    G.phone.push(G.ui.screen({ title: '알림 기록', cls: 'set-screen', body }));
    G.bus.emit('settings:notifHistory');
  }
  function wellbeing() {
    const list = S().wellbeing || [];
    const body = el('div', null, el('div.set-group', null, G.ui.list(list.filter((x) => !x.show || x.show()).map((x) => ({ title: G.T(x.app), sub: G.T(x.sub || ''), meta: x.time, onClick: x.onClick })))));
    G.phone.push(G.ui.screen({ title: '디지털 웰빙', cls: 'set-screen', body }));
    G.bus.emit('settings:wellbeing');
  }
  function about() {
    const rows = (S().about && S().about.rows) || [];
    G.phone.push(G.ui.screen({ title: '휴대전화 정보', cls: 'set-screen', body: el('div.set-group', null, G.ui.list(rows.map(([k, v]) => ({ title: G.T(k), meta: G.T(v) })))) }));
    G.bus.emit('settings:about');
  }
  function gameOptions() {
    const s = G.settings;
    const row = (label, key, opts) => {
      const seg = el('div.seg', { style: { borderColor: '#ccc' } }, opts.map(([v, l]) => {
        const b = el('button' + (s[key] === v ? '.on' : ''), { style: { color: s[key] === v ? '#fff' : '#666' } }, l);
        b.addEventListener('click', () => { s[key] = v; G.saveSettings(); gameOptionsRefresh(); });
        return b;
      }));
      return el('div.list-row', { style: { justifyContent: 'space-between' } }, el('span', null, label), seg);
    };
    const wrap = el('div');
    function gameOptionsRefresh() {
      wrap.innerHTML = '';
      wrap.append(el('div.set-group', null,
        row('사운드', 'sound', [[true, '켜기'], [false, '끄기']]),
        row('진동', 'vibration', [[true, '켜기'], [false, '끄기']]),
        row('공포 연출', 'scares', [['full', '전부'], ['light', '약하게'], ['off', '없음']]),
        row('목소리', 'voice', [[true, '켜기'], [false, '끄기']]),
        row('글자 크기', 'textSize', [[0.92, '작게'], [1, '보통'], [1.1, '크게']])),
      el('div.set-group', null, G.ui.list([{ title: '처음부터 다시 하기', cls: 'danger', onClick: async () => {
        const ok = await G.phone.dialog({ title: '정말 처음부터?', text: '모든 진행 상황이 삭제됩니다.', buttons: [{ label: '취소', value: false }, { label: '초기화', value: true, style: 'danger' }] });
        if (ok) { G.resetSave(); location.reload(); }
      } }])));
    }
    gameOptionsRefresh();
    G.phone.push(G.ui.screen({ title: '게임 설정', cls: 'set-screen', body: wrap }));
  }
  G.settingsApp = { notifHistory, devices, wifi, wellbeing, about };
})();
