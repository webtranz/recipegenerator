import {env} from 'cloudflare:workers';
import {firstAdminAvailable,createFirstAdmin} from '@/lib/first-admin';
import {db,json,failure,bootstrapOwner,body} from '@/lib/server-context';
import {AccessError} from '@/lib/access';
import {sessionUser,requireSession,login,changePassword,cookie,readToken,issueSession,limitAttempt} from '@/lib/session';
import {usernameSchema,hashPassword,digestToken} from '@/lib/passwords';
export const dynamic='force-dynamic';
const setupConfig=()=>({hash:env.STUDIO_SETUP_KEY_HASH,expires:env.STUDIO_SETUP_EXPIRES,ownerEmail:env.STUDIO_OWNER_EMAIL});
export async function GET(req:Request){try{const user=await sessionUser(db(),req);if(user)return json({user:{name:user.name,username:user.username,role:user.role},must_change:user.must_change});try{await bootstrapOwner(req);return json({owner_setup:true});}catch{return json({user:null,first_admin_available:await firstAdminAvailable(db(),setupConfig())});}}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)throw new AccessError('Invalid request origin.');
 const input=await body(req);let token='';
 if(input.action==='login')token=await login(db(),input.username,input.password,req.headers.get('cf-connecting-ip')||'local');
 else if(input.action==='logout'){const old=readToken(req);if(old)await db().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digestToken(old)).run();return Response.json({ok:true},{headers:{'Set-Cookie':cookie(req,'',0),'Cache-Control':'no-store'}});}
 else if(input.action==='change_password')token=await changePassword(db(),await requireSession(db(),req,true),input.current_password,input.password);
 else if(input.action==='first_admin'){
  await limitAttempt(db(),'first-admin:'+ (req.headers.get('cf-connecting-ip')||'local'),10);const id=await createFirstAdmin(db(),setupConfig(),input);token=await issueSession(db(),id,1);
 }else if(input.action==='owner_setup'){
  const owner=await bootstrapOwner(req);await limitAttempt(db(),'owner-setup',10);const username=usernameSchema.parse(input.username),hash=await hashPassword(input.password);
  await db().batch([db().prepare('INSERT INTO credentials (user_id,password_hash,must_change,version) VALUES (?,?,0,1)').bind(owner.id,hash),db().prepare('UPDATE users SET username=? WHERE id=?').bind(username,owner.id)]);token=await issueSession(db(),owner.id,1);
 }else throw new AccessError('Unknown sign-in action.',400);
 return Response.json({ok:true},{headers:{'Set-Cookie':cookie(req,token),'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
