'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function glb(file){
  const b=fs.readFileSync(path.join(__dirname,'../assets/models',file)),jl=b.readUInt32LE(12);
  const json=JSON.parse(b.subarray(20,20+jl)),bin=b.subarray(20+jl+8);
  const view=i=>{const v=json.bufferViews[i];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};
  return {json,view,size:b.length};
}
test('The web model keeps NASA geometry byte for byte and drops unused PNG textures',()=>{
  const nasa=glb('cassini-orbiter-nasa.glb'),web=glb('cassini-orbiter-web.glb');
  assert.ok(web.size<300*1024,'web copy stays small');
  assert.deepEqual(web.json.images.map(i=>i.mimeType),['image/webp']);
  assert.ok(web.json.extensionsRequired.includes('EXT_texture_webp'));
  const draco=m=>m.meshes.flatMap(mesh=>mesh.primitives.map(p=>p.extensions.KHR_draco_mesh_compression.bufferView));
  const a=draco(nasa.json),b=draco(web.json);assert.equal(a.length,b.length);
  a.forEach((v,i)=>assert.ok(nasa.view(v).equals(web.view(b[i])),'Draco geometry '+i+' identical'));
  const foil=nasa.json.images.findIndex(i=>i.name==='tex_01_'&&i.mimeType==='image/webp');
  assert.ok(nasa.view(nasa.json.images[foil].bufferView).equals(web.view(web.json.images[0].bufferView)),'foil WebP identical');
});
