'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sharp=require('sharp');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/home-occlusion.js'),'utf8'),context);
const contours=context.window.HomeOcclusion.contours;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="761">${Object.values(contours).map(d=>`<path fill="white" d="${d}"/>`).join('')}</svg>`;
test('Only near people, animal and rock solids occlude the flight',async()=>{
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];
  for(const [name,x,y] of [['hair',544,360],['backpack',480,465],['leg',613,510],['cat ear',634,451],['cat body',672,518],['cat tail',737,573],['near rocks',700,650],['left slope',100,600]])assert.ok(alpha(x,y)>240,name);
  for(const [name,x,y] of [['sky',800,200],['clouds beside hair',600,400],['gap before cat',619,471],['over cat ears',650,425],['clouds beside cat',716,510],['cloud sea',900,540],['distant mountains',1110,520],['right cloud sea',1510,700]])assert.equal(alpha(x,y),0,name);
});
test('The cat ears and tail retain narrow, local boundaries',async()=>{
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];
  assert.equal(alpha(650,440),0,'open notch between cat ears');
  assert.equal(alpha(741,550),0,'air above curled tail');
  assert.ok(alpha(737,573)>240,'tail itself is foreground');
});

test('Folded legs and boots remain a continuous foreground during the crossing',async()=>{
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];
  for(const [x,y] of [[585,500],[590,495],[595,500],[595,510],[590,520],[580,525],[599,532]]){
    assert.ok(alpha(x,y)>250,`solid trousers / boot contact at ${x},${y}`);
  }
  assert.equal(alpha(628,505),0,'real air between the outer trouser edge and cat stays open');
});

test('The right-hand outcrop occludes up to its sunlit rims, not into the cloud sea',async()=>{
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];
  // Each point lay between the old coarse ridge and the real rock edge.
  for(const [x,y] of [[765,584],[832,600],[900,615],[960,632],[1000,646],[1062,690],[1100,708],[1250,725],[1325,733],[1376,754]])
    assert.ok(alpha(x,y)>240,`near rock at ${x},${y}`);
  for(const [x,y] of [[960,620],[1010,636],[1060,670],[1150,688],[1240,712],[1300,725],[1395,758]])
    assert.equal(alpha(x,y),0,`cloud above the outcrop at ${x},${y}`);
});
