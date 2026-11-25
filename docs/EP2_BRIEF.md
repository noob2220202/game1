# 하루를 위한 방탈출! 2편 — DRAFT brief (lead dev)

## Product constraints (hard)
- Same site as episode 1 (haru.pengueverything.cloud). Episode 2 lives in `/ep2/` as a fork of the episode-1 engine
  (plain JS IIFEs on window.G, no build). Root title screen gets an episode picker. Separate localStorage keys.
  Episode 2 CAN read episode 1's save (same origin: `localStorage['haru-escape.save.v1']`) for continuity callbacks
  (e.g. whether 1편 was finished, flags like jiminTold, managerExposed, momRead, knockedBack, hintsUsed, play time).
- Mobile web (iOS Safari / Android Chrome / desktop). Korean. Player = 하루 (CONFIG.PLAYER_NAME). Maker = CONFIG.MAKER_NAME
  (the friend who made the game — may appear as a character, e.g. a contact who texts 하루).
- **CLIENT RULES:** NO camera, NO microphone, NO motion/orientation sensors, NO permission prompts. Only pure in-app tricks.
  **NO unsolicited hints**: no auto notes, no tutorial subtitles, no "try X" toasts, no hint-in-error-message. Only an opt-in
  notebook hint system (hold to reveal). Must be HARD but FAIR (every answer derivable from in-game evidence).
- 35–50 min. ONE map again: 하루's own phone (returned) + 하루's NEW room (seen via the phone camera, like ep1).
- Photoreal images via gpt-image + Python compositing; synthesized WebAudio sound; TTS voices. Budget OK for ~40 new images.

## Episode 1 recap (canon)
2026-11-24 03:33. 하루 moved into 해솔빌 404호. Woke with 윤세아's phone (previous tenant, vanished exactly 1 year earlier).
A man (never named; account `sagongsa`, device SM-G991N, posed as "관리실" 010-8817-3302) lived in a sealed pipe shaft
behind the wardrobe, watched via screen mirroring, controlled the smart-home door lock. He had taken 하루's phone.
하루 escaped; police found the nest (photos, 세아's 오르골). 세아 still missing; the man not caught.
Final sting at real time from "{N} (내 폰)": "재밌었어? 다음 집에서 봐 🙂".

## Episode 1 tricks — DO NOT REUSE (must feel new)
polaroid glare drag, 한/영 password (zhddl), live memo erase + undo, door-lock tone matching, 모노 오디오 phase cancellation,
digital wellbeing/storage → calculator vault, exposure slider hidden image, acrostic of SNS posts, 알림 기록 deleted message,
calling own number rings in wardrobe, LIVE photo long-press, screen-share cut, MFA bombing deny, hold-to-hide in darkness,
look-away log, browser history containing the game's URL, real-time final message, door code split into 3 fragments.
(Engine features may be reused; the *tricks* must be different.)

## Episode 2 premise (to develop)
- **2026-12-24 (exactly one month later), night.** 하루 now lives somewhere new (a small rooftop room / 옥탑방? or a share
  house? — designers decide). A parcel arrives with no sender: inside, 하루's own stolen phone and a note "돌려줄게. —".
- The phone is 하루's but it isn't: for a month HE used it. His traces: photos, chats with other people (other targets?),
  a new app he installed, location history, edited contacts, his notes, his music, cloud backups, maybe a second user profile,
  maybe a deleted account. What he left behind is a game he built FOR 하루 — or a trap.
- Core questions the player uncovers: Who is he? Where is he now? Is 세아 alive? Why return the phone? What does he want?
- Horror: he is (again) close. The new home has been prepared by him. Something about this phone is wrong (it has been
  modified: e.g. a fake OS layer, an app that mimics system UI, the phone is still being used remotely, he left the phone
  on purpose to make 하루 do something). Escalation to a climax where 하루 must outwit him using the phone.
- Emotional throughline: 세아 / her mom / 콩이 / 지민 continue; ending should land emotionally and close (or open) the arc.
- Personal touch: the maker (CONFIG.MAKER_NAME) can be in 하루's contacts and chat history — careful: we don't know real
  details, so keep it plausible and generic (e.g. "집들이 언제 해?", "폰 찾았어?"), or make him impersonate the maker.

## Open design questions
Location of the new home; what the room escape is (locked in again? or a different goal, e.g. prevent something,
find someone in time); the central meta-trick of episode 2; how episode-1 save data pays off; how to keep it scary
without repeating ep1 beats; 3–4 signature "와 개지린다" tricks that are all in-app (no sensors).

## SERIES (added by lead, binding)
The client plans a long series (potentially dozens of episodes). Episode 2 must therefore:
- Follow the series bible at `/home/user/game1/docs/SERIES.md` if it exists (it defines the long mysteries, their secret
  answers, recurring motifs and the foreshadowing ledger). If it does not exist yet, design ep2 so it answers SOME ep1
  questions but deliberately leaves the big ones open, and plant 5–8 subtle, fair seeds for later episodes
  (an unexplained detail in a photo, a name, a number, a place, a second account, a recurring symbol, a voice), listed in a
  "Foreshadowing seeds" section with the intended later payoff.
- End with a hook that sets up episode 3 (like ep1's real-time sting) without cheapening the emotional ending.
- Export a small cross-episode save record (localStorage key `haru-escape.series.v1`) with the choices/flags later
  episodes may reference; read ep1's save for callbacks.
