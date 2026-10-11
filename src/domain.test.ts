import {test} from 'node:test';
import {repository,validateDatabase} from './repository.ts';
import assert from 'node:assert/strict';
import {parseTXT,emptyDB,addLesson,groupStats,answerCard,dailyCards,type ReviewCard,normalizeDate,importRecords,isDuplicateImport,importRowError} from './domain.ts';
test('TXT preserves body and parses independent lesson numbers',()=>{const rows=parseTXT('=== 1회차 ===\n2026.1.10\n팔로 밀지 않기.\n\n=== 2회차 ===\n2026-01-17\n앞타점.');assert.equal(rows.length,2);assert.equal(rows[0].date,'2026-01-10');assert.equal(rows[0].bodyText,'팔로 밀지 않기.');assert.ok(rows[0].rawText.includes('2026.1.10'));assert.ok(rows[0].rawText.includes('=== 1회차 ==='));assert.equal(rows[1].lessonNumber,2)});
test('source counts derive from actual records and group shared feedback',()=>{let db=emptyDB();for(const lessonSource of ['club','academy'])db=addLesson(db,{lessonSource,lessonNumber:1,date:'2026-10-10',rawText:'팔로 밀지 않기.',coachName:'',categories:['드라이브'],feedback:['팔로 밀지 않기.'],good:'',feeling:'',focus:''});const g=groupStats(db)[0];assert.equal(g.sourceCount,2);assert.equal(g.counts.club,1);assert.equal(g.counts.academy,1);assert.equal(groupStats(db,'club')[0].occurrenceCount,1);assert.equal(dailyCards(db).length,2);assert.equal(db.lessons[0].rawText,'팔로 밀지 않기.')});
test('correct advances interval; incorrect moves two levels back',()=>{const c:ReviewCard={id:'a',feedbackId:'a',questionType:'recall',question:'',choices:[],answer:'',nextReviewDate:'2026-10-10',intervalLevel:2,correctCount:0,incorrectCount:0};assert.equal(answerCard(c,true,'2026-10-10').nextReviewDate,'2026-10-17');assert.equal(answerCard(c,false,'2026-10-10').intervalLevel,0);assert.equal(answerCard({...c,intervalLevel:6},true,'2026-10-10').intervalLevel,6)});
test('editing replaces derived feedback and retains original creation timestamp',()=>{const input={lessonSource:'club',lessonNumber:1,date:'2026-10-10',rawText:'원문',coachName:'',categories:['수비'],feedback:['앞타점'],good:'',feeling:'',focus:''};const initial=addLesson(emptyDB(),input);const changed=addLesson(initial,{...input,rawText:'수비\n어깨 힘 빼기',feedback:['어깨 힘 빼기']},initial.lessons[0].id);assert.equal(changed.lessons.length,1);assert.equal(changed.feedback.length,1);assert.equal(changed.cards.length,1);assert.equal(changed.lessons[0].createdAt,initial.lessons[0].createdAt)});
const mixed=`===1회차===
1회차 / 260508 / 왼손 셋업과 런지
팔로 밀지 않기.

===더콕 레슨 1회===
더콕 레슨 1회 / 260723 / 포핸드 스트로크와 백클리어
팔 힘보다 라켓 헤드를 사용하기.

===더콕 4~5회차===
더콕 4~5회차 / 261009 / 로테이션과 수비 받아내기
앞타점에서 수비하기.

===대회 / 강북구대회===
강북구대회 / 260620 / 예선 조1위 전승, 본선 탈락
잘한 것
서브가 안정적이었다.
못한 것
팔로 밀어서 침
다음 대회에서 개선하고 싶은 것
앞타점에서 수비하기.

===13-14회차===
13-14회차 / 260622, 260624 / 커트와 스매싱
팔로 밀지 않기.
`;
test('all five requested mixed blocks are recognized with title, dates and ranges',()=>{
  const rows=parseTXT(mixed);assert.equal(rows.length,5);
  assert.deepEqual(rows.map(r=>[r.recordType,r.lessonSource,r.date]),[['lesson','club','2026-05-08'],['lesson','academy','2026-07-23'],['lesson','academy','2026-10-09'],['competition','club','2026-06-20'],['lesson','club','2026-06-22']]);
  assert.equal(rows[0].title,'왼손 셋업과 런지');assert.equal(rows[1].lessonNumber,1);assert.equal(rows[2].displayLessonNumber,'4~5');assert.equal(rows[3].competitionName,'강북구대회');assert.equal(rows[3].result,'예선 조1위 전승, 본선 탈락');assert.equal(rows[4].displayLessonNumber,'13-14');assert.deepEqual(rows[4].lessonDates,['2026-06-22','2026-06-24']);assert.equal(rows.map(r=>r.rawText).join(''),mixed);assert.ok(rows.every(r=>!importRowError(r)));
});
test('explicit sources and header-less first lines obey detection priority',()=>{
  for(const [header,source] of [['클럽 / 1회차','club'],['아카데미 / 1회차','academy'],['더콕 레슨 2회','academy']]){const row=parseTXT(`===${header}===\n1회차 / 2026/05/08 / 제목`)[0];assert.equal(row.recordType,'lesson');assert.equal(row.lessonSource,source);assert.equal(row.date,'2026-05-08')}
  const row=parseTXT('===알 수 없는 헤더===\n대회 / 강북구대회 / 260620 / 결과')[0];assert.equal(row.recordType,'competition');assert.equal(row.competitionName,'강북구대회');
  assert.equal(parseTXT('더콕 레슨 1회 / 260723 / 제목')[0].lessonSource,'academy');
  const withoutNumber=parseTXT('===아카데미===\n2026-07-23\n코칭')[0];assert.equal(withoutNumber.recordType,'lesson');assert.equal(withoutNumber.lessonSource,'academy');assert.match(importRowError(withoutNumber),/회차/);
  assert.equal(parseTXT('===더콕 대회 / 지역대회===\n지역대회 / 260620 / 결과')[0].recordType,'competition');
});
test('all date formats normalize and impossible dates are rejected',()=>{
  for(const input of ['260508','2026-05-08','2026.05.08','2026/05/08','2026.5.8'])assert.equal(normalizeDate(input),'2026-05-08');
  for(const input of ['260230','2026-13-08','garbage'])assert.equal(normalizeDate(input),'');
  assert.equal(normalizeDate('240229'),'2024-02-29');
});
test('unclassified and prefix records stay visible with their untouched text',()=>{
  const text='설명 없이 남긴 기억\n===알 수 없는 기록===\n날짜 없는 기록\n===더콕 레슨 2회===\n더콕 레슨 2회 / 260724 / 제목';const rows=parseTXT(text);assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.recordType==='unclassified').length,2);assert.ok(rows.slice(0,2).every(r=>!r.selected));assert.equal(rows.map(r=>r.rawText).join(''),text);
  const broken=parseTXT('===3회차===\n3회차 / 260230 / 제목')[0];assert.equal(broken.date,'');assert.match(importRowError(broken),/날짜/);
});
test('mixed import adds separate competitions, connects feedback and protects existing records',()=>{
  const original=addLesson(emptyDB(),{lessonSource:'club',lessonNumber:36,date:'2026-10-02',rawText:'내가 수동으로 입력한 원문',coachName:'코치 A',categories:['드라이브'],feedback:['팔로 밀지 않기.'],good:'기존 잘된 점',feeling:'기존 감각',focus:'기존 집중점'});const snapshot=JSON.stringify(original);const savedLesson=JSON.stringify(original.lessons[0]);
  const result=importRecords(original,parseTXT(mixed));assert.equal(result.imported,5);assert.equal(JSON.stringify(original),snapshot);assert.equal(JSON.stringify(result.db.lessons[0]),savedLesson);assert.equal(result.db.lessons.length,5);assert.equal(result.db.competitions?.length,1);
  const c=result.db.competitions![0];assert.equal(c.name,'강북구대회');assert.equal(c.strengths,'서브가 안정적이었다.');assert.equal(c.weaknesses,'팔로 밀어서 침');assert.equal(c.goals,'앞타점에서 수비하기.');assert.ok(c.rawText.includes('===대회 / 강북구대회==='));
  const g=groupStats(result.db).find(g=>g.name==='앞타점에서 수비하기.')!;assert.equal(g.sourceCount,2);assert.equal(groupStats(result.db).find(g=>g.name==='팔 힘보다 라켓 헤드를 사용하기.')?.sourceCount,1);assert.equal(g.counts.competition,1);assert.equal(groupStats(result.db,'competition').reduce((s,g)=>s+g.occurrenceCount,0),2);assert.ok(result.db.cards.every(card=>!result.db.feedback.find(f=>f.id===card.feedbackId)?.competitionId));
});
test('duplicates use type, source, range and date and include within-file duplicates',()=>{
  const rows=parseTXT(mixed);const first=importRecords(emptyDB(),rows);assert.ok(rows.every(r=>isDuplicateImport(first.db,r)));const again=importRecords(first.db,rows);assert.equal(again.imported,0);assert.equal(again.skipped,5);assert.equal(again.db.lessons.length,4);assert.equal(again.db.competitions?.length,1);
  assert.equal(isDuplicateImport(first.db,{...rows[0],date:'2026-05-09'}),false);assert.equal(isDuplicateImport(first.db,{...rows[0],lessonSource:'academy'}),false);assert.equal(isDuplicateImport(first.db,{...rows[4],displayLessonNumber:'13~14'}),true);
  const twice=importRecords(emptyDB(),[rows[0],{...rows[0],key:'duplicate'}]);assert.equal(twice.imported,1);assert.equal(twice.skipped,1);
});
test('all requested ranges and CRLF delimiters preserve original text',()=>{
  for(const range of ['13-14','16-17','22~27','4~5']){const text=`===${range}회차===\r\n${range}회차 / 2026.05.08 / 제목\r\n본문\r\n`;const r=parseTXT(text)[0];assert.equal(r.displayLessonNumber,range);assert.equal(r.rawText,text);assert.equal(r.bodyText,'본문')}
});
test('manual preview classification imports unknown records without changing original text',()=>{
  const row=parseTXT('===일기===\n260508\n내가 남긴 코칭')[0];assert.equal(row.recordType,'unclassified');const fixed={...row,recordType:'lesson' as const,displayLessonNumber:'10',lessonNumber:10,selected:true};const result=importRecords(emptyDB(),[fixed]);assert.equal(result.imported,1);assert.equal(result.db.lessons[0].rawText,row.rawText);
});
test('legacy localStorage data loads without migration or write and retains manual dates',()=>{
  const db=addLesson(emptyDB(),{lessonSource:'club',lessonNumber:1,date:'2026-05-09',rawText:'기존 수동 기록',coachName:'기존 코치',categories:['수비'],feedback:['앞타점'],good:'',feeling:'',focus:''});const raw=JSON.stringify(db);let writes=0;const data=new Map([['kok-recall-v1',raw]]);const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>{writes++;data.set(key,value)}}});
  try{const loaded=repository.load();assert.deepEqual(loaded,db);assert.equal(loaded.lessons[0].date,'2026-05-09');assert.equal(writes,0);assert.equal(data.get('kok-recall-v1'),raw);const result=importRecords(loaded,parseTXT(mixed));repository.save(result.db);const reloaded=repository.load();assert.deepEqual(reloaded.lessons[0],db.lessons[0]);assert.equal(reloaded.competitions?.length,1);assert.equal(writes,1);assert.ok(validateDatabase(JSON.parse(JSON.stringify(reloaded))))}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage')}
});
