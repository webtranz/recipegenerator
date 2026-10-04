import {actor,db,json,failure} from '@/lib/server-context';
import {contextFor} from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return json(await contextFor(db(),await actor(req)));}catch(e){return failure(e);}}
