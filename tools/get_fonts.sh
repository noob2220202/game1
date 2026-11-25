#!/usr/bin/env bash
# Downloads the fonts used for compositing Korean text into images (OFL licensed, Google Fonts).
set -e
D="${HARU_WORK:-$(cd "$(dirname "$0")/.." && pwd)/work}/fonts"; mkdir -p "$D"
curl -sL -o "$D/pen.ttf"   https://fonts.gstatic.com/s/nanumpenscript/v25/daaDSSYiLGqEal3MvdA_FOL_3FkN2z4.ttf
curl -sL -o "$D/sans.ttf"  https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf
curl -sL -o "$D/sansb.ttf" https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf
ls -la "$D"
