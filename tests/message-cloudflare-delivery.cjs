const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname,'../js/message-delivery.js'),'utf8');
function load(config, fetch) {
  const context = {window:{SITE:config}, URL, AbortController, setTimeout, clearTimeout, crypto:webcrypto, atob, fetch};
  vm.runInNewContext(source,context);
  return context.window.MessageDelivery;
}
function response(status, data) { return {ok:status>=200 && status<300,status,json:async()=>data}; }
const payload = {name:'',contact:'',text:'A quiet hello.',submissionId:'827b0f17-1aa5-4b73-9b75-91220a635c18'};
test('Cloudflare submits anonymously without frontend credentials, preserving the submission ID',async()=>{
  let call;
  const api=load({messageApi:'https://letters.example.workers.dev'},async(url,options)=>{call={url,options};return response(201,{ok:true,id:3});});
  assert.equal(api.mode,'cloudflare');
  const result=await api.submit(payload);assert.equal(result.ok,true);assert.equal(result.transport,'cloudflare');
  assert.equal(call.url,'https://letters.example.workers.dev/api/messages');
  const body=JSON.parse(call.options.body);assert.equal(body.submissionId,payload.submissionId);assert.equal(body.contact,null);
  assert.equal(call.options.headers.Authorization,undefined);assert.equal(call.options.headers.apikey,undefined);
});
test('failed cloud message never falls through to Supabase or a form endpoint',async()=>{
  const calls=[];const api=load({messageApi:'https://letters.example.workers.dev',formEndpoint:'https://form.example/send',supabase:{url:'https://db.example',anonKey:'sb_publishable_public'}},async(url)=>{calls.push(url);return response(503,null);});
  assert.equal((await api.submit(payload)).ok,false);assert.deepEqual(calls,['https://letters.example.workers.dev/api/messages']);
});
test('an HTTP 200 without a saved-message acknowledgement is never called success',async()=>{
  for(const data of [{ok:false},{ok:true},null]) {const api=load({messageApi:'https://letters.example.workers.dev'},async()=>response(200,data));assert.equal((await api.submit(payload)).ok,false);}
});
test('network interruption and invalid JSON preserve an unconfirmed result',async()=>{
  for(const fetch of [async()=>{throw Error('offline');},async()=>({ok:true,status:200,json:async()=>{throw Error('bad json');}})]) {
    const api=load({messageApi:'https://letters.example.workers.dev'},fetch);assert.equal((await api.submit(payload)).ok,false);
  }
});
test('configured invalid Worker URLs cannot silently select another transport',async()=>{
  for(const url of ['http://letters.example','https://u:p@letters.example','https://letters.example?secret=yes']) {
    let called=false;const api=load({messageApi:url,formEndpoint:'https://form.example/send'},async()=>{called=true;});
    assert.equal(api.enabled,false);assert.equal((await api.submit(payload)).ok,false);assert.equal(called,false);
  }
});
test('challenge tokens and honeypot are forwarded for server verification',async()=>{
  let body;const api=load({messageApi:'https://letters.example.workers.dev'},async(_,options)=>{body=JSON.parse(options.body);return response(201,{ok:true,id:1});});
  await api.submit({...payload,turnstileToken:'test-token',website:'bot-field'});assert.equal(body.turnstileToken,'test-token');assert.equal(body.website,'bot-field');
});
test('rate limit is a failed result and never clears the letter as accepted',async()=>{
  const api=load({messageApi:'https://letters.example.workers.dev'},async()=>response(429,{error:'rate_limit'}));
  const result=await api.submit(payload);assert.equal(result.ok,false);assert.match(result.message,/too many/);
});
