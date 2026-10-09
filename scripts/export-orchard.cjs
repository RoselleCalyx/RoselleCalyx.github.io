// Pack four-season generated botanical atlases; keep each root fixed.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {cells}=require('./export-farm-motion.cjs');
const root=path.resolve(__dirname,'..'),seasons=['spring','summer','autumn','winter'];
(async()=>{
 const files=JSON.parse(await fs.readFile(process.argv[2],'utf8')),manifest=[];
 await fs.mkdir(path.join(root,'assets/farm/trees'),{recursive:true});
 for(const [type,file]of Object.entries(files)){
  const frames=await cells(file,2,2);
  for(const f of frames){
   const {data,info}=await sharp(f.input).raw().toBuffer({resolveWithObject:true});let total=0,weighted=0;
   for(let y=Math.floor(info.height*.97);y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a>80){total+=a;weighted+=x*a;}}
   f.rootX=total?weighted/total:info.width/2;
  }
  const scale=Math.min(235/Math.max(...frames.map(f=>f.rootX)),235/Math.max(...frames.map(f=>f.box.width-f.rootX)),455/Math.max(...frames.map(f=>f.box.height)));
  const previews=[];
  for(let i=0;i<4;i++){
   const f=frames[i],w=Math.round(f.box.width*scale),h=Math.round(f.box.height*scale),input=await sharp(f.input).resize(w,h).png().toBuffer();
   const target=`assets/farm/trees/${type}-${seasons[i]}-v1.webp`;
   const output=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input,left:Math.round(256-f.rootX*scale),top:483-h}]).webp({quality:91,alphaQuality:100}).toBuffer();
   await fs.writeFile(path.join(root,target),output);previews.push(await sharp(output).resize(256).png().toBuffer());manifest.push({type,season:seasons[i],path:target,width:512,root:[256,483],bytes:output.length});
  }
  await sharp({create:{width:512,height:512,channels:4,background:'#ece8dc'}}).composite(previews.map((input,i)=>({input,left:i%2*256,top:Math.floor(i/2)*256}))).webp({quality:88}).toFile(path.join(root,`docs/orchard-${type}-v1.webp`));
 }
 await fs.writeFile(path.join(root,'assets/farm/trees/manifest.json'),JSON.stringify({tool:'built-in imagegen',assets:manifest},null,2)+'\n');console.log(JSON.stringify(manifest));
})().catch(e=>{console.error(e);process.exitCode=1;});
