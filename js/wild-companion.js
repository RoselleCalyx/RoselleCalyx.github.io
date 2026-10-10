/* Farm affection frames, painted into the woods/pond at the guardian's original depth. */
(function () {
  const FOOD = {
    apple:['Apple','farm'],peach:['Peach','farm'],orange:['Orange','farm'],cherry:['Cherries','farm'],
    kiwi:['Kiwi','farm'],grape:['Grapes','farm'],durian:['Durian','farm'],mango:['Mango','farm'],
    bayberry:['Wild bayberry','woods'],strawberry:['Wild strawberry','woods'],shoot:['Bamboo shoot','woods'],rosehip:['Rose hip','woods'],
    morel:['Morel','woods'],chanterelle:['Chanterelle','woods'],porcini:['Porcini','woods'],shiitake:['Shiitake','woods'],matsutake:['Matsutake','woods'],pinecone:['Pine cone','woods'],
    crucian:['Crucian carp','pond'],carp:['Carp','pond'],koi:['Koi','pond'],goldkoi:['Golden koi','pond'],catfish:['Catfish','pond'],mandarin:['Mandarin fish','pond'],
    bitterling:['Bitterling','pond'],minnow:['Stone moroko','pond'],loach:['Loach','pond'],eel:['Rice-field eel','pond'],shrimp:['River shrimp','pond'],crayfish:['Crayfish','pond'],crab:['Mitten crab','pond'],lotus:['Lotus seed pod','pond']
  };
  const FISH=['crucian','carp','koi','goldkoi','catfish','mandarin','bitterling','minnow','loach','eel'];
  // The same preferences and action order as the farm's animal interactions.
  const DIET={
    snowcat:[FISH.concat('shrimp'),['crab','crayfish']],rabbit:[['strawberry','apple'],['peach','cherry','rosehip']],
    panda:[['shoot'],['apple','peach','lotus']],fox:[['bayberry','cherry','crucian','minnow'],['apple','strawberry','rosehip','shrimp','loach']],
    shiba:[['apple','peach'],['crucian','carp','porcini','shiitake']],hedgehog:[['strawberry','chanterelle'],['apple','bayberry','porcini','morel']],
    duckling:[['shrimp','minnow','bitterling'],['lotus','strawberry','loach']],penguin:[['crucian','minnow','bitterling','shrimp','mandarin'],['crab','crayfish','loach','carp']],
    redpanda:[['shoot','apple'],['peach','cherry','strawberry']],raccoon:[['shrimp','crayfish','strawberry'],['apple','cherry','crucian','lotus']],
    wolf:[FISH,['shrimp','crab','crayfish']],crocodile:[['carp','catfish','crucian','eel'],['minnow','loach','shrimp','crayfish']],
    fennec:[['shrimp','minnow','strawberry'],['apple','bayberry','loach']]
  };
  const HAPPY={snowcat:['knead','wave','happy-hop'],rabbit:['binky','happy-hop','wave'],panda:['wave','happy-hop','pet-stretch'],fox:['pounce','happy-hop','wave'],shiba:['wag','wave','happy-hop'],hedgehog:['curl','wave','happy-hop'],duckling:['flap','happy-hop','wave'],penguin:['flap','wave','happy-hop'],redpanda:['wave','happy-hop'],raccoon:['wave','happy-hop'],wolf:['wag','wave'],crocodile:['swish'],fennec:['pounce','happy-hop','wave']};
  const PET={snowcat:['knead','pet-nuzzle','wave','pet-stretch'],rabbit:['binky','pet-nuzzle','wave','pet-stretch'],panda:['wave','pet-nuzzle','pet-stretch'],fox:['wave','pet-nuzzle','pounce','pet-stretch'],shiba:['wag','pet-nuzzle','wave','pet-stretch'],hedgehog:['curl','pet-nuzzle','wave'],duckling:['flap','pet-nuzzle','wave'],penguin:['flap','pet-nuzzle','wave'],redpanda:['pet-nuzzle','wave','pet-stretch'],raccoon:['wave','pet-nuzzle'],wolf:['wag','pet-nuzzle','pet-stretch'],crocodile:['swish','pet-nuzzle'],fennec:['pet-nuzzle','wave','pounce']};
  const TEXT={knead:'stretches and kneads with soft paws',wave:'waves a little paw',wag:'wags its fluffy tail','happy-hop':'hops up with delight',binky:'makes a happy little bunny hop',pounce:'crouches, then springs up',curl:'tucks in, then peeks out',flap:'flutters tiny wings',swish:'swishes its tail','pet-nuzzle':'leans into your hand','pet-stretch':'takes a long, contented stretch'};
  const BAGS={farm:['farm-basket',null],woods:['wild-woods','basket'],pond:['wild-pond','creel']};
  const EMOJI={farm:'🍎',woods:'🍄',pond:'🐟'};
  const HOPS=new Set(['happy-hop','binky','pounce']);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  function create({stage,image,box,onInventory}) {
    const {store}=Site;
    if(!document.getElementById("fr-apple"))document.body.insertAdjacentHTML("afterbegin",FarmArt.defs());
    const species=Object.hasOwn(FarmArt.SPECIES,window.FARM?.keeper?.species)?FARM.keeper.species:'snowcat';
    const name=Wild.keeper.name,key=species+':'+name;
    const menu=document.getElementById('guardianMenu'),foodPanel=document.getElementById('guardianFood');
    const tray=document.getElementById('guardianFoodTray'),note=document.getElementById('guardianFoodNote');
    const feedback=document.getElementById('guardianFeedback');
    const buttons=[...document.querySelectorAll('[data-guardian-action]')];
    document.getElementById('guardianName').textContent=name;
    menu.setAttribute('aria-label','Actions for '+name);
    foodPanel.setAttribute('aria-label','Choose food for '+name);
    buttons.forEach(b=>{
      b.setAttribute('aria-label',(b.dataset.guardianAction==='feed'?'Feed ':'Pet ')+name);
      if(b.dataset.guardianAction==='feed'){
        b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','guardianFood');b.setAttribute('aria-expanded','false');
      }
    });

    // AnimalReactions only needs this detached actor and its canvas. No second
    // DOM animal is placed on top of rocks, reeds or growing mushrooms.
    const el=document.createElement('div');
    const sprite=image.cloneNode();sprite.className='animal-sprite';
    const art=document.createElement('canvas');art.className='reaction-art';art.width=art.height=320;
    el.append(sprite,art);
    const actor={def:{species,name},el,reaction:null};
    const jump=new Image();let jumpReady=false;
    if(FarmArt.JUMPS.has(species)) {
      jump.decoding='async';
      jump.onload=async()=>{try{await jump.decode();jumpReady=jump.naturalWidth===8*384&&jump.naturalHeight===384;}catch{}};
      jump.src=`assets/farm/jump/${species}-v3.webp`;
    }
    const jumpArt=document.createElement('canvas');jumpArt.width=jumpArt.height=384;
    const jg=jumpArt.getContext('2d');
    let feeding=false,petCount=0,snackCount=0,snacks=[],reactionTimer=null,opener=null;
    let emotes=[],flight=null,treat=null,alive=true;
    const timers=new Set();
    const calm=()=>Wild.reduce||!!window.Sky?.calm;
    const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);if(alive)fn();},ms);timers.add(t);return t;};
    const announce=text=>{feedback.textContent=text;};
    function lock(value) {
      feeding=value;
      buttons.forEach(b=>{b.disabled=value;});
    }
    function close(focus=false) {
      menu.hidden=true;foodPanel.hidden=true;
      buttons.filter(b=>b.dataset.guardianAction==='feed').forEach(b=>b.setAttribute('aria-expanded','false'));
      if(focus&&opener?.isConnected&&!opener.disabled)opener.focus({preventScroll:true});
    }
    function open(line) {
      close();
      if(line&&!feeding&&!actor.reaction)announce(line);
      const b=box(),half=menu.offsetWidth/2||48;
      menu.style.left=clamp(b.cx,half+6,stage.clientWidth-half-6)+'px';
      menu.style.top=Math.max(48,b.y+10)+'px';
      menu.hidden=false;
      opener=document.querySelector('#guardianActions [data-guardian-action="pet"]');
      menu.querySelector('[data-guardian-action="pet"]').focus({preventScroll:true});
    }
    function pantry() {
      const bags=Object.fromEntries(Object.entries(BAGS).map(([from,[k,field]])=>{const state=store.get(k,{})||{};return[from,field?state[field]||{}:state];}));
      return Object.entries(FOOD).flatMap(([id,[label,from]])=>{
        const n=Number(bags[from][id]);return Number.isSafeInteger(n)&&n>0?[{id,name:label,from,n}]:[];
      });
    }
    function icon(f) {
      const holder=document.createElement('span');holder.className='guardian-food-icon';
      const cached=store.get('wild-icons',{})?.[f.id];
      if(f.from==='farm')holder.innerHTML=FarmArt.fruitIcon(f.id);
      else if(typeof cached==='string'&&/^data:image\/(png|webp|jpeg);base64,/.test(cached)){
        const img=document.createElement('img');img.src=cached;img.alt='';holder.append(img);
      } else {const span=document.createElement('span');span.className='emo';span.textContent=EMOJI[f.from];holder.append(span);}
      return holder;
    }
    function openFood(from) {
      if(feeding){announce(`Let ${name} finish that bite first…`);return;}
      close();opener=from;
      const list=pantry(),known=store.get('farm-diet',{})?.[species]||{};
      note.textContent='For '+name+' · from your orchard, basket and creel';
      tray.replaceChildren();
      if(!list.length){
        const p=document.createElement('p');p.className='feed-empty';
        p.textContent='Nothing to offer yet. Pick ripe fruit, forage in the woods, or catch a fish at the pond.';tray.append(p);
      }
      const marks={love:'♥',like:'♪',meh:'✕',play:'✦'};
      list.forEach(f=>{
        const b=document.createElement('button');b.type='button';b.className='treat';b.dataset.food=f.id;
        if(Object.hasOwn(marks,known[f.id]))b.classList.add(known[f.id]);
        b.title=f.name+' · '+f.n;b.setAttribute('aria-label','Offer '+f.name+' to '+name+' ('+f.n+' available)');
        b.append(icon(f));const count=document.createElement('b');count.textContent=f.n;b.append(count);
        if(marks[known[f.id]]){const mark=document.createElement('i');mark.textContent=marks[known[f.id]];b.append(mark);}
        b.addEventListener('click',()=>offer(f,b));tray.append(b);
      });
      foodPanel.hidden=false;
      buttons.filter(b=>b.dataset.guardianAction==='feed').forEach(b=>b.setAttribute('aria-expanded','true'));
      (tray.querySelector('button')||foodPanel.querySelector('[data-guardian-close]')).focus({preventScroll:true});
      if(matchMedia('(max-width:760px)').matches)foodPanel.scrollIntoView({block:'nearest',behavior:'instant'});
    }
    function consume(f) {
      // Read at the moment of offering; never spend a stale tray count. Keep
      // trap timers, catch records and field journal entries in the same save.
      const [k,field]=BAGS[f.from],state=store.get(k,{})||{},bag=field?(state[field]||{}):state;
      const count=Number(bag[f.id]);
      if(!Number.isSafeInteger(count)||count<1){announce('That last one is already gone. Choose another snack.');openFood(opener);return false;}
      if(count===1)delete bag[f.id];else bag[f.id]=count-1;
      if(field)state[field]=bag;
      if(!store.set(k,state)){announce('This snack could not be saved. Please try again.');return false;}
      // The pages hold their own live bags. Sync them before their next catch
      // or harvest can persist an outdated count over this transaction.
      onInventory?.();return true;
    }
    function learn(id,kind) {
      const known=store.get('farm-diet',{})||{};known[species]=known[species]||{};known[species][id]=kind;store.set('farm-diet',known);
    }
    function emote(text) {emotes.push({text,start:performance.now()});}
    function clearReaction() {
      if(reactionTimer!=null){clearTimeout(reactionTimer);timers.delete(reactionTimer);reactionTimer=null;}
      actor.reaction=null;el.className='';
    }
    function react(kind,duration=2600,onFinish) {
      clearReaction();
      el.classList.add('react','react-'+kind);
      if(HOPS.has(kind)&&jumpReady)el.classList.add('jump-ready');
      actor.reaction={kind,start:performance.now(),duration};
      reactionTimer=later(()=>{clearReaction();onFinish?.();},duration);
    }
    function flyFood(button,f) {
      if(Wild.reduce)return 0;
      const start=button.getBoundingClientRect(),s=stage.getBoundingClientRect(),b=box();
      const node=icon(f),x=start.x+start.width/2,y=start.y+start.height/2;
      Object.assign(node.style,{position:'fixed',left:x-16+'px',top:y-16+'px',width:'32px',height:'32px',pointerEvents:'none',zIndex:'90'});
      const img=node.querySelector('img,svg');if(img){img.style.width='100%';img.style.height='100%';}
      document.body.append(node);
      const dx=s.x+b.cx-x,dy=s.y+b.y+b.h*.56-y;
      const animation=node.animate([{transform:'translate(0,0)'},{transform:`translate(${dx*.5}px,${dy*.5-40}px) scale(1.1)`,offset:.5},{transform:`translate(${dx}px,${dy}px) scale(.4)`,opacity:.3}],{duration:620,easing:'cubic-bezier(.4,0,.3,1)',fill:'forwards'});
      flight={node,animation};later(()=>{node.remove();if(flight?.node===node)flight=null;},700);
      return 620;
    }
    function offer(f,button) {
      if(feeding)return;
      snacks=snacks.filter(t=>Date.now()-t<4*60*1000);
      if(snacks.length>=3){close(true);react('nap',5000);emote('z z');announce(`${name} is full — time for a little nap.`);return;}
      if(f.id==='pinecone'){
        if(!consume(f))return;
        learn(f.id,'play');close(true);react(species==='crocodile'?'swish':'pounce',2400);
        emote('♪');announce(`${name} isn’t hungry for a pine cone — but what a toy!`);return;
      }
      const [love,like]=DIET[species]||[[],[]];
      const kind=love.includes(f.id)?'love':like.includes(f.id)?'like':'meh';
      if(kind==='meh'){
        learn(f.id,kind);close(true);react('shake',1600);emote('…');
        announce(`${name} sniffs the ${f.name.toLowerCase()}… and politely declines. Your snack stays in the basket.`);return;
      }
      if(!consume(f))return;
      learn(f.id,kind);snacks.push(Date.now());
      const delivery=flyFood(button,f);close();lock(true);clearReaction();
      const actions=document.getElementById('guardianActions');actions.tabIndex=-1;actions.focus({preventScroll:true});
      announce(`${name} comes closer for the ${f.name.toLowerCase()}…`);
      const hearts=store.get('farm-hearts',{})||{};hearts[key]=(hearts[key]||0)+(kind==='love'?3:1);store.set('farm-hearts',hearts);
      later(()=>{
        treat=new Image();
        const source=icon(f).querySelector('img,svg');
        if(source?.tagName.toLowerCase()==='img')treat.src=source.src;
        else if(source){
          const svg=source.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
          svg.insertAdjacentHTML('afterbegin',document.getElementById('fr-apple').closest('defs').outerHTML);
          treat.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
        }
        announce(`${name} lowers their head and munches the ${f.name.toLowerCase()}…`);
        react('munch',2200,()=>{
          treat=null;
          const choices=HAPPY[species]||['wave'],act=choices[snackCount++%choices.length];
          announce(`${name} ${kind==='love'?'loves':'enjoys'} ${f.name.toLowerCase()} — and ${TEXT[act]||'looks very happy'}.`);
          emote(kind==='love'?'♥':'♪');react(act,kind==='love'?2400:2000,()=>lock(false));
        });
      },delivery);
    }
    function pet() {
      if(feeding){announce(`Let ${name} finish that bite first…`);return;}
      close(true);
      const choices=PET[species]||['pet-nuzzle','wave'],kind=choices[petCount++%choices.length];
      react(kind);announce(`${name} ${TEXT[kind]||'looks very happy'}.`);emote(species==='snowcat'?'purr…':'♥');
    }
    function draw(ctx,b,{flip=1,filter='none',shadow=false}={}) {
      if(!image.complete||!image.naturalWidth)return;
      const now=performance.now(),r=actor.reaction,p=r?clamp((now-r.start)/r.duration,0,1):0;
      const reduced=Wild.reduce,quiet=calm(),hopping=r&&HOPS.has(r.kind);
      if(r)AnimalReactions.draw(actor,now,quiet);
      let lift=0,rotation=0,sx=1,sy=reduced?1:1+Math.sin(now/625)*.012;
      if(r&&!reduced){
        if(hopping){
          // Crouch, airborne body, then softly settled paws. These follow the
          // same eight jump postures and frame interpolation as FarmMotion.
          const air=clamp((p-.2)/.62,0,1);lift=Math.sin(air*Math.PI)*b.h*.2;
          sx+=Math.sin(p*Math.PI*2)*.018;sy-=Math.max(0,Math.sin(p*Math.PI*2))*.035;
          rotation=-Math.sin(air*Math.PI)*.035;
        } else if(r.kind==='shake')rotation=Math.sin(p*Math.PI*8)*.055*Math.sin(p*Math.PI);
        else if(r.kind==='swish')rotation=Math.sin(p*Math.PI*6)*.045*Math.sin(p*Math.PI);
        else if(r.kind==='nap')sy=1-Math.sin(p*Math.PI)*.05;
        else if(!el.classList.contains('reaction-ready')){
          // Newer farm species have no affection sheet yet; retain the farm's
          // gentle body animation rather than silently reverting to a still.
          const envelope=Math.sin(p*Math.PI);
          if(r.kind==='munch'){
            rotation=Math.sin(p*Math.PI*8)*.035*envelope;
            lift=Math.sin(p*Math.PI*8)*b.h*.012*envelope;
          } else if(r.kind==='pet-stretch'||r.kind==='knead'){
            sx+=envelope*.045;sy-=envelope*.045;
          } else {
            rotation=Math.sin(p*Math.PI*4)*.035*envelope;
            lift=Math.sin(p*Math.PI)*b.h*.015;
          }
        }
      }
      if(shadow){
        ctx.save();ctx.globalAlpha=1-lift/b.h*2;ctx.fillStyle='rgba(10,14,10,.35)';
        ctx.beginPath();ctx.ellipse(b.cx,b.y+b.h*.95,b.w*.34,b.h*.05,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      ctx.save();ctx.translate(b.cx,b.y+b.h-lift);ctx.scale(flip*sx,sy);ctx.rotate(rotation);ctx.filter=filter;
      if(r&&hopping&&el.classList.contains('jump-ready')){
        const phase=FarmMotion.leap(reduced?Math.floor(p*3)/3:p);
        jg.clearRect(0,0,384,384);jg.save();jg.globalCompositeOperation='lighter';
        [[phase.frame,1-phase.blend],[phase.next,phase.blend]].forEach(([frame,alpha])=>{jg.globalAlpha=alpha;jg.drawImage(jump,frame*384,0,384,384,0,0,384,384);});jg.restore();
        const scale=FarmMotion.GAITS[species].scale;
        ctx.drawImage(jumpArt,-b.w*scale/2,b.h*(-1+.9375*(1-scale)+.0025),b.w*scale,b.h*scale);
      } else if(r&&el.classList.contains('reaction-ready'))ctx.drawImage(art,-b.w/2,-b.h,b.w,b.h);
      else ctx.drawImage(image,-b.w/2,-b.h,b.w,b.h);
      if(r?.kind==='munch'&&treat?.complete&&treat.naturalWidth){
        const bite=1-clamp((p-.3)/.6,0,1)*.9;
        ctx.save();ctx.globalAlpha=clamp(p/.12,0,1)*clamp((1-p)/.15,0,1);
        ctx.drawImage(treat,b.w*.13,-b.h*.32,b.w*.19*bite,b.h*.19*bite);ctx.restore();
      }
      ctx.restore();
      emotes=emotes.filter(e=>now-e.start<1700);
      emotes.forEach(e=>{const q=(now-e.start)/1700;ctx.save();ctx.globalAlpha=Math.sin(Math.PI*q);ctx.fillStyle='#edc9cc';ctx.textAlign='center';ctx.font=`${Math.max(12,b.h*.15)}px Georgia`;ctx.fillText(e.text,b.cx,b.y+b.h*.1-q*b.h*.28);ctx.restore();});
    }
    buttons.forEach(b=>b.addEventListener('click',()=>b.dataset.guardianAction==='feed'?openFood(b):pet()));
    foodPanel.querySelector('[data-guardian-close]').addEventListener('click',()=>close(true));
    document.addEventListener('pointerdown',e=>{if(!e.target.closest('#guardianMenu,#guardianFood,#guardianActions'))close();});
    addEventListener('keydown',e=>{if(e.key==='Escape'&&(!menu.hidden||!foodPanel.hidden)){e.preventDefault();close(true);}});
    addEventListener('resize',()=>{if(!menu.hidden)close();});
    addEventListener('storage',e=>{if(Object.values(BAGS).some(([k])=>k===e.key)){onInventory?.();if(!foodPanel.hidden)openFood(opener);}});
    function reset() {
      timers.forEach(clearTimeout);timers.clear();clearReaction();lock(false);close();
      flight?.animation.cancel();flight?.node.remove();flight=null;treat=null;emotes=[];
    }
    addEventListener('pagehide',()=>{alive=false;reset();});
    addEventListener('pageshow',e=>{if(e.persisted){alive=true;reset();onInventory?.();announce('A quiet companion. Tap to offer a snack or a gentle pat.');}});
    return {draw,open,get isOpen(){return !menu.hidden||!foodPanel.hidden;}};
  }
  window.WildCompanion={create};
})();
