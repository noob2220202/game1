# 하루를 위한 방탈출! — Implementation contract (ARCH)

Design source of truth: `docs/DESIGN.md` (copy of final design). This file = how the code is organized,
who owns which file, and the exact cross-module APIs. **Do not edit files you don't own.** If you need
a core change, implement a local helper in your own module and mention it in your report.

Stack: plain browser JS (no modules, no build), every file is an IIFE that attaches to `window.G`.
Load order is `index.html`. Everything must work from `file://` and from HTTPS (Caddy). No runtime network
except fonts. Korean player-facing text. Use `G.T(str)` for any string containing `{N}` tokens
(`{N}` name, `{N야}` vocative, `{N가}`, `{N는}`, `{N를}`, `{N랑}`, `{N의}`). The design doc writes `{NAME}`;
in code use `{N}` / `{N야}` etc.

## Existing core (read these first)
- `js/core/base.js` — `G.util` (`el`, `sleep`, `pad`, `normalize`, `fmtKTime`, `fmtKDate`, `hangulToQwerty`),
  `G.bus` (on/off/emit), `G.state` (saved), `G.flag(name[, value])`, `G.vars(k[, v])`, `G.save()`,
  `G.settings`, `G.clock` (game clock).
- `js/core/audio.js` — `G.audio` (`unlock`, `sfx.*` cues, `amb(name,on)`, `tension(x)`, `playBuffer`,
  `renderBuffer`, `spectroText`, `paint.*` raw-buffer painters, `ringtone`, `ringback`, `musicBox`, `speak`).
- `js/core/fx.js` — `G.fx` (`glitch`, `shake`, `flash`, `static`, `jumpscare(src)`, `sub(text, ms)`, `cinema()`,
  `setTitle`, `blinkTitle`, `setFavicon`).
- `js/core/phone.js` — `G.app(id, def)`, `G.phone` (`openApp`, `push(node, opts)`, `pop`, `back`, `home`,
  `overlay(node, opts)`, `dialog({title,text,buttons})`, `toast`, `notify({app,title,body,route,cls,tone})`,
  `callScreen({...})`, `setLocked`, `statusTheme`), `G.ui.screen({title, sub, right, body, theme, cls})`, `G.ui.list([...])`.
- `js/core/widgets.js` — `G.ui.pinPad`, `G.ui.patternLock`, `G.ui.zoomViewer(src,{maxScale,onChange})`,
  `G.ui.spectrogram(canvas, analyser, opts)`, `G.ui.waveform`, `G.ui.typing()`, `G.ui.onLongPress(node, fn, ms)`.
- `js/core/keyboard.js` — in-game keyboard: `G.ui.field({placeholder, password, showJamo, mode:'ko'|'en', onSubmit, onChange, maxLength, submitLabel})`
  → `{node, value, set, focus, blur, clear}`. Password fields force English layout. NEVER use native `<input>` for
  story text entry on mobile (notebook digits may use the in-game field too).
- Generic apps already implemented (data-driven): `js/apps/{talk,sms,phone,gallery,camera,memo,browser,mail,calendar,clock,recorder,moment,settings,lock}.js`.
  Read them before extending.

## Core extensions provided by LEAD (being added now — code against these signatures)
### Flags & progress (`js/core/base.js`)
- Milestone flags: `M1` (unlocked), `M2` (memo undone → hub), `M4` (해솔홈 login), `M5` (screen share cut),
  `M6` (device blocked + protected), `M7` (door code accepted), `M8` (비상벨), `END`.
- Fragments: call **`G.foundFragment(id)`** with id `'47' | '29' | '06'`. It sets flag `frag47` etc., increments
  `G.fragCount()` (0..3), sets `F1/F2/F3` flags, fires relief audio, emits `'fragment'` `{id, count}`. Idempotent.
- `G.mirroring()` → bool (true from M1 until M5). `G.setMirroring(false)` only by LEAD's cut logic (call `G.cutMirroring()`).
- Hooks registry: `G.hooks.set(name, fn)`, `G.hooks.call(name, ...args)` (returns fn result or undefined). Used for
  cross-module calls listed below.
- Clock: `G.clock.now()` follows the milestone model (design §2.1). `G.clock.freeze(h, m)` / `G.clock.unfreeze()`.
  Battery: `G.phone.battery()` (milestone model). Don't set these yourself except via the APIs.

### Audio (`js/core/audio.js` + `js/core/spatial.js`)
- World azimuths (deg): door 0, bed 90, window 180, wardrobe 270. **`G.audio.at(az, {dist, closet})`** → an AudioNode
  input for a room-anchored 3D source (HRTF panner, or StereoPanner in speaker mode). Many `sfx` accept `{az}`.
- `G.audio.setYaw(deg)` — LEAD calls this from room view; room owner may call it on drag/gyro.
- Message tones: `G.audio.sfx.msgFriend()`, `.msgMom()`, `.msgHim()` (HIS conditioned tone — use ONLY for him),
  `.msgAlbum()`. Chat push accepts `opts.tone: 'him'|'mom'|'friend'|'album'`.
- `G.audio.setMono(bool)`, `G.audio.isMono()` — master mono bus (모노 오디오 setting).
- `G.audio.gsm(p)` — GSM buzz proximity 0..1 (0 off). `G.audio.silenceDrop(ms)`, `G.audio.fridge(on)`,
  `G.audio.hearingLoss(sec)`.
- `G.audio.musicBox({variant:'live'|'fragment'|'winddown'|'warm'|'plain', az, closet})` → `{stop()}` (design melody).
- Door lock: `G.audio.doorKey(digit, {outside})` (C-major table: 1=C5 … 7=B5, 8=C6, 9=D6, 0=E6),
  `G.audio.DOORKEY_HZ` table; `sfx.doorlockOpen()`, `sfx.doorlockAutolock()`, `sfx.doorlockAdmin()`, `sfx.doorlockError()`.
- New sfx (all accept optional `{az}`): `alarmTrap, mfaAlert, batteryLow, castEnd, keyErase, rackFall, bedCreak,
  footsteps(n,{az,toAz,gap}), breathNear(sec), doorguardClank, scrape(speed0..1), doorSlam, sensorLight, sirenWallpad(sec),
  paChime, neighbors, policeKnock, sirenPolice(sec), stingJS1, stingJS2, boiler, elevator, creakWardrobe, panelSlide,
  knock(n,{az, where:'inside'|'behind'|'player'})`, `ringMom()`→stopper, `ringHaru({az})`→stopper, `buzzWood({az})`→stopper.
- `G.audio.voice(id)` → Promise<AudioBuffer|null> for TTS files in `assets/audio/` (`v_sea_mono, v_him_shh, v_him_ear,
  v_poweroff, v_pa, v_police, v_neighbor`). Play via `G.audio.playBuffer(buf, {bus:'voice', ...})`. Always subtitle.

### Phone (`js/core/phone.js`)
- Status bar shows `SIM 없음`, Wi-Fi, **cast icon** while `G.mirroring()`.
- Quick panel (pull down / tap status bar) — owned by LEAD; tiles: Wi-Fi, 블루투스, 손전등, 모노 (after `monoSeen`),
  방해 금지, + 화면 공유 card while mirroring.
- `G.phone.notify({... tone})` plays the given message tone.

### Notebook API (implemented by agent "memo-notebook-recorder"; others just call it)
- `G.notebook.note(text)` — add an auto-note (deduped).
- `G.notebook.lead(id, text)` / `G.notebook.leadDone(id)` — open-leads list.
- `G.notebook.flash(text)` — briefly show handwriting overlay (used in climax).
- `G.OBJECTIVES` array (same file) — design §3 objectives + 3-tier hints.

### Cross-module hooks (name → owner implements; callers use `G.hooks.call`)
| hook | owner | called by |
|---|---|---|
| `talk:call(threadId)` | room-climax (H6) | talk app 📞 button in `{N}` thread |
| `door:keypad()` → opens keypad close-up | room-climax | room door hotspot |
| `door:codeAccepted()` | room-climax (P8) | keypad |
| `haesol:openBell()` → show 비상벨 red + wait hold | haesol | climax step 9 (returns Promise resolved when held) |
| `gallery:addSharedFace()` | haesol-gallery | LEAD director at M5+30 s |
| `memo:startErase()` | memo agent | memo app itself |
| `room:refreshLayers()` | room-climax | LEAD director after layer-relevant flags |

## File ownership
| Owner | Files |
|---|---|
| **LEAD** | `index.html`, `css/main.css`, `js/config.js`, `js/core/*`, `js/main.js`, `js/director.js`, `js/data/beats.js`, `js/scenes.js` (title, onboarding, cold open, END), `js/apps/lock.js`, `js/data/assets.js`, `assets/**` |
| **room-climax** | `js/room/room.js`, `js/room/roomdata.js`, `js/room/door.js`, `js/room/climax.js`, `css/room.css`, `js/apps/camera.js` |
| **haesol-gallery** | `js/apps/haesol.js`, `js/apps/calculator.js`, `js/apps/gallery.js`, `js/data/gallery.js`, `js/data/mail.js`, `js/apps/mail.js`, `css/haesol.css` |
| **memo-notebook-recorder** | `js/apps/memo.js`, `js/data/memos.js`, `js/notebook.js`, `js/data/objectives.js`, `js/apps/recorder.js`, `js/data/recordings.js`, `css/notebook.css` |
| **story-data** | `js/apps/talk.js`, `js/apps/sms.js`, `js/apps/phone.js`, `js/apps/moment.js`, `js/apps/browser.js`, `js/apps/calendar.js`, `js/apps/clock.js`, `js/apps/settings.js`, `js/data/{talk,sms,phone,moment,browser,calendar,clock,settings}.js`, `css/apps.css` |

Story data lives under `G.STORY.*` (already used by generic apps). Each data file does
`G.STORY = G.STORY || {}; G.STORY.xxx = ...`.

## Assets (LEAD produces; reference by key via `G.IMG.key` from `js/data/assets.js`)
Images (`assets/img/*.jpg|png`): `room_door, room_bed, room_window, room_wardrobe, dog_bed, dog_park, dog_face,
hallway, hallway_eps, building, dawn_exterior, case_back (+ case_back_photo layers), sea_room_1yr, sea_orgel_live,
sea_orgel_live_1, sea_orgel_live_2 (door ajar frames), fingers_gap(png alpha), vault_sea_1..6, vault_haru_sleep, vault_haru_boxes,
shaft_card_dark(png), shaft_card_lit, shaft_face_dark(png), gap_closeup, gap_night, keypad, fig_cap(png alpha),
js2_hallway, door_ajar_guard, room_lit_nest, haru_fallback, haru_fallback_dark, kongi_old, mo_clothes, mo_sky, mo_laptop,
mo_mandarin, mo_mug, mo_mixdesk, bowl_closeup, door_sticker (zoom crop), patches: patch_doorguard_latched(png),
patch_duvet_dent(png), patch_glass_half(png), patch_glass_empty(png), gap_stage_1..4(png), patch_rack_fallen(png),
avatar_* , og.jpg, icon.png`. If a file is missing at dev time, code must degrade gracefully (onerror → hide).
Audio (`assets/audio/*.wav`): TTS voices listed above. Everything else is synthesized at runtime.

## Conventions
- Never block progress on permissions/sensors; always provide the fallback described in the design.
- Every audible cue gets a subtitle (`G.fx.sub`) when it carries information.
- Use `G.bus.emit('app:open', id)` etc. (already emitted by core) — director listens.
- Save anything that must persist in `G.state.vars` / flags. Never store images or camera frames.
- Mobile first (360–430 px wide). Min tap target 44 px. Test with Playwright `devices['iPhone 13']` at deviceScaleFactor 1.
- Debug: `window.haru` helpers; `CONFIG.DEBUG=true` shows hotspot outlines.
