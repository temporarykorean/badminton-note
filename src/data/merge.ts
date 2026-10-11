import {type Database,type Lesson,type Competition} from '../domain.ts';
import {validateDatabase} from '../repository.ts';
const norm=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ');
// Source + number/range + canonical date matches existing import semantics.
export const lessonIdentity=(l:Lesson)=>JSON.stringify(['lesson',l.lessonSource,norm(l.displayLessonNumber||String(l.lessonNumber)).replace(/~/g,'-').replace(/\s/g,''),l.date]);
export const competitionIdentity=(c:Competition)=>JSON.stringify(['competition',norm(c.name),c.date]);
export function mergeDatabase(cloud:Database,local:Database){
  if(!validateDatabase(cloud)||!validateDatabase(local))throw new Error('이전할 데이터 형식을 확인해 주세요.');
  const next=structuredClone(cloud);next.competitions??=[];
  let imported=0,skipped=0;
  const parents=new Map<string,string>();const duplicateParents=new Set<string>();
  for(const s of local.sources)if(!next.sources.some(x=>x.id===s.id))next.sources.push(s);
  for(const l of local.lessons){const existing=next.lessons.find(x=>x.id===l.id||lessonIdentity(x)===lessonIdentity(l));if(existing){parents.set(l.id,existing.id);duplicateParents.add(l.id);skipped++}else{next.lessons.push(l);parents.set(l.id,l.id);imported++}}
  for(const c of local.competitions||[]){const existing=next.competitions.find(x=>x.id===c.id||competitionIdentity(x)===competitionIdentity(c));if(existing){parents.set(c.id,existing.id);duplicateParents.add(c.id);skipped++}else{next.competitions.push(c);parents.set(c.id,c.id);imported++}}
  const groupMap=new Map<string,string>();
  for(const g of local.groups){const existing=next.groups.find(x=>x.id===g.id||x.name===g.name);if(existing)groupMap.set(g.id,existing.id);else{next.groups.push(g);groupMap.set(g.id,g.id)}}
  const feedbackMap=new Map<string,string>();
  for(const f of local.feedback){const parent=f.competitionId||f.lessonId;const mapped=parents.get(parent);const existing=next.feedback.find(x=>x.id===f.id||(mapped===(x.competitionId||x.lessonId)&&x.content===f.content));if(existing){feedbackMap.set(f.id,existing.id);continue}
    // Cloud version of an already-present record takes precedence; never revive edited/deleted feedback.
    if(duplicateParents.has(parent))continue;
    const value={...f,feedbackGroupId:groupMap.get(f.feedbackGroupId)!};next.feedback.push(value);feedbackMap.set(f.id,f.id);
  }
  for(const c of local.cards){const feedbackId=feedbackMap.get(c.feedbackId);if(feedbackId&&!next.cards.some(x=>x.id===c.id||x.feedbackId===feedbackId&&x.questionType===c.questionType))next.cards.push({...c,feedbackId})}
  for(const s of local.sessions)if(!next.sessions.some(x=>x.id===s.id))next.sessions.push({...s,wrongFeedbackIds:s.wrongFeedbackIds.map(id=>feedbackMap.get(id)||id)});
  if(!cloud.lessons.length&&!cloud.competitions?.length)next.lastSource=local.lastSource;
  next.categories=[...new Set([...next.categories,...local.categories])];next.settings={...local.settings,...next.settings};
  if(!validateDatabase(next))throw new Error('이전 데이터의 참조 관계를 확인해 주세요.');
  return {db:next,imported,skipped};
}
