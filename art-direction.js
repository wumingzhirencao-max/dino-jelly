/* Final miniature art setup. Geometry and controls share one configuration. */
(() => {
const ART={camera:{theta:.71,phi:1.16,distance:61},day:{sun:3.15,fill:.58,exposure:.98,bounce:.85},night:{sun:.6,fill:.27,exposure:.78,bounce:.1}};
renderer.toneMapping=THREE.ACESFilmicToneMapping;sun.color.set('#fff1d8');sun.position.set(-16,26,-12);sun.shadow.normalBias=.035;
scene.background.set('#e8e5df');floor.material.color.set('#dcd8cc');floor.material.roughness=1;
function resetArtCamera(){theta=ART.camera.theta;phi=ART.camera.phi;distance=ART.camera.distance}
// Sidebar/iframe panes are tall and narrow: a closer baseline keeps the diorama in frame.
if(document.body.classList.contains('embed'))ART.camera.distance=46;
resetArtCamera();
water.material.color.set('#06a8bf');water.material.roughness=.13;water.material.metalness=0;water.material.opacity=.9;water.material.envMapIntensity=.72;water.material.clearcoat=.35;water.material.clearcoatRoughness=.2;water.material.depthWrite=true;water.renderOrder=2;
waterBody.material.color.set('#16bdc9');waterBody.material.opacity=.5;waterBody.material.roughness=.10;waterBody.material.envMapIntensity=.48;waterBody.material.side=THREE.FrontSide;waterBody.material.depthWrite=false;waterBody.renderOrder=1;
function injectShaderChunk(source,marker,code){if(!source.includes(marker))throw Error('Missing water shader chunk: '+marker);return source.replace(marker,code)}
const depthMix={value:.8};
// 3.41 岛缘软岸线（照参考片 05/12）在 art-direction.js 里也要接一遍：它后跑、会覆盖 island.js 的 onBeforeCompile，
// 两份必须同时改（本项目硬约束）。uniform 直接引 island.js 暴露的状态对象，**不复制**——
// 烘好之前 shSeam.value 还是 0，两份 shader 就都自动走旧的硬岸线，不会出现"两份不一致"。
const SH=window.islandShoreState||null;
const SH_EDGE=SH?SH.edge:{value:0},SH_FOAM=SH?SH.foam:{value:0},SH_SEAM=SH?SH.seam:{value:0},SH_TEX=SH?SH.tex:{value:null},SH_TIME=SH?SH.time:{value:0},SH_SPAN=SH?SH.span:24;
water.material.onBeforeCompile=shader=>{shader.uniforms.uTime=waterTime;shader.uniforms.uCrest=crestCenter;shader.uniforms.uDirection=crestDirection;shader.uniforms.uFoam=crestStrength;shader.uniforms.uDepthMix=depthMix;shader.uniforms.uShoreTex=SH_TEX;shader.uniforms.uShoreSeam=SH_SEAM;shader.uniforms.uShoreEdge=SH_EDGE;shader.uniforms.uShoreFoam=SH_FOAM;shader.uniforms.uShoreTime=SH_TIME;shader.uniforms.uShoreSpan=SH_SPAN;shader.vertexShader='varying vec3 vSea; attribute float aDepth; varying float vBathy; varying float vShore;\n'+shader.vertexShader;shader.vertexShader='uniform sampler2D uShoreTex; uniform float uShoreSeam; uniform float uShoreTime; uniform float uShoreSpan;\nfloat shoreHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat shoreNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(shoreHash(i),shoreHash(i+vec2(1,0)),f.x),mix(shoreHash(i+vec2(0,1)),shoreHash(i+vec2(1,1)),f.x),f.y); }\nfloat shoreDistAt(vec2 p){\n  if(uShoreSeam<.5||uShoreSpan<.01) return length(p)-6.1;\n  vec2 uv=p/uShoreSpan+.5; uv.y+=sin(uShoreTime*.45+p.x*.9)*.004;\n  float wob=(shoreNoise(p*1.15)-.5)*.34+(shoreNoise(p*3.1+13.7)-.5)*.12;\n  return texture2D(uShoreTex,uv).r*12.+wob;\n}\n'+shader.vertexShader;shader.vertexShader=injectShaderChunk(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvSea = position;\nvBathy = aDepth;\nvShore = shoreDistAt(position.xz);');shader.fragmentShader='uniform float uTime; uniform vec2 uCrest; uniform vec2 uDirection; uniform float uFoam; uniform float uDepthMix; uniform float uShoreSeam; uniform float uShoreEdge; uniform float uShoreFoam; uniform float uShoreTime; varying vec3 vSea; varying float vBathy; varying float vShore;\nfloat foamHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y); }\n'+shader.fragmentShader;shader.fragmentShader=injectShaderChunk(shader.fragmentShader,'#include <color_fragment>',`#include <color_fragment>
float a=sin(vSea.x*7.7+sin(vSea.z*2.5+uTime*.55)*1.6+uTime*.4);
float b=sin(vSea.z*8.1+sin(vSea.x*2.9-uTime*.4)*1.6-uTime*.3);
float caustic=pow(max(0.,1.-abs(a+b)*.75),12.);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb+vec3(.38,.48,.4),caustic*.012);
float shelf=1.-smoothstep(0.,24.,length(vSea.xz));
float swell=sin(vSea.x*.83+vSea.z*.57+uTime*.65)*sin(vSea.z*.72-vSea.x*.32-uTime*.4);
// Wave shading comes from the displaced geometry and lighting, not painted dark bands.
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.47,.40),shelf*.07);
// Depth: a real ocean is see-through where it is shallow and dense and dark where it is deep.
// The bathymetry reading comes from seabed.js as a per-vertex 0..1 attribute, so the lagoon
// near the island stays clear while the deep water out at the rim reads heavy.
float deep=clamp(vBathy,0.,1.)*uDepthMix;
// 3.47 果冻感（照参考图 A）：深处更饱和、更"稠"，浅处保持通透——靠对比而不是靠糊一层亮雾。
diffuseColor.rgb*=mix(1.16,.52,deep);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.02,.42,.46),deep*.30);
diffuseColor.a*=mix(.58,1.42,deep);

// 3.41 岛缘：岸线从贴图来（见 island.js 的烘焙），旧的圆环 shoreDistance 只在没烘好时兜底。
float dShore=uShoreSeam>.5?vShore:length(vSea.xz)-6.1;   // >0 水侧, <0 陆侧(米)
float shTide=sin(uShoreTime*.5+vSea.x+vSea.z*.7)*.055;
float wetBand=1.-smoothstep(.05,uShoreEdge,dShore*(1.+3.*dShore/uShoreEdge));
float foamLine=(1.-smoothstep(.05,.09,abs(dShore+.04+shTide)))*uShoreFoam;
float shoreFoam=foamLine*(.55+.45*foamNoise(vec2(dShore*7.+uShoreTime*.25,vSea.x*1.6+vSea.z*1.1)));
diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb,vec3(.40,.57,.53),.24),wetBand*uShoreSeam);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.99,1.,1.),clamp(shoreFoam,0.,1.)*.82);
diffuseColor.a=mix(diffuseColor.a,.99,clamp(shoreFoam,0.,1.)*.85);
float shoreNoise=foamNoise(vSea.xz*3.+uTime*.1);
float wash=sin(dShore*9.-uTime*1.6+shoreNoise*3.);
float surf=pow(max(0.,wash),8.)*(1.-smoothstep(-.5,1.0,dShore))*smoothstep(-.9,-.6,dShore);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.97,.92),surf*.29);
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
// 3.40b 与 island.js 同一处改动：拖拽点那片"海浪贴图"＝波峰白沫（crest 项）→ 关掉，
// 只留波面变形与岸边拍岸白沫（下面 shoreDistance 的 surf）。两份 shader 必须一起改，否则后写覆盖先写。
float froth=clamp((tail*smoothstep(.38,.72,strands)*(.35+lace*.65))*uFoam,0.,1.);
float shoreMask=uShoreSeam>.5?smoothstep(-.8,.4,dShore):smoothstep(6.1,7.3,length(vSea.xz));
float edgeMask=smoothstep(0.,2.,min(14.-abs(vSea.x),14.-abs(vSea.z)));
froth*=shoreMask*edgeMask;
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.96,.985,.98),froth);
diffuseColor.a=mix(diffuseColor.a,.97,froth);

`);
// The mesh normals are rebuilt from the displaced surface in island.js.
// Let MeshPhysicalMaterial evaluate GGX / Fresnel using those same normals.
// No screen-space normal offsets, painted glint curves or dark ribbon masks.
shader.fragmentShader=injectShaderChunk(shader.fragmentShader,'#include <opaque_fragment>',`
      outgoingLight=mix(outgoingLight,vec3(.86,.96,.91),froth*.8);
#include <opaque_fragment>
`);};

// Depth gradient follows the actual deforming top, including tide and pulling.
// depthMix (declared with the surface shader above) is the user-facing strength: 0 flattens the
// water to one tone, 1 is the full top-to-bottom gradient, and the same handle drives the
// seabed darkening in seabed.js.
const volumeBottom={value:new THREE.Color('#054b58')},volumeTop={value:new THREE.Color('#4fd2de')};
waterBody.material.onBeforeCompile=shader=>{
 shader.uniforms.uVolumeBottom=volumeBottom;shader.uniforms.uVolumeTop=volumeTop;shader.uniforms.uDepthMix=depthMix;
 shader.vertexShader='varying float vWaterDepth;\n'+shader.vertexShader;
 shader.vertexShader=injectShaderChunk(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvWaterDepth=clamp((position.y+1.4)/2.55,0.,1.);');
 shader.fragmentShader='varying float vWaterDepth; uniform vec3 uVolumeBottom; uniform vec3 uVolumeTop; uniform float uDepthMix;\n'+shader.fragmentShader;
 shader.fragmentShader=injectShaderChunk(shader.fragmentShader,'#include <color_fragment>','#include <color_fragment>\nfloat depthRamp=mix(.6,smoothstep(0.,1.,vWaterDepth),uDepthMix);\ndiffuseColor.rgb*=mix(uVolumeBottom,uVolumeTop,depthRamp);');
};
window.waterDepth={uniform:depthMix,get value(){return depthMix.value}};
// 水深 slider: 0 flattens the water to a single tone, 100 is the full top-to-bottom gradient.
const depthSlider=document.querySelector('#depth');
if(depthSlider)depthSlider.oninput=e=>{depthMix.value=e.target.value/100};
water.material.needsUpdate=true;waterBody.material.needsUpdate=true;foam.visible=false;
document.querySelectorAll('[data-color]').forEach(button=>{const selectColor=button.onclick;button.onclick=()=>{selectColor();waterBody.material.color.set('#ffffff');if(button.dataset.color==='#29bcca'){volumeBottom.value.set('#054b58');volumeTop.value.set('#4fd2de')}else{volumeBottom.value.set(button.dataset.color).multiplyScalar(.5);volumeTop.value.set(button.dataset.color).lerp(new THREE.Color('#ffffff'),.18)}}});
  // Broad studio sky reflections give the ocean a reflective surface and clear edges.
  const skyScene=new THREE.Scene();skyScene.background=new THREE.Color('#b4dbde');
  const skyShell=new THREE.Mesh(new THREE.SphereGeometry(60,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,vertexShader:'varying vec3 skyP; void main(){skyP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 skyP;void main(){vec3 p=normalize(skyP);vec3 c=mix(vec3(.18,.40,.43),vec3(.90,.94,.92),smoothstep(-.2,.65,p.y));float cloud=sin(p.x*15.+p.z*7.)*sin(p.z*19.-p.x*4.);c+=vec3(.17)*smoothstep(.2,.8,cloud)*smoothstep(.0,.3,p.y);c+=vec3(1.5)*pow(max(0.,dot(p,normalize(vec3(-.6,1.,-.3)))),35.);gl_FragColor=vec4(c,1.);}'}));skyScene.add(skyShell);
  const pmrem=new THREE.PMREMGenerator(renderer);const skyMap=pmrem.fromScene(skyScene,.04);scene.environment=skyMap.texture;pmrem.dispose();skyShell.geometry.dispose();skyShell.material.dispose();
  // Continuous irregular sand slope replaces the stacked cylindrical disk.
  island.children[0].visible=false;island.children[1].visible=false;
  for(const child of island.children){if(child.isMesh&&child.geometry.type==='ConeGeometry')child.visible=false;if(child.isMesh&&child.geometry.type==='SphereGeometry'&&Math.hypot(child.position.x,child.position.z)>9)child.visible=false;}
  // 岛基：beach 用 u=r/border 参数化（u=1 正好是沙滩外缘）。除了岛体本身，再往外多长两圈
  // （u 到 1.0909），让这片沙坡**继续往下扎进海床**——岛基与海床因此是同一片地形，
  // 水下平视看不到"岛底悬空"和"围一圈平台/领圈"（海床那边不做任何抬高，见 docs 3.19）。
  const beachGeo=new THREE.BufferGeometry(),beachP=[],beachC=[],beachUV=[],beachI=[],rings=22,skirt=2,sectors=128,shoalTone=new THREE.Color('#cfe6c6');
  for(let r=0;r<=rings+skirt;r++)for(let i=0;i<=sectors;i++){
    const a=i/sectors*Math.PI*2,u=r/rings,border=10.3+.45*Math.sin(a*3+.8)+.22*Math.sin(a*7);
    // 3.46 参考图 2：把"斜坡"改成"沙饼"——内部接近水平（plateau），到 u≈.82 之后才圆肩下坠，
    // 边缘再薄一点、然后由裙脚扎进海床。改动的只有这个 y(u) 剖面，拓扑/绕序/UV 都不动。
    const pad=Math.min(1,u),shoulder=THREE.MathUtils.smoothstep(u,.82,.97);
    const radius=u*border,y=1.46-.025*pad-shoulder*.42-Math.max(0,u-.97)*3.4+.045*Math.sin(a*5+u*6)*u;
    beachP.push(Math.cos(a)*radius,y,Math.sin(a)*radius);beachUV.push(.5+Math.cos(a)*u*.5,.5+Math.sin(a)*u*.5);
    const grain=(Math.sin(a*37+u*61.3)*.5+Math.sin(a*89-u*23.7)*.5)*.5+.5;   // 颗粒感（砂粒明暗）
    const c=new THREE.Color().setRGB(.76+.14*(1-u),.61+.15*(1-u),.38+.17*(1-u)).multiplyScalar(.94+grain*.12);
    // 裙脚（u>1）把颜色并到海床浅滩的色调上，出岛缘不会出现一圈色差线。
    if(u>1)c.lerp(shoalTone,Math.min(1,(u-1)/.09));
    beachC.push(c.r,c.g,c.b);
    if(r<rings+skirt&&i<sectors){const k=r*(sectors+1)+i;beachI.push(k,k+1,k+sectors+1,k+1,k+sectors+2,k+sectors+1);}
  }
  beachGeo.setAttribute('position',new THREE.Float32BufferAttribute(beachP,3));beachGeo.setAttribute('color',new THREE.Float32BufferAttribute(beachC,3));beachGeo.setAttribute('uv',new THREE.Float32BufferAttribute(beachUV,2));beachGeo.setIndex(beachI);beachGeo.computeVertexNormals();
  const beachMaterial=new THREE.MeshStandardMaterial({color:'#fff0c5',vertexColors:true,roughness:.91,side:THREE.DoubleSide});mesh(beachGeo,beachMaterial,island).name='island-beach';
  // 给自检用：岛体沙坡的解析剖面（世界坐标）。edge=该方向的沙滩外缘半径，y(u)=高度，uMax=裙脚最外圈。
  window.islandBeach={edge:a=>(10.3+.45*Math.sin(a*3+.8)+.22*Math.sin(a*7))*.55,
    y:(u,a)=>(1.44-.08*u-Math.pow(u,7)*1.85+.07*Math.sin(a*5+u*6)*u)*.55,uMax:1+skirt/rings};
  // Fluted volcanic slopes, weathered ridges and a dark open crater.
  mountain.geometry.dispose();const mountainGeo=new THREE.BufferGeometry(),mp=[],mc=[],mu=[],mi=[],rows=22,cols=96;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const a=i/cols*Math.PI*2,u=j/rows;
    let radius=1.01+3.55*Math.pow(1-u,1.8);radius+=(Math.sin(a*9+.4)+.45*Math.sin(a*17))*.19*Math.sin(u*Math.PI);
    mp.push(Math.cos(a)*radius,-2.23+u*4.55+.07*Math.sin(a*7)*u,Math.sin(a)*radius);
    const ridge=(Math.sin(a*9+.4)+1)*.5;const c=new THREE.Color().lerpColors(new THREE.Color('#c9b9a8'),new THREE.Color('#ffffff'),ridge*.55+u*.12);
    if(u>.62&&u<.93){const moss=Math.max(0,Math.sin(a*4+u*4))*Math.sin((u-.62)/.31*Math.PI);c.lerp(new THREE.Color('#c2ceb7'),moss*.35)}mc.push(c.r,c.g,c.b);mu.push(i/cols*Math.max(1,2*Math.PI*radius/6),u);
    if(j<rows&&i<cols){const k=j*(cols+1)+i;mi.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2)}
  }
  mountainGeo.setAttribute('position',new THREE.Float32BufferAttribute(mp,3));mountainGeo.setAttribute('color',new THREE.Float32BufferAttribute(mc,3));mountainGeo.setAttribute('uv',new THREE.Float32BufferAttribute(mu,2));mountainGeo.setIndex(mi);mountainGeo.computeVertexNormals();mountain.geometry=mountainGeo;mountain.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,side:THREE.DoubleSide});
  const rockTexture=new THREE.TextureLoader().load('assets/volcanic-rock.webp');rockTexture.wrapS=rockTexture.wrapT=THREE.RepeatWrapping;rockTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();rockTexture.colorSpace=THREE.SRGBColorSpace;mountain.material.map=rockTexture;mountain.material.bumpMap=rockTexture;mountain.material.color.set('#ffffff');mountain.material.envMapIntensity=.5;mountain.material.bumpScale=.10;mountain.material.needsUpdate=true;
  rim.material=mat('#493b33');rim.geometry.dispose();rim.geometry=new THREE.TorusGeometry(1.03,.12,8,48);
  for(const child of volcano.children){if(child.geometry?.type==='CylinderGeometry'&&child!==mountain&&child.material===mats.lava)child.position.y=4.24;if(child.geometry?.type==='CylinderGeometry'&&child.material===mats.lava&&child.geometry.parameters.height>.2)child.visible=false;}
  const crater=mesh(new THREE.CylinderGeometry(1.02,.76,.38,48,1,true),mat('#362c27'),volcano,0,4.32,0);crater.material.side=THREE.DoubleSide;
  for(let i=0;i<6;i++){
    const a=i*2.37,points=[];for(let k=0;k<12;k++){const u=k/11,r=1.02+2.8*Math.pow(u,1.65);points.push(new THREE.Vector3(Math.cos(a+Math.sin(u*7+i)*.02)*r,4.45-u*3.5,Math.sin(a+Math.sin(u*7+i)*.02)*r));}
    const line=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.025+(i%2)*.012,5,false),mats.lava,volcano);line.castShadow=false;
  }
  // Sculpted curved trunks and individually tapered leaflets form airy palm crowns.
  island.children.filter(o=>o.type==='Group'&&o!==volcano&&!dinosaurs.some(d=>d.g===o)).forEach(o=>o.visible=false);
  const palmLeaf=new THREE.MeshStandardMaterial({color:'#3f7950',roughness:.74,side:THREE.DoubleSide});
  const leafLight=new THREE.MeshStandardMaterial({color:'#719157',roughness:.8,side:THREE.DoubleSide});
  function featherPalm(x,z,h,rotation){
    const group=new THREE.Group();group.position.set(x,1.35,z);group.rotation.y=rotation;island.add(group);
    const top=new THREE.Vector3(.65,h,.1),trunk=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.08,h*.35,0),new THREE.Vector3(.38,h*.7,0),top]);
    mesh(new THREE.TubeGeometry(trunk,18,.17,10,false),mats.bark,group);
    for(let k=1;k<13;k++){const p=trunk.getPoint(k/13),ring=mesh(new THREE.TorusGeometry(.175,.025,4,10),mat('#aa9170'),group,p.x,p.y,p.z);ring.rotation.x=Math.PI/2;}
    for(let j=0;j<9;j++){
      const a=j/9*Math.PI*2,len=2.5+(j%3)*.3;const curve=new THREE.QuadraticBezierCurve3(top,top.clone().add(new THREE.Vector3(Math.cos(a)*len*.55,1.1,Math.sin(a)*len*.55)),top.clone().add(new THREE.Vector3(Math.cos(a)*len,-.7-(j%2)*.35,Math.sin(a)*len)));
      mesh(new THREE.TubeGeometry(curve,15,.025,4,false),leafLight,group);
      for(let k=1;k<13;k++)for(const side of [-1,1]){
        const u=k/14,p=curve.getPoint(u),end=curve.getPoint(Math.min(.99,u+.13));const w=Math.sin(u*Math.PI)*.58;const tip=p.clone().add(new THREE.Vector3(-Math.sin(a)*w*side+Math.cos(a)*.28,-.10,Math.cos(a)*w*side+Math.sin(a)*.28));
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([...p.toArray(),...tip.toArray(),...end.toArray()],3));geo.computeVertexNormals();mesh(geo,j%3===0?leafLight:palmLeaf,group);
      }
    }
    for(let j=0;j<3;j++)ball(group,mats.bark,top.x+Math.cos(j*2.1)*.18,top.y-.15,top.z+Math.sin(j*2.1)*.18,.14,.18,.14);
  }
  [[5,-3,4.4,.3],[-5,0,3.8,2],[4,4,3.5,1],[-3,5,3.3,4]].forEach(p=>featherPalm(...p));
  // Low coastal vegetation and small beach boulders replace scattered spikes.
  for(let i=0;i<16;i++){
    const a=i*2.399,r=6.2+(i%4)*.55,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(z<-1&&x<2&&x>-6)continue;
    for(let j=0;j<6;j++){const ang=j*Math.PI/3;const leaf=ball(island,j%2?palmLeaf:leafLight,x+Math.cos(ang)*.28,1.58,z+Math.sin(ang)*.28,.48,.09,.18);leaf.rotation.y=-ang;leaf.rotation.z=.35;}
  }
  for(let i=0;i<17;i++){const a=i*2.4,r=9.3+.3*Math.sin(i*3);const b=mesh(new THREE.DodecahedronGeometry(.22+(i%4)*.08,1),mat(i%2?'#b2a38a':'#d0b991'),island,Math.cos(a)*r,.4,Math.sin(a)*r);b.scale.set(1,.6,.8);b.rotation.set(i,i*.3,i*.7)}
  // Smooth creature skins, darker dorsal patterning and soft cream undersides.
  dinosaurs.forEach(({g,type})=>{g.traverse(o=>{if(o.isMesh){o.material.flatShading=false;o.material.roughness=.62;o.material.needsUpdate=true}});if(type<2){const skin=g.children[0].material;for(let k=0;k<7;k++){const spot=ball(g,skin.clone(),-.72+k*.21,1.64-Math.pow(k/7-.4,2)*.2,0,.09,.028,.26);spot.material.color.multiplyScalar(.7);spot.userData.dino=type;pickables.push(spot)}}});
  // A little rim light helps distinguish animals against the sand and palms.
  const fill=new THREE.DirectionalLight('#c4eff0',.45);fill.position.set(8,9,15);scene.add(fill);
  // Etched pale edges make the square sea read as a volume of clear jelly.
  const edgeMaterial=new THREE.LineBasicMaterial({color:'#b7efeb',transparent:true,opacity:.35,depthWrite:false});
  const edgePoints=[];for(const x of [-14,14])for(const z of [-14,14])edgePoints.push(new THREE.Vector3(x,-1.39,z),new THREE.Vector3(x,1.12,z));
  const cutEdges=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edgePoints),edgeMaterial);cutEdges.renderOrder=4;scene.add(cutEdges);
  // Warm sand and basalt give the miniature a grounded, mineral palette.
  island.traverse(o=>{if(o.isMesh&&o.geometry===undefined)return;if(o.isMesh&&o.material?.vertexColors&&o!==mountain){o.material.color.set('#e8c68c');o.material.roughness=.95;}});

  // A thin living green rim, irregular and embedded in the volcanic slopes.
  const mossMat=new THREE.MeshStandardMaterial({color:'#68875a',roughness:1});
  for(let i=0;i<16;i++){
    const a=i*2.399,r=1.24+(i%3)*.13;
    const patch=ball(volcano,mossMat,Math.cos(a)*r,3.78+(i%4)*.09,Math.sin(a)*r,.26,.065,.13);
    patch.rotation.set(.2*Math.sin(a),-a,.45*Math.cos(a));
  }
  // ── 火山：整块换成素材模型（2026-10-13）────────────────────────────────────────
  // 素材 `D:\AI\小岛\volcano+island+3d+model.zip` → Blender 离线裁掉那块"平沙盘"（留着会变成
  // 3.19 里被圈过的悬浮平板），其余（火山锥/熔岩口/棕榈/草木/石子/白烟团）合并成 1 个网格
  // 8,762 三角面 → 内联成 models/volcano-island.js（几何 + 1K 贴图 data URL，file:// 也能用）。
  // 缩放 9.5：模型火山锥高 0.465 → 4.42 岛局部单位（原程序锥体 3.10，比它更挺拔但不超出原来的砂坡范围）；
  // 实测 8/9.5/11 三档对比图见 _mods-out\volcano-scale-*.png，9.5 时模型自带的草木不会被砂面埋掉。
  // 模型轴线 (0.072,-0.020)、锥底 y=0.167 对齐到原来的锥底（group 局部 y=-0.03）。
  // 程序火山只让位不删除：mountain / rim 保持"不可见但可被射线命中"，所以"点火山喷发"的行为不变。
  let volcanoModel=null;
  if(window.VOLCANO_MODEL&&window.__glbDecode){
    const vgeo=window.__glbDecode(window.VOLCANO_MODEL,THREE);
    const img=window.VOLCANO_MODEL.images&&window.VOLCANO_MODEL.images.basecolor;
    let vtex=null;
    if(img){vtex=new THREE.TextureLoader().load(img.data);vtex.flipY=false;vtex.colorSpace=THREE.SRGBColorSpace;vtex.anisotropy=renderer.capabilities.getMaxAnisotropy();}
    const vmat=new THREE.MeshStandardMaterial({map:vtex,color:'#ffffff',roughness:.87,metalness:.02});
    const VS=9.5,VAX=.072,VAZ=-.020,VBASE=.167;
    volcanoModel=mesh(vgeo,vmat,volcano,-VAX*VS,-.03-VBASE*VS,-VAZ*VS);
    volcanoModel.scale.setScalar(VS);volcanoModel.name='volcano-island-model';
    for(const child of [...volcano.children])if(child!==volcanoModel)child.visible=false;
    window.volcanoModelTop=volcanoModel;
  }
  // Continuous necks and tails cover segmented joints without touching animation.
  function organicTube(parent,material,points,radii){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const geo=new THREE.TubeGeometry(curve,22,1,10,false),pos=geo.attributes.position;
    for(let ring=0;ring<=22;ring++){
      const u=ring/22,center=curve.getPointAt(u),r=radii[0]*(1-u)+radii[1]*u;
      for(let k=0;k<=10;k++){const i=ring*11+k;pos.setXYZ(i,center.x+(pos.getX(i)-center.x)*r,center.y+(pos.getY(i)-center.y)*r,center.z+(pos.getZ(i)-center.z)*r)}
    }
    geo.computeVertexNormals();const part=mesh(geo,material,parent);part.userData.dino=dinosaurs.findIndex(d=>d.g===parent);pickables.push(part);
  }
  dinosaurs.forEach(({g,type})=>{
    // 小紫换成整块蒙皮的粉龙模型后，这些"遮盖程序关节"的管子会穿过模型 → 跳过（3.30）
    if(type===2&&window.PINK_MODEL&&window.PINK_MODEL.parts)return;
    const skin=g.children[0].material;
    if(type===1)organicTube(g,skin,[[.65,1.2,0],[1.01,2.0,0],[1.04,2.9,0],[1.22,3.65,0]],[.4,.2]);
    if(type===2)organicTube(g,skin,[[.68,1,0],[1.22,1.55,0],[1.3,2.4,0],[1.55,2.94,0]],[.30,.16]);
    if(type<3)organicTube(g,skin,[[-.7,1.1,0],[-1.4,1.0,.08],[-2,1.1,.19],[-2.65,1.35,.3]],[.29,.012]);
  });
  // Merge static palm leaflets, trunk rings and beach planting by material.
  // This removes hundreds of draw calls without flattening the living creatures.
  const plants=island.children.filter(o=>o.type==='Group'&&o!==volcano&&!dinosaurs.some(d=>d.g===o)&&o.visible);
  function batchStatic(group){
    group.updateMatrixWorld(true);const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert(),batches=new Map(),remove=[];
    group.traverse(o=>{if(!o.isMesh||!o.visible||Array.isArray(o.material))return;
      let b=batches.get(o.material);if(!b){b={positions:[],normals:[],uvs:[]};batches.set(o.material,b)}
      const source=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();source.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      const p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv;
      for(let i=0;i<p.count;i++){b.positions.push(p.getX(i),p.getY(i),p.getZ(i));b.normals.push(n.getX(i),n.getY(i),n.getZ(i));b.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0)}source.dispose();remove.push(o);
    });
    remove.forEach(o=>o.parent.remove(o));
    batches.forEach((b,material)=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));mesh(geometry,material,group)});
  }
  // Shared ring material makes all thirteen trunk collars one draw per tree.
  const collars=new THREE.MeshStandardMaterial({color:'#a18a65',roughness:.9});
  plants.forEach(g=>{g.traverse(o=>{if(o.isMesh&&o.geometry.type==='TorusGeometry')o.material=collars});batchStatic(g)});
  // A broader shoulder is closer to the eroded cone in the reference.
  const p=mountain.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const u=(p.getY(i)+2.23)/4.55;
    const shoulder=1+.09*Math.sin(Math.max(0,Math.min(1,u))*Math.PI);
    p.setX(i,p.getX(i)*shoulder);p.setZ(i,p.getZ(i)*shoulder);
  }
  p.needsUpdate=true;mountain.geometry.computeVertexNormals();
  // A soft frontal bounce reveals the animals and rock folds under the palms.
  const bounce=new THREE.DirectionalLight('#ffe5bb',.85);
  bounce.position.set(12,10,16);scene.add(bounce);
  // The flat "pale reef shallows" disc that used to float here (RingGeometry 5.2-7.5 at y=-.5)
  // is gone: it read as a suspended sand plate under the island in the underwater eye-level view.
  // The island foot meets the seabed the other way round (see development-notes 3.19, second pass):
  // the beach keeps growing past u=1 through its `skirt` rings until it dips .2-.29 BELOW the lagoon
  // floor (floorY), and the shallow green cast left by the deleted disc is baked into the seabed's
  // vertex colours. Do NOT raise the seabed up to the beach rim - that was the first, reverted
  // attempt and it left a bright "collar + step" ring around the island.

floor.receiveShadow=false;
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;const ctx=shadowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(128,128,40,128,128,128);gradient.addColorStop(0,'rgba(60,55,45,.34)');gradient.addColorStop(1,'rgba(60,55,45,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
const shadowTexture=new THREE.CanvasTexture(shadowCanvas);shadowTexture.colorSpace=THREE.SRGBColorSpace;
const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(52,52),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.set(3,floor.position.y+.02,3);scene.add(contactShadow);
function applyArtLighting(){const state=night?ART.night:ART.day;hemi.intensity=state.fill;sun.intensity=state.sun;renderer.toneMappingExposure=state.exposure;bounce.intensity=state.bounce;contactShadow.material.opacity=night?.5:1;scene.background.set(night?'#182735':'#e8e5df');scene.fog.color.copy(scene.background)}
const dayBase=document.querySelector('#day').onclick;

document.querySelector('#day').onclick=()=>{dayBase();applyArtLighting()};applyArtLighting();
})();

// 3.33 Complete user-supplied FBX island; legacy landscape retained off-scene for recovery.
(()=>{
 if(!window.FULL_ISLAND_MODEL)return;
 const src=window.FULL_ISLAND_MODEL,g=new THREE.BufferGeometry();
 const decode=s=>{const raw=atob(s),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Float32Array(bytes.buffer)};
 for(const [name,size] of [['position',3],['normal',3],['uv',2]])g.setAttribute(name,new THREE.BufferAttribute(decode(src[name]),size));
 const texture=new THREE.TextureLoader().load('assets/island-model/albedo.png');texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=true;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const model=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:texture,roughness:.87,metalness:0}));model.name='complete-island-fbx';model.scale.setScalar(11.3);model.position.y=1.05;model.castShadow=model.receiveShadow=true;
 const old=[];for(const child of [...island.children])if(!dinosaurs.some(d=>d.g===child)&&!child.isLight){old.push(child);island.remove(child);}
 // Parent to island so existing feeding raycasts still recognize the ground.
 island.updateMatrixWorld(true);scene.add(model);island.attach(model);
 window.fullIsland={model,legacy:old,source:'tripo_convert_f6547073-6975-44cc-9950-71bc422572bb.fbx'};
 // ── 3.48b：把模型自带的烟雾几何拆成 6 颗可动烟团（用户：「可以用活火山上的模型烟雾来动吗」）
 // 模型里那串烟是**焊死在同一块 geometry 上**的 940 个三角面（局部 y>.60、簇心 (0.286,0.695,0.029)、半径 0.206）。
 // 做法：把这批三角面从主网格剥出来 → k-means 分成 6 团（每团仍用**模型自己的顶点与贴图**）→ 每团一个 mesh，
 //       枢轴放在各自质心，沿烟柱路径上升/摆动/缩放/淡入淡出。外观完全是模型原样，只是会动了。
 try{
   const posA=g.attributes.position,normA=g.attributes.normal,uvA=g.attributes.uv;
   const triCount=posA.count/3,smokeTri=[],keepTri=[];
   for(let t=0;t<triCount;t++){
     const y0=posA.getY(t*3),y1=posA.getY(t*3+1),y2=posA.getY(t*3+2);
     const cy=(y0+y1+y2)/3,rx=Math.hypot((posA.getX(t*3)+posA.getX(t*3+1)+posA.getX(t*3+2))/3-0.286,(posA.getZ(t*3)+posA.getZ(t*3+1)+posA.getZ(t*3+2))/3-0.029);
      /* 3.48d：质心 >.545 且在火口轴 r<.30 → 连烟柱根部一起清掉（旧的"三顶点都>.60"会把根部留在模型上=白色残留） */
      if(cy>.44&&rx<0.30)smokeTri.push(t);else keepTri.push(t);
   }
   if(smokeTri.length>50){
     const buildAttr=(attr,list,size)=>{const a=new Float32Array(list.length*3*size);let w=0;
       for(const t of list)for(let k=0;k<3;k++)for(let c=0;c<size;c++)a[w++]=attr.getComponent(t*3+k,c);
       return new THREE.BufferAttribute(a,size)};
     const cent=t=>[(posA.getX(t*3)+posA.getX(t*3+1)+posA.getX(t*3+2))/3,
                    (posA.getY(t*3)+posA.getY(t*3+1)+posA.getY(t*3+2))/3,
                    (posA.getZ(t*3)+posA.getZ(t*3+1)+posA.getZ(t*3+2))/3];
     const cents=smokeTri.map(cent);
     // 主网格：剥掉烟雾三角面（烟在模型里，所以必须从原 geometry 里去掉，否则会残留一串静止的白团）
     g.setAttribute('position',buildAttr(posA,keepTri,3));
     g.setAttribute('normal',buildAttr(normA,keepTri,3));
     if(uvA)g.setAttribute('uv',buildAttr(uvA,keepTri,2));
     g.computeBoundingSphere();
     // ── 3.48e：低模球烟 + 实时参数面板（用户：「你弄参数实时拉杆我调整」）
     // 烟 = 一颗低模球（Icosahedron detail=1、flatShading）复刻成 1 个 InstancedMesh；
     // 所有观感量收进 SMK，面板滑杆直接改 SMK、每帧现读 → 拖动即变，不需要刷新。
     // 面板 id 一律 smk- 前缀：本项目踩过「滑杆 id 生成同名 window 全局顶掉 API」的坑（3.31）。
     const SMK={puffs:14,plume:.52,baseY:.395,grow:1.65,speed:.45,size:.40,sway:2.50,lean:.12,fadeIn:.06,fadeOut:.22,offX:-.085,offZ:.075};
     window.volcanoSmokeParams=SMK;
     const craterX=0.286,craterZ=0.029;
     const puffGeo=new THREE.IcosahedronGeometry(1,1);
     const puffMat=new THREE.MeshStandardMaterial({color:'#f2f3ee',roughness:.96,metalness:0,
       flatShading:true,transparent:true,opacity:1,depthWrite:true,fog:true});
     puffMat.customProgramCacheKey=()=>'volcano-smoke-puffs';
     puffMat.onBeforeCompile=sh=>{
       sh.vertexShader='attribute float aFade;\nvarying float vFade;\n'+
         sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFade=aFade;');
       sh.fragmentShader='varying float vFade;\n'+
         sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.a*=vFade;');
     };
     const dummy=new THREE.Object3D();
     let puffs=null,fadeAttr=null,P=[];
     const rnd=()=>Math.random();
     function buildPuffs(n){
       if(puffs){model.remove(puffs);puffs.geometry.dispose();puffs=null}
       const N=Math.max(1,Math.min(40,n|0));
       const g=puffGeo.clone();
       fadeAttr=new THREE.InstancedBufferAttribute(new Float32Array(N).fill(0),1);
       g.setAttribute('aFade',fadeAttr);
       puffs=new THREE.InstancedMesh(g,puffMat,N);
       puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
       puffs.castShadow=false;puffs.receiveShadow=false;puffs.frustumCulled=false;
       model.add(puffs);
       P=[];
       for(let i=0;i<N;i++)P.push({phase:i/N,speed:.62+rnd()*.55,size:.042+rnd()*.030,
         swayA:.010+rnd()*.020,swayF:.5+rnd()*.9,swayP:rnd()*6.283,
         spinX:(rnd()-.5)*.9,spinY:(rnd()-.5)*1.2,spinZ:(rnd()-.5)*.9,
         rot0:new THREE.Euler(rnd()*3,rnd()*3,rnd()*3)});
       return N;
     }
     function smokeUpdate(dt,t){
       if(!puffs)return;
       const hot=window.eruptionActive?1:0;
       const spd=(hot?.42:.22)*SMK.speed;
       const rise=1+hot*.8;
       for(let i=0;i<P.length;i++){
         const q=P[i];
         const f=(t*spd*q.speed+q.phase)%1;                       // 0=刚出火口 1=化开
         const wobX=(Math.sin(t*.85+f*4.6)*.62+Math.sin(t*1.9+q.swayP)*.18)*q.swayA*f*.9*SMK.sway;
         const wobZ=(Math.cos(t*.72+f*3.7)*.55+Math.cos(t*1.6+q.swayP*1.6)*.15)*q.swayA*.8*f*.9*SMK.sway;
         dummy.position.set(craterX+(SMK.offX||0)+wobX-f*f*SMK.lean*rise,
                            SMK.baseY+f*SMK.plume*rise,
                            craterZ+(SMK.offZ||0)+wobZ-f*f*SMK.lean*.6);
         dummy.rotation.set(q.rot0.x+t*q.spinX,q.rot0.y+t*q.spinY,q.rot0.z+t*q.spinZ);
         const sc=q.size*SMK.size*(1+f*SMK.grow)*(1+.07*Math.sin(t*1.7+q.swayP));   // 沿高度放大 → 串珠
         dummy.scale.setScalar(sc);
         dummy.updateMatrix();
         puffs.setMatrixAt(i,dummy.matrix);
         fadeAttr.array[i]=Math.min(1,f/Math.max(.01,SMK.fadeIn))*Math.min(1,(1-f)/Math.max(.01,SMK.fadeOut));
       }
       puffs.instanceMatrix.needsUpdate=true;fadeAttr.needsUpdate=true;
     }
     window.volcanoSmoke={mode:'spheres',get count(){return P.length},get mesh(){return puffs},
       tris:smokeTri.length,params:SMK,
       setPuffs(n){SMK.puffs=buildPuffs(n);smokeUpdate(0,0);return SMK.puffs},update:smokeUpdate};
     buildPuffs(SMK.puffs);smokeUpdate(0,0);
     // ── 实时参数面板（塞进右侧「小岛实验室」；details 收起，不占地方）
     try{
       const host=document.querySelector('#lab-content');
       if(host&&!document.querySelector('#smk-box')){
         // 3.48g：参数存档改走服务端 tuning.json（换浏览器、清缓存都不会丢）
           //  - 拖动即自动 POST（防抖 600ms）→ 你调成什么样都会被记住
           //  - 「设为默认」把当前值写成基准（defSmk）；「恢复默认」回到那个基准（不会清掉别的）
           const SMK_CODE={puffs:SMK.puffs,plume:SMK.plume,baseY:SMK.baseY,grow:SMK.grow,speed:SMK.speed,
            size:SMK.size,sway:SMK.sway,lean:SMK.lean,fadeIn:SMK.fadeIn,fadeOut:SMK.fadeOut,offX:SMK.offX,offZ:SMK.offZ};
           let SMK_BASE=null,_smkTimer=0;
           const pushSmk=()=>{const b={smk:SMK};if(SMK_BASE)b.defSmk=SMK_BASE;
             fetch('/api/tuning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).catch(()=>{})};
           const queueSave=()=>{clearTimeout(_smkTimer);_smkTimer=setTimeout(pushSmk,600)};
           let syncRows=()=>{};
         const defs=[
           ['puffs','颗数',4,24,1,.0,''],
           ['plume','烟柱高度',.15,1.0,.01,2,''],
           ['baseY','起点高度',.30,.75,.005,3,''],
           ['grow','顶部放大',0,2.4,.05,2,'×'],
           ['speed','上升速度',.3,2.5,.05,2,'×'],
           ['size','球体大小',.4,2.2,.05,2,'×'],
           ['sway','横向摇摆',0,2.5,.05,2,'×'],
           ['lean','甩尾',0,.15,.005,3,''],
           ['fadeIn','淡入',.01,.3,.01,2,''],
           ['fadeOut','淡出',.05,.6,.01,2,''],
            ['offX','X 轴偏移',-.30,.30,.005,3,''],
            ['offZ','Z 轴偏移',-.30,.30,.005,3,''],
         ];
         const box=document.createElement('details');
         box.id='smk-box';
         const sum=document.createElement('summary');
         sum.textContent='火山烟（实时调参）';
         box.appendChild(sum);const bodyEl=document.createElement('div');bodyEl.style.maxHeight='58vh';bodyEl.style.overflowY='auto';box.appendChild(bodyEl);
         const rows=[];
         for(const [key,label,min,max,step,digits,unit] of defs){
           const lab=document.createElement('label');
           lab.appendChild(document.createTextNode(label+' '));
           const inp=document.createElement('input');
           inp.type='range';inp.id='smk-'+key;inp.setAttribute('aria-label','火山烟-'+label);
           inp.min=String(min);inp.max=String(max);inp.step=String(step);
           inp.value=String(SMK[key]);
           const out=document.createElement('small');
           const fmt=v=>key==='puffs'?String(Math.round(v)):Number(v).toFixed(digits);
           out.textContent=fmt(SMK[key])+unit;
           inp.addEventListener('input',()=>{queueSave();
             const v=+inp.value;
             if(key==='puffs')window.volcanoSmoke.setPuffs(v);else SMK[key]=v;
             out.textContent=fmt(key==='puffs'?SMK.puffs:v)+unit;
           });
           lab.appendChild(out);lab.appendChild(inp);
           bodyEl.appendChild(lab);
           rows.push({key,inp,out,fmt,unit});
          }
          syncRows=()=>{for(const r of rows){r.inp.value=String(SMK[r.key]);r.out.textContent=r.fmt(SMK[r.key])+r.unit}};
          fetch('/api/tuning').then(r=>r.json()).then(j=>{
            if(j.smk){Object.assign(SMK,j.smk);window.volcanoSmoke.setPuffs(SMK.puffs)}
            SMK_BASE=j.defSmk||null;syncRows();
          }).catch(()=>{});
         const rst=document.createElement('button');
         const save=document.createElement('button');save.id='smk-save';save.type='button';save.textContent='设为默认';
           save.style.cssText='padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.16);background:#fff;cursor:pointer;font-size:11px';
           save.onclick=()=>{SMK_BASE=Object.assign({},SMK);pushSmk();save.textContent='已设为默认 ✓';setTimeout(()=>{save.textContent='设为默认'},1200)};
           rst.id='smk-reset';rst.type='button';rst.textContent='恢复默认（回基准）';
           rst.addEventListener('click',()=>{
             const t=SMK_BASE||SMK_CODE;
             Object.assign(SMK,t);
             window.volcanoSmoke.setPuffs(SMK.puffs);
             syncRows();pushSmk();
           });
           const btnRow=document.createElement('div');btnRow.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 6px';
           btnRow.appendChild(save);btnRow.appendChild(rst);bodyEl.appendChild(btnRow);
         host.appendChild(box);
         window.volcanoSmokeUI={box,rows,reset:rst};
       }
     }catch(err){console.warn('[volcano-smoke] panel skipped:',err&&err.message)}
     if(typeof smoke!=='undefined'&&smoke.length){window.__smokePuffs=smoke;for(const s of smoke)s.p.visible=false;window.volcanoSmokeActive=true}
     console.log('[volcano-smoke] mode=spheres puffs='+P.length+' strippedTris='+smokeTri.length+' panel='+!!document.querySelector('#smk-box'));
   }
 }catch(err){console.warn('[volcano-smoke] skipped:',err&&err.message)}

  // 3.48h：火口那圈灰白「帽檐」＝烟柱最底下的裙边（贴图那一格是灰白、y 0.40–0.44、r<0.21）。
  // 几何/半径都跟火山内壁重叠，只有**贴图颜色**分得开 → 按颜色认；贴图异步加载，先轮询再剥一次。
  (function stripRim(){
    const run=()=>{
      const im=texture.image; if(!im||!im.width) return false;
      const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;
      const cx2=cv.getContext('2d');cx2.drawImage(im,0,0);
      const px=cx2.getImageData(0,0,im.width,im.height).data;
      const smp=(u,v)=>{const x=((((u%1)+1)%1)*(im.width-1))|0,y=((1-(((v%1)+1)%1))*(im.height-1))|0,k=(y*im.width+x)*4;
        return [px[k]/255,px[k+1]/255,px[k+2]/255]};
      const P=g.attributes.position,U=g.attributes.uv,N=g.attributes.normal;
      if(!U||!N) return false;
      const keep=[],dropT=[];
      for(let t=0;t<P.count/3;t++){
        const cy=(P.getY(t*3)+P.getY(t*3+1)+P.getY(t*3+2))/3;
        const rx=Math.hypot((P.getX(t*3)+P.getX(t*3+1)+P.getX(t*3+2))/3-0.286,(P.getZ(t*3)+P.getZ(t*3+1)+P.getZ(t*3+2))/3-0.029);
        let grey=false;
        if(cy>0.375&&cy<0.478&&rx<0.235){
          let L=0,S=0;
          for(let k2=0;k2<3;k2++){const c=smp(U.getX(t*3+k2),U.getY(t*3+k2));
            L+=(0.299*c[0]+0.587*c[1]+0.114*c[2])/3;S+=(Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]))/3;}
          grey=(L>0.54&&S<0.175);
        }
        (grey?dropT:keep).push(t);
      }
      if(dropT.length<10) return true;
      const build=(attr,list,size)=>{const a=new Float32Array(list.length*3*size);let w=0;
        for(const t of list)for(let k3=0;k3<3;k3++)for(let c2=0;c2<size;c2++)a[w++]=attr.getComponent(t*3+k3,c2);
        return new THREE.BufferAttribute(a,size)};
      g.setAttribute('position',build(P,keep,3));
      g.setAttribute('normal',build(N,keep,3));
      g.setAttribute('uv',build(U,keep,2));
      g.computeBoundingSphere();
      window.volcanoRimStrip={tris:dropT.length,trisLeft:keep.length};
      console.log('[volcano-rim] stripped skirt tris='+dropT.length+' left='+keep.length);
      return true;
    };
    if(run()) return;
    let n=0;const tick=()=>{if(run()||++n>200)return;setTimeout(tick,40)};setTimeout(tick,40);
  })();

 foam.visible=false;
 window.islandCrater=new THREE.Vector3(.619,5.24,-1.225);
 // Keep the existing eruption raycast targets, aligned to the new cone.
 scene.add(mountain);mountain.geometry=new THREE.CylinderGeometry(.55,1.65,3.35,16);mountain.position.set(.619,3.56,-1.225);mountain.scale.setScalar(1);mountain.rotation.set(0,0,0);mountain.visible=false;
 scene.add(rim);rim.position.copy(window.islandCrater);rim.scale.setScalar(.6);rim.visible=false;lavaLight.position.copy(window.islandCrater);
 // Extend the underwater foundation to the seabed without changing seabed elevations.
 const radii=Array(64).fill(0),pos=g.attributes.position;
 for(let i=0;i<pos.count;i++){if(pos.getY(i)>.10)continue;const x=pos.getX(i),z=pos.getZ(i),a=(Math.atan2(z,x)+Math.PI*2)%(Math.PI*2),k=Math.floor(a/(Math.PI*2)*64);radii[k]=Math.max(radii[k],Math.hypot(x,z)*11.3);}
 for(let i=0;i<64;i++)if(!radii[i]){let j=1;while(j<64&&!radii[(i+j)%64])j++;radii[i]=radii[(i+j)%64]||4.5;}
 const verts=[],indices=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,r=(radii[i%64]+radii[(i+63)%64]+radii[(i+1)%64])/3*.90;verts.push(Math.cos(a)*r,1.08,Math.sin(a)*r,Math.cos(a)*r*1.12,-1.5,Math.sin(a)*r*1.12);if(i<64){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const baseGeo=new THREE.BufferGeometry();baseGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));baseGeo.setIndex(indices);baseGeo.computeVertexNormals();const base=mesh(baseGeo,new THREE.MeshStandardMaterial({color:'#c4b994',roughness:1,side:THREE.DoubleSide}),scene);base.name='imported-island-foundation';island.attach(base);
})();
