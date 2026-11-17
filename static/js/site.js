/* Фастівська гімназія №7 — інтерактив і анімації. Без залежностей, без збирання. */
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
      setTimeout(function () { location.href = u.href; }, 360);
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

  /* ---------------------------------------------------------------- розклад уроків */
  $$("[data-schedule]").forEach(function (box) {
    var btns = $$("[data-class-btn]", box);
    var tables = $$("[data-class]", box);
    var dayBtns = $$("[data-day-btn]", box);
    if (!tables.length) return;

    // сьогодні: Пн=0 … Пт=4; у вихідні показуємо понеділок
    var wd = new Date().getDay();
    var today = wd >= 1 && wd <= 5 ? wd - 1 : -1;
    var day = today >= 0 ? today : 0;

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
    $$("[data-week-btn]", box).forEach(function (b, _, all) {
      b.addEventListener("click", function () {
        box.dataset.week = b.dataset.weekBtn;
        all.forEach(function (x) { x.classList.toggle("is-active", x === b); });
      });
    });
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
