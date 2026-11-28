# 하루를 위한 방탈출! 3 「엄마의 번호」 — Implementation contract (ARCH_EP3)

> Source of truth for **what** to build: `docs/DESIGN_EP3.md` **v1.0** (편집본 2026-11-27 · §0–§12 · lead decisions §12.5 · when §12.2 Vn
> and an older DESIGN record disagree, §12.2 wins).
> Source of truth for **how the code is split and wired**: this file. **7 build agents** (core · audio · shell · comms · media · room ·
> flow) code against it **in parallel without talking to each other**, plus the asset agent (already running — not reassigned).
> Template / precedent: `docs/ARCH_EP2.md` (contract rev 2) and episode 2 as built (`ep2/`, `docs/DESIGN_EP2.md`). Series rules:
> `docs/SERIES.md` · directive `docs/EP3_DIRECTIVE.md` (SERIES §13 draft v0.3).
>
> Reading rule: `§x.y` alone = DESIGN_EP3 section. `ARCH §n` = a section of this file. `ARCH2 §n` = ARCH_EP2. `bible §x` = SERIES.md.
> `dir §13.x` = EP3_DIRECTIVE. Engine names marked "(engine)" were checked against `engine/` in this worktree (branch `ep3`, after
> commit 106b907).
> When DESIGN and this file disagree on **APIs, ownership, file names, event names, data-qa values, class prefixes** → this file wins.
> When they disagree on **player-facing text, numbers, timing, puzzle logic** → DESIGN wins, except the explicit resolutions in
> ARCH §9. Do not invent player-facing Korean strings: every string you render is quoted from DESIGN (⊕ lines included) or from
> `G.e3.STR` (ARCH §5.3 — the system-string whitelist = DESIGN §10 A).
> Workplace: the git worktree `C:\Users\Admin\game1\work\ep3wt` (branch `ep3`). Never touch the main checkout (`C:\Users\Admin\game1`
> outside `work\ep3wt`). Build agents do not run state-changing git commands (no commit/checkout/reset/stash/branch/merge/push).

> **2026-11-28 (DESIGN_EP3 §12.7) — 이 계약에서 더는 맞지 않는 것.** 아래 본문의 옛 문장에는 `(12.7에서 삭제/변경)`을 달아 두었고 지우지 않았다. 요약: (1) 공개 시각 · `Date.UTC` · `?preview=1` 우회 · 공개 전 반환은 없다 — `RELEASES = { 2: 0, 3: 0 }`이고 `gate.js`는 `G.series.isReleased(3)`이 참일 때만 여는 잠금 없는 gate이며 엔진이 없거나 거짓이면 선택 화면(`../series/`)으로 닫힌다(§5.5) · (2) 크레딧은 제목 한 줄, 점검 카드는 112 · 1366 한 줄 + `계속`, 경고는 한 줄, 타이틀의 시간 · 이어폰 권장 줄 · 데스크톱 안내 줄 · 이어폰 테스트의 결과 줄과 바닥 글 · `게임 속 단순화` 줄은 없다 · (3) 루트 `index.html`은 선택 화면으로 가고 1편은 `ep1.html` · (4) 타이틀 · 선택 화면 부제는 1·2편과 같은 손글씨. 현행 문자열의 정본은 `ep3/js/data/*.js`와 DESIGN_EP3 §12.7이다.

---

## ARCH §1 — CLIENT OVERRIDE (supersedes DESIGN, this file, and any task brief)

> ## ⛔ OVERRIDE FROM THE CLIENT
> **No camera, no microphone, no sensors, no permission prompts. Only pure in-app tricks.**
> - Never call: `getUserMedia`, `DeviceMotionEvent`, `DeviceOrientationEvent`, `navigator.geolocation`, `navigator.bluetooth`,
>   `navigator.clipboard`, `navigator.contacts`, `Notification.requestPermission`, `navigator.permissions`, `requestFullscreen`,
>   Web NFC, Media Session, `speechSynthesis`, no `tel:` / `sms:` links, no real dialling. 착신 · 통화 · 통화 녹음 · 텍스트 변환 · 112 ·
>   문자 · 방해 금지 · 쉬운 모드 are **all in-game fake phone UI drawn from prebuilt data** (§9 head). The "camera" app is the prebuilt
>   room view (no stream). `navigator.vibrate` (output) is allowed with exactly two patterns — `[400,200,400]` at the 03:33 ring
>   (`덜 무섭게` → none) and `[80]` on an SMS arrival — and every vibration carries the same information on screen and/or in sound.
>   iOS has no vibrate: the replacement is the sound and screen that already exist — **never a screen shake** (§9.7 · §12.2 V10).
>   `navigator.wakeLock.request('screen')` is allowed (no prompt; ignore rejection). No `<audio>`/`<video>` elements (WebAudio only).
> - **HARD MODE — no unsolicited hints.** `G.notebook.note/lead/leadDone/flash/autoHint` and `G.sd.note/lead` stay **no-ops**
>   (DEBUG warns). No tutorial subtitles, no "~해 보자" toasts, no hint inside an error/empty message, no ghost hand, no forced view
>   rotation, no lead list, no "새 단서" dot, no idle nudge, no look-away log, no tab-title/favicon tricks, no system popup a real
>   phone would not show (only `G.e3.STR` strings + DESIGN screen text). Notebook cards appear **only after the player saw the
>   target screen** and their titles are strings already drawn (exceptions `call` · `phone` · `soup@gotPhone`, §2.4). 엄마 · 지민 ·
>   강수진 · 순찰팀 say only what they saw, remember or feel — **zero instructive lines**. The **only** hint channel is the notebook's
>   hold-to-reveal 3-tier hint (2 s hold, T2 = T1 + 60 s, T3 = T2 + 60 s, T3 states the answer). Failure = time only; no game over;
>   no soft-lock (§2.3 proofs are acceptance tests).
> - **No reuse of episode-1 or episode-2 tricks** (§0 head · §5.0-2 · §5.6 '끈다' column · dir §13.9): no notification-history screen,
>   no storage/usage statistics, no shared-album 'new photo' banner, no '1년 전 오늘' / memories / LIVE / hidden items / exposure edit,
>   no recorder spectrum / pitch / speed / loop / gain / denoise / EQ / trim, no voice-message overlay or waveform zoom, no Bluetooth
>   output, no notification-tone restore or per-chat tones, no smart lock / fingerprints / users / learned keyboard words (**the
>   in-game keyboard draws no predict bar in ep3**), no 재난 알림 / 타임라인 / 계산기 / 해솔홈 / 모먼트 / 녹음(`recorder.js`) apps, no
>   contact-modified dates, no '다른 기기가 관리하는 알람', no '알 수 없는 기기' event, no event 'created' meta line, no mono-audio /
>   sound-amplifier settings. Ep1/ep2 engine **features** may be reused; ep1/ep2 **tricks** may not. `engine/apps/moment.js`,
>   `engine/apps/recorder.js`, `ep2/js/apps/security.js`, `ep2/js/apps/alerts.js` are **not loaded** by ep3.
> - **He never watches this phone tonight.** Zero code paths where he reacts to UI actions, reloads, sent messages or calls. He is
>   never heard (no voice, breath, whistle, footsteps, GSM buzz, notification tone). His only new text is the 06:10 blocked message
>   (§3.19 — `!` 0 · `?` 1 · `ㅎ`·`ㅋ` 0 · `🙂` 0). Calls to his number always end in the carrier text (§0.1 #16).
> - **Grief episode budget**: jumps **0** · big dread **1** (`B13` 04:40 '삐삐삐') · soft sting **exactly 1** (`B21` 06:10 third boiler
>   ignition). Master peak ≤ −14 dBFS, no 50 ms RMS rise > +18 dB over the previous 250 ms, screen transitions ≥ 0.4 s, no shake class,
>   no forced rotation, no `silenceDrop`, no `cls:'jump'`, no `sting.*` cue, no scare on any failure path (§6.1.0 · §6.4-③).
> - Gender of {N} is never fixed: no pronouns/titles/clothes/age/job; text uses tokens only (ARCH §1.1). {MAKER} appears **only** in the
>   credits line `만든 사람 {MAKER} · {N}에게`; no invented private facts; **no new CONFIG keys** (`CONFIG.LETTERS.ep3` is not read). (12.7에서 삭제/변경 — 크레딧은 제목 한 줄뿐, 화면에 {MAKER} 0)
>   No Daejeon dong/complex names anywhere (`{daejeon}` = `대전 서구` only, §0.1 #26). Faces of 엄마 · 지민 · young 세아 = 0. 콩이 is
>   never hurt or threatened. No sentence or staging blames 엄마 — the subject is always "그".

### 1.1 Token rules (`G.T`) — engine `engine/core/base.js` (unchanged in ep3)
`G.T(str)` is the only text-expansion function (engine). Every owner passes every player-facing string through `G.T` **at render time**.
| token | expands to | notes |
|---|---|---|
| `{N}` | `CONFIG.PLAYER_NAME` (default `하루`) | `{N} 씨` (엄마 · 지민) and `{N} 님` (강수진) are literal suffixes — no josa change needed |
| `{N야}` `{N아}` · `{N가}` `{N이가}` · `{N는}` `{N은}` · `{N를}` `{N을}` · `{N랑}` · `{N이}` · `{N의}` · `{N와}` `{N과}` · `{N로}` | name + josa by 받침 (engine `josa()`) | the whisper line `{N야}` (`하루야` / `민준아`) |
| `{police}` `{policeShort}` `{daejeon}` + the 9 ep2 name keys | `G.STORY.names[key]` (core, `config.ep3.js`) | `{police}` = `서강경찰서` · `{daejeon}` = `대전 서구`. Data files write tokens, never the literals (QA greps `서강경찰서` outside `config.ep3.js` and the TTS tool files = 0) |
| `{MAKER}` | `CONFIG.MAKER_NAME` (engine default `너의 친구`) | **credits line only** (§0.3 D24). `{MAKER_CONTACT}` `{MAKER_HON}` `{MAKER_ID}` are unused in ep3 (grep 0) |
| `{$key}` | `G.e3.STR[key]` (ARCH §5.3), expanded first | e.g. `'{$noResult}'` |
| `{q}` `{m}` `{n}` | replaced by the caller (search term · minutes · hints) | in the engine's DEBUG allow-list |
| `{h}` `{mm}` | replaced by the caller **before** `G.T` (in-game clock — `3시 {mm}분.` · `오전 {h}:{mm}`) | not in the engine allow-list → never pass them to `G.T` unreplaced |
- Raw-josa literals are a bug: QA greps `\{N\}[가이는은를을와과랑의아야]` over `ep3/` → 0 (§12.2 V12 — use `{N가}` etc.).
- **Saved state never contains `G.T` output**: `G.state.threads`, `G.state.notifs`, `vars.*` keep data ids / raw token strings; free
  text lives only in `sessionStorage['haru-escape.ep3.session']` (ARCH §5.3 `G.e3.session`) and the notebook memo (`vars.nb.memo`).
  QA: `PLAYER_NAME='테스트이름가'`, `MAKER_NAME='만든사람나'` → 0 hits in a full localStorage dump (§10 F).
- `G.STORY.names` (core · `ep3/js/config.ep3.js`) — copy exactly (§9.1):
```js
G.STORY = G.STORY || {};
G.STORY.names = { eunpyeong:'은평구', mapo:'마포구', eunpyeongOrg:'은평구청', mapoOrg:'마포구청',
  eunpyeongOffice:'[은평구청]', mapoOffice:'[마포구청]', police:'서강경찰서', policeShort:'서강서', court:'서울서강지법',
  daejeon:'대전 서구' };
```

---

## ARCH §2 — Directory tree, load order, CSS order, layers

```
/                                   ep1 LIVE — unchanged by ep3 (allowed diff stays: js/config.js keys + P-1…P-4, already applied)
├─ js/config.js                     NOT edited (ep3 adds no CONFIG key; reads PLAYER_NAME · MAKER_NAME only)
├─ engine/                          shared engine (ep2 fork). ep3 adds data-gated options only (ARCH §4)
│  ├─ series.js                     core — RELEASES[3] · DEFAULTS.e3_easyBack · SEEN_KEYS +3 (also loaded by ep1 + series/) (12.7에서 변경 — `RELEASES = { 2: 0, 3: 0 }`, 날짜 0)
│  ├─ core/  base.js(core, no change) audio.js(audio) spatial.js(audio) media.js(audio ★) fx.js(core) icons.js(core)
│  │         phone.js(shell) widgets.js(core) keyboard.js(core)
│  ├─ apps/  lock.js(shell) settings.js(shell) · phone.js(comms) talk.js(comms) sms.js(comms, NEW) moment.js(comms, not loaded)
│  │         gallery.js calendar.js clock.js memo.js mail.js(★) browser.js recorder.js(not loaded) (media) · camera.js(room)
│  ├─ room/  room.js (room)
│  ├─ notebook.js · director.js (flow)
│  └─ css/   main.css(shell) apps.css(comms) room.css(room) notebook.css(flow)     — ep3 prefers its own ep3/css files (ARCH §4.1-7)
├─ ep2/                             UNCHANGED (ep2 regression gate). ep3 links ep2/css/{core,shell,media}.css read-only (§0.3 D35)
├─ ep3/
│  ├─ index.html · manifest.webmanifest                                   (flow)
│  ├─ css/  core3.css(core) easy.css(shell) callrec.css(comms) media3.css(media) room3.css(room) ep3.css(flow)
│  ├─ js/
│  │  ├─ config.ep3.js gate.js flags.js e3.js cards.js                   (core)
│  │  ├─ sound3.js                                                        (audio)
│  │  ├─ show.js                                                          (shell)
│  │  ├─ scenes.js call.js ending.js hook.js main.js                      (flow)
│  │  ├─ door.js memory.js climax.js                                      (room)
│  │  ├─ apps/  easymode.js (shell — new module ①) · callrec.js (comms — new module ②)
│  │  ├─ data/  assets.js (assets agent) · tones.js subs.js (audio) · settings.js easy.js show.js (shell)
│  │  │         e1canon.js talk.js sms.js dial.js recordings.js blocked.js (comms)
│  │  │         gallery.js calendar.js moim.js mail.js clock.js browser.js memos.js (media)
│  │  │         cards.js ending.js objectives.js beats.js (flow) · setpiece.js (room)
│  │  └─ room/  roomdata.js (room)
│  └─ assets/ img/ audio/            (asset agent — v3_mom_call.wav · v3_mom_okay.wav · v3_sea_name.wav)
├─ series/series.js · series/series.css   (core — EPS row 3 · WINS['702'] · second building)
├─ deploy/Caddyfile · deploy/README.md    (core — /ep3/assets/* cache line; @hidden already covers /work/* /docs/* /tools/*)
├─ tools/*_ep3* · ep3/assets/** · ep3/js/data/assets.js   (asset agent — do not touch)
└─ tools/qa/ep3_speedrun.js · tools/qa/ep3_branches.js    (core — QA drivers, written last, ARCH §7.4)
```
★ = ownership differs from ep2: `engine/core/media.js` core → **audio** (ep3's only change there is the route/chain layer, which is
audio's DSP); `engine/apps/mail.js` social → **media** (read-only inbox in the 폴더; comms is the heaviest owner). Also moved (not
starred above): `engine/apps/phone.js` media → **comms** (ep2 header says "owner: media" — in ep3 it is the standard phone; `G.mdu`
inside it stays frozen for media) and `engine/apps/talk.js` social → **comms**.

### 2.1 `ep3/index.html` — exact `<script>` order (flow writes it; every owner relies on it)
Data files run **no cross-owner code at load time** (define objects / lazy functions only). Apps register with `G.app` at load
(core `phone.js` is loaded before every data file, so `G.app` exists). Every file must tolerate any later file being absent.
```html
<script src="../js/config.js"></script>
<script src="js/config.ep3.js"></script>
<script src="../engine/series.js"></script>
<script src="js/gate.js"></script>                     <!-- first executing code: fail closed before release (ARCH §5.5) -->
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
<script src="js/e3.js"></script>                       <!-- G.e3 · G.e2 = G.ep = G.e3 · G.sd · window.haru (DEBUG) -->
<script src="js/cards.js"></script>                    <!-- G.cards · G.chips -->
<script src="js/sound3.js"></script>                   <!-- registers ep3 vias / IRs / ambiences / cues / buffers on G.audio -->
<script src="js/data/assets.js"></script>
<script src="js/data/e1canon.js"></script>
<script src="js/data/tones.js"></script>
<script src="js/data/subs.js"></script>
<script src="js/data/cards.js"></script>
<script src="js/data/ending.js"></script>
<script src="js/data/settings.js"></script>
<script src="js/data/easy.js"></script>
<script src="js/data/show.js"></script>
<script src="js/data/talk.js"></script>
<script src="js/data/sms.js"></script>
<script src="js/data/dial.js"></script>
<script src="js/data/recordings.js"></script>
<script src="js/data/blocked.js"></script>
<script src="js/data/gallery.js"></script>
<script src="js/data/calendar.js"></script>
<script src="js/data/moim.js"></script>
<script src="js/data/mail.js"></script>
<script src="js/data/clock.js"></script>
<script src="js/data/browser.js"></script>
<script src="js/data/memos.js"></script>
<script src="js/data/objectives.js"></script>
<script src="js/data/beats.js"></script>
<script src="js/data/setpiece.js"></script>
<script src="js/room/roomdata.js"></script>
<script src="../engine/room/room.js"></script>
<script src="../engine/apps/lock.js"></script>
<script src="../engine/apps/phone.js"></script>          <!-- defines G.mdu (shared by the media apps) — keep first among apps -->
<script src="../engine/apps/talk.js"></script>           <!-- defines G.chat (used by sms.js) -->
<script src="../engine/apps/sms.js"></script>
<script src="../engine/apps/mail.js"></script>
<script src="../engine/apps/gallery.js"></script>
<script src="../engine/apps/camera.js"></script>
<script src="../engine/apps/memo.js"></script>
<script src="../engine/apps/clock.js"></script>
<script src="../engine/apps/calendar.js"></script>
<script src="../engine/apps/browser.js"></script>
<script src="../engine/apps/settings.js"></script>
<script src="js/apps/easymode.js"></script>
<script src="js/apps/callrec.js"></script>
<script src="../engine/notebook.js"></script>
<script src="../engine/director.js"></script>
<script src="js/show.js"></script>
<script src="js/scenes.js"></script>
<script src="js/call.js"></script>
<script src="js/door.js"></script>
<script src="js/memory.js"></script>
<script src="js/climax.js"></script>
<script src="js/ending.js"></script>
<script src="js/hook.js"></script>
<script src="js/main.js"></script>
```
Not loaded: `engine/apps/moment.js` · `engine/apps/recorder.js` · any `ep2/js/*` file (G.e2 comes from `e3.js` — §9.1).

### 2.2 `<head>` and CSS order (flow writes; owners keep their CSS in their own file)
`<title>하루를 위한 방탈출! 3</title>` (fixed — screen title only is `{N를} 위한 방탈출! 3`), `meta description` / `og:title` /
`og:description` fixed `하루를 위한 방탈출! 3` · `엄마의 번호`, `og:image` `https://haru.pengueverything.cloud/ep3/assets/img/og_ep3.jpg`,
icon `assets/img/icon_ep3.png`, `manifest.webmanifest` (`name 하루를 위한 방탈출! 3` · `short_name 방탈출 3` · scope/start_url `/ep3/` ·
standalone · portrait · icons 512/192 maskable — §9.9). Viewport/apple metas copied from `ep2/index.html`. Fonts: the same CDN links and
versions as ep2 (Pretendard 1.3.9 jsDelivr · Google Fonts Gowun Batang · Gaegu) **plus `Nanum+Brush+Script` and `Gamja+Flower` in the
same Google Fonts link**, non-blocking (`media="print"` → `all` on load + `<noscript>` copy). **Nanum Pen Script is not linked in ep3**
(§0.3 D30 — it is "his hand"). **No `<link rel=preload>`** (the gate must be able to bounce a pre-release visit first). Then: (12.7에서 변경 — ep3는 Nanum Pen Script도 링크한다: 타이틀 · 선택 화면 부제만 1·2편과 같은 손글씨. 엄마 · 세아의 손은 그대로 Brush · Gamja. `pre-release visit` 걱정도 없다 — 공개 전 방문 자체가 없다)
```
../engine/css/main.css → ../engine/css/apps.css → ../engine/css/room.css → ../engine/css/notebook.css
→ ../ep2/css/core.css → ../ep2/css/shell.css → ../ep2/css/media.css            (read-only — engine JS classes c2- sh2- md2- live there)
→ css/core3.css → css/easy.css → css/callrec.css → css/media3.css → css/room3.css → css/ep3.css
```
Body skeleton = ep2 (`#stage > #phone > #screen + #fx-layer`) + the desktop line below the frame (≥ 700 px only) with the ep3 text
`🎧 이어폰을 끼고 조용한 곳에서 하세요. 휴대폰으로 하면 더 가까이 들립니다.` (§4.0 · §12.2 V22 — not ep2's text).
Class prefixes per owner (no collisions; existing engine classes keep their names): core `c3-` · audio `au3-` · shell `sh3-` (easymode
`ez3-`) · comms `cm3-` (callrec `cr3-`) · media `md3-` · room `rm3-` (+ the DESIGN effect classes `led3 win3 ring3 cal3 steam3 g3-*
srspill ceilglow momshadow`) · flow `fl3-`. Overriding ep2 CSS = a later rule in your own ep3 file; never edit `ep2/css/*`.

### 2.3 Layer stack inside `#screen` (z-index — every owner uses exactly these values)
| z | layer (class/id) | owner | notes |
|---|---|---|---|
| 0 / 5 | `.wallpaper` / `#home` (standard home · easy home rendered into it) | shell | |
| 10 | `#app-stack` — every app screen, incl. the room **camera mode** and every callrec / easymode screen | shell (+ apps push) | |
| 30 | `#lock` — the easy lock skin (first unlock only) | shell | |
| 45 | `.rm3-eye` — room **eye views**: M0 cold open · 03:33 cut · END cut · tail settle cut · 06:10 hook cut | room | above lock and apps; while any eye view is open room keeps `#screen.eye-mode` (engine rule `main.css` l.79: status bar · home bar · banners hidden, QS blocked) |
| 46 | `.cm3-emerg` — the lock `긴급 통화` keypad overlay (`phone:emergency`) | comms | above the lock (30), below the call screen it opens |
| 47 | `.sh3-call` — call screen `G.phone.callScreen` | shell | above lock, eye views and the emergency keypad |
| 50 | `#overlays` — dialogs, `G.phone.sheet`, QS panel, toasts, callrec bottom sheets (⋮ menu, 세부 정보) | shell | |
| 60 | `.sh3-show` (`엄마에게 보여 드리기`, top-left) · `.nb-fab` (✎, top-right) | shell · flow | on desktop `.sh3-show` sits outside `#phone` (top-left of the frame) |
| 70 / 75 | `#banners` / `#statusbar` | shell | |
| 90 | `.home-bar` | shell | |
| 150 | `.c3-card` — name/situation cards, chip sheets, set-piece cards, tail cards (story · react modes) | core (`G.cards`) | react mode is anchored under the phone screen; story mode is full-width but **bottom-anchored**: the layer root is `pointer-events:none` and never covers the top 56 px strip, so `.nb-fab` (60 — "수첩은 착신 · 04:40 · 클라이맥스 중에도 열린다", §2.3 증명 12) stays visible and tappable above every card; only the card box / chip row take taps |
| 200 | `.fl3-scene` — title, content warning, earphone test, pause menu, credits, check card, hook `[처음 화면으로]` bar | flow | |
| 300 | `#fx-layer` — sound subtitles, monologue (+ recap lines), direction arcs, vignette | core | |
| 400 | `.notebook` | flow | always reachable (03:33, 04:40, climax included) |
| 450 | `.kb` (in-game keyboard — never a predict bar in ep3) | core | above the notebook (notebook memo uses it) |
| 460 | `.c2-black` (`G.fx.black`) | core | hook 2 s black |
| 500 | resume chip `🔈 소리 다시 켜기` | audio | |
| 900 | DEBUG overlay / budget meter | core | |

---

## ARCH §3 — Ownership

### 3.1 File ownership (disjoint — exact repo-relative paths; ★ = new file)
| Owner | Files |
|---|---|
| **core** | `engine/series.js` · `engine/core/base.js` (no change planned) · `engine/core/fx.js` · `engine/core/icons.js` · `engine/core/keyboard.js` · `engine/core/widgets.js` · ★`ep3/js/config.ep3.js` · ★`ep3/js/gate.js` · ★`ep3/js/flags.js` · ★`ep3/js/e3.js` · ★`ep3/js/cards.js` · ★`ep3/css/core3.css` · `series/series.js` · `series/series.css` · `deploy/Caddyfile` · `deploy/README.md` · ★`tools/qa/ep3_speedrun.js` · ★`tools/qa/ep3_branches.js` |
| **audio** | `engine/core/audio.js` · `engine/core/spatial.js` · `engine/core/media.js` · ★`ep3/js/sound3.js` · ★`ep3/js/data/tones.js` · ★`ep3/js/data/subs.js` |
| **shell** | `engine/core/phone.js` · `engine/apps/lock.js` · `engine/apps/settings.js` · `engine/css/main.css` · ★`ep3/js/apps/easymode.js` · ★`ep3/js/show.js` · ★`ep3/js/data/settings.js` · ★`ep3/js/data/easy.js` · ★`ep3/js/data/show.js` · ★`ep3/css/easy.css` |
| **comms** | `engine/apps/phone.js` · `engine/apps/talk.js` · ★`engine/apps/sms.js` · `engine/apps/moment.js` (not loaded — no change) · `engine/css/apps.css` · ★`ep3/js/apps/callrec.js` · ★`ep3/js/data/e1canon.js` · ★`ep3/js/data/talk.js` · ★`ep3/js/data/sms.js` · ★`ep3/js/data/dial.js` · ★`ep3/js/data/recordings.js` · ★`ep3/js/data/blocked.js` · ★`ep3/css/callrec.css` |
| **media** | `engine/apps/gallery.js` · `engine/apps/calendar.js` · `engine/apps/clock.js` · `engine/apps/memo.js` · `engine/apps/mail.js` · `engine/apps/browser.js` · `engine/apps/recorder.js` (not loaded — no change) · ★`ep3/js/data/gallery.js` · ★`ep3/js/data/calendar.js` · ★`ep3/js/data/moim.js` · ★`ep3/js/data/mail.js` · ★`ep3/js/data/clock.js` · ★`ep3/js/data/browser.js` · ★`ep3/js/data/memos.js` · ★`ep3/css/media3.css` |
| **room** | `engine/room/room.js` · `engine/apps/camera.js` · `engine/css/room.css` · ★`ep3/js/room/roomdata.js` · ★`ep3/js/data/setpiece.js` · ★`ep3/js/door.js` · ★`ep3/js/memory.js` · ★`ep3/js/climax.js` · ★`ep3/css/room3.css` |
| **flow** | `engine/notebook.js` · `engine/director.js` · `engine/css/notebook.css` · ★`ep3/index.html` · ★`ep3/manifest.webmanifest` · ★`ep3/js/scenes.js` · ★`ep3/js/call.js` · ★`ep3/js/ending.js` · ★`ep3/js/hook.js` · ★`ep3/js/main.js` · ★`ep3/js/data/cards.js` · ★`ep3/js/data/ending.js` · ★`ep3/js/data/objectives.js` · ★`ep3/js/data/beats.js` · ★`ep3/css/ep3.css` |
| **assets** (running; not reassigned) | `tools/*_ep3*` (`prep_ep3.py` `post_ep3.py` `qa_ep3.py` `jobs_ep3_pass1..3.json` `tts_ep3.json`) · `ep3/assets/**` · `ep3/js/data/assets.js` (`G.IMG` · `G.IMGMETA` · `G.AUDIO_FILES` · `G.AUDIO_META` · `G.PRELOAD_GROUPS` — ARCH §6.1) |

Nobody edits: `index.html` `js/**` `css/**` `assets/**` at the repo root (ep1 live), `ep2/**`, `docs/**` (the lead edits docs). (12.7에서 변경 — 루트 `index.html`은 `series/` 선택 화면으로 보내는 얇은 페이지이고 1편은 `ep1.html`로 옮겼다. 3편 작업이 이 파일들을 고치지 않는 규칙은 같다)

### 3.2 Owner scopes (every DESIGN item has exactly one owner)

**core** — the platform and the series plumbing. Implements: `config.ep3.js` exactly as §9.1 with this file's additions (`G.EP`,
`G.EP.CLOCK`, `G.EP.HOME` getter, `G.EP.LOCK`, `G.EP.STATUS`, `G.EP.QS`, `G.EP.KBD`, `G.EP.mediaRoute`, `G.EP.DEFAULTS`, `G.STORY.names`,
`G.DEBUG`, `G.EP.VIB`); `gate.js` (§9.9 — copy of `ep2/js/gate.js` with `isReleased(3)` and `fl3-*` classes); `flags.js` = the §2.5/§9.2 state (12.7에서 변경 — `isReleased(3)`은 항상 참인 잠금 없는 gate. 현행 계약은 §5.5 끝의 12.7 줄)
dictionary (`G.F`, `G.F.ALL`, `G.VARS`, `G.applyVarDefaults` — stage `{e3_played:true, e3_dnd:false, easyBack:null}`, ARCH §5.4);
`e3.js` = `G.e3` (+ `G.e2 = G.ep = G.e3`, `window.E3`): system-string whitelist `STR` (§10 A), `MONO` (mono1 · mono2 · recap 4 lines
§2.4 · §3.0), monologue queue with the M6-window drop rule (§6.1.3 · §0.3 D4), image resolver (§8.3-1 rules), `cb` computation and
freeze (§3.17.1 · §9.3 ①②), `commit` (④) with retry, `hookPatch` (⑤), `stage`, session store, persistent playMs scheduler, `norm`,
date/time formatters with the §0.1 #18 year rule, **hub counter + M2 · M3 · M4 · M5 · M5 album fallback · `m6:due`** (§2.1 · §3.11),
battery decay (§2.1 · §9.1), `momAt` writer, `G.sd` (ep2 helper set), the `window.haru` base + `haru.jump` table (§11.4 · ARCH §7);
`cards.js` = `G.cards` / `G.chips` (the shared card + chip layer every set piece, reaction and tail uses — slow reveal 70 ms/char,
1.2–2.0 s gaps, tap to advance, editable chips with `[보내기]`/`[말하기]`/`[두기]`, timeouts, M6 force-close — §1.1 · §4 읽는 법 ·
§3.2.2 · §6.1.3 S7/S8 · §9.5-4 칩); `fx.js` (subtitles, monologue/recap renderer, vignette, black; `edgeShake` stays a no-op when
`G.EP.noShake` is set — ep3 sets it); `icons.js` (ep3 icons: `sms` `moim` `voicerec` `files` `weather` `folder`, easy-tile glyphs, the
two-hands-phone show icon — engine SVG, no emoji glyphs §5.0-5; `sms` `files` `weather` already exist); `keyboard.js` (predict bar
forced off by `G.EP.KBD.predict === false` — §9.5-1 · §0.3 D38 — and no key haptic under `G.EP.VIB`); `widgets.js` (only the additive
`G.ui.inputSource` for the S1 keypads — ARCH §4.2); `engine/series.js` build-first diff (§3.17.2 · §9.3:
`DEFAULTS.e3_easyBack:false`, `SEEN_KEYS += e3_height e3_radio e3_cake`, `RELEASES[3] = Date.UTC(2027, 0, 23, 12, 0)`); root picker (12.7에서 삭제/변경 — `RELEASES[3] = 0`)
`series/series.js` + `series.css` (§9.9: EPS row 3 with `rec:'left'`, `WINS['702']`, second building x 278–316, 16 floors, lights =
`eps["3"]` done/canon, ♪ = `seen.e3_grey ∨ sea ∋ sig_name`); `deploy/Caddyfile` + README (§9.9 배포 · §10 K); `core3.css` (cards,
chips, mono/recap styling over black); QA drivers `tools/qa/ep3_speedrun.js` · `ep3_branches.js` (ARCH §7.4, written last).

**audio** — everything audible. `audio.js` / `spatial.js` / `media.js` gain the registration options of §7.1.7 (`defineVia`,
`defineIR`, `defineAmb`, `defineBuffer`, `TENSION_AMBS`, `defineMediaChain`, `definePrepare`, listener table, `hush` room level), the
`G.EP.VIB` vibration allow-list and the silent iOS fallback, and the ear/table route layer of `G.media` (per-route gains, reroute on
`room:where` / `playArmed`) without changing ep2 behaviour (ARCH §4.2); `G.media` routes through `G.EP.mediaRoute()` → `'ear'|'table'` chains when present (§7.1.5); `sound3.js` = the
whole ep3 cue library of §7.2 A–H (ARCH §5.17 table), the three listeners L0 · LS · LT and the §7.1.2 source table (`place(src)`),
vias `frontDoor hallOut srDoor srFront veranda wall`, IRs `irLiving irSea irHall` (+ engine `irStair irSmall irFar`), house layers
§7.1.4 (persisted in `vars.au`, restored on reload), the "ear phone" ducking rule (§7.1.1), tension → `amb.air` + nothing else
(§6.1.5), speaker mode (§6.1.8), less-scary table (§6.1.8), vibration keys `ring3` / `sms` (§7.1.7), TTS loading of `v3_mom_call`
`v3_mom_okay` `v3_sea_name` (§7.3), the offline render `rec.sea0333` (3 stems `near` `sea` `name` · §7.2 F track table · self-check),
the name fallback `whisper.name` (§3.7 · §4.14.2 · §0.3 D13), `rec.plain.<id>` renders, `hum.mom`, `leak.earpiece` (03:33 live),
iOS lifecycle + resume chip (§9.7), level targets + the `haru.audio.meter` check (§7.1.6 · §6.4-③); `data/tones.js` = ep3 `G.tones`
(one sound: `sms.mom` '딩동' + in-app pop — his tone 0, §4.13); `data/subs.js` = `G.SUBS` S01–S23 verbatim (§7.4 = §4.14.3 text).

**shell** — the phone's system UI, the easy-mode module and the show button. `engine/core/phone.js`: home from the `G.EP.HOME`
getter incl. a custom `render` (easy home) and **folder items** (`엄마 안 써도 됨` · `folderSeen`), widget tap → calendar, status bar
from `G.EP.STATUS` (`LTE` · Wi-Fi `집` · battery · time — no `SIM 없음`), quick panel from `G.EP.QS` (tiles `Wi-Fi` `소리` `손전등`
`방해 금지`, long-press DND → settings `dnd`, no user row, no BT tile — §5.3 · §0.3 D19), notifications/banners/panel (§4.13 — ids
N01–N09, SMS sound via `G.tones`, DND/sound-mode muting, chat-open in-app pop through hook `chat:isOpen`), `data-scr` on every pushed
node, **`G.phone.callScreen(spec)` + `inCall()`** (ep1 `P.callScreen` contract, §5.3 통화 화면 · §3.2.3 — the simulation UI; results
come from comms data), dialogs/sheets/toasts, Android back + `한 번 더 누르면 게임을 나갑니다`; `engine/apps/lock.js`: the easy lock
skin only (`G.EP.LOCK` — swipe only, `3:35` big clock, `1월 24일 일요일`, `kongi_old`, `위로 밀어서 열기`, `긴급 통화` → comms keypad
overlay, camera → room; **first unlock sets `gotPhone`, not `M1`**, never relocks — §3.1 · §5.3 · §0.3 D42); `engine/apps/settings.js`:
every 설정 screen of §3.3 · §4.7 (first screen, search with partial match + easy gating + `최근 검색어 · 통화 녹음  ×`, display, font,
easy delegation, notifications, **방해 금지 + 사용 기록** §3.9 · §4.7.3, about `엄마 폰`, Wi-Fi/블루투스 view-only, keyboard
`예측 텍스트 꺼짐`, the rest §4.7.4); `easymode.js` + `data/easy.js` + `easy.css` = module ① of §5.4 · §9.6 ① (E1–E10: easy lock skin,
easy home, easy phone, easy contact, easy SMS, switch-only gates, display › 쉬운 모드, unfold/fold 0.9 s, easy ring screen E9, 1.3×
system text) — sets `easyOff easyGate folderSeen` + `vars.easy`; `show.js` + `data/show.js` = `엄마에게 보여 드리기` (§3.2.2 · §4.10 ·
§5.3: fixed button, position cards, reaction table by `data-scr`, `glasses`, `showSeen`, the DND chip in both places) — sets
`momBlock mom331 momDnd momMembers momBom glasses dndChipSaid` + `stage.e3_dnd`.

**comms** — 전화 · 통화 녹음 · 차단 · 메시지 · 톡. `engine/apps/phone.js` = the standard phone of §5.2 전화 row (SIM, keypad →
`G.phone.callScreen`, recents of all time with search box + date groups + 🎙 rows + call detail › `녹음 1 ›`, contacts with
`통화 기록`, ⋮ `설정 · 통화 녹음 · 번호 차단` → `callrec:open`, number display rule §4.3.2, `missedSeen`, `call112First`, the lock
emergency keypad hook `phone:emergency`) + `data/dial.js` (contacts, recents, simulation results §3.2.3 · §4.3.7); `callrec.js` =
module ② (§5.5 C1–C11 · §9.6 ②: 전화 설정, 통화 녹음 설정, 녹음된 통화 + row ⋮, player, 세부 정보, **텍스트 변환** with speakers, grey
lines, line-tap playback, karaoke band, the **session API**, 번호 차단, 스팸 설명, 차단된 통화 13, 번호 상세, 차단된 메시지, 음성 녹음) +
`data/recordings.js` · `data/blocked.js` — sets `recListOpened recPlayerOpened recPlayed textAnyOpened textOpened greySeen heard21
nameKnown sigName radioHeard blockOpened blockBottom`; `engine/apps/sms.js` (new — ep1 `js/apps/sms.js` port: list, threads,
input-bar chips, ⋮ › 설정 › `번호 및 스팸 차단`, ⋮ › `차단된 메시지`) + `data/sms.js` = the 강수진 thread and every 강수진 message,
chip and reply of §3.4 · §3.12 · §4.4 (03:41, 05:02, `[두기]` +60 s, chips `kang341Sent kangNameSent kangBlockSent kang702Sent
kangAskSent`, free-text `네, 확인했습니다.`, call → 1 min SMS) — sets `kang341 kang502` and the five `*Sent` flags; `engine/apps/talk.js`
login mode + `data/talk.js` (§3.20.1 · §4.5: list, `세아 💛` reversed ep1 room with month folds, A/A′/A″ callbacks, R4 switch,
`지민이`, `나와의 채팅`, read-only groups, input rules §5.1, voice-talk dial → `G.phone.callScreen({kind:'talk'})`, redial sheet);
`data/e1canon.js` (§9.1: ep1 canonical text copied verbatim — `momMessages()` lines, ending dialogue, `SEA_MAIL`, `calls`);
`callrec.css` (callrec + phone + sms + talk tweaks). Owns `G.mdu` (defined in `engine/apps/phone.js`, frozen API — ARCH §4.2).

**media** — 사진 · 캘린더 · 모임 · 시계 · 폴더 apps. `engine/apps/gallery.js` + `data/gallery.js`: `사진 3,041` virtual grid (§8.1 ·
§0.3 D39), albums `카메라 3,041` · `옛날 사진 2` · `공유 앨범 '콩이' 8`, the **shared album** (head + avatars → 멤버, ⋮ `멤버 · 활동 ·
앨범 정보`, member detail, activity lines, photo ⓘ `올린 사람` / `봄`, captions/comments, deleted photo), viewer zoom 1–3× + `saw702`
measuring + bus `gallery:zoom`, camera-roll shots from the room shutter (§3.10 · §4.6 · §5.1 사진 row) — sets `albumOpened membersSeen
bomSeen albumDone saw702` + `vars.gal`; `engine/apps/calendar.js` + `data/calendar.js`: multi-year 2024-11 → 2027-03, yearly/weekly
repeats, event detail memo line, no 'created' meta (§3.20.2 · §4.8.1 · §12.2 V28) — sets `calCake`; `engine/apps/browser.js`: the
static `appMode` pages `moim` · `files` · `weather` (§5.0-1 · §5.2 · §4.8.2 · §4.8.4 — lead approved R16 · §12.5-2) and the 폴더 인터넷
(start screen, fixed results, device-howto searches → no result, §0.3 D16) + `data/moim.js` · `data/browser.js`; `engine/apps/clock.js`
+ `data/clock.js` (one alarm, §4.8.3); `engine/apps/memo.js` + `data/memos.js` (`메모 없음`, no new-memo button); `engine/apps/mail.js`
+ `data/mail.js` (logged-in read-only inbox of 3, §4.8.4); `media3.css`.

**room** — every picture of the flat and the three room-side set pieces. `engine/room/room.js` generalized for ep3 (two rooms `lv`
4 views + `sr` 2 views, `go:` hotspots that move `vars.where` with the first-tap caption rule, eye views without camera chrome, closeups
with crop-rect crossfades, live layers that change in view, the `motion` enter/exit option for people/dog patches, DOM effects
§8.3-5, missing-asset fallbacks §9.8, yaw → `G.audio.setYaw`) — the ep2 code path stays byte-for-byte reachable for ep2 data
(ARCH §4.2); `engine/apps/camera.js` (camera chrome, flashlight, shutter → `vars.shots`); `roomdata.js` = `G.ROOM` (hotspots, captions
§4.1.1 · §4.9, closeups, layer table §6.3 · §8.3-7, meta from `G.IMGMETA`) — sets `kongiTail0 collarSeen soupSeen0 calSeen0
heightSeen drawingSeen drawingBack manualSeen orgelSpotSeen`; `door.js` = §3.12 (M6 defer, the 04:40 → 05:05 set piece `B13`, 지민
chip + callback B, 05:02 trigger, M7) — sets `M6 bip view0AfterM6 doorDone jiminUp jiminChipSent jimin112 patrol kongiBack M7`;
`memory.js` = §3.13 (M7 cards, callback D / `hum.mom`, closeup lines, `memEarly` +30 s, 150 s fallback, the memory cards, M8) — sets
`memoryStart memoryDone M8`; `climax.js` = §3.14 (M8 entry cards, `playArmed`, session judging over the callrec bus events, position
cards, turn-away 40 s, tail line, 240 s fallback, success chip, `stage.e3_played`, END hand-off) — sets `playArmed played
playFallback`; `setpiece.js` holds the door/memory/climax card scripts; `room3.css`.

**flow** — the story's spine. `index.html`, manifest, `ep3.css`; `scenes.js`: §3.0 title (`다른 이야기` link, `훅 다시 보기`,
`이번 선택을 이야기로 남기기`, in-app card, desktop line), content warning, earphone test (`bell.small` 270° → 90°), recap card (cb.E), (12.7에서 변경 — `훅 다시 보기` → `06:10 다시 보기` · `이번 선택을 이야기로 남기기` → `이번 선택 남기기` · desktop line 삭제 · `bell.small` 안내는 `종소리를 들어 보세요.` 한 줄)
pause menu (§4.0), **M0 cold open** (B01 layering, eye view via room, 엄마 first line + taps + `momLine1`, `B02`); `call.js`: §3.1 M1
trigger, preroll `B03`, the 03:33 set piece `B04` second by second, `B05`, the 03:35 handover cards `B06`, `handover`, clock 03:35 —
sets `M1 callRing callAnswered callEnded handover`; `ending.js`: END sequence `B18` (sets `END` + `G.e3.commit()`), tail 05:35–06:00
`B19` incl. callback B/C lines, 강수진 relay, DND/album fact supplements, `{N} 씨, 폰.` chip → `G.easy.set(true)`, `B20` credits + check
card — sets `collarOn soupServed easyBackChip` + `stage.easyBack`; `hook.js`: §3.16-3 `B21` (black 2 s, `c3_phone_ring` cut, blocked
messages + pushed line, boiler sting, `[처음 화면으로]`, `G.e3.hookPatch`) — sets `HOOK hookOpened boilerSting`; `main.js`: boot,
init order, resume table §3.22/§9.2, Esc/back priority, two-finger pause, pause ⇒ `G.clock.pause()`, unlock on gestures, wake lock,
preload groups §9.8; `engine/notebook.js` + `data/objectives.js` (§2.4 · §4.15 — 13 objectives, show/done, 3-tier hints, `greyAfter
'M8'`, title auto-check); `engine/director.js` + `data/beats.js` (§6.1 · §6.2 — `G.BEATDATA3` + alias, safe zones S1–S10 via data,
defer kinds incl. `'m6'` window query, tension T, micro events, clock-jump compensation for W05/W11, the director-run world beats
`W01 W03 W05 W11 W12` + micro `m.*`); `data/cards.js` (title/warning/test/recap/M0/03:33/handover strings) · `data/ending.js` (END, tail,
credits, check, hook strings).

### 3.3 Engine files — owner, ep3 change, what ep2 relies on
| engine file | owner | ep3 change | ep2 relies on (must stay identical when the ep3 switch is absent) | ep3 switch |
|---|---|---|---|---|
| `series.js` | core | 3 table lines (RELEASES[3], DEFAULTS.e3_easyBack, SEEN_KEYS +3) | every API; ep1 P-2 `endEp1`; picker `isReleased(2)` | none (registration) (12.7에서 변경 — `RELEASES[3] = 0`) |
| `core/base.js` | core | **none** | `G.T`, clock (beat/card/fixed), save, flags, `freshStage()` + `G.applyVarDefaults` | — |
| `core/fx.js` | core | `edgeShake` no-op when `G.EP.noShake` | mono, sub, black, vignette, shake (B14) | `G.EP.noShake` |
| `core/icons.js` | core | add icons (additive keys only — `sms` `files` `weather` **already exist** and are reused as is) | existing keys | — |
| `core/keyboard.js` | core | `G.EP.KBD.predict === false` forces the predict bar off (even for an explicit `predict:true`); key-press haptic `vib(5)` off when `G.EP.VIB` is set | predict bar + `kbd:predict` hook + 5 ms key haptic | `G.EP.KBD` · `G.EP.VIB` |
| `core/widgets.js` | core | `G.ui.inputSource(fn) → remove()` (extra S1 predicates for the dial pads) | holdButton, voiceBubble, framePlayer, pinPad, `inputActive()` = keyboard ∨ pinPad | registration |
| `core/audio.js` | audio | `defineBuffer`, vibrate keys `ring3`/`sms`, `G.EP.VIB` allow-list (other keys = no-op), iOS fallback = nothing (no shake, no buzz) when `G.EP.noShake`, `/^v\d+_/` voices, `hush({roomDb})` honoured for ep3 ambiences | cues, subs, TTS, unlock, resume chip, ep2 vibrate keys + iOS shake/buzz | registration · `G.EP.VIB` · `G.EP.noShake` |
| `core/spatial.js` | audio | `defineVia` `defineIR` `defineAmb` `TENSION_AMBS` `defineMediaChain` `definePrepare` `setListener`/`place` hook | VIA/IRDEF/AMB tables, `A.tension` drone start, gsm, drill, box15, `mediaChain('phone'|'bt')`, `A.prepare()` ep2 render/TTS preload + `flag:END → hook.seahY` | registration / `A.TENSION_AMBS` / `A.definePrepare` |
| `core/media.js` | audio | route via `G.EP.mediaRoute()` (one gain per route kind, no DelayNode) + reroute on `room:where` / `flag:playArmed` + `from:'callrec'` | BT simulation, `out()` `'bt'|'phone'`, 0.2 s BT delay, C2 watcher inputs, `media:*` events | `G.EP.mediaRoute` |
| `core/phone.js` | shell | HOME getter render/folder/widgetOpen, STATUS, QS tiles, `callScreen`/`inCall`, `data-scr` in `screen:push`, notify chat-open hook + `vars.dndNow` (no banner) + tone-cap/vibrate key from `G.tones` | users/switch shell, QS user row, BT tile, near-share, volume panel, notify routing (G.moment), 3-tone cap → vibrate-only, vibrate keys `him`/`n`, N01–N03 seeding | `G.EP.HOME[n].render` / `{folder}` / `widgetOpen` (ep2 has `G.EP.HOME` without them) · `G.EP.STATUS` · tile ids `sound`/`dnd` + `userRow:false` (ep2 has `G.EP.QS` = wifi/bt/flash) · `G.tones.cap` / `G.tones.vibKey` |
| `apps/lock.js` | shell | easy skin, first unlock = `!flag(G.EP.LOCK.firstFlag)` → sets it, `director.mark(G.EP.LOCK.beat)` (`'B07'`), cue `ui.unlock` | {N}/'—'/hook lock screens, M1 + `mark('B03')` on first unlock | `G.EP.LOCK` |
| `apps/settings.js` | shell | ep3 data screens, partial-match search + easy gating, recent search, `dnd`/`dnd.log` | ep2 screens & keys, tone screens, `settings:screen` | `G.STORY.settings.v === 3` |
| `apps/phone.js` | comms | standard phone when `G.STORY.dial.sim === true` | SIM-less dialer, emergency dialer, `G.mdu` | `G.STORY.dial.sim` |
| `apps/talk.js` | comms | `mode:'in'` renderer (rooms, folds, calls, input) | `G.chat.view` + logged-out talk + ep1 sea room | `G.STORY.talk.mode === 'in'` |
| `apps/sms.js` (new) | comms | new file | not loaded by ep2 | — |
| `apps/moment.js` | comms | none (not loaded in ep3) | everything | — |
| `apps/gallery.js` | media | `albums[]` data driving + shared album + virtual grid + zoom event | users n/'—', hidden, received, framePlayer | `G.STORY.gallery.v === 3` |
| `apps/calendar.js` | media | multi-month/years + repeats + detail memo | Dec 2026 month, notif0000 | `G.STORY.events.v === 3` |
| `apps/clock.js` | media | none beyond data (ring screen unused) | ring screen, alarms | — |
| `apps/memo.js` | media | `v:3` empty list without the new button | '—' read mode, {N} editor | `G.STORY.memos.v === 3` |
| `apps/mail.js` | media | `mode:'in'` (no banner, 3 mails, no trash) | logged-out inbox, trash, cb.manager | `G.STORY.mailAccount.mode === 'in'` |
| `apps/browser.js` | media | `appMode` pages + `browserApps` registration + ep3 start screen | ep2 start/history/search | `G.STORY.browser.v === 3` · `G.STORY.browserApps` |
| `apps/recorder.js` | media | none (not loaded) | everything | — |
| `apps/camera.js` | room | open params `{room, view}` | `{view, flash}` | — |
| `room/room.js` | room | generic two-room renderer + eye API + state keys | 601 renderer, eyeM0, forceView, playTankGlow, … | `G.ROOM.v === 3` |
| `notebook.js` | flow | `greyAfter` option, `@` exception suffix tolerated, hint-reveal haptic `navigator.vibrate(20)` off when `G.EP.VIB` is set | 3 tabs, hintable, grayAfterM7, 20 ms reveal haptic | per objective `greyAfter` · `G.EP.VIB` |
| `director.js` | flow | `BD().zones/safeKinds/ambience/microActive/microGap/microFilter fields/loops/targetT/vignette/midnight` options + `where:'lv'|'sr'` | ep2 S1–S10, `zoneBlocks`, drone, GSM, B07, b09cue, micro, M7 tension curve | presence of each option in `G.BEATDATA2` |
| `css/main.css` · `apps.css` · `room.css` · `notebook.css` | shell · comms · room · flow | avoid edits (ARCH §4.1-7) | ep2 look | — |

### 3.4 Who renders what (every §5 screen)
| App / surface | Screens | Owner (file) | Data source |
|---|---|---|---|
| Eye views | M0 4 views + hotspots/captions (§4.1.1), 03:33 `c3_phone_ring` + `r3_kitchen` cuts, 03:35 `c3_mom_hands`, END cut, tail settle cut, hook cut | room (`room.js`) driven by flow (`scenes.js`, `call.js`, `ending.js`, `hook.js`) | `G.ROOM`, `G.IMG`, `G.IMGMETA` |
| E9 easy ring screen (inside `c3_phone_ring`) | `ring` / `call` / `ended` | shell (`G.easy.ringScreen`) into room's screen node, driven by flow `call.js` | `G.STORY.easy.ring` |
| Hook blocked-message screen (inside `c3_phone_ring_lit`) | §3.16 4 rows + pushed row | comms (`G.callrec.renderBlockedMsgs`) driven by flow `hook.js` | `G.STORY.blocked` |
| Easy lock screen | `3:35` · `1월 24일 일요일` · `위로 밀어서 열기` · `긴급 통화` · camera | shell (`lock.js` + `G.easy.lockSkin`) | `G.EP.LOCK`, `G.STORY.easy.lock` |
| Easy home | 6 tiles + big clock widget (date → calendar) | shell (`easymode.js`, called by `phone.js` render hook) | `G.STORY.easy.home` |
| Standard home | widget + 5 icons + folder + dock 4, `p3_home_wall` | shell (`phone.js`) | `G.EP.HOME` getter |
| Folder `엄마 안 써도 됨` | popup grid `메일 인터넷 메모 음성 녹음 내 파일 날씨` | shell (`phone.js`) | `G.EP.HOME` folder item |
| Status bar · quick panel · banners · notification panel | §3.2.1 · §4.13 · §5.3 | shell (`phone.js`) | `G.EP.STATUS`, `G.EP.QS`, `G.state.notifs` |
| Call screen | `연결 중…` · result card · `통화 종료` (cell · talk · emergency · big) | shell (`G.phone.callScreen`) | spec from comms (`G.STORY.dial.results`) |
| 엄마에게 보여 드리기 | button + position cards + reaction cards | shell (`show.js`) with core `G.cards` | `G.STORY.show` |
| Cards / chip sheets | every name/situation card and chip sheet | core (`cards.js`) | script from the caller's data |
| Easy phone (E3/E4) | 키패드 · 최근 기록 (30 days) · 연락처 cards · contact detail · 🎙 sheet | shell (`easymode.js`) | `G.STORY.dial` (comms data, read-only) + `G.STORY.easy` |
| Easy SMS (E5) | one thread, big text | shell (`easymode.js`) using comms `G.sms.renderThread(node, id, {big:true})` | `G.STORY.sms` |
| Switch-only gates (E6) | `easy.gate.rec` · `easy.gate.spam` | shell (`easymode.js`) | `G.STORY.easy.gates` |
| 설정 | §3.3 first screen · search · display · font · 쉬운 모드 · 알림 · 방해 금지 · 사용 기록 · Wi-Fi · 블루투스 · 소리 · 배터리 · 접근성 · 일반 · 휴대전화 정보 | shell (`settings.js` + `easymode.js` registered keys) | `G.STORY.settings` |
| 전화 (standard) | 키패드 · 최근 기록 · 연락처 · contact `통화 기록` · call detail · ⋮ | comms (`engine/apps/phone.js`) | `G.STORY.dial` |
| Lock emergency keypad | keypad overlay above the lock | comms (hook `phone:emergency`) → shell call screen | `G.STORY.dial` |
| 통화 녹음 · 텍스트 변환 · 번호 차단 (C1–C11) | §5.5 table | comms (`callrec.js`) | `G.STORY.recordings`, `G.STORY.blocked`, `G.STORY.callrecUI` |
| 메시지 | list 4 · 강수진 thread · other threads · ⋮ | comms (`engine/apps/sms.js`) | `G.STORY.sms` |
| 톡 | list 5 · `세아 💛` · `지민이` · `나와의 채팅` · `3구역` · `급식실 조리팀` · voice-talk dial · redial sheet · mail card | comms (`engine/apps/talk.js`) | `G.STORY.talk`, `G.STORY.e1canon` |
| 사진 | grid 3,041 · albums · shared album (members, activity, info) · viewer · ⓘ | media (`gallery.js`) | `G.STORY.gallery`, `vars.shots` |
| 캘린더 | month (2024-11 → 2027-03) · day list · detail | media (`calendar.js`) | `G.STORY.events` |
| 모임 · 내 파일 · 날씨 | static pages | media (`browser.js` appMode) | `G.STORY.moim`, `G.STORY.browserApps` |
| 폴더 › 메일 · 인터넷 · 메모 · 시계 | §4.8.3 · §4.8.4 | media (`mail.js` · `browser.js` · `memo.js` · `clock.js`) | `G.STORY.mails` · `browser` · `memos` · `alarms` |
| 폴더 › 음성 녹음 | `callrec.voice` | comms (`callrec.js`, app id `voicerec`) | `G.STORY.recordings` |
| 카메라 = 방 보기 | lv 4 views + sr 2 views, closeups, flashlight, shutter, `go:` doors | room (`room.js`, `camera.js`) | `G.ROOM` |
| Notebook `{N의} 수첩` | 할 일 · 힌트 · 메모 | flow (`notebook.js`) | `G.OBJECTIVES` |
| Monologue / recap lines | bottom 3.2 s / 4 recap lines | core (`fx.js` render, `e3.js` queue) | `G.e3.MONO` |
| Sound subtitles | bottom / direction | audio (`G.audio.sub`) → core `G.fx.sub` or room `G.room.dirSub` | `G.SUBS` |
| Title · warning · earphone test · recap · pause | §3.0 · §4.0 | flow (`scenes.js`) | `G.STORY.cards.title…` |
| END cards · tail · credits · check card · hook bar | §3.15 · §3.16 · §4.12 | flow (`ending.js`, `hook.js`) | `G.STORY.ending` |
| 04:40 cards · 05:05 memory · M8 cards | §3.12 · §3.13 · §3.14 · §4.11 | room (`door.js`, `memory.js`, `climax.js`) with `G.cards` | `G.STORY.setpiece` |
| Root picker | building SVG + list row 3 | core (`series/series.js`) | `G.series` |

---

## ARCH §4 — Engine compatibility rules (ep2 must not regress · ep1 must not regress)

### 4.1 Principles (every owner who touches `engine/**`)
1. **Additive, data-gated.** Every ep3 behaviour in an engine file sits behind a switch that ep2 never defines (column "ep3 switch" of
   ARCH §3.3: a `G.EP.*` option, a `v:3` / `mode:'in'` marker inside the ep3 `G.STORY.*` data, or a registration call). With the switch
   absent the ep2 code path must behave exactly as before (same DOM, same flags, same timings, same data-qa). Do not branch on `G.EP.n`
   (the only exception: none in this build). **Careful — ep2 already defines `G.EP.HOME`, `G.EP.QS` (`{tiles:['wifi','bt','flash'],
   userRow:true}`), `G.EP.CLOCK` and `G.EP.DEFAULTS`** (`ep2/js/config.ep2.js` l.12–28): for those objects the ep3 switch is a **new
   field or a new list value** (`render`, `{folder}` items, `widgetOpen`, tile ids `sound`/`dnd`, `userRow:false`, `DEFAULTS.btOn`), never
   the object's presence. `G.EP.STATUS · LOCK · KBD · VIB · noShake · mediaRoute · SESSION_KEY` are ep3-only.
2. **No renames — additive aliases.** Engine files read `G.e2.*` today (80 places, ARCH §4.3); ep3's `e3.js` provides `G.e2 = G.e3`.
   **Decision on the directive's "episode-common names" (dir §13.10 엔진):** the episode-common name is **`G.ep`**. ep3 sets
   `G.ep = G.e2 = G.e3`. Existing engine code keeps reading `G.e2` (untouched); **new engine code written in this build reads
   `(G.ep || G.e2)`** so it works on both pages (ep2 never defines `G.ep` → falls back). `ep2/js/e2.js` is **not edited**. Likewise
   `G.BEATDATA2`: ep3's `beats.js` defines `G.BEATDATA3` **and** `G.BEATDATA2 = G.BEATDATA3` (§9.1 — director keeps its single name).
3. **Same `G.STORY` key, different episode ⇒ marker.** Where ep3 needs another shape under a key an engine app already reads
   (`settings`, `talk`, `dial`, `gallery`, `events`, `memos`, `mailAccount`, `browser`, `recordings`), the ep3 object carries
   `v: 3` (or `mode: 'in'` / `sim: true` as listed) and the engine branches on that marker. Never change how the ep2 shape is read.
   (`engine/apps/gallery.js` reads `G.STORY.recordings.outBt` — with ep3's array it is `undefined` → its default; harmless, keep.)
4. **Guard ep3-only globals** in engine code: `G.easy`, `G.callrec`, `G.cards`, `G.chips`, `G.show`, `G.sms`, `G.phoneApp.dial`,
   `G.room.where` … do not exist on the ep2 page. `G.x && G.x.y && G.x.y()` or `G.hooks.call`.
5. **Signatures stay.** If an engine function gains options, its old call forms keep working (`G.media.play(src, {from:'recorder'})`,
   `G.room.open({mode:'eye', view:'r2_door'})`, `G.phone.notify({...})`, `G.ui.field({...})`, `G.director.safe(kind)` …).
6. **Timing neutrality.** New bus listeners in engine files must be inert on ep2 (check the switch inside the handler). No new
   `setInterval`; game logic stays on core's 250 ms tick (`tick`, `clock:min`, `G.e3.sched`).
7. **Engine CSS.** Prefer ep3 rules in your own `ep3/css/*` file (loaded later). If an engine CSS file must change, scope the new rule
   under `body.ep3` (flow sets `<body class="ep3">`) so ep2 renders identically. Never edit `ep2/css/*` (§0.3 D35).
8. **ep1**: `engine/series.js` is the only engine file the live ep1 loads. ep1 must still play to END and `endEp1()` must still write
   `eps.1 src 'live'`; P-3 (`isReleased(2)`) and the root picker keep working.
9. **Regression gate (mandatory after every engine edit — paste results in your final report):** `node --check <file>` ·
   `node tools/qa/ep2_speedrun.js` · `node tools/qa/ep2_speedrun.js --ep1=done` · `node tools/qa/ep2_branches.js` (all with
   `NODE_PATH=C:\Users\Admin\AppData\Roaming\npm\node_modules`, one Chromium at a time, close what you start) · for `series.js`
   additionally the ep2 series profiles S1–S10 (`?debug=1&series=S1…`) + an ep1 smoke to END + the root picker render. A red ep2 gate
   = your change is reverted, not ep2 "fixed".

### 4.2 Per engine file — what ep3 adds and what ep2 relies on there
- **`engine/series.js` (core)** — only the three registrations of §9.3 (exact):
  `DEFAULTS` += `e3_easyBack: false` (keep `e3_played: true, e3_dnd: false`) · `SEEN_KEYS` += `'e3_height', 'e3_radio', 'e3_cake'`
  (keep `e3_block e3_dndLog e3_grey`) · `RELEASES = { 2: Date.UTC(2026, 11, 24, 12, 0), 3: Date.UTC(2027, 0, 23, 12, 0) }`. No other (12.7에서 삭제/변경 — 현행 `RELEASES = { 2: 0, 3: 0 }`)
  diff (no date string, no `21:00`). ep2/ep1 rely on: `ensure backfillEp1 endEp1 ep s seen sea stage commit patch isReleased (12.7에서 삭제/변경 — 공개일 자체가 없어 이 점검은 무의미하다)
  releases _fixture` (DEBUG only when `G.DEBUG` is set before load — ep3's `config.ep3.js` sets it). DESIGN §9.3 S12 is the
  watchdog profile for this diff.
- **`engine/core/base.js` (core)** — **no change.** ep3 relies on: `G.clock` with `G.EP.CLOCK` rows found by flag name (the
  `gotPhone` row works because `segIdx()` scans flags), `'card'` rows M1/END (`jump('callEnd')` = 03:34, `jump('05:35')` …
  forward only), `'beat'` row M6 with `m7beat`/`m7rate` (engine uses the beat table for whichever row says `'beat'`), `toMin()` =
  hours < 12 belong to t0 + 1 day (03:20 = 2027-01-24 03:20 with `t0:[2027,0,23]`), `G.battery()` reads `vars.battery` first,
  `fresh()` calls `G.applyVarDefaults(st)` (ep3 `flags.js` replaces `st.stage`), save key from `CONFIG.SAVE_KEY`.
- **`engine/core/fx.js` (core)** — add: `if (G.EP && G.EP.noShake) return;` at the top of `edgeShake` (and therefore `shake`).
  ep2 relies on `sub mono dirArc edgeShake setVignette black` + legacy no-ops; unchanged.
- **`engine/core/icons.js` (core)** — add keys `moim voicerec folder showHands easyPhone easyTalk easyCamera easyGallery easyMoim
  easySettings` (new keys only). `sms` `files` `weather` **already exist in the engine** (checked) and are reused unchanged — do not
  redefine them (ep2 keys stay byte-identical).
- **`engine/core/keyboard.js` (core)** — when `G.EP && G.EP.KBD && G.EP.KBD.predict === false` the predict bar is **forced off**
  for every field (`predictOn()` returns false even for an explicit `predict:true` — the engine `settings.js` ep2 search path passes
  `predict:true` explicitly, and §5.3 '예측 바 0' has no exception). The key-press haptic `vib(5)` (l.152) is skipped when `G.EP.VIB`
  is set (ARCH §1: only two vibration patterns exist in ep3). ep2 relies on the predict bar + `kbd:predict` + `kbd:shown` + the 5 ms
  key haptic; unchanged (ep2 defines neither key).
- **`engine/core/widgets.js` (core)** — additive `G.ui.inputSource(fn) → remove()`: `G.ui.inputActive()` = keyboard open ∨ visible
  pinPad (engine, unchanged) ∨ any registered `fn()` true. Comms (phone keypad, lock emergency keypad, `차단할 번호` pad) and shell
  (easy keypad E3) register `() => padNode.isConnected && padVisible && digits.length > 0` — that is DESIGN §6.1.3 S1 '키패드 숫자 ·
  차단할 번호 입력' (director `zones()` S1 already reads `G.ui.inputActive()`). ep2 registers nothing ⇒ identical.
- **`engine/core/audio.js` · `spatial.js` · `media.js` (audio)** — add registration APIs (ARCH §5.17): `A.defineVia(key, spec)` and
  `A.defineIR(key, [len, decay, bright, early])` (new keys only — an existing ep2 key throws a DEBUG warning and is ignored),
  `A.defineAmb(id, factory, nominalDbfs)` (adds to `AMB` + `AMB_NOMINAL`), `A.defineBuffer(id, renderFn)` (consulted by `A.buffer`
  before its ep2 table; `A.buffer` / `A.voice` resolve `/^v\d+_/` ids through `G.AUDIO_FILES` — today only `/^v2_/`), `A.TENSION_AMBS`
  (default `['roofWind','drone']`; `A.tension` starts the drone only when `'drone'` is listed — ep3 sets `['air']`; `amb.air` gain law
  `.03 + .30T`, 0 when `G.e3.less()` ∨ speaker mode ∨ `M7` (8 s fade) — §6.1.5), `A.defineMediaChain(kind, factory)` (consulted by
  `A.mediaChain` before `'phone'|'bt'`), `A.definePrepare(fn)` (when set, `A.prepare()` runs `fn` **instead of** the ep2 list — the
  engine `A.prepare` otherwise renders `rec.uri` `vid.move` `vid.roof` `ringHaru7` and fetches `v2_kang_door` `v2_him_breath`
  `v2_jimin_vm`, which on the ep3 page are wasted CPU and **404 network requests** that fail the speedrun's 0-failed-request rule;
  the `flag:END → A.buffer('hook.seahY')` listener and the `A.restore` GSM branch are skipped too when `definePrepare` was called),
  vibrate keys `ring3:[400,200,400]` (less → 0) and `sms:[80]`. **`G.EP.VIB` allow-list** (ep3 `['ring3','sms']`): any other key
  (`pin` `fp` from widgets, `n` `him` from the ep2 notify path) is a silent no-op on the ep3 page. **iOS** (no `navigator.vibrate`):
  when `G.EP.noShake` the fallback does nothing at all — no 2 px shake **and no synthesized low buzz** (§9.7: "대체는 이미 있는 소리 ·
  화면뿐"). `G.media`: when `G.EP.mediaRoute` is a function, `out()` returns its value (`'ear'|'table'`); `startAt()` connects the
  source to one gain per route kind (`'ear'` and `'table'`, each into `chain(kind)` = `G.audio.mediaChain(kind)`) with gain 1 on
  `h.target` and 0 on the other — **no DelayNode** (the 0.2 s is ep2 BT only); media listens `room:where` and `flag:playArmed` (handler
  returns at once when `G.EP.mediaRoute` is absent) and calls its internal `reroute()` → `h._reroute(out(), 80)` crossfade + bus
  `media:out {target}`; the ep2 "speaker went away → pause" branch applies only to `'bt'`. `from:'callrec'` is a valid source;
  `G.media.bt` stays present but core `flags.js` (`G.applyVarDefaults`) sets `vars.btOn = false` (the engine only defaults it when
  undefined — no BT UI in ep3). ep2 relies on VIA/IRDEF/AMB keys, drone auto-start, gsmTank, drill, box15, `mediaChain('phone'|
  'bt')`, BT simulation + `out()` `'bt'|'phone'` + `media:*` events + C2 inputs — all unchanged when the options are absent.
- **`engine/core/phone.js` (shell)** — additive: (a) `manifest(u)` result may carry `render(homeEl, api)` → the default grid is
  skipped and the function draws (easy home); (b) `apps` items may be `{ folder:'엄마 안 써도 됨', apps:[ids] }` → a folder icon
  (`data-qa home.folder`) that opens an overlay grid of `home.app:<id>` icons; first open emits `folder:open` {name} and sets
  `folderSeen`; (c) `widgetOpen:'calendar'` → the clock widget's date line opens `calendar` (ep2 default stays `clock`); (d)
  `G.EP.STATUS` → status bar `LTE` bars + Wi-Fi name (`집`) while on + battery + time, no `SIM 없음`; (e) the QS renders the tiles
  **in `G.EP.QS.tiles` order** — `wifi` `bt` `flash` keep their current builders byte-for-byte (ep2's list is exactly
  `['wifi','bt','flash']`, so its DOM/order/data-qa stay identical), new ids `sound` (소리 → 진동 → 무음 cycle = `vars.soundMode`) and
  `dnd` (tap = `vars.dndNow` toggle, long-press 0.5 s = `G.settingsApp.open('dnd')`); the Wi-Fi tile's small label = `G.EP.STATUS.wifi`
  when `G.EP.STATUS` exists (else ep2's `saemal_rooftop`); user row only when `userRow !== false`, empty list text `알림 없음`; (f) **new**
  `P.callScreen(spec)` / `P.inCall()` (ARCH §5.7); (g) `push()` copies `node.dataset.scr` into the entry (`entry.scr`) and the
  `screen:push` payload; (h) `notify` chat-open check = `G.hooks.has('chat:isOpen') ? G.hooks.call('chat:isOpen', chat) : <ep2
  G.moment check>`; mute when `vars.dnd || vars.dndNow` or sound mode mute; **`vars.dndNow` also suppresses the banner** (DESIGN
  §4.13: "방해 금지 `지금 사용`을 켜 두면 배너·소리 0 → 알림 패널과 메시지 배지에만 쌓인다" — the entry is still upserted into the panel);
  in `soundMode 'vibrate'` the vibrate key is `G.tones.vibKey(toneId)` when that function exists (ep3 → `'sms'`), else the ep2
  `'him'|'n'`; the ep2 rule "4th+ tone of the same chat → vibrate only" is skipped when `G.tones.cap === 0` (ep3 — every row of §4.13
  says 문자 sound; the 10 s same-chat coalescing stays, which is what makes N02/N07 ring once for their bundles); (i) Wi-Fi when
  `G.EP.STATUS` = a plain on/off (no saved list, no auto-on — the ep2 `shell:wifiAuto` sched is never armed). ep2 relies on: users + switch shell, QS user row/BT tile/flash, near-share, volume panel, notify routing via
  `G.tones` + `G.moment.isOpen`, N01–N03 seeding (`G.STORY.users` — absent in ep3 ⇒ nothing seeded), `home:show` only after `M1`.
- **`engine/apps/lock.js` (shell)** — `G.EP.LOCK` present ⇒ easy-skin path only: `show('n')` draws `G.easy.lockSkin(node)` (fallback =
  the same strings in plain DOM), swipe ≥ 80 px / `↑` / `Enter` / desktop drag unlocks, the first unlock sets
  `G.EP.LOCK.firstFlag` (`'gotPhone'`) — **never `M1`** — with `first = !flag(G.EP.LOCK.firstFlag)` (the ep2 expression
  `flag('gotPhone') && !flag('M1')` is never evaluated on this path), calls `G.director.mark(G.EP.LOCK.beat)` (`'B07'` — the ep2 path
  marks `'B03'`, which in ep3 is flow's preroll beat) and plays cue `G.EP.LOCK.cue` (`'ui.unlock'`, §6.2 B07) on swipe/key/drag, then
  emits `lock:unlock {user:'n', how, first}`; no PIN pad, finger icon,
  smart-lock line, widget line or seeded notifications; `긴급 통화` → `G.hooks.call('phone:emergency')`; camera icon →
  `G.room.open({mode:'camera', fromLock:true})` (closes back to the lock). The lock is shown once (handover) and never again. ep2
  relies on all three ep2 lock screens and `M1` on first unlock — unchanged when `G.EP.LOCK` is absent.
- **`engine/apps/settings.js` (shell)** — `G.STORY.settings.v === 3` ⇒ the ep3 root/screens from data + `G.settingsApp.register`
  keys (ARCH §5.21); search = bidirectional partial match on `G.e3.norm` (§9.5-2) with easy gating; ep2 keys (security, tones,
  users, BT device) are not registered in ep3; any ep3 screen that lists home apps (e.g. 알림 › 앱 알림) flattens `{folder, apps}`
  items and tolerates the EASY spec (no `apps`). ep2 relies on its keys, `settings:screen`, tone screens and flags
  `soundSettingsOpened perChatSeen` — unchanged.
- **`engine/apps/phone.js` (comms)** — `G.STORY.dial.sim === true` ⇒ the ep3 standard phone (ARCH §5.10). `G.mdu` (defined here,
  used by gallery/calendar/clock/memo/browser) is **frozen**: additive helpers only, no signature change. ep2 relies on the SIM-less
  dialer, `phone:emergency`, `G.phoneApp.emergency/call`, `G.mdu`.
- **`engine/apps/talk.js` (comms)** — `G.STORY.talk.mode === 'in'` ⇒ logged-in renderer; `G.chat.view` gains options (chips stay
  `setChips`), old options unchanged. ep2 relies on `G.chat` (moment uses it) + the logged-out talk.
- **`engine/apps/sms.js` (comms, NEW)** — never loaded by ep2.
- **`engine/apps/gallery.js` · `calendar.js` · `memo.js` · `mail.js` · `browser.js` (media)** — branch on the markers of ARCH §3.3.
  `browser.js` also registers one app per entry of `G.STORY.browserApps` (`moim` `files` `weather` — absent in ep2). ep2 relies on
  the per-user gallery (hidden items, received, framePlayer), the Dec 2026 calendar + `notif0000`, '—' memo, logged-out mail, ep2
  browser history/search — unchanged.
- **`engine/room/room.js` · `engine/apps/camera.js` (room)** — `G.ROOM.v === 3` ⇒ generic renderer (rooms, eye API, state keys,
  motion option — ARCH §5.12); ep2 exports (`eyeM0 forceView playTankGlow handleJerk tankAjar beams police lightsOn doorGap
  closeup`) and their DOM stay untouched for ep2 data. camera.js accepts `{room, view, closeup}` in addition to `{view, flash}`.
- **`engine/notebook.js` (flow)** — per-objective `greyAfter: '<flag>'` (ep3 `'M8'`) next to the existing `grayAfterM7`; the hint
  reveal haptic `navigator.vibrate(20)` (l.336) is skipped when `G.EP.VIB` is set (ARCH §1 two-pattern rule); nothing else.
- **`engine/director.js` (flow)** — read options from `BD()` when present (ARCH §5.16): `zones(base)`, `safeKinds` (when present it
  replaces **both** `D.safe(kind)` and the hard-coded `zoneBlocks()` used by `evaluate()` for show beats — a kind blocks while any
  listed zone or a `hold` is on; the ep2 `climaxNow()` M6–M7 exception is not applied), `ambience` (`{drone, gsm, endWind}` — ep3 all
  false), `microActive(s)`, `microGap(T)`, `microForbidden` (exists), micro record fields `where:'lv'|'sr'|'any'` · `when(s)` ·
  `once` · `run({az, s})` (filtered before `pickMicro()`; `once` records are marked in `vars.dir.fired`; `safeKinds.micro` zones skip
  the turn — §6.1.6 "그때 S1–S9 중이면 그 회차는 건너뛴다"), `loops` (repeating world loops — W01 · W03, ARCH §5.16), `targetT(s)` →
  `number | { T, ms }` (replaces the `tension` map **and** the ep2 M7 fast-follow curve; `ms` = convergence time, default 20 000),
  `vignette(T)`, `midnight` (B07 compensation, ep3 false). Beat `where` also accepts `'lv'|'sr'` (= `(G.ep||G.e2).where()`;
  ep2 values unchanged). `vars.dir.dropped` stays the engine **object** `{id: pm}` (never an array — a JSON array would silently drop
  the director's string keys on save). The ep2 `flag:M4 → sched 'dir:b09cue'` path is inert on ep3 (no `B09p` record ⇒ `runBeat(null)`
  returns) — allowed, not required to gate. ep2 relies on its S1–S10, `zoneBlocks`, drone/GSM/END-wind, B07, b09cue, micro, the M7
  tension curve — unchanged when the options are absent.

### 4.3 What `G.e3` must expose for the engine (from `grep G.e2` over `engine/` — these names are the facade contract)
| engine file (ep3 path) | reads | `G.e3` provides |
|---|---|---|
| `core/base.js` | `STR` | whitelist ARCH §5.3 |
| `core/phone.js` | `STR fmtK img sched session requestM2` | `requestM2()` → false (stub) |
| `core/audio.js` · `room/room.js` | `STR less lowEnd` | ✔ |
| `core/fx.js` | `less mono` | ✔ |
| `core/media.js` · `core/widgets.js` | `STR` (+ `img`) | ✔ |
| `apps/lock.js` · `apps/settings.js` | `STR img session` | ✔ |
| `apps/phone.js` | `STR cb fmt12 img norm session` | ✔ |
| `apps/talk.js` | `STR fmtK img maker makerAvatar` | `maker()` ep2 rule (unused on screen) · `makerAvatar()` → `''` |
| `apps/mail.js` · `apps/memo.js` | `STR cb session` | ✔ |
| `director.js` | `cb less sched speaker` (+ `G.sd.isSafe`) | ✔ + `G.sd` |
| `apps/moment.js` (not loaded) | `answerOk whereOk mono norm sched session stage cb` | stubs `answerOk()`/`whereOk()` → false, `world()` → `{}` |
`G.sd` (core, `e3.js`) = the ep2 helper set with the same behaviour (`T img bg imgEl tone`(no-op) `isSafe waitSafe statusOverlay
dayLabel rng pd ymd day` + `note/lead` no-ops) — engine `talk.js` (`G.sd.img`), `widgets.js` (`G.sd.rng`), `director.js`
(`G.sd.isSafe`) read it.

---

## ARCH §5 — Cross-module APIs (exact signatures)

### 5.0 Conventions
- Namespaces: `G.e3` (= `G.e2` = `G.ep`, `window.E3`), `G.series`, `G.cards`, `G.chips`, `G.phone`, `G.lock`, `G.easy`, `G.show`,
  `G.settingsApp`, `G.tones`, `G.audio`, `G.media`, `G.phoneApp`, `G.callrec`, `G.sms`, `G.talk`, `G.chat`, `G.gallery`,
  `G.calendarApp`, `G.browser`, `G.memo`, `G.mail`, `G.clockApp`, `G.room`, `G.camera`, `G.door`, `G.memory`, `G.climax`,
  `G.call`, `G.scenes`, `G.ending`, `G.hook`, `G.main`, `G.notebook`, `G.director`.
- **Calling another owner** = stub-guarded (`G.x && G.x.y && G.x.y(…)`) or `G.hooks.call(name, …)`. No cross-owner call at load
  time. Boot happens in `G.main.boot()` (flow) which calls each `init()` (ARCH §5.1).
- Promises always resolve (never reject); errors are swallowed + `console.error` (DEBUG: red overlay line).
- **Times**: `playMs` (`G.state.playMs` — advances only while visible, not paused) for every "real n seconds" rule (§6.1.2 list).
  In-game time = `G.clock.now()` / `hm()`. `Date.now()` only for flag timestamps. Persistent timers = `G.e3.sched` (playMs).
- Owner-private persisted state: `G.state.vars.<key>` — core `pm clock sched e3 battery hubK TB replay committed commitTries patched
  momAt` · audio `au` · shell `sh easy showSeen dndNow dndAt soundMode` · comms `cm kang calls call112 talkCalls recAuto spamSw unknownBlock` (the last three
  only through `G.callrec.setting`) · media `md gal` · room
  `room where m6Hold memEarly play playFails momAwayUntil seatedMs` · flow `fl dir nb momTaps endStep` · `seq.{m1 (flow) m6 m7 m8
  (room)}`. Cross-owner state = only the names of ARCH §5.4.
- **Sched ids are owner-prefixed**: `e3:` (core) · `au:` · `shell:` · `comms:` · `media:` · `room:` `door:` `mem:` `climax:` (room) ·
  `flow:` `call:` `end:` `hook:` `dir:` (flow).
- Every pushed screen node carries `data-scr` from DESIGN §5.8 (the show button and QA read it).

### 5.1 `init` protocol (called by flow `G.main.boot()` in this order; each is optional and idempotent)
`G.fx.init()` → `G.phone.init()` → `G.audio.init()` (no AudioContext yet) → `G.media.init()` → `G.e3.init()` → `G.cards.init()` →
`G.lock.init()` → `G.easy.init()` → `G.room.init()` → `G.phoneApp.init()` → `G.callrec.init()` → `G.sms.init()` → `G.talk.init()` →
`G.gallery.init()` → `G.calendarApp.init()` → `G.show.init()` → `G.notebook.init()` → `G.director.init()` (does not start) →
`G.call.init()` → `G.door.init()` → `G.memory.init()` → `G.climax.init()` → `G.ending.init()` → `G.hook.init()` →
`G.e3.seriesBoot()` → `G.scenes.title()` or resume (ARCH §8). Every `init()` registers its `G.e3.sched.on(prefix, fn)` handlers and
bus listeners; handlers are not persisted, schedule entries are.

### 5.2 `ep3/js/config.ep3.js` (core) — loads before the engine
```js
window.CONFIG = window.CONFIG || {};
window.CONFIG.SAVE_KEY = 'haru-escape.ep3.save.v1';               // engine/core/base.js reads it at load
window.G = window.G || {};
(function (G) {
  G.AUDIO_BASE = 'assets/audio/';                                    // = /ep3/assets/audio/
  G.EP = { n: 3, title: '하루를 위한 방탈출! 3', sub: '엄마의 번호', screenTitle: '{N를} 위한 방탈출! 3', estMin: 45,
           SESSION_KEY: 'haru-escape.ep3.session', noShake: true };
  G.EP.CLOCK = { t0: [2027, 0, 23],                                  // §2.1 one-line source, verbatim
    ms: [ ['M0','03:20',12,'03:32',72], ['M1','03:33','card',null,72], ['gotPhone','03:35',60,'03:39',72],
          ['M2','03:40',40,'03:54',71], ['M3','03:55',30,'04:14',69], ['M4','04:15',30,'04:29',67],
          ['M5','04:30',6.5,'04:39',66], ['M6','04:40','beat','05:04',65], ['M7','05:05',30,'05:14',64],
          ['M8','05:15',20,'05:29',63], ['END','05:30','card',null,62], ['HOOK','06:10','fixed',null,61] ],
    jump: { callEnd: '03:34' },
    m7beat: [[0,'04:40'],[30,'04:41'],[46,'04:43'],[100,'04:50'],[140,'04:55'],[176,'05:02']], m7rate: 15 };
  const EASY = { easy: true, render: (node, api) => (G.easy && G.easy.renderHome ? G.easy.renderHome(node, api) : null), wall: null, dock: [] };
  const STD  = { apps: ['gallery', 'calendar', 'moim', 'clock', 'settings',
                        { folder: '엄마 안 써도 됨', apps: ['mail', 'browser', 'memo', 'voicerec', 'files', 'weather'] }],
                 dock: ['phone', 'sms', 'talk', 'camera'], wall: 'p3_home_wall', widget: 'clock', widgetOpen: 'calendar' };
  G.EP.HOME = { get n() { return (G.easy && G.easy.on && G.easy.on()) ? EASY : STD; } };   // read on every renderHome (§5.4)
  G.EP.LOCK = { swipeOnly: true, wall: 'kongi_old', firstFlag: 'gotPhone', beat: 'B07', cue: 'ui.unlock', skin: 'easy',
                emergency: 'phone:emergency' };                     // ARCH §4.2 lock.js
  G.EP.VIB = ['ring3', 'sms'];                                       // ARCH §1 — the only vibration patterns; audio/keyboard/notebook honour it
  G.EP.STATUS = { sim: true, net: 'LTE', wifi: '집' };              // no `SIM 없음` (§3.2.1)
  G.EP.QS = { tiles: ['wifi', 'sound', 'flash', 'dnd'], userRow: false, dndLong: 'dnd' };   // §5.3 · §0.3 D19 (no BT tile)
  G.EP.KBD = { predict: false };                                     // §9.5-1 · §0.3 D38
  G.EP.mediaRoute = () => (G.flag && G.flag('playArmed') && G.state && G.state.vars.where === 'lv') ? 'table' : 'ear';   // §7.1.5
  G.EP.DEFAULTS = { phoneVol: 60, audioMode: 'ear', subs: 'info', scares: 'full', btOn: false };
  G.STORY = G.STORY || {};
  G.STORY.names = { /* ARCH §1.1 — verbatim */ };
  G.DEBUG = !!window.CONFIG.DEBUG || (/[?&]debug=1\b/.test(location.search) && !/pengueverything\.cloud$/.test(location.hostname));
})(window.G);
```
App ids (`G.app`, `G.phone.openApp`, routes, `home.app:<id>`): `phone talk camera gallery moim settings sms calendar clock mail
browser memo voicerec files weather`. Labels: 전화 · 톡 · 카메라 · 사진 · 모임 · 설정 · 메시지 · 캘린더 · 시계 · 메일 · 인터넷 ·
메모 · 음성 녹음 · 내 파일 · 날씨. Registered by: `phone` comms (`engine/apps/phone.js`) · `talk` comms · `sms` comms
(`engine/apps/sms.js`) · `voicerec` comms (`callrec.js`) · `camera` room · `gallery calendar clock mail browser memo` media ·
`moim files weather` media (`browser.js` from `G.STORY.browserApps`) · `settings` shell.

### 5.3 `ep3/js/e3.js` (core) — `G.e3` (= `G.e2` = `G.ep`, alias `window.E3`)
```js
// text / identity
G.e3.STR                          // system-string whitelist (= DESIGN §10 A, 1:1) — keys below are the API
G.e3.MONO = { mono1:'…내 이름이다.', mono2:'…이 사진도 봤구나.',
              recap:['두 달 전 24일, 404호. 나는 세아의 폰으로 문을 열고 나왔다.',
                     '지난달 24일, 그 사람이 내 옛 폰을 돌려줬다. 한 달 동안 나인 척 살던 폰이었다.',
                     '크리스마스 새벽, 세아의 계정에서 음성 메시지가 왔다. 오르골을 흥얼거리는 소리였다.',
                     '세아는 아직 돌아오지 않았다. 오늘은 세아 엄마의 집에서 잔다.'] }
G.e3.img(key) → url               // G.IMG[key] → reuse keys avatar_sea avatar_mom avatar_jimin avatar_sagongsa kongi_old dog_face dog_park dog_bed
                                  //   → '../assets/img/<key>.jpg' · kongi_santa → '../ep2/assets/img/kongi_santa.jpg' · else 'assets/img/<key>.jpg'
                                  //   ('.png' for x3_* · icon_*) · unknown → '' (renderer's §9.8 fallback)
G.e3.less() → bool                // G.settings.scares !== 'full'  (덜 무섭게)
G.e3.speaker() → bool             // audioMode === 'speaker' || sound off
G.e3.lowEnd() → bool              // deviceMemory ≤ 2 || first frame > 24 ms (§9.8)
G.e3.maker() · makerHandle() → '' · makerAvatar() → ''          // facade only (no {MAKER} on screen except credits)
// formatting (§0.1 #18 — non-2027 dates carry the year; today = '오늘')
G.e3.norm(s) → string             // NFC → trim → strip \s \p{P} \p{S} \p{Extended_Pictographic} (+ joiners) → lower
G.e3.fmt12('05:39') → '오전 5:39' · fmtK(date) → '오후 9:32' · ymd(date) → 'YYYY-MM-DD' · clamp(x,a,b)
G.e3.dow('2025-12-24') → '수'     // checked weekdays (2025-01-01 수 · 2026-01-01 목 · 2027-01-01 금)
G.e3.fmtDate('2026-12-24', { today:true }) → '2026년 12월 24일 (목)' ; ('2027-01-23') → '1월 23일 (토)' ; ('2027-01-24') → '오늘'
// state helpers
G.e3.stage(key, value)            // only writer of G.state.stage — keys 'e3_played' (room climax) 'e3_dnd' (shell show) 'easyBack' (flow ending)
G.e3.session.set(id, text) · get(id) → string|null · clear()    // sessionStorage[G.EP.SESSION_KEY]; ids 'chip:<id>' 'talk:<room>:<msgId>' 'sms:<id>' 'search:last'
G.e3.sched.at(pm, id, data?) · after(ms, id, data?) · cancel(id|'prefix*') · has(id) · when(id) → pm|null · on(idOrPrefix, fn(data, id)) · list()
G.e3.momAt(v?) → 'table'|'sr'|'hall'|'lv'   // reader; with v = the only writer of vars.momAt (callers: flow call 'sr' · room door 'hall','lv' · room memory 'sr' · room climax 'lv')
G.e3.where() → 'lv'|'sr'          // reader of vars.where (writer = room G.room.where(v))
G.e3.hub() → { k, TB, items:{ nameKnown, blockBottom, albumDone } }
G.e3.m6Due() → pm|null            // pm(M5) + 60 000 (pre-defer — used by the mono M6 window and door.js)
G.e3.battery() → int              // = G.battery(); e3 writes vars.battery each tick from gotPhone (§2.1 −1 %/180 s, floor = next row value)
G.e3.led() · grade() · layers(view) // thin delegations to G.room.state() (room owns the values — §8.3-5 'G.e3.led()' source)
// monologue (§2.4 · §6.1.3)
G.e3.mono(id) → Promise<bool>     // 'mono1' | 'mono2' (and the 4 recap lines via mono('recap') — flow scenes). Queue; shows when
                                  //   G.director.safe('mono') (S1 S2 S3 S4 S6 S7 S8 S9 clear); renders G.fx.mono(text, 3200); sets the flag;
                                  //   emits 'mono:show' {id} / 'mono:hide' {id}; each id once. M6 window: if the line's turn falls in
                                  //   [m6Due() − 12 000, pm(M7)) it is dropped → vars.dir.dropped[id] = pm (object) + vars.e3.dropped (see below)
// series (§9.3 code is normative — copied into e3.js)
G.e3.cbPreview · G.e3.ep3Done · G.e3.cb(key)        // keys A A1 B('yes'|'no'|'none') C D E
G.e3.seriesBoot() · seriesStart() · commit(opts?) → bool · hookPatch(soft?) → void
//   commit: retried silently (≤ 5) on the next 'screen:push' and the next boot while END ∧ ¬committed
//   hookPatch sets hookDone (soft = pagehide/hidden: patch yes, hookDone only after hookOpened)
// ep2 facade stubs (never used by ep3 code)
G.e3.requestM2() → false · answerOk() → false · whereOk() → false · world() → {} · facts() → {} · factCount() → 0
G.e3.init()                       // sched handlers 'e3:*', hub evaluator, M2 on easyOff, battery, mono triggers, commit retry, DEBUG helpers
```
**Milestone evaluation (core, on every `flag` event + every tick):**
- `M2` — on the first `flag:easyOff` → `G.flag('M2', true)` (clock jumps 03:40).
- `hubK` = count of `nameKnown blockBottom albumDone` (`vars.hubK`). `TB` = the playMs when `nameKnown ∧ blockBottom` first both hold.
- `M3` = first tick with `hubK ≥ 1 ∧ M2 ∧ playMs ≥ pm(M2) + 120 000`. `M4` = `hubK ≥ 2 ∧ M3 ∧ playMs ≥ pm(M3) + 120 000`.
  `M5` = `M4 ∧ playMs ≥ pm(M4) + 120 000 ∧ (hubK = 3 ∨ (TB ≠ null ∧ playMs ≥ TB + 180 000))` (§2.1 · §3.11 · §12.2 V8).
- On `M5`: `sched.at(pm(M5) + 60 000, 'e3:m6due')` → bus `'m6:due' {dueAt}` once (room door.js defers ≤ 40 s and sets `M6`). Fallback:
  if `G.door` is absent at `dueAt + 40 000`, core sets `M6` itself.
- `mono1` — on `rec:text {id:'sea0333', open:false}` while `nameKnown` → `mono('mono1')` (queued: if a playback is running it waits
  for the stop + 1.5 s — S4 already covers "+2 s"). `mono2` — on `gallery:photo {door:true, open:false}` while `albumDone` →
  `mono('mono2')`. Each fires once; a line dropped by the M6 window is never re-queued.
- Battery — from `gotPhone`, each tick: `vars.battery = max(nextRow, row − ⌊(playMs − pm(rowFlag)) / 180 000⌋)` (rows of `G.EP.CLOCK`).

**Clock (engine `G.clock`, unchanged — what ep3 owners call)**: `now() hm() minutes() toMin(hm) passed(hm) jump(hmOrKey) start()
pause() resume() running() freeze() unfreeze() segment()` + bus `clock:min {hm, min, date}` / `clock:jump {from, to, skipped}`.
Milestone flags re-anchor the clock (`max(now, row time)`); capped rows loop seconds 57→58→59. Callers: flow scenes `start()` at
`introDone` and on resume · flow main `pause()` / `resume()` (pause menu) · flow call `jump('callEnd')` at t 43 and `jump('03:35')` at
handover · flow ending `jump('05:35')` · `'05:40'` · `'05:55'` · `'06:00'` per tail step · flow hook (the HOOK row is fixed 06:10) · core
`haru.time('HH:MM')`. Nobody else moves the clock. The M6 `'beat'` row drives 04:40 → 04:41 → 04:43 → 04:50 → 04:55 → 05:02, then
1 min / 15 s to 05:04.

**`G.e3.STR`** (exact strings; keys are the API — = DESIGN §10 A allow-list + §4.0 common phone strings):
`noResult "'{q}'에 대한 검색 결과가 없습니다."` · `converting '텍스트로 바꾸는 중…'` ·
`connecting '연결 중…'` · `callEnd '통화 종료'` · `noAnswer '상대방이 응답하지 않습니다'` · `connFail '연결 실패'` ·
`powerOff '전화기가 꺼져 있어 삐 소리 후 음성사서함으로 연결됩니다.'` · `swipeOpen '위로 밀어서 열기'` · `emergency '긴급 통화'` ·
`photoDeleted '삭제된 사진입니다'` · `memoEmpty '메모 없음'` · `noRec '녹음 없음'` · `noChat '대화 내용이 없습니다'` · `noEvent '일정 없음'` ·
`noNotif '알림 없음'` · `noBlocked '직접 차단한 번호 없음'` ·
`recAuto '통화가 끝나면 자동으로 녹음됩니다.'` ·
`spamShort '스팸으로 신고된 번호의 전화와 문자를 자동으로 막습니다.'` ·
`spamLong '스팸으로 신고된 번호의 전화와 문자를 자동으로 막습니다. 막은 전화는 울리지 않고 최근 기록에 남지 않습니다.'` ·
`easyDesc '더 큰 글씨와 단순한 홈 화면, 단순한 앱 화면을 사용합니다.'` · `repeatCall '3분 안에 같은 번호로 다시 걸려 오면 울립니다.'` ·
`loading '불러오는 중…'` · `exitAgain '한 번 더 누르면 게임을 나갑니다'` · `resume '🔈 소리 다시 켜기'` ·
`restart3 '3편 진행이 지워집니다. 시리즈 기록은 남아요.'` · `recanonQ '이번 플레이의 선택으로 바꿀까요? 다음 편은 바뀐 선택을 기억합니다.'` · (12.7에서 삭제/변경 — 현행: `exitAgain '한 번 더 누르면 종료됩니다'` · `restart3 '진행 상황이 지워집니다.'` · `recanonQ '이번 선택으로 바꿀까요?'`)
`soundCard '소리가 들리지 않으면 무음 모드를 끄고 볼륨을 올려 주세요.'`.
(ep2 keys still read by engine code paths that ep3 never reaches — `pinWrong` `noSimCall` … — are **absent** on purpose: if one is
ever drawn, the engine fallback string shows up in the §10 A whitelist scan and is a bug. Add a key only with a DESIGN reference.)

**`window.haru`** is created by `e3.js` **at load time** when `G.DEBUG` (`window.haru = window.haru || {}`); `G.e3.init()` fills
core's helpers (ARCH §7.2).
**Load-time assignments** (e3.js body, not `init()` — data files and `G.T` need them before boot): `G.e3 = {…}`, `G.e2 = G.ep = G.e3`,
`window.E3 = G.e3`, `G.sd = {…}`, `G.e3.STR`, `G.e3.MONO`. Everything that touches state, bus or sched waits for `G.e3.init()`.
**Dropped monologues** (M6 window rule): core writes `G.state.vars.dir.dropped[id] = playMs` (the director's own object — create it
as `{}` if missing, never an array) and `vars.e3.dropped = [id…]`; there is no `G.director.dropMono` (the director never runs mono
records — they are `owner:'core'` documentation records).

### 5.4 `ep3/js/flags.js` (core) — the state dictionary (§2.5 + §9.2 — each name has exactly one setter)
Exports `G.F` (name → name), `G.F.ALL`, `G.VARS` (`{type, def, owner}`), `G.STAGE_KEYS = ['e3_played','e3_dnd','easyBack']` and
`G.applyVarDefaults(st)`: sets `st.ep = 3`; **replaces** `st.stage` with `{e3_played:true, e3_dnd:false, easyBack:null}` unless it already
owns the key `e3_played` (engine `fresh()` always hands it ep2's `freshStage()` = `{e2_finger, e2_dash, e2_fakeReply, e2_jimin, e2_phone}`
— "when missing" would leak those keys into the ep3 save; `G.load()` then merges the saved stage over the fresh ep3 one); seeds
`vars.btOn = false` and the var defaults below **only for keys not present** (ep2 `seed` rule). flags.js also calls
`G.applyVarDefaults(G.state)` **once at load** (base.js ran `fresh()` before flags.js existed — same as `ep2/js/flags.js` last line).
All flags are **monotone** (never cleared — §9.2); toggling state lives in vars. DEBUG warns on any name ∉ `G.F.ALL`.

**Flags** (value = timestamp · read with `!!G.flag(n)`)
| flag(s) | setter (owner · file) | trigger (DESIGN §) |
|---|---|---|
| `introDone` `recapShown` | flow · scenes | earphone test [시작] / recap shown or skipped (§3.0) |
| `M0` `momLine1` | flow · scenes | cold open start / first 엄마 card: first 270° view ∨ M0 + 40 s (§3.1 · §2.1) |
| `kongiTail0` `collarSeen` `soupSeen0` `calSeen0` | room · roomdata | M0/camera hotspot captions (§3.1 table) |
| `M1` `callRing` | flow · call | first ring t = 0 (= M0 + 110 s fixed, §2.1 · §0.3 D14) — same tick |
| `callAnswered` `callEnded` `handover` | flow · call | t 6.0 · t 39.0 · end of the 03:35 card chain (§3.1) |
| `gotPhone` | shell · lock | first swipe on the easy lock (`G.EP.LOCK.firstFlag`) |
| `easyOff` `easyGate` `folderSeen` | shell · easymode (`folderSeen` via phone.js folder open) | first switch-off · first switch-only gate drawn · first folder open (§3.3 · §5.4) |
| `M2` `M3` `M4` `M5` | core · e3 | ARCH §5.3 rules |
| `kang341` `kang502` | comms · sms | 03:41 SMS delivered (M2 + 40 s) · 05:02 SMS delivered (door t 176 via `G.sms.deliver`) |
| `kang341Sent` `kangNameSent` `kangBlockSent` `kang702Sent` `kangAskSent` | comms · sms | the chip was sent (§3.4) |
| `recListOpened` `recPlayerOpened` `recPlayed` `textAnyOpened` | comms · callrec | §3.6 · §3.7 (`recPlayed` = sea0333 ≥ 3 s) |
| `textOpened` `greySeen` `heard21` `nameKnown` `sigName` `radioHeard` | comms · callrec | **sea0333 only** (§3.7 · §9.6 ② · §12.2 V1) |
| `blockOpened` `blockBottom` | comms · callrec | C7 opened · bottom row ≥ 60 % visible ≥ 200 ms (§3.8 · §9.5-4) |
| `missedSeen` `call112First` | comms · apps/phone.js | 03:31 missed row drawn (§3.8) · 112 result ② (`bip ∧ ¬jimin112`, §3.2.3 · §12.2 V15) |
| `momBlock` `mom331` `momDnd` `momMembers` `momBom` `glasses` `dndChipSaid` | shell · show | reactions of §3.2.2 · `dndChipSaid` = the DND chip said (reaction or tail) |
| `dndOpened` `dndLogOpened` | shell · settings | `dnd` / `dnd.log` screens drawn (also via QS long-press) |
| `albumOpened` `membersSeen` `bomSeen` `albumDone` `saw702` | media · gallery | §3.10 (`albumDone` = membersSeen ∧ bomSeen) |
| `calCake` | media · calendar | `2025년 11월 26일 (수) · 내 생일 🎂` detail opened |
| `M6` `bip` `view0AfterM6` `doorDone` `jiminUp` `jiminChipSent` `jimin112` `patrol` `kongiBack` `M7` | room · door | §3.12 table (`M7` = pm(kang502) + 45 s); core sets `M6` only as the fallback |
| `heightSeen` `drawingSeen` `drawingBack` `manualSeen` `orgelSpotSeen` | room · roomdata | sr closeups (§3.13 table) |
| `memoryStart` `memoryDone` `M8` | room · memory | §3.13 (`M8` = memoryDone + 20 s) |
| `playArmed` `played` `playFallback` | room · climax | §3.14 |
| `END` `collarOn` `soupServed` `easyBackChip` | flow · ending | END line drawn (commit ①) · first '딸랑' · four bowls · tail chip drawn (§3.15) |
| `HOOK` `hookOpened` `boilerSting` | flow · hook | §3.16-3 · §6.4-① |
| `hookDone` | core · `G.e3.hookPatch` (called by flow hook) | §9.3 ⑤ |
| `mono1` `mono2` | core · `G.e3.mono` | when the line is displayed |

**Vars** (`G.vars(k)`; default in `def`)
| var | type · def | setter | meaning |
|---|---|---|---|
| `pm` · `clock` · `sched` · `battery` | object · `{}` · `[]` · null | core | engine ledgers |
| `hubK` · `TB` | int 0–3 · 0 / pm · null | core | §3.11 |
| `momAt` | `'table'|'sr'|'hall'|'lv'` · `'table'` | core `G.e3.momAt(v)` (callers flow call · room door/memory/climax) | §2.3 |
| `where` | `'lv'|'sr'` · `'lv'` | room `G.room.where(v)` | {N}'s space (room hotspots · M7 · M8 cards) |
| `momTaps` | int · 0 | flow scenes | M0 엄마 taps |
| `easy` | bool · true | shell easymode | current mode |
| `showSeen` | `{scr:1}` · `{}` | shell show | reaction chains seen to the end |
| `dndNow` · `dndAt` | bool · false / string · null | shell (settings + QS) | DND `지금 사용` (harmless) |
| `soundMode` | `'sound'|'vibrate'|'mute'` · `'sound'` | shell (QS) | real-phone muting |
| `kang` | `{queue:[], sent:{}, replyAt:{}, freeAt:null}` | comms sms | chips & replies |
| `calls` · `call112` · `talkCalls` | `[{n, hm, sec, dir}]` · 0 · 0 | comms | simulated calls (recents / 세아 💛 room rows) |
| `gal` | `{zoomMs, fullMs}` | media gallery | `saw702` measuring |
| `m6Hold` | pm · null | room door | defer start |
| `memEarly` | bool · false | room memory | drawing seen before M7 |
| `play` · `playFails` · `momAwayUntil` · `seatedMs` | object · `{head:0,tail:0}` · pm·null · int 0 | room climax | §3.14 · §9.2 |
| `seq` | `{m1, m6, m7, m8}` · all null | flow call (`m1`) · room door/memory/climax (`m6` `m7` `m8`) | set-piece step ids for resume |
| `endStep` | `'e0530'|'e0530c'|'e0535'|'e0540'|'e0545'|'e0555'|'e0600'|'cred'|'check'|'hook'|null` | flow ending | tail step |
| `dir` | `{fired:{id:pm}, T, dropped:{id:pm}}` | flow director (core writes dropped mono ids into `dropped` — the one shared key) | `fired` and `dropped` are objects id → playMs (ARCH §9 G11) |
| `recAuto` · `spamSw` · `unknownBlock` | bool · true / true / false | comms `G.callrec.setting(key, v)` (callers: comms C2/C6, shell easymode E6 gates) | the three call-setting switches (they "really move", progress 0 — §5.4 E6 · §5.5 C2/C6) — one state for the easy gate and the standard screen (`recAuto`: E6 rec + C2 `settings.toggle:recAuto`; `unknownBlock`: C6 `block.unknown`; `spamSw`: E6 spam only — C1a/C6/C6b keep the fixed `사용 중` text, DESIGN has no off-string) |
| `nb` | `{tab, hintAt:{}, memo:'', doneSeen:{}}` | flow notebook | memo = the only player text in the save |
| `au` | object | audio | house layers, listener, boiler pump |
| `room` | `{view, room, closeup, st:{…state keys}}` | room | ARCH §5.12 |
| `replay` · `committed` · `commitTries` · `patched` | bool · bool · int · bool | core | §9.3 |
| `e3` `sh` `cm` `md` `rm` `fl` | object | owner-private | free schema |
Stage (`G.state.stage`, written only via `G.e3.stage`): `e3_played` (room climax: `played` → true, `playFallback` → false) ·
`e3_dnd` (shell show: `momDnd` → true) · `easyBack` (flow ending chip → true/false). `G.state.cb` = core (frozen at `introDone`).

### 5.5 `engine/series.js` and `ep3/js/gate.js` (core)
- `G.series` API = engine as is (ARCH2 §4.6) + the three registrations (ARCH §4.2). **Only `e3.js` may reference `G.series`** in
  `ep3/js` (QA: `grep "G.series" ep3/js` → `e3.js` and `gate.js` only — the gate reads `isReleased(3)` before anything else).
- `gate.js` = `ep2/js/gate.js` copied with `isReleased(2)` → `isReleased(3)` and `fl2-title`/`fl2-t-smalls`/`fl2-small` → `fl3-*`:
  first executing code after `../engine/series.js`; before release and without `?debug=1`/`?preview=1` → hide body → `window.stop()`
  → `location.replace('../series/')` (`file:` → `../series/index.html`); no ep3 save, no `eps.3 started`, no listener, no timer, no
  storage; exposes `G.gate = { released() → bool, titleLink(node) }` for the title's single `다른 이야기` link (keeps `?preview=1`,
  - (12.7에서 삭제/변경 — 위 `before release … ?debug=1`/`?preview=1` 줄은 폐기. 현행: `gate.js`는 `G.series.isReleased(3)`이 참일 때만 열린다(`RELEASES = { 2: 0, 3: 0 }`이라 늘 참 = 잠금 없는 inert gate). **엔진이 없거나 `isReleased`가 없거나 거짓이면 닫힌다(fail-closed)**: body 숨김 → `window.stop()` → `location.replace('../series/')`(`file:` → `../series/index.html`) — 저장 · 리스너 · 타이머 0. `?debug=1`/`?preview=1` 우회 없음. `title.series` 링크에 `?preview=1` 꼬리 없음. `main.js`의 `released()` 두 번째 잠금은 `G.gate.released()`만 읽고 `gate.js`가 없으면 닫힌다(그대로). 근거: `ep3/js/gate.js` · `ep3/js/main.js` · DESIGN_EP3 §12.7.)
  data-qa `title.series`).
- Root picker (`series/series.js`, `series.css`) = the §9.9 block verbatim (EPS row `{ n: 3, room: '702', title: NREUL + ' 위한 방탈출!
  3', sub: '엄마의 번호', href: FILE ? '../ep3/index.html' : '../ep3/', rec: 'left', seen: ['e3_grey'], sea: ['sig_name'] }`, `B2 = { x:
  278, w: 38, fh: 13, floors: 16 }`, `WINS['702'] = { x: 293, y: 243, w: 8, h: 6 }`, building drawn before the villa, 3 dark windows per
  floor, roof tank) — the ep2 villa SVG is not changed. List row `data-qa picker.ep:3`.

### 5.6 Cards and chips (core · `ep3/js/cards.js`) — `G.cards`, `G.chips`
Every name card (`엄마` · `지민`), situation card (no name tag), set-piece card, reaction card and tail card goes through this one
renderer (§4 읽는 법: slow reveal 70 ms/char · line gaps 1.2–2.0 s · `…` = pause · tap = next).
```js
G.cards.play(script, opts) → Promise<{ picks:{ [stepId]: { id, text, edited } | null }, aborted:bool }>
  // script = Step[]:
  //   { id?, who:'엄마'|'지민'|null, text: string | () => string, gapMs=1600, tap=true }   name card (who) | situation card (who null)
  //        text is raw (tokens) — rendered through G.T; `…` inside the text = 1.2 s pause during the reveal (§4.1.2 ⊕)
  //   { id, chips:[{ id, label, edit=false, verb:'say'|'send'|'pick' }], timeoutMs, timeoutPick=null, keepOnTimeout=false }
  //        chip sheet (G.chips.ask) — timeoutPick null ⇒ pick = null ('아무 말도 하지 않는다' outcome); keepOnTimeout ⇒ the script goes on,
  //        the chip stays until tapped or the script ends (M8 `[네. ✎]` 15 s rule — §3.14)
  //   { id, when:(picks) => bool }    skip the next step group unless true   ·   { id, run: async (ctx) => void }   owner callback
  //   { wait: ms }
  // opts: { id:'<owner>:<name>' (required — e.g. 'show:callrec.blocked', 'door:0440', 'end:tail'), mode:'story'|'react',
  //         speedMs=70, abortable=true, onStep(step, i) }
G.cards.say(who, text, o?) → Promise          // single card
G.cards.showing() → bool                      // S7 (§6.1.3) — a card is visible or its gap is pending
G.cards.close({ reason:'m6'|'replace'|'end' }) // aborts running scripts (0.4 s fade) → they resolve {aborted:true}; flags already set stay
G.cards.current() → { id, stepId } | null ; G.cards.hide(on)   // flow hides story cards while a phone UI it opened is up
// bus: 'card:show' {id, step, who} · 'card:hide' {id, aborted}

G.chips.ask({ id, chips, timeoutMs, timeoutPick, ctx }) → Promise<{ id, text, edited } | null>
  // edit:true chip → tap puts the sentence into G.ui.field({ predict:false, ctx:'chip:<id>' }) with [말하기] (verb 'say') or [보내기]
  // (verb 'send') and [두기] → resolves { id:'keep' }. Edited text → G.e3.session.set('chip:' + id, text) and edited:true.
  // verb 'pick' (e.g. `[큰 글씨로 다시 해 두기]` `[그대로 드리기]` `[아무 말도 하지 않는다]`) commits on tap.
G.chips.isOpen() → bool                       // S8 — DESIGN §6.1.3 writes it `G.chips.open()` (ARCH §9 G3)
G.chips.close(reason) → void                   // resolves the pending ask with null
// bus: 'chips:open' {id} · 'chips:close' {id, pick}
```
**Advance rule (one rule for every caller — the timed set pieces depend on it):** a text step reveals at `speedMs`/char, then waits
`gapMs` and **advances by itself**; a tap on the card (`card.next`) during the reveal completes the reveal, a tap after it advances
at once (skips the rest of the gap). Nothing ever waits for a tap (no `[계속]` except the explicit 06:00 `next` button flow draws
itself — data-qa `end.next`), so the 04:40 / M8 / tail scripts keep their DESIGN timing whether or not the player taps; QA "cards" = tap `card.next` until
`card` is gone (it only speeds up). `tap:false` = taps ignored on that step (use for lines that must sit their full gap, e.g. the
03:33 situation cards bound to the call timeline). Step fields not listed above (e.g. setpiece `success.then`) are **read by the
caller**, not by `G.cards`. While a card or chip sheet is up the layer consumes Android back / Esc through `G.phone.pushBack` (back
= same as a tap; it never aborts a script) and hides the in-game keyboard unless a chip field owns it.
Rendering: layer `.c3-card` z 150; `mode:'react'` cards sit under the phone screen (show reactions), `story` cards full-width and
bottom-anchored (never over the top 56 px — ARCH §2.3); text size follows `G.settings.textSize` (game layer — §4.0 '글자 크기').
data-qa `card` (layer) · `card.next` (the card box — the tap target) · `chip.opt:<chipId>` ·
`chip.field` · `chip.send` · `chip.keep`. Input-bar chips inside the 강수진 thread are **not** chip sheets (comms renders them with
`G.chat` — §9.5-4 "입력칸 위 칩 — 시간 제한 0").

### 5.7 Shell — `G.phone` additions, notifications, lock, quick panel (`engine/core/phone.js`, `engine/apps/lock.js`)
Kept from ep2 (ARCH2 §4.9): `G.app` · `G.apps` · `G.ui.screen` · `G.ui.list` · `G.phone.init openApp push pop back home closeAll top
stackDepth canBack pushBack dismissModals modalOpen isLocked setLocked renderHome refreshBadges iconNode setWallpaper statusTheme
updateStatus route notify notifList markRead dismissNotif unread dialog sheet toast overlay quickPanel closeQuickPanel`, `G.users`
(single user `'n'` in ep3), `G.lock`.
```js
G.phone.callScreen({ id, name, number, kind:'cell'|'talk'|'emergency', avatar, big=false, script }) → Promise<{ sec, by:'script'|'user' }>
  // UI (§5.3 통화 화면): name (40 px when big) · STR.connecting + ringback (cue 'call.ringback' 2–6 s for cell/emergency · 'talk.dial'
  //   30 s for talk) · then `await script(api)`; api = { status(text), card(text), beep(hz=1000, s=0.5), connect(), line(on),
  //   wait(ms), timer(on) (shows mm:ss), end(label = STR.callEnd) }. Buttons `스피커` `음소거` `키패드` = pressed look only; red end
  //   (data-qa call.end) ends at any time (by:'user'). Cues: call.connect · call.line · call.end (cell) / talk.end (talk).
  //   No other phone in the room rings or buzzes (§0.1 #34). Layer .sh3-call z 47. Emits 'call:start' {id, kind, number, name} ·
  //   'call:end' {id, kind, number, sec, by}. Recents / vars.calls are the caller's (comms).
G.phone.inCall() → bool                       // S9
G.phone.notify({ id, app:'sms', title, body, chat, route, when, silent, vibrate=true }) → { id, banner }
  // ep3 ids = DESIGN §4.13 'N01'…'N09' ('N02′' → 'N02p'); same chat → `{title} · 새 메시지 {k}개` grouping in the panel;
  // sound = G.tones.play(G.tones.for({app, chat})) unless vars.soundMode mutes / vars.dndNow / vars.dnd; chat open (hook 'chat:isOpen')
  // → no banner + 'inapp' pop; vars.dndNow → no banner, no sound, no vibration — panel entry + badge only (§4.13); soundMode 'vibrate' →
  // G.audio.vibrate(G.tones.vibKey(id)) = 'sms'; no 3-tone cap (G.tones.cap === 0); easy mode → banner ×1.3 and its tap routes to
  // G.easy.sms(threadId) instead of route. Blocked numbers never notify (callers simply do not call notify). Stored raw (tokens), G.T
  // at render. The one ep3 caller is comms G.sms.deliver, always with
  //   { id:'N01'…, app:'sms', title:'강수진 형사님', body:<first text of the delivery, raw>, chat:'sms:kang',
  //     route:{ app:'sms', params:{ thread:'kang' } } }   (later texts of the same delivery: same id ⇒ the banner updates, panel groups)
// home (G.EP.HOME getter — read on every renderHome): spec.render(homeEl, api) | default grid + folder items + dock + widget(widgetOpen)
//   render api = { openApp(id, params), iconNode(app, o), setWallpaper(src, key), hm() → 'HH:MM', date() → '1월 24일 일요일' (kDate) } —
//   the easy home calls api.openApp for its six tiles and `calendar` from its date line (data-qa easy.date)
//   folder overlay: grid of home.app:<id> + scrim `home.folder.close` (tap outside / back / Esc closes — a real phone folder)
// bus: 'home' · 'home:show' {user} · 'folder:open' {name} · 'screen:push' {…entry, scr} · 'screen:pop' · 'app:open' id · 'quickpanel' ·
//      'notify' n · 'notify:shown' {id} · 'call:start' · 'call:end'
// status bar: ⏸ 44 px area (→ hook 'pause:open') · time G.clock.hm() (no seconds) · `LTE` bars · Wi-Fi `집` while on · battery G.battery()%
// QS tiles: `Wi-Fi 집` (toggle — status icon only, 톡 keeps working) · `소리` (cycle 소리 → 진동 → 무음 = vars.soundMode) · `손전등`
//   (→ G.room.open({mode:'camera', flash:true}) / G.room.flash(true)) · `방해 금지` (tap = vars.dndNow toggle, same state as the
//   settings switch; long-press 0.5 s = G.settingsApp.open('dnd') → dndOpened) · brightness bar (decor) · notifications (else STR.noNotif)
G.lock = { init(), show('n'), hide(), isShown() }   // ep3: easy skin, first unlock → gotPhone (ARCH §4.2), never shown again after
// bus: 'lock:show' {user, mode:'easy'} · 'lock:unlock' {user, how:'swipe'|'key'|'drag', first:true}
```

### 5.8 Easy mode — module ① (shell · `ep3/js/apps/easymode.js`) — `G.easy` (§5.4 · §9.6 ① · §0.3 D43 names)
```js
G.easy = {
  init(),
  on() → bool,                               // vars.easy (default true)
  set(on, { silent } = {}) → Promise,        // E8 unfold/fold 0.9 s (silent = instant, for resume/debug) · no confirm dialog ·
                                             //   bus 'easy:change' {on, first} · first false ⇒ flag easyOff (core sets M2) · true always allowed
                                             //   fold: if the top screen is hidden in easy mode (phone ⋮ screens · sms app · folder apps · callrec)
                                             //   → G.phone.closeAll(true) → easy home; G.callrec.stop() (session 'abort', reason 'fold')
  homeSpec() → spec,  renderHome(node, api), // used by the G.EP.HOME getter (EASY.render)
  lockSkin(node),                            // E1 — big clock (live G.clock.hm(), `3:35` at handover) · `1월 24일 일요일` · kongi_old ·
                                             //   STR.swipeOpen · STR.emergency (left) · camera (right) — no notifications
  phone({ tab:'pad'|'recent'|'contacts' }),  // E3/E4 — no ⋮ · recents = G.phoneApp.recents({ days:G.STORY.easy.recentDays }) · cards → [전화] [문자]
                                             //   every call (keypad 📞 · card [전화] · sheet `전화 걸기`) = G.phoneApp.dial(numberOrId, { from:'easy', big:true })
                                             //   — comms resolves the result (112 flags, call112First, kcall, vars.calls); easymode never reads dial.results
                                             //   [문자] / `문자 보내기` = G.easy.sms(contactId) · the big keypad registers G.ui.inputSource (S1)
  sms(contactId),                            // E5 — one thread, big (renders via G.sms.renderThread(node, id, { big:true })), no ⋮, no ←
  gate(kind:'rec'|'spam'),                   // E6 switch-only screen (data-scr easy.gate.rec / easy.gate.spam) → flag easyGate · the big switch
                                             //   (data-qa easy.gate.switch) reads/writes G.callrec.setting('recAuto'|'spamSw', v) — same state as C2 / C6b
  ringScreen(node, { from:'sea', kind:'talk', phase:'ring'|'call'|'ended', sec }),   // E9 into room's screen node (03:33) — inert to taps;
                                             //   calling it again on the same node updates phase/sec in place (flow call.js drives it)
};
// settings keys registered via G.settingsApp.register: 'display' · 'display.font' · 'display.easy' (+ the gates 'easy.gate.rec' 'easy.gate.spam')
// hidden while easy: phone ⋮ · sms app + icon · folder · all-time recents · contact call log · calendar/clock icons (calendar via the widget date)
// NOT hidden: the whole 설정 app (1.3× text) · 사진 incl. the shared album · 톡 · 모임 · 카메라 (#screen.ez3-on → text 1.3×)
```

### 5.9 Show to mom (shell · `ep3/js/show.js`) — `G.show` (§3.2.2 · §4.10 · §5.3)
```js
G.show = {
  init(),
  enabled() → bool,            // drawn from gotPhone until the M8 card chain starts (climax 'climax:m8cards' bus) — never conditional on the screen
  dim() → bool,                // opacity .4 + inert while S7 ∨ S8 ∨ S9 ∨ (M6 ∧ clock < 04:41) — §3.2.2
  scr() → string,              // G.phone.top()?.scr || (camera open ? 'camera.<view>' : G.easy.on() ? 'easy.home' : 'home')
  press() → Promise<void>,     // data-qa show.btn — where ≠ momAt ⇒ position card; else tilt 0.4 s + reaction by scr (G.STORY.show)
  dndChip({ ctx:'show'|'tail', timeoutMs }) → Promise<bool>   // the one chip `세아 씨가 그 메일에 썼어요. 절대 엄마 잘못 아니라고. ✎` /
                               //   `[아무 말도 하지 않는다]` (show: 20 s · tail: 10 s) → 'said' sets dndChipSaid; flow ending calls it with ctx 'tail'
};
// Reaction rules: first press after easyOff prepends `엄마가 안경을 찾아 쓴다.` (glasses); a chain seen to its end → vars.showSeen[scr]
// (then `엄마가 고개를 끄덕인다.`); a chain aborted by M6 is not 'seen'. `phone.recent` reacts only when the row
// [data-row="sea-20251124-0331"] of the top node is ≥ 60 % inside the viewport; `gallery.photo.door` uses [data-photo]; callrec
// screens before M8 → `엄마가 화면에서 눈을 돌린다.` → `…그건 못 보겠어요.`; unknown ids rotate the three neutral reactions.
// Flags: momBlock mom331 momDnd(+ stage e3_dnd = true) momMembers momBom glasses dndChipSaid. bus 'show:react' {scr, key, second}
```

### 5.10 Comms — phone app, call recording, SMS, talk
```js
// engine/apps/phone.js (ep3 branch: G.STORY.dial.sim === true) — the standard phone (§5.2 전화 row · §4.3.2)
G.phoneApp = {
  init(), open({ tab:'pad'|'recent'|'contacts', contact, recentId }),
  dial(numberOrContactId, { from:'pad'|'contact'|'lock'|'easy', big }) → Promise<void>,   // resolves the simulation result from
         // G.STORY.dial.results (flag-based 112 rows, power-off carrier text, 강수진 30 s → `응답 없음` → 1-min SMS via G.sms.deliver('kcall'),
         // 지민 before/after bip, 관리사무소, others) → G.phone.callScreen(spec); appends vars.calls (recents, in-game stamp) ·
         // 112 ⇒ vars.call112++ and, when bip ∧ ¬jimin112, flag call112First. Never adds to the call recordings.
         // 강수진: the 1-min `kcall` SMS is sent only when kang341 is already on and only once (§3.2.3 "03:41 전이면 03:41 문자가 그
         // 자리를 대신한다" — a call before 03:41 schedules nothing; the 03:41 SMS arrives on its own timer). The single entry point for
         // every caller: standard keypad/contacts/recents, the lock emergency keypad, easymode E3 (from:'easy', big:true).
  emergency(),                                                   // = hook 'phone:emergency' (lock 긴급 통화 → keypad overlay `.cm3-emerg` z 46)
  contacts() → [...], recents({ days }) → [...],                 // read by easymode E3 (30 days)
         // contacts() = G.STORY.dial.contacts entries as is ({ id, name, number?, avatar?, label?, fav? }) — number display rule
         //   §4.3.2 is applied by the renderer (E4 never shows a number); recents({days}) = newest first, merged data rows + seeded months
         //   + vars.calls: { id, who (contact id | null), name, number, d:'YYYY-MM-DD', hm:'HH:MM', dir:'in'|'out'|'missed', sec, noAnswer,
         //   rec (recording id | null), row (data-row | undefined) } — raw values, the renderer formats with G.e3.fmtDate / fmt12
  missedRowVisible() → bool                                      // DEBUG/QA helper
};
// ⋮ menu → `설정` · `통화 녹음` · `번호 차단` → G.hooks.call('callrec:open', 'settings'|'rec.list'|'block');
// call detail `녹음 1 ›` → G.callrec.openList({ scrollTo:id }); the 03:31 row carries data-row="sea-20251124-0331" **both** in 최근 기록
//   and in contact `세아 💛` › `통화 기록` (data-scr phone.contact.sea.log) → missedSeen (60 % · 200 ms) and the show test (§5.9).
// Recents row ids (data-qa phone.recent.row:<id>): row.row when the data gives one, else `<who>-<YYYYMMDD>-<HHMM>`; simulated calls
//   appended at run time = `call<n>` (n = index in vars.calls). Phone screens' data-scr: phone.pad · phone.recent · phone.contacts ·
//   phone.contact.<id> · phone.contact.sea.log · phone.calldetail (§5.8). Every keypad registers G.ui.inputSource (S1 '키패드 숫자').

// ep3/js/apps/callrec.js — module ② (names = §9.6 ② · §0.3 D43)
G.callrec = {
  init(),
  open(screenId, params),               // 'settings' 'settings.spam' 'settings.reject' 'settings.ring' 'rec.settings' 'rec.list' 'rec.player'
                                        // 'rec.text' 'block' 'block.spam' 'block.calls' 'block.call' 'block.msgs' 'block.msg' 'voice' (= hook 'callrec:open')
  recordings() → rec[],  openList({ scrollTo }),  openPlayer(id),  openText(id),
  play(id, { by:'play'|'line'|'seek', line, at }) → handle,     // the single playback handle (list · player · text mini player) → G.media.play(
                                        //   G.audio.buffer(rec.buffer) | null with dur, { from:'callrec', id, offset }) ; starts a session
  pause(), resume(), seek(t), stop(), state() → { id, t, playing, sess },
  session() → { id, sess, s0, by, line, a, b, pausedSec, away, noSig } | null,   // §3.14 definition
  textOpen() → bool,                    // S5 — C5 is the top screen
  sinceStopMs() → number,               // ms (playMs) since the last playback stopped · Infinity if never (S4 '+2 s')
  out() → 'ear'|'table',                // = G.EP.mediaRoute()
  setting(key:'recAuto'|'spamSw'|'unknownBlock', v?) → bool,   // the only reader/writer of vars.recAuto · spamSw · unknownBlock (shell E6 calls it)
  blocked: { calls(), messages(), openCalls(), openMessages(), pushMessage(row, { silent:true }) },
  renderBlockedMsgs(node, { hook:true }) → { push(row) → Promise },   // hook cut: standard UI into room's screen node; push = 0.5 s slide, silent
};
// Screen id → data-scr (§5.8 — the show table keys): settings → callrec.settings · settings.spam → callrec.settings.spam ·
//   settings.reject → callrec.settings.reject · settings.ring → callrec.settings.ring · rec.settings → callrec.rec.settings ·
//   rec.list → callrec.list · rec.player → callrec.player (its 세부 정보 sheet carries callrec.player.info but is an overlay — show reads
//   the stack top, i.e. callrec.player) · rec.text → callrec.text · block → callrec.block · block.spam → callrec.block.spam ·
//   block.calls → **callrec.blocked** · block.call → **callrec.blocked.number** · block.msgs → **callrec.blockedMsgs** ·
//   block.msg → callrec.blockedMsgs.msg (neutral) · voice → callrec.voice.
// Sessions (§5.5 '세션' · §9.6): start = ▶ / line tap / scrub release; pause ≤ 15 s (playMs) keeps the session ('pause'/'resume'), > 15 s →
//   'abort' (reason 'pause15'); scrub, another recording, easy fold → 'abort'; reaching dur → 'end'. covered = [a, b] (one interval,
//   100 ms polling of the media position — volume/output independent). away = any poll with playMs < vars.momAwayUntil (sticky).
//   Hidden tab does not break a session. No buffer ⇒ a silent timer of the same length drives position, lines and events.
// bus: 'rec:list' · 'rec:player' {id} · 'rec:session' {id, sess, by, line, s0, a, b, state:'play'|'pause'|'resume'|'end'|'abort', reason,
//      out, away} · 'rec:time' {id, t, sess, a, b, out, away} (100 ms — carries the live session fields so climax can judge the head
//      rule and the position cards without polling) · 'rec:text' {id, open} · 'block:open' · 'block:bottom'
// flags: recListOpened recPlayerOpened recPlayed textAnyOpened · (sea0333 only) textOpened greySeen heard21 nameKnown sigName radioHeard ·
//   blockOpened blockBottom.  sigName = id 'sea0333' ∧ by 'line' ∧ line 21 ∧ b ≥ 22.0 ∧ ¬playArmed ∧ ¬noSig.
// app 'voicerec' (folder) → open('voice'). Subtitles inside the player: S12 (sea0333 over 8.6–15.4 · 22.6–30.9) · S13 (plain recordings).

// engine/apps/sms.js (new) — 메시지
G.sms = {
  init(), open(threadId), isOpen(threadId) → bool,
  deliver(msgId, { silent=false }) → Promise<bool>,   // appends a data message to its thread (stamp = in-game clock now), raises the
                                                      //   §4.13 notification, sets kang341 / kang502 for those ids. Callers: comms itself
                                                      //   (03:41 · replies · keep · kcall) and room door.js ('k0502' at door t 176)
  renderThread(node, threadId, { big }) → api,        // used by easymode E5 — api = { destroy() }; the thread's input field, chips and
                                                      //   replies inside it follow exactly the standard-thread rules (same vars.kang / threads)
  threads() → [...]
};
// hook 'chat:isOpen' (threadId) → bool — implemented here for both sms ('sms:<id>') and talk ('talk:<id>') threads.
// 강수진 chips: input-bar chips via G.chat.view().setChips — 03:41 chip from kang341 until 05:02; later chips appear (in order, one at a
//   time) when nameKnown / blockBottom / saw702 / kang502 become true; [보내기] → reply 40 s later; [두기] → keep (03:41: one SMS 60 s
//   later); free text → `네, 확인했습니다.` after 40 s, at most once per 10 min. ⋮ → `설정` › `번호 및 스팸 차단` (callrec 'block') ·
//   `차단된 메시지` (callrec 'block.msgs').
//   Queue (vars.kang.queue — "생긴 순서대로 한 번에 하나", §3.4): nothing is drawn before kang341; at kang341 the queue starts as
//   ['k341', …later chips whose flag is already on, in data order]; afterwards a chip is appended on the `flag:<when>` event. Exactly
//   one chip (data-qa `chat.chip`, its [두기] = `chat.chip.dismiss`) is visible: the queue head. k341 leaves the queue on
//   send/keep or at kang502 (`until`); a later chip's [두기] removes it with no reply. A chip's text is frozen when first drawn (k702
//   `bomSeen` suffix, §12.2 V30). Chip tap → the sentence goes into the thread's input field (G.ui.field, ctx 'chip:<id>', editable)
//   → `chat.send` sends it (edited ⇒ session text, saved `{chip, edited:true}`). Example order for the ARCH §7.5 speedrun:
//   blockBottom (step 3) before kang341 → queue ['k341','kblock'], then nameKnown appends 'kname' → kblock is sent before kname.

// engine/apps/talk.js (G.STORY.talk.mode === 'in')
G.talk = { init(), open(roomId), isOpen(roomId) → bool }   // rooms 'sea' 'jimin' 'self' 'group3' 'kitchen'
// room call button / left call bubble → sheet `다시 걸기` → G.phone.callScreen({ kind:'talk', name:'세아 💛', avatar:'avatar_sea', big:G.easy.on() })
//   → 30 s → STR.noAnswer → right row `보이스톡 · 응답 없음 · 오전 {h}:{mm}` (vars.talkCalls / threads 'talk:sea'). '1' never changes.
// bus: 'chat:open' {thread:'talk:<id>'|'sms:<id>'} · 'chat:msg' {thread, id}
```

### 5.11 Media apps (engine apps with `v:3` data)
```js
G.gallery = { init(), open({ tab:'photos'|'albums', album, photo }), current() → { scr, album, photo, info } | null }
  // shared album: head `공유 앨범 '콩이' · 멤버 3 · 사진 8` + avatars (tap → 멤버) · ⋮ `멤버` `활동` `앨범 정보`; member `sagongsa` → detail;
  // activity `sagongsa님이 참여했습니다` row → the same member detail (membersSeen); 04:31 / 11-25 rows → STR.photoDeleted. Viewer zoom
  // 1–3× (pinch · double-tap 2× ↔ 1× · wheel/'+') → bus 'gallery:zoom' {photo, scale, ms}; saw702 = p3_kongi_1130 at ≥ 1.8× for 1.5 s
  // continuous or full screen 3 s continuous (playMs). Door photos carry data-photo 1130|1213|1204|1224 and data-scr gallery.photo.door.
  // bus: 'gallery:album' {id} · 'gallery:photo' {photo, open, info, door} · 'gallery:zoom' {photo, scale, ms}
G.calendarApp = { init(), open(day /* 'YYYY-MM-DD' */) }           // opened by the home widget date line and the standard icon
G.browser = { open({ appMode:'moim'|'files'|'weather'|undefined, page }), openPage(id), search(q) }
G.memo = { open() } · G.mail = { open(id) } · G.clockApp = { open({ tab }) }
// shots from the room shutter land in album `카메라` (vars.shots — progress 0)
```

### 5.12 Room — `G.room`, `G.ROOM`, room state (room · `engine/room/room.js`, `ep3/js/room/roomdata.js`)
```js
G.room = {
  init(),
  open({ mode:'camera', room:'lv'|'sr', view, closeup, fromLock, flash, onClose }) → api,   // the 카메라 app (room/view default from
                                             //   vars.where / vars.room); M7/M8 'where' changes make the next open land in sr B / lv
  eye({ view, closeup, fadeMs=0, spots=true }) → eyeApi,   // eye view (no chrome) z 45 — M0, 03:33, END, tail settle, hook
     // eyeApi = { show({ view | closeup, ms=400, grade }) → Promise, spots(on), screenNode() → Element|null  // c3_phone_ring(_lit) ring_q
     //            dim(level, ms) → Promise, close(ms=400) → Promise, state() }
     // eye views: `#screen.eye-mode` while any is open (engine rule); root data-qa `room.eye` with data-view="<view id>" (and
     //   data-closeup when a closeup is up); no buttons are drawn (no chrome) — rotation = drag, or desktop `ArrowLeft` (−90°, e.g.
     //   r3_door → r3_kitchen) / `ArrowRight` (+90°) while the eye root has focus (§9.5-5 "터치 전용 동작 0"); hotspots keep room.spot:<id>.
     // camera mode root: data-qa `room.camera` with data-room / data-view; arrows room.next (+90°) / room.prev (−90°) and dots
     //   room.view:<id> exist **only in camera mode**.
  close({ all }), isOpen(), current() → { mode:'camera'|'eye', room, view, closeup } | null,
  where(v?) → 'lv'|'sr',                     // the only writer of vars.where (go: hotspots · M7 card · M8 card) — bus 'room:where' {where, prev}
  set(key, value, { ms }) · get(key) · state() → { …keys, led, grade, winLights, mom },   // persisted vars.room.st (table below)
  pulse(kind:'boiler'),                      // 90° util-door glow .15 for 60 s, fade 8 s (§6.3)
  led(pattern:'err3'),                       // 3 red blinks synced with door.err3 (.15 on/.15 off · reduced-flash = 0.9 s once)
  refresh(), dirSub(text, az, ms), flash(on?) → bool,
};
// bus out: 'room:open' {mode} · 'room:close' {mode} · 'room:view' {room, view, closeup} · 'room:spot' {id, view} · 'room:closeup' {id, open}
//          'room:where' {where, prev} · 'room:shot' {view}
// yaw: lv [r3_door(camera 6°), r3_veranda, r3_sofa, r3_kitchen] → index·90 + (panX − .5)·50 (+6 on r3_door) · sr [r3_sr_desk 0°, r3_sr_bed 180°];
//      closeups inherit the parent yaw (§7.1.2) → G.audio.setYaw. Hotspot `go:'sr'` (r3_door x .82–1.0, top 2/3, ≥ 44 × 120 px, wins over
//      kongi) / `go:'lv'` (r3_sr_bed door): first tap after gotPhone = caption 1.2 s then 0.6 s crossfade; later taps move at once; eye views
//      (M0/M1) = caption only. Desktop Enter = the current view's move hotspot. Spots disabled from 03:32:40 to handover (flow call.js).
```
There are **no forced views** in ep3 (§6.1.0-1 "강제 시점 회전 0"): `G.room.forceView` / `eyeM0` stay for ep2 only; every ep3 eye view is
opened by its scene owner through `G.room.eye()` and never rotates the player — M7/M8 move `where` (sound listener + next camera
open), not the picture.
**Room state keys** (`G.room.set(key, v)`; the layer table §6.3 · §8.3-7 maps them to patches/DOM — transitions follow §6.3 rule 3
"people leave, they do not vanish", 0.8 s with 6 % slide; the 04:40 dash 0.4 s):
| key | values · default | written by |
|---|---|---|
| `kongi` | `'sleep'|'door'|'none'|'feet'` · `'sleep'` | room door (`door` t 2.2 · `sleep` t 182) · flow ending (`none` END ⑤ · `feet` END ⑦) |
| `jimin` | `'sleep'|'gone'` · `'sleep'` | room door (t 15) |
| `srGap` | `0 | .25 | .35 | .45` · 0 | flow call (.25 at handover) · room door (.35 t 9 · .25 t 30) · room memory (.45 M7) |
| `srLamp` | `'off'|'dim'|'lit'` · `'off'` | flow call (`dim` at handover) · room memory (`lit` at M7) |
| `phoneGlow` | `'off'|'ceil'|'ring'|'call'|'ended'` · `'off'` | flow call |
| `kitchenLight` | bool · false | flow ending (END ①) |
| `stove` | `'off'|'flame'|'steam'` · `'off'` | flow ending (END ② · +40 s) |
| `collar` | `'hook'|'gone'` · `'hook'` | flow ending (END ④) |
Derived by room (no setter): `mom` (from `G.e3.momAt()` + motion), `grade` (clock + `kitchenLight` + `srLamp`), `winLights` (clock
≥ 05:40 → 1 · ≥ 05:55 → 2 · ≥ 06:10 → 3), wall-clock hands, calendar DOM, `led` (green unless `led('err3')` runs). Every layer is
live (changes in view, §6.3 rule 1); nothing changes only while unseen.

### 5.13 Set pieces — flow `call.js`, room `door.js` / `memory.js` / `climax.js`
```js
G.call   = { init(), resume(), step() → vars.seq.m1 }      // flow — §3.1: sched 'call:pre' at max(pm(M0)+90 000, pm(momLine1)+25 000) → t −20 preroll
                                                         //   (B03) → t 0 = M1 + callRing (clock 03:33) + G.audio.vibrate('ring3') once (§7.1.7 —
                                                         //   audio drops it when less) → … → handover (clock jump '03:35'), G.e3.momAt('sr'),
                                                         //   room set srGap .25 / srLamp 'dim' → eye.close(400) (the z 45 eye view would cover
                                                         //   the z 30 lock) → G.lock.show('n')
G.door   = { init(), resume(), t() → seconds since M6 | null }   // room — listens 'm6:due' → defer (S1 S2 S4 S7 S8 S9 clear 3 s, ≤ 40 s,
                                                         //   forced: G.cards.close({reason:'m6'}) + G.chips.close('m6') at t −0.4) → M6 → §3.12 table
                                                         //   steps as sched 'door:<t>' from pm(M6); t 176 → G.sms.deliver('k0502'); M7 at pm(kang502)+45 s
G.memory = { init(), resume(), active() → bool }         // room — M7 cards, callback D / hum.mom, closeup lines, memEarly +30 s, fallback +150 s,
                                                         //   memory chain → memoryDone → sched 'mem:M8' +20 s → M8
G.climax = { init(), resume(), state() → { armed, seatedMs, away, fails } }   // room — M8 cards → playArmed; judging = §9.6 code on 'rec:session' /
                                                         //   'rec:time'; success/fallback → G.e3.stage('e3_played', …) → G.hooks.call('end:start', { by:'played'|'fallback' })
// bus: 'm6:due' (core) · 'door:step' {t, id} · 'memory:start' · 'memory:done' · 'climax:m8cards' · 'climax:armed' · 'climax:result' {by, path:'A'|'B'}
```
Climax judging contract (room · `climax.js` — §9.6 code verbatim, events from comms):
```js
G.bus.on('rec:session', (e) => {
  if (e.id !== 'sea0333' || !G.flag('playArmed') || G.flag('played') || G.flag('playFallback')) return;
  if (e.out !== 'table') return;                        // 세아 방 재생 — 판정 0 · 카드 0
  if (e.away) return;                                   // sink 40 s session — 끝까지 판정 0 · 카드 0 (§12.2 V11)
  const head = e.a < 7.5, valid = e.a >= 7.5 && e.a <= 21.0;
  if (head && e.b >= 0.9 && !S.headFired[e.sess]) { S.headFired[e.sess] = 1; turnAway(); return; }   // vars.momAwayUntil = now + 40 000
  if (e.state === 'end' && valid) return success(e.a <= 12.6 ? 'A' : 'B');
  if (e.state === 'end' && e.a > 21.0) return tailLine();               // '…형사님이 들려준 거랑 같네요.' · playFails.tail++
});
// The head rule (`head && b >= 0.9` → turnAway) is evaluated on **'rec:time' too** (same guards: sea0333 · playArmed · ¬played ·
// ¬playFallback · out 'table' · ¬away) — rec:session fires only on state changes, so without it a head session would turn 엄마 away
// only at its end; S.headFired[sess] keeps it once per session.
// position cards 12.6 / 21.3 / 26.6 via 'rec:time' inside the same non-away session; fallback when seatedMs ≥ 240 000 and no valid
// session is playing; a grey-line session started after playArmed is marked noSig (callrec reads session().noSig set via G.callrec hook
// 'callrec:noSig' (sess) — implemented by comms, called by climax).
```

### 5.14 Flow — scenes, ending, hook, main
```js
G.scenes = { init(), title(), coldOpen({ resume }) → Promise, recap() → Promise, pause() }   // pause = hook 'pause:open'
G.ending = { init(), start({ by }) (= hook 'end:start'), resume(step) }   // END line drawn ⇒ G.flag('END') + G.e3.commit() in the same function
G.hook   = { init(), start(), resume(), replay() }                         // after the check card; `훅 다시 보기` = replay()
G.main   = { boot(), resumeFrom(state, { fromTitle }) }
```
Hook cut (§6.4-①): `G.fx.black(2000)` + `G.audio.hush(true, {roomDb:-90})` → `HOOK` + `hookOpened` → 1 s fridge + clock fade-in →
`G.room.eye({closeup:'c3_phone_ring', grade:'0610'})` 0.6 s → `G.callrec.renderBlockedMsgs(eye.screenNode(), {hook:true})` → at
+1.6 s `push(G.STORY.blocked.hook)` and **in the same frame** `G.audio.cue('boiler.fire', {n:3})` + `G.flag('boilerSting')` →
+3 s `[처음 화면으로]` (`hook.home`) → `G.e3.hookPatch()` → title. Back/home on the hook screen and `pagehide`/hidden while it is up →
`G.e3.hookPatch(true)`.

### 5.15 Notebook (flow · `engine/notebook.js`) — `G.notebook`, `G.OBJECTIVES`
Engine API unchanged (ARCH2 §4.17): `init open close isOpen refresh current show` + no-op `note lead leadDone flash autoHint`;
bus `notebook:open {tab}` · `notebook:close` · `hint {id, tier}`; hold 2 s; T2 = T1 + 60 s; T3 = T2 + 60 s; stats `플레이 {m}분 · (12.7에서 삭제 — 통계 줄 · `힌트는 1분 간격…` 바닥 글 · `(선택)`은 엔진 수첩에서 지워졌다)
힌트 {n}회`; empty hint tab `지금은 힌트가 필요 없어 보인다.`. Objective record (ARCH §6.21):
`{ id, title, optional, greyAfter, show() → bool, done() → bool, hints:[T1, T2, T3] }` — `greyAfter:'M8'` for `block` `dnd` `album`.
`G.OBJECTIVES.titleExceptions = ['call', 'phone', 'soup@gotPhone']` (the engine ignores it; flow `main.js` runs the DEBUG title
auto-check §10 A and treats `soup@gotPhone` as "exception only when shown via the gotPhone branch").

### 5.16 Director (flow · `engine/director.js`) — `G.director`, `G.BEATDATA3`
API unchanged: `init start stop safe(kind) zones() mark(id) fired(id) spend(id) T() hold(name, on) run(id)`. Data options read from
`BD()` when present (ARCH §4.2):
```js
G.BEATDATA3 = {
  beats:[…], micro:[…], tension:{ M0:.10, M1:.25, gotPhone:.20, M2:.28, M3:.38, M4:.48, M5:.60, M6:.80, M6peak:.92, M6patrol:.55,
                                   M6sms:.45, M7:.25, M8:.12, END:0, HOOK:.30 },          // §6.1.5 — data function targetT(s) below wins
  targetT: (s) => number | { T, ms },           // §6.1.5 table incl. 04:40:05 { T:.92, ms:4000 } · 04:55 .55 · 05:02 .45 · HOOK { T:.30, ms:3000 }
                                                //   (plain number = 20 s convergence; replaces the ep2 tension map and its M7 fast curve)
  zones: (base) => ({ S1: base.S1, S2: base.S2, S3: base.S3,
                      S4: !!(G.callrec && (G.callrec.state().playing || G.callrec.sinceStopMs() < 2000)),
                      S5: !!(G.callrec && G.callrec.textOpen()), S6: base.S6,
                      S7: !!(G.cards && G.cards.showing()), S8: !!(G.chips && G.chips.isOpen()),
                      S9: !!((G.phone && G.phone.inCall && G.phone.inCall()) || (G.phone && G.phone.modalOpen())),
                      S10: !!(G.flag('M7') && !G.flag('HOOK')) }),
  safeKinds: { show:['S1','S2','S3','S4','S5','S6','S7','S8','S9'], mono:['S1','S2','S3','S4','S6','S7','S8','S9'],
               world:['S1','S2'], m6:['S1','S2','S4','S7','S8','S9'], micro:['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10'] },
  ambience: { drone:false, gsm:false, endWind:false }, midnight:false,
  microActive: (s) => s.flag('gotPhone') && !s.flag('M6'), microGap: () => 110000 + Math.random() * 60000,
  microForbidden: [[335, 360], [0, 25]],
  vignette: (T) => (G.e3.less() ? 0 : G.flag('END') ? .10 : .20 + .30 * T),   // §6.1.5 — END .20 → .10, 덜 무섭게 0
  // micro record (§6.1.6 table): { id:'m.upstairs', weight:1, az:[[195,205]], where:'lv'|'sr'|'any', once:true,
  //   when:(s) => !s.flag('M5'), run:({ az }) => G.audio.cue('m.upstairs', { az, dist:4, el:70 }) }   — where = vars.where (sr rows
  //   use LS azimuths); no `run` ⇒ the engine default cue(id, {az, el}). safeKinds.micro skips the turn (next gap starts).
  loops: [   // repeating world loops — not beats (a beat fires once and survives reload as fired); not persisted, restart on resume
    { id:'W01', when:(s, z) => s.flag('M0') && !(s.vars.seq && s.vars.seq.m1), gapMs:() => 25000 + Math.random() * 25000,   // 03:20–03:32 (until the preroll)
      run:() => G.audio.cue('mom.idle', { src:'momSeat' }) },
    { id:'W03', when:(s, z) => G.e3.momAt() === 'sr' && !s.flag('M6') && !z.S4, gapMs:() => 70000 + Math.random() * 70000,   // 03:35–04:40, not in S4
      run:() => G.audio.cue('mom.srIdle', { src:'srMom' }) } ],
  //   engine: each 1 s director tick, for each loop with when(snapshot, zones) true: first due = now + gapMs(); when due → run, D.mark(id)
  //   on the first run only (documentation/QA), next = now + gapMs(). when false ⇒ the timer is dropped.
};
G.BEATDATA2 = G.BEATDATA3;                      // §9.1 alias — the director keeps reading BEATDATA2
```
(`G.callrec.sinceStopMs()` is part of the callrec API — ms since the last playback stopped, Infinity if never.) Record format = §6.1.2
(`cls` without `'jump'`; `where` may be `'lv'|'sr'` = `vars.where`; `defer` adds `'m6'` — documentation only: B12/B13 are
`owner:'door'`, room `door.js` runs that defer itself with `G.director.safe('m6')`, the engine never evaluates `'m6'`). `owner !== 'director'` records are
documentation; their runner calls `G.director.mark(id)` the moment the beat starts. Primed ids are ASCII.
**Beat runner map**
| ids | runner | trigger / action |
|---|---|---|
| B00 · B01 · B02 | flow scenes | title → warning → earphone test (`bell.small`) / cold open layering (§6.2 B01) / `momLine1` card + `chair.creak` |
| W01 · W03 | flow director (`BD().loops`, world) | `mom.idle` 25–50 s at 270° (03:20–03:32 — until the preroll) · `mom.srIdle` 70–140 s while momAt 'sr' 03:35–04:40 (not during S4) — repeating, so they are loops, not one-shot beats |
| W02 | — | 03:31 — nothing (QA asserts no new source 03:30:30–03:31:59) |
| B03 · B04 · B05 · B06 | flow call | preroll · 03:33 set piece · 03:34–03:35 · handover |
| B07 | shell lock | gotPhone (`ui.unlock`) |
| B08 | shell easymode | easyOff unfold (`ui.tap` + `ez.unfold`) |
| W04 | comms sms | 03:41 SMS (M2 + 40 s) — banner + `sms.mom` through notify |
| B09 · B11 | core e3 | mono1 · mono2 |
| B10 | core e3 | M3 · M4 · M5 — status-bar clock only |
| W05 · W11 | flow director | boiler 1 (clock 04:10, or +2 s after a jump over it) with S10 · boiler 2 (05:10 or memoryDone + 6 s while ¬M8) — `boiler.fire` + `G.room.pulse('boiler')` |
| B12 · B13 | room door | M5 + 60 s defer → 04:40 set piece |
| B14 · B15 | room memory | M7 cards · memory |
| B16 · B17 | room climax | M8 entry · playback session cards and body sounds |
| B18 · B19 · B20 | flow ending | END · tail · credits/check |
| W12 | flow director (05:40) · flow ending (second bus) | W12 = beat `when: END ∧ passed('05:40')` → `bus.far` + S22. The second bus (`bus.far {gainDb:-2}`, no sub) is **not clock-driven** — the END card row holds 05:40 until ending jumps to 05:55 — so `ending.js` plays it 2 s after the t0540 line `그거 하면서, 세아 소리 다 들어 볼 거예요.` and marks `'W12b'` (window lights are room-derived from the clock) |
| B21 | flow hook | 06:10 |
| m.* | flow director | micro list §6.1.6 (`m.creak m.fridgeTick m.kongiSigh m.jiminTurn m.carFar m.gust m.upstairs` + sr `m.srWindow m.creak`) |

### 5.17 Audio (audio) — `G.audio`, cue table, subtitles, tones
```js
// engine (kept): init unlock ok ctx bus setEnabled setVolume setYaw getYaw at(az,{dist,el,via,ir,wet,life,bus}) cue(id,opts) amb(id,on,{fade,db})
//   tension(T) sub(id,{az,text,ms}) subBusy() vibrate(key) voice(id) buffer(id) playVoice(id,{az,dist,via,onEnd}) mediaChain(kind) hush(on,{roomDb})
//   every(fn) restore() sfx.{tap,key,back,msgSend,error,unlock,whoosh,pen,pageTurn}() renderBuffer() makeIR()
// new registration (engine — ARCH §4.2): defineVia · defineIR · defineAmb · defineBuffer · defineMediaChain · TENSION_AMBS
// new (sound3.js — ep3 layer):
G.audio.listener() → 'L0'|'LS'|'LT'        // derived: HOOK ? 'L0' : (M8 ∧ ¬HOOK) ? 'LT' : where === 'sr' ? 'LS' : 'L0'; long-lived sources move in 0.8 s
G.audio.place(src) → { az, dist, el, via, ir, wet }   // §7.1.2 table — src ∈ 'keypad' 'hallIn' 'hook' 'kongiDoor' 'hallOut' 'firedoor' 'srDoor'
                                           //   'kongiSr' 'srMom' 'srLamp' 'srWindow' 'veranda' 'boiler' 'pipe' 'sofa' 'clock' 'fridge' 'momSeat'
                                           //   'momPhone' 'stove' 'sink' 'kitchenSwitch' 'kongiFeet' 'upstairs' 'road'
G.audio.cue(id, { src, az, dist, path:[{dt, src|az, dist}], n, less, gainDb })   // every §7.2 cue; src resolves through place()
G.audio.leak(start:boolean)                // 03:33 leak.earpiece — sea stem only, from r 0.6 at t 6.6 (call.js)
G.audio.recReady() → bool ; G.audio.nameKey() → string   // rec.sea0333 rendered for the current PLAYER_NAME (cache per name)
G.audio.renameReset()                      // DEBUG haru.name — drop the cached render
// buffers (A.buffer): 'rec.sea0333' (33.0 s, 32 kHz mono, stems near+sea+name mixed) · 'rec.sea0333.sea' (leak stem) ·
//   'rec.plain.<id>' (render on demand, 8 kHz, released after) · voices 'v3_mom_call' 'v3_mom_okay' 'v3_sea_name' (G.AUDIO_FILES)
// media chains: 'ear' (HP 250 · LP 7 k · +2 dB 2.6 k · pan +0.2 · dry → music) · 'table' (HP 350 · LP 7.5 k · +3 dB 1.2 k · tanh · 1.6 ms
//   table reflection · A.at(270,{dist:.7, el:-30, via:'inRoom', ir:'irLiving', wet:.18}) → music); 'ear' playback ducks amb/sfx/world −8 dB LP 2 k
// vibrate keys: 'ring3' [400,200,400] (less → none) · 'sms' [80] — no shake fallback (G.EP.noShake)
```
**Cue table** (`G.audio.cue(id, opts)` unless noted; callers also call `G.audio.sub(id)` where an S-id is listed)
| cue | opts | caller(s) | § | subtitle (caller) |
|---|---|---|---|---|
| `amb.apt` `amb.fridge` `amb.clock` `breath.jimin` `breath.kongi` `amb.air` `amb.wind90` (via `G.audio.amb`) | on/off, fade | flow scenes (B01 layering 2.0/4.0/6.0/8.0 s); room door (`breath.jimin` off t 15, `breath.kongi` off t 2.2 / on t 182); flow ending (`breath.kongi` off ⑤ / on ⑦); director (`amb.air` gain = tension) | §7.1.4 · §6.2 B01 | S15 S16 S17 (scenes, mood) |
| `amb.boilerPump` · `pipe.floor` | — | audio internal after `boiler.fire` | §7.1.4 | — |
| `stove.flame` · `soup.simmer` · `breath.mom` (loop) | on/off | flow ending (END ② · +40 s · credits −6 dB · check 0) · room climax (`breath.mom` on M8 card, off END ①) | §7.1.4 | — |
| `mom.idle` · `mom.srIdle` | — | flow director W01 · W03 | §6.2 | — |
| `m.creak` `m.fridgeTick` `m.kongiSigh` `m.jiminTurn` `m.carFar` `m.gust` `m.upstairs` `m.srWindow` | `{az, dist, el}` | flow director (micro) | §6.1.6 | — |
| `chair.creak` · `mom.slippers` (`path`) · `door.sr` · `switch.lamp` · `kongi.settle` · `cloth.rustle` | `{src|path}` | flow scenes (B02 `chair.creak`) · flow call (B06) · room door/memory/climax · flow ending | §6.2 | S18 (owner of the movement, when no card says it) |
| `ring.talk` · `buzz.table` · `kongi.sniff` · `mom.gasp` · `talk.end` · `phone.set` · `phone.slide` · `phone.flip` · `glass.set` | `{less}` | flow call (B03–B05) | §6.2 03:33 ledger | S01 (t 0) |
| `G.audio.vibrate('ring3')` (`[400,200,400]` · less → none) | — | flow call (t 0.0, **once**) | §7.1.7 · §9.7 | — (same information: `ring.talk` + E9) |
| `G.audio.vibrate('sms')` (`[80]`) | — | only through `G.tones.play(…, {vibrate})` / shell notify vibrate mode | §4.13 · §9.7 | — (banner) |
| `playVoice('v3_mom_call', {src:'momSeat', cuts})` | live 3 cuts t 7.0/9.0/11.0 | flow call | §7.3 | S02 S03 S04 |
| `G.audio.leak(true)` (leak.earpiece) | — | flow call (t 6.6) | §7.1.5 | S05 (t 14.6) |
| `breath.mom` one-shot (40.5) | `{once:true}` | flow call | §6.2 | — |
| `ui.unlock` | — | shell lock (B07) | §6.2 | — |
| `ez.unfold` · `ez.fold` | — | shell easymode (E8) | §7.2 D | — |
| `sms.mom` · `msg.inapp` | — | **only through `G.tones.play`** — shell `G.phone.notify` | §7.2 D · §4.13 | — |
| `call.ringback` · `talk.dial` · `call.connect` · `call.line` · `call.end` · `call.beep` (1 kHz 0.5 s ★) | — | shell `G.phone.callScreen` | §7.2 D · §3.2.3 | — |
| `boiler.fire` | `{n:1|2|3, src:'boiler'}` | flow director (W05 n 1, W11 n 2) · flow hook (B21 n 3) | §7.2 H · §6.4-① | S10 (n 1 only, director) · S11 (n 2, mood) · none at n 3 |
| `door.err3` · `kongi.claws` · `kongi.bark2` · `jimin.wake` · `jimin.murmur` · `firedoor.latch` · `hall.steps2` · `firedoor.clunk` · `buzz.jimin` · `kongi.sigh` | `{less}` (listener L0/LS automatic) | room door (B13 ledger) | §6.2 04:40 ledger | S06 S07 S08 S09 S19 S23 (door) |
| `bed.creak` · `hum.mom` (6.2 s render) | — | room memory (B14 · B15) | §6.2 B14 · §7.2 F | S14 (`hum.mom`) |
| `chair.self` · `chair.turn` · `mom.exhale` · `hand.mouth` | — | room climax (B16 · B17) | §6.2 climax ledger | — |
| `switch.light` · `stove.ignite` · `kongi.stand` · `kongi.bell` · `kongi.trot` · `kongi.tail` · `ladle` · `bowl.set` · `spoons` · `steps.jimin` | — | flow ending (B18 · B19); `kongi.tail` also room roomdata M0 hotspot (`kongiTail0`) | §6.2 END ledger | S20 (`kongi.bell` first) |
| `playVoice('v3_mom_okay', {src:'stove'})` | — | flow ending (END ③, same frame as the line) | §7.3 | — |
| `bus.far` | `{gainDb}` | flow director W12 (05:40 · 05:52 −2 dB) | §7.2 E | S22 (mood) |
| `piano.ab` | — | flow ending (credits) | §7.2 H | S21 (mood) |
| `bell.small` | `{az}` | flow scenes (earphone test) | §7.2 H | — |
| `cam.shutter` | — | room camera | §7.2 D | — |
| `G.audio.hush(true, {roomDb:-90})` / fade to 0 | — | flow hook (black) · flow ending (check card 2 s) | §7.1.1 | — |
| media `'ear'|'table'` chains · `rec.*` buffers | — | `G.media` (callrec plays) | §7.1.5 · §7.2 F | S12 S13 inside the callrec player (comms) |
**Subtitles** — `G.SUBS` (audio · `ep3/js/data/subs.js`) = §7.4 table verbatim, ids S01–S23, text = §4.14.3 to the character,
`{ text, kind:'info'|'mood'|'voice', ms, az }` (+ `S07less` for the less-scary variant, S17/S18/S23 as arrays of variants
`S17a S17b`, `S18chair S18slip S18door S18blanket`, `S23run S23walk`). Rules §7.4: info default on, mood only with `subs:'all'`, mono
first + 0.5 s, **no sub when a card says the same event**, intentionally empty: the 0:21 whisper, 0:30 radio, 03:33 leak whisper,
the `B13` 4 s silence, the hook sting (D28). `G.audio.sub` expands through `G.T`.
**Tones** — `G.tones` (audio · `ep3/js/data/tones.js`): `{ list:[{id:'sms', label:'기본', cue:'sms.mom'}], for({app, chat}) → app === 'sms'
? 'sms' : null, play(id|'inapp', { gainDb, vibrate }), vibKey(id) → 'sms', cap: 0 }` (`'inapp'` → `msg.inapp`; vibrate →
`G.audio.vibrate('sms')` when `G.settings.vibration !== false`; `vibKey` / `cap` are read by shell notify — ARCH §4.2 phone.js (h)).
His tone does not exist in ep3. Settings never shows tone pickers (§5.0-2 ⑦).

### 5.18 Hooks (`G.hooks`) — complete list
| hook | implementer | caller(s) | signature |
|---|---|---|---|
| `settings:screen` | shell (settings.js registry) | easymode (shell), comms (callrec back-links), flow (debug) | `(key, params) → bool` |
| `callrec:open` | comms (callrec.js) | comms phone/sms ⋮ · call detail · folder `voicerec`; shell settings search results `callrec:<id>` | `(screenId, params) → void` |
| `callrec:noSig` | comms | room climax (grey-line session after playArmed) | `(sess) → void` |
| `phone:emergency` | comms (engine/apps/phone.js) | shell lock `긴급 통화` | `() → void` |
| `chat:isOpen` | comms (sms.js — sms + talk threads) | shell `G.phone.notify` | `(threadId) → bool` |
| `pause:open` | flow (scenes.js) | shell status-bar ⏸, flow main (two-finger tap, Esc) | `() → void` |
| `end:start` | flow (ending.js) | room climax (played / fallback) | `({ by:'played'|'fallback' }) → void` |
| `room:refreshLayers` | room | anyone after bulk state edits (debug jump) | `() → void` |

### 5.19 Bus events (`G.bus`) — complete list
| event | payload | emitter | main listeners |
|---|---|---|---|
| `flag` `flag:<n>` · `var` `var:<k>` · `settings` · `visibility` · `tick` · `clock:min` · `clock:jump` · `state:load` | engine | core base | everyone |
| `m6:due` | `{dueAt}` | core e3 | room door |
| `mono:show` · `mono:hide` | `{id}` | core e3 | director (S3), audio (sub delay) |
| `card:show` · `card:hide` · `chips:open` · `chips:close` | ARCH §5.6 | core cards | director (S7/S8), shell show (dim), room door |
| `keyboard` | bool | core keyboard | director (S1) |
| `app:open` `screen:push` `screen:pop` `home` `home:show` `folder:open` | ARCH §5.7 | shell phone | shell show, core e3 (commit retry), notebook refresh |
| `quickpanel` · `notify` · `notify:shown` | — · n · `{id}` | shell | — |
| `lock:show` · `lock:unlock` | `{user, mode}` · `{user, how, first}` | shell lock | flow main, director |
| `call:start` · `call:end` | ARCH §5.7 | shell callScreen | director (S9), comms (recents) |
| `easy:change` · `easy:gate` | `{on, first}` · `{kind}` | shell easymode | shell phone (re-render home), comms (close hidden screens), core e3 (M2 via flag) |
| `show:press` · `show:react` | `{scr}` · `{scr, key, second}` | shell show | QA |
| `rec:list` `rec:player` `rec:session` `rec:time` `rec:text` `block:open` `block:bottom` | ARCH §5.10 | comms callrec | room climax, core e3 (mono1), director (S4/S5), shell show |
| `chat:open` · `chat:msg` | `{thread}` · `{thread, id}` | comms | notebook refresh |
| `gallery:album` `gallery:photo` `gallery:zoom` | ARCH §5.11 | media | core e3 (mono2), shell show |
| `media:play` `media:stop` `media:vol` `media:out` | engine | audio media (`media:out {target}` also on the ep3 route change) | comms callrec (session `out` field) |
| `room:open` `room:close` `room:view` `room:spot` `room:closeup` `room:where` `room:shot` | ARCH §5.12 | room | flow scenes (`momLine1`, mom taps), room door (`view0AfterM6`), audio (yaw/listener · `room:where` → `G.media` reroute ear ⇄ table), director (`where`) |
| `door:step` · `memory:start` · `memory:done` · `climax:m8cards` · `climax:armed` · `climax:result` | ARCH §5.13 | room | shell show (enabled), director, flow ending |
| `notebook:open` `notebook:close` `hint` | engine | flow | director (S2) |
| `dir:beat` · `end:step` | `{id}` · `{step}` | flow | QA |
| `pause` | `{open}` | flow main | audio (no new cue), callrec (pause playback) |

### 5.20 Timed-event registry (who schedules what — nothing is scheduled twice)
| event | owner (sched id / trigger) | when | effect |
|---|---|---|---|
| `momLine1` | flow `flow:momLine1` | pm(M0) + 40 000 (unless 270° seen first) | 엄마 first line |
| M1 preroll / first ring | flow `call:pre` · `call:t<n>` | max(pm(M0)+90 000, pm(momLine1)+25 000) = t −20 · t 0 = +20 000 | B03 · B04 |
| 03:41 SMS | comms `comms:k341` | pm(M2) + 40 000 | N01 · `kang341` |
| 강수진 replies | comms `comms:kr:<chip>` · `comms:kkeep` · `comms:kcall` · `comms:kfree` | +40 000 · keep +60 000 · call +60 000 · free +40 000 | N02 · N02p · N03 · N04–N06 · N08 · N09 |
| M3 · M4 · M5 | core (tick) | ARCH §5.3 | clock jumps |
| M6 due | core `e3:m6due` | pm(M5) + 60 000 | bus `m6:due` |
| M6 defer max | room `door:max` | dueAt + 40 000 | forced M6 |
| 04:40 steps | room `door:<t>` (t 0.9 · 2.2 · 4.4 · 9 · 11.5 · 14 · 15 · 16.5 · 18 · 30 · 46 · 100 · 140 · 152 · 176 · 182) | pm(M6) + t·1000 | §3.12 table (05:02 → `G.sms.deliver('k0502')`) |
| doorDone fallback | room `door:done` | pm(M6) + 60 000 | `doorDone` |
| M7 | room `door:M7` | pm(kang502) + 45 000 | M7 |
| memory early / fallback | room `mem:early` · `mem:fb` | pm(M7) + 30 000 (memEarly) · pm(M7) + 150 000 | memory chain |
| M8 | room `mem:M8` | pm(memoryDone) + 20 000 | M8 |
| play fallback | room climax (tick, `seatedMs`) | seatedMs ≥ 240 000 | `playFallback` |
| boiler 1 · 2 | flow director `dir:W05` · `dir:W11` | clock 04:10 (or jump + 2 000) · 05:10 or memoryDone + 6 000 (¬M8) | `boiler.fire` |
| bus · windows | flow director W12 (clock 05:40) · flow ending W12b (t0540 지민 line + 2 000) · room (window lights derived) | tail clock jumps by ending | `bus.far` |
| mom idle sounds | flow director `BD().loops` W01 · W03 (not sched — in-memory, restart on resume) | 25–50 s · 70–140 s | `mom.idle` · `mom.srIdle` |
| micro ambience | flow director (in-memory) | `microGap()` 110–170 s while `gotPhone ∧ ¬M6` | `m.*` |
| tail cards | flow `end:<step>` | §3.15 timing | END → hook |
| commit retry | core (bus `screen:push`, boot) | END ∧ ¬committed ∧ tries < 5 | `G.e3.commit()` |

### 5.21 Settings keys and the search table (shell · `engine/apps/settings.js` + `ep3/js/data/settings.js`)
Keys (data-scr = `settings.<key>`; every row that opens a key renders `data-qa="settings.row:<key>"`): `root` · `search` · `wifi` ·
`bt` · `sound` · `notif` · `dnd` · `dnd.log` · `display` (easymode) · `display.font` (easymode) · `display.easy` (easymode) ·
`wallpaper` · `lock` · `battery` · `access` · `general` · `general.kbd` · `about`. Phone/message app settings are callrec screens
(`callrec.settings*`, `callrec.block`) opened through `callrec:open`; the switch-only gates are easymode (`easy.gate.rec`,
`easy.gate.spam`).
Search row schema (one schema — ARCH §9 G4): `{ kw:[…], title, where, open?:'settings:<key>' | 'callrec:<screenId>',
easy?:'gate:rec'|'gate:spam'|'hide' }`. Matching = §9.5-2 (`G.e3.norm`, bidirectional `includes`, rank exact > prefix > partial >
data order). The `easy` field selects **in which mode the row exists** (the §3.3 / §4.7.1 table has different rows per mode, not the
same rows rerouted): `easy:'gate:rec'|'gate:spam'` = **easy-mode-only** row that opens that E6 gate (`G.easy.gate(kind)`; it has no
`open`) — dropped in standard mode; `easy:'hide'` = **standard-only** row — dropped while `G.easy.on()`; no `easy` = both modes.
Hence `녹음` gives `통화 자동 녹음 — 전화` (easy) vs `통화 녹음 — 전화 설정` · `녹음된 통화 — 전화 설정` (standard) and `차단` gives
`스팸 및 사기 의심 전화 차단 — 전화` (easy) vs `번호 차단 — 전화 설정` · `차단된 통화 — 전화 설정` · `번호 및 스팸 차단 — 메시지 설정`
(standard) — exactly §4.7.1, never "no result". Result row = `{title} — {where}` (data-qa `settings.result:<i>`, i = rank order).
Empty = `{$noResult}`.
First screen of search: `최근 검색어` row `통화 녹음  ×` (tap = that search · × = hide for this session only).

---

## ARCH §6 — `G.STORY.*` data schemas (one filled example each; DESIGN strings verbatim)
Rules for every data file: `G.STORY = G.STORY || {}` then assign your key(s) only; strings carry tokens (`{N…}` `{police}`
`{daejeon}` `{$key}`) and are expanded by the renderer with `G.T`; conditional lines are **lazy functions** (`(cb) => …` /
`() => …`) evaluated at render; dates are `'YYYY-MM-DD'` and times `'HH:MM'` (24 h) — the renderer formats them with
`G.e3.fmtDate` / `G.e3.fmt12` (§0.1 #18 year rule) unless the screen shows a fixed literal (then `label:`); image fields are asset
keys resolved by `G.e3.img`. The complete row lists are the DESIGN sections named in each heading — copy them, do not paraphrase.
His only line carries `his:true` (QA counts exactly 1).

### 6.1 `assets.js` (assets agent) — what consumers expect
`G.IMG = { key: 'assets/img/<file>' }` (§8.3-1 registry; reuse keys resolve through `G.e3.img` to `../assets/img/` and
`../ep2/assets/img/kongi_santa.jpg`), **`G.IMGMETA` = the inline copy of `ep3/assets/img/meta.json` nested per image** (§8.3-9:
`G.IMGMETA.r3_door.led_door`, `.srdoor_q`, `.hall_q`, `*_poly`; `r3_veranda.win_a_q/win_b_q/win_c_q/util_door`; `r3_sofa.clock_c`;
`r3_kitchen.cal_q/ceil_glow/stove_rect/pot_steam/phone_poly`; `c3_phone_ring.ring_q`; `c3_lockpanel.led_lock`; `c3_pot.burner_q/
steam_o`; `c3_drawing.paper_q/corner_q/notes`; `c3_doorframe.cu_cm`; `p3_kongi_1130.plate_q`; `ref_rects.*`) — never fetched,
file:// safe; `G.AUDIO_FILES = { v3_mom_call:'assets/audio/v3_mom_call.wav', v3_mom_okay:…, v3_sea_name:… }`; `G.AUDIO_META =
{ v3_mom_call:{ cuts_s:[[a,b],[c,d],[e,f]] } }` (the three live cuts, §7.2 F); `G.PRELOAD_GROUPS = { title, start, m0idle, gotPhone,
m2, m5, m7 }` (§9.8 order). Final image keys (consumers code against exactly these): views `r3_door r3_veranda r3_sofa r3_kitchen
r3_kitchen_lit r3_sr_desk r3_sr_desk_dim r3_sr_bed r3_sr_bed_dim` · patches `x3_mom_table x3_mom_table_lit x3_phone_down x3_mom_bed
x3_mom_bed_dim x3_jimin_sleep x3_kongi_sleep x3_kongi_door x3_kongi_feet x3_mom_hall x3_hook_empty x3_flame` · closeups
`c3_phone_ring c3_phone_ring_lit c3_mom_hands c3_lockpanel c3_shoes c3_shoes_nocollar c3_orgel_spot c3_manual c3_drawing
c3_drawing_back c3_doorframe c3_pot c3_pot_lit c3_window` · photos `p3_kongi_1130 p3_kongi_1213 p3_child_back p3_child_hands
p3_soup_2601 p3_church p3_cake_2411 p3_home_wall` · meta `t3_title og_ep3 icon_ep3 icon_ep3_192` · reuse `kongi_old dog_face
dog_park dog_bed avatar_sea avatar_mom avatar_jimin avatar_sagongsa kongi_santa`. Consumers must work when any key/meta is missing
(§9.8 table; room defaults its rects).

### 6.2 `data/cards.js` (flow) → `G.STORY.cards` — readers: flow (scenes, call)
```js
G.STORY.cards = {
  // (12.7에서 삭제/변경 — 현행 문자열은 `ep3/js/data/cards.js`: title.small · 데스크톱 안내 줄 삭제 · hookReplay '06:10 다시 보기' · recanon '이번 선택 남기기' · warn ['실종·스토킹·감금·납치 소재가 나옵니다.', '계속'] · ear.line '종소리를 들어 보세요.' · ear.okLine · speakerLine · foot 삭제 · pause 소리 행 ['소리','이어폰','스피커'] + 그 아래 '목소리는 AI 음성입니다.' 한 줄. 아래 원문은 이력)
  title: { name:'{N를} 위한 방탈출! 3', sub:'엄마의 번호', start:'시작', cont:'이어하기', small:'약 45분 · 이어폰 권장', series:'다른 이야기',
           hookReplay:'훅 다시 보기', recanon:'이번 선택을 이야기로 남기기', fresh:'처음부터',
           inapp:["카카오톡 안에서는 소리가 제대로 나오지 않을 수 있어요. 오른쪽 위 ⋯ → '다른 브라우저로 열기'를 눌러 주세요.", '그냥 할래요'] },
  warn: ['이 이야기에는 실종과 스토킹 · 감금 · 납치 소재, 그리고 가족을 기다리는 마음이 나옵니다.',
         "언제든 일시정지 메뉴에서 '덜 무섭게'를 켤 수 있어요.", '계속'],
  ear: { head:'🎧 이어폰 테스트', line:'작은 종소리가 한쪽에서 다른 쪽으로 지나가요.', ok:'들려요', speaker:'스피커예요', none:'안 들려요',
         okLine:'좋아요. 이 이야기의 소리에는 방향이 있어요.', speakerLine:'스피커로도 끝까지 할 수 있어요.', soundCard:'{$soundCard}',
         retry:'다시 듣기', silent:'소리 없이 할게요', start:'시작', foot:'이 게임은 어떤 데이터도 서버로 보내지 않습니다.' },
  pause: { head:'일시정지', resume:'계속하기', rows:[['공포 연출','보통','덜 무섭게'], ['글자 크기','작게','보통','크게'],
           ['소리','이어폰','스피커(방향 표시)'], ['소리 자막','정보만','모두'], ['진동','켬','끔'], ['화면 효과','흔들림 줄이기','깜빡임 줄이기']],
           title:'처음 화면으로' },
  m0: {
    momFirst: (cb) => cb('A') ? '깼어요? …그날 이후로 이 시간엔 전화 안 해요. 콩이랑 물 마셔요. 오늘은 생일이라… 먼저 눈이 떠졌어요.'
                             : '깼어요? 나는 이 시간에 늘 깨요. …세아한테 전화하는 시간이라서요.',
    momThen: ['오늘이 세아 생일이에요.', '미역국 끓여 놨어요. 아침에 같이 먹어요.'],      // +4 s · (calSeen0 or +15 s)
    momTaps: ['콩이 목줄은 밤엔 빼 둬요. 방울 소리에 깰까 봐요.', '나는 괜찮아요.'], momTapCaption:'엄마는 엎어 둔 폰 위에 손을 얹고 있다.' },
  call: {   // §3.1 table / §4.1.3 — t = first ring
    pre: (cb) => cb('A') ? '엄마가 물컵을 내려놓는다.' : '엄마가 엎어 둔 휴대전화를 뒤집는다.',
    ring: (cb) => cb('A') ? ['엎어 둔 휴대전화가 식탁 위에서 떤다.', '엄마가 휴대전화를 뒤집는다.'] : ['엄마의 손가락이 닿기 전에, 휴대전화가 먼저 운다.'],
    t2:'엄마의 손이 멈춘다.', t6:'엄마가 받는다.', t15:'엄마는 아무 말도 하지 않는다.', t19:'숨을 쉬지 않는 것 같다.',
    t40:{ who:'엄마', text:'세아야? …세아야.' }, t43:'엄마가 휴대전화를 내려놓는다. 오래.', t50:'엄마가 휴대전화를 {N} 쪽으로 민다.' },
  handover: [ { who:'엄마', text:'…그 오르골 노래였어요.' }, { who:'엄마', text:'나는 못 듣겠어요. {N} 씨가 들어 줘요.' },
              { who:'엄마', text:'녹음은 된대요. 형사님이 해 놨어요.', id:'recCard' }, { who:'엄마', text:'세아가 큰 글씨로 해 놔서, 나는 이것밖에 몰라요.', id:'easyCard' },
              { who:'엄마', text:'내가 무슨 소리를 냈는지도… 그것도 못 듣겠어요.' }, { who:'엄마', text:'세아 방에 있을게요.' },
              { who:null, text:'엄마가 세아 방으로 들어간다. 문을 반쯤 열어 둔다.' }, { who:null, text:'콩이가 고개를 들었다가 다시 눕는다.' } ],
};
```
(The recap lines are `G.e3.MONO.recap` (core); `easyCard` / `recCard` step ids let the notebook `show()` read
`vars.fl.cardsDrawn` — flow writes it when the step is drawn.)

### 6.3 `data/ending.js` (flow) → `G.STORY.ending` — readers: flow (ending, hook)
```js
G.STORY.ending = {
  end: [ { who:null, text:'엄마가 일어나 부엌 불을 켠다.' }, { who:null, text:'가스레인지 위 미역국 냄비에 불이 붙는다.' },
         { who:'엄마', text:'괜찮대요. 우리 딸이 괜찮대요.', id:'END' },                                   // drawn ⇒ END + commit ①
         { who:null, text:'엄마가 신발장 고리에서 목줄을 가져온다.' }, { who:null, text:'세아 방 문 앞의 콩이가 일어난다.' },
         { who:null, text:'엄마가 콩이에게 목줄을 채운다. 콩이가 엄마를 따라 부엌으로 간다.' } ],
  tail: { // §3.15 / §4.12.2 — order fixed; lazy lines read cb and flags
    t0535: [ { who:null, text:'지민이 부엌 입구에서 식탁으로 와 앉는다.' },
             { who:'지민', text:(cb) => G.flag('jiminChipSent') ? null : ({ yes:'그날 오르골 얘기 답해 줬을 때부터요, {N} 씨 말은 그냥 믿어져요.',
               no:'그날 끝내 대답은 안 했잖아요. 그래도 오늘 보니까 알겠어요. {N} 씨 맞아요.', none:'{N} 씨랑 같이 오니까 덜 무서워요.' })[cb('B')] },
             { who:null, text:'엄마가 미역국을 네 그릇 뜬다. 한 그릇은 빈 자리 앞에 놓는다.', id:'soupServed' },
             { who:'엄마', text:'세아 생일엔 늘 이렇게 놨어요. 작년에도요.' }, { who:'엄마', text:'세아가 좋아하던 거예요. 소고기 많이 넣었어요.' },
             { id:'eat', chips:[{ id:'eat', label:'잘 먹겠습니다.', edit:true, verb:'say' }] },
             { who:'엄마', text:'많이 먹어요. 세아 몫까지.' },
             { who:'엄마', text:(cb) => cb('C') ? '그 폰 아직 갖고 있어요? …나도 세아 번호 못 없앴어요.' : null } ],
    t0540: [ { who:'지민', text:'다음 달에 교수님이 세아 작품 정리하는 거 맡기셨어요.' }, { who:'엄마', text:'…세아가 좋아하겠다.' },
             { who:'지민', text:'그거 하면서, 세아 소리 다 들어 볼 거예요.' } ],
    kang: { sent:[ { who:null, text:'엄마가 {N의} 손에 있는 자기 폰을 본다. 형사님의 문자가 떠 있다.' }, { who:'엄마', text:'…합성일 수도 있대요. 확인 중이래요.' } ],
            other:[ { who:null, text:'지민이 휴대전화를 본다. 아까 형사님께 보낸 문자의 답이다.' }, { who:'지민', text:'형사님이 합성일 수도 있대요. 그래도 확인해 보신대요.' } ],
            played:{ who:'엄마', text:'…괜찮아요. 나는 들었어요.' }, fallback:{ who:'엄마', text:'…괜찮아요. {N} 씨가 들었잖아요.' } },
    dndFacts: { no331:[ '그날 밤엔 전화 안 울리게 해 놓고 잤어요. 아침 일찍 나가니까요.' ],
                lines:[ '같은 번호로 3분 안에 또 오면 울리는 거였대요. …나중에 알았어요.', '세아는 한 번 걸었어요.', '그날 이후로 한 번도 안 켰어요.' ],
                said:'…그 애는 그걸 미리 써 놨네요.' },              // chip = G.show.dndChip({ ctx:'tail', timeoutMs:10000 }) when ¬dndChipSaid
    albumFacts: { noBom:'현관에서 기다리는 콩이 사진도… 그 사람이 다 봤대요.',
                  noAlbum:'형사님이 앨범에 그 사람 그대로 두래서, 그대로 뒀어요. 콩이 사진은… 이제 안 올려요.' },
    t0555: [ { who:'엄마', text:'{N} 씨, 폰.' }, { who:null, text:'엄마가 손을 내민다.' },
             { id:'easyBack', chips:[{ id:'big', label:'큰 글씨로 다시 해 두기', verb:'pick' }, { id:'keep', label:'그대로 드리기', verb:'pick' }] } ],
    big: [ { who:null, text:'{N가} 설정을 열어 쉬운 모드를 켠다. 홈 화면이 다시 큰 아이콘 여섯 개가 된다.' }, { who:'엄마', text:'…세아가 해 준 거랑 똑같네요.' } ],
    keep: [ { who:'엄마', text:'이게 원래 모양이에요? …천천히 배울게요. 세아 오면 물어보고요.' } ],
    t0600: { who:null, text:'일요일 아침 여섯 시. 창밖은 아직 어둡다. 건너편 동에 불이 둘 켜져 있다.' }, next:'계속' },
  // (12.7에서 삭제/변경 — 현행 `ep3/js/data/ending.js`: credits = ['{N를} 위한 방탈출! 3 · 엄마의 번호'] 한 줄 · check = ['스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366'] 한 줄 + checkNext '계속'. 아래 credits[1..5] · check[0..2]는 이력)
  credits: ['{N를} 위한 방탈출! 3 · 엄마의 번호', '만든 사람 {MAKER} · {N}에게', '목소리: AI 음성 · 사진: AI 생성 + 직접 편집 · 소리: 전부 직접 합성',
            '통화 녹음·텍스트 변환의 동작은 게임 속 단순화입니다.', '이 게임은 아무 데이터도 보내지 않았어요.', '플레이 {m}분 · 힌트 {n}회'],
  check: ["가족 폰에 스팸 차단을 켜 드렸다면, 가끔 '차단된 통화·메시지' 기록을 같이 열어 보세요.", '가족·공유 앨범의 멤버 목록에 모르는 계정이 없는지 확인하세요.',
          '공유하는 사진에 집 호수가 보이면, 그 앨범을 누가 보는지 먼저 확인하세요.', '스토킹·디지털 성범죄 피해: 112 · 여성긴급전화 1366'],
  hook: { home:'처음 화면으로' },
};
```
(null lines are skipped by `G.cards.play`. `{N가}` is a token — never `{N}가`.)

### 6.4 `data/setpiece.js` (room) → `G.STORY.setpiece` — readers: room (door, memory, climax)
```js
G.STORY.setpiece = {
  door: { // §3.12 table — t in seconds from M6
    t11:{ who:null, text:'엄마가 세아 방에서 나와 현관 앞에 선다. 문에 손대지 않는다.' }, t14:[ { who:'엄마', text:'…콩이야.' }, { who:null, text:'콩이는 문을 보고 서 있다.' } ],
    t16:{ who:'지민', text:'…방금 뭐예요?' },
    chip:{ id:'jimin0440', chips:[{ id:'say', label:'밖에서 누가 도어락을 눌렀어요. 저도 들었어요.', edit:true, verb:'say' }], timeoutMs:20000, timeoutPick:'keep' },
    chipReply:(cb) => ({ yes:'그날 오르골 얘기 답해 줬을 때부터요, {N} 씨 말은 그냥 믿어져요.', no:'그날 끝내 대답은 안 했잖아요. 그래도 오늘 보니까 알겠어요. {N} 씨 맞아요.',
                         none:'{N} 씨랑 같이 오니까 덜 무서워요.' })[cb('B')], keepReply:'……',
    t30:{ who:null, text:'엄마가 식탁으로 물러난다. 손이 떨린다.' },
    t46:(f) => [ { who:null, text:'지민이 자기 휴대전화로 112에 전화한다.' },
                 { who:'지민', text: f('call112First') ? '…네. 같이 있는 사람이 방금 신고했어요. 현관 비밀번호를 누가 눌렀어요. 틀렸고요.'
                                                      : '…네. 현관 비밀번호를 누가 눌렀어요. 틀렸고요. 지금은 아무 소리도 안 나요.' },
                 { who:null, text:'지민이 주소를 불러 준다.' } ],
    t100:[ { who:'지민', text:'지구대에서 온대요. 문 열지 말래요.' }, { who:null, text:'지민이 휴대전화 진동을 켜 손에 쥔다.' } ],
    t152:[ { who:null, text:'지민이 전화를 받는다.' }, { who:'지민', text:'…네. 네. …아무도 없어요? 계단도요? …네. 감사합니다.' },
           { who:'지민', text:'복도랑 계단, 아무도 없대요.' }, { who:'지민', text:'공동현관 CCTV는 아침에 관리사무소에서 같이 본대요.' },
           { who:null, text:'지민이 엄마 어깨에 담요를 덮어 준다.' }, { who:null, text:'지민이 부엌 입구 벽에 기대어 선다.' } ],
    view0:{ kongi:'콩이가 현관문 앞에 서서 문을 보고 있다. 꼬리가 내려가 있다.', panel:'도어락 안쪽 패널. 초록 불빛.' } },
  memory: { // §3.13
    m7:[ { who:null, text:'엄마가 일어나 세아 방으로 간다.' }, { who:null, text:'{N}도 따라간다.' }, { who:null, text:'엄마가 세아 방 스탠드를 켠다.' } ],
    cbD:{ who:'엄마', text:'그 노래 끝까지 들었어요? 다섯째 음…' },
    hum:[ { who:null, text:'엄마가 오르골 노래를 흥얼거린다.' }, { who:null, text:'다섯 번째 음에서 엄마의 목소리가 올라가다 멈춘다.' } ],
    spots:{ orgel:'오르골 자리예요. 서울 갈 때 들고 갔어요. …지금은 경찰서에 있대요. 돌려준대요.', manual:'세아가 그거 보고 계이름 외웠어요. 미, 라, 도, 시, 라, 미.',
            frame:'생일마다 쟀어요. 열두 살부터는 자기가 썼어요. 엄마 글씨 못생겼다고.' },
    early:{ who:null, text:'엄마가 책상 위 그림을 본다.' }, pick:{ who:null, text:'엄마가 책상 위 그림을 집는다.' },
    fallback:{ who:null, text:'엄마가 책상에서 종이 한 장을 집는다.' },
    chain:[ '세아는 오르골 따라 부를 때 다섯 번째 음을 꼭 틀렸어요.', '엄마 웃기려고.', '…', "'엄마 나 괜찮아'라는 뜻이었어요.",
            '넘어져서 무릎이 까져도, 주사 맞고 나와서도. 꼭 그 음을 틀렸어요.', '크리스마스 지나고 형사님이 들려준 거요… 다섯째 음에서 그만 틀어 달라고 했어요.',
            '옛날 녹음일 수도 있대서요.', '옛날 거면… 그때 괜찮았다는 거잖아요. 지금 말고.', '오늘 그 전화도요. …내 목소리만 생각나요. 세아야, 세아야, 하고만 있었어요.',
            { who:null, text:'엄마가 그림을 책상에 내려놓는다.' }, '…부엌에 가 있을게요.' ],          // plain strings = who '엄마'
    momIdle:'엄마는 침대 끝에 앉아 두 손을 무릎에 올려 두고 있다.', after:'세아 방은 그대로 뒀어요.' },
  climax: { // §3.14
    m8:[ { who:null, text:'엄마가 식탁에 앉는다. 두 손을 모은다.' },
         { who:null, text:'{N}도 맞은편에 앉는다. 콩이는 세아 방 문 앞에 엎드려 있다. 지민은 부엌 입구에 서 있다.' },
         { who:'엄마', text:'{N} 씨.' }, { wait:3000 }, { who:'엄마', text:'…세아 소리, 들었어요?' },
         { id:'yes', chips:[{ id:'yes', label:'네.', edit:true, verb:'say' }], timeoutMs:15000, keepOnTimeout:true },
         { who:'엄마', text:'……' }, { who:null, text:'엄마가 두 손을 식탁 위에 올려 둔다.', id:'armed' } ],
    at:{ fifth:'다섯 번째 음에서 엄마의 숨이 멎는다.', name:'…{N} 씨 이름이에요.', mouth:'엄마가 입을 막는다.' },
    after:[ '{N} 씨 이름을 안다는 건… 옛날 녹음이 아니라는 거죠.', '…그때도 뭐라고 한 것 같았어요. 나는 못 알아들었어요.', { who:null, text:'부엌 입구의 지민이 고개를 숙인다.' } ],
    head:[ { who:null, text:'엄마가 고개를 돌린다.' }, { who:'엄마', text:'…잠깐만요.' }, { who:null, text:'엄마가 일어나 싱크대 쪽으로 가 선다.' } ],
    back:{ who:null, text:'엄마가 다시 앉는다.' }, wait:{ who:null, text:'엄마는 기다린다.' },
    tail:[ { who:null, text:'엄마는 말없이 화면만 본다.' }, { who:'엄마', text:'…형사님이 들려준 거랑 같네요.' } ],
    fallback:[ { who:'엄마', text:'…나중에 들을게요. 세아 오면, 그때 같이.' },
               { id:'fifth', chips:[{ id:'fifth', label:'다섯째 음, 올라가 있었어요.', edit:true, verb:'say' }], timeoutMs:10000, timeoutPick:'fifth' },
               { who:'엄마', text:'{N} 씨가 들었으면 됐어요.' } ],
    success:{ id:'win', chips:[{ id:'know', label:'세아 씨는 제가 404호에 오기 전엔 제 이름을 알 수 없었어요.', edit:true, verb:'say' },
                               { id:'yes', label:'…네.', verb:'pick' }], timeoutMs:8000, timeoutPick:'yes', then:{ who:'엄마', text:'……' } } },
};
```

### 6.5 `room/roomdata.js` (room) → `G.ROOM` — readers: room
```js
G.ROOM = {
  v: 3,
  img: (k) => G.e3.img(k), meta: (img, k, def) => (G.IMGMETA && G.IMGMETA[img] && G.IMGMETA[img][k]) || def,
  rooms: {
    lv: { listener:'L0', views:[
      { id:'r3_door', yaw:0, cam:6, key:'r3_door', layers:[ /* led3, srspill (srGap), kongi (sleep|door), x3_mom_hall (momAt hall), hook (collar) … §6.3 */ ],
        spots:[ { id:'door', caption:'현관. 도어락 안쪽 패널에 작은 초록 불빛.', closeup:'c3_lockpanel', closeupWhen:() => G.flag('M6') },
                { id:'shoes', caption:'신발장 위에 분홍 실내화 한 켤레.' },
                { id:'hook', caption:'신발장 옆 고리에 분홍 목줄. 작은 방울이 달려 있다.', flag:'collarSeen', closeup:'c3_shoes' },
                { id:'mat', caption:'현관 매트 옆, 비어 있는 작은 방석.' },
                { id:'srdoor', go:'sr', rect:{ x:.82, y:0, w:.18, h:.66 }, caption:'세아 방 문이 반쯤 열려 있다. 문 앞에 콩이가 웅크리고 잔다.' },
                { id:'kongi', caption:() => G.flag('M6') && !G.flag('kongiBack') ? '콩이가 현관문 앞에 서서 문을 보고 있다. 꼬리가 내려가 있다.'
                                                                                   : '콩이가 고개를 든다. 꼬리가 바닥을 두 번 친다.',
                  flag:() => G.flag('M6') ? null : 'kongiTail0', cue:'kongi.tail' } ] },
      { id:'r3_veranda', yaw:90, key:'r3_veranda', spots:[ { id:'veranda', caption:'베란다 너머, 건너편 동의 창이 다 꺼져 있다.' } ] },
      { id:'r3_sofa', yaw:180, key:'r3_sofa', spots:[ { id:'jimin', caption:['소파에서 지민이 잔다. 담요가 반쯤 흘러내렸다.', '지민은 깊이 잠들어 있다.'] },
                { id:'frames', caption:'TV장 위 액자 셋. 콩이, 콩이, 교복 입은 뒷모습.' }, { id:'clock', caption:'3시 {mm}분.' },
                { id:'outlet', caption:'내 폰은 콘센트에서 충전 중이다.' } ] },
      { id:'r3_kitchen', yaw:270, key:'r3_kitchen', spots:[ { id:'mom' /* flow scenes reacts to room:spot 'mom' */ },
                { id:'table', caption:'식탁의 엄마. 엎어 둔 휴대전화 옆에 물 한 컵.' },
                { id:'stove', caption:'가스레인지 위에 냄비 하나. 미역국이다.', flag:'soupSeen0' },
                { id:'calendar', caption:'벽 달력. 1월 24일에 빨간 동그라미.', flag:'calSeen0' } ] } ] },
    sr: { listener:'LS', views:[
      { id:'r3_sr_desk', yaw:0, key:() => G.room.get('srLamp') === 'lit' ? 'r3_sr_desk' : 'r3_sr_desk_dim',
        spots:[ { id:'orgel', caption:'책장 가운데, 작은 레이스 받침이 비어 있다.', closeup:'c3_orgel_spot', flag:'orgelSpotSeen' },
                { id:'manual', caption:'오르골 설명서. 뒷면에 곡의 첫 두 마디가 인쇄돼 있다.', closeup:'c3_manual', flag:'manualSeen' },
                { id:'drawing', caption:'어버이날 그림. 다섯 번째 음표만 높이 그려져 있다.', closeup:'c3_drawing', flag:'drawingSeen',
                  flip:{ caption:'뒷면에 엄마 글씨.', closeup:'c3_drawing_back', flag:'drawingBack',
                         dom:['세아가 어버이날에 그려 준 거', '다섯째 음을 일부러 틀림 — "엄마 나 괜찮아"래'] } } ] },
      { id:'r3_sr_bed', yaw:180, key:() => G.room.get('srLamp') === 'lit' ? 'r3_sr_bed' : 'r3_sr_bed_dim',
        spots:[ { id:'frame', caption:'문틀에 연필 줄이 촘촘하다.', closeup:'c3_doorframe', flag:'heightSeen' },
                { id:'bed', caption:'작은 침대. 이불이 반듯하게 개어져 있다.' }, { id:'window', caption:'창밖은 아직 어둡다.' },
                { id:'srout', go:'lv', caption:'세아 방 문. 거실이 보인다.' }, { id:'mom', caption:'엄마는 침대 끝에 앉아 두 손을 무릎에 올려 두고 있다.' } ] } ] } },
  closeups: { c3_drawing:{ dom:{ title:'내 노래', mark:'틀린 음!', corner:'윤세아 1학년 3반 · 2008. 5. 8' } },
              c3_doorframe:{ marks:[['7 · 09.1.24','mom'], ['8 · 10.1.24','mom'], ['9 · 11.1.24','mom'], ['10 · 12.1.24','mom'], ['11 · 13.1.24','mom'],
                                    ['ㅅㅇ 12 · 14.1.24','sea'], ['ㅅㅇ 13 · 15.1.24','sea'], ['ㅅㅇ 14 · 16.1.24','sea'], ['ㅅㅇ 15 · 17.1.24','sea'],
                                    ['ㅅㅇ 16 · 18.1.24','sea'], ['ㅅㅇ 17 · 19.1.24','sea'], ['ㅅㅇ 18 · 20.1.24','sea']] },
              c3_manual:{ print:'태엽은 끝까지 감지 마세요.', notes:['E5','A5','C6','B5','A5','E5'] } },   // DOM fallbacks are mandatory (§9.8 — the text is a clue)
};
```
(§4.9.1 time variants of the lv captions are lazy `caption` functions; the full layer table = §6.3 · §8.3-7.)

### 6.6 `data/settings.js` (shell) → `G.STORY.settings` — readers: shell
```js
const REC = ['녹음','통화녹음','자동녹음','녹취','레코드','record'],            // §4.7.1 row 1 (the 최근 검색어 '통화 녹음' tap hits it too)
      BLK = ['차단','스팸','광고','수신거부','거부','막기','block','spam'];          // §4.7.1 row 2
G.STORY.settings = {
  v: 3,
  root: [ ['wifi','Wi-Fi','집'], ['bt','블루투스','꺼짐'], ['sound','소리 및 진동',''], ['notif','알림','앱 알림 · 방해 금지'],
          ['display','디스플레이','밝기 · 글자 크기 · 쉬운 모드'], ['wallpaper','배경화면',''], ['lock','잠금 화면','밀어서 열기'],
          ['battery','배터리', () => `${G.battery()}%`], ['access','접근성',''], ['general','일반','언어 · 날짜 및 시간'], ['about','휴대전화 정보','']],
  recent: ['통화 녹음'],                                     // `최근 검색어` (× hides it for this session only)
  search: [ // the two keyword lists of §4.7.1 — every row of a group carries the whole list (each query word must reach every row of its mode)
            { kw:REC, title:'통화 자동 녹음', where:'전화', easy:'gate:rec' },                                 // easy only → E6 gate
            { kw:REC, title:'통화 녹음', where:'전화 설정', easy:'hide', open:'callrec:rec.settings' },        // standard only
            { kw:REC, title:'녹음된 통화', where:'전화 설정', easy:'hide', open:'callrec:rec.list' },
            { kw:BLK, title:'스팸 및 사기 의심 전화 차단', where:'전화', easy:'gate:spam' },                   // easy only → E6 gate
            { kw:BLK, title:'번호 차단', where:'전화 설정', easy:'hide', open:'callrec:block' },
            { kw:BLK, title:'차단된 통화', where:'전화 설정', easy:'hide', open:'callrec:block.calls' },
            { kw:BLK, title:'번호 및 스팸 차단', where:'메시지 설정', easy:'hide', open:'callrec:block' },
            { kw:['방해','방해금지','무음','조용','밤','수면','알림끄기','반복','dnd'], title:'방해 금지', where:'알림', open:'settings:dnd' },
            { kw:['쉬운','쉬움','쉽게','쉬운모드','간편','간편모드','간단','단순','큰글씨','큰글자','글씨','글자','큰','크게','표준','표준모드','모드',
                  '홈화면','홈','안경','노인','어르신','easy','simple'], title:'쉬운 모드', where:'디스플레이', open:'settings:display.easy' },
            { kw:['글씨','글자','큰','크게'], title:'글자 크기와 스타일', where:'디스플레이', open:'settings:display.font' } /* + ordinary rows §4.7.1 */ ],
  // (§3.3 / §4.7.1 table: easy '녹음' → one row `통화 자동 녹음 — 전화`; standard '녹음' → `통화 녹음 — 전화 설정` · `녹음된 통화 — 전화 설정`)
  dnd: { now:['지금 사용', false], schedule:['매일 오후 11:00 – 오전 7:00', '사용 안 함'], exceptions:[['전화 · 반복 전화 허용','켜짐','{$repeatCall}'], ['알림 · 없음','']],
         last:'마지막 사용 · 2025.11.24 오전 7:00', logRow:'사용 기록' },
  dndLog: { from:'2024-11-24', to:'2025-11-23', kind:'일정' },   // generated daily rows: `2025.11.23 (일) 오후 11:00 – 11.24 (월) 오전 7:00   일정`
  about: [['이름','엄마 폰'], ['전화번호','010-0718-2215'], ['SIM','있음']],
  kbd: [['예측 텍스트','꺼짐']],
  /* sound · wifi · bt · battery (`72%` only) · access · wallpaper · lock · general rows = §4.7.4 (view-only, progress 0) */
};
```

### 6.7 `data/easy.js` (shell) → `G.STORY.easy` — readers: shell
§9.6 ① verbatim + the lock/ring strings:
```js
G.STORY.easy = {
  home: [ ['phone','전화'], ['talk','톡'], ['camera','카메라'], ['gallery','사진'], ['moim','모임'], ['settings','설정'] ],
  recentDays: 30,
  contacts: ['sea','jimin','kang','kwon','butcher','ricecake','churchOffice','kitchenChief','vet','office'],   // ids of G.STORY.dial.contacts
  gates: { rec:  { title:'통화 자동 녹음', sw:'켜짐', desc:'{$recAuto}', rows:[['녹음할 통화','모든 통화']] },
           spam: { title:'스팸 및 사기 의심 전화 차단', sw:'사용 중', desc:'{$spamShort}' } },
  display: { title:'쉬운 모드', sw:'사용 중', desc:'{$easyDesc}', longPress:['길게 누르기 지연 시간', '길게 (1.5초)'],
             rows:['라이트 / 다크', '밝기', '글자 크기와 스타일 ›', '화면 확대', '쉬운 모드 · 사용 중 ›', '화면 자동 꺼짐 · 1분'], fontLink:'쉬운 모드 ›' },
  lock: { date:'1월 24일 일요일', swipe:'{$swipeOpen}', emergency:'{$emergency}' },
  ring: { name:'세아 💛', kind:'보이스톡', avatar:'avatar_sea', decline:'거절', accept:'받기', ended:'통화 종료 · 0:33', callBtns:['스피커','음소거','종료'] },
  sheet: ['전화 걸기', '문자 보내기'],
};
```

### 6.8 `data/show.js` (shell) → `G.STORY.show` — readers: shell (show.js)
```js
G.STORY.show = {
  where: { sr:'엄마는 세아 방에 있다.', lv:'엄마는 식탁에 있다.', hall:'엄마는 현관 앞에 서 있다.' },
  glasses:'엄마가 안경을 찾아 쓴다.', again:'엄마가 고개를 끄덕인다.',
  neutral:[ { who:null, text:'엄마가 화면을 본다. …' }, { who:'엄마', text:'이건 잘 모르겠어요.' }, { who:null, text:'엄마가 화면을 한참 보다가 고개를 젓는다.' } ],
  react: {
    'callrec.blocked': { flag:'momBlock', also:['callrec.blocked.number'], lines:[ { who:null, text:'엄마가 화면을 손가락으로 천천히 내린다.' },
        '…다 24일이네요.', '…', '24일은 원래 우리 세아 생일이에요.', '…그 사람이 그걸 가져갔네요.', '한 번도 안 울렸어요. 한 번도.',
        '세아가 이상한 전화 다 막아 놨다고 했었는데.', () => G.flag('mom331') ? '…이것도 3시 31분이네요.' : null ] },
    'phone.recent': { flag:'mom331', needRow:'sea-20251124-0331', also:['phone.contact.sea.log'], lines:[ '3시 31분. 세아가 나한테 전화한 시간이에요.',
        '나는 자고 있었어요.', '밤엔 전화 안 울리게 해 놓고 잤어요. 아침 일찍 나가니까요.', () => G.flag('momBlock') ? '…그 사람도 3시 31분이었네요.' : null ] },
    'settings.dnd': { flag:'momDnd', stage:['e3_dnd', true], also:['settings.dnd.log'], lines:[ { who:null, text:'엄마가 화면을 오래 본다.' },
        '그날 이후로 한 번도 안 켰어요.', '…', '밤에 세아 전화 올까 봐요.', '3분 안에 또 오면 울리는 거였대요. …나중에 알았어요.', '세아는 한 번 걸었어요.',
        { dndChip:true },                                                     // → G.show.dndChip({ctx:'show', timeoutMs:20000})
        { ifSaid:['…그 애는 그걸 미리 써 놨네요.', '고마워요, {N} 씨.'], ifSilent:[{ who:null, text:'엄마가 화면을 덮는다. 한참 뒤 고개를 끄덕인다.' }] } ] },
    'gallery.shared.members': { flag:'momMembers', lines:[ '처음엔 세아 학교 사람인 줄 알았어요.', '크리스마스 지나고 형사님이 말해 줬어요. 그 사람이라고.',
        '지우면 그 사람이 안대요. 그래서 그대로 뒀어요.', '그 뒤로는 안 올렸어요.' ] },
    'gallery.photo.door': { flag:'momBom', lines:[ '…세아 보라고 올린 거예요. 콩이가 현관에서 기다린다고.',
        (ctx) => ctx.photo === '1130' ? '…이건 택배 받느라 문 열어 놨을 때예요.' : null, { who:null, text:'엄마가 눈을 감는다.' } ] },
    'gallery.shared.activity': { lines:[ { who:null, text:'엄마가 화면을 본다.' }, '…형사님이 지운 거래요. 그 사람이 올린 거요.' ] },
    'talk.sea': { lines:[ '1년 동안 그 시간에 걸었어요.', '…', '오늘은 세아가 걸었네요.' ] },
    'talk.self': { lines:[ '세아가 하나하나 불러 줬어요. 나는 받아 적기만 했어요.' ] },
    'callrec.list': { beforeM8:true, also:['callrec.player','callrec.player.info','callrec.text'], lines:[ { who:null, text:'엄마가 화면에서 눈을 돌린다.' }, '…그건 못 보겠어요.' ] },
    'gallery.photo.soup2601': { lines:[ '작년에도 끓였어요. 세아 거랑 두 그릇.' ] },
    'gallery.photo.cake2411': { lines:[ '그때 세아가 케이크 들고 저 현관에 서 있었어요.' ] },
    'calendar.event.1126': { lines:[ '케이크 사 온다고 했어요. 그 주에…' ] },
    'calendar.event.0124': { lines:[ '매년 써 놔요. 안 써도 아는데.' ] },
    'sms.kang': { also:['easy.sms.kang'], lines:[ '형사님이 문자로 하재요. 전화는 안 하고.' ] } },
  dndChip: { id:'dndSay', chips:[{ id:'say', label:'세아 씨가 그 메일에 썼어요. 절대 엄마 잘못 아니라고.', edit:true, verb:'say' }, { id:'none', label:'아무 말도 하지 않는다', verb:'pick' }] },
};
```
(Plain strings = `who:'엄마'` name cards. The DND reaction's `e3_dnd` is `true` whether or not the chip is said — §3.9.)

### 6.9 `data/dial.js` (comms) → `G.STORY.dial` — readers: comms (phone app), shell (easymode E3 reads contacts/recents)
```js
G.STORY.dial = {
  sim: true, tabs:[['pad','키패드'], ['recent','최근 기록'], ['contacts','연락처']], menu:['설정','통화 녹음','번호 차단'],
  contacts: [ { id:'sea', name:'세아 💛', number:'010-0592-1163', avatar:'avatar_sea', fav:true, log:'sea' },
              { id:'jimin', name:'지민이', number:'010-0412-8830', avatar:'avatar_jimin', fav:true },
              { id:'kang', name:'강수진 형사님', label:'휴대전화' }, { id:'kwon', name:'박 권사님', label:'휴대전화' },
              { id:'butcher', name:'정육점 사장님', label:'일반 전화' } /* … ricecake churchOffice kitchenChief vet office — §4.3.2 labels */ ],
  recents: [ { d:'2027-01-23', hm:'17:42', who:'jimin', dir:'in', sec:62, rec:'jimin0123' },
             { d:'2027-01-05', hm:'18:10', who:'vet', dir:'out', noAnswer:true },
             { d:'2025-11-24', hm:'03:31', who:'sea', dir:'missed', row:'sea-20251124-0331' } /* … §3.20.2 / §4.3.1 / §4.3.2 rows + seeded months */ ],
  seed: { months:['2025-09','2027-01'], perMonth:[2,4], names:['churchOffice','kitchenChief','vet','jimin','kwon','ricecake','butcher','office'] },
  results: {      // §3.2.3 / §4.3.7 — first matching row wins; flags read live
    '112': [ { when:'!bip', card:'상황실 경찰관이 사건 번호를 확인한다. 담당 형사에게 바로 넘기겠다고 한다.', sec:41 },
             { when:'bip&!jimin112', card:'상황실 경찰관이 주소를 확인한다. 지구대를 바로 보내겠다고 한다. 문은 열지 말라고 한다.', sec:40, flag:'call112First' },
             { when:'jimin112&!patrol', card:'같은 주소로 방금 신고가 들어왔다고 한다. 같은 출동으로 합친다고 한다. 문은 열지 말라고 한다.', sec:38 },
             { when:'patrol', card:'지구대가 복도와 계단을 다녀갔다고 한다. 담당 형사에게도 전달됐다고 한다.', sec:35 } ],
    '119': [ { card:'구급이나 화재가 아니면 112로 연결해 드린다고 한다.' } ],
    '1366': [ { card:'상담원이 받는다. 지금 위험하면 112로 신고하라고 한다. 아침에 다시 걸어도 된다고 한다.' } ],
    sea: 'powerOff', '010-0592-1163': 'powerOff', '010-0658-2741': 'powerOff',
    kang: [ { ringSec:30, status:'{$noAnswer}', then:{ sms:'kcall', afterMs:60000, once:true } } ],
    jimin: [ { when:'!bip', card:'신호가 간다. 받지 않는다. 소파 쪽은 조용하다.' }, { when:'bip', card:'지민이 휴대전화 화면을 보고 고개를 든다.', say:'저 여기 있어요.' } ],
    office: [ { when:'!bip', card:'신호가 간다. 받지 않는다.' }, { when:'bip', say:'경비실입니다.', card:'공동현관 카메라는 아침에 소장님이 같이 보신대요.' } ],
    other: [ { card:'신호가 간다. 받지 않는다.' } ] },
  powerOff: ['{$connFail}', '{$powerOff}', { beepHz:1000, beepS:0.5 }, '{$callEnd}'],   // ep1 powerOffCall order · no voice (§12.2 V42)
  recentLabel: { in:'수신', out:'발신', missed:'부재중', noAnswer:'응답 없음' },
};
```

### 6.10 `data/recordings.js` (comms) → `G.STORY.recordings` (+ `G.STORY.callrecUI`) — readers: comms
§9.6 ② verbatim (newest first; §3.6 list · §3.7 transcripts to the letter):
```js
G.STORY.recordings = [
  { id:'sea0333', who:'세아 💛', kind:'talk', dir:'in', d:'2027-01-24', hm:'03:33', dur:33, buffer:'rec.sea0333', sub:'오늘 오전 3:33 · 0:33 · 톡 보이스톡',
    detail:[['통화 상대','세아 💛 (톡 보이스톡 · 수신)'], ['녹음 일시','2027.01.24 (일) 오전 3:33:06'], ['길이','0:33'], ['녹음 방식','자동 녹음'], ['저장 위치','이 휴대전화']],
    lines:[ {t:1, sp:'me', text:'여보세요?'}, {t:3, sp:'me', text:'…세아야?'}, {t:5, sp:'me', text:'세아야, 엄마야.'}, {t:8, sp:'them', text:'[허밍]'},
            {t:16, sp:'them', text:'[숨소리]'}, {t:21, sp:'them', text:'{N야}', low:true}, {t:22, sp:'them', text:'[허밍]'},
            {t:30, sp:'them', text:'[알 수 없음]', low:true}, {t:31, sp:'them', text:'[숨소리]'}, {t:33, sp:null, text:'통화 종료', end:true} ] },
  { id:'kwon0121', who:'박 권사님', kind:'cell', dir:'in', d:'2027-01-21', hm:'19:20', dur:200, buffer:'rec.plain.kwon0121', sub:'1월 21일 (목) 오후 7:20 · 3:20',
    lines:[ {t:0, sp:'them', text:'집사님, 이번 주일 구역 예배는 우리 집에서 해요.'}, {t:5, sp:'me', text:'권사님, 저는 이번 주는 못 가요.'},
            {t:8, sp:'me', text:'24일이 우리 세아 생일이라서요.'}, {t:12, sp:'them', text:'아… 그래요. 우리가 [알 수 없음] 기도할게요.', lowWord:'[알 수 없음]'},
            {t:17, sp:'me', text:'고마워요, 권사님.'} ] },
  /* jimin0123 1:02 · butcher0123 0:41 · jimin0110 4:11 (lowWord '몰라') · church1228 1:30 · ricecake1227 0:52 — §3.7 transcripts */
];
G.STORY.callrecUI = {
  settings:['번호 차단','통화 녹음','스팸 보호','빠른 거절 메시지','벨소리 및 진동'],
  recSettings:[['통화 자동 녹음','켜짐'], ['녹음할 통화','모든 통화'], ['녹음된 통화','›']],
  more:['텍스트 변환','세부 정보'], converting:'{$converting}', playerSub:'[통화 녹음 — 허밍]', plainSub:'[통화 소리]',
  reject:['지금은 통화할 수 없어요.','잠시 후 다시 걸게요.','회의 중이에요.','운전 중이에요.'],
  ring:[['벨소리','기본 벨소리'], ['진동 패턴','기본'], ['전화 받을 때 진동','켜짐']], spamRow:'스팸 및 사기 의심 전화 차단  사용 중 ›',
  voice:{ head:'음성 녹음', chips:['전체','일반','통화 녹음'], empty:'{$noRec}' },
};
```
(`lowWord` marks the single grey word inside a plain line; `low:true` greys the whole line. Speakers render `나` / the `who` name.)

### 6.11 `data/blocked.js` (comms) → `G.STORY.blocked` — readers: comms (+ flow hook through `G.callrec.renderBlockedMsgs`)
```js
G.STORY.blocked = {
  calls: ['2026-12-24','2026-11-24','2026-10-24','2026-09-24','2026-08-24','2026-07-24','2026-06-24','2026-05-24','2026-04-24','2026-03-24',
          '2026-02-24','2026-01-24','2025-12-24'],                    // row: `{fmtDate}  오전 3:31   010-0658-2741   광고 · 0초` (all with year)
  number:'010-0658-2741', hm:'03:31', tag:'광고 · 0초', reason:'광고 (스팸 자동 차단)', spamSince:'2025.07.20',
  block: { rows:['전화번호 추가','알 수 없는 번호 차단','스팸 및 사기 의심 전화 차단','차단된 통화','차단된 메시지'], none:'{$noBlocked}', spamOn:'사용 중' },
  spamScreen: ['{$spamLong}', '사용 시작  2025.07.20'],
  messages: [ { d:'2027-01-19', number:'010-0927-4410', text:'[Web발신] (광고) 겨울 보약 특가 안내…' },
              { d:'2027-01-07', number:'010-0384-1196', text:'[Web발신] (광고) 저금리 대환 대출…' },
              { d:'2026-12-30', number:'010-0715-6023', text:'[Web발신] (광고) 새해 운세 무료 확인…' },
              { d:'2026-11-12', number:'010-0549-3307', text:'[Web발신] (광고) 김장 절임배추 예약…' } ],
  hook: { hm:'06:10', label:'오전 6:10', number:'010-0658-2741', text:'다음 달엔 세아 학교에 가 볼게. 지민이도 오지?', his:true },   // his only new line (§3.19)
};
```

### 6.12 `data/sms.js` (comms) → `G.STORY.sms` — readers: comms (+ shell easymode via `G.sms.renderThread`)
```js
G.STORY.sms = {
  list: [ { id:'kang', name:'강수진 형사님' }, { id:'parcel', name:'[택배]' }, { id:'office', name:'[관리사무소]' }, { id:'web', name:'[Web발신]' } ],
  threads: {
    kang: [ { id:'k1225', from:'them', d:'2026-12-25', hm:'09:40', text:'[{police}] 어머님, 강수진입니다. 오늘 오전에 전화드려도 될까요?' },
            { id:'k1226a', from:'them', d:'2026-12-26', hm:'13:30', text:'대전역 도착했습니다. 2시까지 찾아뵐게요.' },
            { id:'k1226b', from:'them', d:'2026-12-26', hm:'16:30', text:'오늘 시간 내 주셔서 감사합니다. 통화 녹음은 켜 두었습니다. 다른 설정은 손대지 않았어요.' },
            { id:'k1226c', from:'them', d:'2026-12-26', hm:'16:31', text:'세아 씨 톡과 앨범은 그대로 두시고, 새 사진은 올리지 말아 주세요. 연락은 문자로 부탁드립니다.' },
            { id:'k1226d', from:'me', d:'2026-12-26', hm:'17:02', text:'네 형사님 고맙습니다' },
            { id:'k0115', from:'them', d:'2027-01-15', hm:'10:20', text:'어머님, 크리스마스 새벽 메시지는 해외 회사라 회신이 오래 걸린대요. 계속 확인하고 있습니다.' },
            { id:'k0121a', from:'them', d:'2027-01-21', hm:'18:00', text:'어머님, 24일이 세아 씨 생일이죠. 무슨 일 있으시면 언제든 문자 주세요.' },
            { id:'k0121b', from:'me', d:'2027-01-21', hm:'18:12', text:'네 고마워요' } ],
    parcel: [ { id:'p1130', from:'them', d:'2026-11-30', hm:'18:36', text:'고객님의 상품이 문 앞에 배송되었습니다. 11/30 18:36' } ] /* office · web — §3.20.2 */ },
  live: {   // delivered at run time (stamp = in-game clock at delivery) — notification ids §4.13
    k0341: { notif:'N01', text:'[{police}] 어머님, 강수진입니다. 방금 세아 씨 톡 계정에 접속 알림이 왔어요. 혹시 연락 오셨나요?', flag:'kang341' },
    k0341r: { notif:'N02', texts:['{N} 님, 고맙습니다.', '접속은 PC 버전이었어요. 어디서인지는 메신저 회사 회신이 와야 알 수 있어요. 며칠 걸립니다.', '녹음은 그대로 두세요. 아침에 받으러 가겠습니다.'] },
    k0341keep: { notif:'N02p', text:'어머님, 주무시면 아침에 다시 연락드릴게요. 녹음은 그대로 두세요.' },
    kcall: { notif:'N03', text:'[{police}] 지금 통화가 어렵습니다. 문자로 부탁드립니다.' },
    kname: { notif:'N04', texts:['…합성일 수도 있어요.', '확인 중입니다.'] }, kblock: { notif:'N05', texts:['그 번호는 저희가 확인하겠습니다.', '알려 주셔서 고맙습니다.'] },
    k702: { notif:'N06', text:'앨범 기록은 보전 요청하겠습니다. 어머님 앨범은 지금처럼 두셔도 됩니다.' },
    k0502: { notif:'N07', flag:'kang502', texts:[ '[{police}] 어머님, 강수진입니다. 대전 지구대에서 연락받았습니다. 복도와 계단엔 아무도 없었다고 합니다.',
             '공동현관 CCTV는 아침에 관리사무소와 같이 확인하겠습니다.',
             () => G.flag('kang341Sent') ? '어디서 접속했는지는 며칠 걸립니다. 크리스마스 새벽 메시지도 아직 회신을 기다리고 있습니다.'
                                         : '새벽 3시 33분 접속은 PC 버전이었고, 통화는 33초였어요. 어디서 접속했는지는 회사 회신이 와야 알 수 있어요. 며칠 걸립니다. 크리스마스 새벽 메시지도 아직 회신을 기다리고 있습니다.',
             '아침 첫차로 대전에 내려가겠습니다. 문은 열지 마세요.' ] },
    kask: { notif:'N08', text:'말씀드릴 수 없는 게 있어요. 죄송해요.' }, kfree: { notif:'N09', text:'네, 확인했습니다.' } },
  chips: [ { id:'k341', when:'kang341', until:'kang502', flag:'kang341Sent', reply:'k0341r', keep:'k0341keep',
             text:'{N}입니다. 어머님 폰으로 보내요. 3시 33분에 세아 씨 톡으로 보이스톡이 왔고, 어머님이 받으셨어요. 33초였고 녹음돼 있어요.' },
           { id:'kname', when:'nameKnown', flag:'kangNameSent', reply:'kname', text:'녹음 0:21에 제 이름이 들려요.' },
           { id:'kblock', when:'blockBottom', flag:'kangBlockSent', reply:'kblock', text:'어머님 폰 차단된 통화에 같은 번호가 13통 있어요. 매달 24일 오전 3시 31분이에요.' },
           { id:'k702', when:'saw702', flag:'kang702Sent', reply:'k702',
             text:() => '11월 30일 공유 앨범 사진에 현관 호수가 보여요.' + (G.flag('bomSeen') ? ' 그 사진들을 sagongsa가 봤다고 나와요.' : '') },   // frozen when drawn
           { id:'kask', when:'kang502', flag:'kangAskSent', reply:'kask', text:'지금 어디까지 찾으셨어요?' } ],
  replyMs: 40000, keepMs: 60000, freeLimitMs: 600000, sound:'sms',
};
```

### 6.13 `data/talk.js` (comms) → `G.STORY.talk` — readers: comms
```js
G.STORY.talk = {
  mode: 'in', r4: false,                                            // §12.5-3: R4 line off (live ep1 has no R4)
  list: [ { id:'sea', name:'세아 💛', avatar:'avatar_sea', pinned:true, preview:'보이스톡 0:33', hm:'03:33' },
          { id:'jimin', name:'지민이', avatar:'avatar_jimin' }, { id:'self', name:'나와의 채팅', avatar:'avatar_mom' },
          { id:'group3', name:'3구역', members:14, readOnly:true }, { id:'kitchen', name:'급식실 조리팀', members:8, readOnly:true } ],
  input: { sea:true, jimin:true, self:true },                       // §5.1 input rule (sent bubbles = right · 세아 💛 keeps '1' · no reply)
  rooms: {
    sea: (cb) => [                                                   // §3.20.1 order — built from G.STORY.e1canon + generated daily rows
      ...G.STORY.e1canon.momRoomReversed(),                         // 2025-09-14 … 11-23 (ep1 momMessages(), sides swapped, month folds)
      { day:'2025-11-24', rows:[ { from:'them', hm:'03:33', text:'엄마 나' }, { from:'me', hm:'07:10', text:'세아야 새벽에 왜? 무슨 일 있어?' },
                                 { from:'me', hm:'07:10', text:'엄마가 전화 못 받았네 미안해' }, { from:'me', hm:'07:11', call:'noAnswer' },
                                 { from:'me', hm:'07:12', text:'전화 좀 받아' } ] },
      { daily:{ from:'2025-11-25', to: cb('A') ? '2026-11-24' : '2027-01-23', hm:'03:33', row:{ from:'me', call:'noAnswer' } }, fold:'month' },
      /* 2026-11-24 block incl. A′ (cb('A1')) four lines + call, A″ 07:04–07:07 (mail card → e1canon.seaMail), A line — §3.20.1 ④;
         then the '1' lines of ⑤; R4 only when r4 */
      { day:'2027-01-24', rows:[ { from:'them', hm:'03:33', call:'done', label:'보이스톡 0:33' } ] } ],
    self: [ { d:'2025-07-20', hm:'21:30', text:'세아가 해 준 거 (25.7.20)\n글씨 크게 — 안경 안 써도 됨\n광고 전화는 저절로 막힘. 안 울림\n사진은 \'콩이\' 앨범에 올리면 세아도 봄' },
            { d:'2026-12-26', hm:'21:20', text:'12/26 형사님\n세아 노래 들음\n다섯 번째 음 틀렸음\n언제 녹음인지 모른대\n끝까지 못 들음\n전화 녹음 켜 놓음 (형사님이)\n톡, 앨범 지우지 말 것\n사진 올리지 말 것\n연락 오면 형사님께 문자 (전화 X)' },
            { d:'2027-01-21', hm:'21:10', text:'1/21 장보기\n미역\n소고기 국거리 한 근\n국간장\n참기름\n두부\n귤 (애들)\n콩이 간식\n~~케이크~~' } ],
    jimin: (cb) => [ /* §3.20.1 지민이 room — 2026-12-25 02:04 line = cb('A') ? '그날 이후로 03:33에 전화 안 해요. 대신 그 시간에 콩이랑 물 마셔요.' : '아직도 03:33에 깨요. 그래도 괜찮아요.' */ ],
    group3: [ { d:'2027-01-20', hm:'20:00', from:'박 권사님', text:'이번 주일 구역 예배는 2시에 저희 집에서 합니다. 세아 자매 위해 계속 기도해 주세요🙏' },
              { d:'2027-01-20', hm:'20:05', from:'me', text:'감사합니다 권사님' } ],
    kitchen: [ { d:'2026-12-30', from:'실장님', text:'방학 중 조리실 소독은 2월 둘째 주에 합니다' } /* 2–3 lines §4.5.5 */ ] },
  callRow: { noAnswer:'보이스톡 · 응답 없음', done:'보이스톡 0:33' }, redial:'다시 걸기', mailCard:'✉️ 1년 뒤에 이 메일을 읽을 누군가에게 · 윤세아 · 예약 메일',
};
```
(`~~…~~` = strike-through rendering. `'1'` unread marks: every 엄마 line after 2026-11-24 07:07 shows `1`; none ever changes tonight.)

### 6.14 `data/e1canon.js` (comms) → `G.STORY.e1canon` — readers: comms
Ep1 canonical text copied **verbatim** at build time from `js/data/talk.js` `momMessages()`, `js/scenes.js` ending, `js/data/mail.js`
`SEA_MAIL`, `js/data/phone.js` `calls` (§9.1 '1 · 2편과 공유하는 것'; ep1 files unchanged):
```js
G.STORY.e1canon = {
  momLines: [ /* [ 'YYYY-MM-DD', 'HH:MM', side:'mom'|'sea', text ] … exactly ep1 momMessages() 2025-09-14 → 2026-11-24 07:07 */ ],
  momRoomReversed() { /* returns the §3.20.1 ① day blocks with sea = left ('them') and mom = right ('me') + month folds */ },
  momRead: ['세아야?', '읽었어???', '세아야 엄마야', '전화 받아'],               // A′ (cb.A1) — ep1 talk.js momRead fixed lines
  endDialog: [ ['me', '어머님, 저는 404호에 새로 이사 온 사람이에요. 세아 씨 폰을 찾았어요.'], ['mom', '…세아가 뭐라고 했어요?'], ['me', { mail:true }],
               ['mom', '…'], ['mom', '고마워요.'], ['mom', { img:'kongi_old' }], ['mom', '콩이가 아직도 현관에서 기다려요.'] ],
  endA: '오늘은 전화 안 할게요. 대신 내일 아침에 콩이 데리고 산책 갈게요.',
  seaMail: { title:'1년 뒤에 이 메일을 읽을 누군가에게', from:'윤세아', sched:'예약 발송: 2025.11.23 23:58 → 2026.11.24 07:00', body:[ /* SEA_MAIL verbatim */ ] },
  seaCalls: [ ['2025-11-24','08:02','out',0], ['2025-11-24','07:15','out',0], ['2025-11-24','07:13','out',0], ['2025-11-24','03:31','missed'],
              ['2025-11-10','20:14','out',723], ['2025-11-03','21:30','in',520], ['2025-10-14','08:40','out','noAnswer'], ['2025-09-14','19:40','out',372] ],
};
```

### 6.15 `data/gallery.js` (media) → `G.STORY.gallery` — readers: media
```js
G.STORY.gallery = {
  v: 3, head:'사진 3,041', total:3041,
  grid: { dated:[ ['p3_cake_2411','2024-11-23 19:40','cake2411'], ['p3_soup_2601','2026-01-24 07:12','soup2601'], ['dog_face','2026-03-17 09:12'],
                  ['kongi_old','2026-11-21'], ['p3_kongi_1130','2026-11-30 18:40'], ['p3_kongi_1213','2026-12-13 19:05'], ['kongi_santa','2026-12-24 21:30'] ],
          filler:{ keys:['dog_face','dog_park','dog_bed','kongi_old','kongi_santa','p3_kongi_1213'], variants:72 } },   // §0.3 D39 (p3_kongi_1130 never varied)
  albums: [ { id:'camera', name:'카메라', count:'3,041' }, { id:'old', name:'옛날 사진', items:['p3_child_back','p3_child_hands'] },
            { id:'shared', name:"공유 앨범 '콩이'", count:8, head:"공유 앨범 '콩이' · 멤버 3 · 사진 8", menu:['멤버','활동','앨범 정보'],
              info:'만든 사람  세아 · 2024.09.01', flag:'albumOpened',
              members:[ { id:'sea', name:'세아', avatar:'avatar_sea', role:'만든 사람' }, { id:'mom', name:'나', avatar:'avatar_mom' },
                        { id:'sagongsa', name:'sagongsa', avatar:'avatar_sagongsa', role:'참여 2025-03-10 15:24',
                          detail:['sagongsa', '2025년 3월 10일 오후 3:24 참여', '공유한 사진 0'] } ],
              photos:[ { id:'1224', key:'kongi_santa', door:true, cap:'콩이 산타 됐어. 세아야 메리 크리스마스', up:'나 · 2026.12.24 오후 9:30', bom:'sagongsa · 2026.12.25 오전 3:21' },
                       { id:'1130', key:'p3_kongi_1130', door:true, cap:'세아야 택배 왔는데 콩이가 제일 먼저 나와. 너 오는 줄 알고', up:'나 · 2026.11.30 오후 6:40',
                         bom:'sagongsa · 2026.11.30 오후 11:47', saw702:true },
                       { id:'0317', key:'dog_bed', cap:'콩이 우리집 온 지 2년 🎂', up:'세아 · 2025.03.17 오후 12:01', bom:'나 · sagongsa',
                         comments:[['나','우리 막내 생일 축하해 ♥'], ['세아','엄마 케이크 사 왔어?ㅋㅋ']] } /* 1213 1204 2603 1120 0902 — §3.10 table */ ],
              activity:[ ['2026.12.24 오후 9:30','내가 사진 1장을 추가했습니다'], ['2026.11.25 오후 3:02','세아님이 사진 1장을 삭제했습니다', 'deleted'],
                         ['2026.11.24 오전 4:31','sagongsa님이 사진 1장을 추가했습니다', 'deleted'], ['2025.03.10 오후 3:24','sagongsa님이 참여했습니다', 'member:sagongsa'],
                         ['2024.09.01 오후 9:30',"세아님이 공유 앨범 '콩이'를 만들었습니다"] /* full list §3.10 */ ] } ],
  infoLabels: { up:'올린 사람', bom:'봄' }, deleted:'{$photoDeleted}',
};
```

### 6.16 `data/calendar.js` (media) → `G.STORY.events` — readers: media
```js
G.STORY.events = {
  v: 3, range:['2024-11', '2027-03'], today:'2027-01-24',
  items: [ { id:'0124', yearly:'01-24', title:'우리 딸 생일 🎂', scr:'calendar.event.0124' },
           { id:'0317', yearly:'03-17', title:'콩이 온 날' },
           { id:'1126', day:'2025-11-26', title:'내 생일 🎂', memo:'세아가 케이크 사 온대', scr:'calendar.event.1126', flag:'calCake' },   // no 'created' row
           { id:'kang', day:'2026-12-26', hm:'14:00', title:'강 형사님 오심' },
           { id:'guests', day:'2027-01-23', hm:'18:30', title:'지민이랑 {N} 씨 옴 🍲' },
           { id:'sunday', weekly:0, hm:'11:00', title:'주일 예배' },
           { id:'break', from:'2026-12-31', to:'2027-03-01', title:'방학 (급식 없음)' } ],
  empty:'{$noEvent}',
};
```

### 6.17 `data/moim.js` (media) → `G.STORY.moim`, `G.STORY.browserApps` — readers: media (browser.js)
```js
G.STORY.browserApps = {
  moim:    { name:'모임', icon:'moim', appMode:'moim' },
  files:   { name:'내 파일', icon:'files', appMode:'files', page:{ head:'내 파일', empty:'최근 파일 없음', rows:['이미지','동영상','오디오','문서','다운로드'] } },
  weather: { name:'날씨', icon:'weather', appMode:'weather', page:{ place:'{daejeon}', now:'맑음 −6°', hours:[ /* §4.8.4 오전 4시 −6° … 오전 8시 −5° */ ], sunrise:'일출  오전 7:36' } },
};
G.STORY.moim = {
  group: '3구역 기도 모임 · 멤버 14',
  posts: [ { id:'p0123', when:'2027.1.23 오후 7:50', who:'김현숙', text:'내일이 우리 딸 생일이에요. 세아 친구 둘이 왔어요. 기도 부탁드려요.', likes:14,
             comments:[['박정자','집사님 힘내세요. 기도할게요'], ['이순례','세아 꼭 돌아올 거예요'] /* 6 — §4.8.2 */] },
           { id:'p0103', when:'2027.1.3', title:'새해 기도 제목', text:'김현숙 집사님: 딸 세아 자매가 무사히 집에 돌아오기를.' },
           { id:'p1227', when:'2026.12.27', title:'성탄 예배', img:'p3_church' },
           { id:'p2601', when:'2026.1.23', who:'김현숙', text:'내일이 우리 딸 생일이에요. 미역국 끓여 놓고 기다리려고요.', likes:21, comments:[ /* 9 */ ] } ],
};
```

### 6.18 `data/mail.js` · `data/clock.js` · `data/browser.js` · `data/memos.js` (media)
```js
G.STORY.mailAccount = { mode:'in', head:'받은편지함' };
G.STORY.mails = [ /* 3 read-only mails of §4.8.4: 교회 소식지 · 급식실 공지 · 쇼핑 영수증 — text only, no compose/reply */ ];
G.STORY.alarms = { v:3, n:[ { id:'a0630', time:'오전 6:30', repeat:'월–금', on:false } ], tabs:['알람','세계 시각','스톱워치','타이머'] };
G.STORY.browser = { v:3, start:{ logo:'다온', placeholder:'검색' }, history:[],
  search:[ { keys:['112','1366','스토킹'], results:[ /* §4.8.4 safety rows */ ] }, { keys:['미역국'], results:[ /* … */ ] } ],
  noResultFor:['통화 녹음','텍스트 변환','차단','쉬운 모드','방해 금지','공유 앨범'] };     // → {$noResult} (§0.3 D16)
G.STORY.memos = { v:3, empty:'{$memoEmpty}', newButton:false };
```

### 6.19 `data/tones.js` · `data/subs.js` (audio) → `G.tones` (ARCH §5.17) · `G.SUBS`
```js
G.SUBS = {
  S01:{ text:'[식탁 — 톡 착신음]', kind:'info', ms:3200, az:270 }, S02:{ text:'엄마: 여보세요?', kind:'voice', ms:1800, az:270 },
  S06:{ text:'[현관 · 삐삐삐]', kind:'info', ms:2400, az:0 },
  S07:{ text:'[콩이가 현관을 향해 짧게 두 번 짖는다]', kind:'info', ms:3000, az:0 }, S07less:{ text:'[콩이가 현관을 향해 짧게 짖는다]', kind:'info', ms:3000, az:0 },
  S10:{ text:'[베란다 — 보일러가 켜진다]', kind:'info', ms:2400, az:90 }, S20:{ text:'[방울 — 딸랑]', kind:'info', ms:2000, az:48 },
  /* … every row of §7.4 (S01–S23) — text identical to §4.14.3 */ };
```

### 6.20 `data/objectives.js` (flow) → `G.OBJECTIVES` (order = hint-tab priority, §2.4)
```js
const f = (n) => !!G.flag(n), seen = (id) => !!(G.state.vars.fl && G.state.vars.fl.cardsDrawn && G.state.vars.fl.cardsDrawn[id]);
G.OBJECTIVES = [
  { id:'call', title:'엄마', show:() => true, done:() => f('gotPhone'),
    hints:['식탁에 누가 앉아 있다.', '부엌(270°)의 엄마를 눌러 본다.',
           '엄마를 누르고 기다린다. 3시 33분에 일이 일어난다. 통화가 끝나면 엄마가 휴대전화를 민다 — 잠금화면을 위로 민다.'] },
  { id:'easy', title:'큰 글씨', show:() => seen('easyCard'), done:() => f('easyOff'), hints:[ /* §3.3 T1–T3 */ ] },
  { id:'phone', title:'엄마 폰', show:() => f('gotPhone'), done:() => f('nameKnown') && f('blockBottom') && (f('albumOpened') || f('M5')), hints:[ /* §3.5 */ ] },
  { id:'rec', title:'녹음', show:() => seen('recCard'), done:() => f('recPlayerOpened'), hints:[ /* §3.6 */ ] },
  { id:'text', title:'텍스트 변환', show:() => f('textAnyOpened'), done:() => f('nameKnown'), hints:[ /* §3.7 */ ] },
  { id:'block', title:'차단된 통화', show:() => f('blockOpened'), done:() => f('blockBottom') && f('momBlock'), greyAfter:'M8', hints:[ /* §3.8 */ ] },
  { id:'dnd', title:'방해 금지', optional:true, show:() => f('dndOpened'), done:() => f('momDnd'), greyAfter:'M8', hints:[ /* §3.9 */ ] },
  { id:'album', title:"공유 앨범 '콩이'", show:() => f('albumOpened'), done:() => f('albumDone'), greyAfter:'M8', hints:[ /* §3.10 */ ] },
  { id:'door', title:'현관', show:() => f('M6'), done:() => f('doorDone'), hints:[ /* §3.12 */ ] },
  { id:'room', title:'세아 방', show:() => f('M7'), done:() => f('memoryDone'), hints:[ /* §3.13 */ ] },
  { id:'play', title:'식탁', show:() => f('M8'), done:() => f('END'), hints:[ /* §3.14 */ ] },
  { id:'soup', title:'미역국', show:() => f('soupSeen0') || f('gotPhone'), done:() => f('END'), hints:[ /* §4.15 ⊕ (V17 T3) */ ] },
  { id:'easyBack', title:'큰 글씨로 다시 해 두기', optional:true, show:() => f('easyBackChip'), done:() => G.state.stage.easyBack != null, hints:[ /* §4.15 ⊕ */ ] },
];
G.OBJECTIVES.titleExceptions = ['call', 'phone', 'soup@gotPhone'];
```
Hints: copy §4.15 table verbatim (T1/T2/T3 per id — they equal the §3.x "Hints" lines; `soup`/`easyBack` = §4.15 ⊕).

### 6.21 `data/beats.js` (flow) → `G.BEATDATA3` (+ `G.BEATDATA2` alias) — ARCH §5.16 options + records
```js
{ id:'W05', cls:'micro', kind:'world', owner:'director',
  when:(s) => s.flag('gotPhone') && !s.flag('M8') && s.passed('04:10'), until:(s) => s.flag('M8'), where:'any', defer:'world',
  delayMs:(s) => s.jumpedOver('04:10') ? 2000 : 0,
  run: async (ctx) => { G.audio.cue('boiler.fire', { n:1, src:'boiler' }); G.room && G.room.pulse && G.room.pulse('boiler'); G.audio.sub('S10', { az:90 }); } }
```
Snapshot `s` (engine) + ep3 helpers in the data file: `where()` (= `G.e3.where()`), `momAt()`, `jumpedOver(hm)` (from the last
`clock:jump` skipped list). Documentation records exist for every id of §6.2 (B00–B21, W01–W05, W11, W12) with their `owner`.

---

## ARCH §7 — Debug / QA surface

### 7.1 Switches
`G.DEBUG` (ARCH §5.2): `CONFIG.DEBUG === true` or `?debug=1` on any host except `*.pengueverything.cloud`. DEBUG shows hotspot and
`G.IMGMETA` rects (room — `haru.rects()`), a corner budget meter (core: his lines = 1, jumps 0, stings ≤ 1, monos ≤ 6, vibrate calls),
missing-hook warnings, the §10 A title/whitelist auto-check (flow `main.js`), and enables `window.haru`. URL helpers (DEBUG only):
`?debug=1&series=S5` injects a §9.3 profile (S1–S13) before `seriesBoot` (core, engine `_fixture`) · `?debug=1&jump=M5` calls
`haru.jump('M5')` after boot (flow main) · `?debug=1&name=지은` sets the player name before boot (core) · `?preview=1` passes the (12.7에서 삭제 — `?preview=1` 우회는 없다. 잠금 자체가 없다)
release gate (no debug UI).

### 7.2 `window.haru` (core creates it in `e3.js` at load; owners add their helpers in their own files, only when `G.DEBUG`)
| helper | owner | behaviour |
|---|---|---|
| `haru.state()` · `haru.flags()` · `haru.vars()` | core | deep copies; `flags()` = names that are on, in set order |
| `haru.flag(name, on=true)` | core | raw set, no prerequisites (flags are monotone — `on=false` only for tests) |
| `haru.jump(id, { commit=false, armed=false })` | core (table 7.3) + flow (`G.main.resumeFrom`) | sets every prerequisite in order with spaced `pm` values (now − n·1000), lets milestone flags re-anchor the clock, then `G.main.resumeFrom(G.state)` (which calls `G.room.refresh`, `G.door.resume`, `G.memory.resume`, `G.climax.resume`, `G.ending.resume`, `G.hook.resume`) |
| `haru.time(x)` | core | number = playMs scale (1 normal, 10 = ×10 — ep2 driver semantics) · string `'HH:MM'` = forward clock jump (`G.clock.jump`) |
| `haru.speed(x)` | core | alias of `haru.time(number)` (§11.4 name) |
| `haru.cb(obj)` | core | overrides `cbPreview` and (if `introDone`) `G.state.cb` with the given keys (`A A1 B C D E`) |
| `haru.series(profile)` · `haru.series.fixture(id)` | core | inject S1–S13 (§9.3 table) → `seriesBoot()` again; returns `cbPreview` |
| `haru.name(n)` | core | `CONFIG.PLAYER_NAME = n` + `G.audio.renameReset()` (the whisper fallback re-renders) |
| `haru.type(text)` | core | inserts text into `G.ui.focusedField()` through the composition path |
| `haru.clearSave()` · `haru.clearSeries()` | core | ep3 save + session store / series record |
| `haru.budget()` | core | `{ hisLines, jumps, stings, monos, vibrate, imgKeys }` (§11.4 `budget()`) |
| `haru.easy(on)` | shell | `G.easy.set(on, {silent:true})` |
| `haru.show(scr)` | shell | runs the reaction of `scr` ignoring position (test only) |
| `haru.where(v)` · `haru.room(view)` · `haru.rects()` | room | `G.room.where(v)` · open the camera at a view · draw hotspot/meta rects |
| `haru.play(t, { line=true })` | comms | `G.callrec.play('sea0333', { by: line ? 'line' : 'play', line: t })` (same session rules as a tap) |
| `haru.recRate(x)` | comms | DEBUG only: drives the callrec position with the silent timer at x× (audio muted) — positions, sessions, events and judging unchanged |
| `haru.skipTo(beatId)` | flow | runs that beat record now (ignores when/until/safe), marks fired |
| `haru.notebook(id, tier)` | flow | reveal a hint tier ignoring waits |
| `haru.audio.meter` | audio | ep2 meter, extended to the ep3 cues (§6.4-③ checks) |
| (no `haru.setUser`) | — | ep3 has one user (`G.users.current()` is always `'n'`); `haru.where(v)` is the ep3 equivalent for "where is {N}" |

### 7.3 `haru.jump` prerequisite table (cumulative · clock re-anchors on each milestone flag)
| id | adds (in order) |
|---|---|
| `M0` | `introDone` · (`recapShown` when `cb.E`) · `M0` · director marks `B00 B01` |
| `M1` | `momLine1` · `M1` · `callRing` · `callAnswered` · `callEnded` · `handover` · `vars.seq.m1 = 'done'` · `G.e3.momAt('sr')` · room `srGap .25` `srLamp 'dim'` · clock `03:35` · marks `B02–B06` |
| `gotPhone` | `gotPhone` · lock hidden · easy home |
| `M2` | `easyOff` · `vars.easy = false` · `M2` |
| `M3` | `kang341` (k0341 delivered silently) · `recListOpened` `recPlayerOpened` `recPlayed` `textAnyOpened` `textOpened` `greySeen` `heard21` `nameKnown` · `M3` |
| `M4` | `blockOpened` `blockBottom` · `vars.TB` · `M4` |
| `M5` | `albumOpened` `membersSeen` `bomSeen` `albumDone` · `M5` (core schedules `e3:m6due`) |
| `M6` | `M6` · `vars.seq.m6 = null` (door.resume plays the 04:40 sequence from t 0) |
| `M7` | `bip` `view0AfterM6` `doorDone` `jiminUp` `jimin112` `patrol` `kang502` (k0502 delivered silently) `kongiBack` · room `jimin 'gone'` `kongi 'sleep'` · `M7` · `G.room.where('sr')` · `G.e3.momAt('sr')` · room `srLamp 'lit'` `srGap .45` · marks `B12 B13` |
| `M8` | `memoryStart` `memoryDone` · `M8` · `G.room.where('lv')` · `G.e3.momAt('lv')` · marks `B14 B15` (climax.resume shows the M8 cards; `{armed:true}` adds `playArmed`) |
| `END` | `playArmed` · `played` · stage `e3_played true` · `END` · `vars.endStep = 'e0530'` · marks `B16 B17 B18` · commit only with `{commit:true}` |
| `HOOK` | `collarOn` `soupServed` `easyBackChip` · stage `easyBack true` · `vars.endStep = 'hook'` · `HOOK` |

### 7.4 Stable DOM hooks — `data-qa` (every owner MUST add these; values are exact; never translated/renamed)
Format `data-qa="<area>.<thing>"`, list items `data-qa="<area>.<thing>:<id>"`. Sliders also expose `role="slider" aria-valuenow`.
Engine-rendered elements keep their ep2 values (`nav.back`, `home.app:<id>`, `lock.surface`, `settings.row:<key>`, `nb.*`, `kb.*` …).
| owner | data-qa values |
|---|---|
| flow scenes | `title.start` `title.continue` `title.restart` `title.hookReplay` `title.recanon` `title.series` `title.inapp.ok` `warn.ok` `ear.ok` `ear.speaker` `ear.none` `ear.retry` `ear.silent` `ear.start` `recap.skip` `pause.btn` `pause.resume` `pause.title` `pause.opt:<key>:<value>` — pairs `scares:full` `scares:light` · `textSize:0.9` `textSize:1` `textSize:1.15` · `audioMode:ear` `audioMode:speaker` · `subs:info` `subs:all` · `vibration:true` `vibration:false` · `reduceShake:true|false` · `reduceFlash:true|false` |
| flow notebook / ending / hook | `nb.fab` `nb.close` `nb.tab:todo|hint|memo` `nb.card:<id>` `nb.hint:<id>:<1|2|3>` `nb.memo` · `end.next` (the 06:00 `[계속]` → credits, §3.15 l.1213) `credits.skip` `check.continue` `hook.home` |
| core cards / keyboard | `card` `card.next` `chip.opt:<chipId>` `chip.field` `chip.send` `chip.keep` · `kb` `kb.key:<char>` `kb.lang` `kb.space` `kb.back` `kb.submit` |
| shell phone / lock | `statusbar` `statusbar.pause` `home.app:<appId>` `home.folder` `home.folder.close` `home.widget` `home.widget.date` `home.bar` `nav.back` `qs.panel` `qs.tile:wifi|sound|flash|dnd` `notif:<id>` `banner:<id>` (ids N01…N09, N02p) `dialog.btn:<value>` `sheet.btn:<value>` `toast` `call.screen` `call.end` `call.btn:speaker|mute|keypad` · `lock.surface` `lock.emergency` `lock.camera` |
| shell easymode / settings / show | `easy.home` `easy.tile:<appId>` `easy.clock` `easy.date` `easy.toggle` `easy.phone.tab:pad|recent|contacts` `easy.contact:<id>` `easy.call` `easy.sms` `easy.recent.row:<i>` `easy.sheet.call` `easy.sheet.sms` `easy.gate:rec|spam` `easy.gate.switch` · `settings.search` `settings.recent:<i>` `settings.recent.del:<i>` `settings.result:<i>` `settings.row:<key>` `settings.toggle:dndNow` `settings.slider:font` · `show.btn` |
| comms phone / callrec | `phone.tab:pad|recent|contacts` `phone.menu` `phone.menu.settings` `phone.menu.rec` `phone.menu.block` `phone.recent.search` `phone.recent.row:<id>` `phone.recent.info:<id>` `phone.contact:<id>` `phone.contact.log` `phone.detail.rec` `dial.key:<d>` `dial.del` `dial.call` · `callrec.row:block|rec|spam|reject|ring|list` `settings.toggle:recAuto` (C2 switch — comms renders it) `rec.item:<id>` `rec.item.more:<id>` `rec.more` `rec.more.text` `rec.more.detail` `rec.play` `rec.seek` `rec.line:<t>` (t = 1 3 5 8 16 21 22 30 31 33) `rec.mini.play` `rec.mini.seek` `rec.voice.chip:all|plain|call` · `block.add` `block.unknown` `block.spam` `block.calls` `block.msgs` `block.row:<i>` (0 = newest … 12 = 2025-12-24) `block.msg:<i>` `block.pad.key:<d>` `block.pad.ok` `block.mine.del:<i>` |
| comms sms / talk | `sms.thread:<id>` (`kang` `parcel` `office` `web`) `sms.menu` `sms.menu.settings` `sms.menu.blocked` `chat.input` `chat.send` `chat.chip` `chat.chip.dismiss` `chat.msg:<id>` · `talk.thread:<id>` (`sea` `jimin` `self` `group3` `kitchen`) `talk.call` `talk.fold:<YYYY-MM>` `talk.mailcard` `talk.callrow:<id>` `talk.redial` |
| media | `gallery.tab:photos|albums` `gallery.album:<id>` (`camera` `old` `shared`) `gallery.more` `gallery.members` `gallery.activity` `gallery.albuminfo` `gallery.avatars` `gallery.member:<id>` `gallery.act:<i>` `gallery.photo:<id>` (shared: `1224` `1213` `1204` `1130` `2603` `1120` `0902` `0317` · grid: `soup2601` `cake2411`) `gallery.grid:<i>` `viewer.img` `viewer.info` `viewer.close` `viewer.next` `viewer.prev` · `cal.day:<YYYY-MM-DD>` `cal.event:<id>` `cal.prev` `cal.next` · `moim.post:<id>` `browser.search` `browser.result:<i>` `mail.item:<id>` `clock.tab:<id>` `files.row:<i>` |
| room | `room.eye` (eye-view root · `data-view` · focusable for ←/→) `room.camera` (camera root · `data-room` `data-view`) · camera mode only: `room.view:<id>` `room.next` `room.prev` · both: `room.spot:<id>` (lv: `door shoes hook mat srdoor kongi veranda jimin frames clock outlet mom table stove calendar` · sr: `orgel manual drawing frame bed window srout mom`) `room.closeup.close` `room.flip` `room.close` `room.flash` `room.shutter` |
| audio | `audio.resume` |
DESIGN §11.4 proposals mapped to these values: `earphone.ok` → `ear.ok` · `room.dir:<az>` → `room.view:<id>` / `room.next` /
`room.prev` in camera mode, `ArrowLeft`/`ArrowRight` on `room.eye` in eye views (they draw no buttons) · `lock.swipe` → `lock.surface` · `nb.hint:<id>` → `nb.hint:<id>:<tier>` · `gallery.photo:<date>` → `gallery.photo:<id>` ·
`gallery.info` → `viewer.info` · `talk.room:<id>` → `talk.thread:<id>` · `end.chip:<id>` → `chip.opt:<id>` (the rest are kept as written).

### 7.5 §11.3 speedrun as selectors (Playwright outline — `tools/qa/ep3_speedrun.js`, core)
Plays `file:///…/ep3/index.html?debug=1` in Chromium ('iPhone 13' profile), real taps/holds/drags; `window.haru` only for time
acceleration while **waiting** (`haru.time(10)` → back to 1 before acting), Korean text (`haru.type`) and `haru.recRate` during
playback waits — **never** to set progress flags. "→ home" = `home.bar`; "back" = `nav.back`; `wait(flag)` = poll `haru.flags()`;
"cards" = tap `card.next` until `card` is gone. Asserts M0…M8, END, HOOK, §11.2 must-hold list and the series record; `--ep1=done`
and `--series=S5` variants check the callbacks. Exit 0 = pass with 0 pageerrors / console errors / failed requests.
1. `title.start` → `warn.ok` → `ear.ok` → `ear.start` (→ `recap.skip` if shown) → wait `M0` → wait `room.eye` → focus it, press
   `ArrowLeft` (eye view: no buttons — `[data-qa="room.eye"][data-view="r3_kitchen"]`) → `room.spot:mom` (`momLine1`, cards) →
   `room.spot:mom` ×2 → `room.spot:stove` (`soupSeen0`) → `room.spot:calendar` (`calSeen0`) → `ArrowRight` (`r3_door`) →
   `room.spot:hook` (`collarSeen`) → `room.spot:kongi` (`kongiTail0`) → wait `M1` → wait `callEnded` → cards (8) → wait `handover`
   → drag `lock.surface` up (`gotPhone`).
2. `easy.date` → `cal.prev` ×14 → `cal.day:2025-11-26` → `cal.event:1126` (`calCake`) → home → `easy.tile:settings` → `settings.search`
   (shell contract: the search screen opens with its in-game field focused, so `haru.type` lands in `G.ui.focusedField()`; results
   update per keystroke) → `haru.type('녹음')` → `settings.result:0` (the single easy row → `easyGate`) → back ×2 →
   `settings.row:display` → `settings.row:display.easy` → `easy.toggle` (`easyOff` → **M2**) → home → `home.folder` (`folderSeen`) →
   `home.folder.close`.
3. `home.app:phone` → `phone.menu` → `phone.menu.block` → `block.calls` → scroll to `block.row:12` (`blockBottom`) → back ×2 →
   `phone.tab:recent` → scroll to `phone.recent.row:sea-20251124-0331` (`missedSeen`) → wait `banner:N01` → tap → `chat.chip` →
   `chat.send` (`kang341Sent`).
4. `home.app:phone` → `phone.menu` → `phone.menu.rec` → `rec.item:sea0333` (`recPlayerOpened`) → `rec.more` → `rec.more.text`
   (`textOpened` `greySeen`) → `rec.line:21` → wait `sigName` (`nameKnown`) → `rec.line:30` → wait `radioHeard` → back (`mono1`) →
   `home.app:sms` → `sms.thread:kang` → `chat.chip` → `chat.send` (`kangBlockSent` — queued at step 3, ARCH §5.10 queue) → `chat.chip` →
   `chat.send` (`kangNameSent`) → wait **M3**.
5. `home.app:settings` → `settings.row:notif` → `settings.row:dnd` (`dndOpened`) → `settings.row:dnd.log` (`dndLogOpened`) → home →
   `home.app:gallery` → `gallery.tab:albums` → `gallery.album:shared` → `gallery.more` → `gallery.members` (`membersSeen`) → back →
   `gallery.photo:1130` → double-tap `viewer.img` + 1.6 s (`saw702`) → `viewer.info` (`bomSeen` → `albumDone`) → `viewer.close`
   (`mono2`) → home → `home.app:sms` → `sms.thread:kang` → `chat.chip` → `chat.send` (`kang702Sent`) → wait **M4**.
6. `home.app:camera` → `room.view:r3_door` → `room.spot:srdoor` (caption 1.2 s → sr, `where 'sr'`) → `room.view:r3_sr_bed` →
   `room.spot:frame` (`heightSeen`) → `room.closeup.close` → `room.view:r3_sr_desk` → `room.spot:orgel` → close → `room.spot:manual` →
   close → `room.spot:drawing` → `room.flip` (`drawingBack`) → close → `room.close`.
7. `home.app:phone` → `phone.menu` → `phone.menu.block` → `block.calls` → `show.btn` (`glasses` `momBlock`, cards) → back ×2 (C7 →
   C6 → phone) → `phone.tab:recent` → scroll to the 03:31 row → `show.btn` (`mom331`, cards) → `home.app:settings` →
   `settings.row:notif` → `settings.row:dnd` → `show.btn` → cards → `chip.opt:say` → `chip.send` (`momDnd` `dndChipSaid`) → cards →
   `home.app:gallery` → `gallery.tab:albums` → `gallery.album:shared` → `gallery.more` → `gallery.members` → `show.btn` (`momMembers`,
   cards) → back → `gallery.photo:1130` → `show.btn` (`momBom`, cards) — wait **M5** (finish before M6).
8. Close everything (no input, notebook closed) → wait **M6** (`bip`) → (cards advance by themselves — tapping `card.next` only speeds
   them up; the 지민 chip at t 18 must be answered inside its 20 s) → `home.app:camera` → `room.spot:srout` (lv) →
   `room.view:r3_door` (`view0AfterM6`) → `chip.opt:say` → `chip.send` (`jiminChipSent`) → wait `kang502` → `home.app:sms` →
   `sms.thread:kang` → `chat.chip` → `chat.send` (`kangAskSent`) → wait **M7**.
9. cards → `home.app:camera` (opens sr B) → `room.view:r3_sr_desk` → `room.spot:drawing` (`memoryStart`) → cards → wait `memoryDone`
   → wait **M8**.
10. cards → `chip.opt:yes` → `chip.send` → wait `playArmed` → `home.app:phone` → `phone.menu` → `phone.menu.rec` →
    `rec.item.more:sea0333` → `rec.more.text` → `rec.line:8` → wait `played` → `chip.opt:know` → `chip.send` → wait **END**
    (commit) → `chip.opt:eat` → `chip.send` → (tail) → `chip.opt:big` → cards → `end.next` (06:00 `[계속]`) → `credits.skip` →
    `check.continue` → wait **HOOK** → wait `[처음 화면으로]` → `hook.home` (`hookDone`, `vars.patched`) → assert series
    `eps["3"].st === 'done'`, `s.e3_played === true`, `s.e3_dnd === true`, six `seen.e3_*`, `sea ∋ 'sig_name'`, `s.e3_easyBack === true`.
`tools/qa/ep3_branches.js` (core, after the speedrun): climax 8 cases (§10 I) · 112 branches (§10 I V15) · M6 defer cases · name
fallbacks (`하루` `지은` `민준` one-syllable · 6-syllable · Latin) · reload at every §9.2 row · S1–S13 · less-scary + speaker run ·
`localStorage` blocked · text size 1.3 overflow sweep · two-finger pause vs pinch.

---

## ARCH §8 — Integration rules (all owners) · first boot · resume

### 8.1 Rules
1. Plain JS, one IIFE per file, `'use strict'`, attach to `window.G`; no ES modules, no bundler, no top-level `await`, no `fetch` of
   JSON/JS (file:// must work — TTS WAV decode may fail on file:// → subtitles + silent timers). Only network: the CDN fonts.
2. **Never edit a file you don't own** (ARCH §3.1). Need something from another owner? Stub-guard the call, implement a local
   fallback, and list it in your final report as `REQUEST to <owner>: …`.
3. **Stub-guard every cross-owner call** (`G.x && G.x.y && G.x.y()`, `G.hooks.call`, `G.STORY.k || {}`); a partial build (any subset
   of files) must boot to the title and not throw. No cross-owner calls at load time (app registration with `G.app` excepted).
4. Missing assets degrade gracefully (§9.8 table): `<img onerror>` → empty state / DOM text fallback (mandatory DOM fallbacks:
   `c3_manual`, `c3_drawing(_back)`, `c3_doorframe`, the calendar DOM, the ring screen); missing audio buffer → subtitles + silent
   timers (positions, line highlight and judging unchanged). No out-of-world error text — only real-phone empty states.
5. `node --check <file>` passes for every JS file you touch. File header comment lists: public API, bus events emitted/listened,
   hooks set/called, flags and vars you set, data-qa values, DESIGN §§ implemented.
6. Player-facing Korean strings only from DESIGN (⊕ included) or `G.e3.STR`; all through `G.T`; name tokens for 구/기관; gender-neutral;
   `{N가}`-style josa tokens. His one line tagged `his:true`.
7. Storage: only `haru-escape.ep3.save.v1` (core API), `haru-escape.settings.v1` (shared — `G.settings`), `haru-escape.series.v1`
   (`G.series`, only through `e3.js`), `sessionStorage['haru-escape.ep3.session']` (`G.e3.session`). Never read the ep1/ep2 saves
   (the engine backfill does). Saved strings are raw data / ids, never `G.T()` output; free text only in the session store (+ notebook
   memo). QA dump test with `테스트이름가` / `만든사람나` → 0 hits.
8. Timers: game logic on the core 250 ms tick / `clock:min` / `G.e3.sched` / director 1 s tick — no free `setInterval` for game time
   (callrec's 100 ms media-position poll and room/audio rAF while visible are the only exceptions). Everything pauses on
   `visibility {hidden}` and on the pause menu (`G.clock.pause()`).
9. Input: in-game keyboard only (`G.ui.field`, `predict:false`), never native `<input>`/`<textarea>`; keypads are the comms/easymode
   dial pads. Tap targets ≥ 44 px (easy mode: rows 64 px, tiles ≥ 120 px); text scale 0.9–1.3 (× 1.3 in easy mode) must reflow.
   Long-press reacts only on the notebook hint (2 s) — `contextmenu` blocked, `-webkit-touch-callout:none`, `user-select:none` on
   transcript/list rows.
10. Performance: ≤ 10 simultaneous HRTF panners (audio enforces; ≤ 6 low-end); decode only the visible view + 1 closeup + next view;
    free images unseen 20 s; rAF only while visible; CSS animates `opacity`/`transform` only.
11. Accessibility & less-scary: every informative sound has `G.audio.sub` (unless a card already says it); `G.e3.less()` variants per
    §6.1.8; reduced motion / reduced flash per §9.8.
12. ep1 must not regress (only `engine/series.js` is shared); ep2 must not regress (ARCH §4.1-9 gate).
13. No state-changing git commands; work only inside `work/ep3wt`; one Chromium per agent; close every browser/server you start.

### 8.2 First boot (no ep3 save)
| # | step | owner | detail |
|---|---|---|---|
| 1 | scripts load | all | data defined, apps registered, `gate.js` lets the page through (released / debug / preview) |
| 2 | `G.main.boot()` | flow | ARCH §5.1 init order; settings (`--ts`), `body.ep3`, preload `G.PRELOAD_GROUPS.title` then `start` (§9.8) |
| 3 | `G.e3.seriesBoot()` | core | §9.3 ① (`ensure` + `backfillEp1` → `cbPreview`, `ep3Done`) |
| 4 | title | flow scenes | `{N를} 위한 방탈출! 3` · `엄마의 번호` · [시작] (· [이어하기] · `훅 다시 보기` · `이번 선택을 이야기로 남기기` when applicable) · `약 45분 · 이어폰 권장` · `다른 이야기` (`G.gate.titleLink`) · in-app web-view card · **no `made by` line** (§0.3 D23) (12.7에서 삭제/변경 — `약 45분 · 이어폰 권장` 삭제 · `훅 다시 보기` → `06:10 다시 보기` · `이번 선택을 이야기로 남기기` → `이번 선택 남기기` · 데스크톱 안내 줄 삭제) |
| 5 | content warning [계속] | flow scenes | **`G.audio.unlock()`** here (gesture — the test bell must already play) |
| 6 | earphone test | flow scenes + audio | `bell.small` 270° → 90°; [들려요] / [스피커예요] (`audioMode 'speaker'`) / [안 들려요] or 8 s → sound card [다시 듣기] [소리 없이 할게요] → [시작] |
| 7 | [시작] | flow → core | `G.audio.unlock()` again (idempotent) + start TTS decode and the `rec.sea0333` render; `G.flag('introDone')`; `G.e3.seriesStart()` (cb frozen, `eps.3 started`); `G.clock.start()` |
| 8 | recap (only `cbPreview.E`) | flow scenes + core `G.e3.mono('recap')` | 4 lines on black, 3.2 s each, tap = next, `[건너뛰기]` → `recapShown` |
| 9 | cold open B01 | flow scenes | `M0` (clock 03:20) · 2 s black · layering 2/4/6/8 s · `G.room.eye({view:'r3_door', fadeMs:1200})` at 9.0 s · director `start()` · `flow:momLine1` sched |
| 10 | M0 eye view | room (+ flow) | captions/flags by room; `room:spot {id:'mom'}` → flow 엄마 cards; first 270° view → `momLine1` |
| 11 | 03:33 · 03:35 | flow call (+ room eye, shell E9, audio) | §3.1 table → `handover` → clock `03:35` → eye view closed (0.4 s) → `G.lock.show('n')` (easy skin) |
| 12 | gotPhone | shell lock | first swipe → `gotPhone` → easy home; show button appears (shell); notebook `엄마 폰` card (flow) |

### 8.3 Resume (§3.22 · §9.2 '다시 열기' · §6.1.8) — orchestrated by flow `G.main.resumeFrom(state)`
| saved state | resume | owners called |
|---|---|---|
| (every resume) | [이어하기] tap = `G.audio.unlock()` + `G.clock.start()`; house layers restored from `vars.au` (0.8 s fade); fired beats never replay | flow main, audio, core, flow director |
| no `introDone` | title (no 이어하기) | flow |
| `M0 ∧ ¬M1` | cold open from 03:20 with the 8 s layering; `momLine1` already on ⇒ the first line is skipped; M1 timing from `pm(M0)` | flow scenes, room |
| `vars.seq.m1` ∈ preroll/ring/call/03:34 | **03:35 handover cards from line 1** (the call never rings again); sets `callRing callAnswered callEnded` | flow call |
| `handover ∧ ¬gotPhone` | easy lock screen | shell |
| `gotPhone` (hub) | phone home (`vars.easy` → easy/standard); app stack not restored (home first, like ep1/ep2); `sched` continues in playMs (03:41, replies, M3–M5 spacing, album fallback, `e3:m6due`) | shell, core, comms |
| `M5 ∧ ¬M6` | same + M6 wait for the remaining time; the safe-zone defer restarts from 0 (≤ 40 s) | core, room door |
| `M6 ∧ seq.m6 < bip` | wait again from the start | room door |
| `M6 ∧ seq.m6 ≥ bip ∧ ¬M7` | **04:41 end state** (엄마 at the table · 콩이 at the door · 지민 awake · unsent 지민 chip → tail) → next card; '삐삐삐' and barks never again; the beat clock continues from `pm(M6)` | room door |
| `M7 ∧ ¬memoryStart` | sr B (엄마 at the bed end); `mem:early` / `mem:fb` keep their `pm(M7)` deadlines | room memory |
| `memoryStart ∧ ¬memoryDone` | memory cards from line 1 | room memory |
| `M8` | 엄마 at the table · `playArmed` kept · `playFails` kept · 240 s timer = `max(remaining, 120 s)` · `vars.play` dropped (new session) | room climax |
| `END ∧ ¬HOOK` | next tail card from `vars.endStep` (commit never doubled; retried if `¬committed`); a pending chip is shown again | flow ending, core |
| `HOOK ∧ ¬hookDone` | ending screen with `훅 다시 보기`; `¬patched` ⇒ boot patches from `stage` (§9.3 ⑤) | flow hook, core (12.7에서 변경 — 문구 `06:10 다시 보기`) |
| `hookDone` | title with `훅 다시 보기` · `처음부터` (confirm `{$restart3}` [취소] [지우기] → `G.resetSave()` + session store clear; the series record stays) | flow (12.7에서 변경 — 문구 `06:10 다시 보기`, data-qa `title.hookReplay` 그대로) |
Hidden tab: director · playMs · clock · audio stop (a playing recording pauses; the callrec session survives); on return 0.8 s fade in,
no text, no sting (§6.1.8).

---

## ARCH §9 — DESIGN gaps / contradictions found, and how this contract resolves them
| # | issue (DESIGN refs) | resolution here |
|---|---|---|
| G1 | §9.1 engine table says `director.js` "변경 0 — alias", §6.1.1 and §0.3 D41/Q18 require four data options (`zones` `ambience` `microActive` `microForbidden`). | Director gets data-gated options (ARCH §4.2 · §5.16) **and** the alias `G.BEATDATA2 = G.BEATDATA3`; absent options ⇒ ep2 behaviour. Added `safeKinds`, `microGap`, `vignette`, `midnight`, `targetT` (needed for §6.1.3/§6.1.5 values that differ from ep2). |
| G2 | Directive: "move ep2-specific engine names (`G.e2.STR` …) to episode-common names — ARCH_EP3 decides". | **Additive alias, no rename:** `G.ep = G.e2 = G.e3` on the ep3 page; `ep2/js/e2.js` untouched; new engine code reads `(G.ep || G.e2)`. |
| G3 | §6.1.3 uses `G.cards.showing()` and `G.chips.open()` (S7/S8) but no section defines a card/chip module; ep2 cards were private to `ending.js`. | New core file `ep3/js/cards.js` (`G.cards`, `G.chips`, ARCH §5.6) used by six owners. The S8 predicate is `G.chips.isOpen()` (DESIGN's `open()` would read as "open a sheet"). |
| G4 | Settings search rows have two schemas: §5.4 (`easy:'gate:rec'|'gate:spam'|'full'|'hide'`) and §9.5-2 (`r.app`, `open:'easyGate:'+r.app`). | One schema (ARCH §5.21): `{kw, title, where, open, easy}`; `easy:'gate:*'` = easy-only row opening that gate, `'hide'` = standard-only row (rerouting one row cannot reproduce §4.7.1, whose easy and standard result lists have different titles). |
| G5 | §9.1 `G.EP.HOME` getter with `widget:'bigclock'`, a folder item and "엔진 변경 0" — the engine `renderHome` knows neither a custom home, folders, nor a calendar-opening widget. | Additive shell changes in `engine/core/phone.js`: spec `render(homeEl, api)`, `{folder, apps}` items, `widgetOpen` (ARCH §4.2). The getter stays in `config.ep3.js` (core). |
| G6 | The engine `lock.js` sets `M1` on the first unlock; in ep3 `M1` is the 03:33 ring (§2.1) and the first unlock is `gotPhone`. | `G.EP.LOCK.firstFlag = 'gotPhone'`; the lock is shown once and never relocks (§0.3 D42). |
| G7 | Status bar hard-codes `SIM 없음`; QS hard-codes Wi-Fi · BT · flash + user row (engine). §3.2.1 / §5.3 need `LTE` · `집` and the 소리 / 방해 금지 tiles. | Shell honours `G.EP.STATUS` and `G.EP.QS.tiles` (data-gated). |
| G8 | `G.phone.notify` detects "chat open" with `G.moment.isOpen` (not loaded in ep3) and mutes on `vars.dnd`, while §2.5 names the DND switch `vars.dndNow`. | Hook `chat:isOpen` (comms) consulted first; mute on `vars.dnd ∨ vars.dndNow`. |
| G9 | §5.3 / §0.3 D37 put the call simulation in "core `G.phone.callScreen`", which does not exist; ep1's `P.callScreen` is not in the engine. | Shell adds `G.phone.callScreen` / `inCall` to `engine/core/phone.js` (it owns that file); the result scripts are comms data (`G.STORY.dial.results`). |
| G10 | DESIGN class names `.fl3-card` / `.fl3-show` would put core/shell code under the flow prefix. | Renamed `.c3-card` (core) and `.sh3-show` (shell); z values unchanged (150 / 60). |
| G11 | `vars.dir.fired`: §2.5 object vs §9.2 `[]`; the engine stores `{id: playMs}`. | Engine form `{id: playMs}`; `vars.dir.dropped` keeps the engine form too (`{id: playMs}` — `engine/director.js` l.59 creates `{}` and writes `d.dropped[b.id] = p`; an array would lose those keys in JSON). Dropped mono ids are written there by core and listed in `vars.e3.dropped`. |
| G12 | §9.2 `vars.room.view: 'lv_0'` vs view ids `r3_door` …. | `vars.room = {room:'lv'|'sr', view:'r3_door', closeup, st:{…}}`. |
| G13 | `G.callrec.play` options differ (§5.5 `{by, line, offset}`, §9.6 `{from, by, line}`, C5 `{from:'line', line}`) and `pushMsg` vs `pushMessage`. | `play(id, {by, line, at})`; `from` is reserved for `G.media` (`'callrec'`); `pushMessage`. Added `sinceStopMs()` for S4's "+2 s". |
| G14 | ep2 `G.media` knows `from` = recorder/gallery/voice and routes bt/phone; ep3 needs ear/table. | `from:'callrec'` + `G.EP.mediaRoute()`; `btOn` default false. `engine/core/media.js` moves to audio (it is now a chain/route concern). |
| G15 | §11.4 data-qa proposals collide with engine-rendered elements (`lock.swipe`, `talk.room:<id>`, `earphone.ok` …). | Engine values kept; mapping table ARCH §7.4. |
| G16 | `G.STORY.recordings` (ep3 array) shares a key with the ep2 object read by `engine/apps/gallery.js` (`outBt`) and `recorder.js`. | Key kept (DESIGN §9.6 name): recorder.js is not loaded; gallery's read falls back to its default. |
| G17 | `A.tension` starts the drone after M1 and `A.amb` knows only ep2 ids; ep3 wants tension → `amb.air` only and no drone. | `A.TENSION_AMBS`, `A.defineAmb`; director `ambience.drone:false`. |
| G18 | The engine greys unfinished cards after M7 (`grayAfterM7`); ep3 greys `block dnd album` after **M8** (§2.4). | Objective option `greyAfter:'M8'`. |
| G19 | `titleExceptions = ['call','phone','soup@gotPhone']` — the engine has no such check (ep2's check lives in flow `main.js`). | flow `main.js` runs the DEBUG title auto-check and interprets `@gotPhone`; the engine ignores the list. |
| G20 | Who sets M6 / M7 / M8 (§9.1 files vs §2.1 formulas). | core emits `m6:due` at M5 + 60 s (ep2 pattern); room `door.js` defers (S1 S2 S4 S7 S8 S9 · ≤ 40 s) and sets `M6`, then `M7` at `pm(kang502)+45 s`; room `memory.js` sets `M8`; core sets `M6` only as the fallback. |
| G21 | The M8 entry cards and `playArmed` have no file (§9.1 lists `climax.js` as "판정"). | room `climax.js` owns M8 entry → `playArmed` → judging → result. |
| G22 | END: the climax decides, the ending draws the 05:30 line where END + commit must happen. | Hook `end:start({by})` (flow); `END` and `G.e3.commit()` in the same function that draws the line (§9.3 ④). |
| G23 | `vars.momAt` changes at handover (flow) and at 04:40:11, 04:41, M7, M8 (room). | Single writer function `G.e3.momAt(v)` (core); callers listed (ARCH §5.3). |
| G24 | `dndChipSaid` is set by the show reaction (shell) and by the tail chip (flow). | One owner: `G.show.dndChip({ctx})` renders the chip in both places and sets the flag. |
| G25 | The 05:02 SMS is a beat time (door) but its content and flag are messaging (comms). | `G.sms.deliver('k0502')` called by `door.js` at t 176; comms sets `kang502`. |
| G26 | `call112First` (§3.2.3 · V15) has no setter. | comms phone app at the 112 result ② (`bip ∧ ¬jimin112`). |
| G27 | mono1/mono2 triggers live in comms/media screens, the queue in core. | Bus `rec:text {id, open:false}` and `gallery:photo {door:true, open:false}`; core queues (M6 window rule D4 in core). |
| G28 | §11.2 asserts `M5 ≤ TB + 180 s`, false for a fast player who already finished the album (M5 waits `pm(M4) + 120 s`). | Assertion becomes: `¬albumDone at M5 ⇒ pm(M5) ≤ max(TB + 180 s, pm(M4) + 120 s) + one tick`; `albumDone ⇒ pm(M5) ≤ max(t(hubK=3), pm(M4) + 120 s) + one tick`. |
| G29 | Between the 03:35 cards and `gotPhone` the clock is in the M1 `'card'` row (03:34 after `callEnd`), but the lock shows `3:35`. | `call.js` calls `G.clock.jump('03:35')` at `handover` (forward only; the `gotPhone` row then runs from 03:35). |
| G30 | The tail times 05:35 · 05:40 · 05:55 · 06:00 sit in the END `'card'` row. | ending calls `G.clock.jump('05:35')` … at each tail step; window lights are derived from the clock (room); HOOK row is fixed 06:10. |
| G31 | §9.1 lists `G.e3.layers(view) · grade() · led()` (room state) inside core's facade. | room owns the values (`G.room.state()`); `G.e3.*` are thin delegations. |
| G32 | §9.1 lists only `ep3.css · easy.css · callrec.css`. | Added `core3.css` (cards) · `media3.css` · `room3.css` so CSS files stay owner-disjoint. |
| G33 | Engine CSS styles for ep2 widgets live in `ep2/css/*` (§0.3 D35). | ep3 links them read-only; overrides only in ep3 files; engine CSS edits only under `body.ep3`. |
| G34 | The engine's iOS vibrate fallback is a 2 px shake — forbidden in ep3 (§9.7 · V10). | `G.EP.noShake` honoured by `G.audio.vibrate` and `G.fx.edgeShake`; ep3 vibrate keys `ring3` `sms` only. |
| G35 | `G.audio.buffer` resolves only `v2_` voices and the ep2 render table. | `defineBuffer` + `/^v\d+_/` voices (audio). |
| G36 | §11.4 `haru.time('04:39')` (clock) vs ep2 drivers' `haru.time(scale)`; §11.4 also has `speed(10)`. | `time(number)` = scale (driver compatible), `time('HH:MM')` = forward jump, `speed()` alias. |
| G37 | §6.1.3 S8 "칩 시트" vs §9.5-4 "03:41 · 강수진 칩은 입력칸 위 칩이라 시간 제한 0(시트가 아니다)". | Only `G.chips` sheets count as S8; the 강수진 input-bar chips are `G.chat` chips (comms) — S1 applies while editing. |
| G38 | §2.6 widget date tap → calendar, engine widget → clock app. | `widgetOpen:'calendar'` (STD) and the easy big-clock date line `easy.date`. |
| G39 | The engine keyboard draws an (empty) predict bar for any field unless `predict:false`. | `G.EP.KBD.predict = false` default (core keyboard). |
| G40 | E5 (easy SMS) is module ①'s screen but the thread, chips and replies are comms'. | `G.sms.renderThread(node, id, {big:true})` (comms) inside the easymode screen. |
| G41 | `phone.recent` reacts only "when the 03:31 row is on screen" — no API. | `data-row="sea-20251124-0331"` (comms) + ≥ 60 % in-viewport test in `show.js`. |
| G42 | `G.IMGMETA` is nested per image in ep3 (§8.3-9), flat in ep2. | ep3 consumers read the nested form via `G.ROOM.meta(img, key, default)`; ep2 code untouched. |
| G43 | §10 A lists system strings but gives no keys; ep2's `STR` keys (PIN, SIM-less …) would leak ep2 texts. | ARCH §5.3 names the keys; ep2-only keys are not ported (a fallback string surfacing is caught by the whitelist scan). |
| G44 | The speedrun must play the 33 s recording several times; `haru.time` scales playMs, not media time. | DEBUG `haru.recRate(x)` drives the silent timer (same sessions/events). |
| G45 | The engine `G.media.init` defaults `vars.btOn = true`; ep3 has no Bluetooth output (§5.0-2 ⑥). | core `G.applyVarDefaults` sets `vars.btOn = false` (and `G.EP.DEFAULTS.btOn:false` documents it); no BT UI anywhere. |
| G46 | `hookDone` is set inside `E3.hookPatch` (core code, §9.3 ⑤) but the hook belongs to flow. | Setter = core function, called by flow `hook.js` (listed in ARCH §5.4). |
| G47 | Director's B07 midnight compensation and 'dir:B07' sched are ep2-only. | `BD().midnight = false` (never crosses 00:00 anyway). |
| G48 | `G.STORY.names.daejeon` is used by the weather page. | Data writes `{daejeon}`; the literal `대전 서구` appears only in `config.ep3.js`. |
| G49 | §2.4 `easy` / `rec` cards appear "when the 03:35 card is drawn" — the notebook cannot see card text. | flow writes `vars.fl.cardsDrawn[stepId]` for the handover steps `easyCard` / `recCard`; objectives read it. |
| G50 | `engine/apps/mail.js` was social's in ep2; ep3 has no social owner. | media owns it (read-only folder inbox); comms carries `talk.js` + `sms.js` (both use `G.chat`). |
| G51 | Engine `lock.js` computes the first unlock as `flag('gotPhone') && !flag('M1')` and marks `'B03'` — in ep3 B03 is flow's preroll, the lock beat is B07 (`ui.unlock`). | `first = !flag(G.EP.LOCK.firstFlag)`, `mark(G.EP.LOCK.beat = 'B07')`, cue `G.EP.LOCK.cue = 'ui.unlock'` (ARCH §4.2 · §5.2). |
| G52 | `G.applyVarDefaults` "sets stage when missing" — but engine `fresh()` always passes ep2's `freshStage()`, so the ep3 save would carry `e2_*` stage keys and no `e3_*` defaults. | Replace `st.stage` unless it already owns `e3_played`; flags.js also runs it once at load on the existing `G.state` (ARCH §5.4). |
| G53 | `vars.dir.dropped` was specified as an array; the engine creates `{}` and writes `dropped[id] = pm` (an array would lose those keys in JSON). | Object form; core writes dropped mono ids into it; no `G.director.dropMono` (ARCH §5.3 · G11). |
| G54 | Engine `A.prepare()` (spatial.js onReady) renders ep2 `rec.uri vid.move vid.roof ringHaru7`, fetches `v2_kang_door v2_him_breath` + jiminVM, and `flag:END` renders `hook.seahY` — on the ep3 page: wasted CPU and 404 requests (speedrun "0 failed requests"). | `A.definePrepare(fn)` replaces the ep2 list and skips the END render (audio · ARCH §4.2). |
| G55 | ARCH §1 allows exactly two vibration patterns, but the engine also vibrates on every key press (`keyboard.js` 5 ms), on hint reveal (`notebook.js` 20 ms), on pin/fingerprint widgets, with notify keys `n`/`him`, and on iOS synthesizes a low buzz + 2 px shake. | `G.EP.VIB = ['ring3','sms']` allow-list honoured by `G.audio.vibrate`, keyboard and notebook; iOS + `noShake` = nothing; notify uses `G.tones.vibKey` (ARCH §4.2 · §5.17). |
| G56 | §4.13: DND `지금 사용` → no banner and no sound; every N row rings. The engine notify only mutes the sound and turns the 4th+ tone of a chat into vibrate-only. | `vars.dndNow` suppresses the banner (panel + badge only); `G.tones.cap === 0` skips the cap (ARCH §4.2 phone.js (h)). |
| G57 | `G.media.startAt()` wires only `'phone'`/`'bt'` gains (+ 0.2 s delay) and reroutes only on BT events — an `'ear'|'table'` target would be silent and the sr→lv / `playArmed` change would never crossfade. | One gain per route kind, no delay, reroute on `room:where` · `flag:playArmed` (inert without `G.EP.mediaRoute`) + `media:out` (ARCH §4.2). |
| G58 | Director hard-codes `zoneBlocks()` (ep2 climax exception), knows no `where:'lv'|'sr'`, has no micro `once/when/where` filter or S1–S9 skip, cannot repeat a world sound (W01 · W03 run every 25–140 s), and follows its own M7 tension curve; §6.1.5 needs 4 s / 3 s convergences and END/less vignette values. | Options `safeKinds` (also replaces `zoneBlocks`), micro record fields + `safeKinds.micro`, `loops`, `targetT → {T, ms}`, `vignette(T)`, beat `where:'lv'|'sr'` (ARCH §4.2 · §5.16). |
| G59 | W12's second bus "05:52" is tied to a tail line; the END `'card'` clock row holds 05:40 until ending jumps to 05:55, so no clock rule can fire it. | `ending.js` plays it 2 s after the t0540 지민 line and marks `W12b`; W12 (05:40) stays a director beat (ARCH §5.16). |
| G60 | `G.EP.KBD.predict = false` was a default only; the engine `settings.js` search field passes `predict:true` explicitly, which would still draw the bar. | `predict === false` forces the bar off for every field (ARCH §4.2 keyboard). |
| G61 | §6.1.3 S1 includes "키패드 숫자 · 차단할 번호 입력", but `G.ui.inputActive()` sees only the keyboard and `G.ui.pinPad` (a PIN pad hides digits — unusable as a dialer). | Core `G.ui.inputSource(fn)`; comms/shell keypads register (ARCH §4.2 widgets). |
| G62 | §4.7.1 shows different result titles per mode (`통화 자동 녹음 — 전화` easy vs `통화 녹음 — 전화 설정` standard); the first schema rerouted one row and would show the easy title in standard mode and a 4th `차단` row. | `easy` = mode selector (`gate:*` easy-only · `hide` standard-only) + both keyword groups on every row of the group (ARCH §5.21 · §6.6). |
| G63 | Cards: "tap = next" vs timed set pieces (04:40 t-table, tail "[계속] 0") — whether a card waits for a tap was undefined; full-width story cards (z 150) would also cover ✎ (z 60) although the notebook must open during 03:33 / 04:40 / climax. | Auto-advance after `gapMs`, tap skips; story cards bottom-anchored, layer `pointer-events:none`, top 56 px free (ARCH §2.3 · §5.6). |
| G64 | Eye views draw no buttons (§2.6), but the selector speedrun needs to rotate M0 and assert the current view. | `room.eye` / `room.camera` roots with `data-view`; eye views rotate with drag or ←/→ (desktop parity §9.5-5); `room.view/next/prev` only in camera mode (ARCH §5.12 · §7.4). |
| G65 | The lock `긴급 통화` keypad (comms) and the call screen (shell) were both put on z 47 under one shell row. | `.cm3-emerg` z 46 (comms) below `.sh3-call` z 47 (ARCH §2.3). |
| G66 | Handover → `G.lock.show('n')`, but the 03:35 eye view (z 45) sits above the lock (z 30). | `call.js` closes the eye view (0.4 s) before showing the lock (ARCH §5.13 · §8.2). |
| G67 | Climax head rule `head && e.b >= 0.9` reads `b`, but `rec:session` fires only on state changes — the turn-away would come only at the session's end. | `rec:time` carries `{a, b, out, away}`; climax runs the head check on it too (ARCH §5.10 · §5.13). |
| G68 | callrec screen ids (`block.calls` `block.call` `block.msgs`) differ from the §5.8 `data-scr` keys the show table uses (`callrec.blocked` `callrec.blocked.number` `callrec.blockedMsgs`); the 03:31 row id existed only in recents although `phone.contact.sea.log` reacts too; other recents had no id for `phone.recent.row:<id>`. | Mapping table + data-row in both screens + recents id rule (ARCH §5.10). |
| G69 | The `통화 자동 녹음` / spam switches "really move" both on the easy gate (shell) and on C2 (comms) — no shared state, no setter. | `G.callrec.setting(key, v)` (comms) = only writer of `vars.recAuto · spamSw · unknownBlock`; shell E6 calls it (ARCH §5.4 · §5.8 · §5.10). |
| G70 | Easy-phone calls (E3) would need their own copy of the §3.2.3 result logic (flags, `call112First`, kcall); §3.2.3 "03:41 전이면 03:41 문자가 그 자리를 대신한다" had no owner. | Every call goes through `G.phoneApp.dial(…, {from})`; `kcall` only when `kang341` is on (ARCH §5.8 · §5.10). |
| G71 | 강수진 later chips: "생긴 순서대로 한 번에 하나" did not say whether a chip whose fact was seen before 03:41 queues, nor where k341 sits. | Queue rule in ARCH §5.10 (nothing before kang341, k341 head, then flag order); speedrun step 4 corrected (kblock before kname). |
| G72 | ARCH listed `sms files weather` as new icon keys; the engine already defines them. | Reuse the existing keys; add only the others (ARCH §4.2 icons). |
| G73 | §9.1 says `e3.js` registers the apps `moim voicerec files weather`. | Registered by the owners of their screens: `moim files weather` media (`browser.js` from `G.STORY.browserApps`), `voicerec` comms (`callrec.js`) — ARCH §5.2 app-id list; core registers no app. |
| G74 | `[400,200,400]` at 03:33 (§7.1.7 "1회") had no caller in the cue table. | flow `call.js` at t 0.0, once, via `G.audio.vibrate('ring3')` (ARCH §5.13 · §5.17). |
| G75 | The shape of the SMS notification comms hands to shell (id, chat key, route) was implicit; easy-mode tap routing needs the thread id. | Fixed spec in ARCH §5.7 (`chat:'sms:kang'`, `route:{app:'sms', params:{thread:'kang'}}`, ids N01…N09/N02p). |
| G76 | ARCH §7.5 speedrun had missing navigations (home → sms in step 5, back ×2 out of C7, the shared-album path in step 7), no folder close selector, and `room.view:*` taps in eye views. | Steps 1 · 2 · 4 · 5 · 7 · 8 rewritten with existing selectors (+ `home.folder.close`, `room.eye`). |

---

## ARCH §10 — Acceptance checklist per owner (abridged; full list = DESIGN §10)
- **core**: `config.ep3.js` = §9.1 + ARCH §5.2; `G.e3` facade covers every engine read (ARCH §4.3) — ep3 boot with only engine + core
  files reaches the title without errors; series diff = 3 lines + ep2 S1–S10 + ep1 END + picker + ep3 S1–S13; `cb` frozen at
  `introDone`; commit once (+ ≤ 5 retries); hookPatch soft rule; hub rules (M3/M4/M5 ≥ 120 s spacing, album fallback, G28 assertion);
  M2 on easyOff; `m6:due` at M5 + 60 s; mono M6 window; battery decay; `G.cards` S7/S8 + M6 force-close; `grep "G.series" ep3/js` =
  `e3.js` + `gate.js`; gate fails closed; root picker 702 window + second building (ep2 villa unchanged); speedrun + branches drivers;
  `applyVarDefaults` leaves no `e2_*` key in a fresh ep3 save; `vars.dir.dropped` is an object; keyboard draws no predict bar for
  any field and no key haptic; `G.ui.inputSource` makes S1 true while a keypad holds digits.
- **audio**: every cue of ARCH §5.17 audible at its §7.1.2 place for L0/LS/LT; master ≤ −14 dBFS; no +18 dB/50 ms rise (§6.4-③);
  `rec.sea0333` self-check (§7.2 F); name fallback for `하루 지은 민준` + 1/6 syllables + Latin; ear/table chains + ducking; speaker
  mode + less-scary tables; house layers survive reload; resume chip; ep2 regression green after the engine registrations;
  ep3 page makes **0** requests for `v2_*` files and renders no ep2 buffer (`definePrepare`); `navigator.vibrate` is called only with
  `[400,200,400]` / `[80]` (spy in the speedrun); iOS emulation (no `navigator.vibrate`) → no `c2-shake`, no buzz; a recording
  started in sr keeps playing and crossfades to `'table'` within 80 ms on `room:where 'lv'` after `playArmed`.
- **shell**: easy ⇄ standard 4× → `easyOff` once, hidden set identical; easy search `녹음`/`차단` → one gate row each (no list DOM);
  standard search → callrec screens; `dnd`/`dnd.log` (365 rows + foot); QS 4 tiles (no BT/user row), DND long-press → `dndOpened`;
  status bar without `SIM 없음`; call screen (cell/talk/emergency/big) + S9; notify ids N01–N09/N02p, grouping, DND/sound muting,
  chat-open pop; DND `지금 사용` → no banner/sound (panel + badge only); vibrate mode → `[80]`; no vibrate-only cap; easy lock sets
  `gotPhone` (never `M1`) and marks `B07` (never `B03`); show button fixed, dim/inert rules, position cards, every reaction of §4.10,
  `glasses`, `showSeen`, M6-aborted chains not seen; ep2 regression green.
- **comms**: callrec §9.6 ② unit tests (line seeks · `sigName` before/after `playArmed` · ▶ 33 s → `nameKnown` w/o `sigName` · scrub
  21.5 → no `heard21` · pause 14 s same session / 16 s abort · bottom row 60 %/200 ms · silent-timer parity · **sea0333-only flags**
  with 지민 1/10 and 박 권사님 0:21 rows); two menus to the transcript; 13 rows with years; number detail 2 rows; recents 03:31 row +
  `missedSeen`; simulation results incl. the four 112 branches and power-off text; 강수진 thread + chips + replies + keep + free text;
  talk `세아 💛` room (folds, A/A′/A″ variants, '1' never changes, input rules, voice-talk dial); ep2 regression green;
  callrec `data-scr` = the ARCH §5.10 mapping; `rec:time` carries `a b out away`; chip queue order of ARCH §5.10; `kcall` never before
  `kang341`; every dial (standard · lock · easy) through `G.phoneApp.dial`; `G.callrec.setting` shared with the easy gates.
- **media**: grid 3,041 (dated photos once, 72 variants); shared album members/activity/info/ⓘ; `membersSeen` three paths;
  `bomSeen` only on door photos; `saw702` 1.8×/1.5 s or full 3 s; `gallery:photo` events for mono2; calendar multi-year + repeats +
  `calCake` (no 'created' row); moim/files/weather pages; folder apps; ep2 regression green.
- **room**: two rooms, yaw incl. the 6° door plate, `go:` hotspots with the first-tap caption rule (≥ 44 × 120 px, wins over 콩이);
  every §6.3 layer live and "people leave, not vanish"; eye API (M0, 03:33 cuts, END cut, settle cut, hook cut, screen node);
  04:40 ledger timings (§6.2) + M6 defer + forced close + reload rows; memory paths (any closeup · memEarly 30 s · 150 s fallback);
  climax 8 cases (§10 I) incl. the away session and a head session turning 엄마 away at b ≥ 0.9 (not at its end); `e3_played`; DOM
  fallbacks for manual/drawing/doorframe; eye views rotate with ←/→ and expose `room.eye[data-view]`; ep2 regression green.
- **flow**: title/warning/test/recap/pause strings; cold open + 03:33 second-by-second timings; handover cards create `easy`/`rec`
  cards; notebook show/done table + titles auto-check + `greyAfter M8`; director zones/defer/tension/micro + W05/W11/W12 with jump
  compensation; END order (END line = commit), tail variants (B/C, 강수진 relay, DND/album facts, easyBack chip), credits, check card,
  hook sequence (sting in the same frame, `[처음 화면으로]`, patch); resume table ARCH §8.3; the ARCH §7.5 speedrun passes end to end;
  director options of ARCH §4.2 inert on ep2 (ep2 speedrun + branches green); W01/W03 loops, W12 + W12b; no `B07` mark before
  `gotPhone`; notebook hint reveal without haptic; the handover closes the eye view before the lock shows.
- **all owners**: z values of ARCH §2.3 only; every layer that consumes Android back registers `G.phone.pushBack`; `node --check`;
  headers list API/events/flags; no file outside your column of ARCH §3.1 changed.

