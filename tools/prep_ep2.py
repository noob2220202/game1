"""Episode 2 image pipeline — job builder + reference crops between passes (DESIGN_EP2 §8.0 ②, §8.2).

usage (repo root, PowerShell):
  python tools\\prep_ep2.py jobs        # (re)build tools/jobs_ep2_pass1..5.json from docs/DESIGN_EP2.md §8.2
  python tools\\prep_ep2.py 2           # make the refs pass 2 needs (ref_tank, ref_rail, ref_note, ref_lock, ref_phone, ref_kongi)
  python tools\\prep_ep2.py 3           # ref_railwin
  python tools\\prep_ep2.py 5           # ref_figcap
  python tools\\prep_ep2.py show        # print the crop table
  python tools\\prep_ep2.py fix         # review-fix crops (ref_fix_lock, ref_fix_601) + re-centred ref_railwin

Prompts are copied verbatim from the doc; the bracket tags [CAM] [NOTEXT] [ROOF] [ROOM] [EDIT] are replaced
by the fixed phrases of §8.0 (character for character). gen.py sends every ref as image/png, so ep1 JPGs are
converted here. Crop rectangles are fractions (x, y, w, h) of the source image; they were confirmed once by
looking at the pass-1/2 results and are written to work/gen_ep2/_crops.json — post_ep2.py reads the same
table (CROPS) so the sub-view mapping (§8.3-2: tank_rect / rail_rect / railwin_rect) equals the ref crops.
"""
import json, os, re, sys
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOC = os.path.join(REPO, 'docs', 'DESIGN_EP2.md')
GEN = os.path.join(REPO, 'work', 'gen_ep2')
EP1 = os.path.join(REPO, 'assets', 'img')
REL_GEN = 'work/gen_ep2/'

# ---------------------------------------------------------------- crop table (fractions of the source image)
# target values from §8.2; adjusted after looking at the generated sources (see comments)
CROPS = {
    # G01 1536x1024 -> 2:3 telephoto of the water-tank room door (pass 2: G05).
    # measured on G01: door x .207-.352 y .245-.735, tank block x .17-.425 -> shifted down to keep the threshold
    'ref_tank':    {'src': 'g_roof_plate', 'x': 0.14, 'y': 0.175, 'w': 0.28, 'h': 0.63, 'out': (1024, 1536)},
    # G01 -> 3:2 telephoto of railing / lower roof / empty-flat window (pass 2: G10).
    # measured on G01: shed x .76-.95 y .30-.44, empty-flat window x .80-.85 y .53-.66 -> raised from y .48 to .27
    'ref_rail':    {'src': 'g_roof_plate', 'x': 0.55, 'y': 0.27, 'w': 0.45, 'h': 0.45, 'out': (1536, 1024)},
    # G10 -> square around the 2nd-floor window (pass 3: G13) — set after G10. Fix pass 1: the first crop (x .60-.90,
    # y .45-.90) had the window at its left edge and cut its bottom off -> re-centred square, see RAILWIN_SQ below
    'ref_railwin': {'src': 'g_roof_rail', 'x': 783 / 1536, 'y': 594 / 1024, 'w': 430 / 1536, 'h': 430 / 1024, 'out': (1024, 1024)},
    # G14 1024x1536 -> square around the taped note (pass 2: G23). measured: note x .537-.605 y .385-.447
    'ref_note':    {'src': 'g_r2_door', 'x': 0.488, 'y': 0.360, 'w': 0.166, 'h': 0.1107, 'out': (1024, 1024)},
    # G14 -> 2:3 around door lock + lever (pass 2: G25). measured: lock x .523-.578 y .452-.520
    'ref_lock':    {'src': 'g_r2_door', 'x': 0.490, 'y': 0.426, 'w': 0.117, 'h': 0.117, 'out': (1024, 1536)},
    # G18 1024x1536 -> 2:3 around the phone on the desk (pass 2: G26). measured (retry 1): phone x .763-.802
    # y .583-.595, mug x .69-.73 y .555-.58
    'ref_phone':   {'src': 'g_r2_desk', 'x': 0.68, 'y': 0.50, 'w': 0.18, 'h': 0.18, 'out': (1024, 1536)},
}
CROPS_FILE = os.path.join(GEN, '_crops.json')


def load_crops():
    """CROPS updated by the measured values saved in _crops.json (if any)."""
    c = json.loads(json.dumps(CROPS))
    if os.path.exists(CROPS_FILE):
        for k, v in json.load(open(CROPS_FILE, encoding='utf-8')).items():
            if k in c:
                c[k].update({kk: v[kk] for kk in ('x', 'y', 'w', 'h') if kk in v})
    return c


def save_crops(c):
    os.makedirs(GEN, exist_ok=True)
    json.dump({k: {kk: v[kk] for kk in ('src', 'x', 'y', 'w', 'h')} for k, v in c.items()},
              open(CROPS_FILE, 'w', encoding='utf-8'), indent=1)


def fit_aspect(r, src_size, out):
    """Grow/shrink the rect around its centre so that it has the output's aspect ratio in pixels."""
    W, H = src_size
    ow, oh = out
    cx, cy = (r['x'] + r['w'] / 2) * W, (r['y'] + r['h'] / 2) * H
    w, h = r['w'] * W, r['h'] * H
    want = ow / oh
    if w / h > want: h = w / want
    else: w = h * want
    x0, y0 = cx - w / 2, cy - h / 2
    # keep inside the image (shift, then clamp size)
    if w > W: w = W; h = w / want
    if h > H: h = H; w = h * want
    x0 = min(max(0, x0), W - w); y0 = min(max(0, y0), H - h)
    return {'x': x0 / W, 'y': y0 / H, 'w': w / W, 'h': h / H}


def make_crop(key, c):
    r = c[key]
    src = Image.open(os.path.join(GEN, r['src'] + '.png')).convert('RGB')
    fr = fit_aspect(r, src.size, r['out'])
    r.update(fr)
    W, H = src.size
    box = (round(fr['x'] * W), round(fr['y'] * H), round((fr['x'] + fr['w']) * W), round((fr['y'] + fr['h']) * H))
    im = src.crop(box).resize(r['out'], Image.LANCZOS)
    im.save(os.path.join(GEN, key + '.png'))
    print(key, 'from', r['src'], 'box', box, '->', r['out'])


def ep1_png(name, out, flatten=None):
    im = Image.open(os.path.join(EP1, name))
    if flatten is not None:
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, flatten + (255,))
        bg.alpha_composite(im)
        im = bg
    im.convert('RGB').save(os.path.join(GEN, out + '.png'))
    print(out, 'from ep1', name, im.size)


# ---------------------------------------------------------------- job builder (doc -> json)
TAGS = ('CAM', 'NOTEXT', 'ROOF', 'ROOM', 'EDIT')


def parse_doc():
    txt = open(DOC, encoding='utf-8').read()
    s80 = txt[txt.index('### 8.0'):txt.index('### 8.1')]
    blk = re.search(r'```text\n(.*?)```', s80, re.S).group(1)
    fixed = {}
    for line in blk.splitlines():
        m = re.match(r'^\[(' + '|'.join(TAGS) + r')\]\s+(.*\S)\s*$', line)
        if m: fixed[m.group(1)] = m.group(2)
    assert set(fixed) == set(TAGS), fixed.keys()
    s82 = txt[txt.index('### 8.2'):txt.index('### 8.3')]
    hdr = re.compile(r'^\*\*(G\d\d) · `(g_[a-z0-9_]+)`( ★)?\*\* — (\d+)×(\d+) · (high|medium|low) · (\d)차'
                     r'(?: · `ref: ([^`]+)`)?(?: · fidelity (high|low))?', re.M)
    jobs = []
    for m in hdr.finditer(s82):
        gid, name, star, w, h, q, ps, ref, fid = m.groups()
        body = re.search(r'```text\n(.*?)\n```', s82[m.end():], re.S).group(1).strip()
        prompt = body
        for t in TAGS:
            prompt = prompt.replace('[' + t + ']', fixed[t])
        assert not re.search(r'\[(' + '|'.join(TAGS) + r')\]', prompt), prompt
        j = {'id': gid, 'name': name, 'pass': int(ps), 'star': bool(star), 'size': f'{w}x{h}', 'quality': q, 'prompt': prompt}
        if ref:
            refs = [r.strip() for r in ref.strip('[]').split(',')]
            refs = [REL_GEN + r + '.png' for r in refs]
            j['ref'] = refs if len(refs) > 1 else refs[0]
            # gpt-image-2 answers 400 'does not support the input_fidelity parameter' (2026-11 run), so the
            # doc's value is kept for the record only; gen.py sends input_fidelity only for a 'fidelity' key.
            if fid: j['fidelity_doc'] = fid
            if fid and os.environ.get('IMG_FIDELITY') == '1': j['fidelity'] = fid
        jobs.append(j)
    ids = [j['id'] for j in jobs]
    assert ids == [f'G{i:02d}' for i in range(1, 39)], ids
    return jobs


def build_jobs():
    jobs = parse_doc()
    for p in range(1, 6):
        js = [j for j in jobs if j['pass'] == p]
        path = os.path.join(REPO, 'tools', f'jobs_ep2_pass{p}.json')
        json.dump(js, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'pass {p}: {len(js)} jobs ->', os.path.relpath(path, REPO), ' '.join(j['id'] for j in js))
    print('total', len(jobs), 'high', sum(j['quality'] == 'high' for j in jobs))


# ---------------------------------------------------------------- passes
FIX_CROPS = {
    # review fixes (fix pass 1): small regions sent to /images/edits at a higher pixel scale, pasted back in post_ep2.py
    # G05 latch (barrel bolt + S-hook -> open padlock on the staple), 384 px square -> 1024²
    'ref_fix_lock': {'src': 'g_roof_tank', 'box': (590, 737, 974, 1121), 'out': (1024, 1024)},
    # G27 601 front door (hasp + padlock -> black digital lock body + lever), 2:3 -> 1024x1536
    'ref_fix_601': {'src': 'g_tankgap_601', 'box': (1040, 275, 1340, 725), 'out': (1024, 1536)},
    # (fix pass 3) G28 (high re-run) right part, rail side, no tank door / boxes -> 2:3 for the n_roof_snow edit
    'ref_fix_roofsnow': {'src': 'g_move_day', 'box': (853, 0, 1536, 1024), 'out': (1024, 1536)},
}
# G10 empty-flat window measured: x .592-.708 (pane mullion .665, transom .786), y .603-.990, speaker (.675, .95)
# -> square centred on the window (centre .65/.79): 430 px (1.15x the window height, 2.4x its width), bottom on the
# frame edge, so the window sits whole in the middle of the ref and the speaker stays bottom right in the right pane
RAILWIN_SQ = {'x': 783 / 1536, 'y': 594 / 1024, 'w': 430 / 1536, 'h': 430 / 1024}


def fix_crops():
    c = load_crops()
    for k, r in FIX_CROPS.items():
        src = Image.open(os.path.join(GEN, r['src'] + '.png')).convert('RGB')
        src.crop(r['box']).resize(r['out'], Image.LANCZOS).save(os.path.join(GEN, k + '.png'))
        print(k, 'from', r['src'], r['box'], '->', r['out'])
    c['ref_railwin'].update(RAILWIN_SQ)
    make_crop('ref_railwin', c)
    save_crops(c)


def prep(n):
    c = load_crops()
    os.makedirs(GEN, exist_ok=True)
    if n == 2:
        for k in ('ref_tank', 'ref_rail', 'ref_note', 'ref_lock', 'ref_phone'):
            make_crop(k, c)
        ep1_png('kongi_old.jpg', 'ref_kongi')
    elif n == 3:
        make_crop('ref_railwin', c)
    elif n == 5:
        ep1_png('fig_cap.png', 'ref_figcap', flatten=(128, 128, 128))
    save_crops(c)


if __name__ == '__main__':
    a = sys.argv[1] if len(sys.argv) > 1 else 'show'
    if a == 'jobs': build_jobs()
    elif a == 'show': print(json.dumps(load_crops(), indent=1))
    elif a == 'fix': fix_crops()
    else: prep(int(a))
