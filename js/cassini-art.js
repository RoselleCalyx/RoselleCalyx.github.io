/* A cached, lit 3D projection built from cylinders, foil panels and a dish.
   The view follows the reference painting; it is an artistic spacecraft model. */
(function () {
  const canvas = document.createElement('canvas'); canvas.width = 1120; canvas.height = 480;
  const c = canvas.getContext('2d'), TAU = Math.PI * 2;
  c.translate(760, 240); c.scale(3, 3);
  const project = ([x,y,z]) => [x + z * .44, y - z * .32];
  const random = i => {const v=Math.sin(i*127.1+9.3)*43758.5453;return v-Math.floor(v);};
  function line(a,b,color,width) {c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...project(a));c.lineTo(...project(b));c.stroke();}
  function cylinder(x0,x1,y,z,r,metal) {
    const faces=[];
    for(let i=0;i<28;i++) {
      const a=TAU*i/28,b=TAU*(i+1)/28;
      const pts=[[x0,y+Math.cos(a)*r,z+Math.sin(a)*r],[x1,y+Math.cos(a)*r,z+Math.sin(a)*r],[x1,y+Math.cos(b)*r,z+Math.sin(b)*r],[x0,y+Math.cos(b)*r,z+Math.sin(b)*r]];
      faces.push({pts,depth:Math.sin((a+b)/2),light:.26+.74*Math.max(0,Math.cos((a+b)/2-.65))});
    }
    faces.sort((a,b)=>a.depth-b.depth).forEach((f,i)=>{
      const base=metal==='gold'?[192,131,50]:[105,111,119];
      c.fillStyle=`rgb(${base.map(v=>Math.round(v*f.light)).join(',')})`;
      c.beginPath();f.pts.forEach((p,j)=>j?c.lineTo(...project(p)):c.moveTo(...project(p)));c.closePath();c.fill();
      c.strokeStyle='rgba(6,9,14,.36)';c.lineWidth=.23;c.stroke();
      if(metal==='gold') {
        c.save();c.clip();
        for(let n=0;n<22;n++) {const p=project([x0+(x1-x0)*random(i*51+n),y+(random(n*19+i)-.5)*r*2,z+r*f.depth]);c.strokeStyle=n%2?'rgba(255,222,151,.29)':'rgba(32,21,12,.3)';c.lineWidth=.3;c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[0]+random(n+8)*6-3,p[1]+random(n+29)*4-2);c.stroke();}
        c.restore();
      }
    });
  }
  // Magnetometer boom, warm rim and repeated truss sections.
  line([-43,-8,0],[-224,-10,0],'#15171a',2.5);line([-43,-9,0],[-224,-11,0],'#a57539',.6);
  for(let i=0;i<17;i++)line([-52-i*10,-10,0],[-52-i*10,-6,0],'#4d4130',.75);
  cylinder(-231,-223,-10,0,2,'gold');
  // Three radioisotope generators, with supports and cooling fins.
  for(const [y,z] of [[32,-20],[-29,-13],[24,27]]) {
    line([-20,0,0],[-17,y,z],'#25282a',2.8);cylinder(-28,-3,y,z,6,'steel');
    for(let x=-26;x<-3;x+=3)cylinder(x,x+.8,y,z,7,'steel');
    line([-28,y+6,z],[-3,y+6,z],'#d2a45c',.5);
  }
  cylinder(-60,-39,0,0,19,'steel');cylinder(-39,7,0,0,22,'gold');cylinder(7,24,0,0,24,'steel');
  // Structural bands and instrument boxes around the bus.
  [-56,-39,-18,6,20].forEach(x=>cylinder(x,x+1.8,0,0,x<0?23:25,'steel'));
  for(let i=0;i<8;i++) {
    const a=TAU*i/8,y=Math.cos(a)*25,z=Math.sin(a)*25;
    line([-15,y,z],[-9,y*1.3,z*1.3],'#181b21',1.7);
    cylinder(-14,-6,y*1.3,z*1.3,3,i%2?'gold':'steel');
  }
  line([-15,-20,0],[-15,-43,0],'#60656b',1.1);line([-15,-43,0],[4,-47,0],'#d4cbb7',.55);
  cylinder(-20,-12,-43,0,3,'steel');
  // Parabolic dish: shaded ribs in depth order, curved from apex to rim.
  const panels=[];
  for(let i=0;i<48;i++) {
    const a=i*TAU/48,b=(i+1)*TAU/48;panels.push({a,b,z:Math.sin((a+b)/2)});
  }
  panels.sort((a,b)=>a.z-b.z).forEach(({a,b,z},i)=>{
    const points=[];
    for(let n=0;n<=8;n++){const r=n*5.4;points.push(project([27+.011*r*r,Math.cos(a)*r,Math.sin(a)*r]));}
    for(let n=8;n>=0;n--){const r=n*5.4;points.push(project([27+.011*r*r,Math.cos(b)*r,Math.sin(b)*r]));}
    const light=.56+.38*Math.max(0,Math.cos((a+b)/2-.55));
    c.fillStyle=`rgb(${[243,222,183].map(v=>Math.round(v*light)).join(',')})`;c.beginPath();points.forEach((p,j)=>j?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();
    c.strokeStyle='rgba(255,234,188,.2)';c.lineWidth=.25;c.stroke();
  });
  c.strokeStyle='#e9d9b9';c.lineWidth=1.4;c.beginPath();
  for(let i=0;i<=96;i++){const a=i*TAU/96,p=project([47.5,Math.cos(a)*43.2,Math.sin(a)*43.2]);i?c.lineTo(...p):c.moveTo(...p);}c.stroke();
  // Feed horn and triangular struts sit in front of the dish.
  for(const a of [0,TAU/3,2*TAU/3])line([48,Math.cos(a)*40,Math.sin(a)*40],[72,0,0],'#ac9470',.85);
  cylinder(68,76,0,0,2.8,'steel');
  c.setTransform(1,0,0,1,0,0);
  const texture=new Image();let ready=false;
  texture.decoding='async';texture.src='assets/cassini-flight-v2.webp';
  texture.onload=async()=>{try{if(texture.decode)await texture.decode();ready=true;}catch{}};
  window.CassiniArt = {get textured(){return ready;},draw(ctx,x,y,scale,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);if(ready){const w=340,h=w*texture.naturalHeight/texture.naturalWidth;ctx.drawImage(texture,-w*.76,-h*.51,w,h);}else ctx.drawImage(canvas,-760/3,-80,canvas.width/3,160);ctx.restore();}};
})();
