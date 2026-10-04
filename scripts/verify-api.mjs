import assert from 'node:assert/strict';
import {generateRecipe} from '../lib/food.ts';
const origin='http://127.0.0.1:5173';
const platform=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={Cookie:platform.headers.getSetCookie().map(s=>s.split(';')[0]).join('; '),'Content-Type':'application/json',Origin:origin};
async function call(method,body,path='/api/data?project=qa-project',h=headers){const r=await fetch(origin+path,{method,headers:h,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.text().then(t=>{try{return JSON.parse(t);}catch{return {error:t};}}),response:r};}
assert.equal((await fetch(origin+'/api/context')).status,401);
const state=await call('GET',null,'/api/auth');const password=process.env.LOCAL_TEST_PASSWORD||'Recipe Studio LOCAL test password only!';
const owner=await call('POST',{action:state.data.first_admin_available?'first_admin':'login',username:'local-qa-owner',name:'Local test owner',password},'/api/auth');assert.equal(owner.status,200);
headers.Cookie+='; '+owner.response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
assert.match(owner.response.headers.get('set-cookie'),/HttpOnly/);assert.match(owner.response.headers.get('set-cookie'),/SameSite=Strict/);
assert.equal((await call('POST',{action:'logout'},'/api/auth',{...headers,Origin:'https://untrusted.test'})).status,403);
const projects=['qa-project','qa-other'].map(id=>({id,name:id+' (local verification)',code:id.toUpperCase(),active:true,export_site_id:'',export_site_name:''}));
const item={id:'inv:QA-ONLY',item_code:'QA-ONLY',name:'QA ingredient',unit:'kg',cost:24,category:'Test',allergens:[]};
const recipe=generateRecipe(0,10,[]);recipe.id='qa-recipe';recipe.recipe_code='QA-RECIPE';recipe.ingredients[0].item_code='QA-ONLY';
const menu={id:'qa-menu',code:'QA-MENU',name:'QA only',target:30,items:[{recipe_id:recipe.id,price:30,portions:10,sold:null}]};
const chef={id:'qa-chef',username:'qa.chef',name:'QA chef',project_id:'qa-project',role:'chef',active:true,password};
try{
 for(const record of projects)assert.equal((await call('POST',{action:'project',record},'/api/admin')).status,200);
 assert.equal((await call('POST',{action:'location',record:{kind:'site'}},'/api/admin')).status,400);
 assert.equal((await call('POST',{kind:'inventory',items:[item]})).status,200);
 assert.equal((await call('POST',{action:'user',record:chef},'/api/admin')).status,200);
 assert.equal((await call('POST',{action:'user',record:{...chef,role:'viewer'}},'/api/admin')).status,400);
 const auth=await call('POST',{action:'login',username:'qa.chef',password},'/api/auth',{Origin:origin,'Content-Type':'application/json'});assert.equal(auth.status,200);
 const chefHeaders={Origin:origin,'Content-Type':'application/json',Cookie:auth.response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
 assert.equal((await call('GET',null,'/api/context',chefHeaders)).status,428);
 const change=await call('POST',{action:'change_password',current_password:password,password:'Changed test '+crypto.randomUUID()},'/api/auth',chefHeaders);assert.equal(change.status,200);
 const oldCookie=chefHeaders.Cookie;chefHeaders.Cookie=change.response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 assert.equal((await call('GET',null,'/api/context',{...chefHeaders,Cookie:oldCookie})).status,401);
 const ctx=await call('GET',null,'/api/context',chefHeaders);assert.deepEqual(ctx.data.projects.map(p=>p.id),['qa-project']);
 assert.equal((await call('GET',null,'/api/admin',chefHeaders)).status,403);
 assert.equal((await call('GET',null,'/api/data?project=qa-other',chefHeaders)).status,403);
 assert.equal((await call('POST',{kind:'inventory',items:[item]},undefined,chefHeaders)).status,403);
 assert.equal((await call('POST',{kind:'recipe',record:recipe},undefined,chefHeaders)).status,200);
 assert.equal((await call('POST',{kind:'menu',record:menu},undefined,chefHeaders)).status,200);
 assert.equal((await call('GET',null,undefined,chefHeaders)).data.recipes[0].site_scope,'all');
 assert.equal((await call('DELETE',null,'/api/data?project=qa-project&kind=recipe&id=qa-recipe',chefHeaders)).status,409);
 await call('POST',{action:'user',record:{...chef,project_id:'qa-other',password:undefined}},'/api/admin');assert.equal((await call('GET',null,'/api/context',chefHeaders)).status,401);
 console.log('Passed: owner setup, login, mandatory password change, CSRF, session rotation, Admin/Chef-only roles, chef recipe/menu creation, inventory denial, cross-project denial, and assignment revocation.');
}finally{
 await call('DELETE',null,'/api/data?project=qa-project&kind=menu&id=qa-menu');await call('DELETE',null,'/api/data?project=qa-project&kind=recipe&id=qa-recipe');await call('DELETE',null,'/api/data?project=qa-project&kind=inventory&id=inv%3AQA-ONLY');
 await call('POST',{action:'user',record:{...chef,active:false,password:undefined}},'/api/admin');for(const record of projects)await call('POST',{action:'project',record:{...record,active:false}},'/api/admin');await call('POST',{action:'logout'},'/api/auth');
}
