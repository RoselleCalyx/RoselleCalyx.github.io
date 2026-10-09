// Pack generated 4 × 5 atlases as 12 walking + 8 leaping ground-aligned frames.
// Usage: node scripts/export-expanded-motion.cjs atlas-files.json
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {cells,render,scaleFor}=require('./export-farm-motion.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const files=JSON.parse(await fs.readFile(process.argv[2],'utf8')),manifest=[];
 await fs.mkdir(path.join(root,'assets/farm/jump'),{recursive:true});
 for(const [species,file] of Object.entries(files)){
  const frames=await cells(file,4,5),scale=scaleFor(frames);
  const buffers=await Promise.all(frames.map(c=>render(c,scale)));
  for(const [kind,start,count] of [['walk',0,12],['jump',12,8]]){
   const name=`assets/farm/${kind}/${species}-v3.webp`;
   await sharp({create:{width:384*count,height:384,channels:4,background:'#00000000'}})
    .composite(buffers.slice(start,start+count).map((input,i)=>({input,left:i*384,top:0})))
    .webp({quality:89,alphaQuality:100}).toFile(path.join(root,name));
   manifest.push({species,kind,path:name,frames:count,baseline:360,bytes:(await fs.stat(path.join(root,name))).size});
  }
  const preview=path.join(root,`docs/${species}-motion-v3.webp`);
  const thumbs=await Promise.all(buffers.map(input=>sharp(input).resize(192).png().toBuffer()));
  await sharp({create:{width:192*4,height:192*5,channels:4,background:'#eee9dc'}})
    .composite(thumbs.map((input,i)=>({input,left:i%4*192,top:Math.floor(i/4)*192})))
    .webp({quality:85}).toFile(preview);
 }
 const target=path.join(root,'assets/farm/motion-v3-manifest.json');
 let prior=[];try{prior=JSON.parse(await fs.readFile(target,'utf8')).assets||[];}catch{}
 await fs.writeFile(target,JSON.stringify({generatedWith:'built-in imagegen',cell:384,assets:[...prior.filter(p=>!files[p.species]),...manifest]},null,2)+'\n');
 console.log(JSON.stringify(manifest));
})().catch(e=>{console.error(e);process.exitCode=1;});
