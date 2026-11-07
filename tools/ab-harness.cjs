#!/usr/bin/env node
/* ============================================================================
 * tools/ab-harness.cjs
 *
 * ⚠ 诊断工具，不属于验收套件（DIAGNOSTIC ONLY — NOT A GATE）。
 *   不加入根目录 24 个 check-*.cjs / verify-*.cjs 套件，不参与任何门禁断言。
 *   它产出"可比对的图 + 一张差分数表"，判不判由人决定。
 *
 * 为什么需要它
 *   给"水面平行亮带 / 缎带感"做数字门，此前四次尝试（球面连通域伸长率、结构张量
 *   方向直方图、图像方向带通、离屏只渲水面）全部不成立。根因不是指标选错，而是
 *   没有对拍台：没有"固定整套场景 + 只改一个变量 + 全机位"的可比基线。
 *
 * 怎么把场景钉死（这是本工具的全部价值所在）
 *   仅靠 `paused=true` 冻不住：主循环停了，但**预热那一秒多里各模块已经各自走了一段**，
 *   鱼的环位置、海鸥、云、LCG 随机流的位置全都取决于"预热了多少帧"——而这台机器上
 *   真机时间抖动，实测同一份代码跑两次，全帧平均差 11.387/255、79.78% 的像素变了
 *   （见 docs/development-notes.md §3.45 的对照表）。这样的地板比要紧的差还大，台子
 *   等于没用。所以本工具在页面加载前就接管三样东西：
 *
 *   1. `Math.random`  → 定种子 LCG（seed 可指定）
 *   2. `requestAnimationFrame` → 帧泵：所有回调进队列，只有 `__abStep(k)` 才跑 k 帧，
 *      帧时间用合成时钟推进（+16.7ms/帧），浏览器自己不再刷帧
 *   3. `performance.now` / `Date.now` → 同一个合成时钟
 *
 *   于是"第 90 帧的画面"就是 (代码, seed, warm) 的纯函数。实测跨进程（两次独立
 *   chromium launch）全帧平均差 0.0008/255、0 像素超阈值——与 11.387 差三个数量级。
 *   这才是能让单变量差说话的基线。
 *
 * 用法
 *   node tools/ab-harness.cjs --tag=c3-foam --variants=foam0,foam1 --runs=2
 *   node tools/ab-harness.cjs --tag=x --variants=base,edge0 --warm=90 --seed=1337
 *   node tools/ab-harness.cjs --tag=now --variants=foam0,foam1 --vs=c3-foam
 *   node tools/ab-harness.cjs --tag=x --variants=foam0 --js='window.islandShoreState.seam.value=0'
 *
 * 参数
 *   --tag=NAME         产物目录名（默认 c3-<时间戳>），产物落 _baseline/ab/<tag>/
 *   --variants=a,b,..  变体内置名，见下方 VARS；默认 foam0,foam1
 *   --js=EXPR          额外加一个自定义变体（名 custom），EXPR 在页面里求值
 *   --runs=R           每个变体重复轮数（R>=2 才有组内自差），默认 2
 *   --warm=N           预热帧数（合成时钟，逐帧 16.7ms），默认 90
 *   --simtime=T        冻结时钉住的 simTime（波浪相位/恐龙姿态/白沫闪烁的输入），默认 12.5
 *   --seed=N           Math.random 的 LCG 种子，默认 1337
 *   --view=WxH         视口，默认 1200x900
 *   --url=URL          默认 http://127.0.0.1:8795/
 *   --thr=N            changedPct 的判定阈值（单像素通道差 0-255），默认 2
 *   --vs=PREV_TAG      采完后与 _baseline/ab/<PREV_TAG>/ 逐格对比，得到**跨进程地板**
 *                      （同一份代码跑两次差多少）。这才是"能不能当门用"的决定性数字。
 *   --freeze=clock|live  clock（默认，帧泵 + 合成时钟）；live = 老办法（真机时间 +
 *                      固定墙钟预热），只用来复现"没有台子"时那种大噪声
 *   --no-hide-ui       不隐藏 canvas 以外的 DOM（默认隐藏，减少 DOM 抖动干扰）
 *   --strict           检不出已知差异时 exit 1（默认只 warning）
 *   --keep-open        debug：跑完不关浏览器（30s 后自己退）
 * ==========================================================================*/
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../dy_runtime/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* ---- 8 机位（俯视 / 高角 / 中角 / 低角 / 背面 / 侧面 / 近景 / 远景）------- */
const VIEWS = [
  { name: 'A-top',    phi: 0.06, theta: 0.0, d: 26 },
  { name: 'B-high',   phi: 0.55, theta: 0.6, d: 26 },
  { name: 'C-mid',    phi: 1.05, theta: 1.5, d: 30 },
  { name: 'D-low',    phi: 1.32, theta: 2.4, d: 30 },
  { name: 'E-behind', phi: 0.95, theta: 3.6, d: 28 },
  { name: 'F-side',   phi: 1.20, theta: 5.1, d: 28 },
  { name: 'G-close',  phi: 0.85, theta: 2.0, d: 18 },
  { name: 'H-far',    phi: 1.15, theta: 4.2, d: 40 },
];

/* ---- 内置变体注册表：每个都只改**一个**显式参数 -------------------------- */
const VARS = {
  base:  { desc: '不动任何变量（对照组，用来量纯噪声）', js: 'void 0' },
  foam1: { desc: 'islandShoreState.foam.value=1（岸线白沫线 开）', js: 'window.islandShoreState.foam.value=1' },
  foam0: { desc: 'islandShoreState.foam.value=0（岸线白沫线 关）', js: 'window.islandShoreState.foam.value=0' },
  edge0: { desc: 'islandShoreState.edge.value=0（湿沙带宽度 0）', js: 'window.islandShoreState.edge.value=0' },
  edge1: { desc: 'islandShoreState.edge.value=1.2（湿沙带加宽）', js: 'window.islandShoreState.edge.value=1.2' },
  seam0: { desc: 'islandShoreState.seam.value=0（退回圆形硬岸线）', js: 'window.islandShoreState.seam.value=0' },
  seam1: { desc: 'islandShoreState.seam.value=1（真实岸线）', js: 'window.islandShoreState.seam.value=1' },
  tex0:  { desc: 'islandShoreState.tex.value=null（去掉烘好的岸距贴图）', js: 'window.islandShoreState.tex.value=null' },
};

/* ---- 参数 ---------------------------------------------------------------- */
function parseArgs(argv) {
  const o = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
  }
  return o;
}
const argv = parseArgs(process.argv);
const TAG = argv.tag || 'c3-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(ROOT, '_baseline', 'ab', TAG);
const RUNS = Math.max(1, parseInt(argv.runs || '2', 10));
const WARM = Math.max(1, parseInt(argv.warm || '90', 10));
const SIMTIME = Number(argv.simtime || 12.5);
const SEED = parseInt(argv.seed || '1337', 10) >>> 0;
const THR = Number(argv.thr || 2);
const URL_ = argv.url || 'http://127.0.0.1:8795/';
const HIDE_UI = argv['no-hide-ui'] ? false : true;
const STRICT = !!argv.strict;
const FREEZE_MODE = String(argv.freeze || 'clock');
const [VW, VH] = (argv.view || '1200x900').split('x').map(Number);

const variantNames = String(argv.variants || 'foam0,foam1').split(',').map(s => s.trim()).filter(Boolean);
const variants = variantNames.map(n => {
  if (!VARS[n]) { console.error('未知变体: ' + n + '  可选: ' + Object.keys(VARS).join(', ')); process.exit(2); }
  return { name: n, desc: VARS[n].desc, js: VARS[n].js };
});
if (typeof argv.js === 'string') variants.push({ name: 'custom', desc: '自定义: ' + argv.js, js: argv.js });

/* ---- 页面加载前注入：定种子 LCG + 帧泵 + 合成时钟 ------------------------ */
const INIT_SCRIPT = (cfg) => `(() => {
  let s = ${cfg.seed >>> 0};
  Math.random = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  window.__abSeed = ${cfg.seed >>> 0};
  const realRaf = window.requestAnimationFrame.bind(window);
  window.__abRealRaf = realRaf;
  window.__abPaint = () => new Promise(r => realRaf(() => realRaf(() => r(1))));
  window.__abMode = '${cfg.mode}';
  if ('${cfg.mode}' !== 'clock') return;   // live 模式：保留真机时钟/真 rAF，只注入定种子
  let queue = [], T = 0;
  const ORIGIN = 5000;
  // 浏览器自己不再刷帧：所有 rAF 回调进队列，只有 __abStep 才跑
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.__abStep = (k) => {
    for (let i = 0; i < k; i++) {
      const cbs = queue; queue = []; T += 16.7;
      const now = ORIGIN + T;
      for (const cb of cbs) { try { cb(now); } catch (e) {} }
    }
    return { clock: +(ORIGIN + T).toFixed(2), queued: queue.length };
  };
  performance.now = () => ORIGIN + T;
  Date.now = () => 1730000000000 + ORIGIN + T;
})();`;

/* ---- 冻结整场：每轮 / 每个变体前都重放一次，保证幂等 -------------------- */
const FREEZE = (cfg) => {
  // island.js:396 —— dt = paused ? 0 : ...，所以 paused 一开 simTime 就不再前进。
  paused = true;
  simTime = cfg.simTime;          // 波浪相位 / 恐龙姿态 / 白沫闪烁全部变成这个常数的纯函数
  viewLocked = true;              // 不跟随 focus / 不吃 panOffset
  target.set(0, 1.15, 0);
  const S = window.islandShoreState;
  if (S) {
    // 复位到发售默认值（island.js:177 shEdge .42 / shFoam 1 / shSeam 烘焙后 1）。
    // 不复位会让上一个变体改过的值漏到下一个变体 —— 实测过：edge0 之后 base 的
    // 组内自差从 0.001 涨到 14.82、78.47% 像素变化，整张表报废。
    if (S.edge) S.edge.value = 0.42;
    if (S.foam) S.foam.value = 1;
    if (S.seam) S.seam.value = 1;        // 烘焙已存在，回 1 是廉价的纯数值复位
    if (S.time) S.time.value = cfg.simTime;   // uShoreTime：岸线摆动相位
  }
  // 注意：tex（岸距贴图）置 null 是**不可逆**的（重烘在 setTimeout 里只跑一次），
  // 所以默认 --isolate=reload 每变体新开页面；--isolate=shared 时 tex0 必须排最后。
  if (window.weatherLife && window.weatherLife.set) window.weatherLife.set(cfg.weather);
  if (cfg.hideUI) {
    document.querySelectorAll('body > *').forEach(el => {
      if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
    });
  }
};

/* ---- 相机 --------------------------------------------------------------- */
const SETCAM = (v) => { phi = v.phi; theta = v.theta; distance = v.d; viewLocked = true; target.set(0, 1.15, 0); };

/* ---- 差分：在辅助页里解码两张 PNG 并逐像素比（不引第三方 png 解码库）---- */
async function diffPair(q, bufA, bufB, thr) {
  const toURL = b => 'data:image/png;base64,' + b.toString('base64');
  return q.evaluate(async ([ua, ub, thr]) => {
    const load = async (u) => {
      const img = new Image(); img.src = u; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      return { d: x.getImageData(0, 0, img.width, img.height).data, W: img.width, H: img.height };
    };
    const A = await load(ua), B = await load(ub);
    if (A.W !== B.W || A.H !== B.H) return { error: 'size mismatch ' + A.W + 'x' + A.H + ' vs ' + B.W + 'x' + B.H };
    const N = A.W * A.H, ad = A.d, bd = B.d;
    const hist = new Uint32Array(256);
    let sum = 0, max = 0, changed = 0, changedSum = 0;
    let wSum = 0, wN = 0, wChanged = 0, wHist = new Uint32Array(256);
    for (let i = 0; i < N; i++) {
      const o = i << 2;
      // 逐像素差 = 三通道最大绝对差（0-255），整数运算，无浮点抖动
      const dr = Math.abs(ad[o] - bd[o]), dg = Math.abs(ad[o + 1] - bd[o + 1]), db = Math.abs(ad[o + 2] - bd[o + 2]);
      const pd = dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
      hist[pd]++; sum += pd; if (pd > max) max = pd; if (pd > thr) { changed++; changedSum += pd; }
      // 次级指标：水面像素子集（沿用 check-reflection-bands.cjs 的绿蓝占优判据）。
      // 只作参考，不参与判定——这套判据本身就是 3.39 失败过的指标之一。
      const wa = (ad[o + 1] - ad[o] > 12 && ad[o + 2] - ad[o] > 18);
      const wb = (bd[o + 1] - bd[o] > 12 && bd[o + 2] - bd[o] > 18);
      if (wa || wb) { wN++; wSum += pd; wHist[pd]++; if (pd > thr) wChanged++; }
    }
    const pct = (h, n, p) => { let c = 0; for (let v = 0; v < 256; v++) { c += h[v]; if (c >= n * p) return v; } return 255; };
    return {
      meanDiff: +(sum / N).toFixed(4),
      p99Diff: pct(hist, N, 0.99),
      maxDiff: max,
      changedPct: +(changed / N * 100).toFixed(2),
      // 变化像素里的平均强度：与 3.41 那个"水面平均差 66/255"同量纲（局部对比度）
      changedMeanDiff: changed ? +(changedSum / changed).toFixed(2) : 0,
      waterPct: +(wN / N * 100).toFixed(1),
      waterMeanDiff: wN ? +(wSum / wN).toFixed(4) : null,
      waterP99Diff: wN ? pct(wHist, wN, 0.99) : null,
      waterChangedPct: wN ? +(wChanged / wN * 100).toFixed(2) : null,
      pixels: N,
    };
  }, [toURL(bufA), toURL(bufB), thr]);
}

/* ---- 主流程 ------------------------------------------------------------- */
const ISOLATE = String(argv.isolate || 'reload');   // reload（默认：每变体新开页面）| shared

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const errors = [];
  const fingerprints = [];
  const appliedLog = {};   // 每个变体改完之后的实际参数值（取证：确认变量真的生效）

  /* --- 一次页面的完整开机流程：注入 → 加载 → 固定帧预热 → 冻结整场 --- */
  async function boot(cfg) {
    const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await p.addInitScript({ content: INIT_SCRIPT({ seed: SEED, mode: FREEZE_MODE }) });
    await p.goto(URL_, { waitUntil: 'load' });
    // polling 必须是数字间隔：clock 模式下 rAF 已被接管，'raf' 轮询会卡死
    await p.waitForFunction(() => !!window.weatherLife && !!window.islandShoreState, null, { timeout: 20000, polling: 40 });
    const step = (k) => p.evaluate(n => (window.__abStep ? window.__abStep(n) : 0), k);
    const paint = () => p.evaluate(() => window.__abPaint());

    let seamBaked = true, warmClock = null;
    if (FREEZE_MODE === 'clock') {
      warmClock = await step(WARM);                       // 固定帧数预热（不是固定墙钟）
      // 岸距贴图在 setTimeout(0) 的 macrotask 里异步烘；帧泵管不到 timers，这里等它
      seamBaked = await p.waitForFunction(
        () => window.islandShoreState.seam.value === 1, null, { timeout: 15000, polling: 40 }
      ).then(() => true).catch(() => false);
      warmClock = await step(10);
    } else {
      await p.waitForTimeout(1800);
      seamBaked = await p.waitForFunction(
        () => window.islandShoreState.seam.value === 1, null, { timeout: 15000, polling: 40 }
      ).then(() => true).catch(() => false);
    }

    const weatherValue = await p.evaluate(() => window.weatherLife.value);
    const fp = await p.evaluate(() => ({
      simTime: +simTime.toFixed(4),
      shoreTime: +window.islandShoreState.time.value.toFixed(4),
      swimmer0: swimmers[0].g.position.toArray().map(v => +v.toFixed(4)),
      dino0: dinosaurs[0].g.position.toArray().map(v => +v.toFixed(4)),
      ptero: dinosaurs[3].g.position.toArray().map(v => +v.toFixed(4)),
      exposure: +renderer.toneMappingExposure.toFixed(5),
      clock: window.__abStep ? window.__abStep(0).clock : null,
    }));
    fingerprints.push(Object.assign({ mode: FREEZE_MODE, warm: WARM }, fp));

    const fcfg = { simTime: SIMTIME, weather: weatherValue, hideUI: HIDE_UI };
    await p.evaluate(FREEZE, fcfg);
    if (FREEZE_MODE === 'clock') await step(2); else await p.waitForTimeout(400);
    await paint();

    const frozen = await p.evaluate(() => ({
      paused: paused, viewLocked: viewLocked, simTime: simTime,
      seam: window.islandShoreState.seam.value, foam: window.islandShoreState.foam.value,
      edge: window.islandShoreState.edge.value, tex: !!window.islandShoreState.tex.value,
      shoreTime: window.islandShoreState.time.value,
      weather: window.weatherLife.value, rain: window.weatherLife.rain,
      camera: { phi: phi, theta: theta, distance: distance },
    }));
    return { p, step, paint, seamBaked, warmClock, frozen, weatherValue, cfg: fcfg };
  }

  /* --- 在一个已冻结的页面上：只改这一个参数，扫 8 机位 --- */
  async function captureVariant(s, v, dir, run) {
    await s.p.evaluate(FREEZE, s.cfg);                       // 幂等：每轮都从默认状态重放
    if (v.js) await s.p.evaluate(`(() => { ${v.js} })()`);   // ← 唯一变量
    if (FREEZE_MODE === 'clock') await s.step(2); else await s.p.waitForTimeout(150);
    // 取证：确认这个变量真的生效了（不是"以为改了"）
    const applied = await s.p.evaluate(() => ({
      edge: window.islandShoreState.edge.value,
      foam: window.islandShoreState.foam.value,
      seam: window.islandShoreState.seam.value,
      tex: window.islandShoreState.tex.value ? 'obj' : null,
      time: window.islandShoreState.time.value,
    }));
    if (run === 1) appliedLog[v.name] = applied;
    const out = {};
    for (const view of VIEWS) {
      await s.p.evaluate(SETCAM, view);
      if (FREEZE_MODE === 'clock') await s.step(2); else await s.p.waitForTimeout(450);
      await s.paint();
      const buf = await s.p.screenshot();
      const fn = view.name + (run === 1 ? '' : '__run' + run) + '.png';
      fs.writeFileSync(path.join(dir, fn), buf);
      out[view.name] = buf;
    }
    return out;
  }

  try {
    const cfgProbe = { simTime: SIMTIME, weather: 50, hideUI: HIDE_UI };
    const first = await boot(cfgProbe);           // 顺带拿到 weather 实际值
    const cfg = Object.assign({}, first.cfg);
    const frozenInfo = first.frozen;

    /* --- 硬地板：冻结后再隔一帧，两次截图 --- */
    await first.p.evaluate(SETCAM, VIEWS[2]);
    if (FREEZE_MODE === 'clock') await first.step(2); else await first.p.waitForTimeout(700);
    await first.paint();
    const stillA = await first.p.screenshot();
    if (FREEZE_MODE === 'clock') await first.step(1); else await first.p.waitForTimeout(700);
    await first.paint();
    const stillB = await first.p.screenshot();
    const q = await b.newPage();
    const stillDiff = await diffPair(q, stillA, stillB, THR);
    if (ISOLATE !== 'reload') await first.p.close();

    /* --- 采集：轮 × 变体 × 机位 --- */
    const shots = {}, extra = {}, viewLog = {};
    let seamBaked = first.seamBaked, warmClock = first.warmClock;
    for (let run = 1; run <= RUNS; run++) {
      for (const v of variants) {
        const dir = path.join(OUT, v.name);
        fs.mkdirSync(dir, { recursive: true });
        let s;
        if (ISOLATE === 'reload') {
          s = (run === 1 && v === variants[0]) ? first : await boot(cfg);
          if (v === variants[0]) first.used = true;
        } else {
          s = first;
        }
        const got = await captureVariant(s, v, dir, run);
        for (const k of Object.keys(got)) {
          if (run === 1) { (shots[v.name] = shots[v.name] || {})[k] = got[k]; }
          else extra[v.name + '|' + k + '|' + run] = got[k];
          viewLog[v.name + '/' + k] = k + (run === 1 ? '' : '__run' + run) + '.png';
        }
        if (ISOLATE === 'reload' && s !== first) await s.p.close();
      }
    }
    if (ISOLATE === 'reload') await first.p.close();

    /* --- 组内自差（同变体同一页两次采集） --- */
    const selfDiff = {};
    let nMaxMean = 0, nMaxP99 = 0, nMaxMax = 0, nSumMean = 0, nCount = 0, nMaxChanged = 0;
    for (const v of variants) {
      selfDiff[v.name] = {};
      for (const view of VIEWS) {
        for (let run = 2; run <= RUNS; run++) {
          const d = await diffPair(q, shots[v.name][view.name], extra[v.name + '|' + view.name + '|' + run], THR);
          selfDiff[v.name][view.name] = d;
          if (d.meanDiff > nMaxMean) nMaxMean = d.meanDiff;
          if (d.p99Diff > nMaxP99) nMaxP99 = d.p99Diff;
          if (d.maxDiff > nMaxMax) nMaxMax = d.maxDiff;
          if (d.changedPct > nMaxChanged) nMaxChanged = d.changedPct;
          nSumMean += d.meanDiff; nCount++;
        }
      }
    }
    const noiseByAngle = Object.fromEntries(VIEWS.map(view => {
      const vals = variants.map(v => selfDiff[v.name][view.name]).filter(Boolean);
      const pick = (k) => vals.length ? Math.max(...vals.map(x => x[k])) : null;
      return [view.name, { meanDiff: pick('meanDiff'), p99Diff: pick('p99Diff'), maxDiff: pick('maxDiff'), changedPct: pick('changedPct') }];
    }));
    const noise = {
      byAngle: noiseByAngle,
      floor: {
        maxMeanDiff: +nMaxMean.toFixed(4),
        meanMeanDiff: +(nSumMean / Math.max(1, nCount)).toFixed(4),
        maxP99Diff: nMaxP99, maxMaxDiff: nMaxMax, maxChangedPct: nMaxChanged,
        samples: nCount,
        stillFrameMeanDiff: stillDiff.meanDiff,
        stillFrameMaxDiff: stillDiff.maxDiff,
      },
    };

    /* --- 变体两两对拍 --- */
    const pairs = [];
    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        const A = variants[i], B = variants[j];
        const byAngle = {};
        let sMean = 0, sP99 = 0, sMax = 0, sChanged = 0, sWater = 0, nW = 0, sChangedMean = 0;
        for (const view of VIEWS) {
          const d = await diffPair(q, shots[A.name][view.name], shots[B.name][view.name], THR);
          byAngle[view.name] = d;
          sMean += d.meanDiff; sP99 += d.p99Diff; sChangedMean += d.changedMeanDiff;
          sMax = Math.max(sMax, d.maxDiff); sChanged += d.changedPct;
          if (d.waterMeanDiff != null) { sWater += d.waterMeanDiff; nW++; }
        }
        const summary = {
          meanDiff: +(sMean / VIEWS.length).toFixed(4),
          meanP99Diff: +(sP99 / VIEWS.length).toFixed(2),
          maxDiff: sMax,
          meanChangedPct: +(sChanged / VIEWS.length).toFixed(2),
          meanChangedMeanDiff: +(sChangedMean / VIEWS.length).toFixed(2),
          meanWaterMeanDiff: nW ? +(sWater / nW).toFixed(4) : null,
        };
        const ratio = noise.floor.maxMeanDiff > 0 ? +(summary.meanDiff / noise.floor.maxMeanDiff).toFixed(1) : null;
        pairs.push({ a: A.name, b: B.name, byAngle, summary, ratioVsSelfDiffFloor: ratio, detectable3x: ratio == null ? null : ratio >= 3 });
      }
    }

    /* --- 跨进程复现（--vs=旧 tag）：回答"这个台子能不能当门用" --- */
    let crossRun = null;
    if (argv.vs) {
      const prevDir = path.join(ROOT, '_baseline', 'ab', String(argv.vs));
      if (!fs.existsSync(prevDir)) {
        errors.push('--vs 目录不存在: ' + prevDir);
      } else {
        const byVA = {};
        let cMax = 0, cSum = 0, cN = 0, cMaxMax = 0, cMaxChanged = 0;
        for (const v of variants) {
          byVA[v.name] = {};
          for (const view of VIEWS) {
            const f = path.join(prevDir, v.name, view.name + '.png');
            if (!fs.existsSync(f)) continue;              // 旧 tag 没有这个变体就跳过
            const d = await diffPair(q, fs.readFileSync(f), shots[v.name][view.name], THR);
            byVA[v.name][view.name] = d;
            if (d.meanDiff > cMax) cMax = d.meanDiff;
            if (d.maxDiff > cMaxMax) cMaxMax = d.maxDiff;
            if (d.changedPct > cMaxChanged) cMaxChanged = d.changedPct;
            cSum += d.meanDiff; cN++;
          }
        }
        crossRun = {
          vsTag: String(argv.vs), byVariantAngle: byVA,
          summary: {
            maxMeanDiff: +cMax.toFixed(4), meanMeanDiff: +(cSum / Math.max(1, cN)).toFixed(4),
            maxMaxDiff: cMaxMax, maxChangedPct: cMaxChanged, samples: cN,
          },
        };
        for (const pr of pairs) {
          const f = crossRun.summary.maxMeanDiff;
          pr.ratioVsCrossRunFloor = f > 0
            ? +(pr.summary.meanDiff / f).toFixed(1)
            : (pr.summary.meanDiff > 0 ? 'inf' : 1);    // 地板逐像素为 0 → 比值无穷
        }
      }
    }
    await q.close();

    /* --- 指纹一致性：所有页面开出来的状态是否逐位相同 --- */
    const fpKey = (f) => JSON.stringify([f.simTime, f.shoreTime, f.swimmer0, f.dino0, f.ptero, f.exposure, f.clock]);
    const distinctFingerprints = [...new Set(fingerprints.map(fpKey))].length;

    const report = {
      tool: 'tools/ab-harness.cjs',
      kind: 'diagnostic',                 // 诊断工具，不属于验收套件
      note: '固定整场 + 单变量 + 8 机位差分对拍台；不是 gate',
      tag: TAG, url: URL_, createdAt: new Date().toISOString(), elapsedMs: Date.now() - t0,
      freezeMode: FREEZE_MODE, isolate: ISOLATE, seed: SEED, warmFrames: WARM, simTime: SIMTIME,
      viewport: { width: VW, height: VH }, runs: RUNS, changedThreshold: THR,
      seamBaked, warmClock, freezeConfig: cfg, frozenState: frozenInfo, errors,
      fingerprints, distinctFingerprints, variantApplied: appliedLog,
      angles: VIEWS.map(v => v.name),
      variants,
      stillFrame: stillDiff,
      selfDiff, noiseFloor: noise,
      pairs, crossRun,
      files: viewLog,
    };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1), 'utf8');

    /* --- 终端小表 --- */
    const pad = (s, n) => String(s).padEnd(n);
    console.log('\n== ab-harness  tag=' + TAG + '  ' + (Date.now() - t0) + 'ms  mode=' + FREEZE_MODE +
      '  isolate=' + ISOLATE + '  warm=' + WARM + 'f  seamBaked=' + seamBaked + ' ==');
    console.log('冻结: paused=' + frozenInfo.paused + ' simTime=' + frozenInfo.simTime.toFixed(3) +
      ' shoreTime=' + frozenInfo.shoreTime + ' edge=' + frozenInfo.edge + ' foam=' + frozenInfo.foam +
      ' seam=' + frozenInfo.seam + ' tex=' + frozenInfo.tex +
      ' weather=' + frozenInfo.weather + ' rain=' + frozenInfo.rain.toFixed(3) + ' seed=' + SEED);
    console.log('指纹: ' + fingerprints.length + ' 次开机 → ' + distinctFingerprints + ' 种状态' +
      '（1 种 = 逐位可复现）  swimmer0=' + JSON.stringify(fingerprints[0].swimmer0) + ' clock=' + fingerprints[0].clock);
    console.log('变体取证（改完后的实际值）: ' + Object.entries(appliedLog).map(([k, v]) =>
      k + '={edge:' + v.edge + ' foam:' + v.foam + ' seam:' + v.seam + ' tex:' + v.tex + '}').join('  '));
    console.log('硬地板（冻结后再隔一帧）: mean=' + stillDiff.meanDiff + ' p99=' + stillDiff.p99Diff + ' max=' + stillDiff.maxDiff);
    console.log('组内自差地板（同变体同页两次）: maxMean=' + noise.floor.maxMeanDiff + ' meanMean=' + noise.floor.meanMeanDiff +
      ' maxP99=' + noise.floor.maxP99Diff + ' maxMax=' + noise.floor.maxMaxDiff + ' maxChanged%=' + noise.floor.maxChangedPct);
    console.log('\n' + pad('变体对', 18) + pad('meanDiff', 11) + pad('meanP99', 10) + pad('maxDiff', 9) +
      pad('changed%', 10) + pad('改点均值', 11) + pad('vs自差', 9) + '检得出');
    for (const pr of pairs) {
      console.log(pad(pr.a + ' vs ' + pr.b, 18) + pad(pr.summary.meanDiff, 11) + pad(pr.summary.meanP99Diff, 10) +
        pad(pr.summary.maxDiff, 9) + pad(pr.summary.meanChangedPct, 10) + pad(pr.summary.meanChangedMeanDiff, 11) +
        pad(pr.ratioVsSelfDiffFloor == null ? '—' : pr.ratioVsSelfDiffFloor + 'x', 9) +
        (pr.detectable3x == null ? '—' : (pr.detectable3x ? 'YES' : 'NO')));
    }
    if (RUNS < 2) console.log('⚠ --runs=1：没有组内自差地板，检得出/检不出列没有意义（只给图，不给判定）。');
    if (crossRun) {
      console.log('跨进程地板（--vs=' + crossRun.vsTag + '，' + crossRun.summary.samples + ' 格）: maxMean=' +
        crossRun.summary.maxMeanDiff + ' meanMean=' + crossRun.summary.meanMeanDiff +
        ' maxMax=' + crossRun.summary.maxMaxDiff + ' maxChanged%=' + crossRun.summary.maxChangedPct);
      for (const pr of pairs) console.log('  ' + pr.a + ' vs ' + pr.b + ' 跨进程比值: ' + pr.ratioVsCrossRunFloor + 'x');
    }
    console.log('\n产物: ' + path.relative(ROOT, OUT).replace(/\\/g, '/') + '/  (report.json + <variant>/<angle>.png)');
    if (errors.length) console.log('页面错误: ' + JSON.stringify(errors.slice(0, 5)));

    const ratioList = pairs.map(pr => pr.ratioVsSelfDiffFloor).filter(v => v != null);
    const worst = ratioList.length ? Math.max(...ratioList) : null;
    const best = ratioList.length ? Math.min(...ratioList) : null;
    if (worst != null && worst < 3) {
      console.log('\n⚠ 检不出这组差异（最大 ' + worst + 'x < 3x 地板）：这对差分不能当数字门用。');
      if (STRICT) process.exitCode = 1;
    }
    if (best != null && ratioList.length > 1 && best < 3) {
      console.log('ℹ 其中有一对没超地板（' + best + 'x）——若那对本来就该无差别（如 base vs 默认值），这是正常的阴性对照。');
    }
    if (argv['keep-open']) await first.p.waitForTimeout(30000);
  } finally {
    await b.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
