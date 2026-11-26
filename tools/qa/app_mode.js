/* =========================================================
 * tools/qa/app_mode.js — the app-store build switch (docs/APP_RELEASE.md · js/config.js APP · G.APP) end to end.
 *
 *   NODE_PATH=<global node_modules> node tools/qa/app_mode.js [--ep=2] [--only=a,b,c] [--baseline=<checkout>] [--headed]
 *
 * Plays file:///…/<episode page> in Chromium with the 'iPhone 13' profile (same launch / ROOT rules as ep2_speedrun.js).
 * The credits are reached through the episode's debug route (EPS[ep].toCredits — ep2: haru.jump('END') with the 02:20
 * step marked done, so ending.resume runs credits() at once).
 *   a  web          ?debug=1        credits = title + maker + voice + stats + data, texts as shipped; the debug meter,
 *                                   error lines and hotspot outlines DO show (proves the b/c probes can see them).
 *                                   --baseline=<checkout> also compares the credits scene's HTML with that checkout's.
 *   b  app preview  ?app=1&debug=1  credits = the title block only; none of the four lines (names substituted) anywhere in
 *                                   document.body.innerText; no debug meter / error lines / hotspot outlines / body.debug;
 *                                   title block centred in the scene (|dx|, |dy| ≤ 4 px) at 360×740 · 390×844 · 430×932,
 *                                   each at text size 1 and 1.3 (G.settings.textSize → G.saveSettings() → --ts);
 *                                   tap → check card as before.
 *   c  app build    js/config.js served with APP: true (route-fulfil of the real file, the key flipped), ?debug=1:
 *                   c1  G.DEBUG false · no window.haru · no series _fixture / skipTo / debugM8 / _scale / meter / roomLook
 *                       / budget · ?jump= and ?series= ignored · title → warning → ear test → cold open → eye view without
 *                       meter or outlines
 *                   c2  APP: true + DEBUG: true → G.DEBUG still false, no window.haru
 *                   c3  b's END save → 이어하기 → credits = the title block only, centred, tap → check card
 *   d  every run: 0 pageerrors / console errors / failed requests.
 * Screenshots → work/qa/appmode/. Exit 0 = every check passed. JSON summary on the last line.
 * Adding an episode = one EPS entry (page, save key, debug route to its credits, selectors, the four lines, boot taps).
 * ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'work', 'qa', 'appmode');
fs.mkdirSync(OUT, { recursive: true });
const EP = String(ARG.ep || '2');
const ONLY = (ARG.only ? String(ARG.only) : 'a,b,c').toLowerCase().split(',');
const BASELINE = ARG.baseline && ARG.baseline !== true ? path.resolve(String(ARG.baseline)) : null;
const fileUrl = (root, rel) => 'file:///' + path.join(root, rel).split(path.sep).join('/');

const T_START = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T_START) / 1000).toFixed(1) + 's]').padEnd(9), ...a);

const VIEWS = [[360, 740], [390, 844], [430, 932]];
const SIZES = [1, 1.3];
const CENTRE_TOL = 4;

/* ---------- per-episode data (ep3: add one entry) ---------- */
const EPS = {
  2: {
    page: 'ep2/index.html',
    saveKey: 'haru-escape.ep2.save.v1',
    // debug route: the END state with the 02:20 letter step done → G.main.resumeFrom → G.ending.resume('l0220') → credits()
    toCredits: () => { G.vars('endStep', 'l0220'); return window.haru.jump('END'); },
    sel: { scene: '.fl2-credits', inner: '.fl2-cred-in', title: '.fl2-cred-title', skip: 'credits.skip', next: 'check.continue', cont: 'title.continue', start: 'title.start' },
    webKids: ['fl2-cred-title', 'fl2-cred-maker', 'fl2-check-help', 'small', 'dim'],   // class of each credits child, in order
    // the four circled lines as the page renders them (ep2/js/ending.js credits()) — evaluated in the page
    lines: () => {
      const c = (G.STORY && G.STORY.ending && G.STORY.ending.credits) || {};
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { maker: G.T(c.maker || '만든 사람 {MAKER} · {N}에게'), voice: c.voice || '', data: c.data || '',
        statsRe: esc(String(c.stats || '플레이 {m}분 · 힌트 {n}회')).replace('\\{m\\}', '\\d+').replace('\\{n\\}', '\\d+') };
    },
    boot: [['title.start', 450], ['warn.ok', 1200], ['ear.left', 1200], ['ear.right', 900], ['ear.start', 1500]],
    afterBoot: 'recap.skip',                 // optional tap (shown without an ep1 save)
    eyeView: 'room.spot:door',               // first eye view after the cold open
    debugUI: ['.c2-debug-meter', '.c2-debug-err', '[data-qa="debug.meter"]'],
    outlineRoot: '.rm2-debug', spots: '.rv-spot, .rm2-outside',
    roomProbe: () => { const a = window.haru.room('r2_door'); return !!a; },   // DEBUG helper: a camera view with hotspots
    // debug-only APIs that must not exist in the app build (G.APP ∧ ¬G.DEBUG)
    stripped: ['window.haru', 'G.series._fixture', 'G.ending.debugM8', 'G.clock._scale', 'G.audio.meter', 'G.fx.roomLook', 'G.e2.budget'],
  },
};
const E = EPS[EP];
if (!E) { console.error('unknown --ep=' + EP + ' (known: ' + Object.keys(EPS).join(', ') + ')'); process.exit(2); }

/* ---------- one browser context per run ---------- */
async function run(browser, label, opts, fn) {
  log('▶ ' + label);
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  let live = true;
  page.on('pageerror', (e) => { if (live) errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)); });
  page.on('console', (m) => { if (live && m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 300) + ' @' + (m.location().url || '').replace(/.*game1/, '') + ':' + m.location().lineNumber); });
  page.on('requestfailed', (r) => { if (live) errors.push('REQFAIL ' + r.url().replace(/.*game1/, '') + ' ' + ((r.failure() && r.failure().errorText) || '')); });
  if (opts.config) {
    // the real app build: js/config.js exactly as on disk with the APP key (and optionally DEBUG) flipped to true
    const src = fs.readFileSync(path.join(opts.root || ROOT, 'js', 'config.js'), 'utf8');
    let body = src, n = 0;
    Object.keys(opts.config).forEach((k) => {
      const re = new RegExp('^(\\s*' + k + ':\\s*)false,', 'm');
      if (re.test(body)) { body = body.replace(re, '$1' + opts.config[k] + ','); n++; }
    });
    if (n !== Object.keys(opts.config).length) throw new Error('js/config.js: key(s) not found as `KEY: false,` — ' + Object.keys(opts.config).join(', '));
    await page.route('**/js/config.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body }));
  }
  const res = { label, checks: [], errors };
  const check = (name, ok, info) => {
    res.checks.push({ name, ok: !!ok, info: ok ? undefined : info });
    log((ok ? '  ok   ' : '  FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 300) : ''));
    return !!ok;
  };
  const H = helpers(page, label);
  try { await fn(H, check, res); }
  catch (e) { check('run: ' + e.message.split('\n')[0], false); await H.shot('FAIL'); }
  await page.waitForTimeout(300);
  live = false;
  check('0 page errors / console errors / failed requests', errors.length === 0, errors.slice(0, 8));
  await ctx.close();
  return res;
}

function helpers(page, label) {
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const loc = (v) => page.locator(`[data-qa="${v}"]:visible`).last();
  async function tap(v, o) {
    o = o || {};
    const l = loc(v);
    await l.waitFor({ state: 'visible', timeout: o.timeout || 15000 });
    await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await l.click({ timeout: o.timeout || 15000 });
    await sleep(o.after == null ? 450 : o.after);
  }
  async function tapIf(v, ms) { try { await tap(v, { timeout: ms || 1500 }); return true; } catch (e) { return false; } }
  async function shot(name) {
    const f = path.join(OUT, 'ep' + EP + '_' + label + '_' + name.replace(/[^a-z0-9_.-]+/gi, '_') + '.png');
    try { await page.screenshot({ path: f }); } catch (e) { log('shot failed', e.message); }
    return f;
  }
  /** the credits scene as the player sees it: children, texts, debug UI, centring */
  const scene = () => ev((E) => {
    const s = document.querySelector(E.sel.scene);
    if (!s) return null;
    const inner = s.querySelector(E.sel.inner), t = s.querySelector(E.sel.title);
    const a = s.getBoundingClientRect(), c = t ? t.getBoundingClientRect() : null;
    return {
      cls: s.className, html: s.outerHTML,
      kids: inner ? [...inner.children].map((k) => ({ cls: k.className, text: k.textContent })) : [],
      dx: c ? (c.left + c.width / 2) - (a.left + a.width / 2) : null, dy: c ? (c.top + c.height / 2) - (a.top + a.height / 2) : null,
      scene: [Math.round(a.width), Math.round(a.height)], titleBox: c ? [Math.round(c.width), Math.round(c.height)] : null,
    };
  }, { sel: E.sel });
  const debugState = () => ev((E) => {
    const vis = (n) => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const ui = E.debugUI.map((q) => ({ q, n: document.querySelectorAll(q).length, vis: [...document.querySelectorAll(q)].filter(vis).length, text: [...document.querySelectorAll(q)].map((n) => n.textContent).join(' | ').slice(0, 160) }));
    const spots = [...document.querySelectorAll(E.spots)];
    return { ui, outlineRoots: document.querySelectorAll(E.outlineRoot).length, bodyDebug: document.body.classList.contains('debug'),
      spots: spots.length, dashed: spots.filter((n) => getComputedStyle(n).outlineStyle === 'dashed').length };
  }, { debugUI: E.debugUI, spots: E.spots, outlineRoot: E.outlineRoot });
  return { page, sleep, ev, loc, tap, tapIf, shot, scene, debugState };
}

async function waitScene(H, ms) {
  await H.page.waitForSelector(E.sel.scene, { timeout: ms || 20000 });
  await H.sleep(2700);   // the title's rise animation (2.4 s) has ended — boxes are final
}
async function bodyHits(H, L) {
  return H.ev((L) => {
    const txt = document.body.innerText;
    const out = [];
    ['maker', 'voice', 'data'].forEach((k) => { if (L[k] && txt.indexOf(L[k]) >= 0) out.push(k + ': ' + L[k]); });
    const m = new RegExp(L.statsRe).exec(txt); if (m) out.push('stats: ' + m[0]);
    ['AI 음성', 'AI 생성', '만든 사람', '아무 데이터도'].forEach((w) => { if (txt.indexOf(w) >= 0) out.push('fragment: ' + w); });
    return out;
  }, L);
}

/* ---------- a · web ---------- */
async function webRun(browser, root, tag) {
  let html = null;
  const r = await run(browser, tag, { root }, async (H, check) => {
    await H.page.goto(fileUrl(root, E.page) + '?debug=1');
    await H.loc(E.sel.start).waitFor({ state: 'visible', timeout: 20000 });
    check('G.APP off · G.DEBUG true on ?debug=1', await H.ev(() => G.APP !== true && G.DEBUG === true), await H.ev(() => [G.APP, G.DEBUG]));   // the baseline has no G.APP at all
    check('body.debug class (web, as before)', await H.ev(() => document.body.classList.contains('debug')));
    check('room probe opens a camera view', await H.ev(E.roomProbe));
    await H.sleep(800);
    const d0 = await H.debugState();
    check('web shows hotspot outlines (probe sanity)', d0.outlineRoots > 0 && d0.dashed > 0, d0);
    check('debug route to the credits', await H.ev(E.toCredits));
    await waitScene(H);
    const s = await H.scene();
    const L = await H.ev(E.lines);
    html = s.html;
    check('credits children = ' + E.webKids.join(' · '), s.kids.length === E.webKids.length && E.webKids.every((c, i) => s.kids[i].cls.split(/\s+/).includes(c)), s.kids.map((k) => k.cls));
    check('scene class unchanged (no .app)', !/\bapp\b/.test(s.cls), s.cls);
    if (s.kids.length === E.webKids.length) {
      check('maker line', s.kids[1].text === L.maker, s.kids[1].text);
      check('voice line', s.kids[2].text === L.voice, s.kids[2].text);
      check('stats line', new RegExp('^' + L.statsRe + '$').test(s.kids[3].text), s.kids[3].text);
      check('data line', s.kids[4].text === L.data, s.kids[4].text);
    }
    await H.ev(() => window.dispatchEvent(new ErrorEvent('error', { message: 'app_mode.js overlay probe' })));
    await H.sleep(2500);
    const d1 = await H.debugState();
    check('web shows the debug meter (probe sanity)', d1.ui[0].vis > 0 && /his \d+\/25/.test(d1.ui[0].text), d1.ui);
    check('web shows the error overlay line (probe sanity)', d1.ui[1].n > 0 && /overlay probe/.test(d1.ui[1].text), d1.ui);
    await H.shot('credits');
  });
  return { r, html };
}

/* ---------- b · app preview ---------- */
async function appPreviewRun(browser) {
  let save = null;
  const r = await run(browser, 'b_app_preview', {}, async (H, check) => {
    await H.page.goto(fileUrl(ROOT, E.page) + '?debug=1&app=1');
    await H.loc(E.sel.start).waitFor({ state: 'visible', timeout: 20000 });
    check('G.APP true · G.DEBUG true on ?app=1&debug=1 (preview keeps the jump helpers)', await H.ev(() => G.APP === true && G.DEBUG === true && !!window.haru), await H.ev(() => [G.APP, G.DEBUG, !!window.haru]));
    check('no body.debug class', !(await H.ev(() => document.body.classList.contains('debug'))));
    check('room probe opens a camera view', await H.ev(E.roomProbe));
    await H.sleep(800);
    const d0 = await H.debugState();
    check('no hotspot outlines on the room', d0.spots > 0 && d0.outlineRoots === 0 && d0.dashed === 0, d0);
    check('debug route to the credits', await H.ev(E.toCredits));
    save = await H.ev((k) => localStorage.getItem(k), E.saveKey);
    await waitScene(H);
    const L = await H.ev(E.lines);
    // centring first — the scene times out after d.ms of game time
    for (const [w, h] of VIEWS) {
      await H.page.setViewportSize({ width: w, height: h });
      for (const ts of SIZES) {
        await H.ev((v) => { G.settings.textSize = v; G.saveSettings(); }, ts);
        await H.ev(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
        await H.sleep(150);
        const cur = await H.ev(() => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim());
        const s = await H.scene();
        const tag = w + 'x' + h + ' ts ' + ts;
        check('--ts = ' + ts + ' (' + tag + ')', Number(cur) === ts, cur);
        check('title block centred ' + tag + ' (dx ' + (s && s.dx != null ? s.dx.toFixed(2) : '?') + ', dy ' + (s && s.dy != null ? s.dy.toFixed(2) : '?') + ')',
          s && s.dx != null && Math.abs(s.dx) <= CENTRE_TOL && Math.abs(s.dy) <= CENTRE_TOL, s && { dx: s.dx, dy: s.dy, scene: s.scene, title: s.titleBox });
        log('       scene ' + s.scene.join('x') + ' · title ' + (s.titleBox || []).join('x'));
        await H.shot('credits_' + w + 'x' + h + '_ts' + String(ts).replace('.', ''));
      }
    }
    await H.page.setViewportSize({ width: 390, height: 844 });
    await H.ev(() => { G.settings.textSize = 1; G.saveSettings(); });
    const s = await H.scene();
    check('credits = the title block only', s.kids.length === 1 && s.kids[0].cls.split(/\s+/).includes(E.webKids[0]), s.kids.map((k) => k.cls));
    check('scene carries the .app class', /\bapp\b/.test(s.cls), s.cls);
    const hits = await bodyHits(H, L);
    check('none of the four lines in document.body.innerText', hits.length === 0, hits);
    await H.ev(() => window.dispatchEvent(new ErrorEvent('error', { message: 'app_mode.js overlay probe' })));
    await H.sleep(1500);
    const d1 = await H.debugState();
    check('no debug meter / error overlay element', d1.ui.every((u) => u.n === 0), d1.ui);
    check('no outlines · no body.debug', d1.outlineRoots === 0 && d1.dashed === 0 && !d1.bodyDebug, d1);
    await H.tap(E.sel.skip, { after: 900 });
    await H.loc(E.sel.next).waitFor({ state: 'visible', timeout: 8000 });
    check('tap → check card (endStep cred)', await H.ev(() => G.state.vars.endStep === 'cred'), await H.ev(() => G.state.vars.endStep));
    await H.shot('check_card');
  });
  return { r, save };
}

/* ---------- c · the real app build ---------- */
async function appBuildRuns(browser, save) {
  const out = [];
  out.push(await run(browser, 'c1_app_build', { config: { APP: true } }, async (H, check) => {
    await H.page.goto(fileUrl(ROOT, E.page) + '?debug=1&jump=END&series=S6');
    await H.loc(E.sel.start).waitFor({ state: 'visible', timeout: 20000 });
    check('CONFIG.APP true → G.APP true · G.DEBUG false (with ?debug=1)', await H.ev(() => window.CONFIG.APP === true && G.APP === true && G.DEBUG === false), await H.ev(() => [window.CONFIG.APP, G.APP, G.DEBUG]));
    const left = await H.ev((list) => list.filter((x) => { try { return Function('return typeof ' + x)() !== 'undefined' && Function('return ' + x)() !== undefined; } catch (e) { return false; } }), E.stripped);
    check('no debug helpers (' + E.stripped.join(' · ') + ')', left.length === 0, left);
    check('no body.debug class', !(await H.ev(() => document.body.classList.contains('debug'))));
    await H.sleep(1500);
    check('?jump= ignored (no END flag)', await H.ev(() => !(G.state && G.state.flags && G.state.flags.END)));
    check('?series= fixture ignored (real storage record)', await H.ev(() => !!(G.series && !G.series._fixture)));
    await H.shot('title');
    for (const [v, after] of E.boot) {
      await H.tap(v, { after });
      if (v === 'warn.ok' || v === 'ear.start') await H.shot(v);
    }
    if (E.afterBoot && (await H.tapIf(E.afterBoot, 2500))) log('  ' + E.afterBoot + ' tapped');
    await H.loc(E.eyeView).waitFor({ state: 'visible', timeout: 45000 });
    await H.sleep(1500);
    const d = await H.debugState();
    check('eye view: no outlines · no debug meter / overlay · no body.debug', d.spots > 0 && d.outlineRoots === 0 && d.dashed === 0 && !d.bodyDebug && d.ui.every((u) => u.n === 0), d);
    check('still no window.haru after the cold open', await H.ev(() => typeof window.haru === 'undefined'));
    await H.shot('eye_view');
  }));
  out.push(await run(browser, 'c2_app_build_debug_config', { config: { APP: true, DEBUG: true } }, async (H, check) => {
    await H.page.goto(fileUrl(ROOT, E.page) + '?debug=1');
    await H.loc(E.sel.start).waitFor({ state: 'visible', timeout: 20000 });
    check('CONFIG.APP + CONFIG.DEBUG true → G.DEBUG false', await H.ev(() => window.CONFIG.DEBUG === true && G.APP === true && G.DEBUG === false), await H.ev(() => [window.CONFIG.DEBUG, G.APP, G.DEBUG]));
    const left = await H.ev((list) => list.filter((x) => { try { return Function('return typeof ' + x)() !== 'undefined' && Function('return ' + x)() !== undefined; } catch (e) { return false; } }), E.stripped);
    check('no debug helpers', left.length === 0, left);
    check('no body.debug class', !(await H.ev(() => document.body.classList.contains('debug'))));
  }));
  if (save) {
    out.push(await run(browser, 'c3_app_build_credits', { config: { APP: true }, init: { fn: (o) => { try { if (!sessionStorage.getItem('qa.seeded')) { sessionStorage.setItem('qa.seeded', '1'); localStorage.setItem(o.k, o.v); } } catch (e) {} }, arg: { k: E.saveKey, v: save } } }, async (H, check) => {
      await H.page.goto(fileUrl(ROOT, E.page) + '?debug=1');
      await H.tap(E.sel.cont, { timeout: 20000, after: 600 });
      await waitScene(H, 25000);
      const s = await H.scene();
      const L = await H.ev(E.lines);
      check('G.DEBUG false · no window.haru', await H.ev(() => G.DEBUG === false && typeof window.haru === 'undefined'));
      check('credits = the title block only', s.kids.length === 1 && s.kids[0].cls.split(/\s+/).includes(E.webKids[0]), s.kids.map((k) => k.cls));
      check('title block centred 390x844 ts 1 (dx ' + s.dx.toFixed(2) + ', dy ' + s.dy.toFixed(2) + ')', Math.abs(s.dx) <= CENTRE_TOL && Math.abs(s.dy) <= CENTRE_TOL, { dx: s.dx, dy: s.dy, scene: s.scene, title: s.titleBox });
      const hits = await bodyHits(H, L);
      check('none of the four lines in document.body.innerText', hits.length === 0, hits);
      const d = await H.debugState();
      check('no debug meter / overlay / outlines', d.ui.every((u) => u.n === 0) && d.outlineRoots === 0 && !d.bodyDebug, d);
      await H.shot('credits');
      await H.tap(E.sel.skip, { after: 900 });
      await H.loc(E.sel.next).waitFor({ state: 'visible', timeout: 8000 });
      check('tap → check card', true);
    }));
  } else log('  c3 skipped — no save from b (run b with c)');
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: !ARG.headed });
  const results = [];
  let save = null;
  try {
    if (ONLY.includes('a')) {
      const a = await webRun(browser, ROOT, 'a_web');
      results.push(a.r);
      if (BASELINE && BASELINE !== ROOT) {
        const b0 = await webRun(browser, BASELINE, 'a_web_baseline');
        results.push(b0.r);
        const same = !!a.html && a.html === b0.html;
        results.push({ label: 'a_web_vs_baseline', errors: [], checks: [{ name: 'credits HTML identical to ' + BASELINE, ok: same, info: same ? undefined : { here: a.html, baseline: b0.html } }] });
        log((same ? '  ok   ' : '  FAIL ') + 'credits HTML identical to the baseline checkout');
      }
    }
    if (ONLY.includes('b') || ONLY.includes('c')) {
      const b = await appPreviewRun(browser);
      if (ONLY.includes('b')) results.push(b.r);
      save = b.save;
    }
    if (ONLY.includes('c')) results.push(...(await appBuildRuns(browser, save)));
  } catch (e) {
    results.push({ label: 'driver', errors: [], checks: [{ name: 'driver: ' + e.message.split('\n')[0], ok: false }] });
  }
  await browser.close();
  const failed = [];
  results.forEach((r) => r.checks.forEach((c) => { if (!c.ok) failed.push(r.label + ': ' + c.name); }));
  const pass = results.length > 0 && failed.length === 0;
  log(pass ? 'PASS' : 'FAIL (' + failed.length + ')');
  failed.forEach((f) => log('  ✗ ' + f));
  console.log(JSON.stringify({ pass, ep: Number(EP), runs: results.map((r) => ({ label: r.label, checks: r.checks.length, failed: r.checks.filter((c) => !c.ok).length, errors: r.errors.length })), failed, shots: OUT, wallSec: Math.round((Date.now() - T_START) / 1000) }));
  process.exit(pass ? 0 : 1);
})();
