/* A living version of the existing painting. No replacement illustration:
   the colour and the foreground mask use the same small displacement field. */
(function(){
  'use strict';
  const fields=[
    [485,421,64,57], [544,438,29,31], [665,510,30,36], [634,448,9,13],
    [185,438,42,29], [277,476,46,27], [370,500,44,22], [806,589,56,30]
  ];
  const breeze=(time,x)=>.65*Math.sin(time*.48-x*.003)+.24*Math.sin(time*1.17-x*.0047)+.11*Math.sin(time*2.31-x*.002);
  function motions(time,calm=false){
    if(calm)return fields.map(()=>[0,0,0,0]);
    const breath=Math.sin(time*1.22),ear=Math.pow(Math.max(0,Math.sin(time*.31-1.6)),24);
    return fields.map((f,i)=>{
      if(i===0)return [breeze(time,f[0])*2.7,breeze(time-.5,f[0])*.65,0,0];
      if(i===1)return [breeze(time-.3,f[0])*.25,-.25*breath,.004*breath,0];
      if(i===2)return [0,-.34*breath,.018*breath,0];
      if(i===3)return [.72*ear,-.38*ear,0,0];
      return [breeze(time-.7,f[0])*(i===7?1.1:1.65),-.18*breeze(time,f[0]),0,0];
    });
  }
  function displacement(x,y,time,calm=false){
    const m=motions(time,calm);let dx=0,dy=0;
    fields.forEach((f,i)=>{
      const rx=x-f[0],ry=y-f[1];let w=Math.exp(-2*((rx/f[2])**2+(ry/f[3])**2));
      if(i===0)w*=1-Math.max(0,Math.min(1,(x-523)/25));
      dx+=w*(m[i][0]+rx*m[i][2]);dy+=w*(m[i][1]+ry*m[i][2]);
    });
    return [dx,dy];
  }
  const vertex=`attribute vec2 position;varying vec2 uv;
    void main(){uv=(position+1.)*.5;uv.y=1.-uv.y;gl_Position=vec4(position,0.,1.);}`;
  const fragment=`precision highp float;varying vec2 uv;
    uniform sampler2D art,contour;uniform vec4 fields[8],motions[8];
    uniform float time,amplitude,burn,maskPass;uniform vec2 light;
    void main(){
      vec2 pixel=uv*vec2(1672.,761.),shift=vec2(0.);
      for(int i=0;i<8;i++){
        vec2 delta=pixel-fields[i].xy,q=delta/fields[i].zw;
        float weight=exp(-2.*dot(q,q));
        if(i==0)weight*=1.-clamp((pixel.x-523.)/25.,0.,1.);
        shift+=weight*(motions[i].xy+delta*motions[i].z);
      }
      float foreground=texture2D(contour,uv).a;
      float cloud=exp(-pow((pixel.y-399.)/77.,2.))*(1.-foreground);
      float wind=.65*sin((time-1.4)*.48-pixel.x*.003)+.24*sin((time-1.4)*1.17-pixel.x*.0047)+.11*sin((time-1.4)*2.31-pixel.x*.002);
      shift.x+=amplitude*cloud*wind*1.15;
      vec2 sampleUV=(pixel-shift)/vec2(1672.,761.);
      float near=texture2D(contour,sampleUV).a;
      if(maskPass>.5){gl_FragColor=vec4(1.,1.,1.,near);return;}
      vec4 color=texture2D(art,sampleUV);
      vec2 texel=vec2(2./1672.,2./761.);
      float edge=abs(texture2D(contour,sampleUV+vec2(texel.x,0.)).a-texture2D(contour,sampleUV-vec2(texel.x,0.)).a)
        +abs(texture2D(contour,sampleUV+vec2(0.,texel.y)).a-texture2D(contour,sampleUV-vec2(0.,texel.y)).a);
      float reach=exp(-dot((pixel-light)/vec2(370.,410.),(pixel-light)/vec2(370.,410.)));
      float surface=clamp(dot(color.rgb,vec3(.3,.5,.2))*1.5,.08,.8);
      color.rgb+=vec3(.22,.095,.025)*burn*reach*near*(surface*.35+min(1.,edge)*.8);
      gl_FragColor=color;
    }`;
  function create(land){
    const canvas=document.createElement('canvas');canvas.id='livingLandscape';canvas.className='hero-land hero-living-land';canvas.setAttribute('aria-hidden','true');
    land.after(canvas);
    const hero=land.closest('.hero');
    function onPlanet(event){
      if(!hero||hero.classList.contains('leaving')||event.target.closest('a,button,input,label,.hero-text'))return false;
      const scale=parseFloat(land.style.width)/1672;if(!scale)return false;
      const box=hero.getBoundingClientRect();
      const x=(event.clientX-box.left-parseFloat(land.style.left))/scale;
      const y=(event.clientY-box.top-parseFloat(land.style.top))/scale;
      if(y>326&&x>400&&x<750)return false;
      return Math.hypot(x-573,y-138)<248;
    }
    hero?.addEventListener('click',event=>{if(!event.defaultPrevented&&onPlanet(event))location.assign('rings.html');});
    hero?.addEventListener('pointermove',event=>{hero.style.cursor=onPlanet(event)?'pointer':'';},{passive:true});
    hero?.addEventListener('pointerleave',()=>{hero.style.cursor='';});
    const mask=document.createElement('canvas'),maskContext=mask.getContext('2d');
    let gl,program,locations,artTexture,maskTexture,ready=false,last='';
    try{
      gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
      if(!gl)throw new Error('No WebGL');
      const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      locations={};for(const name of ['art','contour','fields','motions','time','amplitude','burn','light','maskPass'])locations[name]=gl.getUniformLocation(program,name==='fields'||name==='motions'?name+'[0]':name);
      function texture(unit){gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
      artTexture=texture(0);maskTexture=texture(1);
      gl.uniform1i(locations.art,0);gl.uniform1i(locations.contour,1);gl.uniform4fv(locations.fields,new Float32Array(fields.flat()));
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;canvas.hidden=true;land.style.visibility='';canvas.dataset.state='fallback';});
      canvas.addEventListener('webglcontextrestored',()=>{canvas.dataset.state='fallback';});
    }catch{gl=null;program=null;canvas.hidden=true;canvas.dataset.state='fallback';}
    const instance={
      get ready(){return ready;},mask,
      prepare(){
        if(!gl||!program)return;
        try{
          const small=matchMedia('(pointer: coarse)').matches,width=small?1004:1338;
          canvas.width=mask.width=width;canvas.height=mask.height=Math.round(width*761/1672);gl.viewport(0,0,canvas.width,canvas.height);
          gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,artTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,land);
          gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,maskTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,HomeOcclusion.createMask());
          ready=true;canvas.dataset.state='ready';canvas.hidden=false;land.style.visibility='hidden';
          this.layout();
        }catch{ready=false;canvas.hidden=true;canvas.dataset.state='fallback';land.style.visibility='';}
      },
      layout(){for(const p of ['width','height','left','top'])canvas.style[p]=land.style[p];},
      render(t,calm,heat,point){
        if(!ready)return;
        const stamp=calm?0:Math.round(t*30),key=stamp+'|'+calm+'|'+heat.toFixed(4)+(heat>0?'|'+point.x.toFixed(2)+'|'+point.y.toFixed(2):'');
        if(key===last)return;last=key;
        gl.useProgram(program);gl.uniform4fv(locations.motions,new Float32Array(motions(t,calm).flat()));
        gl.uniform1f(locations.time,calm?0:t);gl.uniform1f(locations.amplitude,calm?0:1);gl.uniform1f(locations.burn,heat);
        gl.uniform2f(locations.light,point.x,point.y-180);
        gl.uniform1f(locations.maskPass,1);gl.drawArrays(gl.TRIANGLES,0,6);
        maskContext.clearRect(0,0,mask.width,mask.height);maskContext.drawImage(canvas,0,0);
        gl.uniform1f(locations.maskPass,0);gl.drawArrays(gl.TRIANGLES,0,6);
        canvas.dataset.motion=calm?'still':'breeze';
      }
    };
    window.HomeLife.active=instance;return instance;
  }
  window.HomeLife={create,motions,displacement,fields};
})();
