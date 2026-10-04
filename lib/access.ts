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
const SOURCE='recipegenerator',DEFAULT_AREA_ID='recipe-generator-area',DEFAULT_PROJECT_ID='recipe-generator-project';
export function requireAdmin(user:AppUser){if(user.role!=='admin'||!user.active)throw new AccessError('Only admins can manage projects, inventory, and users.');}
function projectRow(){return "SELECT warehouse_id AS id,'project' AS kind,COALESCE(warehouse_code,warehouse_id) AS code,name,NULL AS parent_id,CASE WHEN status='active' THEN 1 ELSE 0 END AS active,updated_at::text AS updated,d365_warehouse_id AS export_site_id,name AS export_site_name FROM warehouses";}
export async function ensureLocationRoot(db:D1Database){await db.batch([
 db.prepare("INSERT INTO areas (area_id,area_code,name,status,source_name) VALUES (?,?,?,'active',?) ON CONFLICT (area_id) DO UPDATE SET area_code=excluded.area_code,name=excluded.name,status='active',updated_at=NOW()").bind(DEFAULT_AREA_ID,'RECIPE','Recipe Generator',SOURCE),
 db.prepare("INSERT INTO projects (project_id,area_id,project_code,name,status,source_name) VALUES (?,?,?,?,'active',?) ON CONFLICT (project_id) DO UPDATE SET area_id=excluded.area_id,project_code=excluded.project_code,name=excluded.name,status='active',updated_at=NOW()").bind(DEFAULT_PROJECT_ID,DEFAULT_AREA_ID,'RECIPE','Recipe Generator',SOURCE),
]);}
export async function projects(db:D1Database){return (await db.prepare(projectRow()+" ORDER BY name").all<Project>()).results;}
export function exportScope(project:Project){return project.export_site_id?{site_scope:'specific' as const,site_ids:[project.export_site_id],site_names:[project.export_site_name||project.name]}:{site_scope:'all' as const,site_ids:[],site_names:[]};}
function appUser(row:AppUser&{must_change?:boolean|number;active:number|boolean}):AppUser{return {...row,active:row.active?1:0,has_password:true,must_change:!!row.must_change};}
export async function loadUser(db:D1Database,id:string):Promise<AppUser>{
 const row=await db.prepare("SELECT id,email,COALESCE(full_name,email) AS name,id AS auth_user_id,role,email AS username,site_id AS project_id,CASE WHEN status='active' THEN 1 ELSE 0 END AS active,updated_at::text AS updated,CASE WHEN temporary_password IS NULL THEN 0 ELSE 1 END AS must_change FROM users WHERE id=?").bind(id).first<AppUser&{must_change:number}>();
 if(!row||!row.active||!ROLES.includes(row.role))throw new AccessError('Your account is inactive or unavailable.',401);return appUser(row);
}
// Used only for one-time owner setup at the trusted hosting boundary.
export async function authenticate(db:D1Database,identity:Identity|null,ownerEmail:string|undefined):Promise<AppUser>{
 if(!identity?.id||!identity.email||!ownerEmail||identity.email.trim().toLowerCase()!==ownerEmail.trim().toLowerCase())throw new AccessError('Use your username and password.',401);
 await db.prepare("INSERT INTO users (id,email,full_name,role,status,password_hash,source_name,updated_at) VALUES ('workspace-owner',?,?,'admin','active',?,'recipegenerator',NOW()) ON CONFLICT (id) DO UPDATE SET email=excluded.email,full_name=excluded.full_name,role='admin',status='active',updated_at=NOW()").bind(identity.email.trim().toLowerCase(),'Workspace owner','scrypt-v1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000').run();
 return loadUser(db,'workspace-owner');
}
export async function requireProject(db:D1Database,user:AppUser,id:string|null):Promise<Project>{
 if(!id)throw new AccessError('Select a project first.',400);
 const project=await db.prepare(projectRow()+" WHERE warehouse_id=? AND status='active'").bind(id).first<Project>();
 if(!project||!user.active||(user.role!=='admin'&&user.project_id!==id))throw new AccessError('You do not have access to this active project.');return project;
}
export async function legacyGroups(_db:D1Database,_user:AppUser){return [];}
export async function contextFor(db:D1Database,user:AppUser):Promise<WorkspaceContext>{return {user,projects:(await projects(db)).filter(p=>p.active&&(user.role==='admin'||user.project_id===p.id)),legacy_groups:await legacyGroups(db,user)};}
export async function saveProject(db:D1Database,user:AppUser,input:unknown){
 requireAdmin(user);const r=projectSchema.parse(input);
 if(!!r.export_site_id!==!!r.export_site_name)throw new AccessError('Provide both Food Pro scope ID and scope name, or leave both blank.',400);
 await ensureLocationRoot(db);
 await db.prepare("INSERT INTO warehouses (warehouse_id,project_id,warehouse_code,d365_warehouse_id,name,status,source_name,updated_at) VALUES (?,?,?,?,?,?,?,NOW()) ON CONFLICT (warehouse_id) DO UPDATE SET project_id=excluded.project_id,warehouse_code=excluded.warehouse_code,d365_warehouse_id=excluded.d365_warehouse_id,name=excluded.name,status=excluded.status,updated_at=NOW()").bind(r.id,DEFAULT_PROJECT_ID,r.code,r.export_site_id||null,r.name,r.active?'active':'inactive',SOURCE).run();
}
export async function saveUser(db:D1Database,actor:AppUser,input:unknown){
 requireAdmin(actor);const r=userSchema.parse(input),existing=await db.prepare('SELECT id,email,password_hash,temporary_password FROM users WHERE id=?').bind(r.id).first<{id:string;email:string;password_hash:string;temporary_password:string|null}>();
 if((r.id==='workspace-owner'||r.id===actor.id)&&(!r.active||r.role!=='admin'))throw new AccessError('The owner and your own admin access must remain active.',400);
 if(r.id==='workspace-owner'&&!existing)throw new AccessError('Complete owner setup first.',400);
 if(r.role==='chef'&&!(await projects(db)).some(p=>p.id===r.project_id&&(!r.active||p.active)))throw new AccessError('Assign an active project to this chef.',400);
 if(!existing&&!r.password)throw new AccessError('Set an initial password.',400);
 const hashed=r.password?await hashPassword(r.password):existing?.password_hash;
 const project=r.role==='chef'&&r.project_id?(await requireProject(db,actor,r.project_id)):null;
 const email=r.username.trim().toLowerCase();
 const temp=r.password?'must_change':existing?.temporary_password??null;
 const statements=[
  db.prepare("INSERT INTO users (id,email,full_name,role,status,site_id,site_name,password_hash,temporary_password,source_name,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW()) ON CONFLICT (id) DO UPDATE SET email=excluded.email,full_name=excluded.full_name,role=excluded.role,status=excluded.status,site_id=excluded.site_id,site_name=excluded.site_name,password_hash=excluded.password_hash,temporary_password=excluded.temporary_password,updated_at=NOW()").bind(r.id,email,r.name,r.role,r.active?'active':'inactive',r.role==='admin'?null:r.project_id,project?.name??null,hashed,temp,SOURCE),
  db.prepare('DELETE FROM user_site_access WHERE user_id=?').bind(r.id),
  db.prepare('DELETE FROM auth_tokens WHERE user_id=?').bind(r.id),
 ];
 if(project)statements.push(db.prepare("INSERT INTO user_site_access (user_id,site_id,site_name,access_scope) VALUES (?,?,?,'assigned') ON CONFLICT (user_id,site_id) DO UPDATE SET site_name=excluded.site_name,access_scope='assigned',assigned_at=NOW()").bind(r.id,project.id,project.name));
 await db.batch(statements);
}
export async function adminSnapshot(db:D1Database,user:AppUser){requireAdmin(user);const users=(await db.prepare("SELECT id,email,COALESCE(full_name,email) AS name,email AS username,site_id AS project_id,role,CASE WHEN status='active' THEN 1 ELSE 0 END AS active,updated_at::text AS updated,1 AS has_password,CASE WHEN temporary_password IS NULL THEN 0 ELSE 1 END AS must_change FROM users WHERE role IN ('admin','chef') ORDER BY COALESCE(full_name,email)").all<AppUser>()).results.map(u=>appUser(u as AppUser&{must_change:number;active:number}));return {projects:await projects(db),users};}
export async function assignLegacy(_db:D1Database,user:AppUser,_project:Project,_owner:string){
 requireAdmin(user);throw new AccessError('Legacy JSON workspaces are not available in the FoodProLive relational schema.',410);
}
