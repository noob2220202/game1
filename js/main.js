/* =========================================================
 * Boot: title screen, options, content warning, continue, start.
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;

  /* ---------- name personalization ----------
   * Story text tokens: {N} name, {N야} vocative, {N가} {N는} {N를} {N랑} {N의} {N아}       */
  const NAME = (window.CONFIG && window.CONFIG.PLAYER_NAME) || '하루';
  G.NAME = NAME;
  function hasBatchim(s) { const c = s.charCodeAt(s.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; }
  const B = hasBatchim(NAME);
  G.T = function (s) {
    if (typeof s !== 'string') return s;
    return s
      .replace(/\{N야\}/g, NAME + (B ? '아' : '야'))
      .replace(/\{N아\}/g, NAME + (B ? '아' : '야'))
      .replace(/\{N가\}/g, NAME + (B ? '이' : '가'))
      .replace(/\{N는\}/g, NAME + (B ? '은' : '는'))
      .replace(/\{N를\}/g, NAME + (B ? '을' : '를'))
      .replace(/\{N랑\}/g, NAME + (B ? '이랑' : '랑'))
      .replace(/\{N이\}/g, NAME + (B ? '이' : ''))
      .replace(/\{N의\}/g, NAME + '의')
      .replace(/\{N\}/g, NAME);
  };

  if (window.CONFIG && window.CONFIG.DEBUG) document.body.classList.add('debug');

  function applySettings() {
    document.documentElement.style.setProperty('--ts', G.settings.textSize);
    if (G.audio) { G.audio.setEnabled(G.settings.sound); G.audio.setVolume(G.settings.volume); }
  }
  G.bus.on('settings', applySettings);

  /* ---------- boot ---------- */
  function boot() {
    G.fx.init();
    G.phone.init();
    applySettings();
    // preload the most important images
    (G.PRELOAD || []).forEach((src) => { const i = new Image(); i.src = src; });
    showTitle();
  }

  /* ---------- title ---------- */
  function showTitle() {
    const has = G.hasSave() && (function () { try { const s = JSON.parse(localStorage.getItem('haru-escape.save.v1')); return s && s.flags && s.flags.introDone && !s.flags.ending; } catch (e) { return false; } })();
    const ended = has && (function () { try { return !!JSON.parse(localStorage.getItem('haru-escape.save.v1')).flags.END; } catch (e) { return false; } })();
    const scr = el('div.title-screen');
    const bg = el('div.title-bg', { style: { backgroundImage: `url("${G.ASSET ? G.ASSET.title : ''}")` } });
    const inner = el('div.title-inner', null,
      el('div.title-kicker', null, 'AN ESCAPE ROOM FOR ' + (NAME === '하루' ? 'HARU' : NAME)),
      el('div.title-name', { html: `${NAME}${B ? '을' : '를'} 위한<br><em>방탈출!</em>` }),
      el('div.title-sub', null, '새벽 3시 33분. 처음 보는 방.\n손에 쥔 건, 내 것이 아닌 휴대폰.'),
      el('div.title-btns', null,
        has ? el('button.title-btn.primary', { onclick: () => start(true) }, ended ? '엔딩 다시 보기' : '이어하기') : null,
        el('button.title-btn' + (has ? '' : '.primary'), { onclick: () => (has ? confirmNew() : warn()) }, has ? '처음부터' : '시작하기'),
        el('button.title-btn', { onclick: options }, '설정')),
      el('div.title-foot', null, '🎧 이어폰 필수 · 어두운 곳 · 약 40분\n진행 상황은 자동 저장됩니다'));
    scr.append(bg, inner);
    document.getElementById('screen').appendChild(scr);
    G._title = scr;
    if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps/i.test(navigator.userAgent)) {
      const card = el('div.title-screen', { style: { justifyContent: 'center', zIndex: 330 } }, el('div.title-inner', { style: { maxWidth: '320px' } },
        el('div.warn-box', { html: '카카오톡 안에서는 <b>소리·진동</b>이 제대로 동작하지 않아요.<br>오른쪽 위 <b>⋯</b> → <b>\'다른 브라우저로 열기\'</b>를 눌러 주세요.' }),
        el('button.title-btn', { style: { width: '100%', marginTop: '14px' }, onclick: () => card.remove() }, '그냥 할래요')));
      document.getElementById('screen').appendChild(card);
    }
    async function confirmNew() {
      const ok = await G.phone.dialog({ title: '처음부터 시작할까요?', text: '저장된 진행 상황이 사라집니다.', buttons: [{ label: '취소', value: false }, { label: '새로 시작', value: true, style: 'danger' }] });
      if (ok) { G.resetSave(); warn(); }
    }
  }

  /* ---------- options ---------- */
  function options() {
    const s = G.settings;
    const seg = (key, opts) => el('div.seg', null, opts.map(([v, label]) => {
      const b = el('button' + (s[key] === v ? '.on' : ''), null, label);
      b.addEventListener('click', () => { s[key] = v; G.saveSettings(); b.parentNode.querySelectorAll('button').forEach((n) => n.classList.remove('on')); b.classList.add('on'); });
      return b;
    }));
    const body = el('div', { style: { width: '100%' } },
      el('div.opt-row', null, el('span', null, '사운드'), seg('sound', [[true, '켜기'], [false, '끄기']])),
      el('div.opt-row', null, el('span', null, '진동'), seg('vibration', [[true, '켜기'], [false, '끄기']])),
      el('div.opt-row', null, el('span', null, '공포 연출'), seg('scares', [['full', '보통'], ['light', '덜 무섭게'], ['off', '없음']])),
      el('div.opt-row', null, el('span', null, '목소리(TTS)'), seg('voice', [[true, '켜기'], [false, '끄기']])),
      el('div.opt-row', null, el('span', null, '글자 크기'), seg('textSize', [[0.92, '작게'], [1, '보통'], [1.1, '크게']])));
    const ov = el('div.title-screen', { style: { justifyContent: 'center', zIndex: 320 } },
      el('div.title-inner', { style: { maxWidth: '340px' } }, el('div.title-kicker', null, 'SETTINGS'), body,
        el('button.title-btn', { style: { width: '100%', marginTop: '20px' }, onclick: () => ov.remove() }, '닫기')));
    document.getElementById('screen').appendChild(ov);
  }

  /* ---------- content warning ---------- */
  function warn() {
    G.audio.unlock();
    const ov = el('div.title-screen', { style: { justifyContent: 'center', zIndex: 320 } },
      el('div.title-inner', { style: { maxWidth: '340px' } },
        el('div.title-kicker', null, 'WARNING'),
        el('div.warn-box', { html:
          '이 게임에는 <b>공포 연출(갑작스러운 소리, 어두운 장면), 스토킹·실종</b>을 다루는 내용이 있습니다. 언제든 설정에서 \'공포 연출: 덜 무섭게\'로 바꿀 수 있어요.<br><br>' +
          '🎧 <b>이어폰</b>을 끼면 소리로 숨겨진 단서를 들을 수 있어요.<br>' +
          '🔦 방은 어둡습니다. 화면 밝기를 올려주세요.<br>' +
          '📓 막히면 오른쪽 위 <b>수첩</b>에서 힌트를 볼 수 있어요.<br>' +
          '📱 카메라·마이크·센서 권한은 전혀 쓰지 않아요. 화면 터치만으로 플레이합니다.' }),
        el('button.title-btn.primary', { style: { width: '100%', marginTop: '18px' }, onclick: () => { ov.remove(); G.scenes.immersion(() => start(false)); } }, '알겠어요'),
        el('button.title-btn', { style: { width: '100%', marginTop: '8px' }, onclick: () => ov.remove() }, '돌아가기')));
    document.getElementById('screen').appendChild(ov);
  }

  /* ---------- start / continue ---------- */
  async function start(cont) {
    G.audio.unlock();
    applySettings();
    tryFullscreen();
    if (cont) G.load(); else G.resetSave();
    const t = G._title; t.style.transition = 'opacity 1.2s'; t.style.opacity = '0';
    await sleep(1200); t.remove();
    G.clock.start();
    if (G.scenes && G.scenes.start) G.scenes.start(cont);
  }
  function tryFullscreen() {
    // Android Chrome: real fullscreen hides the browser chrome => feels like a real phone
    const de = document.documentElement;
    if (/Android/i.test(navigator.userAgent) && de.requestFullscreen) { de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); }
  }

  /* ---------- debug helpers ---------- */
  window.haru = {
    flags: () => G.state.flags,
    set: (f) => G.flag(f, true),
    skip: (ms) => { G.state.playMs += ms || 60000; },
    reset: () => { G.resetSave(); location.reload(); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
