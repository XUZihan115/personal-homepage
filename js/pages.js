/* pages.js —— 独立页面里的小功能（目前只有留言板）
 *
 * 留言有两条路，自动切换：
 *   ① 下面两个常量填上了 → 留言存在 Supabase 的免费数据库里，
 *      点开链接的人都能看到、都能发，昵称可以留空（显示「匿名」）。
 *      怎么建这个库、怎么删留言，见 docs/guestbook-supabase.md。
 *   ② 没填、或者断网了 → 退回本机浏览器模式，留言只存在你这台电脑上，
 *      用来离线预览，不报错、不影响 file:// 直接打开。
 *
 * 两条路都只用 textContent 拼节点，不碰 innerHTML。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {}, errors: [] };

  /* ------------------------------------------------------------
     配置：填上就把留言板接到公开数据库（留空 = 本机模式）
     anon key 是给前端用的公开钥匙，进仓库、推上 Pages 都没问题；
     安全靠数据库上的 RLS 规则兜着。千万别把 service_role key 填这儿，那个能删库。
     ------------------------------------------------------------ */
  var SUPABASE_URL = "https://zsrymnmccnxcymtiysap.supabase.co";
  /* 新版公开 key（sb_publishable_ 开头），就是原来的 anon key，一样是给前端用的、进仓库没关系 */
  var SUPABASE_ANON_KEY = "sb_publishable_qrbHMWdskGfXDC2XkytgtQ_E6giC1jw";
  var TABLE = "messages";
  var FETCH_LIMIT = 100;

  /* 本机模式的存量留言（老数据不删，没接上库的时候照样能看） */
  var KEY = "homepage.guestbook.v1";
  var MAX = 50;

  var TIP_LOCAL = "还没接上公开留言库，留言只存在这台电脑上。";
  var TIP_ONLINE = "留言公开可见，点开这个链接的人都能看到；昵称可以留空。";
  var TIP_LOADING = "正在加载大家的留言…";
  var TIP_OFFLINE = "暂时连不上留言库，等下再刷新看看。";
  var EMPTY = "还没有人留言，你可以第一个。";

  var form = null;
  var nameEl = null;
  var textEl = null;
  var listEl = null;
  var tipEl = null;

  var items = [];
  var emptyMsg = EMPTY;
  var sending = false;

  /* ---------- 公共小工具 ---------- */

  function online() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.fetch === "function");
  }

  function endpoint(query) {
    return SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/" + TABLE + (query || "");
  }

  function headers(extra) {
    var h = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
      }
    }
    return h;
  }

  function tip(msg) {
    if (tipEl) tipEl.textContent = msg;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function fmt(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return (
      d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
    );
  }

  /* ---------- 本机模式：读写 localStorage ---------- */

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      items = Array.isArray(arr) ? arr : [];
    } catch (e) {
      items = [];
      D.err("pages", e);
    }
  }

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    } catch (e) {
      D.err("pages", e);
    }
  }

  /* ---------- 公开模式：跟 Supabase 的 REST 接口说话 ---------- */

  /* 只取需要的四列、按时间倒序、最多 100 条（RLS 已经放开读） */
  function fetchItems() {
    var url = endpoint("?select=id,created_at,name,body&order=created_at.desc&limit=" + FETCH_LIMIT);
    return window.fetch(url, { headers: headers() }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          name: String(r.name || ""),
          text: String(r.body || ""),
          at: Date.parse(r.created_at) || 0,
        };
      });
    });
  }

  /* 只写入，不要回读（读是公开的，刷新列表就能拿到） */
  function postItem(name, text) {
    return window.fetch(endpoint(""), {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ name: name, body: text }),
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return true;
    });
  }

  function refresh(fromPost) {
    tip(TIP_LOADING);
    if (!items.length) {
      emptyMsg = TIP_LOADING;
      render();
    }
    fetchItems().then(
      function (list) {
        items = list;
        emptyMsg = EMPTY;
        render();
        tip(fromPost ? "发出去了，这就是最新的留言。" : TIP_ONLINE);
        D.note("pages", { guestbook: items.length, remote: true });
      },
      function (err) {
        /* 断网、库被暂停、规则拦下：说清楚，但不把页面弄崩 */
        items = [];
        emptyMsg = TIP_OFFLINE;
        render();
        tip(TIP_OFFLINE);
        D.note("pages", { fetchFailed: String((err && err.message) || err) });
      }
    );
  }

  /* ---------- 渲染（两条路共用） ---------- */

  function render() {
    if (!listEl) return;

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "gb-empty";
      empty.textContent = emptyMsg;
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "gb-item";

      var meta = document.createElement("div");
      meta.className = "gb-meta";

      var nm = document.createElement("span");
      nm.className = "gb-name";
      nm.textContent = it.name || "匿名";

      var tm = document.createElement("span");
      tm.className = "gb-time";
      tm.textContent = fmt(it.at);

      meta.appendChild(nm);
      meta.appendChild(tm);

      var tx = document.createElement("p");
      tx.className = "gb-text";
      tx.textContent = it.text || "";

      li.appendChild(meta);
      li.appendChild(tx);
      listEl.appendChild(li);
    });
  }

  /* ---------- 提交 ---------- */

  function onSubmit(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    var text = textEl ? textEl.value.trim() : "";
    if (!text) {
      if (textEl) textEl.focus();
      return;
    }

    text = text.slice(0, 200);
    var name = ((nameEl && nameEl.value.trim()) || "").slice(0, 16);

    if (online()) {
      if (sending) return;
      sending = true;
      tip("正在发…");
      postItem(name, text).then(
        function () {
          sending = false;
          if (textEl) textEl.value = "";
          if (nameEl) nameEl.value = "";
          D.note("pages", { posted: true, remote: true });
          refresh(true);
        },
        function (err) {
          /* 没发出去就别把用户写的话吞掉：留在输入框里，让他能再点一次 */
          sending = false;
          tip("没发出去，过会儿再点一次「发布」。");
          D.note("pages", { postFailed: String((err && err.message) || err) });
        }
      );
      return;
    }

    /* 本机模式：原样保留以前的行为 */
    items.unshift({
      name: name || "匿名",
      text: text,
      at: Date.now(),
    });
    items = items.slice(0, MAX);
    save();

    if (textEl) textEl.value = "";
    render();
    D.note("pages", { posted: true, total: items.length });
  }

  /* ---------- 启动 ---------- */

  window.Pages = {
    init: function () {
      form = document.getElementById("guestForm");
      if (!form) return; // 没有留言页就直接跳过

      nameEl = document.getElementById("guestName");
      textEl = document.getElementById("guestText");
      listEl = document.getElementById("guestList");
      tipEl = document.getElementById("guestTip");

      form.addEventListener("submit", onSubmit);

      if (!online()) {
        load();
        render();
        tip(TIP_LOCAL);
        D.note("pages", { guestbook: items.length, remote: false });
        return;
      }

      render();
      refresh(false);
    },
  };
})();
