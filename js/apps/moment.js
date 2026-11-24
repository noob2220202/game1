/* =========================================================
 * 모먼트 (SNS) — DESIGN §3 H4, §4.6, P5.
 * Profile grid → feed (newest first; captions = the acrostic), comments,
 * '좋아요 1 · sagongsa' → private profile, LIVE 오르골 post → G.gallery.viewSingle(..., {photoId:'IMG_1115'}).
 * Emits: 'moment:profile' id, 'moment:post' postId (when a post scrolls into view).
 * Flags: sagongsaSeen, acrosticSeen (the 25.11.17 post was shown in the feed).
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el, sleep } = G.util;
  const SD = G.sd;
  const T = (s) => SD.T(s);
  const MO = (G.moment = {});
  const S = () => G.STORY.moment || { profiles: {} };
  const posts = (pr) => (pr.posts || []).filter((p) => !p.show || p.show()).slice().sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t));

  const IC = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    heartF: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="currentColor"/></svg>',
    cmt: '<svg viewBox="0 0 24 24"><path d="M20.5 11.6a8.4 8.4 0 01-12.3 7.4L3.5 20.5l1.6-4.4A8.4 8.4 0 1120.5 11.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-6-4.5-6 4.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    feed: '<svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 18h16M4 21h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    live: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1.6 2.2"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>',
  };

  /* image box with fallbacks: post.img → post.alt (crop) → placeholder */
  function imgBox(post, cls) {
    const box = el('div.mo-img' + (cls ? '.' + cls : ''));
    const tries = [{ key: post.img, pos: post.pos, zoom: post.zoom, filter: post.filter }];
    if (post.alt) tries.push({ key: post.alt, pos: post.altPos, zoom: post.altZoom, filter: post.filter });
    let i = 0;
    function apply() {
      const t = tries[i];
      if (!t) { box.classList.add('noimg'); return; }
      const url = SD.img(t.key);
      const im = new Image();
      im.onload = () => {
        box.style.backgroundImage = `url("${url}")`;
        box.style.backgroundPosition = t.pos || '50% 50%';
        box.style.backgroundSize = t.zoom ? `${t.zoom * 100}% auto` : 'cover';
        if (t.filter) box.style.filter = t.filter;
        box._url = url;
      };
      im.onerror = () => { i++; apply(); };
      im.src = url;
    }
    apply();
    return box;
  }
  function avatarBox(pr, size) {
    const a = (pr && pr.avatar) || {};
    const n = el('span.mo-av', { style: { width: size + 'px', height: size + 'px' } });
    if (a.black) { n.classList.add('black'); return n; }
    n.style.background = a.bg || '#d9d9de';
    n.appendChild(el('span.mo-av-i', null, a.initial || ''));
    const face = el('span.mo-av-img');
    const tryKeys = [a.img, a.fallback].filter(Boolean);
    let i = 0;
    (function next() { const k = tryKeys[i++]; if (!k) return; const url = SD.img(k); const im = new Image(); im.onload = () => { face.style.backgroundImage = `url("${url}")`; }; im.onerror = next; im.src = url; })();
    n.appendChild(face);
    return n;
  }
  function rel(d) {
    const now = G.clock.now();
    const diff = (now - d) / 60000;
    if (diff >= 0 && diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
    if (diff >= 0 && diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  G.app('moment', {
    name: '모먼트',
    icon: G.ICONS.moment,
    open(p) {
      MO.profile((p && p.profile) || S().me);
      if (p && p.post) MO.feed((p && p.profile) || S().me, p.post);
    },
  });

  /* ---------------- profile ---------------- */
  MO.profile = function (id) {
    const pr = S().profiles[id];
    if (!pr) { G.phone.toast('프로필을 불러올 수 없습니다'); return; }
    const isMe = id === S().me;
    const ps = posts(pr);
    let mode = 'grid';
    const content = el('div.mo-content');
    const stat = (n, l, fn) => el('button.mo-stat', { onclick: fn || null }, el('b', null, String(n)), el('span', null, l));
    const head = el('div.mo-prof', null, avatarBox(pr, 86),
      el('div.mo-stats', null,
        stat(pr.postCount != null ? pr.postCount : ps.length, '게시물'),
        stat(pr.followers || 0, '팔로워', () => G.phone.toast('목록을 불러올 수 없습니다 · 네트워크 제한')),
        stat(pr.following || 0, '팔로잉', () => following(pr))));
    const bio = el('div.mo-bio', null, pr.name ? el('b', null, T(pr.name)) : null, pr.bio ? el('div', null, T(pr.bio)) : null);
    const btns = isMe
      ? el('div.mo-btns', null, el('button', { onclick: () => G.phone.toast('이 계정은 다른 기기에서도 로그인되어 있습니다') }, '프로필 편집'), el('button', { onclick: () => G.phone.toast('공유할 수 없습니다 · 네트워크 제한') }, '프로필 공유'))
      : el('div.mo-btns', null, el('button.primary', { onclick: () => G.phone.toast(pr.private ? '팔로우 요청을 보낼 수 없습니다' : '팔로잉') }, pr.private ? '팔로우' : '팔로잉'), el('button', { onclick: () => G.phone.toast('메시지를 보낼 수 없습니다 · 네트워크 제한') }, '메시지'));
    const tabs = el('div.mo-tabs');
    function render() {
      content.innerHTML = ''; tabs.innerHTML = '';
      if (pr.private && !isMe) {
        content.appendChild(el('div.mo-private', null, el('span', { html: IC.lock }), el('b', null, '비공개 계정입니다'), el('small', null, '사진과 동영상을 보려면 이 계정을 팔로우하세요.')));
        return;
      }
      [['grid', IC.grid], ['feed', IC.feed]].forEach(([k, ic]) => {
        const b = el('button' + (mode === k ? '.on' : ''), { html: ic, 'aria-label': k === 'grid' ? '그리드' : '피드' });
        b.addEventListener('click', () => { if (mode === k) return; G.audio.sfx.tap(); mode = k; render(); });
        tabs.appendChild(b);
      });
      if (mode === 'grid') {
        const grid = el('div.mo-grid');
        ps.forEach((post) => {
          const cell = el('button.mo-cell', { 'aria-label': '게시물' }, imgBox(post), post.live ? el('span.mo-live-ic', { html: IC.live }) : null);
          cell.addEventListener('click', () => { G.audio.sfx.tap(); MO.feed(id, post.id); });
          grid.appendChild(cell);
        });
        content.appendChild(grid);
      } else content.appendChild(feedList(id, pr, ps));
      content.appendChild(moreFail(pr));
    }
    render();
    const scr = G.ui.screen({ title: pr.handle, cls: 'mo-screen', right: [el('button', { html: IC.more, 'aria-label': '메뉴', onclick: () => G.phone.toast(isMe ? '세아의 계정 · seah.y@hanmail.net' : '@' + pr.handle) })], body: el('div', null, head, bio, btns, tabs, content) });
    if (pr.private) scr.querySelector('.sv-title').prepend(el('span.mo-lock', { html: IC.lock }));
    G.phone.push(scr);
    G.bus.emit('moment:profile', id);
    if (id === 'sagongsa') {
      if (!G.flag('sagongsaSeen')) SD.note('sagongsa — 비공개, 게시물 0. 팔로잉은 세아 하나뿐. 오늘 밤 글에만 좋아요.');
      G.flag('sagongsaSeen', true);
    }
  };
  function moreFail(pr) {
    if (!pr.postCount || posts(pr).length >= pr.postCount) return el('div');
    const n = el('div.mo-more', null, el('span', null, '이전 게시물을 불러오지 못했습니다.'), el('button', null, '다시 시도'));
    const b = n.querySelector('button');
    b.addEventListener('click', async () => { G.audio.sfx.tap(); b.disabled = true; b.textContent = '불러오는 중…'; await sleep(1300); b.disabled = false; b.textContent = '다시 시도'; G.phone.toast('관리자 네트워크에서 연결이 제한되었습니다'); });
    return n;
  }
  function following(pr) {
    const list = (pr.followingList || []).map((h) => S().profiles[h]).filter(Boolean);
    if (!list.length) { G.phone.toast('목록을 불러올 수 없습니다 · 네트워크 제한'); return; }
    const body = el('div.mo-follow', null, list.map((p) => el('button.mo-frow', { onclick: () => MO.profile(p.handle) }, avatarBox(p, 46), el('div', null, el('b', null, p.handle), el('small', null, T(p.name || ''))))));
    G.phone.push(G.ui.screen({ title: '팔로잉', cls: 'mo-screen', body }));
  }

  /* ---------------- feed ---------------- */
  function postNode(pid, pr, post) {
    const d = G.chat.parseT(post.t);
    const img = imgBox(post, 'feed');
    if (post.live) img.appendChild(el('span.mo-live', null, el('i', { html: IC.live }), 'LIVE'));
    let liked = !!(G.state.vars.moLikes || {})[post.id];
    const heartBtn = el('button.mo-act' + (liked ? '.liked' : ''), { 'aria-label': '좋아요', html: liked ? IC.heartF : IC.heart });
    function setLike(v) {
      liked = v;
      const L = (G.state.vars.moLikes = G.state.vars.moLikes || {}); if (v) L[post.id] = 1; else delete L[post.id]; G.save();
      heartBtn.innerHTML = v ? IC.heartF : IC.heart; heartBtn.classList.toggle('liked', v);
      heartBtn.classList.remove('pop'); void heartBtn.offsetWidth; heartBtn.classList.add('pop');
      likesEl.replaceWith(likesEl = likesLine());
    }
    heartBtn.addEventListener('click', () => { G.audio.sfx.tap(); setLike(!liked); });
    function likesLine() {
      const n = (post.likes || 0) + (liked ? 1 : 0);
      if (post.likedBy && post.likedBy.length) {
        const who = post.likedBy.map((h) => el('button.mo-h', { onclick: () => MO.profile(h) }, h));
        return el('div.mo-likes', null, `좋아요 ${n}`, ' · ', who);
      }
      return el('div.mo-likes', null, `좋아요 ${n}개`);
    }
    let likesEl = likesLine();
    // tap -> photo viewer (LIVE: gallery LIVE photo); double-tap -> like
    let lastTap = 0, tapT = null;
    img.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTap < 280) { clearTimeout(tapT); lastTap = 0; if (!liked) setLike(true); burst(img); return; }
      lastTap = now;
      tapT = setTimeout(() => openPhoto(post, img), 280);
    });
    if (post.live) G.ui.onLongPress(img, () => { clearTimeout(tapT); openPhoto(post, img); }, 350);
    const cm = (post.comments || []).filter((c) => !c.show || c.show());
    const node = el('article.mo-post', { dataset: { pid: post.id } },
      el('div.mo-ph', null, avatarBox(pr, 32), el('b', null, pr.handle), el('span.mo-ph-more', { html: IC.more })),
      img,
      el('div.mo-acts', null, heartBtn,
        el('button.mo-act', { 'aria-label': '댓글', html: IC.cmt, onclick: () => { G.audio.sfx.tap(); const c = node.querySelector('.mo-cmts'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); else G.phone.toast('댓글을 달 수 없습니다 · 네트워크 제한'); } }),
        el('button.mo-act', { 'aria-label': '공유', html: IC.share, onclick: () => G.phone.toast('공유할 수 없습니다 · 네트워크 제한') }),
        el('span.sp'),
        el('button.mo-act', { 'aria-label': '저장', html: IC.save, onclick: () => G.phone.toast('저장됨') })),
      likesEl,
      el('div.mo-cap', null, el('b', null, pr.handle), ' ', T(post.caption || '')),
      cm.length ? el('div.mo-cmts', null, cm.map((c) => {
        const prof = S().profiles[c.h];
        return el('div.mo-cmt', null, el('button.mo-h', { onclick: () => (prof ? MO.profile(c.h) : G.phone.toast('프로필을 불러올 수 없습니다')) }, c.h), ' ', T(c.text));
      })) : null,
      el('div.mo-date', null, d ? rel(d) : ''));
    return node;
  }
  function burst(img) {
    const h = el('span.mo-burst', { html: IC.heartF });
    img.appendChild(h);
    setTimeout(() => h.remove(), 900);
  }
  function openPhoto(post, img) {
    const url = img._url || SD.img(post.img);
    if (!G.gallery || !G.gallery.viewSingle) { G.phone.toast('사진을 열 수 없습니다'); return; }
    G.gallery.viewSingle(url, { photoId: post.photoId, t: post.t, title: post.live ? 'LIVE' : '' });
    G.bus.emit('moment:photo', post.id);
  }
  function feedList(pid, pr, ps) {
    const list = el('div.mo-feed');
    ps.forEach((post) => list.appendChild(postNode(pid, pr, post)));
    // report posts that come into view
    try {
      const io = new IntersectionObserver((ents) => ents.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target.dataset.pid;
        if (!G.state.seen['post:' + id]) { G.state.seen['post:' + id] = true; G.save(); }
        G.bus.emit('moment:post', id);
        if (id === 'p1117') G.flag('acrosticSeen', true);
      }), { threshold: 0.5 });
      setTimeout(() => list.querySelectorAll('.mo-post').forEach((n) => io.observe(n)), 50);
    } catch (e) {}
    return list;
  }
  MO.feed = function (pid, postId) {
    const pr = S().profiles[pid]; if (!pr) return;
    const ps = posts(pr);
    const body = feedList(pid, pr, ps);
    const scr = G.ui.screen({ title: '게시물', sub: pr.handle, cls: 'mo-screen', body });
    G.phone.push(scr);
    if (postId) requestAnimationFrame(() => { const n = body.querySelector(`[data-pid="${postId}"]`); if (n) scr.body.scrollTop = n.offsetTop - 4; });
  };
  MO.post = function (pid, postId) { MO.feed(pid, postId); };
})();
