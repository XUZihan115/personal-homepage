/* js/avatar.js —— 数字分身（独立页面 #/avatar，不再是主页上的卡片）
 *
 * 做法：前端直连 DeepSeek API（OpenAI 兼容格式），浏览器直接 fetch。
 * 数字分身的全部秘密都在下面这份 KNOWLEDGE 里：系统提示词 + 四份知识库，
 * 每次提问时作为 system 消息发给模型 —— 不是微调，是「资料 + 提示词 + 边界规则」。
 *
 * 期末报告素材：
 *   - 模型厂商：DeepSeek（深度求索）
 *   - 模型型号：deepseek-flash（DeepSeek-V4.1-Flash-1017）
 *   - 接口：https://api.deepseek.com/chat/completions（OpenAI 兼容格式）
 *   - 接入方式：前端直连（浏览器 fetch，DeepSeek 服务端支持 CORS，已实测预检通过）
 *   - 知识库：与 ai/ 目录同步，改动资料时两处都要改，以 ai/ 为基准
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {} };

  /* ================= 配置区 =================
     注意：前端直连意味着这个 key 会随代码公开（访客按 F12 就能看到），
     风险上限 = 账户余额。策略：只充少量余额，交完作业后把这些 key 作废重建。

     双接入点：目前默认走火山方舟（provider: "ark"），DeepSeek 官方配置原样保留，
     想换回 DeepSeek 时把 provider 改成 "deepseek" 即可，其它什么都不用动。
     方舟那边的 model 用你在控制台开通的模型名或推理接入点 ID（ep-xxx），
     不对的话改成你自己的。 */
  var CONFIG = {
    provider: "ark", // 当前默认：火山方舟；换回 DeepSeek 官方 → "deepseek"
    providers: {
      ark: {
        label: "火山方舟",
        model: "deepseek-v4-1-flash-261017", // DeepSeek-V4.1-Flash（控制台已勾选开通）
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        apiKey: "ARK_API_KEY_REVOKED",
      },
      deepseek: {
        label: "DeepSeek 官方",
        model: "deepseek-flash", // DeepSeek 官方模型：DeepSeek-V4.1-Flash-1017
        baseUrl: "https://api.deepseek.com/chat/completions",
        apiKey: "DEEPSEEK_API_KEY_REVOKED",
      },
    },
    maxTokens: 2048,
    temperature: 0.8,
    maxHistory: 12, // 最多带上多少条历史消息（省 token）
    timeoutMs: 30000,
  };

  /* ================= 知识库 =================
     内容在 js/avatar-knowledge.js（系统提示词 + 四份资料，以 ai/ 目录为基准），
     avatar-knowledge.js 必须在 avatar.js 之前加载。 */
  var KNOWLEDGE = window.AVATAR_KNOWLEDGE || "";

  /* ================= 聊天界面逻辑 ================= */
  var box = null; // 消息列表
  var form = null;
  var input = null;
  var busy = false;
  var history = [];

  function say(kind, text) {
    var el = document.createElement("div");
    el.className = "chat-msg " + kind;
    var bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = text; // 一律 textContent，杜绝注入
    el.appendChild(bubble);
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function sayTyping() {
    var el = document.createElement("div");
    el.className = "chat-msg bot typing";
    el.setAttribute("aria-label", "分身正在输入");
    var bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement("i");
      bubble.appendChild(dot);
    }
    el.appendChild(bubble);
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  /* 访客看到的错误提示：一律不说技术细节，符合分身的边界规则 */
  function humanError(status) {
    if (status === 402) return "分身暂时掉线了——站长的余额用完了。去主页『联系』页戳他本人，比我在这强。";
    if (status === 401 || status === 403) return "分身这边配置出了点问题，站长该修了。先让他本人看到，去『联系』页戳他。";
    if (status === 429) return "分身被问得有点多，歇几秒再试哈。";
    return "分身这边网络卡了一下，稍等再问一次？";
  }

  function setBusy(on) {
    busy = on;
    input.disabled = on;
    form.classList.toggle("busy", on);
    if (!on) {
      input.focus();
      input.placeholder = "问问子涵…";
    }
  }

  function activeConfig() {
    return CONFIG.providers[CONFIG.provider] || CONFIG.providers.ark;
  }

  function ask(text) {
    history.push({ role: "user", content: text });
    // 只带上最近 maxHistory 条消息，控制每次请求的 token 消耗
    var windowed = history.slice(-CONFIG.maxHistory);
    var cfg = activeConfig();
    var payload = {
      model: cfg.model,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      stream: false,
      messages: [{ role: "system", content: KNOWLEDGE }].concat(windowed),
    };

    return fetch(cfg.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status);
        err.status = res.status;
        return Promise.reject(err);
      }
      return res.json();
    });
  }

  function onSend(e) {
    if (e) e.preventDefault();
    var text = (input.value || "").trim();
    if (!text || busy) return;
    input.value = "";
    input.placeholder = "分身正在输入…";
    say("me", text);
    var t1 = sayTyping();
    setBusy(true);
    var t0 = Date.now();
    ask(text)
      .then(function (data) {
        var reply = "";
        try {
          reply = data.choices[0].message.content;
        } catch (err) {
          reply = "";
        }
        reply = (reply || "").trim();
        if (!reply) throw { status: 0 };
        if (t1.parentNode) t1.parentNode.removeChild(t1);
        say("bot", reply);
        history.push({ role: "assistant", content: reply });
        D.note("avatar", { req: "ok", ms: Date.now() - t0, replyLen: reply.length });
      })
      .catch(function (err) {
        if (t1.parentNode) t1.parentNode.removeChild(t1);
        var status = err && err.status ? err.status : 0;
        say("bot err", humanError(status));
        // 请求失败了，这条 user 消息不该留在历史里，否则下次会重复计费
        if (history.length && history[history.length - 1].role === "user") history.pop();
        D.note("avatar", { req: "fail", status: status });
      })
      .then(function () {
        setBusy(false);
      });
  }

  function init() {
    box = document.getElementById("chatBox");
    form = document.getElementById("chatForm");
    input = document.getElementById("chatInput");
    if (!box || !form || !input) {
      D.note("avatar", { ok: false, error: "找不到聊天界面元素" });
      return;
    }
    form.addEventListener("submit", onSend);
    say("bot", "你好呀，我是徐子涵主页上的数字分身。他做过什么、怎么想的、用的什么技术，都能问我。想聊点啥？");
    setBusy(false);
    D.note("avatar", {
      ok: true,
      provider: CONFIG.provider,
      model: activeConfig().model,
      historyCap: CONFIG.maxHistory,
    });
  }

  window.Avatar = {
    init: init,
    /* 供桌宠调用：在对话框里以分身身份说一句话 */
    say: say,
    /* 当前在用的接入点（含 label / model / baseUrl），诊断时看一眼 */
    active: activeConfig,
  };
})();
