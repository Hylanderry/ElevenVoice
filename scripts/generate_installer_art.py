"""Installer artwork for the Windows (NSIS) setup: sidebar and header bitmaps."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "electron" / "build" / "installer"
LOGO = ROOT / "config" / "brand" / "logo.png"
FONTS = Path("C:/Windows/Fonts")
GRAPHITE, INK, MUTED, AMBER = (23, 23, 26), (242, 239, 232), (139, 138, 133), (232, 163, 61)
S = 4  # supersample


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size * S)


def meter(draw, x0, y_base, count, width, gap, max_h, color, alpha_img=None):
    import math
    for i in range(count):
        t = i / (count - 1)
        h = (0.18 + 0.55 * math.sin(math.pi * t) ** 1.5 + 0.12 * abs(math.sin(i * 2.3))) * max_h
        x = x0 + i * (width + gap)
        draw.rounded_rectangle([x * S, (y_base - h) * S, (x + width) * S, y_base * S], radius=width * S // 2, fill=color)


def sidebar():
    w, h = 164, 314
    im = Image.new("RGB", (w * S, h * S), GRAPHITE)
    d = ImageDraw.Draw(im)
    meter(d, 14, h - 18, 14, 6, 4, 70, (36, 36, 41))
    logo = Image.open(LOGO).convert("RGBA").resize((44 * S, 44 * S), Image.LANCZOS)
    im.paste(logo, (20 * S, 28 * S), logo)
    d.text((20 * S, 90 * S), "ElevenVoice", font=font("segoeuib.ttf", 19), fill=INK)
    d.rectangle([20 * S, 122 * S, 44 * S, 124 * S], fill=AMBER)
    for i, line in enumerate(["Free voice studio", "on your own", "computer."]):
        d.text((20 * S, (134 + i * 17) * S), line, font=font("segoeui.ttf", 12), fill=MUTED)
    d.text((20 * S, (h - 108) * S), "No account.", font=font("segoeuisl.ttf", 11), fill=MUTED)
    d.text((20 * S, (h - 92) * S), "No subscription.", font=font("segoeuisl.ttf", 11), fill=MUTED)
    im.resize((w, h), Image.LANCZOS).save(OUT / "sidebar.bmp")


def header():
    w, h = 150, 57
    im = Image.new("RGB", (w * S, h * S), (255, 255, 255))
    d = ImageDraw.Draw(im)
    logo = Image.open(LOGO).convert("RGBA").resize((34 * S, 34 * S), Image.LANCZOS)
    im.paste(logo, ((w - 44) * S, 11 * S), logo)
    im.resize((w, h), Image.LANCZOS).save(OUT / "header.bmp")


OUT.mkdir(parents=True, exist_ok=True)
sidebar()
header()
print("wrote", *sorted(p.name for p in OUT.iterdir()))
