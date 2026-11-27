/* =========================================================
 * ep2/js/scenes.js (flow) — B00 / B01 / B02 and the out-of-world screens (DESIGN_EP2 §3.0 · §3.1 · §4.0 ·
 * §4.10.13 · §5.3 일시정지 · §6.2 B00–B02 · ARCH §3.2 flow · §8.1).
 *   title (`{N를} 위한 방탈출! 2` · 돌려줄게 · 시작하기 / 이어하기 · 03:33 다시 보기 · 이번 선택 남기기 ·
 *   in-app web-view card, web only) → content warning [확인] (= G.audio.unlock(), ARCH §9 G6) →
 *   earphone test (bell.small 270° → [왼쪽] → 90° → [오른쪽]; wrong / 스피커예요 → audioMode 'speaker';
 *   안 들려요 or 8 s silence → sound card [다시 듣기] [소리 없이 할게요]; the instruction line then reads the chosen mode
 *   '✓ 이어폰' / '스피커') → [시작] = unlock again + introDone +
 *   G.e2.seriesStart() + G.clock.start() → '지난 이야기' recap (only !cbPreview.e1done; G.fx.mono lines, [건너뛰기]) →
 *   cold open B01 (22 s, black, sound only) → 16 s G.room.eyeM0() (mark B01 + S00) → gotPhone → B02 → lock screen.
 * Pause menu ⏸ (hook 'pause:open'): G.clock.pause() + bus 'pause' {open:true}; close → G.clock.resume().
 * Layers: `.fl2-scene` z 200 (title · warning · ear test · recap · pause). No player-facing text outside DESIGN — the ear
 *   test is `🎧 이어폰 테스트` · `이어폰을 끼고, 소리가 난 쪽을 눌러 주세요.` → that line becomes '✓ 이어폰' / '스피커' (§4.0 · §12.11-6).
 * API: G.scenes = { init(), title(), warn(), coldOpen({resume}), recap(), pause(), closePause(), isPauseOpen(),
 *                   ambience(), titleUp(), inGame() }
 * Flags set: introDone recapShown M0 · marks B00 B01 B02 · settings: audioMode (test), pause options.
 * data-qa: title.start title.continue title.restart title.hookReplay title.recanon title.inapp.ok warn.ok ear.left
 *   ear.right ear.speaker ear.none ear.retry ear.silent ear.start recap.skip pause.resume pause.opt:<key>:<value> pause.title
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const SC = (G.scenes = G.scenes || {});

  /* ---------- local helpers ---------- */
  function el(tag, attrs, ...kids) { return G.util.el(tag, attrs, ...kids); }
  const T = (s) => { try { return G.T ? G.T(s) : String(s); } catch (e) { return String(s); } };
  function safe(fn, d) { try { return fn(); } catch (e) { console.error('[scenes]', e); return d; } }
  function flag(n) { try { return !!G.flag(n); } catch (e) { return false; } }
  function setFlag(n, v) { try { G.flag(n, v === undefined ? true : v); } catch (e) { console.error('[scenes] flag', n, e); } }
  function running() { try { return G.clock && G.clock.running ? !!G.clock.running() : !document.hidden; } catch (e) { return !document.hidden; } }
  function wait(ms) {   // game-running time (pause menu / hidden tab stop it)
    return new Promise((res) => {
      let left = ms, last = performance.now();
      const step = () => { const now = performance.now(); if (running()) left -= Math.min(250, now - last); last = now; if (left <= 0) res(); else setTimeout(step, Math.min(100, Math.max(16, left))); };
      setTimeout(step, Math.min(100, Math.max(16, ms)));
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));     // UI-only waits (title / test, before the clock starts)
  function A() { return G.audio || {}; }
  function cue(id, o) { return safe(() => (A().cue ? A().cue(id, o || {}) : undefined)); }
  function sub(id, o) { safe(() => { if (A().sub) A().sub(id, o || {}); }); }
  function amb(id, on, o) { safe(() => { if (A().amb) A().amb(id, on, o || {}); }); }
  function unlock() { return safe(() => (A().unlock ? A().unlock() : Promise.resolve(false)), Promise.resolve(false)); }
  function mark(id) { safe(() => G.director && G.director.mark && G.director.mark(id)); }
  function sfxTap() { safe(() => A().sfx && A().sfx.tap && A().sfx.tap()); }
  function scr() { return document.getElementById('screen'); }
  function img(key) { return safe(() => (G.e2 && G.e2.img ? G.e2.img(key) : (G.IMG && G.IMG[key]) || ''), ''); }
  function STR(k, dflt) { return safe(() => (G.e2 && G.e2.STR && G.e2.STR[k]) || dflt, dflt); }
  function saveSettings() { safe(() => (G.saveSettings ? G.saveSettings() : null)); }
  function savedFlags() {
    try { return (G.state && G.state.flags) || {}; } catch (e) { return {}; }
  }
  function scene(cls, attrs) { const n = el('div.fl2-scene' + (cls ? '.' + cls : ''), attrs || null); scr().appendChild(n); requestAnimationFrame(() => n.classList.add('in')); return n; }
  function removeScene(n, ms) { if (!n) return; n.classList.remove('in'); n.classList.add('out'); setTimeout(() => n.remove(), ms || 500); }
  /** in-scene confirm (system dialogs sit under the z-200 scenes, so the title draws its own) */
  function confirmBox(host, text, buttons) {
    return new Promise((res) => {
      const box = el('div.fl2-confirm', { role: 'dialog' }, el('div.fl2-confirm-in', null, el('p', null, text),
        el('div.fl2-confirm-btns', null, buttons.map((b) => el('button.fl2-btn' + (b.primary ? '.primary' : ''), { 'data-qa': 'dialog.btn:' + b.qa, onclick: () => { sfxTap(); box.remove(); res(b.value); } }, b.label)))));
      host.appendChild(box);
    });
  }

  /* =====================================================================
   * TITLE (B00 · §3.0 ① · §4.0 · §4.10.13)
   * ===================================================================== */
  let titleEl = null;
  SC.titleUp = function () { return !!titleEl; };
  SC._dropTitle = function () { titleEl = null; };
  SC.inGame = function () { return flag('introDone') && !titleEl && !preEl; };
  SC.title = function () {
    if (titleEl) return titleEl;
    safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
    const f = savedFlags();
    const has = !!f.introDone;
    const ended = !!f.END;
    const hookDone = !!f.hookDone;
    const vars0 = (G.state && G.state.vars) || {};
    const replay = !!vars0.replay;
    const recanonDone = !!vars0.recanonDone;     // this save already rewrote the canon (a fresh 처음부터 save starts without it)
    const nameLine = T('{N를} 위한 방탈출! 2');
    const cut = nameLine.lastIndexOf(' 위한 ');
    const nameNode = cut > 0
      ? el('h1.fl2-t-name', null, nameLine.slice(0, cut + 3), el('br'), el('em', null, nameLine.slice(cut + 4)))
      : el('h1.fl2-t-name', null, nameLine);
    const btns = el('div.fl2-t-btns');
    const smalls = el('div.fl2-t-smalls');
    if (has && !hookDone) btns.appendChild(el('button.fl2-btn.primary', { 'data-qa': 'title.continue', onclick: () => cont() }, '이어하기'));
    if (has) btns.appendChild(el('button.fl2-btn' + (hookDone ? '.primary' : ''), { 'data-qa': 'title.restart', onclick: () => restart() }, hookDone ? '처음부터' : '시작하기'));
    else btns.appendChild(el('button.fl2-btn.primary', { 'data-qa': 'title.start', onclick: () => { sfxTap(); fresh(); } }, '시작하기'));
    if (ended) smalls.appendChild(el('button.fl2-small', { 'data-qa': 'title.hookReplay', onclick: () => hookReplay() }, '03:33 다시 보기'));
    // after a confirmed overwrite the button itself goes — that is the confirmation (no status line)
    const recanonBtn = ended && replay && !recanonDone
      ? el('button.fl2-small', { 'data-qa': 'title.recanon', onclick: () => recanon() }, '이번 선택 남기기') : null;
    if (recanonBtn) smalls.append(recanonBtn);
    const bg = el('div.fl2-t-bg');
    const src = img('title_ep2');
    if (src) bg.style.backgroundImage = `url("${src}")`;
    titleEl = scene('fl2-title', { 'aria-label': nameLine });
    titleEl.append(bg, el('div.fl2-t-snow'), el('div.fl2-t-in', null,
      nameNode,
      el('div.fl2-t-sub', null, '돌려줄게'),
      btns, smalls));
    const ua = String(navigator.userAgent || '');
    // web only (in-app web views): the app build never shows this card
    if (!G.APP && /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua)) {
      // §4.0 card (canonical inside KakaoTalk); any other in-app web view is '이 앱' — no other brand is named
      const app = /KAKAOTALK/i.test(ua) ? '카카오톡' : '이 앱';
      const card = el('div.fl2-confirm.fl2-inapp', null, el('div.fl2-confirm-in', null,
        el('p', null, `${app} 안에서는 소리가 제대로 나오지 않을 수 있어요. 오른쪽 위 ⋯ → '다른 브라우저로 열기'를 눌러 주세요.`),
        el('div.fl2-confirm-btns', null, el('button.fl2-btn', { 'data-qa': 'title.inapp.ok', onclick: () => card.remove() }, '그냥 할래요'))));
      titleEl.appendChild(card);
    }
    return titleEl;

    async function cont() {
      sfxTap();
      unlock();
      const t = titleEl; titleEl = null; removeScene(t, 900);
      safe(() => (G.main && G.main.resumeFrom ? G.main.resumeFrom(G.state, { fromTitle: true }) : null));
    }
    async function restart() {
      sfxTap();
      const ok = await confirmBox(titleEl, STR('restart2', '진행 상황이 지워집니다.'),
        [{ label: '취소', value: false, qa: 'cancel' }, { label: hookDone ? '처음부터' : '시작하기', value: true, primary: true, qa: 'restart' }]);
      if (!ok) return;
      safe(() => G.resetSave && G.resetSave());
      // a clean page so no module keeps references into the old save; the warning opens directly after it
      try { location.hash = 'start'; } catch (e) {}
      location.reload();
    }
    async function hookReplay() {
      sfxTap();
      unlock();
      const t = titleEl; titleEl = null; removeScene(t, 600);
      safe(() => G.clock && G.clock.start && G.clock.start());
      await sleep(400);
      safe(() => G.hook && (G.hook.replay ? G.hook.replay() : G.hook.start({ replay: true })));
    }
    async function recanon() {
      sfxTap();
      const ok = await confirmBox(titleEl, STR('recanonQ', '이번 선택으로 바꿀까요?'),
        [{ label: '취소', value: false, qa: 'cancel' }, { label: '바꾸기', value: true, primary: true, qa: 'change' }]);
      if (!ok) return;
      // E2.commit answers !!vars.committed — already true from END — so a failed overwrite only shows as one more commitTries
      const v = (G.state && G.state.vars) || {};
      const tries0 = v.commitTries | 0;
      const done = !!safe(() => G.e2 && G.e2.commit && G.e2.commit({ overwrite: true }), false) && (v.commitTries | 0) === tries0;
      if (!done) return;                         // failure: the title stays as it was (the player may try again)
      v.recanonDone = true;
      safe(() => G.save && G.save(true));
      if (recanonBtn && recanonBtn.parentNode) recanonBtn.remove();
    }
  };
  function fresh() {
    const t = titleEl; titleEl = null; removeScene(t, 500);
    if (G.hasSave && safe(() => G.hasSave(), false) && !flag('introDone')) safe(() => G.resetSave && G.resetSave());
    SC.warn();
  }

  /* =====================================================================
   * CONTENT WARNING → EARPHONE TEST → [시작]   (pre-game screens)
   * ===================================================================== */
  let preEl = null;
  SC.warn = function () {
    if (preEl) preEl.remove();
    preEl = scene('fl2-pre');
    preEl.appendChild(el('div.fl2-pre-in', null,
      el('p.fl2-warn', null, '공포 연출과 스토킹·감금 소재가 있습니다.'),
      el('button.fl2-btn.primary.wide', { 'data-qa': 'warn.ok', onclick: () => { unlock(); sfxTap(); earTest(); } }, '확인')));
  };

  function earTest() {
    if (!preEl) preEl = scene('fl2-pre');
    preEl.innerHTML = '';
    const left = el('button.fl2-ear-side', { 'data-qa': 'ear.left' }, el('span.arrow', null, '◀'), '왼쪽');
    const right = el('button.fl2-ear-side', { 'data-qa': 'ear.right' }, '오른쪽', el('span.arrow', null, '▶'));
    const spk = el('button.fl2-small', { 'data-qa': 'ear.speaker' }, '스피커예요');
    const none = el('button.fl2-small', { 'data-qa': 'ear.none' }, '안 들려요');
    const start = el('button.fl2-btn.primary.wide', { 'data-qa': 'ear.start', disabled: true }, '시작');
    // the episode's one earphone recommendation is this instruction line (two nowrap halves: a wrap falls after the comma);
    // once the test ends the same line shows the chosen mode, like ep1's '✓ 이어폰' / '스피커'
    const guide = el('div.fl2-ear-guide', { 'aria-live': 'polite' },
      el('span.fl2-nw', null, '이어폰을 끼고,'), ' ', el('span.fl2-nw', null, '소리가 난 쪽을 눌러 주세요.'));
    const inner = el('div.fl2-pre-in.fl2-ear', null,
      el('div.fl2-ear-head', null, '🎧 이어폰 테스트'),
      guide,
      el('div.fl2-ear-sides', null, left, right),
      el('div.fl2-ear-alt', null, spk, none),
      start);
    preEl.appendChild(inner);

    let step = 0, done = false, timer = 0, card = null;
    const cardUp = () => !!(card && card.isConnected);
    const s = G.settings || (G.settings = {});
    // the result: the instruction line turns into the chosen mode (same height, so nothing below moves), every answer
    // button dims (none of them does anything any more) and [시작] lights up
    const finish = (mode) => {
      done = true; clearTimeout(timer);
      s.audioMode = mode; saveSettings();
      left.disabled = true; right.disabled = true; spk.disabled = true; none.disabled = true;
      guide.style.minHeight = guide.offsetHeight + 'px';
      guide.textContent = mode === 'ear' ? '✓ 이어폰' : '스피커';
      guide.classList.add('res');
      inner.classList.add('done');
      start.disabled = false;
      requestAnimationFrame(() => start.classList.add('ready'));
    };
    // 8 s with no answer after a bell → the sound card. Every answer disarms it; the next bell re-arms it.
    const armSilence = () => { clearTimeout(timer); timer = setTimeout(() => { if (!done) soundCard(); }, 8000); };
    const bell = (az) => {
      if (done || cardUp()) return;            // the card is up: [다시 듣기] restarts the test, nothing rings under it
      inner.dataset.ring = az === 270 ? 'left' : 'right'; cue('bell.small', { az }); armSilence();
    };
    const answer = (side) => {
      if (done || cardUp()) return;
      clearTimeout(timer);
      sfxTap();
      const want = step === 0 ? 'left' : 'right';
      if (side !== want) return finish('speaker');
      step++;
      if (step >= 2) return finish('ear');
      setTimeout(() => { if (!done) bell(90); }, 650);
    };
    left.addEventListener('click', () => answer('left'));
    right.addEventListener('click', () => answer('right'));
    spk.addEventListener('click', () => { if (!done) { sfxTap(); finish('speaker'); } });
    none.addEventListener('click', () => { if (!done) { sfxTap(); soundCard(); } });
    start.addEventListener('click', () => { if (start.disabled) return; sfxTap(); begin(); });

    function soundCard() {
      clearTimeout(timer);
      if (cardUp() || done || !preEl) return;    // one card at a time (it lives in preEl, above the test)
      const close = () => { if (card) card.remove(); card = null; };
      card = el('div.fl2-confirm', { role: 'dialog' }, el('div.fl2-confirm-in', null,
        el('p', null, STR('soundCard', '소리가 들리지 않으면 무음 모드를 끄고 볼륨을 올려 주세요.')),
        el('div.fl2-confirm-btns', null,
          el('button.fl2-btn', { 'data-qa': 'ear.retry', onclick: () => { sfxTap(); close(); unlock(); step = 0; done = false; setTimeout(() => bell(270), 500); } }, '다시 듣기'),
          el('button.fl2-btn', { 'data-qa': 'ear.silent', onclick: () => { sfxTap(); close(); if (!s.subs) s.subs = 'info'; finish('speaker'); } }, '소리 없이 할게요'))));
      preEl.appendChild(card);
    }
    setTimeout(() => { if (!done) bell(270); }, 700);
  }

  async function begin() {
    unlock();
    safe(() => A().prepare && A().prepare());
    setFlag('introDone');
    safe(() => G.e2 && G.e2.seriesStart && G.e2.seriesStart());
    safe(() => G.clock && G.clock.start && G.clock.start());
    mark('B00');
    safe(() => G.save && G.save(true));
    const p = preEl; preEl = null;
    const black = scene('fl2-black');
    black.classList.add('in');
    if (p) removeScene(p, 400);
    const needRecap = !safe(() => G.e2 && G.e2.cbPreview && G.e2.cbPreview.e1done, false) && !flag('recapShown');
    if (needRecap) await SC.recap(black);
    await SC.coldOpen({ black });
  }

  /* =====================================================================
   * '지난 이야기' — 4 monologue lines (G.fx.mono, z 300) on black · [건너뛰기]
   * ===================================================================== */
  SC.recap = async function (host) {
    const lines = safe(() => G.e2.MONO.recap, null) || ['지난달 24일, 404호. 옷장 뒤에 그 사람이 있었다.', '나는 세아의 폰으로 문을 열고 나왔다.', '세아는 아직 돌아오지 않았다. 그 사람도 잡히지 않았다.', '그리고 내 폰은, 그 사람이 가져갔다.'];
    const own = !host;
    host = host || scene('fl2-black');
    safe(() => G.director && G.director.hold && G.director.hold('recap', true));
    let skipped = false, wake = null;
    const skip = el('button.fl2-skip', { 'data-qa': 'recap.skip' }, '건너뛰기');
    skip.addEventListener('click', () => { if (skipped) return; skipped = true; sfxTap(); skip.remove(); if (wake) wake(); });
    host.appendChild(skip);
    const fallback = el('div.fl2-recap-line');
    for (const line of lines) {
      if (skipped) break;
      await new Promise((res) => { wake = res; setTimeout(res, 500); });
      if (skipped) break;
      if (G.fx && G.fx.mono) {
        const p = safe(() => G.fx.mono(line, 3600), null);
        await new Promise((res) => { wake = res; Promise.resolve(p).then(() => setTimeout(res, 300)); setTimeout(res, 4600); });
      } else {
        fallback.textContent = line; if (!fallback.parentNode) host.appendChild(fallback);
        fallback.classList.add('in');
        await new Promise((res) => { wake = res; setTimeout(res, 3600); });
        fallback.classList.remove('in');
      }
    }
    wake = null;
    if (skip.parentNode) skip.remove();
    if (fallback.parentNode) fallback.remove();
    setFlag('recapShown');
    safe(() => G.director && G.director.hold && G.director.hold('recap', false));
    if (own) removeScene(host);
    await sleep(skipped ? 300 : 900);
  };

  /* =====================================================================
   * AMBIENCE beds (B01 t 0 — also restored on resume)
   * ===================================================================== */
  SC.ambience = function () {
    amb('roofWind', true, { fade: 3, wide: true });
    amb('cityFar', true, { fade: 4 });
    amb('tank', true, { fade: 4 });
    amb('room601', true, { fade: 4, warm: flag('doorOpened') });
    if (safe(() => G.clock && G.clock.passed && G.clock.passed('23:50'), false)) amb('snow', true, { fade: 2 });
  };

  /* =====================================================================
   * COLD OPEN — B01 (§3.1 table, 22 s, no text) → eye view → box chain → B02
   * ===================================================================== */
  let box = null, coldRunning = false, b02Done = false;
  function onCloseup(e) {
    if (!e || e.id !== 'p2_door_open' || flag('gotPhone')) return;
    safe(() => box && box.stage && box.stage('doorOpen'));
    safe(() => A().doorOpen && A().doorOpen('hold'));
  }
  function onRinging() { if (!flag('gotPhone')) safe(() => box && box.stage && box.stage('inHand')); }
  function startBox(stage) {
    if (box) return box;
    box = safe(() => (A().box15 && A().box15.start ? A().box15.start() : null), null);
    if (stage) safe(() => box && box.stage && box.stage(stage));
    return box;
  }
  SC.coldOpen = async function (opts) {
    opts = opts || {};
    if (coldRunning) return;
    coldRunning = true; b02Done = false;
    try {
      safe(() => G.notebook && G.notebook.show && G.notebook.show(false));
      const black = opts.black || scene('fl2-black');
      black.classList.add('in');
      if (!flag('M0')) setFlag('M0');
      safe(() => G.director && G.director.start && G.director.start());
      SC.ambience();
      const resume = !!opts.resume;
      if (!resume) {
        safe(() => A().setYaw && A().setYaw(0));
        cue('church.bell', { n: 2, gap: 3.2, az: 200 });
        await wait(4000);
        cue('cloth.rustle', { az: 0, dist: 1.0 });
        await wait(2000);
        cue('gravel.step', { surface: 'dry', n: 7, from: { az: 0, dist: 1 }, to: { az: 70, dist: 6 }, dur: 4.5 });
        await wait(4500);
        await wait(2500);   // 10.5–13.0: where the steel door should sound — only the wind (hinge.none: no cue at all)
        startBox('closed');
        await wait(3000);
      } else {
        startBox('closed');
      }
      // 16.0 s — the eye view fades in (r2_door, 23:10, no camera chrome)
      let eye = null;
      if (G.room && G.room.eyeM0) eye = safe(() => G.room.eyeM0({ resume }), null);
      if (!resume) { mark('B01'); setTimeout(() => sub('S00'), 900); }
      removeScene(black, 1400);
      safe(() => G.notebook && G.notebook.show && G.notebook.show(true));
      if (!G.room || !G.room.eyeM0) {
        console.warn('[scenes] G.room.eyeM0 missing — gotPhone stub (partial build)');
        await wait(1500);
        setFlag('gotPhone');
      }
      await Promise.race([
        Promise.resolve(eye).catch(() => null),
        new Promise((res) => { if (flag('gotPhone')) res(); else if (G.bus) G.bus.on('flag:gotPhone', res); }),
      ]);
      await b02();
    } finally { coldRunning = false; }
  };
  /* B02 — slide → cut 30 ms mid-bar → wind 1.2 s → door closes (doorlock.close) → screen off → lock screen */
  async function b02() {
    if (b02Done) return; b02Done = true;
    mark('B02');
    safe(() => box && box.cut && box.cut());
    safe(() => box && box.stop && setTimeout(() => box.stop(), 400));
    const black = scene('fl2-black.fl2-soft');
    black.style.transition = 'none'; black.classList.add('in');   // dark at once — the eye view is already gone (nothing of the phone may flash)
    await wait(1200);
    black.style.transition = '';
    safe(() => A().doorClose && A().doorClose());
    cue('doorlock.close');
    await wait(900);
    safe(() => G.lock && G.lock.show && G.lock.show('n'));
    removeScene(black, 900);
    safe(() => G.notebook && G.notebook.show && G.notebook.show(true));
    box = null;
  }

  /* =====================================================================
   * PAUSE MENU ⏸ (§4.0 일시정지 · §5.3) — clock + sched + director + climax watcher stop (ARCH §9 G33)
   * ===================================================================== */
  let pauseEl = null, pauseBack = null;
  SC.isPauseOpen = function () { return !!pauseEl; };
  SC.pause = function () {
    if (pauseEl || titleEl || preEl || !flag('introDone')) return;
    safe(() => G.ui && G.ui.hideKeyboard && G.ui.hideKeyboard());
    safe(() => G.clock && G.clock.pause && G.clock.pause());
    safe(() => G.bus && G.bus.emit('pause', { open: true }));
    const s = G.settings || {};
    const seg = (key, opts, o) => {
      o = o || {};
      const box = el('div.fl2-seg');
      // o.nearest: numeric option — highlight the closest one (설정 › 디스플레이 also offers 130 % → shown as 크게, §4.0 keeps 3 labels)
      const pick = () => {
        if (!o.nearest) return String(s[key]);
        const cur = Number(s[key]) || o.dflt || 0;
        return String(opts.reduce((a, [v]) => (Math.abs(v - cur) < Math.abs(a - cur) ? v : a), opts[0][0]));
      };
      const draw = () => { const v = pick(); box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', v === b.dataset.v)); };
      opts.forEach(([v, label]) => {
        const b = el('button', { 'data-qa': `pause.opt:${key}:${v}`, dataset: { v: String(v) } }, label);
        b.addEventListener('click', () => { sfxTap(); s[key] = v; saveSettings(); draw(); });
        box.appendChild(b);
      });
      draw();
      return box;
    };
    const toggle = (key, label) => {
      const b = el('button.fl2-tog');
      const draw = () => { const on = !!s[key]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.dataset.qa = `pause.opt:${key}:${!on}`; };
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', () => { sfxTap(); s[key] = !s[key]; saveSettings(); draw(); });
      draw();
      return b;
    };
    const myMsgs = (() => {
      const st = el('span.fl2-switch');
      const b = el('button.fl2-privrow', null, el('span', null, '내가 보낸 말 다시 보이기'), st);
      const draw = () => { const on = s.e1MyMsgs !== false; st.textContent = on ? '켬' : '끔'; b.classList.toggle('on', on); b.dataset.qa = `pause.opt:e1MyMsgs:${!on}`; };
      b.addEventListener('click', () => { sfxTap(); s.e1MyMsgs = s.e1MyMsgs === false; saveSettings(); draw(); });
      draw();
      return b;
    })();
    const row = (label, ctl, note) => el('div.fl2-prow', null, el('span.fl2-plabel', null, label), ctl, note ? el('p.fl2-pnote', null, note) : null);
    const resume = el('button.fl2-btn.primary.wide', { 'data-qa': 'pause.resume', onclick: () => { sfxTap(); SC.closePause(); } }, '계속하기');
    const toTitle = el('button.fl2-btn.wide', { 'data-qa': 'pause.title', onclick: () => { sfxTap(); toTitleScreen(); } }, '처음 화면으로');
    pauseEl = scene('fl2-pause', { role: 'dialog' });
    pauseEl.appendChild(el('div.fl2-pause-in', null,
      el('div.fl2-pause-head', null, '일시정지'),
      resume,
      el('div.fl2-prows', null,
        row('공포 연출', seg('scares', [['full', '보통'], ['light', '덜 무섭게']])),
        row('글자 크기', seg('textSize', [[0.9, '작게'], [1, '보통'], [1.15, '크게']], { nearest: true, dflt: 1 })),
        // the one AI-voice disclosure of the episode (OpenAI TTS policy) — out of fiction, under the sound options
        row('소리', seg('audioMode', [['ear', '이어폰'], ['speaker', '스피커']]), '목소리는 AI 음성입니다.'),
        row('소리 자막', seg('subs', [['info', '정보만'], ['all', '모두']])),
        row('진동', seg('vibration', [[true, '켬'], [false, '끔']])),
        row('화면 효과', el('div.fl2-togs', null, toggle('reduceShake', '흔들림 줄이기'), toggle('reduceFlash', '깜빡임 줄이기'))),
        el('div.fl2-prow', null, myMsgs)),
      toTitle));
    pauseBack = safe(() => (G.phone && G.phone.pushBack ? G.phone.pushBack(() => { SC.closePause(); return true; }) : null), null);
  };
  SC.closePause = function () {
    if (!pauseEl) return;
    const p = pauseEl; pauseEl = null;
    if (typeof pauseBack === 'function') safe(pauseBack); pauseBack = null;
    removeScene(p, 300);
    safe(() => G.clock && G.clock.resume && G.clock.resume());
    safe(() => G.bus && G.bus.emit('pause', { open: false }));
  };
  function toTitleScreen() {
    safe(() => G.save && G.save(true));
    safe(() => G.hook && G.hook.patchNow && G.hook.patchNow());
    const b = scene('fl2-black');
    setTimeout(() => { try { location.reload(); } catch (e) {} }, 400);
    return b;
  }

  /* ---------- init ---------- */
  SC.init = function () {
    if (SC._inited) return; SC._inited = true;
    safe(() => G.hooks && G.hooks.set && G.hooks.set('pause:open', () => SC.pause()));
    if (G.bus) {
      G.bus.on('room:closeup', onCloseup);
      G.bus.on('alarm:ringing', onRinging);
    }
  };
  // hook registration must not wait for boot (shell's ⏸ may be wired before main runs)
  safe(() => G.hooks && G.hooks.set && G.hooks.set('pause:open', () => SC.pause()));
})();
