/* Міні-ігри сайту: «Розминка дня», «Впіймай листочок», «Знайди пару».
   Підключається лише на сторінках з іграми; спирається на window.SiteFX і window.SchoolCalendar з site.js. */
(function () {
  "use strict";
  var FX = window.SiteFX || {}, Cal = window.SchoolCalendar;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var reduce = FX.reduce;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function getJSON(k) { try { return JSON.parse(store(k) || "null"); } catch (e) { return null; } }
  function burst(el, n, bits) {
    if (!FX.confetti || !el) return;
    var r = el.getBoundingClientRect();
    FX.confetti(r.left + r.width / 2, r.top + r.height / 2, n, bits);
  }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var today = Cal ? Cal.today.date : new Date();

  /* ============================================================ 🧠 Розминка дня */
  (function () {
    var box = $("[data-quiz]"), raw = $("#quiz-data");
    if (!box || !raw) return;
    var qs = [];
    try { qs = JSON.parse(raw.textContent) || []; } catch (e) {}
    if (!qs.length) return;

    var dayNo = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(2026, 0, 1)) / 864e5);
    var dailyIdx = ((dayNo % qs.length) + qs.length) % qs.length;
    var todayKey = iso(today);
    var PRAISE = ["Молодець! 🎉", "Так тримати! 🌟", "Блискуче! ✨", "Супер! 💪", "Розумничка! 🧠", "Влучно! 🎯"];

    // 🔥 серія: правильні відповіді поспіль (денні й бонусні); неправильна — серія згасає
    function streak() { var s = getJSON("quiz-combo"); return s ? s.count : 0; }
    function setStreak(n) { store("quiz-combo", JSON.stringify({ count: n })); }
    function fires(n) {
      return '<span class="quiz__fires" aria-hidden="true">' + new Array(Math.min(n, 5) + 1).join("🔥") + "</span>" +
             '<b class="quiz__count">' + n + "</b>";
    }
    function paintStreak(el, n, bump) {
      el.hidden = !n;
      el.innerHTML = n ? fires(n) : "";
      el.setAttribute("aria-label", "Правильних відповідей поспіль: " + n);
      el.classList.toggle("is-hot", n >= 5);
      if (bump) { el.classList.remove("is-up"); void el.offsetWidth; el.classList.add("is-up"); }
    }

    function render(idx, daily) {
      var q = qs[idx], done = daily ? getJSON("quiz-day") : null;
      if (done && done.date !== todayKey) done = null;
      var st = streak();
      box.innerHTML =
        '<div class="quiz__head">' +
          '<span class="quiz__badge">' + (daily ? "🧠 Розминка дня" : "🎲 Бонусне питання") + "</span>" +
          (q.topic ? '<span class="quiz__topic">' + q.topic + "</span>" : "") +
          '<span class="quiz__streak" data-streak title="Правильних відповідей поспіль"></span>' +
        "</div>" +
        '<p class="quiz__q">' + q.q + "</p>" +
        '<div class="quiz__options" role="group" aria-label="Варіанти відповіді">' +
          q.options.map(function (o, i) { return '<button class="quiz__opt" type="button" data-i="' + i + '" style="--i:' + i + '"><span class="quiz__letter">' + "АБВГ"[i] + "</span>" + o + "</button>"; }).join("") +
        "</div>" +
        '<p class="quiz__result" aria-live="polite"></p>' +
        '<button class="btn btn--soft btn--sm quiz__more" type="button" hidden>Ще питання 🎲</button>';

      var opts = $$(".quiz__opt", box), result = $(".quiz__result", box), more = $(".quiz__more", box);
      var streakEl = $("[data-streak]", box);
      paintStreak(streakEl, st, false);
      function reveal(pick, animate) {
        opts.forEach(function (b) {
          var i = +b.dataset.i;
          b.disabled = true;
          b.classList.toggle("is-right", i === q.answer);
          b.classList.toggle("is-wrong", i === pick && pick !== q.answer);
        });
        if (pick === q.answer) {
          result.textContent = animate ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : "Ви вже відповіли правильно ✅ Нове питання — завтра!";
          result.className = "quiz__result is-right";
          if (animate) burst(opts[pick], 26, ["🎉", "⭐", "✨", "💛", "💙"]);
        } else {
          result.textContent = "Майже! Правильна відповідь — «" + q.options[q.answer] + "» 💡";
          result.className = "quiz__result is-wrong";
        }
        more.hidden = false;
      }
      opts.forEach(function (b) {
        b.addEventListener("click", function () {
          var pick = +b.dataset.i;
          if (daily) store("quiz-day", JSON.stringify({ date: todayKey, pick: pick }));
          reveal(pick, true);
          if (pick === q.answer) {
            var n = streak() + 1;
            setStreak(n);
            paintStreak(streakEl, n, true);
            if (n === 5 || n === 10 || n === 20 || n === 50) {
              result.textContent = "🔥 " + n + " поспіль! Ти в ударі!";
              burst(streakEl, 34, ["🔥", "⭐", "✨", "🎉"]);
            }
          } else if (streak() > 0) {
            var lost = streak();
            setStreak(0);
            streakEl.hidden = false;
            streakEl.classList.remove("is-hot");
            streakEl.innerHTML = "💨 серія " + lost + " згасла";
            streakEl.classList.add("is-out");
            setTimeout(function () { streakEl.classList.remove("is-out"); paintStreak(streakEl, 0, false); }, 1800);
          }
        });
      });
      more.addEventListener("click", function () {
        var next = idx;
        while (qs.length > 1 && next === idx) next = Math.floor(Math.random() * qs.length);
        box.classList.remove("is-flip"); void box.offsetWidth; box.classList.add("is-flip");
        render(next, false);
      });
      if (done) reveal(done.pick, false);
    }
    render(dailyIdx, true);
    box.hidden = false;
  })();

  /* ============================================================ 🍂 Впіймай листочок (сезонне) */
  (function () {
    var fx = $("[data-hero-fx]"), badge = $("[data-catch]");
    if (!fx || !badge || reduce) return;
    var season = FX.season || { catchWord: "листочок", caught: "листочків", fall: ["🍂"] };
    var count = 0, best = +(store("catch-best-" + season.key) || 0), hinted = false;
    fx.classList.add("hero__fx--catch");

    function show() {
      badge.innerHTML = count
        ? '<span class="catch__n">' + season.fall[0] + " × " + count + "</span>" + (best ? '<span class="catch__best">рекорд ' + Math.max(best, count) + "</span>" : "")
        : "👆 Впіймай " + season.catchWord + "!";
      badge.hidden = false;
    }
    setTimeout(function () { if (!hinted) { hinted = true; show(); } }, 2200);

    fx.addEventListener("pointerdown", function (e) {
      var p = e.target.closest(".fx-fall");
      if (!p || p.classList.contains("is-caught")) return;
      e.preventDefault();
      p.classList.add("is-caught");
      var r = p.getBoundingClientRect();
      // «+1» над місцем ловлі
      var plus = document.createElement("span");
      plus.className = "catch__plus"; plus.textContent = "+1";
      plus.style.left = (r.left + r.width / 2 - fx.getBoundingClientRect().left) + "px";
      plus.style.top = (r.top - fx.getBoundingClientRect().top) + "px";
      fx.appendChild(plus);
      setTimeout(function () { plus.remove(); }, 800);
      // листочок «лопається», а замість нього згори вилітає новий — копія з тією ж швидкістю падіння.
      // (Скидати анімацію через style.animation не можна: це стирає й тривалість, і листочок зависав.)
      setTimeout(function () {
        var fresh = p.cloneNode(true);
        fresh.classList.remove("is-caught");
        fresh.style.left = (Math.random() * 100) + "%";
        fresh.style.animationDelay = "0s";
        p.replaceWith(fresh);
      }, 320);
      count++;
      hinted = true;
      if (count > best) { best = count; store("catch-best-" + season.key, best); }
      show();
      badge.classList.remove("is-pop"); void badge.offsetWidth; badge.classList.add("is-pop");
      if (count === 10 || count === 25 || count === 50 || count === 100) {
        burst(badge, 30, season.fall.concat(["🎉", "⭐"]));
        badge.insertAdjacentHTML("beforeend", '<span class="catch__wow">' + count + " " + season.caught + "! 🎉</span>");
        setTimeout(function () { var w = $(".catch__wow", badge); if (w) w.remove(); }, 2200);
      }
    });
  })();

  /* ============================================================ 🎮 Знайди пару (сторінка «Ігри на перерву»)
     Рівні: 🐣 6 пар, 🦊 8 пар, 🦁 12 пар. Зірочки за кількість ходів, комбо за пари поспіль. */
  (function () {
    var box = $("[data-memory]");
    if (!box) return;
    var grid = $("[data-mem-grid]", box), movesEl = $("[data-mem-moves]", box), timeEl = $("[data-mem-time]", box),
        bestEl = $("[data-mem-best]", box), win = $("[data-mem-win]", box), comboEl = $("[data-mem-combo]", box);
    var ALL = [["📐", "лінійка"], ["🔬", "мікроскоп"], ["🎨", "фарби"], ["🎵", "ноти"], ["⚽", "мʼяч"], ["🌍", "глобус"],
               ["📚", "книжки"], ["🧮", "рахівниця"], ["🧪", "колба"], ["✏️", "олівець"], ["🎒", "рюкзак"], ["🔭", "телескоп"]];
    var LEVELS = { easy: { pairs: 6, cols: 4, name: "🐣 Легко" }, normal: { pairs: 8, cols: 4, name: "🦊 Нормально" }, hard: { pairs: 12, cols: 6, name: "🦁 Складно" } };
    var level = store("memory-level") || "normal";
    if (!LEVELS[level]) level = "normal";
    var icons, first = null, lock = false, moves = 0, found = 0, t0 = 0, timer = null, combo = 0;

    function fmt(sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
    function bestKey() { return "memory-best-" + level; }
    function showBest() { var b = getJSON(bestKey()); bestEl.textContent = b ? b.moves + " ходів · " + fmt(b.sec) : "—"; }
    function tick() { timeEl.textContent = fmt(Math.floor((Date.now() - t0) / 1000)); }
    // ⭐⭐⭐ — якщо ходів не набагато більше, ніж пар
    function stars(m) { var p = LEVELS[level].pairs; return m <= p * 1.5 ? 3 : m <= p * 2.2 ? 2 : 1; }

    function sparkle(card) {
      if (reduce) return;
      for (var i = 0; i < 8; i++) {
        var s = document.createElement("span");
        s.className = "spark"; s.textContent = i % 2 ? "✨" : "⭐";
        card.appendChild(s);
        var a = (i / 8) * Math.PI * 2, d = 38 + Math.random() * 18;
        s.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 },
                   { transform: "translate(calc(-50% + " + Math.cos(a) * d + "px), calc(-50% + " + Math.sin(a) * d + "px)) scale(1)", opacity: 0 }],
                  { duration: 650, easing: "cubic-bezier(.16,1,.3,1)" }).onfinish = (function (el) { return function () { el.remove(); }; })(s);
      }
    }
    function showCombo(n) {
      if (!comboEl || n < 2) return;
      comboEl.textContent = "Комбо ×" + n + "!" + (n >= 4 ? " 🔥" : "");
      comboEl.classList.remove("is-on"); void comboEl.offsetWidth; comboEl.classList.add("is-on");
    }

    function deal() {
      var L = LEVELS[level];
      icons = ALL.slice().sort(function () { return Math.random() - 0.5; }).slice(0, L.pairs);
      var deck = icons.concat(icons).map(function (x, i) { return { e: x[0], name: x[1], k: i % L.pairs }; });
      for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
      grid.style.setProperty("--cols", L.cols);
      grid.dataset.level = level;
      grid.innerHTML = deck.map(function (c, i) {
        return '<button class="mcard" type="button" data-k="' + c.k + '" aria-label="Закрита картка ' + (i + 1) + '" data-name="' + c.name + '" style="--i:' + i + '">' +
               '<span class="mcard__inner"><span class="mcard__back" aria-hidden="true">7</span><span class="mcard__front" aria-hidden="true">' + c.e + "</span></span></button>";
      }).join("");
      first = null; lock = false; moves = 0; found = 0; t0 = 0; combo = 0;
      clearInterval(timer); timer = null;
      movesEl.textContent = "0"; timeEl.textContent = "0:00"; win.hidden = true;
      box.classList.remove("is-won"); box.classList.remove("is-dealing"); void box.offsetWidth; box.classList.add("is-dealing");
      setTimeout(function () { box.classList.remove("is-dealing"); }, 1100);
      $$("[data-mem-level]", box).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.memLevel === level)); });
      showBest();
    }

    grid.addEventListener("click", function (e) {
      var c = e.target.closest(".mcard");
      if (!c || lock || c.classList.contains("is-open") || c.classList.contains("is-matched")) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(tick, 1000); }
      c.classList.add("is-open");
      c.setAttribute("aria-label", c.dataset.name);
      if (!first) { first = c; return; }
      moves++; movesEl.textContent = moves;
      var a = first; first = null;
      if (a.dataset.k === c.dataset.k) {
        a.classList.add("is-matched"); c.classList.add("is-matched");
        sparkle(a); sparkle(c);
        combo++; showCombo(combo);
        found++;
        if (found === LEVELS[level].pairs) setTimeout(finish, 350);
      } else {
        combo = 0;
        lock = true;
        a.classList.add("is-miss"); c.classList.add("is-miss");
        setTimeout(function () {
          [a, c].forEach(function (x) { x.classList.remove("is-open", "is-miss"); x.setAttribute("aria-label", "Закрита картка"); });
          lock = false;
        }, 750);
      }
    });

    function finish() {
      clearInterval(timer);
      var sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
      var b = getJSON(bestKey()), record = !b || moves < b.moves || (moves === b.moves && sec < b.sec);
      if (record) store(bestKey(), JSON.stringify({ moves: moves, sec: sec }));
      showBest();
      var st = stars(moves);
      $("[data-mem-win-stars]", win).innerHTML = [1, 2, 3].map(function (i) { return '<span class="' + (i <= st ? "on" : "") + '" style="--i:' + i + '">⭐</span>'; }).join("");
      $("[data-mem-win-text]", win).textContent = (record ? "Новий рекорд! 🏆" : "Перемога! 🎉");
      $("[data-mem-win-sub]", win).textContent = LEVELS[level].name + " · " + moves + " ходів за " + fmt(sec);
      win.hidden = false;
      box.classList.add("is-won");
      burst(grid, 50, ["🎉", "⭐", "📚", "✏️", "💛", "💙", "🏆"]);
    }

    $$("[data-mem-restart]", box).forEach(function (b) { b.addEventListener("click", deal); });
    $$("[data-mem-level]", box).forEach(function (b) {
      b.addEventListener("click", function () { level = b.dataset.memLevel; store("memory-level", level); deal(); });
    });
    deal();
  })();
})();
