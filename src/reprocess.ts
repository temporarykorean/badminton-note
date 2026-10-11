import type {Database,Feedback,FeedbackGroup,ReviewCard} from './domain.ts';
import {COACHING_VERSION,cleanFeedback,feedbackKey,classificationLabel,extractCoaching,type CoachingPoint} from './coaching.ts';
const stable=(kind:string,recordId:string,key:string)=>`${kind}:${recordId}:${encodeURIComponent(key)}`;
export function reprocessCoaching(database:Database):{db:Database;changed:boolean} {
 if(database.settings?.coachingVersion===COACHING_VERSION)return {db:database,changed:false};
 const db=structuredClone(database);const feedback:Feedback[]=[];const groups:FeedbackGroup[]=[];const cards:ReviewCard[]=[];const redirects=new Map<string,string>();
 const usedFeedback=new Set<string>(),usedCards=new Set<string>();
 const process=(recordId:string,raw:string,techniques:string[],competition:boolean)=>{
  const old=db.feedback.filter(f=>(competition?f.competitionId===recordId:!f.competitionId&&f.lessonId===recordId));
  const parsed=extractCoaching(raw,db.categories,techniques).points;
  const points=new Map<string,CoachingPoint>(parsed.map(p=>[feedbackKey(p.content),p]));
  // Preserve user-edited meaningful feedback as well as newly found raw evidence.
  // A user edit absent from the raw text remains feedback but cannot become a quiz answer.
  for(const f of old){const content=cleanFeedback(f.content);const key=feedbackKey(content);if(content&&!classificationLabel(content,db.categories)&&!points.has(key))points.set(key,{content,evidence:'',technique:'',situation:''})}
  for(const [key,point] of points){
   const matches=old.filter(f=>feedbackKey(f.content)===key);const prior=matches.find(f=>!usedFeedback.has(f.id));
   const id=prior?.id||stable('feedback',recordId,key);usedFeedback.add(id);matches.forEach(f=>redirects.set(f.id,id));
   const priorGroup=db.groups.find(g=>g.id===prior?.feedbackGroupId);
   // Keep explicit user group edits. Retire the automatic broad keyword groups.
   const manual=priorGroup&&/사용자|직접 분리/.test(priorGroup.description)&&!classificationLabel(priorGroup.name,db.categories);
   const groupKey=manual?`manual:${priorGroup.id}`:key;
   let group=groups.find(g=>g.id===(manual?priorGroup.id:stable('group','correction',groupKey)));
   if(!group){group=manual?priorGroup:{id:stable('group','correction',groupKey),name:point.content,description:'동일한 교정 내용으로 재처리한 피드백입니다.'};groups.push(group)}
   const f:Feedback={...prior,id,lessonId:competition?'':recordId,...(competition?{competitionId:recordId}:{}),content:point.content,type:'coaching',feedbackGroupId:group.id,importance:prior?.importance||1,evidence:point.evidence,technique:point.technique,situation:point.situation};feedback.push(f);
   if(!competition&&point.question){
    const previous=db.cards.filter(c=>matches.some(m=>m.id===c.feedbackId)).sort((a,b)=>(b.correctCount+b.incorrectCount)-(a.correctCount+a.incorrectCount)).find(c=>!usedCards.has(c.id));
    const cardId=previous?.id||stable('card',recordId,key);usedCards.add(cardId);
    cards.push({...previous,id:cardId,feedbackId:id,questionType:'recall',question:point.question,sourceSnippet:point.evidence,choices:[],answer:point.content,nextReviewDate:previous?.nextReviewDate||new Date().toLocaleDateString('sv-SE'),intervalLevel:previous?.intervalLevel||0,correctCount:previous?.correctCount||0,incorrectCount:previous?.incorrectCount||0});
   }
  }
 };
 for(const lesson of db.lessons){process(lesson.id,lesson.rawText,lesson.topics.map(t=>t.category),false);const cleanFocus=cleanFeedback(lesson.focus);if(lesson.focus.trim()&&(!cleanFocus||classificationLabel(cleanFocus,db.categories)))lesson.focus=extractCoaching(lesson.rawText,db.categories,lesson.topics.map(t=>t.category)).points.find(p=>p.question)?.content||'';else if(cleanFocus)lesson.focus=cleanFocus;}
 for(const c of db.competitions||[])process(c.id,[c.weaknesses,c.goals].join('\n'),[],true);
 db.feedback=feedback;db.groups=groups;db.cards=cards;
 db.sessions=db.sessions.map(s=>({...s,wrongFeedbackIds:[...new Set(s.wrongFeedbackIds.map(id=>redirects.get(id)).filter((id):id is string=>!!id))]}));
 db.settings={...db.settings,coachingVersion:COACHING_VERSION};
 return {db,changed:true};
}
