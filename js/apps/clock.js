/* =========================================================
 * 시계: alarms list (toggle), world clock-less, simple.
 * G.STORY.alarms = [{id, h, m, label, on, repeat, show(), locked, onToggle(on)}]
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, pad } = G.util;
  G.app('clock', {
    name: '시계',
    icon: G.ICONS.clock,
    open() {
      const wrap = el('div');
      const scr = G.ui.screen({ title: '알람', theme: 'dark', body: wrap });
      function render() {
        wrap.innerHTML = '';
        (G.STORY.alarms || []).filter((a) => !a.show || a.show()).forEach((a) => {
          const st = G.state.vars['alarm_' + a.id];
          const on = st == null ? a.on : st;
          const tg = el('button.toggle' + (on ? '.on' : ''), { 'aria-label': '알람 켜기/끄기' });
          tg.addEventListener('click', () => {
            if (a.locked) { G.audio.sfx.error(); G.phone.toast(G.T(a.locked)); return; }
            G.state.vars['alarm_' + a.id] = !on; G.save(); G.audio.sfx.tap(); a.onToggle && a.onToggle(!on); render();
          });
          const h12 = a.h % 12 === 0 ? 12 : a.h % 12;
          wrap.appendChild(el('div.alarm-row' + (on ? '' : '.off'), null,
            el('div', null, el('div.at', null, el('small', null, a.h < 12 ? '오전' : '오후'), `${h12}:${pad(a.m)}`), el('div.al', null, G.T(a.label || '알람') + (a.repeat ? ', ' + a.repeat : ''))), tg));
        });
      }
      render();
      G.phone.push(scr);
    },
  });
})();
