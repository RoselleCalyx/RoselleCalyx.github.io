export function createDensityAverage(){
  const averages=new WeakMap();
  return function average(field){
    let cache=averages.get(field);
    if(!cache||cache.mass!==field.mass||field.time<cache.time){cache={time:-100,mass:field.mass,frames:[],sum:new Float32Array(64*160)};averages.set(field,cache);}
    if(field.time-cache.time>=.2){
      const sample=window.RingDynamics.density(field,64,160).values;cache.time=field.time;cache.frames.push(sample);
      for(let i=0;i<sample.length;i++)cache.sum[i]+=sample[i];
      if(cache.frames.length>12){const old=cache.frames.shift();for(let i=0;i<old.length;i++)cache.sum[i]-=old[i];}
    }
    return cache;
  };
}

/* Measured density and trajectories from the same local Hill model as the ice.
   Scientific overlays are optional; the horizon remains an artistic composition. */
export function createScience(T,scene){
  const {streamline,density}=window.RingDynamics;
  const guide=new T.Group(),paths=new T.Group();scene.add(guide,paths);
  const gold=0xe4c38b,blue=0x8cd5e9;
  function line(points,color,opacity=.6,parent=guide){
    const geometry=new T.BufferGeometry().setFromPoints(points);
    const object=new T.Line(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));parent.add(object);return object;
  }
  const circle=line(Array.from({length:129},(_,i)=>new T.Vector3(Math.cos(i/128*Math.PI*2),.08,Math.sin(i/128*Math.PI*2))),gold,.65);
  const axis=line([new T.Vector3(-5,.07,0),new T.Vector3(5,.07,0)],gold,.2);
  const lpoints=new T.Group();guide.add(lpoints);
  for(const sign of [-1,1]){
    const point=new T.Mesh(new T.OctahedronGeometry(.055),new T.MeshBasicMaterial({color:gold}));point.userData.sign=sign;lpoints.add(point);
  }
  const inward=new T.ArrowHelper(new T.Vector3(-1,0,0),new T.Vector3(-5,.08,5),2.5,gold,.25,.12);guide.add(inward);
  const flow=new T.ArrowHelper(new T.Vector3(0,0,-1),new T.Vector3(5,.08,5),2.5,blue,.25,.12);guide.add(flow);
  let pathMass=null;
  function rebuild(mass){
    pathMass=mass;
    for(const child of [...paths.children]){paths.remove(child);child.geometry?.dispose();child.material?.dispose();child.line?.material.dispose();child.cone?.material.dispose();}
    const scale=Math.max(.8,Math.cbrt(mass));
    for(const offset of [-5,-3.8,-2.8,-2,-1.35,-.8,.8,1.35,2,2.8,3.8,5]){
      const x=offset*scale;if(Math.abs(x)>10.7)continue;
      const trace=streamline(mass,x),points=trace.points.map(p=>new T.Vector3(p[0],.1,-p[1]));
      line(points,offset<0?gold:blue,.72,paths);
      // Direction glyphs sample the integrated curve, never a decorative spline.
      for(const at of [.22,.58,.85]){
        const i=Math.floor((points.length-2)*at);if(i<1||!points[i+1])continue;
        const dir=points[i+1].clone().sub(points[i]).normalize();
        const arrow=new T.ArrowHelper(dir,points[i],.55,offset<0?gold:blue,.26,.13);paths.add(arrow);
      }
    }
  }
  const mapCanvas=document.createElement('canvas');mapCanvas.width=64;mapCanvas.height=160;
  const ctx=mapCanvas.getContext('2d'),image=ctx.createImageData(64,160),texture=new T.CanvasTexture(mapCanvas);
  texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
  const map=new T.Mesh(new T.PlaneGeometry(24,64),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));
  map.rotation.x=-Math.PI/2;map.position.y=.025;scene.add(map);
  let mapTime=-100,lastField=null,lastCache=null;
  const average=createDensityAverage();
  const selectedGeometry=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);
  const selectedLine=new T.Line(selectedGeometry,new T.LineBasicMaterial({color:0xffe3a8,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));scene.add(selectedLine);
  const marker=new T.Mesh(new T.TorusGeometry(.25,.012,6,40),new T.MeshBasicMaterial({color:0xffe3a8}));marker.rotation.x=-Math.PI/2;scene.add(marker);
  let selection=-1,generation=-1,history=[],historyTime=-1;
  return {
    update(field,options){
      const mass=options.compare?0:field.mass;
      if(options.reference)average(options.reference);
      if(options.experiment)average(options.experiment);
      const cache=average(field);
      guide.visible=(options.guide||options.lens==='paths')&&mass>0;paths.visible=options.lens==='paths';map.visible=options.lens==='density';
      circle.scale.set(field.hillRadius,1,field.hillRadius);
      axis.visible=guide.visible;
      const equilibrium=Math.sqrt(Math.max(0,Math.cbrt(mass)**2-field.softening**2));
      lpoints.children.forEach(point=>point.position.set(point.userData.sign*equilibrium,.1,0));
      if(paths.visible&&pathMass!==mass)rebuild(mass);
      if(map.visible&&(lastField!==field||lastCache!==cache||Math.abs(field.time-mapTime)>.15)){
        const result={values:cache.sum};lastField=field;lastCache=cache;mapTime=field.time;
        for(let i=0;i<result.values.length;i++){
          const d=Math.max(0,Math.min(2.4,result.values[i]/Math.max(1,cache.frames.length))),k=((159-Math.floor(i/64))*64+i%64)*4;
          // Blue depleted flow -> muted cream at the mean -> amber enhancement.
          const a=d<=1?[10+61*d,29+68*d,51+61*d]:[71+Math.min(1,(d-1)/.65)*181,97+Math.min(1,(d-1)/.65)*109,112-Math.min(1,(d-1)/.65)*9];
          image.data[k]=a[0];image.data[k+1]=a[1];image.data[k+2]=a[2];image.data[k+3]=255;
        }
        ctx.putImageData(image,0,0);texture.needsUpdate=true;
      }
      if(options.selected!==selection){selection=options.selected;history=[];generation=field.generation[selection];historyTime=-1;}
      const valid=selection>=0&&selection<field.count&&generation===field.generation[selection];
      marker.visible=selectedLine.visible=valid;
      if(valid){
        marker.position.set(field.x[selection],.15,-field.y[selection]);
        if(field.time!==historyTime){
          historyTime=field.time;history.push(new T.Vector3(field.x[selection],.14,-field.y[selection]));
          if(history.length>180)history.shift();
          selectedLine.geometry.dispose();selectedLine.geometry=new T.BufferGeometry().setFromPoints(history.length>1?history:[history[0],history[0]]);
        }
      }
      return {selectionValid:valid};
    },
    reset(){selection=-1;history=[];mapTime=-100;lastField=null;},
    projectedGuide(camera){
      const r=circle.scale.x;return {hill:new T.Vector3(0,.1,-r).project(camera),l1:new T.Vector3(-Math.sqrt(Math.max(0,r*r-(.12+.05*r)**2)),.1,0).project(camera),l2:new T.Vector3(Math.sqrt(Math.max(0,r*r-(.12+.05*r)**2)),.1,0).project(camera)};
    }
  };
}
