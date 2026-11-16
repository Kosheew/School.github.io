#!/usr/bin/env python3
"""Збирає статичний сайт гімназії: content/ + templates/ + static/  ->  dist/

    python build.py            збірка для GitHub Pages (адреса з content/settings.json)
    python build.py --serve    локальний перегляд на http://localhost:8000 з автоперезбиранням

Контент — JSON-файли (їх редагує адмінка Pages CMS, див. .pages.yml):
    content/settings.json      назва, контакти, оголошення, цифри на головній
    content/school-year.json   структура року, приймальні дні, вакансії
    content/news/*.json        новини (одна новина = один файл)
    content/documents/*.json   документи (PDF), прив'язані до розділу

Збірка падає з поясненням, якщо контент посилається на файл, якого немає,
тому зламані посилання не потрапляють на живий сайт.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"
DIST = ROOT / "dist"

# Порядок важливий: токени -> база -> макет -> компоненти -> сторінки -> рух.
CSS_BUNDLE = ["tokens.css", "base.css", "layout.css", "components.css", "pages.css", "motion.css"]

SECTIONS = {
    "home": "Головне",
    "transparency": "Прозорість",
    "grades-1-4": "1–4 класи",
    "grades-5-9": "5–9 класи",
    "bullying": "Протидія булінгу",
    "useful": "Корисне",
}

NAV = [
    {"label": "Головна", "page": "home"},
    {"label": "Новини", "page": "news"},
    {"label": "Прозорість", "page": "transparency"},
    {"label": "Освітній процес", "children": [
        {"label": "Розклад уроків", "external": "schedule_url", "icon": "fa-calendar-days"},
        {"label": "1–4 класи", "page": "grades-1-4", "icon": "fa-shapes"},
        {"label": "5–9 класи", "page": "grades-5-9", "icon": "fa-book-open"},
    ]},
    {"label": "Виховання", "children": [
        {"label": "Сторінка психолога", "page": "psychologist", "icon": "fa-hand-holding-heart"},
        {"label": "Інклюзивна освіта", "page": "inclusion", "icon": "fa-universal-access"},
        {"label": "Протидія булінгу", "page": "bullying", "icon": "fa-shield-heart"},
    ]},
    {"label": "Документи", "page": "documents"},
]

# key -> (шаблон, шлях у dist, заголовок, опис)
PAGES = {
    "home": ("pages/home.html", "", None, None),
    "news": ("pages/news.html", "news/", "Новини", "Усі новини та події Фастівської гімназії №7."),
    "documents": ("pages/documents.html", "documents/", "Документи", "Усі офіційні документи гімназії з пошуком і фільтрами."),
    "transparency": ("pages/transparency.html", "transparency/", "Прозорість та інформаційна відкритість",
                     "Структура навчального року, приймальні дні, вакансії та офіційні документи."),
    "grades-1-4": ("pages/grades-1-4.html", "grades-1-4/", "1–4 класи", "Початкова школа: типові освітні програми."),
    "grades-5-9": ("pages/grades-5-9.html", "grades-5-9/", "5–9 класи",
                   "Базова середня освіта: нові правила оцінювання (наказ МОН № 1427) та документи."),
    "bullying": ("pages/bullying.html", "bullying/", "Протидія булінгу", "Накази, алгоритми дій та куди звертатися."),
    "useful": ("pages/useful-info.html", "useful-info/", "Корисна інформація", "Критерії оцінювання та матеріали для учнів і батьків."),
    "inclusion": ("pages/inclusion.html", "inclusion/", "Інклюзивна освіта", "Доступність закладу та супровід дітей з ООП."),
    "psychologist": ("pages/psychologist.html", "psychologist/", "Сторінка психолога", "Поради батькам і підтримка дітей."),
}

# Старі адреси сайту -> нові (щоб посилання з Facebook, Viber тощо не зламались).
LEGACY = {
    "indexPfd.html": "transparency/",
    "student 1-4.html": "grades-1-4/",
    "student 5 - 9.html": "grades-5-9/",
    "Bullying.html": "bullying/",
    "useful_information.html": "useful-info/",
    "pageInclusion.html": "inclusion/",
    "pagePsychologist.html": "psychologist/",
    "About.html": "",
    "forStudent.html": "",
    "forTeacher.html": "",
}

MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня",
          "серпня", "вересня", "жовтня", "листопада", "грудня"]


class ContentError(Exception):
    pass


@dataclass
class News:
    slug: str
    title: str
    date: date
    image: str
    body: str
    pinned: bool = False
    tone: str = ""
    link: dict | None = None
    excerpt: str = ""
    reading_min: int = 1
    prev: "News | None" = None
    next: "News | None" = None

    @property
    def path(self) -> str:
        return f"news/{self.slug}/"


@dataclass
class Document:
    title: str
    section: str
    file: str
    order: int = 0
    date: date | None = None
    is_new: bool = False
    size_kb: int = 0


@dataclass
class Site:
    settings: dict
    year: dict
    news: list[News] = field(default_factory=list)
    documents: list[Document] = field(default_factory=list)

    def docs(self, *sections: str) -> list[Document]:
        return [d for d in self.documents if d.section in sections]


# ---------------------------------------------------------------- loading

def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ContentError(f"{path.relative_to(ROOT)}: зламаний JSON ({e})") from e


def need(data: dict, key: str, where: Path):
    if data.get(key) in (None, ""):
        raise ContentError(f"{where.relative_to(ROOT)}: не заповнене поле «{key}»")
    return data[key]


def media(path: str, where: Path) -> str:
    """Перевіряє, що файл з медіатеки існує; повертає шлях без початкового '/'."""
    clean = path.lstrip("/")
    if not (ROOT / clean).is_file():
        raise ContentError(f"{where.relative_to(ROOT)}: файл «{path}» не знайдено")
    return clean


def parse_date(value: str | None, where: Path) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except ValueError as e:
        raise ContentError(f"{where.relative_to(ROOT)}: дата «{value}» має бути у форматі РРРР-ММ-ДД") from e


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("\xa0", " ")


def load() -> Site:
    settings = read_json(CONTENT / "settings.json")
    year = read_json(CONTENT / "school-year.json")
    site = Site(settings=settings, year=year)

    for p in sorted((CONTENT / "news").glob("*.json")):
        d = read_json(p)
        text = " ".join(strip_tags(d.get("body", "")).split())
        excerpt = text if len(text) <= 180 else text[:180].rsplit(" ", 1)[0] + "…"
        site.news.append(News(
            slug=re.sub(r"^\d{4}-\d{2}-\d{2}-", "", p.stem),
            title=need(d, "title", p),
            date=parse_date(need(d, "date", p), p),
            image=media(need(d, "image", p), p),
            body=need(d, "body", p),
            pinned=bool(d.get("pinned")),
            tone=d.get("tone", ""),
            link=d.get("link") if (d.get("link") or {}).get("url") else None,
            excerpt=excerpt,
            reading_min=max(1, round(len(text.split()) / 180)),
        ))
    slugs = [n.slug for n in site.news]
    if len(slugs) != len(set(slugs)):
        raise ContentError("content/news: дві новини мають однакову назву файлу")
    site.news.sort(key=lambda n: (n.date, n.slug), reverse=True)
    for i, n in enumerate(site.news):
        n.next = site.news[i - 1] if i > 0 else None          # новіша
        n.prev = site.news[i + 1] if i + 1 < len(site.news) else None  # старіша

    for p in sorted((CONTENT / "documents").glob("*.json")):
        d = read_json(p)
        section = need(d, "section", p)
        if section not in SECTIONS:
            raise ContentError(f"{p.relative_to(ROOT)}: невідомий розділ «{section}» ({', '.join(SECTIONS)})")
        f = media(need(d, "file", p), p)
        site.documents.append(Document(
            title=need(d, "title", p), section=section, file=f,
            order=int(d.get("order") or 0), date=parse_date(d.get("date"), p),
            is_new=bool(d.get("is_new")), size_kb=max(1, (ROOT / f).stat().st_size // 1024),
        ))
    site.documents.sort(key=lambda x: (not x.is_new, x.order, x.title))
    return site


# ---------------------------------------------------------------- rendering

def file_hash(paths: list[Path]) -> str:
    h = hashlib.sha1()
    for p in paths:
        h.update(p.read_bytes())
    return h.hexdigest()[:10]


def build(base: str, *, dev: bool = False) -> None:
    started = time.perf_counter()
    site = load()
    s = site.settings

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST / "static", ignore=shutil.ignore_patterns("css"))

    css_files = [STATIC / "css" / n for n in CSS_BUNDLE]
    (DIST / "static/css").mkdir(parents=True, exist_ok=True)
    (DIST / "static/css/site.css").write_text(
        "\n".join(f"/* {p.name} */\n" + p.read_text(encoding="utf-8") for p in css_files), encoding="utf-8")
    version = file_hash(css_files + [STATIC / "js" / "site.js"])

    site_url = s["site_url"].rstrip("/") + "/"

    # Відносні посилання ("../static/...") працюють на будь-якій адресі: github.io/<repo>/,
    # власному домені й навіть відкриті з диска. Лише 404.html GitHub віддає з будь-якої
    # глибини, тому йому — абсолютний base.
    current = {"root": ""}

    def url(path: str = "") -> str:
        if re.match(r"^(https?:|mailto:|tel:|viber:|#)", path):
            return path
        return current["root"] + path.lstrip("/")

    def page_url(key: str) -> str:
        return url(PAGES[key][1])

    def absolute(path: str = "") -> str:
        return site_url + path.lstrip("/")

    def fix_links(markup: str) -> str:
        """Відносні посилання з редактора (static/..., grades-5-9/) -> з урахуванням base."""
        return re.sub(r'(src|href)="(?!https?:|mailto:|tel:|#|/)([^"]+)"',
                      lambda m: f'{m.group(1)}="{url(m.group(2))}"', markup)

    def human_date(d: date | None) -> str:
        return f"{d.day} {MONTHS[d.month - 1]} {d.year}" if d else ""

    env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html", "xml"]),
                      undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True)
    env.filters.update(human_date=human_date, fix_links=fix_links)
    env.globals.update(
        site=site, s=s, nav=NAV, sections=SECTIONS, url=url, page_url=page_url, absolute=absolute,
        asset=lambda p: f"{url(p)}?v={version}", dev=dev, today=date.today(),
        build_time=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
    )

    def render(template: str, out: str, **ctx) -> None:
        target = DIST / out / "index.html" if out.endswith("/") or out == "" else DIST / out
        depth = len(target.relative_to(DIST).parts) - 1
        current["root"] = base if out == "404.html" else "../" * depth
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(env.get_template(template).render(**ctx), encoding="utf-8")

    sitemap: list[tuple[str, date | None]] = []
    for key, (tpl, out, title, desc) in PAGES.items():
        render(tpl, out, page=key, title=title, description=desc or s["description"], path=out)
        sitemap.append((out, None))

    for n in site.news:
        render("pages/news-article.html", n.path, page="news", title=n.title, description=n.excerpt,
               path=n.path, item=n, og_image=n.image)
        sitemap.append((n.path, n.date))

    for old, new in LEGACY.items():
        render("layouts/redirect.html", old, page="", title="Сторінку перенесено", description="",
               path=new, target=page_url("home") if new == "" else url(new))

    render("pages/not-found.html", "404.html", page="", title="Сторінку не знайдено", description="", path="404.html")

    (DIST / ".nojekyll").write_text("", encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {absolute('sitemap.xml')}\n", encoding="utf-8")
    entries = "".join(
        f"<url><loc>{html.escape(absolute(p))}</loc>{f'<lastmod>{d.isoformat()}</lastmod>' if d else ''}</url>"
        for p, d in sitemap)
    (DIST / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{entries}</urlset>',
        encoding="utf-8")

    ms = (time.perf_counter() - started) * 1000
    print(f"✓ {len(PAGES)} сторінок, {len(site.news)} новин, {len(site.documents)} документів → dist/ ({ms:.0f} мс, base={base})")


# ---------------------------------------------------------------- dev server

def watch_and_rebuild(base: str) -> None:
    def snapshot():
        return {p: p.stat().st_mtime for d in (CONTENT, TEMPLATES, STATIC) for p in d.rglob("*") if p.is_file()}
    last = snapshot()
    while True:
        time.sleep(0.7)
        now = snapshot()
        if now != last:
            last = now
            try:
                build(base, dev=True)
            except ContentError as e:
                print(f"✗ {e}")
            except Exception as e:  # шаблонні помилки показуємо, але сервер не падає
                print(f"✗ {type(e).__name__}: {e}")


def serve(port: int, open_browser: bool = True) -> None:
    build("/", dev=True)
    threading.Thread(target=watch_and_rebuild, args=("/",), daemon=True).start()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(DIST), **kw)

        def log_message(self, *a):
            pass

        def send_error(self, code, message=None, explain=None):
            if code == 404 and (DIST / "404.html").exists():
                body = (DIST / "404.html").read_bytes()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                super().send_error(code, message, explain)

    print(f"→ http://localhost:{port}  (Ctrl+C — зупинити; зміни в content/templates/static перезбираються самі)")
    if open_browser:
        import webbrowser
        threading.Timer(0.6, webbrowser.open, args=(f"http://localhost:{port}/",)).start()
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--serve", action="store_true", help="локальний сервер з автоперезбиранням")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-open", action="store_true", help="не відкривати браузер автоматично")
    ap.add_argument("--base", help="базовий шлях (за замовчуванням — шлях із site_url)")
    args = ap.parse_args()
    try:
        if args.serve:
            serve(args.port, open_browser=not args.no_open)
        else:
            base = args.base or urlparse(read_json(CONTENT / "settings.json")["site_url"]).path or "/"
            build(base if base.endswith("/") else base + "/")
    except ContentError as e:
        print(f"✗ Помилка контенту: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
