/* js/diag.js —— 页面自检与错误收集
 * 把运行状态挂在 window.__DIAG 上：出错不会白屏，出问题能一眼看出是哪个模块挂了。
 * 控制台里输入 __DIAG 即可查看；自动化检查脚本也读这个对象。
 */
(function () {
  "use strict";

  var diag = {
    startedAt: new Date().toISOString(),
    ready: false,
    errors: [],
    modules: {},
    /* 记录某个模块的实时状态 */
    note: function (name, info) {
      var m = this.modules[name] || (this.modules[name] = {});
      for (var k in info) {
        if (Object.prototype.hasOwnProperty.call(info, k)) m[k] = info[k];
      }
      return m;
    },
    /* 记录一个被捕获的错误 */
    err: function (scope, e) {
      var msg = e && e.message ? e.message : String(e);
      this.errors.push({ scope: scope, message: msg, at: Date.now() });
      if (window.console && console.warn) console.warn("[diag] " + scope + " 出错：" + msg);
      return msg;
    },
  };

  window.__DIAG = diag;

  window.addEventListener("error", function (e) {
    diag.errors.push({
      scope: "window.onerror",
      message: e.message || "脚本加载失败",
      where: (e.filename || "") + ":" + (e.lineno || 0),
      at: Date.now(),
    });
  });

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    diag.errors.push({
      scope: "unhandledrejection",
      message: r && r.message ? r.message : String(r),
      at: Date.now(),
    });
  });
})();
