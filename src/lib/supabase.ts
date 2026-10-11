import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let validURL=false;try{const parsed=new URL(url||'');validURL=['https:','http:'].includes(parsed.protocol)&&!!parsed.hostname}catch{/* Show configuration guidance instead of throwing during module load. */}
export const configurationError=!url||!key?'VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 설정한 뒤 앱을 다시 빌드하세요.':!validURL||!key.startsWith('sb_publishable_')?'Supabase URL과 sb_publishable_로 시작하는 공개 키를 확인하세요.':'';
export const supabase=url&&key&&!configurationError?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
