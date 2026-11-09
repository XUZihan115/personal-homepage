/* js/pet.js —— 桌面版桌宠
 *
 * 一只 Q 版小人住在页面上：
 *   - 可拖动（pointer 事件）
 *   - 说话气泡（点一下或空闲时偶尔冒一句）
 *   - 位置记在 localStorage，刷新、切路由都不变
 *   - 路由挂钩：切到「数字分身」(#/avatar) 时，跑到分身页的固定锚点站好，
 *     头顶气泡说「等等我~」；离开数字分身页就自由待机。
 *
 * 不做移动/拖动特效（走路帧、跑步帧、拖拽换图已全部去掉）：
 * 侧身走路图和拖拽图是带不透明灰白背景的 AI 素材，一换图就露出灰白方框，
 * 所以统一只用透明背景的正面待机图，只有位置在变。
 *
 * 锚点坐标来自设计截图（绿框，2549x1403 视口里 x=464..776, y=257..583，
 * 中心约在 24.3% 宽 / 30% 高 的位置），用视口比例换算成像素，窗口多大都站对地方。
 * 素材：assets/pet-128.png（128x192，Q 版小人）。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {} };

  var STORE_KEY = "xh_pet_pos"; // {x,y} 相对视口的像素坐标（桌宠中心）
  var ANCHOR_RATIO = { x: 0.243, y: 0.3 }; // 数字分身页的固定锚点（视口比例）

  // 素材：只用透明背景的正面待机图（侧身走路/拖拽素材背景不透明，已弃用）
  var SRC_IDLE = "assets/pet-128.png";

  var pet = null; // 外层容器（fixed 定位）
  var face = null; // 朝向层（左右翻转挂这，翻转时不带动气泡）
  var body = null; // 形象本体（始终用待机图）
  var bubble = null; // 说话气泡
  var W = 84; // 桌宠显示宽度
  var H = 126; // 桌宠显示高度（128x192 等比缩到 84x126）

  var pos = { x: 0, y: 0 }; // 当前中心坐标
  var mode = "idle"; // idle | dragging | running
  var bubbleTimer = null;
  var idleTimer = null;
  var rafId = null;
  var dir = 1; // 当前朝向：1 朝右，-1 朝左
  var running = false; // 正在跑向锚点
  var anchored = false; // 已站在数字分身锚点
  var vw = 0;
  var vh = 0;

  /* ---------- 基础工具 ---------- */

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function measure() {
    vw = document.documentElement.clientWidth || window.innerWidth;
    vh = document.documentElement.clientHeight || window.innerHeight;
  }

  /* pos.x / pos.y 一律是桌宠中心的坐标；写进 CSS 时换成左上角 */
  function applyPos() {
    pet.style.left = pos.x - W / 2 + "px";
    pet.style.top = pos.y - H / 2 + "px";
  }

  function savePos() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) })
      );
    } catch (e) {
      /* 隐私模式等写不了就跳过 */
    }
  }

  function setFace(d) {
    dir = d;
    face.classList.toggle("pet-f-left", d < 0);
  }

  /* ---------- 说话气泡 ---------- */

  function speak(text, ms) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove("show");
    }, ms || 2600);
  }

  function randomLine() {
    var lines = [
      "要不要去数字分身那聊聊？",
      "我在这呢～",
      "点我一下试试？",
      "鼠标拖着我能搬家。",
      "太阳月亮都能切，试试呗。",
      "想知道啥就问数字分身。",
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /* 空闲时偶尔冒一句（不做随机走动） */
  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (running || mode === "dragging") return;
      if (Math.random() < 0.3) speak(randomLine());
      scheduleIdle();
    }, 3000 + Math.random() * 2500);
  }

  /* ---------- 拖动 ---------- */

  var moved = false; // 本次指针按下后有没有真正移动过

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (running) return; // 小跑中不打断
    e.preventDefault();
    measure();
    mode = "dragging";
    moved = false;
    clearTimeout(idleTimer);
    cancelAnimationFrame(rafId);
    if (pet.setPointerCapture) {
      try {
        pet.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 忽略 */
      }
    }

    var dx = e.clientX - pos.x;
    var dy = e.clientY - pos.y;

    function move(ev) {
      var nx = clamp(ev.clientX - dx, W / 2, vw - W / 2);
      var ny = clamp(ev.clientY - dy, H / 2, vh - H / 2);
      if (Math.abs(nx - pos.x) + Math.abs(ny - pos.y) > 4) {
        moved = true;
      }
      if (nx < pos.x) setFace(-1);
      else if (nx > pos.x) setFace(1);
      pos.x = nx;
      pos.y = ny;
      applyPos();
    }

    function up() {
      mode = "idle";
      savePos();
      pet.removeEventListener("pointermove", move);
      pet.removeEventListener("pointerup", up);
      pet.removeEventListener("pointercancel", up);
      scheduleIdle();
    }

    pet.addEventListener("pointermove", move);
    pet.addEventListener("pointerup", up);
    pet.addEventListener("pointercancel", up);
  }

  function onClick() {
    if (running || mode === "dragging") return;
    speak(randomLine());
  }

  /* ---------- 小跑：切到数字分身页 ---------- */

  /* 切到数字分身页时，桌宠平滑跑到固定锚点站好；
     只平移（正面图），不做跑步帧动画。 */
  function runToAnchor() {
    if (!pet) return;
    measure();
    running = true;
    anchored = false;
    clearTimeout(idleTimer);
    cancelAnimationFrame(rafId);

    // 目标：锚点中心（视口比例换算）—— pos 存的是中心坐标，直接对准
    var cx = ANCHOR_RATIO.x * vw;
    var cy = ANCHOR_RATIO.y * vh;
    var tx = clamp(cx, W / 2, vw - W / 2);
    var ty = clamp(cy, H / 2, vh - H / 2);
    var from = { x: pos.x, y: pos.y };
    var dist = Math.sqrt(Math.pow(tx - from.x, 2) + Math.pow(ty - from.y, 2));
    var dur = clamp(dist * 0.9, 650, 1600);
    var t0 = performance.now();

    // 开局朝目标方向走
    setFace(tx >= from.x ? 1 : -1);
    // 边跑边在头顶冒一句「等等我~」（不写进聊天对话框）
    speak("等等我~", 2400);

    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      pos.x = from.x + (tx - from.x) * e;
      pos.y = from.y + (ty - from.y) * e;
      applyPos();
      if (k < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        pos.x = tx;
        pos.y = ty;
        applyPos();
        running = false;
        anchored = true;
        savePos();
        speak("到啦！在这陪你聊天～", 3200);
      }
    }
    rafId = requestAnimationFrame(step);
  }

  function onRoute(name) {
    if (name === "avatar") {
      runToAnchor();
    } else if (running || anchored) {
      // 离开数字分身页：恢复自由待机
      running = false;
      anchored = false;
      cancelAnimationFrame(rafId);
      scheduleIdle();
    }
  }

  /* ---------- 初始化 ---------- */

  function init() {
    pet = document.getElementById("pet");
    if (!pet) {
      D.note("pet", { ok: false, error: "找不到 #pet 容器" });
      return;
    }
    face = pet.querySelector(".pet-face");
    body = pet.querySelector(".pet-body");
    bubble = pet.querySelector(".pet-bubble");
    if (!face || !body || !bubble) {
      D.note("pet", { ok: false, error: "桌宠内部结构缺失" });
      return;
    }

    measure();

    // 读上次位置；没有就默认放在右下角
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (typeof p.x === "number" && typeof p.y === "number") {
          pos.x = clamp(p.x, W / 2, vw - W / 2);
          pos.y = clamp(p.y, H / 2, vh - H / 2);
        }
      }
    } catch (e) {
      /* 读不到就落默认 */
    }
    if (!pos.x && !pos.y) {
      pos.x = vw - W / 2 - 26; // 中心离右缘留 26px
      pos.y = vh - H / 2 - 40; // 中心离下缘留 40px
    }

    applyPos();
    setFace(1);
    body.src = SRC_IDLE;

    pet.addEventListener("pointerdown", onPointerDown);
    pet.addEventListener("click", onClick);
    window.addEventListener("resize", function () {
      measure();
      pos.x = clamp(pos.x, W / 2, vw - W / 2);
      pos.y = clamp(pos.y, H / 2, vh - H / 2);
      applyPos();
    });

    // 路由挂钩：切到数字分身小跑过去
    if (window.Router && typeof window.Router.onChange === "function") {
      window.Router.onChange(onRoute);
      // 直接以 #/avatar 打开时也要跑过去
      if (window.Router.current && window.Router.current() === "avatar") {
        runToAnchor();
      }
    } else {
      D.note("pet", { ok: false, error: "没有 Router，桌宠无法挂钩路由" });
    }

    // 开场打声招呼
    speak("嗨，我在这~", 2400);
    if (!anchored && !running) scheduleIdle();

    D.note("pet", { ok: true, pos: [Math.round(pos.x), Math.round(pos.y)] });
  }

  window.Pet = {
    init: init,
    /* 对外暴露说话气泡：数字分身等模块可在事件发生时让桌宠冒一句 */
    speak: speak,
  };
})();
