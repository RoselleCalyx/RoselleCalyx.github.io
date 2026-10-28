import {createDensityAverage} from './ring-science.js?v=20261028-observatory7';
/* On-demand ring observatory. All textures and geometry are local/procedural. */
const {RingPatch,hash,physical,jacobi,density}=window.RingDynamics;
let canvas=document.getElementById('ringScene');
const status=document.getElementById('ringStatus');
const mass=document.getElementById('moonMass'),speed=document.getElementById('timeFlow');
const pause=document.getElementById('ringPause'),reset=document.getElementById('ringReset');
const ice=document.getElementById('viewIce'),above=document.getElementById('viewAbove');
const label=document.getElementById('moonletLabel'),state=document.getElementById('ringState');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)').matches;
const query=new URLSearchParams(location.search),sim=new RingPatch(coarse?4200:9000),control=new RingPatch(coarse?4200:9000);
control.setMass(0);
const science={lens:['paths','density'].includes(query.get('lens'))?query.get('lens'):'light',compare:query.get('control')==='1',guide:false,sun:12,selected:-1};
const active=()=>science.compare?control:sim;
let scienceLayers=null,busy=false,lastMeasure=-1;
const lensButtons={light:document.getElementById('lensLight'),paths:document.getElementById('lensPaths'),density:document.getElementById('lensDensity')};
let savedCalm=false;try{savedCalm=localStorage.getItem('calm')==='1';}catch{}
let paused=reduced.matches||savedCalm||query.get('paused')==='1',view=query.get('view')==='above'||science.lens!=='light'?'above':'ice';
let renderer=null,last=0,drawTime=-1,ready=false,overheadFallback=false,needsDraw=true,draw,resize,updateCamera;
const initialMass=Number(query.get('mass'));if(query.has('mass')&&Number.isFinite(initialMass)){sim.setMass(initialMass);mass.value=sim.mass;}
document.getElementById('grainCount').textContent=sim.count.toLocaleString('en')+' ice grains';
function updateLabels(){
  needsDraw=true;
  document.getElementById('massValue').value=sim.mass.toFixed(1)+'×';
  document.getElementById('speedValue').value=(+speed.value).toFixed(1)+'×';
  pause.textContent=paused?'Resume':'Pause';pause.setAttribute('aria-pressed',String(paused));
  ice.setAttribute('aria-pressed',String(view==='ice'));above.setAttribute('aria-pressed',String(view==='above'));
  state.textContent=paused?'A quiet moment in the rings':active().mass===0?'An undisturbed stream of ice':'A small world, a growing wake';
  label.hidden=sim.mass===0||science.compare||overheadFallback;
  for(const [key,button] of Object.entries(lensButtons))button.setAttribute('aria-pressed',String(science.lens===key));
  document.body.dataset.lens=science.lens;document.body.dataset.control=String(science.compare);
  document.getElementById('ringCompare').setAttribute('aria-pressed',String(science.compare));
  mass.disabled=science.compare;
  document.getElementById('densityKey').hidden=science.lens!=='density';
  document.getElementById('lensHint').textContent=science.compare?'Control: same seeds and clock, without moonlet gravity':science.lens==='paths'?'Inner ice overtakes · outer ice falls behind':science.lens==='density'?'Short rolling average · actual grain counts':'Sunlit ice · tap a grain to follow its passage';
  updateMeasurements(true);
  canvas.dataset.paused=String(paused);canvas.dataset.view=view;canvas.dataset.mass=String(sim.mass);canvas.dataset.lens=science.lens;canvas.dataset.control=String(science.compare);
}
mass.addEventListener('input',()=>{sim.setMass(+mass.value);drawTime=-1;updateLabels();});
speed.addEventListener('input',updateLabels);
pause.addEventListener('click',()=>{paused=!paused;updateLabels();});
reset.addEventListener('click',()=>{sim.reset();control.reset();science.selected=-1;scienceLayers?.reset();drawTime=-1;needsDraw=true;updateMeasurements(true);status.textContent='A fresh stream. Watch the moonlet shape it.';status.hidden=false;setTimeout(()=>{status.hidden=true;},2400);});
function setView(next){view=next;updateCamera?.(next);updateLabels();}
ice.addEventListener('click',()=>setView('ice'));above.addEventListener('click',()=>setView('above'));
reduced.addEventListener('change',()=>{if(reduced.matches){paused=true;updateLabels();}});
function updateMeasurements(force=false){
  const field=active();if(!force&&Math.abs(field.time-lastMeasure)<.1)return;lastMeasure=field.time;
  const units=physical(field.mass,field.time);
  document.getElementById('orbitPeriod').textContent=units.periodHours.toFixed(1)+' h';
  document.getElementById('hillValue').textContent=field.mass?Math.round(units.hillMeters)+' m':'—';
  document.getElementById('elapsedValue').textContent='T + '+units.elapsedHours.toFixed(1)+' h';
  const probe=document.getElementById('grainProbe'),i=science.selected;
  probe.hidden=i<0;if(i<0)return;
  const drift=Math.hypot(field.vx[i],field.vy[i]+1.5*field.x[i])*units.velocityCms;
  document.getElementById('probeName').textContent='ICE GRAIN '+String(i+1).padStart(4,'0');
  document.getElementById('probeDrift').textContent='Δv '+drift.toFixed(2)+' cm/s';
  document.getElementById('probeDistance').textContent=Math.round(Math.hypot(field.x[i],field.y[i])*100)+(field.mass?' m from the moonlet':' m from the control origin');
  document.getElementById('probeInvariant').textContent='Jacobi C = '+jacobi(field.x[i],field.y[i],field.vx[i],field.vy[i],field.mass).toFixed(3);
}
for(const [lens,button] of Object.entries(lensButtons))button.addEventListener('click',()=>{
  science.lens=lens;if(lens!=='light')setView('above');updateLabels();drawTime=-1;
});
document.getElementById('ringCompare').addEventListener('click',()=>{science.compare=!science.compare;science.selected=-1;scienceLayers?.reset();drawTime=-1;updateLabels();});
document.getElementById('gravityGuide').addEventListener('change',event=>{science.guide=event.target.checked;needsDraw=true;});
document.getElementById('sunAngle').addEventListener('input',event=>{science.sun=+event.target.value;document.getElementById('sunValue').value=science.sun+'°';needsDraw=true;});
document.getElementById('clearProbe').addEventListener('click',()=>{science.selected=-1;needsDraw=true;updateMeasurements(true);});
document.getElementById('ringStep').addEventListener('click',async()=>{
  if(busy||!ready)return;busy=true;paused=true;document.getElementById('ringStep').disabled=true;updateLabels();
  for(let i=0;i<8;i++){sim.advance(Math.PI/16);control.advance(Math.PI/16);draw();updateMeasurements(true);await new Promise(resolve=>requestAnimationFrame(resolve));}
  busy=false;document.getElementById('ringStep').disabled=false;needsDraw=true;updateLabels();
});
updateLabels();
document.getElementById('ringPanel').addEventListener('click',event=>{
  const closed=document.body.classList.toggle('ring-quiet');
  event.currentTarget.setAttribute('aria-expanded',String(!closed));event.currentTarget.textContent=closed?'Show controls':'Hide controls';
  document.getElementById('ringGesture').hidden=closed;
});

async function create3D(){
  const [T,instruments]=await Promise.all([import('./vendor/three/three.module.js'),import('./ring-science.js?v=20261028-observatory7')]);
  renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:!coarse,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.6));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new T.Scene();scene.fog=new T.FogExp2(0x121e2c,.0035);
  const camera=new T.PerspectiveCamera(51,1,.05,1100),target=new T.Vector3(0,0,0);
  scienceLayers=instruments.createScience(T,scene);
  const sunDirection={value:new T.Vector3()},moonSize={value:sim.bodyRadius};
  scene.add(new T.HemisphereLight(0xadc7e4,0x18202b,1.1));
  const sun=new T.DirectionalLight(0xffe3b3,4);sun.position.set(-45,24,14);scene.add(sun);
  const fill=new T.DirectionalLight(0x8db6d2,.8);fill.position.set(20,8,-15);scene.add(fill);

  const textureCanvas=document.createElement('canvas');textureCanvas.width=512;textureCanvas.height=256;
  const tc=textureCanvas.getContext('2d'),pixels=tc.createImageData(512,256);
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const lat=y/256,swirl=Math.sin(x*.018+lat*35)*Math.sin(lat*Math.PI)*.0025;
    const band=.86+.06*Math.sin((lat+swirl)*178)+.035*Math.sin((lat+swirl)*427)+.02*hash(y*13);
    const at=(y*512+x)*4;pixels.data[at]=211*band;pixels.data[at+1]=192*band;pixels.data[at+2]=162*band;pixels.data[at+3]=255;
  }
  tc.putImageData(pixels,0,0);const planetTexture=new T.CanvasTexture(textureCanvas);planetTexture.colorSpace=T.SRGBColorSpace;
  const planet=new T.Mesh(new T.SphereGeometry(68,64,48),new T.MeshStandardMaterial({map:planetTexture,roughness:1}));
  planet.position.set(-150,0,0);planet.rotation.z=.045;scene.add(planet);
  // Far ring texture supplies context; the local, simulated ice is at the origin.
  const ring=new T.Mesh(new T.RingGeometry(91,181,192,1),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`precision highp float;varying vec3 p;void main(){float r=length(p.xy),grain=.84+.08*sin(r*.6)+.04*sin(r*2.4);float density=.32;if(r>132.5&&r<138.)density=.08;if(abs(r-151.)<.4)density=.12;float edges=smoothstep(91.,94.,r)*(1.-smoothstep(177.,181.,r));gl_FragColor=vec4(vec3(.61,.57,.49)*grain,density*edges);}`
  }));ring.rotation.x=-Math.PI/2;ring.position.set(-150,-.12,0);scene.add(ring);
  const starPositions=new Float32Array(1800*3);
  for(let i=0;i<1800;i++){
    const a=hash(i+111)*Math.PI*2,u=hash(i+791)*2-1,r=560;
    starPositions[i*3]=r*Math.sqrt(1-u*u)*Math.cos(a);starPositions[i*3+1]=r*u;starPositions[i*3+2]=r*Math.sqrt(1-u*u)*Math.sin(a);
  }
  const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.BufferAttribute(starPositions,3));
  scene.add(new T.Points(starGeometry,new T.PointsMaterial({color:0xc6d3de,size:.5,transparent:true,opacity:.6,sizeAttenuation:true,fog:false,depthWrite:false})));
  const geometry=new T.IcosahedronGeometry(1,0),pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),rough=1+.13*Math.sin(x*14+y*19+z*27);
    pos.setXYZ(i,x*rough,y*rough,z*rough);
  }
  geometry.computeVertexNormals();
  const material=coarse?new T.MeshStandardMaterial({color:0xe1eaf0,roughness:.32,metalness:.04,flatShading:true}):
    new T.MeshPhysicalMaterial({color:0xdde8ed,roughness:.26,metalness:.025,clearcoat:.25,clearcoatRoughness:.25,transmission:.25,thickness:.12,ior:1.31,flatShading:true});
  material.transparent=true;material.opacity=.94;material.depthWrite=false;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uSunDirection=sunDirection;shader.uniforms.uMoonRadius=moonSize;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float edgeOpacity;varying vec3 worldGrain;').replace('#include <begin_vertex>', '#include <begin_vertex>\nworldGrain=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;\nedgeOpacity=(1.-smoothstep(9.,12.,abs(instanceMatrix[3].x)))*(1.-smoothstep(27.,32.,abs(instanceMatrix[3].z)));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float edgeOpacity;varying vec3 worldGrain;uniform vec3 uSunDirection;uniform float uMoonRadius;').replace('#include <alphatest_fragment>','diffuseColor.a*=edgeOpacity;\n#include <alphatest_fragment>').replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nfloat shadowRay=-dot(worldGrain,uSunDirection);float impact=length(cross(worldGrain,uSunDirection));float shadowFactor=1.-step(0.,shadowRay)*(1.-smoothstep(uMoonRadius*.88,uMoonRadius*1.12+.0001,impact))*.88;reflectedLight.directDiffuse*=shadowFactor;reflectedLight.directSpecular*=shadowFactor;');
  };
  const distantCount=coarse?2400:4800;
  const distant=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color:0x9fb6c7,roughness:.6,metalness:.04,flatShading:true,transparent:true,opacity:.38,depthWrite:false}),distantCount);
  distant.instanceMatrix.setUsage(T.DynamicDrawUsage);distant.frustumCulled=false;scene.add(distant);
  const grains=new T.InstancedMesh(geometry,material,sim.count);grains.instanceMatrix.setUsage(T.DynamicDrawUsage);grains.frustumCulled=false;scene.add(grains);
  const dummy=new T.Object3D(),color=new T.Color();
  for(let i=0;i<sim.count;i++){
    const mix=hash(i+329);color.setRGB(.72+mix*.25,.81+mix*.17,.87+mix*.12);grains.setColorAt(i,color);
  }
  // A porous, cratered moonlet: smooth relief contrasts with faceted ice grains.
  const moonGeo=new T.SphereGeometry(1,64,40),mp=moonGeo.attributes.position;
  const craters=Array.from({length:26},(_,i)=>{
    const u=hash(i+527)*2-1,a=hash(i+821)*Math.PI*2,r=Math.sqrt(1-u*u);
    return {x:r*Math.cos(a),y:u,z:r*Math.sin(a),radius:.09+hash(i+41)*.19};
  });
  for(let i=0;i<mp.count;i++){
    const x=mp.getX(i),y=mp.getY(i),z=mp.getZ(i);
    let factor=1+.035*Math.sin(x*7+y*6+z*4)+.012*Math.sin(x*21-y*17+z*13);
    for(const q of craters){
      const d=Math.hypot(x-q.x,y-q.y,z-q.z)/q.radius;
      if(d<1.5)factor+=-.045*Math.exp(-d*d*2.3)+.012*Math.exp(-Math.pow((d-1)/.16,2));
    }
    mp.setXYZ(i,x*factor*1.04,y*factor*.96,z*factor);
  }
  moonGeo.computeVertexNormals();
  const moon=new T.Mesh(moonGeo,new T.MeshStandardMaterial({color:0xd0cbbd,roughness:.97}));scene.add(moon);
  const shadow=new T.Mesh(new T.PlaneGeometry(32,32),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uSunDirection:sunDirection,uMoonRadius:moonSize},
    vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'precision highp float;varying vec3 world;uniform vec3 uSunDirection;uniform float uMoonRadius;void main(){float t=-dot(world,uSunDirection),d=length(cross(world,uSunDirection));float a=step(0.,t)*(1.-smoothstep(uMoonRadius*.85,uMoonRadius*1.15+.0001,d))*.42;gl_FragColor=vec4(.015,.02,.03,a);}'
  }));shadow.rotation.x=-Math.PI/2;shadow.position.y=.002;scene.add(shadow);
  const orbit={yaw:1.05,pitch:.27,distance:20,yawGoal:1.05,pitchGoal:.27,distanceGoal:20};
  updateCamera=next=>{
    orbit.yawGoal=next==='above'?0:1.05;orbit.pitchGoal=next==='above'?1.52:.27;orbit.distanceGoal=next==='above'?42:20;
    if(reduced.matches){orbit.yaw=orbit.yawGoal;orbit.pitch=orbit.pitchGoal;orbit.distance=orbit.distanceGoal;}
  };
  updateCamera(view);if(view==='above'){orbit.yaw=0;orbit.pitch=1.52;orbit.distance=42;}
  document.getElementById('ringZoomIn').addEventListener('click',()=>{needsDraw=true;orbit.distanceGoal=Math.max(12,orbit.distanceGoal/1.2);});
  document.getElementById('ringZoomOut').addEventListener('click',()=>{needsDraw=true;orbit.distanceGoal=Math.min(65,orbit.distanceGoal*1.2);});
  const raycaster=new T.Raycaster(),ringPlane=new T.Plane(new T.Vector3(0,1,0),0);
  function selectGrain(event){
    const box=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1),camera);
    const point=raycaster.ray.intersectPlane(ringPlane,new T.Vector3());if(!point)return;
    const field=active();let best=.8,index=-1;
    for(let i=0;i<field.count;i++){const distance=Math.hypot(field.x[i]-point.x,field.y[i]+point.z);if(distance<best){best=distance;index=i;}}
    science.selected=index;scienceLayers.reset();needsDraw=true;updateMeasurements(true);
  }
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',e=>{
    if(!pointer||e.pointerId!==pointer.id)return;
    if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>6)pointer.moved=true;
    orbit.yawGoal-=(e.clientX-pointer.x)*.005;orbit.pitchGoal=Math.max(.11,Math.min(1.53,orbit.pitchGoal+(e.clientY-pointer.y)*.004));
    needsDraw=true;pointer.x=e.clientX;pointer.y=e.clientY;
  });
  canvas.addEventListener('pointerup',event=>{if(pointer&&!pointer.moved)selectGrain(event);pointer=null;});
  canvas.addEventListener('pointercancel',()=>{pointer=null;});canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
  canvas.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();needsDraw=true;orbit.distanceGoal=Math.max(12,Math.min(65,orbit.distanceGoal*Math.exp(e.deltaY*.001)));},{passive:false});
  canvas.addEventListener('keydown',e=>{
    needsDraw=true;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-',' '].includes(e.key))e.preventDefault();
    if(e.key==='ArrowLeft')orbit.yawGoal-=.12;if(e.key==='ArrowRight')orbit.yawGoal+=.12;
    if(e.key==='ArrowUp')orbit.pitchGoal=Math.min(1.53,orbit.pitchGoal+.08);if(e.key==='ArrowDown')orbit.pitchGoal=Math.max(.11,orbit.pitchGoal-.08);
    if(e.key==='+'||e.key==='=')orbit.distanceGoal=Math.max(12,orbit.distanceGoal-2);if(e.key==='-')orbit.distanceGoal=Math.min(65,orbit.distanceGoal+2);
    if(e.key===' '){paused=!paused;updateLabels();}
    if(e.key==='Escape'){science.selected=-1;updateMeasurements(true);}
  });
  resize=()=>{needsDraw=true;const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.setViewOffset(rect.width,rect.height,0,rect.height*.12,rect.width,rect.height);camera.updateProjectionMatrix();};
  draw=()=>{
    for(const key of ['yaw','pitch','distance'])orbit[key]+=(orbit[key+'Goal']-orbit[key])*.09;
    const horizontal=orbit.distance*Math.cos(orbit.pitch);
    camera.position.set(Math.sin(orbit.yaw)*horizontal,Math.sin(orbit.pitch)*orbit.distance,Math.cos(orbit.yaw)*horizontal);camera.lookAt(target);
    const field=active(),angle=science.sun*Math.PI/180;
    sunDirection.value.set(-Math.cos(angle)*.82,Math.sin(angle),Math.cos(angle)*.57).normalize();sun.position.copy(sunDirection.value).multiplyScalar(70);moonSize.value=science.compare?0:sim.bodyRadius;
    if(field.time!==drawTime){
      for(let i=0;i<sim.count;i++){
        const size=field.size[i]*(i%97===0?2.2:1.4);
        dummy.position.set(field.x[i],field.height[i]*Math.cos(field.time+field.phase[i]),-field.y[i]);
        dummy.rotation.set(field.phase[i]+field.time*(.3+hash(i+32))*.4,field.phase[i]*2+field.time*.15,field.phase[i]*.7);
        dummy.scale.set(size*(.7+hash(i+98)*.6),size*(.55+hash(i+78)*.65),size);dummy.updateMatrix();grains.setMatrixAt(i,dummy.matrix);
      }
      grains.instanceMatrix.needsUpdate=true;
      for(let i=0;i<distantCount;i++){
        const x=(i%2?1:-1)*(9+hash(i+752)*26),size=.04+hash(i+431)**3*.2;
        const stream=((hash(i+843)*160-1.5*x*sim.time)%160+160)%160-80;
        dummy.position.set(x,(hash(i+61)-.5)*.2,-stream);dummy.rotation.set(i*.7,sim.time*.1+i,i*.31);dummy.scale.set(size,size*.7,size);dummy.updateMatrix();distant.setMatrixAt(i,dummy.matrix);
      }
      distant.instanceMatrix.needsUpdate=true;drawTime=sim.time;
    }
    moon.visible=field.mass>0;moon.scale.setScalar(field.bodyRadius);shadow.visible=moon.visible&&science.lens==='light';
    grains.visible=science.lens!=='density';material.opacity=science.lens==='paths'?.36:.94;distant.visible=science.lens==='light';
    const reading=scienceLayers.update(field,{...science,reference:control,experiment:sim});
    if(science.selected>=0&&!reading.selectionValid){science.selected=-1;updateMeasurements(true);}
    const positions=scienceLayers.projectedGuide(camera);
    for(const [key,id] of [['hill','hillLabel'],['l1','l1Label'],['l2','l2Label']]){
      const element=document.getElementById(id),point=positions[key];element.hidden=!(field.mass>0&&(science.guide||science.lens==='paths'))||Math.abs(point.x)>1||Math.abs(point.y)>1||point.z>1;
      element.style.left=((point.x*.5+.5)*canvas.clientWidth)+'px';element.style.top=((-point.y*.5+.5)*canvas.clientHeight)+'px';
    }
    const projected=moon.position.clone().project(camera),r=canvas.getBoundingClientRect();
    label.style.left=((projected.x*.5+.5)*r.width)+'px';label.style.top=((-projected.y*.5+.5)*r.height)+'px';
    label.hidden=field.mass===0||science.lens!=='light'||science.guide||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
    renderer.render(scene,camera);
    return ['yaw','pitch','distance'].some(key=>Math.abs(orbit[key+'Goal']-orbit[key])>.001);
  };
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;ready=false;canvas.dataset.state='resting';updateLabels();status.textContent='The view is resting. Reload to return to the ice.';status.hidden=false;});
  canvas.dataset.renderer='webgl';
}
function createFallback(){
  const replacement=document.createElement('canvas');replacement.id=canvas.id;replacement.setAttribute('role','img');replacement.setAttribute('aria-label','An overhead view of ice grains flowing past a moonlet.');
  canvas.replaceWith(replacement);canvas=replacement;overheadFallback=true;const ctx=replacement.getContext('2d');
  ice.disabled=true;view='above';updateLabels();label.hidden=true;document.querySelector('.ring-zoom').hidden=true;
  document.getElementById('ringGesture').textContent='An overhead window into the rings';
  resize=()=>{needsDraw=true;replacement.width=replacement.clientWidth*Math.min(devicePixelRatio||1,1.5);replacement.height=replacement.clientHeight*Math.min(devicePixelRatio||1,1.5);};
  const average=createDensityAverage(),mapCanvas=document.createElement('canvas');mapCanvas.width=64;mapCanvas.height=160;
  const mapContext=mapCanvas.getContext('2d'),pixels=mapContext.createImageData(64,160);
  let traces=[],traceMass=-1,selectedGeneration=-1;
  function projection(){const w=replacement.width,h=replacement.height,scale=Math.min(w/30,h/70);return {w,h,scale,cx:w*.52,cy:h*.38};}
  replacement.addEventListener('click',event=>{
    const box=replacement.getBoundingClientRect(),p=projection(),x=(event.clientX-box.left)*replacement.width/box.width,y=(event.clientY-box.top)*replacement.height/box.height,field=active();let best=.8,index=-1;
    for(let i=0;i<field.count;i++){const d=Math.hypot(field.x[i]-(x-p.cx)/p.scale,field.y[i]+(y-p.cy)/p.scale);if(d<best){best=d;index=i;}}
    science.selected=index;selectedGeneration=field.generation[index];needsDraw=true;updateMeasurements(true);
  });
  draw=()=>{
    const {w,h,scale,cx,cy}=projection(),field=active();average(sim);average(control);const cache=average(field);
    ctx.clearRect(0,0,w,h);
    if(science.lens==='density'){
      for(let i=0;i<cache.sum.length;i++){
        const d=Math.max(0,Math.min(2.4,cache.sum[i]/cache.frames.length)),k=((159-Math.floor(i/64))*64+i%64)*4;
        const a=d<=1?[10+61*d,29+68*d,51+61*d]:[71+Math.min(1,(d-1)/.65)*181,97+Math.min(1,(d-1)/.65)*109,112-Math.min(1,(d-1)/.65)*9];
        pixels.data[k]=a[0];pixels.data[k+1]=a[1];pixels.data[k+2]=a[2];pixels.data[k+3]=255;
      }
      mapContext.putImageData(pixels,0,0);ctx.globalAlpha=.9;ctx.drawImage(mapCanvas,cx-field.width/2*scale,cy-field.length/2*scale,field.width*scale,field.length*scale);
    }else{
      ctx.fillStyle='#cfdfeb';
      for(let i=0;i<field.count;i++){ctx.globalAlpha=(.3+hash(i+1)*.6)*(science.lens==='paths'?.4:1);ctx.fillRect(cx+field.x[i]*scale,cy-field.y[i]*scale,Math.max(1,field.size[i]*scale),Math.max(1,field.size[i]*scale));}
    }
    if(science.lens==='paths'){
      if(traceMass!==field.mass){traceMass=field.mass;traces=[-5,-3,-2,-1,.8,1.5,2.5,4.5].map(x=>window.RingDynamics.streamline(field.mass,x));}
      ctx.globalAlpha=.8;ctx.lineWidth=1;
      for(const trace of traces){ctx.strokeStyle=trace.points[0][0]<0?'#e4c38b':'#8cd5e9';ctx.beginPath();trace.points.forEach((point,i)=>{const x=cx+point[0]*scale,y=cy-point[1]*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
    }
    const showGuide=(science.guide||science.lens==='paths')&&field.mass>0;
    const equilibrium=Math.sqrt(Math.max(0,field.hillRadius**2-field.softening**2));
    if(showGuide){
      ctx.globalAlpha=.65;ctx.strokeStyle='#e4c38b';ctx.fillStyle='#e4c38b';ctx.beginPath();ctx.arc(cx,cy,field.hillRadius*scale,0,Math.PI*2);ctx.stroke();
      for(const sign of [-1,1]){ctx.beginPath();ctx.arc(cx+sign*equilibrium*scale,cy,2.5,0,Math.PI*2);ctx.fill();}
    }
    const pixelRatio=w/replacement.clientWidth;
    for(const [id,x,y] of [['hillLabel',cx,cy-field.hillRadius*scale],['l1Label',cx-equilibrium*scale,cy],['l2Label',cx+equilibrium*scale,cy]]){
      const element=document.getElementById(id);element.hidden=!showGuide;element.style.left=x/pixelRatio+'px';element.style.top=y/pixelRatio+'px';
    }
    ctx.globalAlpha=1;ctx.fillStyle='#e4d4ad';ctx.beginPath();ctx.arc(cx,cy,field.bodyRadius*scale,0,Math.PI*2);ctx.fill();
    if(science.selected>=0&&field.generation[science.selected]!==selectedGeneration){science.selected=-1;updateMeasurements(true);}
    if(science.lens==='light'&&field.mass){ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(cx,cy,field.bodyRadius*scale/Math.sin(science.sun*Math.PI/180),field.bodyRadius*scale,-.608,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();}
    if(science.selected>=0){ctx.strokeStyle='#fbe4aa';ctx.beginPath();ctx.arc(cx+field.x[science.selected]*scale,cy-field.y[science.selected]*scale,5,0,Math.PI*2);ctx.stroke();}
  };
  replacement.dataset.renderer='canvas';
}
async function init(){
  try{if(query.get('renderer')==='canvas')createFallback();else await create3D();}catch(error){console.warn('Ring observatory uses its overhead view:',error.message);createFallback();}
  resize();addEventListener('resize',resize);new ResizeObserver(resize).observe(document.querySelector('.ring-world'));
  // Start with an established flow. Reset deliberately returns to undisturbed ice.
  for(let i=0;i<10;i++){sim.advance(.6);control.advance(.6);draw();await new Promise(resolve=>requestAnimationFrame(resolve));}
  ready=true;status.hidden=true;canvas.dataset.state='ready';updateLabels();requestAnimationFrame(frame);
}
function frame(now){
  requestAnimationFrame(frame);const elapsed=last?Math.min(.065,(now-last)/1000):0;last=now;
  if(document.hidden||!ready)return;
  if(!paused){const dt=elapsed*(+speed.value)*.9;sim.advance(dt);control.advance(dt);}
  if(!paused||needsDraw){needsDraw=draw()===true;canvas.dataset.time=sim.time.toFixed(3);updateMeasurements();}
}
init();
