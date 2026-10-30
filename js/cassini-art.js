/* NASA/Brian E. Kumanchik's Cassini orbiter, without Huygens.
   Source and third-party licenses: assets/models/README.md.
   One rigid model is rendered into the existing painted canvas scene. */
(function () {
  const canvas=document.createElement('canvas');
  canvas.id='cassiniModel';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
  canvas.dataset.state='loading';document.body.appendChild(canvas);
  const still=new Image();still.src='assets/models/cassini-opening-nocturne.webp';
  let renderer=null,scene=null,camera=null,rig=null,THREE=null,lights=null;
  let ready=false,lastPose='',resolution=0;
  const MODEL_SPAN=36,DISPLAY_SIZE=864;
  const defaultEarth=[.78,.59,.21];
  // The dish spire's tip in model space; its beacon is the craft's only voice.
  const BEACON=[0,3.03,-.1];
  const calmMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const spark=(()=>{
    const c=document.createElement('canvas');c.width=c.height=64;
    const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(240,252,255,1)');gr.addColorStop(.18,'rgba(170,228,255,.55)');
    gr.addColorStop(.5,'rgba(90,170,230,.12)');gr.addColorStop(1,'rgba(60,120,200,0)');
    g.fillStyle=gr;g.fillRect(0,0,64,64);return c;
  })();
  // Bloom: a tiny copy of each render, added back enlarged. Dark hull adds
  // almost nothing; sunlit rims, the dish and plasma-lit metal gain a halo.
  const bloom=document.createElement('canvas');bloom.width=bloom.height=72;
  const bloomContext=bloom.getContext('2d');
  function opening(){
    const F=window.CassiniFlight;
    return F&&F.illumination?F.illumination(F.sample(0),0):null;
  }
  function applyLight(light){
    const {sun,glow,fill,planet,titan,sky,heat,warm,pale}=lights;
    if(!light){
      sun.position.set(7.4,-2.8,6.7);sun.intensity=2.35;sun.color.setHex(0xffddb0);
      glow.intensity=planet.intensity=titan.intensity=heat.intensity=0;scene.environmentIntensity=.6;return;
    }
    const lit=light.lit,[x,y]=light.sun;
    sun.position.set(...light.sun).multiplyScalar(10);
    sun.color.copy(pale).lerp(warm,light.warmth);
    // The sun behind the craft carves a warm rim; the sunset sky's scattered
    // glow wraps around from the same side, and the far side stays deep blue.
    sun.intensity=3*lit;
    glow.position.set(x,y,.75).multiplyScalar(10);glow.color.copy(sun.color);
    glow.intensity=1.25*lit;
    fill.intensity=.55+.2*(1-lit);
    planet.position.set(...light.planet).multiplyScalar(10);
    planet.intensity=.9*light.planetshine*(.2+.8*lit);
    // Titan's hazy orange glow washes the hull as the flyby passes.
    if(light.titan){titan.position.set(...light.titan).multiplyScalar(10);titan.intensity=1.4*light.titanshine;}
    sky.intensity=.44+.12*lit;
    heat.position.set(...light.motion).multiplyScalar(10);heat.intensity=5*light.heat;
    scene.environmentIntensity=.25+.55*lit+.6*light.heat;
  }
  function beacon(ctx,x,y,size,light){
    const v=new THREE.Vector3(...BEACON).applyQuaternion(rig.quaternion);
    const bx=x+v.x/MODEL_SPAN*size,by=y-v.y/MODEL_SPAN*size;
    // A slow double pulse every 3.6 s; steady and dim with reduced motion.
    const t=performance.now()/1000%3.6;
    const pulse=calmMotion.matches?.55:Math.max(Math.exp(-Math.pow((t-.2)/.07,2)),.75*Math.exp(-Math.pow((t-.55)/.07,2)));
    const dark=light?1-light.lit:0,a=(.18+.82*pulse)*(.7+.3*dark);
    const r=Math.max(5,size*(.022+.026*pulse)*(1+.5*dark));
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha*=a;ctx.drawImage(spark,bx-r,by-r,2*r,2*r);
    ctx.globalAlpha*=.6;ctx.drawImage(spark,bx-r*.3,by-r*.3,.6*r,.6*r);
    ctx.restore();
  }
  window.CassiniArt={
    get textured(){return ready;},
    draw(ctx,x,y,scale,angle=0,orientation=null,light=null){
      const pose=orientation||null;
      if(ready){
        // The NASA model's antenna normal is +Y. Lighting stays in scene space.
        if(pose)rig.quaternion.fromArray(pose);
        else{
          rig.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...defaultEarth).normalize());
          rig.rotateY(-.105);rig.rotateZ(-angle);
        }
        light=light||opening();
        const key=rig.quaternion.toArray().map(v=>v.toFixed(5)).join(',')+
          (light?'|'+[light.lit,light.warmth,light.planetshine,light.titanshine||0,light.heat,...light.sun].map(v=>v.toFixed(2)).join(','):'');
        const desired=Math.abs(scale)> .65?1024:512;
        if(desired!==resolution){renderer.setSize(desired,desired,false);resolution=desired;lastPose='';}
        if(key!==lastPose){
          applyLight(light);renderer.render(scene,camera);lastPose=key;
          bloomContext.clearRect(0,0,72,72);bloomContext.drawImage(canvas,0,0,72,72);
        }
        const size=DISPLAY_SIZE*scale;
        ctx.drawImage(canvas,x-size/2,y-size/2,size,size);
        const glow=.22+.5*(light?light.heat:0);
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=glow;
        ctx.drawImage(bloom,x-size*.53,y-size*.53,size*1.06,size*1.06);
        ctx.globalAlpha*=.6;ctx.drawImage(bloom,x-size*.6,y-size*.6,size*1.2,size*1.2);
        ctx.restore();
        beacon(ctx,x,y,size,light);
      }else if(still.complete&&still.naturalWidth){
        // A still rendered from this exact model, never a generated substitute.
        ctx.drawImage(still,x-DISPLAY_SIZE*scale/2,y-DISPLAY_SIZE*scale/2,DISPLAY_SIZE*scale,DISPLAY_SIZE*scale);
      }
    }
  };
  // A dim equirectangular sky for reflections: deep indigo, a low amber
  // horizon toward the sun and a cold band where the rings would be.
  function environment(){
    const c=document.createElement('canvas');c.width=256;c.height=128;
    const g=c.getContext('2d'),v=g.createLinearGradient(0,0,0,128);
    v.addColorStop(0,'#05070d');v.addColorStop(.42,'#141b2c');v.addColorStop(.52,'#3a2a2c');
    v.addColorStop(.58,'#0d1018');v.addColorStop(1,'#020306');
    g.fillStyle=v;g.fillRect(0,0,256,128);
    const sun=g.createRadialGradient(150,70,0,150,70,70);
    sun.addColorStop(0,'rgba(255,170,96,.95)');sun.addColorStop(.25,'rgba(220,110,70,.35)');sun.addColorStop(1,'rgba(120,60,80,0)');
    g.save();g.translate(150,70);g.scale(1.6,.38);g.translate(-150,-70);g.fillStyle=sun;g.fillRect(0,0,256,128);g.restore();
    g.fillStyle='rgba(150,180,220,.16)';g.fillRect(0,46,256,3);
    const texture=new THREE.CanvasTexture(c);
    texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
    const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromEquirectangular(texture);
    texture.dispose();pmrem.dispose();return target.texture;
  }
  async function initialize(){
    const modules=await Promise.all([import('./vendor/three/three.module.js'),import('./vendor/three/GLTFLoader.js'),import('./vendor/three/DRACOLoader.js'),import('./cassini-design.js?v=20261030-nocturne2')]);
    THREE=modules[0];
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    scene=new THREE.Scene();scene.environment=environment();
    camera=new THREE.OrthographicCamera(-MODEL_SPAN/2,MODEL_SPAN/2,MODEL_SPAN/2,-MODEL_SPAN/2,.1,200);
    camera.position.set(0,0,80);camera.lookAt(0,0,0);
    // The horizon sun moves with the craft's place in the painting; a cold
    // viewer-side fill, Saturn's planetshine and plasma heat complete it.
    lights={
      sun:new THREE.DirectionalLight(0xffddb0,2.35),
      glow:new THREE.DirectionalLight(0xffc690,0),
      fill:new THREE.DirectionalLight(0x7f95c4,.35),
      planet:new THREE.DirectionalLight(0xe9d3aa,0),
      titan:new THREE.DirectionalLight(0xffa24f,0),
      sky:new THREE.HemisphereLight(0x6a7ba0,0x3a2629,.4),
      heat:new THREE.DirectionalLight(0xffa765,0),
      warm:new THREE.Color(0xff9550),pale:new THREE.Color(0xffe6c2)
    };
    lights.fill.position.set(-4,3,9);
    for(const name of ['sun','glow','fill','planet','titan','sky','heat'])scene.add(lights[name]);
    const draco=new modules[2].DRACOLoader();
    draco.setDecoderPath(new URL('js/vendor/three/draco/',document.baseURI).href);
    const loader=new modules[1].GLTFLoader();loader.setDRACOLoader(draco);
    // Web copy of the NASA model: identical geometry and WebP texture, without
    // the unused PNG fallbacks (239 KB instead of 1.6 MB). See assets/models/README.md.
    const gltf=await loader.loadAsync(new URL('assets/models/cassini-orbiter-web.glb',document.baseURI).href);
    rig=new THREE.Group();rig.add(gltf.scene);scene.add(rig);
    gltf.scene.updateMatrixWorld(true);
    // Pearl ceramic dish and thin-film anodized foil: their sheen shifts with
    // the moving sunset and planetshine instead of reading as flat paint.
    const pearl=new THREE.MeshPhysicalMaterial({name:'dish_pearl',color:0xd8d5ce,roughness:.46,metalness:.06,
      clearcoat:.55,clearcoatRoughness:.32,iridescence:.3,iridescenceIOR:1.5,iridescenceThicknessRange:[260,480],
      sheen:.35,sheenColor:0x8fa6c8,sheenRoughness:.6});
    gltf.scene.traverse(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      materials.forEach((material,i)=>{
        if(material.name==='dish_AO'){
          if(Array.isArray(object.material))object.material[i]=pearl;else object.material=pearl;
          return;
        }
        if(material.name.startsWith('foil_gold')){
          const film=new THREE.MeshPhysicalMaterial({name:material.name,map:material.map,normalMap:material.normalMap,
            color:0x5d564c,metalness:.78,roughness:.4,iridescence:.6,iridescenceIOR:1.8,iridescenceThicknessRange:[300,620]});
          if(film.map)film.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
          if(Array.isArray(object.material))object.material[i]=film;else object.material=film;
          return;
        }
        if(material.name==='aluminum'){
          material.color.setHex(0x7a7e86);material.roughness=.34;material.metalness=.78;
        }else if(material.name==='plastic_dark'||material.name==='black_krinkle'){
          material.color.setHex(0x15181e);material.roughness=.66;material.metalness=.32;
        }else if(material.name==='plastic_white'){
          material.color.setHex(0xc9ccd1);material.roughness=.48;
        }
        if(material.map)material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      });
    });
    modules[3].addEpicDetails(THREE,rig,gltf.scene);
    draco.dispose();
    ready=true;canvas.dataset.state='ready';canvas.dataset.source='NASA/Brian E. Kumanchik';canvas.dataset.edition='nocturne';
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;canvas.dataset.state='context-lost';});
    canvas.addEventListener('webglcontextrestored',()=>{ready=true;lastPose='';canvas.dataset.state='ready';});
  }
  initialize().catch(error=>{
    canvas.dataset.state='fallback';console.warn('Cassini 3D model unavailable; keeping the model-rendered still.',error);
    if(renderer)renderer.dispose();
  });
})();
