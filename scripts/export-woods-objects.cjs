const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {cells}=require('./export-farm-motion.cjs'),root=path.resolve(__dirname,'..');
(async()=>{
 const files=JSON.parse(await fs.readFile(process.argv[2],'utf8')),assets=[],sheets=[];
 await fs.mkdir(path.join(root,'assets/wild/objects'),{recursive:true});
 for(const [type,file]of Object.entries(files)){
  const frames=await cells(file,3,1),previews=[];
  for(let variant=0;variant<3;variant++){
   const f=frames[variant],target=`assets/wild/objects/${type}-shape${variant+1}-v1.webp`;
   const output=await sharp(f.input).resize({width:384,height:384,fit:'inside'}).webp({quality:92,alphaQuality:100}).toBuffer();
   await fs.writeFile(path.join(root,target),output);const meta=await sharp(output).metadata();assets.push({type,variant,path:target,width:meta.width,height:meta.height,bytes:output.length});
   const tile=await sharp(output).resize({width:190,height:190,fit:'contain',background:'#ece8dc'}).png().toBuffer();previews.push(tile);
  }
  const sheet=await sharp({create:{width:600,height:210,channels:4,background:'#ece8dc'}}).composite(previews.map((input,i)=>({input,left:5+i*200,top:10}))).webp({quality:90}).toBuffer();
  await fs.writeFile(path.join(root,`docs/woods-${type}-shapes-v1.webp`),sheet);sheets.push(sheet);
 }
 await sharp({create:{width:1800,height:Math.ceil(sheets.length/3)*210,channels:4,background:'#ece8dc'}}).composite(sheets.map((input,i)=>({input,left:i%3*600,top:Math.floor(i/3)*210}))).webp({quality:90}).toFile(path.join(root,'docs/woods-objects-contact-v1.webp'));
 await fs.writeFile(path.join(root,'assets/wild/objects/manifest.json'),JSON.stringify({tool:'built-in imagegen',variants:3,assets},null,2)+'\n');console.log(JSON.stringify({assets:assets.length,bytes:assets.reduce((sum,a)=>sum+a.bytes,0)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
