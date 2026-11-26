"""Series handwriting (DESIGN_EP2 §8.3-7 — '6' rule). One shared function, imported by every episode.

His hand = ep1 tools/fx.py `handwrite()` itself (same function, same font pen.ttf = Nanum Pen Script,
same ink (25,25,90), same glyph-size : line-height ratio 1 : 1.15). Nothing here redraws a glyph: we call
fx.handwrite on a white canvas with black ink and read the coverage back as alpha, so the strokes are
bit-for-bit what ep1 produced for shaft_card_lit ('0 6'). The 5th-floor landlord writes with Gaegu (other hand).
"""
import os, sys, random
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
import fx

INK_HIM = (25, 25, 90)          # ep1 IMG_0606 ink
INK_PRINT = (30, 30, 30)        # printed form
INK_LANDLORD = (35, 35, 40)     # black ballpoint
FONT_PEN = fx.FONT_PEN
FONT_GAEGU = fx.SCR + '/fonts/gaegu.ttf'
LINE = 1.15                     # fx.handwrite line step = size * 1.15


PEN_DASH = 'ㅡ'   # pen.ttf / gaegu.ttf have no U+2014: a written dash is the same hand's long horizontal stroke


def pen_text(text):
    return text.replace('—', PEN_DASH).replace('–', PEN_DASH)


def hand_alpha(wh, text, xy, size, angle=-3, alpha=235, blur=0.6, seed=7, jitter=True, font_path=None):
    """Coverage (float32 0..1, HxW) of `text` written by fx.handwrite at xy on a canvas of size wh."""
    text = pen_text(text)
    st = random.getstate()
    random.seed(seed)
    try:
        white = Image.new('RGB', wh, (255, 255, 255))
        out = fx.handwrite(white, text, xy, size=size, color=(0, 0, 0), angle=angle, alpha=alpha, blur=blur,
                           jitter=jitter, font_path=font_path or FONT_PEN)
    finally:
        random.setstate(st)
    return 1.0 - np.asarray(out.convert('L')).astype(np.float32) / 255.0


def warp_alpha(a, base_size, quad):
    """Perspective-warp a coverage map (card space) into quad [TL, TR, BR, BL] of a base image."""
    h, w = a.shape
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    coeffs = fx._find_coeffs(quad, src)
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L')
    im = im.transform(base_size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255.0


def ink(base, a, color=INK_HIM, opacity=1.0, texture=None, mode='multiply'):
    """Lay ink coverage `a` onto base. multiply = ink sinks into paper/cardboard; texture (HxW 0..1) modulates it."""
    b = np.asarray(base.convert('RGB')).astype(np.float32)
    a = a * opacity
    if texture is not None:
        a = a * texture
    a = a[..., None]
    c = np.array(color, np.float32)
    if mode == 'multiply':
        out = b * (1 - a + a * c / 255.0)
    else:
        out = b * (1 - a) + c * a
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def write(base, text, xy, size, color=INK_HIM, angle=-3, alpha=235, blur=0.6, seed=7, opacity=1.0,
          texture=None, font_path=None, mode='multiply'):
    a = hand_alpha(base.size, text, xy, size, angle=angle, alpha=alpha, blur=blur, seed=seed, font_path=font_path)
    return ink(base, a, color, opacity, texture, mode)


def write_quad(base, text, quad, card_wh, xy, size, color=INK_HIM, angle=-3, alpha=235, blur=0.6, seed=7,
               opacity=1.0, texture=None, font_path=None, mode='multiply'):
    """Write on a flat 'card' of card_wh, then perspective-map the card into quad on base."""
    a = hand_alpha(card_wh, text, xy, size, angle=angle, alpha=alpha, blur=blur, seed=seed, font_path=font_path)
    aw = warp_alpha(a, base.size, quad)
    return ink(base, aw, color, opacity, texture, mode), aw


def glyph_mask(ch, size=200, font_path=None):
    """Height-normalised binary mask of one glyph as his hand draws it (no jitter/blur) — for the '6' IoU check."""
    a = hand_alpha((size * 2, size * 2), ch, (size // 2, size // 2), size, angle=0, alpha=255, blur=0, jitter=False,
                   font_path=font_path)
    m = a > 0.5
    ys, xs = np.where(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((int(128 * m.shape[1] / m.shape[0]) or 1, 128), Image.BILINEAR)
    return np.asarray(im) > 127


def iou(m1, m2):
    h = max(m1.shape[0], m2.shape[0]); w = max(m1.shape[1], m2.shape[1])
    a = np.zeros((h, w), bool); b = np.zeros((h, w), bool)
    a[:m1.shape[0], :m1.shape[1]] = m1; b[:m2.shape[0], :m2.shape[1]] = m2
    return (a & b).sum() / max(1, (a | b).sum())
