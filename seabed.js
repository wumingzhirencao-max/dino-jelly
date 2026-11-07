/* Underwater ecosystem: a readable seabed with rocks, three coral families, kelp, sea grass
   and rising bubbles. Authored in world space on purpose: island.js scales the island group to
   .55, which is why the legacy reef block (built for the unscaled, 10.8-radius island) read as
   floating debris in open water. */
(()=>{
// Retire the legacy reef block; it also owned the hidden disc under the island.
// Only geometries are disposed: its rock material is shared with the island.
if(typeof reef!=='undefined'&&reef.parent){
  reef.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
  reef.parent.remove(reef);
}

const FLOOR=-1.34,SHORE=6.1,DEEP=11;
let seed=20261012;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
// Smooth value noise: the floor needs irregular mottling, not a sine grid.
function hash2(i,j){const s=Math.sin(i*127.1+j*311.7)*43758.5453;return s-Math.floor(s)}
function noise2(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return (hash2(i,j)*(1-u)+hash2(i+1,j)*u)*(1-v)+(hash2(i,j+1)*(1-u)+hash2(i+1,j+1)*u)*v}
function fbm(x,z){return noise2(x,z)*.6+noise2(x*2.07+11,z*2.03+7)*.28+noise2(x*4.1+31,z*4.3+17)*.12}
// 海床本体。注意这里**不为岛做任何抬高**：岛的沙坡（art-direction 的 beach）会往外多长两圈、
// 扎到这条剖面以下，两者因此是同一片地形接起来的。早先试过"把海床在岛缘抬成 -0.16 平台"，
// 结果平台比沙滩外缘还高，岛缘反而多出一圈"领圈 + 台阶"（见 docs 3.19 的第二版修法）。
function floorY(x,z){const shallow=1-THREE.MathUtils.smoothstep(Math.hypot(x,z),SHORE,DEEP);
  return FLOOR+.46*shallow+.10*(fbm(x*.34,z*.34)-.5)}

// Depth tint: everything underwater is darkened by how much water sits above it, driven by the
// same "水深" handle as the surface. A tall coral's tip has less water over it, so it stays
// brighter than the sand around its base.
// 3.49 水底焦散：先程序化网格（mode=0），再按"阳光穿过水面折射"算焦点（mode=1，默认）。
// 两个阶段都在海床材质里算，零额外 draw call；时间由 seabedLife.update(t) 推进。
const CAUS={time:{value:0},mode:{value:1},strength:{value:1.35},sharp:{value:1.6},scale:{value:1},depth:{value:.62},density:{value:1},blob:{value:1},thin:{value:1.9}};
window.seabedCaustics=CAUS;
function depthTint(material,palette=false){
  const mix=window.waterDepth?window.waterDepth.uniform:{value:.55};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uDepthMix=mix;
    shader.uniforms.uPalette={value:palette?1:0};
    shader.uniforms.uCausTime=CAUS.time;shader.uniforms.uCausMode=CAUS.mode;shader.uniforms.uCausStrength=CAUS.strength;
    shader.uniforms.uCausSharp=CAUS.sharp;shader.uniforms.uCausScale=CAUS.scale;shader.uniforms.uCausDepth=CAUS.depth;shader.uniforms.uCausDensity=CAUS.density;shader.uniforms.uCausThin=CAUS.thin;shader.uniforms.uCausBlob=CAUS.blob;
    material.userData.paletteUniform=shader.uniforms.uPalette;
    shader.vertexShader='attribute float aDepth;varying float vDepth;varying vec2 vWorldXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=aDepth;\nvWorldXZ=(modelMatrix*vec4(position,1.0)).xz;');
    shader.fragmentShader='uniform float uDepthMix;uniform float uPalette;varying float vDepth;varying vec2 vWorldXZ;\n'+'uniform float uCausTime;uniform float uCausMode;uniform float uCausStrength;uniform float uCausSharp;uniform float uCausScale;uniform float uCausDepth;uniform float uCausDensity;uniform float uCausThin;uniform float uCausBlob;\n'+`
float causHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// —— 第二阶段：阳光穿过水面折射后的焦点（雅可比行列式 -> 强度）——
float causRefract(vec2 p,float depth){
  float kn=uCausDensity;
  float k1=6.28318/2.60*kn,k2=6.28318/1.55*kn,k3=6.28318/0.92*kn;
  float w1=1.15,w2=1.85,w3=2.55;
  vec2 d1=normalize(vec2(.86,.51)),d2=normalize(vec2(-.42,.91)),d3=normalize(vec2(.21,-.98));
  float a1=.050,a2=.034,a3=.022,a4=.026,a5=.016,a6=.013,t=uCausTime*uCausScale;
  float k4=6.28318/1.18*kn,k5=6.28318/3.40*kn,k6=6.28318/0.71*kn;
  float w4=1.55,w5=.92,w6=2.95;
  vec2 d4=normalize(vec2(-.93,.36)),d5=normalize(vec2(.55,.84)),d6=normalize(vec2(-.71,-.70));
  float s1=sin(dot(p,d1)*k1+w1*t),s2=sin(dot(p,d2)*k2+w2*t),s3=sin(dot(p,d3)*k3+w3*t);
  float s4=sin(dot(p,d4)*k4+w4*t),s5=sin(dot(p,d5)*k5+w5*t),s6=sin(dot(p,d6)*k6+w6*t);
  float hxx=-(a1*k1*k1*s1*d1.x*d1.x+a2*k2*k2*s2*d2.x*d2.x+a3*k3*k3*s3*d3.x*d3.x+a4*k4*k4*s4*d4.x*d4.x+a5*k5*k5*s5*d5.x*d5.x+a6*k6*k6*s6*d6.x*d6.x);
  float hyy=-(a1*k1*k1*s1*d1.y*d1.y+a2*k2*k2*s2*d2.y*d2.y+a3*k3*k3*s3*d3.y*d3.y+a4*k4*k4*s4*d4.y*d4.y+a5*k5*k5*s5*d5.y*d5.y+a6*k6*k6*s6*d6.y*d6.y);
  float hxy=-(a1*k1*k1*s1*d1.x*d1.y+a2*k2*k2*s2*d2.x*d2.y+a3*k3*k3*s3*d3.x*d3.y+a4*k4*k4*s4*d4.x*d4.y+a5*k5*k5*s5*d5.x*d5.y+a6*k6*k6*s6*d6.x*d6.y);
  float c=depth*uCausDepth*1.25;
  float J00=1.0+c*hxx,J11=1.0+c*hyy,J01=c*hxy;
  float det=J00*J11-J01*J01;
  float focus=clamp(1.0/max(abs(det),.05),0.0,4.0)/4.0;
  // 亮斑粗细：大小越大，进入亮区的阈值窗口越宽 → 每条亮线更粗
  float w=clamp(.42*uCausBlob/max(uCausThin,.05),0.015,0.92);
  float blob=smoothstep(.50-w,.50+w*.35/max(uCausThin,.05),focus);
  return pow(blob,uCausSharp*.8*uCausThin);
}
// —— 第一阶段：程序化焦散网格（菱形网 + 抖动，用作兜底/对照）——
float causGrid(vec2 p){
  vec2 q=p*uCausScale*1.35;
  q+=vec2(causHash(floor(q*1.7)),causHash(floor(q*1.7)+7.3))*.35;
  vec2 g=abs(fract(q)-.5);
  float line=1.0-smoothstep(.03,.13,min(g.x,g.y));
  return line*line;
}
float causAll(vec2 p,float depth){
  float m=mix(causGrid(p),causRefract(p,depth),clamp(uCausMode,0.,1.));
  return m*exp(-max(depth,0.)*.26)*uCausStrength;
}
`+shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n'
      +'if(uPalette>.5){float ramp=clamp(diffuseColor.r,0.,1.);\n'
      +' vec3 cSand=vec3(.95,.87,.66),cMid=vec3(.78,.76,.58),cDeep=vec3(.34,.45,.46);\n'
      +' diffuseColor.rgb=ramp<.5?mix(cSand,cMid,ramp*2.):mix(cMid,cDeep,(ramp-.5)*2.);}\n'
      +'float depthFade=smoothstep(1.85,2.50,vDepth);\n'
      +'diffuseColor.rgb*=1.-.34*depthFade*uDepthMix;\n'+'float caus=causAll(vWorldXZ,vDepth);\n'+'diffuseColor.rgb+=vec3(.58,.78,.72)*caus;');
  };
  material.needsUpdate=true;
  return material;
}
function merge(parts,material,parent,cast=false){
  const positions=[],normals=[],colors=[],depths=[],v=new THREE.Vector3();
  for(const {geo,matrix,color} of parts){
    const g=geo.index?geo.toNonIndexed():geo,p=g.attributes.position,n=g.attributes.normal,nm=new THREE.Matrix3().getNormalMatrix(matrix);
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
      depths.push(water.position.y-floorY(v.x,v.z));
      v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();normals.push(v.x,v.y,v.z);
      colors.push(color.r,color.g,color.b);
    }
    if(g!==geo)g.dispose();
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('aDepth',new THREE.Float32BufferAttribute(depths,1));
  geometry.computeBoundingSphere();
  const result=new THREE.Mesh(geometry,depthTint(material));result.castShadow=cast;result.receiveShadow=false;parent.add(result);return result;
}
function scaleMatrix(x,y,z,rx,ry,rz,sx,sy,sz){
  return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
}
const reefLayer=new THREE.Group();reefLayer.name='seabed';scene.add(reefLayer);

// 1. Sand floor: pale lagoon shelf near the island, cooler mineral sand in the deep.
const shallowSand=new THREE.Color('#ecd7ab'),deepSand=new THREE.Color('#8c8577'),mottleTint=new THREE.Color('#7d8776');
const floorGeometry=new THREE.PlaneGeometry(28,28,112,112);floorGeometry.rotateX(-Math.PI/2);
{
  const position=floorGeometry.attributes.position,color=new THREE.Color(),colors=new Float32Array(position.count*3),depths=new Float32Array(position.count);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i),deep=THREE.MathUtils.smoothstep(Math.hypot(x,z),SHORE,DEEP);
    position.setY(i,floorY(x,z));
    depths[i]=water.position.y-floorY(x,z);
    const mottle=fbm(x*.62+3,z*.58+5),patch=fbm(x*.22+40,z*.26+9);
    color.copy(shallowSand).lerp(deepSand,Math.min(1,deep*1.12));
    color.lerp(mottleTint,mottle*.22*deep+patch*.10);
    color.lerp(new THREE.Color('#f2e3b8'),Math.max(0,mottle-.62)*.9*(1-deep)*1.4);
    colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  floorGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  floorGeometry.setAttribute('aDepth',new THREE.BufferAttribute(depths,1));
  floorGeometry.computeVertexNormals();
}
const seabed=new THREE.Mesh(floorGeometry,depthTint(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,emissive:new THREE.Color('#0d3a3c'),emissiveIntensity:.55}),true));
seabed.castShadow=false;seabed.receiveShadow=false;reefLayer.add(seabed);

/* Depth colour map: a painted texture that carries the shallow-to-deep colour change, so the
   sea floor reads as sand in the lagoon and as cold deep bed out at the rim. Baked from the real
   floorY() profile plus noise, one texel per world step. */
function createDepthTexture(size=512){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),data=image.data;
  const shallow=new THREE.Color('#f2ddb2'),mid=new THREE.Color('#c9c19a'),deep=new THREE.Color('#7c8f8d'),tint=new THREE.Color();
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const x=(i/size-.5)*28,z=(.5-j/size)*28;
    const depth=water.position.y-floorY(x,z),d=THREE.MathUtils.clamp((depth-2.0)/.55,0,1);
    const mottle=fbm(x*.7+13,z*.66+21),patch=fbm(x*.25+61,z*.29+7);
    tint.copy(shallow).lerp(mid,THREE.MathUtils.smoothstep(d,0,.55)).lerp(deep,THREE.MathUtils.smoothstep(d,.45,1));
    tint.lerp(new THREE.Color('#ffffff'),Math.max(0,mottle-.58)*.55*(1-d));
    tint.multiplyScalar(.93+mottle*.13+(patch-.5)*.07);
    // gentle sand ripples, fading out as it gets deep
    tint.multiplyScalar(1+.045*Math.sin(x*1.7+z*.9+mottle*3.)*(1-d));
    const p=(j*size+i)*4;data[p]=tint.r*255;data[p+1]=tint.g*255;data[p+2]=tint.b*255;data[p+3]=255;
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return texture;
}
seabed.material.map=createDepthTexture();
// The floor now takes its colour from that texture; the vertex colours only add mottling.
{
  const color=floorGeometry.attributes.color,floorPos=floorGeometry.attributes.position;
  for(let i=0;i<color.count;i++){const v=.90+fbm(color.count?i*.017:0,i*.031)*.20;
    // 岛边浅滩的绿调：原来来自那张悬空的 shoal 圆片，现在按地形烘进顶点色（顶点色是相乘，只做色偏）。
    const shallow=1-THREE.MathUtils.smoothstep(Math.hypot(floorPos.getX(i),floorPos.getZ(i)),SHORE,SHORE+3);
    color.setXYZ(i,v*(1-.12*shallow),v*(1+.07*shallow),v*(1-.03*shallow))}
  color.needsUpdate=true;
}
seabed.material.color.set('#ffffff');seabed.material.needsUpdate=true;

/* Water skin: a separate textured layer riding on the surface. The texture supplies the painted
   water pattern (light and dark lanes, drifting), while the shader tints it by depth and ramps
   its alpha up as the water gets deeper — so it reads as water in its own right and covers the
   interior sea-floor lines that would otherwise show through the far, deep side of the block. */
function createWaterSkinTexture(size=512){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e8f6f6';ctx.fillRect(0,0,size,size);
  for(let i=0;i<220;i++){
    const x=rnd()*size,y=rnd()*size,r=(10+rnd()*70)*size/512;
    const light=rnd()>.42;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,light?'rgba(255,255,255,.32)':'rgba(150,205,208,.26)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.lineCap='round';
  for(let i=0;i<110;i++){
    const x=rnd()*size,y=rnd()*size,len=30+rnd()*180,amp=4+rnd()*16;
    ctx.strokeStyle=rnd()>.5?'rgba(255,255,255,.30)':'rgba(158,210,212,.24)';
    ctx.lineWidth=1+rnd()*7;
    ctx.beginPath();ctx.moveTo(x,y);
    for(let t=0;t<1;t+=.25)ctx.lineTo(x+t*len,y+Math.sin(t*4+i)*amp);
    ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1.7,1.7);
  texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return texture;
}
const skinMix=window.waterDepth?window.waterDepth.uniform:{value:.65};
const waterSkinMaterial=new THREE.MeshStandardMaterial({map:createWaterSkinTexture(),color:'#ffffff',roughness:.40,metalness:0,transparent:true,opacity:.42,depthWrite:false});
waterSkinMaterial.onBeforeCompile=shader=>{
  shader.uniforms.uDepthMix=skinMix;
  shader.vertexShader='attribute float aDepth;varying float vBathy;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBathy=aDepth;');
  shader.fragmentShader='uniform float uDepthMix;varying float vBathy;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat skinDepth=clamp(vBathy,0.,1.)*uDepthMix;\ndiffuseColor.rgb*=mix(vec3(.88,1.06,1.06),vec3(.05,.34,.40),skinDepth);\ndiffuseColor.a*=mix(.20,1.00,skinDepth);');
};
const waterSkin=new THREE.Mesh(water.geometry,waterSkinMaterial);
waterSkin.position.copy(water.position);waterSkin.position.y+=.014;
waterSkin.renderOrder=3;waterSkin.castShadow=false;waterSkin.receiveShadow=false;
scene.add(waterSkin);

/* Swap in the textures painted in Photoshop (assets/water-skin.png, assets/seabed-depth.png).
   The canvas versions above stay as the fallback if the files are missing, so the page still
   runs standalone. The depth PNG is a grey ramp: 0 = shallow lagoon, 1 = deep bed, and uPalette
   turns on the sand -> deep colour mapping in the shader. */
{
  const loader=new THREE.TextureLoader();
  loader.load('assets/water-skin.png',texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
    texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
    waterSkinMaterial.map=texture;
    waterSkinMaterial.userData.source='photoshop';
    waterSkinMaterial.needsUpdate=true;
  });
  loader.load('assets/seabed-depth.png',texture=>{
    texture.colorSpace=THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
    texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
    seabed.material.map=texture;
    if(seabed.material.userData.paletteUniform)seabed.material.userData.paletteUniform.value=1;
    seabed.material.userData.source='photoshop';
    seabed.material.needsUpdate=true;
  });
}

// Real-ocean depth cue: hand the water surface a per-vertex 0..1 bathymetry reading, so the
// shader can make shallow water see-through and deep water dense and dark. 0 = shallowest.
const waterDepthRange={min:0,max:1};
{
  const position=water.geometry.attributes.position,count=position.count,raw=new Float32Array(count);
  let min=Infinity,max=-Infinity;
  for(let i=0;i<count;i++){
    const d=water.position.y-floorY(position.getX(i),position.getZ(i));
    raw[i]=d;min=Math.min(min,d);max=Math.max(max,d);
  }
  const span=Math.max(.001,max-min),normalised=new Float32Array(count);
  for(let i=0;i<count;i++)normalised[i]=(raw[i]-min)/span;
  water.geometry.setAttribute('aDepth',new THREE.BufferAttribute(normalised,1));
  waterDepthRange.min=min;waterDepthRange.max=max;
}

// Cool blue-grey stone reads through the water tint far better than warm brown.
const stone=['#c3ccd2','#93a0a9','#74828c','#dbe2e6'].map(c=>new THREE.Color(c));
const coralBright=['#ff8fb0','#ff7a59','#4fd8e8','#b48cf0','#ffd166','#7fe0c0'].map(c=>new THREE.Color(c));

// 2. Reef formations: a wide base blob on the floor plus smaller caps on top, so every mound is
//    anchored to the sand and no silhouette rises into the pet's swim layer.
const rockParts=[];
for(let i=0;i<11;i++){
  const angle=i*2.399+rnd()*.7,radius=7.0+(i%5)*1.5+rnd()*1.3,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius;
  const base=floorY(cx,cz),height=.50+rnd()*.42;
  const baseScaleX=height*(1.15+rnd()*.85),baseScaleY=height*.62,baseScaleZ=height*(1.15+rnd()*.85);
  rockParts.push({geo:new THREE.DodecahedronGeometry(1,0),color:stone[1+i%3],
    matrix:scaleMatrix(cx,base+baseScaleY*.82,cz,rnd()*.4,rnd()*3,rnd()*.4,baseScaleX,baseScaleY,baseScaleZ)});
  const caps=3+Math.floor(rnd()*4);
  for(let k=0;k<caps;k++){
    const s=height*(.24+rnd()*.26),ox=(rnd()-.5)*baseScaleX*1.2,oz=(rnd()-.5)*baseScaleZ*1.2;
    rockParts.push({geo:new THREE.DodecahedronGeometry(1,0),color:stone[(i+k)%stone.length],
      matrix:scaleMatrix(cx+ox,base+height*(.5+rnd()*.5)-s*.2,cz+oz,rnd()*3,rnd()*3,rnd()*3,s*(1.2+rnd()*.5),s*.85,s*(1.2+rnd()*.5))});
  }
}
merge(rockParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true}),reefLayer);

// 3. Pebbles and shell grit stop the floor from reading as a flat plane.
const gritParts=[];
for(let i=0;i<70;i++){
  const angle=rnd()*Math.PI*2,radius=6.6+rnd()*6.6,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,s=.05+rnd()*.09;
  gritParts.push({geo:new THREE.DodecahedronGeometry(1,0),color:stone[i%stone.length],
    matrix:scaleMatrix(x,floorY(x,z)+s*.4,z,rnd()*3,rnd()*3,rnd()*3,s*1.7,s*.8,s*1.4)});
}
merge(gritParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true}),reefLayer);

// 4. Kelp beds: tapered strands that stay under the surface and clear of the pet's swim layer.
const kelpParts=[],kelpColors=['#2f8a58','#46a86a','#237048','#5fbf7c'].map(c=>new THREE.Color(c));
for(let i=0;i<24;i++){
  const angle=i*1.71+rnd()*.8,radius=6.8+rnd()*5.9,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius,base=floorY(cx,cz);
  const strands=5+Math.floor(rnd()*6);
  for(let k=0;k<strands;k++){
    const h=.55+rnd()*.65,tilt=(rnd()-.5)*.5,ox=(rnd()-.5)*.85,oz=(rnd()-.5)*.85;
    kelpParts.push({geo:new THREE.CylinderGeometry(.012,.045,h,5),color:kelpColors[k%kelpColors.length],
      matrix:scaleMatrix(cx+ox,base+h*.5,cz+oz,tilt*.6,rnd()*3,tilt,1,1,1)});
  }
}
merge(kelpParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide}),reefLayer);

// 5. Sea grass: short bright sprigs scattered over the shelf, like the reference's sand tufts.
const grassParts=[],grassColors=['#7ec46a','#9ad46f','#5aa85a'].map(c=>new THREE.Color(c));
for(let i=0;i<54;i++){
  const angle=rnd()*Math.PI*2,radius=6.3+rnd()*6.0,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,base=floorY(x,z);
  const blades=3+Math.floor(rnd()*3);
  for(let k=0;k<blades;k++){
    const h=.20+rnd()*.26,a=rnd()*Math.PI*2,lean=.30+rnd()*.35;
    grassParts.push({geo:new THREE.ConeGeometry(.035,h,4),color:grassColors[i%grassColors.length],
      matrix:scaleMatrix(x+Math.cos(a)*.05,base+h*.45,z+Math.sin(a)*.05,lean*Math.cos(a),a,lean*Math.sin(a),1,1,1)});
  }
}
merge(grassParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true}),reefLayer);

// 6. Branching corals: clusters of tapered tubes with knobs, in the reference's vivid palette.
const branchParts=[];
for(let i=0;i<24;i++){
  const angle=i*2.11+rnd()*.9,radius=6.4+rnd()*5.9,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius,base=floorY(cx,cz);
  const color=coralBright[i%coralBright.length],branches=4+Math.floor(rnd()*5);
  for(let k=0;k<branches;k++){
    const h=.34+rnd()*.70,tilt=(rnd()-.5)*.9,ox=(rnd()-.5)*.85,oz=(rnd()-.5)*.85;
    branchParts.push({geo:new THREE.CylinderGeometry(.036,.082,h,6),color,
      matrix:scaleMatrix(cx+ox,base+h*.5,cz+oz,tilt*.5,rnd()*3,tilt,1,1,1)});
    if(k%2===0)branchParts.push({geo:new THREE.SphereGeometry(1,8,6),color,
      matrix:scaleMatrix(cx+ox+tilt*.2,base+h,cz+oz,0,0,0,.10,.085,.10)});
  }
}
merge(branchParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,flatShading:true}),reefLayer);

// 7. Anemones and tube corals: a rosette of short tubes fanning up from one spot.
const fanParts=[],fanColors=['#ff9ec4','#57e0ea','#a98cf0','#ffb46b'].map(c=>new THREE.Color(c));
for(let i=0;i<18;i++){
  const angle=i*1.97+rnd()*.8,radius=6.5+rnd()*5.7,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius,base=floorY(cx,cz);
  const color=fanColors[i%fanColors.length],tubes=7+Math.floor(rnd()*6);
  for(let k=0;k<tubes;k++){
    const a=k/tubes*Math.PI*2+rnd()*.2,h=.16+rnd()*.30,lean=.35+rnd()*.5;
    fanParts.push({geo:new THREE.CylinderGeometry(.030,.026,h,5),color,
      matrix:scaleMatrix(cx+Math.cos(a)*.09,base+h*.55,cz+Math.sin(a)*.09,lean*Math.sin(a),a,lean*Math.cos(a),1,1,1)});
  }
  fanParts.push({geo:new THREE.SphereGeometry(1,8,6),color,
    matrix:scaleMatrix(cx,base+.05,cz,0,0,0,.16,.09,.16)});
}
merge(fanParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,flatShading:true,side:THREE.DoubleSide}),reefLayer);

// 8. Plate corals: flat discs on short stalks, breaking up the vertical rhythm.
const plateParts=[],plateColors=['#e79a7a','#c9a0dd','#e8c069'].map(c=>new THREE.Color(c));
for(let i=0;i<12;i++){
  const angle=i*2.71+rnd()*.9,radius=6.8+rnd()*5.4,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius,base=floorY(cx,cz);
  const s=.30+rnd()*.22,tilt=(rnd()-.5)*.5;
  plateParts.push({geo:new THREE.CylinderGeometry(.035,.05,s*.7,5),color:plateColors[i%plateColors.length],
    matrix:scaleMatrix(cx,base+s*.35,cz,0,rnd()*3,0,1,1,1)});
  plateParts.push({geo:new THREE.SphereGeometry(1,10,6),color:plateColors[i%plateColors.length],
    matrix:scaleMatrix(cx,base+s*.75,cz,tilt,rnd()*3,tilt*.6,s,s*.22,s)});
}
merge(plateParts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,flatShading:true,side:THREE.DoubleSide}),reefLayer);

// 9. Bubble vents: one instanced mesh, bubbles rise from fixed spots on the sand and pop at the
//    surface. Instanced so the whole colony costs a single draw call.
const vents=[];
for(let i=0;i<14;i++){
  const angle=i*2.39+rnd()*.8,radius=6.6+rnd()*5.6,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  vents.push(new THREE.Vector3(x,floorY(x,z),z));
}
const bubbleCount=90;
const bubbles=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),
  new THREE.MeshPhysicalMaterial({color:'#eafffb',transparent:true,opacity:.34,roughness:.08,metalness:0,depthWrite:false}),bubbleCount);
bubbles.frustumCulled=false;bubbles.renderOrder=4;reefLayer.add(bubbles);
const bubbleState=[];
for(let i=0;i<bubbleCount;i++){
  const vent=vents[i%vents.length];
  bubbleState.push({vent,offset:rnd()*2.4,size:.030+rnd()*.045,speed:.32+rnd()*.30,phase:rnd()*Math.PI*2});
}
const bubbleDummy=new THREE.Object3D();
function updateBubbles(t){
  for(let i=0;i<bubbleCount;i++){
    const b=bubbleState[i];
    const span=water.position.y-b.vent.y;                     // floor to surface
    const travel=(t*b.speed+b.offset)%1;                      // 0..1 loop
    const y=b.vent.y+travel*span;
    const wobble=Math.sin(t*1.7+b.phase)*.05*(1-travel);
    bubbleDummy.position.set(b.vent.x+wobble,y,b.vent.z+Math.cos(t*1.3+b.phase)*.05*(1-travel));
    const shrink=Math.sin(Math.PI*Math.min(1,travel*1.05))*0.75+0.25;
    bubbleDummy.scale.setScalar(b.size*shrink);
    bubbleDummy.updateMatrix();bubbles.setMatrixAt(i,bubbleDummy.matrix);
  }
  bubbles.instanceMatrix.needsUpdate=true;
}
updateBubbles(0);

window.seabedLife={floorY,update:t=>{CAUS.time.value=t;updateBubbles(t)},get stats(){return {floor:FLOOR,shore:SHORE,depth:DEEP,meshes:reefLayer.children.length,bubbles:bubbleCount,waterDepth:waterDepthRange}}};
})();

// ── 3.49 焦散实时面板（右侧「小岛实验室」底部）────────────────────────────
// 沿用火山烟面板的约定：id 全部 caus- 前缀（别跟 window 同名 API 撞）、
// 值内联显示在标题右侧、内容区限高可滚、底部「恢复默认」。
(function causPanel(){
  const host=document.querySelector('#lab-content');
  if(!host||document.querySelector('#caus-box'))return;
  let CAUS_BASE=null,_causTimer=0;
  const pushCaus=()=>{const v={};for(const k in DEF)v[k]=window.seabedCaustics[k].value;
    const b={caus:v};if(CAUS_BASE)b.defCaus=CAUS_BASE;
    fetch('/api/tuning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).catch(()=>{})};
  const queueSave=()=>{clearTimeout(_causTimer);_causTimer=setTimeout(pushCaus,600)};
  const DEF={};for(const k in window.seabedCaustics){if(k!=='time')DEF[k]=window.seabedCaustics[k].value}
  
  for(const k in DEF){if(window.seabedCaustics[k])window.seabedCaustics[k].value=DEF[k]}
  /* 静态托管（GitHub Pages）没有 /api/tuning：回退读同目录 tuning.json。 */
  const isLocal=/^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);(async()=>{let j=null;for(const u of (isLocal?['/api/tuning','tuning.json']:['tuning.json'])){try{const r=await fetch(u,{cache:'no-store'});if(r.ok){j=await r.json();break}}catch(e){}}if(!j)return;
    if(j.caus)for(const k in j.caus){if(window.seabedCaustics[k])window.seabedCaustics[k].value=j.caus[k]}
    CAUS_BASE=j.defCaus||null;
    for(const k in rows){rows[k].inp.value=String(window.seabedCaustics[k].value);rows[k].show()}
  })();   // 自动收录所有滑杆可调项（含后加的密度/大小），time 不算
  const defs=[
    ['strength','焦散强度',0,2,.05,2,''],
    ['sharp','锐度',.4,4,.05,2,''],
    ['scale','尺度',.2,3,.05,2,'×'],
    ['density','密度',.3,3,.05,2,'×'],
    ['blob','大小',.3,2.5,.05,2,'×'],
    ['thin','线条粗细',.5,3,.05,2,'×'],
    ['depth','深度耦合',.2,2,.05,2,''],
    ['mode','模式',0,1,1,0,''],
  ];
  const box=document.createElement('details');box.id='caus-box';
  const sum=document.createElement('summary');
  sum.textContent='水底焦散（实时调参）';sum.style.cssText='cursor:pointer;margin-top:14px;font-weight:600;letter-spacing:.02em';
  box.appendChild(sum);
  const body=document.createElement('div');body.style.maxHeight='46vh';body.style.overflowY='auto';box.appendChild(body);
  const rows={};
  for(const [key,label,min,max,step,digits,suffix] of defs){
    const lab=document.createElement('label');
    lab.style.cssText='display:block;margin:10px 0 2px;font-size:11px;letter-spacing:.06em;color:#4d5559';
    const out=document.createElement('span');
    const inp=document.createElement('input');
    inp.type='range';inp.id='caus-'+key;inp.min=min;inp.max=max;inp.step=step;
    inp.setAttribute('aria-label','水底焦散-'+label);
    inp.style.cssText='width:100%;margin-top:6px';
    const show=()=>{const v=+inp.value;out.textContent=(key==='mode'?(v>=.5?'折射':'网格'):(digits?v.toFixed(digits):v+'')+suffix)};
    inp.value=String(window.seabedCaustics[key].value);show();
    out.textContent=out.textContent; // 占位
    lab.appendChild(document.createTextNode(label+' '));lab.appendChild(out);
    inp.addEventListener('input',()=>{queueSave();window.seabedCaustics[key].value=key==='mode'?(+inp.value>=.5?1:0):+inp.value;show()});
    lab.appendChild(inp);body.appendChild(lab);rows[key]={inp,show};
  }
  const save=document.createElement('button');save.id='caus-save';save.type='button';save.textContent='设为默认';
  save.style.cssText='margin:12px 6px 0 0;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.16);background:#fff;cursor:pointer;font-size:11px';
  save.onclick=()=>{CAUS_BASE={};for(const k in DEF)CAUS_BASE[k]=window.seabedCaustics[k].value;pushCaus();
    save.textContent='已设为默认 ✓';setTimeout(()=>{save.textContent='设为默认'},1200)};
  const rst=document.createElement('button');rst.id='caus-reset';rst.type='button';rst.textContent='恢复默认（回基准）';
  rst.style.cssText='margin:12px 0 6px;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.16);background:#fff;cursor:pointer;font-size:11px';
  rst.onclick=()=>{const t=CAUS_BASE||DEF;for(const k in t){if(window.seabedCaustics[k])window.seabedCaustics[k].value=t[k]}
    for(const k in rows){rows[k].inp.value=String(window.seabedCaustics[k].value);rows[k].show()}pushCaus()};
  const btnRow=document.createElement('div');btnRow.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 6px';
  btnRow.appendChild(save);btnRow.appendChild(rst);body.appendChild(btnRow);
  host.appendChild(box);
})();
