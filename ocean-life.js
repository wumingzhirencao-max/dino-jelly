/* Lightweight local ocean feedback inspired by the requested behaviors; no Tidewater code/assets copied. */
(()=>{
 // —— 3.43 可测性层（**不动任何行为参数**，只把随机源收口 + 状态可快照/复位）——
 // 目的：让"贴岸躲雨 / 群聚半径"这类量从跨运行会翻号的遥测，变成可重放的硬门。
 // 1) 随机源：本模块原来散着 7 处 Math.random()，现在一律走 rnd()。没注入时 rnd() 仍调
 //    Math.random()，而且是**调用时**取 —— 所以 check-weather-fish.cjs 那种临时替换
 //    Math.random 的手法照旧生效（把 Math.random 抓进闭包常量就会把它废掉，这是坑）。
 // 2) 种子流：setRandom(数字) 起一条 mulberry32 内部流，它的状态能进快照、能精确续上；
 //    setRandom(函数) 则用外部函数（状态在调用方闭包里，快照只记 mode 不断言 state）。
 const mulberry32=seed=>{let s=seed>>>0;return{seed:s,next(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296},get state(){return s},set state(v){s=v>>>0}}};
 let rndFn=null,rndStream=null,rndCalls=0;
 function rnd(){rndCalls++;return rndFn?rndFn():rndStream?rndStream.next():Math.random()}
 water.material.opacity=.52;water.material.transmission=.42;water.material.ior=1.333;water.material.thickness=1.1;water.material.attenuationDistance=1.9;water.material.attenuationColor=new THREE.Color("#35d3c6");water.material.depthWrite=false;water.material.roughness=.09;water.material.needsUpdate=true;
 const pet=dinosaurs[2].g,previous=new THREE.Vector3(),current=new THREE.Vector3();pet.getWorldPosition(previous);
 const ringGeometry=new THREE.RingGeometry(.88,1,48),pool=[];
 for(let i=0;i<40;i++){const m=new THREE.MeshBasicMaterial({color:'#d8fff6',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(ringGeometry,m);mesh.rotation.x=-Math.PI/2;mesh.renderOrder=5;mesh.visible=false;scene.add(mesh);pool.push({mesh,life:0,max:1});}
 let index=0,lastDepth=1,lastHits=0,lastCatch=0;
 // 3.32 天气是**外部输入**：weather.js 每帧把雨量（0=多云/原样，1=大雨）喂进来，
 // 这里只改已有参数（水层/群聚间距/巡航速度/上浮时长），不新增随机、不新增行为分支。
 // 关键：rain=.5 时 F()/NF() 一律返回 1，所以多云档与原版逐字一致。
 let rain01=.5,rainTick=0,thunderCount=0;
 const NR=.5;                                     // 中性水位＝改动前行为
 // 3.32 天气是**外部输入**，且只有一个真源：weatherLife.rain（雨量 0..1，0=多云原样，1=大雨）。
 // 这里不自己再存一份雨量，每个乘数都现算 —— 存副本就会出现"滑杆 50 却按 0 算"那种互相打架。
 // 映射：r01 = .5 + 雨量/2（.5=多云原样，1=雨最大）。滑杆 50（雨量 0）→ r01=.5 → F(x,.5)≡1＝完全原样；
 const rainAmt=()=>{const v=window.weatherLife?.rain;return Number.isFinite(+v)?Math.max(0,Math.min(1,+v)):0};
 const rainVal=()=>NR+rainAmt()/2;
 function F(r,a,b){return 1+Math.max(0,(r-NR)/NR)*a+Math.max(0,(NR-r)/NR)*b}
 function NF(v,r,a,b){return v*F(r,a,b)}
 // 注意：本模块里「雨越大」＝水位**高于**中性（rainVal>NR），所以一切"更湿"的效果都挂在 rainUp 上。
 // 挂反到 rainDown 上的表现是"下大雨鱼毫无反应"（rainDown 恒为 0，那是留给"比多云更晴"的）。
 const rainUp=()=>Math.max(0,(rainVal()-NR)/NR),rainDown=()=>Math.max(0,(NR-rainVal())/NR);
 function rippleAt(x,z,power=1){if(Math.abs(x)>13||Math.abs(z)>13||Math.hypot(x,z)<6.3)return;const p=pool[index++%pool.length];p.life=p.max=1.5;p.power=power;p.mesh.position.set(x,water.position.y+.08,z);p.mesh.visible=true;p.mesh.scale.setScalar(.25);}
 // Keep independent positions: the legacy circular motion no longer dictates the visible school.
 // 小紫的尾迹：这里原本是 32 片 RingGeometry 弧片（"海浪贴图"）——拖拽海水/小紫游动时会叠成一圈圈
 // 白色羽状纹，碎且假（用户 2026-10-14 要求取消）。整组弧片连同它的更新循环一起删掉了，
 // 只保留涟漪环池（rippleAt）：尾迹现在完全由 island.js 的 heldSeaWaves 连续波面负责，不再有贴图感。
 const bubbles=[];
 const bubbleGeo=new THREE.SphereGeometry(1,8,6);
 for(let i=0;i<40;i++){const mesh=new THREE.Mesh(bubbleGeo,new THREE.MeshPhysicalMaterial({color:'#d4fff5',transparent:true,opacity:.32,roughness:.1,metalness:.1,depthWrite:false}));mesh.visible=false;scene.add(mesh);bubbles.push({mesh,life:0});}
 let bubbleIndex=0,lastBubble=0;
 function surfaceAt(x,z){const col=Math.max(0,Math.min(segments,Math.round((x+14)/28*segments))),row=Math.max(0,Math.min(segments,Math.round((z+14)/28*segments)));return waterGeo.attributes.position.getY(row*stride+col)+water.position.y+.035;}
 const schools=swimmers.map((f,i)=>({f,p:f.g.position.clone(),v:new THREE.Vector3(),phase:i*.63,group:Math.floor(i/10),pace:.8+rnd()*.5,panic:0,mode:"cruise",
  // 3.25 从 fish-behaviour 移植过来的四样，需要每条鱼自己持有：朝向/角速度（转向惯性）、闲逛目标、起惊脉冲、吃到的鱼食数
  heading:i*.37,angular:0,turn:0,wander:i*.23,target:new THREE.Vector3(),startle:0,eaten:0,homeY:f.y}));
 let lastFood=null,foodEnergy=0;
 const fishTarget=new THREE.Vector3(),away=new THREE.Vector3(),separation=new THREE.Vector3(),steer=new THREE.Vector3();
 function constrainFish(p){p.x=THREE.MathUtils.clamp(p.x,-12.5,12.5);p.z=THREE.MathUtils.clamp(p.z,-12.5,12.5);const r=Math.hypot(p.x,p.z);if(r<6.8){if(r<.001)p.set(6.8,p.y,0);else{p.x*=6.8/r;p.z*=6.8/r;}}}
 schools.forEach(a=>constrainFish(a.p));
 // —— 3.25 从 fish-behaviour（yutang 提取库）移植的四样：闲逛目标 / 转向惯性 / 起惊脉冲 / 逐颗鱼食 ——
 // 全部按**岛自己的世界单位**写（水域 ±12.5、岛禁入 r6.8、鱼身长 .27），不引入库的像素尺度与 ESM。
 const ARRIVE=.5,STARTLE_RADIUS=2.2,FEED_RANGE=9,MOUTH_REACH=.22,MOUTH_DEPTH=.5,MOUTH_OFFSET=.385*.27;
 const fishFood=fish;                                  // island.js 点水面投喂时生成的 8 颗鱼食网格
 function pickWander(a){for(let k=0;k<24;k++){const x=(rnd()-.5)*25,z=(rnd()-.5)*25;if(Math.hypot(x,z)>7.4&&Math.abs(x)<12.1&&Math.abs(z)<12.1){a.target.set(x,0,z);a.wander=4+rnd()*8;return}}a.target.set(Math.cos(a.phase)*9,0,Math.sin(a.phase)*9);a.wander=6}
 function routeClear(x,z,tx,tz){for(let k=1;k<=8;k++){const px=x+(tx-x)*k/8,pz=z+(tz-z)*k/8;if(Math.hypot(px,pz)<6.9||Math.abs(px)>12.4||Math.abs(pz)>12.4)return false}return true}
 function wrapAngle(v){return ((v+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI}
 // 起惊脉冲：右键牵引海水（下面 update 里读 seaGrab）或外部调用时把脉冲种进附近的鱼，0.85 秒淡出
 const hand={x:0,z:0,life:0};let fishEaten=0;
 function startle(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return;hand.x=x;hand.z=z;hand.life=.85}
 let audio=null,master=null,filter=null,pan=null,enabled=false;
 const sound=document.createElement('button');sound.id='ocean-sound';sound.textContent='海洋音效：关';document.querySelector('nav').append(sound);
 function initAudio(){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=.025;master.connect(audio.destination);
  // 注意：这里**不能**写 const，否则会声明出一个新的局部 filter，外层那个永远是 null，
  // 于是"开了音效之后"每帧 update 里的 filter.frequency 都会抛 → 主循环断（3.31 埋的 bug，3.32 修）。
  filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=700;filter.connect(master);
  const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){brown=(brown+rnd()*.04-.02)*.995;data[i]=brown;}
  const src=audio.createBufferSource();src.buffer=buffer;src.loop=true;src.connect(filter);src.start();}
 sound.onclick=()=>{enabled=!enabled;if(!audio)initAudio();if(enabled)audio.resume();master.gain.setTargetAtTime(enabled?.025:0,audio.currentTime,.15);sound.textContent='海洋音效：'+(enabled?'开':'关');};
 function splash(power){if(!enabled||!audio||paused)return;const o=audio.createOscillator(),gain=audio.createGain(),p=audio.createStereoPanner();const projection=current.clone().project(camera);p.pan.value=THREE.MathUtils.clamp(projection.x,-1,1);o.type='sine';o.frequency.setValueAtTime(280,audio.currentTime);o.frequency.exponentialRampToValueAtTime(65,audio.currentTime+.22);gain.gain.setValueAtTime(.06*power,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);o.connect(gain);gain.connect(p);p.connect(master);o.start();o.stop(audio.currentTime+.31);o.onended=()=>{o.disconnect();gain.disconnect();p.disconnect();};}
 // 3.32 雷声：weather.js 在最左档（大雨）闪一下之后调过来。走**已有的** WebAudio 总线（同一只
 // 「海洋音效」开关与 master 增益），所以音频关着时完全静默、也不会自己建第二条链路。
 // 低频棕噪声 + 低通 + 慢衰减＝闷雷；power 越大越响越低。整段 try 包住：headless 下 AudioContext
 // 可能起不来，绝不能因此抛进主循环。
 function thunder(power=1){thunderCount++;if(!enabled||!audio)return 0;
  try{
   const p=Math.max(0,Math.min(1.5,+power||0)),now=audio.currentTime+.01;
   const o=audio.createOscillator(),lp=audio.createBiquadFilter(),g=audio.createGain(),pan=audio.createStereoPanner();
   const len=Math.floor(audio.sampleRate*(1.6+p*.9)),buf=audio.createBuffer(1,len,audio.sampleRate),d=buf.getChannelData(0);
   let brown=0;for(let i=0;i<len;i++){brown=(brown+rnd()*.06-.03)*.992;d[i]=brown;}
   const src=audio.createBufferSource();src.buffer=buf;
   // 先低后高、尾巴更闷：一次雷的「轰—隆—余响」
   o.type='sine';o.frequency.setValueAtTime(90-p*32,now);o.frequency.exponentialRampToValueAtTime(34,now+1.1+p*.6);
   const og=audio.createGain();og.gain.setValueAtTime(.5,now);og.gain.exponentialRampToValueAtTime(.001,now+1.2+p*.6);
   lp.type='lowpass';lp.frequency.setValueAtTime(420,now);lp.frequency.exponentialRampToValueAtTime(120,now+1.4+p*.7);
   g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.5+.5*p,now+.06);g.gain.exponentialRampToValueAtTime(.0006,now+1.6+p*.9);
   const projection=current.clone().project(camera);pan.pan.value=THREE.MathUtils.clamp(projection.x,-1,1);
   o.connect(og);og.connect(lp);src.connect(lp);lp.connect(g);g.connect(pan);pan.connect(master);
   o.start(now);o.stop(now+1.5+p*.7);src.start(now);src.stop(now+1.7+p);
   const done=()=>{o.disconnect();src.disconnect();og.disconnect();lp.disconnect();g.disconnect();pan.disconnect();};
   o.onended=done;
   return 1;
  }catch(e){return 0}
 }
 // —— 3.43 状态快照 / 精确复位 ——
 // 快照只装**可 JSON 化**的数（没有 THREE 对象、没有网格引用），所以能直接 JSON.stringify 存盘/比对。
 // 每条鱼 19 个行为字段 + 一段网格派生量：前者是"重放要比的"，后者是"写回后画面必须同步"的。
 function snapshot(){
  return {v:1,
   rnd:{mode:rndFn?'fn':rndStream?'seeded':'math',seed:rndStream?rndStream.seed:null,state:rndStream?rndStream.state:null,calls:rndCalls},
   globals:{foodEnergy,fishEaten,lastDepth,lastHits,lastCatch,lastBubble,bubbleIndex,rippleIndex:index,rain01,rainTick,thunderCount,hand:{x:hand.x,z:hand.z,life:hand.life},lastFoodTime:lastFood?lastFood.time:null},
   fish:schools.map(a=>({x:a.p.x,y:a.p.y,z:a.p.z,vx:a.v.x,vy:a.v.y,vz:a.v.z,speed:a.v.length(),
     heading:a.heading,angular:a.angular,turn:a.turn,wander:a.wander,panic:a.panic,startle:a.startle,
     eaten:a.eaten,mode:a.mode,homeY:a.homeY,tx:a.target.x,tz:a.target.z,pace:a.pace,
     mesh:{visible:a.f.g.visible,x:a.f.g.position.x,y:a.f.g.position.y,z:a.f.g.position.z,ry:a.f.g.rotation.y,rz:a.f.g.rotation.z}})),
   bubbles:bubbles.map(b=>({life:b.life,vis:b.mesh.visible,x:b.mesh.position.x,y:b.mesh.position.y,z:b.mesh.position.z,s:b.mesh.scale.x,op:b.mesh.material.opacity})),
   ripples:pool.map(p=>({life:p.life,max:p.max,power:p.power||1,vis:p.mesh.visible,x:p.mesh.position.x,y:p.mesh.position.y,z:p.mesh.position.z,s:p.mesh.scale.x,op:p.mesh.material.opacity})),
   pellets:fishFood.map(o=>({x:o.f.position.x,y:o.f.position.y,z:o.f.position.z,y0:o.y}))};
 }
 // 复位：形状不对就**什么都不动**并返回 false（不许半截改一半，否则重放基线是脏的）。
 // 随机流只有"内部种子流"能精确续上；外部函数模式（setRandom(fn)）的状态在调用方闭包里，
 // 这时 restore 不动它 —— 调用方自己再 setRandom(fn) 一遍即是同一起点。
 function restore(s){
  if(!s||!Array.isArray(s.fish)||s.fish.length!==schools.length)return false;
  for(let i=0;i<schools.length;i++){const a=schools[i],d=s.fish[i];
   a.p.set(d.x,d.y,d.z);a.v.set(d.vx||0,d.vy||0,d.vz||0);
   a.heading=d.heading;a.angular=d.angular;a.turn=d.turn;a.wander=d.wander;
   a.panic=d.panic;a.startle=d.startle;a.eaten=d.eaten;a.mode=d.mode;a.homeY=d.homeY;
   a.target.set(d.tx,0,d.tz);
   if(Number.isFinite(d.pace))a.pace=d.pace;
   const m=d.mesh;if(m){a.f.g.visible=m.visible;a.f.g.position.set(m.x,m.y,m.z);a.f.g.rotation.y=m.ry;a.f.g.rotation.z=m.rz}
  }
  const g=s.globals||{};
  if(Number.isFinite(g.foodEnergy))foodEnergy=g.foodEnergy;
  if(Number.isFinite(g.fishEaten))fishEaten=g.fishEaten;
  if(g.hand){hand.x=g.hand.x;hand.z=g.hand.z;hand.life=g.hand.life}
  if(Number.isFinite(g.lastDepth))lastDepth=g.lastDepth;
  if(Number.isFinite(g.lastHits))lastHits=g.lastHits;
  if(Number.isFinite(g.lastCatch))lastCatch=g.lastCatch;
  if(Number.isFinite(g.lastBubble))lastBubble=g.lastBubble;
  if(Number.isFinite(g.bubbleIndex))bubbleIndex=g.bubbleIndex;
  if(Number.isFinite(g.rippleIndex))index=g.rippleIndex;
  if(Number.isFinite(g.rain01))rain01=g.rain01;
  if(Number.isFinite(g.rainTick))rainTick=g.rainTick;
  if(Number.isFinite(g.thunderCount))thunderCount=g.thunderCount;
  if(g.lastFoodTime==null)lastFood=null;
  else if(typeof feedSpot!=='undefined'&&feedSpot&&feedSpot.time===g.lastFoodTime)lastFood=feedSpot;
  if(Array.isArray(s.bubbles))s.bubbles.forEach((d,i)=>{const b=bubbles[i];if(!b)return;
   b.life=d.life;b.mesh.visible=d.vis;b.mesh.position.set(d.x,d.y,d.z);b.mesh.scale.setScalar(d.s);b.mesh.material.opacity=d.op;});
  if(Array.isArray(s.ripples))s.ripples.forEach((d,i)=>{const p=pool[i];if(!p)return;
   p.life=d.life;p.max=d.max;p.power=d.power;p.mesh.visible=d.vis;p.mesh.position.set(d.x,d.y,d.z);p.mesh.scale.setScalar(d.s);p.mesh.material.opacity=d.op;});
  if(Array.isArray(s.pellets))s.pellets.forEach((d,i)=>{const o=fishFood[i];if(!o)return;
   o.f.position.set(d.x,d.y,d.z);if(Number.isFinite(d.y0))o.y=d.y0;});
  const r=s.rnd||{};
  if(r.mode==='seeded'&&rndStream&&Number.isFinite(r.state)){rndStream.state=r.state;rndFn=null}
  if(Number.isFinite(r.calls))rndCalls=r.calls;
  return true;
 }
 window.oceanLife={splash:(x,z,p)=>rippleAt(x,z,p),startle,thunder,snapshot,restore,
  // 3.43 随机源注入：数字＝内部 mulberry32 种子流（状态可进快照、可精确续上）；
  // 函数＝外部随机函数（默认仍 Math.random；注入后 rnd() 一律走它）；非法值回落默认。
  setRandom(v){rndCalls=0;
   if(typeof v==='function'){rndFn=v;rndStream=null;return 'fn'}
   if(Number.isFinite(+v)){rndStream=mulberry32(+v>>>0);rndFn=null;return 'seeded'}
   rndFn=null;rndStream=null;return 'math'},
  resetRandom(){rndFn=null;rndStream=null;rndCalls=0;return 'math'},
  get rndMode(){return rndFn?'fn':rndStream?'seeded':'math'},
  get rndCalls(){return rndCalls},
  get rndState(){return {mode:rndFn?'fn':rndStream?'seeded':'math',seed:rndStream?rndStream.seed:null,state:rndStream?rndStream.state:null,calls:rndCalls}},
  // 3.32 天气入口：setRain 只是**兼容用的兜底**（真正每帧的来源是 window.weatherLife.rain，
  // 由 weather.js 在 setValue() 里推进来）。乘数在中性水位（rainVal=.5）时全部为 1＝多云原样。
  setRain(v){rain01=Number.isFinite(+v)?Math.max(0,Math.min(1,+v)):NR;rainTick++;return rain01},
  get rain(){return rainVal()},
  get rainParams(){return {speed:F(rainVal(),.14,-.16),spacing:F(rainVal(),-.34,.06),sink:.62*rainUp()}},
  get thunderCount(){return thunderCount},
  get rainProbe(){const a=rainAmt(),v=rainVal();return {rain:a,r01:v,stored:rain01,NR,down:Math.max(0,(NR-v)/NR),up:Math.max(0,(v-NR)/NR),wet:.62*Math.max(0,(v-NR)/NR),speed:F(v,.14,-.16)}},
  get fishEaten(){return fishEaten},get schoolState(){return {foodEnergy,food:fishFood.length,startled:schools.filter(a=>a.startle>.02).length,fish:schools.filter(a=>a.f.g.visible).map(a=>({x:a.p.x,y:a.p.y,z:a.p.z,speed:a.v.length(),mode:a.mode,panic:a.panic,startle:a.startle,heading:a.heading,turn:a.turn,wander:a.wander,eaten:a.eaten,homeY:a.homeY,target:{x:a.target.x,z:a.target.z}}))}},get effects(){return {wakes:0,bubbles:bubbles.filter(b=>b.life>0).length,ripples:pool.filter(p=>p.life>0).length}},update(dt,t){
 if(audio&&master&&filter){master.gain.setTargetAtTime(enabled&&!paused?.025:0,audio.currentTime,.1);filter.frequency.setTargetAtTime(camera.position.y<water.position.y?240:850,audio.currentTime,.2);}
 if(!dt)return;
 if(seaGrab)startle(seaPull.x,seaPull.z);
 hand.life=Math.max(0,hand.life-dt);pet.getWorldPosition(current);const speed=current.distanceTo(previous)/dt;
 // 尾迹不再画弧片（见上）：小紫游动时只是不产生"贴图"，涟漪/气泡/水花仍在。
 if((lastDepth>.2&&current.y<=.2)||(lastDepth<.2&&current.y>=.2)){rippleAt(current.x,current.z,1);splash(1);}
 const activity=window.waterPet?.activity;if(activity?.toy?.hits>lastHits){rippleAt(current.x,current.z,.8);splash(.8);}lastHits=activity?.toy?.hits||0;
 if(activity?.catches>lastCatch){rippleAt(current.x,current.z,.45);splash(.4);}lastCatch=activity?.catches||0;
 if(current.y<.25&&t-lastBubble>.17){const b=bubbles[bubbleIndex++%bubbles.length];b.life=2.4;b.mesh.visible=true;b.mesh.position.copy(current);b.mesh.position.y+=.5;b.mesh.scale.setScalar(.035+rnd()*.035);lastBubble=t;}
 for(const b of bubbles){if(b.life<=0)continue;b.life-=dt;b.mesh.position.y+=dt*.62;b.mesh.position.x+=Math.sin(t*2+b.mesh.position.z)*dt*.06;if(b.mesh.position.y>=surfaceAt(b.mesh.position.x,b.mesh.position.z))b.life=0;b.mesh.visible=b.life>0;b.mesh.material.opacity=Math.min(.32,b.life*.3);}
 lastDepth=current.y;previous.copy(current);
 for(const p of pool){if(p.life<=0)continue;p.life-=dt;p.mesh.visible=p.life>0;const age=1-p.life/p.max;p.mesh.scale.setScalar(.3+age*1.3);p.mesh.position.y=surfaceAt(p.mesh.position.x,p.mesh.position.z);p.mesh.material.opacity=Math.sin(Math.PI*age)*.38*p.power;}
 // Each drop adds short-lived excitement; speeds vary smoothly, never randomly jump each frame.
 if(feedSpot&&feedSpot!==lastFood){lastFood=feedSpot;foodEnergy=Math.min(3,foodEnergy+1);}
 foodEnergy*=Math.exp(-dt*.18);
 const feedingNow=feedSpot&&t-feedSpot.time<9;
 for(let i=0;i<schools.length;i++){
 const a=schools[i],f=a.f;
 if(!f.g.visible){a.v.set(0,0,0);continue;}
 // ① 目标：逐颗鱼食（够得着 + 视线不被岛挡住）> 投喂点附近的环 > 自己的闲逛目标
 let pellet=null,pelletD=Infinity;
 for(const o of fishFood){const fp=o.f.position,d=Math.hypot(fp.x-a.p.x,fp.z-a.p.z);if(d<pelletD&&d<FEED_RANGE&&routeClear(a.p.x,a.p.z,fp.x,fp.z)){pelletD=d;pellet=o;}}
 let tx,tz;
 if(pellet){tx=pellet.f.position.x;tz=pellet.f.position.z;a.mode='feed';}
 else{
  const foodDistance=feedingNow?Math.hypot(a.p.x-feedSpot.x,a.p.z-feedSpot.z):100;
  if(feedingNow&&foodDistance<9){a.mode='feed';tx=feedSpot.x+Math.cos(a.phase+t*.7)*(.65+i%3*.22);tz=feedSpot.z+Math.sin(a.phase+t*.7)*(.65+i%3*.22);}
  else{ // 闲逛：自己的随机目标（4–12 秒换一个）再叠一点群锚，保留原来"分三群绕岛"的观感
   if(a.wander<=0||Math.hypot(a.target.x-a.p.x,a.target.z-a.p.z)<ARRIVE)pickWander(a);
   a.wander-=dt;
   const angle=t*.10+a.group*2.094,r=9.6+Math.sin(t*.13+a.group)*1.3;
   tx=a.target.x*.72+Math.cos(angle)*r*.28;tz=a.target.z*.72+Math.sin(angle)*r*.28;a.mode='cruise';
  }
 }
 away.copy(a.p).sub(current);away.y=0;const dist=away.length();
 const hunting=activity?.swimState==='hunt'||activity?.striking;
 const dangerRadius=hunting?4:2.1;
 if(dist<dangerRadius&&current.y<.5)a.panic=Math.max(a.panic,1-dist/dangerRadius+.3);
 a.panic=Math.max(0,a.panic-dt*.35);
 if(a.panic>.08){
  a.mode='flee';if(dist<.01)away.set(Math.cos(a.phase),0,Math.sin(a.phase));else away.multiplyScalar(1/dist);
  // Fan out on both sides of the predator; individual headings avoid a single fleeing clump.
  const side=Math.sin(a.phase*2.7)*.9,dx=away.x,dz=away.z;
  tx=a.p.x+(dx-dz*side)*4;tz=a.p.z+(dz+dx*side)*4;
 }
 // ② 起惊脉冲（右键牵引海水会调用 oceanLife.startle）：从脉冲点往外推，0.85 秒淡出
 steer.set(tx-a.p.x,0,tz-a.p.z);
 if(hand.life>0){const dx=a.p.x-hand.x,dz=a.p.z-hand.z,hd=Math.hypot(dx,dz);if(hd<STARTLE_RADIUS){const force=(1-hd/STARTLE_RADIUS)*Math.min(1,hand.life*3);a.startle=Math.max(a.startle,force);if(hd>.001){steer.x+=dx/hd*force*1.4;steer.z+=dz/hd*force*1.4;}}}
 a.startle=Math.max(0,a.startle-dt/.85);
 if(a.startle>.08&&a.mode!=='flee')a.mode='flee';
 // 软岸预判（库里的 soft 法线）：闲逛目标可能正对岛缘或水体边缘，提前转向，别贴着岸卡住。
 // 大雨时把预判距离拉长到 ×1.6，再往岛缘内侧收一点（"贴岸躲雨"）。中性档 bias=0、look 与原来
 // 逐字相同，所以 50 档这条完全等于原版（F/NF 之外不引入任何变化）。
 const r0=Math.hypot(a.p.x,a.p.z),look=Math.max(.6,a.v.length()*1.6)*(1+.6*rainUp()),bias=1.6*rainUp();
 if(r0>1e-3&&r0<6.8+look){const bf=(1-(r0-6.8)/look)*3;steer.x+=a.p.x/r0*bf;steer.z+=a.p.z/r0*bf;}
 if(bias>0&&r0>1e-3&&r0<6.8+look*1.4){const nb=(6.8+look*1.4-r0)/look;steer.x-=a.p.x/r0*Math.min(nb,1.4)*bias;steer.z-=a.p.z/r0*Math.min(nb,1.4)*bias;}
 if(12.5-Math.abs(a.p.x)<look){steer.x+=(a.p.x>0?-1:1)*(1-(12.5-Math.abs(a.p.x))/look)*3;}
 if(12.5-Math.abs(a.p.z)<look){steer.z+=(a.p.z>0?-1:1)*(1-(12.5-Math.abs(a.p.z))/look)*3;}
 if(steer.lengthSq()<1e-6)steer.set(Math.cos(a.heading),0,Math.sin(a.heading));
 for(let j=0;j<schools.length;j++){if(i===j||!schools[j].f.g.visible)continue;separation.copy(a.p).sub(schools[j].p);const d=separation.length(),spacing=NF(a.mode==='flee'?.9:.48,rainVal(),-.34,.06);if(d>.001&&d<spacing){steer.x+=separation.x/d*(spacing-d)*2;steer.z+=separation.z/d*(spacing-d)*2;}}
 // ③ 转向惯性：角速度连续累积，绝不单帧翻向（库里的 turnRate / turnSmoothing）
 const targetHeading=Math.atan2(steer.z,steer.x);
 const maxTurn=a.mode==='flee'?(a.panic>.4?4.5:3.6):a.mode==='feed'?5:3.2;
 const goalTurn=Math.max(-maxTurn,Math.min(maxTurn,wrapAngle(targetHeading-a.heading)*3.2));
 const previousTurn=a.angular;
 a.angular+=(goalTurn-previousTurn)*(1-Math.exp(-dt*(a.mode==='cruise'?6:8)));
 a.heading=wrapAngle(a.heading+(previousTurn+a.angular)*.5*dt);
 a.turn+=(a.angular-a.turn)*(1-Math.exp(-dt*5));
 // ④ 速度：脉冲/恐慌提速、觅食冲刺；沿"当前朝向"前进，转向惯性才真的影响轨迹
 // 逐颗觅食时上下也跟着走（鱼会浮上来吃、跟着鱼食下沉），吃完回到自己的水层
 // 雨天：大鱼群往深处压（上浮时长自然变短）、贴岸躲、扎得更紧、游得慢一点 —— 全部是已有参数的乘数，
 // 且只在 rainVal()≠.5 时偏离 1（F(x,.5)=1）；雨停即精确回到原样。
 const wetY=Math.max(-1.3,Math.min(a.homeY,a.homeY-.62*rainUp()));
 // 投喂中仍会上浮（且不会浮过"雨天水面"），其余时候回到自己那一层 —— 原先这个三元分支在**不投喂时**
 // 也走 .05，等于把 34 条鱼常年顶在水面，鱼层完全失效（3.32 修）。
 const goalY=pellet?Math.max(-1.05,Math.min(.55,pellet.f.position.y))
   :(feedingNow&&a.mode==='feed'?Math.min(.05,wetY):wetY);
 a.p.y+=(goalY-a.p.y)*(1-Math.exp(-dt*1.6));
 const pulse=1+Math.sin(t*.9+a.phase)*.16+Math.sin(t*.37+a.phase*2)*.1;
 const rush=Math.max(a.panic,a.startle*1.2);
 const speed=a.pace*pulse*(a.mode==='flee'?2.4+Math.min(1,rush):a.mode==='feed'?1.5+foodEnergy*.45:1.1)*F(rainVal(),.14,-.16);
 fishTarget.set(Math.cos(a.heading),0,Math.sin(a.heading)).multiplyScalar(speed);
 a.v.lerp(fishTarget,1-Math.exp(-dt*(a.mode==='flee'?5:a.mode==='feed'?4:2.5)));a.p.addScaledVector(a.v,dt);constrainFish(a.p);
 f.g.position.copy(a.p);f.g.rotation.y=-a.heading;f.g.rotation.z=Math.sin(t*(8+a.v.length()*3)+a.phase)*.04;
 // ⑤ 嘴碰到才算吃掉这颗鱼食（嘴在身长前 38.5%，和库里的 mouthPoint 一致）
 if(pellet){const mx=a.p.x+Math.cos(a.heading)*MOUTH_OFFSET,mz=a.p.z+Math.sin(a.heading)*MOUTH_OFFSET,fp=pellet.f.position;
  if(Math.hypot(fp.x-mx,fp.z-mz)<MOUTH_REACH&&Math.abs(fp.y-a.p.y)<MOUTH_DEPTH){const k=fishFood.indexOf(pellet);if(k>=0){fishFood.splice(k,1);scene.remove(pellet.f);pellet.f.geometry.dispose();pellet.f.material.dispose();a.eaten++;fishEaten++;rippleAt(a.p.x,a.p.z,.35);}}}
 }

 }};
})();
