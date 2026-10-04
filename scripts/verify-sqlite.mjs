import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {createDatabase} from '../runtime/sqlite.mjs';

mkdirSync('data',{recursive:true});
const directory=mkdtempSync(resolve('data','adapter-test-'));
let db;
try{
 const migrations=resolve(directory,'migrations');mkdirSync(migrations);
 writeFileSync(resolve(migrations,'0000.sql'),'CREATE TABLE values_test (id TEXT PRIMARY KEY, value TEXT);');
 const file=resolve(directory,'test.sqlite');db=createDatabase(file,migrations);
 await db.prepare('INSERT INTO values_test VALUES (?,?)').bind('saved','persistent').run();
 await assert.rejects(db.batch([
  db.prepare('INSERT INTO values_test VALUES (?,?)').bind('rollback','no'),
  db.prepare('INSERT INTO values_test VALUES (?,?)').bind('saved','duplicate'),
 ]));
 assert.equal(await db.prepare('SELECT * FROM values_test WHERE id=?').bind('rollback').first(),null);
 db.close();db=createDatabase(file,migrations);
 assert.equal(await db.prepare('SELECT value FROM values_test WHERE id=?').bind('saved').first('value'),'persistent');
 assert.equal((await db.prepare('SELECT * FROM studio_migrations').all()).results.length,1);
 db.close();db=null;
 writeFileSync(resolve(migrations,'0000.sql'),'SELECT 1;');
 assert.throws(()=>createDatabase(file,migrations),/Applied migration was modified/);
 // Exercise the real schema twice; startup must not rerun session-deleting migrations.
 const realFile=resolve(directory,'real.sqlite');db=createDatabase(realFile,resolve('drizzle'));
 await db.prepare('INSERT INTO login_attempts VALUES (?,?,?)').bind('persisted',3,123).run();
 const versions=(await db.prepare('SELECT * FROM studio_migrations').all()).results.length;
 db.close();db=createDatabase(realFile,resolve('drizzle'));
 assert.equal(await db.prepare('SELECT count FROM login_attempts WHERE key=?').bind('persisted').first('count'),3);
 assert.equal((await db.prepare('SELECT * FROM studio_migrations').all()).results.length,versions);
 console.log('Passed: SQLite persistence, real migrations, migration checksums, and atomic batch rollback.');
}finally{db?.close();rmSync(directory,{recursive:true,force:true});}
