# Docker deployment

Recipe Studio runs on Node.js 24 with a persistent SQLite database. The Docker image includes the production application and applies database migrations before starting.

## Dokploy settings

- Repository: `webtranz/recipegenerator`, branch `main`.
- Build type: **Dockerfile**. Build context: repository root (`.`). Dockerfile: `Dockerfile`.
- Container port: **3000**. Route your application domain to this port.
- Environment: `APP_ORIGIN=https://your-recipe-domain.example` (replace with the actual application URL, not the Dokploy dashboard URL). Do not include a path.
- Persistent storage: mount a named volume, such as `recipe-studio-data`, at **`/data`**. Keep this volume when redeploying.
- Run **one replica**. SQLite storage must not be shared between multiple app instances.

Deploy, open the application URL, and select **Create first Admin**. No setup key or ChatGPT account is required. This registration closes after the first Admin is created. Admins manage projects and users; Chefs can create recipes and menus only within their assigned project.

This deployment starts with a new database. Existing data on the previously hosted Cloudflare Site is not automatically transferred.

## Local Docker Compose

Set `APP_ORIGIN=http://localhost:3000` in a local `.env` file, then run:

```sh
docker compose up --build -d
```

The provided Compose file binds port 3000 to loopback. For public hosting, use a reverse proxy and set `APP_ORIGIN` to the exact public HTTPS origin. This setting controls origin validation and secure session cookies behind the proxy. Never expose the internal port directly when relying on trusted proxy headers.

The default database is `/data/recipe-studio.sqlite`. Named volumes are recommended. If using a host-directory bind mount, give container user UID/GID `1000:1000` write permission. Back up the entire `/data` volume while the app is stopped, and retain it independently of containers. Do not copy only the SQLite file while the application is writing, because WAL files may contain recent changes.

The optional `STUDIO_CLIENT_IP_HEADER` setting enables per-client IP rate limits behind a trusted proxy (for example `x-real-ip`). Configure it only if the proxy overwrites that header and clients cannot bypass the proxy. Otherwise the app uses a shared IP limiter plus individual username limits.

## Verification and development

The unauthenticated `/api/health` endpoint checks database connectivity and returns no application data. Docker checks it automatically.

To run the same production application without Docker, install Node.js 24 and run:

```sh
npm ci
npm run build:node
# Set APP_ORIGIN=http://localhost:3000 in your shell before starting.
npm run start:node
```

Local storage defaults to `./data/recipe-studio.sqlite`. `DATABASE_PATH`, `MIGRATIONS_DIR`, `HOST`, and `PORT` can override defaults. The original `npm run build` command remains the Cloudflare build.

Run `node scripts/verify-sqlite.mjs` for persistence and transaction checks. Run `scripts/verify-api.mjs` against an isolated local instance using `TEST_ORIGIN`; it creates test users and projects and must not target production.
