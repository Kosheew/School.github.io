"""QR-код і плакат A4 для друку.

    python tools/make_qr_poster.py               # критерії оцінювання (типово)

Створює static/media/print/<name>-qr.svg і <name>-qr-poster.html; PDF друкує Chrome headless:
    chrome --headless --print-to-pdf=static/media/print/<name>-qr-poster.pdf <...>-poster.html
Якщо адреса сайту зміниться — перезапустіть скрипт і передрукуйте плакат.
"""
from __future__ import annotations

import argparse
import html
import io
import json
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_H

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static" / "media" / "print"
BASE = "https://kosheew.github.io/School.github.io/"


def qr_svg(url: str, dark: str = "#0f2a4a") -> str:
    """SVG із заокругленими модулями та «7» в центрі (рівень H витримує ~30 % перекриття)."""
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=3)
    q.add_data(url)
    q.make(fit=True)
    m = q.get_matrix()
    n = len(m)
    hole = round(n * 0.19)          # квадрат під логотип: ~5 % площі коду
    lo = (n - hole) // 2
    hi = lo + hole
    b = q.border
    EYES = ((b, b), (n - b - 7, b), (b, n - b - 7))

    def finder(x: int, y: int) -> bool:
        return any(fx <= x < fx + 7 and fy <= y < fy + 7 for fx, fy in EYES)

    # Суцільні модулі, злиті в горизонтальні смуги: «крапки» з проміжками гірше читають камери.
    cells = []
    for y, row in enumerate(m):
        x = 0
        while x < n:
            if row[x] and not finder(x, y) and not (lo <= x < hi and lo <= y < hi):
                start = x
                while x < n and row[x] and not finder(x, y) and not (lo <= x < hi and lo <= y < hi):
                    x += 1
                cells.append(f"M{start} {y}h{x - start}v1h{start - x}z")
            else:
                x += 1
    cells = [f'<path d="{"".join(cells)}"/>']
    eyes = []
    for fx, fy in EYES:
        eyes.append(f'<rect x="{fx + .5}" y="{fy + .5}" width="6" height="6" rx=".5" fill="none" stroke="{dark}" stroke-width="1"/>'
                    f'<rect x="{fx + 2}" y="{fy + 2}" width="3" height="3" rx=".3"/>')
    c = n / 2
    r = hole / 2
    logo = (f'<rect x="{c - r + .3}" y="{c - r + .3}" width="{2 * r - .6}" height="{2 * r - .6}" rx="{r * .45:.2f}" fill="#ffc83d"/>'
            f'<text x="{c}" y="{c + r * .36:.2f}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" '
            f'font-weight="900" font-size="{r * 1.15:.2f}" fill="{dark}">7</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="geometricPrecision">'
            f'<rect width="{n}" height="{n}" fill="#fff"/><g fill="{dark}">{"".join(cells)}{"".join(eyes)}</g>{logo}</svg>')


POSTER = """<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>{title}</title>
<style>
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 210mm; height: 297mm; }}
body {{ font-family: "Segoe UI", Arial, sans-serif; color: #0f2a4a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.page {{ position: relative; width: 210mm; height: 297mm; overflow: hidden; padding: 16mm 16mm 12mm; display: flex; flex-direction: column; align-items: center; text-align: center;
  background: radial-gradient(120mm 90mm at 100% 0, #ffe7a3 0, transparent 70%), radial-gradient(130mm 100mm at 0 100%, #d6e8ff 0, transparent 70%), #fffdf6; }}
.school {{ font-size: 12.5pt; font-weight: 700; line-height: 1.35; color: #36506e; max-width: 160mm; }}
.kicker {{ margin-top: 11mm; display: inline-block; padding: 2.2mm 6mm; border-radius: 99mm; background: #0f2a4a; color: #ffc83d; font-weight: 800; font-size: 13pt; letter-spacing: .06em; text-transform: uppercase; }}
h1 {{ margin-top: 6mm; font-size: 40pt; line-height: 1.02; font-weight: 900; letter-spacing: -.01em; }}
.sub {{ margin-top: 4mm; font-size: 16pt; font-weight: 600; color: #36506e; }}
.qr {{ position: relative; margin-top: 10mm; padding: 6mm; border-radius: 10mm; background: #fff; box-shadow: 0 2mm 8mm rgba(15,42,74,.14); border: 1.2mm solid #ffc83d; }}
.qr svg {{ display: block; width: 102mm; height: 102mm; }}
.scan {{ margin-top: 8mm; font-size: 17pt; font-weight: 800; }}
.scan span {{ color: #e0532f; }}
.emoji {{ margin-top: 7mm; font-size: 19pt; letter-spacing: 1.2mm; max-width: 170mm; }}
.url {{ margin-top: auto; font: 600 11pt Consolas, monospace; color: #36506e; }}
</style></head><body><div class="page">
<p class="school">{school}</p>
<p class="kicker">{kicker}</p>
<h1>{title}</h1>
<p class="sub">{sub}</p>
<div class="qr">{svg}</div>
<p class="scan">📱 Наведи камеру телефона — <span>і обирай предмет!</span></p>
<p class="emoji">{emoji}</p>
<p class="url">{url}</p>
</div></body></html>"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="criteria")
    ap.add_argument("--path", default="criteria/", help="шлях сторінки відносно кореня сайту")
    ap.add_argument("--title", default="Критерії оцінювання")
    ap.add_argument("--kicker", default="2026/2027 навчальний рік")
    ap.add_argument("--sub", default="5–9 класи · усі предмети · пояснювальна записка")
    args = ap.parse_args()

    settings = json.loads((ROOT / "content" / "settings.json").read_text(encoding="utf-8"))
    school = settings.get("name", "")
    url = BASE + args.path
    emoji = []
    for f in sorted((ROOT / "content" / "documents").glob(f"{args.name}--*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("emoji") and not d.get("featured"):
            emoji.append((d.get("order", 0), d["emoji"]))
    emoji_line = " ".join(e for _, e in sorted(emoji))

    OUT.mkdir(parents=True, exist_ok=True)
    svg = qr_svg(url)
    (OUT / f"{args.name}-qr.svg").write_text(svg, encoding="utf-8")
    page = POSTER.format(title=html.escape(args.title), school=html.escape(school), kicker=html.escape(args.kicker),
                         sub=html.escape(args.sub), svg=svg, emoji=emoji_line, url=html.escape(url))
    io.open(OUT / f"{args.name}-qr-poster.html", "w", encoding="utf-8", newline="\n").write(page)
    print(url)
    print(OUT / f"{args.name}-qr-poster.html")


if __name__ == "__main__":
    main()
