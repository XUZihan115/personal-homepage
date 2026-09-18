# 素材与许可 / Credits

本页所有资源都是本地文件，断网也能完整打开。下面写清楚每样东西的来源和处理方式。

## 天体贴图（2026-09 更新）

| 文件 | 来源 | 处理 |
| --- | --- | --- |
| `textures/moon-albedo.jpg` (2048×1024) | NASA / GSFC 科学可视化工作室（SVS），LRO 广角相机（WAC）全球彩色反照率图 `lroc_color_poles_4k.tif`（4096×2048） | 等比缩到 2048×1024 并转成 JPEG；图中 u=0.5 处是月球正面，所以渲染时把球体旋转 -90° 让「正脸」朝向镜头 |
| `textures/sun-albedo.jpg` (1024×512) | NASA / SDO，HMI 连续谱强度图 `latest_2048_HMIIC.jpg` | 单张图只覆盖约 180°：先按临边昏暗反演亮度（中心增益 1.00 → 边缘 2.40，7 档滑动平均，整体归一到 176），再镜像拼接成 360° 等距圆柱贴图 |

- 月球 **凹凸/高度图不额外下载**：浏览器加载完反照率贴图后，用它的亮度现场派生（亮 = 高地，暗 = 月海，再做一次 3×3 模糊去掉噪点），所以不会再多出几百 KB 的贴图文件。
- `js/textures-inline.js` 是上面两张贴图的 **base64 内联副本**（太阳 1024×512、月亮 1024×512）。只有在你**直接双击 index.html**（file:// 协议，浏览器会拦下本地跨域图片）时才会被自动加载，用来兜底；用本地服务器打开时不会加载它，走的是 `textures/` 里的高清原图。
- NASA 的图片素材一般是公有领域（public domain），可以自由使用与再分发；Solar System Scope 那一版（CC BY 4.0）因为站点返回 403，最终没有采用。
- 页面里卡片上标注的「NASA SDO/HMI 日面影像」「NASA LRO 月面反照率图」就是给这两张贴图的署名。

## 画作（「联想一下」的背景图，共 17 幅）

点左上角「联想一下」时，从当前天色那一组里**随机**取一幅铺满整屏，右下角标出作品名和作者；
再点一次（或按 Esc / 点「归位」）退出。太阳组 11 幅、月亮组 6 幅，每组内部「随机但不连着两次给同一幅」。

**只收横版（宽 > 高）。** 竖版画铺满 16:9 的屏幕时，`cover` 会把它等比放大到只看得见中间一条，
观感像一张糊掉的特写截图（米勒《播种者》900×1166 就是这样），所以那批已经下架；
文件仍留在 `assets/` 里没有删，想恢复只要把条目加回 `js/mood.js` 的 `GALLERY` 即可。

另一条更硬的标准：太阳组得**真画着太阳**、月亮组得**真画着月亮**，而且是画面的看头。
只是「有日光 / 有月色」的山水不收 —— 据此下架了 8 幅中国画，以及卢梭《沉睡的吉普赛人》
（满月缩在右上角，主体是睡着的吉普赛人，并不是月亮）。全部下架作品见文末清单。

2026-09 又按要求调整过一轮：太阳组移出了透纳《被拖去解体的战舰无畏号》，月亮组的
弗里德里希《海边的月出》改挂到太阳组，另外补进 5 张 NASA 的照片（太阳组 3 张国际空间站的
轨道日出，月亮组 2 张阿波罗登月与「地出」）。NASA 那几张原作是方画幅，为了凑横版
**裁掉了上下多余的黑天空 / 月面** —— 这是全站唯一的裁剪操作，其余画作依旧只做等比缩放 + JPEG 重编码。

### 太阳组（11 幅）

| 文件 | 作品 | 来源 | 处理 |
| --- | --- | --- | --- |
| `assets/monet-impression-sunrise.jpg` (1920×1490) | 克劳德·莫奈《日出·印象》(1872) | [Impression, Sunrise](https://www.wikiart.org/en/claude-monet/impression-sunrise)（WikiArt，原图 5773×4478） | 等比缩到宽 1920 + JPEG 重编码 |
| `assets/moon-friedrich-moonrise-over-sea.jpg` (1920×1468) | 弗里德里希《海边的月出》(1822) | [Moonrise by the Sea](https://www.wikiart.org/en/caspar-david-friedrich/moonrise-by-the-sea-1822)（WikiArt，3543×2710） | 同上（原先挂在月亮组，按要求改挂太阳组，文件名沿用 `moon-` 前缀） |
| `assets/sun-nasa-iss-sunrise-namibia.jpg` (1920×1078) | 国际空间站上的轨道日出 · 纳米比亚上空 | [iss072e487315](https://images.nasa.gov/details/iss072e487315)（NASA 图像库） | 等比缩到宽 1920 + JPEG 重编码 |
| `assets/sun-nasa-iss-sunrise-atmosphere.jpg` (1920×1078) | 轨道日出 · 照亮地球大气边缘 | [iss071e439624](https://images.nasa.gov/details/iss071e439624)（NASA 图像库） | 同上 |
| `assets/sun-nasa-iss-sunrise-window.jpg` (1920×1280) | 舷窗外的轨道日出 | [iss073e0299808](https://images.nasa.gov/details/iss073e0299808)（NASA 图像库） | 同上 |
| `assets/sun-monet-poppies.jpg` (1800×1342) | 莫奈《阿让特伊的罂粟花田》(1873) | [Field of Poppies](https://www.wikiart.org/en/claude-monet/field-of-poppies-1873)（1800×1341） | 同上（原图不足 1920，未放大） |
| `assets/sun-munch-the-sun.jpg` (1727×986) | 爱德华·蒙克《太阳》(1916) | [The Sun](https://www.wikiart.org/en/edvard-munch/the-sun-1916)（1727×985） | 同上（未放大） |
| `assets/sun-shishkin-morning-pine-forest.jpg` (1600×1084) | 希什金《松林的早晨》(1889) | [Morning in a Pine Forest](https://www.wikiart.org/en/ivan-shishkin/morning-in-a-pine-forest-1889)（1600×1084） | 同上（未放大） |
| `assets/sun-levitan-golden-autumn.jpg` (1280×762) | 列维坦《金色的秋天》(1889) | [Golden Autumn](https://www.wikiart.org/en/isaac-levitan/golden-autumn-village-1889)（1280×761） | 同上（未放大） |
| `assets/sun-monet-haystacks-sunset.jpg` (1280×918) | 莫奈《干草堆·日落》(1891) | [Haystacks at Sunset…](https://www.wikiart.org/en/claude-monet/haystacks-at-sunset-frosty-weather-1891)（1280×918） | 同上（未放大） |
| `assets/sun-constable-hay-wain.jpg` (1228×856) | 康斯特勃《干草车》(1821) | [The Hay Wain](https://www.wikiart.org/en/john-constable/the-hay-wain-1821)（1228×856） | 同上（未放大） |

### 月亮组（6 幅）

| 文件 | 作品 | 来源 | 处理 |
| --- | --- | --- | --- |
| `assets/van-gogh-starry-night.jpg` (1920×1530) | 梵高《星空》(1889) | [The Starry Night](https://www.wikiart.org/en/vincent-van-gogh/the-starry-night-1889)（WikiArt，2000×1594） | 等比缩到宽 1920 + JPEG 重编码 |
| `assets/moon-van-gogh-starry-night-rhone.jpg` (1920×1488) | 梵高《罗纳河上的星夜》(1888) | [Starry Night Over the Rhone](https://www.wikiart.org/en/vincent-van-gogh/the-starry-night-1888-2)（5407×4191） | 同上 |
| `assets/moon-turner-keelmen-moonlight.jpg` (1920×1406) | 透纳《月光下装煤的平底船》(1835) | [Keelmen Heaving in Coals by Night](https://www.wikiart.org/en/william-turner/keelmen-heaving-in-coals-by-night)（2674×1959） | 同上 |
| `assets/moon-kuindzhi-moonlit-night-dnieper.jpg` (1920×1394) | 库因芝《第聂伯河上的月夜》(1880) | [Moonlight Night on the Dnieper](https://www.wikiart.org/en/arkhip-kuindzhi/moonlight-night-on-the-dnieper-1880)（2400×1742） | 等比缩到宽 1920 + JPEG 重编码，并**提亮**：`eq=gamma=1.50:brightness=0.02:contrast=1.08:saturation=1.18` |
| `assets/moon-nasa-apollo11-aldrin.jpg` (1920×1280) | 阿波罗 11 号：月面上的奥尔德林 (1969) | [as11-40-5874](https://images.nasa.gov/details/as11-40-5874)（NASA 图像库，摄影：尼尔·阿姆斯特朗） | 原图 3922×3882（哈苏方画幅），**裁掉上下**取 3922×2615，再缩到 1920×1280 + JPEG 重编码 |
| `assets/moon-nasa-earthrise.jpg` (1920×1280) | 「地出」：从月球回望地球 (1968) | [as08-14-2383](https://images.nasa.gov/details/as08-14-2383)（NASA 图像库，摄影：威廉·安德斯） | 原图 3000×3000，**裁掉上部黑天空、保住地球与月面地平线**（取 3000×2000），再缩到 1920×1280 + JPEG 重编码 |

- 画作都是 19 世纪及更早的作品，早已进入**公有领域**（public domain）；NASA 的照片同样属于公有领域
  （NASA 素材一般不受版权保护），都可以自由使用与再分发。
- 「处理」一栏就是对作品的**修改说明**：只有库因芝那一幅做过提亮（它本身极暗，不提亮在屏幕上几乎全黑），
  以及 5 张 NASA 照片按需要裁掉了上下的黑天空 / 月面（方画幅要凑横版）；
  其余一律只做等比缩放 + JPEG 重编码，**没有裁剪、没有改色**。
- 有 6 幅原图宽度本来就不到 1920，**保持原尺寸、没有放大**，投到大屏上会略糊一点；
  其中最小的是康斯特勃（1228px）。要更清晰只能换更清楚的源文件。
- WikiArt / NASA 图像库只作**出处标注**，页面不引任何外链，图片全是本地文件，断网也能看。

### 已下架的 17 幅

下面这些文件还在 `assets/` 里，但 `js/mood.js` 的 `GALLERY` 已经不再引用它们，页面上不会出现：

**① 竖版，铺满 16:9 会糊成一张特写截图（5 幅）**

| 文件 | 作品 | 下架原因 |
| --- | --- | --- |
| `assets/sun-millet-the-sower.jpg` (900×1166) | 米勒《播种者》(1850) | 竖版 |
| `assets/moon-whistler-falling-rocket.jpg` (1920×2554) | 惠斯勒《夜曲：黑与金——坠落的烟火》(1875) | 竖版 |
| `assets/moon-van-gogh-cafe-terrace-night.jpg` (1761×2236) | 梵高《夜间的露天咖啡座》(1888) | 竖版 |
| `assets/moon-munch-starry-night.jpg` (1419×1692) | 爱德华·蒙克《星夜》(1924) | 竖版 |
| `assets/moon-grimshaw-moonlight.jpg` (724×880) | 格里姆肖《十一月的月光》 | 竖版，且原图只有 724px |

**② 主体不是太阳 / 月亮，只是「有日光 / 有月色」（11 幅）**

| 文件 | 作品 | 下架原因 |
| --- | --- | --- |
| `assets/moon-rousseau-sleeping-gypsy.jpg` (1920×1226) | 亨利·卢梭《沉睡的吉普赛人》(1897) | 满月缩在右上角，画面的看头是睡着的吉普赛人 —— 后来也确认为**不要这一幅** |
| `assets/sun-turner-fighting-temeraire.jpg` (1920×1428) | 透纳《被拖去解体的战舰无畏号》(1839) | 按要求移出太阳组：看头是战舰与落日余晖，不是太阳 |
| `assets/sun-van-gogh-the-sower.jpg` (1920×1532) | 梵高《播种者》(1888) | 看头是播种的人和大片夕阳，不是太阳 |
| `assets/sun-gong-xian-water-country.jpg` (1920×1488) | 龚贤《水乡清夏图》(1670s) | 山水，看头不是太阳 |
| `assets/sun-shen-zhou-tiger-hill-clouds.jpg` (1920×1418) | 沈周《虎丘十二景图》册页之一（约 1490 后） | 同上 |
| `assets/sun-wang-meng-pine-study.jpg` (1920×1350) | 王蒙《松下著书图》(约 1308–85) | 同上 |
| `assets/sun-zha-shibiao-autumn-travel.jpg` (1920×1438) | 查士标《四季山水图册》之「秋山行旅」(1684) | 同上 |
| `assets/moon-kuncan-spring-landscape.jpg` (1920×906) | 髡残《春景山水》(1666) | 山水，看头不是月亮 |
| `assets/moon-li-anzhong-misty-village.jpg` (1920×1738) | 李安忠《烟村秋霭图》(1117) | 同上（画面也偏方，宽高比只有 1.10） |
| `assets/moon-sheng-mou-spring-mountains.jpg` (1920×712) | 盛懋《春山访友》(1300年代) | 同上 |
| `assets/moon-yuan-yao-shu-road.jpg` (1920×1414) | 袁耀《蜀栈行旅图》(1743) | 同上 |

- 中国画这 8 幅来自**克利夫兰艺术博物馆**（clevelandart.org）的开放素材（CC0），下载后同样只做等比缩放 + JPEG 重编码。

**③ 备用，没用上（1 幅）**

`assets/moon-whistler-nocturne-battersea.jpg`（惠斯勒《夜曲：蓝色与金色——老巴特西桥》，1920×2614）
既是竖版，画面又偏淡、不出现月亮。

### 右下角的署名

画面的右下角会写出**作品名 + 作者 + 年份**，跟画一起淡入 —— 例如「日出·印象 / 克劳德·莫奈 · 1872」。

- 这三个字段就是 `js/mood.js` 里每组画作条目的 `title` / `artist` / `year`，和上表「作品」一栏同一份信息。
- 用的是站内同一个衬线字体（`--serif`）：作品名大一号，作者小一号并降低不透明度。
- 画面底部压了一层自下而上的渐暗（`.painting-veil`），保证深色画面上的白字也读得清。

## 联系页的猫（`assets/cat-peek.jpg`）

| 文件 | 来源 | 处理 |
| --- | --- | --- |
| `assets/cat-peek.jpg` (512×768) | 本人提供 | 无，原图直接用 |

- 放在联系页最下面当装饰，和别处的素材无关，也不引任何外链。
- 桌面上显示 190px 宽、窄屏 148px；只是张静态图，点它不会发生什么。

## 字体

- **Playfair Display**（`fonts/playfair-display-latin-500-600.woff2`、`fonts/playfair-display-latin-italic-500.woff2`）
  以 SIL Open Font License 1.1 发布，允许免费使用与再分发。

## 汉字笔顺数据

- `js/hanzi.js` 里的笔顺来自 **hanzi-writer-data@2.0.1**（MIT License，chanind/hanzi-writer-data），
  只内嵌了「徐 / 子 / 涵」三个字，坐标系为 1024×1024、原点在左下角。
- 该文件由 `.deepworks/tmp/build-hanzi.js` 生成，不要手改。

## 运行时库

- **three.js r151**（MIT License），本地 `js/three.min.js`，仅用于太阳/月亮那张卡片的 WebGL 渲染。

## 设计与参考

- 整体版式（三列卡片、拖拽摆放、左上角归位）参考课程演示视频给出的样子。
- 交互与排版思路参考了 zyyo.net 这类个人主页的常见做法，**没有复制其代码、图片或音频**。

## 音频

- 歌库是**随站点一起发布**的：音频文件放在 `audio/` 目录，清单由 `tools/scan-audio.js`
  扫描生成到 `audio/library.js`；首页那张音乐卡和「歌库」页读的是同一份清单，
  所以每个访客打开页面看到的都是同一份歌单。加歌的完整步骤见 `audio/README.txt`。
- 本仓库目前**没有放任何歌曲**，歌库页因此显示「歌库还空着」。
  把 mp3 放进 `audio/`、跑一次扫描脚本、连同文件一起推送，所有访客就都能听到。
- 在页面上把本地音频**拖进音乐卡**只在自己这台电脑上有效：页面给本地文件生成的是
  本机临时地址（`blob:`），不会上传、也传不出去，仅用于自己试听。
- 进页面时右上角会问一句「想不想来点音乐？」，点「来一首」从歌库里**随机挑一首**；
  歌库空着就什么都不放。点「不用了」则一声都不会出。
- 播放完全发生在浏览器里，不经过任何后端；页面也不会自动播放（浏览器自动播放策略会拦）。
- **版权**：请只放自己有权利公开分享的音频。把商业歌曲的完整音频传到公开站点属于侵权风险；
  另外音频体积大，GitHub Pages 建议仓库 ≤ 1GB、月流量 ≤ 100GB。

## 怎么打开

1. **本地服务器（推荐，贴图用 2048×1024 高清原图）**：在 `personal-homepage` 目录下起个静态服务，
   例如 `python -m http.server 5210` 或 `npx serve -l 5210`，然后访问 `http://127.0.0.1:5210/`。
2. **直接双击 `index.html`**：页面功能同样完整，太阳/月亮会自动改用 `js/textures-inline.js` 里的
   内联贴图（1024×512），画质略低一点但不会退化回程序化表面。
3. 放到 GitHub Pages 之类的静态托管上，等价于方式 1。
