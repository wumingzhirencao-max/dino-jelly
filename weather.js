/* Weather (2026-10-13): one slider, the middle keeps the original look, left = heavier rain,
   right = sunnier. Loaded last on purpose: it only retunes what the other modules already built
   (lights / sky dome / clouds) and adds exactly one draw call for the rain streaks.

   天气滑杆：50 = 原样；往左（0 方向）雨越来越大，往右（100 方向）越来越晴。
   光照基准取 art-direction 的 ART 预设（幂等重算，不叠加），所以昼夜按钮、配色按钮都不受影响。 */
(()=>{
 const MAX=900;                                  // 雨丝段数上限（整个雨只占 1 次 draw call）
 const pos=new Float32Array(MAX*6),xs=new Float32Array(MAX),ys=new Float32Array(MAX),zs=new Float32Array(MAX),
       sp=new Float32Array(MAX),ln=new Float32Array(MAX);
 let rnd=20261013;const rand=()=>((rnd=(Math.imul(rnd,1664525)+1013904223)>>>0)/4294967296);
 function writeDrop(i,tilt){const k=i*6;pos[k]=xs[i];pos[k+1]=ys[i];pos[k+2]=zs[i];
   pos[k+3]=xs[i]+tilt;pos[k+4]=ys[i]-ln[i];pos[k+5]=zs[i]+tilt*.35}
 for(let i=0;i<MAX;i++){xs[i]=(rand()-.5)*28;zs[i]=(rand()-.5)*28;ys[i]=1.2+rand()*12;
   sp[i]=16+rand()*9;ln[i]=.26+rand()*.36;writeDrop(i,0)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setDrawRange(0,0);
 const mat=new THREE.LineBasicMaterial({color:'#d6ecff',transparent:true,opacity:0,depthWrite:false});
 const rain=new THREE.LineSegments(geo,mat);rain.frustumCulled=false;rain.renderOrder=6;rain.visible=false;scene.add(rain);

 let value=50,sun01=0,rippleAcc=0,wind=0;
 // 雨**不存**在自己的变量里：滑杆位置是唯一真源，rain01 每次从 value 现算（纯函数，无状态可错）。
 // 之前留了个 rain01 副本，update()/setValue() 两处都能写它，出现"滑杆 50 却按 0 算"的互相打架。
 const rain01=()=>Math.max(0,(50-value)/50);
 // 鱼群入口（ocean-life）收的是**雨量本身**（0..1，0=多云原样），它自己再映射成"雨越大越深/越慢"。
 // 对外只此一个真源：ocean-life 每帧从 window.weatherLife.rain 读，不再各存一份副本。
 Object.defineProperty(window,'weatherLife',{configurable:true,writable:true,value:{get rain(){return rain01()}}});
 let flash=0,nextBolt=0,strikes=0;                // 3.32 闪电（只在最左档＝大雨里出现）
 const BOLT_RAIN=.75,flush=[[0,1],[.075,.62],[.19,.44]];
 const slider=()=>document.querySelector('#weather'),noteEl=()=>document.querySelector('#weather-note');
 const GREY=new THREE.Color('#9fb0bb'),BRIGHT=new THREE.Color('#fff4d6'),GREY_N=new THREE.Color('#4d5c6b');
 function label(){const el=noteEl();if(!el)return;el.textContent=(value<15?'大雨':value<35?'小雨':value<=65?'多云':value<=85?'晴':'大晴')+(flash>.35?' ⚡':'')}
 // 光照基准：art-direction 里 applyArtLighting() 用的那套预设。ART 在它自己的 IIFE 内，运行时拿不到
 // （同理 bounce 灯也是 IIFE 局部），所以这里只能**手抄一份**。
 // 3.44 起这份手抄不再"无人看管"：check-weather.cjs 的 artBaselineWorks / skyBaselineWorks 会去
 // 解析 art-direction.js:3 的 `const ART={…}` 与 sky.js:9/99 的 DAY/NIGHT/云色字面量，跟这里**50 档
 // 运行实测值**逐项比对（数值 |Δ|≤1e-6，颜色按 hex）。改 art-direction 却忘了改这里 → 门直接报红。
 // 抄写的对应关系：sun←ART.day/night.sun、fill←…fill、exposure←…exposure。
 const BASE={day:{sun:3.15,fill:.58,exposure:.98},night:{sun:.6,fill:.27,exposure:.78}};
 // 3.32 闪电：先算出**基准**（day/night 预设 × 天气），存在 state 里；闪电只在这份基准上加临时偏移。
 // flash 归零 → 偏移恒为 0 → 逐位回到基准，所以 50 档、昼夜按钮、配色按钮与既有检查全不受影响。
 // 颜色基准**只在初始化时快照一次**（initColors）：如果每帧都 copy(hemi.color)，同一帧里
 // 上一帧被闪电染白的 hemi.color 会被当成基准吃进来，形成跨帧颜色漂移（和 sun.intensity 是同一类坑）。
 const state={sunBase:new THREE.Color(),hemiSky:new THREE.Color(),hemiGround:new THREE.Color()};
 const FLASH_SUN=new THREE.Color('#eaf3ff'),FLASH_SKY=new THREE.Color('#ffffff'),FLASH_GROUND=new THREE.Color('#cdd9e4'),
       FLASH_TOP=new THREE.Color('#f4f8ff'),FLASH_BOTTOM=new THREE.Color('#e3ecf4'),FLASH_CLOUD=new THREE.Color('#ffffff');
 function initColors(){
   state.hemiSky.copy(hemi.color);state.hemiGround.copy(hemi.groundColor);
 }
 function applyLights(){
   const pal=night?BASE.night:BASE.day;          // 基准＝美术预设；每帧重算，绝不叠加
   hemi.intensity=pal.fill*(1-.45*rain01()+.18*sun01);
   sun.intensity=pal.sun*(1-.55*rain01()+.25*sun01);
   renderer.toneMappingExposure=pal.exposure*(1-.13*rain01()+.06*sun01);
   state.sunBase.set(night?'#86baff':'#ffe1a3').lerp(night?new THREE.Color('#d8e6ff'):BRIGHT,sun01*.85);
   sun.color.copy(state.sunBase);
   if(flash>0){                                  // 闪电：越亮越偏冷白，但绝不改基准本身
     const f=flash;
     hemi.intensity+=f*1.5;sun.intensity+=f*2.8;renderer.toneMappingExposure+=f*.08;
     hemi.color.copy(state.hemiSky).lerp(FLASH_SKY,.75*f);hemi.groundColor.copy(state.hemiGround).lerp(FLASH_GROUND,.6*f);
     sun.color.copy(state.sunBase).lerp(FLASH_SUN,.85*f);
   }else if(hemi.color.getHex()!==state.hemiSky.getHex()){   // 闪完还原（逐位回到快照）
     hemi.color.copy(state.hemiSky);hemi.groundColor.copy(state.hemiGround);
   }
 }
 function applySky(){
   if(!window.skyLife||!skyLife.skyColors)return;
   skyLife.paintSky();                            // 先回到昼夜基色，再按天气染
   const {top,bottom}=skyLife.skyColors,clouds=skyLife.cloudMaterial;
   if(rain01()>.001){const k=rain01(),day=night?GREY_N:GREY;
     top.lerp(day,k);bottom.lerp(night?new THREE.Color('#2b3a48'):new THREE.Color('#cfd8dd'),k);
     clouds.color.set(night?'#9fb3c9':'#ffffff').lerp(night?GREY_N:day,k*.92)}
   else if(sun01>.001){const k=sun01;
     top.lerp(new THREE.Color(night?'#0a1424':'#4fb0f2'),k*.55);
     bottom.lerp(new THREE.Color(night?'#1b3047':'#fdfaf0'),k*.7);
     clouds.color.set(night?'#9fb3c9':'#ffffff').lerp(new THREE.Color('#ffffff'),k*.6)}
   scene.background.copy(bottom);scene.fog.color.copy(bottom);
   if(flash>0){                                   // 闪电也照亮天穹（同一份瞬态，闪完自动还原）
     const f=Math.min(1,flash);top.lerp(FLASH_TOP,.85*f);bottom.lerp(FLASH_BOTTOM,.8*f);
     clouds.color.lerp(FLASH_CLOUD,.9*f);scene.background.copy(bottom);scene.fog.color.copy(bottom);
   }
   label();
 }
 function applyRain(){
   const n=Math.round(MAX*rain01());
   geo.setDrawRange(0,n*2);rain.visible=rain01()>.01;
   mat.opacity=rain01()>.01?(.16+.44*rain01()):0;
   mat.color.set(night?'#9fc4e8':'#d6ecff');
 }
 // 闪电：一次「闪」= 3 个错峰的指数拖尾，合起来是一条带余辉的亮脉冲（只在最左档＝大雨里发生）
 const pulses=[];                                  // {at:绝对秒, k:强度系数, life:拖尾时长}
 function strike(power=1){
   const p=Math.max(.2,Math.min(1.4,Number.isFinite(+power)?+power:1)),now=performance.now()/1000;
   for(const [delay,k] of flush)pulses.push({at:now+delay*p,k:k*p,life:.34});
   if(pulses.length>12)pulses.splice(0,pulses.length-12);
   strikes++;window.oceanLife?.thunder?.(p*.9);
   applyLights();applySky();
   return +flash.toFixed(3);
 }
 function flashStep(){
   const now=performance.now()/1000;let f=0;
   for(let i=pulses.length-1;i>=0;i--){const q=pulses[i];if(now>=q.at){const age=now-q.at;if(age>q.life){pulses.splice(i,1);continue}f+=q.k*Math.exp(-age*11)}}
   flash=f>1?1:f;
 }
 function boltStep(){
   if(!(rain01()>=BOLT_RAIN))return;                 // 只有大雨档才打雷
   if(nextBolt<=0){nextBolt=7+rand()*9;return}     // 大雨里平均 7–16 秒一次，别太密
   nextBolt-=.016;                                 // update 收到的是模拟时间，闪电按真实时间走
   if(nextBolt<=0){nextBolt=0;strike(.65+rand()*.6)}
 }
 function apply(){applyLights();applySky();applyRain();label()}
 function setValue(v){
   value=Math.max(0,Math.min(100,Number.isFinite(+v)?+v:50));
   sun01=Math.max(0,(value-50)/50);                // 右半档＝越晴（雨量 rain01() 由 value 现算）
   // 传给鱼群的是"归一化水位"（.5=多云原样，→1 雨越大），不是雨量本身。
   window.oceanLife?.setRain?.(rain01());
   const s=slider();if(s&&+s.value!==value)s.value=String(value);
   apply();return value;
 }
 const s=slider();
 if(s){s.addEventListener('input',()=>setValue(s.value));s.addEventListener('change',()=>setValue(s.value))}
 apply();
 initColors();                                      // 颜色基准快照一次（在 art-direction/sky.js 都跑完之后）
 // #day 已经被 sky.js / art-direction 各包一层；这里再包一层是为了切换昼夜后重新按天气上色。
 // 昼夜切换会真的改 hemi 颜色，所以切完要**重新快照**，否则闪电还原会把颜色拉回旧昼夜。
 const dayBtn=document.querySelector('#day'),dayBase=dayBtn?dayBtn.onclick:null;
 if(dayBtn)dayBtn.onclick=()=>{if(dayBase)dayBase();initColors();apply()};
 setValue(value);                                   // 开局把雨量同步给鱼群那边（多云＝雨量 0＝原样）

 function update(dt,t){
   boltStep();flashStep();                         // 闪电按绝对时间走，暂停(dt=0)也不会卡在半亮
   // 雨量不在这里回读、也不缓存：滑杆位置（value）是唯一真源，rain01() 现算。
   if(!(dt>0))return;
   wind=-1.5*rain01()*Math.sin(t*.23);
   if(rain01()>.01){
     const tilt=wind*.07,fall=1+.35*rain01();
     for(let i=0;i<MAX;i++){
       ys[i]-=sp[i]*dt*fall;xs[i]+=wind*dt*.6;
       if(ys[i]<1.2){ys[i]+=12+rand()*2;xs[i]=(rand()-.5)*28;zs[i]=(rand()-.5)*28}
       writeDrop(i,tilt);
     }
     geo.attributes.position.needsUpdate=true;
   }
   if(rain01()>.02){                                 // 雨点打在水面上：复用 ocean-life 的涟漪环池
     rippleAcc+=dt*(4+22*rain01());
     while(rippleAcc>=1){rippleAcc-=1;
       let x=0,z=0,tries=0;
       do{x=(rand()-.5)*25;z=(rand()-.5)*25;tries++}while(Math.hypot(x,z)<6.9&&tries<12);
       window.oceanLife?.splash?.(x,z,.3+.6*rain01());
     }
   }
   applyLights();                                  // 每帧重算（幂等）——别的模块动过灯也会被拉回基准
 }
 window.weatherLife={
   set:setValue,update,apply,strike,
   get value(){return value},get rain(){return rain01()},get sun(){return sun01},
   get drops(){return Math.round(MAX*rain01())},get rainVisible(){return rain.visible},get rainOpacity(){return +mat.opacity.toFixed(3)},
   get label(){return noteEl()?noteEl().textContent:''},
   // 3.32 闪电的自检口：flash 是**瞬态偏移量**，必须能精确回到 0（回 0 时灯光＝基准，逐位相等）
   get flash(){return +flash.toFixed(4)},get striking(){return flash>.02},get strikes(){return strikes},get boltArmed(){return nextBolt>0},
   get flashDelta(){const f=flash;return {hemi:+(f*1.5).toFixed(4),sun:+(f*2.8).toFixed(4),exposure:+(f*.08).toFixed(4)}},
   lights(){return {hemi:+hemi.intensity.toFixed(3),sun:+sun.intensity.toFixed(3),exposure:+renderer.toneMappingExposure.toFixed(3)}},
   colors(){return {skyTop:'#'+skyLife.skyColors.top.getHexString(),skyBottom:'#'+skyLife.skyColors.bottom.getHexString(),
     cloud:'#'+skyLife.cloudMaterial.color.getHexString(),sun:'#'+sun.color.getHexString()}},
   // 3.44：把手抄基准以只读形式交出去，检查脚本据此分列比对「源码解析值 / 镜像声明值 / 运行时实测值」
   base(){return {day:{...BASE.day},night:{...BASE.night}}},
   // 强档灯光基准（不含闪电）——检查脚本用它证明「闪完逐位回到基准」
   baseLights(){return {hemi:+(hemi.intensity-flash*1.5).toFixed(3),sun:+(sun.intensity-flash*2.8).toFixed(3),
     exposure:+(renderer.toneMappingExposure-flash*.08).toFixed(3)}},
 };
})();
