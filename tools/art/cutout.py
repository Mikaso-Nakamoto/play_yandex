#!/usr/bin/env python3
"""Вырезание сгенерированных картинок с однотонного фона и подготовка игровых PNG.

    python3 tools/art/cutout.py <вход.png> <выход.png> [--bg green|magenta|white] [--max 400] [--pad 6]
                                [--hue СДВИГ_ГРАДУСЫ] [--sat МНОЖИТЕЛЬ] [--val МНОЖИТЕЛЬ] [--png8]

--bg green    хромакей по чистому зелёному (#00FF00): мягкий край + подавление зелёной каймы (по умолчанию)
--bg magenta  то же для пурпурного (#FF00FF) — для зелёных объектов
--bg white    фон заливкой от краёв (для объектов с тёмной обводкой на белом)
--max         наибольшая сторона результата в пикселях (после обрезки по содержимому)
--scale       общий масштаб вместо --max — чтобы серия картинок (эмоции кота) была одного размера
--hue/--sat/--val  перекраска (сдвиг тона в градусах, множители насыщенности и яркости) — цветовые варианты кнопок
Зависимости: Pillow, numpy (pip install --user pillow numpy).
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def smoothstep(lo, hi, x):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def key_color(rgb, bg):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if bg == 'green':
        k = g - np.maximum(r, b)              # «зелёность»
    else:
        k = np.minimum(r, b) - g              # «пурпурность»
    alpha = 1 - smoothstep(40, 110, k)        # мягкий край
    out = rgb.copy()
    spill = np.clip(k, 0, None)
    if bg == 'green':                         # подавление каймы: зелёный не выше max(R, B)
        out[..., 1] = np.where(spill > 0, np.maximum(r, b), g)
    else:
        m = np.where(spill > 0, g, 0)
        out[..., 0] = np.where(spill > 0, np.minimum(r, m + (r - m) * 0.5), r)
        out[..., 2] = np.where(spill > 0, np.minimum(b, m + (b - m) * 0.5), b)
    return out, alpha


def key_white(img):
    """Белый фон: заливка от краёв в пурпурный, затем мягкий край по «белизне» у границы."""
    im = img.convert('RGB').copy()
    w, h = im.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if sum(im.getpixel(xy)) > 690:
            ImageDraw.floodfill(im, xy, (255, 0, 255), thresh=60)
    a = np.asarray(im).astype(np.float32)
    bgmask = (a[..., 0] > 250) & (a[..., 2] > 250) & (a[..., 1] < 5)
    near = np.asarray(Image.fromarray((bgmask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    src = np.asarray(img.convert('RGB')).astype(np.float32)
    whiteness = src.min(axis=2)
    alpha = np.ones(bgmask.shape, np.float32)
    alpha[bgmask] = 0
    edge = near & ~bgmask
    alpha[edge] = np.clip((255 - whiteness[edge]) / 70, 0, 1)
    return src, alpha


def recolor(rgba, hue_deg, sat, val):
    rgb = Image.fromarray(rgba[..., :3].astype(np.uint8)).convert('HSV')
    hsv = np.asarray(rgb).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + hue_deg / 360 * 256) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val, 0, 255)
    back = np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float32)
    out = rgba.copy()
    out[..., :3] = back
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--bg', default='green', choices=['green', 'magenta', 'white'])
    ap.add_argument('--max', type=int, default=400)
    ap.add_argument('--pad', type=int, default=6)
    ap.add_argument('--hue', type=float, default=0); ap.add_argument('--sat', type=float, default=1); ap.add_argument('--val', type=float, default=1)
    ap.add_argument('--png8', action='store_true', help='256-цветный PNG с альфой (в 5–12 раз меньше)')
    ap.add_argument('--scale', type=float, default=0, help='общий масштаб вместо --max (одинаковый размер у серии, например эмоций персонажа)')
    a = ap.parse_args()
    img = Image.open(a.src)
    if a.bg == 'white':
        rgb, alpha = key_white(img)
    else:
        rgb, alpha = key_color(np.asarray(img.convert('RGB')).astype(np.float32), a.bg)
    rgba = np.dstack([rgb, alpha * 255])
    if a.hue or a.sat != 1 or a.val != 1:
        rgba = recolor(rgba, a.hue, a.sat, a.val)
    out = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
    # обрезка по содержимому (мелкий мусор по краям игнорируется)
    m = np.asarray(out)[..., 3] > 24
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = out.crop((max(0, x0 - a.pad), max(0, y0 - a.pad), min(out.width, x1 + a.pad), min(out.height, y1 + a.pad)))
    k = a.scale if a.scale else a.max / max(out.size)
    if k < 1:
        out = out.resize((round(out.width * k), round(out.height * k)), Image.LANCZOS)
    if a.png8:
        out = out.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    out.save(a.dst, optimize=True)
    print(f'{a.dst}: {out.size[0]}x{out.size[1]}')


if __name__ == '__main__':
    main()
