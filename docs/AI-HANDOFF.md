# 恐龙岛 · Dino Jelly —— 交接文档（给后续 AI / 开发者）

> **EN abstract** — A single-page, build-free Three.js **r160** diorama. `index.html` loads **9 classic
> scripts in a fixed order** that share globals (`scene`, `island`, `dinosaurs`, `water`, `paused`, …).
> Serve the folder with `node serve.cjs` and open `http://127.0.0.1:8795/`. The regression suite is
> **24 `check-*.cjs` + `verify-art.cjs`** (25 scripts; all must exit 0 with `ok`/`passed` true and no page
> errors). Weather is one 0–100 slider (`50` = the untouched original look) that is also fed to the fish
> school as an external input; its storm end adds lightning + thunder. The island rim has a data-driven
> shore line (baked distance-to-shore texture, `window.islandShoreState`, see §3.41). **Read §7 (red lines) before
> changing anything.** History and rationale: `docs/development-notes.md` §3.x (latest §3.41).

这份文档是"上手地图"：**先读它，再动手**。开发历史/为什么这么做在 `docs/development-notes.md`（按小节编号，如 3.19）；
玩法说明在 `README.md`；本文件只讲**怎么在这套代码里干活而不把它弄坏**。
**上一轮（3.32）刚做完什么的短交接**见 `docs/HANDOFF-3.32.md`（含当前数字、已验证/未验证、下一步建议）。

---

## 0. 30 秒上手

```powershell
$P='D:\Codxe_file\Geam\dinosaur-island'
$NODE='E:\Nodejs\node.exe'

# 1) 起服务（必须；页面脚本同源加载，file:// 也能跑但自检脚本需要 http）
cd $P; & $NODE serve.cjs           # → http://127.0.0.1:8795/   （只监听 127.0.0.1）

# 2) 看效果：浏览器打开 http://127.0.0.1:8795/
#    右侧栏/iframe 窄面板会自动进"嵌入模式"；强制用 ?embed=1，被嵌时想看完整落地页用 ?embed=0

# 3) 跑全部自检（服务必须先起着）
foreach($c in (Get-ChildItem $P -Filter 'check-*.cjs').Name + 'verify-art.cjs'){ & $NODE $c; "== $c exit=$LASTEXITCODE" }

# 4) 改完某个 .js 先做语法检查（都是经典脚本，不是模块）
& $NODE --check "$P\seabed.js"
```

依赖（本机已存在，无需安装）：Node `E:\Nodejs\node.exe`、Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`、
Playwright 由 `D:\Codxe_file\Geam\dy_runtime\node_modules\playwright-core` 提供（自检脚本里写作 `../dy_runtime/...`）。
**没有构建步骤、没有 npm 依赖、不联网**；`three.min.js` 是 Three.js r160 UMD（MIT，文件头版权声明要保留）。

---

## 1. 硬事实一览

| 项 | 值 |
|---|---|
| 入口 | `index.html`（唯一 HTML，内联了一小段嵌入模式嗅探脚本 + 一段 CSS） |
| 样式 | `studio.css`（右侧"小岛实验室"面板、嵌入模式、移动端断点） |
| 渲染 | Three.js r160，`WebGLRenderer`，PCFSoft 阴影，`outputColorSpace=SRGB` |
| 脚本形态 | 9 个 **经典脚本**（非 ESM），靠**全局变量**互相依赖，**加载顺序不可改**（天气在最后） |
| 代码风格 | 单行密集写法、CRLF、中文注释；没有 lint/prettier，保持一致即可 |
| 世界尺度 | 岛体 `island` 组缩放 **.55**；海床/小紫/鱼/水面都是**世界坐标**；岛上的树、恐龙是**岛局部坐标** |
| 水面 | `water.position.y = 1.15`（island.js 第 128 行） |
| 切面水块 | 蚀刻四角线跨 `y=-1.39 … 1.12`（art-direction.js），这就是"水块"的可见范围 |
| 持久化 | `localStorage['dino-jelly-purple-pet-v1']`，`schema_version:1` |
| 性能（本机 1440×1000 实测，3.32 口径） | 绘制调用 **981（多云）/ 1030–1042（大雨）/ 1001（大晴）**、三角面 ≈48 万、海床层 **9 个网格**；**闪电零 draw call** |
| 声音 | 默认关；`ocean-life.js` 往 `<nav>` 注入 `#ocean-sound` 按钮（WebAudio 程序生成，无音频文件） |

---

## 2. 文件地图

### 2.1 运行时（`index.html` 的加载顺序，**不能调换**）

| # | 文件 | 行数 | 职责 | 建立/暴露的全局 |
|---|---|---|---|---|
| 0 | 内联 `<script>` | — | 自判嵌入模式（被 iframe 且宽<700 → `body.embed`；`?embed=1/0` 强制） | — |
| 1 | `three.min.js` | — | Three.js r160 | `THREE` |
| 2 | `island.js` | 267 | 场景/相机/渲染器/光照、岛体与植被、火山、四只恐龙、水面与波浪、相机与指针输入、喷发、投喂路由、**主循环 `animate()`** | `scene camera renderer island water waterGeo waterSideGeo waterBody foam dinosaurs pickables names descriptions eye white mat mats mesh ball rod toast select pointerRay canvas paused simTime theta phi distance target focus underwaterView viewLocked night feeding feedRemaining feedSpot seaGrab seaPull seaGoal seaMotion wakeTrail ripple floor hemi sun` |
| 3 | `art-direction.js` | 252 | 艺术方向：**隐藏原始圆柱、程序生成 beach 沙坡**、火山重雕、植被/海岸、水块蚀刻线、接触阴影、光照预设、水面材质与"水深"滑杆、配色按钮；包一层 `#reset`/`#day` | `window.waterDepth`、`window.islandBeach` |
| 4 | `sky.js` | 138 | 渐变天穹 + 低多边形云 + 昼夜配色；包一层 `#day`。（3.28 的"岛正上方 4 朵小白云" **3.41b 已删**：`islandClouds` 数组与两个 getter 都不在了，只剩远景 12 朵） | `window.skyLife` |
| 5 | `seabed.js` | 346 | 水下生态：海床本体（`floorY`）、合并装饰（礁石/砂砾/海带/海草/珊瑚/海葵/盘珊瑚）、气泡泉（1 个 InstancedMesh）、水皮、逐顶点水深属性；**移除历史遗留的 `reef` 组** | `window.seabedLife` |
| 6 | `water-pet.js` | 202 | 小紫（蛇颈龙 `dinosaurs[2]`）：巡游/下潜/捕猎状态机、扑咬、成长阶段与外观、安抚/玩耍模式、存档、左下角面板 | `window.waterPet` |
| 7 | `pet-life.js` | 299 | 跨物种互动：打招呼、翼龙抢食、分食、岸边低头/伴游、岛上投喂；`movers` 机制（自己持有坐标并绝对写回） | `window.petLife` |
| 8 | `ocean-life.js` | 181 | 小紫气泡/涟漪（**3.40 删掉了 32 片弧线尾迹贴图**）、**鱼群最终位置**（后写覆盖 island.js 的巡航；3.25 起鱼群决策层自持朝向/目标：闲逛 / 逐颗鱼食 / 转向惯性 / 起惊脉冲；**3.32 起多一个外部输入 `setRain(雨量)`：雨越大越深/越贴岸躲/扎得越紧/游得越快**）、`#ocean-sound` 按钮、**雷声 `thunder(power)`** | `window.oceanLife`（含 `startle(x,z)`、`splash`、`setRain`、`rainProbe`、`thunderCount`、`schoolState`、`fishEaten`） |
| 9 | `weather.js` | 171 | 天气滑杆（3.31 建、3.32 扩）：一个 `LineSegments` 雨（900 段上限、`setDrawRange` 控量、1 draw call）+ 灯/天穹/云按天气幂等重算；雨点落水走 `oceanLife.splash()`；**3.32 起最左档还会闪电（瞬态偏移，零 draw call）+ 雷声（走已有 WebAudio 总线）**，并把雨量作为外部输入喂给鱼群；**3.44 起把内部手抄的光照基准以只读 `base()` 交出去**（`check-weather.cjs` 拿它跟 `art-direction.js`/`sky.js` 的源码字面量三方对账） | `window.weatherLife` |

**每帧顺序**（`island.js` 的 `animate()`，理解它就知道谁覆盖谁）：
`水面顶点/波浪 → 鱼（island 的 lerp）→ 恐龙位姿（绝对写）→ 相机 → waterPet.update → oceanLife.update → petLife.update → skyLife.update → seabedLife.update → render`。
**后写的覆盖先写的**：鱼群由 `ocean-life` 定稿；小紫的位姿由 `water-pet` 定稿；被 `pet-life` 接管的陆地动物由 `pet-life` 定稿。

### 2.2 控件 → 谁绑的（改 UI 前先看这里）

| 选择器 | 绑定方 | 作用 |
|---|---|---|
| `[data-id]`（四个物种按钮） | island.js `select(id)`；pet-life.js 追加 greet | **唯一的聚焦入口**：`focus=id; distance=23` + `#card` 文案。**画布上点动物只 `announce()`，不动相机**（3.27） |
| `#viewLock` 锁定视角 | island.js | 锁相机（锁定时点其他按钮会提示先解锁） |
| `#day` 白昼/夜晚 | island.js 基础 → sky.js 包一层 → art-direction.js 再包一层 | 三处都要跟着变（天空、光照、云） |
| `#settings` 调节海水 | island.js | `#controls` 加/去 `.open`（窄屏才显示面板） |
| `#feed` 投喂小鱼 | island.js | 进投喂模式（20 份饲料，用完可"补充"）；`pointerdown` 时 `water-pet` 会退出自己的模式 |
| `#eruption` | island.js | 火山喷发（`#reset` / `#pause` 已在 3.22 移除，**别再引用它们**，`verify-art.cjs` 在守这条） |
| `#soft` `#damping` `#tide` | island.js | 柔软度 / 波浪阻尼 / 潮汐 |
| `#weather` 天气 | weather.js（第 9 个脚本） | **50 = 原样**；左＝雨越大、右＝越晴；`#weather-note` 显示大雨/小雨/多云/晴/大晴（打闪瞬间追加 ` ⚡`）。光照按自带 `BASE.day/night` 幂等重算（**这份是手抄 `art-direction.js` 的 `ART`，3.44 起有交叉断言盯着，改 `ART` 会红**）。**雨量是唯一真源**：`weatherLife.rain`（0–1，0=多云），`oceanLife` 每帧从它读 |
| `#depth` 水深 | art-direction.js | `window.waterDepth.uniform`（0=均匀单色，100=最强深浅对比） |
| `[data-color]` 海水配色 | art-direction.js | 切换水体上下端颜色 |
| `#pet-care` / `#pet-play` | water-pet.js | **模式开关**（不是立即执行）：选中后左键点小紫才生效；右键/Esc 取消。点小紫同样不动相机（见上面 `[data-id]` 那条规则） |
| `#ocean-sound` | ocean-life.js | 注入进 `<nav>` 的声音开关 |
| `#card` `#toast` `#hint` `#controls` `#feedBag` `#pet-panel` | 分别由 island.js / water-pet.js 创建与写文案 | 回归自检常按这些 id 断言 |

### 2.3 素材与服务

- `serve.cjs`（3 行）：极简静态服务器，`127.0.0.1:8795`，无缓存头、无目录列表。**它是前台进程，会话/重启就掉**（详见 §10）。
- `models/`（3.29–3.30 新增，纯数据经典脚本，`index.html` 里紧跟 `three.min.js` 加载）：`volcano-island.js`（717 KB：火山模型 8,762 面 + 1K 贴图 data URL）、`pink-plesiosaur.js`（868 KB：粉龙 7 块 / 19,783 面 + 贴图）。两者都**内联几何+贴图**，所以 `file://` 双击也能用。
- `assets/`：`water-skin.png`（水皮）、`seabed-depth.png`（海底深浅色图）由本机 Photoshop 生成（脚本 `_baseline/ps-textures.ps1`）；**两张 PNG 缺失会自动退回代码里的 canvas 版本**，所以删了也不会崩。另有留档 `water-skin-v1-cloudy.png`、`seabed-depth-v1.png`、`volcanic-rock.png/.webp`。

### 2.4 根目录里那些 `*.cjs`：哪些是"现役"、哪些是历史

- **现役自检（必须全绿）**：**24 个 `check-*.cjs` + `verify-art.cjs`（共 25 个脚本）**；计数以 `Get-ChildItem check-*.cjs` 为准（`check-island-model.cjs` 是 3.34 那轮加的、`check-beach.cjs` 是 3.41 岛缘那轮加的，§6 表尚未列）。最近全套日志 `_baseline/suite-3.41a/`（24 项全绿、零 pageerror、零 shader 编译错误）。
- **历史一次性脚本（别当成套件、别跟着改）**：`add-*.cjs`、`adjust*.cjs`、`apply-art-review.cjs`、`capture-art.cjs`、
  `crest-foam.cjs`、`finish-reef.cjs`、`fix.cjs`、`frames.cjs`、`guard-shader-chunks.cjs`、`local-ripple.cjs`、
  `measure-performance.cjs`、`preserve-volume-palettes.cjs`、`refine*.cjs`、`smooth-*.cjs`、`update-*.cjs`、
  `verify-*.cjs`（老的 verify 系列）。它们是上一轮开发用来批量改文件/看效果的探针，**其中一些引用了已被删除的对象**
  （`reef`、`shoal`），直接跑会报错，属正常。
- `_baseline/`：一次性探针脚本 + 对比截图（`crop-*.png`、`footab-*.png`、`base-*.png` …）。做视觉 A/B 时往这里放。

---

## 3. 世界与坐标（最容易踩的地方）

### 3.1 三套坐标

| 空间 | 谁在用 | 换算 |
|---|---|---|
| 世界（world） | `seabed.js` 全部、`water-pet.js` 的 `position`、鱼 `swimmers`、`ocean-life` | — |
| 岛局部（local，岛组缩放 .55） | 岛上植被、火山、`island.js` 里恐龙的位置、`pet-life` 的恐龙坐标 | `world = local * .55`（`island.worldToLocal/localToWorld`） |
| 屏幕 | 自检脚本算点击坐标 | `vec.project(camera)` → `x=(v.x+1)*innerWidth/2, y=(1-v.y)*innerHeight/2` |

**小紫是特例**：它的逻辑坐标是世界坐标，但每帧写回 `dinosaurs[2].g.position` 时会过 `island.worldToLocal()`。
换句话说：`waterPet.position` 读的是世界，`dinosaurs[2].g.position` 读的是岛局部。

### 3.2 关键尺寸（改地形/动画前先对一遍）

| 东西 | 值（世界坐标） |
|---|---|
| 水面基准 | `water.position.y = 1.15`；泡沫环 `y=1.18` |
| 切面水块可见范围 | `x,z ∈ [-14,14]`，`y ∈ [-1.39, 1.12]`（四角蚀刻线） |
| 岛体沙坡（beach）沙滩外缘 | 半径 **5.36–6.03**（随角度起伏），高度 **-0.23 ~ -0.31** |
| 岛体沙坡裙脚（扎进海床的部分） | 最外圈半径 **5.84–6.37**，高度 **≈-1.09 ~ -1.17**（低于同处海床 0.2–0.29，且高于水块底面 -1.39） |
| 海床 | `FLOOR=-1.34`、`SHORE=6.1`、`DEEP=11`；`floorY = -1.34 + .46*(1-smoothstep(r,6.1,11)) + 噪声`；浅滩约 **-0.87**，外缘 **-1.34** |
| 海床网格 | `PlaneGeometry(28,28,112,112)`，1 个 draw call |
| 陆地动物活动范围 | `pet-life.js`：`DRY_RADIUS=4.0`（世界半径），超过就被夹回干沙 |
| 小紫活动范围 | `water-pet.js` `safeSea()`：`|x|,|z| ≤ 12.4` 且 `r ≥ 6.8` |
| 鱼群 | `ocean-life.js` 定稿：`r ≥ 6.8`、`|x|,|z| ≤ 12.5`，34 条 |

### 3.3 岛体是"程序生成的 beach"，不是那两个圆柱

`island.js` 建的 `CylinderGeometry(10.8,9.4,1.8)`（沙）与 `(10,10.5,.7)`（草）在 `art-direction.js` 第 109 行被
`visible=false` **隐藏**，真正可见的岛体是程序生成的 **beach 沙坡**，参数化：

```
border(a) = 10.3 + .45*sin(3a+.8) + .22*sin(7a)      // 局部半径（随角度起伏）
u = r_local / border(a)                              // u=1 正好是"沙滩外缘"
y_local(u,a) = 1.44 - .08u - 1.85*u^7 + .07*sin(5a + 6u)*u
rings=22（岛体）+ skirt=2（裙脚，u 到 1.091）  sectors=128
```

- **u ≤ 1 的顶点一个都不要动**：那是整座岛的可见形状，动一条公式全岛变形。
- 想让岛基"接海床"更缓/更长 → 只调 `skirt`（如 `3`），别去动海床（§7-4）。
- 导出给自检用的解析剖面：`window.islandBeach = { edge(a), y(u,a), uMax }`（世界单位）；网格对象名 **`island-beach`**。

### 3.4 水深/水色是两条独立的链，别混

1. **水面**：`water.geometry` 的顶点属性 `aDepth`（0–1 归一化水深，由 `floorY` 采样）→ 水面着色器按它决定
   "浅处更透更亮 / 深处更实更暗"，并由 `#depth` 滑杆（`window.waterDepth`）控制强度。
2. **水下物体**：`seabed.js` 的 `depthTint(material)` 给每个网格注入 `aDepth` 属性的着色器片段，按水柱厚度压暗/偏色；
   海底颜色还叠了一张 `assets/seabed-depth.png`（画好的深浅色图）+ 顶点色的浅滩绿调。

**两条链都按"纯泻湖剖面 `floorY`"算。** 谁去改 `floorY` 让某个局部抬高，整片泻湖的归一化区间都会变，
水面观感会一起变（3.19 的教训）。

---

## 4. 玩法与系统清单（含状态与可调参数）

### 4.1 相机与视图
`theta/phi/distance/target/panOffset/focus/viewLocked/underwaterView`。俯仰 `phi ∈ [0.08, π/2]`（0.08≈正上方俯视），
缩放上限 80；左键旋转、右键牵引海水、中键/Shift+左键平移、滚轮缩放、双指缩放。点物种按钮 `select(id)` 会把
`focus` 设为该动物并把 `distance` 拉到 23。

### 4.2 投喂（`island.js` 路由 → 两个下游）
- 进投喂模式后左键点**水面** → 8 颗鱼食 + `feedSpot` + `waterPet.feed(point)`（小紫游过来吃；`pet-life` 包装了这个函数，
  有 60% 概率触发翼龙抢食）。
- 点**岛面** → `petLife.feedLand(point)`：撒 6 颗小鱼干，最近的陆地恐龙（迅猛龙/腕龙/翼龙）走过来一颗颗吃。
- 饲料 20 份一袋，用光后再点按钮"补充"；右键/Esc 退出投喂。

### 4.3 小紫（`water-pet.js`，本项目的"宠物系统"）
- **状态字段**：`trust/curiosity/hunger/joy/meals/hunts`，全部 `clamp(0,100)`；`meals`=玩家喂到的、`hunts`=自己捕到的。
- **巡游状态机**：`surface`（12–20 s）→ `dive`（4 s，下沉到 y≈-0.78）→ `hunt`（16 s，追最近的一条可见鱼）→ 循环；
  玩家互动（`toy/goal/action`）会打断并拉回水面。
- **扑咬**：嘴到猎物 **1.05–2.6** 时进入 `strike`（速度 2.8 → **5.2**），咬中触发 `bite` 动作（1.1 s，爱心 + toast）；
  冲刺累计 **2.2 s** 未咬中就放弃；离开 `hunt` 必须清 `strike`。
- **成长**：成长点 = `meals + hunts`，门槛 **0/3/8/16** → 幼生期/幼体期/亚成体/成体。

  | 阶段 | 体型 | 肤色 | 自发光 | 背鳍 | 尾鳍 | 侧腹发光点 |
  |---|---|---|---|---|---|---|
  | 幼生期 | .80 | `#a68ad0` | 0 | 0 | — | — |
  | 幼体期 | .92 | `#a875d6` | 0 | 1 | — | — |
  | 亚成体 | 1.04 | `#9a63dd` | .05 | 2 | 2 | — |
  | 成体 | 1.16 | `#8b4ee0` | .14 | 4 | 2 | 2 |

  8 个成长部件（背鳍/尾鳍/发光点）**建一次、按阶段切 `visible`**（没长出来不产生 draw call），并计入 `pickables`；
  鳍肢按阶段放大。放大是绕 `d.g` 原点做的，所以成体背部露出水面更多——**刻意**的观感设计。
- **互动模式**：`#pet-care`（安抚）/`#pet-play`（玩耍）是模式开关；左键点小紫生效，右键/Esc 取消。
  安抚加信任有 **12 s 冷却**；玩耍会扔一个会弹的玩具（`toy`）。
- **测试钩子**：`waterPet.activity`（`swimState/depth/catches/striking/action/growth/mood/...`）、
  `waterPet.stages`、`waterPet.stageOf(n)`、`waterPet.setGrowth(meals,hunts)`。**不要**用它们改玩法逻辑，只给自检用。

### 4.4 跨物种互动（`pet-life.js`）
`movers[id]` = 本模块正在驱动的动物坐标；**存在期间这只动物归它管，每帧绝对写回**；互动结束后缓动回 `base` 并交还控制权
（`island.js` 每帧绝对赋值，所以"用 `position +=` 位移"会被当帧抹掉——这是这个项目最容易踩的坑之一）。
现有互动：`greet`（任一物种按钮 → 最近的一只回头）、`steal`（翼龙俯冲抢食）、`share`（小紫抢先吃到）、
`shore`（小紫进岸边带 6.4–9.2 → 腕龙低头、迅猛龙伴游）、`feedLand`（岛上投喂）。
测试钩子：`petLife.state/activity/probeShore(x,z)`。

### 4.5 水下生态（`seabed.js`）
`merge(parts, material, parent)` 把大量几何合成 **1 个网格**并按顶点写入 `aDepth`（深度色调）；
装饰分布半径：礁石 7.0+、砂砾 6.6+、海带 6.8+、海草 6.3+、分枝珊瑚 6.4+、海葵 6.5+、盘珊瑚 6.8+、气泡泉 6.6+。
**新增水下装饰请走 `merge()` + `depthTint()` 或 InstancedMesh**，不要一件一个 mesh。
海床层 9 个网格：地板 1 + 合并装饰 7 + 气泡 InstancedMesh 1（90 个气泡）。
`seabedLife.stats` 暴露 `floor/shore/depth/meshes/bubbles/waterDepth`。

### 4.6 嵌入模式（右侧栏）
`body.embed`：隐藏落地页大标题、导航压成一行、相机拉近；被 iframe 且宽 <700 时自动，`?embed=1/0` 强制。
底部小紫面板 `petPanelBottom=6`。**动布局必跑** `check-embed-pane.cjs` + `check-mobile-layout.cjs`。

---

## 5. 持久化

- 键：`localStorage['dino-jelly-purple-pet-v1']`；`schema_version: 1`。
- 字段：`trust curiosity hunger joy meals hunts`（缺省 `trust 12 / curiosity 45 / hunger 35 / joy 60 / meals 0 / hunts 0`）。
- 读取规则：只认 `schema_version===1`，逐个字段 `Number.isFinite` 才采用 → **加新字段必须能容忍旧存档缺字段**（取默认，别出 `NaN`）。
- 写：每次互动/进食/升级/每 5 秒，以及 **`pagehide` 时再存一次**。
  ⚠️ 自检里要在 `reload()` 前手写 localStorage 是无效的（会被 `pagehide` 覆盖），必须用 `page.addInitScript()` 注入。

---

## 6. 验收套件

前置：8795 服务在跑；Chrome 与 playwright-core 路径见 §0。**每一条都必须 `exit 0`**，并满足：
① 控制台/页面无 error（`pageerror` 与 `console.error` 都算）；② 打印里 `ok`/`passed` 为 `true`；③ 交互**走真实点击**。

| 命令 | 覆盖 |
|---|---|
| `node check-seabed.cjs` | 旧 `reef` 已移除、合并后 mesh 数 8–12、**海床逐点贴合 `floorY`**、**`islandFootWorks`（岛体沙坡扎进海床 / 坡度延续 / 海床无领圈 / 无 5.2-7.5 的 RingGeometry）**、气泡在上升、水面不透明度 <0.7、绘制调用；输出 `seabed-preview.png` |
| `node check-embed-pane.cjs` | 7 个场景（420×760 / 360×640 / 520×900 / 裸 390×844 / `?embed=1` / iframe 1000×820 / `?embed=0`） |
| `node check-mobile-layout.cjs` | 390/360/1440：面板不溢出、状态行不裁切、不与物种行/卡片重叠 |
| `node check-pet-interactions.cjs` | 7 项：打招呼 / 抢食 / 分食 / 岸边低头+伴游 / 岛上投喂（真实点击）/ 陆地动物不越 `DRY_RADIUS` / 自然触发 |
| `node check-pet-target.cjs` | 安抚/玩耍模式：点小紫生效、右键与 Esc 取消、相机不被误转 |
| `node check-purple-pet.cjs` | 安抚：`trust+2`、12 s 冷却、刷新后保留（**必须"先点模式按钮、再点小紫"**） |
| `node check-pet-growth.cjs` | 成长 12 项：门槛映射、四阶段外观（体型/配色/背鳍/尾鳍/发光点/鳍肢）、面板文案、刷新保留、**旧存档无 `hunts` 不出 NaN**、扑咬（`striking`+`bite`+计数）；输出 `pet-growth-baby/adult.png` |
| `node check-pet-dive.cjs` | surface/dive/hunt 状态机与最小深度 |
| `node check-ocean-effects.cjs` | 连跑 2200 帧模拟：`oceanLife.effects` 的气泡/涟漪峰值、捕获计数、无报错（`wakes` 恒 0＝3.40 已删弧线尾迹贴图，属设计） |
| `node check-pet-actions.cjs` | 安抚/玩耍两种姿态（`g.position.y`、颈、鳍）与历史 `#pet-find` 已移除 |
| `node check-pet-toys.cjs` | 安抚模式下拖动相机不被误转、点小紫冒爱心、玩耍生成玩具并长跑 1100 帧 |
| `node verify-art.cjs` | 加载/着色器、设置与实验室折叠、安抚/玩耍、昼夜、锁定、移动端不横向溢出；输出 `.dream-loop/current.png`、`mobile.png` |
| `node check-fish-behavior.cjs` | 3.21 语义：投喂叠加 `foodEnergy`、逃逸加速、恢复巡游、速度差异、水域边界 |
| `node check-pet-capabilities.cjs` | 四阶段能力表：实际位移速度、最低深度、最长连续捕食、边界约束、零 dt |
| `node check-fish-school.cjs` | **3.25 鱼群四样**：闲逛目标重挑（30 s 内 4–7 次）、逐颗鱼食（含**实况下沉竞速**相位）、转向速率上限（≤3.2 rad/s）、起惊脉冲 0.85 s 淡出、零 dt、水域边界 |
| `node check-click-focus.cjs` | **3.27 聚焦规则**：画布上点四只动物都不动相机（`theta/phi/distance/focus` 不变，但 `#card` 换文案）、只有名字按钮 `focus=id` + `distance=23` |
| `node check-sky-flight.cjs` | **3.28**：翼龙飞行体积（水平最远 ≥5.5、高度跨度 ≥2.5、不出水块、**高于火山顶 +0.15**）；**3.41b 起再加一条 `islandCloudsGone`**（`skyLife.islandClouds` 必须不存在、远景云恒 12 朵）；实况采样 20 秒 |
| `node check-volcano-model.cjs` | **3.29 火山换模型**：`volcano` 子节点/8,762 面/flipY=false/程序件全让位/**底部比该处沙滩低 0.226（扎进沙里）**/点火山仍喷发/draw call ≤1000 |
| `node check-pink-plesiosaur.cjs` | **3.30 小紫换粉龙**：`g.children[0]` 是模型躯干+贴图+四鳍/**安抚时脖子枢轴真的被驱动**/四阶成长部件与锚点/仍可拾取 |
| `node check-weather.cjs` | **3.31 天气滑杆**：50 档必须等于原样（hemi .58/sun 3.15/exposure .98/云纯白）、越左雨丝越多且水面涟漪 >0、越右光照/曝光/天穹蓝度越高、真实拖滑杆生效。**3.44 加两条交叉基线**（防手抄漂移）：`artBaselineWorks` 从 `art-direction.js` 解析 day/night 的 sun/fill/exposure/bounce 8 个数、`skyBaselineWorks` 从 `sky.js` 解析昼夜 top/bottom/云色 6 个 hex，跟 50 档（白昼 + 点 `#day` 后的夜晚 + 切回白昼逐位还原）的**运行时实测值**逐项比，`|Δ|≤1e-6`；`bounce` 灯是 IIFE 局部，按灯色 `#ffe5bb` 在 scene 里认领。红时会同时打印「源码解析值/镜像值/运行值」 |
| `node check-weather-fish.cjs` | **3.32 雨天鱼群联动**：50 档三个乘数**精确 1/1/0** 且 weather.js 源码无 `Math.random`、越左雨越大鱼越深（-0.31/-0.62/-0.93）、`setRain` 夹取、dt=0 冻结、大晴档不碰鱼群 |
| `node check-thunder.cjs` | **3.32 闪电与雷声**：真实打闪后灯光/曝光按 `flash×系数` 上调、**闪完逐位回到基准**、3 个错峰脉冲、雷声在总线末端**实测到波形**（AnalyserNode）、只有大雨档会自动打雷、draw call 不变 |
| `node check-fish-replay.cjs` | **3.43 鱼群确定性重放**：`setRandom(种子)` + `snapshot()/restore()` 下 600 帧 ×2 **逐字段严格相等**（1510 + 479 项 0 diff）、`restore(中途快照)` 续跑 ≡ 不中断、大雨档贴岸/群聚连跑 3 次**逐位相同**（0.5833333333333334 / 7.524183860086971，跨进程也逐位相同）且与中性档必须不同、`update(0,t)` 冻结、默认仍走 `Math.random`（调用数一一对应）、源码只剩 1 处 `Math.random`（`rnd()` 兜底） |

**写新自检的约定**（照 `check-pet-growth.cjs` / `check-seabed.cjs` 抄）：

```js
const {chromium}=require('../dy_runtime/node_modules/playwright-core');
(async()=>{
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const p=await b.newPage({viewport:{width:1440,height:900}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  await p.goto('http://127.0.0.1:8795/');await p.waitForFunction(()=>window.waterPet&&window.seabedLife);
  const r=await p.evaluate(()=>{ /* 只读断言，或驱动 activity/update 做确定性模拟 */ });
  const result={errors,...r};
  result.xxxWorks=/* … */;
  result.ok=Object.entries(result).filter(([k])=>k.endsWith('Works')).every(([,v])=>v===true)&&errors.length===0;
  console.log(JSON.stringify(result,null,1));
  await b.close();
})();
```

**视觉验收（我一直在做，建议保持）**：截图 → 裁切放大 → 与参照图比对，产物放 `_baseline/`。
证明"用户圈的那个轮廓＝哪块几何"时的两种 A/B 手段（3.19 的教训）：
1. 颜色差异明显 → `paused=true` 冻结同一帧后把旧物件**注入场景**（旧 `shoal` 圆片就是这么证的）；
2. 颜色接近（两块沙、同一材质）→ 注入纯色板**不够**，必须**就地改写网格顶点高度与 `aDepth`** 成上一版剖面，拍 before，再恢复拍 after。

---

## 7. 改代码的红线（踩过坑，按重要性排）

1. **脚本顺序不可改**：`three → island → art-direction → sky → seabed → water-pet → pet-life → ocean-life`。后面依赖前面建立的全局。
2. **`island.js` 每帧绝对写恐龙位姿**。要移动动物必须学 `water-pet.js`/`pet-life.js`：自己持有坐标（`movers[id]`）、每帧**绝对写回**，结束后缓动回 `base`。用 `position +=` 会被当帧抹掉。
3. **点击拾取用 `pickables`，且射线是 `recursive=false`**：新加的可点网格必须自己 `pickables.push(mesh)` 并设 `mesh.userData.dino=<0|1|2|3>`。
4. **不要为了让海床接岛而抬高海床**（3.19 第一版就是这么错的：平台比沙滩外缘还高，反而在岛缘留一圈"领圈+台阶"）。正确做法是让 `art-direction.js` 里 beach 的 `skirt` 往外多长两圈、扎到 `floorY` 以下。
5. **水色/水深链依赖 `floorY`**：动它会全局改变水面观感与水下压暗；改地形优先改岛体（beach）那一侧。
6. **draw call 预算**：**981（多云）/ 1030–1042（大雨）/ 1001（大晴）**（3.32 实测；旧的「≈1025」已过期）。新的环境装饰一律 `merge()` / `InstancedMesh`；小件别一件一个 mesh。
7. **存档向后兼容**：新字段要能被旧 `schema_version:1` 存档安全读入（默认值，不得 NaN）。
8. **新网格记得 `castShadow`/`receiveShadow` 与 `renderOrder`**：透明水面/水皮/泡沫走 `depthWrite:false` + `renderOrder 1/3/5` 这一套，别打乱。
9. **改完 `.js` 先 `node --check`**，再跑受影响的那个 `check-*.cjs`；动了布局/相机/面板就补跑 `check-embed-pane.cjs` 与 `check-mobile-layout.cjs`。
10. **不要改 `three.min.js`**（MIT，版权头保留）；也不要引入构建步骤——这个项目的价值就是"双击 index.html 就能跑"。
11. **别让小紫掉出 `safeSea()` 的范围、别让陆地动物越过世界半径 4.0**（`check-pet-interactions.cjs` 会抓到）。
12. 旧的 `*.cjs` 一次性脚本、`_baseline/` 探针**不要当成套件**跑（有些引用已删除的 `reef`/`shoal`，会报错）。

---

## 8. 加一个功能的推荐流程

1. 想清楚属于谁：环境/地形 → `art-direction.js` 或 `seabed.js`；动物行为 → `water-pet.js` / `pet-life.js`；UI → `index.html`（结构）+ `studio.css`（样式）+ 对应模块（事件）。
2. 需要新的"每帧"逻辑时，**别新开 `requestAnimationFrame`**：挂到 `island.js` 主循环已有的钩子上（`window.xxx.update(dt,t)` 模式），或复用 `seabedLife.update(t)`。
3. 需要可调参数就加 UI（`#controls` 面板里加滑杆/按钮）+ 一个全局，并在 `README.md` 里写一句玩法说明。
4. 加持久化字段 → 更新 §5 的规则 + `check-pet-growth.cjs` 里的旧存档断言。
5. **加一个 `check-<功能>.cjs`**（照 §6 模板），断言走真实交互或确定性模拟；需要截图就写 `<功能>-preview.png`。
6. 跑全套（服务在跑的前提下）确保 `exit 0`；把"做了什么/怎么验证/改了哪些文件"写进 `docs/development-notes.md` 新的 3.x 小节，并更新文末「已知遗留」。
7. 若改了视觉，额外做一次截图/裁切对比，把参照图放 `_baseline/`。

---

## 9. 已知遗留（下一步候选）

- 成长**已影响能力**（3.20 起：速度/食量/可互动范围随阶段变，成体后仍有累积）。
- 绘制调用 **981 / 1030–1042 / 1001**（多云/大雨/大晴），主要来自岛上植被球体与颗粒，可继续按材质合批（重点验证手机端）。
- 火山烟雾/喷发是简化粒子，参考素材里更浓。
- 岛边浅滩绿调浓淡可调（`seabed.js` 里海床顶点色那三行系数）。
- 无头 Chrome 的 FPS 只代表本机，**手机性能仍未真机验证**。
- `_baseline/` 里引用 `reef`/`shoal` 的旧探针未修（不在套件内）。

---

## 10. 排查手册

| 现象 | 先查什么 |
|---|---|
| 右侧栏"打不开游戏" | **别先怀疑代码**：`Get-NetTCPConnection -LocalPort 8795 -State Listen`。没监听就是服务掉了 → 在仓库根 `E:\Nodejs\node.exe serve.cjs` 起回来，再逐个文件确认 200，最后 `node check-embed-pane.cjs`。它**不会自启**，会话一断就掉（常驻方案：登录时自启的计划任务，或一个双击的 `启动* .cmd`，需用户点头） |
| 页面空白/黑屏 | F12 看 `pageerror`；多半是脚本顺序被改、或某个全局没建立（`three.min.js` 必须最先） |
| 改了 UI 但右侧栏没变 | 刷新（Ctrl+R）；嵌入模式下必须满足"被 iframe 且宽<700"或显式 `?embed=1` |
| 恐龙"不听话"（不动/回弹） | `island.js` 每帧绝对赋值，见 §7-2 |
| 某个 `check-*.cjs` 红 | `pageerror` 优先；再看断言打印的实测值（每个断言都留了实测数字）；注意是否只改了代码没重启服务（不需要重启，serve 每次读盘）、或页面缓存 |
| 断言存档/成长不对 | `pagehide` 会覆盖手工写入的 localStorage，用 `addInitScript`（§5） |
| 视觉对比"看不出差别" | 水面反射会挡住水下：把水面那层临时 `visible=false`；A/B 必须冻结同一帧（`paused=true`） |

---

## 11. 参考位置

- 玩法说明与自检清单：`README.md`
- 开发历史（每轮改了什么、为什么、实测数字）：`docs/development-notes.md`（现到 **3.24**）
- 视觉参照与一次性探针：`_baseline/`（`crop-*.png`、`footab-*.png`、`pet-growth-*.png`、`embed-pane-*.png` …）
- 交付截图：`seabed-preview.png`、`pet-growth-baby/adult.png`、`pet-interactions.png`、`embed-pane-*.png`

## 成长能力补充（2026-10-13）
`water-pet.js` 的 ABILITIES 按四阶段定义游速、追球/捕食速度、潜水目标深度、捕食时长和顶球参数；`abilities()` 推导体型安全距离。activity.capabilities / position 提供只读快照用于验证。能力不写入存档，沿用 schema_version:1。投喂升级也会立即 applyGrowth。新增 `check-pet-capabilities.cjs`，验证实际位移速度、深度、单次潜水时长、导航边界及零 dt。

## 鱼群行为补充（2026-10-13）
ocean-life.js 持有每条鱼的独立位置、速度、pace、panic、mode。feedSpot 对象变化代表一次投喂，叠加有上限的 foodEnergy 并随时间衰减。水下小紫近距离触发分散逃逸，捕猎时扩大感知范围；优先级 flee > feed > cruise。schoolState 返回测试快照。新增 check-fish-behavior.cjs 验证投喂叠加、逃逸、恢复、速度差异与边界；不增加网格或存档字段。

## 鱼群行为（3.25 从 fish-behaviour 移植的四样）
**先给结论：`D:\Deepseek _file\yutang\fish-behaviour` 不能原样 import**（实测：ESM 在 `file://` 下报 `Failed to fetch dynamically
imported module`；库自带 `rectBounds` 让鱼穿过岛 97,260 鱼·帧；`feed()`/`update()` 写死 8px 食料余量；默认转向率配岛上的鱼速会不停撞岸）。
本轮只把**岛上缺的四样**按岛自己的世界单位重写进 `ocean-life.js`：

- **闲逛**：每条鱼 `target`/`wander`，4–12 秒换随机目标（合法水域拒绝采样）+ 28% 群锚；
- **逐颗鱼食**：读 island.js 的鱼食数组 `fish`，追最近且视线可达的一颗，**嘴（身长前 38.5%，水平 0.22、深度差 <0.5）碰到才算吃**，吃掉即移除并 `dispose()`；
- **转向惯性**：`a.angular`/`a.heading`/`a.turn`，限速 3.2（巡游）/5（觅食）/3.6–4.5（受惊），沿当前朝向前进（轨迹跟着受约束）；
- **起惊脉冲**：`oceanLife.startle(x,z)` → 2.2 半径内脉冲、0.85 秒淡出、速度 ×(2.4+脉冲)；**右键牵引海水会自动触发**（搅动水面惊散鱼群）。
- 附带（非库原有，为了让闲逛在 3D 水域成立）：软岸预判（离岛缘/水块边 < max(.6, 速度×1.6) 提前外推）、追食时上下浮动到够得着的水层、吃完回 `homeY`。

**改这里要知道的两条**：① 鱼食的**下沉速度在 `island.js`（现 0.6 单位/秒，约 4–5 秒生命期）**——调快会让鱼来不及吃到（原值 2 就吃不到，实测 0 颗）；
② 自检必须包含**实况相位**（暂停模式会把鱼食冻住，测不出上面那条），`check-fish-school.cjs` 里有。

## 控件更新（3.22）
右侧原重置/暂停位置已改为 #pet-care / #pet-play，water-pet.js 用 document 选择器绑定。底部 #pet-panel 仅保留状态，不再包含按钮。#reset/#pause 及运行时代码绑定已移除；verify-art 已跟随调整。

## 天气滑杆（3.31）
新增 `weather.js`（**第 9 个运行时脚本，加在最后**，只调节别的模块已建好的灯/天穹/云，不改 8 脚本顺序）。
滑杆在实验室面板：`#weather`（0–100，默认 50）+ `#weather-note`。
- **50 = 原样**（硬约定：`check-weather.cjs` 的 `neutralWorks` 断言 hemi .58 / sun 3.15 / exposure .98 / 云 #ffffff，别的 check 的数值基线因此不受影响）。
- 左半＝雨：一个 `LineSegments`（900 段，**1 次 draw call**，`setDrawRange` 控量），雨点落水复用 `oceanLife.splash()`（涟漪环池）。
- 右半＝晴：光照/曝光上调、太阳偏暖、天穹更蓝、云更白。
- **光照基准自带 `BASE.day/night`**：art-direction 的 `ART` 在它自己的 IIFE 里，外部拿不到；`update()` 每帧幂等重算、绝不叠加，所以 `#day` 与配色按钮都照旧。
- **坑（重要）**：滑杆 id 会生成同名 `window.weather`（DOM 元素）**顶掉 API** → 接口名必须是 `window.weatherLife`（与 `skyLife`/`seabedLife` 一致）。给新控件起 id 时别和要暴露的全局同名。

## 雨天鱼群 + 闪电雷声（3.32）
> 用户原话只提「大雨档加闪电（+雷声走现有 WebAudio）」「雨天鱼群更活跃/更躲」两条候选；本轮按**最彻底**读法两条都做了。

**鱼群（`ocean-life.js`）——一条铁律：雨量只能有一个真源。**
- 真源＝`window.weatherLife.rain`（雨量 0–1，**0＝多云原样**）。`ocean-life` 每帧现算，自己**不存副本**。
- 归一化水位 `rainVal() = NR + 雨量/2`（`NR=.5`＝中性，1＝雨最大），所有效果挂在 `F()/NF()` 乘数上：
  `speed ×1.14`、`spacing ×0.66`（更扎堆）、深度 `-0.62`（更往下），另有软岸预判距离 ×1.6 + 内收（"贴岸躲雨"）。
- **`F(x,.5)≡1`**：所以 50 档逐位等于原版（`check-weather-fish.cjs` 断三个乘数精确 1/1/0，且源码无 `Math.random`）。
- 实测鱼层（模拟 8 秒后）：多云 **-0.311** / 小雨 **-0.621** / 大雨 **-0.926**，跨运行逐位稳定；"贴岸占比"从 0.44 涨到 0.58–0.78（但它跨运行会翻号，**只做遥测不做门**）。

**闪电（`weather.js`）——瞬态偏移，绝不改基准。**
- 只在雨量 ≥.75（滑杆 ≤12.5，即"大雨"档）自动触发，平均 7–16 秒一次；一次"闪"＝3 个错峰指数拖尾（合起来一条带余辉的亮脉冲）。
- 实现是**先算基准再叠加**：`applyLights()` 里先按 `BASE × 天气` 求出基准（同时缓存 `sun.color` / `hemi.color` 到 `state`），再 `+flash×系数`。`flash` 归零 → 偏移恒 0 → **逐位回到基准**（`restoreWorks` 守这条）。
- **踩坑**：闪电按**绝对时间**衰减（`performance.now()`），不能只用 `update(dt,t)` 的 dt——暂停（dt=0）时旧写法会把画面卡在半亮。
- 雷声 `oceanLife.thunder(power)` 用**已有** WebAudio 总线（同一只 `#ocean-sound` 开关 + 同一个 master 增益），音频关着时只计数、完全静默。

**本轮挖出的两个真 bug（都不是新写的功能，是旧代码）**
1. **`ocean-life.js` 一开音效就每帧抛错**：`initAudio()` 里 `...;const buffer=…` 的逗号声明把 `filter` 也变成了**局部** const，外层 `filter` 永远是 `null` → 点「海洋音效：开」后 `update()` 每帧 `Cannot read properties of null (reading 'frequency')`，主循环直接断（3.31 就埋着，因为主循环不冒泡到页面事件所以一直没人看见）。修法：`filter=audio.createBiquadFilter();` 单独一行，并把守卫改成 `if(audio&&master&&filter)`。
2. **投喂结束后的兜底分支把鱼常年顶在水面**：`goalY` 三元式在**不投喂**时也走 `.05`，等于让 34 条鱼常年贴在水面（"鱼层"整个失效、雨天压深也看不出来）。修法：不投喂时回落到自己的 `homeY`（雨天用 `wetY`），只有真在追鱼食时才上浮。

**测试写法教训（值得复用）**
- 想断言"某个输入真的改变了行为"，必须**每档都固定同一颗随机种子**再量（`Math.random` 换成 LCG）。否则鱼群的随机路径不同，观测量光靠路径噪声就能差 0.15，比要测的效果还大——那是拿噪声当门。
- 但**播种也救不了所有指标**：带"群心/相位"性质的量（群聚半径、贴岸占比）在跨运行时会翻号，这种只能做遥测；**只把确定性量（乘数、平均深度）当门**。
- 验音频别只看函数返回值：本机用 `p.addInitScript` 把 `AudioContext` 换成子类，把 `destination` 指向一个**真 AudioNode 中转站**（`master → hop → realDest`，analyser 从 hop 抽头），再用 `getFloatTimeDomainData` 实测波形。**不要**用普通对象/Proxy 冒充 `destination`：原生 `connect` 只认真 AudioNode，会 `Overload resolution failed`。

## 素材模型：火山与小紫（3.29–3.30）
用户给了 `D:\AI\小岛` 的三套 Tripo/Sketchfab 模型（FBX + 4K 贴图）。这类素材**不能直接加载**：项目是免构建 +
经典脚本 + 双击能跑，three r160 的 FBX/GLTF loader 只有 ESM 版（`file://` 下必挂）。所以走**离线转换**，
产物是 `models/` 下两个"数据经典脚本"（几何 base64 + 贴图 data URL，`window.__glbDecode` 解码），
`index.html` 里紧跟 `three.min.js` 加载（只有数据、不碰 9 个运行时脚本的顺序）。

| 换成了什么 | 做法 | 关键点 |
|---|---|---|
| **火山**（`art-direction.js`） | 模型裁掉平沙盘 → 合并成 1 网格 → 缩放 9.5 挂进 `volcano` 组 | `mountain`/`rim` **保持不可见但可被射线命中**，"点火山喷发"没改；`rootedWorks` 断言模型底面低于该处沙滩 0.226（扎进沙里，别再做出悬浮平板——3.19 的教训） |
| **小紫**（`island.js` 的 `type===2`） | 粉龙切成 7 块（躯干/脖子+头/尾/四腿），**枢轴烘到关节**，挂到原代理位置 | 这是"**保骨架换皮**"：`water-pet.js` 的动作一行没改。**脖子块的 `position.y` 必须 >1.5**（它的启发式靠这个把脖子吸进自己的 neck 枢轴）；躯干必须占用 `g.children[0]`（它拿 `d.g.children[0].material` 当皮肤做阶段配色） |

- **贴图必须 `flipY=false`**：glTF 的 UV 约定与 three `TextureLoader` 默认（flipY=true）相反，不改会上下翻转；`file://` 下外链 PNG 还会被 CORS 拦，所以一律内联 data URL。
- 转换脚本都在 `D:\Deepseek _file\`：`_probe-model.py`（体检）、`_split-model.py`/`_volcano-crop.py`/`_pink-split.py`（切块/裁剪）、`_glb2js.mjs`/`_glb2js-parts.mjs`（GLB→经典脚本）、`_tex-pack.py`/`_inline-tex.mjs`/`_pink-inline.mjs`（贴图压缩与内联）、`_probe-model-view.cjs`（双协议渲染验证）。
- **别用 PowerShell 读写带中文的源文件/脚本**（GBK 往返会把注释变乱码）；**中文路径也别直接传给 Blender**（argv 编码会坏）→ 先把素材拷到 ASCII 路径。
- 遗留：刚性分块在**大幅度**转动时可能露出一点接缝；要彻底消掉得上骨骼 + `SkinnedMesh`（three 核心自带，但要把 joints/weights/逆绑定矩阵也打包）。

## 翼龙飞行空间与岛上方白云（3.28）
- **翼龙的路径在 `island.js` 的 `animate()` 里**（`dinosaurs.forEach((d,i)=>{if(i===3){…}`），写的是**岛局部坐标**——
  别按世界单位调：`island` 组缩放 **.55**、还带自己的 y 偏移，世界值要用 `getWorldPosition` 实测。现参数：
  `rad=11.5+sin(t·.289)·2.5`、`x/z=sin/cos(t·.22 与 t·.2486)·rad`、`y=12.9+sin(t·.403)·4.4+sin(t·.05)·.8`
  → 世界水平半径 4.9–7.7、高度 5.6–11.3。位置是**缓动跟随**（不是硬写），所以抢食（`pet-life` 接管 `movers[3]`）结束后不会瞬移；
  朝向 = 路径切线（`rotation.y=-atan2(dz,dx)`，翼龙鼻子朝 +x），另有 `rotation.z` 侧倾（`pet-life` 的打招呼翻身会临时盖住它）。
  **高度下限受火山制约**：`check-sky-flight.cjs` 量出火山世界顶 **5.28**，鸟最低必须 > 5.43，否则削山顶。
- **天上只有一种云**：远景 12 朵（`clouds` 数组，走 `x±140` 回绕）。3.28 加的"岛正上方 4 朵小白云"（`addIslandCloud` + `islandClouds`）
  **在 3.41b 被用户要求删掉了**（他圈出那几朵小的说"删除掉自己多小云"）→ 别再加回来；`skyLife.islandClouds` 已不存在，
  `check-sky-flight.cjs` 的 `islandCloudsGone` 会拦住它。加新云时注意：**远景云那套回绕/漂移逻辑只有一份**，别又长出第二个数组。

## 点击聚焦规则（3.26–3.27）
**画布上点动物一律不动相机**，只给反馈：`announce(id)` = 写 `#card` 文案 + 点亮物种按钮 + `dino.hello` + 打招呼 toast。
**唯一的聚焦入口是底部四个物种名字按钮**（`[data-id]` → `select(id)` → `focus=id; distance=23`）。
点火山仍是 `erupt()`。改这条规则时记得 `check-click-focus.cjs`（四只逐只验）与 `check-pet-target.cjs`（小紫那一路）都在守。

## 水下平视：恢复入口 → 随即按用户要求删除（3.24）
3.23 把顶部「水下平视」换成「设置」后 `#underwater` 消失、`underwaterView` 成了死代码。3.24 我先把它恢复成
可反复开关的按钮（并配 `check-underwater-view.cjs`），**用户随后要求删除该功能** → 最终**整个删掉**：
`index.html` 不再有该按钮，`island.js` 不再有 `underwaterView` / `setUnderwater`（相机目标恒为 y=1），
检查脚本与截图一并删除，**当时**套件是 13 个 `check-*.cjs` + `verify-art.cjs`（现已到 21 + 1，见 §2.4）。
`_baseline/` 里点 `#underwater` 的 4 个旧探针（`island-base-ab` / `island-foot-ab` / `island-wing-ab` / `island-foot-views`）
**永久失效**，别当成套件跑。同一轮保留下来的改动是修正 `art-direction.js` 里那段仍描述 3.19 第一版（抬海床接岛）的过期注释。

## 3.33 整岛替换更新
用户完整 FBX 已取代旧静态岛景，见 development-notes 3.33。新增 assets/island-model/model.js 在 art-direction 前加载（仅数据）。fullIsland.model 为新岛；legacy 为离场旧景物。islandBeach 只保留兼容解析接口，不能据此判断新岛网格形状。新裙边名称 imported-island-foundation。islandCrater 为新喷发位置。新增 check-island-model，当前共23个脚本。
