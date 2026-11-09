/* js/skills.js —— 「技能与工具」词条点击简介
 *
 * 首页那张「技能与工具」卡片里每个胶囊都是一个词条。点一下弹出一张小卡片：
 * 先用一两句话说清它是什么，末尾给一条维基百科链接，想深挖就点进去。
 *
 * 几个约定：
 *   - 文案、链接都放在下面的 DATA 里，想加词条只改这里；HTML 只留 <span class="tag">名字</span>。
 *   - 弹层全部用 createElement / textContent 拼，不碰 innerHTML。
 *   - 再点同一个词、点空白处、按 Esc、滚动或改窗口大小，都会把弹层收起来。
 *   - 桌面端贴着词条下方弹出（放不下就翻到上方）；窄屏改成底部卡片，避免超出屏幕。
 *   - 依赖 diag.js（没有也能跑，D 有兜底）。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {}, errors: [] };

  var WIKI = "https://zh.wikipedia.org/wiki/";

  /* ---------- 词条数据 ---------- */

  var DATA = {
    HTML: {
      desc: "网页的骨架。用一对对标签描述标题、段落、图片和链接，浏览器照着标签把内容排出来。",
      wiki: "HTML",
    },
    CSS: {
      desc: "层叠样式表，管网页长什么样：颜色、字号、间距、布局和动画都在这里写。",
      wiki: "层叠样式表",
    },
    JavaScript: {
      desc: "网页的脚本语言。拖动卡片、切换页面、和大模型对话，背后跑的都是它。",
      wiki: "JavaScript",
    },
    "Git 版本控制": {
      desc: "分布式版本控制系统。每改一次就留一个快照，写坏了能退回上一版，也能开分支试新想法。",
      wiki: "Git",
    },
    "AI 辅助开发": {
      desc: "把大语言模型当成结对程序员：让它写初稿、查报错、改需求，自己负责判断和验收。",
      wiki: "大语言模型",
    },
    "Prompt 迭代": {
      desc: "反复调整给模型的提示词——补背景、给例子、限定格式——直到输出稳定地接近想要的结果。",
      wiki: "提示工程",
    },
    "数据分析基础": {
      desc: "清洗、统计、画图，从一堆数字里找出规律和异常，再反过来检查假设站不站得住。",
      wiki: "数据分析",
    },
    "智能医学工程": {
      desc: "医学、工程与人工智能交叉的专业方向，用技术手段解决诊断、治疗和健康管理里的问题。",
      wiki: "生物医学工程",
    },
    "原型验证": {
      desc: "先做一个能跑的最小版本，快速验证想法行不行，再根据反馈一版一版往上加。",
      wiki: "软件原型",
    },
  };

  /* ---------- 弹层 ---------- */

  var pop = null;
  var popTitle = null;
  var popDesc = null;
  var popLink = null;
  var activeTag = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function build() {
    pop = el("div", "skill-pop");
    pop.hidden = true;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "词条简介");

    var head = el("div", "skill-pop-head");
    popTitle = el("strong", "skill-pop-title");
    var close = el("button", "skill-pop-x", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭简介");
    close.addEventListener("click", hide);
    head.appendChild(popTitle);
    head.appendChild(close);

    popDesc = el("p", "skill-pop-desc");

    popLink = el("a", "skill-pop-link", "去维基百科看看 ↗");
    popLink.target = "_blank";
    popLink.rel = "noopener noreferrer";

    pop.appendChild(head);
    pop.appendChild(popDesc);
    pop.appendChild(popLink);
    document.body.appendChild(pop);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    });

    /* 点弹层和当前词条以外的地方就收起（捕获阶段，别被卡片的拖拽逻辑拦住） */
    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!pop || pop.hidden) return;
        if (pop.contains(e.target)) return;
        if (activeTag && activeTag.contains(e.target)) return;
        hide();
      },
      true
    );

    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
  }

  /* 贴在词条下方；下面放不下就翻到上方；窄屏直接铺底部 */
  function place(tag) {
    pop.hidden = false;

    if (document.documentElement.clientWidth < 640) {
      pop.classList.add("is-sheet");
      pop.style.left = "";
      pop.style.top = "";
      return;
    }

    pop.classList.remove("is-sheet");
    /* 先摆到左上角量一下尺寸，再算最终位置（避免读到上一次的宽度） */
    pop.style.left = "0px";
    pop.style.top = "0px";

    var r = tag.getBoundingClientRect();
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;

    var left = r.left + r.width / 2 - pw / 2;
    left = Math.max(12, Math.min(left, vw - pw - 12));

    var top = r.bottom + 10;
    if (top + ph > vh - 12) top = Math.max(12, r.top - ph - 10);

    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
  }

  function show(tag) {
    var key = (tag.textContent || "").trim();
    var item = DATA[key];
    if (!item) return;

    activeTag = tag;
    popTitle.textContent = key;
    popDesc.textContent = item.desc;
    popLink.href = encodeURI(WIKI + item.wiki);

    tag.classList.add("is-open");
    tag.setAttribute("aria-expanded", "true");
    place(tag);

    D.note("skills", { open: key });
  }

  function hide() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    pop.classList.remove("is-sheet");
    if (activeTag) {
      activeTag.classList.remove("is-open");
      activeTag.setAttribute("aria-expanded", "false");
      activeTag = null;
    }
  }

  /* ---------- 启动 ---------- */

  window.Skills = {
    init: function () {
      var cloud = document.querySelector("#skills .tag-cloud");
      if (!cloud) return;

      var tags = cloud.querySelectorAll(".tag");
      if (!tags.length) return;

      build();

      for (var i = 0; i < tags.length; i++) {
        (function (tag) {
          var key = (tag.textContent || "").trim();
          if (!DATA[key]) return;

          tag.classList.add("tag-clickable");
          tag.setAttribute("role", "button");
          tag.setAttribute("tabindex", "0");
          tag.setAttribute("aria-haspopup", "dialog");
          tag.setAttribute("aria-expanded", "false");
          tag.setAttribute("title", "点一下看看它是什么");

          tag.addEventListener("click", function () {
            if (activeTag === tag) {
              hide();
              return;
            }
            hide();
            show(tag);
          });

          tag.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              tag.click();
            }
          });
        })(tags[i]);
      }

      D.note("skills", { tags: tags.length });
    },
    hide: hide,
  };
})();
