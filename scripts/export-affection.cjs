// Ground-align imagegen's 4x4 affection atlas and the revised 4x3 panda gait.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {cells,render,scaleFor}=require('./export-farm-motion.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const files=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
 await fs.mkdir(path.join(root,'assets/farm/affection'),{recursive:true});
 for(const [sp,file] of Object.entries(files)){
  const walk=sp==='panda-walk',frames=await cells(file,4,walk?3:4),scale=scaleFor(frames);
  const buffers=await Promise.all(frames.map(c=>render(c,scale)));
  const dest=walk?'assets/farm/walk/panda-v4.webp':`assets/farm/affection/${sp}-v4.webp`;
  await sharp({create:{width:384*frames.length,height:384,channels:4,background:'#00000000'}})
   .composite(buffers.map((input,i)=>({input,left:i*384,top:0}))).webp({quality:89,alphaQuality:100}).toFile(path.join(root,dest));
  const thumbs=await Promise.all(buffers.map(input=>sharp(input).resize(192).png().toBuffer()));
  await sharp({create:{width:768,height:192*(walk?3:4),channels:4,background:'#eee9dc'}})
   .composite(thumbs.map((input,i)=>({input,left:i%4*192,top:Math.floor(i/4)*192}))).webp({quality:86}).toFile(path.join(root,`docs/${sp}-v4.webp`));
  console.log(dest);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
