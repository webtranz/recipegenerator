import {openDatabase} from '../runtime/postgres.mjs';
export const env={
 get DB(){return openDatabase({connectionString:process.env.DATABASE_URL,migrationsDirectory:process.env.MIGRATIONS_DIR||'./postgres'}) as unknown as D1Database;},
 get STUDIO_OWNER_EMAIL(){return process.env.STUDIO_OWNER_EMAIL;},
 get APP_ORIGIN(){return process.env.APP_ORIGIN;},
 // Only enable when the reverse proxy overwrites this header and the container
 // cannot be reached directly. Otherwise use a conservative shared limit.
 get STUDIO_CLIENT_IP_HEADER(){return process.env.STUDIO_CLIENT_IP_HEADER;},
 STUDIO_RUNTIME:'node',
};
