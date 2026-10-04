import {createDatabase} from './sqlite.mjs';
if(process.env.APP_ORIGIN){
 const origin=new URL(process.env.APP_ORIGIN);
 if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('APP_ORIGIN must be an http(s) origin without a path or credentials.');
 process.env.APP_ORIGIN=origin.origin;
}
process.env.HOST||='0.0.0.0';process.env.PORT||='3000';
process.env.DATABASE_PATH||='./data/recipe-studio.sqlite';
process.env.MIGRATIONS_DIR||='./drizzle';
createDatabase(process.env.DATABASE_PATH,process.env.MIGRATIONS_DIR).close();
await import(new URL(process.argv[2]||'../server.js',import.meta.url).href);
