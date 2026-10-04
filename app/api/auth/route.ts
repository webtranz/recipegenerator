import {env} from '@/lib/runtime';
import {firstAdminAvailable,createFirstAdmin} from '@/lib/first-admin';
import {db,json,failure,body,checkOrigin,sessionRequest,clientAddress} from '@/lib/server-context';
import {AccessError} from '@/lib/access';
import {sessionUser,requireSession,login,changePassword,cookie,readToken,issueSession,limitAttempt} from '@/lib/session';
import {digestToken} from '@/lib/passwords';
export const dynamic='force-dynamic';
const setupConfig=()=>({ownerEmail:env.STUDIO_OWNER_EMAIL});
export async function GET(req:Request){try{const user=await sessionUser(db(),sessionRequest(req));if(user)return json({user:{name:user.name,username:user.username,role:user.role},must_change:user.must_change});return json({user:null,first_admin_available:await firstAdminAvailable(db())});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 checkOrigin(req,true);const authRequest=sessionRequest(req);
 const input=await body(req);let token='';
 if(input.action==='login')token=await login(db(),input.username,input.password,clientAddress(req));
 else if(input.action==='logout'){const old=readToken(authRequest);if(old)await db().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digestToken(old)).run();return Response.json({ok:true},{headers:{'Set-Cookie':cookie(authRequest,'',0),'Cache-Control':'no-store'}});}
 else if(input.action==='change_password')token=await changePassword(db(),await requireSession(db(),authRequest,true),input.current_password,input.password);
 else if(input.action==='first_admin'){
  await limitAttempt(db(),'first-admin:'+ (clientAddress(req)),10);const id=await createFirstAdmin(db(),setupConfig(),input);token=await issueSession(db(),id,1);
 }else throw new AccessError('Unknown sign-in action.',400);
 return Response.json({ok:true},{headers:{'Set-Cookie':cookie(authRequest,token),'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
