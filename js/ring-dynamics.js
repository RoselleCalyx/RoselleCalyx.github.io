/* Local rotating patch of a Keplerian ring. Dimensionless Hill equations,
   softened moonlet gravity, non-interacting test grains, open flow boundaries.
   One time unit is 1/Omega; sizes and elapsed time are composed for visibility. */
(function(){
  'use strict';
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  class RingPatch{
    constructor(count=6000){
      this.count=count;this.width=24;this.length=64;this.mass=1;this.time=0;this.generation=new Uint32Array(count);
      for(const key of ['x','y','vx','vy','seedX','size','phase','height'])this[key]=new Float64Array(count);
      for(let i=0;i<count;i++){
        this.seedX[i]=(hash(i+17)-.5)*this.width;
        this.size[i]=.035+Math.pow(hash(i+601),3)*.13;
        this.phase[i]=hash(i+712)*Math.PI*2;this.height[i]=(hash(i+943)-.5)*.13;
      }
      this.reset();
    }
    get hillRadius(){return Math.cbrt(Math.max(0,this.mass));}
    get bodyRadius(){return .64*this.hillRadius;}
    get softening(){return .12+.05*this.hillRadius;}
    setMass(value){this.mass=Math.max(0,Math.min(6,Number.isFinite(+value)?+value:1));}
    reset(){
      this.time=0;this.generation.fill(0);
      for(let i=0;i<this.count;i++){
        this.x[i]=this.seedX[i];this.y[i]=(hash(i+183)-.5)*this.length;
        this.vx[i]=0;this.vy[i]=-1.5*this.x[i];
      }
    }
    recycle(i){
      this.generation[i]++;
      this.x[i]=this.seedX[i];this.y[i]=this.x[i]>=0?this.length/2:-this.length/2;
      this.vx[i]=0;this.vy[i]=-1.5*this.x[i];
    }
    advance(duration){
      if(!(duration>0)||!Number.isFinite(duration))return;
      if(this.mass===0){
        // Exact unforced epicycles; circular initial conditions remain pure shear.
        const dt=Math.min(duration,1);
        const c=Math.cos(dt),s=Math.sin(dt);
        for(let i=0;i<this.count;i++){
          const k=this.vy[i]+2*this.x[i],offset=this.x[i]-2*k,vx=this.vx[i];
          this.y[i]+=-3*k*dt-2*offset*s+2*vx*(c-1);
          this.x[i]=2*k+offset*c+vx*s;this.vx[i]=-offset*s+vx*c;this.vy[i]=k-2*this.x[i];
          if(Math.abs(this.x[i])>this.width/2)this.recycle(i);
          else if(Math.abs(this.y[i])>this.length/2){
            const overshoot=Math.abs(this.y[i])-this.length/2;this.recycle(i);
            this.y[i]+=Math.sign(this.vy[i])*overshoot;
          }
        }
        this.time+=dt;return;
      }
      const steps=Math.ceil(Math.min(duration,1)/.025),dt=Math.min(duration,1)/steps,mu=3*this.mass;
      const soft=this.softening,soft2=soft*soft,impact=this.bodyRadius;
      // Fourth-order integration resolves the Coriolis terms without artificial
      // drag. With zero moonlet mass the exact circular shear is unchanged.
      for(let step=0;step<steps;step++){
        for(let i=0;i<this.count;i++){
          const x=this.x[i],y=this.y[i],vx=this.vx[i],vy=this.vy[i];
          const r2=x*x+y*y+soft2,k=mu/(r2*Math.sqrt(r2));
          const ax=2*vy+3*x-k*x,ay=-2*vx-k*y;
          const x2=x+vx*dt/2,y2=y+vy*dt/2,vx2=vx+ax*dt/2,vy2=vy+ay*dt/2;
          const b2=x2*x2+y2*y2+soft2,k2=mu/(b2*Math.sqrt(b2));
          const ax2=2*vy2+3*x2-k2*x2,ay2=-2*vx2-k2*y2;
          const x3=x+vx2*dt/2,y3=y+vy2*dt/2,vx3=vx+ax2*dt/2,vy3=vy+ay2*dt/2;
          const b3=x3*x3+y3*y3+soft2,k3=mu/(b3*Math.sqrt(b3));
          const ax3=2*vy3+3*x3-k3*x3,ay3=-2*vx3-k3*y3;
          const x4=x+vx3*dt,y4=y+vy3*dt,vx4=vx+ax3*dt,vy4=vy+ay3*dt;
          const b4=x4*x4+y4*y4+soft2,k4=mu/(b4*Math.sqrt(b4));
          const ax4=2*vy4+3*x4-k4*x4,ay4=-2*vx4-k4*y4;
          this.x[i]=x+dt*(vx+2*vx2+2*vx3+vx4)/6;
          this.y[i]=y+dt*(vy+2*vy2+2*vy3+vy4)/6;
          this.vx[i]=vx+dt*(ax+2*ax2+2*ax3+ax4)/6;
          this.vy[i]=vy+dt*(ay+2*ay2+2*ay3+ay4)/6;
          if(Math.abs(this.x[i])>this.width/2||Math.abs(this.y[i])>this.length/2||
            Math.hypot(this.x[i],this.y[i])<impact||!Number.isFinite(this.vx[i])){
            const overshoot=Math.max(0,Math.abs(this.y[i])-this.length/2);this.recycle(i);
            this.y[i]+=Math.sign(this.vy[i])*overshoot;
          }
        }
        this.time+=dt;
      }
    }
  }
  const REFERENCE=Object.freeze({orbitKm:130000,gmKm3:37931206.23,hillMeters:100});
  const omega=Math.sqrt(REFERENCE.gmKm3/REFERENCE.orbitKm**3);
  function physical(mass,time=0){
    const hillMeters=REFERENCE.hillMeters*Math.cbrt(Math.max(0,mass));
    return {hillMeters,bodyMeters:.64*hillMeters,periodHours:Math.PI*2/omega/3600,
      elapsedHours:time/omega/3600,velocityCms:REFERENCE.hillMeters*omega*100,
      massKg:3*omega*omega*hillMeters**3/6.67430e-11};
  }
  function jacobi(x,y,vx,vy,mass){
    const soft=.12+.05*Math.cbrt(Math.max(0,mass));
    return 3*x*x+6*mass/Math.sqrt(x*x+y*y+soft*soft)-vx*vx-vy*vy;
  }
  function streamline(mass,offset,maxTime=48){
    const patch=new RingPatch(1);patch.setMass(mass);patch.seedX[0]=offset;
    patch.x[0]=offset;patch.y[0]=offset>=0?patch.length/2-.01:-patch.length/2+.01;
    patch.vx[0]=0;patch.vy[0]=-1.5*offset;
    const points=[];let end='window';
    for(let t=0;t<maxTime;t+=.06){
      points.push([patch.x[0],patch.y[0],patch.time]);
      patch.advance(.06);
      if(patch.generation[0])break;
    }
    if(points.length){const last=points[points.length-1];if(Math.hypot(last[0],last[1])<patch.bodyRadius+.25)end='surface';}
    return {points,end};
  }
  function density(patch,nx=64,ny=128){
    const bins=new Float32Array(nx*ny),temp=new Float32Array(nx*ny),result=new Float32Array(nx*ny);
    for(let i=0;i<patch.count;i++){
      const x=Math.floor((patch.x[i]/patch.width+.5)*nx),y=Math.floor((patch.y[i]/patch.length+.5)*ny);
      if(x>=0&&x<nx&&y>=0&&y<ny)bins[y*nx+x]++;
    }
    // Edge-clamped five-tap blur. Divide by the uniform expected count.
    const weights=[1,4,6,4,1],expected=patch.count/(nx*ny);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      let sum=0;for(let k=-2;k<=2;k++)sum+=bins[y*nx+Math.max(0,Math.min(nx-1,x+k))]*weights[k+2];temp[y*nx+x]=sum/16;
    }
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      let sum=0;for(let k=-2;k<=2;k++)sum+=temp[Math.max(0,Math.min(ny-1,y+k))*nx+x]*weights[k+2];result[y*nx+x]=sum/16/expected;
    }
    return {values:result,nx,ny};
  }
  window.RingDynamics={RingPatch,hash,REFERENCE,physical,jacobi,streamline,density};
})();
