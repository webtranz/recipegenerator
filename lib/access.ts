import {z} from 'zod';
import {ROLES,type Role} from './permissions';
import {usernameSchema,hashPassword} from './passwords';
export type Location={id:string;kind:'project';code:string;name:string;parent_id:null;active:number;updated:string;export_site_id:string|null;export_site_name:string|null};
export type Project=Location;
export type AppUser={id:string;email:string;name:string;auth_user_id:string|null;role:Role;username:string|null;project_id:string|null;has_password?:boolean;must_change?:boolean;active:number;updated:string};
export type WorkspaceContext={user:AppUser;projects:Project[];legacy_groups:{owner:string;name:string;count:number}[]};
export type Identity={id:string;email:string};
export class AccessError extends Error{status:number;constructor(message:string,status=403){super(message);this.status=status;}}
export const projectSchema=z.object({id:z.string().min(1).max(100),code:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(200),active:z.boolean(),export_site_id:z.string().trim().max(100).default(''),export_site_name:z.string().trim().max(200).default('')});
export const userSchema=z.object({id:z.string().min(1).max(100),username:usernameSchema,name:z.string().trim().min(1).max(200),role:z.enum(ROLES),active:z.boolean(),project_id:z.string().nullable(),password:z.string().max(128).optional()});
export function requireAdmin(user:AppUser){if(user.role!=='admin'||!user.active)throw new AccessError('Only admins can manage projects, inventory, and users.');}
export async function projects(db:D1Database){return (await db.prepare("SELECT * FROM locations WHERE kind='project' ORDER BY name").all<Project>()).results;}
export function exportScope(project:Project){return project.export_site_id?{site_scope:'specific' as const,site_ids:[project.export_site_id],site_names:[project.export_site_name||project.name]}:{site_scope:'all' as const,site_ids:[],site_names:[]};}
export async function loadUser(db:D1Database,id:string):Promise<AppUser>{
 const row=await db.prepare('SELECT u.*,CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END AS has_password,c.must_change FROM users u LEFT JOIN credentials c ON c.user_id=u.id WHERE u.id=?').bind(id).first<AppUser>();
 if(!row||!row.active||!ROLES.includes(row.role))throw new AccessError('Your account is inactive or unavailable.',401);return {...row,has_password:!!row.has_password,must_change:!!row.must_change};
}
// Used only for one-time owner setup at the trusted hosting boundary.
export async function authenticate(db:D1Database,identity:Identity|null,ownerEmail:string|undefined):Promise<AppUser>{
 if(!identity?.id||!identity.email||!ownerEmail||identity.email.trim().toLowerCase()!==ownerEmail.trim().toLowerCase())throw new AccessError('Use your username and password.',401);
 await db.prepare("INSERT OR IGNORE INTO users (id,email,name,auth_user_id,role,active,updated) VALUES ('workspace-owner',?,?,?,'admin',1,?)").bind(identity.email.trim().toLowerCase(),'Workspace owner',identity.id,new Date().toISOString()).run();
 const owner=await loadUser(db,'workspace-owner');if(owner.auth_user_id!==identity.id)throw new AccessError('This is a different owner account.');return owner;
}
export async function requireProject(db:D1Database,user:AppUser,id:string|null):Promise<Project>{
 if(!id)throw new AccessError('Select a project first.',400);
 const project=await db.prepare("SELECT * FROM locations WHERE kind='project' AND id=? AND active=1").bind(id).first<Project>();
 if(!project||!user.active||(user.role!=='admin'&&user.project_id!==id))throw new AccessError('You do not have access to this active project.');return project;
}
export async function legacyGroups(db:D1Database,user:AppUser){if(user.role!=='admin')return [];
 return (await db.prepare("SELECT r.owner,CASE WHEN l.name IS NOT NULL THEN l.name ELSE 'Previous personal workspace' END AS name,count(*) AS count FROM records r LEFT JOIN locations l ON r.owner='site:'||l.id WHERE (r.owner=? AND r.project_id='') OR (l.kind='site' AND r.project_id='') GROUP BY r.owner").bind(user.auth_user_id).all<{owner:string;name:string;count:number}>()).results;
}
export async function contextFor(db:D1Database,user:AppUser):Promise<WorkspaceContext>{return {user,projects:(await projects(db)).filter(p=>p.active&&(user.role==='admin'||user.project_id===p.id)),legacy_groups:await legacyGroups(db,user)};}
export async function saveProject(db:D1Database,user:AppUser,input:unknown){
 requireAdmin(user);const r=projectSchema.parse(input);
 if(!!r.export_site_id!==!!r.export_site_name)throw new AccessError('Provide both Food Pro scope ID and scope name, or leave both blank.',400);
 const existing=await db.prepare('SELECT kind FROM locations WHERE id=?').bind(r.id).first<{kind:string}>();if(existing&&existing.kind!=='project')throw new AccessError('That identifier is already in use.',409);
 await db.prepare("INSERT INTO locations (id,kind,code,name,parent_id,active,updated,export_site_id,export_site_name) VALUES (?,'project',?,?,NULL,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,parent_id=NULL,active=excluded.active,updated=excluded.updated,export_site_id=excluded.export_site_id,export_site_name=excluded.export_site_name").bind(r.id,r.code,r.name,r.active?1:0,new Date().toISOString(),r.export_site_id||null,r.export_site_name||null).run();
}
export async function saveUser(db:D1Database,actor:AppUser,input:unknown){
 requireAdmin(actor);const r=userSchema.parse(input),existing=await db.prepare('SELECT * FROM users WHERE id=?').bind(r.id).first<AppUser>();
 if((r.id==='workspace-owner'||r.id===actor.id)&&(!r.active||r.role!=='admin'))throw new AccessError('The owner and your own admin access must remain active.',400);
 if(r.id==='workspace-owner'&&!existing)throw new AccessError('Complete owner setup first.',400);
 if(r.role==='chef'&&!(await projects(db)).some(p=>p.id===r.project_id&&(!r.active||p.active)))throw new AccessError('Assign an active project to this chef.',400);
 const credential=await db.prepare('SELECT user_id FROM credentials WHERE user_id=?').bind(r.id).first();if(!credential&&!r.password)throw new AccessError('Set an initial password.',400);
 const hashed=r.password?await hashPassword(r.password):null;
 const statements=[db.prepare('INSERT INTO users (id,email,name,username,project_id,role,active,updated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,username=excluded.username,project_id=excluded.project_id,role=excluded.role,active=excluded.active,updated=excluded.updated').bind(r.id,existing?.email||r.id+'@local.invalid',r.name,r.username,r.role==='admin'?null:r.project_id,r.role,r.active?1:0,new Date().toISOString())];
 if(hashed)statements.push(db.prepare('INSERT INTO credentials (user_id,password_hash,must_change,version) VALUES (?,?,1,1) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,must_change=1,version=credentials.version+1').bind(r.id,hashed));
 statements.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(r.id));await db.batch(statements);
}
export async function adminSnapshot(db:D1Database,user:AppUser){requireAdmin(user);const users=(await db.prepare('SELECT u.id,u.name,u.username,u.project_id,u.role,u.active,CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END AS has_password,c.must_change FROM users u LEFT JOIN credentials c ON c.user_id=u.id ORDER BY u.name').all<AppUser>()).results;return {projects:await projects(db),users};}
export async function assignLegacy(db:D1Database,user:AppUser,project:Project,owner:string){
 requireAdmin(user);if(!(await legacyGroups(db,user)).some(g=>g.owner===owner))throw new AccessError('This preserved workspace is unavailable.');const scope=exportScope(project);
 // One atomic update preserves cross-record references; collisions abort without overwriting.
 await db.prepare("UPDATE records SET owner=?,project_id=?,site_id='',updated=?,payload=CASE WHEN kind='recipe' THEN json_set(payload,'$.site_scope',?,'$.site_ids',json(?),'$.site_names',json(?),'$.project_id',?) ELSE json_set(json_remove(payload,'$.store_id'),'$.project_id',?) END WHERE owner=? AND project_id=''").bind('project:'+project.id,project.id,new Date().toISOString(),scope.site_scope,JSON.stringify(scope.site_ids),JSON.stringify(scope.site_names),project.id,project.id,owner).run();
}
