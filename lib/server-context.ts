import {env} from '@/lib/runtime';
import {z} from 'zod';
import {AccessError} from './access';
import {requireSession} from './session';
export function db(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
export async function actor(req:Request){return requireSession(db(),sessionRequest(req));}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export function sessionRequest(req:Request){return new Request(new URL(new URL(req.url).pathname,env.APP_ORIGIN||req.url),{headers:req.headers});}
export function clientAddress(req:Request){return env.STUDIO_RUNTIME==='node'?(env.STUDIO_CLIENT_IP_HEADER?req.headers.get(env.STUDIO_CLIENT_IP_HEADER)||'shared':'shared'):req.headers.get('cf-connecting-ip')||'local';}
export function checkOrigin(req:Request,required=false){const origin=req.headers.get('origin');if((required||origin)&&origin!==(env.APP_ORIGIN||new URL(req.url).origin))throw new AccessError('Invalid request origin.');}
export async function body(req:Request){const raw=await req.text();if(raw.length>1500000)throw new AccessError('The request is too large. Import up to 100 inventory items per batch.',413);return JSON.parse(raw);}
export function failure(e:unknown){if(e instanceof AccessError)return json({error:e.message},e.status);if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')},400);if(e instanceof SyntaxError)return json({error:'Invalid JSON request.'},400);if(e instanceof Error&&e.message.includes('UNIQUE'))return json({error:'That code or username already exists. Choose a unique value.'},409);console.error('Recipe Studio request failed',e);return json({error:'Could not load or save your changes. Please retry.'},503);}
