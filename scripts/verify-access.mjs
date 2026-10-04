import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync('postgres/0001_foodprolive_subset.sql','utf8');
const requiredTables=[
 'users','user_site_access','auth_tokens','role_profiles','role_profile_permissions',
 'food_categories','areas','projects','warehouses','ingredients','ingredient_unit_conversions',
 'ingredient_details','ingredient_nutrition_profiles','ingredient_allergen_tags','ingredient_aliases',
 'ingredient_stock_summaries','warehouse_inventory','inventory_lots','recipes','recipe_versions',
 'recipe_ingredient_lines','menu_plans','menu_plan_lines'
];
for(const table of requiredTables)assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`),`missing ${table}`);
for(const table of ['records','locations','credentials','sessions','login_attempts','entity_records'])assert.doesNotMatch(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`),`legacy table should not exist: ${table}`);
assert.doesNotMatch(sql,/\b(payload|data)\s+JSONB\b/i,'schema should not use JSONB payload columns');
assert.match(sql,/recipe_versions[\s\S]*allergens TEXT\[\]/,'recipe allergens should use relational/text array columns copied from FoodProLive');
assert.match(sql,/warehouse_inventory[\s\S]*UNIQUE \(warehouse_id, ingredient_id\)/,'warehouse inventory connectivity is required');
assert.match(sql,/recipe_ingredient_lines[\s\S]*REFERENCES recipe_versions\(recipe_version_id\)[\s\S]*REFERENCES ingredients\(ingredient_id\)/,'recipe lines must connect recipe versions to ingredients');
assert.match(sql,/menu_plan_lines[\s\S]*REFERENCES menu_plans\(menu_plan_id\)[\s\S]*REFERENCES recipe_versions\(recipe_version_id\)/,'menu lines must connect menu plans to recipe versions');

const appFiles=['lib/access.ts','lib/data-service.ts','lib/session.ts','lib/first-admin.ts'];
for(const file of appFiles){
 const text=readFileSync(file,'utf8');
 assert.doesNotMatch(text,/\brecords\b|\blocations\b|\bcredentials\b|\bsessions\b|\blogin_attempts\b|\bpayload\b/,`${file} still references the legacy JSON/SQLite tables`);
}
console.log('Passed: Recipe Generator uses the FoodProLive relational subset and has no legacy JSON records table in its active database path.');
