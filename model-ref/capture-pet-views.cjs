/* Capture clean, isolated, near-orthographic views of 小紫（蛇颈龙 / dinosaurs[2]）for AI 3D modeling.
   - everything but the creature is hidden (scene children except lights + the island group; inside the
     island group only the pet), background flat light grey, fog off, page UI hidden
   - long lens (fov 16°) ⇒ near-orthographic projection
   - `paused = true` freezes the sim, and the view angles are derived from the pet's own frozen yaw,
     so profile / front / tail shots are true axis-aligned views
   - distance is fitted per view from the creature's bounding box (screen-horizontal and
     screen-vertical extents) with a 12% margin
   Run: node capture-pet-views.cjs            (needs http://127.0.0.1:8795/ up)          */
const {chromium}=require('../../dy_runtime/node_modules/playwright-core');
const OUT=__dirname;

/* Runs inside the page. az = camera azimuth relative to the pet's facing
   (0 = right profile, +PI/2 = front, -PI/2 = tail, PI = left profile, +0.62 ≈ three-quarter);
   elev = camera elevation (PI/2 = eye level, 0.10 = from above); horizOf/vertOf say which of the
   creature's box extents land on the screen's horizontal / vertical axis for that view. */
const SHOOT=([stage,az,elev,horizOf,vertOf])=>{
  waterPet.setGrowth(stage,0);
  // isolate: only the pet, on flat light grey, long lens, frozen view
  scene.fog=null;scene.background=new THREE.Color('#f2f1ee');
  for(const o of [...scene.children])if(!o.isLight&&o!==island)o.visible=false;   // also kills the
  for(const c of [...island.children])c.visible=(c===dinosaurs[2].g);             // celebration hearts
  dinosaurs[2].g.visible=true;
  camera.fov=16;camera.updateProjectionMatrix();
  viewLocked=true;
  const pet=dinosaurs[2].g;
  scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(pet),c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
  const horiz=horizOf==='z'?s.z:s.x,vert=vertOf==='z'?s.z:s.y;
  const halfV=THREE.MathUtils.degToRad(camera.fov/2),halfH=Math.atan(Math.tan(halfV)*camera.aspect);
  const dist=Math.max((vert/2)/Math.tan(halfV),(horiz/2)/Math.tan(halfH))*1.12;
  target.copy(c);
  const yaw=pet.rotation.y;                     // frozen by `paused`; island.js keeps writing this value
  theta=yaw+az;phi=elev;distance=dist;
  return {yaw:+yaw.toFixed(3),size:s.toArray().map(v=>+v.toFixed(2)),distance:+dist.toFixed(2)};
};

(async()=>{
  const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const p=await b.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1.5});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8795/');
  await p.waitForFunction(()=>window.waterPet&&window.islandBeach);
  await new Promise(r=>setTimeout(r,1200));
  // hide the page UI once (canvas keeps rendering)
  await p.evaluate(()=>{
    document.querySelectorAll('header,nav,.species,#card,#controls,#hint,#toast,#pet-panel,#feedBag')
      .forEach(el=>{if(el)el.style.display='none'});
    document.body.style.background='#f2f1ee';
    paused=true;
  });
  // neutral pose: wait for the surface half of the dive cycle, then keep the frame frozen
  await p.waitForFunction(()=>window.waterPet.activity.swimState==='surface',null,{timeout:40000}).catch(()=>{});
  const views=[
    ['side',           16, 0,           Math.PI/2, 'x','y'],
    ['three-quarter',  16, 0.62,        Math.PI/2, 'x','y'],
    ['front',          16, Math.PI/2,   Math.PI/2, 'z','y'],
    ['tail',           16,-Math.PI/2,   Math.PI/2, 'z','y'],
    ['side-left',      16, Math.PI,     Math.PI/2, 'x','y'],
    ['top',            16, 0,           0.10,      'x','z'],
    ['hatchling',       0, 0,           Math.PI/2, 'x','y']
  ];
  const shots=[];
  for(const [label,stage,az,elev,horizOf,vertOf] of views){
    const info=await p.evaluate(SHOOT,[stage,az,elev,horizOf,vertOf]);
    await new Promise(r=>setTimeout(r,450));
    const name=label==='hatchling'?'pet-hatchling-side.png':`pet-adult-${label}.png`;
    await p.screenshot({path:`${OUT}/${name}`});
    shots.push({file:name,stage,...info});
  }
  console.log(JSON.stringify({errors,shots},null,1));
  await b.close();
})();
