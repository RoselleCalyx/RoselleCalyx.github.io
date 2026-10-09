/* Reference-based 2.5D character. The face and stance stay pinned;
   only hair ends and loose fabric respond to a restrained wind field. */
(function () {
  'use strict';
  function create(invalidate) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,powerPreference:'low-power'});
    let program=null,uniforms={},lost=false;
    const views=['back','profile'].map(name=>{
      const entry={image:new Image(),ready:false,texture:null};
      entry.image.decoding='async';
      entry.image.onload=()=>{entry.ready=true;if(program&&!lost)upload(entry);invalidate();};
      entry.image.onerror=()=>{entry.failed=true;invalidate();};
      entry.image.src=`assets/voyager/traveller-${name}-${name==='back'?'v7':'v6'}.png`;
      return entry;
    });
    function upload(entry) {
      entry.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,entry.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,entry.image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    function setup() {
      if(!gl)return;
      program=gl.createProgram();
      const sources=[
        [gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'],
        [gl.FRAGMENT_SHADER,`precision mediump float;
          uniform sampler2D art;uniform float time,profile;uniform vec3 tint;varying vec2 uv;
          void main(){
            vec2 q=uv;
            float wind=sin(time*.63)*.65+sin(time*1.07+1.)*.35;
            // Face, hands in pockets and shoes do not deform.
            float hair=smoothstep(.21,.34,q.y)*(1.-smoothstep(.43,.53,q.y));
            hair*=mix(smoothstep(.50,.62,q.x),1.-smoothstep(.42,.53,q.x),profile);
            float hem=exp(-pow((q.y-.56)*22.,2.))*(1.-smoothstep(.18,.38,abs(q.x-.5)));
            q.x+=hair*(wind*.004+sin(time*.81-q.y*16.)*.0015)+hem*wind*.002;
            vec4 c=texture2D(art,q);
            c.rgb*=tint*mix(.71,.98,1.-uv.y*.38);
            gl_FragColor=c;
          }`]
      ];
      for(const [type,source] of sources){
        const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){program=null;return;}
        gl.attachShader(program,shader);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){program=null;return;}
      gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
      ['time','profile','tint'].forEach(n=>uniforms[n]=gl.getUniformLocation(program,n));
      gl.uniform1i(gl.getUniformLocation(program,'art'),0);
      views.filter(v=>v.ready).forEach(upload);
    }
    setup();
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;invalidate();});
    canvas.addEventListener('webglcontextrestored',()=>{lost=false;setup();invalidate();});
    return {draw(ctx,{time,x,y,height,profile,tint}) {
      const entry=views[profile?1:0];if(!entry.ready)return false;
      let source=entry.image;
      if(program&&!lost){
        gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.texture);
        gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.profile,profile?1:0);gl.uniform3fv(uniforms.tint,tint);
        gl.drawArrays(gl.TRIANGLES,0,3);source=canvas;
      }
      const width=height*2/3;
      ctx.drawImage(source,x-width*.53,y-height*.98,width,height);
      return true;
    }};
  }
  window.VoyagerFigure={create};
})();
