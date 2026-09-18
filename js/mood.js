/*!
 * mood.js —— 主页上三件「跟着天色走」的小事
 *
 * ① 音乐询问：进页面默认一声都不出。右上角问一句「想不想来点音乐？」，
 *             点「来一首」→ 从歌库里随机放一首；点「不用了」→ 什么都不发生。
 * ② 背景色调：太阳 / 月亮一换，页面底色和光晕跟着换（body.bg-sun / body.bg-moon）。
 * ③ 联想一下：按钮在「归位」下面。点了就把主页收起来，换上一幅天上的东西相衬的画，
 *             并在右下角标出作品名和作者。
 *             太阳 / 月亮各有一组画作（太阳 11 幅、月亮 6 幅，都是公有领域或 NASA 素材，且只收横版），
 *             每次按「联想一下」都从当前天色那一组里随机取一幅，不会连着两次给同一幅；
 *             看画的时候点一下画面就是看下一张，同一组里按顺序往下走，走到头绕回第一张；
 *             在画面上双击就直接退出来，不用去够左上角那两个按钮。
 *             再点「联想一下」（或「归位」/ Esc）也恢复原样。
 *
 * 画作模式下「归位」只负责退出，不去动卡片位置（免得把摆好的版面弄乱）；
 * 点画面只换下一张，同样不碰卡片。
 * 全程只改类名和 hidden，不碰别人写的 DOM；元素找不到也不会抛错。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {}, errors: [] };

  var ASK_HOME = 1100; // 首屏：先让卡片落位，再问音乐
  var ASK_BACK = 700; // 从别的页面切回首页：稍微快一点
  var ASK_EMPTY = 6000; // 歌库空着时，把话说完自己收起来

  var body = document.body;
  var asked = false; // 一次打开只问一遍
  var askTimer = 0;
  var muse = false; // 画作模式开着没有
  var phase = ""; // 当前天色：sun / moon
  var el = {};

  /* ---------- 小工具 ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  function show(node, on) {
    if (node) node.hidden = !on;
  }

  function stopTimer() {
    if (askTimer) {
      window.clearTimeout(askTimer);
      askTimer = 0;
    }
  }

  function isHome() {
    if (window.Router && typeof window.Router.current === "function") {
      var name = window.Router.current();
      return !name || name === "home";
    }
    return !body.classList.contains("route-page");
  }

  /* ---------- ② 背景色调：跟着太阳 / 月亮走 ---------- */

  function readPhase() {
    var card = $("celestial");
    if (card && card.classList.contains("is-moon")) return "moon";
    return "sun";
  }

  function paintPhase(next) {
    if (next === phase) return;
    phase = next;
    body.classList.toggle("bg-sun", next === "sun");
    body.classList.toggle("bg-moon", next === "moon");
    // 正看着画的时候天色要是变了，就换一幅对得上天色的
    if (muse) refreshPainting();
    onIdle(function () {
      preload(next);
    });
    D.note("mood", { phase: next });
  }

  /* 不去改 sun-moon.js：直接盯着 #celestial 的类名，它一换我们就跟着换 */
  function watchPhase() {
    var card = $("celestial");
    paintPhase(readPhase());
    if (!card || typeof window.MutationObserver !== "function") return;
    var observer = new window.MutationObserver(function () {
      paintPhase(readPhase());
    });
    observer.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- ③ 联想一下：把主页收起来，只剩天上的东西相衬的那幅画 ---------- */

  /* ---------- ③ 联想一下：随机挑一幅画，右下角标出作品名和作者 ---------- */

  /* 全部是公有领域作品（画作出处见 CREDITS.md）。file 是相对 index.html 的路径，
     title / artist / year 就是右下角那两行署名。

     只收横版，而且宽高比要落在 1.2 ~ 2.7 之间。竖版画铺满 16:9 的屏幕时，cover 会把
     它等比放大到只剩中间一条 —— 米勒《播种者》(900×1166) 就因此糊成了一张特写截图，
     所以那一批全部下架；反过来极端的长卷（宽高比 8 以上）被裁得只剩中间一小段，也不收。

     还有一条更硬的标准：太阳组得真画着太阳、月亮组得真画着月亮，而且是画面的看头。
     只是「有日光 / 有月色」的山水一律不收 —— 这一轮据此清掉了 8 幅中国画，
     以及卢梭《沉睡的吉普赛人》（满月在右上角，主体却不是月亮）。

     最后几幅是按要求补的 NASA 摄影（公有领域，出处见 CREDITS.md）：太阳组是国际空间站
     上拍到的轨道日出，月亮组是阿波罗 11 号的月面照片和从月球回望地球的「地出」。这几张
     原作是方画幅，为了横版铺满屏幕，裁掉了上下多余的黑天空与月面。
     太阳组 11 幅、月亮组 6 幅。
     注：弗里德里希《海边的月出》按要求从月亮组改挂太阳组，文件名沿用 moon- 前缀。 */
  var GALLERY = {
    sun: [
      { file: "assets/monet-impression-sunrise.jpg", title: "日出·印象", artist: "克劳德·莫奈", year: "1872" },
      { file: "assets/sun-monet-haystacks-sunset.jpg", title: "干草堆·日落", artist: "克劳德·莫奈", year: "1891" },
      { file: "assets/sun-munch-the-sun.jpg", title: "太阳", artist: "爱德华·蒙克", year: "1916" },
      { file: "assets/moon-friedrich-moonrise-over-sea.jpg", title: "海边的月出", artist: "卡斯帕·大卫·弗里德里希", year: "1822" },
      { file: "assets/sun-constable-hay-wain.jpg", title: "干草车", artist: "约翰·康斯特勃", year: "1821" },
      { file: "assets/sun-shishkin-morning-pine-forest.jpg", title: "松林的早晨", artist: "伊凡·希什金", year: "1889" },
      { file: "assets/sun-levitan-golden-autumn.jpg", title: "金色的秋天", artist: "伊萨克·列维坦", year: "1889" },
      { file: "assets/sun-monet-poppies.jpg", title: "阿让特伊的罂粟花田", artist: "克劳德·莫奈", year: "1873" },
      // 摄影：国际空间站上拍到的轨道日出（NASA，公有领域）
      { file: "assets/sun-nasa-iss-sunrise-namibia.jpg", title: "轨道日出·纳米比亚上空", artist: "NASA（国际空间站）", year: "2024" },
      { file: "assets/sun-nasa-iss-sunrise-atmosphere.jpg", title: "轨道日出·地球大气边缘", artist: "NASA（国际空间站）", year: "2024" },
      { file: "assets/sun-nasa-iss-sunrise-window.jpg", title: "舷窗外的轨道日出", artist: "NASA（国际空间站）", year: "2025" },
    ],
    moon: [
      { file: "assets/van-gogh-starry-night.jpg", title: "星空", artist: "文森特·梵高", year: "1889" },
      { file: "assets/moon-van-gogh-starry-night-rhone.jpg", title: "罗纳河上的星夜", artist: "文森特·梵高", year: "1888" },
      { file: "assets/moon-kuindzhi-moonlit-night-dnieper.jpg", title: "第聂伯河上的月夜", artist: "阿尔希普·库因芝", year: "1880" },
      { file: "assets/moon-turner-keelmen-moonlight.jpg", title: "月光下装煤的平底船", artist: "约瑟夫·透纳", year: "1835" },
      // 摄影：阿波罗 11 号的月面，以及从月球回望地球的「地出」（NASA，公有领域）
      { file: "assets/moon-nasa-apollo11-aldrin.jpg", title: "月面：阿波罗 11 号", artist: "NASA / 尼尔·阿姆斯特朗", year: "1969" },
      { file: "assets/moon-nasa-earthrise.jpg", title: "地出", artist: "NASA / 威廉·安德斯", year: "1968" },
    ],
  };

  var lastPick = { sun: -1, moon: -1 }; // 上一次挑中的下标，用来避开「连出同一幅」
  var preloaded = {}; // 哪一天色的画已经预取过了
  var preloadCache = []; // 留住 Image 对象，免得还没下完就被回收掉

  /* 在 0..len-1 里随机挑一个，尽量不跟上次相同 */
  function pickIndex(name) {
    var list = GALLERY[name];
    if (!list || !list.length) return -1;
    if (list.length === 1) return 0;
    var prev = lastPick[name];
    var next = prev;
    var guard = 0;
    while (next === prev && guard++ < 40) {
      next = Math.floor(Math.random() * list.length);
    }
    return next;
  }

  /* 画某一幅、同时换掉右下角的署名。idx 是 GALLERY[name] 里的下标。 */
  function showPainting(name, idx) {
    var list = GALLERY[name];
    if (!list || !list.length) return false;
    var item = list[idx];
    if (!item) return false;

    lastPick[name] = idx;
    var layer = name === "moon" ? el.paintMoon : el.paintSun;
    if (layer) layer.style.backgroundImage = 'url("' + item.file + '")';

    // 用 textContent 写，别让画名里的符号有机会当 HTML 解析
    if (el.artTitle) el.artTitle.textContent = item.title;
    if (el.artArtist) el.artArtist.textContent = item.artist + " · " + item.year;

    D.note("mood", { painting: item.file, phase: name, idx: idx });
    return true;
  }

  /* 随机换一幅。进画作模式时调一次；看画的时候天色变了也调一次。 */
  function refreshPainting() {
    var name = phase === "moon" ? "moon" : "sun";
    var idx = pickIndex(name);
    if (idx < 0) return;
    showPainting(name, idx);
  }

  /* 看下一张：同一组里按顺序往下走，走到头绕回第一张。
     这样点几下就能把这一组顺着看完，也不会连着两次给同一幅。 */
  function nextPainting() {
    var name = phase === "moon" ? "moon" : "sun";
    var list = GALLERY[name];
    if (!list || !list.length) return;
    var cur = lastPick[name];
    var idx = cur < 0 ? 0 : (cur + 1) % list.length;
    showPainting(name, idx);
  }

  /* 闲下来的时候把这组画预取一遍，免得淡入时先白一下。
     用户开了省流量就跳过（一张画几百 KB，一组也有几 MB）。 */
  function preload(name) {
    if (preloaded[name]) return;
    var list = GALLERY[name];
    if (!list || !list.length) return;
    var conn = navigator.connection;
    if (conn && conn.saveData) return;
    preloaded[name] = true;

    for (var i = 0; i < list.length; i++) {
      var img = new window.Image();
      img.decoding = "async";
      img.src = list[i].file;
      preloadCache.push(img);
    }
    D.note("mood", { preload: name, n: list.length });
  }

  function onIdle(fn) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn, { timeout: 2500 });
    } else {
      window.setTimeout(fn, 1200);
    }
  }

  function hideAsk() {
    stopTimer();
    show(el.ask, false);
  }

  function setMuse(on) {
    muse = !!on;
    if (!muse) cancelClick(); // 退出的时候，把那还没落地的一下单击丢掉
    if (muse) refreshPainting(); // 每次进来都换一幅，换好了再淡入
    body.classList.toggle("muse", muse);
    if (el.museBtn) el.museBtn.setAttribute("aria-pressed", muse ? "true" : "false");
    if (muse) hideAsk(); // 看画的时候别再顶着个弹窗
    D.note("mood", { muse: muse, phase: phase });
  }

  function syncMuseBtn() {
    if (el.museBtn) el.museBtn.hidden = !isHome();
  }

  /* 画作模式下「归位」只退出、不重置卡片：
     归位的监听器在 modules.js 里、注册得比这里早，同一个元素上抢不过它，
     所以在 document 的捕获阶段就把这一下点击截住。 */
  function guardReset() {
    document.addEventListener(
      "click",
      function (e) {
        if (!muse || !el.resetBtn || !e.target) return;
        if (!el.resetBtn.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        setMuse(false);
      },
      true
    );
  }

  /* 画作模式下在画面上点：点一下看下一张，双击就直接退出。
     麻烦的地方在于双击的第一下 click 先到，所以单击这里先攥一小会儿再动；
     这期间要是又来了第二下，就当成双击 —— 不切图，直接退出。 */
  var DBL_MS = 260;
  var clickTimer = 0;

  function cancelClick() {
    if (clickTimer) {
      window.clearTimeout(clickTimer);
      clickTimer = 0;
    }
  }

  function onPaintingClick() {
    if (clickTimer) {
      cancelClick();
      setMuse(false);
      return;
    }
    clickTimer = window.setTimeout(function () {
      clickTimer = 0;
      if (!muse) return;
      nextPainting();
    }, DBL_MS);
  }

  /* 画作模式下在画面上点：点一下看下一张，双击退出（判定见 onPaintingClick）。
     画作层和右下角署名都是 pointer-events: none 的装饰，点在画上时事件其实落在 body 上，
     所以这里不去绑画作层，而是在 document 上兜住这一下；
     唯一要排除的是左上角那两个按钮（它们自己有活儿要干）。 */
  function paintingGestures() {
    document.addEventListener(
      "click",
      function (e) {
        if (!muse || !e.target) return;
        if (el.museBtn && el.museBtn.contains(e.target)) return;
        if (el.resetBtn && el.resetBtn.contains(e.target)) return;
        if (typeof e.preventDefault === "function") e.preventDefault(); // 别让双击顺手选中文字
        onPaintingClick();
      },
      true
    );
  }

  /* ---------- ① 音乐询问 ---------- */

  function askMusic(delay) {
    if (asked || !el.ask || !isHome()) return;
    stopTimer();
    askTimer = window.setTimeout(function () {
      askTimer = 0;
      if (asked || !isHome()) return;
      asked = true;
      show(el.ask, true);
      D.note("mood", { ask: "shown" });
    }, delay);
  }

  function onYes() {
    var played = false;
    try {
      var music = window.Modules && window.Modules.music;
      if (music && typeof music.playRandom === "function") played = music.playRandom();
    } catch (e) {
      D.err("mood.music", e);
    }

    if (played) {
      hideAsk();
      D.note("mood", { ask: "yes" });
      return;
    }

    // 歌库和卡片都空着：说一句「还没歌」就够了，别让人以为是页面坏了
    if (el.sub) el.sub.textContent = "歌库还空着，暂时没歌可放";
    if (el.yes) el.yes.disabled = true;
    stopTimer();
    askTimer = window.setTimeout(function () {
      askTimer = 0;
      show(el.ask, false);
    }, ASK_EMPTY);
    D.note("mood", { ask: "empty" });
  }

  function onNo() {
    hideAsk();
    D.note("mood", { ask: "no" });
  }

  /* ---------- 启动 ---------- */

  function init() {
    el.ask = $("musicAsk");
    el.sub = $("musicAskSub");
    el.yes = $("musicAskYes");
    el.no = $("musicAskNo");
    el.museBtn = $("museBtn");
    el.resetBtn = $("resetLayout");
    el.paintSun = document.querySelector(".painting-sun");
    el.paintMoon = document.querySelector(".painting-moon");
    el.artTitle = $("artTitle");
    el.artArtist = $("artArtist");

    watchPhase();
    guardReset();
    paintingGestures();

    if (el.yes) el.yes.addEventListener("click", onYes);
    if (el.no) el.no.addEventListener("click", onNo);

    if (el.museBtn) {
      el.museBtn.addEventListener("click", function () {
        setMuse(!muse);
      });
    }

    // Esc 也当退出用（键盘上顺手）
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && muse) setMuse(false);
    });

    if (window.Router && typeof window.Router.onChange === "function") {
      window.Router.onChange(function (name) {
        if (name === "home") {
          askMusic(ASK_BACK);
        } else {
          if (muse) setMuse(false);
          hideAsk();
        }
        syncMuseBtn();
      });
    }

    syncMuseBtn();
    askMusic(ASK_HOME);
    onIdle(function () {
      preload(phase);
    });
    D.note("mood", { phase: phase, muse: muse });
  }

  window.Mood = {
    init: init,
    isMuse: function () {
      return muse;
    },
  };
})();
