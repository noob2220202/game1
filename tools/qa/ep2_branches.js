/* =========================================================
 * tools/qa/ep2_branches.js — branch coverage the §11.3 speedrun does not take (companion of ep2_speedrun.js).
 *
 *   NODE_PATH=<global node_modules> node tools/qa/ep2_branches.js [--only=A,B,C,D,E,F,G,H] [--headed]
 *
 * Each scenario starts from a haru.jump state (DEBUG) and then plays with real taps / typing on data-qa selectors:
 *   A  M8 door → '—' chip keep → near share [거절] (declined line) → phone chip kept → 02:00 jimin: wrong first answer
 *      (typing ×2 + `…괜찮아요. 천천히요.` once) → right answer → END → series stage keep/kept → HOOK → title;
 *      then a replay (처음부터 → haru.jump END with commit) and title.recanon → confirm → series stage = the replay's choices.
 *   B  M8 door (accept path) → 02:00 jimin: the right answer typed while the 4 lines are still arriving → END without a
 *      second answer (moment.js earlyOk).
 *   C  pause menu 덜 무섭게 + 스피커 → M5 → climax c2 (B14 less variant) → M7 → siren, no errors.
 *   D  early lures: lure1 (volume back to 15 after 60 s) / lure2 (music cut) → M6 due → siren 'early'.
 *   E  reload while the 02:00 jimin lines are arriving → 이어하기 → answer mode still comes → END.
 *   F  reload right after the first C1 message → 이어하기 → the replies, mono3 and the next chip still come.
 *   G  client-filled config (MAKER_* + LETTERS.ep2) at text size 1.3: overflow sweep of every app, handle + avatar on the
 *      real profile, the 02:20 letter card (head, line breaks) → credits → HOOK.
 *   H  two-finger tap opens the pause menu (clock paused); a two-finger pinch does not.
 * Exit 0 = every selected scenario passed with 0 pageerrors / console errors / failed requests. JSON summary on the last line.
 * ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'file:///' + path.join(ROOT, 'ep2', 'index.html').replace(/\\/g, '/') + '?debug=1';
const OUT = path.join(ROOT, 'work', 'shots', 'branches');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (ARG.only ? String(ARG.only) : 'A,B,C,D,E,F,G,H').split(',');
const T0 = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T0) / 1000).toFixed(1) + 's]').padEnd(9), ...a);

async function scenario(browser, id, fn) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300) + ' @' + (m.location().url || '').replace(/.*game1/, '') + ':' + m.location().lineNumber); });
  page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url().replace(/.*game1/, '') + ' ' + ((r.failure() && r.failure().errorText) || '')));
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (f, a) => page.evaluate(f, a);
  const sel = (v) => `[data-qa="${v}"]:visible`;
  const loc = (v) => page.locator(sel(v)).last();
  let n = 0;
  const shot = async (label) => { n++; try { await page.screenshot({ path: path.join(OUT, id + '_' + String(n).padStart(2, '0') + '_' + label + '.png') }); } catch (e) {} };
  const flags = () => ev(() => (window.haru && haru.flags ? haru.flags() : []));
  const has = async (f) => (await flags()).includes(f);
  async function tap(v, o) {
    o = o || {};
    const l = loc(v);
    await l.waitFor({ state: 'visible', timeout: o.timeout || 15000 });
    await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await l.click({ timeout: o.timeout || 15000 });
    await sleep(o.after == null ? 450 : o.after);
  }
  async function tapIf(v, ms) { try { await tap(v, { timeout: ms || 1500 }); return true; } catch (e) { return false; } }
  async function waitFlag(f, timeout) {
    const t = Date.now();
    while (Date.now() - t < (timeout || 30000)) { if (await has(f)) return true; await sleep(250); }
    throw new Error('timeout waiting for flag ' + f);
  }
  async function waitText(t, timeout) {
    const s = Date.now();
    while (Date.now() - s < (timeout || 20000)) { if (await ev((t) => document.getElementById('screen').innerText.indexOf(t) >= 0, t)) return true; await sleep(250); }
    throw new Error('timeout waiting for text ' + t);
  }
  const textOn = (t) => ev((t) => document.getElementById('screen').innerText.split(t).length - 1, t);
  const typeKo = (s) => ev((s) => window.haru.type(s), s);
  const series = () => ev(() => JSON.parse(localStorage.getItem('haru-escape.series.v1') || 'null'));
  const H = { page, sleep, ev, loc, tap, tapIf, waitFlag, waitText, textOn, typeKo, shot, series, has, flags };
  const res = { id, pass: false, errors, notes: [] };
  log('▶ scenario', id);
  try { await fn(H, res); res.pass = errors.length === 0; }
  catch (e) {
    res.failure = e.message.split('\n')[0];
    log('✗', id, res.failure);
    await shot('FAIL');
    res.state = await ev(() => ({ flags: haru.flags(), clock: G.clock.hm(), qa: [...document.querySelectorAll('[data-qa]')].filter((x) => x.offsetParent).map((x) => x.dataset.qa).slice(-40) })).catch(() => null);
  }
  if (errors.length) { log('  errors:'); errors.forEach((e) => log('   ', e)); }
  log(res.pass ? '✔' : '✗', 'scenario', id, res.notes.join(' · '));
  await ctx.close();
  return res;
}

/* shared: M8 door → handle → k0110 */
async function toCards(H) {
  await H.page.goto(BASE + '&jump=M8');
  await H.sleep(2500);
  await H.tap('room.spot:handle', { timeout: 20000, after: 1000 });
  await H.waitFlag('doorOpened', 10000);
  await H.tap('card.continue', { timeout: 15000 });
}
/* shared: 02:00 → open jimin from the N16 banner (or the list) */
async function openJimin(H) {
  await H.waitFlag('jiminReturn', 60000);
  if (!(await H.tapIf('banner:N16', 6000))) {
    await H.tap('home.app:moment', { after: 1200 }); await H.tapIf('moment.tab:messages', 1500); await H.tap('moment.thread:jimin_0412', { after: 1200 });
  }
}

const SCEN = {
  async A(H, res) {
    await toCards(H);
    await H.tap('card.chip:keep', { timeout: 15000 });
    await H.waitFlag('dashChoiceDone', 15000);
    await H.tap('card.continue', { timeout: 20000 });
    await H.waitFlag('pol1Shown', 15000);
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('share.decline', { timeout: 15000, after: 1200 });
    if (await H.has('nearbyTaken')) throw new Error('nearbyTaken set after [거절]');
    await H.waitText('알겠어요.', 8000);
    await H.shot('declined');
    await H.tap('card.continue', { timeout: 15000 });
    await H.tap('card.chip:kept', { timeout: 15000 });
    await H.waitFlag('phoneChoiceDone', 15000);
    await H.tap('card.continue', { timeout: 20000 });
    await openJimin(H);
    await H.loc('chat.noAnswer').waitFor({ state: 'visible', timeout: 30000 });
    // wrong first answer: typing on/off ×2, then `…괜찮아요. 천천히요.` once
    await H.tap('chat.input', { after: 400 });
    await H.typeKo('잘 모르겠어요');
    await H.tap('chat.send', { after: 600 });
    await H.waitText('천천히요.', 12000);
    await H.sleep(1500);
    if (await H.has('END')) throw new Error('END after a wrong answer');
    await H.shot('wrong1');
    await H.tap('chat.input', { after: 400 });
    await H.typeKo('그것도 아닌 것 같아요');
    await H.tap('chat.send', { after: 600 });
    await H.sleep(4500);
    const nWrong = await H.textOn('천천히요.');
    if (nWrong !== 1) throw new Error('first-wrong line shown ' + nWrong + '×');
    res.notes.push('wrong-line once');
    await H.tap('chat.input', { after: 400 });
    await H.typeKo('끝까지 안 나왔어요');
    await H.tap('chat.send', { after: 600 });
    await H.waitFlag('END', 20000);
    await H.shot('END');
    let s = await H.series();
    if (!(s && s.s && s.s.e2_dash === 'kept' && s.s.e2_phone === 'kept' && s.eps['2'].st === 'done' && s.eps['2'].canon)) throw new Error('series after END ' + JSON.stringify(s && s.s));
    res.notes.push('stage dash/phone kept');
    // finish: tail chips → cards → credits → check → hook → title
    for (let i = 0; i < 2; i++) { await H.page.locator('[data-qa="chat.chip"]:visible').first().click({ timeout: 40000 }); await H.sleep(400); await H.tap('chat.send', { after: 1200 }); }
    for (let i = 0; i < 4 && !(await H.has('kangWrapDone')); i++) { await H.tap('card.continue', { timeout: 60000, after: 1500 }); }
    await H.waitFlag('kangWrapDone', 8000);
    await H.tapIf('card.continue', 6000);
    await H.tap('credits.skip', { timeout: 30000, after: 1500 });
    await H.tap('check.continue', { timeout: 20000, after: 1500 });
    await H.waitFlag('HOOK', 30000);
    await H.tap('lock.notif:N17', { timeout: 15000, after: 1500 });
    await H.tap('hook.home', { timeout: 45000, after: 2500 });
    await H.loc('title.hookReplay').waitFor({ state: 'visible', timeout: 15000 });
    if (await H.loc('title.recanon').isVisible().catch(() => false)) throw new Error('recanon offered after the first (canon) completion');
    // replay → END (jump + commit = a non-first completion, not canon) → title.recanon
    await H.tap('title.restart', { after: 800 });
    await H.tap('dialog.btn:restart', { timeout: 5000 });
    await H.loc('warn.ok').waitFor({ state: 'visible', timeout: 15000 });
    await H.ev(() => haru.jump('END', { commit: true }));
    await H.sleep(2500);
    s = await H.series();
    if (s.s.e2_dash !== 'kept') throw new Error('replay overwrote the canon stage: ' + JSON.stringify(s.s));
    await H.page.goto(BASE);
    await H.sleep(2500);
    await H.shot('title_replay');
    await H.tap('title.recanon', { timeout: 10000, after: 800 });
    await H.tap('dialog.btn:change', { timeout: 5000 });
    await H.sleep(1500);
    s = await H.series();
    if (!(s.s.e2_dash === 'locked' && s.s.e2_phone === 'police')) throw new Error('recanon did not overwrite: ' + JSON.stringify(s.s));
    res.notes.push('recanon overwrite ok');
  },
  async B(H, res) {
    await toCards(H);
    await H.tap('card.chip:lock', { timeout: 15000 });
    await H.waitFlag('dashChoiceDone', 15000);
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('share.accept', { timeout: 15000, after: 1500 });
    await H.tap('viewer.close', { timeout: 8000, after: 900 });
    await H.tap('card.chip:police', { timeout: 15000 });
    await H.tap('card.continue', { timeout: 20000 });
    await openJimin(H);
    await H.tap('chat.input', { timeout: 8000, after: 200 });
    const early = await H.ev(() => !document.querySelector('[data-qa="chat.noAnswer"]'));
    await H.typeKo('끝까지 안 나왔어요');
    await H.tap('chat.send', { after: 400 });
    res.notes.push(early ? 'sent before answer mode' : 'answer mode was already open (timing)');
    await H.waitFlag('END', 25000);
    await H.shot('END_early');
    const right = await H.has('answeredRight');
    if (!right) throw new Error('answeredRight missing');
    res.notes.push('END right');
  },
  async C(H, res) {
    await H.page.goto(BASE + '&jump=M5');
    await H.sleep(3000);
    await H.tap('statusbar.pause', { timeout: 8000 }).catch(() => H.tap('pause.btn'));
    await H.tap('pause.opt:scares:light');
    await H.tap('pause.opt:audioMode:speaker');
    await H.shot('pause');
    await H.tap('pause.resume', { after: 800 });
    const st = await H.ev(() => ({ less: G.e2.less(), mode: G.settings.audioMode }));
    if (!st.less || st.mode !== 'speaker') throw new Error('settings not applied ' + JSON.stringify(st));
    await H.ev(() => haru.climax('c2'));
    await H.waitFlag('C2', 5000);
    await H.sleep(8000);
    await H.shot('c2_less');
    await H.ev(() => haru.time(10));
    await H.waitFlag('M7', 90000);
    await H.ev(() => haru.time(1));
    await H.sleep(6000);
    await H.shot('m7');
    const sb = await H.ev(() => G.state.vars.climax && G.state.vars.climax.sirenBy || (G.state.vars.sirenBy));
    res.notes.push('sirenBy ' + sb);
    if (sb !== 'c2') throw new Error('c2 siren should be c2, got ' + sb);
  },
  async D(H, res) {
    await H.page.goto(BASE + '&jump=M5');
    await H.sleep(3000);
    await H.ev(() => haru.climax('lure1'));
    await H.sleep(1500);
    let st = await H.ev(() => ({ c: G.climax.state(), vol: G.media && G.media.volume && G.media.volume() }));
    res.notes.push('lure1 ' + JSON.stringify(st.c).slice(0, 120));
    await H.ev(() => haru.climax('lure2'));
    await H.ev(() => haru.time(10));
    await H.waitFlag('M6', 120000);
    await H.waitFlag('M7', 120000);
    await H.ev(() => haru.time(1));
    await H.sleep(3000);
    st = await H.ev(() => G.climax.state());
    await H.shot('lure_m7');
    res.notes.push('after lure2 ' + JSON.stringify(st).slice(0, 160));
    const sb = await H.ev(() => (G.state.vars.climax && G.state.vars.climax.sirenBy) || G.state.vars.sirenBy);
    res.notes.push('sirenBy ' + sb);
    if (sb !== 'early') throw new Error('lure2 siren should be early, got ' + sb);
  },
  /* E — reload in the middle of the 02:00 jimin script (social queue + G.e2.sched persisted) → 이어하기 → answer → END */
  async E(H, res) {
    await toCards(H);
    await H.tap('card.chip:lock', { timeout: 15000 });
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('share.decline', { timeout: 15000, after: 1200 });
    await H.tap('card.continue', { timeout: 15000 });
    await H.tap('card.chip:police', { timeout: 15000 });
    await H.tap('card.continue', { timeout: 20000 });
    await openJimin(H);
    await H.sleep(1500);   // j0200a/b on screen, c/d still queued
    await H.page.goto(BASE);
    await H.sleep(2500);
    await H.tap('title.continue', { after: 2500 });
    if (!(await H.loc('chat.noAnswer').isVisible().catch(() => false))) {
      await H.tapIf('banner:N16', 3000) || (await H.tap('home.app:moment', { after: 1200 }), await H.tapIf('moment.tab:messages', 1500), await H.tap('moment.thread:jimin_0412', { after: 1200 }));
    }
    await H.loc('chat.noAnswer').waitFor({ state: 'visible', timeout: 30000 });
    res.notes.push('answer mode after reload');
    await H.tap('chat.input', { after: 400 });
    await H.typeKo('한 마디만 나왔어요');
    await H.tap('chat.send', { after: 600 });
    await H.waitFlag('END', 20000);
    await H.shot('END_after_reload');
    res.notes.push('END');
  },
  /* G — client-filled config (MAKER_NAME/CONTACT/HANDLE/AVATAR + LETTERS.ep2, §0.2 ⑦) at text size 1.3 (§9.5-6):
   *     moment search → real/fake profiles (handle line + photo avatar), a horizontal-overflow sweep over every {N} app,
   *     then M8 → END → tail → 02:15 → the 02:20 letter card (head `{MAKER}의 편지`, line breaks kept) → credits → HOOK. */
  async G(H, res) {
    const CFG = { PLAYER_NAME: '하루', MAKER_NAME: '민지', MAKER_CONTACT: '민지', MAKER_HANDLE: 'minji_0', MAKER_AVATAR: 'assets/img/avatar_kongi.jpg',
      LETTERS: { ep2: '하루야, 끝까지 와 줘서 고마워.\n이번엔 내가 문 앞에 있었어.' } };
    await H.page.context().addInitScript((cfg) => {
      let c; Object.defineProperty(window, 'CONFIG', { configurable: true, get() { return c; }, set(v) { c = v; if (v && typeof v === 'object') Object.assign(v, cfg); } });
      try { const k = 'haru-escape.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.textSize = 1.3; localStorage.setItem(k, JSON.stringify(s)); } catch (e) {}
    }, CFG);
    await H.page.goto(BASE + '&jump=M4');
    await H.sleep(3000);
    const ts = await H.ev(() => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim());
    if (ts !== '1.3') throw new Error('--ts not 1.3: ' + ts);
    /* overflow sweep: visible elements of the top screen whose box leaves #screen horizontally (not inside a scroller) */
    const overflow = () => H.ev(() => {
      const scr = document.getElementById('screen').getBoundingClientRect();
      const bad = [];
      const clipped = (n) => { for (let p = n.parentElement; p && p.id !== 'screen'; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') return true; } return false; };
      document.querySelectorAll('#screen *').forEach((n) => {
        if (!n.offsetParent && getComputedStyle(n).position !== 'fixed') return;
        const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || +cs.opacity === 0) return;
        const r = n.getBoundingClientRect(); if (!r.width || !r.height) return;
        if ((r.right > scr.right + 2 || r.left < scr.left - 2) && !clipped(n) && n.closest('[class]') && !n.closest('.sh2-hid, .wallpaper')) bad.push((n.className && String(n.className).slice(0, 40)) || n.tagName);
      });
      const tops = [...document.querySelectorAll('#app-stack > *')].filter((x) => getComputedStyle(x).visibility !== 'hidden');
      const wide = tops.filter((x) => x.scrollWidth > x.clientWidth + 2).map((x) => String(x.className).slice(0, 40));
      return { bad: [...new Set(bad)].slice(0, 8), wide };
    });
    const apps = ['talk', 'moment', 'mail', 'gallery', 'memo', 'browser', 'recorder', 'clock', 'calendar', 'alerts', 'timeline', 'phone', 'settings'];
    const offenders = [];
    for (const a of apps) {
      await H.tap('home.app:' + a, { after: 1300 });
      const o = await overflow();
      if (o.bad.length || o.wide.length) offenders.push(a + ' ' + JSON.stringify(o));
      await H.shot('ts13_' + a);
      await H.tap('home.bar', { after: 700 });
    }
    res.notes.push(offenders.length ? 'overflow: ' + offenders.join(' | ') : 'no horizontal overflow at 1.3 (13 apps)');
    /* moment search → the real profile: handle line + photo avatar */
    await H.tap('home.app:moment', { after: 1200 });
    await H.tap('moment.tab:search', { after: 700 });
    await H.tap('moment.search', { after: 400 });
    await H.typeKo('민지');
    await H.sleep(800);
    await H.tap('moment.result:real', { after: 1200 });
    await H.shot('real_profile');
    const prof = await H.ev(() => { const p = document.querySelector('[data-qa="moment.profile:real"]'); return p ? { text: p.innerText, imgs: [...p.querySelectorAll('img')].map((i) => i.getAttribute('src')), bg: [...p.querySelectorAll('*')].map((x) => getComputedStyle(x).backgroundImage).filter((b) => b && b !== 'none') } : null; });
    if (!prof) throw new Error('real profile not rendered');
    if (prof.text.indexOf('@minji_0') < 0) throw new Error('handle line missing: ' + prof.text.slice(0, 120));
    if (!prof.imgs.concat(prof.bg).some((s) => /avatar_kongi/.test(s))) throw new Error('maker avatar not used: ' + JSON.stringify(prof).slice(0, 200));
    res.notes.push('handle + avatar ok');
    /* ending with the letter */
    await toCards(H);
    await H.tap('card.chip:lock', { timeout: 15000 });
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('card.continue', { timeout: 20000 });
    await H.tap('share.accept', { timeout: 15000, after: 1500 });
    await H.tap('viewer.close', { timeout: 8000, after: 900 });
    await H.tap('card.chip:police', { timeout: 15000 });
    await H.tap('card.continue', { timeout: 20000 });
    await openJimin(H);
    await H.loc('chat.noAnswer').waitFor({ state: 'visible', timeout: 30000 });
    await H.tap('chat.input', { after: 400 });
    await H.typeKo('한 마디만 나왔어요');
    await H.tap('chat.send', { after: 600 });
    await H.waitFlag('END', 20000);
    await H.shot('END');
    for (let i = 0; i < 2; i++) { await H.page.locator('[data-qa="chat.chip"]:visible').first().click({ timeout: 40000 }); await H.sleep(400); await H.tap('chat.send', { after: 1200 }); }
    for (let i = 0; i < 4 && !(await H.has('kangWrapDone')); i++) { await H.tap('card.continue', { timeout: 60000, after: 1500 }); }
    await H.waitFlag('kangWrapDone', 8000);
    await H.page.locator('.fl2-card[data-step="l0220"]').waitFor({ state: 'visible', timeout: 15000 });
    await H.sleep(1500);
    await H.shot('letter');
    const letter = await H.ev(() => { const c = document.querySelector('.fl2-card[data-step="l0220"]'); const t = c && c.querySelector('.fl2-letter-text'); return c ? { text: c.innerText, ws: t && getComputedStyle(t).whiteSpace, lines: t && t.innerText.split('\n').length } : null; });
    if (!letter || letter.text.indexOf('민지의 편지') < 0) throw new Error('letter head missing: ' + JSON.stringify(letter));
    if (!(letter.lines >= 2)) throw new Error('letter line break lost: ' + JSON.stringify(letter));
    res.notes.push('letter card ok');
    await H.tap('card.continue', { timeout: 10000, after: 1500 });
    await H.waitText('만든 사람 민지', 10000);
    await H.shot('credits');
    await H.tap('credits.skip', { timeout: 30000, after: 1500 });
    await H.tap('check.continue', { timeout: 20000, after: 1500 });
    await H.waitFlag('HOOK', 30000);
    res.notes.push('HOOK');
  },
  /* H — two-finger tap → pause (§9.5 / ARCH §3.2 main); a two-finger pinch (moved ≥ 10 px) must not pause */
  async H(H, res) {
    await H.page.goto(BASE + '&jump=M1');
    await H.sleep(3000);
    const cdp = await H.page.context().newCDPSession(H.page);
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })) });
    // pinch first: must not pause
    await touch('touchStart', [[120, 400], [260, 400]]);
    for (let i = 1; i <= 6; i++) { await touch('touchMove', [[120 - i * 6, 400], [260 + i * 6, 400]]); await H.sleep(16); }
    await touch('touchEnd', []);
    await H.sleep(600);
    if (await H.loc('pause.resume').isVisible().catch(() => false)) throw new Error('pinch opened the pause menu');
    // two-finger tap
    await touch('touchStart', [[120, 400], [260, 400]]);
    await H.sleep(80);
    await touch('touchEnd', []);
    await H.sleep(800);
    if (!(await H.loc('pause.resume').isVisible().catch(() => false))) throw new Error('two-finger tap did not open the pause menu');
    const running = await H.ev(() => G.clock.running());
    if (running) throw new Error('clock still running while paused');
    await H.shot('pause_twofinger');
    await H.tap('pause.resume', { after: 600 });
    if (!(await H.ev(() => G.clock.running()))) throw new Error('clock not resumed');
    res.notes.push('two-finger pause ok · pinch ignored');
    // the ✎ tab (header-row dock) opens the notebook from an app screen and from a dialog; Esc closes it
    await H.tap('home.app:settings', { after: 900 });
    await H.tap('nb.fab', { after: 900 });
    if (!(await H.loc('nb.close').isVisible().catch(() => false))) throw new Error('notebook did not open from the ✎ tab');
    await H.tap('nb.tab:hint', { after: 500 });
    await H.shot('notebook_hint');
    await H.page.keyboard.press('Escape'); await H.sleep(700);
    if (await H.loc('nb.close').isVisible().catch(() => false)) throw new Error('Esc did not close the notebook');
    if (!(await H.loc('settings.row:lock').isVisible().catch(() => false))) throw new Error('Esc closed more than the notebook');
    res.notes.push('✎ opens notebook · Esc closes only it');
  },
  /* F — reload right after the first C1 message to the real friend → 이어하기 → the 3 replies + mono3 + chip still come */
  async F(H, res) {
    await H.page.goto(BASE + '&jump=M4');
    await H.sleep(3000);
    await H.tap('home.app:moment', { after: 1200 });
    await H.tap('moment.tab:messages', { after: 800 });
    await H.tap('moment.requests', { after: 900 });
    await H.tap('moment.restricted', { after: 1200 });
    await H.tap('moment.unrestrict', { after: 1500 });
    await H.page.locator('[data-qa="chat.chip"]:visible').first().click({ timeout: 20000 });
    await H.sleep(400);
    await H.tap('chat.send', { after: 600 });
    await H.waitFlag('C1', 6000);
    await H.page.goto(BASE);
    await H.sleep(2500);
    await H.tap('title.continue', { after: 2000 });
    // the {N} lock after resume: swipe up
    const lk = H.loc('lock.surface');
    if (await lk.isVisible().catch(() => false)) {
      const b = await lk.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height * 0.8;
      await H.page.mouse.move(x, y); await H.page.mouse.down();
      for (let i = 1; i <= 14; i++) { await H.page.mouse.move(x, y - (380 * i) / 14); await H.sleep(16); }
      await H.page.mouse.up(); await H.sleep(1200);
    }
    await H.waitFlag('mono3', 40000);
    res.notes.push('mono3 after reload');
    if (!(await H.loc('moment.thread:real').isVisible().catch(() => false)) && !(await H.loc('chat.input').isVisible().catch(() => false))) {
      await H.tapIf('home.app:moment', 3000); await H.tapIf('moment.tab:messages', 1500);
    }
    if (await H.loc('moment.thread:real').isVisible().catch(() => false)) await H.tap('moment.thread:real', { after: 1200 });
    await H.page.locator('[data-qa="chat.chip"]:visible').first().waitFor({ state: 'visible', timeout: 30000 });
    await H.shot('c1_after_reload');
    res.notes.push('next chip shown');
  },
};

(async () => {
  const browser = await chromium.launch({ headless: !ARG.headed });
  const results = [];
  for (const id of ONLY) if (SCEN[id]) results.push(await scenario(browser, id, SCEN[id]));
  await browser.close();
  const pass = results.every((r) => r.pass);
  console.log(JSON.stringify({ pass, results: results.map((r) => ({ id: r.id, pass: r.pass, failure: r.failure || null, notes: r.notes, errors: r.errors.length, state: r.state || undefined })), wallSec: Math.round((Date.now() - T0) / 1000) }));
  process.exit(pass ? 0 : 1);
})();
