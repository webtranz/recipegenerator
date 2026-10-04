export const UNITS = ['kg','g','l','ml','pieces','ea','pak','bdl','cs'] as const;
export const CATEGORIES = ['Main Course','Side Dish','Soup','Salad','Breakfast','Beverage','Dessert'];
export const HEADERS = 'name,recipe_code,description,recipe_type,cuisine_type,category,servings,portion_size_grams,ingredients,sub_recipes,instructions,prep_time_minutes,cook_time_minutes,allergens,site_scope,site_ids,site_names,image_url,is_active'.split(',');
export type Inventory = {id:string;item_code:string;name:string;unit:string;cost:number|null;category:string;allergens:string[]};
export type Ingredient = {name:string;item_code:string;quantity:number;unit:string;source:string;original_servings:number;processing:boolean};
export type Recipe = {id:string;name:string;recipe_code:string;description:string;recipe_type:string;cuisine_type:string;category:string;servings:number;portion_size_grams:number;ingredients:Ingredient[];instructions:string;prep_time_minutes:number;cook_time_minutes:number;allergens:string[];site_scope:string;site_ids:string[];site_names:string[];image_url:string;is_active:boolean};
export type Menu = {id:string;code:string;name:string;target:number;store_id?:string;items:{recipe_id:string;price:number;portions:number;sold:number|null}[];columns?:{header:string;field:string}[]};
export const normalize = (s:string) => s.trim().toLocaleLowerCase().replace(/\s+/g,' ');
export const round = (n:number) => Math.round((n+Number.EPSILON)*1e6)/1e6;
export function csv(rows:unknown[][]){return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
export function parseCSV(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw Error('Unexpected quote in CSV.');}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Unclosed quoted CSV cell.');row.push(cell);if(row.some(s=>s.trim()))rows.push(row);return rows;
}
export function inventoryCSV(text:string):Inventory[]{
  const [head,...rows]=parseCSV(text);if(!head)throw Error('The inventory CSV is empty.');
  const h=head.map(normalize);for(const k of ['item_code','name','unit'])if(!h.includes(k))throw Error('Inventory needs item_code, name, and unit columns.');
  const codes=new Set<string>();return rows.map((r,i)=>{const get=(s:string)=>r[h.indexOf(s)]?.trim()||'';const code=get('item_code'),name=get('name'),unit=get('unit').toLowerCase();
    if(r.length!==head.length)throw Error(`Row ${i+2}: column count does not match the header.`);
    if(!code||!name||!UNITS.includes(unit as typeof UNITS[number]))throw Error(`Row ${i+2}: code, name, or unit is invalid.`);
    if(codes.has(code))throw Error(`Duplicate item code: ${code}`);codes.add(code);
    const price=get('cost')||get('unit_cost');const cost=price===''?null:Number(price);if(cost!==null&&(!Number.isFinite(cost)||cost<0))throw Error(`Row ${i+2}: invalid unit cost.`);
    let allergens:string[]=[];if(get('allergens')){try{allergens=JSON.parse(get('allergens'));}catch{throw Error(`Row ${i+2}: allergens must be a JSON array.`);}if(!Array.isArray(allergens)||allergens.some(a=>typeof a!=='string'))throw Error(`Row ${i+2}: invalid allergens.`);}
    return {id:'inv:'+code,item_code:code,name,unit,cost,category:get('category')||'Ingredient',allergens};
  });
}
export function convert(q:number,from:string,to:string):number|null {
  if(from===to)return q;
  const families:Record<string,[string,number]>={kg:['mass',1000],g:['mass',1],l:['volume',1000],ml:['volume',1],ea:['count',1],pieces:['count',1]};
  const a=families[from],b=families[to];return a&&b&&a[0]===b[0]?q*a[1]/b[1]:null;
}
export function mapIngredient(i:Ingredient,inventory:Inventory[]){return i.item_code?inventory.find(x=>x.item_code===i.item_code):undefined;}
export function matchIngredients(lines:Ingredient[],inventory:Inventory[]){return lines.map(i=>{if(i.item_code)return i;const matches=inventory.filter(x=>normalize(x.name)===normalize(i.name));return matches.length===1?{...i,item_code:matches[0].item_code}:i;});}
export function lineCost(i:Ingredient,inventory:Inventory[]):number|null {if(i.processing)return 0;const item=mapIngredient(i,inventory);if(!item||item.cost===null)return null;const q=convert(i.quantity,i.unit,item.unit);return q===null?null:q*item.cost;}
export function recipeCost(r:Recipe,inventory:Inventory[]){const values=r.ingredients.map(i=>lineCost(i,inventory));return values.some(v=>v===null)?null:values.reduce<number>((a,b)=>a+(b??0),0)/r.servings;}
export function effectiveAllergens(r:Recipe,inventory:Inventory[]){return [...new Set([...r.allergens,...r.ingredients.filter(i=>!i.processing).flatMap(i=>mapIngredient(i,inventory)?.allergens||[])])].sort();}
export function validateRecipe(r:Recipe):string[]{
  const errors:string[]=[];if(!r.name?.trim()||!r.recipe_code?.trim())errors.push('Recipe name and unique recipe code are required.');
  if(!['general','philippines'].includes(r.cuisine_type))errors.push('Choose a supported cuisine.');if(!CATEGORIES.includes(r.category))errors.push('Choose a supported category.');
  if(!Number.isFinite(r.servings)||r.servings<=0)errors.push('Batch servings must be greater than zero.');if(!Number.isFinite(r.portion_size_grams)||r.portion_size_grams<=0)errors.push('Portion size must be greater than zero.');
  if(!r.recipe_type?.trim())errors.push('Recipe type is required.');if(!r.instructions?.trim())errors.push('Cooking instructions are required.');
  if(!r.ingredients?.some(i=>!i.processing))errors.push('Add at least one production ingredient.');
  if(r.ingredients?.some(i=>!i.name?.trim()||!Number.isFinite(i.quantity)||i.quantity<=0||!UNITS.includes(i.unit as typeof UNITS[number])||!Number.isFinite(i.original_servings)||i.original_servings<=0))errors.push('Every ingredient needs a name, positive quantity, valid unit, and original batch count.');
  if(!['all','specific'].includes(r.site_scope))errors.push('Choose a valid site scope.');
  if(r.site_scope==='specific'&&(!r.site_ids.length||r.site_ids.length!==r.site_names.length||r.site_ids.some(s=>!s.trim())||r.site_names.some(s=>!s.trim())))errors.push('Provide one site name for each site ID.');
  if([r.prep_time_minutes,r.cook_time_minutes].some(v=>!Number.isFinite(v)||v<0))errors.push('Preparation and cooking times must be zero or greater.');
  if(r.image_url){try{if(!['https:','http:'].includes(new URL(r.image_url).protocol))errors.push('Image URL must use https or http.');}catch{errors.push('Provide a valid image URL.');}}
  return errors;
}
export function recipeRow(r:Recipe,inventory:Inventory[]){
  const ingredients=r.ingredients.filter(i=>!i.processing).map(i=>{const m=mapIngredient(i,inventory);return {ingredient_id:'',item_code:m?.item_code||'',ingredient_code:m?.item_code||'',sku:m?.item_code||'',ingredient_name:m?.name||i.name,recipe_ingredient_name:i.name,quantity:i.quantity,unit:i.unit,source_quantity_text:i.source||`${i.quantity} ${i.unit}`,original_servings:i.original_servings,mapping_source:m?'inventory':'unmatched',mapping_confidence:m?1:0};});
  const instructions=r.instructions.split('\n').map(s=>s.trim()).filter(Boolean).map((s,n)=>`${n+1}. ${s.replace(/^\d+[.)]\s*/, '')}`).join('\n');
  return [r.name,r.recipe_code,r.description,r.recipe_type,r.cuisine_type,r.category,r.servings,r.portion_size_grams,JSON.stringify(ingredients),'[]',instructions,r.prep_time_minutes,r.cook_time_minutes,JSON.stringify(effectiveAllergens(r,inventory)),r.site_scope,JSON.stringify(r.site_scope==='specific'?r.site_ids:[]),JSON.stringify(r.site_scope==='specific'?r.site_names:[]),r.image_url,r.is_active];
}
export function recipesCSV(recipes:Recipe[],inventory:Inventory[]){const codes=new Set<string>();for(const r of recipes){const errors=validateRecipe(r);if(errors.length)throw Error(`${r.name}: ${errors.join(' ')}`);if(codes.has(r.recipe_code))throw Error('Recipe codes must be unique.');codes.add(r.recipe_code);}return csv([HEADERS,...recipes.map(r=>recipeRow(r,inventory))]);}
export function missingCSV(recipes:Recipe[],inventory:Inventory[]){const missing=new Map<string,{name:string;unit:string;recipes:Set<string>;examples:Set<string>}>();for(const r of recipes)for(const i of r.ingredients){if(i.processing||mapIngredient(i,inventory))continue;const key=normalize(i.name)+'|'+i.unit;const record=missing.get(key)||{name:i.name,unit:i.unit,recipes:new Set<string>(),examples:new Set<string>()};record.recipes.add(r.recipe_code);record.examples.add(i.source||`${i.quantity} ${i.unit}`);missing.set(key,record);}return csv([['item_code','name','unit','category','used_in_recipes','source_examples','is_active'],...[...missing.values()].map(m=>['',m.name,m.unit,'Ingredient',JSON.stringify([...m.recipes]),JSON.stringify([...m.examples]),true])]);}
export function parseQuantity(text:string){
  const s=text.trim();
  const withUnits=s.match(/^(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pieces|ea|pak|bdl|cs)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)\s*\2\s+(.+)$/i);
  if(withUnits)return {quantity:Math.max(Number(withUnits[1]),Number(withUnits[3])),unit:withUnits[2].toLowerCase(),name:withUnits[4]};
  const m=s.match(/^(\d+(?:\.\d+)?)(?:\s*(?:to|[-–])\s*(\d+(?:\.\d+)?))?\s*(kg|g|l|ml|pieces|ea|pak|bdl|cs)\s+(.+)$/i);
  if(!m)throw Error(`Use “2 kg Chicken breast” or “45 kg to 50 kg Rice”: ${text}`);
  return {quantity:Math.max(Number(m[1]),Number(m[2]||m[1])),unit:m[3].toLowerCase(),name:m[4]};
}
export function blankRecipe():Recipe{return {id:crypto.randomUUID(),name:'',recipe_code:'RCP-'+crypto.randomUUID().slice(0,8).toUpperCase(),description:'',recipe_type:'standard',cuisine_type:'general',category:'Main Course',servings:10,portion_size_grams:350,ingredients:[],instructions:'',prep_time_minutes:15,cook_time_minutes:30,allergens:[],site_scope:'all',site_ids:[],site_names:[],image_url:'',is_active:true};}
type Pattern={name:string;cuisine:string;category:string;grams:number;prep:number;cook:number;ingredients:[string,number,string][];allergens:string[];steps:string[]};
export const PATTERNS:Pattern[]=[
{name:'Grilled chicken bowl',cuisine:'general',category:'Main Course',grams:400,prep:20,cook:30,ingredients:[['Chicken breast',.2,'kg'],['Basmati rice',.08,'kg'],['Mixed vegetables',.1,'kg'],['Olive oil',.01,'l'],['Salt',.002,'kg']],allergens:[],steps:['Cook rice by the approved kitchen method; exclude discarded cooking water from production ingredients.','Season chicken with salt and half the oil. Grill until fully cooked according to your kitchen safety procedure.','Sauté vegetables in the remaining oil.','Divide rice, sliced chicken, and vegetables into the batch serving count. Verify finished portion weight.']},
{name:'Chicken adobo',cuisine:'philippines',category:'Main Course',grams:260,prep:20,cook:45,ingredients:[['Chicken',.25,'kg'],['Soy sauce',.02,'l'],['Vinegar',.02,'l'],['Garlic',.008,'kg'],['Black pepper',.001,'kg'],['Water',.03,'l']],allergens:['soy','gluten'],steps:['Combine chicken, soy sauce, vinegar, garlic, and pepper in a cooking vessel.','Add the measured water; this water remains in the sauce.','Bring to a simmer and cook until chicken is fully cooked according to the kitchen safety procedure.','Reduce the sauce to the desired consistency. Portion chicken and sauce evenly.']},
{name:'Garlic fried rice',cuisine:'philippines',category:'Side Dish',grams:200,prep:10,cook:15,ingredients:[['Cooked rice',.2,'kg'],['Garlic',.006,'kg'],['Vegetable oil',.01,'l'],['Salt',.001,'kg']],allergens:[],steps:['Prepare cooked rice using the kitchen’s approved cooling and handling procedure.','Heat oil and sauté minced garlic until fragrant.','Add rice and salt. Stir-fry until thoroughly heated according to the kitchen procedure.','Divide into portions and verify finished weight.']},
{name:'Vegetable soup',cuisine:'general',category:'Soup',grams:300,prep:20,cook:30,ingredients:[['Carrot',.06,'kg'],['Potato',.08,'kg'],['Onion',.03,'kg'],['Water',.2,'l'],['Vegetable oil',.005,'l'],['Salt',.002,'kg']],allergens:[],steps:['Wash and dice the vegetables; omit discarded washing water from the ingredient issue.','Sauté onion in oil. Add carrot and potato.','Add measured water and salt. Simmer until vegetables are tender. This water remains in the soup.','Adjust consistency and divide into the batch serving count.']},
{name:'Cucumber tomato salad',cuisine:'general',category:'Salad',grams:180,prep:15,cook:0,ingredients:[['Cucumber',.09,'kg'],['Tomato',.08,'kg'],['Olive oil',.008,'l'],['Lemon juice',.01,'l'],['Salt',.001,'kg']],allergens:[],steps:['Wash and dice cucumber and tomato. Exclude discarded washing water.','Whisk oil, lemon juice, and salt.','Toss vegetables with dressing just before service. Portion and hold using the kitchen’s approved cold-food procedure.']},
{name:'Scrambled eggs',cuisine:'general',category:'Breakfast',grams:140,prep:10,cook:10,ingredients:[['Egg',2,'pieces'],['Milk',.025,'l'],['Butter',.01,'kg'],['Salt',.001,'kg']],allergens:['egg','milk'],steps:['Crack eggs into a clean bowl and whisk with milk and salt.','Melt butter over gentle heat. Add egg mixture.','Stir until fully cooked according to the kitchen procedure, then portion for immediate service.']},
{name:'Lemonade',cuisine:'general',category:'Beverage',grams:250,prep:10,cook:0,ingredients:[['Lemon juice',.04,'l'],['Sugar',.025,'kg'],['Water',.2,'l']],allergens:[],steps:['Dissolve sugar in part of the measured drinking water.','Combine with lemon juice and remaining measured water.','Chill and divide into servings. Water is a retained production ingredient.']},
{name:'Rice pudding',cuisine:'general',category:'Dessert',grams:180,prep:10,cook:35,ingredients:[['Rice',.025,'kg'],['Milk',.15,'l'],['Sugar',.02,'kg']],allergens:['milk'],steps:['Combine rice and milk in a heavy pan.','Simmer gently, stirring regularly, until rice is tender.','Stir in sugar. Portion and cool or serve under the kitchen’s approved procedure.']}
];
export function generateRecipe(index:number,servings:number,inventory:Inventory[]):Recipe {const p=PATTERNS[index];const r=blankRecipe();return {...r,name:p.name,cuisine_type:p.cuisine,category:p.category,servings,portion_size_grams:p.grams,description:`${p.name}, prepared as a production batch.`,prep_time_minutes:p.prep,cook_time_minutes:p.cook,allergens:p.allergens,instructions:p.steps.join('\n'),ingredients:matchIngredients(p.ingredients.map(([name,q,unit])=>({name,item_code:'',quantity:round(q*servings),unit,source:`${round(q*servings)} ${unit}`,original_servings:servings,processing:false})),inventory)};}

