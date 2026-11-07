# tools/ · 诊断脚本

`tools/` 里的脚本**不是验收门**：它们不加入根目录那 24 个 `check-*.cjs` / `verify-*.cjs` 套件，
也不在任何自动化里跑。它们只做两件事——**把现象量出来**和**把图落盘**，判不判由人决定。

| 脚本 | 干什么 | 产物 |
|---|---|---|
| `ab-harness.cjs` | **A/B 对拍台**：固定整场 → 只改一个参数 → 8 机位差分 + 噪声地板 | `_baseline/ab/<tag>/` |
| `check-reflection-bands.cjs` | 单边诊断：只渲水面，量 16 方向带通能量 `peakOverRest` | `_mods-out/gate-*` |
| `check-physical-reflection.cjs` | 物理侧：掠射角反射率 / Fresnel 曲线 | 终端 + `_baseline/` |
| `capture-water.cjs` | 单纯截图，不看指标 | `_baseline/` |

---

## `ab-harness.cjs`——为什么需要它

要给"水面平行亮带 / 缎带感"做数字门，此前四次尝试（球面连通域伸长率、结构张量方向直方图、
图像方向带通、离屏只渲水面）**全部不成立**。根因不是指标选错，而是**没有对拍台**：
没有"固定整套场景 + 只改一个变量 + 全机位"的可比基线，于是任何数字都没法回答
"这次改动到底改动了几个像素、这点差异算不算数"。

这个台子就是那个缺失的基线。

## 一行用法

```bash
node tools/ab-harness.cjs --tag=c3-foam --variants=base,foam0,foam1 --runs=2
```

看"同一份代码跑两次能不能比"（跨进程地板）：

```bash
node tools/ab-harness.cjs --tag=c3-foam-repro --variants=base,foam0,foam1 --runs=2 --vs=c3-foam
```

## 产物结构

```
_baseline/ab/<tag>/
  report.json                 # 全部数字：地板、逐机位、逐变体对、指纹、变体取证
  <variant>/<angle>.png       # 8 机位 × 每变体；--runs>=2 时第二轮的图带 __run2 后缀
```

`report.json` 里值得先看的三块：

- `frozenState` / `fingerprints` / `distinctFingerprints`：**冻结证据**。
  `distinctFingerprints=1` 表示 N 次开机开出来的是逐位相同的状态。
- `variantApplied`：**变体取证**。每个变体改完之后的实际参数值——防止"以为改了其实没改"。
- `noiseFloor.floor` / `stillFrame` / `crossRun`：**地板**，见下。

## 场景是怎么钉死的（本工具的全部价值）

只写 `paused=true` **冻不住**。主循环是停了，但预热那一秒多里各模块已经各自走了一段：
鱼的环位置、海鸥、云、LCG 随机流的位置全都取决于"预热了多少帧"，而这台机器上真机时间在抖。
实测同一份代码跑两次（`--freeze=live`）：**6 次开机 → 6 种互不相同的状态**。

所以本工具在页面加载前就接管三样东西（`addInitScript`，早于任何页面脚本）：

1. `Math.random` → 定种子 LCG（`--seed`，默认 1337）
2. `requestAnimationFrame` → **帧泵**：所有回调进队列，只有 `__abStep(k)` 才跑 k 帧，
   帧时间用合成时钟推进（+16.7 ms/帧）；浏览器自己不再刷帧
3. `performance.now` / `Date.now` → 同一个合成时钟

于是"第 90 帧的画面"变成 `(代码, seed, warm)` 的**纯函数**。剩下的只有 GPU 光栅化本身的
末位噪声（实测 ≤6/255、跨阈值像素 0）。

### 冻结点

`boot()` 里顺序是固定的：固定帧数预热（`--warm`，默认 90 帧）→ 等岸距贴图烘完
（`seam===1`，这个烘在 `setTimeout(0)` 的 macrotask 里，帧泵管不到）→ 再步 10 帧 → `FREEZE`：

```js
paused = true;            // island.js:396  dt=paused?0:... → simTime 不再前进
simTime = cfg.simTime;    // 波浪相位 / 恐龙姿态 / 白沫闪烁全部变成这个常数的纯函数
viewLocked = true; target.set(0,1.15,0);
islandShoreState.time.value = cfg.simTime;   // uShoreTime：岸线摆动相位
islandShoreState.{edge,foam,seam}.value = 0.42 / 1 / 1;  // ← 复位到默认值，见"坑"
```

## 噪声地板：这张表的每一行都要和它比

| 地板 | 怎么测 | 实测（1200×900，clock 模式） |
|---|---|---|
| 硬地板 `stillFrame` | 冻结后**再隔一帧**截两次 | mean **0.0005** / p99 0 / max 4 |
| 组内自差 `noiseFloor.floor` | 同变体、同页、采集两轮 | maxMean **0.0011** / maxMax 6 / **0 像素**超阈值（24 格） |
| 跨进程 `crossRun` | 同一份代码**另起 chromium** 再跑一遍，`--vs=旧tag` | maxMean **0.001** / maxMax 4 / **0 像素**超阈值（24 格） |

三档都在 `0.001/255` 量级 → 只要单变量差 ≥ 3 倍地板（≥0.003）就算"看得见"。
这个数字不是拍脑袋定的，是 `--runs=2` 和 `--vs` 各跑一遍量出来的。

## 实测：自差地板 vs 单变量差（`foam` 0/1）

`--tag=c3-foam --variants=base,foam0,foam1 --runs=2`，`warm=90f seed=1337 simTime=12.5 weather=50`

| 项 | meanDiff | meanP99 | maxDiff | changed% | 改点均值 | vs 地板 |
|---|---|---|---|---|---|---|
| **组内自差地板** | 0.0011 | 0 | 6 | 0 | — | 1.0x |
| **跨进程地板** | 0.001 | 4 | 4 | 0 | — | — |
| `foam0` vs `foam1` | **0.1539** | 3.88 | 126 | 0.70 | **22.77** | **139.9x** |
| `base` vs `foam0` | 0.154 | 3.88 | 126 | 0.70 | 22.77 | 140x |
| `base` vs `foam1`（阴性对照） | 0.0008 | 0 | 3 | 0 | 0.75 | **0.7x → 检不出（正确）** |

`base` 就是发售默认值（`foam=1`），所以 `base vs foam1` 必须检不出——它确实检不出。
这说明台子**不会造出假差异**；同时 `foam0/foam1` 又是 140x，说明它**也不吞真差异**。

逐机位（`foam0 vs foam1`，8 机位全部远超地板）：

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

## 对照：不接管时钟会怎样（`--freeze=live`）

| 项 | clock 帧泵 | live（真机时钟 + 固定墙钟预热） |
|---|---|---|
| 开机 N 次的状态种数 | **1** | **6**（N=6，全不一样） |
| 组内自差地板 | 0.0011 | **0.5755**（1.68% 像素变） |
| 跨进程地板 | 0.0010 | **0.3993**（1.33% 像素变） |
| `foam0 vs foam1` | 0.1539 → **139.9x** | 0.1879 → **0.3～1.0x** |
| 结论 | 检得出 | **连岸线白沫线都检不出** |

同一对差分，两种冻结方式给出相反的结论。`live` 模式留在工具里就是为了能复现这张表——
**它记录的是"没有对拍台时是什么样"**，不是给人用的选项。

## 敏感度梯度（`--tag=c3-sens --variants=base,edge0,tex0,seam0`）

| 单变量改动 | meanDiff | changed% | vs 地板 |
|---|---|---|---|
| `edge` 0.42 → 0（湿沙带宽度归零） | 9.8867 | 54.78 | 9886.7x |
| `seam` 1 → 0（真实岸线退回圆形硬岸线） | 0.1156 | 1.21 | 115.6x |
| `foam` 1 → 0（岸线白沫线关） | 0.1539 | 0.70 | 139.9x |
| `tex` → `null`（去掉烘好的岸距贴图） | 0.0007 | 0 | **0.7x（无视觉变化）** |

最后一行是**实测的"无影响"**，不是漏测：取证确认 `tex` 确实是 `null`（`variantApplied` 里是
`tex:null`），加上 `water.material.needsUpdate=true` 强制重编译也一样是 0.0007。
也就是说 `uShoreTex.value=null` 在当前构建里不改变任何像素——**别拿它当变体**，
要动这条线得单独查渲染路径。这一行同时是台子的第二个阴性对照。

## 与 `check-reflection-bands.cjs` 的区别

| | `ab-harness.cjs` | `check-reflection-bands.cjs` |
|---|---|---|
| 问的问题 | "改动 A 相对改动 B 差了多少像素" | "这张图里有没有平行亮带"（绝对判断） |
| 比较对象 | 两个冻结状态的**差** | 单张图的带通能量比 |
| 判据 | 差 ≥ 3x 地板 | `peakOverRest < 1.55` |
| 能不能定阈值 | **不能**：它只给差分幅度，给不出"缎带感"的绝对刻度 | 试图给，但四次尝试都不成立 |
| 关系 | **是给后者铺基线用的**：先把水面掩膜/机位/冻结钉死，绝对指标才有意义 | 需要台子提供的可比基线 |

一句话：**台子量差，不量美。** 它能证明"改这一行让 8 机位里 7 个机位的水面变了 0.15/255（140x 地板）"，
不能证明"现在的反光像缎带"。要后者，得先在台子上把"像 / 不像"的两组基线采出来，
再拿绝对指标去拟合这两组的间距——**那是下一步，不是这一步**。

## 坑（都踩过，别重踩）

1. **`paused=true` 冻不住整场。** 见上面 live/clock 对照表。必须接管 rAF + 时钟。
2. **变体之间会串状态。** 第一版在同一个页面里切变体又不复位 → `edge0` 之后的 `base` 带着
   `edge=0` 跑，组内自差从 0.001 直接涨到 **14.82 / 78.47% 像素**，整张表全废。
   现在 `FREEZE` 每次先复位 `edge/foam/seam/time`，并且默认 `--isolate=reload`（每变体新开页面）。
3. **`tex` 不可逆。** 岸距贴图在 `setTimeout(0)` 里只烘一次，`tex.value=null` 之后没法原样恢复
   （重烘不会自己触发）→ 用 `--isolate=shared` 时 `tex0` 必须排在最后一个变体。
4. **rAF 被接管后 `waitForFunction` 必须给数字 `polling`。** 默认的 `'raf'` 轮询会永远等下去。
5. **顶层 `const` 不在 `window` 上。** `depthMix` / `clouds` 在 `art-direction.js` 的 IIFE 里，
   裸名访问会 `ReferenceError`；`paused` / `simTime` / `phi` / `theta` / `distance` 是顶层 `let`
   所以能裸名赋值。
6. **水面掩膜会漏掉白沫。** 本工具的 `waterMeanDiff` 沿用 `check-reflection-bands.cjs` 的
   `(g-r>12 && b-r>18)` 判据，而白沫线是**白色**（`g-r≈0`）→ 正好被排除掉，
   所以 `foam` 这一对的水区均值只有 0.028，**不能拿它判白沫类改动**；
   白沫类看 `changed%` + `改点均值`。
7. **`--runs=1` 没有地板。** 那时 `vs自差` 列打 `—`，判定列也打 `—`——只出图，别读判定。

## 参数速查

```
--tag=NAME           产物目录（默认 c3-<时间戳>）
--variants=a,b,c     内置变体：base foam0 foam1 edge0 edge1 seam0 seam1 tex0
--js=EXPR            追加一个叫 custom 的变体（EXPR 在页面里求值，用裸名改顶层 let）
--runs=R             每变体重复轮数，R>=2 才有组内自差地板（默认 2）
--warm=N             预热帧数（合成时钟，16.7ms/帧），默认 90
--simtime=T          冻结时钉住的 simTime，默认 12.5
--seed=N             Math.random 的 LCG 种子，默认 1337
--view=WxH           视口，默认 1200x900
--url=URL            默认 http://127.0.0.1:8795/
--thr=N              changed% 的判定阈值（单像素通道差），默认 2
--vs=PREV_TAG        采完与 _baseline/ab/<PREV_TAG>/ 逐格比 → 跨进程地板
--isolate=reload|shared  每变体新开页面（默认）/ 同页切换（快，但依赖 FREEZE 复位）
--freeze=clock|live  帧泵 + 合成时钟（默认）/ 真机时钟（只用来复现大噪声）
--no-hide-ui         不隐藏 canvas 以外的 DOM
--strict             检不出已知差异时 exit 1
--keep-open          debug：跑完不关浏览器
```

`_baseline/ab/_diag/` 里是**一次性**定位脚本（`fingerprint.cjs` 逐字段对比两次开机的状态、
`gate-test.cjs` 验证帧泵能不能把跨进程地板打到 0）。它们不进工具链，留着当证据：
`fp1.json` / `fp2.json` 就是"接管时钟前，两次开机的水面几何完全相同、但 32 条游泳生物位置全不同"的原始记录。
