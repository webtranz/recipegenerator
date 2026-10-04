import {scryptAsync} from '@noble/hashes/scrypt.js';
import {bytesToHex,hexToBytes} from '@noble/hashes/utils.js';
function equalBytes(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
import {z} from 'zod';
export const passwordSchema=z.string().min(7,'Use at least 7 characters.').max(128,'Use no more than 128 characters.');
export const usernameSchema=z.string().trim().toLowerCase().min(3).max(50);
const options={N:32768,r:8,p:3,dkLen:32,maxmem:48*1024*1024};
export async function hashPassword(password:string){passwordSchema.parse(password);const salt=crypto.getRandomValues(new Uint8Array(16));return 'scrypt-v1$'+bytesToHex(salt)+'$'+bytesToHex(await scryptAsync(password,salt,options));}
export async function verifyPassword(password:string,stored:string){if(typeof password!=='string'||password.length>128)return false;const [version,salt,digest]=stored.split('$');if(version!=='scrypt-v1'||!salt||!digest)return false;return equalBytes(await scryptAsync(password,hexToBytes(salt),options),hexToBytes(digest));}
export function randomToken(){return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));}
export async function digestToken(token:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))));}
