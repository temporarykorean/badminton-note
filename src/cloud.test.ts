import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyDB,parseTXT,importRecords,groupStats,structure,addLesson,answerCard,saveCompetition} from './domain.ts';
import {validateDatabase,accountDraftRepository,repository,STORAGE_KEYS,type EditorDraft} from './repository.ts';
import {mergeDatabase} from './data/merge.ts';
import {createCloudAccess} from './data/cloudAccess.ts';
const text='===1회차===\n1회차 / 260508 / 드라이브\n드라이브\n타점은 앞에서 맞추기\n1.\n===더콕 4~5회차===\n더콕 4~5회차 / 261009 / 수비\n수비\n팔로 밀지 않기\n===대회 / 강북구대회===\n강북구대회 / 260620 / 예선 통과\n못한 것\n2.\n앞타점 준비\n다음 대회에서 개선하고 싶은 것\n3.\n팔로 밀지 않기';
const fixture=()=>importRecords(emptyDB(),parseTXT(text)).db;
test('migration preserves all source types, original ranges, dates, IDs and review history',()=>{const local=fixture();local.cards[0]=answerCard(local.cards[0],true);local.sessions.push({id:'review',date:'2026-10-10',total:1,correct:1,incorrect:0,wrongFeedbackIds:[]});const original=structuredClone(local);const merged=mergeDatabase(emptyDB(),local);assert.equal(merged.imported,3);assert.deepEqual(merged.db.lessons,local.lessons);assert.deepEqual(merged.db.competitions,local.competitions);assert.deepEqual(merged.db.cards,local.cards);assert.deepEqual(merged.db.sessions,local.sessions);assert.deepEqual(local,original);assert.ok(validateDatabase(merged.db))});
test('migration repeated twice and independently parsed TXT are idempotent',()=>{const local=fixture();const first=mergeDatabase(emptyDB(),local);const second=mergeDatabase(first.db,local);assert.equal(second.imported,0);assert.deepEqual(second.db,first.db);const fresh=fixture();const third=mergeDatabase(first.db,fresh);assert.equal(third.imported,0);assert.equal(third.db.lessons.length,2);assert.equal(third.db.competitions?.length,1);assert.equal(third.db.feedback.length,first.db.feedback.length);assert.equal(third.db.cards.length,first.db.cards.length);const imported=importRecords(first.db,parseTXT(text));assert.equal(imported.imported,0);assert.equal(imported.skipped,3)});
test('migration respects existing cloud edits and review counters',()=>{const local=fixture();const cloud=structuredClone(local);cloud.lessons[0].date='2026-05-09';cloud.lessons[0].coachName='수정한 코치';cloud.cards[0]=answerCard(cloud.cards[0],true);const merged=mergeDatabase(cloud,local);assert.deepEqual(merged.db.lessons,cloud.lessons);assert.deepEqual(merged.db.cards,cloud.cards)});
test('meaningless number-only feedback is excluded without modifying original records',()=>{assert.deepEqual(structure('1.\n2.\n3.\n팔로 밀지 않기').feedback,['팔로 밀지 않기']);const db=fixture();assert.ok(db.lessons[0].rawText.includes('1.'));assert.ok(db.competitions?.[0].rawText.includes('2.'));assert.ok(!db.feedback.some(f=>/^\d+\.$/.test(f.content)));const group=db.groups[0];db.feedback.push({id:'noise',lessonId:db.lessons[0].id,content:'1.',type:'coaching',feedbackGroupId:group.id,importance:1});assert.ok(!groupStats(db).some(g=>g.entries.some(x=>x.feedback.id==='noise')));assert.ok(db.feedback.some(f=>f.id==='noise'))});
test('cloud transport roundtrip and CAS prevents overwriting a second device',async()=>{let row:{data:unknown;revision:number}|null=null;const api=createCloudAccess({async load(){return structuredClone(row)},async save(db,revision){if((row?.revision||0)!==revision)return [];row={data:structuredClone(db),revision:revision+1};return [row]}});const a=await api.load('user');const b=await api.load('user');const saved=await api.save(fixture(),a.revision);assert.equal(saved.revision,1);assert.deepEqual((await api.load('user')).db,saved.db);await assert.rejects(api.save(emptyDB(),b.revision),/CONFLICT/);assert.deepEqual((await api.load('user')).db,saved.db)});
test('cloud network failure and malformed data do not succeed or overwrite',async()=>{let writes=0;const api=createCloudAccess({async load(){return {data:{bad:true},revision:1}},async save(){writes++;throw new Error('offline')}});await assert.rejects(api.load('user'));await assert.rejects(api.save(fixture(),1),/offline/);await assert.rejects(api.save({} as ReturnType<typeof emptyDB>,1));assert.equal(writes,1)});
test('account drafts are isolated and legacy local data remains untouched',()=>{const map=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)}});repository.save(fixture());const raw=map.get(STORAGE_KEYS.data);const draft:EditorDraft={kind:'competition',editor:{name:'대회 초안'},updatedAt:new Date().toISOString()};repository.saveDraft(draft);const a=accountDraftRepository('a'),b=accountDraftRepository('b');assert.equal(a.loadDraft(),null);a.saveDraft(draft);assert.equal(b.loadDraft(),null);a.clearDraft();assert.deepEqual(repository.loadDraft(),draft);assert.equal(map.get(STORAGE_KEYS.data),raw)});

// Exercise the same parser/merge -> validation -> cloud save -> fresh load chain
// used by the UI, without touching an actual account or personal browser data.
function memoryCloud(){
 let row:{data:unknown;revision:number}|null=null;
 return createCloudAccess({async load(){return structuredClone(row)},async save(db,revision){if((row?.revision||0)!==revision)return [];row={data:structuredClone(db),revision:revision+1};return [structuredClone(row)]}});
}
test('mixed TXT persists through cloud access and a second import creates no records',async()=>{
 const api=memoryCloud();const initial=await api.load('test');
 const parsed=parseTXT(text);const imported=importRecords(initial.db,parsed);
 assert.equal(imported.imported,3);
 await api.save(imported.db,initial.revision);
 const loaded=await api.load('test');
 assert.deepEqual(loaded.db,imported.db);
 assert.equal(loaded.db.lessons.filter(l=>l.lessonSource==='club').length,1);
 assert.equal(loaded.db.lessons.filter(l=>l.lessonSource==='academy').length,1);
 assert.equal(loaded.db.competitions?.length,1);
 const repeated=importRecords(loaded.db,parseTXT(text));
 assert.equal(repeated.imported,0);
 await api.save(repeated.db,loaded.revision);
 assert.deepEqual((await api.load('test')).db,loaded.db);
});
test('local migration persists all linked data and repeating after cloud reload is idempotent',async()=>{
 const api=memoryCloud();const local=fixture();const original=structuredClone(local);
 local.sessions.push({id:'history',date:'2026-10-10',total:1,correct:1,incorrect:0,wrongFeedbackIds:[]});
 const initial=await api.load('test');const merged=mergeDatabase(initial.db,local);
 await api.save(merged.db,initial.revision);
 const loaded=await api.load('test');
 assert.deepEqual(loaded.db,merged.db);
 const repeated=mergeDatabase(loaded.db,local);
 assert.equal(repeated.imported,0);
 assert.deepEqual(repeated.db,loaded.db);
 assert.deepEqual(local.lessons,original.lessons);
 assert.deepEqual(local.competitions,original.competitions);
});

test('two device snapshots observe edits and deletions, and stale device writes conflict',async()=>{
 const api=memoryCloud();await api.save(fixture(),0);
 const a=await api.load('same-account'),b=await api.load('same-account');
 const competition=a.db.competitions![0];
 const edited=saveCompetition(a.db,{...competition,result:'수정된 결과'},competition.id);
 await api.save(edited,a.revision);
 const refreshedB=await api.load('same-account');
 assert.equal(refreshedB.db.competitions![0].result,'수정된 결과');
 await assert.rejects(api.save(b.db,b.revision),/CONFLICT/);
 const ids=refreshedB.db.feedback.filter(f=>f.competitionId===competition.id).map(f=>f.id);
 const deleted={...refreshedB.db,competitions:[],feedback:refreshedB.db.feedback.filter(f=>f.competitionId!==competition.id),cards:refreshedB.db.cards.filter(c=>!ids.includes(c.feedbackId))};
 await api.save(deleted,refreshedB.revision);
 const refreshedA=await api.load('same-account');
 assert.equal(refreshedA.db.competitions?.length,0);
 assert.deepEqual(refreshedA.db.lessons,a.db.lessons);
 assert.ok(!refreshedA.db.feedback.some(f=>f.competitionId===competition.id));
});
