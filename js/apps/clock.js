/* =========================================================
 * 시계 — DESIGN §4.7. Tabs: 알람 / 세계 시각 / 스톱워치.
 * - 04:44 · {N} (1회, 켜짐): toggle/long-press → '이 알람은 다른 기기에서 관리됩니다';
 *   deletable only after END (flag alarmDeleted).
 * - live seconds from G.clock.now(): when the clock is capped they loop 57→58→59 ("stuck time").
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);
  const IC = {
    alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9.5V13l2.5 1.8M4.5 5.5l3-2.5M19.5 5.5l-3-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    world: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5M12 3.5C9.4 5.9 8.4 8.8 8.4 12s1 6.1 3.6 8.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    sw: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 13.5V9.5M10 2.8h4M18 6.5l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };
  const alarms = () => (G.STORY.alarms || []).filter((a) => (!a.show || a.show()) && !G.state.vars['alarmDel_' + a.id]);
  const isOn = (a) => { const st = G.state.vars['alarm_' + a.id]; return st == null ? a.on : st; };
  const locked = (a) => a.managed && !G.flag('END');
  function k12(h) { return { ap: h < 12 ? '오전' : '오후', h: h % 12 === 0 ? 12 : h % 12 }; }
  function untilText(a) {
    const now = G.clock.now();
    const t = new Date(now); t.setHours(a.h, a.m, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    const mins = Math.round((t - now) / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h ? h + '시간 ' : ''}${m}분 후에 알람이 울립니다`;
  }

  let tab = 'alarm';
  let swStart = null, swAcc = 0, swLaps = [];
  G.app('clock', {
    name: '시계',
    icon: G.ICONS.clock,
    folder: '기타',
    open(p) {
      if (p && p.tab) tab = p.tab;
      const wrap = el('div.clk-wrap');
      const tabs = el('div.clk-tabs');
      const scr = G.ui.screen({ title: '시계', theme: 'dark', cls: 'clk-screen', body: wrap });
      scr.appendChild(tabs);
      let ticker = null;
      function render() {
        wrap.innerHTML = ''; tabs.innerHTML = '';
        clearInterval(ticker);
        [['alarm', '알람', IC.alarm], ['world', '세계 시각', IC.world], ['sw', '스톱워치', IC.sw]].forEach(([k, l, ic]) => {
          const b = el('button' + (tab === k ? '.on' : ''), null, el('span', { html: ic }), el('small', null, l));
          b.addEventListener('click', () => { if (tab === k) return; G.audio.sfx.tap(); tab = k; render(); });
          tabs.appendChild(b);
        });
        scr.querySelector('.sv-title').textContent = { alarm: '알람', world: '세계 시각', sw: '스톱워치' }[tab];
        if (tab === 'alarm') alarmTab(wrap, render);
        if (tab === 'world') ticker = worldTab(wrap);
        if (tab === 'sw') ticker = swTab(wrap);
      }
      render();
      G.phone.push(scr, { onClose: () => clearInterval(ticker), onResume: render });
      G.bus.emit('clock:open');
    },
  });

  /* ---------------- 알람 ---------------- */
  function alarmTab(wrap, rerender) {
    const list = alarms();
    const next = list.filter(isOn).sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m))[0];
    const now = G.clock.now();
    const nowEl = el('div.clk-now');
    const head = el('div.clk-head', null, el('div.ch-big', null, next ? untilText(next) : '모든 알람이 꺼져 있습니다'), el('div.ch-sub', null, next ? `${G.util.fmtKDate(now)} · ${k12(next.h).ap} ${k12(next.h).h}:${pad(next.m)}` : ''), nowEl);
    const upd = () => { const d = G.clock.now(); nowEl.textContent = `현재 ${k12(d.getHours()).ap} ${k12(d.getHours()).h}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
    upd();
    const t = setInterval(() => { if (!nowEl.isConnected) { clearInterval(t); return; } upd(); }, 250);
    wrap.appendChild(head);
    const box = el('div.clk-list');
    list.forEach((a) => {
      const on = isOn(a);
      const { ap, h } = k12(a.h);
      const tg = el('button.toggle' + (on ? '.on' : '') + (locked(a) ? '.locked' : ''), { 'aria-label': '알람 켜기/끄기' });
      tg.addEventListener('click', (e) => {
        e.stopPropagation();
        if (locked(a)) { G.audio.sfx.error(); tg.classList.add('nope'); setTimeout(() => tg.classList.remove('nope'), 400); G.phone.toast(T(a.managed)); G.bus.emit('clock:managed'); return; }
        G.state.vars['alarm_' + a.id] = !on; G.save(); G.audio.sfx.tap(); rerender();
      });
      const row = el('div.alarm-card' + (on ? '' : '.off') + (a.managed ? '.managed' : ''), null,
        el('div.ac-main', null,
          el('div.ac-label', null, a.managed ? el('i', { html: IC.lock }) : null, T(a.label || '알람')),
          el('div.ac-time', null, el('small', null, ap), `${h}:${pad(a.m)}`),
          el('div.ac-rep', null, T(a.repeat || ''))),
        tg);
      G.ui.onLongPress(row, async () => {
        if (locked(a)) { G.audio.sfx.error(); G.phone.toast(T(a.managed)); G.bus.emit('clock:managed'); return; }
        const ok = await G.phone.dialog({ title: '알람 삭제', text: `${ap} ${h}:${pad(a.m)} ${T(a.label || '')} 알람을 삭제할까요?`, buttons: [{ label: '취소', value: false }, { label: '삭제', value: true, style: 'danger' }] });
        if (!ok) return;
        G.state.vars['alarmDel_' + a.id] = 1; G.save();
        if (a.managed) { G.flag('alarmDeleted', true); }
        G.phone.toast('알람이 삭제되었습니다');
        rerender();
      }, 550);
      row.addEventListener('click', () => { if (locked(a)) { G.audio.sfx.tap(); G.phone.toast(T(a.managed)); G.bus.emit('clock:managed'); } });
      box.appendChild(row);
    });
    if (!list.length) box.appendChild(el('div.empty-state', null, '알람 없음'));
    wrap.appendChild(box);
    wrap.appendChild(el('div.clk-hint', null, '알람을 길게 누르면 삭제할 수 있습니다'));
  }

  /* ---------------- 세계 시각 ---------------- */
  function worldTab(wrap) {
    const big = el('div.wt-time');
    const sec = el('span.wt-sec');
    const date = el('div.wt-date');
    const zones = el('div.wt-zones');
    const face = el('div.wt-face', null, el('i.h'), el('i.m'), el('i.s'), el('b'));
    wrap.append(face, el('div.wt-big', null, big, sec), date, el('div.wt-net', null, '네트워크 제공 시간 · Haesol_404'), zones);
    const cities = [['서울', 0, '오늘'], ['런던', -9, ''], ['뉴욕', -14, '']];
    function upd() {
      const d = G.clock.now();
      const { ap, h } = k12(d.getHours());
      big.textContent = `${ap} ${h}:${pad(d.getMinutes())}`;
      sec.textContent = ':' + pad(d.getSeconds());
      date.textContent = `서울 · ${G.util.fmtKDate(d)}`;
      const hh = d.getHours() % 12 + d.getMinutes() / 60, mm = d.getMinutes() + d.getSeconds() / 60;
      face.querySelector('.h').style.transform = `rotate(${hh * 30}deg)`;
      face.querySelector('.m').style.transform = `rotate(${mm * 6}deg)`;
      face.querySelector('.s').style.transform = `rotate(${d.getSeconds() * 6}deg)`;
      zones.innerHTML = '';
      cities.forEach(([n, off]) => {
        const z = new Date(d.getTime() + off * 3600000);
        const k = k12(z.getHours());
        const dd = z.getDate() === d.getDate() ? '오늘' : z.getDate() < d.getDate() ? '어제' : '내일';
        zones.appendChild(el('div.wt-z', null, el('div', null, el('b', null, n), el('small', null, `${dd}, ${off === 0 ? '현지 시간' : off + '시간'}`)), el('span', null, `${k.ap} ${k.h}:${pad(z.getMinutes())}`)));
      });
    }
    upd();
    return setInterval(upd, 250);
  }

  /* ---------------- 스톱워치 (real time) ---------------- */
  function swTab(wrap) {
    const disp = el('div.sw-disp');
    const laps = el('div.sw-laps');
    const startBtn = el('button.sw-btn.go');
    const lapBtn = el('button.sw-btn');
    function ms() { return swAcc + (swStart ? performance.now() - swStart : 0); }
    function fmt(t) { const cs = Math.floor(t / 10) % 100, s = Math.floor(t / 1000) % 60, m = Math.floor(t / 60000); return `${pad(m)}:${pad(s)}.${pad(cs)}`; }
    function sync() {
      startBtn.textContent = swStart ? '중지' : ms() ? '계속' : '시작';
      startBtn.classList.toggle('stop', !!swStart);
      lapBtn.textContent = swStart ? '구간 기록' : '초기화';
      lapBtn.disabled = !swStart && !ms();
      laps.innerHTML = '';
      swLaps.slice().reverse().forEach((l, i) => laps.appendChild(el('div.sw-lap', null, el('span', null, `구간 ${swLaps.length - i}`), el('b', null, fmt(l)))));
    }
    startBtn.addEventListener('click', () => { G.audio.sfx.tap(); if (swStart) { swAcc += performance.now() - swStart; swStart = null; } else swStart = performance.now(); sync(); });
    lapBtn.addEventListener('click', () => { G.audio.sfx.tap(); if (swStart) swLaps.push(ms()); else { swAcc = 0; swLaps = []; } sync(); });
    wrap.append(disp, el('div.sw-btns', null, lapBtn, startBtn), laps);
    sync();
    const upd = () => { disp.textContent = fmt(ms()); };
    upd();
    return setInterval(upd, 33);
  }
})();
