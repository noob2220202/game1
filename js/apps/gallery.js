/* =========================================================
 * 갤러리: albums, grid, viewer (pinch zoom), info (metadata), edit (exposure),
 * LIVE photos (long-press), locked albums, recently deleted + restore.
 *
 * G.STORY.photos = [{id, src, thumb, t, albums:[...], info:{...}, show(), deleted:{daysLeft}, live:{label,onPlay(viewer)},
 *                    zoomTriggers:[{id, x,y, r, minScale, onHit(ctx)}], reveal:{at:(brightness 0..300), onReveal(ctx)}, caption}]
 * G.STORY.albums = [{id, name, show(), locked:{type:'pattern'|'pin', check(v)->bool, hint, onUnlock}}]
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad } = G.util;
  const GL = (G.gallery = {});

  function photos() {
    const shots = (G.state.vars.shots || []).map((s, i) => ({ id: 'shot' + i, src: s.src, t: s.t, albums: ['recent', 'camera'], info: { '파일': `IMG_${G.util.fmtDate(new Date(s.t)).replace(/\./g, '')}_${pad(new Date(s.t).getHours())}${pad(new Date(s.t).getMinutes())}.jpg`, '기기': '이 휴대폰', '플래시': s.flash ? '켜짐' : '꺼짐' }, shot: true }));
    return shots.concat((G.STORY.photos || []).filter((p) => !p.show || p.show()));
  }
  GL.photos = photos;
  GL.byId = (id) => photos().find((p) => p.id === id);
  function inAlbum(aid) {
    if (aid === 'all' || aid === 'recent') return photos().filter((p) => (!p.deleted || isRestored(p)) && !(p.albums || []).includes('hidden'));
    if (aid === 'deleted') return photos().filter((p) => p.deleted && !isRestored(p));
    return photos().filter((p) => (p.albums || []).includes(aid) && (!p.deleted || isRestored(p)));
  }
  function isRestored(p) { return !!(G.state.vars.restored || {})[p.id]; }
  function sorted(list) { return list.slice().sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t)); }

  /* ---------- app ---------- */
  G.app('gallery', {
    name: '갤러리',
    icon: G.ICONS.gallery,
    open(p) {
      const tabs = el('div.gal-tabs');
      const content = el('div');
      const scr = G.ui.screen({ title: '갤러리', body: el('div', null, tabs, content) });
      let tab = p && p.album && p.album !== 'recent' ? 'albums' : 'photos';
      function renderTabs() {
        tabs.innerHTML = '';
        [['photos', '사진'], ['albums', '앨범']].forEach(([k, l]) => tabs.appendChild(el('button.gal-tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; renderTabs(); render(); } }, l)));
      }
      function render() { content.innerHTML = ''; content.appendChild(tab === 'photos' ? grid(sorted(inAlbum('all')), true) : albumsView()); }
      renderTabs(); render();
      G.phone.push(scr, { onResume: render });
      if (p && p.album && p.album !== 'recent') openAlbum(p.album);
      if (p && p.photo) { const ph = GL.byId(p.photo); if (ph) viewer(sorted(inAlbum('all')), ph); }
    },
  });

  function grid(list, byDay) {
    const wrap = el('div');
    if (!list.length) { wrap.appendChild(el('div.empty-state', null, '사진이 없습니다')); return wrap; }
    let lastDay = null, g = null;
    list.forEach((ph) => {
      const d = G.chat.parseT(ph.t);
      const dk = d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : '';
      if (!g || (byDay && dk !== lastDay)) {
        if (byDay) wrap.appendChild(el('div.gal-day', null, dk));
        g = el('div.gal-grid'); wrap.appendChild(g); lastDay = dk;
      }
      const cell = el('button.gal-cell', { style: { backgroundImage: `url("${ph.thumb || ph.src}")` } },
        ph.live ? el('span.gc-badge', null, 'LIVE') : null,
        ph.deleted && !isRestored(ph) ? el('span.gc-badge', null, `${ph.deleted.daysLeft != null ? ph.deleted.daysLeft : 3}일`) : null);
      cell.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); viewer(list, ph); });
      g.appendChild(cell);
    });
    return wrap;
  }

  function albumsView() {
    const all = (G.STORY.albums || []).filter((a) => !a.show || a.show());
    const g = el('div.album-grid');
    all.forEach((a) => {
      const items = inAlbum(a.id);
      const locked = a.locked && !G.flag('album_' + a.id);
      const cover = el('div.album-cover' + (locked ? '.locked' : ''), locked ? { html: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' } : { style: { backgroundImage: items[0] ? `url("${items[0].thumb || items[0].src}")` : 'none' } });
      const b = el('button.album', null, cover, el('div.album-name', null, a.name), el('div.album-count', null, locked ? '잠김' : `${items.length}`));
      b.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); openAlbum(a.id); });
      g.appendChild(b);
    });
    return g;
  }

  function openAlbum(aid) {
    const a = (G.STORY.albums || []).find((x) => x.id === aid);
    if (!a) return;
    if (a.locked && !G.flag('album_' + aid)) { unlockAlbum(a); return; }
    const content = el('div');
    const scr = G.ui.screen({ title: a.name, sub: a.sub || null, body: content });
    function render() {
      content.innerHTML = '';
      if (a.banner) content.appendChild(el('div.section-title', null, G.T(a.banner)));
      content.appendChild(grid(sorted(inAlbum(aid)), aid !== 'deleted'));
    }
    render();
    G.phone.push(scr, { onResume: render });
    G.bus.emit('gallery:album', aid);
    a.onOpen && a.onOpen(scr);
  }
  GL.openAlbum = openAlbum;

  function unlockAlbum(a) {
    const L = a.locked;
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 16px', gap: '16px', color: '#fff' } });
    const scr = G.ui.screen({ title: a.name, theme: 'dark', body: wrap });
    const msg = el('div', { style: { fontSize: '14px', opacity: '.85', textAlign: 'center', lineHeight: '1.6', whiteSpace: 'pre-line' } }, L.prompt ? G.T(L.prompt) : (L.type === 'pattern' ? '패턴을 그려 잠금 해제하세요' : 'PIN을 입력하세요'));
    wrap.appendChild(el('div', { html: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="#fff" stroke-width="1.6"/></svg>' }));
    wrap.appendChild(msg);
    if (L.hint) wrap.appendChild(el('div.lock-hint', null, G.T(L.hint)));
    let fails = 0;
    const onOk = async () => {
      G.audio && G.audio.sfx.unlock();
      G.flag('album_' + a.id, true);
      await sleep(350);
      G.phone.pop(true);
      L.onUnlock && L.onUnlock();
      openAlbum(a.id);
    };
    const onFail = () => { fails++; msg.textContent = fails >= 3 && L.failHint ? G.T(L.failHint) : '잘못된 패턴입니다'; G.bus.emit('album:fail', { id: a.id, fails }); };
    if (L.type === 'pattern') {
      wrap.appendChild(G.ui.patternLock({ size: 270, onSubmit: async (seq) => { const ok = L.check(seq); if (ok) onOk(); else onFail(); return ok; } }));
    } else {
      wrap.appendChild(G.ui.pinPad({ length: L.length || 4, onSubmit: async (code) => { const ok = L.check(code); if (ok) onOk(); else onFail(); return ok; } }));
    }
    G.phone.push(scr);
  }

  /* ---------- viewer ---------- */
  function fmtFull(d) { return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${G.util.fmtKTime(d)}` : ''; }
  function viewer(list, ph) {
    let idx = Math.max(0, list.indexOf(ph));
    const stage = el('div.photo-stage');
    const tools = el('div.photo-tools');
    const scr = G.ui.screen({ title: '', theme: 'dark', cls: 'photo-view', body: el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }, stage, tools), bodyCls: 'nopad' });
    let zv = null, infoPanel = null, editPanel = null, bright = 100, contrast = 100, flipped = false, inverted = false;
    const fired = {};
    function cur() { return list[idx]; }
    function applyFilter() {
      if (!zv) return;
      zv.setFilter(`brightness(${bright}%) contrast(${contrast}%)${inverted ? ' invert(1)' : ''}`);
      zv.img.style.transform = flipped ? 'scaleX(-1)' : '';
      const p = cur();
      if (p.reveal && bright >= p.reveal.at && !fired['rev' + p.id]) { fired['rev' + p.id] = true; p.reveal.onReveal && p.reveal.onReveal(ctx()); }
    }
    function ctx() { return { photo: cur(), viewer: zv, screen: scr, sub: (t, ms) => G.fx.sub(G.T(t), ms) }; }
    function show() {
      const p = cur();
      stage.innerHTML = '';
      bright = 100; contrast = 100; flipped = false; inverted = false;
      zv = G.ui.zoomViewer(p.src, {
        maxScale: p.maxZoom || 10,
        onChange: (z) => {
          (p.zoomTriggers || []).forEach((tr) => {
            const k = p.id + ':' + tr.id;
            if (fired[k] && tr.once !== false) return;
            if (z.scale >= (tr.minScale || 4) && Math.hypot(z.cx - tr.x, z.cy - tr.y) < (tr.r || 0.08)) { fired[k] = true; tr.onHit && tr.onHit(ctx()); }
          });
        },
      });
      stage.appendChild(zv);
      if (p.live) {
        const badge = el('div', { style: { position: 'absolute', left: '12px', top: '10px', fontSize: '12px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(0,0,0,.45)', color: '#fff', zIndex: 3 } }, '◎ LIVE');
        stage.appendChild(badge);
        G.ui.onLongPress(zv, () => { zv.classList.add('live-play'); p.live.onPlay && p.live.onPlay(ctx()); setTimeout(() => zv.classList.remove('live-play'), 1600); }, 450);
      }
      const d = G.chat.parseT(p.t);
      scr.querySelector('.sv-title').textContent = d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '';
      const sub = scr.querySelector('.sv-sub') || scr.querySelector('.sv-titles').appendChild(el('div.sv-sub'));
      sub.textContent = d ? G.util.fmtKTime(d) : '';
      if (infoPanel) { infoPanel.remove(); infoPanel = null; }
      if (editPanel) { editPanel.remove(); editPanel = null; }
      renderTools();
      G.state.seen['photo:' + p.id] = true; G.save();
      G.bus.emit('gallery:view', p.id);
      p.onView && p.onView(ctx());
    }
    function renderTools() {
      const p = cur();
      tools.innerHTML = '';
      const t = (label, svg, fn, on) => { const b = el('button' + (on ? '.on' : ''), { html: svg + `<span>${label}</span>` }); b.addEventListener('click', () => { G.audio && G.audio.sfx.tap(); fn(); }); tools.appendChild(b); };
      t('정보', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>', toggleInfo, !!infoPanel);
      t('편집', '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', toggleEdit, !!editPanel);
      if (p.deleted && !isRestored(p)) t('복구', '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>', restore);
      else t('공유', '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', () => G.phone.toast('네트워크에 연결되어 있지 않습니다'));
      t('삭제', '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>', () => G.phone.toast(p.noDelete ? G.T(p.noDelete) : '이 사진은 삭제할 수 없습니다 (읽기 전용)'));
    }
    async function restore() {
      const p = cur();
      const ok = await G.phone.dialog({ title: '사진을 복구할까요?', text: '원래 앨범으로 이동합니다.', buttons: [{ label: '취소', value: false }, { label: '복구', value: true, style: 'primary' }] });
      if (!ok) return;
      G.state.vars.restored = Object.assign({}, G.state.vars.restored, { [p.id]: true }); G.save();
      G.audio && G.audio.sfx.success();
      G.phone.toast('복구되었습니다');
      p.onRestore && p.onRestore(ctx());
      G.bus.emit('gallery:restore', p.id);
      renderTools();
    }
    function toggleInfo() {
      if (editPanel) { editPanel.remove(); editPanel = null; }
      if (infoPanel) { infoPanel.classList.remove('in'); const n = infoPanel; setTimeout(() => n.remove(), 300); infoPanel = null; renderTools(); return; }
      const p = cur();
      const d = G.chat.parseT(p.t);
      const rows = Object.assign({ '날짜': fmtFull(d) }, p.info || {});
      infoPanel = el('div.photo-info', null, Object.keys(rows).map((k) => el('div.pi-row', null, el('span', null, k), el('span', null, G.T(String(rows[k]))))));
      stage.appendChild(infoPanel);
      requestAnimationFrame(() => infoPanel.classList.add('in'));
      G.bus.emit('gallery:info', p.id);
      p.onInfo && p.onInfo(ctx());
      renderTools();
    }
    function toggleEdit() {
      if (infoPanel) { infoPanel.remove(); infoPanel = null; }
      if (editPanel) { editPanel.classList.remove('in'); const n = editPanel; setTimeout(() => n.remove(), 300); editPanel = null; renderTools(); return; }
      const mk = (label, min, max, val, on) => {
        const v = el('span.pe-val', null, String(val));
        const r = el('input', { type: 'range', min, max, value: val });
        r.addEventListener('input', () => { v.textContent = r.value; on(+r.value); });
        return el('label', null, el('span', null, label), r, v);
      };
      editPanel = el('div.photo-edit', null,
        mk('밝기', 0, 100, 0, (x) => { bright = 100 + x * 6; applyFilter(); }),
        mk('대비', -50, 100, 0, (x) => { contrast = 100 + x * 2; applyFilter(); }),
        el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } },
          el('button.rec-small', { onclick: (e) => { flipped = !flipped; e.currentTarget.classList.toggle('on', flipped); applyFilter(); G.bus.emit('gallery:flip', cur().id); } }, '좌우 반전'),
          el('button.rec-small', { onclick: (e) => { inverted = !inverted; e.currentTarget.classList.toggle('on', inverted); applyFilter(); G.bus.emit('gallery:invert', cur().id); } }, '색 반전'),
          el('button.rec-small', { onclick: () => { toggleEdit(); show(); } }, '원본으로')));
      stage.appendChild(editPanel);
      requestAnimationFrame(() => editPanel.classList.add('in'));
      renderTools();
    }
    // prev/next by edge swipe at scale 1
    let sx = null;
    stage.addEventListener('touchstart', (e) => { if (e.touches.length === 1 && zv && zv.dataset.zoom === '1.00') sx = e.touches[0].clientX; else sx = null; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 70) { const ni = idx + (dx < 0 ? 1 : -1); if (ni >= 0 && ni < list.length) { idx = ni; show(); } }
    });
    const prev = el('button', { 'aria-label': '이전', html: '‹', style: { fontSize: '30px', color: '#fff' }, onclick: () => { if (idx > 0) { idx--; show(); } } });
    const next = el('button', { 'aria-label': '다음', html: '›', style: { fontSize: '30px', color: '#fff' }, onclick: () => { if (idx < list.length - 1) { idx++; show(); } } });
    scr.querySelector('.sv-right').append(prev, next);
    G.phone.push(scr, { anim: 'fade' });
    show();
    return scr;
  }
  GL.viewer = viewer;
  GL.viewSingle = function (src, o) {
    o = o || {};
    const p = (o.photoId && GL.byId(o.photoId)) || { id: 'single:' + src, src, t: o.t || null, info: o.info };
    return viewer([p], p);
  };
})();
