import {captureCoachingSafety} from '../repository';
import {supabase} from '../lib/supabase';
import {createCloudAccess} from './cloudAccess';
export function cloudError(error:unknown):string {
 const message=error instanceof Error?error.message:String((error as {message?:string})?.message||'');
 if(/JWT|expired|LOGIN_REQUIRED|refresh_token/i.test(message))return '로그인이 만료되었습니다. 로그아웃한 뒤 다시 로그인해 주세요.';
 if(/relation|function|schema cache/i.test(message))return 'Supabase SQL Editor에서 초기 migration SQL을 실행해 주세요.';
 return message==='CONFLICT'?'다른 기기에서 기록이 변경되었습니다. 초안을 보관한 뒤 최신 기록을 불러와 다시 저장해 주세요.':'클라우드 요청에 실패했습니다. 인터넷 연결과 Supabase 설정을 확인해 주세요. '+message;
}
export const cloudRepository=createCloudAccess({
 backup(userId,db){captureCoachingSafety(userId,db)},
 async load(userId){if(!supabase)throw new Error('Supabase 설정이 없습니다.');const {data,error}=await supabase.from('kokrecall_data').select('data,revision').eq('user_id',userId).maybeSingle();if(error)throw error;return data},
 async save(db,revision){if(!supabase)throw new Error('Supabase 설정이 없습니다.');const {data,error}=await supabase.rpc('kokrecall_save',{expected_revision:revision,new_data:db});if(error)throw error;return data||[]}
});
