/* Illustrated base + live geometry: textures never define gameplay hit boxes. */
(function(){
  function create(kind,onReady){
    const images=new Map(),failed=new Set(),decoded=new Set();
    const file=season=>`assets/wild/${kind==='woods'?'woods-clearing':'pond-water'}${season==='winter'?'-winter':''}-v2.webp`;
    function selected(season){
      const key=season==='winter'?'winter':'normal';
      if(images.has(key))return images.get(key);
      const image=new Image();images.set(key,image);image.decoding='async';image.fetchPriority='high';
      image.onload=async()=>{try{await image.decode();}catch{}decoded.add(key);onReady();};
      image.onerror=()=>{failed.add(key);onReady();};
      image.src=file(season);return image;
    }
    selected(window.WILD_PAINT_BOOT?.season || window.Wild?.season().name || 'summer');
    return {
      pending(season){selected(season);const key=season==='winter'?'winter':'normal';return !failed.has(key)&&!decoded.has(key);},
      ready(season){const img=selected(season);return decoded.has(season==='winter'?'winter':'normal')&&img.naturalWidth>0;},
      draw(g,w,h,season){const img=selected(season);if(!decoded.has(season==='winter'?'winter':'normal')||!img.naturalWidth)return false;g.save();g.filter=season==='autumn'?'sepia(.2) saturate(.86) hue-rotate(-9deg)':season==='spring'?'saturate(.92)':'none';g.drawImage(img,0,0,w,h);g.restore();return true;}
    };
  }
  window.SceneTextures={create};
})();
