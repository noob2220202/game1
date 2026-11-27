/* =========================================================
 * tools/qa/ep3_speedrun.js — DESIGN_EP3 §11.3 speedrun as selectors (ARCH_EP3 §7.5, core) end to end through data-qa.
 *
 *   NODE_PATH=<global node_modules> node tools/qa/ep3_speedrun.js [--ep1=none|done] [--ep2=none|done|done0] [--series=S1…S13]
 *                                                                [--names] [--name=<shot dir>] [--headed] [--verbose]
 *
 * Plays file:///…/ep3/index.html?debug=1 in Chromium ('iPhone 13' profile) from the title to END and the 06:10 hook with
 * real taps / holds / drags / keys. window.haru is used only for time acceleration while WAITING (haru.time(10) → back to 1
 * before acting), Korean text entry (haru.type) and haru.recRate during recording playback waits — never to set progress flags.
 * "→ home" = home.bar · "back" = nav.back (✕ / Esc when a screen has none) · wait(flag) = poll haru.flags() ·
 * "cards" = tap card.next until the card layer is gone (it only speeds the cards up; a chip sheet ends it).
 * Asserts M0 … M8, END, HOOK, the DESIGN §11.2 must-hold list + implications (ARCH §9 G28 form of the M5 bound), the 100 %
 * run extras, the series record (haru-escape.series.v1), navigator.vibrate patterns ([400,200,400] · [80] only) and 0
 * pageerrors / console errors / failed requests. Screenshots per milestone → work/shots/ep3speed/<name>/.
 *   --ep1=done      seeds a finished episode-1 save (ep1 flag names, momRead) before boot → cb.A / A1 (title recap still shown)
 *   --ep2=done      seeds a finished episode-2 save (haru-escape.ep2.save.v1 — ep2 flag names: answeredRight, hookFull … and
 *                   stage e2_phone 'kept') and boots ep2/index.html?debug=1 once, so episode 2's OWN boot retry commits it to
 *                   the series record (and its own hookPatch adds sig_fifth) → cb B 'yes' · C · D · ¬E (no recap)
 *   --ep2=done0     the same with the other choices (¬answeredRight · e2_phone 'police' · no hookFull) → B 'no' · ¬C · ¬D · ¬E
 *   Callback lines are checked on screen (card log): A first line · B 04:40 chip reply · C tail line · D M7 line / hum card.
 *   --series=S5     injects the §9.3 S5 profile (episode 2 done, e2_jimin, kept, sig_fifth) → cb B 'yes' · C · D · no recap
 *   --names         PLAYER_NAME '테스트이름가' / MAKER_NAME '만든사람나' → the end-of-run localStorage dump must contain neither
 * Exit code 0 = pass. JSON summary on the last line.
 * ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(__dirname, '..', '..');
const EP1 = ARG.ep1 || 'none';
const SERIES = ARG.series ? String(ARG.series) : '';
const URL = 'file:///' + path.join(ROOT, 'ep3', 'index.html').replace(/\\/g, '/') + '?debug=1' + (SERIES ? '&series=' + SERIES : '');
const EP2 = ARG.ep2 || 'none';
if (!['none', 'done', 'done0'].includes(EP2) || !['none', 'done'].includes(EP1)) { console.error('bad --ep1 / --ep2'); process.exit(2); }
const URL2 = 'file:///' + path.join(ROOT, 'ep2', 'index.html').replace(/\\/g, '/') + '?debug=1';
const NAME = ARG.name || (SERIES ? 'series_' + SERIES : 'ep1-' + EP1 + '_ep2-' + EP2);
const OUT = path.join(ROOT, 'work', 'shots', 'ep3speed', NAME);
try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) {}   // no stale shots from an earlier run
fs.mkdirSync(OUT, { recursive: true });

const T_START = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T_START) / 1000).toFixed(1) + 's]').padEnd(9), ...a);
const errors = [];
const checks = [];
const milestones = {};
let shotN = 0;
const check = (label, ok, info) => { checks.push({ label, ok: !!ok, info }); log('  ' + (ok ? '✓' : '✗ CHECK') + ' ' + label + (ok || info === undefined ? '' : ' ' + JSON.stringify(info).slice(0, 300))); };

/* synthetic finished episode-1 save (ep1 flag names — engine/series.js e1Fields) */
function ep1Save() {
  const T0 = new Date(2026, 10, 24, 5, 0).getTime();
  return { v: 1, flags: { introDone: T0 - 3600000, M1: T0 - 3000000, momRead: T0 - 200000, END: T0 }, vars: {}, playMs: 2820000, hintsUsed: 2,
    threads: {}, notifs: [], read: {}, fragments: {}, seen: {} };
}
/* synthetic finished episode-2 save (ep2 flag / stage names — ep2/js/e2.js commit() · hookPatch()) — END ∧ ¬committed, so
 * episode 2's own boot (retryCommit 'boot') writes eps.2 + its s / seen keys; hookFull → its hookPatch adds sig_fifth */
function ep2Save(kind) {
  const T0 = new Date(2026, 11, 26, 4, 0).getTime(), yes = kind === 'done';
  const fl = { introDone: T0 - 3000000, M1: T0 - 2900000, M2: T0 - 2500000, M3: T0 - 2000000, M4: T0 - 1500000, M5: T0 - 1000000,
    M6: T0 - 600000, M7: T0 - 300000, M8: T0 - 100000, END: T0, HOOK: T0 + 60000, hookOpened: T0 + 70000, hookDone: T0 + 200000,
    seenCbs: T0 - 2600000, seenNote: T0 - 1800000 };
  if (yes) { fl.answeredRight = T0 - 5000; fl.hookFull = T0 + 120000; }
  return { v: 1, ep: 2, flags: fl, vars: { committed: false, endStep: 'hook', hookPlays: yes ? 1 : 0 }, playMs: 2760000, hintsUsed: 1, hints: {},
    threads: {}, notifs: [], read: {}, fragments: {}, seen: {}, startedAt: T0 - 3100000,
    stage: { e2_finger: 'deleted', e2_dash: 'locked', e2_fakeReply: false, e2_jimin: yes, e2_phone: yes ? 'kept' : 'police' },
    cb: { _v: 1, e1done: EP1 === 'done' } };
}
const WANT_CB = Object.assign({ A: EP1 === 'done', A1: EP1 === 'done' },
  EP2 === 'done' ? { B: 'yes', C: true, D: true, E: false } : EP2 === 'done0' ? { B: 'no', C: false, D: false, E: false } : { B: 'none', C: false, D: false, E: true });

(async () => {
  const browser = await chromium.launch({ headless: !ARG.headed });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const NAMES = ARG.names ? { PLAYER_NAME: '테스트이름가', MAKER_NAME: '만든사람나' } : null;
  if (NAMES) await ctx.addInitScript((nm) => {
    let c; Object.defineProperty(window, 'CONFIG', { configurable: true, get() { return c; }, set(v) { c = v; if (v && typeof v === 'object') Object.assign(v, nm); } });
  }, NAMES);
  // navigator.vibrate spy (ARCH §10 audio: only [400,200,400] and [80]) — installed before any page script
  await ctx.addInitScript(() => {
    try { window.__vib = JSON.parse(sessionStorage.getItem('__qaVib') || '[]'); } catch (e) { window.__vib = []; }   // survives the hook reload
    const nav = navigator, orig = typeof nav.vibrate === 'function' ? nav.vibrate.bind(nav) : null;
    if (orig) nav.vibrate = function (p) { window.__vib.push(Array.isArray(p) ? p.slice() : p); try { sessionStorage.setItem('__qaVib', JSON.stringify(window.__vib)); } catch (e) {} return orig(p); };
    // card log (full text from each card's aria-label) — callback lines are asserted from it; kept in sessionStorage so the
    // hook's reload to the title does not lose it
    try { window.__cards = JSON.parse(sessionStorage.getItem('__qaCards') || '[]'); } catch (e) { window.__cards = []; }
    const seenT = new Set(window.__cards);
    setInterval(() => {
      try {
        let add = false;
        document.querySelectorAll('.c3-cbox[aria-label], .fl3-fcard [aria-label]').forEach((b) => { const t = b.getAttribute('aria-label'); if (t && !seenT.has(t)) { seenT.add(t); window.__cards.push(t); add = true; } });
        if (add) sessionStorage.setItem('__qaCards', JSON.stringify(window.__cards));
      } catch (e) {}
    }, 150);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 800)));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push('CONSOLE ' + t.slice(0, 400) + ' @' + ((m.location().url || '').replace(/.*game1/, '') + ':' + m.location().lineNumber));
    if (ARG.verbose && (m.type() === 'warning' || m.type() === 'log')) log('  page.' + m.type() + ':', t.slice(0, 200));
  });
  let setup = false;      // while episode 2's page commits the seeded save: its web-font fetches aborted by our navigation are not errors
  page.on('requestfailed', (r) => {
    const t = (r.failure() && r.failure().errorText) || '';
    if (setup && /ERR_ABORTED/.test(t)) return;
    errors.push('REQFAIL ' + r.url().replace(/.*game1/, '') + ' ' + t);
  });

  /* ---------- helpers ---------- */
  const sel = (v) => `[data-qa="${v}"]:visible`;
  const loc = (v) => page.locator(sel(v)).last();
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const flags = () => ev(() => (window.haru && window.haru.flags ? window.haru.flags() : Object.keys((window.G && G.state && G.state.flags) || {})));
  const has = async (f) => (await flags()).includes(f);
  const visible = (v) => loc(v).isVisible().catch(() => false);
  async function shot(label) {
    shotN++;
    const f = path.join(OUT, String(shotN).padStart(2, '0') + '_' + label.replace(/[^a-z0-9_.:-]+/gi, '_').replace(/:/g, '-') + '.png');
    try { await page.screenshot({ path: f }); } catch (e) { log('shot failed', e.message); }
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
    while (Date.now() - t0 < (timeout || 30000)) { if (await has(f)) return true; await sleep(250); }
    throw new Error('timeout waiting for flag ' + f + (label ? ' (' + label + ')' : ''));
  }
  const scale = (k) => ev((k) => window.haru && window.haru.time && window.haru.time(k), k);
  const recRate = (k) => ev((k) => (window.haru && window.haru.recRate ? window.haru.recRate(k) : null), k);
  const typeKo = (s) => ev((s) => window.haru.type(s), s);
  const clock = () => ev(() => (G.clock && G.clock.hm ? G.clock.hm() : '?'));
  /** wait for a flag with the in-game time accelerated (×k), then back to ×1 before acting */
  async function waitFast(f, timeout, k) { await scale(k || 10); try { await waitFlag(f, timeout); } finally { await scale(1); } }
  async function milestone(id) {
    const c = await clock();
    milestones[id] = { clock: c, wall: ((Date.now() - T_START) / 1000).toFixed(1), pm: await ev((id) => G.pm(id), id) };
    log('★ milestone', id, 'clock', c);
    await shot('ms_' + id);
  }
  /** "cards" — tap card.next until the card layer is gone (a chip sheet stops it; cards also advance by themselves) */
  async function cards(maxMs) {
    const t0 = Date.now();
    await sleep(300);
    while (Date.now() - t0 < (maxMs || 90000)) {
      if (!(await page.locator('[data-qa="card"]').count())) return true;
      if (await page.locator('[data-qa^="chip.opt:"]:visible').count()) return 'chips';
      const n = page.locator('[data-qa="card.next"]:visible').last();
      if (await n.count()) { try { await n.click({ timeout: 1500 }); } catch (e) {} }
      await sleep(450);
    }
    throw new Error('cards did not finish');
  }
  async function chipSay(id, timeout) {
    await tap('chip.opt:' + id, { timeout: timeout || 30000, after: 500 });
    if (await visible('chip.send')) await tap('chip.send', { after: 900 });
  }
  async function back() {
    if (await visible('viewer.close')) return tap('viewer.close', { after: 550 });
    if (await visible('room.closeup.close')) return tap('room.closeup.close', { after: 550 });
    if (await visible('nav.back')) return tap('nav.back', { after: 550 });
    await page.keyboard.press('Escape'); await sleep(550);
  }
  async function home() {
    if (await visible('room.close')) await tap('room.close', { after: 700 });
    for (let i = 0; i < 3 && await visible('home.bar'); i++) {
      await tap('home.bar', { after: 600 });
      if (await visible('home.app:settings') || await visible('easy.home')) break;
    }
  }
  async function app(id) {
    if (await page.locator('[data-qa="card"]').count()) await cards(120000);   // story cards sit over the dock — let them pass first
    await home();
    if (await visible('home.app:' + id)) return tap('home.app:' + id, { after: 900 });
    if (await visible('easy.tile:' + id)) return tap('easy.tile:' + id, { after: 900 });
    for (const dock of ['home.app:' + id, 'easy.tile:' + id]) if (await tapIf(dock, 2500)) return;
    throw new Error('app icon not found: ' + id);
  }
  /** bring a list row into view (rows may be appended lazily while scrolling) and keep it ≥ 60 % visible for > 200 ms */
  async function scrollTo(v) {
    for (let i = 0; i < 60; i++) {
      const l = page.locator(`[data-qa="${v}"]`).last();
      if (await l.count()) { await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await sleep(700); return; }
      await page.mouse.move(195, 480); await page.mouse.wheel(0, 700); await sleep(160);
    }
    throw new Error('row not found: ' + v);
  }
  async function eyeKey(key, view) {
    const eye = page.locator('[data-qa="room.eye"]').last();
    await eye.waitFor({ state: 'visible', timeout: 20000 });
    await eye.focus().catch(() => {});
    await page.keyboard.press(key);
    await page.locator(`[data-qa="room.eye"][data-view="${view}"]`).last().waitFor({ state: 'attached', timeout: 6000 });
    await sleep(700);
  }
  /** camera: move {N} between rooms through the door hotspots (sr B 'srout' → lv · lv r3_door 'srdoor' → sr) */
  async function toRoom(want) {
    const where = await ev(() => G.e3.where());
    if (where === want) return;
    if (want === 'lv') { if (!(await visible('room.spot:srout'))) await tap('room.view:r3_sr_bed', { after: 900 }); await tap('room.spot:srout', { after: 2600 }); }
    else { if (!(await visible('room.spot:srdoor'))) await tap('room.view:r3_door', { after: 900 }); await tap('room.spot:srdoor', { after: 2600 }); }
    check('where = ' + want + ' after the door', (await ev(() => G.e3.where())) === want);
  }
  /* DEV ONLY: --from=8|9|10 starts there through haru.jump (M5 · M7 · M8 armed) — never a valid pass (summary.dev = true) */
  const FROM = ARG.from ? Number(ARG.from) : 0;
  const FROM_JUMP = { 8: ['M5', {}], 9: ['M7', {}], 10: ['M8', {}] };
  async function step(name, fn) {
    const sn = parseInt(name, 10);
    if (FROM && sn < FROM && !/^§|^series/.test(name)) { log('skip', name); return; }
    if (FROM && /^§|^series/.test(name)) { log('skip (dev)', name); return; }
    log('→', name);
    try { await fn(); }
    catch (e) {
      log('✗ FAILED', name, '—', e.message.split('\n')[0]);
      await shot('FAIL_' + name.slice(0, 40));
      const st = await ev(() => ({ flags: window.haru && haru.flags(), clock: G.clock && G.clock.hm(),
        qa: [...document.querySelectorAll('[data-qa]')].filter((n) => n.offsetParent || getComputedStyle(n).position === 'fixed').map((n) => n.dataset.qa).slice(-60) })).catch(() => null);
      log('state', JSON.stringify(st));
      throw e;
    }
  }

  let pass = false, failure = null, series = null, endSnap = null;
  try {
    /* ---------- boot ---------- */
    await page.goto(URL);
    if (EP1 === 'done' || EP2 !== 'none') {
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      if (EP1 === 'done') await ev((s) => { localStorage.setItem('haru-escape.save.v1', JSON.stringify(s)); }, ep1Save());
      if (EP2 !== 'none') {
        await ev((s) => { localStorage.setItem('haru-escape.ep2.save.v1', JSON.stringify(s)); }, ep2Save(EP2));
        setup = true;
        await page.goto(URL2);                               // episode 2's own boot commits the finished save (file:// = one origin)
        const t0 = Date.now();
        let r2 = null;
        while (Date.now() - t0 < 20000) {
          r2 = await ev(() => { try { return window.G && G.e2 && G.series && G.series.ep(2); } catch (e) { return null; } }).catch(() => null);
          if (r2 && r2.st === 'done') break;
          await sleep(300);
        }
        if (EP2 === 'done') await ev(() => G.e2.hookPatch());   // its hook end (hookFull → sig_fifth) — idempotent, monotone keys
        const rec2 = await ev(() => G.series.get());
        check('ep2 save committed by episode 2 itself (eps.2 done/canon)', rec2.eps['2'] && rec2.eps['2'].st === 'done' && rec2.eps['2'].canon === true, rec2.eps['2']);
        check('ep2 keys in the series record', rec2.s.e2_jimin === (EP2 === 'done') && rec2.s.e2_phone === (EP2 === 'done' ? 'kept' : 'police') && (rec2.sea || []).includes('sig_fifth') === (EP2 === 'done'),
          { s: rec2.s, sea: rec2.sea });
        await page.goto(URL);
        await sleep(500);
        setup = false;
      } else await page.reload();
    }
    await sleep(1500);
    await shot('title');
    if (FROM && FROM_JUMP[FROM]) {                       // DEV ONLY
      await ev(([a, o]) => haru.jump(a, o), FROM_JUMP[FROM]);   // from the title: G.main.resumeFrom draws the jumped state
      await sleep(2500);
      if (await tapIf('title.continue', 3000)) await sleep(2500);
      log('DEV: jumped to', FROM_JUMP[FROM][0]);
    }

    /* 1 ─ title → cold open → 03:33 → handover → lock → gotPhone */
    await step('1 title → warning → earphone test', async () => {
      await tap('title.start');
      await tap('warn.ok', { after: 1200 });
      await tap('ear.ok', { after: 1200 });
      await tap('ear.start', { after: 1500 });
      const recap = await tapIf('recap.skip', 3000);
      log(recap ? '  recap skipped' : '  (no recap)');
      check('recap card iff cb.E', recap === (await ev(() => !!G.e3.cb('E'))), { recap });
      if (!SERIES) {
        const cb = await ev(() => G.e3.cb());
        check('cb at introDone = expected for --ep1=' + EP1 + ' --ep2=' + EP2, Object.keys(WANT_CB).every((k) => cb[k] === WANT_CB[k]), { cb, want: WANT_CB });
        check('recap iff ¬ep2 done', recap === (EP2 === 'none'));
      }
    });
    await step('1 M0 eye view: 270° 엄마 · stove · calendar · 0° hook · kongi', async () => {
      await waitFlag('M0', 15000);
      await milestone('M0');
      await page.locator('[data-qa="room.eye"]').last().waitFor({ state: 'visible', timeout: 30000 });
      await eyeKey('ArrowLeft', 'r3_kitchen');
      await tap('room.spot:mom', { after: 800 });          // the first line (momLine1) — her chain then waits for the calendar
      await waitFlag('momLine1', 45000);
      await cards();
      await tap('room.spot:stove', { after: 1500 });
      await waitFlag('soupSeen0', 5000);
      await tap('room.spot:calendar', { after: 1500 });
      await waitFlag('calSeen0', 5000);
      await cards();
      await sleep(1500);
      // §11.3 '270° 엄마 탭 ×3 (첫말 · 목줄 · 나는 괜찮아요.)' — the first tap above brought her first line; two more here
      for (let i = 0; i < 2; i++) { await tap('room.spot:mom', { after: 900 }); await cards(); await sleep(600); }
      await eyeKey('ArrowRight', 'r3_door');
      await tap('room.spot:hook', { after: 1500 });
      await waitFlag('collarSeen', 5000);
      await tap('room.spot:kongi', { after: 1500 });
      await waitFlag('kongiTail0', 5000);
      await shot('m0_door');
    });
    await step('1 03:33 (hands off) → 03:35 handover → lock → gotPhone', async () => {
      if (!(await has('callRing'))) { await scale(4); try { for (let i = 0; i < 240 && !(await has('callRing')); i++) await sleep(250); } finally { await scale(1); } }
      await waitFlag('M1', 30000);
      await milestone('M1');
      await waitFlag('callEnded', 90000);
      await shot('call_ended');
      await cards(120000);
      await waitFlag('handover', 60000);
      await loc('lock.surface').waitFor({ state: 'visible', timeout: 20000 });
      await sleep(800);
      await shot('lock_easy');
      await drag('lock.surface', 0, -360, { fy: 0.75 });
      await waitFlag('gotPhone', 8000);
      await milestone('gotPhone');
    });

    /* 2 ─ calendar cake · easy gate · easy mode off → M2 · folder */
    await step('2 easy.date → 2025-11-26 내 생일 (calCake)', async () => {
      await tap('easy.date', { after: 1000 });
      for (let i = 0; i < 14; i++) await tap('cal.prev', { after: 250 });
      await tap('cal.day:2025-11-26', { after: 700 });
      await tap('cal.event:1126', { after: 900 });
      await waitFlag('calCake', 5000);
      await shot('cal_cake');
      await home();
    });
    await step('2 settings search 녹음 → easy gate → display › 쉬운 모드 off → M2 → folder', async () => {
      await tap('easy.tile:settings', { after: 900 });
      await tap('settings.search', { after: 700 });
      await typeKo('녹음');
      await sleep(600);
      await shot('search_easy');
      await tap('settings.result:0', { after: 900 });
      await waitFlag('easyGate', 5000);
      await back(); await back();
      await tap('settings.row:display', { after: 800 });
      await tap('settings.row:display.easy', { after: 800 });
      await tap('easy.toggle', { after: 1500 });
      await waitFlag('easyOff', 5000);
      await waitFlag('M2', 5000);
      await milestone('M2');
      await home();
      await tap('home.folder', { after: 900 });
      await waitFlag('folderSeen', 4000);
      await shot('folder');
      await tap('home.folder.close', { after: 700 });
    });

    await step('2 talk › 세아 💛 — callback A / A1 rows (read only)', async () => {
      await app('talk');
      await tapIf('talk.tab:chats', 2500);
      await tap('talk.thread:sea', { after: 1800 });     // the chat list row (the open room itself is talk.room:sea)
      const t = await ev(() => (document.getElementById('screen') || document.body).textContent);
      const cbNow = await ev(() => G.e3.cb());
      check('talk 세아 💛: A1 rows (읽었어???) iff cb.A1', t.includes('읽었어???') === !!cbNow.A1, { A1: cbNow.A1 });
      check('talk 세아 💛: A″ end line iff cb.A', t.includes('오늘은 전화 안 할게요.') === !!cbNow.A, { A: cbNow.A });
      await shot('talk_sea');
      await back();
      await home();
    });

    /* 3 ─ blocked calls (blockBottom) · recents 03:31 (missedSeen) · 03:41 SMS chip */
    await step('3 phone ⋮ › 번호 차단 › 차단된 통화 → bottom row', async () => {
      await app('phone');
      await tap('phone.menu', { after: 600 });
      await tap('phone.menu.block', { after: 900 });
      await tap('block.calls', { after: 900 });
      await waitFlag('blockOpened', 4000);
      await scrollTo('block.row:12');
      await waitFlag('blockBottom', 5000);
      await shot('blocked_13');
      await back(); await back();
    });
    await step('3 recents → 2025-11-24 03:31 (missedSeen)', async () => {
      if (!(await visible('phone.tab:recent'))) await app('phone');
      await tap('phone.tab:recent', { after: 900 });
      await scrollTo('phone.recent.row:sea-20251124-0331');
      await waitFlag('missedSeen', 6000);
      await shot('recent_0331');
    });
    await step('3 03:41 SMS → chip → send (kang341Sent)', async () => {
      if (!(await has('kang341'))) await waitFast('kang341', 120000, 4);
      if (!(await tapIf('banner:N01', 4000))) { await app('sms'); await tap('sms.thread:kang', { after: 1000 }); }
      await tap('chat.chip', { timeout: 20000, after: 600 });
      await tap('chat.send', { after: 1200 });
      await waitFlag('kang341Sent', 5000);
    });

    /* 4 ─ recording → text conversion → 0:21 line (sigName) → 0:30 line (radioHeard) → mono1 → 강수진 chips → M3 */
    await step('4 통화 녹음 › 세아 💛 › ⋯ › 텍스트 변환 → 0:21 · 0:30', async () => {
      await app('phone');
      await tap('phone.menu', { after: 600 });
      await tap('phone.menu.rec', { after: 900 });
      await tap('rec.item:sea0333', { after: 1000 });
      await waitFlag('recPlayerOpened', 5000);
      await tap('rec.more', { after: 600 });
      await tap('rec.more.text', { after: 2600 });
      await waitFlag('textOpened', 6000);
      await waitFlag('greySeen', 6000);
      await shot('text_sea0333');
      await recRate(4);
      await tap('rec.line:21', { after: 500 });
      await waitFlag('sigName', 30000);
      await waitFlag('nameKnown', 5000);
      await tap('rec.line:30', { after: 500 });
      await waitFlag('radioHeard', 30000);
      await recRate(1);
      await sleep(2500);
      await back();
      await waitFlag('mono1', 20000);
      await shot('mono1');
    });
    await step('4 강수진: kblock → kname chips → M3', async () => {
      await app('sms');
      await tap('sms.thread:kang', { after: 1000 });
      await tap('chat.chip', { timeout: 20000, after: 600 });
      await tap('chat.send', { after: 1200 });
      await waitFlag('kangBlockSent', 5000);
      await tap('chat.chip', { timeout: 20000, after: 600 });
      await tap('chat.send', { after: 1200 });
      await waitFlag('kangNameSent', 5000);
      await home();
      await waitFast('M3', 180000);
      await milestone('M3');
    });

    /* 5 ─ DND + log · shared album members · 1130 zoom (saw702) · ⓘ 봄 (albumDone) · mono2 · k702 chip → M4 */
    await step('5 settings › 알림 › 방해 금지 › 사용 기록', async () => {
      await app('settings');
      await tap('settings.row:notif', { after: 800 });
      await tap('settings.row:dnd', { after: 900 });
      await waitFlag('dndOpened', 4000);
      await tap('settings.row:dnd.log', { after: 900 });
      await waitFlag('dndLogOpened', 4000);
      await home();
    });
    await step('5 gallery › 공유 앨범 › 멤버 · 1130 zoom · ⓘ → mono2', async () => {
      await app('gallery');
      await tap('gallery.tab:albums', { after: 800 });
      await tap('gallery.album:shared', { after: 1000 });
      await waitFlag('albumOpened', 4000);
      await tap('gallery.more', { after: 600 });
      await tap('gallery.members', { after: 1000 });
      await waitFlag('membersSeen', 5000);
      await shot('members');
      await back();
      await tap('gallery.photo:1130', { after: 1000 });
      await loc('viewer.img').dblclick();
      await sleep(2200);
      await waitFlag('saw702', 6000);
      await tap('viewer.info', { after: 1000 });
      await waitFlag('bomSeen', 5000);
      await waitFlag('albumDone', 5000);
      await shot('info_bom');
      await tap('viewer.close', { after: 800 });
      await waitFlag('mono2', 20000);
    });
    await step('5 강수진 k702 → M4', async () => {
      await app('sms');
      await tap('sms.thread:kang', { after: 1000 });
      await tap('chat.chip', { timeout: 20000, after: 600 });
      await tap('chat.send', { after: 1200 });
      await waitFlag('kang702Sent', 5000);
      await home();
      await waitFast('M4', 180000);
      await milestone('M4');
    });

    /* 6 ─ camera → 세아 방 (where 'sr') → doorframe · orgel · manual · drawing + flip */
    await step('6 camera → sr → closeups', async () => {
      await app('camera');
      await toRoom('sr');
      await tap('room.view:r3_sr_bed', { after: 800 });
      await tap('room.spot:frame', { after: 1200 });
      await waitFlag('heightSeen', 5000);
      await shot('doorframe');
      await tap('room.closeup.close', { after: 700 });
      await tap('room.view:r3_sr_desk', { after: 800 });
      await tap('room.spot:orgel', { after: 1200 });
      await tap('room.closeup.close', { after: 700 });
      await tap('room.spot:manual', { after: 1200 });
      await tap('room.closeup.close', { after: 700 });
      await tap('room.spot:drawing', { after: 1200 });
      await tap('room.flip', { after: 1200 });
      await waitFlag('drawingBack', 5000);
      await shot('drawing_back');
      await tap('room.closeup.close', { after: 700 });
      await tap('room.close', { after: 900 });
    });

    /* 7 ─ show to mom: blocked · 03:31 · DND (+ chip) · members · 1130 → M5 */
    await step('7 show: 차단된 통화 (glasses · momBlock)', async () => {
      await app('phone');
      await tap('phone.menu', { after: 600 });
      await tap('phone.menu.block', { after: 900 });
      await tap('block.calls', { after: 900 });
      await tap('show.btn', { after: 900 });
      await cards();
      await waitFlag('momBlock', 5000);
      check('glasses on the first show after easyOff', await has('glasses'));
      await back(); await back();
    });
    await step('7 show: recents 03:31 (mom331)', async () => {
      if (!(await visible('phone.tab:recent'))) await app('phone');
      await tap('phone.tab:recent', { after: 900 });
      await scrollTo('phone.recent.row:sea-20251124-0331');
      await tap('show.btn', { after: 900 });
      await cards();
      await waitFlag('mom331', 5000);
    });
    await step('7 show: 방해 금지 → chip say (momDnd · dndChipSaid)', async () => {
      await app('settings');
      await tap('settings.row:notif', { after: 800 });
      await tap('settings.row:dnd', { after: 900 });
      await tap('show.btn', { after: 900 });
      const r = await cards();
      if (r !== 'chips') await loc('chip.opt:say').waitFor({ state: 'visible', timeout: 30000 });
      await chipSay('say');
      await cards();
      await waitFlag('momDnd', 5000);
      await waitFlag('dndChipSaid', 5000);
      check('stage.e3_dnd = true', await ev(() => G.state.stage.e3_dnd === true));
    });
    await step('7 show: members · 1130 (momMembers · momBom) → M5', async () => {
      await app('gallery');
      await tap('gallery.tab:albums', { after: 800 });
      await tap('gallery.album:shared', { after: 1000 });
      await tap('gallery.more', { after: 600 });
      await tap('gallery.members', { after: 1000 });
      await tap('show.btn', { after: 900 });
      await cards();
      await waitFlag('momMembers', 5000);
      await back();
      await tap('gallery.photo:1130', { after: 1000 });
      await tap('show.btn', { after: 900 });
      await cards();
      await waitFlag('momBom', 5000);
      await home();
      await waitFast('M5', 180000);
      await milestone('M5');
    });

    /* 8 ─ M6 04:40 → 0° view (view0AfterM6) → 지민 chip → 05:02 → kask chip → M7 */
    await step('8 wait M6 (no input, notebook closed)', async () => {
      await home();
      await waitFast('M6', 200000, 6);
      await waitFlag('bip', 10000);
      await milestone('M6');
    });
    await step('8 camera → lv → r3_door → 지민 chip', async () => {
      await app('camera');
      await toRoom('lv');
      await tap('room.view:r3_door', { after: 1000 });
      await waitFlag('view0AfterM6', 8000);
      await shot('door_0440');
      await chipSay('say', 45000);
      await waitFlag('jiminChipSent', 5000);
      await tap('room.close', { after: 800 }).catch(() => {});
    });
    await step('8 05:02 → 강수진 kask → M7', async () => {
      await waitFast('kang502', 240000, 4);
      await app('sms');
      await tap('sms.thread:kang', { after: 1000 });
      // the queue head is kask in a full run (every earlier chip was sent); a DEV --from run sends the older ones first
      for (let i = 0; i < 5 && !(await has('kangAskSent')); i++) { await tap('chat.chip', { timeout: 20000, after: 600 }); await tap('chat.send', { after: 1500 }); }
      await waitFlag('kangAskSent', 5000);
      await home();
      await waitFast('M7', 120000, 4);
      await milestone('M7');
    });

    /* 9 ─ M7 cards → camera (sr B) → drawing (memoryStart) → memory → M8 */
    await step('9 memory → M8', async () => {
      await cards();
      await app('camera');
      await tap('room.view:r3_sr_desk', { after: 900 });
      await tap('room.spot:drawing', { after: 1200 });
      await waitFlag('memoryStart', 8000);
      await cards(180000);
      await waitFlag('memoryDone', 60000);
      await tapIf('room.closeup.close', 1500);
      await tapIf('room.close', 1500);
      await waitFast('M8', 90000, 4);
      await milestone('M8');
    });

    /* 10 ─ climax → END → tail → credits → check → HOOK → 처음 화면으로 */
    await step('10 M8 cards → [네.] → playArmed → 0:08 line → played → success chip → END', async () => {
      await cards();
      await chipSay('yes', 30000);
      await waitFlag('playArmed', 30000);
      check('where = lv at playArmed (table route)', (await ev(() => G.e3.where())) === 'lv');
      await app('phone');
      await tap('phone.menu', { after: 600 });
      await tap('phone.menu.rec', { after: 900 });
      await tap('rec.item.more:sea0333', { after: 700 });
      await tap('rec.more.text', { after: 2600 });
      await tap('rec.line:8', { after: 500 });
      await recRate(4);
      await waitFlag('played', 60000);
      await recRate(1);
      await shot('played');
      await chipSay('know', 30000);
      await waitFlag('END', 60000);
      await milestone('END');
      endSnap = await ev(() => ({ flags: haru.flags(), stage: G.state.stage, cb: G.state.cb, vars: { committed: G.state.vars.committed, TB: G.state.vars.TB }, pm: G.state.vars.pm,
        series: (() => { try { return G.series.get(); } catch (e) { return null; } })() }));   // engine read (also the DEBUG fixture store)
    });
    await step('10 tail → [잘 먹겠습니다.] → [큰 글씨로 다시 해 두기] → 06:00 → credits → check → HOOK', async () => {
      await chipSay('eat', 120000);
      await loc('chip.opt:big').waitFor({ state: 'visible', timeout: 180000 });
      await tap('chip.opt:big', { after: 900 });
      await cards(120000);
      await tap('end.next', { timeout: 60000, after: 1500 });
      await tap('credits.skip', { timeout: 30000, after: 1500 });
      await tap('check.continue', { timeout: 30000, after: 1500 });
      await waitFlag('HOOK', 30000);
      await milestone('HOOK');
      await waitFlag('boilerSting', 15000);
      await sleep(1200);
      // the 06:10 cut: comms' blocked-message screen inside room's ring close-up, styled (not the flow stand-in), new line on top
      const hk = await ev(() => {
        const n = document.querySelector('.rm3-ringscr, [data-qa="room.eye"] .rm3-ringscr') || null;
        const fb = !!document.querySelector('.fl3-hb');
        const rows = n ? n.querySelectorAll('.cr3-hookscr .cr3-blist > *').length : 0;
        const pos = n ? getComputedStyle(n).position : '';
        const B = (G.STORY && G.STORY.blocked && G.STORY.blocked.hook) || {};
        const txt = n ? n.innerText : '';
        return { has: !!n, fb, rows, pos, newLine: !!(B.text && txt.indexOf(G.T ? G.T(B.text) : B.text) >= 0) };
      });
      check('hook: blocked messages rendered by comms inside the ring close-up (positioned host · new line shown)', hk.has && !hk.fb && hk.rows > 0 && hk.pos !== 'static' && hk.newLine, hk);
      await shot('hook_line');
      await tap('hook.home', { timeout: 20000, after: 2000 });
      await waitFlag('hookDone', 6000);
      check('vars.patched after the hook', await ev(() => G.state.vars.patched === true));
      await shot('title_after_hook');
    });

    /* ---------- assertions ---------- */
    await step('§11.2 must-hold at END + implications', async () => {
      const f = new Set(endSnap.flags), pm = endSnap.pm || {};
      const MUST = ['introDone', 'M0', 'momLine1', 'M1', 'callRing', 'callAnswered', 'callEnded', 'handover', 'gotPhone', 'easyOff', 'M2', 'kang341', 'recListOpened',
        'recPlayerOpened', 'textOpened', 'greySeen', 'nameKnown', 'blockOpened', 'blockBottom', 'M3', 'M4', 'M5', 'M6', 'bip', 'doorDone', 'jiminUp', 'jimin112', 'patrol',
        'kang502', 'kongiBack', 'M7', 'memoryStart', 'memoryDone', 'M8', 'playArmed', 'END'];
      check('must-hold flags at END', MUST.every((x) => f.has(x)), MUST.filter((x) => !f.has(x)));
      check('played ⊕ playFallback', f.has('played') !== f.has('playFallback'));
      check('stage.e3_played === !!played', endSnap.stage.e3_played === f.has('played'), endSnap.stage);
      check('typeof stage.e3_dnd boolean', typeof endSnap.stage.e3_dnd === 'boolean');
      check('cb._v === 1', endSnap.cb && endSnap.cb._v === 1, endSnap.cb);
      check('vars.committed', endSnap.vars.committed === true);
      const e3 = endSnap.series && endSnap.series.eps && endSnap.series.eps['3'];
      check('series eps.3 done at END', e3 && e3.st === 'done' && e3.canon === true, e3);
      check('seen.e3_block + e3_grey at END', endSnap.series && endSnap.series.seen.e3_block === true && endSnap.series.seen.e3_grey === true);
      const imp = (a, b) => !f.has(a) || b.every((x) => f.has(x));
      check('sigName ⇒ greySeen ∧ textOpened', imp('sigName', ['greySeen', 'textOpened']));
      check('mom331 ⇒ missedSeen', imp('mom331', ['missedSeen']));
      check('momBlock ⇒ blockOpened', imp('momBlock', ['blockOpened']));
      check('momDnd ⇒ dndOpened', imp('momDnd', ['dndOpened']));
      check('momMembers ∨ momBom ⇒ albumOpened', imp('momMembers', ['albumOpened']) && imp('momBom', ['albumOpened']));
      check('albumDone ⇔ membersSeen ∧ bomSeen', f.has('albumDone') === (f.has('membersSeen') && f.has('bomSeen')));
      check('k-chips ⇒ their facts', imp('kangNameSent', ['nameKnown']) && imp('kangBlockSent', ['blockBottom']) && imp('kang702Sent', ['saw702']) && imp('kangAskSent', ['kang502']));
      check('jiminChipSent ⇒ jiminUp', imp('jiminChipSent', ['jiminUp']));
      check('M5 ⇒ nameKnown ∧ blockBottom', imp('M5', ['nameKnown', 'blockBottom']));
      check('M3 ≥ M2 + 120 s', pm.M3 - pm.M2 >= 120000, pm.M3 - pm.M2);
      check('M4 ≥ M3 + 120 s', pm.M4 - pm.M3 >= 120000, pm.M4 - pm.M3);
      check('M5 ≥ M4 + 120 s', pm.M5 - pm.M4 >= 120000, pm.M5 - pm.M4);
      const TICK = 2600;                                    // one evaluation tick at ×10 (250 ms) + slack
      const hub3 = Math.max(pm.nameKnown || 0, pm.blockBottom || 0, pm.albumDone || 0);
      const bound = f.has('albumDone') && (pm.albumDone || Infinity) <= pm.M5 ? Math.max(hub3, pm.M4 + 120000) : Math.max((endSnap.vars.TB || 0) + 180000, pm.M4 + 120000);
      check('M5 bound (ARCH §9 G28)', pm.M5 <= bound + TICK, { M5: pm.M5, bound });
      check('M6 − M5 ∈ [60, 100] s', pm.M6 - pm.M5 >= 60000 && pm.M6 - pm.M5 <= 100000 + TICK, pm.M6 - pm.M5);
      const EXTRA = ['kongiTail0', 'collarSeen', 'soupSeen0', 'calSeen0', 'easyGate', 'folderSeen', 'kang341Sent', 'recPlayed', 'heard21', 'sigName', 'radioHeard', 'kangNameSent',
        'momBlock', 'kangBlockSent', 'missedSeen', 'mom331', 'glasses', 'dndOpened', 'dndLogOpened', 'momDnd', 'dndChipSaid', 'albumOpened', 'membersSeen', 'bomSeen', 'albumDone',
        'saw702', 'momMembers', 'momBom', 'kang702Sent', 'calCake', 'view0AfterM6', 'jiminChipSent', 'kangAskSent', 'heightSeen', 'orgelSpotSeen', 'manualSeen', 'drawingSeen',
        'drawingBack', 'played', 'mono1', 'mono2'];
      check('100 % run extras', EXTRA.every((x) => f.has(x)), EXTRA.filter((x) => !f.has(x)));
      const momTaps = await ev(() => G.state.vars.momTaps | 0);
      check('vars.momTaps ≥ 3', momTaps >= 3, momTaps);
      // callback lines on screen (§9.4 — the card log keeps every card's full text)
      const log2 = await ev(() => window.__cards || []);
      const seen = (s) => log2.some((x) => x.indexOf(s) >= 0);
      const cbE = endSnap.cb || {};
      check('cb.A: M0 first line ' + (cbE.A ? 'A' : 'neutral'), cbE.A ? seen('그날 이후로 이 시간엔 전화 안 해요') && !seen('나는 이 시간에 늘 깨요') : seen('나는 이 시간에 늘 깨요') && !seen('그날 이후로 이 시간엔'));
      const bWant = { yes: '오르골 얘기 답해 줬을 때부터요', no: '그날 끝내 대답은 안 했잖아요', none: '같이 오니까 덜 무서워요' };
      check('cb.B = ' + cbE.B + ': the 04:40 chip reply', seen(bWant[cbE.B]) && Object.keys(bWant).filter((k) => k !== cbE.B).every((k) => !seen(bWant[k])));
      check('cb.D: M7 line ' + (cbE.D ? '다섯째 음' : 'hum card'), cbE.D ? seen('그 노래 끝까지 들었어요?') && !seen('엄마가 오르골 노래를 흥얼거린다.') : seen('엄마가 오르골 노래를 흥얼거린다.') && !seen('그 노래 끝까지 들었어요?'));
      endSnap.cardLog = log2;
    });
    await step('series record + after-hook keys', async () => {
      series = await ev(() => { try { return G.series.get(); } catch (e) { return null; } });
      if (!SERIES) check('record stored in localStorage', await ev(() => !!localStorage.getItem('haru-escape.series.v1')));
      const e3 = series && series.eps && series.eps['3'];
      check('eps.3 done/canon', e3 && e3.st === 'done' && e3.canon === true, e3);
      check('s.e3_played === true', series.s.e3_played === true);
      check('s.e3_dnd === true', series.s.e3_dnd === true);
      check('six seen.e3_*', ['e3_block', 'e3_dndLog', 'e3_grey', 'e3_height', 'e3_radio', 'e3_cake'].every((k) => series.seen[k] === true), series.seen);
      check("sea ∋ 'sig_name'", Array.isArray(series.sea) && series.sea.includes('sig_name'), series.sea);
      check('s.e3_easyBack === true (hook patch)', series.s.e3_easyBack === true, series.s);
      if (EP1 === 'done') { const e1 = series.eps['1']; check('eps.1 backfilled', e1 && e1.st === 'done' && e1.canon, e1); }
      const cb = await ev(() => G.state.cb);
      if (EP1 === 'done') check('cb.A = A1 = true (ep1 momRead)', cb.A === true && cb.A1 === true, cb);
      if (SERIES === 'S5') check('cb S5 (B yes · C · D · ¬E)', cb.B === 'yes' && cb.C === true && cb.D === true && cb.E === false, cb);
      const log3 = await ev(() => window.__cards || []);
      const cbF = await ev(() => G.state.cb);
      check('cb.C: tail line iff C', log3.some((x) => x.indexOf('그 폰 아직 갖고 있어요?') >= 0) === !!cbF.C, { C: cbF.C });
      if (EP2 !== 'none') { const e2 = series.eps['2']; check('eps.2 kept done/canon after the ep3 writes', e2 && e2.st === 'done' && e2.canon === true, e2); }
      if (!SERIES) check('series last = 3', series.last === 3, series.last);
      try { fs.writeFileSync(path.join(OUT, 'cards.txt'), log3.join('\n'), 'utf8'); } catch (e) {}
      const vib = await ev(() => window.__vib || []);
      check('navigator.vibrate only [400,200,400] · [80]', vib.every((p) => (Array.isArray(p) ? ['400,200,400', '80'].includes(p.join(',')) : p === 80)), vib);
      check('03:33 ring vibrated exactly once [400,200,400]', vib.filter((p) => Array.isArray(p) && p.join(',') === '400,200,400').length === 1, vib);
      const bud = await ev(() => (window.haru && haru.budget ? haru.budget() : null));
      check('budget: his 1 · jumps 0 · stings ≤ 1 · monos ≤ 6', bud && bud.hisLines === 1 && bud.jumps === 0 && bud.stings <= 1 && bud.monos <= 6, bud);
      const dump = await ev(() => JSON.stringify(Object.assign({}, localStorage)));
      check('no e2_* stage keys in the ep3 save', !/"stage":\{[^}]*e2_/.test(await ev(() => localStorage.getItem('haru-escape.ep3.save.v1') || '')));
      if (NAMES) {
        const hits = [NAMES.PLAYER_NAME, NAMES.MAKER_NAME].filter((n) => dump.indexOf(n) >= 0);
        check('player/maker name never in localStorage', !hits.length, hits);
      }
    });
    pass = checks.every((c) => c.ok);
    if (!pass) failure = 'checks: ' + checks.filter((c) => !c.ok).map((c) => c.label).join(' | ');
  } catch (e) {
    failure = e.message.split('\n')[0];
  }

  const vibAll = await ev(() => window.__vib || []).catch(() => null);
  log('vibrate calls', JSON.stringify(vibAll));
  log('ERRORS (' + errors.length + ')');
  errors.forEach((e) => log('  ' + e));
  const summary = { dev: !!FROM, pass: !FROM && pass && errors.length === 0, failure, ep1: EP1, ep2: EP2, series: SERIES || null, milestones, errors: errors.length,
    failedChecks: checks.filter((c) => !c.ok).map((c) => c.label), checks: checks.length,
    record: series && { eps: series.eps, s: series.s, seen: series.seen, sea: series.sea, last: series.last }, wallSec: Math.round((Date.now() - T_START) / 1000) };
  console.log(JSON.stringify(summary));
  await browser.close();
  process.exit(summary.pass ? 0 : 1);
})();
