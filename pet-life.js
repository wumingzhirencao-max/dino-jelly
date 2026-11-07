/* Cross-species pet life: the four animals notice each other, and the island dinosaurs come over
   for a handful of fish.
   - 打招呼 greet(): clicking a species makes it greet, and the nearest other animal turns to look.
   - 抢食 steal(): the pterosaur dives for dropped fish; the plesiosaur either gets there first or
     loses one to it.
   - 岸边低头 shore(): when the plesiosaur comes near the shore, the brachiosaurus walks to that
     side of the beach and dips its neck to the water, and the raptor escorts along the sand.
   - 陆地投喂 feedLand(): fish dropped on the island bring the nearest land dinosaur over to eat.
   island.js assigns every animal's position and rotation absolutely each frame, so this module
   owns its own coordinates for any animal it is moving and writes them back absolutely — the
   same reason water-pet.js drives the plesiosaur the way it does. */
(()=>{
const raptor=dinosaurs[0].g,brachio=dinosaurs[1].g,pet=dinosaurs[2].g,ptero=dinosaurs[3].g;
const SEA=water.position.y;
const state={log:'',counts:{greet:0,steal:0,share:0,visit:0},greeting:null,looking:null,
  visiting:false,escorting:false,neckTarget:0};

// Brachiosaurus neck pivot: attach the neck and head meshes so the whole neck bends without
// touching the walk animation (same trick water-pet.js uses on the plesiosaur).
const neck=new THREE.Group();neck.position.set(.8,1.2,0);brachio.add(neck);
for(const part of [...brachio.children]){
  if(part===neck||!part.isMesh)continue;
  part.geometry.computeBoundingBox();
  const box=part.geometry.boundingBox;
  if(part.position.y>1.6||(part.position.lengthSq()<.001&&box.max.y>2)){brachio.updateMatrixWorld(true);neck.attach(part)}
}

// ---------- movement we own ----------
// movers[id] = the local-space (island group) position this module is driving. While an entry
// exists the animal is ours; when it is gone island.js's own walk/flight takes over again.
const movers={};
function moveTowards(id,target,speed,dt){
  const dino=dinosaurs[id],position=dino.g.position;
  const mover=movers[id]||(movers[id]={x:position.x,z:position.z});
  const dx=target.x-mover.x,dz=target.z-mover.z,distance=Math.hypot(dx,dz),step=speed*dt;
  if(distance>1e-5){const k=Math.min(1,step/distance);mover.x+=dx*k;mover.z+=dz*k}
  position.x=mover.x;position.z=mover.z;                 // absolute: island.js just wrote the orbit
  return distance;
}
function releaseHome(id,dt,speed=1.8){
  if(!movers[id])return;
  if(moveTowards(id,dinosaurs[id].base,speed,dt)<.22)delete movers[id];
}
function holding(id){return !!movers[id]}

// ---------- shared effects ----------
const ringGeometry=new THREE.RingGeometry(.7,1,40),splashes=[];
for(let i=0;i<8;i++){
  const mesh=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:'#e6fffa',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;mesh.renderOrder=5;mesh.visible=false;scene.add(mesh);
  splashes.push({mesh,life:0,max:1});
}
let splashIndex=0;
function splash(x,z,power=1){
  const s=splashes[splashIndex++%splashes.length];
  s.life=s.max=1.4;s.power=power;s.mesh.position.set(x,SEA+.06,z);s.mesh.visible=true;s.mesh.scale.setScalar(.3);
}
const heartCanvas=document.createElement('canvas');heartCanvas.width=heartCanvas.height=64;
{const ctx=heartCanvas.getContext('2d');ctx.fillStyle='#ff8fb0';ctx.font='56px sans-serif';ctx.textAlign='center';ctx.fillText('♥',32,53)}
const heartTexture=new THREE.CanvasTexture(heartCanvas),hearts=[];
for(let i=0;i<10;i++){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:heartTexture,transparent:true,depthWrite:false}));
  sprite.visible=false;scene.add(sprite);hearts.push({sprite,life:0});
}
let heartIndex=0;
function heartAt(world){
  const h=hearts[heartIndex++%hearts.length];
  h.life=2.0;h.sprite.visible=true;h.sprite.position.copy(world);
  h.sprite.material.opacity=1;h.sprite.scale.setScalar(.34);
}
function note(text){state.log=text;window.waterPet?.setNote?.(text)}

// ---------- world helpers ----------
const scratch=new THREE.Vector3();
function worldOf(object){return object.getWorldPosition(scratch.set(0,0,0))}
function localPoint(worldX,worldZ,worldY=1.48){return island.worldToLocal(new THREE.Vector3(worldX,worldY,worldZ))}
// The beach dips below the waterline past this radius: anything that walks has to stay inside it,
// otherwise the land animals end up paddling out in the sea.
const DRY_RADIUS=4.0;
function clampToLand(x,z){
  const radius=Math.hypot(x,z);
  if(radius<=DRY_RADIUS||radius<1e-4)return {x,z};
  const k=DRY_RADIUS/radius;
  return {x:x*k,z:z*k};
}
function landPoint(bearing,radius,worldY=1.48){
  const point=clampToLand(Math.cos(bearing)*radius,Math.sin(bearing)*radius);
  return localPoint(point.x,point.z,worldY);
}

// ---------- 打招呼 ----------
const GREETINGS={0:'迅猛龙点头打了个招呼',1:'腕龙把长脖子转了回来',2:'小紫探出头来看着你',3:'翼龙翻了个身'};
function greet(id){
  state.greeting={id,start:performance.now(),until:performance.now()+1800};
  const from=worldOf(dinosaurs[id].g).clone();
  let best=null,bestDistance=Infinity;
  for(const i of [0,1,3]){
    if(i===id)continue;
    const distance=worldOf(dinosaurs[i].g).distanceTo(from);
    if(distance<bestDistance){bestDistance=distance;best=i}
  }
  if(best!==null){
    const to=worldOf(dinosaurs[best].g).clone().sub(from);
    state.looking={id:best,until:performance.now()+2200,yaw:Math.atan2(to.z,to.x)+Math.PI};
  }
  state.counts.greet++;
  toast(GREETINGS[id]+(best===null?'':'，'+names[best]+'也转过头来看'));
  note('刚刚：'+GREETINGS[id]);
  if(id===2){const p=worldOf(pet).clone();splash(p.x,p.z,1.1)}
}
document.querySelectorAll('[data-id]').forEach(button=>button.addEventListener('click',()=>greet(+button.dataset.id)));

// ---------- 抢食 ----------
let feedWatch=null;
if(window.waterPet&&typeof window.waterPet.feed==='function'){
  const feed=window.waterPet.feed.bind(window.waterPet);
  window.waterPet.feed=point=>{
    feed(point);
    if(point&&Math.random()<.6)feedWatch={point:new THREE.Vector3(point.x,point.y,point.z),due:performance.now()+900,progress:0};
  };
}
function updateSteal(dt){
  if(!feedWatch)return;
  const petWorld=worldOf(pet).clone();
  const distance=Math.hypot(petWorld.x-feedWatch.point.x,petWorld.z-feedWatch.point.z);
  const now=performance.now();
  if(now<feedWatch.due){
    if(distance<.9){feedWatch=null;state.counts.share++;note('刚刚：小紫抢先吃到了小鱼')}
    return;
  }
  feedWatch.progress=Math.min(1,feedWatch.progress+dt*1.4);
  const dive=feedWatch.progress;
  const targetWorld=new THREE.Vector3(feedWatch.point.x,SEA+.3,feedWatch.point.z);
  const approach=island.worldToLocal(targetWorld.clone().add(new THREE.Vector3(0,3.4*(1-dive),0)));
  moveTowards(3,approach,4+dive*10,dt);
  const heading=worldOf(ptero).clone().sub(targetWorld);
  ptero.rotation.y=Math.atan2(heading.z,heading.x)+Math.PI;
  ptero.rotation.z=Math.sin(dive*Math.PI)*.5;
  if(dive>=1){
    splash(targetWorld.x,targetWorld.z,1.3);
    state.counts.steal++;
    toast('翼龙从水面叼走了一条小鱼！');
    note('刚刚：翼龙抢走了一条小鱼');
    ptero.rotation.z=0;
    feedWatch=null;
  }
}

// ---------- 岸边互动 ----------
const SHORE_IN=6.4,SHORE_OUT=9.2;
function shoreRules(petWorld,dt){
  const radius=Math.hypot(petWorld.x,petWorld.z);
  const near=radius>SHORE_IN&&radius<SHORE_OUT;
  const bearing=Math.atan2(petWorld.z,petWorld.x);
  state.visiting=near;
  state.escorting=near;
  if(near){
    moveTowards(1,landPoint(bearing,3.2,1.5),1.5,dt);        // brachiosaurus, a little inland
    brachio.rotation.y=-bearing;
    state.neckTarget=-.9;
    if(!state.reportedVisit){state.reportedVisit=true;state.counts.visit++;toast('腕龙低头和小紫打了个照面');note('刚刚：小紫游到岸边，腕龙低头凑了过来')}
    moveTowards(0,landPoint(bearing+.4,DRY_RADIUS),3.2,dt);   // raptor, at the water's edge beside it
    raptor.rotation.y=-bearing;
  }else if(state.reportedVisit){
    state.reportedVisit=false;
    state.neckTarget=0;
    note('小紫游回海湾深处');
  }
  neck.rotation.z+=(state.neckTarget-neck.rotation.z)*Math.min(1,dt*2.2);
}
function updateShore(dt){shoreRules(worldOf(pet).clone(),dt)}

// ---------- 陆地投喂 ----------
const pelletGeometry=new THREE.SphereGeometry(1,8,6),pelletMaterial=new THREE.MeshStandardMaterial({color:'#d8a05a',roughness:.7,flatShading:true});
const LAND=[0,1,3],WALK_SPEED={0:3.6,1:3.0,3:0},fed={0:0,1:0,3:0},feedEvents=[];
const raycaster=new THREE.Raycaster();
function groundUnder(point){
  // the drop point may be on a palm or a rock: cast straight down onto the island surface
  raycaster.set(new THREE.Vector3(point.x,point.y+3,point.z),new THREE.Vector3(0,-1,0));
  const hit=raycaster.intersectObject(island,true)[0];
  return hit?hit.point.clone():point.clone();
}
function feedLand(point){
  // clamp onto the dry sand: the beach skirt past DRY_RADIUS is already under water
  const raw=groundUnder(point),safe=clampToLand(raw.x,raw.z);
  const ground=new THREE.Vector3(safe.x,raw.y,safe.z);
  let animal=LAND[0],bestDistance=Infinity;
  for(const id of LAND){
    const world=worldOf(dinosaurs[id].g);
    const distance=Math.hypot(world.x-ground.x,world.z-ground.z);
    if(distance<bestDistance){bestDistance=distance;animal=id}
  }
  const pellets=[];
  for(let i=0;i<6;i++){
    const mesh=new THREE.Mesh(pelletGeometry,pelletMaterial);
    mesh.scale.setScalar(.055);
    mesh.position.set(ground.x+(Math.random()-.5)*.55,ground.y+.04,ground.z+(Math.random()-.5)*.55);
    mesh.castShadow=false;scene.add(mesh);pellets.push(mesh);
  }
  feedEvents.push({animal,pellets,phase:'walk',timer:0,point:ground.clone()});
  toast(names[animal]+'闻到味道，正走过来');
  note('刚刚：在小岛上撒了一把小鱼干');
}
function updateLand(dt){
  for(let e=feedEvents.length-1;e>=0;e--){
    const event=feedEvents[e],dino=dinosaurs[event.animal].g;
    if(event.phase==='walk'){
      const target=event.animal===3
        ?island.worldToLocal(new THREE.Vector3(event.point.x,event.point.y+1.35,event.point.z))
        :localPoint(event.point.x,event.point.z);
      const remaining=moveTowards(event.animal,target,WALK_SPEED[event.animal]||9,dt);
      const world=worldOf(dino);
      if(remaining<.35||Math.hypot(world.x-event.point.x,world.z-event.point.z)<.8){
        event.phase='eat';event.timer=0;
        if(event.animal===3)dino.rotation.z=0;
      }
    }else if(event.phase==='eat'){
      event.timer+=dt;
      const pulse=Math.sin(event.timer*9)*.05;
      if(event.animal===1)neck.rotation.z=-.95+pulse*2;   // brachiosaurus dips its neck
      else dino.rotation.x=Math.max(0,pulse*2);           // raptor and pterosaur peck
      if(event.timer>.42&&event.pellets.length){
        const pellet=event.pellets.pop();
        scene.remove(pellet);
        heartAt(worldOf(dino).clone().add(new THREE.Vector3(0,.7,0)));
      }
      if(!event.pellets.length){event.phase='done';event.timer=0}
    }else{
      event.timer+=dt;
      if(event.timer>.6){
        fed[event.animal]++;
        toast(names[event.animal]+'吃到了小鱼，凑过来蹭了蹭你');
        note('刚刚：喂了'+names[event.animal]+'一把小鱼干');
        dino.rotation.x=0;
        if(event.animal===1)neck.rotation.z=state.neckTarget;
        feedEvents.splice(e,1);
      }
    }
  }
}

// ---------- per-frame ----------
function animateGreeting(dt){
  const g=state.greeting;
  if(!g)return;
  const k=Math.min(1,(performance.now()-g.start)/1800),ease=Math.sin(Math.PI*k),dino=dinosaurs[g.id];
  if(g.id===0)dino.g.rotation.x=ease*.22;
  else if(g.id===1)neck.rotation.z+=Math.sin(k*Math.PI*3)*.25*ease;
  else if(g.id===3)dino.g.rotation.z=ease*.55;
  if(k>=1){if(g.id===0)dino.g.rotation.x=0;state.greeting=null}
}
function animateLooking(dt){
  const look=state.looking;
  if(!look||performance.now()>look.until){state.looking=null;return}
  const g=dinosaurs[look.id].g;
  g.rotation.y+=(look.yaw-g.rotation.y)*Math.min(1,dt*3);
}
function update(dt,t){
  if(!dt)return;
  animateGreeting(dt);animateLooking(dt);updateSteal(dt);updateShore(dt);updateLand(dt);
  // anything we are not using this frame walks back to its own beat, then island.js takes over
  for(const id of [0,1,3]){
    const busy=feedEvents.some(e=>e.animal===id)||(id===3&&feedWatch)||
      (id===0&&state.escorting)||(id===1&&state.visiting);
    if(!busy&&holding(id))releaseHome(id,dt,id===3?5:1.8);
  }
  for(const s of splashes){
    if(s.life<=0)continue;
    s.life-=dt;s.mesh.visible=s.life>0;
    const age=1-s.life/s.max;
    s.mesh.scale.setScalar(.3+age*1.5);s.mesh.material.opacity=Math.sin(Math.PI*age)*.42*s.power;
  }
  for(const h of hearts){
    if(h.life<=0)continue;
    h.life-=dt;h.sprite.visible=h.life>0;
    h.sprite.position.y+=dt*.5;
    h.sprite.material.opacity=Math.min(1,h.life);
    h.sprite.scale.setScalar(.34+Math.max(0,2-h.life)*.12);
  }
}
window.petLife={update,state,greet,feedLand,
  // Test hook: run the shore rules for an arbitrary pet position, so checks can exercise them
  // without waiting for the plesiosaur to wander near the beach by itself.
  probeShore(x,z){
    const p=new THREE.Vector3(x,SEA,z);
    for(let i=0;i<10;i++)shoreRules(p,1/60);
    return {visiting:state.visiting,neckTarget:state.neckTarget,escorting:state.escorting,
      brachioPos:[+brachio.position.x.toFixed(2),+brachio.position.z.toFixed(2)],
      raptorPos:[+raptor.position.x.toFixed(2),+raptor.position.z.toFixed(2)]};
  },
  get activity(){return {log:state.log,...state.counts,fed:{...fed},
    feeding:feedEvents.map(e=>({animal:e.animal,phase:e.phase,pellets:e.pellets.length})),
    hearts:hearts.filter(h=>h.life>0).length,
    visiting:state.visiting,escorting:state.escorting,stealing:!!feedWatch,
    neck:+neck.rotation.z.toFixed(2),neckTarget:state.neckTarget,
    movers:Object.keys(movers).map(Number)}}};
})();

