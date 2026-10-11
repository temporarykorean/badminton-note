import {useState} from 'react';
import {ArrowRight,Upload,Check,AlertCircle} from 'lucide-react';
import {type Database,type ImportRow,parseTXT,isDuplicateImport,importRowError,importRecords,groupStats} from './domain';
interface Props {db:Database; save:(db:Database)=>Promise<boolean>; notify:(message:string)=>void; go:(page:string)=>void}
export function ImportPage({db,save,notify,go}:Props){
  const [defaultSource,setDefaultSource]=useState('club');
  const [text,setText]=useState('');
  const [rows,setRows]=useState<ImportRow[]>([]);
  const [done,setDone]=useState<{imported:number;skipped:number}|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const preview=(value:string)=>{const parsed=parseTXT(value,defaultSource).map(r=>({...r,selected:r.selected&&!isDuplicateImport(db,r)}));setRows(parsed);setDone(null);setError(parsed.length?'':'가져올 기록이 없어요. TXT 내용을 확인해 주세요.')};
  const patch=(key:string,change:Partial<ImportRow>)=>{setRows(current=>current.map(r=>{if(r.key!==key)return r;const next={...r,...change};if(change.displayLessonNumber!==undefined)next.lessonNumber=Number(change.displayLessonNumber.match(/^\d+/)?.[0]||0);if(isDuplicateImport(db,next))next.selected=false;return next}));setError('')};
  const selected=rows.filter(r=>r.selected&&!isDuplicateImport(db,r));
  const unknown=rows.filter(r=>r.recordType==='unclassified');
  const summary={club:rows.filter(r=>r.recordType==='lesson'&&r.lessonSource==='club').length,academy:rows.filter(r=>r.recordType==='lesson'&&r.lessonSource==='academy').length,competition:rows.filter(r=>r.recordType==='competition').length};
  const submit=async()=>{if(busy)return;setError('');if(unknown.length){setError(`분류하지 못한 기록 ${unknown.length}개가 있습니다. 직접 분류하거나 선택을 해제한 상태로 제외 여부를 확인해 주세요.`);if(!confirm(`미분류 기록 ${unknown.length}개를 제외하고 가져올까요? 원문은 미리보기에 남습니다.`))return}
    if(!selected.length){setError('가져올 새 기록을 선택하세요.');return}
    const invalid=selected.find(r=>importRowError(r));if(invalid){setError(`${invalid.header}: ${importRowError(invalid)}`);return}
    setBusy(true);try{const result=importRecords(db,rows);if(await save(result.db)){setDone({imported:result.imported,skipped:rows.filter(r=>isDuplicateImport(db,r)).length+result.skipped});notify(`${result.imported}개 기록을 가져왔습니다. 기존 기록은 그대로 유지했습니다.`)}else setError('가져오기 0개 완료 · 선택한 기록 전체를 저장하지 못했습니다. 상단 동기화 오류를 확인하고 다시 시도하세요.')}catch(e){setError(e instanceof Error?e.message:'가져오기에 실패했습니다.')}finally{setBusy(false)}
  };
  const renderRow=(r:ImportRow)=>{const duplicate=isDuplicateImport(db,r);const validation=importRowError(r);return <article className={'import-preview-card '+(duplicate?'duplicate':'')} key={r.key}>
    <div className="import-preview-top"><label className="import-check"><input type="checkbox" checked={r.selected&&!duplicate} disabled={duplicate} onChange={e=>patch(r.key,{selected:e.target.checked})}/><span>{r.recordType==='lesson'?'레슨':r.recordType==='competition'?'대회':'분류 안 됨'}</span>{r.recordType==='lesson'&&<span className={'badge '+(r.lessonSource==='academy'?'blue':'green')}>{db.sources.find(s=>s.id===r.lessonSource)?.name||r.lessonSource}</span>}</label>{duplicate&&<span className="duplicate-label"><Check size={15}/> 이미 존재하는 기록입니다.</span>}</div>
    <h3>{r.recordType==='competition'?r.competitionName||'대회명 확인 필요':r.recordType==='lesson'?`${r.lessonSource==='academy'&&/더콕/.test(r.header)?'더콕 ':''}${r.displayLessonNumber||'?'}회차`:r.header||'제목 없는 기록'}</h3>
    <p className="import-detected-title">{r.date||'날짜 확인 필요'}{r.title&&` · ${r.title}`}</p>
    {r.lessonDates.length>1&&<p className="small-muted">함께 기록된 날짜: {r.lessonDates.join(', ')} · 대표 날짜는 첫 날짜입니다.</p>}
    <div className="import-fields"><label>기록 유형<select value={r.recordType} onChange={e=>patch(r.key,{recordType:e.target.value as ImportRow['recordType'],selected:true})}><option value="unclassified">분류 안 됨</option><option value="lesson">레슨</option><option value="competition">대회</option></select></label>
      {r.recordType==='lesson'&&<><label>레슨 출처<select value={r.lessonSource} onChange={e=>patch(r.key,{lessonSource:e.target.value})}>{db.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>회차 / 범위<input value={r.displayLessonNumber} onChange={e=>patch(r.key,{displayLessonNumber:e.target.value})} placeholder="예: 13-14"/></label></>}
      {r.recordType==='competition'&&<label>대회명<input value={r.competitionName} onChange={e=>patch(r.key,{competitionName:e.target.value})} placeholder="예: 강북구대회"/></label>}
      <label>날짜<input type="date" value={r.date} onChange={e=>patch(r.key,{date:e.target.value})}/></label>
      <label className="import-wide">제목<input value={r.title} onChange={e=>patch(r.key,{title:e.target.value})}/></label>
      {r.recordType==='competition'&&<label className="import-wide">대회 결과<input value={r.result} onChange={e=>patch(r.key,{result:e.target.value})}/></label>}
    </div>
    {validation&&!duplicate&&<p className="import-warning"><AlertCircle size={15}/>{validation}</p>}
    <p className="import-body-preview">{(r.bodyText||r.rawText).slice(0,300)}</p>
    <details className="raw"><summary>보존되는 원문 확인</summary><pre>{r.rawText}</pre></details>
  </article>};
  return <><div className="page-heading"><div><span className="eyebrow">BRING YOUR MEMORIES</span><h1>{done?'지금까지의 내 배드민턴':'묻혀 있던 코칭을 꺼내세요'}</h1><p>클럽 · 아카데미 · 대회 기록을 하나의 TXT로 가져오세요.</p></div></div>
    {done?<section className="card padded"><h2>{done.imported}개 기록을 가져왔어요</h2><p>이미 존재하는 기록 {done.skipped}개는 제외했습니다.</p><p>총 {db.lessons.length+(db.competitions?.length||0)}개 기록 · 레슨 {db.lessons.length}개 · 대회 {db.competitions?.length||0}개</p>{db.sources.map(s=><p key={s.id}>{s.name} {db.lessons.filter(l=>l.lessonSource===s.id).length}회</p>)}<h3>반복 피드백 TOP 5</h3>{groupStats(db).slice(0,5).map(g=><p key={g.id}>{g.name} · {g.occurrenceCount}개 기록에서 등장</p>)}<div className="grade-buttons"><button className="primary" onClick={()=>go('lessons')}>전체 기록 보기</button><button className="secondary" onClick={()=>setDone(null)}>미리보기로 돌아가기</button></div></section>:<>
      <section className="card padded"><label>출처가 없는 레슨의 기본 출처<select value={defaultSource} onChange={e=>setDefaultSource(e.target.value)}>{db.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="small-muted">더콕·아카데미·클럽·대회 표기는 자동 인식합니다. 기본 출처를 바꾼 뒤에는 미리보기를 다시 실행하세요.</p>
      <label className="upload-area"><Upload size={28}/><strong>TXT 파일 선택하기</strong><span>혼합 기록도 파일을 나누지 않아도 됩니다.</span><input type="file" accept=".txt,text/plain" onChange={async e=>{const file=e.target.files?.[0];if(file){try{const value=await file.text();setText(value);preview(value)}catch{setError('파일을 읽지 못했어요. 다시 선택해 주세요.')}}}}/></label>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={'===1회차===\n1회차 / 260508 / 왼손 셋업과 런지\n\n===더콕 레슨 1회===\n더콕 레슨 1회 / 260723 / 포핸드 스트로크\n\n===대회 / 강북구대회===\n강북구대회 / 260620 / 예선 조1위 전승, 본선 탈락'}/><button className="secondary" onClick={()=>preview(text)}>가져오기 미리보기</button></section>
      {error&&<div className="notice" role="alert">{error}</div>}
      {!!rows.length&&<><section className="card padded import-summary"><h2>총 {rows.length}개 기록을 찾았습니다.</h2><div className="import-summary-counts"><span>클럽 레슨 <b>{summary.club}</b>개</span><span>아카데미 레슨 <b>{summary.academy}</b>개</span><span>대회 <b>{summary.competition}</b>개</span><span>분류 안 됨 <b>{unknown.length}</b>개</span></div><p>선택된 새 기록 {selected.length}개 · 중복 {rows.filter(r=>isDuplicateImport(db,r)).length}개 자동 제외</p></section>
      {!!unknown.length&&<section className="card padded unclassified-list"><h2>분류하지 못한 기록 {unknown.length}개가 있습니다.</h2><p>어떤 기록도 조용히 버리지 않습니다. 아래에서 기록 유형과 날짜를 직접 정해 주세요.</p>{unknown.map(renderRow)}</section>}
      <section className="card padded"><h2>자동 인식된 기록</h2><p>날짜·출처·회차를 확인하세요. 회차 범위는 하나의 원문 기록으로 보관됩니다.</p>{rows.filter(r=>r.recordType!=='unclassified').map(renderRow)}<button className="primary" onClick={submit} disabled={busy||!selected.length}>선택한 {selected.length}개 기록 가져오기 <ArrowRight size={17}/></button></section></>}
    </>}
  </>;
}
