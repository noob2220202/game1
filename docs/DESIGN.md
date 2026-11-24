# 하루를 위한 방탈출! — FINAL DESIGN (v1.0, single source of truth)

> Mobile-web found-phone horror escape room. Korean. One map: 세아's phone + room 404 seen through its camera.
> Target 35–45 min. iOS Safari / Android Chrome / desktop. Static site (Caddy on VPS, `haru.pengueverything.cloud`), **zero network requests at runtime** except static assets + pinned CDN fonts/libs.
> Player-facing text = Korean. Notes = English. `{NAME}` = `CONFIG.PLAYER_NAME` (default 하루). Josa auto-fixed (`{NAME}야/아`, `{NAME}가/이`).

---

## 0. Design pillars (read first)

1. **"그 사람은 화면만 본다. 소리는 못 듣는다."** — one world rule explains every hiding place and every mechanic. He mirrors 세아's phone screen (picture only, no audio). So 세아 (a sound-design student) hid what mattered in **sound**, in **public posts**, and in **his own photos**. Every puzzle obeys this rule.
2. **Real-phone tricks, never generic codes.** Each clue is found with a different *real phone feature*: glare on a polaroid in a clear case, 한/영 mistyped password, shake-to-undo, comparing door-lock tones, 모노 오디오 phase cancellation, 디지털 웰빙/저장공간 forensics, calculator vault, exposure slider, LIVE photo long-press, 알림 기록, screen-share (스마트뷰) cut, MFA fatigue attack, calling your own number, face-down hiding.
3. **Staged reveal ladder ("귀신보다 사람이 무섭다").** Ghost-or-person ambiguity for ~12 min → it's a person → he watched 세아 → he watches *this screen* → 관리실 is him → he stood by *your* pillow at 02:47 → he is in the wardrobe *now* → "1m 이내" → the door.
4. **Exactly 2 jumpscares + 1 soft sting** (JS1 exposure face, JS2 hallway sensor light, JS3 real-time message). Everything else is dread. Failing never spends a scare.
5. **Never stuck, never trapped.** Non-linear mid-game hub; every key fact has 2 discovery paths; 3-tier hints for every objective; every sensor/permission trick has an equal-quality fallback; every fail state costs only time (+ mockery).
6. **Sound is a co-star.** HRTF 3D room, conditioned "his" notification tone, the 오르골 leitmotif (relief → dread → healing), door-lock melody that opens and closes the story.

---

## 1. Story bible

### 1.1 Cast
| Who | Facts | Voice / style |
|---|---|---|
| **{NAME}** (player) | Moved into 해솔빌 404호 **yesterday 2026-11-23**. Wakes at 03:33. Own phone is gone (he took it). | Inner monologue only in notebook (수첩), short lines. |
| **윤세아** (24) | Previous tenant. 한빛예대 **음향디자인과** 4학년. Bio: `음향과 · 소리 모으는 사람 🎧`. Dog **콩이** (apricot toy poodle, pink collar w/ bell, came home 3.17). Vanished **2025-11-24 ~03:33**. Still missing at the end. | Bright, ㅋㅋ-heavy, nerdy sound jokes; in memos: calm, precise, scared. |
| **그 사람** (never named) | Man, ~40. Came 2025-03-10 as the "옷장 수리 기사" sent by a fake 관리실 (himself). Lives in the **sealed 2019 pipe-inspection shaft (배관 점검구, 60×90 cm)** behind the built-in wardrobe; the shaft connects to the **EPS실** (electrical room) door beside 404 in the 4F hallway. Installed screen mirroring + a calculator-disguised vault on 세아's phone. Controls 해솔홈 (smart-home) through admin account **`sagongsa`** (사·공·사 = 404) on device **SM-G991N**. Wears nothing distinctive; dark padded jacket, cap. Tonight he took {NAME}'s phone, planted 세아's phone under the bed, re-armed the remote admin lock (PIN never changed since 2025). | Persona A "관리실": polite 존댓말 with ^^. Persona B "{NAME}" (from {NAME}'s stolen account): lowercase-ish banmal, short, "ㅎ", no punctuation except '.' |
| **엄마** (세아's mom) | Has called this number every night at 03:33 via 톡 voice call for a year (03:33 = 세아's last message "엄마 나"). Keeps the account alive. | Short, ordinary, devastating lines. Never melodramatic. |
| **지민** | 세아's best friend. Texted her for a year. Lives across the alley (flavor). | Fast, ㅋㅋㅋ, ㅠㅠ, typo-ish. |
| **해솔빌 관리사무소 (real)** | Real number `02-338-5120` on the door sticker. After-hours ARS. | ARS formal. |

### 1.2 Timeline (fixed story dates; the phone's date is always 2026-11-24)
| When | Event |
|---|---|
| 2024-08-31 | 세아 moves into 404 (with 콩이). |
| 2025-03-10 14:00 | "옷장 문 수리 기사" visits (calendar + old SMS). Same day: 실내 카메라 registered, vault created (calculator), screen mirroring installed. **His "우리" anniversary.** |
| 2025-04-02 | 세아 reports "붙박이장 뒤 벽에서 긁는 소리" via building QR form → 처리상태: 보류. |
| 2025-06-03 | 지민 chat: `dkssud` joke (teaches 한/영 rule). |
| 2025-07-19 | 지민 chat: 알림 기록 꿀팁. |
| 2025-08-14 | 지민 chat: shake-to-undo 꿀팁. |
| 2025-09-02 | Moment: "소리로 그린 콩이" (teaches spectrum view). |
| 2025-10-11 | Moment: "믹스 끝나면 모노 체크 필수" (teaches mono). |
| 2025-11-17 → 11-22 | Moment posts whose first syllables, oldest→newest, read **옷장뒤에누가** (세아's hidden SOS). |
| 2025-11-20 03:33 | 세아's night "소리 감지 녹음" captures someone pressing the inside door-lock keypad (first remote/admin lock test). 세아 woke up locked in; it unlocked by 07:00. She "reported" to 관리실 (= him). |
| 2025-11-21 01:12 | 세아 records "잡음 (지우지 마)": a whisper hidden by phase-cancelling noise. |
| 2025-11-22 | 세아 pretends to sleep and sees him at the keypad (middle two digits **2 9**). |
| 2025-11-23 23:58 | 세아 writes memo "이 폰을 찾은 사람에게" (locked `zhddl`) and schedules an email for **1 year later, 07:00**. |
| 2025-11-24 03:29 | 세아's last photo: the wardrobe, gap open 3 cm (becomes "1년 전 오늘" card). |
| 2025-11-24 03:31 | 세아 calls 엄마 — 응답 없음 (mom was asleep; she has called back at 03:33 every night since). |
| 2025-11-24 03:33 | 세아 → 엄마: "엄마 나" (unfinished). She vanishes. |
| 2025-11-25 04:10 | Contact "관리실" edited (number swapped) by another device. Vault code becomes **1124** (calculator history shows `1124 = 1124` every night since). |
| 2025-11-25 → 2026-11-23 | 엄마 calls nightly 03:33 (366 missed 톡 calls incl. tonight). 지민 texts. |
| 2026-11-23 | {NAME} moves in. Calendar "{NAME} 입주" added by 알 수 없는 기기 (23:41). Vault folder "{NAME}" gets photos of {NAME} unpacking. |
| 2026-11-24 00:12 | Screen-mirroring session starts (화면 공유 연결 시간 counts from here). |
| 02:47 | Vault: photo of {NAME} asleep (from the wardrobe gap). |
| 02:51 | {NAME}'s phone taken; 세아's phone placed under the bed. |
| 02:58 | 해솔홈 login: new device SM-G991N. |
| 02:59 | 도어락 원격 관리자 잠금 설정 · 요청 기기 SM-G991N · **관리자 PIN 변경 없음**. |
| 03:12 | Memo "이 폰을 찾은 사람에게" 열람 · 다른 기기. |
| **03:33** | 엄마's nightly 톡 voice call → phone vibrates under the bed → {NAME} wakes. **Game starts.** |

### 1.3 Why things are hidden the way they are (logic checklist)
- **Why can't {NAME} call 112?** Status bar from frame 1: `SIM 없음 · Wi-Fi Haesol_404`. 긴급 통화 → "긴급 통화 연결 실패 · 셀룰러 신호 없음 (SIM 없음)". All messaging is 톡 over the building Wi-Fi, which 해솔홈 admin (him) restricts: outgoing 톡 messages/calls fail with "전송 실패 · 관리자 네트워크에서 발신이 제한되었습니다" — **except** the chat with "{NAME}" (his side; he allows it because he enjoys it). Restriction lifts when 해솔홈 is protected (§3 P12).
- **How does he get in/out?** Sealed pipe shaft behind the wardrobe ↔ EPS실 in the hallway (facility record via door-sticker QR; 입주민 카페 notice; CCTV EPS door ajar).
- **How does he know what you do?** Screen mirroring (cast icon in status bar from unlock). After you cut it he can only react to **sound** and **door/sensor events** (this is why hiding by silence works in the climax).
- **How did 세아 know the PIN digits?** 47 = her sound-activated recording of him at the keypad (dog bark masks the rest). 29 = she watched him at the keypad while pretending to sleep. 06 = she never found it; she says "그 사람은 뭐든 사진으로 찍어 둬" — it's on the admin card in his shaft, visible in his vault photo (and through the wardrobe gap with night mode).
- **Why is the PIN still valid?** He re-armed remote admin lock tonight; 알림 기록 + 해솔홈 log say "관리자 PIN 변경 없음".
- **Why does he wipe the memo live?** He read it at 03:12; he waits until {NAME} is reading to erase it (cruelty, and it's what he did to 세아). Undo works because the edit is < 24 h old on this device.
- **Why the acrostic?** 세아 knew he read her texts, so she hid "옷장뒤에누가" in *public* posts that look innocent. Tonight he posted two more from her account whose first syllables finish it: **있어**. Liked by `sagongsa`.

---

## 2. Game structure overview

### 2.1 Acts, milestones and the game clock (clock never contradicts progress)
| Milestone | Trigger | Clock | Battery | Tension T |
|---|---|---|---|---|
| M0 | Phone grabbed | 03:33 | 23% | .05 |
| M1 | Lock screen unlocked (0317) | 03:38 | 21% | .15 |
| M2 | Memo restored (undo) | 03:47 | 17% | .30 |
| F1 | First fragment found (any) | 03:56 | 12% | .40 |
| F2 | Second fragment found | **04:04** | **4%** (held) | .50 |
| F3 | Third fragment found | 04:13 | 4% | .60 |
| M4 | 해솔홈 logged in | 04:22 | 4% | .65 |
| M5 | Screen share cut | 04:31 | 4% | .75 |
| M6 | His device blocked + 보호하기 done | 04:38 | 4% | .85 |
| M7 | Door code accepted (climax starts) | 04:41 | 1% (절전) | 1.0 |
| M8 | 비상벨 | **04:44** (frozen) | 1% | 1.0→.2 |
| END | Ending | 07:00 | 1% | 0 |

Between milestones: +1 game-minute per 50 real s, capped at next milestone − 1 (seconds then loop 57→58→59→57 in 시계 app: "stuck time"). Battery never reaches 0. Flashlight shows −1%/45 s but never below the current floor. Note: fragments are order-free; F1/F2/F3 = *count* of fragments found.

### 2.2 Puzzle / beat list (14 objectives, ~40 min)
| # | Objective (notebook title) | Core trick | Required? | Est. min |
|---|---|---|---|---|
| P0 | (콜드오픈) 침대 밑에서 울리는 폰 | 3rd knock lie, long-press reach, time-slip lock screen | auto | 0–3 |
| P1 | 잠금 풀기 | Clear-case polaroid, tilt to clear glare → **0317**; lock-screen camera | ✔ | 3–7 |
| P2 | 이 폰은 누구 거지? | Explore; 1년 전 오늘 card; knock-back; 관리실 friendly msg; mom read receipts | soft | 7–10 |
| P3 | 잠긴 메모 열기 | 한/영 rule → **zhddl** | ✔ | 10–12 |
| P4 | 지워지는 메모 되살리기 | Live erase + **shake to undo** (★ signature 1) | ✔ | 12–14 |
| H1 | 조각 ① 소리 감지 녹음 | Door-lock tone matching → **47** | ✔ (hub) | any |
| H2 | 조각 ② 잡음 속 목소리 | **모노 오디오** phase cancellation → **29** (★ signature 2, audio) | ✔ (hub) | any |
| H3 | 조각 ③ 그 사람이 숨긴 사진 | 디지털 웰빙 → 저장공간 → 계산기 **1124** vault → exposure **06** (JS1) / alt night mode | ✔ (hub) | any |
| H4 | 세아의 마지막 글 | Moment acrostic → **옷장뒤에누가 + 있어** → memo p.2, learns `sagongsa` | optional (strongly signposted) | any |
| H5 | 관리실, 진짜야? | Door-sticker zoom, contact edit date, ARS, *0404# trap, 알림 기록 deleted photo | optional | any |
| H6 | 내 번호로 온 메시지 | Call "{NAME}" (own account) → **your ringtone rings inside the wardrobe (3D)** → declined | optional (strongly signposted, after F2) | any |
| P5 | 해솔홈 들어가기 | LIVE photo long-press → **오르골** → OTP in 메일; optional face login (camera) | ✔ (hub, parallel) | any |
| P6 | 원격 잠금 풀기 | Snap-back duel → find **화면 공유** & cut; synced tabs; look-away log (★ signature 3, meta) | ✔ | 30–34 |
| P7 | 그 사람 기기 차단 | Block `sagongsa`/SM-G991N → **MFA bombing**, deny all, "47 눌러" bait → 보호하기 | ✔ | 34–37 |
| P8 | 문 열기 / 클라이맥스 | **472906** → door guard → **face-down hide** in real darkness → mom's call → door guard → JS2 → 비상벨 (★ signature 4) | ✔ | 37–42 |
| END | 새벽 7시 | 세아's 1-year scheduled email, mom, '하루에 한 번만', real-time sting, friend's letter | auto | 42–45 |

### 2.3 Dependency graph (no softlocks)
```
P0 ─► P1(0317) ─► [UNLOCKED]
                    ├─► P2 explore (soft; all apps open)
                    ├─► P3 memo zhddl ─► P4 undo ─► HUB OPEN (notebook gets 3 fragment slots + leads)
                    │                                 │
                    │   (H4 acrostic, H5 관리실, P5 해솔홈 login are reachable right after UNLOCK too;
                    │    the memo merely signposts them)
                    │
 HUB (any order) ───┼─ H1 47   (녹음 '소리 감지 녹음' + room keypad)
                    ├─ H2 29   (녹음 '잡음' + 설정>손쉬운 사용>모노 오디오)
                    ├─ H3 06   (설정>디지털 웰빙|저장공간 → 계산기 history 1124 → vault IMG_0606 exposure ≥60%)
                    │          (alt: 카메라 wardrobe gap ≥2x → 야간 모드 3초)
                    ├─ H4 acrostic → memo p.2 + 'sagongsa' (optional)
                    ├─ H5 관리실 = him (optional)
                    ├─ H6 call "{NAME}" (unlocks after F≥2 message; optional)
                    └─ P5 해솔홈 login (오르골 + OTP) ─► dashboard (CCTV, 기기, 센서 로그, 비상벨 grey)
                                                          │
P6 needs: P5 ───────────────────────────────────────────────┘  (unlock attempt → snap-back → cut 화면 공유)
P7 needs: P6 (mirroring off) + device identity (any of: H4 likes / 알림 기록 / 해솔홈 로그인 기록 / 기기 상세 "404호(실내)")
P8 needs: P7 done (remoteAdmin = none) AND notebook fragments 47+29+06 (or player types 472906 from memory)
```
- Door code **before P7**: keypad accepts 472906 → "띠리릭" → instant "관리자 잠금 재설정 (SM-G991N)" + his "ㅋ" (teaches that he must be cut first). Not a fail.
- **Every fragment has a T3 hint that states the digits**; P8 can always be completed.
- Nothing in the hub expires; no item is consumable; no wrong action permanently changes state (wrong block, wrong code, 허용 in MFA all recover).
- Device identity has 4 independent sources (see P7), so blocking can never softlock; wrong block → taunt + device re-appears.

### 2.4 Notebook (하루의 수첩) — always reachable (top-right ✎ icon, also during modals)
- Tabs: **할 일** (objectives with status + "새 단서" dot), **조각** (`[  ][  ][  ]` slots → shows `47 29 06` once found; order fixed left→right by memo numbering ①②③), **힌트** (3 tiers per current objective; each tier needs a 2-s hold "힌트 보기" to avoid accidental spoilers; tier 2 unlocks 60 s after tier 1, tier 3 60 s after tier 2 — timers skipped in '쉬움' mode), **메모** (auto-notes: e.g. "그 사람 기기: SM-G991N", "관리실 = 그 사람?").
- Open leads list during the hub, e.g. "녹음 앱에 세아가 남긴 파일이 더 있다", "계산기 용량이 이상하다", "LIVE 사진?" — so players never feel stuck.

---

## 3. Puzzle & beat specs (exact clues, answers, unlocks)

Format: **Where** = app › screen › element. **Accept** = normalized answer set (normalize: trim, remove spaces/punctuation/emoji, lowercase, NFC). **Unlock** = state flags set.

### P0 — 콜드오픈 (0–3 min)
1. **Title** (`하루를 위한 방탈출!`, credit `made by {MAKER} for {NAME}`). Buttons: `시작하기` / `이어하기` (if save). Small line: `🎧 이어폰 권장 · 어두운 곳에서 · 약 40분`. In-app webview detected (KAKAOTALK / Instagram / FBAN / Line UA) → card: `카카오톡 안에서는 소리·센서가 제대로 동작하지 않아요. 오른쪽 위 ⋯ → '다른 브라우저로 열기'를 눌러 주세요.` + `그냥 할래요`.
2. **콘텐츠 안내** card: `이 게임에는 공포 연출(갑작스러운 소리, 어두운 장면, 스토킹 소재)이 있습니다. 언제든 ⏸ 메뉴에서 '덜 무섭게'를 켤 수 있어요.` [확인]
3. **몰입 설정** (one screen, each toggle = its own tap so iOS transient activation is fresh):
   - `🎧 이어폰 테스트` → L knock → `왼쪽` tap → R knock → `오른쪽` tap → `좋아요. 이 게임의 소리에는 방향이 있습니다.` (Wrong/`스피커예요` → `audioMode='speaker'`.)
   - `📱 기울기·흔들기 센서 (권장)` → `DeviceMotionEvent.requestPermission()` + `DeviceOrientationEvent.requestPermission()` on this tap.
   - `📷 카메라 (선택)` → *no prompt now*; just sets `cameraOptIn=true`. Text: `카메라는 게임 속 한 장면에서만 켜지고, 사진은 이 기기 밖으로 절대 나가지 않아요. 엔딩에서 자동 삭제.`
   - Footer: `이 게임은 어떤 데이터도 서버로 보내지 않습니다.` → [시작]
   - The [시작] tap: `A.unlock()` (resume ctx, `navigator.audioSession.type='playback'`, start silent looping `<audio playsinline>`), `navigator.wakeLock.request('screen')`, Android `requestFullscreen()`.
4. **Third knock lie**: fade to black; 1.4 s later ONE knock from directly behind (HRTF az 180°, LP 1.6 kHz, closet IR). 2 s silence → tiny subtitle `(…똑.)`.
5. Black, 4 s rain + room tone. Then muffled ringtone + buzz from below-front (LP 900 Hz "under the mattress"): **mom's 톡 voice-call ring**. Subtitle: `침대 밑에서 무언가가 울린다.` Dim button `손을 뻗는다` — **0.6 s long-press**. Desktop: click-hold.
6. Ringing stops the instant it's grabbed (missed). **Lock screen** appears showing the **real local time** for 1.2 s → digits roll (odometer, 600 ms, one-frame RGB split + `S.glitch`) → **03:33**. Date line: `11월 24일 화요일`.
   - If real local hour is 00–04: title-card line once: `지금, 진짜 새벽이네.`

### P1 — 잠금 풀기 (PIN **0317**)
**Lock screen texts**
- Status bar: `SIM 없음` · Wi-Fi icon · `Haesol_404` (tap shows name) · cast icon **(only after unlock)** · battery `23%`.
- Wallpaper: dog_face (콩이). Owner line: `세아 💛 콩이`.
- Notifications (stack):
  - `톡 · 엄마` — `부재중 보이스톡 (366)` / `방금`
  - `톡 · 엄마` — `세아야 오늘로 1년이야. 엄마 오늘도 전화했어.` / `방금`
  - `해솔홈` — `도어락: 원격 관리자 잠금이 설정되었습니다.` / `34분 전`
  - `배터리` — `배터리 23% · 충전기를 연결하세요` / `1분 전`
- PIN pad hint (tap `비밀번호 힌트`): `막내가 온 날 🐶`
- Bottom-left `긴급 통화` → dialer → any number (112, 119) → `긴급 통화 연결 실패 · 셀룰러 신호 없음 (SIM 없음)`. Notebook auto-note: `SIM이 없다. 112도 안 된다.`
- Bottom-right camera icon: **swipe left OR tap** → room view (lock-screen camera mode, banner `🔒 잠금 상태 — 카메라만 사용 가능`).
- Wrong PIN: shake + `S.error`; 5 wrong → `30초 후 다시 시도` (time only). After 3 wrong, hint dot on notebook.

**Clue path (two)**
- (a) `휴대폰 뒤집기` button on the lock screen (icon: phone flip). Shows **phone back in clear case** with a polaroid inside: puppy photo, handwriting `콩이 우리집 온 날 ♥`, and the date in the lower-right corner **covered by a white glare**. Tilt the phone (relative to pose at open: `dx=(γ-γ0)*12px/°`, `dy=(β-β0)*10px/°`) or drag the glare with a finger → `3.17` revealed. If no orientation events within 800 ms → drag-only mode + ghost-hand after 10 s `빛을 손가락으로 밀어 보세요`.
- (b) Room view (camera): bed wall → under-bed hotspot (needs flashlight) → close-up: dog bowl with a name sticker `콩이 ♥ since 2023.03.17` (notebook: `콩이… 3월 17일부터?`). This keeps P1 solvable even if the flip button is missed.
- **Accept**: `0317`. **Unlock**: `M1`, phone home screen, cast icon appears in status bar (`state.mirroring=true`).

**Hints P1**: T1 `잠금화면 힌트: 막내가 온 날. 이 집 막내는 누구일까?` · T2 `휴대폰을 뒤집어 봐. 케이스 안에 사진이 있어. 번들거리면 폰을 기울여.` · T3 `콩이가 온 날은 3월 17일. 비밀번호는 0317.`

### P2 — 이 폰은 누구 거지? (soft exploration, ~3 min; nothing blocks)
Beats fired by the director on unlock (safe zones respected):
- **B06 (20 s after unlock)** notification `갤러리 · 1년 전 오늘` → card `1년 전 오늘 · 2025년 11월 24일 오전 3:29` → photo **sea_room_1yr** (this same wardrobe, 세아's things, gap open 3 cm). Button `그때와 지금` → side-by-side with the live wardrobe view. Notebook: `…1년 전 오늘, 같은 시간. 같은 옷장.`
- **관리실 first message** (60 s after unlock, 톡 › 관리실):
  ```
  관리실: 404호 새로 입주하신 분 맞으시죠?
  관리실: 새벽에 도어락 오류 신고가 들어와서 연락드려요 ^^
  관리실: 문이 안 열리시면 도어락에 *0404# 눌러보세요. 초기화됩니다.
  관리실: 그리고 붙박이장은 경첩이 고장나서 절대 여시면 안 됩니다. 다쳐요.
  ```
  (Replying fails: `전송 실패 · 관리자 네트워크에서 발신이 제한되었습니다.`)
- **Knock-back** (B07, first room look after unlock, not facing the wardrobe): 2 soft knocks from the wardrobe direction. Wardrobe close-up shows a `노크하기` knuckle icon. Echo rules: 1–3 taps → echoed (delay 1.1–1.6 s, muffled). ≥4 → 3 s silence → ONE knock from directly behind the player's current yaw; wardrobe never answers again. Sets `knockedBack`.
- **엄마 read receipts** (optional; see §4.1): opening the chat makes 365 unread "1"s vanish, then her messages, then her incoming 보이스톡 is auto-declined (`통화 거절됨`, no touch). Sets `momRead`.
- **Trap *0404#** (any time): door keypad accepts `*0404#` → 3 s two-tone alarm 2.4/3.1 kHz + red flash (≤3 Hz) → 3 slow knocks inside the wardrobe → 관리실: `그 번호 아니에요 ^^ 다시 알아볼게요`. Time cost only.

### P3 — 잠긴 메모 (**zhddl**)
- **Where**: 메모 › list: `🔒 이 폰을 찾은 사람에게` (수정 2025.11.23 23:58). Other memos: `장보기` (`콩이 사료 / 귤 / 우유 / 테이프`), `음향학 과제 메모` (`위상 상쇄 실험: 같은 소리 + 위상 뒤집은 소리 = 0 / 스테레오에선 각각 다른 잡음, 모노로 합치면 잡음만 사라지게 → 이거 써먹을 데 있을 듯`), `비번들` (`와이파이 Haesol_404 / 현관: 관리실이 바꿈ㅡㅡ`).
- **Lock screen of memo**: field label `비밀번호` + hint `우리집 막내 · 영문 소문자 5자`. The password field **auto-switches the custom keyboard to English** (like real 비밀번호 칸). Every key shows both legends (Latin big, 두벌식 jamo small grey: z/ㅋ h/ㅗ d/ㅇ l/ㅣ…).
- Typing `kongi` → `비밀번호가 틀렸습니다` + tooltip `그건 너무 쉽잖아 ㅋ` (세아's memo-lock tooltip). Toggling to 한 → `영문만 입력할 수 있어요` (field shake).
- **Clue** (톡 › 지민, 2025.06.03):
  ```
  지민: ㅋㅋㅋㅋㅋ너 또 한영키
  지민: 'dkssud' 이게 뭐냐고ㅋㅋㅋ
  세아: 안녕이라고 친 거임ㅋㅋㅋㅋ
  지민: 이거 비번으로 쓰면 아무도 모르겠다
  세아: 오 천재? 메모 비번 이렇게 바꿔야지
  세아: 우리집 막내 이름으로 ㅎㅎ
  ```
- Desktop: map `keydown e.code` → in-game key, so a player typing 콩이 with the Korean IME on naturally produces `zhddl` (and passes — intended).
- **Accept**: `zhddl` (case-insensitive). **Unlock**: memo opens → P4 starts.
- **Hints**: T1 `막내는 콩이. 근데 한글이 안 들어가네.` · T2 `지민이가 'dkssud'를 놀렸던 대화를 봐. 한/영 안 바꾸고 치면?` · T3 `ㅋㅗㅇㅇㅣ 자리를 영어로: z h d d l.`

### P4 — 지워지는 메모 / 흔들어서 실행 취소 (★ Signature 1, early)
1. Memo page 1 opens (full text §4.2). Player reads. At **6 s** (or when scrolled to ¶3), a top banner: `✎ 알 수 없는 기기에서 편집 중…`. A **red caret** eats the text from the end, ~14 chars/s, with backspace ticks; Android `vibrate([30,40,30])`.
2. Deletion **stops at 30%** (title + first 2 lines remain): `이 폰을 찾은 사람에게. / 그 사람은 내 문자, 사진, 메모를 다 봐.` Then the banner changes to `편집 완료 · 다른 기기`. Memo metadata: `수정됨 · 방금 · 다른 기기에서`.
3. **Undo** (any of): shake the real phone (|Δacc| > 13 m/s² peak twice within 700 ms with direction change, 900 ms cooldown) / memo toolbar `↶` / `⋯ › 실행 취소` / three-finger swipe left / Ctrl/Cmd+Z. → custom sheet: `실행 취소: 삭제` [취소] [실행 취소]. Confirm → text rewinds in reverse key-by-key (reverse click buffer) back to full.
4. During the rewind, one line passes that 세아 never wrote, in a heavier font weight: `다 읽었어 세아야. 이제 {NAME} 차례.` — then it erases itself letter by letter (his typing undone), and the memo shows a new line for 1.5 s: `흔들지 마.` (typed by "다른 기기"), which also deletes itself. **This is his first "voice" — not a message, an edit.**
5. Memo becomes `📌 이 기기에 고정됨` (can't be erased again). Notebook gains 3 fragment slots and the leads list.
- **Clue for undo** (톡 › 지민, 2025.08.14):
  ```
  세아: 아 그리고 폰 흔들면 실행취소 되는 거 앎??
  세아: 메모 과제 다 날렸다가 흔들어서 살림ㅋㅋㅋ
  지민: 헐 대박 몰랐어
  지민: 근데 그거 세게 흔들다 폰 날리겠다
  ```
  Also 설정 › 손쉬운 사용 › `흔들어서 실행 취소: 켬`.
- Auto-hint: 45 s with no action → T1 auto-pops. Never require a hard shake; copy says `살짝 흔들어도 돼`.
- **Unlock**: `M2`, HUB OPEN, director T→.3.
- **Hints**: T1 `지워진 지 몇 초밖에 안 됐어. 되돌릴 수 있지 않을까?` · T2 `세아가 지민이한테 알려준 꿀팁: 메모 날렸을 때 살린 방법.` · T3 `폰을 살짝 흔들어(또는 메모 위 ↶ / ⋯ › 실행 취소).`

### HUB rules
- Opens at M2. Notebook leads (shown as unchecked bullets until resolved):
  `① 세아가 말한 '소리 감지 녹음' — 녹음 앱` · `② '잡음' 녹음 — 하나로 합쳐?` · `③ 그 사람이 숨긴 사진 — 어디에?` · `세아의 마지막 모먼트 글들 — 첫 글자` · `관리실 번호, 진짜일까?` · `해솔홈 — 도어락을 관리하는 앱`
- Director keys beats to **fragment count**, never to a specific fragment (§6).
- Each fragment found → relief window: 20 s safe zone, warm 3-note 오르골 fragment + `S.pen`, slot fills with handwriting animation.

### H1 — 조각 ① 소리 감지 녹음 (**47**) — door-lock tone matching
- **Where**: 녹음 › list (newest first):
  - `잡음 (지우지 마)` · 2025.11.21 01:12 · 0:24
  - `소리 감지 녹음` · 2025.11.20 03:33 · 0:19 · tag `자동` (icon: ear)
  - `콩이 그림` · 2025.09.02 · 0:08
  - `콩이 코골이ㅋㅋ` · 2025.07.30 · 0:11
  - `음향학 실습 - 방 IR 측정` · 2025.05.14 · 0:06 (a clap + reverb, flavor)
- **Recording content** (`vm_doorlock.wav`, 19 s): rain + room tone → 2 inside-keypad beeps (tones **F5 698 Hz** then **B5 988 Hz**, 80 ms each, 0.5 s apart) → 콩이 barks ×4 at the exact times the next 4 beeps would be (bark transients *replace* those beeps, so there is no "hidden 6 beeps" confusion) → admin-lock confirm melody (C6-A5-F5 descending, "관리자 잠금 설정") → a man's whisper `쉿.` (TTS, close) → barking stops abruptly → 6 s silence + breathing.
  - Transcription chip (tap `텍스트 보기`): `[삐] [삐] [개 짖는 소리] [삐리릭] (남성) "쉿." [숨소리]`
  - Player controls: ▶, 5 s back, speed `0.75×`, `🔁 구간 반복` (auto-selects 0–3 s), `음높이 보기` toggle (pitch bars: each beep drawn as a bar at its pitch height).
- **Room keypad**: 카메라 › door wall › door lock hotspot → **keypad close-up**. Each key plays its own note (C-major scale): `1=C5 523, 2=D5 587, 3=E5 659, 4=F5 698, 5=G5 784, 6=A5 880, 7=B5 988, 8=C6 1047, 9=D6 1175, 0=E6 1319` (sine + 2nd harmonic .25, 80 ms, 3 ms click). With `음높이 보기` on (global toggle), pressing a key lights a bar at the same height scale as the recorder's bars. A **mini-player** (status-bar chip ⏸/↺5s) keeps the recording playing across apps, so players can A/B by ear.
- Same frequency table used by numpy render and runtime synth → exact match.
- **Accept**: the fragment is auto-registered when the player presses `4` then `7` within 4 s while (a) the recording has been played at least once. Alternatively, typing `47` into the notebook slot ① (slots accept typed digits, validated). Notebook text: `① 4 7 — 앞의 두 번만 들렸다.`
- **Second path**: the `음높이 보기` bars (visual, works muted/tone-deaf) + the climax/MFA bait `47` (late confirmation). T3 states the digits.
- **Hints**: T1 `도어락은 버튼마다 소리 높이가 달라.` · T2 `녹음을 틀어 둔 채로 문 쪽 도어락을 눌러 비교해 봐. '음높이 보기'를 켜면 눈으로도 보여. 들리는 건 앞의 두 번뿐.` · T3 `4(파)와 7(시). 조각 ①은 47.`

### H2 — 조각 ② 잡음 속 목소리 (**29**) — 모노 오디오 (★ Signature 2, audio)
- **Where**: 녹음 › `잡음 (지우지 마)` (24 s). Plays as harsh stereo static with crackle; a voice is *almost* there.
- **Runtime mix (never baked into the file)**: buffers `noiseA`, `noiseB` (independent white+crackle), `voice` (세아 whisper TTS). Stereo mode: `L = noiseA + 0.12·voice`, `R = noiseB + 0.12·voice` (SNR ≈ −20 dB, unintelligible; no downmix can cancel it). **Mono mode** (global master-bus option): `L = n`, `R = −n` (same buffer, gain −1) + voice centered → after the ChannelMerger mono sum (×0.5 to both outs) the noise cancels to digital silence and **only 세아's whisper remains, dead-center**. Toggling while playing gives a small phase click.
- **설정 › 손쉬운 사용 › 오디오 › 모노 오디오** — description `왼쪽·오른쪽 채널을 하나로 합쳐서 재생합니다.` Settings search finds it with `모노`, `하나`, `합쳐`, `채널`, `소리`. Also a shortcut tile in the quick panel (`모노`), hidden until the player has seen the setting once.
- **Whisper text** (subtitle shown only in mono mode; in stereo: `[치지직—]`):
  > `이거 들리면… 나 없는 거겠지. 괜찮아. 두 번째는… 이, 구. 이구야. 자는 척하면서 봤어. 그 사람 손가락. …그리고 옷장 안쪽 벽, 두드리면 통통 소리 나. 비어 있어. 콩이가 맨날 거기 대고 짖었어.`
- **Signposts (2+ paths)**: memo p.1 `② 잡음 녹음. 두 귀로 들으면 절대 안 들려. 소리를 하나로 합쳐.` · 메모 `음향학 과제 메모` (위상 상쇄) · Moment 2025.10.11 post (mixing desk): `믹스 끝나면 모노 체크 필수 ㅋㅋ 위상 뒤집힌 소리는 합치면 사라짐 (전공자만 웃음)` · **spectrum view**: toggling `파형 | 주파수` on this file draws the word **`모노`** in the 5–8 kHz band during 3–9 s (taught by `콩이 그림` first).
- **Accept**: auto-register when the whisper's "이, 구" segment plays in mono (t ≥ 6.2 s). Or type `29` in slot ②. Notebook: `② 2 9 — 세아가 직접 봤다.`
- **Mono auto-off**: when H2 registers, toast `모노 오디오를 끌까요? (방향이 있는 소리가 중요해요)` [끄기] — default off after 10 s; also forced off before P6/P8 spatial beats with toast `모노 오디오가 꺼졌습니다`.
- **Hints**: T1 `세아는 "하나로 합쳐"라고 했어. 세아 전공이 뭐였지?` · T2 `폰 설정 어딘가에 왼쪽·오른쪽 소리를 하나로 합치는 기능이 있어(손쉬운 사용).` · T3 `설정 › 손쉬운 사용 › 모노 오디오를 켜고 '잡음'을 다시 틀어. 조각 ②는 29.`

### H3 — 조각 ③ 그 사람이 숨긴 사진 (**06**) — 계산기 금고 + 노출 (JS1)
**Step A — find the vault (3 converging real-phone clues → 1124)**
- 설정 › `디지털 웰빙` › `가장 많이 사용한 앱: 계산기 · 하루 평균 2시간 41분`. Tap → hourly bars: spikes 02:00–04:00 every night since 2025.11.25.
- 설정 › `저장공간` › `앱`: `계산기 2.1GB (이미지·동영상 2.0GB)` > `갤러리 1.3GB`.
- 계산기 (works as a real calculator with key ticks). History 🕘: `37,800 ÷ 3 = 12,600` (2025.09.13 곱창), `650,000 × 12 = 7,800,000` (2025.08.30 월세), `24 × 7 = 168`, then from **2025.11.25 every day**: `1124 = 1124` (long scroll, grouped by month: `2026년 11월 · 24회`).
- Memo p.2 (if H4 done): `계산기가 2.1GB야. 사진이 들어 있는 거야. 근데 난 못 열었어.`
- **Accept**: type `1124` then `=` → display `••••` → 200 ms glitch → card-flip into `보관함` (40 Hz drone swells).
**Step B — vault contents** (`보관함`, folders):
- `세아` (2025, 41 photos; show 6): 세아 asleep from the wardrobe-gap POV, timestamps `2025.04.02 03:12`, `2025.06.18 02:40`, `2025.09.30 03:05`, `2025.11.20 03:33`… (reveal: **someone watched 세아**).
- `{NAME}` (newest first): `2026.11.24 02:47` **{NAME} asleep** (face hidden, blanket + back of head, from the gap; same room with moving boxes) — reveal **he was at your bed**; `2026.11.23 21:10` {NAME} unpacking (back view); (+ face-login capture later, §P5).
- `기타`: `IMG_0606` (near-black), `IMG_0310` (a blurry daylight photo of 세아 opening the door to the "repairman", taken from inside the wardrobe — 2025.03.10 14:07).
- Info sheet on any photo: `기기: 세아의 Galaxy · 원격 촬영 · 업로드: SM-G991N`.
**Step C — exposure (JS1 slot)**
- `IMG_0606` › `편집` › `노출` slider (custom div slider, not native range). Rendering: lossless PNG/WebP (pixel values 0–14 + dither), `out = clamp(in·gain)`, `gain = 1 + 17·e^1.6`.
  - 0–55%: noise. 55–78%: **plywood shaft wall**: polaroids of 세아, a laminated card `현관 도어락 관리자 카드 · 관리자 비밀번호` with handwritten digits — the first four covered by a **new polaroid of {NAME}'s sleeping back** pinned over them; visible: `● ● ● ● 0 6`. Tally marks (365) to the left. 78–92%: a shoulder silhouette at the right edge.
  - **First time past 92%** (and only if JS1 unspent and ≥8 min played): 60 ms silence drop → face at the lens for 450 ms (`shaft_face`) + `sting_js1` + `vibrate([0,80,40,300])` + 300 ms shake → the slider **yanks itself back to 0** (350 ms, ease-out overshoot) → input dead 1.2 s. After that the face is gone forever; info shows `편집됨 · 방금 전 · 알 수 없는 기기`. '덜 무섭게' mode: face fades in slowly, no shake, no sting (dread version).
  - Fragment counts when viewed ≥60% for 1 s. Notebook: `③ 0 6 — 그 사람 벽에 붙은 카드. 앞 네 자리는… 내 사진으로 가려져 있었다.`
- **Alt path for 06 (no vault)**: 카메라 › wardrobe view › pinch/zoom ≥2× on the door gap → yellow moon chip `야간 모드 3초` → shutter → `움직이지 마세요` 3-2-1 ring (DeviceMotion stillness |Δacc| < 1.2 m/s²; motion denied → **hold** shutter 3 s, pointer drift > 8 px resets; resets capped at 2) → breath grows close during the 3 s → result photo: lifted gap shows a **pale eye at the left edge** and, deeper, the same card `●●●●06` on plywood. Live view stays empty. (Small peak; does not spend JS1.)
- **Hints**: T1 `이 폰에서 제일 많이 쓴 앱이 뭘까? 설정을 봐.` · T2 `계산기가 사진을 2GB나 갖고 있대. 계산 기록에 매일 같은 숫자가 있어.` · T3 `계산기에 1124 =. 기타 폴더의 까만 사진을 편집 › 노출로 밝혀. 조각 ③은 06.` (T3 also mentions `또는 카메라로 옷장 틈을 2배 확대하고 야간 모드`.)

### H4 — 세아의 마지막 글 (acrostic; optional, strongly signposted)
- **Where**: 모먼트 › 세아 profile (`seah_y` · `음향과 · 소리 모으는 사람 🎧` · 게시물 38 · 팔로워 212). Feed newest-first; *first syllables in bold here for the doc only*:
  | Posted | Caption | Photo |
  |---|---|---|
  | **오늘 02:47** | **어**서 와, {NAME}야. | blurred dark bed (crop of vault 02:47) |
  | **오늘 02:41** | **있**지, 새 이웃이 이사 왔어 | white sneakers at the entrance (crop room_door) |
  | 25.11.22 | **가**끔은 혼자인 게 좋아 | mug by a rainy window (gen) |
  | 25.11.21 | **누**가 내 귤 먹었냐 (나임) | mandarin peels (gen) |
  | 25.11.20 | **에**구 콩이 산책 너무 좋아함 ㅠ | dog_park |
  | 25.11.19 | **뒤**늦게 정주행 시작함… 잠이 안 와 | dark room, laptop glow (gen) |
  | 25.11.18 | **장** 보러 가는 길 하늘 미쳤다 | dusk sky over market street (gen) |
  | 25.11.17 | **옷** 정리하다가 작년 사진 발견ㅋㅋ | clothes heap on bed (gen) |
  Read top-down = nonsense (어있가누에뒤장옷). Read **bottom-up (time order)** = 세아's six: **옷장뒤에누가**, then his two from tonight: **있**(02:41) **어**(02:47) → **옷장뒤에누가있어**. He finished her sentence, addressed to {NAME}.
  - Comments under 25.11.22: `jimin_0412: 세아야 요즘 글 왜 이래… 괜찮아?` · `seah_y: ㅋㅋ 뭔소리 나 멀쩡함` (25.11.22 23:40 — she couldn't say more; he was reading). Under tonight's two: `좋아요 1 · sagongsa`. Tapping `sagongsa` → private profile, `게시물 0 · 팔로잉 1 (seah_y)`, avatar = black square.
- **Lock**: memo › `🔒 2쪽` (shown at end of p.1) with prompt `내가 올린 마지막 글들, 첫 글자만. 시간 순서대로.`
- **Accept**: any normalized input containing `옷장` (e.g. 옷장, 옷장뒤에, 옷장뒤에누가, 옷장뒤에누가있어, 옷장뒤에누가있어어).
- **Unlock**: memo p.2 (§4.2) + notebook `그 사람 계정: sagongsa (사공사… 404?)`.
- **Hints**: T1 `세아는 그 사람이 폰을 본다는 걸 알았어. 그래서 누구나 보는 곳에 숨겼어. 모먼트.` · T2 `SNS는 최신 글이 위야. 맨 아래(가장 오래된 글)부터 첫 글자만.` · T3 `옷·장·뒤·에·누·가 … 그리고 오늘 밤 올라온 '있어'. 메모 2쪽에 '옷장'만 써도 돼.`

### H5 — 관리실, 진짜야? (optional; proves 관리실 = him)
Independent proofs (any one sets `managerExposed`, notebook `관리실 = 그 사람.`):
1. **Door sticker** (Python composite on room_door, under the peephole): `해솔빌 관리사무소 ☎ 02-338-5120 (평일 09:00–18:00) · 시설 고장신고 QR`. Readable only at zoom ≥2×. When the QR bbox sits in the central 60% at ≥2× for 400 ms → yellow corner overlay + link chip `haesolvil.kr/as?unit=404` → in-game 인터넷 page (§4.5 facility record) incl. `관리사무소는 새벽에 개인 문자·톡을 보내지 않습니다. 관리실 사칭에 주의하세요.` The sticker's QR is **real** and encodes `https://haru.pengueverything.cloud/q/404.html` (static mirror of the same page; desktop/second-device bonus).
2. **전화 › 연락처 › 관리실**: `010-8817-3302` · `최종 수정 2025.11.25 04:10 · 다른 기기`. Mismatch with sticker `02-338-5120`.
3. **톡 › 관리실 › 프로필**: `친구 추가 2025.03.08 · 전화번호로 추가됨 010-8817-3302` and the 2025 thread (§4.1) where "관리실" says `404호는 끝 세대라 옆은 벽이에요 ^^` (contradicted by the facility record).
4. **알림 기록 slip** (fires at F2 when safe): 관리실 sends `[사진]`; banner shows a 6-px-blurred thumbnail for 1.2 s; bubble becomes `삭제된 메시지입니다`; then `관리실: 죄송합니다 잘못 보냈네요 ^^`. 설정 › 알림 › 알림 기록 (ON) shows the full entry: big picture = {NAME} asleep 02:47 + text `아직 안 자네 ㅎ` — banmal from "관리실". (Clue: 지민 chat 2025.07.19 `카톡 삭제해도 알림기록에 다 남는 거 알았음?? 설정-알림-알림기록 ㅋㅋ 개꿀팁`.)
5. *0404# trap result (P2).
- **Hints**: T1 `관리실 번호, 진짜 맞을까?` · T2 `현관문 쪽을 카메라로 확대해 봐. 스티커가 있어. 그리고 연락처 '관리실'의 수정 날짜.` · T3 `스티커 02-338-5120 ≠ 연락처 010-8817-3302. 세아가 사라진 다음 날 누가 번호를 바꿨어.`

### H6 — 내 번호로 온 메시지 (optional, signposted; "he is here now")
- **First contact (F1)**: 톡 gets a new chat with **"{NAME}"** — the player's own account (profile: default grey avatar, status `{NAME}`). Uses **his notification tone** (§7) for the first time.
  - If `knockedBack`: `똑똑 해줘서 고마워 ㅎ` → (2 s) `{NAME}야.`
  - Else: `착하네. 대답 안 하고.` → (2 s) `{NAME}야.`
  - Notebook: `…내 계정이다. 내 폰, 누가 갖고 있어.`
- **F2 (04:04)**: `{NAME}`: `배터리 4%네.` / `얼마 안 남았다 우리.` The chat's 📞 (보이스톡) button pulses once. Lead added: `내 번호로 걸어 볼까?`
- **Call**: tap 📞 → `보이스톡 · {NAME}` with Korean ringback (440+480 Hz, 1 s on / 2 s off) in the ear (center), **and simultaneously, in the room**, the player's ringtone (original marimba, §7) + vibration buzz from **inside the wardrobe** (HRTF az 270°, LP 700 Hz facing away → 2.8 kHz facing it, closet IR 0.25 s). A floating call bar persists so the player can open the camera and turn; facing the wardrobe, a blue glow pulses in the door gap in sync with the rings. Speaker mode: subtitle `[옷장 쪽에서 진동 소리 ◀]` + edge arc.
- At ring 5 the call is **declined** mid-note: glow dies, `통화 거절됨`. 3 s later: `{NAME}`: `…전화하지 마.` + one soft knock inside the wardrobe. Later calls: `상대방의 전원이 꺼져 있어…` (TTS, telephone EQ).
- Sets `ringHeard`. Notebook: `내 폰이… 옷장 안에서 울렸다.`
- (Outgoing 톡 is network-restricted, but the "{NAME}" chat is allowed — notebook explains once: `이 방만 메시지가 간다. 그 사람이 허락한 방이니까.`)
- **Hints**: T1 `폰 잃어버리면 제일 먼저 뭘 하지?` · T2 `"{NAME}" 대화방, 그거 네 계정이잖아. 전화 걸어 봐.` · T3 `톡 › {NAME} › 📞 그리고 카메라를 켜서 소리 나는 쪽을 봐. (이어폰 추천)`

### P5 — 해솔홈 들어가기 (오르골 → OTP) — reachable any time after unlock
- **해솔홈 launch**: splash `해솔홈 · Haesol Smart Living` → login: `아이디 seah.y` (prefilled), `비밀번호 ●●●●●●●●` (wrong always — he changed it), buttons `[얼굴로 로그인]` `[비밀번호 찾기]`.
- **Face login (optional, camera)**: only if `cameraOptIn`. Consent card: `실제 전면 카메라를 2초간 사용해요. 사진은 이 기기 안에서만 쓰이고 엔딩에서 지워져요.` [카메라 켜기] [건너뛰기] → OS prompt → mirrored live feed in an oval with a scan line 2.5 s → `등록된 얼굴(윤세아)과 일치하지 않습니다.` One frame captured to canvas at 1.8 s; tracks stopped immediately. Not opted-in/denied: `카메라를 사용할 수 없습니다.` (payoff in P6).
- **비밀번호 찾기** → `본인확인 질문: 나의 보물 1호는?` → answer → `seah.y@hanmail.net(으)로 인증번호를 보냈습니다. (유효 5분)` → 메일 arrives (§4.3) with a 6-digit code (generated per session, e.g. `482913`; shown in mail and stays valid all game; "expired" never happens) → enter → `임시 로그인되었습니다. 보안을 위해 비밀번호를 변경하세요.` [나중에] → dashboard. Sets `M4`.
- **Clue for 오르골 (two paths + teach)**:
  - 갤러리 › `IMG_1115` **LIVE** badge / Moment post 2025.11.15: `내 보물 1호 🎵 소리까지 들려주고 싶다` · comments `jimin_0412: 그게 뭔데 소리 들려줘ㅋㅋ` · `seah_y: 사진 꾹 눌러봐ㅋㅋ`. **Long-press ≥350 ms** (pointer events; `-webkit-touch-callout:none`, `contextmenu` prevented) → 1.5 s: frames crossfade, the **오르골 melody** plays (first 2 bars), the wardrobe door behind 세아 opens 2 cm and **four pale fingertips** curl around the edge in the last 0.3 s. Release → still. 2nd press: + spring wind-down. 3rd press: + close breath at the end, and the still frame **permanently** shows a 1 cm gap (small peak #1). Subtitle chip during playback: `♪ 작은 오르골 소리`.
  - 톡 › 지민 (2025.10.02): `지민: 너 그 오르골 아직도 들고 다니냐ㅋㅋ` / `세아: 보물 1호인데 당연하지;; 엄마가 사준 거란 말이야`.
- **Accept** (normalized): `오르골`, `오르골상자`, `오르골박스`, `뮤직박스`, `musicbox`, `오르곤`, `오르굴`, `dhfmrhf`.
- **Leitmotif beat (M4 + 45 s, safe zone)**: the full 오르골 melody from **inside the wardrobe** (panner az 270°, LP 1.8 kHz + closet reverb), slowing 1.0→0.35 over 8 bars, last note hangs → `딸깍 딸깍`. Subtitle `(옷장 안에서… 오르골 소리?)`. Notebook: `세아 오르골이 저 안에 있다.`
- **Hints**: T1 `도어락은 해솔홈이 관리해. 비밀번호는 모르니까… 찾기?` · T2 `세아의 보물 1호. LIVE 사진은 꾹 누르면 소리가 나.` · T3 `보안 질문 답은 오르골. 인증번호는 메일 앱에 와 있어.`

**해솔홈 dashboard** (after M4)
| Tile | Content |
|---|---|
| 도어락 | `404호 현관 · 원격 관리자 잠금 · 설정 02:59 · 요청 SM-G991N · 관리자 PIN 변경 없음` [원격 잠금 해제] |
| CCTV | `4F 복도` (hallway.png, IR grade, live DOM timestamp `CAM 04 · 4F 복도 · 2026-11-24 04:2x:xx`) · `1F 현관` (building.png crop, rain). Stages: before M6 EPS door closed; after M6 **EPS door ajar** (hallway_eps). |
| 실내 카메라 | `오프라인 · 설치 2025.03.10 · 등록 sagongsa` (never comes online — the "eye" is the screen share) |
| 옷장 문 센서 | `설치 2025.03.10` → **이벤트 로그** (look-away log, §6.4) |
| 기기 관리 | device list (P7) |
| 로그인 기록 | `2026.11.24 02:58 · SM-G991N · 404호(실내)` / `2025.11.25 04:02 · SM-G991N` / `2025.03.10 15:20 · SM-G991N (최초 등록)` |
| 비상벨 | grey, `관리자 잠금 중 사용 불가` (pays off at P8) |
| 계정 보호 | hidden until MFA (P7) |

### P6 — 원격 잠금 풀기 → 화면 공유 끊기 (★ Signature 3, meta)
1. Tap `원격 잠금 해제` → toggle flips to 해제 → 0.8 s → flips back to 잠금; door-lock motor from the **door direction** (3D); `{NAME}`: `다 보여 ㅎ`. 2nd try: `계속 해봐`. 3rd: `그거 누르는 거 다 보여, {NAME}야`. **4th try** → system toast `다른 기기에서 이 화면을 보는 중입니다 (화면 공유)` (T3 delivered in-world).
2. The **cast icon** has been in the status bar since unlock (sharp players can solve this early; reward toast `…처음부터 보고 있었어.`).
3. **Synced tabs** (인터넷 › 탭 › `다른 기기의 탭 · Galaxy (SM-G991N) · 방금 전`) — live window into him and an in-world hint system; max 4 rows, chosen by state (§4.5).
4. **Cut** (two routes): pull down the quick panel (pointerdown at y 8–40 px + drag > 40 px; desktop: click status bar) → card `📡 화면 공유 중 · sagongsa의 Galaxy · 연결 04:2x:xx` [중지] → `화면 공유를 중지할까요?` [중지]. Or 설정 › 연결 › `화면 공유(스마트뷰)` › `연결됨 · sagongsa의 Galaxy` › [연결 끊기].
5. **Effect**: cast icon gone + `cast.end` sweep + 80 ms glitch. `state.mirroring=false` (all reactive behavior stops forever). Burst from `{NAME}` (his tone, 9 s): `…{NAME}야?` / `화면 왜 안 보여` / `뭐 했어` / `다시 켜` / `{NAME}야` / `대답해` / `대답해` / `대답해` → silence. 3 knocks inside the wardrobe. **GSM buzz** begins (he's moving; proximity tell). Synced tabs freeze: `마지막 동기화 2분 전 → 5분 전…`.
6. **Psychological peak (M5 + 30 s)**: notification `공유 앨범 '콩이' · sagongsa님이 사진 1장을 추가했습니다`. Opening it: the **player's own face** from face login, processed (green night-vision grade, noise matched to frame std, scanlines, timestamp `2026.11.24 04:2x`) with a dark figure blended at 22% into the darker side of their *real* background (left/right third luminance test; silhouette multiplied by local mean colour + matched noise). Comment: `sagongsa: 이게 {NAME} 얼굴이구나.` Fallback (no camera): `haru_fallback.jpg` (back of a person on this bed holding a glowing phone, from the gap). Info: `기기: 세아의 Galaxy · 전면 카메라 · 업로드 대기 → 완료 (04:2x)`.
- Sets `M5`. **Hints**: T1 `그 사람은 내가 뭘 누르는지 어떻게 이렇게 빨리 알까?` · T2 `이 폰 화면을 같이 보고 있는 거라면? 배터리 옆 작은 네모 아이콘. 맨 위를 끌어내려 봐.` · T3 `빠른 설정 › 화면 공유 [중지] (또는 설정 › 연결 › 화면 공유 › 연결 끊기).`

### P7 — 그 사람 기기 차단 → MFA 폭탄 → 보호하기
- 해솔홈 › 기기 관리:
  - `세아의 Galaxy · 이 기기`
  - `거실 허브 · 404호`
  - `로봇청소기 콩콩이 · 404호 · 오프라인`
  - `옷장 문 센서 · 404호`
  - `sagongsa · Galaxy S21 (SM-G991N) · 404호(실내) · 마지막 접속 방금` [차단]
  Identity sources: H4 likes (`sagongsa`), 알림 기록 (`새 기기 SM-G991N 로그인 02:58`), 로그인 기록, the door tile (`요청 SM-G991N`), and `404호(실내)` itself.
- **Wrong block** (any other row): `차단 완료` → 1 s → `관리자 잠금 유지 · 요청 기기 SM-G991N` + `{NAME}`(if mirroring) or knock (if not) — time only.
- **Block his device** (requires `mirroring=false`; if still mirroring, it snaps back like P6): `차단 완료` → 2 s → **MFA bombing**: 5 modal prompts at intervals 7, 6, 5, 4, 3 s; button order randomized per prompt; tri-tone alert + heartbeat (bpm +10 per prompt) + Android vibrate.
  - Prompt text: `해솔홈 로그인 요청` / `기기: SM-G991N · 서울 마포구` / **`요청 위치: 이 기기로부터 1m 이내`** / [거부] [허용]
  - Prompt #3 = number matching: `다른 기기에 표시된 숫자를 선택하세요` / `47` `18` `92` / `요청하지 않았어요`. Simultaneously (GSM buzz spike, no screen-share needed — he's guessing) a 톡 from `{NAME}`: `47 눌러. 그럼 문 열어줄게.`
  - Correct: deny all 5 (`요청하지 않았어요` on #3) → `의심스러운 로그인 시도 5회 · 계정을 보호할까요?` [보호하기] → `✔ 다른 모든 기기에서 로그아웃되었습니다 / ✔ 원격 관리자 잠금이 해제되었습니다 / ✔ 도어락 보안 모드: 외부 비밀번호 입력 차단 / ✔ 네트워크 제한이 해제되었습니다`. Sets `M6`, `remoteAdmin='none'`, `netFree=true`. CCTV → EPS door ajar. 비상벨 still grey (`관리자 잠금 해제 후 1회 사용 가능` — becomes red only in P8).
  - Fail (허용 or 47): `로그인 승인됨` → door tile back to 잠금, device row re-appears, `{NAME}`: `고마워 {NAME}야 ㅎ`. Re-block restarts the sequence. After 2 fails: prompts every 8 s, buttons stop swapping, [거부] is 1.5× larger (assist). Notebook stays reachable over the modal.
- Clues: memo p.1 `그 사람이 허용 누르라고 하면 절대 누르지 마.` · OTP mail footer `해솔홈은 절대 승인 요청을 대신 눌러달라고 하지 않습니다.`
- After M6 (optional): outgoing 톡 works. 지민 reply to any message: `…누구세요?` / `세아 폰을 왜` / (after player picks chip `404호에 갇혔어요. 옷장 뒤에 사람이 있어요. 신고해 주세요`) `지금 112 신고할게요!!` / `문 열리면 바로 나가요 제발` → `jiminTold`. 엄마: see §4.1.
- **Hints**: T1 `네가 로그인한 게 아니잖아.` · T2 `숫자를 누르라는 건 그 사람이 들어오려는 거야. 전부 거부.` · T3 `거부 ×5 (숫자 화면에선 '요청하지 않았어요') → 보호하기.` (Block step: T1 `어느 기기가 '404호(실내)'에 있지?` · T2 `sagongsa = 사공사 = 404. 그 사람 계정.` · T3 `기기 관리 › sagongsa (SM-G991N) › 차단.`)

### P8 — 문 열기 / 클라이맥스 (★ Signature 4; JS2) — ~3.5 min, never a game over
**Door keypad**: 카메라 › door wall › door lock → keypad close-up (keys 0–9, `*` 지우기, `#`/✔ 확인; 6-slot display). Wrong code → `삐삐삐` (`S.doorlockError`) + 1 knock inside wardrobe; unlimited tries; 5 wrong → 20 s `입력 제한` (time only). Special feedback: entering 4 digits that match `4729` → `…두 자리가 더 있어.` (notebook).
- **Before M6**: `472906` → `띠리릭` → 0.3 s → `관리자 잠금 재설정 (SM-G991N)` beep ×2 + `{NAME}`: `ㅋ` (or knock if not mirroring). Notebook: `그 사람을 먼저 끊어야 해.`
- **After M6**: `472906` → **opening melody** C6-E6-G6-C7 (40 ms each) + motor + latch → M7. Clock 04:41, battery `1%` + `절전 모드` (CSS brightness .55), `배터리 부족으로 플래시를 끌게요.` Mono audio forced off.
**Sequence** (each waiting step has a max wait and an equal fallback):
1. Tap the handle → door opens 10 cm and **stops with a metal clank**: the door guard (U-bar) is latched (it has been latched since F3 — room-change beat). Text: `도어가드가 걸려 있다. …내가 건 적 없는데.` Behind-left (wardrobe): **plywood panel slides**. GSM buzz swells. Fridge hum ramps to 0 over 0.3 s (room "listens").
2. Notebook flashes 세아's handwriting (from memo p.1): `그 사람이 나오면 폰을 엎어. 화면 빛 보고 와.` Prompt: `휴대폰을 엎어서 빛을 숨기세요` + flip icon. Fallback button `숨기 (길게 누르기)` (press-and-hold anywhere; desktop Space/mouse). Max wait 20 s → fallback prompt enlarges.
3. **Face-down** (`|β|>140°` held 400 ms; up = `|β|<70°`) → pure black, wake lock held. **22 s binaural script** (HRTF; listener fixed): wardrobe door creak (az 270°) → socked footsteps wardrobe→bed (0.95–1.25 s apart) → bed creak, he sits (3 s) → footsteps toward the listener, stop 0.6 m left → in-ear breathing 6 s → whisper (`ear` variant) `{NAME}야… 자?`. Lifting early: tape-stop, text `…빛이 샜다.`, two fast steps closer, then the script resumes from "footsteps toward" (costs ~8 s).
4. **Mom calls**: the phone itself rings at full level (dry, center) + `vibrate([800,400,800,400,800,400,800])` (iOS: loud audio buzz + screen-edge jitter). On flip-up the screen shows `엄마 · 보이스톡` (`(367)` if `momRead`) [거절] [수락]. Must tap **거절** within 6 s (12 s after 1 fail; full-width button after 2 fails). Fail (수락 or timeout): 3 rushing steps → muffled thud → 1 s black → `숨을 고르고, 다시.` → back to step 3 (no scare spent).
5. Success → 3 s silence → breath fades → footsteps return to the wardrobe → panel scrape → creak. Notebook: `지금이야.` Flashlight returns: `5초만.`
6. **Door guard**: drag the U-bar right (1.3 s travel). Scrape gain = drag speed (fast = loud; if too fast, footsteps pause + `…?` and a 2 s wait — never fail). Meanwhile the GSM buzz drifts **away** from the wardrobe toward the front door (he's going out through the shaft → EPS). Attentive listeners feel it.
7. Release → door swings open onto a black hallway. 0.7 s. Sensor relay `딸깍` → hallway light floods → **JS2**: `js2_hallway` — he stands 1 m outside, cap shadow, {NAME}'s phone glowing in his hand. `sting_js2` (no pre-swell) + `vibrate` + 400 ms shake + hearing LPF to 900 Hz recovering over 4 s.
8. Auto: `몸이 먼저 문을 닫았다.` → slam + auto-lock (descending melody). Outside, **six keypad beeps the player now recognizes** (F5 B5 D5 D6 E6 A5 = 4-7-2-9-0-6) → `삐삐삐` → toast `도어락 · 보안 모드: 외부 비밀번호 입력이 차단되었습니다`. Then toast `해솔홈 · 차단된 기기(SM-G991N)의 요청이 거부되었습니다`. Tinnitus 7.2 kHz −30 dB fading 5 s, heartbeat 120 bpm ×8.
9. 8 s later: scraping + knock **inside the wardrobe wall** (he's coming back through the shaft). 해솔홈 opens by itself: **비상벨** turns red: `비상벨 · 2초간 길게 눌러 호출`. Hold 2 s (ring fill).
10. **비상벨** siren (two-tone 960/770 Hz) + all lights on (600 ms crossfade to `room_lit_nest`, overexposed then settling) + PA chime (G5 E5 C5 G4) + PA voice `404호 비상 호출입니다. 경비원이 올라갑니다.` + neighbors' doors (`뭐야?!` subtitle) + running on stairs. Wardrobe silent; GSM buzz drops away fast. Clock **04:44** (frozen). If `jiminTold`: police siren approaching outside (doppler, LP opening).
11. **Lit room** (2–3 optional hotspots): the wardrobe stands open, back panel pushed in — the nest: blanket, food wrappers, **세아's 오르골**, polaroids of 세아 and of {NAME}. Tap 오르골 → one warm bar. Tap polaroids → `…1년 동안, 저 안에서.` Then 3 firm knocks + radio squelch: `경찰입니다. 문 열어주세요.` → swipe the handle → white → `방탈출 성공`.
- **Climax hints** (notebook stays reachable): face-down T1 `세아가 그 사람이 나오면 뭘 하라고 했지?` T2 `폰을 엎어서 빛을 숨겨.` T3 `진짜 폰을 화면이 바닥을 향하게 엎어. 센서가 안 되면 화면을 길게 눌러.` · mom call T1 `소리가 나면 들켜.` T2 `폰을 뒤집어서 끊어.` T3 `뒤집고 '거절'.` · door guard T3 `문 위쪽 U자 걸쇠를 오른쪽으로 천천히 밀어.` · 비상벨 T3 `해솔홈 비상벨을 2초 길게 눌러.`
- After 2 fails at any climax step: `조금 쉽게` chip appears (notebook voice: `괜찮아, 천천히.`) → wider windows, no fail.

### END — 새벽 7시 (≈3 min, tap-advance only)
1. White → `dawn_exterior` (blue hour), rain bed fades over 20 s, sparse birds, first bus at 30 s. Status `07:00`, battery `1%`.
2. Notification `메일 · 예약 메일 · 윤세아` → **세아's scheduled email** (§4.3) — emotional close.
3. 톡 › 엄마: input enabled for the first time. Chips (editable): `어머님, 저는 404호에 새로 이사 온 사람이에요. 세아 씨 폰을 찾았어요.` / `세아 씨가 남긴 메일이 있어요.` Mom types… (6 s) → see §4.1 ending thread → `메일 공유` → `고마워요.` → photo `kongi_old` → `콩이가 아직도 현관에서 기다려요.` The 오르골 **warm version** plays under it (−16 dB, resolves to A major).
4. Text card (Gowun Batang, centered):
   ```
   경찰은 404호 붙박이장 뒤 배관 점검구에서
   1년 치의 사진과 윤세아 씨의 물건들을 수거했다.

   윤세아 씨의 행방은 아직 찾지 못했다.
   그 남자는 아직 잡히지 않았다.
   ```
   Variant lines: `jiminTold` → `지민의 신고로 경찰은 04시 51분에 도착했다.` · `managerExposed` → `해솔빌 관리사무소는 '관리실' 사칭 번호를 신고했다.` · `momRead` → `그날 아침, 세아 엄마는 1년 만에 처음으로 전화를 걸지 않았다.`
5. Credits (short, over dawn): `기획·제작 {MAKER}` / `주인공 {NAME}` / `목소리: AI 음성(OpenAI TTS)` / `사진: AI 생성 + 직접 편집` / `소리: 전부 직접 합성` / `이 게임은 아무 데이터도 보내지 않았어요. 카메라 사진은 방금 지워졌어요.`
6. **JS3 sting** (3 s black): his notification tone only (no loud hit) + `vibrate([120,80,120])`. Banner `{NAME} · 지금`. Tap → chat `{NAME}` (empty) → one bubble with the **real local time** `HH:MM`: `재밌었어? 다음 집에서 봐 🙂` → typing dots… stop. Never a second message. If camera permission is already `granted` (permissions.query) AND `cameraOptIn` AND not '덜 무섭게': 1.5 s later 2.5 s "CCTV" overlay from the **rear camera** (`facingMode:'environment'`): monochrome, CSS fisheye, scanlines, `실내 카메라 2 · REC ●`, real timestamp → static → black. If state is `prompt`/unknown → skip silently.
7. **Friend's letter** (`CONFIG.ENDING_LETTER`, handwriting font, paper texture). Suggested first line for the maker: `마지막 거 놀랐지? ㅋㅋ`. Buttons: `진짜로 보내기` (navigator.share `{title:'하루를 위한 방탈출!', text:'나 404호에서 탈출했어. 비번은 472906이었어. · {NAME}', url}`; fallback clipboard + toast `복사했어요. 친구에게 붙여넣어 보내 주세요.`), `처음부터`, `사진 지우기 ✓(자동 완료)`.
8. **Post-game revisit** (`save.ending=true`): title screen subtly changed — wallpaper = wardrobe slightly open, `부재중 보이스톡 1 · {NAME}`, earphone test plays **4** knocks, tab title `(1) {NAME}야` + red-dot favicon until first tap. Plus calm `엔딩 다시 보기` and `처음부터`.

---

## 4. In-game Korean text (canonical)

Style: KakaoTalk-like. Short bubbles. Dates as date dividers (`2025년 11월 22일 토요일`). `(1)` = unread receipt. Long histories are rendered as **collapsed month groups** (`2026년 2월 · 메시지 29개 펼치기`) so 365 bubbles stay fast.

### 4.1 톡 (messenger) — chat list order (top = newest)
`엄마 📌` (unread 365+) · `{NAME}` (appears at F1) · `관리실` · `지민` (unread 214) · `해솔빌 404호 이사 (택배)` (flavor, 2026.11.23 `[택배] 고객님의 상품이 문 앞에 배송되었습니다`).

**지민** (selected days, verbatim)
```
── 2025년 3월 10일 ──
세아: 오늘 옷장 수리 기사님 옴
세아: 관리실에서 보내줬는데 엄청 친절하심ㅋㅋ
지민: 오 그 삐걱거리던 옷장?
세아: ㅇㅇ 근데 한 시간 넘게 옷장 안에서 뭘 하시더라
세아: 원래 그렇게 오래 걸림?
지민: 몰라ㅋㅋ 붙박이장이라 그런가

── 2025년 6월 3일 ──
지민: ㅋㅋㅋㅋㅋ너 또 한영키
지민: 'dkssud' 이게 뭐냐고ㅋㅋㅋ
세아: 안녕이라고 친 거임ㅋㅋㅋㅋ
지민: 이거 비번으로 쓰면 아무도 모르겠다
세아: 오 천재? 메모 비번 이렇게 바꿔야지
세아: 우리집 막내 이름으로 ㅎㅎ

── 2025년 7월 19일 ──
세아: 야 카톡 삭제해도 알림기록에 다 남는 거 알았음??
세아: 설정-알림-알림 기록 ㅋㅋ 개꿀팁
지민: 헐 전남친 삭제한 거 다 보이겠네
세아: ㅋㅋㅋㅋㅋ

── 2025년 8월 14일 ──
세아: 아 그리고 폰 흔들면 실행취소 되는 거 앎??
세아: 메모 과제 다 날렸다가 흔들어서 살림ㅋㅋㅋ
지민: 헐 대박 몰랐어
지민: 근데 그거 세게 흔들다 폰 날리겠다

── 2025년 10월 2일 ──
세아: 요즘 폰 맨 위에 네모난 아이콘이 자꾸 떠 있음
세아: 이거 뭐임
지민: 스마트뷰 아님? 티비 연결했냐
세아: 우리집 티비 없는데;;
지민: 그럼 몰라ㅋㅋ 껐다 켜봐
지민: 아 근데 너 그 오르골 아직도 들고 다니냐ㅋㅋ
세아: 보물 1호인데 당연하지;; 엄마가 사준 거란 말이야

── 2025년 11월 19일 ──
세아: 지민아 혹시 밤에 우리집 쪽 창문 봐?
지민: ??? 갑자기
세아: 아냐 그냥ㅋㅋ

── 2025년 11월 22일 ──
세아: 지민아 내 모먼트 글들 잘 봐줘
세아: 순서대로
지민: ㅋㅋ 뭔소리야 좋아요 다 눌렀는데
세아: ㅎㅎ 고마워

── 2025년 11월 24일 ──
세아: 지민아                                    03:30
지민: ?? 왜 새벽에                                 08:12
지민: 세아야 전화 왜 안 받아                        12:40
지민: 너 어디야 진짜                                 21:03

── 2025년 11월 25일 ── (from here every bubble keeps its (1))
지민: 세아야 제발 전화 좀 (1)
지민: 어머님이랑 경찰서 다녀왔어 (1)
── 2025년 12월 24일 ──
지민: 메리 크리스마스… (1)
지민: 콩이는 어머님이 데려가셨어. 잘 지내 (1)
── 2026년 3월 17일 ──
지민: 오늘 콩이 온 날이래. 어머님이 사진 보내주심 (1)
── 2026년 7월 2일 ──
지민: 나 아직 밤마다 너네 집 창문 봐 (1)
지민: 불 꺼져 있는 거 알면서 (1)
── 2026년 11월 23일 ──
지민: 니 방에 오늘 누가 이사 왔더라 (1)
지민: 이상하게 화가 나 (1)
── 2026년 11월 24일 ──
지민: 1년이야. 보고 싶다 세아야 (1)                 00:00
```
Input before M6: send fails `전송 실패 · 관리자 네트워크에서 발신이 제한되었습니다.` After M6 (chips): `저 세아 씨 폰을 주운 사람이에요. 404호에 새로 이사 왔어요.` / `옷장 뒤에 누가 있어요. 112에 신고해 주세요.` → 지민: `…네?` / `세아 폰을 왜` / `잠깐만요 옷장 뒤?` / `지금 112 신고할게요!!` / `문 열리면 바로 나가요 제발` (`jiminTold`).

**엄마** (collapsed groups; key lines verbatim)
```
── 2025년 11월 24일 ──
세아: 엄마 나                                        03:33
엄마: 세아야 새벽에 왜? 무슨 일 있어?                 07:10
엄마: 엄마가 전화 못 받았네 미안해
엄마: 전화 좀 받아
── 2025년 11월 25일 ──
엄마: 세아야 엄마 지금 올라가 (1)
── 2025년 12월 1일 ──
엄마: 콩이는 엄마가 데려왔어. 걱정하지 마 (1)
── 2025년 12월 25일 ──
엄마: 오늘 너 좋아하는 김치찜 했어 (1)
── 2026년 1월 1일 ──
엄마: 새해 복 많이 받아 우리 딸 (1)
── 2026년 2월 3일 ──
엄마: 엄마가 요금은 계속 낼게. 번호 살려둘게 (1)
── 2026년 3월 17일 ──
엄마: 콩이 오늘 우리집 온 날이다. 간식 줬어 (1)
── 2026년 5월 8일 ──
엄마: 지민이가 꽃 보냈더라. 니 몫까지래 (1)
── 2026년 8월 20일 ──
엄마: 콩이 밥 잘 먹어 (1)
── 2026년 11월 20일 ──
엄마: 세아야 다음주면 1년이야 (1)
── 2026년 11월 24일 ──
엄마: 세아야 답장 안 해도 돼. 읽기만 해. (1)          00:01
엄마: 숫자 1만 없어지면 엄마는 돼. (1)
엄마: 세아야 오늘로 1년이야. 엄마 오늘도 전화했어. (1)  03:33
[보이스톡 부재중 · 03:33]
```
Every night between, a system line `[보이스톡 부재중 · 03:33]` (366 total; counted in the header `부재중 보이스톡 366`).
- **On first open (`momRead`)**: all `(1)` fade, 30 ms stagger, accelerating, soft tick each (can't be stopped). +25 s (safe zone): `엄마: 세아야?` / `읽었어???` / `세아야 엄마야` / `전화 받아` (typing dots between) → incoming `엄마 · 보이스톡` rings 2× → **declined with no touch** (`통화 거절됨`; decline button animates pressed). If `mirroring`: `{NAME}`: `엄마한테 연락하지 마.` (If this precedes F1, it is first contact; `{NAME}야.` follows at F1.)
- **After M6** (player writes, chips): `저 세아 아니에요. 404호에 새로 이사 온 사람이에요.` → 엄마 typing on/off ×3 (20 s) → `…누구세요?` → (`세아 씨 폰을 찾았어요. 옷장 뒤에 누가 있어요.`) → `404호요?` / `지금 갈게요. 경찰에 신고할게요` (`momTold`).
- **Ending thread** (END step 3): player chip → 엄마 (6 s typing) `…세아가 뭐라고 했어요?` → player `메일 공유` (card of the 1-year email) → `…` (10 s) → `고마워요.` → `[사진: 콩이]` → `콩이가 아직도 현관에서 기다려요.` → (if `momTold`/`momRead`) `오늘은 전화 안 할게요. 대신 내일 아침에 콩이 데리고 산책 갈게요.`

**관리실** (him, persona A)
```
── 2025년 3월 8일 ──
관리실: 안녕하세요 해솔빌 관리실입니다 ^^
관리실: 404호 붙박이장 문 수리 접수되어 3/10(월) 14시에 기사님 방문 예정입니다.
세아: 네 감사합니다!
── 2025년 3월 10일 ──
관리실: 수리 잘 되셨나요? 불편하신 점 있으면 언제든 연락주세요 ^^
── 2025년 4월 2일 ──
세아: 관리실님 혹시 404호 옆에 빈 공간 있나요? 밤마다 옷장 뒤에서 긁는 소리가 나요
관리실: 404호는 끝 세대라 옆은 벽이에요 ^^ 배관 소리일 거예요
── 2025년 11월 20일 ──
세아: 새벽에 도어락이 안 열려요. 관리자 잠금이라고 떠요
관리실: 확인해 보니 일시적 오류네요 ^^ 아침엔 풀릴 거예요
관리실: 옷장은 여시지 마세요. 아직 수리 중이라서요
── 2026년 11월 24일 ──
관리실: 404호 새로 입주하신 분 맞으시죠?                      03:39
관리실: 새벽에 도어락 오류 신고가 들어와서 연락드려요 ^^
관리실: 문이 안 열리시면 도어락에 *0404# 눌러보세요. 초기화됩니다.
관리실: 그리고 붙박이장은 경첩이 고장나서 절대 여시면 안 됩니다. 다쳐요.
[삭제된 메시지입니다]                                          04:04
관리실: 죄송합니다 잘못 보냈네요 ^^
```
After *0404#: `그 번호 아니에요 ^^ 다시 알아볼게요`. After M5 he never writes as 관리실 again.

**{NAME}** (him, persona B, from the player's stolen account) — all lines, with triggers
| Trigger | Lines |
|---|---|
| F1 (knockedBack) | `똑똑 해줘서 고마워 ㅎ` → `{NAME}야.` |
| F1 (not) | `착하네. 대답 안 하고.` → `{NAME}야.` |
| momRead (mirroring) | `엄마한테 연락하지 마.` |
| F2 | `배터리 4%네.` / `얼마 안 남았다 우리.` |
| call declined (H6) | `…전화하지 마.` |
| F3 | `사진 잘 봤어?` (if vault seen) / else `찾아봐. 다 있어.` |
| watcher (mirroring, after F1; ≤10 lines, 75 s cooldown, 4–9 s delay, typing dots) | 갤러리 `사진 구경 재밌어?` · 메모 `거긴 이제 아무것도 없을 텐데` · 계산기 `계산 잘해?` · **녹음 `그거 그냥 잡음이야`** (proves he never listens) · 모먼트 `세아 글 예쁘지` · 해솔홈 `거기 들어가서 뭐 하게` · 설정 `뭐 찾아?` · 2nd wrong password anywhere (30%, max 2) `틀렸네 ㅎ` · return after >5 s away `어디 갔다 왔어? 화면 꺼지니까 심심하잖아` → later `{n}번째야.` |
| P6 snap-backs | `다 보여 ㅎ` / `계속 해봐` / `그거 누르는 거 다 보여, {NAME}야` |
| P6 cut burst | `…{NAME}야?` `화면 왜 안 보여` `뭐 했어` `다시 켜` `{NAME}야` `대답해` `대답해` `대답해` |
| P7 MFA | `47 눌러. 그럼 문 열어줄게.` · fail: `고마워 {NAME}야 ㅎ` |
| Door before M6 | `ㅋ` |
| JS3 (real time) | `재밌었어? 다음 집에서 봐 🙂` |
Typing dots in this chat whenever the player types anywhere (mirroring, after F1, max 3 times). Player can send messages here (allowed room); replies: first `…` then nothing (he only acts).

### 4.2 메모
List: `🔒 이 폰을 찾은 사람에게` (2025.11.23) · `장보기` · `음향학 과제 메모` · `비번들` (texts in P3).

**Page 1 — 이 폰을 찾은 사람에게** (full, restored)
```
이 폰을 찾은 사람에게.

그 사람은 내 문자, 사진, 메모를 다 봐.
이 화면도. 아마 지금 이 글도.
근데 소리는 못 들어. 화면만 보거든.
그래서 진짜 중요한 건 전부 소리에 숨겼어. 나 음향과잖아 ㅎ

세 가지만 기억해.
① 화면 맨 위, 배터리 옆에 작은 네모 아이콘이 있으면 그 사람이 지금 보고 있는 거야.
② 네가 안 보면, 그 사람은 움직여.
③ 옷장 쪽에서 노크 소리가 나도 절대 대답하지 마. 그 사람은 그걸로 사람이 깼는지 확인해.

현관 도어락은 그 사람이 '관리자 잠금'으로 잠가.
관리자 비밀번호는 여섯 자리야. 내가 아는 걸 세 군데에 나눠 숨겼어.
 ① 11월 20일 새벽 '소리 감지 녹음'. 도어락 소리를 잘 들어. 앞에 두 번은 들려.
 ② '잡음 (지우지 마)'. 두 귀로 들으면 절대 안 들려. 소리를 하나로 합쳐.
 ③ 마지막 두 자리는 못 알아냈어. 근데 그 사람은 뭐든 사진으로 찍어 둬.
    그 사람이 숨긴 사진 속에 있을 거야.

비밀번호만으로는 안 열려. 그 사람이 다른 데서 다시 잠가.
그 사람을 먼저 끊어.
그 사람이 '허용' 누르라고 하면 절대 누르지 마.

관리실은 믿지 마. 진짜 관리실 번호는 문에 붙어 있어.

그 사람이 옷장에서 나오면 폰을 엎어. 화면 빛 보고 와. 숨도 참아.

내가 마지막에 올린 글들, 첫 글자만 읽어. 시간 순서대로.  → 🔒 2쪽

미안해. 너는 꼭 나가.
```
**Page 2** (acrostic unlock)
```
2쪽.

처음엔 내가 예민한 줄 알았어.
3월에 옷장 고친다고 기사님 왔을 때부터 이상했는데.

10월에 저장공간 보다가 알았어. 계산기가 2.1GB야.
사진이 들어 있는 거야. 근데 난 못 열었어.

화면 위 네모 아이콘은 '화면 공유'래. 우리 집엔 TV도 없는데.
끄면 다음 날 또 켜져 있어. 그래서 이제 안 꺼. 끄면 그 사람이 알아.

22일 밤엔 자는 척하고 봤어. 문 앞에서 누르는 손가락.
가운데 두 자리. 여기엔 안 써. 잡음 녹음에 넣어 뒀어.

그 사람 계정 이름도 봤어. sagongsa. 사공사.
우리 집 호수로 이름을 지은 거야.

옷장 안쪽 벽, 두드리면 통통 소리 나. 비어 있어.
엄마한테는 말 못 했어. 걱정할까 봐. 바보같이.

지민아. 이거 보면 내 글 순서대로 다시 읽어줘.
```

### 4.3 메일 (one list screen + reader; account seah.y@hanmail.net)
| Date | From | Subject | Body (key text) |
|---|---|---|---|
| on demand (P5) | 해솔홈 <no-reply@haesolhome.kr> | `[해솔홈] 본인확인 인증번호 안내` | `안녕하세요, 해솔홈입니다.` / `요청하신 인증번호는 [ 482913 ] 입니다.` (per-session random) / `본인이 요청하지 않았다면 이 메일을 무시하세요.` / `※ 해솔홈은 절대 전화·메시지로 '승인 요청을 대신 눌러 달라'고 하지 않습니다. 로그인 승인 요청을 받았는데 본인이 시도한 것이 아니라면 반드시 [거부]를 눌러 주세요.` |
| 2026.11.24 07:00 (END) | 윤세아 (예약 발송) | `1년 뒤에 이 메일을 읽을 누군가에게` | see below |
| 2026.11.01 | 해솔빌 관리사무소 <noreply@haesolvil.kr> | `[해솔빌] 11월 관리비 고지서` | `404호 관리비 87,400원 …` / `※ 관리사무소는 새벽 시간에 개인 문자·메신저를 보내지 않습니다. '관리실'을 사칭한 연락에 주의하세요. 문의 02-338-5120` |
| 2025.11.15 | 한빛예대 음향디자인과 | `[졸업작품] 중간 발표 일정 안내` | `윤세아 학생 — 작품명: 「들리지 않는 방」(가제) · 11/21(금) 14:00 B103` |
| 2025.10.27 | 모아마켓 | `주문하신 상품이 배송 완료되었습니다` | `문틈 막이 바람막이 2m (화이트) 외 1건 — 도어 가드 보조 잠금장치` |

**세아's scheduled email (END)** — `예약 발송: 2025.11.23 23:58 → 2026.11.24 07:00`
```
이 메일이 도착했는데 내가 예약을 취소하지 않았다면,
나는 아마 못 나간 거겠지.

그럼 이 폰을 들고 있는 너는, 나간 거야. 그치?
그래서 1년 뒤 아침 7시로 맞춰 놨어. 아침이면 좋겠어서.

부탁 하나만 할게.
우리 엄마한테 이 메일 좀 보여줘.

엄마. 그날 전화 못 받은 거, 절대 엄마 잘못 아니야.
콩이 산책은 하루에 두 번. 간식은 저녁에만.
그리고 엄마,
하루에 한 번만 나 생각해줘. 딱 한 번만.
나머지 시간은 엄마 하고 싶은 거 하면서 살아.

이름도 모르는 너한테.
고마워. 진짜로.

— 세아
```
If `PLAYER_NAME==='하루'`: after 1.5 s the words `하루에 한 번만` get a soft pen underline + notebook line `…하루에 한 번만.` (one italic beat, no explanation).

### 4.4 전화 (no SIM)
- **키패드**: any call → `전화를 걸 수 없음 · SIM 없음 (Wi-Fi 통화는 SIM이 필요합니다)`. 112/119 → `긴급 통화 연결 실패 · 셀룰러 신호 없음`.
- **최근 기록**: `2025.11.24 03:31 · 엄마 · 발신 · 응답 없음` (top) · `2025.11.20 03:41 · 지민 · 발신 · 0:42` · `2025.11.10 · 엄마 · 수신 · 12:03` · … then banner `이후 기록 없음 · SIM 없음`. (톡 voice calls are in 톡, not here.)
- **연락처**: `엄마 ♥` · `지민` · `관리실 010-8817-3302 · 최종 수정 2025.11.25 04:10 · 다른 기기` · `{NAME} · 메모: 새로 이사 온 사람 · 생성 2026.11.23 23:41 · 다른 기기` (number shows `010-0xxx-{CONFIG.HARU_LAST4 or 0404}` — never-issued 010-0 range).

### 4.5 인터넷
- **열린 탭**: `해솔빌 20대 여성 실종 1년… 가족 "아직 번호 살려둬"` (opened 2026.11.20 by 다른 기기). Article (short): `지난해 11월 24일 새벽 마포구의 한 오피스텔에서 실종된 윤모(24) 씨의 행방이 1년째 묘연하다. 경찰은 외부 출입 흔적이 없다는 점에 주목했지만 단서를 찾지 못했다. 윤 씨의 어머니는 "딸 번호를 아직 살려 두고 매일 밤 전화를 건다"고 말했다. 윤 씨가 살던 404호에는 최근 새 세입자가 입주했다.`
- **기록** (newest first; first row is meta):
  - `{location.host} · 하루를 위한 방탈출! · 오늘 {first-open time}`
  - `하루 이름 뜻 · 오늘 01:58` (uses `{NAME} 이름 뜻`)
  - `해솔빌 404호 새 입주자 · 어제 23:40`
  - `자는 사람 안 깨우고 문 여는 법 · 어제 23:12`
  - `옷장 경첩 소리 안 나게 하는 법 · 3일 전`
  - `도어락 관리자 모드 원격 설정 · 5일 전`
  - `실종 1년 공소시효 · 2주 전`
  - ─ 2025 (세아) ─ `스마트뷰 화면공유 끄면 다시 켜짐` (2025.10.03) · `위상 상쇄 모노 체크 원리` (2025.10.11) · `오르골 태엽 고치는 법` (2025.09.21) · `벽 속 빈 공간 소리로 찾는 법` (2025.04.03)
- **다른 기기의 탭 · Galaxy (SM-G991N) · {방금 전|N분 전}** — max 4 rows, chosen in order:
  1. always: `해솔홈 - 404호 도어락 관리`
  2. if !H1: `녹음 파일 몰래 지우는 법`
  3. if !H3: `계산기 금고 앱 안 들키게 숨기는 법`
  4. if !M4: `해솔홈 보안 질문 바꾸는 법`
  5. if M4 && mirroring: `화면 공유 끊김 방지 · 세아폰`
  6. if F≥2: `{NAME} 이름 뜻`
  After M5: list frozen + `마지막 동기화 2분 전` (grows).
- **북마크**: `해솔빌 입주민 카페` → `[공지] 4층 EPS실 출입 통제 안내 (2024.11.02)`: `4층 EPS실 내부 배관 점검구는 2019년 리모델링 시 404호 붙박이장 뒤쪽까지 연결된 구조로, 합판으로 폐쇄되었습니다. 무단 출입을 금합니다.` · `밤마다 404호 쪽 벽에서 긁는 소리 나요ㅠ (2025.05.11, 403호)` with comments `402호: 저도 가끔요 쥐인가` … and **today 03:31** by nickname `404`: `저도 들려요` + a black image. Held in view (≥90% visible, scroll < 50 px/s for 1.2 s) it brightens 0.05→0.9 over 3.5 s: `haru_fallback.jpg` (someone on this bed holding a glowing phone, seen from the wardrobe gap) = **you, now**. One low pulse; rain ducks. Partial brightness persists if scrolled away.
- **QR facility record** (`haesolvil.kr/as?unit=404`, from H5): title `해솔빌 시설 고장신고 이력 · 404호`
  | 일자 | 내용 | 신고자 | 처리 |
  |---|---|---|---|
  | 2019.06.14 | 리모델링: EPS실–404호 배관 점검구(60×90cm) 합판 폐쇄 | 관리사무소 | 완료 |
  | 2025.03.10 | 붙박이장 문 수리 | — | **접수 내역 없음** |
  | 2025.04.02 | 붙박이장 뒤 벽에서 긁는 소리 | 윤세아 | 보류 |
  | 2025.11.20 | 도어락 관리자 잠금 오류 | — | **접수 내역 없음** |
  Footer: `관리사무소는 새벽에 개인 문자·톡을 보내지 않습니다. 관리실 사칭에 주의하세요. ☎ 02-338-5120` · last line typed slowly: `이 기록을 열람한 기기: 2대 · 마지막 열람: 방금 전`.

### 4.6 모먼트 & 갤러리
- 모먼트 profile: `seah_y` · bio `음향과 · 소리 모으는 사람 🎧` · posts (newest first) = acrostic table (H4) + older: `2025.11.15 내 보물 1호 🎵 소리까지 들려주고 싶다` (LIVE, comments in P5) · `2025.10.11 믹스 끝나면 모노 체크 필수 ㅋㅋ 위상 뒤집힌 소리는 합치면 사라짐 (전공자만 웃음)` (mixing desk) · `2025.09.02 소리로 그린 콩이 🐶 녹음 앱에서 주파수 보기로 바꿔서 들어봐!` (dog_face) · `2025.03.17 콩이 우리집 온 지 2년 🎂` (dog_bed) · `2024.09.01 드디어 내 방!! 404호 🏠` (sea_room_1yr is NOT used here; use dog_bed crop).
- 갤러리 albums: `카메라` (세아's 2025 photos: dog_bed, dog_park, dog_face, mixing desk, mandarin, sky, clothes, mug, laptop) · `LIVE` (`IMG_1115`) · `공유 앨범 '콩이'` (members `세아 · 엄마 · sagongsa`!) · `내가 찍은 사진` (player's camera shots) · memories card `1년 전 오늘`. 편집 tools: 노출 / 밝기 / 대비 (only 노출 matters).
- **편집됨 beat** (after F2, next gallery visit): the player's earliest photo gets a pill `편집됨`; info `수정: 방금 전 · 기기: 알 수 없음`. Edit rules: room photo → a red finger-drawn circle around the bed; wardrobe photo → wider gap; anything else → `{NAME}` scrawled in the corner. `원본으로 되돌리기` works, then 3 s later the pill returns. If the player never took a photo, the first lock-screen camera open silently saved one (`스크린샷이 저장되었습니다`).

### 4.7 캘린더 · 시계 · 메시지 · 녹음 extras
- **캘린더** (month view, list below): `2025.03.10 (월) 14:00 옷장 문 수리 (관리실 기사님)` · `2025.03.17 콩이 온 날 2주년 🐶` · `2025.11.21 졸작 중간발표` · `2026.03.10 ♥ 1주년 · 추가한 사람: 알 수 없는 기기` · `2026.11.23 {NAME} 입주 · 추가한 사람: 알 수 없는 기기 · 23:41` · `2026.11.24 (종일) 1년 · 추가한 사람: 알 수 없는 기기`.
- **시계 › 알람**: `04:44 · {NAME}` (1회, 켜짐; long-press → `이 알람은 다른 기기에서 관리됩니다`, can't delete until END; in END it is deletable — small catharsis) · `07:00 · 콩이 산책` (꺼짐, 세아's). Seconds loop 57→58→59→57 while the clock is capped.
- **메시지 (SMS)**: banner `SIM 카드 없음`. Old threads: `[해솔빌] 붙박이장 수리 기사 방문 3/10(월) 14시 예정` (from 010-8817-3302 — the same number!) · `[Web발신] 택배 도착` · `[한빛예대] 수강신청`.
- **녹음** extras: `콩이 그림` (spectrum view shows 콩이's face) · `콩이 코골이ㅋㅋ` · `음향학 실습 - 방 IR 측정`. Every file: `파형 | 주파수` toggle, `0.75×` speed, `텍스트 보기` transcript chip.

### 4.8 설정 (screens that matter)
- Search bar (keywords → result rows).
- `연결` › `Wi-Fi: Haesol_404 (관리자 네트워크)` · `화면 공유(스마트뷰): 연결됨 · sagongsa의 Galaxy · 04:2x:xx` [연결 끊기] (P6) · `블루투스: 세아의 버즈 (연결 안 됨)`.
- `알림` › `알림 기록` (ON; "세아가 켬"): grouped list (newest first):
  `04:04 톡·관리실 [사진] 아직 안 자네 ㅎ` (only after the slip) · `03:39 톡·관리실 404호 새로 입주하신 분…` · `03:33 톡·엄마 부재중 보이스톡` · `03:12 메모 '이 폰을 찾은 사람에게' 열람됨 · 다른 기기` · `02:59 해솔홈 도어락 원격 관리자 잠금 설정 (요청 기기: SM-G991N · 관리자 PIN 변경 없음)` · `02:58 해솔홈 새 기기 SM-G991N 로그인` · `02:47 계산기 사진 1장 저장됨` · `00:12 화면 공유 시작됨 · sagongsa의 Galaxy`. Plus everything the player received in-game (single notification store).
- `손쉬운 사용` › `오디오` › `모노 오디오` (H2) · `흔들어서 실행 취소: 켬` · `글자 크기` (real setting: mirrors the game's text-size option).
- `디지털 웰빙` (H3) · `저장공간` (H3) · `배터리` (`23%… 사용량 1위: 시스템 서비스(화면 공유)`) · `휴대전화 정보` (`세아의 Galaxy · 모델 SM-S911N`).
- Quick panel (pull-down / status-bar tap): tiles `Wi-Fi` `블루투스` `손전등` `모노` (after seen) `방해 금지` + the **화면 공유 card** (P6).

### 4.9 Notification master list (banner texts; same store feeds 알림 기록)
| Trigger | App · Title · Body |
|---|---|
| Lock (M0) | see P1 |
| unlock+20 s | `갤러리 · 1년 전 오늘 · 2025년 11월 24일의 추억을 확인하세요` |
| unlock+60 s | `톡 · 관리실 · 404호 새로 입주하신 분 맞으시죠?` |
| P4 erase | in-app banner `✎ 알 수 없는 기기에서 편집 중…` |
| F1 | `톡 · {NAME} · {NAME}야.` (his tone) |
| F2 | `배터리 · 배터리 4% · 절전 모드를 켜세요` + `톡 · {NAME} · 배터리 4%네.` + 관리실 slip |
| F3 | `톡 · {NAME} · 사진 잘 봤어?` |
| M4+45 s | none (sound only: 오르골 in wardrobe) |
| M5+30 s | `갤러리 · 공유 앨범 '콩이' · sagongsa님이 사진 1장을 추가했습니다` |
| M6 | `해솔홈 · 계정이 보호되었습니다 · 원격 관리자 잠금 해제` |
| P8 | toasts `도어락 · 보안 모드: 외부 비밀번호 입력이 차단되었습니다` / `해솔홈 · 차단된 기기(SM-G991N)의 요청이 거부되었습니다` |
| END | `메일 · 예약 메일 · 윤세아` ; JS3 `톡 · {NAME} · 재밌었어? 다음 집에서 봐 🙂` |

### 4.10 Voice lines (pre-rendered TTS, always subtitled)
| ID | Voice / direction | Text |
|---|---|---|
| `v_sea_mono` | 세아, trembling whisper, 20s female, close | (H2 whisper text) |
| `v_him_shh` | male, low, very close whisper | `쉿.` |
| `v_him_ear` | male whisper, intimate, slow | `{NAME}야… 자?` (rendered for 하루; other names → runtime formant synth fallback) |
| `v_poweroff` | neutral carrier voice, telephone EQ | `전화기가 꺼져 있어 삐 소리 후 음성사서함으로 연결됩니다.` |
| `v_pa` | calm female PA, building speaker reverb | `404호에서 비상 호출이 접수되었습니다. 경비원이 올라갑니다.` |
| `v_police` | firm male, through steel door | `경찰입니다. 문 열어주세요.` |
| `v_neighbor` | startled male, muffled through wall | `뭐야?!` |
Credit: `목소리: AI 음성(OpenAI TTS)`. Fallback if a WAV fails: subtitle-only + `speechSynthesis` for PA/police/poweroff only (never for whispers).

---

## 5. Apps (home screen = 12 icons + 1 folder) — every icon holds a find

| App | Screens | Meaningful finds |
|---|---|---|
| **톡** | 채팅 목록, 채팅방, 프로필, 보이스톡 수신/발신 화면, 통화 바 | 지민 (3 tips + icon seed + 오르골 + SOS miss), 엄마 (366, read receipts), 관리실 (him, A), {NAME} (him, B; H6 call) |
| **전화** | 키패드, 최근 기록, 연락처, 연락처 상세 | No-SIM rule, 관리실 edit date, {NAME} contact made by 다른 기기 |
| **갤러리** | 앨범 그리드, 사진 뷰어 (pinch/double-tap 1-3-8×), 정보 시트, 편집(노출), LIVE long-press, 1년 전 오늘 카드, 그때와 지금 비교, 공유 앨범 | 1년 전 오늘, IMG_1115 LIVE (오르골), shared album (your face), 편집됨 beat |
| **카메라** | Room view (4 walls, drag/arrows/optional gyro), 플래시, 줌 1×/2×/8× pill + pinch, 셔터, 야간 모드 chip, 썸네일 | Door keypad (H1, P8), door sticker + QR (H5), under-bed bowl (P1 alt), wardrobe gap + knock-back, night mode 06 (H3 alt), H6 ring glow |
| **메모** | 목록, 메모 뷰, 잠금 화면, ⋯ 메뉴 (실행 취소/다시 실행), 툴바 ↶ ↷ | P3/P4, page 2 (H4), hints for mono (과제 메모) |
| **녹음** | 목록, 플레이어 (파형/주파수, 0.75×, 구간 반복, 음높이 보기, 텍스트 보기), 미니 플레이어 칩 | H1 소리 감지 녹음, H2 잡음, 콩이 그림 (spectrum tutorial) |
| **계산기** | 계산기, 기록, → 보관함 (폴더: 세아 / {NAME} / 기타) | H3 vault |
| **설정** | 검색, 연결 (화면 공유), 알림 (알림 기록), 손쉬운 사용 (모노, 흔들어서 실행 취소, 글자 크기), 디지털 웰빙, 저장공간, 배터리, 휴대전화 정보 + 빠른 설정 패널 | P6 cut, H2 mono, H3 forensics, H5 알림 기록 |
| **모먼트** | 프로필 피드, 게시물 상세(댓글/좋아요 목록), sagongsa 프로필 | H4 acrostic, 오르골 LIVE post, 모노 체크 post, 콩이 그림 post |
| **해솔홈** | 스플래시, 로그인, 비밀번호 찾기(보안질문→OTP), 대시보드, 도어락, CCTV, 기기 관리, 옷장 문 센서 이벤트 로그, 로그인 기록, 비상벨, 계정 보호 | P5–P8 core |
| **메일** | 받은편지함, 읽기 | OTP + MFA rule, 관리비 사칭 주의, 1-year email |
| **인터넷** | 열린 탭(뉴스), 기록, 탭 › 다른 기기의 탭, 북마크(입주민 카페), QR 페이지 | Meta URL in history, synced tabs (hint system), EPS notice, black photo of you |
| **기타 folder** | 캘린더, 시계, 메시지(SMS) | 03-10 repair / 1주년 / {NAME} 입주 by 알 수 없는 기기; 04:44 alarm; SMS from 010-8817-3302 |

Global UI: status bar (time from game clock, `SIM 없음`, Wi-Fi, cast icon while mirroring, battery), notification banners (tap → app), quick panel, notebook ✎, pause ⏸ (top-left long-press on status bar or 2-finger tap; desktop Esc), custom keyboard (Hangul composer via `es-hangul@2.3.x` pinned on jsDelivr, both legends on every key, 한/영 key, number row; desktop `e.code` mapping), mini-player chip, call bar.

---

## 6. Horror director & beat sheet

### 6.1 Director rules (`js/director.js`, data in `js/data/beats.js`)
- Beat schema `{id, act, when:(s)=>bool, where:'any'|'home'|'room'|'app:x'|'offscreen:viewId', cls:'micro'|'dread'|'js', mustSee, cooldown, run:async()=>{}}`; ticks every 1 s and on every bus event (`app:open/close`, `room:view`, `flag:set`, `input:focus/blur`, `visibility`).
- **Safe zones** (beats wait): keyboard open / text field focused, notebook open, permission or tutorial dialog up, scripted call active, MFA modal (except its own beats), first 20 s after a fragment (relief), first 45 s after JS1.
- **Queue**: blocked `mustSee` beats fire on the next app→home transition (app transitions = this game's "doors"). Max 1 queued beat per transition; `micro` beats older than 90 s are dropped.
- **Gaps**: ≥25 s between any two beats; `dread` ≤1/60 s (Acts 1–2), ≤1/40 s (Act 3).
- **JS budget**: JS1 (vault exposure >92%; only after M2 and ≥8 min of play), JS2 (P8 sensor light, fixed), JS3 (END sting, soft). Fail states never spend budget. `덜 무섭게` converts JS1/JS2 to dread versions (no shake/sting, slow fades) and skips the rear-camera sting.
- **Idle nudges**: no new flag for 150 s → directional knock from the room direction holding the next clue, or a synced-tab update; 240 s → notebook dot `새 단서`. Tier 3 is never auto-revealed.
- **Tension T** eases (20 s) to milestone targets (§2.1). T drives drone LP cutoff `160+900T` Hz, rain gain `.6+.4T`, vignette strength, micro-event rate (building creak/pipe every 120 s→40 s). Heartbeat bed only when T ≥ .8 and `audioMode='ear'`.
- `visibilitychange: hidden` freezes director, game clock *display*, audio; resumes quietly (room tone at current T, no stinger). Fired flags persist in the save → reload never replays JS1 or skips mustSee beats.

### 6.2 Beat sheet (keyed to flags; times are typical)
| ID | When (flag) | Where | Class | What happens (visual FX) | Sound cues |
|---|---|---|---|---|---|
| B00 | title | — | — | Title, warnings, 몰입 설정 | `ui.*`, earphone-test knocks L/R |
| B01 | start tap | black | dread | Third knock lie; `(…똑.)` | `knock.behind` (az 180°, LP 1.6k, closet IR) |
| B02 | +6 s | black | dread | Glow under bed, `손을 뻗는다` long-press | `ring.mom` (under-bed LP 900) + `buzz` |
| B03 | grab | lock | micro | Real time → roll → 03:33 (RGB split 1 frame) | `glitch`, room tone + rain fade in |
| B04 | first room view (lock cam) | room | micro | Catchlight in wardrobe gap for 2 frames (once) | none (silence is the cue) |
| B05 | 40 s after B04 | room (door side) | dread (false scare) | — | `boiler.ignite` (3 ticks → whump → hum) |
| B06 | M1 +20 s | any | micro | 1년 전 오늘 notification | `S.notify` |
| B07 | M1, first room look not facing wardrobe | room | dread | Knock-back enabled | `knock.inside` ×2 from wardrobe az |
| B08 | M1 +60 s | any | micro | 관리실 messages | `msg.friend`-like neutral tone |
| B09 | P3 solved | memo | dread | Live erase; red caret; banner | backspace ticks, `vibrate([30,40,30])` |
| B10 | P4 undo | memo | dread | Reverse rewind; his line; `흔들지 마.` typed & deleted | reversed key clicks, `S.whoosh` swell |
| B11 | M2 | home | micro | Notebook gains slots; leads list | `S.pen`, `S.pageTurn` |
| B12 | F1 | any (queue) | dread | First contact `{NAME}야.`; duvet dent appears in bed view (off-screen change) | `msg.him` (first use), +60 s `elevator.arrive` through the front door |
| B13 | F2 | any | dread | Clock 04:04 + battery 4% (8% screen dim); 관리실 slip; water glass half (off-screen); `{NAME}` battery lines | `battery.low` (4% glitch variant), `msg.him` |
| B14 | F2, next gallery visit | gallery | dread | `편집됨` on player's photo | none |
| B15 | F3 | any | dread | Door guard becomes LATCHED (off-screen, door view); wardrobe gap stage +1 | `msg.him`; when door view next opens, no sound (player must notice) |
| B16 | H6 call | room/any | dread | Ring inside wardrobe; glow in gap | `ringback` (ear), `ring.haru` + `buzz.wood` (HRTF 270°), decline click, `knock.inside` ×1 |
| B17 | M4 +45 s | any | dread | Subtitle `(옷장 안에서… 오르골 소리?)` | `musicbox.winddown` (az 270°, LP 1.8k, closet IR) |
| B18 | P6 snap-backs | 해솔홈 | dread | Toggle flips back | `doorlock.motor` from door az 180°, `msg.him` |
| B19 | M5 | any | dread | Cast icon gone; 80 ms glitch; burst; synced tabs freeze | `cast.end`, `msg.him` ×8 in 9 s, `knock.inside` ×3, **GSM buzz starts** |
| B20 | M5 +30 s | any | dread (psych peak) | Shared album: your face | `msg.album` + reversed piano swell 2 s |
| B21 | P7 block | 해솔홈 | dread | MFA modals, random button order, `1m 이내` | tri-tone alert ×5 accelerating, heartbeat +10 bpm/prompt, GSM spikes |
| B22 | M6 | 해솔홈 | relief | ✔ list; CCTV EPS door ajar (off-screen until viewed) | `S.success`, drone drops a fifth; GSM fades (he's moving away) |
| B23 | M6 +20 s | room | dread | Drying rack falls in wardrobe view (heard first, seen next look) | `rack.fall` from az 270° |
| B24 | M7 | door | — | Unlock melody → door guard clank | `doorlock.open`, `doorguard.clank`, `panel.slide`, fridge stop |
| B25 | climax steps | black | dread | Face-down binaural; mom call | §3 P8 sequence |
| B26 | door open | room | **JS2** | Sensor light; man 1 m away; 400 ms shake | `sensorlight.click` → `sting_js2` → tinnitus + hearing LPF |
| B27 | after slam | door | dread | Outside keypad 472906 fails; toasts | `doorlock` key tones ×6 (outside, LP 2k) → error; `door.slam` |
| B28 | +8 s | room | dread | 비상벨 red | `scratch.wall` + `knock.inside` (wardrobe wall) |
| B29 | 비상벨 | room | relief | Lights on (overexposed → settle) | `siren.wallpad`, `pa.chime`, `v_pa`, `neighbors`, stairs; (jiminTold) police siren doppler |
| B30 | police | room | relief | Lit nest hotspots | `police.knock` + `v_police` |
| B31 | END | dawn | relief | Dawn, email, mom, card, credits | `amb.dawn`, `musicbox.warm` |
| B32 | after credits | black | **JS3** | Real-time message; optional rear-cam CCTV | `msg.him` only, `vibrate([120,80,120])`, `static` 0.2 s |
| JS1 | exposure >92% | gallery | **JS1** | Face 450 ms, slider yanks back, input dead 1.2 s | 60 ms silence drop → `sting_js1` |

**Scare map** (min): small peak LIVE fingers (~P5, any time), medium JS1 (~20–28), psychological peak (~32), JS2 (~39), JS3 (~44). Minimum 4 min between big beats is guaranteed by fragment/milestone spacing + 45 s post-JS safe zone.

### 6.3 "Changes when you don't look" (room state layers; evaluated only in `setView()`)
| Layer | Stages / trigger | Implementation |
|---|---|---|
| Wardrobe gap | `g = min(fragments + (M5?1:0) + lookAwayBonus, chapterCap)`; caps: Act1 1, hub 2, pre-P6 3, climax 4 (≈6 cm black) | Python-made stage PNG crops over `room_wardrobe` (0/3/8/14 px seam at 1080 px wide); stage 3 adds `fingers_gap` at 35% × flashlight mask; stage 4 adds 2-px eye glint |
| Duvet dent | appears F1, gone F2 | `patch_duvet_dent.png` over `room_bed` |
| Water glass | full → half (F2) → empty (M4) | procedural Python patches |
| Door guard | open → **latched** at F3 | `patch_doorguard_open/latched.png` over `room_door` |
| Drying rack | upright → fallen at M6+20 s | `patch_rack_fallen.png` over `room_wardrobe` |
| Lit room | after 비상벨 | `room_lit_nest.jpg` replaces wardrobe view; other views get brightness/grade lift in Python |
Never change a layer while its view is visible. Store applied state per view.

### 6.4 Look-away log (rule ② made literal) — 해솔홈 › 옷장 문 센서 › 이벤트 로그
- Events recorded from M1: `visibilitychange→hidden` (switch app/lock), `pagehide/pageshow` (bfcache), face-down periods, idle ≥60 s, and the player's own JS-free blinks (none other). Game-clock timestamps (`HH:MM:SS`, padStart). Keep last 8 + scripted entries.
- Log shows pairs: `{t} 세아의 Galaxy 화면 꺼짐` → `{t+2s} 옷장 문 열림` → `{t+dur} 옷장 문 닫힘` → `{t+dur+1s} 세아의 Galaxy 화면 켜짐`. Always includes scripted `02:47:10 옷장 문 열림 ({NAME} 수면 중)` and `02:51:44 옷장 문 닫힘`. Last line always: `{now} 옷장 문 열림 · 닫히지 않음` (pointer to P8).
- On return after >4 s away (max 3 messages, 90 s cooldown, only while mirroring & after F1): `어디 갔다 왔어? {m}분 {s}초.` → `화면 껐지. 그 사이에 나 좀 움직였어.` → `이번이 {n}번째야.` Gap stage +1 (within cap). Creak plays only if the room view is open on return.
- Desktop/tab: on hidden (Acts 2–4, while mirroring) `document.title='{NAME}야 어디 가?'` + eye favicon; restored on return. Media Session flavor (optional): ambient `<audio>` metadata title by chapter (`03:33` → `그 폰 내려놔` → `소리는 못 들어` → `옷장 안에 있어`), artist `세아의 폰`; never carries info.

---

## 7. Sound design

### 7.1 Architecture (extends `js/core/audio.js`)
- Graph: sources → buses `ui`, `voice`, `sfx`, `amb`, `music` → `monoNode` (bypass unless 모노 오디오 ON: ChannelSplitter→sum×0.5→ChannelMerger both outs) → `hearingLPF` (LP 20 kHz; swept to 900 Hz after JS2) → existing DynamicsCompressor → destination.
- **3D room**: listener fixed at origin facing −Z; world yaw: door 0°, bed 90°, window 180°, wardrobe 270° (turning right). Listener yaw = `viewIndex·90 + (panX−.5)·50°`; with opt-in gyro, yaw from the **rotation matrix** (alpha/beta/gamma → rear-camera vector's horizontal azimuth; avoids gimbal lock when upright), one-pole smoothed 120 ms. Room-anchored sources = `PannerNode` (HRTF, inverse, ref 1, rolloff 1.2) + send to closet/room `ConvolverNode` (IRs generated at boot: closet 0.25 s, room 0.6 s, hallway 1.8 s, stairwell 2.8 s). Facing boost: LP cutoff `700+3500·max(0,cosΔ)`, gain `.35+.65·facing`. Cap ≤6 concurrent HRTF voices (low-end Android); older Safari: `listener.setOrientation`.
- **Speaker mode** (`audioMode='speaker'` from the earphone test): StereoPanner instead of HRTF, +6 dB quiet cues, sub content moved to 110–330 Hz harmonics, heartbeat → visual vignette pulse, **direction arcs always on**.
- **Conditioned tones**: friend/neutral `msgIn` 880→1320 Hz; mom = marimba E5 G5 C6; **HIS** = 831→1245 Hz (−1 semitone) + 6.5 Hz vibrato 12 cents + 120 ms reverse-noise pre-roll — used for nothing else, 15–25×/game → by the end the tone alone is the scare (JS3).
- **GSM buzz** (proximity tell, from M5): PeriodicWave 217 Hz pulse train duty .125 (`a_n = 2/(nπ)·sin(nπ·.125)`, n≤40) → HP 250 → peak 2 kHz +6 dB → gate driven by packet scheduler (bursts 60–350 ms, gaps 80–900 ms, occasional 8 Hz stutter) → mono, slightly left. Level −40…−14 dBFS by proximity p.
- **Silence drop**: all buses `setTargetAtTime(0,t,.012)` for 40–120 ms before reveals; recover τ .5. **Fridge stop**: room hum ramps to 0 over 0.3 s before P8/JS2.
- **Loudness**: ambience ≈ −34 dBFS RMS, UI −24, whispers −22, stingers peak −1 dBFS post-compressor.
- **iOS/Android robustness**: `navigator.audioSession.type='playback'` (Safari 17+) + looping silent `<audio playsinline>` started in the first gesture (older iOS, also keeps the media category); resume ctx on every `pointerdown`, `visibilitychange`, `pageshow`, and `ctx.state==='interrupted'` (shows `탭해서 소리 켜기` chip if resume fails). Decode WAVs after the start tap (promise `decodeAudioData`). Formats: **WAV** for anything spectral/phase/speed-critical, AAC-256 `.m4a` with `.mp3` fallback for long ambience. No Ogg. No mic use anywhere (decision: avoids iOS earpiece routing + Bluetooth HFP drops).
- Every audible cue has a subtitle string; in speaker/muted mode directional cues add an edge arc (`◀ 똑, 똑`).

### 7.2 Cue list (live synth unless marked WAV)
**Ambience**
| ID | Use | Recipe |
|---|---|---|
| amb.room | always (faint under apps; apps = −6 dB, LP 600 "phone in front of face") | existing `AMB.room` + 50/100 Hz fridge hum .004 (stoppable) |
| amb.rain | window panner az 180° | existing rain; gain `.6+.4T`; fades in END |
| amb.drone | Acts 1–4 | existing drone; LP `160+900T`; octave up in speaker mode |
| amb.micro | every 120→40 s by T | random: pipe flush upstairs (LP 600 noise swell 2.5 s), distant car (LP 300 brown, sweep), wall tick (LP'd 2 kHz click), stick-slip creak |
| amb.hallway | CCTV, JS2 | ballast hum 100/200 Hz + CCTV hiss (HP 2k noise −40 dB) |
| amb.dawn | END | birds (FM chirps sine 3–5.5 kHz, 30–80 ms glides, clusters every .4–3 s), traffic (LP 350 brown), gutter drips (sine 1.6–2.4 kHz, 80 ms), first bus at 30 s (6 s LP noise swell) |
**Phone / UI**
| ID | Recipe |
|---|---|
| ui.* | existing `S.tap/key/back/notify/shutter/camOn/flashlight/pageTurn/pen/unlock/lockClick/error` |
| msg.friend / msg.mom / msg.him / msg.album | §7.1; album = 2-note glass ping 1568/2093 Hz |
| ring.mom | marimba loop C6 E6 G6 E6 \| D6 F6 A6 – @112 bpm (partials 1 : 3.93 : 9.4, decays .5/.12/.04 s) via phone-speaker EQ (HP 400, peak 2.5k); under-bed variant LP 900 |
| ring.haru (player's ringtone, H6/P8 outside) | same motif −5 semitones @92 bpm, 4% detune, drops a note every 3rd bar |
| ringback | 440+480 Hz, 1 s on / 2 s off (existing `A.ringback`) |
| buzz.wood | 150 Hz square → LP 400, 0.8 s on/0.4 s off, 25 Hz AM (phone vibrating on wood) |
| mfa.alert | tri-tone sines 1.3/1.6/2.0 kHz, 70 ms each |
| battery.low | sines A5→E5; 4% version adds 30 ms glitch |
| cast.end | 1.2k→400 Hz down-sweep 180 ms + click |
| key.erase / key.rewind | 4 kHz noise 12 ms + 180 Hz thock; rewind = pre-rendered reversed envelope buffer |
| doorlock.key[0-9] | sine at table (§H1) + 2nd harmonic .25, 80 ms, 3 ms click; outside variant LP 2k + room IR |
| doorlock.open | C6 E6 G6 C7 arpeggio 40 ms each (square → LP 5k) + motor (saw 210 Hz 450 ms, LP 900 Q3) + latch (BP 1.6k noise 50 ms) |
| doorlock.autolock | reverse arpeggio + latch |
| doorlock.adminLock | 2.2 kHz 1.2 s beep ×2; confirm melody C6-A5-F5 |
| doorlock.error | existing (`삐삐삐`) |
| alarm.trap | two-tone square 2.4/3.1 kHz alternating 0.25 s, WaveShaper drive, 3 s |
**Room / diegetic (3D)**
| ID | Recipe |
|---|---|
| knock.inside / knock.player / knock.behind | body modes 182 Hz (90 ms) + 410 Hz (60 ms) + BP noise 900 Q2 (12 ms) → LP 2200 → panner. inside: LP 1400 + closet send .5, delay 1.1–1.6 s; player: 230/520 Hz, centered, +6 dB; behind: az 180°, LP 1.6k |
| boiler.ignite | 3 igniter ticks (BP 4k noise 3 ms, .18 s apart) → whump (LP 120 noise swell .4 s) → 48+96 Hz hum, 6 s fade; door side |
| elevator.arrive | ding 1047+1568 Hz (1.2 s decay, LP 1.5k) + motor (100 Hz + LP 250 noise 3 s) + door rumble; through front door (az 0°, LP 800) |
| creak.wardrobe (WAV) | stick-slip impulse train, period jitter 6–14 ms + AM, resonators 180/620/1450/2900 Hz, 1.5–5 s (3 variants) |
| panel.slide (WAV) | 200–1500 Hz band noise, 30–60 Hz grain AM, end wood knock 180/420 Hz |
| scratch.wall | existing `S.scratch` via wardrobe panner, LP 2k |
| rack.fall | 3 aluminium hits (20 ms noise + rings 1.2k/2.7k/4.1k, .3 s) + floor thud |
| bed.creak | sine 310→280 Hz .5 s + BP 1.2k noise, 25 Hz AM |
| footsteps.socks | heel (70 Hz sine 30 ms + LP 300 noise 40 ms) + toe slide (BP 900 noise 60 ms −12 dB), .95–1.25 s apart, occasional laminate creak; HRTF path automation |
| breath.near | noise → BP 700 Q .8 + BP 1.6k Q 1.5; exhale 1.6 s / inhale 1.1 s; panner .25–.6 m |
| musicbox.* | Melody (3/4, 84 bpm, A minor, MIDI): `76 81 84 \| 83 81 76 \| 77 81 86 \| 84 83 – \| 76 81 84 \| 83 81 79 \| 77 76 74 \| 76 – –`. Tine: sine f (decay 1.6 s; 2.2 s low) + 2f ×.22 (.6 s) + 5.4f ×.07 (.12 s) + 4 ms HP noise click; ±4 cents random detune. Variants: `.live` (first 2 bars, bright, room noise), `.fragment` (3 notes, warm, relief), `.winddown` (from bar 5 each interval ×1.12 cumulative, 12 ms flam in bar 7, end click-click), `.warm` (END: tempo 76, pad of 2 detuned saws → LP 1.2k on Am–F–Dm–E→A, last 2 bars C→C#, F→F#, G→G# to resolve A major) |
| doorguard.clank / scrape | modes 920/2380/4100 Hz (decay .6/.3/.15 s) + transient; scrape = BP 3k Q4 noise, gain = drag speed |
| door.slam | LP 150 burst + 55 Hz drop + 640/1720 Hz metal ring 1 s + room reverb |
| sensorlight.click | relay (2 ms noise + 3.2 kHz resonance) + 3 ballast ticks @100 Hz → fluorescent hum |
| siren.wallpad | two-tone square 960/770 Hz alternating .42 s → BP 1.5k Q .7 → light drive → hallway IR |
| pa.chime | marimba G5 E5 C5 G4 |
| neighbors | door-handle rattle + steel door swing (LP 400 noise 1 s + hinge creak) ×2, hard-sole stair running every .35 s (stairwell IR) |
| police.knock | 3 firm knocks on steel (450/1100 Hz ring) + radio squelch (BP 2k noise 120 ms + 1 kHz beep) |
| siren.police | two sawtooth osc sweeping 650↔1300 Hz, doppler-ish LP opening as it approaches |
| heartbeat | existing `S.heartbeat` (55/48 Hz thumps) |
**Stingers**
| ID | Recipe |
|---|---|
| sting_js1 (WAV) | reverse noise swell .9 s (exp) → 80 ms silence → hit: sine 48→30 Hz .6 s + LP noise burst + dissonant cluster (saws A2/A#2/E3/F3 ±7 cents, LP 1.2k, 2.5 s decay) + room reverb |
| sting_js2 (WAV) | no pre-swell (the relay click is the cue) → same hit +3 dB + metallic screech (saw 1.3→1.9 kHz through 2.1 ms comb, fb .85, .6 s) → heartbeat 120 bpm ×8 → tinnitus 7.2 kHz −30 dB fading 5 s |
| JS3 | `msg.him` + vibrate only |
| relief.fragment | `musicbox.fragment` + `S.pen`; opens 20 s safe zone |

### 7.3 Pre-rendered files (numpy, 22.05 kHz mono unless noted; ≈2 MB total)
| File | Recipe |
|---|---|
| `vm_doorlock.wav` (19 s) | rain bed (pink noise LP 3k) + room tone; keypad tones from the shared table (F5 at 1.20 s, B5 at 1.70 s); bark transients (CC0-free formant "왈": noise → BP 700/1400 Hz formants, 120 ms, pitch drop) at 2.20/2.65/3.05/3.50 s; admin confirm melody at 4.3 s; `v_him_shh` at 6.0 s (close, dry); breath 9–19 s |
| `noise_voice.wav` | the **voice only** (`v_sea_mono` + light room IR); the noise is generated at runtime (§H2) — never bake the phase trick into a file |
| `kongi_draw.wav` (44.1 kHz, 8 s) | dog_face bitmap → magnitude spectrogram (rows linear 1.2–9 kHz, gamma 1.8, flipped) → random-phase ISTFT (n_fft 2048, hop 256) → normalize; with a soft "삐요" carrier |
| `mono_word.wav` (44.1 kHz) | the word `모노` rendered (sans bold) at 5–8 kHz, 3–9 s, mixed into the H2 *display* analyser path only (also audible very faintly in stereo mode) |
| `creak_wardrobe_{a,b,c}.wav`, `panel_slide.wav`, `sting_js1.wav`, `sting_js2.wav` | recipes above |
| TTS (OpenAI `gpt-4o-mini-tts`, ~$0.05 total) | `v_sea_mono`, `v_him_shh`, `v_him_ear` (for 하루), `v_poweroff`, `v_pa`, `v_police`, `v_neighbor`. Post: HPF 120 Hz, LPF 6 kHz (whispers), tape flutter .3%, small-room IR; `v_him_ear` +6 dB low shelf 200 Hz (proximity) and panned .15 m left at runtime; `v_poweroff` telephone EQ (HP 300 / LP 3400 + μ-law-ish shaper) |
| Fallbacks | any WAV fetch/decode fail → live synth (doorlock voicemail rebuilt on the fly; whispers → runtime formant synth: noise → 3 parallel BP formants with automation, F-table ㅏ850/1300/2700, ㅓ650/1100/2600, ㅗ450/850/2600, ㅜ350/950/2400, ㅡ400/1500/2600, ㅣ320/2500/3200, ㅐ/ㅔ500/2000/2700) + subtitles |

---

## 8. Image assets

Pipeline: `tools/gen.py` (gpt-image, `/images/generations` or `/images/edits` with `ref`), then `tools/fx.py` (grade, sensor noise, vignette, JPEG 82 / WebP; **lossless PNG/WebP + dither** for any low-intensity hidden content). Korean text is **never** generated — always composited in Python (fonts in `scratchpad/fonts`: `pen.ttf` handwriting, `sans.ttf`, `sansb.ttf`). Portrait base 1024×1536 unless noted. All people: fictional; {NAME} never shows a face (back of head, blanket, hand).

### 8.1 Already generated (reuse)
| File | Use |
|---|---|
| `room_bed`, `room_window`, `room_door`, `room_wardrobe` (high) | The 4 room views; bases for all patches and the lit room |
| `dog_bed` | Moment 2025.03.17 post + 2024 "내 방" crop |
| `dog_park` | Moment acrostic post 11.20 (`에구 콩이 산책…`) |
| `dog_face` | Lock wallpaper; `kongi_draw` spectrogram source; polaroid photo source |
| `hallway` (1536×1024) | CCTV 4F base |
| `building` | CCTV 1F crop; base for `dawn_exterior` edit |
| `test_bed` | unused (delete) |

### 8.2 New generations (27; ★ = high quality, 8 total) — est. ≈ $2.9
| # | File | ★ | Purpose | Content / framing / aspect | Post-processing |
|---|---|---|---|---|---|
| 1 | `case_back` | ★ | P1 polaroid in clear case | Back of a dark smartphone in a **clear soft case**, a small instant-photo print tucked inside (blank white photo area), held in a hand at night, phone-flashlight lighting, portrait | Composite `dog_face` (warm faded) into the print; handwriting `콩이 우리집 온 날 ♥` (pen.ttf) and `3.17` as a **separate layer with known bbox** for the glare mask; slight plastic sheen layer |
| 2 | `sea_room_1yr` | ★ | 1년 전 오늘 03:29 | Edit of `room_wardrobe`: same angle, lived-in (cardigan on rack, plush toy, small rug, dog bed), wardrobe gap open ~3 cm, darker, warmer phone-flash | Timestamp-free; mild motion blur; "memories" card frame in UI |
| 3 | `sea_orgel_live` | ★ | LIVE photo (오르골) | Young Korean woman (세아, 24, shoulder-length dark hair, oversized hoodie, headphones around neck) sitting on the bed holding an open small wooden music box toward camera, smiling; the built-in white wardrobe visible behind her shoulder; warm flash snapshot, portrait | 2 Python composites from the SAME base: door ajar 1 cm; door ajar 2 cm + `fingers_gap` on the edge (only door region altered → no flicker). Export 3 frames + still |
| 4 | `fingers_gap` |  | Gap stage 3, LIVE frame, climax | Four pale thin fingers curled around the edge of a white door from deep darkness, plain dark background, close-up | Alpha-matte in Python; desaturate; 3 sizes |
| 5 | `vault_sea_1` |  | Vault 세아 folder | POV through a narrow vertical gap of a wardrobe door (dark blurred door edges left/right), a young woman asleep under a grey duvet on the bed, dim green-grey night tone, ref `room_bed` | Green-black grade, noise, timestamp burn-in `2025.06.18 02:40` (mono font) |
| 6 | `vault_sea_2` |  | Vault 세아 folder (2nd) | Same POV, different night, woman curled facing the wall, dog sleeping at foot of bed | Timestamp `2025.11.20 03:33`; 4 more variants via crop/flip/grade |
| 7 | `vault_haru_sleep` | ★ | Vault {NAME} 02:47; LIVE in-feed crop; alert slip; Moment `어서 와` crop | POV through the wardrobe gap of the CURRENT room (moving boxes, `room_bed` ref): a person asleep under the duvet, only the back of the head and a hand visible, phone-flash-less night look | Timestamp `2026.11.24 02:47`; blurred crop for Moment; 6-px blur for banner |
| 8 | `vault_haru_boxes` |  | Vault {NAME} 11-23 | Same POV, person from behind unpacking a cardboard box on the floor, lamp on | Timestamp `2026.11.23 21:10` |
| 9 | `shaft_card` | ★ | IMG_0606 (exposure) | Cramped plywood crawl space wall lit only by a faint light: pinned polaroids of a sleeping woman, a laminated white card on the wall with a blank writing area, scratched tally marks, cables, dust | Composite on the card: `현관 도어락 관리자 카드 · 관리자 비밀번호` + handwritten `4 7 2 9 0 6` then cover the first four digits with a pinned polaroid made from `vault_haru_sleep` (back view). Export **dark** PNG (values 0–14 + dither) and **lifted** version; shoulder silhouette at right edge from `fig_cap` |
| 10 | `shaft_face` |  | JS1 face | Inpaint of #9: a gaunt pale man's face very close to the lens at the right edge, cap shadow, eyes catching light, no gore | Same dark/lift export; used 450 ms |
| 11 | `gap_closeup` |  | Night-mode alt for 06 | Extreme close-up of the black vertical gap between two white wardrobe doors at night, flashlight grazing | Night-mode result: lifted shadows, NR smear, a pale eye at the gap's left edge, deep inside the `●●●●06` card (reuse #9 crop warped) |
| 12 | `keypad` |  | Door-lock close-up (H1, P8) | Glossy black digital door-lock keypad panel on a grey steel door, faint blue backlight, keys blank, straight-on, portrait | Digits/`*`/`#` drawn in CSS over measured key centers (no text in image); UV-free |
| 13 | `fig_cap` |  | CCTV/JS2/selfie/LIVE reflections | Man in a dark padded jacket and black cap, face in cap shadow, standing, plain grey background, full body, holding a phone with glowing screen | Alpha-matte; IR mono variant |
| 14 | `js2_hallway` | ★ | JS2 | POV from inside an apartment through a just-opened steel door: narrow Korean officetel corridor suddenly lit by a motion-sensor ceiling light, a man in dark padded jacket and cap standing 1 m away facing camera, face mostly in shadow, a phone glowing in his hand | Slight overexposure bloom, motion blur, grain |
| 15 | `hallway_eps` |  | CCTV after M6 | Edit of `hallway`: the steel door marked as a utility room next to the third apartment door stands ajar into darkness | IR mono grade + fisheye + scanlines (DOM timestamp) |
| 16 | `door_guard` |  | Door view patches | Edit of `room_door`: add a brushed-steel **U-shaped door guard** near the top of the door; variant A swung open (resting on frame), variant B latched across | Python crops → `patch_doorguard_open/latched.png`; door sticker composite (`해솔빌 관리사무소 ☎ 02-338-5120 …` + real QR via `qrcode`) |
| 17 | `door_ajar_guard` |  | P8 step 1 | From inside, the steel front door opened ~10 cm and stopped by the U-shaped door guard, pitch-black hallway in the slit | Grain, flashlight falloff |
| 18 | `room_lit_nest` | ★ | After 비상벨 | Edit of `room_wardrobe`, ceiling light ON (flat bright LED), wardrobe doors wide open, back panel pushed in revealing a dark crawl-space nest: folded grey blanket, food wrappers, an old small wooden music box, many polaroids pinned | Overexposure → settle crossfade done in CSS; drying rack fallen variant |
| 19 | `haru_fallback` |  | No-camera face fallback + 입주민 카페 black photo | POV from the wardrobe gap: a person sitting on the edge of this bed, back to camera, lit only by a phone screen in their hands | Green night-vision grade + timestamp; dark version for the café |
| 20 | `dawn_exterior` |  | END | Edit of `building`: blue-hour dawn, rain stopped, wet street, a few windows lit, the 4th-floor window bright, a police car parked by the entrance with lights off | Soft grade |
| 21 | `kongi_old` | ★ | END mom photo | The same apricot toy poodle (ref `dog_face`), older with greying muzzle, lying on a doormat inside a Korean apartment entrance, looking at the closed front door, warm morning light | None |
| 22–26 | `mo_clothes`, `mo_sky`, `mo_laptop`, `mo_mandarin`, `mo_mug` |  | Acrostic posts | (a) clothes heap on a bed, cozy; (b) dusk sky over a Korean market street; (c) dark room lit by a laptop screen, no readable text; (d) mandarin peels on a desk; (e) mug by a rainy window | Instagram-ish warm grade, square crop |
| 27 | `mo_mixdesk` |  | 모노 체크 post | Student audio desk: small audio interface, studio headphones, two monitor speakers, laptop with a waveform (no readable text) | Warm grade |

Composites only (0 gen): `patch_duvet_dent`, `patch_glass_{full,half,empty}`, `gap_stage_{1..4}`, `patch_rack_fallen` (from `room_lit_nest` rack area or inpaint), under-bed bowl close-up (crop `room_bed` + composited sticker `콩이 ♥ since 2023.03.17`), Moment sneakers crop (`room_door`), artwork crops for Media Session (512²), OG image (`og.jpg`: `room_wardrobe` + title), app icon.

**Budget**: existing 10 + new 27 = 37 images (< 40). Spend so far ≈ $1.2; new ≈ 8×$0.22 + 19×$0.055 ≈ $2.8 (+ edit input tokens ≈ $0.2); TTS ≈ $0.05. **Total ≈ $4.3 of $10** — leaves room for ≤6 regenerations of failed ★ images.

---

## 9. Systems & platform notes (implementation contract)

### 9.1 State & save
- `localStorage['haru.save.v1']` (every access in try/catch; on failure run in-memory only). Autosave on every flag set + every 10 s. Saved: milestone flags (`M1..M8`, `F` count + which), puzzle flags (`H1..H6`, `P5..P8` substeps), story flags (`momRead`, `momTold`, `jiminTold`, `knockedBack`, `knockCount`, `managerExposed`, `ringHeard`, `vaultSeen`, `faceCaptured` (bool only — never the image), `liveSeenCount`), director (`firedBeats[]`, `jsSpent{js1,js2}`, `T`), room layers per view, look-away log, game clock (milestone + offset), notification store, chat read states, OTP code, settings, `firstOpenReal`, `reloads`, `ending`.
- Reload: resume at the same screen's parent app; one-time line from `{NAME}` (if mirroring & after F1): `새로고침? 그런다고 나가지는 거 아니야.` Reopen after >10 min: lock-screen notification `{h}시간 {m}분 동안 기다렸어.` + gap stage +1 (within cap).
- The captured face frame lives only in memory (and optional IndexedDB for the session, cleared at END/`사진 지우기`); on reload → fallback image.

### 9.2 Input
- **Custom keyboard only** (div fields, `inputmode=none`, never focus native inputs on mobile): avoids iOS zoom/viewport jumps and Safari's own shake-to-undo dialog; enables 한/영 trick and dual legends. Hangul composition via pinned `es-hangul` (jsDelivr, exact version) or a 150-line local composer. Desktop: `keydown` mapped by `e.code` (IME-proof); Ctrl/Cmd+Z = undo.
- Answer normalization: NFC, strip whitespace/punct/emoji, lowercase; substring rules where listed.
- Gestures: pointer events everywhere; `touch-action:none` on stages; long-press 350 ms with `-webkit-touch-callout:none` + `contextmenu` prevented; pinch via two-pointer distance (max 8×; at ≥4× swap in hi-res tiles to avoid iOS GPU tile limits).
- Quick panel: pull from y 8–40 px (8 px dead zone avoids iOS Notification Center) or tap status bar. `overscroll-behavior:none` + fixed body to kill pull-to-refresh.
- Android back: push a history state on app open; `popstate` = in-game back; never trap at home (second back on home shows `한 번 더 누르면 게임을 나갑니다`).

### 9.3 Sensors & permissions (contextual, never at boot)
| Need | When requested | Fallback (equal outcome) |
|---|---|---|
| Motion/orientation (iOS 13+ `requestPermission`) | 몰입 설정 toggle tap (own tap) | Drag glare (P1), ↶/⋯/3-finger/Ctrl+Z (P4), hold shutter (night mode), hold-to-hide (P8), swipe/arrows for look-around |
| Camera front (face login) | P5 consent card tap → OS prompt | `카메라를 사용할 수 없습니다` + `haru_fallback` in the album |
| Camera rear (JS3) | never prompts; only if already `granted` | message-only sting |
| Mic | **not used** | — |
| Wake Lock | start tap; re-acquire on `visibilitychange→visible` | muted looping `playsinline` 1-px video (NoSleep pattern) during P8 and long audio |
- Face-down: `|β|>140°` 400 ms (enter), `<70°` (exit) — sign-consistent iOS/Android; stillness for night mode from `acceleration` (fallback HP-filtered `accelerationIncludingGravity`). Shake from `acceleration` magnitude peaks (sign-agnostic).
- Vibration: Android `navigator.vibrate`; iOS → paired audio buzz + 2-px screen jitter. Never information-only.
- Fullscreen: Android `requestFullscreen()` on start tap; iOS: 100dvh layout + one-time `홈 화면에 추가하면 전체 화면으로 즐길 수 있어요` sheet (dismissible).
- In-app browsers (KAKAOTALK/Instagram/FBAN/Line/NAVER UA): show `다른 브라우저로 열기` card on title (Android: try `intent://` to Chrome; iOS: instructions) + `그냥 할래요`.
- **Zero runtime network** besides static assets/fonts; QR page is static; no analytics. Stated in onboarding and credits.

### 9.4 Layout
- Phones: full-bleed, no fake bezel (the player's phone IS 세아's phone); safe-area insets; status bar drawn by the game. Desktop/tablet: centered phone frame 390×844 with soft shadow + `desk-hint`.
- Text size setting (설정 + pause menu): 90 / 100 / 115 / 130%; chats and memos reflow; minimum tap target 44 px (MFA buttons 56 px; iPhone SE tested).

### 9.5 Performance
- Images ≤ 300 KB each (WebP q78 + JPEG fallback), hidden-content images lossless; lazy-load per app; preload the 4 room views + lock assets after the start tap. Total initial load < 3 MB; full game < 18 MB.
- Canvas loops (glare, spectrogram, exposure, fog-free UI) run only while visible, time-based (60/120 Hz identical). Spectrogram via AnalyserNode (fftSize 2048, smoothing 0, Hz-mapped rows); static PNG strip fallback synced to `currentTime`.
- Exposure editor: pre-render 6 steps as images for low-end devices (auto if first frame > 24 ms).

---

## 10. Store-worthy polish checklist
- [ ] **Onboarding**: title → content warning → 몰입 설정 (earphone L/R test doubling as calibration, motion toggle, camera opt-in explained, "no data sent") → cold open. Total ≤ 60 s, skippable on replay.
- [ ] **Headphones recommendation** on title + speaker-mode remix if the test says speaker.
- [ ] **Save/continue** with `이어하기` showing `03:5x · 조각 2/3 · 플레이 21분`.
- [ ] **Pause menu (⏸)**: 계속 · 힌트 수첩 · 설정 · 처음부터 · 나가기. Settings: 전체 음량, 효과음/음성/배경 sliders, 진동 on/off, **공포 강도** (`보통` / `덜 무섭게`: no shake/stingers, slow fades, faces fade in, rear-cam sting off), 화면 흔들림 줄이기, 깜빡임 줄이기 (≤3 flashes/s always; this caps at 1), 글자 크기, 자막 크기, 방향 표시(자막 화살표) always/auto, 자이로로 둘러보기 on/off, **개인정보**: 카메라 끄기 / 찍힌 사진 지우기.
- [ ] **Hints** for every objective (3 tiers, hold-to-reveal, staggered timers), idle nudges, `조금 쉽게` in the climax after 2 fails, mono auto-off, all codes stated at T3.
- [ ] **Accessibility**: every sound has a subtitle; directional cues have visual arcs; pitch bars for tone matching; no audio-only info; colorblind-safe UI states (icons + text, not color alone); reduced-motion respected (`prefers-reduced-motion`).
- [ ] **No dead icons**: every app has content; empty states written in-world (`보관함이 비어 있습니다` never appears).
- [ ] **Robust audio**: silent-switch fix, resume chip, WAV fallbacks to synth, volume normalization.
- [ ] **Real-phone feel**: haptic-style micro-animations (spring 220 ms), Pretendard UI, One UI-flavored settings, realistic timestamps, typing indicators, read receipts, banners stack & swipe away, notification shade.
- [ ] **Personalization**: `CONFIG.PLAYER_NAME`, `MAKER_NAME`, `ENDING_LETTER`, optional `HARU_LAST4`; josa auto-fix; name-specific TTS fallback to formant synth.
- [ ] **Share**: real share sheet at the end; OG image + description; PWA manifest + icon.
- [ ] **Ethics/privacy**: content warning; camera opt-in & local-only; auto-delete; no real numbers (010-0 range; sticker 02- number is fictional); no brands/logos; credits state AI voices/images.
- [ ] **Debug overlay** (`CONFIG.DEBUG`): T, beat queue, JS budget, flags, `jump to milestone` buttons, hotspot outlines.
- [ ] **QA matrix**: iPhone SE (iOS 16) / iPhone 15 (iOS 18) Safari silent switch on+off; Galaxy S2x Chrome + Samsung Internet; desktop Chrome/Safari/Firefox; Kakao in-app; motion denied; camera denied; speaker vs earphones vs Bluetooth; reload at every milestone; airplane mode after load (must still work).
- [ ] **Full-run timing target**: median 38–42 min; speedrun (knows answers) ≥ 14 min; every mustSee beat fires in both.

---

## 11. Quick answer key (for QA)
| Lock | Answer |
|---|---|
| Phone PIN | `0317` |
| Memo | `zhddl` |
| Memo undo | shake / ↶ / ⋯ / 3-finger / Ctrl+Z |
| Fragment ① | `47` (door-lock tones F5, B5) |
| Fragment ② | `29` (모노 오디오 ON + '잡음') |
| Vault | `1124` then `=` |
| Fragment ③ | `06` (IMG_0606 노출 ≥60%, or night mode on gap) |
| Memo p.2 | contains `옷장` (full: 옷장뒤에누가있어) |
| 해솔홈 보안질문 | `오르골` (+variants) → OTP from 메일 |
| Remote unlock | cut 화면 공유 (quick panel / 설정 › 연결) |
| Device | block `sagongsa · SM-G991N` |
| MFA | 거부 ×5 (#3: `요청하지 않았어요`) → `보호하기` |
| Door | `472906` (after M6) |
| Climax | face-down → decline 엄마 → drag door guard → hold 비상벨 2 s → swipe handle |
| Trap | `*0404#` (alarm, time only) |
