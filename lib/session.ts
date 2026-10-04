import {AccessError,loadUser,type AppUser} from './access';
import {digestToken,randomToken,verifyPassword,hashPassword,usernameSchema,passwordSchema} from './passwords';
export const SESSION_SECONDS=8*60*60;
const attempts=new Map<string,{count:number;expires:number}>();
export function cookieName(req:Request){return new URL(req.url).protocol==='https:'?'__Host-rs_session':'rs_session';}
export function cookie(req:Request,token:string,maxAge=SESSION_SECONDS){return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
export function readToken(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(req)+'='))?.split('=')[1]||'';}
export async function sessionUser(db:D1Database,req:Request):Promise<AppUser|null>{
 const token=readToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const s=await db.prepare('SELECT user_id FROM auth_tokens WHERE token=? AND (expires_at IS NULL OR expires_at>NOW())').bind(await digestToken(token)).first<{user_id:string}>();
 return s?loadUser(db,s.user_id):null;
}
export async function requireSession(db:D1Database,req:Request,allowPasswordChange=false){const u=await sessionUser(db,req);if(!u)throw new AccessError('Sign in with your username and password.',401);if(u.must_change&&!allowPasswordChange)throw new AccessError('Change your temporary password before continuing.',428);return u;}
export async function issueSession(db:D1Database,userId:string){const token=randomToken();await db.prepare('INSERT INTO auth_tokens (token,user_id,expires_at) VALUES (?,?,?)').bind(await digestToken(token),userId,new Date(Date.now()+SESSION_SECONDS*1000)).run();return token;}
export async function limitAttempt(_db:D1Database,key:string,limit:number){const id=await digestToken(key),now=Date.now(),current=attempts.get(id);if(!current||current.expires<=now)attempts.set(id,{count:1,expires:now+15*60*1000});else attempts.set(id,{count:current.count+1,expires:current.expires});if((attempts.get(id)?.count||0)>limit)throw new AccessError('Too many attempts. Try again in 15 minutes.',429);for(const [k,v] of attempts)if(v.expires<=now)attempts.delete(k);}
export async function login(db:D1Database,username:string,password:string,ip:string){
 await limitAttempt(db,'ip:'+ip,60);const normalized=typeof username==='string'?username.trim().toLowerCase():'';
 await limitAttempt(db,'username:'+normalized.slice(0,100),10);
 const parsed=usernameSchema.safeParse(normalized);
 const row=parsed.success?await db.prepare("SELECT id,status,password_hash FROM users WHERE LOWER(BTRIM(email))=?").bind(parsed.data).first<{id:string;status:string;password_hash:string}>():null;
 // Unknown usernames take the same password-hashing path as valid accounts.
 const dummy='scrypt-v1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
 const valid=await verifyPassword(typeof password==='string'?password:'',row?.password_hash||dummy);
 if(!valid||row?.status!=='active')throw new AccessError('Invalid username or password.',401);
 await db.prepare('DELETE FROM auth_tokens WHERE expires_at<=NOW()').run();
 return issueSession(db,row.id);
}
export async function changePassword(db:D1Database,user:AppUser,current:string,next:string){
 await limitAttempt(db,'password-change:'+user.id,10);passwordSchema.parse(next);
 const c=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first<{password_hash:string}>();
 if(!c||!await verifyPassword(current,c.password_hash))throw new AccessError('Current password is incorrect.',400);
 if(current===next)throw new AccessError('Choose a different password.',400);
 const hashed=await hashPassword(next);
 await db.prepare('UPDATE users SET password_hash=?,temporary_password=NULL,updated_at=NOW() WHERE id=?').bind(hashed,user.id).run();
 await db.prepare('DELETE FROM auth_tokens WHERE user_id=?').bind(user.id).run();return issueSession(db,user.id);
}
