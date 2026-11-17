# Сайт Фастівської гімназії № 7

Статичний сайт: Python (Jinja2) збирає HTML з контенту, GitHub Pages його роздає.
Швидко, безкоштовно, без сервера, тож падати нічому.

## Як додати новину чи документ (для адміністрації)

1. Відкрити **https://app.pagescms.org**, увійти через GitHub, обрати репозиторій `School.github.io`.
2. **Новини** → «Додати» або **Документи (PDF)** → «Додати». Заповнити поля, завантажити фото/PDF, «Зберегти».
3. За 1–2 хвилини зміни з'являться на сайті (вкладка **Actions** показує прогрес).

## Як оновити розклад уроків

1. На rozklad.org експортувати розклад у Excel (файл на кшталт `rozklad (11).xls`).
2. Виконати в папці сайту:
   ```bash
   .venv\Scripts\python tools/import_schedule.py "C:/Users/.../Downloads/rozklad (11).xls"
   ```
3. Закомітити `content/schedule.json` і запушити — сторінка `/schedule/` оновиться сама.

Персональні розклади з іменами дітей імпорт пропускає — вони не публікуються.
Час дзвінків і примітка редагуються в адмінці («Розклад — дзвінки та примітка»).

## Як запустити локально (для розробника)

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt     # Windows
.venv\Scripts\python build.py --serve             # відкриє http://127.0.0.1:8000
```

Зміни в `content/`, `templates/`, `static/` перезбираються самі — просто оновіть сторінку.
Файли в `templates/` — це **шаблони**, а не готові сторінки: відкривати їх у браузері напряму марно.
Готовий сайт лежить у `dist/` після збирання.

## Структура

```
content/                  ← увесь текст сайту (редагує адмінка)
  settings.json             назва, контакти, оголошення, цифри на головній
  school-year.json          семестри, канікули, приймальні дні, вакансії
  news/*.json               новини: один файл = одна новина
  documents/*.json          документи: назва, розділ, PDF
templates/
  layouts/base.html         каркас: шапка, меню, футер, SEO
  layouts/redirect.html     переадресація зі старих адрес
  partials/macros.html      спільні блоки: hero, картка новини, список документів
  pages/*.html              сторінки (назва = адреса на сайті)
static/
  css/                      tokens → base → layout → components → pages → motion (збираються в site.css)
  js/site.js                меню, анімації, перегляд PDF, пошук
  media/img, media/docs     фото та PDF (сюди ж завантажує адмінка)
build.py                    збирач: валідує контент, рендерить сторінки, sitemap, 404, переадресації
.pages.yml                  налаштування адмінки Pages CMS
.github/workflows/deploy.yml  автопублікація на GitHub Pages
```

## Адреси сторінок

| Сторінка | Адреса | Шаблон |
|---|---|---|
| Головна | `/` | `pages/home.html` |
| Новини | `/news/` | `pages/news.html` |
| Новина | `/news/<slug>/` | `pages/news-article.html` |
| Документи | `/documents/` | `pages/documents.html` |
| Прозорість | `/transparency/` | `pages/transparency.html` |
| 1–4 класи | `/grades-1-4/` | `pages/grades-1-4.html` |
| 5–9 класи | `/grades-5-9/` | `pages/grades-5-9.html` |
| Протидія булінгу | `/bullying/` | `pages/bullying.html` |
| Корисна інформація | `/useful-info/` | `pages/useful-info.html` |
| Інклюзія | `/inclusion/` | `pages/inclusion.html` |
| Психолог | `/psychologist/` | `pages/psychologist.html` |
| Розклад уроків | `/schedule/` | `pages/schedule.html` |

Старі адреси (`indexPfd.html`, `student 5 - 9.html`, `Bullying.html`…) автоматично переадресовують на нові.

## Перший запуск на GitHub (один раз)

**Settings → Pages → Build and deployment → Source: «GitHub Actions».**
Без цього GitHub продовжить показувати файли з кореня репозиторію, а не зібраний сайт.
