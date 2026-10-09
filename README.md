# RoselleCalyx.github.io — A Lonely Voyager

Chen Jia 的个人主页。纯静态网站：没有构建步骤，推送到 GitHub Pages 即可上线。

| 页面 | 文件 | 内容 |
| --- | --- | --- |
| Home | `index.html` | 土星、Cassini 与山巅的旅人：向下滚动，Cassini 坠入土星大气层 |
| Papers | `papers.html` | 论文卡片、图片、PDF / Code / Project / Data 链接、BibTeX |
| Gallery | `gallery.html` | 足迹时间线、照片墙、世界地图 |
| Message | `message.html` | 漂流瓶：写信给我、捡起别人的瓶子 |
| Starmap | `starmap.html` | 按今晚慕尼黑星空旋转的星图、行星、深空天体、“找星座”小游戏；太阳系俯视图、可点开的行星球体、Cassini 的旅程 |
| Farm | `farm.html` | 雪山豹猫 Yuki、动物领养、四季循环的果园 |

右上角 ✦ 切换天空画风（写实 / 印象派），☾ 切换“安静星空”（减少动效）。

## 本地预览

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 修改内容（只需改数据文件）

- `js/config.js`：名字、邮箱、Scholar / LinkedIn / GitHub 链接、留言投递方式、星图观测地点
- `data/papers.js`：论文。链接留空 `""` 就不显示对应按钮；`selected: true` 显示星标
- `data/gallery.js`：足迹。**目前是示例数据，请换成你自己的。** 照片放进 `assets/gallery/`，填 `src`；`src` 为空时会自动画一幅油画风占位图
- `data/bottles.js`：公开展示的漂流瓶（公开访客来信前请先征得对方同意）
- 农场四季：所有访客共享同一个季节时钟，每季 8 分钟（一年 32 分钟）；樱桃和桃子夏天熟，苹果秋天熟，橙子冬天熟。`farm.html?season=winter` 可直接预览某个季节。果树是“活的”（`js/orchard-sim.js`）：花苞逐朵开放、花瓣飘落、青果慢慢长大变色、秋叶飘落堆积、枝头积雪渐厚又融化；加 `&speed=60` 可快进观看一整年，加 `&p=0.5` 可定格在季节的某个进度。场景动画在 `js/farm-fx.js`：星星闪烁、流星、冬夜极光、雁群、炊烟、窗灯与灯笼、远湖波光、瀑布、池塘涟漪与跃出水面的锦鲤、阵风、雨后彩虹、雪地脚印，以及点击时的小特效；加 `?fx=demo` 可在几秒内看到所有事件
- `data/farm.js`：农场居民。也可以打开 `farm.html?keeper`，用“Adopt an Animal”直接生成一行代码，粘贴到 `residents` 里

## 主页说明

- 前景的山巅、旅人、雪豹猫和云海取自主页参考画（`assets/home-landscape.webp`，地平线以上已透明）
- 土星（逐像素光线追踪：云带、环、卡西尼缝、环影）、卫星、银河、流星和 Cassini 都是实时绘制的，并按参考画的坐标对齐，任何屏幕比例下都能和前景吻合
- 向下滚动推进故事；不滚动就不会强制播放。`index.html?p=0.7` 可以直接停在某一时刻（预览用）
- 自适应画质：低性能设备 / 触屏会降低土星分辨率和粒子数量；系统“减少动态效果”和 ☾ 安静模式都会生效

## 星图说明

- **Planets / Solar System**：点任意行星（或太阳、月球）会打开一个实时渲染的球体（`js/planet-globe.js`，WebGL）：按真实倾角缓缓自转（自西向东），卫星绕行——木星的伽利略卫星、土星的土卫六和土卫二、海卫一逆行。表面用的是真实的全球贴图（`assets/planets/`，只在第一次点开某个星球时加载）：地球有日景、夜面城市灯光、会投下阴影的云层、地形起伏、只在海面出现的太阳反光，以及白天偏蓝、晨昏偏橙的大气（参考 three.js 官方 TSL Earth 示例）；月球和水星用 Lommel–Seeliger 光照（满月那种一直亮到边缘的效果）；气态巨行星有临边昏暗；土星环用真实的环结构（卡西尼缝、恩克缝）
- **Solar System**（`js/orrery.js`）：按今天的真实位置俯视太阳系，可以暂停、加速或减速；点行星同样会打开它的球体
- **Cassini’s journey**：从 1997 年发射开始，经过两次金星、一次地球、一次木星引力弹弓，2004 年进入土星轨道；随后是环绕土星的 13 年（惠更斯号降落土卫六、春分、至日、擦环轨道、大结局），最后坠入土星大气。全程一分多钟；☾ 安静模式下速度减半

### 星球贴图的来源与署名

`assets/planets/` 里的贴图来自 [Solar System Scope](https://www.solarsystemscope.com/textures/)（基于 NASA 数据），按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用；地球的海洋高光图和法线图取自 [three.js](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets) 示例仓库。改动：缩放、转成 WebP，部分转为灰度。星球面板右下角有署名，请保留。

## 漂流瓶和领养申请怎么送到我这里

按优先级自动选择：

1. **什么都不配**：访客的邮件客户端会打开一封写好的邮件（发往 `config.js` 里的 email）
2. **Formspree**（推荐，5 分钟）：在 <https://formspree.io> 建一个表单，把地址填进 `formEndpoint`，来信会直接进你的邮箱
3. **Supabase**（可选，支持审核和多人共享）：漂流瓶、领养申请存进数据库，你在后台把 `approved` 设为 `true` 才会公开显示；农场还会记录所有访客的共同收成

前端自带基础防垃圾：隐藏蜜罐字段、过快提交拦截、同一浏览器 60 秒冷却。Supabase 方案再加上服务端长度校验和人工审核。

### Supabase 设置

在 <https://supabase.com> 新建项目，在 SQL Editor 运行下面的 SQL，然后把 Project URL 和 anon key 填进 `config.js` 的 `supabase`：

```sql
-- 漂流瓶：任何人可以投递；只有审核通过的会被公开读取；联系方式永不公开
create table bottles (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text check (char_length(name) <= 60),
  contact text check (char_length(contact) <= 120),
  text text not null check (char_length(text) between 2 and 500),
  approved boolean not null default false,
  reply text
);
alter table bottles enable row level security;
create policy "anyone can drop a bottle" on bottles for insert to anon with check (approved = false and reply is null);
create policy "approved bottles are public" on bottles for select to anon using (approved);
revoke select on bottles from anon;
grant select (id, created_at, name, text, reply, approved) on bottles to anon;

-- 农场领养申请
create table adoptions (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  species text not null check (species in ('rabbit','panda','fox','shiba','hedgehog','duckling','penguin','snowcat')),
  animal_name text not null check (char_length(animal_name) between 1 and 24),
  adopter text check (char_length(adopter) <= 40),
  note text check (char_length(note) <= 140),
  approved boolean not null default false
);
alter table adoptions enable row level security;
create policy "anyone can ask" on adoptions for insert to anon with check (approved = false);
create policy "approved animals are public" on adoptions for select to anon using (approved);

-- 所有访客的共同收成
create table farm_stats (fruit text primary key, total bigint not null default 0);
alter table farm_stats enable row level security;
create policy "stats are public" on farm_stats for select to anon using (true);
create or replace function add_harvest(p_fruit text, p_n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_fruit not in ('apple', 'peach', 'orange', 'cherry') then return; end if;
  insert into farm_stats (fruit, total) values (p_fruit, least(greatest(p_n, 0), 20))
  on conflict (fruit) do update set total = farm_stats.total + excluded.total;
end $$;
grant execute on function add_harvest(text, int) to anon;
```

审核：在 Table Editor 里把 `approved` 改成 `true`，漂流瓶还可以填写 `reply`。

## 文件结构

```
index.html  papers.html  gallery.html  message.html  starmap.html  farm.html
css/style.css          全站样式
js/config.js           站点设置
js/sky.js              星空、银河、流星、印象派画风
js/common.js           导航、页脚、弹窗、灯箱、投递
js/backend.js          可选的 Supabase 接口与防垃圾
js/saturn.js           主页：土星、Cassini、滚动叙事
js/planet-globe.js     星图：WebGL 行星球体
js/orrery.js           星图：太阳系与 Cassini 的旅程
js/orchard-sim.js  js/farm-fx.js   农场：活的果树与场景动画
js/papers.js  js/gallery.js  js/message.js  js/starmap.js  js/farm.js  js/farm-art.js
data/                  所有可编辑内容
assets/                图片、CV；assets/planets/ 星球贴图
```
