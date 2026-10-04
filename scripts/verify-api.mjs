import assert from 'node:assert/strict';
import {generateRecipe} from '../lib/food.ts';
const origin='http://127.0.0.1:5173';
const auth=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=auth.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
assert.ok(cookie);const headers={Cookie:cookie,'Content-Type':'application/json',Origin:origin};
async function call(method,body,path='/api/data?site=qa-site'){const r=await fetch(origin+path,{method,headers,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
assert.equal((await fetch(origin+'/api/context')).status,401);
const context=await call('GET',undefined,'/api/context');assert.equal(context.status,200);assert.equal(context.data.user.role,'admin');
assert.equal((await call('GET',undefined,'/api/data')).status,400);
const locations=[{id:'qa-area',kind:'area',parent_id:null},{id:'qa-project',kind:'project',parent_id:'qa-area'},{id:'qa-site',kind:'site',parent_id:'qa-project'},{id:'qa-store',kind:'store',parent_id:'qa-site'}].map(l=>({...l,code:l.id.toUpperCase(),name:l.id+' (local verification)',active:true}));
const inventory={id:'inv:QA-ONLY',item_code:'QA-ONLY',name:'QA ingredient',unit:'kg',cost:24,category:'Test',allergens:[]};
const r=generateRecipe(0,10,[]);r.id='qa-recipe';r.recipe_code='QA-RECIPE';r.name='QA only';r.ingredients[0].item_code='QA-ONLY';
const m={id:'qa-menu',code:'QA-MENU',name:'QA only',target:30,store_id:'qa-store',items:[{recipe_id:r.id,price:30,portions:10,sold:null}],columns:[{header:'Dish',field:'recipe_name'}]};
try{
 for(const record of locations)assert.equal((await call('POST',{action:'location',record},'/api/admin')).status,200);
 assert.equal((await call('POST',{kind:'inventory',items:[inventory]})).status,200);
 assert.equal((await call('POST',{kind:'recipe',record:r})).status,200);
 assert.equal((await call('POST',{kind:'recipe',record:{...r,id:'different-id'}})).status,409);
 assert.equal((await call('POST',{kind:'menu',record:m})).status,200);
 const loaded=await call('GET');assert.equal(loaded.status,200);assert.deepEqual(loaded.data.recipes.find(x=>x.id===r.id).site_ids,['QA-SITE']);assert.equal(loaded.data.menus.find(x=>x.id===m.id).columns[0].header,'Dish');
 assert.equal((await call('DELETE',null,'/api/data?site=qa-site&kind=inventory&id=inv%3AQA-ONLY')).status,409);
 assert.equal((await call('DELETE',null,'/api/data?site=qa-site&kind=recipe&id=qa-recipe')).status,409);
 assert.equal((await call('GET',undefined,'/api/data?site=not-assigned')).status,403);
 console.log('Passed: authenticated context, hierarchy creation, scoped data persistence, canonical Food Pro site fields, store validation, unique codes and reference protection.');
}finally{
 await call('DELETE',null,'/api/data?site=qa-site&kind=menu&id=qa-menu');
 await call('DELETE',null,'/api/data?site=qa-site&kind=recipe&id=qa-recipe');
 await call('DELETE',null,'/api/data?site=qa-site&kind=inventory&id=inv%3AQA-ONLY');
 for(const record of [...locations].reverse())await call('POST',{action:'location',record:{...record,active:false}},'/api/admin');
}
