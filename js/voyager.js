(function () {
  'use strict';
  const stops=window.VOYAGER_STOPS,$=id=>document.getElementById(id),esc=Site.esc;
  const scene=VoyagerScene.create($('voyagerCosmos'),$('voyagerFigure'));
  const saved=Site.store.get('lonely-voyager-v1',{});
  const savedState=saved&&typeof saved==='object'?saved:{};
  const visited=new Set(Array.isArray(savedState.visited)?savedState.visited.filter(id=>stops.some(s=>s.id===id)):[]);
  const stopFromHash=()=>stops.findIndex(s=>`#${s.id}`===location.hash);
  let index=stopFromHash(),playing=false,elapsed=0,lastTick=0,timer=0;
  let motionPaused=scene.reduced||Site.store.get('voyager-motion-paused',false)===true;
  if(index<0)index=Math.max(0,stops.findIndex(s=>s.id===savedState.current));
  const chapters=['Leaving home','The Saturn years','The last journey','Still looking'];
  const date=s=>s.date?s.date.replaceAll('-','.'): 'BEYOND TIME';
  const shortPlace=s=>s.scene.label;
  const num=i=>String(i+1).padStart(2,'0');

  $('vTimeline').innerHTML=stops.map((s,i)=>`<button type="button" class="v-stop" data-stop="${esc(s.id)}" aria-label="${num(i)}, ${esc(date(s))}, ${esc(s.place)}"><i aria-hidden="true"></i><time${s.date?` datetime="${esc(s.date)}"`:''}>${s.date?esc(s.date.slice(0,4)):'∞'}</time><span>${esc(shortPlace(s))}</span></button>`).join('');
  $('vAtlas').insertAdjacentHTML('beforeend',stops.map((s,i)=>`<button type="button" class="v-map-node" data-stop="${esc(s.id)}" style="left:${s.map[0]}%;top:${s.map[1]}%" aria-label="${num(i)}, ${esc(s.place)}, ${esc(date(s))}"><span>${num(i)} ${esc(shortPlace(s))}</span></button>`).join(''));
  $('vChapters').innerHTML=chapters.map((name,c)=>`<div class="v-chapter"><p><small>0${c+1}</small>${name}</p>${stops.map((s,i)=>s.chapter===c?`<button type="button" data-stop="${s.id}"><span>${num(i)}</span>${esc(s.place)}</button>`:'').join('')}</div>`).join('');
  const route=nodes=>nodes.map((s,i)=>`${i?'L':'M'}${s.map[0]*10} ${s.map[1]*4}`).join(' ');
  $('vMapPath').setAttribute('d',route(stops));

  function save(){Site.store.set('lonely-voyager-v1',{current:stops[index].id,visited:[...visited]});}
  function select(next,{history='push',announce=true}={}) {
    index=Math.max(0,Math.min(stops.length-1,next));elapsed=0;
    const s=stops[index];visited.add(s.id);save();
    if(history==='push'&&location.hash!==`#${s.id}`)window.history.pushState(null,'',`#${s.id}`);
    else if(history==='replace')window.history.replaceState(null,'',`#${s.id}`);
    document.body.style.setProperty('--v-accent',s.color);
    $('voyager').dataset.stop=s.id;
    $('vNumber').textContent=num(index);$('vPlaceEn').textContent=s.en;
    $('vTitle').replaceChildren(document.createTextNode(s.title[0]),document.createElement('br'));
    const em=document.createElement('em');em.textContent=s.title[1];$('vTitle').append(em);
    $('vPoem').textContent=s.poem;$('vPlace').textContent=s.place;$('vSceneLabel').textContent=s.scene.target.toUpperCase();$('vVantage').textContent=s.scene.vantage;
    $('vDate').textContent=date(s);
    if(s.date)$('vDate').dateTime=s.date;else $('vDate').removeAttribute('datetime');
    $('vCoordinates').textContent=s.body==='nebula'?'BEYOND THE KNOWN':`${s.chapter===0?'SOL':'SATURN'} SYSTEM · ${s.date.slice(0,4)}`;
    $('vProgress').textContent=`${num(index)} / ${stops.length} stops · ${visited.size} visited`;
    $('vPrev').disabled=index===0;$('vNext').disabled=index===stops.length-1;
    $('vNext').setAttribute('aria-label',index<stops.length-1?`Next: ${stops[index+1].place}`:'You have reached the epilogue');
    $('vPlayLabel').textContent=playing?'Pause journey':index===stops.length-1?'Begin again':'Drift onward';
    document.querySelectorAll('[data-stop]').forEach(b=>{
      b.classList.toggle('visited',visited.has(b.dataset.stop));
      if(b.dataset.stop===s.id)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    });
    const active=$('vTimeline').querySelector('[aria-current]');
    // Scroll only the horizontal rail, never the whole document on small screens.
    $('vTimeline').scrollTo({left:active.offsetLeft-$('vTimeline').clientWidth*.44,behavior:scene.reduced?'instant':'smooth'});
    $('vMapTravelled').setAttribute('d',route(stops.slice(0,index+1)));
    $('voyagerScene').setAttribute('aria-label',`${s.scene.description} ${s.poem.replace('\n',' ')}`);
    $('vArtNote').textContent=`Imagined viewpoint: ${s.scene.vantage}. ${s.scene.pose} Mission dates are in UTC; the traveller, terrain, scale and viewpoints are composed for the story.`;
    $('vJournalDate').textContent=`${num(index)} / ${date(s)}${s.date?' UTC':''}`;
    $('vJournalTitle').textContent=s.place;$('vJournalPoem').textContent=s.poem;$('vFact').textContent=s.fact;
    $('vSource').href=s.source||(index<7?'https://science.nasa.gov/mission/cassini/quick-facts/':'https://science.nasa.gov/mission/cassini/the-journey/timeline/');
    $('vSource').hidden=s.body==='nebula';
    if(announce)$('vAnnouncement').textContent=`Stop ${index+1} of ${stops.length}. ${date(s)}, ${s.place}.`;
    scene.setStop(s);
    if(index===stops.length-1&&playing)setPlaying(false);
  }
  function setPlaying(value) {
    playing=value;elapsed=0;lastTick=performance.now();clearInterval(timer);timer=0;
    if(value) {
      if(index===stops.length-1)select(0);
      timer=setInterval(()=>{
        const now=performance.now();elapsed+=Math.min(now-lastTick,1000);lastTick=now;
        if(elapsed>=14000)select(index+1,{history:'replace'});
      },200);
    }
    $('vPlay').setAttribute('aria-pressed',String(playing));
    $('vPlayLabel').textContent=playing?'Pause journey':index===stops.length-1?'Begin again':'Drift onward';
    $('vPlayIcon').textContent=playing?'Ⅱ':'▷';
  }
  function manualSelect(i){setPlaying(false);select(i);}
  function openDialog(id){
    setPlaying(false);$(id).showModal();
    if(id==='vPanorama'){
      const s=stops[index];$('vPanoramaTitle').textContent=s.place;
      $('vPanoramaImage').src=s.scene.art;$('vPanoramaImage').alt=s.scene.description;
      $('vPanoramaCaption').textContent=`${s.scene.target} · ${s.scene.vantage}. ${s.poem.split('\n')[0]}`;
    }
    if(id==='vMap'){
      const rail=$('vMap').querySelector('.v-map-scroll');
      rail.scrollLeft=stops[index].map[0]/100*$('vAtlas').clientWidth-rail.clientWidth/2;
    }
  }
  document.querySelectorAll('[data-stop]').forEach(b=>b.addEventListener('click',()=>{
    const inMap=$('vMap').contains(b);
    manualSelect(stops.findIndex(s=>s.id===b.dataset.stop));
    if(inMap)$('vMap').close();
  }));
  $('vPrev').addEventListener('click',()=>manualSelect(index-1));
  $('vNext').addEventListener('click',()=>manualSelect(index+1));
  $('vPlay').addEventListener('click',()=>setPlaying(!playing));
  $('vRestart').addEventListener('click',()=>manualSelect(0));
  $('vTimelineView').addEventListener('click',()=>{$('vTimeline').querySelector('[aria-current]').focus({preventScroll:true});});
  $('vMapOpen').addEventListener('click',()=>openDialog('vMap'));
  $('vPanoramaOpen').addEventListener('click',()=>openDialog('vPanorama'));
  $('vJournalOpen').addEventListener('click',()=>openDialog('vJournal'));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  for(const id of ['vMap','vJournal','vPanorama']) {
    $(id).addEventListener('click',e=>{if(e.target!==$(id))return;const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();});
  }
  function setImmersive(on) {
    document.body.classList.toggle('v-immersive',on);
    $('vImmersive').setAttribute('aria-pressed',String(on));
    $('vImmersive').setAttribute('aria-label',on?'Show the journey interface':'Hide the interface and take in the view');
    $('vImmersive').innerHTML=on?'Return to journey <span aria-hidden="true">⤡</span>':'Just look up <span aria-hidden="true">⤢</span>';
  }
  $('vImmersive').addEventListener('click',()=>setImmersive(!document.body.classList.contains('v-immersive')));
  function updateMotion(){
    scene.setPaused(motionPaused);
    $('vMotion').setAttribute('aria-pressed',String(motionPaused||scene.reduced));
    $('vMotion').textContent=scene.reduced?'Reduced motion':motionPaused?'Resume motion':'Pause motion';
    $('vMotion').disabled=scene.reduced;
  }
  $('vMotion').addEventListener('click',()=>{motionPaused=!motionPaused;Site.store.set('voyager-motion-paused',motionPaused);updateMotion();});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{setPlaying(false);updateMotion();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
  window.addEventListener('popstate',()=>{const i=stopFromHash();setPlaying(false);select(i<0?0:i,{history:'none'});});
  window.addEventListener('hashchange',()=>{const i=stopFromHash();if(i>=0&&i!==index){setPlaying(false);select(i,{history:'none'});}});
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.repeat||document.querySelector('dialog[open]'))return;
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
    if(e.key==='Escape'){setImmersive(false);return;}
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();manualSelect(index+(e.key==='ArrowRight'?1:-1));}
    if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();setPlaying(!playing);}
  });
  updateMotion();select(index,{history:'replace',announce:false});
})();
