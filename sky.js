/* Sky, low-poly clouds and the floating-block presentation, following the reference render:
   a complete, crisp glass water block floating in a pale blue sky instead of dissolving into a
   flat studio backdrop. */
(()=>{
let seed=771023;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);

// 1. Sky dome. It follows the camera so the gradient always reads as a real horizon and the
//    geometry never leaves the camera's far plane.
const DAY={top:'#6cbcf0',bottom:'#eaf6fd'},NIGHT={top:'#0c1a2e',bottom:'#22405f'};
const skyColors={top:new THREE.Color(DAY.top),bottom:new THREE.Color(DAY.bottom)};
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(300,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
  uniforms:{uTop:{value:skyColors.top},uBottom:{value:skyColors.bottom}},
  vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 uTop;uniform vec3 uBottom;varying vec3 vSky;void main(){float h=normalize(vSky).y;gl_FragColor=vec4(mix(uBottom,uTop,smoothstep(-.32,.22,h)),1.);}'
}));
skyDome.frustumCulled=false;skyDome.renderOrder=-100;scene.add(skyDome);

// 2. Low-poly clouds: clusters of flat-shaded icosahedra, one merged mesh per cloud so a cloud
//    costs a single draw call and can drift on its own.
const cloudMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,metalness:0,flatShading:true});
function mergeCloud(blobs){
  const positions=[],normals=[],v=new THREE.Vector3(),n=new THREE.Vector3();
  for(const {geo,matrix} of blobs){
    const g=geo.index?geo.toNonIndexed():geo,p=g.attributes.position,nm=g.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
      n.fromBufferAttribute(nm,i).applyMatrix3(normalMatrix).normalize();normals.push(n.x,n.y,n.z);
    }
    if(g!==geo)g.dispose();
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.computeBoundingSphere();
  return geometry;
}
const cloudGroup=new THREE.Group();scene.add(cloudGroup);
const clouds=[];
function addCloud(angleDeg,radius,y,scale,lobes){
  const angle=angleDeg*Math.PI/180,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius,blobs=[];
  for(let k=0;k<lobes;k++){
    const t=lobes>1?k/(lobes-1)-.5:0,r=(.42+rnd()*.30)*scale;
    blobs.push({geo:new THREE.IcosahedronGeometry(1,0),matrix:new THREE.Matrix4().compose(
      new THREE.Vector3(cx+t*scale*2.0+(rnd()-.5)*scale*.35,y+(rnd()-.35)*scale*.20,cz+(rnd()-.5)*scale*.6),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd()*3,rnd()*3,rnd()*3)),
      new THREE.Vector3(r,r*(.60+rnd()*.22),r*(.78+rnd()*.34)))});
  }
  const mesh=new THREE.Mesh(mergeCloud(blobs),cloudMaterial);
  mesh.castShadow=false;mesh.receiveShadow=false;cloudGroup.add(mesh);
  clouds.push({mesh,speed:.3+rnd()*.7,startX:cx});
}
// Clouds sit far behind the stage and are placed by the elevation they should read at, so they
// land in the sky band above the block from every orbit angle: at 190-300 units the camera never
// gets close to one, which is what keeps them from looming in front of the diorama.
const EYE_Y=1+61*Math.cos(1.16);
function addCloud(angleDeg,distance,elevationDeg,widthDeg,lobes){
  const angle=angleDeg*Math.PI/180,y=EYE_Y+distance*Math.tan(elevationDeg*Math.PI/180);
  const scale=distance*Math.tan(widthDeg*Math.PI/360);
  const blobs=[];
  for(let k=0;k<lobes;k++){
    // Local offsets only: the mesh carries the position so it can drift without re-baking.
    // Lobes stay above a flat base so the cluster reads as a puffy cloud, not a rock pile.
    const t=lobes>1?k/(lobes-1)-.5:0,r=(.40+rnd()*.30)*scale;
    const lift=k===0?0:(.10+rnd()*.45)*scale;
    blobs.push({geo:new THREE.IcosahedronGeometry(1,0),matrix:new THREE.Matrix4().compose(
      new THREE.Vector3(t*scale*1.5+(rnd()-.5)*scale*.30,r*.35+lift,(rnd()-.5)*scale*.75),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd()*3,rnd()*3,rnd()*3)),
      new THREE.Vector3(r,r*(.48+rnd()*.16),r*(.72+rnd()*.36)))});
  }
  const mesh=new THREE.Mesh(mergeCloud(blobs),cloudMaterial);
  mesh.position.set(Math.cos(angle)*distance,y,Math.sin(angle)*distance);
  mesh.castShadow=false;mesh.receiveShadow=false;cloudGroup.add(mesh);
  clouds.push({mesh,speed:.9+rnd()*1.6,startX:mesh.position.x});
}
for(let i=0;i<12;i++)addCloud(i*30+rnd()*16,190+rnd()*110,-18+rnd()*14,8+rnd()*7,5+Math.floor(rnd()*4));

// 2b.（3.28 曾在此加过"岛正上方 4 朵小白云"，**3.41b 按用户要求整组删除**：
//     他圈出那几朵小的说「删除掉自己多小云」。删掉的是 addIslandCloud + islandClouds 数组
//     + 每帧漂移循环 + skyLife 上的两个 getter；远景云（上面的 12 朵）不动。）

// 3. Presentation: the block floats, so the flat studio floor goes away and the soft contact
//    shadow moves directly under the base.
floor.visible=false;
let contactShadow=null;
scene.children.forEach(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='PlaneGeometry'&&o.material&&o.material.map&&o.material.transparent)contactShadow=o});
if(contactShadow){contactShadow.geometry.dispose();contactShadow.geometry=new THREE.PlaneGeometry(34,34);contactShadow.position.y=-3.6;contactShadow.material.opacity=.55}
scene.children.forEach(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='LineSegments')o.material.opacity=.45});

// 6. The old studio fog band (90/160) would swallow the clouds 190+ units out, so push it past
//    everything in the scene; the sky dome supplies the depth cue instead.
scene.fog.near=420;scene.fog.far=900;

// 4. Day/night: wrap the existing handler so the sky and clouds follow the lighting state.
function paintSky(){
  const palette=night?NIGHT:DAY;
  skyColors.top.set(palette.top);skyColors.bottom.set(palette.bottom);
  scene.background.copy(skyColors.bottom);scene.fog.color.copy(skyColors.bottom);
  cloudMaterial.color.set(night?'#9fb3c9':'#ffffff');
}
const dayBase=document.querySelector('#day').onclick;
document.querySelector('#day').onclick=()=>{dayBase();paintSky()};
paintSky();

// 5. Per-frame: keep the dome centred on the camera and drift the clouds.
let clock=0;
function update(dt){
  const step=dt||0;clock+=step;
  skyDome.position.copy(camera.position);
  for(const cloud of clouds){
    cloud.mesh.position.x+=cloud.speed*step;
    if(cloud.mesh.position.x-cloud.startX>70)cloud.mesh.position.x-=140;
  }
}
window.skyLife={update,paintSky,get clouds(){return clouds},get cloudCount(){return clouds.length},
  skyColors,cloudMaterial};   // 3.31 起天气模块要在 paintSky() 之后再染一次天穹/云
})();
