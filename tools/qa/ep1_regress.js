/* =========================================================
 * tools/qa/ep1_regress.js — episode-1 regression (SERIES §6 principle list) + the retroactive seeds R1–R6.
 *
 *   NODE_PATH=<global node_modules> node tools/qa/ep1_regress.js [--base=file|http|both] [--expect=auto|retcon|live]
 *        [--clean=auto|yes|no] [--root=<site dir>] [--out=<shot dir>] [--quick] [--until=<stage>] [--headed]
 *
 * Plays the ROOT episode 1 (index.html) in Chromium at 360×640 (touch, Korean locale) from the title to the friend's
 * letter, over file:// and over http:// (a tiny static server started in this script), with real taps / holds / drags
 * and the physical-keyboard text path of the in-game keyboard. window.haru (ep1's debug helper) is used only to add
 * play time (haru.skip — waits for the mom read-receipt sequence) — never to set a progress flag; if a stage fails,
 * the run says so and continues where it can.
 *
 * Checks (bible §6 principle list): boot · title · start · intro · every answer path in DESIGN §11 (PIN 0317 incl. a
 * wrong PIN, memo zhddl incl. a wrong try, undo ↶, ① 47 (recording + room keypad), ② 29 (모노 오디오 + '잡음'),
 * vault 1124= + ③ 06 (노출 ≥60 %), memo p.2 '옷장', trap *0404#, H6 call, 오르골 → OTP from 메일, 화면 공유 cut,
 * block sagongsa, MFA deny ×5 → 보호하기, 지민 112 chips, door 472906, climax hold → decline → guard → 비상벨 →
 * handle) · the momRead beat · ending cards · mail unread badge · 지민 unread 214 · lock '부재중 보이스톡 (366)' ·
 * the R1–R6 strings where SERIES §6 puts them · search router unchanged (q_redev unreachable by search) ·
 * 0 console errors · END writes haru-escape.series.v1 (P-2).
 *
 * R1–R6 are one set (SERIES §6): --expect=retcon asserts every seed is present, --expect=live that every seed is
 * absent; auto (default) takes the expectation from q_redev (R6, read at boot) and asserts that every other seed
 * matches it, so a partial retcon leak fails. Each seed is still detected on its own (talk data, the rendered mail
 * list, parcel card, parcel caption, history row, indoor-camera card); a retcon build gets the R1–R6 placement checks,
 * a live build the 'live: …' absence checks; the counts R4 shifts (엄마 unread 377/378, 2026년 1월 32/33) follow it.
 *
 * App-mode cleanup (client rule 2026-11-27 — no AI-annotation-style meta copy on web or app): --clean=auto (default)
 * runs these expectations when the build defines G.APP (js/core/base.js, landed with the cleanup); yes / no forces them.
 * Clean: no title footer / desk hint · web G.APP false, window.haru present, no body.debug · title 설정: '목소리' row +
 * the one line '목소리는 AI 음성입니다.' · warning = one line + the 수첩 pointer, centred in a box as wide as the
 * buttons · ear test row with one instruction line, nothing else on the setup screen · notebook: optional objectives
 * without a '선택' chip, no play-stats footer, no hint-mechanics line · climax hold hint
 * keeps the web '(PC: …)' aside · credits = the title only · 진짜로 보내기 copies the unchanged
 * message and toasts '복사했어요.' · a MutationObserver (init script) sees none of the removed phrases (BANNED) rendered
 * anywhere during the run, toasts included. Not clean: the pre-cleanup title footer (이어폰) is expected instead.
 *
 * Screenshots → <out>/<base>/NN_<name>.png (360×640, DPR 2). Summary JSON → <out>/<base>/result.json; last stdout
 * line = JSON {pass, fail, ...}. Exit 0 = every check passed on every base.
 * ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright')); } })();

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const ROOT = path.resolve(ARG.root || path.join(__dirname, '..', '..'));
const OUT = path.resolve(ARG.out || path.join(__dirname, '..', '..', 'work', 'shots', 'ep1_regress'));
const BASES = ARG.base === 'file' ? ['file'] : ARG.base === 'http' ? ['http'] : ['file', 'http'];
const EXPECT = ARG.expect || 'auto';
const CLEAN_ARG = ARG.clean || 'auto';
// phrases the app-mode cleanup removed (judge decisions + lead overrides O1–O12); none may render on the web build either
const BANNED = [/이 게임/, /어떤 데이터도|아무 데이터도/, /기획·제작/, /AI 생성|직접 합성|목소리: AI|목소리\(TTS\)/,
  /이어폰 필수|자동 저장됩니다|어두운 곳에서|어두운 곳 ·/, /화면 밝기를 올려|방은 어둡습니다/,
  /이어폰을 끼고 플레이|이어폰을 권장|이어폰 추천|더 무섭습니다/, /센서 권한|언제든 설정에서/,
  /스피커 모드: 방향은|방향이 있는 소리가 중요|구분하기 어려워질 수 있어요/, /정답이 바로 나와요|1분 간격으로 하나씩|쉬움 모드: 힌트를/,
  /플레이 \d+분 · 힌트/, /카메라만 사용 가능|플래시를 끌게요|이제 그 사람은 화면을 못 본다|끄지 않았습니다/,
  /게임 전체\(톡, 메모 등\)|친구에게 붙여넣어/].map((r) => r.source);
const QUICK = !!ARG.quick;
const UNTIL = ARG.until || null;
const T0 = Date.now();
const log = (...a) => console.log(('[' + ((Date.now() - T0) / 1000).toFixed(1) + 's]').padEnd(9), ...a);

/* ---------- static server (http base) ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { rsp.writeHead(400); rsp.end(); return; }
      let fp = path.normalize(path.join(ROOT, p));
      if (!fp.startsWith(ROOT)) { rsp.writeHead(403); rsp.end(); return; }
      try {
        let st = fs.statSync(fp);
        if (st.isDirectory()) { if (!p.endsWith('/')) { rsp.writeHead(301, { Location: p + '/' }); rsp.end(); return; } fp = path.join(fp, 'index.html'); st = fs.statSync(fp); }
        rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        fs.createReadStream(fp).pipe(rsp);
      } catch (e) { rsp.writeHead(404); rsp.end('not found'); }
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

/* ---------- one full run on one base ---------- */
async function run(browser, base, httpOrigin) {
  const out = path.join(OUT, base);
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/\.(png|json)$/.test(f)) fs.unlinkSync(path.join(out, f));
  const results = [], notes = [], errors = [];
  const check = (label, ok, detail) => { results.push({ label, ok: !!ok, detail: detail == null ? '' : String(detail).slice(0, 600) }); log((ok ? 'PASS ' : 'FAIL ') + base + ' · ' + label + (detail != null && !ok ? '  — ' + String(detail).slice(0, 300) : '')); return !!ok; };
  const note = (...a) => { notes.push(a.join(' ')); log('  • ' + a.join(' ')); };

  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  // every text that reaches the DOM (parser, scripts, toasts) is tested against BANNED; hits → window.__qaBanned
  await ctx.addInitScript((pats) => {
    const RX = pats.map((p) => new RegExp(p));
    const hits = (window.__qaBanned = []);
    const SKIP = /^(NOSCRIPT|SCRIPT|STYLE)$/;
    const test = (txt, at) => { if (!txt || hits.length >= 40) return; for (const r of RX) { const m = r.exec(txt); if (m && !hits.some((h) => h.p === r.source)) hits.push({ p: r.source, at, text: txt.slice(Math.max(0, m.index - 30), m.index + 60) }); } };
    const scan = (n) => {
      if (!n) return;
      if (n.nodeType === 3) { if (!(n.parentNode && SKIP.test(n.parentNode.nodeName))) test(n.data, n.parentNode && n.parentNode.nodeName); return; }
      if (n.nodeType !== 1 || SKIP.test(n.nodeName)) return;
      // the element's own text, without <noscript> (kept web-only fallback) / <script> / <style> descendants
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.parentElement && t.parentElement.closest('noscript,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      let txt = ''; while (w.nextNode()) txt += w.currentNode.data;
      test(txt, n.nodeName + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : ''));
    };
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') scan(m.target); else m.addedNodes.forEach(scan); } })
      .observe(document, { childList: true, subtree: true, characterData: true });
  }, BANNED);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 400) + ' @' + ((m.location() || {}).url || '').replace(/.*\/(js|engine|css)\//, '$1/') + ':' + ((m.location() || {}).lineNumber)); });
  page.on('requestfailed', (r) => { const u = r.url(); if (/fonts\.(googleapis|gstatic)|cdn\.jsdelivr|cdnjs/.test(u)) return; errors.push('REQFAIL ' + u.replace(/.*game1/, '') + ' ' + ((r.failure() && r.failure().errorText) || '')); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  /* ---------- helpers ---------- */
  let shotN = 0;
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // screenshots of the changed screens (R*) wait for a passing notification banner to clear first (clean evidence)
  const shot = async (name) => { await pin(); if (/^R\d/.test(name)) await waitFn(() => !document.querySelector('#banners .banner'), 9000); const f =path.join(out, String(++shotN).padStart(2, '0') + '_' + name + '.png'); await page.screenshot({ path: f }); return f; };
  const flag = (f) => ev((f) => !!(window.G && G.state && G.state.flags && G.state.flags[f]), f);
  const flags = () => ev(() => Object.keys((window.G && G.state && G.state.flags) || {}));
  const waitFn = (fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true).catch(() => false);
  const waitFlag = (f, ms) => waitFn((f) => !!(window.G && G.state && G.state.flags && G.state.flags[f]), ms, f);
  const vis = (sel) => page.locator(sel).filter({ visible: true });
  const has = async (sel) => (await vis(sel).count()) > 0;
  // Playwright's click auto-scroll (and scrollIntoView() in the checks below) can scroll #screen, which is overflow:hidden but
  // still programmatically scrollable — ep1's js/core/phone.js does not pin it (ep2's engine/core/phone.js does). The shift hides
  // the status bar (the P6 quick-panel tap at y 14 then misses) and slides the parked in-game keyboard into view in every later
  // screenshot. A finger cannot cause it, so the harness undoes it after its own clicks and before each screenshot, and says so.
  const pin = () => ev(() => { const s = document.getElementById('screen'); if (!s || !(s.scrollTop || s.scrollLeft)) return null; const v = [s.scrollLeft, s.scrollTop]; s.scrollTop = 0; s.scrollLeft = 0; return v; })
    .then((v) => { if (v) note('#screen shifted by the harness ' + JSON.stringify(v) + ' → reset to 0'); }).catch(() => {});
  const click = async (sel, o) => { const l = vis(sel).last(); await l.waitFor({ state: 'visible', timeout: (o && o.timeout) || 8000 }); await l.click({ timeout: 6000, force: !!(o && o.force) }); await pin(); await sleep((o && o.after) != null ? o.after : 600); };
  const clickText = async (sel, text, o) => { const l = page.locator(sel, { hasText: text }).filter({ visible: true }).last(); await l.waitFor({ state: 'visible', timeout: (o && o.timeout) || 8000 }); await l.click({ timeout: 6000 }); await pin(); await sleep((o && o.after) != null ? o.after : 600); };
  const hold = async (sel, ms) => { const l = vis(sel).last(); await l.waitFor({ state: 'visible', timeout: 8000 }); const b = await l.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await sleep(ms); await page.mouse.up(); };
  const textOf = (sel) => ev((s) => [...document.querySelectorAll(s)].filter((n) => n.offsetParent || n.getClientRects().length).map((n) => n.textContent.replace(/\s+/g, ' ').trim()), sel);
  const screenText = () => ev(() => (document.getElementById('screen') || document.body).innerText.replace(/\s+/g, ' '));
  const home = async () => {
    await pin();
    for (let i = 0; i < 6; i++) {
      const st = await ev(() => ({ dlg: !!document.querySelector('#overlays .dialog-wrap'), ov: document.querySelectorAll('#overlays > *').length, depth: G.phone.stackDepth(), room: !!(G.room && G.room.isOpen && G.room.isOpen()) }));
      if (st.dlg) { await ev(() => { const b = [...document.querySelectorAll('#overlays .dialog-wrap .dlg-btn')]; (b.find((x) => /취소|닫기|나중에|확인/.test(x.textContent)) || b[0]).click(); }); await sleep(500); continue; }
      if (st.room) { const c = vis('.cam-close'); if (await c.count()) { await c.last().click().catch(() => {}); await sleep(500); continue; } }
      if (st.depth === 0 && !st.room) return;
      await vis('.home-bar').last().click().catch(() => {}); await sleep(600);
    }
  };
  const openApp = async (id) => {
    await home();
    const icon = vis(`#home button.app-icon[data-app="${id}"]`);
    if (await icon.count()) { await icon.last().click(); await sleep(900); return; }
    // inside the folder
    await click('#home button.app-icon.folder', { after: 600 });
    await click(`#overlays .folder-grid button.app-icon[data-app="${id}"]`, { after: 900 });
  };
  const badge = (id) => ev((id) => { const n = document.querySelector(`#home button.app-icon[data-app="${id}"] .ai-badge`); return n ? n.textContent : ''; }, id);
  const noBanner = async (ms) => { await waitFn(() => !document.querySelector('#banners .banner'), ms || 15000); await sleep(150); };
  /* tap an in-game text field (div.fld) inside `scope`, then type on the physical keyboard (두벌식 mapping in 한국어 mode) */
  const fieldType = async (scope, keys) => { const f = vis(scope + ' .fld').last(); await f.waitFor({ state: 'visible', timeout: 8000 }); await f.click(); await sleep(350); await page.keyboard.type(keys, { delay: 90 }); await sleep(250); };
  const typeKeys = async (s, delay) => { await page.keyboard.type(s, { delay: delay || 90 }); };
  const stagesDone = [];
  const toDoor = async () => {
    for (let i = 0; i < 5; i++) { const l = await ev(() => (document.querySelector('.rv-label') || {}).textContent); if (l === '현관') break; await noBanner(); await click('.rv-turnbtn.left', { after: 1100 }); }
    await sleep(700);
  };

  const URL1 = base === 'file' ? 'file:///' + path.join(ROOT, 'ep1.html').replace(/\\/g, '/') : httpOrigin + '/ep1.html';
  // R1–R6 come as one set: --expect=retcon|live fixes the expectation; auto takes it from the first seed read (R6 =
  // q_redev, at boot) and every later seed must match it — a partial retcon leak fails instead of being followed.
  let retcon = EXPECT === 'retcon' ? true : EXPECT === 'live' ? false : null;
  const R = {};
  const seed = (id, present, how) => {
    R[id] = !!present;
    if (retcon === null) { retcon = R[id]; note('data =', retcon ? 'retcon (R1–R6 present)' : 'live (no R1–R6)', '— expectation from ' + id + ' (' + how + ')'); }
    else check((retcon ? 'expect retcon: ' + id + ' present' : 'expect live: ' + id + ' absent') + ' (' + how + ')', R[id] === retcon, R[id] ? 'present' : 'absent');
    return retcon;
  };
  let clean = CLEAN_ARG === 'yes';

  /* =================== stages =================== */
  const ST = {};

  ST.boot = async () => {
    await page.goto(URL1, { waitUntil: 'load' });
    await sleep(1200);
    await ev(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.title-screen .title-btn', { timeout: 15000 });
    await sleep(1200);
    const t = await ev(() => ({ btns: [...document.querySelectorAll('.title-screen button')].filter((n) => n.offsetParent).map((n) => n.textContent.trim()), name: (document.querySelector('.title-name') || {}).textContent, foot: (document.querySelector('.title-foot') || {}).textContent, keys: Object.keys(localStorage), series: !!(window.G && G.series && G.series.endEp1), redev: !!(G.STORY.pages && G.STORY.pages.q_redev),
      app: typeof G.APP === 'boolean' ? G.APP : null, haru: !!window.haru, bodyDebug: document.body.classList.contains('debug'), deskHint: !!document.querySelector('.desk-hint') }));
    clean = CLEAN_ARG === 'yes' ? true : CLEAN_ARG === 'no' ? false : t.app !== null;
    note('build =', clean ? 'app-mode cleanup (G.APP defined)' : 'pre-cleanup (no G.APP)', '· --expect=' + EXPECT);
    seed('R6', t.redev, 'G.STORY.pages.q_redev');
    check('boot: title buttons 시작하기 · 설정', JSON.stringify(t.btns) === JSON.stringify(['시작하기', '설정']), JSON.stringify(t.btns));
    if (clean) {
      check('boot: title name · no footer (playtime / 이어폰 / 자동 저장) · no desk hint', /위한\s*방탈출!/.test(t.name || '') && t.foot === undefined && !t.deskHint, JSON.stringify(t));
      check('boot (web): G.APP false · window.haru present · no body.debug', t.app === false && t.haru && !t.bodyDebug, JSON.stringify({ app: t.app, haru: t.haru, bodyDebug: t.bodyDebug }));
    } else check('boot: title name + foot', /위한\s*방탈출!/.test(t.name || '') && /이어폰/.test(t.foot || ''), JSON.stringify(t));
    check('boot: writes no storage keys', t.keys.length === 0, JSON.stringify(t.keys));
    check('boot: engine/series.js loaded (P-2)', t.series, '');
    await shot('title');
    if (clean) {
      // title 설정: the one AI-voice disclosure (O6) sits under the '목소리' toggle
      await clickText('.title-screen button', '설정', { after: 900 });
      const o = await ev(() => {
        const k = [...document.querySelectorAll('.title-screen .title-kicker')].find((n) => n.textContent === 'SETTINGS');
        const p = k && k.parentNode;
        return p ? { rows: [...p.querySelectorAll('.opt-row > span:first-child')].map((n) => n.firstChild.textContent), notes: [...p.querySelectorAll('.opt-note')].map((n) => n.textContent), ai: (document.body.innerText.match(/AI 음성/g) || []).length } : null;
      });
      note('title 설정', JSON.stringify(o));
      check("title 설정: '목소리' row + exactly one '목소리는 AI 음성입니다.'", o && JSON.stringify(o.rows) === JSON.stringify(['사운드', '진동', '공포 연출', '목소리', '글자 크기']) && JSON.stringify(o.notes) === JSON.stringify(['목소리는 AI 음성입니다.']) && o.ai === 1, JSON.stringify(o));
      await shot('title_settings');
      await clickText('.title-screen button', '닫기', { after: 700 });
      check('boot: still no storage keys after 설정 (opened, nothing tapped)', (await ev(() => Object.keys(localStorage).length)) === 0, '');
    }
  };

  ST.start = async () => {
    await clickText('.title-screen button', '시작하기', { after: 1000 });
    if (clean) {
      const wb = await ev(() => {
        const b = document.querySelector('.title-screen .warn-box'); if (!b) return null;
        const btn = [...b.parentNode.querySelectorAll('button.title-btn')].find((n) => n.textContent.trim() === '알겠어요');
        const r = b.getBoundingClientRect(), q = btn ? btn.getBoundingClientRect() : null;
        return { text: (b.innerText || '').replace(/\s+/g, ' ').trim(), align: getComputedStyle(b).textAlign, box: [Math.round(r.left), Math.round(r.width)], btn: q ? [Math.round(q.left), Math.round(q.width)] : null };
      });
      check('warning: one content line + the 수첩 pointer (O5)', wb && wb.text === '공포 연출과 스토킹·실종 소재가 있습니다. 📓 힌트는 오른쪽 위 수첩에 있어요.', JSON.stringify(wb));
      check('warning: box as wide as the 알겠어요 button, text centred', wb && wb.btn && Math.abs(wb.box[0] - wb.btn[0]) <= 1 && Math.abs(wb.box[1] - wb.btn[1]) <= 1 && wb.align === 'center', JSON.stringify(wb));
    }
    await shot('warning');
    await clickText('.title-screen button', '알겠어요', { after: 1200 });
    // earphone test: 테스트 → 왼쪽 → 오른쪽
    await clickText('.title-screen button', '테스트', { after: 1300 });
    await clickText('.title-screen button', '왼쪽', { after: 1300 });
    await clickText('.title-screen button', '오른쪽', { after: 900 });
    if (clean) {
      const im = await ev(() => { const s = [...document.querySelectorAll('.title-screen')].pop(); return { rows: [...s.querySelectorAll('.imm-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()), text: s.innerText.replace(/\s+/g, ' ').trim() }; });
      check('setup: ear test with one instruction line, nothing else (O4)', im.rows.length === 1 && im.rows[0] === '🎧 이어폰 테스트 이어폰을 끼고 눌러 주세요 ✓ 이어폰' && im.text === 'SETUP 몰입 설정 ' + im.rows[0] + ' 시작', JSON.stringify(im));
    }
    await shot('setup');
    await page.locator('.title-screen button.title-btn.primary', { hasText: '시작' }).filter({ visible: true }).last().click();
    const reach = page.locator('button.cine-reach');
    await reach.waitFor({ state: 'visible', timeout: 40000 });
    await sleep(900);
    await shot('coldopen_reach');
    await hold('button.cine-reach', 900);
    const intro = await waitFlag('introDone', 15000);
    check('start: cold open → introDone', intro, '');
    await sleep(1600);
    const lock = await ev(() => ({ notifs: [...document.querySelectorAll('.lock-notif')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()), time: (document.querySelector('.lock-time') || {}).textContent, owner: (document.querySelector('.lock-owner') || {}).textContent }));
    note('lock', JSON.stringify(lock));
    check("lock: '부재중 보이스톡 (366)' unchanged", lock.notifs.some((t) => /부재중 보이스톡 \(366\)/.test(t)), JSON.stringify(lock.notifs));
    check('lock: time rolled to 3:33', lock.time === '3:33', lock.time);
    await shot('lock');
  };

  ST.unlock = async () => {
    await page.mouse.click(180, 330); await sleep(900);
    if (!(await has('button.pin-key'))) { await page.mouse.click(180, 300); await sleep(900); }
    const key = async (k) => { await vis(`button.pin-key[aria-label="${k}"]`).first().click(); await sleep(160); };
    for (const k of '1111') await key(k);
    const wrong = await waitFn(() => /PIN이 일치하지 않습니다 \(1회\)/.test((document.querySelector('.pin-msg') || {}).textContent || ''), 5000);
    check('P1: wrong PIN 1111 rejected', wrong, await ev(() => (document.querySelector('.pin-msg') || {}).textContent));
    await sleep(1300);
    for (const k of '0317') await key(k);
    const m1 = await waitFlag('M1', 8000);
    check('P1: PIN 0317 → M1', m1, (await flags()).join(','));
    await sleep(2200);
    await shot('home');
  };

  /* app-mode cleanup: the notebook keeps its cues, loses the stats footer and the hint-mechanics lines */
  ST.notebook = async () => {
    if (!clean) { note('notebook: pre-cleanup build — skipped'); return; }
    await home();
    await click('button.nbk-fab', { after: 1000 });
    const out = {};
    await clickText('button.nbk-tab', '할 일', { after: 700 });
    // optional objectives (P2 is up right after M1) are marked by style only (.opt) — no '선택' chip, like engine/notebook.js
    const opt = await ev(() => [...document.querySelectorAll('.nbk-body button.nbk-obj')].map((b) => ({ opt: b.classList.contains('opt'), text: b.innerText.replace(/\s+/g, ' ').trim(), tag: !!b.querySelector('.nbk-tag') })));
    check("notebook 할 일: optional objective shown (.opt) without a '선택' chip", opt.some((o) => o.opt) && opt.every((o) => !o.tag && !/(^|\s)선택(\s|$)/.test(o.text)), JSON.stringify(opt));
    for (const [tab, label] of [['todo', '할 일'], ['frag', '조각'], ['hint', '힌트']]) {
      await clickText('button.nbk-tab', label, { after: 700 });
      out[tab] = await ev(() => ({ text: ((document.querySelector('.nbk-body') || {}).innerText || '').replace(/\s+/g, ' ').trim(), stats: !!document.querySelector('.nbk-stats') }));
    }
    note('notebook', JSON.stringify(out).slice(0, 500));
    check('notebook: no play-stats footer on 할 일 · 조각 · 힌트', Object.values(out).every((o) => !o.stats && !/플레이 \d+분/.test(o.text)), JSON.stringify(out));
    check('notebook 힌트: no hint-mechanics line', out.hint.text.length > 0 && !/1분 간격|쉬움 모드|불이익/.test(out.hint.text), out.hint.text);
    await shot('notebook_hint');
    await click('button.nbk-close', { after: 700 });
  };

  /* R1 · R4 · R5 + 지민 unread 214 + momRead beat */
  ST.talk = async () => {
    const c0 = await ev(() => ({ jimin: G.chat.messages('talk', 'jimin').filter((m) => m.unread).length, mom: G.chat.messages('talk', 'mom').filter((m) => m.unread).length, missed: G.chat.missedCount('talk', 'mom'),
      r1: G.chat.messages('talk', 'jimin').some((m) => /니가 만든 소리엔 왜 맨날 삐요/.test(String(m.text || ''))), r4: G.chat.messages('talk', 'mom').some((m) => /세아야 생일 축하해/.test(String(m.text || ''))) }));
    note('talk counts (data)', JSON.stringify(c0));
    seed('R1', c0.r1, '지민 thread data');
    seed('R4', c0.r4, '엄마 thread data');
    const momN = 377 + (retcon ? 1 : 0);
    check('지민 unread (data) = 214', c0.jimin === 214, c0.jimin);
    check('엄마 missed voice calls = 366', c0.missed === 366, c0.missed);
    check('엄마 unread (data) = ' + momN + (retcon ? ' (377 + R4 line — computed badge, by design)' : ''), c0.mom === momN, c0.mom);
    await openApp('talk');
    await sleep(800);
    const list = await ev(() => [...document.querySelectorAll('.chat-list .chat-row, .chat-list > *')].filter((n) => n.offsetParent).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).slice(0, 8));
    note('talk list', JSON.stringify(list));
    const rowBadge = (name) => ev((name) => { const r = [...document.querySelectorAll('.chat-list .chat-row, .chat-list > *')].filter((n) => n.offsetParent).find((n) => (n.querySelector('.cr-name, b, .name') || n).textContent.includes(name)); if (!r) return null; const b = [...r.querySelectorAll('*')].filter((x) => !x.children.length && /^\d+$/.test(x.textContent.trim())).pop(); return b ? b.textContent.trim() : null; }, name);
    const jb = await rowBadge('지민'), mb = await rowBadge('엄마');
    check('톡 list: 지민 unread badge 214', jb === '214', jb);
    check('톡 list: 엄마 unread badge ' + momN, mb === String(momN), mb);
    await shot('talk_list');
    // ---- 지민: R1 ----
    await clickText('.chat-list .chat-row, .chat-list button', '지민', { after: 1400 });
    const jgrp = await ev(() => [...document.querySelectorAll('.chat-grp')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /2025년 7월/.test(t)));
    note('지민 groups (2025년 7월)', JSON.stringify(jgrp));
    let jl = page.locator('.chat-grp', { hasText: '2025년 7월' });
    if (await jl.count()) {
      // the July groups: open each that is split by day (7/5, 7/30) — the R1 day is the late-July group
      const n = await jl.count();
      for (let i = n - 1; i >= 0; i--) { const g = jl.nth(i); await g.scrollIntoViewIfNeeded(); await g.click(); await sleep(500); jl = page.locator('.chat-grp', { hasText: '2025년 7월' }); }
    }
    await sleep(600);
    const r1 = await ev(() => {
      const rows = [...document.querySelectorAll('.chat-row')];
      const i = rows.findIndex((r) => /근데 니가 만든 소리엔 왜 맨날 삐요 들어감ㅋㅋ/.test(r.textContent));
      const j = rows.findIndex((r) => /내 서명임ㅋㅋ 주운 소리 말고 내가 일부러 낸 소리엔 맨 앞에/.test(r.textContent));
      const k = rows.findIndex((r) => /음향과의 숙명/.test(r.textContent));
      const target = rows[j] || rows[i];
      if (target) target.scrollIntoView({ block: 'center' });
      return { i, j, k, them: i >= 0 && !rows[i].classList.contains('me'), me: j >= 0 && rows[j].classList.contains('me'), cls: [i, j].map((x) => (rows[x] ? rows[x].className : '')) };
    });
    note('R1 rows', JSON.stringify(r1));
    if (retcon) check('R1: 지민 2025-07-30 09:31 / 09:33 lines visible after 음향과의 숙명 (지민 → 세아)', r1.i > r1.k && r1.j === r1.i + 1 && r1.k >= 0 && r1.them && r1.me, JSON.stringify(r1));
    else check('live: no R1 lines', r1.i < 0 && r1.j < 0, JSON.stringify(r1));
    await sleep(500);
    await shot('R1_jimin_0730');
    const after = await ev(() => G.chat.messages('talk', 'jimin').filter((m) => m.unread).length);
    check('지민 unread data still 214 after opening (receipts are a read pointer)', after === 214, after);
    await vis('.sv-back').last().click(); await sleep(900);
    // ---- 엄마: momRead + R4 ----
    await clickText('.chat-list .chat-row, .chat-list button', '엄마', { after: 1500 });
    const momRead = await waitFlag('momRead', 5000);
    const mhead = await ev(() => [...document.querySelectorAll('.sv-head, .ch-head, header')].filter((n) => n.offsetParent).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    check('엄마 thread header: 부재중 보이스톡 366', /부재중 보이스톡 366/.test(mhead), mhead);
    check('momRead beat: opening 엄마 sets momRead', momRead, '');
    const jan = page.locator('.chat-grp', { hasText: '2026년 1월' });
    const janN = await jan.count();
    const janLabel = janN ? (await jan.first().textContent()).replace(/\s+/g, ' ').trim() : '';
    note('엄마 2026년 1월 group', janLabel, 'count', janN);
    check('엄마: one collapsed "2026년 1월" group', janN === 1, janLabel);
    const nJan = +(/메시지 (\d+)개/.exec(janLabel) || [])[1];
    const janN0 = 32 + (retcon ? 1 : 0);
    check('엄마 2026년 1월 group size = ' + janN0 + (retcon ? ' (31 calls + 01-01 + 01-24)' : ' (31 calls + 01-01)'), nJan === janN0, janLabel);
    if (janN) { await jan.first().scrollIntoViewIfNeeded(); await jan.first().click(); await sleep(800); }
    const r4 = await ev(() => {
      const box = [...document.querySelectorAll('.chat-grp-open')].find((b) => /새해 복 많이 받아 우리 딸/.test(b.textContent));
      if (!box) return { box: false };
      const rows = [...box.querySelectorAll('.chat-row')];
      const i = rows.findIndex((r) => /세아야 생일 축하해\. 엄마 미역국 끓였어/.test(r.textContent));
      if (i >= 0) rows[i].scrollIntoView({ block: 'center' });
      const txt = i >= 0 ? rows[i].textContent.replace(/\s+/g, ' ') : '';
      // the date divider before it
      let d = i >= 0 ? rows[i].previousElementSibling : null; let div = '';
      while (d && !div) { if (/2026년 1월 24일/.test(d.textContent) && !d.classList.contains('chat-row')) div = d.textContent.trim(); d = d.previousElementSibling; if (d && d.classList.contains('chat-row') && !/03:33|오전 3:33/.test(d.textContent) && !/부재중/.test(d.textContent)) break; }
      return { box: true, i, txt, div, inGroup: i >= 0 };
    });
    note('R4', JSON.stringify(r4));
    if (retcon) check('R4: 엄마 2026-01-24 21:40 line inside the 2026년 1월 group', r4.inGroup && /오후 9:40|21:40/.test(r4.txt), JSON.stringify(r4));
    else check('live: no R4 line', !r4.inGroup, JSON.stringify(r4));
    await sleep(700);
    await shot('R4_mom_0124');
    await vis('.sv-back').last().click(); await sleep(800);
    // ---- 택배: R5 card ----
    await clickText('.chat-list .chat-row, .chat-list button', '택배', { after: 1400 });
    const r5 = await ev(() => {
      const cards = [...document.querySelectorAll('.bubble.card')];
      const c = cards.find((n) => /수령인/.test(n.textContent));
      if (c) c.scrollIntoView({ block: 'center' });
      return c ? [...c.querySelectorAll('.cd-rows > div')].map((r) => [...r.children].map((x) => x.textContent.trim())) : null;
    });
    note('R5 card rows', JSON.stringify(r5));
    seed('R5', !!(r5 && r5.some((r) => r[0] === '보내는 분')), '택배 card rows');
    check('택배 2026-11-23 card: 받는 곳 · 수령인 하루' + (retcon ? ' · (R5 row)' : ''), r5 && r5.length === (retcon ? 3 : 2) && r5[0][0] === '받는 곳' && r5[1][0] === '수령인' && r5[1][1] === '하루', JSON.stringify(r5));
    if (retcon) check("R5: 2026-11-23 card rows end with '보내는 분 —'", r5 && r5.length === 3 && r5[2][0] === '보내는 분' && r5[2][1] === '—' && r5[1][1] === '하루', JSON.stringify(r5));
    else check('live: parcel card has 2 rows', r5 && r5.length === 2, JSON.stringify(r5));
    await sleep(400);
    await shot('R5_parcel_card');
    // ---- momRead sequence: +25 s (play time) → 4 lines → incoming 보이스톡 auto-declined (mirroring) → his line ----
    await home();
    await ev(() => window.haru.skip(26000));
    const seq = await waitFn(() => (G.state.vars.momSeq || 0) >= 99, 70000);
    const mom = await ev(() => ({ seq: G.state.vars.momSeq, lines: G.chat.messages('talk', 'mom').slice(-7).map((m) => m.text || m.call), haru: (G.state.threads['talk:haru'] || []).map((m) => m.text) }));
    note('mom seq', JSON.stringify(mom));
    check('momRead beat: 4 lines + incoming call declined + his line', seq && mom.lines.includes('declined') && mom.haru.includes('엄마한테 연락하지 마.'), JSON.stringify(mom));
    const missed = await ev(() => G.chat.missedCount('talk', 'mom'));
    check('엄마 missed count after the declined call = 366', missed === 366, missed);
  };

  /* R2 + mail unread badge */
  ST.mail = async () => {
    await home();
    const b0 = await badge('mail');
    note('mail icon badge', b0);
    check('메일 icon badge = 4 (unchanged)', b0 === '4', b0);
    await openApp('mail');
    const head = await ev(() => (document.querySelector('.ml-count') || {}).textContent);
    check('메일: 읽지 않은 메일 4개', head === '읽지 않은 메일 4개', head);
    const rows = await ev(() => [...document.querySelectorAll('.ml-row')].map((r) => ({ un: r.classList.contains('unread'), t: r.textContent.replace(/\s+/g, ' ').trim() })));
    note('mail rows', JSON.stringify(rows.map((r) => (r.un ? '● ' : '  ') + r.t.slice(0, 60))));
    const cl = rows.findIndex((r) => /한빛 클라우드/.test(r.t));
    const sch2602 = rows.findIndex((r) => /휴학 연장/.test(r.t)), sch1115 = rows.findIndex((r) => /중간 발표/.test(r.t));
    if (seed('R2', cl >= 0, '메일 list rows')) check('R2: 한빛 클라우드 row, read, between 2026-02 학사 and 2025-11-15 졸업작품', cl >= 0 && cl > sch2602 && cl < sch1115 && !rows[cl].un && /소리감지_20251124_032751\.wav · 6분 21초/.test(rows[cl].t), JSON.stringify(rows[cl]));
    else check('live: no 한빛 클라우드 mail', cl < 0, cl >= 0 ? JSON.stringify(rows[cl]) : '');
    await shot('R2_mail_list');
    if (cl >= 0) {
      await page.locator('.ml-row').nth(cl).click(); await sleep(1200);
      const body = await screenText();
      check('R2: cloud_1124 body (file · 6분 21초 · 위치 · 백업 · 보안 폴더 · 원본 삭제)', ['[한빛 클라우드] \'졸업작품\' 폴더에 새 파일 1개가 백업되었습니다', 'cloud@hanbit-arts.ac.kr', '소리감지_20251124_032751.wav', '6분 21초', '졸업작품 › 들리지 않는 방 › 소리감지', '2025.11.24 03:35', '보안 폴더 (개인 암호)', '이 기기의 원본은 삭제되었습니다.', '2025. 11. 24. 오전 3:35'].every((s) => body.includes(s)), body.slice(0, 500));
      check('R2: no link / attachment in the body', await ev(() => !document.querySelector('.ml-view a, .ml-view .ml-att, .ml-view button:not(.sv-back)')), '');
      await shot('R2_mail_cloud_1124');
      await vis('.sv-back').last().click(); await sleep(800);
      const head2 = await ev(() => (document.querySelector('.ml-count') || {}).textContent);
      check('메일: still 읽지 않은 메일 4개 after reading cloud_1124', head2 === '읽지 않은 메일 4개', head2);
    }
    await home();
    check('메일 icon badge still 4', (await badge('mail')) === '4', await badge('mail'));
  };

  /* R6 + search router unchanged */
  ST.browser = async () => {
    const Q = ['해솔동 2구역 철거', '해솔동 2구역 철거 일정', '해솔빌 철거', '철거', '재개발', '2구역', '마포구청', '해솔동', '해솔빌', '카페', 'eps', '실종', '도어락', '112', 'sagongsa', '오르골', '모노', 'haesolvil.kr/as?unit=404'];
    const routes = await ev((Q) => Q.map((q) => { const r = G.STORY.search(q); if (typeof r === 'string') return r; if (!r) return String(r); const n = (r.querySelector('.srp-note') || {}).textContent || ''; return /외부 검색이 제한/.test(n) ? 'blocked' : /검색 결과가 없습니다/.test(n) ? 'noresult' : 'node:' + r.textContent.slice(0, 30); }), Q);
    const EXP = ['blocked', 'blocked', 'cafe', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked', 'cafe', 'cafe', 'cafe_eps', 'news', 'q_admin', 'q_112', 'noresult', 'q_orgel', 'q_phase', 'qr404'];
    const diff = Q.map((q, i) => (routes[i] === EXP[i] ? null : `${q} → ${routes[i]} (want ${EXP[i]})`)).filter(Boolean);
    check('search router unchanged; q_redev unreachable by search', diff.length === 0 && !routes.includes('q_redev'), diff.join(' | '));
    await openApp('browser');
    await sleep(1000);
    // menu → 방문 기록
    const menu = vis('.br-bar button[aria-label="메뉴"], .br-tool button[aria-label="메뉴"], button[aria-label="더보기"], button[aria-label="메뉴"]');
    if (await menu.count()) { await menu.last().click(); await sleep(600); }
    if (await has('button.bm-item')) await clickText('button.bm-item', '방문 기록', { after: 1000 });
    else await ev(() => G.browser.history());
    await sleep(500);
    const hist = await ev(() => [...document.querySelectorAll('.br-hist > *')].map((n) => (n.classList.contains('bh-day') ? '## ' : '') + n.textContent.replace(/\s+/g, ' ').trim()));
    note('history', JSON.stringify(hist));
    const iR = hist.findIndex((t) => /^해솔동 2구역 철거 일정/.test(t));
    const iA = hist.findIndex((t) => /^도어락 관리자 모드 원격 설정/.test(t)), iS = hist.findIndex((t) => /^실종 1년 공소시효/.test(t));
    seed('R6 history', iR >= 0, '방문 기록 rows');
    if (retcon) check("R6: history row '해솔동 2구역 철거 일정 · 6일 전' between 5일 전 and the 이번 달 section", iR === iA + 1 && iS > iR && /search\.daon\.net\/\?q=해솔동\+2구역\+철거/.test(hist[iR] || '') && /6일 전$/.test(hist[iR] || '') && hist[iR + 1] === '## 이번 달', JSON.stringify(hist.slice(Math.max(0, iA - 1), iS + 1)));
    else check('live: no R6 row', iR < 0, iR >= 0 ? hist[iR] : '');
    if (iR >= 0) await ev(() => { const r = [...document.querySelectorAll('.br-hist .bh-row')].find((n) => /해솔동 2구역 철거 일정/.test(n.textContent)); r && r.scrollIntoView({ block: 'center' }); });
    await sleep(400);
    await shot('R6_history');
    if (iR >= 0) {
      await clickText('.br-hist .bh-row', '해솔동 2구역 철거 일정', { after: 1400 });
      const pg = await ev(() => ({ url: ([...document.querySelectorAll('.br-url .bu-t')].filter((n) => n.offsetParent).pop() || {}).textContent, items: [...document.querySelectorAll('.srp-item')].map((n) => [...n.children].map((c) => c.textContent)), q: (document.querySelector('.srp-q') || {}).textContent, seen: !!G.state.seen['page:q_redev'], flagsNew: Object.keys(G.state.flags).filter((f) => /redev|demol|R6/i.test(f)) }));
      note('q_redev', JSON.stringify(pg));
      check('R6: q_redev results (마포구청 · 고시/공고 · 착공 예정 2027. 6. 25. / 동네소식)', pg.url === 'search.daon.net/?q=해솔동+2구역+철거' && pg.items.length === 2 && pg.items[0][0] === '마포구청 · 고시/공고' && pg.items[0][1] === '해솔동 제2구역 주택재개발 해체공사 착공 예정 알림' && pg.items[0][2] === '이주 완료 · 공가 312동 · 착공 예정 2027. 6. 25.' && pg.items[1][0] === '동네소식' && pg.items[1][1] === '"빈집에 새벽마다 발소리"… 철거 앞둔 2구역의 밤' && /해솔동 2구역 철거 일정/.test(pg.q || ''), JSON.stringify(pg));
      check('R6: opening sets no new flag', pg.flagsNew.length === 0, JSON.stringify(pg.flagsNew));
      await shot('R6_q_redev');
      await vis('.srp-item').first().click(); await sleep(1000);
      const off = await ev(() => !!document.querySelector('.br-offline') && [...document.querySelectorAll('.br-offline')].pop().textContent);
      check('R6: result tap → existing offline page', /페이지를 열 수 없습니다/.test(off || ''), off);
      await vis('.sv-back, .br-back, button[aria-label="뒤로"]').last().click().catch(() => {}); await sleep(600);
    }
    await home();
  };

  /* R5 caption (room view, 현관) */
  ST.room = async () => {
    await openApp('camera');
    await sleep(1500);
    await toDoor();
    check('room: 현관 view', (await ev(() => (document.querySelector('.rv-label') || {}).textContent)) === '현관', '');
    await noBanner();
    const fl = await ev(() => document.querySelector('.rv-flash') && document.querySelector('.rv-flash').classList.contains('on'));
    if (!fl) await click('.rv-flash', { after: 600 });
    // at 360×640 the parcel sits under the camera controls: look down (drag up) first, like a player would
    await page.mouse.move(180, 420); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(180, 420 - i * 25); await sleep(25); }
    await page.mouse.up(); await sleep(700);
    await click('.rv-spot[data-id="parcel"]', { after: 900 });
    const cap = await ev(() => (document.querySelector('.rv-caption') || {}).textContent);
    note('parcel caption', cap);
    check('room: 택배 상자 caption shown', !!cap, cap);
    if (seed('R5 caption', !!cap && cap !== '택배 상자. 아직 못 뜯었다.', '택배 상자 caption')) check('R5: 택배 상자 caption', cap === '택배 상자. 받는 사람은 나. 보내는 사람 칸엔 줄 하나뿐이다. …지금 뜯을 때가 아니다.', cap);
    else check('live: old parcel caption', cap === '택배 상자. 아직 못 뜯었다.', cap);
    await shot('R5_parcel_caption');
    await sleep(600);
  };

  ST.memo = async () => {
    await openApp('memo');
    await click('button.mm-card.locked', { after: 1200 });
    await fieldType('.mm-lockbox', 'kongi'); await page.keyboard.press('Enter'); await sleep(1200);
    const e1 = await ev(() => (document.querySelector('.mm-err') || {}).textContent);
    check('P3: wrong memo password kongi rejected', !(await flag('P3')) && /틀렸/.test(e1 || ''), e1);
    await fieldType('.mm-lockbox', 'zhddl'); await page.keyboard.press('Enter');
    check('P3: memo zhddl → P3', await waitFlag('P3', 6000), '');
    await sleep(2000);
    await shot('memo_letter');
    // P4: erase starts at 6 s (or scroll) → undo via ↶ → confirm
    const erased = await waitFn(() => G.memo && /erased|reacting|done/.test(String(G.memo.state())), 25000);
    note('memo state', await ev(() => G.memo.state()));
    check('P4: erase ran (memo state erased)', erased, await ev(() => G.memo.state()));
    await click('button.mm-tb[aria-label="실행 취소"]', { after: 900 });
    if (await has('#overlays .dlg-btn')) await clickText('#overlays .dlg-btn', '실행 취소', { after: 600 });
    check('P4: ↶ undo → M2 (hub)', await waitFlag('M2', 25000), (await ev(() => G.memo.state())));
    await sleep(1500);
    await shot('memo_restored');
  };

  ST.h1 = async () => {
    await openApp('recorder');
    await clickText('button.rc-row', '소리 감지 녹음', { after: 1200 });
    if (!(await has('.rc-playbtn'))) await sleep(800);
    await click('.rc-playbtn', { after: 300 });
    const heard = await waitFlag('doorlockHeard', 12000);
    check('H1: recording played → doorlockHeard', heard, await ev(() => (window.G && G.recorder && G.recorder.pos) ? G.recorder.pos() : '?'));
    await sleep(800);
    await shot('h1_recording');
    await home();
    await openApp('camera'); await sleep(1300);
    await toDoor();
    await click('.rv-spot[data-id="doorlock"]', { after: 1200, force: true });
    await click('button.dk-key[data-k="4"]', { after: 450 });
    await click('button.dk-key[data-k="7"]', { after: 600 });
    check('H1: keypad 4 → 7 → fragment ① 47', await waitFlag('frag47', 5000), '');
    await sleep(1500);
    await shot('h1_keypad_47');
    // trap *0404# (P2 / H5) — time only
    await click('button.dk-key[data-k="*"]', { after: 250 });
    for (const k of '0404') await click(`button.dk-key[data-k="${k}"]`, { after: 250 });
    await click('button.dk-key[data-k="#"]', { after: 500 });
    check('trap *0404# → trap0404', await waitFlag('trap0404', 6000), '');
    check('H5: trap → 관리실 exposed (managerExposed)', await waitFlag('managerExposed', 15000), '');
    await sleep(3500);
    await vis('.cu-back').last().click().catch(() => {}); await sleep(700);
    await home();
  };

  ST.h2 = async () => {
    await openApp('settings');
    const search = vis('.st-search, input.st-search, button.st-search');
    await clickText('button.st-row', '손쉬운 사용', { after: 900 });
    await clickText('button.st-row', '오디오', { after: 900 });
    const tg = vis('.st-row .tg, [role="switch"], .toggle').filter({ has: page.locator('xpath=.') });
    // the 모노 오디오 row's toggle
    await ev(() => { const r = [...document.querySelectorAll('.st-row')].filter((n) => n.offsetParent).find((n) => /모노 오디오/.test(n.textContent)); const t = r && (r.querySelector('[role="switch"]') || r.querySelector('.tg') || r.querySelector('button, i, span:last-child')); (t || r).scrollIntoView({ block: 'center' }); });
    const sw = page.locator('.st-row', { hasText: '모노 오디오' }).filter({ visible: true }).last().locator('[role="switch"], .tg, .st-toggle').first();
    if (await sw.count()) await sw.click(); else await page.locator('.st-row', { hasText: '모노 오디오' }).filter({ visible: true }).last().click();
    await sleep(700);
    const mono = await ev(() => G.audio.isMono());
    check('H2: 설정 › 손쉬운 사용 › 오디오 › 모노 오디오 on', mono, '');
    await shot('h2_mono_on');
    await openApp('recorder');
    await clickText('button.rc-row', '잡음', { after: 1200 });
    await click('.rc-playbtn', { after: 300 });
    check('H2: 잡음 played in mono → fragment ② 29', await waitFlag('frag29', 20000), '');
    await sleep(3200);
    if (await has('.rc-offer-b')) await click('.rc-offer-b', { after: 600 });
    await sleep(600);
    check('H2: mono offer → off', !(await ev(() => G.audio.isMono())), '');
    await shot('h2_frag29');
    await home();
  };

  ST.h3 = async () => {
    await openApp('calculator');
    for (const k of '1124') await click(`button.calc-key[data-k="${k}"]`, { after: 200 });
    await click('button.calc-key[data-k="="]', { after: 2600 });
    check('H3: 1124 = → vault', await waitFlag('vaultOpen', 6000), '');
    await shot('h3_vault');
    await clickText('button.vt-folder', '기타', { after: 1000 });
    const ph = vis('.vt-grid button, .vt-photo, .vt-grid > *');
    await ph.first().click(); await sleep(1300);
    // 편집 → 노출
    const ed = page.locator('button', { hasText: '편집' }).filter({ visible: true });
    if (await ed.count()) { await ed.last().click(); await sleep(1300); }
    const sl = vis('.gs[aria-label="노출"]');
    await sl.last().waitFor({ state: 'visible', timeout: 6000 });
    const b = await sl.last().locator('.gs-track').boundingBox();
    await page.mouse.move(b.x + 2, b.y + b.height / 2); await page.mouse.down();
    for (let i = 1; i <= 14; i++) { await page.mouse.move(b.x + b.width * (0.05 * i), b.y + b.height / 2); await sleep(40); }
    await page.mouse.up();
    check('H3: IMG_0606 노출 70 % held 1 s → fragment ③ 06', await waitFlag('frag06', 6000), await ev(() => document.querySelector('.gs[aria-label="노출"]').getAttribute('aria-valuenow')));
    await sleep(1200);
    await shot('h3_exposure_06');
    check('F3: three fragments', await waitFlag('F3', 3000), (await flags()).filter((f) => /^F\d|^frag/.test(f)).join(','));
    await home();
  };

  ST.h4 = async () => {
    await openApp('memo');
    await clickText('button.mm-card', '이 폰을 찾은 사람에게', { after: 1500 });
    const chip = vis('button.mm-p2card, button.mm-p2chip');
    await chip.last().scrollIntoViewIfNeeded(); await chip.last().click(); await sleep(1200);
    await fieldType('.mm-lockbox', 'dhtwkd'); await page.keyboard.press('Enter');
    check("H4: memo p.2 '옷장' → acrostic", await waitFlag('acrostic', 6000), '');
    await sleep(1500);
    await shot('h4_page2');
    await home();
  };

  ST.h6 = async () => {
    const f2 = await waitFlag('F2', 1000);
    await openApp('talk');
    await clickText('.chat-list .chat-row, .chat-list button', '내 폰', { after: 1400 });
    await click('button.ch-call', { after: 1000 });
    check('H6: call {N} → ringHeard (declined at ring 5)', await waitFlag('ringHeard', 30000), 'F2=' + f2);
    await sleep(5000);
    await home();
  };

  ST.p5 = async () => {
    const b0 = await badge('mail');
    check('메일 badge before the OTP = 4', b0 === '4', b0);
    await openApp('haesol');
    await sleep(2500);
    // wrong login once (time only)
    if (await has('.hh-login button.hh-btn.primary')) { await click('.hh-login button.hh-btn.primary', { after: 1500 }); }
    await clickText('button.hh-link', '비밀번호 찾기', { after: 1200 });
    await fieldType('.hh-form', 'xmfh'); await page.keyboard.press('Enter'); await sleep(1400);
    const err = await ev(() => [...document.querySelectorAll('.hh-err')].map((n) => n.textContent).join('|'));
    check('P5: wrong answer rejected', /일치하지 않습니다/.test(err), err);
    await fieldType('.hh-form', 'dhfmrhf'); await page.keyboard.press('Enter');
    check("P5: '오르골' → OTP sent", await waitFlag('hsQuestion', 6000), '');
    await sleep(2600);
    await shot('p5_otp_screen');
    // read the code in 메일 (the OTP screen's own '메일 앱 열기' link)
    await clickText('button.hh-link', '메일 앱 열기', { after: 2200 });
    const otpRow = page.locator('.ml-row', { hasText: '본인확인 인증번호' }).filter({ visible: true });
    await otpRow.first().waitFor({ state: 'visible', timeout: 8000 });
    await otpRow.first().click(); await sleep(1000);
    const code = await ev(() => ((document.querySelector('.ml-otp') || {}).textContent || '').replace(/\D/g, ''));
    check('P5: OTP mail shows 6 digits', /^\d{6}$/.test(code), code);
    await shot('p5_otp_mail');
    await openApp('haesol'); await sleep(2200);
    for (const k of code) await click(`button.hh-key[aria-label="${k}"]`, { after: 160 });
    await sleep(1200);
    if (await has('#overlays .dlg-btn')) await clickText('#overlays .dlg-btn', '나중에', { after: 1000 });
    check('P5: OTP → M4 (해솔홈 dashboard)', await waitFlag('M4', 6000), '');
    await sleep(1200);
    await shot('p5_dashboard');
  };

  /* R3 */
  ST.indoor = async () => {
    if (!(await has('.hh-tile.off'))) { await openApp('haesol'); await sleep(1500); }
    await click('.hh-tile.off', { after: 1200 });
    const card = await ev(() => {
      const c = [...document.querySelectorAll('.hh-sub .hh-card')].filter((n) => n.offsetParent).pop();
      if (!c) return null;
      const rows = [...c.querySelectorAll(':scope > .hh-row')].map((r) => [r.children[0].textContent, r.children[1].textContent, r.children[1].className]);
      const after = c.nextElementSibling && c.nextElementSibling.textContent;
      const r = c.getBoundingClientRect();
      const last = c.querySelector(':scope > .hh-row:last-child');
      const lines = (n) => { const cs = getComputedStyle(n); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4; return Math.round(n.getBoundingClientRect().height / lh); };
      return { rows, after, bottom: Math.round(r.bottom), vh: innerHeight, handlers: [...c.querySelectorAll('.hh-row')].some((x) => x.onclick), lastLines: last ? [lines(last.children[0]), lines(last.children[1])] : null };
    });
    note('indoor card', JSON.stringify(card));
    seed('R3', !!(card && card.rows.some((r) => r[0] === '이벤트 클립')), '실내 카메라 card rows');
    check('실내 카메라 card: 상태 · 설치 · 등록 · 위치' + (retcon ? ' · (R3 row)' : '') + ', then 다시 연결', card && card.rows.length === (retcon ? 5 : 4) && ['상태', '설치', '등록', '위치'].every((k, i) => card.rows[i][0] === k) && card.after === '다시 연결', JSON.stringify(card));
    if (!retcon) check('live: indoor card has 4 rows', card && card.rows.length === 4, JSON.stringify(card));
    if (retcon) check('R3: 실내 카메라 card rows = 상태·설치·등록·위치·이벤트 클립 (inside the card, .bad)', card && card.rows.length === 5 && card.rows[4][0] === '이벤트 클립' && card.rows[4][1] === '1개 · 2025.11.24 03:29–03:31 · 보관 기간(30일) 만료로 삭제됨' && /bad/.test(card.rows[4][2]) && card.rows[3][0] === '위치' && card.after === '다시 연결', JSON.stringify(card));
    await shot('R3_indoor_camera');
    await click('button.hh-btn.sec', { after: 2400 });
    const toast = await screenText();
    check('R3: 다시 연결 → toast unchanged', /카메라에 연결할 수 없습니다/.test(toast), '');
    await vis('.sv-back').last().click(); await sleep(700);
  };

  ST.p6 = async () => {
    await home();
    await page.mouse.click(180, 14); await sleep(900);
    if (!(await has('.qp-card.cast .qpc-btn'))) { await page.mouse.click(300, 12); await sleep(900); }
    await shot('p6_quickpanel');
    await click('.qp-card.cast .qpc-btn', { after: 800 });
    if (await has('#overlays .dlg-btn')) await clickText('#overlays .dlg-btn', '중지', { after: 800 });
    check('P6: quick panel 화면 공유 [중지] → M5', await waitFlag('M5', 8000), '');
    await sleep(9000); // cut burst
    await home();
  };

  ST.p7 = async () => {
    await openApp('haesol'); await sleep(1800);
    await clickText('button.hh-tile', '기기 관리', { after: 1000 });
    const row = page.locator('.hh-dev, .hh-row, .hh-devrow, div', { hasText: 'SM-G991N' }).filter({ has: page.locator('button.hh-block') }).last();
    await row.locator('button.hh-block').last().click(); await sleep(800);
    await clickText('#overlays .dlg-btn', '차단', { after: 2600 });
    // MFA: 5 prompts — deny ×4 + '요청하지 않았어요' on #3
    for (let i = 0; i < 5; i++) {
      await page.locator('.hh-mfacard:not(.out) button.hh-mb.deny').filter({ visible: true }).last().waitFor({ state: 'visible', timeout: 15000 });
      await sleep(500);
      if (i === 2) await shot('p7_mfa_number');
      await page.locator('.hh-mfacard:not(.out) button.hh-mb.deny').filter({ visible: true }).last().click();
      await sleep(900);
    }
    await clickText('.hh-mfacard button.hh-mb.primary', '보호하기', { after: 3500, timeout: 10000 });
    await clickText('.hh-mfacard button.hh-mb.primary', '확인', { after: 1000, timeout: 10000 });
    check('P7: block sagongsa → deny ×5 → 보호하기 → M6', await waitFlag('M6', 5000), '');
    await shot('p7_protected');
    await home();
  };

  ST.tell = async () => {
    await openApp('talk');
    await clickText('.chat-list .chat-row, .chat-list button', '지민', { after: 1500 });
    for (let n = 0; n < 2; n++) {
      const chip = vis('.chat-chips button.chip');
      await chip.last().waitFor({ state: 'visible', timeout: 20000 });
      await chip.last().click(); await sleep(400);
      await click('button.ci-send', { after: 500 });
      if (n === 0) await waitFn(() => (G.state.vars.reply_jimin || 0) >= 1 && !G.state.vars.replyBusy_jimin, 30000);
    }
    check('지민 chips → jiminTold (112)', await waitFlag('jiminTold', 30000), '');
    await sleep(1500);
    await shot('tell_jimin');
    await home();
  };

  ST.p8 = async () => {
    await openApp('camera'); await sleep(1300);
    await toDoor();
    await click('.rv-spot[data-id="doorlock"]', { after: 1200, force: true });
    for (const k of '472905') await click(`button.dk-key[data-k="${k}"]`, { after: 220 });
    await click('button.dk-key[data-k="#"]', { after: 1500 });
    check('P8: wrong code 472905 does not open', !(await flag('M7')), '');
    await sleep(1200);
    for (const k of '472906') await click(`button.dk-key[data-k="${k}"]`, { after: 220 });
    await click('button.dk-key[data-k="#"]', { after: 800 });
    check('P8: 472906# → M7 (climax)', await waitFlag('M7', 8000), '');
  };

  ST.climax = async () => {
    if (!(await flag('M7'))) { check('climax: skipped (no M7)', false, ''); return; }
    const step = () => ev(() => G.state.vars.climaxStep);
    const waitStep = (s, ms) => waitFn((s) => [].concat(s).includes(G.state.vars.climaxStep), ms || 30000, s);
    check('climax: handle step', await waitStep('handle', 15000), await step());
    await sleep(1500);
    await shot('climax_handle');
    if (await has('.rv-spot[data-id="handle"]')) await click('.rv-spot[data-id="handle"]', { after: 500, force: true });
    else await click('button.cx-bigbtn', { after: 500, force: true });
    check('climax: ajar → hide', await waitStep('hide', 15000), await step());
    await sleep(800);
    if (clean) {
      const hs = await ev(() => (document.querySelector('.cx-hide-s') || {}).textContent || '');
      check("climax hold hint kept; the web keeps its '(PC: …)' aside (O2/O4)", hs === '아무 곳이나 누르고 있으면 화면이 꺼져요 · 손을 떼면 빛이 새어 나가요 (PC: 마우스 또는 Space)', hs);
    }
    await shot('climax_hide');
    // press and hold anywhere (the whole 22.8 s script) — the mom call ends the hold
    const hb = await vis('button.cx-hold').last().boundingBox().catch(() => null);
    const hx = hb ? hb.x + hb.width / 2 : 180, hy = hb ? hb.y + hb.height / 2 : 400;
    await page.mouse.move(hx, hy); await page.mouse.down();
    const call = await waitStep('call', 40000);
    await page.mouse.up();
    check('climax: hold through the script → mom call', call, await step());
    await page.locator('button.cc-dec').filter({ visible: true }).last().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await sleep(600);
    await shot('climax_call');
    const callName = await ev(() => (document.querySelector('.cx-callui .cc-name') || {}).textContent);
    check('climax call: 엄마 (367) (momRead)', /엄마\s*\(367\)/.test(callName || ''), callName);
    await click('button.cc-dec', { after: 500, force: true });
    check('climax: 거절 → quiet/guard', await waitStep(['quiet', 'guard'], 8000), await step());
    check('climax: guard step', await waitStep('guard', 25000), await step());
    await sleep(800);
    await shot('climax_guard');
    // keyboard path: hold → at the ideal speed (ArrowRight) — same as the '길게 눌러' assist button
    await page.keyboard.down('ArrowRight');
    const g = await waitStep(['open', 'slam', 'bell'], 15000);
    await page.keyboard.up('ArrowRight');
    check('climax: door guard slid open', g, await step());
    check('climax: bell step (해솔홈 비상벨)', await waitStep('bell', 40000), await step());
    await sleep(1500);
    await shot('climax_bell');
    await hold('button.hh-bellbtn, button.cb-btn', 2600);
    check('climax: 비상벨 held 2 s → M8', await waitFlag('M8', 8000), await step());
    check('climax: nest', await waitStep('nest', 25000), await step());
    await sleep(1500);
    await shot('climax_nest');
    for (const id of ['orgel', 'polaroids']) { if (await has(`.rv-spot[data-id="${id}"]`)) await click(`.rv-spot[data-id="${id}"]`, { after: 1400, force: true }); }
    check('climax: police → swipe', await waitStep('swipe', 40000), await step());
    await sleep(800);
    await shot('climax_swipe');
    const kn = vis('.cs-knob');
    if (await kn.count()) {
      const b = await kn.last().boundingBox(); const t = await vis('.cs-track').last().boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      for (let i = 1; i <= 12; i++) { await page.mouse.move(b.x + b.width / 2 + (t.width * i) / 12, b.y + b.height / 2); await sleep(30); }
      await page.mouse.up();
    }
    check('climax: swipe the handle → END', await waitFlag('END', 15000), await step());
  };

  ST.ending = async () => {
    if (!(await waitFlag('END', 3000))) { check('ending: skipped (no END)', false, ''); return; }
    const rec = await ev(() => { try { return JSON.parse(localStorage.getItem('haru-escape.series.v1')); } catch (e) { return 'ERR ' + e.message; } });
    note('series', JSON.stringify(rec));
    const e1 = rec && rec.eps && rec.eps['1'];
    check('P-2: END writes haru-escape.series.v1 eps.1 done · live · canon', e1 && e1.st === 'done' && e1.src === 'live' && e1.canon === true && rec.last === 1, JSON.stringify(e1));
    check('P-2: s.e1_jimin / e1_trap / e1_mom recorded', rec && rec.s && rec.s.e1_jimin === true && rec.s.e1_trap === true, JSON.stringify(rec && rec.s));
    const card = [];
    let credits = null;
    for (let i = 0; i < 90; i++) {
      if (await has('.el-btns button')) break;
      if (await has('.end-card p')) { const c = await textOf('.end-card p'); if (c.length > card.length) { card.length = 0; card.push(...c); } }
      if (await has('.end-notif')) { await shot('end_notif'); await click('.end-notif', { after: 1200 }); continue; }
      if (!credits && (await has('.end-credits'))) { credits = await ev(() => { const n = document.querySelector('.end-credits'); return { kids: [...n.children].map((k) => k.className), text: n.innerText.replace(/\s+/g, ' ').trim() }; }); await sleep(1200); await shot('end_credits'); }
      const nx = vis('button.end-next');
      if (await nx.count()) {
        const t = (await nx.last().textContent()).trim();
        await shot('end_' + (t === '엄마에게 보여주기' ? 'mail' : (await has('.end-card')) ? 'card' : 'chat'));
        await nx.last().click().catch(() => {}); await sleep(1300); continue;
      }
      await sleep(1500);
    }
    note('end card', JSON.stringify(card));
    const want = ['경찰은 404호 붙박이장 뒤 배관 점검구에서', '1년 치의 사진과 윤세아 씨의 물건들을 수거했다.', '윤세아 씨의 행방은 아직 찾지 못했다.', '그 남자는 아직 잡히지 않았다.', '지민의 신고로 경찰은 04시 51분에 도착했다.', "해솔빌 관리사무소는 '관리실' 사칭 번호를 신고했다.", '그날 아침, 세아 엄마는 1년 만에 처음으로 전화를 걸지 않았다.'];
    check('ending card: base lines + jiminTold · managerExposed · momRead variants', want.every((w) => card.includes(w)), JSON.stringify(card));
    const lt = await ev(() => ({ btns: [...document.querySelectorAll('.el-btns button')].map((b) => b.textContent), letter: (document.querySelector('.el-text') || {}).textContent }));
    check('ending: friend letter with 진짜로 보내기 · 처음부터', JSON.stringify(lt.btns) === JSON.stringify(['진짜로 보내기', '처음부터']) && /하루야/.test(lt.letter || ''), JSON.stringify(lt));
    await shot('end_letter');
    if (clean) {
      note('credits', JSON.stringify(credits));
      check('credits = the title only (O1)', credits && credits.kids.length === 1 && credits.kids[0] === 'ecr-title' && /위한 방탈출!/.test(credits.text), JSON.stringify(credits));
      // 진짜로 보내기 with the clipboard path (Web Share hidden, writeText captured): message + URL unchanged, short toast (O8)
      await ev(() => {
        window.__copied = null;
        const w = async (t) => { window.__copied = t; };
        try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {}
        try { if (navigator.clipboard) navigator.clipboard.writeText = w; else throw 0; } catch (e) { Object.defineProperty(navigator, 'clipboard', { value: { writeText: w }, configurable: true }); }
      });
      await clickText('.el-btns button', '진짜로 보내기', { after: 500 });
      const sh = await ev(() => ({ copied: window.__copied, toast: ([...document.querySelectorAll('.toast')].pop() || {}).textContent || null }));
      check("진짜로 보내기: message unchanged · toast '복사했어요.' (O8)", sh.toast === '복사했어요.' && typeof sh.copied === 'string' && sh.copied.startsWith('나 404호에서 탈출했어. 비번은 472906이었어. · 하루 '), JSON.stringify(sh));
    }
    // after END: the scheduled mail is in 메일 (unread +1 by design)
    const m = await ev(() => G.mail.unread());
    note('mail unread after END (sea_1yr shows + OTP read):', m);
  };

  /* =================== run =================== */
  const ORDER = QUICK ? ['boot', 'start', 'unlock', 'notebook', 'talk', 'mail', 'browser', 'room', 'memo', 'h1', 'h2', 'h3', 'p5', 'indoor']
    : ['boot', 'start', 'unlock', 'notebook', 'talk', 'mail', 'browser', 'room', 'memo', 'h1', 'h2', 'h3', 'h4', 'h6', 'p5', 'indoor', 'p6', 'p7', 'tell', 'p8', 'climax', 'ending'];
  for (const s of ORDER) {
    log('— stage ' + s + ' (' + base + ')');
    await pin();
    try { await ST[s](); stagesDone.push(s); }
    catch (e) { check('stage ' + s + ' crashed', false, e.message.split('\n')[0]); await shot('FAIL_' + s).catch(() => {}); note('flags', (await flags().catch(() => [])).join(',')); }
    if (UNTIL && s === UNTIL) break;
  }
  if (clean) { const bh = await ev(() => window.__qaBanned || []).catch(() => null); check('cleanup: none of the removed phrases rendered during the run (toasts included)', Array.isArray(bh) && bh.length === 0, JSON.stringify(bh)); }
  check('0 console errors / page errors / failed requests', errors.length === 0, errors.slice(0, 8).join(' || '));
  const store = await ev(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = k === 'haru-escape.save.v1' ? '(save, ' + localStorage.getItem(k).length + ' B)' : localStorage.getItem(k); } return o; }).catch(() => ({}));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ base, retcon, seeds: R, clean, stages: stagesDone, results, notes, errors, store }, null, 1));
  await ctx.close();
  return { base, results, errors };
}

(async () => {
  const srv = BASES.includes('http') ? await serve() : null;
  const origin = srv ? 'http://127.0.0.1:' + srv.address().port : null;
  const browser = await chromium.launch({ headless: !ARG.headed, args: ['--autoplay-policy=no-user-gesture-required'] });
  const all = [];
  try {
    for (const b of BASES) all.push(await run(browser, b, origin));
  } finally {
    await browser.close();
    if (srv) srv.close();
  }
  const fails = all.flatMap((r) => r.results.filter((x) => !x.ok).map((x) => r.base + ': ' + x.label + (x.detail ? ' — ' + x.detail.slice(0, 160) : '')));
  const summary = { root: ROOT, out: OUT, bases: BASES, pass: all.reduce((a, r) => a + r.results.filter((x) => x.ok).length, 0), fail: fails.length, failed: fails, secs: Math.round((Date.now() - T0) / 1000) };
  console.log(JSON.stringify(summary));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
