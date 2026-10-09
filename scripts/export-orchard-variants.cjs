// Export a 4-season × 3-shape atlas with fixed root anchors.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {cells}=require('./export-farm-motion.cjs');
const root=path.resolve(__dirname,'..'),seasons=['spring','summer','autumn','winter'];
(async()=>{
 const files=JSON.parse(await fs.readFile(process.argv[2],'utf8')),assets=[];
 for(const [type,file]of Object.entries(files)){
  const frames=await cells(file,4,3);
  for(const f of frames){
   const {data,info}=await sharp(f.input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let total=0,weighted=0;
   for(let y=Math.floor(info.height*.97);y<info.height;y++)for(let x=0;x<info.width;x++){
    const a=data[(y*info.width+x)*4+3];if(a>80){total+=a;weighted+=x*a;}
   }
   f.width=info.width;f.height=info.height;f.rootX=total?weighted/total:info.width/2;
  }
  const scale=Math.min(238/Math.max(...frames.map(f=>f.rootX)),238/Math.max(...frames.map(f=>f.width-f.rootX)),455/Math.max(...frames.map(f=>f.height))),previews=[];
  for(let i=0;i<12;i++){
   const f=frames[i],width=Math.round(f.width*scale),height=Math.round(f.height*scale),variant=Math.floor(i/4),season=seasons[i%4];
   const input=await sharp(f.input).resize(width,height).png().toBuffer(),target=`assets/farm/trees/${type}-${season}-shape${variant+1}-v2.webp`;
   const output=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input,left:Math.round(256-f.rootX*scale),top:483-height}]).webp({quality:91,alphaQuality:100}).toBuffer();
   await fs.writeFile(path.join(root,target),output);assets.push({type,variant,season,path:target,width:512,root:[256,483],bytes:output.length});
   previews.push(await sharp(output).resize(256).png().toBuffer());
  }
  await sharp({create:{width:1024,height:768,channels:4,background:'#ece8dc'}}).composite(previews.map((input,i)=>({input,left:i%4*256,top:Math.floor(i/4)*256}))).webp({quality:90}).toFile(path.join(root,`docs/orchard-${type}-shapes-v2.webp`));
 }
 await fs.writeFile(path.join(root,'assets/farm/trees/variants-v2-manifest.json'),JSON.stringify({tool:'built-in imagegen',variants:3,seasons,assets},null,2)+'\n');
 console.log(JSON.stringify({assets:assets.length,bytes:assets.reduce((s,a)=>s+a.bytes,0)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
