# 하루를 위한 방탈출! 2 「돌려줄게」 — Implementation contract (ARCH_EP2)

> Source of truth for **what** to build: `docs/DESIGN_EP2.md` **v1.3** (client decisions 2026-11-26, §0.2 "✔ 클라이언트 결정" ①–⑧, §12.6, §12.7).
> Source of truth for **how the code is split and wired**: this file. 7 build agents (core · audio · shell · social · media · room · flow)
> code against it **in parallel without talking to each other**, plus the asset agent (already running).
> Episode-1 contract style: `docs/ARCH.md`. Series rules: `docs/SERIES.md` (bible v1.2 — §7 save protocol).
>
> Reading rule: `§x.y` alone = DESIGN_EP2 section. `ARCH §n` = a section of this file. `bible §x` = SERIES.md.
> Contract rev 2 (review pass 2026-11-26): layer stack ARCH §2.3, back-handler stack / modal APIs, settings `general` key, notification
> ids, B20/B23 sequences, asset key list ARCH §5.1, resume splits, selector speedrun ARCH §6.4, resolutions G31–G50. Engine names marked
> "ep1" were checked against `engine/` (commit 53a37ad).
> When DESIGN and this file disagree on **APIs, ownership, file names, event names** → this file wins.
> When they disagree on **player-facing text, numbers, timing, puzzle logic** → DESIGN v1.3 wins, except the
> explicit resolutions in ARCH §9 (Gaps & contradictions). Do not invent player-facing Korean strings: every string you render
> must be quoted from DESIGN (⊕ lines included) or from ARCH §4.5 `G.e2.STR` (system-string whitelist, copied from §10 A).

---

## ARCH §1 — CLIENT OVERRIDE (supersedes DESIGN, this file, and any task brief)

> ## ⛔ OVERRIDE FROM THE CLIENT
> **No camera, no microphone, no sensors, no permission prompts. Only pure in-app tricks.**
> - Never call: `getUserMedia`, `DeviceMotionEvent`, `DeviceOrientationEvent`, `navigator.geolocation`, `navigator.bluetooth`,
>   `navigator.clipboard`, `Notification.requestPermission`, `navigator.permissions`, `requestFullscreen`, Web NFC, Media Session.
>   Bluetooth, Wi-Fi, fingerprint, location timeline, disaster alerts, near-share, user switching are **all in-game fake phone UI**.
>   The "screen fingerprint" is a 0.8 s press on an in-game icon (`G.ui.holdButton`). `navigator.vibrate` (output) is allowed,
>   and every vibration carries the same information on screen and/or in sound. `navigator.wakeLock.request('screen')` is allowed
>   (no prompt; silently ignore rejection). No `<audio>`/`<video>` elements for story media (WebAudio + image frames only, §9.7).
> - **HARD MODE — no unsolicited hints.** `G.notebook.note/lead/flash/autoHint` and `G.sd.note/lead` are **no-ops** in ep2
>   (DEBUG prints a warning). No tutorial subtitles, no "~해 보자" toasts, no hint inside an error message, no ghost hand,
>   no lead list, no "새 단서" dot, no idle nudge, no look-away log, no tab-title/favicon tricks, no system popup that a real
>   phone would not show (only `G.e2.STR` strings + DESIGN screen text). The **only** hint channel is the notebook's
>   hold-to-reveal 3-tier hint (2 s hold, T2 = T1 + 60 s, T3 = T2 + 60 s, T3 states the answer). Failure = time only;
>   no game over; no soft-lock (§2.3 proofs are acceptance tests).
> - **Ep1 tricks are not reused** (EP2_BRIEF list + bible §8.1/§8.5 + DESIGN §5.6 "끈다" column): no polaroid glare, no 한/영
>   password, no live memo erase/undo, no door-tone matching, no mono-audio cancellation, no wellbeing/storage → vault, no
>   exposure slider, no acrostic, no notification-history recovery, no calling own number, no LIVE photo, no screen-share cut,
>   no MFA bombing, no hold-to-hide, no look-away, no game-URL history, no real-time message, no 3-fragment door code,
>   no knock (sound, subtitle or line), no wardrobe, no SMS app, no calculator, no 해솔홈 app, no 0.75× / spectrum / text view,
>   no "다른 기기가 관리하는 알람" reason text. Ep1 engine *features* may be reused; ep1 *tricks* may not.
> - **He never watches this screen tonight.** Zero code paths where he reacts to the player's UI actions (settings, unhide,
>   Bluetooth connect, reloads). He reacts only to (a) sound actually playing on `2층_스피커`, (b) messages arriving in his
>   account (fake {MAKER} reply → `읽음` + 0.5 s GSM, nothing else).
> - Gender of {N} is never fixed: no pronouns/titles/clothes. Text uses tokens only (below). {MAKER} is an ordinary friend;
>   no invented private facts. No real brands/numbers except 112 · 119 · 1366.

### 1.1 Token rules (`G.T`) — implemented by **core** in `engine/core/base.js`
`G.T(str)` is the single text-expansion function. Every owner passes every player-facing string through `G.T` at **render time**
(never at load time — CONFIG may be edited, tests swap names). Tokens:

| token | expands to | notes |
|---|---|---|
| `{N}` | `CONFIG.PLAYER_NAME` (default `하루`) | |
| `{N야}` `{N아}` | name + `아`/`야` by 받침 | vocative |
| `{N가}` `{N는}` `{N를}` `{N랑}` `{N이}` `{N의}` | name + 조사 by 받침 | same algorithm as ep1 `js/main.js` |
| `{MAKER_CONTACT}` | `CONFIG.MAKER_CONTACT` → else `CONFIG.MAKER_NAME` → if that is `'너의 친구'` or empty → `친구` | §0 rule. Only 조사-invariant suffixes after it (`님` · `의` · `에게`) |
| `{MAKER}` | `CONFIG.MAKER_NAME` | credits / letter only |
| `{MAKER_ID}` | `CONFIG.MAKER_HANDLE` | renderers must **omit the whole handle line** when `G.e2.makerHandle()` is `''` (§0.2 T13) |
| `{eunpyeong}` `{mapo}` `{eunpyeongOrg}` `{mapoOrg}` `{eunpyeongOffice}` `{mapoOffice}` `{police}` `{policeShort}` `{court}` | `G.STORY.names[key]` | §9.6 / client decision ①. Data files **must** write these tokens instead of literal `서강경찰서`, `[마포구청]`, `은평구청` … (QA greps literals) — required places (§9.6, §10 G): every police/court string; cbs `org`/body, alerts header/list/detail, jimin DM 12.15 `{mapoOrg}`. Exempt hand-written geography (literal is correct, §10 G 면제): Kang 11-24 mail `…마포구입니다.`, article B `서울 마포구 해솔동…`, ep1 article A, hint sentences. The audio file `v2_kang_door.wav` is the only literal `서강경찰서` |
| `{$key}` | `G.e2.STR[key]` (ARCH §4.5 whitelist), expanded **first**, then the other tokens | lets data files reference system strings (e.g. `'{$mailSync}'`). `{q}` inside `STR.noResult*` is replaced by the caller |

Expansion order inside `G.T`: `{$key}` → name tokens → `{MAKER_CONTACT}`/`{MAKER}`/`{MAKER_ID}` → `{N…}` tokens. Unknown `{…}` are left as is
(DEBUG warns).

`G.STORY.names` (core, `ep2/js/config.ep2.js`) — copy exactly (§9.6 v1.3):
```js
G.STORY = G.STORY || {};
G.STORY.names = {
  eunpyeong: '은평구', mapo: '마포구',
  eunpyeongOrg: '은평구청', mapoOrg: '마포구청',
  eunpyeongOffice: '[은평구청]', mapoOffice: '[마포구청]',
  police: '서강경찰서', policeShort: '서강서',
  court: '서울서강지법',
};
```
`G.NAME` = resolved player name. `G.T` returns non-strings unchanged. ep2's `js/main.js` must **not** redefine `G.T`.

---

## ARCH §2 — Directory tree, load order, CSS order

```
/                                  ep1 (unchanged except: js/config.js keys, P-1, P-2)
├─ js/config.js                    core ADDS 4 keys only (ARCH §4.2)
├─ js/data/recordings.js           core P-1 (one value)
├─ index.html · js/scenes.js       core P-2 (one <script> line · one statement line)
├─ engine/                         shared engine v2 (ep1 fork; only ep2 loads engine/core|apps|room|css)
│  ├─ series.js                    core — standalone, also loaded by ep1 index.html (P-2)
│  ├─ core/  base.js(core) audio.js(audio) spatial.js(audio) fx.js(core) icons.js(core) phone.js(shell)
│  │         widgets.js(core) keyboard.js(core) media.js(core, NEW)
│  ├─ apps/  lock.js(shell) settings.js(shell) talk.js(social) moment.js(social) mail.js(social)
│  │         gallery.js recorder.js clock.js browser.js memo.js calendar.js phone.js (media) camera.js(room)
│  ├─ room/  room.js(room)
│  ├─ notebook.js(flow) director.js(flow)
│  └─ css/   main.css(shell) apps.css(social) room.css(room) notebook.css(flow)
├─ ep2/
│  ├─ index.html (flow)  manifest.webmanifest (flow)
│  ├─ css/   core.css(core, ADDED) shell.css(shell) media.css(media) ep2.css(flow)
│  ├─ js/
│  │  ├─ config.ep2.js flags.js e2.js (core)
│  │  ├─ scenes.js ending.js hook.js main.js (flow) · climax.js (room)
│  │  ├─ apps/  security.js(shell) alerts.js(media)
│  │  ├─ data/  assets.js(assets) e1canon.js(core) tones.js subs.js(audio; subs.js ADDED)
│  │  │         users.js security.js kbd.js settings.js (shell) · talk.js moment.js mail.js (social)
│  │  │         days.js cbs.js gallery.js recordings.js clock.js browser.js memos.js calendar.js phone.js(media; phone.js ADDED)
│  │  │         objectives.js beats.js (flow) · ending.js (flow, ADDED, optional)
│  │  └─ room/  roomdata.js (room)
│  └─ assets/ img/ audio/  (asset agent)
├─ deploy/Caddyfile · deploy/README.md   (core)
└─ tools/*_ep2*  (asset agent)
```

### 2.1 `ep2/index.html` — exact `<script>` order (flow writes it; every owner relies on it)
Data files run **no cross-owner code at load time** (only define objects / lazy functions). Apps register with `G.app` at load.
```html
<script src="../js/config.js"></script>
<script src="js/config.ep2.js"></script>
<script src="../engine/series.js"></script>
<script src="../engine/core/base.js"></script>
<script src="../engine/core/audio.js"></script>
<script src="../engine/core/spatial.js"></script>
<script src="../engine/core/fx.js"></script>
<script src="../engine/core/icons.js"></script>
<script src="../engine/core/phone.js"></script>
<script src="../engine/core/widgets.js"></script>
<script src="../engine/core/keyboard.js"></script>
<script src="../engine/core/media.js"></script>
<script src="js/flags.js"></script>
<script src="js/e2.js"></script>
<script src="js/data/assets.js"></script>
<script src="js/data/e1canon.js"></script>
<script src="js/data/tones.js"></script>
<script src="js/data/subs.js"></script>
<script src="js/data/users.js"></script>
<script src="js/data/security.js"></script>
<script src="js/data/kbd.js"></script>
<script src="js/data/settings.js"></script>
<script src="js/data/talk.js"></script>
<script src="js/data/moment.js"></script>
<script src="js/data/mail.js"></script>
<script src="js/data/days.js"></script>
<script src="js/data/cbs.js"></script>
<script src="js/data/gallery.js"></script>
<script src="js/data/recordings.js"></script>
<script src="js/data/clock.js"></script>
<script src="js/data/browser.js"></script>
<script src="js/data/memos.js"></script>
<script src="js/data/calendar.js"></script>
<script src="js/data/phone.js"></script>
<script src="js/data/objectives.js"></script>
<script src="js/data/beats.js"></script>
<script src="js/data/ending.js"></script>          <!-- optional (flow); missing file must not break boot -->
<script src="js/room/roomdata.js"></script>
<script src="../engine/room/room.js"></script>
<script src="../engine/apps/lock.js"></script>
<script src="../engine/apps/phone.js"></script>
<script src="../engine/apps/talk.js"></script>
<script src="../engine/apps/moment.js"></script>
<script src="../engine/apps/mail.js"></script>
<script src="../engine/apps/gallery.js"></script>
<script src="../engine/apps/camera.js"></script>
<script src="../engine/apps/memo.js"></script>
<script src="../engine/apps/recorder.js"></script>
<script src="../engine/apps/clock.js"></script>
<script src="../engine/apps/calendar.js"></script>
<script src="../engine/apps/browser.js"></script>
<script src="../engine/apps/settings.js"></script>
<script src="js/apps/security.js"></script>
<script src="js/apps/alerts.js"></script>
<script src="../engine/notebook.js"></script>
<script src="../engine/director.js"></script>
<script src="js/scenes.js"></script>
<script src="js/climax.js"></script>
<script src="js/ending.js"></script>
<script src="js/hook.js"></script>
<script src="js/main.js"></script>
```
(Missing `<script>` files 404 harmlessly; every file must tolerate any later file being absent — ARCH §7.)

### 2.2 `<head>` and CSS order (flow writes; owners keep their CSS in their own file)
`<title>하루를 위한 방탈출! 2</title>` (fixed — §0.2 T14), `meta description`/`og:*` fixed `하루를 위한 방탈출! 2` · `돌려줄게`,
`og:image` `https://haru.pengueverything.cloud/ep2/assets/img/og_ep2.jpg`, icon `assets/img/icon_ep2.png`, `manifest.webmanifest`
(scope/start_url `/ep2/`), viewport/apple meta copied from ep1 `index.html`. Fonts: identical CDN links/versions to ep1
(Pretendard 1.3.9 jsDelivr; Google Fonts Gowun Batang · Nanum Pen Script · Gaegu). Then:
```
../engine/css/main.css → ../engine/css/apps.css → ../engine/css/room.css → ../engine/css/notebook.css
→ css/core.css → css/shell.css → css/media.css → css/ep2.css
```
Body skeleton = ep1 (`#stage > #phone > #screen + #fx-layer`, `.desk-hint` with ep1's existing text).
New CSS class prefixes per owner (avoid collisions): core `c2-` · shell `sh2-` · social `so2-` · media `md2-` · room `rm2-` · flow `fl2-`
(ep1 classes already in engine CSS keep their names). `media` must not edit `apps.css` (social-owned) — override in `media.css`
(loaded later). `#screen.eye-mode` (set by room) hides `#statusbar` and `.home-bar` (rule lives in shell `main.css`).

### 2.3 Layer stack inside `#screen` (z-index — every owner uses exactly these values; ep1 values kept where they exist)
| z | layer (class/id) | owner | notes |
|---|---|---|---|
| 0 / 5 | `.wallpaper` / `#home` | shell | |
| 10 | `#app-stack` — every app screen, incl. the room **camera mode** (`camera` app) | shell (+ apps push into it) | |
| 30 | `#lock` (all three lock screens) | shell | |
| 45 | `.rm2-eye` — room **eye mode** (M0 cold open, M7 forced window, M8 door) | room | above lock and apps |
| 46 | `.md2-ring` — alarm ring screen `23:10 · 문 앞` (shown on top of the M0 eye view) | media | |
| 50 | `#overlays` — dialogs, `G.phone.sheet`, verify sheet, QS panel, volume panel, near-share, toasts | shell | `G.room.forceView` calls `G.phone.dismissModals()` first (ARCH §4.9) |
| 55 | `.sh2-switch` — user-switch shell (2 s) | shell | above eye mode (M8 `forceN`) |
| 60 | `.nb-fab` (✎) | flow | always reachable |
| 70 / 75 | `#banners` / `#statusbar` | shell | |
| 90 | `.home-bar` | shell | |
| 150 | `.fl2-card` — ending cards 01:10–02:30, hook overlay | flow | flow **hides its card layer** before calling `G.users.lockDash`, `G.phone.nearShare`, `G.gallery.receive` and shows it again when they resolve |
| 200 | `.fl2-scene` — title, warning, earphone test, recap, pause menu, credits, check card | flow | |
| 300 | `#fx-layer` — sound subtitles, mono line, `dirArc`, vignette | core | above flow scenes (the recap card is drawn by `G.fx.mono`) |
| 400 | `.notebook` | flow | |
| 450 | `.kb` (in-game keyboard + predict bar) | core | above the notebook (notebook memo uses it) |
| 460 | `.c2-black` (`G.fx.black`) | core | |
| 500 | resume chip `🔈 소리 다시 켜기` | audio | |
| 900 | DEBUG overlay / budget meter | core | |

---
## ARCH §3 — Ownership

### 3.1 Fixed file ownership (verbatim) + files this contract ADDS
| Owner | Files |
|---|---|
| **core** | `engine/core/base.js`, `engine/core/fx.js`, `engine/core/icons.js`, `engine/core/keyboard.js`, `engine/core/widgets.js`, `engine/core/media.js` (new), `engine/series.js` (new), `ep2/js/config.ep2.js`, `ep2/js/flags.js`, `ep2/js/e2.js`, `ep2/js/data/e1canon.js`, `js/config.js` (ADD keys only), ep1 root patches P-1 (`js/data/recordings.js` one value) and P-2 (`index.html` one `<script>` line, `js/scenes.js` one line), `deploy/Caddyfile`, `deploy/README.md` · **ADDED:** `ep2/css/core.css` |
| **audio** | `engine/core/audio.js`, `engine/core/spatial.js`, `ep2/js/data/tones.js` · **ADDED:** `ep2/js/data/subs.js` |
| **shell** | `engine/core/phone.js`, `engine/apps/lock.js`, `engine/apps/settings.js`, `engine/css/main.css`, `ep2/js/apps/security.js`, `ep2/js/data/security.js`, `ep2/js/data/users.js`, `ep2/js/data/kbd.js`, `ep2/js/data/settings.js`, `ep2/css/shell.css` |
| **social** | `engine/apps/moment.js`, `engine/apps/talk.js`, `engine/apps/mail.js`, `engine/css/apps.css`, `ep2/js/data/moment.js`, `ep2/js/data/talk.js`, `ep2/js/data/mail.js` |
| **media** | `engine/apps/gallery.js`, `engine/apps/recorder.js`, `engine/apps/clock.js`, `engine/apps/browser.js`, `engine/apps/memo.js`, `engine/apps/calendar.js`, `engine/apps/phone.js`, `ep2/js/apps/alerts.js`, `ep2/js/data/gallery.js`, `ep2/js/data/recordings.js`, `ep2/js/data/clock.js`, `ep2/js/data/browser.js`, `ep2/js/data/memos.js`, `ep2/js/data/calendar.js`, `ep2/js/data/days.js`, `ep2/js/data/cbs.js`, `ep2/css/media.css` · **ADDED:** `ep2/js/data/phone.js` |
| **room** | `engine/room/room.js`, `engine/css/room.css`, `engine/apps/camera.js`, `ep2/js/room/roomdata.js`, `ep2/js/climax.js` |
| **flow** | `engine/director.js`, `engine/notebook.js`, `engine/css/notebook.css`, `ep2/js/data/beats.js`, `ep2/js/data/objectives.js`, `ep2/js/scenes.js`, `ep2/js/ending.js`, `ep2/js/hook.js`, `ep2/js/main.js`, `ep2/index.html`, `ep2/manifest.webmanifest`, `ep2/css/ep2.css` · **ADDED (optional):** `ep2/js/data/ending.js` |
| **assets** (running; do not reassign) | `tools/*_ep2*`, `ep2/assets/**`, `ep2/js/data/assets.js` (`G.IMG`, `G.IMGMETA`, `G.AUDIO_FILES`, final keys of §8.3) |

`engine/` currently = verbatim ep1 copies (commit 53a37ad). Each owner **rewrites its engine files for ep2** (ep1 keeps its own
`js/`; ep1 must not regress — only `engine/series.js` is shared with ep1). Delete ep1-only logic from your engine files
(fragments, mirroring, watcher lines, knock, wardrobe, vault, MFA …) or gate it off; nothing in ep2 may call it.

### 3.2 Owner scopes (every DESIGN item has exactly one owner)

**core** — the platform every other file stands on. Implements: `G.T`/tokens/`G.STORY.names` (§0, §4 읽는 법, §9.6 names, client
decision ①); `G.state` save format `haru-escape.ep2.save.v1` incl. `ep`/`stage`/`cb`, debounced + interval + `pagehide` saving,
memory mode (§9.2); `G.flag`/`G.vars`/`G.pm` + events; the milestone **clock** from `G.EP.CLOCK` (rates, caps, 57→58→59 loop,
forward-only `jump`, M7 beat mode, card mode, fixed 03:33, date rollover to 12-25) and **battery** table (§2.1, §9.1);
`flags.js` (§2.5, §9.2 list + additions in ARCH §4.4); `e2.js`: fact count, `factDash` (3 of 6), milestone evaluation **M2, M4, M5**
(incl. mono2→M4 sequencing, M5 '—' hold ≤ 90 s, M5 pre-buzz) and the **M6-due** signal + pure formulas for M6/siren (§2.1, §0.2
D1/D14/T6, §5.7 ③), the persistent playMs **scheduler**, the **monologue channel** (mono1–mono4 text, §2.4, §4.9.3, §6.1.3 `wait`),
`E2.norm/answerOk/whereOk` (§9.5-5), `fmt12`, `ymd`, `G.sd` shared helpers (moved from ep1 `js/data/talk.js`), system-string
whitelist `G.e2.STR` (§10 A), session text store (§9.2 자유 입력), image resolver incl. ep1 asset fallback (§8.1), DEBUG/`window.haru`
base (§11.3 QA 도구); `series.js` = bible §7 API as revised by §9.3 (+ `endEp1` for P-2) and `e2.seriesBoot/seriesStart/commit/
hookPatch` (§3.20.2, §9.3 ①②④⑤) incl. commit retry; `e1canon.js` (§9.4 neutral canon lines) + `cb.*` computation (§3.20.1, §9.3);
`config.ep2.js` (`SAVE_KEY`, `AUDIO_BASE`, `G.EP`, `G.EP.CLOCK`, `G.EP.HOME`, `G.EP.QS`, `G.EP.DEFAULTS`); `fx.js` (subtitle
renderer, mono renderer, direction arcs, edge shake, vignette var); `icons.js` (+ icons for `재난 알림`, `타임라인`);
`keyboard.js` (predict bar 3 cells, number row, `predict`/`ctx`/`numRow` options, 250 ms "shown" rule, desktop mapping, §9.5-1/-2,
§5.3 row); `widgets.js` (`holdButton` 0.8 s ring, `voiceBubble`, `framePlayer`, `pinPad({dots:false})`, §9.5-3, §9.1 widgets row);
`media.js` = `G.media` single playback/route API + Bluetooth simulation state (§7.1.5 API, §9.7 블루투스 시뮬레이션 — DSP chains come
from audio); `js/config.js` keys (§9.1); P-1/P-2 (client decision ④, bible §6.7); `deploy/Caddyfile` (§9.1 배포 — `/work/*` hidden,
`/ep2/assets/*` cache, Permissions-Policy with bluetooth/accelerometer/gyroscope/magnetometer/clipboard-read, §10 K first line) and
`deploy/README.md`; `ep2/css/core.css` (styles of all core widgets). P-1/P-2 exact text (bible §6.7 table): **P-1** `js/data/recordings.js`
line 319 `t: '2025-11-21 01:12'` → `t: '2025-11-23 01:12'` (nothing else; the ep1 `docs/DESIGN.md` sync is the lead's) · **P-2** ep1
`index.html`: `<script src="engine/series.js"></script>` immediately before the `js/scenes.js` script tag · ep1 `js/scenes.js` `SC.ending`:
the line `G.series && G.series.endEp1();` directly after the existing `G.flag('END', true);`. Also core: `G.ui.inputActive()` (keyboard
open ∨ a mounted `G.ui.pinPad`), the ep1 `G.fx` legacy names (ARCH §4.23), `G.e2.stage()` (ARCH §4.5).

**audio** — everything audible. `audio.js`/`spatial.js` rewritten for ep2: buses `ui voice sfx world amb music mediaOut` (§7.1.1),
in-app rule (amb −6 dB LP 900 when the room view is closed), `A.at(az,{dist,el,via,ir,wet,life,bus})` with `via` transmission
filters, IRs (`ir601 irRoof slap180 irSteel irFar irStair irCloset irSmall irVoice`), open-door/window filter lift (§7.1.2–§7.1.3),
directional GSM fixed at 70° (§7.1.4), DSP for the phone and `2층_스피커` chains used by `G.media` (§7.1.5 chains, gain law,
calibration), level targets (§7.1.6), HRTF ≤ 10 + low-end fallback (§7.1.7), speaker mode (StereoPanner, +6 dB quiet cues,
38/76→114/152 Hz, direction arcs via `G.fx.dirArc`), every cue of §7.2 (ARCH §4.13 table), offline renders `rec.uri vid.move vid.roof
hook.seahY ringHaru7` (§7.2 E/G, §9.7 미디어 렌더, §9.4 ring), TTS loading from `G.AUDIO_BASE` incl. the jimin VM name assembly
`v2_jimin_vm_a + formant {N} 씨가 + v2_jimin_vm_b`
(§0.2 T12, §7.3, §9.7 TTS), iOS lifecycle (unlock, audioSession, resume chip `🔈 소리 다시 켜기`, suspend on hidden — §9.7, §7.1.7),
vibration patterns table (§7.1.7 진동 — callers pass the key), tension mapping (§6.1.5 gains/LP; T value is computed by flow),
the drone −100 cent rule for user `dash` (§6.1.5), `silenceDrop(ms,{keep})` (§7.1.1); `G.tones` = notification-tone registry,
routing (`for`), default/per-chat tone settings, previews and **his-tone ledger** (§3.11 원장, §4.8 소리 열, §9.7 알림음 라우팅);
`G.SUBS` (S00–S28, §4.9.2 = §7.4) + `G.audio.sub()` renderer obeying §7.4 rules (info vs all, mono first, direction words 0).

**shell** — the phone's system UI and the `security` module. `phone.js`: status bar (`SIM 없음`, `ᯤ saemal_rooftop` or nothing when
Wi-Fi off, `ᛒ` while connected, battery, time, ⏸ 44 px area → pause), per-user home from `G.EP.HOME` (12 + dock 2 / 5, wallpapers,
clock widget, badges), navigation stack, Android back + `한 번 더 누르면 게임을 나갑니다`, quick settings (3 tiles + user row,
not drawn while locked, `[—]` hidden from `doorOpened` until `END`, grey after `e2_dash='locked'`, §4.6.1, §5.3, §0.2 E1),
notification store/banners/panel **per user** with tone routing via `G.tones`, coalescing, in-app pop, sound mode / DND (§4.8, §5.3,
§5.7 ③), dialogs, toasts, bottom sheets, **near-share sheet** (§4.10.4 시트), **volume panel** `G.phone.volume` (§4.6.7, §5.3),
**Wi-Fi state** (`G.phone.wifi`, auto-on 90 s, saved/forget/password `saemal0601`, §4.6.6, §5.6), user-switch shell (§5.4 셸) and
`G.users`. `lock.js`: three lock screens (n / dash / hook-mode, §3.2, §4.0 table, §4.7.1, §5.3), smart-lock line, always-on finger
icon, widget line, emergency call, notification taps, **sets `M1`**, seeds N01–N03. `settings.js`: every 설정 screen of §4.6.0–§4.6.8,
§4.6.11–§4.6.12 and §5.6 블루투스/Wi-Fi rows, settings search (§4.6.0 표), screen registry `settings:screen` (ARCH §4.22).
`security.js` + `data/security.js users.js kbd.js`: §3.3 smart lock, §3.4 fingerprint (incl. last-own-finger protection, add finger,
rename, verify sheet), §3.5 keyboard learning (word lists, sort toggle, `kbd:predict` provider, `kbdHisSeen/factKbd/seenKbd`),
§3.9 users (list/detail, greyed toggles until 01:20, `+ 사용자 추가`), '—' PIN pad (no dots, 0310, 5-fail 30 s), **sets `M3`**,
§4.6.12 '—'-side settings, §5.4 all, §9.6 ① all. Also §3.11 알림 소리 / 대화별 알림음 screens (using `G.tones`), Bluetooth screen and
⚙ detail (using `G.media.bt`, no 등록 해제, §0.2 D12). `main.css` (system UI, eye-mode rule, vignette var) + `shell.css`.
Also shell: the ep1 screen builders `G.ui.screen` / `G.ui.list` (they live in `engine/core/phone.js` — every app uses them, ARCH §4.9),
the `G.app` registry, the back-handler stack `G.phone.pushBack` (Android back / Esc reach flow's notebook, cards, pause and room eye views
through it), `G.phone.dismissModals()` / `G.phone.modalOpen()`, notification ids = DESIGN N-numbers, seeding N01–N03 on `flag:gotPhone`,
the 설정 › 일반 screen (`general`) and the `예측 텍스트 표시` toggle (`vars.kbdPredictOff`), lock-screen long-press → widget preview (§4.6.4),
QS 손전등 → `G.room.open({mode:'camera', flash:true})` on {N} (tile-only toggle on '—', §5.3).

**social** — 톡 (§4.2, §3.21 톡, §9.4 `seaRoomMessages()`), 모먼트 (§3.7, §3.12, §3.13, §3.14, §4.1.1–§4.1.8 except the 03:33 overlay,
§5.1 모먼트 row, §5.2 '—' 모먼트 row, §5.7 ③ M5-in-dash bubbles), 메일 (§4.3, §3.21 메일, `cb.manager`). Owns all DM threads
(jimin, fake, real, seah_y, the '—'-side view), restricted comments/messages (19 hidden lines, tonight schedule by in-game clock,
cancellation after C1), C1 dialogue + chips + free-input pools, `where` judging (`G.e2.whereOk`), M6 chips (C1b, makerStayDown),
post-M7 maker lines (P1/P2/A/K), B11, B19, **N06–N11, N10′, N14** notifications (through `G.phone.notify`), fake-reply
`읽음` + GSM 0.5 s + S05, mono3 trigger, the 02:00 jimin thread interaction (answer judging via `G.e2.answerOk`, `읽음`,
`…괜찮아요. 천천히요.` once, `[대답하지 않는다]`) and the **END tail chat scripts** (§4.10.6–§4.10.7 chat lines, §4.10.8 C1 DM) played
on request from flow. Sets flags listed in ARCH §4.4 (jimin*, fake*, hidden*, C1*, maker*, where*, dashMoment, draftSeen,
fakeLineSeen). `apps.css` (shared app styles — media styles go to `media.css`).

**media** — 갤러리 both users (§4.5, §3.10 갤러리, §3.17 받은 파일 viewer + `photo4Seen`/`seenHangyeol`, video player via
`G.ui.framePlayer` incl. `seenHinge` 10.0 s / `seenWhistle` 8.0 s, `cb.ring` screen recording, no share/delete for '—', camera-roll
album from room shots), 녹음 (§4.7.8, 🔁 on by default, 🔊 → `G.phone.volume`, output line, plays via `G.media`), 시계 both users
(§4.7.4, §3.16 materials, `cb.alarmDel`, detail = view-only, **alarm ring screen** `23:10 · 문 앞` for the cold open — N04 visual),
인터넷 (§4.7.5, §3.21 기록 19 rows, `최근 방문` 3, fixed search table, articles A/B), 메모 both users (§4.4 incl. '—' read mode +
`cb.*` lines, {N} editor with predict bar), 캘린더 (§4.7.3 + the 00:00 notification payload used by flow), 전화 (§4.7.2 + lock
emergency dialer via hook `phone:emergency`), **alerts module** = 재난 알림 + 타임라인 (§3.6, §4.6.9, §4.6.10, §5.5, §9.6 ②, §1.2.3
render rule + self-check), sets `cbsOpened tlOpened factCbs seenCbs dashMemo dashA0310 dashARoof dashHidden seenKey404 seenWhistle
seenHinge photo4Seen seenHangyeol`. `media.css`.

**room** — 방 보기 and every picture of the room/roof. `room.js` rewritten (§9.1 room row): 4 views + yaw (§7.1.2 표), `mode:'camera'
|'eye'`, outside layer group above the room-darkness filter (§8.3-2), sub-view zoom switching `roof_tank/roof_rail/rail_window`
(§6.3 rule 4, §8.3-2), **live** time layers that cross-fade in view (§3.15 L1–L8, §6.3 matrix, §8.3-3), CSS effect slots (snow
particles, police lights, beams, LED dots, glare, door-gap light, wall-clock hands, new-phone DOM screen, lid `{N}` overlay §8.3-5/6/7),
captions/closeups of §4.7.6 + `newphone` §4.7.7, box/note/polaroid interactions (§3.1 → `gotPhone boxNote boxHand polaroidSeen seenNote
newPhoneSeen`), the camera flashlight (`G.room.flash`, also driven by the QS tile), forced eye-views for M0/M7/M8 (`G.room.forceView`,
`G.room.eyeM0({resume})`), B09 / B14 / B16 / B17 visuals as callable effects, asset
fallbacks (§9.8 table rows for room images). `camera.js` = camera chrome (shutter → `vars.shots`, flash, 1×/2×/8× pill).
`roomdata.js` = `G.ROOM` (hotspots measured against `G.IMGMETA`). **`climax.js`** = M5→M8-run-up state machine: B12, B13, compressed
prelude (§0.2 D1, §6.1.7), **sets `M6`** (drill), drill loop/wobble/C2 watcher/early lure 1 & 2 (§3.16, §0.2 #21), B14 (§6.4-①),
siren time formula + **sets `M7`**, `sirenBy`, `c2Src`, `lureEarly`, `lureCount`, `wobbles`, `C2`, `roofLight`, `peepholeTaped=true`,
`footprints=1`, M7 forced window view + B15/B17/B18/B16/W06 (§3.17 00:36–01:09, §6.2 rows), climax resume after reload (§6.1.8 표).

**flow** — the story's spine. `index.html`, manifest, `ep2.css` (title, cards, credits, check card, recap, pause, hook overlay
styles). `scenes.js`: §3.0 title/warning/earphone test/recap card (B00), cold open B01 + S00, B02 (§3.1 완료 조작 audio), pause menu
(§4.0 일시정지, §5.3 row), title extras `훅 다시 보기`/`이번 선택을 이야기로 남기기` (§4.10.13). `notebook.js` + `objectives.js`:
§2.4 (3 tabs, show/done table, hints §3.x T1–T3, M7 grey rule, optional mark, memo tab `predict:false`), all ep1 auto-note paths
removed. `director.js` + `beats.js`: §6.1 (format, safe zones S1–S10, defer policy, cooldowns, tension T, micro ambience, clock-jump
compensation, visibility, less-scary), director-run beats B04 B05 W02 B07 W04 W05 B08(audio part) B09′ B09 m.* (ARCH §4.18 table),
JS budget. `ending.js`: M8 B20 (sets `M8`, `doorOpened`), §3.17 01:20–01:50 cards (`e2_dash`, `pol1Shown`, near-share via shell,
`e2_phone`, Wi-Fi restore line), 02:00 trigger, `end:reached` handler (**sets `END`**, `answeredRight`, `stage.e2_jimin`, calls
`G.e2.commit()`), tail orchestration (social scripts + cards), 02:12/02:15/02:20/02:30 cards (§4.10.8–§4.10.11).
B20 order (ending, §3.17/§6.2): sched `end:m8` → `boots.snow` 55°→0° → 1.5 s → `G.flag('M8')` + `playVoice('v2_kang_door')` + S18 +
`G.room.doorGap('torch')` → voice end + 1.5 s → `G.room.forceView({view:'r2_door', handle:true})` → on handle: `doorlock.open` + S26 +
`G.audio.doorOpen(6000)` + `G.room.lightsOn()` + `switch.click` + `doorlock.close` (soft) → `doorOpened`, `peepholeTaped` off, `footprints`
2, `G.media.bt.retire()`, `amb.room601` warm → card `k0110` → [계속] → `G.users.forceN()` if current is '—' → 01:20 card. `hook.js`:
§3.19 ⑥–⑩, §4.1.8 hook overlay, §6.4-③ (**sets `HOOK`, `hookOpened`, `hookZoom`, `hookFull`, `hookDone`**, calls
`G.e2.hookPatch()` on `[처음 화면으로]`, back/home on the hook screen and `pagehide`/`visibility {hidden}` while it is up — §9.3 ⑤,
calls `G.e2.mono('mono4')` when the first playback ends, raises N17 through `G.phone.notify` — ARCH §4.19). `main.js`: boot, resume table (§9.2 다시 열기 규칙 + §6.1.8 재개표), Esc priority (keyboard close → `G.phone.back()` while
`G.phone.canBack()` → pause), two-finger pause (two touches that both end within 300 ms having moved < 10 px — a pinch is never a tap),
Android-back is shell's (flow layers register with `G.phone.pushBack`), pause menu open ⇒ `G.clock.pause()` + bus `pause {open:true}`,
close ⇒ `G.clock.resume()` (ARCH §9 G33), `G.audio.unlock()` on every title button tap (`시작하기` path = warning [확인], `이어하기`,
`훅 다시 보기` — §9.7), `--ts` text scale from settings, lazy preload groups on milestones (`G.PRELOAD_GROUPS`
start/m1/m2/m3/m4/m7 via `requestIdleCallback`, §9.8), `navigator.wakeLock.request('screen')` on start + re-request on visible (§9.7),
`haru.skipTo`, and the DEBUG notebook-title auto-check (§10 A: card title ∈ strings drawn so far, except `이 폰` `—의 홈` `지민의 질문` `상자` — `G.OBJECTIVES.titleExceptions = [phone, home, answer, box]`).

**assets** (not a build agent here): produces `G.IMG` / `G.IMGMETA` / `G.AUDIO_FILES` and files. Consumers' expectations: ARCH §5.1.

### 3.3 Who renders what (every §5 screen)
| App / surface | Screens | Owner (file) | Data source |
|---|---|---|---|
| {N} home | grid 12 + dock 2, clock widget, badges, wallpaper `n_wall` | shell (`phone.js`) | `G.EP.HOME.n`, `app.badge()` |
| '—' home | grid 5, wallpaper `old_room`, no widget/dock/badges | shell (`phone.js`) | `G.EP.HOME.dash` |
| Lock — {N} | §3.2 layout, smart-lock line, widget, N01–N03, ◉ finger, 긴급 통화, 카메라, PIN entry when not trusted | shell (`lock.js`) | `G.STORY.users.n.lock`, `G.state.notifs`, `G.security.trustState()` |
| Lock — '—' | `old_room_lock`, clock/date only → PIN pad (no dots) | shell (`lock.js` + `security.js`) | `G.STORY.users.dash` |
| Lock — hook mode (03:33) | §4.1.8 lock + seah_y notif | shell (`lock.js`), driven by flow `hook.js` | args of `G.lock.show` |
| Status bar · quick settings · notification panel · banners | §4.6.1, §5.3 | shell (`phone.js`) | `G.EP.QS`, `G.state.notifs` |
| User-switch shell (2 s) | `사용자 전환 중…` | shell (`security.js`) | `G.STORY.users` |
| Verify sheet · PIN fallback | `본인 확인` / `지문을 대거나 PIN을 입력하세요` / `현재 PIN을 입력하세요` | shell (`security.js`) | — |
| Volume panel | §4.6.7 볼륨 | shell (`phone.js`) | `G.media` |
| Near-share sheet | §4.10.4 box | shell (`phone.js`) | args |
| In-game keyboard + predict bar | §9.5-1 | core (`keyboard.js`) | predictions from shell hook `kbd:predict` |
| 톡 | logged-out banner, list (2 rooms), `{MAKER_CONTACT}` room, `윤세아` room, 다시 로그인 → SMS dead end | social (`talk.js`) | `G.STORY.talk`, ep1 save (runtime) |
| 모먼트 ({N}) | home feed, search + results, profile, post + comments + restricted-comment sheet, messages, 요청, 제한된 계정의 메시지, chats (jimin / fake / real / seah_y), voice-message bubble, chips, typing, `읽음`, `ⓘ 전송되지 않음`, profiles (fake/real/jimin blocked & unblocked/seah_y/sagongsa), `이 계정 정보`, ⋯ menus (이 계정 정보·제한·차단·신고), ☰ 설정 (개인정보 보호 · 제한된 계정 · 알림 → shell screen · 로그인 활동), `활동 제한` sheet, ✎ new message | social (`moment.js`) | `G.STORY.moment` |
| 모먼트 ('—') | fake account profile, its messages list, reversed chat + draft `임시 저장 · 오후 9:58`, 계정 전환 sheet (sagongsa), limits | social (`moment.js`) | `G.STORY.moment.dashView` |
| 모먼트 03:33 voice overlay | §4.1.8 overlay | flow (`hook.js`) with core `voiceBubble` | `G.STORY.moment.profiles.seah_y`, `G.audio.buffer('hook.seahY')` |
| 메일 | 받은편지함 6, 휴지통 1, reader, banners | social (`mail.js`) | `G.STORY.mails`, `G.STORY.mailAccount` |
| 갤러리 ({N}) | empty state, `카메라` album (room shots), `받은 파일` + 1/4 viewer w/ Kang lines | media (`gallery.js`) | `G.STORY.gallery.n`, `G.STORY.gallery.received`, `vars.shots` |
| 갤러리 ('—') | `0310` (11 + 214 grey), `옥상` (14 + video), ⋮ `숨긴 항목 보기`/`설정`, viewer, info sheet, video player | media (`gallery.js`) | `G.STORY.gallery.dash` |
| 카메라 = 방 보기 | 4 views, sub-views, 8 close-ups, flash, zoom, shutter | room (`camera.js`, `room.js`) | `G.ROOM`, `G.IMG`, `G.IMGMETA` |
| Forced eye-views | M0 door + box chain, M7 window ~40 s, M8 door + handle | room (`room.js`) driven by flow (M0, M8) and climax (M7) | `G.ROOM` |
| 메모 ({N}) | `메모 없음`, editor (predict bar), saved memos | media (`memo.js`) | `G.STORY.memos.n`, `vars.md.memos` |
| 메모 ('—') | one memo `—`, read mode, cb lines | media (`memo.js`) | `G.STORY.memos.dash` + `G.e2.cb()` |
| 인터넷 | start (`다온`, `최근 방문` 3), search results, 기록 19, saved pages, articles A/B, 다온 login dead end | media (`browser.js`) | `G.STORY.browser` |
| 녹음 | list (`우리`), player (🔁, 🔊, output line, subs S27), info sheet | media (`recorder.js`) | `G.STORY.recordings` |
| 시계 ({N}/'—') | alarms list, view-only detail, ring screen (cold open), world/stopwatch/timer stubs | media (`clock.js`) | `G.STORY.alarms` |
| 캘린더 | month (dots 10·24·25), agenda, detail, sync banner | media (`calendar.js`) | `G.STORY.events` |
| 재난 알림 | A1 list + tabs + header, A2 detail, A3 ⚙ | media (`alerts.js`) | `G.STORY.cbs`, `G.STORY.cbsMapo`, `G.STORY.days`, `G.STORY.names` |
| 타임라인 | T1 month, T2 day (derived), place card, ⋮ 설정 | media (`alerts.js`) | `G.STORY.days` |
| 전화 | keypad, 최근 기록 empty, 연락처 empty, emergency dialer | media (`phone.js` app) | `G.STORY.dial` |
| 설정 ({N}) | first screen, search, 연결 (Wi-Fi, saved, ⚙, Bluetooth, device ⚙), 소리 및 진동 (mode, 볼륨, 알림 소리, 벨소리), 알림 (앱 알림 › 모먼트 › 대화별 알림음, 방해 금지), 디스플레이, 배경화면 (widget preview), 잠금 화면 (+ smart lock), 보안 및 개인정보 (생체 인식 › 지문, 내 디바이스 찾기), 위치, 사용자, 계정 및 백업, 일반 › 키보드 › 예측 텍스트 › 개인 단어 목록, 배터리, 휴대전화 정보 | shell (`settings.js` + `security.js` delegated keys) | `G.STORY.settings`, `G.STORY.security`, `G.STORY.users`, `G.STORY.kbd` |
| 설정 ('—') | §4.6.12 variant (reversed users, no fingerprints, PIN only, dash word list, 알림 소리 `—`, 배경화면 `내 사진`) | shell | same, `dash` branch |
| 재난 알림 설정 / 타임라인 from settings search | open alerts module screens | media (registered screen) | — |
| Notebook `{N의} 수첩` | 할 일 · 힌트 · 메모 | flow (`notebook.js`) | `G.OBJECTIVES` |
| Monologue line | bottom 3.2 s | core (`fx.js` render, `e2.js` queue) | `G.e2.MONO` |
| Sound subtitles | bottom / directional | audio (`G.audio.sub`) → core `G.fx.sub` or room `G.room.dirSub` | `G.SUBS` |
| Title · warning · earphone test · recap · pause | §3.0, §4.0 | flow (`scenes.js`) | scenes.js / `G.e2.MONO.recap` |
| Ending cards 01:10–02:30 · credits · check card · letter | §4.10 | flow (`ending.js`) | `G.STORY.ending` (or inline) |
| END chat tail (jimin, mom, maker DM) | §4.10.6–§4.10.8 chat parts | social (`moment.js`, scripts) driven by flow | `G.STORY.moment.scripts` |

---
## ARCH §4 — Cross-module APIs (exact signatures)

### 4.0 Conventions
- Namespaces: `G.e2` (alias `window.E2`), `G.series`, `G.media`, `G.users`, `G.security`, `G.phone`, `G.lock`, `G.tones`, `G.audio`,
  `G.room`, `G.climax`, `G.director`, `G.notebook`, `G.moment`, `G.chat`, `G.talk`, `G.mail`, `G.gallery`, `G.recorder`, `G.clockApp`,
  `G.browser`, `G.memo`, `G.calendarApp`, `G.phoneApp`, `G.alerts`, `G.settingsApp`, `G.scenes`, `G.ending`, `G.hook`, `G.main`.
- **Calling another owner** = stub-guarded: `G.room && G.room.forceView && G.room.forceView(o)` or `G.hooks.call('name', …)` (returns
  `undefined` + `console.warn` if missing). Never call another owner's function at **load time**; register on `DOMContentLoaded`-free
  terms: your IIFE defines things; boot happens in `G.main.boot()` (flow) which calls each owner's `init()` if present (ARCH §8).
- Promises: every async API resolves (never rejects) — errors are swallowed + `console.error` (DEBUG: red overlay line).
- Times: **playMs** (`G.state.playMs`, advances only while the tab is visible) for every "real n seconds" rule (§6.1.2). In-game time
  = `G.clock.now()`. Never use `Date.now()` for game logic (only for saving flag timestamps, as ep1).
- Owner-private persisted state lives in `G.state.vars.<key>`: core `pm clock sched e2`, shell `sh`, social `so`, media `md`,
  room `room climax shots`, flow `dir nb endStep`, audio `au`. Cross-owner state = only the names in `flags.js` (ARCH §4.4).

### 4.1 `init` protocol (called by flow `G.main.boot()` in this order; each is optional)
`G.fx.init()` → `G.phone.init()` → `G.audio.init && G.audio.init()` (no AudioContext yet) → `G.media.init()` → `G.e2.init()`
→ `G.security.init()` → `G.lock.init()` → `G.room.init && G.room.init()` → `G.climax.init()` → `G.notebook.init()` →
`G.director.init()` (does not start) → `G.moment.init && …` (social) → `G.alerts.init && …` → `G.ending.init()` → `G.hook.init()`
→ `G.e2.seriesBoot()` → `G.scenes.title()` or resume (ARCH §8). Apps register in their IIFE via `G.app(id, def)`.

### 4.2 `js/config.js` additions (core) and `ep2/js/config.ep2.js` (core)
`js/config.js` — ADD only (ep1 ignores): `MAKER_CONTACT: ''`, `MAKER_AVATAR: ''`, `LETTERS: { ep2: '' }`, `MAKER_HANDLE: ''`
(all ship empty — client decision ⑦; comments in Korean like the existing file).

`ep2/js/config.ep2.js` (loads before engine):
```js
window.CONFIG = window.CONFIG || {};
window.CONFIG.SAVE_KEY = 'haru-escape.ep2.save.v1';
window.G = window.G || {};
G.AUDIO_BASE = 'assets/audio/';                    // relative to ep2/index.html
G.EP = { n: 2, title: '하루를 위한 방탈출! 2', sub: '돌려줄게', screenTitle: '{N를} 위한 방탈출! 2', estMin: 45 };
G.EP.CLOCK = {                                       // §9.1 verbatim (rate = real seconds per in-game minute; cap = stop at)
  t0: [2026, 11, 24],                                // JS month 11 = December. Times 00:00–11:59 belong to 12-25.
  ms: [ ['M0','23:10', null, null, 67], ['M1','23:12', 12, '23:40', 67], ['M2','23:41', 50, '23:51', 66],
        ['M3','23:52', 30, '00:03', 65], ['M4','00:04', 12.5, '00:15', 64], ['M5','00:16', 26, '00:23', 63],
        ['M6','00:24', 30, '00:35', 62], ['M7','00:36', 'beat', '01:09', 61], ['M8','01:10', 'card', null, 60],
        ['END','02:00', 'card', null, 59], ['HOOK','03:33', 'fixed', null, 58] ],
  jump: { C1b: '00:27', C2: '00:29', drillStop: '00:31', musicCut: '00:33', b17: '00:39', b18: '00:41' },
  m7beat: [[0, '00:36'], [18, '00:39'], [30, '00:41']], m7rate: 1.5,
};
G.EP.HOME = {
  n:    { apps: ['talk','moment','mail','gallery','camera','memo','browser','recorder','clock','calendar','alerts','timeline'],
          dock: ['phone','settings'], wall: 'n_wall', widget: 'clock' },
  dash: { apps: ['gallery','memo','moment','clock','settings'], dock: [], wall: 'old_room', widget: null },
};
G.EP.QS = { tiles: ['wifi', 'bt', 'flash'], userRow: true };   // §4.6.1 / §0.2 E1 — no DND / sound-mode / airplane tiles
G.EP.DEFAULTS = { e1MyMsgs: true, phoneVol: 60, btVol: 15, audioMode: 'ear', subs: 'info', scares: 'full' };
G.STORY = G.STORY || {}; G.STORY.names = { /* ARCH §1.1 */ };
G.DEBUG = !!window.CONFIG.DEBUG || (/[?&]debug=1\b/.test(location.search) && !/pengueverything\.cloud$/.test(location.hostname));
```
App ids (used by `G.app`, `G.phone.openApp`, routes, `data-qa`): `talk moment mail gallery camera memo browser recorder clock
calendar alerts timeline phone settings`. Labels: 톡 · 모먼트 · 메일 · 갤러리 · 카메라 · 메모 · 인터넷 · 녹음 · 시계 · 캘린더 ·
재난 알림 · 타임라인 · 전화 · 설정.

### 4.3 `engine/core/base.js` (core)
Keep ep1 API (`G.util`, `G.bus`, `G.settings`/`G.saveSettings`, `G.state`, `G.hasSave/load/save/resetSave`, `G.flag`, `G.vars`,
`G.hooks.set/has/call`, `G.clock`, `G.battery`). Remove/neutralise ep1 fragments & mirroring (`G.foundFragment`, `G.fragCount`
return 0, `G.mirroring()` → false). Changes:
```js
G.T(s) → string                 // ARCH §1.1 (moved here from ep1 main.js); G.NAME
G.settings defaults += { audioMode:'ear', subs:'info', e1MyMsgs:true, reduceShake:<prefers-reduced-motion>, reduceFlash:<same> }
                                 // shared key 'haru-escape.settings.v1'; ep1 keys untouched; scares 'full'|'light'|'off' (ep1 values)
G.state = { v:1, ep:2, flags:{}, vars:{}, playMs:0, hintsUsed:0, hints:{}, threads:{}, notifs:[], read:{}, fragments:{}, seen:{},
            startedAt, stage:{ e2_finger:null, e2_dash:null, e2_fakeReply:false, e2_jimin:false, e2_phone:null }, cb:null }
G.save(immediate?)               // 400 ms debounce; + every 10 s; + immediately on visibilitychange→hidden & pagehide; try/catch → memory mode
G.flag(name) → bool ; G.flag(name, true|false|number) → bool
     // set: stores Date.now(); FIRST set also stores vars.pm[name] = playMs; emits 'flag' name, 'flag:<name>' (only on false→true)
     // clear: deletes; emits 'flag:off' name, 'flag:off:<name>' (only on true→false). DEBUG: warn if name ∉ G.F.ALL.
G.pm(name) → number|null         // playMs when the flag first turned on (vars.pm). Use for every "M5 + 150 s" rule.
G.vars(k) / G.vars(k, v)         // set emits 'var' {k, v, prev} and 'var:<k>' {v, prev} when the value changed (deep-compare primitives/arrays)
G.hooks.call(name, ...args)      // unchanged semantics (warns when missing)
G.clock = {
  now() → Date,                  // in-game. 12-24 for 12:00–23:59, 12-25 for 00:00–11:59
  hm() → 'HH:MM',                // 24 h
  minutes() → int,               // minutes since 2026-12-24 00:00 (so 00:16 on the 25th = 1456) — use for comparisons
  toMin('00:24') → int,          // same scale (HH < 12 ⇒ next day)
  passed('00:22') → bool,        // now ≥ that time
  jump(hmOrKey) → bool,          // forward-only: max(now, t); key ∈ G.EP.CLOCK.jump ('C1b','C2',…) or 'HH:MM'. Emits 'clock:jump' {from, to, skipped:[hm…]}
  run(rateSec, capHM),           // card mode only (ending): start flowing at rate until cap (01:50→02:00 stretch)
  start(),                       // ep1 name kept: playMs starts accumulating. flow calls it at introDone ([시작]) and in G.main.resumeFrom
  pause() / resume(),            // pause menu (flow): playMs, the 250 ms tick, G.e2.sched, director tick and climax watcher all stop (same as hidden)
  running() → bool,              // started ∧ ¬paused ∧ ¬document.hidden
  freeze() / unfreeze(),         // debug + HOOK (no arguments; HOOK freezes at 03:33)
  segment() → {id, mode:'rate'|'beat'|'card'|'fixed', rate, cap},
  tick()                         // internal 250 ms timer (the ONLY game timer; also drives G.e2.sched)
};
// Milestone flags (M0…HOOK) re-anchor the clock: when Mx is set, now = max(now, Mx time) and the segment's rate/cap apply.
// Capped clock: seconds loop 57→58→59→57 (ep1). M7 'beat': 00:36 at pm(M7), 00:39 at +18 s, 00:41 at +30 s, then 1 min/1.5 s to 01:09.
// Emits 'clock:min' {hm, min, date} every in-game minute change (and once per jump target).
// Emits 'tick' {dt, playMs} on every 250 ms tick while running() — director (1 s logic), shell status bar, room wall clock use it.
//   (ep1 phone.js emitted 'tick' with a Date every 1 s — that emitter is removed; listeners read G.clock.now().)
//   Only exception to "one game timer": climax's C2 watcher may poll every 100 ms (§7.1.5) but only while G.clock.running().
G.battery() → int                // from CLOCK.ms by current milestone (67…58); vars.battery overrides (debug)
// bus 'visibility' {hidden}; playMs and the clock tick stop while hidden (ep1 rule kept).
```

### 4.4 `ep2/js/flags.js` (core) — the state dictionary (§2.5 + §9.2 + additions)
Exports `G.F` (name → same string, e.g. `G.F.factSmart === 'factSmart'`), `G.F.ALL` (array), `G.F.TOGGLE` (non-monotone flags),
and `G.VARS` (var name → `{type, def, owner}`). Every file references names through `G.F.x` (typo safety). **Each name has exactly
one setter** (owner below); readers are free. ★ = added by this contract (not in §2.5).

**Flags** (value = timestamp; read with `G.flag(n)`; monotone unless marked TOGGLE)
| flag(s) | setter (owner · file) | meaning / trigger (DESIGN §) |
|---|---|---|
| `introDone` `recapShown` | flow · scenes | [시작] tapped / recap card shown or skipped (§3.0) |
| `M0` | flow · scenes | cold open starts (§2.1) |
| `M1` | shell · lock | first entry into an unlocked {N} screen by swipe / finger icon / notification tap (§2.1, §3.2) — not lock-camera, not QS |
| `M2` | core · e2 | ⓐ fact ≥ 2 ⓑ pm(M1)+360 000 ⓒ first switch toward '—' before M2 (`G.e2.requestM2`) (§2.1) |
| `M3` | shell · security | '—' PIN `0310` accepted (§3.9) |
| `M4` | core · e2 | §2.1 M4 rule (ARCH §4.5) |
| `M5` | core · e2 | pm(M4)+150 000 with '—' hold ≤ 90 000 (ARCH §4.5) |
| `M6` | room · climax | drill starts (after prelude) — fallback setter core·e2 only if `G.climax` is missing |
| `M7` | room · climax | siren starts (§2.1 M7 row) |
| `M8` | flow · ending | Kang's voice starts (01:10) |
| `END` | flow · ending | jimin's END line displayed (via `end:reached`) |
| `HOOK` `hookDone` | flow · hook | 03:33 banner shown / hook left → patch done |
| `gotPhone` `boxNote` `boxHand` `polaroidSeen` `seenNote` `newPhoneSeen` | room · room/roomdata | §3.1 (`seenNote` = boxNote ∧ boxHand), §3.8 |
| `factSmart` `smartRemoved` `trustDevSeen` | shell · security | §3.3 |
| `fingerIconTouched` `bioOpened` `factFinger` `fingerDeleted` | shell · lock/security | §3.4 (`fingerDeleted` also writes `stage.e2_finger='deleted'`) |
| `kbdListOpened` `factKbd` `seenKbd` | shell · security | §3.5, §9.6 |
| `cbsOpened` `tlOpened` `factCbs` `seenCbs` | media · alerts | §3.6, §9.6 ② |
| `jiminOpened` `factJimin` `vmPlayed` | social · moment | §3.7 |
| `dashSeen` `pinPadOpened` `dashUsers` | shell · phone/security | §3.9, §3.10 |
| `dashMemo` | media · memo | §3.10 |
| `dashA0310` `dashARoof` `dashHidden` `seenKey404` `seenWhistle` `seenHinge` | media · gallery | §3.10, §3.20.4 |
| `dashMoment` `draftSeen` | social · moment | §3.10 |
| `factDash` | core · e2 | 3 of {dashMemo, dashA0310, dashARoof, dashHidden, dashMoment, dashUsers} |
| `soundSettingsOpened` `perChatSeen` | shell · settings | §3.11 (perChatSeen also when moment ☰ opens the same shell screen) |
| `toneRestored` | audio · tones (`G.tones.setDefault`) | default tone set to anything ≠ `dash` (§3.11, §0.2 T15) |
| `fakeKnown` `fakeReplied` `hiddenSeen` `C1` `C1b` `makerStayDown` `makerArrived` `whereAsked` `whereTank` | social · moment | §3.12–§3.14 (`fakeReplied` also writes `stage.e2_fakeReply=true`; `fakeKnown` also set on C1) |
| `fakeLineSeen` ★ | social · moment | the line `문 열어 줘.` was rendered (banner shown via `notify:shown`, list preview, or chat) — notebook `fake` title (§2.4) |
| `btConnected` TOGGLE · `btPlaying` TOGGLE · `musicCut` | core · media | §3.16, §9.7 |
| `lureEarly` `C2` | room · climax | §3.16 |
| `roofLight` TOGGLE | room · climax | on at M0, off 00:22 (B12), on 00:50 (§9.2) |
| `peepholeTaped` TOGGLE | room · climax (on at B12) · flow · ending (off at doorOpened) | L3 |
| `tankGlow` `b09Cue` | flow · director | B09 / B09′ (§6.2) |
| `doorOpened` `dashChoiceDone` `pol1Shown` `nearbyTaken` `phoneChoiceDone` `jiminReturn` `answeredRight` `kangWrapDone` | flow · ending | §3.17, §3.18 |
| `photo4Seen` `seenHangyeol` | media · gallery | received photo ④ opened (§3.17) |
| `hookOpened` `hookZoom` `hookFull` | flow · hook | §3.19 |
| `mono1` `mono2` `mono3` `mono4` | core · e2 (when the line is actually displayed) | §2.4 |

**Vars** (`G.vars(k)`; `def` = default)
| var | type · def | setter | meaning |
|---|---|---|---|
| `pm` | `{flag:playMs}` · `{}` | core | first-on times |
| `factCount` | int 0–6 · 0 | core | |
| `kbdHisSeen` · `kbdHisSet` · `kbdSeedSeen` | int · [] · [] | shell | §9.6 report |
| `cbsDays` · `tlDays` | `['12-15',…]` · [] | media | §5.5 |
| `cbsMapoRows` | int · 0 | media | max simultaneous ≥ 60 % visible `[마포구청]` rows |
| `pinTries` | int · 0 | shell | stored, never read (§3.9) |
| `user` | `'n'|'dash'` · `'n'` | shell | current user |
| `toneDefault` · `toneChatFake` | `'dash'|'water'|'toktok'|'bell'` · `'dash'` | audio (`G.tones`) | §9.2 |
| `smartGone` | ⊂ `['saemal_rooftop','2층_스피커']` · [] | shell | |
| `wifiOn` · `wifiSaved` ★ | bool · true · `['saemal_rooftop','SM-G991N_0A3F','Haesol_404']` | shell | |
| `btOn` | bool · true | core (`G.media.bt.setOn`) | QS/settings call it |
| `btVol` · `phoneVol` ★ | int 0–100 · 15 · 60 | core (`G.media.setVolume`) | |
| `ledState` | `'green'|'blue'|'off'` · `'green'` | core (`G.media.bt`) | L4 |
| `wobbles` · `lureCount` | int · 0 | room · climax | |
| `sirenBy` · `c2Src` | `'c2'|'early'|'c1b'|'time'|null` · `'rec'|'video'|null` | room · climax | |
| `m5HoldPm` | int|null | core | §9.2 |
| `snow` | 0–2 · 0 | core (from clock: ≥23:50 → 1, ≥00:20 → 2) | L1 |
| `footprints` | 0–2 · 0 | room·climax (→1 at 00:36) · flow·ending (→2 at doorOpened) | L6 |
| `hookPlays` | int · 0 | flow · hook | |
| `soundMode` ★ · `dnd` ★ | `'sound'|'vibrate'|'mute'` · `'sound'` · bool false | shell | settings-only toggles (§4.6.8, §4.6.0) |
| `kbdPredictOff` ★ | ⊂ `['n','dash']` · [] | shell (설정 › 일반 › 키보드 › 예측 텍스트 `예측 텍스트 표시`) | core keyboard draws no predict bar for a listed user (§5.4 S5, §4.6.5) |
| `shots` | `[{t, view}]` · [] | room · camera | camera album (no progress) |
| `sched` | array · [] | core | ARCH §4.5 |
| `climax` | `{drillPm, c2HoldPm, lureEarlyPm, m6DuePm, sirenAtPm, phase}` | room (m6DuePm: core) | |
| `endStep` | `'k0110'|'k0120'|'k0140'|'k0150'|'j0200'|'j0205'|'m0212'|'k0215'|'l0220'|'cred'|'check'|'hook'|null` | flow | |
| `clock` | object | core | anchors |
| `battery` | int|null · null | core (debug) | |
| `dir` | `{fired:{id:pm}, jsSpent:{b09,b14}, himTone:int, T:num}` | flow (himTone: audio) | |
| `room` · `nb` | object | room · flow | §9.2 |
| `replay` · `committed` · `commitTries` · `patched` | bool/int | core (series fns) | |
| `sh` `so` `md` `au` `e2` | object | owner-private | free schema |
Also `G.state.stage.*` (setters: `e2_finger` shell, `e2_fakeReply` social, `e2_dash`/`e2_jimin`/`e2_phone` flow) and `G.state.cb` (core).
Stage values are written **only** through `G.e2.stage(key, value)` (core wrapper → `G.series.stage`, so `G.series` stays inside `e2.js`).

### 4.5 `ep2/js/e2.js` (core) — `G.e2` (alias `window.E2`)
```js
// identity / text
G.e2.maker() → string            // {MAKER_CONTACT} resolution
G.e2.makerHandle() → string      // CONFIG.MAKER_HANDLE || ''
G.e2.makerAvatar() → url|''      // CONFIG.MAKER_AVATAR (root-relative → prefix '../') || '' (renderers then draw the initial avatar)
G.e2.less() → bool               // G.settings.scares !== 'full'  (덜 무섭게)
G.e2.speaker() → bool            // G.settings.audioMode === 'speaker' || sound off
G.e2.img(key) → url              // G.IMG[key] → ep1 reuse keys ('avatar_jimin','avatar_sea','kongi_old','mo_*','dog_*','sea_orgel_live',
                                 //   'icon') → '../assets/img/<key>.jpg|png' → 'assets/img/<key>.jpg' ('.png' for p_*, js_*, m_*, door_handle*, icon*, *_mask)
G.e2.STR                         // system-string whitelist (§10 A) — keys below; use these, never retype them
G.e2.MONO = { mono1:'…내 폰인데, 내가 모르는 내가 있다.', mono2:'…한 달 동안, 내 폰 안에 그 사람이 살았다.', mono3:'…진짜다.', mono4:'…세아?',
              recap:['지난달 24일, 404호. 옷장 뒤에 그 사람이 있었다.','나는 세아의 폰으로 문을 열고 나왔다.',
                     '세아는 아직 돌아오지 않았다. 그 사람도 잡히지 않았다.','그리고 내 폰은, 그 사람이 가져갔다.'] }
// facts & milestones
G.e2.factCount() → int ; G.e2.facts() → {factSmart:bool, …}; G.e2.dashCount() → int (0–6)
G.e2.requestM2(reason)           // shell calls at the start of the first switch toward '—' when !M2 → sets M2 now (B05 plays over the shell)
G.e2.nUiVisible() → bool         // users.current()==='n' && !phone.isLocked() && !users.switching()
G.e2.m4Ready() → bool            // M3 ∧ user n ∧ ((factDash ∧ fc ≥ 4) ∨ (playMs ≥ pm(M3)+480000 ∧ fc ≥ 2))
G.e2.m5DueAt() → pm|null         // pm(M4)+150000
G.e2.m6DueAt() → pm|Infinity     // max( min(M5+210000, max(M5+45000, C1?C1+45000:Infinity, B09?B09+120000:-Infinity)), lure?lure+130000:-Infinity )
                                 //   C1 = pm('C1'), B09 = pm('tankGlow'), lure = vars.climax.lureEarlyPm
G.e2.sirenDueAt() → pm|Infinity  // C2 ? pm(C2)+33000 : lureCount===2 ? min(pm(M6)+90000, C1b?pm(C1b)+150000:∞) : min(pm(M6)+240000, C1b?…:∞)
// scheduler (persistent in vars.sched, evaluated by the 250 ms clock tick, playMs based)
G.e2.sched.at(pm, id, data?) ; .after(ms, id, data?) ; .cancel(id|prefix*) ; .has(id) → bool ; .when(id) → pm|null
G.e2.sched.on(idOrPrefix, fn(data, id))   // register at init (handlers are not persisted); unhandled due events stay pending (DEBUG warn)
     // ids are owner-prefixed: 'e2:*', 'social:*', 'climax:*', 'end:*', 'dir:*', 'media:*', 'shell:*'
// monologue channel (§2.4, §4.9.3, §6.1.3)
G.e2.mono(id) → Promise<bool>    // queue; waits until G.director.safe('mono') (fallback: no keyboard, no notebook, no switch shell, no VM/video);
                                 // renders G.fx.mono(text, 3200); sets flag id; emits 'mono:show' {id} / 'mono:hide' {id}; each id once
                                 // callers: core (mono1, mono2), social (mono3 — after C1 reply line 3 is appended), flow hook (mono4 — first
                                 // hook playback ended). safe('mono') ignores S10 (M8+) so mono4 can show; it never ignores S1/S2.
// answers
G.e2.norm(s) → string            // NFC → trim → strip \s \p{P} \p{S} \p{Extended_Pictographic} → lower (§9.5-5)
G.e2.answerOk(s) → bool          // §9.5-5 verbatim (NEG_STOP / END_NEG); must pass §10 D 38-sentence table
G.e2.whereOk(s) → bool           // /물탱크|탱크|저수조/.test(norm(s))
// formatting
G.e2.fmt12('05:39') → '오전 5:39' ; G.e2.fmtK(date) → '오후 10:43' ; G.e2.ymd(date) → 'YYYY-MM-DD' ; G.e2.clamp(x,a,b)
// ep1 callbacks & series (§3.20, §9.3 — code there is normative)
G.e2.cbPreview                   // computed in seriesBoot
G.e2.cb(key) → value             // from G.state.cb once fixed (introDone), else cbPreview. Keys: e1done, min, knock, alarmDel, trap, vault, ring, manager, jimin, mom, js1
G.e2.ep2Done → bool
G.e2.seriesBoot() ; G.e2.seriesStart() ; G.e2.commit(opts?) → bool ; G.e2.hookPatch()
     // commit: retried silently (≤ 5) on next 'screen:push' and next boot while END ∧ ¬committed
     // title 「이번 선택을 이야기로 남기기」 (flow, replay only): confirm → G.e2.commit({ overwrite:true })
G.e2.stage(key, value)           // the only writer of G.state.stage.* (keys e2_finger e2_dash e2_fakeReply e2_jimin e2_phone) → G.series.stage + G.save()
// free-text session store (§9.2)
G.e2.session.set(msgId, text) ; G.e2.session.get(msgId) → string|null   // sessionStorage 'haru-escape.ep2.session'
// world helpers
G.e2.world() → {snow, roofLight, peepholeTaped, footprints, ledState, tankGlow, doorOpened}
G.e2.lowEnd() → bool             // navigator.deviceMemory ≤ 2 || first frame > 24 ms (§9.8) — room drops particles, audio uses equal-power panning
G.e2.init()                      // registers its sched handlers, M-evaluators, commit retry; fills core's window.haru helpers when G.DEBUG
                                 // (the window.haru object itself is created at e2.js load time — see G.sd paragraph below)
```
**M2/M4/M5/M6 evaluation (core, every tick + on 'flag' / 'users:switched' / 'lock:unlock' / 'home:show' / 'mono:hide')**
- M2 — first of: `factCount ≥ 2`, `playMs ≥ pm(M1)+360000`, `requestM2()`. Only after M1.
- mono1 — after `factSmart ∧ factFinger`, on the first `home:show {user:'n'}` → `G.e2.mono('mono1')`.
- mono2 — after `factDash`, on the first `lock:unlock {user:'n'}` / `home:show {user:'n'}` → `mono('mono2')`; when it hides, wait 800 ms,
  then if `m4Ready()` set M4. If mono2 is not pending: set M4 when `m4Ready() ∧ nUiVisible()` has held ≥ 1500 ms after the last
  `users:switched {to:'n'}` (or immediately when the condition turns true while already on {N}'s screens). No time cap (§2.1).
- M5 — due `m5DueAt()`. If `users.current()==='dash'` at due: set `vars.m5HoldPm`, wait for `nUiVisible()` + 1500 ms, max 90 000 ms
  after due, then fire anyway. Fire = `G.audio.gsmTank.pulse({peak:.22, upMs:300, holdMs:1200, downMs:600, arc:true})` +
  `G.audio.sub('S04', {az:70})` → after 2500 ms `G.flag('M5', true)` (clock jumps 00:16). Social reacts to `flag:M5`.
- M6 — when `playMs ≥ m6DueAt()` (and M5): store `vars.climax.m6DuePm`, emit `'m6:due' {prelude: !G.clock.passed('00:22')}` once.
  climax owns what follows. If `G.climax` absent: set M6 directly (stub).
- `factDash`, `factCount` recomputed on every `flag` event. `snow` var recomputed on `clock:min`/`clock:jump`.

**`G.e2.STR`** (exact strings; keys are the API): `pinWrong 'PIN이 올바르지 않습니다'` · `pinLock '{s}초 후에 다시 시도하세요'`
(caller replaces `{s}` 30 → 1 once per second, §4.0) ·
`verify '지문을 대거나 PIN을 입력하세요'` · `verifyTitle '본인 확인'` · `pinCurrent '현재 PIN을 입력하세요'` · `fpDeleteQ '이 지문을 삭제할까요?'` ·
`noSimEmergency 'SIM 없음 · 긴급 통화를 연결할 수 없습니다'` · `noSimCall 'SIM 없음 · 전화를 걸 수 없습니다'` · `connecting '연결 중…'` ·
`btConnected '연결됨 · 미디어 오디오'` · `btCut '2층_스피커 연결 끊김'` · `btNotFound '기기를 찾을 수 없습니다'` · `switching '사용자 전환 중…'` ·
`sendFail 'ⓘ 전송되지 않음'` · `smsSent '인증번호를 문자로 보냈습니다'` · `unrestricted '{MAKER_CONTACT}님을 제한 해제했습니다.'` ·
`noReadReceipt '상대방에게 읽음 표시가 전송되지 않습니다'` · `restrictedNote '이 계정은 제한되어 있습니다. 제한을 해제하면 메시지가 받은 메시지함으로 이동합니다.'` ·
`restrictedBar '제한한 계정입니다'` · `newAcctSend '새 계정을 보호하기 위해 일부 활동이 제한됩니다. 이 기기에서는 메시지를 보낼 수 없습니다.'` ·
`newAcctLimit '새 계정을 보호하기 위해 일부 활동이 제한됩니다.'` · `activityTitle '활동 제한'` ·
`activity '비정상적인 로그인 활동이 감지되어 12월 26일까지 게시물과 댓글을 올릴 수 없습니다. 메시지는 보낼 수 있습니다.'` ·
`tlPaused '이 시간에는 위치 기록이 일시 중지되었습니다'` · `tlNone '이 날짜에는 기록이 없습니다'` ·
`mailSync '계정이 없어 동기화할 수 없습니다 · 마지막 동기화 2026.12.24 18:02'` · `talkOut '다른 기기에서 로그인되어 로그아웃되었습니다 · 2026.11.25'` ·
`reqAccepted '메시지 요청을 수락했습니다 · 오후 7:21'` · `wipe '원격 초기화 중… (요청: 다른 기기)'` · `frp '이전 계정 인증 — 인증 코드를 문자로 보냈습니다'` ·
`share '강수진의 휴대전화 · 사진 4개를 보내려고 합니다'` · `exitAgain '한 번 더 누르면 게임을 나갑니다'` · `noSwitch '이 사용자로 전환할 수 없습니다'` ·
`addUserQ '새 사용자를 추가할까요?'` · `addUserNeed '사용자를 추가하려면 다온 계정이 필요합니다.'` · `needDaon '다온 계정이 필요합니다'` ·
`codeWrong '인증번호가 일치하지 않습니다.'` · `talkNoSend '로그아웃 상태에서는 메시지를 보낼 수 없습니다.'` · `mailNoOpen '계정이 없어 열 수 없습니다'` ·
`newDeviceCode '새 기기에서 로그인하려면 문자로 받은 인증 코드가 필요합니다'` · `offline '인터넷에 연결되어 있지 않습니다'` ·
`seahOnly 'seah_y님은 팔로우하는 계정의 메시지만 받습니다.'` · `blockQ '{MAKER_CONTACT}님을 차단할까요?'` · `blocked '차단한 계정입니다'` ·
`reported '신고해 주셔서 감사합니다.'` · `wifiDelQ 'saemal_rooftop 네트워크를 삭제할까요?'` · `pwEnter '비밀번호 입력'` ·
`trustNetDelQ '신뢰할 수 있는 네트워크에서 삭제할까요?'` · `trustDevDelQ '신뢰할 수 있는 기기에서 삭제할까요?'` · `btDisconnectQ '연결을 끊을까요?'` ·
`noDevices '주변에 기기가 없습니다'` · `fpAdded '지문이 등록되었습니다'` · `fpTouch '화면의 지문 아이콘에 손가락을 대세요'` ·
`fpTouchMany '화면의 지문 아이콘에 손가락을 여러 번 대세요'` · `ghost '원본을 불러올 수 없습니다 · 계정 없음'` ·
`noResult "'{q}'에 대한 검색 결과가 없습니다."` · `noResultMoment "'{q}'에 대한 결과가 없습니다."` · `cloudLogin '다온 클라우드 · 로그인이 필요합니다'` ·
`resume '🔈 소리 다시 켜기'` · `soundCard '소리가 들리지 않으면 무음 모드를 끄고 볼륨을 올려 주세요.'` · `restart2 '2편 진행이 지워집니다. 시리즈 기록은 남아요.'` ·
`unplayed '재생 안 됨'` (voice-message bubble tag `· 재생 안 됨`, §4.1.3/§4.1.4 — rendered by core `voiceBubble`) ·
`loading '불러오는 중…'` (players before their render buffer is ready, §7.1.7) · `recanonQ '이번 플레이의 선택으로 바꿀까요? 다음 편은 바뀐 선택을 기억합니다.'` (§4.10.13).
(Any other dialog/toast text must be a DESIGN screen string; add new system strings here only with a DESIGN reference.)

**`G.sd`** (moved here from ep1 `js/data/talk.js`, same behaviour): `T img bg imgEl tone isSafe waitSafe statusOverlay dayLabel rng pd ymd
day(date, rows, common)` + `note`/`lead` = **no-ops** (DEBUG warn). `G.sd.img` = `G.e2.img`. `G.sd.isSafe` = `G.director.safe('show')`.
Changed in ep2: `G.sd.tone()` is a **no-op** (DEBUG warn) — every notification sound goes through `G.phone.notify` → `G.tones` (ARCH §4.10); `G.sd.day` was a
private helper in ep1 and is now exported with the same signature (`day('2026-12-12', [['them','20:10','text', {extra}], …], common)`);
the ep1 `screen:push` status-bar colour listener in that file is **not** moved (shell owns `statusTheme`). social's `ep2/js/data/talk.js`
must not define `G.sd` (it only reads it), and flow's `ep2/js/main.js` must not define `G.T` / `G.NAME`.
`window.haru` is created by `e2.js` **at load time** when `G.DEBUG` (`window.haru = window.haru || {}`) so later files can add helpers in
their IIFE; `G.e2.init()` only fills core's helpers.

### 4.6 `engine/series.js` (core) — `G.series` (bible §7.6 + DESIGN §9.3; standalone IIFE, no dependency on `G.util`/`G.state`)
```js
G.series.ensure() → rec            // create/migrate/backfill-safe; key 'haru-escape.series.v1'; .bak on parse failure; 8 KB cap; memory mode
G.series.get(path) → any           // 'eps.1.st'
G.series.ep(n) → {st, on, min, hints, src, canon}   // never null (default object)
G.series.s(key) → value            // SERIES_DEFAULTS fallback
G.series.seen(id) → bool ; G.series.sea() → string[]
G.series.stage(key, value)         // writes window.G.state.stage[key] (episode save only) + G.save()
G.series.commit(n, payload?, opts?) → bool   // payload {ep, s, seen}; first completion only unless opts.overwrite; seen OR; last=max; rev+1; immediate save
G.series.patch(fn(rec)) → bool     // read → deep-merge → write; monotone keys protected (done/canon/seen:true never go down, sea ∪)
G.series.backfillEp1() → rec       // bible §7.4 code verbatim, idempotent
G.series.endEp1() → bool           // P-2: reads ep1 state from window.G.state when G.SAVE_KEY==='haru-escape.save.v1' (in-memory —
                                   // the ep1 save is debounced), else localStorage; writes eps.1 src 'live', canon true, s.e1_*, seen.e1_*
G.series.clearAll()                // root screen only
G.series.readOnly() → bool         // future v → reads only, writes no-op
G.series.DEFAULTS                  // SERIES_DEFAULTS (bible §7.2 S1 table + e1 keys); unregistered key writes ignored + console.warn
// multi-tab: 'storage' event → field merge (bible §7.6)
```
Reads of the series record happen **only** in `G.e2.seriesBoot()` (boot), `seriesStart()` (introDone), `commit()` (END), `hookPatch()`
(hook end) and the title screen (flow: `G.e2.ep2Done`). `grep "G.series" ep2/js` must hit only `e2.js` (§10 G); flow calls `G.e2.*`.

### 4.7 `ep2/js/data/e1canon.js` (core) — `G.STORY.e1canon` and `cb.*`
```js
G.STORY.e1canon = { haruLines: [            // ep1 lines every player received (§4.2 중립판 · §9.4) — his ep1 words, not new lines
  { t: '2026-11-24 03:56', text: '{N야}.' },
  { t: '2026-11-24 04:04', text: '배터리 4%네.' }, { t: '2026-11-24 04:04', text: '얼마 안 남았다 우리.' },
  { t: '2026-11-24 04:31', text: '…{N야}?' }, { t: '2026-11-24 04:31', text: '화면 왜 안 보여' }, { t: '2026-11-24 04:31', text: '뭐 했어' },
  { t: '2026-11-24 04:31', text: '다시 켜' }, { t: '2026-11-24 04:31', text: '{N야}' }, { t: '2026-11-24 04:31', text: '대답해' },
  { t: '2026-11-24 04:31', text: '대답해' }, { t: '2026-11-24 04:31', text: '대답해' } ],
  deleted: { t: '2026-11-24 07:02', label: '삭제된 메시지입니다' } };
```
`G.state.cb` = `{_v:1, e1done:bool, min:int|null, knock:'answered'|'four'|'none'|null, alarmDel, trap, vault, ring, manager, jimin, mom, js1: bool}`
computed by `seriesBoot` (§9.3 ① code) and frozen at `introDone` (`seriesStart`). Consumers (render only — never gate progress):
| cb | consumer (owner · where) | effect (§3.20.1 / §9.4) |
|---|---|---|
| `e1done ∧ knock` | media · `data/memos.js` dash memo line 1 | `answered`/`four`/`none` lines |
| `e1done`, `min` | media · memos | `{min}분. 세아는 1년 걸렸는데.` |
| `trap` | media · memos | `*0404# 누른 거 기억해.` |
| `vault` | media · memos | `보관함, 네 사진까지 봤지.` |
| `alarmDel` | media · `data/clock.js` | alarm name `또 지울 거야?` (else `우리`) |
| `ring` | media · `data/gallery.js` | hidden item 2 `rec_voicetalk` 0:07 + S28 |
| `manager` | social · `data/mail.js` | 12-09 mail line `관리실 사칭 번호 신고 덕에 명의자는 찾았어요. 이름만 빌려준 분이었어요.` |
| `jimin` | social · `data/moment.js` script `jTail` | `그날 신고한 거 저예요. 늦어서 미안해요…` / `그날 저는 자고 있었어요. 미안해요.` |
| `mom` | social · script `j0205` | `…그날 이후로 03:33에 전화 안 해요…` / `…아직도 03:33에 깨요. 그래도 괜찮아요.` |
| `js1` | flow · `data/beats.js` B09 → `G.room.playTankGlow({variant: js1 ? 'hand' : 'cap'})` | |
| (runtime) ep1 `threads['talk:haru']` | social · `data/talk.js` `seaRoomMessages()` (§9.4 v1.3 code, `G.settings.e1MyMsgs !== false`) | 윤세아 room |

### 4.8 `engine/core/media.js` (core) — `G.media` (§7.1.5 API, §9.7 Bluetooth simulation)
All in-phone "media playback" (recorder, gallery videos, voice messages) goes through here; alarms, ringtones, notification tones and
world sounds never do (so they can never satisfy C2 — §3.16).
```js
G.media.init()
G.media.play(src, { loop=false, from:'recorder'|'gallery'|'voice', id, offset=0, onEnd, onTime(t) }) → handle
   // src: AudioBuffer | Promise<AudioBuffer|null> | buffer id string ('rec.uri','vid.move','vid.roof','hook.seahY' → G.audio.buffer(id))
   // handle: { id, from, target, playing(), pause(), resume(), stop(), seek(t), position() → s, duration }
   // starting a new play stops the previous one (single media stream, like a real phone)
G.media.out() → 'bt'|'phone'          // btConnected && !musicCut ? 'bt' : 'phone'; switch while playing: 80 ms crossfade (+0.2 s BT latency)
G.media.state() → { playing, from, id, target, pos, vol:{bt, phone} }
G.media.setVolume(target:'bt'|'phone', v:0–100, { source:'ui'|'remote' })   // writes vars btVol/phoneVol; τ 80 ms (ui) / 300 ms (remote)
G.media.getVolume(target) → int
G.media.stopAll()
G.media.cut({ pop=true })             // §7.2 media.cut: 8 ms cut + pop (only if audio is still playing) + flag musicCut + ledState 'off' +
                                      // toast G.e2.STR.btCut (once) + BT disconnected (status-bar ᛒ gone). Called by climax only.
G.media.bt = {
  on() → bool, setOn(bool),           // vars.btOn; off ⇒ disconnect (LED green)
  state() → 'off'|'idle'|'connecting'|'connected'|'gone',   // 'gone' after musicCut or retire() (permanent)
  connect() → Promise<'ok'|'off'|'notfound'>,  // 2.5 s 연결 중… (4 s then 'notfound' when gone) → flag btConnected, ledState 'blue', cue bt.connect
  disconnect(),                       // flag btConnected off, ledState 'green', cue bt.disconnect
  connected() → bool,
  retire(),                           // flow at doorOpened: ledState 'off' (police removed it)
};
// written: btConnected (TOGGLE), btPlaying (TOGGLE = target 'bt' && playing), musicCut, btOn, btVol, phoneVol, ledState
// bus: 'media:play' {id, from, target} · 'media:stop' {id, from, reason:'end'|'stop'|'cut'|'replace'} · 'media:vol' {target, v, source}
//      'media:out' {target} · 'bt:change' {state} · 'bt:cut'
```
DSP is built by audio: `G.audio.mediaChain(kind:'phone'|'bt') → { input:AudioNode, setVolume(v, tauSec), dispose() }` (phone chain → bus
`music`; bt chain → bus `mediaOut` → `A.at(115,{el:-30, dist:12, via:'window', ir:'irRoof'})` + slap180, §7.1.5 gain law/calibration).
`c2Src` mapping used by climax: `from === 'recorder' ? 'rec' : 'video'` (gallery videos **and** voice messages = non-music-box media →
'그 소리' wording; ARCH §9 G7).

### 4.9 Users, security, phone shell (shell)
```js
// engine/core/phone.js
G.users = {
  current() → 'n'|'dash',             // vars.user
  switching() → bool,
  switchTo(id, { instant=false }) → Promise<void>, // 2 s full-screen shell (avatar + STR.switching + cue user.switch) → target lock screen.
                                      // First switch toward '—' before M2: G.e2.requestM2('dashSwitch') at shell start (boot chime over it).
                                      // bus 'users:switching' {from,to} → 'users:switched' {from,to}
                                      // Closes the leaving user's app stack (G.phone.closeAll(true)), the QS panel and a camera-mode room;
                                      // the keyboard closes; banners are suppressed during the 2 s shell (§5.4 셸 5). Eye-mode views are untouched.
  forceN() → Promise<void>,           // ending (doorOpened / resume): 2 s shell if current is '—', lands on {N} HOME (no lock screen)
  canSwitch(id) → bool,               // 'dash': row not drawn while doorOpened ∧ ¬END; grey + STR.noSwitch after stage.e2_dash==='locked'
  unlockDash(pin) → bool,             // '0310' exact → first time sets M3 (+ 'users:dashUnlocked'); else STR.pinWrong; every 5 fails → 30 s countdown
  lockDash() → Promise<void>,         // 01:20 chip: shows 설정 › 사용자 › — with `이 사용자로 전환 허용` turning (꺼짐) for 2 s, then closes
};
G.phone.user = G.users.current; G.phone.switchUser = G.users.switchTo;   // aliases (DESIGN §9.1 names)
G.phone.init(); openApp(id, params); push(node, opts); pop(); back(); home(); closeAll(); top(); stackDepth()   // ep1 API kept
   // push opts (ep1): { onBack() → true to consume, onClose(), onResume(), anim:'slide'|'up'|'fade'|'none', appId } → entry; bus 'screen:push' entry
G.app(id, { name, icon:{bg, svg}, open(params), badge(user) → int })   // ep1 registry (engine/core/phone.js) — home placement/dock/hidden
   // come from G.EP.HOME[user], not from the def. name = ARCH §4.2 label. badge only on {N}'s home (moment 1 = unread N01 · alerts 1 = N03 unread).
G.apps                                // ep1 registry object {id: def}
G.ui.screen({ title, sub, back=true, right:[Node], theme:'light'|'dark', cls, bodyCls, body:Node, footer:Node, header }) → section
   // ep1 builder kept verbatim (node.body, node.head; header back button → G.phone.back(), data-qa 'nav.back')
G.ui.list([{ title, sub, meta, icon, onClick, disabled, chevron, cls, qa }]) → div.list   // ep1 builder kept; row data-qa = it.qa
G.phone.canBack() → bool              // false on home with nothing open (Esc → pause)
G.phone.pushBack(fn) → remove()       // back-handler stack checked FIRST by G.phone.back() (Android back, Esc): topmost fn() returning true
                                      // consumes. Used by flow (notebook open → close it; ending cards/credits → consume; pause → close),
                                      // room (eye views: consume; camera mode: room handles its own close), core keyboard (close keyboard).
G.phone.dismissModals()               // resolves every open dialog/sheet/verify/volume/QS/near-share with null (as if backed out) — room
                                      // forceView (M7, M8) and flow ending call it before taking the screen
G.phone.modalOpen() → bool            // any dialog/sheet/verify sheet/near-share open (director S9)
G.phone.isLocked() → bool ; G.phone.setLocked(on)
G.phone.renderHome()                  // from G.EP.HOME[G.users.current()]; emits 'home:show' {user} whenever the home is visible
G.phone.notify({ app, title, body, user='n', chat, route, when, silent, coalesce=true, vibrate, id, banner=true, gainDb=0 }) → { id, banner:bool }
   // stored per user. user ≠ current → no banner/sound; bundled silently on that user's lock screen / panel later.
   // current: chat open (G.moment.isOpen(chat)) → no banner, G.tones.play('inapp');
   //          else banner + G.tones.play(G.tones.for({app, chat}), {gainDb}) unless vars.soundMode/dnd mute it ('vibrate' mode → vibrate
   //          only); same chat < 10 s → one sound; 4th+ tone of the same chat → banner + vibrate only. coalesce:false = social N06–N08
   //          (three tones 2.5 s apart, §3.12). banner:false = sound routing only, nothing stored or drawn (social N09 — §4.8).
   // id = the DESIGN N-number ('N05', 'N06'…'N08', 'N10:<msgId>', 'N10p:<msgId>' (N10′), 'N11:<msgId>', 'N16', 'N17'); seeds 'N01'–'N03'.
   //   Re-notifying an existing id updates it (no second entry). data-qa 'banner:<id>' / 'notif:<id>' / 'lock.notif:<id>' use this id.
   // G.state.notifs entry: { id, user, app, chat, title, body, when /* '오후 10:50' shown text */, time /* in-game ms */, route, read:false }
   //   title/body are stored UNEXPANDED (raw data strings with tokens) and run through G.T at render — no player/maker name may reach
   //   localStorage (§10 F dump test). Same rule for every owner's saved state (threads, vars.*): store ids / tokens, never G.T output.
   //   (N01–N03 are seeded by shell on flag:gotPhone from G.STORY.users.n.seedNotifs, silent, idempotent by id.)
   // bus 'notify' n · 'notify:shown' {id} (banner actually rendered)
G.phone.dialog({title, text, buttons:[{label, value, style}]}) → Promise<value> ; toast(text, ms) ; overlay(node, opts)   // ep1
G.phone.sheet({ title, text, body:Node, buttons:[{label, value, style}], qa }) → Promise<value>   // bottom system sheet
G.phone.nearShare({ from:'강수진의 휴대전화', count:4 }) → Promise<'accept'|'decline'>   // cue nearby.chime; STR.share; [거절] [받기]
G.phone.volume({ focus:'media' })    // §4.6.7 panel; header `미디어 · 2층_스피커` when G.media.out()==='bt' else `미디어 · 이 휴대전화`;
                                     // ints 0–100, ←/→ 5 %, wheel → G.media.setVolume(source 'ui'); other sliders decorative
G.phone.wifi = { on() → bool, setOn(bool), connected() → bool,   // connected = on ∧ 'saemal_rooftop' ∈ vars.wifiSaved
                 forget(ssid), join(ssid, pw) → bool,            // 'saemal_rooftop' + 'saemal0601'
                 restore() → bool };                             // ending 01:50: re-add + on; true if it changed anything
   // 'Wi-Fi 자동으로 켜기': 90 000 ms (playMs) after setOn(false) → setOn(true) (sched 'shell:wifiAuto'); bus 'wifi:change' {on, connected}
G.phone.quickPanel() ; statusTheme(t) ; setWallpaper(src) ; route({app, params})
// Status bar (left→right): ⏸ hit area 44 px (→ G.hooks.call('pause:open')) · time G.clock.hm() · … · `SIM 없음` · ᯤ + `saemal_rooftop`
//   (only while G.phone.wifi.connected()) · ᛒ (only while btConnected) · battery G.battery()%. No cast/location icons. Tap (outside ⏸) or
//   pull from 8–40 px → quick panel. Long-press does nothing.
// Quick panel: header `23:12   12월 24일 목요일   ⚙` (live clock) · tiles G.EP.QS.tiles: Wi-Fi (tap = G.phone.wifi.setOn toggle, label
//   `Wi-Fi  saemal_rooftop`) · 블루투스 (tap = G.media.bt.setOn toggle; long-press 0.5 s or label tap → device sheet; label `2층_스피커` while
//   connected) · 손전등 (user {N}: close QS → G.room.open({mode:'camera', flash:true, fromLock:G.phone.isLocked()}), or G.room.flash(true)
//   when the room is already open in camera mode; user '—': tile toggles visually only — §5.3) · brightness bar (decor) · user row `[{N}] [—] ＋`
//   (never while locked; current user outlined; `[—]` omitted while doorOpened ∧ ¬END; grey + STR.noSwitch when e2_dash 'locked';
//   drawing it ⇒ flag dashSeen + bus 'qs:users'; ＋ → STR.addUserQ → STR.addUserNeed) · notifications of the current user.

// engine/apps/lock.js
G.lock = {
  init(), show(user='n', { mode:'normal'|'hook', notifs, onOpen(notif|null) }), hide(), isShown() → bool,
  // {N} normal: trustState 'network' → `🔓 신뢰할 수 있는 네트워크에서 잠금 해제됨`, 'device' → `🔓 신뢰할 수 있는 기기에서 잠금 해제됨`,
  //   null → no line (swipe → PIN entry `PIN 입력` + finger icon). Swipe ≥ 80 px / ↑ / Enter / desktop drag anywhere. Finger hold 0.8 s.
  //   Notification tap → route. First entry into an unlocked {N} screen ⇒ G.flag('M1') (requires gotPhone).
  //   [카메라] → G.room.open({mode:'camera', fromLock:true}) (not M1). [긴급 통화] → G.hooks.call('phone:emergency').
  //   bus 'lock:show' {user, mode} · 'lock:unlock' {user, how:'swipe'|'finger'|'notif'|'pin'}
  //   Long-press on the lock surface → widget preview sheet (§4.6.4, read-only). PIN entry = G.ui.pinPad (any code → STR.pinWrong).
  // hook mode: §4.1.8 layout (date `12월 25일 금요일`, clock 03:33, trust line by trustState(), same widget line); lists only the
  //   notification with id 'N17' (raised by flow hook via G.phone.notify — banner over the lock); tapping it, or the open gesture
  //   (swipe if trustState() ≠ null, else finger hold) → onOpen(notif|null) — never the home. [카메라] / [긴급 통화] behave as in normal
  //   mode ("M1과 같은 잠금화면", §3.19 ⑥) and return to the hook lock when closed.
};

// ep2/js/apps/security.js
G.security = {
  init(),
  verify({ reason, pinOnly=false }) → Promise<bool>,  // sheet STR.verifyTitle / STR.verify + finger hold (always ok for {N}) + [PIN 사용] (always wrong);
                                                     // pinOnly: STR.pinCurrent, no finger icon, always fails. '—' user: PIN only.
  fingerAuth: verify,                                // alias (§5.4 name)
  trustState() → 'network'|'device'|null,            // network = wifi connected ∧ saemal_rooftop ∉ smartGone; device = btConnected ∧ 2층_스피커 ∉ smartGone
  autoUnlocked() → bool, smartUnlocked: autoUnlocked,
  deleteFinger(id) → Promise<bool>,                  // §3.4 incl. last-own-finger protection; 'f2' ⇒ fingerDeleted + stage.e2_finger='deleted'
  removeTrusted(id),                                 // → smartRemoved, vars.smartGone
  open(screenKey),                                   // ARCH §4.22 keys
  predict(user, token, ctx) → [{w, his, seed}],      // registered as hook 'kbd:predict'
};
// bus 'security:finger' {ok, where} · 'security:screen' {key}
```

### 4.10 `G.tones` (audio · `ep2/js/data/tones.js`)
```js
G.tones = {
  list: [ {id:'dash', label:'—', sub:'추가한 소리 · 2026.11.25', cue:'him.tone'}, {id:'water', label:'물방울', cue:'tone.drop'},
          {id:'toktok', label:'톡톡', sub:'(기본)', cue:'n.tone'}, {id:'bell', label:'종소리', cue:'tone.chime'} ],
  getDefault() → id, setDefault(id, { preview=true }),     // vars.toneDefault; id ≠ 'dash' ⇒ flag toneRestored; plays it once
  getChat(chat) → id, setChat('fake', id),                  // vars.toneChatFake; 'seah_y' always 'dash' (unchangeable)
  for({ app, chat }) → id|null,                             // chat 'seah_y' → 'dash'; 'fake' → toneChatFake; app 'alerts' → null; else toneDefault
  play(id|'inapp', { ledger=true, vibrate=true, gainDb=0 }), // id 'dash' + ledger ⇒ vars.dir.himTone++ (DEBUG warn > 11); vibration §7.1.7
                                                            // callers: shell notify (all app notifications incl. social N09 via banner:false,
                                                            // flow B07 and hook N17 — both through G.phone.notify), shell settings previews
  preview(id, { screenKey }),                               // settings preview; same screenKey revisit ⇒ silent (his previews ≤ 2)
};
```

### 4.11 Keyboard + prediction (core `keyboard.js` ↔ shell provider)
```js
G.ui.field({ placeholder, mode:'ko'|'en', password=false, predict=true, ctx, numRow=true, onSubmit(v), onChange(v), maxLength,
             submitLabel, qa }) → { node, value, set(v), insert(text), focus(), blur(), clear() }
G.ui.showKeyboard(field) ; G.ui.hideKeyboard() ; G.ui.keyboardOpen() → bool ; G.ui.focusedField() → field|null
// Predict bar iff predict && !password && focused && !(G.vars('kbdPredictOff')||[]).includes(G.users.current()) (설정 toggle — §5.4 S5).
// On change: token = text after the last space/newline (incl. composing syllable);
// words = token ? (G.hooks.call('kbd:predict', G.users.current(), token, ctx) || []) : []  → ≤ 3 cells, left = most frequent.
// A word drawn ≥ 250 ms continuously → bus 'kbd:shown' {user, ctx, words:[{w,his,seed}]} (once per word per focus).
// Tap cell → replace token with w + ' '. Desktop Ctrl+1/2/3 (undocumented). Esc is NOT handled here (main.js owns Esc).
// bus 'keyboard' (true|false). G.ui.pinPad never creates a predict bar (no .kb-predict in its DOM).
// ctx: 'memo' 'browserSearch' 'settingsSearch' 'momentSearch' 'dm:jimin' 'dm:fake' 'dm:real' 'dm:dash' 'jiminAnswer' 'fpRename' 'btRename'
//      'nbMemo' 'wifiPw' 'daonId' 'daonPw' 'smsCode' (talk 다시 로그인 · settings 계정 추가 · cloud login — password ones never predict)
```
Provider rules (shell, §9.6 ① corrected per ARCH §9 G3): user `n` prefix table §3.5/§4.6.5, `dash` §3.10/§4.6.5; `momentSearch` never
predicts `{MAKER_CONTACT}` letters; `nbMemo`/password never call the hook. Shell listens `kbd:shown`: `his` words of user `n` →
`kbdHisSet`/`kbdHisSeen`; ≥ 3 kinds ⇒ `factKbd`; seeds `2구 방음 식구` → `kbdSeedSeen`, ≥ 2 ⇒ `seenKbd`.

### 4.12 Widgets (core `widgets.js`; styles in `ep2/css/core.css`)
```js
G.ui.holdButton({ ms=800, size=64, ring=true, onDone, onCancel, qa, label }) → node   // pointer events; cancel on > 10 px move; Space when focused;
                                                    // touch-action none; no contextmenu; G.audio.vibrate('fp') on done
G.ui.voiceBubble({ id, dur, getBuffer:() => Promise<AudioBuffer|null>, subs:[{t0, t1, text}], unplayed, from:'voice',
                   zoom=false, onFirstPlay, onTime(t), onEnd, onZoom({t0, t1}), qa }) → { node, play(), pause(), playing(), pos() }
   // 🎤 · ▶/❚❚ · waveform · 0:00 / 0:14 · no speed button · no transcript. No buffer ⇒ bar still runs dur s, subs still shown.
   // unplayed ⇒ `· {STR.unplayed}` + blue dot until the first play (then onFirstPlay). getBuffer still pending at ▶ ⇒ STR.loading in place
   // of the time label until it resolves (null ⇒ silent run). Subs are drawn inside the bubble (S19/S22 text source = data subs).
   // Plays via G.media.play(buffer, {from}). zoom: pinch / double-tap 2×→4× / wheel / '+'; onZoom = visible window.
G.ui.framePlayer({ id, frames:[{key, t0, t1}], dur, getBuffer, subs:[{t0, t1, text, kind:'info'|'mood'}], from:'gallery',
                   onReach:{ '10.0': fn }, onTime, onEnd, qa }) → { node, play(), pause(), seek(t), pos() }
   // image frames + WebAudio track; onReach fires only when PLAYBACK crosses t (not seek). Missing frames ⇒ black.
   // shows `출력: 이 휴대전화` / `출력: 2층_스피커`; 🔊 → G.phone.volume(). Mood subs only when G.settings.subs==='all'.
G.ui.pinPad({ length, dots=true, maxLength=16, submitLabel:'확인', onSubmit(code) → Promise<true|false|string>, title, sub, theme, qa })
   → node with node.reset() · node.setMsg(text) · node.setBusy(bool)   // ep1 return shape kept. length given ⇒ auto-submit at length (ep1);
   // dots:false ⇒ no length, [확인] submits ('—' pad). A string result is shown via setMsg. Keys data-qa 'pin.key:<d>' / 'pin.ok' / 'pin.del'
   // (lock {N} pad: caller passes qa:'lock.pin' ⇒ 'lock.pin.key:<d>' / 'lock.pin.ok'). Busy countdowns (30 s) are the caller's (setBusy+setMsg).
   // silentError:true ⇒ a wrong answer still shakes + shows the message but plays no sfx.error / vibrate — the caller gives its own
   // feedback (lock.js / security.js pinError(): cue 'pin.error' = tone + [80], or vibrate('pin') alone when sound cannot play).
G.ui.inputActive() → bool             // keyboard open ∨ a G.ui.pinPad node is attached to #screen and visible (director S1 — §6.1.3 'PIN 패드 포함')
G.ui.zoomViewer(src, o) ; G.ui.typing() ; G.ui.onLongPress(node, fn, ms) ; G.ui.waveform(canvas, analyser, color)   // ep1
```

### 4.13 Audio (audio) — `G.audio`
```js
G.audio.init() ; unlock() → Promise<bool>      // idempotent; AudioContext create/resume + iOS navigator.audioSession.type='playback' + silent tick
G.audio.ok() ; ctx ; bus(name) ; setEnabled(on) ; setVolume(v) ; setYaw(deg) ; getYaw()
G.audio.at(az, { dist, el, via:'inRoom'|'door'|'doorDirect'|'window'|'wall', ir, wet, life, bus:'world' }) → AudioNode|null   // §7.1.3
G.audio.cue(id, opts) → handle|undefined       // THE entry point for every §7.2 cue (table below); safe before unlock (no-op, returns undefined)
G.audio.amb(id, on, { fade }) ; tension(T) ; droneDetune(cents, sec) ; roomLP(hz, ms) ; heartbeat(on, { bpm })
G.audio.silenceDrop(ms, { keep:['mediaOut'] }) ; G.audio.doorOpen(ms|'hold') ; G.audio.doorClose()   // lift 'door'/'window' filters (M0 p2_door_open, B20 6 s)
G.audio.gsmTank = { start(p=.08), set(p, rampMs), pulse({ peak, upMs, holdMs, downMs, arc }), fadeTo(p, ms), level(), started() }
   // 70° · 6 m · via window, never moves. start() is idempotent; pulse() before start() starts it at .08 after the pulse (B09′ rule).
   // started() is persisted by audio in vars.au (resume re-starts it); S01 is shown by whoever starts it first (director B04 / B09′).
G.audio.drill = { start(), wobble() → Promise (1.5 s), stopC2() (spin-down 0.12 s + ping), stopFallback() (finish rotation), playing() → bool }
G.audio.box15 = { start() → { stage('closed'|'doorOpen'|'inHand'), cut() /* 30 ms mid-bar */, stop() } }   // cold-open alarm (rec.uri @15 %)
G.audio.buffer(id) → Promise<AudioBuffer|null>   // offline renders 'rec.uri' 'vid.move' 'vid.roof' 'hook.seahY' 'ringHaru7' (cached; built in
                                                 // idle slices after unlock) + alias 'jiminVM' → G.audio.jiminVM(). Every data `buffer:` field
                                                 // (gallery, recordings, moment jvm/hookVM) is one of these ids; G.media.play(id) resolves through here.
G.audio.voice(id) → Promise<AudioBuffer|null>    // 'v2_kang_door' 'v2_him_breath' 'v2_jimin_vm' 'v2_jimin_vm_a' 'v2_jimin_vm_b'
                                                 // via G.AUDIO_FILES[id] || G.AUDIO_BASE+id+'.wav' (ids = G.AUDIO_FILES keys, ARCH §5.1)
G.audio.jiminVM() → Promise<AudioBuffer|null>    // PLAYER_NAME==='하루' → 'v2_jimin_vm'; else 'v2_jimin_vm_a' + formant '{N} 씨가' + 'v2_jimin_vm_b' (0.12 s overlap)
G.audio.playVoice(id, { az, dist, via, onEnd }) → handle   // spatial one-shot (B20 Kang, B14 breath → fallback cue 'breath.out')
G.audio.mediaChain(kind:'phone'|'bt') → chain    // for G.media
G.audio.sub(subId, { az, text, ms }) → void       // G.SUBS lookup; G.settings.subs 'info'|'all'; 0.5 s after a mono line; c2Src video wording;
                                                 // renders G.room.dirSub(text, az, ms) when the room is open, else G.fx.sub(text, ms)
G.audio.vibrate(key)                             // 'm2' [60,80,60] · 'him' [60,60,60] · 'n' [40] · 'fp' [15] · 'pin' [80] · 'drill' [30] · 'b14' [90,40,160]
G.audio.sfx.{tap,key,back,msgSend,error,unlock,whoosh,pen,pageTurn}()    // ep1 UI cues kept
```
**Cue table** (`G.audio.cue(id, opts)` unless noted). Callers also call `G.audio.sub(id)` where an S-id is listed.
| cue | opts | caller(s) | § | subtitle (caller shows) |
|---|---|---|---|---|
| `amb.roofWind` `amb.room601` `amb.tank` `amb.cityFar` (`amb()`) | on/off | flow scenes (start B01); director (END −9 dB, M8 drone 0) | §7.2 A | — |
| `amb.snow` | on | flow director W04 | §6.2 | — |
| `amb.drone` + `droneDetune` | — | flow director (M1–M8, −100 cent on '—') | §6.1.5 | — |
| `m.gust` `m.carFar` `m.pipe` `m.tarp` `m.roomTick` | `{az}` | flow director (micro) | §6.1.6 | S24 mood (m.gust) |
| `gravel.step` | `{surface:'dry'|'snowy'|'deep', n, from:{az,dist}, to:{az,dist}, dur, gainDb}` | flow scenes (B01); room climax (B12 B13 B14 lure fallback B18) | §7.2 B | S06 / S13 |
| `cloth.rustle` | — | flow scenes (B01 4.0 s) | §3.1 | — |
| `switch.click` | `{az, dist}` | room climax (B12, 00:50); flow ending (B20 room light) | §7.2 B | S23 mood |
| `rail.creak` · `door.far` | — | room climax (B18) | §6.2 | S16 |
| `church.bell` | `{n, gap:3.2}` | flow scenes (B01 ×2); flow director (B07 ×12) | §7.2 B | S03 (B07 first strike) |
| `handle.jerk` + `sting.soft2` | `{less}` | room climax (B14 4.8 s) | §6.4-① | S11 |
| `bell.small` | `{az:270|90}` | flow scenes (earphone test) | §7.2 G | — |
| `him.tone` `n.tone` `tone.drop` `tone.chime` `msg.inapp` | — | **only through `G.tones.play/preview`**, which only shell calls (`G.phone.notify` for every notification — flow B07/hook N17 and social N09 go through notify; settings previews) | §7.2 D | — |
| `boot.chime` · `buzz.desk` | `{gainDb}` | flow director (B05; W02 −8 dB) | §6.2 | S02 (az 270) |
| `user.switch` | `{dir:'toDash'|'toN'}` | shell (switch shell) | §7.2 D | — |
| `fp.ok` · `pin.error` | — | shell (lock, security) | §7.2 D | — |
| `bt.connect` · `bt.disconnect` | — | core media | §7.2 D | — |
| `nearby.chime` | — | shell (`nearShare`) | §7.2 D | — |
| `doorlock.close` | `{soft}` | flow scenes (B02); flow ending (B20 door closes, `soft:true`) | §3.1 · §6.2 B20 | — |
| `amb.room601` warm (`G.audio.amb('room601', true, {warm:true})`) | — | flow ending (L8 room light at doorOpened) | §7.2 A | — |
| `doorlock.open` | — | flow ending (B20) | §3.17 | S26 |
| `media.cut` | — | core media (`G.media.cut`) | §7.2 E | S14 (climax shows) |
| `siren.police` | `{mode:'arrive'|'fadeIn'}` | room climax (M7) | §7.2 F | S15 |
| `radio.squelch` | — | room climax (B16, W06 every 12–30 s) | §7.2 F | S17 (first) |
| `boots.snow` | `{n, from, to, slow}` | room climax (B16); flow ending (B20) | §7.2 F | — |
| `steps.stairs` | — | flow ending (02:12) | §6.2 W07 | — |
| `piano.two` | — | flow ending (credits) | §7.2 F | S25 mood |
| `breath.out` | — | audio internal (fallback) | §7.2 C | — |
| `G.audio.drill.*` | — | room climax | §7.2 C | S07 S08 S10 |
| `G.audio.gsmTank.*` | — | flow director (B04, B09′, B09) · core e2 (M5 pre-buzz) · social (fake reply 0.5 s) · room climax (B18 fade) | §7.1.4 | S01 (director, first GSM) · S04 (e2) · S05 (social) |
| `G.audio.box15` | — | flow scenes (B01/B02; stage from `room:closeup`/`alarm:ringing`) | §7.2 E | S00 (scenes, once after 16 s) |
| `G.audio.heartbeat(on, {bpm})` | 72 → 84 bpm with the drill at 0.6 m | room climax (on at M6 when T ≥ .8 ∧ `audioMode==='ear'` ∧ ¬less; off at B14 t = 3.0 and at siren start) | §6.1.5 | — |
| `G.audio.silenceDrop(1800, {keep:['mediaOut']})` | less: 300 | room climax (B14 t = 3.0) | §6.4-① | S10 |
| `G.audio.tension(T)` · `droneDetune(±100, s)` · `roomLP(hz, ms)` · `amb()` gains | — | flow director only (T every tick; −100 cent on `users:switched {to:'dash'}` 2 s, back 4 s; B08 `roomLP(1200, 30000)`, less 20 000; M8 drone → 0 over 8 s; END wind −9 dB) | §6.1.5 · §6.2 | — |
| `G.audio.doorOpen(ms|'hold')` · `G.audio.doorClose()` | 6000 / 'hold' | flow ending (B20, 6000); flow scenes (M0: `doorOpen('hold')` on `room:closeup {id:'p2_door_open'}`, `doorClose()` at B02) | §7.1.3 | — |
| `playVoice('v2_kang_door', {az:0, dist:.5, via:'door'})` | — | flow ending (B20) | §7.3 | S18 |
| `playVoice('v2_him_breath', {az:0, dist:.3, via:'door'})` | — | room climax (B14 5.6 s) | §6.4-① | S12 |
| outside music box (bt chain) | — | core media | §7.1.5 | S09a/b/c on play start + volume step (climax shows) |
`hinge.none` is not a cue: scenes (B01 10.5–13.0 s) and climax (B17) create **no** new source in that window (QA asserts).

### 4.14 Subtitles — `G.SUBS` (audio · `ep2/js/data/subs.js`)
`G.SUBS = { S00:{ text:'♪ (작게 — 오르골)', kind:'info', ms:3000, az:0 }, S01:{ text:'[지지직… 아주 작게]', kind:'info', ms:2400, az:70 }, … }`
— copy §7.4 verbatim (S09 → `S09a/S09b/S09c` for `< 50 / 50–89 / ≥ 90`; S14 has `S14v` `♪ (소리가 뚝 끊긴다)`; S09/S14 say `소리`
instead of `오르골` when `vars.c2Src==='video'`). Player-bound subtitles (S19 VM phrases, S20, S21, S22, S24 video mood, S27, S28) are
drawn **inside** players by their owners; `G.SUBS` is still their text source. Intentionally empty: cold open 0–16 s, B03, B09, **B17**,
notification tones, the hook's 삐요. S18 is stored with the name token: `(문 너머) {police} 강수진입니다. 밖은 확인했어요. 천천히 여셔도 돼요.`
(the audio file itself says `서강경찰서` — §9.6 exception). `G.audio.sub` expands every text through `G.T`.

### 4.15 Room (room) — `G.room`, `G.ROOM`, camera
```js
G.room.init()
G.room.open({ mode:'camera'|'eye', view:'r2_door'|'r2_window'|'r2_bed'|'r2_desk', sub, fromLock, flash=false, onClose }) → api
   // camera mode = the `camera` app screen pushed on #app-stack (user {N} only; from the lock screen it closes back to the lock, no M1)
G.room.close() ; isOpen() → bool ; current() → { mode, view, sub, zoom, closeup, flash }
G.room.flash(on?) → bool               // camera-mode flashlight (sets when on is given, returns the state); QS 손전등 tile uses it
G.room.forceView({ view, sub, mode:'eye', lockMs=0, pinch=false, handle=false, until }) → Promise<{ via:'handle'|'until'|'closed' }>
   // takes over from any user/app: G.ui.hideKeyboard() + G.phone.dismissModals() first, layer .rm2-eye (z 45), registers G.phone.pushBack
   // (consumes back), restores the previous screen afterwards. The notebook stays reachable on top.
   // M7 (climax): { view:'r2_window', lockMs:6000, pinch:true, until: () => G.clock.passed('00:47') && beamsDone }
   // M8 (ending): { view:'r2_door', handle:true } → resolves when the handle hotspot is tapped
G.room.eyeM0({ resume=false }) → Promise<void>  // M0: r2_door eye view → door → p2_door_open → box_top close-ups → phone tap →
                                    // G.hooks.call('alarm:ring','a2310') → on resolve sets gotPhone (boxNote/boxHand/polaroidSeen/seenNote when
                                    // touched) → resolves. resume:true = reload after the cold open reached the eye view (§6.1.8 'M0 뒤 · gotPhone
                                    // 전'): opens straight on r2_door (no fade-in), flow restarts box15 at stage 'closed' (40 s loop)
                                    // Emits 'room:closeup' {id:'p2_door_open'} when the door opens (flow sets box15 'doorOpen').
G.room.dirSub(text, az, ms) ; G.room.refresh() (also hook 'room:refreshLayers')
G.room.playTankGlow({ variant:'hand'|'cap', holdMs }) → Promise<bool>   // B09 visual; false if r2_window/roof_tank not visible
G.room.handleJerk({ less }) ; G.room.tankAjar() → Promise ; G.room.beams('direct'|'sweep') → Promise
G.room.police(on) ; G.room.lightsOn() ; G.room.doorGap('police'|'torch'|null) ; G.room.closeup(id) → Promise
// bus 'room:open' {mode} · 'room:close' · 'room:view' {view, sub, zoom} · 'room:zoom' {z} · 'room:spot' {id} · 'room:closeup' {id} · 'room:shot'
```
Live-layer inputs (room listens; never polls other owners): `var:snow`, `flag:roofLight` / `flag:off:roofLight`, `flag:peepholeTaped` /
`flag:off:peepholeTaped`, `var:footprints`, `var:ledState`, `flag:tankGlow`, `flag:doorOpened`, `clock:min` (wall-clock hands, newphone
0 %/2 %/wipe/boot/FRP by clock ∧ M2), `clock:jump` (snow fade 8 s instead of 60 s). Captions (§4.7.6) use the same state (snow, roof
light, LED colour, footprints `C2 ∨ lureCount ≥ 1`, tank door after 00:44/00:47/01:10). Yaw (§7.1.2): views `[r2_door, r2_window, r2_bed,
r2_desk]` → `index·90 + (panX − .5)·50`; `roof_tank` 70°, `roof_rail` 115°, close-ups inherit, M7 forced 90°; room calls `G.audio.setYaw`.
Camera mode exists only for user `n`; eye-mode views are user-agnostic. Eye mode toggles `#screen.eye-mode`.

### 4.16 Climax (room · `ep2/js/climax.js`) — `G.climax`
```js
G.climax = {
  init(),          // sched handlers 'climax:*'; listens 'm6:due', 'flag:M0' (roofLight on), 'clock:min' (00:22 B12, 00:23 B13, 00:50 roof light)
  state() → { phase:'pre'|'prelude'|'drill'|'b14'|'siren'|'m7'|'after', lureCount, wobbles, sirenAtPm },
  safeZone() → bool,   // true during B14 t ∈ [0, 45 s] (director S8)
  resume(),            // §6.1.8 재개표 rows (drill, B14, lure, M7) — called by flow main.js
};
// C2 watcher (100 ms, from M1): G.media.state() target 'bt' ∧ playing ∧ btVol ≥ 90 for 1.5 s (visible time).
//   M6 ∧ ¬M7 → C2: B14, clock jumps C2/drillStop/musicCut, siren at C2+33 s, sirenBy 'c2', c2Src.
//   ¬M6 → early lure: lureEarly, lureCount++ (1: +60 s G.media.setVolume('bt',15,{source:'remote'}); 2: +45 s G.media.cut()); vars.climax.lureEarlyPm.
// wobble: every 'media:play' with target 'bt' during the drill → drill.wobble(), wobbles++, S08. S09a/b/c on bt play start / volume step.
// C1b (social's flag) → G.clock.jump('C1b'). Siren due = G.e2.sirenDueAt(); at siren: M7, sirenBy, forced window (B15 B17 B18 B16 W06).
// bus 'climax:prelude' · 'climax:drill' {on} · 'climax:wobble' · 'climax:lure' {n} · 'climax:c2' · 'climax:siren' {by} · 'climax:beat' {id}
```

### 4.17 Notebook (flow) — `G.notebook`, `G.OBJECTIVES`
```js
G.notebook = { init(), open(tab='todo'|'hint'|'memo', objectiveId?), close(), isOpen() → bool, refresh(), current() → [objective],
               show(on),                                                     // ep1: ✎ visible (hidden on title/warning/recap/credits/check)
               note(){}, lead(){}, leadDone(){}, flash(){}, autoHint(){} };   // the last five are no-ops (DEBUG warn)
// open ⇒ G.phone.pushBack(() => (G.notebook.close(), true)); stats line `플레이 {m}분 · 힌트 {n}회` from playMs / hintsUsed.
// bus 'notebook:open' {tab} · 'notebook:close' · 'hint' {id, tier}; done → G.audio.sfx.pen() once, no toast
G.OBJECTIVES = [{ id, title: string | () => string, optional, show() → bool, done() → bool, hints:[T1, T2, T3] }]   // ARCH §5.12
```
Always reachable (✎ top-right, also over dialogs/switch shell/climax/eye views). Memo tab = `G.ui.field({predict:false, ctx:'nbMemo'})`,
stored only in `vars.nb.memo`. After M7, unfinished `fake real where door` turn grey silently (hints stay readable).

### 4.18 Director (flow) — `G.director`, `G.BEATDATA2`
```js
G.director = {
  init(), start(), stop(),
  safe(kind:'show'|'mono'|'world'|'jump') → bool,   // §6.1.3 policy
  zones() → { S1…S10: bool },   // S1 G.ui.inputActive() (keyboard/field focus, PIN pads) · S2 G.notebook.isOpen() · S3 mono/recap showing
                                 // (mono:show…mono:hide) · S4 G.users.switching() · S5 G.media.state().playing ∧ from ∈ {'voice','gallery'}
                                 // · S6 pm(M0…M5)+20 s · S7 pm(toneRestored)+40 s · S8 G.climax.safeZone() or pm(tankGlow)+45 s ·
                                 // S9 G.phone.modalOpen() · S10 M8+ (until HOOK). Pause menu open ⇒ the director does not tick at all.
  mark(id), fired(id) → pm|null, // owners running a record call mark(id) → vars.dir.fired[id] = playMs; bus 'dir:beat' {id}
  spend(id) → bool,              // JS budget vars.dir.jsSpent.{b09,b14}
  T() → number,                  // tension §6.1.5 (director also calls G.audio.tension(T) and sets --vig on #screen)
  hold(name, on),
};
```
Record format (`ep2/js/data/beats.js`, `G.BEATDATA2 = { beats:[…], micro:[…], tension:{M0:.10, M1:.15, …} }`) = §6.1.2 + `owner`:
```js
{ id:'B09', cls:'dread', kind:'show', owner:'director',
  when:  (s) => s.flag('M4') && s.pm() >= s.pmOf('M4') + 30000 && ['r2_window','roof_tank'].includes(s.room.view),
  until: (s) => s.pm() >= Math.min(s.flag('M5') ? s.pmOf('M5') + 90000 : Infinity, s.firedAt('B12') || Infinity),
  where:'room:r2_window,roof_tank', defer:'wait', delayMs:1500,
  run: async (ctx) => { /* ctx = { less, speaker, user, view, zones, cb:G.e2.cb, mark } */ } }
```
Snapshot `s`: `flag(f) pm() pmOf(f) clock() passed(hm) user room:{open,view,sub,zoom} app firedAt(id) vars`. 1 s tick + bus events;
one show beat per tick; `owner !== 'director'` records are documentation only (the owner runs and `mark`s them).
Defer semantics (§6.1.3, §0.2 D3): `world` = fire on time, but while S1/S2 skip only screen decorations (shake, vignette pulse);
`wait` = wait until S1–S9 are all clear, no cap, drop when `until` is true; `wait30` = in S3–S9 wait at most 30 s then fire, in S1/S2 wait
without cap (drop at `until`). During M6–M7 S3–S7 do not apply. Spacing: show beats ≥ 25 s apart; dread show ≤ 1/60 s (M0–M5), ≤ 1/40 s
(M5–M6); simultaneous world events: lower class shifted +1.5 s. Failures never trigger beats (§6.1.4).

**Beat runner map** (each id has one runner)
| ids | runner | trigger / action |
|---|---|---|
| B00 · B01 · B02 · S00 | flow scenes | title → cold open → `flag:gotPhone` |
| B03 · M1 | shell lock | first unlock (no sound) |
| B04 | flow director (show, wait) | first `room:view r2_window` after M1 → `gsmTank.start(.08)` + S01 at 70° (skip if B09′ started GSM) |
| W01 | room | clock 23:30 newphone `2%` |
| B05 | flow director (world) | `flag:M2` → boot.chime + buzz.desk + `vibrate('m2')` + S02 |
| W02 | flow director (world) | clock 23:43 ∧ M2 → boot.chime −8 dB + S02 (room renders FRP by clock) |
| B06 / W03 | social | restricted messages by clock (silent) |
| W04 / W05 | flow director (world) | snow audio (amb.snow, step textures); `vars.snow` by core |
| B07 | flow director (world) | clock passes 00:00, or `clock:jump` skipped it (+2 s): `G.phone.notify(G.STORY.events.notif0000)` + bell ×12 + S03 |
| B08 | shell (M3) + flow director (audio) | `flag:M3` → `roomLP(1200, 30000)` (less 20 000); drone −100 cent while user '—' |
| M2 · M4 · M5 (+pre-buzz) · mono1 · mono2 | core e2 | ARCH §4.5 |
| B09′ | flow director (world) | pm(M4)+30 s → `gsmTank.pulse({peak:.15, upMs:500, holdMs:1000, downMs:500, arc:true})` (+ S01 if first GSM) → `b09Cue` |
| B09 | flow director (show, wait) | record above → `G.room.playTankGlow({variant: cb('js1') ? 'hand' : 'cap', holdMs: less ? 1200 : 2400})` (room adds the cap's +0.6 s itself, none when less) + `gsmTank.pulse({peak:.22, upMs:600, holdMs:1000, downMs:800})` (skipped when less) → `tankGlow` only if it resolved true, `spend('b09')` |
| B10 | core e2 (pre-buzz, M5) · social (3 lines N06–N08) | `flag:M5` |
| B11 · B19 · maker P1/P2/A/K | social | sched / clock / `climax:c2` / `flag:M7` |
| B12 · B13 · prelude · M6 · drill · wobble · C2 · lures · B14 · M7 · B15 · B17 · B18 · B16 · W06 | room climax | clock, `m6:due`, watcher, siren due |
| B20 · M8 · B21 · B21′ · W07 cards · 02:00 trigger | flow ending | sched `end:m8` = pm(M7)+72 000 … |
| B22 chat + END line | social script → flow `end:reached` | |
| B23 · HOOK | flow hook | after the check card |
| m.* | flow director | §6.1.6 interval `(120 − 75T)·(0.7–1.3)` s, active M1→M6 only; never 50–80° or 105–125° |

Every runner outside the director calls `G.director && G.director.mark(id)` the moment its beat starts (ids exactly as in the table:
`B00 B01 B02` scenes · `B03` lock · `B06` social (first restricted message) · `B10` core (pre-buzz) · `B11 B19` social · `B12 B13 B14 B15 B16
B17 B18 W06` climax · `B20 B21 B21′ W07 B22` ending · `B23` hook). The director needs `firedAt('B12')` for B09's `until`, and resume relies on
`vars.dir.fired` (ARCH §8.2). `mark` before `G.director.init()` is queued, never lost. In code, primed DESIGN ids are ASCII:
`B09′` → `'B09p'`, `B21′` → `'B21p'`, `N10′` → `'N10p'` (beat ids, `haru.skipTo`, notification ids).

### 4.19 App APIs used across owners
```js
// social — engine/apps/moment.js
G.moment = {
  init(), open({ tab:'home'|'search'|'messages'|'profile', thread, profile }),
  push(thread, msg, { notify=true, typingMs, coalesce=true }) → Promise<msg>,  // thread 'jimin_0412'|'fake'|'real'|'seah_y'; msg = data id or {from, text,…}
  play(scriptId) → Promise<{ chip }>,   // 'j0200' 'jTail' 'j0205' 'm0212' (§4.10.6–§4.10.8 chat lines, typing 0.8–1.6 s, chips)
  isOpen(thread) → bool, hiddenCount() → int, state() → { fake:'normal'|'restricted'|'blocked', realUnres, c1Pm },
};
// social calls hook 'end:reached' {right} at the exact moment `…{N} 씨구나.` (right) or `…괜찮아요. 형사님이 {N} 씨 맞대요.` (no answer) is appended.
G.chat = { push, edit, typing, open, list, messages }   // ep1 chat engine (social-internal; moment reuses it with kind 'moment')
G.talk = { open(thread) } ; G.mail = { open(id), folder(name) }
// media
G.gallery = { open({ user, album }), receive() → Promise<void>, openReceived(i) }   // receive: adds 받은 파일 (4) + opens viewer 1/4 with Kang lines; resolves on close
   // (viewer pushed on #app-stack over the {N} home; data-qa viewer.next/prev/close; ④ opened ⇒ photo4Seen + seenHangyeol;
   //  transfer complete ⇒ G.audio.sfx.tap() once — §6.2 B21 '사진 받기 완료 ui.tap')
G.recorder = { play(id), pause(), current(), isPlaying(id) }
G.clockApp = { ring(alarmId) → Promise<void> }            // = hook 'alarm:ring'; emits 'alarm:ringing' {id}; resolves on [해제 ›] slide
   // ring screen = layer .md2-ring (z 46, above the M0 eye view); it plays no sound itself (the alarm sound is flow's G.audio.box15)
// open(params) of every app (used by G.phone.openApp / notification routes): talk {thread} · moment {tab, thread, profile} · mail {id, folder}
//   · gallery {user, album} · camera {view, flash} · memo {id} · browser {page} · recorder {id} · clock {tab} · calendar {day} · alerts {tab, id}
//   · timeline {d} · phone {emergency:true} · settings {key, params}. Unknown keys are ignored; {} opens the app's first screen.
G.alerts = { list(), detail(id), timeline('12-15') → [{from, to, label}], fmt12: G.e2.fmt12, openSettings(), selfCheck() → string[] }
G.calendarApp = { open(day) } ; G.browser = { openPage(id), search(q) } ; G.memo = { open(user, id) }
G.phoneApp = { emergency() }                              // = hook 'phone:emergency'
// shell
G.settingsApp = { open(key, params), register(key, { title, render(api) → Node, keywords:[] }) }
// flow
G.scenes = { title(), pause(), coldOpen() → Promise, recap() → Promise } ; G.ending = { init(), resume(step) } ; G.hook = { start(), resume() }
// hook B23 (§6.4-③): G.fx.black(2000) (all buses 0, room tone −52 dBFS) → G.clock.jump('03:33') + G.clock.freeze() → G.lock.show('n',
//   {mode:'hook', onOpen}) (0.6 s fade) → +1.4 s G.phone.notify({ id:'N17', app:'moment', chat:'seah_y', title:'seah_y', body:'음성 메시지',
//   user:'n', gainDb: G.e2.less() ? -6 : 0, vibrate: !G.e2.less() }) (shell routes G.tones.for({chat:'seah_y'}) = 'dash' and applies 소리 모드 /
//   방해 금지) → G.flag('HOOK') in the same tick (the banner moment = HOOK). Battery shows 58 from the HOOK row of G.EP.CLOCK.
G.main = { boot(), resumeFrom(state) }
```

### 4.20 Hooks (`G.hooks`) — complete list
| hook | implementer | caller(s) | signature |
|---|---|---|---|
| `kbd:predict` | shell (security.js) | core keyboard | `(user, token, ctx) → [{w, his, seed}]` ≤ 3 |
| `settings:screen` | shell (settings.js registry) | social (moment ☰ › 알림 → `notif.perChat`), media, flow | `(key, params) → bool` |
| `alarm:ring` | media (clock.js) | room (`eyeM0`) | `(alarmId) → Promise<void>` |
| `phone:emergency` | media (phone app) | shell (lock 긴급 통화) | `() → void` |
| `room:refreshLayers` | room | anyone after bulk state edits (debug jump) | `() → void` |
| `end:reached` | flow (ending.js) | social (jimin thread) | `({right}) → void` — sets answeredRight/stage.e2_jimin/END, `G.e2.commit()` |
| `pause:open` | flow (scenes.js) | shell (status-bar ⏸ area), flow main (two-finger tap, Esc) | `() → void` |
| `gallery:receive` | media | flow ending (01:40 accept) | `() → Promise<void>` |
| `users:lockDash` | shell | flow ending (01:20 chip) | `() → Promise<void>` |

### 4.21 Bus events (`G.bus`) — complete list
| event | payload | emitter | main listeners |
|---|---|---|---|
| `flag` `flag:<n>` `flag:off` `flag:off:<n>` | name | core base | everyone |
| `var` `var:<k>` | `{k, v, prev}` | core base | room, shell, media |
| `settings` | G.settings | core base | audio, shell, flow |
| `visibility` | `{hidden}` | core base | audio, director, climax |
| `tick` | `{dt, playMs}` (250 ms, only while `G.clock.running()`) | core base | director, shell (status bar time), room (wall clock), climax |
| `clock:min` · `clock:jump` | `{hm, min, date}` · `{from, to, skipped}` | core base | room, social, director, climax, media |
| `m6:due` | `{prelude}` | core e2 | room climax |
| `mono:show` · `mono:hide` | `{id}` | core e2 | director (S3), audio (sub delay) |
| `keyboard` | bool | core keyboard | director (S1), room |
| `kbd:shown` | `{user, ctx, words}` | core keyboard | shell security |
| `media:play` `media:stop` `media:vol` `media:out` | ARCH §4.8 | core media | room climax, director (S5), shell (volume panel), media players |
| `bt:change` · `bt:cut` | `{state}` · — | core media | shell (status bar, BT rows, QS), security |
| `app:open` `screen:push` `screen:pop` `home` `home:show` | id · entry · entry · — · `{user}` | shell phone | director, core e2 (mono1/mono2, commit retry), social, media |
| `quickpanel` · `qs:users` | — · `{shown}` | shell | shell security (dashSeen) |
| `lock:show` · `lock:unlock` | `{user, mode}` · `{user, how}` | shell lock | core e2, director |
| `users:switching` `users:switched` `users:dashUnlocked` | `{from, to}` | shell | core e2, director (drone, S4), audio, social |
| `wifi:change` | `{on, connected}` | shell | social (offline banner, queued messages), security |
| `notify` · `notify:shown` | n · `{id}` | shell | social (fakeLineSeen), director |
| `security:finger` · `security:screen` | `{ok, where}` · `{key}` | shell | — |
| `chat:open` `chat:msg` `moment:thread` | `{thread}` · `{thread, msg}` · `{id}` | social | director, notebook refresh |
| `gallery:album` `gallery:view` `video:time` | `{user, id}` · `{id}` · `{id, t}` | media | director (S5), QA |
| `alerts:open` · `timeline:day` | — · `{d}` | media | — |
| `alarm:ringing` | `{id}` | media clock | flow scenes (box15 'inHand') |
| `room:*` | ARCH §4.15 | room | director (B04/B09 where), audio (in-app rule), scenes (box15 'doorOpen') |
| `climax:*` | ARCH §4.16 | room climax | social (P1 = C2+28 s), director |
| `notebook:open` `notebook:close` `hint` | ARCH §4.17 | flow | director (S2), climax (B14 less-scary) |
| `dir:beat` · `end:step` | `{id}` · `{step}` | flow | QA, social |
| `pause` | `{open}` | flow main | audio (no new cues while open), room climax |

### 4.22 `settings:screen` delegation
`settings.js` (shell) opens every screen by key via `G.settingsApp.open(key)` (hook `settings:screen` → same). Keys registered by
`security.js`: `lock` (§5.4 S1, verify first), `lock.smart` (S2 → `factSmart`, `trustDevSeen`), `lock.smart.item`, `bio` (보안 및
개인정보), `bio.finger` (S3, verify → `bioOpened`), `bio.fingerDetail`, `bio.fingerAdd`, `users` (S4, by viewing user → `dashSeen` /
`dashUsers`), `users.detail`, `users.n`, `kbd` (S5), `kbd.predict`, `kbd.words` (→ `kbdListOpened`), `wifi.saved.saemal_rooftop` (⚙ with
the smart-lock row → `factSmart`). Keys of `settings.js` itself: `root search connect wifi wifi.saved bt bt.device sound volume sound.notif
(→ soundSettingsOpened) notif notif.apps.moment notif.perChat (→ perChatSeen) display wallpaper location accounts battery about general`.
Hierarchy for the keyboard path (§4.6.5 / §5.4 S5 / settings-search path `일반 › 키보드 › 예측 텍스트`): root row `일반` = key **`general`**
(settings.js: `키보드 ›` · `언어` · `날짜 및 시간` rows — decorative except 키보드) → `kbd` (security.js, S5 키보드) → `kbd.predict`
(예측 텍스트: `예측 텍스트 표시` toggle → `vars.kbdPredictOff` for the viewing user · `개인 단어 목록 ›` · `자동 띄어쓰기`) → `kbd.words`.
Verification rule (§5.4 S1 vs §4.6.4 — one prompt per entry path): `lock` verifies on entry and `lock.smart` opened from `lock` does not
verify again; `lock.smart` / `bio.finger` / `bio.fingerAdd` reached directly (search result, deep link) verify first. `bio` (보안 및 개인정보)
never verifies; `bio.finger` verifies (→ `bioOpened` after success). '—' user: verify = PIN only (`G.security.verify` handles it).
Registered by media: `alerts.settings`; the search result `타임라인` → `G.phone.openApp('timeline')`. Search table §4.6.0 → keys
(`—`/`사용자` → `users`, `키보드·예측·단어·사전·자판` → `kbd.words`, `소리…` → `sound.notif` · `volume` · `notif.perChat`).
Every settings row renders `data-qa="settings.row:<key>"` with the key it opens.

### 4.23 `fx.js` + `icons.js` (core)
```js
G.fx.init()
G.fx.sub(text, ms=3200, { az, cls })   // bottom subtitle channel (sound subtitles; audio's G.audio.sub decides when/what)
G.fx.mono(text, ms=3200) → Promise     // monologue channel (separate DOM layer, handwriting-free, no sound, no toast); used by G.e2.mono and recap
G.fx.dirArc(az, ms=1200)               // speaker-mode edge arc ◀ ▶ ▲ ▼ (relative to G.audio.getYaw())
G.fx.edgeShake(px=3, ms=300)           // no-op when G.settings.reduceShake or G.e2.less()
G.fx.setVignette(v)                    // sets --vig on #screen (director: 0.30 + 0.40·T; speaker-mode heart pulse)
G.fx.black(ms) → Promise               // full black cover (B23 2 s, check card → hook)
// ep1 fx.js names (verified in engine/core/fx.js): FX.shake(ms, px) → alias of edgeShake · FX.vignette(s) → alias of setVignette ·
// FX.setTitle / blinkTitle / stopTitle / setFavicon / glitch / jumpscare / static / cinema / flash / pulse → no-ops in ep2 (forbidden tricks;
// DEBUG warns). There is no ep1 `cover` — ep2 has only G.fx.black(ms).
G.ICONS.alerts ; G.ICONS.timeline      // new home icons (재난 알림 · 타임라인); others reused from ep1 (phone talk gallery camera memo
                                       // browser mail calendar clock settings recorder moment exist in engine/core/icons.js; sms/files/weather unused)
```

### 4.24 Timed-event registry (who schedules what — no event is scheduled twice)
| event | owner (sched id / trigger) | when | effect |
|---|---|---|---|
| M2 real-6-min | core `e2:M2` | pm(M1)+360 000 | M2 |
| M4 stall fallback | core (tick) | pm(M3)+480 000 ∧ fc ≥ 2 | M4 (on {N}) |
| B09′ | flow `dir:b09cue` | pm(M4)+30 000 | GSM .15 |
| M5 | core `e2:M5` (+ `e2:M5hold` = due + 90 000 while user '—') | pm(M4)+150 000 (+ hold ≤ 90 000) | pre-buzz → +2.5 s M5 |
| B07 00:00 | flow director (`clock:min` 00:00, or `clock:jump` whose `skipped` contains '00:00' → +2 000 ms `dir:B07`) | 00:00 | calendar N05 + bell ×12 + S03 |
| W01 / W02 · newphone screens | room (`clock:min` 23:30 / 23:41 / 23:42 / 23:43) · flow director (W02 sound at 23:43 ∧ M2) | clock | layers / `boot.chime` −8 dB |
| B11 | social `social:B11` | pm(M5)+20 000 if C1 before M5 | `혹시 나라고 하는 계정…` |
| whereAsked | social `social:where` | pm(C1)+40 000 ∧ ¬whereTank | maker line 10 + `whereAsked` |
| C1 dialogue steps | social `social:c1:<n>` | §4.1.6 ⑥ typing delays / 20 s chip timeout / 15 s step 7 | |
| tonight messages | social (clock) | 23:45 … 00:16 by `clock:min` / `clock:jump` catch-up | restricted / normal delivery |
| M6 due | core (tick) → `m6:due` | `G.e2.m6DueAt()` | climax prelude/drill |
| B12 / B13 | room climax (clock) | 00:22 / 00:23 or prelude t 0 / 1.5 s | roof light off, peephole taped, steps |
| early lure 1 / 2 | room climax `climax:lure1` / `climax:lure2` | +60 000 / +45 000 | volume 15 % / media cut |
| siren | room climax `climax:siren` | `G.e2.sirenDueAt()` | M7 |
| P1 | social `social:P1` | pm(C2)+28 000 if C1 | `경찰 거의 다 왔대!!` |
| P2 | social `social:P2` | pm(M7)+5 000 if C1 ∧ ¬C2 | `경찰 도착했대!!` / `나도 거의 다 왔어` |
| A (makerArrived) / K | social (clock) | 00:44 / 01:12 (catch-up on jump) | lines; `makerArrived` only if C1 |
| B17 / B18 / B16 / 00:50 | room climax | M7 +18 s / +30 s / 00:44 or 00:47 / clock 00:50 | |
| M8 | flow `end:m8` | pm(M7)+72 000 | B20 |
| Wi-Fi auto on | shell `shell:wifiAuto` | 90 000 after Wi-Fi off | reconnect |
| hook idle | flow `end:hookIdle` | 30 000 without input on the hook screen | `[처음 화면으로]` appears |

---
## ARCH §5 — `G.STORY.*` data schemas (one filled example each; DESIGN strings verbatim)
Rules for every data file: `G.STORY = G.STORY || {}` then assign your key(s); strings carry `{N…}`/`{MAKER_CONTACT}`/name tokens and are
expanded by the renderer with `G.T`; conditional lines are **lazy functions** (`() => …` / `(cb) => …`) evaluated at render; every line
*he* wrote carries `his:true` (QA counts ≤ 25, §3.20.3 / §10 E); times use `t:'YYYY-MM-DD HH:MM'` (24 h, in-game) unless the screen shows a
literal string (then `when:'오후 10:50'`). Image fields are asset keys (resolved by `G.e2.img`).

### 5.1 `assets.js` (assets agent) — what consumers expect
`G.IMG = { key: 'assets/img/<file>' }` (ep2-relative; ep1 reuse keys → `'../assets/img/…'`), `G.IMGMETA = { glass_q:[[x,y]×4], tank_rect:{x,y,w,h},
rail_rect, railwin_rect, stencil_q, gap_tank, door_tank, led_rail, led_railwin, led_lock, led_lock_cu, door_gap, peep, clock_bed, np_desk_q,
np_cu_q, box_phone_q, lid_name_q, handle_pivot, sticky_q, beam_origin }` (§8.3-9, fractions 0–1; **inline object**, not fetched JSON — file:// safe),
`G.AUDIO_FILES = { v2_jimin_vm, v2_jimin_vm_a, v2_jimin_vm_b, v2_kang_door, v2_him_breath }` → paths, optional `G.PRELOAD` (array) and
`G.PRELOAD_GROUPS = { start, m1, m2, m3, m4, m7 }` (§9.8). Consumers must work when any key/meta is missing (`G.e2.img` fallback, room
defaults its measured rects).
Observed so far in `ep2/assets/img/meta.json` (asset agent, in progress): the §8.3-9 keys **plus** `door_note_q door_sticky_q glass_panes
note_card_q peephole_disc tank_door_map corridors win_shot_crop door_box_rect landlord_note_q box_lifted_photo_q lid_name_q_lifted
_box_poly _crop_rects _qa`; `beam_origin` absent (room defaults `{x:.06, y:.55}`). The 0:18 move video has four frames `move_f1..f4`
(f4 = the 13–18 s re-crop). `door_handle_r2.png` also exists (room may prefer it for the r2_door full-frame patch). `G.IMGMETA` must be the
inline copy of this JSON inside `assets.js`; consumers never `fetch` meta.json.

**Final `G.IMG` keys** (§8.3-1 + files present in `ep2/assets/img/`; consumers code against exactly these names, `.png` = alpha):
- room views: `r2_door r2_window r2_window_mask(png) r2_bed r2_desk` · plate `roof_plate_s0 _s1 _s2 _s2d` · zoom `roof_tank_s0 _s1 _s2 _s2d`
  `roof_rail_s0 _s1 _s2 _s2d` `rail_window_s0 _s1 _s2 _s2d`
- outside patches (png): `p_steps1 p_steps1_d p_steps2 p_steps1_tank p_steps1_tank_d p_rail_steps p_tank_ajar p_tank_ajar_lit p_tank_ajar_plate
  p_tank_ajar_plate_lit p_tank_glow p_tank_glow_plate js_tank_hand js_tank_hand_plate js_tank_cap js_tank_cap_plate m_roof_snow`
- room patches (png): `p_door_box p_win_refl door_handle` (doorlock_in close-up handle frame 2) `door_handle_r2` (same frame for the r2_door view)
- close-ups: `p2_door_open box_top box_top_in box_top_lifted box_top_lifted_in note_card_front note_card_back polaroid_601 polaroid_601_back
  landlord_note peephole_s0 peephole_s1 peephole_s2 peep_tape doorlock_in newphone`
- '—': `old_room old_room_lock inn_key rec_voicetalk` · album 0310 `n_room_1 n_room_2 n_room_3 n_room_4 n_roof_snow n_sill n_lock_new n_sky
  n_boxes contract_cap move_f1 move_f2 move_f3 move_f4` · album 옥상 `win_shot_01 … win_shot_14` (two digits) `roofvid_f1 roofvid_f2 roofvid_f3`
- {N}: `n_wall n_post_1 n_post_2 n_post_3` · ending `pol_case pol_tank_in pol_tally pol_sticker kongi_santa` · meta `og_ep2 icon_ep2 icon_ep2_192 title_ep2`
- ep1 reuse (resolved by `G.e2.img` to `../assets/img/`, §8.1): `avatar_jimin avatar_sea kongi_old mo_* dog_* sea_orgel_live icon`
- `G.AUDIO_FILES` ids (= `G.audio.voice` ids): `v2_jimin_vm v2_jimin_vm_a v2_jimin_vm_b v2_kang_door v2_him_breath`.
Group aliases used in DESIGN prose (`move_frames`, `roof_video`, `win_shot`, `roof_tank`, `peephole`, `note_card`) are **not** keys.

### 5.2 `users.js` (shell) → `G.STORY.users` — readers: shell, social (`dash` view), media (per-user data)
```js
G.STORY.users = {
  n: { id:'n', name:'{N}', role:'관리자', home:'n', wall:'n_wall', lock:'n_wall', widget:'우리 집 ♥ since 2026.12.10',
       seedNotifs: [   // N01–N03, present on the lock screen from gotPhone (§3.2, §4.8)
         { id:'N01', app:'moment', title:'{MAKER_CONTACT}', body:'{N야} 집이야?', when:'오후 10:50', route:{ app:'moment', params:{ thread:'fake' } } },
         { id:'N02', app:'moment', title:'', body:'메시지를 보내지 못했습니다', when:'오후 10:51', route:{ app:'moment', params:{ thread:'jimin_0412' } } },
         { id:'N03', app:'alerts', title:'{eunpyeongOffice}', body:'오늘 22시 {eunpyeong} 대설주의보 발효…', when:'오후 10:52', route:{ app:'alerts' } } ] },
  dash: { id:'dash', name:'—', added:'2026.11.25', pin:'0310', home:'dash', wall:'old_room', lock:'old_room_lock',
          allowSwitch:true, calls:false, deletable:false },
  listFrom: { n:[['n','{N} (나)','관리자'], ['dash','—','추가됨 2026.11.25']], dash:[['dash','— (나)',''], ['n','{N}','관리자']] },
  nDetail: ['이름  {N}', '관리자', '이 휴대전화의 첫 사용자'],
};
```

### 5.3 `security.js` (shell) → `G.STORY.security` — readers: shell
§9.6 ① verbatim, with the hotspot line made lazy through core:
```js
G.STORY.security = {
  fingers: [ { id:'f1', name:'{N}', lastUsed:'2026.11.23' },
             { id:'f2', name:'나', label:'지문 2 · 나 (2026.11.25)', added:'2026.11.25 오후 2:31', lastUsed:'오늘 오후 10:51', his:false } ],
  smart: { places:[], onBody:false,
           devices:  [ { id:'2층_스피커',     line:'지정 2026.12.22 23:33 · 사용자: 나', detail:['신뢰할 수 있는 기기','연결되어 있는 동안','잠금 해제 상태가 유지됩니다.'] } ],
           networks: [ { id:'saemal_rooftop', line:'지정 2026.12.10 23:16 · 사용자: 나', detail:['신뢰할 수 있는 네트워크','이 네트워크에 연결되어 있으면','잠금 해제 상태가 유지됩니다.'] } ] },
  wifi: [ { id:'saemal_rooftop', line:'연결됨 · 저장된 네트워크 · 추가 2026.12.10 · 다른 기기에서 동기화됨', smart:'스마트 잠금: 신뢰할 수 있는 네트워크',
            extra:['보안  WPA2-개인', 'IP 주소  192.168.0.23'], pw:'saemal0601' },
          { id:'SM-G991N_0A3F', line: () => `모바일 핫스팟 · 자동 연결 · 마지막 연결 2026.12.24 ${G.e2.fmt12(G.STORY.days['12-24'].pause[0])} · 추가 2026.11.25`,
            detail:['모바일 핫스팟', '자동 연결  켜짐', () => `마지막 연결  2026.12.24 ${G.e2.fmt12(G.STORY.days['12-24'].pause[0])}`, '추가  2026.11.25 오후 2:40'] },
          { id:'Haesol_404', line:'범위 밖 · 추가 2026.11.23', detail:['저장된 네트워크 · 범위 밖', '추가  2026.11.23'] } ],
  available: ['saemal_4F', 'Wi-Fi_7C21'],   // both 🔒
  bt: { id:'2층_스피커', kind:'스피커', added:'2026.12.22 오후 11:31', by:'나', last:'오늘 오후 10:41', vol:15, call:false },
};
```
(`his` on f2 is false: names/labels are not his *lines*, §4.11.1 exclusion list.)

### 5.4 `kbd.js` (shell) → `G.STORY.kbd` — readers: shell (provider)
Prefix rows follow **§3.5 / §4.6.5** (v1.2 fix #34 supersedes the older §9.6 code — ARCH §9 G3): his words first in table order, then system words.
```js
G.STORY.kbd = {
  n: {
    prefix: { 'ㄱ':['그냥','경찰이','근데'], 'ㄲ':['끝까지','꼭','깜짝'], 'ㄴ':['네','나','너무'], 'ㄷ':['다시','더','다'], 'ㄸ':['또','때문에','딱'],
              'ㄹ':['라고','로','를'], 'ㅁ':['물탱크실','문','뭐'], 'ㅂ':['방음','바로','밖에'], 'ㅅ':['세아','식구','사진'], 'ㅅㄱ':['식구'],
              'ㅆ':['씨','썼어','쓰고'], 'ㅇ':['옥상','우리 집','응'], 'ㅈ':['집','지민 씨','지금'], 'ㅉ':['쯤','찍어','짜증'], 'ㅊ':['친구','출발','처음'],
              'ㅋ':['ㅋㅋ','ㅋㅋㅋㅋ','ㅋ'], 'ㅌ':['톡','택배','타고'], 'ㅍ':['폰','편하게','피곤해'], 'ㅎ':['혹시','했어','ㅎㅎ'],
              '0':['0310','0'], '2':['2구','2'], '6':['601','6'] },
    his:  ['끝까지','그냥','물탱크실','옥상','우리 집','새말빌라','601','세아','식구','집','2구','방음','경찰이','지민 씨','0310','문'],   // '문' counts (§3.5 '그')
    seed: ['2구','방음','식구'],
    never: ['한','마디','한마디','소절','멈췄','멎','짧게','조금만','금방'],   // never predicted anywhere (§4.6.5)
    words: [ // 개인 단어 목록 (read-only, 15 rows) — order = 최근 추가순; rank = 자주 쓴 순
      { w:'끝까지', added:'2026-12-24', rank:15 }, { w:'그냥', added:'2026-12-24', rank:6 }, { w:'물탱크실', added:'2026-12-11', rank:8 },
      { w:'옥상', added:'2026-12-11', rank:7 }, { w:'우리 집', added:'2026-12-10', rank:5 }, { w:'새말빌라', added:'2026-12-03', rank:11 },
      { w:'601', added:'2026-12-03', rank:10 }, { w:'세아', added:'2026-11-28', rank:1 }, { w:'식구', added:'2026-11-28', rank:9 },
      { w:'집', added:'2026-11-28', rank:4 }, { w:'2구', added:'2026-11-28', rank:12 }, { w:'방음', added:'2026-11-28', rank:13 },
      { w:'경찰이', added:'2026-11-26', rank:14 }, { w:'지민 씨', added:'2026-11-26', rank:3 }, { w:'0310', added:'2026-11-26', rank:2 } ] },
  dash: { prefix:{ 'ㅁ':['문 열어 줘'], 'ㅁㄹ':['메리 크리스마스'], 'ㅇ':['우리 집'], '0':['0444'], 'ㄷ':['답방'], 'ㅈ':['집들이'] },
          words:[ { w:'문 열어 줘', added:'2026-12-24' }, { w:'메리 크리스마스', added:'2026-12-24' }, { w:'0444', added:'2026-12-23' },
                  { w:'우리 집', added:'2026-12-10' }, { w:'답방', added:'2026-12-10' }, { w:'집들이', added:'2026-12-10' } ] },
  system: { /* fallback dictionary for tokens not in prefix — common words only, never his, never `never` */ },
};
```

### 5.5 `settings.js` (shell) → `G.STORY.settings` — readers: shell
```js
G.STORY.settings = {
  root: [ { key:'connect', title:'연결', sub:'Wi-Fi · 블루투스 · 비행기 모드' }, { key:'sound', title:'소리 및 진동', sub:'소리 모드 · 볼륨 · 알림 소리' },
          { key:'notif', title:'알림', sub:'앱 알림 · 방해 금지' }, { key:'display', title:'디스플레이', sub:'밝기 · 글자 크기' },
          { key:'wallpaper', title:'배경화면', sub:'배경화면 · 잠금화면 위젯' }, { key:'lock', title:'잠금 화면', sub:'화면 잠금 유형 · 스마트 잠금' },
          { key:'bio', title:'보안 및 개인정보', sub:'생체 인식 · 내 디바이스 찾기' }, { key:'location', title:'위치', sub:'위치 서비스 · 최근 위치 요청' },
          { key:'users', title:'사용자', sub: () => `현재 사용자: ${G.users.current()==='n' ? G.T('{N}') : '—'}` },
          { key:'accounts', title:'계정 및 백업', sub:'계정 관리' }, { key:'general', title:'일반', sub:'키보드 · 언어 · 날짜 및 시간' },
          { key:'battery', title:'배터리', sub: () => `${G.battery()}%` }, { key:'about', title:'휴대전화 정보', sub:'{N}의 휴대전화' } ],
  account: { title:'{N}', sub:'다온 계정 없음 ›' },
  search: [ { keys:['잠금','신뢰','스마트','자동','해제'], results:[['스마트 잠금','잠금 화면','lock.smart'], ['화면 잠금 유형','잠금 화면','lock']] },
            { keys:['지문','생체','손가락'], results:[['생체 인식','보안 및 개인정보','bio.finger']] } /* … every row of §4.6.0 */ ],
  btScreen: { name:'{N}의 휴대전화', searching:'검색 중…', none:'주변에 기기가 없습니다' },
  sound: { modes:['소리','진동','무음'], ringtone:'기본' },
  perChat: [ { chat:'seah_y', label:'seah_y', line:'설정 2026.11.27 오전 3:33 · 나', grey:'대화가 없습니다', locked:true },
             { chat:'fake', label:'{MAKER_CONTACT}', line:'설정 2026.12.24 오후 7:22 · 나', changedLine:'설정 방금 · 나' } ],
  location: { rows:[['타임라인','켜짐 · 2026.12.10부터'], ['재난 알림 위치 기반 수신','켜짐']], recent:[['재난 알림','오늘 오후 10:52'], ['타임라인','지금']] },
  battery: { usage:'화면 38% · 모먼트 17% · 시스템 15% · 블루투스 6% · 기타 24%' },
  about: { name:'{N}의 휴대전화', model:'스마트폰 (128GB)', number:'알 수 없음', sim:'SIM 없음', uptimeFrom:'18:00' },
  security: [['생체 인식','지문 2개'], ['화면 잠금 유형','PIN · 지문'], ['내 디바이스 찾기','꺼짐 · 2026.11.24 오전 4:51'], ['앱 권한',''], ['보안 업데이트','2026년 11월 1일']],
  dash: { bio:'등록된 지문이 없습니다', lockType:'PIN', wallpaper:'내 사진', account:'추가된 계정이 없습니다' },
};
```

### 5.6 `talk.js` (social) → `G.STORY.talk` — readers: social
```js
G.STORY.talk = {
  banner: '{$talkOut}',            // render G.e2.STR.talkOut + [다시 로그인]
  listFoot: '이 기기에 저장된 대화만 표시됩니다.',
  threads: [
    { id:'maker', name:'{MAKER_CONTACT}', preview:'폰 찾았어?', day:'11월 24일', head:'이전 대화는 이 기기에 저장되어 있지 않습니다.',
      foot:'이 기기의 대화는 2026.11.25 오후 4:40 이후 업데이트되지 않습니다.',
      messages:[ { from:'them', t:'2026-11-24 07:58', text:'{N야} 괜찮아? 뉴스 봤어', read:true },
                 { from:'them', t:'2026-11-24 08:30', text:'전화 좀 받아!!', read:true },
                 { from:'them', t:'2026-11-24 12:10', text:'폰 찾았어?', read:true } ] },
    { id:'sea', name:'윤세아', avatar:'avatar_sea', preview:'삭제된 메시지입니다', day:'11월 24일',
      foot:'이 기기의 대화는 2026.11.25 오후 4:40 이후 업데이트되지 않습니다.',
      messages: () => seaRoomMessages() } ],   // §9.4 v1.3 code verbatim (G.settings.e1MyMsgs !== false)
  relogin: { title:'휴대전화 번호로 로그인', field:'인증번호 6자리', grey:'SIM 없음' },
};
```

### 5.7 `moment.js` (social) → `G.STORY.moment` — readers: social (and flow hook reads `profiles.seah_y`)
```js
G.STORY.moment = {
  feedEmpty: ['모두 확인했습니다', '최근 3일 동안 올라온 새 게시물을 모두 확인했습니다.'],
  me: { n:{ name:'{N}', handle:null, avatar:'initial', postCount:3 }, dash:{ account:'fake' } },
  posts: [ { id:'p1', date:'9월 20일', img:'n_post_1', likes:12, restricted:[] },
           { id:'p2', date:'11월 12일', img:'n_post_2', likes:9,  restricted:['rc1'] },
           { id:'p3', date:'11월 22일', img:'n_post_3', likes:14, restricted:['rc2','rc3','rc4','rc5','rc6','rc7'] } ],
  restrictedComments: [ { id:'rc1', post:'p2', t:'2026-11-30 20:02', when:'11월 30일 오후 8:02', text:'폰 찾았어?' },
                        { id:'rc2', post:'p3', t:'2026-12-10 21:30', when:'12월 10일 오후 9:30', text:'이사 축하해! 오늘 고생했다 ㅋㅋ' } /* … rc7 */ ],
  profiles: {
    fake:  { name:'{MAKER_CONTACT}', badge:'오늘 만든 프로필', handle: () => G.e2.makerHandle() ? '@{MAKER_ID}_' : null, stats:'게시물 0    팔로워 0    팔로잉 1',
             empty:'아직 게시물이 없습니다', menu:['이 계정 정보','제한','차단','신고'],
             info:[['가입한 날짜','2026년 12월'], ['계정 위치','정보 없음'], ['이전 사용자 이름','0개']], infoFoot:'게시물 0 · 팔로워 0' },
    real:  { name:'{MAKER_CONTACT}', handle: () => G.e2.makerHandle() ? '@{MAKER_ID}' : null, stats:'게시물 0 · 팔로워 64 · 팔로잉 71',
             info:[['가입한 날짜','오래된 계정'], ['계정 위치','대한민국'], ['이전 사용자 이름','0개']], restrictedOn:'제한함 2026.11.26 오후 9:30' },
    jimin_0412: { name:'지민', avatar:'avatar_jimin', blocked:['jimin_0412','사용자를 찾을 수 없습니다','게시물 없음'], bio:'🍜 먹는 게 제일 좋아 · @seah_y 베프' },
    seah_y: { name:'윤세아', handle:'@seah_y', bio:'음향과 · 소리 모으는 사람 🎧', stats:'게시물 36 · 팔로워 212 · 팔로잉 180', avatar:'avatar_sea',
              grid:['mo_mug','mo_mandarin','dog_park' /* … ep1 2025 public posts, §4.1.8 — not the two 2026-11-24 posts */] },
    sagongsa: { name:'sagongsa', sub:'비공개 계정', stats:'게시물 0 · 팔로워 0 · 팔로잉 1', avatar:'black' },
  },
  search: [ { match:'maker2', results:[['{MAKER_CONTACT}','제한됨','real'], ['{MAKER_CONTACT}','새 계정','fake']] },
            { match:['seah','세아','윤세아'], results:[['seah_y','윤세아','seah_y']] }, { match:['jimin','지민'], results:[['jimin_0412','지민','jimin_0412']] },
            { match:['sagongsa','사공사'], results:[['sagongsa','비공개 계정','sagongsa']] } ],
  recentSearch: { n:[['seah_y','윤세아'], ['jimin_0412','지민']], dash:[['{N}', '']] },
  threads: {
    jimin_0412: [   // §4.1.3 verbatim, day separators derived from t
      { id:'j1', from:'me',   t:'2026-11-26 21:12', text:'저 404호에 이사 왔던 사람이에요.', his:true },
      { id:'j2', from:'them', t:'2026-11-26 21:12', text:'헐' },
      /* … */
      { id:'jvm', from:'them', t:'2026-12-17 21:40', vm:{ dur:14, buffer:'jiminVM', unplayed:true,
          subs:[ { t0:0.0, t1:4.2, text:'형사님이 세아 오르골 사진 보여 주셨어요.' }, { t0:4.4, t1:9.6, text:'{N} 씨가 감았을 때 한 마디만 나왔다면서요.' },
                 { t0:9.8, t1:14.0, text:'세아가 9월에 고친 건데…' } ] } },
      { id:'j51', from:'me', t:'2026-12-24 22:51', text:'지민 씨', his:true, failed:true } ],   // `ⓘ 전송되지 않음` in red
    fake: [ { id:'f1920', from:'them', t:'2026-12-24 19:20', text:'{N야} 나 새 계정 만들었어. 예전 거 털렸어', his:true },
            { id:'fsys', sys:'{$reqAccepted}' }, { id:'f1921', from:'me', t:'2026-12-24 19:21', text:'ㅇㅋ', his:true },
            { id:'f2250', from:'them', t:'2026-12-24 22:50', text:'{N야} 집이야?', his:true } ],
    fakeM5: [ { id:'f0016a', text:'{N야} 메리 크리스마스.', his:true }, { id:'f0016b', text:'나 너네 옥상 왔어.', his:true }, { id:'f0016c', text:'문 열어 줘.', his:true } ],
    fakeChip: '어디야? 진짜 너야?',
    tonight: [ { id:'r2345', at:'23:45', text:'야 톡 왜 안 읽어' }, { id:'r2346', at:'23:46', text:'전화가 꺼져 있대' }, /* … */
               { id:'r0010', at:'00:10', text:'답이 없어서 112에 전화했어 나도 갈게', report:true }, { id:'r0013', at:'00:13', text:'택시 잡았어' },
               { id:'r0016', at:'00:16', text:'나 그쪽으로 간다?' } ],
    c1: { chip0:'나 {N}. 톡 안 돼. 그 사람이 내 옛날 폰을 문 앞에 두고 갔어',
          replies1:[['헐 {N야}!!',3000], ['왜 톡 안 읽어 전화도 꺼져 있고',1600], ['무슨 일이야 너 지금 어디야',2000]],
          r3a:'혹시 나라고 하는 계정 있으면 그거 나 아니야!! 나 아직 가는 중이야',
          chip4: () => G.flag('M2') ? '집. 문 잠갔어. 새 폰은 초기화됐어' : '집. 문 잠갔어. 새 폰은 꺼져 있어',
          /* steps 5–10, W+ / W−, D/D1–4, S/S1–2, P1, P2, A, K, E exactly as the §4.1.6 ⑥ table */ },
    pool: { preM6:['응 보고 있어','가는 중이야!!'], m6:['문 열지 마','조금만 기다려 거의 다 왔대'], m7:['경찰 왔대!!'],
            after0044:['나 1층이야','경찰분들 위에 올라갔어'], after0110:['괜찮아?? 나 여기 있어'], exhausted:'응응' },
  },
  dashView: { stats:'게시물 0 · 팔로워 0 · 팔로잉 1', listRow:'회원님: {N야} 집이야?', listRowM5:'회원님: 문 열어 줘.',
              draft:'{N야} 메리 크리스마스. 나 너네 옥상 왔어. 문 열어 줘.', draftNote:'임시 저장 · 오후 9:58',
              switcher:[['{MAKER_CONTACT}','✓'], ['sagongsa','로그아웃됨'], ['＋ 계정 추가','']], sagongsaSheet:'sagongsa로 다시 로그인하려면 비밀번호가 필요합니다.' },
  restrictedScreen: { desc:'제한한 사람의 댓글은 그 사람에게만 보이고, 메시지는 요청함으로 가며 알림이 오지 않습니다.' },
  settings: [['개인정보 보호 ›',''], ['알림 ›',''], ['로그인 활동 ›','']], loginActivity:'이 기기 · 지금 활동 중', requestsEmpty:'메시지 요청이 없습니다',
  scripts: {   // played by G.moment.play(id) on request from flow (ending)
    j0200: [ { from:'them', t:'2026-12-25 02:00', text:'{N} 씨.' }, { from:'them', text:'형사님한테 연락 받았어요. 지금 그 폰 {N} 씨가 들고 있다고.' },
             { from:'them', text:'미안해요. 하나만 다시 물어볼게요.' }, { from:'them', text:'그날 경찰 오기 직전에 세아 오르골 감아 봤다면서요. 어땠어요?' },
             { input:'jiminAnswer', noAnswer:'대답하지 않는다' } ],
    jRight:'…{N} 씨구나.', jNone:'…괜찮아요. 형사님이 {N} 씨 맞대요.', jWrong1:'…괜찮아요. 천천히요.',
    jTail: [ { from:'them', text: (cb) => cb('jimin') ? '그날 신고한 거 저예요. 늦어서 미안해요…' : '그날 저는 자고 있었어요. 미안해요.' },
             { from:'them', text:'한 달 동안 {N} 씨인 줄 알고 얘기했어요. 세아 얘기도 많이 했어요.' }, { chip:'지민 씨 잘못 아니에요.' },
             { from:'them', text:'……' }, { from:'them', text:'고마워요.' } ],
    j0205: [ /* §4.10.7 incl. img kongi_santa and the cb('mom') variant, chip '네. 같이 가요.' */ ],
    m0212: [ { from:'them', text:'{N야}' }, { from:'them', text:'올라간다 지금' }, { from:'them', text:'경찰분이 괜찮대' }, { chip:'응. 이제 올라와' } ],
  },
  hookVM: { dur:12, buffer:'hook.seahY', subs:[ { t0:1.7, t1:8.4, text:'[허밍]' } ] },   // rendered by flow hook (S22)
};
```

### 5.8 `mail.js` (social) → `G.STORY.mails`, `G.STORY.mailAccount` — readers: social
```js
G.STORY.mailAccount = { head:'받은편지함', account:'{N} · 다온 메일', banner:'{$mailSync}', folders:['받은편지함', '휴지통 1'], attach:'{$mailNoOpen}' };
G.STORY.mails = [
  { id:'m1223', folder:'inbox', from:'{police} 강수진', subj:'[{police}] 신변보호 기간 종료 안내', date:'12월 23일', sent:'12월 23일 (수) 오후 4:05',
    body: (cb) => ['{N} 님, 강수진입니다.', ' · 신변보호 기간이 오늘(12월 23일) 24시에 끝납니다.', /* … */ '{police} 여성청소년강력팀 경위 강수진'] },
  { id:'m1209', folder:'inbox', from:'{police} 강수진', subj:'[{police}] 진행 상황 안내', date:'12월 9일', sent:'12월 9일 (수) 오후 5:20',
    body: (cb) => [ /* … */ cb('manager') ? ' · 관리실 사칭 번호 신고 덕에 명의자는 찾았어요. 이름만 빌려준 분이었어요.' : null /* … */ ].filter(Boolean) },
  { id:'mQR', folder:'trash', from:'다온 계정', subj:'[다온 계정] QR 코드로 새 기기 로그인이 승인되었습니다', date:'11월 26일',
    deletedNote:'삭제됨 · 2026.11.26 오전 2:15', body:['다온 계정에 새 기기가 로그인했습니다.', ' · 기기: Windows PC', /* … */] },
  /* m1203 전자계약 (blocks █), m1125b 모든 기기에서 로그아웃 (footer lines), m1125a 비밀번호 변경, m1124 피해자 안내 — §4.3 verbatim */
];
```

### 5.9 `gallery.js` (media) → `G.STORY.gallery` — readers: media
```js
G.STORY.gallery = {
  n: { empty:['사진 없음', '다온 클라우드 계정이 없습니다'], cameraAlbum:'카메라' /* items from vars.shots */ },
  received: { album:'받은 파일', info:'받은 파일 · 강수진의 휴대전화 · 2026.12.25 오전 1:40',
              items:[ { id:'r1', key:'pol_case', kang:null }, { id:'r2', key:'pol_tank_in', kang:'물탱크실 안이에요.' },
                      { id:'r3', key:'pol_tally', kang:null }, { id:'r4', key:'pol_sticker', kang:null, seen:['photo4Seen','seenHangyeol'] } ] },
  dash: {
    albums: [
      { id:'0310', name:'0310', count:'11개 · 이 기기에 저장됨', ghost:{ n:214, text:'{$ghost}' }, flag:'dashA0310',
        items:[ { id:'a1', key:'n_room_4', info:['2026.12.21 오후 10:05 · 다른 기기', '저장 2026.12.22 오전 1:15 · 다온 클라우드에서 다운로드'] },
                { id:'a9', video:{ dur:18, frames:[{key:'move_f1',t0:0,t1:5.5},{key:'move_f2',t0:5.5,t1:8.6},{key:'move_f3',t0:8.6,t1:13},{key:'move_f4',t0:13,t1:18}],
                  buffer:'vid.move', subs:[{t0:0,t1:8,text:'[바람 소리]',kind:'mood'},{t0:9,t1:11.2,text:'[철문 삐걱이는 소리]',kind:'info'}],
                  reach:{ '10.0':'seenHinge' } }, info:['동영상 · 0:18 · 2026.12.10 오후 3:24 · 다른 기기', '저장 2026.12.10 오후 11:40'] }
                /* … 11 items in §4.5.2 order */ ] },
      { id:'roof', name:'옥상', count:'15개 · 이 기기에 저장됨', flag:'dashARoof',
        items:[ { id:'w01', key:'win_shot_01', info:['2026.12.11 오전 1:06', '카메라 · 이 휴대전화 · 위치 정보 없음'] } /* … w14 */,
                { id:'rv', video:{ dur:12, frames:[{key:'roofvid_f1',t0:0,t1:4},{key:'roofvid_f2',t0:4,t1:8.5},{key:'roofvid_f3',t0:8.5,t1:12}], buffer:'vid.roof',
                  subs:[{t0:0,t1:4,text:'[바람 소리]',kind:'mood'},{t0:5,t1:8,text:'[휘파람]',kind:'info'}], reach:{ '8.0':'seenWhistle' } },
                  info:['동영상 · 0:12 · 2026.12.21 오후 11:40 · 카메라 · 이 휴대전화'] } ] } ],
    hidden: { flag:'dashHidden', items:[ { id:'h1', key:'inn_key', info:['카메라 · 이 휴대전화 · 2026.11.25 오후 2:52 · 위치 정보 없음'], seen:'seenKey404' },
                                          { id:'h2', show:(cb) => cb('ring'), video:{ dur:7, frames:[{key:'rec_voicetalk',t0:0,t1:7}], buffer:'ringHaru7',
                                            subs:[{t0:0,t1:5,text:'[벨소리]',kind:'info'}] }, info:['화면 녹화 · 0:07 · 2026.11.24'] } ] },
    menu:['숨긴 항목 보기', '설정'], settingsRow: (cb) => `숨긴 항목 ${cb('ring') ? 2 : 1}`, noShareNoDelete:true },
};
```
(`ringHaru7` = 7 s render of ep1's ringtone requested from audio via `G.audio.buffer('ringHaru7')` — added buffer id.)

### 5.10 `recordings.js` (media) → `G.STORY.recordings`
```js
G.STORY.recordings = { n: [ { id:'uri', title:'우리', dur:31, line:'2026.11.24 오전 4:22', buffer:'rec.uri', loopDefault:true,
  info:[['파일 이름','우리'], ['길이','0:31'], ['녹음','2026.11.24 오전 4:22'], ['이름 변경','2026.12.21 오후 11:52'], ['위치 정보 없음','']],
  subsPhone:[ { t0:0, t1:27, text:'♪ (오르골)' }, { t0:27, t1:31, text:'[딸깍 딸깍]' } ] } ] };   // bt output → no in-player subs (climax shows S09)
```

### 5.11 `clock.js` (media) → `G.STORY.alarms`
```js
G.STORY.alarms = {
  n: [ { id:'a0444', time:'오전 4:44', name:(cb) => cb('alarmDel') ? '또 지울 거야?' : '우리', nameHis:(cb) => !!cb('alarmDel'), on:true, repeat:'반복 안 함',
         detail:[['알람 이름', (cb) => cb('alarmDel') ? '또 지울 거야?' : '우리'], ['반복 안 함',''], ['알람 소리','우리'], ['볼륨','15%'],
                 ['소리 출력','2층_스피커'], ['진동','끔'], ['다시 울림','끔']] },
       { id:'a2310', time:'오후 11:10', name:'문 앞', on:false, repeat:'1회',
         detail:[['알람 이름','문 앞'], ['1회',''], ['알람 소리','우리'], ['볼륨','15%'], ['소리 출력','이 휴대전화'], ['진동','끔']],
         ring:{ time:'오후 11:10', title:'문 앞', playing:'♪ 우리', slide:'해제 ›' } } ],
  dash: [ { id:'a0530', time:'오전 5:30', name:'', on:true, repeat:'매일 · 오늘 꺼짐',
            detail:[['알람 이름','없음'], ['매일',''], ['알람 소리','기본'], ['오늘 알람 끔','']] } ],
  tabsEmpty: ['세계 시각', '스톱워치', '타이머'],
};
```

### 5.12 `objectives.js` (flow) → `G.OBJECTIVES` (order = hint-tab priority, §2.4)
```js
const f = (n) => G.flag(n);
G.OBJECTIVES = [
  { id:'box', title:'상자', show:() => true, done:() => f('gotPhone'),
    hints:['문밖에서 나는 소리.', '현관문을 눌러 열어 봐. 문 앞에 뭐가 있다.', '현관 → 문 → 상자 → 폰을 집고 알람을 밀어 끈다.'] },
  { id:'fake', title:() => f('fakeLineSeen') ? '문 열어 줘' : '오늘 만든 프로필', show:() => f('fakeLineSeen') || f('fakeKnown'), done:() => f('fakeKnown'),
    grayAfterM7:true, hints:['정말 {MAKER_CONTACT}의 말투야?', /* T2, T3 §3.12 */] },
  /* phone smart finger kbd cbs jimin dash home tone(optional) real where(optional) door answer — §2.4 show/done table, hints §3.x */
];
```

### 5.13 `beats.js` (flow) → `G.BEATDATA2` — see ARCH §4.18 record and runner map; `micro: [{ id:'m.gust', az:[0,360], weight }, …]`,
`tension: { M0:.10, M1:.15, M2:.30, M3:.40, M4:.55, M5:.70, M6:.90, M7:1.0, M7end:.3, M8:.2, END:0 }`.

### 5.14 `days.js` · `cbs.js` (media) → `G.STORY.days`, `G.STORY.cbs`, `G.STORY.cbsMapo`
Copy §9.6 ② verbatim, but write organisations as tokens: `org:'{eunpyeongOrg}'` (detail `발신 {eunpyeongOrg} · 긴급재난문자`), list header
`{eunpyeongOffice}` / `{mapoOffice}`, header line `등록 지역 {eunpyeong} 새말동 · 위치 기반 수신 켜짐 (2026.12.10부터) · 데이터로 수신 중 (SIM 없음)`.
Example row: `{ d:'12-24', t:'22:52:14', org:'{eunpyeongOrg}', kind:'긴급재난문자', text:'오늘 22시 {eunpyeong} 대설주의보 발효. 내 집 앞 눈 치우기에 참여해 주세요.' }`.
Also `G.STORY.cbsSettings = [['긴급재난문자','켜짐'], ['안전안내문자','켜짐'], ['위치 기반 수신','켜짐 · 2026.12.10 다른 기기에서 동기화됨'], ['등록 지역','{eunpyeong} 새말동'], ['수신 경로','데이터(Wi-Fi)'], ['알림 소리','기본 경보음']]`.
`G.alerts.selfCheck()` runs the §9.6 ② 자동 검산 ①–⑤ (DEBUG boot).

### 5.15 `browser.js` (media) → `G.STORY.browser`
```js
G.STORY.browser = {
  start: { logo:'다온', placeholder:'검색어 입력', recentTitle:'최근 방문', recentN:3, tabs:'열린 탭 0' },
  history: [ { d:'2026-12-24', when:'오후 6:01', title:'다온 계정 – 로그아웃', page:'daonLogin' },
             { d:'2026-12-23', when:'오전 1:12', title:"다온 클라우드 – 앨범 '0310'", page:'daonLogin' } /* … 19 rows of §4.7.5 in order */ ],
  pages: { daonLogin:{ title:'{$cloudLogin}', button:'로그인' }, tankWinter:{ results:['[건물관리 블로그] 옥상 물탱크실 겨울나기 — 배관 보온재, 문틈 바람막이',
           '물탱크실 출입문 녹 제거와 경첩 손질', '옥상 물탱크실 출입 통제 안내문 양식'] } /* saemalBuilding, btBattery, articleA, articleB */ },
  search: [ { keys:['112','경찰','신고','긴급'], results:['긴급신고 앱 · 휴대전화 본인 인증(문자) 후 사용 가능', '112 문자신고 — 휴대전화 문자로만 접수됩니다'] }
            /* … every row of §4.7.5 고정 검색 결과; '0310','한결','sagongsa','—','고향의 봄' → G.e2.STR.noResult */ ],
};
```

### 5.16 `memos.js` (media) → `G.STORY.memos`
```js
G.STORY.memos = {
  n: { empty:'메모 없음', newLabel:'＋ 새 메모', placeholder:'메모 입력' },
  dash: [ { id:'dash1', title:'—', edited:'수정 2026.12.24 오후 10:49', readOnly:true, flag:'dashMemo',
            lines:(cb) => [
              cb('e1done') && cb('knock') ? { answered:'노크 잘하더라. 여기선 안 해?', four:'네 번 두드렸지. 그때 알았어, 너 똑똑한 거.', none:'그날 대답 안 한 거, 잘했어.' }[cb('knock')] : null,
              '돌려줄게.', '네가 세아 걸 엄마한테 돌려줬잖아. 그래서 나도 돌려주는 거야.', '내 집도 보여 줘야 공평하잖아.',
              cb('e1done') && cb('min') != null ? `${cb('min')}분. 세아는 1년 걸렸는데.` : null,
              cb('trap') ? '*0404# 누른 거 기억해.' : null, cb('vault') ? '보관함, 네 사진까지 봤지.' : null,
              '지문 남겨 둘게. 다음에 열어 보려고.', '04:44엔 작게 틀 거야. 너한테만 들리게.' ].filter(Boolean), his:true } ],
};
```

### 5.17 `calendar.js` (media) → `G.STORY.events`
```js
G.STORY.events = {
  banner:'계정 없음 · 동기화되지 않은 일정이 표시됩니다', month:'2026년 12월', dots:[10, 24, 25],
  items:[ { id:'move', day:'2026-12-10', title:'이사', when:'12월 10일 (목) · 하루 종일', rows:[['캘린더','다온 캘린더'], ['마지막 동기화 2026.12.24 오후 6:02','']] },
          { id:'eve', day:'2026-12-24', title:'크리스마스 이브', when:'12월 24일 (목) · 하루 종일', rows:[['대한민국 기념일','']] },
          { id:'xmas', day:'2026-12-25', title:'크리스마스', when:'12월 25일 (금) · 하루 종일', rows:[['공휴일',''], ['알림 오전 12:00','']] } ],
  notif0000: { app:'calendar', title:'크리스마스', body:'하루 종일', when:'오전 12:00', route:{ app:'calendar', params:{ day:'2026-12-25' } } },   // used by flow B07
};
```

### 5.18 `phone.js` (media, added) → `G.STORY.dial`
`G.STORY.dial = { status:'SIM 없음', recentsEmpty:'최근 기록 없음', contactsEmpty:['연락처 없음','계정이 없습니다'], emergencyTitle:'긴급 통화',
emergencyNumbers:['112','119','1366'] }` — any number → `G.e2.STR.noSimCall`, emergency numbers → `noSimEmergency`.

### 5.19 `tones.js` · `subs.js` (audio) → `G.tones` (ARCH §4.10), `G.SUBS` (ARCH §4.14)

### 5.20 `roomdata.js` (room) → `G.ROOM`
```js
G.ROOM = {
  img(key) → url,                          // = G.e2.img
  views: [ { id:'r2_door', az:0, key:'r2_door', lit:true,
             layers:[ { id:'box', pick:() => G.flag('gotPhone') ? 'p_door_box' : null, live:false },
                      { id:'ledLock', css:'led', at:() => G.IMGMETA?.led_lock, state:() => G.flag('M6') && !G.flag('M7') ? 'red' : 'green', live:true } ],
             hotspots:[ { id:'door', x:.31, y:.33, w:.30, h:.44, caption:() => '현관 철문. 안에서 잠겨 있다.', when:() => G.flag('M0') && !G.flag('M8') },
                        { id:'box', caption:'상자. 받는 사람: 601호 {N}.', closeup:'box_top_in' } /* lock panel, peephole, landlord note … §4.7.6 */ ] },
           { id:'r2_window', az:90, key:'r2_window', mask:'r2_window_mask',
             outside:{ plate:() => snowPlate(), patches:[ /* p_steps1_d, p_tank_ajar_plate, js_*_plate, p_tank_glow_plate … §8.3-3 */ ],
                       subviews:[ { key:'roof_tank', rect:() => G.IMGMETA?.tank_rect, minZoom:2, az:70 }, { key:'roof_rail', rect:() => G.IMGMETA?.rail_rect, minZoom:2, az:115,
                                  subviews:[ { key:'rail_window', rect:() => G.IMGMETA?.railwin_rect, minZoom:2.5 } ] } ] } }
           /* r2_bed (wall clock hands), r2_desk (newphone DOM screen) */ ],
  closeups: { box_top:{…}, note_card:{ front:'note_card_front', frontText:{ text:'돌려줄게. —', his:true },   // ledger #1 (DOM fallback text)
                                       back:'note_card_back', backText:['현관 도어락 관리자 카드','관리자 비밀번호'] },
              landlord_note:{ domFallback:['601호에게', '24일부터 27일까지 아들네 다녀와요.', /* … */ '— 5층 주인  12.18'], sticky:['옥탑 Wi-Fi','saemal_rooftop','비밀번호 saemal0601','12.10'] },
              newphone:{ screens:[ ['<23:30','0%'], ['<M2','2%'], ['M2','{$wipe}'], ['23:42','시작하는 중'], ['≥23:43','기기 보호', '{$frp}', '이 기기는 초기화되었습니다. 계속하려면 이 기기에서 쓰던 계정을 인증하세요.'] ] } },
};
```
(`landlord_note` and `note_card` DOM fallbacks are mandatory because their text is a clue — §9.8.)

### 5.21 `ending.js` data (flow, optional file) → `G.STORY.ending`
```js
G.STORY.ending = {
  k0110: { card:'문 앞에 강수진이 서 있다. 손전등을 바닥으로 내린다.' },
  k0120: { time:'오전 1:20', speaker:'강수진', lines:["'—' 사용자 지우지 않으셨죠? 다행이에요.", '그 사람 메모랑 사진이 다 거기 있어요. 오늘 밤엔 그 사람이 다시 못 들어오게만 해 두죠.'],
           chips:[ { id:'lock', label:'전환 막아 두기', stage:['e2_dash','locked'], reply:'네. 데이터는 그대로 남아요.' },
                   { id:'keep', label:'그대로 두기', stage:['e2_dash','kept'], reply:'알겠어요. 오늘 저희가 사진으로 다 남겨 둘게요.' } ] },
  /* k0140 (photo ① card + near-share + 알겠어요.), k0150 (chips 원본 제출할게요 / 복제하고 돌려받을게요, 와이파이는 켜 둘게요.), k0212 card (¬C1),
     k0215 (§4.10.8′ lines with variant tables), l0220, credits, check — all §4.10 verbatim */
};
```

---
## ARCH §6 — Debug / QA surface (core + flow)

### 6.1 Switches
`G.DEBUG` (ARCH §4.2): `CONFIG.DEBUG === true` or `?debug=1` on any host except `*.pengueverything.cloud` (deploy ignores `?debug`).
DEBUG shows hotspot/`IMGMETA` rects (room), a corner budget meter (core: his lines from data tags, `dir.himTone`, jumps, monos; red when
over), `G.alerts.selfCheck()` errors, missing-hook warnings, and enables `window.haru`. `?debug=1&series=S4` injects a bible-§9.3 QA
profile (S1–S10) before `seriesBoot` (core). `?debug=1&jump=M5` calls `haru.jump('M5')` after boot (flow main).

### 6.2 `window.haru` (core creates the object in `e2.js`; owners add their helpers in their own files, only when `G.DEBUG`)
| helper | owner | behaviour |
|---|---|---|
| `haru.state()` · `haru.flags()` · `haru.vars()` | core | deep copies; `flags()` = names that are on, in set order |
| `haru.flag(name, on=true)` · `haru.fact(name)` | core | raw set (no prerequisites) |
| `haru.jump(id, {commit=false})` | core (prereq table below) + flow (`G.main.resumeFrom`) | sets every prerequisite flag/var in order with spaced `pm` values (now − n·1000), moves the clock, then calls `G.main.resumeFrom(G.state)` (which calls `G.room.refresh`, `G.climax.resume`, `G.ending.resume`, `G.hook.resume`) |
| `haru.setUser(id)` | shell | `G.users.switchTo(id, {instant:true})` (no M2 side effect unless M1) |
| `haru.time(scale)` | core | multiplies playMs accumulation (1 = normal, 10 = clock ×10 — §11.3 시계 ×10) |
| `haru.skipTo(beatId)` | flow | runs that beat record now (ignores when/until/safe), marks fired |
| `haru.clearSave()` · `haru.clearSeries()` | core | ep2 save + sessionStorage / series record (DEBUG only) |
| `haru.series(profile)` | core | inject S1–S10 fixture (§9.3 QA table) |
| `haru.type(text)` | core | inserts text into `G.ui.focusedField()` through the same composition path (so predict bar updates) |
| `haru.answer(s)` · `haru.answerTable()` | core | `G.e2.answerOk(s)`; runs the 38 sentences of §10 D and returns mismatches (must be `[]`) |
| `haru.budget()` | core | `{hisLines, himTone, jumps, monos, tts}` |
| `haru.room(view, sub?)` | room | open the room at a view in camera mode |
| `haru.climax(state)` | room | `'drill'|'c2'|'lure1'|'lure2'|'siren'` shortcuts for climax QA (§10 I five cases) |
| `haru.notebook(id, tier)` | flow | reveal a hint tier ignoring waits |

**`haru.jump` prerequisite table** (cumulative; user forced as listed; everything else default):
| id | adds |
|---|---|
| `M0` | introDone, recapShown, M0, roofLight |
| `M1` | gotPhone, boxNote, boxHand, polaroidSeen, seenNote, M1 · user n · lock hidden |
| `M2` | factSmart, factFinger (+ bioOpened) → M2 |
| `M3` | factKbd (+ kbdListOpened), factCbs (+ cbsOpened, tlOpened, cbsDays/tlDays ['12-15']), dashSeen, pinPadOpened, M3 · user dash |
| `M4` | dashMemo, dashA0310, dashARoof → factDash, mono2, M4 · user n |
| `M5` | b09Cue, M5 (fake 00:16 lines appear via social `flag:M5`) |
| `M6` | roofLight off + peepholeTaped on (B12), director marks B12 · B13 fired, M6 (climax.resume starts the drill; clock 00:24) |
| `M7` | M7, sirenBy 'time', footprints 1, director marks B15 · B17 · B18 fired (climax.resume shows post-00:41 state) |
| `M8` | roofLight on (00:50), director marks B16 · W06 fired, M8 (ending.resume → door view) |
| `END` | doorOpened, peepholeTaped off, footprints 2, `G.media.bt.retire()`, user n, dashChoiceDone (stage.e2_dash 'locked'), pol1Shown, phoneChoiceDone (stage.e2_phone 'police'), jiminReturn, answeredRight (stage.e2_jimin true), END · commit only if `{commit:true}` |
| `HOOK` | kangWrapDone, HOOK |

### 6.3 Stable DOM hooks — `data-qa` (every owner MUST add these; values are exact)
Format `data-qa="<area>.<thing>"`, list items `data-qa="<area>.<thing>:<id>"`. Never translate/rename. Sliders also expose
`role="slider" aria-valuenow`. Hold targets respond to `pointerdown` + `pointerup` after ≥ hold ms (Playwright `mouse.down/up`).
| owner | data-qa values |
|---|---|
| flow scenes | `title.start` `title.continue` `title.restart` `title.hookReplay` `title.recanon` `title.inapp.ok` `warn.ok` `ear.left` `ear.right` `ear.speaker` `ear.none` `ear.retry` `ear.silent` `ear.start` `recap.skip` `pause.btn` `pause.resume` `pause.opt:<setting>:<value>` `pause.title` — `pause.opt` pairs (= `G.settings` key:value): `scares:full` `scares:light` · `textSize:0.9` `textSize:1` `textSize:1.15` · `audioMode:ear` `audioMode:speaker` · `subs:info` `subs:all` · `vibration:true` `vibration:false` · `reduceShake:true|false` · `reduceFlash:true|false` · `e1MyMsgs:true|false` |
| flow notebook | `nb.fab` `nb.close` `nb.tab:todo|hint|memo` `nb.card:<id>` `nb.hint:<id>:<1|2|3>` `nb.memo` |
| flow ending/hook | `card.continue` `card.chip:<id>` (`lock` `keep` `police` `kept`) `credits.skip` `check.continue` `hook.play` `hook.wave` `hook.home` |
| shell phone | `statusbar` `statusbar.pause` `home.app:<appId>` `home.widget` `home.bar` (home indicator — tap = home) `nav.back` (every `G.ui.screen` header back button) `qs.panel` `qs.tile:wifi|bt|flash` `qs.user:n|dash|add` `notif:<id>` `banner:<id>` `dialog.btn:<value>` `sheet.btn:<value>` (values: `ok` `cancel` `delete` `block` `add` `disconnect` `restart` `change`) `share.accept` `share.decline` `vol.panel` `vol.slider:media` `vol.close` `toast` |
| shell lock | `lock.surface` (swipe area) `lock.finger` `lock.notif:<id>` (id = notify id, e.g. `N01`, `N17`) `lock.camera` `lock.emergency` `lock.pin.key:<d>` `lock.pin.ok` `lock.pin.del` |
| shell security/settings | `switch.shell` `dashlock.surface` `pin.key:<d>` `pin.ok` `pin.del` `verify.finger` `verify.pin` `verify.cancel` `settings.search` `settings.row:<key>` `settings.back` `smart.item:<id>` `bio.finger:<id>` `bio.check` `bio.add` `bio.delete` `bio.rename` `users.row:<id>` `kbd.sort` `kbd.word:<w>` `wifi.toggle` `wifi.net:<ssid>` `wifi.gear:<ssid>` `wifi.forget` `bt.toggle` `bt.device:2층_스피커` `bt.gear` `bt.vol` `bt.disconnect` `tone.opt:<id>` `tone.reset` `tone.perChat` `perchat.row:<chat>` |
| core keyboard/widgets | `kb` `kb.key:<char>` `kb.lang` `kb.space` `kb.back` `kb.submit` `kb.predict:<0|1|2>` (holdButton renders `data-qa` = the caller's `qa` verbatim — e.g. `lock.finger`, `verify.finger`, `bio.check`) `vm.play` `vm.wave` `video.play` `video.seek` `video.vol` — voiceBubble/framePlayer prefix = their `qa` option (defaults `vm` / `video`; the hook overlay passes `qa:'hook'` ⇒ `hook.play` `hook.wave`) |
| social | `moment.tab:home|search|messages|profile` `moment.search` `moment.result:<id>` `moment.thread:<id>` `moment.requests` `moment.restricted` `moment.unrestrict` `moment.profile:<id>` `moment.menu` `moment.menu:<item>` `moment.post:<id>` `moment.comments.restricted:<postId>` `moment.settings` `chat.input` `chat.send` `chat.chip` `chat.chip.dismiss` `chat.noAnswer` `chat.msg:<id>` `talk.thread:<id>` `talk.relogin` `mail.item:<id>` `mail.folder:<name>` |
| media | `gallery.album:<id>` `gallery.item:<id>` `gallery.menu` `gallery.hidden` `gallery.info` `viewer.next` `viewer.prev` `viewer.close` `rec.item:<id>` `rec.play` `rec.loop` `rec.vol` `rec.info` `clock.alarm:<id>` `clock.toggle:<id>` `alarm.slide` `browser.search` `browser.menu` `browser.history` `browser.row:<i>` `browser.recent:<i>` `memo.new` `memo.item:<id>` `memo.editor` `cal.day:<d>` `cal.event:<id>` `alerts.tab:all|emergency|safety` `alerts.row:<d>` `alerts.gear` `tl.day:<d>` `tl.row:<i>` `tl.prev` `dial.key:<d>` `dial.call` |
| room | `room.view:<id>` `room.next` `room.prev` `room.zoom:<1|2|8>` `room.flash` `room.shutter` `room.close` `room.spot:<id>` (`door` `box` `lid` `note` `phone` `polaroid` `landlord` `peephole` `lock` `window` `stairs` `tank` `rail` `steps` `bed` `boxes` `clock` `sink` `newphone` `mug` `handle`) `closeup.close` `note.flip` `newphone.power` `newphone.emergency` |

### 6.4 §11.3 speedrun as selectors (Playwright outline; `haru.type()` for Korean text)
"→ home" = tap `home.bar`; "back" = `nav.back`; `wait(flag)` = poll `haru.flags()`; hold = pointerdown, wait ≥ hold ms, pointerup.
1. `title.start` → `warn.ok` → `ear.left` → `ear.right` → `ear.start` (→ recap: `recap.skip` if shown) → wait 22 s (cold open) →
   `room.spot:door` (→ `p2_door_open`) → `room.spot:box` (→ `box_top`) → `room.spot:lid` (`boxHand`) → `room.spot:note` → `note.flip` (`boxNote`
   → `seenNote`) → `room.spot:phone` → drag `alarm.slide` (`gotPhone`, B02) → drag `lock.surface` up (**M1**).
2. `home.app:settings` → `settings.row:lock` → hold `verify.finger` → `settings.row:lock.smart` (`factSmart`) → back → back →
   `settings.row:bio` → `settings.row:bio.finger` → hold `verify.finger` (`bioOpened`) → `bio.finger:f2` (`factFinger` → **M2**, B05) →
   `bio.delete` → `dialog.btn:delete` → hold `verify.finger` (`fingerDeleted`).
3. back ×3 → `settings.row:general` → `settings.row:kbd` → `settings.row:kbd.predict` → `settings.row:kbd.words` (`factKbd`, `seenKbd`) → home
   → `home.app:alerts` (`cbsOpened`; ≥ 3 `[마포구청]` rows visible → `seenCbs`) → `alerts.row:12-15` → home → `home.app:timeline` →
   `tl.day:12-15` (`factCbs`, fact = 4).
4. home → tap `statusbar` (QS) → `qs.user:dash` (`dashSeen`; 2 s `switch.shell`) → drag `dashlock.surface` up (`pinPadOpened`) →
   `pin.key:0` `pin.key:3` `pin.key:1` `pin.key:0` → `pin.ok` (**M3**) → `home.app:memo` → `memo.item:dash1` (`dashMemo`) → home →
   `home.app:gallery` → `gallery.album:0310` (`dashA0310`) → `gallery.item:a9` → `video.play`, wait ≥ 10.5 s (`seenHinge`) → back → back →
   `gallery.album:roof` (`dashARoof`) → `gallery.item:rv` → `video.play`, wait ≥ 8.5 s (`seenWhistle`) → back → back → `gallery.menu` →
   `gallery.hidden` (`dashHidden`) → `gallery.item:h1` (`seenKey404`; `factDash`).
5. home → `statusbar` → `qs.user:n` → drag `lock.surface` up → wait `mono2` → wait `M4` → `home.app:camera` → `room.next` (r2_window) → wait
   `tankGlow` (B09 after B09′; ≤ 90 s) → `room.close` → `home.app:settings` → `settings.row:sound` → `settings.row:sound.notif`
   (`soundSettingsOpened`) → `tone.reset` (`toneRestored`) → `tone.perChat` (`perChatSeen`) → home → `home.app:moment` →
   `moment.tab:messages` → `moment.thread:jimin_0412` (`jiminOpened`; scroll to the end → `factJimin`) → `vm.play` (`vmPlayed`).
6. back → `moment.requests` → `moment.restricted` (`hiddenSeen`) → `moment.unrestrict` → `chat.chip` → `chat.send` (**C1**, `fakeKnown`) →
   wait 3 replies (`mono3`) → `chat.chip` → `chat.send`.
7. wait **M5** → back → `moment.thread:fake` (`fakeLineSeen`) → `chat.chip.dismiss` ([두기]) → back → `moment.thread:real` → wait
   `whereAsked` → `chat.input` → `haru.type('옥상 물탱크실')` → `chat.send` (`whereTank`) → `statusbar` → hold 0.5 s `qs.tile:bt` →
   `bt.device:2층_스피커` (wait 2.5 s → `btConnected`).
8. wait **M6** → home → `home.app:moment` → `moment.thread:real` → `chat.chip` (drill) → `chat.send` → wait `C1b` → `chat.chip` (stay down) →
   `chat.send` (`makerStayDown`) → home → `home.app:recorder` → `rec.item:uri` → `rec.play` → `rec.vol` → set `vol.slider:media` to 100 →
   wait 1.5 s (**C2**, B14) → wait **M7** (forced window view, ~40 s).
9. wait **M8** (door eye view) → `room.spot:handle` (`doorOpened`) → `card.continue` → `card.chip:lock` (`dashChoiceDone`) → `card.continue` →
   (01:40 card, `pol1Shown`) `card.continue` → `share.accept` (`nearbyTaken`) → `viewer.next` ×3 (`photo4Seen`, `seenHangyeol`) →
   `viewer.close` → `card.chip:police` (`phoneChoiceDone`) → `card.continue`.
10. wait `jiminReturn` → `banner:N16` (or `home.app:moment` → `moment.thread:jimin_0412`) → `chat.input` → `haru.type('한 마디만 나왔어요')`
    → `chat.send` → wait **END** → (`chat.chip` → `chat.send`) ×2 (jTail, j0205) → `chat.chip` → `chat.send` (m0212, C1 runs) → 02:15 card
    `card.continue` (`kangWrapDone`) → `credits.skip` → `check.continue` → wait **HOOK** → `lock.notif:N17` (`hookOpened`) → `hook.play` → wait
    end (`hookFull`, `mono4`) → `hook.play` (plays 2 → `sig_piyo`) → `hook.home` (`hookDone`, patch).

---

## ARCH §7 — Integration rules (all owners)
1. Plain JS, one IIFE per file, `'use strict'`, attach to `window.G`; no ES modules, no bundler, no top-level `await`, no `fetch` of JSON/JS
   (file:// must work; TTS WAV fetch may fail on file:// → subtitles only). Only network: the CDN fonts.
2. **Never edit a file you don't own.** If you need something from another owner: stub-guard the call, implement a local fallback, and
   list the request in your final report ("REQUEST to <owner>: …").
3. **Stub-guard every cross-owner call** (`G.x && G.x.y && G.x.y()`, `G.hooks.call`, optional data `G.STORY.k || {}`); a partial build
   (any subset of files) must boot to the title and not throw. No cross-owner calls at load time.
4. Missing assets degrade gracefully (§9.8 table): `<img onerror>` → empty state / DOM text fallback; missing audio buffer → subtitles +
   UI timers still run. No out-of-world error text (`사진을 불러올 수 없습니다` etc. forbidden — only in-world `{ghost}`).
5. `node --check <file>` passes for every JS file you touch. File header comment lists your public API, bus events, hooks, flags you set.
6. Player-facing Korean strings only from DESIGN (⊕ included) or `G.e2.STR`; all through `G.T`; name tokens (ARCH §1.1) for 구/기관.
   Gender-neutral. His lines tagged `his:true`. Any `!`, `🙂` in his lines = bug.
7. Storage: only `haru-escape.ep2.save.v1` (core), `haru-escape.settings.v1` (shared; core API), `haru-escape.series.v1` (series.js only),
   `sessionStorage['haru-escape.ep2.session']` (core API), and read-only `haru-escape.save.v1` (ep1 — only `series.js` backfill and social's
   `seaRoomMessages`). Never store player names, free text (except notebook memo + session store), images. Saved strings are raw data /
   tokens, never `G.T()` output (`G.state.threads` keep data ids + `{chip, edited}` / `{slot, ok}` per §9.2; `G.state.notifs` keep raw
   title/body). QA: play with `PLAYER_NAME='테스트이름가'`, `MAKER_NAME='만든사람나'` → 0 hits in a full localStorage dump (§10 F).
8. Timers: game logic uses the core 250 ms tick (`clock:min`, `G.e2.sched`, director 1 s tick) — no free `setInterval` for game time.
   UI animation may use rAF only while visible. Everything pauses on `visibility {hidden}`.
9. Input: in-game keyboard only (`G.ui.field`), never native `<input>`/`<textarea>`. Tap targets ≥ 44 px; text scale 0.9–1.3 must reflow.
10. Performance: ≤ 10 simultaneous HRTF panners (audio enforces); decode only visible view + 1 sub-view + 1 close-up (room); free images
    unseen 20 s.
11. Accessibility & less-scary: every informative sound gets `G.audio.sub`; `G.e2.less()` variants per §6.2 last column; reduced motion.
12. ep1 must not regress: ep1 loads only its own `js/` + `engine/series.js`. core verifies ep1 still plays to END after P-1/P-2.
13. Do not commit (the lead commits per stage). Do not push.

---

## ARCH §8 — First boot and resume (who does what)

### 8.1 First boot (no ep2 save)
| # | step | owner | detail |
|---|---|---|---|
| 1 | scripts load | all | data defined, apps registered, no side effects |
| 2 | `G.main.boot()` | flow | ARCH §4.1 init order; applies settings (`--ts`), preloads `G.PRELOAD` / `PRELOAD_GROUPS.start` |
| 3 | `G.e2.seriesBoot()` | core | §9.3 ① (ensure + backfill → `cbPreview`, `ep2Done`) |
| 4 | title | flow scenes | `{N를} 위한 방탈출! 2` · `돌려줄게` · `made by {MAKER} for {N}` · [시작하기] (· [이어하기] / `훅 다시 보기` / `이번 선택을 이야기로 남기기` when applicable) · `🎧 이어폰 권장 · 어두운 곳에서 · 약 45분`; in-app web-view card (UA test) |
| 5 | content warning [확인] | flow scenes | **`G.audio.unlock()` here** (gesture) — ARCH §9 G6 |
| 6 | earphone test | flow scenes + audio | `bell.small` 270° → [왼쪽] → 90° → [오른쪽]; wrong/`스피커예요` → `audioMode 'speaker'`; `안 들려요`/8 s → sound card (`G.e2.STR.soundCard`) [다시 듣기] [소리 없이 할게요]; footer `이 게임은 어떤 데이터도 서버로 보내지 않습니다.` |
| 7 | [시작] | flow scenes → core | `G.audio.unlock()` again (idempotent) + start TTS/buffer preparation; `G.flag('introDone')`; `G.e2.seriesStart()` (cb frozen, eps.2 started); `G.clock.start()` (playMs from here) |
| 8 | recap card (only `!G.e2.cbPreview.e1done`) | flow scenes (+ core `G.fx.mono` renderer) | 4 lines of `G.e2.MONO.recap`, [건너뛰기] → `recapShown` |
| 9 | cold open B01 (22 s) | flow scenes | `M0` (climax listens and sets `roofLight`); director `start()`; audio choreography §3.1 table; at 16 s `G.room.eyeM0()` (room), `G.director.mark('B01')` and S00 |
| 10 | M0 room chain | room (+ media `alarm:ring`) | door → `p2_door_open` (scenes sets box15 'doorOpen') → box → close-ups → phone → ring screen (box15 'inHand') → slide → `gotPhone` |
| 11 | B02 | flow scenes | box15 `cut()`, wind 1.2 s, `doorlock.close`; room exits eye mode; shell seeds N01–N03 (its own `flag:gotPhone` listener); `G.lock.show('n')` |
| 12 | M1 | shell lock | first unlock → `M1`; clock runs (core); notebook shows `이 폰`, `잠금 해제됨` (flow) |

### 8.2 Resume (§9.2 다시 열기 규칙 + §6.1.8 재개표) — orchestrated by flow `G.main.resumeFrom(state)`
| saved state | resume | owners called |
|---|---|---|
| (every resume) | [이어하기] tap = `G.audio.unlock()` (gesture) + `G.clock.start()`; then the row below | flow main, audio, core |
| no `introDone` | title (no 이어하기) | flow |
| `M0 ∧ ¬gotPhone ∧ ¬fired('B01')` (cut during the 0–16 s black part) | cold open from the start (22 s), clock 23:10 | flow scenes, room |
| `M0 ∧ ¬gotPhone ∧ fired('B01')` (eye view was already shown — §6.1.8 'M0 뒤 · gotPhone 전') | `G.room.eyeM0({resume:true})` on `r2_door`, box15 stage 'closed' looping (40 s) — scenes marks `B01` fired at the 16 s fade-in | flow scenes, room |
| `M1…M5` | `G.lock.show(vars.user)` → after unlock, shell reopens the saved app's first screen (`vars.sh.app = {id, params}`, written on every `app:open`; `camera` reopens as `G.room.open({mode:'camera', view: vars.room.view})`); `sched` continues in playMs | shell, core, room |
| `M6 ∧ ¬M7` | as above + `G.climax.resume()` (drill restarts at cycle position, wobbles kept; B14 in progress → t = 25 s state, no jump/breath) | shell, room climax |
| `M7 ∧ ¬M8` | beats already in `vars.dir.fired` are not replayed (B15 B17 B18 → result layers only); the beat clock continues from pm(M7), so B16 (00:44/00:47), W06 and the 00:50 roof light still run if not yet fired; clock < 00:47 ⇒ forced window view re-opens without the 6 s input lock; `end:m8` sched still pending | room climax, flow ending |
| `M8 ∧ ¬doorOpened` | forced door view with handle | flow ending → room |
| `doorOpened ∧ ¬END` | `G.users.forceN()` (no lock), `[—]` hidden, `G.ending.resume(vars.endStep)` | shell, flow |
| `END ∧ ¬HOOK` | `G.ending.resume(endStep)` (tail → credits → check); `G.e2.commit()` retry if `!committed` | flow, core |
| `HOOK ∧ ¬hookDone` | 03:33 lock screen (`G.hook.resume()`) | flow, shell |
| `hookDone` | title with `훅 다시 보기` · `처음부터` | flow |
Hidden-tab return: no text, no sting; ambience fades in 0.8 s (audio), director resumes.

---

## ARCH §9 — DESIGN gaps / contradictions found, and how this contract resolves them
| # | issue (DESIGN refs) | resolution here |
|---|---|---|
| G1 | DESIGN was edited to **v1.3** during this work (client decisions 2026-11-26): `마포경찰서` → `서강경찰서`, court `서울서강지법`, `내가 보낸 말 다시 보이기` default **ON**, P-1/P-2 approved, 고향의 봄 kept, MAKER_* ship empty. | Contract follows v1.3. **Assets: `v2_kang_door.wav` must say `서강경찰서 강수진입니다…`** (if generated from v1.2 text, regenerate). All 구/기관 strings via name tokens. |
| G2 | Director file: §6.1 says `ep2/js/director.js`, §9.1 `engine/director.js`. | `engine/director.js` (flow) is a data-driven engine; data `ep2/js/data/beats.js` = `G.BEATDATA2`. |
| G3 | §9.6 `G.STORY.kbd` is stale vs §3.5/§4.6.5 (v1.2 fix #34): `ㅅ` order, `택배`/`ㅋㅋㅋㅋ` as {N}'s personal words, `common` list. | §3.5/§4.6.5 win: 15-word personal list, his words first in table order, system words fill (ARCH §5.4). |
| G4 | User/security API named three ways (§5.4 `G.security.user/switchTo/fingerAuth/smartUnlocked`, §9.6 `G.users.*`/`G.security.verify/autoUnlocked`, §9.1 `G.phone.user()`). | Canonical `G.users.*` + `G.security.*`; all DESIGN names exist as aliases (ARCH §4.9). Lock line needs network vs device → `trustState()`. |
| G5 | Fired-beat storage: §6.1.2 `vars.fired[id]=playMs` vs §9.2 `vars.dir.fired: []`. | `vars.dir.fired = {id: playMs}`. B09 time for the M6 formula = `G.pm('tankGlow')`. |
| G6 | §9.7: audio unlocks only on the earphone test's [시작], but the test bell must play before [시작]. | Unlock on the content-warning [확인] tap (title/warning stay silent; first sound = test bell); [시작] re-unlocks idempotently and starts preparation. |
| G7 | Voice-message playback while BT is connected: route? C2? `c2Src` only `rec`/`video`. | Voice messages go through `G.media` (route to BT like a real phone, count for wobble/C2); `c2Src` = `'rec'` only for the recorder, otherwise `'video'` (generic `그 소리` wording). |
| G8 | §5.3/§4.8 "same chat → one sound per 10 s" vs B10 "his tone ×3 at 2.5 s". | `notify({coalesce:false})` for N06–N08 only; default coalescing for everything else (real {MAKER} ≤ 3 rule kept). |
| G9 | Notebook `fake` title depends on whether `문 열어 줘.` was ever drawn — no flag in §2.5. | New flag **`fakeLineSeen`** (social; banner via `notify:shown`, list preview or chat). Title is a function, re-evaluated. |
| G10 | C2 judge location: §7.1.5 (media) vs §9.7 (`climax.js`). | climax judges (watcher on `G.media.state()`); media exposes state/volume/cut only. |
| G11 | M2 ⓒ "first time the '—' PIN pad opens" vs §5.4 "boot chime over the 2 s switch shell". | Trigger at the **start of the first switch shell toward '—'** (`G.e2.requestM2`) — the pad always follows the shell. |
| G12 | Pause menu text size 3 steps vs §9.5-6 90–130 %. | Pause: 작게 .9 · 보통 1 · 크게 1.15; settings › 디스플레이 › 글자 크기 slider adds 1.3 (same `G.settings.textSize`). |
| G13 | `G.T` (ep1 `main.js`) and `G.sd` (ep1 `js/data/talk.js`) are not engine files but engine apps call them. | Moved to core (`base.js` / `e2.js`); `G.sd.note/lead` are no-ops. |
| G14 | ep1 `css/scenes.css` was not forked into `engine/css`. | Title/cards/credits/pause/hook styles live in flow's `ep2/css/ep2.css`. |
| G15 | Owner of `snow` var, of `footprints`/`peepholeTaped` transitions, and of N01–N03 seeding unspecified. | `snow` core (clock); `footprints` 1 climax / 2 ending; `peepholeTaped` on climax / off ending; seeding shell from `users.js`. |
| G16 | 01:12 maker line falls inside card mode (clock jumps 01:10 → 01:20). | Social catches up on `clock:jump` (`skipped` list) — pushes K if C1. Same catch-up rule for every clock-timed message. |
| G17 | END is displayed in social's chat but set in flow (`ending.js`) per §9.3. | Hook `end:reached({right})` called by social at the exact append moment; flow sets END + commit. |
| G18 | `series.endEp1()` (P-2) runs right after `G.flag('END', true)` but ep1 saves are debounced 400 ms. | `endEp1` reads in-memory `window.G.state` when on the ep1 page, else localStorage. |
| G19 | Settings value domains: ep1 `scares` = `'full'|'light'|'off'`, `audioMode` = `'ear'|'speaker'` (DESIGN only names 'speaker'). | `덜 무섭게` = `'light'`; `G.e2.less()` = `scares !== 'full'`; default `audioMode 'ear'`. |
| G20 | `?debug` "ignored in the deploy build" — no build step exists. | Hostname rule (ARCH §6.1). |
| G21 | §9.1 lists `js/data/*.js` without an order; three small data files are needed beyond the listed ones. | Exact order ARCH §2.1; added `data/subs.js` (audio), `data/phone.js` (media), optional `data/ending.js` (flow), `css/core.css` (core). |
| G22 | Engine CSS ownership: media's apps are styled in `apps.css` (social-owned). | media overrides/new styles in `ep2/css/media.css` (loaded after). |
| G23 | `cb.ring` screen recording plays "the bell of that night 7 s (ep1 `ringHaru`)" — no buffer id defined. | Audio adds buffer id `ringHaru7` (phone-internal, no closet reverb). |
| G24 | ep1 notebook has an `easy()` path (`G.settings.easy`); §2.4 says no 쉬움 mode. | flow removes it (T2 = T1 + 60 s always). |
| G25 | Who triggers B07's calendar notification (calendar data is media, compensation logic is director). | flow director calls `G.phone.notify(G.STORY.events.notif0000)` (data from media). |
| G26 | Moment search "no result" text (`…결과가 없습니다.`) differs from the common one (`…검색 결과가 없습니다.`). | Both whitelisted (`STR.noResultMoment` for moment search, `STR.noResult` elsewhere). |
| G27 | §9.2 `sched` example uses bare ids (`"M5"`). | Owner-prefixed ids (`e2:M5`, `social:whereAsked`, `climax:siren`, `end:m8` …). |
| G28 | Hard-mode leftovers in the forked engine (ep1 watcher lines, look-away, nudges, `G.notebook.note` calls in data helpers, `G.cutMirroring`, title/favicon tricks). | Each owner deletes them from its engine file; QA grep §10 A must show only no-op definitions. |
| G29 | Wi-Fi off: maker's tonight lines must queue and arrive later with original timestamps (§5.6) — owner unstated. | social (listens `wifi:change`), using `G.phone.wifi.connected()`. |
| G30 | `M8` = "M7 + ~72 s" vs B20 (boots → 1.5 s → voice; M8 = voice start). | ending schedules `end:m8` at pm(M7)+72 000: boots begin, `M8` set when the Kang voice starts (clock 01:09 cap → 01:10 on M8). |
| G31 | Resume of `M0 ∧ ¬gotPhone`: §9.2 says "cold open from the start", §6.1.8 says "`r2_door`, the alarm keeps ringing (40 s loop)". | Both kept, split on `G.director.fired('B01')` (scenes marks B01 at the 16 s fade-in): before → restart the cold open; after → `G.room.eyeM0({resume:true})` + box15 'closed' loop (ARCH §8.2). |
| G32 | Resume during M7: §6.1.8 "continue from the beat of the current in-game time" vs §9.2 "B15–B18 not replayed". | Fired beats are never replayed; unfired ones (B16, W06, 00:50 roof light) still run on the beat clock; forced window view re-opens without the 6 s lock when the clock is < 00:47 (ARCH §8.2). |
| G33 | ⏸ pause menu: DESIGN never says what stops. | Pause = hidden-tab rules: `G.clock.pause()` stops playMs, the tick, `G.e2.sched`, director and climax watcher; audio keeps running loops but starts no new cue; closing → `G.clock.resume()` (bus `pause {open}`). |
| G34 | 설정 root row `일반` (key `kbd`) skipped the 일반 screen; §4.6.5 path is 일반 › 키보드 › 예측 텍스트 › 개인 단어 목록; §5.4 S5 "예측 텍스트를 끄면 예측 바가 사라진다" had no state. | New settings.js key `general`; `kbd` = 키보드, `kbd.predict` = 예측 텍스트 with `예측 텍스트 표시` → new var `kbdPredictOff` read by core keyboard (ARCH §4.4, §4.11, §4.22). |
| G35 | Verification prompts: §5.4 S1 (on 잠금 화면) and §4.6.4 (on 스마트 잠금) would ask twice in a row. | One prompt per entry path (ARCH §4.22). |
| G36 | QS 손전등: §5.3 "→ 방 보기 손전등 켬" vs this file's earlier "visual toggle unless the room is open". | {N}: opens the camera room with the flash on (`G.room.open({flash:true})` / `G.room.flash(true)`); '—': tile toggles visually only. |
| G37 | Director S1 includes PIN pads (§6.1.3) and S9 needs "a system dialog/verify sheet is open" — no API exposed either. | `G.ui.inputActive()` (core) · `G.phone.modalOpen()` (shell). |
| G38 | Seven owners write CSS; the stacking of eye views, lock, dialogs, switch shell, ending cards, notebook, keyboard, subtitles was undefined (e.g. the M0 alarm screen over the eye view, the near-share sheet under an ending card). | z-index table ARCH §2.3; `forceView` calls `G.phone.dismissModals()`; flow hides its card layer while shell/media UIs it called are up. |
| G39 | Android back / Esc reach only shell's `G.phone.back()`, but the notebook, ending cards, pause menu and eye views belong to flow/room. | `G.phone.pushBack(fn)` handler stack, checked first (ARCH §4.9). |
| G40 | B23 must obey 소리 모드/방해 금지 and `덜 무섭게` −6 dB (§6.4-③); N09 is a tone with no banner (§4.8). | Hook raises N17 through `G.phone.notify` (`gainDb:-6` when less); social N09 = `notify({banner:false})`. Only shell calls `G.tones.play`. Notification ids = DESIGN N-numbers. |
| G41 | TTS ids `'_a' '_b'` (§4.13 earlier) vs files `v2_jimin_vm_a/_b`. | `G.AUDIO_FILES` keys everywhere; `G.audio.buffer('jiminVM')` alias so data `buffer:` fields resolve through one function. |
| G42 | `30초 후에 다시 시도하세요` counts down `30초`→`1초` (§4.0). | `STR.pinLock` is a `{s}` template. |
| G43 | `재생 안 됨` (§4.1.4), `불러오는 중…` (§7.1.7) and the recanon confirm (§4.10.13) are rendered by several owners but were not whitelisted. | Added to `G.e2.STR` (`unplayed`, `loading`, `recanonQ`). |
| G44 | The contract relied on ep1 engine API it did not list: `G.ui.screen`/`G.ui.list`/`G.app` (shell's phone.js), `G.ui.pinPad` return shape, `G.clock.start`, ep1 `G.fx` names (`shake`, `vignette`, `flash`, `cinema`, `pulse`; no `cover`), `G.notebook.show`. | Listed with the signatures found in `engine/` (ARCH §4.3, §4.9, §4.12, §4.17, §4.23). |
| G45 | `haru.jump` M6–END left world state inconsistent with the clock (roof light, peephole tape, BT LED, fired beats). | Prerequisite rows extended (ARCH §6.2). |
| G46 | `window.haru` was created in `G.e2.init()` but owners add helpers at load time. | Created at `e2.js` load time when `G.DEBUG`. |
| G47 | Stage writes through `G.series.stage` would break the "`G.series` only in e2.js" grep (§10 G). | `G.e2.stage(key, value)` wrapper is the only writer. |
| G48 | `G.sd.tone` mapped to ep1 tone names (`him/mom/friend/album`) that ep2 does not have, and would bypass sound mode / ledger routing. | `G.sd.tone()` is a no-op (DEBUG warn); sounds go through `G.phone.notify`. |
| G49 | Free-text renames: §5.4 says a renamed fingerprint is "세이브 저장", but §9.2 / §3.20.2 allow only bool · small int · fixed enum + notebook memo in the ep2 save; §4.6.7 also offers [이름 변경] for `2층_스피커`. | Renamed labels live in `G.e2.session` (sessionStorage, ctx `fpRename` / `btRename`); the save keeps nothing (reload → default label). The BT rename is display-only inside the Bluetooth screens — status bar, volume header, toasts and `G.e2.STR` keep `2층_스피커`. |
| G50 | Saved notification/thread text would contain the expanded player name (§10 F dump test). | Saves keep raw data strings / ids; `G.T` only at render (ARCH §4.9 notify, §7 rule 7). |

---

## ARCH §10 — Acceptance checklist per owner (abridged; full list = DESIGN §10)
- **core**: `G.T` table; save/load/memory-mode; clock reproduces §2.2 minute table with `haru.time(1)`; M2/M4/M5/M6-due formulas unit-tested
  incl. '—' holds; `answerOk` 38/38; series S1–S10; P-1/P-2 diff = 3 lines; Caddy hides `/work/*`; ep1 regression to END;
  `G.clock.pause()` freezes playMs/sched (pause menu) and `start()` is not called before introDone; `G.ui.inputActive()` true on a PIN pad;
  `window.haru` exists before any app file loads (DEBUG); `grep "G.series" ep2/js` = `e2.js` only.
- **audio**: every cue in ARCH §4.13 audible + correct azimuth; GSM never moves off 70°; ledger ≤ 11 on max path; hinge.none windows silent;
  speaker-mode arcs only on listed cues; iOS resume chip.
- **shell**: soft-lock proofs §2.3-1 (finger always works, last own finger undeletable, Wi-Fi/BT off); QS row rules; notification routing per
  user; predict provider unit tests §9.6 ①; no predict DOM on PIN pads; `예측 텍스트 표시` off removes the bar for that user only; ep1
  `G.ui.screen`/`G.ui.list` signatures unchanged; `G.phone.pushBack` order (notebook > cards > eye view > overlays > lock > stack); every
  settings row has `settings.row:<key>`; N09 plays a tone with no banner; N17 obeys 소리 모드/방해 금지.
- **social**: 19 hidden lines with clock schedule + cancellation; C1 table incl. variants; where judging; END interaction (`읽음` every send,
  first-wrong line once); his-line tags; `seaRoomMessages` toggle behaviour.
- **media**: timeline renders = §4.6.10 table (self-check); `factCbs`/`seenCbs` incl. 130 % text; video reach rules; dash no-delete; alarm
  details view-only; received viewer flags.
- **room**: layer matrix §8.3-3 with in-view cross-fades; sub-view switching; forced views; climax five cases (§10 I) with correct
  `sirenBy`/times; B14 sequence timing; M6 ≥ B09 + 120 s.
- **flow**: notebook show/done table + title auto-check; director safe zones/cooldowns; beat runner map; ending order (END before mom/
  {MAKER}/Kang summary); commit once; hook patch; resume table (both M0 rows, M7 row); z-index table respected (cards hidden while
  `lockDash` / near-share / received viewer are up); the §6.4 selector speedrun runs end-to-end with `?debug=1`.
- **all owners**: z-index values of ARCH §2.3 only; every cross-owner UI layer registers `G.phone.pushBack` when it consumes back.
