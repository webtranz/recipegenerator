import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';

class Statement {
 constructor(database,query,parameters=[]){this.database=database;this.query=query;this.parameters=parameters;}
 bind(...parameters){return new Statement(this.database,this.query,parameters);}
 async first(column){const row=this.database.prepare(this.query).get(...this.parameters);return row?(column?row[column]:row):null;}
 async all(){return {success:true,results:this.database.prepare(this.query).all(...this.parameters)};}
 runSync(){const result=this.database.prepare(this.query).run(...this.parameters);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
 async run(){return this.runSync();}
}

export function createDatabase(filename,migrationsDirectory){
 mkdirSync(dirname(resolve(filename)),{recursive:true});
 const sqlite=new DatabaseSync(filename,{timeout:5000});
 try{
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS studio_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
  // Lock before reading applied versions, so two startups cannot apply the same
  // migration. A failed migration rolls back and prevents the server starting.
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   for(const file of readdirSync(migrationsDirectory).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
    const sql=readFileSync(resolve(migrationsDirectory,file),'utf8').replace(/\r\n/g,'\n');
    const checksum=createHash('sha256').update(sql).digest('hex');
    const applied=sqlite.prepare('SELECT checksum FROM studio_migrations WHERE name=?').get(file);
    if(applied){if(applied.checksum!==checksum)throw new Error('Applied migration was modified: '+file);continue;}
    sqlite.exec(sql);
    sqlite.prepare('INSERT INTO studio_migrations VALUES (?,?,?)').run(file,checksum,new Date().toISOString());
   }
   sqlite.exec('COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');throw error;}
 }catch(error){sqlite.close();throw error;}
 return {
  prepare(query){return new Statement(sqlite,query);},
  async batch(statements){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const results=statements.map(statement=>statement.runSync());sqlite.exec('COMMIT');return results;}
   catch(error){sqlite.exec('ROLLBACK');throw error;}
  },
  close(){sqlite.close();},
 };
}
let connection;
export function openDatabase(filename,migrationsDirectory){return connection??=createDatabase(filename,migrationsDirectory);}
