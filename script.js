/* script.js —— 页面入口
 *
 * 只做三件事：
 *   1. 按顺序启动各个模块；
 *   2. 用 safe() 把每个模块包起来，任何一块出错都不连累其它模块（页面不会整体白屏）；
 *   3. 在控制台留一份运行摘要，并把状态挂在 window.__DIAG 上供检查。
 *
 * 启动顺序有讲究：先摆好卡片位置（layout），后面的模块才拿得到正确的尺寸。
 */
(function () {
  "use strict";

  var D =
    window.__DIAG ||
    { note: function () {}, err: function () {}, errors: [], modules: {} };

  var started = [];
  var failed = [];

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  /* 包裹一个模块的初始化：出错只记录，不往外抛 */
  function safe(name, fn) {
    try {
      if (typeof fn !== "function") {
        throw new Error("初始化函数不存在（对应的 js 可能没加载）");
      }
      var t0 = now();
      fn();
      var ms = Math.round((now() - t0) * 10) / 10;
      started.push(name);
      D.note(name, { ok: true, ms: ms });
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      failed.push(name);
      D.err(name, e);
      D.note(name, { ok: false, error: msg });
    }
  }

  function boot() {
    var M = window.Modules || {};
    var S = window.SunMoon || {};
    var R = window.Router || {};
    var P = window.Pages || {};
    var T = window.Tools || {};
    var Mo = window.Mood || {};
    var C = window.CursorFX || {};

    /* ⓪ 路由：先按 hash 决定显示首页卡片还是某个独立页面（必须先跑，后面才拿得到正确尺寸） */
    safe("router", R.init);
    /* ① 卡片自由拖拽 + 位置记忆（最先，保证卡片已就位） */
    safe("layout", M.initLayout);
    /* ② 自我介绍：名字按笔顺书写 → 停顿 → 清空重写，颜色渐变 */
    safe("name", M.initName);
    /* ③ 当前时间：七段数码管 */
    safe("clock", M.initClock);
    /* ④ 联系卡片：终端逐字打印 */
    safe("terminal", M.initTerminal);
    /* ⑤ 导航：点一下把卡片置顶并高亮 */
    safe("nav", M.initNav);
    /* ⑥ 太阳 / 月亮：自转、日珥、环形山，点击切换 */
    safe("celestial", S.init);
    /* ⑦ 留言板（存本机浏览器） */
    safe("pages", P.init);
    /* ⑧ 项目页小工具：展开面板 + BMI / 温度 / 进制 / 斐波那契计算 */
    safe("tools", T.init);
    /* ⑨ 天色情绪：日 / 月相衬的底色 +「联想一下」的画作模式 */
    safe("mood", Mo.init);
    /* ⑩ 光标：换一套光标图案（在 CSS 里）+ 划过背景时的涟漪（触屏 / 减少动态效果下自动关） */
    safe("cursorFx", C.init);

    /* 页脚年份 */
    var y = document.getElementById("year");
    if (y) y.textContent = String(new Date().getFullYear());

    /* Three.js 是否就位（没有就走 CSS 降级星球） */
    if (window.THREE) {
      D.note("three", {
        ok: true,
        revision: parseInt(window.THREE.REVISION, 10) || 0,
      });
    } else {
      D.note("three", { ok: false, error: "three.min.js 未加载，太阳/月亮走 CSS 降级" });
    }

    D.ready = true;
    D.note("boot", { started: started.join(","), failed: failed.join(","), ready: true });

    if (window.console) {
      if (failed.length) {
        console.warn(
          "[homepage] " + started.length + " 个模块启动成功，失败 " +
            failed.length + " 个：" + failed.join("、") + "（详见 __DIAG.errors）"
        );
      } else {
        console.log(
          "[homepage] 全部 " + started.length + " 个模块启动完成。控制台输入 __DIAG 可查看运行状态。"
        );
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
