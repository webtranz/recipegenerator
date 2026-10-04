import {z} from 'zod';
export type LocationKind='area'|'project'|'site'|'store';
export type Location={id:string;kind:LocationKind;code:string;name:string;parent_id:string|null;active:number;updated:string};
export type AppUser={id:string;email:string;name:string;auth_user_id:string|null;role:'admin'|'member';active:number;updated:string;site_ids:string[]};
export type WorkspaceContext={user:AppUser;sites:Location[];areas:Location[];projects:Location[];stores:Location[];legacy_count:number};
export type Identity={id:string;email:string};
export class AccessError extends Error{status:number;constructor(message:string,status=403){super(message);this.status=status;}}
export const locationSchema=z.object({id:z.string().min(1).max(100),kind:z.enum(['area','project','site','store']),code:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(200),parent_id:z.string().max(100).nullable(),active:z.boolean()});
export const userSchema=z.object({id:z.string().min(1).max(100),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),name:z.string().trim().min(1).max(200),role:z.enum(['admin','member']),active:z.boolean(),site_ids:z.array(z.string().min(1)).max(100)});
export async function allLocations(db:D1Database){return (await db.prepare('SELECT * FROM locations ORDER BY kind,name').all<Location>()).results;}
export function hierarchyActive(location:Location,all:Location[]):boolean{if(!location.active)return false;if(location.kind==='area')return !location.parent_id;const parent=all.find(l=>l.id===location.parent_id);const expected={project:'area',site:'project',store:'site'}[location.kind];return !!parent&&parent.kind===expected&&hierarchyActive(parent,all);}
export function requireAdmin(user:AppUser){if(user.role!=='admin'||!user.active)throw new AccessError('Only administrators can manage users and locations.');}
export async function authenticate(db:D1Database,identity:Identity|null,ownerEmail:string|undefined):Promise<AppUser>{
 if(!identity?.id||!identity.email)throw new AccessError('Sign in to access this workspace.',401);
 const email=identity.email.trim().toLowerCase();let row=await db.prepare('SELECT * FROM users WHERE auth_user_id=?').bind(identity.id).first<Omit<AppUser,'site_ids'>>();
 if(!row){
  if(ownerEmail&&email===ownerEmail.trim().toLowerCase())await db.prepare("INSERT OR IGNORE INTO users (id,email,name,auth_user_id,role,active,updated) VALUES ('workspace-owner',?,?,?,'admin',1,?)").bind(email,'Workspace owner',identity.id,new Date().toISOString()).run();
  row=await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first<Omit<AppUser,'site_ids'>>();
  if(!row)throw new AccessError('Your account has not been added to Recipe Studio. Ask an administrator to create your user profile.');
  if(!row.active)throw new AccessError('Your Recipe Studio account is inactive. Contact an administrator.');
  if(row.auth_user_id&&row.auth_user_id!==identity.id)throw new AccessError('This profile belongs to a different sign-in account.');
  if(!row.auth_user_id){await db.prepare('UPDATE users SET auth_user_id=? WHERE id=? AND auth_user_id IS NULL AND active=1').bind(identity.id,row.id).run();row=await db.prepare('SELECT * FROM users WHERE id=?').bind(row.id).first<Omit<AppUser,'site_ids'>>();}
 }
 if(!row||!row.active||row.auth_user_id!==identity.id)throw new AccessError('Your Recipe Studio account is inactive or unavailable.');
 const sites=await db.prepare('SELECT site_id FROM user_sites WHERE user_id=?').bind(row.id).all<{site_id:string}>();return {...row,site_ids:sites.results.map(s=>s.site_id)};
}
export async function requireSite(db:D1Database,user:AppUser,id:string|null):Promise<Location>{
 if(!id)throw new AccessError('Select a site before accessing inventory, recipes, or menus.',400);
 const all=await allLocations(db),site=all.find(s=>s.id===id&&s.kind==='site');
 if(!site||!hierarchyActive(site,all)||(user.role!=='admin'&&!user.site_ids.includes(id)))throw new AccessError('You do not have access to this active site.');return site;
}
export async function contextFor(db:D1Database,user:AppUser):Promise<WorkspaceContext>{
 const all=await allLocations(db),sites=all.filter(l=>l.kind==='site'&&hierarchyActive(l,all)&&(user.role==='admin'||user.site_ids.includes(l.id)));
 const projects=all.filter(l=>l.kind==='project'&&sites.some(s=>s.parent_id===l.id));const areas=all.filter(l=>l.kind==='area'&&projects.some(p=>p.parent_id===l.id));
 const legacy=user.role==='admin'?await db.prepare("SELECT count(*) AS n FROM records WHERE owner=? AND site_id=''").bind(user.auth_user_id).first<{n:number}>():null;
 return {user,sites,projects,areas,stores:all.filter(l=>l.kind==='store'&&l.active&&sites.some(s=>s.id===l.parent_id)),legacy_count:legacy?.n||0};
}
export async function saveLocation(db:D1Database,user:AppUser,input:unknown){
 requireAdmin(user);const r=locationSchema.parse(input),all=await allLocations(db),existing=all.find(l=>l.id===r.id);
 if(existing&&(existing.kind!==r.kind||existing.parent_id!==r.parent_id))throw new AccessError('Location type and parent cannot change after creation. Create a new location instead.',400);
 const parents:Record<string,string>={project:'area',site:'project',store:'site'};
 if(r.kind==='area'&&r.parent_id)throw new AccessError('An area cannot have a parent.',400);
 if(r.kind!=='area'){const parent=all.find(l=>l.id===r.parent_id&&l.kind===parents[r.kind]);if(!parent)throw new AccessError('Choose a valid parent '+parents[r.kind]+'.',400);if(r.active&&!hierarchyActive(parent,all))throw new AccessError('Reactivate the parent hierarchy before activating this location.',400);}
 await db.prepare('INSERT INTO locations (id,kind,code,name,parent_id,active,updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active,updated=excluded.updated').bind(r.id,r.kind,r.code,r.name,r.parent_id,r.active?1:0,new Date().toISOString()).run();
}
export async function saveUser(db:D1Database,actor:AppUser,input:unknown){
 requireAdmin(actor);const r=userSchema.parse(input),siteIds=[...new Set(r.site_ids)];const existing=await db.prepare('SELECT * FROM users WHERE id=?').bind(r.id).first<Omit<AppUser,'site_ids'>>();
 if(existing&&existing.email!==r.email)throw new AccessError('Sign-in email cannot change. Deactivate this profile and create a new one.',400);
 if((r.id==='workspace-owner'||r.id===actor.id)&&(!r.active||r.role!=='admin'))throw new AccessError('The workspace owner and your own admin access must remain active.',400);
 if(r.id==='workspace-owner'&&!existing)throw new AccessError('The workspace owner is configured by the hosting administrator.',400);
 if(r.role==='member'&&r.active&&!siteIds.length)throw new AccessError('Assign at least one site to an active site user.',400);
 const all=await allLocations(db);if(siteIds.some(id=>!all.some(l=>l.id===id&&l.kind==='site')))throw new AccessError('A selected site does not exist.',400);
 const now=new Date().toISOString();const statements=[db.prepare('INSERT INTO users (id,email,name,role,active,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active,updated=excluded.updated').bind(r.id,r.email,r.name,r.role,r.active?1:0,now),db.prepare('DELETE FROM user_sites WHERE user_id=?').bind(r.id),...siteIds.map(id=>db.prepare('INSERT INTO user_sites (user_id,site_id) VALUES (?,?)').bind(r.id,id))];await db.batch(statements);
}
export async function adminSnapshot(db:D1Database,user:AppUser){requireAdmin(user);const users=(await db.prepare('SELECT * FROM users ORDER BY name').all<Omit<AppUser,'site_ids'>>()).results;const assignments=(await db.prepare('SELECT * FROM user_sites').all<{user_id:string;site_id:string}>()).results;return {locations:await allLocations(db),users:users.map(u=>({...u,site_ids:assignments.filter(a=>a.user_id===u.id).map(a=>a.site_id)}))};}
export async function assignLegacy(db:D1Database,user:AppUser,site:Location){
 requireAdmin(user);
 await db.prepare("UPDATE records SET owner=?,site_id=?,updated=?,payload=CASE WHEN kind='recipe' THEN json_set(payload,'$.site_scope','specific','$.site_ids',json_array(?),'$.site_names',json_array(?),'$.site_id',?) ELSE json_set(payload,'$.site_id',?) END WHERE owner=? AND site_id=''").bind('site:'+site.id,site.id,new Date().toISOString(),site.code,site.name,site.id,site.id,user.auth_user_id).run();
}
