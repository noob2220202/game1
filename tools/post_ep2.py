"""Episode 2 — build every final image of DESIGN_EP2 §8.3 from work/gen_ep2/*.png (+ the TTS post, §7.3).

usage (repo root):
  $env:HARU_OUT="$PWD\\ep2\\assets\\img"; python tools\\post_ep2.py            # all image steps
  python tools\\post_ep2.py room plate          # only some steps (meta.json is merged, not replaced)
  python tools\\post_ep2.py --measure g_r2_door  # grid overlay for measuring (same as qa_ep2.py grid)
  python tools\\post_ep2.py --tts-gen           # TTS: tools/tts_ep2.json -> work/tts_ep2/raw/*.raw.wav (tools/tts.py run())
  python tools\\post_ep2.py --tts-post          # TTS post: ttspost.py helpers + §7.3 chain -> ep2/assets/audio/
  python tools\\post_ep2.py --fixrefs           # refs for fix pass 2 (G01 / G06 with the open padlock)

Review-fix pass (2026-11-26): edits e_fix_lock / e_fix_601 / e_tank_ajar_lit / e_roof_snow and re-runs of G13 and G28
(tools/jobs_ep2_fix1..4.json; a detail-only G10 re-run is kept unused as g_roof_rail.v3_faithful.png). Snow states are
composited on registered edits (register()/warp()); the two half-canvas telephoto ajar patches are lossy WebP + lossless
alpha (G.IMG carries the path) — every other patch is PNG.

Rules kept here (§8): no text from the model — every Korean string/number is drawn with the fonts below;
no faces; {N} never drawn (the lid name is a DOM overlay at meta.lid_name_q). Coordinates in meta.json are
fractions (0–1) of that image; 'r' of a circle is a fraction of the image WIDTH.
Patches named p_* / js_* / m_* are full-canvas PNGs of the image they sit on ('same size = full placement').
"""
import os, sys, json, math, random, io, re, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps, ImageChops, ImageFont
from scipy import ndimage as ndi

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('HARU_WORK', os.path.join(REPO, 'work'))
sys.path.insert(0, os.path.dirname(__file__))
import fx
from fx import grain, vignette, grade, font, FONT_SANS, FONT_BOLD, FONT_PEN
import hand
from prep_ep2 import load_crops

GEN = os.path.join(REPO, 'work', 'gen_ep2')
OUT = os.environ.get('HARU_OUT', os.path.join(REPO, 'ep2', 'assets', 'img'))
EP1 = os.path.join(REPO, 'assets', 'img')
FONT_GAEGU = hand.FONT_GAEGU
META_PATH = os.path.join(OUT, 'meta.json')
os.makedirs(OUT, exist_ok=True)

try:
    META = json.load(open(META_PATH, encoding='utf-8')) if os.path.exists(META_PATH) else {}
except ValueError:
    META = {}
QA = META.setdefault('_qa', {})
LOG = []
MISSING = []
random.seed(7); np.random.seed(7)
RNG = np.random.default_rng(7)


class Missing(Exception):
    pass


# ================================================================ io helpers
def S(name):
    """generated source (RGB)."""
    p = os.path.join(GEN, name + '.png')
    if not os.path.exists(p): raise Missing(name)
    return Image.open(p).convert('RGB')


def has(*names):
    return all(os.path.exists(os.path.join(GEN, n + '.png')) for n in names)


def A(im):
    return np.asarray(im).astype(np.float32)


def I(a, mode=None):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), mode) if mode else Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def lum(a):
    a = A(a) if isinstance(a, Image.Image) else a
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


QMAP = [  # (key prefix, quality) — album photos / video frames / evidence shots carry heavy grain; q82 only for views
    # (fix pass: −1.5 MB to stay near the §9.8 ≈12 MB budget; roof_tank keeps q80 for the stencil at 2–3x zoom)
    ('win_shot_', 72), ('roofvid_', 70), ('move_f', 74), ('n_room_', 75), ('n_', 75), ('pol_', 76), ('kongi', 76),
    ('roof_tank_', 80), ('roof_rail_', 77), ('rail_window_', 78), ('old_room', 78), ('inn_key', 76), ('newphone', 78),
    ('doorlock_in', 78)]


# his ink (25,25,90) is thin strokes: 4:2:0 chroma subsampling turns them brown on cardboard -> 4:4:4 for these
SUB444 = ('box_top', 'note_card_', 'pol_case', 'polaroid_601')


def jpg(im, key, q=82, limit=300):
    if q == 82:
        q = next((qq for pre, qq in QMAP if key.startswith(pre)), q)
    im = im.convert('RGB')
    sub = 0 if key.startswith(SUB444) else 2
    for qq in range(q, 55, -3):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=qq, optimize=True, progressive=True, subsampling=sub)
        if b.tell() <= limit * 1024: break
    open(os.path.join(OUT, key + '.jpg'), 'wb').write(b.getvalue())
    LOG.append(f'{key}.jpg {im.size[0]}x{im.size[1]} q{qq} {b.tell() // 1024} KB')
    return im


def png(im, key, limit=200):
    if im.mode == 'RGBA':
        a = np.asarray(im).copy(); a[a[..., 3] == 0, :3] = 0; im = Image.fromarray(a, 'RGBA')
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    how = 'png'
    if b.tell() > limit * 1024 and im.mode in ('RGBA', 'RGB'):
        for colors, dz in ((256, 1), (256, 0), (192, 0), (128, 0), (96, 0), (64, 0), (48, 0)):
            q = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE,
                            dither=Image.Dither.FLOYDSTEINBERG if dz else Image.Dither.NONE)
            b = io.BytesIO(); q.save(b, 'PNG', optimize=True)
            how = f'png8/{colors}' + ('d' if dz else '')
            if b.tell() <= limit * 1024: break
    open(os.path.join(OUT, key + '.png'), 'wb').write(b.getvalue())
    LOG.append(f'{key}.png {im.size[0]}x{im.size[1]} {im.mode} {how} {b.tell() // 1024} KB')
    return im


def webp_hard(im, mask, key, limit=200, q=90):
    """full-canvas patch as lossy WebP + lossless binary alpha (only for patches too large for a clean PNG)."""
    mk = np.asarray(mask, bool)
    a = np.dstack([A(im.convert('RGB')), mk * 255.0]); a[~mk, :3] = 0
    rgba = I(a, 'RGBA')
    for qq in range(q, 60, -4):
        b = io.BytesIO(); rgba.save(b, 'WEBP', quality=qq, method=6, alpha_quality=100, exact=False)
        if b.tell() <= limit * 1024: break
    for ext in ('.png', '.webp'):
        old = os.path.join(OUT, key + ext)
        if os.path.exists(old): os.remove(old)
    open(os.path.join(OUT, key + '.webp'), 'wb').write(b.getvalue())
    LOG.append(f'{key}.webp {im.size[0]}x{im.size[1]} q{qq} hard alpha {mk.mean() * 100:.0f} % {b.tell() // 1024} KB')


def mask_png(m, key, size=None):
    """CSS mask image: L = A = mask, so it works with mask-mode alpha (the default for images) and luminance."""
    im = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), 'L')
    if size: im = im.resize(size, Image.LANCZOS)
    la = Image.merge('LA', (im, im))
    png(la, key)
    return im


def fr(x, y, W, H):
    return [round(x / W, 4), round(y / H, 4)]


def q_frac(q, W, H):
    return [fr(x, y, W, H) for x, y in q]


def q_px(q, W, H):
    return [(x * W, y * H) for x, y in q]


def poly_mask(size, pts, feather=0, value=255):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=value)
    if feather: m = m.filter(ImageFilter.GaussianBlur(feather))
    return A(m) / 255.0


def gblur(a, s):
    if a.ndim == 3: return np.stack([ndi.gaussian_filter(a[..., c], s) for c in range(a.shape[2])], -1)
    return ndi.gaussian_filter(a, s)


def norm01(a):
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return np.clip((a - lo) / max(1e-6, hi - lo), 0, 1)


def noise_field(shape, sigma, seed):
    r = np.random.default_rng(seed).random(shape).astype(np.float32)
    return norm01(ndi.gaussian_filter(r, sigma))


def rgba_patch(src, alpha):
    al = np.clip(alpha, 0, 1)
    rgb = A(src)[..., :3] * (al > 1 / 255)[..., None]          # no colour under fully transparent pixels (PNG size)
    return I(np.dstack([rgb, al * 255]), 'RGBA')


def crop_frac(im, r):
    W, H = im.size
    return im.crop((round(r['x'] * W), round(r['y'] * H), round((r['x'] + r['w']) * W), round((r['y'] + r['h']) * H)))


def resize_arr(a, size, resample=Image.BILINEAR):
    """resize float array (HxW or HxWxC) to size=(w,h)."""
    if a.ndim == 2:
        return A(Image.fromarray(a.astype(np.float32), 'F').resize(size, resample))
    return np.dstack([A(Image.fromarray(a[..., c].astype(np.float32), 'F').resize(size, resample)) for c in range(a.shape[2])])


def crop_arr(a, r):
    H, W = a.shape[:2]
    return a[round(r['y'] * H):round((r['y'] + r['h']) * H), round(r['x'] * W):round((r['x'] + r['w']) * W)]


def mean_std_match(src, ref, amt=0.7):
    s, r = A(src), A(ref)
    out = s.copy()
    for c in range(3):
        ms, ss = s[..., c].mean(), s[..., c].std() + 1e-6
        mr, sr = r[..., c].mean(), r[..., c].std() + 1e-6
        out[..., c] = (s[..., c] - ms) / ss * sr + mr
    return I(s * (1 - amt) + out * amt)


def screen(base, light, k=1.0):
    b, l = A(base) / 255, np.clip(A(light) / 255 * k, 0, 1)
    return I((1 - (1 - b) * (1 - l)) * 255)


def ev(im, stops):
    return I(A(im) * (2 ** stops))


def warm(im, k):
    """+k = warmer (lower K), -k = cooler."""
    a = A(im)
    a[..., 0] *= 1 + 0.06 * k; a[..., 2] *= 1 - 0.06 * k
    return I(a)


def find_coeffs(dst, src):
    return fx._find_coeffs(dst, src)


def warp_into(base, card, quad, alpha_scale=1.0):
    """perspective paste of an RGB(A) card into quad (TL,TR,BR,BL px) of base."""
    w, h = card.size
    coeffs = find_coeffs(quad, [(0, 0), (w, 0), (w, h), (0, h)])
    c = card.convert('RGBA')
    wc = c.transform(base.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    if alpha_scale != 1:
        a = A(wc); a[..., 3] *= alpha_scale; wc = I(a, 'RGBA')
    out = base.convert('RGBA'); out.alpha_composite(wc)
    return out.convert('RGB')


def quad_extremes(mask):
    """TL,TR,BR,BL corners of a binary blob (extremes of x+y / x-y)."""
    ys, xs = np.nonzero(mask)
    s, d = xs + ys, xs - ys
    return [(int(xs[s.argmin()]), int(ys[s.argmin()])), (int(xs[d.argmax()]), int(ys[d.argmax()])),
            (int(xs[s.argmax()]), int(ys[s.argmax()])), (int(xs[d.argmin()]), int(ys[d.argmin()]))]


def phone_grade(im, ev_=0.3, k=0.0, barrel=0.03, sharpen=True):
    """phone-camera look (n_room_*): auto exposure, colour temperature, barrel distortion, sharpen."""
    im = ev(im, ev_)
    if k: im = warm(im, k)
    if barrel:
        a = A(im); H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)
        r2 = nx * nx + ny * ny
        f = 1 + barrel * r2
        f = f / (1 + barrel)
        sx, sy = nx * f * W / 2 + W / 2, ny * f * H / 2 + H / 2
        a = np.stack([ndi.map_coordinates(a[..., c], [sy, sx], order=1, mode='nearest') for c in range(3)], -1)
        im = I(a)
    if sharpen: im = im.filter(ImageFilter.UnsharpMask(1.2, 60, 2))
    return im


# ================================================================ measured coordinates (fractions of each source)
# Measured by eye on grid overlays (qa_ep2.py grid NAME) or detected in code (marked auto). Re-measure after a
# regeneration. Pixel sizes: G01-04,G10-12,G27,G28,G31-33 1536x1024 · G05-09,G14-21,G25,G26,G29,G35,G37 1024x1536.
MEAS = {
    # G14 r2_door
    'door_note': [[0.537, 0.386], [0.605, 0.386], [0.605, 0.447], [0.537, 0.447]],
    'door_leaf': [[0.517, 0.262], [0.836, 0.262], [0.836, 0.740], [0.517, 0.740]],
    'peep': {'cx': 0.660, 'cy': 0.390, 'r': 0.0045},
    'led_lock': {'x': 0.537, 'y': 0.462},
    # G17 r2_bed (before the left-right mirror that puts its side window on the 90° wall)
    'clock_bed_src': {'cx': 0.472, 'cy': 0.297, 'r': 0.0445},
    # G20 box_top (retry 1)
    'lid_flap': [[0.255, 0.668], [0.773, 0.668], [0.815, 0.815], [0.203, 0.815]],
    'box_poly': [[0.268, 0.188], [0.778, 0.188], [0.780, 0.268], [0.868, 0.248], [0.900, 0.655], [0.790, 0.668],
                 [0.818, 0.822], [0.200, 0.822], [0.252, 0.668], [0.135, 0.652], [0.178, 0.258], [0.270, 0.300]],
    'box_bottom': {'x': 0.36, 'y': 0.40, 'w': 0.32, 'h': 0.24},   # cardboard floor of the box (polaroid_601 base)
    # G27 tankgap_601
    'tg_window': {'x': 0.435, 'y': 0.305, 'w': 0.132, 'h': 0.19},
    'tg_floor': [[0.352, 0.640], [0.634, 0.640], [0.700, 0.790], [0.825, 0.840], [0.825, 1.0], [0.352, 1.0]],
    'tg_doorstep': [[0.705, 0.785], [0.825, 0.785], [0.825, 0.845], [0.690, 0.845]],
    # G30 inn_key: blank pale area of the tag (centre, size along the tag axis), tag angle (deg, clockwise)
    'key_blank': {'cx': 0.598, 'cy': 0.432, 'w': 0.25, 'h': 0.105, 'angle': 23.5},
    # G31 pol_case: polaroid (face down) outer quad / its framed inner window / evidence tent face
    'pc_polaroid': [[0.567, 0.284], [0.781, 0.325], [0.752, 0.700], [0.531, 0.656]],
    'pc_window': [[0.582, 0.309], [0.763, 0.343], [0.740, 0.622], [0.551, 0.585]],
    'pc_tent': [[0.607, 0.072], [0.750, 0.100], [0.746, 0.252], [0.607, 0.207]],
    'pc_ruler_h': {'x0': 0.205, 'y0': 0.905, 'x1': 0.905, 'y1': 0.835},   # lower edge line of the long arm
    # G33 pol_tally: the three printed photos (outer) and the clean wall for the tally
    'pt_photos': [[[0.542, 0.338], [0.630, 0.343], [0.630, 0.467], [0.542, 0.465]],
                  [[0.657, 0.345], [0.737, 0.346], [0.737, 0.467], [0.657, 0.467]],
                  [[0.594, 0.515], [0.681, 0.515], [0.681, 0.643], [0.594, 0.645]]],
    'pt_tally': {'x': 0.14, 'y': 0.33, 'w': 0.28, 'h': 0.15},
    'pt_ruler': {'x0': 0.548, 'y': 0.709, 'x1': 0.648, 'vx': 0.541, 'vy0': 0.545, 'vy1': 0.70},
    # G34 pol_sticker: printed area right of the tear; ruler arms
    'ps_text': {'x': 0.486, 'y': 0.476, 'h': 0.064},
    'ps_ruler': {'hx0': 0.233, 'hy': 0.732, 'pitch': 0.0497, 'vx': 0.178, 'vy0': 0.645, 'vpitch': 0.0466},
}


def M(key):
    return MEAS[key]


# ================================================================ steps registry
STEPS = []


def step(fn):
    STEPS.append(fn)
    return fn


# ---------------------------------------------------------------- shared: handwriting / stencil / snow / grade
def lid_writing(im, quad_px, seed=7):
    """box lid (§8.3-7): '받는 사람: 601호' + 3.2em gap / '보내는 사람: —', his hand. Returns (image, name quad px)."""
    # flat lid card in pixels proportional to the flap's top edge length
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = quad_px
    lw = math.hypot(x1 - x0, y1 - y0); lh = math.hypot(x3 - x0, y3 - y0)
    cw = 1000; ch = int(cw * lh / lw)
    size = int(cw * 0.065 / 0.78)            # Hangul glyph height ≈ 0.78 em in pen.ttf -> 6.5 % of lid width
    line1 = '받는 사람: 601호'
    line2 = '보내는 사람: —'
    x, y = int(cw * 0.07), int(ch * 0.22)
    tex = cardboard_texture(im, quad_px)
    out, aw = hand.write_quad(im, line1 + '\n' + line2, quad_px, (cw, ch), (x, y), size, color=hand.INK_HIM,
                              angle=-2, alpha=235, blur=0.6, seed=seed, opacity=0.92, texture=tex)
    # name slot: right after '601호' on line 1, 3.2 em wide
    f = font(FONT_PEN, size)
    adv = ImageDraw.Draw(Image.new('L', (8, 8))).textlength(line1 + ' ', font=f)
    nx0, nx1 = x + adv, x + adv + 3.2 * size
    ny0, ny1 = y - size * 0.05, y + size * 1.0
    rad = math.radians(-(-2))  # hand.write rotates by angle (deg, PIL ccw) around (x, y)
    def rot(px, py):
        dx, dy = px - x, py - y
        c, s = math.cos(math.radians(-2)), math.sin(math.radians(-2))
        return (x + dx * c + dy * s, y - dx * s + dy * c)
    card_q = [rot(nx0, ny0), rot(nx1, ny0), rot(nx1, ny1), rot(nx0, ny1)]
    # card -> image homography
    H = homography([(0, 0), (cw, 0), (cw, ch), (0, ch)], quad_px)
    name_q = [apply_h(H, p) for p in card_q]
    return out, name_q


def homography(src, dst):
    Am = []
    for (x, y), (u, v) in zip(src, dst):
        Am.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        Am.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(Am, float))
    return vt[-1].reshape(3, 3) / vt[-1, -1]


def apply_h(Hm, p):
    v = Hm @ np.array([p[0], p[1], 1.0])
    return (v[0] / v[2], v[1] / v[2])


def cardboard_texture(im, quad_px):
    """0.75..1 modulation from the local cardboard grain (ink sinks less into the ridges)."""
    l = lum(A(im))
    hp = l - ndi.gaussian_filter(l, 3)
    return np.clip(0.88 + hp / 40.0, 0.7, 1.0)


# Stencil bridges per glyph, measured on sansb.ttf ink boxes (fractions of each glyph's own ink bbox).
# A real stencil only needs ties where a counter would fall out (ㅁ box, ㅇ ring) — plus the usual breaks at the
# turns of ㄹ and at stroke joints, so it still reads as a stencil. Never across ㅜ's bar or mid-stroke.
# (x, side, y0, y1): side 'c' = band centred on x, 'l' = band ends at x, 'r' = band starts at x; width BRIDGE_EM.
STENCIL_TEXT = '물탱크실'
STENCIL_CUTS = {
    '물': [(0.500, 'c', -0.03, 0.135), (0.500, 'c', 0.195, 0.36),      # ㅁ: top + bottom of the box
           (0.722, 'l', 0.555, 0.700), (0.275, 'r', 0.865, 1.03)],     # ㄹ: top-right + bottom-left turns
    '탱': [(0.167, 'r', 0.235, 0.375),                                  # ㅌ: middle bar off the stem
           (0.582, 'c', 0.610, 0.745), (0.582, 'c', 0.875, 1.03)],     # ㅇ: top + bottom of the ring
    '크': [(0.740, 'l', 0.345, 0.535)],                                 # ㅋ: middle bar off the stem
    '실': [(0.805, 'l', 0.555, 0.705), (0.362, 'r', 0.865, 1.03)],     # ㄹ: top-right + bottom-left turns
}
BRIDGE_EM = 0.045
STENCIL_PAINT = (232, 232, 224)      # spray paint albedo (was 214,214,204 — raised for ≥ 1.6:1 on the pale patch)
STENCIL_ALPHA = 0.86                 # base coverage (was .62): faded by (0.78 + 0.22·noise) patches


def stencil_alpha(card_wh, glyph_h, seed=3):
    """'물탱크실' stencil coverage in a flat card (§8.3-4): sansb, tracking +0.08 em, per-jamo bridges ≤ 0.05 em, spray."""
    cw, ch = card_wh
    size = int(glyph_h / 0.80)                # Noto Sans KR Bold Hangul ≈ 0.80 em tall
    f = font(FONT_BOLD, size)
    text = STENCIL_TEXT
    d0 = ImageDraw.Draw(Image.new('L', (8, 8)))
    advs = [d0.textlength(c, font=f) for c in text]
    total = sum(advs) + 0.08 * size * (len(text) - 1)
    if total > cw * 0.94:                       # fit the blank rectangle
        k = cw * 0.94 / total; size = int(size * k); f = font(FONT_BOLD, size)
        advs = [d0.textlength(c, font=f) for c in text]; total = sum(advs) + 0.08 * size * (len(text) - 1)
    lay = Image.new('L', (cw, ch), 0)
    x = (cw - total) / 2; y = ch / 2
    bw = BRIDGE_EM * size
    for c, adv in zip(text, advs):
        g = Image.new('L', (cw, ch), 0); dg = ImageDraw.Draw(g)
        dg.text((x, y), c, font=f, fill=255, anchor='lm')
        ga = np.asarray(g)
        ys_, xs_ = np.nonzero(ga > 127)
        if len(xs_):
            gx0, gx1, gy0, gy1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
            gw, gh = gx1 - gx0, gy1 - gy0
            for (bx, side, by0, by1) in STENCIL_CUTS.get(c, []):
                X = gx0 + bx * gw
                x0_, x1_ = {'c': (X - bw / 2, X + bw / 2), 'l': (X - bw, X), 'r': (X, X + bw)}[side]
                dg.rectangle([x0_, gy0 + by0 * gh, x1_, gy0 + by1 * gh], fill=0)
        lay = ImageChops.lighter(lay, g)
        x += adv + 0.08 * size
    a = A(lay) / 255.0
    rng = np.random.default_rng(seed)
    a = ndi.gaussian_filter(a, 1.2)
    spray = (rng.random(a.shape) < 0.02).astype(np.float32) * ndi.gaussian_filter(a, 6) * 3
    a = np.clip(a * 0.85 + spray * 0.5 + rng.normal(0, 0.06, a.shape), 0, 1)
    a = np.clip((a - 0.45) / 0.12, 0, 1)
    nz = noise_field(a.shape, 5.0, seed + 1)       # faded patches, not speckle (strokes must survive)
    return a * STENCIL_ALPHA * (0.78 + 0.22 * nz)


def stencil(im, quad_px, door_h_px, light=None, alpha_k=1.0, seed=3, paint=None):
    """paint the stencil into quad of im; light (HxW) scales the paint like the scene light (dark states).
    Returns (image, coverage, patch) — patch = the pale repainted rectangle around the letters (for contrast QA)."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = quad_px
    cw = int(max(math.hypot(x1 - x0, y1 - y0), 40)); ch = int(max(math.hypot(x3 - x0, y3 - y0), 20))
    scale = 4 if cw < 400 else 1                       # render small stencils at 4x then let the warp downsample
    a = stencil_alpha((cw * scale, ch * scale), 0.06 * door_h_px * scale, seed)
    aw = hand.warp_alpha(a, im.size, quad_px)
    b = A(im)
    l = lum(b) / 255.0
    rust = (l < 0.3) & (b[..., 0] > b[..., 2] * 1.15) & (b[..., 0] > b[..., 1] * 1.02)
    aw = aw * np.where(rust, 0.4, 1.0) * alpha_k
    tex = np.clip(0.88 + (l - ndi.gaussian_filter(l, 4)) * 1.6, 0.7, 1.08)   # rust/paint grain (multiplied back)
    paint = np.array(paint or STENCIL_PAINT, np.float32)[None, None, :] * tex[..., None]
    if light is not None: paint = paint * light[..., None]
    out = b * (1 - aw[..., None]) + paint * aw[..., None]
    patch = poly_mask(im.size, quad_px, 0) > 0.5
    return I(out), aw, patch


def stencil_contrast(img, aw, patch):
    """(WCAG ratio, plain linear-luminance ratio) of the letters vs the pale patch around them."""
    l = lum(A(img)) / 255
    lin = np.where(l <= 0.04045, l / 12.92, ((l + 0.055) / 1.055) ** 2.4)
    letters = aw > 0.35
    ring = ndi.binary_dilation(aw > 0.3, iterations=6) & ~ndi.binary_dilation(aw > 0.05, iterations=2) & patch
    Lp, Lb = lin[letters].mean(), lin[ring].mean()
    return (max(Lp, Lb) + 0.05) / (min(Lp, Lb) + 0.05), max(Lp, Lb) / max(min(Lp, Lb), 1e-6)


def snow_noise(shape, seed, low=None):
    """S1 accumulation noise: octaves σ 3 / 12 / 40 px weighted .2 / .5 / .3 at this image's own resolution.
    `low` replaces the σ40 octave — the one field the plate shares with the telephotos (same drifts, same place)."""
    n40 = low if low is not None else noise_field(shape, 40, seed + 2)
    return norm01(0.2 * noise_field(shape, 3, seed) + 0.5 * noise_field(shape, 12, seed + 1) + 0.3 * n40)


def edge_bias(up, sigma):
    """0..1, high on up-facing pixels next to a wall / parapet / kerb (snow drifts into edges and corners first)."""
    upb = up > 0.35
    e = ndi.gaussian_filter((~upb).astype(np.float32), sigma)
    return np.clip(e * 2.0, 0, 1) * upb


def snow_blend(base, snowy, up, n, c, ramp=0.30, dust=0.40, edge=None):
    """§8.3-3 S1: m = clip((up·(0.55+0.45·n') − (1−c)) / ramp, 0, 1), n' = n + .35·edge bias; plus a thin dusting
    (alpha `dust`·up) over every up-facing pixel; out = base·(1−m) + snowy·m. ramp .12 (doc) gave hard blobs -> .30."""
    nb = n if edge is None else n + 0.35 * edge
    m = np.clip((up * (0.55 + 0.45 * nb) - (1 - c)) / ramp, 0, 1)
    m = np.maximum(m, dust * up)
    return I(A(base) * (1 - m[..., None]) + A(snowy) * m[..., None]), m


def snow_mask_s2(up, grow=3, feather=4, thr=0.2):
    """S2 compositing mask: up-facing snow (dilated, feathered) — vertical surfaces keep the base (no edit texture)."""
    m = ndi.binary_dilation(up > thr, iterations=grow).astype(np.float32)
    return np.clip(np.maximum(ndi.gaussian_filter(m, feather), np.clip(up * 1.6, 0, 1)), 0, 1)


def grade_roof(im, seed=11, noise=5, bloom=True):
    """plate grade (§8.2 G01): WB toward 5200 K with teal shadows +3, lamp bloom σ18 screen .35, noise σ5, vignette .25."""
    a = A(im)
    l = lum(a) / 255.0
    a[..., 0] *= 0.975; a[..., 2] *= 1.025
    sh = np.clip(1 - l * 2.2, 0, 1)
    a[..., 1] += 3 * sh; a[..., 2] += 3 * sh
    im = I(a)
    if bloom:
        hl = np.clip((lum(A(im)) - 200) / 55, 0, 1)
        glow = gblur(A(im) * hl[..., None], 18)
        im = screen(im, I(glow), 0.35 * 1.6)
    im = grain(im, noise, seed=seed)
    return vignette(im, 0.25)


# ================================================================ ROOM (G14 G16 G17 G18 + G15 G25 later)
MEAS.update({
    # r2_bed (mirrored): the side window the model added (frame + sill), on the window wall seen edge-on
    'bed_window': [[0.0, 0.166], [0.136, 0.204], [0.166, 0.212], [0.170, 0.486], [0.180, 0.492], [0.180, 0.503], [0.0, 0.530]],
})


def r2_bed_img():
    """G17 mirrored, its side window removed (review r2_bed_window_mismatch: bronze frame, no curtain, while r2_window
    has a white frame + grey curtain). The side wall is re-filled by a quadratic fit of the white wall around it."""
    if 'r2_bed' in CACHE: return CACHE['r2_bed']
    b = ImageOps.mirror(S('g_r2_bed')); W, H = b.size
    a = A(b)
    pm = poly_mask((W, H), q_px(M('bed_window'), W, H), 0) > 0.5
    ring = ndi.binary_dilation(pm, iterations=14) & ~ndi.binary_dilation(pm, iterations=2) & (lum(a) > 175)
    ring[:, int(0.20 * W):] = False
    ys, xs = np.nonzero(ring)
    def basis(x, y):
        x = x / W; y = y / H
        return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)
    coef = np.linalg.lstsq(basis(xs.astype(float), ys.astype(float)), a[ys, xs], rcond=None)[0]
    yy, xx = np.nonzero(ndi.binary_dilation(pm, iterations=2))
    fill = a.copy()
    fill[yy, xx] = basis(xx.astype(float), yy.astype(float)) @ coef
    fill = fill + np.random.default_rng(17).normal(0, 1.3, (H, W, 1))
    m = ndi.gaussian_filter(ndi.binary_dilation(pm, iterations=2).astype(np.float32), 1.5)
    out = I(a * (1 - m[..., None]) + fill * m[..., None])
    CACHE['r2_bed'] = out
    return out


@step
def room():
    # ---- r2_door: the landlord's note + sticky = the close-up's own layout (same line breaks, same sticky place),
    # mapped paper-quad -> paper-quad, so the glyphs land ~5–6 px high: a 'written' texture, not readable at 1x
    d = S('g_r2_door'); W, H = d.size
    nq = q_px(M('door_note'), W, H)
    # lock body: the model's white emblem / blobs on the matte black panel (read as a brand mark at 8x) -> black
    y0l, y1l, x0l, x1l = int(0.4565 * H), int(0.4975 * H), int(0.527 * W), int(0.549 * W)
    da = A(d); sub = da[y0l - 8:y1l + 8, x0l - 8:x1l + 8].copy(); ls_ = lum(sub)
    inner = np.zeros(ls_.shape, bool); inner[8:-8, 8:-8] = True
    marks = ndi.binary_dilation(inner & (ls_ - ndi.median_filter(ls_, 13) > 14), iterations=2) & inner
    if marks.any():
        # fill = the panel itself around each mark (median of the unmarked pixels in a 15 px window)
        clean = np.where(marks[..., None], np.nan, sub)
        fillv = np.dstack([ndi.generic_filter(clean[..., c], np.nanmedian, size=15, mode='nearest') for c in range(3)])
        fillv = np.nan_to_num(fillv, nan=float(np.nanmedian(clean))) + np.random.default_rng(41).normal(0, 1.0, sub.shape[:2] + (1,))
        mk = ndi.gaussian_filter(marks.astype(np.float32), 0.6)
        da[y0l - 8:y1l + 8, x0l - 8:x1l + 8] = sub * (1 - mk[..., None]) + fillv * mk[..., None]
        d = I(da)
    QA['r2_door_lock_marks'] = f'{int(marks.sum())} px of white marks on the lock body painted matte black (LED = DOM)'
    if has('g_landlord_note'):
        L = landlord_closeup()
        pq2 = L['paper_q']
        co = find_coeffs(nq, pq2)                              # door px -> close-up px
        scale = (nq[1][0] - nq[0][0]) / max(1, pq2[1][0] - pq2[0][0])
        ta = Image.fromarray(np.clip(ndi.gaussian_filter(L['text_a'], 0.45 / scale) * 255, 0, 255).astype(np.uint8), 'L')
        aw = A(ta.transform(d.size, Image.PERSPECTIVE, co, Image.BICUBIC)) / 255
        d = hand.ink(d, np.clip(aw * 1.25, 0, 1), hand.INK_LANDLORD, 0.85)
        # the sticky (its paper + 4 lines), warped the same way, toned to this room's light, + a small shadow
        can = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); can.alpha_composite(L['sticky'], L['sticky_xy'])
        can = can.filter(ImageFilter.GaussianBlur(0.45 / scale))
        stw = A(can.transform(d.size, Image.PERSPECTIVE, co, Image.BICUBIC))
        sq = [apply_h(homography(pq2, nq), p) for p in L['sticky_q']]
        cl_grey = lum(A(L['im']))[20:120, 950:1010].mean()                # door paint in the close-up
        x0s = int(max(p[0] for p in sq)) + 3
        dr_grey = lum(A(d))[int(sq[0][1]):int(sq[2][1]), x0s:x0s + 8].mean()
        k = np.clip(dr_grey / max(cl_grey, 1), 0.6, 1.3)
        sal = stw[..., 3] / 255
        sh = ndi.gaussian_filter(ndi.shift(sal, (2, 1), order=1), 1.2) * 0.30 * (1 - sal)
        da = A(d) * (1 - sh[..., None])
        da = da * (1 - sal[..., None]) + stw[..., :3] * k * sal[..., None]
        d = I(da)
        MEAS['sticky_door'] = [[round(x / W, 4), round(y / H, 4)] for x, y in sq]
        QA['r2_door_note'] = f'close-up layout mapped (x{scale:.3f}): same line breaks, glyphs ≈{30 * scale:.1f}px; sticky toned x{k:.2f}'
    else:
        MEAS['sticky_door'] = M('door_note')
    jpg(d, 'r2_door')
    lf = M('door_leaf')
    META['door_gap'] = [lf[0], lf[1], lf[2], lf[3], lf[0]]
    META['led_lock'] = M('led_lock')
    META['peep'] = M('peep')
    META['door_note_q'] = M('door_note')
    META['door_sticky_q'] = [[round(v, 4) for v in p] for p in MEAS['sticky_door']]

    # ---- r2_window: chroma key -> glass transparent, mask, glass quads
    w = S('g_r2_window_in'); W, H = w.size
    a = A(w); mx = a.max(-1); mn = a.min(-1)
    hsv = np.asarray(w.convert('HSV')).astype(np.float32)
    hue = hsv[..., 0] / 255 * 360; sat = hsv[..., 1] / 255; val = hsv[..., 2] / 255
    key = (hue >= 105) & (hue <= 165) & (sat > 0.45) & (val > 0.25)
    key = ndi.binary_opening(key, iterations=2)
    lab, n = ndi.label(key)
    sizes = ndi.sum(key, lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(sizes)[::-1][:2] if sizes[i] > 5000]
    glass = np.isin(lab, keep)
    glass = ndi.binary_fill_holes(glass)
    quads = []
    for i in keep:
        quads.append(quad_extremes(ndi.binary_fill_holes(lab == i)))
    quads.sort(key=lambda q: q[0][0])
    soft = ndi.gaussian_filter(glass.astype(np.float32), 0.8)
    alpha = 1 - soft                                 # 1 = wall (opaque), 0 = glass
    # despill: clamp G to (R+B)/2 at the edge band
    band = (soft > 0.02) & (soft < 0.98) | ndi.binary_dilation(glass, iterations=3) & ~glass
    g2 = np.minimum(a[..., 1], (a[..., 0] + a[..., 2]) / 2)
    a[..., 1] = np.where(band, g2, a[..., 1])
    # second despill (review chroma_fringe): any green left within 4 px of the glass -> G ≤ max(R, B)
    near_g = ndi.binary_dilation(glass, iterations=4) & ~ndi.binary_erosion(glass, iterations=1)
    a[..., 1] = np.where(near_g, np.minimum(a[..., 1], np.maximum(a[..., 0], a[..., 2])), a[..., 1])
    CACHE['r2w'] = (a.copy(), alpha.copy())
    a = a * alpha[..., None]                         # glass -> black in the JPEG
    jpg(I(a), 'r2_window')
    mask_png(alpha, 'r2_window_mask', (512, 768))
    union = quad_extremes(glass)
    META['glass_q'] = q_frac(union, W, H)
    META['glass_panes'] = [q_frac(q, W, H) for q in quads]
    QA['chroma_key'] = f'{len(keep)} panes keyed, glass px {int(glass.sum())}'

    # ---- r2_bed: mirrored (its side window then sits on the 90° window wall), clock face for DOM hands
    b = r2_bed_img()
    jpg(b, 'r2_bed')
    c = M('clock_bed_src')
    META['clock_bed'] = {'cx': round(1 - c['cx'], 4), 'cy': c['cy'], 'r': c['r']}
    QA['r2_bed'] = ("mirrored left-right; the model-added side window (bronze frame, no curtain — unlike r2_window) "
                    'painted out as plain side wall (G17 asked for none)')

    # ---- r2_desk: phone screen quad (auto: darkest blob on the desk)
    k = S('g_r2_desk'); W, H = k.size
    reg = (slice(int(0.55 * H), int(0.61 * H)), slice(int(0.74 * W), int(0.83 * W)))
    l = lum(A(k))[reg]
    blob = l < 45
    blob = ndi.binary_opening(blob, iterations=1)
    lab, n = ndi.label(blob)
    if n:
        i = np.argmax(ndi.sum(blob, lab, range(1, n + 1))) + 1
        q = quad_extremes(lab == i)
        q = [(x + reg[1].start, y + reg[0].start) for x, y in q]
        META['np_desk_q'] = q_frac(q, W, H)
    jpg(k, 'r2_desk')


# ================================================================ CLOSE-UPS from pass 1 (G20 G22 G24)
MEAS.update({
    # G20 box_top (retry 1): inner floor of the box, the phone in its clear case (outer rounded rect), and the two
    # things under it, laid out once for both states: the landscape laminated card (note_card) and the instant print
    'box_floor': [[0.333, 0.388], [0.712, 0.388], [0.716, 0.668], [0.329, 0.668]],
    'box_phone_case': {'x0': 0.418, 'y0': 0.372, 'x1': 0.627, 'y1': 0.647, 'r': 0.034},
    'box_card': {'cx': 0.592, 'cy': 0.583, 'w': 0.232, 'angle': -6.0},       # w = fraction of width; 85:54
    'box_pol': {'cx': 0.391, 'cy': 0.594, 'w': 0.148, 'angle': 3.0},         # 88:107 portrait (G20's peek spot)
})


def rot_quad(cx, cy, w, h, ang_deg):
    """TL TR BR BL of a w x h rectangle centred at (cx, cy) rotated by ang (deg, + = clockwise on screen)."""
    a = math.radians(ang_deg); c, s_ = math.cos(a), math.sin(a)
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    return [(cx + x * c - y * s_, cy + x * s_ + y * c) for x, y in pts]


def rounded_alpha(w, h, r, ss=4):
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], int(r * ss), fill=255)
    return m.resize((w, h), Image.LANCZOS)


def note_card_flat():
    """the laminated card as a flat RGBA (front, '돌려줄게. —' in his hand with exactly note_card_front's layout)."""
    q = q_px(META.get('note_card_q') or [[0.1377, 0.4346], [0.7207, 0.2207], [0.9121, 0.543], [0.2646, 0.8262]], 1024, 1024)
    e_top = math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]); e_left = math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])
    ch = 300; cw = int(ch * max(e_top, e_left) / min(e_top, e_left))
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32)
    base = np.dstack([np.full((ch, cw), 236.0), np.full((ch, cw), 236.0), np.full((ch, cw), 231.0)])
    base *= (0.97 + 0.03 * (1 - yy / ch))[..., None] * (0.985 + 0.03 * noise_field((ch, cw), 1.0, 401))[..., None]
    glare = np.exp(-(((xx - cw * 0.86) / (cw * 0.10)) ** 2 + ((yy - ch * 0.18) / (ch * 0.22)) ** 2))
    base = base + (glare * 16)[..., None]
    edge = np.minimum(np.minimum(xx, cw - 1 - xx), np.minimum(yy, ch - 1 - yy))
    base *= (0.90 + 0.10 * np.clip(edge / 4, 0, 1))[..., None]           # laminate edge
    card = hand.write(I(base), '돌려줄게. —', (int(cw * 0.09), int(ch * 0.33)), 92, color=hand.INK_HIM, angle=-3,
                      alpha=235, blur=0.6, seed=11)
    al = rounded_alpha(cw, ch, ch * 0.075)
    return Image.merge('RGBA', (*card.split(), al))


def box_scene():
    """box interior shared by box_top / box_top_lifted (review box_card_continuity): G20 outside the floor; the
    floor = G21 (registered to G20) with its own sheet + photo removed (quadratic light fit + its clean cardboard
    grain); on it the instant print (polaroid_601's own print) and the landscape laminated card with '돌려줄게. —'
    — same quads in both states. Returns (lifted RGB, quads, phone alpha, phone RGB)."""
    if 'box_scene' in CACHE: return CACHE['box_scene']
    g20 = S('g_box_top'); W, H = g20.size
    b = A(g20)
    fq = q_px(M('box_floor'), W, H)
    fm = poly_mask((W, H), fq, 1.5)
    c = M('box_phone_case')
    case = np.zeros((H, W), bool); case[int(c['y0'] * H):int(c['y1'] * H), int(c['x0'] * W):int(c['x1'] * W)] = True
    lb = lum(b)
    hsv = A(g20.convert('HSV'))
    objs = (lb > 150) | ((hsv[..., 1] < 70) & (lb < 110)) | case                # white sheet, the print, the phone
    objs = ndi.binary_dilation(objs & (fm > 0.2), iterations=10)
    known = (fm > 0.97) & ~objs
    ys, xs = np.nonzero(known)
    def basis(x, y):
        x = x / W; y = y / H
        return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)
    coef = np.linalg.lstsq(basis(xs.astype(float), ys.astype(float)), b[ys, xs], rcond=None)[0]
    YY, XX = np.mgrid[0:H, 0:W]
    light = (basis(XX.ravel().astype(float), YY.ravel().astype(float)) @ coef).reshape(H, W, 3)
    # kraft liner grain: fine fibres + faint flute shadows across the floor (no tiling, no copied structure)
    rng_ = np.random.default_rng(311)
    fib = ndi.gaussian_filter(rng_.normal(0, 1, (H, W)), (0.6, 2.4)) * 2.2 + ndi.gaussian_filter(rng_.normal(0, 1, (H, W)), 3) * 2.5
    flute = np.sin(XX / (0.0105 * W) * 2 * np.pi) * 0.8
    tex = (fib + flute)[..., None] * (lum(light) / 150)[..., None]
    floor = light + tex
    # the inside edge where floor meets the walls stays G20 (its real shading); everything else on the floor is rebuilt
    fill = ndi.gaussian_filter((objs & (fm > 0.2)).astype(np.float32), 2.0) * fm
    lifted = b * (1 - fill[..., None]) + floor * fill[..., None]
    # the case's top rim overlapped the back wall's foot: per row, bridge the wall across the phone's width
    xa, xb = int((c['x0'] - 0.012) * W), int((c['x1'] + 0.012) * W)
    for y in range(int((c['y0'] - 0.004) * H), int(0.389 * H)):
        la_, lb_ = lifted[y, xa - 6:xa].mean(0), lifted[y, xb:xb + 6].mean(0)
        t_ = np.linspace(0, 1, xb - xa)[:, None]
        lifted[y, xa:xb] = la_ * (1 - t_) + lb_ * t_ + rng_.normal(0, 1.5, (xb - xa, 1))
    # floor light (for things lying on it): normalised luminance of the fit
    shade = lum(light) / max(np.percentile(lum(light)[fm > 0.5], 95), 1)
    def lay(base_, rgba, quad, shadow=(5, 7, 4, 0.40)):
        w_, h_ = rgba.size
        coeffs = find_coeffs(quad, [(0, 0), (w_, 0), (w_, h_), (0, h_)])
        wc = A(rgba.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC))
        al = wc[..., 3] / 255
        dx, dy, sg, op = shadow
        sh = ndi.gaussian_filter(ndi.shift(al, (dy, dx), order=1), sg) * op * (1 - al)
        out = base_ * (1 - sh[..., None])
        lit = wc[..., :3] * np.clip(0.62 + 0.45 * shade, 0.5, 1.05)[..., None]
        return out * (1 - al[..., None]) + lit * al[..., None], al
    # card (under), then the print (on top of the card's left edge)
    pc, _ = polaroid_print()
    pk = M('box_pol'); pw = pk['w'] * W; ph = pw * 107 / 88
    pq = rot_quad(pk['cx'] * W, pk['cy'] * H, pw, ph, pk['angle'])
    lifted, pal = lay(lifted, pc.convert('RGBA'), pq, (5, 6, 3, 0.40))
    card = note_card_flat()                       # on top: its left edge rests on the print's right border
    k = M('box_card'); cwp = k['w'] * W; chp = cwp * 54 / 85
    cq = rot_quad(k['cx'] * W, k['cy'] * H, cwp, chp, k['angle'])
    lifted, cal = lay(lifted, card, cq, (4, 5, 3, 0.35))
    # face quad of the print (for meta): 640 px face at (60, 60) in the 760 x 925 print
    Hm = homography([(0, 0), (760, 0), (760, 925), (0, 925)], pq)
    face_q = [apply_h(Hm, p) for p in [(60, 60), (700, 60), (700, 700), (60, 700)]]
    # the phone of G20 (clear case included) as an alpha layer
    c = M('box_phone_case')
    x0, y0, x1, y1 = c['x0'] * W, c['y0'] * H, c['x1'] * W, c['y1'] * H
    pm = Image.new('L', (W * 2, H * 2), 0)
    ImageDraw.Draw(pm).rounded_rectangle([x0 * 2, y0 * 2, x1 * 2, y1 * 2], int(c['r'] * W * 2), fill=255)
    palpha = A(pm.resize((W, H), Image.LANCZOS)) / 255
    out = (I(lifted), {'card': cq, 'pol': pq, 'pol_face': face_q}, palpha, b)
    CACHE['box_scene'] = out
    QA['box_continuity'] = 'box_top / box_top_lifted share every pixel outside the phone case; one landscape card (돌려줄게. —, note_card layout) + the polaroid_601 print at fixed quads'
    return out


def box_on_cabinet(im, W, H, seed=9):
    """box_*_in (review box_in_background): the cut-out box (eroded 2 px, snow crumbs on the flap rims removed) on the
    white shoe-cabinet top under the same flashlight, with a soft contact shadow and the cabinet's front edge."""
    bp = q_px(M('box_poly'), W, H)
    m0 = poly_mask((W, H), bp, 0) > 0.5
    a = A(im)
    # the polygon is approximate: keep cardboard-coloured pixels near its outline, everything well inside
    card_ = (a[..., 0] > a[..., 2] + 14) & (lum(a) > 45)
    m = (ndi.binary_dilation(m0, iterations=8) & card_) | ndi.binary_erosion(m0, iterations=22)
    m = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_opening(m, iterations=2), iterations=3))
    m = ndi.binary_erosion(m, iterations=2)
    # snow crumbs: small bright, unsaturated specks on the cardboard rims -> local cardboard median
    hsv = A(im.convert('HSV')); l = lum(a)
    crumbs = (l > 175) & (hsv[..., 1] < 70) & m
    lab, n = ndi.label(crumbs)
    if n:
        sz = ndi.sum(crumbs, lab, range(1, n + 1))
        crumbs = np.isin(lab, [i + 1 for i in range(n) if sz[i] < 400])
    # keep the phone screen / card / print (big blobs) — only specks near the box outline count
    rim = m & ~ndi.binary_erosion(m, iterations=40)
    crumbs = ndi.binary_dilation(crumbs & rim, iterations=2)
    med = np.dstack([ndi.median_filter(a[..., c_], 9) for c_ in range(3)])
    a = np.where(crumbs[..., None], med, a)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # white laminate under the same phone flash as the box (falloff from upper left), faint sheen, fine grain
    fall = 0.40 + 0.62 * np.exp(-(((xx - W * 0.36) ** 2) + ((yy - H * 0.40) ** 2)) / (2 * (W * 0.55) ** 2))
    top = np.dstack([214 * fall, 213 * fall, 208 * fall]) * (0.985 + 0.03 * noise_field((H, W), 1.0, seed))[..., None]
    top = top + (np.exp(-(((xx - W * 0.30) / (W * 0.18)) ** 2 + ((yy - H * 0.30) / (H * 0.10)) ** 2)) * 10)[..., None]
    edge_y = 0.955 * H                                            # the cabinet's front edge; the entry floor far below
    front = np.clip((yy - edge_y) / 2.5, 0, 1)
    below = gblur(np.dstack([fall * 70, fall * 70, fall * 74]), 6)
    top = top * (1 - front[..., None]) + below * front[..., None]
    top = top * (1 - 0.18 * np.clip(1 - np.abs(yy - edge_y) / 2.0, 0, 1))[..., None]
    sh = ndi.gaussian_filter(ndi.shift(m.astype(np.float32), (14, 9), order=0), 14) * 0.42
    top = top * (1 - sh[..., None])
    ms = ndi.gaussian_filter(m.astype(np.float32), 0.8)
    return I(a * ms[..., None] + top * (1 - ms[..., None]))


@step
def box():
    lifted, qs, palpha, b20 = box_scene()
    W, H = lifted.size
    # box_top: the phone back on top (+ its soft shadow toward lower right, like the flashlight from upper left)
    sh = ndi.gaussian_filter(ndi.shift(palpha, (8, 6), order=1), 5) * 0.45 * (1 - palpha)
    top = A(lifted) * (1 - sh[..., None])
    top = top * (1 - palpha[..., None]) + b20 * palpha[..., None]
    out, name_q = lid_writing(I(top), q_px(M('lid_flap'), W, H), seed=7)
    # phone screen quad (auto: brightest blob)
    l = lum(b20)
    scr = ndi.binary_opening(l > 238, iterations=2)
    lab, n = ndi.label(scr)
    i = np.argmax(ndi.sum(scr, lab, range(1, n + 1))) + 1
    META['box_phone_q'] = q_frac(quad_extremes(ndi.binary_fill_holes(lab == i)), W, H)
    META['lid_name_q'] = q_frac(name_q, W, H)
    META['box_card_q'] = q_frac(qs['card'], W, H)
    META['box_pol_q'] = q_frac(qs['pol'], W, H)
    jpg(out, 'box_top')
    jpg(box_on_cabinet(out, W, H), 'box_top_in')
    META['_box_poly'] = M('box_poly')
    META['_lid_flap'] = M('lid_flap')               # qa_ep2: the shipped '6' is read back through this quad
    # box_top_lifted: identical outside the phone case; the print's face is polaroid_601's photo
    lo, nq = lid_writing(lifted, q_px(M('lid_flap'), W, H), seed=7)
    jpg(lo, 'box_top_lifted')
    jpg(box_on_cabinet(lo, W, H), 'box_top_lifted_in')
    META['box_lifted_photo_q'] = q_frac(qs['pol_face'], W, H)
    META['lid_name_q_lifted'] = q_frac(nq, W, H)
    d = np.abs(A(out) - A(lo)).sum(-1) > 3
    outside = d & ~ndi.binary_dilation(palpha > 0.01, iterations=12)
    beyond = d & ~ndi.binary_dilation(palpha > 0.01, iterations=24)
    QA['box_lifted_outside_phone_diff_px'] = f'{int(outside.sum())} px differ outside the case + 12 px (its soft shadow), {int(beyond.sum())} px outside + 24 px'


@step
def note_card():
    c = S('g_note_card'); W, H = c.size
    l = lum(A(c))
    hsv = np.asarray(c.convert('HSV')).astype(np.float32)
    card = ndi.binary_opening((hsv[..., 1] < 40) & (l > 100), iterations=3)   # white laminate: grey, unsaturated; cardboard is brown
    lab, n = ndi.label(card); i = np.argmax(ndi.sum(card, lab, range(1, n + 1))) + 1
    q = quad_extremes(ndi.binary_fill_holes(lab == i))
    # order so that TL..BL follow the card's long edge as its top edge
    (tl, tr, br, bl) = q
    e_top = math.hypot(tr[0] - tl[0], tr[1] - tl[1]); e_left = math.hypot(bl[0] - tl[0], bl[1] - tl[1])
    if e_left > e_top: tl, tr, br, bl = bl, tl, tr, br
    quad = [tl, tr, br, bl]
    ch = 300; cw = int(ch * max(e_top, e_left) / min(e_top, e_left))
    # front: 돌려줄게. — (ep1 IMG_0606 ink and the same size : card-height ratio 92/300, −3°)
    front, _ = hand.write_quad(c, '돌려줄게. —', quad, (cw, ch), (int(cw * 0.09), int(ch * 0.33)), 92,
                               color=hand.INK_HIM, angle=-3, alpha=235, blur=0.6, seed=11)
    jpg(front, 'note_card_front')
    # back: mirrored photo, glare moved to the opposite corner, the printed form of ep1 post.py 218–220 only
    bk = ImageOps.mirror(c)
    ba = A(bk); lb = lum(ba)
    glare = np.clip((lb - 215) / 30, 0, 1)
    glare = ndi.gaussian_filter(glare, 4)
    ba = ba - glare[..., None] * 18                   # knock the old glare down
    mq = [(W - x, y) for x, y in quad]
    mq = [mq[1], mq[0], mq[3], mq[2]]
    cx, cy = mq[3]; ox, oy = mq[1]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = np.exp(-(((xx - (cx * 0.8 + ox * 0.2)) ** 2 + (yy - (cy * 0.8 + oy * 0.2)) ** 2) / (2 * 60 ** 2)))
    cm = poly_mask(c.size, mq, 1)
    ba = ba + (g * cm)[..., None] * 60
    bk = I(ba)
    form = Image.new('L', (cw, ch), 0); d = ImageDraw.Draw(form)
    d.text((22, 18), '현관 도어락 관리자 카드', font=font(FONT_BOLD, 28), fill=255)
    d.line([(22, 62), (cw - 22, 62)], fill=int(255 * 60 / 30 * 0.5), width=2)
    d.text((22, 76), '관리자 비밀번호', font=font(FONT_SANS, 22), fill=200)
    fa = A(form.filter(ImageFilter.GaussianBlur(0.4))) / 255.0
    aw = hand.warp_alpha(fa, bk.size, mq)
    bk = hand.ink(bk, aw * 0.9, hand.INK_PRINT, 1.0)
    jpg(bk, 'note_card_back')
    QA['note_card_back'] = 'printed elements: title / rule / 관리자 비밀번호 only; blank below (no digits)'
    META['note_card_q'] = q_frac(quad, W, H)


@step
def peephole():
    p = S('g_peephole'); W, H = p.size
    l = lum(A(p))
    disc = ndi.binary_fill_holes(ndi.binary_opening(l > 18, iterations=4))
    lab, n = ndi.label(disc); i = np.argmax(ndi.sum(disc, lab, range(1, n + 1))) + 1
    disc = lab == i
    ys, xs = np.nonzero(disc)
    cx, cy = xs.mean(), ys.mean(); r = math.sqrt(disc.sum() / math.pi)
    jpg(p, 'peephole_s0')
    # snow on the floor inside the lens (review peephole_s2_fog): noise-thresholded snow that keeps the floor's own
    # luminance detail and the lamp's glints, thinning toward the lens rim; a snow cap along the parapet top arc
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    pa = A(p); l = lum(pa)
    edge = (0.338 + 0.45 * (xx / W - 0.5) ** 2) * H
    floor = disc & (yy > edge + 4)
    fm = ndi.gaussian_filter(floor.astype(np.float32), 5)
    rr = np.hypot(xx - cx, yy - cy) / r
    fm = fm * np.clip((1.0 - rr) / 0.12, 0.35, 1)                      # thinner toward the fisheye rim
    lf = ndi.gaussian_filter(l, 10)
    lit = np.clip(lf / max(np.percentile(lf[floor], 97), 1), 0.08, 1.1)
    detail = np.clip(l / np.maximum(lf, 1), 0.6, 1.4)
    snow_l = (70 + 150 * lit) * (0.85 + 0.15 * detail) * (0.95 + 0.10 * noise_field((H, W), 0.9, 30))
    snow = np.dstack([snow_l * 0.99, snow_l * 1.0, snow_l * 1.05])
    glint = np.clip((l - 200) / 40, 0, 1)                             # the lamp's specular glints survive
    nz = norm01(0.2 * noise_field((H, W), 3, 31) + 0.5 * noise_field((H, W), 12, 32) + 0.3 * noise_field((H, W), 40, 33))
    # parapet top: per column the sky -> parapet step above the floor arc, inside the disc
    gy = np.diff(ndi.gaussian_filter(l, 1.5), axis=0)
    # parapet top: the band's dark shadow line (its foot) is found per column; the top edge is a band height above it
    # (city lights behind the parapet make the top edge itself undetectable in the middle of the lens)
    ls = ndi.gaussian_filter(l, 1.5)
    xs_ = np.arange(int(cx - r * 0.80), int(cx + r * 0.78))
    tops = []
    band_h = 0.046 * H
    for x in xs_:
        ye = int(edge[0, x]); a_, b_ = max(2, ye - 30), min(H - 2, ye + 30)
        k = a_ + int(np.argmin(ls[a_:b_, x]))
        tops.append(k - band_h if disc[min(H - 1, k), x] else np.nan)
    tops = np.array(tops, float)
    ok_ = ~np.isnan(tops)
    cap = np.zeros((H, W), np.float32)
    if ok_.sum() > 50:
        tops = np.interp(np.arange(len(tops)), np.nonzero(ok_)[0], tops[ok_])
        tops = ndi.gaussian_filter1d(ndi.median_filter(tops, 31), 4)
        ytop = np.full(W, np.nan); ytop[xs_] = tops
        th_ = 0.010 * H * (0.75 + 0.5 * noise_field((1, W), 10, 34)[0])
        tap = np.zeros(W); tap[xs_] = np.clip(np.minimum(xs_ - xs_[0], xs_[-1] - xs_) / 40.0, 0, 1)
        th_ = th_ * tap
        yt = np.nan_to_num(ytop, nan=-99)[None, :]
        cap = ((yy <= yt + 1.5) & (yy >= yt - th_[None, :])).astype(np.float32)
        cap = ndi.gaussian_filter(cap, 0.9) * disc
    for key, cov in (('peephole_s1', 0.45), ('peephole_s2', 1.0)):
        if cov < 1:
            m = np.clip((nz - (1 - cov)) / 0.3, 0, 1) * 0.80 + 0.25 * (1 - np.clip((nz - (1 - cov)) / 0.3, 0, 1))
        else:
            m = 0.90 + 0.10 * nz
        m = m * fm * (1 - glint * 0.8)
        out = pa * (1 - m[..., None]) + snow * m[..., None]
        cm = cap * (0.9 if cov == 1 else 0.45) * (0.75 + 0.25 * nz)
        capc = np.array([196, 199, 207.0]) * (0.93 + 0.1 * noise_field((H, W), 1.0, 35))[..., None]
        out = out * (1 - cm[..., None]) + capc * cm[..., None]
        jpg(grain(I(out), 3, seed=4), key)
    # tape over the lens (00:22–01:10): near black, crumpled tape grain, faint leak at the rim
    s = 512
    t = np.full((s, s), 8.0)
    cr = noise_field((s, s), 6, 40) - 0.5
    cr2 = noise_field((s, s), 1.5, 41) - 0.5
    t += cr * 10 + cr2 * 4
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    rr2 = np.sqrt((xx - s / 2) ** 2 + (yy - s / 2) ** 2) / (s / 2 * r / (W / 2) * (W / 2) / (s / 2) * (s / 2) / (s / 2))
    rim = np.exp(-((rr2 - 0.82) ** 2) / (2 * 0.05 ** 2))
    t += rim * 9 * (0.5 + noise_field((s, s), 8, 42))
    tt = np.dstack([t * 1.0, t * 1.0, t * 1.15])
    jpg(I(tt), 'peep_tape', q=90)
    META['peephole_disc'] = {'cx': round(cx / W, 4), 'cy': round(cy / H, 4), 'r': round(r / W, 4)}


# ================================================================ G27 series: win_shot / polaroid_601 / roofvid
WIN_SHOTS = [  # (#, lit, floor, jitter, tilt, ev, noise)
    (1, 1, 'dry', 0.00, 0.0, 0.0, 7), (2, 1, 'dry', 0.02, 0.8, -0.2, 7), (3, 0, 'dry', -0.01, -0.5, -0.4, 9),
    (4, 1, 'dry', 0.01, 1.2, 0.0, 7), (5, 1, 'snow', -0.02, -1.0, 0.2, 7), (6, 0, 'melt', 0.03, 0.4, -0.5, 10),
    (7, 1, 'dry', 0.00, -1.4, 0.0, 7), (8, 1, 'dry', -0.03, 0.6, -0.1, 7), (9, 0, 'dry', 0.01, -0.3, -0.4, 7),
    (10, 1, 'snow', -0.01, 1.5, 0.3, 7), (11, 1, 'slush', 0.02, -0.8, 0.0, 7), (12, 0, 'dry', 0.00, 0.9, -0.5, 7),
    (13, 1, 'dry', -0.02, -0.2, 0.0, 7), (14, 1, 'dry', 0.01, 0.3, -0.1, 7),
]
WS_CROP = {'x': 0.30, 'y': 0.16, 'w': 0.525, 'h': 0.59}   # 4:3 in px; left door band ≈ 10 % of each frame


def g27_fixed():
    """G27 with the 601 front door corrected (review g27_601_door_padlock): the hasp + closed padlock the model drew
    replaced by e_fix_601 (high edit of a 3.4x crop: black digital lock body, keypad cover closed and blank, black
    lever — the same door as r2_door / doorlock_in from outside). Feathered diff mask inside the lock area only."""
    if 'g27' in CACHE: return CACHE['g27']
    g = S('g_tankgap_601')
    if not has('e_fix_601'):
        MISSING.append('e_fix_601 -> 601 door keeps the hasp/padlock in win_shot/polaroid/roofvid'); CACHE['g27'] = g; return g
    from prep_ep2 import FIX_CROPS
    box = FIX_CROPS['ref_fix_601']['box']
    bw, bh = box[2] - box[0], box[3] - box[1]
    orig = A(g.crop(box))
    ed = A(S('e_fix_601').resize((bw, bh), Image.LANCZOS))
    reg = np.zeros((bh, bw), bool); reg[int(0.17 * bh):int(0.72 * bh), int(0.12 * bw):int(0.70 * bw)] = True
    d = np.abs(gblur(lum(ed), 1.0) - gblur(lum(orig), 1.0))
    ch = ndi.binary_opening((d > 7) & reg, iterations=1)
    lab, n = ndi.label(ch)
    if n:
        sz = ndi.sum(ch, lab, range(1, n + 1)); ch = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 12])
    ch = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_dilation(ch, iterations=3), iterations=3))
    ring = reg & ~ndi.binary_dilation(ch, iterations=5)
    for c in range(3):
        me, se = ed[..., c][ring].mean(), ed[..., c][ring].std() + 1e-6
        mo, so = orig[..., c][ring].mean(), orig[..., c][ring].std() + 1e-6
        ed[..., c] = (ed[..., c] - me) / se * so + mo
    al = np.clip(ndi.gaussian_filter(ch.astype(np.float32), 1.5) * 1.2, 0, 1) * reg
    a = A(g); a[box[1]:box[3], box[0]:box[2]] = orig * (1 - al[..., None]) + ed * al[..., None]
    out = I(a)
    QA['g27_601_door'] = f'e_fix_601 pasted: {int((al > 0.5).sum())} px (hasp+padlock -> digital lock body + lever)'
    CACHE['g27'] = out
    return out


MEAS.update({
    # G27: horizontal edges that hold snow (y, x0, x1 or polyline) — oktap roof coping, window outer sill, the slab
    # roof over the 601 entrance, the doorstep top
    'tg_caps': [[[0.372, 0.222], [0.598, 0.224]],
                [[0.437, 0.497], [0.566, 0.497]],
                [[0.668, 0.112], [0.820, 0.126]],
                [[0.592, 0.236], [0.668, 0.112]],
                [[0.703, 0.787], [0.825, 0.787]]],
})


def floor_snow(im, poly_px, kind, seed, caps=True):
    """§8.3-8 floor of the win_shot series: 'snow' = noise-thresholded snow layer that keeps the lamp falloff and a
    fine surface grain, soft irregular edge, thin caps on every horizontal edge; 'melt' = leftover patches;
    'slush' = translucent grey-white patches (α .35–.55) with wet specular streaks."""
    W, H = im.size
    a = A(im)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # irregular boundary: displace the polygon mask by low-frequency noise
    fm0 = poly_mask(im.size, poly_px, 0)
    dn = noise_field((H, W), 6, seed + 7) - 0.5
    fm = np.clip(ndi.gaussian_filter(fm0, 2.5) + dn * 0.9, 0, 1)
    fm = np.clip((fm - 0.35) / 0.3, 0, 1) * ndi.binary_dilation(fm0 > 0.5, iterations=6)
    nz = norm01(0.2 * noise_field((H, W), 3, seed) + 0.5 * noise_field((H, W), 12, seed + 2) + 0.3 * noise_field((H, W), 40, seed + 1))
    l = lum(a)
    lf = ndi.gaussian_filter(l, 14)
    ref = max(np.percentile(lf[fm0 > 0.5], 96), 1)
    # the caged lamp is off frame left: its pool on the floor falls off to the right and toward the far wall
    lamp = np.exp(-(((xx / W - 0.30) / 0.30) ** 2 + ((yy / H - 0.80) / 0.32) ** 2))
    lit = np.clip(0.55 * np.clip(lf / ref, 0, 1.1) + 0.55 * lamp, 0.08, 1.05) ** 1.3
    grain_ = (0.92 + 0.16 * noise_field((H, W), 0.8, seed + 3)) * (0.95 + 0.10 * noise_field((H, W), 10, seed + 4))
    hp = (l - ndi.gaussian_filter(l, 3)) / 255.0                     # ruts / stains still telling through thin snow
    snow = np.dstack([58 + 150 * lit, 62 + 150 * lit, 74 + 152 * lit]) * grain_[..., None] * (1 + 0.35 * hp)[..., None]
    if kind == 'snow':
        m = np.clip((0.80 + 0.30 * (nz - 0.5)) * fm, 0, 1)
        a = a * (1 - m[..., None]) + snow * m[..., None]
    elif kind == 'melt':
        m = np.clip((nz - 0.52) / 0.16, 0, 1) * fm * 0.9
        wet = np.clip((nz - 0.38) / 0.1, 0, 1) * fm * (1 - m) * 0.22       # darker wet rims around the patches
        a = a * (1 - wet[..., None])
        a = a * (1 - m[..., None]) + snow * 0.93 * m[..., None]
    elif kind == 'slush':
        m = (0.35 + 0.20 * np.clip((nz - 0.55) / 0.25, 0, 1)) * np.clip((nz - 0.42) / 0.10, 0, 1) * fm
        grey = np.dstack([l * 0.30 + 96 * lit + 40, l * 0.30 + 98 * lit + 42, l * 0.30 + 102 * lit + 48]) * grain_[..., None]
        a = a * (1 - 0.20 * fm[..., None])                               # the whole floor is wet: darker
        a = a * (1 - m[..., None]) + grey * m[..., None]
        # wet specular streaks: the lamp (off frame left) reflected in the water film — a few short, soft vertical
        # streaks under it, strongest in its pool (not a uniform rain of lines)
        st = ndi.gaussian_filter(np.random.default_rng(seed + 9).random((H, W)).astype(np.float32), (14, 2.2))
        st = np.clip((norm01(st) - 0.86) / 0.10, 0, 1) * fm * lamp ** 1.5 * (1 - m)
        a = a + (st * 55)[..., None] * np.array([0.92, 0.96, 1.0])
    if caps and kind in ('snow', 'melt'):
        capl = Image.new('L', (W, H), 0); dc = ImageDraw.Draw(capl)
        for seg in M('tg_caps'):
            pts = q_px(seg, W, H)
            wpx = max(2, int(0.006 * H * (1.0 if kind == 'snow' else 0.5)))
            dc.line([(x, y - wpx / 2) for x, y in pts], fill=255, width=wpx)
        cm = A(capl) / 255
        cm = ndi.gaussian_filter(cm, 0.8) * (0.75 + 0.5 * noise_field((H, W), 2, seed + 5))
        if kind == 'melt': cm = cm * (noise_field((H, W), 8, seed + 6) > 0.55)
        cm = np.clip(cm, 0, 1)
        capc = np.dstack([lf * 0.55 + 120, lf * 0.55 + 124, lf * 0.55 + 134])
        a = a * (1 - cm[..., None]) + capc * cm[..., None]
    return I(a)


@step
def tankgap():
    g = g27_fixed(); W, H = g.size
    win = M('tg_window')
    floor = q_px(M('tg_floor'), W, H)
    for (n, lit, fl, jit, tilt, e, sg) in WIN_SHOTS:
        im = g.copy()
        if not lit:
            a = A(im)
            wm = np.zeros((H, W), np.float32)
            x0, y0 = int(win['x'] * W), int(win['y'] * H); x1, y1 = int((win['x'] + win['w']) * W), int((win['y'] + win['h']) * H)
            wm[y0:y1, x0:x1] = 1
            wm = ndi.gaussian_filter(wm, 2)
            warmth = np.clip((a[..., 0] - a[..., 2]) / 60, 0, 1) * wm
            a = a * (1 - warmth[..., None] * 0.88)
            im = I(a)
        if fl != 'dry':
            im = floor_snow(im, floor, fl, 100 + n)
        r = dict(WS_CROP); r['x'] = r['x'] + jit * 0.5
        c = crop_frac(im, r)
        if tilt: c = c.rotate(tilt, Image.BICUBIC, expand=False).crop((int(c.width * 0.02), int(c.height * 0.02), int(c.width * 0.98), int(c.height * 0.98)))
        c = c.resize((1024, 768), Image.LANCZOS)
        c = ev(c, e)
        c = grain(c, sg * 0.7, seed=200 + n)
        jpg(c, 'win_shot_%02d' % n)
    META['win_shot_crop'] = WS_CROP
    # roof video frames (12-21 23:40): left-bottom (door band + floor), −1.2 EV, σ12, slush
    sl = floor_snow(g, floor, 'slush', 77)
    base = {'x': 0.20, 'y': 0.48, 'w': 0.46, 'h': 0.517}
    f1 = crop_frac(sl, base).resize((1024, 768), Image.LANCZOS)
    f1 = grain(ev(f1, -1.2), 12, seed=301)
    jpg(f1, 'roofvid_f1')
    r2 = dict(base); r2['x'] += 0.08 * base['w'] / 0.46 * 0.46; r2['y'] -= 0.08
    f2 = grain(ev(crop_frac(sl, r2).resize((1024, 768), Image.LANCZOS), -1.2), 12, seed=302)
    jpg(f2, 'roofvid_f2')
    a = A(ev(crop_frac(sl, base).resize((1024, 768), Image.LANCZOS), -1.2))
    a = ndi.uniform_filter1d(a, 6, axis=0)
    jpg(grain(I(a), 12, seed=303), 'roofvid_f3')
    # polaroid_601 (instant photo on the dark cardboard floor of the box) + plain back
    polaroid_601(g)


def instant_grade(im):
    a = A(im)
    a = a * 0.86 + 18                                   # lifted blacks (+18)
    l = lum(a)
    a[..., 0] *= 0.97; a[..., 1] *= 1.03; a[..., 2] *= 0.94   # green-yellow cast
    m = l[..., None]
    a = m + (a - m) * 0.8                               # saturation .8
    a = np.where(a > 200, 200 + (a - 200) * 0.45, a)     # highlight roll-off
    return I(a)


def polaroid_print():
    """the instant print itself (front card 760x925 with the G27 face, plain back) — shared by polaroid_601 and the
    box views (the same print under the phone). Cached."""
    if 'pol_print' in CACHE: return CACHE['pol_print']
    g = g27_fixed()
    W, H = g.size
    yb0, yb1 = int(0.385 * H), int(0.835 * H)
    band = g.crop((int(0.28 * W), yb0, int(0.34 * W), yb1))
    right = g.crop((int(0.585 * W), yb0, int(0.825 * W), yb1))
    side = yb1 - yb0
    face = Image.new('RGB', (band.width + right.width, side))
    face.paste(band, (0, 0)); face.paste(right, (band.width, 0))
    # 30 px gradient seam + σ4 blur on the seam
    fa = A(face); sx = band.width
    seam = np.zeros(fa.shape[:2], np.float32); seam[:, max(0, sx - 15):sx + 15] = 1
    seam = ndi.gaussian_filter(seam, 4)
    fa = fa * (1 - seam[..., None]) + gblur(fa, 4) * seam[..., None]
    face = I(fa).resize((side, side), Image.LANCZOS)
    face = face.resize((640, 640), Image.LANCZOS)
    face = instant_grade(face)
    # chemistry streak along the bottom edge
    fa = A(face); fa[-18:, :, :] = fa[-18:, :, :] * 0.85 + np.array([20, 18, 6.0])
    face = I(fa)
    # card 88:107 with border (238,235,226)
    cw = 760; chh = int(cw * 107 / 88)
    card = Image.new('RGB', (cw, chh), (238, 235, 226))
    card = grain(card, 3, seed=55)
    card.paste(face, ((cw - 640) // 2, 60))
    back = grain(Image.new('RGB', (cw, chh), (226, 224, 216)), 4, seed=56)
    bk = A(back); bk *= (0.97 + 0.03 * noise_field(bk.shape[:2], 1.0, 57))[..., None]; back = I(bk)
    CACHE['pol_print'] = (card, back)
    return card, back


def polaroid_601(g):
    card, back = polaroid_print()
    # base: dark corrugated cardboard (bottom of the box, phone lifted), 1024x1536, procedural
    yy, xx = np.mgrid[0:1536, 0:1024].astype(np.float32)
    corr = 0.035 * np.sin(xx / 1024 * 2 * np.pi * 26 + 0.4 * noise_field((1536, 1024), 30, 81) * 6)
    fib = 0.06 * (noise_field((1536, 1024), 1.0, 82) - 0.5) + 0.05 * (noise_field((1536, 1024), 9, 83) - 0.5)
    k = 1 + corr + fib
    base = I(np.dstack([150 * k, 116 * k, 80 * k]))
    base = grade(base, bright=0.62, sat=0.9)
    base = vignette(base, 0.45)
    for key, cardimg in (('polaroid_601', card), ('polaroid_601_back', back)):
        im = base.copy()
        q = [(150, 300), (880, 270), (905, 1158), (172, 1186)]
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).polygon([(x + 14, y + 18) for x, y in q], fill=(0, 0, 0, 120))
        im = im.convert('RGBA'); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14))); im = im.convert('RGB')
        im = warp_into(im, cardimg, q)
        # flashlight falloff from upper left
        yy, xx = np.mgrid[0:1536, 0:1024].astype(np.float32)
        fall = 0.55 + 0.5 * np.exp(-(((xx - 380) ** 2) + ((yy - 520) ** 2)) / (2 * 520 ** 2))
        im = I(A(im) * fall[..., None])
        im = grain(im, 4, seed=58)
        jpg(im, key)


# ================================================================ dash items: old_room / inn_key / rec_voicetalk / contract_cap
@step
def dash():
    o = S('g_old_room')
    small = o.resize((640, 960), Image.LANCZOS)
    b = io.BytesIO(); small.save(b, 'JPEG', quality=60); b.seek(0)
    old = Image.open(b).convert('RGB').resize((1024, 1536), Image.BICUBIC)
    jpg(old, 'old_room')
    a = A(old); H = a.shape[0]
    ramp = np.ones(H, np.float32); n30 = int(H * 0.30)
    ramp[:n30] = 0.55 + 0.45 * (np.arange(n30) / n30) ** 1.5
    jpg(I(a * ramp[:, None, None]), 'old_room_lock')
    # inn key: stamped '404' filled with white paint, worn
    k = S('g_inn_key'); W, H = k.size
    kb = M('key_blank')
    cw, ch = 600, 260
    lay = Image.new('L', (cw, ch), 0)
    ImageDraw.Draw(lay).text((cw / 2, ch / 2), '404', font=font(FONT_BOLD, 190), fill=255, anchor='mm')
    fa = A(lay) / 255.0
    wear = noise_field(fa.shape, 1.2, 61) * 0.6 + noise_field(fa.shape, 8, 62) * 0.4
    fill = fa * np.clip((wear - 0.18) / 0.25, 0, 1) * 0.85
    cx, cy = kb['cx'] * W, kb['cy'] * H
    hw, hh = kb['w'] * W / 2, kb['h'] * H / 2
    ang = math.radians(kb['angle'])
    def rot(x, y):
        return (cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang))
    quad = [rot(-hw, -hh), rot(hw, -hh), rot(hw, hh), rot(-hw, hh)]
    sh = hand.warp_alpha(ndi.shift(fa, (3, 3)) - fa * 0.0, k.size, quad)
    inner = hand.warp_alpha(fa, k.size, quad)
    fw = hand.warp_alpha(fill, k.size, quad)
    a = A(k)
    a = a * (1 - (np.clip(inner - fw, 0, 1) * 0.35)[..., None])          # debossed groove, darker where paint is gone
    a = a * (1 - (np.clip(sh - inner, 0, 1) * 0.5)[..., None])           # 1 px inner shadow
    paint = np.array([226, 222, 212.0])
    a = a * (1 - fw[..., None]) + paint * fw[..., None] * (0.85 + 0.15 * lum(a)[..., None] / 255)
    jpg(I(a), 'inn_key')
    QA['inn_key'] = "only '404' composited; scraped patch left as generated (no letters)"
    # rec_voicetalk — incoming 보이스톡 screen recording (ep1 talk call screen grammar), no end-state text
    rec_voicetalk()
    contract_cap()


def status_bar(d, W, color=(255, 255, 255), text='SIM 없음'):
    f = font(FONT_BOLD, 34)
    d.text((60, 44), text, font=f, fill=color)
    # battery + wifi glyphs (drawn, no brand)
    x = W - 150
    d.rounded_rectangle([x, 48, x + 62, 78], 6, outline=color, width=3)
    d.rectangle([x + 64, 56, x + 69, 70], fill=color)
    d.rectangle([x + 6, 54, x + 40, 72], fill=color)


def rec_voicetalk():
    W, H = 1080, 2340
    av = Image.open(os.path.join(EP1, 'avatar_sea.jpg')).convert('RGB')
    bg = av.resize((W, W), Image.LANCZOS).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(60))
    bg = grade(bg, bright=0.45, sat=1.2)
    bg = I(A(bg) * 0.75 + np.array([31, 34, 38.0]) * 0.25)
    d = ImageDraw.Draw(bg)
    status_bar(d, W, text='')
    # recording dot (system screen-recorder indicator)
    d.ellipse([W // 2 - 14, 52, W // 2 + 14, 80], fill=(255, 59, 48))
    pill = font(FONT_SANS, 39)
    tw = d.textlength('보이스톡', font=pill)
    bgA = bg.convert('RGBA'); ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); dd = ImageDraw.Draw(ov)
    dd.rounded_rectangle([W / 2 - tw / 2 - 36, 330, W / 2 + tw / 2 + 36, 330 + 78], 39, fill=(255, 255, 255, 31))
    bgA.alpha_composite(ov); bg = bgA.convert('RGB'); d = ImageDraw.Draw(bg)
    d.text((W / 2, 369), '보이스톡', font=pill, fill=(205, 205, 208), anchor='mm')
    s = 336
    # circular avatar (ep1 .call-avatar border-radius 50 %, §8.3-8 원형): centre-square crop, exact D x D ellipse, 4x AA
    sq_ = min(av.size); avc = av.crop(((av.width - sq_) // 2, (av.height - sq_) // 2, (av.width - sq_) // 2 + sq_, (av.height - sq_) // 2 + sq_))
    avs = avc.resize((s, s), Image.LANCZOS)
    m = Image.new('L', (s * 4, s * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    m = m.resize((s, s), Image.LANCZOS)
    sh = Image.new('RGBA', bg.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([W / 2 - s / 2, 520 + 30, W / 2 + s / 2, 520 + s + 30], fill=(0, 0, 0, 115))
    bgA = bg.convert('RGBA'); bgA.alpha_composite(sh.filter(ImageFilter.GaussianBlur(40))); bg = bgA.convert('RGB')
    bg.paste(avs, (W // 2 - s // 2, 520), m)
    d = ImageDraw.Draw(bg)
    d.text((W / 2, 520 + s + 110), '윤세아', font=font(FONT_BOLD, 90), fill=(255, 255, 255), anchor='mm')
    d.text((W / 2, 520 + s + 205), '보이스톡 수신 중…', font=font(FONT_SANS, 45), fill=(255, 255, 255, 190), anchor='mm')
    # buttons: 거절 (red) · 수락 (green) — ep1 .tvc grammar
    for cx, col, lab_ in ((W * 0.27, (255, 59, 48), '거절'), (W * 0.73, (52, 199, 89), '수락')):
        r = 105
        d.ellipse([cx - r, 1900 - r, cx + r, 1900 + r], fill=col)
        d.text((cx, 1900 + r + 55), lab_, font=font(FONT_SANS, 39), fill=(230, 230, 230), anchor='mm')
    # handset glyphs
    d.arc([W * 0.73 - 46, 1900 - 46, W * 0.73 + 46, 1900 + 46], 200, 340, fill=(255, 255, 255), width=22)
    d.rounded_rectangle([W * 0.27 - 60, 1900 - 10, W * 0.27 + 60, 1900 + 20], 14, fill=(255, 255, 255))
    jpg(bg, 'rec_voicetalk', q=84)
    QA['rec_voicetalk'] = 'ringing state only: 보이스톡 · 윤세아 · 보이스톡 수신 중… · 거절/수락 — no 거절함/통화 종료'


def blur_bar(d, x, y, w, h):
    d.rounded_rectangle([x, y, x + w, y + h], h // 2, fill=(205, 207, 212))


def contract_cap():
    W, H = 1080, 2340
    im = Image.new('RGB', (W, H), (246, 247, 249))
    d = ImageDraw.Draw(im)
    status_bar(d, W, color=(20, 20, 24))
    d.text((60, 170), '전자계약서', font=font(FONT_BOLD, 64), fill=(20, 20, 24))
    d.line([(60, 270), (W - 60, 270)], fill=(220, 222, 226), width=3)
    y = 330
    def row(label, value=None, bars=None):
        nonlocal y
        d.text((60, y), label, font=font(FONT_SANS, 38), fill=(110, 112, 118))
        if value: d.text((330, y), value, font=font(FONT_SANS, 40), fill=(24, 24, 28))
        if bars:
            bx = 330
            for bw in bars:
                blur_bar(d, bx, y + 4, bw, 40); bx += bw + 18
        y += 104
    d.text((60, y), '부동산 임대차 계약', font=font(FONT_BOLD, 44), fill=(24, 24, 28)); y += 110
    d.text((60, y), '소재지', font=font(FONT_SANS, 38), fill=(110, 112, 118))
    d.text((330, y), '서울특별시 은평구 새말동 ██-█', font=font(FONT_SANS, 40), fill=(24, 24, 28)); y += 60
    d.text((330, y), '새말빌라 601호', font=font(FONT_SANS, 40), fill=(24, 24, 28)); y += 104
    row('계약일', '2026.12.03')
    row('임대인', bars=[220, 140])
    row('임차인', bars=[180, 120])
    row('보증금', bars=[300])
    row('월 차임', bars=[240])
    row('계약 기간', bars=[420])
    d.line([(60, y + 10), (W - 60, y + 10)], fill=(220, 222, 226), width=3); y += 70
    d.text((60, y), '서명', font=font(FONT_BOLD, 44), fill=(24, 24, 28)); y += 90
    for _ in range(2):
        d.rounded_rectangle([60, y, W - 60, y + 190], 24, outline=(222, 224, 228), width=3)
        blur_bar(d, 110, y + 40, 260, 40)
        blur_bar(d, 110, y + 110, 520, 34)
        y += 230
    im = im.filter(ImageFilter.GaussianBlur(0.3))
    a = A(im); bars = (np.abs(a - np.array([205, 207, 212.0])).sum(-1) < 6)
    bl = gblur(a, 6)
    a = np.where(bars[..., None], bl, a)
    jpg(I(a), 'contract_cap', q=86)
    QA['contract_cap'] = 'names/amounts/signatures as blur bars only; no service name or logo'


# ================================================================ ENDING (G31 G33 G34) + {N} posts (G36–38)
@step
def ending():
    # ---- pol_case: polaroid back (repaint the generated front window plain), 어서 와. —, ruler cm, tent 1
    p = S('g_pol_case'); W, H = p.size
    a = A(p)
    win = q_px(M('pc_window'), W, H); outer = q_px(M('pc_polaroid'), W, H)
    # the back of a print is one flat paper (review pol_case_back): no inset window, no thick bottom margin — the whole
    # face = a plane fitted to the generated border (keeps the flash falloff) + fine paper grain; edge + shadow kept
    om0 = poly_mask(p.size, outer, 0) > 0.5
    face = ndi.binary_erosion(om0, iterations=4)
    wm = ndi.binary_dilation(poly_mask(p.size, win, 0) > 0.5, iterations=8)
    ring = face & ~wm
    ys, xs = np.nonzero(ring)
    Bm = np.stack([np.ones(len(xs)), xs / W, ys / H], -1)
    coef = np.linalg.lstsq(Bm, a[ys, xs], rcond=None)[0]
    YY, XX = np.mgrid[0:H, 0:W]
    plane = (np.stack([np.ones(H * W), XX.ravel() / W, YY.ravel() / H], -1) @ coef).reshape(H, W, 3)
    paper_ = plane * (0.988 + 0.024 * noise_field((H, W), 0.7, 71))[..., None] * (0.995 + 0.01 * noise_field((H, W), 6, 72))[..., None]
    fs_ = ndi.gaussian_filter(face.astype(np.float32), 1.0)
    a = a * (1 - fs_[..., None]) + paper_ * fs_[..., None]
    im = I(a)
    # handwriting on the back: 어서 와. — (his hand, ep1 R5 box polaroid)
    ow = math.hypot(outer[1][0] - outer[0][0], outer[1][1] - outer[0][1])
    oh = math.hypot(outer[3][0] - outer[0][0], outer[3][1] - outer[0][1])
    cw = 880; ch = int(cw * oh / ow)
    im, _ = hand.write_quad(im, '어서 와. —', outer, (cw, ch), (int(cw * 0.14), int(ch * 0.36)), int(cw * 0.17),
                            color=hand.INK_HIM, angle=-4, alpha=235, blur=0.6, seed=13)
    # tent number 1
    tq = q_px(M('pc_tent'), W, H)
    lay = Image.new('L', (300, 300), 0); ImageDraw.Draw(lay).text((150, 160), '1', font=font(FONT_BOLD, 200), fill=255, anchor='mm')
    im = hand.ink(im, hand.warp_alpha(A(lay) / 255, im.size, tq) * 0.92, (15, 15, 15), mode='normal')
    # ruler numbers on the long arm (white on the black band): 0 1 2 3 4 5 cm, right to left from the corner
    r = M('pc_ruler_h')
    d = ImageDraw.Draw(im)
    f = font(FONT_SANS, 16)
    for i, t in enumerate(['0', '1', '2', '3', '4', '5']):
        tt = i / 5 * 0.82
        x = r['x1'] * W + (r['x0'] - r['x1']) * W * tt - 0
        y = r['y1'] * H + (r['y0'] - r['y1']) * H * tt - 12
        d.text((x - 10, y - 24), t, font=f, fill=(225, 225, 225), anchor='mm')
    d.text((r['x0'] * W + 60, r['y0'] * H - 36), 'cm', font=f, fill=(225, 225, 225), anchor='mm')
    jpg(im, 'pol_case')
    QA['pol_case'] = 'generated polaroid showed its front (inset window, thick bottom margin) -> whole face repainted as one flat back (plane-fit flash falloff + grain) before writing 어서 와. —'

    # ---- pol_tally: 14 tally marks drawn (4+1, 4+1, 4) + n_room photos as inkjet prints (after room/n_room)
    pt = S('g_pol_tally'); W, H = pt.size
    im = tally(pt, M('pt_tally'))
    prints = [os.path.join(OUT, f'n_room_{i}.jpg') for i in (1, 2, 3)]
    for qd, pth in zip(M('pt_photos'), prints):
        q = q_px(qd, W, H)
        # inset to the photo area inside the white print border
        cx = sum(x for x, _ in q) / 4; cy = sum(y for _, y in q) / 4
        qi = [(cx + (x - cx) * 0.86, cy + (y - cy) * 0.86) for x, y in q]
        if os.path.exists(pth):
            ph = Image.open(pth).convert('RGB')
            s = min(ph.size); ph = ph.crop(((ph.width - s) // 2, (ph.height - s) // 2, (ph.width + s) // 2, (ph.height + s) // 2)).resize((400, 400), Image.LANCZOS)
            ph = ImageEnhance.Color(ph).enhance(0.7)
            pa = A(ph); pa += (np.sin(np.arange(400) / 2.2)[:, None, None] * 3); ph = I(pa).filter(ImageFilter.GaussianBlur(1.5))
            ph = grade(ph, bright=0.78, contrast=0.9)
            im = warp_into(im, ph, qi)
        else:
            MISSING.append('pol_tally print ' + os.path.basename(pth))
    rr = M('pt_ruler'); d = ImageDraw.Draw(im); f = font(FONT_SANS, 11)
    for i in range(6):
        x = (rr['x0'] + (rr['x1'] - rr['x0']) * i / 5) * W
        d.text((x, rr['y'] * H + 10), str(i), font=f, fill=(40, 40, 40), anchor='mm')
    im = grain(im, 3, seed=81)
    jpg(im, 'pol_tally')
    QA['pol_tally'] = 'tally strokes = 14 (two 4+1 groups + 4 verticals), no 正'

    # ---- pol_sticker: 한결 starting right at the tear
    ps = S('g_pol_sticker'); W, H = ps.size
    t = M('ps_text')
    size = int(t['h'] * H / 0.80)
    lay = Image.new('L', ps.size, 0)
    ImageDraw.Draw(lay).text((t['x'] * W, t['y'] * H), '한결', font=font(FONT_BOLD, size), fill=255, anchor='lm')
    al = A(lay) / 255
    dots = (noise_field((H, W), 0.6, 91) > 0.35).astype(np.float32)
    al = ndi.gaussian_filter(al, 0.9) * (0.78 + 0.22 * dots)
    dust = 0.86 + 0.14 * noise_field((H, W), 2, 92)
    tear = np.clip((np.arange(W)[None, :] / W - 0.478) / 0.012, 0, 1)      # nothing printed left of the tear
    im = hand.ink(ps, al * dust * tear * 0.92, (28, 40, 90), mode='normal')
    sr = M('ps_ruler'); d = ImageDraw.Draw(im); f = font(FONT_SANS, 15)
    for i in range(6):
        d.text(((sr['hx0'] + sr['pitch'] * i) * W, sr['hy'] * H), str(i), font=f, fill=(40, 40, 40), anchor='mm')
    d.text(((sr['hx0'] + sr['pitch'] * 5.6) * W, sr['hy'] * H), 'cm', font=f, fill=(40, 40, 40), anchor='mm')
    jpg(im, 'pol_sticker')
    QA['pol_sticker'] = "only '한결' printed (navy 28,40,90), starting at the torn edge; no logo/phone/trade"


def tally(im, box):
    """14 marker strokes: [||||/] [||||/] [||||], width 7–9 px, pressure + bleed, multiplied into the concrete."""
    W, H = im.size
    rng = np.random.default_rng(14)
    lay = Image.new('L', (W, H), 0); d = ImageDraw.Draw(lay)
    x0, y0 = box['x'] * W, box['y'] * H
    gh = box['h'] * H
    gap = gh * 0.16
    strokes = 0
    x = x0
    for g in range(3):
        xs = []
        for k in range(4):
            sx = x + rng.normal(0, 1.5); top = y0 + rng.normal(0, 3); bot = y0 + gh + rng.normal(0, 4)
            wpx = rng.uniform(7, 9)
            seg = 12
            for s in range(seg):
                t0, t1 = s / seg, (s + 1) / seg
                ww = wpx * (0.85 + 0.25 * math.sin(math.pi * (t0 + 0.1)))
                d.line([(sx + 2.0 * t0 + rng.normal(0, 0.3), top + (bot - top) * t0), (sx + 2.0 * t1, top + (bot - top) * t1)], fill=int(235 - 30 * t0), width=int(round(ww)))
            xs.append(sx); x += gap; strokes += 1
        if g < 2:
            # the fifth: diagonal across the four
            dx0, dx1 = xs[0] - gap * 0.35, xs[-1] + gap * 0.35
            d.line([(dx0, y0 + gh * 0.78), (dx1, y0 + gh * 0.22)], fill=225, width=8)
            strokes += 1
        x += gap * 1.6
    assert strokes == 14, strokes
    al = A(lay.filter(ImageFilter.GaussianBlur(1.1))) / 255
    al = np.clip(al * (0.85 + 0.3 * noise_field((H, W), 0.8, 15)), 0, 1)
    l = lum(A(im))
    grain_ = np.clip(0.85 + (l - ndi.gaussian_filter(l, 3)) / 50, 0.6, 1.0)
    return hand.ink(im, al * grain_, (12, 12, 14), mode='normal')


@step
def posts():
    s = S('g_n_post_sunset')
    s = grade(s, r=1.03, g=1.0, b=0.96, sat=1.08)
    jpg(s.resize((1024, 1024), Image.LANCZOS), 'n_post_1')
    k = S('g_n_post_sky'); W, H = k.size
    sq = k.crop((0, H - W - 120, W, H - 120))
    jpg(sq, 'n_post_2')
    # n_wall 9:19.5 portrait, clock zone (top 30 %) −15 %
    cw = int(H * 9 / 19.5)
    x0 = (W - cw) // 2
    wl = k.crop((x0, 0, x0 + cw, H)).resize((720, 1560), Image.LANCZOS)
    a = A(wl); n30 = int(1560 * 0.32)
    ramp = np.ones(1560, np.float32); ramp[:n30] = 0.85 + 0.15 * (np.arange(n30) / n30)
    jpg(I(a * ramp[:, None, None]), 'n_wall')
    r = S('g_n_post_rain')
    jpg(r.resize((1024, 1024), Image.LANCZOS), 'n_post_3')


# ================================================================ more measurements (pass 2+ sources)
MEAS.update({
    # G05 roof_tank (telephoto 1024x1536)
    'tank_door': {'x': 0.235, 'y': 0.110, 'w': 0.533, 'h': 0.822},
    'stencil_tank': [[0.360, 0.258], [0.646, 0.258], [0.646, 0.393], [0.360, 0.392]],
    'gap_tank': [[0.768, 0.115], [0.791, 0.115], [0.791, 0.930], [0.768, 0.930]],
    # G01 plate (1536x1024): the same door, its blank rectangle and gap
    'plate_door': {'x': 0.207, 'y': 0.245, 'w': 0.145, 'h': 0.490},
    'stencil_plate': [[0.243, 0.331], [0.315, 0.333], [0.315, 0.415], [0.243, 0.414]],
    'gap_plate': [[0.346, 0.255], [0.353, 0.255], [0.353, 0.733], [0.346, 0.733]],
    # G28 move_day: blank rectangle on the ajar door, door leaf
    'stencil_move': [[0.2914, 0.3467], [0.3526, 0.3406], [0.3526, 0.4238], [0.2914, 0.4250]],   # G28 re-run (high)
    'move_door': {'x': 0.262, 'y': 0.250, 'w': 0.136, 'h': 0.500},
    # G10 roof_rail: empty-flat window (darkened: the model lit it faintly) and the speaker on its sill
    'rail_win': [[0.592, 0.603], [0.708, 0.640], [0.708, 0.990], [0.592, 0.990]],
    'led_rail': {'x': 0.675, 'y': 0.940},
    # G15 r2_door_box: box top face (for the 4 px '601호' texture)
    'door_box_top': [[0.172, 0.523], [0.330, 0.523], [0.333, 0.537], [0.170, 0.537]],
    # G19 p2_door_open: top of the box outside; the sky seen through the gap / above the door; the parapet face below it
    'p2_box_top': [[0.468, 0.672], [0.578, 0.672], [0.582, 0.690], [0.466, 0.690]],
    'p2_sky': [[0.470, 0.206], [0.665, 0.206], [0.665, 0.228], [0.640, 0.243], [0.636, 0.257], [0.580, 0.268],
               [0.5785, 0.487], [0.470, 0.487]],
    'p2_wall': [[0.470, 0.487], [0.577, 0.487], [0.577, 0.582], [0.470, 0.582]],
    # G25 doorlock_in: status light, lever (neck + arm) and pivot
    'led_lock_cu': {'x': 0.428, 'y': 0.418},
    'lever_poly': [[0.378, 0.742], [0.470, 0.735], [0.905, 0.752], [0.918, 0.762], [0.918, 0.815], [0.905, 0.823],
                   [0.470, 0.826], [0.378, 0.822]],
    'handle_pivot': {'x': 0.428, 'y': 0.780},
    # G14 r2_door: the small lever (for door_handle_r2)
    'lever_r2': [[0.552, 0.503], [0.581, 0.503], [0.581, 0.519], [0.552, 0.519]],   # arm only (the body edge is .551)
    'pivot_r2': {'x': 0.540, 'y': 0.511},
    # G01 plate: bolt + S-hook (+ its shadow) of the tank door, replaced by the mapped telephoto latch (padlock)
    'latch_plate': [0.318, 0.497, 0.366, 0.575],
})


def door_map(src_rect, src_size, dst_rect, dst_size):
    """AFFINE coefficients for Image.transform(dst_size) that samples src so src_rect lands on dst_rect."""
    sx0, sy0 = src_rect['x'] * src_size[0], src_rect['y'] * src_size[1]
    sw, sh = src_rect['w'] * src_size[0], src_rect['h'] * src_size[1]
    dx0, dy0 = dst_rect['x'] * dst_size[0], dst_rect['y'] * dst_size[1]
    dw, dh = dst_rect['w'] * dst_size[0], dst_rect['h'] * dst_size[1]
    a = sw / dw; e = sh / dh
    return (a, 0, sx0 - dx0 * a, 0, e, sy0 - dy0 * e)


def remap(im, src_rect, dst_rect, dst_size, blur=0):
    out = im.transform(dst_size, Image.AFFINE, door_map(src_rect, im.size, dst_rect, dst_size), Image.BICUBIC)
    if blur: out = out.filter(ImageFilter.GaussianBlur(blur))
    return out


def remap_arr(a, src_rect, src_size, dst_rect, dst_size):
    im = Image.fromarray(a.astype(np.float32), 'F')
    return A(im.transform(dst_size, Image.AFFINE, door_map(src_rect, src_size, dst_rect, dst_size), Image.BILINEAR))


def chan_affine(src, ref, amt=0.6):
    """per-channel mean/std transform src->ref (returned as a function so sibling states get the same one)."""
    s, r = A(src), A(ref)
    k = [(s[..., c].mean(), s[..., c].std() + 1e-6, r[..., c].mean(), r[..., c].std() + 1e-6) for c in range(3)]
    def f(im):
        a = A(im); o = a.copy()
        for c, (ms, ss, mr, sr) in enumerate(k):
            o[..., c] = (a[..., c] - ms) / ss * sr + mr
        return I(a * (1 - amt) + o * amt)
    return f


def dark_grade(a, R=None, seed=12, noise=6):
    """§8.3-3 dark transition: × R, blue −4 %, noise σ6 (no bloom: the lamp is off)."""
    a = A(a) if isinstance(a, Image.Image) else a
    if R is not None: a = a * R[..., None]
    a[..., 2] *= 0.96
    return vignette(grain(I(a), noise, seed=seed), 0.25)


def denoise(a, s=1.6):
    """edge-aware smoothing stand-in for NL-means (scipy has none): blend gaussian by local gradient."""
    a = A(a) if isinstance(a, Image.Image) else a
    l = lum(a); g = np.hypot(ndi.sobel(l, 0), ndi.sobel(l, 1))
    w = np.clip(1 - g / 60, 0, 1)[..., None]
    return a * (1 - w) + gblur(a, s) * w


# ================================================================ ROOM patches + close-ups from pass 2
@step
def room2():
    d0 = S('g_r2_door'); W, H = d0.size
    # ---- p_door_box: the box on the shoe cabinet (diff G15−G14), '601호' as a 4 px texture on its top
    if has('g_r2_door_box'):
        d1 = S('g_r2_door_box')
        diff = np.abs(A(d1) - A(d0)).sum(-1) > 36
        diff[: int(H * 0.45)] = False                       # only around the cabinet top
        diff = ndi.binary_opening(diff, iterations=2)
        lab, n = ndi.label(diff); i = np.argmax(ndi.sum(diff, lab, range(1, n + 1))) + 1
        ys, xs = np.nonzero(lab == i)
        x0, y0, x1, y1 = xs.min() - 20, ys.min() - 20, xs.max() + 20, ys.max() + 20
        m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1
        m = ndi.gaussian_filter(m, 4)
        q = q_px(M('door_box_top'), W, H)
        dd, _ = hand.write_quad(d1, '601호', q, (400, 36), (120, 6), 22, angle=-2, seed=7, opacity=0.8)
        png(rgba_patch(dd, m), 'p_door_box')
        META['door_box_rect'] = {'x': round(x0 / W, 4), 'y': round(y0 / H, 4), 'w': round((x1 - x0) / W, 4), 'h': round((y1 - y0) / H, 4)}
    # ---- door_handle_r2: the small lever on the room view pushed down −24° (B14 frame on r2_door)
    lever_patch(d0, M('lever_r2'), M('pivot_r2'), 'door_handle_r2', inpaint_pad=3, shadow_drop=0.002, dark=80, grain_k=1.0,
                fill_median=True, feather=3.0)
    # ---- doorlock_in + door_handle (close-up frame) + n_lock_new (0310 #6, warm, inner panel only)
    if has('g_doorlock_in'):
        dl = S('g_doorlock_in'); Wd, Hd = dl.size
        jpg(dl, 'doorlock_in')
        lever_patch(dl, M('lever_poly'), M('handle_pivot'), 'door_handle', inpaint_pad=12, shadow_drop=0.014, dark=70)
        META['led_lock_cu'] = M('led_lock_cu'); META['handle_pivot'] = M('handle_pivot')
        nl = dl.crop((0, int(Hd * 0.03), Wd, int(Hd * 0.03) + 1365))
        nl = phone_grade(grade(nl, bright=1.05), ev_=0.2, k=1.2, barrel=0.02)
        jpg(nl, 'n_lock_new')
    # ---- newphone: screen quad (darkest big blob)
    if has('g_newphone'):
        npi = S('g_newphone'); Wn, Hn = npi.size
        l = lum(A(npi))
        blob = ndi.binary_opening(l < 40, iterations=3)
        lab, n = ndi.label(blob); i = np.argmax(ndi.sum(blob, lab, range(1, n + 1))) + 1
        META['np_cu_q'] = q_frac(quad_extremes(ndi.binary_fill_holes(lab == i)), Wn, Hn)
        jpg(npi, 'newphone')
    # ---- landlord_note
    if has('g_landlord_note'):
        landlord_note(S('g_landlord_note'))
    # ---- p2_door_open: '601호' 4 px texture on the box top
    if has('g_p2_door_open'):
        p2 = S('g_p2_door_open'); Wp, Hp = p2.size
        # the sky through the gap (review p2_door_open_sky): a starfield of baked flakes -> the plate's overcast orange
        # city-glow gradient; flakes on the parapet inpainted too (the DOM particles bring the snow)
        a = A(p2)
        sky = poly_mask((Wp, Hp), q_px(M('p2_sky'), Wp, Hp), 0.8)
        yy_ = np.mgrid[0:Hp, 0:Wp][0].astype(np.float32)
        t_ = np.clip((yy_ / Hp - 0.21) / 0.28, 0, 1)[..., None]
        grad = np.array([36, 28, 28.0]) * (1 - t_) + np.array([55, 38, 32.0]) * t_    # glow brightest at the skyline
        grad = grad * (0.97 + 0.06 * noise_field((Hp, Wp), 18, 401))[..., None] + np.random.default_rng(402).normal(0, 1.4, (Hp, Wp, 1))
        a = a * (1 - sky[..., None]) + grad * sky[..., None]
        wall = poly_mask((Wp, Hp), q_px(M('p2_wall'), Wp, Hp), 0) > 0.5
        lw = lum(a)
        flakes = wall & (lw - ndi.median_filter(lw, 9) > 22)
        flakes = ndi.binary_dilation(flakes, iterations=1)
        med = np.dstack([ndi.median_filter(a[..., c], 9) for c in range(3)])
        a = np.where(flakes[..., None], med, a)
        p2 = I(a)
        QA['p2_door_open'] = f'sky through the gap = plate glow gradient (no baked flakes); {int(flakes.sum())} px of flakes inpainted on the parapet'
        q = q_px(M('p2_box_top'), Wp, Hp)
        p2, _ = hand.write_quad(p2, '601호', q, (400, 60), (140, 10), 30, angle=-2, seed=7, opacity=0.55)
        jpg(p2, 'p2_door_open')
    # ---- p_win_refl: night reflection of the desk wall in the glass (after the room light is on, opacity .12)
    k = ImageOps.mirror(S('g_r2_desk')).filter(ImageFilter.GaussianBlur(3))
    k = ImageEnhance.Brightness(k).enhance(0.5)
    if 'glass_panes' in META:
        Ww, Hw = 1024, 1536
        lay = Image.new('RGBA', (Ww, Hw), (0, 0, 0, 0))
        for pq in META['glass_panes']:
            q = q_px(pq, Ww, Hw)
            xs = [p[0] for p in q]; ys = [p[1] for p in q]
            # each pane shows the matching part of the opposite wall
            src = k.crop((int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))))
            w = src.size
            coeffs = find_coeffs(q, [(0, 0), (w[0], 0), (w[0], w[1]), (0, w[1])])
            lay.alpha_composite(src.convert('RGBA').transform((Ww, Hw), Image.PERSPECTIVE, coeffs, Image.BICUBIC))
        png(lay, 'p_win_refl')
    # ---- kongi_santa: the warm tone of ep1 kongi_old
    if has('g_kongi_santa'):
        ks = S('g_kongi_santa')
        ref = Image.open(os.path.join(EP1, 'kongi_old.jpg')).convert('RGB')
        ks = mean_std_match(ks, ref, 0.35)
        jpg(ks, 'kongi_santa')


def lever_patch(src, poly_frac, pivot, key, inpaint_pad=10, angle=-24, shadow_drop=0.012, dark=70, grain_k=1.6,
                fill_median=False, feather=None):
    """full-canvas PNG: the black lever pushed down by `angle` about its pivot, its old place (and cast shadow) painted over."""
    W, H = src.size
    a = A(src); l = lum(a)
    mp = poly_mask(src.size, q_px(poly_frac, W, H), 0) > 0.5
    m = mp & (l < dark)                                   # the lever only — the polygon is generous
    m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=2))
    m = ndi.binary_opening(m, iterations=1)
    mg = ndi.binary_dilation(m, iterations=inpaint_pad)
    sd = max(1, int(H * shadow_drop))
    mg = mg | ndi.shift(mg.astype(np.uint8), (sd, sd // 3), order=0).astype(bool)   # + its soft shadow below
    # cover the lever's ambient-occlusion halo too, then fill: door paint = smooth quadratic fit of the ring around,
    # black lock body / rose (dark above and below) = vertical interpolation
    mg = ndi.binary_dilation(mg, iterations=max(2, inpaint_pad // 2))
    ring = ndi.binary_dilation(mg, iterations=max(6, inpaint_pad)) & ~mg & (l > dark + 15)
    ry, rx = np.nonzero(ring)
    def basis(x, y):
        x = x / W; y = y / H
        return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)
    coef = np.linalg.lstsq(basis(rx.astype(float), ry.astype(float)), a[ry, rx], rcond=None)[0]
    yy, xx = np.nonzero(mg)
    fit = basis(xx.astype(float), yy.astype(float)) @ coef
    fill = a.copy()
    fill[yy, xx] = fit
    if fill_median:
        # small patch (room view): membrane (Laplace) fill from the hole's own border, so the door's soft shading and
        # the lever's old ambient shadow fade in from outside instead of a flat disc
        y0b, y1b, x0b, x1b = max(0, yy.min() - 3), min(H, yy.max() + 4), max(0, xx.min() - 3), min(W, xx.max() + 4)
        sub = a[y0b:y1b, x0b:x1b].copy(); hole = mg[y0b:y1b, x0b:x1b]
        u = sub.copy(); u[hole] = sub[~hole].mean(0)
        for _ in range(900):
            nb = (np.roll(u, 1, 0) + np.roll(u, -1, 0) + np.roll(u, 1, 1) + np.roll(u, -1, 1)) / 4
            u[hole] = nb[hole]
        fill[y0b:y1b, x0b:x1b][hole] = u[hole]
    vert = a.copy()
    for x in range(xx.min(), xx.max() + 1):
        col = np.nonzero(mg[:, x])[0]
        if not len(col): continue
        y0, y1 = max(4, col.min() - 3), min(H - 6, col.max() + 3)
        top = np.median(a[y0 - 4:y0 + 1, x], 0); bot = np.median(a[y1:y1 + 5, x], 0)
        t = np.linspace(0, 1, y1 - y0 + 1)[:, None]
        vert[y0:y1 + 1, x] = top * (1 - t) + bot * t
    darkbody = ndi.gaussian_filter((lum(vert) < dark + 10).astype(np.float32), 2)[..., None]
    fill = fill * (1 - darkbody) + vert * darkbody
    door_px = ring
    hp = l - ndi.gaussian_filter(l, 2)
    sig = 1.4826 * np.median(np.abs(hp[door_px] - np.median(hp[door_px]))) if door_px.any() else 1.0
    fill = fill + ndi.gaussian_filter(np.random.default_rng(3).normal(0, 1, fill.shape[:2]), 0.6)[..., None] * sig * grain_k
    soft = np.clip(ndi.gaussian_filter(mg.astype(np.float32), feather or max(1.5, inpaint_pad / 3)) * 1.6, 0, 1)
    lay = I(np.dstack([fill, soft * 255]), 'RGBA')
    px, py = pivot['x'] * W, pivot['y'] * H
    lev = I(np.dstack([a, ndi.gaussian_filter(m.astype(np.float32), 0.6) * 255]), 'RGBA').rotate(angle, Image.BICUBIC, center=(px, py))
    sa = A(lev)[..., 3] / 255
    sa = ndi.shift(ndi.gaussian_filter(sa, max(1.0, W / 170)), (sd * 1.2, sd * 0.6))
    shadow = I(np.dstack([np.zeros((H, W, 3)), np.clip(sa, 0, 1) * 0.35 * 255]), 'RGBA')
    lay.alpha_composite(shadow); lay.alpha_composite(lev)
    png(lay, key)


LANDLORD_LINES = ['601호에게', '24일부터 27일까지 아들네 다녀와요.', '4층은 여행 가고 3층은 아직 비어 있어요.',
                  '1층 2층 가게도 연휴엔 문 닫는대요.', '옆 건물 2층이 몇 달째 비어 있는데', '밤에 소리 나거나 불빛 보이면 112에 신고하래요.',
                  '수도 얼지 않게 조금씩 틀어 두세요.']
LANDLORD_SIG = '— 5층 주인  12.18'
STICKY_LINES = ['옥탑 Wi-Fi', 'saemal_rooftop', '비밀번호 saemal0601', '12.10']
LL_CROP = (0.235, 0.12, 0.765, 0.65)          # G23 fractions -> 1024² close-up (1.89x: paper + sticky fill the width)


def wrap_words(text, f, widths, d):
    """greedy wrap of `text` into lines whose max widths are given one by one (iterator)."""
    out = []; words = text.split(' '); cur = ''
    w = next(widths)
    for wd in words:
        t = (cur + ' ' + wd) if cur else wd
        if d.textlength(t, font=f) <= w or not cur:
            cur = t
        else:
            out.append(cur); cur = wd; w = next(widths)
    if cur: out.append(cur)
    return out


def landlord_closeup():
    """§3.16 / §4.7.6 close-up (review landlord_note_legibility): G23 re-framed so the paper and the sticky fill the
    width (1.89x LANCZOS of the door + paper), the note in Gaegu with Hangul ≥ 30 px on every 2nd ruled line spread
    down the sheet (wrapped round the sticky), the older yellow sticky ~440 px with glyphs ≥ 34 px over the note's
    empty lower right. Returns dict (image, text alpha, full paper quad, sticky quad) — r2_door maps the same layout."""
    if 'landlord' in CACHE: return CACHE['landlord']
    g = S('g_landlord_note'); W, H = g.size
    a = A(g); l = lum(a)
    paper = ndi.binary_opening(l > 205, iterations=3)
    lab, n = ndi.label(paper); i = np.argmax(ndi.sum(paper, lab, range(1, n + 1))) + 1
    pq = quad_extremes(ndi.binary_fill_holes(lab == i))
    yel = (a[..., 0] > 180) & (a[..., 1] > 170) & (a[..., 2] < 160)
    yel = ndi.binary_opening(yel, iterations=3)
    lab2, n2 = ndi.label(yel)
    if n2:                                     # remove the small generated sticky (door paint), keep its texture
        j = np.argmax(ndi.sum(yel, lab2, range(1, n2 + 1))) + 1
        sy, sx = np.nonzero(lab2 == j)
        sbox = (sx.min() - 4, sy.min() - 4, sx.max() + 10, sy.max() + 10)
        st_tex = g.crop((sx.min() + 6, sy.min() + 6, sx.max() - 6, sy.max() - 6))
        hole = np.zeros((H, W), bool); hole[sbox[1]:sbox[3], sbox[0]:sbox[2]] = True
        band = a[sbox[1]:sbox[3], max(0, sbox[0] - 40):sbox[0] - 6].mean(1)
        fillv = np.repeat(band[:, None, :], sbox[2] - sbox[0], 1)
        a[sbox[1]:sbox[3], sbox[0]:sbox[2]] = fillv + np.random.default_rng(5).normal(0, 1.2, fillv.shape)
        a = np.where(ndi.binary_dilation(hole, iterations=6)[..., None] & ~hole[..., None], gblur(a, 2), a)
    else:
        st_tex = Image.new('RGB', (120, 120), (236, 222, 140))
    # re-frame
    bx = (int(LL_CROP[0] * W), int(LL_CROP[1] * H), int(LL_CROP[2] * W), int(LL_CROP[3] * H))
    s = 1024 / (bx[2] - bx[0])
    im = I(a).crop(bx).resize((1024, 1024), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(1.4, 45, 2))
    T = lambda p: ((p[0] - bx[0]) * s, (p[1] - bx[1]) * s)
    pq2 = [T(p) for p in pq]
    Wc = Hc = 1024
    ac = A(im)
    px0 = max(pq2[0][0], pq2[3][0]); px1 = min(pq2[1][0], pq2[2][0]); py0 = max(pq2[0][1], pq2[1][1])
    pw = px1 - px0
    # ruled lines (on the re-framed paper)
    reg = ac[int(py0) + 20:Hc - 20, int(px0) + 60:int(px1) - 30]
    prof = lum(reg).mean(1); prof = prof - ndi.uniform_filter1d(prof, 25)
    mins = [k for k in range(3, len(prof) - 3) if prof[k] == prof[k - 3:k + 4].min() and prof[k] < -0.4]
    pitch = float(np.median(np.diff(mins))) if len(mins) > 4 else 10.7 * s
    first = int(py0) + 20 + (mins[0] if mins else 0)
    # the sticky: ~440 px, lower right, over the note's empty corner
    sw_ = 462
    sx0, sy0 = int(Wc * 0.986 - sw_), int(Hc + 26 - sw_)        # its blank bottom margin runs off the frame
    # note layout: every 2nd ruled line; rows above the sticky full width, rows beside it end before it
    size = 55
    f = font(FONT_GAEGU, size)
    d0 = ImageDraw.Draw(Image.new('L', (8, 8)))
    step_ = 3                                   # Gaegu syllables with a final consonant are ~1.35x the '가' height
    x0 = px0 + pw * 0.06
    rows = []
    y = first + pitch * 2
    while y < Hc - 22:
        right = (px1 - pw * 0.05) if y < sy0 - 6 else (sx0 - 22)
        rows.append((y, right)); y += pitch * step_
    # wrap sentence by sentence (each starts a new row, as written); if that overflows the sheet, let them flow
    def layout(per_sentence):
        out_ = []; k_ = 0
        if per_sentence:
            for t in LANDLORD_LINES:
                ws = iter([r - x0 for _, r in rows[k_:]] + [9999] * 50)
                ls_ = wrap_words(t, f, ws, d0); out_ += ls_; k_ += len(ls_)
        else:
            out_ = wrap_words(' '.join(LANDLORD_LINES[1:]), f, iter([r - x0 for _, r in rows[1:]] + [9999] * 50), d0)
            out_ = [LANDLORD_LINES[0]] + out_
        return out_
    lines = layout(True)
    if len(lines) + 1 > len(rows): lines = layout(False)
    lay = Image.new('L', (Wc, Hc), 0); d = ImageDraw.Draw(lay)
    rng = random.Random(23)
    for (yb, right), t in zip(rows, lines):
        cx = x0
        for ch in t:
            d.text((cx, yb - size * 0.10 + rng.uniform(-1.2, 1.2)), ch, font=f, fill=235, anchor='ls')
            cx += d.textlength(ch, font=f) * rng.uniform(0.95, 1.0)
    k = len(lines)
    sig = hand.pen_text(LANDLORD_SIG)
    yb, right = rows[min(k, len(rows) - 1)]
    fsig = f
    for sz_ in range(size, 40, -1):                 # a signature is often written a little smaller
        fsig = font(FONT_GAEGU, sz_)
        if right - d.textlength(sig, font=fsig) >= x0: break
    swd = d.textlength(sig, font=fsig)
    d.text((max(x0, right - swd), yb - size * 0.10), sig, font=fsig, fill=235, anchor='ls')
    if k >= len(rows): MISSING.append(f'landlord_note: text overflows the sheet ({k + 1} rows > {len(rows)})')
    lay = lay.rotate(-1, Image.BICUBIC, center=(px0, py0)).filter(ImageFilter.GaussianBlur(0.7))
    text_a = A(lay) / 255 * (0.88 + 0.12 * noise_field((Hc, Wc), 0.9, 24))
    im = hand.ink(im, text_a, hand.INK_LANDLORD, 0.92)
    hg = d0.textbbox((0, 0), '가', font=f, anchor='ls')
    QA['landlord_note'] = (f'1.89x re-frame; Gaegu {size}px = Hangul {hg[3] - hg[1]}px high (≈{(hg[3] - hg[1]) * 390 / 1024:.1f} CSS px '
                           f'at 390 px), {len(lines)} lines + signature on every {step_}nd ruled line (pitch {pitch:.1f}px)')
    # the sticky (its own photographed paper texture, bigger), 4 lines in the same hand, faded ink
    st = st_tex.resize((sw_, sw_), Image.BICUBIC)
    sa = A(st); sa = sa * (0.96 + 0.06 * noise_field(sa.shape[:2], 2, 26))[..., None]
    sa[-int(sw_ * 0.2):, :, :] *= np.linspace(1, 0.93, int(sw_ * 0.2))[:, None, None]
    st = I(sa)
    stl = Image.new('L', st.size, 0); ds = ImageDraw.Draw(stl)
    fs = 70
    def sticky_rows(fs_):
        fz_ = font(FONT_GAEGU, fs_); out_ = []
        for t in STICKY_LINES:
            out_ += wrap_words(t, fz_, iter([sw_ * 0.86] * 9), ds)
        return fz_, out_
    while True:
        fz, srows = sticky_rows(fs)
        if (len(srows) * fs * 1.08 + fs * 0.5 <= sw_ * 0.94 - 26 and max(ds.textlength(t, font=fz) for t in srows) <= sw_ * 0.88) or fs <= 30: break
        fs -= 1
    yy_ = sw_ * 0.05 + fs * 0.95
    for t in srows:
        ds.text((sw_ * 0.06, yy_), t, font=fz, fill=235, anchor='ls'); yy_ += fs * 1.08
    stl = stl.rotate(1.5, Image.BICUBIC, center=(sw_ / 2, sw_ / 2)).filter(ImageFilter.GaussianBlur(0.6))
    st = hand.ink(st, A(stl) / 255 * 0.86, (60, 60, 70), 1.0)
    stA = st.convert('RGBA').rotate(2, Image.BICUBIC, expand=True)
    ox, oy = sx0 - (stA.width - sw_) // 2, sy0 - (stA.height - sw_) // 2
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([sx0 + 5, sy0 + 8, sx0 + sw_ + 5, sy0 + sw_ + 10], fill=(0, 0, 0, 72))
    im = im.convert('RGBA'); im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(7)))
    im.alpha_composite(stA, (ox, oy))
    im = grain(im.convert('RGB'), 2, seed=27)
    sg = ds.textbbox((0, 0), '탑', font=fz, anchor='ls'); sd = ds.textbbox((0, 0), '0', font=fz, anchor='ls')
    QA['landlord_sticky'] = (f'sticky {sw_}px, Gaegu {fs}px: Hangul {sg[3] - sg[1]}px / digits {sd[3] - sd[1]}px high '
                             f'(≈{(sg[3] - sg[1]) * 390 / 1024:.1f} / {(sd[3] - sd[1]) * 390 / 1024:.1f} CSS px at 390 px); rows {srows}')
    sq = [(sx0, sy0), (sx0 + sw_, sy0), (sx0 + sw_, sy0 + sw_), (sx0, sy0 + sw_)]
    out = {'im': im, 'text_a': text_a, 'paper_q': pq2, 'sticky_q': sq, 'sticky': stA, 'sticky_xy': (ox, oy)}
    CACHE['landlord'] = out
    return out


def landlord_note(g=None):
    L = landlord_closeup()
    jpg(L['im'], 'landlord_note')
    META['sticky_q'] = [[min(1.0, v) for v in p_] for p_ in q_frac(L['sticky_q'], 1024, 1024)]   # its blank foot runs off
    META['landlord_note_q'] = [[round(min(max(x / 1024, 0), 1), 4), round(min(max(y / 1024, 0), 1), 4)] for x, y in L['paper_q']]


# ================================================================ PLATE (G01 G02 G03 G04)
def door_rect_in_plate(door_src, door_plate):
    """the telephoto frame (0..1) in plate fractions, from the door rect measured in both (door_plate − door_src × scale)."""
    sx, sy = door_plate['w'] / door_src['w'], door_plate['h'] / door_src['h']
    return {'x': round(door_plate['x'] - door_src['x'] * sx, 4), 'y': round(door_plate['y'] - door_src['y'] * sy, 4),
            'w': round(sx, 4), 'h': round(sy, 4)}


def plate_ctx():
    """sub-view rects (§8.3-2). tank_rect / rail_rect = where the telephoto frame really lies on the plate (derived
    from the door rects / a similarity fit), not the ref crop — the 0.25 s crossfade must land edge on edge."""
    c = load_crops()
    tr = door_rect_in_plate(M('tank_door'), M('plate_door'))
    rr = MEAS.get('rail_rect_fit') or {k: round(c['ref_rail'][k], 4) for k in 'xywh'}
    wr = MEAS.get('railwin_rect_fit') or {k: round(c['ref_railwin'][k], 4) for k in 'xywh'}
    META['tank_rect'] = tr; META['rail_rect'] = rr; META['railwin_rect'] = wr
    return tr, rr, wr


CACHE = {}
K_DARK = 1.15          # R_dark gain shared by the plate and every telephoto (same light on both sides of a crossfade)


def snow_regs():
    """registration fields of the snow edits back onto their bases (cached): G02->G01, G04->G01, G06->G05, G11->G10."""
    if 'fld02' not in CACHE:
        g01 = S('g_roof_plate')
        CACHE['fld02'] = register(S('g_roof_plate_snow'), g01, key='g02_to_g01')
        if has('g_roof_plate_steps'): CACHE['fld04'] = register(S('g_roof_plate_steps'), g01, key='g04_to_g01')
    return CACHE['fld02']


def vert_zero(size, polys, feather=3):
    """1 outside, 0 on the vertical surfaces listed (plate/telephoto fractions)."""
    W, H = size
    v = np.zeros((H, W), np.float32)
    for p in polys:
        v = np.maximum(v, poly_mask(size, q_px(p, W, H), feather))
    return 1 - v


def plate_up(g01, g02r):
    W, H = g01.size
    up = np.clip((lum(A(g02r)) - lum(A(g01))) * 4, 0, 255) / 255
    up = ndi.gaussian_filter(up, 2) * vert_zero((W, H), M('vert_plate'))
    return up


@step
def plate():
    tr, rr, wr = plate_ctx()
    g01o = S('g_roof_plate'); W, H = g01o.size
    g01 = with_lock_plate(g01o)
    sq = q_px(M('stencil_plate'), W, H); dh = M('plate_door')['h'] * H
    # same paint as the telephoto, a little more faded at the plate's distance (§8.2 G01: '판에선 거의 안 읽힌다 —
    # 읽히는 경로는 줌'): at 1x the glyphs are ~8 CSS px; the zoom path (roof_tank) carries the full contrast
    s0src, aw0, pt0 = stencil(g01, sq, dh, alpha_k=0.6)
    jpg(grade_roof(s0src, seed=11), 'roof_plate_s0', limit=360)
    META['stencil_q'] = {'plate': M('stencil_plate'), 'tank': M('stencil_tank'), 'tank_ajar': M('stencil_ajar')}
    META['beam_origin'] = {'x': 0.06, 'y': 0.58}   # stair head-house door on G01 (doc target .06/.55; door middle measured at y .58)
    META['gap_tank'] = {'plate': M('gap_plate'), 'tank': M('gap_tank')}
    META['door_tank'] = {'tank': [[0.235, 0.11], [0.768, 0.11], [0.768, 0.932], [0.235, 0.932]],
                         'plate': [[0.207, 0.245], [0.352, 0.245], [0.352, 0.735], [0.207, 0.735]]}
    META['tank_door_map'] = {'plate': M('plate_door'), 'tank': M('tank_door'),
                             'note': 'patches between plate and roof_tank are mapped door-rect to door-rect (the telephoto is a re-shoot, not a pixel crop); tank_rect = the same map applied to the telephoto frame'}
    n_low = noise_field((H, W), 40, 15)
    CACHE['n_low_plate'] = n_low
    n = snow_noise((H, W), 17, n_low)
    if not has('g_roof_plate_snow'):
        MISSING.append('g_roof_plate_snow -> roof_plate_s1/_s2, m_roof_snow'); return
    fld = snow_regs()
    g02r = I(warp(S('g_roof_plate_snow'), fld))
    up = plate_up(g01o, g02r)
    CACHE['up_plate'] = up
    mask_png(up, 'm_roof_snow', (512, 341))
    # S2: snow only on up-facing pixels (registered G02); every wall, door and post keeps G01 (no edit texture)
    M2 = snow_mask_s2(up)
    s2src = I(A(s0src) * (1 - M2[..., None]) + A(g02r) * M2[..., None])
    s1src, m = snow_blend(s0src, s2src, up, n, 0.45, edge=edge_bias(up, 10))
    jpg(grade_roof(s1src, seed=11), 'roof_plate_s1', limit=360)
    # title / og sources without the stencil (§8.3-8: no spoiler on the title — the stencil is a 'where' clue)
    aw3 = aw0[..., None]
    grade_roof(I(A(s1src) * (1 - aw3) + A(g01) * aw3), seed=11).save(os.path.join(GEN, '_title_src.png'))
    jpg(grade_roof(s2src, seed=11), 'roof_plate_s2', limit=360)
    CACHE['plate_s2src'] = s2src
    QA['snow_s1_cover'] = f'{m.mean() * 100:.1f} % of the plate snowed at c=.45 (incl. .35 dusting)'
    QA['snow_s2_mask'] = f'{(M2 > 0.5).mean() * 100:.1f} % of the plate from G02 (up-facing only)'
    if not has('g_roof_plate_dark'):
        MISSING.append('g_roof_plate_dark -> roof_plate_s2d, R_dark'); return
    R = ndi.gaussian_filter(lum(A(S('g_roof_plate_dark'))) / np.maximum(lum(A(S('g_roof_plate_snow'))), 4), 30)
    R = warp(R, fld)                                   # G02 geometry -> G01 geometry
    CACHE['R'] = R
    np.save(os.path.join(GEN, '_R_dark.npy'), R.astype(np.float32))
    Rp = np.clip(R * K_DARK, 0.03, 1)
    jpg(dark_grade(A(s2src) * Rp[..., None], None, seed=11), 'roof_plate_s2d', q=86, limit=360)
    dark_grade((A(s2src) * (1 - aw3) + A(g01) * aw3) * Rp[..., None], None, seed=11).save(os.path.join(GEN, '_og_src.png'))
    QA['R_dark'] = f'median {np.median(R):.3f}, p5 {np.percentile(R, 5):.3f}, p95 {np.percentile(R, 95):.3f}; s2d = s2 x clip(R x {K_DARK})'
    # footprints (G04): registered onto G01, diff vs registered G02, inside the two corridors
    if not has('g_roof_plate_steps'):
        MISSING.append('g_roof_plate_steps -> p_steps*'); return
    g04r = I(warp(S('g_roof_plate_steps'), CACHE['fld04']))
    diff = np.abs(lum(A(g04r)) - lum(A(g02r))) > 6
    diff = ndi.binary_opening(diff, iterations=1)
    diff = ndi.binary_dilation(diff, iterations=6)
    al = ndi.gaussian_filter(diff.astype(np.float32), 4)
    left = poly_mask(g04r.size, q_px(M('corr_left'), W, H), 6)
    right = poly_mask(g04r.size, q_px(M('corr_right'), W, H), 6)
    s4 = grade_roof(g04r, seed=11)
    png(rgba_patch(s4, al * left), 'p_steps1')
    png(rgba_patch(s4, al * right), 'p_steps2')
    s4d = dark_grade(A(g04r) * Rp[..., None], None, seed=11)
    png(rgba_patch(s4d, al * left), 'p_steps1_d')
    META['corridors'] = {'left': M('corr_left'), 'right': M('corr_right')}
    # the same footprints in roof_tank coordinates (door rect -> door rect), σ1.5 (night hides the resolution)
    for key, img in (('p_steps1_tank', s4), ('p_steps1_tank_d', s4d)):
        p = rgba_patch(img, al * left)
        png(remap(p, M('plate_door'), M('tank_door'), (1024, 1536), blur=1.5), key)


MEAS.update({
    # G04 footprint corridors (plate px fractions): threshold -> lower-left (601 door side) / threshold -> railing
    'corr_left': [[0.215, 0.730], [0.360, 0.730], [0.360, 0.790], [0.300, 1.000], [0.000, 1.000], [0.000, 0.850]],
    'corr_right': [[0.360, 0.735], [0.700, 0.700], [0.780, 0.600], [0.860, 0.640], [0.770, 0.790], [0.360, 0.800]],
    # G32 pol_tank_in: generated blank markers (face quads) and three more to draw (centre x, base y, h)
    'pti_markers': [[[0.074, 0.838], [0.104, 0.838], [0.106, 0.878], [0.072, 0.878]],
                    [[0.5175, 0.7755], [0.539, 0.778], [0.5355, 0.8125], [0.5135, 0.809]]],
    'pti_new': [[0.455, 0.905, 0.038], [0.640, 0.965, 0.040], [0.800, 0.880, 0.034]],
    # vertical surfaces on the plate where G02−G01 brightening is light/texture, not snow (m_roof_snow = 0 there):
    # stair head-house wall + door + lamp, water-tank room front + side, far parapet face (left of the hose)
    'vert_plate': [[[0.0, 0.168], [0.137, 0.176], [0.137, 0.800], [0.0, 0.930]],
                   [[0.170, 0.222], [0.405, 0.222], [0.428, 0.245], [0.428, 0.695], [0.405, 0.740], [0.170, 0.735]],
                   [[0.425, 0.492], [0.628, 0.492], [0.628, 0.535], [0.545, 0.535], [0.545, 0.600], [0.425, 0.600]]],
    # G05/G06 telephoto: the only up-facing surfaces = the snow cap on the tank-room roof and the floor in front
    'up_tank': [[[0.0, 0.0], [1.0, 0.0], [1.0, 0.056], [0.0, 0.056]],
                [[0.0, 0.872], [0.235, 0.880], [0.791, 0.880], [1.0, 0.862], [1.0, 1.0], [0.0, 1.0]]],
})


def ensure_plate_cache():
    """n_low_plate / up_plate / R are shared by tank, rail and move; rebuild them (deterministic) when plate() did not run."""
    if all(k in CACHE for k in ('n_low_plate', 'R', 'up_plate')): return
    H, W = 1024, 1536
    CACHE.setdefault('n_low_plate', noise_field((H, W), 40, 15))
    if has('g_roof_plate', 'g_roof_plate_snow') and 'up_plate' not in CACHE:
        fld = snow_regs()
        CACHE['up_plate'] = plate_up(S('g_roof_plate'), I(warp(S('g_roof_plate_snow'), fld)))
    if has('g_roof_plate_snow', 'g_roof_plate_dark') and 'R' not in CACHE:
        R = ndi.gaussian_filter(lum(A(S('g_roof_plate_dark'))) / np.maximum(lum(A(S('g_roof_plate_snow'))), 4), 30)
        CACHE['R'] = warp(R, snow_regs())


# ================================================================ TANK telephoto (G05 G06 G07 G08 G09)
def tank_fall(H, sigma_k=0.12, centre_k=0.50):
    """vertical falloff of the phone's light along the door (Gaussian σ .12 door height at .50 of the door)."""
    dr = M('tank_door')
    y0, hh = dr['y'] * H, dr['h'] * H
    yy = np.arange(H, dtype=np.float32)
    return np.exp(-((yy - (y0 + centre_k * hh)) ** 2) / (2 * (sigma_k * hh) ** 2)), y0, hh


@step
def tank():
    tr, rr, wr = plate_ctx()
    ensure_plate_cache()
    g05o = S('g_roof_tank'); W, H = g05o.size
    g01 = S('g_roof_plate')
    ref = remap(g01, M('plate_door'), M('tank_door'), (W, H))       # the plate seen through the telephoto mapping
    fmatch = chan_affine(g05o, ref, 0.5)
    t0base = fmatch(with_lock(g05o))
    sq = q_px(M('stencil_tank'), W, H); dh = M('tank_door')['h'] * H
    t0src, aw, patch = stencil(t0base, sq, dh)
    jpg(grade_roof(t0src, seed=21), 'roof_tank_s0')
    con = {'s0': stencil_contrast(grade_roof(t0src, seed=21, noise=0), aw, patch)}
    QA['stencil_tank_glyph_px'] = f'{0.06 * dh:.0f}px target, fit to the blank rectangle ({sq[1][0] - sq[0][0]:.0f}px wide); bridges per jamo ({BRIDGE_EM} em)'
    if not has('g_roof_tank_snow'):
        MISSING.append('g_roof_tank_snow -> roof_tank_s1/_s2/_s2d'); return
    fld6 = register(S('g_roof_tank_snow'), g05o, key='g06_to_g05')
    g06r = fmatch(I(warp(S('g_roof_tank_snow'), fld6)))
    up = np.clip((lum(A(g06r)) - lum(A(t0base))) * 4, 0, 255) / 255
    upz = np.zeros((H, W), np.float32)
    for p in M('up_tank'): upz = np.maximum(upz, poly_mask((W, H), q_px(p, W, H), 3))
    up = ndi.gaussian_filter(up, 2) * upz
    M2 = snow_mask_s2(up)
    t2src = I(A(t0src) * (1 - M2[..., None]) + A(g06r) * M2[..., None])
    nlow = remap_arr(CACHE['n_low_plate'], M('plate_door'), (1536, 1024), M('tank_door'), (W, H))
    nt = snow_noise((H, W), 18, nlow)
    t1src, _ = snow_blend(t0src, t2src, up, nt, 0.45, edge=edge_bias(up, 25))
    jpg(grade_roof(t1src, seed=21), 'roof_tank_s1')
    jpg(grade_roof(t2src, seed=21), 'roof_tank_s2')
    con['s1'] = stencil_contrast(grade_roof(t1src, seed=21, noise=0), aw, patch)
    con['s2'] = stencil_contrast(grade_roof(t2src, seed=21, noise=0), aw, patch)
    R = CACHE.get('R')
    Rt = np.clip(remap_arr(R, M('plate_door'), (1536, 1024), M('tank_door'), (W, H)) * K_DARK, 0.03, 1) if R is not None else np.full((H, W), 0.2)
    CACHE['R_tank'] = Rt
    t2d = dark_grade(A(t2src) * Rt[..., None], None, seed=22)
    jpg(t2d, 'roof_tank_s2d')
    con['s2d'] = stencil_contrast(dark_grade(A(t2src) * Rt[..., None], None, seed=22, noise=0), aw, patch)
    QA['stencil_tank_contrast'] = ' · '.join(f'{k} {w:.2f} (plain {p:.2f})' for k, (w, p) in con.items()) + \
        ' — WCAG (L+.05) ratio of letters vs the pale patch; s2d = s2 × R (letters and patch scaled alike, no letter boost)'
    CACHE['tank'] = {'t2src': t2src, 'Rt': Rt, 'fmatch': fmatch, 'W': W, 'H': H}
    # ---- B09: the phone light in the gap (falloff centred on the phone) + the content (hand / cap), drawn
    fall, y0d, hd = tank_fall(H)
    glow('p_tank_glow', (W, H), q_px(M('gap_tank'), W, H), line=6, bloom=12, rx=80, sig=24, fall=fall)
    glow_plate()
    for kind in ('hand', 'cap'):
        p = js_patch(t2src, kind)
        png(p, 'js_tank_' + kind)
        png(remap(p, M('tank_door'), M('plate_door'), (1536, 1024)), 'js_tank_' + kind + '_plate')
    QA['js_tank'] = 'drawn (not G08/G09): phone light σ .12 door-h at .50, 4 matte nitrile fingertips 10–12 px rim-lit; cap = brim crescent lit from below at .30 (face 0)'
    # ---- B17 / B16 / ≥00:50: the door 40 cm open
    ajar(t2src, Rt, W, H)


def glow_plate():
    """plate copy of p_tank_glow: the telephoto glow mapped door-rect -> door-rect (same falloff, same place)."""
    src = os.path.join(OUT, 'p_tank_glow.png')
    if os.path.exists(src):
        p = Image.open(src).convert('RGBA')
        png(remap(p, M('tank_door'), M('plate_door'), (1536, 1024)), 'p_tank_glow_plate')


def js_patch(base, kind):
    """B09 (§8.3-3): what the 2 cm gap shows when his phone lights up inside — drawn, not generated (G08/G09 lit the
    whole gap like a neon tube, the 'fingers' were three bubbles and the brim sat on the lintel outside the mask).
    Light: Gaussian falloff σ .12 door-h centred on the phone at .50, brighter toward the screen side of the slit;
    the screen itself = a thin bright sliver seen edge-on (~15 cm); 'hand' = 4 matte black nitrile fingers curled
    round the phone, silhouetted on the sliver, tips rim-lit cold (9–12 px thick); 'cap' = + the head as a dark
    occluder and the brim's underside lit from below as a thin crescent at .30 of the door (face 0).
    Full-canvas RGBA = the slit + a 6 px spill on its two inner edges (door edge, frame jamb)."""
    W, H = base.size
    gq = q_px(M('gap_tank'), W, H)
    gx0 = min(x for x, _ in gq); gx1 = max(x for x, _ in gq); gy0 = min(y for _, y in gq)
    gw = gx1 - gx0
    fall, y0d, hd = tank_fall(H)
    b = A(base)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    gm = poly_mask((W, H), gq, 0)
    rng = np.random.default_rng(91 if kind == 'hand' else 92)
    col = np.array([178, 198, 236.0])
    u = np.clip((xx - gx0) / gw, 0, 1)
    yc = y0d + 0.50 * hd
    # ambient glow in the slit (the dark interior lit by the screen): weak, bluish, falls off fast
    amb = 0.36 * fall[:, None] ** 1.3 * (0.22 + 0.78 * u ** 1.8) * (0.92 + 0.08 * noise_field((H, W), 4, 93))
    # the screen sliver (phone held upright, its lit face almost edge-on to the slit)
    sx = gx0 + 0.78 * gw
    sy0, sy1 = yc - 0.040 * hd, yc + 0.036 * hd
    along = np.clip(np.minimum(yy - sy0, sy1 - yy) / 6.0, 0, 1)
    sliver = np.exp(-((xx - sx) / 1.6) ** 2) * along
    halo = np.exp(-((xx - sx) / 5.5) ** 2) * np.clip(np.minimum(yy - sy0 + 30, sy1 + 30 - yy) / 30, 0, 1) * 0.35
    light = amb + sliver * 1.0 + halo
    occl = np.ones((H, W), np.float32)
    rim = np.zeros((H, W), np.float32)
    if kind in ('hand', 'cap'):
        # four fingers curled round the phone from the leaf side: tilted capsules ending in rounded, rim-lit tips
        fy = yc - 0.026 * hd
        for i in range(4):
            th = rng.uniform(10.0, 12.0) * (1.0 if i < 3 else 0.82)          # finger thickness (px)
            r = th / 2
            ang = math.radians(rng.uniform(-9, 7) + (i - 1.5) * 3.0)       # fingers fan a little
            tipx = gx0 + gw * (0.86, 0.90, 0.84, 0.74)[i] + rng.uniform(-0.6, 0.6)
            ax0, ay0 = gx0 - 8.0, fy + r
            ay1 = ay0 + math.tan(ang) * (tipx - r - ax0)
            ax1 = tipx - r
            vx, vy = ax1 - ax0, ay1 - ay0; L2 = vx * vx + vy * vy
            t_ = np.clip(((xx - ax0) * vx + (yy - ay0) * vy) / L2, 0, 1)
            d = np.hypot(xx - (ax0 + t_ * vx), yy - (ay0 + t_ * vy))
            f = np.clip((r - d) / 1.1 + 0.5, 0, 1)
            occl *= 1 - f * 0.93
            # rim light on the outline facing the screen (tip half), plus a nitrile sheen on the knuckle side
            edge_ = np.clip(1 - np.abs(d - r + 0.9) / 1.0, 0, 1) * (t_ > 0.55)
            facing = np.clip((xx - (gx0 + 0.35 * gw)) / (0.5 * gw), 0, 1)
            rim += edge_ * facing * 1.5
            hx_, hy_ = ax0 + 0.80 * vx, ay0 + 0.80 * vy - r * 0.45
            rim += np.exp(-(((xx - hx_) / 2.6) ** 2 + ((yy - hy_) / 1.5) ** 2)) * 0.75
            fy += th * rng.uniform(0.90, 1.0)
        # the thumb on the screen side of the phone, lower, mostly hidden behind the frame jamb
        tcy = yc + 0.012 * hd
        e = (((xx - (gx1 + 2)) / 6.5) ** 2 + ((yy - tcy) / 9.0) ** 2)
        occl *= 1 - np.clip((1 - e) * 3, 0, 1) * 0.93
        rim += np.clip(1 - np.abs(e - 0.85) / 0.25, 0, 1) * (xx < gx1 - 1) * 0.9
    if kind == 'cap':
        ycap = y0d + 0.30 * hd
        ub = u
        yb = ycap - 3 + 4 * ub + 5 * np.sin(np.pi * ub)                     # brim edge: crescent, bulging down
        head = np.clip((yy - (ycap - 0.11 * hd)) / 6, 0, 1) * np.clip(((ycap + 0.13 * hd) - yy) / 10, 0, 1)
        brim = np.clip(1 - (yy - (yb - 6)) / 6, 0, 1) * (yy > yb - 13) * (yy < yb + 0.5)
        occl *= 1 - np.clip(head + brim, 0, 1) * 0.97
        cap_em = np.clip(1 - np.abs(yy - (yb + 1.0)) / 1.3, 0, 1) * 0.95                        # underside, lit
        cap_em = cap_em + np.exp(-((yy - (yb + 3.5)) / 3.0) ** 2) * (yy > yb) * 0.14             # its soft bounce
        cap_em = cap_em * (0.55 + 0.45 * np.sin(np.pi * np.clip(ub * 1.05, 0, 1)))                 # fades at the ends
    if kind != 'cap': cap_em = 0.0
    inside = col[None, None, :] * np.clip(light * occl + cap_em, 0, 1.3)[..., None] + col[None, None, :] * (rim * fall[:, None] / max(fall.max(), 1e-6) * 0.8)[..., None]
    inside = inside + np.array([5.0, 5.0, 7.0]) + rng.normal(0, 1.6, (H, W))[..., None]
    out = b * (1 - gm[..., None]) + np.clip(inside, 0, 255) * gm[..., None]
    # spill on the two inner edges of the slit (door edge / frame jamb), same falloff, screen-blended
    dist = ndi.distance_transform_edt(gm < 0.5)
    w_ = np.exp(-dist / 2.0) * (gm < 0.5) * (dist < 7)
    spill = col[None, None, :] * (w_ * fall[:, None] * 0.38)[..., None]
    out = 255 - (255 - out) * (1 - np.clip(spill / 255, 0, 1))
    al = ndi.binary_dilation(gm > 0.5, iterations=6).astype(np.float32)
    al[int(0.925 * H):] = 0; al[:int(gy0) - 2] = 0
    al = ndi.gaussian_filter(al, 1.0)
    return rgba_patch(grade_roof(I(out), seed=21), al)


MEAS.update({
    # e_tank_ajar_lit (fix pass 2, unregistered edit coords): the open leaf TL TR BR BL, its free-edge strip,
    # the padlock box (hanging past the free edge, over the black interior)
    'leaf_ajar_edit': [[0.226, 0.107], [0.527, 0.097], [0.533, 0.966], [0.236, 0.878]],
    'leaf_edge_edit': [[0.527, 0.097], [0.545, 0.098], [0.552, 0.962], [0.533, 0.966]],
})


def ajar(t2src, Rt, W, H):
    """§8.2 G07 (B17 00:39 · B16 · ≥00:50): the door 40 cm open, built on roof_tank_s2 itself — the closed leaf of
    s2 (stencil + padlock) perspective-warped onto the open leaf measured on e_tank_ajar_lit (lamp-on edit of G07),
    the frame opening black, the quarter-circle the leaf swept through the snow drawn; the edit gives only the leaf
    geometry, its free edge, its shading and the padlock. Dark = the same × R_dark (as s2d)."""
    if not has('e_tank_ajar_lit'):
        MISSING.append('e_tank_ajar_lit -> p_tank_ajar* (left as before)'); return
    lit = S('e_tank_ajar_lit')
    fl = register(lit, S('g_roof_tank'), key='ajar_lit_to_g05')
    litr = A(warp(lit, fl))
    def reg(p):
        x, y = p[0] * W, p[1] * H
        iy, ix = int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))
        return (x - fl[1][iy, ix], y - fl[0][iy, ix])
    leaf = [reg(p) for p in M('leaf_ajar_edit')]
    edge = [reg(p) for p in M('leaf_edge_edit')]
    t2 = A(t2src)
    out = t2.copy()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # 1. the frame opening -> pitch-black interior (down to the snow line in front of the threshold)
    dq = q_px([[0.233, 0.108], [0.793, 0.108], [0.793, 0.902], [0.233, 0.902]], W, H)
    om = poly_mask((W, H), dq, 0.7)
    rng = np.random.default_rng(71)
    interior = np.full((H, W, 3), [7.0, 7.0, 9.0]) + rng.normal(0, 1.5, (H, W))[..., None]
    out = out * (1 - om[..., None]) + interior * om[..., None]
    # 2. the quarter circle swept through the snow (sector between the closed corner and the open corner)
    hx, hy = leaf[3][0], 0.900 * H
    cxo, cyo = leaf[2]
    rx = 0.768 * W - hx
    cth = np.clip((cxo - hx) / rx, -1, 1); th = math.acos(cth)
    ry = max(4.0, (cyo - hy) / max(math.sin(th), 0.2))
    ex, ey = (xx - hx) / rx, (yy - hy) / ry
    rr = np.sqrt(ex ** 2 + ey ** 2); ang = np.arctan2(ey, ex)
    sector = ((rr <= 1.0) & (ey >= 0) & (ang <= th)).astype(np.float32)
    sector = ndi.gaussian_filter(sector, 1.2)
    scr = gblur(t2, 2.2) * 0.80 + np.array([2, 3, 6.0])                # scraped: lower, greyer, smoother
    out = out * (1 - sector[..., None]) + scr * sector[..., None]
    ridge = np.clip(1 - np.abs(rr - 1.04) / 0.05, 0, 1) * (ey >= -0.02) * (ang <= th + 0.05)
    shade = np.clip(1 - np.abs(rr - 0.95) / 0.04, 0, 1) * (ey >= 0) * (ang <= th)
    out = out * (1 + 0.14 * ndi.gaussian_filter(ridge, 1.0))[..., None] * (1 - 0.28 * ndi.gaussian_filter(shade, 1.0))[..., None]
    # 3. the leaf: s2's own closed leaf (stencil, rust, bolt) warped onto the open-leaf quad, shaded like the edit
    src_q = q_px([[0.235, 0.110], [0.768, 0.110], [0.768, 0.932], [0.235, 0.932]], W, H)
    coeffs = find_coeffs(leaf, src_q)          # (dst = open leaf, src = closed leaf)
    lw = Image.fromarray(np.clip(t2, 0, 255).astype(np.uint8)).transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    lm = poly_mask((W, H), leaf, 0.6)
    lwa = A(lw)
    shade_r = gblur(litr * lm[..., None], 22) / np.maximum(gblur(lwa * lm[..., None], 22), 1)
    shade_r = np.clip(shade_r.mean(-1, keepdims=True), 0.55, 1.5)
    lwa = lwa * shade_r
    out = out * (1 - lm[..., None]) + lwa * lm[..., None]
    # the leaf's free edge (steel edge seen side-on) from the edit, denoised
    em = poly_mask((W, H), edge, 0.6)
    out = out * (1 - em[..., None]) + denoise(litr, 1.5) * em[..., None]
    # 4. the padlock stays on the frame's staple (it is s2's own, outside the opening) — nothing to add on the leaf
    pla = np.zeros((H, W), np.float32)
    # stencil quad on the open leaf (for meta): the closed one through the same homography
    Hm = homography(src_q, leaf)
    MEAS['stencil_ajar'] = [[round(v / s, 4) for v, s in zip(apply_h(Hm, p), (W, H))] for p in q_px(M('stencil_tank'), W, H)]
    META.setdefault('stencil_q', {})['tank_ajar'] = MEAS['stencil_ajar']
    META['door_tank_ajar'] = {'tank': [[round(float(x) / W, 4), round(float(y) / H, 4)] for x, y in leaf]}
    # alpha: door frame ∪ leaf ∪ sector, dilated 20 px — outside these, out == s2 exactly (seamless)
    reg_m = (om > 0.02) | (lm > 0.02) | (sector > 0.02) | (em > 0.02) | (pla > 0.02)
    al = ndi.gaussian_filter(ndi.binary_dilation(reg_m, iterations=20).astype(np.float32), 6)
    al = np.maximum(al, reg_m.astype(np.float32))
    lit_im = grade_roof(I(out), seed=21)                               # = roof_tank_s2's grade (same grain field)
    dark_im = dark_grade(out * Rt[..., None], None, seed=22)           # = roof_tank_s2d's grade
    # telephoto copies: outside reg_m the patch IS s2 / s2d pixel for pixel (same grade, same grain seed), so a hard
    # alpha 4 px outside the change is seamless. Half the canvas of grainy photo does not fit a ≤200 KB PNG without
    # octree posterisation (the review's 'black blotches'): PNG8 median-cut = 490–630 KB, truecolour 1.2–1.5 MB ->
    # these two are lossy WebP with a lossless alpha (G.IMG carries the .webp path; every browser the game targets)
    hard = ndi.binary_dilation(reg_m, iterations=4)
    webp_hard(lit_im, hard, 'p_tank_ajar_lit')
    webp_hard(dark_im, hard, 'p_tank_ajar')
    for key, img, plate_key in (('p_tank_ajar_plate', dark_im, 'roof_plate_s2d'), ('p_tank_ajar_plate_lit', lit_im, 'roof_plate_s2')):
        pp = remap(rgba_patch(img, al), M('tank_door'), M('plate_door'), (1536, 1024))
        # tone the plate copy to the plate on its feathered border ring (telephoto vs plate grade)
        pa = A(pp); pb = os.path.join(OUT, plate_key + '.jpg')
        if os.path.exists(pb):
            base = A(Image.open(pb).convert('RGB'))
            ring = (pa[..., 3] > 25) & (pa[..., 3] < 200)
            if ring.sum() > 50:
                for c in range(3):                     # a gain only: the black interior must stay black
                    mp, mb = pa[..., c][ring].mean(), base[..., c][ring].mean()
                    pa[..., c] = pa[..., c] * float(np.clip(mb / max(mp, 1), 0.7, 1.3))
        png(I(pa, 'RGBA'), key)
    QA['p_tank_ajar'] = f'leaf = s2 closed leaf warped to the open quad (edit used for geometry/shade/padlock only); patch area {al.mean() * 100:.1f} %; swing {math.degrees(th):.0f}°'


# ---------------------------------------------------------------- dense registration of an edit back onto its source
def _feat(im):
    """edge feature for matching across snow / light changes: gradient magnitude of the σ1.5 luminance, local-normalised."""
    l = ndi.gaussian_filter(lum(A(im)), 1.5)
    g = np.hypot(ndi.sobel(l, 0), ndi.sobel(l, 1))
    return g / (ndi.gaussian_filter(g, 12) + 8)


def register(src, ref, tile=64, step=24, search=28, key=''):
    """displacement field (dy, dx) per ref pixel so that src(y+dy, x+dx) ≈ ref(y, x).
    The /images/edits results are not pixel-registered to their reference (G02 vs G01: up to ~15 px on the railing),
    so every mix of an edit with its base goes through this warp (tile NCC on edge features, FFT, sub-pixel peak,
    confidence-weighted fill + median + smoothing)."""
    fs, fr_ = _feat(src), _feat(ref)
    H, W = fr_.shape
    ys = list(range(tile // 2, H - tile // 2, step)); xs = list(range(tile // 2, W - tile // 2, step))
    DY = np.zeros((len(ys), len(xs)), np.float32); DX = np.zeros_like(DY); CF = np.zeros_like(DY)
    win = np.outer(np.hanning(tile), np.hanning(tile)).astype(np.float32)
    S2 = tile + 2 * search
    for i, cy in enumerate(ys):
        for j, cx in enumerate(xs):
            r = fr_[cy - tile // 2:cy + tile // 2, cx - tile // 2:cx + tile // 2]
            if r.std() < 0.08: continue
            y0, x0 = cy - tile // 2 - search, cx - tile // 2 - search
            s = np.zeros((S2, S2), np.float32)
            sy0, sx0 = max(0, y0), max(0, x0); sy1, sx1 = min(H, y0 + S2), min(W, x0 + S2)
            s[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = fs[sy0:sy1, sx0:sx1]
            rr = (r - r.mean()) * win
            # NCC by FFT: correlate rr over s
            F = np.fft.rfft2(s); Rk = np.fft.rfft2(rr[::-1, ::-1], s.shape)
            num = np.fft.irfft2(F * Rk, s.shape)[tile - 1:, tile - 1:][:2 * search + 1, :2 * search + 1]
            ones = np.fft.irfft2(np.fft.rfft2(s * s) * np.fft.rfft2(np.ones_like(rr), s.shape), s.shape)[tile - 1:, tile - 1:][:2 * search + 1, :2 * search + 1]
            ones1 = np.fft.irfft2(F * np.fft.rfft2(np.ones_like(rr), s.shape), s.shape)[tile - 1:, tile - 1:][:2 * search + 1, :2 * search + 1]
            var = np.maximum(ones - ones1 ** 2 / (tile * tile), 1e-6)
            ncc = num / np.sqrt(var * (rr ** 2).sum() + 1e-9)
            k = np.unravel_index(np.argmax(ncc), ncc.shape)
            py, px = k
            def sub(a, b, c): return 0.0 if (a - 2 * b + c) == 0 else 0.5 * (a - c) / (a - 2 * b + c)
            fy = sub(ncc[py - 1, px], ncc[py, px], ncc[py + 1, px]) if 0 < py < 2 * search else 0
            fx_ = sub(ncc[py, px - 1], ncc[py, px], ncc[py, px + 1]) if 0 < px < 2 * search else 0
            DY[i, j] = py + fy - search; DX[i, j] = px + fx_ - search; CF[i, j] = ncc[py, px]
    w = np.clip((CF - 0.25) / 0.35, 0, 1)
    # robust: kill tiles that disagree with their neighbourhood median
    for D in (DY, DX):
        med = ndi.median_filter(np.where(w > 0, D, np.nan_to_num(D)), 5)
        w = w * (np.abs(D - med) < 3)
    def fill(D):
        num = ndi.gaussian_filter(D * w, 2.0); den = ndi.gaussian_filter(w, 2.0)
        far = ndi.gaussian_filter(D * w, 8.0) / (ndi.gaussian_filter(w, 8.0) + 1e-6)
        out = np.where(den > 0.05, num / (den + 1e-6), far)
        return ndi.gaussian_filter(out, 1.0)
    dy, dx = fill(DY), fill(DX)
    # tile grid -> pixels (bilinear over the grid centres)
    gy = (np.arange(H) - ys[0]) / step; gx = (np.arange(W) - xs[0]) / step
    YY, XX = np.meshgrid(np.clip(gy, 0, len(ys) - 1), np.clip(gx, 0, len(xs) - 1), indexing='ij')
    fy_ = ndi.map_coordinates(dy, [YY, XX], order=1); fx2 = ndi.map_coordinates(dx, [YY, XX], order=1)
    if key: QA['reg_' + key] = f'|d| median {np.median(np.hypot(dy, dx)):.1f}px, p95 {np.percentile(np.hypot(dy, dx), 95):.1f}px, conf tiles {int((w > 0.5).sum())}/{w.size}'
    return fy_, fx2


def ncc_map(img, tpl):
    """normalised cross-correlation of tpl over img (valid positions), FFT."""
    th, tw = tpl.shape
    t = tpl - tpl.mean(); tn = np.sqrt((t ** 2).sum()) + 1e-9
    sh = (img.shape[0] + th, img.shape[1] + tw)
    F = np.fft.rfft2(img, sh)
    num = np.fft.irfft2(F * np.fft.rfft2(t[::-1, ::-1], sh), sh)[th - 1:img.shape[0], tw - 1:img.shape[1]]
    ones = np.ones_like(t)
    s1 = np.fft.irfft2(F * np.fft.rfft2(ones, sh), sh)[th - 1:img.shape[0], tw - 1:img.shape[1]]
    s2 = np.fft.irfft2(np.fft.rfft2(img * img, sh) * np.fft.rfft2(ones, sh), sh)[th - 1:img.shape[0], tw - 1:img.shape[1]]
    var = np.maximum(s2 - s1 ** 2 / (th * tw), 1e-9)
    return num / (np.sqrt(var) * tn)


def fit_rect(src, ref, wmin, wmax, k=4, key=''):
    """where the whole frame of `src` (a telephoto re-shoot) lies in `ref`: rect {x,y,w,h} (ref fractions), same
    pixel aspect as src, no rotation. Brute force over the width, FFT NCC of edge features for the offset."""
    fs = _feat(src); fr_ = _feat(ref)
    Ws, Hs = src.size; Wr, Hr = ref.size
    tw, th = Ws // k, Hs // k
    tpl = A(Image.fromarray(fs.astype(np.float32), 'F').resize((tw, th), Image.BILINEAR))
    best = (-1, None)
    for w in np.arange(wmin, wmax + 1e-9, 0.004):
        f = tw / (w * Wr)                            # ref px -> template px
        rs = A(Image.fromarray(fr_.astype(np.float32), 'F').resize((max(tw + 2, int(Wr * f)), max(th + 2, int(Hr * f))), Image.BILINEAR))
        if rs.shape[0] <= th or rs.shape[1] <= tw: continue
        m = ncc_map(rs, tpl)
        j = np.unravel_index(np.argmax(m), m.shape)
        if m[j] > best[0]:
            best = (m[j], (w, j[1] / (Wr * f), j[0] / (Hr * f), f))
    sc, (w, x, y, f) = best
    h = w * Wr / Wr * (Hs / Ws) * (Wr / Hr)          # same pixel aspect as src
    r = {'x': round(x, 4), 'y': round(y, 4), 'w': round(w, 4), 'h': round(h, 4)}
    if key: QA['fit_' + key] = f'{r} NCC {sc:.3f}'
    return r, sc


def warp(im_or_arr, field):
    """resample src into ref geometry with a register() field."""
    dy, dx = field
    a = A(im_or_arr) if isinstance(im_or_arr, Image.Image) else im_or_arr
    H, W = dy.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    co = [yy + dy, xx + dx]
    if a.ndim == 2: return ndi.map_coordinates(a, co, order=1, mode='nearest')
    return np.dstack([ndi.map_coordinates(a[..., c], co, order=1, mode='nearest') for c in range(a.shape[2])])


# ---------------------------------------------------------------- open padlock on the tank-room hasp (§1.2.4 · §3.14)
def lock_fix():
    """e_fix_lock (high edit of the 384 px G05 latch crop: S-hook -> open padlock on the staple) as a full-canvas
    patch in G05 coordinates: (rgb HxWx3, alpha HxW). The mask = where the edit differs from G05 inside the latch
    polygon (covers the removed hook, the padlock and its new shadow), tone-matched to G05 on the ring around it."""
    if 'lock' in CACHE: return CACHE['lock']
    CACHE['lock'] = None
    if not has('e_fix_lock'):
        MISSING.append('e_fix_lock -> padlock on the tank door (S-hook stays)'); return None
    from prep_ep2 import FIX_CROPS
    box = FIX_CROPS['ref_fix_lock']['box']
    g05 = S('g_roof_tank'); W, H = g05.size
    bw, bh = box[2] - box[0], box[3] - box[1]
    orig = A(g05.crop(box))
    ed = A(S('e_fix_lock').resize((bw, bh), Image.LANCZOS))
    reg = poly_mask((bw, bh), [(0.700 * W - box[0], 0.530 * H - box[1]), (0.875 * W - box[0], 0.530 * H - box[1]),
                               (0.875 * W - box[0], 0.690 * H - box[1]), (0.700 * W - box[0], 0.690 * H - box[1])], 0) > 0.5
    d = np.abs(gblur(lum(ed), 1.2) - gblur(lum(orig), 1.2))
    ch = (d > 10) & reg
    ch = ndi.binary_opening(ch, iterations=1)
    lab, n = ndi.label(ch)
    if n:
        sz = ndi.sum(ch, lab, range(1, n + 1))
        ch = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 25])
    ch = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_dilation(ch, iterations=4), iterations=3))
    ring = reg & ~ndi.binary_dilation(ch, iterations=6)
    for c in range(3):
        me, se = ed[..., c][ring].mean(), ed[..., c][ring].std() + 1e-6
        mo, so = orig[..., c][ring].mean(), orig[..., c][ring].std() + 1e-6
        ed[..., c] = (ed[..., c] - me) / se * so + mo
    al = np.clip(ndi.gaussian_filter(ch.astype(np.float32), 2.0) * 1.15, 0, 1) * reg
    P = A(g05); P[box[1]:box[3], box[0]:box[2]] = ed
    Al = np.zeros((H, W), np.float32); Al[box[1]:box[3], box[0]:box[2]] = al
    QA['tank_padlock'] = f'e_fix_lock pasted on G05 latch: {int((al > 0.5).sum())} px; carried to s0-s2d, js_*, plate (door map), G28 ref'
    CACHE['lock'] = (P, Al)
    return CACHE['lock']


def with_lock(im):
    """G05-coordinate image (G05 / G06 / G06-derived) with the open padlock pasted."""
    lk = lock_fix()
    if lk is None: return im
    P, Al = lk
    return I(A(im) * (1 - Al[..., None]) + P * Al[..., None])


def with_lock_plate(im):
    """plate-coordinate image (G01 / G02 / G03) with the padlock patch mapped door-rect -> door-rect and tone-matched."""
    lk = lock_fix()
    if lk is None: return im
    P, Al = lk
    W, H = im.size
    src = (1024, 1536)
    Pp = np.dstack([remap_arr(P[..., c], M('tank_door'), src, M('plate_door'), (W, H)) for c in range(3)])
    Ap = np.clip(remap_arr(Al, M('tank_door'), src, M('plate_door'), (W, H)), 0, 1)
    a = A(im)
    # sub-pixel x/y shift so the mapped gap/frame edges land on this plate's own (search on the leaf+gap above/below)
    lb = M('latch_plate')
    ys = np.r_[int((lb[1] - 0.06) * H):int(lb[1] * H), int(lb[3] * H):int((lb[3] + 0.06) * H)]
    xs = slice(int((lb[0] - 0.01) * W), int((lb[2] + 0.01) * W))
    la = lum(a)[ys][:, xs]; lp = lum(Pp)
    best = (1e18, 0, 0)
    for dx in np.arange(-9, 9.01, 0.25):
        for dy in np.arange(-3, 3.01, 0.5):
            sh = ndi.shift(lp, (dy, dx), order=1, mode='nearest')[ys][:, xs]
            e = np.mean((sh - sh.mean() - (la - la.mean())) ** 2)
            if e < best[0]: best = (e, dx, dy)
    _, dx, dy = best
    Pp = np.dstack([ndi.shift(Pp[..., c], (dy, dx), order=1, mode='nearest') for c in range(3)])
    Ap = ndi.shift(Ap, (dy, dx), order=1, mode='nearest')
    QA['tank_padlock_plate_shift'] = f'{dx:+.2f},{dy:+.1f} px'
    # G01's own bolt + S-hook sit off the mapped ones: replace the whole latch box with the mapped (shifted) G05 leaf
    Ap = np.maximum(Ap, poly_mask((W, H), q_px([[lb[0], lb[1]], [lb[2], lb[1]], [lb[2], lb[3]], [lb[0], lb[3]]], W, H), 1.5))
    # tone: G05 (telephoto) -> this plate, fitted on the door leaf around the latch
    dr = M('plate_door')
    reg = np.zeros((H, W), bool)
    reg[int((dr['y'] + dr['h'] * 0.35) * H):int((dr['y'] + dr['h'] * 0.75) * H), int((dr['x'] + dr['w'] * 0.55) * W):int((dr['x'] + dr['w']) * W)] = True
    ring = reg & (Ap < 0.02)
    for c in range(3):
        mp, sp = Pp[..., c][ring].mean(), Pp[..., c][ring].std() + 1e-6
        ma, sa = a[..., c][ring].mean(), a[..., c][ring].std() + 1e-6
        Pp[..., c] = (Pp[..., c] - mp) / sp * sa + ma
    return I(a * (1 - Ap[..., None]) + Pp * Ap[..., None])


def glow(key, size, gap_px, line, bloom, rx, sig, fall=None, spill=0.18):
    """§8.3-5 p_tank_glow: line along the gap centre (185,210,255) + bloom, × the phone's vertical falloff (it is a
    phone at chest height, not a tube light), + a faint spill ellipse on the threshold snow."""
    W, H = size
    xs = [p[0] for p in gap_px]; ys = [p[1] for p in gap_px]
    cx = (min(xs) + max(xs)) / 2; y0, y1 = min(ys), max(ys)
    m = Image.new('L', size, 0); d = ImageDraw.Draw(m)
    d.line([(cx, y0), (cx, y1)], fill=255, width=line)
    a = A(m) / 255
    a = np.clip(a + ndi.gaussian_filter(a, bloom) * 2.2, 0, 1)
    if fall is not None: a = a * fall[:, None]
    sp = Image.new('L', size, 0)
    ImageDraw.Draw(sp).ellipse([cx - rx, y1 - rx * 0.28, cx + rx, y1 + rx * 0.28], fill=255)
    a = np.clip(a + ndi.gaussian_filter(A(sp) / 255, sig) * spill, 0, 1)
    rgb = np.zeros((H, W, 3)) + np.array([185, 210, 255.0])
    png(I(np.dstack([rgb, a * 255]), 'RGBA'), key)


# ================================================================ RAIL telephoto (G10 G11 G12) + window (G13)
def unlight_window(im, poly_frac):
    W, H = im.size
    m = poly_mask(im.size, q_px(poly_frac, W, H), 3)
    a = A(im); l = lum(a)
    # only the faintly lit (warm) interior goes dark — the cool grey railing in front of the window is untouched
    warm_ = np.clip((a[..., 0] - a[..., 2] - 4) / 18, 0, 1)
    m = m * ndi.gaussian_filter(warm_, 2)
    cold = np.dstack([l * 0.30, l * 0.33, l * 0.40])
    return I(a * (1 - m[..., None]) + cold * m[..., None])


MEAS.update({
    # G10 telephoto vs the plate: the model re-framed the view (railing slope, window, brick panel shifted by
    # parallax), so no rect matches every edge. Least-squares similarity over 7 points (railing bend, shed corners,
    # window corners ×2, brick panel corner ×2) -> residual ≤ 45 px at the window, ≤ 85 px at the shed's far corner
    # (ref-crop 1536 px), vs ~100–130 px for the ref crop itself. G10 re-run as a detail-only edit of the plate crop
    # (g_roof_rail.v3_faithful.png) was rejected: in the plate's own geometry the window sill and the speaker are
    # hidden behind our parapet, so L4 would have nothing to sit on.
    'rail_rect_fit': {'x': 0.5631, 'y': 0.2858, 'w': 0.4039, 'h': 0.4039},
    # G13 (fix pass 1, from the re-centred ref_railwin): speaker top front edge; outer sill top line under the
    # window's bottom rail (snow band); the foreground pipe's top edge is detected (expected line below)
    'led_railwin': {'x': 0.597, 'y': 0.838},
    'railwin_ledge': [[0.305, 0.738], [0.695, 0.988]],
    'railwin_pipe_guess': [[0.0, 0.140], [1.0, 0.615]],
})


def pipe_top(im, guess, band=0.07):
    """top edge of the blurred foreground pipe in rail_window: per column, the strongest dark->bright step down
    within ±band of the guessed line; smoothed with a quadratic fit. Returns y(x) px for every column."""
    W, H = im.size
    l = ndi.gaussian_filter(lum(A(im)), 3)
    gy = np.diff(l, axis=0)
    (x0, y0), (x1, y1) = q_px(guess, W, H)
    xs, ys = [], []
    for x in range(0, W, 4):
        ye = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        a, b = int(max(1, ye - band * H)), int(min(H - 2, ye + band * H))
        k = a + int(np.argmax(gy[a:b, x]))
        xs.append(x); ys.append(k)
    xs, ys = np.array(xs, float), np.array(ys, float)
    c = np.polyfit(xs, ys, 2)
    r = ys - np.polyval(c, xs); keep = np.abs(r) < 3 * (np.median(np.abs(r)) + 1)
    c = np.polyfit(xs[keep], ys[keep], 2)
    return np.polyval(c, np.arange(W))


def pipe_snow(im, ytop, diam, cover, seed, blur):
    """snow cap on the out-of-focus foreground pipe: a rounded mound sitting on its top contour (≈.4 of its diameter,
    like roof_rail_s2's railing), covering the pipe's upper arc, cool grey-white, blurred to the pipe's depth of
    field. `cover` < 1 = patchy (S1): patches taper smoothly to nothing along the pipe."""
    W, H = im.size
    yy = np.arange(H, dtype=np.float32)[:, None]
    t = 0.40 * diam
    lenn = noise_field((1, W), 22, seed)[0]
    hgt = t * (0.88 + 0.22 * lenn)
    if cover < 1:
        k = noise_field((1, W), 45, seed + 1)[0]
        keep = np.clip((k - (1 - cover) + 0.15) / 0.45, 0, 1)
        hgt = hgt * 0.62 * (keep * keep * (3 - 2 * keep))          # thinner, long patches with smooth tapered ends
    hg = np.maximum(hgt[None, :], 1e-3)
    rel = (ytop[None, :] - yy) / hg                                  # 0 at the pipe top .. 1 at the crown
    inside = np.clip((1 - rel) * hg / 2.0, 0, 1) * np.clip((rel + 0.22) * hg / 2.0, 0, 1) * (hgt[None, :] > 0.8)
    m = ndi.gaussian_filter(inside.astype(np.float32), blur)
    shade = 0.84 + 0.16 * np.clip(rel, 0, 1)                         # the crown catches more sky than the sides
    a = A(im)
    snowc = np.array([188, 194, 208.0])
    sn = snowc[None, None, :] * ndi.gaussian_filter(shade, blur)[..., None] * (0.97 + 0.06 * noise_field((H, W), 1.5, seed + 2))[..., None]
    return I(a * (1 - m[..., None]) + sn * m[..., None])


def sill_snow(im, ledge, wpx_max, cover, seed):
    """snow on the outer sill: a 6–14 px band along the measured line, noisy top edge, tapered ends, soft shadow."""
    W, H = im.size
    (x0, y0), (x1, y1) = q_px(ledge, W, H)
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = uy, -ux                                                   # normal pointing up-left (above the line)
    if ny > 0: nx, ny = -nx, -ny
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    s = ((xx - x0) * ux + (yy - y0) * uy) / L                        # 0..1 along
    d = (xx - x0) * nx + (yy - y0) * ny                              # px above the line
    taper = np.clip(np.minimum(s, 1 - s) / 0.08, 0, 1) * (s >= 0) * (s <= 1)
    nz = noise_field((H, W), 4, seed)
    th = (6 + (wpx_max - 6) * nz) * taper * (cover if cover < 1 else 1)
    if cover < 1: th = th * np.clip((noise_field((H, W), 20, seed + 3) - (1 - cover)) / 0.2, 0, 1)
    m = np.clip((th - d) / 1.2, 0, 1) * (d > -1.5) * (th > 0.5)
    m = ndi.gaussian_filter(m, 0.7)
    sh = np.clip(1 - np.abs(d + 2.5) / 2.5, 0, 1) * taper * (th > 1) * 0.35        # soft shadow under the lip
    a = A(im) * (1 - ndi.gaussian_filter(sh, 1.0)[..., None])
    snowc = np.array([150, 155, 166.0]) * (0.94 + 0.1 * noise_field((H, W), 1.2, seed + 1))[..., None]
    return I(a * (1 - m[..., None]) + snowc * m[..., None])


@step
def rail():
    tr, rr, wr = plate_ctx()
    ensure_plate_cache()
    g10 = unlight_window(S('g_roof_rail'), M('rail_win')); W, H = g10.size
    g01 = S('g_roof_plate')
    ref = crop_frac(g01, rr).resize((W, H), Image.BICUBIC)
    fmatch = chan_affine(g10, ref, 0.5)
    r0 = fmatch(g10)
    jpg(grade_roof(r0, seed=31), 'roof_rail_s0')
    META['led_rail'] = M('led_rail')
    if not has('g_roof_rail_snow'):
        MISSING.append('g_roof_rail_snow -> roof_rail_s1/_s2/_s2d'); return
    fl11 = register(S('g_roof_rail_snow'), S('g_roof_rail'), key='g11_to_g10')
    g11 = fmatch(unlight_window(I(warp(S('g_roof_rail_snow'), fl11)), M('rail_win')))
    up = ndi.gaussian_filter(np.clip((lum(A(g11)) - lum(A(r0))) * 4, 0, 255) / 255, 2)
    nlow = resize_arr(crop_arr(CACHE['n_low_plate'], rr), (W, H))
    nr = snow_noise((H, W), 19, nlow)
    r1, _ = snow_blend(r0, g11, up, nr, 0.45, edge=edge_bias(up, 18))
    jpg(grade_roof(r1, seed=31), 'roof_rail_s1')
    jpg(grade_roof(g11, seed=31), 'roof_rail_s2')
    R = CACHE.get('R')
    Rr = np.clip(resize_arr(crop_arr(R, rr), (W, H)) * K_DARK, 0.03, 1) if R is not None else np.full((H, W), 0.2)
    jpg(dark_grade(A(g11) * Rr[..., None], None, seed=32), 'roof_rail_s2d')
    if has('g_roof_rail_steps'):
        fl12 = register(S('g_roof_rail_steps'), S('g_roof_rail'), key='g12_to_g10')
        g12 = fmatch(unlight_window(I(warp(S('g_roof_rail_steps'), fl12)), M('rail_win')))
        diff = np.abs(lum(A(g12)) - lum(A(g11))) > 6
        diff = ndi.binary_dilation(ndi.binary_opening(diff, iterations=2), iterations=6)
        cm = poly_mask((W, H), q_px(M('corr_rail'), W, H), 8) if 'corr_rail' in MEAS else 1.0
        al = ndi.gaussian_filter(diff.astype(np.float32), 4) * cm
        png(rgba_patch(grade_roof(g12, seed=31), al), 'p_rail_steps')
    else:
        MISSING.append('g_roof_rail_steps -> p_rail_steps')
    # close window G13: the foreground pipe gets the same snow as roof_rail's railing; outer sill band
    if has('g_rail_window'):
        g13 = S('g_rail_window'); Wn, Hn = g13.size
        s0 = grade_roof(g13, seed=33, bloom=False)
        jpg(s0, 'rail_window_s0')
        yt = pipe_top(g13, M('railwin_pipe_guess'))
        diam = 0.165 * Hn
        out = {}
        for key, cov, wmax in (('rail_window_s1', 0.45, 9), ('rail_window_s2', 1.0, 14)):
            im = pipe_snow(g13, yt, diam, cov, 35, blur=5.0)
            im = sill_snow(im, M('railwin_ledge'), wmax, cov, 36)
            out[key] = im
            jpg(grade_roof(im, seed=33, bloom=False), key)
        a = A(out['rail_window_s2']) * 0.32; a[..., 2] *= 1.12; a[..., 0] *= 0.94
        jpg(grade_roof(I(a), seed=34, noise=4, bloom=False), 'rail_window_s2d')
        META['led_railwin'] = M('led_railwin')
        QA['rail_window'] = f'G13 re-run from the re-centred ref_railwin; speaker bottom right of the right pane (led {M("led_railwin")}); pipe snow mound .45 diam, sill band 6–14 px'
    else:
        MISSING.append('g_rail_window -> rail_window_*')


# ================================================================ MOVE DAY (G28): move_f1..f4 · n_sky · n_roof_snow
@step
def move():
    """G28 (fix pass 2: re-run at high from G01 + padlock — the medium run had crumpled-foil walls): the 0:18 clip
    frames, the moving-day sky (#8) and the snowed roof (#2, its own edit of G28's rail side: e_roof_snow)."""
    g = S('g_move_day'); W, H = g.size
    sq = q_px(M('stencil_move'), W, H)
    md, _, _ = stencil(g, sq, M('move_door')['h'] * H, alpha_k=0.82)   # daylight: crisp but a little lighter-touch
    def frame(im, r, tilt=0.0):
        c = crop_frac(im, r)
        if tilt: c = c.rotate(tilt, Image.BICUBIC).crop((int(c.width * 0.025), int(c.height * 0.035), int(c.width * 0.975), int(c.height * 0.965)))
        return c.resize((1024, 768), Image.LANCZOS)
    f1 = grain(frame(md, {'x': 0.0, 'y': 0.0, 'w': 1.0, 'h': 1.0}, 2.0), 4, seed=41)
    jpg(f1, 'move_f1')
    # f2: 1.6x toward the tank room, horizontal motion blur 9 px
    r2 = {'x': 0.04, 'y': 0.10, 'w': 1 / 1.6, 'h': 1 / 1.6}
    a = A(frame(md, r2, 1.2)); a = ndi.uniform_filter1d(a, 9, axis=1)
    jpg(grain(I(a), 4, seed=42), 'move_f2')
    # f3: 2.4x on the door, door leaf sheared 4 % + directional blur (the 0:09 hinge shriek)
    md3 = md.copy()
    dr = M('move_door'); bx = (int(dr['x'] * W), int(dr['y'] * H), int((dr['x'] + dr['w']) * W), int((dr['y'] + dr['h']) * H))
    leaf = md3.crop(bx)
    lw, lh = leaf.size
    leaf = leaf.transform(leaf.size, Image.AFFINE, (1, 0.04, -0.02 * lh, 0, 1, 0), Image.BICUBIC)
    la = A(leaf); la = ndi.uniform_filter1d(la, 7, axis=1)
    md3.paste(I(la), bx[:2])
    r3 = {'x': 0.125, 'y': 0.29, 'w': 1 / 2.4, 'h': 1 / 2.4}
    jpg(grain(frame(md3, r3, -0.8), 5, seed=43), 'move_f3')
    # f4: f1 cropped 3 % differently (13–18 s of the 0:18 clip)
    jpg(grain(frame(md, {'x': 0.03, 'y': 0.02, 'w': 0.97, 'h': 0.97}, 1.4), 4, seed=44), 'move_f4')
    # n_sky (0310 #8): pure sky of the moving day (above the hills, right of the tank room), portrait 3:4
    sw = 0.13 * W
    sky = g.crop((int(0.56 * W), int(0.005 * H), int(0.56 * W + sw), int(0.005 * H + sw * 4 / 3))).resize((1024, 1365), Image.LANCZOS)
    jpg(grain(phone_grade(sky, ev_=0.15, barrel=0.0), 3, seed=45), 'n_sky')
    # n_roof_snow (0310 #2): e_roof_snow = one high edit of G28's rail side after the 12-14 snowfall (overcast)
    if has('e_roof_snow'):
        e = S('e_roof_snow'); We, He = e.size
        y0 = (He - int(We * 4 / 3)) // 2
        o = e.crop((0, y0, We, y0 + int(We * 4 / 3))).resize((1024, 1365), Image.LANCZOS)
        a = A(o); a = 128 + (a - 128) * 0.94                           # overcast: a little flatter
        jpg(grain(phone_grade(I(a), ev_=0.0, barrel=0.02), 3, seed=46), 'n_roof_snow')
        QA['n_roof_snow'] = 'e_roof_snow (high edit of the re-run G28 x .555–1.0: snow on every horizontal surface, overcast) — no mask blend'
    else:
        MISSING.append('e_roof_snow -> n_roof_snow')


# ================================================================ 0310 album crops of the room (n_room_1..4, n_boxes, n_sill)
def crop34(im, cx, cy, w):
    """3:4 crop centred at (cx, cy) with width w (fractions of width) -> 1024x1365, plus its rect."""
    W, H = im.size
    pw = w * W; ph = pw * 4 / 3
    x0 = min(max(0, cx * W - pw / 2), W - pw); y0 = min(max(0, cy * H - ph / 2), H - ph)
    r = {'x': round(x0 / W, 4), 'y': round(y0 / H, 4), 'w': round(pw / W, 4), 'h': round(ph / H, 4)}
    return im.crop((int(x0), int(y0), int(x0 + pw), int(y0 + ph))).resize((1024, 1365), Image.LANCZOS), r


@step
def nroom():
    rects = META.setdefault('_crop_rects', {})
    # n_room_1: entrance-side empty corner on 12-10 (no box, no 12-18 note, no sticky)
    d = S('g_r2_door')
    c, r = crop34(d, 0.245, 0.62, 0.47)
    jpg(grain(phone_grade(c, 0.3, 0.6), 3, seed=51), 'n_room_1')
    rects['n_room_1'] = dict(r, src='r2_door')
    nq = M('door_note'); xs = [p[0] for p in nq]; ys = [p[1] for p in nq]
    rects['avoid_note'] = {'src': 'r2_door', 'x': min(xs), 'y': min(ys), 'w': max(xs) - min(xs), 'h': max(ys) - min(ys)}
    sq = MEAS.get('sticky_door') or META.get('door_sticky_q')
    if sq:
        xs = [p[0] for p in sq]; ys = [p[1] for p in sq]
        rects['avoid_sticky'] = {'src': 'r2_door', 'x': min(xs), 'y': min(ys), 'w': max(xs) - min(xs), 'h': max(ys) - min(ys)}
    # n_room_2: window on a 12-12 morning — glass shows the daytime roof (G28), keyed with r2_window's own despilled
    # wall + alpha (review chroma_fringe: no #00B140 left on the pane edges)
    w = S('g_r2_window_in'); Ww, Hw = w.size
    if 'r2w' not in CACHE: room()
    wa, walpha = CACHE['r2w']
    if has('g_move_day') and 'glass_q' in META:
        day = S('g_move_day')
        gq = q_px(META['glass_q'], Ww, Hw)
        gcx, gcy = sum(x for x, _ in gq) / 4, sum(y for _, y in gq) / 4
        gq = [(gcx + (x - gcx) * 1.03, gcy + (y - gcy) * 1.03) for x, y in gq]      # cover every keyed glass pixel
        dayc = day.crop((int(0.48 * 1536), int(0.16 * 1024), int(1.0 * 1536), int(0.80 * 1024)))   # no tank door, no boxes
        dayc = ImageEnhance.Brightness(dayc).enhance(1.15)
        lay = A(warp_into(I(wa), dayc, gq))
        a2 = wa * walpha[..., None] + lay * (1 - walpha[..., None])
        win = I(a2)
    else:
        win = I(wa)
    gm_ = (1 - walpha) > 0.5
    QA['n_room_2_green_px'] = int(((A(win)[..., 1] > np.maximum(A(win)[..., 0], A(win)[..., 2]) + 25) & ndi.binary_dilation(gm_, iterations=4) & ~gm_).sum())
    CACHE['n_room_2_full'] = win
    c, r = crop34(win, 0.55, 0.47, 0.80)
    jpg(grain(phone_grade(c, 0.35, -0.3), 3, seed=52), 'n_room_2')
    rects['n_room_2'] = dict(r, src='r2_window')
    # n_sill (#5, 12-11 08:20): window frost (review n_sill_frost): translucent feathery crystals — ridged multi-octave
    # noise, α .35–.8, densest at the panes' bottom corners and edges, gone within ~25 % of the pane, 1 px blur, haze
    fa = A(win)
    yy, xx = np.mgrid[0:Hw, 0:Ww].astype(np.float32)
    frost = np.zeros((Hw, Ww), np.float32); haze = np.zeros((Hw, Ww), np.float32)
    def ridged(sig, seed):
        n = noise_field((Hw, Ww), sig, seed)
        return 1 - np.abs(2 * n - 1)
    rid = norm01(0.5 * ridged(1.1, 53) + 0.3 * ridged(2.4, 54) + 0.2 * ridged(5.0, 55)) ** 2.2
    for k, pq in enumerate(META.get('glass_panes', [])):
        q = q_px(pq, Ww, Hw)
        Hi = homography(q, [(0, 0), (1, 0), (1, 1), (0, 1)])
        den = Hi[2, 0] * xx + Hi[2, 1] * yy + Hi[2, 2]
        u = (Hi[0, 0] * xx + Hi[0, 1] * yy + Hi[0, 2]) / den
        v = (Hi[1, 0] * xx + Hi[1, 1] * yy + Hi[1, 2]) / den
        inside = (u >= 0) & (u <= 1) & (v >= 0) & (v <= 1)
        dc = np.minimum(np.hypot(u, 1 - v), np.hypot(1 - u, 1 - v))            # to the bottom corners
        de = np.minimum(np.minimum(u, 1 - u) * 1.6, (1 - v))                   # to the side / bottom edges
        dens = np.clip(1 - dc / 0.42, 0, 1) ** 1.4 + 0.55 * np.clip(1 - de / 0.16, 0, 1) ** 1.6
        dens = np.clip(dens, 0, 1) * np.clip((0.25 - np.minimum(dc * 0.6, de)) / 0.25 * 1.4, 0, 1) * inside
        frost = np.maximum(frost, np.clip(dens * (0.30 + 0.85 * rid) * 1.25 * (dens > 0.05), 0, 0.85))
        haze = np.maximum(haze, dens * 0.18)
    frost = ndi.gaussian_filter(frost, 1.0); haze = ndi.gaussian_filter(haze, 5)
    ice = np.array([236, 242, 250.0])
    fa = fa * (1 - haze[..., None]) + ice * haze[..., None]
    fa = fa * (1 - frost[..., None]) + ice * frost[..., None]
    c, _ = crop34(I(fa), 0.47, 0.50, 0.34)
    jpg(grain(phone_grade(c, 0.2, -0.6), 3, seed=55), 'n_sill')
    # n_room_3: the mug on the desk (12-16 20:30) — the new phone stays out of frame
    k = S('g_r2_desk')
    c, r = crop34(k, 0.60, 0.55, 0.29)
    jpg(grain(phone_grade(c, 0.1, 0.8), 4, seed=56), 'n_room_3')
    rects['n_room_3'] = dict(r, src='r2_desk')
    if 'np_desk_q' in META:
        q = META['np_desk_q']; xs = [p[0] for p in q]; ys = [p[1] for p in q]
        rects['avoid_newphone'] = {'src': 'r2_desk', 'x': min(xs), 'y': min(ys), 'w': max(xs) - min(xs), 'h': max(ys) - min(ys)}
    # n_room_4: bed side at night with the room light dimmed (−1.3 EV, 4000 K, no local light)
    b = r2_bed_img()
    c, r = crop34(b, 0.55, 0.62, 0.80)
    c = warm(ev(c, -1.3), 0.8)
    jpg(grain(phone_grade(c, 0.0, 0.0), 6, seed=57), 'n_room_4')
    rects['n_room_4'] = dict(r, src='r2_bed')
    # n_boxes (#10, 12-10 15:10): the two moving boxes, afternoon light
    c, r = crop34(b, 0.17, 0.66, 0.33)
    jpg(grain(phone_grade(c, 0.35, 0.9), 3, seed=58), 'n_boxes')
    rects['n_boxes'] = dict(r, src='r2_bed')


# ================================================================ pol_tank_in markers
MEAS.update({
    # G32 pol_tank_in (before the mirror): outside-only features on the door seen from inside — the repainted pale
    # rectangle and the bolt + S-hook — cloned away from the same door column above / below
    'pti_rect': [0.600, 0.228, 0.708, 0.360, +0.125],
    'pti_latch': [0.708, 0.472, 0.770, 0.585, -0.115],
})


def clone_patch(a, box, dy_frac, feather=5):
    """copy the same columns from dy_frac (fraction of H) above/below into box (fractions), feathered."""
    H, W = a.shape[:2]
    x0, y0, x1, y1 = int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)
    dy = int(dy_frac * H)
    src = a[y0 + dy:y1 + dy, x0:x1]
    m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1
    m = ndi.gaussian_filter(m, feather)
    m = np.clip(m * 1.6, 0, 1)
    full = a.copy(); full[y0:y1, x0:x1] = src
    # match the local level (the clone comes from a little brighter / darker part of the leaf)
    ring = (m > 0.02) & (m < 0.4)
    for c in range(3):
        full[..., c][m > 0] += (a[..., c][ring].mean() - full[..., c][ring].mean())
    return a * (1 - m[..., None]) + full * m[..., None]


@step
def pol_tank():
    """evidence photo ② (review pol_tank_in_door_inside): shot from INSIDE the tank room, so the outside-only pale
    rectangle and the bolt + S-hook are cloned away and the photo is mirrored (from inside the latch side and its
    2 cm gap are on the left); markers 1–5 with contact shadows and the flash falloff of their spot."""
    g = S('g_pol_tank_in'); W, H = g.size
    a = A(g)
    for k in ('pti_rect', 'pti_latch'):
        b = M(k); a = clone_patch(a, b[:4], b[4])
    im = ImageOps.mirror(I(a))
    l = ndi.gaussian_filter(lum(A(im)), 18)
    ref = np.percentile(l, 97)
    gen = [[[round(1 - x, 4), y] for x, y in (q[1], q[0], q[3], q[2])] for q in M('pti_markers')[:2]]
    faces = list(gen)
    for cx, by, h in M('pti_new'):
        cx = 1 - cx
        cxp, byp, hp = cx * W, by * H, h * H
        wf = hp * 0.85
        face = [(cxp - wf / 2, byp - hp), (cxp + wf / 2, byp - hp), (cxp + wf / 2 + 2, byp), (cxp - wf / 2 - 2, byp)]
        back = [(cxp - wf / 2 - 4, byp - hp - 3), (cxp + wf / 2 - 4, byp - hp - 3), (cxp + wf / 2 - 7, byp - 4), (cxp - wf / 2 - 6, byp - 4)]
        f = float(np.clip(0.50 + 0.62 * l[int(byp - hp / 2), int(cxp)] / ref, 0.45, 1.05))     # flash falloff here
        lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
        d.polygon([(x - 3, y - 5) for x, y in face], fill=(0, 0, 0, 70))                       # cast behind (flash at camera)
        lay = lay.filter(ImageFilter.GaussianBlur(4)); d = ImageDraw.Draw(lay)
        d.ellipse([cxp - wf * 0.65, byp - 3, cxp + wf * 0.65, byp + 4], fill=(0, 0, 0, 120))    # contact shadow
        lay = lay.filter(ImageFilter.GaussianBlur(1.6)); d = ImageDraw.Draw(lay)
        d.polygon(back, fill=tuple(int(v * f) for v in (150, 128, 28)) + (255,))
        d.polygon(face, fill=tuple(int(v * f) for v in (226, 200, 70)) + (255,))
        la = A(lay)
        # a little plastic sheen + print grain so the tent is lit by the same flash
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        sheen = np.exp(-(((xx - (cxp - wf * 0.15)) / (wf * 0.35)) ** 2 + ((yy - (byp - hp * 0.75)) / (hp * 0.25)) ** 2)) * 22 * f
        fm = poly_mask((W, H), face, 0)
        la[..., :3] += (sheen * fm)[..., None]
        la[..., :3] *= (0.97 + 0.06 * noise_field((H, W), 1.0, 63))[..., None]
        imA = im.convert('RGBA'); imA.alpha_composite(I(la, 'RGBA')); im = imA.convert('RGB')
        faces.append([[round(x / W, 4), round(y / H, 4)] for x, y in face])
    faces = sorted(faces, key=lambda q: q[0][0])
    for i, fq in enumerate(faces, 1):
        q = q_px(fq, W, H)
        lay = Image.new('L', (200, 200), 0)
        ImageDraw.Draw(lay).text((100, 108), str(i), font=font(FONT_BOLD, 150), fill=255, anchor='mm')
        im = hand.ink(im, hand.warp_alpha(A(lay) / 255, im.size, q) * 0.93, (14, 14, 14), mode='normal')
    jpg(grain(im, 2, seed=61), 'pol_tank_in')
    QA['pol_tank_in'] = f'{len(faces)} markers 1–5 (2 generated + 3 drawn, contact shadow + flash falloff); mirrored, outside-only rectangle + latch cloned away'


# ================================================================ title / og / icon
@step
def meta_art():
    s1 = os.path.join(GEN, '_title_src.png')
    if not os.path.exists(s1): s1 = os.path.join(OUT, 'roof_plate_s1.jpg')
    if os.path.exists(s1):
        p = Image.open(s1).convert('RGB')
        c = p.crop((int(0.06 * 1536), 0, int(0.06 * 1536) + 683, 1024)).resize((1024, 1536), Image.LANCZOS)
        jpg(grain(ev(c, -1.5), 3, seed=71), 'title_ep2', limit=360)
    s2d = os.path.join(GEN, '_og_src.png')
    if not os.path.exists(s2d): s2d = os.path.join(OUT, 'roof_plate_s2d.jpg')
    if os.path.exists(s2d):
        p = Image.open(s2d).convert('RGB')
        c = p.crop((0, 70, 1536, 70 + 806)).resize((1200, 630), Image.LANCZOS)
        c = I(A(c) * 1.35 + 4)
        c = vignette(c, 0.55)
        d = ImageDraw.Draw(c, 'RGBA')
        d.text((600, 262), '하루를 위한 방탈출! 2', font=font(FONT_BOLD, 74), fill=(255, 255, 255, 217), anchor='mm')
        d.text((600, 372), '돌려줄게', font=font(FONT_SANS, 52), fill=(255, 255, 255, 217), anchor='mm')
        jpg(c, 'og_ep2', q=86)
    ic = Image.open(os.path.join(EP1, 'icon.png')).convert('RGB')
    d = ImageDraw.Draw(ic)
    d.rounded_rectangle([176, 356, 336, 382], 6, fill=(255, 255, 255))
    png(ic, 'icon_ep2')
    png(ic.resize((192, 192), Image.LANCZOS), 'icon_ep2_192')

# ================================================================ TTS (§7.3 · §4.9.1) — generate + post
TTS_JSON = os.path.join(REPO, 'tools', 'tts_ep2.json')
TTS_WORK = os.path.join(REPO, 'work', 'tts_ep2')
AUD_OUT = os.path.join(REPO, 'ep2', 'assets', 'audio')


def ep1_funcs(path, names):
    """Load only the imports + named function defs / assignments of an ep1 tool. tts.py and ttspost.py run their
    jobs at module level (ep1 voices, argv), so importing them would re-run ep1 — we take their functions as-is."""
    import ast
    tree = ast.parse(open(path, encoding='utf-8').read())
    keep = []
    for n in tree.body:
        if isinstance(n, (ast.Import, ast.ImportFrom)): keep.append(n)
        elif isinstance(n, ast.FunctionDef) and n.name in names: keep.append(n)
        elif isinstance(n, ast.Assign) and all(isinstance(t, ast.Name) and t.id in names for t in n.targets): keep.append(n)
    ns = {}
    exec(compile(ast.Module(body=keep, type_ignores=[]), path, 'exec'), ns)
    return ns


def tts_gen(names=None, force=False):
    cfg = json.load(open(TTS_JSON, encoding='utf-8'))
    raw = os.path.join(TTS_WORK, 'raw'); os.makedirs(raw, exist_ok=True)
    ns = ep1_funcs(os.path.join(REPO, 'tools', 'tts.py'), {'run'})
    ns['OUT'] = raw
    for j in cfg['jobs']:
        if not j.get('generate', True): continue
        if names and j['name'] not in names: continue
        name = j.get('take', j['name'])
        if os.path.exists(os.path.join(raw, name + '.raw.wav')) and not force:
            print(name, 'skip (exists)'); continue
        r = ns['run']((name, j['voice'], j['text'], j['instructions']))
        print(*r, flush=True)
        open(os.path.join(TTS_WORK, '_usage.jsonl'), 'a', encoding='utf-8').write(json.dumps(
            {'name': name, 'voice': j['voice'], 'chars': len(j['text']) + len(j['instructions']), 'result': str(r[1])}, ensure_ascii=False) + '\n')


def k_weight(x, sr):
    """ITU-R BS.1770 K-weighting (two biquads, coefficients re-derived for sr)."""
    from scipy import signal
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / sr)
    b2 = [1, -2, 1]; a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))


def lufs(x, sr):
    y = k_weight(x, sr)
    blk, hop = int(0.4 * sr), int(0.1 * sr)
    z = np.array([np.mean(y[i:i + blk] ** 2) for i in range(0, max(1, len(y) - blk), hop)]) + 1e-12
    l = -0.691 + 10 * np.log10(z)
    z = z[l > -70]
    if not len(z): return -99.0
    g = -0.691 + 10 * np.log10(z.mean()) - 10
    z2 = z[(-0.691 + 10 * np.log10(z)) > g]
    return float(-0.691 + 10 * np.log10(z2.mean())) if len(z2) else -99.0


def frames_rms(x, sr, win=0.02):
    n = int(win * sr)
    m = len(x) // n
    return np.sqrt(np.mean(x[:m * n].reshape(m, n) ** 2, 1) + 1e-12), n


def active_rms_db(x, sr):
    r, _ = frames_rms(x, sr)
    act = r[r > np.max(r) * 10 ** (-30 / 20)]
    return 20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12)


def voicing(x, sr):
    """max normalised autocorrelation in the 70–350 Hz pitch range over the loudest 200 ms (≈0 = unvoiced)."""
    r, n = frames_rms(x, sr, 0.2)
    i = int(np.argmax(r)); seg = x[i * n:(i + 1) * n]
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
    ac = ac / (ac[0] + 1e-12)
    lo, hi = int(sr / 350), int(sr / 70)
    return float(ac[lo:hi].max())


def compress(x, sr, thr_db=-24, ratio=2.5, att=0.005, rel=0.12):
    env = np.abs(x); out = np.empty_like(x); g = 1.0; e = 0.0
    aa, ar = math.exp(-1 / (att * sr)), math.exp(-1 / (rel * sr))
    thr = 10 ** (thr_db / 20)
    for i, v in enumerate(env):
        e = aa * e + (1 - aa) * v if v > e else ar * e + (1 - ar) * v
        g = (e / thr) ** (1 / ratio - 1) if e > thr else 1.0
        out[i] = x[i] * g
    return out


def make_ir(sr, sec=0.25, decay=3.0, bright=0.4, seed=5):
    """ep1 spatial.js makeIR (lowpassed noise × (1 − t)^decay), mono."""
    n = int(sr * sec); rng = np.random.default_rng(seed)
    w = rng.uniform(-1, 1, n); lp = np.zeros(n); acc = 0.0
    for i in range(n):
        acc += (w[i] - acc) * bright; lp[i] = acc
    return lp * (1 - np.arange(n) / n) ** decay


def segments(x, sr, gap_s=0.16, th_db=-34):
    """speech segments split at silences ≥ gap_s (frames below th dB re. the loudest frame)."""
    r, n = frames_rms(x, sr, 0.01)
    on = 20 * np.log10(r / r.max()) > th_db
    segs, start, quiet = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None: start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.01 >= gap_s:
                segs.append((start * n, (i - quiet + 1) * n)); start = None; quiet = 0
    if start is not None: segs.append((start * n, len(x)))
    return segs


def wsola(x, rate, sr, win=0.032, tol=0.012):
    """waveform-similarity overlap-add time compression (rate > 1 = shorter), pitch kept."""
    N = int(win * sr); Hs = N // 2; Ha = int(round(Hs * rate)); tolN = int(tol * sr)
    w = np.hanning(N)
    out_len = int(len(x) / rate) + 2 * N
    y = np.zeros(out_len); ws = np.zeros(out_len)
    pos, k, nat = 0, 0, None
    while pos + N + tolN < len(x) and k * Hs + N < out_len:
        if nat is None:
            best = pos
        else:
            a0, a1 = max(0, pos - tolN), min(len(x) - N, pos + tolN)
            c = np.correlate(x[a0:a1 + N], nat, 'valid')
            best = a0 + int(np.argmax(c))
        y[k * Hs:k * Hs + N] += x[best:best + N] * w; ws[k * Hs:k * Hs + N] += w
        nat = x[best + Hs:best + Hs + N]
        if len(nat) < N: break
        pos += Ha; k += 1
    y = y / np.maximum(ws, 1e-3)
    return y[:k * Hs + Hs]


def tts_post():
    from scipy import signal
    cfg = json.load(open(TTS_JSON, encoding='utf-8'))
    tp = ep1_funcs(os.path.join(REPO, 'tools', 'ttspost.py'), {'read', 'write', 'trim', 'filt', 'norm', 'SR'})
    read, write, trim, filt = tp['read'], tp['write'], tp['trim'], tp['filt']
    SR = tp['SR']
    os.makedirs(AUD_OUT, exist_ok=True)
    raw = os.path.join(TTS_WORK, 'raw')
    report = {}
    def level(x, target_db=-20.0, peak_db=-1.0):
        g = 10 ** ((target_db - active_rms_db(x, SR)) / 20)
        pk = np.max(np.abs(x * g)) + 1e-12
        if pk > 10 ** (peak_db / 20): g *= 10 ** (peak_db / 20) / pk
        return x * g
    def stats(name, x):
        d = {'dur_s': round(len(x) / SR, 2), 'peak_dbfs': round(20 * np.log10(np.max(np.abs(x)) + 1e-12), 1),
             'rms_active_dbfs': round(active_rms_db(x, SR), 1), 'lufs': round(lufs(x, SR), 1)}
        report[name] = d; print(name, d, flush=True); return d
    for j in cfg['jobs']:
        if not j.get('generate', True): continue
        name = j['name']; src = os.path.join(raw, j.get('take', name) + '.raw.wav')
        if not os.path.exists(src):
            print(name, 'MISSING raw'); report[name] = 'missing'; continue
        x, sr = read(src)
        x = trim(x, sr, 0.008)
        x = signal.resample_poly(x, SR, sr) if sr != SR else x
        x = np.asarray(x, np.float64)
        kind = j.get('post')
        if kind == 'vm':
            x = filt(x, SR, 100, 8000)
            x = compress(x, SR, -26, 2.2)
            wet = signal.fftconvolve(x, make_ir(SR, 0.25))[:len(x)]
            wet *= np.sqrt(np.mean(x ** 2) / (np.mean(wet ** 2) + 1e-12))
            x = x * 0.75 + wet * 0.25
            segs = segments(x, SR)
            # merge into 3 sentences by the two longest gaps
            gaps = sorted(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1], reverse=True)[:2]
            cuts = sorted(gaps)
            sent = []
            b0 = 0
            for k in cuts:
                sent.append((segs[b0][0], segs[k][1])); b0 = k + 1
            sent.append((segs[b0][0], segs[-1][1]))
            lead = j['lead_s']; T = j['target_s']; wins = j['windows']
            out = np.zeros(int(T * SR))
            starts = [lead, wins[1][0], wins[2][0]]
            place = []
            for (a0, a1), st, wn in zip(sent, starts, wins):
                seg = x[a0:a1]
                room = int((wn[1] - st) * SR)
                if len(seg) > room:                     # window too short: start earlier, never overlap the previous one
                    st = max(place[-1][1] / SR + 0.12 if place else 0.3, wn[1] - len(seg) / SR)
                i0 = int(st * SR); i1 = min(len(out), i0 + len(seg))
                fade = np.minimum(1, np.minimum(np.arange(i1 - i0), np.arange(i1 - i0)[::-1]) / (0.01 * SR))
                out[i0:i1] += seg[:i1 - i0] * fade
                place.append((i0, i1))
            rng = np.random.default_rng(11)
            hiss = filt(rng.normal(0, 1, len(out)), SR, 200, 6000)
            hiss *= 10 ** (-50 / 20) / (np.sqrt(np.mean(hiss ** 2)) + 1e-12)
            out = level(out + 0) + hiss
            write(os.path.join(AUD_OUT, name + '.wav'), out, SR)
            d = stats(name, out)
            d['sentences_s'] = [[round(a / SR, 2), round(b / SR, 2)] for a, b in place]
            d['windows'] = wins
            # _a / _b cuts (same file, no new TTS): _a = lead + sentence 1; _b = from 감았을 때 (after '하루 씨가')
            a_end = place[0][1] + int(0.08 * SR)
            fo = int(0.006 * SR); rc = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fo))          # 6 ms raised cosine
            a_seg = out[:a_end].copy(); a_seg[-fo:] *= rc[::-1]
            write(os.path.join(AUD_OUT, name + '_a.wav'), a_seg, SR)
            s2a, s2b = place[1]
            seg2 = out[s2a:s2b]
            r, n = frames_rms(seg2, SR, 0.01)
            hf = filt(seg2, SR, 4000, None) if False else signal.lfilter(*signal.butter(4, [4000 / (SR / 2), 8000 / (SR / 2) * 0.99], 'band'), seg2)
            rh, _ = frames_rms(hf, SR, 0.01)
            # '하루 씨가|감았을 때': the tense /s͈/ of 씨 is the strongest 4–8 kHz burst in the first ~0.9 s;
            # 가 follows (~0.25–0.4 s after the burst onset), then the lenis-k closure of 감 = local energy dip
            w = int(0.9 / 0.01)
            kf = int(np.argmax(rh[:w]))
            on = kf
            while on > 0 and rh[on - 1] > rh[kf] * 0.35: on -= 1
            lo, hi = on + int(0.22 / 0.01), min(len(r) - 1, on + int(0.48 / 0.01))
            k = lo + int(np.argmin(r[lo:hi]))
            b_start = s2a + k * n
            d['fricative_s'] = round((s2a + on * n) / SR, 2)
            b_seg = out[b_start:].copy(); b_seg[:fo] *= rc
            write(os.path.join(AUD_OUT, name + '_b.wav'), b_seg, SR)
            d['cut_a_s'] = round(a_end / SR, 2); d['cut_b_s'] = round(b_start / SR, 2)
            d['name_part_s'] = [round(s2a / SR, 2), round(b_start / SR, 2)]
            stats(name + '_a', a_seg); stats(name + '_b', b_seg)
            d['b_first_sample'] = round(float(b_seg[0]), 4); d['a_last_sample'] = round(float(a_seg[-1]), 4)
        elif kind == 'kang':
            x = filt(x, SR, 90, 9000)
            # light noise reduction: gate frames 40 dB under the speech peak
            r, n = frames_rms(x, SR, 0.01)
            gmask = np.repeat((20 * np.log10(r / r.max()) > -40).astype(float), n)
            gmask = np.convolve(np.pad(gmask, (0, len(x) - len(gmask))), np.ones(int(0.02 * SR)) / int(0.02 * SR), 'same')
            x = x * np.clip(gmask, 0.1, 1)
            # one even take, ≈4.5 s (§7.3): pauses (≥ .15 s under −30 dB re. the peak, breaths included) cut to .35 s
            # between sentences / .12 s inside one, then a gentle WSOLA time compression to land at ≈ 4.9 s
            r, n = frames_rms(x, SR, 0.01)
            quiet = 20 * np.log10(r / r.max() + 1e-12) < -30
            runs, st_ = [], None
            for i, q in enumerate(list(quiet) + [False]):
                if q and st_ is None: st_ = i
                if not q and st_ is not None:
                    if (i - st_) * 0.01 >= 0.15 and st_ > 0 and i < len(quiet): runs.append((st_, i))
                    st_ = None
            parts, last = [], 0
            for (a_, b_) in runs:
                keep = 0.35 if (b_ - a_) * 0.01 >= 0.40 else 0.12
                parts.append(x[last:a_ * n])
                mid = x[a_ * n:b_ * n]
                kn = int(keep * SR); h = kn // 2
                parts.append(np.concatenate([mid[:h], mid[-(kn - h):]]) if len(mid) > kn else mid)
                last = b_ * n
            parts.append(x[last:])
            x = np.concatenate(parts)
            target = j.get('target_s', 4.5) + 0.4                     # ≈ 4.9 s with the lead / tail below
            rate = max(1.0, (len(x) / SR) / (target - 0.2))
            if rate > 1.01: x = wsola(x, min(rate, 1.18), SR)
            kang_note = f'pauses cut ({len(runs)} gaps -> .35 s / .12 s), WSOLA x{min(rate, 1.18):.3f}'
            x = np.concatenate([np.zeros(int(0.05 * SR)), x, np.zeros(int(0.15 * SR))])
            x = level(x)
            tone = filt(np.random.default_rng(17).normal(0, 1, len(x)), SR, 120, 3000)
            x = x + tone * 10 ** (-62 / 20) / (np.sqrt(np.mean(tone ** 2)) + 1e-12)     # no digital-silence dropouts
            write(os.path.join(AUD_OUT, name + '.wav'), x, SR)
            stats(name, x)['post'] = kang_note
        elif kind == 'breath':
            v0 = voicing(x, SR)
            # unvoiced re-synthesis: noise shaped by the take's own amplitude envelope and smoothed spectrum
            env = np.abs(signal.hilbert(x)); env = np.convolve(env, np.hanning(int(0.06 * SR)) / (0.03 * SR), 'same')
            spec = np.abs(np.fft.rfft(x)); spec = ndi.uniform_filter1d(spec, max(3, int(len(spec) / 60)))
            nz = np.random.default_rng(13).normal(0, 1, len(x))
            nz = np.fft.irfft(np.fft.rfft(nz) * spec, len(x))
            nz = nz / (np.sqrt(np.mean(nz ** 2)) + 1e-12)
            y = filt(nz * env, SR, 200, 2200)
            T = j['target_s']
            if len(y) > T * SR * 1.25: y = y[:int(T * SR * 1.25)] * np.minimum(1, np.linspace(1.25 * T, 0, int(T * SR * 1.25)) / 0.25)
            y = np.concatenate([np.zeros(int(0.03 * SR)), y, np.zeros(int(0.12 * SR))])
            y = level(y, -22.0)
            write(os.path.join(AUD_OUT, name + '.wav'), y, SR)
            d = stats(name, y); d['voicing_take'] = round(v0, 2); d['voicing_out'] = round(voicing(y, SR), 2)
    json.dump(report, open(os.path.join(TTS_WORK, '_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


MEAS.update({
    # G07 tank ajar: the blank rectangle on the opened (foreshortened) leaf
    'stencil_ajar': [[0.308, 0.255], [0.468, 0.252], [0.468, 0.393], [0.308, 0.392]],
    # G12 (retry 1) roof_rail_steps: floor trail (left) + railing pipe top + parapet top
    'corr_rail': [[0.0, 0.69], [0.16, 0.69], [0.16, 0.34], [0.40, 0.42], [0.68, 0.58], [0.66, 0.70], [0.52, 1.0], [0.0, 1.0]],
})


# ================================================================ ep2/js/data/assets.js (G.IMG · G.IMGSET · G.IMGMETA · G.AUDIO_FILES)
EP1_REUSE = ['avatar_jimin', 'avatar_sea', 'kongi_old', 'mo_clothes', 'mo_sky', 'mo_laptop', 'mo_mandarin', 'mo_mug',
             'mo_mixdesk', 'dog_bed', 'dog_park', 'dog_face', 'sea_orgel_live', 'icon']
GROUPS = {
    'roof_plate': ['roof_plate_s0', 'roof_plate_s1', 'roof_plate_s2', 'roof_plate_s2d'],
    'roof_tank': ['roof_tank_s0', 'roof_tank_s1', 'roof_tank_s2', 'roof_tank_s2d'],
    'roof_rail': ['roof_rail_s0', 'roof_rail_s1', 'roof_rail_s2', 'roof_rail_s2d'],
    'rail_window': ['rail_window_s0', 'rail_window_s1', 'rail_window_s2', 'rail_window_s2d'],
    'peephole': ['peephole_s0', 'peephole_s1', 'peephole_s2', 'peep_tape'],
    'note_card': ['note_card_front', 'note_card_back'],
    'move_frames': ['move_f1', 'move_f2', 'move_f3', 'move_f4'],
    'win_shot': ['win_shot_%02d' % i for i in range(1, 15)],
    'roof_video': ['roofvid_f1', 'roofvid_f2', 'roofvid_f3'],
    'n_room': ['n_room_1', 'n_room_2', 'n_room_3', 'n_room_4'],
    'n_post': ['n_post_1', 'n_post_2', 'n_post_3'],
    'pol': ['pol_case', 'pol_tank_in', 'pol_tally', 'pol_sticker'],
    'album_0310': ['n_room_1', 'n_room_2', 'n_room_3', 'n_room_4', 'n_roof_snow', 'n_sill', 'n_lock_new', 'n_sky',
                   'move_f1', 'n_boxes', 'contract_cap'],
}
PRELOAD = ['p2_door_open', 'box_top', 'r2_door', 'n_wall', 'note_card_front', 'polaroid_601']
PRELOAD_GROUPS = {   # §9.8 lazy bundles
    'start': PRELOAD + ['r2_window_mask', 'box_top_in', 'note_card_back', 'landlord_note', 'peephole_s0', 'p_door_box'],
    'm1': ['r2_window', 'roof_plate_s0', 'roof_plate_s1', 'r2_bed', 'r2_desk', 'm_roof_snow', 'p_win_refl', 'doorlock_in',
           'box_top_lifted', 'box_top_lifted_in', 'polaroid_601_back', 'peephole_s1', 'peep_tape'],
    'm2': ['newphone'],
    'm3': ['old_room', 'old_room_lock', 'inn_key', 'rec_voicetalk', 'n_room_1', 'n_room_2', 'n_room_3', 'n_room_4',
           'n_roof_snow', 'n_sill', 'n_lock_new', 'n_sky', 'n_boxes', 'contract_cap', 'move_f1', 'move_f2', 'move_f3',
           'move_f4'] + ['win_shot_%02d' % i for i in range(1, 15)] + ['roofvid_f1', 'roofvid_f2', 'roofvid_f3'],
    'm4': ['roof_plate_s2', 'roof_plate_s2d', 'roof_tank_s0', 'roof_tank_s1', 'roof_tank_s2', 'roof_tank_s2d',
           'roof_rail_s0', 'roof_rail_s1', 'roof_rail_s2', 'roof_rail_s2d', 'rail_window_s0', 'rail_window_s1',
           'rail_window_s2', 'rail_window_s2d', 'p_steps1', 'p_steps1_d', 'p_steps2', 'p_steps1_tank', 'p_steps1_tank_d',
           'p_rail_steps', 'p_tank_ajar', 'p_tank_ajar_lit', 'p_tank_ajar_plate', 'p_tank_ajar_plate_lit', 'p_tank_glow',
           'p_tank_glow_plate', 'js_tank_hand', 'js_tank_hand_plate', 'js_tank_cap', 'js_tank_cap_plate', 'door_handle',
           'door_handle_r2', 'peephole_s2'],
    'm7': ['pol_case', 'pol_tank_in', 'pol_tally', 'pol_sticker', 'kongi_santa'],
}


def write_assets_js():
    files = sorted(f for f in os.listdir(OUT) if f.endswith(('.jpg', '.png', '.webp')))
    keys = {os.path.splitext(f)[0]: f for f in files}
    meta = {k: v for k, v in json.load(open(META_PATH, encoding='utf-8')).items() if not k.startswith('_')}
    rep_p = os.path.join(TTS_WORK, '_report.json')
    rep = json.load(open(rep_p, encoding='utf-8')) if os.path.exists(rep_p) else {}
    aud = sorted(os.path.splitext(f)[0] for f in os.listdir(AUD_OUT) if f.endswith('.wav')) if os.path.isdir(AUD_OUT) else []
    L = []
    w = L.append
    w('/* Episode 2 asset registry — GENERATED by tools/post_ep2.py (write_assets_js); do not edit by hand.')
    w(' * Keys = DESIGN_EP2 §8.3-1 (+ §8.1 ep1 reuse). Paths are relative to ep2/index.html.')
    w(' * Patches p_* / js_* / m_* / door_handle* are FULL-CANVAS overlays of the image they sit on (place at 0,0,100%,100%).')
    w(' * m_roof_snow and r2_window_mask are LA PNGs (L = A = mask): they work as CSS mask-image in alpha and luminance mode.')
    w(' * G.IMGMETA coordinates are fractions (0–1) of that image; a circle r is a fraction of the image WIDTH. */')
    w('(function () {')
    w("  'use strict';")
    w('  const G = (window.G = window.G || {});')
    w("  const P = 'assets/img/';")
    w("  const E1 = '../assets/img/';   // episode-1 files, referenced in place (§8.1)")
    w('  G.IMG = {')
    for k in sorted(keys):
        w(f"    {k}: P + '{keys[k]}',")
    w('    // §8.1 episode-1 reuse (not copied)')
    for k in EP1_REUSE:
        ext = '.png' if k == 'icon' else '.jpg'
        w(f"    {'icon_ep1' if k == 'icon' else k}: E1 + '{k}{ext}',")
    w('  };')
    w('  // §2.6 anchor names that stand for a group -> the default (first) state')
    for g, members in GROUPS.items():
        if g in ('n_room', 'n_post', 'pol', 'album_0310', 'roof_plate'): continue
        w(f'  G.IMG.{g} = G.IMG.{members[0]};')
    w('  G.IMG.roof_plate = G.IMG.roof_plate_s0;')
    w('  G.IMGSET = {')
    for g, members in GROUPS.items():
        w(f"    {g}: [{', '.join('G.IMG.' + m for m in members)}],")
    w('  };')
    w('  G.IMGMETA = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';')
    w('  G.AUDIO_FILES = ' + json.dumps(aud) + ';   // under G.AUDIO_BASE (assets/audio/), .wav 22.05 kHz mono')
    am = {}
    for k, v in rep.items():
        if isinstance(v, dict):
            am[k] = {kk: v[kk] for kk in ('dur_s', 'sentences_s', 'cut_a_s', 'cut_b_s', 'name_part_s') if kk in v}
    w('  G.AUDIO_META = ' + json.dumps(am, separators=(',', ':')) + ';   // measured: VM sentence spans sit on the §4.1.4 subtitle windows')
    w('  G.ASSET = { title: G.IMG.title_ep2, og: G.IMG.og_ep2, icon: G.IMG.icon_ep2, icon192: G.IMG.icon_ep2_192 };')
    w('  G.PRELOAD = [' + ', '.join('G.IMG.' + k for k in PRELOAD) + '];')
    w('  G.PRELOAD_GROUPS = {')
    for g, members in PRELOAD_GROUPS.items():
        w(f"    {g}: [{', '.join('G.IMG.' + m for m in members if m in keys)}],")
    w('  };')
    w('})();')
    os.makedirs(os.path.join(REPO, 'ep2', 'js', 'data'), exist_ok=True)
    open(os.path.join(REPO, 'ep2', 'js', 'data', 'assets.js'), 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')
    print('assets.js:', len(keys), 'ep2 keys +', len(EP1_REUSE), 'ep1 ·', len(aud), 'audio')


# ================================================================ runner
ORDER = ['room', 'box', 'note_card', 'peephole', 'plate', 'tank', 'rail', 'tankgap', 'room2', 'move',
         'nroom', 'dash', 'pol_tank', 'ending', 'posts', 'meta_art']


def run(names):
    by = {f.__name__: f for f in STEPS}
    if not names: QA.clear()                     # a full run rewrites every QA line (no stale notes)
    done = set()
    for n in ORDER:
        if names and n not in names: continue
        t = time.time()
        try:
            by[n]()
            print(f'[{n}] ok {time.time() - t:.1f}s', flush=True)
        except Missing as e:
            MISSING.append(f'{n}: source {e} missing'); print(f'[{n}] MISSING {e}', flush=True)
        except Exception as e:
            import traceback; traceback.print_exc()
            MISSING.append(f'{n}: ERROR {e!r}')
        done.add(n)
    if MISSING: QA['missing'] = MISSING
    else: QA.pop('missing', None)
    txt = json.dumps(META, ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    open(META_PATH + '.tmp', 'w', encoding='utf-8').write(txt)
    os.replace(META_PATH + '.tmp', META_PATH)
    print('\n'.join(LOG[-200:]))
    print('MISSING:', MISSING or 'none')
    if not names: write_assets_js()


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--measure':
        import qa_ep2
        for n in args[1:]: qa_ep2.grid(n)
    elif args and args[0] == '--tts-gen':
        tts_gen()
    elif args and args[0] == '--tts-post':
        tts_post()
    elif args and args[0] == '--assets-js':
        write_assets_js()
    elif args and args[0] == '--fixrefs':
        # refs for fix pass 2 (edits that must already show the open padlock): G01 + lock, G06 + lock
        with_lock_plate(S('g_roof_plate')).save(os.path.join(GEN, 'ref_fix_plate_lock.png'))
        with_lock(S('g_roof_tank_snow')).save(os.path.join(GEN, 'ref_fix_tank_snow_lock.png'))
        print('ref_fix_plate_lock.png · ref_fix_tank_snow_lock.png', QA.get('tank_padlock'), MISSING)
    else:
        run([a for a in args if not a.startswith('--')])
