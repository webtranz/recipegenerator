import {Pool} from 'pg';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

function connectionOptions(config={}){
 const connectionString=config.connectionString||process.env.DATABASE_URL;
 const sslMode=config.sslMode||process.env.PGSSLMODE;
 const ssl=sslMode&&!['disable','prefer'].includes(sslMode)?{rejectUnauthorized:sslMode==='verify-full'}:undefined;
 if(connectionString)return {connectionString,ssl,max:Number(config.maxConnections||process.env.PGPOOL_MAX||10)};
 const database=config.database||process.env.POSTGRES_DB||process.env.PGDATABASE;
 const host=config.host||process.env.POSTGRES_HOST||process.env.PGHOST;
 const user=config.user||process.env.POSTGRES_USER||process.env.PGUSER;
 const password=config.password||process.env.POSTGRES_PASSWORD||process.env.PGPASSWORD;
 const port=Number(config.port||process.env.POSTGRES_PORT||process.env.PGPORT||5432);
 if(!database||!host||!user)throw new Error('PostgreSQL is not configured. Set DATABASE_URL or POSTGRES_HOST, POSTGRES_DB, and POSTGRES_USER.');
 return {database,host,user,password,port,ssl,max:Number(config.maxConnections||process.env.PGPOOL_MAX||10)};
}

function convertPlaceholders(query){
 let out='',index=0,single=false,double=false,line=false,block=false,dollar='';
 for(let i=0;i<query.length;i++){
  const c=query[i],n=query[i+1]||'';
  if(line){out+=c;if(c==='\n')line=false;continue;}
  if(block){out+=c;if(c==='*'&&n==='/'){out+=n;i++;block=false;}continue;}
  if(dollar){out+=c;if(query.startsWith(dollar,i)){out+=dollar.slice(1);i+=dollar.length-1;dollar='';}continue;}
  if(single){out+=c;if(c==="'"&&n==="'"){out+=n;i++;}else if(c==="'")single=false;continue;}
  if(double){out+=c;if(c==='"')double=false;continue;}
  if(c==='-'&&n==='-'){out+=c+n;i++;line=true;continue;}
  if(c==='/'&&n==='*'){out+=c+n;i++;block=true;continue;}
  if(c==="'"){out+=c;single=true;continue;}
  if(c==='"'){out+=c;double=true;continue;}
  if(c==='$'){
   const match=query.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
   if(match){dollar=match[0];out+=dollar;i+=dollar.length-1;continue;}
  }
  if(c==='?'){out+='$'+(++index);continue;}
  out+=c;
 }
 return out;
}

class Statement{
 constructor(database,query,parameters=[]){this.database=database;this.query=query;this.parameters=parameters;}
 bind(...parameters){return new Statement(this.database,this.query,parameters);}
 async execute(executor){await this.database.ready;return executor.query(convertPlaceholders(this.query),this.parameters);}
 async first(column){const result=await this.execute(this.database.pool);const row=result.rows[0];return row?(column?row[column]:row):null;}
 async all(){const result=await this.execute(this.database.pool);return {success:true,results:result.rows};}
 async run(){const result=await this.execute(this.database.pool);return {success:true,meta:{changes:result.rowCount??0}};}
 async runWith(client){const result=await client.query(convertPlaceholders(this.query),this.parameters);return {success:true,meta:{changes:result.rowCount??0}};}
}

class PostgresDatabase{
 constructor(config={}){this.config=config;this.pool=new Pool(connectionOptions(config));this.migrationsDirectory=config.migrationsDirectory||process.env.MIGRATIONS_DIR||'./postgres';this.ready=this.applyMigrations();}
 prepare(query){return new Statement(this,query);}
 async batch(statements){await this.ready;const client=await this.pool.connect();try{await client.query('BEGIN');const results=[];for(const statement of statements)results.push(await statement.runWith(client));await client.query('COMMIT');return results;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async applyMigrations(){const client=await this.pool.connect();try{
  await client.query('CREATE TABLE IF NOT EXISTS studio_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await client.query('BEGIN');
  for(const file of readdirSync(this.migrationsDirectory).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
   const sql=readFileSync(resolve(this.migrationsDirectory,file),'utf8').replace(/\r\n/g,'\n');
   const checksum=createHash('sha256').update(sql).digest('hex');
   const applied=await client.query('SELECT checksum FROM studio_migrations WHERE name=$1',[file]);
   if(applied.rows[0]){if(applied.rows[0].checksum!==checksum)throw new Error('Applied migration was modified: '+file);continue;}
   await client.query(sql);
   await client.query('INSERT INTO studio_migrations (name,checksum) VALUES ($1,$2)',[file,checksum]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}}
 async close(){await this.ready;await this.pool.end();}
}

let connection;
export function openDatabase(config={}){return connection??=new PostgresDatabase(config);}
export async function createDatabase(config={}){const db=openDatabase(config);await db.ready;return db;}
