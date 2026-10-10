import {type Database,type Lesson,type Competition,emptyDB} from './domain.ts';

// Keep the original data key so deployed updates can read existing smartphone data.
export const STORAGE_KEYS=Object.freeze({data:'kok-recall-v1',draft:'kokrecall:draft:v1',restoreSafety:'kokrecall:restore-safety:v1'});
export type EditorDraft=
  | {kind:'lesson';editor:Partial<Lesson>;analysis:boolean;categories:string[];feedbackText:string;updatedAt:string}
  | {kind:'competition';editor:Partial<Competition>;updatedAt:string};
export interface Backup {app:'kokrecall';version:1;exportedAt:string;data:Database;state:{draft:EditorDraft|null}}
export interface RecoverySnapshot {capturedAt:string;data:string|null;draft:string|null}
export interface Repository {load():Database;save(data:Database):void;hasData():boolean;loadDraft():EditorDraft|null;saveDraft(draft:EditorDraft):void;clearDraft():void;replaceBackup(backup:Backup):void;readRawData():string|null;readRestoreSafety():RecoverySnapshot|null}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown):v is string=>typeof v==='string';
const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(str);
const fields=(v:unknown,keys:string[])=>object(v)&&keys.every(k=>str(v[k]));
const uniqueIds=(items:{id:string}[])=>new Set(items.map(x=>x.id)).size===items.length;
export function validateDatabase(value:unknown):value is Database {
  if(!object(value)||value.version!==1||typeof value.demo!=='boolean'||!str(value.lastSource))return false;
  if(!['sources','lessons','feedback','groups','cards','sessions'].every(k=>Array.isArray(value[k]))||!strings(value.categories))return false;
  const d=value as unknown as Database;
  if(!d.sources.every(s=>fields(s,['id','name','code','color'])&&typeof s.isActive==='boolean'))return false;
  if(!d.lessons.every(l=>fields(l,['id','lessonSource','coachName','date','rawText','createdAt','updatedAt','feeling','good','focus'])&&num(l.lessonNumber)&&l.lessonNumber>=1&&Array.isArray(l.topics)&&l.topics.every(t=>fields(t,['id','lessonId','category','subcategory']))&&(l.displayLessonNumber===undefined||str(l.displayLessonNumber))&&(l.lessonDates===undefined||strings(l.lessonDates))&&(l.title===undefined||str(l.title))))return false;
  if(d.competitions!==undefined&&(!Array.isArray(d.competitions)||!d.competitions.every(c=>fields(c,['id','name','date','result','rawText','strengths','weaknesses','goals','createdAt','updatedAt']))))return false;
  if(!d.groups.every(g=>fields(g,['id','name','description'])))return false;
  if(!d.feedback.every(f=>fields(f,['id','lessonId','content','feedbackGroupId'])&&f.type==='coaching'&&num(f.importance)&&(f.competitionId===undefined||str(f.competitionId))))return false;
  if(!d.cards.every(c=>fields(c,['id','feedbackId','question','answer','nextReviewDate'])&&['choice','ox','blank','recall','scenario'].includes(c.questionType)&&strings(c.choices)&&Number.isInteger(c.intervalLevel)&&c.intervalLevel>=0&&c.intervalLevel<=6&&num(c.correctCount)&&num(c.incorrectCount)&&c.correctCount>=0&&c.incorrectCount>=0))return false;
  if(!d.sessions.every(s=>fields(s,['id','date'])&&num(s.total)&&num(s.correct)&&num(s.incorrect)&&s.total>=0&&s.correct>=0&&s.incorrect>=0&&s.correct+s.incorrect===s.total&&strings(s.wrongFeedbackIds)))return false;
  if(d.settings!==undefined&&(!object(d.settings)||!Object.values(d.settings).every(v=>str(v)||typeof v==='boolean'||num(v))))return false;
  if(![d.sources,d.lessons,d.competitions||[],d.feedback,d.groups,d.cards,d.sessions].every(uniqueIds))return false;
  // Broken references must not crash lesson/review screens after a restore.
  return d.lessons.every(l=>d.sources.some(s=>s.id===l.lessonSource))&&d.feedback.every(f=>d.groups.some(g=>g.id===f.feedbackGroupId)&&(f.competitionId?(d.competitions||[]).some(c=>c.id===f.competitionId):d.lessons.some(l=>l.id===f.lessonId)))&&d.cards.every(c=>d.feedback.some(f=>f.id===c.feedbackId));
}
export function validateDraft(value:unknown):value is EditorDraft {
  if(!object(value)||!str(value.updatedAt)||!object(value.editor))return false;
  const e=value.editor;
  const stringKeys=value.kind==='lesson'?['id','lessonSource','coachName','date','rawText','good','feeling','focus','title','displayLessonNumber']:['id','name','date','result','rawText','strengths','weaknesses','goals','title'];
  if(!stringKeys.every(k=>e[k]===undefined||str(e[k])))return false;
  if(value.kind==='lesson')return typeof value.analysis==='boolean'&&strings(value.categories)&&str(value.feedbackText)&&(e.lessonNumber===undefined||num(e.lessonNumber))&&(e.topics===undefined||(Array.isArray(e.topics)&&e.topics.every(t=>fields(t,['id','lessonId','category','subcategory']))))&&(e.lessonDates===undefined||strings(e.lessonDates));
  return value.kind==='competition';
}
export function createBackup(data:Database,draft:EditorDraft|null=null):Backup {
  if(!validateDatabase(data)||draft!==null&&!validateDraft(draft))throw new Error('백업할 데이터 형식을 확인할 수 없습니다.');
  return {app:'kokrecall',version:1,exportedAt:new Date().toISOString(),data:structuredClone(data),state:{draft:structuredClone(draft)}};
}
export function parseBackup(text:string):{backup:Backup;legacy:boolean} {
  let value:unknown;try{value=JSON.parse(text)}catch{throw new Error('콕리콜 백업 파일이 아닙니다.')}
  // Explicit compatibility for JSON files exported by the previous local version.
  if(object(value)&&value.app===undefined&&validateDatabase(value))return {backup:createBackup(value),legacy:true};
  if(!object(value)||value.app!=='kokrecall'||value.version===undefined||value.data===undefined)throw new Error('콕리콜 백업 파일이 아닙니다.');
  if(value.version!==1||(object(value.data)&&value.data.version!==1))throw new Error('지원하지 않는 백업 버전입니다.');
  if(!str(value.exportedAt)||!Number.isFinite(Date.parse(value.exportedAt))||!validateDatabase(value.data))throw new Error('콕리콜 백업 파일이 아닙니다. 데이터 구조를 확인해 주세요.');
  const state=value.state;
  if(state!==undefined&&(!object(state)||(state.draft!==null&&!validateDraft(state.draft))))throw new Error('콕리콜 백업 파일이 아닙니다. 작성 초안을 확인해 주세요.');
  return {backup:{app:'kokrecall',version:1,exportedAt:value.exportedAt,data:value.data,state:{draft:object(state)?state.draft as EditorDraft|null:null}},legacy:false};
}
export const repository:Repository={
  hasData(){return localStorage.getItem(STORAGE_KEYS.data)!==null},
  load(){const raw=localStorage.getItem(STORAGE_KEYS.data);if(raw===null)return emptyDB();let parsed:unknown;try{parsed=JSON.parse(raw)}catch{throw new Error('저장된 데이터를 읽지 못했습니다. 원본은 그대로 보관하고 있습니다.')}
    if(!validateDatabase(parsed))throw new Error('저장된 데이터 형식을 확인할 수 없습니다. 원본은 그대로 보관하고 있습니다.');return parsed},
  save(data){if(!validateDatabase(data))throw new Error('올바르지 않은 데이터는 저장하지 않습니다.');localStorage.setItem(STORAGE_KEYS.data,JSON.stringify(data))},
  loadDraft(){const raw=localStorage.getItem(STORAGE_KEYS.draft);if(raw===null)return null;const draft:unknown=JSON.parse(raw);if(!validateDraft(draft))throw new Error('작성 초안 형식을 확인할 수 없습니다.');return draft},
  saveDraft(draft){if(!validateDraft(draft))throw new Error('작성 초안을 확인해 주세요.');localStorage.setItem(STORAGE_KEYS.draft,JSON.stringify(draft))},
  clearDraft(){localStorage.removeItem(STORAGE_KEYS.draft)},
  readRawData(){return localStorage.getItem(STORAGE_KEYS.data)},
  readRestoreSafety(){const raw=localStorage.getItem(STORAGE_KEYS.restoreSafety);if(!raw)return null;const value:unknown=JSON.parse(raw);if(!object(value)||!str(value.capturedAt)||!(value.data===null||str(value.data))||!(value.draft===null||str(value.draft)))return null;return value as unknown as RecoverySnapshot},
  replaceBackup(backup){
    // Validate again at the write boundary; failed restores never replace current data.
    const validated=parseBackup(JSON.stringify(backup)).backup;
    const previous={capturedAt:new Date().toISOString(),data:localStorage.getItem(STORAGE_KEYS.data),draft:localStorage.getItem(STORAGE_KEYS.draft)};
    localStorage.setItem(STORAGE_KEYS.restoreSafety,JSON.stringify(previous));
    // The draft is written first, data last. Restore the old draft if a quota error occurs.
    try{if(validated.state.draft)localStorage.setItem(STORAGE_KEYS.draft,JSON.stringify(validated.state.draft));else localStorage.removeItem(STORAGE_KEYS.draft);localStorage.setItem(STORAGE_KEYS.data,JSON.stringify(validated.data))}
    catch(error){try{if(previous.draft!==null)localStorage.setItem(STORAGE_KEYS.draft,previous.draft);else localStorage.removeItem(STORAGE_KEYS.draft)}catch{/* The safety snapshot retains both originals. */}throw error}
  }
};
export function downloadJSON(value:unknown,filename:string){
  const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
