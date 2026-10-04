import {sql} from "drizzle-orm";
import {boolean, date, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  siteId: text("site_id"),
  siteName: text("site_name"),
  phone: text("phone"),
  language: text("language"),
  avatarUrl: text("avatar_url"),
  visibilityScope: text("visibility_scope"),
  deactivatedAt: timestamp("deactivated_at", {withTimezone: true}),
  deactivatedBy: text("deactivated_by"),
  deactivationReason: text("deactivation_reason"),
  passwordHash: text("password_hash").notNull(),
  temporaryPassword: text("temporary_password"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [index("idx_users_site_status").on(t.siteId, t.status), index("idx_users_role_status").on(t.role, t.status)]);

export const userSiteAccess = pgTable("user_site_access", {
  userId: text("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  siteId: text("site_id").notNull(),
  siteName: text("site_name"),
  accessScope: text("access_scope").notNull().default("assigned"),
  assignedAt: timestamp("assigned_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [primaryKey({columns: [t.userId, t.siteId]}), index("idx_user_site_access_site").on(t.siteId, t.userId)]);

export const authTokens = pgTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", {withTimezone: true}),
});

export const roleProfiles = pgTable("role_profiles", {
  id: text("id").primaryKey(),
  roleKey: text("role_key"),
  name: text("name"),
  description: text("description"),
  accessLevel: text("access_level").notNull().default("user"),
  dashboardVariant: text("dashboard_variant"),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("idx_role_profiles_role_key_unique").on(sql`LOWER(BTRIM(${t.roleKey}))`).where(sql`COALESCE(BTRIM(${t.roleKey}), '') <> ''`)]);

export const roleProfilePermissions = pgTable("role_profile_permissions", {
  roleProfileId: text("role_profile_id").notNull().references(() => roleProfiles.id, {onDelete: "cascade"}),
  permissionKey: text("permission_key").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [primaryKey({columns: [t.roleProfileId, t.permissionKey]}), index("idx_role_profile_permissions_permission").on(t.permissionKey, t.roleProfileId)]);

export const foodCategories = pgTable("food_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  color: text("color").notNull().default("#10b981"),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [index("idx_food_categories_status_name").on(t.status, sql`LOWER(${t.name})`), index("idx_food_categories_code_lookup").on(sql`LOWER(BTRIM(${t.code}))`).where(sql`COALESCE(BTRIM(${t.code}), '') <> ''`)]);

export const areas = pgTable("areas", {
  areaId: text("area_id").primaryKey(),
  areaCode: text("area_code"),
  name: text("name").notNull(),
  legacySiteId: text("legacy_site_id").unique(),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("idx_areas_area_code_unique").on(sql`LOWER(BTRIM(${t.areaCode}))`).where(sql`COALESCE(BTRIM(${t.areaCode}), '') <> ''`)]);

export const projects = pgTable("projects", {
  projectId: text("project_id").primaryKey(),
  areaId: text("area_id").notNull().references(() => areas.areaId, {onDelete: "restrict"}),
  projectCode: text("project_code"),
  name: text("name").notNull(),
  legacySiteId: text("legacy_site_id").unique(),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("idx_projects_project_code_unique").on(sql`LOWER(BTRIM(${t.projectCode}))`).where(sql`COALESCE(BTRIM(${t.projectCode}), '') <> ''`), index("idx_projects_area").on(t.areaId)]);

export const warehouses = pgTable("warehouses", {
  warehouseId: text("warehouse_id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.projectId, {onDelete: "restrict"}),
  warehouseCode: text("warehouse_code"),
  d365WarehouseId: text("d365_warehouse_id"),
  name: text("name").notNull(),
  legacySiteId: text("legacy_site_id").unique(),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [
  uniqueIndex("idx_warehouses_warehouse_code_unique").on(sql`LOWER(BTRIM(${t.warehouseCode}))`).where(sql`COALESCE(BTRIM(${t.warehouseCode}), '') <> ''`),
  uniqueIndex("idx_warehouses_d365_unique").on(sql`LOWER(BTRIM(${t.d365WarehouseId}))`).where(sql`COALESCE(BTRIM(${t.d365WarehouseId}), '') <> ''`),
  index("idx_warehouses_project").on(t.projectId),
]);

export const ingredients = pgTable("ingredients", {
  ingredientId: text("ingredient_id").primaryKey(),
  itemCode: text("item_code").notNull(),
  ingredientCode: text("ingredient_code"),
  sku: text("sku"),
  d365ItemId: text("d365_item_id"),
  name: text("name").notNull(),
  baseUnit: text("base_unit").notNull(),
  categoryId: text("category_id"),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [
  uniqueIndex("idx_ingredients_item_code_unique").on(sql`LOWER(BTRIM(${t.itemCode}))`).where(sql`COALESCE(BTRIM(${t.itemCode}), '') <> ''`),
  uniqueIndex("idx_ingredients_ingredient_code_unique").on(sql`LOWER(BTRIM(${t.ingredientCode}))`).where(sql`COALESCE(BTRIM(${t.ingredientCode}), '') <> ''`),
  uniqueIndex("idx_ingredients_sku_unique").on(sql`LOWER(BTRIM(${t.sku}))`).where(sql`COALESCE(BTRIM(${t.sku}), '') <> ''`),
  uniqueIndex("idx_ingredients_d365_unique").on(sql`LOWER(BTRIM(${t.d365ItemId}))`).where(sql`COALESCE(BTRIM(${t.d365ItemId}), '') <> ''`),
  index("idx_ingredients_name_search").using("gin", sql`LOWER(${t.name}) gin_trgm_ops`),
]);

export const ingredientUnitConversions = pgTable("ingredient_unit_conversions", {
  conversionId: text("conversion_id").primaryKey(),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.ingredientId, {onDelete: "cascade"}),
  fromUnit: text("from_unit").notNull(),
  toUnit: text("to_unit").notNull(),
  factor: numeric("factor", {precision: 18, scale: 8}).notNull(),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("ingredient_unit_conversions_ingredient_from_to").on(t.ingredientId, t.fromUnit, t.toUnit)]);

export const ingredientDetails = pgTable("ingredient_details", {
  ingredientId: text("ingredient_id").primaryKey().references(() => ingredients.ingredientId, {onDelete: "cascade"}),
  supplierItemName: text("supplier_item_name"),
  supplierName: text("supplier_name"),
  costPerUnit: numeric("cost_per_unit", {precision: 18, scale: 8}),
  packagePackCount: numeric("package_pack_count", {precision: 18, scale: 6}),
  packageInnerCount: numeric("package_inner_count", {precision: 18, scale: 6}),
  packageSizeQuantity: numeric("package_size_quantity", {precision: 18, scale: 6}),
  packageSizeUnit: text("package_size_unit"),
  packageBaseQuantity: numeric("package_base_quantity", {precision: 18, scale: 8}),
  packageBaseUnit: text("package_base_unit"),
  packageParseSource: text("package_parse_source"),
  cookingYieldPercent: numeric("cooking_yield_percent", {precision: 18, scale: 6}),
  shrinkagePercent: numeric("shrinkage_percent", {precision: 18, scale: 6}),
  rawWeightPerUnit: numeric("raw_weight_per_unit", {precision: 18, scale: 6}),
  cookedWeightPerUnit: numeric("cooked_weight_per_unit", {precision: 18, scale: 6}),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const ingredientNutritionProfiles = pgTable("ingredient_nutrition_profiles", {
  ingredientId: text("ingredient_id").primaryKey().references(() => ingredients.ingredientId, {onDelete: "cascade"}),
  caloriesPer100g: numeric("calories_per_100g", {precision: 18, scale: 6}),
  proteinPer100g: numeric("protein_per_100g", {precision: 18, scale: 6}),
  carbsPer100g: numeric("carbs_per_100g", {precision: 18, scale: 6}),
  fatPer100g: numeric("fat_per_100g", {precision: 18, scale: 6}),
  fiberPer100g: numeric("fiber_per_100g", {precision: 18, scale: 6}),
  sodiumPer100g: numeric("sodium_per_100g", {precision: 18, scale: 6}),
  sugarPer100g: numeric("sugar_per_100g", {precision: 18, scale: 6}),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const ingredientAllergenTags = pgTable("ingredient_allergen_tags", {
  ingredientAllergenId: text("ingredient_allergen_id").primaryKey(),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.ingredientId, {onDelete: "cascade"}),
  tag: text("tag").notNull(),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [
  uniqueIndex("idx_ingredient_allergen_tags_unique").on(t.ingredientId, sql`LOWER(BTRIM(${t.tag}))`).where(sql`COALESCE(BTRIM(${t.tag}), '') <> ''`),
  index("idx_ingredient_allergen_tags_ingredient").on(t.ingredientId),
]);

export const ingredientAliases = pgTable("ingredient_aliases", {
  ingredientAliasId: text("ingredient_alias_id").primaryKey(),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.ingredientId, {onDelete: "cascade"}),
  alias: text("alias").notNull(),
  aliasType: text("alias_type").notNull().default("alias"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [
  uniqueIndex("idx_ingredient_aliases_unique").on(t.ingredientId, t.aliasType, sql`LOWER(BTRIM(${t.alias}))`).where(sql`COALESCE(BTRIM(${t.alias}), '') <> ''`),
  index("idx_ingredient_aliases_search").using("gin", sql`LOWER(${t.alias}) gin_trgm_ops`),
]);

export const ingredientStockSummaries = pgTable("ingredient_stock_summaries", {
  ingredientId: text("ingredient_id").primaryKey().references(() => ingredients.ingredientId, {onDelete: "cascade"}),
  onHandQuantity: numeric("on_hand_quantity", {precision: 18, scale: 6}),
  reservedQuantity: numeric("reserved_quantity", {precision: 18, scale: 6}),
  availableQuantity: numeric("available_quantity", {precision: 18, scale: 6}),
  totalValue: numeric("total_value", {precision: 18, scale: 6}),
  siteCount: integer("site_count"),
  unit: text("unit"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
});

export const warehouseInventory = pgTable("warehouse_inventory", {
  inventoryId: text("inventory_id").primaryKey(),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.warehouseId, {onDelete: "restrict"}),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.ingredientId, {onDelete: "restrict"}),
  availableQuantity: numeric("available_quantity", {precision: 18, scale: 6}).notNull().default("0"),
  reservedQuantity: numeric("reserved_quantity", {precision: 18, scale: 6}).notNull().default("0"),
  onHandQuantity: numeric("on_hand_quantity", {precision: 18, scale: 6}).notNull().default("0"),
  averageUnitCost: numeric("average_unit_cost", {precision: 18, scale: 6}).notNull().default("0"),
  lastUnitCost: numeric("last_unit_cost", {precision: 18, scale: 6}).notNull().default("0"),
  stockUnit: text("stock_unit").notNull(),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("warehouse_inventory_warehouse_ingredient").on(t.warehouseId, t.ingredientId), index("idx_warehouse_inventory_ingredient").on(t.ingredientId)]);

export const inventoryLots = pgTable("inventory_lots", {
  lotId: text("lot_id").primaryKey(),
  inventoryId: text("inventory_id").notNull().references(() => warehouseInventory.inventoryId, {onDelete: "cascade"}),
  warehouseId: text("warehouse_id").notNull(),
  ingredientId: text("ingredient_id").notNull(),
  batchNumber: text("batch_number"),
  receivedDate: date("received_date"),
  stockDate: date("stock_date"),
  expiryDate: date("expiry_date"),
  originalQuantity: numeric("original_quantity", {precision: 18, scale: 6}).notNull().default("0"),
  remainingQuantity: numeric("remaining_quantity", {precision: 18, scale: 6}).notNull().default("0"),
  reservedQuantity: numeric("reserved_quantity", {precision: 18, scale: 6}).notNull().default("0"),
  unit: text("unit").notNull(),
  unitCost: numeric("unit_cost", {precision: 18, scale: 6}).notNull().default("0"),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [index("idx_inventory_lots_fifo").on(t.warehouseId, t.ingredientId, t.expiryDate, t.stockDate, t.lotId).where(sql`${t.status} NOT IN ('voided', 'closed')`)]);

export const recipes = pgTable("recipes", {
  recipeId: text("recipe_id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("idx_recipes_canonical_name_unique").on(sql`LOWER(BTRIM(${t.canonicalName}))`).where(sql`COALESCE(BTRIM(${t.canonicalName}), '') <> '' AND ${t.status} NOT IN ('archived', 'voided')`)]);

export const recipeVersions = pgTable("recipe_versions", {
  recipeVersionId: text("recipe_version_id").primaryKey(),
  recipeId: text("recipe_id").notNull().references(() => recipes.recipeId, {onDelete: "cascade"}),
  areaId: text("area_id").references(() => areas.areaId, {onDelete: "restrict"}),
  projectId: text("project_id").references(() => projects.projectId, {onDelete: "restrict"}),
  warehouseId: text("warehouse_id").references(() => warehouses.warehouseId, {onDelete: "restrict"}),
  recipeCode: text("recipe_code"),
  displayName: text("display_name").notNull(),
  versionLabel: text("version_label").notNull().default("v1"),
  cuisineType: text("cuisine_type"),
  menuCategory: text("menu_category"),
  recipeType: text("recipe_type").notNull().default("full"),
  costingMethod: text("costing_method").notNull().default("average_cost"),
  targetSellingPrice: numeric("target_selling_price", {precision: 18, scale: 6}),
  servings: numeric("servings", {precision: 18, scale: 6}).notNull().default("1"),
  servingSizeGrams: numeric("serving_size_grams", {precision: 18, scale: 6}),
  batchYield: numeric("batch_yield", {precision: 18, scale: 6}).notNull().default("1"),
  totalRecipeWeightGrams: numeric("total_recipe_weight_grams", {precision: 18, scale: 6}),
  totalCost: numeric("total_cost", {precision: 18, scale: 6}).notNull().default("0"),
  costPerServing: numeric("cost_per_serving", {precision: 18, scale: 6}).notNull().default("0"),
  costPer100g: numeric("cost_per_100g", {precision: 18, scale: 6}),
  marginPerServing: numeric("margin_per_serving", {precision: 18, scale: 6}),
  foodCostPercent: numeric("food_cost_percent", {precision: 18, scale: 6}),
  costingUpdatedAt: timestamp("costing_updated_at", {withTimezone: true}),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  instructions: text("instructions"),
  imageUrl: text("image_url"),
  caloriesPerServing: numeric("calories_per_serving", {precision: 18, scale: 6}),
  proteinPerServing: numeric("protein_per_serving", {precision: 18, scale: 6}),
  carbsPerServing: numeric("carbs_per_serving", {precision: 18, scale: 6}),
  fatPerServing: numeric("fat_per_serving", {precision: 18, scale: 6}),
  sodiumPerServing: numeric("sodium_per_serving", {precision: 18, scale: 6}),
  sugarPerServing: numeric("sugar_per_serving", {precision: 18, scale: 6}),
  totalCalories: numeric("total_calories", {precision: 18, scale: 6}),
  totalProtein: numeric("total_protein", {precision: 18, scale: 6}),
  totalCarbs: numeric("total_carbs", {precision: 18, scale: 6}),
  totalFat: numeric("total_fat", {precision: 18, scale: 6}),
  totalSodium: numeric("total_sodium", {precision: 18, scale: 6}),
  totalSugar: numeric("total_sugar", {precision: 18, scale: 6}),
  allergens: text("allergens").array().notNull().default(sql`ARRAY[]::text[]`),
  declaredAllergens: text("declared_allergens").array().notNull().default(sql`ARRAY[]::text[]`),
  legacyAllergens: text("legacy_allergens").array().notNull().default(sql`ARRAY[]::text[]`),
  nutritionComplete: boolean("nutrition_complete").notNull().default(false),
  allergensComplete: boolean("allergens_complete").notNull().default(false),
  nutritionCalculationVersion: integer("nutrition_calculation_version").notNull().default(1),
  status: text("status").notNull().default("active"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [
  uniqueIndex("idx_recipe_versions_scope_code_unique").on(sql`COALESCE(${t.warehouseId}, ${t.projectId}, ${t.areaId}, '__APP__')`, sql`LOWER(BTRIM(${t.recipeCode}))`).where(sql`COALESCE(BTRIM(${t.recipeCode}), '') <> '' AND ${t.status} NOT IN ('archived', 'voided')`),
  uniqueIndex("idx_recipe_versions_scope_name_unique").on(sql`COALESCE(${t.warehouseId}, ${t.projectId}, ${t.areaId}, '__APP__')`, sql`LOWER(BTRIM(${t.displayName}))`).where(sql`COALESCE(BTRIM(${t.displayName}), '') <> '' AND ${t.status} NOT IN ('archived', 'voided')`),
  index("idx_recipe_versions_recipe").on(t.recipeId),
]);

export const recipeIngredientLines = pgTable("recipe_ingredient_lines", {
  recipeLineId: text("recipe_line_id").primaryKey(),
  recipeVersionId: text("recipe_version_id").notNull().references(() => recipeVersions.recipeVersionId, {onDelete: "cascade"}),
  ingredientId: text("ingredient_id").notNull().references(() => ingredients.ingredientId, {onDelete: "restrict"}),
  lineNumber: integer("line_number").notNull().default(0),
  quantity: numeric("quantity", {precision: 18, scale: 6}).notNull(),
  unit: text("unit").notNull(),
  convertedQuantity: numeric("converted_quantity", {precision: 18, scale: 6}),
  convertedUnit: text("converted_unit"),
  rawWeightGrams: numeric("raw_weight_grams", {precision: 18, scale: 6}),
  weightPerUnitGrams: numeric("weight_per_unit_grams", {precision: 18, scale: 6}),
  weightUnit: text("weight_unit"),
  weightIngredientId: text("weight_ingredient_id"),
  weightDefinedBy: text("weight_defined_by"),
  weightDefinedAt: timestamp("weight_defined_at", {withTimezone: true}),
  exemptProcessingAid: boolean("exempt_processing_aid").notNull().default(false),
  prepExemptPercent: numeric("prep_exempt_percent", {precision: 8, scale: 4}),
  yieldPercent: numeric("yield_percent", {precision: 8, scale: 4}).notNull().default("100"),
  yieldedWeightGrams: numeric("yielded_weight_grams", {precision: 18, scale: 6}),
  cost: numeric("cost", {precision: 18, scale: 6}).notNull().default("0"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("recipe_ingredient_lines_version_line_ingredient").on(t.recipeVersionId, t.lineNumber, t.ingredientId), index("idx_recipe_ingredient_lines_ingredient").on(t.ingredientId)]);

export const menuPlans = pgTable("menu_plans", {
  menuPlanId: text("menu_plan_id").primaryKey(),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.warehouseId, {onDelete: "restrict"}),
  planDate: date("plan_date").notNull(),
  mealPeriod: text("meal_period").notNull(),
  menuType: text("menu_type").notNull(),
  menuCategory: text("menu_category").notNull(),
  status: text("status").notNull().default("planned"),
  sourceName: text("source_name"),
  createdBy: text("created_by").references(() => users.id, {onDelete: "set null"}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [uniqueIndex("idx_menu_plans_scope_unique").on(t.warehouseId, t.planDate, sql`LOWER(BTRIM(${t.mealPeriod}))`, sql`LOWER(BTRIM(${t.menuType}))`, sql`LOWER(BTRIM(${t.menuCategory}))`).where(sql`${t.status} NOT IN ('cancelled', 'voided', 'archived')`)]);

export const menuPlanLines = pgTable("menu_plan_lines", {
  menuPlanLineId: text("menu_plan_line_id").primaryKey(),
  menuPlanId: text("menu_plan_id").notNull().references(() => menuPlans.menuPlanId, {onDelete: "cascade"}),
  lineNumber: integer("line_number").notNull().default(0),
  lineType: text("line_type").notNull().default("recipe"),
  mealPeriod: text("meal_period"),
  recipeVersionId: text("recipe_version_id").references(() => recipeVersions.recipeVersionId, {onDelete: "restrict"}),
  ingredientId: text("ingredient_id").references(() => ingredients.ingredientId, {onDelete: "restrict"}),
  itemName: text("item_name").notNull(),
  plannedServings: numeric("planned_servings", {precision: 18, scale: 6}),
  plannedQuantity: numeric("planned_quantity", {precision: 18, scale: 6}),
  plannedQuantityUnit: text("planned_quantity_unit"),
  plannedWeightGrams: numeric("planned_weight_grams", {precision: 18, scale: 6}),
  plannedUnit: text("planned_unit"),
  estimatedCost: numeric("estimated_cost", {precision: 18, scale: 6}).notNull().default("0"),
  status: text("status").notNull().default("planned"),
  sourceName: text("source_name"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
}, t => [index("idx_menu_plan_lines_plan").on(t.menuPlanId, t.lineNumber)]);
