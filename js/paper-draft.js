/* Pure draft merge: imported metadata never replaces host artwork, visibility or complete fields. */
(function(){
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const identifier=p=>{
  const raw=[p.links?.project,p.links?.pdf,p.bibtex].filter(Boolean).join(' ');
  const doi=raw.match(/10\.\d{4,9}\/[^\s{}?#]+/i)?.[0]?.replace(/\\/g,'');if(doi)return 'doi:'+doi.toLowerCase();
  const arxiv=raw.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?/i)?.[1];return arxiv?'arxiv:'+arxiv:'';
 };
 const missing=v=>v===undefined||v===null||v===''||Array.isArray(v)&&!v.length;
 function merge(existing,incoming){
  const papers=JSON.parse(JSON.stringify(existing||[])),rows=[];
  for(const source of incoming){
   const key=identifier(source),match=papers.find(p=>(source.id&&p.id===source.id)||norm(p.title)===norm(source.title)||(key&&identifier(p)===key));
   if(!match){papers.push(JSON.parse(JSON.stringify(source)));rows.push({paper:source,kind:'new'});continue;}
   let filled=0;for(const field of ['authors','venue','year','abstract','bibtex']){
    const placeholders=field==='authors'&&match.authors?.some(a=>/^(Co-author [A-Z]|First Author [A-Z]|Author [A-Z])$/.test(a));
    if((missing(match[field])||placeholders)&&!missing(source[field])){match[field]=JSON.parse(JSON.stringify(source[field]));filled++;}
   }
   match.links||={};for(const field of ['project','pdf','code','data'])if(!match.links[field]&&source.links?.[field]){match.links[field]=source.links[field];filled++;}
   rows.push({paper:source,kind:filled?'fill':'duplicate',filled});
  }
  return {papers,rows};
 }
 window.PaperDraft={merge};
})();
