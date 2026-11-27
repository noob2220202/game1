"""Episode 3 — build every final image of DESIGN_EP3 §8.3 from work/gen_ep3/*.png (+ the TTS of §7.3, + assets.js).

usage (repo root, PowerShell):
  $env:HARU_OUT="$PWD\\ep3\\assets\\img"; python tools\\post_ep3.py     # all image steps -> ep3/assets/img + meta.json
  python tools\\post_ep3.py bases patches         # only some steps (meta.json is merged, not replaced)
  python tools\\post_ep3.py --measure g_r3_door   # grid overlay for measuring (= qa_ep3.py grid)
  python tools\\post_ep3.py --placeholders        # paint a local stand-in for every generated source that is missing
                                                  #   (quota stop) + write work/gen_ep3/_regen_todo.json
  python tools\\post_ep3.py --tts-gen [names]     # TTS: tools/tts_ep3.json -> work/tts_ep3/raw/*.raw.wav (tools/tts.py run())
  python tools\\post_ep3.py --tts-post [names]    # §7.3 chain -> ep3/assets/audio/*.wav + work/tts_ep3/_report.json
  python tools\\post_ep3.py --assets-js           # ep3/js/data/assets.js only

Rules kept here (§8): the model never draws text — every Korean string / number in an image is drawn below with fonts
(702 · clock numerals · pencil dates; everything else is DOM); no faces; {N} never drawn; the man never shown; his hand
(Nanum Pen Script, the pen font of ep1/ep2) is never used in this file — mom writes with Nanum Brush Script
(work/fonts/brush.ttf), Seah with Gamja Flower (work/fonts/gamja.ttf); if those two files are not on this PC
(tools/get_fonts_ep3.sh fetches them) a procedural pencil hand drawn from sans.ttf stands in and the QA notes it.
Coordinates in meta.json are fractions (0–1) of that image ([x, y] points, {x, y, w, h} rects, circle r = fraction
of the image WIDTH). Patches x3_* are FULL-CANVAS RGBA PNGs of the view they sit on (place at 0,0,100 %,100 %).
"""
import os, sys, json, math, random, io, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage as ndi

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('HARU_WORK', os.path.join(REPO, 'work'))
sys.path.insert(0, os.path.dirname(__file__))
import fx
import hand

GEN = os.path.join(REPO, 'work', 'gen_ep3')
PH = os.path.join(GEN, '_ph')                     # local placeholders (quota fallback) — same names as the sources
OUT = os.environ.get('HARU_OUT', os.path.join(REPO, 'ep3', 'assets', 'img'))
EP1 = os.path.join(REPO, 'assets', 'img')
FONT_SANS, FONT_BOLD = fx.FONT_SANS, fx.FONT_BOLD
FONT_BRUSH = os.path.join(fx.SCR, 'fonts', 'brush.ttf')     # Nanum Brush Script — mom's hand (§8.3-6)
FONT_GAMJA = os.path.join(fx.SCR, 'fonts', 'gamja.ttf')     # Gamja Flower — Seah's hand
META_PATH = os.path.join(OUT, 'meta.json')
os.makedirs(OUT, exist_ok=True)

try:
    META = json.load(open(META_PATH, encoding='utf-8')) if os.path.exists(META_PATH) else {}
except ValueError:
    META = {}
QA = META.setdefault('_qa', {})
LOG, MISSING, USED_PH = [], [], set()
random.seed(7); np.random.seed(7)


class Missing(Exception):
    pass


# ================================================================ io helpers
def S(name):
    """generated source (RGB) — or its local placeholder (recorded: the final key is then marked [PH])."""
    p = os.path.join(GEN, name + '.png')
    if os.path.exists(p): return Image.open(p).convert('RGB')
    q = os.path.join(PH, name + '.png')
    if os.path.exists(q):
        USED_PH.add(name); return Image.open(q).convert('RGB')
    raise Missing(name)


def has(*names):
    return all(os.path.exists(os.path.join(GEN, n + '.png')) or os.path.exists(os.path.join(PH, n + '.png')) for n in names)


def is_ph(*names):
    return any(not os.path.exists(os.path.join(GEN, n + '.png')) for n in names)


def A(im):
    return np.asarray(im).astype(np.float32)


def I(a, mode=None):
    a = np.clip(a, 0, 255).astype(np.uint8)
    return Image.fromarray(a, mode) if mode else Image.fromarray(a)


def lum(a):
    a = A(a) if isinstance(a, Image.Image) else a
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


SRC_OF = {}          # final key -> generated sources it was built from (placeholder marking)


def mark(key, *srcs):
    SRC_OF[key] = list(srcs)


def jpg(im, key, q=82, limit=300):
    im = im.convert('RGB')
    for qq in range(q, 50, -2):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=qq, optimize=True, progressive=True)
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
        for colors, dz in ((256, 1), (192, 1), (128, 1), (128, 0), (96, 0), (64, 0)):
            qi = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE,
                             dither=Image.Dither.FLOYDSTEINBERG if dz else Image.Dither.NONE)
            b = io.BytesIO(); qi.save(b, 'PNG', optimize=True)
            how = f'png8/{colors}' + ('d' if dz else '')
            if b.tell() <= limit * 1024: break
    open(os.path.join(OUT, key + '.png'), 'wb').write(b.getvalue())
    LOG.append(f'{key}.png {im.size[0]}x{im.size[1]} {im.mode} {how} {b.tell() // 1024} KB')
    return im


def fr(x, y, W, H):
    return [round(x / W, 4), round(y / H, 4)]


def q_px(q, W, H):
    return [(x * W, y * H) for x, y in q]


def rect_px(r, W, H):
    return (r['x'] * W, r['y'] * H, (r['x'] + r['w']) * W, (r['y'] + r['h']) * H)


def poly_mask(size, pts, feather=0):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
    if feather: m = m.filter(ImageFilter.GaussianBlur(feather))
    return A(m) / 255.0


def gblur(a, s):
    if a.ndim == 3: return np.stack([ndi.gaussian_filter(a[..., c], s) for c in range(a.shape[2])], -1)
    return ndi.gaussian_filter(a, s)


def noise_field(shape, sigma, seed):
    return np.random.default_rng(seed).normal(0, sigma, shape).astype(np.float32)


def find_coeffs(dst, src):
    return fx._find_coeffs(dst, src)


def warp_card(card, quad, size):
    """perspective-map an RGBA card into quad (TL,TR,BR,BL px) of a canvas of `size`."""
    w, h = card.size
    co = find_coeffs(quad, [(0, 0), (w, 0), (w, h), (0, h)])
    return card.convert('RGBA').transform(size, Image.PERSPECTIVE, co, Image.BICUBIC)


def warp_alpha(a, quad, size):
    h, w = a.shape
    co = find_coeffs(quad, [(0, 0), (w, 0), (w, h), (0, h)])
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L').transform(size, Image.PERSPECTIVE, co, Image.BICUBIC)
    return A(im) / 255.0


def to_lin(a):
    return np.power(np.clip(a / 255.0, 0, 1), 2.2)


def to_srgb(l):
    return np.power(np.clip(l, 0, 1), 1 / 2.2) * 255.0


def uv(H, W):
    v, u = np.mgrid[0:H, 0:W].astype(np.float32)
    return u / W, v / H


# ================================================================ dense registration of an edit onto its base (ep2 post_ep2.py)
def _feat(im):
    l = ndi.gaussian_filter(lum(A(im) if isinstance(im, Image.Image) else im), 1.5)
    g = np.hypot(ndi.sobel(l, 0), ndi.sobel(l, 1))
    return g / (ndi.gaussian_filter(g, 12) + 8)


def register(src, ref, tile=64, step=24, search=28, key=''):
    """displacement field (dy, dx) per ref pixel so that src(y+dy, x+dx) ≈ ref(y, x) — tile NCC on edge features
    (the /images/edits results are not pixel-registered to their reference)."""
    fs, fr_ = _feat(src), _feat(ref)
    H, W = fr_.shape
    ys = list(range(tile // 2, H - tile // 2, step)); xs = list(range(tile // 2, W - tile // 2, step))
    DY = np.zeros((len(ys), len(xs)), np.float32); DX = np.zeros_like(DY); CF = np.zeros_like(DY)
    win = np.outer(np.hanning(tile), np.hanning(tile)).astype(np.float32)
    S2 = tile + 2 * search
    ones_k = None
    for i, cy in enumerate(ys):
        for j, cx in enumerate(xs):
            r = fr_[cy - tile // 2:cy + tile // 2, cx - tile // 2:cx + tile // 2]
            if r.std() < 0.08: continue
            y0, x0 = cy - tile // 2 - search, cx - tile // 2 - search
            s = np.zeros((S2, S2), np.float32)
            sy0, sx0 = max(0, y0), max(0, x0); sy1, sx1 = min(H, y0 + S2), min(W, x0 + S2)
            s[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = fs[sy0:sy1, sx0:sx1]
            rr = (r - r.mean()) * win
            if ones_k is None: ones_k = np.fft.rfft2(np.ones_like(rr), s.shape)
            F = np.fft.rfft2(s); Rk = np.fft.rfft2(rr[::-1, ::-1], s.shape)
            cut = lambda z: z[tile - 1:, tile - 1:][:2 * search + 1, :2 * search + 1]
            num = cut(np.fft.irfft2(F * Rk, s.shape))
            s2 = cut(np.fft.irfft2(np.fft.rfft2(s * s) * ones_k, s.shape))
            s1 = cut(np.fft.irfft2(F * ones_k, s.shape))
            var = np.maximum(s2 - s1 ** 2 / (tile * tile), 1e-6)
            ncc = num / np.sqrt(var * (rr ** 2).sum() + 1e-9)
            py, px = np.unravel_index(np.argmax(ncc), ncc.shape)
            def sub(a, b, c): return 0.0 if (a - 2 * b + c) == 0 else 0.5 * (a - c) / (a - 2 * b + c)
            fy = sub(ncc[py - 1, px], ncc[py, px], ncc[py + 1, px]) if 0 < py < 2 * search else 0
            fx_ = sub(ncc[py, px - 1], ncc[py, px], ncc[py, px + 1]) if 0 < px < 2 * search else 0
            DY[i, j] = py + fy - search; DX[i, j] = px + fx_ - search; CF[i, j] = ncc[py, px]
    w = np.clip((CF - 0.25) / 0.35, 0, 1)
    for D in (DY, DX):
        med = ndi.median_filter(np.where(w > 0, D, np.nan_to_num(D)), 5)
        w = w * (np.abs(D - med) < 3)
    def fill(D):
        num = ndi.gaussian_filter(D * w, 2.0); den = ndi.gaussian_filter(w, 2.0)
        far = ndi.gaussian_filter(D * w, 8.0) / (ndi.gaussian_filter(w, 8.0) + 1e-6)
        return ndi.gaussian_filter(np.where(den > 0.05, num / (den + 1e-6), far), 1.0)
    dy, dx = fill(DY), fill(DX)
    gy = (np.arange(H) - ys[0]) / step; gx = (np.arange(W) - xs[0]) / step
    YY, XX = np.meshgrid(np.clip(gy, 0, len(ys) - 1), np.clip(gx, 0, len(xs) - 1), indexing='ij')
    fy_ = ndi.map_coordinates(dy, [YY, XX], order=1); fx2 = ndi.map_coordinates(dx, [YY, XX], order=1)
    if key: QA['reg_' + key] = f'|d| median {np.median(np.hypot(dy, dx)):.1f}px, p95 {np.percentile(np.hypot(dy, dx), 95):.1f}px, conf {int((w > 0.5).sum())}/{w.size}'
    return fy_, fx2


def warp(im_or_arr, field):
    dy, dx = field
    a = A(im_or_arr) if isinstance(im_or_arr, Image.Image) else im_or_arr
    H, W = dy.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    co = [yy + dy, xx + dx]
    if a.ndim == 2: return ndi.map_coordinates(a, co, order=1, mode='nearest')
    return np.dstack([ndi.map_coordinates(a[..., c], co, order=1, mode='nearest') for c in range(a.shape[2])])


# ================================================================ grading (§8.2 post notes) — position-deterministic, so a patch
# graded with the same function and the same noise field matches its base pixel for pixel outside the change
GRADE = {
    # view: (cool k toward ~3300 K in the shadows, shadow blue-grey lift, noise σ, vignette, seed)
    'r3_door':    dict(cool=0.05, shadow=3, noise=5, vig=0.22, seed=101),
    'r3_veranda': dict(cool=0.04, shadow=4, noise=5, vig=0.12, seed=102),
    'r3_sofa':    dict(cool=0.04, shadow=3, noise=5, vig=0.12, seed=103),
    'r3_kitchen': dict(cool=0.04, shadow=3, noise=5, vig=0.12, seed=104),
    'r3_sr_desk': dict(cool=0.02, shadow=2, noise=5, vig=0.12, seed=105, warm_lamp=True),
    'r3_sr_bed':  dict(cool=0.02, shadow=2, noise=5, vig=0.12, seed=106),
}
_NOISE = {}


def view_grade(a, view, noise=True):
    """night grade of a base view (float RGB array in, float out): white balance a little cooler in the shadows (the
    lamp side keeps its warmth), blue-grey lift in the shadows, vignette, fixed mono noise field per view."""
    g = GRADE[view]
    a = a.astype(np.float32).copy()
    H, W = a.shape[:2]
    L = lum(a) / 255.0
    wcool = np.clip(1 - L * 1.4, 0, 1)[..., None]          # bright (lamp-lit) pixels keep their warmth
    k = g['cool']
    a = a * (1 + wcool * np.array([-k * 0.8, 0.0, k * 1.2], np.float32))
    sh = ((1 - L) ** 2)[..., None]
    a = a + g['shadow'] * sh * np.array([-0.5, 0.25, 1.0], np.float32)
    if g['vig']:
        u, v = uv(H, W)
        d = np.sqrt(((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2) / math.sqrt(2)
        a = a * (1 - g['vig'] * np.clip(d, 0, 1) ** 2.2)[..., None]
    if noise and g['noise']:
        key = (view, H, W)
        if key not in _NOISE: _NOISE[key] = noise_field((H, W), g['noise'], g['seed'])
        a = a + _NOISE[key][..., None] * (0.55 + 0.45 * (1 - L[..., None]))   # grain shows most in the shadows
    return np.clip(a, 0, 255)


def bilateral(a, d=7, sc=18.0, ss=5.0):
    """plain bilateral filter (range on luminance), d×d window — numpy, no OpenCV on this PC."""
    r = d // 2
    L = lum(a)
    pad = np.pad(a, ((r, r), (r, r), (0, 0)), mode='edge')
    padL = np.pad(L, r, mode='edge')
    H, W = L.shape
    out = np.zeros_like(a); wsum = np.zeros_like(L)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            ws = math.exp(-(dy * dy + dx * dx) / (2 * ss * ss))
            sl = padL[r + dy:r + dy + H, r + dx:r + dx + W]
            w = ws * np.exp(-((sl - L) ** 2) / (2 * sc * sc))
            out += w[..., None] * pad[r + dy:r + dy + H, r + dx:r + dx + W]
            wsum += w
    return out / wsum[..., None]


KLIT = {'gain': 1.0}     # exposure gain in front of the §8.3-4 curve, solved on r3_kitchen by kitchen_gain()


KWB = np.array([0.72, 1.0, 1.45], np.float32)     # AD fix: 2700 -> 4600 K after the curve (was .96 / 1 / 1.06 = sepia;
                                                   # tuned so the ivory walls land at R/B 1.1–1.2 in pixel values)
KCHROMA = 0.72                                     # chroma pulled toward luminance (fluorescent light is flat)
# the two ceiling fixtures of G04 (measured on a 1 % zoom): round light (ellipse) · strip over the range (rect)
KFIX = {'round': {'cx': 0.359, 'cy': 0.1505, 'rx': 0.0315, 'ry': 0.0085},
        'strip': {'x': 0.382, 'y': 0.2000, 'w': 0.166, 'h': 0.0125}}


def lin_lum(lin):
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722


def fixtures_mask(H, W):
    """soft coverage of the two kitchen ceiling fixtures' diffusers (0..1)."""
    u, v = uv(H, W)
    r = KFIX['round']
    e = (((u - r['cx']) / r['rx']) ** 2 + ((v - r['cy']) / r['ry']) ** 2 <= 1).astype(np.float32)
    s_ = KFIX['strip']
    e = np.maximum(e, ((u >= s_['x']) & (u <= s_['x'] + s_['w']) & (v >= s_['y']) & (v <= s_['y'] + s_['h'])).astype(np.float32))
    return np.clip(ndi.gaussian_filter(e, 1.0) * 1.1, 0, 1)


def relight(a, mode, view_meta=None, closeup=False, seed=7, noise=True, gain=None, bil=True, fixtures=False):
    """§8.3-4 — same function for a base and every patch laid on it (no seam). a = float RGB 0–255 (ungraded source).
    kitchen_lit: 05:30 ceiling light 4600 K · sr_dim: 03:35–05:05 Seah's room night light 2400 K."""
    H, W = a.shape[:2]
    u, v = uv(H, W)
    if mode == 'kitchen_lit':
        if bil:   # AD fix: the 7x7 σc 18 filter smeared floor / walls into paint -> d 5 · σc 10, blended 50/50
            a = 0.5 * a + 0.5 * bilateral(a, 5, 10, 5)
        lin = to_lin(a)
        L = lin_lum(lin)
        g_ = gain if gain is not None else (KLIT['gain'] if KLIT.get('solved') else kitchen_gain())
        if closeup and gain is None: g_ = g_ ** 0.6          # close-ups sit in the lamp's pool already (no blow-out)
        y = 1 - (1 - np.clip(L * g_, 0, 1)) ** 1.9
        M = 1.0 if closeup else 0.82 + 0.30 * np.exp(-((u - 0.50) ** 2 + (v - 0.02) ** 2) / (2 * 0.35 ** 2))
        ratio = (y * M / np.maximum(L, 1e-5))[..., None]
        lit = lin * ratio
        # white balance toward 4600 K after the curve, then chroma pulled toward luminance (no amber cast)
        wb = lit * KWB
        Lw = lin_lum(wb)[..., None]
        wb = Lw + (wb - Lw) * KCHROMA
        lp = (view_meta or {}).get('lamp')
        if lp and not closeup:
            d = np.sqrt((u - lp['x']) ** 2 + ((v - lp['y']) * H / W) ** 2)
            w = np.clip(1 - d / 0.15, 0, 1)[..., None] ** 0.7 * 0.5          # 50 % of the lamp's own colour kept
            wb = wb * (1 - w) + lit * w
        out = to_srgb(wb)
        if fixtures:   # r3_kitchen_lit only: the two fixtures are the light source -> emissive diffusers + bloom σ 20
            fm = fixtures_mask(H, W)
            out = out * (1 - fm[..., None]) + np.array([250, 250, 246], np.float32) * fm[..., None]
            g = ndi.gaussian_filter(fm, 20)
            bl = (0.5 * g / max(1e-6, float(g.max())))[..., None]
            out = 255 - (255 - out) * (1 - bl)                             # screen-like glow round the diffusers
        if noise: out = out + noise_field((H, W), 3, seed)[..., None]
        return np.clip(out, 0, 255)
    if mode == 'sr_dim':
        lin = to_lin(a)
        vm = view_meta or {}
        ls = vm.get('lamp_sr')
        if ls:
            # AD fix: only the SHADE goes dark (it was the whole lamp_sr rectangle -> a hard box on the wallpaper).
            # Shade = pixels inside lamp_sr brighter than the rect's median luma + 25, dilated 3 px, feathered 2 px;
            # it becomes unlit white glass: 0.35 x the wall's linear luminance round the lamp, a little cool, keeping
            # a trace of its own shading. The lamp's spill (σ .12 bloom) is removed as before — no edges.
            x0, y0, x1, y1 = ls['x'], ls['y'], ls['x'] + ls['w'], ls['y'] + ls['h']
            rect = (u >= x0) & (u <= x1) & (v >= y0) & (v <= y1)
            Ls = lum(a)
            sh = rect & (Ls > np.median(Ls[rect]) + 25)
            lab, n = ndi.label(sh)
            if n:
                sz = ndi.sum(sh, lab, range(1, n + 1))
                sh = np.isin(lab, [i + 1 for i, s_ in enumerate(sz) if s_ >= 0.15 * sz.max()])
            sh = ndi.binary_fill_holes(ndi.binary_dilation(sh, iterations=3))
            sm = np.clip(ndi.gaussian_filter(sh.astype(np.float32), 1.2) * 1.15, 0, 1)
            Lc = lin_lum(lin)
            ring = ndi.binary_dilation(rect, iterations=40) & ~ndi.binary_dilation(rect, iterations=6)
            wall = float(np.median(Lc[ring]))
            wc = np.median(lin[ring], axis=0) / max(1e-6, wall)              # the room's own tint on white
            tint = (1 + (wc - 1) * 0.75) * np.array([0.97, 1.0, 1.06], np.float32)  # white glass, a little cooler
            tint = tint / float(tint @ np.array([0.2126, 0.7152, 0.0722], np.float32))
            ys_, xs_ = np.nonzero(sh)
            gx = np.clip((u * W - xs_.min()) / max(1, xs_.max() - xs_.min()), 0, 1)
            gy = np.clip((v * H - ys_.min()) / max(1, ys_.max() - ys_.min()), 0, 1)
            hp = Ls - ndi.gaussian_filter(Ls, 3.0)                              # the glass's rim / seam lines
            rel = (0.88 + 0.22 * gx - 0.18 * gy ** 2) * (1 + np.clip(hp / 60.0, -0.12, 0.12))   # night light from the right
            tone = (0.35 * wall * rel)[..., None] * tint
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            d = np.sqrt((u - cx) ** 2 + ((v - cy) * H / W) ** 2)
            bloom = np.exp(-(d ** 2) / (2 * 0.12 ** 2))                    # the lamp's own spill on desk / wall
            lin = lin * (1 - 0.65 * bloom)[..., None]
            # the shade is set after the spill removal: 0.35 x the lit wall ≈ the wall's own level once the lamp is off
            lin = lin * (1 - sm[..., None]) + tone * sm[..., None]
        nl = vm.get('nl', {'x': 1.05, 'y': 0.62})
        d = np.sqrt((u - nl['x']) ** 2 + (v - nl['y']) ** 2)
        M = 0.20 + 0.55 * np.exp(-(d ** 2) / (2 * 0.22 ** 2))
        lin = lin * M[..., None]
        lin = lin * np.array([1.06, 0.98, 0.80], np.float32)              # toward 2400 K
        out = to_srgb(lin)
        if noise: out = out + noise_field((H, W), 5, seed)[..., None]
        return np.clip(out, 0, 255)
    raise ValueError(mode)


def kitchen_gain(target=2.0):
    """§8.3-4 check 'mean luminance = 1.8–2.4x the night plate' read as the mean pixel luma (what the eye compares):
    the curve alone gives x1.73 in linear light (≈ x1.3 in pixel luma — not a lit kitchen). An exposure gain g in front
    of the curve is solved once on r3_kitchen (bisection, ¼-size, no bilateral) and used for every kitchen_lit image."""
    a = A(I(base_raw('r3_kitchen')).resize((256, 384), Image.LANCZOS))
    night = lum(view_grade_small(a)).mean()
    lo, hi = 1.0, 8.0
    for _ in range(18):
        g = (lo + hi) / 2
        r = lum(relight(a, 'kitchen_lit', M('r3_kitchen'), noise=False, gain=g, bil=False)).mean() / night
        if r < target: lo = g
        else: hi = g
    KLIT['gain'] = round((lo + hi) / 2, 3); KLIT['solved'] = True
    return KLIT['gain']


def view_grade_small(a):
    g = dict(GRADE['r3_kitchen']); g['noise'] = 0
    GRADE['_small'] = g
    return view_grade(a, '_small', noise=False)


def lin_mean(a):
    l = to_lin(a)
    return float((l[..., 0] * 0.2126 + l[..., 1] * 0.7152 + l[..., 2] * 0.0722).mean())


# ================================================================ measured coordinates (fractions of each source)
# Measured once by eye on grid overlays (qa_ep3.py grid / zoom) of the shipped takes — G01 retry 1, G02 retry 1,
# G03 take 1, G04 retry 1, G05 retry 1, G06 take 1 and the pass-2/3 takes; marked 'auto' where code detects it.
# Patch corridors (*_poly) were drawn on the BASE before the edits were extracted (§8.3-9). Re-measure after a regen.
MEAS = {
    'r3_door': {
        'led_door': {'x': 0.5525, 'y': 0.4675},                     # small status window under the blank lock panel
        'hook_rect': {'x': 0.307, 'y': 0.398, 'w': 0.030, 'h': 0.072},     # hook .40, collar to .45, bell .447-.465
        'srdoor_q': [[0.905, 0.125], [1.0, 0.105], [1.0, 0.79], [0.905, 0.765]],
        'hall_q': [[0.37, 0.62], [0.60, 0.62], [0.63, 0.70], [0.35, 0.70]],
        # G20 put the sleeping dog against the hallway's right wall beside Seah's door frame (x .53-.715 y .715-.82)
        'kongi_sleep_poly': [[0.50, 0.68], [0.765, 0.68], [0.765, 0.85], [0.50, 0.85]],
        # extraction corridor of G21 (its dog was ~2x too large) — the published kongi_door_poly is the box round the
        # rescaled dog (written by patches()); its rear paws land on the base's coir mat (x .372-.489, y .630-.658)
        '_kongi_door_src_poly': [[0.36, 0.52], [0.54, 0.52], [0.54, 0.675], [0.36, 0.675]],
        '_kongi_door_paw': [0.4268, 0.6536],
        'kongi_door_poly': [[0.3887, 0.5924], [0.4756, 0.5924], [0.4756, 0.666], [0.3887, 0.666]],
        # G31 retry 1: mom right of centre x .475-.64 y .355-.73, the mat clear to her left. The corridor's notch at
        # the lower left keeps it off kongi_door_poly (§8.2 G31); x3_mom_hall layers ABOVE x3_kongi_door anyway
        'mom_hall_poly': [[0.47, 0.34], [0.665, 0.34], [0.665, 0.755], [0.4903, 0.755], [0.4903, 0.585], [0.47, 0.585]],
        # renderer contract (AD fix): bottom -> top draw order of the r3_door overlays, and which overlay hides a DOM
        # point — led_door (.led3) lies under her back while x3_mom_hall is shown (alpha ≈ 1 there), so the LED dot
        # is hidden for that time (she stands between the camera and the lock)
        'z_order': ['x3_kongi_sleep', 'x3_kongi_door', 'x3_mom_hall', 'x3_hook_empty'],
        'occluders': {'led_door': ['x3_mom_hall']},
    },
    'r3_veranda': {
        'glass_q': [[0.165, 0.29], [0.94, 0.285], [0.94, 0.745], [0.165, 0.745]],
        'util_door': {'x': 0.03, 'y': 0.52},
        # windows across the courtyard (05:40 a · 05:55 b · 06:10 c): different floors / columns, measured on 0.5 % zooms
        'win_a_q': [[0.2845, 0.4765], [0.2990, 0.4765], [0.2990, 0.4875], [0.2845, 0.4875]],   # middle height, left
        'win_b_q': [[0.6000, 0.4360], [0.6180, 0.4360], [0.6180, 0.4475], [0.6000, 0.4475]],   # upper, middle
        'win_c_q': [[0.8550, 0.5605], [0.8685, 0.5605], [0.8685, 0.5720], [0.8550, 0.5720]],   # lower, right
    },
    'r3_sofa': {
        # blank disc on the right wall, turned away: face ellipse x .770-.825 y .245-.343 (its lit rim to .845)
        'clock_c': {'cx': 0.7975, 'cy': 0.2945, 'rx': 0.0275, 'ry': 0.0485, 'rot': 0.0},
        'jimin_poly': [[0.0, 0.53], [0.535, 0.53], [0.535, 0.745], [0.0, 0.745]],
        'outlet': {'x': 0.968, 'y': 0.758},
    },
    'r3_kitchen': {
        'cal_q': [[0.7665, 0.2245], [0.8065, 0.2165], [0.8015, 0.3735], [0.7585, 0.3730]],
        'ceil_glow': {'x': 0.60, 'y': 0.08},
        'lamp': {'x': 0.685, 'y': 0.405},
        'stove_rect': {'x': 0.33, 'y': 0.38, 'w': 0.16, 'h': 0.04},
        'pot_steam': {'x': 0.435, 'y': 0.383},
        # G18: mom x .38-.73 y .32-.80, chair to y .84, mug x .702-.757 y .485-.517, phone x .748-.813 y .505-.521
        'mom_table_poly': [[0.37, 0.31], [0.68, 0.31], [0.73, 0.44], [0.762, 0.475], [0.762, 0.5015], [0.7525, 0.5015],
                           [0.7525, 0.5245], [0.74, 0.70], [0.73, 0.86], [0.40, 0.86], [0.36, 0.62]],
        'phone_poly': [[0.7525, 0.5015], [0.819, 0.5015], [0.819, 0.5255], [0.7525, 0.5255]],
        # G30 sat the dog left of the chair looking up at her (x .16-.42 y .61-.82) — extraction corridor; the published
        # kongi_feet_poly = the box round the dog after the x0.75 rescale (written by patches())
        '_kongi_feet_src_poly': [[0.13, 0.565], [0.44, 0.565], [0.44, 0.835], [0.13, 0.835]],
        # G30's floor shadow / chair-leg edges pass the fur-hue test (light wood ≈ apricot): carved by hand on a 20 px
        # grid of the registered edit (below the haunch + right of the tucked front paws · the floor above the tail tip)
        '_kongi_feet_carve': [[[0.1367, 0.8464], [0.1367, 0.7975], [0.1953, 0.791], [0.2324, 0.8021], [0.2617, 0.8151],
                               [0.3369, 0.8164], [0.3633, 0.7956], [0.415, 0.7897], [0.4258, 0.7617], [0.4688, 0.7617],
                               [0.4688, 0.8464]],
                              [[0.1367, 0.7129], [0.21, 0.7129], [0.21, 0.7344], [0.1807, 0.7422], [0.1562, 0.7487],
                               [0.1367, 0.7487]]],
        'kongi_feet_poly': [[0.1777, 0.6556], [0.3945, 0.6556], [0.3945, 0.8353], [0.1777, 0.8353]],
        'table_q': [[0.395, 0.46], [0.86, 0.46], [0.905, 0.55], [0.35, 0.55]],
    },
    'r3_sr_desk': {
        'doily_rect': {'x': 0.61, 'y': 0.35, 'w': 0.15, 'h': 0.035},
        'manual_rect': {'x': 0.235, 'y': 0.425, 'w': 0.08, 'h': 0.07},
        'paper_rect': {'x': 0.355, 'y': 0.50, 'w': 0.13, 'h': 0.05},
        'lamp_sr': {'x': 0.075, 'y': 0.37, 'w': 0.11, 'h': 0.075},
        'nl': {'x': 1.10, 'y': 0.66},
    },
    'r3_sr_bed': {
        'frame_q': [[0.397, 0.148], [0.429, 0.143], [0.431, 0.741], [0.399, 0.737]],
        'frame_floor_y': 0.74, 'frame_head_y': 0.145,
        # G29 sat her on the near edge of the bed (x .62-.90 y .37-.84, feet on the floor)
        # AD fix: the edge at x .80 squared off her right shoulder / upper arm against the lace curtain -> widened to
        # .86 (the curtain is the same in the edit and the base, so the difference mask still takes only her shoulder)
        'mom_bed_poly': [[0.585, 0.33], [0.86, 0.33], [0.86, 0.47], [0.95, 0.52], [0.95, 0.68], [0.82, 0.875], [0.64, 0.875], [0.585, 0.70]],
        'window_rect': {'x': 0.78, 'y': 0.13, 'w': 0.22, 'h': 0.37},
        'door_out': {'x': 0.275, 'y': 0.14, 'w': 0.125, 'h': 0.60},
        'lamp_sr': None,
        'nl': {'x': 1.02, 'y': 0.60},
    },
    'c3_lockpanel': {'led_lock': {'x': 0.508, 'y': 0.614}},
    'c3_shoes': {'hook_rect_cu': {'x': 0.335, 'y': 0.105, 'w': 0.06, 'h': 0.18}},
    'c3_pot': {'burner_q': {'cx': 0.585, 'cy': 0.715, 'rx': 0.14, 'ry': 0.055}, 'steam_o': {'x': 0.70, 'y': 0.32}},
    'c3_manual': {'staff_q': [[0.108, 0.437], [0.905, 0.437], [0.905, 0.552], [0.108, 0.552]],
                  'print_q': [[0.135, 0.300], [0.885, 0.300], [0.885, 0.355], [0.135, 0.355]]},
    'c3_drawing': {'paper_q': [[0.153, 0.150], [0.880, 0.157], [0.886, 0.832], [0.131, 0.837]],
                   'corner_q': [[0.79, 0.74], [0.90, 0.74], [0.90, 0.85], [0.79, 0.85]]},
    'c3_doorframe': {'cu_cm': [182, 98], 'edge_x': 0.305, 'face_w': 0.395},
    'p3_kongi_1130': {'plate_old': [[0.826, 0.096], [0.848, 0.094], [0.848, 0.171], [0.826, 0.171]],
                      'hook_collar': {'x': 0.236, 'y': 0.245, 'w': 0.053, 'h': 0.165}},    # + the bell's shadow
    'p3_kongi_1213': {'hook_collar': {'x': 0.174, 'y': 0.285, 'w': 0.048, 'h': 0.14}},     # + the bell's shadow
}


def M(view):
    return MEAS[view]


# ================================================================ painted additions (fonts — never the model)
FONT_OK = {'brush': os.path.exists(FONT_BRUSH), 'gamja': os.path.exists(FONT_GAMJA)}


# stand-in hands (brush.ttf / gamja.ttf absent): two clearly different procedural hands from sans / sansb, so mom's
# '7 · 09.1.24' and Seah's 'ㅅㅇ 12 · 14.1.24' never read as one writer (AD finding; the real fonts remain the release
# requirement §10 J-99). mom = quick slanted pen, sansb, narrow, uneven size / baseline, wobbly strokes with a
# calligraphic thick-thin. Seah (12–18 = small, neat) = upright sans, rounded strokes, even size and baseline.
HANDS = {
    'brush': dict(font='bold', slant=0.24, rot=6.0, scale=(0.84, 1.10), jitter=0.10, wobble=1.4, sx=0.88, adv=(0.94, 1.06),
                  thick=(1, 2), round_=0.0),
    'gamja': dict(font='sans', slant=-0.03, rot=3.5, scale=(0.93, 1.05), jitter=0.05, wobble=0.85, sx=1.0, adv=(0.92, 1.02),
                  thick=(0, 1), round_=0.9),
}
DOTS = {'.': 'base', '·': 'mid'}


def _dot_glyph(ch, f, size, box):
    """a '.' / '·' as a round graphite dot (≈ 3.5–4 px at size 28 — the font's own dot all but vanished in pencil)."""
    g = Image.new('L', (box, box), 0)
    t0, b0 = f.getbbox('0')[1], f.getbbox('0')[3]
    r = max(1.6, 0.068 * size)
    cy = size // 3 + (b0 - r if DOTS[ch] == 'base' else (t0 + b0) / 2)
    cx = size // 2 + r + 0.5
    ImageDraw.Draw(g).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    return g, 2 * r + size * 0.36


def proc_hand_alpha(text, size, seed, who='gamja'):
    """stand-in hand: glyphs from sans / sansb, each rotated / scaled / dropped a little per the HANDS row, sheared,
    then warped by a smooth random field (no two strokes straight) — coverage 0..1 on its own card. Compatibility
    jamo (ㅅ ㅇ) are drawn 1.2x and barely rotated (a rotated small ㅅ read as 'λ')."""
    hp = HANDS[who]
    rng = np.random.default_rng(seed)
    f = ImageFont.truetype(FONT_BOLD if hp['font'] == 'bold' else FONT_SANS, size)
    W = int(size * (len(text) * 1.1 + 2)); H = int(size * 2.0)
    lay = Image.new('L', (W, H), 0)
    x = size * 0.5
    for ch in text:
        jamo = 'ㄱ' <= ch <= 'ㆎ'
        if ch in DOTS:
            g, adv = _dot_glyph(ch, f, size, size * 2)
        else:
            g = Image.new('L', (size * 2, size * 2), 0)
            ImageDraw.Draw(g).text((size // 2, size // 3), ch, font=f, fill=255)
            adv = ImageDraw.Draw(lay).textlength(ch, font=f) if ch != ' ' else size * 0.32
            th = int(rng.integers(hp['thick'][0], hp['thick'][1] + 1))
            if th:   # pen pressure: thicken vertically only (thick downstrokes, thin cross strokes)
                ga = A(g); ga = np.maximum(ga, np.roll(ga, th, 0)); g = I(ga)
            if hp['round_']:   # rounded felt / soft pencil: blur + re-threshold rounds the stroke ends
                ga = ndi.gaussian_filter(A(g), hp['round_'] * size / 28)
                g = I(np.clip((ga - 60) * 1.6, 0, 255))
        rot = hp['rot'] * (0.35 if jamo else 1.0)
        g = g.rotate(float(rng.uniform(-rot, rot)), resample=Image.BICUBIC)
        sc = float(rng.uniform(*hp['scale'])) * (1.2 if jamo else 1.0)
        g = g.resize((max(1, int(g.width * sc * hp['sx'])), max(1, int(g.height * sc))), Image.BICUBIC)
        dy = int(rng.uniform(-hp['jitter'], hp['jitter']) * size) - (int(size * 0.08) if jamo else 0)
        lay.paste(g, (int(x - size * 0.5 * hp['sx']), int(H * 0.5 - g.height * 0.45) + dy), g)
        x += adv * float(rng.uniform(*hp['adv'])) * hp['sx'] * (1.15 if jamo else 1.0)
    lay = lay.crop((0, 0, min(W, int(x + size * 0.6)), H))
    sl = hp['slant']
    if sl: lay = lay.transform(lay.size, Image.AFFINE, (1, sl, -sl * H * 0.5, 0, 1, 0), Image.BICUBIC)
    a = A(lay) / 255.0
    hh, ww = a.shape
    wob = hp['wobble']
    dy_ = ndi.gaussian_filter(rng.normal(0, 1, (hh, ww)), size * 0.35) * wob * size * 0.9
    dx_ = ndi.gaussian_filter(rng.normal(0, 1, (hh, ww)), size * 0.35) * wob * size * 0.9
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    a = ndi.map_coordinates(a, [yy + dy_, xx + dx_], order=1, mode='constant')
    return np.clip(a, 0, 1)


def hand_card(text, who, size, seed):
    """coverage card (0..1, tight box) of `text` in mom's ('brush') or Seah's ('gamja') hand."""
    path = FONT_BRUSH if who == 'brush' else FONT_GAMJA
    if FONT_OK[who]:
        f = ImageFont.truetype(path, size)
        rng = np.random.default_rng(seed)
        W = int(size * (len(text) * 0.9 + 2)); H = int(size * 2.0)
        lay = Image.new('L', (W, H), 0); d = ImageDraw.Draw(lay)
        x = size * 0.4
        for ch in text:
            yo = H * 0.25 + rng.uniform(-0.05, 0.05) * size
            if ch in DOTS:   # the font's own dot is too small for a pencil date
                g, adv = _dot_glyph(ch, f, size, size * 2)
                lay.paste(g, (int(x - size // 2), int(yo - size // 3)), g)
                x += adv; continue
            d.text((x, yo), ch, font=f, fill=255)
            x += d.textlength(ch, font=f) * float(rng.uniform(0.96, 1.04))
        a = A(lay) / 255.0
    else:
        a = proc_hand_alpha(text, size, seed, who)
    ys, xs = np.nonzero(a > 0.05)
    if not len(ys): return a
    return a[max(0, ys.min() - 2):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3]


def paint_alpha(base, a, xy, color, opacity=1.0, tex=None, mode='multiply'):
    """lay a coverage card `a` at xy (top-left px) onto float RGB base."""
    H, W = base.shape[:2]
    x0, y0 = int(round(xy[0])), int(round(xy[1]))
    h, w = a.shape
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(W, x0 + w), min(H, y0 + h)
    if xb <= xa or yb <= ya: return base
    al = a[ya - y0:yb - y0, xa - x0:xb - x0] * opacity
    if tex is not None: al = al * tex[ya:yb, xa:xb]
    al = al[..., None]
    c = np.array(color, np.float32)
    reg = base[ya:yb, xa:xb]
    if mode == 'multiply': base[ya:yb, xa:xb] = reg * (1 - al + al * c / 255.0)
    else: base[ya:yb, xa:xb] = reg * (1 - al) + c * al
    return base


def grain_mask(a, sigma=2.0, lo=0.35, hi=1.0, seed=3):
    """paint / paper tooth: high-pass of the image itself + fine noise, 0..1 (pencil and crayon skip the valleys)."""
    L = lum(a)
    hp = L - ndi.gaussian_filter(L, sigma)
    hp = (hp - np.percentile(hp, 2)) / max(1e-6, np.percentile(hp, 98) - np.percentile(hp, 2))
    nz = np.random.default_rng(seed).random(L.shape)
    g = np.clip(0.55 * hp + 0.45 * nz, 0, 1)
    return lo + (hi - lo) * g


# heights of the 12 pencil lines (§8.3-6 ③ — cm, birthday measurements, bottom -> top) and their writing
HEIGHTS = [(7, 122.0, 'brush', '7 · 09.1.24'), (8, 127.0, 'brush', '8 · 10.1.24'), (9, 133.0, 'brush', '9 · 11.1.24'),
           (10, 138.0, 'brush', '10 · 12.1.24'), (11, 144.0, 'brush', '11 · 13.1.24'),
           (12, 150.0, 'gamja', 'ㅅㅇ 12 · 14.1.24'), (13, 155.0, 'gamja', 'ㅅㅇ 13 · 15.1.24'),
           (14, 158.0, 'gamja', 'ㅅㅇ 14 · 16.1.24'), (15, 159.5, 'gamja', 'ㅅㅇ 15 · 17.1.24'),
           (16, 160.5, 'gamja', 'ㅅㅇ 16 · 18.1.24'), (17, 161.0, 'gamja', 'ㅅㅇ 17 · 19.1.24'),
           (18, 161.5, 'gamja', 'ㅅㅇ 18 · 20.1.24')]
GRAPHITE = (82, 82, 90)


def boxes_intersect(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def doorframe_marks(a, meta):
    """c3_doorframe: 12 pencil lines + dates baked on the white wood (y = cu_cm linear: top 182 cm, bottom 98 cm).
    Every date is written after its line's end (mom 7–11, size 30; Seah 12–18, small and neat, size 25). From 13 on the
    lines are 0.5–5 cm apart, so those labels are spread vertically (1-D relaxation, no box overlap) into one column a
    little right of the cluster's longest line, and each displaced label gets a short 1 px pencil leader back to its
    own line's end (AD fix: '18' sat 46 px above its line and read as a 19th mark). The doorway's dark opening is left
    of the wood, so no label can sit left of a line start, and there is no room for a second column on the casing
    (x ≤ edge + face_w; the wallpaper starts there). QA: box intersections = 0, leader x label-box crossings = 0."""
    H, W = a.shape[:2]
    top, bot = meta['cu_cm']
    ycm = lambda cm: (top - cm) / (top - bot) * H
    x0 = (meta['edge_x'] + 0.012) * W
    face = meta['face_w'] * W
    xmax = (meta['edge_x'] + meta['face_w']) * W - 4
    tex = grain_mask(a, 1.5, 0.45, 1.0, seed=11)
    rng = np.random.default_rng(24)
    lines_out, labels_out, ends, cards = [], [], [], []
    for i, (age, cm, who, txt) in enumerate(HEIGHTS):
        y = ycm(cm)
        L = face * float(rng.uniform(0.50, 0.56))
        ang = math.radians(float(rng.uniform(-1.2, 1.2)))
        n = int(L)
        xs = x0 + np.arange(n); ys = y + np.tan(ang) * np.arange(n)
        line = np.zeros((H, W), np.float32)
        for xx_, yy_ in zip(xs, ys):
            xi, yi = int(xx_), int(round(yy_))
            if 0 <= xi < W and 1 <= yi < H - 2:
                p = 0.75 + 0.25 * math.sin(xx_ * 0.05 + i)
                line[yi - 1:yi + 2, xi] = np.array([0.55, 1.0, 0.6]) * p
        line = ndi.gaussian_filter(line, 0.6)
        a = paint_alpha(a, line, (0, 0), GRAPHITE, 0.78, tex)
        lines_out.append({'age': age, 'cm': cm, 'y': round(y / H, 4), 'x0': round(x0 / W, 4), 'x1': round((x0 + L) / W, 4)})
        ends.append((x0 + L, y + math.tan(ang) * L, math.tan(ang)))
        size = 30 if who == 'brush' else 25
        cards.append(hand_card(txt, who, size, seed=100 + age))
    # vertical layout: each label centred on its line's end, then pushed apart until no two boxes overlap
    cy = [e[1] for e in ends]
    hs = [c.shape[0] for c in cards]
    for _ in range(400):
        moved = False
        order = sorted(range(len(cy)), key=lambda k: cy[k])
        for u_, v_ in zip(order, order[1:]):
            need = (hs[u_] + hs[v_]) / 2 + 3
            gap = cy[v_] - cy[u_]
            if gap < need:
                sh = (need - gap) / 2 + 0.01
                cy[u_] -= sh; cy[v_] += sh; moved = True
        if not moved: break
    moved_ = [abs(cy[i] - ends[i][1]) > 1.0 for i in range(len(cy))]
    grp = [i for i in range(len(cy)) if moved_[i]]
    gmax = max([ends[i][0] for i in grp], default=0)
    col = gmax + 26                                            # the cluster's label column (leaders live left of it)
    placed, leaders = [], np.zeros((H, W), np.float32)
    leader_segs = []
    for i, (age, cm, who, txt) in enumerate(HEIGHTS):
        card = cards[i]
        ch_, cw_ = card.shape
        y0_, y1_ = cy[i] - ch_ / 2, cy[i] + ch_ / 2
        if moved_[i]:
            xs0 = col
        else:   # start after the longest line end within the label's vertical span (no label over a line)
            xs0 = max([ends[k][0] for k in range(len(ends)) if y0_ - 4 <= ends[k][1] <= y1_ + 4] + [ends[i][0]]) + 8
        room = xmax - xs0
        if cw_ > room:                                         # fit on the casing (narrow the hand, keep the height)
            card = A(Image.fromarray((card * 255).astype(np.uint8)).resize((max(8, int(room)), ch_), Image.LANCZOS)) / 255.0
            cw_ = card.shape[1]
        box = (xs0, y0_, xs0 + cw_, y1_)
        placed.append(box)
        a = paint_alpha(a, card, (xs0, y0_), GRAPHITE if who == 'gamja' else (70, 72, 84), 0.82, tex)
        dy = cy[i] - ends[i][1]
        if moved_[i] and abs(dy) > 4:
            # leader: the line's own end -> along its slope to just past the cluster's longest line -> the label
            ex, ey, sl = ends[i]
            pts = [(ex + 2, ey), (gmax + 5, ey + sl * (gmax + 5 - ex)), (col - 4, cy[i])]
            leader_segs.append((i, pts))
            cv = Image.new('L', (W * 2, H * 2), 0)
            ImageDraw.Draw(cv).line([(x_ * 2, y_ * 2) for x_, y_ in pts], fill=255, width=2, joint='curve')
            lay = A(cv.resize((W, H), Image.LANCZOS)) / 255.0
            leaders = np.maximum(leaders, lay)
        labels_out.append({'age': age, 'hand': who, 'text': txt, 'box': [round(box[0] / W, 4), round(box[1] / H, 4),
                                                                          round(box[2] / W, 4), round(box[3] / H, 4)],
                           'dy_px': round(dy, 1), 'leader': bool(moved_[i] and abs(dy) > 4)})
    a = paint_alpha(a, ndi.gaussian_filter(leaders, 0.35), (0, 0), GRAPHITE, 0.62, tex)
    inter = sum(boxes_intersect(placed[i], placed[j]) for i in range(len(placed)) for j in range(i + 1, len(placed)))
    cross = 0
    for i, pts in leader_segs:      # a leader may not run through any label box
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            for t in np.linspace(0, 1, 40):
                px_, py_ = xa + (xb - xa) * t, ya + (yb - ya) * t
                cross += any(b[0] <= px_ <= b[2] and b[1] <= py_ <= b[3] for b in placed)
    return a, lines_out, labels_out, inter, cross


def frame_small_marks(a, meta):
    """r3_sr_bed: the same 12 lines, small, in frame_q perspective (floor 0 cm · head 210 cm); dates = 3 px grey scratches."""
    H, W = a.shape[:2]
    q = q_px(meta['frame_q'], W, H)
    fy, hy = meta['frame_floor_y'] * H, meta['frame_head_y'] * H
    rng = np.random.default_rng(24)
    lay = np.zeros((H, W), np.float32)
    for i, (age, cm, who, txt) in enumerate(HEIGHTS):
        y = fy + (hy - fy) * cm / 210.0
        t = (y - q[0][1]) / max(1, (q[3][1] - q[0][1]))
        xl = q[0][0] + (q[3][0] - q[0][0]) * t; xr = q[1][0] + (q[2][0] - q[1][0]) * t
        L = (xr - xl) * float(rng.uniform(0.50, 0.60))
        yi = int(round(y))
        x0i, x1i = int(xl + 1), int(xl + 1 + L)
        lay[yi, x0i:x1i] = 0.9
        # the date as a short grey scratch right of the line (or above it), 3 px tall
        sx0, sx1 = x1i + 1, min(int(xr), x1i + 1 + int(L * 0.8))
        if sx1 > sx0:
            sc = (rng.random(sx1 - sx0) > 0.35).astype(np.float32) * 0.55
            lay[yi - 2:yi + 1, sx0:sx1] = np.maximum(lay[yi - 2:yi + 1, sx0:sx1], sc[None, :])
    lay = ndi.gaussian_filter(lay, 0.45)
    tex = grain_mask(a, 1.2, 0.6, 1.0, seed=5)
    _RAW['frame_cov'] = lay * tex
    return paint_alpha(a, lay, (0, 0), GRAPHITE, 0.85, tex)


def clock_numerals(a, c):
    """r3_sofa: numerals 1–12 on the blank clock face (sans.ttf · (60,60,64) · height .17r · on radius .78r · the
    face's perspective ellipse rx/ry · blur .4 px). Hands are DOM (§8.3-5)."""
    H, W = a.shape[:2]
    cx, cy, rx, ry = c['cx'] * W, c['cy'] * H, c['rx'] * W, c['ry'] * H
    r = max(rx, ry)
    gh = 0.17 * r
    fsz = max(6, int(gh / 0.72))
    f = ImageFont.truetype(FONT_SANS, fsz)
    lay = Image.new('L', (W, H), 0); d = ImageDraw.Draw(lay)
    sx = rx / r                                    # foreshortening (the face turns away horizontally)
    for k in range(1, 13):
        ang = math.radians(k * 30 - 90)
        px = cx + 0.78 * rx * math.cos(ang); py = cy + 0.78 * ry * math.sin(ang)
        g = Image.new('L', (fsz * 3, fsz * 2), 0)
        ImageDraw.Draw(g).text((fsz * 1.5, fsz), str(k), font=f, fill=255, anchor='mm')
        g = g.resize((max(1, int(g.width * sx)), g.height), Image.BICUBIC)
        lay.paste(g, (int(px - g.width / 2), int(py - g.height / 2)), g)
    al = ndi.gaussian_filter(A(lay) / 255.0, 0.4)
    return paint_alpha(a, al, (0, 0), (60, 60, 64), 0.92, None, mode='normal')


# ================================================================ patch extraction (§8.3-2)
def extract(E, B, poly, key, carve=(), thr=6.0, grow=6, feather=4, min_area=300, ring=24, tone_fit=True, close=0,
            rgb=False):
    """E = edit (PIL), B = base (float RGB array). Returns (alpha HxW 0..1, Er = E registered onto B, colour-matched).
    d = |L(E) − L(B)| > thr inside the corridor polygon only (0 outside — whatever else the model changed is dropped),
    small specks removed, grown 6 px, holes filled, feathered 4 px; E is normalised per channel to B's mean / std on a
    24 px ring just outside the change (no brightness jump).
    Person patches (close=12, rgb=True): d = max(ΔL, RGB distance / √3) — dark-grey trousers over a grey cushion are
    near-equal in L only — and a binary closing before the hole fill, so a gap that opens to the mask's outside (a
    see-through ring inside the legs) is closed too; still clipped to the corridor."""
    H, W = B.shape[:2]
    Ei = E if E.size == (W, H) else E.resize((W, H), Image.LANCZOS)
    field = register(Ei, I(B), key=key)
    Er = warp(Ei, field)
    cor = poly_mask((W, H), q_px(poly, W, H)) > 0.5
    # global tone match first (the edit's overall exposure / white balance drift must not count as a change):
    # per-channel linear fit of E -> B on a 60 px band around the corridor
    band = ndi.binary_dilation(cor, iterations=60) & ~ndi.binary_dilation(cor, iterations=8)
    tone = []
    if tone_fit and band.sum() > 500:
        for c in range(3):
            xs_, ys_ = Er[..., c][band], B[..., c][band]
            k_, b_ = np.polyfit(xs_, ys_, 1)
            k_ = float(np.clip(k_, 0.85, 1.15)); b_ = float(np.clip(b_, -20, 20))
            Er[..., c] = Er[..., c] * k_ + b_; tone.append((round(k_, 3), round(b_, 1)))
    d = np.abs(lum(Er) - lum(B))
    if rgb: d = np.maximum(d, np.sqrt(((Er - B) ** 2).sum(-1) / 3.0))
    d = ndi.gaussian_filter(d, 1.0)
    for c in carve: cor &= ~(poly_mask((W, H), q_px(c, W, H)) > 0.5)
    m = (d > thr) & cor
    m = ndi.binary_opening(m, iterations=2)
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, [i + 1 for i, s_ in enumerate(sizes) if s_ >= min_area])
    m = ndi.binary_dilation(m, iterations=grow)
    if close:
        pad = close + 2                                     # pad so the closing does not erode at the frame edge
        m = ndi.binary_closing(np.pad(m, pad), iterations=close)[pad:-pad, pad:-pad]
    m = ndi.binary_fill_holes(m) & cor
    rg = ndi.binary_dilation(m, iterations=ring) & ~ndi.binary_dilation(m, iterations=3) & cor
    if rg.sum() > 200:
        for c in range(3):
            se, sb = Er[..., c][rg], B[..., c][rg]
            k = float(np.clip((sb.std() + 1e-3) / (se.std() + 1e-3), 0.85, 1.18))
            Er[..., c] = (Er[..., c] - se.mean()) * k + sb.mean()
    corf = ndi.gaussian_filter(cor.astype(np.float32), 1.5)
    alpha = np.clip(ndi.gaussian_filter(m.astype(np.float32), feather) * 1.15, 0, 1) * corf
    alpha[alpha < 0.02] = 0
    QA['patch_' + key] = f'{m.mean() * 100:.2f} % of the frame changed inside the corridor, ring {int(rg.sum())} px, tone fit {tone}'
    return alpha, np.clip(Er, 0, 255)


def seam_check(key, base_graded, patch_rgb, alpha):
    """§8.3-2 ⑥: mean |Δ| between patch-over-base and base on the 3 px band at the alpha edge (should be small: the
    feathered edge sits on unchanged pixels)."""
    band = (alpha > 0.02) & (alpha < 0.5)
    if band.sum() < 10: return
    comp = base_graded * (1 - alpha[..., None]) + patch_rgb * alpha[..., None]
    dE = np.abs(comp - base_graded)[band].mean()
    QA['seam_' + key] = f'edge band mean |Δ| {dE:.2f} (0–255)'


def rgba(rgb, alpha):
    a = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255])
    a[alpha <= 0.004, :3] = 0
    return I(a, 'RGBA')


# ---------------------------------------------------------------- the dog only, rescaled (AD fix: G21 / G30 drew kongi
# about 2x / 1.4x too large for a toy poodle at that depth — re-extracted on fur hue and scaled about its paws)
def fur_mask(E, al, thr=30.0, lmin=24.0, carve=(), erode=0):
    """apricot fur (R − B > thr, L > lmin) inside the difference mask; the edit's own mat (dark coir, R − B ≈ 21,
    L ≈ 21) is dropped by the test, a floor the test cannot tell from fur by `carve` polygons (fractions).
    Largest blob, small gaps closed, holes filled."""
    L = lum(E)
    H, W = L.shape
    m = ((E[..., 0] - E[..., 2]) > thr) & (L > lmin) & (al > 0.3)
    for c in carve: m &= ~(poly_mask((W, H), q_px(c, W, H)) > 0.5)
    m = ndi.binary_opening(m, iterations=1)
    lab, n = ndi.label(m)
    if n:
        sz = ndi.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sz)))
    m = ndi.binary_fill_holes(ndi.binary_closing(np.pad(m, 6), iterations=3)[6:-6, 6:-6])
    return ndi.binary_erosion(m, iterations=erode) if erode else m


def paw_anchor(m):
    """bottom-centre (px) of a mask's lowest 6 rows."""
    ys, xs = np.nonzero(m)
    yb = int(ys.max()); sel = ys >= yb - 5
    return float(xs[sel].mean()), float(yb)


def scale_layer(rgb, a, src, dst, s, size):
    """premultiplied LANCZOS scale of an RGB + alpha layer by s, the point src (px) landing on dst (px), on a canvas
    of `size`. Returns (premultiplied rgb, alpha) full canvas."""
    W, H = size
    ys, xs = np.nonzero(a > 0.004)
    bx0, by0 = max(0, xs.min() - 4), max(0, ys.min() - 4)
    bx1, by1 = min(W, xs.max() + 5), min(H, ys.max() + 5)
    w, h = bx1 - bx0, by1 - by0
    nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
    sub_a = a[by0:by1, bx0:bx1]
    chans = [rgb[by0:by1, bx0:bx1, c] * sub_a for c in range(3)] + [sub_a]
    rs = [A(Image.fromarray(ch.astype(np.float32), 'F').resize((nw, nh), Image.LANCZOS)) for ch in chans]
    ox = int(round(dst[0] - (src[0] - bx0) * nw / w)); oy = int(round(dst[1] - (src[1] - by0) * nh / h))
    pm = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
    xa, ya = max(0, ox), max(0, oy); xb, yb = min(W, ox + nw), min(H, oy + nh)
    for c in range(3): pm[ya:yb, xa:xb, c] = rs[c][ya - oy:yb - oy, xa - ox:xb - ox]
    al[ya:yb, xa:xb] = rs[3][ya - oy:yb - oy, xa - ox:xb - ox]
    al = np.clip(al, 0, 1); pm = np.clip(pm, 0, 255 * al[..., None])
    return pm, al


def contact_shadow(al, size, strength=0.25, blur=6):
    """soft ellipse under the paws of a placed layer: centre = its lowest rows, rx = 0.55 x their width."""
    W, H = size
    ys, xs = np.nonzero(al > 0.5)
    h = ys.max() - ys.min()
    band = ys >= ys.max() - max(4, int(0.18 * h))
    cx, cy = float(xs[band].mean()), float(ys.max()) - 3
    rx = max(8.0, 0.55 * (xs[band].max() - xs[band].min())); ry = max(3.0, 0.22 * rx)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    e = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1).astype(np.float32)
    return np.clip(ndi.gaussian_filter(e, blur) * strength, 0, 1), (cx, cy, rx, ry)


def alpha_box(a, pad=4, thr=0.02):
    """4-point polygon (fractions) round a patch's alpha > thr, padded."""
    H, W = a.shape
    ys, xs = np.nonzero(a > thr)
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad); y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    return [[round(x0 / W, 4), round(y0 / H, 4)], [round(x1 / W, 4), round(y0 / H, 4)],
            [round(x1 / W, 4), round(y1 / H, 4)], [round(x0 / W, 4), round(y1 / H, 4)]]


def dog_layer(Bv, E, al, s, dst=None, src=None, key='', carve=(), erode=0):
    """(comp, alpha): the fur-masked dog of the registered edit E scaled by s about its paws, a contact shadow under it,
    laid on Bv (ungraded); alpha = dog ∪ shadow footprint (outside it the base / layers below show)."""
    H, W = al.shape
    m = fur_mask(E, al, carve=carve, erode=erode)
    a_d = np.clip(ndi.gaussian_filter(m.astype(np.float32), 0.8) * 1.1, 0, 1)
    src = src or paw_anchor(m)
    dst = dst or src
    pm, a_s = scale_layer(E, a_d, src, dst, s, (W, H))
    sh, ell = contact_shadow(a_s, (W, H))
    comp = Bv * (1 - sh[..., None])
    comp = comp * (1 - a_s[..., None]) + pm
    alpha = np.clip(np.maximum(a_s, sh * 4.0), 0, 1)
    ys, xs = np.nonzero(a_s > 0.5)
    QA['dog_' + key] = (f'fur mask {int(m.sum())} px scaled x{s} about paws {tuple(round(v) for v in src)} -> '
                        f'{tuple(round(v) for v in dst)}; dog now {xs.max() - xs.min() + 1}x{ys.max() - ys.min() + 1} px '
                        f'(x {xs.min()}–{xs.max()}, y {ys.min()}–{ys.max()}); contact shadow ellipse '
                        f'{tuple(round(v) for v in ell)} alpha .25 blur 6')
    return comp, alpha


# ================================================================ base sources with their baked paint (cached)
VIEWS = {'r3_door': 'g_r3_door', 'r3_veranda': 'g_r3_veranda', 'r3_sofa': 'g_r3_sofa', 'r3_kitchen': 'g_r3_kitchen',
         'r3_sr_desk': 'g_r3_sr_desk', 'r3_sr_bed': 'g_r3_sr_bed'}
_RAW = {}


SR_BED_EXPO = dict(ev=-0.40, fall=-0.80, cx=1.10, cy=1.05, r=1.25)


def sr_bed_expo(a, p=SR_BED_EXPO):
    """AD fix: G06 (Seah's room B) came out ≈ +40 % brighter than G05 (A) in the same lighting state. −0.4 EV plus a
    gentle radial falloff away from the lower right (the desk lamp is behind the camera, to the right), in linear
    light, so both views of the small room sit within ±15 % mean luma. Applied to G06 and to every edit of it (G29)
    before extraction, so the patch keeps matching its base."""
    H, W = a.shape[:2]
    u, v = uv(H, W)
    d = np.clip(np.sqrt((u - p['cx']) ** 2 + ((v - p['cy']) * H / W) ** 2) / p['r'], 0, 1)
    ev = p['ev'] + p['fall'] * d ** 1.5
    return to_srgb(to_lin(a) * (2.0 ** ev)[..., None])


def base_raw(view):
    """ungraded source of a view with the paint that belongs to the room itself (clock numerals, pencil lines)."""
    if view in _RAW: return _RAW[view].copy()
    a = A(S(VIEWS[view]))
    if view == 'r3_sofa': a = clock_numerals(a, M('r3_sofa')['clock_c'])
    if view == 'r3_sr_bed': a = sr_bed_expo(frame_small_marks(a, M('r3_sr_bed')))
    _RAW[view] = a
    return a.copy()


def mom_patch_raw():
    """(alpha, Er) of x3_mom_table + phone from G18 on G04 — shared by the patches, the lit version and ref_kitchen_mom."""
    if 'mom' in _RAW: return _RAW['mom']
    B = base_raw('r3_kitchen'); m = M('r3_kitchen')
    E = S('g_x3_mom_table')
    al_m, Er = extract(E, B, m['mom_table_poly'], 'x3_mom_table', carve=[m['phone_poly']], close=12, rgb=True)
    al_p, _ = extract(E, B, m['phone_poly'], 'x3_phone_down', min_area=40, grow=3, feather=2, tone_fit=False)
    _RAW['mom'] = (al_m, al_p, Er)
    return _RAW['mom']


def pass3_refs():
    """prep_ep3.py 3: ref_mom (G18 crop round the woman — hair, shoulders, cardigan — upscaled to 1024x1536) and
    ref_kitchen_mom (G04 with the extracted x3_mom_table patch laid on, ungraded — the base G30 edits)."""
    os.makedirs(GEN, exist_ok=True)
    E = S('g_x3_mom_table'); W, H = E.size
    box = (int(0.335 * W), int(0.30 * H), int(0.765 * W), int(0.30 * H + 0.43 * W * 1.5))   # 2:3 around head + back
    E.crop(box).resize((1024, 1536), Image.LANCZOS).save(os.path.join(GEN, 'ref_mom.png'))
    B = base_raw('r3_kitchen')
    al_m, al_p, Er = mom_patch_raw()
    al = np.maximum(al_m, al_p)[..., None]
    comp = B * (1 - al) + Er * al
    I(comp).save(os.path.join(GEN, 'ref_kitchen_mom.png'))
    print('ref_mom', box, '· ref_kitchen_mom (G04 + x3_mom_table + x3_phone_down)')


# ================================================================ steps
STEPS = []


def step(fn):
    STEPS.append(fn)
    return fn


def vmeta(view):
    return {k: v for k, v in M(view).items() if not k.startswith('_')}


def pick_windows(a, targets, region=None):
    """dark facade windows nearest each target (fractions): local-dark rectangles (lum below a 25 px median by 8+),
    labelled, 6–40 px wide, aspect 0.6–3; returns {name: quad} (TL,TR,BR,BL fractions)."""
    H, W = a.shape[:2]
    L = lum(a)
    loc = ndi.median_filter(L, size=25)
    dark = (L < loc - 6)
    if region is not None:
        rm = np.zeros_like(dark); x0, y0, x1, y1 = region
        rm[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True; dark &= rm
    dark = ndi.binary_opening(dark, iterations=1)
    lab, n = ndi.label(dark)
    objs = ndi.find_objects(lab)
    cands = []
    for i, sl in enumerate(objs):
        if sl is None: continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 6 <= w <= 60 and 5 <= h <= 60 and 0.5 <= w / h <= 3.2 and (lab[sl] == i + 1).mean() > 0.55:
            cands.append(((sl[1].start + sl[1].stop) / 2 / W, (sl[0].start + sl[0].stop) / 2 / H, sl))
    out = {}
    for name, (tx, ty) in targets.items():
        best = min(cands, key=lambda c: (c[0] - tx) ** 2 + ((c[1] - ty) * H / W) ** 2) if cands else None
        if best is None: continue
        sl = best[2]
        x0, x1, y0, y1 = sl[1].start, sl[1].stop, sl[0].start, sl[0].stop
        out[name] = [[round(x0 / W, 4), round(y0 / H, 4)], [round(x1 / W, 4), round(y0 / H, 4)],
                     [round(x1 / W, 4), round(y1 / H, 4)], [round(x0 / W, 4), round(y1 / H, 4)]]
    return out


@step
def bases():
    for view, src in VIEWS.items():
        a = base_raw(view)
        g = view_grade(a, view)
        jpg(I(g), view, 82, 360); mark(view, src)
        META[view] = vmeta(view)
    # 05:30 ceiling light (§8.3-4 kitchen_lit)
    k = base_raw('r3_kitchen')
    g_ = kitchen_gain(2.0)
    lit = relight(k, 'kitchen_lit', M('r3_kitchen'), seed=41, fixtures=True)
    jpg(I(lit), 'r3_kitchen_lit', 84, 360); mark('r3_kitchen_lit', 'g_r3_kitchen')
    night = view_grade(k, 'r3_kitchen')
    u_, v_ = uv(*lit.shape[:2])
    wall = (u_ > 0.22) & (u_ < 0.30) & (v_ > 0.25) & (v_ < 0.50) & (lum(lit) < 250)      # ivory wall between fridge and kitchen
    rb = lambda z, msk=None: float(z[..., 0][msk].mean() / z[..., 2][msk].mean()) if msk is not None else float(z[..., 0].mean() / z[..., 2].mean())
    QA['kitchen_lit'] = (f'mean pixel luma x{lum(lit).mean() / lum(night).mean():.2f} of the night plate (target 1.8–2.4), '
                         f'linear x{lin_mean(lit) / max(1e-6, lin_mean(night)):.2f}; exposure gain {g_} before the §8.3-4 curve; '
                         f'mean R/B {rb(lit):.2f} (night {rb(night):.2f}, target ≤ 1.45) · ivory wall R/B {rb(lit, wall):.2f} '
                         f'(target 1.1–1.2) · WB {KWB.tolist()} chroma x{KCHROMA} · fixtures emissive (250,250,246) + bloom σ 20')
    # 03:35–05:05 Seah's room on the night light (§8.3-4 sr_dim)
    dims = {}
    for view in ('r3_sr_desk', 'r3_sr_bed'):
        d = relight(base_raw(view), 'sr_dim', M(view), seed=43)
        jpg(I(d), view + '_dim', 86, 360); mark(view + '_dim', VIEWS[view])
        dims[view] = float(lum(d).mean())
    lit_ = {v: float(lum(view_grade(base_raw(v), v)).mean()) for v in ('r3_sr_desk', 'r3_sr_bed')}
    QA['sr_views_exposure'] = (f"mean luma B/A: lamp-on {lit_['r3_sr_bed']:.0f}/{lit_['r3_sr_desk']:.0f} = "
                               f"{lit_['r3_sr_bed'] / lit_['r3_sr_desk']:.2f} · dim {dims['r3_sr_bed']:.0f}/{dims['r3_sr_desk']:.0f} = "
                               f"{dims['r3_sr_bed'] / dims['r3_sr_desk']:.2f} (target within ±15 %; r3_sr_bed graded "
                               f"{SR_BED_EXPO['ev']} EV + radial falloff {SR_BED_EXPO['fall']} EV from the lower right)")
    # pencil-line contrast in the dim bed view (≥ 1.4:1, so the lines are still visible at 03:35–05:05)
    bd = relight(base_raw('r3_sr_bed'), 'sr_dim', M('r3_sr_bed'), seed=43, noise=False)
    bn = relight(sr_bed_expo(A(S('g_r3_sr_bed'))), 'sr_dim', M('r3_sr_bed'), seed=43, noise=False)
    cov = _RAW.get('frame_cov')
    if cov is not None:
        core = cov > 0.45
        Ll = float(to_lin(lum(bd)[core]).mean()); Lp = float(to_lin(lum(bn)[core]).mean())
        QA['sr_bed_dim_pencil_contrast'] = (f'{Lp / max(1e-6, Ll):.2f}:1 paint vs line (linear luminance, line core px {int(core.sum())}, '
                                            f'target ≥ 1.4) in r3_sr_bed_dim')
    # door frame: the same 12 heights in frame_q perspective
    META['r3_sr_bed']['pencil_cm'] = [h[1] for h in HEIGHTS]


@step
def patches():
    # 270° mom at the table + the face-down phone (G18), lit versions (05:35 tail / 05:30 '딸랑')
    B = base_raw('r3_kitchen')
    al_m, al_p, Er = mom_patch_raw()
    g_night = view_grade(B, 'r3_kitchen')
    for key, al in (('x3_mom_table', al_m), ('x3_phone_down', al_p)):
        comp = B * (1 - al[..., None]) + Er * al[..., None]
        rgb = view_grade(comp, 'r3_kitchen')
        png(rgba(rgb, al), key); mark(key, 'g_x3_mom_table', 'g_r3_kitchen')
        seam_check(key, g_night, rgb, al)
    comp = B * (1 - al_m[..., None]) + Er * al_m[..., None]
    png(rgba(relight(comp, 'kitchen_lit', M('r3_kitchen'), seed=41), al_m), 'x3_mom_table_lit')
    mark('x3_mom_table_lit', 'g_x3_mom_table', 'g_r3_kitchen')
    # 05:30 kongi at mom's feet (G30 on ref_kitchen_mom) — dog only (fur-masked, x0.75 about its paws: G30's dog had
    # its head above the chair seat), lit plate only
    if has('g_x3_kongi_feet'):
        al = np.maximum(al_m, al_p)[..., None]
        Bm = B * (1 - al) + Er * al
        a2, E2 = extract(S('g_x3_kongi_feet'), Bm, M('r3_kitchen')['_kongi_feet_src_poly'], 'x3_kongi_feet', thr=9.0)
        comp2, a2 = dog_layer(Bm, E2, a2, 0.75, key='x3_kongi_feet', carve=M('r3_kitchen')['_kongi_feet_carve'], erode=4)
        png(rgba(relight(comp2, 'kitchen_lit', M('r3_kitchen'), seed=41), a2), 'x3_kongi_feet')
        mark('x3_kongi_feet', 'g_x3_kongi_feet', 'g_r3_kitchen')
        META.setdefault('r3_kitchen', vmeta('r3_kitchen'))['kongi_feet_poly'] = alpha_box(a2)
    else:
        MISSING.append('x3_kongi_feet: g_x3_kongi_feet missing')
    # 0° door view: kongi asleep / at the door, mom in the hall
    Bd = base_raw('r3_door'); gd = view_grade(Bd, 'r3_door'); md = M('r3_door')
    alphas = {}
    for key, src, poly in (('x3_kongi_sleep', 'g_x3_kongi_sleep', 'kongi_sleep_poly'),
                           ('x3_kongi_door', 'g_x3_kongi_door', '_kongi_door_src_poly'),
                           ('x3_mom_hall', 'g_x3_mom_hall', 'mom_hall_poly')):
        if not has(src): MISSING.append(f'{key}: {src} missing'); continue
        person = key == 'x3_mom_hall'
        al, E = extract(S(src), Bd, md[poly], key, close=12 if person else 0, rgb=person)
        if key == 'x3_kongi_door':
            # G21 drew the poodle ≈ 0.8 m tall at door depth (door ≈ 465 px = 2.05 m) -> x0.47, its rear paws set on
            # the base's coir mat (the edit's own mat is dropped with the fur mask)
            comp, al = dog_layer(Bd, E, al, 0.47, dst=tuple(f * d for f, d in zip(md['_kongi_door_paw'], (1024, 1536))),
                                 key=key)
        else:
            comp = Bd * (1 - al[..., None]) + E * al[..., None]
        rgb = view_grade(comp, 'r3_door')
        png(rgba(rgb, al), key); mark(key, src, 'g_r3_door'); seam_check(key, gd, rgb, al)
        alphas[key] = al
    if 'x3_kongi_door' in alphas:
        META.setdefault('r3_door', vmeta('r3_door'))['kongi_door_poly'] = alpha_box(alphas['x3_kongi_door'])
    if 'x3_kongi_door' in alphas and 'x3_mom_hall' in alphas:
        ov = (alphas['x3_kongi_door'] > 0.02) & (alphas['x3_mom_hall'] > 0.02)
        pk = poly_mask((1024, 1536), q_px(META['r3_door']['kongi_door_poly'], 1024, 1536)) > 0.5
        ph_ = poly_mask((1024, 1536), q_px(md['mom_hall_poly'], 1024, 1536)) > 0.5
        QA['overlap_r3_door'] = (f'x3_kongi_door ∩ x3_mom_hall alpha > .02: {int(ov.sum())} px · kongi_door_poly ∩ '
                                 f'mom_hall_poly: {int((pk & ph_).sum())} px (§8.2 G31: none)')
    # 180° the sleeper on the sofa
    Bs = base_raw('r3_sofa')
    al, E = extract(S('g_x3_jimin_sleep'), Bs, M('r3_sofa')['jimin_poly'], 'x3_jimin_sleep')
    comp = Bs * (1 - al[..., None]) + E * al[..., None]
    rgb = view_grade(comp, 'r3_sofa')
    png(rgba(rgb, al), 'x3_jimin_sleep'); mark('x3_jimin_sleep', 'g_x3_jimin_sleep', 'g_r3_sofa')
    seam_check('x3_jimin_sleep', view_grade(Bs, 'r3_sofa'), rgb, al)
    # Seah's room B: mom on the bed edge, stand-lamp plate + night-light plate
    if has('g_x3_mom_bed'):
        Bb = base_raw('r3_sr_bed')
        al, E = extract(I(sr_bed_expo(A(S('g_x3_mom_bed')))), Bb, M('r3_sr_bed')['mom_bed_poly'], 'x3_mom_bed', thr=8.0,
                        close=12, rgb=True)
        comp = Bb * (1 - al[..., None]) + E * al[..., None]
        rgb = view_grade(comp, 'r3_sr_bed')
        png(rgba(rgb, al), 'x3_mom_bed'); mark('x3_mom_bed', 'g_x3_mom_bed', 'g_r3_sr_bed')
        seam_check('x3_mom_bed', view_grade(Bb, 'r3_sr_bed'), rgb, al)
        png(rgba(relight(comp, 'sr_dim', M('r3_sr_bed'), seed=43), al), 'x3_mom_bed_dim')
        mark('x3_mom_bed_dim', 'g_x3_mom_bed', 'g_r3_sr_bed')
    else:
        MISSING.append('x3_mom_bed: g_x3_mom_bed missing')


def clone_fill(a, mask, seed=3, noise=2.0, iters=400):
    """fill `mask` from its surroundings: row-wise linear interpolation between the nearest unmasked pixels left and
    right (walls are mostly horizontal-texture-free), blended with an iterative diffusion fill, + fine noise σ."""
    H, W = mask.shape
    out = a.copy()
    ys = np.where(mask.any(1))[0]
    for y in ys:
        row = mask[y]
        xs = np.where(row)[0]
        for seg in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
            l, r = seg[0] - 1, seg[-1] + 1
            if l < 0 and r >= W: continue
            cl = a[y, max(0, l - 6):max(1, l + 1)].mean(0) if l >= 0 else a[y, min(W - 1, r):min(W, r + 7)].mean(0)
            cr = a[y, min(W - 1, r):min(W, r + 7)].mean(0) if r < W else cl
            t = (seg - l) / max(1, (r - l))
            out[y, seg] = cl[None, :] * (1 - t[:, None]) + cr[None, :] * t[:, None]
    # diffusion pass to remove row streaks
    m = mask.astype(bool)
    for _ in range(iters // 40):
        sm = np.stack([ndi.uniform_filter(out[..., c], 5) for c in range(3)], -1)
        out[m] = sm[m]
    out[m] += np.random.default_rng(seed).normal(0, noise, (int(m.sum()), 1))
    return out


def _hook_parts(a, rect):
    """segment a hook rect against its own wall. The scene is warm-graded (the wall itself has saturation ≈ .4 and
    r − g ≈ 15), so absolute 'white / pink / brass' tests fail (AD finding: the old test filled the whole rect and the
    hook went with it). Wall model = per-row median of the rect's 6 leftmost + 6 rightmost columns; object = RGB
    distance from it > 14; pink = object with r/g ≥ wall r/g + .25; hook = bright object (L ≥ wall + 12) that is not
    pink; collar = the remaining object components that touch pink (strands, knot, the shaded loop) or lie in the lower
    40 % of the rect (the bell). Returns (x0, y0, x1, y1, hook, collar, pink)."""
    H, W = a.shape[:2]
    x0, y0, x1, y1 = [int(v) for v in rect_px(rect, W, H)]
    sub = ndi.uniform_filter(a[y0:y1, x0:x1], (3, 3, 1)) * 0.5 + a[y0:y1, x0:x1] * 0.5
    h, w = sub.shape[:2]
    k = max(2, min(6, w // 6))
    side = np.concatenate([sub[:, :k], sub[:, -k:]], 1)
    wall = ndi.median_filter(np.median(side, axis=1), size=(9, 1))[:, None, :]
    dist = np.sqrt(((sub - wall) ** 2).sum(-1) / 3.0)
    obj = ndi.binary_opening(dist > 14, iterations=1)
    r, g = sub[..., 0], sub[..., 1]
    wr = np.median(wall[..., 0] / np.maximum(wall[..., 1], 1))
    rg = r / np.maximum(g, 1)
    L, Lw = lum(sub), lum(wall)
    pink = obj & (rg >= wr + 0.25) & (r - g > 8)
    hook = (dist > 10) & (L >= Lw + 8) & (rg < wr + 0.15)          # no opening: the J's arm is 2 px wide at 0°
    lab, n = ndi.label(hook, structure=np.ones((3, 3)))
    if n:   # the hook hangs from the top: keep the blobs (≥ 3 px) whose top is in the upper half of the rect
        objs = ndi.find_objects(lab)
        sz = ndi.sum(hook, lab, range(1, n + 1))
        hook = np.isin(lab, [i + 1 for i, sl in enumerate(objs) if sl is not None and sl[0].start < h * 0.5 and sz[i] >= 3])
    rest = obj & ~hook
    lab, n = ndi.label(rest)
    keep = []
    pk = ndi.binary_dilation(pink, iterations=3)
    for i, sl in enumerate(ndi.find_objects(lab)):
        if sl is None: continue
        comp = lab[sl] == i + 1
        if (comp & pk[sl]).any() or sl[0].start >= h * 0.6: keep.append(i + 1)
    collar = np.isin(lab, keep) | pink
    return x0, y0, x1, y1, hook, collar, pink


def collar_mask(a, rect, keep_hook_frac=0.25):
    """the area to clone-fill: the whole hook rect below its top keep_hook_frac/2 rows (the rect is measured tight
    round hook + collar + bell on plain wall; thin 1–2 px collar strands are not reliably separable from the wall, so
    nothing is left to chance). The hook itself is NOT kept by this mask — restore_hook() pastes it back from the
    source after the fill and redraws its lower lip (AD fix: the hook used to be erased with the collar)."""
    H, W = a.shape[:2]
    x0, y0, x1, y1 = [int(v) for v in rect_px(rect, W, H)]
    m = np.zeros((y1 - y0, x1 - x0), bool)
    k = max(1, int((y1 - y0) * keep_hook_frac) // 2)
    m[k:] = True
    pink = _hook_parts(a, rect)[6]
    m[:k] |= ndi.binary_dilation(pink, iterations=1)[:k]          # the loop over the hook's lip, in the kept rows
    full = np.zeros((H, W), bool); full[y0:y1, x0:x1] = m
    return full


def restore_hook(out, src, rect, mk, width=2.5, ss=4, lip=True):
    """after clone_fill: paste the white hook back from `src` (same grading as `out`) and redraw the lower lip of its
    J-curve as a light-grey arc where the collar crossed it (the empty hook is what says the collar was taken).
    Returns (out, hook px, lip px)."""
    H, W = out.shape[:2]
    x0, y0, x1, y1, hook, _, _ = _hook_parts(src, rect)
    if not hook.any(): return out, 0, 0
    full = np.zeros((H, W), bool); full[y0:y1, x0:x1] = hook
    hm = np.clip(ndi.gaussian_filter(ndi.binary_dilation(full, iterations=1).astype(np.float32), 0.6) * 1.2, 0, 1)
    hm = hm * ndi.binary_dilation(mk, iterations=3)               # only where the fill touched it
    out = out * (1 - hm[..., None]) + src * hm[..., None]
    if not lip: return out, int(full.sum()), 0
    # the lip: the lower half of an ellipse spanning the hook's lower part, drawn only over the collar's footprint
    ys, xs = np.nonzero(hook)
    hh = ys.max() - ys.min() + 1
    low = ys >= ys.max() - max(2, int(0.35 * hh))
    xl, xr, yb = xs[low].min() + x0, xs[low].max() + x0, ys.max() + y0
    xl = xl + 0.35 * (xr - xl)                                     # the J joins the plate near its middle
    cx, rx = (xl + xr) / 2.0, max(1.5, (xr - xl) / 2.0 - width * 0.3)
    ry = max(1.5, 0.55 * rx)
    cy = yb + 1 - ry
    bx0, by0 = int(cx - rx - 6), int(cy - 4)
    bw, bh = int(2 * rx + 12), int(ry + 10)
    cv = Image.new('L', (bw * ss, bh * ss), 0)
    pts = [((cx + rx * math.cos(t) - bx0) * ss, (cy + ry * math.sin(t) - by0) * ss) for t in np.linspace(0, math.pi, 40)]
    ImageDraw.Draw(cv).line(pts, fill=255, width=max(1, int(round(width * ss))), joint='curve')
    st = A(cv.resize((bw, bh), Image.LANCZOS)) / 255.0
    lip = np.zeros((H, W), np.float32)
    ya, yb_ = max(0, by0), min(H, by0 + bh); xa, xb_ = max(0, bx0), min(W, bx0 + bw)
    lip[ya:yb_, xa:xb_] = st[ya - by0:yb_ - by0, xa - bx0:xb_ - bx0]
    lip *= ndi.binary_dilation(mk, iterations=2) & ~ndi.binary_dilation(full, iterations=1)
    col = np.median(src[full], axis=0) * 0.86                      # the hook's own white, in the shade under the lip
    out = out * (1 - lip[..., None]) + col * lip[..., None]
    return out, int(full.sum()), int((lip > 0.3).sum())


@step
def props():
    # x3_hook_empty: r3_door with the collar + bell gone from the hook (END + 4 s), white hook kept
    Bd = base_raw('r3_door'); gd = view_grade(Bd, 'r3_door')
    mk = collar_mask(Bd, M('r3_door')['hook_rect'], keep_hook_frac=0.22)
    filled = clone_fill(gd, mk, seed=5, noise=2.0)
    filled, hk, lp = restore_hook(filled, gd, M('r3_door')['hook_rect'], mk, width=1.3)
    al = ndi.gaussian_filter(ndi.binary_dilation(mk, iterations=1).astype(np.float32), 1.0)
    png(rgba(filled, al), 'x3_hook_empty'); mark('x3_hook_empty', 'g_r3_door')
    QA['x3_hook_empty'] = (f'{int(mk.sum())} px of collar / bell filled from the wall; white hook pasted back ({hk} px) + '
                           f'lip arc {lp} px where the collar crossed it')


# ================================================================ close-ups (§8.2 G09–G17 · G28)
def cu_grade(a, seed, shadow=2.0, noise=3.0, warmk=0.0):
    a = a.astype(np.float32).copy()
    L = lum(a) / 255.0
    a = a + shadow * ((1 - L) ** 2)[..., None] * np.array([-0.5, 0.25, 1.0], np.float32)
    if warmk: a = a * np.array([1 + 0.05 * warmk, 1.0, 1 - 0.06 * warmk], np.float32)
    if noise: a = a + noise_field(a.shape[:2], noise, seed)[..., None] * (0.5 + 0.5 * (1 - L[..., None]))
    return np.clip(a, 0, 255)


def quad_extremes(mask):
    ys, xs = np.nonzero(mask)
    s, d = xs + ys, xs - ys
    return [(int(xs[s.argmin()]), int(ys[s.argmin()])), (int(xs[d.argmax()]), int(ys[d.argmax()])),
            (int(xs[s.argmax()]), int(ys[s.argmax()])), (int(xs[d.argmin()]), int(ys[d.argmin()]))]


def phone_screen(a):
    """auto: the phone's black glass = the largest very dark blob in the middle of G09 -> quad (px) + mask."""
    H, W = a.shape[:2]
    L = ndi.gaussian_filter(lum(a), 1.0)
    m = L < 22
    m[:int(0.25 * H)] = False
    m = ndi.binary_opening(m, iterations=3)
    lab, n = ndi.label(m)
    if not n: return None, None
    i = int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))) + 1
    blob = ndi.binary_fill_holes(lab == i)
    return quad_extremes(blob), blob


def crayon_mask(size, draw_fn, seed, blur=0.7):
    lay = Image.new('L', size, 0)
    draw_fn(ImageDraw.Draw(lay), np.random.default_rng(seed))
    return ndi.gaussian_filter(A(lay) / 255.0, blur)


def wobble_line(d, rng, pts, width, passes=5):
    for _ in range(passes):
        j = [(x + rng.uniform(-width * 0.18, width * 0.18), y + rng.uniform(-width * 0.18, width * 0.18)) for x, y in pts]
        d.line(j, fill=255, width=max(1, int(width * rng.uniform(0.55, 0.85))), joint='curve')


def blob_circle(d, rng, cx, cy, r, n=28):
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        rr = r * (1 + rng.uniform(-0.07, 0.07))
        pts.append((cx + rr * math.cos(t) * 1.06, cy + rr * math.sin(t) * 0.94))
    d.polygon(pts, fill=255)


NOTE_COLORS = ['#d23c3c', '#e8862a', '#8fbf3a', '#3a6fd0', '#e2709a', '#7b4fc0']


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def drawing_layers(a, meta):
    """§8.3-6 ②: the child's crayon staff (5 wavy black lines, 9 px, 46 px apart narrowing downward) and six round
    notes — 1–4 and 6 inside the staff, the fifth (pink) 120 px above the top line with a smiling face. Returns
    (list of (coverage, colour)), notes meta. Positions are in G16 pixels (the sheet lies square to the camera)."""
    H, W = a.shape[:2]
    pq = q_px(meta['paper_q'], W, H)
    px0 = (pq[0][0] + pq[3][0]) / 2; px1 = (pq[1][0] + pq[2][0]) / 2
    py0 = (pq[0][1] + pq[1][1]) / 2; py1 = (pq[2][1] + pq[3][1]) / 2
    pw, ph = px1 - px0, py1 - py0
    sx0, sx1 = px0 + 0.10 * pw, px0 + 0.92 * pw
    top = py0 + 0.40 * ph
    gaps = [46, 45, 44, 42]
    ys = [top]
    for g in gaps: ys.append(ys[-1] + g)
    layers = []
    rng0 = np.random.default_rng(31)
    def staff(d, rng):
        for i, y in enumerate(ys):
            ph_ = rng.uniform(0, 6.28)
            pts = [(x, y + 6 * math.sin(x / 95.0 + ph_) + rng.normal(0, 0.6)) for x in np.arange(sx0, sx1, 6)]
            wobble_line(d, rng, pts, 9)
    layers.append((crayon_mask((W, H), staff, 5), hexrgb('#2a2a2a')))
    # six notes: x evenly spaced, y on lines / spaces (the fifth floats above)
    nx = [sx0 + (sx1 - sx0) * f for f in (0.10, 0.26, 0.42, 0.58, 0.74, 0.90)]
    ny = [ys[3], (ys[1] + ys[2]) / 2, ys[0], (ys[0] + ys[1]) / 2, ys[0] - 120, ys[3]]
    notes = []
    for i, (x, y) in enumerate(zip(nx, ny)):
        r = float(rng0.uniform(22, 26))
        col = NOTE_COLORS[i]
        def note(d, rng, x=x, y=y, r=r, i=i):
            blob_circle(d, rng, x, y, r)
            sx_ = x + r * 0.92
            wobble_line(d, rng, [(sx_, y - 2), (sx_ + rng.uniform(-2, 2), y - r - 62)], 8, passes=3)
        layers.append((crayon_mask((W, H), note, 50 + i), hexrgb(col)))
        notes.append([round(x / W, 4), round(y / H, 4), round(r / W, 4), col])
    # the fifth note's face: two dots + a smile, in dark crayon over the pink
    x5, y5 = nx[4], ny[4]
    def face(d, rng):
        for dx in (-8, 8):
            d.ellipse((x5 + dx - 3.2, y5 - 9, x5 + dx + 3.2, y5 - 2.6), fill=255)
        d.arc((x5 - 12, y5 - 8, x5 + 12, y5 + 13), start=25, end=155, fill=255, width=4)
    layers.append((crayon_mask((W, H), face, 77, blur=0.5), (90, 30, 50)))
    staff_meta = {'lines_y': [round(y / H, 4) for y in ys], 'x0': round(sx0 / W, 4), 'x1': round(sx1 / W, 4)}
    return layers, notes, staff_meta


def apply_crayon(a, layers, tooth, opacity=0.93):
    out = a.copy()
    for cov, col in layers:
        al = np.clip(cov * tooth * opacity, 0, 1)[..., None]
        out = out * (1 - al) + np.array(col, np.float32) * al
    return out


MIRROR_PHONE_RING = False


@step
def closeups():
    # ---- c3_phone_ring (03:33) + _lit (06:10, kitchen ceiling light on): same source, same screen quad, glass -> black
    # NOT mirrored (AD finding 'lamp on the wrong side' checked against the room): in r3_kitchen + x3_mom_table the
    # lamp base is at x ≈ 714 px, the mug ≈ 745, the phone ≈ 770–832 (of 1024) — the lamp stands back-LEFT of both,
    # as in G09. Mirroring would flip the lamp across the ref_table crossfade; the residual mismatch is the mug
    # (right of the phone here, left of it in the room). MIRROR_PHONE_RING = True gives the AD's variant.
    a = A(S('g_c3_phone_ring'))
    if MIRROR_PHONE_RING: a = np.ascontiguousarray(a[:, ::-1])
    H, W = a.shape[:2]
    q, blob = phone_screen(a)
    for key, img in (('c3_phone_ring', cu_grade(a, 61, warmk=0.2)),
                     ('c3_phone_ring_lit', relight(a, 'kitchen_lit', None, closeup=True, seed=62))):
        if q is not None:
            inner = ndi.binary_erosion(blob, iterations=2)
            sm = ndi.gaussian_filter(inner.astype(np.float32), 0.8)[..., None]
            img = img * (1 - sm) + np.array([8, 8, 10], np.float32) * sm
        jpg(I(img), key, 84, 300); mark(key, 'g_c3_phone_ring')
    if q is not None: META['c3_phone_ring'] = {'ring_q': [fr(x, y, W, H) for x, y in q]}
    META['c3_phone_ring_lit'] = META.get('c3_phone_ring', {})
    # ---- c3_mom_hands
    if has('g_c3_mom_hands'):
        jpg(I(cu_grade(A(S('g_c3_mom_hands')), 63, warmk=0.2)), 'c3_mom_hands', 84, 300); mark('c3_mom_hands', 'g_c3_mom_hands')
    else: MISSING.append('c3_mom_hands: source missing')
    # ---- c3_lockpanel (LED = DOM at led_lock)
    jpg(I(cu_grade(A(S('g_c3_lockpanel')), 64)), 'c3_lockpanel', 84, 300); mark('c3_lockpanel', 'g_c3_lockpanel')
    META['c3_lockpanel'] = dict(M('c3_lockpanel'))
    # ---- c3_shoes + _nocollar (collar + bell cloned off the hook; white hook kept)
    s = cu_grade(A(S('g_c3_shoes')), 65)
    jpg(I(s), 'c3_shoes', 84, 300); mark('c3_shoes', 'g_c3_shoes')
    mk = collar_mask(A(S('g_c3_shoes')), M('c3_shoes')['hook_rect_cu'], keep_hook_frac=0.24)
    nc, hk, lp = restore_hook(clone_fill(s, mk, seed=6, noise=2.0), s, M('c3_shoes')['hook_rect_cu'], mk, width=2.6)
    jpg(I(nc), 'c3_shoes_nocollar', 84, 300); mark('c3_shoes_nocollar', 'g_c3_shoes')
    META['c3_shoes'] = dict(M('c3_shoes'))
    QA['c3_shoes_nocollar'] = f'{int(mk.sum())} px of collar / bell filled; white hook pasted back ({hk} px) + lip arc {lp} px'
    # ---- c3_orgel_spot (the empty rectangle must read lighter than the lace around it)
    o = cu_grade(A(S('g_c3_orgel_spot')), 66)
    jpg(I(o), 'c3_orgel_spot', 84, 300); mark('c3_orgel_spot', 'g_c3_orgel_spot')
    # ---- c3_manual (staff + print are DOM SVG in staff_q / print_q)
    jpg(I(cu_grade(A(S('g_c3_manual')), 67)), 'c3_manual', 84, 300); mark('c3_manual', 'g_c3_manual')
    META['c3_manual'] = dict(M('c3_manual'))
    # ---- c3_drawing (crayon baked) + _back (mirrored sheet + the front's crayon showing through)
    dr = A(S('g_c3_drawing')); H, W = dr.shape[:2]
    md = M('c3_drawing')
    pm = poly_mask((W, H), q_px(md['paper_q'], W, H), feather=1.5)
    tooth = grain_mask(dr, 1.6, 0.30, 1.0, seed=8) * pm
    layers, notes, staff_meta = drawing_layers(dr, md)
    front = apply_crayon(dr, layers, tooth)
    jpg(I(cu_grade(front, 68)), 'c3_drawing', 84, 300); mark('c3_drawing', 'g_c3_drawing')
    back = dr[:, ::-1].copy()
    pmb = pm[:, ::-1]
    for cov, col in layers:
        cv = ndi.gaussian_filter(cov[:, ::-1], 3) * 0.12 * pmb
        c = np.array(col, np.float32); g_ = c.mean(); c = g_ + (c - g_) * 0.3
        back = back * (1 - cv[..., None] + cv[..., None] * c / 255.0)
    jpg(I(cu_grade(back, 69)), 'c3_drawing_back', 84, 300); mark('c3_drawing_back', 'g_c3_drawing')
    n5 = notes[4]
    META['c3_drawing'] = {
        'paper_q': md['paper_q'], 'corner_q': md['corner_q'], 'notes': notes, 'staff': staff_meta,
        'draw_txt': {   # DOM text (Gamja Flower 700 · crayon colours · paper-grain mask · ±3°) — fractions of the image
            'title': {'text': '내 노래', 'x': 0.5, 'y': 0.235, 'h': 0.07, 'rot': -3, 'color': '#e8862a', 'align': 'center'},
            'wrong': {'text': '틀린 음!', 'x': round(n5[0] + 0.045, 4), 'y': round(n5[1] - 0.01, 4), 'h': 0.045, 'rot': 3,
                      'color': '#e2709a', 'align': 'left'},
            'sig': {'text': '윤세아 1학년 3반 · 2008. 5. 8', 'x': 0.83, 'y': 0.775, 'h': 0.024, 'rot': -2,
                    'color': '#3a6fd0', 'align': 'right'}},
        'back_txt': {   # on c3_drawing_back — mom's ballpoint (Nanum Brush Script · #23305e · multiply .9 · −2°)
            'l1': {'text': '세아가 어버이날에 그려 준 거', 'x': 0.50, 'y': 0.40, 'h': 0.036, 'rot': -2, 'color': '#23305e', 'align': 'center'},
            'l2': {'text': '다섯째 음을 일부러 틀림 — "엄마 나 괜찮아"래', 'x': 0.50, 'y': 0.465, 'h': 0.032, 'rot': -2,
                   'color': '#23305e', 'align': 'center'}},
        'back_corner_q': [[round(1 - x, 4), y] for x, y in md['corner_q']],
    }
    QA['c3_drawing'] = f"6 notes, the fifth {round((staff_meta['lines_y'][0] - n5[1]) * H)} px above the top line (smiling face); text = DOM"
    # ---- c3_doorframe: 12 pencil lines + dates (mom = brush 7–11, Seah = gamja 12–18)
    df = A(S('g_c3_doorframe'))
    dfm, lines, labels, inter, cross = doorframe_marks(cu_grade(df, 70), M('c3_doorframe'))
    jpg(I(dfm), 'c3_doorframe', 86, 300); mark('c3_doorframe', 'g_c3_doorframe')
    META['c3_doorframe'] = dict(M('c3_doorframe')); META['c3_doorframe']['lines'] = lines; META['c3_doorframe']['labels'] = labels
    QA['c3_doorframe'] = (f'12 lines, label-box intersections {inter}, leader x label crossings {cross}, '
                          f'{sum(l["leader"] for l in labels)} pencil leaders, dots drawn as 3.5–4 px graphite; hands: mom '
                          + ('Nanum Brush Script' if FONT_OK['brush'] else 'STAND-IN (brush.ttf missing — procedural slanted sansb hand)')
                          + ', Seah ' + ('Gamja Flower' if FONT_OK['gamja'] else 'STAND-IN (gamja.ttf missing — procedural upright rounded sans hand)') + '; pen.ttf not used')
    # ---- c3_pot + _lit (ceiling light + fog inside the glass lid) + x3_flame (screen-blend overlay)
    p = A(S('g_c3_pot')); H, W = p.shape[:2]
    jpg(I(cu_grade(p, 71)), 'c3_pot', 84, 300); mark('c3_pot', 'g_c3_pot')
    pl = relight(p, 'kitchen_lit', None, closeup=True, seed=72)
    u, v = uv(H, W)
    lid = (((u - 0.605) / 0.235) ** 2 + ((v - 0.42) / 0.135) ** 2 < 1).astype(np.float32)
    fog = ndi.gaussian_filter(lid, 18) * 0.18
    pl = pl * (1 - fog[..., None]) + 245 * fog[..., None]
    jpg(I(pl), 'c3_pot_lit', 84, 300); mark('c3_pot_lit', 'g_c3_pot')
    META['c3_pot'] = dict(M('c3_pot')); META['c3_pot_lit'] = META['c3_pot']
    bq = M('c3_pot')['burner_q']
    cx, cy, rx, ry = bq['cx'] * W, bq['cy'] * H, bq['rx'] * W, bq['ry'] * H
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    fa = np.zeros((H, W), np.float32); core = np.zeros((H, W), np.float32)
    rngf = np.random.default_rng(57)
    for k in range(12):                                     # 12 petals round the burner; the back ones hide behind the pot
        t = 2 * math.pi * k / 12 + 0.13
        if math.sin(t) < -0.30: continue
        bx, by = cx + rx * math.cos(t), cy + ry * math.sin(t)
        ln = 34 * rngf.uniform(0.85, 1.15)
        dx, dy = 0.45 * math.cos(t), -1.0                   # lean out and up
        nrm = math.hypot(dx, dy); dx, dy = dx / nrm, dy / nrm
        for s_ in np.linspace(0, 1, 18):                    # teardrop: wide soft base -> thin tip
            qx, qy = bx + dx * ln * s_, by + dy * ln * s_
            sw = 6.5 * (1 - s_) ** 0.7 + 1.2
            g = np.exp(-(((xx - qx) ** 2) + ((yy - qy) ** 2)) / (2 * sw ** 2))
            fa = np.maximum(fa, g * (1 - 0.75 * s_))
            if s_ < 0.45: core = np.maximum(core, g * (1 - s_ / 0.45) * 0.9)
    # the ring glow along the front of the burner
    tt = np.linspace(-0.3, math.pi + 0.3, 240)
    for t in tt:
        if math.sin(t) < -0.30: continue
        qx, qy = cx + rx * math.cos(t), cy + ry * math.sin(t)
        fa = np.maximum(fa, 0.55 * np.exp(-(((xx - qx) ** 2) + ((yy - qy) ** 2)) / (2 * 2.2 ** 2)))
    blue = np.array(hexrgb('#6fa8ff'), np.float32); inner = np.array([214, 232, 255], np.float32)
    fl = blue[None, None, :] * (1 - core[..., None]) + inner[None, None, :] * core[..., None]
    bloom = ndi.gaussian_filter(fa, 5) * 0.45
    alpha = np.clip(ndi.gaussian_filter(fa, 0.8) * 0.9 + bloom, 0, 1)
    png(rgba(fl, alpha), 'x3_flame'); mark('x3_flame', 'g_c3_pot')
    META['x3_flame'] = {'blend': 'screen', 'canvas': 'c3_pot_lit'}
    # ---- c3_window: two lit windows across the courtyard (06:00 tail card · credits background)
    w_ = A(S('g_c3_window')); H, W = w_.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # G12 telephoto: the same two as r3_veranda win_a (middle height, left) / win_b (upper, middle) — measured
    wins = {'a': [[0.226, 0.531], [0.270, 0.531], [0.270, 0.561], [0.226, 0.561]],
            'b': [[0.508, 0.368], [0.548, 0.368], [0.548, 0.398], [0.508, 0.398]]}
    out = w_.copy()
    Ls = ndi.gaussian_filter(lum(w_), 0.5)
    lit_q, frame_px = {}, {}
    for name, q in wins.items():
        qq = q_px(q, W, H)
        x0, y0 = qq[0]; x1, y1 = qq[2]
        # AD fix: the window's own frame survives. The glass = the dark panes round the measured quad (L below the
        # quad's 30th percentile + 14); the lit area = the panes' bounding box (the measured quad missed the low
        # transom panes); inside it, the mullion / sash bars (not glass) are drawn at 0.35x the warm fill — a frame
        # seen against a lit room
        bx0, by0, bx1, by1 = int(x0) - 5, int(y0) - 5, int(x1) + 6, int(y1) + 9
        sub = Ls[by0:by1, bx0:bx1]
        glass = sub < np.percentile(Ls[int(y0):int(y1), int(x0):int(x1)], 30) + 14
        lab, n = ndi.label(glass)
        sz = ndi.sum(glass, lab, range(1, n + 1))
        glass = np.isin(lab, [i + 1 for i, s_ in enumerate(sz) if s_ >= 12])
        gy, gx = np.nonzero(glass)
        wx0, wy0, wx1, wy1 = gx.min() + bx0, gy.min() + by0, gx.max() + bx0 + 1, gy.max() + by0 + 1
        m = np.zeros((H, W), np.float32); m[wy0:wy1, wx0:wx1] = 1
        fr_ = np.zeros((H, W), np.float32)
        fr_[by0:by1, bx0:bx1] = (~glass).astype(np.float32)
        fr_ = ndi.gaussian_filter(fr_ * m, 0.5) * m
        cxw, cyw = (wx0 + wx1) / 2, (wy0 + wy1) / 2
        grad = np.clip(1 - np.sqrt(((xx - cxw) / ((wx1 - wx0) / 1.6)) ** 2 + ((yy - cyw) / ((wy1 - wy0) / 1.4)) ** 2), 0, 1)
        folds = 0.92 + 0.08 * np.sin(xx / 3.0 + 1.3) * np.random.default_rng(9).uniform(0.6, 1, (1, W))
        light = np.array([255, 208, 150], np.float32) * (0.72 + 0.28 * grad)[..., None] * folds[..., None]
        light = light * (1 - 0.65 * fr_[..., None])                    # frame bars: 0.35x the fill
        out = out * (1 - m[..., None]) + light * m[..., None]
        bl = ndi.gaussian_filter(m, 6) * 0.35
        out = 255 - (255 - out) * (1 - bl[..., None] * np.array([1.0, 0.82, 0.6], np.float32))
        lit_q[name] = [fr(wx0, wy0, W, H), fr(wx1, wy0, W, H), fr(wx1, wy1, W, H), fr(wx0, wy1, W, H)]
        frame_px[name] = int((fr_ > 0.5).sum())
    jpg(I(cu_grade(out, 73, noise=2.5)), 'c3_window', 84, 300); mark('c3_window', 'g_c3_window')
    META['c3_window'] = {'lit_q': lit_q}
    QA['c3_window'] = (f'{len(wins)} windows lit (warm 255,208,150 + curtain folds + bloom σ6) over the pane bounding box, '
                       f'mullion / sash bars kept at 0.35x the fill ({frame_px} px); sky untouched (still night)')


# ================================================================ phone photos (§8.2 G07 G08 G22–G26)
MEAS.update({
    # G26 retry 1 (a girl with a chin-length bob + pink clip): the print lies with its top-right corner curled, so
    # its edge is a polygon (scan of print-vs-table chroma + eye, 2026-11-27); print_q = its 4 corners
    'p3_child_back': {'print_q': [[0.043, 0.0938], [0.9023, 0.0225], [0.9766, 0.9297], [0.0508, 0.959]],
                      'print_poly': [[0.043, 0.0938], [0.293, 0.0918], [0.3711, 0.084], [0.4883, 0.0791], [0.6055, 0.0732], [0.7227, 0.0664], [0.8008, 0.0557], [0.8398, 0.0459], [0.8789, 0.0322], [0.9023, 0.0225], [0.9092, 0.0293], [0.915, 0.0684], [0.9277, 0.1465], [0.9395, 0.2246], [0.9502, 0.3027], [0.96, 0.3809], [0.9688, 0.459], [0.9746, 0.5371], [0.9775, 0.6055], [0.9785, 0.6836], [0.9785, 0.7812], [0.9775, 0.8789], [0.9766, 0.9297], [0.7227, 0.9355], [0.5273, 0.9414], [0.4102, 0.9473], [0.0508, 0.959]]},
    'p3_child_hands': {'print_q': [[0.085, 0.19], [0.97, 0.155], [0.995, 0.815], [0.0, 0.78]]},
})
# G22: the model's blank plate (x .826-.848 y .096-.171) sits on the door's outer face at ~77° — 702 in it would be
# 4–5 px wide glyphs. It is painted out and a plate is painted at the same spot, turned a little more toward the
# camera (39 x 32 px, edges following the face's perspective), so the digits land at the §8.3-6 ⑥ size (≈ 20 px).
PLATE_Q = [[0.8165, 0.1110], [0.8665, 0.1020], [0.8665, 0.1230], [0.8165, 0.1320]]


def phone_tone(a, ev_=0.2, k=0.0, noise=4.0, seed=1, sharpen=True):
    a = a * (2 ** ev_)
    if k: a = a * np.array([1 + 0.05 * k, 1.0, 1 - 0.06 * k], np.float32)
    im = I(a)
    if sharpen: im = im.filter(ImageFilter.UnsharpMask(1.2, 45, 2))
    a = A(im)
    if noise: a = a + noise_field(a.shape[:2], noise, seed)[..., None]
    return np.clip(a, 0, 255)


def print_border(a, quad, frac=0.03, seed=2):
    """white print margin (3 % of the print width) inside the print's outline (a quad, or a polygon when the print is
    curled) — lit like the print itself."""
    H, W = a.shape[:2]
    q = q_px(quad, W, H)
    xs_ = [p[0] for p in q]
    if len(q) == 4:
        outer = poly_mask((W, H), q)
        cx = sum(p[0] for p in q) / 4; cy = sum(p[1] for p in q) / 4
        pw = math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1])
        inset = frac * pw
        qi = []
        for (x, y) in q:
            dx, dy = cx - x, cy - y; dn = math.hypot(dx, dy)
            qi.append((x + dx / dn * inset * 1.35, y + dy / dn * inset * 1.35))
        inner = poly_mask((W, H), qi)
        band = ndi.gaussian_filter(np.clip(outer - inner, 0, 1), 0.8)
    else:
        outer = poly_mask((W, H), q) > 0.5
        inset = frac * (max(xs_) - min(xs_))
        dist = ndi.distance_transform_edt(outer)
        band = ndi.gaussian_filter(np.clip(inset + 0.5 - dist, 0, 1) * outer, 0.8)
    light = ndi.gaussian_filter(lum(a), 40) / 255.0
    paper = np.array([241, 236, 226], np.float32)[None, None, :] * (0.55 + 0.6 * light[..., None])
    return a * (1 - band[..., None] * 0.94) + paper * band[..., None] * 0.94


def squeeze_quad(q, k):
    """narrow a quad (fractions TL,TR,BR,BL) to k of its width about its centre, along its own top / bottom edges
    (= the door face's vanishing direction), heights kept."""
    def lerp(p0, p1, t): return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]
    t0, t1 = 0.5 - k / 2, 0.5 + k / 2
    return [[round(v, 4) for v in lerp(q[0], q[1], t0)], [round(v, 4) for v in lerp(q[0], q[1], t1)],
            [round(v, 4) for v in lerp(q[3], q[2], t1)], [round(v, 4) for v in lerp(q[3], q[2], t0)]]


PLATE_SQUEEZE = 0.6


def plate_702(a, quad):
    """§8.3-6 ⑥: '702' (sansb · dark on a light plate) warped into the plate quad — the only readable characters in this
    photo. AD fix (J-98 '702' must NOT read at gallery 1x, must read at 1.8x): a brushed-metal plate (150,150,156) with
    digits (78,78,84) instead of a white sticker with black digits, the card squeezed to 0.6 of its width along the
    door face (foreshortened with it — it looked pasted on), blur .9 px, noise σ 4 (+ the JPEG pass in photos())."""
    H, W = a.shape[:2]
    q = q_px(quad, W, H)
    cw, ch = 500, 280
    card = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=18, fill=(150, 150, 156, 255), outline=(104, 104, 110, 255), width=10)
    d.rounded_rectangle((16, 16, cw - 17, ch - 17), radius=12, outline=(166, 166, 172, 255), width=4)
    fs = int(ch * 0.60 / 0.73)
    while ImageFont.truetype(FONT_BOLD, fs).getlength('702') > cw * 0.80: fs -= 4
    f = ImageFont.truetype(FONT_BOLD, fs)
    d.text((cw / 2, ch / 2 + 4), '702', font=f, fill=(78, 78, 84, 255), anchor='mm')
    # brushed metal: fine horizontal streaks across the card (before the warp, so they follow the face)
    ca = A(card); rng = np.random.default_rng(702)
    streak = ndi.gaussian_filter1d(rng.normal(0, 1, (ch, cw)), 18, axis=1) * 9
    ca[..., :3] = np.clip(ca[..., :3] + streak[..., None] * (ca[..., 3:] > 0), 0, 255)
    card = I(ca, 'RGBA')
    wc = warp_card(card, q, (W, H))
    wa = A(wc)
    al = ndi.gaussian_filter(wa[..., 3] / 255.0, 0.9)[..., None]
    rgb = np.stack([ndi.gaussian_filter(wa[..., c], 0.9) for c in range(3)], -1)
    # light: the face is dim blue-grey there — scale the plate to the door's local level
    loc = ndi.gaussian_filter(lum(a), 12)
    ys, xs = np.nonzero(al[..., 0] > 0.5)
    k = float(np.clip(loc[ys, xs].mean() / 70.0, 0.55, 1.0)) if len(ys) else 0.8
    rgb = rgb * k + noise_field((H, W), 4, 703)[..., None]
    out = a * (1 - al) + rgb * al
    bb = f.getbbox('702', anchor='mm')
    digit_px = (bb[3] - bb[1]) / ch * (q[3][1] - q[0][1])
    digit_w = (bb[2] - bb[0]) / cw * (q[1][0] - q[0][0]) / 3
    return out, digit_px, digit_w


@step
def photos():
    # 11-30: open door + parcel + kongi (pink collar, bell) — 702 on the door's outer face; the hook's own collar
    # removed (the dog is wearing it in daylight photos)
    a = A(S('g_p3_kongi_1130')); H, W = a.shape[:2]
    m = M('p3_kongi_1130')
    mk = collar_mask(a, m['hook_collar'], keep_hook_frac=0.10)
    a = clone_fill(a, mk, seed=11, noise=1.5)        # (the hook sits above the rect's kept top rows here)
    old = poly_mask((W, H), q_px(m['plate_old'], W, H)) > 0.5
    a = clone_fill(a, ndi.binary_dilation(old, iterations=3), seed=12, noise=1.5)
    pq = squeeze_quad(PLATE_Q, PLATE_SQUEEZE)
    a, digit_px, digit_w = plate_702(a, pq)
    a = phone_tone(a, 0.2, 0.0, 4.0, seed=13)
    im = I(a); b = io.BytesIO(); im.save(b, 'JPEG', quality=88); a = A(Image.open(b))      # 'a JPEG once more'
    jpg(I(a), 'p3_kongi_1130', 82, 300); mark('p3_kongi_1130', 'g_p3_kongi_1130')
    META['p3_kongi_1130'] = {'plate_q': pq}
    QA['p3_kongi_1130'] = (f'702 digit height {digit_px:.1f} px of 1024 (target ≈ 17–20), each digit ≈ {digit_w:.1f} px wide '
                           f'(plate squeezed x{PLATE_SQUEEZE} along the door face) -> {digit_px * 390 / 1024:.1f} CSS px at 1x (390) · '
                           f'{digit_px * 390 / 1024 * 1.8:.1f} at 1.8x; metal plate (150,150,156) / digits (78,78,84), blur .9, '
                           f'noise σ4, JPEG pass; hook collar removed ({int(mk.sum())} px)')
    # 12-13: closed door, kongi on the cushion (collar, bell) — hook collar removed for the same reason
    a = A(S('g_p3_kongi_1213'))
    mk = collar_mask(a, M('p3_kongi_1213')['hook_collar'], keep_hook_frac=0.10)
    a = clone_fill(a, mk, seed=14, noise=1.5)
    jpg(I(phone_tone(a, 0.15, 0.1, 4.0, seed=15)), 'p3_kongi_1213', 82, 300); mark('p3_kongi_1213', 'g_p3_kongi_1213')
    # 2024-11-23 cake (warm 3400 K), 2026-01-24 soup, church (4200 K, +0.2 EV)
    jpg(I(phone_tone(A(S('g_p3_cake_2411')), 0.1, 0.35, 4.0, seed=16)), 'p3_cake_2411', 82, 300); mark('p3_cake_2411', 'g_p3_cake_2411')
    jpg(I(phone_tone(A(S('g_p3_soup_2601')), 0.1, -0.15, 4.0, seed=17)), 'p3_soup_2601', 82, 300); mark('p3_soup_2601', 'g_p3_soup_2601')
    jpg(I(phone_tone(A(S('g_p3_church')), 0.2, -0.3, 3.0, seed=18)), 'p3_church', 82, 300); mark('p3_church', 'g_p3_church')
    # old prints re-photographed (keep the re-shoot look) + the print's white margin
    for key in ('p3_child_back', 'p3_child_hands'):
        a = print_border(A(S('g_' + key)), M(key).get('print_poly', M(key)['print_q']))
        jpg(I(phone_tone(a, 0.0, 0.0, 3.0, seed=19, sharpen=False)), key, 82, 300); mark(key, 'g_' + key)
        META[key] = {k: v for k, v in M(key).items() if k in ('print_q', 'print_poly')}


# ================================================================ title · OG · icons · home wallpaper (§8.3-8)
@step
def meta_art():
    t = A(S('g_t3_title')); H, W = t.shape[:2]
    t = t * (2 ** -0.3)
    u, v = uv(H, W)
    dv = np.sqrt(((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2) / math.sqrt(2)
    t = t * (1 - 0.3 * np.clip(dv, 0, 1) ** 2.2)[..., None]
    t = t + noise_field((H, W), 2.5, 81)[..., None]
    jpg(I(t), 't3_title', 84, 360); mark('t3_title', 'g_t3_title')
    ti = I(t)
    # OG 1200x630: horizontal crop centred at y .58 + the two title lines (fixed name '하루' — OG is not personalised)
    ch = int(W * 630 / 1200); cy = int(0.58 * H)
    og = ti.crop((0, max(0, cy - ch // 2), W, max(0, cy - ch // 2) + ch)).resize((1200, 630), Image.LANCZOS)
    oa = A(og)
    shade = np.clip((np.arange(630)[:, None] - 300) / 330.0, 0, 1) * 0.45
    oa = oa * (1 - shade[..., None] * np.clip(1 - np.arange(1200)[None, :] / 1300.0, 0, 1)[..., None])
    og = I(oa).convert('RGBA')
    lay = Image.new('RGBA', og.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.text((64, 470), '하루를 위한 방탈출! 3', font=ImageFont.truetype(FONT_BOLD, 64), fill=(255, 255, 255, 217), anchor='ls')
    d.text((66, 548), '엄마의 번호', font=ImageFont.truetype(FONT_SANS, 40), fill=(255, 255, 255, 217), anchor='ls')
    og.alpha_composite(lay)
    jpg(og.convert('RGB'), 'og_ep3', 86, 300); mark('og_ep3', 'g_t3_title')
    # icon: square crop on the face-down phone + the lamp bokeh, maskable safe area 80 % (no text)
    side = int(W * 0.92); x0 = int(W * 0.04); y0 = int(H * 0.50) - side // 2
    ic = ti.crop((x0, y0, x0 + side, y0 + side))
    for sz, key in ((512, 'icon_ep3'), (192, 'icon_ep3_192')):
        png(ic.resize((sz, sz), Image.LANCZOS), key); mark(key, 'g_t3_title')
    # home wallpaper = ep1 dog_park, 9:19.5 crop 1080x2340, clock zone (top 22 %) −15 % (ep2 n_wall treatment)
    dp = Image.open(os.path.join(EP1, 'dog_park.jpg')).convert('RGB'); Wd, Hd = dp.size
    cw = int(Hd * 1080 / 2340); x0 = (Wd - cw) // 2
    hw = A(dp.crop((x0, 0, x0 + cw, Hd)).resize((1080, 2340), Image.LANCZOS))
    ramp = np.ones(2340, np.float32); top = int(0.22 * 2340)
    ramp[:top] = 0.85; ramp[top:top + 120] = np.linspace(0.85, 1.0, 120)
    hw = hw * ramp[:, None, None]
    jpg(I(hw), 'p3_home_wall', 84, 300); SRC_OF['p3_home_wall'] = []
    QA['meta_art'] = 'og = t3_title crop y .58 + sansb 64 / sans 40 white 85 %; icons = square crop (phone + lamp bokeh), no text'


# ================================================================ placeholders (quota stop) — same key / size, mood-correct
def paint_placeholder(job):
    """dark painted stand-in for a generated source that could not be made (quota): soft gradients + blurred shapes in
    the shot's palette + vignette + grain. Everything the puzzle reads off an image is composited later anyway."""
    w, h = map(int, job['size'].split('x'))
    rng = np.random.default_rng(abs(hash(job['name'])) % (2 ** 32))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    warm = np.array([118, 92, 62], np.float32); cool = np.array([38, 44, 58], np.float32)
    lx, ly = rng.uniform(0.15, 0.85) * w, rng.uniform(0.25, 0.6) * h
    d = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2) / max(w, h)
    k = np.exp(-(d ** 2) / (2 * 0.32 ** 2))[..., None]
    a = cool * (1 - k) + warm * k
    for _ in range(9):
        cx, cy = rng.uniform(0, w), rng.uniform(0.3, 1.0) * h
        rx, ry = rng.uniform(0.05, 0.25) * w, rng.uniform(0.03, 0.2) * h
        m = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1).astype(np.float32)
        m = ndi.gaussian_filter(m, 18)[..., None]
        a = a * (1 - 0.35 * m) + (a * rng.uniform(0.6, 1.3)) * 0.35 * m
    a = a + noise_field((h, w), 4, 1)[..., None]
    dv = np.sqrt(((xx / w - 0.5) / 0.5) ** 2 + ((yy / h - 0.5) / 0.5) ** 2) / math.sqrt(2)
    a = a * (1 - 0.45 * np.clip(dv, 0, 1) ** 2)[..., None]
    return I(a)


def make_placeholders(reason='insufficient_quota'):
    todo_p = os.path.join(GEN, '_regen_todo.json')
    todo = json.load(open(todo_p, encoding='utf-8')) if os.path.exists(todo_p) else []
    have = {j['name'] for j in todo}
    os.makedirs(PH, exist_ok=True)
    for pf in ('jobs_ep3_pass1.json', 'jobs_ep3_pass2.json', 'jobs_ep3_pass3.json'):
        for j in json.load(open(os.path.join(REPO, 'tools', pf), encoding='utf-8')):
            if os.path.exists(os.path.join(GEN, j['name'] + '.png')): continue
            paint_placeholder(j).save(os.path.join(PH, j['name'] + '.png'))
            if j['name'] not in have:
                jj = dict(j); jj['job_file'] = 'tools/' + pf; jj['reason'] = reason; todo.append(jj)
            print('placeholder', j['name'])
    json.dump(todo, open(todo_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(todo), 'jobs in', todo_p)


# ================================================================ TTS (§7.3) — tools/tts_ep3.json -> ep3/assets/audio/*.wav
TTS_JSON = os.path.join(REPO, 'tools', 'tts_ep3.json')
TTS_WORK = os.path.join(REPO, 'work', 'tts_ep3')
AUD_OUT = os.environ.get('HARU_AUD_OUT', os.path.join(REPO, 'ep3', 'assets', 'audio'))


def ep1_funcs(path, names):
    """imports + named defs / assignments of an ep1 tool only (tts.py / ttspost.py run ep1 jobs at module level)."""
    import ast
    tree = ast.parse(open(path, encoding='utf-8').read())
    keep = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom))
            or (isinstance(n, ast.FunctionDef) and n.name in names)
            or (isinstance(n, ast.Assign) and all(isinstance(t, ast.Name) and t.id in names for t in n.targets))]
    ns = {}
    exec(compile(ast.Module(body=keep, type_ignores=[]), path, 'exec'), ns)
    return ns


def tts_gen(names=None, force=False, suffix=''):
    cfg = json.load(open(TTS_JSON, encoding='utf-8'))
    raw = os.path.join(TTS_WORK, 'raw'); os.makedirs(raw, exist_ok=True)
    ns = ep1_funcs(os.path.join(REPO, 'tools', 'tts.py'), {'run'})
    ns['OUT'] = raw
    for j in cfg['jobs']:
        if not j.get('generate', True): continue
        if names and j['name'] not in names: continue
        name = j['name'] + suffix
        if os.path.exists(os.path.join(raw, name + '.raw.wav')) and not force:
            print(name, 'skip (exists)'); continue
        r = ns['run']((name, j['voice'], j['text'], j['instructions']))
        print(*r, flush=True)
        txt = str(r[1])
        open(os.path.join(TTS_WORK, '_usage.jsonl'), 'a', encoding='utf-8').write(json.dumps(
            {'name': name, 'voice': j['voice'], 'chars': len(j['text']) + len(j['instructions']), 'result': txt[:200]},
            ensure_ascii=False) + '\n')
        if 'insufficient_quota' in txt or 'billing' in txt or 'exceeded your current quota' in txt:
            raise SystemExit('QUOTA STOP (TTS): ' + txt[:200])


def frames_rms(x, sr, win=0.02):
    n = int(win * sr); m = len(x) // n
    return np.sqrt(np.mean(x[:m * n].reshape(m, n) ** 2, 1) + 1e-12), n


def active_rms_db(x, sr):
    r, _ = frames_rms(x, sr)
    act = r[r > np.max(r) * 10 ** (-30 / 20)]
    return float(20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12))


def voiced_fraction(x, sr, thr=0.5):
    """share of active 30 ms frames with a clear pitch (normalised autocorrelation peak in 80–400 Hz ≥ thr)."""
    n = int(0.03 * sr); hop = n // 2
    r_all = [np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x) - n, hop)]
    mx = max(r_all) if r_all else 1
    tot = vo = 0
    for k, i in enumerate(range(0, len(x) - n, hop)):
        if r_all[k] < mx * 10 ** (-25 / 20): continue
        w = x[i:i + n] - x[i:i + n].mean()
        ac = np.correlate(w, w, 'full')[n - 1:]; ac = ac / (ac[0] + 1e-12)
        tot += 1; vo += ac[int(sr / 400):int(sr / 80)].max() >= thr
    return vo / max(1, tot)


def segments(x, sr, gap_s=0.16, th_db=-34):
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
    N = int(win * sr); Hs = N // 2; Ha = int(round(Hs * rate)); tolN = int(tol * sr)
    w = np.hanning(N)
    out_len = int(len(x) / rate) + 2 * N
    y = np.zeros(out_len); ws = np.zeros(out_len)
    pos, k, nat = 0, 0, None
    while pos + N + tolN < len(x) and k * Hs + N < out_len:
        if nat is None: best = pos
        else:
            a0, a1 = max(0, pos - tolN), min(len(x) - N, pos + tolN)
            c = np.correlate(x[a0:a1 + N], nat, 'valid'); best = a0 + int(np.argmax(c))
        y[k * Hs:k * Hs + N] += x[best:best + N] * w; ws[k * Hs:k * Hs + N] += w
        nat = x[best + Hs:best + Hs + N]
        if len(nat) < N: break
        pos += Ha; k += 1
    return (y / np.maximum(ws, 1e-3))[:k * Hs + Hs]


def whisperize(x, sr, n_fft=512, hop=128, smooth_hz=420, seed=21):
    """voiced breathy TTS -> true whisper: every STFT frame keeps its spectral envelope (log-magnitude smoothed over
    ~420 Hz, so formants and consonants stay and the harmonics go) but gets random phase = noise excitation. Timing,
    loudness contour and the vowel colour of the take are kept; the pitch is gone (voiced frames -> 0)."""
    from scipy import signal
    f, t, X = signal.stft(x, sr, nperseg=n_fft, noverlap=n_fft - hop)
    mag = np.abs(X) + 1e-9
    k = max(3, int(smooth_hz / (sr / n_fft)))
    env = np.exp(ndi.uniform_filter1d(np.log(mag), k, axis=0))
    # a whisper has little energy under ~300 Hz (no glottal source)
    env *= np.clip((f[:, None] - 150) / 250.0, 0.05, 1.0)
    ph = np.exp(1j * np.random.default_rng(seed).uniform(0, 2 * np.pi, X.shape))
    _, y = signal.istft(env * ph, sr, nperseg=n_fft, noverlap=n_fft - hop)
    y = y[:len(x)]
    # match the take's energy contour (10 ms frames)
    n = int(0.01 * sr)
    for i in range(0, len(y) - n, n):
        a_, b_ = np.sqrt(np.mean(x[i:i + n] ** 2)), np.sqrt(np.mean(y[i:i + n] ** 2)) + 1e-9
        y[i:i + n] *= a_ / b_
    return ndi.uniform_filter1d(y, 3)


def denoise_gate(x, sr, floor_db=-40):
    r, n = frames_rms(x, sr, 0.01)
    g = np.repeat((20 * np.log10(r / r.max()) > floor_db).astype(float), n)
    g = np.convolve(np.pad(g, (0, max(0, len(x) - len(g)))), np.ones(int(0.02 * sr)) / int(0.02 * sr), 'same')[:len(x)]
    return x * np.clip(g, 0.12, 1)


def tts_post(names=None):
    """§7.3 chains. v3_mom_call: three phrases placed at file 0.4 / 2.4 / 4.4 s (= recording r 1.0 / 3.0 / 5.0, the file
    starts at r 0.6), the third ending by 6.0 s, the take's own end breath after it, total 6.8 s — cuts_s = phrase spans.
    v3_mom_okay: two sentences, 3.0 ± 0.3 s. v3_sea_name: unvoiced check, ≤ 0.80 s, 30 ms fades. All dry; HP/LP per row;
    level = active RMS −20 dBFS, peak ≤ −1 dBFS. Report -> work/tts_ep3/_report.json (G.AUDIO_META)."""
    from scipy import signal
    cfg = json.load(open(TTS_JSON, encoding='utf-8'))
    tp = ep1_funcs(os.path.join(REPO, 'tools', 'ttspost.py'), {'read', 'write', 'trim', 'filt', 'SR'})
    read, write, trim, filt, SR = tp['read'], tp['write'], tp['trim'], tp['filt'], tp['SR']
    os.makedirs(AUD_OUT, exist_ok=True)
    raw = os.path.join(TTS_WORK, 'raw')
    rep_p = os.path.join(TTS_WORK, '_report.json')
    try: report = json.load(open(rep_p, encoding='utf-8')) if os.path.exists(rep_p) else {}
    except ValueError: report = {}

    def level(x, target_db=-20.0, peak_db=-1.0):
        g = 10 ** ((target_db - active_rms_db(x, SR)) / 20)
        pk = np.max(np.abs(x * g)) + 1e-12
        if pk > 10 ** (peak_db / 20): g *= 10 ** (peak_db / 20) / pk
        return x * g

    def fade(x, s=0.03):
        n = int(s * SR); x = x.copy()
        if len(x) > 2 * n:
            r = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n)); x[:n] *= r; x[-n:] *= r[::-1]
        return x

    def stats(x):
        return {'dur_s': round(len(x) / SR, 2), 'peak_dbfs': round(20 * np.log10(np.max(np.abs(x)) + 1e-12), 1),
                'rms_active_dbfs': round(active_rms_db(x, SR), 1)}

    for j in cfg['jobs']:
        if not j.get('generate', True): continue
        if names and j['name'] not in names: continue
        name = j['name']; src = os.path.join(raw, j.get('take', name) + '.raw.wav')
        if not os.path.exists(src): print(name, 'MISSING raw'); report[name] = 'missing'; continue
        x, sr = read(src)
        x = trim(x, sr, 0.004)
        x = np.asarray(signal.resample_poly(x, SR, sr) if sr != SR else x, np.float64)
        x = filt(x, SR, j['hp'], j['lp'])
        kind = j['post']
        if kind == 'mom_call':
            x = denoise_gate(x, SR, -42)
            segs = segments(x, SR, 0.16, -38)
            # an end breath = a last segment that is quiet and has little pitch
            breath = None
            if len(segs) >= 4:
                a0, a1 = segs[-1]
                seg = x[a0:a1]
                if active_rms_db(seg, SR) < active_rms_db(x, SR) - 8 or voiced_fraction(seg, SR) < 0.3:
                    breath = seg; segs = segs[:-1]
            gaps = sorted(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1], reverse=True)[:2]
            ph, b0 = [], 0
            for k in sorted(gaps):
                ph.append((segs[b0][0], segs[k][1])); b0 = k + 1
            ph.append((segs[b0][0], segs[-1][1]))
            if len(ph) != 3: raise SystemExit(f'{name}: found {len(ph)} phrases')
            T = j['target_s']; out = np.zeros(int(T * SR))
            starts = j['phrase_starts_s']; ends_max = [starts[1] - 0.15, starts[2] - 0.15, j['speech_end_s']]
            place, rates = [], []
            for (p0, p1), st, emax in zip(ph, starts, ends_max):
                seg = x[max(0, p0 - int(0.03 * SR)):min(len(x), p1 + int(0.06 * SR))]
                room = emax - st; rate = 1.0
                if len(seg) / SR > room:
                    rate = min(1.15, (len(seg) / SR) / room)
                    seg = wsola(np.concatenate([seg, np.zeros(int(0.08 * SR))]), rate, SR)[:int(len(seg) / rate)]
                i0 = int(st * SR); i1 = min(len(out), i0 + len(seg))
                out[i0:i1] += fade(seg[:i1 - i0], 0.012)
                place.append((i0, i1)); rates.append(round(rate, 3))
            if breath is None:
                # no separate breath segment: keep the take's own tail after '엄마야' (its out-breath / room) up to 0.8 s
                p_end = ph[-1][1] + int(0.06 * SR)
                breath = x[p_end:p_end + int(0.8 * SR)]
                breath_level = round(active_rms_db(breath, SR) - active_rms_db(x, SR), 1) if len(breath) > int(0.1 * SR) else None
                i0 = place[-1][1]
            else:
                breath_level = round(active_rms_db(breath, SR) - active_rms_db(x, SR), 1)
                i0 = place[-1][1] + int(0.05 * SR)
            if len(breath):
                i1 = min(len(out), i0 + len(breath))
                tail = breath[:i1 - i0].copy()
                fo = np.linspace(1, 0, len(tail)) ** 1.5
                out[i0:i1] += tail * fo
                place.append((i0, i1))
            out = level(out)
            room_tone = filt(np.random.default_rng(17).normal(0, 1, len(out)), SR, 120, 3000)
            out = out + room_tone * 10 ** (-66 / 20) / (np.sqrt(np.mean(room_tone ** 2)) + 1e-12)
            write(os.path.join(AUD_OUT, name + '.wav'), out, SR)
            d = stats(out)
            d['cuts_s'] = [[round(a / SR, 2), round(b / SR, 2)] for a, b in place[:3]]
            d['breath_rel_db'] = breath_level
            if len(place) > 3 and breath_level is not None and breath_level > -40:
                d['breath_s'] = [round(place[3][0] / SR, 2), round(place[3][1] / SR, 2)]
            d['rec_offset_s'] = 0.6
            d['wsola_rates'] = rates
            d['speech_s'] = round(sum((b - a) for a, b in place[:3]) / SR, 2)
            d['voiced_take'] = round(voiced_fraction(x, SR), 2)
        elif kind == 'mom_okay':
            x = denoise_gate(x, SR, -42)
            segs = segments(x, SR, 0.16, -36)
            gi = max(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1]) if len(segs) > 1 else None
            if gi is not None:
                s1 = x[segs[0][0]:segs[gi][1] + int(0.05 * SR)]; s2 = x[segs[gi + 1][0] - int(0.02 * SR):segs[-1][1] + int(0.12 * SR)]
                gap = (segs[gi + 1][0] - segs[gi][1]) / SR
            else:
                s1, s2, gap = x, np.zeros(0), 0.0
            T, tol = j['target_s'], j['tol_s']
            speech = (len(s1) + len(s2)) / SR
            gap = float(np.clip(T - 0.15 - speech, 0.25, 0.7)) if speech < T else 0.3
            y = np.concatenate([np.zeros(int(0.05 * SR)), s1, np.zeros(int(gap * SR)), s2, np.zeros(int(0.1 * SR))])
            rate = 1.0
            if len(y) / SR > T + tol:
                rate = min(1.15, (len(y) / SR) / T)
                y = wsola(np.concatenate([y, np.zeros(int(0.08 * SR))]), rate, SR)[:int(len(y) / rate)]
            y = level(y)
            write(os.path.join(AUD_OUT, name + '.wav'), y, SR)
            d = stats(y)
            c1 = (0.05, 0.05 + len(s1) / SR); c2 = (c1[1] + gap, c1[1] + gap + len(s2) / SR)
            d['cuts_s'] = [[round(c1[0] / rate, 2), round(c1[1] / rate, 2)], [round(c2[0] / rate, 2), round(c2[1] / rate, 2)]]
            d['wsola_rate'] = round(rate, 3)
        elif kind == 'sea_name':
            vf = voiced_fraction(x, SR)
            whispered = False
            if vf > j['voiced_max']:
                # gpt-4o-mini-tts 'shimmer' gives a breathy VOICED take for 'pure whisper' (ep1 v_sea_mono measures
                # 0.83 voiced too); 3 takes were 0.64 / 0.74 / 0.85 -> noise-excited re-synthesis of the take instead
                x = filt(whisperize(x, SR), SR, j['hp'], j['lp']); whispered = True
            segs = segments(x, SR, 0.12, -40)
            a0, a1 = segs[0][0], segs[-1][1]
            pre = int(0.06 * SR)
            y = x[max(0, a0 - pre):a1 + int(0.08 * SR)]
            maxn = int(j['max_s'] * SR)
            if len(y) > maxn:
                rate = (len(y) / SR) / (j['max_s'] - 0.02)
                if rate <= 1.2:
                    y = wsola(np.concatenate([y, np.zeros(int(0.08 * SR))]), rate, SR)[:int(len(y) / rate)]
                y = y[:maxn]
            y = fade(y, 0.03)
            y = level(y)
            write(os.path.join(AUD_OUT, name + '.wav'), y, SR)
            d = stats(y)
            d['voiced_frac_take'] = round(vf, 3); d['voiced_frac_out'] = round(voiced_fraction(y, SR), 3)
            d['whisperized'] = whispered
            d['voiced_ok'] = bool(d['voiced_frac_out'] <= j['voiced_max'])
            # level in the recording: placed at r 21.00–21.80 with its peak at −30 dBFS (no gain, EQ, NR after that)
            g = -30.0 - d['peak_dbfs']
            d['mix_gain_db'] = round(g, 1)
            d['rms_db'] = round(d['rms_active_dbfs'] + g, 1)       # the RMS the whisper.name fallback matches
            d['rec_at_s'] = [21.0, 21.8]
        else:
            raise SystemExit('unknown post ' + kind)
        d['take'] = j.get('take', name); d['voice'] = j['voice']
        report[name] = d; print(name, d, flush=True)
    json.dump(report, open(rep_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


# ================================================================ ep3/js/data/assets.js
REUSE = {'avatar_sea': '../assets/img/avatar_sea.jpg', 'avatar_mom': '../assets/img/avatar_mom.jpg',
         'avatar_jimin': '../assets/img/avatar_jimin.jpg', 'avatar_sagongsa': '../assets/img/avatar_sagongsa.jpg',
         'kongi_old': '../assets/img/kongi_old.jpg', 'dog_face': '../assets/img/dog_face.jpg',
         'dog_park': '../assets/img/dog_park.jpg', 'dog_bed': '../assets/img/dog_bed.jpg',
         'kongi_santa': '../ep2/assets/img/kongi_santa.jpg'}
FINAL_KEYS = [
    'r3_door', 'r3_veranda', 'r3_sofa', 'r3_kitchen', 'r3_kitchen_lit', 'r3_sr_desk', 'r3_sr_desk_dim', 'r3_sr_bed',
    'r3_sr_bed_dim', 'x3_mom_table', 'x3_mom_table_lit', 'x3_phone_down', 'x3_mom_bed', 'x3_mom_bed_dim',
    'x3_jimin_sleep', 'x3_kongi_sleep', 'x3_kongi_door', 'x3_kongi_feet', 'x3_mom_hall', 'x3_hook_empty', 'x3_flame',
    'c3_phone_ring', 'c3_phone_ring_lit', 'c3_mom_hands', 'c3_lockpanel', 'c3_shoes', 'c3_shoes_nocollar', 'c3_orgel_spot',
    'c3_manual', 'c3_drawing', 'c3_drawing_back', 'c3_doorframe', 'c3_pot', 'c3_pot_lit', 'c3_window',
    'p3_kongi_1130', 'p3_kongi_1213', 'p3_child_back', 'p3_child_hands', 'p3_soup_2601', 'p3_church', 'p3_cake_2411',
    'p3_home_wall', 't3_title', 'og_ep3', 'icon_ep3', 'icon_ep3_192']
PRELOAD_GROUPS = {   # §9.8 lazy bundles (title first, then start, M0 + 30 s idle, gotPhone idle, M2, M5, M7)
    'title': ['t3_title'],
    'start': ['r3_door', 'r3_veranda', 'r3_sofa', 'r3_kitchen', 'x3_mom_table', 'x3_phone_down', 'x3_kongi_sleep', 'x3_jimin_sleep'],
    'm0idle': ['c3_phone_ring', 'c3_mom_hands', 'kongi_old'],
    'gotPhone': ['r3_sr_desk_dim', 'r3_sr_bed_dim', 'x3_mom_bed_dim', 'p3_kongi_1130', 'p3_kongi_1213', 'p3_child_back',
                 'p3_child_hands', 'p3_soup_2601', 'p3_church', 'p3_cake_2411', 'dog_face', 'dog_bed', 'kongi_santa',
                 'c3_lockpanel', 'c3_shoes', 'c3_pot', 'c3_window'],
    'm2': ['p3_home_wall', 'dog_park', 'c3_orgel_spot'],
    'm5': ['x3_kongi_door', 'x3_mom_hall', 'r3_sr_desk', 'r3_sr_bed', 'x3_mom_bed', 'c3_manual', 'c3_drawing',
           'c3_drawing_back', 'c3_doorframe'],
    'm7': ['r3_kitchen_lit', 'x3_mom_table_lit', 'x3_kongi_feet', 'x3_hook_empty', 'c3_pot_lit', 'x3_flame',
           'c3_shoes_nocollar', 'c3_phone_ring_lit'],
}


def write_assets_js():
    files = {os.path.splitext(f)[0]: f for f in os.listdir(OUT) if f.endswith(('.jpg', '.png', '.webp'))}
    meta = {k: v for k, v in json.load(open(META_PATH, encoding='utf-8')).items() if not k.startswith('_')}
    phs = json.load(open(META_PATH, encoding='utf-8')).get('_placeholders', [])
    rep_p = os.path.join(TTS_WORK, '_report.json')
    rep = json.load(open(rep_p, encoding='utf-8')) if os.path.exists(rep_p) else {}
    aud = sorted(os.path.splitext(f)[0] for f in os.listdir(AUD_OUT) if f.endswith('.wav')) if os.path.isdir(AUD_OUT) else []
    L = []; w = L.append
    w('/* Episode 3 asset registry — GENERATED by tools/post_ep3.py (write_assets_js); do not edit by hand.')
    w(' * Keys = DESIGN_EP3 §8.3-1 (+ §8.1 reuse of ep1 / ep2 files, referenced in place — never copied).')
    w(' * Paths are relative to ep3/index.html. A key whose file is missing is \'\' -> the renderer\'s §9.8 fallback.')
    w(' * x3_* are FULL-CANVAS RGBA overlays of the view they sit on (place at 0,0,100%,100%); x3_flame sits on c3_pot_lit')
    w(' * with mix-blend-mode: screen. r3_door overlays draw in G.IMGMETA.r3_door.z_order (bottom -> top: x3_kongi_sleep,')
    w(' * x3_kongi_door, x3_mom_hall, x3_hook_empty); G.IMGMETA.r3_door.occluders.led_door = ["x3_mom_hall"]: hide the')
    w(' * .led3 dot while that overlay is shown (it covers the lock). x3_mom_table_lit / x3_kongi_feet: dog above mom.')
    w(' * G.IMGMETA = meta.json inline (file:// safe): per image key, coordinates are fractions (0–1) of that image;')
    w(' * points [x,y], rects {x,y,w,h}, clock_c {cx,cy,rx,ry,rot} (rx of W, ry of H), burner_q {cx,cy,rx,ry}. */')
    w('(function () {')
    w("  'use strict';")
    w('  const G = (window.G = window.G || {});')
    w("  const P = 'assets/img/';")
    w('  G.IMG = {')
    for k in FINAL_KEYS:
        w(f"    {k}: " + (f"P + '{files[k]}'," if k in files else "'',   // MISSING -> §9.8 fallback"))
    w('    // §8.1 reuse (ep1 assets/img · ep2 ep2/assets/img), referenced in place')
    for k, p in REUSE.items():
        w(f"    {k}: '{p}',")
    w('  };')
    if phs: w('  G.IMG_PLACEHOLDER = ' + json.dumps(sorted(phs)) + ';   // local stand-ins (quota stop) — re-run after a top-up')
    w('  G.IMGMETA = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';')
    w('  G.AUDIO_FILES = ' + json.dumps(aud) + ';   // under G.AUDIO_BASE (assets/audio/), .wav 22.05 kHz mono')
    am = {}
    for k, v in rep.items():
        if isinstance(v, dict):
            am[k] = {kk: v[kk] for kk in ('dur_s', 'cuts_s', 'breath_s', 'rec_offset_s', 'rms_db', 'mix_gain_db', 'rec_at_s',
                                          'peak_dbfs', 'rms_active_dbfs') if kk in v}
    w('  G.AUDIO_META = ' + json.dumps(am, separators=(',', ':')) + ';')
    w('  G.ASSET = { title: G.IMG.t3_title, og: G.IMG.og_ep3, icon: G.IMG.icon_ep3, icon192: G.IMG.icon_ep3_192 };')
    w('  G.PRELOAD = [G.IMG.t3_title];')
    w('  G.PRELOAD_GROUPS = {')
    for g, members in PRELOAD_GROUPS.items():
        w(f"    {g}: [{', '.join('G.IMG.' + m for m in members)}],")
    w('  };')
    w('})();')
    os.makedirs(os.path.join(REPO, 'ep3', 'js', 'data'), exist_ok=True)
    open(os.path.join(REPO, 'ep3', 'js', 'data', 'assets.js'), 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')
    print('assets.js:', sum(k in files for k in FINAL_KEYS), '/', len(FINAL_KEYS), 'ep3 keys +', len(REUSE), 'reuse ·', len(aud), 'audio')


# ================================================================ set C continuity facts (AD review 2026-11-27 — for the §8.4 hand-off
# README in docs/setC/, which this tool does not write; kept in meta.json '_setC_continuity', not in G.IMGMETA)
SETC_CONTINUITY = {
    'a_chairs': 'r3_kitchen and p3_soup_2601 show only 3 chairs: the table’s right side stands against the wall. The '
                'fourth chair of the ep8 epilogue (§0.1 #25, §8.4) has to be ADDED on the near side by that edit.',
    'b_seah_door_hinge': 'Seah’s door is hinged on the LEFT as seen from the living room (r3_door) and on the LEFT as seen '
                         'from inside (r3_sr_bed) — the two views are mirrored. Later edits keep each view as it is.',
    'c_front_door_hinge': 'p3_kongi_1130 shows the front door hinged on the RIGHT; r3_door, c3_lockpanel and p3_kongi_1213 '
                          'put the lever on the right (= hinges on the left). The ep8 open-door edit follows r3_door.',
    'd_seah_room_plan': 'Views A (r3_sr_desk) and B (r3_sr_bed) do not share one floor plan (B has the desk at lower right '
                        'and a second white bookshelf at left). Ep10 should not try to make A and B agree.',
    'rule': 'captions and hotspots never state a left/right relationship between these views.',
}


# ================================================================ runner
ORDER = ['bases', 'patches', 'props', 'closeups', 'photos', 'meta_art']


def run(names):
    by = {f.__name__: f for f in STEPS}
    if not names: QA.clear()
    for n in ORDER:
        if names and n not in names: continue
        t = time.time()
        try:
            by[n](); print(f'[{n}] ok {time.time() - t:.1f}s', flush=True)
        except Missing as e:
            MISSING.append(f'{n}: source {e} missing'); print(f'[{n}] MISSING {e}', flush=True)
        except Exception as e:
            import traceback; traceback.print_exc(); MISSING.append(f'{n}: ERROR {e!r}')
    if MISSING: QA['missing'] = MISSING
    else: QA.pop('missing', None)
    # placeholder marking: a final key built from any stand-in source
    phs = set(META.get('_placeholders', [])) if names else set()
    for k, srcs in SRC_OF.items():
        if any(is_ph(s) for s in srcs if s): phs.add(k)
        else: phs.discard(k)
    META['_placeholders'] = sorted(phs)
    META['_setC_continuity'] = SETC_CONTINUITY
    META['ref_rects'] = ref_rects()
    txt = json.dumps(META, ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    open(META_PATH + '.tmp', 'w', encoding='utf-8').write(txt); os.replace(META_PATH + '.tmp', META_PATH)
    print('\n'.join(LOG[-200:]))
    print('MISSING:', MISSING or 'none', '· placeholders:', sorted(phs) or 'none')
    write_assets_js()


def ref_rects():
    """§8.2: the ref crop rectangles (= close-up crossfade mapping), from work/gen_ep3/_crops.json."""
    try:
        from prep_ep3 import load_crops
        c = load_crops()
        return {k: {'src': ('r3_' + v['src'][5:]) if v['src'].startswith('g_r3_') else v['src'],
                    'x': v['x'], 'y': v['y'], 'w': v['w'], 'h': v['h']} for k, v in c.items()}
    except Exception as e:
        return {'_error': str(e)}


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--measure':
        import qa_ep3
        for n in args[1:]: qa_ep3.grid(n)
    elif args and args[0] == '--placeholders':
        make_placeholders(args[1] if len(args) > 1 else 'insufficient_quota')
    elif args and args[0] == '--tts-gen':
        tts_gen(args[1:] or None)
    elif args and args[0] == '--tts-regen':
        tts_gen(args[1:] or None, force=True)
    elif args and args[0] == '--tts-post':
        tts_post(args[1:] or None)
    elif args and args[0] == '--assets-js':
        write_assets_js()
    else:
        run([a for a in args if not a.startswith('--')])
