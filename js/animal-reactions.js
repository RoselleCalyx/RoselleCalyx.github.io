/* Articulated parts from the existing painted character, never extra limbs. */
(function(){
  const cache=new Map();
  const sheets={};
  const tailScratch=document.createElement('canvas');tailScratch.width=tailScratch.height=320;
  const wagMask=new Path2D('M102 53 C55 42 12 78 16 120 C18 151 34 168 50 166 L69 142 L98 114 C109 91 117 60 102 53 Z');
  for(const sp of ['snowcat','rabbit','panda','fox','shiba','hedgehog','duckling','penguin']){
    const img=new Image();img.decoding='async';
    img.onload=async()=>{try{await img.decode();}catch{}if(img.complete&&img.naturalWidth===384*16)sheets[sp]=img;};
    img.src=`assets/farm/affection/${sp}-v4.webp`;
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
    if(sheet){
      const p=Math.max(0,Math.min(1,(now-r.start)/r.duration));
      // Feeding, greeting and affection have actual articulated silhouettes.
      const sequence=r.kind==='pet-stretch'||r.kind==='knead'?[8,9,12,13,14,15,8]:r.kind.startsWith('pet-')?[8,9,10,11,10,9,8]:r.kind==='munch'?[0,1,2,3,2,3,1,0]:r.kind==='wave'||r.kind==='flap'?[8,4,5,6,5,6,4,7,8]:r.kind==='curl'?[8,9,11,12,13,14,15,8]:r.kind==='wag'?[8,9,10,9,8,10,9,8]:[0,1,2,3,4,5,6,7];
      // Reduced motion still acknowledges a deliberate click with calm pose changes.
      const f=(calm?Math.floor(p*3)/3:p)*(sequence.length-1),i=Math.floor(f),blend=calm?0:f-i;
      const g=cv.getContext('2d');g.clearRect(0,0,320,320);
      const smooth=blend*blend*(3-2*blend);
      g.save();g.globalCompositeOperation='lighter';
      [[sequence[i],1-smooth],[sequence[Math.min(i+1,sequence.length-1)],smooth]].forEach(([frame,alpha])=>{
        g.globalAlpha=alpha;g.drawImage(sheet,frame*384,0,384,384,-20,-40,360,360);
      });g.restore();
      if(r.kind==='wag'&&!calm){
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
  window.AnimalReactions={draw,get ready(){return Object.keys(sheets).length===8;}};
})();
