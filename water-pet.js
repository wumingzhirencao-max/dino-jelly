/* One local, persistent companion. No network/LLM dependency. */
(()=>{
 const key='dino-jelly-purple-pet-v1',d=dinosaurs[2],clamp=v=>Math.max(0,Math.min(100,v));
 let state={schema_version:1,trust:12,curiosity:45,hunger:35,joy:60,meals:0,hunts:0};
 try{const old=JSON.parse(localStorage.getItem(key));if(old?.schema_version===1)for(const k of ['trust','curiosity','hunger','joy','meals','hunts'])if(Number.isFinite(old[k]))state[k]=clamp(old[k]);}catch{}
 // 成长阶段：成长点＝你亲手喂到的鱼（meals）＋它自己捕到的鱼（hunts），跨过门槛就换体型/配色/背鳍。
 const STAGES=[
  {name:'幼生期',points:0,scale:.80,color:'#a68ad0',emissive:0,fin:0,crest:0,fluke:false,glow:false},
  {name:'幼体期',points:3,scale:.92,color:'#a875d6',emissive:0,fin:.09,crest:1,fluke:false,glow:false},
  {name:'亚成体',points:8,scale:1.04,color:'#9a63dd',emissive:.05,fin:.17,crest:2,fluke:true,glow:false},
  {name:'成体',points:16,scale:1.16,color:'#8b4ee0',emissive:.14,fin:.26,crest:4,fluke:true,glow:true}
 ];
 // 能力由成长点推导，不增加存档字段；幼生也保留全水域活动和追球能力。
 const ABILITIES=[
  {roam:1.05,chase:2.2,hunt:2.5,strike:4.6,depth:-.58,diveSeconds:10,descent:.65,bounce:2.5,hitInterval:2.6},
  {roam:1.2,chase:2.5,hunt:2.8,strike:5.2,depth:-.66,diveSeconds:14,descent:.78,bounce:2.9,hitInterval:2.3},
  {roam:1.4,chase:2.9,hunt:3.2,strike:5.6,depth:-.73,diveSeconds:18,descent:.9,bounce:3.3,hitInterval:2.0},
  {roam:1.6,chase:3.3,hunt:3.6,strike:6,depth:-.78,diveSeconds:22,descent:1.0,bounce:3.7,hitInterval:1.8}
 ];
 function abilities(){const i=stageOf(growthPoints()),extra=(STAGES[i].scale-.8)*.55;return {...ABILITIES[i],shore:6.8+extra,bound:12.4-extra,reach:1.7+extra};}
 function growthPoints(){return state.meals+state.hunts}
 function stageOf(points){let i=0;while(i+1<STAGES.length&&points>=STAGES[i+1].points)i++;return i}
 d.g.children[0].material.color.set('#a875d6');
 let clock=0,lastCare=-30,lastPlay=-30,lastEat=-30,saveTime=0,goal=null,mood='好奇地巡游',reaction=0;
 // Art meshes include a world-shaped organic neck; pivot both neck and head together.
 const neck=new THREE.Group();neck.position.set(.68,1,0);d.g.add(neck);
 const eyes=[];
 for(const part of [...d.g.children]){
  if(part===neck||!part.isMesh)continue;
  part.geometry.computeBoundingBox();const box=part.geometry.boundingBox;
  if(part.position.y>1.5 || (part.position.lengthSq()<.001&&box.max.y>2)){
   d.g.updateMatrixWorld(true);neck.attach(part);
   if(part.material===eye)eyes.push({mesh:part,scale:part.scale.clone()});
  }
 }
 const fins=d.legs.map(mesh=>({mesh,rotation:mesh.rotation.clone(),base:mesh.scale.clone()}));
 let action=null;
 function respond(kind,duration){action={kind,duration,elapsed:0};}
 function animateResponse(dt,t){
  neck.rotation.z=0;d.g.rotation.x=0;
  for(const e of eyes)e.mesh.scale.copy(e.scale);
  for(const f of fins){f.mesh.rotation.copy(f.rotation);f.mesh.rotation.x+=Math.sin(t*2+f.mesh.position.x)*.08;}
  if(!action)return;
  action.elapsed+=dt;const u=Math.min(1,action.elapsed/action.duration),ease=Math.sin(Math.PI*u);
  if(action.kind==='care'){
   neck.rotation.z=-.26*ease*(.7+.3*Math.sin(u*Math.PI*4));
   d.g.rotation.z=-.06*ease;
   for(const e of eyes)e.mesh.scale.y=e.scale.y*(1-.85*ease);
   for(const f of fins)f.mesh.rotation.x+=Math.sign(f.mesh.position.z)*.20*ease;
  }else if(action.kind==='play'){
   const beat=Math.sin(u*Math.PI*6);
   d.g.position.y+=Math.pow(Math.sin(u*Math.PI*3),2)*.48*ease;
   d.g.rotation.x=beat*.15*ease;d.g.rotation.z=beat*.12*ease;
   neck.rotation.z=.20*ease+beat*.10*ease;
   for(const f of fins)f.mesh.rotation.x+=Math.sign(f.mesh.position.z)*Math.sin(u*Math.PI*10)*.48*ease;
  }else{
   // 捕食咬中：头猛地上抬再合上，四只鳍快速划动。
   const snap=Math.sin(u*Math.PI),chomp=Math.sin(u*Math.PI*7);
   neck.rotation.z=-.95*snap*(.6+.4*Math.abs(chomp));
   d.g.rotation.x=.10*snap;d.g.rotation.z=chomp*.06;
   for(const e of eyes)e.mesh.scale.y=e.scale.y*(1-.5*snap);
   for(const f of fins)f.mesh.rotation.x+=Math.sign(f.mesh.position.z)*Math.sin(u*Math.PI*8)*.38*snap;
  }
  if(u===1)action=null;
 }
 const position=new THREE.Vector3(10,.95,2);
 let swimState='surface',swimUntil=9,prey=null,catchCount=0,strike=null;
 const hiddenFish=new Map();
 let wander=new THREE.Vector3(11,.95,5),wanderUntil=0;
 const panel=document.createElement('aside');panel.id='pet-panel';panel.innerHTML='<b>紫水龙 · 小紫</b><small>性格成长测试 · 本机存档</small><p id="pet-status"></p><small id="pet-note"></small><small>用「投喂小鱼」在它附近投食</small>';document.body.append(panel);
 const style=document.createElement('style');style.textContent='#pet-panel{position:fixed;left:24px;top:39%;width:218px;padding:14px;background:#faf7eef2;border:1px solid #c9bad3;border-radius:12px;color:#473653;z-index:12;font:13px/1.6 system-ui}#pet-panel small{display:block;font-size:11px;letter-spacing:0;color:#726478}#pet-note{color:#8a6ea6;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pet-panel button{font:12px system-ui;padding:7px;margin:2px;color:#593973;background:#fffafc;border:1px solid #ccb7d9;border-radius:6px}#pet-panel p{margin:8px 0}@media(max-width:700px){#pet-panel{top:auto;bottom:138px;left:8px;width:190px;padding:8px}}';document.head.append(style);
 function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
 function paint(){const g=growthInfo(),next=g.next?`${g.points}/${g.next}`:'已长成';panel.querySelector('#pet-status').textContent=`${g.name} · 成长 ${next}\n信任 ${Math.round(state.trust)} · 好奇 ${Math.round(state.curiosity)} · 饥饿 ${Math.round(state.hunger)}`;panel.title=`心情：${mood}`;}
 // Latest cross-species interaction, filled in by pet-life.js.
 function setNote(text){const el=panel.querySelector('#pet-note');if(el)el.textContent=text}
 // ---------- 成长外观 ----------
 // 背鳍 / 尾鳍 / 侧腹发光点只建一次，按阶段开关可见性——没长出来的网格不产生绘制调用。
 const skin=d.g.children[0].material,crestMaterial=new THREE.MeshStandardMaterial({color:'#ddc4ff',emissive:'#6b3fb0',emissiveIntensity:.45,roughness:.5,flatShading:true});
 // 成长部件的锚点可被模型覆盖（3.30 换粉龙后：背鳍贴它的背、尾鳍贴它的尾尖；缺省值＝原程序小紫的位置）
 const GA=Object.assign({crestX0:-.42,crestDx:.29,crestY:1.36,flukeX:-2.58,flukeY:1.32,flukeZ:.11,glowX:.5,glowY:1.15,glowZ:.55},d.growthAnchors||{});
 if(d.growthAnchors&&d.growthAnchors.fluke){GA.flukeX=d.growthAnchors.fluke.x;GA.flukeY=d.growthAnchors.fluke.y;GA.flukeZ=d.growthAnchors.fluke.z}
 const crest=new THREE.Group();d.g.add(crest);
 for(let k=0;k<4;k++){const fin=mesh(new THREE.ConeGeometry(.075+k*.006,.42-Math.abs(k-1.5)*.05,4),crestMaterial,crest,GA.crestX0+k*GA.crestDx,GA.crestY,0);fin.scale.set(.6,1,1);fin.userData.crestAt=k+1;fin.userData.dino=2;pickables.push(fin)}
 const flukes=[];
 const flukeMaterial=new THREE.MeshStandardMaterial({color:'#bb8ef2',emissive:'#6b3fb0',emissiveIntensity:.35,roughness:.5,flatShading:true});
 for(const s of [-1,1]){const fluke=mesh(new THREE.ConeGeometry(.075,.36,4),flukeMaterial,d.g,GA.flukeX,GA.flukeY,s*GA.flukeZ);fluke.rotation.z=Math.PI/2;fluke.rotation.y=s*.45;fluke.scale.set(1,1,.55);fluke.userData.dino=2;pickables.push(fluke);flukes.push(fluke)}
 const glowMaterial=new THREE.MeshStandardMaterial({color:'#f3e0ff',emissive:'#b98cff',emissiveIntensity:1.05,roughness:.4});
 const glowSpots=[-1,1].map(s=>{const dot=mesh(new THREE.SphereGeometry(.065,10,8),glowMaterial,d.g,GA.glowX*s,GA.glowY,GA.glowZ*s);dot.castShadow=false;dot.userData.dino=2;pickables.push(dot);return dot});
 let lastStage=-1;
 function growthInfo(){const points=growthPoints(),stage=stageOf(points);return {points,meals:state.meals,hunts:state.hunts,stage,name:STAGES[stage].name,next:STAGES[stage+1]?STAGES[stage+1].points:null,scale:+d.g.scale.x.toFixed(2),color:'#'+skin.color.getHexString(),emissive:+skin.emissiveIntensity.toFixed(2),crest:crest.children.filter(c=>c.visible).length,flukes:flukes.filter(f=>f.visible).length,glow:glowSpots.filter(s=>s.visible).length,finScale:+fins[0].mesh.scale.x.toFixed(3)}}
 function applyGrowth(silent){
  const stage=stageOf(growthPoints()),def=STAGES[stage];
  d.g.scale.setScalar(def.scale);
  skin.color.set(def.color);skin.emissive.set('#5b2c9c');skin.emissiveIntensity=def.emissive;
  crest.children.forEach(f=>f.visible=f.userData.crestAt<=def.crest);
  flukes.forEach(f=>f.visible=def.fluke);glowSpots.forEach(s=>s.visible=def.glow);
  const k=1+def.fin;for(const f of fins)f.mesh.scale.copy(f.base).multiplyScalar(k);
  if(!silent&&lastStage>=0&&stage!==lastStage){toast('小紫长大了：'+def.name);hearts();reaction=3}
  lastStage=stage;paint();
 }
 applyGrowth(true);
 function care(){if(paused)return;hearts();if(!action||action.kind==='care')respond('care',3.2);reaction=3;
 // Visual feedback is per click; relationship gains retain a cooldown.
 if(clock-lastCare>=12){lastCare=clock;state.trust=clamp(state.trust+2);state.joy=clamp(state.joy+5);save();}paint();}
 // Reusable heart sprites and one bounded floating toy.
 const heartCanvas=document.createElement('canvas');heartCanvas.width=heartCanvas.height=64;
 const ctx=heartCanvas.getContext('2d');ctx.fillStyle='#ff79ac';ctx.font='56px sans-serif';ctx.textAlign='center';ctx.fillText('♥',32,53);
 const heartTexture=new THREE.CanvasTexture(heartCanvas),heartPool=[];
 function hearts(){d.g.updateMatrixWorld(true);const head=d.g.localToWorld(new THREE.Vector3(1.6,3.5,0));for(let i=0;i<3;i++){
 let h=heartPool.find(item=>item.life<=0);
 if(!h){const mesh=new THREE.Sprite(new THREE.SpriteMaterial({map:heartTexture,transparent:true,depthWrite:false}));scene.add(mesh);h={mesh,life:0};heartPool.push(h);}
 h.mesh.position.copy(head);h.mesh.position.y+=i*.33;h.life=2.2;h.mesh.material.opacity=1;h.mesh.scale.setScalar(.32);h.mesh.visible=true;
 }}
 let toy=null,toyIndex=0;
 function safeSea(v){const a=abilities();v.x=THREE.MathUtils.clamp(v.x,-a.bound,a.bound);v.z=THREE.MathUtils.clamp(v.z,-a.bound,a.bound);const r=Math.hypot(v.x,v.z);if(r<a.shore){if(r<.001){v.x=a.shore;v.z=0;}else{v.x*=a.shore/r;v.z*=a.shore/r;}}return v;}
 function play(point){if(paused)return toast('先恢复游戏再陪小紫玩');if(action||toy)return;if(clock-lastPlay<18)return toast('小紫想歇一会儿');lastPlay=clock;goal=null;
 const kind=toyIndex++%3,geo=kind===2?new THREE.TorusGeometry(.34,.13,12,28):new THREE.SphereGeometry(.42,24,16);
 const material=new THREE.MeshStandardMaterial({color:['#ffad56','#72d9ed','#ee91c7'][kind],roughness:.3});
 const mesh=new THREE.Mesh(geo,material);scene.add(mesh);const spot=safeSea(point?point.clone():position.clone().add(new THREE.Vector3(2,0,2)));mesh.position.set(spot.x,6,spot.z);if(kind===2)mesh.rotation.x=Math.PI/2;
 toy={mesh,age:0,vy:0,vx:0,vz:0,hits:0,lastHit:-10,landed:false};
 }
 function updateEffects(dt,t){
 for(const h of heartPool){if(h.life<=0)continue;h.life-=dt;h.mesh.visible=h.life>0;h.mesh.position.y+=dt*.65;h.mesh.material.opacity=Math.min(1,h.life);h.mesh.scale.setScalar(.32+Math.max(0,2-h.life)*.10);}
 if(!toy)return;const ability=abilities(),q=toy;q.age+=dt;const seaY=water.position.y+.22;
 q.vy-=dt*5;q.mesh.position.y+=q.vy*dt;
 if(q.mesh.position.y<seaY){q.mesh.position.y=seaY;q.vy=q.landed?0:1.1;q.landed=true;}
 q.mesh.position.x+=q.vx*dt;q.mesh.position.z+=q.vz*dt;safeSea(q.mesh.position);q.vx*=Math.exp(-dt*1.4);q.vz*=Math.exp(-dt*1.4);q.mesh.rotation.z+=dt*.6;
 if(q.landed&&Math.hypot(position.x-q.mesh.position.x,position.z-q.mesh.position.z)<ability.reach&&clock-q.lastHit>ability.hitInterval){q.lastHit=clock;q.hits++;q.vy=ability.bounce;const a=Math.atan2(q.mesh.position.z,q.mesh.position.x)+Math.PI/2;q.vx=Math.cos(a)*2.1;q.vz=Math.sin(a)*2.1;respond('play',1.1);if(q.hits===1){state.trust=clamp(state.trust+1);state.curiosity=clamp(state.curiosity+1);save();}}
 if(q.age>30){scene.remove(q.mesh);q.mesh.geometry.dispose();q.mesh.material.dispose();toy=null;}
 }
 let mode=null,press=null;
 const cursor=document.createElement('div');cursor.style.cssText='position:fixed;pointer-events:none;z-index:99;font-size:25px;line-height:1;transform:translate(-50%,-50%);display:none';document.body.append(cursor);
 function setMode(next){mode=next;press=null;down=null;pointers.clear();releaseSea();if(next&&feeding)exitFeeding();canvas.style.cursor=next?'none':(viewLocked?'default':'grab');cursor.style.display='none';for(const kind of ['care','play']){const b=document.querySelector('#pet-'+kind);b.classList.toggle('active',mode===kind);b.setAttribute('aria-pressed',String(mode===kind));} }
 document.querySelector('#pet-care').onclick=()=>setMode(mode==='care'?null:'care');document.querySelector('#pet-play').onclick=()=>setMode(mode==='play'?null:'play');
 document.querySelector('#feed').addEventListener('pointerdown',()=>setMode(null));
 addEventListener('keydown',e=>{if(e.key==='Escape')setMode(null)});
 for(const event of ['pointerdown','pointermove','pointerup','pointercancel'])canvas.addEventListener(event,e=>{
  if(!mode)return;e.preventDefault();e.stopImmediatePropagation();
  cursor.style.display='block';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';cursor.textContent=mode==='care'?'🤚':'✦';
  if(event==='pointerdown'){if(e.button===2){setMode(null);return;}if(e.button===0){press={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,id:e.pointerId};canvas.setPointerCapture(e.pointerId);}}
  if(event==='pointermove'&&press){if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>7)press.moved=true;if(press.moved&&!viewLocked){theta-=(e.clientX-press.lastX)*.007;phi=Math.max(.08,Math.min(Math.PI/2,phi-(e.clientY-press.lastY)*.005));}press.lastX=e.clientX;press.lastY=e.clientY;}
  if(event==='pointercancel')press=null;
  if(event==='pointerup'&&press&&press.id===e.pointerId){const tap=!press.moved&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<7;press=null;if(tap){const hit=pointerRay(e).intersectObjects([...pickables,mountain,rim],false)[0];if(hit&&hit.object.userData.dino===2){if(mode==='care')care();else play();}else if(mode==='play'){const seaHit=pointerRay(e).intersectObjects([island,water],true)[0];if(seaHit?.object===water)play(seaHit.point);}}}
 },true);
 canvas.addEventListener('pointerleave',()=>cursor.style.display='none');
 const layout=document.createElement('style');layout.textContent=`#pet-panel{top:auto;bottom:10px;left:34px;width:410px;padding:7px 10px;border-radius:7px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px}#pet-panel>small{display:none}#pet-panel p{margin:0;flex:1;font-size:11px;white-space:pre-line}#pet-panel button.active{background:#8861a6;color:white}#pet-panel>div{display:flex}#hint{left:auto;right:18px;max-width:55%}.species{bottom:86px}#card{bottom:166px}@media(max-width:700px){#pet-panel{left:8px;right:8px;bottom:8px;width:auto;gap:4px 10px;padding:6px 8px}#pet-panel>b{flex:0 0 auto}#pet-panel p{flex:1 1 auto;min-width:0;white-space:pre-line;overflow:hidden;text-overflow:ellipsis}#pet-panel>div{flex:1 1 100%;justify-content:flex-end}.species{bottom:104px}#card{bottom:170px}#hint{display:none}}`;document.head.append(layout);
 for(const id of ['pet-care','pet-play'])document.getElementById(id).title='选择互动后，左键点击小紫；右键或 Esc 取消';

 window.waterPet={state,setNote,stages:STAGES,stageOf,setGrowth(meals,hunts){state.meals=clamp(meals);state.hunts=clamp(hunts||0);applyGrowth();save();return growthInfo()},get activity(){return {capabilities:abilities(),position:{x:position.x,y:position.y,z:position.z},swimState,depth:position.y,catches:catchCount,mood,striking:!!strike,action:action?{kind:action.kind,elapsed:+action.elapsed.toFixed(2)}:null,growth:growthInfo(),hearts:heartPool.filter(h=>h.life>0).length,toy:toy?{age:toy.age,hits:toy.hits,landed:toy.landed}:null}},feed(point){if(paused||position.distanceTo(new THREE.Vector3(point.x,position.y,point.z))>5)return;if(state.hunger<12){mood='已经吃饱啦';paint();return;}if(clock-lastEat<8)return;goal=new THREE.Vector3(point.x,.95,point.z);mood='游向附近的食物';},update(dt,t){if(!dt)return;const ability=abilities();clock+=dt;state.hunger=clamp(state.hunger+dt*.012);reaction=Math.max(0,reaction-dt);
 // Timed breathing/exploration cycle. Player interactions take priority.
 for(const [fish,until] of hiddenFish){if(clock>=until){fish.visible=true;hiddenFish.delete(fish);}}
 const busy=!!(toy||goal||action);
 if(busy){swimState='surface';swimUntil=clock+12;prey=null;strike=null;}
 else if(clock>=swimUntil){
  if(swimState==='surface'){swimState='dive';swimUntil=clock+4;}
  else if(swimState==='dive'){
   swimState='hunt';swimUntil=clock+ability.diveSeconds;
   prey=swimmers.filter(f=>f.g.visible).sort((a,b)=>a.g.position.distanceToSquared(position)-b.g.position.distanceToSquared(position))[0]||null;
  }else{swimState='surface';swimUntil=clock+12+Math.random()*8;prey=null;strike=null;}
 }
 const targetY=swimState==='surface'?.95:ability.depth;
 position.y+=(targetY-position.y)*(1-Math.exp(-dt*ability.descent));
 // Pick destinations across the entire navigable square, not a fixed island orbit.
 if(clock>wanderUntil||position.distanceTo(wander)<.6){
  do{wander.set((Math.random()*2-1)*ability.bound,.95,(Math.random()*2-1)*ability.bound);}while(Math.hypot(wander.x,wander.z)<ability.shore+.2);
  wanderUntil=clock+14;
 }
 const dest=(toy&&toy.landed?new THREE.Vector3(toy.mesh.position.x,.95,toy.mesh.position.z):null)||goal||(swimState==='hunt'&&prey?prey.g.position.clone():null)||wander;
 safeSea(dest);
 const delta=dest.clone().sub(position);delta.y=0;
 // When the direct segment crosses the island, steer tangentially around the shore.
 const len2=delta.lengthSq(),along=len2?THREE.MathUtils.clamp(-position.dot(delta)/len2,0,1):0;
 const closest=position.clone().addScaledVector(delta,along);
 if(Math.hypot(closest.x,closest.z)<ability.shore&&Math.hypot(position.x,position.z)<9){
  const a=Math.atan2(position.z,position.x),cross=position.x*dest.z-position.z*dest.x,turn=cross>=0?1:-1;
  delta.set(Math.cos(a+turn*.35)*(ability.shore+1.2)-position.x,0,Math.sin(a+turn*.35)*(ability.shore+1.2)-position.z);
 }
 const speed=toy?ability.chase:strike?ability.strike:swimState==='hunt'?ability.hunt:ability.roam,step=Math.min(delta.length(),dt*speed);
 if(!action&&step>0)position.addScaledVector(delta.normalize(),step);
 safeSea(position);
 const worldPose=position.clone();worldPose.y+=Math.sin(t*2)*.04;
 d.g.parent.updateMatrixWorld(true);d.g.position.copy(d.g.parent.worldToLocal(worldPose));
 if(delta.lengthSq()>.001)d.g.rotation.y=Math.atan2(-delta.z,delta.x);
 d.g.rotation.z=reaction>0?Math.sin(t*5)*.055:0;
 if(goal&&position.distanceTo(goal)<.65){goal=null;lastEat=clock;state.hunger=clamp(state.hunger-18);state.trust=clamp(state.trust+2);state.meals++;mood='吃到了，开心地靠近你';reaction=3;applyGrowth();save();}
 if(!goal&&reaction===0)mood=state.trust>=35?'放心地探索海湾':'好奇地巡游';
 if(seaGrab&&Math.hypot(seaPull.x-position.x,seaPull.z-position.z)<3&&clock-lastPlay>18){lastPlay=clock;mood=state.trust>=35?'好奇地追逐水波':'有点紧张，先观察水波';reaction=3;state.curiosity=clamp(state.curiosity+.5);}
 updateEffects(dt,t);animateResponse(dt,t);
 if(swimState!=='surface'){
  const diveBlend=THREE.MathUtils.clamp((.95-position.y)/1.5,0,1);
  neck.rotation.z=-1.0*diveBlend+Math.sin(t*2)*.05;
  fins.forEach((f,i)=>f.mesh.rotation.x=f.rotation.x+Math.sin(t*5+i%2*Math.PI)*.28);
  d.g.rotation.z=Math.sin(t*2.5)*.04;
   // 扑咬：贴到猎物两单位内就抬头冲刺；撑过 2.2 秒还没咬到就放弃（回到巡游）。
   if(strike){const wind=Math.min(1,strike.wind*1.6);neck.rotation.z=-.35-.55*wind+Math.sin(clock*14)*.20*wind;d.g.rotation.x=.12*wind;fins.forEach((f,i)=>f.mesh.rotation.x=f.rotation.x+Math.sin(clock*18+i)*.5*wind)}
 }
 if(swimState==='hunt'&&prey&&prey.g.visible){
  d.g.updateMatrixWorld(true);
  const mouth=neck.localToWorld(new THREE.Vector3(1.05,2.05,0));
   const gap=mouth.distanceTo(prey.g.position);
   // 两单位内进入扑咬：冲刺速度由 update 的 speed 提供，这里维护冲刺计时与放弃条件。
   if(gap<2.6&&gap>=1.05){strike=strike||{wind:0};strike.wind+=dt;if(strike.wind>2.2)strike=null}else if(gap>=2.6)strike=null;
  if(gap<1.05){
   prey.g.visible=false;hiddenFish.set(prey.g,clock+25);catchCount++;state.hunts++;
   state.hunger=clamp(state.hunger-6);state.joy=clamp(state.joy+2);
   swimState='surface';swimUntil=clock+16;prey=null;strike=null;
   mood='抓到一条小鱼，正得意';respond('bite',1.1);hearts();toast('小紫扑上去咬住了一条小鱼');applyGrowth();save();
  }
 }
 saveTime+=dt;if(saveTime>5){saveTime=0;save();paint();}else if(reaction>0||goal)paint();
 }};addEventListener('pagehide',save);paint();
})();
