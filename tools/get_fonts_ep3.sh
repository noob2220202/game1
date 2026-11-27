#!/usr/bin/env bash
# Episode 3 hands (DESIGN_EP3 §8.0 · §8.3-6): mom = Nanum Brush Script, Seah = Gamja Flower (both OFL, Google Fonts).
# post_ep3.py bakes the door-frame dates with them; until they exist it uses a procedural stand-in and its QA says so.
# After running this: python tools/post_ep3.py bases closeups   (re-bakes c3_doorframe + r3_sr_bed with the real hands)
set -e
D="${HARU_WORK:-$(cd "$(dirname "$0")/.." && pwd)/work}/fonts"; mkdir -p "$D"
curl -sL -o "$D/brush.ttf" https://github.com/google/fonts/raw/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf
curl -sL -o "$D/gamja.ttf" https://github.com/google/fonts/raw/main/ofl/gamjaflower/GamjaFlower-Regular.ttf
ls -la "$D"
