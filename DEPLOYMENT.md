# Docker deployment

Recipe Studio runs on Node.js 24 with PostgreSQL. The Docker image includes the production application and applies the FoodProLive-compatible relational migrations before starting.

## Dokploy settings

- Repository: `webtranz/recipegenerator`, branch `main`.
- Build type: **Dockerfile**. Build context: repository root (`.`). Dockerfile: `Dockerfile`.
- Container port: **3000**. Route your application domain to this port.
- Required environment:
  - `APP_ORIGIN=https://your-recipe-domain.example`
  - `DATABASE_URL=postgres://user:password@host:5432/database`
- Optional environment: `PGSSLMODE=require` when the PostgreSQL provider requires TLS.
- Optional seed admin environment: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_NAME`. Store the password as a deployment secret, not in Git.

Deploy, open the application URL, and select **Create first Admin**. Admins manage projects and users; Chefs can create recipes and menus only within their assigned project/warehouse.

## Local Docker Compose

Set `APP_ORIGIN` and `DATABASE_URL` in a local `.env` file, then run:

```sh
docker compose up --build -d
```

The provided Compose file binds port 3000 to loopback. For public hosting, use a reverse proxy and set `APP_ORIGIN` to the exact public HTTPS origin.

## Verification and development

To run the same production application without Docker, install Node.js 24 and run:

```sh
npm ci
npm run build:node
export APP_ORIGIN=http://localhost:3000
export DATABASE_URL=postgres://user:password@localhost:5432/recipe_studio
npm run start:node
```

Run `node scripts/verify-access.mjs` for a static relational-schema check. Run `scripts/verify-api.mjs` against an isolated local instance using `TEST_ORIGIN`; it creates test users and projects and must not target production.
