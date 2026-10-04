import {actor,db,json,failure,checkOrigin,body} from '@/lib/server-context';
import {requireSite} from '@/lib/access';
import {readData,writeData,deleteData} from '@/lib/data-service';
export const dynamic='force-dynamic';
async function scope(req:Request){return requireSite(db(),await actor(req),new URL(req.url).searchParams.get('site'));}
export async function GET(req:Request){try{return json(await readData(db(),await scope(req)));}catch(e){return failure(e);}}
export async function POST(req:Request){try{checkOrigin(req);await writeData(db(),await scope(req),await body(req));return json({ok:true});}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{checkOrigin(req);const q=new URL(req.url).searchParams;await deleteData(db(),await scope(req),q.get('kind'),q.get('id'));return json({ok:true});}catch(e){return failure(e);}}
