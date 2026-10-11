import {writeFile} from 'node:fs/promises';
import {parseProfile,parseArticle,SCHOLAR_URL} from '../services/message-worker/src/scholar-sync.js';
async function html(url){
 const response=await fetch(url,{headers:{'Accept-Language':'en',Accept:'text/html'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Google Scholar returned '+response.status);
 const bytes=await response.arrayBuffer();if(bytes.byteLength>2*1024*1024)throw Error('Response too large');
 const charset=new TextDecoder().decode(bytes.slice(0,1000)).match(/charset=([\w-]+)/i)?.[1]||'utf-8';return new TextDecoder(charset).decode(bytes);
}
const entries=[];
for(let start=0;start<500;start+=100){const url=new URL(SCHOLAR_URL);url.searchParams.set('pagesize','100');url.searchParams.set('cstart',String(start));const page=parseProfile(await html(url));entries.push(...page);if(page.length<100)break;if(start===400)throw Error('Profile exceeds 500 papers');}
const papers=[];for(const entry of entries)papers.push(parseArticle(await html(entry.url),entry.id));
await writeFile(new URL('../data/scholar.json',import.meta.url),JSON.stringify({profile:SCHOLAR_URL,retrievedAt:new Date().toISOString(),papers},null,2)+'\n');
console.log('Synchronized '+papers.length+' Scholar publications.');
