import {actor,db,json,failure,checkOrigin,body} from '@/lib/server-context';
import {adminSnapshot,saveLocation,saveUser,requireAdmin,requireSite,assignLegacy,AccessError} from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return json(await adminSnapshot(db(),await actor(req)));}catch(e){return failure(e);}}
export async function POST(req:Request){try{checkOrigin(req);const user=await actor(req);requireAdmin(user);const input=await body(req);
 if(input.action==='location')await saveLocation(db(),user,input.record);
 else if(input.action==='user')await saveUser(db(),user,input.record);
 else if(input.action==='assign_legacy')await assignLegacy(db(),user,await requireSite(db(),user,input.site_id));
 else throw new AccessError('Unknown administration action.',400);
 return json({ok:true});}catch(e){return failure(e);}}
