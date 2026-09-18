/* js/cursor.js —— 光标划过背景时的涟漪
 *
 * 就做一件事：鼠标在页面上移动时，按光标位置在「背景」上起一圈很淡的波纹，
 * 外加一团跟着光标走的柔光，让指针有个落点感（光标图案本身在 style.css 里换）。
 *
 * 几条自我约束：
 *   - 只认鼠标：手指（触屏）和系统开了「减少动态效果」的，整层直接收起来；
 *   - 「联想一下」满屏看画时整层收起，光标也回系统箭头，不打扰画作；
 *   - 波纹节点预先建好、循环复用，不在移动过程中反复造 DOM；
 *   - 位置更新走 requestAnimationFrame，每帧最多动一次；
 *   - 波纹节奏靠时间戳卡住，不额外起定时器；
 *   - 拿不到 Web Animations 就用静态定位兜底，绝不报错。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {} };

  var POOL = 6; // 预建几个波纹节点（足够覆盖一圈波纹的生命周期即可复用）
  var GAP = 85; // 相邻两圈波纹至少隔多少毫秒
  var LIFE = 620; // 一圈波纹淡出用多久（跟 CSS 里的节奏对齐）

  function mq(query) {
    return !!(window.matchMedia && window.matchMedia(query).matches);
  }

  function init() {
    var layer = document.getElementById("cursorFx");
    if (!layer) {
      D.note("cursorFx", { ok: false, error: "页面上没有 #cursorFx" });
      return;
    }
    /* 触屏和「减少动态效果」下这层装饰没有意义，收起（也省掉常驻开销） */
    if (mq("(prefers-reduced-motion: reduce)")) {
      layer.hidden = true;
      D.note("cursorFx", { ok: true, skipped: "系统开了「减少动态效果」" });
      return;
    }
    if (!mq("(hover: hover) and (pointer: fine)")) {
      layer.hidden = true;
      D.note("cursorFx", { ok: true, skipped: "不是精细指针（触屏设备）" });
      return;
    }

    var rings = [];
    for (var i = 0; i < POOL; i++) {
      var ring = document.createElement("span");
      ring.className = "ring";
      layer.appendChild(ring);
      rings.push(ring);
    }
    var halo = document.createElement("span");
    halo.className = "halo";
    layer.appendChild(halo);

    var x = 0; // 光标当前坐标（视口坐标，跟 position:fixed 的层对得上）
    var y = 0;
    var next = 0; // 下一圈波纹最早什么时候能起
    var slot = 0; // 复用池轮流用
    var raf = 0;
    var lit = 0; // 柔光当前是不是亮的，避免每次移动都写一次 style

    function time() {
      return window.performance && performance.now ? performance.now() : Date.now();
    }

    /* 起一圈波纹：先挪到 (x, y)，再让它从中心扩散淡出 */
    function ripple(strong) {
      var el = rings[slot];
      slot = (slot + 1) % rings.length;
      var at = "translate3d(" + x + "px," + y + "px,0)";
      el.style.transform = at;
      if (!el.animate) return; // 没有 Web Animations 的浏览器：位置摆对就行，不报错
      var grow = strong ? 2.1 : 1.5;
      el.animate(
        [
          { transform: at + " scale(0.3)", opacity: 0 },
          { opacity: strong ? 0.95 : 0.8, offset: 0.15 },
          { transform: at + " scale(" + grow + ")", opacity: 0 },
        ],
        { duration: strong ? 700 : LIFE, easing: "ease-out" }
      );
    }

    function show() {
      if (!lit) {
        lit = 1;
        halo.style.opacity = "1";
      }
    }

    function hide() {
      if (lit) {
        lit = 0;
        halo.style.opacity = "0";
      }
      next = 0;
    }

    /* 「联想一下」满屏看画时，波纹和光标图案都不出现（CSS 那层也一并收起来了），
       这里顺手停掉每帧的活儿，别让看不见的动画白烧 CPU */
    function inMuse() {
      return document.body.classList.contains("muse");
    }

    /* 每帧最多动一次：把柔光挪到光标处，顺带按节奏补一圈波纹 */
    function frame() {
      raf = 0;
      halo.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      var t = time();
      if (t < next) return;
      next = t + GAP;
      ripple(false);
    }

    function onMove(e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (inMuse()) {
        hide();
        return;
      }
      x = e.clientX;
      y = e.clientY;
      show();
      if (!raf) raf = window.requestAnimationFrame(frame);
    }

    /* 点一下：起一圈更大更亮的波纹，当作「点到了」的反馈 */
    function onDown(e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (inMuse()) return;
      x = e.clientX;
      y = e.clientY;
      ripple(true);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("blur", hide);
    document.addEventListener("mouseleave", hide);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) hide();
    });

    D.note("cursorFx", { ok: true, rings: POOL, gap: GAP });
  }

  window.CursorFX = { init: init };
})();
