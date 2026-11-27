/* App icons — original glyphs (white on gradient), no brand marks.
 * engine/core/icons.js (core · ARCH_EP2 §4.23): ep1 set + G.ICONS.alerts (재난 알림) · G.ICONS.timeline (타임라인).
 * G.ICONS.calendar.svg is a getter that draws the in-game date (G.clock.now()) like a real calendar icon.
 * ep3 (ARCH_EP3 §4.2 icons — NEW keys only, every existing key byte-identical; sms · files · weather are reused as they are):
 *   moim (모임 — a small group) · voicerec (음성 녹음 — microphone) · folder (home folder tile, glass) · showHands (two hands
 *   holding a phone out — the '엄마에게 보여 드리기' glyph, transparent bg) · easyPhone easyTalk easyCamera easyGallery easyMoim
 *   easySettings (bold flat glyphs for the easy-home tiles, §5.1). Engine SVG only — no emoji glyphs (DESIGN_EP3 §5.0-5). */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const W = 'fill="#fff"';
  const S = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  function calSvg() {
    let d = null;
    try { if (G.clock && G.clock.now) d = G.clock.now(); } catch (e) { d = null; }
    if (!d || isNaN(d.getTime())) d = new Date(2026, 11, 24);
    return `<svg viewBox="0 0 24 24"><text x="12" y="7.5" text-anchor="middle" font-size="4.6" fill="#ff3b30" font-weight="700" font-family="sans-serif">${WEEK[d.getDay()]}</text><text x="12" y="19.5" text-anchor="middle" font-size="12.5" fill="#111" font-family="sans-serif">${d.getDate()}</text></svg>`;
  }
  G.ICONS = {
    phone: { bg: 'linear-gradient(160deg,#5be37a,#22b14c)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>` },
    sms: { bg: 'linear-gradient(160deg,#6be585,#2fbf4f)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M12 3.5c5 0 9 3.3 9 7.4s-4 7.4-9 7.4c-.9 0-1.8-.1-2.6-.3L5 20l1-3.6C4.2 15 3 13.1 3 10.9 3 6.8 7 3.5 12 3.5z"/></svg>` },
    /* 톡 — plain teal speech bubble (typing dots) on a white tile · no lettering, no messenger-brand colours */
    talk: { bg: 'linear-gradient(160deg,#ffffff,#e9f1ef)', svg: `<svg viewBox="0 0 24 24"><rect x="3.2" y="4.4" width="17.6" height="12.4" rx="5.2" fill="#14a394"/><path d="M7 15.4l-.95 4.5c-.1.5.45.85.85.55l4.9-4.1z" fill="#14a394"/><circle cx="8.3" cy="10.6" r="1.3" fill="#fff"/><circle cx="12" cy="10.6" r="1.3" fill="#fff"/><circle cx="15.7" cy="10.6" r="1.3" fill="#fff"/></svg>` },
    /* 갤러리 — generic photo frame with a mountain and a sun (white on amber) */
    gallery: { bg: 'linear-gradient(160deg,#ffcb57,#f29111)', svg: `<svg viewBox="0 0 24 24"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="15.9" cy="9.2" r="1.9" ${W}/><path ${W} d="M4.6 17.4l4.6-5.6c.4-.5 1.1-.5 1.5 0l2.9 3.5 1.6-1.8c.4-.45 1.1-.45 1.5 0l2.7 3.2v.6c0 .35-.3.6-.6.6H5.2c-.35 0-.6-.25-.6-.5z"/></svg>` },
    camera: { bg: 'linear-gradient(160deg,#d9d9de,#8e8e93)', svg: `<svg viewBox="0 0 24 24"><path fill="#333" d="M4 7.5h3.2L8.8 5h6.4l1.6 2.5H20a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0120 19.5H4A1.5 1.5 0 012.5 18V9A1.5 1.5 0 014 7.5z"/><circle cx="12" cy="13" r="4.2" fill="#111" stroke="#ccc" stroke-width="1.2"/><circle cx="12" cy="13" r="1.6" fill="#3a5bd0"/></svg>` },
    memo: { bg: 'linear-gradient(160deg,#fff 0 30%,#fff7d1 30%)', svg: `<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="4" rx="1" fill="#f4c430"/><path stroke="#c9c9c9" stroke-width="1.2" d="M5 11h14M5 14.5h14M5 18h10"/></svg>` },
    browser: { bg: 'linear-gradient(160deg,#5ac8fa,#007aff)', svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" ${S}/><path ${S} stroke-width="1.4" d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.3 3.6 8.5s-1 6.1-3.6 8.5M12 3.5C9.4 5.9 8.4 8.8 8.4 12s1 6.1 3.6 8.5"/></svg>` },
    mail: { bg: 'linear-gradient(160deg,#5ac8fa,#1e88e5)', svg: `<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2" ${W}/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="#1e88e5" stroke-width="1.6"/></svg>` },
    calendar: { bg: '#fff', get svg() { return calSvg(); } },
    clock: { bg: '#111', svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fff"/><path d="M12 12V6.5M12 12l3.2 2.6" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><path d="M12 12L8.4 15.4" stroke="#ff9500" stroke-width="1" stroke-linecap="round"/><circle cx="12" cy="12" r="1" fill="#ff9500"/></svg>` },
    settings: { bg: 'linear-gradient(160deg,#a8a8ad,#6d6d72)', svg: `<svg viewBox="0 0 24 24"><path fill="#ececec" d="M12 2.8l1.5 2.2 2.6-.6.6 2.6 2.4 1.2-.9 2.5 1.6 2.1-2 1.8.3 2.6-2.6.5-1 2.5-2.4-1-2.2 1.5-1.5-2.2-2.6.6-.6-2.6L2.8 15l.9-2.5L2.1 10.4l2-1.8-.3-2.6 2.6-.5 1-2.5 2.4 1z"/><circle cx="12" cy="12" r="3.4" fill="#7a7a80"/></svg>` },
    recorder: { bg: 'linear-gradient(160deg,#ff5f57,#d70015)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M3 12h1.5M6 8v8M9 5v14M12 9v6M15 6.5v11M18 9.5v5M21 12h-1.5" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>` },
    /* 모먼트 — original stacked-frames mark with a spark (white on violet → indigo) */
    moment: { bg: 'linear-gradient(160deg,#9c7dff,#5338d6)', svg: `<svg viewBox="0 0 24 24"><rect x="3.4" y="6.4" width="11.6" height="11.6" rx="3.2" transform="rotate(-12 9.2 12.2)" fill="none" stroke="#fff" stroke-width="1.7" opacity=".62"/><rect x="8.6" y="5.4" width="12" height="12" rx="3.4" ${W}/><path fill="#5a3fdc" d="M14.6 7.6l.95 2.7 2.7.95-2.7.95-.95 2.7-.95-2.7-2.7-.95 2.7-.95z"/></svg>` },
    home: { bg: 'linear-gradient(160deg,#2c3e50,#0f1b26)', svg: `<svg viewBox="0 0 24 24"><path d="M3.5 11.2L12 4l8.5 7.2" fill="none" stroke="#4fd1c5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9.5h12V10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><rect x="10" y="13" width="4" height="6.5" rx=".8" fill="#4fd1c5"/></svg>` },
    files: { bg: 'linear-gradient(160deg,#ffcc4d,#ff9f0a)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M3.5 7a2 2 0 012-2h4.2l2 2h6.8a2 2 0 012 2v8.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/></svg>` },
    weather: { bg: 'linear-gradient(160deg,#4a5d78,#1f2a3a)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M7.5 17.5a4 4 0 01-.4-8 5.5 5.5 0 0110.6 1.3A3.4 3.4 0 0117 17.5z"/><path stroke="#9cc6ff" stroke-width="1.6" stroke-linecap="round" d="M9 20l-.8 1.6M13 20l-.8 1.6M17 20l-.8 1.6"/></svg>` },
    flashlight: { bg: 'linear-gradient(160deg,#3a3a3c,#1c1c1e)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M8 3h8v3l-2 4v10.5a1.5 1.5 0 01-1.5 1.5h-1A1.5 1.5 0 0110 20.5V10L8 6z"/><circle cx="12" cy="13.5" r="1.2" fill="#1c1c1e"/></svg>` },
    /* ep2 — 재난 알림 (emergency alerts): warning triangle with broadcast waves */
    alerts: { bg: 'linear-gradient(160deg,#ff8a3d,#e5391f)', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M12 4.2c.5 0 .9.3 1.2.7l6.6 11.6c.5.9-.1 2-1.2 2H5.4c-1.1 0-1.7-1.1-1.2-2l6.6-11.6c.3-.4.7-.7 1.2-.7z"/><rect x="11.05" y="8.6" width="1.9" height="5.4" rx=".95" fill="#e5391f"/><circle cx="12" cy="15.9" r="1.1" fill="#e5391f"/><path d="M4.2 7.4a6 6 0 012.1-3M19.8 7.4a6 6 0 00-2.1-3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".85"/></svg>` },
    /* ep2 — 타임라인 (location timeline): dotted path ending in a pin */
    timeline: { bg: 'linear-gradient(160deg,#4fc3a1,#1b8a74)', svg: `<svg viewBox="0 0 24 24"><path d="M4.5 19.5c2.2-.4 3.2-2 4.6-3.6 1.3-1.5 2.8-2.3 4.6-2.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.2 2.4"/><circle cx="4.5" cy="19.5" r="1.4" fill="#fff"/><path ${W} d="M16.4 3.6a4.3 4.3 0 014.3 4.3c0 3.1-4.3 7.2-4.3 7.2s-4.3-4.1-4.3-7.2a4.3 4.3 0 014.3-4.3z"/><circle cx="16.4" cy="7.9" r="1.6" fill="#1b8a74"/></svg>` },
  };

  /* ---------------- ep3 — new keys only (ARCH_EP3 §4.2) ---------------- */
  const GROUP = `<circle cx="12" cy="8" r="2.9" ${W}/><path ${W} d="M6.9 17.6c0-3 2.3-5.2 5.1-5.2s5.1 2.2 5.1 5.2v.6H6.9z"/>`
    + `<circle cx="5.9" cy="10" r="2.1" fill="#fff" opacity=".78"/><path fill="#fff" opacity=".78" d="M2.4 17.6c0-2.3 1.6-4 3.6-4 .9 0 1.7.3 2.3.9-1 1-1.6 2.3-1.7 3.7v.3H2.4z"/>`
    + `<circle cx="18.1" cy="10" r="2.1" fill="#fff" opacity=".78"/><path fill="#fff" opacity=".78" d="M21.6 17.6c0-2.3-1.6-4-3.6-4-.9 0-1.7.3-2.3.9 1 1 1.6 2.3 1.7 3.7v.3h4.2z"/>`;
  const MIC = `<rect x="9.2" y="3.2" width="5.6" height="10.6" rx="2.8" ${W}/><path d="M6.6 11.2a5.4 5.4 0 0010.8 0M12 16.6v3M9 20.1h6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  const add = {
    moim: { bg: 'linear-gradient(160deg,#d3a86c,#94672f)', svg: `<svg viewBox="0 0 24 24">${GROUP}</svg>` },
    voicerec: { bg: 'linear-gradient(160deg,#ff9466,#e4533a)', svg: `<svg viewBox="0 0 24 24">${MIC}</svg>` },
    /* home folder tile: frosted glass + a 3 × 2 grid of small tiles (the shell may draw the folder's own app icons on top) */
    folder: { bg: 'rgba(255,255,255,.24)', svg: `<svg viewBox="0 0 24 24"><g fill="#fff" opacity=".9"><rect x="4.2" y="6" width="4.2" height="4.2" rx="1.2"/><rect x="9.9" y="6" width="4.2" height="4.2" rx="1.2"/><rect x="15.6" y="6" width="4.2" height="4.2" rx="1.2"/><rect x="4.2" y="12.2" width="4.2" height="4.2" rx="1.2"/><rect x="9.9" y="12.2" width="4.2" height="4.2" rx="1.2"/><rect x="15.6" y="12.2" width="4.2" height="4.2" rx="1.2"/></g></svg>` },
    /* '엄마에게 보여 드리기' — two open hands holding a phone out (stroke glyph, inherits currentColor; transparent bg) */
    // a phone turned toward a person (lead fix: the earlier 'phone in two hands' drawing read as a microphone on the
    // mobile icon-only tab — no mic may even seem to be asked for in this series)
    showHands: { bg: 'transparent', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.4" y="4" width="8" height="15" rx="1.7" transform="rotate(-8 6.4 11.5)"/><path d="M5.6 6.4h1.9" transform="rotate(-8 6.4 11.5)"/><path d="M11.9 11.3h3.1M13.7 9.7l1.6 1.6-1.6 1.6"/><circle cx="19.2" cy="8.6" r="2.2"/><path d="M16 18.2c.3-2.7 1.6-4.3 3.2-4.3s2.9 1.6 3.2 4.3"/></svg>` },
    /* easy-home tiles (§5.1 — 2 × 3 big tiles, 96 px glyph): flat solid colours, heavier shapes */
    easyPhone: { bg: '#2fae4e', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M6.4 10.6a15.2 15.2 0 007 7l2.4-2.4c.3-.3.8-.4 1.1-.2 1.2.4 2.4.6 3.7.6.6 0 1.1.5 1.1 1.1v3.7c0 .6-.5 1.1-1.1 1.1A18.3 18.3 0 012.3 3.9c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1 0 1.3.2 2.5.6 3.7.1.4 0 .8-.3 1.1z"/></svg>` },
    easyTalk: { bg: '#f2c94c', svg: `<svg viewBox="0 0 24 24"><path fill="#3a2a12" d="M12 3.4c5.2 0 9.4 3.3 9.4 7.5s-4.2 7.5-9.4 7.5c-.9 0-1.8-.1-2.6-.3l-4.6 2.6 1.1-3.9C4 15.4 2.6 13.3 2.6 10.9c0-4.2 4.2-7.5 9.4-7.5z"/><circle cx="8.2" cy="10.9" r="1.35" fill="#f2c94c"/><circle cx="12" cy="10.9" r="1.35" fill="#f2c94c"/><circle cx="15.8" cy="10.9" r="1.35" fill="#f2c94c"/></svg>` },
    easyCamera: { bg: '#5a6170', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M3.8 7.3h3.4L8.9 4.6h6.2l1.7 2.7h3.4c.9 0 1.6.7 1.6 1.6v9.4c0 .9-.7 1.6-1.6 1.6H3.8c-.9 0-1.6-.7-1.6-1.6V8.9c0-.9.7-1.6 1.6-1.6z"/><circle cx="12" cy="13.4" r="4.1" fill="#5a6170"/><circle cx="12" cy="13.4" r="2.3" fill="#fff"/></svg>` },
    easyGallery: { bg: '#f08a24', svg: `<svg viewBox="0 0 24 24"><rect x="2.8" y="4.4" width="18.4" height="15.2" rx="2.6" ${W}/><circle cx="16" cy="9.2" r="1.9" fill="#f08a24"/><path fill="#f08a24" d="M4.6 17.8l4.7-5.7c.4-.5 1.2-.5 1.6 0l3 3.6 1.6-1.8c.4-.5 1.2-.5 1.6 0l2.3 2.8v1.1z"/></svg>` },
    easyMoim: { bg: '#a8743a', svg: `<svg viewBox="0 0 24 24">${GROUP}</svg>` },
    easySettings: { bg: '#6b6f78', svg: `<svg viewBox="0 0 24 24"><path ${W} d="M12 2.4l1.6 2.3 2.7-.6.6 2.7 2.5 1.2-.9 2.6 1.7 2.2-2.1 1.9.3 2.7-2.7.5-1.1 2.6-2.5-1.1-2.3 1.6-1.6-2.3-2.7.6-.6-2.7L2.4 15l.9-2.6-1.7-2.2 2.1-1.9-.3-2.7 2.7-.5 1.1-2.6 2.5 1.1z"/><circle cx="12" cy="12" r="3.6" fill="#6b6f78"/></svg>` },
  };
  Object.keys(add).forEach((k) => { if (!Object.prototype.hasOwnProperty.call(G.ICONS, k)) G.ICONS[k] = add[k]; });
})();
