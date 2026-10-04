import assert from 'node:assert/strict';
import {generateRecipe} from '../lib/food.ts';
const origin='http://127.0.0.1:5173';
const auth=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=auth.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
assert.ok(cookie);const headers={Cookie:cookie,'Content-Type':'application/json',Origin:origin};
async function call(method,body,path='/api/data'){const r=await fetch(origin+path,{method,headers,body:body?JSON.stringify(body):undefined});const data=await r.json();return {status:r.status,data};}
assert.equal((await fetch(origin+'/api/data')).status,401);
const inventory={id:'inv:QA-ONLY',item_code:'QA-ONLY',name:'QA ingredient',unit:'kg',cost:24,category:'Test',allergens:[]};
const r=generateRecipe(0,10,[]);r.id='qa-recipe';r.recipe_code='QA-RECIPE';r.name='QA only';r.ingredients[0].item_code='QA-ONLY';
const m={id:'qa-menu',code:'QA-MENU',name:'QA only',target:30,items:[{recipe_id:r.id,price:30,portions:10,sold:null}],columns:[{header:'Dish',field:'recipe_name'}]};
try{
 assert.equal((await call('POST',{kind:'inventory',items:[inventory]})).status,200);
 assert.equal((await call('POST',{kind:'recipe',record:r})).status,200);
 assert.equal((await call('POST',{kind:'recipe',record:{...r,id:'different-id'}})).status,409);
 assert.equal((await call('POST',{kind:'menu',record:m})).status,200);
 const loaded=await call('GET');assert.equal(loaded.status,200);assert.ok(loaded.data.recipes.some(x=>x.id===r.id));assert.equal(loaded.data.menus.find(x=>x.id===m.id).columns[0].header,'Dish');
 assert.equal((await call('DELETE',null,'/api/data?kind=inventory&id=inv%3AQA-ONLY')).status,409);
 assert.equal((await call('DELETE',null,'/api/data?kind=recipe&id=qa-recipe')).status,409);
 console.log('Passed: auth, inventory save, recipe persistence, unique codes, menu template persistence and reference protection.');
}finally{
 await call('DELETE',null,'/api/data?kind=menu&id=qa-menu');
 await call('DELETE',null,'/api/data?kind=recipe&id=qa-recipe');
 await call('DELETE',null,'/api/data?kind=inventory&id=inv%3AQA-ONLY');
}
