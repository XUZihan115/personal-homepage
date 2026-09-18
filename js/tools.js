/* tools.js —— 项目页里那几个小工具
 *
 * 原来都是 Python 写的，这里用 JS 重写一遍，好在网页上直接试。算法跟 Python 版本一致：
 *   BMI      = 体重 / 身高²，保留一位小数；身高 0.54~2.72 m、体重 0~635 kg 之外判为不合常理
 *   华氏      = 摄氏 × 9 / 5 + 32，保留一位小数
 *   进制      = 逐位取余（跟 Python 版 to_base 的写法一样），2~10 进制之间互转
 *   斐波那契   = 循环递推，第 1、2 项都是 1；用 BigInt，项数大也算得准
 *
 * 页面上靠两个属性挂钩子：按钮 data-open="面板id" 展开收起，按钮 data-run="名字" 触发计算。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {}, errors: [] };

  function $(id) {
    return document.getElementById(id);
  }

  function val(id) {
    var el = $(id);
    return el ? String(el.value).trim() : "";
  }

  /* 只写自己算出来的东西，全程 textContent，不碰 innerHTML */
  function out(el, bold, rest, bad) {
    if (!el) return;
    el.classList.toggle("is-bad", !!bad);
    while (el.firstChild) el.removeChild(el.firstChild);
    if (bold) {
      var b = document.createElement("b");
      b.textContent = bold;
      el.appendChild(b);
    }
    if (rest) el.appendChild(document.createTextNode(rest));
  }

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function runBmi() {
    var el = $("bmiOut");
    var h = parseFloat(val("bmiH"));
    var w = parseFloat(val("bmiW"));
    if (!isFinite(h)) return out(el, "", "请输入身高（米），比如 1.75。", true);
    if (!isFinite(w)) return out(el, "", "请输入体重（公斤），比如 65。", true);
    if (h < 0.54 || h > 2.72) {
      return out(el, "", "身高要在 0.54 ~ 2.72 米之间，超出这个范围大概是把单位写错了。", true);
    }
    if (w < 0 || w > 635) {
      return out(el, "", "体重要在 0 ~ 635 公斤之间，超出这个范围大概是把单位写错了。", true);
    }
    var bmi = round1(w / (h * h));
    var tag = bmi < 18.5 ? "偏瘦" : bmi < 24 ? "正常" : bmi < 28 ? "偏胖" : "肥胖";
    out(el, "BMI " + bmi.toFixed(1), " · " + tag + "（中国成人标准）");
  }

  function runTemp() {
    var el = $("tempOut");
    var c = parseFloat(val("tempC"));
    if (!isFinite(c)) return out(el, "", "请输入摄氏温度，填数字就行，比如 25。", true);
    var f = round1((c * 9) / 5 + 32);
    out(el, c + " ℃", " = " + f.toFixed(1) + " ℉");
  }

  function runBase() {
    var el = $("baseOut");
    var a = parseInt(val("baseFrom"), 10);
    var b = parseInt(val("baseTo"), 10);
    var raw = val("baseNum");
    if (!(a >= 2 && a <= 10)) return out(el, "", "输入进制要填 2 ~ 10 之间的整数。", true);
    if (!(b >= 2 && b <= 10)) return out(el, "", "输出进制要填 2 ~ 10 之间的整数。", true);
    if (!raw) return out(el, "", "请输入要转换的数字。", true);

    var digits = "0123456789";
    var n = 0;
    for (var i = 0; i < raw.length; i++) {
      var d = digits.indexOf(raw.charAt(i));
      if (d < 0 || d >= a) {
        return out(el, "", "「" + raw + "」不是合法的 " + a + " 进制数字。", true);
      }
      n = n * a + d;
    }
    if (n > Number.MAX_SAFE_INTEGER) {
      return out(el, "", "这个数字太大了，已经超出能精确计算的范围。", true);
    }

    var r = "";
    var v = n;
    if (v === 0) r = "0";
    while (v > 0) {
      r = digits.charAt(v % b) + r;
      v = Math.floor(v / b);
    }
    out(el, raw + "（" + a + " 进制）", " = " + r + "（" + b + " 进制）");
  }

  function runFib() {
    var el = $("fibOut");
    var n = parseInt(val("fibN"), 10);
    if (!(n >= 1)) return out(el, "", "请输入一个正整数，比如 30。", true);
    if (n > 500) return out(el, "", "最多算到第 500 项，再往后数字会长得摆不下。", true);

    var prev = 1n;
    var curr = 1n;
    for (var i = 3; i <= n; i++) {
      var t = prev + curr;
      prev = curr;
      curr = t;
    }

    var s = curr.toString();
    var shown = s.length > 60 ? s.slice(0, 28) + " … " + s.slice(-28) : s;
    out(el, "第 " + n + " 项", " = " + shown + (s.length > 60 ? "（一共 " + s.length + " 位）" : ""));
  }

  var RUNNERS = { bmi: runBmi, temp: runTemp, base: runBase, fib: runFib };

  window.Tools = {
    init: function () {
      var opens = document.querySelectorAll("[data-open]");
      for (var i = 0; i < opens.length; i++) {
        (function (btn) {
          btn.addEventListener("click", function () {
            var panel = document.getElementById(btn.getAttribute("data-open"));
            if (!panel) return;
            var show = panel.hidden;
            panel.hidden = !show;
            btn.setAttribute("aria-expanded", show ? "true" : "false");
            if (show) {
              var first = panel.querySelector("input");
              if (first) first.focus();
            }
          });
        })(opens[i]);
      }

      var runs = document.querySelectorAll("[data-run]");
      for (var j = 0; j < runs.length; j++) {
        (function (btn) {
          var fn = RUNNERS[btn.getAttribute("data-run")];
          if (!fn) return;
          btn.addEventListener("click", fn);
        })(runs[j]);
      }

      /* 在工具面板里按回车等同于点那个按钮 */
      var panels = document.querySelectorAll(".proj-tool");
      for (var k = 0; k < panels.length; k++) {
        (function (panel) {
          var runBtn = panel.querySelector("[data-run]");
          if (!runBtn) return;
          panel.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              e.preventDefault();
              runBtn.click();
            }
          });
        })(panels[k]);
      }

      D.note("tools", { panels: panels.length, opens: opens.length });
    },
    /* 计算函数单独放出来，测试可以直接调；页面只用 init */
    run: RUNNERS,
  };
})();
