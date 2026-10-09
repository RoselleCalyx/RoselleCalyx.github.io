/* Painted natural objects; the woods controller owns growth and hit targets. */
(function(){
  const types=['porcini','chanterelle','amanita','shiitake','matsutake','morel','strawberry','shoot','pinecone','rosehip','bayberry','rock','grass','fern','leaves'];
  const sprites=new Map(),snowTiles=new Map(),listeners=new Set();
  const src=(type,variant=0)=>`assets/wild/objects/${type}-shape${((variant%3)+3)%3+1}-v1.webp`;
  const ready=Promise.all(types.flatMap(type=>[0,1,2].map(variant=>new Promise(resolve=>{
    const image=new Image();image.decoding='async';
    image.onload=()=>{sprites.set(`${type}:${variant}`,image);listeners.forEach(fn=>fn());resolve(true);};
    image.onerror=()=>resolve(false);image.src=src(type,variant);
  }))));
  function snowTile(image,key){
    if(snowTiles.has(key))return snowTiles.get(key);
    const cv=document.createElement('canvas'),n=256;cv.width=n;cv.height=Math.max(1,Math.round(n*image.naturalHeight/image.naturalWidth));
    const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,cv.width,cv.height);
    const data=g.getImageData(0,0,cv.width,cv.height).data,edge=[];g.clearRect(0,0,cv.width,cv.height);
    for(let x=2;x<n-2;x+=4){for(let y=0;y<cv.height*.8;y++){if(data[(y*n+x)*4+3]>160&&data[((y+2)*n+x)*4+3]>160){edge.push([x,y]);break;}}}
    g.lineCap='round';for(const [x,y]of edge){g.fillStyle='#d6e1f0';g.beginPath();g.ellipse(x,y+1,4,2.1,0,0,Math.PI*2);g.fill();g.fillStyle='#f4f7fa';g.beginPath();g.ellipse(x,y,4,1.5,0,Math.PI,Math.PI*2);g.fill();}
    snowTiles.set(key,cv);return cv;
  }
  function draw(g,type,x,y,w,h,variant=0,options={}){
    variant=((Math.trunc(variant)%3)+3)%3;const key=`${type}:${variant}`,image=sprites.get(key);if(!image)return false;
    const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
    g.save();
    if(options.shadow){g.fillStyle='rgba(12,18,13,.25)';g.beginPath();g.ellipse(x,y,dw*.42,Math.max(1,dh*.035),0,0,Math.PI*2);g.fill();}
    g.filter=options.season==='autumn'&&['grass','fern'].includes(type)?'sepia(.35) saturate(.8)':options.season==='winter'?'saturate(.7) brightness(.91)':'brightness(.91) saturate(.9)';
    g.drawImage(image,x-dw/2,y-dh,dw,dh);g.filter='none';
    if(options.snow)g.drawImage(snowTile(image,key),x-dw/2,y-dh,dw,dh);
    g.restore();return true;
  }
  window.WoodsObjects={types,src,draw,ready,onReady(fn){listeners.add(fn);},has(type,variant=0){return sprites.has(`${type}:${((variant%3)+3)%3}`);},loaded(){return sprites.size;}};
})();
