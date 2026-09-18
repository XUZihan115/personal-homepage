/* js/sun-moon.js —— 模块四：太阳 / 月亮
 *
 * 用的是真实的天体影像：
 *   月亮 = NASA LRO 月球反照率图（等距圆柱 2048×1024），
 *          凹凸由反照率亮度现场派生（亮的高地 = 高，暗的月海 = 低）。
 *   太阳 = NASA SDO/HMI 日面连续谱影像，先按视角反演掉临边昏暗，
 *          再由着色器用 mu 重新算一遍，这样自转时不会有亮斑跟着跑。
 * 外层加日冕光晕，太阳表面贴着「日珥」弧环并偶尔抛射粒子。
 * 贴图只走相对路径 textures/*.jpg；拿不到（比如 file:// 打开）时
 * 自动退回程序化生成的表面，页面依然是完整的。
 * 点击卡片在两者之间切换（淡出 → 淡入 + 一次很轻的闪光）。
 *
 * 依赖：js/three.min.js（本地）。WebGL 不可用时自动降级为 CSS 画的星球。
 */
(function () {
  "use strict";

  var D = window.__DIAG;
  var R = 1.0; // 星球半径

  /* ============================================================
     着色器公共部分
     ============================================================ */
  var GLSL_COMMON = [
    "float hash31(vec3 p) {",
    "  p = fract(p * 0.3183099 + vec3(0.11, 0.27, 0.43));",
    "  p *= 17.0;",
    "  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));",
    "}",
    "float vnoise(vec3 x) {",
    "  vec3 i = floor(x);",
    "  vec3 f = fract(x);",
    "  f = f * f * (3.0 - 2.0 * f);",
    "  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));",
    "  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));",
    "  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));",
    "  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));",
    "  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));",
    "  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));",
    "  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));",
    "  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));",
    "  float x00 = mix(n000, n100, f.x);",
    "  float x10 = mix(n010, n110, f.x);",
    "  float x01 = mix(n001, n101, f.x);",
    "  float x11 = mix(n011, n111, f.x);",
    "  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);",
    "}",
    "float fbm3(vec3 p) {",
    "  float a = 0.5;",
    "  float s = 0.0;",
    "  for (int i = 0; i < 4; i++) {",
    "    s += a * vnoise(p);",
    "    p *= 2.03;",
    "    a *= 0.5;",
    "  }",
    "  return s;",
    "}",
  ].join("\n");

  /* ---------- 太阳 ---------- */
  var SUN_VERT = [
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying vec3 vNormalW;",
    "varying vec3 vWorldPos;",
    "void main() {",
    "  vUv = uv;",
    "  vPos = position;",
    "  vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);",
    "  vec4 wp = modelMatrix * vec4(position, 1.0);",
    "  vWorldPos = wp.xyz;",
    "  gl_Position = projectionMatrix * viewMatrix * wp;",
    "}",
  ].join("\n");

  var SUN_FRAG = [
    "precision highp float;",
    "uniform float uTime;",
    "uniform float uOpacity;",
    "uniform sampler2D uAlbedo;",
    "uniform float uUseTex;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying vec3 vNormalW;",
    "varying vec3 vWorldPos;",
    GLSL_COMMON,
    "void main() {",
    "  vec3 albedo;",
    "  if (uUseTex > 0.5) {",
    "    albedo = texture2D(uAlbedo, vUv).rgb;",
    "  } else {",
    "    vec3 p = normalize(vPos);",
    "    vec3 drift = vec3(0.0, uTime * 0.010, 0.0);",
    "    float g1 = fbm3(p * 5.5 + drift);",
    "    float g2 = fbm3(p * 13.0 - drift * 1.8);",
    "    float gran = g1 * 0.7 + g2 * 0.3;",
    "    float act = smoothstep(0.60, 0.80, g1 + g2 * 0.4);",
    "    vec3 deep = vec3(0.92, 0.26, 0.03);",
    "    vec3 mid = vec3(1.00, 0.66, 0.16);",
    "    vec3 hot = vec3(1.00, 0.97, 0.82);",
    "    albedo = mix(deep, mid, smoothstep(0.30, 0.56, gran));",
    "    albedo = mix(albedo, hot, smoothstep(0.56, 0.86, gran));",
    "    albedo = mix(albedo, vec3(1.00, 0.88, 0.58), act * 0.7);",
    "  }",
    "  vec3 V = normalize(cameraPosition - vWorldPos);",
    "  float mu = clamp(dot(normalize(vNormalW), V), 0.0, 1.0);",
    // 临边昏暗：中心最亮，越靠边越暗，最外圈补一点偏红的色温
    "  vec3 col = albedo * (0.30 + 0.70 * pow(mu, 0.65));",
    "  col += vec3(1.0, 0.34, 0.06) * pow(1.0 - mu, 3.2) * 0.75;",
    "  gl_FragColor = vec4(col, uOpacity);",
    "}",
  ].join("\n");

  /* ---------- 月亮 ---------- */
  var MOON_VERT = [
    "varying vec2 vUv;",
    "varying vec3 vNormalO;",
    "varying vec3 vNormalW;",
    "varying vec3 vWorldPos;",
    "void main() {",
    "  vUv = uv;",
    "  vNormalO = normalize(normal);",
    "  vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);",
    "  vec4 wp = modelMatrix * vec4(position, 1.0);",
    "  vWorldPos = wp.xyz;",
    "  gl_Position = projectionMatrix * viewMatrix * wp;",
    "}",
  ].join("\n");

  var MOON_FRAG = [
    "precision highp float;",
    "uniform float uOpacity;",
    "uniform float uBump;",
    "uniform vec3 uLight;",
    "uniform vec2 uTexel;",
    "uniform sampler2D uAlbedo;",
    "uniform sampler2D uHeight;",
    // three 只把 modelMatrix 注入顶点着色器，片元里要自己声明一次；
    // 漏了它整个程序编译失败，球体根本不画（只剩光晕），而且报错只在控制台，页面上看不出来。
    "uniform mat4 modelMatrix;",
    "varying vec2 vUv;",
    "varying vec3 vNormalO;",
    "varying vec3 vNormalW;",
    "varying vec3 vWorldPos;",
    "void main() {",
    "  vec3 albedo = texture2D(uAlbedo, vUv).rgb;",
    "  float h = texture2D(uHeight, vUv).r;",
    "  float hE = texture2D(uHeight, vUv + vec2(uTexel.x * 2.0, 0.0)).r;",
    "  float hN = texture2D(uHeight, vUv + vec2(0.0, uTexel.y * 2.0)).r;",
    "  vec3 n = normalize(vNormalO);",
    "  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(0.0001, 0.0, 0.0));",
    "  vec3 north = normalize(cross(n, east));",
    "  n = normalize(n - (east * (hE - h) + north * (hN - h)) * uBump);",
    "  vec3 nW = normalize((modelMatrix * vec4(n, 0.0)).xyz);",
    "  vec3 L = normalize(uLight);",
    "  float lam = dot(nW, L);",
    "  float diff = smoothstep(-0.10, 0.32, lam);",
    // 反照率 × 方向光；常数是按离线预览调准的，太阳/月亮都不做色彩空间转换
    "  vec3 col = albedo * (0.05 + 1.30 * diff);",
    "  col += vec3(0.045, 0.075, 0.165) * (1.0 - diff) * 0.85;",
    "  vec3 V = normalize(cameraPosition - vWorldPos);",
    "  float mu = clamp(dot(nW, V), 0.0, 1.0);",
    "  col *= 0.86 + 0.14 * pow(mu, 0.4);",
    "  col = pow(col, vec3(0.93));",
    "  gl_FragColor = vec4(col, uOpacity);",
    "}",
  ].join("\n");

  /* ---------- 日珥弧环 ---------- */
  var PROM_VERT = ["varying vec2 vUv;", "void main() {", "  vUv = uv;", "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);", "}"].join("\n");

  var PROM_FRAG = [
    "precision highp float;",
    "uniform float uTime;",
    "uniform float uOpacity;",
    "uniform float uSeed;",
    "varying vec2 vUv;",
    "void main() {",
    "  float a = vUv.x;",
    "  float fade = pow(sin(a * 3.14159265), 0.55);",
    // 只留很浅的呼吸感，不再明显闪动
    "  float flick = 0.85 + 0.15 * sin(uTime * 1.1 + uSeed + a * 9.0);",
    "  vec3 col = mix(vec3(1.0, 0.28, 0.04), vec3(1.0, 0.80, 0.34), a);",
    "  gl_FragColor = vec4(col * (0.70 + 0.35 * flick), fade * flick * uOpacity);",
    "}",
  ].join("\n");

  /* ============================================================
     月亮贴图：CPU 预生成（反照率 + 高度）
     ============================================================ */
  function noiseCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var g = c.getContext("2d");
    var img = g.createImageData(w, h);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 128 + (Math.random() * 2 - 1) * 96;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function makeMoonMaps() {
    var W = 1024;
    var H = 512;
    var alb = document.createElement("canvas");
    alb.width = W;
    alb.height = H;
    var hei = document.createElement("canvas");
    hei.width = W;
    hei.height = H;
    var ga = alb.getContext("2d");
    var gh = hei.getContext("2d");

    // 基底：月壤灰
    ga.fillStyle = "#9b9a97";
    ga.fillRect(0, 0, W, H);
    gh.fillStyle = "#808080";
    gh.fillRect(0, 0, W, H);

    // 月海（大块暗区）与高地（亮区）
    for (var i = 0; i < 30; i++) {
      var x = Math.random() * W;
      var sinLat = Math.random() * 1.7 - 0.85;
      var y = (Math.acos(sinLat) / Math.PI) * H;
      var r = 50 + Math.random() * 160;
      var darker = Math.random() < 0.62;
      var rg = ga.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, darker ? "rgba(58,58,64,0.72)" : "rgba(220,220,214,0.30)");
      rg.addColorStop(0.6, darker ? "rgba(70,70,76,0.35)" : "rgba(210,210,205,0.14)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ga.fillStyle = rg;
      ga.beginPath();
      ga.arc(x, y, r, 0, Math.PI * 2);
      ga.fill();
    }

    // 细颗粒（两个尺度）
    var n1 = noiseCanvas(256, 128);
    var n2 = noiseCanvas(96, 48);
    ga.globalAlpha = 0.055;
    ga.drawImage(n1, 0, 0, W, H);
    ga.globalAlpha = 0.05;
    ga.drawImage(n2, 0, 0, W, H);
    ga.globalAlpha = 1;

    // 环形山
    var craters = 520;
    for (var k = 0; k < craters; k++) {
      var sinLatC = Math.random() * 1.7 - 0.85;
      var theta = Math.acos(sinLatC);
      var cy = (theta / Math.PI) * H;
      var cx = Math.random() * W;
      var rr = 3 + Math.pow(Math.random(), 2.4) * 26;
      var stretch = 1 / Math.max(0.3, Math.sin(theta)); // 极区在等距圆柱投影里被拉长
      var rx = rr * stretch;

      // 坑外溅射物（亮）
      var halo = ga.createRadialGradient(cx, cy, rr * 0.6, cx, cy, rr * 1.9);
      halo.addColorStop(0, "rgba(232,232,226,0.34)");
      halo.addColorStop(1, "rgba(232,232,226,0)");

      // 坑内（暗）
      var bowl = ga.createRadialGradient(cx - rr * 0.25, cy - rr * 0.25, rr * 0.1, cx, cy, rr);
      bowl.addColorStop(0, "rgba(46,46,52,0.80)");
      bowl.addColorStop(0.72, "rgba(74,74,80,0.62)");
      bowl.addColorStop(1, "rgba(120,120,124,0.10)");

      // 坑缘（亮）
      var rim = ga.createRadialGradient(cx, cy, rr * 0.86, cx, cy, rr * 1.22);
      rim.addColorStop(0, "rgba(255,255,250,0)");
      rim.addColorStop(0.42, "rgba(255,255,250,0.55)");
      rim.addColorStop(1, "rgba(255,255,250,0)");

      for (var w = -1; w <= 1; w++) {
        var px = cx + w * W;
        if (px < -rr * 2 || px > W + rr * 2) continue;
        ga.beginPath();
        ga.ellipse(px, cy, rr * 1.9, rr * 1.9, 0, 0, Math.PI * 2);
        ga.fillStyle = halo;
        ga.fill();
        ga.beginPath();
        ga.ellipse(px, cy, rx, rr, 0, 0, Math.PI * 2);
        ga.fillStyle = bowl;
        ga.fill();
        ga.beginPath();
        ga.ellipse(px, cy, rx * 1.2, rr * 1.2, 0, 0, Math.PI * 2);
        ga.fillStyle = rim;
        ga.fill();

        // 高度图：坑内低、坑缘高
        var hBowl = gh.createRadialGradient(px, cy, 0, px, cy, rr);
        hBowl.addColorStop(0, "rgba(40,40,40,1)");
        hBowl.addColorStop(0.75, "rgba(70,70,70,1)");
        hBowl.addColorStop(1, "rgba(128,128,128,1)");
        gh.beginPath();
        gh.ellipse(px, cy, rx, rr, 0, 0, Math.PI * 2);
        gh.fillStyle = hBowl;
        gh.fill();
        var hRim = gh.createRadialGradient(px, cy, rr * 0.88, px, cy, rr * 1.25);
        hRim.addColorStop(0, "rgba(128,128,128,0)");
        hRim.addColorStop(0.5, "rgba(215,215,215,1)");
        hRim.addColorStop(1, "rgba(128,128,128,0)");
        gh.beginPath();
        gh.ellipse(px, cy, rx * 1.25, rr * 1.25, 0, 0, Math.PI * 2);
        gh.fillStyle = hRim;
        gh.fill();
      }
    }

    return { albedo: alb, height: hei };
  }

  /* 日冕 / 光晕贴图 */
  function glowTexture(stops) {
    var s = 256;
    var c = document.createElement("canvas");
    c.width = s;
    c.height = s;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (var i = 0; i < stops.length; i++) rg.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
    return c;
  }

  /* ============================================================
     真实贴图：加载 + 由反照率派生凹凸高度图
     ============================================================ */
  function onePixel(color) {
    var c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    var g = c.getContext("2d");
    g.fillStyle = color;
    g.fillRect(0, 0, 1, 1);
    return c;
  }

  function loadTexture(url, onOk, onFail) {
    var THREE = window.THREE;
    if (!THREE || !THREE.TextureLoader) return;
    var loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      function (tex) {
        try {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          if (tex.anisotropy !== undefined) tex.anisotropy = 4;
          tex.needsUpdate = true;
          onOk(tex);
        } catch (e) {
          D.err("celestial.tex", e);
        }
      },
      undefined,
      function () {
        // 贴图拿不到（多半是用 file:// 直接打开页面，本地文件被当成跨域资源）
        D.note("celestial", { texMissing: url });
        if (onFail) onFail();
      }
    );
  }

  /* file:// 兜底：把 js/textures-inline.js 按需插进来，用内联的 data URI 再试一次。
     （内联文件里是同一批贴图的 base64 副本，正常用服务器打开时根本不会加载它。） */
  var inlineWaiters = null;

  function loadInline(key, onOk) {
    var map = window.__TEX_INLINE;
    if (map && map[key]) {
      loadTexture(map[key], onOk);
      return;
    }
    if (inlineWaiters) {
      inlineWaiters.push({ key: key, onOk: onOk });
      return;
    }
    inlineWaiters = [{ key: key, onOk: onOk }];
    var host = document.head || document.body;
    if (!host) return;
    var s = document.createElement("script");
    s.src = "js/textures-inline.js";
    s.onload = function () {
      var q = inlineWaiters;
      inlineWaiters = null;
      var m = window.__TEX_INLINE || {};
      for (var i = 0; i < q.length; i++) {
        if (m[q[i].key]) loadTexture(m[q[i].key], q[i].onOk);
        else D.note("celestial", { texInlineMissing: q[i].key });
      }
    };
    s.onerror = function () {
      var q = inlineWaiters || [];
      inlineWaiters = null;
      for (var i = 0; i < q.length; i++) D.note("celestial", { texInlineMissing: q[i].key });
    };
    host.appendChild(s);
  }

  /* 反照率亮度 → 高度：亮的是高地、暗的是月海；顺手做一次 3×3 模糊，
     免得贴图噪点被当成起伏（Uint8ClampedArray 会自动夹到 0~255）。 */
  function heightFromImage(img, W, H) {
    var c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    var g = c.getContext("2d");
    g.drawImage(img, 0, 0, W, H);
    var d = g.getImageData(0, 0, W, H);
    var a = d.data;
    var lum = new Uint8ClampedArray(W * H);
    for (var i = 0, p = 0; i < a.length; i += 4, p++) {
      lum[p] = ((0.30 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2] - 66) / (232 - 66)) * 255;
    }
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var s = 0;
        var n = 0;
        for (var dy = -1; dy <= 1; dy++) {
          var yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (var dx = -1; dx <= 1; dx++) {
            var xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            s += lum[yy * W + xx];
            n++;
          }
        }
        var q = (y * W + x) * 4;
        var v = s / n;
        a[q] = v;
        a[q + 1] = v;
        a[q + 2] = v;
        a[q + 3] = 255;
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    var canvas = document.getElementById("celestialCanvas");
    var card = document.getElementById("celestial");
    if (!canvas || !card) throw new Error("找不到太阳/月亮模块的节点");

    var labelEl = document.getElementById("celestialLabel");
    var metaEl = document.getElementById("celestialMeta");
    var toggleEl = document.getElementById("celestialToggle");
    var fallbackEl = document.getElementById("celestialFallback");

    var STATE = {
      sun: { label: "太阳 · 自转中", meta: "NASA SDO/HMI 日面影像 · 自转一周约 25 天", toggle: "点击切换" },
      moon: { label: "月亮 · 同步自转", meta: "NASA LRO 月面反照率图 · 平均距地 384,400 km", toggle: "点击切回" },
    };

    var body = "sun";
    var switches = 0;
    var trans = null;

    function paintLabels() {
      var s = STATE[body];
      if (labelEl) labelEl.textContent = s.label;
      if (metaEl) metaEl.textContent = s.meta;
      if (toggleEl) toggleEl.textContent = s.toggle;
      card.classList.toggle("is-sun", body === "sun");
      card.classList.toggle("is-moon", body === "moon");
      D.note("celestial", { body: body, switches: switches });
    }

    var THREE = window.THREE;
    var renderer = null;
    if (THREE) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      } catch (e) {
        D.err("celestial.webgl", e);
        renderer = null;
      }
    } else {
      D.err("celestial.three", new Error("three.min.js 没加载出来"));
    }

    if (!renderer) {
      // 降级：CSS 画的星球，切换依然有效
      if (fallbackEl) fallbackEl.hidden = false;
      canvas.style.display = "none";
      card.addEventListener("click", function () {
        body = body === "sun" ? "moon" : "sun";
        switches++;
        paintLabels();
      });
      paintLabels();
      D.note("celestial", { mode: "fallback" });
      return;
    }

    /* ---- 场景 ---- */
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 3.15);

    var sunGroup = new THREE.Group();
    var moonGroup = new THREE.Group();
    scene.add(sunGroup);
    scene.add(moonGroup);
    // 贴图中心是月球正面（u=0.5）：先把球体转 -90°，让「正脸」朝向镜头
    moonGroup.rotation.y = -Math.PI / 2;

    /* ---- 太阳 ---- */
    var sunMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uAlbedo: { value: new THREE.CanvasTexture(onePixel("#f3b95c")) },
        uUseTex: { value: 0 },
      },
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG,
      transparent: true,
    });
    var sunMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), sunMat);
    sunGroup.add(sunMesh);

    // 真实日面（NASA SDO/HMI）：加载成功就切到贴图路径，失败则继续用程序化表面
    function applySunTex(tex) {
      sunMat.uniforms.uAlbedo.value = tex;
      sunMat.uniforms.uUseTex.value = 1;
      D.note("celestial", { sunTex: "textures/sun-albedo.jpg" });
    }
    loadTexture("textures/sun-albedo.jpg", applySunTex, function () {
      loadInline("sun", applySunTex); // file:// 兜底
    });

    var sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(
          glowTexture([
            [0, "rgba(255,244,205,0.95)"],
            [0.16, "rgba(255,196,96,0.55)"],
            [0.40, "rgba(255,124,32,0.20)"],
            [0.72, "rgba(255,72,10,0.05)"],
            [1, "rgba(255,60,0,0)"],
          ])
        ),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.95,
      })
    );
    sunGlow.scale.set(3.9, 3.9, 1);
    sunGroup.add(sunGlow);

    /* ---- 月亮 ---- */
    var maps = makeMoonMaps();
    var albedoTex = new THREE.CanvasTexture(maps.albedo);
    var heightTex = new THREE.CanvasTexture(maps.height);
    var moonMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uBump: { value: 1.5 },
        uLight: { value: new THREE.Vector3(-0.62, 0.42, 0.72).normalize() },
        uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
        uAlbedo: { value: albedoTex },
        uHeight: { value: heightTex },
      },
      vertexShader: MOON_VERT,
      fragmentShader: MOON_FRAG,
      transparent: true,
    });
    var moonMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 54), moonMat);
    moonMesh.visible = false;
    moonGroup.add(moonMesh);

    // 真实月面（NASA LRO）：反照率贴图 + 现场按亮度派生的高度图
    function applyMoonTex(tex) {
      var hCanvas = heightFromImage(tex.image, 1024, 512);
      moonMat.uniforms.uAlbedo.value = tex;
      moonMat.uniforms.uHeight.value = new THREE.CanvasTexture(hCanvas);
      moonMat.uniforms.uTexel.value.set(1 / 1024, 1 / 512);
      moonMat.uniforms.uBump.value = 1.0;
      D.note("celestial", { moonTex: "textures/moon-albedo.jpg" });
    }
    loadTexture("textures/moon-albedo.jpg", applyMoonTex, function () {
      loadInline("moon", applyMoonTex); // file:// 兜底
    });

    var moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(
          glowTexture([
            [0, "rgba(198,214,255,0.42)"],
            [0.35, "rgba(150,180,255,0.14)"],
            [1, "rgba(120,160,255,0)"],
          ])
        ),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.22,
      })
    );
    moonGlow.scale.set(2.7, 2.7, 1);
    moonGlow.visible = false;
    moonGroup.add(moonGlow);

    /* 切换瞬间的一次闪光 */
    var flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(
          glowTexture([
            [0, "rgba(255,255,255,0.9)"],
            [0.4, "rgba(200,225,255,0.25)"],
            [1, "rgba(180,210,255,0)"],
          ])
        ),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      })
    );
    flash.scale.set(2.2, 2.2, 1);
    scene.add(flash);
    var flashT = -1;

    /* ---- 日珥弧环（锚在太阳表面，跟着一起自转） ---- */
    var arcs = [];
    var ARC_COUNT = 7;

    function randomDir() {
      var u = (Math.random() * 2 - 1) * 0.78; // 偏向中低纬
      var th = Math.random() * Math.PI * 2;
      var s = Math.sqrt(Math.max(0, 1 - u * u));
      return new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
    }

    function tangentOf(n) {
      var helper = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      return new THREE.Vector3().crossVectors(n, helper).normalize();
    }

    function makeArc() {
      var mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.8 }, uSeed: { value: Math.random() * 10 } },
        vertexShader: PROM_VERT,
        fragmentShader: PROM_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      var arc = {
        alpha: 0.22 + Math.random() * 0.26,
        mesh: null,
        mat: mat,
        phase: Math.random() * 6.28,
        speed: 0.8 + Math.random() * 0.9,
        life: 3 + Math.random() * 6,
        n: null,
        scaleBase: 0.9 + Math.random() * 0.3,
      };
      var a = R * Math.sin(arc.alpha);
      var geo = new THREE.TorusGeometry(a, R * (0.014 + Math.random() * 0.016), 8, 44, Math.PI);
      arc.mesh = new THREE.Mesh(geo, mat);
      arc.mesh.frustumCulled = false;
      sunGroup.add(arc.mesh);
      respawnArc(arc);
      arcs.push(arc);
      return arc;
    }

    function respawnArc(arc) {
      // 弧心到球心距离，保证两端正好落在球面上
      var d = R * Math.cos(arc.alpha);
      var n = randomDir();
      var t = tangentOf(n);
      var b = new THREE.Vector3().crossVectors(n, t).normalize();
      var basis = new THREE.Matrix4().makeBasis(t, n, b);
      arc.mesh.quaternion.setFromRotationMatrix(basis);
      arc.mesh.position.copy(n.clone().multiplyScalar(d));
      arc.n = n;
      arc.life = 3.5 + Math.random() * 7;
    }

    for (var ai = 0; ai < ARC_COUNT; ai++) makeArc();

    /* ---- 日珥抛射粒子 ---- */
    var PCOUNT = 96;
    var pPos = new Float32Array(PCOUNT * 3);
    var pVel = new Float32Array(PCOUNT * 3);
    var pLife = new Float32Array(PCOUNT);
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({
      size: 0.045,
      sizeAttenuation: true,
      color: 0xffb162,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    sunGroup.add(points);
    var pCursor = 0;
    var nextErupt = 9;

    function erupt() {
      // 抛射点选在朝向相机的「边缘」附近，看起来像从日面边缘喷出
      var camLocal = sunGroup.worldToLocal(camera.position.clone()).normalize();
      var n = randomDir();
      n.sub(camLocal.clone().multiplyScalar(n.dot(camLocal))).normalize();
      if (n.lengthSq() < 0.5) n = tangentOf(camLocal);
      var burst = 22 + Math.floor(Math.random() * 16);
      for (var i = 0; i < burst; i++) {
        var idx = pCursor;
        pCursor = (pCursor + 1) % PCOUNT;
        var spread = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
        var jitter = spread
          .clone()
          .multiplyScalar((Math.random() * 2 - 1) * 0.5)
          .add(n.clone().multiplyScalar(0.15 * Math.random()));
        var dir = n.clone().add(jitter).normalize();
        pPos[idx * 3] = dir.x * R * 0.99;
        pPos[idx * 3 + 1] = dir.y * R * 0.99;
        pPos[idx * 3 + 2] = dir.z * R * 0.99;
        var sp = 0.22 + Math.random() * 0.55;
        pVel[idx * 3] = dir.x * sp;
        pVel[idx * 3 + 1] = dir.y * sp;
        pVel[idx * 3 + 2] = dir.z * sp;
        pLife[idx] = 1.1 + Math.random() * 1.3;
      }
      D.note("celestial", { eruptions: (D.modules.celestial ? D.modules.celestial.eruptions || 0 : 0) + 1 });
    }

    /* ---- 尺寸与画质 ---- */
    function resize() {
      var w = canvas.clientWidth || 320;
      var h = canvas.clientHeight || 230;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      D.note("celestial", { width: w, height: h });
    }
    resize();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        resize();
      });
      ro.observe(canvas.parentNode || canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    /* ---- 切换：太阳 ⇄ 月亮 ---- */
    function setOpacity(group, v) {
      if (group === sunGroup) {
        sunMat.uniforms.uOpacity.value = v;
        sunGlow.material.opacity = 0.95 * v;
        for (var i = 0; i < arcs.length; i++) arcs[i].mat.uniforms.uOpacity.value = 0.85 * v;
        pMat.opacity = 0.92 * v;
        sunMesh.visible = v > 0.02;
        sunGlow.visible = v > 0.02;
        points.visible = v > 0.02;
        for (var j = 0; j < arcs.length; j++) arcs[j].mesh.visible = v > 0.02;
      } else {
        moonMat.uniforms.uOpacity.value = v;
        moonGlow.material.opacity = 0.22 * v;
        moonMesh.visible = v > 0.02;
        moonGlow.visible = v > 0.02;
      }
    }

    function setScale(group, s) {
      sunGroup.scale.setScalar(s);
      moonGroup.scale.setScalar(s);
    }

    function toggle() {
      body = body === "sun" ? "moon" : "sun";
      switches++;
      trans = 0;
      flashT = 0;
      paintLabels();
    }

    card.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".card-label")) return; // 别把标签上的点击当切换
      toggle();
    });


    /* ---- 交互：轻微视差 ---- */
    var par = { x: 0, y: 0, tx: 0, ty: 0 };
    canvas.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      par.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.55;
      par.ty = ((e.clientY - r.top) / r.height - 0.5) * -0.42;
    });
    canvas.addEventListener("pointerleave", function () {
      par.tx = 0;
      par.ty = 0;
    });

    /* ---- 主循环 ---- */
    var visible = true;
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
        },
        { threshold: 0.05 }
      );
      io.observe(canvas);
    }

    var t = 0;
    var frames = 0;
    var slowFrames = 0;
    var lastT = performance.now();
    var degraded = false;
    var elapsed = 0;

    function loop(now) {
      window.requestAnimationFrame(loop);
      var dt = (now - lastT) / 1000;
      lastT = now;
      if (dt > 0.25) dt = 0.25;
      if (document.hidden || !visible) return;

      elapsed += dt;
      t += dt;

      // 自转
      sunGroup.rotation.y += dt * 0.075;
      moonGroup.rotation.y += dt * 0.02;

      // 太阳表面动画
      sunMat.uniforms.uTime.value = t;

      // 日珥
      var sunOn = sunMat.uniforms.uOpacity.value;
      for (var i = 0; i < arcs.length; i++) {
        var arc = arcs[i];
        arc.life -= dt;
        if (arc.life <= 0) respawnArc(arc);
        var ph = t * arc.speed + arc.phase;
        var grow = Math.min(1, (4 - Math.min(arc.life, 4)) * 1.6 + 0.25);
        arc.mat.uniforms.uTime.value = t;
        arc.mat.uniforms.uOpacity.value = (0.55 + 0.3 * (0.5 + 0.5 * Math.sin(ph))) * sunOn * grow;
        arc.mesh.scale.setScalar(arc.scaleBase * (1 + 0.04 * Math.sin(ph)));
      }

      // 日珥抛射
      nextErupt -= dt;
      if (nextErupt <= 0) {
        erupt();
        nextErupt = 16 + Math.random() * 14;
      }
      var dirty = false;
      for (var pi = 0; pi < PCOUNT; pi++) {
        if (pLife[pi] <= 0) continue;
        dirty = true;
        pLife[pi] -= dt;
        var drag = 1 - Math.min(0.85, dt * 0.55);
        pVel[pi * 3] *= drag;
        pVel[pi * 3 + 1] *= drag;
        pVel[pi * 3 + 2] *= drag;
        pPos[pi * 3] += pVel[pi * 3] * dt;
        pPos[pi * 3 + 1] += pVel[pi * 3 + 1] * dt;
        pPos[pi * 3 + 2] += pVel[pi * 3 + 2] * dt;
        if (pLife[pi] <= 0) {
          pPos[pi * 3] = 0;
          pPos[pi * 3 + 1] = 0;
          pPos[pi * 3 + 2] = 0;
        }
      }
      if (dirty) pGeo.attributes.position.needsUpdate = true;

      // 切换动画：0~0.5 旧的天体淡出缩小，0.5~1 新的天体淡入放大
      if (trans !== null) {
        trans = Math.min(1, trans + dt / 0.72);
        var k = trans;
        if (k < 0.5) {
          var a = 1 - k / 0.5;
          setOpacity(sunGroup, body === "sun" ? a : 0);
          setOpacity(moonGroup, body === "moon" ? a : 0);
          setScale(null, 1 - 0.16 * (1 - a));
          if (body === "moon") {
            moonMesh.visible = false;
            moonGlow.visible = false;
          }
        } else {
          var b = (k - 0.5) / 0.5;
          setOpacity(sunGroup, body === "sun" ? b : 0);
          setOpacity(moonGroup, body === "moon" ? b : 0);
          if (body === "sun") {
            moonMesh.visible = false;
            moonGlow.visible = false;
          }
          setScale(null, 0.84 + 0.16 * b);
        }
        if (k >= 1) {
          trans = null;
          setOpacity(sunGroup, body === "sun" ? 1 : 0);
          setOpacity(moonGroup, body === "moon" ? 1 : 0);
          setScale(null, 1);
          D.note("celestial", { switches: switches, body: body, mode: "webgl" });
        }
      }

      // 闪光
      if (flashT >= 0) {
        flashT += dt;
        var fk = flashT / 0.5;
        if (fk >= 1) {
          flashT = -1;
          flash.material.opacity = 0;
        } else {
          flash.material.opacity = Math.sin(fk * Math.PI) * 0.4;
          flash.scale.setScalar(1.8 + fk * 1.6);
        }
      }

      // 视差
      par.x += (par.tx - par.x) * Math.min(1, dt * 3);
      par.y += (par.ty - par.y) * Math.min(1, dt * 3);
      camera.position.x = par.x;
      camera.position.y = par.y;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);

      // 掉帧就降一档分辨率（只降一次）
      frames++;
      if (frames > 60) {
        var ms = (now - lastT) / 1;
        if (ms > 0 && dt > 1 / 32) slowFrames++;
        if (!degraded && slowFrames > 45) {
          degraded = true;
          renderer.setPixelRatio(1);
          resize();
          D.note("celestial", { quality: "degraded" });
        }
      }
      D.note("celestial", { mode: "webgl", body: body, arcs: arcs.length, elapsed: Number(elapsed.toFixed(1)) });
    }

    setOpacity(sunGroup, 1);
    setOpacity(moonGroup, 0);
    moonMesh.visible = false;
    moonGlow.visible = false;
    setScale(null, 1);
    paintLabels();
    window.requestAnimationFrame(loop);

    D.note("celestial", {
      mode: "webgl",
      body: "sun",
      bumps: moonMat.uniforms.uBump.value,
      moonMap: "1024x512",
      textures: "textures/ (NASA LRO / SDO)",
    });
  }

  window.SunMoon = { init: init, makeMoonMaps: makeMoonMaps, heightFromImage: heightFromImage };
})();
