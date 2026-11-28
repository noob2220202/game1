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
 *
 * ---- ep3 branch (G.STORY.gallery.v === 3 — ep2 data has no `v`, so ep2 never reaches it · ARCH_EP3 §3.3 · §4.1) ----
 * DESIGN_EP3 §3.10 (shared album '콩이') · §3.20.2 · §4.6 · §5.1 사진 row · §5.8 data-scr · §8.1 (3,041 grid) ·
 * §9.5-4 ('줄이 그려짐' = ≥ 60 % visible for 200 ms · saw702 · zoom 1–3×: pinch · double-tap 2× ↔ 1× · wheel / '+' '-') ·
 * §9.8 (missing image = grey cell, no error text) · §12.2 V23 V25 V31.
 * 사진 3,041 virtual grid (dated photos once at their own date · 72 seeded CSS variants of five 콩이 photos) + room-camera
 * shots on top (`오늘`) · tabs 사진 / 앨범 · albums 카메라 3,041 · 옛날 사진 2 · 공유 앨범 '콩이' 8 (head + avatar row →
 * 멤버 · ⋮ 멤버 / 활동 / 앨범 정보 · member detail · activity rows · deleted photo) · viewer (date top · caption /
 * comments · ⓘ 올린 사람 / 봄 or date / 카메라 · ♡ · prev / next / swipe). No delete / share / edit / hide / LIVE.
 * Public API : G.gallery = { init(), open({ tab:'photos'|'albums', album, photo }), current() → {scr, album, photo, info}|null }
 * Bus emitted: 'gallery:album' {id} · 'gallery:photo' {photo, open, info, door} (photo / its ⓘ opened or closed — core
 *              e3 queues mono2 on {door:true, open:false} once albumDone) · 'gallery:zoom' {photo, scale, ms}
 * Bus heard  : 'tick' (saw702 timing, only while a viewer is open) · 'flag' (albumDone) · 'settings' (grid re-layout)
 * Flags set  : albumOpened membersSeen bomSeen albumDone saw702        Vars: vars.gal {zoomMs, fullMs}   (reads vars.shots)
 * data-scr   : gallery.grid gallery.albums gallery.old gallery.shared gallery.shared.members gallery.shared.member
 *              gallery.shared.activity gallery.shared.info gallery.photo gallery.photo.door (+ data-photo 1224 1213 1204 1130)
 *              gallery.photo.soup2601 gallery.photo.cake2411 gallery.deleted
 * data-qa    : gallery.tab:photos|albums gallery.album:<id> gallery.more gallery.members gallery.activity gallery.albuminfo
 *              gallery.avatars gallery.member:<id> gallery.act:<i> gallery.photo:<id> gallery.grid:<i> viewer.img viewer.info
 *              viewer.like viewer.close viewer.next viewer.prev
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const MU = G.mdu;
  if (!MU) { console.error('[gallery] media helpers missing (engine/apps/phone.js)'); return; }
  const el = MU.el, T = MU.T, I = MU.ICON;
  const GL = (G.gallery = G.gallery || {});
  const GD = () => (G.STORY && G.STORY.gallery) || { n: { empty: [] }, dash: { albums: [] }, received: { items: [] } };
  const isV3 = () => GD().v === 3;                 // ep3 data marker (ARCH_EP3 §4.1-3) — ep2 data has no `v`

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
    get name() { return isV3() ? (GD().name || '사진') : '갤러리'; },
    icon: (G.ICONS && G.ICONS.gallery) || { bg: 'linear-gradient(160deg,#ff7a59,#e0306a)', svg: I.photo },
    badge: () => 0,
    open(p) {
      p = p || {};
      if (isV3()) { V3.open(p); return; }
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

  /* =========================================================================================================
   * ep3 — G.STORY.gallery.v === 3 (DESIGN_EP3 §3.10 · §4.6 · §8.1 · §9.5-4). Nothing below runs on the ep2 page.
   * ========================================================================================================= */
  const V3 = {};
  const W3 = MU.WEEK || ['일', '월', '화', '수', '목', '금', '토'];
  const p2 = MU.pad;
  const FB3 = { photoDeleted: '삭제된 사진입니다' };   // = G.e3.STR (DESIGN §10 A) — only for partial builds
  const T3 = (s) => T(typeof s === 'string' ? s.replace(/\{\$([a-zA-Z0-9_]+)\}/g, (m, k) => MU.STR(k) || FB3[k] || m) : s);
  const ymdOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const fmtN = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function nowD() { let d = null; try { d = MU.now(); } catch (e) { d = null; } return d && !isNaN(d.getTime()) ? d : new Date(2027, 0, 24, 3, 35); }
  /** §0.1 #18 — a date outside the in-game year carries its year · the in-game day = 오늘 */
  function dayLabel(d) {
    const n = nowD();
    if (ymdOf(d) === ymdOf(n)) return T3(GD().today || '');
    return (d.getFullYear() !== n.getFullYear() ? `${d.getFullYear()}년 ` : '') + `${d.getMonth() + 1}월 ${d.getDate()}일 (${W3[d.getDay()]})`;
  }
  const topLine = (d) => `${dayLabel(d)} ${MU.fmtK(d)}`;                                     // viewer top · §4.6.1
  const infoLine = (d) => `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} (${W3[d.getDay()]}) ${MU.fmtK(d)}`;   // ⓘ
  function setFlag3(n) {
    if (!n) return;
    if (!MU.flag(n)) MU.flag(n, true);
    if (n === 'membersSeen' || n === 'bomSeen') checkAlbumDone();
  }
  function checkAlbumDone() { if (isV3() && MU.flag('membersSeen') && MU.flag('bomSeen') && !MU.flag('albumDone')) MU.flag('albumDone', true); }
  function setScr(node, entry, scr) { node.dataset.scr = scr; if (entry && typeof entry === 'object') { try { entry.scr = scr; } catch (e) {} } }
  function push3(node, scr, opts) { node.dataset.scr = scr; const e = MU.push(node, opts || {}); setScr(node, e, scr); return e; }
  function scr3(o) { const s = MU.screen(o); s.classList.add('md3-gal'); MU.noMenu(s); return s; }
  const IC3 = {
    album: '<svg viewBox="0 0 24 24"><rect x="3.5" y="7" width="13.5" height="13" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 4h11a2.5 2.5 0 012.5 2.5V16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.2s-7.6-4.6-7.6-10.1A4.3 4.3 0 0112 7.4a4.3 4.3 0 017.6 2.7c0 5.5-7.6 10.1-7.6 10.1z" fill="var(--md3-heart-fill, none)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  };

  /* ---------------- model: the camera roll (3,041 + shots) ---------------- */
  function rng32(seed) {   // mulberry32 — fixed seed, so every player and every reload sees the same roll
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  let BASE = null;
  function base3() {
    if (BASE) return BASE;
    const S = GD(), GR = S.grid || {}, F = GR.filler || {};
    const out = [];
    (GR.dated || []).forEach((x, i) => {
      const d = MU.parseT(x.t); if (!d) return;
      out.push({ id: x.id || 'd' + i, key: x.key, t: +d, ymd: ymdOf(d), door: x.door || null, saw: !!x.saw702, scr: x.scr || null, qa: x.id || null });
    });
    const n = Math.max(0, (S.total || 0) - out.length);
    const from = MU.parseT(F.from), to = MU.parseT(F.to), keys = F.keys || [];
    if (n && from && to && keys.length) {
      const skip = F.skip || [], after = F.after || {}, H = F.hours || [7, 21], nV = F.variants || 72;
      const days = [];
      for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) { const k = ymdOf(d); if (!skip.some((r) => k >= r[0] && k <= r[1])) days.push(k); }
      const r = rng32(F.seed || 1);
      const add = (i, k) => {
        const ks = keys.filter((key) => !after[key] || k >= after[key]);
        const key = ks[Math.floor(r() * ks.length)] || keys[0];
        const h = H[0] + Math.floor(r() * (H[1] - H[0] + 1)), mi = Math.floor(r() * 60);
        out.push({ id: 'f' + i, key, t: +new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), h, mi), ymd: k, v: Math.floor(r() * nV) });
      };
      let i = 0;
      (F.ensure || []).forEach((e) => { for (let c = 0; c < (e[1] || 0) && i < n; c++) add(i++, e[0]); });   // e.g. the newest day
      for (; i < n; i++) add(i, days[Math.floor(r() * days.length)]);
    }
    out.sort((a, b) => b.t - a.t);
    BASE = out;
    return out;
  }
  function shots3() {   // room shutter (vars.shots — newest first, in-game clock stamp) · progress 0
    const sh = (G.state && G.state.vars && G.state.vars.shots) || [];
    return sh.filter((s) => s && (s.key || s.view)).map((s, i) => {
      const t = s.t > 1e11 ? s.t : +nowD();
      return { id: 'shot' + i, key: s.key || s.view, t, ymd: ymdOf(new Date(t)), shot: true };
    });
  }
  function roll3() { const s = shots3(); return s.length ? s.concat(base3()) : base3(); }
  const listOf = (arr) => ({ len: () => arr.length, at: (i) => arr[i] });
  function sharedA() { return (GD().albums || []).find((a) => a.id === 'shared') || null; }
  function albumA(id) { return (GD().albums || []).find((a) => a.id === id) || null; }
  function sharedItems() {
    const A = sharedA(); if (!A) return [];
    return (A.photos || []).map((p) => { const d = MU.parseT(p.t); return Object.assign({}, p, { t: d ? +d : 0, door: p.door ? p.id : null, saw: !!p.saw702, shared: true, qa: p.id }); });
  }
  function oldItems() {
    const A = albumA('old'); if (!A) return [];
    return (A.items || []).map((p) => { const d = MU.parseT(p.t); return Object.assign({}, p, { t: d ? +d : 0 }); });
  }
  const photoId = (it) => it.door || it.qa || it.id;
  const scrOf = (it) => it.scr || (it.door ? 'gallery.photo.door' : 'gallery.photo');

  /* ---------------- '줄이 그려짐' (§9.5-4): ≥ 60 % inside the viewport for 200 ms, on the top screen ---------------- */
  function watchSeen(node, fn, o) {
    o = o || {};
    let t = null, done = false, inView = false, io = null;
    const ok = () => node.isConnected && !document.hidden && (!o.scr || MU.isTop(o.scr));
    function stop() { clearTimeout(t); t = null; if (io) { try { io.disconnect(); } catch (e) {} io = null; } }
    function fire() {
      t = null;
      if (done || !node.isConnected) { if (!node.isConnected) stop(); return; }
      if (!ok() || !inView) { if (inView) t = setTimeout(fire, 250); return; }
      done = true; stop();
      try { fn(); } catch (e) { console.error('[gallery] seen', e); }
    }
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((ents) => {
        ents.forEach((en) => {
          inView = en.isIntersecting && en.intersectionRatio >= 0.6;
          if (inView) { if (!t) t = setTimeout(fire, o.ms || 200); } else { clearTimeout(t); t = null; }
        });
      }, { threshold: [0, 0.6, 1] });
      io.observe(node);
    } else {   // geometry fallback (old engines): one check after the frame settles
      t = setTimeout(function chk() {
        if (done || !node.isConnected) return;
        const r = node.getBoundingClientRect(), vh = window.innerHeight || 800;
        const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.max(1, r.height);
        inView = vis >= 0.6; if (inView && ok()) { done = true; fn(); } else t = setTimeout(chk, 250);
      }, o.ms || 200);
    }
    return stop;
  }

  /* ---------------- grid cells + the virtual grid (date headers · 4 columns · only nearby rows exist) ---------------- */
  const POS = [20, 50, 80];
  function variantStyle(img, v, cellNode) {   // 72 = object-position 9 × mirror 2 × tone 4 (§8.1)
    if (v == null) return;
    const p = v % 9, px = POS[p % 3], py = POS[Math.floor(p / 3)], flip = Math.floor(v / 9) % 2, tone = Math.floor(v / 18) % 4;
    img.style.objectPosition = `${px}% ${py}%`;
    img.style.transformOrigin = `${px}% ${py}%`;
    img.style.transform = 'scale(1.42)';
    if (flip && cellNode) cellNode.classList.add('md3-flip');   // mirror the whole cell around its centre
    if (tone) img.classList.add('md3-tone' + tone);
  }
  function cell3(it, i, onOpen, qaPrefix) {
    const b = el('button.md3-cell', { type: 'button', 'aria-label': '사진' });
    MU.qa(b, qaPrefix === 'photo' || (it.qa && !it.shot) ? 'gallery.photo:' + (it.qa || it.id) : 'gallery.grid:' + i);
    const src = MU.img(it.key);
    if (src) {
      const im = el('img', { alt: '', draggable: 'false', decoding: 'async' });
      variantStyle(im, it.v, b);
      im.addEventListener('error', () => { im.remove(); b.classList.add('miss'); });
      im.src = src;
      b.appendChild(im);
    } else b.classList.add('miss');
    b.addEventListener('click', () => { MU.sfx('tap'); onOpen(i); });
    return b;
  }
  function vgrid(scroller, getList, onOpen) {
    const COLS = 4, GAP = 2;
    const wrap = el('div.md3-vg');
    let list = [], rows = [], W = 0, cell = 0, hH = 0, built = false, raf = 0, disposed = false;
    const live = new Map();
    function rebuild() {
      list = getList();
      W = wrap.clientWidth || 0;
      if (!W) { built = false; return; }
      cell = Math.floor((W - GAP * (COLS - 1)) / COLS);
      const probe = el('div.md3-vg-h', null, '0'); probe.style.visibility = 'hidden'; probe.style.position = 'absolute';
      wrap.appendChild(probe); hH = probe.offsetHeight || 40; probe.remove();
      rows = [];
      let y = 0, i = 0;
      while (i < list.length) {
        const k = list[i].ymd; let j = i;
        while (j < list.length && list[j].ymd === k) j++;
        rows.push({ h: true, y, hh: hH, label: dayLabel(new Date(list[i].t)) }); y += hH;
        for (let s = i; s < j; s += COLS) { rows.push({ y, hh: cell + GAP, s, n: Math.min(COLS, j - s) }); y += cell + GAP; }
        i = j;
      }
      wrap.style.height = y + 'px';
      live.forEach((nd) => nd.remove()); live.clear();
      built = true;
    }
    function rowNode(R) {
      const n = el('div.md3-vg-r');
      for (let c = 0; c < R.n; c++) {
        const i = R.s + c, node = cell3(list[i], i, onOpen);
        node.style.width = cell + 'px'; node.style.height = cell + 'px'; node.style.left = c * (cell + GAP) + 'px';
        n.appendChild(node);
      }
      return n;
    }
    function render() {
      raf = 0;
      if (disposed) return;
      if (!built) rebuild();
      if (!built) { if (wrap.isConnected) raf = requestAnimationFrame(render); return; }
      const top = scroller.scrollTop - (wrap.offsetTop || 0), vh = scroller.clientHeight || 700;
      const lo = top - 800, hi = top + vh + 800;
      let a = 0, b = rows.length;
      while (a < b) { const m = (a + b) >> 1; if (rows[m].y + rows[m].hh <= lo) a = m + 1; else b = m; }
      const want = new Set();
      for (let r = a; r < rows.length && rows[r].y < hi; r++) want.add(r);
      live.forEach((nd, r) => { if (!want.has(r)) { nd.remove(); live.delete(r); } });
      want.forEach((r) => {
        if (live.has(r)) return;
        const R = rows[r];
        const nd = R.h ? el('div.md3-vg-h', null, R.label) : rowNode(R);
        nd.style.top = R.y + 'px'; nd.style.height = (R.h ? R.hh : cell) + 'px';
        wrap.appendChild(nd); live.set(r, nd);
      });
    }
    const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(render); };
    scroller.addEventListener('scroll', schedule, { passive: true });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { const w = wrap.clientWidth; if (w && w !== W) { built = false; schedule(); } }); ro.observe(wrap); }
    const offS = MU.on('settings', () => { built = false; schedule(); });
    const offE = MU.on('easy:change', () => { built = false; schedule(); });   // easy mode scales the text ×1.3 (date headers)
    return {
      node: wrap, render: schedule,
      refresh() { built = false; schedule(); },
      scrollToIndex(i) {
        if (!built) rebuild();
        const r = rows.findIndex((R) => !R.h && i >= R.s && i < R.s + R.n);
        if (r >= 0) { scroller.scrollTop = Math.max(0, (wrap.offsetTop || 0) + rows[r].y - hH); render(); }
      },
      dispose() { disposed = true; scroller.removeEventListener('scroll', schedule); if (ro) ro.disconnect(); if (offS) offS(); if (offE) offE(); if (raf) cancelAnimationFrame(raf); },
    };
  }

  /* ---------------- zoom box (pinch 1–3× · double-tap 2× ↔ 1× · wheel · pan when zoomed · swipe at 1×) ---------------- */
  function zoomBox(it, o) {
    o = o || {};
    const box = el('div.md3-zoom');
    MU.qa(box, 'viewer.img');
    const layer = el('div.md3-zlayer');
    box.appendChild(layer);
    const src = it.deleted ? '' : MU.img(it.key);
    let img = null;
    if (src) {
      img = el('img.md3-zimg', { alt: '', draggable: 'false', decoding: 'async' });
      if (it.v != null) { const flip = Math.floor(it.v / 9) % 2, tone = Math.floor(it.v / 18) % 4; if (flip) img.classList.add('md3-flip'); if (tone) img.classList.add('md3-tone' + tone); }
      img.addEventListener('load', () => { o.onLoad && o.onLoad(true); });
      img.addEventListener('error', () => { if (img) img.remove(); img = null; box.classList.add('miss'); o.onLoad && o.onLoad(false); });
      layer.appendChild(img);
      img.src = src;
    } else { box.classList.add('miss'); setTimeout(() => { o.onLoad && o.onLoad(false); }, 0); }
    let s = 1, tx = 0, ty = 0, W = 1, H = 1;
    const MAX = 3;
    const dims = () => { const r = box.getBoundingClientRect(); W = r.width || 1; H = r.height || 1; return r; };
    function apply(anim) {
      if (s <= 1.001) { s = 1; tx = 0; ty = 0; }
      tx = Math.min(0, Math.max(W - W * s, tx)); ty = Math.min(0, Math.max(H - H * s, ty));
      layer.style.transition = anim ? 'transform .26s cubic-bezier(.2,.9,.3,1)' : 'none';
      layer.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
      box.dataset.zoom = s.toFixed(2);
      o.onScale && o.onScale(s);
    }
    function zoomAt(px, py, ns, anim) { ns = Math.max(1, Math.min(MAX, ns)); const k = ns / s; tx = px - (px - tx) * k; ty = py - (py - ty) * k; s = ns; apply(anim); }
    const pts = new Map();
    let g = null, downT = 0, moved = false, tapT = 0, tapX = 0, tapY = 0;
    function snap() {
      const ps = Array.from(pts.values()), r = dims();
      if (ps.length >= 2) return { s, tx, ty, d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, mx: (ps[0].x + ps[1].x) / 2 - r.left, my: (ps[0].y + ps[1].y) / 2 - r.top };
      if (ps.length === 1) return { s, tx, ty, x: ps[0].x, y: ps[0].y, x0: ps[0].x, y0: ps[0].y };
      return null;
    }
    box.addEventListener('pointerdown', (e) => {
      try { box.setPointerCapture(e.pointerId); } catch (er) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { downT = performance.now(); moved = false; }
      else moved = true;
      g = snap();
    });
    box.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = Array.from(pts.values());
      if (ps.length >= 2 && g && g.d) {
        const r = box.getBoundingClientRect();
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), mx = (ps[0].x + ps[1].x) / 2 - r.left, my = (ps[0].y + ps[1].y) / 2 - r.top;
        const ns = Math.max(1, Math.min(MAX, g.s * (d / g.d))), k = ns / g.s;
        s = ns; tx = mx - (g.mx - g.tx) * k; ty = my - (g.my - g.ty) * k; apply();
      } else if (ps.length === 1 && g && g.x != null) {
        const dx = ps[0].x - g.x, dy = ps[0].y - g.y;
        if (Math.hypot(ps[0].x - g.x0, ps[0].y - g.y0) > 8) moved = true;
        if (s > 1.001) { tx = g.tx + dx; ty = g.ty + dy; apply(); }
      }
    });
    function up(e) {
      if (!pts.has(e.pointerId)) return;
      const last = pts.get(e.pointerId);
      const start = g;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        const now = performance.now();
        if (!moved && now - downT < 350) {
          if (now - tapT < 320 && Math.hypot(last.x - tapX, last.y - tapY) < 36) {   // double-tap: 2× at the point ↔ 1×
            const r = dims(); zoomAt(last.x - r.left, last.y - r.top, s > 1.01 ? 1 : 2, true); tapT = 0;
          } else { tapT = now; tapX = last.x; tapY = last.y; }
        } else if (moved && start && start.x0 != null && s <= 1.001) {
          const dx = last.x - start.x0, dy = last.y - start.y0;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.3) o.onSwipe && o.onSwipe(dx < 0 ? 1 : -1);
        }
        g = null;
      } else g = snap();
    }
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', (e) => { e.preventDefault(); const r = dims(); zoomAt(e.clientX - r.left, e.clientY - r.top, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    box.addEventListener('contextmenu', (e) => e.preventDefault());
    return {
      node: box,
      scale: () => s,
      zoomBy(d) { dims(); zoomAt(W / 2, H / 2, s + d, true); },
      zoomTo(ns) { dims(); zoomAt(W / 2, H / 2, ns, true); },
    };
  }

  /* ---------------- viewer (one open at a time — G.gallery.current) ---------------- */
  let VIEW = null;
  function viewer3(src, index, ctx) {
    ctx = ctx || {};
    const L = GD().infoLabels || {};
    let idx = Math.max(0, Math.min(src.len() - 1, index || 0));
    let it = null, entry = null, info = null, zb = null, imgOk = false;
    const liked = {};
    const dateEl = el('div.md3-v-date');
    const btnPrev = MU.iconBtn(I.prev, '이전', 'viewer.prev', () => go(-1));
    const btnNext = MU.iconBtn(I.next, '다음', 'viewer.next', () => go(1));
    const top = el('div.md2-v-top.md3-v-top', null, MU.iconBtn(I.arrowBack || I.back, '뒤로', 'viewer.close', () => MU.back()), dateEl);
    const stage = el('div.md2-v-stage.md3-v-stage');
    const cap = el('div.md3-v-cap');
    const btnInfo = MU.iconBtn(I.info, '정보', 'viewer.info', () => toggleInfo());
    const btnLike = MU.iconBtn(IC3.heart, '좋아요', 'viewer.like', () => { if (!it) return; liked[it.id] = !liked[it.id]; btnLike.classList.toggle('on', !!liked[it.id]); });
    const bar = el('div.md2-v-bot.md3-v-bar', null, btnPrev, btnInfo, btnLike, btnNext);   // the date needs the whole top row
    // the photo uses the whole screen (1× = the screen width, §3.10 '702' size note); date / caption / buttons float over it
    const foot = el('div.md3-v-foot', null, cap, bar);
    const scr = el('section.md2-viewer.md2-scr.md3-viewer.md3-gal', { dataset: { theme: 'dark', status: 'light' } }, stage, top, foot);
    scr.body = stage;
    if (ctx.album) scr.dataset.album = ctx.album;
    MU.noMenu(scr);

    /* saw702 (§3.10 · §9.5-4): p3_kongi_1130 in the full-screen viewer at ≥ 1.8× for 1.5 s continuous, or 3 s continuous
       at any scale — playMs (core 'tick' dt), reset by: another photo · leaving the viewer · not the top screen · hidden tab
       · notebook over it · image missing (§9.8: then saw702 never happens). */
    const saw = { full: 0, zoom: 0, scale: 1, fullOn: false, zoomOn: false, fullSince: 0, zoomSince: 0, lastZ: 0 };
    const sawActive = () => !!(it && it.saw && imgOk && scr.isConnected && MU.isTop(scr) && !document.hidden &&
      !(G.notebook && G.notebook.isOpen && (() => { try { return G.notebook.isOpen(); } catch (e) { return false; } })()));
    function sawReset() { saw.full = 0; saw.zoom = 0; saw.fullOn = false; saw.zoomOn = false; saw.fullSince = performance.now() + 1e9; saw.zoomSince = saw.fullSince; }
    function galVar() { if (G.vars) { try { G.vars('gal', { zoomMs: Math.round(saw.zoom), fullMs: Math.round(saw.full) }); } catch (e) {} } }
    const offTick = MU.on('tick', (e) => {
      if (!it || !it.saw) return;
      const dt = Math.max(0, (e && e.dt) || 0), now = performance.now();
      if (!sawActive()) { if (saw.fullOn || saw.zoomOn) galVar(); sawReset(); return; }
      saw.full += saw.fullOn ? dt : Math.min(dt, Math.max(0, now - saw.fullSince)); saw.fullOn = true;
      if (saw.scale >= 1.8) { saw.zoom += saw.zoomOn ? dt : Math.min(dt, Math.max(0, now - saw.zoomSince)); saw.zoomOn = true; }
      else { saw.zoom = 0; saw.zoomOn = false; }
      if (saw.scale >= 1.8) MU.emit('gallery:zoom', { photo: photoId(it), scale: +saw.scale.toFixed(2), ms: Math.round(saw.zoom) });
      if (!MU.flag('saw702') && (saw.zoom >= 1500 || saw.full >= 3000)) { setFlag3('saw702'); galVar(); }
    });
    function onScale(sc) {
      const was = saw.scale;
      saw.scale = sc;
      if (sc >= 1.8 && was < 1.8) { saw.zoom = 0; saw.zoomOn = false; saw.zoomSince = performance.now(); }
      if (sc < 1.8) { saw.zoom = 0; saw.zoomOn = false; }
      scr.classList.toggle('md3-zoomed', sc > 1.01);
      const now = performance.now();
      if (it && (now - saw.lastZ > 120 || sc <= 1.001 || (sc >= 1.8) !== (was >= 1.8))) {
        saw.lastZ = now;
        MU.emit('gallery:zoom', { photo: photoId(it), scale: +sc.toFixed(2), ms: Math.round(saw.zoom) });
      }
    }

    function leave() {
      if (!it) return;
      const cur = it;
      if (info) info.close();
      if (cur.saw && (saw.full || saw.zoom)) galVar();
      it = null;
      MU.emit('gallery:photo', { photo: photoId(cur), open: false, info: false, door: !!cur.door });
    }
    function show() {
      leave();
      it = src.at(idx);
      if (!it) return;
      const d = new Date(it.t);
      dateEl.textContent = it.t ? topLine(d) : '';
      btnPrev.style.visibility = idx > 0 ? '' : 'hidden';
      btnNext.style.visibility = idx < src.len() - 1 ? '' : 'hidden';
      stage.innerHTML = '';
      imgOk = false; sawReset(); saw.scale = 1;
      scr.classList.remove('md3-zoomed');
      const cur = it;
      zb = zoomBox(it, { onScale, onSwipe: (dir) => go(dir), onLoad: (ok) => { if (it !== cur) return; imgOk = ok; if (ok) saw.fullSince = performance.now(); } });
      stage.appendChild(zb.node);
      cap.innerHTML = '';
      if (it.cap) cap.appendChild(el('p.md3-v-captext', null, T3(it.cap)));
      (it.comments || []).forEach((c) => cap.appendChild(el('p.md3-v-cmt', null, el('b', null, T3(c[0])), el('span', null, T3(c[1])))));
      cap.classList.toggle('on', !!cap.firstChild);
      btnLike.classList.toggle('on', !!liked[it.id]);
      setScr(scr, entry, scrOf(it));
      if (it.door) scr.dataset.photo = it.door; else delete scr.dataset.photo;
      MU.emit('gallery:photo', { photo: photoId(it), open: true, info: false, door: !!it.door });
    }
    function go(dlt) { const ni = idx + dlt; if (ni < 0 || ni >= src.len()) return; MU.sfx('tap'); idx = ni; show(); }
    function toggleInfo() {
      if (!it) return;
      if (info) { info.close(); return; }
      const cur = it;
      const rows = cur.shared ? [[L.up || '', cur.up || ''], [L.bom || '', cur.bom || '']] : [infoLine(new Date(cur.t)), GD().cameraLabel || ''];
      info = MU.panel(scr, rows, { cls: 'dark.md3-info', onClose: () => { info = null; MU.emit('gallery:photo', { photo: photoId(cur), open: false, info: true, door: !!cur.door }); } });
      // the sheet sits above the button bar so prev / next stay tappable while ⓘ is open
      try { const lift = scr.clientHeight - (foot.offsetTop + bar.offsetTop); if (lift > 0 && lift < scr.clientHeight / 2) info.node.style.bottom = lift + 'px'; } catch (e) {}
      MU.emit('gallery:photo', { photo: photoId(cur), open: true, info: true, door: !!cur.door });
      if (cur.shared && cur.door && /sagongsa/.test(String(cur.bom || ''))) {   // §3.10: the `봄  sagongsa` row of a 현관 photo
        const row = info.node.querySelectorAll('.md2-pi')[1];
        if (row) watchSeen(row, () => setFlag3('bomSeen'), { scr });
      }
    }
    const onKey = (e) => {
      if (!MU.isTop(scr) || (G.ui && G.ui.keyboardOpen && G.ui.keyboardOpen())) return;
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
      else if ((e.key === '+' || e.key === '=') && zb) { zb.zoomBy(0.5); e.preventDefault(); }
      else if ((e.key === '-' || e.key === '_') && zb) { zb.zoomBy(-0.5); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    show();
    entry = MU.push(scr, { anim: 'fade', appId: 'gallery', onClose: () => {
      document.removeEventListener('keydown', onKey);
      leave();
      if (offTick) offTick();
      if (VIEW && VIEW.scr === scr) VIEW = null;
      ctx.onClose && ctx.onClose();
    } });
    setScr(scr, entry, scr.dataset.scr);
    VIEW = { scr, infoOpen: () => !!info, zoomTo: (s) => zb && zb.zoomTo(s), item: () => it };
    return scr;
  }

  /* ---------------- screens ---------------- */
  function avatarNode(m, big) {
    const a = el('span.md3-av' + (big ? '.big' : '') + (m.black ? '.black' : ''), { 'aria-hidden': 'true' });
    const src = MU.img(m.avatar);
    if (src) { const im = el('img', { alt: '', draggable: 'false', src }); im.addEventListener('error', () => { im.remove(); if (!m.black) a.textContent = Array.from(T3(m.name))[0] || ''; }); a.appendChild(im); }
    else if (!m.black) a.textContent = Array.from(T3(m.name))[0] || '';
    return a;
  }
  function coverKey(a) {
    if (a.id === 'camera') { const r = roll3(); return r[0] && r[0].key; }
    if (a.id === 'old') { const o = oldItems(); return o[0] && o[0].key; }
    if (a.id === 'shared') { const s = sharedItems(); return s[0] && s[0].key; }
    return (a.items && a.items[0] && a.items[0].key) || null;
  }
  function countOf(a) {
    if (a.id === 'camera') return fmtN((GD().total || 0) + shots3().length);
    if (a.count != null) return fmtN(a.count);
    return fmtN((a.items || a.photos || []).length);
  }
  function albumsList() {
    const box = el('div.md3-albums');
    (GD().albums || []).forEach((a) => {
      const cover = el('span.md3-alb-cover');
      const k = coverKey(a), src = k ? MU.img(k) : '';
      if (src) { const im = el('img', { alt: '', draggable: 'false', decoding: 'async', src }); im.addEventListener('error', () => im.remove()); cover.appendChild(im); }
      const b = el('button.md3-alb', { type: 'button' }, cover, el('span.md3-alb-name', null, T3(a.name)), el('span.md3-alb-n', null, countOf(a)));
      MU.qa(b, 'gallery.album:' + a.id);
      b.addEventListener('click', () => { MU.sfx('tap'); V3.album(a.id); });
      box.appendChild(b);
    });
    return box;
  }
  function openRoll(i) { const r = roll3(); viewer3(listOf(r), i, { album: 'camera' }); }

  V3.home = function (tab) {
    tab = tab === 'albums' ? 'albums' : 'photos';
    const S = GD();
    const body = el('div.md3-gal-body');
    const tabs = el('nav.md2-tabs.md3-gal-tabs');
    const scr = scr3({ title: '', cls: 'md2-gal md3-home', body, footer: tabs });
    let grid = null, entry = null;
    const headTitle = () => `${T3(S.head || '')} ${fmtN((S.total || 0) + shots3().length)}`.trim();
    function render() {
      if (grid) { grid.dispose(); grid = null; }
      body.innerHTML = ''; tabs.innerHTML = '';
      (S.tabs || [['photos', ''], ['albums', '']]).forEach(([k, l]) => {
        const b = el('button.md2-tab' + (tab === k ? '.on' : ''), { type: 'button', html: k === 'photos' ? I.photo : IC3.album }, el('span', null, T3(l)));
        MU.qa(b, 'gallery.tab:' + k);
        b.addEventListener('click', () => { if (tab === k) return; MU.sfx('tap'); tab = k; scr.body.scrollTop = 0; render(); });
        tabs.appendChild(b);
      });
      if (tab === 'photos') {
        MU.setTitle(scr, headTitle());
        grid = vgrid(scr.body, roll3, openRoll);
        body.appendChild(grid.node);
        grid.render();
        setScr(scr, entry, 'gallery.grid');
      } else {
        MU.setTitle(scr, T3(S.albumsTitle || ''));
        body.appendChild(albumsList());
        setScr(scr, entry, 'gallery.albums');
      }
      HOME = { scr, grid, tab };
    }
    render();
    let shotN = shots3().length;
    entry = push3(scr, scr.dataset.scr, { appId: 'gallery', onResume: () => {
      const n = shots3().length; if (n === shotN) return; shotN = n;   // only the room shutter can change the roll
      if (tab === 'photos') { MU.setTitle(scr, headTitle()); if (grid) grid.refresh(); } else render(); },
      onClose: () => { if (grid) grid.dispose(); if (HOME && HOME.scr === scr) HOME = null; } });
    return scr;
  };
  let HOME = null;

  V3.album = function (id) {
    const A = albumA(id);
    if (!A) return;
    if (id === 'shared') { sharedScreen(A); return; }
    if (id === 'camera') {
      const body = el('div.md3-gal-body');
      const scr = scr3({ title: T3(A.name), cls: 'md2-gal md3-camalb', body });
      scr.dataset.album = 'camera';
      const grid = vgrid(scr.body, roll3, openRoll);
      body.appendChild(grid.node);
      push3(scr, 'gallery.grid', { onResume: () => grid.refresh(), onClose: () => grid.dispose() });
      grid.render();
    } else {
      const items = id === 'old' ? oldItems() : (A.items || []).map((p) => Object.assign({}, p, { t: +(MU.parseT(p.t) || 0) }));
      const g = el('div.md3-sgrid', null, items.map((itx, i) => cell3(itx, i, (j) => viewer3(listOf(items), j, { album: id }), 'grid')));
      const scr = scr3({ title: T3(A.name), cls: 'md2-gal md3-oldalb', body: g });
      scr.dataset.album = id;
      push3(scr, 'gallery.' + id);
    }
    if (A.flag) setFlag3(A.flag);
    MU.emit('gallery:album', { id });
  };

  function sharedScreen(A) {
    const items = sharedItems();
    let scr = null;
    const more = MU.iconBtn(I.more, '더보기', 'gallery.more', () => MU.menu(scr, [
      { label: (A.menu || [])[0], qa: 'gallery.members', onClick: () => members(A) },
      { label: (A.menu || [])[1], qa: 'gallery.activity', onClick: () => activity(A) },
      { label: (A.menu || [])[2], qa: 'gallery.albuminfo', onClick: () => albumInfo(A) },
    ]));
    const avs = el('button.md3-avs', { type: 'button', 'aria-label': T3((A.menu || [])[0] || '') }, (A.members || []).map((m) => avatarNode(m)));
    MU.qa(avs, 'gallery.avatars');
    avs.addEventListener('click', () => { MU.sfx('tap'); members(A); });
    const head = el('div.md3-sh-head', null, el('b.md3-sh-t', null, T3(A.head || A.name)), avs);
    const grid = el('div.md3-sgrid', null, items.map((itx, i) => cell3(itx, i, (j) => viewer3(listOf(items), j, { album: 'shared' }), 'photo')));
    scr = scr3({ title: '', cls: 'md2-gal md3-shared', body: el('div.md3-sh', null, head, grid), right: [more] });
    scr.dataset.album = 'shared';
    push3(scr, 'gallery.shared');
    setFlag3(A.flag || 'albumOpened');
    MU.emit('gallery:album', { id: 'shared' });
    return scr;
  }
  function members(A) {
    const ms = A.members || [];
    const rows = ms.map((m) => {
      const b = el('button.md3-mem', { type: 'button' }, avatarNode(m, true), el('span.md3-mem-n', null, T3(m.name)), m.role ? el('span.md3-mem-r', null, T3(m.role)) : null);
      MU.qa(b, 'gallery.member:' + m.id);
      b.addEventListener('click', () => { MU.sfx('tap'); memberDetail(m); });
      return b;
    });
    const scr = scr3({ title: T3(A.membersTitle || ''), cls: 'md2-gal md3-members', body: el('div.md3-mem-list', null, rows) });
    scr.dataset.album = 'shared';
    push3(scr, 'gallery.shared.members');
    ms.forEach((m, i) => { if (m.seen) watchSeen(rows[i], () => setFlag3(m.seen), { scr }); });
  }
  function memberDetail(m) {
    const D = m.detail || [m.name];
    const box = el('div.md3-memd', null, avatarNode(m, true), el('b.md3-memd-n', null, T3(D[0] || '')), D.slice(1).map((l) => el('div.md3-memd-l', null, T3(l))));
    const scr = scr3({ title: '', cls: 'md2-gal md3-memdscr', body: box });
    scr.dataset.album = 'shared';
    push3(scr, m.seen ? 'gallery.shared.members' : 'gallery.shared.member');   // the sagongsa detail is the members' reaction (§3.10)
    if (m.seen) watchSeen(box, () => setFlag3(m.seen), { scr });
  }
  function activity(A) {
    const list = el('div.md3-act');
    (A.activity || []).forEach((r, i) => {
      const inner = [el('span.md3-act-t', null, T3(r[1])), el('small.md3-act-w', null, T3(r[0]))];
      const row = r[2] ? el('button.md3-act-r', { type: 'button' }, inner) : el('div.md3-act-r', null, inner);
      MU.qa(row, 'gallery.act:' + i);
      if (r[2]) row.addEventListener('click', () => { MU.sfx('tap'); actOpen(A, r[2]); });
      list.appendChild(row);
    });
    const scr = scr3({ title: T3(A.activityTitle || ''), cls: 'md2-gal md3-actscr', body: list });
    scr.dataset.album = 'shared';
    push3(scr, 'gallery.shared.activity');
  }
  function actOpen(A, link) {
    const [kind, id] = String(link).split(':');
    if (kind === 'photo') { const items = sharedItems(); const i = items.findIndex((x) => x.id === id); if (i >= 0) viewer3(listOf(items), i, { album: 'shared' }); }
    else if (kind === 'member') { const m = (A.members || []).find((x) => x.id === id); if (m) memberDetail(m); }
    else if (kind === 'deleted') deletedScreen();
  }
  function deletedScreen() {   // §4.6.2: `삭제된 사진입니다` — no photo, no comments
    const top = el('div.md2-v-top.md3-v-top', null, MU.iconBtn(I.arrowBack || I.back, '뒤로', 'viewer.close', () => MU.back()));
    const stage = el('div.md2-v-stage.md3-v-stage', null, el('div.md3-deleted', null, el('span.md3-deleted-ic', { html: I.photo }), el('b', null, T3(GD().deleted || ''))));
    const scr = el('section.md2-viewer.md2-scr.md3-viewer.md3-gal', { dataset: { theme: 'dark', status: 'light' } }, top, stage);
    scr.dataset.album = 'shared';
    MU.noMenu(scr);
    push3(scr, 'gallery.deleted', { anim: 'fade' });
  }
  function albumInfo(A) {
    const rows = el('div.md3-kvs', null, (A.info || []).map(([k, v]) => el('div.md3-kv', null, el('span', null, T3(k)), el('b', null, T3(v)))));
    const scr = scr3({ title: T3(A.infoTitle || ''), cls: 'md2-gal md3-infoscr', body: rows });
    scr.dataset.album = 'shared';
    push3(scr, 'gallery.shared.info');
  }

  V3.open = function (p) {
    p = p || {};
    V3.home(p.tab || (p.album ? 'albums' : 'photos'));
    if (p.album) V3.album(p.album);
    if (p.photo) {
      const items = sharedItems(), i = items.findIndex((x) => x.id === String(p.photo));
      if (i >= 0) viewer3(listOf(items), i, { album: 'shared' });
      else { const r = roll3(), j = r.findIndex((x) => x.qa === p.photo || x.door === String(p.photo) || x.id === p.photo); if (j >= 0) viewer3(listOf(r), j, { album: 'camera' }); }
    }
  };

  /* ---------------- public (ARCH_EP3 §5.11) ---------------- */
  let inited3 = false;
  GL.init = function () {
    if (!isV3() || inited3) return;
    inited3 = true;
    MU.on('flag', (n) => { if (n === 'membersSeen' || n === 'bomSeen') checkAlbumDone(); });
    checkAlbumDone();
  };
  GL.current = function () {
    try {
      const t = G.phone && G.phone.top && G.phone.top(), n = t && t.node;
      if (!n || !n.classList || !n.classList.contains('md3-gal')) return null;
      return { scr: n.dataset.scr || null, album: n.dataset.album || null, photo: n.dataset.photo || null, info: !!(VIEW && VIEW.scr === n && VIEW.infoOpen()) };
    } catch (e) { return null; }
  };

  if (G.DEBUG && window.haru) {
    if (isV3()) {
      window.haru.gallery = {
        open: (o) => GL.open(o || {}),
        shared: () => GL.open({ tab: 'albums', album: 'shared' }),
        photo: (id) => GL.open({ tab: 'albums', album: 'shared', photo: id }),
        zoom: (s) => VIEW && VIEW.zoomTo(s),
        current: () => GL.current(),
        roll: () => roll3().length,
        find(id) {   // scroll the open 사진 grid to a dated photo (e.g. 'soup2601') — QA only
          const r = roll3(), i = r.findIndex((x) => x.qa === id || x.door === id || x.id === id);
          if (i >= 0 && HOME && HOME.grid) HOME.grid.scrollToIndex(i);
          return i;
        },
      };
    } else {
      window.haru.gallery = { open: (user, album) => GL.open({ user, album }), receive: () => GL.receive(), hidden: () => openHidden() };
    }
  }
})();
