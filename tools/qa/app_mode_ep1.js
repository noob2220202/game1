/* =========================================================
 * tools/qa/app_mode_ep1.js — the app-store build switch for EPISODE 1 (root index.html · js/core/base.js G.APP).
 *
 *   NODE_PATH=<global node_modules> node tools/qa/app_mode_ep1.js [--only=a,b,c] [--out=<shot dir>] [--headed]
 *
 * Why a sibling of tools/qa/app_mode.js instead of an EPS entry there: that runner is ep2-shaped (data-qa taps, the
 * haru.jump debug route to the credits, ?debug=1 → G.DEBUG, the post-credits check card / endStep), none of which ep1
 * has, so an ep1 entry would need runner changes in a file another owner edits. Same rules otherwise: Chromium,
 * file:// URLs, js/config.js route-fulfilled with a key flipped for the app build, 0 page errors per run.
 * ep1's rule (js/core/base.js, same as ep2/js/config.ep2.js): G.APP = CONFIG.APP === true, or ?app=1 off the release
 * host; the real build (CONFIG.APP === true) forces G.DEBUG off and leaves out window.haru and G.climax.debug; under
 * G.APP no body.debug (hotspot outlines) and the climax hold hint has no '(PC: …)' aside.
 *   a1 web            as shipped     G.APP false · window.haru + G.climax.debug present · no body.debug · no title footer ·
 *                                    intro → PIN → climax hold hint (G.climax.debug.jump('hide')) keeps the PC aside
 *   a2 web            DEBUG: true    body.debug + dashed hotspot outlines in the lock-screen camera (proves the probes)
 *   a3 web            END save       엔딩 다시 보기 → credits = the title only, centred (|dx|, |dy| ≤ 4 px)
 *   b  app preview    ?app=1, DEBUG: true   G.APP true · G.DEBUG true · window.haru kept · no body.debug · no outlines ·
 *                                    '🔒 잠금 상태' · hold hint without the PC aside
 *   c1 app build      APP: true      G.APP true · G.DEBUG false · no window.haru / G.climax.debug / body.debug · title 설정
 *                                    (목소리 + the one AI-voice line) → warning (one line + 수첩 pointer) → setup (one
 *                                    instruction line) → cold open → lock-screen camera without outlines
 *   c2 app build      APP + DEBUG    G.DEBUG still false · no window.haru · no body.debug
 *   c3 app build      END save       credits = the title only, centred; none of the removed credit lines in the page
 *   d1 web            KakaoTalk UA   the in-app browser card shows (web only, O2) · 그냥 할래요 removes it
 *   d2 app preview    KakaoTalk UA, ?app=1   no in-app browser card under G.APP
 *   d3 app build      KakaoTalk UA, APP: true   no in-app browser card under G.APP
 * Screenshots → <out> (default work/qa/appmode) as ep1_<run>_<name>.png. Exit 0 = every check passed; JSON summary last.
 * ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(ARG.out && ARG.out !== true ? String(ARG.out) : path.join(ROOT, 'work', 'qa', 'appmode'));
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (ARG.only ? String(ARG.only) : 'a,b,c,d').toLowerCase().split(',');
const URL1 = 'file:///' + path.join(ROOT, 'index.html').split(path.sep).join('/');
const CENTRE_TOL = 4;
const T_START = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T_START) / 1000).toFixed(1) + 's]').padEnd(9), ...a);
const KAKAO_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.5';
const INAPP = "카카오톡 안에서는 소리·진동이 제대로 동작하지 않아요. 오른쪽 위 ⋯ → '다른 브라우저로 열기'를 눌러 주세요.";
const HINT = '아무 곳이나 누르고 있으면 화면이 꺼져요 · 손을 떼면 빛이 새어 나가요';
const GONE = ['기획·제작', 'AI 생성', '직접 합성', '목소리: AI', '아무 데이터도', '어떤 데이터도', '이 게임'];   // removed credit / meta lines
// a minimal ep1 save at the end (js/core/base.js fresh() shape): the title offers 엔딩 다시 보기 → SC.ending(true)
const END_SAVE = JSON.stringify({ v: 1, flags: { introDone: 1, M1: 1, END: 1 }, vars: {}, playMs: 60000, hintsUsed: 0, hints: {}, threads: {}, notifs: [], read: {}, fragments: {}, seen: {}, startedAt: Date.now() });

async function run(browser, label, opts, fn) {
  log('▶ ' + label);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...(opts.ua ? { userAgent: opts.ua } : {}) });
  if (opts.save) await ctx.addInitScript((v) => { try { if (!sessionStorage.getItem('qa.seeded')) { sessionStorage.setItem('qa.seeded', '1'); localStorage.setItem('haru-escape.save.v1', v); } } catch (e) {} }, opts.save);
  const page = await ctx.newPage();
  const errors = [];
  let live = true;
  page.on('pageerror', (e) => { if (live) errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)); });
  page.on('console', (m) => { if (live && m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300) + ' @' + ((m.location() || {}).url || '').replace(/.*game1/, '') + ':' + ((m.location() || {}).lineNumber)); });
  page.on('requestfailed', (r) => { const u = r.url(); if (!live || /fonts\.(googleapis|gstatic)|cdn\.jsdelivr|cdnjs/.test(u)) return; errors.push('REQFAIL ' + u.replace(/.*game1/, '') + ' ' + ((r.failure() && r.failure().errorText) || '')); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  if (opts.config) {
    // js/config.js exactly as on disk with the given keys (written `KEY: false,`) flipped to true
    let body = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'), n = 0;
    Object.keys(opts.config).forEach((k) => { const re = new RegExp('^(\\s*' + k + ':\\s*)false,', 'm'); if (re.test(body)) { body = body.replace(re, '$1' + opts.config[k] + ','); n++; } });
    if (n !== Object.keys(opts.config).length) throw new Error('js/config.js: key(s) not found as `KEY: false,` — ' + Object.keys(opts.config).join(', '));
    await page.route('**/js/config.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body }));
  }
  const res = { label, checks: [], errors };
  const check = (name, ok, info) => { res.checks.push({ name, ok: !!ok, info: ok ? undefined : info }); log((ok ? '  ok   ' : '  FAIL ') + name + (!ok && info !== undefined ? '  ' + JSON.stringify(info).slice(0, 300) : '')); return !!ok; };
  const H = helpers(page, label);
  try { await fn(H, check); } catch (e) { check('run: ' + e.message.split('\n')[0], false); await H.shot('FAIL'); }
  await page.waitForTimeout(300);
  live = false;
  check('0 page errors / console errors / failed requests', errors.length === 0, errors.slice(0, 8));
  await ctx.close();
  return res;
}

function helpers(page, label) {
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const vis = (sel, text) => (text ? page.locator(sel, { hasText: text }) : page.locator(sel)).filter({ visible: true }).last();
  async function tap(sel, text, o) { o = o || {}; const l = vis(sel, text); await l.waitFor({ state: 'visible', timeout: o.timeout || 15000 }); await l.click({ timeout: 8000 }); await sleep(o.after == null ? 600 : o.after); }
  async function shot(name) { const f = path.join(OUT, 'ep1_' + label + '_' + name.replace(/[^a-z0-9_.-]+/gi, '_') + '.png'); try { await page.screenshot({ path: f }); } catch (e) { log('shot failed', e.message); } return f; }
  const state = () => ev(() => ({ app: window.G && G.APP, build: window.G && G.APP_BUILD, debug: window.G && G.DEBUG, cfgApp: window.CONFIG && window.CONFIG.APP, cfgDebug: window.CONFIG && window.CONFIG.DEBUG,
    haru: typeof window.haru !== 'undefined', cxDebug: !!(window.G && G.climax && G.climax.debug), bodyDebug: document.body.classList.contains('debug') }));
  async function boot() {
    await page.goto(URL1, { waitUntil: 'load' });
    await page.waitForSelector('.title-screen .title-btn', { timeout: 20000 });
    await sleep(900);
  }
  /** title → 시작하기 → 알겠어요 → (ear test) → 시작 → cold open → hold → lock screen at 3:33 */
  async function intro(o) {
    o = o || {};
    await tap('.title-screen button', '시작하기', { after: 1000 });
    if (o.onWarn) await o.onWarn();
    await tap('.title-screen button', '알겠어요', { after: 1200 });
    if (o.ear) { await tap('.title-screen button', '테스트', { after: 1300 }); await tap('.title-screen button', '왼쪽', { after: 1300 }); await tap('.title-screen button', '오른쪽', { after: 900 }); }
    if (o.onSetup) await o.onSetup();
    await page.locator('.title-screen button.title-btn.primary', { hasText: '시작' }).filter({ visible: true }).last().click();
    const reach = page.locator('button.cine-reach');
    await reach.waitFor({ state: 'visible', timeout: 40000 });
    await sleep(800);
    const b = await reach.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await sleep(900); await page.mouse.up();
    await page.waitForFunction(() => window.G && G.state && G.state.flags && G.state.flags.introDone, null, { timeout: 15000 });
    await sleep(1800);
  }
  async function unlock() {
    await page.mouse.click(180, 330); await sleep(900);
    if (!(await page.locator('button.pin-key').filter({ visible: true }).count())) { await page.mouse.click(180, 300); await sleep(900); }
    for (const k of '0317') { await page.locator(`button.pin-key[aria-label="${k}"]`).filter({ visible: true }).first().click(); await sleep(160); }
    await page.waitForFunction(() => G.state.flags.M1, null, { timeout: 8000 });
    await sleep(1500);
  }
  /** the lock-screen camera (G.camera.rear({mode:'lockscreen'})): its hotspots, their outline style, the lock note */
  async function lockCamera() {
    await tap('button.lock-round.cam', null, { after: 1800 });
    return ev(() => {
      const spots = [...document.querySelectorAll('.rv-spot')];
      return { spots: spots.length, dashed: spots.filter((n) => getComputedStyle(n).outlineStyle === 'dashed').length, note: (document.querySelector('.room-locknote') || {}).textContent || null, bodyDebug: document.body.classList.contains('debug') };
    });
  }
  /** climax hold hint via the QA jump (G.climax.debug — web and ?app=1 preview only) */
  async function holdHint() {
    await ev(() => G.climax.debug.jump('hide'));
    await page.waitForSelector('.cx-hide-s', { timeout: 20000 });
    await sleep(900);
    return ev(() => document.querySelector('.cx-hide-s').textContent);
  }
  /** 엔딩 다시 보기 (seeded END save) → notif → mail → chat → card → credits: children, text, centring */
  async function credits() {
    await tap('.title-screen button', '엔딩 다시 보기', { after: 1500 });
    await tap('.end-notif', null, { timeout: 30000, after: 1500 });
    await tap('button.end-next', '엄마에게 보여주기', { timeout: 20000, after: 1500 });
    await tap('.end-chat button.end-next', '계속', { timeout: 60000, after: 1500 });
    await tap('.end-card button.end-next', '계속', { timeout: 40000, after: 600 });
    await page.waitForSelector('.end-credits', { timeout: 15000 });
    await sleep(1800);   // the .8 s fade-in has ended — boxes are final
    return ev(() => {
      const s = document.querySelector('.end-credits'), t = s.querySelector('.ecr-title');
      const a = s.getBoundingClientRect(), c = t ? t.getBoundingClientRect() : null;
      return { kids: [...s.children].map((k) => k.className), text: s.innerText.replace(/\s+/g, ' ').trim(), body: document.body.innerText,
        dx: c ? (c.left + c.width / 2) - (a.left + a.width / 2) : null, dy: c ? (c.top + c.height / 2) - (a.top + a.height / 2) : null };
    });
  }
  return { page, sleep, ev, tap, shot, state, boot, intro, unlock, lockCamera, holdHint, credits };
}

const creditChecks = (check, c, tag) => {
  check(tag + ': credits = the title only', c && c.kids.length === 1 && c.kids[0] === 'ecr-title' && /위한 방탈출!/.test(c.text), c && { kids: c.kids, text: c.text });
  check(tag + ': title centred (dx ' + (c && c.dx != null ? c.dx.toFixed(2) : '?') + ', dy ' + (c && c.dy != null ? c.dy.toFixed(2) : '?') + ')', c && c.dx != null && Math.abs(c.dx) <= CENTRE_TOL && Math.abs(c.dy) <= CENTRE_TOL, c && { dx: c.dx, dy: c.dy });
  const hits = c ? GONE.filter((w) => c.body.indexOf(w) >= 0) : ['(no credits)'];
  check(tag + ': none of the removed credit lines in the page', hits.length === 0, hits);
};

(async () => {
  const browser = await chromium.launch({ headless: !ARG.headed, args: ['--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  try {
    if (ONLY.includes('a')) {
      results.push(await run(browser, 'a1_web', {}, async (H, check) => {
        await H.boot();
        const s = await H.state();
        check('G.APP false · G.APP_BUILD false · G.DEBUG false (CONFIG as shipped)', s.app === false && s.build === false && s.debug === false && s.cfgApp === false, s);
        check('web keeps window.haru + G.climax.debug · no body.debug', s.haru && s.cxDebug && !s.bodyDebug, s);
        check('title: no footer', await H.ev(() => !document.querySelector('.title-foot') && !document.querySelector('.desk-hint')));
        await H.shot('title');
        await H.intro();
        await H.unlock();
        const hint = await H.holdHint();
        check("climax hold hint keeps the web '(PC: 마우스 또는 Space)' aside", hint === HINT + ' (PC: 마우스 또는 Space)', hint);
        await H.shot('hold_hint');
      }));
      results.push(await run(browser, 'a2_web_debug', { config: { DEBUG: true } }, async (H, check) => {
        await H.boot();
        const s = await H.state();
        check('CONFIG.DEBUG true on the web → G.DEBUG true · body.debug', s.cfgDebug === true && s.debug === true && s.app === false && s.bodyDebug, s);
        await H.intro();
        const cam = await H.lockCamera();
        check('web debug shows dashed hotspot outlines (probe sanity)', cam.spots > 0 && cam.dashed > 0, cam);
        await H.shot('lock_camera');
      }));
      results.push(await run(browser, 'a3_web_credits', { save: END_SAVE }, async (H, check) => {
        await H.boot();
        const c = await H.credits();
        creditChecks(check, c, 'web');
        await H.shot('credits');
      }));
    }
    if (ONLY.includes('b')) {
      results.push(await run(browser, 'b_app_preview', { config: { DEBUG: true } }, async (H, check) => {
        await H.page.goto(URL1 + '?app=1', { waitUntil: 'load' });
        await H.page.waitForSelector('.title-screen .title-btn', { timeout: 20000 });
        await H.sleep(900);
        const s = await H.state();
        check('?app=1 → G.APP true · G.APP_BUILD false · G.DEBUG true (preview keeps the helpers)', s.app === true && s.build === false && s.debug === true && s.haru && s.cxDebug, s);
        check('no body.debug under G.APP', !s.bodyDebug, s);
        await H.intro();
        const cam = await H.lockCamera();
        check("lock-screen camera: hotspots without outlines · note '🔒 잠금 상태'", cam.spots > 0 && cam.dashed === 0 && !cam.bodyDebug && cam.note === '🔒 잠금 상태', cam);
        await H.shot('lock_camera');
        await H.page.locator('.cam-close').filter({ visible: true }).last().click(); await H.sleep(900);
        await H.unlock();
        const hint = await H.holdHint();
        check("climax hold hint without the '(PC: …)' aside", hint === HINT, hint);
        await H.shot('hold_hint');
      }));
    }
    if (ONLY.includes('c')) {
      results.push(await run(browser, 'c1_app_build', { config: { APP: true } }, async (H, check) => {
        await H.boot();
        const s = await H.state();
        check('CONFIG.APP true → G.APP true · G.APP_BUILD true · G.DEBUG false', s.cfgApp === true && s.app === true && s.build === true && s.debug === false, s);
        check('no window.haru · no G.climax.debug · no body.debug', !s.haru && !s.cxDebug && !s.bodyDebug, s);
        check('title: no footer', await H.ev(() => !document.querySelector('.title-foot')));
        await H.tap('.title-screen button', '설정', { after: 900 });
        const o = await H.ev(() => { const k = [...document.querySelectorAll('.title-screen .title-kicker')].find((n) => n.textContent === 'SETTINGS'); const p = k && k.parentNode; return p ? { rows: [...p.querySelectorAll('.opt-row > span:first-child')].map((n) => n.firstChild.textContent), notes: [...p.querySelectorAll('.opt-note')].map((n) => n.textContent), ai: (document.body.innerText.match(/AI 음성/g) || []).length } : null; });
        check("설정: '목소리' + exactly one '목소리는 AI 음성입니다.'", o && o.rows.includes('목소리') && JSON.stringify(o.notes) === JSON.stringify(['목소리는 AI 음성입니다.']) && o.ai === 1, o);
        await H.shot('settings');
        await H.tap('.title-screen button', '닫기', { after: 700 });
        await H.intro({
          ear: true,
          onWarn: async () => {
            const w = await H.ev(() => ((document.querySelector('.title-screen .warn-box') || {}).innerText || '').replace(/\s+/g, ' ').trim());
            check('warning: one line + the 수첩 pointer', w === '공포 연출과 스토킹·실종 소재가 있습니다. 📓 힌트는 오른쪽 위 수첩에 있어요.', w);
            await H.shot('warning');
          },
          onSetup: async () => {
            const t = await H.ev(() => [...document.querySelectorAll('.title-screen')].pop().innerText.replace(/\s+/g, ' ').trim());
            check('setup: the ear test row with one instruction line only', t === 'SETUP 몰입 설정 🎧 이어폰 테스트 이어폰을 끼고 눌러 주세요 ✓ 이어폰 시작', t);
            await H.shot('setup');
          },
        });
        const cam = await H.lockCamera();
        check('lock-screen camera: no outlines · no body.debug', cam.spots > 0 && cam.dashed === 0 && !cam.bodyDebug && cam.note === '🔒 잠금 상태', cam);
        check('still no window.haru after the cold open', await H.ev(() => typeof window.haru === 'undefined'));
        await H.shot('lock_camera');
      }));
      results.push(await run(browser, 'c2_app_build_debug_config', { config: { APP: true, DEBUG: true } }, async (H, check) => {
        await H.boot();
        const s = await H.state();
        check('CONFIG.APP + CONFIG.DEBUG true → G.DEBUG false · no window.haru · no G.climax.debug · no body.debug', s.cfgDebug === true && s.app === true && s.debug === false && !s.haru && !s.cxDebug && !s.bodyDebug, s);
      }));
      results.push(await run(browser, 'c3_app_build_credits', { config: { APP: true }, save: END_SAVE }, async (H, check) => {
        await H.boot();
        const c = await H.credits();
        creditChecks(check, c, 'app build');
        await H.shot('credits');
      }));
    }
    if (ONLY.includes('d')) {
      // the in-app browser card (js/main.js): web only (O2), never under G.APP — same rule as ep2
      const card = (H) => H.ev(() => [...document.querySelectorAll('.title-screen .warn-box')].map((n) => n.innerText.replace(/\s+/g, ' ').trim()).filter((t) => /다른 브라우저로 열기/.test(t)));
      results.push(await run(browser, 'd1_web_inapp', { ua: KAKAO_UA }, async (H, check) => {
        await H.boot();
        const s = await H.state(), c = await card(H);
        check('web + KakaoTalk UA: G.APP false · the in-app card shows, text as shipped', s.app === false && c.length === 1 && c[0] === INAPP, { s, c });
        await H.shot('inapp_card');
        await H.tap('.title-screen button', '그냥 할래요', { after: 600 });
        check('그냥 할래요 removes the card', (await card(H)).length === 0);
      }));
      results.push(await run(browser, 'd2_app_preview_inapp', { ua: KAKAO_UA }, async (H, check) => {
        await H.page.goto(URL1 + '?app=1', { waitUntil: 'load' });
        await H.page.waitForSelector('.title-screen .title-btn', { timeout: 20000 });
        await H.sleep(900);
        const s = await H.state(), c = await card(H);
        check('?app=1 + KakaoTalk UA: G.APP true · no in-app card', s.app === true && c.length === 0, { s, c });
      }));
      results.push(await run(browser, 'd3_app_build_inapp', { ua: KAKAO_UA, config: { APP: true } }, async (H, check) => {
        await H.boot();
        const s = await H.state(), c = await card(H);
        check('CONFIG.APP + KakaoTalk UA: G.APP true · no in-app card', s.app === true && s.build === true && c.length === 0, { s, c });
        await H.shot('no_inapp_card');
      }));
    }
  } catch (e) {
    results.push({ label: 'driver', errors: [], checks: [{ name: 'driver: ' + e.message.split('\n')[0], ok: false }] });
  }
  await browser.close();
  const failed = [];
  results.forEach((r) => r.checks.forEach((c) => { if (!c.ok) failed.push(r.label + ': ' + c.name); }));
  const pass = results.length > 0 && failed.length === 0;
  log(pass ? 'PASS' : 'FAIL (' + failed.length + ')');
  failed.forEach((f) => log('  ✗ ' + f));
  console.log(JSON.stringify({ pass, ep: 1, runs: results.map((r) => ({ label: r.label, checks: r.checks.length, failed: r.checks.filter((c) => !c.ok).length, errors: r.errors.length })), failed, shots: OUT, wallSec: Math.round((Date.now() - T_START) / 1000) }));
  process.exit(pass ? 0 : 1);
})();
