"""Draws the app icons (a yellow house on the dark page color) into icons/.

Only needed again if I want to change the icon.
Run:  pip install pillow   then   python scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
BG, YELLOW, DARK = "#0e1014", "#f5c542", "#161920"
BIG = 2048  # draw big, then shrink: gives smooth edges


def draw():
    img = Image.new("RGB", (BIG, BIG), BG)
    d = ImageDraw.Draw(img)
    u = BIG / 100  # 1 unit = 1% of the icon; the house stays inside the middle 60%
    # roof
    d.polygon([(50 * u, 22 * u), (80 * u, 50 * u), (20 * u, 50 * u)], fill=YELLOW)
    # walls
    d.rounded_rectangle([28 * u, 47 * u, 72 * u, 78 * u], radius=3 * u, fill=YELLOW)
    # door
    d.rounded_rectangle([44 * u, 58 * u, 56 * u, 78 * u], radius=2 * u, fill=DARK)
    return img


def main():
    OUT.mkdir(exist_ok=True)
    img = draw()
    for size in (192, 512):
        img.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)
        print(f"icons/icon-{size}.png written")


if __name__ == "__main__":
    main()
