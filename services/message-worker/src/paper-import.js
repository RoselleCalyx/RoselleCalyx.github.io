import {HTTPError} from './errors.js';
import {validateSiteContent} from './site-content.js';
const fail=message=>{throw new HTTPError(422,'paper_import',message)};
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\\["'`^~=.uvHckbdr]\s*\{?([A-Za-z])\}?/g,'$1').replace(/\\(?:textit|textbf|emph|mathrm|textrm)\s*/g,'').replace(/\\([&_#%])/g,'$1').replace(/[{}]/g,'').replace(/\s+/g,' ').trim();
const safeURL=s=>{try{const u=new URL(String(s).replace(/\\([_&%#])/g,'$1'));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}};
function splitAuthors(value){
 let depth=0,start=0,out=[];
 for(let i=0;i<value.length;i++){if(value[i]==='{')depth++;if(value[i]==='}')depth--;if(!depth&&/^\s+and\s+/i.test(value.slice(i))){const m=value.slice(i).match(/^\s+and\s+/i)[0];out.push(value.slice(start,i));i+=m.length-1;start=i+1;}}
 out.push(value.slice(start));return out.map(a=>{if(a.trim().startsWith('{'))return clean(a);const parts=a.split(',').map(clean);return parts.length>1?[parts.at(-1),...parts.slice(0,-1)].join(' '):clean(a)}).filter(Boolean);
}
export function parseBibtex(input){
 const papers=[];let cursor=0;
 while(cursor<input.length){const start=input.slice(cursor).match(/@([a-z]+)\s*([{(])/i);if(!start)break;let i=cursor+start.index+start[0].length,type=start[1].toLowerCase(),end=start[2]==='{'?'}':')';
 if(['string','preamble','comment'].includes(type))fail('Please paste complete paper entries with explicit field values, without BibTeX macros or comments.');
 const key=input.slice(i).match(/^\s*([^,\s]+)\s*,/);if(!key)fail('This BibTeX entry is missing its citation key.');i+=key[0].length;const fields={};
 while(i<input.length){while(/[\s,]/.test(input[i]||'\0'))i++;if(input[i]===end){i++;break}const name=input.slice(i).match(/^([\w-]+)\s*=\s*/);if(!name)fail('Invalid BibTeX field near '+input.slice(i,i+25));i+=name[0].length;let value='';
 if(input[i]==='{'){let depth=1;i++;while(i<input.length&&depth){const c=input[i++];if(c==='\\'&&i<input.length){value+=c+input[i++];continue}if(c==='{')depth++;if(c==='}')depth--;if(depth)value+=c}if(depth)fail('Unclosed BibTeX braces.');}
 else if(input[i]==='"'){i++;let closed=false;while(i<input.length){const c=input[i++];if(c==='\\'&&i<input.length){value+=c+input[i++];continue}if(c==='"'){closed=true;break}value+=c}if(!closed)fail('Unclosed BibTeX quoted value.');}
 else{const m=input.slice(i).match(/^(?:\d+|jan\b|feb\b|mar\b|apr\b|may\b|jun\b|jul\b|aug\b|sep\b|oct\b|nov\b|dec\b)/i);if(!m)fail('Use explicit BibTeX field values in braces or quotes; macros are not supported.');value=m[0];i+=m[0].length;}
 if(input.slice(i).match(/^\s*#/))fail('Expand concatenated BibTeX values before importing.');fields[name[1].toLowerCase()]=value;
 }
 if(input[i-1]!==end)fail('Unclosed BibTeX entry.');
 const title=clean(fields.title),authors=splitAuthors(fields.author||''),year=Number(clean(fields.year));
 if(!title||!authors.length||!Number.isInteger(year)||year<1800||year>2200)fail('Each paper needs a title, authors and a four-digit year.');
 const doi=clean(fields.doi),arxiv=clean(fields.eprint),project=safeURL(fields.url)||(doi?safeURL('https://doi.org/'+doi):arxiv?safeURL('https://arxiv.org/abs/'+arxiv):'');
 const paper={title,authors,year,venue:clean(fields.booktitle||fields.journal||fields.note||fields.publisher),type:/arxiv/i.test(fields.archiveprefix||fields.journal||'')||['misc','unpublished'].includes(type)?'preprint':'publication',topics:[],image:'',selected:false,published:true,abstract:clean(fields.abstract),links:{project,pdf:arxiv&&/^\d{4}\.\d{4,5}(v\d+)?$/.test(arxiv)?'https://arxiv.org/pdf/'+arxiv:'',code:'',data:''},bibtex:input.slice(cursor+start.index,i),figures:[]};
 validateSiteContent({papers:[paper]});papers.push(paper);if(papers.length>30)fail('Import at most 30 papers at a time.');cursor=i;
 }
 if(!papers.length)fail('No complete BibTeX paper entries were found.');return papers;
}
async function read(url,fetcher,accept='application/json'){
 const r=await fetcher(url,{headers:{Accept:accept},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)fail('The metadata source could not be read. Paste the paper’s BibTeX instead.');const bytes=await r.arrayBuffer();if(bytes.byteLength>1024*1024)fail('The metadata response is too large.');return new TextDecoder().decode(bytes);
}
const escape=s=>String(s||'').replace(/[{}\\]/g,'');
function bib(p,extra={}){const fields={title:p.title,author:p.authors.join(' and '),year:p.year,...(p.venue?{[p.type==='preprint'?'note':'journal']:p.venue}:{}),...extra};return '@'+(p.type==='preprint'?'misc':'article')+'{imported,\n'+Object.entries(fields).map(([k,v])=>'  '+k+' = {'+escape(v)+'}').join(',\n')+'\n}';}
export async function importPapers(input,fetcher=fetch){
 if(typeof input!=='string'||!input.trim()||input.length>100000)fail('Paste a paper URL, DOI or BibTeX (up to 100 KB).');input=input.trim();let papers,source;
 if(input.startsWith('@')){papers=parseBibtex(input);source='BibTeX';}
 else{
 let url;try{url=new URL(input)}catch{}if(url&&(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port))fail('Use a public paper URL without credentials or a custom port.');
 const doi=(url?decodeURIComponent(url.pathname):input.replace(/^doi:\s*/i,'')).match(/10\.\d{4,9}\/[^\s?#]+/i)?.[0];
 if(doi){
 const work=JSON.parse(await read('https://api.crossref.org/works/'+encodeURIComponent(doi),fetcher)).message;
 if(!work?.title?.[0]||!work.author?.length)fail('This DOI has incomplete metadata. Paste its BibTeX instead.');
 const year=(work.published||work['published-print']||work['published-online']||work.issued)?.['date-parts']?.[0]?.[0];
 const p={title:clean(work.title[0]),authors:work.author.map(a=>clean(a.name||[a.given,a.family].filter(Boolean).join(' '))),year,venue:clean(work['container-title']?.[0]||work.publisher),type:work.type==='posted-content'?'preprint':'publication',topics:[],image:'',selected:false,published:true,abstract:clean(work.abstract),links:{project:'https://doi.org/'+doi,pdf:'',code:'',data:''},figures:[]};
 try{p.bibtex=await read('https://api.crossref.org/works/'+encodeURIComponent(doi)+'/transform/application/x-bibtex',fetcher,'application/x-bibtex')}catch{p.bibtex=bib(p,{doi,...(work.page?{pages:work.page}:{}),...(work.volume?{volume:work.volume}:{})})}
 papers=[p];source='Crossref DOI metadata';
 }else if(url&&/^(?:www\.)?arxiv\.org$/.test(url.hostname)){
 const id=url.pathname.replace(/^\/(?:abs|pdf)\//,'').replace(/\.pdf$/,'');if(!/^(?:\d{4}\.\d{4,5}|[a-z.-]+\/\d{7})(?:v\d+)?$/i.test(id))fail('Use an arXiv abstract or PDF link.');
 const xml=await read('https://export.arxiv.org/api/query?id_list='+encodeURIComponent(id),fetcher,'application/atom+xml'),entry=xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1]||'',tag=n=>clean(entry.match(new RegExp('<'+n+'[^>]*>([\\s\\S]*?)<\\/'+n+'>'))?.[1]);
 if(!entry||tag('title')==='Error')fail('This arXiv paper was not found.');const p={title:tag('title'),authors:[...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map(m=>clean(m[1])),year:Number(tag('published').slice(0,4)),venue:'arXiv:'+id,type:'preprint',topics:[],image:'',selected:false,published:true,abstract:tag('summary'),links:{project:'https://arxiv.org/abs/'+id,pdf:'https://arxiv.org/pdf/'+id,code:'',data:''},figures:[]};p.bibtex=bib(p,{eprint:id,archivePrefix:'arXiv'});papers=[p];source='arXiv metadata';
 }else if(url&&url.hostname==='aclanthology.org'&&/^\/[a-zA-Z0-9.-]+\/?(?:\.pdf)?$/.test(url.pathname)){
 const id=url.pathname.replace(/^\//,'').replace(/\/$/,'').replace(/\.pdf$/,'');papers=parseBibtex(await read('https://aclanthology.org/'+id+'.bib',fetcher,'text/plain'));for(const p of papers){p.links.project||='https://aclanthology.org/'+id+'/';p.links.pdf='https://aclanthology.org/'+id+'.pdf';}source='ACL Anthology BibTeX';
 }else fail('This link does not contain a supported identifier. Paste a DOI, arXiv/ACL link, or the publisher’s BibTeX export.');
 }
 for(const p of papers){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.title.toLowerCase().replace(/[^a-z0-9]/g,'')));p.id='paper-'+Array.from(new Uint8Array(hash)).slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('');}
 validateSiteContent({papers});return {ok:true,papers,source};
}
