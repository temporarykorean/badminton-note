import {useEffect,useRef} from 'react';
import type {Lesson,ReviewCard} from './domain';
interface Props {card:ReviewCard;lesson:Lesson;sourceName:string;numberLabel:string;index:number;total:number;answer:string;revealed:boolean;setAnswer:(value:string)=>void;reveal:()=>void;grade:(value:boolean|'partial')=>void;openRecord:()=>void;alternatives:string[]}
export function ReviewQuestion({card,lesson,sourceName,numberLabel,index,total,answer,revealed,setAnswer,reveal,grade,openRecord,alternatives}:Props){
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{panel.current?.scrollIntoView({block:'start'})},[card.id]);
 const selectable=['choice','scenario'].includes(card.questionType);
 const options=[...new Set([card.answer,...alternatives])].slice(0,3).sort((a,b)=>a.localeCompare(b));
 return <section ref={panel} className="card padded review-panel contextual-review">
  <div className="review-progress"><span>{selectable?'코칭 선택':'코칭 회상'}</span><strong>{index+1} / {total}</strong></div>
  <div className="progress" aria-label="복습 진행률"><i style={{width:`${(index+1)/total*100}%`}}/></div>
  <p className="review-source">{lesson.date}{lesson.title&&` · ${lesson.title}`}</p>
  <h2 className="review-question">{card.question}</h2>
  {!revealed?<>{selectable?<div className="choices">{options.map(option=><button key={option} className={answer===option?'chosen':''} onClick={()=>setAnswer(option)}>{option}</button>)}</div>:<label className="recall-input">기억나는 교정 내용<textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="내 말로 적거나, 머릿속으로 떠올려도 좋아요."/></label>}<button className="primary" onClick={reveal} disabled={selectable&&!answer}>핵심 교정 확인하기</button></>:<>
   <div className="answer-box"><span className="eyebrow">핵심 교정 내용</span><h3>{card.answer}</h3><p className="review-source">{sourceName} {numberLabel}회차 · {lesson.date}</p><div className="evidence"><strong>근거가 된 원문</strong><blockquote>{card.sourceSnippet}</blockquote></div><button className="text-button" onClick={openRecord}>원본 기록 전체 보기</button></div>
   {selectable?<><p>{answer===card.answer?'잘 기억했어요!':'이 교정을 다시 기억해 두세요.'}</p><button className="primary" onClick={()=>grade(answer===card.answer)}>{index===total-1?'복습 마치기':'다음 질문'}</button></>:<><p className="self-assessment">표현이 달라도 괜찮아요. 핵심 교정을 얼마나 기억했는지 선택해 주세요.</p><div className="grade-buttons self-grade"><button className="primary" onClick={()=>grade(true)}>기억했어요</button><button className="secondary" onClick={()=>grade('partial')}>일부만 기억했어요</button><button className="secondary" onClick={()=>grade(false)}>다시 볼래요</button></div></>}
  </>}
 </section>;
}
