# 孤独的旅者 / A Lonely Voyager

入口：`voyager.html`，以及全站导航的 Voyager、首页 Explore、Starmap 侧栏。纯静态实现，不需要构建、CDN 脚本或第三方运行时。

## 体验

- 19 个精选节点：1997 年出发、两次金星借力、地球回望、木星、Phoebe、土星入轨、Huygens 分离与着陆、冰卫星、春分与延长任务、地球合影、冰羽、擦环、大结局、最后讯号，以及想象中的深空尾声。
- 时间线、地图和章节列表共用同一份数据。点击节点或方向键切换；自动远行每站停留 14 秒。手动选择、打开地图/札记、页面进入后台都会暂停自动远行。
- URL hash 可以分享某一站，例如 `voyager.html#saturn`、`voyager.html#enceladus`、`voyager.html#beyond`。浏览器前进/后退可用。
- 本地存储 `lonely-voyager-v1` 保存当前节点和真实访问过的节点；再次访问继续上次旅程。回到起点不清除足迹。存储不可用时仍可探索。
- 页面所有界面、诗句、事实、辅助说明与无障碍标签均为英语。Full scene 查看未裁切的完整画面；Just look up 隐藏界面，Escape 或返回按钮恢复。暂停动态冻结模拟时间；系统减少动态效果优先，自动漫游从不自行启动。
- 地图、札记使用原生 dialog，支持焦点约束、Escape 关闭与返回触发按钮。移动端地图可横向滚动，也可以直接使用下方章节列表。

## 当前视觉与渲染

页面采用用户认可的完整电影插画风格。**19 个节点各有一张完整场景原画**，人物、地形、星体和光照统一生成；前景观察点与天空目标分开配置。它们是艺术化的想象观景点，不是可实现的真实地表视线或任务摄影。

- 天空目标依次为 Earth → Venus → Venus → Earth → Jupiter → Phoebe → Saturn → Titan → Titan → Enceladus → Iapetus → Saturn → Saturn → Saturn’s eclipse → Enceladus → Saturn/rings → Saturn/ring gap → Saturn → deep nebula。卫星节点不再统一显示土星。
- 同一天体的不同节点使用独立原画，改变距离、相位、环的角度与地形。每幅图保留同一位长黑发中国女生，简化插画面部、浅蓝/香芋紫/薄荷绿的光滑宽松外套、米白裤子、FILA 厚底鞋、无背包。保留双手插兜站姿，在 7 站穿插倚石、垂腿坐、屈膝坐等自然休息姿势。
- 地貌包括月面陨坑、火山岩台地、Europa 风格冰原、碳质碎石、结霜山脊、冰裂缝、环月冰块及未知晶体世界。文字区分天空目标和想象中的观测地貌。
- `js/voyager-scene.js` 是完整原画的 **2.5D 动态呈现**：WebGL 实时采样画面，施加很轻的深度视差、缓慢推移和局部薄雾。不是完整三维几何仿真或逐像素物理模拟。人物已经融入每幅原画，不再叠加独立写实人物贴图。
- 独立 Canvas 层绘制少量冰粒和移动的 Cassini（复用 `js/cassini-art.js`）。Huygens 一站有小探测器分离；最后讯号一站 Cassini 逐渐消失；深空尾声不再出现飞船。
- 手机上主场景采用以人物为锚点的裁切；Full scene 对话框可以查看整幅未裁切画面。标题缩小且上移，正文诗句完整保留在 Field notes。
- 当前节点加载后只预读下一节点；解码图像缓存最多 5 张。快速切换时用请求令牌拒绝过期结果，防止 Phoebe 标题下出现此前加载较慢的土星图。加载失败提供重试，也不显示上一个错误天体。
- 渲染上限约 30fps，像素比上限 1.5，最长边上限 2100 像素。暂停、减少动态和后台状态停止持续动画。WebGL 失败或上下文丢失时，Canvas 继续显示相同的完整原画与轻微镜头移动；恢复时重建纹理。

## 原画与生成记录

- `assets/voyager/scenes/`：19 张当前运行时场景、姿态修改前的原版和用户认可的 Saturn 风格参考图；每张资产的映射见 `data/voyager.js` 的 `scene.art`。
- `docs/voyager-scenes-v2-prompts.json`：19 张完整场景初版的提示词、文件路径和内置 **image_gen** 工具输出记录。`iapetus-shore` 是从想象中的 Iapetus 山脊看土星，用于 Solstice；Iapetus 相遇节点使用 `iapetus-encounter`，天空是 Iapetus 本身。
- `docs/voyager-pose-prompts-v3.json`：7 张人物姿态变体的内置 image_gen 编辑提示词和版本路径；保留原站的天体与构图。
- `docs/voyager-scene-prompts.json`：先前用户认可的完整场景方向稿记录。
- `docs/voyager-character-prompts.json`、`js/voyager-figure.js` 和旧人物透明素材是早期设计记录，当前页面不再加载。

用户原始照片没有复制进公开网站目录。风格参考为用户提供的完整宇宙插画，以及 [NASA/JPL — Cassini: The Wonder of Saturn](https://www.jpl.nasa.gov/videos/cassini-the-wonder-of-saturn/) 的天体尺度、自然色彩与星环光影。任务事实与诗意地面视角分开描述。

早期程序宇宙的研究参考包括 [NVIDIA GPU Gems atmospheric scattering](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering)、[three.js Earth](https://threejs.org/examples/webgpu_tsl_earth.html)、[Inigo Quilez — Rendering Worlds with Two Triangles](https://iquilezles.org/articles/nvscene2008/rwwtt.pdf) 和 [Solar System Scope textures](https://www.solarsystemscope.com/textures/)。当前章节不再使用那套球体/地形着色器或行星贴图。

## 时间与任务事实

所有有日期的节点采用 UTC。部分 NASA 总时间线的标题日期使用了与正文不同的日期，涉及飞掠与抵达时优先采用 Quick Facts 或具体事件记录。

- [NASA Cassini Quick Facts](https://science.nasa.gov/mission/cassini/quick-facts/)
- [NASA Cassini Timeline](https://science.nasa.gov/mission/cassini/the-journey/timeline/)
- [NASA Huygens mission](https://science.nasa.gov/mission/cassini-huygens/)
- [ESA Huygens release, 25 December 2004](https://www.esa.int/Newsroom/Press_Releases/Huygens_begins_its_final_journey_into_the_unknown)
- [NASA Enceladus flyby, 14 July 2005](https://science.nasa.gov/missions/cassini/enceladus-flyby-july-14-2005/)
- [NASA Cassini events, 5–11 September 2007](https://science.nasa.gov/missions/cassini/cassini-significant-events-090507-091107/)
- [NASA Cassini mission / The Day the Earth Smiled](https://science.nasa.gov/mission/cassini/)
- [NASA Grand Finale](https://science.nasa.gov/mission/cassini/grand-finale/overview/)

Cassini 的实际任务止于 2017 年 9 月 15 日的土星大气。最后一站没有任务日期，明确标注为想象尾声。所有诗句为本页面创作。

## 文件与验证

- `data/voyager.js`：节点、原创诗句、事实、来源、场景参数和地图坐标。
- `js/voyager-scene.js`：完整场景的 WebGL 视差、薄雾、镜头、加载缓存与飞船。
- `js/cassini-art.js`：单独飞行的 Cassini 素材与几何降级。
- `js/voyager.js`：统一的旅程状态、交互、持久化、无障碍。
- `css/voyager.css`：页面专用布局。
- `tests/voyager-runtime.cjs`：英语内容、19 张完整场景与天空目标、全景视图、素材懒加载、失败重试与切换竞态、桌面/手机截图、19 节点、地图/札记、键盘/历史、进度、自动漫游、动态暂停、减少动态及 WebGL/存储降级检查。

启动静态服务器后运行 `VOYAGER_PREVIEW_URL=http://127.0.0.1:4174 node tests/voyager-runtime.cjs`。截图保存在 `/tmp/voyager-qa/`。
