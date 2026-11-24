# Asset tools
- `gen.py jobs.json outdir` — OpenAI image generation (generations/edits). Needs an OpenAI key (the dev environment injected it via proxy).
- `post.py` — Photoshop-style compositing of all game images (handwriting, QR sticker, timestamps, hidden low-intensity text, overlays).
- `tts.py` / `ttspost.py` — AI voice lines and post-processing into `assets/audio/*.wav`.
Paths inside the scripts point at the dev scratchpad; adjust `SCR`/`OUT` in `fx.py` to re-run.
