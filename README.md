# Recipe Studio

Inventory-linked recipe and menu generation with Food Pro CSV exports.

## Features

- Import real inventory CSV files with item codes, exact names, units, costs, and allergen declarations.
- Generate editable recipes from eight built-in patterns or create recipes from scratch.
- Scale batch quantities while retaining source quantities and original serving counts.
- Match exact inventory names automatically or select an inventory item manually. Unmatched ingredients retain blank codes.
- Save recipes, inventory, and menus in Cloudflare D1, shared within each project, with server-enforced project access.
- Build menus, calculate ingredient cost and contribution margins, and classify dishes when sales data is available.
- Export `recipes.csv` with the specified Food Pro headers and JSON cells.
- Export `missing-ingredients-to-add-first.csv` for unmatched ingredients.
- Load a menu CSV template and map its headers to menu fields.

## Administration

The application has Projects only and exactly two roles: **Admin** and **Chef**. Admins manage every project, user, and inventory item. Each Chef is assigned to exactly one project and can create, edit, and delete that project's recipes and menus, view inventory, and export files. All API requests enforce these permissions. The previous area/site/store setup screens are removed.

Users sign in with a username and password. Admins create accounts and issue temporary passwords; users must replace them before accessing data. Passwords use scrypt (N=32768, r=8, p=3), random salts, and 15–128-character passphrases. Sessions use hashed random tokens and HttpOnly, SameSite=Strict cookies (Secure on HTTPS), expire after eight hours, and are invalidated after account or permission changes. Login attempts are throttled in D1. Password recovery is an admin-issued temporary password.

The existing owner completes one-time username/password setup using the trusted hosting identity and configured STUDIO_OWNER_EMAIL. No other account can bootstrap an admin. The hosted Site's outer audience policy is separate: while it remains private, visitors still encounter the platform sign-in gate. Enabling access without ChatGPT requires the owner to approve a publicly reachable app entry; all operational endpoints continue requiring app sessions.

Previous personal and site records remain preserved. Admins can move a preserved workspace into a project atomically; duplicate codes abort without overwriting any records. Legacy non-Admin/non-Chef roles are deactivated for admin review. Food Pro CSV headers remain unchanged. Projects may have an optional real Food Pro scope ID/name; otherwise exports use site_scope=all. These export fields do not control app authorization.

## Current scope

Recipe generation is pattern-based, not powered by an AI service. The app produces CSV downloads; it does not connect directly to Food Pro. Recipe exports use `sub_recipes: []`. Final menu import compatibility depends on the supplied destination template. Costs use SAR and exclude tax, labour, packaging, and overhead. Kitchen teams must review recipes, allergens, and finished yields before production.

## Development

Requires Node.js 22.13 or later and npm. The app uses React, Vinext, and Cloudflare Workers.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_old_namora.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_special_gladiator.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_spotty_jubilee.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_free_jazinda.sql
npm run dev
```

Apply each migration once, in order, to a fresh local database. For local preview, create an ignored .dev.vars file containing STUDIO_OWNER_EMAIL="seedy@sites.test". Use the preview URL printed by the development server. Local preview supplies a development sign-in flow; production uses the Sites authentication boundary. Do not expose the development server publicly.

The `.openai/hosting.json` manifest identifies the existing private Sites deployment and its logical D1 binding. GitHub hosts the source code; pushing here does not automatically deploy the app. Runtime data, dependencies, credentials, and build output are excluded from Git.

## Verification

```sh
npx tsc --noEmit
node scripts/verify-food.mjs
node scripts/verify-access.mjs
```

With the local development server running at `http://127.0.0.1:5173`:

```sh
node scripts/verify-api.mjs
```

The API verification creates and removes its own operational records and deactivates its QA projects and chef account in the local preview database. It initializes a local-qa-owner with a test-only password if owner setup is available; use LOCAL_TEST_PASSWORD for an existing test account. It never targets production.

## Main files

- `app/studio.tsx`: application screens and interactions
- `app/studio.css`: responsive interface styling
- `app/api/data/route.ts`: authenticated persistence endpoints
- `lib/food.ts`: recipe patterns, mapping, costing, CSV parsing and export
- `db/schema.ts` and `drizzle/`: database schema and migrations

