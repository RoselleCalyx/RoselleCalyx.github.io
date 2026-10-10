/* Natural rock artwork in the farm; cached geometry remains a forest fallback. */
(function(){
  const rockArt={
    'rock-west':'assets/wild/objects/rock-shape3-v1.webp',
    'rock-path':'assets/wild/objects/rock-shape1-v1.webp',
    'rock-bank':'assets/wild/objects/rock-shape2-v1.webp'
  };
  const PROPS=[
    {id:'rock-west',kind:'rock',x:11,y:91,w:5.1,h:3,r:1.9,lift:1.65},
    {id:'rock-path',kind:'rock',x:33,y:75,w:4.6,h:2.5,r:1.65,lift:1.4},
    {id:'rock-bank',kind:'rock',x:85,y:94,w:4.1,h:2.25,r:1.5,lift:1.25},
    {id:'grass-west',kind:'grass',x:25,y:86,w:3.1,h:3.2},
    {id:'grass-path',kind:'grass',x:37,y:77,w:2.6,h:2.5},
    {id:'grass-bank',kind:'grass',x:54,y:94,w:3.4,h:3},
    {id:'flowers-west',kind:'flowers',x:8,y:79,w:2.8,h:2.4},
    {id:'flowers-path',kind:'flowers',x:29,y:91,w:2.7,h:2.7},
    {id:'flowers-east',kind:'flowers',x:88,y:72,w:2.6,h:2.4}
  ];
  const cache=new Map(), rand=i=>{const s=Math.sin(i*73.43+17)*43758.5453;return s-Math.floor(s);};
  const grass=new Image();grass.src='assets/wild/grass-object-v4.webp';
  grass.onload=()=>{cache.clear();document.querySelectorAll('.meadow-prop.prop-grass img').forEach(img=>{const el=img.parentElement;img.src=sprite('grass',Number(el.dataset.seed),el.dataset.season).toDataURL();});};
  function paint(g,kind,seed,season){
    const snow=season==='winter',autumn=season==='autumn';
    if(kind==='grass'&&grass.complete&&grass.naturalWidth&&!snow){
      const h=95,w=h*grass.naturalWidth/grass.naturalHeight;
      g.save();if(autumn)g.filter='sepia(.35) saturate(.7)';g.drawImage(grass,64-w/2,116-h,w,h);g.restore();return;
    }
    g.fillStyle='rgba(22,28,22,.24)';g.beginPath();g.ellipse(64,111,48,6,0,0,Math.PI*2);g.fill();
    if(kind==='rock'){
      const gr=g.createLinearGradient(20,50,80,115);gr.addColorStop(0,'#89918a');gr.addColorStop(.3,'#686e73');gr.addColorStop(1,'#343e48');
      g.fillStyle=gr;g.beginPath();g.moveTo(10,109);g.bezierCurveTo(14,91,19,63,37,60);g.bezierCurveTo(47,45,80,46,88,60);g.bezierCurveTo(111,67,116,91,118,111);g.quadraticCurveTo(60,123,10,109);g.fill();
      g.save();g.clip();
      for(let i=0;i<550;i++){const x=rand(i+seed)*124,y=46+rand(i*3+seed)*72;g.fillStyle=i%3?'rgba(208,210,186,.11)':'rgba(13,24,33,.16)';g.beginPath();g.ellipse(x,y,rand(i+72)*2.6+.3,rand(i+15)*1.3+.3,rand(i+8)*6,0,7);g.fill();}
      g.strokeStyle='rgba(20,31,40,.25)';g.lineWidth=.7;[[30,61,42,103],[66,53,76,78],[94,69,103,102]].forEach(([x,y,u,v])=>{g.beginPath();g.moveTo(x,y);g.lineTo(u,v);g.stroke();});
      for(let i=0;i<170;i++){const x=24+rand(i+seed)*76,y=53+rand(i*7+seed)*18;g.fillStyle=snow?'rgba(235,241,245,.85)':autumn?'rgba(132,124,72,.63)':'rgba(107,135,74,.65)';g.beginPath();g.ellipse(x,y,1+rand(i)*4,1+rand(i+19)*1.6,0,0,7);g.fill();}g.restore();
    }else{
      for(let i=0;i<64;i++){
        const x=30+rand(i+seed)*65,y=112-rand(i+8)*5,L=15+rand(i*13+seed)*49,dx=(rand(i+21)-.5)*36;
        g.strokeStyle=snow?'#d4dfe0':autumn?['#887946','#a38a52','#695c38'][i%3]:['#657844','#90a15d','#435a37'][i%3];g.lineWidth=.65+rand(i)*1.2;
        g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+dx*.25,y-L*.7,x+dx,y-L);g.stroke();
        if(kind==='flowers'&&i%5===0&&!snow){const fx=x+dx,fy=y-L;g.fillStyle=i%2?'#eee1ba':'#cfadbb';for(let j=0;j<5;j++){const a=j*6.283/5;g.beginPath();g.ellipse(fx+Math.cos(a)*2,fy+Math.sin(a)*2,1.6,1.2,a,0,7);g.fill();}g.fillStyle='#c5a665';g.fillRect(fx-.7,fy-.7,1.4,1.4);}
      }
      if(snow){g.fillStyle='rgba(221,232,237,.8)';g.beginPath();g.ellipse(64,108,34,9,0,0,7);g.fill();}
    }
  }
  function sprite(kind,seed=1,season='spring'){
    const key=kind+seed+season;if(cache.has(key))return cache.get(key);
    const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');g.scale(2,2);paint(g,kind,seed,season);cache.set(key,cv);return cv;
  }
  function mount(parent,season){
    parent.querySelectorAll('.meadow-prop').forEach(e=>e.remove());
    PROPS.forEach((p,i)=>{
      const el=document.createElement('div');el.className='meadow-prop prop-'+p.kind;el.dataset.prop=p.id;el.dataset.seed=i+1;el.dataset.season=season;el.setAttribute('aria-hidden','true');
      Object.assign(el.style,{left:p.x+'%',top:p.y+'%',width:p.w+'%',height:p.h+'%',zIndex:Math.round(p.y*10)});
      const img=document.createElement('img');img.alt='';img.draggable=false;
      if(p.kind==='rock'){
        img.src=rockArt[p.id];img.decoding='async';
        img.style.objectFit='contain';img.style.objectPosition='center bottom';
        img.style.filter=season==='winter'?'saturate(.7) brightness(.91)':'brightness(.91) saturate(.9)';
        el.style.transform='translate(-50%, -100%)';
      }else img.src=sprite(p.kind,i+1,season).toDataURL();
      el.append(img);parent.append(el);
    });
  }
  window.MeadowProps={PROPS,sprite,mount};
})();
