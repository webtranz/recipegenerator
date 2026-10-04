import {canWrite} from '@/lib/permissions';
import {actor,db,json,failure,checkOrigin,body} from '@/lib/server-context';
import {requireProject,AccessError} from '@/lib/access';
import {readData,writeData,deleteData} from '@/lib/data-service';
export const dynamic='force-dynamic';
async function scope(req:Request,kind?:string){const user=await actor(req);if(kind&&!canWrite(user.role,kind))throw new AccessError('Your role cannot modify '+kind+' records.');return requireProject(db(),user,new URL(req.url).searchParams.get('project'));}
export async function GET(req:Request){try{return json(await readData(db(),await scope(req)));}catch(e){return failure(e);}}
export async function POST(req:Request){try{checkOrigin(req);const input=await body(req);await writeData(db(),await scope(req,input.kind||'unknown'),input);return json({ok:true});}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{checkOrigin(req);const q=new URL(req.url).searchParams;await deleteData(db(),await scope(req,q.get('kind')||'unknown'),q.get('kind'),q.get('id'));return json({ok:true});}catch(e){return failure(e);}}
