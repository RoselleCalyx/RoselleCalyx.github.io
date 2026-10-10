/* Image-aligned water: perspective waves refract the photographed sea while
   shorelines and foreground objects stay still. Canvas also supports file://. */
(() => {
  'use strict';
  const SCENES = {
    message: {
      horizon: .606,
      water: [[0,.613],[.17,.613],[.28,.608],[.46,.606],[.60,.607],[.72,.606],[.88,.610],[1,.614],[1,1],[0,1]],
      exclude: [[[0,.726],[.020,.743],[.060,.749],[.072,.780],[.081,.812],[.110,.795],[.129,.781],[.155,.795],[.185,.806],[.207,.840],[.214,.866],[.236,.858],[.264,.839],[.290,.846],[.318,.877],[.338,.858],[.367,.870],[.387,.894],[.415,.899],[.448,.916],[.429,.945],[.355,1],[0,1]]]
    },
    harbor: {
      horizon: .545,
      water: [[0,.557],[.19,.552],[.34,.547],[.52,.548],[.69,.547],[.83,.546],[1,.550],[1,1],[0,1]],
      exclude: [
        [[.218,.354],[.250,.355],[.266,.389],[.274,.496],[.269,.554],[.261,.673],[.270,.712],[.258,.727],[.237,.718],[.216,.720],[.216,.701],[.225,.675],[.227,.598],[.226,.548],[.219,.515],[.204,.482],[.197,.426],[.209,.392]],
        [[.346,.547],[.356,.537],[.357,.505],[.365,.505],[.365,.535],[.375,.530],[.375,.516],[.383,.516],[.383,.539],[.389,.549],[.386,.572],[.369,.580],[.350,.576]],
        [[0,.744],[.026,.738],[.027,.615],[.033,.596],[.041,.590],[.060,.593],[.072,.626],[.068,.704],[.105,.705],[.108,.641],[.140,.639],[.140,.695],[.155,.674],[.155,.627],[.180,.625],[.182,.669],[.285,.669],[.285,.624],[.303,.624],[.305,.647],[.320,.648],[.320,.656],[.352,.655],[.353,.722],[.390,.780],[.390,.723],[.400,.716],[.421,.717],[.443,.724],[.454,.738],[.455,.819],[.493,.869],[.539,.918],[.539,.891],[.552,.884],[.583,.890],[.601,.901],[.608,1],[0,1]]
      ]
    }
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = new Set(), mounted = new WeakMap();
  let calm = false, active = true, frame = 0, previous = 0, painted = 0, time = 0;
  const readCalm = () => { try { calm = localStorage.getItem('calm') === '1'; } catch (_) {} };
  readCalm();
  const smooth = (a, b, x) => { const v = Math.max(0, Math.min(1, (x - a) / (b - a))); return v * v * (3 - 2 * v); };
  function polygon(ctx, points, width, height, offsetX = 0, offsetY = 0) {
    ctx.beginPath();
    points.forEach(([x,y], i) => ctx[i ? 'lineTo' : 'moveTo'](offsetX + x * width, offsetY + y * height));
    ctx.closePath(); ctx.fill();
  }
  function coverGeometry(image, host) {
    const box = image.getBoundingClientRect(), bounds = host.getBoundingClientRect();
    const style = getComputedStyle(image);
    const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    const positions = style.objectPosition.split(/\s+/);
    const fraction = (value, fallback) => value && value.endsWith('%') ? parseFloat(value) / 100 : fallback;
    return {
      x: box.left - bounds.left + (box.width - width) * fraction(positions[0], .5),
      y: box.top - bounds.top + (box.height - height) * fraction(positions[1], .5),
      width, height,
      box: { x: box.left - bounds.left, y: box.top - bounds.top, width: box.width, height: box.height },
      faded: style.maskImage !== 'none' && !!style.maskImage
    };
  }
  const VERTEX = 'attribute vec2 aPosition; varying vec2 vUV; void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
  const FRAGMENT = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D uImage, uMask;
    uniform vec4 uRect, uBox;
    uniform float uTime, uHorizon, uFade;
    float wave(vec2 uv, float t) {
      float d=max(0.,(uv.y-uHorizon)/(1.-uHorizon));
      float p=1./(d+.095);
      return sin(uv.x*37.+p*3.6-t*.95)*.53
        +sin(uv.x*83.-p*5.2+t*1.25)*.29
        +sin(uv.x*149.+p*8.1-t*1.7)*.18;
    }
    void main(){
      vec2 screen=vec2(vUV.x,1.-vUV.y);
      vec2 uv=(screen-uRect.xy)/uRect.zw;
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
      float mask=texture2D(uMask,uv).a;
      if(mask<.004)discard;
      vec2 box=(screen-uBox.xy)/uBox.zw;
      if(any(lessThan(box,vec2(0.)))||any(greaterThan(box,vec2(1.))))discard;
      float fade=mix(1.,smoothstep(0.,.06,box.y)*(1.-smoothstep(.78,1.,box.y)),uFade);
      float d=clamp((uv.y-uHorizon)/(1.-uHorizon),0.,1.);
      float shore=smoothstep(0.,.027,uv.y-uHorizon);
      float w=wave(uv,uTime);
      float cross=wave(uv+vec2(.021,.006),uTime+.8);
      vec2 offset=vec2(w*.0024,cross*.00125)*(.12+.88*d)*shore;
      vec3 base=texture2D(uImage,uv+offset).rgb;
      float light=dot(base,vec3(.2126,.7152,.0722));
      // Narrow moving crests break up the existing lighthouse reflections.
      float glint=pow(max(0.,w*.5+.5),9.)*(.25+.75*d)*shore;
      float sparkle=glint*(.006+light*.095);
      vec3 color=base*(1.+w*.07*shore)+vec3(.78,.86,1.)*sparkle;
      gl_FragColor=vec4(color,mask*fade*.94);
    }`;
  function webglRenderer(canvas, image, mask, config) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    const shader = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Water shader unavailable');
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Water renderer unavailable');
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = (unit, source, name) => {
      const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
    };
    texture(0, image, 'uImage'); texture(1, mask, 'uMask');
    const uniforms = Object.fromEntries(['uRect','uBox','uTime','uHorizon','uFade'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform1f(uniforms.uHorizon, config.horizon);
    return {
      kind: 'webgl',
      draw(t, geometry, width, height) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform4f(uniforms.uRect, geometry.x/width, geometry.y/height, geometry.width/width, geometry.height/height);
        gl.uniform4f(uniforms.uBox, geometry.box.x/width, geometry.box.y/height, geometry.box.width/width, geometry.box.height/height);
        gl.uniform1f(uniforms.uTime, t); gl.uniform1f(uniforms.uFade, geometry.faded ? 1 : 0);
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    };
  }
  function canvasRenderer(canvas, image, config) {
    const context = canvas.getContext('2d');
    if (!context) return null;
    const source = document.createElement('canvas'), mask = document.createElement('canvas');
    const sourceContext = source.getContext('2d'), maskContext = mask.getContext('2d');
    let geometryKey = '';
    return {
      kind: 'canvas',
      draw(t, geometry, width, height) {
        const density = canvas.width / width, w = canvas.width, h = canvas.height;
        const key = JSON.stringify([w,h,geometry]);
        if (key !== geometryKey) {
          geometryKey = key; source.width = mask.width = w; source.height = mask.height = h;
          sourceContext.drawImage(image, geometry.x*density, geometry.y*density, geometry.width*density, geometry.height*density);
          maskContext.fillStyle = '#fff';
          polygon(maskContext, config.water, geometry.width*density, geometry.height*density, geometry.x*density, geometry.y*density);
          maskContext.globalCompositeOperation = 'destination-out';
          config.exclude.forEach(points => polygon(maskContext, points, geometry.width*density, geometry.height*density, geometry.x*density, geometry.y*density));
          maskContext.globalCompositeOperation = 'destination-in';
          if (geometry.faded) {
            const fade = maskContext.createLinearGradient(0, geometry.box.y*density, 0, (geometry.box.y+geometry.box.height)*density);
            fade.addColorStop(0, 'transparent'); fade.addColorStop(.06, '#fff'); fade.addColorStop(.78, '#fff'); fade.addColorStop(1, 'transparent');
            maskContext.fillStyle = fade;
          } else maskContext.fillStyle = '#fff';
          maskContext.fillRect(geometry.box.x*density, geometry.box.y*density, geometry.box.width*density, geometry.box.height*density);
          // Erase areas outside the image element's own box (mobile top/bottom).
          maskContext.globalCompositeOperation = 'destination-out'; maskContext.fillStyle = '#fff';
          maskContext.fillRect(0,0,w,Math.max(0,geometry.box.y*density));
          maskContext.fillRect(0,(geometry.box.y+geometry.box.height)*density,w,h);
          maskContext.globalCompositeOperation = 'source-over';
        }
        context.clearRect(0,0,w,h);
        const start = Math.max(0, Math.floor((geometry.y + geometry.height*config.horizon)*density));
        const strip = 2;
        for (let y = start; y < h; y += strip) {
          const uv = (y/density-geometry.y)/geometry.height;
          const depth = Math.max(0, Math.min(1,(uv-config.horizon)/(1-config.horizon)));
          const shore = smooth(config.horizon,config.horizon+.027,uv), p = 1/(depth+.095);
          const wave = Math.sin(p*3.6-t*.95)*.65 + Math.sin(p*5.2+t*1.25)*.35;
          const dx = wave * (.5+3.5*depth) * shore * density;
          const dy = Math.sin(p*4.1-t*.8) * (.3+1.4*depth) * shore * density;
          const sampleY = Math.max(0, Math.min(h-strip,y+dy));
          context.drawImage(source,0,sampleY,w,Math.min(strip,h-y),dx,y,w,Math.min(strip,h-y));
        }
        context.globalCompositeOperation = 'destination-in'; context.drawImage(mask,0,0);
        context.globalCompositeOperation = 'source-over';
      }
    };
  }
  function nativeMask(config) {
    const mask = document.createElement('canvas'); mask.width = 1024; mask.height = 576;
    const ctx = mask.getContext('2d'); ctx.fillStyle = '#fff';
    polygon(ctx, config.water, mask.width, mask.height);
    ctx.globalCompositeOperation = 'destination-out';
    config.exclude.forEach(points => polygon(ctx, points, mask.width, mask.height));
    return mask;
  }
  class WaterScene {
    constructor(canvas) {
      this.canvas = canvas; this.host = canvas.parentElement; this.image = this.host.querySelector('img');
      this.config = SCENES[canvas.dataset.waterScene]; this.ready = false; this.visible = true; this.count = 0;
      this.geometry = null; this.renderer = null;
      this.resize = this.resize.bind(this);
      this.canvas.dataset.waterState = 'loading';
      if (!this.config || !this.image) return;
      scenes.add(this); this.observe();
      this.image.addEventListener('load', () => this.initialize(), { once: true });
      if (this.image.complete && this.image.naturalWidth) this.initialize();
    }
    observe() {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(this.host); this.resizeObserver.observe(this.image);
      }
      if (typeof IntersectionObserver !== 'undefined') {
        this.intersectionObserver = new IntersectionObserver(entries => {
          this.visible = entries[0].isIntersecting; reconcile();
        });
        this.intersectionObserver.observe(this.host);
      }
    }
    initialize() {
      if (this.ready || !this.image.naturalWidth) return;
      try { this.renderer = webglRenderer(this.canvas, this.image, nativeMask(this.config), this.config); } catch (_) {}
      if (!this.renderer) {
        // An image loaded from file:// may be displayable but unavailable to WebGL.
        const replacement = this.canvas.cloneNode(false); this.canvas.replaceWith(replacement);
        this.canvas = replacement; mounted.set(replacement, this);
        this.renderer = canvasRenderer(replacement, this.image, this.config);
      }
      if (!this.renderer) { this.canvas.dataset.waterState = 'unavailable'; return; }
      this.ready = true; this.canvas.dataset.renderer = this.renderer.kind;
      this.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); this.ready = false; this.canvas.dataset.waterState = 'restoring'; reconcile();
      });
      this.canvas.addEventListener('webglcontextrestored', () => this.initialize());
      this.resize();
    }
    resize() {
      if (!this.ready) return;
      const bounds = this.host.getBoundingClientRect();
      this.width = bounds.width; this.height = bounds.height;
      if (!this.width || !this.height) { reconcile(); return; }
      const limit = this.renderer.kind === 'canvas' ? 850000 : 1500000;
      const density = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(limit/(this.width*this.height)));
      const w = Math.max(1, Math.round(this.width*density)), h = Math.max(1, Math.round(this.height*density));
      if (this.canvas.width !== w) this.canvas.width = w;
      if (this.canvas.height !== h) this.canvas.height = h;
      this.geometry = coverGeometry(this.image, this.host);
      const rect = this.host.getBoundingClientRect();
      this.visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      this.draw(time); reconcile();
    }
    draw(t) {
      if (!this.ready || !this.geometry || !this.width || !this.height) return;
      this.renderer.draw(t,this.geometry,this.width,this.height);
      this.canvas.dataset.waterFrame = String(++this.count);
    }
    movable() { return this.ready && this.visible && this.width > 0 && this.height > 0 && this.canvas.isConnected; }
    disconnect() {
      this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect();
      this.resizeObserver = this.intersectionObserver = null;
    }
  }
  const canAnimate = () => active && !document.hidden && !calm && !reduced.matches;
  function reconcile() {
    let any = false;
    scenes.forEach(scene => {
      if (!scene.ready) return;
      const move = canAnimate() && scene.movable(); any ||= move;
      scene.canvas.dataset.waterState = move ? 'running' : scene.visible ? 'paused' : 'offscreen';
    });
    if (any && !frame) { previous = 0; frame = requestAnimationFrame(tick); }
    if (!any) { cancelAnimationFrame(frame); frame = previous = 0; }
  }
  function tick(now) {
    frame = 0;
    const moving = canAnimate() ? [...scenes].filter(scene => scene.movable()) : [];
    if (!moving.length) { previous = 0; reconcile(); return; }
    time += previous ? Math.min(.1,(now-previous)/1000) : 0; previous = now;
    const interval = moving.some(scene => scene.renderer.kind === 'canvas') ? 1000/24 : 1000/30;
    if (now-painted >= interval) { moving.forEach(scene => scene.draw(time)); painted = now; }
    frame = requestAnimationFrame(tick);
  }
  function mount(canvas) {
    if (mounted.has(canvas)) return mounted.get(canvas);
    const scene = new WaterScene(canvas); mounted.set(canvas,scene); return scene;
  }
  window.WaterSurface = { mount };
  document.querySelectorAll('canvas[data-water-scene]').forEach(mount);
  reduced.addEventListener('change', reconcile);
  window.addEventListener('skycalm', event => {
    if (typeof event.detail === 'boolean') calm = event.detail; else readCalm();
    reconcile();
  });
  window.addEventListener('storage', event => { if (event.key === 'calm' || event.key === null) { readCalm(); reconcile(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) readCalm(); reconcile(); });
  window.addEventListener('resize', () => scenes.forEach(scene => scene.resize()), { passive: true });
  if (typeof IntersectionObserver === 'undefined') window.addEventListener('scroll', () => {
    scenes.forEach(scene => { const rect = scene.host.getBoundingClientRect(); scene.visible = rect.bottom > 0 && rect.top < innerHeight; }); reconcile();
  }, { passive: true });
  window.addEventListener('pagehide', () => { active = false; scenes.forEach(scene => scene.disconnect()); reconcile(); });
  window.addEventListener('pageshow', () => {
    if (active) return;
    active = true; readCalm(); scenes.forEach(scene => { scene.observe(); scene.resize(); }); reconcile();
  });
})();
