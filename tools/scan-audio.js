/* scan-audio.js —— 扫描 audio/ 目录，重新生成 audio/library.js 清单
 *
 * 用法：
 *   node tools/scan-audio.js
 *   node tools/scan-audio.js --dir audio --out audio/library.js
 *   node tools/scan-audio.js --dry          只打印，不写文件
 *
 * 干的事：
 *   1. 列出 audio/ 里的音频文件（mp3 / m4a / aac / ogg / opus / wav / flac / wma）；
 *   2. 用 ffprobe 读时长和标签（artist / title），没标签就按文件名「歌手 - 歌名」拆；
 *   3. 按「歌手 + 歌名」排序后写成 window.AUDIO_LIBRARY = [ { title, artist, src, dur } ]。
 *
 * 显示名有误怎么办（下载来的歌常见）：
 *   标签乱码、或者文件名把歌手和歌名写反了的时候，别去改音频文件，
 *   在同目录下建一个 overrides.json，键是文件名、值是 { artist, title } 即可，
 *   只覆盖清单里显示的名字，音频本身一个字节都不动：
 *
 *     { "追光者 - 岑宁儿.mp3": { "artist": "岑宁儿", "title": "追光者" } }
 *
 * 优先级：overrides.json > 文件标签 > 文件名拆分。
 *
 * 输出文件用 UTF-8 无 BOM、行尾 LF，和仓库里其他文件一致。
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const EXTS = [".mp3", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".flac", ".wma"];
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { dir: path.join(ROOT, "audio"), out: null, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") out.dry = true;
    else if (a === "--dir") out.dir = path.resolve(argv[++i]);
    else if (a === "--out") out.out = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

/* ffprobe 在哪：环境变量 > 本机 deepworks 工具目录 > PATH */
function findFfprobe() {
  const cands = [
    process.env.FFPROBE,
    path.join(os.homedir(), ".deepworks", "tools", process.platform === "win32" ? "ffprobe.exe" : "ffprobe"),
    "ffprobe",
  ].filter(Boolean);
  for (const c of cands) {
    try {
      execFileSync(c, ["-version"], { stdio: "ignore" });
      return c;
    } catch (e) {
      /* 试下一个 */
    }
  }
  return null;
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function fmtDur(sec) {
  if (!isFinite(sec) || sec <= 0) return "";
  const t = Math.round(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? h + ":" + pad2(m) + ":" + pad2(s) : m + ":" + pad2(s);
}

/* "歌手 - 歌名" 拆两半；先认带空格的短横，再认连写的 */
function splitName(stem) {
  const spaced = stem.match(/^(.*?)\s+[-\u2013\u2014]\s+(.+)$/);
  if (spaced) return { artist: spaced[1].trim(), title: spaced[2].trim() };
  const tight = stem.match(/^(.*?)[-\u2013\u2014](.+)$/);
  if (tight) return { artist: tight[1].trim(), title: tight[2].trim() };
  return { artist: "", title: stem.trim() };
}

function probe(file, ffprobe) {
  let info = {};
  try {
    const raw = execFileSync(
      ffprobe,
      ["-v", "error", "-show_entries", "format=duration:format_tags=artist,title", "-of", "json", file],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
    );
    info = JSON.parse(raw);
  } catch (e) {
    return { dur: "", tagArtist: "", tagTitle: "", bad: true };
  }
  const fmt = info.format || {};
  const tags = fmt.tags || {};
  const pick = (obj, key) => {
    for (const k of Object.keys(obj)) if (k.toLowerCase() === key) return String(obj[k]).trim();
    return "";
  };
  return {
    dur: fmtDur(parseFloat(fmt.duration)),
    tagArtist: pick(tags, "artist"),
    tagTitle: pick(tags, "title"),
    bad: false,
  };
}

/* 可选的显示名纠正表：audio/overrides.json，键是文件名。
   有它就不必为了一个错名字去改用户的音频文件。 */
function loadOverrides(dir) {
  const p = path.join(dir, "overrides.json");
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("顶层应该是一个对象");
    // JSON 没法写注释，用 "_" 开头的键当注释用，不当成文件名
    const clean = {};
    for (const k of Object.keys(raw)) {
      if (k.charAt(0) === "_") continue;
      clean[k] = raw[k];
    }
    return clean;
  } catch (e) {
    console.error("overrides.json 读不了，这次先忽略它：" + e.message);
    return {};
  }
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) {
    console.log("用法: node tools/scan-audio.js [--dir audio] [--out audio/library.js] [--dry]");
    return;
  }

  const outFile = opt.out || path.join(opt.dir, "library.js");
  const overrides = loadOverrides(opt.dir);

  if (!fs.existsSync(opt.dir)) {
    console.error("找不到目录：" + opt.dir);
    process.exit(1);
  }

  const names = fs
    .readdirSync(opt.dir)
    .filter((n) => EXTS.indexOf(path.extname(n).toLowerCase()) >= 0)
    .sort();

  if (!names.length) {
    console.log("audio/ 里还没有音频文件（支持：" + EXTS.join(" ") + "）");
  }

  const ffprobe = names.length ? findFfprobe() : null;
  if (names.length && !ffprobe) {
    console.error("找不到 ffprobe。请装 ffmpeg，或设 FFPROBE 环境变量指向 ffprobe 可执行文件。");
    process.exit(1);
  }

  const rows = names.map((n) => {
    const full = path.join(opt.dir, n);
    const stem = path.basename(n, path.extname(n));
    const guess = splitName(stem);
    const p = probe(full, ffprobe);
    const src = path.relative(ROOT, full).split(path.sep).join("/");
    const ov = overrides[n];
    return {
      title: (ov && ov.title) || p.tagTitle || guess.title,
      artist: (ov && ov.artist) || p.tagArtist || guess.artist,
      src: src,
      dur: p.dur,
      bytes: fs.statSync(full).size,
      bad: p.bad,
      fixed: !!(ov && (ov.title || ov.artist)), // 名字是 overrides.json 纠正过来的
      risky: path.extname(n).toLowerCase() === ".wma", // 浏览器解不了 wma
    };
  });

  /* 排序：先歌手再歌名，用码点比较，结果稳定可复现 */
  rows.sort((a, b) => {
    if (a.artist !== b.artist) return a.artist < b.artist ? -1 : 1;
    if (a.title !== b.title) return a.title < b.title ? -1 : 1;
    return a.src < b.src ? -1 : a.src > b.src ? 1 : 0;
  });

  const body = rows
    .map((r) => "  { title: " + JSON.stringify(r.title) + ", artist: " + JSON.stringify(r.artist) +
      ", src: " + JSON.stringify(r.src) + ", dur: " + JSON.stringify(r.dur) + " },")
    .join("\n");

  const text =
    "/* audio/library.js —— 歌库清单（这是数据，不是逻辑）\n" +
    " *\n" +
    " * 这个文件由 tools/scan-audio.js 自动生成，不用手改：\n" +
    " * 把音频丢进 audio/ 目录，然后在项目根目录跑 `node tools/scan-audio.js` 重新扫一遍。\n" +
    " * 文件名写成「歌手 - 歌名.mp3」会自动拆分歌手和歌名，文件里有标签就优先用标签。\n" +
    " *\n" +
    " * 首页的音乐卡和「歌库」页读的都是这份清单。音频文件要跟着仓库一起提交、\n" +
    " * 一起发布，访客才听得到 —— 只把 mp3 拖进浏览器只在自己这台电脑上有效。\n" +
    " *\n" +
    " * 一首歌一行：{ title: \"曲名\", artist: \"歌手\", src: \"audio/文件名.mp3\", dur: \"3:42\" },\n" +
    " * 注意：除了这里的注释，别在花括号外写坏语法，否则整页音乐模块会起不来。\n" +
    " */\n" +
    "window.AUDIO_LIBRARY = [\n" +
    (body ? body + "\n" : "") +
    "];\n";

  if (!opt.dry) {
    fs.writeFileSync(outFile, text, { encoding: "utf8" });
  }

  let total = 0;
  console.log("");
  console.log("目录: " + opt.dir);
  console.log("ffprobe: " + (ffprobe || "(没用上)"));
  console.log("");
  rows.forEach((r, i) => {
    const no = pad2(i + 1);
    const kb = Math.round(r.bytes / 1024) + " KB";
    console.log(
      no + "  " + (r.artist || "(未知歌手)") + " - " + r.title +
      "   [" + (r.dur || "??") + "]  " + kb +
      (r.fixed ? "  <按 overrides.json 纠正过>" : "") +
      (r.bad ? "  <读不出时长>" : "") +
      (r.risky ? "  <浏览器放不了 wma，建议转成 mp3>" : "")
    );
  });
  console.log("");
  console.log("共 " + rows.length + " 首");
  if (rows.some((r) => r.risky)) {
    console.log("提示：wma 浏览器解不了码，那条会列在歌库里但点不动，建议先转成 mp3。");
  }
  const stale = Object.keys(overrides).filter((k) => names.indexOf(k) < 0);
  if (stale.length) {
    console.log("提示：overrides.json 里这几条没对上任何文件（是不是改过文件名？），可以删掉了：");
    stale.forEach((k) => console.log("  " + k));
  }
  if (!opt.dry) console.log("已写出: " + path.relative(ROOT, outFile).split(path.sep).join("/"));
  else console.log("(--dry，没有写文件)");
}

main();
