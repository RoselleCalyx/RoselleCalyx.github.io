/* Complete scene paintings with restrained 2.5D depth, light and motion.
   These are imagined viewpoints, not reconstructed spacecraft photographs. */
(function () {
  'use strict';
  const VERTEX = `attribute vec2 aPosition; varying vec2 vUV;
    void main(){vUV=vec2((aPosition.x+1.)*.5,(1.-aPosition.y)*.5);gl_Position=vec4(aPosition,0.,1.);}`;
  const FRAGMENT = `precision highp float;
    varying vec2 vUV;
    uniform sampler2D uScene;
    uniform vec4 uCrop;
    uniform vec2 uPointer;
    uniform float uTime,uFade,uHaze;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){
      vec2 uv=uCrop.xy+vUV*uCrop.zw;
      // A broad, soft foreground depth field: face and feet move together.
      float figure=(1.-smoothstep(.045,.082,abs(uv.x-.235)))*smoothstep(.30,.37,uv.y);
      float depth=max(smoothstep(.59,.94,uv.y),figure);
      uv+=uPointer*(.0006+depth*.0016);
      vec3 color=texture2D(uScene,uv).rgb;
      float valley=smoothstep(.54,.65,uv.y)*(1.-smoothstep(.76,.89,uv.y))*(1.-figure);
      float mist=noise(uv*vec2(13.,31.)+vec2(uTime*.025,0.));
      color=mix(color,vec3(.57,.64,.71),valley*mist*uHaze*.028);
      gl_FragColor=vec4(mix(vec3(.012,.022,.039),color,uFade),1.);
    }`;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const random=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};

  function create(canvas,overlay) {
    const ctx=overlay.getContext('2d'),host=canvas.parentElement;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const status=document.getElementById('vSceneStatus'),retry=document.getElementById('vRetryScene');
    const notice=document.getElementById('vRenderNotice');
    let gl=null,program=null,texture=null,uniforms={},gpu=false;
    let width=1,height=1,stop=null,art=null,request=0,paused=false,time=0,fade=1;
    let frame=0,raf=0,last=0,painted=0,pointer=[0,0],aim=[0,0];
    const cache=new Map();
    const moving=()=>!paused&&!reduced.matches&&!document.hidden;

    function initGL() {
      try {
        gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
        if(!gl||gl.isContextLost())throw new Error('WebGL unavailable');
        const compile=(kind,source)=>{
          const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
          return shader;
        };
        const vertex=compile(gl.VERTEX_SHADER,VERTEX),fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT);
        program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
        gl.deleteShader(vertex);gl.deleteShader(fragment);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
        uniforms={};for(const key of ['Scene','Crop','Pointer','Time','Fade','Haze'])uniforms[key]=gl.getUniformLocation(program,'u'+key);
        texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([3,6,10,255]));
        gpu=true;if(art)upload();
      }catch(error){gpu=false;if(gl&&!gl.isContextLost())console.warn('Voyager renderer fallback:',error.message);}
      canvas.dataset.renderer=gpu?'webgl':'canvas';canvas.style.visibility=gpu?'visible':'hidden';notice.hidden=gpu;
    }
    function upload(){
      if(!gpu||!art)return;
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,art);
    }
    function load(url) {
      if(cache.has(url)){const value=cache.get(url);cache.delete(url);cache.set(url,value);return value;}
      const promise=new Promise((resolve,reject)=>{
        const image=new Image();image.decoding='async';
        image.onload=async()=>{try{await image.decode();resolve(image);}catch(error){reject(error);}};
        image.onerror=()=>reject(new Error('Scene unavailable'));image.src=url;
      });
      cache.set(url,promise);
      // Only a few decoded paintings remain reachable; never preload the whole journey.
      while(cache.size>5)cache.delete(cache.keys().next().value);
      promise.catch(()=>{if(cache.get(url)===promise)cache.delete(url);});
      return promise;
    }
    function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(tick);}
    function resize(){
      const box=host.getBoundingClientRect();width=box.width;height=box.height;
      const dpr=Math.min(window.devicePixelRatio||1,1.5,2100/Math.max(width,height));
      for(const c of [canvas,overlay]){c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);wake();
    }
    function crop(){
      const ratio=art?art.naturalWidth/art.naturalHeight:16/9;
      const scale=Math.max(width/ratio,height)*(1.025+.004*Math.sin(time*.055));
      const w=width/(scale*ratio),h=height/scale;
      const center=width<700?.305:.50;
      return [clamp(center-w/2,0,1-w)+Math.sin(time*.038)*.0015,(1-h)/2+Math.sin(time*.027)*.001,w,h];
    }
    function backdrop(c) {
      ctx.fillStyle='#03060b';ctx.fillRect(0,0,width,height);
      if(art){
        ctx.globalAlpha=fade;
        ctx.drawImage(art,c[0]*art.naturalWidth,c[1]*art.naturalHeight,c[2]*art.naturalWidth,c[3]*art.naturalHeight,0,0,width,height);
        ctx.globalAlpha=1;
      }else{
        for(let i=0;i<100;i++){
          ctx.fillStyle=`rgba(175,196,222,${.12+random(i+71)*.3})`;
          ctx.fillRect(random(i+1)*width,random(i+101)*height,1,1);
        }
      }
    }
    function effects(){
      if(!art||!stop)return;
      ctx.save();ctx.globalAlpha=fade;
      const ice=stop.scene.particles==='ice',count=ice?38:12;
      // Sparse local ice grains; avoid flickering points over the giant body.
      if(ice)for(let i=0;i<count;i++){
        const depth=.25+random(i+22)*.75;
        const x=(random(i+20)*width+time*(2+depth*5))%(width+20)-10;
        const y=height*(.60+random(i+42)*.39)-Math.sin(time*.08+i)*8;
        ctx.fillStyle=`rgba(208,232,245,${(.08+depth*.18)*fade})`;
        ctx.beginPath();ctx.arc(x,y,.3+depth*.65,0,Math.PI*2);ctx.fill();
      }
      if(stop.body!=='nebula'&&window.CassiniArt){
        let alpha=stop.farewell?clamp(1-time/16,0,1):1;
        const x=width*(.69+.095*Math.sin(time*.032)),y=height*(.35-.025*Math.sin(time*.043));
        const size=clamp(width*.105,80,190)/340;
        ctx.globalAlpha=fade*alpha;
        CassiniArt.draw(ctx,x,y,size,-.18+.035*Math.sin(time*.06));
        if(stop.id==='huygens'){
          const separation=Math.min(time/18,1);
          ctx.translate(x+18+separation*42,y+16+separation*24);ctx.rotate(-.35);
          const g=ctx.createLinearGradient(-5,-4,4,4);g.addColorStop(0,'#fff0cf');g.addColorStop(1,'#695443');
          ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,5,3,0,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();
    }
    function draw(){
      const c=crop();ctx.clearRect(0,0,width,height);
      if(gpu&&art){
        gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
        gl.uniform1i(uniforms.Scene,0);gl.uniform4fv(uniforms.Crop,c);gl.uniform2fv(uniforms.Pointer,pointer);
        gl.uniform1f(uniforms.Time,time);gl.uniform1f(uniforms.Fade,fade);gl.uniform1f(uniforms.Haze,stop.scene.haze||0);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }else backdrop(c);
      effects();overlay.dataset.frame=String(++frame);
    }
    function tick(now){
      raf=0;
      if(document.hidden){last=0;return;}
      if(moving()&&now-painted<32){wake();return;}
      const dt=last?Math.min((now-last)/1000,.1):0;last=now;painted=now;
      if(moving()){
        time+=dt;fade=Math.min(1,fade+dt*1.7);
        pointer=pointer.map((n,i)=>n+(aim[i]-n)*.045);
      }else fade=1;
      draw();if(moving())wake();
    }
    async function setStop(value){
      const token=++request;stop=value;art=null;time=0;last=0;fade=1;
      host.dataset.loading='true';host.dataset.target=stop.body;
      overlay.dataset.character='scene';overlay.dataset.scene='';canvas.dataset.art='';
      status.hidden=false;status.textContent=`Approaching ${stop.scene.target}…`;retry.hidden=true;wake();
      try{
        const image=await load(stop.scene.art);
        if(token!==request)return;
        art=image;fade=moving()?0:1;upload();
        host.dataset.loading='false';overlay.dataset.scene=stop.id;canvas.dataset.art=stop.scene.art;
        status.hidden=true;wake();
        const next=window.VOYAGER_STOPS[window.VOYAGER_STOPS.indexOf(stop)+1];
        if(next)load(next.scene.art).catch(()=>{});
      }catch{
        if(token!==request)return;
        host.dataset.loading='error';status.textContent=`The view of ${stop.scene.target} could not load.`;retry.hidden=false;wake();
      }
    }
    retry.addEventListener('click',()=>setStop(stop));
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();gpu=false;canvas.dataset.renderer='canvas';canvas.style.visibility='hidden';notice.hidden=false;wake();
    });
    canvas.addEventListener('webglcontextrestored',()=>{initGL();wake();});
    window.addEventListener('pointermove',e=>{if(moving())aim=[(e.clientX/width-.5)*2,(e.clientY/height-.5)*2];},{passive:true});
    document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
    reduced.addEventListener('change',()=>{last=0;pointer=[0,0];aim=[0,0];wake();});
    new ResizeObserver(resize).observe(host);
    initGL();resize();
    return {setStop,setPaused(value){paused=value;last=0;wake();},get reduced(){return reduced.matches;},get renderedFrames(){return frame;},get webgl(){return gpu;}};
  }
  window.VoyagerScene={create};
})();
