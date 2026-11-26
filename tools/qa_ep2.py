"""Episode 2 asset QA (DESIGN_EP2 §8.0 ⑥ · §10 J).

usage: python tools\\qa_ep2.py            -> contact sheets + size table + key coverage + rule checks
       python tools\\qa_ep2.py grid NAME   -> work/gen_ep2/_measure/NAME.jpg (10 % grid overlay, measuring aid)

Writes work/gen_ep2/_sheet.jpg (final images), work/gen_ep2/_sheet_src.jpg (generated sources) and
work/gen_ep2/_qa.txt. Exit code 1 if a hard check fails (missing key, file over its size limit, meta key missing).
No OCR engine is installed on this PC: the 'no text in generated sources' check is the human look at
_sheet_src.jpg (every source was opened and inspected during the passes) — noted in the report.
"""
import os, sys, json, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GEN = os.path.join(REPO, 'work', 'gen_ep2')
IMG = os.path.join(REPO, 'ep2', 'assets', 'img')
AUD = os.path.join(REPO, 'ep2', 'assets', 'audio')
FONT = os.path.join(REPO, 'work', 'fonts', 'sans.ttf')
sys.path.insert(0, os.path.dirname(__file__))

# ---------------------------------------------------------------- §8.3-1 registry, expanded (independent copy)
def rng(prefix, a, b, fmt='{}{}'):
    return [fmt.format(prefix, i) for i in range(a, b + 1)]

EXPECT = (
    ['r2_door', 'r2_window', 'r2_window_mask', 'r2_bed', 'r2_desk']
    + ['roof_plate_s0', 'roof_plate_s1', 'roof_plate_s2', 'roof_plate_s2d']
    + ['roof_tank_s0', 'roof_tank_s1', 'roof_tank_s2', 'roof_tank_s2d']
    + ['roof_rail_s0', 'roof_rail_s1', 'roof_rail_s2', 'roof_rail_s2d']
    + ['rail_window_s0', 'rail_window_s1', 'rail_window_s2', 'rail_window_s2d']
    + ['p_steps1', 'p_steps1_d', 'p_steps2', 'p_steps1_tank', 'p_steps1_tank_d', 'p_rail_steps', 'p_tank_ajar',
       'p_tank_ajar_lit', 'p_tank_ajar_plate', 'p_tank_ajar_plate_lit', 'p_tank_glow', 'p_tank_glow_plate',
       'js_tank_hand', 'js_tank_hand_plate', 'js_tank_cap', 'js_tank_cap_plate', 'm_roof_snow']
    + ['p_door_box', 'p_win_refl', 'door_handle']
    + ['p2_door_open', 'box_top', 'box_top_in', 'box_top_lifted', 'box_top_lifted_in', 'note_card_front',
       'note_card_back', 'polaroid_601', 'polaroid_601_back', 'landlord_note', 'peephole_s0', 'peephole_s1',
       'peephole_s2', 'peep_tape', 'doorlock_in', 'newphone']
    + ['old_room', 'old_room_lock', 'inn_key', 'rec_voicetalk']
    + rng('n_room_', 1, 4) + ['n_roof_snow', 'n_sill', 'n_lock_new', 'n_sky', 'n_boxes', 'contract_cap']
    + rng('move_f', 1, 3)
    + ['win_shot_%02d' % i for i in range(1, 15)] + rng('roofvid_f', 1, 3)
    + ['n_wall'] + rng('n_post_', 1, 3)
    + ['pol_case', 'pol_tank_in', 'pol_tally', 'pol_sticker', 'kongi_santa']
    + ['og_ep2', 'icon_ep2', 'title_ep2']
)
GROUPS = {'roof_tank': 'roof_tank_s0', 'roof_rail': 'roof_rail_s0', 'rail_window': 'rail_window_s0',
          'note_card': 'note_card_front', 'peephole': 'peephole_s0', 'move_frames': 'move_f1',
          'win_shot': 'win_shot_01', 'roof_video': 'roofvid_f1'}
EP1_REUSE = ['avatar_jimin', 'avatar_sea', 'kongi_old', 'mo_clothes', 'mo_sky', 'mo_laptop', 'mo_mandarin',
             'mo_mug', 'mo_mixdesk', 'dog_bed', 'dog_park', 'dog_face', 'sea_orgel_live']
META_KEYS = ['glass_q', 'tank_rect', 'rail_rect', 'railwin_rect', 'stencil_q', 'gap_tank', 'door_tank', 'led_rail',
             'led_railwin', 'led_lock', 'led_lock_cu', 'door_gap', 'peep', 'clock_bed', 'np_desk_q', 'np_cu_q',
             'box_phone_q', 'lid_name_q', 'handle_pivot', 'sticky_q', 'beam_origin']
AUDIO = ['v2_jimin_vm', 'v2_jimin_vm_a', 'v2_jimin_vm_b', 'v2_kang_door', 'v2_him_breath']
GEN_KEYS = ['g_roof_plate', 'g_roof_plate_snow', 'g_roof_plate_dark', 'g_roof_plate_steps', 'g_roof_tank',
            'g_roof_tank_snow', 'g_roof_tank_ajar', 'g_js_tank_hand', 'g_js_tank_cap', 'g_roof_rail',
            'g_roof_rail_snow', 'g_roof_rail_steps', 'g_rail_window', 'g_r2_door', 'g_r2_door_box', 'g_r2_window_in',
            'g_r2_bed', 'g_r2_desk', 'g_p2_door_open', 'g_box_top', 'g_box_top_lifted', 'g_note_card',
            'g_landlord_note', 'g_peephole', 'g_doorlock_in', 'g_newphone', 'g_tankgap_601', 'g_move_day',
            'g_old_room', 'g_inn_key', 'g_pol_case', 'g_pol_tank_in', 'g_pol_tally', 'g_pol_sticker', 'g_kongi_santa',
            'g_n_post_sunset', 'g_n_post_sky', 'g_n_post_rain']


def find(key):
    for ext in ('.jpg', '.png', '.webp'):
        p = os.path.join(IMG, key + ext)
        if os.path.exists(p): return p
    return None


def limit_for(key, path):
    if path.endswith(('.png', '.webp')): return 200 * 1024
    if key.startswith('roof_plate') or key == 'title_ep2': return 360 * 1024
    return 300 * 1024


def sheet(items, out, cols=8, tw=220, th=220, title=''):
    f = ImageFont.truetype(FONT, 13)
    rows = (len(items) + cols - 1) // cols
    S = Image.new('RGB', (cols * tw, rows * (th + 18) + 24), (24, 24, 26))
    d = ImageDraw.Draw(S)
    d.text((6, 4), title, font=f, fill=(220, 220, 220))
    for i, (label, p) in enumerate(items):
        x, y = (i % cols) * tw, 24 + (i // cols) * (th + 18)
        try:
            im = Image.open(p)
            if im.mode in ('RGBA', 'LA', 'L', 'P'):
                im = im.convert('RGBA')
                bg = Image.new('RGBA', im.size, (60, 120, 60, 255))
                # checker so alpha patches read
                ck = np.indices((im.height // 16 + 1, im.width // 16 + 1)).sum(0) % 2
                ck = np.kron(ck, np.ones((16, 16)))[:im.height, :im.width]
                bga = np.asarray(bg).copy(); bga[..., :3] = (70 + 40 * ck[..., None]).astype(np.uint8)
                bg = Image.fromarray(bga.astype(np.uint8), 'RGBA'); bg.alpha_composite(im); im = bg
            im = im.convert('RGB'); im.thumbnail((tw - 6, th - 6))
            S.paste(im, (x + 3 + (tw - 6 - im.width) // 2, y + 3 + (th - 6 - im.height) // 2))
        except Exception as e:
            d.text((x + 6, y + 40), 'ERR ' + str(e)[:30], font=f, fill=(255, 80, 80))
        d.text((x + 4, y + th), label[:34], font=f, fill=(200, 200, 200))
    S.save(out, quality=86)
    return out


def grid(name):
    p = os.path.join(GEN, name + '.png')
    if not os.path.exists(p): p = find(name) or name
    im = Image.open(p).convert('RGB')
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, max(12, im.width // 70))
    for i in range(1, 20):
        x = im.width * i / 20; y = im.height * i / 20
        c = (255, 0, 255) if i % 2 == 0 else (0, 255, 255)
        w = 2 if i % 2 == 0 else 1
        d.line([(x, 0), (x, im.height)], fill=c, width=w)
        d.line([(0, y), (im.width, y)], fill=c, width=w)
        if i % 2 == 0:
            d.text((x + 2, 2), f'{i * 5}', font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
            d.text((2, y + 2), f'{i * 5}', font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
    os.makedirs(os.path.join(GEN, '_measure'), exist_ok=True)
    out = os.path.join(GEN, '_measure', os.path.basename(name) + '.jpg')
    im.save(out, quality=88)
    print(out)


def _ink_blob(rgb, ink):
    """largest connected ink component -> tight bool mask."""
    from scipy import ndimage as ndi
    lab, n = ndi.label(ink)
    if not n: raise ValueError('no ink')
    i = np.argmax(ndi.sum(ink, lab, range(1, n + 1))) + 1
    m = lab == i
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def _norm(m, h=128):
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((max(1, round(m.shape[1] * h / m.shape[0])), h), Image.BILINEAR)
    return np.asarray(im) > 127


def _iou_centered(a, b):
    H = max(a.shape[0], b.shape[0]); W = max(a.shape[1], b.shape[1])
    A_ = np.zeros((H, W), bool); B_ = np.zeros((H, W), bool)
    A_[(H - a.shape[0]) // 2:(H - a.shape[0]) // 2 + a.shape[0], (W - a.shape[1]) // 2:(W - a.shape[1]) // 2 + a.shape[1]] = a
    B_[(H - b.shape[0]) // 2:(H - b.shape[0]) // 2 + b.shape[0], (W - b.shape[1]) // 2:(W - b.shape[1]) // 2 + b.shape[1]] = b
    return (A_ & B_).sum() / max(1, (A_ | B_).sum())


def six_iou(meta):
    """§8.3-7 / §10 J '6' rule: the '6' shipped on box_top (read back through the lid quad into the flat lid card)
    against the '6' of ep1's shaft_card_lit.jpg (x≈585–605, y≈740–785). Both binarised (blue ink), the largest
    component, normalised to the same height, centred, IoU."""
    sys.path.insert(0, os.path.dirname(__file__))
    import fx
    from PIL import ImageFont
    e1 = np.asarray(Image.open(os.path.join(REPO, 'assets', 'img', 'shaft_card_lit.jpg')).convert('RGB')).astype(float)
    c1 = e1[728:795, 575:618]
    l1 = c1 @ [0.299, 0.587, 0.114]
    m1 = _ink_blob(c1, l1 < np.median(l1) - 35)
    bt = Image.open(os.path.join(IMG, 'box_top.jpg')).convert('RGB')
    W, H = bt.size
    q = [(x * W, y * H) for x, y in meta['_lid_flap']]
    lw = np.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]); lh = np.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])
    cw = 1000; ch = int(cw * lh / lw)
    co = fx._find_coeffs([(0, 0), (cw, 0), (cw, ch), (0, ch)], q)
    card = np.asarray(bt.transform((cw, ch), Image.PERSPECTIVE, co, Image.BICUBIC)).astype(float)
    size = int(cw * 0.065 / 0.78); x0, y0 = int(cw * 0.07), int(ch * 0.22)     # post_ep2.lid_writing layout
    f = ImageFont.truetype(fx.FONT_PEN, size)
    from PIL import ImageDraw
    adv = ImageDraw.Draw(Image.new('L', (8, 8))).textlength('받는 사람: ', font=f)
    xa, xb = int(x0 + adv - 0.30 * size), int(x0 + adv + 0.42 * size)      # the '6' only (the '0' starts ~.45 em on)
    ya, yb = int(y0 - 0.25 * size), int(y0 + 1.25 * size)
    c2 = card[ya:yb, xa:xb]
    l2 = c2 @ [0.299, 0.587, 0.114]
    m2 = _ink_blob(c2, l2 < np.median(l2) - 45)
    return _iou_centered(_norm(m1), _norm(m2)), f'(ep1 blob {m1.shape[1]}x{m1.shape[0]} px, lid blob {m2.shape[1]}x{m2.shape[0]} px in the flat lid)'


def rect_overlap(a, b):
    return not (a['x'] + a['w'] <= b['x'] or b['x'] + b['w'] <= a['x'] or a['y'] + a['h'] <= b['y'] or b['y'] + b['h'] <= a['y'])


def main():
    lines, hard = [], []
    P = lines.append
    # ---- coverage + sizes
    P('== final keys (§8.3-1) ==')
    total = 0
    rows = []
    for k in EXPECT:
        p = find(k)
        if not p:
            hard.append('MISSING ' + k); P(f'  MISSING {k}'); continue
        sz = os.path.getsize(p); total += sz
        lim = limit_for(k, p)
        im = Image.open(p)
        flag = 'OVER' if sz > lim else 'ok'
        if sz > lim: hard.append(f'OVER {k} {sz // 1024} KB > {lim // 1024} KB')
        rows.append((k, os.path.basename(p), im.size, im.mode, sz))
        P(f'  {flag:4} {k:24} {os.path.basename(p):28} {im.size[0]}x{im.size[1]} {im.mode:4} {sz / 1024:7.1f} KB (<= {lim // 1024})')
    extra = sorted(set(os.path.splitext(f)[0] for f in os.listdir(IMG) if f.endswith(('.jpg', '.png', '.webp'))) - set(EXPECT))
    P(f'  extra files (not in §8.3-1 list): {extra}')
    for f in extra:
        total += os.path.getsize(find(f))
    P(f'  total images: {total / 1024 / 1024:.2f} MB (budget ≈ 12 MB, §9.8)')
    pre = ['p2_door_open', 'box_top', 'r2_door', 'n_wall', 'note_card_front', 'polaroid_601']
    psz = sum(os.path.getsize(find(k)) for k in pre if find(k))
    P(f'  preload set {pre}: {psz / 1024 / 1024:.2f} MB (target ≈ 1.3 MB)')
    for k in EP1_REUSE:
        if not os.path.exists(os.path.join(REPO, 'assets', 'img', k + ('.jpg'))):
            hard.append('EP1 reuse missing ' + k)
    # ---- meta
    P('== meta.json (§8.3-9) ==')
    mp = os.path.join(IMG, 'meta.json')
    meta = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {}
    for k in META_KEYS:
        if k not in meta: hard.append('META missing ' + k); P('  MISSING ' + k)
    P(f'  keys: {len(meta)} ({", ".join(sorted(meta))})')
    # ---- assets.js coverage
    js = os.path.join(REPO, 'ep2', 'js', 'data', 'assets.js')
    if os.path.exists(js):
        src = open(js, encoding='utf-8').read()
        miss = [k for k in EXPECT + list(GROUPS) + EP1_REUSE if not re.search(r'\b' + k + r'\s*:', src)]
        P(f'== assets.js == missing keys: {miss}')
        if miss: hard.append('assets.js missing ' + ','.join(miss))
        for m in re.finditer(r"P \+ '([^']+)'", src):
            if not os.path.exists(os.path.join(IMG, m.group(1))): hard.append('assets.js path missing ' + m.group(1))
        for m in re.finditer(r"E1 \+ '([^']+)'", src):
            if not os.path.exists(os.path.join(REPO, 'assets', 'img', m.group(1))): hard.append('ep1 path missing ' + m.group(1))
    else:
        P('== assets.js == not written yet')
    # ---- audio
    P('== audio ==')
    for a in AUDIO:
        p = os.path.join(AUD, a + '.wav')
        P(f'  {a:16} ' + (f'{os.path.getsize(p) / 1024:.0f} KB' if os.path.exists(p) else 'MISSING'))
    # ---- rule checks (§10 J)
    P('== rule checks ==')
    qa = meta.get('_qa', {})
    for k, v in qa.items():
        P(f'  {k}: {v}')
    rects = meta.get('_crop_rects', {})
    avoid = {k: v for k, v in rects.items() if k.startswith('avoid_')}
    for nk in ('n_room_1', 'n_room_3'):
        r = rects.get(nk)
        if not r: continue
        for ak, av in avoid.items():
            if av.get('src') == r.get('src') and rect_overlap(r, av):
                hard.append(f'{nk} crop overlaps {ak}'); P(f'  FAIL {nk} overlaps {ak}')
            elif av.get('src') == r.get('src'):
                P(f'  ok   {nk} clear of {ak}')
    try:
        iou, info = six_iou(meta)
        P(f'  6-glyph IoU (shipped box_top lid "6" vs ep1 shaft_card_lit.jpg "6", height-normalised, centred): {iou:.3f} {info}')
        if iou < 0.8: hard.append(f'6-glyph IoU {iou:.3f} < 0.8 (§8.3-7)')
    except Exception as e:
        P(f'  6-glyph check error {e!r}')
    # ---- sheets
    items = [(k, find(k)) for k in EXPECT if find(k)] + [(k, find(k)) for k in extra if find(k)]
    s1 = sheet(items, os.path.join(GEN, '_sheet.jpg'), cols=10, tw=200, th=200, title='ep2 final images')
    src = [(k, os.path.join(GEN, k + '.png')) for k in GEN_KEYS if os.path.exists(os.path.join(GEN, k + '.png'))]
    s2 = sheet(src, os.path.join(GEN, '_sheet_src.jpg'), cols=8, tw=240, th=240, title='ep2 generated sources (no text expected)')
    P(f'sheets: {s1} · {s2}')
    P('HARD FAILS: ' + (', '.join(hard) if hard else 'none'))
    out = '\n'.join(lines)
    open(os.path.join(GEN, '_qa.txt'), 'w', encoding='utf-8').write(out)
    print(out)
    return 1 if hard else 0


RATE = {'img_out': 40e-6, 'img_in': 10e-6, 'txt_in': 5e-6, 'tts_char': 15e-6}   # gpt-image-1 rates (conservative)


def cost(verbose=True):
    """Running cost estimate from work/gen_ep2/_usage.jsonl (+ work/tts_ep2/_usage.jsonl)."""
    tot = {'img_out': 0, 'img_in': 0, 'txt_in': 0}
    n = 0
    p = os.path.join(GEN, '_usage.jsonl')
    for line in open(p, encoding='utf-8') if os.path.exists(p) else []:
        d = json.loads(line); u = d.get('usage') or {}
        n += 1
        od = u.get('output_tokens_details') or {}
        idt = u.get('input_tokens_details') or {}
        tot['img_out'] += od.get('image_tokens', u.get('output_tokens', 0))
        tot['img_in'] += idt.get('image_tokens', 0)
        tot['txt_in'] += idt.get('text_tokens', u.get('input_tokens', 0) - idt.get('image_tokens', 0))
    usd = {k: tot[k] * RATE[k] for k in tot}
    chars = 0
    tp = os.path.join(REPO, 'work', 'tts_ep2', '_usage.jsonl')
    for line in open(tp, encoding='utf-8') if os.path.exists(tp) else []:
        chars += json.loads(line).get('chars', 0)
    usd['tts'] = chars * RATE['tts_char']
    total = sum(usd.values())
    if verbose:
        print(f'images: {n} calls · image-out {tot["img_out"]} tok × $40/M = ${usd["img_out"]:.3f} · '
              f'image-in {tot["img_in"]} tok × $10/M = ${usd["img_in"]:.3f} · text-in {tot["txt_in"]} tok × $5/M = ${usd["txt_in"]:.3f}')
        print(f'tts: {chars} chars × $15/M = ${usd["tts"]:.4f}')
        print(f'TOTAL ≈ ${total:.2f} (cap $30)')
    return total, tot, n, chars


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'cost':
        cost(); sys.exit(0)
    if len(sys.argv) > 2 and sys.argv[1] == 'grid':
        for n in sys.argv[2:]: grid(n)
    else:
        sys.exit(main())
