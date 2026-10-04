import Studio from './studio';
import {chatGPTSignInPath} from './chatgpt-auth';
import AuthGate from './auth-gate';
export const dynamic='force-dynamic';
export default function Home(){return <AuthGate ownerSignInPath={chatGPTSignInPath('/')}><Studio/></AuthGate>;}
