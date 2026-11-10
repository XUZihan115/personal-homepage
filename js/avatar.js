/* js/avatar.js —— 数字分身（独立页面 #/avatar，不再是主页上的卡片）
 *
 * 做法：前端先请求阿里云函数计算（FC）代理（见 docs/scf-ark-proxy-deploy.md），
 * 代理再转发火山方舟 OpenAI 兼容接口。API Key 只存在云函数环境变量里，
 * 前端源码不再携带任何密钥。
 * 数字分身的全部秘密都在下面这份 KNOWLEDGE 里：系统提示词 + 六份知识库，
 * 每次提问时作为 system 消息发给模型 —— 不是微调，是「资料 + 提示词 + 边界规则」。
 *
 * 期末报告素材：
 *   - 模型厂商：火山方舟（火山引擎）承载 DeepSeek-V4.1-Flash
 *   - 模型型号：deepseek-v4-1-flash-261017（控制台开通）
 *   - 接口：阿里云 FC 事件函数代理 → https://ark.cn-beijing.volces.com/api/v3/chat/completions
 *   - 接入方式：前端 → 云函数代理（免费额度 100万次调用/月）→ 方舟
 *   - 知识库：与 ai/ 目录同步，改动资料时两处都要改，以 ai/ 为基准
 */
(function () {
  "use strict";

  var D = window.__DIAG || { note: function () {}, err: function () {} };

  /* ================= 配置区 =================
     注意：密钥已全部迁到阿里云 FC 代理的环境变量（ARK_API_KEY），
     前端这里不再放任何 key；baseUrl 指向部署好的代理地址。

     双接入点：默认走火山方舟（provider: "ark"），DeepSeek 官方配置原样保留，
     想换回 DeepSeek 时把 provider 改成 "deepseek" 即可（若保留官方 key 的话）。
     方舟那边用哪个模型由代理环境变量 ARK_MODELS 决定（逗号分隔，额度用完自动切下一个），
     前端传的 model 只在列表内时作为起始模型，保留仅作兼容。 */
  var CONFIG = {
    provider: "ark", // 当前默认：火山方舟；换回 DeepSeek 官方 → "deepseek"
    providers: {
      ark: {
        label: "火山方舟",
        model: "deepseek-v4-1-flash-261017", // 实际由代理端 ARK_MODELS 决定（列表首个）
        baseUrl: "https://ark-proxy-pevypymehk.cn-beijing.fcapp.run/chat", // 阿里云 FC 代理（函数 URL）+ /chat
        apiKey: "",
      },
      deepseek: {
        label: "DeepSeek 官方",
        model: "deepseek-flash", // DeepSeek 官方模型：DeepSeek-V4.1-Flash-1017
        baseUrl: "https://api.deepseek.com/chat/completions",
        apiKey: "",
      },
    },
    maxTokens: 2048,
    temperature: 0.8,
    maxHistory: 12, // 最多带上多少条历史消息（省 token）
    timeoutMs: 30000,
  };

  /* ================= 知识库 =================
     内容在 js/avatar-knowledge.js（系统提示词 + 六份资料，以 ai/ 目录为基准），
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

  /* 请求头：key 为空（走 FC 代理）时不发送 Authorization，避免无意义的预检头 */
  function getHeaders(cfg) {
    var h = { "Content-Type": "application/json" };
    if (cfg.apiKey) h.Authorization = "Bearer " + cfg.apiKey;
    return h;
  }

  function ask(text) {
    history.push({ role: "user", content: text });
    // 只带上最近 maxHistory 条消息，控制每次请求的 token 消耗
    var windowed = history.slice(-CONFIG.maxHistory);
    var cfg = activeConfig();
    if (!cfg.baseUrl) {
      // 代理地址还没填（部署步骤见 docs/scf-ark-proxy-deploy.md）
      var nop = new Error("proxy not configured");
      nop.status = 0;
      return Promise.reject(nop);
    }
    var payload = {
      model: cfg.model,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      stream: false,
      messages: [{ role: "system", content: KNOWLEDGE }].concat(windowed),
    };

    // 真正的超时控制：超过 timeoutMs 未返回就中止请求
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, CONFIG.timeoutMs);

    return fetch(cfg.baseUrl, {
      method: "POST",
      headers: getHeaders(cfg),
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
      .then(function (res) {
        clearTimeout(timer);
        // 代理在额度用完时自动切换了模型：桌宠头顶冒气泡告知访客
        if (res.headers.get("X-Proxy-Fallback")) {
          if (window.Pet && typeof window.Pet.speak === "function") {
            window.Pet.speak("哎呀~这个模型额度用完了，正在换模型哦", 3200);
          }
        }
        if (!res.ok) {
          var err = new Error("HTTP " + res.status);
          err.status = res.status;
          return Promise.reject(err);
        }
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (err && err.name === "AbortError") {
          var t = new Error("request timeout");
          t.status = 0;
          t.timeout = true;
          throw t;
        }
        throw err;
      });
  }

  /* ============ 无关话题本地拦截：不请求模型，直接省 token ============ */
  var OFFTOPIC_REPLY = "这个问题貌似和我的主人并不相关，Kimi 的 Token 真的很贵的[哭]";
  /* 连续第 3 次被拦之后换这句：告诉访客确实拦在前端，没产生任何调用 */
  var OFFTOPIC_STREAK_REPLY = "真的不要试啦，信息都被拦截在前端了，这样不会消耗Token的。";
  var offTopicStreak = 0; // 连续被本地拦截的次数（问到正经话题就清零）

  var ON_TOPIC = [
    "子涵", "zihan", "主人", "分身", "主页", "网站", "页面", "这个站",
    "项目", "代码", "编程", "程序", "网页", "前端", "后端", "html", "css", "js", "javascript",
    "python", "vibe", "ai", "大模型", "模型", "token", "three", "canvas", "着色器",
    "太阳", "月亮", "日月", "天文", "nasa", "sdo", "星空",
    "乒乓球", "数学建模", "建模", "竞赛", "奖",
    "留言", "联系", "邮箱", "qq", "github", "微信",
    "jenny", "在意",
    "智能医学", "医学", "脑机", "天津大学", "港理工", "深圳", "大学", "专业", "课程", "cst", "aitll",
    "笔顺", "桌宠", "宠物", "音乐", "歌", "主题", "深色", "浅色", "性格", "兴趣", "爱好",
    "经历", "技能", "学习", "考试", "转专业", "考研", "出国", "实习", "社团", "影像",
    "许愿池", "迭代", "五周", "四个版本", "supabase"
  ];

  var OFF_TOPIC_TERMS = [
    "辛亥革命", "鸦片战争", "甲午", "五四运动", "文化大革命", "文革", "改革开放",
    "三国", "秦始皇", "唐朝", "宋朝", "明朝", "清朝", "汉朝", "民国",
    "二战", "第一次世界大战", "抗日战争", "解放战争",
    "五羟基色胺", "血清素", "多巴胺", "内啡肽", "光合作用", "细胞", "病毒", "dna", "疫苗",
    "牛顿", "爱因斯坦", "相对论", "量子", "微积分", "导数", "积分", "三角函数", "欧姆定律",
    "元素周期表", "化学式", "摩尔",
    "股票", "基金", "比特币", "房价", "天气预报", "新闻联播", "总统", "首相"
  ];

  /* 主页里真实出现过的技术 / 概念名词：问到它们就是「聊主页」，放行给模型正常解释，
     不能再被「什么是 xxx」这种通用问法误杀（例如「什么是 CSS」「HTML 是干嘛的」）。 */
  var TECH_TERMS = [
    "html", "css", "javascript", "js", "python", "three.js", "three", "webgl", "着色器", "shader",
    "canvas", "api", "json", "http", "https", "git", "github", "pwa", "supabase", "数据库",
    "前端", "后端", "全栈", "域名", "部署", "框架", "响应式", "flex", "grid", "路由", "缓存",
    "react", "vue", "next.js", "vite", "npm", "node",
    "大模型", "llm", "提示词", "prompt", "知识库", "微调", "token", "算法", "数组", "函数",
    "循环", "递归", "变量", "浏览器", "服务器", "云函数", "阿里云", "火山引擎", "方舟",
    "网站", "网页", "页面", "字体", "无障碍", "动效", "3d", "glb", "贴图", "纹理",
    "笔顺", "数码管", "时钟", "主题", "深色", "浅色", "桌宠", "留言板", "二维码"
  ];

  /* 判断：明显与主人/主页无关 → true（本地直接回，不调模型） */
  function looksOffTopic(raw) {
    var t = (raw || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!t) return false;
    // 纯算式或符号
    if (/^[\d.,，。+\-*/×÷^()（）=＝?？!！\s]+$/.test(t)) return true;
    if (/\d+\s*[+\-*/×÷]\s*\d+\s*(=|等于|是多少|等于多少|得多少)/.test(t)) return true;
    // 「帮我算一下 128*37」这种口语化算式
    if (/\d+\s*[+\-*/×÷]\s*\d+/.test(t) && /(算|多少|等于)/.test(t)) return true;
    // 明确的百科 / 时政 / 科学名词
    for (var i = 0; i < OFF_TOPIC_TERMS.length; i++) {
      if (t.indexOf(OFF_TOPIC_TERMS[i]) !== -1) return true;
    }
    // 主页里出现过的技术名词 → 属于聊主页，放行（含「你知道什么是 HTML 吗」这类开场）
    for (var k = 0; k < TECH_TERMS.length; k++) {
      if (t.indexOf(TECH_TERMS[k]) !== -1) return false;
    }
    // 「我是谁」问的是访客自己，不是百科题，不能按考问式拦掉
    if (/(我是谁|我是哪位|猜猜我是|你知道我是|你知道你是谁)/.test(t)) return false;
    // 考问式开场
    if (/(你知道|你了解|你听说过|你懂|你知不知道)/.test(t)) return true;
    // 命中主人 / 主页相关实体 → 正常走模型
    for (var j = 0; j < ON_TOPIC.length; j++) {
      if (t.indexOf(ON_TOPIC[j]) !== -1) return false;
    }
    // 直接问分身本人
    if (/^(你|您|他|主人|子涵)/.test(t)) return false;
    // 通用百科式问法
    if (/(什么是|何为|是什么|为什么|为啥|如何|怎么|多少|哪一年|什么意思|定义|原理)/.test(t) && t.length >= 6) return true;
    return false;
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
    if (looksOffTopic(text)) {
      offTopicStreak += 1;
      if (t1.parentNode) t1.parentNode.removeChild(t1);
      // 前两次用原话术；连续第 3 次起明说「拦在前端、不花钱」
      say("bot", offTopicStreak >= 3 ? OFFTOPIC_STREAK_REPLY : OFFTOPIC_REPLY);
      D.note("avatar", { req: "offtopic", streak: offTopicStreak });
      setBusy(false);
      return;
    }
    offTopicStreak = 0; // 问到正经话题，连续计数清零

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
        if (!reply) {
          var e2 = new Error("empty reply");
          e2.status = 0;
          e2.empty = true; // 模型思考把 token 占满没说出话，不是网络问题
          throw e2;
        }
        if (t1.parentNode) t1.parentNode.removeChild(t1);
        say("bot", reply);
        history.push({ role: "assistant", content: reply });
        D.note("avatar", { req: "ok", ms: Date.now() - t0, replyLen: reply.length });
      })
      .catch(function (err) {
        if (t1.parentNode) t1.parentNode.removeChild(t1);
        var status = err && err.status ? err.status : 0;
        if (err && err.timeout) {
          say("bot err", "分身想得太久了，先把这题放一放，再问一次？");
        } else if (err && err.empty) {
          say("bot err", "分身刚走神了，没说出话来，再问一次？");
        } else {
          say("bot err", humanError(status));
        }
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
    say("bot", "你好呀，我是主人徐子涵的数字分身。他做过什么、怎么想的、用的什么技术，都能问我。想聊点啥？");
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
