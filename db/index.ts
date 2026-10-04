import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("PostgreSQL is unavailable. Set DATABASE_URL before using the database.");
  }
  pool ??= new Pool({ connectionString });
  return drizzle(pool, { schema });
}
