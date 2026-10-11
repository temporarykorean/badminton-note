import {COACHING_VERSION,cleanFeedback,feedbackKey,classificationLabel,extractCoaching,type CoachingPoint} from './coaching.ts';
export interface LessonSource { id:string; name:string; code:string; color:string; isActive:boolean }
export interface LessonTopic { id:string; lessonId:string; category:string; subcategory:string }
export interface Lesson { recordType?:'lesson'; title?:string; displayLessonNumber?:string; lessonDates?:string[]; id:string; lessonNumber:number; lessonSource:string; coachName:string; date:string; rawText:string; createdAt:string; updatedAt:string; topics:LessonTopic[]; feeling:string; good:string; focus:string }
export interface Feedback { evidence?:string; technique?:string; situation?:string; competitionId?:string; id:string; lessonId:string; content:string; type:'coaching'; feedbackGroupId:string; importance:number }
export interface FeedbackGroup { id:string; name:string; description:string }
export type QuestionType='choice'|'ox'|'blank'|'recall'|'scenario';
export interface ReviewCard { sourceSnippet?:string; partialCount?:number; id:string; feedbackId:string; questionType:QuestionType; question:string; choices:string[]; answer:string; nextReviewDate:string; intervalLevel:number; correctCount:number; incorrectCount:number }
export interface ReviewSession { partialCount?:number; id:string; date:string; total:number; correct:number; incorrect:number; wrongFeedbackIds:string[] }
export interface Competition { id:string; name:string; date:string; result:string; rawText:string; strengths:string; weaknesses:string; goals:string; title?:string; createdAt:string; updatedAt:string }
export interface Database { settings?:Record<string,string|number|boolean>; competitions?:Competition[]; version:1; demo:boolean; sources:LessonSource[]; lessons:Lesson[]; feedback:Feedback[]; groups:FeedbackGroup[]; cards:ReviewCard[]; sessions:ReviewSession[]; categories:string[]; lastSource:string }
export const categories=['클리어','드롭','스매시','드라이브','수비','헤어핀','언더','푸시','전위','풋워크','서브','리시브','로테이션'];
export const today=()=>new Date().toLocaleDateString('sv-SE');
export const uid=()=>crypto.randomUUID();
export const sources:LessonSource[]=[{id:'club',code:'club',name:'클럽',color:'green',isActive:true},{id:'academy',code:'academy',name:'아카데미',color:'blue',isActive:true}];
export function emptyDB():Database {return {settings:{coachingVersion:COACHING_VERSION},version:1,demo:false,sources,lessons:[],feedback:[],groups:[],cards:[],sessions:[],categories:[...categories],lastSource:'club'}}
export const meaningfulFeedback=(text:string)=>!!cleanFeedback(text);
export function structure(rawText:string,cats=categories){const parsed=extractCoaching(rawText,cats);return {topics:cats.filter(x=>rawText.includes(x)),feedback:parsed.points.map(p=>p.content),good:parsed.good,feeling:parsed.feeling};}
function appendCoaching(next:Database,record:Lesson|Competition,contents:string[],competition=false){
 const selected=[...new Set(contents.map(cleanFeedback).filter(x=>x&&!classificationLabel(x,next.categories)))];
 const parsed=extractCoaching(competition?[('weaknesses' in record?record.weaknesses:''),('goals' in record?record.goals:'')].join('\n'):record.rawText,next.categories,'topics' in record?record.topics.map(t=>t.category):[]).points;
 for(const content of selected){
  const key=feedbackKey(content);if(next.feedback.some(f=>(f.competitionId||f.lessonId)===record.id&&feedbackKey(f.content)===key))continue;
  const point=parsed.find(p=>feedbackKey(p.content)===key);
  let group=next.groups.find(g=>feedbackKey(g.name)===key);if(!group){group={id:uid(),name:content,description:'동일한 교정 내용을 연결합니다. 기술 분류만으로 합치지 않습니다.'};next.groups.push(group)}
  const feedback:Feedback={id:uid(),lessonId:competition?'':record.id,...(competition?{competitionId:record.id}:{}),content,type:'coaching',feedbackGroupId:group.id,importance:1,...(point?{evidence:point.evidence,technique:point.technique,situation:point.situation}:{})};next.feedback.push(feedback);
  if(!competition&&point?.question)next.cards.push({id:uid(),feedbackId:feedback.id,questionType:'recall',question:point.question,sourceSnippet:point.evidence,choices:[],answer:content,nextReviewDate:today(),intervalLevel:0,correctCount:0,incorrectCount:0});
 }
}
export function addLesson(db:Database,input:Omit<Lesson,'id'|'createdAt'|'updatedAt'|'topics'> & {categories:string[]; feedback:string[]},editId?:string){const next=structuredClone(db);const id=editId||uid();const old=next.lessons.find(x=>x.id===id);const {categories:cats,feedback:contents,...rest}=input;const lesson:Lesson={...rest,id,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),topics:cats.map(category=>({id:uid(),lessonId:id,category,subcategory:''}))};const removed=next.feedback.filter(x=>x.lessonId===id).map(x=>x.id);next.feedback=next.feedback.filter(x=>x.lessonId!==id);next.cards=next.cards.filter(x=>!removed.includes(x.feedbackId));next.lessons=next.lessons.filter(x=>x.id!==id);next.lessons.push(lesson);appendCoaching(next,lesson,contents);next.lastSource=input.lessonSource;return next;}
export function groupStats(db:Database,source='all'){return db.groups.map(g=>{
 const seen=new Set<string>();
 const all=db.feedback.filter(f=>f.feedbackGroupId===g.id&&meaningfulFeedback(f.content)&&!classificationLabel(f.content,db.categories)).map(f=>({feedback:f,lesson:feedbackRecord(db,f)!})).filter(x=>{if(!x.lesson)return false;const key=`${x.lesson.recordType}:${x.lesson.id}`;if(seen.has(key))return false;seen.add(key);return true});
 const entries=all.filter(x=>source==='all'||x.lesson.lessonSource===source).sort((a,b)=>a.lesson.date.localeCompare(b.lesson.date));
 const counts=Object.fromEntries([...db.sources,{id:'competition'}].map(s=>[s.id,entries.filter(x=>x.lesson.lessonSource===s.id).length]));
 return {...g,name:classificationLabel(g.name,db.categories)?entries[0]?.feedback.content||g.name:g.name,entries,counts,occurrenceCount:entries.length,sourceCount:new Set(entries.map(x=>x.lesson.lessonSource)).size,firstSeenLesson:entries[0]?.lesson,lastSeenLesson:entries.at(-1)?.lesson};
 }).filter(x=>x.occurrenceCount).sort((a,b)=>(b.occurrenceCount+b.sourceCount*2)-(a.occurrenceCount+a.sourceCount*2));}
export const intervals=[0,1,3,7,14,30,60];
export function answerCard(card:ReviewCard,correct:boolean|'remembered'|'partial'|'again',date=today()):ReviewCard{const level=Math.max(0,Math.min(6,card.intervalLevel+(correct===true||correct==='remembered'?1:correct==='partial'?0:-2)));const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+(correct==='partial'?1:intervals[level]));return {...card,intervalLevel:level,nextReviewDate:d.toLocaleDateString('sv-SE'),correctCount:card.correctCount+Number(correct===true||correct==='remembered'),incorrectCount:card.incorrectCount+Number(correct===false||correct==='again'),...(correct==='partial'?{partialCount:(card.partialCount||0)+1}:{})}}
export function dailyCards(db:Database,date=today()){const valid=db.cards.filter(c=>!!c.sourceSnippet&&!!c.question&&db.feedback.some(f=>f.id===c.feedbackId&&!f.competitionId&&meaningfulFeedback(f.content)));const due=valid.filter(c=>c.nextReviewDate<=date).sort((a,b)=>a.nextReviewDate.localeCompare(b.nextReviewDate));const newest=[...valid].sort((a,b)=>{const lesson=(c:ReviewCard)=>db.lessons.find(l=>l.id===db.feedback.find(f=>f.id===c.feedbackId)?.lessonId)?.date||'';return lesson(b).localeCompare(lesson(a))});const result:ReviewCard[]=[];const add=(list:ReviewCard[],n:number)=>{if(n<=0)return;for(const c of list){if(!result.some(x=>x.id===c.id)){result.push(c);if(--n===0)break}}};add(due,2);add(newest,2);const seed=Number(date.replaceAll('-',''));add([...valid].sort((a,b)=>((a.id.charCodeAt(0)+seed)%31)-((b.id.charCodeAt(0)+seed)%31)),1);add(due,5-result.length);return result.slice(0,5);}
export type ImportRecordType='lesson'|'competition'|'unclassified';
export interface ImportRow {key:string; selected:boolean; recordType:ImportRecordType; lessonSource:string; lessonNumber:number; displayLessonNumber:string; lessonDates:string[]; competitionName:string; result:string; date:string; title:string; rawText:string; bodyText:string; header:string; parseWarnings:string[]}
const datePattern=/(?<!\d)(?:\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{6})(?!\d)/g;
export function normalizeDate(value:string):string {
  const compact=value.match(/^(\d{2})(\d{2})(\d{2})$/);
  const expanded=value.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if(!compact&&!expanded)return '';
  const [year,month,day]=compact?[2000+Number(compact[1]),Number(compact[2]),Number(compact[3])]:[Number(expanded![1]),Number(expanded![2]),Number(expanded![3])];
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function parseTXT(text:string,defaultSource='club'):ImportRow[]{
  // Offsets keep each block's original text, including its delimiter and header.
  const delimiters=[...text.matchAll(/^[ \t]*={2,}[ \t]*(.*?)[ \t]*={2,}[ \t]*\r?$/gm)];
  const blocks:{header:string;rawText:string;content:string}[]=[];
  if(delimiters.length){
    const prefix=text.slice(0,delimiters[0].index);if(prefix.trim())blocks.push({header:'',rawText:prefix,content:prefix});
    delimiters.forEach((m,i)=>{const start=m.index!;const end=delimiters[i+1]?.index??text.length;blocks.push({header:m[1].trim(),rawText:text.slice(start,end),content:text.slice(start+m[0].length,end).replace(/^\r?\n/,'')})});
  }else{
    // Retain the legacy delimiter-free “1회차” format. Unknown chunks remain visible.
    const headers=[...text.matchAll(/^[ \t]*(?:(?:클럽|아카데미|더콕)[^\r\n]*?)?\d+(?:\s*[-~]\s*\d+)?\s*회(?:차)?[ \t]*\r?$/gm)];
    if(headers.length){const prefix=text.slice(0,headers[0].index);if(prefix.trim())blocks.push({header:'',rawText:prefix,content:prefix});headers.forEach((m,i)=>{const start=m.index!;const end=headers[i+1]?.index??text.length;blocks.push({header:m[0].trim(),rawText:text.slice(start,end),content:text.slice(start+m[0].length,end).replace(/^\r?\n/,'')})})}
    else if(text.trim())blocks.push({header:'',rawText:text,content:text});
  }
  return blocks.map((block,i)=>{
    const firstLine=block.content.split(/\r?\n/).find(l=>l.trim())?.trim()||'';
    const hint=`${block.header} ${firstLine}`;
    const competition=/대회/.test(hint);
    const number=hint.match(/(\d+)\s*(?:([-~])\s*(\d+))?\s*회(?:차)?/);
    const academy=/더콕|아카데미/.test(hint);
    const club=/클럽/.test(hint);
    const recordType:ImportRecordType=competition?'competition':academy||club||number?'lesson':'unclassified';
    const lessonSource=academy?'academy':club?'club':defaultSource;
    const matches=[...firstLine.matchAll(datePattern)];
    const standaloneDate=block.content.split(/\r?\n/).map(l=>l.trim()).find(l=>normalizeDate(l));
    const dates=matches.map(m=>normalizeDate(m[0])).filter(Boolean);
    if(standaloneDate&&!dates.includes(normalizeDate(standaloneDate)))dates.push(normalizeDate(standaloneDate));
    const headerLine=matches.length>0&&(/회|대회/.test(firstLine)||firstLine.includes(' / '));
    const lastDate=matches.at(-1);
    const title=headerLine&&lastDate?firstLine.slice(lastDate.index!+lastDate[0].length).replace(/^[\s,/|·-]+/,'').trim():'';
    const nameHeader=/대회/.test(block.header)?block.header.replace(/^(?:대회명|대회)\s*[:/|·-]?\s*/,'').trim():'';
    const nameFirst=firstLine.slice(0,matches[0]?.index??firstLine.length).replace(/^(?:대회명|대회)\s*[:/|·-]?\s*/,'').replace(/[\s/|·-]+$/,'').trim();
    const competitionName=competition?(nameHeader||nameFirst):'';
    const bodyLines=block.content.split(/\r?\n/);
    const firstLineIndex=bodyLines.findIndex(line=>line.trim());
    const bodyText=bodyLines.filter((line,index)=>!(index===firstLineIndex&&headerLine)&&line.trim()!==standaloneDate).join('\n').trim();
    const displayLessonNumber=number?(number[3]?`${number[1]}${number[2]}${number[3]}`:number[1]):'';
    const warnings:string[]=[];
    if(recordType==='unclassified')warnings.push('기록 유형을 직접 분류해 주세요.');
    if(!dates.length)warnings.push('유효한 날짜를 찾지 못했어요.');
    if(number?.[3]&&Number(number[3])<Number(number[1]))warnings.push('회차 범위의 끝이 시작보다 작아요.');
    return {key:String(i),selected:recordType!=='unclassified',recordType,lessonSource,lessonNumber:Number(number?.[1]||0),displayLessonNumber,lessonDates:dates,competitionName,result:competition?title:'',date:dates[0]||'',title,rawText:block.rawText,bodyText,header:block.header||firstLine,parseWarnings:warnings};
  });
}
export function lessonNumberLabel(lesson:Pick<Lesson,'lessonNumber'|'displayLessonNumber'>){return lesson.displayLessonNumber||String(lesson.lessonNumber)}
export function importRowError(row:ImportRow):string {
  if(row.recordType==='unclassified')return '기록 유형을 직접 분류해 주세요.';
  if(!normalizeDate(row.date))return '유효한 날짜를 입력해 주세요.';
  if(!row.rawText.trim())return '원문이 비어 있어요.';
  if(row.recordType==='competition')return row.competitionName.trim()?'':'대회명을 입력해 주세요.';
  const m=row.displayLessonNumber.match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/);
  if(!m||Number(m[1])<1||(m[2]&&Number(m[2])<Number(m[1])))return '올바른 회차 또는 회차 범위를 입력해 주세요.';
  return '';
}
export function isDuplicateImport(db:Database,row:ImportRow):boolean {
  if(row.recordType==='competition')return (db.competitions||[]).some(c=>c.name.trim()===row.competitionName.trim()&&c.date===row.date);
  if(row.recordType!=='lesson')return false;
  const canonical=(value:string)=>value.replace(/\s/g,'').replace('~','-');
  return db.lessons.some(l=>l.lessonSource===row.lessonSource&&canonical(lessonNumberLabel(l))===canonical(row.displayLessonNumber||String(row.lessonNumber))&&l.date===row.date);
}
export function competitionSections(body:string){
  const result={strengths:'',weaknesses:'',goals:''};let key:keyof typeof result|null=null;
  for(const line of body.split(/\r?\n/)){
    const match=line.trim().match(/^(잘한 것|잘한 점|못한 것|못한 점|다음 대회에서 개선하고 싶은 것|개선하고 싶은 것|목표)\s*[:：]?\s*(.*)$/);
    if(match){key=/^잘한/.test(match[1])?'strengths':/^못한/.test(match[1])?'weaknesses':'goals';if(match[2])result[key]+=match[2]+'\n'}
    else if(key)result[key]+=line+'\n';
  }
  return Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.trim()])) as typeof result;
}
export function saveCompetition(db:Database,input:Omit<Competition,'id'|'createdAt'|'updatedAt'>,editId?:string):Database {
  const next=structuredClone(db);const id=editId||uid();const old=next.competitions?.find(c=>c.id===id);
  const competition:Competition={...input,id,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  next.competitions=[...(next.competitions||[]).filter(c=>c.id!==id),competition];
  const oldFeedback=next.feedback.filter(f=>f.competitionId===id).map(f=>f.id);
  next.feedback=next.feedback.filter(f=>f.competitionId!==id);next.cards=next.cards.filter(c=>!oldFeedback.includes(c.feedbackId));
  // Link only the user's improvement notes. Results and section labels are not coaching.
  const contents=extractCoaching([input.weaknesses,input.goals].join('\n'),next.categories).points.map(p=>p.content);
  appendCoaching(next,competition,contents,true);
  return next;
}
export function addCompetition(db:Database,row:ImportRow):Database {
  return saveCompetition(db,{name:row.competitionName.trim(),date:row.date,result:row.result||row.title,rawText:row.rawText,...competitionSections(row.bodyText),title:row.title});
}
export function importRecords(db:Database,rows:ImportRow[]){
  let next=db;let imported=0;let skipped=0;
  for(const row of rows.filter(r=>r.selected)){const error=importRowError(row);if(error)throw new Error(error);if(isDuplicateImport(next,row)){skipped++;continue}
    if(row.recordType==='competition')next=addCompetition(next,row);
    else {const analysis=structure(row.bodyText,db.categories);next=addLesson(next,{recordType:'lesson',lessonSource:row.lessonSource,lessonNumber:Number(row.displayLessonNumber.match(/^\d+/)?.[0]),displayLessonNumber:row.displayLessonNumber,lessonDates:row.lessonDates.map((d,i)=>i===0?row.date:d),date:row.date,title:row.title,rawText:row.rawText,coachName:'',categories:analysis.topics,feedback:analysis.feedback,good:analysis.good,feeling:analysis.feeling,focus:analysis.feedback[0]||''})}
    imported++;
  }
  return {db:next,imported,skipped};
}
// A display-only projection lets existing timelines show separate competition records.
// Competition data is never persisted in the lessons collection.
export function feedbackRecord(db:Database,f:Feedback): (Omit<Lesson,'recordType'> & {recordType:'lesson'|'competition'; competitionName?:string})|undefined {
  if(!f.competitionId){const lesson=db.lessons.find(l=>l.id===f.lessonId);return lesson?{...lesson,recordType:'lesson'}:undefined}
  const c=db.competitions?.find(c=>c.id===f.competitionId);if(!c)return;
  return {id:c.id,recordType:'competition',competitionName:c.name,title:c.title,lessonNumber:0,lessonSource:'competition',coachName:'',date:c.date,rawText:c.rawText,createdAt:c.createdAt,updatedAt:c.updatedAt,topics:[],good:c.strengths,feeling:c.weaknesses,focus:c.goals};
}
export function demoDB(){let db=emptyDB();const records=[['club',7,'2026-01-23','드라이브','팔 전체로 밀어 치지 않는다.\n어깨의 힘을 빼고 준비하기.'],['club',12,'2026-03-06','언더','포핸드 언더는 앞타점에서 맞추기.\n팔로 밀지 않기.'],['club',24,'2026-06-12','풋워크','친 다음 중앙으로 복귀하기.\n어깨가 올라가지 않도록 주의하기.'],['academy',2,'2026-08-28','수비','팔 힘보다 라켓 헤드를 사용하기.\n라켓을 미리 뒤로 빼지 않기.'],['academy',3,'2026-09-11','리시브','앞타점이 늦지 않게 준비하기.\n라켓 헤드를 미리 빼지 않기.'],['club',31,'2026-09-18','드라이브','다시 팔로 밀어내는 경향 있음.\n앞타점에서 짧게 맞추기.'],['club',36,'2026-10-02','드라이브','포핸드 드라이브는 앞타점.\n전위 푸시에서 팔을 끝까지 펴지 않기.\n잘된 점: 짧은 스윙이 안정적이었다.'],['academy',5,'2026-10-09','수비','수비 시 라켓을 미리 뒤로 빼지 않기.\n팔로 밀어서 치지 않기.\n스매시 리시브는 앞타점에서 맞추기.\n느낌: 힘을 빼니 반응이 빨라졌다.']];for(const [lessonSource,n,date,category,raw] of records){const rawText=String(raw);const a=structure(rawText);db=addLesson(db,{lessonSource:String(lessonSource),lessonNumber:Number(n),date:String(date),coachName:lessonSource==='club'?'코치 A':'코치 B',rawText,categories:[String(category)],feedback:a.feedback,feeling:a.feeling,good:a.good,focus:a.feedback[0]||''})}db.demo=true;return db;}
