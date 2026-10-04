import {z} from 'zod';
import {AccessError} from './access';
import {hashPassword,usernameSchema} from './passwords';
type SetupConfig={ownerEmail?:string};
export async function firstAdminAvailable(db:D1Database){
 return !await db.prepare("SELECT id FROM users WHERE role='admin' OR id='workspace-owner' LIMIT 1").first();
}
export async function createFirstAdmin(db:D1Database,_config:SetupConfig,input:unknown){
 if(!await firstAdminAvailable(db))throw new AccessError('An Admin already exists. Sign in to manage users.',409);
 const r=z.object({username:usernameSchema,name:z.string().trim().min(1).max(200),password:z.string().max(128)}).parse(input);
 const passwordHash=await hashPassword(r.password),email=r.username.trim().toLowerCase();
 const row=await db.prepare("INSERT INTO users (id,email,full_name,role,status,password_hash,temporary_password,source_name,updated_at) VALUES ('workspace-owner',?,?,'admin','active',?,NULL,'recipegenerator',NOW()) ON CONFLICT (id) DO NOTHING RETURNING id").bind(email,r.name,passwordHash).first<{id:string}>();
 if(!row)throw new AccessError('An Admin already exists. Sign in to manage users.',409);
 return row.id;
}
