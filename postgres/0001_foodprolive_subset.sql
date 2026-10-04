CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  site_id TEXT,
  site_name TEXT,
  phone TEXT,
  language TEXT,
  avatar_url TEXT,
  visibility_scope TEXT,
  deactivated_at TIMESTAMPTZ,
  deactivated_by TEXT,
  deactivation_reason TEXT,
  password_hash TEXT NOT NULL,
  temporary_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_site_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  site_name TEXT,
  access_scope TEXT NOT NULL DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_user_site_access_site
  ON user_site_access(site_id, user_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS role_profiles (
  id TEXT PRIMARY KEY,
  role_key TEXT,
  name TEXT,
  description TEXT,
  access_level TEXT NOT NULL DEFAULT 'user',
  dashboard_variant TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_profiles_role_key_unique
  ON role_profiles(LOWER(BTRIM(role_key)))
  WHERE COALESCE(BTRIM(role_key), '') <> '';

CREATE TABLE IF NOT EXISTS role_profile_permissions (
  role_profile_id TEXT NOT NULL REFERENCES role_profiles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_profile_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_profile_permissions_permission
  ON role_profile_permissions(permission_key, role_profile_id);

CREATE TABLE IF NOT EXISTS food_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#10b981',
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_categories_status_name
  ON food_categories(status, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_food_categories_code_lookup
  ON food_categories(LOWER(BTRIM(code)))
  WHERE COALESCE(BTRIM(code), '') <> '';

CREATE TABLE IF NOT EXISTS areas (
  area_id TEXT PRIMARY KEY,
  area_code TEXT,
  name TEXT NOT NULL,
  legacy_site_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_areas_area_code_unique
  ON areas (LOWER(BTRIM(area_code)))
  WHERE COALESCE(BTRIM(area_code), '') <> '';

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(area_id) ON DELETE RESTRICT,
  project_code TEXT,
  name TEXT NOT NULL,
  legacy_site_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code_unique
  ON projects (LOWER(BTRIM(project_code)))
  WHERE COALESCE(BTRIM(project_code), '') <> '';

CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area_id);

CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  warehouse_code TEXT,
  d365_warehouse_id TEXT,
  name TEXT NOT NULL,
  legacy_site_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_warehouse_code_unique
  ON warehouses (LOWER(BTRIM(warehouse_code)))
  WHERE COALESCE(BTRIM(warehouse_code), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_d365_unique
  ON warehouses (LOWER(BTRIM(d365_warehouse_id)))
  WHERE COALESCE(BTRIM(d365_warehouse_id), '') <> '';

CREATE INDEX IF NOT EXISTS idx_warehouses_project ON warehouses(project_id);

CREATE TABLE IF NOT EXISTS ingredients (
  ingredient_id TEXT PRIMARY KEY,
  item_code TEXT NOT NULL,
  ingredient_code TEXT,
  sku TEXT,
  d365_item_id TEXT,
  name TEXT NOT NULL,
  base_unit TEXT NOT NULL,
  category_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_item_code_unique
  ON ingredients (LOWER(BTRIM(item_code)))
  WHERE COALESCE(BTRIM(item_code), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_ingredient_code_unique
  ON ingredients (LOWER(BTRIM(ingredient_code)))
  WHERE COALESCE(BTRIM(ingredient_code), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_sku_unique
  ON ingredients (LOWER(BTRIM(sku)))
  WHERE COALESCE(BTRIM(sku), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_d365_unique
  ON ingredients (LOWER(BTRIM(d365_item_id)))
  WHERE COALESCE(BTRIM(d365_item_id), '') <> '';

CREATE INDEX IF NOT EXISTS idx_ingredients_name_search
  ON ingredients USING gin (LOWER(name) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS ingredient_unit_conversions (
  conversion_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  factor NUMERIC(18, 8) NOT NULL CHECK (factor > 0),
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ingredient_id, from_unit, to_unit)
);

CREATE TABLE IF NOT EXISTS ingredient_details (
  ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  supplier_item_name TEXT,
  supplier_name TEXT,
  cost_per_unit NUMERIC(18, 8),
  package_pack_count NUMERIC(18, 6),
  package_inner_count NUMERIC(18, 6),
  package_size_quantity NUMERIC(18, 6),
  package_size_unit TEXT,
  package_base_quantity NUMERIC(18, 8),
  package_base_unit TEXT,
  package_parse_source TEXT,
  cooking_yield_percent NUMERIC(18, 6),
  shrinkage_percent NUMERIC(18, 6),
  raw_weight_per_unit NUMERIC(18, 6),
  cooked_weight_per_unit NUMERIC(18, 6),
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredient_nutrition_profiles (
  ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  calories_per_100g NUMERIC(18, 6),
  protein_per_100g NUMERIC(18, 6),
  carbs_per_100g NUMERIC(18, 6),
  fat_per_100g NUMERIC(18, 6),
  fiber_per_100g NUMERIC(18, 6),
  sodium_per_100g NUMERIC(18, 6),
  sugar_per_100g NUMERIC(18, 6),
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredient_allergen_tags (
  ingredient_allergen_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_allergen_tags_unique
  ON ingredient_allergen_tags (ingredient_id, LOWER(BTRIM(tag)))
  WHERE COALESCE(BTRIM(tag), '') <> '';

CREATE INDEX IF NOT EXISTS idx_ingredient_allergen_tags_ingredient
  ON ingredient_allergen_tags (ingredient_id);

CREATE TABLE IF NOT EXISTS ingredient_aliases (
  ingredient_alias_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'alias',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_aliases_unique
  ON ingredient_aliases (ingredient_id, alias_type, LOWER(BTRIM(alias)))
  WHERE COALESCE(BTRIM(alias), '') <> '';

CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_search
  ON ingredient_aliases USING gin (LOWER(alias) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS ingredient_stock_summaries (
  ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  on_hand_quantity NUMERIC(18, 6),
  reserved_quantity NUMERIC(18, 6),
  available_quantity NUMERIC(18, 6),
  total_value NUMERIC(18, 6),
  site_count INTEGER,
  unit TEXT,
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_inventory (
  inventory_id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE RESTRICT,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  available_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  on_hand_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  average_unit_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
  last_unit_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
  stock_unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_ingredient
  ON warehouse_inventory(ingredient_id);

CREATE TABLE IF NOT EXISTS inventory_lots (
  lot_id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL REFERENCES warehouse_inventory(inventory_id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  batch_number TEXT,
  received_date DATE,
  stock_date DATE,
  expiry_date DATE,
  original_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  remaining_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  unit_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (warehouse_id, ingredient_id)
    REFERENCES warehouse_inventory(warehouse_id, ingredient_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo
  ON inventory_lots(warehouse_id, ingredient_id, expiry_date, stock_date, lot_id)
  WHERE status NOT IN ('voided', 'closed');

CREATE TABLE IF NOT EXISTS recipes (
  recipe_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_canonical_name_unique
  ON recipes (LOWER(BTRIM(canonical_name)))
  WHERE COALESCE(BTRIM(canonical_name), '') <> ''
    AND status NOT IN ('archived', 'voided');

CREATE TABLE IF NOT EXISTS recipe_versions (
  recipe_version_id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
  area_id TEXT REFERENCES areas(area_id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES projects(project_id) ON DELETE RESTRICT,
  warehouse_id TEXT REFERENCES warehouses(warehouse_id) ON DELETE RESTRICT,
  recipe_code TEXT,
  display_name TEXT NOT NULL,
  version_label TEXT NOT NULL DEFAULT 'v1',
  cuisine_type TEXT,
  menu_category TEXT,
  recipe_type TEXT NOT NULL DEFAULT 'full',
  costing_method TEXT NOT NULL DEFAULT 'average_cost',
  target_selling_price NUMERIC(18, 6),
  servings NUMERIC(18, 6) NOT NULL DEFAULT 1,
  serving_size_grams NUMERIC(18, 6),
  batch_yield NUMERIC(18, 6) NOT NULL DEFAULT 1,
  total_recipe_weight_grams NUMERIC(18, 6),
  total_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
  cost_per_serving NUMERIC(18, 6) NOT NULL DEFAULT 0,
  cost_per_100g NUMERIC(18, 6),
  margin_per_serving NUMERIC(18, 6),
  food_cost_percent NUMERIC(18, 6),
  costing_updated_at TIMESTAMPTZ,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  instructions TEXT,
  image_url TEXT,
  calories_per_serving NUMERIC(18, 6),
  protein_per_serving NUMERIC(18, 6),
  carbs_per_serving NUMERIC(18, 6),
  fat_per_serving NUMERIC(18, 6),
  sodium_per_serving NUMERIC(18, 6),
  sugar_per_serving NUMERIC(18, 6),
  total_calories NUMERIC(18, 6),
  total_protein NUMERIC(18, 6),
  total_carbs NUMERIC(18, 6),
  total_fat NUMERIC(18, 6),
  total_sodium NUMERIC(18, 6),
  total_sugar NUMERIC(18, 6),
  allergens TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  declared_allergens TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  legacy_allergens TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  nutrition_complete BOOLEAN NOT NULL DEFAULT FALSE,
  allergens_complete BOOLEAN NOT NULL DEFAULT FALSE,
  nutrition_calculation_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (warehouse_id IS NOT NULL AND project_id IS NULL AND area_id IS NULL)
    OR (warehouse_id IS NULL AND project_id IS NOT NULL AND area_id IS NULL)
    OR (warehouse_id IS NULL AND project_id IS NULL AND area_id IS NOT NULL)
    OR (warehouse_id IS NULL AND project_id IS NULL AND area_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_versions_scope_code_unique
  ON recipe_versions (
    COALESCE(warehouse_id, project_id, area_id, '__APP__'),
    LOWER(BTRIM(recipe_code))
  )
  WHERE COALESCE(BTRIM(recipe_code), '') <> ''
    AND status NOT IN ('archived', 'voided');

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_versions_scope_name_unique
  ON recipe_versions (
    COALESCE(warehouse_id, project_id, area_id, '__APP__'),
    LOWER(BTRIM(display_name))
  )
  WHERE COALESCE(BTRIM(display_name), '') <> ''
    AND status NOT IN ('archived', 'voided');

CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe
  ON recipe_versions(recipe_id);

CREATE TABLE IF NOT EXISTS recipe_ingredient_lines (
  recipe_line_id TEXT PRIMARY KEY,
  recipe_version_id TEXT NOT NULL REFERENCES recipe_versions(recipe_version_id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL DEFAULT 0,
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  converted_quantity NUMERIC(18, 6),
  converted_unit TEXT,
  raw_weight_grams NUMERIC(18, 6),
  weight_per_unit_grams NUMERIC(18, 6),
  weight_unit TEXT,
  weight_ingredient_id TEXT,
  weight_defined_by TEXT,
  weight_defined_at TIMESTAMPTZ,
  exempt_processing_aid BOOLEAN NOT NULL DEFAULT FALSE,
  prep_exempt_percent NUMERIC(8, 4),
  yield_percent NUMERIC(8, 4) NOT NULL DEFAULT 100 CHECK (yield_percent >= 0),
  yielded_weight_grams NUMERIC(18, 6),
  cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_version_id, line_number, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_lines_ingredient
  ON recipe_ingredient_lines(ingredient_id);

CREATE TABLE IF NOT EXISTS menu_plans (
  menu_plan_id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE RESTRICT,
  plan_date DATE NOT NULL,
  meal_period TEXT NOT NULL,
  menu_type TEXT NOT NULL,
  menu_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  source_name TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_plans_scope_unique
  ON menu_plans (
    warehouse_id,
    plan_date,
    LOWER(BTRIM(meal_period)),
    LOWER(BTRIM(menu_type)),
    LOWER(BTRIM(menu_category))
  )
  WHERE status NOT IN ('cancelled', 'voided', 'archived');

CREATE TABLE IF NOT EXISTS menu_plan_lines (
  menu_plan_line_id TEXT PRIMARY KEY,
  menu_plan_id TEXT NOT NULL REFERENCES menu_plans(menu_plan_id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL DEFAULT 0,
  line_type TEXT NOT NULL DEFAULT 'recipe' CHECK (line_type IN ('recipe', 'ingredient', 'manual')),
  meal_period TEXT,
  recipe_version_id TEXT REFERENCES recipe_versions(recipe_version_id) ON DELETE RESTRICT,
  ingredient_id TEXT REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  planned_servings NUMERIC(18, 6),
  planned_quantity NUMERIC(18, 6),
  planned_quantity_unit TEXT,
  planned_weight_grams NUMERIC(18, 6),
  planned_unit TEXT,
  estimated_cost NUMERIC(18, 6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  source_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    recipe_version_id IS NOT NULL
    OR ingredient_id IS NOT NULL
    OR COALESCE(BTRIM(item_name), '') <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_menu_plan_lines_plan
  ON menu_plan_lines(menu_plan_id, line_number);
