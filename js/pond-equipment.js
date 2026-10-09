/* Transparent material studies, with live water and light supplied by pond.js. */
(function(){
  const images={};let loaded=0;
  for(const name of ['dock','basket','trap','lantern','stake','rod']){
    const img=new Image();img.decoding='async';
    img.onload=async()=>{try{await img.decode();images[name]=img;loaded++;dispatchEvent(new Event('pondgearready'));}catch{}};
    img.src=`assets/wild/equipment/${name}.webp`;
  }
  function draw(g,name,x,y,w,h,alpha=1){
    const img=images[name];if(!img)return false;
    g.save();g.globalAlpha*=alpha;g.drawImage(img,x,y,w,h);g.restore();return true;
  }
  function rod(g,start,control,end,k){
    const img=images.rod;if(!img)return false;
    const pt=t=>{const u=1-t;return{x:u*u*start.x+2*u*t*control.x+t*t*end.x,y:u*u*start.y+2*u*t*control.y+t*t*end.y};};
    // Bend the same wooden shaft along the live curve; its grain stays attached.
    const N=36,height=14*k;
    for(let i=0;i<N;i++){
      const a=pt(i/N),b=pt((i+1)/N),len=Math.hypot(b.x-a.x,b.y-a.y);
      g.save();g.translate(a.x,a.y);g.rotate(Math.atan2(b.y-a.y,b.x-a.x));
      g.drawImage(img,i*img.width/N,0,img.width/N,img.height,0,-height/2,len+.8,height);g.restore();
    }
    return true;
  }
  window.PondEquipment={draw,rod,get ready(){return loaded===6;}};
})();
