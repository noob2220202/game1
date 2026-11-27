"""Episode 3 asset QA (DESIGN_EP3 §8.0 ⑧ · §10 J).

usage: python tools\\qa_ep3.py                 -> contact sheets + size table + key coverage + rule checks
       python tools\\qa_ep3.py grid NAME       -> work/gen_ep3/_measure/NAME.jpg (5 % grid, measuring aid)
       python tools\\qa_ep3.py zoom NAME x0 y0 x1 y1   -> work/gen_ep3/_measure/NAME_z.jpg (1 % grid inside a region)
       python tools\\qa_ep3.py src            -> only the generated-source sheet

Writes work/gen_ep3/_sheet.jpg (final images), work/gen_ep3/_sheet_src.jpg (generated sources) and
work/gen_ep3/_qa.txt. Exit 1 if a hard check fails (missing key, file over its size limit, meta key missing).
No OCR / face detector on this PC: 'no text' and 'no faces' are the human look at the sheets (every source was opened
during the passes); the report says so. Placeholders (work/gen_ep3/_regen_todo.json) are marked [PH] on the sheet.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GEN = os.path.join(REPO, 'work', 'gen_ep3')
IMG = os.environ.get('HARU_OUT', os.path.join(REPO, 'ep3', 'assets', 'img'))
AUD = os.path.join(REPO, 'ep3', 'assets', 'audio')
FONT = os.path.join(REPO, 'work', 'fonts', 'sans.ttf')
sys.path.insert(0, os.path.dirname(__file__))

# ---------------------------------------------------------------- §8.3-1 registry (independent copy)
EXPECT = [
    'r3_door', 'r3_veranda', 'r3_sofa', 'r3_kitchen', 'r3_kitchen_lit',
    'r3_sr_desk', 'r3_sr_desk_dim', 'r3_sr_bed', 'r3_sr_bed_dim',
    'x3_mom_table', 'x3_mom_table_lit', 'x3_phone_down', 'x3_mom_bed', 'x3_mom_bed_dim', 'x3_jimin_sleep',
    'x3_kongi_sleep', 'x3_kongi_door', 'x3_kongi_feet', 'x3_mom_hall',
    'x3_hook_empty', 'x3_flame',
    'c3_phone_ring', 'c3_phone_ring_lit', 'c3_mom_hands', 'c3_lockpanel', 'c3_shoes', 'c3_shoes_nocollar',
    'c3_orgel_spot', 'c3_manual', 'c3_drawing', 'c3_drawing_back', 'c3_doorframe', 'c3_pot', 'c3_pot_lit', 'c3_window',
    'p3_kongi_1130', 'p3_kongi_1213', 'p3_child_back', 'p3_child_hands', 'p3_soup_2601', 'p3_church', 'p3_cake_2411',
    'p3_home_wall',
    't3_title', 'og_ep3', 'icon_ep3', 'icon_ep3_192',
]
PNG_KEYS = {k for k in EXPECT if k.startswith('x3_') or k.startswith('icon_')}
SIZES = {  # expected pixel size
    'p3_home_wall': (1080, 2340), 'og_ep3': (1200, 630), 'icon_ep3': (512, 512), 'icon_ep3_192': (192, 192),
    'x3_flame': (1024, 1024), 'c3_phone_ring': (1024, 1024), 'c3_phone_ring_lit': (1024, 1024),
    'c3_mom_hands': (1024, 1024), 'c3_orgel_spot': (1024, 1024), 'c3_pot': (1024, 1024), 'c3_pot_lit': (1024, 1024),
    'p3_child_back': (1024, 1024), 'p3_child_hands': (1024, 1024), 'p3_soup_2601': (1024, 1024), 'p3_church': (1024, 1024),
}
REUSE = {'avatar_sea': '../assets/img/avatar_sea.jpg', 'avatar_mom': '../assets/img/avatar_mom.jpg',
         'avatar_jimin': '../assets/img/avatar_jimin.jpg', 'avatar_sagongsa': '../assets/img/avatar_sagongsa.jpg',
         'kongi_old': '../assets/img/kongi_old.jpg', 'dog_face': '../assets/img/dog_face.jpg',
         'dog_park': '../assets/img/dog_park.jpg', 'dog_bed': '../assets/img/dog_bed.jpg',
         'kongi_santa': '../ep2/assets/img/kongi_santa.jpg'}
META_KEYS = {
    'ref_rects': ['ref_lock', 'ref_shoes', 'ref_hall', 'ref_glass', 'ref_stove', 'ref_table', 'ref_shelf', 'ref_manual',
                  'ref_paper', 'ref_frame'],
    'r3_door': ['led_door', 'hook_rect', 'srdoor_q', 'hall_q', 'kongi_sleep_poly', 'kongi_door_poly', 'mom_hall_poly'],
    'r3_veranda': ['win_a_q', 'win_b_q', 'win_c_q', 'glass_q', 'util_door'],
    'r3_sofa': ['clock_c', 'jimin_poly', 'outlet'],
    'r3_kitchen': ['cal_q', 'ceil_glow', 'lamp', 'stove_rect', 'pot_steam', 'mom_table_poly', 'phone_poly',
                   'kongi_feet_poly', 'table_q'],
    'r3_sr_desk': ['doily_rect', 'manual_rect', 'paper_rect', 'lamp_sr', 'nl'],
    'r3_sr_bed': ['frame_q', 'frame_floor_y', 'frame_head_y', 'mom_bed_poly', 'window_rect', 'door_out', 'lamp_sr', 'nl'],
    'c3_phone_ring': ['ring_q'], 'c3_lockpanel': ['led_lock'], 'c3_shoes': ['hook_rect_cu'],
    'c3_pot': ['burner_q', 'steam_o'], 'c3_manual': ['staff_q', 'print_q'],
    'c3_drawing': ['paper_q', 'corner_q', 'notes', 'draw_txt', 'back_txt'],
    'c3_doorframe': ['cu_cm', 'edge_x', 'face_w', 'lines', 'labels'], 'p3_kongi_1130': ['plate_q'],
}
META_KEYS['r3_door'] += ['z_order', 'occluders']          # renderer contract (AD 2026-11-27): draw order + LED occluder
PERSON_PATCHES = ['x3_mom_hall', 'x3_mom_table', 'x3_mom_bed']
AUDIO = ['v3_mom_call', 'v3_mom_okay', 'v3_sea_name']
GEN_KEYS = ['g_r3_door', 'g_r3_veranda', 'g_r3_sofa', 'g_r3_kitchen', 'g_r3_sr_desk', 'g_r3_sr_bed', 'g_p3_church',
            'g_p3_child_hands', 'g_c3_phone_ring', 'g_c3_lockpanel', 'g_c3_shoes', 'g_c3_window', 'g_c3_pot',
            'g_c3_orgel_spot', 'g_c3_manual', 'g_c3_drawing', 'g_c3_doorframe', 'g_x3_mom_table', 'g_x3_jimin_sleep',
            'g_x3_kongi_sleep', 'g_x3_kongi_door', 'g_p3_kongi_1130', 'g_p3_kongi_1213', 'g_p3_cake_2411',
            'g_p3_soup_2601', 'g_p3_child_back', 'g_t3_title', 'g_c3_mom_hands', 'g_x3_mom_bed', 'g_x3_kongi_feet',
            'g_x3_mom_hall']


def find(key):
    for ext in ('.jpg', '.png', '.webp'):
        p = os.path.join(IMG, key + ext)
        if os.path.exists(p): return p
    return None


def limit_for(key, path):
    if path.endswith(('.png', '.webp')): return 200 * 1024
    if key.startswith('r3_') or key == 't3_title': return 360 * 1024
    return 300 * 1024


def placeholders():
    p = os.path.join(GEN, '_regen_todo.json')
    if not os.path.exists(p): return set()
    try:
        return {j['name'] for j in json.load(open(p, encoding='utf-8'))}
    except Exception:
        return set()


def sheet(items, out, cols=8, tw=220, th=250, title=''):
    f = ImageFont.truetype(FONT, 13)
    rows = (len(items) + cols - 1) // cols
    S = Image.new('RGB', (cols * tw, rows * (th + 18) + 24), (24, 24, 26))
    d = ImageDraw.Draw(S)
    d.text((6, 4), title, font=f, fill=(220, 220, 220))
    for i, (label, p) in enumerate(items):
        x, y = (i % cols) * tw, 24 + (i // cols) * (th + 18)
        try:
            im = Image.open(p)
            if im.mode in ('RGBA', 'LA', 'P'):
                im = im.convert('RGBA')
                ck = np.indices((im.height // 16 + 1, im.width // 16 + 1)).sum(0) % 2
                ck = np.kron(ck, np.ones((16, 16)))[:im.height, :im.width]
                bga = np.zeros((im.height, im.width, 4), np.uint8); bga[..., 3] = 255
                bga[..., :3] = (60 + 40 * ck[..., None]).astype(np.uint8)
                bg = Image.fromarray(bga, 'RGBA'); bg.alpha_composite(im); im = bg
            im = im.convert('RGB'); im.thumbnail((tw - 6, th - 6))
            S.paste(im, (x + 3 + (tw - 6 - im.width) // 2, y + 3 + (th - 6 - im.height) // 2))
        except Exception as e:
            d.text((x + 6, y + 40), 'ERR ' + str(e)[:30], font=f, fill=(255, 80, 80))
        col = (255, 120, 120) if label.endswith('[PH]') or label.startswith('MISSING') else (200, 200, 200)
        d.text((x + 4, y + th), label[:34], font=f, fill=col)
    S.save(out, quality=86)
    return out


def grid(name, step=0.05):
    p = os.path.join(GEN, name + '.png')
    if not os.path.exists(p): p = find(name) or os.path.join(GEN, '_ph', name + '.png')
    im = Image.open(p).convert('RGB')
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, max(12, im.width // 64))
    n = int(round(1 / step))
    for i in range(1, n):
        x = im.width * i / n; y = im.height * i / n
        c = (255, 0, 255) if i % 2 == 0 else (0, 255, 255)
        d.line([(x, 0), (x, im.height)], fill=c, width=1)
        d.line([(0, y), (im.width, y)], fill=c, width=1)
        if i % 2 == 0:
            d.text((x + 2, 2), f'{i * step * 100:.0f}', font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
            d.text((2, y + 2), f'{i * step * 100:.0f}', font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
    os.makedirs(os.path.join(GEN, '_measure'), exist_ok=True)
    o = os.path.join(GEN, '_measure', name + '.jpg')
    im.save(o, quality=88)
    print(o)
    return o


def zoom(name, x0, y0, x1, y1, out_w=1000):
    p = os.path.join(GEN, name + '.png')
    if not os.path.exists(p): p = find(name) or os.path.join(GEN, '_ph', name + '.png')
    im = Image.open(p).convert('RGB')
    W, H = im.size
    box = (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))
    c = im.crop(box)
    s = out_w / c.width
    c = c.resize((out_w, int(c.height * s)), Image.LANCZOS)
    d = ImageDraw.Draw(c)
    f = ImageFont.truetype(FONT, 14)
    # 1 % lines (labels every 2 %)
    for k in range(int(np.floor(x0 * 100)), int(np.ceil(x1 * 100)) + 1):
        x = (k / 100 * W - box[0]) * s
        if 0 <= x < c.width:
            d.line([(x, 0), (x, c.height)], fill=(255, 0, 255) if k % 5 == 0 else (0, 200, 200), width=1)
            if k % 2 == 0: d.text((x + 2, 2), str(k), font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
    for k in range(int(np.floor(y0 * 100)), int(np.ceil(y1 * 100)) + 1):
        y = (k / 100 * H - box[1]) * s
        if 0 <= y < c.height:
            d.line([(0, y), (c.width, y)], fill=(255, 0, 255) if k % 5 == 0 else (0, 200, 200), width=1)
            if k % 2 == 0: d.text((2, y + 2), str(k), font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
    os.makedirs(os.path.join(GEN, '_measure'), exist_ok=True)
    o = os.path.join(GEN, '_measure', name + '_z.jpg')
    c.save(o, quality=90)
    print(o)
    return o


def src_sheet():
    ph = placeholders()
    items = []
    for k in GEN_KEYS:
        p = os.path.join(GEN, k + '.png')
        if os.path.exists(p): items.append((k, p))
        elif os.path.exists(os.path.join(GEN, '_ph', k + '.png')): items.append((k + ' [PH]', os.path.join(GEN, '_ph', k + '.png')))
        else: items.append(('MISSING ' + k, os.path.join(GEN, 'none')))
    return sheet(items, os.path.join(GEN, '_sheet_src.jpg'), title='episode 3 generated sources (work/gen_ep3) — [PH] = local placeholder')


def _rgba(key):
    p = find(key)
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) if p else None


def _lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def _poly(size, pts):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(x * size[0], y * size[1]) for x, y in pts], fill=255)
    return np.asarray(m) > 127


def _over(base_key, *layers):
    im = Image.open(find(base_key)).convert('RGBA')
    for l in layers: im.alpha_composite(Image.open(find(l)).convert('RGBA'))
    return np.asarray(im.convert('RGB')).astype(np.float32)


def ad_checks(meta, w, hard, blockers):
    from scipy import ndimage as ndi
    # 1 person patches: no see-through holes inside the person (dark clothes / hair silhouette, eroded 6 px)
    for k in PERSON_PATCHES:
        x = _rgba(k)
        if x is None: continue
        a = x[..., 3]; L = _lum(x)
        p = (a >= 128) & (L < 100)
        lab, n = ndi.label(p)
        if not n: w(f'holes {k}: no person found'); continue
        sz = ndi.sum(p, lab, range(1, n + 1)); p = lab == 1 + int(np.argmax(sz))
        sil = ndi.binary_fill_holes(ndi.binary_closing(np.pad(p, 8), iterations=6)[8:-8, 8:-8])
        holes = int((ndi.binary_erosion(sil, iterations=6) & (a < 200)).sum())
        w(f'holes {k}: {holes} px with alpha < 200 inside the eroded person silhouette ({int(sil.sum())} px) — target 0')
        if holes > 20: hard.append(f'{k} see-through holes {holes} px')
    # 2 r3_door: dog and mom patches never overlap (§8.2 G31); the dog has toy-poodle size at door depth
    kd, mh = _rgba('x3_kongi_door'), _rgba('x3_mom_hall')
    if kd is not None and mh is not None:
        ov = int(((kd[..., 3] > 5) & (mh[..., 3] > 5)).sum())
        md = meta.get('r3_door', {})
        pov = int((_poly((1024, 1536), md.get('kongi_door_poly', [[0, 0]] * 3)) &
                   _poly((1024, 1536), md.get('mom_hall_poly', [[0, 0]] * 3))).sum()) if md else -1
        ys, xs = np.nonzero(kd[..., 3] > 128)
        hpx = int(ys.max() - ys.min() + 1) if len(ys) else 0
        w(f'r3_door overlap x3_kongi_door ∩ x3_mom_hall: alpha {ov} px · polygons {pov} px (target 0) · dog '
          f'{hpx} px tall ≈ {hpx / 465 * 2.05:.2f} m at door depth (door ≈ 465 px = 2.05 m; toy poodle ≈ 0.35–0.45)')
        if ov or pov: hard.append(f'r3_door patch overlap {ov}/{pov} px')
        if hpx > 110: hard.append(f'x3_kongi_door dog {hpx} px tall')
        led = md.get('led_door')
        if led:
            aled = mh[int(led['y'] * 1536), int(led['x'] * 1024), 3]
            occ = md.get('occluders', {}).get('led_door', [])
            w(f'led_door under x3_mom_hall alpha {int(aled)} -> occluders.led_door = {occ}')
            if aled > 128 and 'x3_mom_hall' not in occ: hard.append('led_door hidden by x3_mom_hall without contract')
    kf = _rgba('x3_kongi_feet')
    if kf is not None:
        ys, xs = np.nonzero(kf[..., 3] > 128)
        w(f'x3_kongi_feet dog top y {ys.min()} (chair seat ≈ 1010 px in r3_kitchen) · {xs.max() - xs.min() + 1}x{ys.max() - ys.min() + 1} px')
    # 3 kitchen_lit white balance (§8.3-4: reads as a fluorescent-lit kitchen)
    kl = _rgba('r3_kitchen_lit'); kn = _rgba('r3_kitchen')
    if kl is not None:
        rb = float(kl[..., 0].mean() / kl[..., 2].mean()); rbn = float(kn[..., 0].mean() / kn[..., 2].mean())
        wl = kl[int(0.25 * 1536):int(0.50 * 1536), int(0.22 * 1024):int(0.30 * 1024)]
        rbw = float(wl[..., 0].mean() / wl[..., 2].mean())
        w(f'r3_kitchen_lit mean R/B {rb:.2f} (night {rbn:.2f}; target ≤ 1.45) · ivory wall R/B {rbw:.2f} (target 1.1–1.2)')
        if rb > 1.45: hard.append(f'r3_kitchen_lit R/B {rb:.2f}')
    # 4 Seah's room: views A and B agree on exposure (±15 %)
    for a_, b_ in (('r3_sr_desk', 'r3_sr_bed'), ('r3_sr_desk_dim', 'r3_sr_bed_dim')):
        A_, B_ = _rgba(a_), _rgba(b_)
        if A_ is None or B_ is None: continue
        r = float(_lum(B_).mean() / _lum(A_).mean())
        w(f'{b_} / {a_} mean luma {r:.2f} (target 0.85–1.15)')
        if not 0.85 <= r <= 1.15: hard.append(f'{b_}/{a_} exposure {r:.2f}')
    # 5 lamp_sr: no hard-edged box round the desk lamp in the dim view (edge energy on the rect border vs inside)
    sd = _rgba('r3_sr_desk_dim')
    ls = meta.get('r3_sr_desk', {}).get('lamp_sr')
    if sd is not None and ls:
        L = ndi.gaussian_filter(_lum(sd), 1.5)
        x0, y0 = int(ls['x'] * 1024), int(ls['y'] * 1536); x1, y1 = int((ls['x'] + ls['w']) * 1024), int((ls['y'] + ls['h']) * 1536)
        out_ = np.r_[L[y0:y1, x0 - 8:x0 - 3].ravel(), L[y0:y1, x1 + 3:x1 + 8].ravel()].mean()
        in_ = np.r_[L[y0:y1, x0 + 3:x0 + 8].ravel(), L[y0:y1, x1 - 8:x1 - 3].ravel()].mean()
        w(f'r3_sr_desk_dim lamp_sr rect border step |inside − outside| {abs(in_ - out_):.1f} luma (a box shows as > 8)')
        if abs(in_ - out_) > 8: hard.append('r3_sr_desk_dim lamp rectangle')
    # 6 empty hook: the white hook is still there after the collar is gone (§8.3-3)
    for base_key, layer, rect_meta in (('r3_door', 'x3_hook_empty', ('r3_door', 'hook_rect')),
                                       ('c3_shoes', None, ('c3_shoes', 'hook_rect_cu'))):
        r_ = meta.get(rect_meta[0], {}).get(rect_meta[1])
        if not r_: continue
        Hh, Ww = (1536, 1024)
        x0, y0 = int(r_['x'] * Ww), int(r_['y'] * Hh); x1, y1 = int((r_['x'] + r_['w']) * Ww), int((r_['y'] + r_['h']) * Hh)
        before = _over(base_key)[y0:y1, x0:x1]
        after = (_over(base_key, layer) if layer else np.asarray(Image.open(find('c3_shoes_nocollar')).convert('RGB')).astype(np.float32))[y0:y1, x0:x1]
        def hook_px(sub):
            L = _lum(sub); k = max(2, sub.shape[1] // 6)
            wall = np.median(np.concatenate([L[:, :k], L[:, -k:]], 1), axis=1)[:, None]
            rg = sub[..., 0] / np.maximum(sub[..., 1], 1)
            wr = np.median(rg[:, :k])
            return int(((L >= wall + 10) & (rg < wr + 0.15))[: int(0.45 * sub.shape[0])].sum())
        hb, ha = hook_px(before), hook_px(after)
        tgt = layer or 'c3_shoes_nocollar'
        w(f'{tgt}: white hook px kept {ha} / {hb} before ({ha / max(1, hb):.2f}; target ≥ 0.6)')
        if ha < 0.6 * hb: hard.append(f'{tgt} hook erased ({ha}/{hb})')
    # 7 '702' plate: low contrast, small (J-98: something written at 1x, readable at 1.8x)
    pq = meta.get('p3_kongi_1130', {}).get('plate_q')
    if pq:
        im = np.asarray(Image.open(find('p3_kongi_1130')).convert('RGB')).astype(np.float32)
        m = _poly((1024, 1536), pq)
        m = ndi.binary_erosion(m, iterations=2)
        L = _lum(im)[m]
        lo, hi = np.percentile(L, 5), np.percentile(L, 95)
        mc = (hi - lo) / (hi + lo + 1e-6)
        dh = meta.get('_qa', {}).get('p3_kongi_1130', '')
        w(f'p3_kongi_1130 plate luma p5 {lo:.0f} / p95 {hi:.0f} -> Michelson contrast {mc:.2f} (white sticker ≈ .6+; '
          f'target ≤ .45) · {dh.split(";")[0]}')
        if mc > 0.45: hard.append(f'702 plate contrast {mc:.2f}')
    # 8 lit windows keep their frame bars
    lq = meta.get('c3_window', {}).get('lit_q', {})
    if lq:
        im = np.asarray(Image.open(find('c3_window')).convert('RGB')).astype(np.float32)
        for nme, q in lq.items():
            m = ndi.binary_erosion(_poly((1024, 1536), q), iterations=1)
            L = _lum(im)[m]
            dark = float((L < np.median(L) * 0.6).mean())
            w(f'c3_window lit {nme}: {dark * 100:.0f} % frame-bar px inside the lit quad (flat lightbox = 0; target ≥ 5)')
            if dark < 0.05: hard.append(f'c3_window {nme} flat')
    # 9 door-frame labels: no box overlap; hands (fonts) — the stand-in is a release blocker (§10 J-99)
    labels = meta.get('c3_doorframe', {}).get('labels', [])
    bx = [l['box'] for l in labels]
    inter = sum(not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1]) for i, a in enumerate(bx) for b in bx[i + 1:])
    big = [l['age'] for l in labels if abs(l.get('dy_px', 0)) > 4 and not l.get('leader')]
    w(f'c3_doorframe: {len(labels)} labels, box intersections {inter}, displaced labels without a leader {big or 0}')
    if inter: hard.append(f'c3_doorframe label overlap {inter}')
    if big: hard.append(f'c3_doorframe labels without leader {big}')
    fonts = os.path.join(REPO, 'work', 'fonts')
    miss = [f for f in ('brush.ttf', 'gamja.ttf') if not os.path.exists(os.path.join(fonts, f))]
    if miss:
        blockers.append('c3_doorframe + r3_sr_bed dates baked with a procedural STAND-IN hand: work/fonts/' + ' + '.join(miss)
                        + ' missing (needs the user\'s OK to run tools/get_fonts_ep3.sh, then post_ep3.py bases closeups)')


def main():
    lines, hard = [], []
    w = lines.append
    meta_p = os.path.join(IMG, 'meta.json')
    meta = json.load(open(meta_p, encoding='utf-8')) if os.path.exists(meta_p) else {}
    phs = set(meta.get('_placeholders', []))
    # ---- key coverage + sizes
    w('== key coverage (§8.3-1) + size table ==')
    tot = 0; items = []
    for k in EXPECT:
        p = find(k)
        if not p:
            w(f'MISSING {k}'); hard.append('missing ' + k); items.append(('MISSING ' + k, 'none')); continue
        sz = os.path.getsize(p); tot += sz
        im = Image.open(p)
        lim = limit_for(k, p)
        flag = ''
        if sz > lim: flag += f' OVER {lim // 1024} KB'; hard.append(f'{k} {sz // 1024} KB > {lim // 1024}')
        want = SIZES.get(k, (1024, 1536))
        if im.size != want: flag += f' SIZE {im.size} != {want}'; hard.append(f'{k} size {im.size}')
        if k in PNG_KEYS and not p.endswith('.png'): flag += ' not PNG'; hard.append(k + ' not png')
        if k in PNG_KEYS and im.mode not in ('RGBA', 'P', 'LA'): flag += ' no alpha'
        tag = ' [PH]' if k in phs else ''
        w(f'{k:22s} {os.path.basename(p):24s} {im.size[0]}x{im.size[1]} {im.mode:5s} {sz // 1024:4d} KB{flag}{tag}')
        items.append((k + tag, p))
    w(f'total ep3 images {tot / 1024 / 1024:.2f} MB (§9.8: ≈ 8.5 MB)')
    for k, rel in REUSE.items():
        p = os.path.normpath(os.path.join(REPO, 'ep3', rel))
        if not os.path.exists(p): w(f'REUSE MISSING {k} -> {rel}'); hard.append('reuse ' + k)
        else: w(f'reuse {k:16s} -> {rel} ok')
    # ---- meta keys
    w('== meta.json keys (§8.3-9) ==')
    for img, keys in META_KEYS.items():
        have = meta.get(img, {})
        miss = [k for k in keys if k not in have]
        if miss: w(f'META {img}: missing {miss}'); hard.append(f'meta {img} {miss}')
        else: w(f'meta {img}: {len(keys)} keys ok')
    # ---- audio
    w('== audio (§7.3) ==')
    for a in AUDIO:
        p = os.path.join(AUD, a + '.wav')
        if not os.path.exists(p): w('AUDIO MISSING ' + a); hard.append('audio ' + a)
        else: w(f'{a}.wav {os.path.getsize(p) // 1024} KB')
    # ---- rule checks
    w('== rule checks ==')
    post = open(os.path.join(REPO, 'tools', 'post_ep3.py'), encoding='utf-8').read()
    w('post_ep3.py uses pen.ttf (his hand): ' + ('YES - FAIL' if 'FONT_PEN' in post.replace('# FONT_PEN', '') or "pen.ttf'" in post else 'no'))
    for k, v in sorted(meta.get('_qa', {}).items()):
        w(f'qa {k}: {v}')
    if phs: w('PLACEHOLDERS (re-run after a top-up, work/gen_ep3/_regen_todo.json): ' + ' '.join(sorted(phs)))
    # ---- art-director checks (2026-11-27 review) — measured on the shipped files
    w('== art-director checks ==')
    blockers = []
    try:
        ad_checks(meta, w, hard, blockers)
    except Exception as e:
        w(f'AD checks ERROR {e!r}'); hard.append('ad checks error')
    if blockers: w('RELEASE BLOCKERS (not an asset-stage failure; §10 J): ' + ' | '.join(blockers))
    # ---- sheets
    sheet(items, os.path.join(GEN, '_sheet.jpg'), title='episode 3 final images (ep3/assets/img) — [PH] = placeholder source')
    src_sheet()
    w('sheets: work/gen_ep3/_sheet.jpg · work/gen_ep3/_sheet_src.jpg')
    w('no OCR / face detector installed: text-free and face-free sources were checked by eye (every source opened).')
    w('HARD FAIL: ' + ('; '.join(hard) if hard else 'none'))
    txt = '\n'.join(lines)
    open(os.path.join(GEN, '_qa.txt'), 'w', encoding='utf-8').write(txt + '\n')
    print(txt)
    return 1 if hard else 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'grid':
        for n in a[1:]: grid(n)
    elif a and a[0] == 'zoom':
        zoom(a[1], *map(float, a[2:6]))
    elif a and a[0] == 'src':
        print(src_sheet())
    else:
        sys.exit(main())
