import {createDensityAverage} from './ring-science.js?v=20261030-nocturne1';
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
// Dye-line tracers: the same equations as the ice, released on demand.
const DYE=240,dye=new RingPatch(DYE),dyeLive=new Uint8Array(DYE),dyeGeneration=new Uint32Array(DYE);
function releaseDye(){
  const field=active(),reach=Math.max(.8,Math.cbrt(Math.max(.2,field.mass)));
  dye.setMass(field.mass);dye.time=field.time;
  for(let i=0;i<DYE;i++){
    // Inner ice (x<0) overtakes from behind; outer ice (x>0) arrives from ahead.
    const inner=i<DYE/2,t=(i%(DYE/2))/(DYE/2-1),x=(inner?-1:1)*(.3+t*5.4)*reach;
    dye.x[i]=x;dye.y[i]=inner?-15:15;dye.vx[i]=0;dye.vy[i]=-1.5*x;
    dyeLive[i]=Math.abs(x)<sim.width/2?1:0;dyeGeneration[i]=dye.generation[i];
  }
  dyeReleased=true;needsDraw=true;
}
function advanceDye(dt){
  if(!dyeReleased)return;
  dye.advance(dt);let any=false;
  for(let i=0;i<DYE;i++){if(dye.generation[i]!==dyeGeneration[i])dyeLive[i]=0;any||=dyeLive[i]===1;}
  if(!any)dyeReleased=false;
}
let dyeReleased=false;
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
  document.getElementById('reticleSize').textContent=sim.mass?'· '+Math.round(physical(sim.mass).hillMeters)+' m':'';
  for(const [key,button] of Object.entries(lensButtons))button.setAttribute('aria-pressed',String(science.lens===key));
  document.body.dataset.lens=science.lens;document.body.dataset.control=String(science.compare);
  document.getElementById('ringCompare').setAttribute('aria-pressed',String(science.compare));
  mass.disabled=science.compare;
  document.getElementById('densityKey').hidden=science.lens!=='density';
  document.getElementById('lensHint').textContent=science.compare?'Control: same seeds and clock, without moonlet gravity':science.lens==='paths'?'Inner ice overtakes · outer ice falls behind':science.lens==='density'?'Short rolling average · actual grain counts':'Sunlit ice · tap a grain to follow its passage';
  updateMeasurements(true);
  canvas.dataset.paused=String(paused);canvas.dataset.view=view;canvas.dataset.mass=String(sim.mass);canvas.dataset.lens=science.lens;canvas.dataset.control=String(science.compare);
}
mass.addEventListener('input',()=>{sim.setMass(+mass.value);if(!science.compare)dye.setMass(sim.mass);drawTime=-1;updateLabels();});
speed.addEventListener('input',updateLabels);
pause.addEventListener('click',()=>{paused=!paused;updateLabels();});
reset.addEventListener('click',()=>{sim.reset();control.reset();dyeLive.fill(0);dyeReleased=false;science.selected=-1;scienceLayers?.reset();drawTime=-1;needsDraw=true;updateMeasurements(true);status.textContent='A fresh stream. Watch the moonlet shape it.';status.hidden=false;setTimeout(()=>{status.hidden=true;},2400);});
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
document.getElementById('ringCompare').addEventListener('click',()=>{science.compare=!science.compare;dyeLive.fill(0);dyeReleased=false;science.selected=-1;scienceLayers?.reset();drawTime=-1;updateLabels();});
document.getElementById('gravityGuide').addEventListener('change',event=>{science.guide=event.target.checked;needsDraw=true;});
document.getElementById('sunAngle').addEventListener('input',event=>{science.sun=+event.target.value;document.getElementById('sunValue').value=science.sun+'°';needsDraw=true;});
document.getElementById('clearProbe').addEventListener('click',()=>{science.selected=-1;needsDraw=true;updateMeasurements(true);});
document.getElementById('ringStep').addEventListener('click',async()=>{
  if(busy||!ready)return;busy=true;paused=true;document.getElementById('ringStep').disabled=true;updateLabels();
  for(let i=0;i<8;i++){sim.advance(Math.PI/16);control.advance(Math.PI/16);advanceDye(Math.PI/16);draw();updateMeasurements(true);await new Promise(resolve=>requestAnimationFrame(resolve));}
  busy=false;document.getElementById('ringStep').disabled=false;needsDraw=true;updateLabels();
});
document.getElementById('ringDye').addEventListener('click',releaseDye);
// Model vs Cassini: a grayscale density snapshot, turned to the image's diagonal.
const card=document.getElementById('propellerCard'),openCompare=document.getElementById('openCompare');
const simCanvas=document.getElementById('propellerSim'),simContext=simCanvas.getContext('2d');
// A coarse 32 × 80 count grid (0.75 × 0.8 Hill lengths per cell), averaged over
// the last 12 samples (~42 grains per cell), shows the moonlet's neighbourhood.
const snapshot=document.createElement('canvas');snapshot.width=32;snapshot.height=80;
const snapshotContext=snapshot.getContext('2d'),snapshotPixels=snapshotContext.createImageData(32,80);
let compareTimer=0,compareFrames=[],compareField=null,compareTime=-1;
function drawComparison(){
  const field=active(),w=simCanvas.width,h=simCanvas.height;
  if(field!==compareField||field.time<compareTime){compareFrames=[];compareField=field;}
  if(field.time!==compareTime){compareTime=field.time;compareFrames.push(density(field,32,80).values);if(compareFrames.length>12)compareFrames.shift();}
  for(let i=0;i<32*80;i++){
    let d=0;for(const frame of compareFrames)d+=frame[i];d/=compareFrames.length;
    // Contrast is stretched around the mean so lanes and lobes read at a glance.
    const v=Math.max(0,Math.min(255,Math.round(112+165*(d-1)))),k=((79-Math.floor(i/32))*32+i%32)*4;
    snapshotPixels.data[k]=snapshotPixels.data[k+1]=snapshotPixels.data[k+2]=v;snapshotPixels.data[k+3]=255;
  }
  snapshotContext.putImageData(snapshotPixels,0,0);
  simContext.fillStyle='#000';simContext.fillRect(0,0,w,h);
  // The stream's long axis runs up and to the right, like the lanes in PIA12790.
  const scale=Math.hypot(w,h)*1.02/60;
  simContext.save();simContext.translate(w/2,h/2);simContext.rotate(.93);simContext.imageSmoothingEnabled=true;
  simContext.drawImage(snapshot,6,10,20,60,-10*scale,-30*scale,20*scale,60*scale);
  simContext.restore();
  document.getElementById('propellerScale').textContent=field.mass?'Hill radius '+Math.round(physical(field.mass).hillMeters)+' m · view 1.5 × 4.8 km':'No moonlet: the lanes stay uniform';
}
function setCompare(open){
  card.hidden=!open;openCompare.setAttribute('aria-expanded',String(open));clearInterval(compareTimer);
  if(open){drawComparison();compareTimer=setInterval(drawComparison,200);}
}
openCompare.addEventListener('click',()=>setCompare(card.hidden));
document.getElementById('closeCompare').addEventListener('click',()=>{setCompare(false);openCompare.focus();});
addEventListener('keydown',e=>{if((e.key==='d'||e.key==='D')&&!e.metaKey&&!e.ctrlKey&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName))releaseDye();});
updateLabels();
document.getElementById('ringPanel').addEventListener('click',event=>{
  const closed=document.body.classList.toggle('ring-quiet');
  event.currentTarget.setAttribute('aria-expanded',String(!closed));event.currentTarget.textContent=closed?'Show controls':'Hide controls';
  document.getElementById('ringGesture').hidden=closed;
});

// Overhead radar: actual particle positions, the Hill sphere and the dye line.
const radar=document.getElementById('ringRadar'),radarContext=radar.getContext('2d');let radarTick=0,radarYaw=0;
function drawRadar(){
  const field=active(),g=radarContext,w=radar.width,h=radar.height,k=w/field.width;
  g.fillStyle='rgba(4,10,18,.55)';g.fillRect(0,0,w,h);
  g.fillStyle='rgba(176,214,236,.5)';
  const sy=h/field.length;
  for(let i=0;i<field.count;i+=2){const x=w/2+field.x[i]*k,y=h/2-field.y[i]*sy;if(x>=0&&x<w&&y>=0&&y<h)g.fillRect(x,y,1,1);}
  if(dyeReleased)for(let i=0;i<DYE;i++){if(!dyeLive[i])continue;g.fillStyle=dye.x[i]<0?'#ffd58f':'#8fe3ff';g.fillRect(w/2+dye.x[i]*k-1,h/2-dye.y[i]*sy-1,2,2);}
  if(field.mass>0){
    g.strokeStyle='rgba(143,227,255,.7)';g.setLineDash([2,2]);g.beginPath();g.ellipse(w/2,h/2,field.hillRadius*k,field.hillRadius*sy,0,0,Math.PI*2);g.stroke();g.setLineDash([]);
    g.fillStyle='#f1e3c2';g.beginPath();g.arc(w/2,h/2,Math.max(1.5,field.bodyRadius*k),0,Math.PI*2);g.fill();
  }
  // Viewing direction wedge.
  g.strokeStyle='rgba(241,214,160,.55)';g.beginPath();g.moveTo(w/2,h/2);
  const a=Math.atan2(-Math.cos(radarYaw),-Math.sin(radarYaw));g.lineTo(w/2+Math.cos(a-.35)*40,h/2+Math.sin(a-.35)*40);g.moveTo(w/2,h/2);g.lineTo(w/2+Math.cos(a+.35)*40,h/2+Math.sin(a+.35)*40);g.stroke();
}

// Saturn's rings in scene units of 886 km (Saturn's equatorial radius = 68).
// Radii follow the C, B and A rings, Cassini Division, Encke and Keeler gaps
// and the F ring; the fine ringlet texture is procedural.
const RING_GLSL=`
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
float ringlets(float r){return .5+.22*sin(r*7.3)+.14*sin(r*19.7+1.3)+.1*sin(r*43.1)+.08*(h1(floor(r*9.))-.5);}
float ringDensity(float r){
  float c=smoothstep(83.5,85.,r)*(1.-smoothstep(103.,104.5,r))*(.1+.08*ringlets(r));
  float b=smoothstep(103.5,105.,r)*(1.-smoothstep(132.4,133.,r))*(.62+.3*ringlets(r*.7));
  float a=smoothstep(137.6,138.4,r)*(1.-smoothstep(153.6,154.2,r))*(.42+.16*ringlets(r*1.3));
  a*=1.-(1.-smoothstep(.12,.4,abs(r-151.)))*.95;a*=1.-(1.-smoothstep(.02,.09,abs(r-153.1)))*.9;
  float f=exp(-pow((r-158.2)/.12,2.))*.35;
  return clamp(c+b+a+f,0.,1.);
}
vec3 ringTint(float r){
  vec3 cRing=vec3(.55,.56,.6),bRing=vec3(.86,.78,.64),aRing=vec3(.78,.74,.68);
  return r<104.?cRing:r<134.?bRing*(.92+.1*ringlets(r*2.1)):aRing*(.95+.06*ringlets(r*3.));
}`;
async function create3D(){
  const [T,instruments]=await Promise.all([import('./vendor/three/three.module.js'),import('./ring-science.js?v=20261030-nocturne1')]);
  renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:!coarse,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.6));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new T.Scene();scene.fog=new T.FogExp2(0x070d18,.0032);
  const camera=new T.PerspectiveCamera(51,1,.05,1400),target=new T.Vector3(0,0,0);
  scienceLayers=instruments.createScience(T,scene);
  const sunDirection={value:new T.Vector3()},moonSize={value:sim.bodyRadius},clock={value:0};
  const SATURN=new T.Vector3(-146.7,0,0),SATURN_R=68;
  // Deep, low-contrast shadows: the rings are lit by one distant sun.
  scene.add(new T.HemisphereLight(0x7d97bc,0x070b12,.55));
  const sun=new T.DirectionalLight(0xfff0d8,5.4);scene.add(sun);
  const saturnshine=new T.DirectionalLight(0xe7c999,.55);saturnshine.position.copy(SATURN);scene.add(saturnshine);

  // Saturn: banded clouds, a soft terminator, a cold limb and the rings' shadow.
  const bands=document.createElement('canvas');bands.width=8;bands.height=512;
  const bc=bands.getContext('2d'),palette=[[214,196,160],[196,170,128],[226,210,176],[184,156,118],[205,186,150],[170,150,128],[150,160,170]];
  for(let y=0;y<512;y++){
    const lat=Math.abs(y/512-.5)*2,p=palette[Math.floor(hash(Math.floor(y/9)+3)*5)],polar=Math.max(0,(lat-.78)/.22);
    const ripple=.9+.07*Math.sin(y*.9)+.04*Math.sin(y*2.7)+.03*hash(y);
    const c=p.map((v,i)=>v*ripple*(1-polar)+palette[6][i]*polar*.9);
    bc.fillStyle=`rgb(${c.map(Math.round).join(',')})`;bc.fillRect(0,y,8,1);
  }
  const bandTexture=new T.CanvasTexture(bands);bandTexture.colorSpace=T.SRGBColorSpace;
  const planet=new T.Mesh(new T.SphereGeometry(SATURN_R,96,64),new T.ShaderMaterial({
    uniforms:{map:{value:bandTexture},uSun:sunDirection,uCenter:{value:SATURN}},
    vertexShader:'varying vec3 vN,vW;varying vec2 vUv;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`precision highp float;uniform sampler2D map;uniform vec3 uSun,uCenter;varying vec3 vN,vW;varying vec2 vUv;${RING_GLSL}
    void main(){
      vec3 n=normalize(vN),v=normalize(cameraPosition-vW);float ndl=dot(n,uSun);
      vec3 albedo=texture2D(map,vec2(.5,vUv.y)).rgb;
      float light=smoothstep(-.06,.3,ndl)*(.35+.65*max(ndl,0.));
      // Ring shadow: follow the sunbeam to the ring plane.
      float t=-(vW.y-uCenter.y)/uSun.y;float shade=1.;
      if(t>0.){vec3 q=vW+uSun*t;shade=1.-.85*ringDensity(length(q.xz-uCenter.xz));}
      vec3 night=albedo*vec3(.05,.06,.09)*(.6+.4*max(-n.y*sign(uSun.y),0.));
      vec3 col=albedo*light*shade*1.15+night;
      float rim=pow(1.-max(dot(n,v),0.),3.);col+=vec3(.45,.62,.85)*rim*.5*smoothstep(-.2,.4,ndl);
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`,fog:false}));
  planet.position.copy(SATURN);scene.add(planet);

  // The ring system, lit by the sun, eclipsed by Saturn, glowing forward.
  const ring=new T.Mesh(new T.RingGeometry(83,160,384,1),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,
    uniforms:{uSun:sunDirection,uCenter:{value:SATURN},uR:{value:SATURN_R}},
    vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`precision highp float;uniform vec3 uSun,uCenter;uniform float uR;varying vec3 vW;${RING_GLSL}
    void main(){
      float r=length(vW.xz-uCenter.xz),d=ringDensity(r);
      vec3 oc=vW-uCenter;float b=dot(oc,uSun),miss=length(cross(oc,uSun));
      float eclipse=b<0.?1.-smoothstep(uR*.97,uR*1.03,miss):0.;
      vec3 view=normalize(vW-cameraPosition);
      bool litSide=sign(cameraPosition.y-vW.y)==sign(uSun.y);
      float lit=litSide?.55+.6*abs(uSun.y):.18+.25*(1.-d);
      float forward=pow(max(dot(view,uSun),0.),6.);
      vec3 col=ringTint(r)*lit*(1.-.92*eclipse)+vec3(1.,.86,.66)*forward*.4*(1.-eclipse);
      // Fade the floor beneath the simulated window so the live ice reads first.
      float near=smoothstep(10.,26.,length(vW.xz));
      gl_FragColor=vec4(col,d*(.38+.62*near));
      #include <colorspace_fragment>
    }`,fog:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(SATURN.x,-.12,0);scene.add(ring);

  // Stars with gentle colour variety and a faint galactic band.
  const starCount=2600,starPositions=new Float32Array(starCount*3),starColors=new Float32Array(starCount*3);
  for(let i=0;i<starCount;i++){
    const band=i%3===0;let a=hash(i+111)*Math.PI*2,u=hash(i+791)*2-1;
    if(band)u=(hash(i+33)-.5)*.25+Math.sin(a*2)*.12;
    const r=900;starPositions[i*3]=r*Math.sqrt(1-u*u)*Math.cos(a);starPositions[i*3+1]=r*u;starPositions[i*3+2]=r*Math.sqrt(1-u*u)*Math.sin(a);
    const warm=hash(i+404),k=.55+.45*hash(i+505);
    starColors.set([k*(.8+.2*warm),k*(.85+.05*warm),k*(1-.2*warm)],i*3);
  }
  const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new T.BufferAttribute(starColors,3));
  scene.add(new T.Points(starGeometry,new T.PointsMaterial({size:1.1,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true,fog:false,depthWrite:false})));

  // Faceted ice. Each grain's tumble is computed on the GPU from its index,
  // so the CPU only writes positions every frame.
  const geometry=new T.IcosahedronGeometry(1,0),pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),rough=1+.13*Math.sin(x*14+y*19+z*27);
    pos.setXYZ(i,x*rough,y*rough,z*rough);
  }
  geometry.computeVertexNormals();
  const TUMBLE=`
    float seed=float(gl_InstanceID);
    float spin=uTime*(.15+.45*fract(sin(seed*12.9898)*43758.5453));
    vec3 axis=normalize(vec3(fract(sin(seed*3.1)*91.7)-.5,fract(sin(seed*7.7)*53.3)-.5,fract(sin(seed*5.3)*37.1)-.5)+.001);
    float cs=cos(spin),sn=sin(spin);
    mat3 tumble=mat3(cs+axis.x*axis.x*(1.-cs),axis.y*axis.x*(1.-cs)+axis.z*sn,axis.z*axis.x*(1.-cs)-axis.y*sn,
      axis.x*axis.y*(1.-cs)-axis.z*sn,cs+axis.y*axis.y*(1.-cs),axis.z*axis.y*(1.-cs)+axis.x*sn,
      axis.x*axis.z*(1.-cs)+axis.y*sn,axis.y*axis.z*(1.-cs)-axis.x*sn,cs+axis.z*axis.z*(1.-cs));`;
  const material=coarse?new T.MeshStandardMaterial({color:0xe6eef4,roughness:.26,metalness:.04,flatShading:true}):
    new T.MeshPhysicalMaterial({color:0xf0f6fa,roughness:.16,metalness:.02,clearcoat:.5,clearcoatRoughness:.15,transmission:.22,thickness:.12,ior:1.31,flatShading:true,sheen:.4,sheenColor:0x9fd6ff});
  material.transparent=true;material.opacity=.95;material.depthWrite=false;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uSunDirection=sunDirection;shader.uniforms.uMoonRadius=moonSize;shader.uniforms.uTime=clock;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;varying float edgeOpacity;varying vec3 worldGrain;')
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n'+TUMBLE+'\nobjectNormal=tumble*objectNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=tumble*transformed;\nworldGrain=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;\nedgeOpacity=(1.-smoothstep(9.,12.,abs(instanceMatrix[3].x)))*(1.-smoothstep(27.,32.,abs(instanceMatrix[3].z)));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float edgeOpacity;varying vec3 worldGrain;uniform vec3 uSunDirection;uniform float uMoonRadius;')
      .replace('#include <alphatest_fragment>','diffuseColor.a*=edgeOpacity;\n#include <alphatest_fragment>')
      .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nfloat shadowRay=-dot(worldGrain,uSunDirection);float impact=length(cross(worldGrain,uSunDirection));float shadowFactor=1.-step(0.,shadowRay)*(1.-smoothstep(uMoonRadius*.88,uMoonRadius*1.12+.0001,impact))*.88;reflectedLight.directDiffuse*=shadowFactor;reflectedLight.directSpecular*=shadowFactor*1.6;');
  };
  // Context ice beyond the simulated window streams with the same Kepler shear,
  // advanced entirely in the vertex shader.
  const distantCount=coarse?2400:4800;
  const distantMaterial=new T.MeshStandardMaterial({color:0xa9bfcf,roughness:.45,metalness:.04,flatShading:true,transparent:true,opacity:.5,depthWrite:false});
  distantMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uShear=clock;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uShear;')
      .replace('#include <project_vertex>',`vec4 ip=instanceMatrix*vec4(transformed,1.);float x0=instanceMatrix[3].x,z0=instanceMatrix[3].z;
        ip.z+=mod(z0+1.5*x0*uShear+80.,160.)-80.-z0;vec4 mvPosition=modelViewMatrix*ip;gl_Position=projectionMatrix*mvPosition;`);
  };
  const distant=new T.InstancedMesh(geometry,distantMaterial,distantCount);distant.frustumCulled=false;scene.add(distant);
  const dummy=new T.Object3D(),color=new T.Color();
  for(let i=0;i<distantCount;i++){
    const x=(i%2?1:-1)*(9+hash(i+752)*26),size=.04+hash(i+431)**3*.2;
    dummy.position.set(x,(hash(i+61)-.5)*.2,-(hash(i+843)*160-80));dummy.rotation.set(i*.7,i,i*.31);dummy.scale.set(size,size*.7,size);dummy.updateMatrix();distant.setMatrixAt(i,dummy.matrix);
  }
  const grains=new T.InstancedMesh(geometry,material,sim.count);grains.instanceMatrix.setUsage(T.DynamicDrawUsage);grains.frustumCulled=false;scene.add(grains);
  // Shape and scale are fixed per grain; only the translation changes per frame.
  for(let i=0;i<sim.count;i++){
    const size=sim.size[i]*(i%97===0?1.9:.95);
    dummy.position.set(0,0,0);dummy.rotation.set(sim.phase[i],sim.phase[i]*2,sim.phase[i]*.7);
    dummy.scale.set(size*(.7+hash(i+98)*.6),size*(.55+hash(i+78)*.65),size);dummy.updateMatrix();grains.setMatrixAt(i,dummy.matrix);
    const mix=hash(i+329),blue=hash(i+77)<.15;color.setRGB(.74+mix*.24,.83+mix*.15,blue?1:.88+mix*.12);grains.setColorAt(i,color);
  }
  const grainMatrix=grains.instanceMatrix.array;

  // Fine sunlit dust glitters when the view looks toward the sun.
  const dustCount=coarse?6000:14000,dustPositions=new Float32Array(dustCount*3);
  for(let i=0;i<dustCount;i++)dustPositions.set([(hash(i+1301)-.5)*60,(hash(i+1703)-.5)*.35,(hash(i+1907)-.5)*160],i*3);
  const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));
  const dust=new T.Points(dustGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{uTime:clock,uSun:sunDirection,uPixel:{value:1}},
    vertexShader:`uniform float uTime,uPixel;uniform vec3 uSun;varying float vGlow;
      void main(){vec3 p=position;p.z=mod(p.z+1.5*p.x*uTime+80.,160.)-80.;vec4 mv=modelViewMatrix*vec4(p,1.);
        vec3 view=normalize((modelMatrix*vec4(p,1.)).xyz-cameraPosition);
        float twinkle=.5+.5*sin(uTime*3.+position.x*13.+position.z*7.);
        vGlow=(.18+1.2*pow(max(dot(view,uSun),0.),4.))*(.4+.6*twinkle)*(1.-smoothstep(25.,30.,abs(p.x)));
        gl_PointSize=uPixel*(1.4+1.6*twinkle)*(18./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`precision highp float;varying float vGlow;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(.85,.93,1.)*vGlow,1.-d*2.);}`
  }));
  dust.frustumCulled=false;scene.add(dust);

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
  const moon=new T.Mesh(moonGeo,new T.MeshStandardMaterial({color:0xd3cdbd,roughness:.95}));scene.add(moon);
  const shadow=new T.Mesh(new T.PlaneGeometry(32,32),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uSunDirection:sunDirection,uMoonRadius:moonSize},
    vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'precision highp float;varying vec3 world;uniform vec3 uSunDirection;uniform float uMoonRadius;void main(){float t=-dot(world,uSunDirection),d=length(cross(world,uSunDirection));float a=step(0.,t)*(1.-smoothstep(uMoonRadius*.85,uMoonRadius*1.15+.0001,d))*.5;gl_FragColor=vec4(.01,.015,.025,a);}'
  }));shadow.rotation.x=-Math.PI/2;shadow.position.y=.002;scene.add(shadow);

  // Dye tracers glow on top, each trailing its recent path.
  const TRAIL=40,dyeTrail=new Float32Array(DYE*TRAIL*3),dyeHead=new Int16Array(DYE).fill(-1);
  const dyeColors=new Float32Array(DYE*3);for(let i=0;i<DYE;i++)dyeColors.set(i<DYE/2?[1,.78,.45]:[.5,.88,1],i*3);
  const dyeGeometry=new T.BufferGeometry();dyeGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(DYE*3),3).setUsage(T.DynamicDrawUsage));
  dyeGeometry.setAttribute('color',new T.BufferAttribute(dyeColors,3));
  const dyeAlive=new T.BufferAttribute(new Float32Array(DYE),1).setUsage(T.DynamicDrawUsage);dyeGeometry.setAttribute('alive',dyeAlive);
  const dyePoints=new T.Points(dyeGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,vertexColors:true,uniforms:{uPixel:{value:1}},
    vertexShader:'attribute float alive;uniform float uPixel;varying vec3 vColor;varying float vAlive;void main(){vColor=color;vAlive=alive;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=alive*uPixel*(5.+90./-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'precision highp float;varying vec3 vColor;varying float vAlive;void main(){float d=length(gl_PointCoord-.5);if(d>.5||vAlive<.5)discard;float core=exp(-d*d*40.),halo=exp(-d*d*9.)*.45;gl_FragColor=vec4(vColor*1.4,min(1.,core+halo));}'
  }));dyePoints.frustumCulled=false;dyePoints.renderOrder=5;scene.add(dyePoints);
  const segments=DYE*(TRAIL-1),trailPositions=new Float32Array(segments*6),trailColors=new Float32Array(segments*6);
  const trailGeometry=new T.BufferGeometry();
  trailGeometry.setAttribute('position',new T.BufferAttribute(trailPositions,3).setUsage(T.DynamicDrawUsage));
  trailGeometry.setAttribute('color',new T.BufferAttribute(trailColors,3).setUsage(T.DynamicDrawUsage));
  const trails=new T.LineSegments(trailGeometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
  trails.frustumCulled=false;trails.renderOrder=4;scene.add(trails);
  let dyeTime=-1;
  function updateDye(){
    dyePoints.visible=trails.visible=dyeReleased;if(!dyeReleased||dye.time===dyeTime)return;dyeTime=dye.time;
    const p=dyeGeometry.attributes.position.array;let s=0;
    for(let i=0;i<DYE;i++){
      const live=dyeLive[i];dyeAlive.array[i]=live;
      const x=dye.x[i],z=-dye.y[i];p[i*3]=x;p[i*3+1]=.12;p[i*3+2]=z;
      if(!live){dyeHead[i]=-1;}
      else{
        const base=i*TRAIL*3;
        if(dyeHead[i]<0){for(let k=0;k<TRAIL;k++)dyeTrail.set([x,.12,z],base+k*3);dyeHead[i]=0;}
        else{const h=(dyeHead[i]+1)%TRAIL;dyeTrail.set([x,.12,z],base+h*3);dyeHead[i]=h;}
      }
      const c=dyeColors.subarray(i*3,i*3+3),base=i*TRAIL*3;
      for(let k=0;k<TRAIL-1;k++){
        const a=(dyeHead[i]-k+TRAIL)%TRAIL,b=(a-1+TRAIL)%TRAIL,fade=live?(1-k/(TRAIL-1))*.55:0;
        trailPositions.set(dyeTrail.subarray(base+a*3,base+a*3+3),s);trailPositions.set(dyeTrail.subarray(base+b*3,base+b*3+3),s+3);
        trailColors.set([c[0]*fade,c[1]*fade,c[2]*fade,c[0]*fade*.85,c[1]*fade*.85,c[2]*fade*.85],s);s+=6;
      }
    }
    dyeGeometry.attributes.position.needsUpdate=true;dyeAlive.needsUpdate=true;
    trailGeometry.attributes.position.needsUpdate=true;trailGeometry.attributes.color.needsUpdate=true;
  }

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
  resize=()=>{
    needsDraw=true;const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);
    const pixel=renderer.getPixelRatio();dust.material.uniforms.uPixel.value=pixel;dyePoints.material.uniforms.uPixel.value=pixel;
    camera.aspect=rect.width/rect.height;camera.setViewOffset(rect.width,rect.height,0,rect.height*.12,rect.width,rect.height);camera.updateProjectionMatrix();
  };
  draw=()=>{
    for(const key of ['yaw','pitch','distance'])orbit[key]+=(orbit[key+'Goal']-orbit[key])*.09;
    radarYaw=orbit.yaw;
    const horizontal=orbit.distance*Math.cos(orbit.pitch);
    camera.position.set(Math.sin(orbit.yaw)*horizontal,Math.sin(orbit.pitch)*orbit.distance,Math.cos(orbit.yaw)*horizontal);camera.lookAt(target);
    const field=active(),angle=science.sun*Math.PI/180;
    // Side light from the camera's left keeps Saturn half lit and the ice sculpted.
    sunDirection.value.set(-Math.cos(angle)*.55,Math.sin(angle),Math.cos(angle)*.83).normalize();sun.position.copy(sunDirection.value).multiplyScalar(70);moonSize.value=science.compare?0:sim.bodyRadius;
    clock.value=sim.time;
    if(field.time!==drawTime){
      for(let i=0;i<sim.count;i++){
        const o=i*16+12;grainMatrix[o]=field.x[i];grainMatrix[o+1]=field.height[i]*Math.cos(field.time+field.phase[i]);grainMatrix[o+2]=-field.y[i];
      }
      grains.instanceMatrix.needsUpdate=true;drawTime=field.time;
    }
    updateDye();
    moon.visible=field.mass>0;moon.scale.setScalar(field.bodyRadius);shadow.visible=moon.visible&&science.lens==='light';
    grains.visible=science.lens!=='density';material.opacity=science.lens==='paths'?.36:.95;distant.visible=dust.visible=science.lens==='light';
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
    if(science.lens==='light'&&field.mass){ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(cx,cy,field.bodyRadius*scale/Math.sin(science.sun*Math.PI/180),field.bodyRadius*scale,-.985,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();}
    if(dyeReleased)for(let i=0;i<DYE;i++){if(!dyeLive[i])continue;ctx.fillStyle=dye.x[i]<0?'#ffd58f':'#8fe3ff';ctx.beginPath();ctx.arc(cx+dye.x[i]*scale,cy-dye.y[i]*scale,2.2,0,Math.PI*2);ctx.fill();}
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
  if(!paused){const dt=elapsed*(+speed.value)*.9;sim.advance(dt);control.advance(dt);advanceDye(dt);}
  if(++radarTick%2===0)drawRadar();
  if(!paused||needsDraw){needsDraw=draw()===true;canvas.dataset.time=sim.time.toFixed(3);updateMeasurements();}
}
init();
