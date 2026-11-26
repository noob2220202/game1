/* =========================================================
 * ep2/js/data/e1canon.js — episode-1 callback canon (core · DESIGN_EP2 §3.20.1, §9.3 ①, §9.4 · ARCH_EP2 §4.7)
 *
 * G.STORY.e1canon = {
 *   haruLines  — his ep1 words every player received (§4.2 neutral version · §9.4 — ep1 js/data/beats.js firstContact[1],
 *                f2, cutBurst; times = ep1 base.js F1 03:56 · F2 04:04 · M5 04:31). Not new lines (not in the §3.20.3 ledger).
 *   deleted    — the JS3 slot: '삭제된 메시지입니다 · 오전 7:02' (no restore UI, no 🙂)
 *   NEUTRAL    — cb object for a player with no ep1 record (every callback falls back to its neutral variant)
 *   KEYS       — cb keys
 *   cbFrom(e1, s) → cb   pure: e1 = the series' ep(1) object {st, min, …}; s(key) = series s() getter.
 *                Choice-type lines only when e1.st === 'done', 'did-it' lines also when 'started' (bible §7.5).
 * }
 * Readers render only — callbacks never gate progress. Called by core e2.seriesBoot (the only series reader).
 * ========================================================= */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.STORY = G.STORY || {};

  const NEUTRAL = { _v: 1, e1done: false, min: null, knock: null, alarmDel: false, trap: false, vault: false,
    ring: false, manager: false, jimin: false, mom: false, js1: false };
  const KEYS = ['e1done', 'min', 'knock', 'alarmDel', 'trap', 'vault', 'ring', 'manager', 'jimin', 'mom', 'js1'];

  function cbFrom(e1, s) {
    e1 = e1 || {};
    const get = (k) => { try { return typeof s === 'function' ? s(k) : undefined; } catch (e) { return undefined; } };
    const done = e1.st === 'done', started = done || e1.st === 'started';
    return {
      _v: 1,
      e1done:   done,
      min:      done && Number.isFinite(e1.min) ? e1.min : null,
      knock:    done && ['answered', 'four', 'none'].includes(get('e1_knock')) ? get('e1_knock') : null,
      alarmDel: done && get('e1_alarmDel') === true,
      trap:     started && get('e1_trap') === true,
      vault:    started && get('e1_vault') === true,
      ring:     started && get('e1_ring') === true,
      manager:  started && get('e1_manager') === true,
      jimin:    done && get('e1_jimin') === true,
      mom:      done && (get('e1_momRead') === true || get('e1_momTold') === true),
      js1:      done && get('e1_js1') === true,
    };
  }

  G.STORY.e1canon = {
    haruLines: [
      { t: '2026-11-24 03:56', text: '{N야}.' },
      { t: '2026-11-24 04:04', text: '배터리 4%네.' }, { t: '2026-11-24 04:04', text: '얼마 안 남았다 우리.' },
      { t: '2026-11-24 04:31', text: '…{N야}?' }, { t: '2026-11-24 04:31', text: '화면 왜 안 보여' }, { t: '2026-11-24 04:31', text: '뭐 했어' },
      { t: '2026-11-24 04:31', text: '다시 켜' }, { t: '2026-11-24 04:31', text: '{N야}' }, { t: '2026-11-24 04:31', text: '대답해' },
      { t: '2026-11-24 04:31', text: '대답해' }, { t: '2026-11-24 04:31', text: '대답해' },
    ],
    deleted: { t: '2026-11-24 07:02', label: '삭제된 메시지입니다' },
    NEUTRAL,
    KEYS,
    cbFrom,
  };
})();
