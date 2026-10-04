# Recipe Studio

Inventory-linked recipe and menu generation with Food Pro CSV exports.

## Features

- Import real inventory CSV files with item codes, exact names, units, costs, categories, and allergens.
- Store inventory, ingredients, recipes, menus, locations/projects, users, roles, and permissions in normalized PostgreSQL tables copied from the matching FoodProLive schema.
- Generate editable recipes from built-in patterns or create recipes from scratch.
- Scale batch quantities while retaining source quantities and original serving counts in the app flow.
- Build menus, calculate ingredient cost and contribution margins, and export Food Pro CSV files.
- Enforce project access on all API requests. In this smaller app, the project selector maps to FoodProLive `warehouses`, under the FoodProLive `areas -> projects -> warehouses` hierarchy.

## Administration

The application has two app roles: **Admin** and **Chef**. They are stored in FoodProLive-compatible `users`, `user_site_access`, `role_profiles`, and `role_profile_permissions` tables. Admins manage projects, users, and inventory. Chefs are assigned to one project/warehouse and can create recipes and menus there.

Users sign in with a username and password. The username is stored in the FoodProLive `users.email` field for compatibility. Password hashes are stored on `users.password_hash`, temporary-password state is stored with `users.temporary_password`, and sessions are stored in `auth_tokens`.

## Database

The active schema is PostgreSQL only. The migration is [postgres/0001_foodprolive_subset.sql](/Users/abutt/Documents/Codex/recipegenerator/postgres/0001_foodprolive_subset.sql). It intentionally removes the old D1/SQLite JSON record model and does not create `records`, `locations`, `credentials`, `sessions`, or `login_attempts` tables.

Copied FoodProLive relational tables:

- Core access: `users`, `user_site_access`, `auth_tokens`, `role_profiles`, `role_profile_permissions`
- Locations/projects: `areas`, `projects`, `warehouses`
- Inventory/ingredients: `food_categories`, `ingredients`, `ingredient_unit_conversions`, `ingredient_details`, `ingredient_nutrition_profiles`, `ingredient_allergen_tags`, `ingredient_aliases`, `ingredient_stock_summaries`, `warehouse_inventory`, `inventory_lots`
- Recipes: `recipes`, `recipe_versions`, `recipe_ingredient_lines`
- Menus: `menu_plans`, `menu_plan_lines`

FoodProLive has many additional modules, such as budgets, uploads, procurement, production events, suppliers, and broader operational documents. They are not copied here because Recipe Studio does not currently have matching screens or flows for them.

## Current scope

Recipe generation is pattern-based, not powered by an AI service. The app produces CSV downloads; it does not connect directly to Food Pro. Recipe ingredients must be mapped to inventory before saving because FoodProLive’s `recipe_ingredient_lines` requires a real `ingredient_id`. Costs use SAR and exclude tax, labour, packaging, and overhead. Kitchen teams must review recipes, allergens, and finished yields before production.

## Development

Requires Node.js 22.13 or later, npm, and PostgreSQL.

```sh
npm run install:ci
export DATABASE_URL="postgres://user:password@host:5432/database"
npm run build:node
npm run start:node
```

The Node runtime applies `postgres/*.sql` migrations at startup. For Docker, set `APP_ORIGIN` and `DATABASE_URL`. To seed an admin account during startup, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and optionally `SEED_ADMIN_NAME`; the password is hashed before storage and should be supplied only as a deployment secret.

## Verification

```sh
npx tsc --noEmit
node scripts/verify-food.mjs
node scripts/verify-access.mjs
```

With the local development server running, `node scripts/verify-api.mjs` exercises the API against the configured PostgreSQL database. Use an isolated database because it creates test users, projects, inventory, recipes, and menus.

## Main files

- [app/studio.tsx](/Users/abutt/Documents/Codex/recipegenerator/app/studio.tsx): application screens and interactions
- [app/api/data/route.ts](/Users/abutt/Documents/Codex/recipegenerator/app/api/data/route.ts): authenticated persistence endpoints
- [lib/data-service.ts](/Users/abutt/Documents/Codex/recipegenerator/lib/data-service.ts): normalized inventory, recipe, and menu persistence
- [lib/access.ts](/Users/abutt/Documents/Codex/recipegenerator/lib/access.ts): users, roles, and project/warehouse access
- [db/schema.ts](/Users/abutt/Documents/Codex/recipegenerator/db/schema.ts) and [postgres/](/Users/abutt/Documents/Codex/recipegenerator/postgres): database schema and migration
