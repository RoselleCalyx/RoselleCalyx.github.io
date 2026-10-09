/* Painted botanical objects on a rooted bending mesh, with seasonal variants. */
(function(){
  const images={},variants=new Map();
  for(const [kind,file] of Object.entries({cattail:'cattail-object-v1',reed:'reed-object-v4',leaf:'lotus-leaf-object-v1',hyacinth:'hyacinth-object-v4',ottelia:'ottelia-object-v4',grass:'grass-object-v4'})){
    const img=new Image();img.decoding='async';img.src='assets/wild/'+file+'.webp';
    img.onload=async()=>{try{await img.decode();images[kind]=img;}catch{}};
  }
  function art(kind,season){
    const img=images[kind];if(!img)return null;
    if(season!=='winter'&&season!=='autumn')return img;
    const key=kind+season;if(variants.has(key))return variants.get(key);
    const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
    const g=cv.getContext('2d');g.filter=season==='winter'?'saturate(.18) brightness(.85)':'sepia(.38) saturate(.65)';g.drawImage(img,0,0);
    variants.set(key,cv);return cv;
  }
  function reed(g,x,y,h,bend,season,kind='reed'){
    const img=art(kind,season);if(!img)return false;
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,w=h*iw/ih;
    g.save();g.translate(x,y);
    // Twenty-four overlapping strips approximate a continuously bending stem.
    // The quadratic displacement is zero at the root, so plants stay anchored.
    const n=24,dh=h/n;
    for(let i=0;i<n;i++){
      const v=i/n,offset=bend*h*(1-v)*(1-v),slope=-2*bend*(1-v);
      g.save();g.translate(-w/2+offset,-h+i*dh);g.transform(1,0,slope,1,0,0);
      g.drawImage(img,0,i*ih/n,iw,Math.min(ih-i*ih/n,ih/n+1),0,0,w,dh+.6);g.restore();
    }
    if(season==='winter'){
      g.strokeStyle='rgba(233,238,244,.7)';g.lineWidth=Math.max(.6,h*.006);g.beginPath();g.moveTo(bend*h,-h*.96);g.lineTo(bend*h+2,-h*.94);g.stroke();
    }
    g.restore();return true;
  }
  function leaf(g,x,y,r,angle,season){
    const img=art('leaf',season);if(!img)return false;
    const h=2*r*(img.naturalHeight||img.height)/(img.naturalWidth||img.width);
    g.save();g.translate(x,y);g.scale(1,.58);g.rotate(angle);
    g.drawImage(img,-r,-h/2,2*r,h);g.restore();return true;
  }
  function floating(g,kind,x,y,w,phase,season){
    if(season==='winter')return false;
    const img=art(kind,season);if(!img)return false;
    const h=w*(img.naturalHeight||img.height)/(img.naturalWidth||img.width);
    const bob=Math.sin(phase)*.8;
    g.save();g.translate(x,y+bob);
    g.fillStyle='rgba(13,34,25,.2)';g.beginPath();g.ellipse(0,0,w*.38,w*.045,0,0,Math.PI*2);g.fill();
    // A muted reflection connects the cutout to the water surface.
    g.save();g.scale(1,-.35);g.globalAlpha=.13;g.drawImage(img,-w/2,-h,w,h);g.restore();
    g.rotate(Math.sin(phase*.37)*.018);g.filter='brightness(.9) saturate(.78)';
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
    const submerged=kind==='ottelia'?.13:0;
    g.drawImage(img,0,0,iw,ih*(1-submerged),-w/2,-h*(1-submerged),w,h*(1-submerged));g.restore();return true;
  }
  window.PondPlants={reed,leaf,floating,get ready(){return Object.keys(images).length===6;}};
})();
