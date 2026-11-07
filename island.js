/* A self-contained, procedurally modelled WebGL diorama. */
const scene=new THREE.Scene();scene.background=new THREE.Color('#102e3d');scene.fog=new THREE.Fog('#102e3d',48,95);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,420),renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xbbeeff,0x3c5945,2.3);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffe1a3,3.2);sun.position.set(-12,24,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20});sun.shadow.bias=-.001;scene.add(sun);
const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.86,flatShading:true});const mats={grass:mat('#639b53'),sand:mat('#deb986'),rock:mat('#535754'),bark:mat('#755441'),leaf:mat('#2e7754'),lava:new THREE.MeshStandardMaterial({color:'#ff5d19',emissive:'#ff3e00',emissiveIntensity:2})};
function mesh(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function ball(parent,m,x,y,z,sx,sy,sz){let o=mesh(new THREE.SphereGeometry(1,16,10),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o}
function rod(parent,m,a,b,r1,r2=r1){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);let o=mesh(new THREE.CylinderGeometry(r2,r1,av.distanceTo(bv),7),m,parent);o.position.copy(av.clone().add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return o}
const island=new THREE.Group();scene.add(island);
// ---- 3.46 沙盘：**一整块软边沙盘**（不规则轮廓 + 圆润边缘 + 颗粒 + 湿沙），
//      取代原来的两级圆柱台阶（sand Cylinder + grass Cylinder 叠出的一圈硬边）。
//      局部坐标；岛组统一 scale .55、position.y 1.05，所以这里按"世界 = 局部×.55+1.05"反推：
//      顶面局部 1.45（世界 1.85）、外缘最低局部 -.95（世界 .53，在水面 1.15 之下）。
// ⚠ 3.46 实测结论（别再重复踩）：这块 pad 在运行时**根本不会被渲染** ——
// `art-direction.js:279` 会把 island 上除恐龙/灯以外的子节点全部 `island.remove(child)`，
// 真正可见的沙滩是 art-direction.js:106-118 自己参数化生成的那片 `island-beach`。
// 所以"沙滩形状"要改的是**那边的 u 剖面**（3.46 就是这么落地的）；这里保留 pad 只为了
// 让 `island.children` 的索引（art-direction.js:101 的 children[0]/[1]）保持稳定。
const PAD={R0:10.75,DOME:.14,EDGE0:.78,TOP:1.47,BOT:-.95};
const padAng=a=>1+.075*Math.sin(3*a+1.15)+.045*Math.sin(5*a+2.6)+.028*Math.sin(8*a+.35)+.055*Math.cos(2*a-.4);
const padR=a=>PAD.R0*padAng(a);
const padY=t=>{const u=Math.max(0,(t-PAD.EDGE0)/(1-PAD.EDGE0)),s=u*u*(3-2*u);return PAD.TOP-PAD.DOME*t*t-(PAD.TOP-PAD.BOT)*Math.pow(s,1.15)};
const padWob=(a,t)=>(Math.sin(a*4.3+1.7)*Math.cos(t*2.2)*.055+Math.sin(a*7.1-2.3)*.03)*Math.min(1,(1-t)*3.2);
(function buildSandPad(){
  const NR=34,NS=132,pos=[],idx=[];
  for(let i=0;i<=NR;i++){
    const t=Math.sin(i/NR*Math.PI/2);                       // 靠外缘更密（台阶变圆润的关键）
    for(let j=0;j<NS;j++){
      const a=j/NS*Math.PI*2,R=padR(a);
      const bulge=1+.035*Math.sin(Math.PI*Math.max(0,(t-PAD.EDGE0)/(1-PAD.EDGE0)));  // 边缘微微鼓出
      const r=R*t*bulge;
      pos.push(Math.cos(a)*r,padY(t)+padWob(a,t),Math.sin(a)*r);
    }
  }
  for(let i=0;i<NR;i++)for(let j=0;j<NS;j++){
    const a=i*NS+j,b=i*NS+(j+1)%NS,c=(i+1)*NS+j,d=(i+1)*NS+(j+1)%NS;
    idx.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  // 绕序自检：法线平均值必须朝上（朝下的话从上方射线打不到、也点不亮 —— 我第一版就翻错了，整块沙盘等于隐形）
  (function ensureUp(){
    const n=g.attributes.normal.array;let sy=0;for(let i=1;i<n.length;i+=3)sy+=n[i];
    if(sy<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t}
      g.index.needsUpdate=true;g.computeVertexNormals();}
  })();
  const padMat=mats.sand.clone();padMat.flatShading=false;padMat.roughness=.93;padMat.metalness=0;
  padMat.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 vPad;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPad=position;');
    sh.fragmentShader='varying vec3 vPad;\nfloat pnHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat pnNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(pnHash(i),pnHash(i+vec2(1,0)),f.x),mix(pnHash(i+vec2(0,1)),pnHash(i+vec2(1,1)),f.x),f.y);}\nfloat padAng(vec2 q){float a=atan(q.y,q.x);return 1.+.075*sin(3.*a+1.15)+.045*sin(5.*a+2.6)+.028*sin(8.*a+.35)+.055*cos(2.*a-.4);}\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      // 颗粒感：两级噪声 + 稀疏深色砂粒
      float g1=pnNoise(vPad.xz*3.6),g2=pnNoise(vPad.xz*13.5),g3=pnNoise(vPad.xz*47.);
      float grain=(g1*.5+g2*.32+g3*.18)-.5;
      diffuseColor.rgb*=1.+grain*.22;
      float speck=step(.90,g3)*step(.55,pnNoise(vPad.xz*24.+7.7));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.70,.60,.50),speck*.40);
      // 湿沙：靠外缘一圈更深更暗（与水面那条 wetBand 相接）
      float R=${PAD.R0.toFixed(2)}*padAng(vPad.xz);
      float wet=smoothstep(R*.86,R*1.01,length(vPad.xz));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.74,.68,.62),wet*.85);`);
  };
  const pad=new THREE.Mesh(g,padMat);pad.castShadow=true;pad.receiveShadow=true;island.add(pad);
})();
// 散落的紫灰色石头 / 砂砾（照参考图 2：零散贴在沙面上，不是绕圈一圈）
const pebA=mat('#9c93a8'),pebB=mat('#b0a3b2'),pebC=mat('#8a8a86');
for(let i=0;i<30;i++){
  const a=Math.random()*Math.PI*2,t=.28+Math.random()*.62,r=padR(a)*t,s=.16+Math.random()*.30;
  const m=i%3===0?pebA:(i%3===1?pebB:pebC);
  const o=mesh(new THREE.IcosahedronGeometry(1,0),m,island,Math.cos(a)*r,padY(t)+s*.30,Math.sin(a)*r);o.scale.set(s,s*.62,s*(.75+Math.random()*.4));o.rotation.y=Math.random()*3;
}
// 几块大的礁石压在沙盘边缘（比砂砾更显眼，仍贴在水线以下）
for(let i=0;i<7;i++){
  const a=i/7*Math.PI*2+.6,t=.90+Math.random()*.06,r=padR(a)*t,s=.5+Math.random()*.35;
  const o=mesh(new THREE.IcosahedronGeometry(1,0),pebC,island,Math.cos(a)*r,padY(t)+s*.25,Math.sin(a)*r);o.scale.set(s,s*.8,s*.9);o.rotation.set(Math.random(),Math.random()*3,Math.random()*.4);
}
let waterGeo=new THREE.PlaneGeometry(150,150,110,110);waterGeo.rotateX(-Math.PI/2);const water=mesh(waterGeo,new THREE.MeshStandardMaterial({color:'#187f97',roughness:.32,metalness:.25,flatShading:true}),scene,0,-1,0);water.castShadow=false;let original=waterGeo.attributes.position.array.slice();
const foamMat=new THREE.MeshBasicMaterial({color:'#b6eae1',transparent:true,opacity:.35,side:THREE.DoubleSide});const foam=mesh(new THREE.RingGeometry(10.6,11.1,80),foamMat,scene,0,-.55,0);foam.rotation.x=-Math.PI/2;foam.castShadow=false;
// Mountain is open at its summit, with a luminous crater underneath.
const volcano=new THREE.Group();volcano.position.set(-2,1.45,-3);island.add(volcano);const mountain=mesh(new THREE.CylinderGeometry(1.1,3.2,4.6,11,3,true),mats.rock,volcano,0,2.2,0);mountain.userData.volcano=true;
mesh(new THREE.CylinderGeometry(.92,.92,.12,20),mats.lava,volcano,0,4.15,0);const rim=mesh(new THREE.TorusGeometry(1.06,.22,5,11),mats.rock,volcano,0,4.5,0);rim.rotation.x=Math.PI/2;rim.userData.volcano=true;
for(let i=0;i<4;i++){const a=i*1.7;rod(volcano,mats.lava,[Math.cos(a),4.4,Math.sin(a)],[Math.cos(a)*2.5,.5,Math.sin(a)*2.5],.06,.11)}
const lavaLight=new THREE.PointLight('#ff671e',15,12);lavaLight.position.set(-2,6,-3);scene.add(lavaLight);
function tree(x,z,scale=1){const t=new THREE.Group();t.position.set(x,1.45,z);t.scale.setScalar(scale);island.add(t);rod(t,mats.bark,[0,0,0],[.15,2.2,0],.18,.11);for(let j=0;j<5;j++){let a=j*1.256;ball(t,mats.leaf,Math.cos(a)*.5,2.5+Math.sin(j)*.25,Math.sin(a)*.5,.85,.7,.85)}return t}
[[5,-4],[6,-2],[7,1],[3,-7],[1,-7],[-6,-5],[-7,-2],[-7,1],[5,5],[7,4],[-5,6]].forEach(([x,z],i)=>tree(x,z,.7+(i%4)*.2));
for(let i=0;i<65;i++){let a=Math.random()*6.28,r=3+Math.random()*6,x=Math.cos(a)*r,z=Math.sin(a)*r;if(z<-1&&x<2&&x>-5)continue;let f=mesh(new THREE.ConeGeometry(.2,.55,4),mats.leaf,island,x,1.65,z);f.rotation.z=.2}
const dinosaurs=[],pickables=[],eye=mat('#121c1b'),white=mat('#f4ecc8');
function dinosaur(type,color,x,z){const g=new THREE.Group(),skin=mat(color),belly=mat('#d6d29b');g.position.set(x,1.48,z);island.add(g);const body=ball(g,skin,0,1.05,0,1.15,.65,.56);const legs=[];function leg(px,pz,height=1){const l=new THREE.Group();l.position.set(px,height,pz);g.add(l);rod(l,skin,[0,0,0],[0,-height+.18,0],.2,.17);ball(l,skin,.12,-height+.14,0,.32,.14,.21);legs.push(l)}
if(type===0){body.scale.set(1,.7,.5);leg(-.35,.35);leg(-.35,-.35);rod(g,skin,[.45,1.35,0],[.85,2.05,0],.33,.4);ball(g,skin,1.18,2.12,0,.65,.4,.36);ball(g,belly,1.28,1.87,0,.5,.1,.3);rod(g,skin,[-.8,1.2,0],[-2,.8,0],.4,.04);for(let s of [-1,1]){rod(g,skin,[.6,1.35,s*.4],[.9,1.05,s*.45],.1,.06);ball(g,eye,1.3,2.25,s*.34,.07,.07,.04)}}
if(type===1){body.scale.set(1.4,.8,.7);for(let a of [-.75,.75])for(let b of [-.42,.42])leg(a,b,1);rod(g,skin,[.8,1.2,0],[1.2,3.6,0],.43,.23);ball(g,skin,1.4,3.8,0,.5,.26,.27);rod(g,skin,[-1,1.2,0],[-2.8,.8,0],.35,.035);for(let s of [-1,1])ball(g,eye,1.5,3.87,s*.25,.06,.06,.03)}
if(type===2){
  // 小紫＝素材粉龙（2026-10-13）：「保骨架换皮」——模型的躯干 / 脖子+头 / 尾 / 四条腿分别挂到原来的代理位置上
  // （枢轴在 Blender 里已烘到关节），于是 water-pet.js 的脖子枢轴、四鳍摆动、成长四阶（体型/配色/背鳍/尾鳍/
  // 发光点）**一行都不用改**；拾取也照旧（所有分块都进 pickables）。兜底：数据文件缺失时用回程序版。
  // 模型局部→岛局部：S=3.22 + 偏移 O，让躯干中心落在 (0,1.05,0)、脖子底落在 y≈1.70（>1.5，
  // water-pet.js 就是靠这条启发式把脖子吸进它自己的 neck 枢轴）。
  const pink=window.PINK_MODEL&&window.PINK_MODEL.parts;
  if(pink&&window.__glbDecode){
    // 躯干枢轴＝模型原点，所以偏移只有"把模型原点抬到躯干中心高度"这一项：
    // 模型躯干中心在 y=0.3118（模型单位）×3.22 = 1.004，要让它是岛局部 1.05 → O.y = 0.046。
    const S=3.22,OX=0,OY=.046,OZ=0;
    const atlas=window.PINK_MODEL.images&&window.PINK_MODEL.images.basecolor;
    if(!window.__pinkAtlas&&atlas){const t=new THREE.TextureLoader().load(atlas.data);t.flipY=!!window.PINK_MODEL.source;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();window.__pinkAtlas=t}
    const pskin=new THREE.MeshStandardMaterial({map:window.__pinkAtlas||null,roughness:.78,metalness:.02});
    const place=(name,parent)=>{const part=pink[name];if(!part)return null;const o=mesh(window.__glbDecode(part,THREE),pskin,parent||g,
      OX+S*part.pivot[0],OY+S*part.pivot[1],OZ+S*part.pivot[2]);o.scale.setScalar(S);o.name='pink-'+name;return o};
    // 躯干：直接换掉 island.js 一开始建的那个 body 网格的几何与材质——它必须是 g.children[0]，
    // 因为 water-pet.js 用 `d.g.children[0].material` 当"皮肤"做阶段配色/自发光。
    body.geometry.dispose();body.geometry=window.__glbDecode(pink.body,THREE);body.material=pskin;
    body.scale.setScalar(S);body.position.set(0,window.PINK_MODEL.source?OY:1.05,0);body.name='pink-body';
    legs.push(place('legFrontL'),place('legFrontR'),place('legBackL'),place('legBackR'));  // 四鳍
    place('neckHead');place('tail');
    g.growthAnchors={crestY:1.48,fluke:{x:-1.62,y:.44,z:.07}};                        // 背鳍/尾鳍贴到粉龙自己的背与尾尖
  }else{body.scale.set(1.25,.34,.65);for(let a of [-.7,.7])for(let b of [-1,1]){const f=ball(g,skin,a,.9,b*.75,.5,.1,.62);f.rotation.y=b*.35;legs.push(f)}rod(g,skin,[.8,1,0],[1.5,2.9,0],.32,.17);ball(g,skin,1.7,3.05,0,.45,.24,.24);rod(g,skin,[-1,1,0],[-2.2,.85,0],.3,.025);for(let b of [-1,1])ball(g,eye,1.85,3.12,b*.22,.065,.06,.035)}

}if(type===3){body.scale.set(.75,.3,.25);ball(g,skin,.72,1.17,0,.3,.26,.22);rod(g,white,[.85,1.13,0],[1.5,1.03,0],.16,.005);rod(g,skin,[.5,1.3,0],[.05,1.8,0],.16,.005);g.wings=[];for(let s of [-1,1]){const wing=new THREE.Group();g.add(wing);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([.3,1,0,-.8,1,0,-.3,1,s*2.3],3));geo.computeVertexNormals();const wm=skin.clone();wm.side=THREE.DoubleSide;mesh(geo,wm,wing);g.wings.push(wing);ball(g,eye,.82,1.27,s*.2,.055,.055,.03)}}
g.traverse(o=>{if(o.isMesh){o.userData.dino=type;pickables.push(o)}});dinosaurs.push({g,legs,type,base:new THREE.Vector3(x,1.48,z),growthAnchors:g.growthAnchors||null});return g}
dinosaur(0,'#cb8651',3,2);dinosaur(1,'#7dada0',-4,2);dinosaur(2,'#af92c7',10,2);dinosaur(3,'#bd856c',0,-1);
// 火山烟：每颗烟团都有自己的速度 / 大小 / 摆动相位（3.48）
// —— 旧版 24 颗全部同速、等间距排成一条直线上升，看起来像"静止的石头链"：每颗都被邻居顶替，
//    屏幕上根本读不到运动。现在故意打散：速度差 1.6×、大小差 2×、每颗左右各摆各的、还会自转。
const smoke=[],sparks=[];for(let i=0;i<34;i++){
  const m=new THREE.MeshStandardMaterial({color:'#d2d2c8',transparent:true,opacity:.28,flatShading:true,depthWrite:false});
  const p=mesh(new THREE.IcosahedronGeometry(1,1),m,scene);p.castShadow=false;
  smoke.push({p,phase:i/34,
    speed:.85+Math.random()*.75,          // 0.85–1.6：谁快谁慢不齐步
    size:.55+Math.random()*.5,            // 大小不一，避免"一串同样大的球"
    swayA:1.15+Math.random()*1.5,swayF:.45+Math.random()*.9,swayP:Math.random()*6.283,
    leanX:(Math.random()-.5)*1.0,leanZ:.2+Math.random()*.45,
    spin:new THREE.Vector3((Math.random()-.5)*.55,(Math.random()-.5)*.7,(Math.random()-.5)*.55)})
}for(let i=0;i<35;i++){let p=mesh(new THREE.IcosahedronGeometry(.09,0),mats.lava,scene);p.visible=false;sparks.push({p,v:new THREE.Vector3(),life:0})}
let theta=.65,phi=1.03,distance=55; // orbital camera
const panOffset=new THREE.Vector3();
let target=new THREE.Vector3(0,1,0),focus=null,viewLocked=false,night=false,eruptionUntil=0,down=null,pointers=new Map(),pinch=0;
const names=['迅猛龙','腕龙','蛇颈龙','翼龙'],descriptions=['强壮的后腿支撑着森林巡游者。点击它，会向你点头打招呼。','长长的脖子够得到最高的嫩叶。它正在海风里悠闲散步。','它并非恐龙，而是海生爬行动物。四只鳍肢轻轻划过泻湖，长颈探出水面。','它是飞行爬行动物，正乘着上升气流绕岛盘旋。'];
function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.opacity=0,2400)}
function announce(id){document.querySelector('#card').innerHTML='<h2>'+names[id]+'</h2><p>'+descriptions[id]+'</p>';document.querySelectorAll('[data-id]').forEach(b=>b.classList.toggle('active',+b.dataset.id===id));dinosaurs[id].hello=performance.now();toast(names[id]+'向你打招呼！')}
function select(id){if(!viewLocked)focus=id;announce(id);if(!viewLocked)distance=23}
function erupt(){eruptionUntil=performance.now()+5500;toast('火山醒了！小岛上的恐龙都很安全。');for(const s of sparks){s.life=2+Math.random()*3;s.p.visible=true;s.p.position.copy(window.islandCrater||new THREE.Vector3(-1.1,4.3,-1.65));s.v.set((Math.random()-.5)*5,4+Math.random()*6,(Math.random()-.5)*5)}}
document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(+b.dataset.id));document.querySelector('#eruption').onclick=erupt;document.querySelector('#day').onclick=()=>{night=!night;document.querySelector('#day').textContent=night?'☾ 夜晚':'☀ 白昼';scene.background.set(night?'#182735':'#e9e6df');scene.fog.color.copy(scene.background);hemi.intensity=night?.55:2.3;sun.intensity=night?.5:3.2;sun.color.set(night?'#86baff':'#ffe1a3')};
const canvas=renderer.domElement;
let feeding=false,feedRemaining=20,feedSpot=null;
let seaGoal=null;
const seaMotion={vx:0,vz:0,speed:0,lastMove:0},wakeTrail=[];
let seaGrab=null,seaPull={x:0,z:0,dx:0,dz:0,height:0};
function pointerRay(e){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);return ray}
function releaseSea(){if(seaGrab){ripple={x:seaPull.x,z:seaPull.z,time:simTime};seaGrab=null;canvas.style.cursor=viewLocked?'default':'grab'}}

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(feeding){
    if(e.button===2){exitFeeding();return}
    if(e.button===0||e.pointerType==='touch')dropFeed(e);
    return;
  }
  if(e.pointerType==='mouse'&&![0,1,2].includes(e.button))return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  down={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,button:e.button,touch:e.pointerType==='touch',pan:e.button===1||(e.button===0&&e.shiftKey)};
  if(pointers.size>1)down.moved=true;
  pinch=0;
  if(pointers.size>1){releaseSea();return}
  if(e.button===2&&!down.pan){
    const ray=pointerRay(e),hit=ray.intersectObjects([island,water],true)[0];
    if(hit&&hit.object===water){seaGrab={id:e.pointerId,start:hit.point.clone()};seaPull={x:hit.point.x,z:hit.point.z,dx:0,dz:0,height:.8};seaGoal={...seaPull};seaMotion.vx=0;seaMotion.vz=0;seaMotion.speed=0;seaMotion.lastMove=performance.now();down.moved=true;canvas.style.cursor='grabbing'}
  }
});
canvas.addEventListener('pointermove',e=>{
  if(feeding){moveFeedBag(e.clientX,e.clientY);return}
  const old=pointers.get(e.pointerId);if(!old)return;
  if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(seaGrab&&seaGrab.id===e.pointerId){
    const point=new THREE.Vector3();pointerRay(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-water.position.y),point);
    const previousX=seaGoal.x,previousZ=seaGoal.z;
    seaGoal.x=Math.max(-13.5,Math.min(13.5,point.x));seaGoal.z=Math.max(-13.5,Math.min(13.5,point.z));
    const elapsed=Math.max(.016,(performance.now()-seaMotion.lastMove)*.001),mx=seaGoal.x-previousX,mz=seaGoal.z-previousZ;
    seaMotion.lastMove=performance.now();seaMotion.vx=seaMotion.vx*.45+mx/elapsed*.55;seaMotion.vz=seaMotion.vz*.45+mz/elapsed*.55;seaMotion.speed=Math.min(16,Math.hypot(seaMotion.vx,seaMotion.vz));
    if(Math.hypot(mx,mz)>.08&&seaMotion.speed>.3){const len=Math.hypot(seaMotion.vx,seaMotion.vz);if(!wakeTrail.length||simTime-wakeTrail[wakeTrail.length-1].time>.05){wakeTrail.push({x:seaGoal.x,z:seaGoal.z,ux:seaMotion.vx/len,uz:seaMotion.vz/len,strength:Math.min(1,seaMotion.speed/8),time:simTime});if(wakeTrail.length>10)wakeTrail.shift()}}
    seaGoal.dx=Math.max(-2,Math.min(2,(seaGoal.x-seaGrab.start.x)*.35));seaGoal.dz=Math.max(-2,Math.min(2,(seaGoal.z-seaGrab.start.z)*.35));
    seaGoal.height=Math.min(2,.8+Math.hypot(seaGoal.dx,seaGoal.dz)*.4);return;
  }
  if(viewLocked)return;
  if(e.pointerType==='touch'&&pointers.size===2){
    const a=[...pointers.values()],len=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    if(pinch)distance=Math.max(13,Math.min(80,distance*pinch/len));pinch=len;
  }else if(down&&down.pan){
    const dx=e.clientX-old.x,dy=e.clientY-old.y,scale=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/innerHeight;
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
    panOffset.addScaledVector(right,-dx*scale).addScaledVector(up,dy*scale);
  }else if(e.pointerType==='touch'||(e.buttons&1)!==0){
    theta-=(e.clientX-old.x)*.007;
    phi=Math.max(.08,Math.min(Math.PI/2,phi-(e.clientY-old.y)*.005));
  }
});
canvas.addEventListener('pointerup',e=>{
  if(feeding)return;
  pointers.delete(e.pointerId);
  if(seaGrab&&seaGrab.id===e.pointerId)releaseSea();
  if(down&&down.id===e.pointerId&&!down.moved&&!down.pan&&(down.touch||down.button===0)){
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);
    const hit=ray.intersectObjects([...pickables,mountain,rim])[0];
    // 画布上点动物**只给反馈**（卡片文案 + 打招呼），镜头一律不动；只有底部的物种名字按钮才聚焦
    if(hit){if(hit.object.userData.dino!==undefined)announce(hit.object.userData.dino);else erupt()}
    else{const seaHit=ray.intersectObject(water)[0];if(seaHit){ripple={x:seaHit.point.x,z:seaHit.point.z,time:simTime};toast('海水轻轻晃了一下')}}
  }
  down=null;pinch=0;
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;pinch=0;releaseSea()});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!viewLocked)distance=Math.max(13,Math.min(80,distance+e.deltaY*.025))},{passive:false});
document.querySelector('#viewLock').onclick=()=>{
  viewLocked=!viewLocked;
  const button=document.querySelector('#viewLock');
  button.textContent=viewLocked?'解锁视角':'锁定视角';
  button.setAttribute('aria-pressed',String(viewLocked));
  button.classList.toggle('active',viewLocked);
  canvas.style.cursor=viewLocked?'default':'grab';
  toast(viewLocked?'视角已锁定，仍可点击互动':'视角已解锁');
};

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
// Reference-inspired tabletop cutaway: sand strata, translucent sea and palms.
scene.background.set('#e9e6df');scene.fog.color.set('#e9e6df');scene.fog.near=90;scene.fog.far=160;
island.scale.setScalar(.55);island.position.y=1.05;mats.grass.color.set('#d5c696');mats.rock.color.set('#806558');mats.sand.color.set('#e9d2a2');sun.position.set(-15,30,15);sun.intensity=2.5;sun.color.set('#ffffff');hemi.color.set('#ffffff');hemi.groundColor.set('#b9b1a4');hemi.intensity=1.9;lavaLight.position.set(-1.1,4.5,-1.65);
const floor=mesh(new THREE.PlaneGeometry(250,250),mat('#e6e3db'),scene,0,-4.1,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
[['#826653',-3.35,1.5],['#c29879',-2.35,.5],['#f1d7a6',-1.85,.5],['#d2bc8e',-1.5,.2]].forEach(([c,y,h])=>mesh(new THREE.BoxGeometry(28,h,28),mat(c),scene,0,y,0));
const grainMat=mat('#ead9bc');for(let i=0;i<180;i++){let side=i%4,a=(Math.random()-.5)*27.5,y=-3.9+Math.random()*2;let x=side<2?a:(side===2?14.01:-14.01),z=side>=2?a:(side===0?14.01:-14.01);ball(scene,grainMat,x,y,z,.045+Math.random()*.07,.04+Math.random()*.05,.045)}
water.geometry.dispose();water.geometry=new THREE.PlaneGeometry(28,28,88,88);water.geometry.rotateX(-Math.PI/2);const seaOriginal=water.geometry.attributes.position.array.slice();const seaIndices=water.geometry.index.array,openSea=[];for(let i=0;i<seaIndices.length;i+=3){const ids=[seaIndices[i],seaIndices[i+1],seaIndices[i+2]];if(ids.every(j=>Math.hypot(seaOriginal[j*3],seaOriginal[j*3+2])<4.6))continue;openSea.push(...ids)}water.geometry.setIndex(openSea);waterGeo=water.geometry;original=seaOriginal;
water.position.y=1.15;
const waterSideGeo=new THREE.BufferGeometry(),boundary=[];
const segments=88,stride=segments+1;
for(let col=0;col<segments;col++)boundary.push(col);
for(let row=0;row<segments;row++)boundary.push(row*stride+segments);
for(let col=segments;col>0;col--)boundary.push(segments*stride+col);
for(let row=segments;row>0;row--)boundary.push(row*stride);
const sidePositions=new Float32Array(boundary.length*18);
waterSideGeo.setAttribute('position',new THREE.BufferAttribute(sidePositions,3));
const waterBody=mesh(waterSideGeo,new THREE.MeshPhysicalMaterial({color:'#29bcca',transparent:true,opacity:.23,roughness:.08,metalness:0,depthWrite:false,side:THREE.DoubleSide}),scene);
waterBody.castShadow=false;waterBody.renderOrder=3;
function updateWaterSides(){const p=waterGeo.attributes.position;
  for(let j=0;j<boundary.length;j++){const a=boundary[j],b=boundary[(j+1)%boundary.length];const ax=p.getX(a),az=p.getZ(a),ay=p.getY(a)+water.position.y,bx=p.getX(b),bz=p.getZ(b),by=p.getY(b)+water.position.y;
    sidePositions.set([ax,-1.4,az,ax,ay,az,bx,by,bz,bx,by,bz,bx,-1.4,bz,ax,-1.4,az],j*18);
  }waterSideGeo.attributes.position.needsUpdate=true;waterSideGeo.computeVertexNormals();
}

const waterMasks=new Float32Array(original.length/3*2);
for(let i=0;i<original.length/3;i++){const x=original[i*3],z=original[i*3+2];waterMasks[i*2]=THREE.MathUtils.smoothstep(Math.hypot(x,z),6.1,8);waterMasks[i*2+1]=Math.pow(THREE.MathUtils.smootherstep(14-Math.abs(x),0,3.15)*THREE.MathUtils.smootherstep(14-Math.abs(z),0,3.15),.7)}
const crestCenter={value:new THREE.Vector2()},crestDirection={value:new THREE.Vector2(1,0)},crestStrength={value:0};
// 3.41（用户 m01968 拍板）：照 B 站《风格化沙滩pipeline》BV1ibpq6tEmU 的 05「湿沙/水位线」+12「软岸线」，
// 只做**岛缘**。岛不是圆——实测水线半径 4.70~6.35（72 方向），旧的 shoreMask=smoothstep(6.1,7.3,length(vSea.xz))
// 是个圆环、和不规则岸线不相符。所以烘一张"到岸距离"DataTexture：逐格向下打真实 mesh 求水面高度场(>1.15=陆)，
// 再沿 160 方向径向步进找"最深的水点"半径＝岸线。没烘好时 shSeam=0 → 退化成旧的硬岸线，可一键回退。
const shEdge={value:.42},shFoam={value:1},shSeam={value:0},shShoreTex={value:null},shTime={value:0},shSpan=24;
// 共享状态对象：art-direction.js 后跑、会覆盖 onBeforeCompile，两份 shader 引**同一个对象**才不会漂移。
window.islandShoreState={edge:shEdge,foam:shFoam,seam:shSeam,tex:shShoreTex,time:shTime,span:shSpan};
setTimeout(()=>{
  const SS=160;const box=new THREE.Box3().setFromObject(island);
  const span=24,RMAX=12,minX=-span/2;
  const field=new Float32Array(SS*SS);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),org=new THREE.Vector3(),hits=[];
  const cellX=i=>minX+(i/(SS-1))*span;
  for(let j=0;j<SS;j++){const z=cellX(j);
    for(let i=0;i<SS;i++){org.set(cellX(i),box.max.y+1.5,z);ray.set(org,down);hits.length=0;
      ray.intersectObject(island,true,hits);field[j*SS+i]=hits.length?hits[0].point.y:999;}}
  // 高度场先做中值去噪：沙架在 1.15 附近来回抖，直接点分类会得到"椒盐岸线"（我第一版就是，沿半径剖面在 0 上下乱跳）。
  const med=(src,passes)=>{let cur=src;for(let pass=0;pass<passes;pass++){const out=new Float32Array(cur.length),w=[];
      for(let j=0;j<SS;j++)for(let i=0;i<SS;i++){w.length=0;
        for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ii=Math.min(SS-1,Math.max(0,i+di)),jj=Math.min(SS-1,Math.max(0,j+dj));w.push(cur[jj*SS+ii])}
        w.sort((a,b)=>a-b);out[j*SS+i]=w[4];}
      cur=out;}return cur};
  const sm=med(med(field,2),1);
  const WL=1.15,n=SS*SS,data=new Uint8Array(n);
  // **按方向**求岸线半径：从洞口边缘(5.0)向外走到"最后一段浸水"为止，取这段的最大半径。
  // 不能按格向外找"第一个干格"——那样每格各自看到一小块干沙就当成岸，剖面会在 0 上下乱跳（我踩过两次）。
  for(let j=0;j<SS;j++){const _z=cellX(j);
    for(let i=0;i<SS;i++){const _x=cellX(i),l=Math.hypot(_x,_z)||1e-4,nx=_x/l,nz=_z/l;
      const at=d=>{const sx=Math.min(SS-1,Math.max(0,Math.round(((nx*d-minX)/span)*(SS-1))));
        const sz=Math.min(SS-1,Math.max(0,Math.round(((nz*d-minX)/span)*(SS-1))));return sm[sz*SS+sx]};
      let R=12,lastWet=null,breakD=null;
      for(let d=5;d<12.25;d+=.05){
        const h=at(d);
        if(h<WL)lastWet=d;
        else if(h>900||(lastWet!==null&&d-lastWet>=.4)){breakD=d;break}}
      R=breakD!==null?(lastWet!==null?lastWet:breakD):12;
      data[j*SS+i]=Math.min(255,Math.round(Math.max(0,R)/12*255));}}
  const tex=new THREE.DataTexture(data,SS,SS,THREE.RedFormat);
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.needsUpdate=true;
  shShoreTex.value=tex;
  const rd=(x,z)=>{const i=Math.max(0,Math.min(SS-1,Math.round(((x-minX)/span)*(SS-1))));
    const j=Math.max(0,Math.min(SS-1,Math.round(((z-minX)/span)*(SS-1))));return data[j*SS+i]/255*RMAX};
  // 注意：**不要**把 waterMasks 当成岸距用——它是"拍岸变形权重"(0..1)，改成米数会把浪放大成山（我踩过）。
  let mn=RMAX,mx=0;for(let i=0;i<original.length/3;i++){const v=rd(original[i*3],original[i*3+2])-Math.hypot(original[i*3],original[i*3+2]);if(v<mn)mn=v;if(v>mx)mx=v}
  window.islandShore={bake:true,span:+span.toFixed(2),minX:+minX.toFixed(2),rdMin:+mn.toFixed(2),rdMax:+mx.toFixed(2),ss:SS};
  shSeam.value=1; // 烘好这一帧起，两份 shader 都切到真实岸线
},0);
const waterTime={value:0};water.material=new THREE.MeshPhysicalMaterial({color:'#29bcca',roughness:.23,metalness:.1,transparent:true,opacity:.58,depthWrite:false,clearcoat:1,side:THREE.DoubleSide});
water.material.onBeforeCompile=shader=>{shader.uniforms.uTime=waterTime;shader.uniforms.uCrest=crestCenter;shader.uniforms.uDirection=crestDirection;shader.uniforms.uFoam=crestStrength;shader.uniforms.uShoreTex=shShoreTex;shader.uniforms.uShoreSeam=shSeam;shader.uniforms.uShoreSpan=shSpan;shader.uniforms.uShoreEdge=shEdge;shader.uniforms.uShoreFoam=shFoam;shader.uniforms.uShoreTime=shTime;shader.vertexShader='varying vec3 vSea; varying float vShore;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSea = position;\nvShore = length(position.xz)-shoreDistAt(position.xz);');shader.vertexShader='uniform sampler2D uShoreTex; uniform float uShoreSeam; uniform float uShoreTime; uniform float uShoreSpan;\nfloat shoreHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat shoreNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(shoreHash(i),shoreHash(i+vec2(1,0)),f.x),mix(shoreHash(i+vec2(0,1)),shoreHash(i+vec2(1,1)),f.x),f.y); }\nfloat shoreDistAt(vec2 p){\n  if(uShoreSeam<.5||uShoreSpan<.01) return length(p)-6.1;\n  vec2 uv=p/uShoreSpan+.5; uv.y+=sin(uShoreTime*.45+p.x*.9)*.004;\n  float wob=(shoreNoise(p*1.15)-.5)*.34+(shoreNoise(p*3.1+13.7)-.5)*.12;\n  return texture2D(uShoreTex,uv).r*12.+wob;   // 岸线半径（从原点量）\n}\n'+shader.vertexShader;shader.fragmentShader='uniform float uTime; uniform vec2 uCrest; uniform vec2 uDirection; uniform float uFoam; uniform float uShoreSeam; uniform float uShoreEdge; uniform float uShoreFoam; uniform float uShoreTime; varying vec3 vSea; varying float vShore;\nfloat foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y); }\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float a=sin(vSea.x*7.7+sin(vSea.z*2.5+uTime*.55)*1.6+uTime*.4);
float b=sin(vSea.z*8.1+sin(vSea.x*2.9-uTime*.4)*1.6-uTime*.3);
float caustic=pow(max(0.,1.-abs(a+b)*.75),12.);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb+vec3(.38,.48,.4),caustic*.28);
vec2 q=vSea.xz-uCrest;
float forward=dot(q,uDirection),crossflow=dot(q,vec2(-uDirection.y,uDirection.x));
float rough=foamNoise(vec2(crossflow*6.,forward*5.-uTime*.7));
float ridge=forward-(.8-crossflow*crossflow*.22)+(rough-.5)*.18;
float width=exp(-pow(crossflow/2.1,4.));
float crest=exp(-ridge*ridge/ .055)*width;
float behind=max(0.,-ridge);
float strands=foamNoise(vec2(crossflow*22.,forward*2.+uTime*.45));
float lace=foamNoise(vec2(crossflow*42.+uTime*.2,forward*9.));
float tail=exp(-behind*1.6)*smoothstep(.05,.22,behind)*(1.-smoothstep(2.,3.,behind))*width;
// 3.40b 用户要求：**取消右键点下去那圈"海浪贴图"**＝这里的 crest 波峰白沫（uFoam=crestStrength 驱动）；
// 拖尾（tail 项，下面那一半）要保留，陆缘拍岸白沫（shoreDistance 的 surf）也不动。
float froth=clamp((tail*smoothstep(.38,.72,strands)*(.35+lace*.65))*uFoam,0.,1.);
// 3.41 岛缘（照参考片 05/12）：dShore＝到岸线距离。湿沙带在水下那一侧，白沫线叠在岸线上并随潮微微摆动。
float dShore=uShoreSeam>.5?vShore:length(vSea.xz)-6.1;   // >0 水侧, <0 陆侧(米)
float shTide=sin(uShoreTime*.5+vSea.x+vSea.z*.7)*.055;
float wetBand=1.-smoothstep(.05,uShoreEdge,dShore*(1.+3.*dShore/uShoreEdge));              // 水下由深到浅
float foamLine=(1.-smoothstep(.05,.09,abs(dShore+.04+shTide)))*uShoreFoam;
float shoreFoam=foamLine*(.55+.45*foamNoise(vec2(dShore*7.+uShoreTime*.25,vSea.x*1.6+vSea.z*1.1)));
diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb,vec3(.40,.57,.53),.24),wetBand*uShoreSeam);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.99,1.,1.),clamp(shoreFoam,0.,1.)*.82);
diffuseColor.a=mix(diffuseColor.a,.99,clamp(shoreFoam,0.,1.)*.85);
float shoreMask=smoothstep(6.1,7.3,length(vSea.xz));
float edgeMask=smoothstep(0.,2.,min(14.-abs(vSea.x),14.-abs(vSea.z)));
froth*=shoreMask*edgeMask;
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.96,.985,.98),froth);
diffuseColor.a=mix(diffuseColor.a,.97,froth);
// 3.47 果冻感（菲涅尔糖壳）只写在 art-direction.js 里：它需要**视线空间法线**（normal）与 vViewPosition，
// 而这两个变量在 <color_fragment> 这个注入点还没定义（要等 <normal_fragment_begin>）。
// art-direction.js 的注入点在 <opaque_fragment> 之前，那里两者都已就绪 → 所以这一条只存在于那份 shader。
// 别的岸线/白沫/拖尾改动仍然必须两份同改（art-direction.js 后跑会覆盖这里）。

`)};
foam.scale.setScalar(.55);foam.position.y=1.18;
// Replace the broad forest crowns with narrow, curved palm leaves.
island.children.filter(o=>o.type==='Group'&&o!==volcano&&!dinosaurs.some(d=>d.g===o)).forEach(o=>o.visible=false);
function palm(x,z,h){const g=new THREE.Group();g.position.set(x,1.5,z);island.add(g);rod(g,mats.bark,[0,0,0],[.4,h,0],.28,.15);for(let j=0;j<3;j++){let a=j/7*Math.PI*2;let points=[new THREE.Vector3(.4,h,0),new THREE.Vector3(.4+Math.cos(a)*1.3,h+.5,Math.sin(a)*1.3),new THREE.Vector3(.4+Math.cos(a)*2.5,h-.4,Math.sin(a)*2.5)];const curve=new THREE.QuadraticBezierCurve3(...points);mesh(new THREE.TubeGeometry(curve,7,.13,4,false),mats.leaf,g);let leaf=ball(g,mats.leaf,.4+Math.cos(a)*1.3,h+.12,Math.sin(a)*1.3,.85,.08,.27);leaf.rotation.y=-a} }
[[5,-3,3.7],[-5,0,3.5],[4,4,3],[-3,5,3.4]].forEach(p=>palm(...p));
let paused=false,simTime=0,softness=1.3,decay=1.5,tidal=0,ripple={x:0,z:0,time:-100};

document.querySelector('#soft').oninput=e=>softness=.3+e.target.value*.025;
document.querySelector('#damping').oninput=e=>decay=.3+e.target.value*.04;
document.querySelector('#tide').oninput=e=>tidal=(e.target.value-50)*.014;
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{water.material.color.set(b.dataset.color);waterBody.material.color.set(b.dataset.color);document.querySelectorAll('[data-color]').forEach(o=>o.classList.toggle('active',o===b))});
const fish=[];
const smoothstep01=v=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x)};
function heldSeaWaves(x,z,t){
  if(feeding)return 0;
  const dx=x-seaPull.x,dz=z-seaPull.z,r=Math.hypot(dx,dz),speed=seaMotion.speed;
  const len=Math.hypot(seaMotion.vx,seaMotion.vz),ux=len>.01?seaMotion.vx/len:1,uz=len>.01?seaMotion.vz/len:0;
  const along=dx*ux+dz*uz,across=dx*uz-dz*ux;
  const envelope=THREE.MathUtils.smoothstep(r,.7,1.5)*(1-THREE.MathUtils.smoothstep(r,2.5,7));
  const forward=.65+.65*Math.max(0,along/Math.max(.1,r))*Math.min(1,speed/5);
  let height=Math.sin(r*4-t*5-along*Math.min(1,speed/8))*.12*envelope*Math.min(1,seaPull.height/.8)*forward;
  for(const wake of wakeTrail){
    const age=t-wake.time;if(age>.5)continue;
    const wx=x-wake.x,wz=z-wake.z,behind=-(wx*wake.ux+wz*wake.uz),cross=Math.abs(wx*wake.uz-wz*wake.ux);
    if(behind<0||behind>7)continue;
    // 3.40 拖尾改形（用户：不要这么碎、不要全是小点点）：
    //  · 原来是 `Math.cos(band*5-age*5)` —— 沿尾迹来回振荡，叠出来一圈圈"肋骨/羽毛"；
    //  · 现在只有一个**正向**的柳叶状隆起（`Math.exp(-band*band*1.6)`，横向宽而柔），
    //    后面拖一条很轻的尾波 `Math.sin(behind*2.1-age*4)*.45` 当作水纹，不再有格纹。
    //  另外把 age 的淡入淡出窗口放宽到 .1/.55，免得相邻尾迹点之间露出"空隙"（碎感的另一半来源）。
    const band=cross-behind*.34;
    const fade=smoothstep01(age/.1)*(1-smoothstep01((age-.12)/(.38)))*Math.exp(-behind*.22)*smoothstep01(behind/.6)*(1-smoothstep01((behind-5)/2));
    const leaf=Math.exp(-band*band*1.6);
    const ripple=1+Math.sin(behind*2.1-age*4)*.45;
    height+=leaf*ripple*fade*wake.strength*.085;
  }
  return height;
}

function localRippleHeight(x,z,t){
  if(feeding)return 0;
  const radius=Math.hypot(x-ripple.x,z-ripple.z),age=Math.max(0,t-ripple.time);
  const falloff=1-THREE.MathUtils.smoothstep(radius,1,7);
  return Math.sin(radius*4-age*7)*Math.exp(-age*decay)*.22*falloff*falloff;
}
const feedBag=document.createElement('div');feedBag.id='feedBag';feedBag.innerHTML='<div class="feed-meter" role="progressbar" aria-label="剩余饲料" aria-valuemin="0" aria-valuemax="20"><i></i></div><span class="feed-count"></span><div class="bag-icon">▱<b>鱼粮</b></div><small>左键投放 · 右键取消</small>';document.body.append(feedBag);
function updateFeedBag(){feedBag.querySelector('i').style.width=feedRemaining/20*100+'%';feedBag.querySelector('.feed-meter').setAttribute('aria-valuenow',feedRemaining);feedBag.querySelector('.feed-count').textContent=feedRemaining+' / 20';document.querySelector('#feed').textContent=feedRemaining===0?'补充饲料':'投喂中';}
function moveFeedBag(x,y){feedBag.style.left=x+'px';feedBag.style.top=y+'px'}
function exitFeeding(){feeding=false;feedBag.style.display='none';document.querySelector('#feed').classList.remove('active');document.querySelector('#feed').textContent='投喂小鱼';canvas.style.cursor=viewLocked?'default':'grab';down=null;pointers.clear();toast('已退出投喂模式')}
function dropFeed(e){
  moveFeedBag(e.clientX,e.clientY);
  if(feedRemaining===0){toast('饲料用完了，点击“补充饲料”装满袋子');return}
  const hit=pointerRay(e).intersectObjects([island,water],true)[0];
  if(!hit){toast('点击海水或小岛投放饲料');return}
  const point=hit.point;feedRemaining--;updateFeedBag();
  // Land hit: the island's own dinosaurs come over for it (pet-life.js).
  if(hit.object!==water){window.petLife?.feedLand(point);return}
  for(let i=0;i<8;i++){const f=ball(scene,mat('#cc9553'),point.x+(Math.random()-.5)*.65,point.y+1+Math.random()*.5,point.z+(Math.random()-.5)*.65,.06,.06,.06);fish.push({f,y:-1.2})}
  feedSpot={x:point.x,z:point.z,time:simTime};
  window.waterPet?.feed(point);
}
document.querySelector('#feed').onclick=e=>{if(feedRemaining===0)feedRemaining=20;feeding=true;releaseSea();ripple.time=-100;wakeTrail.length=0;seaMotion.speed=0;seaPull.height=0;seaPull.dx=0;seaPull.dz=0;down=null;pointers.clear();feedBag.style.display='block';moveFeedBag(e.clientX||innerWidth/2,e.clientY||innerHeight/2);updateFeedBag();document.querySelector('#feed').classList.add('active');canvas.style.cursor='none';toast('点击海水投放饲料，右键取消')};
document.addEventListener('pointerdown',e=>{if(feeding&&e.button===2){e.preventDefault();e.stopPropagation();exitFeeding()}},true);
document.addEventListener('contextmenu',e=>{if(feeding||e.target===canvas)e.preventDefault()});
addEventListener('keydown',e=>{if(feeding&&e.key==='Escape')exitFeeding()});

// Living reef: seabed plants and schools stay inside the cutaway water volume.
const reef=new THREE.Group();scene.add(reef);mesh(new THREE.CylinderGeometry(5.2,6.5,2,40),mat('#bca981'),reef,0,-.4,0);
const coralMaterials=['#dd8169','#b8a0cf','#e6ba68'].map(mat),kelp=mat('#477a54');
for(let i=0;i<24;i++){const angle=i*2.4,r=7+(i%6)*1.05,x=Math.cos(angle)*r,z=Math.sin(angle)*r;ball(reef,mats.rock,x,-1.12,z,.45,.25,.35);for(let k=0;k<3;k++){const h=.45+(i%4)*.14;rod(reef,i%3===0?coralMaterials[i%3]:kelp,[x+k*.12,-1.2,z],[x+.2+k*.12,-1.2+h,z+.15],.045,.018);if(i%3===0)rod(reef,coralMaterials[i%3],[x,-.9,z],[x-.3,-.65,z+.2],.03,.015)}}
const swimmers=[];
for(let i=0;i<34;i++){const g=new THREE.Group(),m=mat(['#ffb347','#5ad1e6','#ff7fa8','#ffd166'][i%4]);ball(g,m,0,0,0,.27,.115,.085);const tail=mesh(new THREE.ConeGeometry(.15,.26,3),m,g,-.30,0,0);tail.rotation.z=Math.PI/2;ball(g,eye,.17,.04,.078,.022,.022,.016);scene.add(g);swimmers.push({g,phase:i*.63,r:7.3+(i%5)*.9,y:-.7+(i%4)*.27})}
// 3.40d 用户要求：「长条水滴，能不能用二维的水拖尾素材代替」→ 水滴网格换成 **2D 水拖尾 sprite**。
// 素材：assets/water-trail.png（512×256 RGBA，程序化生成，见 D:\Deepseek _file\_make_water_trail.py）
//  · 平面几何贴在波面上（绕 X 转 -90°），实例的 **yaw 对齐自己的速度方向**，所以长轴永远顺着水流；
//  · 长度 = length（世界单位）、宽度 = width，都是实例缩放；不再用球体去"假装"水线；
//  · 生成位置/物理/淡出与 3.40c 相同（前沿扇出 + 上抛重力 + 落水即止）。
const sprayCount=180;
const sprayParticles=Array.from({length:sprayCount},()=>({life:0}));
const sprayTex=new THREE.TextureLoader().load('assets/water-trail.png');
sprayTex.colorSpace=THREE.SRGBColorSpace;
const sprayGeo=new THREE.PlaneGeometry(1,1);
const sprayMat=new THREE.MeshBasicMaterial({map:sprayTex,color:'#ffffff',transparent:true,opacity:.58,depthWrite:false,side:THREE.DoubleSide,fog:true});
const sprayMesh=new THREE.InstancedMesh(sprayGeo,sprayMat,sprayCount);
sprayMesh.frustumCulled=false;sprayMesh.renderOrder=4;sprayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(sprayMesh);
const sprayDummy=new THREE.Object3D(),sprayColor=new THREE.Color(),sprayWhite=new THREE.Color('#ffffff');
const SPRAY_FLAT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);  // 平铺在水面
const sprayYaw=new THREE.Quaternion(),sprayUp=new THREE.Vector3(0,1,0);
let sprayIndex=0,sprayTimer=0;
// 水面高度（用与水域同一套采样：网格列行 → 顶点 y）
function spraySurfaceY(x,z){const col=Math.max(0,Math.min(segments,Math.round((x+14)/28*segments))),row=Math.max(0,Math.min(segments,Math.round((z+14)/28*segments)));return waterGeo.attributes.position.getY(row*stride+col)+water.position.y;}
// 生命两端各留一点淡入淡出，避免水滴"啪"地出现/消失
function sprayFade(k){return Math.min(1,k*6)*Math.min(1,(1-k)*5)}
function updateSpray(dt,t){
  sprayTimer+=dt;
  if(seaGrab&&!feeding&&seaMotion.speed>.7&&sprayTimer>.03){
    sprayTimer=0;
    const norm=Math.hypot(seaMotion.vx,seaMotion.vz)||1,ux=seaMotion.vx/norm,uz=seaMotion.vz/norm;
    const n=8;
    for(let j=0;j<n;j++){
      // 前沿两侧各溅一点，扇形 ±0.35，且只在拖动点前方（不是身后）
      const side=(j/(n-1)-.5)*.7,front=.55+Math.random()*.5;
      const x=seaPull.x+ux*front-uz*side, z=seaPull.z+uz*front+ux*side;
      if(Math.abs(x)>13.7||Math.abs(z)>13.7||Math.hypot(x,z)<6.35)continue;
      // 速度 = 拖动方向的一部分 + 侧向散开；这样长轴自然沿"水花飞出去"的方向
      const sp=.34+Math.random()*.34;
      const vx=ux*sp-uz*side*.55, vz=uz*sp+ux*side*.55;
      const life=.7+Math.random()*.9;
      sprayParticles[sprayIndex]={x,z,vx,vz,life,max:life,
        width:.11+Math.random()*.09,                   // 贴图宽度（世界单位）
        stretch:3.2+Math.random()*2.0,                 // 长/宽比 → 拖尾长度
        vy:.7+Math.random()*.9};                       // 初始上抛
      sprayIndex=(sprayIndex+1)%sprayCount;
    }
  }
  for(let i=0;i<sprayCount;i++){
    const o=sprayParticles[i];
    if(o.life>0){
      o.life-=dt;
      const drag=Math.exp(-dt*1.9);
      o.vx*=drag;o.vz*=drag;o.vy-=dt*1.25;            // 重力放慢一点，让水花在空中留得久些
      o.x=THREE.MathUtils.clamp(o.x+o.vx*dt,-13.85,13.85);
      o.z=THREE.MathUtils.clamp(o.z+o.vz*dt,-13.85,13.85);
      const base=spraySurfaceY(o.x,o.z);
      const y=base+.05+Math.max(0,o.vy)*.34;          // 上抛后的高度（o.vy 递减，落地即结束）
      if(o.life<=0||o.vy<0){o.life=0;sprayDummy.position.set(0,-30,0);sprayDummy.scale.setScalar(0);sprayColor.set('#ffffff');}
      else{
        const age=1-o.life/o.max, fade=sprayFade(o.life/o.max);
        // 2D 拖尾：平面平贴波面，绕 Y 转到速度方向；长度 = width×stretch（随时间略抽长、变淡）
        const len=o.width*o.stretch*(1+age*.7)*fade, wid=o.width*fade;
        sprayYaw.setFromAxisAngle(sprayUp,Math.atan2(-o.vz,o.vx));
        sprayDummy.position.set(o.x,y,o.z);
        sprayDummy.quaternion.copy(sprayYaw).multiply(SPRAY_FLAT);
        sprayDummy.scale.set(len,wid,1);
        sprayColor.copy(water.material.color).lerp(sprayWhite,Math.min(.82,.42+age*.5));
      }
    }else{sprayDummy.position.set(0,-30,0);sprayDummy.scale.setScalar(0);sprayColor.set('#ffffff');}
    sprayDummy.updateMatrix();sprayMesh.setMatrixAt(i,sprayDummy.matrix);sprayMesh.setColorAt(i,sprayColor);
  }
  sprayMesh.instanceMatrix.needsUpdate=true;if(sprayMesh.instanceColor)sprayMesh.instanceColor.needsUpdate=true;
}
let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=paused?0:Math.min((now-last)*.001,.05);simTime+=dt;const t=simTime;last=now;if(now-seaMotion.lastMove>100)seaMotion.speed*=Math.exp(-dt*4);while(wakeTrail.length&&t-wakeTrail[0].time>.4)wakeTrail.shift();swimmers.forEach(({g,phase,r,y})=>{const a=t*.16+phase;const normal=new THREE.Vector3(Math.cos(a)*r,y+Math.sin(t*1.4+phase)*.08,Math.sin(a)*r);if(feedSpot&&t-feedSpot.time<9){const attraction=new THREE.Vector3(feedSpot.x+Math.cos(phase+t)*.8,y,feedSpot.z+Math.sin(phase+t)*.8);g.position.lerp(attraction,Math.min(1,dt*1.2));g.rotation.y=Math.atan2(attraction.z-g.position.z,-(attraction.x-g.position.x))}else{g.position.lerp(normal,Math.min(1,dt*2));g.rotation.y=-a-Math.PI/2}});const active=now<eruptionUntil;fish.forEach((o,i)=>{o.f.position.y-=dt*.6;if(o.f.position.y<o.y){scene.remove(o.f);o.f.geometry.dispose();o.f.material.dispose();fish.splice(i,1)}});dinosaurs.forEach((d,i)=>{if(i===3){
  // 3.28 翼龙飞行空间扩大（全部是岛局部坐标，世界 = ×.55）：
  //   水平半径 9–14 局部 = 4.9–7.7 世界（直径约 15 世界，≈ 半个水块），高度 6.5–15.9 局部 = 3.6–8.7 世界，
  //   两条不同频率的正弦交叉，路径不再是一个闭合椭圆；位置用缓动跟随（抢食结束回队时不会瞬移），
  //   朝向按路径切线算，另外加一点转弯侧倾。
  const a=t*.22,rad=11.5+Math.sin(t*.289)*2.5,px=Math.sin(a)*rad,pz=Math.cos(a*1.13)*rad,
    py=12.9+Math.sin(t*.403)*4.4+Math.sin(t*.05)*.8,k=1-Math.exp(-dt*2.4),
    qx=Math.sin(a+.02)*rad,qz=Math.cos((a+.02)*1.13)*rad;
  d.g.position.x+=(px-d.g.position.x)*k;d.g.position.y+=(py-d.g.position.y)*k;d.g.position.z+=(pz-d.g.position.z)*k;
  d.g.rotation.y=-Math.atan2(qz-pz,qx-px);d.g.rotation.z=Math.sin(a)*.16;
  d.g.wings.forEach((w,j)=>w.rotation.x=Math.sin(t*(4.2+Math.sin(t*.05)*1.2))*(j?-.35:.35));
}else{d.g.position.x=d.base.x+Math.sin(t*.25+i)*.8;d.g.position.z=d.base.z+Math.cos(t*.25+i)*.6;d.g.position.y=(i===2?-.15:1.48)+Math.sin(t*3+i)*.025;d.g.rotation.y=-.2+Math.sin(t*.25+i)*.35;d.legs.forEach((l,j)=>l.rotation.z=Math.sin(t*3+j*Math.PI)*.12);if(d.hello&&now-d.hello<2000)d.g.rotation.z=Math.sin((now-d.hello)*.009)*.09;else d.g.rotation.z=0}});
if(seaGrab&&seaGoal){const blend=1-Math.exp(-dt*18);for(const k of ['x','z','dx','dz','height'])seaPull[k]+=(seaGoal[k]-seaPull[k])*blend}
if(!seaGrab){seaPull.height*=Math.exp(-dt*4);seaPull.dx*=Math.exp(-dt*4);seaPull.dz*=Math.exp(-dt*4)}
const pullEdge=.3+.7*THREE.MathUtils.smootherstep(Math.min(14-Math.abs(seaPull.x),14-Math.abs(seaPull.z)),0,3.85);
// Gravity-wave frequencies use sqrt(g*k*tanh(k*2.4)) with a shared 0.55 time scale.
const pos=waterGeo.attributes.position;for(let i=0;i<pos.count;i++){let x=original[i*3],z=original[i*3+2];const shore=waterMasks[i*2];const influence=Math.exp(-((x-seaPull.x)**2+(z-seaPull.z)**2 )/3.5)*shore;const edge=waterMasks[i*2+1];pos.array[i*3]=THREE.MathUtils.clamp(x+seaPull.dx*.4*influence*edge*pullEdge,-14,14);pos.array[i*3+2]=THREE.MathUtils.clamp(z+seaPull.dz*.4*influence*edge*pullEdge,-14,14);pos.array[i*3+1]=Math.min(seaPull.height,1.4)*influence*edge*pullEdge+(Math.sin(x*.65+t*1.33)*.12+Math.cos(z*.55+t*1.19)*.1+Math.sin(x*2.35+z*1.07-t*2.77)*.022+Math.sin(-x*1.42+z*2.72-t*3.02+.8)*.014)*softness*shore+(localRippleHeight(x,z,t)+heldSeaWaves(x,z,t)*pullEdge)*shore*edge+tidal*shore}pos.needsUpdate=true;waterGeo.computeVertexNormals();waterTime.value=t;updateWaterSides();crestCenter.value.set(seaPull.x,seaPull.z);const foamVelocity=Math.hypot(seaMotion.vx,seaMotion.vz);if(foamVelocity>.1)crestDirection.value.set(seaMotion.vx/foamVelocity,seaMotion.vz/foamVelocity);const foamTarget=feeding?0:Math.min(1,seaPull.height/.8)*(seaGrab?Math.min(1,seaMotion.speed/3):.6);crestStrength.value+=(foamTarget-crestStrength.value)*(1-Math.exp(-dt*5));foam.scale.setScalar(.55*(1+Math.sin(t)*.015));foam.material.opacity=.22+Math.sin(t)*.08;updateSpray(dt,t);
const cx=window.islandCrater?.x??-1.1,cy=window.islandCrater?.y??4.4,cz=window.islandCrater?.z??-1.65;
const rise=active?1.85:1,smokeSpeed=active?.45:.2;
window.eruptionActive=!!active;          // 3.48b：模型烟团要跟着喷发加速
if(!window.volcanoSmoke)smoke.forEach(s=>{const {p}=s;
  const f=(t*smokeSpeed*s.speed+s.phase)%1;                      // 每颗自己的相位 → 不同步
  const fadeIn=Math.min(1,f/.10),fadeOut=Math.min(1,(1-f)/.42);   // 出生淡入、顶端淡出
  const wob=Math.sin(t*s.swayF+s.swayP+f*4.4)*s.swayA*f;          // 上升中左右摆（风）
  const wob2=Math.cos(t*s.swayF*.77+s.swayP*1.7)*s.swayA*.55*f;
  p.position.set(cx+wob+f*f*s.leanX*rise,
                 cy+.35+f*6.4*rise,
                 cz+wob2+f*s.leanZ+f*f*s.leanZ*1.6);
  p.scale.setScalar(s.size*(.32+f*2.15)*(1+.13*Math.sin(t*1.6+s.swayP)));
  p.rotation.x+=dt*s.spin.x*2.2;p.rotation.y+=dt*s.spin.y*2.2;p.rotation.z+=dt*s.spin.z*2.2;
  p.material.opacity=Math.min(.85,(active?.66:.52)*Math.min(fadeIn,fadeOut));
});sparks.forEach(s=>{if(s.life>0){s.life-=dt;s.v.y-=dt*5;s.p.position.addScaledVector(s.v,dt);if(s.life<=0||s.p.position.y<1.6)s.p.visible=false}});lavaLight.intensity=active?35+Math.sin(t*15)*8:10+Math.sin(t*2)*3;
window.volcanoSmoke?.update(dt,t);
const dest=focus===null?new THREE.Vector3(0,1,0):dinosaurs[focus].g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1,0));if(!viewLocked&&!feeding)target.lerp(dest.add(panOffset),.04);const responsive=innerWidth<700?1.25:1;camera.position.set(target.x+distance*responsive*Math.sin(phi)*Math.sin(theta),target.y+distance*responsive*Math.cos(phi),target.z+distance*responsive*Math.sin(phi)*Math.cos(theta));camera.lookAt(target);window.waterPet?.update(dt,t);window.oceanLife?.update(dt,t);window.petLife?.update(dt,t);window.skyLife?.update(dt);window.seabedLife?.update(t);window.weatherLife?.update(dt,t);renderer.render(scene,camera)}requestAnimationFrame(animate);
const settingsButton=document.querySelector('#settings'),settingsPanel=document.querySelector('#water-settings');
settingsButton.onclick=()=>{const rect=settingsButton.getBoundingClientRect();settingsPanel.style.right=Math.max(12,Math.min(innerWidth-260,innerWidth-rect.right))+'px';settingsPanel.hidden=!settingsPanel.hidden;settingsButton.setAttribute('aria-expanded',String(!settingsPanel.hidden));};
const labToggle=document.querySelector('#lab-toggle'),labContent=document.querySelector('#lab-content');
function toggleLab(){labContent.hidden=!labContent.hidden;labToggle.textContent=labContent.hidden?'+':'−';labToggle.setAttribute('aria-expanded',String(!labContent.hidden));labToggle.setAttribute('aria-label',labContent.hidden?'展开小岛实验室':'最小化小岛实验室');}
labToggle.onclick=toggleLab;
if(innerWidth<700)toggleLab();
addEventListener('keydown',e=>{if(e.key==='Escape'){settingsPanel.hidden=true;settingsButton.setAttribute('aria-expanded','false');}});
document.querySelector('#day').addEventListener('click',()=>document.body.classList.toggle('night',night));
