# Recipe Studio

Inventory-linked recipe and menu generation with Food Pro CSV exports.

## Features

- Import real inventory CSV files with item codes, exact names, units, costs, and allergen declarations.
- Generate editable recipes from eight built-in patterns or create recipes from scratch.
- Scale batch quantities while retaining source quantities and original serving counts.
- Match exact inventory names automatically or select an inventory item manually. Unmatched ingredients retain blank codes.
- Save recipes, inventory, and menus in Cloudflare D1, scoped to the authenticated user.
- Build menus, calculate ingredient cost and contribution margins, and classify dishes when sales data is available.
- Export `recipes.csv` with the specified Food Pro headers and JSON cells.
- Export `missing-ingredients-to-add-first.csv` for unmatched ingredients.
- Load a menu CSV template and map its headers to menu fields.

## Current scope

Recipe generation is pattern-based, not powered by an AI service. The app produces CSV downloads; it does not connect directly to Food Pro. Recipe exports use `sub_recipes: []`. Final menu import compatibility depends on the supplied destination template. Costs use SAR and exclude tax, labour, packaging, and overhead. Kitchen teams must review recipes, allergens, and finished yields before production.

## Development

Requires Node.js 22.13 or later and npm. The app uses React, Vinext, and Cloudflare Workers.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_old_namora.sql
npm run dev
```

Apply the migration once to a fresh local database. Use the preview URL printed by the development server. Local preview supplies a development sign-in flow; production uses the Sites authentication boundary. Do not expose the development server publicly.

The `.openai/hosting.json` manifest identifies the existing private Sites deployment and its logical D1 binding. GitHub hosts the source code; pushing here does not automatically deploy the app. Runtime data, dependencies, credentials, and build output are excluded from Git.

## Verification

```sh
npx tsc --noEmit
node scripts/verify-food.mjs
```

With the local development server running at `http://127.0.0.1:5173`:

```sh
node scripts/verify-api.mjs
```

The API verification creates and removes only its own `QA-*` records in the local preview database.

## Main files

- `app/studio.tsx`: application screens and interactions
- `app/studio.css`: responsive interface styling
- `app/api/data/route.ts`: authenticated persistence endpoints
- `lib/food.ts`: recipe patterns, mapping, costing, CSV parsing and export
- `db/schema.ts` and `drizzle/`: database schema and migrations
