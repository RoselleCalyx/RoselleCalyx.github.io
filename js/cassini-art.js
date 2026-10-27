/* NASA/Brian E. Kumanchik's Cassini orbiter, without Huygens.
   Source and third-party licenses: assets/models/README.md.
   One rigid model is rendered into the existing painted canvas scene. */
(function () {
  const canvas=document.createElement('canvas');
  canvas.id='cassiniModel';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
  canvas.dataset.state='loading';document.body.appendChild(canvas);
  const still=new Image();still.src='assets/models/cassini-opening-gilded.webp';
  let renderer=null,scene=null,camera=null,rig=null,THREE=null;
  let ready=false,lastPose='',resolution=0;
  const MODEL_SPAN=36,DISPLAY_SIZE=864;
  const defaultEarth=[.78,.59,.21];
  window.CassiniArt={
    get textured(){return ready;},
    draw(ctx,x,y,scale,angle=0,orientation=null){
      const pose=orientation||null;
      if(ready){
        // The NASA model's antenna normal is +Y. Lighting stays in scene space.
        if(pose)rig.quaternion.fromArray(pose);
        else{
          rig.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...defaultEarth).normalize());
          rig.rotateY(-.105);rig.rotateZ(-angle);
        }
        const key=rig.quaternion.toArray().map(v=>v.toFixed(5)).join(',');
        const desired=Math.abs(scale)> .65?1024:512;
        if(desired!==resolution){renderer.setSize(desired,desired,false);resolution=desired;lastPose='';}
        if(key!==lastPose){renderer.render(scene,camera);lastPose=key;}
        ctx.drawImage(canvas,x-DISPLAY_SIZE*scale/2,y-DISPLAY_SIZE*scale/2,DISPLAY_SIZE*scale,DISPLAY_SIZE*scale);
      }else if(still.complete&&still.naturalWidth){
        // A still rendered from this exact model, never a generated substitute.
        ctx.drawImage(still,x-DISPLAY_SIZE*scale/2,y-DISPLAY_SIZE*scale/2,DISPLAY_SIZE*scale,DISPLAY_SIZE*scale);
      }
    }
  };
  async function initialize(){
    const modules=await Promise.all([import('./vendor/three/three.module.js'),import('./vendor/three/GLTFLoader.js'),import('./vendor/three/DRACOLoader.js'),import('./cassini-design.js?v=20261027-epic2')]);
    THREE=modules[0];
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    scene=new THREE.Scene();
    camera=new THREE.OrthographicCamera(-MODEL_SPAN/2,MODEL_SPAN/2,MODEL_SPAN/2,-MODEL_SPAN/2,.1,200);
    camera.position.set(0,0,80);camera.lookAt(0,0,0);
    const sunlight=new THREE.DirectionalLight(0xffddb0,2.35);sunlight.position.set(7.4,-2.8,6.7);scene.add(sunlight);
    // Low-intensity ringshine reveals structure without a second hard shadow.
    scene.add(new THREE.HemisphereLight(0x9fabc5,0x9a6747,.85));
    const rim=new THREE.DirectionalLight(0xffbd7d,.95);rim.position.set(5,-3,-6);scene.add(rim);
    const draco=new modules[2].DRACOLoader();
    draco.setDecoderPath(new URL('js/vendor/three/draco/',document.baseURI).href);
    const loader=new modules[1].GLTFLoader();loader.setDRACOLoader(draco);
    const gltf=await loader.loadAsync(new URL('assets/models/cassini-orbiter-nasa.glb',document.baseURI).href);
    rig=new THREE.Group();rig.add(gltf.scene);scene.add(rig);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials){
        // An illustrated ivory dish and muted champagne hardware belong to
        // the sunset painting; the official silhouette and instruments remain.
        if(material.name==='dish_AO'){
          material.map=null;material.color.setHex(0xe5cfaa);material.roughness=.88;material.metalness=.08;
        }else if(material.name.startsWith('foil_gold')){
          material.color.setHex(0xe8cfa5);material.roughness=.78;material.metalness=.12;
        }else if(material.name==='aluminum'){
          material.color.setHex(0x8d8272);material.roughness=.72;material.metalness=.3;
        }else if(material.name==='plastic_dark'||material.name==='black_krinkle'){
          material.color.setHex(0x30323b);material.roughness=.9;
        }
        if(material.map)material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      }
    });
    modules[3].addEpicDetails(THREE,rig,gltf.scene);
    draco.dispose();
    ready=true;canvas.dataset.state='ready';canvas.dataset.source='NASA/Brian E. Kumanchik';canvas.dataset.edition='gilded-voyager';
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;canvas.dataset.state='context-lost';});
    canvas.addEventListener('webglcontextrestored',()=>{ready=true;lastPose='';canvas.dataset.state='ready';});
  }
  initialize().catch(error=>{
    canvas.dataset.state='fallback';console.warn('Cassini 3D model unavailable; keeping the model-rendered still.',error);
    if(renderer)renderer.dispose();
  });
})();
