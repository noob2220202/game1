/* =========================================================
 * 모먼트 (SNS): profile, grid, post view with comments, other profiles.
 * G.STORY.moment = { me:profileId, profiles:{id:{name, handle, avatar, bio, followers, following, private, posts:[post]}} }
 * post: {id, img, caption, t, likes, comments:[{name, text, creepy, t}], show(), onOpen, live}
 * ========================================================= */
(function () {
  'use strict';
  const G = window.G;
  const { el } = G.util;
  const MO = (G.moment = {});
  function S() { return G.STORY.moment || { profiles: {} }; }
  function posts(pr) { return (pr.posts || []).filter((p) => !p.show || p.show()).sort((a, b) => +G.chat.parseT(b.t) - +G.chat.parseT(a.t)); }

  G.app('moment', {
    name: '모먼트',
    icon: G.ICONS.moment,
    open(p) { MO.profile((p && p.profile) || S().me); if (p && p.post) MO.post((p && p.profile) || S().me, p.post); },
  });

  MO.profile = function (id) {
    const pr = S().profiles[id];
    if (!pr) return;
    const ps = posts(pr);
    const body = el('div', null,
      el('div.sns-prof', null, el('div.sns-av', { style: { backgroundImage: pr.avatar ? `url("${pr.avatar}")` : 'none' } }),
        el('div.sns-stats', null, el('div', null, el('b', null, String(ps.length)), '게시물'), el('div', null, el('b', null, String(pr.followers || 0)), '팔로워'), el('div', null, el('b', null, String(pr.following || 0)), '팔로잉'))),
      el('div.sns-bio', null, el('b', null, G.T(pr.name)), '\n' + G.T(pr.bio || '')),
      pr.private && id !== S().me ? el('div.empty-state', null, '🔒 비공개 계정입니다') :
        el('div.sns-grid', null, ps.map((post) => {
          const b = el('button', { style: { backgroundImage: `url("${post.thumb || post.img}")` }, 'aria-label': '게시물' });
          b.addEventListener('click', () => { G.audio.sfx.tap(); MO.post(id, post.id); });
          return b;
        })));
    G.phone.push(G.ui.screen({ title: pr.handle || pr.name, body }));
    G.bus.emit('moment:profile', id);
  };

  MO.post = function (pid, postId) {
    const pr = S().profiles[pid]; if (!pr) return;
    const post = (pr.posts || []).find((p) => p.id === postId); if (!post) return;
    const d = G.chat.parseT(post.t);
    const cm = (post.comments || []).filter((c) => !c.show || c.show());
    const img = el('img', { src: post.img, alt: '' });
    img.addEventListener('click', () => G.gallery.viewSingle(post.img, { photoId: post.photoId, t: post.t }));
    const body = el('div.sns-post', null,
      el('div.sp-head', null, el('i', { style: { backgroundImage: pr.avatar ? `url("${pr.avatar}")` : 'none' } }), el('span', null, pr.handle || pr.name)),
      img,
      el('div.sp-acts', null, el('span', null, '♡'), el('span', null, '💬'), el('span', null, '↗')),
      el('div.sp-likes', null, `좋아요 ${post.likes || 0}개`),
      el('div.sp-cap', null, el('b', null, pr.handle || pr.name), G.T(post.caption || '')),
      cm.map((c) => {
        const n = el('div.sp-cmt' + (c.creepy ? '.creepy' : ''), null, el('b', null, G.T(c.name)), G.T(c.text));
        if (c.profile) { n.style.cursor = 'pointer'; n.addEventListener('click', () => MO.profile(c.profile)); }
        return n;
      }),
      el('div.sp-date', null, d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : ''));
    G.phone.push(G.ui.screen({ title: '게시물', body }));
    G.state.seen['post:' + post.id] = true; G.save();
    G.bus.emit('moment:post', post.id);
    post.onOpen && post.onOpen();
  };
})();
