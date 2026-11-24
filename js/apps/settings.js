/* =========================================================
 * 설정 — DESIGN §4.8 (One UI-flavored).
 *  검색 (keywords) · 연결 › Wi-Fi / 블루투스 / 화면 공유(스마트뷰) [연결 끊기] → G.cutMirroring()
 *  알림 › 알림 기록 (story + live; 04:04 slip after managerSlip → managerExposed)
 *  손쉬운 사용 › 오디오 › 모노 오디오 → G.audio.setMono(on) + flag monoSeen · 흔들어서 실행 취소 · 글자 크기
 *  디지털 웰빙 (계산기 2시간 41분, hourly bars) · 저장공간 (계산기 2.1GB) · 배터리 · 휴대전화 정보
 * API: G.settingsApp.open(screenId) — 'cast'|'audio'|'notifHistory'|'wellbeing'|'storage'|...
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad, clamp } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);
  const S = () => G.STORY.settings || {};
  const mirroring = () => (G.mirroring ? G.mirroring() : G.flag('M1') && !G.flag('M5'));
  const isMono = () => { try { return G.audio.isMono ? G.audio.isMono() : !!G.state.vars.mono; } catch (e) { return false; } };
  const setMono = (on) => { try { if (G.audio.setMono) G.audio.setMono(on); else G.state.vars.mono = on; } catch (e) {} G.save(); };
  const cut = () => { if (G.cutMirroring) G.cutMirroring(); else G.flag('M5', true); };

  /* ---------------- icons ---------------- */
  const W = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const GL = {
    wifi: `<svg viewBox="0 0 24 24"><path ${W} d="M2.5 9a14 14 0 0119 0M5.5 12.2a9.5 9.5 0 0113 0M8.6 15.4a5 5 0 016.8 0"/><circle cx="12" cy="19" r="1.6" fill="#fff"/></svg>`,
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" fill="#fff"/><circle cx="12" cy="20.5" r="1.6" fill="#fff"/></svg>',
    sound: `<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path ${W} d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/></svg>`,
    display: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#fff"/><path ${W} d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`,
    batt: '<svg viewBox="0 0 24 24"><rect x="3" y="7.5" width="16" height="9" rx="2" fill="none" stroke="#fff" stroke-width="2"/><rect x="5" y="9.5" width="6" height="5" rx="1" fill="#fff"/><path d="M20.5 10.5v3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    storage: `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6.5" rx="7" ry="2.8" fill="none" stroke="#fff" stroke-width="2"/><path ${W} d="M5 6.5v11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-11M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/></svg>`,
    hour: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" ${W}/><path ${W} d="M12 7v5l3.2 2"/></svg>`,
    access: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.8" r="2" fill="#fff"/><path d="M4.5 8.5l7.5 1.5 7.5-1.5M12 10v4.5l-3 6M12 14.5l3 6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" ${W}/><path ${W} d="M12 11v5.5M12 7.8v.2"/></svg>`,
    game: '<svg viewBox="0 0 24 24"><path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5.2 2L15 14H9l-1.8 2A3 3 0 012 14v-2a4 4 0 014-4z" fill="#fff"/></svg>',
    link: `<svg viewBox="0 0 24 24"><path ${W} d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>`,
    bt: `<svg viewBox="0 0 24 24"><path ${W} d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9"/></svg>`,
    cast: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12.5" rx="2" ${W}/><path ${W} d="M3 20.5a3 3 0 013-3M3 16.5a6.5 6.5 0 016.5 4"/></svg>`,
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const ic = (bg, g) => el('span.st-ic', { style: { background: bg }, html: GL[g] || g });
  const APPCOL = { calculator: '#ff9f0a', talk: '#f7c600', gallery: '#ff375f', haesol: '#0f1b26', settings: '#8e8e93', memo: '#f4c430', recorder: '#ff453a', moment: '#c13584', mail: '#1e88e5', browser: '#007aff' };
  function appIcon(id) {
    const a = G.apps && G.apps[id];
    if (a && a.icon) return el('span.st-appic', { style: { background: a.icon.bg }, html: a.icon.svg });
    return el('span.st-appic', { style: { background: APPCOL[id] || '#8e8e93' } });
  }

  /* ---------------- building blocks ---------------- */
  function row(o) {
    const r = el('button.st-row' + (o.cls ? '.' + o.cls : ''), { disabled: o.disabled || null },
      o.icon || null,
      el('span.st-main', null, el('span.st-t', null, T(o.title)), o.sub ? el('span.st-s', null, T(o.sub)) : null),
      o.right || (o.meta ? el('span.st-meta', null, T(o.meta)) : null),
      o.onClick && !o.right && o.chev !== false ? el('span.st-chev', { html: GL.chev }) : null);
    if (o.onClick) r.addEventListener('click', (e) => { G.audio && G.audio.sfx.tap(); o.onClick(e, r); });
    if (o.id) r.dataset.sid = o.id;
    return r;
  }
  const group = (title, rows) => el('div.st-group-wrap', null, title ? el('div.st-gh', null, title) : null, el('div.st-group', null, rows.filter(Boolean)));
  function toggle(on, fn, opts) {
    opts = opts || {};
    const t = el('button.toggle' + (on ? '.on' : ''), { 'aria-label': opts.label || '켜기/끄기', role: 'switch', 'aria-checked': String(!!on) });
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = fn(!t.classList.contains('on'));
      if (r === false) { t.classList.add('nope'); setTimeout(() => t.classList.remove('nope'), 400); return; }
      t.classList.toggle('on'); t.setAttribute('aria-checked', String(t.classList.contains('on')));
      G.audio && G.audio.sfx.tap();
    });
    return t;
  }
  function slider(value, onChange, o) {
    o = o || {};
    const fill = el('i.sl-fill'), knob = el('b.sl-knob');
    const s = el('div.slider', { role: 'slider' }, el('span.sl-track', null, fill), knob);
    let v = clamp(value, 0, 1);
    const set = (x, fire) => { v = clamp(x, 0, 1); fill.style.width = v * 100 + '%'; knob.style.left = v * 100 + '%'; if (fire) onChange && onChange(v); };
    set(v);
    s.style.touchAction = 'none';
    const pos = (e) => { const r = s.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    s.addEventListener('pointerdown', (e) => { s.setPointerCapture(e.pointerId); s.classList.add('drag'); set(pos(e), true); });
    s.addEventListener('pointermove', (e) => { if (s.classList.contains('drag')) set(pos(e), true); });
    const up = () => { s.classList.remove('drag'); o.onEnd && o.onEnd(v); };
    s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
    return s;
  }
  function screen(title, body, cls) {
    const scr = G.ui.screen({ title, cls: 'st-screen' + (cls ? ' ' + cls : ''), body });
    G.phone.push(scr);
    return scr;
  }

  /* =========================================================
   * root
   * ========================================================= */
  G.app('settings', {
    name: '설정',
    icon: G.ICONS.settings,
    open(p) {
      if (p && p.screen && OPEN[p.screen]) { root(); OPEN[p.screen](p); return; }
      root();
    },
  });
  function root() {
    const list = el('div.st-root');
    const results = el('div.st-results');
    const field = G.ui.field({ placeholder: '설정 검색', mode: 'ko', submitLabel: '검색', onChange: (v) => doSearch(v), onSubmit: (v) => { G.ui.hideKeyboard(); doSearch(v); } });
    field.node.classList.add('st-search-f');
    const search = el('div.st-search', null, el('span', { html: GL.search }), field.node);
    const prof = el('button.st-prof', { onclick: () => G.phone.toast('seah.y@hanmail.net · 다른 기기 1대에서 로그인됨') },
      el('span.st-prof-av', null, '🐶'), el('div', null, el('b', null, '윤세아'), el('small', null, '계정 · seah.y@hanmail.net')));
    const castSub = () => (mirroring() ? '화면 공유 중 · sagongsa의 Galaxy' : 'Wi-Fi · 블루투스 · 화면 공유');
    const connRow = row({ icon: ic('#0a84ff', 'wifi'), title: '연결', sub: castSub(), onClick: () => OPEN.conn() });
    list.append(
      prof,
      group(null, [connRow]),
      group(null, [
        row({ icon: ic('#ff3b30', 'bell'), title: '알림', sub: '알림 기록 · 방해 금지', onClick: () => OPEN.notif() }),
        row({ icon: ic('#ff9f0a', 'sound'), title: '소리 및 진동', sub: '음량 · 진동', onClick: () => OPEN.sound() }),
        row({ icon: ic('#34c759', 'display'), title: '디스플레이', sub: '밝기 · 글자 크기', onClick: () => OPEN.display() }),
      ]),
      group(null, [
        row({ icon: ic('#30b0c7', 'batt'), title: '배터리', sub: `${G.phone.battery ? G.phone.battery() : 23}%`, onClick: () => OPEN.battery() }),
        row({ icon: ic('#5e5ce6', 'storage'), title: '저장공간', sub: '41.6GB / 128GB 사용 중', onClick: () => OPEN.storage() }),
        row({ icon: ic('#32d74b', 'hour'), title: '디지털 웰빙', sub: '하루 평균 사용 시간 · 앱 타이머', onClick: () => OPEN.wellbeing() }),
      ]),
      group(null, [
        row({ icon: ic('#0a84ff', 'access'), title: '손쉬운 사용', sub: '오디오 · 시인성 · 상호작용', onClick: () => OPEN.access() }),
        row({ icon: ic('#8e8e93', 'info'), title: '휴대전화 정보', sub: '세아의 Galaxy', onClick: () => OPEN.about() }),
      ]),
      group('게임', [row({ icon: ic('#7f1d1d', 'game'), title: '게임 설정', sub: '사운드 · 진동 · 공포 연출 · 글자 크기', onClick: () => gameOptions() })]));
    function doSearch(q) {
      const s = String(q || '').trim().toLowerCase().replace(/\s+/g, '');
      results.innerHTML = '';
      list.classList.toggle('hide', !!s);
      results.classList.toggle('in', !!s);
      if (!s) return;
      const hits = (S().search || []).filter((it) => it.title.replace(/\s+/g, '').toLowerCase().includes(s) || it.k.some((k) => { const kk = k.replace(/\s+/g, '').toLowerCase(); return kk.includes(s) || s.includes(kk); }));
      if (!hits.length) { results.appendChild(el('div.st-noresult', null, `'${q}'에 대한 결과 없음`)); return; }
      results.appendChild(group(`검색 결과 ${hits.length}개`, hits.map((it) => row({ title: it.title, sub: it.path, onClick: () => { G.ui.hideKeyboard(); OPEN[it.go] && OPEN[it.go]({ hl: it.hl }); } }))));
      G.bus.emit('settings:search', s);
    }
    const body = el('div', null, search, results, list);
    const scr = G.ui.screen({ title: '설정', cls: 'st-screen st-rootscr', body });
    G.phone.push(scr, { onResume: () => { connRow.querySelector('.st-s').textContent = castSub(); } });
  }

  const OPEN = {};
  /* ---------------- 연결 ---------------- */
  function castDur() {
    const now = G.clock.now();
    const start = new Date(2026, 10, 24, 0, 12, 0).getTime();
    const end = G.flag('M5') && G.state.vars.castCutAt ? G.state.vars.castCutAt : now.getTime();
    const s = Math.max(0, Math.floor((end - start) / 1000));
    return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  G.bus.on('flag:M5', () => { if (!G.state.vars.castCutAt) { G.state.vars.castCutAt = G.clock.now().getTime(); G.save(); } });
  OPEN.conn = function () {
    const castRow = row({ icon: ic(mirroring() ? '#ff9f0a' : '#8e8e93', 'cast'), title: '화면 공유(스마트뷰)', sub: mirroring() ? `연결됨 · sagongsa의 Galaxy · ${castDur()}` : '연결 안 됨', onClick: () => OPEN.cast(), id: 'cast' });
    const body = el('div', null,
      group(null, [
        row({ icon: ic('#0a84ff', 'wifi'), title: 'Wi-Fi', sub: 'Haesol_404 (관리자 네트워크)', onClick: () => OPEN.wifi() }),
        row({ icon: ic('#0a84ff', 'bt'), title: '블루투스', sub: '세아의 버즈 (연결 안 됨)', onClick: () => OPEN.bt() }),
        castRow,
      ]),
      group(null, [
        row({ icon: ic('#8e8e93', 'link'), title: '모바일 핫스팟 및 테더링', sub: 'SIM 없음', disabled: true }),
        row({ icon: ic('#8e8e93', 'link'), title: '데이터 사용', sub: 'SIM 없음 · 모바일 데이터 사용 불가', disabled: true }),
      ]));
    const scr = screen('연결', body);
    const t = setInterval(() => { if (!scr.isConnected) { clearInterval(t); return; } const s = castRow.querySelector('.st-s'); if (s) s.textContent = mirroring() ? `연결됨 · sagongsa의 Galaxy · ${castDur()}` : '연결 안 됨'; }, 1000);
    G.bus.emit('settings:conn');
  };
  OPEN.cast = function () {
    const wrap = el('div');
    function render() {
      wrap.innerHTML = '';
      const on = mirroring();
      const dur = el('b.cast-dur', null, castDur());
      const card = el('div.cast-card' + (on ? '.on' : ''), null,
        el('div.csc-top', null, el('span.csc-ic', { html: GL.cast }), el('div', null, el('b', null, 'sagongsa의 Galaxy'), el('small', null, on ? '연결됨 · 화면 미러링' : '연결 끊김'))),
        el('div.csc-rows', null,
          el('div', null, el('span', null, '연결 시작'), el('b', null, '오전 12:12')),
          el('div', null, el('span', null, on ? '연결 시간' : '연결 종료'), on ? dur : el('b', null, castDur())),
          el('div', null, el('span', null, '기기'), el('b', null, 'Galaxy S21 (SM-G991N)'))),
        on ? el('button.csc-cut', { onclick: confirmCut }, '연결 끊기') : el('div.csc-off', null, '이 휴대폰의 화면이 더 이상 다른 기기에 표시되지 않습니다.'));
      wrap.append(
        el('div.cast-hero', null, el('div.ch-ring' + (on ? '.on' : ''), { html: GL.cast }), el('b', null, on ? '화면 공유 중' : '화면 공유 꺼짐'), el('small', null, on ? '이 휴대폰의 화면이 아래 기기에 표시되고 있습니다.' : '근처의 기기를 찾으려면 Wi-Fi를 켜 두세요.')),
        el('div.st-gh', null, on ? '연결된 기기' : '최근 연결'), card,
        el('div.st-foot', null, '화면 공유는 화면만 전송합니다. 소리는 이 휴대폰에서만 재생됩니다.'));
      if (on) { const t = setInterval(() => { if (!dur.isConnected) { clearInterval(t); return; } dur.textContent = castDur(); }, 1000); }
    }
    async function confirmCut() {
      G.audio.sfx.tap();
      const ok = await G.phone.dialog({ title: '화면 공유를 중지할까요?', text: 'sagongsa의 Galaxy와의 연결이 끊기고, 이 휴대폰의 화면이 더 이상 표시되지 않습니다.', buttons: [{ label: '취소', value: false }, { label: '연결 끊기', value: true, style: 'danger' }] });
      if (!ok || !mirroring()) return;
      cut();
      G.bus.emit('settings:castCut');
      setTimeout(render, 150);
    }
    render();
    const off = G.bus.on('flag:M5', () => render());
    const scr = G.ui.screen({ title: '화면 공유(스마트뷰)', cls: 'st-screen', body: wrap });
    G.phone.push(scr, { onClose: off });
    G.bus.emit('settings:cast');
  };
  OPEN.wifi = function () {
    const nets = (S().wifi || []).filter((w) => !w.show || w.show());
    const bars = (n) => el('span.wf-bars', null, [1, 2, 3, 4].map((i) => el('i' + (i <= (n || 0) ? '.on' : ''))));
    const cur = nets.filter((w) => w.connected), others = nets.filter((w) => !w.connected);
    const body = el('div', null,
      group(null, [row({ title: 'Wi-Fi', right: toggle(true, () => { G.phone.toast('관리자 네트워크는 끌 수 없습니다'); return false; }) })]),
      group('현재 네트워크', cur.map((w) => row({ title: w.name, sub: typeof w.sub === 'function' ? w.sub() : w.sub, right: el('span.wf-r', null, w.lock ? el('i', { html: GL.lock }) : null, bars(w.signal)), onClick: () => wifiDetail(w) }))),
      group('사용 가능한 네트워크', others.map((w) => row({ title: w.name, sub: typeof w.sub === 'function' ? w.sub() : w.sub, right: el('span.wf-r', null, w.lock ? el('i', { html: GL.lock }) : null, bars(w.signal)), onClick: () => G.phone.toast('비밀번호를 모르는 네트워크입니다') }))));
    screen('Wi-Fi', body);
    G.bus.emit('settings:wifi');
  };
  function wifiDetail(w) {
    const free = G.flag('M6') || G.flag('netFree');
    const body = el('div', null,
      el('div.st-hero', null, el('span.st-ic.big', { style: { background: '#0a84ff' }, html: GL.wifi }), el('b', null, w.name), el('small', null, free ? '연결됨' : '연결됨 · 관리자 네트워크')),
      group(null, [
        row({ title: '관리', meta: '해솔홈 (관리자 계정)' }),
        row({ title: '발신 제한', meta: free ? '없음' : '톡 메시지 · 보이스톡 · 외부 검색', cls: free ? '' : 'warn' }),
        row({ title: 'IP 주소', meta: '192.168.0.104' }),
        row({ title: '보안', meta: 'WPA2-PSK' }),
      ]),
      el('div.st-foot', null, free ? '네트워크 제한이 해제되었습니다.' : '이 네트워크는 관리자가 일부 서비스를 제한하고 있습니다.'));
    screen('네트워크 정보', body);
  }
  OPEN.bt = function () {
    const body = el('div', null,
      group(null, [row({ title: '블루투스', right: toggle(true, () => { G.phone.toast('세아의 버즈를 찾을 수 없습니다'); return false; }) })]),
      group('등록된 기기', [row({ icon: ic('#8e8e93', 'bt'), title: '세아의 버즈', sub: '연결 안 됨 · 마지막 연결 2025.11.23', onClick: () => G.phone.toast('기기를 찾을 수 없습니다. 근처에 있는지 확인하세요.') })]));
    screen('블루투스', body);
  };

  /* ---------------- 알림 ---------------- */
  OPEN.notif = function () {
    const body = el('div', null,
      group(null, [
        row({ title: '알림 기록', sub: '사용 중 · 세아가 켬', onClick: () => OPEN.notifHistory(), id: 'nh' }),
        row({ title: '방해 금지', right: toggle(false, () => { G.phone.toast('방해 금지 모드를 켤 수 없습니다 (관리자 설정)'); return false; }) }),
        row({ title: '잠금화면 알림', meta: '내용 표시' }),
      ]),
      el('div.st-foot', null, '알림 기록을 켜 두면 삭제된 알림도 24시간 동안 볼 수 있습니다.'));
    screen('알림', body);
  };
  OPEN.notifHistory = function () {
    const story = (S().notifHistory || []).filter((n) => !n.show || n.show()).map((n) => Object.assign({}, n, { time: +G.chat.parseT(n.t) }));
    const seen = new Set(story.map((n) => n.app + '|' + T(n.body || '')));
    const live = (G.state.notifs || []).filter((n) => {
      const k = n.app + '|' + T(n.body || '');
      if (seen.has(k)) return false;
      if (G.flag('managerSlip') && n.app === 'talk' && /관리실/.test(n.title || '') && /사진|삭제/.test(n.body || '')) return false;
      seen.add(k);
      return true;
    }).map((n) => ({ app: n.app, title: n.title, body: n.body, time: n.time, appName: n.appName }));
    const all = live.concat(story).sort((a, b) => b.time - a.time);
    const today = new Date(G.clock.now()); today.setHours(0, 0, 0, 0);
    const wrap = el('div.nh-list');
    let lastSec = null;
    all.forEach((n) => {
      const d = new Date(n.time);
      const sec = d >= today ? '오늘' : '어제';
      if (sec !== lastSec) { wrap.appendChild(el('div.st-gh', null, sec)); lastSec = sec; }
      const a = G.apps && G.apps[n.app];
      const card = el('div.nh-item' + (n.slip ? '.slip' : '') + (n.sus ? '.sus' : ''), null,
        el('div.nh-top', null, appIcon(n.app), el('span.nh-app', null, n.appName || (a ? a.name : n.app)), el('span.nh-t', null, G.util.fmtKTime(d))),
        el('div.nh-title', null, T(n.title || '')),
        el('div.nh-body', null, T(n.body || '')),
        n.slip ? el('div.nh-del', null, '🗑 ' + T(n.deletedNote || '삭제된 메시지')) : null);
      if (n.img) {
        const img = el('div.nh-img');
        SD.bg(img, n.img);
        card.appendChild(img);
        card.addEventListener('click', () => { card.classList.toggle('open'); G.audio.sfx.tap(); if (card.classList.contains('open')) G.bus.emit('settings:slipViewed'); });
        card.appendChild(el('div.nh-more', null, '탭해서 크게 보기'));
      }
      wrap.appendChild(card);
    });
    const body = el('div', null,
      el('div.nh-head', null, el('b', null, '알림 기록'), el('span', null, '최근 24시간 동안 받은 알림 · 삭제된 알림 포함'), el('div.nh-on', null, '사용 중', toggle(true, () => { G.phone.toast('알림 기록을 끄면 지금까지의 기록이 지워집니다. 끄지 않았습니다.'); return false; }))),
      wrap);
    screen('알림 기록', body, 'nh-screen');
    G.bus.emit('settings:notifHistory');
    SD.note('그 사람 기기: SM-G991N');
    if (G.flag('managerSlip')) {
      if (!G.flag('managerExposed')) SD.note('알림 기록: 관리실이 보낸 사진 — 자고 있는 나. “아직 안 자네 ㅎ”. 반말. 관리실 = 그 사람.');
      G.flag('managerExposed', true);
    }
  };

  /* ---------------- 소리 / 디스플레이 ---------------- */
  OPEN.sound = function () {
    const s = G.settings;
    const body = el('div', null,
      group(null, [
        row({ title: '소리 모드', meta: '소리' }),
        row({ title: '진동', right: toggle(s.vibration !== false, (on) => { s.vibration = on; G.saveSettings(); }) }),
      ]),
      group('음량', [
        el('div.st-slrow', null, el('span', null, '미디어'), slider(s.volume != null ? s.volume : 0.9, (v) => { s.volume = v; try { G.audio.setVolume(v); } catch (e) {} }, { onEnd: () => G.saveSettings() })),
        el('div.st-slrow', null, el('span', null, '알림'), slider(0.7, () => {})),
      ]),
      el('div.st-foot', null, '이 게임의 소리에는 방향이 있습니다. 이어폰을 권장합니다.'));
    screen('소리 및 진동', body);
  };
  function textSizeControl() {
    const opts = [[0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']];
    const cur = G.settings.textSize || 1;
    const preview = el('div.ts-prev', null, '세아야 오늘로 1년이야.');
    const seg = el('div.ts-seg', null, opts.map(([v, l], i) => {
      const b = el('button' + (Math.abs(cur - v) < 0.03 ? '.on' : ''), { style: { fontSize: 12 + i * 3 + 'px' } }, '가', el('small', null, l));
      b.addEventListener('click', () => { G.audio.sfx.tap(); G.settings.textSize = v; G.saveSettings(); seg.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
      return b;
    }));
    return el('div.ts-box', null, preview, seg);
  }
  OPEN.display = function () {
    const body = el('div', null,
      group('글자 크기', [textSizeControl()]),
      group(null, [
        el('div.st-slrow', null, el('span', null, '밝기'), slider(0.35, () => {})),
        row({ title: '다크 모드', right: toggle(false, () => { G.phone.toast('관리자 설정으로 변경할 수 없습니다'); return false; }) }),
      ]),
      el('div.st-foot', null, '글자 크기는 게임 전체(톡, 메모 등)에 적용됩니다.'));
    screen('디스플레이', body);
  };

  /* ---------------- 배터리 ---------------- */
  OPEN.battery = function () {
    const b = G.phone.battery ? G.phone.battery() : 23;
    const mins = Math.max(4, Math.round(b * 2.6));
    const list = S().battery || [];
    const body = el('div', null,
      el('div.bt-hero', null, el('div.bt-big', null, `${b}`, el('small', null, '%')), el('div.bt-bar', null, el('i', { style: { width: Math.max(3, b) + '%' } })), el('small', null, `남은 사용 시간 약 ${mins}분 · 충전기를 연결하세요`)),
      group('마지막 완전 충전 이후 사용량', list.map((x) => el('div.bt-row' + (x.hot ? '.hot' : ''), null,
        el('div.bt-rt', null, el('b', null, x.hot && !mirroring() ? '시스템 서비스 (화면 공유 · 연결 끊김)' : x.name), el('span', null, x.pct + '%')),
        el('div.bt-rb', null, el('i', { style: { width: x.pct + '%' } }))))),
      group(null, [row({ title: '절전 모드', right: toggle(b <= 1, () => { G.phone.toast(b <= 1 ? '배터리가 부족해 절전 모드를 끌 수 없습니다' : '관리자 설정으로 변경할 수 없습니다'); return false; }) })]));
    screen('배터리', body);
    G.bus.emit('settings:battery');
  };

  /* ---------------- 저장공간 (H3) ---------------- */
  OPEN.storage = function () {
    const st = S().storage || { cats: [], apps: [] };
    const bar = el('div.sg-bar', null, st.cats.map(([n, gb, c]) => el('i', { style: { width: (gb / st.total) * 100 + '%', background: c }, title: n })));
    const legend = el('div.sg-legend', null, st.cats.map(([n, gb, c]) => el('span', null, el('i', { style: { background: c } }), `${n} ${gb}GB`)));
    const max = Math.max(...st.apps.map((a) => a.gb));
    const apps = st.apps.map((a) => {
      const r = el('button.sg-app' + (a.hot ? '.hot' : ''), null, appIcon(a.id),
        el('div.sg-am', null, el('div.sg-at', null, el('b', null, a.name), el('span', null, a.size)), el('div.sg-ab', null, el('i', { style: { width: (a.gb / max) * 100 + '%' } })), a.sub ? el('small', null, a.sub) : null));
      r.addEventListener('click', () => { G.audio.sfx.tap(); storageApp(a); });
      return r;
    });
    const body = el('div', null,
      el('div.sg-hero', null, el('div.sg-used', null, el('b', null, `${st.used}GB`), ` / ${st.total}GB 사용 중`), bar, legend),
      group('앱 (크기순)', apps));
    screen('저장공간', body);
    G.bus.emit('settings:storage');
    if (!G.state.vars.noteStorage) { G.state.vars.noteStorage = 1; G.save(); SD.note('저장공간: 계산기 2.1GB (이미지·동영상 2.0GB). 계산기에 사진이?'); }
  };
  function storageApp(a) {
    const hot = a.id === 'calculator';
    const body = el('div', null,
      el('div.st-hero', null, appIcon(a.id), el('b', null, a.name), el('small', null, `합계 ${a.size}`)),
      group(null, hot ? [
        row({ title: '앱', meta: '104MB' }),
        row({ title: '사용자 데이터', meta: '2.0GB', sub: '이미지·동영상', cls: 'warn' }),
        row({ title: '캐시', meta: '6MB' }),
      ] : [row({ title: '앱', meta: a.size }), row({ title: '캐시', meta: '0B' })]),
      group(null, [
        row({ title: '데이터 삭제', onClick: () => { G.audio.sfx.error(); G.phone.toast(hot ? '기기 관리자가 이 작업을 차단했습니다' : '삭제할 데이터가 없습니다'); }, chev: false }),
        row({ title: '캐시 삭제', onClick: () => { G.phone.toast('캐시를 삭제했습니다'); }, chev: false }),
      ]),
      hot ? el('div.st-foot', null, '마지막 사용: 오늘 오전 2:47') : null);
    screen('저장공간', body);
    if (hot) G.bus.emit('settings:calcStorage');
  }

  /* ---------------- 디지털 웰빙 (H3) ---------------- */
  OPEN.wellbeing = function () {
    const w = S().wellbeing || { week: [], apps: [] };
    const maxD = Math.max(...w.week.map((x) => x[1]));
    const chart = el('div.wb-week', null, w.week.map(([d, m], i) => el('div.wb-col' + (i === w.week.length - 1 ? '.today' : ''), null,
      el('div.wb-bar', null, el('i', { style: { height: (m / maxD) * 100 + '%' } })), el('small', null, i === w.week.length - 1 ? '오늘' : d))));
    const maxA = w.apps.length ? w.apps[0].min : 1;
    const apps = w.apps.map((a) => {
      const r = el('button.wb-app' + (a.hot ? '.hot' : ''), null, appIcon(a.id),
        el('div.wb-am', null, el('div.wb-at', null, el('b', null, a.name), el('span', null, a.time)), el('div.wb-ab', null, el('i', { style: { width: Math.max(2, (a.min / maxA) * 100) + '%' } }))));
      r.addEventListener('click', () => { G.audio.sfx.tap(); if (a.id === 'calculator') calcUsage(); else G.phone.toast(`${a.name} · 하루 평균 ${a.time}`); });
      return r;
    });
    const top = w.apps[0];
    const body = el('div', null,
      el('div.wb-hero', null, el('small', null, '지난 7일 하루 평균'), el('b', null, w.avg), chart),
      el('div.wb-top', null, el('small', null, '가장 많이 사용한 앱'), el('b', null, `${top.name} · 하루 평균 ${top.time}`)),
      group('앱 사용 시간', apps));
    screen('디지털 웰빙', body, 'wb-screen');
    G.bus.emit('settings:wellbeing');
    if (!G.state.vars.noteWellbeing) { G.state.vars.noteWellbeing = 1; G.save(); SD.note('디지털 웰빙: 가장 많이 쓴 앱이 계산기. 하루 평균 2시간 41분?'); }
  };
  function calcUsage() {
    const hrs = (S().wellbeing || {}).calcHours || [];
    const max = Math.max(1, ...hrs);
    const chart = el('div.wb-hours', { role: 'img', 'aria-label': '계산기 시간대별 사용: 새벽 2시~4시에 집중' },
      hrs.map((m, h) => el('div.wb-h' + (m > 0 ? '.on' : ''), null, el('i', { style: { height: Math.max(2, (m / max) * 100) + '%' } }), el('small', null, h % 6 === 0 ? `${h}시` : ''))));
    const body = el('div', null,
      el('div.st-hero', null, appIcon('calculator'), el('b', null, '계산기'), el('small', null, '하루 평균 2시간 41분')),
      el('div.wb-card', null, el('div.wb-ct', null, '시간대별 평균 사용 시간'), chart, el('div.wb-cap', null, '2025.11.25부터 매일 새벽 2시~4시에 사용됨')),
      group(null, [
        row({ title: '실행 횟수', meta: '하루 평균 3회' }),
        row({ title: '화면 켜짐', meta: '0회', sub: '화면이 꺼진 상태(원격)에서 사용됨', cls: 'warn' }),
        row({ title: '알림', meta: '0개' }),
        row({ title: '앱 타이머', meta: '설정 안 함' }),
      ]));
    screen('앱 사용 시간', body, 'wb-screen');
    G.bus.emit('settings:calcUsage');
    if (!G.state.vars.noteCalcHours) { G.state.vars.noteCalcHours = 1; G.save(); SD.note('계산기 — 1년 동안 매일 새벽 2~4시. 세아가 사라진 다음 날부터.'); }
  }

  /* ---------------- 손쉬운 사용 › 오디오 (H2) ---------------- */
  OPEN.access = function (o) {
    const shakeOn = G.state.vars.shakeUndoOff ? false : true;
    const shakeRow = row({ title: '흔들어서 실행 취소', sub: '휴대폰을 흔들면 마지막 입력을 되돌립니다.', right: toggle(shakeOn, (on) => { G.state.vars.shakeUndoOff = !on; G.save(); }), id: 'shake' });
    const body = el('div', null,
      group('청각 보조', [row({ icon: ic('#ff9f0a', 'sound'), title: '오디오', sub: '모노 오디오 · 좌우 음향 밸런스', onClick: () => OPEN.audio() })]),
      group('시인성 향상', [row({ icon: ic('#34c759', 'display'), title: '글자 크기', sub: '디스플레이', onClick: () => OPEN.display() })]),
      group('상호작용 및 조작', [shakeRow]));
    screen('손쉬운 사용', body);
    if (o && o.hl === 'shake') flash(shakeRow);
    G.bus.emit('settings:access');
  };
  function flash(n) { setTimeout(() => { n.classList.add('hl'); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => n.classList.remove('hl'), 1800); }, 380); }
  OPEN.audio = function (o) {
    const monoRow = row({ title: '모노 오디오', sub: '왼쪽·오른쪽 채널을 하나로 합쳐서 재생합니다.', right: toggle(isMono(), (on) => { setMono(on); G.flag('monoSeen', true); G.bus.emit('settings:mono', on); if (on) G.phone.toast('모노 오디오 켜짐'); }), id: 'mono' });
    const bal = el('div.st-slrow.bal', null, el('span', null, '왼쪽'), slider(0.5, () => {}), el('span', null, '오른쪽'));
    const body = el('div', null,
      group('오디오', [monoRow, el('div.st-subh', null, '좌우 음향 밸런스'), bal]),
      group(null, [row({ title: '자막 표시', sub: '소리에 자막을 함께 표시합니다.', right: toggle(true, () => { G.phone.toast('이 게임은 모든 소리에 자막을 표시합니다'); return false; }) })]),
      el('div.st-foot', null, '모노 오디오를 켜면 이어폰의 두 채널이 같은 소리로 합쳐집니다. 방향이 있는 소리는 구분하기 어려워질 수 있어요.'));
    const scr = screen('오디오', body);
    G.flag('monoSeen', true);
    G.bus.emit('settings:audio');
    if (o && o.hl === 'mono') flash(monoRow);
    const off = G.bus.on('settings', () => {});
    void scr; void off;
  };

  /* ---------------- 휴대전화 정보 ---------------- */
  OPEN.about = function () {
    const rows = (S().about || []).map(([k, v]) => row({ title: k, meta: v }));
    const body = el('div', null,
      el('div.st-hero', null, el('span.ab-phone'), el('b', null, '세아의 Galaxy'), el('small', null, 'SM-S911N')),
      group(null, rows),
      el('div.st-foot', null, '이 기기는 해솔홈 기기 관리 서비스에 등록되어 있습니다.'));
    screen('휴대전화 정보', body);
    G.bus.emit('settings:about');
  };
  OPEN.sound = OPEN.sound;
  OPEN.go = (id, p) => OPEN[id] && OPEN[id](p || {});

  /* ---------------- 게임 설정 (kept from the engine) ---------------- */
  function gameOptions() {
    const s = G.settings;
    const seg = (label, key, opts) => {
      const box = el('div.seg', null, opts.map(([v, l]) => {
        const b = el('button' + (s[key] === v ? '.on' : ''), null, l);
        b.addEventListener('click', () => { G.audio.sfx.tap(); s[key] = v; G.saveSettings(); box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
        return b;
      }));
      return el('div.st-segrow', null, el('span', null, label), box);
    };
    const body = el('div', null,
      group(null, [
        seg('사운드', 'sound', [[true, '켜기'], [false, '끄기']]),
        seg('진동', 'vibration', [[true, '켜기'], [false, '끄기']]),
        seg('공포 연출', 'scares', [['full', '보통'], ['light', '덜 무섭게']]),
        seg('목소리', 'voice', [[true, '켜기'], [false, '끄기']]),
      ]),
      group('글자 크기', [textSizeControl()]),
      group(null, [row({ title: '처음부터 다시 하기', cls: 'danger', chev: false, onClick: async () => {
        const ok = await G.phone.dialog({ title: '정말 처음부터?', text: '모든 진행 상황이 삭제됩니다.', buttons: [{ label: '취소', value: false }, { label: '초기화', value: true, style: 'danger' }] });
        if (ok) { G.resetSave(); location.reload(); }
      } })]));
    screen('게임 설정', body);
  }

  G.settingsApp = { open: (id, p) => { G.phone.openApp('settings', Object.assign({ screen: id }, p || {})); }, screens: OPEN, notifHistory: () => OPEN.notifHistory(), wellbeing: () => OPEN.wellbeing() };
})();
