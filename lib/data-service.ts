import {z} from 'zod';
import {CATEGORIES,UNITS,validateRecipe,convert} from './food';
import {AccessError,exportScope,type Location} from './access';
const string=z.string().max(10000),name=z.string().trim().min(1).max(200),num=z.number().finite().nonnegative(),SOURCE='recipegenerator';
const ingredient=z.object({name,item_code:string,quantity:num.positive(),unit:z.enum(UNITS),source:string,original_servings:num.positive(),processing:z.boolean()});
const recipeSchema=z.object({id:name,name,recipe_code:name,description:string,recipe_type:name,cuisine_type:z.enum(['general','philippines']),category:z.string().refine(s=>CATEGORIES.includes(s)),servings:num.positive(),portion_size_grams:num.positive(),ingredients:z.array(ingredient).max(300),instructions:string,prep_time_minutes:num,cook_time_minutes:num,allergens:z.array(name).max(50),site_scope:z.enum(['all','specific']),site_ids:z.array(name).max(100),site_names:z.array(name).max(100),image_url:string,is_active:z.boolean()});
const inventorySchema=z.object({id:name,item_code:name,name,unit:z.enum(UNITS),cost:num.nullable(),category:name,allergens:z.array(name).max(50),quantity:num.default(0),site_id:string.optional().default(''),site_name:string.optional().default(''),ingredient_id:string.optional().default(''),batch_number:string.optional().default(''),stock_date:string.optional().default(''),expiry_date:string.optional().default(''),reference_id:string.optional().default(''),notes:string.optional().default(''),min_stock_level:num.nullable().optional().default(null),max_stock_level:num.nullable().optional().default(null),valuation_method:string.optional().default('weighted_average')});
const menuSchema=z.object({id:name,code:name,name,target:num.positive().max(100),items:z.array(z.object({recipe_id:name,price:num,portions:num.positive(),sold:num.nullable()})).min(1).max(200),columns:z.array(z.object({header:name,field:string})).max(30).optional()});
const numberValue=(v:unknown,fallback=0)=>v===null||v===undefined||v===''?fallback:Number(v);
const nullableNumber=(v:unknown)=>v===null||v===undefined||v===''?null:Number(v);
const idPart=(s:string)=>s.trim().toLowerCase();
const categoryId=(category:string)=>'food-category:'+idPart(category);
const ingredientId=(itemCode:string)=>'ingredient:'+idPart(itemCode);
const inventoryId=(warehouseId:string,itemCode:string)=>'warehouse-inventory:'+warehouseId+':'+idPart(itemCode);
const inventoryLotId=(stockId:string,key:string,index:number)=>'inventory-lot:'+stockId+':'+idPart(key||String(index+1));
const allergenId=(ingredient:string,tag:string)=>'ingredient-allergen:'+ingredient+':'+idPart(tag);
const recipeVersionId=(warehouseId:string,recipeId:string)=>'recipe-version:'+warehouseId+':'+recipeId;
const recipeLineId=(versionId:string,index:number)=>'recipe-line:'+versionId+':'+(index+1);
const menuLineId=(menuId:string,index:number)=>'menu-plan-line:'+menuId+':'+(index+1);
const today=()=>new Date().toISOString().slice(0,10);
async function resolveIngredientId(db:D1Database,itemCode:string){const row=await db.prepare('SELECT ingredient_id FROM ingredients WHERE LOWER(BTRIM(item_code))=LOWER(BTRIM(?)) LIMIT 1').bind(itemCode).first<{ingredient_id:string}>();return row?.ingredient_id||ingredientId(itemCode);}
async function inventoryMap(db:D1Database,project:Location){const rows=(await db.prepare("SELECT i.item_code,i.ingredient_id,wi.stock_unit,wi.average_unit_cost FROM warehouse_inventory wi JOIN ingredients i ON i.ingredient_id=wi.ingredient_id WHERE wi.warehouse_id=? AND wi.status NOT IN ('archived','voided') AND i.status NOT IN ('archived','voided')").bind(project.id).all<{item_code:string;ingredient_id:string;stock_unit:string;average_unit_cost:string|number}>()).results;return new Map(rows.map(r=>[r.item_code,{ingredientId:r.ingredient_id,unit:r.stock_unit,cost:numberValue(r.average_unit_cost)}]));}
export async function readData(db:D1Database,project:Location){return {inventory:await readInventory(db,project),recipes:await readRecipes(db,project),menus:await readMenus(db,project)};}
async function readInventory(db:D1Database,project:Location){
 const rows=(await db.prepare("SELECT i.item_code,i.name,wi.stock_unit AS unit,wi.on_hand_quantity AS quantity,d.cost_per_unit,COALESCE(fc.name,'Ingredient') AS category,COALESCE(array_agg(DISTINCT a.tag) FILTER (WHERE a.tag IS NOT NULL),'{}') AS allergens FROM warehouse_inventory wi JOIN ingredients i ON i.ingredient_id=wi.ingredient_id LEFT JOIN ingredient_details d ON d.ingredient_id=i.ingredient_id LEFT JOIN food_categories fc ON fc.id=i.category_id LEFT JOIN ingredient_allergen_tags a ON a.ingredient_id=i.ingredient_id WHERE wi.warehouse_id=? AND wi.status='active' AND i.status='active' GROUP BY i.item_code,i.name,wi.stock_unit,wi.on_hand_quantity,d.cost_per_unit,fc.name ORDER BY i.name").bind(project.id).all<{item_code:string;name:string;unit:string;quantity:string|number|null;cost_per_unit:string|number|null;category:string;allergens:string[]}>()).results;
 return rows.map(r=>({id:'inv:'+r.item_code,item_code:r.item_code,name:r.name,unit:r.unit,cost:nullableNumber(r.cost_per_unit),category:r.category,allergens:Array.isArray(r.allergens)?r.allergens:[],quantity:numberValue(r.quantity)}));
}
async function readRecipes(db:D1Database,project:Location){
 const recipes=(await db.prepare("SELECT r.recipe_id AS id,rv.recipe_version_id,COALESCE(rv.recipe_code,'') AS recipe_code,rv.display_name AS name,COALESCE(r.description,'') AS description,COALESCE(rv.recipe_type,'standard') AS recipe_type,COALESCE(rv.cuisine_type,'general') AS cuisine_type,COALESCE(rv.menu_category,'Main Course') AS category,rv.servings,rv.serving_size_grams,COALESCE(rv.instructions,'') AS instructions,COALESCE(rv.prep_time_minutes,0) AS prep_time_minutes,COALESCE(rv.cook_time_minutes,0) AS cook_time_minutes,rv.allergens,COALESCE(rv.image_url,'') AS image_url,CASE WHEN rv.status='active' THEN 1 ELSE 0 END AS is_active FROM recipe_versions rv JOIN recipes r ON r.recipe_id=rv.recipe_id WHERE rv.warehouse_id=? AND rv.status NOT IN ('archived','voided') AND r.status NOT IN ('archived','voided') ORDER BY rv.updated_at DESC,rv.display_name").bind(project.id).all<any>()).results;
 const versionIds=recipes.map(r=>r.recipe_version_id);const lines=versionIds.length?(await db.prepare("SELECT ril.recipe_version_id,ril.line_number,ril.quantity,ril.unit,ril.exempt_processing_aid,i.name,i.item_code,rv.servings FROM recipe_ingredient_lines ril JOIN ingredients i ON i.ingredient_id=ril.ingredient_id JOIN recipe_versions rv ON rv.recipe_version_id=ril.recipe_version_id WHERE ril.recipe_version_id=ANY(?::text[]) ORDER BY ril.recipe_version_id,ril.line_number").bind(versionIds).all<any>()).results:[];
 const grouped=new Map<string,any[]>();for(const line of lines){const list=grouped.get(line.recipe_version_id)||[];list.push(line);grouped.set(line.recipe_version_id,list);}
 return recipes.map(r=>({...exportScope(project),id:r.id,name:r.name,recipe_code:r.recipe_code,description:r.description,recipe_type:r.recipe_type,cuisine_type:r.cuisine_type,category:r.category,servings:numberValue(r.servings,1),portion_size_grams:numberValue(r.serving_size_grams,1),ingredients:(grouped.get(r.recipe_version_id)||[]).map(line=>({name:line.name,item_code:line.item_code,quantity:numberValue(line.quantity),unit:line.unit,source:`${numberValue(line.quantity)} ${line.unit}`,original_servings:numberValue(line.servings,1),processing:!!line.exempt_processing_aid})),instructions:r.instructions,prep_time_minutes:numberValue(r.prep_time_minutes),cook_time_minutes:numberValue(r.cook_time_minutes),allergens:Array.isArray(r.allergens)?r.allergens:[],image_url:r.image_url,is_active:!!r.is_active}));
}
async function readMenus(db:D1Database,project:Location){
 const menus=(await db.prepare("SELECT menu_plan_id AS id,menu_type AS code,menu_category AS name,status FROM menu_plans WHERE warehouse_id=? AND status NOT IN ('archived','voided','cancelled') ORDER BY updated_at DESC,menu_category").bind(project.id).all<any>()).results;
 const menuIds=menus.map(m=>m.id);const lines=menuIds.length?(await db.prepare("SELECT mpl.menu_plan_id,rv.recipe_id,mpl.estimated_cost,mpl.planned_servings FROM menu_plan_lines mpl JOIN recipe_versions rv ON rv.recipe_version_id=mpl.recipe_version_id WHERE mpl.menu_plan_id=ANY(?::text[]) ORDER BY mpl.menu_plan_id,mpl.line_number").bind(menuIds).all<any>()).results:[];
 const grouped=new Map<string,any[]>();for(const line of lines){const list=grouped.get(line.menu_plan_id)||[];list.push(line);grouped.set(line.menu_plan_id,list);}
 return menus.map(m=>({id:m.id,code:m.code,name:m.name,target:30,items:(grouped.get(m.id)||[]).map(line=>({recipe_id:line.recipe_id,price:numberValue(line.estimated_cost),portions:numberValue(line.planned_servings,1),sold:null}))}));
}
export async function writeData(db:D1Database,project:Location,input:unknown){
 const body=z.object({kind:z.enum(['inventory','recipe','menu']),record:z.unknown().optional(),items:z.unknown().optional()}).parse(input);
 if(body.kind==='inventory')return writeInventory(db,project,z.array(inventorySchema).min(1).max(5000).parse(body.items));
 if(body.kind==='recipe')return writeRecipe(db,project,recipeSchema.parse(body.record));
 return writeMenu(db,project,menuSchema.parse(body.record));
}
async function writeInventory(db:D1Database,project:Location,items:z.infer<typeof inventorySchema>[]){
 const groups=new Map<string,z.infer<typeof inventorySchema>[]>();
 for(const item of items){const code=item.item_code.trim();const list=groups.get(idPart(code))||[];list.push({...item,item_code:code});groups.set(idPart(code),list);}
 const statements=[];
 for(const rows of groups.values()){
  const first=rows[0],code=first.item_code.trim(),ingId=await resolveIngredientId(db,code),catId=categoryId(first.category),stockId=inventoryId(project.id,code);
  const quantity=rows.reduce((sum,item)=>sum+numberValue(item.quantity),0),lastCost=[...rows].reverse().find(item=>item.cost!==null)?.cost??0;
  const valuedQuantity=rows.reduce((sum,item)=>sum+(item.cost===null?0:numberValue(item.quantity)),0),valuedAmount=rows.reduce((sum,item)=>sum+(item.cost===null?0:numberValue(item.quantity)*item.cost),0);
  const averageCost=valuedQuantity>0?valuedAmount/valuedQuantity:lastCost,totalValue=quantity*averageCost;
  statements.push(
   db.prepare("INSERT INTO food_categories (id,name,code,status,source_name,updated_at) VALUES (?, ?, ?, 'active', ?, NOW()) ON CONFLICT (id) DO UPDATE SET name=excluded.name,code=excluded.code,status='active',updated_at=NOW()").bind(catId,first.category,first.category,SOURCE),
   db.prepare("INSERT INTO ingredients (ingredient_id,item_code,name,base_unit,category_id,status,source_name,updated_at) VALUES (?,?,?,?,?,'active',?,NOW()) ON CONFLICT (ingredient_id) DO UPDATE SET item_code=excluded.item_code,name=excluded.name,base_unit=excluded.base_unit,category_id=excluded.category_id,status='active',updated_at=NOW()").bind(ingId,code,first.name.trim(),first.unit,catId,SOURCE),
   db.prepare("INSERT INTO ingredient_details (ingredient_id,cost_per_unit,source_name,updated_at) VALUES (?,?,?,NOW()) ON CONFLICT (ingredient_id) DO UPDATE SET cost_per_unit=excluded.cost_per_unit,updated_at=NOW()").bind(ingId,averageCost,SOURCE),
   db.prepare("INSERT INTO ingredient_stock_summaries (ingredient_id,on_hand_quantity,reserved_quantity,available_quantity,total_value,site_count,unit,source_name,updated_at) VALUES (?,?,0,?,?,1,?,?,NOW()) ON CONFLICT (ingredient_id) DO UPDATE SET on_hand_quantity=excluded.on_hand_quantity,available_quantity=excluded.available_quantity,total_value=excluded.total_value,unit=excluded.unit,site_count=GREATEST(COALESCE(ingredient_stock_summaries.site_count,0),1),updated_at=NOW()").bind(ingId,quantity,quantity,totalValue,first.unit,SOURCE),
   db.prepare("INSERT INTO warehouse_inventory (inventory_id,warehouse_id,ingredient_id,available_quantity,reserved_quantity,on_hand_quantity,average_unit_cost,last_unit_cost,stock_unit,status,source_name,updated_at) VALUES (?,?,?, ?,0,?,?,?,?, 'active',?,NOW()) ON CONFLICT (warehouse_id,ingredient_id) DO UPDATE SET available_quantity=excluded.available_quantity,on_hand_quantity=excluded.on_hand_quantity,average_unit_cost=excluded.average_unit_cost,last_unit_cost=excluded.last_unit_cost,stock_unit=excluded.stock_unit,status='active',updated_at=NOW()").bind(stockId,project.id,ingId,quantity,quantity,averageCost,lastCost,first.unit,SOURCE),
   db.prepare('DELETE FROM inventory_lots WHERE inventory_id=?').bind(stockId),
   db.prepare('DELETE FROM ingredient_allergen_tags WHERE ingredient_id=?').bind(ingId),
  );
  rows.forEach((item,index)=>{const rowQuantity=numberValue(item.quantity);if(rowQuantity>0)statements.push(db.prepare("INSERT INTO inventory_lots (lot_id,inventory_id,warehouse_id,ingredient_id,batch_number,received_date,stock_date,expiry_date,original_quantity,remaining_quantity,reserved_quantity,unit,unit_cost,status,source_name,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,'active',?,NOW()) ON CONFLICT (lot_id) DO UPDATE SET batch_number=excluded.batch_number,received_date=excluded.received_date,stock_date=excluded.stock_date,expiry_date=excluded.expiry_date,original_quantity=excluded.original_quantity,remaining_quantity=excluded.remaining_quantity,unit=excluded.unit,unit_cost=excluded.unit_cost,status='active',updated_at=NOW()").bind(inventoryLotId(stockId,item.batch_number||item.reference_id,index),stockId,project.id,ingId,item.batch_number||null,item.stock_date||today(),item.stock_date||today(),item.expiry_date||null,rowQuantity,rowQuantity,item.unit,item.cost??averageCost,SOURCE));});
  for(const tag of first.allergens.filter(Boolean))statements.push(db.prepare("INSERT INTO ingredient_allergen_tags (ingredient_allergen_id,ingredient_id,tag,source_name) VALUES (?,?,?,?) ON CONFLICT DO NOTHING").bind(allergenId(ingId,tag),ingId,tag,SOURCE));
 }
 await db.batch(statements);
}
async function writeRecipe(db:D1Database,project:Location,r:z.infer<typeof recipeSchema>){
 const scoped={...r,...exportScope(project),project_id:project.id},errors=validateRecipe(scoped);if(errors.length)throw new AccessError(errors.join(' '),400);
 const inventory=await inventoryMap(db,project);if(r.ingredients.some(i=>!i.item_code.trim()))throw new AccessError('Every saved recipe ingredient must be mapped to inventory before saving to the FoodProLive relational schema.',400);
 if(r.ingredients.some(i=>!inventory.has(i.item_code)))throw new AccessError('A mapped ingredient does not belong to this project. Remap it to this project inventory first.',400);
 const versionId=recipeVersionId(project.id,r.id);let totalCost=0;const lineInputs=r.ingredients.map((line,index)=>{const stock=inventory.get(line.item_code)!;const converted=convert(line.quantity,line.unit,stock.unit);const lineCost=line.processing?0:(converted===null?0:converted*stock.cost);totalCost+=lineCost;return {line,index,stock,converted,lineCost};});
 const status=r.is_active?'active':'inactive';const statements=[
  db.prepare("INSERT INTO recipes (recipe_id,canonical_name,description,status,source_name,updated_at) VALUES (?,?,?,?,?,NOW()) ON CONFLICT (recipe_id) DO UPDATE SET canonical_name=excluded.canonical_name,description=excluded.description,status=excluded.status,updated_at=NOW()").bind(r.id,r.name,r.description,status,SOURCE),
  db.prepare("INSERT INTO recipe_versions (recipe_version_id,recipe_id,warehouse_id,recipe_code,display_name,version_label,cuisine_type,menu_category,recipe_type,costing_method,servings,serving_size_grams,batch_yield,total_cost,cost_per_serving,costing_updated_at,prep_time_minutes,cook_time_minutes,instructions,image_url,allergens,declared_allergens,legacy_allergens,nutrition_complete,allergens_complete,nutrition_calculation_version,status,source_name,updated_at) VALUES (?,?,?,?,?,'v1',?,?,?,'average_cost',?,?,?,?,?,NOW(),?,?,?,?,?,?,?,FALSE,TRUE,1,?,?,NOW()) ON CONFLICT (recipe_version_id) DO UPDATE SET recipe_code=excluded.recipe_code,display_name=excluded.display_name,cuisine_type=excluded.cuisine_type,menu_category=excluded.menu_category,recipe_type=excluded.recipe_type,servings=excluded.servings,serving_size_grams=excluded.serving_size_grams,batch_yield=excluded.batch_yield,total_cost=excluded.total_cost,cost_per_serving=excluded.cost_per_serving,costing_updated_at=NOW(),prep_time_minutes=excluded.prep_time_minutes,cook_time_minutes=excluded.cook_time_minutes,instructions=excluded.instructions,image_url=excluded.image_url,allergens=excluded.allergens,declared_allergens=excluded.declared_allergens,legacy_allergens=excluded.legacy_allergens,nutrition_complete=FALSE,allergens_complete=TRUE,nutrition_calculation_version=1,status=excluded.status,updated_at=NOW()").bind(versionId,r.id,project.id,r.recipe_code,r.name,r.cuisine_type,r.category,r.recipe_type,r.servings,r.portion_size_grams,r.servings,totalCost,totalCost/r.servings,r.prep_time_minutes,r.cook_time_minutes,r.instructions,r.image_url,r.allergens,r.allergens,[],status,SOURCE),
  db.prepare('DELETE FROM recipe_ingredient_lines WHERE recipe_version_id=?').bind(versionId),
 ];
 for(const {line,index,stock,converted,lineCost} of lineInputs)statements.push(db.prepare("INSERT INTO recipe_ingredient_lines (recipe_line_id,recipe_version_id,ingredient_id,line_number,quantity,unit,converted_quantity,converted_unit,raw_weight_grams,exempt_processing_aid,yield_percent,cost,source_name,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())").bind(recipeLineId(versionId,index),versionId,stock.ingredientId,index+1,line.quantity,line.unit,converted,converted===null?null:stock.unit,convert(line.quantity,line.unit,'g'),line.processing,100,lineCost,SOURCE));
 await db.batch(statements);
}
async function writeMenu(db:D1Database,project:Location,m:z.infer<typeof menuSchema>){
 const rows=(await db.prepare("SELECT rv.recipe_version_id,r.recipe_id,rv.display_name FROM recipe_versions rv JOIN recipes r ON r.recipe_id=rv.recipe_id WHERE rv.warehouse_id=? AND rv.status NOT IN ('archived','voided') AND r.status NOT IN ('archived','voided')").bind(project.id).all<{recipe_version_id:string;recipe_id:string;display_name:string}>()).results;
 const recipes=new Map(rows.map(r=>[r.recipe_id,r]));if(m.items.some(i=>!recipes.has(i.recipe_id)))throw new AccessError('Every menu recipe must be saved in the selected project.',400);
 const statements=[
  db.prepare("INSERT INTO menu_plans (menu_plan_id,warehouse_id,plan_date,meal_period,menu_type,menu_category,status,source_name,updated_at) VALUES (?,?,?,'all-day',?,?, 'planned',?,NOW()) ON CONFLICT (menu_plan_id) DO UPDATE SET warehouse_id=excluded.warehouse_id,menu_type=excluded.menu_type,menu_category=excluded.menu_category,status='planned',updated_at=NOW()").bind(m.id,project.id,today(),m.code,m.name,SOURCE),
  db.prepare('DELETE FROM menu_plan_lines WHERE menu_plan_id=?').bind(m.id),
 ];
 m.items.forEach((item,index)=>{const recipe=recipes.get(item.recipe_id)!;statements.push(db.prepare("INSERT INTO menu_plan_lines (menu_plan_line_id,menu_plan_id,line_number,line_type,meal_period,recipe_version_id,item_name,planned_servings,estimated_cost,status,source_name,updated_at) VALUES (?,?,?,'recipe','all-day',?,?,?,?,'planned',?,NOW())").bind(menuLineId(m.id,index),m.id,index+1,recipe.recipe_version_id,recipe.display_name,item.portions,item.price,SOURCE));});
 await db.batch(statements);
}
export async function deleteData(db:D1Database,project:Location,kind:string|null,id:string|null){
 if(!['inventory','recipe','menu'].includes(kind||'')||!id)throw new AccessError('Invalid record.',400);
 if(kind==='inventory')return deleteInventory(db,project,id);
 if(kind==='recipe')return deleteRecipe(db,project,id);
 return deleteMenu(db,project,id);
}
async function deleteInventory(db:D1Database,project:Location,id:string){
 const code=id.startsWith('inv:')?id.slice(4):id,row=await db.prepare('SELECT wi.inventory_id,i.ingredient_id FROM warehouse_inventory wi JOIN ingredients i ON i.ingredient_id=wi.ingredient_id WHERE wi.warehouse_id=? AND i.item_code=? AND wi.status<>\'archived\'').bind(project.id,code).first<{inventory_id:string;ingredient_id:string}>();
 if(!row)throw new AccessError('Record not found in this project.',404);
 const used=await db.prepare("SELECT 1 FROM recipe_ingredient_lines ril JOIN recipe_versions rv ON rv.recipe_version_id=ril.recipe_version_id WHERE rv.warehouse_id=? AND rv.status NOT IN ('archived','voided') AND ril.ingredient_id=? LIMIT 1").bind(project.id,row.ingredient_id).first();
 if(used)throw new AccessError('This ingredient is used by a recipe in this project. Remap the recipe first.',409);
 await db.prepare("UPDATE warehouse_inventory SET status='archived',updated_at=NOW() WHERE inventory_id=?").bind(row.inventory_id).run();
}
async function deleteRecipe(db:D1Database,project:Location,id:string){
 const versionId=recipeVersionId(project.id,id),row=await db.prepare("SELECT recipe_version_id FROM recipe_versions WHERE recipe_version_id=? AND status NOT IN ('archived','voided')").bind(versionId).first();if(!row)throw new AccessError('Record not found in this project.',404);
 const used=await db.prepare("SELECT 1 FROM menu_plan_lines mpl JOIN menu_plans mp ON mp.menu_plan_id=mpl.menu_plan_id WHERE mp.warehouse_id=? AND mp.status NOT IN ('archived','voided','cancelled') AND mpl.recipe_version_id=? LIMIT 1").bind(project.id,versionId).first();
 if(used)throw new AccessError('This recipe is used by a menu in this project. Remove it from the menu first.',409);
 await db.prepare("UPDATE recipe_versions SET status='archived',updated_at=NOW() WHERE recipe_version_id=?").bind(versionId).run();
}
async function deleteMenu(db:D1Database,project:Location,id:string){
 const row=await db.prepare("SELECT menu_plan_id FROM menu_plans WHERE warehouse_id=? AND menu_plan_id=? AND status NOT IN ('archived','voided','cancelled')").bind(project.id,id).first();if(!row)throw new AccessError('Record not found in this project.',404);
 await db.prepare("UPDATE menu_plans SET status='archived',updated_at=NOW() WHERE warehouse_id=? AND menu_plan_id=?").bind(project.id,id).run();
}
