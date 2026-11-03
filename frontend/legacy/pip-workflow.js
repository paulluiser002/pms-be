/* Local PIP workflow. Evaluation snapshots are copied, never changed. */
UR.pipPlans??=[];
function pipCompany(){return data.pmsActiveCompanyId||'mayon'}
function pipCopy(value){return JSON.parse(JSON.stringify(value))}
function pipText(value){return typeof value==='string'?value.trim():''}
function pipNumber(value){return (typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value))&&Number(value)>=0}
function pipDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
function pipId(){return 'PIP-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)}
function pipStaff(employee){return (urHr()||viewRole==='Manager')&&employee!==urUser()&&pdCanJournal(employee)}
function pipEmployeeAllowed(employee){const e=data.employees.find(e=>e[0]===employee);return !!e&&pmsGoalEmployeeInCompany(e)&&(viewRole==='Employee'?employee===urUser():pipStaff(employee))}
function pipCanView(plan){return !!plan&&plan.companyId===pipCompany()&&pipEmployeeAllowed(plan.employee)}
function pipCanManage(plan){return pipCanView(plan)&&pipStaff(plan.employee)}
function pipGet(id){return UR.pipPlans.find(p=>p.id===id&&pipCanView(p))||null}
function pipVisible(){return UR.pipPlans.filter(pipCanView).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
function pipIsClosed(plan){return !!plan&&['Completed','Completed with Exclusions','Not Met','Cancelled'].includes(plan.state)}
function pipOpenPlanFor(employee){return UR.pipPlans.find(p=>p.employee===employee&&pipCanView(p)&&!pipIsClosed(p))||null}
function pipError(error){return {ok:false,error}}
function pipEvent(plan,action,detail,by=urUser()){plan.updatedAt=pdNow();plan.history.push({action,by,at:plan.updatedAt,...(detail?{detail:pipCopy(detail)}:{})});urAudit('PIP '+action+': '+plan.id);return {ok:true,plan}}
function pipMeasured(row){return !!row&&row.verification==='Verified'&&pipNumber(row.actual)&&pipNumber(row.target)&&['Higher','Lower'].includes(row.direction)&&!!pipText(row.unit)}
function pipFailedIndicators(rows){return (rows||[]).filter(row=>pipMeasured(row)&&(row.direction==='Lower'?Number(row.actual)>Number(row.target):Number(row.actual)<Number(row.target)))}
function pipSourceOptions(employee){
 if(!pipEmployeeAllowed(employee))return [];
 return UR.cycles.filter(c=>c.status==='Completed'&&c.released&&pgScope(c,employee)&&c.resultSnapshots?.[employee]).flatMap(c=>{
  const snapshot=c.resultSnapshots[employee];if(snapshot.components?.goals===false||!Array.isArray(snapshot.goals))return [];
  const indicators=snapshot.goals.filter(pipMeasured);if(!indicators.length)return [];
  return [{cycleId:c.id,cycleName:c.name,score:snapshot.goalScore??null,indicators:pipCopy(indicators),template:pipCopy(snapshot.goalTemplate||c.goalTemplateSnapshots?.[employee]||null)}];
 });
}
function pipNew(employee,title,reason,origin,sources){const at=pdNow();const p={id:pipId(),employee,companyId:pipCompany(),title,reason,origin,state:origin==='Automatic'?'Awaiting Planning':'Draft',sources:pipCopy(sources),exclusions:[],weeks:[],history:[],createdAt:at,updatedAt:at,acknowledgedAt:null,needsReview:origin==='Automatic'};UR.pipPlans.push(p);return p}
function pipSync(){
 for(const employee of data.employees.map(e=>e[0]).filter(pipEmployeeAllowed)){
  for(const option of pipSourceOptions(employee)){
   if(!pipFailedIndicators(option.indicators).length)continue;
   if(UR.pipPlans.some(p=>p.companyId===pipCompany()&&p.employee===employee&&p.sources.some(s=>s.cycleId===option.cycleId)))continue;
   const source={...option,rule:'Any verified KPI indicator below its direction-specific target'};
   const open=pipOpenPlanFor(employee);
   if(open){open.sources.push(pipCopy(source));open.needsReview=true;pipEvent(open,'Evaluation referral added',{cycleId:source.cycleId},'System')}
   else pipEvent(pipNew(employee,'Performance Improvement Plan','Verified KPI results require improvement planning.','Automatic',[source]),'Automatically enrolled',{cycleId:source.cycleId},'System');
  }
 }
 return {ok:true,plans:pipVisible()};
}
function pipCreateManual(v={}){
 if(!pipEmployeeAllowed(v.employee)||!pipStaff(v.employee))return pipError('Choose an employee you can manage in the current company.');
 if(pipOpenPlanFor(v.employee))return pipError('This employee already has an open plan.');
 if(!pipText(v.title)||!pipText(v.reason))return pipError('Enter a plan title and enrollment reason.');
 let sources=[];
 if(v.sourceCycle){const source=pipSourceOptions(v.employee).find(s=>s.cycleId===v.sourceCycle);if(!source)return pipError('Choose a released KPI evaluation for this employee.');sources=[{...source,rule:'Manual enrollment with a documented reason'}]}
 return pipEvent(pipNew(v.employee,pipText(v.title),pipText(v.reason),'Manual',sources),'Manually enrolled');
}
function pipWeekErrors(weeks,complete){
 if(!Array.isArray(weeks))return 'Weekly sections must be an array.';
 if(complete&&!weeks.length)return 'Add at least one weekly section.';
 const ids=new Set();
 for(const w of weeks){
  if(!w||typeof w!=='object')return 'Invalid weekly section.';
  if(w.id&&ids.has(w.id))return 'Weekly sections must have unique IDs.';if(w.id)ids.add(w.id);
  if(complete&&['title','indicatorId','goal','actions','support','unit','direction','start','end'].some(k=>!pipText(w[k])))return 'Complete each weekly focus, goal, actions, support, target and period.';
  if((w.target!==undefined&&w.target!==null&&w.target!=='')&&!pipNumber(w.target)||complete&&!pipNumber(w.target))return 'Targets must be nonnegative numbers.';
  if(w.direction&&!['Higher','Lower'].includes(w.direction))return 'Choose Higher or Lower for target direction.';
  if(w.start&&!pipDate(w.start)||w.end&&!pipDate(w.end))return 'Enter valid weekly dates.';
  if(w.start&&w.end&&(Date.parse(w.end)-Date.parse(w.start)!==6*86400000))return 'Each weekly period must cover seven days.';
 }
 const dated=weeks.filter(w=>w.start&&w.end).slice().sort((a,b)=>a.start.localeCompare(b.start));
 if(dated.some((w,i)=>i&&w.start<=dated[i-1].end))return 'Weekly periods cannot overlap.';
 return '';
}
function pipNewWeek(w){const clean={id:w.id||pipId(),state:'Pending',actual:null,update:'',evidence:'',assessment:null,submissions:[]};for(const k of ['title','indicatorId','goal','actions','support','unit','direction','start','end','followUpFor','sourceCycleId','legacySourceWeekId'])clean[k]=pipText(w[k]);clean.target=pipNumber(w.target)?Number(w.target):null;return clean}
function pipSourceIndicators(p){return p.sources.flatMap(s=>(p.origin==='Automatic'?pipFailedIndicators(s.indicators):s.indicators).map(row=>({...row,sourceCycleId:s.cycleId,sourceCycleName:s.cycleName,sourceKey:JSON.stringify([s.cycleId,row.indicatorId||row.id])})))}
function pipWeekSource(p,w){if(w.sourceCycleId)return w.sourceCycleId;const matches=p.sources.filter(s=>s.indicators.some(x=>(x.indicatorId||x.id)===w.indicatorId));return matches.length===1?matches[0].cycleId:''}
function pipWeekProvenance(p,w){if(w.indicatorId==='custom')return 'Custom measurable improvement goal';const cycle=pipWeekSource(p,w),source=p.sources.find(s=>s.cycleId===cycle);return source?source.cycleName:'Historical source association is ambiguous; the original weekly criteria and evidence are preserved.'}
function pipFollowUpError(weeks,p){
 for(const w of weeks){if(!w.followUpFor)continue;const prior=weeks.find(x=>x.id===w.followUpFor);if(!prior||prior===w||prior.indicatorId!==w.indicatorId||!prior.end||!w.start||prior.end>=w.start)return 'Link a follow-up to an earlier week with the same indicator.';
  const previous=pipWeekSource(p,prior),current=pipWeekSource(p,w);if(previous!==current||!previous&&w.indicatorId!=='custom'&&w.legacySourceWeekId!==(prior.legacySourceWeekId||prior.id))return 'A follow-up must retain the earlier week’s source evaluation.';
 }return '';
}
function pipFocusError(p,weeks){
 const allowed=pipSourceIndicators(p);
 return weeks.some(w=>{if(!w.indicatorId||p.origin==='Manual'&&w.indicatorId==='custom')return false;
  const cycle=pipWeekSource(p,w);if(cycle)return !allowed.some(x=>x.sourceCycleId===cycle&&(x.indicatorId||x.id)===w.indicatorId);
  const prior=p.weeks.find(x=>x.id===w.followUpFor);return !(prior&&!pipWeekSource(p,prior)&&w.legacySourceWeekId===(prior.legacySourceWeekId||prior.id)&&w.indicatorId===prior.indicatorId);
 })?'Choose an indicator and its evaluation from the plan source evidence.':'';
}
function pipRequiredIndicators(p){return (p.sources||[]).flatMap(s=>pipFailedIndicators(s.indicators).map(x=>({...x,sourceCycleId:s.cycleId,sourceCycleName:s.cycleName,indicatorId:x.indicatorId||x.id})))}
function pipFocusCovered(p,focus){return (p.weeks||[]).some(w=>w.indicatorId===focus.indicatorId&&pipWeekSource(p,w)===focus.sourceCycleId)}
function pipExclusionErrors(p,exclusions=p.exclusions||[]){
 if(!Array.isArray(exclusions))return ['Exclusions must be a list of source indicators and reasons.'];
 const required=pipRequiredIndicators(p),seen=new Set(),errors=[];
 for(const x of exclusions){if(!x||!pipText(x.reason)){errors.push('Every exclusion requires a documented reason.');continue}const key=JSON.stringify([x.sourceCycleId,x.indicatorId]);
  if(seen.has(key))errors.push('An indicator can be excluded only once.');seen.add(key);
  if(!required.some(f=>f.sourceCycleId===x.sourceCycleId&&f.indicatorId===x.indicatorId))errors.push('Exclusions must reference a failed indicator and its source evaluation.');
  else if(pipFocusCovered(p,x))errors.push('An indicator cannot have both a weekly section and an exclusion. Restore it before adding a section.');
 }return errors;
}
function pipCoverageErrors(p){
 if(!p||pipIsClosed(p))return [];
 return [...pipExclusionErrors(p),...pipRequiredIndicators(p).filter(f=>!pipFocusCovered(p,f)&&!(p.exclusions||[]).some(x=>x.sourceCycleId===f.sourceCycleId&&x.indicatorId===f.indicatorId&&pipText(x.reason))).map(f=>'Declare a weekly section or exclusion for '+f.name+' · '+f.sourceCycleName+'.')];
}
function pipCleanExclusions(p,exclusions){return exclusions.map(x=>{const previous=(p.exclusions||[]).find(old=>old.sourceCycleId===x.sourceCycleId&&old.indicatorId===x.indicatorId&&old.reason===pipText(x.reason));return {sourceCycleId:x.sourceCycleId,indicatorId:x.indicatorId,reason:pipText(x.reason),by:previous?.by||urUser(),at:previous?.at||pdNow()}})}
function pipSetExclusions(id,exclusions,note=''){
 const p=pipGet(id);if(!pipCanManage(p)||pipIsClosed(p))return pipError('Only staff can change exclusions on an open plan.');
 const errors=pipExclusionErrors(p,exclusions);if(errors.length)return pipError(errors.join(' '));
 const before=pipCopy(p.exclusions||[]);p.exclusions=pipCleanExclusions(p,exclusions);return pipEvent(p,'Indicator exclusions updated',{before,exclusions:p.exclusions,note:pipText(note)});
}
function pipExcludeIndicator(id,sourceCycleId,indicatorId,reason){const p=pipGet(id);if(!p)return pipError('Plan unavailable.');const exclusions=(p.exclusions||[]).filter(x=>x.sourceCycleId!==sourceCycleId||x.indicatorId!==indicatorId);return pipSetExclusions(id,[...exclusions,{sourceCycleId,indicatorId,reason}])}
function pipSavePlan(id,draft={}){
 const p=pipGet(id);if(!pipCanManage(p)||!['Awaiting Planning','Draft'].includes(p.state))return pipError('Only staff can edit a plan awaiting activation.');
 const weeks=draft.weeks??p.weeks,exclusions=draft.exclusions??p.exclusions??[],error=pipWeekErrors(weeks,false)||pipFocusError(p,weeks)||pipFollowUpError(weeks,p)||pipExclusionErrors({...p,weeks},exclusions).join(' ');if(error)return pipError(error);
 p.title=draft.title===undefined?p.title:pipText(draft.title);p.reason=draft.reason===undefined?p.reason:pipText(draft.reason);p.weeks=weeks.map(w=>pipNewWeek({...w,sourceCycleId:pipWeekSource(p,w)}));p.exclusions=pipCleanExclusions(p,exclusions);p.state='Draft';return pipEvent(p,'Planning draft saved',{exclusions:p.exclusions});
}
function pipStart(id){
 const p=pipGet(id);if(!pipCanManage(p)||!['Awaiting Planning','Draft'].includes(p.state))return pipError('Only staff can activate a draft plan.');
 const error=pipWeekErrors(p.weeks,true)||pipFocusError(p,p.weeks)||pipFollowUpError(p.weeks,p)||pipCoverageErrors(p).join(' ');if(error)return pipError(error);
 if(!pipText(p.title)||!pipText(p.reason))return pipError('Enter a plan title and reason.');
 if(p.weeks.some(w=>w.start<urToday))return pipError('Plan weeks must start on or after the workflow day.');
 p.state='Active';p.needsReview=false;p.activatedAt=pdNow();return pipEvent(p,'Plan activated');
}
function pipWeekAvailable(plan,week){return !!plan&&plan.state==='Active'&&!!week&&pipDate(week.start)&&week.start<=urToday}
function pipUpdateWeek(id,wid,v={},submit=false){
 const p=pipGet(id),w=p?.weeks.find(x=>x.id===wid);
 if(viewRole!=='Employee'||p?.employee!==urUser()||!pipWeekAvailable(p,w)||w.state!=='Pending')return pipError('This week is unavailable or already submitted.');
 if(submit&&(!pipDate(w.end)||urToday<w.end))return pipError('Save a draft during the week; final submission opens on '+w.end+'.');
 const actual=v.actual===undefined?w.actual:v.actual,update=v.update===undefined?w.update:pipText(v.update),evidence=v.evidence===undefined?w.evidence:pipText(v.evidence);
 if(actual!==null&&actual!==''&&!pipNumber(actual)||submit&&!pipNumber(actual))return pipError('Enter a nonnegative actual result.');
 if(submit&&!update)return pipError('Describe your progress before submitting.');
 w.actual=pipNumber(actual)?Number(actual):null;w.update=update;w.evidence=evidence;
 if(submit){w.state='Submitted';w.submittedAt=pdNow();w.submissions??=[];w.submissions.push({actual:w.actual,update,evidence,by:urUser(),at:w.submittedAt})}
 return pipEvent(p,submit?'Weekly update submitted':'Weekly draft saved',{weekId:wid});
}
function pipAssessWeek(id,wid,v={}){
 const p=pipGet(id),w=p?.weeks.find(x=>x.id===wid),missed=w?.state==='Pending'&&w.end<urToday;if(!pipCanManage(p)||p.state!=='Active'||!w||w.state!=='Submitted'&&!missed)return pipError('Assess a submitted week, or record a missed update after its deadline.');
 if(!pipDate(w.end)||urToday<w.end)return pipError('Final assessment opens on the weekly period end date.');
 if(missed&&!pipText(v.missedUpdateReason))return pipError('Record why this overdue week is being assessed without an employee submission.');
 if(!pipNumber(v.actual)||!pipText(v.remarks))return pipError('Enter a verified actual and assessment remarks.');
 const actual=Number(v.actual),met=w.direction==='Lower'?actual<=w.target:actual>=w.target;
 w.assessment={actual,result:met?'Met':'Needs Improvement',remarks:pipText(v.remarks),by:urUser(),at:pdNow(),...(missed?{employeeUpdateMissing:true,missedUpdateReason:pipText(v.missedUpdateReason)}:{})};w.state='Assessed';return pipEvent(p,missed?'Missed update assessed':'Week assessed',{weekId:wid,assessment:w.assessment});
}
function pipReturnWeek(id,wid,reason){
 const p=pipGet(id),w=p?.weeks.find(x=>x.id===wid);if(!pipCanManage(p)||p.state!=='Active'||w?.state!=='Submitted')return pipError('Only submitted weeks can be returned.');
 if(!pipText(reason))return pipError('Enter a correction reason.');w.state='Pending';w.returnReason=pipText(reason);w.correctionReason=w.returnReason;return pipEvent(p,'Week returned for correction',{weekId:wid,reason:w.returnReason});
}
function pipExtend(id,week,reason){
 const p=pipGet(id);if(!pipCanManage(p)||p.state!=='Active')return pipError('Only active plans can be extended by staff.');
 if(!pipText(reason))return pipError('Enter an extension reason.');const error=pipWeekErrors([week],true)||pipFocusError(p,[week])||pipFollowUpError([...p.weeks,week],p)||pipExclusionErrors({...p,weeks:[...p.weeks,week]}).join(' ');if(error)return pipError(error);
 const last=p.weeks.reduce((end,w)=>w.end>end?w.end:end,'');if(week.start<=last||week.start<urToday)return pipError('Follow-up weeks must begin after existing weeks and on or after today.');
 const added=pipNewWeek({...week,sourceCycleId:pipWeekSource(p,week),id:pipId()});p.weeks.push(added);return pipEvent(p,added.followUpFor?'Follow-up week added':'Additional source week added',{weekId:added.id,sourceCycleId:added.sourceCycleId,reason:pipText(reason)});
}
function pipOutcome(p){if(!p?.weeks?.length||p.weeks.some(w=>w.state!=='Assessed'))return null;const leaves=p.weeks.filter(w=>!p.weeks.some(next=>next.followUpFor===w.id));return leaves.every(w=>w.assessment?.result==='Met')?(p.exclusions?.length?'Completed with Exclusions':'Completed'):'Not Met'}
function pipClose(id,note){
 const p=pipGet(id);if(!pipCanManage(p)||p.state!=='Active'||!p.weeks.length||p.weeks.some(w=>w.state!=='Assessed'))return pipError('Assess every week before closing the plan.');
 if(p.weeks.some(w=>!pipDate(w.end)||w.end>urToday))return pipError('Wait until every weekly period has ended before closing the plan.');
 const coverage=pipCoverageErrors(p);if(coverage.length)return pipError(coverage.join(' '));
 if(p.needsReview)return pipError('Review the new evaluation referrals before closing the plan.');
 if(!pipText(note))return pipError('Enter a closure note.');
 p.state=pipOutcome(p);p.closedAt=pdNow();p.closureNote=pipText(note);return pipEvent(p,'Plan closed: '+p.state,{note:p.closureNote});
}
function pipCancel(id,reason){const p=pipGet(id);if(!pipCanManage(p)||pipIsClosed(p))return pipError('Only staff can cancel an open plan.');if(!pipText(reason))return pipError('Enter a cancellation reason.');p.state='Cancelled';p.closedAt=pdNow();p.cancellationReason=pipText(reason);return pipEvent(p,'Plan cancelled',{reason:p.cancellationReason})}
function pipAcknowledge(id){const p=pipGet(id);if(viewRole!=='Employee'||p?.employee!==urUser()||p.state!=='Active')return pipError('Only the employee can acknowledge an active plan.');if(p.acknowledgedAt)return {ok:true,plan:p};p.acknowledgedAt=pdNow();return pipEvent(p,'Plan acknowledged')}

function pipReviewReferrals(id,note){const p=pipGet(id);if(!pipCanManage(p)||pipIsClosed(p)||!p.needsReview)return pipError('This plan has no pending referrals to review.');if(!pipText(note))return pipError('Enter a referral review note.');const coverage=pipCoverageErrors(p);if(coverage.length)return pipError(coverage.join(' '));p.needsReview=false;return pipEvent(p,'Evaluation referrals reviewed',{note:pipText(note)})}
