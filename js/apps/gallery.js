/* =========================================================
 * 갤러리 — DESIGN §4.6, P2 (1년 전 오늘), P5 (LIVE 오르골), P6 (공유 앨범), B14 (편집됨)
 *
 * Tabs: 사진 (추억 card + day grid) · 앨범 · 추억
 * Albums: 카메라 (세아 2025) · 내가 찍은 사진 (G.state.vars.shots) · LIVE (IMG_1115) · 공유 앨범 '콩이'
 * Viewer: pinch/double-tap zoom, 정보 sheet, 편집 (노출/밝기/대비 custom sliders), LIVE long-press,
 *         '편집됨' overlay on the player's earliest photo after F2, shared-album captions/comments.
 *
 * Public API
 *   G.gallery.photos() / byId(id) / openAlbum(id) / viewer(list, photo, opts) / viewSingle(src, {photoId,t,title})
 *   G.gallery.slider({min,max,value,center,label,fmt,onInput,onEnd}) → {node,set,get,lock}  (custom div slider)
 *   G.gallery.memories() / compare()                                     ('1년 전 오늘' · '그때와 지금')
 * Hooks provided: 'gallery:addSharedFace' (LEAD director, M5 + 30 s)
 * Bus: 'gallery:view' id · 'gallery:info' id · 'gallery:album' id · 'gallery:live' count · 'gallery:memories'
 *      'gallery:compare' · 'gallery:edited' t · 'gallery:sharedFace'
 * Vars: shots (room camera), liveSeenCount, liveGap, editedShot, sharedFaceAt, sharedFaceSeen, memorySeen
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep, pad, clamp } = G.util;
  const GL = (G.gallery = {});
  const IMG = (k) => (G.IMG && G.IMG[k]) || '';
  const V = () => G.state.vars;
  const T = (s) => (G.T ? G.T(s) : s);
  const parseT = (t) => (G.chat && G.chat.parseT ? G.chat.parseT(t) : t ? new Date(t) : null);
  const srcOf = (p) => p.src || IMG(p.key);
  const sfx = (n, ...a) => { try { G.audio && G.audio.sfx[n] && G.audio.sfx[n](...a); } catch (e) {} };
  const note = (t) => { try { G.notebook && G.notebook.note && G.notebook.note(T(t)); } catch (e) {} };

  /* =========================================================
   * data
   * ========================================================= */
  const VIEWNAME = { door: '현관', bed: '침대', window: '창문', wardrobe: '옷장' };
  function shotPhotos() {
    return (V().shots || []).map((s) => {
      const d = new Date(s.t);
      const stamp = `${G.util.fmtDate(d).replace(/\./g, '')}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      const edited = V().editedShot != null && V().editedShot === s.t;
      return {
        id: 'shot_' + s.t, src: s.src, t: s.t, albums: ['mine'], shot: s, edited,
        info: Object.assign(
          { '파일': (s.screenshot ? 'Screenshot_' : '') + stamp + '.jpg', '기기': '세아의 Galaxy (SM-S911N)' },
          s.screenshot ? { '종류': '스크린샷' } : { '촬영': s.night ? '야간 모드' : (VIEWNAME[s.view] ? VIEWNAME[s.view] + ' 쪽' : '방 안'), '플래시': s.flash ? '켜짐' : '꺼짐' },
          edited ? { '수정': '방금 전 · 기기: 알 수 없음' } : {}),
        noDelete: '이 사진은 삭제할 수 없습니다 (관리자 설정)',
      };
    });
  }
  function sharedPhotos() {
    const S = G.STORY.shared || { photos: [] };
    const list = S.photos.map((p) => Object.assign({ albums: ['shared'], sharedItem: true, info: { '올린 사람': p.by, '앨범': S.name } }, p));
    if (V().sharedFaceAt && S.face) {
      list.unshift(Object.assign({ albums: ['shared'], sharedItem: true, t: V().sharedFaceAt, isFace: true, caption: '', comments: [{ by: 'sagongsa', text: S.face.comment }] }, S.face,
        { info: Object.assign({ '촬영': S.face.shotT.replace(/-/g, '.'), '올린 사람': 'sagongsa' }, S.face.info) }));
    }
    return list;
  }
  function photos() { return shotPhotos().concat((G.STORY.photos || []).filter((p) => !p.show || p.show())); }
  GL.photos = photos;
  GL.byId = function (id) {
    if (!id) return null;
    const all = photos().concat(sharedPhotos());
    let p = all.find((x) => x.id === id);
    if (!p && G.vault && G.vault.photoById) p = G.vault.photoById(id);
    return p || null;
  };
  function inAlbum(aid) {
    if (aid === 'all' || aid === 'recent') return photos();
    if (aid === 'shared') return sharedPhotos();
    return photos().filter((p) => (p.albums || []).includes(aid));
  }
  const tOf = (p) => +(parseT(p.t) || 0);
  function sorted(list) { return list.slice().sort((a, b) => tOf(b) - tOf(a)); }
  const faceUnseen = () => !!(V().sharedFaceAt && !V().sharedFaceSeen);

  /* status-bar text colour for this module's screens ('dark' = dark text on a light background) */
  G.bus.on('screen:push', (e) => {
    const n = e && e.node; if (!n || !n.classList) return;
    let st = null;
    if (['gx-view', 'gx-memscreen', 'gx-cmpscreen', 'photo-view'].some((c) => n.classList.contains(c))) st = 'light';
    else if (['gx-screen'].some((c) => n.classList.contains(c))) st = 'dark';
    if (!st) return;
    n.dataset.status = st;
    if (G.phone.top && G.phone.top() === e) G.phone.statusTheme(st);
  });

  /* =========================================================
   * custom div slider (One UI-like) — shared with the vault exposure editor
   * ========================================================= */
  GL.slider = function (o) {
    o = Object.assign({ min: 0, max: 100, value: 0, center: false, fmt: (v) => String(Math.round(v)) }, o);
    let v = o.value, locked = false, drag = false;
    const fill = el('i.gs-fill'), knob = el('b.gs-knob'), bubble = el('span.gs-bubble');
    const ticks = el('div.gs-ticks', null, Array.from({ length: 21 }, (_, i) => el('i' + (i % 5 === 0 ? '.major' : ''))));
    const track = el('div.gs-track', null, ticks, fill, knob, bubble);
    const val = el('span.gs-val');
    const node = el('div.gs' + (o.cls ? '.' + o.cls : ''), { role: 'slider', tabindex: 0, 'aria-label': o.label || '', 'aria-valuemin': o.min, 'aria-valuemax': o.max },
      o.label ? el('div.gs-head', null, el('span.gs-label', null, o.label), val) : null, track);
    const frac = (x) => (x - o.min) / (o.max - o.min);
    function render() {
      const f = clamp(frac(v), 0, 1);
      knob.style.left = (f * 100) + '%';
      bubble.style.left = (f * 100) + '%';
      if (o.center) { const c = frac(0); fill.style.left = (Math.min(c, f) * 100) + '%'; fill.style.width = (Math.abs(f - c) * 100) + '%'; }
      else { fill.style.left = '0'; fill.style.width = (f * 100) + '%'; }
      const txt = o.fmt(v); val.textContent = txt; bubble.textContent = txt;
      node.setAttribute('aria-valuenow', Math.round(v));
    }
    function setFromX(x) {
      const r = track.getBoundingClientRect();
      let nv = o.min + clamp((x - r.left) / r.width, 0, 1) * (o.max - o.min);
      if (o.center && Math.abs(nv) < (o.max - o.min) * 0.015) nv = 0; // detent at 0
      if (nv !== v) { v = nv; render(); o.onInput && o.onInput(v, true); }
    }
    node.addEventListener('pointerdown', (e) => {
      if (locked) return;
      e.preventDefault(); drag = true; node.classList.add('drag');
      try { node.setPointerCapture(e.pointerId); } catch (er) {}
      setFromX(e.clientX);
    });
    node.addEventListener('pointermove', (e) => { if (drag && !locked) setFromX(e.clientX); });
    const end = () => { if (!drag) return; drag = false; node.classList.remove('drag'); o.onEnd && o.onEnd(v); };
    node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end); node.addEventListener('lostpointercapture', end);
    node.addEventListener('keydown', (e) => {
      if (locked) return;
      const step = (o.max - o.min) / 50;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { v = clamp(v + step, o.min, o.max); render(); o.onInput && o.onInput(v, true); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { v = clamp(v - step, o.min, o.max); render(); o.onInput && o.onInput(v, true); e.preventDefault(); }
    });
    render();
    return {
      node,
      get: () => v,
      set(nv, silent) { v = clamp(nv, o.min, o.max); render(); if (!silent) o.onInput && o.onInput(v, false); },
      lock(on) { locked = !!on; node.classList.toggle('locked', locked); if (on && drag) { drag = false; node.classList.remove('drag'); } },
      isDragging: () => drag,
    };
  };

  /* =========================================================
   * app
   * ========================================================= */
  const IC = {
    photos: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    albums: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="7.5" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    stories: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.3 5 5.2.6-3.9 3.6 1.1 5.3L12 15.4 7.3 18l1.1-5.3L4.5 9.1l5.2-.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" fill="currentColor"/><path d="M2.8 19c.5-3.4 3-5.4 6.2-5.4s5.7 2 6.2 5.4z" fill="currentColor"/><circle cx="17" cy="9.5" r="2.5" fill="currentColor" opacity=".7"/><path d="M16 14c2.8 0 4.8 1.7 5.2 5h-4.4" fill="currentColor" opacity=".7"/></svg>',
    live: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1.6 2.2"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  };

  G.app('gallery', {
    name: '갤러리',
    icon: G.ICONS.gallery,
    badge: () => (faceUnseen() ? 1 : 0),
    open(p) {
      p = p || {};
      maybeEditBeat();
      let tab = p.tab || (p.album && p.album !== 'recent' ? 'albums' : 'photos');
      const content = el('div.gx-content');
      const tabbar = el('nav.gx-tabbar');
      const title = el('div.gx-bigtitle');
      const scr = G.ui.screen({ title: '갤러리', cls: 'gx-screen', body: el('div', null, title, content), footer: tabbar });
      function renderTabs() {
        tabbar.innerHTML = '';
        [['photos', '사진', IC.photos], ['albums', '앨범', IC.albums], ['stories', '추억', IC.stories]].forEach(([k, l, ic]) => {
          const b = el('button.gx-tb' + (tab === k ? '.on' : ''), { html: ic + `<span>${l}</span>` });
          if (k === 'albums' && faceUnseen()) b.appendChild(el('i.gx-dot'));
          b.addEventListener('click', () => { if (tab === k) return; sfx('tap'); tab = k; renderTabs(); render(); scr.body.scrollTop = 0; });
          tabbar.appendChild(b);
        });
      }
      function render() {
        content.innerHTML = '';
        title.textContent = { photos: '사진', albums: '앨범', stories: '추억' }[tab];
        if (tab === 'photos') {
          content.appendChild(memoryStrip());
          content.appendChild(grid(sorted(inAlbum('all')), { byDay: true }));
        } else if (tab === 'albums') content.appendChild(albumsView());
        else content.appendChild(storiesView());
      }
      renderTabs(); render();
      G.phone.push(scr, { onResume: () => { renderTabs(); render(); } });
      if (p.memories) { memories(); return; }
      if (p.album === 'recent') { const s = shotPhotos(); if (s.length) viewer(sorted(inAlbum('all')), sorted(s)[0]); return; }
      if (p.album) openAlbum(p.album, p.photo);
      else if (p.photo) { const ph = GL.byId(p.photo); if (ph) viewer(sorted(inAlbum('all')), ph); }
    },
  });

  function memoryStrip() {
    const mems = G.STORY.memories || [];
    if (!mems.length) return el('div');
    const m = mems[0];
    const ph = GL.byId(m.photo);
    if (!ph) return el('div');
    const card = el('button.gx-memcard', { style: { backgroundImage: `url("${srcOf(ph)}")` } },
      el('div.gx-mem-txt', null, el('b', null, m.title), el('span', null, '2025년 11월 24일')),
      !V().memorySeen ? el('i.gx-mem-new', null, '새 추억') : null);
    card.addEventListener('click', () => { sfx('tap'); memories(); });
    return el('div.gx-memwrap', null, el('div.gx-sec', null, '추억'), card);
  }

  function grid(list, o) {
    o = o || {};
    const wrap = el('div');
    if (!list.length) { wrap.appendChild(el('div.gx-empty', null, el('span', { html: IC.photos }), el('p', null, o.empty || '사진이 없습니다'))); return wrap; }
    let lastDay = null, g = null;
    list.forEach((ph) => {
      const d = parseT(ph.t);
      const dk = d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : '';
      if (!g || (o.byDay && dk !== lastDay)) {
        if (o.byDay) wrap.appendChild(el('div.gal-day', null, dk === todayKey() ? '오늘' : dk));
        g = el('div.gal-grid'); wrap.appendChild(g); lastDay = dk;
      }
      const cell = el('button.gal-cell.gx-cell', { style: { backgroundImage: `url("${ph.thumb || srcOf(ph)}")` }, 'aria-label': '사진' },
        ph.live ? el('span.gx-cbadge', { html: IC.live }) : null,
        ph.edited ? el('span.gx-cpill', { html: IC.pen }) : null,
        ph.isFace && !V().sharedFaceSeen ? el('span.gx-cnew', null, 'NEW') : null);
      cell.addEventListener('click', () => { sfx('tap'); viewer(list, ph, o.viewer); });
      g.appendChild(cell);
    });
    return wrap;
  }
  function todayKey() { const d = G.clock.now(); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`; }

  function albumsView() {
    const all = (G.STORY.albums || []).filter((a) => !a.show || a.show());
    const g = el('div.album-grid.gx-albums');
    all.forEach((a) => {
      const items = sorted(inAlbum(a.id));
      const cover = el('div.album-cover', { style: { backgroundImage: items[0] ? `url("${srcOf(items[0])}")` : 'none' } },
        a.shared ? el('span.gx-shared-ic', { html: IC.people }) : null,
        !items.length ? el('span.gx-cover-empty', { html: IC.photos }) : null);
      const b = el('button.album', null, cover,
        el('div.album-name', null, a.name, a.id === 'shared' && faceUnseen() ? el('i.gx-dot.inline') : null),
        el('div.album-count', null, a.shared ? `${items.length} · 멤버 ${(G.STORY.shared.members || []).length}명` : `${items.length}`));
      b.addEventListener('click', () => { sfx('tap'); openAlbum(a.id); });
      g.appendChild(b);
    });
    return g;
  }
  function storiesView() {
    const wrap = el('div.gx-stories');
    (G.STORY.memories || []).forEach((m) => {
      const ph = GL.byId(m.photo); if (!ph) return;
      const c = el('button.gx-story', { style: { backgroundImage: `url("${srcOf(ph)}")` } }, el('div.gx-mem-txt', null, el('b', null, m.title), el('span', null, '2025년 11월 24일 · 사진 1장')));
      c.addEventListener('click', () => { sfx('tap'); memories(m); });
      wrap.appendChild(c);
    });
    wrap.appendChild(el('div.gx-foot', null, '추억은 매일 새로 만들어져요.'));
    return wrap;
  }

  function openAlbum(aid, photoId) {
    if (aid === 'shared') { sharedAlbum(photoId); return; }
    const a = (G.STORY.albums || []).find((x) => x.id === aid);
    if (!a) return;
    const content = el('div');
    const scr = G.ui.screen({ title: a.name, sub: a.sub || null, body: content, cls: 'gx-screen gx-album' });
    function render() { content.innerHTML = ''; content.appendChild(grid(sorted(inAlbum(aid)), { byDay: aid !== 'live', empty: a.empty })); }
    render();
    G.phone.push(scr, { onResume: render });
    G.bus.emit('gallery:album', aid);
    if (photoId) { const list = sorted(inAlbum(aid)); const ph = list.find((x) => x.id === photoId); if (ph) viewer(list, ph); }
  }
  GL.openAlbum = openAlbum;

  /* ---------- 공유 앨범 '콩이' ---------- */
  function avatarNode(m, cls) {
    if (m.black) return el('span.gx-av.black' + (cls ? '.' + cls : ''));
    const n = el('span.gx-av' + (cls ? '.' + cls : ''), null, m.name.slice(0, 1));
    if (m.avatar && IMG(m.avatar)) { const i = el('img', { src: IMG(m.avatar), alt: '' }); i.onerror = () => i.remove(); n.appendChild(i); }
    return n;
  }
  function memberOf(name) { return ((G.STORY.shared || {}).members || []).find((m) => m.name === name) || { name }; }
  function sharedAlbum(photoId) {
    const S = G.STORY.shared;
    const content = el('div');
    const scr = G.ui.screen({ title: S.name, sub: `멤버 ${S.members.length}명`, body: content, cls: 'gx-screen gx-shared' });
    function render() {
      content.innerHTML = '';
      const mem = el('div.gx-members', null, S.members.map((m) => {
        const b = el('button.gx-member', null, avatarNode(m), el('span', null, m.name), m.role ? el('small', null, m.role) : null);
        b.addEventListener('click', () => {
          sfx('tap');
          if (m.black) G.phone.toast('sagongsa · 2025.03.10 참여 · 게시물 ' + (V().sharedFaceAt ? 1 : 0));
          else G.phone.toast(m.name + (m.role ? ' · ' + m.role : ' · 멤버'));
        });
        return b;
      }));
      content.appendChild(mem);
      const list = sorted(sharedPhotos());
      content.appendChild(grid(list, { byDay: false }));
      const acts = (V().sharedFaceAt ? [{ t: V().sharedFaceAt, text: 'sagongsa님이 사진 1장을 추가했습니다', sus: true, fresh: true }] : []).concat(S.activity || []);
      content.appendChild(el('div.gx-sec', null, '활동'));
      content.appendChild(el('div.gx-acts', null, acts.map((a) => {
        const d = parseT(a.t);
        return el('div.gx-act' + (a.sus ? '.sus' : ''), null, el('span', null, a.text), el('small', null, a.fresh ? '방금' : d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : ''));
      })));
    }
    render();
    G.phone.push(scr, { onResume: render });
    G.bus.emit('gallery:album', 'shared');
    if (photoId) { const list = sorted(sharedPhotos()); const ph = list.find((x) => x.id === photoId); if (ph) viewer(list, ph); }
  }

  /* ---------- 추억: 1년 전 오늘 + 그때와 지금 ---------- */
  function memories(m) {
    m = m || (G.STORY.memories || [])[0];
    if (!m) return;
    const ph = GL.byId(m.photo); if (!ph) return;
    const d = parseT(ph.t);
    if (!V().memorySeen) { V().memorySeen = Date.now(); G.save(); }
    const pic = el('div.gx-mem-pic', { style: { backgroundImage: `url("${srcOf(ph)}")` } });
    const body = el('div.gx-mem', null,
      pic,
      el('div.gx-mem-top', null, el('div.gx-mem-k', null, m.title), el('div.gx-mem-d', null, `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${G.util.fmtKTime(d)}`)),
      el('div.gx-mem-bot', null,
        el('button.gx-pill.light', { onclick: () => { sfx('tap'); compare(m); } }, '그때와 지금'),
        el('button.gx-pill', { onclick: () => { sfx('tap'); viewer([ph], ph); } }, '사진 보기')));
    const scr = G.ui.screen({ title: '', theme: 'dark', cls: 'gx-memscreen', body, bodyCls: 'nopad' });
    G.phone.push(scr, { anim: 'up' });
    requestAnimationFrame(() => pic.classList.add('in'));
    G.bus.emit('gallery:memories', m.id);
  }
  GL.memories = memories;

  function compare(m) {
    m = m || (G.STORY.memories || [])[0];
    const ph = GL.byId(m.photo);
    const nowD = G.clock.now();
    const gap = G.ROOM && G.ROOM.gapStage ? G.ROOM.gapStage() : 0;
    const after = el('div.gx-cmp-img.now', null, el('img', { src: IMG(m.compare || 'room_wardrobe'), alt: '' }),
      gap > 0 && IMG('gap_stage_' + gap) ? el('img.gx-cmp-ov', { src: IMG('gap_stage_' + gap), alt: '' }) : null);
    const before = el('div.gx-cmp-img.then', null, el('img', { src: srcOf(ph), alt: '' }));
    const handle = el('div.gx-cmp-handle', null, el('i'));
    const box = el('div.gx-cmp', null, after, before, handle,
      el('span.gx-cmp-lab.l', null, '그때 · 2025.11.24 03:29'),
      el('span.gx-cmp-lab.r', null, `지금 · 2026.11.24 ${pad(nowD.getHours())}:${pad(nowD.getMinutes())}`));
    let f = 0.5;
    const setF = (x) => { f = clamp(x, 0.04, 0.96); before.style.clipPath = `inset(0 ${(1 - f) * 100}% 0 0)`; handle.style.left = f * 100 + '%'; };
    let drag = false;
    box.addEventListener('pointerdown', (e) => { drag = true; try { box.setPointerCapture(e.pointerId); } catch (er) {} const r = box.getBoundingClientRect(); setF((e.clientX - r.left) / r.width); });
    box.addEventListener('pointermove', (e) => { if (!drag) return; const r = box.getBoundingClientRect(); setF((e.clientX - r.left) / r.width); });
    ['pointerup', 'pointercancel'].forEach((ev) => box.addEventListener(ev, () => { drag = false; }));
    const body = el('div.gx-cmpwrap', null, box);
    const scr = G.ui.screen({ title: '그때와 지금', sub: '1년 전 오늘', theme: 'dark', cls: 'gx-cmpscreen', body, bodyCls: 'nopad' });
    G.phone.push(scr);
    setF(0.5);
    // a slow, unprompted reveal sweep so the player sees both halves once
    (async () => { await sleep(700); for (let i = 0; i <= 30 && !drag; i++) { setF(0.5 - 0.32 * Math.sin((i / 30) * Math.PI)); await sleep(30); } })();
    if (!G.flag('memoryCompared')) { G.flag('memoryCompared', true); setTimeout(() => note(m.note), 900); }
    G.bus.emit('gallery:compare', m.id);
  }
  GL.compare = compare;

  /* ---------- B14 편집됨: after F2, on the next gallery visit, his edit appears on the player's earliest photo ---------- */
  function maybeEditBeat() {
    if (!G.flag('F2') || V().editedShot != null) return;
    let shots = V().shots || [];
    if (!shots.length) {
      // the player never took a photo: a silent screenshot exists (design §4.6)
      const t = G.clock.now().getTime() - 21 * 60000;
      shots = [{ view: 'wardrobe', src: IMG('room_wardrobe'), t, screenshot: true }];
      V().shots = shots;
    }
    const earliest = shots.reduce((a, b) => (a.t <= b.t ? a : b));
    V().editedShot = earliest.t; G.save();
    G.flag('galleryEdited', true);
    G.bus.emit('gallery:edited', earliest.t);
  }
  GL.maybeEditBeat = maybeEditBeat;

  function editOverlay(shot) {
    const view = shot.night ? 'other' : shot.view;
    if (view === 'wardrobe') {
      const cur = G.ROOM && G.ROOM.gapStage ? G.ROOM.gapStage() : 0;
      const k = 'gap_stage_' + Math.min(4, Math.max(2, cur + 1));
      const i = el('img.gx-edit-ov', { src: IMG(k), alt: '' });
      i.onerror = () => i.remove();
      return el('div.gx-edit', null, i);
    }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1536'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'gx-edit-svg');
    if (view === 'bed') {
      // finger-drawn red circle around the bed (a little wobbly, overlapping at the end)
      let d = ''; const cx = 575, cy = 1040, rx = 360, ry = 215;
      for (let i = 0; i <= 44; i++) {
        const a = -2.2 + (i / 40) * Math.PI * 2;
        const w = 1 + Math.sin(i * 1.7) * 0.035 + (i / 44) * 0.06;
        d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rx * w).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * w).toFixed(1);
      }
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('class', 'gx-scrawl-line');
      svg.appendChild(p);
    } else {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', '930'); t.setAttribute('y', '1410'); t.setAttribute('text-anchor', 'end');
      t.setAttribute('transform', 'rotate(-9 930 1410)'); t.setAttribute('class', 'gx-scrawl-text');
      t.textContent = T('{N}');
      const u = document.createElementNS(NS, 'path');
      u.setAttribute('d', 'M560 1450 C 640 1430, 760 1470, 940 1395'); u.setAttribute('class', 'gx-scrawl-line thin');
      svg.append(t, u);
    }
    return el('div.gx-edit', null, svg);
  }

  /* ---------- P6 psychological peak: sagongsa adds a photo to the shared album ---------- */
  function reversedSwell() {
    const A = G.audio;
    try {
      if (!A || !A.ok || !A.ok()) return;
      const t = A.now();
      [45, 52, 57, 64].forEach((m, i) => A.osc('triangle', A.mtof(m), t + i * 0.02, 2.0, 0.035, A.bus('sfx'), { a: 1.9, r: 0.03, filter: { freq: 1600 } }));
      A.noise(t, 2.0, 0.05, A.bus('sfx'), { a: 1.95, filters: [{ type: 'lowpass', freq: 900 }] });
    } catch (e) {}
  }
  G.hooks.set('gallery:addSharedFace', function () {
    if (V().sharedFaceAt) return false;
    V().sharedFaceAt = G.clock.now().getTime(); G.save();
    G.flag('sharedFace', true);
    reversedSwell();
    setTimeout(() => {
      G.phone.notify({ app: 'gallery', title: "공유 앨범 '콩이'", body: 'sagongsa님이 사진 1장을 추가했습니다', tone: 'album', route: { app: 'gallery', params: { album: 'shared', photo: 'SH_FACE' } } });
      G.phone.refreshBadges && G.phone.refreshBadges();
    }, 1700);
    G.bus.emit('gallery:sharedFace');
    return true;
  });

  /* =========================================================
   * viewer
   * ========================================================= */
  function fmtFull(d) { return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${G.util.fmtKTime(d)}` : ''; }
  const TOOLS = {
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  };
  function viewer(list, ph, opts) {
    opts = opts || {};
    list = list && list.length ? list : [ph];
    let idx = Math.max(0, list.indexOf(ph));
    const stage = el('div.photo-stage.gx-stage');
    const cap = el('div.gx-capwrap');
    const tools = el('div.photo-tools');
    const scr = G.ui.screen({ title: '', theme: 'dark', cls: 'photo-view gx-view' + (opts.cls ? ' ' + opts.cls : ''), body: el('div.gx-vbody', null, stage, cap, tools), bodyCls: 'nopad' });
    let zv = null, infoPanel = null, editPanel = null, liveCtl = null, editState = null;
    let fx = { exp: 0, bri: 0, con: 0, flip: false };
    const fired = {};
    const cur = () => list[idx];
    function ctx() { return { photo: cur(), viewer: zv, screen: scr, stage, sub: (t, ms) => G.fx.sub(T(t), ms), rerender: show }; }
    function applyFilter() {
      if (!zv) return;
      const b = Math.pow(2, fx.exp / 50) * (1 + fx.bri / 220);
      const c = 1 + fx.con / 110;
      const f = (fx.exp || fx.bri || fx.con) ? `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)})` : '';
      zv.querySelector('.zoom-inner').style.filter = f;
      zv.img.style.transform = fx.flip ? 'scaleX(-1)' : '';
    }
    function show() {
      const p = cur();
      if (liveCtl) { liveCtl.dispose(); liveCtl = null; }
      stage.innerHTML = '';
      fx = { exp: 0, bri: 0, con: 0, flip: false };
      const overlay = el('div.gx-ov');
      zv = G.ui.zoomViewer(srcOf(p), {
        maxScale: p.maxZoom || 8, overlay,
        onChange: (z) => {
          (p.zoomTriggers || []).forEach((tr) => {
            const k = p.id + ':' + tr.id;
            if (fired[k] && tr.once !== false) return;
            if (z.scale >= (tr.minScale || 4) && Math.hypot(z.cx - tr.x, z.cy - tr.y) < (tr.r || 0.08)) { fired[k] = true; tr.onHit && tr.onHit(ctx()); }
          });
        },
      });
      zv.img.addEventListener('error', () => zv.classList.add('noimg'));
      zv.addEventListener('contextmenu', (e) => e.preventDefault());
      stage.appendChild(zv);
      // badges
      const badges = el('div.gx-badges');
      if (p.live) badges.appendChild(el('span.gx-livebadge', { html: IC.live + '<b>LIVE</b>' }));
      if (p.edited) badges.appendChild(el('span.gx-editpill', { html: IC.pen + '<b>편집됨</b>' }));
      stage.appendChild(badges);
      if (p.live) liveCtl = setupLive(p, zv, overlay, stage, badges);
      editState = null;
      if (p.edited && p.shot) { const eo = editOverlay(p.shot); overlay.appendChild(eo); editState = { node: eo, badges }; }
      // header
      const d = parseT(p.t);
      scr.querySelector('.sv-title').textContent = opts.title || (d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : (p.title || ''));
      const sub = scr.querySelector('.sv-sub') || scr.querySelector('.sv-titles').appendChild(el('div.sv-sub'));
      sub.textContent = d ? `${d.getFullYear()}년 · ${G.util.fmtKTime(d)}` : '';
      prev.style.visibility = idx > 0 ? '' : 'hidden';
      next.style.visibility = idx < list.length - 1 ? '' : 'hidden';
      if (infoPanel) { infoPanel.remove(); infoPanel = null; }
      if (editPanel) { editPanel.remove(); editPanel = null; }
      renderCaption();
      renderTools();
      G.state.seen['photo:' + p.id] = true;
      if (p.isFace && !V().sharedFaceSeen) { V().sharedFaceSeen = Date.now(); G.phone.refreshBadges && G.phone.refreshBadges(); faceSeenBeat(); }
      G.save();
      G.bus.emit('gallery:view', p.id);
      p.onView && p.onView(ctx());
    }
    function renderCaption() {
      const p = cur();
      cap.innerHTML = '';
      cap.classList.toggle('on', !!p.sharedItem);
      if (!p.sharedItem) return;
      const m = memberOf(p.by);
      const d = parseT(p.t);
      const cm = (p.comments || []).map((c) => el('div.gx-cm' + (c.by === 'sagongsa' ? '.sus' : ''), null, el('b', null, c.by), ' ', T(c.text)));
      [el('div.gx-cap-h', null, avatarNode(m, 'sm'), el('b', null, p.by), el('small', null, p.isFace ? '방금 전' : d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : '')),
        p.caption ? el('div.gx-cap-t', null, T(p.caption)) : null, cm.length ? el('div.gx-cms', null, cm) : null].forEach((n) => { if (n) cap.appendChild(n); });
    }
    function renderTools() {
      const p = cur();
      tools.innerHTML = '';
      const t = (label, svg, fn, on) => { const b = el('button' + (on ? '.on' : ''), { html: svg + `<span>${label}</span>` }); b.addEventListener('click', () => { sfx('tap'); fn(); }); tools.appendChild(b); };
      t('정보', TOOLS.info, toggleInfo, !!infoPanel);
      t('편집', TOOLS.edit, () => (p.onEdit ? p.onEdit(ctx()) : toggleEdit()), !!editPanel);
      t('공유', TOOLS.share, () => G.phone.toast(p.noShare ? T(p.noShare) : '네트워크에 연결되어 있지 않습니다'));
      t('삭제', TOOLS.del, () => G.phone.toast(p.noDelete ? T(p.noDelete) : '이 사진은 삭제할 수 없습니다 (읽기 전용)'));
    }
    function toggleInfo() {
      if (editPanel) { editPanel.remove(); editPanel = null; }
      if (infoPanel) { infoPanel.classList.remove('in'); const n = infoPanel; setTimeout(() => n.remove(), 300); infoPanel = null; renderTools(); return; }
      const p = cur();
      const d = parseT(p.t);
      const extra = typeof p.info === 'function' ? p.info() : p.info || {};
      const rows = Object.assign({ '날짜': fmtFull(d) }, extra);
      infoPanel = el('div.photo-info.gx-info', null, el('i.gx-grab'), Object.keys(rows).map((k) => el('div.pi-row' + (/수정|업로드|원격|SM-G991N|sagongsa/.test(k + rows[k]) ? '.sus' : ''), null, el('span', null, k), el('span', null, T(String(rows[k]))))));
      stage.appendChild(infoPanel);
      requestAnimationFrame(() => infoPanel.classList.add('in'));
      G.bus.emit('gallery:info', p.id);
      p.onInfo && p.onInfo(ctx());
      renderTools();
    }
    function toggleEdit() {
      if (infoPanel) { infoPanel.remove(); infoPanel = null; }
      if (editPanel) { editPanel.classList.remove('in'); const n = editPanel; setTimeout(() => n.remove(), 300); editPanel = null; renderTools(); return; }
      const p = cur();
      const sl = (label, key) => GL.slider({ label, min: -100, max: 100, value: fx[key], center: true, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v), onInput: (v) => { fx[key] = v; applyFilter(); } });
      const sExp = sl('노출', 'exp'), sBri = sl('밝기', 'bri'), sCon = sl('대비', 'con');
      const btns = el('div.gx-editbtns',
        null,
        el('button.gx-chip', { onclick: (e) => { fx.flip = !fx.flip; e.currentTarget.classList.toggle('on', fx.flip); applyFilter(); G.bus.emit('gallery:flip', p.id); } }, '좌우 반전'),
        el('button.gx-chip', { onclick: () => { sExp.set(0); sBri.set(0); sCon.set(0); fx.flip = false; applyFilter(); if (p.edited) revertEdit(); } }, p.edited ? '원본으로 되돌리기' : '원본으로'));
      editPanel = el('div.photo-edit.gx-editpanel', null, sExp.node, sBri.node, sCon.node, btns);
      stage.appendChild(editPanel);
      requestAnimationFrame(() => editPanel.classList.add('in'));
      renderTools();
    }
    async function revertEdit() {
      if (!editState || editState.reverting) return;
      const es = editState; es.reverting = true;
      es.node.classList.add('gone');
      const pill = es.badges.querySelector('.gx-editpill'); if (pill) pill.classList.add('gone');
      G.phone.toast('원본으로 되돌렸습니다');
      await sleep(3000);
      if (editState !== es) return;
      es.node.classList.remove('gone'); if (pill) pill.classList.remove('gone');
      es.reverting = false;
      sfx('pen');
    }
    function faceSeenBeat() {
      note('공유 앨범에 내 사진이 올라왔다. 지금 이 침대. 옷장 쪽에서 찍혔다.');
      try { G.audio && G.audio.duck && G.audio.duck(0.6, 2.5); } catch (e) {}
    }
    // prev/next by edge swipe at scale 1
    let sx = null;
    stage.addEventListener('touchstart', (e) => { if (e.touches.length === 1 && zv && zv.dataset.zoom === '1.00' && !(liveCtl && liveCtl.playing())) sx = e.touches[0].clientX; else sx = null; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 70) { const ni = idx + (dx < 0 ? 1 : -1); if (ni >= 0 && ni < list.length) { idx = ni; show(); } }
    });
    const prev = el('button.gx-nav', { 'aria-label': '이전', html: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', onclick: () => { if (idx > 0) { idx--; show(); } } });
    const next = el('button.gx-nav', { 'aria-label': '다음', html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', onclick: () => { if (idx < list.length - 1) { idx++; show(); } } });
    scr.querySelector('.sv-right').append(prev, next);
    G.phone.push(scr, { anim: 'fade', onClose: () => { if (liveCtl) liveCtl.dispose(); } });
    show();
    scr.viewerApi = { show, current: cur, ctx };
    return scr;
  }
  GL.viewer = viewer;
  GL.viewSingle = function (src, o) {
    o = o || {};
    const p = (o.photoId && GL.byId(o.photoId)) || { id: 'single:' + src, src, t: o.t || null, info: o.info };
    return viewer([p], p, { title: o.photoId ? null : o.title });
  };

  /* =========================================================
   * LIVE photo (IMG_1115): press & hold ≥350 ms
   * 1st: frames + 오르골 (first 2 bars), door opens 1→2 cm, fingertips in the last 0.4 s
   * 2nd: + spring wind-down · 3rd: + close breath, and the still keeps the 1 cm gap forever
   * ========================================================= */
  function setupLive(p, zv, overlay, stage, badges) {
    const frames = p.live.frames.map((k) => { const i = el('img.gx-live-f', { src: IMG(k), alt: '', draggable: 'false' }); i.onerror = () => i.remove(); return i; });
    frames.forEach((f) => overlay.appendChild(f));
    const chip = el('div.gx-livechip', null, el('i', { html: IC.live }), el('span', null, p.live.sub || '♪'));
    stage.appendChild(chip);
    let pressT = null, sx = 0, sy = 0, playing = null;
    function onDown(e) {
      if (e.button) return;
      sx = e.clientX; sy = e.clientY;
      clearTimeout(pressT);
      pressT = setTimeout(() => { pressT = null; start(); }, 350);
    }
    function onMove(e) { if (pressT && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(pressT); pressT = null; } }
    function onUp() { clearTimeout(pressT); pressT = null; if (playing) stop(true); }
    zv.addEventListener('pointerdown', onDown);
    zv.addEventListener('pointermove', onMove);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => zv.addEventListener(ev, onUp));
    function start() {
      if (playing) return;
      const n = (V().liveSeenCount || 0) + 1;
      V().liveSeenCount = n; G.save();
      G.flag('liveSeen', true);
      if (navigator.vibrate && G.settings.vibration) try { navigator.vibrate(12); } catch (e) {}
      const pl = (playing = { n, timers: [], mb: null });
      stage.classList.add('gx-live-on');
      badges.classList.add('live-on');
      chip.classList.add('in');
      frames.forEach((f) => { f.style.transition = 'none'; f.style.opacity = '0'; });
      if (frames[0]) { frames[0].style.opacity = '1'; }
      let dur = 4.3;
      try { if (G.audio && G.audio.musicBox) { pl.mb = G.audio.musicBox({ variant: 'live' }); if (pl.mb && pl.mb.duration) dur = pl.mb.duration - 0.9; } } catch (e) {}
      dur = clamp(dur, 2.4, 5.5);
      const at = (s, fn) => pl.timers.push(setTimeout(fn, s * 1000));
      at(dur - 1.0, () => { if (frames[1]) { frames[1].style.transition = 'opacity .28s'; frames[1].style.opacity = '1'; } });
      at(dur - 0.4, () => { if (frames[2]) { frames[2].style.transition = 'opacity .12s'; frames[2].style.opacity = '1'; } });
      let end = dur;
      if (n >= 2) { at(dur, () => windDown()); at(dur + 0.2, () => G.fx.sub('(태엽이 풀리는 소리… 딸깍)', 1600)); end = dur + 1.4; }
      if (n >= 3) { at(dur + 0.9, () => { try { G.audio.sfx.breathNear ? G.audio.sfx.breathNear(2.6) : G.audio.sfx.breath(1, { vol: 0.8 }); } catch (e) {} G.fx.sub('(…아주 가까이에서, 숨소리)', 2200); }); end = dur + 3.2; }
      at(end, () => stop(false));
      G.bus.emit('gallery:live', n);
    }
    function stop(released) {
      const pl = playing; if (!pl) return;
      playing = null;
      pl.timers.forEach(clearTimeout);
      if (released && pl.mb && pl.mb.stop) { try { pl.mb.stop(); } catch (e) {} }
      frames.forEach((f) => { f.style.transition = 'opacity .22s'; f.style.opacity = '0'; });
      stage.classList.remove('gx-live-on');
      badges.classList.remove('live-on');
      chip.classList.remove('in');
      if (pl.n >= 3 && !V().liveGap) { V().liveGap = true; G.save(); setTimeout(() => { if (zv && zv.img) zv.img.src = IMG('sea_orgel_live_1'); }, 240); }
    }
    function windDown() {
      const A = G.audio;
      try {
        if (!A || !A.ok || !A.ok()) return;
        let t = A.now(), gap = 0.16;
        for (let i = 0; i < 7; i++) { A.noise(t, 0.006, 0.22 - i * 0.02, A.bus('music'), { filters: [{ type: 'highpass', freq: 2600 + i * 120 }] }); t += gap; gap *= 1.32; }
      } catch (e) {}
    }
    return {
      playing: () => !!playing,
      dispose() { clearTimeout(pressT); if (playing) stop(true); },
    };
  }
})();
