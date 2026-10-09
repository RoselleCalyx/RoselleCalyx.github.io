/* Illustrated base + live geometry: textures never define gameplay hit boxes. */
(function(){
  function create(kind,onReady){
    const image=new Image();image.decoding='async';image.src=`assets/wild/${kind==='woods'?'woods-clearing':'pond-water'}-v2.webp`;
    const winter=new Image();winter.decoding='async';winter.src=`assets/wild/${kind==='woods'?'woods-clearing':'pond-water'}-winter-v2.webp`;
    for(const img of [image,winter])img.onload=()=>{if(img.decode)img.decode().then(onReady).catch(onReady);else onReady();};
    const selected=season=>season==='winter'?winter:image;
    return {
      ready(season){const img=selected(season);return img.complete&&img.naturalWidth>0;},
      draw(g,w,h,season){const img=selected(season);if(!img.complete||!img.naturalWidth)return false;g.save();g.filter=season==='autumn'?'sepia(.2) saturate(.86) hue-rotate(-9deg)':season==='spring'?'saturate(.92)':'none';g.drawImage(img,0,0,w,h);g.restore();return true;}
    };
  }
  window.SceneTextures={create};
})();
