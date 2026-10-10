const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
function fixture() {
 const data = new Map(), storage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context={window:{},localStorage:storage};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/farm-kitchen.js'),'utf8'),context);
 return {k:context.window.FarmKitchen,storage,data};
}
test('fixed menu covers every edible ingredient and excludes toys, poison and junk',()=>{
 const {k}=fixture();const covered=new Set(k.recipes.flatMap(r=>r.parts.flatMap(([g])=>k.groups[g])));
 for(const id of ['apple','peach','orange','cherry','kiwi','grape','durian','mango','bayberry','strawberry','rosehip','shoot','morel','chanterelle','porcini','shiitake','matsutake','crucian','carp','koi','goldkoi','catfish','mandarin','bitterling','minnow','loach','eel','shrimp','crayfish','crab','lotus'])assert(covered.has(id),id);
 for(const id of ['pinecone','amanita','boot','bottle'])assert(!covered.has(id));
 assert(k.recipes.every(r=>r.parts.reduce((n,[,count])=>n+count,0)>=36));
});
test('cooking consumes mixed ingredients, preserves journals, saves one meal and prevents repeated overspending',()=>{
 const {k,storage}=fixture();storage.setItem('farm-basket',JSON.stringify({apple:12,mango:12}));storage.setItem('wild-woods',JSON.stringify({basket:{strawberry:12},seen:{strawberry:50}}));
 const result=k.cook('fruit-feast');assert.equal(Object.values(result.used).reduce((a,b)=>a+b),36);
 assert.equal(k.read().meals['fruit-feast'],1);assert.equal(k.read().stock.apple,undefined);assert.equal(k.read().values['wild-woods'].seen.strawberry,50);
 assert.throws(()=>k.cook('fruit-feast'));assert.equal(k.read().meals['fruit-feast'],1);
});
test('interrupted saving rolls all baskets and prepared meals back',()=>{
 const {k,storage,data}=fixture();storage.setItem('farm-basket',JSON.stringify({apple:24}));storage.setItem('wild-woods',JSON.stringify({basket:{strawberry:12}}));
 const before=new Map(data),set=storage.setItem;let once=true;storage.setItem=(key,value)=>{if(key==='wild-pond'&&once){once=false;throw Error('disk full');}set(key,value);};
 assert.throws(()=>k.cook('fruit-feast'),/ingredients were kept/);assert.deepEqual(data,before);
});
test('plant and fish dishes respect existing animal diets',()=>{
 const {k}=fixture(),plants=k.recipes[0],sea=k.recipes[3];
 assert(k.accepts('rabbit',plants));assert(!k.accepts('rabbit',sea));assert(k.accepts('wolf',sea));assert(!k.accepts('wolf',plants));assert(k.accepts('raccoon',plants)&&k.accepts('raccoon',sea));
});
