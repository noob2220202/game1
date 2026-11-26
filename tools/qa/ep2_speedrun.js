/* =========================================================
 * tools/qa/ep2_speedrun.js — DESIGN_EP2 §11.3 speedrun (ARCH §6.4) end to end through data-qa selectors.
 *
 *   NODE_PATH=<global node_modules> node tools/qa/ep2_speedrun.js [--ep1=none|done] [--name=<shot dir>] [--headed]
 *
 * Plays file:///…/ep2/index.html?debug=1 in Chromium with the 'iPhone 13' profile, from the title to END and the
 * 03:33 hook, with real taps / holds / drags. window.haru is used only for time acceleration (haru.time) and Korean
 * text entry (haru.type) — never to set progress flags. Asserts every milestone M0…M8, END, HOOK and the series record
 * (haru-escape.series.v1) at the end. Screenshots per milestone → work/shots/speedrun/<name>/.
 *   --ep1=done   seeds a synthetic, finished episode-1 save (ep1 flag names) before boot → checks the ep1 callbacks.
 * Exit code 0 = pass (every step + cb check ok, 0 pageerrors / console errors / failed requests). JSON summary on the last line;
 * summary.fabOverlaps lists header controls found under the notebook ✎ tab at any screenshot (soft check, does not fail).
 * ========================================================= */
'use strict';
const path = require('path');
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();
const fs = require('fs');

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file:///' + path.join(ROOT, 'ep2', 'index.html').replace(/\\/g, '/') + '?debug=1';
const EP1 = ARG.ep1 || 'none';
const NAME = ARG.name || (EP1 === 'done' ? 'ep1done' : 'fresh');
const OUT = path.join(ROOT, 'work', 'shots', 'speedrun', NAME);
fs.mkdirSync(OUT, { recursive: true });

const T_START = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T_START) / 1000).toFixed(1) + 's]').padEnd(9), ...a);
const errors = [];
const milestones = {};
let shotN = 0;

/* synthetic finished episode-1 save (ep1 flag names — js/scenes.js, engine/series.js e1Fields) */
function ep1Save() {
  const T0 = new Date(2026, 10, 24, 5, 0).getTime();
  return { v: 1, flags: { introDone: T0 - 3600000, M1: T0 - 3000000, knockSilenced: T0 - 900000, alarmDeleted: T0 - 800000, trap0404: T0 - 700000,
    vaultSeen: T0 - 600000, ringHeard: T0 - 500000, managerExposed: T0 - 400000, jiminTold: T0 - 300000, momRead: T0 - 200000, END: T0 },
  vars: { js1Spent: true, knockCount: 4 }, playMs: 2820000, hintsUsed: 2,
  threads: { 'talk:haru': [{ id: 'h1', from: 'me', text: '세아야 나야', t: '2026-11-24 03:58' }, { id: 'h2', from: 'me', text: '문 열 거야', t: '2026-11-24 04:40' }] },
  notifs: [], read: {}, fragments: {}, seen: {} };
}

(async () => {
  const browser = await chromium.launch({ headless: !ARG.headed });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  /* --names: QA names (§10 F) — PLAYER_NAME '테스트이름가', MAKER_NAME '만든사람나'; the end-of-run localStorage dump must contain neither */
  const NAMES = ARG.names ? { PLAYER_NAME: '테스트이름가', MAKER_NAME: '만든사람나' } : null;
  if (NAMES) await ctx.addInitScript((nm) => {
    let c; Object.defineProperty(window, 'CONFIG', { configurable: true, get() { return c; }, set(v) { c = v; if (v && typeof v === 'object') Object.assign(v, nm); } });
  }, NAMES);
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 800)));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push('CONSOLE ' + t.slice(0, 400) + ' @' + ((m.location().url || '').replace(/.*game1/, '') + ':' + m.location().lineNumber));
    if (ARG.verbose && (m.type() === 'warning' || m.type() === 'log')) log('  page.' + m.type() + ':', t.slice(0, 200));
  });
  page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url().replace(/.*game1/, '') + ' ' + ((r.failure() && r.failure().errorText) || '')));

  /* ---------- helpers ---------- */
  const sel = (v) => `[data-qa="${v}"]:visible`;
  const loc = (v) => page.locator(sel(v)).last();
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const flags = () => ev(() => (window.haru && window.haru.flags ? window.haru.flags() : Object.keys((window.G && G.state && G.state.flags) || {})));
  const has = async (f) => (await flags()).includes(f);
  /* soft layout check at every screenshot: controls lying under the notebook ✎ tab's 44 px tap target (and not covered by
     a higher layer) — the tab docks in the header row, so this should stay empty. Logged + summary.fabOverlaps. */
  const fabOverlaps = [];
  const fabCheck = () => ev(() => {
    const fab = document.querySelector('#screen > .nb-fab'); if (!fab || /\bhide/.test(fab.className)) return [];
    if (fab.style.getPropertyValue('--nb-top')) return [];   // slid below a notification banner for its ~4 s (by design)
    const fs = getComputedStyle(fab); if (fs.visibility === 'hidden' || +fs.opacity < 0.1) return [];
    const r = fab.getBoundingClientRect(); if (!r.width) return [];
    const c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!c || !(c === fab || fab.contains(c))) return [];
    const hit = { l: r.right - 44, r: r.right, t: r.top - 2, b: r.bottom + 2 }, out = [];
    document.querySelectorAll('#screen button, #screen [data-qa], #screen [role=button], #screen a').forEach((n) => {
      if (n === fab || fab.contains(n)) return;
      const s = getComputedStyle(n); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0 || s.pointerEvents === 'none') return;
      const b = n.getBoundingClientRect(); if (!b.width || !b.height || b.width * b.height > 40000) return;   // surfaces (lock, panels) are not controls
      if (b.right <= hit.l || b.left >= hit.r || b.bottom <= hit.t || b.top >= hit.b) return;
      const x = (Math.max(b.left, hit.l) + Math.min(b.right, hit.r)) / 2, y = (Math.max(b.top, hit.t) + Math.min(b.bottom, hit.b)) / 2;
      const st = document.elementsFromPoint(x, y).filter((e) => e !== fab && !fab.contains(e));
      if (!st.length || !(st[0] === n || n.contains(st[0]))) return;
      out.push((n.dataset.qa || String(n.className || n.tagName).slice(0, 32)) + '@' + Math.round(b.width) + 'x' + Math.round(b.height));
    });
    return out;
  }).catch(() => []);
  async function shot(label) {
    shotN++;
    const f = path.join(OUT, String(shotN).padStart(2, '0') + '_' + label.replace(/[^a-z0-9_.-]+/gi, '_') + '.png');
    try { await page.screenshot({ path: f }); } catch (e) { log('shot failed', e.message); }
    const ov = await fabCheck();
    if (ov.length) { fabOverlaps.push(label + ': ' + ov.join(', ')); log('  (✎ tab over: ' + ov.join(', ') + ')'); }
    return f;
  }
  async function tap(v, o) {
    o = o || {};
    const l = loc(v);
    await l.waitFor({ state: 'visible', timeout: o.timeout || 15000 });
    await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await l.click({ timeout: o.timeout || 15000, position: o.position });
    await sleep(o.after == null ? 450 : o.after);
  }
  async function tapIf(v, ms) { try { await tap(v, { timeout: ms || 1500 }); return true; } catch (e) { return false; } }
  async function box(v, timeout) {
    const l = loc(v);
    await l.waitFor({ state: 'visible', timeout: timeout || 15000 });
    await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    return l.boundingBox();
  }
  async function hold(v, ms) {
    const b = await box(v);
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await sleep(ms || 1000);
    await page.mouse.up();
    await sleep(500);
  }
  async function drag(v, dx, dy, o) {
    o = o || {};
    const b = await box(v);
    const x = b.x + b.width * (o.fx == null ? 0.5 : o.fx), y = b.y + b.height * (o.fy == null ? 0.5 : o.fy);
    await page.mouse.move(x, y); await page.mouse.down();
    const n = 14;
    for (let i = 1; i <= n; i++) { await page.mouse.move(x + (dx * i) / n, y + (dy * i) / n); await sleep(16); }
    await page.mouse.up();
    await sleep(700);
  }
  async function waitFlag(f, timeout, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < (timeout || 30000)) {
      if (await has(f)) { return true; }
      await sleep(250);
    }
    throw new Error('timeout waiting for flag ' + f + (label ? ' (' + label + ')' : ''));
  }
  async function waitFn(fn, timeout, label, arg) {
    const t0 = Date.now();
    while (Date.now() - t0 < (timeout || 30000)) {
      try { if (await ev(fn, arg)) return true; } catch (e) {}
      await sleep(250);
    }
    throw new Error('timeout: ' + label);
  }
  const scale = (k) => ev((k) => window.haru && window.haru.time && window.haru.time(k), k);
  const typeKo = (s) => ev((s) => window.haru.type(s), s);
  const clock = () => ev(() => (G.clock && G.clock.hm ? G.clock.hm() : '?'));
  async function milestone(id) {
    const c = await clock();
    milestones[id] = { clock: c, wall: ((Date.now() - T_START) / 1000).toFixed(1) };
    log('★ milestone', id, 'clock', c);
    await shot('ms_' + id);
  }
  /* chips: data-qa 'chat.chip' (+ data-chip = chip key). key given → that chip; else the first one */
  async function chip(key, timeout) {
    const l = page.locator('[data-qa="chat.chip"]' + (key ? '[data-chip="' + key + '"]' : '') + ':visible').first();
    await l.waitFor({ state: 'visible', timeout: timeout || 30000 });
    await l.click({ timeout: 10000 });
    await sleep(500);
  }
  /* ep1 callback checks (render only): the text must be on screen iff the synthetic ep1 save is present */
  const cbChecks = [];
  async function cbText(label, text) {
    const on = await ev((t) => (document.getElementById('screen') || document.body).innerText.indexOf(t) >= 0, text);
    const want = EP1 === 'done';
    cbChecks.push({ label, text, on, ok: on === want });
    log('  cb', label, on === want ? 'ok' : 'MISMATCH', '(' + (on ? 'shown' : 'absent') + ')');
  }
  async function backTo(v, max) {
    for (let i = 0; i < (max || 4); i++) { if (await loc(v).isVisible().catch(() => false)) return; await back(); }
    await loc(v).waitFor({ state: 'visible', timeout: 3000 });
  }
  async function home() { await tap('home.bar', { after: 700 }); }
  /* "back" = the header ← of the topmost screen; screens without one (photo/video viewer) use their ✕; else Esc (= Android back) */
  async function back() {
    if (await loc('viewer.close').isVisible().catch(() => false)) return tap('viewer.close', { after: 550 });
    if (await loc('nav.back').isVisible().catch(() => false)) return tap('nav.back', { after: 550 });
    await page.keyboard.press('Escape'); await sleep(550);
  }
  /* DEV ONLY: --from=9 starts at the M8 door through haru.jump('M8') (never a valid pass — summary.dev = true) */
  const FROM = ARG.from ? Number(ARG.from) : 0;
  async function step(name, fn) {
    const n = parseInt(name, 10);
    if (FROM && n < FROM) { log('skip', name); return; }
    log('→', name);
    try { await fn(); }
    catch (e) {
      log('✗ FAILED', name, '—', e.message.split('\n')[0]);
      await shot('FAIL_' + name);
      const st = await ev(() => ({ flags: window.haru && haru.flags(), clock: G.clock && G.clock.hm(), user: G.users && G.users.current(),
        qa: [...document.querySelectorAll('[data-qa]')].filter((n) => n.offsetParent || getComputedStyle(n).position === 'fixed').map((n) => n.dataset.qa).slice(-60) })).catch(() => null);
      log('state', JSON.stringify(st));
      throw e;
    }
  }

  let pass = false, failure = null, series = null;
  try {
    /* ---------- boot ---------- */
    await page.goto(URL + (FROM >= 9 ? '&jump=M8' : ''));
    if (FROM && ARG.c1) { await sleep(1000); await ev(() => window.haru.flag('C1')); }   // DEV ONLY
    if (EP1 === 'done') {
      await ev((s) => { localStorage.setItem('haru-escape.save.v1', JSON.stringify(s)); }, ep1Save());
      await page.reload();
    }
    await sleep(1500);
    await shot('title');

    /* 1 ─ title → cold open → box chain → M1 */
    await step('1 title → warning → earphone test', async () => {
      await tap('title.start');
      await tap('warn.ok', { after: 1200 });
      await tap('ear.left', { after: 1200 });
      await tap('ear.right', { after: 900 });
      await tap('ear.start', { after: 1500 });
      if (await tapIf('recap.skip', 2500)) log('  recap skipped');
      else log('  (no recap)');
    });
    await step('1 cold open (22 s) → eye view', async () => {
      await waitFlag('M0', 15000);
      await milestone('M0');
      await loc('room.spot:door').waitFor({ state: 'visible', timeout: 40000 });
      await shot('eye_door');
    });
    await step('1 box chain', async () => {
      await tap('room.spot:door', { after: 1800 });
      await tap('room.spot:box', { after: 1500 });
      await tap('room.spot:lid', { after: 1200 });
      await tap('room.spot:note', { after: 1200 });
      await tap('note.flip', { after: 1000 });
      await shot('note_flipped');
      await tapIf('closeup.close', 3000);
      await sleep(600);
      await tap('room.spot:phone', { after: 1800 });
      await shot('alarm_ring');
      await drag('alarm.slide', 260, 0, { fx: 0.15 });
      await waitFlag('gotPhone', 8000);
      if (!(await has('seenNote'))) throw new Error('seenNote not set');
    });
    await step('1 lock → M1', async () => {
      await loc('lock.surface').waitFor({ state: 'visible', timeout: 15000 });
      await sleep(800);
      await shot('lock_n');
      await drag('lock.surface', 0, -360, { fy: 0.75 });
      await waitFlag('M1', 8000);
      await milestone('M1');
    });

    /* 2 ─ smart lock + fingerprint → M2 */
    await step('2 settings › 잠금 화면 › 스마트 잠금', async () => {
      await tap('home.app:settings', { after: 900 });
      await tap('settings.row:lock', { after: 900 });
      await hold('verify.finger', 1100);
      await sleep(600);
      await tap('settings.row:lock.smart', { after: 900 });
      await waitFlag('factSmart', 5000);
      await back(); await back();
    });
    await step('2 biometrics › 지문 2 → M2 → delete', async () => {
      await tap('settings.row:bio', { after: 900 });
      await tap('settings.row:bio.finger', { after: 900 });
      await hold('verify.finger', 1100);
      await waitFlag('bioOpened', 5000);
      await sleep(500);
      await tap('bio.finger:f2', { after: 900 });
      await waitFlag('factFinger', 5000);
      await waitFlag('M2', 8000);
      await milestone('M2');
      await tap('bio.delete', { after: 700 });
      await tap('dialog.btn:delete', { after: 900 });
      await hold('verify.finger', 1100);
      await waitFlag('fingerDeleted', 6000);
    });

    /* 3 ─ keyboard words + disaster alerts + timeline */
    await step('3 keyboard › 개인 단어 목록', async () => {
      await back(); await back();
      await tap('settings.row:general', { after: 800 });
      await tap('settings.row:kbd', { after: 800 });
      await tap('settings.row:kbd.predict', { after: 800 });
      await tap('settings.row:kbd.words', { after: 1200 });
      await waitFlag('kbdListOpened', 4000);
      await shot('kbd_words');
      await home();
    });
    await step('3 재난 알림 + 타임라인', async () => {
      await tap('home.app:alerts', { after: 1800 });
      await waitFlag('cbsOpened', 4000);
      await tap('alerts.row:12-15', { after: 1200 });
      await shot('alerts_1215');
      await home();
      await tap('home.app:timeline', { after: 1200 });
      await tap('tl.day:12-15', { after: 1500 });
      await waitFlag('factCbs', 6000);
      await shot('timeline_1215');
      const st = await ev(() => ({ fc: G.e2.factCount(), f: ['factKbd', 'seenKbd', 'seenCbs', 'factCbs'].filter((x) => G.flag(x)) }));
      log('  facts', JSON.stringify(st));
      await home();
    });

    /* 4 ─ '—' user → M3 → dash facts */
    await step('4 QS → switch to — → PIN 0310 → M3', async () => {
      await tap('statusbar', { after: 900, position: { x: 250, y: 20 } });
      await shot('qs');
      await tap('qs.user:dash', { after: 600 });
      await waitFlag('dashSeen', 3000);
      await sleep(2800);
      await loc('dashlock.surface').waitFor({ state: 'visible', timeout: 10000 });
      await drag('dashlock.surface', 0, -360, { fy: 0.75 });
      await waitFlag('pinPadOpened', 5000);
      for (const d of ['0', '3', '1', '0']) await tap('pin.key:' + d, { after: 200 });
      await tap('pin.ok', { after: 1500 });
      await waitFlag('M3', 6000);
      await milestone('M3');
    });
    await step('4 — memo', async () => {
      await tap('home.app:memo', { after: 900 });
      await tap('memo.item:dash1', { after: 1500 });
      await waitFlag('dashMemo', 5000);
      await shot('dash_memo');
      await cbText('memo min', '47분. 세아는 1년 걸렸는데.');
      await cbText('memo trap', '*0404# 누른 거 기억해.');
      await cbText('memo vault', '보관함, 네 사진까지 봤지.');
      await home();
    });
    await step('4 — gallery 0310 video (hinge)', async () => {
      await tap('home.app:gallery', { after: 900 });
      await tap('gallery.album:0310', { after: 900 });
      await waitFlag('dashA0310', 4000);
      await tap('gallery.item:a9', { after: 900 });
      await tap('video.play', { after: 500 });
      await waitFlag('seenHinge', 25000);
      await shot('video_hinge');
      await back(); await back();
    });
    await step('4 — gallery 옥상 video (whistle)', async () => {
      await tap('gallery.album:roof', { after: 900 });
      await waitFlag('dashARoof', 4000);
      await tap('gallery.item:rv', { after: 900 });
      await tap('video.play', { after: 500 });
      await waitFlag('seenWhistle', 25000);
      await back(); await back();
    });
    await step('4 — hidden items → key 404', async () => {
      await tap('gallery.menu', { after: 600 });
      await tap('gallery.hidden', { after: 1200 });
      await waitFlag('dashHidden', 4000);
      const h2 = await loc('gallery.item:h2').isVisible().catch(() => false);
      cbChecks.push({ label: 'hidden ring item', on: h2, ok: h2 === (EP1 === 'done') }); log('  cb hidden ring item', h2 === (EP1 === 'done') ? 'ok' : 'MISMATCH');
      await tap('gallery.item:h1', { after: 1500 });
      await waitFlag('seenKey404', 4000);
      await waitFlag('factDash', 4000);
      await shot('key404');
    });

    /* 5 ─ back to {N} → mono2 → M4 → B09 → tones → jimin */
    await step('5 back to {N} → mono2 → M4', async () => {
      await home();
      await tap('statusbar', { after: 900, position: { x: 250, y: 20 } });
      await tap('qs.user:n', { after: 600 });
      await sleep(2800);
      await loc('lock.surface').waitFor({ state: 'visible', timeout: 10000 });
      await drag('lock.surface', 0, -360, { fy: 0.75 });
      await waitFlag('mono2', 20000);
      await shot('mono2');
      await waitFlag('M4', 20000);
      await milestone('M4');
    });
    await step('5 camera → window → B09 tank glow', async () => {
      await tap('home.app:camera', { after: 1500 });
      await tap('room.next', { after: 1200 });
      await scale(4);
      await waitFlag('tankGlow', 60000, 'B09');
      await scale(1);
      await shot('b09');
      await sleep(2000);
      await tap('room.close', { after: 900 });
    });
    await step('5 settings › 소리 › 알림 소리 → reset + per-chat', async () => {
      await tap('home.app:settings', { after: 900 });
      await tap('settings.row:sound', { after: 900 });
      await tap('settings.row:sound.notif', { after: 900 });
      await waitFlag('soundSettingsOpened', 4000);
      await tap('tone.reset', { after: 900 });
      await waitFlag('toneRestored', 4000);
      await tap('tone.perChat', { after: 900 });
      await waitFlag('perChatSeen', 4000);
      await home();
    });
    await step('5 모먼트 › 지민 DM → voice message', async () => {
      await tap('home.app:moment', { after: 1200 });
      await tap('moment.tab:messages', { after: 900 });
      await tap('moment.thread:jimin_0412', { after: 1500 });
      await waitFlag('jiminOpened', 4000);
      // scroll to the end (the 22:51 row)
      await page.mouse.move(195, 420);
      for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 900); await sleep(150); }
      await sleep(900);
      await waitFlag('factJimin', 8000);
      await tap('vm.play', { after: 800 });
      await waitFlag('vmPlayed', 6000);
      await shot('jimin_vm');
    });

    /* 6 ─ restricted → unrestrict → C1 */
    await step('6 requests › restricted → unrestrict → C1', async () => {
      await back();
      await tap('moment.requests', { after: 900 });
      await tap('moment.restricted', { after: 1200 });
      await waitFlag('hiddenSeen', 4000);
      await tap('moment.unrestrict', { after: 1500 });
      await chip();
      await tap('chat.send', { after: 800 });
      await waitFlag('C1', 6000);
      await waitFlag('mono3', 30000);
      await shot('c1_mono3');
      await chip();
      await tap('chat.send', { after: 900 });
    });

    /* 7 ─ M5 → fake → where → Bluetooth */
    await step('7 wait M5', async () => {
      await scale(4);
      await waitFlag('M5', 120000);
      await scale(1);
      await milestone('M5');
    });
    await step('7 fake thread → [두기]', async () => {
      await sleep(8000);   // N06–N08 arrive 2.5 s apart
      await backTo('moment.thread:fake');
      await tap('moment.thread:fake', { after: 1200 });
      await waitFlag('fakeLineSeen', 4000);
      await shot('fake');
      await tapIf('chat.chip.dismiss', 4000);
      await backTo('moment.thread:real');
    });
    await step('7 real thread → where → 옥상 물탱크실', async () => {
      await tap('moment.thread:real', { after: 1200 });
      await scale(4);
      await waitFlag('whereAsked', 90000);
      await scale(1);
      await sleep(1500);
      await tap('chat.input', { after: 500 });
      await typeKo('옥상 물탱크실');
      await sleep(300);
      await tap('chat.send', { after: 1200 });
      await waitFlag('whereTank', 6000);
      await shot('where');
    });
    await step('7 QS bluetooth long-press → 2층_스피커', async () => {
      await tap('statusbar', { after: 900, position: { x: 250, y: 20 } });
      await hold('qs.tile:bt', 700);
      await sleep(600);
      await tap('bt.device:2층_스피커', { after: 500 });
      await waitFlag('btConnected', 8000);
      await shot('bt_connected');
      await home();   // the home gesture closes the device sheet and the quick panel
    });

    /* 8 ─ M6 drill → C1b → stay down → recorder on BT at 100 % → C2 → M7 */
    await step('8 wait M6', async () => {
      await scale(4);
      await waitFlag('M6', 240000);
      await scale(1);
      await milestone('M6');
    });
    await step('8 real → drill chip → C1b → stay down', async () => {
      await home();
      await tap('home.app:moment', { after: 1200 });
      await tapIf('moment.tab:messages', 1500);
      await tap('moment.thread:real', { after: 1500 });
      await chip('D');
      await tap('chat.send', { after: 900 });
      await waitFlag('C1b', 30000);
      await chip('S');
      await tap('chat.send', { after: 900 });
      await waitFlag('makerStayDown', 8000);
      await shot('stay_down');
    });
    await step('8 recorder → 우리 → BT 100 % → C2', async () => {
      await home();
      await tap('home.app:recorder', { after: 1000 });
      await tap('rec.item:uri', { after: 900 });
      await tap('rec.play', { after: 900 });
      await tap('rec.vol', { after: 900 });
      const b = await box('vol.slider:media');
      await page.mouse.click(b.x + b.width - 2, b.y + b.height / 2);
      await sleep(400);
      let v = await ev(() => G.media.getVolume('bt'));
      if (v < 100) { await loc('vol.slider:media').focus(); for (let i = 0; i < 20 && v < 100; i++) { await page.keyboard.press('ArrowRight'); v = await ev(() => G.media.getVolume('bt')); } }
      log('  bt volume', v, 'out', await ev(() => G.media.out()));
      await shot('vol_100');
      await waitFlag('C2', 15000);
      await shot('c2_b14');
    });
    await step('8 wait M7 (siren, forced window)', async () => {
      await waitFlag('M7', 60000);
      await milestone('M7');
      await sleep(20000);
      await shot('m7_window');
    });

    /* 9 ─ M8 door → cards → share → phone choice */
    await step('9 wait M8 → handle', async () => {
      await scale(3);
      await waitFlag('M8', 120000);
      await scale(1);
      await milestone('M8');
      await tap('room.spot:handle', { timeout: 30000, after: 3000 });
      await waitFlag('doorOpened', 8000);
    });
    await step('9 cards 01:10 → 01:50', async () => {
      await tap('card.continue', { timeout: 15000 });
      await tap('card.chip:lock', { timeout: 15000 });
      await waitFlag('dashChoiceDone', 15000);
      await tap('card.continue', { timeout: 20000 });
      await waitFlag('pol1Shown', 15000);
      await shot('k0140');
      await tap('card.continue', { timeout: 20000 });
      await tap('share.accept', { timeout: 15000, after: 1500 });
      await waitFlag('nearbyTaken', 6000);
      for (let i = 0; i < 3; i++) await tap('viewer.next', { after: 700 });
      await waitFlag('photo4Seen', 4000);
      await shot('photo4');
      await tap('viewer.close', { after: 900 });
      await tap('card.chip:police', { timeout: 15000 });
      await waitFlag('phoneChoiceDone', 15000);
      await tap('card.continue', { timeout: 20000 });
    });

    /* 10 ─ 02:00 jimin → END → tail → credits → HOOK */
    await step('10 02:00 jimin answer → END', async () => {
      await waitFlag('jiminReturn', 60000);
      await sleep(1200);
      if (!(await tapIf('banner:N16', 6000))) { await tap('home.app:moment', { after: 1200 }); await tapIf('moment.tab:messages', 1500); await tap('moment.thread:jimin_0412', { after: 1500 }); }
      await loc('chat.noAnswer').waitFor({ state: 'visible', timeout: 30000 });   // the question is complete (answer mode)
      await tap('chat.input', { timeout: 20000, after: 500 });
      await typeKo('한 마디만 나왔어요');
      await sleep(300);
      await tap('chat.send', { after: 900 });
      await waitFlag('END', 30000);
      await milestone('END');
    });
    await step('10 tail chips (jTail, j0205, m0212)', async () => {
      // jTail → j0205 → m0212 (the {MAKER} DM, only after C1); without C1 the 02:12 card comes instead of the third chip
      const c1 = await has('C1');
      for (let i = 0; i < 2; i++) {
        await chip(null, 40000);
        await tap('chat.send', { after: 1200 });
      }
      await sleep(4000);
      await cbText('jimin tail', '그날 신고한 거 저예요.');
      await cbText('mom line', '그날 이후로 03:33에 전화 안 해요.');
      if (c1) {   // 02:12 {MAKER} DM arrives in the real thread (N11 banners) → open it from the banner (or the list)
        const bn = page.locator('[data-qa^="banner:N11"]:visible').first();
        let viaBanner = false;
        try { await bn.waitFor({ state: 'visible', timeout: 20000 }); await bn.click({ timeout: 5000 }); viaBanner = true; } catch (e) {}
        if (!viaBanner) { await backTo('moment.thread:real', 5); await tap('moment.thread:real', { after: 1200 }); }
        log('  m0212 opened via', viaBanner ? 'banner' : 'list');
        if (FROM) await tapIf('moment.unrestrict', 1500);   // DEV ONLY (the jump does not unrestrict)
        await chip(null, 40000);
        await tap('chat.send', { after: 1200 });
      }
      await shot('tail_done');
      if (!c1) { await tap('card.continue', { timeout: 30000 }); }
    });
    await step('10 02:15 card → credits → check', async () => {
      // 02:12 card (W07, with C1 only after the DM) → 02:15 Kang wrap-up card
      for (let i = 0; i < 3 && !(await has('kangWrapDone')); i++) {
        await loc('card.continue').waitFor({ state: 'visible', timeout: 60000 });
        await sleep(600);
        await shot('card_' + ((await ev(() => (document.querySelector('.fl2-card') || {}).dataset || {})).step || i));
        await tap('card.continue', { timeout: 10000, after: 1500 });
      }
      await waitFlag('kangWrapDone', 5000);
      await tapIf('card.continue', 8000);   // 02:20 letter card only when LETTERS.ep2
      await tap('credits.skip', { timeout: 30000, after: 1500 });
      await tap('check.continue', { timeout: 20000, after: 1500 });
    });
    await step('10 HOOK 03:33', async () => {
      await waitFlag('HOOK', 30000);
      await milestone('HOOK');
      await tap('lock.notif:N17', { timeout: 15000, after: 1500 });
      await waitFlag('hookOpened', 5000);
      await tap('hook.play', { after: 500 });
      await waitFlag('hookFull', 30000);
      await waitFlag('mono4', 15000);
      await shot('hook_mono4');
      await sleep(1500);
      await tap('hook.play', { after: 500 });
      await sleep(13000);
      await tap('hook.home', { timeout: 20000, after: 2000 });
      await waitFlag('hookDone', 6000);
      await shot('title_after_hook');
    });

    /* series record */
    await step('series record', async () => {
      series = await ev(() => { try { return JSON.parse(localStorage.getItem('haru-escape.series.v1')); } catch (e) { return null; } });
      const e2 = series && series.eps && series.eps['2'];
      if (!e2 || e2.st !== 'done' || !e2.canon) throw new Error('eps.2 not done/canon: ' + JSON.stringify(e2));
      if (!series.seen || !series.seen.e2_piyo) throw new Error('seen.e2_piyo missing (hook patch)');
      if (EP1 === 'done') { const e1 = series.eps['1']; if (!e1 || e1.st !== 'done' || !e1.canon) throw new Error('eps.1 backfill missing: ' + JSON.stringify(e1)); }
      const dump = await ev(() => JSON.stringify(Object.assign({}, localStorage)));
      const names = NAMES ? [NAMES.PLAYER_NAME, NAMES.MAKER_NAME] : [];
      const hits = names.filter((n) => dump.indexOf(n) >= 0).map((n) => n + ' @ ' + dump.slice(Math.max(0, dump.indexOf(n) - 60), dump.indexOf(n) + 20));
      if (hits.length) throw new Error('player/maker name in localStorage dump: ' + JSON.stringify(hits));
      if (NAMES) log('  localStorage dump: no player/maker name (' + dump.length + ' chars)');
    });
    pass = true;
  } catch (e) {
    failure = e.message.split('\n')[0];
  }

  const cbs = await ev(() => G.state && G.state.cb).catch(() => null);
  const final = await ev(() => ({ flags: window.haru && haru.flags(), stage: G.state && G.state.stage })).catch(() => null);
  log('final stage', JSON.stringify(final && final.stage), 'cb', JSON.stringify(cbs));
  log('ERRORS (' + errors.length + ')');
  errors.forEach((e) => log('  ' + e));
  const summary = { dev: !!FROM, fabOverlaps, cbChecks, pass: !FROM && pass && cbChecks.every((c) => c.ok) && errors.length === 0, failure, ep1: EP1, milestones, errors: errors.length,
    series: series && { eps: series.eps, s: series.s, seen: series.seen, last: series.last }, cb: cbs, wallSec: Math.round((Date.now() - T_START) / 1000) };
  console.log(JSON.stringify(summary));
  await browser.close();
  process.exit(summary.pass ? 0 : 1);
})();
