/* Our cinematic Cassini derivative: engineering-inspired details over the
   NASA orbiter. These additions are fictional, not historical flight hardware. */
// Remove only the old outboard foil sleeve and its metal collars. Selection
// is in the NASA model's coordinates; the dish, bus and plasma antennas stay.
function removeOriginalBoom(T,source){
  source.updateMatrixWorld(true);
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  source.traverse(object=>{
    if(!object.isMesh||!['foil_gold','aluminum'].includes(object.name))return;
    const geometry=object.geometry.clone(),positions=geometry.attributes.position;
    const index=geometry.index,kept=[],count=index?index.count:positions.count;
    for(let i=0;i<count;i+=3){
      const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
      a.fromBufferAttribute(positions,ia).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(positions,ib).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(positions,ic).applyMatrix4(object.matrixWorld);
      const oldSleeve=(a.z+b.z+c.z)/3 < -1.85 &&
        Math.min(a.y,b.y,c.y)>.65 && Math.max(a.y,b.y,c.y)<1.65 &&
        Math.max(Math.abs(a.x),Math.abs(b.x),Math.abs(c.x))<.75;
      if(!oldSleeve)kept.push(ia,ib,ic);
    }
    geometry.setIndex(kept);object.geometry=geometry;
  });
}

export function addEpicDetails(T,rig,source){
  removeOriginalBoom(T,source);
  const design=new T.Group();design.name='Cassini · gilded voyager';rig.add(design);
  const champagne=new T.MeshStandardMaterial({color:0xbba477,metalness:.58,roughness:.47});
  const ceramic=new T.MeshStandardMaterial({color:0xc8b99b,metalness:.18,roughness:.7});
  const graphite=new T.MeshStandardMaterial({color:0x252d38,metalness:.48,roughness:.58});
  const titanium=new T.MeshStandardMaterial({color:0x6e6c65,metalness:.65,roughness:.5});
  const amber=new T.MeshStandardMaterial({color:0xc9a269,emissive:0xffc178,emissiveIntensity:.8,metalness:.3,roughness:.5});
  const lens=new T.MeshPhysicalMaterial({color:0x18343c,metalness:.55,roughness:.18,clearcoat:.9,
    emissive:0x3a7b81,emissiveIntensity:.18});
  function mesh(geometry,material,x=0,y=0,z=0,parent=design){
    const item=new T.Mesh(geometry,material);item.position.set(x,y,z);parent.add(item);return item;
  }
  function rim(radius,tube,y,material,start=0,arc=Math.PI*2){
    const item=mesh(new T.TorusGeometry(radius,tube,6,80,arc),material,0,y,-.1);
    item.rotation.set(Math.PI/2,0,start);return item;
  }
  // A double lip, hairline ribs and six short contact arcs articulate the dish.
  rim(2,.027,2.29,champagne);rim(1.94,.012,2.27,ceramic);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,points=[];
    for(let j=0;j<=12;j++){
      const r=.22+j/12*1.73;points.push(new T.Vector3(r*Math.cos(a),1.49+.205*r*r,r*Math.sin(a)-.1));
    }
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),16,.009,4,false),champagne);
  }
  for(let i=0;i<6;i++)rim(2.015,.012,2.295,amber,i*Math.PI/3+.15,.16);
  // A compact faceted collar connects the ivory antenna to the armored bus.
  mesh(new T.CylinderGeometry(.56,.73,.32,12),graphite,0,1.02,0);
  mesh(new T.CylinderGeometry(.73,.73,.035,12),champagne,0,.85,0);

  // Beveled ceramic shields reveal gold foil between them; narrow structural
  // rails give the instrument stack a coherent vertical rhythm.
  const shield=new T.Shape();
  [[-.20,-.91],[.20,-.91],[.31,-.65],[.31,.65],[.18,.91],[-.18,.91],[-.31,.65],[-.31,-.65]].forEach(([x,y],i)=>i?shield.lineTo(x,y):shield.moveTo(x,y));
  shield.closePath();
  const shieldGeometry=new T.ExtrudeGeometry(shield,{depth:.045,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.02});
  const railGeometry=new T.BoxGeometry(.027,2.25,.04);
  const seamGeometry=new T.BoxGeometry(.018,.59,.012);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,r=1.19;
    const panel=mesh(shieldGeometry,i%3===0?graphite:ceramic,r*Math.sin(a),-.56,r*Math.cos(a));panel.rotation.y=a;
    const rail=mesh(railGeometry,champagne,1.24*Math.sin(a+.29),-.56,1.24*Math.cos(a+.29));rail.rotation.y=a+.29;
    if(i%2===0){
      const seam=mesh(seamGeometry,amber,1.25*Math.sin(a),-.51,1.25*Math.cos(a));seam.rotation.y=a;
    }
    for(const y of [-1.2,.08]){
      const fastener=mesh(new T.SphereGeometry(.031,6,4),champagne,1.26*Math.sin(a),y,1.26*Math.cos(a));
      fastener.scale.z=.45;fastener.rotation.y=a;
    }
  }
  // One recessed multi-element optical head, without a cockpit-like window.
  const optic=new T.Group();optic.position.set(-.14,-.18,1.32);design.add(optic);
  const housing=mesh(new T.CylinderGeometry(.29,.33,.27,8),graphite,0,0,0,optic);housing.rotation.x=Math.PI/2;
  mesh(new T.TorusGeometry(.245,.025,6,32),champagne,0,0,.143,optic);
  mesh(new T.CircleGeometry(.216,32),lens,0,0,.147,optic);
  mesh(new T.TorusGeometry(.14,.009,4,32),titanium,0,0,.154,optic);
  mesh(new T.CircleGeometry(.055,16),graphite,0,0,.159,optic);
  // Compact graphite heat exchangers sit close to the body, not broad wings.
  const finGeometry=new T.BoxGeometry(.035,.92,.62);
  for(const side of [-1,1]){
    mesh(new T.BoxGeometry(.22,1.04,.7),titanium,side*1.35,-1.45,-.27);
    for(let i=0;i<5;i++)mesh(finGeometry,graphite,side*(1.43+i*.055),-1.45,-.27);
    mesh(new T.BoxGeometry(.29,.024,.66),champagne,side*1.53,-.97,-.27);
  }
  // A slender carbon-composite instrument mast replaces the bulky gold
  // sleeve: three tapering spars, tiny braces, three joints and a sensor tip.
  // Its modestly shortened span is a fictional design choice for this scene.
  const carbon=new T.MeshStandardMaterial({color:0x303b45,metalness:.32,roughness:.68});
  function spar(from,to,radius,material){
    const direction=new T.Vector3().subVectors(to,from),middle=from.clone().add(to).multiplyScalar(.5);
    const item=mesh(new T.CylinderGeometry(radius*.65,radius,direction.length(),6),material,middle.x,middle.y,middle.z);
    item.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return item;
  }
  const z0=-1.88,z1=-9.05,mastY=1.15;
  const root=mesh(new T.CylinderGeometry(.14,.17,.22,10),graphite,0,mastY,z0);root.rotation.x=Math.PI/2;
  const braces=[];
  function corner(i,t){
    const angle=i*Math.PI*2/3,radius=.085*(1-t)+.032*t;
    return new T.Vector3(Math.cos(angle)*radius,mastY+Math.sin(angle)*radius,z0+(z1-z0)*t);
  }
  for(let i=0;i<3;i++){
    spar(corner(i,0),corner(i,1),.018,carbon);
    for(let j=0;j<14;j++){
      const a=corner(i,j/14),b=corner((i+1)%3,(j+1)/14);
      braces.push(...a.toArray(),...b.toArray());
    }
  }
  const braceGeometry=new T.BufferGeometry();braceGeometry.setAttribute('position',new T.Float32BufferAttribute(braces,3));
  design.add(new T.LineSegments(braceGeometry,new T.LineBasicMaterial({color:0x75808b,transparent:true,opacity:.65})));
  for(const t of [.04,.36,.69,.985]){
    const collar=mesh(new T.CylinderGeometry(.09-.04*t,.09-.04*t,.035,10),champagne,0,mastY,z0+(z1-z0)*t);
    collar.rotation.x=Math.PI/2;
  }
  const sensor=mesh(new T.CylinderGeometry(.065,.075,.18,6),graphite,0,mastY,z1-.06);sensor.rotation.x=Math.PI/2;
  mesh(new T.TorusGeometry(.056,.009,4,12),champagne,0,mastY,z1-.155);
  mesh(new T.CircleGeometry(.04,12),lens,0,mastY,z1-.166).rotation.y=Math.PI;
  // Reuse immutable meshes/materials; the entire design shares the rigid
  // spacecraft attitude and the scene's lighting, including during breakup.
  design.userData.fictional=true;
  return design;
}
