import {reprocessCoaching} from '../reprocess.ts';
import {emptyDB,type Database} from '../domain.ts';
import {validateDatabase} from '../repository.ts';
export interface CloudSnapshot {db:Database;revision:number;reprocessed?:boolean}
interface Row {data:unknown;revision:number}
export interface CloudTransport {backup?(userId:string,db:Database):void;load(userId:string):Promise<Row|null>;save(db:Database,revision:number):Promise<Row[]>}
export function createCloudAccess(transport:CloudTransport){return {
 async load(userId:string):Promise<CloudSnapshot>{const row=await transport.load(userId);if(!row)return {db:emptyDB(),revision:0};if(!validateDatabase(row.data)||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error('클라우드 데이터 형식을 확인할 수 없습니다. 원본을 변경하지 않습니다.');const repaired=reprocessCoaching(row.data);if(!repaired.changed)return {db:row.data,revision:row.revision};if(!validateDatabase(repaired.db))throw new Error('피드백 재처리 검증에 실패했습니다.');transport.backup?.(userId,row.data);const saved=await transport.save(repaired.db,row.revision);if(!saved.length)throw new Error('CONFLICT');if(!validateDatabase(saved[0].data)||saved[0].revision!==row.revision+1)throw new Error('피드백 재처리 저장 응답을 확인해 주세요.');return {db:saved[0].data,revision:saved[0].revision,reprocessed:true}},
 async save(db:Database,revision:number):Promise<CloudSnapshot>{if(!validateDatabase(db)||!Number.isSafeInteger(revision)||revision<0)throw new Error('저장할 데이터 형식을 확인해 주세요.');const rows=await transport.save(reprocessCoaching(db).db,revision);if(!rows.length)throw new Error('CONFLICT');const row=rows[0];if(!validateDatabase(row.data)||row.revision!==revision+1)throw new Error('서버 응답 형식을 확인할 수 없습니다.');return {db:row.data,revision:row.revision}}
};}
