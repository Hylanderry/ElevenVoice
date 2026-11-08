"""ElevenVoice mark: '11' drawn as two level-meter columns; the second column's top
segment is lit amber, like the peak segment of an audio meter.

One geometry (64-unit grid) feeds the SVG and every raster icon, so they never drift.
Usage: uv run python scripts/generate_brand_icons.py electron [preview dir]
"""
import sys, pathlib
from PIL import Image, ImageDraw

TILE = '#17171A'
INK = '#F2EFE8'
PEAK = '#E8A33D'
TILE_RECT = (2, 2, 62, 62, 14)
# macOS icons follow Apple's grid: the tile body spans 824/1024 of the canvas.
MAC_PAD = (1 - (824 / 1024) / (60 / 64)) / 2
TOP, BASE = 17, 47           # glyph height
STEM, FLAG = 8, 6.5           # stem width, flag reach
ORIGINS = (21.5, 39.5)        # stem x of each '1'
SPLIT, GAP = 28, 2      # peak segment = the whole head (flag included); GAP separates it from the column


def one(ox):
    """Polygon of a flagged '1' whose stem starts at x=ox."""
    return [(ox - FLAG, TOP + 6), (ox, TOP), (ox + STEM, TOP), (ox + STEM, BASE),
            (ox, BASE), (ox, TOP + 7.5), (ox - FLAG, TOP + 11)]


def head(ox):
    """Lit peak segment of the second '1': flag plus the stem down to SPLIT."""
    return [(ox - FLAG, TOP + 6), (ox, TOP), (ox + STEM, TOP), (ox + STEM, SPLIT),
            (ox, SPLIT), (ox, TOP + 7.5), (ox - FLAG, TOP + 11)]


def column(ox):
    """Level column of the second '1', below the peak segment."""
    return [(ox, SPLIT + GAP), (ox + STEM, SPLIT + GAP), (ox + STEM, BASE), (ox, BASE)]


def pieces(mono=None):
    """(polygon, colour) in paint order. Shared by the SVG and the rasteriser."""
    ink = mono or INK
    peak = mono or PEAK
    a, b = ORIGINS
    return [(one(a), ink), (head(b), peak), (column(b), ink)]


def path_d(points):
    return 'M' + ' '.join(f'{x:g} {y:g}' for x, y in points) + 'Z'


def svg(label='ElevenVoice', tile=True, mono=None, extra='', size=None, doc=False):
    """Paths only (no clip paths), so tray templates can reuse the logo's exact `d`."""
    dims = f' width="{size}" height="{size}"' if size else ''
    if doc:
        out = [f'<svg xmlns="http://www.w3.org/2000/svg"{dims} viewBox="0 0 64 64" role="img" aria-labelledby="title description">',
               f'  <title id="title">{label}</title>',
               '  <desc id="description">The number 11 drawn as two audio level columns on a graphite tile; the top segment of the second column is lit amber like a meter\'s peak light.</desc>']
    else:
        out = [f'<svg xmlns="http://www.w3.org/2000/svg"{dims} viewBox="0 0 64 64" role="img" aria-label="{label}">']
    if tile:
        x0, y0, x1, y1, r = TILE_RECT
        out.append(f'  <rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="{r}" fill="{TILE}"/>')
    for poly, colour in pieces(mono):
        out.append(f'  <path d="{path_d(poly)}" fill="{colour}"/>')
    out.append(extra + '</svg>')
    return '\n'.join(out) + '\n'


def raster(size, tile=True, mono=None, pad=0.0):
    """Render at 8x and downsample. `pad` shrinks the art (macOS icon safe area)."""
    ss = 8
    big = size * ss
    scale = big / 64 * (1 - 2 * pad)
    off = big * pad
    s = lambda x, y: (off + x * scale, off + y * scale)
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if tile:
        x0, y0, x1, y1, r = TILE_RECT
        d.rounded_rectangle([s(x0, y0), s(x1, y1)], radius=r * scale, fill=TILE)
    for poly, colour in pieces(mono):
        d.polygon([s(*p) for p in poly], fill=colour)
    return img.resize((size, size), Image.LANCZOS)


def main(root, preview=None):
    root = pathlib.Path(root).resolve()
    icons = root / 'build' / 'icons'
    (root / 'public' / 'favicon.svg').write_text(svg(), encoding='utf-8')
    (root.parent / 'config' / 'brand' / 'logo.svg').write_text(svg(size=512, doc=True), encoding='utf-8')
    # Raster logo: video export watermark (backend/api/routers/exports.py) and store assets.
    raster(512).save(root.parent / 'config' / 'brand' / 'logo.png')
    (icons / 'trayTemplate.svg').write_text(svg(tile=False, mono='#000000'), encoding='utf-8')
    (icons / 'trayRecordingTemplate.svg').write_text(
        svg(tile=False, mono='#000000', extra='  <circle cx="57" cy="57" r="6" fill="#000"/>\n'),
        encoding='utf-8')
    raster(512).save(icons / 'icon.png')
    raster(32).save(icons / '32x32.png')
    raster(512, pad=MAC_PAD).save(icons / 'icon-macos.png')
    raster(1024).save(icons / 'icon.ico', sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
    raster(1024, pad=MAC_PAD).save(icons / 'icon.icns')
    raster(36, tile=False, mono='#000000').save(icons / 'trayTemplate.png')
    # Recording keeps the original convention: a dot in the bottom-right corner.
    rec = raster(32)
    ImageDraw.Draw(rec).ellipse([21, 21, 31, 31], fill='#E5484D', outline=TILE, width=2)
    rec.save(icons / 'tray-recording.png')
    tpl = raster(36, tile=False, mono='#000000')
    ImageDraw.Draw(tpl).ellipse([26, 26, 35, 35], fill='#000000')
    tpl.save(icons / 'trayRecordingTemplate.png')
    if preview:
        p = pathlib.Path(preview)
        raster(1024).save(p / 'preview-1024.png')
        strip = Image.new('RGBA', (16 * 8 * 3 + 40, 128), (240, 240, 240, 255))
        for i, n in enumerate((16, 24, 32)):
            strip.paste(raster(n).resize((128, 128), Image.NEAREST), (i * 148, 0))
        strip.save(p / 'preview-small.png')
    print('icons written')


if __name__ == '__main__':
    main(*sys.argv[1:])
