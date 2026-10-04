import {AccessError,loadUser,type AppUser} from './access';
import {digestToken,randomToken,verifyPassword,hashPassword,usernameSchema,passwordSchema} from './passwords';
export const SESSION_SECONDS=8*60*60;
export function cookieName(req:Request){return new URL(req.url).protocol==='https:'?'__Host-rs_session':'rs_session';}
export function cookie(req:Request,token:string,maxAge=SESSION_SECONDS){return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
export function readToken(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(req)+'='))?.split('=')[1]||'';}
export async function sessionUser(db:D1Database,req:Request):Promise<AppUser|null>{
 const token=readToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const s=await db.prepare('SELECT s.user_id FROM sessions s JOIN credentials c ON c.user_id=s.user_id AND c.version=s.version WHERE s.token_hash=? AND s.expires>?').bind(await digestToken(token),Date.now()).first<{user_id:string}>();
 return s?loadUser(db,s.user_id):null;
}
export async function requireSession(db:D1Database,req:Request,allowPasswordChange=false){const u=await sessionUser(db,req);if(!u)throw new AccessError('Sign in with your username and password.',401);if(u.must_change&&!allowPasswordChange)throw new AccessError('Change your temporary password before continuing.',428);return u;}
export async function issueSession(db:D1Database,userId:string,version:number){const token=randomToken();await db.prepare('INSERT INTO sessions (token_hash,user_id,version,expires) VALUES (?,?,?,?)').bind(await digestToken(token),userId,version,Date.now()+SESSION_SECONDS*1000).run();return token;}
export async function limitAttempt(db:D1Database,key:string,limit:number){const now=Date.now();const r=await db.prepare('INSERT INTO login_attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(await digestToken(key),now+15*60*1000,now,now).first<{count:number}>();if(!r||r.count>limit)throw new AccessError('Too many attempts. Try again in 15 minutes.',429);}
export async function login(db:D1Database,username:string,password:string,ip:string){
 await limitAttempt(db,'ip:'+ip,60);const normalized=typeof username==='string'?username.trim().toLowerCase():'';
 await limitAttempt(db,'username:'+normalized.slice(0,100),10);
 const parsed=usernameSchema.safeParse(normalized);
 const row=parsed.success?await db.prepare('SELECT u.id,u.active,c.password_hash,c.version FROM users u JOIN credentials c ON c.user_id=u.id WHERE u.username=?').bind(parsed.data).first<{id:string;active:number;password_hash:string;version:number}>():null;
 // Unknown usernames take the same password-hashing path as valid accounts.
 const dummy='scrypt-v1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
 const valid=await verifyPassword(typeof password==='string'?password:'',row?.password_hash||dummy);
 if(!valid||!row?.active)throw new AccessError('Invalid username or password.',401);
 await db.prepare('DELETE FROM sessions WHERE expires<=?').bind(Date.now()).run();await db.prepare('DELETE FROM login_attempts WHERE expires<=?').bind(Date.now()).run();
 return issueSession(db,row.id,row.version);
}
export async function changePassword(db:D1Database,user:AppUser,current:string,next:string){
 await limitAttempt(db,'password-change:'+user.id,10);passwordSchema.parse(next);
 const c=await db.prepare('SELECT password_hash,version FROM credentials WHERE user_id=?').bind(user.id).first<{password_hash:string;version:number}>();
 if(!c||!await verifyPassword(current,c.password_hash))throw new AccessError('Current password is incorrect.',400);
 if(current===next)throw new AccessError('Choose a different password.',400);
 const hashed=await hashPassword(next);
 const updated=await db.prepare('UPDATE credentials SET password_hash=?,must_change=0,version=version+1 WHERE user_id=? AND version=? RETURNING version').bind(hashed,user.id,c.version).first<{version:number}>();
 if(!updated)throw new AccessError('Your password changed in another session. Sign in again.',401);
 await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();return issueSession(db,user.id,updated.version);
}
