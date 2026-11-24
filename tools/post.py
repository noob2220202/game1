"""Build all final game images from generated sources (Photoshop-style compositing)."""
import sys, os, json, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps
sys.path.insert(0, os.path.dirname(__file__))
from fx import *
import qrcode

random.seed(7); np.random.seed(7)
META = {}
os.makedirs(OUT, exist_ok=True)

def jpg(im, name, q=84, maxw=None):
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.convert('RGB').save(OUT + name + '.jpg', quality=q, optimize=True, progressive=True)

def png(im, name):
    im.save(OUT + name + '.png', optimize=True)

def ts_burn(im, text, size=None, pos='br'):
    d = ImageDraw.Draw(im)
    size = size or int(im.height * 0.026)
    f = font(FONT_BOLD, size)
    w = d.textlength(text, font=f)
    x = im.width - w - im.width * 0.04 if pos == 'br' else im.width * 0.04
    y = im.height - size * 2.2
    d.text((x, y), text, font=f, fill=(255, 196, 80), stroke_width=2, stroke_fill=(20, 12, 0))
    return im

def nv(im, green=True, amt=12):
    g = ImageOps.grayscale(im)
    g = ImageEnhance.Contrast(g).enhance(1.15)
    a = np.asarray(g).astype(np.float32) / 255
    rgb = np.stack([a * 0.55, a * 1.0, a * 0.6], -1) if green else np.stack([a, a, a], -1)
    out = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    return grain(out, amt)

def feather_patch(src, box, feather=10):
    """full-frame transparent PNG containing src[box] with feathered alpha"""
    W, H = src.size
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    crop = src.crop(box).convert('RGBA')
    m = Image.new('L', crop.size, 0)
    ImageDraw.Draw(m).rectangle([feather, feather, crop.width - feather, crop.height - feather], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(feather / 2))
    crop.putalpha(m)
    lay.paste(crop, box[:2], crop)
    return lay

# ------------------------------------------------------------------ room views
for n in ['room_bed', 'room_window', 'room_wardrobe']:
    jpg(load(n), n)

# door + management sticker with real QR under the peephole
door = load('room_door').convert('RGBA')
qr = qrcode.QRCode(border=1, box_size=4); qr.add_data('https://haru.pengueverything.cloud/q/404.html'); qr.make(fit=True)
qimg = qr.make_image(fill_color='black', back_color='white').convert('RGB')
st = Image.new('RGB', (360, 250), (246, 244, 238))
d = ImageDraw.Draw(st)
d.rectangle([0, 0, 359, 54], fill=(32, 78, 140))
d.text((14, 10), '해솔빌 관리사무소', font=font(FONT_BOLD, 26), fill='white')
d.text((14, 66), '☎ 02-338-5120', font=font(FONT_BOLD, 30), fill=(20, 20, 20))
d.text((14, 108), '평일 09:00–18:00', font=font(FONT_SANS, 20), fill=(60, 60, 60))
d.text((14, 140), '시설 고장신고', font=font(FONT_BOLD, 21), fill=(32, 78, 140))
d.text((14, 168), 'QR을 찍어 접수하세요', font=font(FONT_SANS, 17), fill=(80, 80, 80))
d.text((14, 200), '※ 관리실은 새벽에 개인 연락을', font=font(FONT_SANS, 14), fill=(120, 40, 40))
d.text((14, 220), '   하지 않습니다', font=font(FONT_SANS, 14), fill=(120, 40, 40))
qs = qimg.resize((130, 130), Image.NEAREST); st.paste(qs, (218, 100))
st = grain(st, 5).filter(ImageFilter.GaussianBlur(0.4))
# sticker quad on the door (slight perspective), under the peephole (~465,700)
quad = [(418, 742), (512, 744), (511, 808), (418, 806)]
door = perspective_paste(door.convert('RGB'), st.convert('RGBA'), quad)
# darken sticker to match scene light
a = np.asarray(door).astype(np.float32)
x0, y0, x1, y1 = 412, 738, 518, 812
a[y0:y1, x0:x1] *= 0.62
door = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
jpg(door, 'room_door', q=90)
META['door_sticker'] = {'x': 418 / 1024, 'y': 742 / 1536, 'w': 94 / 1024, 'h': 66 / 1536, 'qr': {'x': (418 + 94 * 218 / 360) / 1024, 'y': (742 + 66 * 100 / 250) / 1536, 'w': 94 * 130 / 360 / 1024, 'h': 66 * 130 / 250 / 1536}}
META['door_lock'] = {'x': 0.545, 'y': 0.48, 'w': 0.07, 'h': 0.08}
META['peephole'] = {'x': 0.44, 'y': 0.44, 'w': 0.05, 'h': 0.035}

# door guard latched patch (full frame, from the edited image)
dg = load('door_guard')
png(feather_patch(dg, (530, 660, 650, 760), 8), 'patch_doorguard_latched')

# wardrobe gap stages (full frame overlays). gap at x~520, y 330..1245
W, H = 1024, 1536
fing = load('fingers_gap')
for stage, wpx in [(1, 4), (2, 9), (3, 15), (4, 24)]:
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    m = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(m)
    dm.rectangle([520 - wpx // 2, 334, 520 + wpx // 2, 1242], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(1.2))
    black = Image.new('RGBA', (W, H), (4, 3, 3, 255)); black.putalpha(m)
    lay = Image.alpha_composite(lay, black)
    if stage >= 3:
        # pale fingertips curling around the left door edge at ~y 700
        f = fing.crop((300, 450, 780, 1150)).resize((64, 92), Image.LANCZOS)
        fa = ImageOps.grayscale(f); fa = fa.point(lambda v: 0 if v < 40 else min(255, (v - 40) * 2))
        f = ImageEnhance.Brightness(f).enhance(0.55).convert('RGBA'); f.putalpha(fa)
        lay.alpha_composite(f, (520 - wpx // 2 - 40, 640))
    if stage >= 4:
        dd = ImageDraw.Draw(lay)
        dd.ellipse([516, 560, 520, 563], fill=(220, 215, 200, 255))
        dd.ellipse([525, 561, 528, 564], fill=(200, 195, 180, 200))
    png(lay, f'gap_stage_{stage}')

# drying rack fallen patch: darken the rack area and draw a fallen rack silhouette
lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ward = load('room_wardrobe')
# cover standing rack with wall/floor-ish blur from neighbours
reg = ward.crop((170, 760, 330, 1330)).filter(ImageFilter.GaussianBlur(28))
regA = reg.convert('RGBA'); mm = Image.new('L', reg.size, 0); ImageDraw.Draw(mm).rectangle([8, 8, reg.width - 8, reg.height - 8], fill=255); regA.putalpha(mm.filter(ImageFilter.GaussianBlur(6)))
lay.alpha_composite(regA, (170, 760))
dd = ImageDraw.Draw(lay)
for k in range(6):
    dd.line([(120 + k * 8, 1300 - k * 4), (420 + k * 6, 1380 - k * 3)], fill=(90, 95, 120, 220), width=3)
dd.line([(110, 1300), (430, 1385)], fill=(60, 66, 100, 240), width=6)
# (rack patch dropped: looked fake)

# duvet dent: soft shadow ellipse on the bed (room_bed, bed top ~ y 940..1000, x 330..760)
lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(lay)
dd.ellipse([470, 930, 640, 985], fill=(0, 0, 0, 90))
lay = lay.filter(ImageFilter.GaussianBlur(14)); png(lay, 'patch_duvet_dent')

# water glass half / empty (glass ~ (880, 905..950) on room_bed)
bed = load('room_bed')
for nm, lvl in [('patch_glass_half', 0.5), ('patch_glass_empty', 0.0)]:
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = bed.crop((866, 896, 900, 965)).convert('RGBA')
    a = np.asarray(g).astype(np.float32)
    h = a.shape[0]; cut = int(h * (0.35 + (1 - lvl) * 0.5))
    a[int(h * 0.3):cut, :, :3] = a[int(h * 0.3):cut, :, :3] * 0.82 + 30
    g = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    lay.paste(g, (866, 896)); png(lay, nm)

# ------------------------------------------------------------------ lock / polaroid in clear case
cb = load('case_back')
pol = load('dog_face').crop((112, 200, 912, 1000)).resize((300, 300), Image.LANCZOS)
pol = grade(pol, r=1.06, g=1.0, b=0.9, sat=0.85, contrast=0.92, lift=10)
cb = cb.copy(); cb.paste(pol, (358, 545))
cb = handwrite(cb, '콩이 우리집 온 날', (372, 880), size=44, color=(40, 40, 70), angle=-2)
cb = handwrite(cb, '♥', (640, 868), size=40, color=(200, 50, 80), angle=0, font_path=FONT_BOLD)
cb = handwrite(cb, '3.17', (560, 955), size=56, color=(170, 40, 60), angle=-4)
# subtle plastic sheen
sheen = Image.new('RGBA', cb.size, (0, 0, 0, 0)); ds = ImageDraw.Draw(sheen)
ds.polygon([(320, 300), (420, 300), (300, 1250), (200, 1250)], fill=(255, 255, 255, 18))
cb = Image.alpha_composite(cb.convert('RGBA'), sheen.filter(ImageFilter.GaussianBlur(20))).convert('RGB')
jpg(cb, 'case_back', q=88)
META['case_date'] = {'x': 548 / 1024, 'y': 945 / 1536, 'w': 130 / 1024, 'h': 80 / 1536}

# ------------------------------------------------------------------ simple exports
for n, q in [('dog_bed', 82), ('dog_park', 82), ('dog_face', 84), ('hallway', 80), ('hallway_eps', 80), ('building', 80), ('dawn_exterior', 84),
             ('sea_room_1yr', 84), ('keypad', 86), ('js2_hallway', 88), ('door_ajar_guard', 84), ('room_lit_nest', 86), ('kongi_old', 86), ('gap_closeup', 84)]:
    jpg(load(n), n, q=q)
for n in ['mo_clothes', 'mo_sky', 'mo_laptop', 'mo_mandarin', 'mo_mug', 'mo_mixdesk']:
    im = grade(load(n), r=1.04, g=1.0, b=0.96, sat=1.05)
    jpg(im.resize((800, 800), Image.LANCZOS), n, q=82)

# ------------------------------------------------------------------ bowl close-up (P1 alt)
try:
    bw = load('bowl_under_bed')
    # find the label: put sticker text near the image center-bottom; position chosen generically
    bw = handwrite(bw, '콩이', (462, 668), size=40, color=(60, 40, 50), angle=-2)
    bw = handwrite(bw, '♥', (535, 672), size=30, color=(200, 60, 90), angle=0, font_path=FONT_BOLD)
    bw = handwrite(bw, 'since 2023.03.17', (452, 716), size=24, color=(60, 40, 50), angle=-2)
    jpg(bw, 'bowl_closeup', q=86)
except FileNotFoundError:
    print('bowl_under_bed missing (later)')

# ------------------------------------------------------------------ LIVE orgel frames
ol = load('sea_orgel_live')
jpg(ol, 'sea_orgel_live', q=86)
for k, wpx in [(1, 7), (2, 14)]:
    im = ol.copy().convert('RGBA'); dd = ImageDraw.Draw(im)
    # dark wedge along the wardrobe door edge (x ~ 250..262)
    m = Image.new('L', im.size, 0); dm = ImageDraw.Draw(m)
    dm.polygon([(252, 250), (252 + wpx, 252), (252 + wpx, 1220), (252, 1222)], fill=255)
    blk = Image.new('RGBA', im.size, (5, 4, 4, 255)); blk.putalpha(m.filter(ImageFilter.GaussianBlur(1)))
    im = Image.alpha_composite(im, blk)
    if k == 2:
        f = fing.crop((300, 450, 780, 1150)).resize((52, 76), Image.LANCZOS)
        fa = ImageOps.grayscale(f).point(lambda v: 0 if v < 40 else min(255, (v - 40) * 2))
        f = ImageEnhance.Brightness(f).enhance(0.8).convert('RGBA'); f.putalpha(fa)
        im.alpha_composite(f, (214, 430))
    jpg(im.convert('RGB'), f'sea_orgel_live_{k}', q=86)

# ------------------------------------------------------------------ vault photos (timestamps)
v1, v2 = load('vault_sea_1'), load('vault_sea_2')
vs = [
    (v1, '2025.04.02 03:12', False, 1.0), (v2, '2025.06.18 02:40', False, 1.0), (v1, '2025.07.11 03:20', True, 0.9),
    (v2, '2025.09.30 03:05', True, 0.85), (v1, '2025.10.21 02:58', False, 0.8), (v2, '2025.11.20 03:33', False, 0.75),
]
for i, (src, ts, flip, br) in enumerate(vs, 1):
    im = src.copy()
    if flip: im = ImageOps.mirror(im)
    im = im.crop((int(30 * i), int(20 * i), 1024 - int(18 * i), 1536 - int(26 * i))).resize((1024, 1536), Image.LANCZOS)
    im = grain(ImageEnhance.Brightness(im).enhance(br), 7)
    jpg(ts_burn(im, ts), f'vault_sea_{i}', q=80, maxw=768)
vh = load('vault_haru_sleep'); jpg(ts_burn(grain(vh.copy(), 6), '2026.11.24 02:47'), 'vault_haru_sleep', q=82, maxw=768)
vb = load('vault_haru_boxes'); jpg(ts_burn(grain(vb.copy(), 6), '2026.11.23 21:10'), 'vault_haru_boxes', q=82, maxw=768)
# IMG_0310: blurry daylight of sea at the door from inside wardrobe -> reuse sea_room_1yr? make a warm blurred crop of room_door
im = load('room_door').crop((200, 380, 824, 1316)).resize((1024, 1536), Image.LANCZOS)
im = grade(im, r=1.15, g=1.05, b=0.9, bright=1.5, gamma=0.8).filter(ImageFilter.GaussianBlur(3))
lay = Image.new('RGB', im.size, (0, 0, 0)); im = Image.blend(im, lay, 0.15)
ar = np.asarray(im).astype(np.float32); Hh, Ww = ar.shape[:2]
xs = np.linspace(-1, 1, Ww)[None, :]; ar *= (1 - 0.85 * (np.abs(xs) > 0.55))[..., None]
jpg(ts_burn(Image.fromarray(np.clip(ar, 0, 255).astype(np.uint8)), '2025.03.10 14:07'), 'vault_0310', q=80, maxw=768)
# moment crops of tonight
jpg(vh.crop((150, 500, 874, 1224)).filter(ImageFilter.GaussianBlur(8)).resize((800, 800)), 'mo_bed_blur', q=80)
jpg(load('room_door').crop((260, 1150, 760, 1450)).resize((800, 480)).crop((0, 0, 800, 480)), 'mo_sneakers', q=82)

# ------------------------------------------------------------------ shaft card (IMG_0606) + face
sc = load('shaft_card').copy()
card = Image.new('RGB', (420, 300), (236, 234, 226)); d = ImageDraw.Draw(card)
d.text((22, 18), '현관 도어락 관리자 카드', font=font(FONT_BOLD, 28), fill=(30, 30, 30))
d.line([(22, 62), (398, 62)], fill=(60, 60, 60), width=2)
d.text((22, 76), '관리자 비밀번호', font=font(FONT_SANS, 22), fill=(60, 60, 60))
card = handwrite(card, '4 7 2 9 0 6', (30, 140), size=92, color=(25, 25, 90), angle=-2)
# polaroid of the sleeping player covering the first four digits
p = vh.crop((180, 520, 860, 1200)).resize((210, 190)); pf = Image.new('RGB', (236, 246), (240, 238, 232)); pf.paste(p, (13, 12))
pf = pf.rotate(6, expand=True, fillcolor=(0, 0, 0)).convert('RGBA'); pfm = Image.new('L', pf.size, 0); ImageDraw.Draw(pfm).polygon([(12, 0), (pf.width, 12), (pf.width - 12, pf.height), (0, pf.height - 12)], fill=255)
pf.putalpha(pfm)
cardA = card.convert('RGBA'); cardA.alpha_composite(pf, (-6, 80)); card = cardA.convert('RGB')
card = grain(card, 4)
quad = [(326, 604), (650, 612), (646, 852), (322, 846)]
sc = perspective_paste(sc, card.convert('RGBA'), quad)
# relight card region to scene
ar = np.asarray(sc).astype(np.float32); ar[600:858, 318:656] *= 0.55; sc = Image.fromarray(np.clip(ar, 0, 255).astype(np.uint8))
# shoulder silhouette at right edge (very dark)
fc = load('fig_cap').crop((330, 280, 760, 900)).resize((300, 430))
silA = ImageOps.grayscale(fc).point(lambda v: 255 if v < 120 else 0).filter(ImageFilter.GaussianBlur(6))
sc_lit = sc.copy()
jpg(sc_lit, 'shaft_card_lit', q=86)

def darkify(im, maxv=14, sil=None):
    a = np.asarray(im).astype(np.float32) / 255.0
    a = np.power(a, 1.15) * maxv
    if sil is not None:
        a = np.where(sil[..., None] > 0.5, np.minimum(a, 1.2), a)
    a = a + np.random.uniform(-0.6, 0.6, a.shape)  # dither
    return Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8))
silmask = np.zeros((1536, 1024), np.float32)
sm = Image.new('L', (1024, 1536), 0); sm.paste(silA, (820, 700)); silmask = np.asarray(sm).astype(np.float32) / 255
png(darkify(sc, 14, silmask), 'shaft_card_dark')
png(darkify(load('shaft_face'), 14), 'shaft_face_dark')
META['shaft_gain'] = '1+17*e^1.6'

# ------------------------------------------------------------------ night-mode gap result
gc = load('gap_closeup')
g2 = grade(gc, gamma=0.6, bright=1.2, sat=0.35).filter(ImageFilter.GaussianBlur(1.4))
# the gap spans x ~450..640. Fill it with a lifted glimpse of the crawl space (plywood + card)
inside = grade(load('shaft_card').crop((60, 880, 300, 1300)), bright=0.5, gamma=0.95, sat=0.5).resize((180, 315))
mask = Image.new('L', inside.size, 0); ImageDraw.Draw(mask).rectangle([14, 10, inside.width - 14, inside.height - 10], fill=150)
g2.paste(inside, (456, 640), mask.filter(ImageFilter.GaussianBlur(12)))
# readable card digits (deep inside, small)
cardc = Image.new('RGB', (120, 60), (190, 188, 180)); dc = ImageDraw.Draw(cardc)
dc.text((60, 18), '관리자 비밀번호', font=font(FONT_SANS, 11), fill=(60, 60, 60), anchor='mm')
dc.text((60, 42), '●●●● 06', font=font(FONT_BOLD, 20), fill=(30, 30, 90), anchor='mm')
cardc = grade(cardc, bright=0.5).rotate(-3, expand=True, fillcolor=(40, 32, 26))
g2.paste(cardc, (486, 790))
# pale eye at the gap's left edge
eye = load('shaft_face').crop((780, 495, 900, 580)).resize((70, 50))
eye = ImageEnhance.Brightness(ImageOps.grayscale(eye).convert('RGB')).enhance(1.6)
em = Image.new('L', eye.size, 0); ImageDraw.Draw(em).ellipse([4, 6, 66, 44], fill=210)
eyeA = eye.convert('RGBA'); eyeA.putalpha(em.filter(ImageFilter.GaussianBlur(5)))
g2 = g2.convert('RGBA'); g2.alpha_composite(eyeA, (450, 560)); g2 = grain(g2.convert('RGB'), 10)
jpg(g2, 'gap_night', q=86)

# ------------------------------------------------------------------ fallback / nv images
hf = load('haru_fallback')
jpg(ts_burn(nv(hf), '2026.11.24 04:2' + str(random.randint(1, 8))), 'haru_fallback', q=84, maxw=768)
jpg(grade(hf, bright=0.35, sat=0.2), 'haru_fallback_dark', q=80, maxw=768)

# ------------------------------------------------------------------ alpha cutouts
def matte_from_grey(im, bg=(128, 128, 128), tol=40):
    a = np.asarray(im).astype(np.float32)
    # estimate bg from corners
    corners = np.concatenate([a[:20, :20].reshape(-1, 3), a[:20, -20:].reshape(-1, 3)])
    b = corners.mean(0)
    dist = np.sqrt(((a - b) ** 2).sum(-1))
    al = np.clip((dist - tol) * 6, 0, 255).astype(np.uint8)
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA'); out.putalpha(Image.fromarray(al).filter(ImageFilter.GaussianBlur(1.2)))
    return out
fc = matte_from_grey(load('fig_cap')); fc.thumbnail((512, 768)); png(fc, 'fig_cap')
fg = load('fingers_gap'); fa = ImageOps.grayscale(fg).point(lambda v: 0 if v < 30 else min(255, (v - 30) * 3))
fgA = fg.convert('RGBA'); fgA.putalpha(fa); fgA.thumbnail((512, 768)); png(fgA, 'fingers_gap')

# ------------------------------------------------------------------ avatars
def avatar(im, box, name, size=200):
    jpg(im.crop(box).resize((size, size), Image.LANCZOS), name, q=84)
avatar(load('kongi_old'), (250, 500, 900, 1150), 'avatar_mom')
avatar(load('mo_sky'), (200, 100, 800, 700), 'avatar_jimin')
avatar(load('building'), (300, 300, 800, 800), 'avatar_manager')
avatar(load('sea_orgel_live'), (330, 520, 600, 790), 'avatar_sea')
avatar(load('dog_face'), (200, 250, 850, 900), 'avatar_kongi')
Image.new('RGB', (200, 200), (6, 6, 6)).save(OUT + 'avatar_sagongsa.jpg', quality=80)

# ------------------------------------------------------------------ OG image + icon
og = load('room_wardrobe').crop((0, 450, 1024, 990)).resize((1200, 633), Image.LANCZOS)
og = grade(og, bright=0.55, sat=0.6); og = vignette(og, 0.75)
d = ImageDraw.Draw(og)
d.text((600, 250), '하루를 위한', font=font(FONT_BOLD, 64), fill=(235, 235, 235), anchor='mm')
d.text((600, 345), '방탈출!', font=font(FONT_BOLD, 96), fill=(200, 30, 30), anchor='mm')
d.text((600, 450), '새벽 3시 33분. 내 것이 아닌 휴대폰.', font=font(FONT_SANS, 30), fill=(170, 170, 170), anchor='mm')
jpg(og, 'og', q=86)
ic = Image.new('RGB', (512, 512), (8, 6, 6)); d = ImageDraw.Draw(ic)
d.rounded_rectangle([96, 60, 416, 452], 30, outline=(200, 30, 30), width=14)
d.line([(256, 80), (256, 432)], fill=(10, 8, 8), width=18)
d.text((256, 256), '404', font=font(FONT_BOLD, 120), fill=(230, 230, 230), anchor='mm', stroke_width=6, stroke_fill=(8, 6, 6))
ic.save(OUT + 'icon.png', optimize=True)

json.dump(META, open(OUT + '../meta.json', 'w'), ensure_ascii=False, indent=1)
print('done')
