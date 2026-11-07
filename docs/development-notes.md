# 恐龙岛 · Web 版开发记录

本文件记录接手（2026-10-12）时的工程审计、本次改动和复现方式。Godot 版记录见
`../../dino-jelly-godot/docs/development-notes.md`。

## 1. 工程定位

| 项目 | 内容 |
|---|---|
| 运行入口 | `http://127.0.0.1:8795/`，由本目录 `serve.cjs`（node，静态服务，端口 8795，绑定 127.0.0.1）提供 |
| 页面入口 | `index.html`（无需构建，直接双击也能跑；`three.min.js` r160 本地内置） |
| 渲染 | Three.js，程序化建模，无外部模型/网络依赖 |

加载顺序与职责：

| 文件 | 职责 |
|---|---|
| `three.min.js` | Three.js r160（MIT） |
| `island.js` | 场景主体：相机/光照、岛、火山、恐龙、水体网格与着色器、投喂、牵引海水、喷溅、鱼群、动画主循环 |
| `art-direction.js` | 美术总调：相机基线、ACES 色调、海面体积着色器、天空 PMREM、沙滩/火山/棕榈重建、静态几何合批、浅滩、接触阴影、昼夜光照 |
| `seabed.js` | **本次新增**：水下生态（海床、礁石群、砾石、海带、珊瑚），世界坐标建模 |
| `water-pet.js` | 紫水龙「小紫」：本地存档养成、安抚/玩耍、玩具、下潜捕食、面板 UI |
| `ocean-life.js` | 水下反馈：涟漪环、尾迹、气泡、学校鱼群 AI、分岔/碰撞规避、海洋音效 |

脚本之间通过全局裸名（`water`、`island`、`dinosaurs`、`swimmers` 等 `const`）通信，
新脚本必须排在它依赖的脚本之后；本轮 `seabed.js` 因此排在 `art-direction.js` 之后。

## 2. 接手审计发现

1. **世界坐标不一致（已修）**：`island` 组被 `art-direction.js` 缩放到 `.55`（岸线世界半径约 5.8），
   但 `island.js` 里的旧 `reef` 生态仍按缩放前的半径 10.8 摆放在 `scene` 里。
   结果 24 丛礁石/海带落在开阔水域中，看起来像漂浮的灰色碎屑，且海床不可见。
2. **旧检查失效**：`check-purple-pet.cjs` 期望「点一下 #pet-care 就 +2 信任」，
   但现在的交互是「先点按钮进入安抚模式，再点小紫」（`check-pet-target.cjs` 已覆盖新流程）。
   该检查在改动前的备份上同样失败，属历史遗留，不是本轮引入。
3. **手机端面板换行**：390px 宽下 `#pet-panel` 的状态文字与按钮挤在同一行、文字被压成两行，
   在改动前的备份截图上完全一致，属历史遗留，本轮一并修掉。
4. 桌面截图基线：`errors=[]`、无头 Chrome 约 144fps、绘制调用 1231 / 三角面 346744。

审计截图保留在 `_baseline/`：`baseline-1440.png`、`baseline-390.png` 是改动前状态。

## 3. 本轮改动

### 3.1 水下生态重建 `seabed.js`（新文件）
- 移除 `island.js` 遗留的 `reef` 组（含被岛体完全遮住的底座圆盘）。
- 海床：28×28、80×80 段平面，`floorY()` 决定高度 —— 近岛浅台抬升 0.4，向深水缓降，
  叠加 3 层 value noise 起伏；顶点色从浅滩沙 `#ecd7ab` 过渡到深水沙 `#8c8577`。
- 礁石群 8 处（每处 1 个宽底座 + 3–5 块顶石）、砾石 70 颗、海带 16 丛（5–9 根/丛）、珊瑚 20 簇（含顶球），
  全部按材质合并成 5 个 mesh（原来 121 个），`castShadow=false`（水下不需要投影）。
- 确定性随机种子 `20261012`，保证每次截图布局一致、便于回归比对。
- 所有道具底面贴合 `floorY()`，最高点不超过 `y≈0.14`，不会插进小紫的活动水层。

### 3.2 海面透明度
`ocean-life.js`：`water.material.opacity` 由 `.86` 调整为 `.76`。
原因是水下内容在 .86 下只有 14% 能透出，海床与珊瑚完全读不出来；
.76 接近参考片里「透明果冻方块」的观感（A/B 截图：`.86/.80/.74/.66` 对比后确定）。
侧面水体 `waterBody` 不变，方块体积感保留。

### 3.3 手机端宠物面板
`water-pet.js` 的 `layout` 样式：`max-width:700px` 下状态行改为单行省略号、
按钮独占第二行，并把 `.species` 上移到 `bottom:104px`，避免与新面板相撞。

### 3.4 侧栏嵌入模式（`?embed=1` / iframe 自动）
用途：把游戏放进 DSH 右侧栏的「浏览器」标签页（或任何 iframe）实时观看。

- `index.html` 里新增一行判断：`?embed=1` 强制嵌入、`?embed=0` 强制保留完整 UI，
  都没写时，只有「被 iframe 嵌套 且 面板宽度 < 700px」才自动嵌入。直接打开不受影响。
- `studio.css` 追加 `body.embed …` 规则：隐藏落地页 `header`，导航改为紧凑换行的一行按钮，
  `#controls` 收进「调节海水」按钮，`#card` / `.species` / `#pet-panel` 缩小并贴底。
  右侧小岛实验室面板里的投喂／喷发／配色／三条滑杆／重置／暂停全部保留。
- `art-direction.js`：embed 模式下相机基线距离 61 → 46（窄高面板里把模型拉近，
  否则上下会留出大片空白）；`重置视角` 仍然回到同一条基线。

实测：420×760 面板里落地页头部占 193px、导航占 227px（合计 640px 高度的大半），
启用嵌入模式后头部为 0，水族箱占满面板；直接访问 390×844 的落地页外观不变。
在 1400×1168 下与改动前快照逐节点比对：可见 UI 节点 50/50，无删除、无新增、无显隐变化。

### 3.5 关于"远端边缘"：试过又撤掉的做法
上一轮试过"相机锚定海雾"：让 `scene.fog` 的带子跟着相机距离走，把远端的水面/侧壁/沙层
收敛到背景色，从而不画出那条背面硬边。用户评价"效果太奇怪"，且换成天空渐变背景后
雾色（单一颜色）无法匹配天空的渐变，远端反而重新显形 —— 因此**整套代码与 `check-far-rim.cjs`
已删除**，改为按参考图做"完整通透的方块 + 天空"（见 3.6）。记录在此以免重复踩坑。

### 3.6 天空与低多边形云 `sky.js`（新文件，按参考图）
参考图要的是「一整块通透的玻璃水块浮在淡蓝天空里，四周有低多边形云」，而不是把方块边缘化掉。

- **天穹**：半径 300 的球面（跟随相机、`depthTest/depthWrite:false`、`renderOrder:-100`），
  着色器按视线方向的 y 做 `smoothstep(-.32,.22)` 渐变，白天 `#6cbcf0 → #eaf6fd`，
  夜晚 `#0c1a2e → #22405f`。
- **云**：12 朵，每朵 5–8 个扁平的 `IcosahedronGeometry(1,0)`（平底、鼓顶）合并成 1 个 mesh，
  共 +12 draw call。**按"应为多少仰角"反推位置**：给定距离 190–300 与仰角 −18°…−4°，
  取 `y = EYE_Y + d·tan(仰角)`、尺寸 `= d·tan(角宽/2)`。因此从任何绕行角度它们都落在
  方块上方的天空带里，且因为距离始终 ≥130，永远不会糊到镜头前。云会缓慢横向漂移，
  越过 ±70 后回绕。
- **漂浮呈现**：隐藏原来的 250×250 影棚地面 `floor`，接触阴影缩到 34×34 并下移到方块底面之下；
  玻璃棱线（`cutEdges`）透明度提到 .45。相机远平面 160 → 420，否则 190 开外的云会被裁掉。
- 昼夜按钮外层再包一层，切到夜晚时天穹/云一起变色。

踩过的坑（都已在代码注释里标注）：云若把世界坐标烘焙进几何、又用 `mesh.position` 漂移，
回绕判断会让整朵云瞬间跳到 −272 飞出画面；云若放在 45–85 这种中距离，转到近侧时会正对镜头糊成一块。

### 3.7 透过水体不再看到"背面内壁"（远端侧壁剔除）+ 视角上限放宽
问题（用户圈图）：透过水面能看到远端侧壁的**内表面**，形成一条贴在方块背边上的深色带，
以及底部的背侧海床边线、转角线，水面因此显得不"整体"。

定位：把 `waterBody` 整个隐藏后那条内壁带消失 → 确认它来自侧壁的**内表面**。

修法：让侧壁只画**朝外**的那一面，近端侧壁保留（剖面），远端侧壁被背面剔除掉：

- `island.js` 的 `updateWaterSides()`：每段的两片三角形绕序翻转，
  使几何"正面"朝外（`[a下,a上,b上, b上,b下,a下]`）。
- `art-direction.js`：`waterBody.material.side` 由 `DoubleSide` 改为 `FrontSide`。

实测：远端内壁的深色带消失（`_baseline/far-rim-crop.png`），远端只剩水面边缘一条干净的线；
远端海床不再有可见边线；转 90°/斜角同样成立（`_baseline/wallcheck-rot.png`）。
近端剖面、`水下平视`（相机 y=−0.1）下的水体断面都保持正常。

同轮放宽取景范围：俯仰角上限 `phi` 由 0.25 放宽到 **0.08**（≈85° 俯视，接近正上方），
缩放上限由 65 放到 **80**（`island.js` 的滚轮/双指、`water-pet.js` 的拖拽同步改）。

### 3.8 水下装饰加密（`seabed.js` 第二轮）+ 水面通透度
参考图的水下很"满"：冷灰大石、粉/青/紫的珊瑚、绿海草、彩色小鱼、上升气泡串。
原先的水下只有灰色礁石 + 深绿海带 + 稀疏珊瑚，而且被水面洗成灰绿。

改动：
- **水面不透明度 `.76 → .60`**（`ocean-life.js`）。`.76` 时水下只剩 24% 的颜色透出，怎么加装饰都是灰的；
  试过 `.50`——水下更清但方块失去"果冻海"体积感，最终取 `.60`（A/B 见 `_baseline/duo-*.png`）。
- **礁石**：8 → 11 处，高度 .50–.92，色板换成**冷蓝灰** `#c3ccd2 / #93a0a9 / #74828c / #dbe2e6`，
  在水色里比原来的暖棕灰显眼得多。
- **海带**：16 → 24 丛（每丛 5–10 根），绿色提到 4 档并整体调亮。
- 新增 **54 处海草簇**（每簇 3–5 片短锥叶，亮绿），对应参考图沙滩上的小绿芽。
- 新增 **珊瑚家族**：24 簇分枝珊瑚（管+顶球）、18 簇海葵/管珊瑚（一圈短管呈放射状，含底座）、
  12 块盘状珊瑚（短柄+扁平盘）；色板为 6 色高饱和 `#ff8fb0 / #ff7a59 / #4fd8e8 / #b48cf0 / #ffd166 / #7fe0c0`。
- 新增 **气泡泉**：14 个喷口、90 个气泡，用 **1 个 InstancedMesh** 承载（只 +1 draw call），
  从海床升到水面后循环重来，带轻微摆动与由小变大的膨胀感；每帧由 `window.seabedLife.update(t)` 驱动
  （挂在 `island.js` 既有的每帧钩子上）。
- **小鱼**：30 → 34 条，4 色提亮（橙/青/粉/黄），体型 .22 → .27。

合并后水下共 **9 个 mesh**（原来 5 个）；绘制调用 988 → 1025，三角面 37.9万 → 41.5万。
`check-seabed.cjs` 相应升级为真断言：无旧 reef、mesh 数 8–12、海床逐点贴合 `floorY()`、
气泡确实在上升（0.7s 内 Δy≈0.95）、水面不透明度 <0.7，全部 `ok=true`。

### 3.9 水面读成一整块（去掉远端的"浅色带 + 内圈线"）
用户圈图指出：斜面看过去，水面在离方块边缘约 3 个单位处有一条内圈界线，界外是一条发白的带，
透过它还看得到沙床的颜色，于是水面被切成"外带 + 内部"两块，不是一整片。

排查过程（都做了运行时差分，脚本留在 `_baseline/`）：

1. `edge2.cjs` 逐层隐藏：`water` / `waterBody` / `seabed` / 地层 / 角线 → 确认那条带属于**水面本身**。
2. `exp-edge.cjs`：
   - E1 把水面着色器注入整体关掉 → 带消失，水面变成均匀青色；
   - E2 把"边缘 3.15 单位波浪压平掩码"改成 0.8 → **没有变化** → 说明不是几何/位移造成的。
3. `band-probe.cjs` 跨带读像素：边缘处是 `(224,236,239)` 近白 → 内部 `(114,177,173)` 青色，
   是一条约 30–50px 的**渐变**而不是硬线。
4. `env-test.cjs`：只把 `water.material.envMapIntensity` 从 .62 降到 .15、`clearcoat` 归零，
   同一像素立刻从近白变成青色 `(122,191,200)` → 认定是**掠射角下的天空反射**压过了水色。

修法（`art-direction.js`）：
- `water.material.envMapIntensity` `.62 → .18`、`clearcoat` `.45 → .10`；
- 着色器里的掠射项 `viewFresnel*.35 → *.15`；
- 顺带把 `shelf` 径向染色由 `smoothstep(5.5,10.5,r)*.16` 改成 `smoothstep(0,24,r)*.07`，
  避免它在 r≈10.5 处留下第二道界线。

实测：同一角度的扫描线变成 天空 →(149,197,204)→ 一路青色，不再有近白带
（`_baseline/final-edge.png`、`final-highangle.png`）；默认视角仍保留水面的波纹高光
（`final-default2.png`）。代价是掠射角的天光反射变弱，水面比之前"哑"一点；
若要更亮，把 `envMapIntensity` 往 .3 调即可，但浅色带会回来一些。

### 3.10 水深渐变（可调）+「水深」滑杆
需求：水体要**越深越暗**（越靠近海床颜色越深），并且深浅可调。

做法：一个共享 uniform `depthMix`（0–1）同时驱动三处，面板第 4 条滑杆「水深」直接改它
（`art-direction.js` 里 `document.querySelector('#depth').oninput`）：

1. **水面**：`deep=smoothstep(1.5,15.5,length(vSea.xz))`，越往外（海床越低）越暗、越偏深青：
   `diffuseColor.rgb*=1.-.17*deep*uDepthMix;` 再混入 `.14*deep*uDepthMix` 的深色。
   梯度从岛边一路铺到方块边缘（不是上一版 `shelf` 那种中途结束的环），因此不会再出现内圈界线。
2. **侧壁**（`waterBody`）：`vWaterDepth` 竖直渐变，底部颜色由 `#0a8fa3` 加深到 `#054b58`、顶部 `#4fd2de`；
   曲线也随档位变化：`depthRamp=mix(.6, smoothstep(0,1,vWaterDepth), uDepthMix)`
   —— 档位 0 时退化成单一色调，100 时是完整的上浅下深。
3. **海床与水下装饰**（`seabed.js`）：`merge()` 与海床网格都写入逐顶点属性 `aDepth = 水面高度 − floorY(x,z)`，
   着色器里 `diffuseColor.rgb*=1.-.34*smoothstep(1.85,2.50,vDepth)*uDepthMix`
   —— 珊瑚/海草顶端水浅所以更亮，底部沙床水深所以更暗，符合直觉。

实测（同一像素列，档位 0 / 65 / 100，水体中段 RGB）：
`(104,170,165) → (81,140,136) → (77,116,112)`，档位越低越亮、越高越暗，趋势单调且可逆。
默认档 65；截图 `_baseline/depth-final.png`、`depth-slider-{0,55,100}.png`。

顺带记录一次事故：用 PowerShell 的 `Get-Content -Raw | Set-Content -Encoding UTF8` 改 `index.html`
会把中文标签写成乱码（同一天第二次踩同一个坑）。已从快照恢复并用编辑工具重做；
以后**不要用 PowerShell 读写带中文的源文件**。

### 3.11 水色由水深决定（浅处通透 / 深处浓重），并压掉表面白网
需求修正：不是"整体按档位变深"，而是像真实海洋——**浅的地方通透见底、深的地方颜色浓重**，
且不要出现随机深浅的斑块。

改动：

1. **把海底地形真正拉开**：`floorY` 的浅台抬升由 0.40 加到 **0.46**、基准面 −1.28 → **−1.34**，
   于是岛边水深约 2.00、外缘约 2.53（实测 `waterDepth` 属性范围 2.003–2.526）。
2. **水面拿到逐顶点水深**：`seabed.js` 给水面几何写入 `aDepth`（0 = 最浅、1 = 最深，按实测极值归一化），
   着色器里 `vBathy` 直接驱动颜色与**透明度**：

   ```glsl
   float deep = clamp(vBathy,0.,1.)*uDepthMix;
   diffuseColor.rgb *= mix(1.14,.66,deep);        // 浅处更亮、深处更暗
   diffuseColor.rgb  = mix(diffuseColor.rgb,vec3(.02,.34,.40),deep*.20);
   diffuseColor.a   *= mix(.62,1.35,deep);        // 浅处更透、深处更实
   ```

   配合 `oceanLife` 的基准 `.60`，浅处实际约 0.37（几乎看得到沙）、深处约 0.81。
3. **压掉表面"白网"**：`lightNet` 系数 `.08 → .035`、`broadGlint/brokenGlint` `.14/.48 → .11/.34`、
   `silver` `.28 → .20`。原来那层网纹会在水面上造出随机亮斑，把"按水深变色"的观感冲掉。
4. 「水深」滑杆仍然有效：0 档 → 上面的 `deep` 归零，回到均匀单色。

实测：默认视角下岛边能看清沙床/珊瑚/小鱼，外缘转成浓重的深青；高空斜视同样（`_baseline/bathy2-*.png`）。
`check-*` 全套 exit=0。

### 3.12 水面叠加"水皮"贴图层 + 海底深浅贴图
需求：① 水面能不能单独加一层贴图，用它把还没解决干净的海床线挡掉；
② 海底的深浅能不能用**贴图的颜色**来表现。

两件事都做了，都是**程序生成的贴图**（不引入外部素材）：

**① 水皮叠层**（`seabed.js`，1 个 draw call）
- 一张 512² 的 canvas 贴图：底色 `#e8f6f6`，叠 220 个柔和云斑 + 110 条漂移条纹（明暗两色），
  `RepeatWrapping` 且 `repeat 1.7`，所以是细密的水纹而不是大块图案。
- 网格**复用 `water.geometry`**（同一个几何体），只把 mesh 抬高 0.014、`renderOrder=3`、`depthWrite:false`
  —— 这样它自动跟着水面一起起伏，不会穿帮、也不会 z-fighting。
- 着色器里贴图只负责"纹路"，**颜色和透明度由水深决定**：
  `rgb *= mix(vec3(.88,1.06,1.06), vec3(.05,.34,.40), skinDepth)`、
  `a *= mix(.20,1.00,skinDepth)`（`skinDepth` 来自水面那份 0-1 水深读数）。
  于是浅处几乎看不见（0.42×0.20≈0.08），深处变实并压暗——**深处那点残留的海床线就是被这层盖掉的**。

**② 海底深浅贴图**（`seabed.js`）
- `createDepthTexture(512)`：逐像素按**真实地形**算水深，`d = clamp((深度-2.0)/0.55,0,1)`，
  颜色 `#f2ddb2`（浅滩沙）→ `#c9c19a` → `#7c8f8d`（深水冷色），再叠 fbm 斑驳与
  `sin` 沙纹（越深越弱），最后作为 `seabed.material.map`。
- 海底的顶点色改成只做 ±10% 的明暗斑驳（接近白），把"颜色"这件事整体交给贴图，职责更清楚；
  逐顶点 `aDepth` 的水深压暗仍然叠加在贴图之上。

实测：默认/斜视/剖面三个角度下，浅滩通透见底、外缘浓重，深处没有可见的海床线
（`_baseline/skin3-*.png`）；绘制调用 994，全套 `check-*` exit=0。

### 3.13 用本机 Photoshop 生成两张贴图（水纹 / 海底深浅）
用户提议：贴图可以直接用电脑上的 PS 做。

环境：Photoshop 2025 装在 `E:\Adobe\Adobe Photoshop 2025\Photoshop.exe`，
注册了 COM ProgID `Photoshop.Application`（LocalServer32），因此可以用
`New-Object -ComObject Photoshop.Application` + `DoJavaScript(jsx)` 驱动它批处理。
生成脚本：`_baseline/ps-textures.ps1`（内含 ExtendScript），产物在 `assets/`。

- **`assets/water-skin.png` 1024²**：青色底 `rgb(150,216,222)` + 一层 50% 灰
  `applyClouds()` → `applyOceanRipple(6,10)` → `applyMotionBlur(0,60)` → `applyGaussianBlur(1.2)`
  → `adjustLevels(40,225,1.0,96,255)`（抬到亮部）+ 高斯噪点，图层用 **Multiply 88%** 叠在青底上。
- **`assets/seabed-depth.png` 1024²**：白底 → 用 72 边形选区在中心填黑（半径对应真实浅台
  `6.1/28×1024≈223px`）→ `applyGaussianBlur(96)` 得到平滑径向深浅 → 叠一层 34% Overlay 的云
  → `applyOceanRipple(2,4)` + `applyAddNoise(3)`。**存成灰度**：0=浅滩、255=深水。

> PS 2025 里三个常用老 API 已经不可用，脚本里都换了替代：
> `selection.selectEllipse()` 不存在 → 用多边形 `selection.select()`；
> `layer.applyWave()` 参数签名对不上 → 用 `applyMotionBlur()` 拉条纹；
> `layer.adjustCurves()` 报"非法参数" → **颜色映射改到着色器里做**（下面第 3 点）。

接进项目（`seabed.js`）：
1. `TextureLoader` 读取两张 PNG，读到后替换掉程序生成的 canvas 版本并置 `userData.source='photoshop'`；
   **文件缺失时仍用 canvas 版本兜底**，双击即可运行不受影响。
2. 水纹贴图 → 水皮层的 `map`（`ClampToEdge`，`repeat=1`，避免云纹出现接缝）。
3. 深浅贴图是**灰度**的，所以着色器里加了 `uPalette` 开关：
   `float ramp=clamp(diffuseColor.r,0.,1.);` 再走 沙色 `(.95,.87,.66)` → 中间 `(.78,.76,.58)`
   → 深色 `(.34,.45,.46)` 的三段映射。这样色板仍可在代码里实时调，不用回 PS 重导。

实测：页面 `errors=[]`，`seabedMapW=1024`、`skinMapW=1024`、`seabedPalette=1`，
绘制调用 1034，全套 `check-*` exit=0（`_baseline/ps-tex-default.png`）。

### 3.14 水纹贴图 v2：更稀疏的流动条纹
用户要求再出一版、条纹更稀疏。PS 脚本里把"云彩"换成**单色噪点 + 长距离动感模糊**，靠
"前置模糊量 + 色阶窗口"两个旋钮控制稀疏度：

| 层 | 前置模糊 | 动感模糊 | 色阶窗口 | 混合 | 不透明度 |
|---|---|---|---|---|---|
| lanes（主流动带） | 8 | 角度 18°，260px | 122–142 | 正片叠底 | 34% |
| fine（细流，另一角度） | 5 | 角度 54°，150px | 126–144 | 正片叠底 | 18% |
| grain（颗粒） | — | — | — | 叠加 | 12% |

调参过程中确认的三条经验（都踩过）：
- `applyClouds()` 用的是**前景/背景色**，会把水染成黄绿 → 改用 `applyAddNoise(…, GAUSSIAN, true)`
  的单色噪点，天然是灰的（PS 2025 里 `adjustDesaturate()` / `adjustCurves()` 已不可用，无法事后去色）。
- 前置模糊太小 + 色阶窗口窄 → 满屏**发丝状**纹理（像拉丝金属）；前置模糊太大 → 什么都看不见。
  最终取 8 / 5 这档。
- 混合模式用**正片叠底**而不是叠加：叠加灰层会改色相（偏黄绿），正片叠底只压暗、保住青色。

产物：`assets/water-skin.png`（v2，稀疏流动带）；上一版留档为 `assets/water-skin-v1-cloudy.png`，
想切回去只要把文件改名覆盖即可。海底深浅图同时重出了一版（结构一样，噪声不同）。
实测：页面 `errors=[]`，`check-*` 全套 exit=0（`_baseline/lanes-default.png`、`lanes-block.png`）。

### 3.15 宠物之间的互动 `pet-life.js`（新文件）
四只动物原来各走各的，这轮给它们加了**跨物种互动**。模块在 `island.js` 的动画之后运行
（`window.petLife?.update(dt)` 插在 waterPet/oceanLife 之后），所以可以对当帧的位姿做覆盖——
和 `water-pet.js` 处理蛇颈龙用的是同一套办法。

| 互动 | 触发 | 表现 |
|---|---|---|
| **打招呼** | 点底部任一物种按钮 | 该动物做本种动作：迅猛龙点头（`rotation.x` 起伏 + 小跳）、腕龙转长脖子、翼龙翻身（`rotation.z`）、小紫探头（原有 care 反应 + 水面涟漪）；**离它最近的那只也会转头看过来**，toast 报出双方名字 |
| **抢食** | 投放小鱼（60% 概率） | 翼龙俯冲到投食点叼走小鱼 → 水面涟漪 + "翼龙从水面叼走了一条小鱼！"；若小紫先到（<0.9 单位）则它先吃到，记一次 "share" |
| **岸边低头** | 小紫进入离岛 6.4–9.2 的岸边带 | 腕龙走到那一侧的沙滩、**脖子下压到水面**（`neck.rotation.z → −0.9`）+ toast；小紫游回深处则脖子抬起 |
| **沿岸伴游** | 同一条岸边带 | 迅猛龙沿沙滩跑到与小紫同一方位角（局部半径 8.6）伴游 |

实现要点：
- 腕龙的脖子用**独立枢轴**（`neck` 组 + `attach()` 把脖子/头/眼睛的网格挂进去），和
  `water-pet.js` 处理蛇颈龙完全一致，因此不影响原有的行走动画。
- 水面事件（俯冲、岸边）用 8 个环形 mesh 的复用池做涟漪。
- `pet-life.js` 通过包装 `window.waterPet.feed()` 拿到投食点（和项目里其它"包一层处理器"的写法一致）。
- `water-pet.js` 新增 `setNote()`：面板多一行 `<small id="pet-note">`，显示"刚刚：…"的最新互动。
- 为可测性加了 `window.petLife.probeShore(x,z)`：用任意坐标跑一遍岸边/伴游规则并返回结果，
  这样检查脚本不必等蛇颈龙自己游过去。

验证（`node check-pet-interactions.cjs`，`ok=true`）：
- 打招呼：四个物种各点一次 → 计数 +4，四条 toast 文案齐全；
- 抢食：把小鱼的投点放在离小紫 10 单位外（并把 `Math.random` 打桩成定值）→ 翼龙抢食计数 +1，toast 正确；
- 分食：把投点放在小紫身上 → 它先吃到，share 计数 +1，面板显示"小紫抢先吃到了小鱼"；
- 岸边：`probeShore(7.6,0)` → visiting=true、neckTarget=−0.9、escorting=true；
  `probeShore(12.5,0)` → 三项全部归零；
- 自然运行 6 秒内至少发生一次岸边/伴游事件。

### 3.16 「投喂小鱼」也能喂岛上的恐龙
原来 `dropFeed` 只接受水面命中（点到岛上会提示"点击海水投放饲料"）。现在：
- `island.js` 的投放路由改成命中水面 → 原有鱼类逻辑；命中**岛屿** → `window.petLife.feedLand(point)`，
  两条路径都扣饲料、都更新袋子；提示文案改为"点击海水或小岛投放饲料"。
- `pet-life.js` 新增陆地投喂：落点先用**垂直向下射线**投到岛面（避免落在棕榈叶/岩石上），
  选**最近的陆地恐龙**（迅猛龙 / 腕龙 / 翼龙，翼龙改为悬停啄食），撒 6 颗小鱼干，
  恐龙走过去 → 一颗颗吃掉（每 0.42s 一颗，边吃边冒爱心）→ toast + 面板记录 + 计数。
- 三只动物吃完各自走回自己的节拍再交还给 `island.js`。

**这轮修掉一个真 bug**：`island.js` 每帧对恐龙的位置/朝向是**绝对赋值**
（`d.g.position.x=d.base.x+sin(...)`），所以之前互动里用 `position += ...` 的位移会被当帧抹掉——
恐龙其实几乎没动过（early 的岸边/伴游因此观感很弱）。现在模块**自己持有坐标**（`movers[id]`），
每帧**绝对写回**，互动结束后再缓动回 `base` 并交还控制权。抢食俯冲、岸边走位、伴游、陆地投喂全部改走这条路。

验证（`check-pet-interactions.cjs` 扩充到 6 项，`ok=true`）：
- 陆地投喂走**真实点击**：进投喂模式，把岛心投到屏幕坐标后 `mouse.click` → 断言
  `fed` 计数 +1、事件队列清空、toast 为"腕龙吃到了小鱼，凑过来蹭了蹭你"、面板显示"在小岛上撒了一把小鱼干"；
- 其余五项（打招呼 / 抢食 / 分食 / 岸边低头 / 自然触发）保持通过。

### 3.17 修：陆地恐龙跑进海里
上一轮给岸边伴游用的目标半径写的是"世界 8.6"，但**岛的干沙只到世界半径约 4.3**
（海滩再往外就沉到水面 1.15 以下了），于是迅猛龙和腕龙会一路走进海里。

修法：加一个**陆地夹取** `clampToLand(x,z)`（`DRY_RADIUS=4.0`，世界坐标），所有陆地目标都过一遍：
- `landPoint(bearing, radius)`：腕龙站 **3.2**（稍靠内，大个子），迅猛龙贴沙边 **4.0**，
  且迅猛龙的方位角 **+0.4 弧度**错开，两只不会叠在一起；
- `feedLand()`：落点先投到岛面，再夹进干沙范围——玩家若把饲料丢在浅水滩上，食物会落在沙边而不是漂在水面；
- 抢食俯冲、翼龙悬停不受影响（本来就是水上/空中动作）。

验证：`check-pet-interactions.cjs` 增加第 7 项 `onLandWorks`——连续 14 次采样迅猛龙与腕龙的世界半径，
断言最大值 ≤ **4.35**（实测 4.00，正好是夹取上限）。全套检查 exit=0。

### 3.18 小紫的成长阶段（外观）+ 真正的扑咬捕食
遗留清单里第 2 条「成长只有数值，没有阶段外观变化 / 无真实捕食动画」这轮做掉。

**成长模型**（`water-pet.js`）：成长点 = `meals`（你亲手投喂、它游过来吃掉的鱼）+ `hunts`（它自己猎到的鱼），
`hunts` 是这轮新增的持久化字段（`schema_version` 仍是 1，旧存档按缺省 0 读入，不迁移）。
门槛 **0 / 3 / 8 / 16** → 幼生期 / 幼体期 / 亚成体 / 成体，`stageOf(points)` 是纯函数，`window.waterPet.stages` 暴露门槛表。

**外观**：四个阶段各自改一次模型，都是"建一次、按阶段开关"的做法：

| 阶段 | 门槛 | 体型 | 肤色 | 新增可见部件 |
|---|---|---|---|---|
| 幼生期 | 0 | ×.80 | `#a68ad0` 淡紫 | — |
| 幼体期 | 3 | ×.92 | `#a875d6` | 第 1 片背鳍 |
| 亚成体 | 8 | ×1.04 | `#9a63dd` + 自发光 .05 | 第 2 片背鳍、尾鳍 |
| 成体 | 16 | ×1.16 | `#8b4ee0` + 自发光 .14 | 4 片背鳍、侧腹发光点 |

- 背鳍/尾鳍/发光点共 8 个网格，一次性建好挂在 `d.g` 上，**没长出来的阶段 `visible=false`**，所以前期不占绘制调用；
  它们也写进 `pickables`（`userData.dino=2`），长大后点击小紫的可点区域跟着变大。
- 四只鳍肢按阶段放大（`.5 → .63`，保留原始各向异性缩放）。
- 成体背部露出水面更多——因为放大是绕 `d.g` 原点做的，观感上"长大了"更明显，这一步是刻意保留的。
- 升级时 `toast('小紫长大了：成体')` + 三颗爱心 + `reaction`，面板第一行改成 `阶段 · 成长 x/y`
  （`white-space:pre-line`，两行显示；手机端同步改成 `pre-line`，由 `check-mobile-layout.cjs` 守不溢出/不裁切）。
- 面板 `title` 显示当前 `mood`（原来 `mood` 只写不显示）。

**扑咬**：原来猎物进嘴 1.05 就直接 `visible=false`，看不出捕食动作。现在：

- 嘴到猎物的距离进入 **1.05–2.6** 时置 `strike`，冲刺速度 **2.8 → 5.2**，脖子下压前伸、四鳍快摆（`clock` 驱动的抖动）；
- 咬中时 `respond('bite',1.1)`——新增的第三种动作：抬头猛合、鳍划一下、眼睛眯起，配三颗爱心 + toast；
- 冲刺累计 **2.2 秒**没咬到就放弃（`strike=null`），回到普通巡游，下一次靠近再冲；
- `swimState` 离开 hunt（上浮 / 被玩家互动打断）时一定清 `strike`，不会带着冲刺姿势浮上水面。

**验证**：新增 `check-pet-growth.cjs`（12 项断言，`ok=true`，`errors=[]`）：

- 门槛：`[0,2,3,7,8,15,16,40] → 0,0,1,1,2,2,3,3`，且 `stageOf` 与 `stages` 表一致；`setGrowth(0,8).stage===2` 证明"猎到的鱼"同样计数；
- 外观：体型单调增、四阶段四种颜色、背鳍 0/1/2/4、尾鳍 0/0/2/2、发光点 0/0/0/2、成体自发光 > 0、鳍肢变大；
- 面板：四个阶段的面板文本都含阶段名，`setGrowth(9,0)` 后刷新页面仍是"亚成体 9/16"（存本机）；
- 旧存档：用 `addInitScript` 写入一份没有 `hunts` 字段的 v1 存档（`meals:12`、`trust:40`）再刷新 →
  仍是"亚成体 12/16"、`hunts=0`、`trust=40`，没有 NaN。（注意 `pagehide` 的自动保存会覆盖 reload 前
  手写的 localStorage，所以这一步只能用 init script 注入。）
- 捕食：把 `swimmers` 摆到轨迹上跑 14000 帧（和 `check-pet-dive.cjs` 同一手法），断言确实出现 `striking`、
  采样到 `action.kind==='bite'`、`catches` 与 `hunts` 都 +1；
- 截图 `pet-growth-baby.png` / `pet-growth-adult.png`（`viewLocked` + 定时把 `target` 贴到小紫身上做同机位对比），
  裁切对照片在 `_baseline/crop-pet-growth-*.png`。

回归：`check-seabed` / `check-pet-interactions` / `check-embed-pane` / `check-mobile-layout` /
`check-purple-pet` / `check-pet-growth` 全部 exit=0、`ok`/`passed` 为 true，无 pageerror。

**顺手修一个一直红着的旧检查**：`check-purple-pet.cjs` 断言"点 `#pet-care` 按钮直接 `trust+2`"，
但按钮从"直接安抚"改成"选模式再点小紫"以后就不再加信任了（`#pet-care` 的 `onclick` 只调 `setMode`），
所以它一直是 `passed:false`（不是本轮改坏的：本轮没碰按钮、`care()`、`lastCare`）。
现在按真实交互重写：点「安抚」→ 在屏幕上找到小紫并左键点它 → 断言 `trust+2`、12 秒冷却期内再点不加、
刷新后 `trust` 保留（`before 12 → armed 12 → after 14 → cooled 14 → restored 14`，`passed:true`）。

### 3.19 岛基连上海床（两轮：先删悬空圆片，再让岛体沙坡接到海床上）
用户先后圈了两次，是同一处地形的两个阶段：**第一张图**（水下平视，岛底下像一块悬空的沙盘，红标记在左右两条边上）
根因是 `art-direction.js` 的 `shoal` 浅滩环；**第二张图**（岛周围一圈带硬边的平台）根因是**我第一版修法自己造成的**——
把海床在岛缘抬成 -0.16 平台。两版都记在这里，包括第一版为什么不行。

**量出来的事实**（探针 `_baseline/island-base.cjs`，`_baseline/base-before-pane.png`）：

- 可视岛体已经不是 `island.js` 那两个圆柱了——`art-direction.js` 第 109 行把它们 `visible=false`，
  换成一层程序生成的 **beach 沙坡**（`rings=22,sectors=128`）。它的外缘：`border=10.3±.45sin(3a+.8)±.22sin(7a)`
  乘岛体缩放 **.55** → 世界半径 **5.36–5.84**，外缘高度 `y=-.49±.07`（局部）→ 世界 **-.23~-.31**。
- 海床（`floorY`）在同一半径只有 **-0.87**，中间差了 0.6 —— 岛底**确实是悬空的**。
- 悬空那块"沙盘"是 `art-direction.js` 的 **`shoal`**：`RingGeometry(5.2,7.5)` 平放在
  **y=-.5（±.045）**，比海床高 0.4；它半透明 `#9cc9af/.24`，水下平视就是一块横贯左右的扁圆盘
  ——**正是「已知遗留」第 4 条**（"水下 shoal 浅滩环……是一块悬浮圆片"）。

**第一版修法（只保留了"删圆片"这一半，接岛的方式已被第二版取代）**：

1. `art-direction.js`：**删掉 `shoal` 圆片**（5.2–7.5 那圈 RingGeometry 与材质）。它当年的作用是
   "岛边浅滩的绿调"，现在改由海床的**顶点色**给：按 `smoothstep(r, SHORE, SHORE+3)` 把靠近岛的沙色
   往绿偏（顶点色是相乘，只做色偏），不需要任何额外面。**这一半保留至今。**
2. `seabed.js`：把 `floorY` 换成"在岛缘抬到 `FOOT_Y=-.16` 的平台"：
   `floorY=lerp(lagoonY, -.16, 1-smoothstep(t,.99,1.12))`（`t=r/footEdge(a)`）。
   **这半是错的**：`-.16` 比沙滩外缘（-.23~-.31）**还高**，于是在岛缘形成一圈"领圈"——
   平台往外只以约 22° 落到泻湖剖面，而沙滩外缘本身是 52°；平台又比周围海床高 0.7，
   水浅 → 水色更亮，水下平视就是**一圈又亮又平、边缘带硬线的圆形板**，正是第二张图圈的东西。
   （`_baseline/footab-*-before.png` 忠实复现了这一版。）

**最终修法**：不再让海床为岛让路，而是**让岛体自己的沙坡继续往下长、扎进海床**：

1. `art-direction.js`：beach 保持 `rings=22`，**再加 `skirt=2` 圈**（`u` 继续取 23/22、24/22 = 1.045、1.091），
   高度照旧用同一个公式 `1.44-.08u-1.85u⁷+.07sin(5a+6u)·u`。因为参数就是同一个 `u`，
   **岛体（u≤1）的顶点一个都没变**，u>1 的两圈自然延续同一条曲线（位置与坡度都连续）。
   裙脚最外圈落在世界半径 **5.84–6.37、y≈-1.09~-1.17**，比同处海床低 **0.2~0.29** → **扎进去了**；
   最深处仍在切面水块底面（-1.39）之上，不会从方块底下穿出去。裙脚顶点色从 `u=1` 起渐变到
   海床浅滩色 `#cfe6c6`，所以出岛缘不会留下色差线。网格命名 `island-beach`，并导出解析剖面
   `window.islandBeach={edge,y,uMax}` 供自检用。
2. `seabed.js`：**撤销第一版的抬高**——`floorY` 回到纯泻湖剖面（`lagoonY/footEdge/beachY` 全部删掉）。
   礁石／海带／海草／珊瑚／气泡的摆放**一行未改**，自动回到原位；第一版加的**浅滩绿调顶点色保留**
   （它接替了被删掉的 `shoal` 的绿调），地板网格保持 `112×112`。
   水深贴图与水面的逐顶点水深本来就按这条剖面算，所以**水面观感两轮都没变**。

**验证**：

- `check-seabed.cjs` 的 `islandFootWorks`（真断言，`ok=true`），7 个方位各自检查：
  ① 裙脚外圈 `y < floorY − 0.15`（实测低 **0.2~0.29** → 与海床无缝隙）；
  ② 出岛缘坡度 **−1.26~−1.43**（沙滩外缘解析坡度 −1.26 → 同一坡度延续，不是平台）；
  ③ 海床在 `0.9×` 与 `1.3×` 外缘半径处的高差 **0.036~0.102 < 0.12**（没有为岛抬起的领圈/平台）；
  ④ 场景里找不到 `RingGeometry(5.2,7.5)`；⑤ `island-beach` 网格存在、最外圈到 **r≈6.4**。
- **忠实 A/B**（`_baseline/island-foot-ab.cjs`）：`paused=true` 冻结同一帧后，把**海床网格的顶点高度与
  `aDepth` 就地改成上一版剖面**拍 before、再恢复拍 after——两张只差地形本身，颜色/水色/深度色调一致。
  对照片 `_baseline/footab-grid-user.png`、`_baseline/footab-zoom.png`：before 是那圈又亮又平、
  边缘硬线的板，after 是岛体沙坡融进海床。
  （这轮先试过"把平板网格注回场景"：**不够**——注入的平板是纯色、没有深度色调，和周围沙色太接近，
  测出来只差 0.01~0.4%；改成就地改顶点后才忠实复现。）
- 数值：海床仍是 **9 个网格**、绘制调用 **1025** 不变；三角面 45.4 万；`errors=[]`。

### 3.20 成长影响行为（2026-10-13）

- water-pet.js：四阶段能力表控制巡游/追球/捕食速度、潜水目标深度与时长、下潜速度、顶球力度与间隔。保留幼生全水域探索；安全距离随体型扩大。
- 幼生到成体：巡游 1.05→1.60，追球 2.2→3.3，水下探索 10→22 秒，目标深度 −0.58→−0.78。能力从现有成长点推导，schema_version:1 无需迁移。
- 修复投喂跨阶段时没有立即更新外观的问题。
- 新增 check-pet-capabilities.cjs：独立页面测量四阶段实际位移、最低深度、最长连续捕食时长、100 秒模拟内边界约束、零 dt 不移动，ok:true。
- node --check 通过；12 个 check 脚本及 verify-art 均 exit 0。成长、跨物种、存档、目标点击、海床等带断言脚本 ok/passed true。旧 dive/actions/toys/ocean 脚本部分仅输出探针结果，没有总通过断言，不将退出码当成功能证明；实际 toys 输出 rotated:true、hearts:3、spawned:true、hits:8，ocean 输出尾流8/气泡11/捕获2，errors为空。
- 日志：_baseline/growth-behavior/。成长截图 pet-growth-baby.png / pet-growth-adult.png 已生成，成体截图已检查。
- 仍为轻量规则导航与阶段参数，尚未实现骨骼游泳动画或物理碰撞；范围检查针对导航中心和体型余量，不是全网格碰撞证明。

### 3.21 鱼群变速、抢食和逃逸（2026-10-13）

- ocean-life.js：每条鱼创建一次随机 pace，叠加不同相位的慢速变化，速度与朝向平滑过渡；不逐帧随机跳速。
- 连续投喂叠加 foodEnergy（上限 3），随时间指数衰减；只吸引附近 9 单位内的鱼。受惊优先于抢食，水下小紫近距离触发 panic，捕猎时扩大感知半径，左右分流并增大间距；危险消失后约数秒恢复。
- 对目标与实际位置均执行水域约束，隐藏的被捕食鱼不参与分离计算。未增加模型、draw call 或存档字段，复用运算向量减少原循环临时对象。
- 新增 check-fish-behavior.cjs，验证个体速度差异、连续投喂兴奋度、逃逸加速、恢复巡游、零 dt 和水域边界。测试 ok:true，零 pageerror；独立联动模拟中小紫成功捕食一次。
- 这是规则驱动的鱼群模拟，尚未加入饱食度、真实流体动力学或鱼种差异。
- 回归日志保存于 _baseline/fish-behavior/。

### 3.22 互动按钮移入右侧面板

移除重置视角、暂停及对应绑定，将安抚/玩耍移至原位置；底部保留成长信息，删除重复按钮。互动模式、右键/Esc 取消保持一致。更新 verify-art 验收入口；目标点击和手机布局检查通过。

### 3.23 设置面板与实验室折叠

顶部水下平视改为设置，波浪阻尼/潮汐/水深移入独立浮层，柔软度保留。实验室右上角减号收起、加号恢复；手机初始收起。真实点击检查三滑杆、折叠恢复、安抚和手机溢出均通过，无 pageerror。截图 _baseline/settings-layout.png 与 settings-mobile.png。

### 3.24 水下平视：先恢复入口，随后按用户要求彻底删除 + 修正过期注释（2026-10-13）

**背景（第 1 条过期点）**：3.23 把顶部「水下平视」换成「设置」之后，`#underwater` 这个元素不存在了，
`underwaterView` 只剩 `select()` 里"把它置 false"的分支——**视角进不去**（死代码）；靠
`p.click('#underwater')` 拍水下地形 A/B 的 4 个 `_baseline/` 探针（`island-base-ab`、`island-foot-ab`、
`island-wing-ab`、`island-foot-views`）也一并失效。

**第一版处理（已撤销）**：我先把入口恢复成"可反复开关"的按钮（`setUnderwater()` 记下并精确还原 `phi/distance`），
并配了 `check-underwater-view.cjs`（5 项断言全绿）。**随后用户明确要求「删除水下平视」**——所以最终结论是
**把这个功能整个删掉**，不留按钮、不留状态、不留检查：

- `index.html`：nav 里不再有 `#underwater`（现为 设置 / 锁定视角 / ☀ 白昼）。
- `island.js`：删掉 `setUnderwater` / `underwaterButton` / `underwaterReturn` 与按钮绑定；`let` 声明里的
  `underwaterView` 一并删除；`select()` 回到 `if(!viewLocked)focus=id;`；主循环的相机目标
  `underwaterView?-.1:1` → `1`。grep `underwaterView|setUnderwater|underwaterButton|水下平视` **0 命中**，`node --check` 通过。
- 删除 `check-underwater-view.cjs`、两张对照截图 `_baseline/underwater-view-*.png` 及它的套件日志 →
  套件回到 **13 个 `check-*.cjs` + `verify-art.cjs`**。
- 副作用：`_baseline/` 里那 4 个点 `#underwater` 的旧探针**永久失效**（本来就不在套件内）；要看水下机位得自己改机位或临时改代码。

**保留下来的半件事（第 2 条过期点，已修）**：`art-direction.js` 里解释 `shoal` 圆片被删的那段注释，
原文仍在描述 3.19 **第一版已撤销**的做法（"seabed.js now raises the real sea floor up to the beach rim"）
——照它写代码就会去抬海床。已改成第二版事实：沙滩 `skirt` 继续长到 `floorY` 以下 0.2–0.29、浅滩绿调烘进海床顶点色，
并写明**别抬海床**。

**回归**：全套 14 个脚本（13 个 `check-*.cjs` + `verify-art.cjs`）`exit=0`、零 pageerror，日志 `_baseline/suite-3.24-final/`。

### 3.25 鱼群行为：从 fish-behaviour 移植四样（2026-10-13）

用户给了 yutang 那边提取出来的零依赖库 `D:\Deepseek _file\yutang\fish-behaviour\src`，问「这些文件能不能套用上」。
先做了实测评估（探针 `_fishbehaviour-island-probe.mjs` 五组对照 + `_probe-esm-load.cjs` 加载方式），结论是
**能套，但不能原样 import**：

1. 岛的鱼水域是「±12.5 方框 + 中间 r≥6.8 的岛」，用库自带的 `rectBounds` 跑 3600 帧有 **97,260 鱼·帧落在岛里**（鱼直接穿岛）——
   必须写它那份可插拔的 provider（`soft/contains/project/routeClear`）；
2. 库里 `feed()` / `update()` **写死了 8px 食料余量**，在 25 世界单位的小世界里喂食完全失效（吃到 0 颗）；
3. 岛的鱼按身长算比库里的锦鲤快约 12 倍，库的默认转向率（0.66 rad/s ≈ 转弯半径 2.4 世界单位，而水环只有约 5.7 单位宽）
   会让鱼不停撞岸（实测被拒 9.95 次/帧）；
4. 库是 ESM：经典脚本页面里 `await import()` 在 **http://127.0.0.1:8795/ 下成功、`file://` 下失败**
   （`Failed to fetch dynamically imported module`）——要保住"双击 index.html 就能跑"就不能直接引它。

按用户选的路线 ①：**只补岛上缺的四样，不换渲染、不换单位、不引 ESM**，全部落在 `ocean-life.js`。

| 移植项 | 落在哪 | 实测 |
|---|---|---|
| **闲逛 wander** | 每条鱼自己持有 `target`/`wander`，4–12 秒换一个合法水域内的随机目标（24 次拒绝采样，r>7.4 且 \|x\|,\|z\|<12.1），再叠 28% 的群锚保留"分三群绕岛"的观感 | 30 秒内每条鱼换 **4–7** 个目标 |
| **逐颗鱼食** | 读 island.js 的鱼食数组 `fish`（点水面投喂生成的 8 颗网格），挑最近且**视线不被岛挡住**（`routeClear` 8 点采样）的一颗去追；**嘴（身长前 38.5%）水平 0.22 内、深度差 <0.5 才算吃到**，吃掉时从数组移除 + `dispose()` + 冒涟漪 | 暂停模式 8/8、追食时 8 条鱼浮离本层；实况 5 秒内 8/8 |
| **转向惯性** | 角速度连续累积（`turnSmoothing` 6/8），按状态限速 3.2（巡游）/5（觅食）/3.6–4.5（受惊）；沿"当前朝向"前进，不再直接朝目标平移 | 单帧转向速率峰值 **3.19 rad/s**（= 巡游上限），轨迹不再瞬间折向 |
| **起惊脉冲** | `oceanLife.startle(x,z)` 把 0.85 秒的脉冲种进 2.2 半径内的鱼（越近越强），速度 ×(2.4+脉冲)；**右键牵引海水会自动调用它**，鱼群被搅散 | 同一条鱼 1.04 → 2.88 速度、模式 `flee`；0.85 秒后归零回 `cruise` |
| 顺带（为让闲逛在 3D 水域里成立，非库里原有） | ① **软岸预判**：离岛缘/水块边 < `max(.6, 速度×1.6)` 时提前外推，否则闲逛目标会把鱼按在岸上；② 追食时鱼会上下浮到自己够得着的水层，吃完回 `homeY`；③ 吃食判定用"水平 0.22 + 深度差 0.5" | `check-fish-school.cjs` 全绿 |

**顺手修掉一个只有实况才暴露的问题**：`island.js` 的鱼食原先 **2 单位/秒**下沉（约 1.2 秒就沉到海底被清掉），
鱼根本来不及游过去——暂停模式的自检（把鱼食冻住）完全测不出来；改成 **0.6 单位/秒**（约 4–5 秒生命期）后实测 8/8 被吃掉。
`check-fish-school.cjs` 因此专门加了一段**实况相位**（解除暂停、按真实参数投食、等 5 秒再断言）来守这条。

**验证**：新增 `check-fish-school.cjs`（闲逛目标重挑、逐颗觅食、转向速率上限、起惊脉冲与淡出、零 dt 不动、水域边界、实况吃食），
连跑 3 次全绿、`errors=[]`；`check-fish-behavior.cjs`（3.21 的语义）**一行没改**仍 `exit=0`：
`cruise 34 巡游 / fed 15 觅食+19 巡游 / scared 6 逃逸（最高 4.09）/ recovered 34 恢复巡游`。
全套 15 个脚本 `exit=0`、零 pageerror，日志 `_baseline/suite-3.25/`。
视觉：`_baseline/fish-school-chase.png`（俯视：8 颗鱼食 + 12 条鱼围过来）、`_baseline/fish-school-preview.png`。

**没做的**（别当已做）：库的 `motion.js` 脊线弯曲/胸鳍用不上——岛上的鱼是"躯干球 + 尾锥 + 眼"三个网格，
要整条脊线得先重做鱼模型；季节/天气/`reducedMotion` 速度系数也没接（岛上没有这套状态）。

### 3.26 点小紫不再动相机（2026-10-13）

用户原话：「点击宠物时，视角不需要动。」——原先"点动物聚焦"和小紫的"撸它"是两套处理：安抚/玩耍模式下点小紫，
`island.js` 的 canvas 点击会 `select(2)`（`focus=2; distance=23`）先把镜头拉过去，`water-pet.js` 才执行 `care()/play()`，
于是每撸一下镜头就跳一次。

改法（**点小紫一律不动相机**，两种读法都覆盖）：

- `island.js`：把 `select(id)` 拆成 `announce(id)`（写 `#card` 文案、点亮物种按钮、`dino.hello`、打招呼 toast）
  与"移动相机"两半；点击命中 `userData.dino===2` 时只 `announce(2)`，**不碰 `focus/phi/distance`**；
  点其他三种动物照旧"点击聚焦"。
- 聚焦小紫仍然可用：底部「蛇颈龙」按钮走 `select(2)`（`focus=2; distance=23`）。
- 互动本身一行没动：`water-pet.js` 的 care/play 逻辑不变。

**验证**：`check-pet-target.cjs` 重写成 4 组断言（`trustWorks` / `cancelWorks` / `noPetCameraWorks` / `speciesFocusWorks`），
实测**模式内点小紫** `trust 12→14` 而 `theta/phi/distance/focus` 全不变（`0.71 / 1.16 / 61 / null`），
**普通点击**同样不动，点底部物种按钮才 `focus=2, distance=23`；`ok=true`。
全套 15 个脚本 `exit=0`、零 pageerror，日志 `_baseline/suite-3.26/`。

### 3.27 画布点动物一律不聚焦（2026-10-13）

紧接 3.26 的第二句：「连其他三只恐龙也点不动镜头，只有在点击下方名字按钮时才会聚焦。」
于是把规则统一成：**画布上点任何动物只给反馈（`#card` 文案 + 打招呼 + `dino.hello`），一分都不动相机；
聚焦只有一条路——底部的物种名字按钮**（`#species` 里那四个）。

- `island.js`：canvas 点击命中 `userData.dino!==undefined` 时改调 `announce(id)`（3.26 拆出来的那半），
  不再条件分叉；`select(id)` 现在**只被物种按钮调用**（`focus=id; distance=23`）。
- 点火山（`dino===undefined`）仍然 `erupt()`，没变。

**验证**：新增 `check-click-focus.cjs`——四只逐只在画布上点（每次都重算"真的能命中它"的屏幕点）：
`theta/phi/distance/focus` 全部不变（`0.71 / 1.16 / 61 / null`），且 `#card` 文案换成该动物（证明这一下被当成"看介绍"而不是被忽略）；
再点四个名字按钮：`focus=0/1/2/3`、`distance=23`（唯一聚焦路径）。`ok=true`。
`check-pet-target.cjs` 的 `noPetCameraWorks` / `speciesFocusWorks` 同时仍然成立。
全套 **16 个脚本（15 个 `check-*.cjs` + `verify-art.cjs`）`exit=0`**、零 pageerror，日志 `_baseline/suite-3.27/`。

### 3.28 翼龙飞行空间扩大 + 岛正上方的小白云（2026-10-13）

用户：「翼龙的飞行空间可以扩大到差不多半个岛屿这么大，还有上下空间也要扩大，让它的飞行空间更加自由一些。
然后在小岛垂直上方要有几朵飘着小白云。」

**① 翼龙飞行空间**。原路径 `cos(t*.35)*8 / 6+sin(t*.8)*.6 / sin(t*.35)*7`，而恐龙是挂在**缩放了 .55 的 `island` 组**里的
——换算成世界坐标只有 **水平半径 4.4、高度 3.3±0.33**，等于一直贴着岛顶绕一小圈。现在（仍是岛局部坐标）：

| 项 | 现在 | 世界坐标 | 旧值（世界） |
|---|---|---|---|
| 水平 | `rad=11.5+sin(t·.289)·2.5`，`x=sin(t·.22)·rad`、`z=cos(t·.22·1.13)·rad` | 半径 **4.9–7.7**（直径约 15 ≈ 半个水块） | 直径 8.8 |
| 高度 | `y=12.9+sin(t·.403)·4.4+sin(t·.05)·.8` | **5.6–11.3**（跨度 5.7） | 3.0–3.6（跨度 0.66） |

两条不同频率的正弦交叉 → 路径不再是一个闭合椭圆；位置改成**缓动跟随**（`1-exp(-dt·2.4)`），
抢食结束回队形时不再瞬移；朝向按路径切线算（鼻子是 +x，所以 `rotation.y=-atan2(dz,dx)`），另加一点转弯侧倾 `rotation.z`。
高度下限是**被断言逼出来的**：第一版给到世界 4.87，`check-sky-flight.cjs` 量出**火山世界顶 5.28** → 会削到山顶，于是整条飞行带抬高约 1.1 世界单位。

**② 岛正上方的小白云**：`sky.js` 里加了 4 朵（`addIslandCloud`）——每朵仍是"合并成一个网格"（**+4 draw call**），
与远景云共用 `cloudMaterial`（昼夜一起变色）。位置：水平半径 **1.1–3.0 世界**（岛的可见半径约 6，所以都在正上方）、
高度 **12.4–14.8 世界**（整体压在翼龙最高点 11.3 之上，互不穿插），只在很小范围里来回飘 + 轻微起伏；
它们**不参与**远景云那套 ±140 的横向回绕，单独走 `islandClouds` 数组，`skyLife.islandCloudCount` 可查。

**验证**：新增 `check-sky-flight.cjs`（实况采样 20 秒、64 个样本）：

| 断言 | 实测 |
|---|---|
| `pterosaurSpaceWorks` 水平最远 ≥5.5、高度跨度 ≥2.5、`\|x\|,\|z\|` ≤13 | 水平 **7.77**（旧 4.4）、跨度 **4.89**（旧 0.66）、max\|xz\| **7.53** |
| `clearsVolcanoWorks` 最低点 > 火山顶 +0.15 | 最低 **6.002** vs 火山顶 **5.28** |
| `islandCloudsWorks` ≥3 朵、每朵单网格、水平半径 ≤4、最低 ≥9.5、3 秒内漂移 >0.05、整体高于翼龙 | **4 朵**、半径 ≤ **3.463**、最低 **12.104**、漂移 **3.776**、翼龙最高 10.893 |

截图 `_baseline/island-clouds.png`（4 朵云悬在岛上方、翼龙在高处盘旋）。
全套 **17 个脚本（16 个 `check-*.cjs` + `verify-art.cjs`）`exit=0`**、零 pageerror，日志 `_baseline/suite-3.28/`。

> **追记（3.41b，2026-10-14）**：本节 ② 「岛正上方的小白云」**已被用户要求整组删除** —— 他在截图上圈出那几朵小的，说
> 「删除掉自己多小云」。删掉的是 `addIslandCloud` + `islandClouds` 数组 + 每帧漂移循环 + `skyLife` 上的两个 getter；
> 远景 12 朵**不动**。`check-sky-flight.cjs` 的 `islandCloudsWorks` 相应换成 **`islandCloudsGone`**（断言 API 不存在、
> 远景云恒 12 朵）。上面的表格与截图保留为 3.28 当轮的历史记录，**不要再按它加云**。

### 3.29 火山换成素材模型（2026-10-13）

用户：「火山岛不单只是换椎体，整个模型文件都替换上去。」（`D:\AI\小岛\volcano+island+3d+model.zip`）

- **离线处理**（`_volcano-crop.py`）：导入 FBX → 只删掉那块**平沙盘**（1,758 面；留着会重演 3.19 里被圈过的悬浮平板）
  → 其余 57 块（火山锥 / 熔岩口 / 棕榈 / 草木 / 石子 / 白烟团）**合并成 1 个网格 8,762 三角面**
  → `_glb2js.mjs` 内联成 `models/volcano-island.js`（几何 523 KB + 1K 贴图 JPEG data URL，共 717 KB）。
- **落位**（`art-direction.js`）：模型缩放 **9.5**、轴线 `(0.072,-0.020)`、锥底 `y=0.167` 对齐到原程序锥底（group 局部 `y=-0.03`）。
  9.5 是**比出来的**：8 / 9.5 / 11 三档各拍一张（`_mods-out\volcano-scale-*.png`），8 偏小、11 会把模型自带的草木埋进沙里。
- **程序火山只让位不删除**：`for(child of volcano.children) if(child!==model) child.visible=false`（30 个部件）
  —— `mountain` / `rim` 保持"不可见但可被射线命中"，所以 island.js 里 `[...pickables,mountain,rim]` 的**"点火山喷发"行为一个字没改**。
- 贴图：`flipY=false`（glTF 的 UV 约定；three 的 `TextureLoader` 默认 `flipY=true`，不改会上下翻转）。

**验证**：新增 `check-volcano-model.cjs`（6 项）：模型是 `volcano` 子节点、8,762 面、贴图 flipY=false；
volcano 下只有它 visible（30 个让位）；**`rootedWorks`——模型包围盒底面比该处沙滩表面低 0.226（扎进沙里，不是悬浮板）**；
真实点击火山 → `eruptionUntil` 前进 + 35 颗火星；draw call **987（原来的 1,037 → −50）**；零 pageerror。

### 3.30 小紫换成素材粉龙（2026-10-13，「保骨架换皮」）

用户：「只用粉色龙替换水里的长颈龙。」（`D:\AI\小岛\pink+dinosaur+3d+model.zip`）

粉龙是**一整块连通网格**（20,779 面里 19,741 面在一块），而小紫的动作全靠"程序骨架 + 子网格"驱动
（脖子枢轴、四鳍摆动、四阶成长的背鳍/尾鳍/发光点、阶段配色）。所以没有做骨骼蒙皮，而是**保骨架换皮**：
在 Blender 里把它切成 7 块、**每块的枢轴烘到关节**，挂到原来的代理位置上 —— 于是 `water-pet.js` 的动作代码一行都不用改。

- 切块（`_pink-split.py`）：躯干 / 脖子+头 / 尾 / 四条腿，`_glb2js-parts.mjs` 转成 `models/pink-plesiosaur.js`（19,783 面，868 KB，含 1K 贴图 data URL）。
  - **切面要重叠**：可动块用宽松阈值、躯干用严格阈值（脖子 `z>0.44` vs 躯干减 `z>0.52`…），否则转动时能看到接缝（第一版就是"脖子一圈领口"）。
  - **躯干枢轴固定成模型原点**，这样躯干成员随切割变化也不会破坏装配关系（所有块共用同一条仿射映射 `g = O + S·pivot`）。
  - 坑：FBX 导入自带 +90°X 旋转，别用 `rotation_euler=` 去转（会覆盖它让模型躺下）；也别再转 180°（实测导入后头已经在 +x）。
- 游戏侧（`island.js` 的 `type===2` 分支）：`S=3.22`、`O=(0,.046,0)` —— 让躯干中心落在 `(0,1.05,0)`、脖子底落在 `y≈1.70`。
  **`y>1.5` 这条是刻意的**：`water-pet.js` 就是靠"`position.y>1.5` 的子网格"把脖子吸进它自己的 neck 枢轴，够不到这条启发式脖子就不会动。
  躯干直接替换 `island.js` 一开始建的那个 `body` 网格的几何与材质（它必须是 `g.children[0]`——`water-pet.js` 拿 `d.g.children[0].material` 当"皮肤"做阶段配色/自发光）。
- `water-pet.js`：只加了"成长部件锚点可被模型覆盖"（`d.growthAnchors` → 背鳍贴粉龙的背 `y=1.48`、尾鳍贴它自己的尾尖 `x=-1.62`），**动作逻辑一行没改**。
- `art-direction.js`：给程序小紫套的"遮盖关节管"（`organicTube`）在粉龙模式下跳过（否则管子会穿模型）。

**验证**：新增 `check-pink-plesiosaur.cjs`（4 项）：
`modelWorks`（`g.children[0]` 是 `pink-body`、贴图在、模型 19,783 面、四鳍都能摆）；
**`actionsWorks`（真点小紫安抚 → `action='care'` 且脖子枢轴 `rotation.z` 转到 -0.057 再回 0 —— 证明动作真的还在）**；
`growthWorks`（成体 4 背鳍 / 2 尾鳍（`x=-1.62`，在粉龙自己的尾尖上）/ 2 发光点、配色 `#8b4ee0`、体型 1.16）；
`pickWorks`（仍可被射线拾取）。全套 **19 个脚本（18 个 `check-*.cjs` + `verify-art.cjs`）`exit=0`**，日志 `_baseline/suite-3.30/`。
截图：`_mods-out\volcano-after.png`、`_mods-out\pink-closeup.png`。

**代价与遗留**：脖子/腿根在**大幅度**转动时仍可能露出一点接缝（刚性分块，不像骨骼蒙皮那样连续）；
要彻底消掉得上骨骼 + 蒙皮（three 核心自带 `SkinnedMesh`，但要把 joints/weights/逆绑定矩阵也打包成经典脚本数据）。

### 3.31 天气滑杆（下雨 ↔ 晴天，2026-10-13）

用户原话：「增加下午天气功能，，下雨开关可以放在ui栏的拉条 调整。以中间为界限，越往右边越是晴天，越往左边越是大雨天。」
（"下午天气"按"天气功能"理解；形态按他说的做成拉条。）

- 新增 `weather.js`——**第 9 个运行时脚本，放在最后**：它只调节别的模块已经建好的东西（灯/天穹/云）+ 加一个雨的 draw call，**不碰 8 个脚本的顺序**。
- UI：实验室面板（`#controls`）在「柔软度」下面加 `#weather` 滑杆（0–100，默认 **50**）+ 状态文字 `#weather-note`（大雨/小雨/多云/晴/大晴）。
  **50 = 原样**：`neutralWorks` 断言 50 档必须精确等于美术预设（hemi .58 / sun 3.15 / exposure .98 / 云纯白），所以既有检查一个都不受影响。
- 雨（左半）：一个 `LineSegments`（900 段上限，**整个雨只占 1 次 draw call**）用 `setDrawRange` 控雨量 → 0 档满 900 段、不透明度 .60；
  雨丝在 ±14 的水块上空下落并随风微斜；**雨点打在水面上**——复用 ocean-life 的涟漪环池（0 档实测同时有 15–29 个涟漪）。
- 晴（右半）：光照/曝光上调、太阳偏暖、天穹更蓝、云更白。
- 光照基准自带一份（`BASE.day/night`）：art-direction 的 `ART` 在它的 IIFE 里外部拿不到；每帧按基准**幂等**重算、不叠加，所以昼夜按钮与配色按钮都不受影响。
- 实测数字：0 档 `hemi .319 / sun 1.417 / exposure .853 / skyTop #9fb0bb / cloud #a9b8c2`；50 档 `.580 / 3.150 / .980 / #6cbcf0 / #ffffff`；100 档 `.684 / 3.938 / 1.039 / #5db6f1 / #ffffff`。
- **踩到的坑**：滑杆的 `id="weather"` 会让浏览器自动生成 `window.weather`（=DOM 元素）**把 API 顶掉**，于是主循环里 `window.weather?.update` 每帧 TypeError
  → API 改名 **`window.weatherLife`**（与 `skyLife`/`seabedLife` 一致）；同一轮也暴露出 `ART` 取不到的问题。
- 验证：新增 `check-weather.cjs`（6 项：滑杆在 UI 里 / 50=原样 / 越左雨越大且水面有涟漪 / 越右越亮越蓝越白 / **真实拖滑杆**生效 / draw call ≤1050）；
  全套 **20 个脚本（19 个 `check-*.cjs` + `verify-art.cjs`）`exit=0`**，日志 `_baseline/suite-3.31/`。截图 `_mods-out\weather-rain.png`、`weather-sunny.png`。

### 3.32 雨天鱼群联动 + 大雨档闪电与雷声（2026-10-13）

3.31 结尾我提的两个候选（「大雨档加闪电（+雷声走现有 WebAudio）」「雨天鱼群更活跃/更躲」）本轮按**最彻底**读法**两条都做**。

**(a) 雨天鱼群（`ocean-life.js`）——一条铁律：雨量只能有一个真源。**
- 真源＝`window.weatherLife.rain`（雨量 0–1，**0 = 多云原样**、1 = 大雨）。`ocean-life` 每帧从它现算，**自己不再存副本**（存副本就会出现"滑杆 50 却按 0 算"那种互相打架）。
- 归一化水位 `rainVal() = NR + 雨量/2`（`NR=.5` 是中性、1 是雨最大），所有效果都乘在已有参数上（`F()/NF()`）：
  速度 `×1.14`（鱼更活跃）、群聚间距 `×0.66`（扎得更紧）、目标水层 `-0.62`（往深处压）+ 软岸预判距离 ×1.6 且往岛缘内侧收（"贴岸躲雨"）。
- **`F(x,.5) ≡ 1`**，所以滑杆 50 逐位等于改版前（`check-weather-fish.cjs` 断三个乘数**精确** 1/1/0，并断 `weather.js` 源码里没有 `Math.random`）。
- 实测鱼层（模拟 8 秒后平均）：多云 **−0.311** / 小雨 **−0.621** / 大雨 **−0.926**，跨运行逐位稳定。
- 顺带修掉一个老 bug：`goalY` 的兜底分支在**不投喂**时也走 `.05`，等于把 34 条鱼常年顶在水面（鱼层整个失效）→ 改成回落到自己的 `homeY`（雨天用 `wetY`），只有真在追鱼食时才上浮。

**(b) 闪电 + 雷声（`weather.js` / `ocean-life.js`）——瞬态偏移，绝不改基准。**
- 只在雨量 ≥.75（滑杆 ≤12.5，即"大雨"档）自动触发，平均 7–16 秒一次；一次"闪"＝3 个错峰指数拖尾，合起来是一条带余辉的亮脉冲；`#weather-note` 打闪瞬间追加 ` ⚡`。
- 做法：`applyLights()` **先算基准**（`BASE × 天气`，并把 `sun.color`/`hemi.color` 快照进 `state`）**再叠加** `+flash×系数`。`flash` 归零 → 偏移恒 0 → **逐位回到基准**（`restoreWorks` 守这条），所以 50 档、昼夜按钮、配色按钮与 19 个既有检查全不受影响。
- 闪电按**绝对时间**（`performance.now()`）衰减，不能只用 `update(dt,t)` 的 dt——暂停（dt=0）时旧写法会把画面卡在半亮。
- 雷声 `oceanLife.thunder(power)` 走**已有**的 WebAudio 总线（同一只 `#ocean-sound` 开关 + 同一个 master 增益）：低频棕噪声 + 低通 + 慢衰减＝闷雷；音频关着时只计数、完全静默、不抛错。
- **闪电零 draw call**（纯信号驱动灯光/天穹）：实测多云 **981**、大雨 **1030–1042**（雨天只多雨丝那 1 次），闪电不改变这个数。

**(c) 本轮挖出的第二个真 bug：一点「海洋音效：开」主循环就断。**
`initAudio()` 里 `...;const buffer=…` 这串逗号声明把 `filter` 也声明成了**局部** const，外层那个永远是 `null` → `update()` 里 `filter.frequency` 每帧抛 `Cannot read properties of null`。因为主循环的异常不冒泡到页面事件，3.31 起一直没人看见（本机是**开音效**才会走到）。修法：`filter=audio.createBiquadFilter();` 单独一行 + 守卫改成 `if(audio&&master&&filter)`。

**验证**：新增两个检查脚本
- `check-weather-fish.cjs`（6 项）：50 档乘数精确 1/1/0 且源码无 `Math.random` / 越左鱼越深 / `setRain` 夹取 0..1 且非法值回落 .5 / dt=0 冻结 / 大晴档不碰鱼群 / draw call ≤1050。
- `check-thunder.cjs`（6 项）：真实打闪后灯光与曝光按 `flash×系数` 上调 / **闪完逐位回到基准** / 检测到 ≥2 个错峰脉冲 / 雷声在总线末端**实测到波形**（`addInitScript` 换 `AudioContext` 子类 + 真 AudioNode 中转站 + `getFloatTimeDomainData`，实测 peak 0.016）/ 只有大雨档自动打雷 / draw call 不变。
- 全套 **22 个脚本（21 个 `check-*.cjs` + `verify-art.cjs`）`exit=0`、零 pageerror**，日志 `_baseline/suite-3.32/`。
  截图：`_mods-out\weather-fish-rain.png`（大雨里鱼群沉到 −1.3）、`weather-fish-neutral.png`（多云回 −0.75）、`weather-lightning.png`（`flash=1` 那一帧）。

**测试写法教训（值得复用）**
- 想断言"某个输入真的改变了行为"，必须**每档固定同一颗随机种子**再量（`Math.random` 换成 LCG）。否则鱼群随机路径不同，观测量光靠路径噪声就能差 0.15，比要测的效果还大。
- 但**播种救不了所有指标**：带"群心/相位"性质的量（群聚半径、贴岸占比）跨运行会翻号——这种只做遥测，**只把确定性量（乘数、平均深度）当门**。
- 验音频别只看返回值：要用「真 AudioNode 中转站」把 destination 接到 analyser 上实测波形。**别用普通对象/Proxy 冒充 `destination`**——原生 `connect` 只认真 AudioNode，会 `Overload resolution failed`。

### 3.33 用户整岛 FBX 替换（2026-10-13）

- 来源：D:/AI/小岛/mods/tripo_convert_f6547073-6975-44cc-9950-71bc422572bb.fbx，用户提供；未修改源文件。
- Blender 5.2.2 LTS 导入：单网格，5599 顶点、6352 多边形，三角化 10520 面。保留完整沙滩、火山、棕榈、植被、岩石与静态烟团；贴图从 4096 缩到 2048。
- assets/island-model/model.js 为无依赖几何数据；albedo.png 为颜色贴图；source.blend 为离线源副本。tools/inspect-island.py、export-island.py、preview-island.py 可复现导入、导出、离线预览。
- index.html 在 art-direction.js 前加载数据，原运行时模块相对次序不变。art-direction.js 末尾替换静态岛景，原景物离开场景但存于 fullIsland.legacy，恐龙组保留。新岛世界缩放11.3，基点y1.05。
- 新增水下裙边 imported-island-foundation 延伸至y=-1.5，海床高度不变。原 islandBeach 解析接口仍保留供旧逻辑使用，不再代表可见新岛的精确表面。
- islandCrater=(.619,5.24,-1.225)，原火山射线代理与动态烟雾、喷发火星对齐新火山；静态白烟保留，尚未拆分动画。岛上动物仍使用已有平面导航，尚未针对每棵新树/山体建立网格寻路。
- check-island-model.cjs 新增整体替换/贴图/恐龙保留/喷发检查；check-volcano-model.cjs 改测新岛火山真实点击；check-seabed.cjs 使用新裙边实际顶点校验入海床。
- 截图：_baseline/full-island-overview.png、full-island-low.png；全套日志 _baseline/suite-3.33/。23 个脚本最终 exit=0；没有 ok/passed false。翼龙旧测试首次读取离场火山导致失败，已改为新火山口高度及新网格飞行路径射线，复测通过。

## 4. 复现与验收
前置：`E:\Nodejs\node.exe`、Chrome 位于 `C:/Program Files/Google/Chrome/Application/chrome.exe`、
Playwright 由 `../dy_runtime/node_modules/playwright-core` 提供、`serve.cjs` 已在 8795 运行。

| 命令 | 检查内容 |
|---|---|
| `node check-seabed.cjs` | 旧 reef 已移除、合并后 mesh 数、海床贴地、**岛基连海床（`islandFootWorks`）**、绘制调用、无 JS 报错，并输出 `seabed-preview.png` |
| `node check-embed-pane.cjs` | 侧栏/iframe 嵌入：420×760、360×640、520×900 自适应且无报错；直接访问仍保留落地页 |
| `node check-mobile-layout.cjs` | 390/360/1440 三档下面板不溢出、不与物种行/卡片重叠 |
| `node check-pet-target.cjs` | 安抚/玩耍模式：点击小紫生效、右键与 Esc 取消、相机不被误转 |
| `node check-pet-dive.cjs` | 水面/下潜/捕食状态机与捕获计数 |
| `node check-ocean-effects.cjs` | 尾迹、气泡、涟漪数量与无报错 |
| `node check-purple-pet.cjs` | 安抚模式互动：`trust+2`、12 秒冷却、刷新后存档保留 |
| `node check-pet-growth.cjs` | 成长门槛/四阶段外观（体型·配色·背鳍·尾鳍·发光点）/面板与存档/扑咬捕食 |
| `node verify-art.cjs` | 美术关键词与着色器注入点齐全 |
| `node check-fish-behavior.cjs` | 鱼群变速/抢食/逃逸（3.21 语义）：投喂叠加、逃逸加速、恢复巡游、速度差异、水域边界 |
| `node check-fish-school.cjs` | 鱼群四样（3.25）：闲逛目标重挑、逐颗鱼食（含**实况下沉竞速**相位）、转向速率上限、起惊脉冲与淡出、零 dt、水域边界 |
| `node check-click-focus.cjs` | 点击聚焦规则（3.27）：画布上点四只动物都不动相机（但 `#card` 换文案）、只有名字按钮 `focus=id`+`distance=23` |
| `node check-sky-flight.cjs` | 3.28 翼龙飞行体积（水平最远/高度跨度/不出水块/高于火山顶）；**3.41b 起改为 `islandCloudsGone`**（岛上方小白云已删、远景云恒 12 朵）；实况采样 20 秒 |
| `node check-volcano-model.cjs` | 3.29：火山换成素材模型（子节点/面数/flipY=false/程序件全让位/**底部扎进沙里**/点击仍喷发/draw call ≤1000） |
| `node check-weather.cjs` | 3.31：天气滑杆（**50=原样**、越左雨越大且水面有涟漪、越右越亮越蓝越白、真实拖动生效、draw call） |
| `node check-pink-plesiosaur.cjs` | 3.30：小紫换成粉龙（`g.children[0]` 是模型躯干+贴图+四鳍）/**安抚时脖子枢轴真的被驱动**/四阶成长部件与锚点/仍可拾取 |
| `node check-weather-fish.cjs` | 3.32：雨天鱼群联动（50 档乘数**精确 1/1/0** 且 weather.js 无 `Math.random`、越左雨越大鱼越深 −0.31/−0.62/−0.93、`setRain` 夹取、dt=0 冻结、大晴不碰鱼群） |
| `node check-thunder.cjs` | 3.32：闪电与雷声（打闪后按 `flash×系数` 变亮、**闪完逐位回基准**、3 个错峰脉冲、雷声**实测波形**、只在大雨档自动打雷、draw call 不变） |

本轮结果：`errors=[]`；绘制调用 1231 → 985；合并后水下 mesh 5 个；
`check-seabed` 断言全部通过；`check-mobile-layout` 的 `ok=true`。

3.18 这轮结果：全套 `check-*.cjs` exit=0；新增的 `check-pet-growth.cjs` 12 项断言 `ok=true`、`errors=[]`；
给小紫加了 8 个成长部件网格，只有成体阶段全部可见（低阶段 `visible=false`，不产生绘制调用）。

3.19 这轮结果：删掉悬空 `shoal` 圆片、海床抬到岛缘（`check-seabed` 的 `islandFootWorks=true`，全套 `check-*.cjs` exit=0）；
水面/水色零变化（水深与水色仍按 `lagoonY` 算）；水下网格数与绘制调用不变，三角面 +3.8 万。

## 5. 已知遗留（下一步候选）

- 绘制调用：**多云 981 / 大雨 1030–1042**（旧文里"985 / 1037 / 987"是 3.29–3.31 的水位，已过期——以 3.32 实测为准）。
  主要来自岛上植被球体（394 个 Sphere）与颗粒（180 个）、鱼群（30×3）；**闪电不新增 draw call**。可继续按材质合批，重点验证手机端。
- 小紫的成长已有阶段外观与真实扑咬（3.18）；还没做的是"成长影响能力"——速度、食量、可互动范围
  目前不随阶段变化，成体之后也没有继续成长的空间。
- 火山烟雾/喷发是简化粒子，参考里更浓（程序烟雾 + 模型自带白烟团并存，多次被跳过）。
- 无头 Chrome 的 FPS 只代表本机，手机性能仍未真机验证。
- 鱼群的"贴岸躲雨/群聚半径"只做了遥测（跨运行会翻号），要变成可断言的门得先给鱼群加**确定性重放**（可注入随机源 + 状态快照/复位）。
- `weather.js` 的 50 档基线仍是自带的 `BASE.day/night` 副本：`art-direction.js` 的 `ART` 以后一改，基线会**静默漂移**且检查照样绿。建议补一条"50 档数值 == 从 `art-direction.js` 源码解析出的字面量"的交叉断言。

### 3.34 水龙模型与俯视反光调整（2026-10-14）
- 水龙使用用户提供的 tripo_convert_9ae21aff-4cf8-4f33-8df0-c40bfd8f42bc.fbx，导出到 assets/water-dragon/。复用原有部件轴心与成长/互动逻辑；模型为静态网格分件驱动，并非自带骨骼动画。
- 水龙检查：check-pink-plesiosaur、check-pet-growth、check-pet-toys、check-pet-dive 通过，日志见 _baseline/dragon-*.log。
- art-direction.js 水面法线扰动 .16 → .07；增加缓慢移动的稀疏高光遮罩和俯视角度衰减，降低直接/环境镜面反射、银色条带与清漆反光。保持交互浪花和宠物尾流逻辑。
- 查看了俯视、低视角实际截图，海底与鱼群可见度改善；远端仍保留柔和反光，未全部消除。
- node --check art-direction.js 通过；verify-art.cjs 与 check-seabed.cjs 通过。最终两视角捕获 errors=[]（含控制台与 pageerror），未重新运行整套 23 项测试。
- 截图：_baseline/water-reflection-before.png、water-reflection-after.png、water-reflection-low.png。tools/capture-water.cjs 可复现相机/水面时间；生物随机状态不保证逐帧一致。

### 3.35 更细的反光与波纹暗面（2026-10-14）
- art-direction.js：收窄直接镜面高光的柔亮肩部，使用 fwidth 平滑阈值；程序亮纹指数 28→72、22→48，银色亮边阈值 .955→.983，减少亮纹宽度。
- 两个不同方向的连续波场生成柔和暗面，青蓝相对吸收保留配色切换；原暗纹强度 .15→.20。不更改透明度、海底高度和交互浪花。
- 检查俯视/低视角截图，水下生态仍可见。node --check 与截图控制台检查通过（errors=[]）；verify-art 运行结果见本轮输出。
- 修改前代码 _baseline/art-direction-before-thin-reflections.js；前图 water-reflection-before-thin.png；后图 water-reflection-after.png、water-reflection-low.png。

### 3.36 细反光间距与暗面（2026-10-14）
- 隔离水皮与水面检查确认宽白斑来自主水面，不是海底贴图。probe-reflection.cjs 仅作诊断，不属验收套件。
- 主水面镜面反射增加细波峰遮罩，两组不同方向的弯曲波纹与稀疏噪声控制分布；低频波场增大间距，亮纹指数提升四倍（对应正弦峰附近宽度约减半），银边阈值同步收窄。像素导数软化边缘。
- 青蓝暗面相对吸收 (.30,.16,.12)→(.52,.32,.25)，原反射暗纹 .20→.29。未修改水体透明度和互动逻辑。
- node --check、三视角截图 errors=[]、verify-art PASS。截图 _baseline/water-reflection-after.png、water-reflection-low.png、water-reflection-close.png。

### 3.37 修正亮纹过暗与暗纹过宽（2026-10-14）
- 原先细反光在 lagoonBody 混合前添加，又被遮罩与镜面阈值多次削弱。将可见细反光放到水色与暗面合成之后，亮度跟随场景受光；用独立短弧遮罩打断长白线，保留稀疏间距。
- 暗纹阈值提升到波峰附近，去除暗纹最低覆盖量，降低青蓝吸收和宽幅 swell 调制。暗面更窄、面积更少，不更改透明度。
- 三视角截图 errors=[]，查看近景确认短细反光可见；verify-art PASS（最终再调整分段遮罩后运行截图确认 shader 无错误）。未执行全套行为回归。

### 3.38 反光与实际波面统一（2026-10-14）
- 删除 art-direction.js 的坐标亮线、暗带、视空间法线偏移及其多层遮罩。使用 CPU 实际位移后的 computeVertexNormals，交给 Three r160 MeshPhysicalMaterial 的 GGX/Fresnel 计算；metalness=0，ior=1.333，clearcoat=0，roughness=.12。
- island.js 添加两组小幅真实几何波（.022/.014），不再只改法线。四组角频率近似 sqrt(9.81*k*tanh(k*2.4))*0.55；这是固定水深、慢放的重力波叠加近似，不是完整流体求解，岸边仍使用已有遮罩，交互仍使用现有局部波。
- 去掉按坐标乘色的宽幅暗纹，明暗主要由实际波面受光决定。保留既有水深染色、透明水皮、岸边泡沫和交互泡沫；它们仍为风格化近似。环境反射仍是预过滤程序环境贴图，并非实时场景反射；不能声称全物理海洋或光线追踪。
- tools/check-physical-reflection.cjs：仅测试页关闭环境光贴图，固定波形切换太阳方向和镜头，记录 physical-light-a/b.png、physical-orbit.png。已目视确认光源换到反方向后原高光带消失，不固定贴在水面坐标。
- 仅使用网格索引中的实际水面法线验证，normal.y 最小约 .975，最大 1；材质参数、移除旧亮线检查通过；errors=[]。verify-art PASS；check-ocean-effects errors=[]，尾流/气泡仍产生。未全套回归、未验证手机性能。
- 修改文件：art-direction.js、island.js、ocean-life.js。旧版本备份 _baseline/art-before-physical-reflection.js、island-before-physical-reflection.js。

### 3.39 水面反光"缎带感"：一次失败的数字门 + 一次被证否的归因（2026-10-14）

**用户报的现象**：「为什么这些水面反光都是同一个方向，像是有灯光打下来一样？」（截图里标出多条平行亮带）；随后追加要求：**① 做成数字门、② 把环境球的柔光团再收、③ 反光要在多个视角都成立**。

#### 先量：两个直觉假设被否掉
- **不是波浪的错**：水面顶点法线倾斜方向一致性 **0.181**（1.0 = 全同向），平均倾角 **5.4°**、最大 11.25° → 水面几乎是平的。
- **不是 shader 里那段焦散**：`a=sin(x*7.7+…)` 与 `b=sin(z*8.1+…)` 相加确实是直角线栅（结构张量方向集中度 **4.36×**），但它只混 **×.012**（水面）/ ×.28（海床），是次要项。

#### 做了一次"球面环境重铺"，然后**推翻了它自己的归因**
改动内容：`art-direction.js` 的 `skyScene` 球壳里，把太阳的 `pow(dot,35)*1.5`（球面上**一个尖亮斑**：峰值 2.478 / 均值 0.627、只占球面 1.5%）换成 3 个方向略偏的柔光团（指数 7/9/11 + fBm 打碎），云从"两个正弦相乘"（在球面上是双曲线带）换成 3D 值噪声 fBm。

**为什么最后回滚**（证据）：
- **关掉环境贴图对水面影响很大**：`envMapIntensity .45 → 0`，水面平均**变暗 13.9/255**、88.6% 的水面像素变暗 → 环境贴图**确实**在给水面供光，不是摆设。
- **但"旧球壳 vs 新球面"对水面几乎没影响**：8 个机位逐一对照（同一暂停帧、同机位），水面区域平均差只有 **0.8–2.2/255**（个别点最大 100+），**肉眼看不出**。→ 那个尖亮斑**不是**这些平行亮带的成因。
- **亮带很可能早已被 3.38 修掉了**：3.38 删掉了"坐标亮线 / 暗带 / 视空间法线偏移及其多层遮罩"，改成真实几何法线 + GGX/Fresnel。在**今天的现役代码**上，8 个机位的多视角截图（`_mods-out/ang-new-*.png`：俯视 / 高角 / 中角 / 低角 / 背面 / 侧面 / 近景 / 远景）**都看不到平行亮带**。
- 因此：**用户的抱怨已不复现，但把它归因给"环境球尖亮斑"是错的**（本文件 §3.39 的旧文本就是那个错误结论，本轮已替换）。要恢复我那一版随时可以：`_baseline/art-direction-spherical-hdr.REVERTED.js`。

#### ① 数字门：**没做成**（四次尝试全部不成立，如实记录）
| 尝试 | 结果 | 为什么不行 |
|---|---|---|
| 球面亮区连通域伸长率 | 理想圆斑竟报 **16×** | 阈值只框住极少数像素，指标退化成伪影 |
| 球面/图像结构张量方向直方图 | 新旧差 **< 0.1** | 被场景纹理（沙纹、水草、岸线）主导 |
| 图像方向带通能量谱 | 新旧**都**钉在 90°、几乎不动 | 被画面的水平/垂直结构（水块边缘、UI）主导 |
| **离屏"只渲水面"**（`tools/check-reflection-bands.cjs`） | 旧/新 **1.71 vs 1.73**，区分不出 | **根本性**问题：这块水是 `transmission .32 / opacity .6` 的物理材质，把岛/海床关掉后它自身就不成立 |

→ **结论：目前唯一的门是"多机位截图目视"**。要数字门，第一步不是换指标，而是解决"水面观感依赖背后场景"这件事（固定整套场景、只换一个变量，且对所有机位算差分）。
→ `tools/check-reflection-bands.cjs` 保留为**诊断/记录**工具（会打印每个机位的方向能量），**别当门**。

#### ② 柔光团再收：**没做**（因为上一条：改了也看不出，只会增加维护面）
#### ③ 多视角验收：**做了** —— 8 机位 ×(旧环境/新环境) 共 16 张，`_mods-out/ang-*.png`；现役代码下所有机位均无平行亮带。

**产物与口径**
- 捕获台子：`_baseline/ang-shot.cjs`（8 机位、暂停帧，`node ang-shot.cjs <tag>`）。
- 现役状态：`art-direction.js` 与 3.38 的产物**逐字节相同**（hash 校验过），全套 **23 个脚本 exit=0、零 pageerror、无 shader 错误**，日志 `_baseline/suite-3.33/`。
- **留给下一个人的话**：这条线的诚实状态是**现象已消失但无法自动断言**。要不要为它建门，取决于你愿不愿意先搭"固定整套场景 + 单变量 + 全机位差分"的对拍台——**不建议再换指标硬凑**。

### 3.40 右键拖水：取消"海浪贴图"、保留拖尾（2026-10-14）

**用户原话（两轮，第二轮是纠正）**：
1. 「取消鼠标右键按起来的这个海浪贴图，然后拖尾的形态可以优化一下，不要这么碎，然后全是小点点。」（附截图圈出水面羽状纹）
2. 「**拖尾还是要的。主要是右键点起的浪高那里有一个贴图。不想要那个贴图，不是拖尾的贴图。**」

#### 归属：试错了两轮才对上（这段留着，别重犯）
水面/拖拽一共有四处会"画白东西"，我逐个关掉做对照才定位到：

| 候选 | 代码 | 实测判定 |
|---|---|---|
| 32 片弧线贴图的尾迹 | `ocean-life.js` 的 `wakeGeo`（`RingGeometry(.91,1,32,1,.2,π-.4)`，拖拽/游动时按航向贴弧片） | **是"贴图感"的一部分**（一圈圈白色弧片），已删 |
| 120 个小球喷雾 | `island.js` 的 `sprayMesh`（拖拽速度 >0.7 时每 0.055s 喷 7 颗，size .055–.12） | 是"全是小点点"，已删（顺带省 1 次 draw call：773 → 756） |
| 浪尖白沫环 | `island.js:14` 的 `foam`（`RingGeometry(10.6,11.1,80)`，y=1.18，随拖拽变亮的 0.22–0.3） | 关掉后**画面看不出变化** → 保留（不是元凶） |
| **波峰白沫（shader）** | `island.js:189` / `art-direction.js:44` 的 `froth` 里那一项 `crest*(.8+rough*.4)`，由 `uFoam=crestStrength` 驱动（拖拽时涨到 ~0.97） | **就是"右键点起的浪高那里的贴图"**：拖动时沿拖动路径糊一条白色羽状带 |
| 水皮贴图 | `seabed.js` 的 `waterSkin`（PlaneGeometry + `assets/water-skin.png` 或程序生成，opacity .42） | 关掉几乎无差别，**不是**它 |

**关键教训**：我先按"贴图=弧线 mesh"改了一轮，把拖尾一起削弱了，用户才补一句纠正。**"贴图"这个词在这个项目里既可能指 mesh 也可能指 shader 里画上去的白沫**——下次遇到"这个贴图"先做"逐层关掉"的对照，别按字面猜。

#### 落地的改动
1. **关掉波峰白沫的 crest 项**（两处 shader 都改，否则后写覆盖先写）：
   `froth=clamp((crest*(.8+rough*.4)+tail*…)*uFoam,0,1)` → `froth=clamp((tail*…)*uFoam,0,1)`。
   → 右键点起的那条白色"贴图"消失；**拖尾（tail 项）保留**；岸边拍岸白沫（`shoreDistance` 的 `surf`）与交互涟漪（`localRippleHeight`）都没动。
2. **删掉 32 片弧线尾迹**（`wakeGeo` + 更新循环 + `addWake` + `lastWake`）。`oceanLife.effects.wakes` 现在恒为 0（键保留，`check-ocean-effects.cjs` 顶部已注明"是设计，不是回归"）。
3. **删掉拖拽喷雾**（`sprayMesh` 整块，120 个实例网格）。
4. **尾迹改形**（`heldSeaWaves`）：原来每个尾迹点乘 `cos(band*5-age*5)`（沿尾迹振荡 → 一圈圈"肋骨/羽毛"）→ 改成**单个正向柳叶隆起** `exp(-band²·1.6)` × 轻尾波 `(1+sin(behind·2.1-age·4)·.45)`；age 淡入淡出窗口 `.06/.4 → .1/.5`（相邻点不再露缝）；振幅 `.035 → .085`；尾迹点间距 `.07 → .05`、上限 `6 → 10`。

#### 验收
- **同机位、只切 `crest` 一项的 A/B**：`_mods-out/ab-foam-WITH-crest.png`（有那条白色羽状带）vs `ab-foam-NO-crest.png`（干净，波纹变形仍在）。
- 拖动点特写：`_mods-out/final-pull.png`（`grab: height 1.92 / speed 16 / crest 0.93 / trail 4` 时拍）。弧线/喷雾对照：`_mods-out/dr2-1-all.png` → `dr2-2-noArc.png`（羽状消失）。
- 全套 **23 个脚本**：22 个一次过；`check-pet-target.cjs` 首轮挂了 1 次，**复跑 4/4 全绿** → 判定为它自身的时序抖动（宠物在动），不是本轮回归。日志 `_baseline/suite-3.40/`、`suite-3.40b/`。
- 备份：`_baseline/island-before-wake-cleanup.js`、`ocean-life-before-wake-cleanup.js`、`island-crest-off.js`（本轮的中间态）。

#### 3.40c 喷雾按用户要求**回归并改形**（同日追加）

用户：「小点点 = island.js 的 InstancedMesh 120 个小球的喷雾 … **这个要回来优化一下形状就好**」→ 不是要回原样，是要**换成不像碎点的形状**。

- **旧形状（已废弃）**：120 个**球**，`scale(size*1.7, size*.35, size*1)`、`size .055–.12`、无旋转 → 屏幕上就是一堆小圆点（约 2–8 px）。
- **新形状**：220 个实例，每个用 **`lookAt` 对齐自己的速度方向**、再沿该轴拉长 → 观感是"**飞出去的水线/水滴**"而不是点。
  - 尺寸：宽 `.055–.10`，长＝宽 × **stretch 5.5–9**（实测实例矩阵：长 **0.30–0.66** 世界单位，旧版只有 0.06–0.18）；
  - 只在**拖动点前沿**生成（侧向扇形 ±0.35、朝前 0.55–1.05），所以是"从浪头溅出来"，不是整片撒点；
  - 上抛 + 重力（`vy .7–1.6`、`g=1.25`）+ 空气阻尼，抬高 0.27–0.5 个世界单位；落回水面即结束（不再贴在水面飘）；
  - 生命两端淡入淡出（`sprayFade`），颜色由水色渐白；`sprayCount 220`、每 0.03 s 补一次、每次 8 颗 → 持续拖拽时稳定 **约 33 个活跃**；
  - 高度用 `spraySurfaceY()` 采样水域网格顶点（与 `heldSeaWaves`／涟漪同一套坐标），水花始终贴着实际波面。
- **实测**：拖动中 `alive 33 / maxLen 0.66`；draw call **757**（仍低于清理前的 773，因为整组只有 1 个 InstancedMesh）；全套 **23 脚本全绿**（`_baseline/suite-3.40c/`）、零 pageerror、无 shader 错误。
- 截图：`_mods-out/spray-new.png`、`spray-new-close.png`；对照 `_mods-out/ab-spray-with.png`。
- **形状还可调**（用户若说"再多/再少"）：`sprayCount`、每次 `n=8`、`width`、`stretch`、`sprayTimer>.03` 这几个量；其余（重力/阻尼/淡出/落水即止）已定型。

#### 3.40d 拖尾换成 **2D 水拖尾素材**（用户：「长条水滴，能不能用二维的水拖尾素材代替，你自己上网找」）

**先找素材（外部源结论要留档）**：本机 `opengameart.org` / `kenney.nl` / `commons.wikimedia.org` / `transparenttextures.com` 都 **200 可达**，但 **GitHub（含 `api.github.com`、`raw.githubusercontent.com`）不通**（走代理一律 404）；OpenGameArt 的水花搜索结果里没有可用的 CC0 拖尾贴图，Commons 的 API 查询返回空。为了不让交付卡在网源上，改为**程序化生成**——
- 生成脚本：`D:\Deepseek _file\_make_water_trail.py`（PIL 12.3.0 + numpy 2.5.2，本机 `C:\Python314\python.exe`）
- 产物：**`assets/water-trail.png`**（512×256 RGBA，**9,911 字节**，服务下 HTTP 200 可达）
- 形状：亮头（水滴鼓包 + 高光）→ 渐隐细尾；内部 4 缕沿长度方向的正弦水线；边缘高斯柔化；水色 → 近白。

**接入方式（`island.js` 的 `sprayMesh`）**：把 3.40c 的"球体拉长"换成**贴图平面**——
- 几何 `PlaneGeometry(1,1)` + `MeshBasicMaterial({map: assets/water-trail.png, transparent, opacity .58, depthWrite:false, side:DoubleSide})`；
- 每实例：`quaternion = yaw(速度方向) × 绕X(-90°)` → **平面平贴波面、长轴沿水流**；`scale = (len, wid, 1)`，`len = width×stretch×(1+age·0.7)×fade`、`wid = width×fade`；
- 生成位置/物理/淡出**沿用 3.40c**：只在拖动点前沿扇出（±0.35、朝前 0.55–1.05）、上抛 + 重力（`vy .7–1.6`、`g=1.25`）、落回水面即结束；高度走 `spraySurfaceY()` 采样水域网格；
- 参数：`sprayCount 180`、每 0.03 s 补 8 颗、`width .11–.20`、`stretch 3.2–5.2`、生命 `.7–1.6 s`。
- 过曝收了一次：材质 opacity `.72→.58`、颜色 lerp 上限 `.82`、长度增益 `(1+age·.9)→(1+age·.7)`。

**实测**：拖动中 `alive 55 / maxLen 1.21`（世界单位）；**draw call 758**（仍是 1 个 InstancedMesh，180 实例不增调用）；全套 **23 脚本全绿**（`_baseline/suite-3.40d/`）、零 pageerror、**无失败请求**（贴图在游戏内加载成功、`512×256` 已确认）。
截图：`_mods-out/trail2d.png`、`trail2d-close.png`。

**注意**
- 贴图是**程序生成**的，没从网上下载任何第三方素材 → **无授权问题**；要改形状就改 `_make_water_trail.py` 再跑一次（不用重新构建，刷新页面即可）。
- 这条线现在四层都是"有意的现状"，别再各自动手：**拖尾＝波面 `heldSeaWaves`（保留）**；**波峰白沫 `crest` 项（已关）**；**弧线 mesh `wakeGeo`（已删）**；**喷雾＝2D 贴图平面（3.40d）**。

#### 给下一个人的话
- **加回任何"白沫/贴图"之前先问用户**：这四处现在是有意的现状（弧线与喷雾已删、crest 项已关）。
- 想恢复：弧线/喷雾从两份 `*-before-wake-cleanup.js` 取；crest 项就是上面那一行公式改回去。
- 小紫的尾迹现在**完全靠波面**（`heldSeaWaves`）+ 涟漪环池，没有任何贴图 mesh。

---

### 3.41 岛缘「软岸线 + 泡沫线」——照参考片 BV1ibpq6tEmU 的 05/12（用户 m01968 拍板）

**触发**：用户只发一条裸链接（上一轮），随后 m01968 发来 **12 张视频原画截图 + 一句「这是我截图的内容，我们可以参考他做水的质感。他的水效果很符合我想要的水」** → 等于拍板：**按这条管线做水**。

**范围口径（我提、他没反对，按此执行）**：只做**岛缘那一圈**（沙水相接处 → 近岸几厘米水深）；**深海与远处海面不动**，免得把调好的"干净果冻海"弄浑。每步可单独关掉（`window.islandShoreState`）。

#### 做了什么（①湿沙/水位线 + ②软岸线）
岛的岸线**不是圆**：实测水线半径 **4.70 ~ 6.35**（72 个方向），而旧代码是 `smoothstep(6.1,7.3,length(vSea.xz))` 的**完美圆环**。所以第一步是把"到岸距离"**烘出来**：

1. **烘焙（`island.js`，`setTimeout(…,0)` 里一次）**：160×160 网格（span 24、覆盖 island 包围盒），每格**向下打真实 mesh**（`ray.intersectObject(island,true)`）取水面高度场（`y ≥ 1.15` = 陆）；高度场先做 **3×3 中值 ×3 遍**去噪（沙架在 1.15 附近来回抖，不先去噪会得到**椒盐岸线**）；再沿 160 方向径向步进找**第一个陆格**＝岸线半径；存成 `DataTexture`（RedFormat，160²，线性过滤）。
2. **共享状态 `window.islandShoreState`**：`{edge,foam,seam,tex,time,span}` —— 因为 `art-direction.js` 的 `onBeforeCompile` **后跑并覆盖** `island.js` 的，三份 shader 引**同一个 uniform 对象**才不会漂移（本项目硬约束：两份 shader 必须同时改）。
3. **顶点/片元注入（`island.js` 与 `art-direction.js` 各一份，逐字相同）**：
   - vertex：`vShore = length(position.xz) - shoreDistAt(position.xz)`（贴图查表 + 低频噪声 `wob`，把圆环打碎成不规则岸线）；
   - fragment：`dShore = uShoreSeam>.5 ? vShore : length(vSea.xz)-6.1`（**>0 水侧、<0 陆侧**，单位米）→
     `wetBand`（浅水湿沙带，往里 0.42 m 内混 `vec3(.40,.57,.53)` ×.24）＋
     `foamLine = (1-smoothstep(.05,.09,|dShore+.04+shTide|))*uShoreFoam`（近白岸线泡沫，`shTide` 随潮微摆）。
4. **可调/可回退**：`islandShoreState.foam.value=0` 关泡沫线、`.edge` 调湿沙带宽度、`.seam.value=0` **退化成旧的圆环硬岸线**（一键回退）。

#### 踩的四个坑（都在这一轮，值得记住）
1. **`smoothstep` 传了 4 个参数** → `'smoothstep' : no matching overloaded function found`。我写成 `smoothstep(.06,.12,宽度,值)`，GLSL 只有 3 参版。
2. **把 `waterMasks` 当成"岸距(米)"用了** → 它是**拍岸变形权重(0..1)**，塞进 5~12 的米数后浪被放大成"山"（整片海变成锯齿高山，一眼可见）。教训：**别把语义不同的数组复用**。
3. **烘焙时判"水/陆"判反了**：写成"第一个**低于**水面的格＝岸线"，于是绝大多数格（射线打空 = 999）被当成陆 → 贴图几乎全是 12（岸线全灭）。改成"第一个**高于**水面的格"后直方图才铺开。
4. **`smoothstep(.05, .09*max(uShoreFoam,.25), x)`：`edge0 > edge1` 是 GLSL 未定义行为** → `uShoreFoam=0` 时整片海被"刷白"（不是细泡沫带消失，而是**全屏变乳白**）。这是我用"空对照"抓出来的：同机位不切任何变量两张图的均差只有 **4.18/765**，而切 `uShoreFoam` 是 **66.4** → 说明它影响的是**整屏**，不是那条细带。改成固定宽度 `smoothstep(.05,.09,|…|)*uShoreFoam` 才对。

#### 测量与门（`check-beach.cjs`，5 项）
- **岸线不是圆**：72 方向在 r=7 处取"到岸距离"，**峰谷差 ptp > 0.25**（旧实现恒为 0）；实测 `ptp 0.71 / mean 5.97 / sd 0.094`。
- **泡沫线真画出来**：同机位只切 `uShoreFoam`，用**亮白像素计数**（近白阈值 >200）当主门，而不是像素均差——泡沫带只占画面 1~2%，均差会被画面自身动画淹没（空对照 mean≈4.2）。实测亮像素 **8010（开）vs 7651（关）＝+359**；关掉再打开能回到原样（|差| 103 < 359/2）。
- **回退路径**：`seam=0` 与 `seam=1` 相邻帧必须可见差异（`bigPct 0.8%`）。
- 零 pageerror、零 shader 编译错误（shader 报错走 `console.error`，**不是** pageerror，必须单独抓）。
- 像素统计**用 chromium 自己解码 PNG**（工程里没有 pngjs/jimp，不额外装依赖）；坑：不要在 JS 里把路径转两次 data URL（`fs.readFileSync('data:...')` → `ENAMETOOLONG`）。

**实测**：draw call **758**（不增调用）、三角面 397,888；全套 **24 脚本全绿**（`_baseline/suite-3.41a/`，23 → 24 是因为新增 `check-beach.cjs`）。
截图：`_mods-out/beach-A-beach.png`（2× 近景，白色岸线 + 浅水带）、`beach-A-wide.png`。

#### 还没做的（参考片里剩下的）
- **14 岸边残沫与泡沫投影**：它把残沫**画在水面之下**（被水染色），能顺手治"贴上去的贴图感"——我们目前所有白沫都画在水面之上。
- **13 浪峰白条**：3.40b 按用户要求把 `crest` 项**关了** → 应该改成**独立可调的量**，而不是"关了就没了"。
- 08 水的厚度/折射/分通道吸收、10 碎浪白水、11 浪尖透光：属于"水体质感"那一层，等 ①② 定稿后再谈。

### 3.42 删掉"岛正上方的小白云"（2026-10-14）

用户在一张**大雨档**的游戏截图上用红圈圈出天空里那几朵小云，原话只有一句：

> 「删除掉自己多小云」

（＝"删除掉自己多的小云"：他认得出那是**我 3.28 自己加的**，不是原设计。）定位不需要猜：`sky.js` 里只有两处造云，
`addCloud`（远景 12 朵）与 **`addIslandCloud`（3.28 加的 4 朵，`islandClouds` 数组）**，红圈里那几朵小、悬在岛上方 → 就是后者。

**改动**（`sky.js` 150 → 138 行）：
- 删 `addIslandCloud()` + `islandClouds` 数组 + 那段 `[[25,1.1,12.4,.70],…]` 配置表（原 §2b 整块）；
- 删 `update()` 里岛上方云专用的 `baseX/baseY/baseZ + sin(clock…)` 漂移循环；
- 删 `window.skyLife` 上的 `islandClouds` / `islandCloudCount` 两个 getter（**不留死接口**）；
- 原地留一条注释说明"这里曾有 4 朵、3.42 按用户要求删除"，避免下一个人以为是漏写。
- **远景 12 朵（`clouds`）一行没动**：它才是"天空里的云"的本体。

**验收**：`check-sky-flight.cjs` 的 `islandCloudsWorks` 换成 **`islandCloudsGone`** —— 断言 `'islandClouds' in skyLife === false`、
`'islandCloudCount' in skyLife === false`、`skyLife.cloudCount === 12`（防止"删了却长回来"）。实测：

| 项 | 值 |
|---|---|
| 远景云数量 | **12**（不变） |
| `skyLife.islandClouds` | **不存在**（原 4 朵） |
| 岛上方云的最高/最低点 | 已无（原 12.4–14.8） |
| 默认视角 draw call | **750**（此前 758；远景云在漂移、会被视锥剔除，所以这个数本身有 ±几 的抖动，**别当精确差值**） |
| 翼龙飞行空间 | 不受影响：水平最远 **7.77**、高度跨度 **4.89**、最低 **6.003** > 火山顶 **5.24** |
| 全套 | **24/24 `exit=0`**、零 pageerror（`_baseline/suite-3.41b/`） |

截图 `_mods-out/sky-clouds-removed.png`、`_baseline/pterosaur-flight.png`。

**教训（可复用）**：他说"删除掉自己多 X"时，**X 一定是"某一轮我自己加上去的东西"** → 先去文档里搜那轮的产物名
（这里是 §3.28「岛正上方的小白云」），再回代码里找**两个不同的构造函数**（远景 / 新增），别删错主体；
删完要**连 getter 一起删**，并把对应的门从"断言存在"翻成"断言不存在"。

### 3.43 鱼群确定性重放：把「贴岸躲雨 / 群聚半径」从遥测升级成硬门（2026-10-19）

**问题**：3.32 就把这两个量测出来了，但它们**跨运行会翻号** —— 大雨档贴岸占比同一天里 0.44 / 0.78 都测到过。
根因不是行为，是**随机路径每帧不同**：闲逛目标 4–12 秒随机换一次（`pickWander` 抽 3 个 `rnd()`），
群心落点就跟着相位漂。拿一个会翻号的量当门＝拿噪声当门，所以那两项目前只能当"遥测"看。

**改了什么**（`ocean-life.js` 184 → **258 行，+74**；**行为参数一行没改**）：
1. **随机源收口**：原来散在 7 处的 `Math.random()`（`pace`、`pickWander` 的 x/z/计时、气泡尺寸、
   initAudio 与 thunder 两段棕噪声）全部改走 `rnd()`。`rnd()` 在**调用时**才取 `Math.random()` ——
   **绝不许把它抓进闭包常量**，否则 `check-weather-fish.cjs` 那种"临时替换 `Math.random` 为 LCG"的手法当场失效。
2. **可注入**：`setRandom(20261014)` → 内部 `mulberry32` 种子流（状态能进快照、能精确续上）；
   `setRandom(fn)` → 外部随机函数；`resetRandom()` → 回到 `Math.random`；`get rndMode / rndCalls / rndState`。
   非法值（如 `'abc'`）**回落 `math`**，不抛错。
3. **快照 / 复位**：`snapshot()` 只装**可 JSON 化**的数（没有 THREE 对象、没有网格引用，`JSON.stringify` 直接存盘）；
   `restore(snap)` 精确写回。装的东西＝每条鱼 **19 个行为字段**（x,y,z,vx,vy,vz,speed,heading,angular,turn,wander,
   panic,startle,eaten,mode,homeY,tx,tz,pace）+ 6 个网格派生量（visible/pos/rotY/rotZ，保证画面同步）+
   **13 个全局计数器**（foodEnergy、fishEaten、lastDepth/Hits/Catch/Bubble、bubbleIndex、rippleIndex、rain01、
   rainTick、thunderCount、hand、lastFoodTime）+ 40 个气泡 + 8 个涟漪 + 8 颗鱼食 + 随机流位置。
   `restore` 收到形状不对（`fish` 数组长度≠`schools.length`）时**什么都不动**并返回 `false` —— 不许半截复位，
   否则下一次重放的基线是脏的。

**新脚本 `check-fish-replay.cjs`**（7 条断言，`_baseline/suite-3.43/check-fish-replay.cjs.log`）：

| 断言 | 手法 | 实测 |
|---|---|---|
| `replayIdentical` | 同基线 + 同种子 + 同 dt 跑 **600 帧 ×2**，逐字段**严格** `===`（不是 <1e-6） | 快照 **1510** 字段 0 diff、`schoolState` **479** 字段 0 diff、随机调用各 **239** 次、终态随机流 state 都是 `3972793425` |
| `restoreWorks` | 跑 720 帧 ≡ 跑 600 → `snapshot()`（还经一次 `JSON.parse` 存盘往返）→ `restore` → 再跑 120 | 0 diff（对照：restore 前先乱跑 437 帧，能拉开 **520** 处不同 → 证明复位真的生效） |
| `seededMetrics` | 大雨档（`rainProbe.rain=1`）同种子连跑 **3 次** | 贴岸 **0.5833333333333334** ×3、群聚 **7.524183860086971** ×3，逐位相同 |
| `metricsGate` | 再跟"中性档"（滑杆 50，`rainProbe.rain=0`）对照 + 金标值 | 中性档贴岸 **0.4754901960784313**、群聚 **7.613591174433572** → 两档确实不同（`rainShifts=true`），门不是空的；与金标 `0.5833333333333334 / 7.524183860086971` 差 **0 / 0**（`bitExact=true`） |
| `zeroDtWorks` | `update(0,t)` 连打 60 次 | 快照字符串前后完全相同 |
| `rngWorks` | 临时替换 `Math.random` 数调用 | `rnd()` 调用数与 `Math.random` 命中数**一一对应**（6=6）；`'abc'`→`math`、函数→`fn`、种子→`seeded`；同种子二次起跑随机流位置相同 |
| `randomFree` | 源码级（去注释行后正则计数） | `Math.random` 只剩 `rnd()` 兜底那 **1** 处 |

**跨进程复现**（这才是 C1 的要害）：脚本连跑**两条独立进程**，除 `rng.hits`（那一项故意走真 `Math.random` 路径，
天然随机）外 JSON **逐字节相同**；`hashes.base=-125337176`、`hashes.trial=-1744409319` 两边一致。

**踩的坑（全是"第一次写法就错"，按踩到的顺序）**：
1. **`t` 也是输入**。我第一次续跑写 `t=T0+600*DT` 想接着跑 → 与"累加 600 次"的 `t` 差 ~1e-13，
   `sin(t*.9+phase)` 吃这一点差，236 帧后位置差到 1e-16，`restoreWorks` 报 **406** 项 diff（看着像复位没生效，
   其实是喂进去的时间不一样）。→ 必须用**累加出来的那个 `t`**（`const tMid=t`）。
2. **基线不能是 live 状态**。第一版直接 `snapshot()` 抓"页面此刻长什么样"当基线：同一次跑里 3 遍重放一致（断言绿），
   但脚本连跑两次 `hug` 从 **0.8137** 变 **0.7696** —— 种子白种了。→ 基线要**由鱼序号生成**（半径 9.5 的环、
   `pace=.8+(i%7)*.07`），跨进程常量。
3. **`homeY` 必须一起钉死**。避让用的是**三维**距离（`separation.length()`，不是只看 x/z），而 `homeY` 是从 live 的
   `swimmers` 带过来的 → y 漂 → 避让变 → x/z 跟着变。症状很刁：`hug` 已经逐位相同了，`cluster` 还差 **6e-4**。
4. **比随机流状态不能用裸 `run(5)`**。第二遍的起点已被第一遍改过，5 帧里可能少触发一次闲逛换目标＝**少抽 3 个数**，
   于是"同种子"也比不上。→ 要比随机流就先进 `replayBase()`。（和 yutang 那轮"两个引擎共用一个随机流互相偷数"
   是同一个坑的两种长相。）
5. **`rainProbe.rain` 是"降雨量"，不是滑杆值**：大雨档 **1**、中性档 **0**（`max(0,(v-NR)/NR)`），别写 0.5 —— 我第一次
   断言 `===0.5` 直接红。

**验收**：`check-fish-replay.cjs` → `ok:true`、零 pageerror；**行为没变的旁证**：`check-fish-school.cjs`、
`check-weather-fish.cjs`（里面三条硬编码期望 `-0.9256 / -0.6209 / -0.3109` 对随机消耗顺序极其敏感，
实测 `up=-0.31086973014931335`，仍绿）、`check-ocean-effects.cjs` 全 `exit=0`。
全套 25 个脚本（24 个 `check-*.cjs` + `verify-art.cjs`，日志 `_baseline/suite-3.43/`）：**24 绿 / 1 红**，
唯一红的是 `check-beach.cjs`（`FAIL 岸线还是圆的（ptp 太小）:0.14`，门是 `ptp>0.25`）—— 它读的是
`window.islandShoreState.tex`（`island.js` 烘焙的岸距贴图），当时 Lead 正在改岛与岸线，**与鱼群无关**
（`check-beach.cjs` 里对 `oceanLife` 的唯一引用是 `waitForFunction(()=>window.oceanLife)` 这个就绪门）。

**以后怎么用**（要改雨天乘数、避让半径时直接抄这三行）：
```js
oceanLife.setRandom(20261014);           // 定种子
const s=oceanLife.snapshot();            // 存基线（JSON 存盘也行）
...改一个参数、跑 N 帧...
oceanLife.restore(s);                    // 复位，换参数再跑同一段 → 两个指标才可比
```

### 3.44 天气 50 档的「原样」到底抄自谁：把静默漂移变成响亮的红（2026-10-19）

滑杆 50 档的语义是**「完全等于原样」**（§3.31）。但"原样"这套数是 `weather.js` 里**手抄的一份**
`BASE={day:{sun:3.15,fill:.58,exposure:.98},night:{sun:.6,fill:.27,exposure:.78}}`；真正的原始值在
`art-direction.js:3` 的 `const ART={…}` 里，而那段在**它自己的 IIFE 内**——运行时 `window.ART` 拿不到
（`bounce` 灯也是同一个 IIFE 的局部 `const`，`page.evaluate` 里读它直接 `ReferenceError: bounce is not defined`）。
于是"抄的那份对不对"此前**没有任何门看着**：谁改 `ART` 都不会红，50 档会安静地变成"另一个观感"。
这一节只加交叉保护，**不动任何天气观感参数**（雨量曲线、亮度曲线、闪电、雷声、50=原样 这条语义一字未改）。

**做法：从源码文本解析基准，跟运行实测值逐项对**（`check-weather.cjs` 新增第 7、8 条断言）

- `artBaselineWorks`（8 个数）：正则取 `art-direction.js` 的 `const ART={…}`，再各取 `day{…}`/`night{…}`，
  逐项比 `sun / fill / exposure / bounce`。运行侧读**全局原始值**（`hemi.intensity`、`sun.intensity`、
  `renderer.toneMappingExposure`），容差 `|Δ|≤1e-6`。`bounce` 运行时不可直读 → 在 `scene.children` 里按
  灯色 `#ffe5bb` 认领那盏 `DirectionalLight`（`art-direction.js:249` 建的唯一一盏）。
- `skyBaselineWorks`（6 个 hex）：解析 `sky.js` 的 `DAY/NIGHT`（`top`/`bottom`）与 `paintSky()` 里
  `cloudMaterial.color.set(night?'#9fb3c9':'#ffffff')` 的两个云色，比对 50 档的 `skyLife.skyColors`
  与 `cloudMaterial.color`。
- 比对是**三列**：源码解析值 / 手抄镜像值（`weather.js` 新增只读出口 `weatherLife.base()` 交出的 `BASE`）/
  运行时实测值。`bounce` 不由 `weather.js` 管，镜像列标 `n/a`，只要求「解析 == 运行」。
- 两次测点：`set(50)` 后的白昼档 + **点真实 `#day` 按钮**后的夜晚档（这条把 `island.js → art-direction →
  sky.js → weather.js` 四层覆盖链全跑一遍），最后再点一次回白天，要求数值**逐位还原**。

**50 档实测（解析值 vs 运行值，全 OK）**

| 项 | 源码解析 | 手抄镜像 | 运行时实测 | Δ |
| --- | --- | --- | --- | --- |
| day.sun | 3.15 | 3.15 | 3.15 | 0 |
| day.fill | 0.58 | 0.58 | 0.58 | 0 |
| day.exposure | 0.98 | 0.98 | 0.98 | 0 |
| day.bounce | 0.85 | n/a | 0.85 | 0 |
| night.sun | 0.6 | 0.6 | 0.6 | 0 |
| night.fill | 0.27 | 0.27 | 0.27 | 0 |
| night.exposure | 0.78 | 0.78 | 0.78 | 0 |
| night.bounce | 0.1 | n/a | 0.1 | 0 |
| sky day top / bottom / cloud | `#6cbcf0` / `#eaf6fd` / `#ffffff` | — | 同 | — |
| sky night top / bottom / cloud | `#0c1a2e` / `#22405f` / `#9fb3c9` | — | 同 | — |

**断言不是空转：做了两次变异测试**（在项目外的副本上做，`_baseline/suite-3.44/make-mutant.cjs`、`mutate3.cjs`）

1. 把副本 `art-direction.js` 的 `day.sun` 从 `3.15` 改成 `3.16`（模拟"改了 ART 忘了改 weather.js"）→
   `FAIL day.sun 解析=3.16 镜像=3.15 运行=3.15 Δ=-0.01`，**exit 1**。
2. 把副本 `weather.js` 改成"50 档给天穹加 0.004 红"（模拟未来的观感漂移）→
   `FAIL sky.day.top 解析=#6cbcf0 运行=#6dbcf0` · `FAIL sky.night.top 解析=#0c1a2e 运行=#151a2e`，**exit 1**。
   顺带发现一条**必须写下来的性质**：只改 `sky.js` 自己不会红（运行时就吃那份字面量，解析值跟着变）——
   所以 `skyBaselineWorks` 防的**不是 "sky.js 被改"，而是 "weather.js 在 50 档开始自己染天穹/云"**。

**为什么不改成"启动时从 live 灯光自动对齐 BASE"**（考虑过、否掉）：那会让"50=原样"依赖**脚本加载顺序**
和**任何在 weather.js 之前写灯光的模块**——`index.html` 里 `weather.js` 是最后一个脚本，今天恰好对；
明天有人往中间插一个改灯的模块，这条门会**脆绿**而不是**响红**。交叉断言把"抄错"变成一次显式失败，
代价是每次改 `art-direction.js` 要多看一眼，值得。

**还没纳门的两个漂移面（诚实标注）**

- **太阳色相**：50 档 `sun.color` 是 `#ffe1a3`（白昼）/`#86baff`（夜晚），来自 `weather.js:50` 手抄
  `island.js` 里 `#day` 处理器的字面量；而 `island.js:148` 载入时原本是 `sun.color.set('#ffffff')`。
  也就是说**"50 档 = 逐像素原样"在太阳色相上本来就不成立**（3.31 起的既成事实，属观感参数）→ 只记录
  （断言结果里的 `cross.observed`），不判定，也不动它。
- **`scene.background`**：50 档实测 `#eaf6fd` / `#22405f`，是 `sky.js` 的 `bottom`（`paintSky()` 会把它抄进
  `background`/`fog`），**不是** `ART` 里的 `#e8e5df`/`#182735` → 不能拿 `ART` 字面量比 background。

**全套复跑**（`_baseline/suite-3.44/`，清单 `suite-final.txt` + 每脚本 `run-<name>.log` + `suite-summary.json`）：
仓库根 **24 个 `check-*.cjs` + `verify-art.cjs` = 25 个脚本，25 绿 0 红**（含 `check-weather.cjs` 8 条断言全绿、
`verify-art.cjs` 绿）。首轮复跑里 `check-beach.cjs` 一度红（`ptp 0.14`，门是 `>0.25`，§3.43 也撞过同一个数），
**与本节无关**：把副本里的 `weather.js` 退回 3.44 之前的版本（去掉 `base()` 与新增注释）重跑，`ptp` 仍是 `0.14`
→ 是岸距贴图烘焙的时序抖动；紧接着在主树上复跑即 `ptp 0.75` 通过。

**以后怎么用**：改 `art-direction.js` 的 `ART` 或 `sky.js` 的天空/云字面量后，直接
`node check-weather.cjs`；**红的那一行会同时打出解析值/镜像值/运行值**，照它改 `weather.js` 的 `BASE`
（或改回 `art-direction.js`）到三者一致即可。要在 50 档**故意**改观感，别去动 `BASE`——那是"原样"的锚。

### 3.45 水面反光的对拍台（A/B harness）：先有可比基线，再谈数字门（2026-10-19）

「水面反光像不像缎带」这件事上，此前已经试过四次数字门（球面连通域伸长率、结构张量方向直方图、
图像方向带通、离屏只渲水面），**全部不成立**。复盘后的结论不是"指标选错了"，而是**缺基础设施**：
手上没有"固定整套场景 + 只改一个变量 + 多机位全采"的可比基线，于是任何一个数字都没法回答
"这次改动到底动了几个像素、这点差异算不算数"。这一节交付的就是那个基线。

**新增两个文件，运行时代码一行没改**：

- `tools/ab-harness.cjs`（~560 行）——对拍台。**诊断工具，不属于验收套件**（文件头已写明），
  不加入那 24 个 `check-*.cjs` 的套件，任何自动化都不跑它。
- `tools/README.md`——用法、产物结构、三档地板的含义、7 条坑、参数速查。

一句话用法：

```bash
node tools/ab-harness.cjs --tag=c3-foam --variants=base,foam0,foam1 --runs=2
```

产物：`_baseline/ab/<tag>/<variant>/<angle>.png`（8 机位 A-top/B-high/C-mid/D-low/E-behind/F-side/G-close/H-far × 每变体）+ `report.json`。
变体注册表里每个条目**只允许改一个** `islandShoreState.*` 的 `.value`（`base/foam0/foam1/edge0/edge1/seam0/seam1/tex0`），改完 `variantApplied` 会记下实际值当取证。

#### 冻结点：`paused=true` 远远不够

第一版就是"暂停主循环 + 固定 `simTime` + 固定 `Math.random`"，跨进程一跑：**maxMean 11.387 / 79.78% 像素变**——地板比要测的差还大，
台子等于没有。用 `_baseline/ab/_diag/fingerprint.cjs` 逐字段对两次开机，真相是：水面几何（`waterGeom.ySum`）、相机、曝光、雾、`crest`、
`foamOpacity`、`waterTime` **全部相同**，但 **32 条 `swimmers` 环位置与翼龙位置全不同**。机制：预热那一秒多里跑的**真机帧数**在抖 →
`g.position.lerp(normal, Math.min(1,dt*2))` 在 `dt=0` 之后不再收敛，各模块停在"预热到哪算哪"的中间态，LCG 随机流位置也跟着帧数漂移。

修法：在页面脚本之前用 `addInitScript` 接管三样东西——① `Math.random` → 定种子 LCG（`--seed`，默认 1337）；
② `requestAnimationFrame` → **帧泵**（回调进队列，只有 `__abStep(k)` 才跑 k 帧，帧时间由合成时钟推进 +16.7 ms）；
③ `performance.now`/`Date.now` → 同一个合成时钟。于是"第 90 帧的画面"成了 `(代码, seed, warm)` 的**纯函数**，
只剩 GPU 光栅化末位噪声。`--freeze=live` 保留，专门用来复现"没有台子时是什么样"。

#### 三档地板与 `foam` 0/1 的实测（1200×900，warm 90 帧，seed 1337，simTime 12.5，weather 50）

| 项 | meanDiff | meanP99 | maxDiff | changed% | 改点均值 | vs 地板 |
|---|---|---|---|---|---|---|
| 硬地板（冻结后**再隔一帧**截两次） | 0.0005 | 0 | 4 | 0 | — | — |
| **组内自差地板**（同变体同页两轮，24 格） | **0.0011** | 0 | 6 | **0** | — | 1.0x |
| **跨进程地板**（另起 chromium 跑同一份代码） | **0.0010** | 0 | 4 | **0** | — | — |
| **`foam0` vs `foam1`**（关掉 vs 打开岸线白沫线） | **0.1539** | 3.88 | 126 | **0.70** | **22.77** | **139.9x** |
| `base` vs `foam0` | 0.1540 | 3.88 | 126 | 0.70 | 22.77 | 140x |
| `base` vs `foam1`（阴性对照，`base` 就是默认 `foam=1`） | 0.0008 | 0 | 3 | 0 | 0.75 | **0.7x → 检不出（正确）** |

逐机位（`foam0 vs foam1`，每格的组内自差地板都 ≤0.0011）：

| 机位 | meanDiff | p99 | max | changed% | 改点均值 |
|---|---|---|---|---|---|
| A-top | 0.2163 | 10 | 98 | 1.14 | 18.83 |
| B-high | 0.1852 | 1 | 68 | 0.96 | 19.02 |
| C-mid | 0.1138 | 0 | 126 | 0.44 | 25.68 |
| D-low | 0.0480 | 0 | 123 | 0.17 | 27.54 |
| E-behind | 0.1231 | 0 | 109 | 0.57 | 21.55 |
| F-side | 0.0838 | 0 | 103 | 0.34 | 24.36 |
| G-close | 0.4187 | 20 | 115 | 1.84 | 22.68 |
| H-far | 0.0426 | 0 | 78 | 0.18 | 22.50 |

**阴性对照比正向更重要**：`base` 与 `foam1` 是同一个状态，台子必须报"无差"，它报了 0.7x（检不出）；
而 `foam0/foam1` 又是 140x。两头都成立 → 台子**不造假差异、也不吞真差异**。

**对照：不接管时钟会怎样**（`--freeze=live`，同一对差分）

| 项 | clock 帧泵 | live（真机时钟） |
|---|---|---|
| 6 次开机开出几种状态 | **1** | **6**（全不一样） |
| 组内自差地板 | 0.0011 | **0.5755**（1.68% 像素变） |
| 跨进程地板 | 0.0010 | **0.3993**（1.33% 像素变） |
| `foam0 vs foam1` | 0.1539 → **139.9x** | 0.1879 → **0.3～1.0x** |
| 判定 | 检得出 | **连岸线白沫线都检不出** |

同一对差分，两种冻结方式给出相反结论。这就是"为什么以前每次数字都不可信"的物证。

**敏感度梯度**（`--tag=c3-sens --variants=base,edge0,tex0,seam0`）：

| 单变量改动 | meanDiff | changed% | vs 地板 |
|---|---|---|---|
| `edge` 0.42 → 0（湿沙带宽度归零） | 9.8867 | 54.78 | 9886.7x |
| `seam` 1 → 0（真实岸线退回圆形硬岸线） | 0.1156 | 1.21 | 115.6x |
| `foam` 1 → 0（岸线白沫线关） | 0.1539 | 0.70 | 139.9x |
| `tex` → `null`（去掉烘好的岸距贴图） | 0.0007 | 0 | **0.7x（无视觉变化）** |

最后一行是**实测的"无影响"**：取证确认 `tex` 确为 `null`，加 `water.material.needsUpdate=true` 强制重编译后仍是 0.0006，
即 `uShoreTex.value=null` 在当前构建里不改变任何像素。**别拿 `tex` 当变体**，也别据此认为这条链是死的（要查得单独查渲染路径）。

#### 结论：这台子能支撑什么、不能支撑什么

**能**：支撑**差分型**数字门——回归门（"这次改动前后，8 机位里有几个机位变了、变了多少"）与单变量敏感度门
（"关掉白沫线应该产生 ≥3x 地板的差异"）。地板 0.001/255 → 任何阈值必须 **≥0.003（3x）** 起步，
按现有梯度取 0.01～0.05 是安全的。

**不能**：它**量差，不量美**。它给不出"水面反光像缎带"的绝对刻度——要那个，得先在台子上把"像"与"不像"的
两组基线采出来（每组 ≥8 机位），再拿绝对指标去拟合两组的间距，那才是下一步的工作。**这一步只交付尺子，不交付刻度。**

#### 坑

1. **变体之间会串状态**（代价最大的一次）：第一版在同一个页面里切变体又不复位 → `edge0` 之后的 `base` 带着 `edge=0` 跑，
   组内自差从 0.001 涨到 **14.8249 / 78.47% 像素**，整张表全废，而终端看不出任何异常。现在 `FREEZE` 每次先复位
   `edge/foam/seam/time`，且默认 `--isolate=reload`（每变体新开页面，帧泵保证了重开逐位可复现，代价 ~2.5 s/变体）。
2. **`tex` 不可逆**：岸距贴图只在 `setTimeout(0)` 里烘一次，置 `null` 没法原样恢复 → `--isolate=shared` 时 `tex0` 必须排最后。
3. **`--runs=1` 没有地板**：那时判定列必须打 `—`（第一版误打了 `YES`，已修）。
4. **`waitForFunction` 必须给数字 `polling`**：rAF 被接管后默认的 `'raf'` 轮询会永远等下去。
5. **水面掩膜会漏掉白沫**：本工具沿用 `check-reflection-bands.cjs` 的 `(g-r>12 && b-r>18)` 判据，白沫是**白色**（`g-r≈0`）→
   正好被排除，`foam` 那一对的**水区均值只有 0.028**。所以白沫类改动看 `changed%` + **改点均值（22.77）**，别看 waterMeanDiff。
6. **顺带纠正 §3.41 的一个数**：那里写的"水面平均差 ~66/255"在本工具的掩膜口径下复现不出来（水区均值 0.028、全图 0.154）。
   66 大概是"只看变化像素"或别的窗口口径，**别拿它当门的标杆**；要当标杆，用本节这张表。

**教训（可复用）**：做视觉数字门之前，先花时间证明"同一份代码跑两次能给出同一个像素"。
这一步看起来最不像在做门，实际上**它就是门的地基**——`live` 与 `clock` 那张对照表说明了：地基不牢时，
你会得出"这个改动没效果"的结论，而真相反过来。

﻿### 3.46 沙滩按参考图 2 重做：一整块软边沙盘（2026-10-14）

用户 m03984 给了两张参考图并指定「**A 和 C**」，沙滩要的是**第二张**：一整块厚底、软边、撒着颗粒和石头的沙盘。

**先说一个把我坑掉的真相（这条最值钱）**：我先在 `island.js` 里删掉旧的两级圆柱、新建了一块参数化沙盘
（`PAD` / `padAng` / `padR` / `padY`，96 段 × 24 环 + 颗粒 shader）。做完之后画面**看不出变化**，我却以为是自己调得不够狠。
探针一照才明白：`art-direction.js:279` 会把 `island` 上除恐龙与灯以外的子节点**整块 `island.remove(child)`**，
而真正可见的沙滩是 `art-direction.js:106-118` 自己参数化生成的 `island-beach`（顶点色 + `u=r/border` 参数化）。
→ **`island.js` 里那块 pad 是死代码**；`check-beach` 的岸距烘焙射线打到的也是 art 那块 beach。
（`island.js` 里的 pad 我留着并加了醒目注释，因为 `art-direction.js:101` 还用 `island.children[0]/[1]` 这两个索引做隐藏，
删掉会错位到别的节点。）

**真正落地的改动（`art-direction.js:106-118`）**：
- 剖面从"斜坡"改成"沙饼"：`shoulder=THREE.MathUtils.smoothstep(u,.82,.97)`，
  `y=1.46-.025*u-shoulder*.42-Math.max(0,u-.97)*3.4+.045*Math.sin(a*5+u*6)*u`
  —— 内部接近水平（plateau），到 u≈.82 才开始圆肩下坠，边缘再薄一点，然后由裙脚（u>1）扎进海床。
- 颗粒感：顶点色乘上 `(.94+grain*.12)`，`grain` 是两条高频正弦（`a*37+u*61.3` 与 `a*89-u*23.7`）的混合，
  沿环向走一圈就有砂粒明暗，不需要贴图。
- 拓扑/绕序/UV/材质（`#fff0c5` + vertexColors + roughness .91 + DoubleSide）**一律没动**，
  所以海床接缝、裙脚并色（`shoalTone`）这些既有约束都不受影响。

**验证**：`check-beach` 的 `ptp **1.88**`、`mean **5.89**`、`sd 0.448`（岸线不圆了、且落在实测水线附近）；
全套 **25 个脚本 exit=0**（`_baseline/suite-3.46b/`）；draw call **750**、三角面 **399,008**。
截图 `_mods-out/sandpad-1.png`、`sandpad-top.png`、`jelly-before-after.png`。

### 3.47 水面果冻感（参考图 A）＋ 顺手把 check-beach 变成确定性的门（2026-10-14）

用户 m03984 的第一句要求是「**水效果很符合我想要的水**」（指参考图 A 那种糖水/果冻块），所以这一轮只动水的
**材质与深度梯度**，不动几何、不动白沫、不动拖尾。

**改动（3 个数，全在既有旋钮上）**：
| 位置 | 参数 | 改前 → 改后 | 为什么 |
|---|---|---|---|
| `ocean-life.js:13`（**最终生效处**） | `opacity` | .60 → **.52** | 稠度靠深度梯度，不靠糊一层不透明 |
| 同上 | `transmission` | .32 → **.42** | 果冻＝透光；但要配 `attenuationDistance` 才不发白 |
| 同上 | `attenuationDistance` / `attenuationColor` | 8 / `#9be7df` → **1.9** / `#35d3c6` | 让它"薄处清、厚处浓"，颜色更糖果 |
| `art-direction.js:13` | `uDepthMix` | .55 → **.8** | 深处更饱和、更重，边缘出对比 |
| `art-direction.js:10` | 水面 `color` / `roughness` / `envMapIntensity` / `clearcoat` | `#10b3c6`/.16/.55/0 → `#06a8bf`/**.13**/**.72**/**.35** | 更亮的糖壳高光；粗糙度更小才像"皮" |
| `art-direction.js:11` | 水块侧壁 `waterBody` | 纯白 .58 → `#16bdc9` .5 | 侧壁是"果冻的厚度"，白的话整块像雾 |

**注**：`island.js:279` 那套 `MeshPhysicalMaterial` 不是最终生效者——`ocean-life.js:13` 后跑，会把它盖掉；
真正改水要看 `ocean-life.js`。这条已经写进 §3.30 的老坑里，这次又踩了一次。

**顺手修的门（这才是本轮最值钱的一步）**：加了水的糖壳高光后，`check-beach.cjs` 三条断言开始随机红：
- `泡沫线没画出来（亮像素没增加）：brightGain 78 / -77`（泡沫只贡献 ~350，而画面自身抖动 ±400）
- `关掉再打开没回到原样：restoreDiff 419 > 容差 135`
根因不是改动坏了，而是**门在抖动的水面上用全局亮像素计数**。修法两步：
1. **冻结整场**：截图前 `paused=true`（`island.js` 的 `animate` 用 `dt = paused ? 0 : …`，波面/水色/白沫的
   潮汐与噪声全停在同一 t 上）。效果：**噪声地板从 ~400 掉到 1~2**，`restoreDiff` 从 419 变成 **1**。
2. 门槛按冻结后的真实尺度重设：`bigPct>0.6 → >0.12`、`restoreTol = max(noiseFloor*3,60)`；
   并把"回退路径必须像素明显变化"改成**测开关真的切到 shader 分支**（`seam` uniform 1→0→1）——
   冻结后旧圆环(6.1)与烘焙岸线(均值 5.89±0.45)几乎重合，像素差只剩 max 17，再拿像素当门就是在测巧合。

**实测（`_baseline/suite-3.47c/check-beach.cjs.log`）**：
`{"bake":{"seam":1,"ptp":1.88,"mean":5.89,"sd":0.448},"foamDiff":{"mean":0.33,"bigPct":0.18,"max":254,
"brightA":8626,"brightB":8253},"restoreDiff":{"mean":0.01,"bigPct":0,"max":3,"brightA":8626,"brightB":8625},
"fallbackDiff":{"max":17},"noiseFloor":1,"calls":750,"tris":399008,"shaderErrors":0,"pageErrors":0,"ok":true}`
→ 泡沫线亮像素 **+373**、还原差 **1**、噪声地板 **1**。全套 **25/25 exit=0**。

**还想更"果冻"可以动的三个旋钮**（都不用改代码结构）：
`ocean-life.js:13` 的 `transmission`（↑更透）与 `attenuationDistance`（↓更浓）、`art-direction.js:13` 的
`depthMix.value`（↑深处更重）。截图对照：`_mods-out/jelly-before-after.png`、`jelly-1.png`、`jelly-1-close.png`。

### 3.48h 清掉火口那圈灰白「帽檐」（2026-10-20）

用户在原图上圈出火口边缘的一圈灰白色带，说「把这块火山口模型给删干净一点」。

**它是什么**：不是火山本身的岩层，而是**模型自带那串烟的最底下裙边**。3.48c/d 剥烟时用的判据是「质心 y>0.44 且离火口轴 r<0.30」，而裙边落在 **y 0.40–0.44**，正好卡在判据下方，于是留在几何体上，从侧面看就是一圈灰白帽檐。

**为什么不能只靠几何删**：实测该区域（y 0.36–0.47、r<0.5）共 1,156 个三角面，其中灰白裙边 102 个，其余是火山内壁/熔岩口 —— 它们的 **半径区间完全重叠**（内壁最小 r 0.104，裙边最大 r 0.209），按位置删会挖穿火口。唯一干净的判据是**贴图颜色**：裙边取到的那格贴图 L≈0.68、饱和度 <0.12，火山面全是饱和的红/橙。

**做法**（`art-direction.js` 里一次性 pass，贴图异步加载完再跑）：
- 建一张离屏 canvas 把 2048² 反照率画进去，逐面按三个顶点 UV 取色求平均；
- 命中条件 `y∈(0.375,0.478) && r<0.235 && L>0.54 && S<0.175` → 从 position/normal/uv 三个属性里同时剔掉；
- 实测删 **122 面**（比第一次只删 103 面多 19 面，是几片饱和度 0.12–0.17 的薄片），模型 26,388 → **26,022 顶点**；`window.volcanoRimStrip={tris:122,trisLeft:8674}` 可查。

**验收**：draw call **727 不变**、三角面 394,516；`check-island-model` / `check-volcano-model` / `check-beach` / `check-embed-pane` / `check-mobile-layout` → **5/5 exit=0**，零 pageerror；截图 `_mods-out/rim-close.png`（火口干净）、`rim-wide.png`。

**可复用**：模型上"看着像火山自带、其实是别的物体的残留"这类问题，判据优先级＝**贴图颜色 > 连通性 > 位置**；位置判据在包围盒重叠处必然误伤。
