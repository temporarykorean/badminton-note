// Record-derived coaching only. No badminton rules or answers are supplied here.
export const COACHING_VERSION=2;
export interface CoachingPoint {content:string;evidence:string;technique:string;situation:string;question?:string}
const bullet=/^(?:\s*(?:[\p{Pd}*•·●○▪▫■□▶▷✓✔※]+|\(?\d+\)?[.)、:：-](?!\d)|[①-⑳]|[A-Za-z][.)]))\s*/u;
export function cleanFeedback(text:string):string {
 let value=text.trim();if(!/\p{L}/u.test(value))return '';
 // Strip original circled/list markers before NFKC turns them into plain digits.
 for(let i=0;i<8&&bullet.test(value);i++)value=value.replace(bullet,'').trim();
 value=value.normalize('NFKC');
 for(let i=0;i<8&&bullet.test(value);i++)value=value.replace(bullet,'').trim();
 return /\p{L}/u.test(value)?value:'';
}
export const feedbackKey=(text:string)=>cleanFeedback(text).replace(/[.!?。！？]+$/u,'').replace(/\s+/g,' ').trim();
export const classificationLabel=(text:string,cats:string[])=>{
 const value=feedbackKey(text).replace(/^[\[({#]+|[\])}*:：]+$/g,'').trim();
 if(['풋워크와 준비 자세','기본 스트로크','스윙 폼','핵심 피드백','코치 핵심 피드백','기술','세부 기술','다음 집중 포인트','교정','코칭'].includes(value))return true;
 const residue=cats.reduce((rest,cat)=>rest.split(cat).join(''),value).replace(/포핸드|백핸드|준비 자세|와|과|및|[/,·|\s]/g,'');
 if(value&&!residue)return true;
 return !!value&&value.split(/\s*[/,·|]\s*/).every(part=>cats.includes(part));
};
const correction=/(?:않기|않는다|않도록|말기|말고|말아|하지\s*마|하기|해야|하라고|하세요|하자|하라|해라|할\s*것|세우|세워|빼기|빼고|빼라|빼야|낮추|내리|펴지|펴기|짧게|빠르게|맞추|사용하기|사용해야|복귀하기|힘\s*(?:을\s*)?빼|유지하기|준비하기|준비하|돌리기|돌려|눌러|붙이기|넣기|펴기|모으기|타점.*앞|앞타점.*맞)/;
const problem=/(?:늦|들리|들림|올라|밀어서|힘으로|경향|못했|못함|안\s*됨|실수|흔들|너무|문제)/;
const subject=(text:string)=>['라켓 헤드','라켓','어깨','팔','타점','발','스텝','스윙','몸','손목','그립'].find(x=>text.includes(x))||'';
const techniques=(text:string,cats:string[])=>cats.filter(x=>text.includes(x)).sort((a,b)=>text.indexOf(a)-text.indexOf(b));
const compound=(text:string,found:string[])=>found.length>1&&(text.replace(/\s+/g,' ').includes(found.join(' '))||text.includes(found.join('')));
function questionFor(content:string,technique:string,situation:string):string|undefined {
 if(!correction.test(content))return;
 if(/연습(?:을)?\s*했|배웠다|어려웠|어려움|못했|못했다|못함|느꼈|좋았다/.test(content)&&!/해야|하라고|않기|하자|하세요/.test(content))return;
 const target=subject(content);
 // Require an identifiable situation or a single associated technique, plus a concrete target.
 // A technique alone ("수비하기") is not a correction point.
 if(!target||(!technique&&!situation))return;
 const context=situation||`${technique} 상황에서`;
 const aspect=/미리|준비/.test(content)?`${target}의 준비 동작`:/세우|세워/.test(content)?`${target}의 방향`:/힘/.test(content)?`${target}의 힘 사용`:/복귀/.test(content)?`${target}의 복귀 동작`:target;
 return `${context.replace(/[.。]+$/,'').replace(/[,，]$/,'')}, ${aspect}에 대해 어떤 교정을 받았나요?`;
}
export function extractCoaching(raw:string,cats:string[],fallbackTechniques:string[]=[]):{points:CoachingPoint[];good:string;feeling:string} {
 const points:CoachingPoint[]=[];const good:string[]=[];const feeling:string[]=[];
 let heading='',section:'coaching'|'good'|'feeling'='coaching',pendingProblem='',problemTechnique='',pendingStart=-1;
 const lines=raw.split(/\r?\n/);
 for(const [lineIndex,original] of lines.entries()){
  if(/^\s*(?:={2,}|\d{4}[./-]\d{1,2}[./-]\d{1,2}(?:\s|$))/.test(original))continue;
  const clean=cleanFeedback(original);if(!clean)continue;
  if(/^={2,}|^\d{4}[./-]\d{1,2}[./-]\d{1,2}(?:\s|$)|^\d{6}$/.test(clean)||/회(?:차)?\s*\/\s*(?:\d{6}|\d{4}[./-])/.test(clean)||(/대회/.test(clean)&&/\d{6}|\d{4}[./-]/.test(clean)))continue;
  const sectionMatch=clean.match(/^(잘된 점|잘한 것|잘한 점|내 느낌|내가 느낀 감각|느낌|못한 것|못한 점|다음 대회에서 개선하고 싶은 것|개선하고 싶은 것|목표|핵심 피드백|코치 핵심 피드백|다음 집중 포인트)\s*[:：]?\s*(.*)$/);
  let text=clean;
  if(sectionMatch){section=/^잘/.test(sectionMatch[1])?'good':/느낌|감각/.test(sectionMatch[1])?'feeling':'coaching';pendingProblem='';text=sectionMatch[2];if(!text)continue}
  if(classificationLabel(text,cats)){const found=techniques(text,cats);heading=found.length===1?found[0]:compound(text,found)?found.join(' '):'';section='coaching';pendingProblem='';continue}
  if(section==='good'||/잘됐|잘된|좋았/.test(text)){good.push(text);continue}
  if(section==='feeling'||/느꼈|느낌/.test(text)){feeling.push(text);continue}
  // Numbering is removed BEFORE sentence segmentation so "1. 내용" never becomes two feedbacks.
  let activeTechnique='',activeSituation='';
  const chunks=text.replace(/(?:빼고|낮추고|세우고|준비하고|유지하고|복귀하고|맞추고|펴고|내리고|풀고)\s+(?=라켓|어깨|팔|타점|발|스텝|스윙|몸|손목|그립)/g,match=>match+'\u001f').split(/\u001f/).flatMap(part=>part.split(/\s+(?=\d+[.)]\s)|(?<=[.!?。])\s+(?=[가-힣A-Za-z])/u));
  for(const chunk of chunks){
   let content=cleanFeedback(chunk);if(!content||classificationLabel(content,cats))continue;
   let situation='';const arrow=content.match(/^(.*?)\s*(?:→|=>|->)\s*(.+)$/);
   if(arrow){situation=arrow[1].trim();content=cleanFeedback(arrow[2])}
   if(!content)continue;
   const found=techniques(situation+' '+content,cats);
   // An explicit technique on this line wins over earlier headings. Multiple unrelated
   // techniques on one line are deliberately not resolved by picking the first title tag.
   const technique=found.length===1?found[0]:found.length>1?(compound(situation+' '+content,found)?found.join(' '):''):activeTechnique||heading||(fallbackTechniques.length===1?fallbackTechniques[0]:'');
   const when=content.match(/^(.{0,60}?(?:할 때|칠 때|받을 때|준비할 때|준비 시|수비 시|리시브 시|복귀 시))\s+/);
   if(technique)activeTechnique=technique;
   if(!situation&&when){situation=when[1];activeSituation=situation}
   if(!situation&&activeSituation)situation=activeSituation;
   if(!situation&&pendingProblem&&(!problemTechnique||!technique||technique===problemTechnique))situation=pendingProblem;
   const evidence=pendingProblem&&pendingStart>=0&&(!problemTechnique||!technique||technique===problemTechnique)?lines.slice(pendingStart,lineIndex+1).join('\n'):original;
   const question=questionFor(content,technique,situation);
   points.push({content,evidence,technique,situation,question});
   if(question)pendingProblem='';else if(problem.test(content)){pendingProblem=content;problemTechnique=technique;pendingStart=lineIndex}
  }
 }
 const unique=new Map<string,CoachingPoint>();
 for(const p of points){const key=feedbackKey(p.content);const existing=unique.get(key);if(!existing||(!existing.question&&p.question))unique.set(key,p)}
 return {points:[...unique.values()],good:good.join('\n'),feeling:feeling.join('\n')};
}
