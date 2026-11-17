/* Фастівська гімназія № 7 — інтерактив і анімації. Без залежностей, без збирання. */
(function () {
  "use strict";
  window.SITE_READY = true;

  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------------------------------------------------------------- тема */
  function isDark() {
    return root.dataset.theme === "dark";
  }
  $$("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      var apply = function () { root.dataset.theme = next; store("theme", next); };
      // кругова «заливка» нової теми від кнопки (View Transitions), інакше — миттєво
      if (document.startViewTransition && !reduce) {
        var r = b.getBoundingClientRect();
        root.style.setProperty("--tx", r.left + r.width / 2 + "px");
        root.style.setProperty("--ty", r.top + r.height / 2 + "px");
        root.classList.add("theme-anim");
        document.startViewTransition(apply).finished.finally(function () { root.classList.remove("theme-anim"); });
      } else apply();
    });
  });

  /* ---------------------------------------------------------------- шторка між сторінками
     Відкриття шторки на новій сторінці — чистий CSS (працює навіть без JS). Тут — її
     закриття при переході на іншу сторінку сайту: кожен клік має анімацію в будь-якому браузері. */
  var curtain = $(".curtain");
  function internalTarget(a, e) {
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    if (a.target && a.target !== "_self") return null;
    if (a.hasAttribute("download") || a.hasAttribute("data-pdf")) return null;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || /^(mailto|tel|viber|javascript):/i.test(href)) return null;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return null;
    if (/\.(pdf|jpe?g|png|webp|gif|zip|docx?)$/i.test(u.pathname)) return null;
    if (u.pathname === location.pathname && u.search === location.search) return null; // якір на цій сторінці
    return u;
  }
  if (curtain && !reduce) {
    document.addEventListener("click", function (e) {
      var u = internalTarget(e.target.closest && e.target.closest("a[href]"), e);
      if (!u) return;
      e.preventDefault();
      try { sessionStorage.setItem("nav", "1"); } catch (err) {}
      root.classList.add("is-leaving");
      setTimeout(function () { location.href = u.href; }, 280);
    });
    // повернення кнопкою «Назад» з кешу браузера — прибрати шторку
    addEventListener("pageshow", function (e) { if (e.persisted) root.classList.remove("is-leaving"); });
  }

  /* ---------------------------------------------------------------- шапка і меню */
  var header = $("[data-header]");
  var nav = $("[data-nav]");
  var burger = $("[data-burger]");
  var scrim = $("[data-scrim]");

  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    if (open && header) header.classList.remove("is-hidden");
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  if (scrim) scrim.addEventListener("click", function () { setMenu(false); });
  // кнопка «Меню» в нижній панелі телефона відкриває те саме меню
  $$("[data-tabbar-menu]").forEach(function (b) {
    b.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  });
  $$(".nav__item", nav).forEach(function (li, i) { li.style.setProperty("--n", i); });

  var toggles = $$("[data-sub-toggle]");
  function closeSubs(except) {
    toggles.forEach(function (t) {
      if (t === except) return;
      t.parentElement.classList.remove("is-open");
      t.setAttribute("aria-expanded", "false");
    });
  }
  toggles.forEach(function (t) {
    t.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !t.parentElement.classList.contains("is-open");
      closeSubs(t);
      t.parentElement.classList.toggle("is-open", open);
      t.setAttribute("aria-expanded", String(open));
    });
    // на десктопі — відкриття при наведенні
    if (finePointer) {
      var li = t.parentElement, timer;
      li.addEventListener("pointerenter", function () {
        if (matchMedia("(max-width: 1100px)").matches) return;
        clearTimeout(timer); closeSubs(t); li.classList.add("is-open"); t.setAttribute("aria-expanded", "true");
      });
      li.addEventListener("pointerleave", function () {
        if (matchMedia("(max-width: 1100px)").matches) return;
        timer = setTimeout(function () { li.classList.remove("is-open"); t.setAttribute("aria-expanded", "false"); }, 160);
      });
    }
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".nav__item")) closeSubs(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeSubs(); setMenu(false); } });

  /* шапка ховається при прокрутці вниз і з'являється при прокрутці вгору */
  var progress = $(".progress");
  var toTop = $("[data-to-top]");
  var lastY = scrollY, ticking = false;
  var cssProgress = CSS.supports && CSS.supports("animation-timeline: scroll()");
  function onScroll() {
    var y = scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 10);
      var menuOpen = nav && nav.classList.contains("is-open");
      // ховаємо лише при явному русі вниз і показуємо при русі вгору — без «блимання» на повільному скролі
      if (!menuOpen && y > 400 && y > lastY + 6) header.classList.add("is-hidden");
      else if (y < lastY - 6 || y <= 400 || menuOpen) header.classList.remove("is-hidden");
    }
    if (progress && !cssProgress) {
      var max = document.documentElement.scrollHeight - innerHeight;
      progress.style.scale = (max > 0 ? y / max : 0) + " 1";
    }
    if (toTop) toTop.classList.toggle("is-shown", y > 800);
    lastY = y; ticking = false;
  }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", function () { scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });

  /* ---------------------------------------------------------------- поява при прокрутці + лічильники */
  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    if (reduce || !isFinite(target)) return;
    var t0 = performance.now(), dur = 1500;
    (function step(t) {
      var p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  /* Перший екран — одразу й без анімації (сторінка виглядає готовою з першого кадру).
     Решта блоків анімується, коли до них догортають. Проста перевірка позиції замість
     IntersectionObserver: працює однаково в усіх браузерах і ніколи не лишає блок невидимим. */
  function reveal(el) {
    el.classList.add("is-in");
    if (el.hasAttribute("data-count")) countUp(el);
  }
  var pending = $$("[data-reveal], [data-count], [data-timeline]");
  if (reduce) {
    pending.forEach(reveal);
  } else {
    var fold = innerHeight;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top < fold) { el.classList.add("no-anim"); reveal(el); return false; }
      return true;
    });
    // знімаємо «no-anim» після першого кадру, щоб наведення та інші переходи працювали як завжди
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      $$(".no-anim").forEach(function (el) { el.classList.remove("no-anim"); });
    }); });
    var checkReveal = function () {
      if (!pending.length) return;
      var line = innerHeight * (finePointer ? 0.92 : 1.1); // на телефоні — трохи наперед
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < line) { reveal(el); return false; }
        return true;
      });
    };
    addEventListener("scroll", checkReveal, { passive: true });
    addEventListener("resize", checkReveal);
    addEventListener("load", checkReveal);
  }

  /* ---------------------------------------------------------------- ефекти під курсором */
  if (finePointer && !reduce) {
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest("[data-spotlight]");
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px");
      el.style.setProperty("--my", e.clientY - r.top + "px");
    }, { passive: true });

    $$("[data-tilt]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 10 + "deg");
        el.style.setProperty("--rx", -((e.clientY - r.top) / r.height - 0.5) * 10 + "deg");
      });
      el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    });

    /* «магнітні» кнопки злегка тягнуться за курсором */
    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.translate = ((e.clientX - r.left - r.width / 2) * 0.18) + "px " + ((e.clientY - r.top - r.height / 2) * 0.3) + "px";
      });
      el.addEventListener("pointerleave", function () { el.style.translate = ""; });
    });

    /* паралакс фото в hero */
    var par = $("[data-parallax]");
    if (par) addEventListener("scroll", function () {
      var y = scrollY;
      if (y < innerHeight * 1.2) par.style.transform = "translate3d(0," + y * 0.28 + "px,0)";
    }, { passive: true });
  }

  /* хвиля від натискання на кнопку */
  if (!reduce) document.addEventListener("pointerdown", function (e) {
    var btn = e.target.closest(".btn");
    if (!btn) return;
    var r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
    var s = document.createElement("span");
    s.className = "ripple";
    s.style.cssText = "width:" + size + "px;height:" + size + "px;left:" + (e.clientX - r.left - size / 2) + "px;top:" + (e.clientY - r.top - size / 2) + "px";
    btn.appendChild(s);
    setTimeout(function () { s.remove(); }, 700);
  });

  /* ---------------------------------------------------------------- модальне вікно */
  var modal = $("[data-modal]");
  var modalBody = modal && $("[data-modal-body]", modal);
  function openModal(title, node, opts) {
    if (!modal || !modal.showModal) return false;
    opts = opts || {};
    $(".modal__title", modal).textContent = title;
    var dl = $("[data-modal-download]", modal), op = $("[data-modal-open]", modal);
    dl.hidden = !opts.file || !!opts.external; op.hidden = !opts.file;
    if (opts.file) { dl.href = opts.file; op.href = opts.file; }
    modal.classList.toggle("modal--image", !!opts.image);
    modalBody.replaceChildren(node);
    modal.showModal();
    document.body.style.overflow = "hidden";
    return true;
  }
  function closeModal() {
    if (!modal.open) return;
    modal.classList.add("is-closing");
    setTimeout(function () {
      modal.classList.remove("is-closing");
      modal.close();
    }, reduce ? 0 : 230);
  }
  if (modal) {
    modal.addEventListener("close", function () { document.body.style.overflow = ""; modalBody.replaceChildren(); });
    modal.addEventListener("cancel", function (e) { e.preventDefault(); closeModal(); });
    modal.addEventListener("click", function (e) {
      if (e.target === modal || e.target.closest("[data-modal-close]")) closeModal();
    });
  }

  // мобільні браузери не показують PDF в iframe — там посилання просто відкривається
  var canEmbedPdf = !/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-pdf]");
    if (a && canEmbedPdf && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      var frame = document.createElement("iframe");
      frame.src = a.getAttribute("href") + "#view=FitH";
      frame.title = a.dataset.pdfTitle || "PDF";
      if (openModal(a.dataset.pdfTitle || "Документ", frame, { file: a.getAttribute("href") })) e.preventDefault();
      return;
    }
    // зовнішні документи (Google Диск) — вбудований перегляд працює і на телефонах
    var emb = e.target.closest("[data-embed]");
    if (emb && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      var ef = document.createElement("iframe");
      ef.src = emb.dataset.embed;
      ef.title = emb.dataset.pdfTitle || "Документ";
      ef.allow = "autoplay";
      if (openModal(emb.dataset.pdfTitle || "Документ", ef, { file: emb.getAttribute("href"), external: true })) e.preventDefault();
      return;
    }
    var img = e.target.closest("[data-zoom]");
    if (img) {
      var big = document.createElement("img");
      big.src = img.currentSrc || img.src; big.alt = img.alt;
      openModal(img.alt || "Зображення", big, { image: true });
    }
  });

  /* ---------------------------------------------------------------- документи: пошук і фільтри */
  $$("[data-docs]").forEach(function (box) {
    var input = $("[data-docs-search]", box);
    var chips = $$("[data-docs-filter]", box);
    var items = $$("[data-doc]", box);
    var count = $("[data-docs-count]", box);
    var empty = $("[data-docs-empty]", box);
    var section = "";
    if (!input && !chips.length) return;

    function apply() {
      var q = input ? input.value.trim().toLowerCase() : "";
      var words = q.split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (it) {
        var title = it.dataset.title;
        var ok = (!section || it.dataset.section === section) && words.every(function (w) { return title.indexOf(w) !== -1; });
        it.hidden = !ok;
        if (ok) { shown++; it.classList.add("is-in"); }
      });
      $$("[data-doc-group]", box).forEach(function (g) { g.hidden = !$$("[data-doc]:not([hidden])", g).length; });
      if (count) count.textContent = shown === items.length ? items.length + " документів" : shown + " з " + items.length;
      if (empty) empty.hidden = shown > 0;
    }
    if (input) {
      input.addEventListener("input", apply);
      // «/» — швидкий перехід до пошуку
      document.addEventListener("keydown", function (e) {
        if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
      });
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        section = c.dataset.docsFilter;
        chips.forEach(function (x) { x.classList.toggle("is-active", x === c); });
        apply();
      });
    });
    apply();
  });

  /* ---------------------------------------------------------------- архів новин: фільтр за роком */
  var yearChips = $$("[data-news-year]");
  yearChips.forEach(function (c) {
    c.addEventListener("click", function () {
      var y = c.dataset.newsYear;
      yearChips.forEach(function (x) { x.classList.toggle("is-active", x === c); });
      var run = function () {
        $$("[data-news-archive] [data-year]").forEach(function (cell) {
          cell.classList.toggle("is-hidden", !!y && cell.dataset.year !== y);
          $$("[data-reveal]", cell).forEach(function (r) { r.classList.add("is-in"); });
        });
      };
      if (document.startViewTransition && !reduce) document.startViewTransition(run); else run();
    });
  });

  /* ---------------------------------------------------------------- поділитися */
  $$("[data-share]").forEach(function (b) {
    b.addEventListener("click", function () {
      var data = { title: b.dataset.shareTitle, url: b.dataset.shareUrl };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      var label = $("[data-share-label]", b);
      (navigator.clipboard ? navigator.clipboard.writeText(data.url) : Promise.reject())
        .then(function () { label.textContent = "Посилання скопійовано ✓"; })
        .catch(function () { label.textContent = data.url; })
        .finally(function () { setTimeout(function () { label.textContent = "Поділитися"; }, 2500); });
    });
  });

  /* ---------------------------------------------------------------- дихальна вправа
     Вдих 4 с → пауза 2 с → видих 6 с, 5 циклів (з посібника психолога). */
  $$("[data-breathe]").forEach(function (box) {
    var btn = $("[data-breathe-toggle]", box);
    var circle = $("[data-breathe-circle]", box);
    var phaseEl = $("[data-breathe-phase]", box);
    var countEl = $("[data-breathe-count]", box);
    var PHASES = [["in", "Вдих", 4000], ["hold", "Пауза", 2000], ["out", "Видих", 6000]];
    var CYCLES = 5, timer = null, cycle = 0, step = 0;

    function setLabel(running) {
      btn.querySelector("span").textContent = running ? "Зупинити" : (cycle >= CYCLES ? "Ще раз" : "Почати вправу");
      btn.querySelector("i").className = "fa-solid " + (running ? "fa-stop" : "fa-play");
    }
    function stop(done) {
      clearTimeout(timer); timer = null;
      box.classList.remove("is-running");
      circle.style.transitionDuration = "1.2s";
      circle.dataset.phase = "";
      phaseEl.textContent = done ? "Чудово! 🌿" : "Готові?";
      countEl.textContent = done ? "Відчуйте спокій" : CYCLES + " циклів";
      setLabel(false);
    }
    function next() {
      if (step === PHASES.length) { step = 0; cycle++; }
      if (cycle >= CYCLES) { stop(true); return; }
      var ph = PHASES[step++];
      circle.style.transitionDuration = ph[2] + "ms";
      circle.dataset.phase = ph[0];
      phaseEl.textContent = ph[1];
      countEl.textContent = "Цикл " + (cycle + 1) + " з " + CYCLES;
      timer = setTimeout(next, ph[2]);
    }
    btn.addEventListener("click", function () {
      if (timer) { stop(false); return; }
      cycle = 0; step = 0;
      box.classList.add("is-running");
      setLabel(true);
      next();
    });
  });

  /* ---------------------------------------------------------------- календар: тиждень A/B і канікули
     Дані — з content/school-year.json (вбудовані в сторінку як #school-calendar).
     Тиждень, у якому всі робочі дні (Пн–Пт) припадають на канікули, у чергуванні не рахується. */
  var Cal = (function () {
    var raw = $("#school-calendar");
    var cal = { holidays: [], ab: null };
    try { if (raw) cal = JSON.parse(raw.textContent) || cal; } catch (e) {}
    var MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
    var WD = ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"];

    function parse(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function add(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
    function monday(d) { var x = day0(d); return add(x, -((x.getDay() + 6) % 7)); }
    function fmt(d) { return d.getDate() + " " + MONTHS[d.getMonth()]; }
    // поза навчальним роком (після кінця травня / до 1 вересня) — літні канікули
    var SUMMER = { title: "Літні канікули", emoji: "☀️" };
    function holidayOn(d) {
      d = day0(d);
      if (cal.yearEnd && d > parse(cal.yearEnd)) return SUMMER;
      if (cal.yearStart && d < parse(cal.yearStart)) return SUMMER;
      for (var i = 0; i < cal.holidays.length; i++) {
        var h = cal.holidays[i];
        if (d >= parse(h.start) && d <= parse(h.end)) return h;
      }
      return null;
    }
    function weekIsHoliday(mon) { for (var i = 0; i < 5; i++) if (!holidayOn(add(mon, i))) return false; return true; }
    function other(w) { return w === "A" ? "B" : "A"; }

    // буква тижня для дати (null — якщо тиждень повністю канікулярний або A/B не налаштовано)
    function weekOf(d) {
      if (!cal.ab || !cal.ab.anchor) return null;
      var mon = monday(d), anchor = parse(cal.ab.anchor), skip = cal.ab.skipHolidayWeeks !== false;
      if (skip && weekIsHoliday(mon)) return null;
      var n = 0, cur = anchor, guard = 0;
      if (mon >= anchor) {
        while (cur < mon && guard++ < 600) { if (!(skip && weekIsHoliday(cur))) n++; cur = add(cur, 7); }
      } else {
        while (cur > mon && guard++ < 600) { cur = add(cur, -7); if (!(skip && weekIsHoliday(cur))) n--; }
      }
      return Math.abs(n) % 2 === 0 ? cal.ab.week : other(cal.ab.week);
    }
    // найближчий навчальний день, починаючи з d (пропускає вихідні й канікули)
    function nextSchoolDay(d) {
      var x = day0(d);
      for (var i = 0; i < 400; i++, x = add(x, 1)) {
        var wd = x.getDay();
        if (wd !== 0 && wd !== 6 && !holidayOn(x)) return x;
      }
      return null;
    }

    // повний статус «на сьогодні» для плашки та розкладу
    function status(now) {
      now = day0(now || new Date());
      var wd = now.getDay(), weekend = wd === 0 || wd === 6;
      var hol = holidayOn(now);
      var nextDay = nextSchoolDay(now);
      var s = { date: now, weekend: weekend, holiday: hol, schoolDay: !weekend && !hol,
                week: null, nextWeek: null, resume: nextDay, resumeWeek: nextDay ? weekOf(nextDay) : null,
                upcoming: null };
      if (s.schoolDay) {
        s.week = weekOf(now);
        var nm = add(monday(now), 7);
        var nextHol = weekIsHoliday(nm) ? holidayOn(nm) || holidayOn(add(nm, 4)) : null;
        s.nextWeek = nextHol ? null : weekOf(nm);
        s.nextWeekHoliday = nextHol;
      }
      // канікули, що починаються протягом найближчих 10 днів
      for (var i = 0; i < cal.holidays.length; i++) {
        var st = parse(cal.holidays[i].start), diff = (st - now) / 864e5;
        if (diff > 0 && diff <= 10) { s.upcoming = cal.holidays[i]; break; }
      }
      // який тиждень показувати в розкладі: поточний, а у вихідні/канікули — найближчий навчальний
      s.showWeek = s.schoolDay ? s.week : s.resumeWeek;
      return s;
    }

    function render(s, compact) {
      var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      var chip = function (w, label) { return w ? '<span class="wk wk--' + w.toLowerCase() + '">' + (label === undefined ? "тиждень " : label ? label + " " : "") + w + "</span>" : ""; };
      var icon, main, sub = "";
      if (s.holiday === SUMMER) {
        icon = SUMMER.emoji;
        main = "<strong>Літні канікули</strong>";
        sub = cal.yearEnd && s.date > parse(cal.yearEnd) ? "Навчальний рік завершено. Гарного літа!" : "Навчання з 1 вересня";
      } else if (s.holiday) {
        icon = s.holiday.emoji || "🏖️";
        main = "<strong>" + esc(s.holiday.title) + "</strong> — до " + fmt(parse(s.holiday.end));
        if (s.resume) sub = "Навчання з " + fmt(s.resume) + (s.resumeWeek ? " · " + chip(s.resumeWeek) : "");
      } else if (s.weekend) {
        icon = "🌤️";
        main = "<strong>Вихідні</strong>";
        if (s.resume) sub = (holidayOn(add(s.date, 1)) || holidayOn(add(s.date, 2)) ? "Навчання з " + fmt(s.resume) : "З понеділка") + (s.resumeWeek ? " · " + chip(s.resumeWeek) : "");
      } else {
        icon = "📚";
        main = "Сьогодні " + WD[s.date.getDay()] + ", " + fmt(s.date) + (s.week ? " · " + chip(s.week, "Тиждень") : "");
        if (s.nextWeek) sub = "Наступний тиждень — " + chip(s.nextWeek, "");
        else if (s.nextWeekHoliday) sub = "Наступного тижня — " + esc(s.nextWeekHoliday.title.toLowerCase()) + " " + (s.nextWeekHoliday.emoji || "");
      }
      if (!compact && s.upcoming && !s.holiday) {
        sub += (sub ? " · " : "") + (s.upcoming.emoji || "") + " " + esc(s.upcoming.title) + " з " + fmt(parse(s.upcoming.start));
      }
      return '<span class="week-status__icon" aria-hidden="true">' + icon + '</span>' +
             '<span class="week-status__text"><span class="week-status__main">' + main + '</span>' +
             (sub ? '<span class="week-status__sub">' + sub + "</span>" : "") + "</span>" +
             (compact ? '<span class="week-status__go">Розклад <i class="fa-solid fa-arrow-right"></i></span>' : "");
    }

    // ?date=2027-03-22 у адресі — перевірка, як сайт виглядатиме в інший день
    var forced = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(location.search);
    var today = status(forced ? parse(forced[1]) : new Date());
    if (cal.ab || cal.holidays.length) {
      $$("[data-week-status]").forEach(function (el) {
        el.innerHTML = render(today, el.classList.contains("week-status--compact"));
        el.classList.toggle("is-holiday", !!today.holiday);
        el.hidden = false;
      });
    }
    return { today: today, weekOf: weekOf, holidayOn: holidayOn, status: status, parse: parse, raw: cal, fmt: fmt };
  })();
  window.SchoolCalendar = Cal;

  function pluralDays(n) {
    n = Math.abs(n);
    if (n % 10 === 1 && n % 100 !== 11) return "день";
    return n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "дні" : "днів";
  }

  /* ---------------------------------------------------------------- привітання на головній */
  (function () {
    var el = $("[data-hello]");
    if (!el) return;
    var s = Cal.today, now = new Date(), h = now.getHours();
    var WD = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота"];
    var g;
    if (s.holiday) g = ["Чудових канікул!", s.holiday.emoji || "🏖️"];
    else if (s.weekend) g = ["Гарних вихідних!", "🎈"];
    else if (h >= 5 && h < 12) g = ["Доброго ранку!", "☀️"];
    else if (h < 18 && h >= 12) g = ["Гарного дня!", "🌤️"];
    else if (h >= 18 && h < 23) g = ["Доброго вечора!", "🌙"];
    else g = ["Доброї ночі!", "🌌"];

    var chips = [];
    if (s.schoolDay && s.week) chips.push(["📅", "Зараз тиждень " + s.week, "wk-" + s.week.toLowerCase()]);
    else if (!s.holiday && s.resumeWeek) chips.push(["📅", "З понеділка тиждень " + s.resumeWeek, "wk-" + s.resumeWeek.toLowerCase()]);

    // найближчі канікули та літо
    var raw = Cal.raw, today = s.date, items = (raw.holidays || []).slice();
    if (raw.yearEnd) {
      var after = Cal.parse(raw.yearEnd); after.setDate(after.getDate() + 1);
      items.push({ title: "Літні канікули", start: after.toISOString().slice(0, 10), emoji: "☀️", summer: true });
    }
    var shown = 0;
    items.forEach(function (it) {
      if (shown >= 2) return;
      var st = Cal.parse(it.start), en = it.end ? Cal.parse(it.end) : null, days;
      if (today >= st && (!en || today <= en)) {
        if (en) { days = Math.round((en - today) / 864e5) + 1; chips.push([it.emoji || "🏖️", "Канікули ще " + days + " " + pluralDays(days), "now"]); shown++; }
      } else if (today < st) {
        days = Math.round((st - today) / 864e5);
        // «Зимові канікули» → «До зимових канікул»; м'яка група: «Осінні» → «До осінніх»
        var name = it.summer ? "До літа" : "До " + it.title.toLowerCase()
          .replace(/^(\S+нн)і канікули$/, "$1іх канікул")
          .replace(/^(\S+)і канікули$/, "$1их канікул");
        chips.push([it.emoji || "🏖️", name + " " + days + " " + pluralDays(days), shown ? "" : "next"]);
        shown++;
      }
    });

    el.innerHTML =
      '<div class="hello__greet"><span class="hello__emoji" aria-hidden="true">' + g[1] + '</span>' +
      '<div><p class="hello__title">' + g[0] + '</p><p class="hello__date">' + WD[now.getDay()] + ", " + Cal.fmt(now) + "</p></div></div>" +
      '<a class="hello__chips" href="' + el.dataset.scheduleUrl + '" aria-label="Розклад і канікули">' +
      chips.map(function (c, i) { return '<span class="hello__chip ' + (c[2] ? "hello__chip--" + c[2] : "") + '" style="--i:' + i + '"><span aria-hidden="true">' + c[0] + "</span>" + c[1] + "</span>"; }).join("") +
      "</a>";
    el.hidden = false;
  })();

  /* ---------------------------------------------------------------- сезонні частинки й шкільні смайлики в банері */
  (function () {
    var fx = $("[data-hero-fx]");
    if (!fx || reduce) return;
    var m = new Date().getMonth();
    var season = m === 11 || m <= 1 ? ["❄️", "❄️", "✨"] : m <= 4 ? ["🌸", "🌷", "🌼"] : m <= 7 ? ["☀️", "🌻", "🦋"] : ["🍂", "🍁", "🍃"];
    var school = ["📚", "✏️", "🎨", "🔬", "⚽", "🎵", "🧮", "🌍", "📐", "💡"];
    var small = innerWidth < 760;
    var frag = document.createDocumentFragment();
    var fallH = fx.getBoundingClientRect().height + 80;
    for (var i = 0; i < (small ? 9 : 18); i++) {
      var p = document.createElement("span");
      p.className = "fx-fall";
      p.textContent = season[i % season.length];
      p.style.cssText = "left:" + (Math.random() * 100) + "%;font-size:" + (0.8 + Math.random() * 0.9).toFixed(2) + "rem;" +
        "--fall:" + fallH + "px;--sway:" + ((Math.random() - 0.5) * 120).toFixed(0) + "px;" +
        "animation-duration:" + (9 + Math.random() * 10).toFixed(1) + "s;animation-delay:-" + (Math.random() * 18).toFixed(1) + "s";
      frag.appendChild(p);
    }
    for (var j = 0; j < (small ? 4 : 8); j++) {
      var f = document.createElement("span");
      f.className = "fx-float";
      f.textContent = school[(j * 3 + m) % school.length];
      f.style.cssText = "left:" + (small ? 62 + Math.random() * 32 : 55 + Math.random() * 40) + "%;top:" + (12 + Math.random() * 70) + "%;" +
        "font-size:" + (1.6 + Math.random() * 1.4).toFixed(2) + "rem;animation-duration:" + (5 + Math.random() * 5).toFixed(1) + "s;" +
        "animation-delay:-" + (Math.random() * 5).toFixed(1) + "s";
      frag.appendChild(f);
    }
    fx.appendChild(frag);
  })();

  /* ---------------------------------------------------------------- пасхалка: 5 кліків по «7» на головній — конфеті */
  (function () {
    var mark = $(".header .brand__mark");
    if (!mark || document.body.dataset.page !== "home") return;
    var clicks = 0, timer;
    mark.closest("a").addEventListener("click", function (e) {
      e.preventDefault();
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(function () { clicks = 0; }, 1500);
      mark.animate([{ transform: "scale(1)" }, { transform: "scale(1.25) rotate(-12deg)" }, { transform: "scale(1)" }], { duration: 260 });
      if (clicks < 5) return;
      clicks = 0;
      if (reduce) return;
      var r = mark.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var bits = ["🎉", "✨", "💛", "💙", "⭐", "🎈", "📚", "7"];
      for (var i = 0; i < 46; i++) {
        var b = document.createElement("span");
        b.className = "confetti";
        b.textContent = bits[i % bits.length];
        b.style.left = x + "px"; b.style.top = y + "px";
        document.body.appendChild(b);
        var ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.7 - 80;
        b.animate([
          { transform: "translate(-50%,-50%) scale(.4)", opacity: 1 },
          { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) rotate(" + (Math.random() * 540 - 270) + "deg) scale(1)", opacity: 1, offset: .7 },
          { transform: "translate(calc(-50% + " + dx * 1.1 + "px), calc(-50% + " + (dy + 220) + "px)) rotate(" + (Math.random() * 720) + "deg) scale(.8)", opacity: 0 }
        ], { duration: 1400 + Math.random() * 600, easing: "cubic-bezier(.16,1,.3,1)" }).onfinish = (function (el) { return function () { el.remove(); }; })(b);
      }
    });
  })();

  /* ---------------------------------------------------------------- дзвінки: який урок зараз
     ?time=09:40 у адресі — перевірка, як сайт виглядає в інший час дня */
  (function () {
    var bells = (Cal.raw.bells || []).map(function (b) {
      var s = b.start.split(":"), e = b.end.split(":");
      return { n: b.n, start: b.start, end: b.end, s: +s[0] * 60 + +s[1], e: +e[0] * 60 + +e[1] };
    });
    if (!bells.length) return;
    var forced = /[?&]time=(\d{1,2}):(\d{2})/.exec(location.search);

    function minutesNow() {
      if (forced) return +forced[1] * 60 + +forced[2];
      var d = new Date();
      return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    }
    function ord(n) { return n + "-й"; }
    function mins(x) { var m = Math.max(1, Math.ceil(x)); return m + " хв"; }

    function state() {
      if (!Cal.today.schoolDay) return null;
      var m = minutesNow();
      if (m < bells[0].s) return { kind: "before", next: bells[0], left: bells[0].s - m };
      for (var i = 0; i < bells.length; i++) {
        var b = bells[i], nx = bells[i + 1];
        if (m >= b.s && m < b.e) return { kind: "lesson", cur: b, left: b.e - m, p: (m - b.s) / (b.e - b.s) };
        if (nx && m >= b.e && m < nx.s) return { kind: "break", next: nx, prev: b, left: nx.s - m };
      }
      return { kind: "after", last: bells[bells.length - 1] };
    }
    function text(st) {
      if (!st) return null;
      if (st.kind === "before") return ["⏰", "Уроки починаються о " + st.next.start, "До першого дзвінка " + mins(st.left)];
      if (st.kind === "lesson") return ["🔔", "Зараз " + ord(st.cur.n) + " урок", "До дзвінка " + mins(st.left)];
      if (st.kind === "break") return ["☕", "Перерва", ord(st.next.n) + " урок о " + st.next.start];
      return ["🏡", "Уроки на сьогодні завершились", ""];
    }

    var live = $("[data-bell-live]");
    var helloChips = $(".hello__chips");
    function update() {
      var st = state(), t = text(st);
      // блок «Розклад дзвінків»
      $$("[data-bell]").forEach(function (li) {
        var n = +li.dataset.bell, b = bells.filter(function (x) { return x.n === n; })[0];
        var m = minutesNow(), on = st && st.kind === "lesson" && st.cur.n === n;
        li.classList.toggle("is-now", !!on);
        li.classList.toggle("is-next", !!(st && (st.kind === "break" || st.kind === "before") && st.next.n === n));
        li.classList.toggle("is-past", !!(st && Cal.today.schoolDay && m >= b.e));
        li.style.setProperty("--p", on ? st.p.toFixed(3) : 0);
      });
      if (live) {
        live.innerHTML = t ? '<span aria-hidden="true">' + t[0] + "</span> <strong>" + t[1] + "</strong>" + (t[2] ? " · " + t[2] : "") : "";
        live.hidden = !t;
      }
      // поточний урок у таблиці на сьогодні
      $$(".tt-cell.is-now-lesson, .tt-num.is-now-lesson").forEach(function (el) { el.classList.remove("is-now-lesson"); });
      if (st && st.kind === "lesson") {
        var d = (Cal.today.date.getDay() + 6) % 7;
        $$('.tt-cell[data-day="' + d + '"][data-n="' + st.cur.n + '"], .tt-num[data-n="' + st.cur.n + '"]').forEach(function (el) { el.classList.add("is-now-lesson"); });
      }
      // чип на головній
      if (helloChips) {
        var chip = $("[data-bell-chip]", helloChips);
        if (!t || st.kind === "after") { if (chip) chip.remove(); }
        else {
          if (!chip) {
            chip = document.createElement("span");
            chip.className = "hello__chip hello__chip--bell";
            chip.setAttribute("data-bell-chip", "");
            helloChips.insertBefore(chip, helloChips.firstChild);
          }
          chip.innerHTML = '<span aria-hidden="true">' + t[0] + "</span>" + t[1] + (t[2] ? " · " + t[2].toLowerCase() : "");
        }
      }
    }
    update();
    if (!forced) setInterval(update, 30000);
  })();

  /* зворотний відлік до канікул: «через 44 дні» / «зараз · ще 12 днів» / «минули» */
  (function () {
    var cards = $$("[data-holiday]");
    if (!cards.length) return;
    function plural(n, one, few, many) {
      n = Math.abs(n);
      if (n % 10 === 1 && n % 100 !== 11) return one;
      return n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
    }
    var now = Cal.today.date, nextMarked = false;
    cards.forEach(function (c) {
      var start = Cal.parse(c.dataset.start), end = c.dataset.end ? Cal.parse(c.dataset.end) : null;
      var out = $("[data-countdown]", c), days;
      if (now >= start && (!end || now <= end)) {
        c.classList.add("is-now");
        if (end) { days = Math.round((end - now) / 864e5) + 1; out.textContent = "Зараз · ще " + days + " " + plural(days, "день", "дні", "днів"); }
        else out.textContent = "Зараз";
      } else if (now < start) {
        days = Math.round((start - now) / 864e5);
        out.textContent = days === 1 ? "Завтра!" : "Через " + days + " " + plural(days, "день", "дні", "днів");
        if (!nextMarked) { c.classList.add("is-next"); nextMarked = true; }
      } else {
        c.classList.add("is-past");
        out.textContent = "Минули";
      }
    });
  })();

  /* ---------------------------------------------------------------- розклад уроків */
  $$("[data-schedule]").forEach(function (box) {
    var btns = $$("[data-class-btn]", box);
    var tables = $$("[data-class]", box);
    var dayBtns = $$("[data-day-btn]", box);
    if (!tables.length) return;

    // сьогодні: Пн=0 … Пт=4; у вихідні й на канікулах — день, коли навчання відновиться (або понеділок)
    var st = Cal.today;
    var today = st.schoolDay ? (st.date.getDay() + 6) % 7 : -1;
    var resumeDay = st.resume && st.holiday !== undefined && !st.schoolDay ? (st.resume.getDay() + 6) % 7 : 0;
    var day = today >= 0 ? today : resumeDay;

    function replay(table) {
      if (reduce || !table) return;
      table.classList.remove("is-entering");
      void table.offsetWidth; // перезапуск анімації
      table.classList.add("is-entering");
    }
    function activeTable() { return $(".timetable.is-active", box); }

    function setClass(name, animate) {
      var t = tables.filter(function (x) { return x.dataset.class === name; })[0] || tables[0];
      tables.forEach(function (x) { x.classList.toggle("is-active", x === t); });
      btns.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.classBtn === t.dataset.class)); });
      store("schedule-class", t.dataset.class);
      if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(t.dataset.class));
      if (animate) replay(t);
    }
    function setDay(i, animate) {
      day = i;
      box.dataset.activeDay = String(i);
      dayBtns.forEach(function (b) { b.setAttribute("aria-selected", String(+b.dataset.dayBtn === i)); });
      if (animate) replay(activeTable());
    }

    if (today >= 0) {
      dayBtns.forEach(function (b) { b.classList.toggle("is-today", +b.dataset.dayBtn === today); });
      $$('.tt-head[data-day="' + today + '"], .tt-cell[data-day="' + today + '"]', box).forEach(function (el) { el.classList.add("is-today"); });
    }

    btns.forEach(function (b) { b.addEventListener("click", function () { setClass(b.dataset.classBtn, true); }); });
    dayBtns.forEach(function (b) { b.addEventListener("click", function () { setDay(+b.dataset.dayBtn, true); }); });
    var weekBtns = $$("[data-week-btn]", box);
    function setWeek(w) {
      box.dataset.week = w;
      weekBtns.forEach(function (x) { x.classList.toggle("is-active", x.dataset.weekBtn === w); });
    }
    weekBtns.forEach(function (b) { b.addEventListener("click", function () { setWeek(b.dataset.weekBtn); }); });
    // поточний (або найближчий навчальний) тиждень — вибраний одразу й позначений «зараз»
    if (st.showWeek && weekBtns.length) {
      weekBtns.forEach(function (b) {
        if (b.dataset.weekBtn === st.showWeek) b.insertAdjacentHTML("beforeend", ' <span class="seg__now">' + (st.schoolDay ? "зараз" : "далі") + "</span>");
      });
      setWeek(st.showWeek);
    }
    $$("[data-print]", box).forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });

    // свайп ліворуч/праворуч по таблиці на телефоні — сусідній день
    var sx = 0, sy = 0;
    box.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (!e.target.closest(".timetable") || matchMedia("(min-width: 900px)").matches) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      setDay((day + (dx < 0 ? 1 : 4)) % 5, true);
    }, { passive: true });

    function hashClass() { return decodeURIComponent(location.hash.replace(/^#(class-)?/, "")); }
    // посилання на інший клас у межах сторінки (#5-Б) — без перезавантаження
    addEventListener("hashchange", function () { if (hashClass()) setClass(hashClass(), true); });
    setClass(hashClass() || store("schedule-class") || btns[0].dataset.classBtn, false);
    setDay(day, false);
  });
})();
