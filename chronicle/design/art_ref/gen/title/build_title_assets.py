"""Build the title-screen assets (v2/assets/title/) from the raw generations in gen/title/raw/ (gitignored).

Inputs (raw/):  final16_style.png (wide key art, 2560x1440)      plate16_s.png      (same scene, hero inpainted out)
                phone_s.png    (phone key art, 1184x2560)      plate_phone_s.png  (same, hero inpainted out)
                logo_b.png     (generated logo, transparent)
Masks (MASKS dir, made with rembg isnet-general-use + hand clean-up): hero_mask_s.png, hero_mask_ps.png,
                inpaint_mask_s.png, inpaint_mask_ps.png (alpha 0 = area the model repainted)
Fonts: Shippori Mincho B1 ExtraBold (Google Fonts, OFL) for the re-set subtitle of the logo.

usage: python3 build_title_assets.py MASKS_DIR FONT_TTF
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.abspath(os.path.join(HERE, '../../../../v2/assets/title'))
MASKS, FONT = sys.argv[1], sys.argv[2]


def L(p):
    return Image.open(p)


def feather(mask_img, r):
    return mask_img.filter(ImageFilter.GaussianBlur(r))


def fix_plate(orig, plate, inpaint_rgba):
    """plate only where the model repainted (feathered), the original pixels everywhere else"""
    a = np.array(inpaint_rgba)[..., 3]
    m = Image.fromarray(np.where(a == 0, 255, 0).astype('uint8'))
    m = feather(m.filter(ImageFilter.MaxFilter(9)), 6)
    return Image.composite(plate.convert('RGB'), orig.convert('RGB'), m)


def ramp_mask(size, y0, y1):
    W, H = size
    col = np.clip((np.arange(H) - y0 * H) / ((y1 - y0) * H), 0, 1)
    return Image.fromarray((np.repeat(col[:, None], W, 1) * 255).astype('uint8'))


def poly_mask(size, pts, blur):
    W, H = size
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(x * W, y * H) for x, y in pts], fill=255)
    return feather(m, blur)


def rgba(img, mask):
    a = np.array(img.convert('RGBA'))
    a[..., 3] = np.array(mask)
    a[a[..., 3] == 0, :3] = 0          # empty pixels carry no colour (much smaller PNGs)
    return Image.fromarray(a)


def build(tag, orig, plate, inpaint, hero_mask, size, skyline, crag, blur):
    plate = fix_plate(orig, plate, inpaint)
    W, H = size
    rs = lambda im: im.resize(size, Image.LANCZOS) if im.size != size else im
    orig_r, plate_r = rs(orig.convert('RGB')), rs(plate)
    hm = rs(hero_mask.convert('L'))
    files = {
        'key': ('key_%s.png' % tag, orig_r),
        'sky': ('%s_0_sky.png' % tag, plate_r),
        'land': ('%s_1_land.png' % tag, rgba(plate_r, ramp_mask(size, *skyline))),
        'crag': ('%s_2_crag.png' % tag, rgba(plate_r, poly_mask(size, crag, blur))),
        'hero': ('%s_3_hero.png' % tag, rgba(orig_r, hm)),
    }
    for k, (name, im) in files.items():
        im.save(os.path.join(OUT, name), optimize=True)
    # check: the stacked layers at rest must equal the flat key art
    st = files['sky'][1].convert('RGBA')
    for k in ('land', 'crag', 'hero'):
        st.alpha_composite(files[k][1])
    d = np.abs(np.array(st.convert('RGB'), int) - np.array(orig_r, int)).mean()
    print(tag, 'stack vs key mean abs diff', round(float(d), 2))
    return {k: v[0] for k, v in files.items()}


def logo(font_path):
    im = L(os.path.join(RAW, 'logo_b.png')).convert('RGBA')
    a = np.array(im)
    # the generated subtitle drew an extra hook on 八; clear it and set 〜八つの灯火〜 in type instead
    a[686:763, 503:1031, 3] = 0
    im = Image.fromarray(a)
    text, size = '〜八つの灯火〜', 64
    f = ImageFont.truetype(font_path, size)
    track = 6
    widths = [f.getlength(c) for c in text]
    tw = sum(widths) + track * (len(text) - 1)
    cx, top = 767, 690
    x0 = cx - tw / 2
    layer = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(layer)
    x = x0
    for c, w in zip(text, widths):
        d.text((x, top), c, font=f, fill=255)
        x += w + track
    bb = layer.getbbox()
    # gold gradient fill
    H = im.size[1]
    grad = np.zeros((H, im.size[0], 3), 'float')
    ys = np.clip((np.arange(H) - bb[1]) / max(1, bb[3] - bb[1]), 0, 1)
    stops = [(0, (255, 244, 206)), (0.45, (242, 200, 104)), (0.75, (214, 154, 58)), (1, (150, 96, 34))]
    for i in range(H):
        t = ys[i]
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0)
                grad[i, :, :] = [c0[j] + (c1[j] - c0[j]) * k for j in range(3)]
                break
    fill = Image.fromarray(grad.astype('uint8'))
    outline = layer.filter(ImageFilter.MaxFilter(5))
    glow = feather(layer.filter(ImageFilter.MaxFilter(7)), 6)
    base = Image.new('RGBA', im.size, (0, 0, 0, 0))
    base.alpha_composite(rgba(Image.new('RGB', im.size, (255, 190, 90)), glow.point(lambda v: int(v * 0.35))))
    base.alpha_composite(rgba(Image.new('RGB', im.size, (26, 16, 8)), outline))
    base.alpha_composite(rgba(fill, layer))
    im.alpha_composite(base)
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bb)
    im.save(os.path.join(OUT, 'logo.png'), optimize=True)
    print('logo', im.size, 'cropped from', bb)
    return im.size, bb


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    wide = build('wide', L(os.path.join(RAW, 'final16_style.png')), L(os.path.join(RAW, 'plate16_s.png')),
                 L(os.path.join(MASKS, 'inpaint_mask_s.png')), L(os.path.join(MASKS, 'hero_mask_s.png')), (1920, 1080),
                 skyline=(0.30, 0.44),
                 crag=[(0.431, 1), (0.45, 0.911), (0.5, 0.878), (0.5625, 0.844), (0.566, 0.767), (0.619, 0.751), (0.9, 0.72),
                       (0.925, 0.733), (0.9625, 0.678), (1, 0.667), (1, 1)], blur=5)
    phone = build('phone', L(os.path.join(RAW, 'phone_s.png')), L(os.path.join(RAW, 'plate_phone_s.png')),
                  L(os.path.join(MASKS, 'inpaint_mask_ps.png')), L(os.path.join(MASKS, 'hero_mask_ps.png')), (1170, 2532),
                  skyline=(0.36, 0.47),
                  crag=[(0, 1), (0, 0.789), (0.253, 0.781), (0.49, 0.762), (0.493, 0.637), (0.726, 0.617), (0.794, 0.625),
                        (1, 0.617), (1, 1)], blur=4)
    lsize, lbb = logo(FONT)
    json.dump({'wide': wide, 'phone': phone, 'logo': {'size': lsize, 'crop': lbb}}, open(os.path.join(HERE, 'build_out.json'), 'w'), indent=1)
