/* router.js —— 极简 hash 路由
 *
 * 一个页面文件里同时装着「首页卡片」和四个独立页面（desktop.html / mobile.html 用的是同一套结构）：
 *   #/ 或空 hash        → 首页（.stage 卡片 + 底部提示）
 *   #/detail #/guestbook #/projects #/contact
 *                       → 对应的 .page
 *
 * 切换只改 hidden 和 class，不刷新页面；浏览器的前进 / 后退键也能用。
 * 每个页面还能直接分享链接（比如 .../desktop.html#/projects）。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {}, errors: [] };

  var ROUTES = ["detail", "guestbook", "projects", "contact"];
  var TITLES = {
    home: "徐子涵 · 个人主页",
    detail: "详情 · 徐子涵",
    guestbook: "留言 · 徐子涵",
    projects: "项目 · 徐子涵",
    contact: "联系 · 徐子涵",
  };

  var stage = null;
  var hintbar = null;
  var resetBtn = null;
  var pages = [];
  var links = [];
  var listeners = [];
  var current = null;

  function readHash() {
    var raw = "";
    try {
      raw = String((window.location && window.location.hash) || "");
    } catch (e) {
      raw = "";
    }
    var h = raw.replace(/^#\/?/, "").replace(/\/+$/, "");
    return ROUTES.indexOf(h) >= 0 ? h : "home";
  }

  function apply() {
    var name = readHash();
    var changed = name !== current;
    current = name;

    var home = name === "home";
    if (stage) stage.hidden = !home;
    if (hintbar) hintbar.hidden = !home;
    if (resetBtn) resetBtn.hidden = !home;

    var i;
    for (i = 0; i < pages.length; i++) {
      pages[i].hidden = pages[i].getAttribute("data-page") !== name;
    }

    for (i = 0; i < links.length; i++) {
      var on = links[i].getAttribute("data-route") === name;
      links[i].classList.toggle("is-active", on);
      if (on) links[i].setAttribute("aria-current", "page");
      else links[i].removeAttribute("aria-current");
    }

    if (document.body) document.body.classList.toggle("route-page", !home);
    document.title = TITLES[name] || TITLES.home;

    if (changed) {
      if (typeof window.scrollTo === "function") window.scrollTo(0, 0);

      // 从独立页面切回首页时，窗口尺寸没变、resize 不会自己触发，
      // 这里手动喊一声，好让卡片按可视范围重新收一遍
      if (home) {
        window.setTimeout(function () {
          if (typeof window.dispatchEvent === "function" && typeof window.Event === "function") {
            window.dispatchEvent(new window.Event("resize"));
          }
        }, 0);
      }

      for (i = 0; i < listeners.length; i++) listeners[i](name);
      D.note("router", { route: name });
    }
  }

  function go(name) {
    if (!window.location) return;
    window.location.hash = name === "home" ? "#/" : "#/" + name;
  }

  window.Router = {
    init: function () {
      stage = document.getElementById("stage");
      hintbar = document.querySelector(".hintbar");
      resetBtn = document.getElementById("resetLayout");
      pages = [].slice.call(document.querySelectorAll("[data-page]"));
      links = [].slice.call(document.querySelectorAll(".nav-links a[data-route]"));

      if (!pages.length) throw new Error("一个 [data-page] 页面都没找到");

      window.addEventListener("hashchange", apply);
      apply();
    },
    go: go,
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    },
    current: function () {
      return current;
    },
    routes: ROUTES,
  };
})();
