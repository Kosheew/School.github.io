#!/usr/bin/env python3
"""Імпорт розкладу з rozklad.org у content/schedule.json.

    python tools/import_schedule.py "C:/Users/.../Downloads/rozklad (11).xls"

Файл «.xls» з rozklad.org — насправді HTML-таблиця: блоки по класах, дні в колонках,
поділ на групи зроблено через rowspan, уроки через тиждень позначені «A:» / «B:».

Персональні блоки з іменами дітей («4-А Прізвище Ім'я») НЕ імпортуються — це
персональні дані, яким не місце на публічному сайті.
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "schedule.json"
DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця"]
CLASS_RE = re.compile(r"^\d{1,2}-[А-ЯҐЄІЇ]$")


class Cell:
    def __init__(self, tag: str, attrs: dict):
        self.tag = tag
        self.rowspan = int(attrs.get("rowspan") or 1)
        self.colspan = int(attrs.get("colspan") or 1)
        self.parts: list[str] = []

    @property
    def text(self) -> str:
        t = html.unescape("".join(self.parts)).replace("\xa0", " ")
        return " ".join(t.split())


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows: list[list[Cell]] = []
        self.cell: Cell | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th") and self.rows:
            self.cell = Cell(tag, dict(attrs))
            self.rows[-1].append(self.cell)
        elif tag == "br" and self.cell:
            self.cell.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            self.cell = None

    def handle_data(self, data):
        if self.cell:
            self.cell.parts.append(data)


def split_blocks(rows: list[list[Cell]]):
    """Ділить таблицю на блоки: [назва, [рядки уроків]]."""
    blocks, cur = [], None
    for r in rows:
        if len(r) == 1 and r[0].colspan >= 7:
            cur = [r[0].text, []]
            blocks.append(cur)
        elif cur is not None:
            if any(c.tag == "th" and c.text.lower() in ("пн", "вт", "ср", "чт", "пт") for c in r):
                continue  # рядок з назвами днів
            cur[1].append(r)
    return blocks


def to_grid(rows: list[list[Cell]], width: int = 7):
    """Розкладає рядки з rowspan у сітку: grid[рядок][колонка] = Cell."""
    grid: list[list[Cell | None]] = []
    for ri, r in enumerate(rows):
        while len(grid) <= ri:
            grid.append([None] * width)
        ci = 0
        for cell in r:
            while ci < width and grid[ri][ci] is not None:
                ci += 1
            for dr in range(cell.rowspan):
                while len(grid) <= ri + dr:
                    grid.append([None] * width)
                for dc in range(cell.colspan):
                    if ci + dc < width:
                        grid[ri + dr][ci + dc] = cell
            ci += cell.colspan
    return grid


def parse_entry(text: str) -> dict | None:
    if not text:
        return None
    e: dict = {}
    m = re.match(r"^([AB]):\s*(.+)$", text)
    if m:
        e["week"], text = m.group(1), m.group(2)
    m = re.search(r",\s*гр\.?\s*(\d)$", text)
    if m:
        e["group"], text = m.group(1), text[: m.start()]
    e["subject"] = text.strip()
    return e


def parse(path: Path) -> dict:
    p = TableParser()
    p.feed(path.read_text(encoding="utf-8", errors="replace"))
    classes, skipped = [], []
    for title, rows in split_blocks(p.rows):
        if not CLASS_RE.match(title):
            skipped.append(title)
            continue
        grid = to_grid(rows)
        lessons: dict[int, list[list[dict]]] = {}
        for ri, line in enumerate(grid):
            num_cell = line[0]
            if not num_cell or not num_cell.text.isdigit():
                continue
            n = int(num_cell.text)
            days = lessons.setdefault(n, [[] for _ in DAYS])
            for d in range(len(DAYS)):
                cell = line[d + 1]
                if cell is None:
                    continue
                entry = parse_entry(cell.text)
                if entry and entry not in days[d]:
                    days[d].append(entry)
        out = [{"n": n, "days": lessons[n]} for n in sorted(lessons)]
        while out and not any(out[-1]["days"]):  # порожні уроки в кінці
            out.pop()
        classes.append({"name": title, "lessons": out})
    return {"classes": classes, "skipped": skipped}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    src = Path(sys.argv[1])
    data = parse(src)
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    result = {
        "updated": date.today().isoformat(),
        "note": old.get("note", ""),
        "bells": old.get("bells", []),      # дзвінки редагуються в адмінці, імпорт їх не чіпає
        "days": DAYS,
        "classes": data["classes"],
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    n = sum(len(c["lessons"]) for c in data["classes"])
    print(f"✓ {len(data['classes'])} класів, {n} рядків уроків → {OUT.relative_to(ROOT)}")
    if data["skipped"]:
        print(f"  пропущено {len(data['skipped'])} персональних блоків (імена дітей не публікуються)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
