import {z} from 'zod';
import {CATEGORIES,UNITS,validateRecipe} from './food';
import {AccessError,exportScope,type Location} from './access';
const string=z.string().max(10000),name=z.string().trim().min(1).max(200),num=z.number().finite().nonnegative();
const ingredient=z.object({name,item_code:string,quantity:num.positive(),unit:z.enum(UNITS),source:string,original_servings:num.positive(),processing:z.boolean()});
const recipeSchema=z.object({id:name,name,recipe_code:name,description:string,recipe_type:name,cuisine_type:z.enum(['general','philippines']),category:z.string().refine(s=>CATEGORIES.includes(s)),servings:num.positive(),portion_size_grams:num.positive(),ingredients:z.array(ingredient).max(300),instructions:string,prep_time_minutes:num,cook_time_minutes:num,allergens:z.array(name).max(50),site_scope:z.enum(['all','specific']),site_ids:z.array(name).max(100),site_names:z.array(name).max(100),image_url:string,is_active:z.boolean()});
const inventorySchema=z.object({id:name,item_code:name,name,unit:z.enum(UNITS),cost:num.nullable(),category:name,allergens:z.array(name).max(50)});
const menuSchema=z.object({id:name,code:name,name,target:num.positive().max(100),items:z.array(z.object({recipe_id:name,price:num,portions:num.positive(),sold:num.nullable()})).min(1).max(200),columns:z.array(z.object({header:name,field:string})).max(30).optional()});
type RecordRow={id:string;kind:string;payload:string};
export async function projectRecords(db:D1Database,project:Location){return (await db.prepare('SELECT id,kind,payload FROM records WHERE owner=? AND project_id=? ORDER BY updated DESC').bind('project:'+project.id,project.id).all<RecordRow>()).results;}
export async function readData(db:D1Database,project:Location){const rows=await projectRecords(db,project);const result:{inventory:unknown[];recipes:unknown[];menus:unknown[]}={inventory:[],recipes:[],menus:[]};for(const row of rows){const data=JSON.parse(row.payload);if(row.kind==='recipe'){Object.assign(data,exportScope(project));}const key=row.kind==='recipe'?'recipes':row.kind==='menu'?'menus':'inventory';result[key].push(data);}return result;}
function statement(db:D1Database,project:Location,id:string,kind:string,code:string,data:unknown){return db.prepare('INSERT INTO records (owner,id,kind,code,payload,updated,project_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET code=excluded.code,payload=excluded.payload,updated=excluded.updated').bind('project:'+project.id,id,kind,code,JSON.stringify(data),new Date().toISOString(),project.id);}
export async function writeData(db:D1Database,project:Location,input:unknown){
 const body=z.object({kind:z.enum(['inventory','recipe','menu']),record:z.unknown().optional(),items:z.unknown().optional()}).parse(input);
 if(body.kind==='inventory'){const items=z.array(inventorySchema).min(1).max(100).parse(body.items);await db.batch(items.map(i=>statement(db,project,'inv:'+i.item_code,'inventory',i.item_code,{...i,id:'inv:'+i.item_code,project_id:project.id})));return;}
 if(body.kind==='recipe'){
  const parsed=recipeSchema.parse(body.record);const r={...parsed,...exportScope(project),project_id:project.id};
  const errors=validateRecipe(r);if(errors.length)throw new AccessError(errors.join(' '),400);
  const inventory=await db.prepare("SELECT code FROM records WHERE owner=? AND project_id=? AND kind='inventory'").bind('project:'+project.id,project.id).all<{code:string}>();
  const codes=new Set(inventory.results.map(i=>i.code));if(r.ingredients.some(i=>i.item_code&&!codes.has(i.item_code)))throw new AccessError('A mapped ingredient does not belong to this project. Remap it or leave the item code blank.',400);
  await statement(db,project,'recipe:'+r.id,'recipe',r.recipe_code,r).run();return;
 }
 const m=menuSchema.parse(body.record);const existing=await db.prepare("SELECT payload FROM records WHERE owner=? AND project_id=? AND kind='recipe'").bind('project:'+project.id,project.id).all<{payload:string}>();
 const ids=new Set(existing.results.map(r=>JSON.parse(r.payload).id));if(m.items.some(i=>!ids.has(i.recipe_id)))throw new AccessError('Every menu recipe must be saved in the selected project.',400);
 await statement(db,project,'menu:'+m.id,'menu',m.code,{...m,project_id:project.id}).run();
}
export async function deleteData(db:D1Database,project:Location,kind:string|null,id:string|null){
 if(!['inventory','recipe','menu'].includes(kind||'')||!id)throw new AccessError('Invalid record.',400);const rows=await projectRecords(db,project);
 if(kind==='inventory'&&rows.some(r=>r.kind==='recipe'&&JSON.parse(r.payload).ingredients.some((i:{item_code:string})=>'inv:'+i.item_code===id)))throw new AccessError('This ingredient is used by a recipe in this project. Remap the recipe first.',409);
 if(kind==='recipe'&&rows.some(r=>r.kind==='menu'&&JSON.parse(r.payload).items.some((i:{recipe_id:string})=>i.recipe_id===id)))throw new AccessError('This recipe is used by a menu in this project. Remove it from the menu first.',409);
 const storedId=kind==='inventory'?id:kind+':'+id;if(!rows.some(r=>r.id===storedId&&r.kind===kind))throw new AccessError('Record not found in this project.',404);
 await db.prepare('DELETE FROM records WHERE owner=? AND project_id=? AND id=? AND kind=?').bind('project:'+project.id,project.id,storedId,kind).run();
}
