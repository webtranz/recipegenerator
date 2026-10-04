export const UNITS = ['kg','g','lb','oz','m3','l','ml','pieces','ct','ea','pak','bag','bdl','cs'] as const;
export const CATEGORIES = ['Main Course','Side Dish','Soup','Salad','Breakfast','Beverage','Dessert'];
export const INVENTORY_HEADERS = 'item_code,ingredient_name,site_id,site_name,ingredient_id,quantity,unit,unit_cost,batch_number,stock_date,expiry_date,reference_id,notes,min_stock_level,max_stock_level,valuation_method'.split(',');
export const RECIPE_HEADERS = 'recipe_code,name,description,cuisine_type,menu_category,servings,portion_size_grams,batch_yield,costing_method,line_number,ingredient_id,item_code,ingredient_code,sku,ingredient_name,line_quantity,line_unit,line_yield_percent,line_raw_weight_grams,line_yielded_weight_grams,line_cost,instructions,prep_time_minutes,cook_time_minutes,allergens,site_scope,site_ids,site_names,image_url,is_active'.split(',');
export const MENU_PLAN_HEADERS = 'site_id,site_name,plan_date,meal_type,menu_type,menu_category,status,line_number,line_type,recipe_id,recipe_code,recipe_name,ingredient_id,ingredient_name,item_name,expected_servings,planned_quantity,planned_quantity_unit,planned_weight_kg,planned_weight_grams,planned_unit,estimated_cost,event_name,event_date,expected_participants,budget_amount,notes'.split(',');
export const HEADERS = RECIPE_HEADERS;
export type Inventory = {id:string;item_code:string;name:string;unit:string;cost:number|null;category:string;allergens:string[];quantity?:number;site_id?:string;site_name?:string;ingredient_id?:string;batch_number?:string;stock_date?:string;expiry_date?:string;reference_id?:string;notes?:string;min_stock_level?:number|null;max_stock_level?:number|null;valuation_method?:string};
export type Ingredient = {name:string;item_code:string;quantity:number;unit:string;source:string;original_servings:number;processing:boolean};
export type Recipe = {id:string;name:string;recipe_code:string;description:string;recipe_type:string;cuisine_type:string;category:string;servings:number;portion_size_grams:number;ingredients:Ingredient[];instructions:string;prep_time_minutes:number;cook_time_minutes:number;allergens:string[];site_scope:string;site_ids:string[];site_names:string[];image_url:string;is_active:boolean};
export type Menu = {id:string;code:string;name:string;target:number;store_id?:string;items:{recipe_id:string;price:number;portions:number;sold:number|null}[];columns?:{header:string;field:string}[]};
export const normalize = (s:string) => s.trim().toLocaleLowerCase().replace(/\s+/g,' ');
const normalizeHeader = (s:string) => s.trim().replace(/^\uFEFF/,'').toLocaleLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
export const round = (n:number) => Math.round((n+Number.EPSILON)*1e6)/1e6;
export function csv(rows:unknown[][]){return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
export function parseCSV(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw Error('Unexpected quote in CSV.');}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Unclosed quoted CSV cell.');row.push(cell);if(row.some(s=>s.trim()))rows.push(row);return rows;
}
const UNIT_ALIASES:Record<string,typeof UNITS[number]>={
  kg:'kg',kgs:'kg',kilogram:'kg',kilograms:'kg',g:'g',gram:'g',grams:'g',gm:'g',gms:'g',lb:'lb',lbs:'lb',pound:'lb',pounds:'lb',oz:'oz',ounce:'oz',ounces:'oz',m3:'m3','m_3':'m3','cubic_meter':'m3','cubic_meters':'m3',l:'l',lt:'l',ltr:'l',liter:'l',liters:'l',litre:'l',litres:'l',ml:'ml',milliliter:'ml',milliliters:'ml',millilitre:'ml',millilitres:'ml',pieces:'pieces',piece:'pieces',pc:'pieces',pcs:'pieces',count:'pieces',ct:'ct',cts:'ct',ea:'ea',each:'ea',unit:'ea',units:'ea',pak:'pak',pack:'pak',packs:'pak',package:'pak',packages:'pak',bag:'bag',bags:'bag',bdl:'bdl',bundle:'bdl',bundles:'bdl',cs:'cs',case:'cs',cases:'cs',carton:'cs',cartons:'cs'
};
export function normalizeUnit(unit:string){return UNIT_ALIASES[normalizeHeader(unit)]||null;}
function getCell(row:string[],headers:string[],aliases:string[]){for(const alias of aliases){const idx=headers.indexOf(normalizeHeader(alias));if(idx>=0)return row[idx]?.trim()||'';}return '';}
function hasAny(headers:string[],aliases:string[]){return aliases.some(alias=>headers.includes(normalizeHeader(alias)));}
function numberCell(value:string,row:number,label:string,fallback=0,required=false){const text=value.trim().replace(/,/g,'');if(!text){if(required)throw Error(`Row ${row}: ${label} is required.`);return fallback;}const n=Number(text);if(!Number.isFinite(n)||n<0)throw Error(`Row ${row}: invalid ${label}.`);return n;}
function nullableNumberCell(value:string,row:number,label:string){const text=value.trim().replace(/,/g,'');if(!text)return null;const n=Number(text);if(!Number.isFinite(n)||n<0)throw Error(`Row ${row}: invalid ${label}.`);return n;}
function dateCell(value:string,row:number,label:string){const text=value.trim();if(!text)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;const d=new Date(text);if(Number.isNaN(d.getTime()))throw Error(`Row ${row}: invalid ${label}. Use YYYY-MM-DD.`);return d.toISOString().slice(0,10);}
function allergenCell(value:string,row:number){if(!value)return [];try{const parsed=JSON.parse(value);if(!Array.isArray(parsed)||parsed.some(a=>typeof a!=='string'))throw Error('bad');return parsed;}catch{throw Error(`Row ${row}: allergens must be a JSON array.`);}}
export function inventoryCSV(text:string):Inventory[]{
  const [head,...rows]=parseCSV(text);if(!head)throw Error('The inventory CSV is empty.');
  const h=head.map(normalizeHeader);
  if(!hasAny(h,['item_code','item_id','d365_item_id','sku'])||!hasAny(h,['ingredient_name','name','item_name','product_name','productname'])||!hasAny(h,['unit','inventory_unit','purchase_unit','unit_id']))throw Error('Inventory needs FoodProLive columns item_code, ingredient_name, and unit.');
  return rows.map((r,i)=>{const row=i+2;if(r.length!==head.length)throw Error(`Row ${row}: column count does not match the header.`);
    const code=getCell(r,h,['item_code','item_id','d365_item_id','sku']);
    const name=getCell(r,h,['ingredient_name','name','item_name','product_name','productname']);
    const rawUnit=getCell(r,h,['unit','inventory_unit','purchase_unit','unit_id']);
    const unit=normalizeUnit(rawUnit);
    if(!code||!name||!unit)throw Error(`Row ${row}: item code, ingredient name, or unit is invalid.`);
    const quantity=numberCell(getCell(r,h,['quantity','received_quantity','available_quantity','on_hand_quantity','receipt_quantity']),row,'quantity',0,false);
    const cost=nullableNumberCell(getCell(r,h,['unit_cost','cost','cost_per_unit','last_cost']),row,'unit cost');
    const stock_date=dateCell(getCell(r,h,['stock_date','received_date','receipt_date']),row,'stock date');
    const expiry_date=dateCell(getCell(r,h,['expiry_date','expiration_date','best_before_date']),row,'expiry date');
    if(stock_date&&expiry_date&&expiry_date<stock_date)throw Error(`Row ${row}: expiry date is before stock date.`);
    return {id:`inv:${code}:${row}`,item_code:code,name,unit,cost,category:getCell(r,h,['category','menu_category'])||'Ingredient',allergens:allergenCell(getCell(r,h,['allergens']),row),quantity,site_id:getCell(r,h,['site_id','warehouse_id','invent_location_id']),site_name:getCell(r,h,['site_name','warehouse_name']),ingredient_id:getCell(r,h,['ingredient_id']),batch_number:getCell(r,h,['batch_number','batch','lot_number']),stock_date,expiry_date,reference_id:getCell(r,h,['reference_id','reference','po_number','receipt_number']),notes:getCell(r,h,['notes','description']),min_stock_level:nullableNumberCell(getCell(r,h,['min_stock_level','minimum_stock','min_qty']),row,'minimum stock level'),max_stock_level:nullableNumberCell(getCell(r,h,['max_stock_level','maximum_stock','max_qty']),row,'maximum stock level'),valuation_method:getCell(r,h,['valuation_method','costing_method'])||'weighted_average'};
  });
}
export function convert(q:number,from:string,to:string):number|null {
  const source=normalizeUnit(from)||from,target=normalizeUnit(to)||to;if(source===target)return q;
  const families:Record<string,[string,number]>={kg:['mass',1000],g:['mass',1],lb:['mass',453.59237],oz:['mass',28.349523125],m3:['volume',1000000],l:['volume',1000],ml:['volume',1],ea:['count',1],pieces:['count',1],ct:['count',1]};
  const a=families[source],b=families[target];return a&&b&&a[0]===b[0]?q*a[1]/b[1]:null;
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
  if(r.ingredients?.some(i=>!i.name?.trim()||!Number.isFinite(i.quantity)||i.quantity<=0||!normalizeUnit(i.unit)||!Number.isFinite(i.original_servings)||i.original_servings<=0))errors.push('Every ingredient needs a name, positive quantity, valid unit, and original batch count.');
  if(!['all','specific'].includes(r.site_scope))errors.push('Choose a valid site scope.');
  if(r.site_scope==='specific'&&(!r.site_ids.length||r.site_ids.length!==r.site_names.length||r.site_ids.some(s=>!s.trim())||r.site_names.some(s=>!s.trim())))errors.push('Provide one site name for each site ID.');
  if([r.prep_time_minutes,r.cook_time_minutes].some(v=>!Number.isFinite(v)||v<0))errors.push('Preparation and cooking times must be zero or greater.');
  if(r.image_url){try{if(!['https:','http:'].includes(new URL(r.image_url).protocol))errors.push('Image URL must use https or http.');}catch{errors.push('Provide a valid image URL.');}}
  return errors;
}
function recipeRows(r:Recipe,inventory:Inventory[]){
  const instructions=r.instructions.split('\n').map(s=>s.trim()).filter(Boolean).map((s,n)=>`${n+1}. ${s.replace(/^\d+[.)]\s*/, '')}`).join('\n');
  const siteScope=r.site_scope==='specific'?'specific':'global',siteIds=r.site_scope==='specific'?r.site_ids:[],siteNames=r.site_scope==='specific'?r.site_names:[];
  return r.ingredients.filter(i=>!i.processing).map((i,index)=>{const m=mapIngredient(i,inventory),cost=lineCost(i,inventory),rawGrams=convert(i.quantity,i.unit,'g');return [r.recipe_code,r.name,r.description,r.cuisine_type,r.category,r.servings,r.portion_size_grams,r.servings,'average_cost',index+1,'',m?.item_code||'',m?.item_code||'',m?.item_code||'',m?.name||i.name,i.quantity,i.unit,100,rawGrams===null?'':round(rawGrams),rawGrams===null?'':round(rawGrams),cost===null?'':round(cost),instructions,r.prep_time_minutes,r.cook_time_minutes,JSON.stringify(effectiveAllergens(r,inventory)),siteScope,JSON.stringify(siteIds),JSON.stringify(siteNames),r.image_url,r.is_active];});
}
export function recipeRow(r:Recipe,inventory:Inventory[]){return recipeRows(r,inventory)[0];}
export function recipesCSV(recipes:Recipe[],inventory:Inventory[]){const codes=new Set<string>();const rows:unknown[][]=[];for(const r of recipes){const errors=validateRecipe(r);if(errors.length)throw Error(`${r.name}: ${errors.join(' ')}`);const missing=r.ingredients.filter(i=>!i.processing&&!mapIngredient(i,inventory));if(missing.length)throw Error(`${r.name}: map every production ingredient to inventory before exporting to FoodProLive. Missing: ${missing.map(i=>i.name).join(', ')}`);if(codes.has(r.recipe_code))throw Error('Recipe codes must be unique.');codes.add(r.recipe_code);rows.push(...recipeRows(r,inventory));}return csv([HEADERS,...rows]);}
export function missingCSV(recipes:Recipe[],inventory:Inventory[]){const missing=new Map<string,{name:string;unit:string;recipes:Set<string>;examples:Set<string>}>();for(const r of recipes)for(const i of r.ingredients){if(i.processing||mapIngredient(i,inventory))continue;const key=normalize(i.name)+'|'+i.unit;const record=missing.get(key)||{name:i.name,unit:i.unit,recipes:new Set<string>(),examples:new Set<string>()};record.recipes.add(r.recipe_code);record.examples.add(i.source||`${i.quantity} ${i.unit}`);missing.set(key,record);}return csv([INVENTORY_HEADERS,...[...missing.values()].map(m=>['',m.name,'','', '',0,m.unit,'','','','','',`Used in recipes: ${[...m.recipes].join('; ')}. Source examples: ${[...m.examples].join('; ')}`,'','','weighted_average'])]);}
export function parseQuantity(text:string){
  const s=text.trim(),unitPattern='kg|g|lb|oz|m3|l|ml|pieces|ct|ea|pak|bag|bdl|cs';
  const withUnits=s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\s*(?:to|[-–])\\s*(\\d+(?:\\.\\d+)?)\\s*\\2\\s+(.+)$`,'i'));
  if(withUnits)return {quantity:Math.max(Number(withUnits[1]),Number(withUnits[3])),unit:normalizeUnit(withUnits[2])||withUnits[2].toLowerCase(),name:withUnits[4]};
  const m=s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)(?:\\s*(?:to|[-–])\\s*(\\d+(?:\\.\\d+)?))?\\s*(${unitPattern})\\s+(.+)$`,'i'));
  if(!m)throw Error(`Use “2 kg Chicken breast” or “45 kg to 50 kg Rice”: ${text}`);
  return {quantity:Math.max(Number(m[1]),Number(m[2]||m[1])),unit:normalizeUnit(m[3])||m[3].toLowerCase(),name:m[4]};
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

