/* js/modules.js —— 第二版的三个交互模块 + 卡片拖拽系统
 *
 * 模块一  自我介绍：名字「徐子涵」按真实笔顺逐笔书写，写完停顿 → 清空 → 重写，无限循环，颜色渐变
 * 模块二  当前时间：CSS 七段数码管，秒变化时有翻字闪动
 * 模块三  太阳与月亮：见 js/sun-moon.js（Three.js 着色器）
 *
 * 另外提供：卡片自由拖拽 + 一键归位（不持久化，刷新即回初始布局）+ 导航高亮卡片。
 */
(function () {
  "use strict";

  var D = window.__DIAG;

  /* ============================================================
     0. 统一的逐帧调度器（一个 requestAnimationFrame 驱动所有动画）
     ============================================================ */
  var Ticker = (function () {
    var subs = [];
    var last = performance.now();

    function frame(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // 切换标签页回来时不要跳帧
      if (!document.hidden) {
        for (var i = 0; i < subs.length; i++) {
          try {
            subs[i](dt, now / 1000);
          } catch (e) {
            D.err("ticker#" + i, e);
          }
        }
      }
      window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
    return {
      add: function (fn) {
        subs.push(fn);
      },
    };
  })();

  function isNarrow() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  /* ============================================================
     1. 卡片拖拽系统：自由摆放 + 一键归位
        位置不做持久化 —— 每次刷新页面都回到 CSS 里设计好的初始位置，
        拖乱之后点左上角「归位」也能立刻回到这套位置。
     ============================================================ */
  var stage = null;
  var topZ = 30;
  var Z_RESET_AT = 400; // 拖来拖去把 z-index 抬得太高时，统一压回基础层

  function eachCard(fn) {
    var list = stage.querySelectorAll(".card");
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function bringToFront(card) {
    if (topZ > Z_RESET_AT) {
      topZ = 30;
      eachCard(function (c) {
        c.style.zIndex = "";
      });
    }
    topZ += 1;
    card.style.zIndex = String(topZ);
  }

  function resetLayout() {
    eachCard(function (card) {
      card.style.left = "";
      card.style.top = "";
      card.style.zIndex = "";
      card.classList.remove("flash");
    });
    topZ = 30;
  }

  function clampCard(card) {
    var w = card.offsetWidth;
    var h = card.offsetHeight;
    var sw = stage.clientWidth;
    var sh = stage.clientHeight;
    var min = 90; // 至少留 90px 在舞台内，卡片不会被拖丢
    var l = parseFloat(card.style.left);
    var t = parseFloat(card.style.top);
    if (isNaN(l) || isNaN(t)) return;
    var lMax = Math.max(sw - min, min);
    var tMax = Math.max(sh - min, min);
    card.style.left = Math.min(Math.max(l, -w + min), lMax) + "px";
    card.style.top = Math.min(Math.max(t, -h + min), tMax) + "px";
  }

  function initLayout() {
    stage = document.getElementById("stage");
    if (!stage) throw new Error("找不到 #stage");

    // 不读任何存档：卡片位置永远从 CSS 的初始布局开始
    eachCard(function (card) {
      card.classList.add("grab");
      attachDrag(card);
    });

    // 窗口变化后把卡片拉回可视范围
    var rt = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(rt);
      rt = window.setTimeout(function () {
        if (isNarrow()) return;
        eachCard(clampCard);
      }, 160);
    });

    var resetBtn = document.getElementById("resetLayout");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetLayout();
        D.note("layout", { reset: true });
      });
    }


    D.note("layout", { cards: stage.querySelectorAll(".card").length, restored: 0, narrow: isNarrow() });
  }

  function attachDrag(card) {
    var drag = null;

    card.addEventListener("pointerdown", function (e) {
      if (isNarrow()) return; // 窄屏卡片在文档流里，不拖动
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // 进度条、音量条自己处理拖拽，不抢
      if (e.target.closest && e.target.closest('input[type="range"], .bar')) return;

      var rect = card.getBoundingClientRect();
      var srect = stage.getBoundingClientRect();
      drag = {
        card: card,
        sx: e.clientX,
        sy: e.clientY,
        ox: rect.left - srect.left,
        oy: rect.top - srect.top,
        w: rect.width,
        h: rect.height,
        moved: false,
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });

    function onMove(e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx;
      var dy = e.clientY - drag.sy;

      if (!drag.moved) {
        if (Math.abs(dx) + Math.abs(dy) < 5) return; // 小抖动算点击
        drag.moved = true;
        drag.card.classList.add("dragging");
        document.body.style.userSelect = "none";
        bringToFront(drag.card);
      }
      if (e.cancelable) e.preventDefault();

      var min = 90;
      var l = drag.ox + dx;
      var t = drag.oy + dy;
      var lMax = Math.max(stage.clientWidth - min, min);
      var tMax = Math.max(stage.clientHeight - min, min);
      l = Math.min(Math.max(l, -drag.w + min), lMax);
      t = Math.min(Math.max(t, -drag.h + min), tMax);
      drag.card.style.left = l + "px";
      drag.card.style.top = t + "px";
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (!drag) return;
      var moved = drag.moved;
      drag.card.classList.remove("dragging");
      document.body.style.userSelect = "";
      drag = null;
      if (moved) {
        // 拖完这一次点击不应该再触发卡片里的按钮/链接
        window.addEventListener(
          "click",
          function swallow(ev) {
            ev.stopPropagation();
            ev.preventDefault();
          },
          { capture: true, once: true }
        );
      }
    }
  }

  function focusCard(id) {
    var card = document.getElementById(id);
    if (!card) return;
    if (!isNarrow()) bringToFront(card);
    card.classList.remove("flash");
    void card.offsetWidth; // 重启动画
    card.classList.add("flash");
    window.setTimeout(function () {
      card.classList.remove("flash");
    }, 1250);
    if (isNarrow() && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function initNav() {
    var triggers = document.querySelectorAll("[data-focus]");
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener("click", function (e) {
        var id = this.getAttribute("data-focus");
        if (!document.getElementById(id)) return;
        e.preventDefault();
        focusCard(id);
      });
    }
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
    D.note("nav", { triggers: triggers.length });
  }

  /* ============================================================
     2. 模块一：名字按笔顺书写（写完 → 停顿 → 清空 → 重写，无限循环）
     ============================================================ */
  var SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  function medianLength(points) {
    var len = 0;
    for (var i = 1; i < points.length; i++) {
      var dx = points[i][0] - points[i - 1][0];
      var dy = points[i][1] - points[i - 1][1];
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  /* 一个字 → 一个 SVG：每条笔画 = 遮罩里一条走动的中线 + 完整轮廓填渐变色 */
  function buildChar(ch, data, index) {
    var svg = svgEl("svg", { viewBox: "0 0 1024 1024", role: "img", "aria-label": ch });
    var defs = svgEl("defs");
    var gradId = "nameGrad" + index;

    var grad = svgEl("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "1", y2: "1" });
    var stops = [];
    for (var s = 0; s < 3; s++) {
      var st = svgEl("stop", { offset: String(s / 2), "stop-color": "#7dd3fc" });
      stops.push(st);
      grad.appendChild(st);
    }
    defs.appendChild(grad);

    var g = svgEl("g", { transform: "translate(0,900) scale(1,-1)" });
    var strokes = [];

    for (var i = 0; i < data.strokes.length; i++) {
      var pathStr = data.strokes[i];
      var med = data.medians[i];
      var maskId = "nameMask" + index + "_" + i;

      var poly = svgEl("polyline", {
        points: med
          .map(function (p) {
            return p[0] + "," + p[1];
          })
          .join(" "),
        fill: "none",
        stroke: "#fff",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        // 还没写到的笔画必须完全不可见：连圆头笔尖也不能露出来
        opacity: "0",
      });
      var solid = svgEl("path", { d: pathStr, fill: "#fff", opacity: "0" });
      solid.style.transition = "opacity .14s linear";

      var mask = svgEl("mask", {
        id: maskId,
        maskUnits: "userSpaceOnUse",
        maskContentUnits: "userSpaceOnUse",
        x: "-120",
        y: "-120",
        width: "1264",
        height: "1264",
      });
      mask.appendChild(poly);
      mask.appendChild(solid);
      defs.appendChild(mask);

      var lineLen = medianLength(med);
      // 中线扫过的宽度：笔画越长给得越宽，扫过时像笔尖划开
      poly.setAttribute("stroke-width", String(Math.max(70, Math.min(135, lineLen * 0.22))));
      poly.setAttribute("stroke-dasharray", String(lineLen));
      poly.setAttribute("stroke-dashoffset", String(lineLen));

      var outline = svgEl("path", { d: pathStr, fill: "url(#" + gradId + ")", mask: "url(#" + maskId + ")" });
      g.appendChild(outline);

      strokes.push({
        poly: poly,
        solid: solid,
        len: lineLen,
        // 越长的笔画写得越久，最短 0.13s，最长 0.42s
        dur: Math.max(0.13, Math.min(0.42, lineLen / 1650)),
        done: false,
        shown: false,
        start: 0,
      });
    }

    svg.appendChild(defs);
    svg.appendChild(g);
    return { ch: ch, svg: svg, stops: stops, strokes: strokes };
  }

  function initName() {
    var row = document.getElementById("nameRow");
    if (!row) throw new Error("找不到 #nameRow");
    var data = window.HANZI_DATA;
    var chars = ["徐", "子", "涵"];

    if (!data || !data["徐"]) {
      // 笔顺数据没加载出来：保留 HTML 里的文字版本，页面依然完整
      D.note("name", { mode: "fallback", reason: "缺少 HANZI_DATA" });
      return;
    }

    var fallback = row.querySelector(".name-fallback");
    if (fallback) fallback.style.display = "none";
    var caret = row.querySelector(".caret");

    var units = [];
    var t = 0.25; // 开头留一点启动时间
    for (var c = 0; c < chars.length; c++) {
      var unit = buildChar(chars[c], data[chars[c]], c);
      row.insertBefore(unit.svg, caret || null);
      for (var i = 0; i < unit.strokes.length; i++) {
        var st = unit.strokes[i];
        st.start = t;
        t += st.dur + 0.035; // 笔画之间的呼吸
      }
      units.push(unit);
    }

    var totalStrokes = units.reduce(function (n, u) {
      return n + u.strokes.length;
    }, 0);
    var writeEnd = t;
    var HOLD = 1.6; // 写完停 1.6 秒
    var FADE = 0.45; // 淡出
    var BLANK = 0.3; // 空白
    var cycle = writeEnd + HOLD + FADE + BLANK;

    var state = "writing";
    var loops = 0;
    var drawn = 0;
    var t0 = null;

    function reset() {
      for (var u = 0; u < units.length; u++) {
        for (var i = 0; i < units[u].strokes.length; i++) {
          var st = units[u].strokes[i];
          st.done = false;
          st.shown = false;
          st.poly.setAttribute("opacity", "0");
          st.poly.setAttribute("stroke-dashoffset", String(st.len));
          st.solid.setAttribute("opacity", "0");
        }
      }
      drawn = 0;
      row.style.opacity = "1";
      if (caret) caret.classList.add("on");
    }

    Ticker.add(function (dt, now) {
      if (t0 === null) t0 = now;

      // 颜色渐变：三个色标在蓝→青→紫之间缓慢流动
      for (var u = 0; u < units.length; u++) {
        for (var s = 0; s < units[u].stops.length; s++) {
          var hue = 202 + 46 * Math.sin(now * 0.35 + s * 0.9 + u * 0.6);
          var light = 63 + 7 * Math.sin(now * 0.9 + s * 1.4);
          units[u].stops[s].setAttribute("stop-color", "hsl(" + hue.toFixed(1) + ", 92%, " + light.toFixed(1) + "%)");
        }
      }

      var el = now - t0;

      if (el > cycle) {
        t0 = now;
        loops++;
        state = "writing";
        reset();
        el = 0;
      }

      if (el < writeEnd) {
        state = "writing";
        if (caret) caret.classList.add("on");
        for (var u2 = 0; u2 < units.length; u2++) {
          var strokes = units[u2].strokes;
          for (var i2 = 0; i2 < strokes.length; i2++) {
            var st2 = strokes[i2];
            var p = (el - st2.start) / st2.dur;
            if (p <= 0) {
              // 还没开始：整条中线隐藏，避免圆头笔尖在起点留下一个色点
              if (st2.shown) {
                st2.poly.setAttribute("opacity", "0");
                st2.shown = false;
              }
              st2.poly.setAttribute("stroke-dashoffset", String(st2.len));
            } else if (p >= 1) {
              if (!st2.shown) {
                st2.poly.setAttribute("opacity", "1");
                st2.shown = true;
              }
              st2.poly.setAttribute("stroke-dashoffset", "0");
              if (!st2.done) {
                st2.done = true;
                st2.solid.setAttribute("opacity", "1"); // 补全整条笔画，防止扫过时留有缺口
                drawn++;
              }
            } else {
              if (!st2.shown) {
                st2.poly.setAttribute("opacity", "1");
                st2.shown = true;
              }
              st2.poly.setAttribute("stroke-dashoffset", String(st2.len * (1 - p)));
            }
          }
        }
      } else if (el < writeEnd + HOLD) {
        state = "hold";
        if (caret) caret.classList.remove("on");
      } else if (el < writeEnd + HOLD + FADE) {
        state = "fading";
        var k = (el - writeEnd - HOLD) / FADE;
        row.style.opacity = String(1 - k);
      } else {
        state = "blank";
        row.style.opacity = "0";
      }

      D.note("name", {
        state: state,
        strokes: totalStrokes,
        drawn: drawn,
        loops: loops,
        cycleSeconds: Number(cycle.toFixed(2)),
        mode: "svg",
      });
    });

    reset();
    D.note("name", { chars: chars.join(""), strokes: totalStrokes, mode: "svg" });
  }

  /* ============================================================
     3. 模块二：七段数码管时钟
     ============================================================ */
  var SEG_MAP = {
    0: "abcdef",
    1: "bc",
    2: "abdeg",
    3: "abcdg",
    4: "bcfg",
    5: "acdfg",
    6: "acdefg",
    7: "abc",
    8: "abcdefg",
    9: "abcdfg",
    "-": "g",
    " ": "",
  };
  var WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

  function two(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function initClock() {
    var box = document.getElementById("segClock");
    if (!box) throw new Error("找不到 #segClock");

    // 6 个数字位 + 2 个冒号：HH : MM : SS
    var digits = [];
    var layout = [0, 1, ":", 2, 3, ":", 4, 5];
    for (var i = 0; i < layout.length; i++) {
      if (layout[i] === ":") {
        var colon = document.createElement("div");
        colon.className = "seg-colon";
        colon.appendChild(document.createElement("i"));
        colon.appendChild(document.createElement("i"));
        box.appendChild(colon);
        continue;
      }
      var d = document.createElement("div");
      d.className = "seg-digit";
      var segs = [];
      for (var s = 0; s < 7; s++) {
        var seg = document.createElement("i");
        d.appendChild(seg);
        segs.push(seg);
      }
      box.appendChild(d);
      digits.push(segs);
    }
    var colons = box.querySelectorAll(".seg-colon");
    // 冒号常亮，不做闪动
    for (var ci = 0; ci < colons.length; ci++) colons[ci].classList.remove("off");

    var dateEl = document.getElementById("clockDate");
    var greetEl = document.getElementById("clockGreet");
    var lastText = "";
    var ticks = 0;

    function paint(segs, ch) {
      var on = SEG_MAP[ch] || "";
      for (var s = 0; s < 7; s++) {
        var letter = "abcdefg".charAt(s);
        var isOn = on.indexOf(letter) >= 0;
        if (isOn !== segs[s].classList.contains("on")) {
          segs[s].classList.toggle("on", isOn);
        }
      }
    }

    function greeting(h) {
      if (h < 5) return "夜深了，早点休息";
      if (h < 11) return "上午好，今天也要好好写代码";
      if (h < 14) return "中午好，记得吃饭";
      if (h < 18) return "下午好";
      if (h < 23) return "晚上好";
      return "夜深了，早点休息";
    }

    Ticker.add(function (dt, now) {
      var d = new Date();
      var text = two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds());

      if (text !== lastText) {
        lastText = text;
        ticks++;
      }

      var flat = text.replace(/:/g, "");
      for (var i = 0; i < digits.length; i++) {
        paint(digits[i], flat.charAt(i));
      }

      if (dateEl) {
        var ds = d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + WEEK[d.getDay()];
        if (dateEl.textContent !== ds) dateEl.textContent = ds;
      }
      if (greetEl && !greetEl.dataset.set) {
        greetEl.textContent = greeting(d.getHours());
        greetEl.dataset.set = "1";
      }

      D.note("clock", { text: text, ticks: ticks, date: d.toDateString() });
    });
  }

  /* ============================================================
     4. 联系卡片：终端逐字打印
     ============================================================ */
  function initTerminal() {
    var body = document.getElementById("termBody");
    if (!body) throw new Error("找不到 #termBody");

    var lines = [
      [{ t: "$ whoami", c: "cmd" }],
      [
        { t: "徐子涵", c: "key" },
        { t: " · 智能医学工程 · 大一", c: "out" },
      ],
      [{ t: "$ contact", c: "cmd" }],
      [
        { t: "xzh_080115@tju.edu.cn", c: "key" },
        { t: " / ", c: "out" },
        { t: "QQ 2941923433", c: "key" },
      ],
    ];

    var cursor = document.createElement("span");
    cursor.className = "cursor";
    var li = 0;
    var ci = 0;
    var lineEls = [];
    var acc = 0;
    var done = false;

    function render() {
      body.textContent = "";
      for (var i = 0; i < lineEls.length; i++) {
        var ln = document.createElement("div");
        for (var s = 0; s < lineEls[i].length; s++) {
          var parts = lineEls[i][s];
          var sp = document.createElement("span");
          sp.className = parts.c;
          sp.textContent = parts.full.slice(0, parts.shown);
          ln.appendChild(sp);
        }
        body.appendChild(ln);
      }
      if (!done) body.appendChild(cursor);
    }

    Ticker.add(function (dt) {
      if (done) return;
      acc += dt;
      // 每 28ms 敲一个字，每帧最多补 4 个，看起来像人在打字
      var budget = Math.floor(acc / 0.028);
      if (budget > 4) budget = 4;
      acc -= budget * 0.028;
      while (budget-- > 0 && li < lines.length) {
        var parts = lines[li];
        if (!lineEls[li]) {
          lineEls[li] = parts.map(function (p) {
            return { full: p.t, c: p.c, shown: 0 };
          });
        }
        if (ci >= parts.length) {
          li++;
          ci = 0;
          continue;
        }
        var cur = lineEls[li][ci];
        cur.shown++;
        if (cur.shown >= cur.full.length) {
          ci++;
        }
      }
      if (li >= lines.length) {
        done = true;
        D.note("terminal", { lines: lines.length, done: true });
      }
      render();
    });

    D.note("terminal", { lines: lines.length, done: false });
  }

  window.Modules = {
    Ticker: Ticker,
    initLayout: initLayout,
    initName: initName,
    initClock: initClock,
    initTerminal: initTerminal,
    initNav: initNav,
    focusCard: focusCard,
  };
})();
