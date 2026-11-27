'use strict';
/* tools/qa/ep3_root_regress.js — NODE_PATH=<global node_modules> node tools/qa/ep3_root_regress.js · exit 0 = pass */
/* lead regression: ep1 root (file:// + http) boot → title → start → intro → PIN 0317 → M1 · picker before/after the ep3
 * release (Date override) and ?preview=1 · 702 dark/hidden before release, lit after ep3 done · ep3 gate redirect. */
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const OUTD = path.join(ROOT, 'work', 'shots', 'ep3speed', 'root'); fs.mkdirSync(OUTD, { recursive: true });
const res = []; const errs = [];
const ok = (n, c, i) => { res.push({ n, ok: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (c || i === undefined ? '' : '  ' + JSON.stringify(i).slice(0, 400))); };
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
  return new Promise((r) => { const s = http.createServer((q, w) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); fs.readFile(f, (e, d) => { if (e) { w.writeHead(404); w.end('nf'); return; } w.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); w.end(d); }); }).listen(0, () => r(s)); });
}
const KST = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
(async () => {
  const srv = await serve();
  const HTTP = 'http://127.0.0.1:' + srv.address().port;
  const FILE = 'file:///' + ROOT.replace(/\\/g, '/');
  const browser = await chromium.launch({ headless: true });
  async function newPage(label, opts) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    if (opts && opts.time) await ctx.clock.setFixedTime(opts.time);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(label + ' PAGEERROR ' + e.message.slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(label + ' CONSOLE ' + m.text().slice(0, 300)); });
    page.on('requestfailed', (r) => { const t = (r.failure() && r.failure().errorText) || ''; if (!/ERR_ABORTED/.test(t)) errs.push(label + ' REQFAIL ' + r.url().replace(/.*ep3wt/, '') + ' ' + t); });
    page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(label + ' HTTP' + r.status() + ' ' + r.url()); });
    return { ctx, page };
  }

  /* ---------- ep1 root ---------- */
  for (const [label, base] of [['ep1-file', FILE + '/index.html'], ['ep1-http', HTTP + '/']]) {
    const { ctx, page } = await newPage(label);
    await page.goto(base); await page.waitForTimeout(2500);
    const t = await page.evaluate(() => ({ title: document.title, start: [...document.querySelectorAll('button')].some((b) => /시작하기/.test(b.textContent)), link: document.querySelectorAll('[data-qa="title.series"]').length }));
    ok(label + ': title screen with 시작하기', t.start, t);
    try {
      await page.getByText('시작하기', { exact: true }).click(); await page.waitForTimeout(800);
      await page.getByText('알겠어요', { exact: true }).click(); await page.waitForTimeout(1000);
      await page.locator('.title-screen button.title-btn.primary', { hasText: '시작' }).last().click(); await page.waitForTimeout(1500);
      await page.locator('.cine-reach').waitFor({ state: 'visible', timeout: 30000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.G && G.flag && G.flag('introDone'), null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.locator('.lock-screen, .lock').first().click({ position: { x: 195, y: 420 } }).catch(() => {});
      await page.waitForTimeout(800);
      for (const d of '0317') { await page.locator('.lock-pin button.pin-key', { hasText: d }).first().click(); await page.waitForTimeout(200); }
      await page.waitForFunction(() => G.flag('M1'), null, { timeout: 10000 });
      ok(label + ': title → start → intro → PIN 0317 → M1', true);
    } catch (e) { ok(label + ': title → start → intro → PIN 0317 → M1', false, e.message.split('\n')[0]); await page.screenshot({ path: path.join(OUTD, label + '_fail.png') }); }
    await ctx.close();
  }

  /* ---------- picker + ep3 gate around the release ---------- */
  const before = KST(2027, 1, 23, 20, 59), after = KST(2027, 1, 23, 21, 0, 30);
  const DATE_RE = /(20\d\d[-.년 ]+\d{1,2}[-.월 ]+\d{1,2})|\b21:00\b|1월 23일/;
  for (const [proto, root] of [['file', FILE], ['http', HTTP]]) {
    const pk = (q) => root + '/series/' + (proto === 'file' ? 'index.html' : '') + (q || '');
    const e3 = (q) => root + '/ep3/' + (proto === 'file' ? 'index.html' : '') + (q || '');
    // before release, no preview
    let { ctx, page } = await newPage(proto + '-before', { time: before });
    await page.goto(pk()); await page.waitForTimeout(1500);
    let st = await page.evaluate(() => ({ rel: document.documentElement.dataset.released, lit: document.documentElement.dataset.lit, ep3: !!document.querySelector('[data-qa="picker.ep:3"]'),
      w702: !!document.querySelector('#w702'), body: document.body.innerText, win702link: !!document.querySelector('[data-qa="picker.win:702"]') }));
    ok(proto + ' before release: no ep3 row, 702 dark plain window, no 702 label', !st.ep3 && !(st.rel || '').split(',').includes('3') && !/엄마의 번호|702/.test(st.body) && !st.win702link, st);
    ok(proto + ' before release: no dates on screen', !DATE_RE.test(st.body), st.body.slice(0, 300));
    await page.screenshot({ path: path.join(OUTD, 'picker_before_' + proto + '.png') });
    await page.goto(e3()); await page.waitForTimeout(2000);
    ok(proto + ' before release: ep3 URL redirects to the picker', /series\/(index\.html)?$/.test(page.url().split('?')[0]), page.url());
    await page.goto(e3('?preview=1')); await page.waitForTimeout(2500);
    ok(proto + ' before release: ep3 ?preview=1 opens', /ep3/.test(page.url()) && !!(await page.$('[data-qa="title.start"]')), page.url());
    const tl = await page.evaluate(() => { const a = document.querySelector('[data-qa="title.series"]'); return a ? a.getAttribute('href') : null; });
    ok(proto + ' ep3 title link keeps ?preview=1', /preview=1/.test(tl || ''), tl);
    await page.goto(pk('?preview=1')); await page.waitForTimeout(1500);
    st = await page.evaluate(() => { const a = document.querySelector('[data-qa="picker.ep:3"]'); return { a: !!a, href: a && (a.getAttribute('href') || (a.querySelector('a') && a.querySelector('a').getAttribute('href'))), body: document.body.innerText }; });
    ok(proto + ' ?preview=1 before release: ep3 row with ?preview=1 link', st.a && /ep3\/(index\.html)?\?preview=1/.test(st.href || ''), st);
    ok(proto + ' ?preview=1: no dates on screen', !DATE_RE.test(st.body), st.body.slice(0, 300));
    await page.screenshot({ path: path.join(OUTD, 'picker_preview_' + proto + '.png') });
    await ctx.close();
    // after release
    ({ ctx, page } = await newPage(proto + '-after', { time: after }));
    await page.goto(pk()); await page.waitForTimeout(1500);
    st = await page.evaluate(() => { const a = document.querySelector('[data-qa="picker.ep:3"]'); return { a: !!a, href: a && (a.getAttribute('href') || (a.querySelector('a') && a.querySelector('a').getAttribute('href'))), rel: document.documentElement.dataset.released, lit: document.documentElement.dataset.lit, body: document.body.innerText }; });
    ok(proto + ' after release: ep3 row, plain link', st.a && /ep3\/(index\.html)?$/.test(st.href || '') && (st.rel || '').split(',').includes('3'), st);
    ok(proto + ' after release: 702 not lit while ep3 not done', !(st.lit || '').split(',').includes('3'), st.lit);
    ok(proto + ' after release: no dates on screen', !DATE_RE.test(st.body), st.body.slice(0, 300));
    await page.goto(e3()); await page.waitForTimeout(2500);
    ok(proto + ' after release: ep3 opens without debug/preview', !!(await page.$('[data-qa="title.start"]')), page.url());
    // ep3 done → 702 lit (+ ♪ when sig_name)
    await page.evaluate(() => { G.series.patch((r) => { r.eps['3'] = { st: 'done', on: '2027-01-23', min: 40, hints: 0, src: 'play', canon: true }; r.sea = (r.sea || []).concat(['sig_name']); }); });
    await page.goto(pk()); await page.waitForTimeout(1500);
    st = await page.evaluate(() => ({ lit: document.documentElement.dataset.lit, sig: document.documentElement.dataset.sig, body: document.body.innerText }));
    ok(proto + ' ep3 done: 702 lit (+ ♪) — data-lit / data-sig list episode numbers', (st.lit || '').split(',').includes('3') && (st.sig || '').split(',').includes('3'), st);
    ok(proto + ' ep3 done: no dates on screen', !DATE_RE.test(st.body), st.body.slice(0, 300));
    await page.screenshot({ path: path.join(OUTD, 'picker_done_' + proto + '.png') });
    await ctx.close();
  }
  console.log('ERRORS', errs.length); errs.forEach((e) => console.log('  ' + e));
  const pass = res.every((r) => r.ok) && !errs.length;
  console.log(JSON.stringify({ pass, n: res.length, failed: res.filter((r) => !r.ok).map((r) => r.n) }));
  await browser.close(); srv.close();
  process.exit(pass ? 0 : 1);
})();
