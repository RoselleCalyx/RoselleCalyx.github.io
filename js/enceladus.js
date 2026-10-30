/* Enceladus plume in the moon's local Hill frame. Lengths are Hill radii
   (about 950 km), time is 1/Omega (about 5.2 h). x points away from Saturn,
   y along the orbit, z north. Saturn's tide, Coriolis terms and Enceladus's
   gravity (mu = 3 in these units) act on non-interacting ice grains. */
const T=await import('./vendor/three/three.module.js');
const canvas=document.getElementById('plumeScene'),status=document.getElementById('plumeStatus');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)').matches;
const MU=3,RADIUS=252/950,VESC=Math.sqrt(2*MU/RADIUS),UNIT_MS=950e3*5.307e-5,HOUR=1/(5.307e-5*3600);
const WORLD=6,COUNT=coarse?7000:15000;
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

// Vents along four parallel tiger stripes around the south pole.
const vents=[];
for(let stripe=0;stripe<4;stripe++)for(let k=0;k<28;k++){
  const along=(k/27-.5)*1.04,across=(stripe-1.5)*.28+.04*Math.sin(k*.7+stripe);
  const a=.6,u=along*Math.cos(a)-across*Math.sin(a),w=along*Math.sin(a)+across*Math.cos(a);
  const n=new T.Vector3(u*.5,w*.5,-1).normalize();vents.push(n);
}

const x=new Float32Array(COUNT),y=new Float32Array(COUNT),z=new Float32Array(COUNT);
const vx=new Float32Array(COUNT),vy=new Float32Array(COUNT),vz=new Float32Array(COUNT);
const alive=new Uint8Array(COUNT),escaping=new Uint8Array(COUNT);
let next=0,time=0,spawnDebt=0,launched=0,escaped=0,jet=1,paused=reduced.matches,fates=false;
function spawn(seed){
  // Reuse a fallen grain's slot first, so escaped grains live on in the stream.
  let i=next;for(let k=0;k<96&&alive[i];k++)i=(i+1)%COUNT;next=(i+1)%COUNT;
  const n=vents[Math.floor(hash(seed)*vents.length)];
  // Mostly sub-escape grains; the tail of the distribution escapes.
  const speed=VESC*jet*(.35+.85*Math.pow(hash(seed+3.1),1.6));
  const tilt=.26*(hash(seed+5.7)-.5),turn=hash(seed+9.3)*Math.PI*2;
  const d=new T.Vector3(n.x+tilt*Math.cos(turn),n.y+tilt*Math.sin(turn),n.z).normalize();
  x[i]=n.x*RADIUS*1.01;y[i]=n.y*RADIUS*1.01;z[i]=n.z*RADIUS*1.01;
  vx[i]=d.x*speed;vy[i]=d.y*speed;vz[i]=d.z*speed;
  alive[i]=1;escaping[i]=speed>VESC?1:0;launched++;escaped+=escaping[i];
}
function step(dt){
  for(let i=0;i<COUNT;i++){
    if(!alive[i])continue;
    // Semi-implicit Euler is stable for these short steps and cheap per grain.
    const r2=x[i]*x[i]+y[i]*y[i]+z[i]*z[i],r=Math.sqrt(r2),k=MU/(r2*r);
    vx[i]+=(2*vy[i]+3*x[i]-k*x[i])*dt;vy[i]+=(-2*vx[i]-k*y[i])*dt;vz[i]+=(-z[i]-k*z[i])*dt;
    x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;z[i]+=vz[i]*dt;
    if(r<RADIUS*.995||Math.abs(x[i])>9||Math.abs(y[i])>70||Math.abs(z[i])>9)alive[i]=0;
  }
}
function advance(duration){
  const steps=Math.max(1,Math.ceil(duration/.004)),dt=duration/steps;
  for(let s=0;s<steps;s++){
    spawnDebt+=dt*COUNT*.45;
    while(spawnDebt>=1){spawn(launched*1.618+time*7.1);spawnDebt--;}
    step(dt);time+=dt;
  }
}
function reset(){alive.fill(0);time=0;launched=escaped=0;spawnDebt=0;}

const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:!coarse,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.6));
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.05,4000);
// Direction toward the Sun. The default camera looks almost into it, as in
// Cassini's backlit images, so grains scatter its light forward.
const SUN=new T.Vector3(-.35,.12,-.93).normalize();
scene.add(new T.HemisphereLight(0x8aa6cc,0x05080e,.35));
const sunLight=new T.DirectionalLight(0xfff2e0,3.2);sunLight.position.copy(SUN).multiplyScalar(50);scene.add(sunLight);
const saturnshine=new T.DirectionalLight(0xe5c99a,.5);saturnshine.position.set(-50,0,0);scene.add(saturnshine);

// Enceladus: bright fresh ice, cratered north, blue-tinted tiger stripes south.
const surface=document.createElement('canvas');surface.width=512;surface.height=256;
const sc=surface.getContext('2d'),pixels=sc.createImageData(512,256);
for(let py=0;py<256;py++)for(let px=0;px<512;px++){
  // three.js sphere UVs: phi around Y (north), theta from the north pole.
  const phi=(px+.5)/512*Math.PI*2,theta=(py+.5)/256*Math.PI;
  const X=-Math.cos(phi)*Math.sin(theta),Y=Math.cos(theta),Z=Math.sin(phi)*Math.sin(theta);
  const hx=X,hy=-Z,hz=Y;// back to the Hill frame used by the vents
  let shade=.9+.05*Math.sin(phi*9+theta*13)+.04*hash(px*7+py*13);
  if(hz>-.55)for(let c=0;c<16;c++){
    const q=new T.Vector3(hash(c+1)-.5,hash(c+2)-.5,hash(c+3)*.9-.1).normalize(),d=Math.hypot(hx-q.x,hy-q.y,hz-q.z)/(.05+hash(c+4)*.1);
    if(d<1.3)shade+=d<1?-.12*(1-d*.5):.05;
  }
  let stripe=0;
  if(hz<-.75){
    const u=hx/-hz,w=hy/-hz,a=.6,along=u*Math.cos(a)+w*Math.sin(a),across=-u*Math.sin(a)+w*Math.cos(a);
    for(let s=0;s<4;s++)stripe=Math.max(stripe,(1-Math.min(1,Math.abs(across/.5-(s-1.5)*.28)/.035))*(Math.abs(along/.5)<.52?1:0));
  }
  const k=(py*512+px)*4;
  pixels.data[k]=(228-150*stripe)*shade;pixels.data[k+1]=(236-90*stripe)*shade;pixels.data[k+2]=(244-10*stripe)*shade;pixels.data[k+3]=255;
}
sc.putImageData(pixels,0,0);
const surfaceTexture=new T.CanvasTexture(surface);surfaceTexture.colorSpace=T.SRGBColorSpace;
const moon=new T.Mesh(new T.SphereGeometry(RADIUS*WORLD,96,64),new T.MeshStandardMaterial({map:surfaceTexture,roughness:.6,metalness:0}));scene.add(moon);

// Saturn and its edge-on rings far away toward -x.
const SATURN_X=-250*WORLD*.4,SATURN_R=63*WORLD*.4;
const bands=document.createElement('canvas');bands.width=4;bands.height=256;
const bc=bands.getContext('2d');
for(let i=0;i<256;i++){const v=.86+.08*Math.sin(i*.35)+.04*Math.sin(i*1.3);bc.fillStyle=`rgb(${210*v|0},${190*v|0},${155*v|0})`;bc.fillRect(0,i,4,1);}
const bandTexture=new T.CanvasTexture(bands);bandTexture.colorSpace=T.SRGBColorSpace;
const saturn=new T.Mesh(new T.SphereGeometry(SATURN_R,64,48),new T.MeshStandardMaterial({map:bandTexture,roughness:1}));
saturn.position.set(SATURN_X,0,0);scene.add(saturn);
const rings=new T.Mesh(new T.RingGeometry(SATURN_R*1.24,SATURN_R*2.27,160,1),new T.MeshBasicMaterial({color:0xcbbd9c,transparent:true,opacity:.55,side:T.DoubleSide,depthWrite:false}));
rings.rotation.x=-Math.PI/2;rings.position.copy(saturn.position);scene.add(rings);
const stars=new Float32Array(2400*3);
for(let i=0;i<2400;i++){const a=hash(i+11)*Math.PI*2,u=hash(i+71)*2-1,r=2500;stars.set([r*Math.sqrt(1-u*u)*Math.cos(a),r*u,r*Math.sqrt(1-u*u)*Math.sin(a)],i*3);}
const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.BufferAttribute(stars,3));
scene.add(new T.Points(starGeometry,new T.PointsMaterial({color:0xc9d6e6,size:1.3,transparent:true,opacity:.7,depthWrite:false})));

// Grains glow by forward scattering toward the viewer; fates colour them.
const positions=new Float32Array(COUNT*3),fateAttribute=new Float32Array(COUNT),liveAttribute=new Float32Array(COUNT);
const grainGeometry=new T.BufferGeometry();
grainGeometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
grainGeometry.setAttribute('fate',new T.BufferAttribute(fateAttribute,1).setUsage(T.DynamicDrawUsage));
grainGeometry.setAttribute('live',new T.BufferAttribute(liveAttribute,1).setUsage(T.DynamicDrawUsage));
const grainMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{uSun:{value:SUN},uPixel:{value:1},uFates:{value:0}},
  vertexShader:`attribute float fate,live;uniform vec3 uSun;uniform float uPixel,uFates;varying vec3 vColor;varying float vLive;
    void main(){vLive=live;vec4 world=modelMatrix*vec4(position,1.);vec3 view=normalize(world.xyz-cameraPosition);
      float forward=pow(max(dot(view,uSun),0.),3.);
      // Grains in the moon's shadow stay dark.
      float b=dot(world.xyz,uSun),miss=length(world.xyz-uSun*b);
      float shadow=b<0.&&miss<${(RADIUS*WORLD).toFixed(3)}?.08:1.;
      vec3 ice=vec3(.82,.9,1.),escape=vec3(.45,.86,1.),fall=vec3(1.,.86,.62);
      vec3 tint=mix(ice,mix(fall,escape,fate),uFates);
      vColor=tint*(.2+1.1*forward)*shadow;
      vec4 mv=viewMatrix*world;gl_PointSize=live*uPixel*(1.+18./-mv.z);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`precision highp float;varying vec3 vColor;varying float vLive;void main(){if(vLive<.5)discard;float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,exp(-d*d*12.));}`
});
const grains=new T.Points(grainGeometry,grainMaterial);grains.frustumCulled=false;scene.add(grains);
// Unresolved fine ice above the vents: a soft haze that brightens toward the
// Sun. Analytic falloff reaches exactly zero at the quad's edges.
const haze=new T.Mesh(new T.PlaneGeometry(RADIUS*WORLD*2.6,RADIUS*WORLD*4.6),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{uStrength:{value:.3}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`precision highp float;uniform float uStrength;varying vec2 vUv;void main(){
    float down=1.-vUv.y,spread=.1+.32*down,across=(vUv.x-.5)/spread;
    float a=exp(-across*across*2.5)*exp(-down*2.6)*smoothstep(0.,.08,vUv.y)*smoothstep(1.,.92,vUv.y)*smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);
    // Alpha carries the falloff: the page canvas is transparent over CSS.
    gl_FragColor=vec4(vec3(.72,.86,1.)*uStrength,a);}`}));
haze.geometry.translate(0,-RADIUS*WORLD*2.3,0);haze.position.set(0,-RADIUS*WORLD*.82,0);scene.add(haze);
// A faint ring marks the Hill sphere, the boundary escaping grains cross.
const hill=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:160},(_,i)=>new T.Vector3(Math.cos(i/160*Math.PI*2)*WORLD,0,Math.sin(i/160*Math.PI*2)*WORLD))),
  new T.LineDashedMaterial({color:0x8fdcff,transparent:true,opacity:.35,dashSize:.25,gapSize:.2,depthWrite:false}));
hill.computeLineDistances();scene.add(hill);

const orbit={yaw:.42,pitch:.06,distance:15,yawGoal:.42,pitchGoal:.06,distanceGoal:15};
const views={backlit:{yaw:.42,pitch:.06,distance:15},ring:{yaw:.25,pitch:.95,distance:150}};
function setView(name){
  Object.assign(orbit,{yawGoal:views[name].yaw,pitchGoal:views[name].pitch,distanceGoal:views[name].distance});
  if(reduced.matches)Object.assign(orbit,views[name]);
  document.getElementById('viewBacklit').setAttribute('aria-pressed',String(name==='backlit'));
  document.getElementById('viewRing').setAttribute('aria-pressed',String(name==='ring'));
}
document.getElementById('viewBacklit').addEventListener('click',()=>setView('backlit'));
document.getElementById('viewRing').addEventListener('click',()=>setView('ring'));
document.getElementById('plumeZoomIn').addEventListener('click',()=>{orbit.distanceGoal=Math.max(4,orbit.distanceGoal/1.25);});
document.getElementById('plumeZoomOut').addEventListener('click',()=>{orbit.distanceGoal=Math.min(260,orbit.distanceGoal*1.25);});
const jetInput=document.getElementById('jetStrength'),timeInput=document.getElementById('plumeTime');
jetInput.addEventListener('input',()=>{jet=+jetInput.value;launched=escaped=0;document.getElementById('jetValue').value=jet.toFixed(2)+'×';});
timeInput.addEventListener('input',()=>{document.getElementById('plumeTimeValue').value=(+timeInput.value).toFixed(1)+'×';});
const pauseButton=document.getElementById('plumePause');
function syncPause(){pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));}
pauseButton.addEventListener('click',()=>{paused=!paused;syncPause();});syncPause();
document.getElementById('plumeFate').addEventListener('click',event=>{
  fates=!fates;event.currentTarget.setAttribute('aria-pressed',String(fates));grainMaterial.uniforms.uFates.value=fates?1:0;
  document.getElementById('plumeState').textContent=fates?'Gold falls back as snow · blue escapes to the E ring':'Jets active along four tiger stripes';
});
document.getElementById('plumeReset').addEventListener('click',reset);
let pointer=null;
canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;orbit.yawGoal-=(e.clientX-pointer.x)*.005;orbit.pitchGoal=Math.max(-1.45,Math.min(1.45,orbit.pitchGoal+(e.clientY-pointer.y)*.004));pointer.x=e.clientX;pointer.y=e.clientY;});
canvas.addEventListener('pointerup',()=>{pointer=null;});canvas.addEventListener('pointercancel',()=>{pointer=null;});
canvas.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();orbit.distanceGoal=Math.max(4,Math.min(260,orbit.distanceGoal*Math.exp(e.deltaY*.001)));},{passive:false});
canvas.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft')orbit.yawGoal-=.12;if(e.key==='ArrowRight')orbit.yawGoal+=.12;
  if(e.key==='ArrowUp')orbit.pitchGoal=Math.min(1.45,orbit.pitchGoal+.08);if(e.key==='ArrowDown')orbit.pitchGoal=Math.max(-1.45,orbit.pitchGoal-.08);
  if(e.key==='+'||e.key==='=')orbit.distanceGoal=Math.max(4,orbit.distanceGoal/1.15);if(e.key==='-')orbit.distanceGoal=Math.min(260,orbit.distanceGoal*1.15);
  if(e.key===' '){e.preventDefault();paused=!paused;syncPause();}
});
function resize(){
  const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);
  camera.aspect=r.width/r.height;camera.setViewOffset(r.width,r.height,0,r.height*.1,r.width,r.height);camera.updateProjectionMatrix();
  grainMaterial.uniforms.uPixel.value=renderer.getPixelRatio();
}
addEventListener('resize',resize);new ResizeObserver(resize).observe(document.querySelector('.ring-world'));resize();

let measured=-1;
function draw(){
  for(const key of ['yaw','pitch','distance'])orbit[key]+=(orbit[key+'Goal']-orbit[key])*.08;
  const h=orbit.distance*Math.cos(orbit.pitch);
  camera.position.set(Math.sin(orbit.yaw)*h,Math.sin(orbit.pitch)*orbit.distance,Math.cos(orbit.yaw)*h);camera.lookAt(0,0,0);
  let live=0,outside=0;
  for(let i=0;i<COUNT;i++){
    // Hill frame (x, y, z) -> world (X, Y, Z) = (x, z, -y), as on the A-ring page.
    positions[i*3]=x[i]*WORLD;positions[i*3+1]=z[i]*WORLD;positions[i*3+2]=-y[i]*WORLD;
    liveAttribute[i]=alive[i];fateAttribute[i]=escaping[i];
    if(alive[i]){live++;if(x[i]*x[i]+y[i]*y[i]+z[i]*z[i]>1)outside++;}
  }
  grainGeometry.attributes.position.needsUpdate=true;grainGeometry.attributes.live.needsUpdate=true;grainGeometry.attributes.fate.needsUpdate=true;
  const toward=camera.position.clone().negate().normalize().dot(SUN);
  haze.quaternion.copy(camera.quaternion);
  haze.material.uniforms.uStrength.value=.05+.55*Math.pow(Math.max(0,toward),3)*Math.min(1.2,jet);
  renderer.render(scene,camera);
  if(Math.abs(time-measured)>.05){
    measured=time;
    document.getElementById('escapeShare').textContent=launched?Math.round(escaped/launched*100)+'%':'—';
    document.getElementById('plumeElapsed').textContent='T + '+(time*HOUR).toFixed(1)+' h';
    document.getElementById('plumeCount').textContent=live.toLocaleString('en')+' grains · '+outside.toLocaleString('en')+' beyond the Hill sphere';
    document.getElementById('escapeSpeed').textContent=Math.round(VESC*UNIT_MS)+' m/s';
  }
}
// Start with a developed plume.
for(let i=0;i<30;i++)advance(.05);
draw();status.hidden=true;canvas.dataset.state='ready';
let last=0;
function frame(now){
  requestAnimationFrame(frame);const elapsed=last?Math.min(.06,(now-last)/1000):0;last=now;
  if(document.hidden)return;
  if(!paused)advance(elapsed*.35*(+timeInput.value));
  draw();
}
requestAnimationFrame(frame);
window.EnceladusPlume={VESC,RADIUS,MU,advance,stats:()=>({time,launched,escaped})};
