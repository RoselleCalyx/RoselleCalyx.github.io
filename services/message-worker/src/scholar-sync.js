import { validateSiteContent } from './site-content.js';
export const SCHOLAR_URL = 'https://scholar.google.com/citations?hl=en&user=yamQhewAAAAJ';
const PROFILE = 'yamQhewAAAAJ';
const text = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|hellip);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…'})[n]).replace(/\s+/g,' ').trim();
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
const escapeBib = s => String(s).replace(/[{}\\]/g,'').replace(/&/g,'\\&').replace(/[%#_]/g,c=>'\\'+c).replace(/[–—]/g,'--');
export function parseProfile(html) {
  const result=[];
  for (const row of html.matchAll(/<tr\b[^>]*class="gsc_a_tr"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const href=row[1].match(/href="([^"]*citation_for_view=[^"]+)"/);
    if (!href) continue;
    const url=new URL(text(href[1]),'https://scholar.google.com');
    const id=url.searchParams.get('citation_for_view');
    if (url.origin==='https://scholar.google.com' && id?.startsWith(PROFILE+':')) { url.searchParams.delete('oe');result.push({id,url:url.href}); }
  }
  if (!result.length) throw Error('Scholar returned no readable publications; existing papers were kept.');
  return result;
}
export function parseArticle(html, scholarId) {
  const titleBlock=html.match(/<div id="gsc_oci_title">([\s\S]*?)<\/div>/)?.[1];
  const fields={};
  for (const match of html.matchAll(/<div class="gsc_oci_field">([^<]+)<\/div><div class="gsc_oci_value"[^>]*>([\s\S]*?)(?=<\/div><\/div>)/g)) fields[text(match[1])]=text(match[2]);
  const title=text(titleBlock || ''),authors=(fields.Authors || '').split(/,\s*/).filter(Boolean);
  const year=Number(fields['Publication date']?.match(/^\d{4}/)?.[0]);
  const venue=fields.Conference || fields.Journal || fields.Source || fields.Book || '';
  if (!title || !authors.length || !year || !venue || authors.some(a=>/…|\.\.\./.test(a))) throw Error('Incomplete Scholar article; existing information was kept.');
  const href=titleBlock?.match(/href="([^"]+)"/)?.[1];
  const project=href ? text(href) : '';
  const pdfMatch=html.match(/<div class="gsc_oci_title_ggi"><a href="([^"]+)"/);
  const pdf=pdfMatch ? text(pdfMatch[1]) : '';
  const preprint=/arxiv|preprint/i.test(venue),conference=!!fields.Conference || /findings|conference|proceedings/i.test(venue);
  const id='scholar-'+scholarId.split(':')[1],doi=project.match(/10\.\d{4,9}\/[^?#]+/)?.[0];
  const lines=[`  title = {${escapeBib(title)}}`,`  author = {${authors.map(a=>escapeBib(a.replace(/\*+$/,''))).join(' and ')}}`,`  year = {${year}}`];
  if (!preprint) lines.push(`  ${conference?'booktitle':'journal'} = {${escapeBib(venue)}}`);
  for(const [label,key] of [['Pages','pages'],['Volume','volume'],['Issue','number'],['Publisher','publisher']]) if(fields[label])lines.push(`  ${key} = {${escapeBib(label==='Pages'?fields[label].replace(/(?<=\d)-(?=\d)/g,'--'):fields[label])}}`);
  if(doi)lines.push(`  doi = {${doi}}`);
  const arxiv=venue.match(/arXiv:(\d{4}\.\d{4,5})/i)?.[1];
  if(arxiv)lines.push(`  eprint = {${arxiv}}`,`  archivePrefix = {arXiv}`);
  if(project)lines.push(`  url = {${project}}`);
  return {id,title,authors,venue,year,type:preprint?'preprint':'publication',topics:[],image:'',selected:false,published:true,abstract:fields.Description || '',links:{pdf,project,code:'',data:''},bibtex:`@${preprint?'misc':conference?'inproceedings':'article'}{${id},\n${lines.join(',\n')}\n}`,figures:[]};
}
const legacyTitles={
 'retrievalaugmentedchestxrayreportgenerationwithclinicallyguidedfusion':'semanticawarechestxrayreportgenerationwithdomainspecificlexiconanddiversitycontrolledretrieval',
 'legaldocumentsummarizationwithdomainawarelanguagemodeling':'relexedretrievalenhancedlegalsummarizationwithexemplardiversity'
};
const placeholder=p=>p.authors?.some(a=>/^(?:Co-author [A-Z]|First Author [A-Z]|Author [A-Z])$/.test(a));
export function mergeScholar(content, incoming, previous={}) {
  const next=structuredClone(content),baseline={...previous};next.papers ||= [];
  next.site ||= {};next.site.links ||= {};
  if(!next.site.links.scholar || next.site.links.scholar==='https://scholar.google.com/')next.site.links.scholar=SCHOLAR_URL;
  for(const source of incoming){
    const prior=previous[source.id];
    let paper=next.papers.find(p=>p.id===source.id || (prior?.managedId && p.id===prior.managedId) || norm(p.title)===norm(source.title) || (placeholder(p)&&legacyTitles[norm(p.title)]===norm(source.title)));
    if(!paper && prior)continue; // Host removal remains a removal; a draft hidden by the host stays hidden.
    if(!paper){paper=structuredClone(source);next.papers.push(paper);}
    else{
      const initialPlaceholder=!prior&&placeholder(paper);
      paper.id ||= source.id;
      for(const field of ['title','authors','venue','year','type','abstract','bibtex']){
        const empty=paper[field]===undefined || paper[field]==='' || (Array.isArray(paper[field])&&!paper[field].length);
        if(empty || initialPlaceholder || (prior&&JSON.stringify(paper[field])===JSON.stringify(prior[field])))paper[field]=structuredClone(source[field]);
      }
      paper.links ||= {};
      for(const field of ['pdf','project'])if(!paper.links[field] || (prior&&paper.links[field]===prior.links[field]))paper.links[field]=source.links[field];
    }
    // Artwork, figure captions, topics, selection and visibility always belong to the host.
    baseline[source.id]={...structuredClone(source),managedId:paper.id};
  }
  validateSiteContent(next);
  return {content:next,baseline};
}
async function getHTML(url, fetcher) {
  const response=await fetcher(url,{headers:{Accept:'text/html','Accept-Language':'en'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Scholar is temporarily unavailable ('+response.status+').');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>2*1024*1024)throw Error('Scholar response is too large.');
  const probe=new TextDecoder().decode(bytes.slice(0,1000)),charset=probe.match(/charset=([\w-]+)/i)?.[1] || 'utf-8';
  return new TextDecoder(charset).decode(bytes);
}
export async function fetchScholarPapers(fetcher=fetch) {
  const entries=[];
  for(let start=0;start<500;start+=100){
    const url=new URL(SCHOLAR_URL);url.searchParams.set('pagesize','100');url.searchParams.set('cstart',String(start));
    const page=parseProfile(await getHTML(url.href,fetcher));entries.push(...page);if(page.length<100)break;
    if(start===400)throw Error('Scholar profile exceeds the supported 500 papers.');
  }
  const papers=[];
  for(const entry of entries)papers.push(parseArticle(await getHTML(entry.url,fetcher),entry.id));
  return papers;
}
export async function syncScholar(env,{force=false,fetcher=fetch}={}) {
  const state=await env.DB.prepare('SELECT * FROM scholar_sync WHERE id=1').first(),now=Date.now();
  if(!force&&state.next_check>now)return {skipped:true};
  const lock=await env.DB.prepare('UPDATE scholar_sync SET next_check=? WHERE id=1 AND next_check=? RETURNING id').bind(now+6*3600000,state.next_check).first();
  if(!lock)return {skipped:true};
  try{
    let incoming;
    try {
      const entries=[];
      for(let start=0;start<500;start+=100){
        const url=new URL(SCHOLAR_URL);url.searchParams.set('pagesize','100');url.searchParams.set('cstart',String(start));
        const page=parseProfile(await getHTML(url.href,fetcher));entries.push(...page);if(page.length<100)break;
        if(start===400)throw Error('Scholar profile exceeds the supported 500 papers.');
      }
      incoming=[];
      for(const entry of entries)incoming.push(parseArticle(await getHTML(entry.url,fetcher),entry.id));
    } catch (directError) {
      // GitHub's independent daily reader provides the same source when Scholar refuses Worker IPs.
      const response=await fetcher('https://raw.githubusercontent.com/RoselleCalyx/RoselleCalyx.github.io/main/data/scholar.json',{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw directError;
      const snapshot=await response.json();
      const age=now-Date.parse(snapshot.retrievedAt);
      if(snapshot.profile!==SCHOLAR_URL || !Number.isFinite(age) || age< -300000 || age>3*86400000 || !Array.isArray(snapshot.papers) || !snapshot.papers.length)throw Error('Scholar is unavailable and the backup snapshot is stale; existing papers were kept.');
      validateSiteContent({papers:snapshot.papers});
      if(snapshot.papers.some(p=>!/^scholar-[A-Za-z0-9_-]+$/.test(p.id)))throw Error('Invalid Scholar backup identifiers.');
      incoming=snapshot.papers;
    }
    const row=await env.DB.prepare('SELECT revision,content_json FROM site_content WHERE id=1').first();
    const merged=mergeScholar(JSON.parse(row.content_json),incoming,JSON.parse(state.baseline_json));
    const contentJSON=JSON.stringify(merged.content),changed=contentJSON!==row.content_json;
    if(changed){
      const saved=await env.DB.prepare('UPDATE site_content SET revision=revision+1,updated_at=?,content_json=? WHERE id=1 AND revision=? RETURNING revision').bind(new Date(now).toISOString(),contentJSON,row.revision).first();
      if(!saved)throw Error('Host content changed during synchronization; retrying later.');
    }
    await env.DB.prepare('UPDATE scholar_sync SET baseline_json=?,last_success=?,next_check=?,last_error=? WHERE id=1').bind(JSON.stringify(merged.baseline),new Date(now).toISOString(),now+86400000,'').run();
    return {ok:true,changed,papers:incoming.length};
  }catch(error){
    await env.DB.prepare('UPDATE scholar_sync SET last_error=? WHERE id=1').bind(String(error.message).slice(0,500)).run();
    return {ok:false,message:String(error.message)};
  }
}
