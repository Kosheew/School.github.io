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

  /* ---------------------------------------------------------------- шапка і меню */
  var header = $("[data-header]");
  var nav = $("[data-nav]");
  var burger = $("[data-burger]");
  var scrim = $("[data-scrim]");

  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  if (scrim) scrim.addEventListener("click", function () { setMenu(false); });
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
      header.classList.toggle("is-hidden", !menuOpen && y > 400 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove("is-hidden");
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

  /* ---------------------------------------------------------------- заголовки по словах */
  $$("[data-split]").forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement("span"); w.className = "w";
            var inner = document.createElement("span"); inner.textContent = part;
            w.style.setProperty("--wi", i++); w.appendChild(inner); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  });

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
  var observed = $$("[data-reveal], [data-count], [data-timeline]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("is-in");
        if (el.hasAttribute("data-count")) countUp(el);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.12 });
    observed.forEach(function (el) { io.observe(el); });
  } else {
    observed.forEach(function (el) { el.classList.add("is-in"); });
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
    dl.hidden = !opts.file; op.hidden = !opts.file;
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
})();
