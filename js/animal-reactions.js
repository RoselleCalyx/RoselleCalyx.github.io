/* Articulated parts from the existing painted character, never extra limbs. */
(function(){
  const cache=new Map();
  const sheets={};
  const species=['snowcat','rabbit','panda','fox','shiba','hedgehog','duckling','penguin','redpanda','raccoon','wolf','crocodile','fennec'];
  const newSpecies=new Set(['redpanda','raccoon','wolf','crocodile','fennec']);
  const farm=document.body.dataset.page==='farm';
  const requested=new Set(),queue=new Set(),loading=new Map(),failed=new Set();
  let idleScheduled=false,backgroundRunning=false;
  const tailScratch=document.createElement('canvas');tailScratch.width=tailScratch.height=320;
  const wagMask=new Path2D('M102 53 C55 42 12 78 16 120 C18 151 34 168 50 166 L69 142 L98 114 C109 91 117 60 102 53 Z');
  function loadSheet(sp,urgent=false){
    if(!species.includes(sp))return Promise.resolve(null);
    requested.add(sp);
    if(sheets[sp])return Promise.resolve(sheets[sp]);
    if(loading.has(sp)){
      const pending=loading.get(sp);
      if(urgent)pending.img.fetchPriority='high';
      return pending.promise;
    }
    // A missing sheet keeps the existing body response, without retrying every frame.
    if(failed.has(sp))return Promise.resolve(null);
    const img=new Image();img.decoding='async';
    img.fetchPriority=urgent?'high':farm?'low':'auto';
    let resolve;
    const promise=new Promise(done=>{resolve=done;});
    loading.set(sp,{img,promise});
    const finish=valid=>{
      if(valid)sheets[sp]=img;else failed.add(sp);
      loading.delete(sp);resolve(valid?img:null);
    };
    img.onload=async()=>{try{await img.decode();}catch{}finish(img.complete&&img.naturalWidth===384*16);};
    img.onerror=()=>finish(false);
    img.src=`assets/farm/affection/${sp}-v4.webp`;
    return promise;
  }
  function schedule(){
    if(!farm||idleScheduled||backgroundRunning||!queue.size)return;
    idleScheduled=true;
    const run=()=>{
      idleScheduled=false;
      const sp=queue.values().next().value;
      if(!sp)return;
      queue.delete(sp);
      if(sheets[sp]||loading.has(sp)||failed.has(sp)){schedule();return;}
      backgroundRunning=true;
      // Keep downloads and decodes serial: one atlas, then another idle turn.
      loadSheet(sp).finally(()=>{backgroundRunning=false;schedule();});
    };
    const idle=()=>('requestIdleCallback'in window?requestIdleCallback(run,{timeout:1800}):setTimeout(run,250));
    document.readyState==='complete'?idle():addEventListener('load',idle,{once:true});
  }
  // Register only species present on the farm. This does not block its first paint.
  function prepare(value){
    for(const sp of typeof value==='string'?[value]:value||[]){
      if(!species.includes(sp))continue;
      requested.add(sp);
      if(!sheets[sp]&&!loading.has(sp)&&!failed.has(sp))queue.add(sp);
    }
    schedule();
  }
  // Opening an animal or starting an action bypasses the background idle queue.
  function preload(sp){
    queue.delete(sp);
    return loadSheet(sp,true);
  }
  // Preserve the existing loading behavior and readiness contract for guardians.
  if(!farm)species.forEach(sp=>loadSheet(sp));
  function sequenceFor(sp,kind){
    if(newSpecies.has(sp)){
      // New sheets keep each action within its own four-frame group.
      if(kind==='munch')return [0,1,2,3,2,3,1,0];
      if(kind==='pet-stretch'||kind==='knead')return [12,13,14,15,14,13,12];
      if(kind.startsWith('pet-'))return [8,9,10,11,10,9,8];
      // A wolf wags and a crocodile swishes with their painted tail frames.
      return [4,5,6,7,6,5,4];
    }
    return kind==='pet-stretch'||kind==='knead'?[8,9,12,13,14,15,8]:kind.startsWith('pet-')?[8,9,10,11,10,9,8]:kind==='munch'?[0,1,2,3,2,3,1,0]:kind==='wave'||kind==='flap'?[8,4,5,6,5,6,4,7,8]:kind==='curl'?[8,9,11,12,13,14,15,8]:kind==='wag'?[8,9,10,9,8,10,9,8]:[0,1,2,3,4,5,6,7];
  }
  const bones={
    shiba:{tail:{path:'M111 121 C49 105 17 144 26 207 C28 257 61 282 103 285 L112 252 L108 204 Z',pivot:[108,239]},paw:{path:'M125 231 L155 231 L159 304 L123 305 Z',pivot:[141,233]}},
    snowcat:{paw:{path:'M151 237 L190 237 L192 308 L151 308 Z',pivot:[171,241]}},
    panda:{paw:{path:'M172 230 L212 230 L216 306 L169 306 Z',pivot:[188,233]}},
    duckling:{wing:{path:'M64 138 C45 145 34 178 38 206 C57 214 73 200 84 174 Z',pivot:[71,147]}},
    penguin:{wing:{path:'M257 158 C277 177 297 214 287 243 C273 248 258 226 248 198 Z',pivot:[261,164]}}
  };
  function layers(img,sp){
    if(cache.has(sp))return cache.get(sp);
    if(!img.complete||!img.naturalWidth)return null;
    const base=document.createElement('canvas');base.width=base.height=320;
    const g=base.getContext('2d');g.drawImage(img,0,0,320,320);
    const parts=[];
    Object.entries(bones[sp]||{}).forEach(([name,b])=>{
      const mask=new Path2D(b.path),cv=document.createElement('canvas');cv.width=cv.height=320;
      const cg=cv.getContext('2d');cg.save();cg.clip(mask);cg.drawImage(img,0,0,320,320);cg.restore();
      g.save();g.globalCompositeOperation='destination-out';g.fill(mask);g.restore();
      parts.push({name,pivot:b.pivot,cv});
    });
    const value={base,parts};cache.set(sp,value);return value;
  }
  function draw(a,now,calm){
    const cv=a.el.querySelector('.reaction-art'),r=a.reaction;
    if(!cv)return;
    if(!r||(!a.el.classList.contains('react')&&!a.el.classList.contains('petting'))||r.kind==='nap'||r.kind==='shake'||(['happy-hop','binky','pounce'].includes(r.kind)&&a.el.classList.contains('jump-ready'))){
      a.el.classList.remove('reaction-ready');return;
    }
    const sheet=sheets[a.def.species];
    if(!sheet)preload(a.def.species);
    if(sheet){
      const p=Math.max(0,Math.min(1,(now-r.start)/r.duration));
      // Feeding, greeting and affection have actual articulated silhouettes.
      const sequence=sequenceFor(a.def.species,r.kind);
      // Reduced motion still acknowledges a deliberate click with calm pose changes.
      const f=(calm?Math.floor(p*3)/3:p)*(sequence.length-1),i=Math.floor(f),blend=calm?0:f-i;
      const g=cv.getContext('2d');g.clearRect(0,0,320,320);
      const smooth=blend*blend*(3-2*blend);
      // The low crocodile torso sits through the existing aquatic waterline.
      const drawY=a.def.species==='crocodile'?-22:-40;
      g.save();g.globalCompositeOperation='lighter';
      [[sequence[i],1-smooth],[sequence[Math.min(i+1,sequence.length-1)],smooth]].forEach(([frame,alpha])=>{
        g.globalAlpha=alpha;g.drawImage(sheet,frame*384,0,384,384,-20,drawY,360,360);
      });g.restore();
      if(r.kind==='wag'&&a.def.species==='shiba'&&!calm){
        // Move only the existing curled tail; keep the paws planted.
        const tg=tailScratch.getContext('2d');tg.clearRect(0,0,320,320);tg.drawImage(cv,0,0);
        g.save();g.globalCompositeOperation='destination-out';g.fill(wagMask);g.restore();
        g.save();g.translate(50,149);g.rotate(Math.sin(p*Math.PI*12)*.13*Math.sin(Math.PI*p));g.translate(-50,-149);g.clip(wagMask);g.drawImage(tailScratch,0,0);g.restore();
        // The hip stays in front of the joint, sealing the fur at the tail root.
        g.save();g.beginPath();g.moveTo(110,96);g.lineTo(320,0);g.lineTo(320,320);g.lineTo(46,320);g.lineTo(46,159);g.quadraticCurveTo(61,119,110,96);g.closePath();g.clip();g.drawImage(tailScratch,0,0);g.restore();
      }
      r.painted=true;a.el.classList.add('reaction-ready');return;
    }
    const art=layers(a.el.querySelector('.animal-sprite'),a.def.species);
    if(!art||!art.parts.length){a.el.classList.remove('reaction-ready');return;}
    const p=Math.max(0,Math.min(1,(now-r.start)/r.duration));
    const g=cv.getContext('2d'),env=calm?0:Math.sin(Math.PI*p),t=p*r.duration/1000;
    g.clearRect(0,0,320,320);
    // Tail is behind the torso; paws are in front. Joint origins stay fixed.
    function part(b){
      const wave=b.name==='tail'?Math.sin(t*22)*.24:b.name==='wing'?Math.sin(t*17)*.3:Math.sin(t*12)*.12;
      const lift=b.name==='paw'&&r.kind==='wave'?Math.sin(Math.PI*p)*-.32:0;
      g.save();g.translate(...b.pivot);g.rotate((wave+lift)*env);
      g.drawImage(b.cv,-b.pivot[0],-b.pivot[1]);g.restore();
    }
    art.parts.filter(b=>b.name==='tail').forEach(part);g.drawImage(art.base,0,0);
    art.parts.filter(b=>b.name!=='tail').forEach(part);
    r.painted=true;a.el.classList.add('reaction-ready');
  }
  window.AnimalReactions={draw,prepare,preload,get ready(){return [...(farm?requested:species)].every(sp=>!!sheets[sp]);}};
})();
