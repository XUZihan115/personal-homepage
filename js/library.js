/* library.js —— 歌库页
 *
 * 曲目清单在 audio/library.js（window.AUDIO_LIBRARY）。这里干三件事：
 *   1. 把清单渲染成一列；
 *   2. 搜索框按「歌名 / 歌手」实时过滤，命中的字会高亮；
 *   3. 点一行播放（用 <audio id="libAudio">），开播前先停掉首页音乐卡那个播放器，
 *      离开歌库页时也停掉，免得两个一起响。
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {}, errors: [] };

  var input = null;
  var listEl = null;
  var countEl = null;
  var emptyEl = null;
  var audio = null;
  var mainAudio = null;

  var all = [];    // 全部曲目
  var view = [];   // 当前搜索结果的视图（下标对应行上的 data-i）
  var playing = -1;

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase();
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function clean(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      if (!it.src) continue;
      out.push({
        title: it.title || "未命名",
        artist: it.artist || "未知歌手",
        src: it.src,
        dur: it.dur || "",
      });
    }
    return out;
  }

  /* 把命中的那段字包进 <span class="lib-hit">，全程用 textContent，不碰 innerHTML */
  function marked(text, q) {
    var box = document.createElement("span");
    if (!q) {
      box.textContent = text;
      return box;
    }
    var i = norm(text).indexOf(q);
    if (i < 0) {
      box.textContent = text;
      return box;
    }
    box.appendChild(document.createTextNode(text.slice(0, i)));
    var hit = document.createElement("span");
    hit.className = "lib-hit";
    hit.textContent = text.slice(i, i + q.length);
    box.appendChild(hit);
    box.appendChild(document.createTextNode(text.slice(i + q.length)));
    return box;
  }

  function row(item, idx, q) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "lib-row";
    b.setAttribute("data-i", String(idx));
    b.setAttribute("role", "listitem");
    b.setAttribute("aria-label", item.title + " —— " + item.artist);

    var no = document.createElement("span");
    no.className = "lib-idx";
    no.textContent = pad2(idx + 1);

    var ti = document.createElement("span");
    ti.className = "lib-title";
    ti.appendChild(marked(item.title, q));

    var ar = document.createElement("span");
    ar.className = "lib-artist";
    ar.textContent = item.artist;

    var du = document.createElement("span");
    du.className = "lib-dur";
    du.textContent = item.dur;

    b.appendChild(no);
    b.appendChild(ti);
    b.appendChild(ar);
    b.appendChild(du);
    b.addEventListener("click", function () {
      toggle(idx);
    });
    return b;
  }

  function sync() {
    if (!listEl) return;
    var rows = listEl.querySelectorAll(".lib-row");
    for (var i = 0; i < rows.length; i++) {
      var idx = parseInt(rows[i].getAttribute("data-i"), 10);
      rows[i].classList.toggle("is-playing", idx === playing && !!audio && !audio.paused);
    }
  }

  function render() {
    if (!listEl) return;

    var q = norm(input ? input.value.trim() : "");
    view = q
      ? all.filter(function (it) {
          return norm(it.title).indexOf(q) >= 0 || norm(it.artist).indexOf(q) >= 0;
        })
      : all.slice();

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    for (var i = 0; i < view.length; i++) listEl.appendChild(row(view[i], i, q));

    if (countEl) countEl.textContent = view.length + " 首";

    if (emptyEl) {
      if (!all.length) {
        emptyEl.hidden = false;
        emptyEl.textContent = "歌库还空着。";
      } else if (!view.length) {
        emptyEl.hidden = false;
        emptyEl.textContent = "没找到匹配「" + (input ? input.value.trim() : "") + "」的歌。";
      } else {
        emptyEl.hidden = true;
      }
    }

    sync();
  }

  function toggle(idx) {
    var item = view[idx];
    if (!item || !audio) return;

    // 再点一次正在播的那行 = 暂停
    if (idx === playing && !audio.paused) {
      audio.pause();
      return;
    }

    if (mainAudio && !mainAudio.paused) mainAudio.pause();

    playing = idx;
    if (audio.getAttribute("src") !== item.src) audio.setAttribute("src", item.src);
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function (e) {
        D.err("library", e);
      });
    }
  }

  function stop() {
    if (audio && !audio.paused) audio.pause();
  }

  window.Library = {
    init: function () {
      input = document.getElementById("libSearch");
      listEl = document.getElementById("libList");
      audio = document.getElementById("libAudio");
      if (!listEl || !audio) return; // 没有歌库页就什么都不做

      countEl = document.getElementById("libCount");
      emptyEl = document.getElementById("libEmpty");
      mainAudio = document.getElementById("audio");

      all = clean(window.AUDIO_LIBRARY || []);
      render();

      if (input) {
        input.addEventListener("input", render);
        input.addEventListener("search", render);
        input.addEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            input.value = "";
            render();
          }
        });
      }

      audio.addEventListener("play", sync);
      audio.addEventListener("pause", sync);
      audio.addEventListener("ended", sync);
      audio.addEventListener("error", function () {
        if (!audio.getAttribute("src")) return; // 还没选歌，不算错
        D.err("library", new Error("这个音频打不开：" + audio.getAttribute("src")));
      });

      if (window.Router && window.Router.onChange) {
        window.Router.onChange(function (name) {
          if (name !== "library") stop();
        });
      }

      D.note("library", { tracks: all.length });
    },
    stop: stop,
  };
})();
