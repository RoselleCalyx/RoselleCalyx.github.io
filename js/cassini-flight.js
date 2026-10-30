/* Grand Finale choreography. Geometry inspired by NASA/JPL's petal plot and
   September 2017 end-of-mission press kit. Representative Kepler ellipse,
   compressed time and cinematic camera; not a reconstruction from SPICE. */
(function () {
  const TAU = Math.PI * 2, R = 262;
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const ease = (a,b,v) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  function eccentric(mean,e) {
    let E=mean;
    for(let i=0;i<9;i++)E-=(E-e*Math.sin(E)-mean)/(1-e*Math.cos(E));
    return E;
  }
  // omega turns the ellipse within its own plane (the petal plot's precession).
  function orbit(mean,peri=1.085,omega=0) {
    const apo=3.65,a=(apo+peri)/2,e=(apo-peri)/(apo+peri);
    const E=eccentric(mean,e),q0=a*(Math.cos(E)-e),w0=a*Math.sqrt(1-e*e)*Math.sin(E);
    const q=q0*Math.cos(omega)-w0*Math.sin(omega),w=q0*Math.sin(omega)+w0*Math.cos(omega);
    // 64-degree inclination to the ring plane, seen at its 19-degree opening.
    const inc=64*Math.PI/180,B=.33,tilt=.31;
    const rx=-q,ry=w*(Math.cos(inc)*Math.sin(B)-Math.sin(inc)*Math.cos(B));
    const z=w*(Math.cos(inc)*Math.cos(B)+Math.sin(inc)*Math.sin(B));
    return {x:573+(rx*Math.cos(tilt)-ry*Math.sin(tilt))*R,
      y:318+(rx*Math.sin(tilt)+ry*Math.cos(tilt))*R,z:z*R,E,r:a*(1-e*Math.cos(E))*R};
  }
  // A fixed integration table makes drag, the wake and reverse scrolling agree.
  const ENTRY=.737,STEP=.00025,plunge=[];
  const initial=orbit(Math.PI+TAU*ENTRY/.5,.935);
  const before=orbit(Math.PI+TAU*(ENTRY-1e-6)/.5,.935);
  let state={...initial,vx:(initial.x-before.x)/1e-6,
    vy:(initial.y-before.y)/1e-6,vz:(initial.z-before.z)/1e-6};
  const mu=Math.pow(TAU/.5,2)*Math.pow((3.65+.935)/2,3)*R*R*R;
  for(let i=0;i<600;i++){
    plunge.push({...state});
    const rx=state.x-573,ry=state.y-318,r=Math.hypot(rx,ry,state.z);
    const gravity=mu/Math.pow(r,3),drag=Math.min(450,9*Math.exp((1.03-r/R)*23));
    // Exponential drag integration stays stable as density rises.
    const damping=Math.exp(-drag*STEP);
    state.vx=(state.vx-rx*gravity*STEP)*damping;
    state.vy=(state.vy-ry*gravity*STEP)*damping;
    state.vz=(state.vz-state.z*gravity*STEP)*damping;
    state.x+=state.vx*STEP;state.y+=state.vy*STEP;state.z+=state.vz*STEP;
    state.r=Math.hypot(state.x-573,state.y-318,state.z);
  }
  function descent(p){
    const f=clamp((p-ENTRY)/STEP,0,plunge.length-1),i=Math.floor(f),a=plunge[i],b=plunge[Math.min(i+1,plunge.length-1)],mix=f-i;
    const q={};for(const k of ['x','y','z','r','E','vx','vy','vz'])q[k]=a[k]+(b[k]-a[k])*mix;
    return q;
  }
  // A single scene-space Earth direction, shared with the model renderer.
  // +X is screen right, +Y is screen up, +Z points toward the viewer.
  // This is a chosen cinematic viewing geometry, not a recovered 2017 ephemeris.
  const earthLength=Math.hypot(.78,.59,.21);
  const EARTH=Object.freeze([.78/earthLength,.59/earthLength,.21/earthLength]);
  function multiply(a,b){
    return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
      a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
      a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
      a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  }
  const length=Math.sqrt(2*(1+EARTH[1]));
  const earthLock=[EARTH[2]/length,0,-EARTH[0]/length,(1+EARTH[1])/length];
  function attitude(p){
    // Roll about the antenna axis reveals the asymmetric instruments without
    // steering the dish away from Earth or making the craft turn like a plane.
    const roll=-.105+.16*Math.sin(Math.PI*2*p/.5);
    let q=multiply(earthLock,[0,Math.sin(roll/2),0,Math.cos(roll/2)]);
    // Aerodynamic loss of control starts only after the final transmission.
    const loss=ease(.768,.795,p),pitch=loss*Math.sin((p-.768)*190)*.9;
    const bank=loss*Math.sin((p-.768)*137)*.65;
    q=multiply(q,[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);
    return multiply(q,[0,0,Math.sin(bank/2),Math.cos(bank/2)]);
  }
  function sample(p,mobile=false) {
    // One representative full orbit, then the final half orbit after Titan.
    // Separate clocks keep position and velocity continuous at apocentre.
    const clock=p<=.5?p/.5:1+(p-.5)/.5;
    const mean=Math.PI+TAU*clock;
    const peri=1.085-.15*ease(.50,.72,p);
    const point=p>=ENTRY?descent(p):orbit(mean,peri),reveal=ease(0,.19,p);
    const opening={x:mobile?875:1000,y:mobile?440:370};
    const x=opening.x+(point.x-opening.x)*reveal;
    const y=opening.y+(point.y-opening.y)*reveal;
    const h=.00001,previous=orbit(mean-TAU*h/.5,peri),next=orbit(mean+TAU*h/.5,peri);
    const vx=point.vx??(next.x-previous.x),vy=point.vy??(next.y-previous.y);
    const distanceScale=1/(1+Math.max(-.4,point.z/R)*.12);
    const orientation=attitude(p),angle=-Math.atan2(EARTH[0],EARTH[1]);
    return {...point,x,y,angle,motionAngle:Math.atan2(vy,vx),
      orientation,scale:((mobile?1.5:1.7)*(1-reveal)+.24*reveal)*distanceScale,
      behind:p>.19&&p<.65&&point.z<0,entry:ease(.737,.762,p),u:reveal};
  }
  // Keep the original painting's composition throughout the flight. The viewer
  // watches from beside the traveller and cat rather than following the craft.
  function view(p,w,h,frame) {
    return {zoom:1,x:frame.left+573*frame.S,y:frame.top+318*frame.S};
  }

  // Scroll-time art direction, not a thermal model. Heating begins in the
  // atmosphere; structural breakup follows the loss of Earth pointing.
  function entryEffects(p) {
    return {sheath:ease(ENTRY,.751,p),plume:ease(.744,.782,p),
      breakup:ease(.773,.808,p),hull:1-ease(.773,.805,p),
      fade:1-ease(.795,.865,p),embers:1-ease(.817,.891,p)};
  }

  // Titan on a circular ring-plane orbit, compressed to 3.76 Saturn radii (the
  // real orbit is 20.3) and timed to pass Cassini at the 11 September 2017
  // flyby beat (p = .49). It then sets into the clouds. Artistic, not ephemeris.
  function titan(p){
    const theta=-1.366+2.2*p,rho=3.76,B=.33,tilt=.31;
    const rx=rho*Math.cos(theta),w=rho*Math.sin(theta),ry=w*Math.sin(B);
    return {x:573+(rx*Math.cos(tilt)-ry*Math.sin(tilt))*R,y:318+(rx*Math.sin(tilt)+ry*Math.cos(tilt))*R,
      z:w*Math.cos(B)*R,theta};
  }
  // The light that reaches the hull at a sampled point, in model space (+Y up,
  // +Z toward the viewer). The horizon sun sits far beyond the painted glow, so
  // the craft is mostly backlit; Saturn eclipses it softly on the far passage
  // and during entry, and reflects a faint cream planetshine. Artistic, fixed.
  const SUN=[960,602,-500],SATURN=[573,318,0,262];
  function unit(x,y,z){const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}
  function illumination(q,p){
    const z=q.z||0,sun=unit(SUN[0]-q.x,SUN[1]-q.y,SUN[2]-z);
    const cx=SATURN[0]-q.x,cy=SATURN[1]-q.y,cz=-z,d=Math.hypot(cx,cy,cz);
    const along=cx*sun[0]+cy*sun[1]+cz*sun[2];
    const miss=Math.sqrt(Math.max(0,d*d-along*along))/SATURN[3];
    const eclipse=along>0?1-ease(.82,1.08,miss):0;
    const e=entryEffects(p),t=titan(p),tx=t.x-q.x,ty=t.y-q.y,tz=t.z-z,td=Math.hypot(tx,ty,tz)||1;
    return {titan:[tx/td,-ty/td,tz/td],titanshine:clamp(Math.pow(.8*R/td,2),0,1),sun:[sun[0],-sun[1],sun[2]],planet:[cx/d,-cy/d,cz/d],
      lit:1-.86*eclipse,
      // Low over the horizon the light is deep amber; higher, a paler gold.
      warmth:clamp((q.y-120)/480),
      planetshine:clamp(Math.pow(SATURN[3]*1.6/d,2),0,1),
      heat:e.sheath*e.fade,motion:[Math.cos(q.motionAngle||0),-Math.sin(q.motionAngle||0),0]};
  }

  window.CassiniFlight={sample,orbit,view,attitude,entryEffects,illumination,titan,earthDirection:EARTH};
})();
