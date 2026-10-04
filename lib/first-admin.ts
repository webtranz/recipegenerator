import {z} from 'zod';
import {AccessError} from './access';
import {digestToken,hashPassword,usernameSchema} from './passwords';
type SetupConfig={hash?:string;expires?:string;ownerEmail?:string};
export async function firstAdminAvailable(db:D1Database,config:SetupConfig){
 if(!config.hash||!config.expires||!Number.isFinite(Number(config.expires))||Number(config.expires)<=Date.now())return false;
 return !await db.prepare("SELECT c.user_id FROM credentials c JOIN users u ON u.id=c.user_id WHERE u.role='admin' OR u.id='workspace-owner' LIMIT 1").first();
}
export async function createFirstAdmin(db:D1Database,config:SetupConfig,input:unknown){
 if(!await firstAdminAvailable(db,config))throw new AccessError('First Admin setup is complete or the setup key has expired.',409);
 const r=z.object({setup_key:z.string().trim().length(64),username:usernameSchema,name:z.string().trim().min(1).max(200),password:z.string().max(128)}).parse(input);
 const digest=await digestToken(r.setup_key);let mismatch=digest.length^(config.hash?.length||0);for(let i=0;i<digest.length;i++)mismatch|=digest.charCodeAt(i)^(config.hash?.charCodeAt(i)||0);
 if(mismatch)throw new AccessError('The setup key is invalid.',403);
 const passwordHash=await hashPassword(r.password);
 // All setup paths claim the same credential row. Its primary key makes concurrent
 // submissions fail atomically instead of replacing the first Admin's password.
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO users (id,email,name,role,active,updated) VALUES ('workspace-owner',?,?,'admin',1,?)").bind(config.ownerEmail||'setup-owner@local.invalid',r.name,new Date().toISOString()),
  db.prepare("INSERT INTO credentials (user_id,password_hash,must_change,version) VALUES ('workspace-owner',?,0,1)").bind(passwordHash),
  db.prepare("UPDATE users SET name=?,username=?,role='admin',active=1,project_id=NULL,updated=? WHERE id='workspace-owner'").bind(r.name,r.username,new Date().toISOString()),
 ]);
 return 'workspace-owner';
}
