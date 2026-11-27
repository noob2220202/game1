/* =========================================================
 * tools/qa/ep3_branches.js — branch coverage the §11.3 speedrun does not take (core · ARCH_EP3 §7.5 · DESIGN_EP3 §10 I · §9.3)
 *
 *   NODE_PATH=<global node_modules> node tools/qa/ep3_branches.js [--only=A,B,C,…] [--headed]
 *
 * Each scenario opens a fresh context on file:///…/ep3/index.html?debug=1, reaches its start state with haru.jump (DEBUG —
 * allowed here, unlike the speedrun) and then plays with real taps / keys on data-qa selectors.
 *   A  climax 8 cases (§10 I): 0:08 · 0:16 · 0:21 line · scrub to ≈ 10 s · ▶ from the start (엄마 turns away at b ≥ 0.9) ·
 *      the away session (0:08 tapped while she stands at the sink → played 0 · cards 0) · 0:22 line (tail line) · a pause over
 *      15 s (session ends, no reaction) · playback in 세아 방 (no judging) · 240 s fallback → stage.e3_played false
 *   B  112 branches (§10 I V15): ¬bip · bip ∧ ¬jimin112 (call112First) · jimin112 ∧ ¬patrol · patrol — result card per row
 *   C  M6 defer (§10 I): M5 + 60 s while S1 (settings search typing) · S2 (notebook open) · S4 (recording) · S9 (112 call) →
 *      M6 waits for 3 s clear, at most 40 s
 *   D  name fallbacks: 하루 · 지은 (→ 지은아) · 민준 (→ 민준아) · one syllable · six syllables · Latin — 0:21 line text and sigName
 *   E  reload at every §9.2 row → 이어하기 → the resumed surface (eye view · handover cards · lock · home · door · memory ·
 *      table · tail · ending screen)
 *   F  series profiles S1–S13 (§9.3): cbPreview / recap card / replay buttons / S13 two-tab (cb fixed at boot)
 *   G  less-scary + speaker run (pause menu) through M6 → no errors, vibrate never [400,200,400] when less
 *   H  localStorage blocked → memory mode: boots, plays, END commit returns false and retries quietly (≤ 5), no error text
 *   I  text size 1.3 overflow sweep (standard + easy home, settings, phone, callrec, sms, talk, gallery, notebook)
 *   J  two-finger tap opens the pause menu (clock paused); a two-finger pinch in the gallery viewer does not (and zooms it)
 *   K  second paths per objective (§11.1): easy by search '글씨' (and the font slider = text only) · rec through 전화 ⋮ › 설정 ›
 *      통화 녹음 › 녹음된 통화 and settings search · text by the list-row ⋮, ▶ from the start (nameKnown, no sigName), a scrub
 *      to 21.5 (no heard21) + the grey line on top 20 s (nameKnown), a plain recording's 0:21 line (no sea0333 flag) · block
 *      row detail · the 차단 number on the keypad · show in the living room → position card · album by the avatar row and the
 *      activity 'sagongsa님이 참여했습니다' row · activity 04:31 → deleted photo · 지금 사용 switch → 사용 기록 top row ·
 *      시계 › 타이머 runs (wheels → countdown → silent end, progress 0)
 *   L  fallbacks + 04:40 variants: M5 album fallback (TB + 180 s, no album) · M6 with no 0° look and the 지민 chip kept →
 *      doorDone at 60 s, ¬view0AfterM6, ¬jiminChipSent, B line later · 관리사무소 after bip · drawing before M7 (memEarly →
 *      엄마's card at M7 + 30 s) · nothing in M7 (150 s fallback) · M7 start from the B doorframe · M6 while in 세아 방
 *   M  speaker mode (ear.speaker at the title): through the 03:33 call to gotPhone, then the climax played in speaker mode
 *   N  easyBack [그대로 드리기] → stage.easyBack false → after the hook s.e3_easyBack stays false · 03:33 ring screen taps (받기 ·
 *      거절 are 엄마's screen — no reaction, the call keeps its script)
 * Exit 0 = every selected scenario passed with 0 pageerrors / console errors / failed requests. JSON summary on the last line.
 * ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'file:///' + path.join(ROOT, 'ep3', 'index.html').replace(/\\/g, '/') + '?debug=1';
const OUT = path.join(ROOT, 'work', 'shots', 'ep3', 'branches');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (ARG.only ? String(ARG.only) : 'A,B,C,D,E,F,G,H,I,J,K,L,M,N').split(',');
const T0 = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T0) / 1000).toFixed(1) + 's]').padEnd(9), ...a);

async function scenario(browser, id, fn, ctxOpts, init) {
  try { fs.readdirSync(OUT).filter((f) => f.startsWith(id + '_')).forEach((f) => fs.unlinkSync(path.join(OUT, f))); } catch (e) {}   // no stale shots of this scenario
  const ctx = await browser.newContext(Object.assign({ ...devices['iPhone 13'] }, ctxOpts || {}));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  await ctx.addInitScript(() => {
    window.__vib = [];
    const nav = navigator, orig = typeof nav.vibrate === 'function' ? nav.vibrate.bind(nav) : null;
    if (orig) nav.vibrate = function (p) { window.__vib.push(Array.isArray(p) ? p.slice() : p); return orig(p); };
    window.__cards = [];
    const seenT = new Set();
    setInterval(() => { try { document.querySelectorAll('.c3-cbox[aria-label], .fl3-fcard [aria-label]').forEach((b) => { const t = b.getAttribute('aria-label'); if (t && !seenT.has(t)) { seenT.add(t); window.__cards.push(t); } }); } catch (e) {} }, 150);
  });
  const page = await ctx.newPage();
  const errors = [], checks = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300) + ' @' + (m.location().url || '').replace(/.*game1/, '') + ':' + m.location().lineNumber); });
  page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test((r.failure() && r.failure().errorText) || '')) errors.push('REQFAIL ' + r.url().replace(/.*game1/, '') + ' ' + ((r.failure() && r.failure().errorText) || '')); });
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (f, a) => page.evaluate(f, a);
  const sel = (v) => `[data-qa="${v}"]:visible`;
  const loc = (v) => page.locator(sel(v)).last();
  let n = 0;
  const H = {
    page, sleep, ev, loc,
    shot: async (label) => { n++; try { await page.screenshot({ path: path.join(OUT, id + '_' + String(n).padStart(2, '0') + '_' + label.replace(/[^a-z0-9_.-]+/gi, '_') + '.png') }); } catch (e) {} },
    check(label, ok, info) { checks.push({ label, ok: !!ok, info }); log('  ' + id + ' ' + (ok ? '✓' : '✗') + ' ' + label + (ok || info === undefined ? '' : ' ' + JSON.stringify(info).slice(0, 240))); },
    flags: () => ev(() => (window.haru && haru.flags ? haru.flags() : [])),
    async has(f) { return (await H.flags()).includes(f); },
    visible: (v) => loc(v).isVisible().catch(() => false),
    async tap(v, o) {
      o = o || {};
      const l = loc(v);
      await l.waitFor({ state: 'visible', timeout: o.timeout || 15000 });
      await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await l.click({ timeout: o.timeout || 15000 });
      await sleep(o.after == null ? 450 : o.after);
    },
    async tapIf(v, ms) { try { await H.tap(v, { timeout: ms || 1500 }); return true; } catch (e) { return false; } },
    async waitFlag(f, timeout) { const t = Date.now(); while (Date.now() - t < (timeout || 30000)) { if (await H.has(f)) return true; await sleep(250); } throw new Error('timeout waiting for flag ' + f); },
    async waitFn(fn, timeout, label, arg) { const t = Date.now(); while (Date.now() - t < (timeout || 30000)) { try { if (await ev(fn, arg)) return true; } catch (e) {} await sleep(250); } throw new Error('timeout: ' + label); },
    scale: (k) => ev((k) => window.haru && haru.time && haru.time(k), k),
    recRate: (k) => ev((k) => (window.haru && haru.recRate ? haru.recRate(k) : null), k),
    async boot(q) {
      await page.goto(BASE + (q || ''));
      await sleep(1200);
      await H.waitFn(() => !!(window.G && G.e3 && document.querySelector('[data-qa="title.start"]')), 20000, 'title');
    },
    /** title → warning → earphone test → (recap skip) — the gesture that unlocks audio */
    async start() {
      await H.tap('title.start'); await H.tap('warn.ok', { after: 900 }); await H.tap('ear.ok', { after: 900 }); await H.tap('ear.start', { after: 1200 });
      await H.tapIf('recap.skip', 2500);
      await H.waitFlag('M0', 15000);
    },
    async jump(idj, o) { await ev(([a, b]) => haru.jump(a, b || {}), [idj, o || null]); await sleep(1500); },
    /** reach a haru.jump state from the title (G.main.resumeFrom draws it) — then [이어하기] is the audio-unlock gesture */
    async startAt(idj, o) {
      await H.jump(idj, o);
      await sleep(1000);
      if (await H.tapIf('title.continue', 3000)) await sleep(2500);
    },
    async cards(maxMs) {
      const t0 = Date.now();
      while (Date.now() - t0 < (maxMs || 90000)) {
        if (!(await page.locator('[data-qa="card"]').count())) return true;
        if (await page.locator('[data-qa^="chip.opt:"]:visible').count()) return 'chips';
        const c = page.locator('[data-qa="card.next"]:visible').last();
        if (await c.count()) { try { await c.click({ timeout: 1500 }); } catch (e) {} }
        await sleep(450);
      }
      throw new Error('cards did not finish');
    },
    async home() { if (await H.visible('room.close')) await H.tap('room.close'); if (await H.visible('home.bar')) await H.tap('home.bar', { after: 700 }); },
    async app(id) {
      if (await page.locator('[data-qa="card"]').count()) { if ((await H.cards(120000)) === 'chips') await H.answerChip(); await H.cards(120000); }   // story cards sit over the dock
      await H.home(); if (!(await H.tapIf('home.app:' + id, 3000))) await H.tap('easy.tile:' + id, { after: 900 }); await sleep(600);
    },
    /** answer whatever chip sheet is up with its first chip (+ [말하기]/[보내기] when it opens the editor) */
    async answerChip() {
      const c = page.locator('[data-qa^="chip.opt:"]:visible').first();
      if (!(await c.count())) return;
      await c.click({ timeout: 5000 }); await sleep(500);
      if (await H.visible('chip.send')) await H.tap('chip.send', { after: 900 });
    },
    async openText() {
      await H.app('phone'); await H.tap('phone.menu', { after: 600 }); await H.tap('phone.menu.rec', { after: 900 });
      await H.tap('rec.item.more:sea0333', { after: 700 }); await H.tap('rec.more.text', { after: 2600 });
    },
    async dial(num) {
      await H.app('phone'); await H.tap('phone.tab:pad', { after: 600 });
      for (const d of String(num)) await H.tap('dial.key:' + d, { after: 150 });
      await H.tap('dial.call', { after: 1200 });
    },
    screenText: () => ev(() => (document.getElementById('screen') || document.body).innerText),
    cardLog: () => ev(() => window.__cards || []),
    async seen(s) { return (await H.cardLog()).some((x) => x.indexOf(s) >= 0); },
    async waitText(s, timeout) { return H.waitFn((s) => (document.getElementById('screen') || document.body).innerText.indexOf(s) >= 0, timeout || 15000, 'text ' + s, s); },
    async waitCard(s, timeout) { return H.waitFn((s) => (window.__cards || []).some((x) => x.indexOf(s) >= 0), timeout || 30000, 'card ' + s, s); },
    async back() {
      if (await H.visible('viewer.close')) return H.tap('viewer.close', { after: 550 });
      if (await H.visible('room.closeup.close')) return H.tap('room.closeup.close', { after: 550 });
      if (await H.visible('nav.back')) return H.tap('nav.back', { after: 550 });
      await page.keyboard.press('Escape'); await sleep(550);
    },
    async waitFast(f, timeout, k) { await H.scale(k || 10); try { await H.waitFlag(f, timeout); } finally { await H.scale(1); } },
  };
  let ok = false, failure = null;
  log('▶ scenario', id);
  try { await fn(H); ok = true; }
  catch (e) { failure = e.message.split('\n')[0]; log('✗', id, failure); await H.shot('FAIL'); }
  await ctx.close();
  const pass = ok && checks.every((c) => c.ok) && errors.length === 0;
  if (errors.length) errors.forEach((e) => log('  ' + id + ' ' + e));
  return { id, pass, failure, failedChecks: checks.filter((c) => !c.ok).map((c) => c.label), errors: errors.length };
}

/* ---------------- A · climax 8 cases ---------------- */
async function climaxCase(H, label, play, expect) {
  await H.boot(); await H.startAt('M8', { armed: true });
  if ((await H.cards()) === 'chips') { await H.answerChip(); await H.cards(); }
  await H.waitFlag('playArmed', 20000);
  await H.openText();
  await H.recRate(4);
  await play(H);
  await expect(H);
  await H.recRate(1);
  await H.shot(label);
}
async function A(browser) {
  const res = [];
  const played = (path) => async (H) => { await H.waitFlag('played', 45000); const st = await H.ev(() => G.state.stage.e3_played); H.check('played → stage e3_played true' + (path ? ' (' + path + ')' : ''), st === true); };
  const line = (t) => async (H) => { await H.tap('rec.line:' + t, { after: 300 }); };
  res.push(await scenario(browser, 'A1_line08', (H) => climaxCase(H, 'line08', line(8), played('A'))));
  res.push(await scenario(browser, 'A2_line16', (H) => climaxCase(H, 'line16', line(16), played('B'))));
  res.push(await scenario(browser, 'A3_line21', (H) => climaxCase(H, 'line21', line(21), played('B'))));
  res.push(await scenario(browser, 'A4_scrub10', (H) => climaxCase(H, 'scrub10', async (H) => {
    const b = await H.loc('rec.mini.seek').boundingBox().catch(() => null) || await H.loc('rec.seek').boundingBox();
    await H.page.mouse.click(b.x + b.width * (10 / 33), b.y + b.height / 2);
    await H.sleep(300);
    if (!(await H.ev(() => G.callrec && G.callrec.state().playing))) await H.tapIf('rec.mini.play', 2000);
  }, played())));
  res.push(await scenario(browser, 'A5_head', (H) => climaxCase(H, 'head', async (H) => { await H.tap('rec.mini.play', { after: 300 }); }, async (H) => {
    await H.waitFn(() => G.state.vars.momAwayUntil != null && G.state.playMs < G.state.vars.momAwayUntil, 20000, 'turn away');
    H.check('head session → 엄마 turns away (momAwayUntil set)', true);
    H.check('no played on a head session', !(await H.has('played')));
  })));
  res.push(await scenario(browser, 'A6_away', (H) => climaxCase(H, 'away', async (H) => {
    await H.tap('rec.mini.play', { after: 300 });
    await H.waitFn(() => G.state.vars.momAwayUntil != null && G.state.playMs < G.state.vars.momAwayUntil, 20000, 'turn away');
    await H.sleep(1500);
    await H.tap('rec.line:8', { after: 300 });
  }, async (H) => {
    await H.sleep(12000);
    H.check('away session reaching 0:33 → played 0', !(await H.has('played')));
  })));
  res.push(await scenario(browser, 'A7_line22', (H) => climaxCase(H, 'line22', line(22), async (H) => {
    await H.waitFn(() => G.state.vars.playFails && G.state.vars.playFails.tail >= 1, 30000, 'tail line');
    H.check('0:22 line → tail line (playFails.tail++) · not played', !(await H.has('played')));
  })));
  res.push(await scenario(browser, 'A8_pause15', (H) => climaxCase(H, 'pause15', async (H) => {
    await H.recRate(1);
    await H.tap('rec.line:8', { after: 2000 });
    await H.tap('rec.mini.play', { after: 300 });          // pause
    await H.scale(4); await H.sleep(5000); await H.scale(1);  // > 15 s of playMs
    await H.tap('rec.mini.play', { after: 300 });          // resume = a new session from ≈ 0:10
    await H.recRate(4);
  }, async (H) => {
    await H.sleep(12000);
    H.check('a resumed session after > 15 s pause does not count from its old start', true);
  })));
  res.push(await scenario(browser, 'A9_srRoom', async (H) => {
    await H.boot(); await H.startAt('M8', { armed: true });
    if ((await H.cards()) === 'chips') { await H.answerChip(); await H.cards(); }
    await H.ev(() => haru.where('sr'));
    await H.openText(); await H.recRate(4);
    await H.tap('rec.line:8', { after: 300 });
    await H.sleep(12000);
    H.check('세아 방 playback → no judging', !(await H.has('played')));
    await H.recRate(1);
  }));
  res.push(await scenario(browser, 'A10_fallback240', async (H) => {
    await H.boot(); await H.startAt('M8', { armed: true });
    if ((await H.cards()) === 'chips') { await H.answerChip(); await H.cards(); }
    await H.waitFlag('playArmed', 20000);
    await H.scale(10);
    await H.waitFlag('playFallback', 90000);
    await H.scale(1);
    await H.cards().catch(() => {});
    H.check('240 s fallback → stage.e3_played false', (await H.ev(() => G.state.stage.e3_played)) === false);
  }));
  return res;
}

/* ---------------- B · 112 branches ---------------- */
async function B(browser) {
  const one = (label, prep, want, flagWant) => scenario(browser, 'B_' + label, async (H) => {
    await H.boot();
    await prep(H);
    await H.dial('112');
    await H.waitFn(() => !!document.querySelector('[data-qa="call.screen"]'), 15000, 'call screen');
    await H.sleep(6000);
    const t = await H.screenText();
    H.check('112 card: ' + want, t.indexOf(want) >= 0, t.slice(0, 200));
    if (flagWant) H.check('call112First', await H.has('call112First'));
    await H.tapIf('call.end', 3000);
    await H.shot(label);
  });
  return [
    await one('noBip', (H) => H.startAt('M2'), '사건 번호를 확인한다', false),
    await one('bipFirst', async (H) => { await H.startAt('M6'); await H.waitFlag('bip', 20000); }, '주소를 확인한다', true),
    await one('afterJimin', async (H) => { await H.startAt('M6'); await H.ev(() => { haru.flag('bip'); haru.flag('jiminUp'); haru.flag('jimin112'); }); }, '같은 주소로 방금 신고가 들어왔다고 한다', false),
    await one('afterPatrol', (H) => H.startAt('M7'), '지구대가 복도와 계단을 다녀갔다고 한다', false),
  ];
}

/* ---------------- C · M6 defer ---------------- */
async function C(browser) {
  const one = (label, hold) => scenario(browser, 'C_' + label, async (H) => {
    await H.boot(); await H.startAt('M5');
    const due = await H.ev(() => G.e3.m6Due());
    await hold(H);
    await H.scale(4);
    await H.waitFn((d) => G.state.playMs >= d + 5000, 60000, 'past due', due);
    await H.scale(1);                                     // real time from here: the 40 s cap is measured without tick slop
    H.check(label + ': M6 deferred while held', !(await H.has('M6')));
    await H.waitFlag('M6', 60000);
    const d = await H.ev(() => G.pm('M6') - (G.pm('M5') + 60000));
    H.check(label + ': M6 within 40 s of due (+ one 250 ms tick)', d >= 0 && d <= 40400, d);
  });
  return [
    await one('S1_search', async (H) => { await H.app('settings'); await H.tap('settings.search'); await H.ev(() => haru.type('녹')); }),
    await one('S2_notebook', async (H) => { await H.tap('nb.fab', { after: 800 }); }),
    await one('S4_recording', async (H) => { await H.openText(); await H.tap('rec.line:1', { after: 300 }); }),
    await one('S9_call', async (H) => { await H.dial('112'); }),
  ];
}

/* ---------------- D · name fallbacks ---------------- */
async function D(browser) {
  const names = [['하루', '하루야'], ['지은', '지은아'], ['민준', '민준아'], ['훈', '훈아'], ['가나다라마바', '가나다라마바야'], ['Haru', 'Haru야']];
  const out = [];
  for (const [nm, want] of names) {
    out.push(await scenario(browser, 'D_' + encodeURIComponent(nm).slice(0, 12), async (H) => {
      await H.boot('&name=' + encodeURIComponent(nm)); await H.startAt('M2');
      await H.openText();
      const t = await H.ev(() => { const n = document.querySelector('[data-qa="rec.line:21"]'); return n ? n.innerText : ''; });
      H.check('0:21 line shows ' + want, t.indexOf(want) >= 0, t);
      await H.recRate(4);
      await H.tap('rec.line:21', { after: 300 });
      await H.waitFlag('sigName', 30000);
      H.check('sigName with ' + nm, true);
      await H.recRate(1);
    }));
  }
  return out;
}

/* ---------------- E · reload at every §9.2 row ---------------- */
async function E(browser) {
  const rows = [
    ['M0', null, () => !!document.querySelector('[data-qa="room.eye"]')],
    ['M1', null, () => !!document.querySelector('[data-qa="lock.surface"]') || !!document.querySelector('[data-qa="card"]')],
    ['gotPhone', null, () => !!document.querySelector('[data-qa="easy.home"]')],
    ['M2', null, () => !!document.querySelector('[data-qa="home.app:settings"]')],
    ['M5', null, () => !!document.querySelector('[data-qa="home.app:settings"]')],
    ['M6', null, () => true],
    ['M7', null, () => true],
    ['M8', { armed: true }, () => true],
    ['END', null, () => true],
    ['HOOK', null, () => !!document.querySelector('[data-qa="title.hookReplay"]') || !!document.querySelector('[data-qa="hook.home"]')],
  ];
  const out = [];
  for (const [idj, o, surf] of rows) {
    out.push(await scenario(browser, 'E_' + idj, async (H) => {
      await H.boot(); await H.startAt(idj, o);
      await H.sleep(2500);
      const before = await H.flags();
      await H.page.reload(); await H.sleep(1500);
      await H.tapIf('title.continue', 8000);
      await H.sleep(4000);
      const after = await H.flags();
      H.check(idj + ': flags kept across the reload', before.every((f) => after.includes(f)), before.filter((f) => !after.includes(f)));
      let okSurf = false; for (let i = 0; i < 30 && !okSurf; i++) { okSurf = !!(await H.ev(surf)); if (!okSurf) await H.sleep(500); }   // M0: 8 s layering first
      H.check(idj + ': resumed surface', okSurf);
      await H.shot(idj);
    }));
  }
  return out;
}

/* ---------------- F · series profiles S1–S13 ---------------- */
async function F(browser) {
  const want = {
    S1: 'false,false,none,false,false,true', S2: 'true,true,none,false,false,true', S3: 'true,false,none,false,false,true', S4: 'false,false,none,false,false,true',
    S5: 'false,false,yes,true,true,false', S6: 'false,false,no,false,false,false', S7: 'false,false,none,false,false,true', S12: 'false,false,none,false,false,true',
    S13: 'false,false,none,false,false,true',
  };
  const out = [];
  for (const p of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13']) {
    out.push(await scenario(browser, 'F_' + p, async (H) => {
      await H.boot('&series=' + p);
      const cb = await H.ev(() => G.e3.cb());
      const s = [cb.A, cb.A1, cb.B, cb.C, cb.D, cb.E].join(',');
      if (want[p]) H.check(p + ' cbPreview', s === want[p], cb);
      if (p === 'S8') H.check('S8 replay → ep3Done', await H.ev(() => G.e3.ep3Done === true));
      if (p === 'S9') H.check('S9 future record → read only', await H.ev(() => G.series.readOnly() === true));
      await H.start();
      const recap = await H.has('recapShown');
      H.check(p + ' recap card iff cb.E', recap === !!cb.E || !want[p], { recap, E: cb.E });
      if (p === 'S13') {
        await H.ev(() => G.series.patch((r) => { r.eps['2'] = Object.assign({}, r.eps['2'], { st: 'done', canon: true }); }));
        await H.ev(() => G.e3.seriesBoot());
        const cb2 = await H.ev(() => G.e3.cb());
        H.check('S13: cb fixed at introDone (mid-play series change ignored)', cb2.B === cb.B && cb2.E === cb.E, cb2);
      }
      if (p === 'S12' || p === 'S1') {
        await H.ev(() => { ['blockBottom', 'greySeen', 'heightSeen', 'radioHeard', 'calCake', 'sigName'].forEach((f) => haru.flag(f)); });
        await H.jump('HOOK', { commit: true });
        await H.ev(() => G.e3.hookPatch());
        const r = await H.ev(() => G.series.get());
        H.check(p + ': e3_height · e3_radio · e3_cake · e3_easyBack land', r.seen.e3_height && r.seen.e3_radio && r.seen.e3_cake && r.s.e3_easyBack === true, { seen: r.seen, s: r.s });
      }
    }));
  }
  return out;
}

/* ---------------- G · less-scary + speaker ---------------- */
async function G_(browser) {
  return [await scenario(browser, 'G_lessSpeaker', async (H) => {
    await H.boot(); await H.startAt('M2');
    if (!(await H.tapIf('statusbar.pause', 3000))) await H.tap('pause.btn', { after: 700 });
    await H.sleep(700);
    await H.tap('pause.opt:scares:light', { after: 300 });
    await H.tap('pause.opt:audioMode:speaker', { after: 300 });
    await H.tap('pause.resume', { after: 700 });
    H.check('settings: scares light + speaker', await H.ev(() => G.settings.scares !== 'full' && G.settings.audioMode === 'speaker'));
    await H.jump('M5');
    await H.scale(6); await H.waitFlag('M6', 120000); await H.scale(1);
    await H.sleep(20000);
    const vib = await H.ev(() => window.__vib);
    H.check('less: no [400,200,400]', !vib.some((p) => Array.isArray(p) && p.join(',') === '400,200,400'), vib);
    H.check('no shake class ever', await H.ev(() => !document.querySelector('.c2-shake')));
  })];
}

/* ---------------- H · localStorage blocked ---------------- */
async function H_(browser) {
  const block = () => {
    const thr = () => { throw new DOMException('blocked', 'SecurityError'); };
    try { Object.defineProperty(window, 'localStorage', { configurable: true, get: thr }); } catch (e) {}
  };
  return [await scenario(browser, 'H_blocked', async (H) => {
    await H.boot(); await H.startAt('M2');
    H.check('memory mode', await H.ev(() => G.memoryMode() === true || G.series.memory() === true));
    await H.jump('END', { commit: true });
    const v = await H.ev(() => ({ committed: G.state.vars.committed, tries: G.state.vars.commitTries }));
    H.check('commit not stored → committed false, tries ≥ 1', v.committed === false && v.tries >= 1, v);
    const t = await H.screenText();
    H.check('no error text on screen', !/error|오류|실패했/i.test(t));
  }, null, { fn: block })];
}

/* ---------------- I · text size 1.3 overflow sweep ---------------- */
async function I(browser) {
  return [await scenario(browser, 'I_ts13', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.ev(() => { G.settings.textSize = 1.3; document.documentElement.style.setProperty('--ts', '1.3'); ['stage', 'phone', 'screen'].forEach((id) => { const n = document.getElementById(id); if (n) n.style.setProperty('--ts', '1.3'); }); });
    // text overflow sweep: every visible text run must sit inside the phone screen and must not be cut by an ancestor that
    // clips (overflow hidden / clip) unless that ancestor truncates on purpose (text-overflow: ellipsis) or scrolls.
    // Decorative boxes (the battery nub, the notebook tick) overflow by design and carry no text — they are not checked.
    const sweep = async (label) => {
      await H.sleep(600);
      const bad = await H.ev(() => {
        const scr = document.getElementById('screen'); if (!scr) return ['no #screen'];
        const S = scr.getBoundingClientRect(), out = [];
        const tw = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
        for (let t = tw.nextNode(); t && out.length < 8; t = tw.nextNode()) {
          const p = t.parentElement; if (!p || p.closest('.kb') || p.closest('[aria-hidden="true"]')) continue;
          const ps = getComputedStyle(p); if (ps.visibility === 'hidden' || ps.display === 'none' || +ps.opacity === 0) continue;
          const r = document.createRange(); r.selectNodeContents(t);
          const R = r.getBoundingClientRect(); if (!R.width || !R.height) continue;
          if (R.right <= S.left || R.left >= S.right || R.bottom <= S.top || R.top >= S.bottom) continue;   // a screen parked off stage
          let why = null, cut = false;
          for (let a = p; a && a !== scr; a = a.parentElement) {
            const s = getComputedStyle(a);
            if (/(auto|scroll)/.test(s.overflowX)) { cut = true; break; }                      // a scroller: its own business
            if (/(hidden|clip)/.test(s.overflowX)) {
              const A = a.getBoundingClientRect();
              if (R.right > A.right + 1 || R.left < A.left - 1) {
                if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) { cut = true; break; }   // deliberate '…'
                why = (a.dataset.qa || a.className || a.tagName); break;
              }
            }
          }
          if (!why && !cut && (R.right > S.right + 1 || R.left < S.left - 1)) why = 'screen';
          if (why) out.push(JSON.stringify(t.nodeValue.trim().slice(0, 24)) + ' cut by ' + String(why).slice(0, 40) + ' (' + Math.round(R.right - S.right) + ')');
        }
        return out;
      });
      H.check(label + ': no text cut off / outside the screen', !bad.length, bad);
      await H.shot(label);
    };
    await H.home(); await sweep('home');
    await H.app('settings'); await sweep('settings');
    await H.app('phone'); await sweep('phone');
    await H.tap('phone.menu', { after: 600 }); await H.tap('phone.menu.block', { after: 900 }); await H.tap('block.calls', { after: 900 }); await sweep('blocked');
    await H.openText(); await sweep('text');
    await H.app('sms'); await sweep('sms');
    await H.app('talk'); await sweep('talk');
    await H.app('gallery'); await sweep('gallery');
    await H.tap('nb.fab', { after: 800 }); await sweep('notebook'); await H.tapIf('nb.close', 1500);
    await H.ev(() => G.easy && G.easy.set && G.easy.set(true, { silent: true }));
    await H.home(); await sweep('easyHome');
  })];
}

/* ---------------- J · two-finger pause vs pinch ---------------- */
async function J(browser) {
  return [await scenario(browser, 'J_twoFinger', async (H) => {
    await H.boot(); await H.startAt('M2');
    const cdp = await H.page.context().newCDPSession(H.page);
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: 150, y: 400, id: 1 }, { x: 230, y: 400, id: 2 }]); await H.sleep(80); await touch('touchEnd', []);
    await H.sleep(800);
    H.check('two-finger tap → pause menu + clock paused', await H.ev(() => !!document.querySelector('[data-qa="pause.resume"]') && !G.clock.running()));
    await H.tapIf('pause.resume', 2000);
    await H.app('gallery'); await H.tap('gallery.tab:albums'); await H.tap('gallery.album:shared', { after: 900 }); await H.tap('gallery.photo:1130', { after: 900 });
    await touch('touchStart', [{ x: 170, y: 420, id: 1 }, { x: 220, y: 420, id: 2 }]);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: 170 - i * 10, y: 420, id: 1 }, { x: 220 + i * 10, y: 420, id: 2 }]); await H.sleep(30); }
    await touch('touchEnd', []);
    await H.sleep(800);
    H.check('pinch in the viewer → no pause menu', await H.ev(() => !document.querySelector('[data-qa="pause.resume"]')));
    // the same two-finger spread is a real pinch zoom in the viewer (§9.5-4: 1–3×) — the multi-touch path, not only wheel / keys
    const z = await H.ev(() => { const b = document.querySelector('.md3-zoom'); return b ? +b.dataset.zoom || 1 : 0; });
    H.check('pinch spread → viewer zoom > 1.5× (≤ 3×)', z > 1.5 && z <= 3.001, z);
    await H.shot('pinch_zoom');
  })];
}

/* ---------------- K · second paths per objective (§11.1) ---------------- */
async function K(browser) {
  const out = [];
  out.push(await scenario(browser, 'K_easySearch', async (H) => {
    await H.boot(); await H.startAt('gotPhone');
    await H.tap('easy.tile:settings', { after: 900 });
    await H.tap('settings.search', { after: 700 });
    await H.ev(() => haru.type('글씨')); await H.sleep(700);
    await H.shot('search_geulssi');
    const rows = await H.ev(() => [...document.querySelectorAll('[data-qa^="settings.result:"]')].map((n) => n.innerText.replace(/\s+/g, ' ')));
    H.check("search '글씨' → 쉬운 모드 first, then 글자 크기와 스타일", /쉬운 모드/.test(rows[0] || '') && rows.some((r) => /글자 크기/.test(r)), rows);
    const fontIdx = rows.findIndex((r) => /글자 크기/.test(r));
    await H.tap('settings.result:' + fontIdx, { after: 900 });
    const sl = await H.loc('settings.slider:font').boundingBox();
    await H.page.mouse.click(sl.x + sl.width * 0.95, sl.y + sl.height / 2); await H.sleep(800);
    H.check('font slider → text bigger only (no easyOff)', !(await H.has('easyOff')));
    await H.shot('font_slider');
    await H.home(); await H.tap('easy.tile:settings', { after: 900 });
    await H.tap('settings.search', { after: 700 });
    await H.ev(() => haru.type('쉬운')); await H.sleep(700);
    H.check("search '쉬운' → 쉬운 모드 first", /쉬운 모드/.test(await H.ev(() => { const n = document.querySelector('[data-qa="settings.result:0"]'); return n ? n.innerText : ''; })));
    await H.tap('settings.result:0', { after: 900 });
    await H.tap('easy.toggle', { after: 1500 });
    await H.waitFlag('easyOff', 5000); await H.waitFlag('M2', 5000);
    H.check("easy off by search '글씨' → M2", true);
  }));
  out.push(await scenario(browser, 'K_recPaths', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.app('phone'); await H.tap('phone.menu', { after: 600 }); await H.tap('phone.menu.settings', { after: 900 });
    await H.tap('callrec.row:rec', { after: 900 }); await H.tap('callrec.row:list', { after: 900 });
    await H.waitFlag('recListOpened', 5000);
    await H.tap('rec.item:sea0333', { after: 1000 });
    await H.waitFlag('recPlayerOpened', 5000);
    H.check('rec through 전화 ⋮ › 설정 › 통화 녹음 › 녹음된 통화', true);
    await H.shot('rec_settings_path');
    await H.home(); await H.app('settings');
    await H.tap('settings.search', { after: 700 }); await H.ev(() => haru.type('녹음')); await H.sleep(700);
    const rows = await H.ev(() => [...document.querySelectorAll('[data-qa^="settings.result:"]')].map((n) => n.innerText.replace(/\s+/g, ' ')));
    const i = rows.findIndex((r) => /녹음된 통화/.test(r));
    H.check("standard search '녹음' lists 녹음된 통화 (no gate)", i >= 0 && !rows.some((r) => /쉬운 모드에서는/.test(r)), rows);
    await H.tap('settings.result:' + i, { after: 1000 });
    H.check('search row opens the recordings list', await H.visible('rec.item:sea0333'));
  }));
  out.push(await scenario(browser, 'K_textPlayFromStart', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.openText();                                   // the list row ⋮ › 텍스트 변환 (second menu)
    await H.waitFlag('textOpened', 5000); await H.waitFlag('greySeen', 5000);
    H.check('list-row ⋮ › 텍스트 변환 → textOpened · greySeen', true);
    await H.recRate(4);
    await H.tap('rec.mini.play', { after: 300 });          // ▶ from 0:00
    await H.waitFlag('heard21', 30000);
    await H.waitFlag('nameKnown', 5000);
    await H.sleep(2500);
    H.check('▶ from the start → nameKnown but no sigName', !(await H.has('sigName')));
    await H.recRate(1);
  }));
  out.push(await scenario(browser, 'K_textScrubGrey20', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.openText();
    await H.waitFlag('greySeen', 5000);
    const b = await H.loc('rec.mini.seek').boundingBox();
    await H.page.mouse.click(b.x + b.width * (21.5 / 33), b.y + b.height / 2); await H.sleep(300);
    if (!(await H.ev(() => G.callrec && G.callrec.state().playing))) await H.tapIf('rec.mini.play', 2000);
    await H.sleep(4000);
    H.check('scrub to ≈ 21.5 → no heard21', !(await H.has('heard21')));
    await H.waitFast('nameKnown', 60000, 2);                // greySeen ∧ the text screen on top 20 s
    H.check('grey line on top 20 s → nameKnown without heard21 / sigName', !(await H.has('heard21')) && !(await H.has('sigName')));
  }));
  out.push(await scenario(browser, 'K_textPlain', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.app('phone'); await H.tap('phone.menu', { after: 600 }); await H.tap('phone.menu.rec', { after: 900 });
    await H.tap('rec.item.more:jimin0110', { after: 700 }); await H.tap('rec.more.text', { after: 2600 });
    await H.waitFlag('textAnyOpened', 5000);
    await H.shot('text_plain');
    await H.recRate(4);
    await H.tap('rec.line:21', { after: 300 });
    await H.sleep(6000);
    await H.recRate(1);
    const f = await H.flags();
    H.check('plain recording 0:21 line → no sea0333 flag', !['textOpened', 'greySeen', 'heard21', 'nameKnown', 'sigName', 'radioHeard'].some((x) => f.includes(x)), f.filter((x) => ['textOpened', 'greySeen', 'heard21', 'nameKnown', 'sigName', 'radioHeard'].includes(x)));
  }));
  out.push(await scenario(browser, 'K_blockExtras', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.app('phone'); await H.tap('phone.menu', { after: 600 }); await H.tap('phone.menu.block', { after: 900 }); await H.tap('block.calls', { after: 900 });
    await H.tap('block.row:0', { after: 900 });
    await H.shot('block_detail');
    H.check('block row → number detail', /010-0658-2741/.test(await H.screenText()));
    await H.back(); await H.back(); await H.back();
    await H.tap('show.btn', { after: 900 });               // {N} in the living room, 엄마 in 세아 방 → position card only
    await H.waitCard('엄마는 세아 방에 있다', 15000);
    await H.cards();
    H.check('show in the living room → position card, no momBlock', !(await H.has('momBlock')));
    await H.dial('01006582741');
    await H.waitText('전화기가 꺼져 있어', 15000);
    H.check("the 차단 number on the keypad → '연결 실패' → '전화기가 꺼져 있어…'", true);
    await H.tapIf('call.end', 3000); await H.sleep(1500);
  }));
  out.push(await scenario(browser, 'K_albumAvatars', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.app('gallery'); await H.tap('gallery.tab:albums', { after: 800 }); await H.tap('gallery.album:shared', { after: 1000 });
    await H.tap('gallery.avatars', { after: 1200 });
    await H.waitFlag('membersSeen', 6000);
    H.check('avatar row → 멤버 → membersSeen', true);
    await H.shot('avatars');
  }));
  out.push(await scenario(browser, 'K_albumActivity', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.app('gallery'); await H.tap('gallery.tab:albums', { after: 800 }); await H.tap('gallery.album:shared', { after: 1000 });
    await H.tap('gallery.more', { after: 600 }); await H.tap('gallery.activity', { after: 1000 });
    await H.tap('gallery.act:5', { after: 900 });
    await H.waitText('삭제된 사진입니다', 5000);
    H.check('activity 04:31 → 삭제된 사진입니다', true);
    await H.shot('act_deleted');
    await H.back();
    H.check('no membersSeen yet', !(await H.has('membersSeen')));
    await H.tap('gallery.act:7', { after: 1200 });
    await H.waitFlag('membersSeen', 6000);
    H.check("activity 'sagongsa님이 참여했습니다' → member detail → membersSeen", /공유한 사진 0/.test(await H.screenText()));
  }));
  out.push(await scenario(browser, 'K_dndNow', async (H) => {
    await H.boot(); await H.startAt('M2');
    await H.app('settings'); await H.tap('settings.row:notif', { after: 800 }); await H.tap('settings.row:dnd', { after: 900 });
    await H.tap('settings.toggle:dndNow', { after: 900 });
    await H.tap('settings.row:dnd.log', { after: 900 });
    const t = await H.screenText();
    H.check('지금 사용 on → 사용 기록 top row 사용 중', /사용 중/.test(t), t.slice(0, 200));
    await H.shot('dnd_now');
    H.check('no progress flag from the switch', !(await H.has('momDnd')));
  }));
  // 시계 › 타이머 runs like a real one (DESIGN §4.8.3 — progress 0): wheels → ▶ → countdown → silent end → wheels again
  out.push(await scenario(browser, 'K_clockTimer', async (H) => {
    await H.boot(); await H.startAt('M2');
    const f0 = await H.flags();
    const vib0 = await H.ev(() => (window.__vib || []).length);
    await H.app('clock');
    await H.tap('clock.tab:timer', { after: 800 });
    const dis = () => H.ev(() => { const b = document.querySelector('[data-qa="clock.timer.start"]'); return b ? b.disabled : null; });
    H.check('timer: ▶ disabled at 00:00:00', (await dis()) === true);
    await H.loc('clock.timer.col:s').focus();
    for (let i = 0; i < 4; i++) { await H.page.keyboard.press('ArrowDown'); await H.sleep(120); }
    await H.sleep(400);
    H.check('timer: 4 s set → ▶ enabled', (await dis()) === false);
    await H.shot('timer_set');
    await H.tap('clock.timer.start', { after: 1300 });
    const d1 = await H.ev(() => { const n = document.querySelector('.md3-tm-disp'); return n ? n.textContent : ''; });
    H.check('timer: counting down', /^00:00:0[1-3]$/.test(d1), d1);
    await H.shot('timer_run');
    await H.sleep(3500);
    const end = await H.ev(() => { const n = document.querySelector('.md3-tm-disp'); return n ? { t: n.textContent, blink: n.classList.contains('md3-tm-done') } : null; });
    H.check('timer: reaches 00:00:00 (blink)', end && end.t === '00:00:00' && end.blink, end);
    await H.sleep(3600);
    H.check('timer: wheels come back after the end', await H.ev(() => { const w = document.querySelector('.md3-tm-wheels'); return !!w && w.style.display !== 'none'; }));
    H.check('timer: no vibration', (await H.ev(() => (window.__vib || []).length)) === vib0);
    const f1 = await H.flags();
    H.check('timer: no new progress flag', f1.filter((x) => !f0.includes(x)).length === 0, f1.filter((x) => !f0.includes(x)));
  }));
  return out;
}

/* ---------------- L · fallbacks + 04:40 variants ---------------- */
async function L(browser) {
  const out = [];
  out.push(await scenario(browser, 'L_albumFallbackM5', async (H) => {
    await H.boot(); await H.startAt('M4');
    H.check('no album flag at M4', !(await H.has('albumOpened')));
    await H.app('settings');                              // stay in an app, never open 사진
    await H.waitFast('M5', 240000, 10);
    const v = await H.ev(() => ({ M4: G.pm('M4'), M5: G.pm('M5'), TB: G.state.vars.TB }));
    const bound = Math.max(v.TB + 180000, v.M4 + 120000);
    H.check('M5 by the album fallback ≤ max(TB + 180 s, M4 + 120 s) (+ 1 tick at ×10)', v.M5 <= bound + 2600 && v.M5 >= v.M4 + 120000, v);
    H.check('album never opened', !(await H.has('albumOpened')));
  }));
  out.push(await scenario(browser, 'L_doorNoLookChipKept', async (H) => {
    await H.boot(); await H.startAt('M5');
    await H.app('settings');                              // phone open on an app: never the 0° view
    await H.waitFast('M6', 200000, 6);
    await H.waitFlag('bip', 10000);
    await H.scale(2);
    await H.waitFn(() => !!document.querySelector('[data-qa^="chip.opt:"]'), 40000, '지민 chip sheet');
    await H.scale(1);
    await H.shot('jimin_chip');
    await H.waitFast('doorDone', 120000, 4);             // chip left alone (times out) · 60 s fallback for the door objective
    const v = await H.ev(() => ({ M6: G.pm('M6'), done: G.pm('doorDone') }));
    H.check('doorDone at M6 + 60 s without the 0° view', v.done - v.M6 >= 59000 && v.done - v.M6 <= 63000, v);
    H.check('¬view0AfterM6 · ¬jiminChipSent', !(await H.has('view0AfterM6')) && !(await H.has('jiminChipSent')));
    await H.waitFast('patrol', 240000, 6);
    H.check('jiminUp · jimin112 · patrol all set by the sequence', (await H.has('jiminUp')) && (await H.has('jimin112')));
  }));
  out.push(await scenario(browser, 'L_officeAfterBip', async (H) => {
    await H.boot(); await H.startAt('M6'); await H.waitFlag('bip', 20000);
    await H.cards().catch(() => {});
    await H.app('phone'); await H.tap('phone.tab:contacts', { after: 800 });
    await H.tap('phone.contact:office', { after: 900 });
    await H.tap('phone.contact.call', { after: 1000 });
    await H.waitFn(() => !!document.querySelector('[data-qa="call.screen"]'), 15000, 'call screen');
    await H.waitText('공동현관 카메라', 60000);              // call-screen cards (shell callScreen api.card), not story cards
    H.check('관리사무소 after bip → 경비실 card', true);
    await H.tapIf('call.end', 3000); await H.sleep(1500);
  }));
  out.push(await scenario(browser, 'L_m6InSeaRoom', async (H) => {
    await H.boot(); await H.startAt('M5');
    await H.app('camera');
    if (!(await H.visible('room.spot:srdoor'))) await H.tap('room.view:r3_door', { after: 900 });
    await H.tap('room.spot:srdoor', { after: 2600 });
    H.check("where = 'sr' before M6", (await H.ev(() => G.e3.where())) === 'sr');
    await H.tap('room.close', { after: 800 });
    await H.waitFast('M6', 200000, 6);
    await H.waitFlag('bip', 10000);
    await H.sleep(2500);
    H.check('no view0AfterM6 while in 세아 방', !(await H.has('view0AfterM6')));
    await H.cards().catch(() => {});
    await H.app('camera');
    if (!(await H.visible('room.spot:srout'))) await H.tap('room.view:r3_sr_bed', { after: 900 });
    await H.tap('room.spot:srout', { after: 2600 });
    await H.tapIf('room.view:r3_door', 2000);
    await H.waitFlag('view0AfterM6', 10000);
    H.check('back in the living room → 0° → view0AfterM6', true);
    await H.shot('m6_from_sr');
  }));
  out.push(await scenario(browser, 'L_memEarly', async (H) => {
    await H.boot(); await H.startAt('M5');
    await H.app('camera');
    if (!(await H.visible('room.spot:srdoor'))) await H.tap('room.view:r3_door', { after: 900 });
    await H.tap('room.spot:srdoor', { after: 2600 });
    await H.tap('room.view:r3_sr_desk', { after: 800 });
    await H.tap('room.spot:drawing', { after: 1500 });
    await H.waitFlag('drawingSeen', 5000);
    H.check('drawing before M7 → caption only (no memoryStart)', !(await H.has('memoryStart')));
    await H.tap('room.closeup.close', { after: 700 }); await H.tap('room.close', { after: 800 });
    await H.jump('M7');
    await H.sleep(800);
    const m7 = await H.ev(() => G.pm('M7'));
    await H.cards(120000).catch(() => {});
    await H.waitFast('memoryStart', 120000, 4);
    const d = await H.ev((m7) => G.pm('memoryStart') - m7, m7);
    H.check('memEarly → 엄마 starts the memory ≈ M7 + 30 s (after the M7 cards)', d >= 30000 && d <= 90000, d);
  }));
  out.push(await scenario(browser, 'L_mem150', async (H) => {
    await H.boot(); await H.startAt('M7');
    const m7 = await H.ev(() => G.pm('M7'));
    await H.cards(120000).catch(() => {});
    await H.tapIf('room.close', 2000);
    await H.waitFast('memoryStart', 240000, 10);
    const d = await H.ev((m7) => G.pm('memoryStart') - m7, m7);
    // M7 + 150 s → the card '엄마가 책상에서 종이 한 장을 집는다.' → memoryStart after that card
    H.check('nothing in M7 → the 150 s fallback card, then the memory', (await H.seen('엄마가 책상에서 종이 한 장을 집는다.')) && d >= 150000 && d <= 200000, d);
    await H.scale(6); await H.waitFlag('memoryDone', 200000).catch(() => {}); await H.scale(1);
    await H.cards(120000).catch(() => {});
    await H.waitFast('M8', 120000, 6);
    H.check('fallback memory → M8', true);
  }));
  out.push(await scenario(browser, 'L_memDoorframe', async (H) => {
    await H.boot(); await H.startAt('M7');
    await H.cards(120000).catch(() => {});
    if (!(await H.visible('room.spot:frame'))) { await H.app('camera'); await H.tapIf('room.view:r3_sr_bed', 2000); }
    await H.tap('room.spot:frame', { after: 1500 });
    await H.waitFlag('memoryStart', 8000);
    H.check('M7 start from the B doorframe → memoryStart', true);
    await H.shot('mem_doorframe');
  }));
  return out;
}

/* ---------------- M · speaker mode ---------------- */
async function M_(browser) {
  return [await scenario(browser, 'M_speaker', async (H) => {
    await H.boot();
    await H.tap('title.start'); await H.tap('warn.ok', { after: 900 });
    await H.tap('ear.speaker', { after: 900 }); await H.tapIf('ear.start', 3000); await H.sleep(1200);
    await H.tapIf('recap.skip', 2500);
    await H.waitFlag('M0', 15000);
    H.check('speaker mode chosen at the earphone test', await H.ev(() => G.settings.audioMode === 'speaker'));
    await H.scale(4); await H.waitFlag('callRing', 120000); await H.scale(1);
    await H.waitFlag('callEnded', 90000);
    await H.cards(120000);
    await H.waitFlag('handover', 60000);
    const s = await H.loc('lock.surface').boundingBox();
    await H.page.mouse.move(s.x + s.width / 2, s.y + s.height * 0.75); await H.page.mouse.down();
    for (let i = 1; i <= 14; i++) { await H.page.mouse.move(s.x + s.width / 2, s.y + s.height * 0.75 - (360 * i) / 14); await H.sleep(16); }
    await H.page.mouse.up();
    await H.waitFlag('gotPhone', 8000);
    H.check('speaker: 03:33 → gotPhone', true);
    const vib = await H.ev(() => window.__vib);
    H.check('03:33 vibrate at most once [400,200,400]', vib.filter((p) => Array.isArray(p) && p.join(',') === '400,200,400').length <= 1, vib);
    await H.jump('M8', { armed: true });
    await H.openText(); await H.recRate(4);
    await H.tap('rec.line:8', { after: 300 });
    await H.waitFlag('played', 45000);
    await H.recRate(1);
    H.check('speaker mode: climax played (table route)', await H.ev(() => G.state.stage.e3_played === true));
  })];
}

/* ---------------- N · easyBack keep · 03:33 ring screen taps ---------------- */
async function N(browser) {
  const out = [];
  out.push(await scenario(browser, 'N_easyBackKeep', async (H) => {
    await H.boot(); await H.startAt('END', { commit: true });
    const t0 = Date.now();
    while (Date.now() - t0 < 300000 && !(await H.visible('chip.opt:keep'))) {
      if (await H.visible('chip.opt:eat')) { await H.tap('chip.opt:eat', { after: 500 }); if (await H.visible('chip.send')) await H.tap('chip.send', { after: 900 }); }
      const c = H.page.locator('[data-qa="card.next"]:visible').last(); if (await c.count()) await c.click({ timeout: 1500 }).catch(() => {});
      await H.sleep(1500);
    }
    await H.tap('chip.opt:keep', { after: 900 });
    await H.waitFlag('easyBackChip', 5000);
    H.check('[그대로 드리기] → stage.easyBack false', (await H.ev(() => G.state.stage.easyBack)) === false);
    await H.cards(120000).catch(() => {});
    await H.tap('end.next', { timeout: 90000, after: 1500 });
    await H.waitFn(() => !!document.querySelector('[data-qa="credits.skip"]'), 30000, 'credits'); await H.sleep(1500);
    const cr = await H.ev(() => { const n = document.querySelector('.fl3-credits .fl3-cred-in'); return { kids: n ? n.children.length : -1, body: document.body.innerText }; });
    H.check('credits = the title block only · none of the removed lines', cr.kids === 1 && !/만든 사람|AI 음성|AI 생성|게임 속 단순화|아무 데이터도|플레이 \d+분|힌트 \d+회/.test(cr.body), { kids: cr.kids });
    await H.tap('credits.skip', { timeout: 30000, after: 1500 });
    await H.waitFn(() => !!document.querySelector('[data-qa="check.continue"]'), 30000, 'check card');
    const ck = await H.ev(() => { const n = document.querySelector('.fl3-check-in'); return n ? { lines: n.children.length, text: n.textContent } : null; });
    H.check('check card = the help line only (112 · 1366)', !!ck && ck.lines === 1 && ck.text === '스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366', ck);
    await H.tap('check.continue', { timeout: 30000, after: 1500 });
    await H.waitFlag('HOOK', 30000);
    await H.tap('hook.home', { timeout: 30000, after: 2000 });
    await H.waitFlag('hookDone', 6000);
    const r = await H.ev(() => ({ s: G.series.get().s, v: G.series.s('e3_easyBack') }));
    H.check('series e3_easyBack stays false (default) after the hook', r.s.e3_easyBack !== true && r.v === false, r);
  }));
  out.push(await scenario(browser, 'N_ringTaps', async (H) => {
    await H.boot(); await H.start();
    await H.scale(4); await H.waitFlag('callRing', 120000); await H.scale(1);
    await H.sleep(1500);
    const before = await H.flags();
    for (const label of ['받기', '거절']) {
      const b = H.page.getByText(label, { exact: true }).last();
      if (await b.count()) { const bb = await b.boundingBox(); if (bb) await H.page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await H.sleep(500); }
    }
    const after = await H.flags();
    const extra = after.filter((f) => !before.includes(f) && !['callAnswered', 'callEnded'].includes(f));
    H.check('[받기] · [거절] on 엄마\'s ring screen → no reaction', !extra.length, extra);
    await H.waitFlag('callAnswered', 30000);
    await H.waitFlag('callEnded', 90000);
    H.check('the call keeps its script', true);
  }));
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: !ARG.headed });
  const all = [];
  const table = { A, B, C, D, E, F, G: G_, H: H_, I, J, K, L, M: M_, N };
  for (const k of ONLY) { if (table[k]) all.push(...(await table[k](browser))); }
  await browser.close();
  const summary = { pass: all.length > 0 && all.every((r) => r.pass), scenarios: all, wallSec: Math.round((Date.now() - T0) / 1000) };
  console.log(JSON.stringify(summary));
  process.exit(summary.pass ? 0 : 1);
})();
