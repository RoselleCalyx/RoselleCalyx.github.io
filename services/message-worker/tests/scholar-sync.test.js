import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {mergeScholar,parseProfile,parseArticle,syncScholar,SCHOLAR_URL} from '../src/scholar-sync.js';
const article=`<div id="gsc_oci_title"><a href="https://example.org/10.1234/test">A &amp; B</a></div><div class="gsc_oci_field">Authors</div><div class="gsc_oci_value">Chen Jia*, Other Author</div></div><div class="gsc_oci_field">Publication date</div><div class="gsc_oci_value">2026/7/7</div></div><div class="gsc_oci_field">Conference</div><div class="gsc_oci_value">A Conference</div></div><div class="gsc_oci_field">Pages</div><div class="gsc_oci_value">10–20</div></div>`;
const profile='<tr class="gsc_a_tr"><td><a href="/citations?citation_for_view=yamQhewAAAAJ:abc&amp;oe=ASCII">A &amp; B</a></td></tr>';
const source=()=>parseArticle(article,'yamQhewAAAAJ:abc');
test('Scholar parser reads full authors and citation fields without inventing metadata',()=>{
 assert.equal(parseProfile(profile)[0].id,'yamQhewAAAAJ:abc');assert(!parseProfile(profile)[0].url.includes('ASCII'));
 const p=source();assert.equal(p.title,'A & B');assert.deepEqual(p.authors,['Chen Jia*','Other Author']);assert.match(p.bibtex,/author = \{Chen Jia and Other Author\}/);assert.match(p.bibtex,/doi = \{10.1234\/test\}/);assert.match(p.bibtex,/pages = \{10--20\}/);
 assert.throws(()=>parseProfile('<h1>blocked</h1>'));assert.throws(()=>parseArticle('', 'yamQhewAAAAJ:x'));
});
test('sync adds once, updates unchanged source fields and preserves host edits, images, visibility and removals',()=>{
 const p=source(),first=mergeScholar({},[p]);assert.equal(first.content.site.links.scholar,SCHOLAR_URL);
 first.content.papers[0].abstract='Host abstract';first.content.papers[0].image='assets/custom.png';first.content.papers[0].published=false;first.content.papers[0].figures=[{src:'assets/figure.png',caption:'Host figure'}];
 const updated={...p,venue:'Updated venue',abstract:'Source abstract'};const second=mergeScholar(first.content,[updated],first.baseline);
 assert.equal(second.content.papers.length,1);assert.equal(second.content.papers[0].venue,'Updated venue');assert.equal(second.content.papers[0].abstract,'Host abstract');assert.equal(second.content.papers[0].image,'assets/custom.png');assert.equal(second.content.papers[0].published,false);assert.equal(second.content.papers[0].figures[0].caption,'Host figure');
 assert.equal(mergeScholar({papers:[]},[updated],second.baseline).content.papers.length,0);
});
function db(){const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE site_content(id INTEGER PRIMARY KEY,revision INTEGER,updated_at TEXT,content_json TEXT);INSERT INTO site_content VALUES(1,0,NULL,\'{}\');');sqlite.exec(readFileSync(new URL('../migrations/0008_scholar_sync.sql',import.meta.url),'utf8'));return {sqlite,prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async run(){return sqlite.prepare(sql).run(...args)}}}}}
test('scheduled import publishes to the editable content store, throttles and keeps content on remote failure',async()=>{
 const DB=db();let calls=0;const fetcher=async url=>{calls++;return new Response(url.includes('view_citation')?article:profile)};
 // Profile parser URLs include only the citation identifier; the source still resolves article HTML.
 const fetchArticle=async url=>{calls++;return new Response(url.includes('citation_for_view')?article:profile)};
 assert.equal((await syncScholar({DB},{fetcher:fetchArticle})).papers,1);
 const saved=DB.sqlite.prepare('SELECT * FROM site_content').get();assert.equal(saved.revision,1);assert.equal(JSON.parse(saved.content_json).papers[0].title,'A & B');
 const n=calls;assert((await syncScholar({DB},{fetcher})).skipped);assert.equal(calls,n);
 const failure=await syncScholar({DB},{force:true,fetcher:async()=>new Response('blocked',{status:403})});assert.equal(failure.ok,false);assert.deepEqual(DB.sqlite.prepare('SELECT * FROM site_content').get(),saved);assert.match(DB.sqlite.prepare('SELECT last_error FROM scholar_sync').get().last_error,/403/);
});
test('custom host IDs and edited titles stay linked to their Scholar source',()=>{
 const p=source();const first=mergeScholar({papers:[{...p,id:'host-paper'}]},[p]);first.content.papers[0].title='Host title';
 const next=mergeScholar(first.content,[{...p,venue:'New venue'}],first.baseline);
 assert.equal(next.content.papers.length,1);assert.equal(next.content.papers[0].title,'Host title');assert.equal(next.content.papers[0].venue,'New venue');assert.equal(next.content.papers[0].id,'host-paper');
});
