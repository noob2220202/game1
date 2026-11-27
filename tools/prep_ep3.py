"""Episode 3 image pipeline — job builder + reference crops between passes (DESIGN_EP3 §8.0 ① ③ · §8.2).

usage (repo root, PowerShell):
  python tools\\prep_ep3.py jobs        # (re)build tools/jobs_ep3_pass1..3.json from docs/DESIGN_EP3.md §8.0 + §8.2
  python tools\\prep_ep3.py 2           # refs pass 2 needs (ref_lock ref_shoes ref_hall ref_glass ref_stove ref_table
                                        #   ref_shelf ref_manual ref_paper ref_frame + ref_kongi ref_orgel from ep1)
  python tools\\prep_ep3.py 3           # refs pass 3 needs (ref_mom from G18 · ref_kitchen_mom = G04 + x3_mom_table)
  python tools\\prep_ep3.py show        # print the crop table

Prompts are copied verbatim from the doc: every bracket tag [CAM] [NOTEXT] [HOME] [NIGHT] [SR] [KONGI] [MOM] [EDIT]
[OLDPRINT] is replaced by its fixed phrase of §8.0 (character for character). gen.py / gen_ep3.py send every ref as
image/png, so the ep1 JPGs are converted here. Crop rectangles are fractions (x, y, w, h) of the source image; they
were confirmed once by looking at the pass-1 results and are written to work/gen_ep3/_crops.json — post_ep3.py reads
the same table (meta.json ref_rects = the close-up crossfade mapping, §8.2).

Job order inside each pass file = the asset-stage PRIORITY (job field 'tier'):
  1 = ★ base plates (person-free) · 2 = close-ups that carry puzzle information · 3 = phone photos that carry puzzle
  information · 4 = the rest (patches, old prints, church, title). gen_ep3.py --tier N runs one tier of a pass file.
"""
import json, os, re, sys
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOC = os.path.join(REPO, 'docs', 'DESIGN_EP3.md')
GEN = os.path.join(REPO, 'work', 'gen_ep3')
EP1 = os.path.join(REPO, 'assets', 'img')
REL_GEN = 'work/gen_ep3/'
TAGS = ('CAM', 'NOTEXT', 'HOME', 'NIGHT', 'SR', 'KONGI', 'MOM', 'EDIT', 'OLDPRINT')

# asset-stage priority (see module doc). Order inside a tier = order in the pass file.
TIER = {
    'G01': 1, 'G02': 1, 'G03': 1, 'G04': 1, 'G05': 1, 'G06': 1,
    # close-ups with puzzle information: the drawing (fifth note), the manual (staff), the door frame (heights), the
    # empty doily, the phone (03:33 / 06:10 screens), the lock panel (04:40 LED), the collar hook (END), pot, window
    'G16': 2, 'G15': 2, 'G17': 2, 'G14': 2, 'G09': 2, 'G10': 2, 'G11': 2, 'G13': 2, 'G12': 2,
    # phone photos with puzzle information: 702 plate, '24 = birthday' soup, cake (calCake), 봄 · sagongsa info row
    'G22': 3, 'G25': 3, 'G24': 3, 'G23': 3,
    # the rest: G18 first (pass 3 needs ref_mom), dog / sleeper patches, title, old prints, church, pass 3
    'G18': 4, 'G20': 4, 'G21': 4, 'G19': 4, 'G27': 4, 'G26': 4, 'G07': 4, 'G08': 4,
    'G29': 4, 'G31': 4, 'G30': 4, 'G28': 4,
}
ORDER = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G16', 'G15', 'G17', 'G14', 'G09', 'G10', 'G11', 'G13', 'G12',
         'G22', 'G25', 'G24', 'G23', 'G18', 'G20', 'G21', 'G19', 'G27', 'G26', 'G07', 'G08', 'G29', 'G31', 'G30', 'G28']

# ---------------------------------------------------------------- crop table (fractions of the source image)
# §8.2 target values; the measured values (after looking at pass 1) are saved in work/gen_ep3/_crops.json.
CROPS = {
    # measured on the pass-1 results (G01 retry 1 · G02 retry 1 · G04 retry 1 · G05 retry 1 · G06 take 1), grid overlays
    # G01: lock unit x .543-.562 y .43-.475, lever y .478 -> unit in the upper half of a 2:3 window (G10 framing)
    'ref_lock':   {'src': 'g_r3_door', 'x': 0.503, 'y': 0.41, 'w': 0.10, 'h': 0.10, 'out': (1024, 1536)},
    # G01: hook + collar x .315-.325 y .40-.45, slippers x .19-.28 y .46-.49, cabinet x .17-.37, mat x .38-.49 y .63-.66,
    #      cushion x .50-.61 y .64-.68 (the cushion sits right of the mat, so the window reaches x .62)
    'ref_shoes':  {'src': 'g_r3_door', 'x': 0.17, 'y': 0.315, 'w': 0.45, 'h': 0.45, 'out': (1024, 1536)},
    # G01: door x .37-.575 y .32-.62, entrance tiles y .62-.70
    'ref_hall':   {'src': 'g_r3_door', 'x': 0.25, 'y': 0.28, 'w': 0.50, 'h': 0.50, 'out': (1024, 1536)},
    # G02: glass x .16-.95 y .27-.75, facade y .40-.66 -> a 2x 'zoom' window centred on the facade
    'ref_glass':  {'src': 'g_r3_veranda', 'x': 0.25, 'y': 0.25, 'w': 0.50, 'h': 0.50, 'out': (1024, 1536)},
    # G04: pot x .415-.455 y .385-.405 on the front burner, hob x .33-.48 y .40-.41
    'ref_stove':  {'src': 'g_r3_kitchen', 'x': 0.345, 'y': 0.336, 'w': 0.176, 'h': 0.117, 'out': (1024, 1024)},
    # G04: table top x .35-.905 y .46-.55, lamp x .655-.715 y .385-.475, nearest chair back x .38-.63
    'ref_table':  {'src': 'g_r3_kitchen', 'x': 0.33, 'y': 0.33, 'w': 0.59, 'h': 0.393, 'out': (1024, 1024)},
    # G05: flat doily x .61-.76 y .355-.38 on the middle shelf
    'ref_shelf':  {'src': 'g_r3_sr_desk', 'x': 0.54, 'y': 0.27, 'w': 0.29, 'h': 0.193, 'out': (1024, 1024)},
    # G05: leaflet leaning on the wall x .24-.31 y .43-.49
    'ref_manual': {'src': 'g_r3_sr_desk', 'x': 0.21, 'y': 0.395, 'w': 0.13, 'h': 0.13, 'out': (1024, 1536)},
    # G05: sheet on the desk x .36-.48 y .505-.545 (curled corner lower right)
    'ref_paper':  {'src': 'g_r3_sr_desk', 'x': 0.34, 'y': 0.445, 'w': 0.16, 'h': 0.16, 'out': (1024, 1536)},
    # G06: latch-side jamb face x .395-.43 (strike plate x .427 y .51), floor y .74, head y .145 -> 1.0-1.8 m = y .457-.23
    'ref_frame':  {'src': 'g_r3_sr_bed', 'x': 0.302, 'y': 0.23, 'w': 0.227, 'h': 0.227, 'out': (1024, 1536)},
}
CROPS_FILE = os.path.join(GEN, '_crops.json')
# ep1 sea_orgel_live.jpg: the BOX ONLY (x .29–.55 · y .59–.79 — the face above is never included, §8.0 ③)
ORGEL_BOX = (0.29, 0.59, 0.55, 0.79)


def load_crops():
    c = json.loads(json.dumps(CROPS))
    if os.path.exists(CROPS_FILE):
        for k, v in json.load(open(CROPS_FILE, encoding='utf-8')).items():
            if k in c:
                c[k].update({kk: v[kk] for kk in ('x', 'y', 'w', 'h') if kk in v})
    for v in c.values(): v['out'] = tuple(v['out'])
    return c


def save_crops(c):
    os.makedirs(GEN, exist_ok=True)
    json.dump({k: {kk: v[kk] for kk in ('src', 'x', 'y', 'w', 'h') if kk in v} for k, v in c.items()},
              open(CROPS_FILE, 'w', encoding='utf-8'), indent=1)


def fit_aspect(r, src_size, out):
    """Grow the rect around its centre to the output's pixel aspect ratio (never shrink), keep it inside."""
    W, H = src_size
    ow, oh = out
    cx, cy = (r['x'] + r['w'] / 2) * W, (r['y'] + r['h'] / 2) * H
    w, h = r['w'] * W, r['h'] * H
    want = ow / oh
    if w / h > want: h = w / want
    else: w = h * want
    if w > W: w = W; h = w / want
    if h > H: h = H; w = h * want
    x0 = min(max(0, cx - w / 2), W - w); y0 = min(max(0, cy - h / 2), H - h)
    return {'x': round(x0 / W, 4), 'y': round(y0 / H, 4), 'w': round(w / W, 4), 'h': round(h / H, 4)}


def src_path(name):
    """real generated source, or the local placeholder painted by post_ep3.py (quota fallback, _regen_todo.json)."""
    p = os.path.join(GEN, name + '.png')
    if os.path.exists(p): return p
    q = os.path.join(GEN, '_ph', name + '.png')
    if os.path.exists(q): return q
    raise SystemExit(f'{name}.png missing in {GEN}')


def make_crop(key, c):
    r = c[key]
    src = Image.open(src_path(r['src'])).convert('RGB')
    fr = fit_aspect(r, src.size, r['out'])
    r.update(fr)
    W, H = src.size
    box = (round(fr['x'] * W), round(fr['y'] * H), round((fr['x'] + fr['w']) * W), round((fr['y'] + fr['h']) * H))
    im = src.crop(box).resize(r['out'], Image.LANCZOS)
    im.save(os.path.join(GEN, key + '.png'))
    print(key, 'from', r['src'], 'box', box, '->', r['out'])


def ep1_png(name, out, box=None, size=None):
    im = Image.open(os.path.join(EP1, name)).convert('RGB')
    if box:
        W, H = im.size
        im = im.crop((round(box[0] * W), round(box[1] * H), round(box[2] * W), round(box[3] * H)))
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(GEN, out + '.png'))
    print(out, 'from ep1', name, box or '', im.size)


# ---------------------------------------------------------------- job builder (doc -> json)
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
        j = {'id': gid, 'name': name, 'pass': int(ps), 'tier': TIER[gid], 'star': bool(star), 'size': f'{w}x{h}',
             'quality': q, 'prompt': prompt}
        if ref:
            refs = [r.strip() for r in ref.strip('[]').split(',')]
            refs = [REL_GEN + r + '.png' for r in refs]
            j['ref'] = refs if len(refs) > 1 else refs[0]
            # gpt-image-2 answers 400 to input_fidelity (ep2 run, 2026-11): the doc's value is kept for the record
            if fid: j['fidelity_doc'] = fid
            if fid and os.environ.get('IMG_FIDELITY') == '1': j['fidelity'] = fid
        jobs.append(j)
    ids = sorted(j['id'] for j in jobs)
    assert ids == [f'G{i:02d}' for i in range(1, 32)], ids
    stars = [j['id'] for j in jobs if j['star']]
    highs = [j['id'] for j in jobs if j['quality'] == 'high']
    assert stars == highs == ['G01', 'G02', 'G03', 'G04', 'G05', 'G06'], (stars, highs)
    per = [sum(j['pass'] == p for j in jobs) for p in (1, 2, 3)]
    assert per == [8, 19, 4], per
    jobs.sort(key=lambda j: ORDER.index(j['id']))
    return jobs


def build_jobs():
    jobs = parse_doc()
    for p in (1, 2, 3):
        js = [j for j in jobs if j['pass'] == p]
        path = os.path.join(REPO, 'tools', f'jobs_ep3_pass{p}.json')
        json.dump(js, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'pass {p}: {len(js)} jobs ->', os.path.relpath(path, REPO),
              ' '.join(f"{j['id']}(t{j['tier']},{j['quality'][0]})" for j in js))
    print('total', len(jobs), 'high', sum(j['quality'] == 'high' for j in jobs),
          'medium', sum(j['quality'] == 'medium' for j in jobs), 'low', sum(j['quality'] == 'low' for j in jobs))


# ---------------------------------------------------------------- passes
def prep(n):
    c = load_crops()
    os.makedirs(GEN, exist_ok=True)
    if n == 2:
        for k in ('ref_lock', 'ref_shoes', 'ref_hall', 'ref_glass', 'ref_stove', 'ref_table', 'ref_shelf',
                  'ref_manual', 'ref_paper', 'ref_frame'):
            make_crop(k, c)
        ep1_png('kongi_old.jpg', 'ref_kongi')
        # box only, upscaled to a square the model reads well — the face above y .59 is never in it
        ep1_png('sea_orgel_live.jpg', 'ref_orgel', box=ORGEL_BOX, size=(1024, 788))
        save_crops(c)
    elif n == 3:
        sys.path.insert(0, os.path.dirname(__file__))
        import post_ep3
        post_ep3.pass3_refs()
    else:
        raise SystemExit('prep_ep3.py: unknown pass ' + str(n))


if __name__ == '__main__':
    a = sys.argv[1] if len(sys.argv) > 1 else 'show'
    if a == 'jobs': build_jobs()
    elif a == 'show': print(json.dumps(load_crops(), indent=1))
    else: prep(int(a))
