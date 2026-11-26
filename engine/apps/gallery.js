/* =========================================================
 * 갤러리 (owner: media) — DESIGN §4.5 (both users) · §3.10 갤러리 · §3.17 01:40 받은 파일 · §4.10.4 ·
 * §9.4 cb.ring · §9.8 missing assets · §5.6 '끄는 것' (no LIVE, no edit, no 1년 전 오늘, no shared album).
 *
 * {N}   : `사진 없음` / `다온 클라우드 계정이 없습니다` · album `카메라` (vars.shots from the room camera —
 *         progress 0) · after 01:40 album `받은 파일 4` (viewer `1 / 4`, 강수진's one line under ②).
 * '—'   : `0310 11` (+ grey `원본을 불러올 수 없습니다 · 계정 없음` + 214 grey cells → same toast) ·
 *         `옥상 15` (14 window photos + 0:12 video) · ⋮ `숨긴 항목 보기` · `설정` (`숨긴 항목 1|2`).
 *         No share / delete / long-press menu anywhere ('—' is view-only — §3.10 삭제 0).
 * Video : G.ui.framePlayer (core) — frames + WebAudio track via G.media, `출력:` line, 🔊 → volume panel;
 *         a local fallback player with the same contract runs when core's widget is absent.
 *         seenHinge = playback crosses 10.0 s of the move video · seenWhistle = 8.0 s of the roof video.
 *
 * Public API : G.gallery = { open({user, album}), receive() → Promise<void>, openReceived(i) }
 * Hooks set  : 'gallery:receive' (flow ending 01:40 [받기])
 * Flags set  : dashA0310 dashARoof dashHidden seenKey404 seenHinge seenWhistle photo4Seen seenHangyeol
 * Bus        : 'gallery:album' {user, id} · 'gallery:view' {id} · 'video:time' {id, t}
 * Vars       : vars.md.received (bool) · reads vars.shots (room camera)
 * data-qa    : gallery.album:<id> gallery.item:<id> gallery.menu gallery.hidden gallery.info
 *              viewer.next viewer.prev viewer.close (+ framePlayer video.play / video.seek / video.vol)
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[gallery] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, I = MU.ICON;
  const GL = (G.gallery = G.gallery || {});
  const GD = () => (G.STORY && G.STORY.gallery) || { n: { empty: [] }, dash: { albums: [] }, received: { items: [] } };

  /* ---------------- model ---------------- */
  const tOf = (it) => { const d = MU.parseT(it.t); return d ? +d : 0; };
  const byNewest = (a, b) => tOf(b) - tOf(a);
  const visible = (it) => { if (!it.show) return true; try { return !!it.show(MU.cb); } catch (e) { return false; } };
  function shotItems() {
    const shots = (G.state && G.state.vars && G.state.vars.shots) || [];
    return shots.map((s, i) => {
      const d = s.t > 1e11 ? new Date(s.t) : null;
      const when = d ? `${d.getFullYear()}.${MU.pad(d.getMonth() + 1)}.${MU.pad(d.getDate())} ${MU.fmtK(d)}` : '';
      return { id: 'shot' + i, src: s.src || '', key: s.key || s.view || '', alt: s.view ? s.view + '_s0' : '', tms: s.t || 0,
               info: [[when, T(GD().n.cameraInfo || '')].filter(Boolean).join(' · ')] };
    }).sort((a, b) => b.tms - a.tms);
  }
  const received = () => MU.flag('nearbyTaken') || !!MU.md().received;
  function receivedItems() { const R = GD().received || {}; return (R.items || []).map((it) => Object.assign({ info: [R.info] }, it)); }
  function albumsFor(user) {
    if (user === 'dash') return (GD().dash.albums || []).map((a) => Object.assign({}, a, { list: a.items.filter(visible).slice().sort(byNewest) }));
    const out = [];
    const shots = shotItems();
    if (shots.length) out.push({ id: 'camera', name: GD().n.cameraAlbum, list: shots });
    if (received()) out.push({ id: 'received', name: GD().received.album, list: receivedItems() });
    return out;
  }
  function albumById(user, id) { return albumsFor(user).find((a) => a.id === id) || null; }
  function srcOf(it) { return it.src || MU.img(it.video ? (it.thumb || (it.video.frames[0] || {}).key) : it.key) || (it.alt ? MU.img(it.alt) : ''); }
  function setFlags(f) { (Array.isArray(f) ? f : [f]).forEach((n) => { if (n && !MU.flag(n)) MU.flag(n, true); }); }

  /* ---------------- app ---------------- */
  MU.app('gallery', {
    name: '갤러리',
    icon: (G.ICONS && G.ICONS.gallery) || { bg: 'linear-gradient(160deg,#ff7a59,#e0306a)', svg: I.photo },
    badge: () => 0,
    open(p) {
      p = p || {};
      const user = p.user || MU.user();
      home(user);
      if (p.album) openAlbum(user, p.album);
    },
  });
  GL.open = function (o) { o = o || {}; if (G.phone && G.phone.openApp) G.phone.openApp('gallery', o); };

  function home(user) {
    const content = el('div.md2-gal-home');
    const right = [];
    if (user === 'dash') right.push(MU.iconBtn(I.more, '더보기', 'gallery.menu', () => dashMenu(scr)));
    const scr = MU.screen({ title: T(GD().title || '갤러리'), cls: 'md2-gal', body: content, right });
    if (user === 'dash') MU.noMenu(scr);
    function render() {
      content.innerHTML = '';
      const albums = albumsFor(user);
      if (!albums.length) {
        const e = GD().n.empty || [];
        content.appendChild(el('div.md2-empty.tall', null, el('span.md2-empty-ic', { html: I.photo }), e[0] ? el('b', null, T(e[0])) : null, e[1] ? el('small', null, T(e[1])) : null));
        return;
      }
      const grid = el('div.md2-albums');
      albums.forEach((a) => {
        const first = a.list[0];
        const cover = el('div.md2-alb-cover');
        if (first) { const src = srcOf(first); if (src) { const im = el('img', { alt: '', draggable: 'false', src }); im.addEventListener('error', () => im.remove()); cover.appendChild(im); } }
        const b = el('button.md2-alb', { type: 'button' }, cover,
          el('span.md2-alb-name', null, T(a.name)), el('span.md2-alb-n', null, String(a.list.length)));
        MU.qa(b, 'gallery.album:' + a.id);
        b.addEventListener('click', () => { MU.sfx('tap'); openAlbum(user, a.id); });
        grid.appendChild(b);
      });
      content.appendChild(grid);
    }
    render();
    MU.push(scr, { onResume: render, appId: 'gallery' });
  }

  function dashMenu(scr) {
    const m = GD().dash.menu || [];
    MU.menu(scr, [
      { label: m[0], qa: 'gallery.hidden', onClick: () => openHidden() },
      { label: m[1], qa: 'gallery.settings', onClick: () => openSettings() },
    ]);
  }

  /* ---------------- grids ---------------- */
  function cell(it, onOpen) {
    const b = el('button.md2-cell', { type: 'button', 'aria-label': it.video ? '동영상' : '사진' });
    MU.qa(b, 'gallery.item:' + it.id);
    const src = srcOf(it);
    if (src) {
      const im = el('img', { alt: '', draggable: 'false', decoding: 'async', src });
      im.addEventListener('error', () => { im.remove(); b.classList.add('miss'); if (it.hideIfMissing) b.remove(); });
      b.appendChild(im);
    } else { b.classList.add('miss'); if (it.hideIfMissing) return null; }
    if (it.video) b.appendChild(el('span.md2-vbadge', { html: I.play + `<b>${MU.fmtDur(it.video.dur)}</b>` }));
    b.addEventListener('click', () => { MU.sfx('tap'); onOpen(); });
    return b;
  }
  function grid(list, opts) {
    const g = el('div.md2-grid');
    list.forEach((it, i) => { const c = cell(it, () => viewer(list, i, opts)); if (c) g.appendChild(c); });
    return g;
  }

  function openAlbum(user, id) {
    const a = albumById(user, id);
    if (!a) return;
    const body = el('div.md2-alb-body');
    const scr = MU.screen({ title: T(a.name), sub: a.count ? T(a.count) : null, cls: 'md2-gal', body });
    if (user === 'dash') MU.noMenu(scr);
    function render() {
      body.innerHTML = '';
      const cur = albumById(user, id) || a;
      body.appendChild(grid(cur.list, { user, album: id }));
      if (cur.ghost) {
        const txt = T(cur.ghost.text);
        body.appendChild(el('div.md2-ghost-h', null, el('span', { html: I.cloudOff }), txt));
        const gg = el('div.md2-grid.ghost');
        for (let i = 0; i < cur.ghost.n; i++) {
          const c = el('button.md2-cell.ghost', { type: 'button', 'aria-label': txt, html: I.cloudOff });
          c.addEventListener('click', () => { MU.sfx('tap'); MU.toast(txt); });
          gg.appendChild(c);
        }
        body.appendChild(gg);
      }
    }
    render();
    MU.push(scr, { onResume: render });
    if (a.flag) setFlags(a.flag);
    MU.emit('gallery:album', { user, id });
  }

  function hiddenList() { const H = GD().dash.hidden || { items: [] }; return H.items.filter(visible).slice().sort(byNewest); }
  function openHidden() {
    const H = GD().dash.hidden || { items: [] };
    const body = el('div.md2-alb-body');
    const scr = MU.screen({ title: T(H.title || ''), cls: 'md2-gal', body });
    MU.noMenu(scr);
    body.appendChild(grid(hiddenList(), { user: 'dash', album: 'hidden' }));
    MU.push(scr);
    if (H.flag) setFlags(H.flag);
    MU.emit('gallery:album', { user: 'dash', id: 'hidden' });
  }
  function openSettings() {
    const D = GD().dash;
    const row = el('button.md2-row', { type: 'button' }, el('span.md2-row-t', null, T(D.settingsRow || '')), el('span.md2-chev', { html: I.next }));
    MU.qa(row, 'gallery.settings.hidden');
    row.addEventListener('click', () => { MU.sfx('tap'); openHidden(); });
    const scr = MU.screen({ title: T(D.settingsTitle || ''), cls: 'md2-gal md2-plain', body: el('div.md2-rows', null, row) });
    MU.noMenu(scr);
    MU.push(scr);
  }

  /* ---------------- viewer ---------------- */
  function viewer(list, index, opts) {
    opts = opts || {};
    let idx = Math.max(0, Math.min(list.length - 1, index || 0));
    const stage = el('div.md2-v-stage');
    const kang = el('div.md2-kang');
    const counter = el('div.md2-v-count');
    const btnPrev = MU.iconBtn(I.prev, '이전', 'viewer.prev', () => go(-1));
    const btnNext = MU.iconBtn(I.next, '다음', 'viewer.next', () => go(1));
    const btnInfo = MU.iconBtn(I.info, '정보', 'gallery.info', () => toggleInfo());
    const top = el('div.md2-v-top', null, MU.iconBtn(I.arrowBack || I.back, '뒤로', 'viewer.close', () => MU.back()), counter, el('span.md2-sp'), btnPrev, btnNext);
    const bottom = el('div.md2-v-bot', null, btnInfo);
    const scr = el('section.md2-viewer.md2-scr', { dataset: { theme: 'dark', status: 'light' } }, top, stage, kang, bottom);
    scr.body = stage;
    MU.noMenu(scr);
    let player = null, info = null;
    const cur = () => list[idx];
    function stopPlayer() {
      if (!player) return;
      try { player.pause && player.pause(); } catch (e) {}
      try { const st = G.media && G.media.state && G.media.state(); if (st && st.playing && st.from === 'gallery') G.media.stopAll(); } catch (e) {}
      try { player.dispose && player.dispose(); } catch (e) {}
      player = null;
    }
    function show() {
      stopPlayer();
      if (info) { info.close(); info = null; }
      const it = cur();
      stage.innerHTML = '';
      counter.textContent = `${idx + 1} / ${list.length}`;
      btnPrev.style.visibility = idx > 0 ? '' : 'hidden';
      btnNext.style.visibility = idx < list.length - 1 ? '' : 'hidden';
      if (it.video) {
        player = makePlayer(it);
        stage.appendChild(el('div.md2-v-video', null, player.node));
      } else stage.appendChild(photoNode(it));
      kang.innerHTML = '';
      const said = opts.received && it.kang ? T(it.kang) : '';
      kang.classList.toggle('on', !!said);
      if (said) kang.append(el('b', null, T(GD().received.speaker || '')), el('span', null, said));
      if (it.seen) setFlags(it.seen);
      MU.emit('gallery:view', { id: it.id });
    }
    function photoNode(it) {
      const src = srcOf(it);
      const missing = () => {
        const box = el('div.md2-v-miss');
        if (it.fallbackText) box.appendChild(el('div.md2-sticker', null, T(it.fallbackText)));   // §9.8: DOM sticker card
        return box;
      };
      if (!src) return missing();
      if (G.ui && G.ui.zoomViewer) {
        let zv = null;
        try { zv = G.ui.zoomViewer(src, { maxScale: 3 }); } catch (e) { zv = null; }
        if (zv) {
          const im = zv.img || zv.querySelector('img');
          if (im) im.addEventListener('error', () => { const m = missing(); zv.replaceWith(m); });
          zv.classList.add('md2-zv');
          return zv;
        }
      }
      const im = el('img.md2-v-img', { alt: '', draggable: 'false', src });
      im.addEventListener('error', () => im.replaceWith(missing()));
      return im;
    }
    function go(d) { const ni = idx + d; if (ni < 0 || ni >= list.length) return; idx = ni; show(); }
    function toggleInfo() {
      if (info && info.open) { info.close(); info = null; return; }
      const it = cur();
      info = MU.panel(scr, (it.info || []).map((s) => T(s)), { cls: 'dark', onClose: () => { info = null; } });
    }
    // swipe (photos at 1× only)
    let sx = null;
    stage.addEventListener('pointerdown', (e) => {
      const zv = stage.querySelector('.zoom-box');
      const z1 = !zv || !zv.dataset.zoom || zv.dataset.zoom === '1.00';
      sx = !cur().video && z1 ? e.clientX : null;
    });
    stage.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1); });
    const onKey = (e) => {
      if (!MU.isTop(scr) || (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())) return;
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    MU.push(scr, { anim: 'fade', onClose: () => { document.removeEventListener('keydown', onKey); stopPlayer(); opts.onClose && opts.onClose(); } });
    show();
    return scr;
  }

  /* ---------------- video ---------------- */
  function bufferOf(id) { try { if (G.audio && G.audio.buffer) return G.audio.buffer(id); } catch (e) {} return Promise.resolve(null); }
  function makePlayer(it) {
    const v = it.video;
    const onReach = {};
    Object.keys(v.reach || {}).forEach((sec) => { const f = v.reach[sec]; onReach[sec] = () => setFlags(f); });
    const o = { id: it.id, frames: v.frames, dur: v.dur, getBuffer: () => bufferOf(v.buffer), subs: v.subs || [], from: 'gallery',
                onReach, onTime: (t) => MU.emit('video:time', { id: it.id, t }), qa: 'video' };
    if (G.ui && G.ui.framePlayer) { try { const p = G.ui.framePlayer(o); if (p && p.node) return p; } catch (e) { console.error('[gallery] framePlayer', e); } }
    return fallbackPlayer(o);
  }

  /* Local stand-in for core's G.ui.framePlayer (same contract) — used only when the widget is absent. */
  function fallbackPlayer(o) {
    const frames = (o.frames || []).map((f) => { const im = MU.imgEl(f.key, 'md2-fp-f'); im.style.opacity = '0'; return { f, im }; });
    const screenBox = el('div.md2-fp-screen', null, frames.map((x) => x.im), el('div.md2-fp-sub'));
    const sub = screenBox.querySelector('.md2-fp-sub');
    const playBtn = el('button.md2-fp-play', { type: 'button', 'aria-label': '재생', html: I.play });
    MU.qa(playBtn, (o.qa || 'video') + '.play');
    const fill = el('i.md2-fp-fill'), knob = el('i.md2-fp-knob');
    const bar = el('div.md2-fp-bar', { role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': o.dur, 'aria-valuenow': 0 }, el('i.md2-fp-track'), fill, knob);
    MU.qa(bar, (o.qa || 'video') + '.seek');
    const tl = el('span.md2-fp-time');
    const vol = el('button.md2-fp-vol', { type: 'button', 'aria-label': '볼륨', html: I.vol });
    MU.qa(vol, (o.qa || 'video') + '.vol');
    const out = el('div.md2-fp-out');
    const node = el('div.md2-fp', null, screenBox, el('div.md2-fp-ctl', null, playBtn, bar, tl, vol), out);
    let pos = 0, playing = false, handle = null, t0 = 0, raf = 0, reached = {}, loading = false, disposed = false;
    const recs = (G.STORY && G.STORY.recordings) || {};
    function outLine() { let tgt = 'phone'; try { tgt = G.media && G.media.out ? G.media.out() : 'phone'; } catch (e) {} out.textContent = T(tgt === 'bt' ? (recs.outBt || '출력: 2층_스피커') : (recs.outPhone || '출력: 이 휴대전화')); }
    function render() {
      const p = Math.min(o.dur, pos);
      frames.forEach((x) => { x.im.style.opacity = p >= x.f.t0 && (p < x.f.t1 || x.f.t1 >= o.dur) ? '1' : '0'; });
      const pct = (p / o.dur) * 100; fill.style.width = pct + '%'; knob.style.left = pct + '%';
      bar.setAttribute('aria-valuenow', p.toFixed(1));
      tl.textContent = loading ? MU.STR('loading') : `${MU.fmtDur(p)} / ${MU.fmtDur(o.dur)}`;
      const all = G.settings && G.settings.subs === 'all';
      const s = playing ? (o.subs || []).find((x) => p >= x.t0 && p < x.t1 && (x.kind !== 'mood' || all)) : null;
      sub.textContent = s ? T(s.text) : ''; sub.classList.toggle('on', !!s);
      playBtn.innerHTML = playing ? I.pause : I.play;
    }
    function curPos() { if (handle && handle.position) { try { return handle.position(); } catch (e) {} } return pos + (performance.now() - t0) / 1000; }
    function loop() {
      if (!playing || disposed) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) { t0 = performance.now(); return; }
      const prev = pos;
      let p = curPos();
      if (!handle) t0 = performance.now();
      if (p >= o.dur) p = o.dur;
      Object.keys(o.onReach || {}).forEach((k) => { const at = parseFloat(k); if (!reached[k] && prev < at && p >= at && p - prev < 1.5) { reached[k] = true; try { o.onReach[k](); } catch (e) {} } });
      pos = p;
      o.onTime && o.onTime(pos);
      if (pos >= o.dur) { stop(true); return; }
      render();
    }
    function start() {
      if (playing) return;
      if (pos >= o.dur - 0.05) pos = 0;
      playing = true; t0 = performance.now(); handle = null;
      if (G.media && G.media.play) {
        try {
          const p = o.getBuffer ? o.getBuffer() : null;
          loading = true;
          Promise.resolve(p).then(() => { loading = false; });
          handle = G.media.play(p, { from: o.from || 'gallery', id: o.id, offset: pos, onEnd: () => { if (playing) stop(true); } });
        } catch (e) { console.error('[gallery] media.play', e); handle = null; loading = false; }
      }
      render(); loop();
    }
    function stop(ended) {
      if (handle) { try { handle.stop(); } catch (e) {} handle = null; }
      playing = false; cancelAnimationFrame(raf);
      if (ended) { pos = o.dur; o.onEnd && o.onEnd(); }
      render();
    }
    function pause() { if (!playing) return; pos = Math.min(o.dur, curPos()); stop(false); }
    function seek(t) { const was = playing; if (was) pause(); pos = Math.max(0, Math.min(o.dur, t)); render(); if (was) start(); }
    playBtn.addEventListener('click', () => { MU.sfx('tap'); if (playing) pause(); else start(); });
    vol.addEventListener('click', () => { MU.sfx('tap'); try { G.phone && G.phone.volume && G.phone.volume({ focus: 'media' }); } catch (e) {} });
    let drag = false;
    const posX = (x) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * o.dur; };
    bar.addEventListener('pointerdown', (e) => { drag = true; try { bar.setPointerCapture(e.pointerId); } catch (er) {} if (playing) pause(); pos = posX(e.clientX); render(); });
    bar.addEventListener('pointermove', (e) => { if (drag) { pos = posX(e.clientX); render(); } });
    bar.addEventListener('pointerup', () => { drag = false; });
    const offs = [MU.on('media:out', outLine), MU.on('bt:change', outLine), MU.on('media:stop', (d) => { if (d && d.id === o.id && d.reason !== 'end' && playing) { pos = Math.min(o.dur, curPos()); playing = false; handle = null; cancelAnimationFrame(raf); render(); } })];
    outLine(); render();
    return { node, play: start, pause, seek, pos: () => pos, playing: () => playing, dispose() { disposed = true; pause(); offs.forEach((f) => f && f()); } };
  }

  /* ---------------- 01:40 near-share receive (flow ending) ---------------- */
  GL.receive = function () {
    return new Promise((resolve) => {
      let done = false;
      const fin = () => { if (done) return; done = true; resolve(); };
      try {
        MU.mdSet({ received: true });
        MU.sfx('tap');   // 사진 받기 완료 — §6.2 B21
        if (G.phone && G.phone.renderHome) { try { G.phone.renderHome(); } catch (e) {} }
        viewer(receivedItems(), 0, { received: true, onClose: fin });
      } catch (e) { console.error('[gallery] receive', e); fin(); }
    });
  };
  GL.openReceived = function (i) { return viewer(receivedItems(), i || 0, { received: true }); };
  if (G.hooks && G.hooks.set) G.hooks.set('gallery:receive', () => GL.receive());

  if (G.DEBUG && window.haru) {
    window.haru.gallery = { open: (user, album) => GL.open({ user, album }), receive: () => GL.receive(), hidden: () => openHidden() };
  }
})();
