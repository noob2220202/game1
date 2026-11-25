"""Photoshop-style post-processing helpers for the game's photos."""
import numpy as np, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps, ImageChops

import os as _os
REPO = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
# working folder for generated sources (gen/), fonts (fonts/) — not committed
SCR = _os.environ.get('HARU_WORK', _os.path.join(REPO, 'work'))
FONT_SANS = SCR + '/fonts/sans.ttf'
FONT_BOLD = SCR + '/fonts/sansb.ttf'
FONT_PEN = SCR + '/fonts/pen.ttf'
OUT = _os.environ.get('HARU_OUT', _os.path.join(REPO, 'assets', 'img')) + '/'

def load(name):
    return Image.open(f'{SCR}/gen/{name}.png').convert('RGB')

def save(im, name, q=84, size=None):
    if size:
        im = im.copy(); im.thumbnail(size, Image.LANCZOS)
    p = OUT + name + ('.png' if name.endswith('_png') else '')
    if name.endswith('.png'):
        im.save(OUT + name, optimize=True)
    else:
        im.save(OUT + name + '.jpg', quality=q, optimize=True, progressive=True)

def grain(im, amt=10, mono=True, seed=None):
    rng = np.random.default_rng(seed)
    a = np.asarray(im).astype(np.float32)
    if mono:
        n = rng.normal(0, amt, a.shape[:2])[..., None]
    else:
        n = rng.normal(0, amt, a.shape)
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))

def vignette(im, strength=0.6, power=2.2):
    w, h = im.size
    y, x = np.ogrid[:h, :w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2) / math.sqrt(2)
    m = 1 - strength * np.clip(d, 0, 1) ** power
    a = np.asarray(im).astype(np.float32) * m[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def grade(im, r=1.0, g=1.0, b=1.0, lift=0, gamma=1.0, sat=1.0, contrast=1.0, bright=1.0):
    if sat != 1: im = ImageEnhance.Color(im).enhance(sat)
    if contrast != 1: im = ImageEnhance.Contrast(im).enhance(contrast)
    if bright != 1: im = ImageEnhance.Brightness(im).enhance(bright)
    a = np.asarray(im).astype(np.float32) / 255
    a = np.power(np.clip(a, 0, 1), gamma)
    a = a * np.array([r, g, b]) + lift / 255
    return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))

def font(path, size):
    return ImageFont.truetype(path, size)

def text_layer(size, text, fnt, fill=(30, 30, 30, 255), xy=(0, 0), angle=0, spacing=6, anchor='la', stroke=0, stroke_fill=None):
    lay = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.multiline_text(xy, text, font=fnt, fill=fill, spacing=spacing, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)
    if angle:
        lay = lay.rotate(angle, resample=Image.BICUBIC, center=xy)
    return lay

def handwrite(im, text, xy, size=48, color=(25, 25, 40), angle=-3, alpha=235, blur=0.6, jitter=True, font_path=None):
    """Composite handwriting (ink look: slight blur, multiply)."""
    im = im.convert('RGBA')
    fnt = font(font_path or FONT_PEN, size)
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x, y = xy
    if jitter:
        for line in text.split('\n'):
            cx = x
            for ch in line:
                oy = random.uniform(-size * 0.04, size * 0.04)
                d.text((cx, y + oy), ch, font=fnt, fill=color + (alpha,))
                cx += d.textlength(ch, font=fnt) * random.uniform(0.96, 1.04)
            y += size * 1.15
    else:
        d.multiline_text(xy, text, font=fnt, fill=color + (alpha,))
    if angle:
        lay = lay.rotate(angle, resample=Image.BICUBIC, center=xy)
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(im, lay).convert('RGB')

def hidden_text(im, text, xy, size, level=6, fnt=None, angle=0, color=(1.0, 0.25, 0.2)):
    """Make the image near-black and hide text that only shows when brightness is boosted.
    `level` = how many 0..255 units brighter the text is than the background."""
    lay = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(lay)
    d.multiline_text(xy, text, font=fnt or font(FONT_PEN, size), fill=255, spacing=10)
    if angle: lay = lay.rotate(angle, resample=Image.BICUBIC, center=xy)
    lay = lay.filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(im).astype(np.float32)
    m = np.asarray(lay).astype(np.float32)[..., None] / 255
    a = a + m * level * np.array(color)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def crush(im, maxv=10):
    """Darken an image so its max value is around maxv (nearly black)."""
    a = np.asarray(im).astype(np.float32)
    a = a / 255.0
    a = np.power(a, 1.4) * maxv
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def polaroid(photo, caption_img_h=230, w=900, border=40, tint=(246, 243, 236)):
    p = photo.copy()
    pw = w - 2 * border
    ph = pw  # square photo
    # center-crop square
    s = min(p.size); l = (p.width - s) // 2; t = (p.height - s) // 2
    p = p.crop((l, t, l + s, t + s)).resize((pw, ph), Image.LANCZOS)
    card = Image.new('RGB', (w, border + ph + caption_img_h), tint)
    card.paste(p, (border, border))
    # paper texture
    card = grain(card, 4)
    return card

def cctv(im, label='CAM 01', ts='2026-11-24 03:33:12', rec=True):
    im = ImageOps.grayscale(im).convert('RGB')
    im = grade(im, contrast=1.15, gamma=1.05)
    im = grain(im, 9)
    d = ImageDraw.Draw(im)
    f = font(FONT_BOLD, int(im.height * 0.035))
    d.text((int(im.width * 0.025), int(im.height * 0.03)), f'{label}  {ts}', font=f, fill=(235, 235, 235), stroke_width=2, stroke_fill=(0, 0, 0))
    return im

def paste_rgba(base, overlay, xy):
    base = base.convert('RGBA'); base.alpha_composite(overlay, xy); return base.convert('RGB')

def perspective_paste(base, card, quad):
    """Paste `card` into quad [(x0,y0) TL, (x1,y1) TR, (x2,y2) BR, (x3,y3) BL] of base."""
    w, h = card.size
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    coeffs = _find_coeffs(quad, src)
    warped = card.convert('RGBA').transform(base.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    out = base.convert('RGBA'); out.alpha_composite(warped)
    return out.convert('RGB')

def _find_coeffs(pa, pb):
    matrix = []
    for p1, p2 in zip(pa, pb):
        matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
        matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
    A = np.matrix(matrix, dtype=float); B = np.array(pb).reshape(8)
    res = np.dot(np.linalg.inv(A.T * A) * A.T, B)
    return np.array(res).reshape(8)
