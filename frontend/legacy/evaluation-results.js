/* Results share the cycle's assigned goals, immutable finalization snapshot, and assessment records. */
function hrSampleData(){
 if(UR.hrPerformanceRevision){let changed=false;const draft=urCycle('hr-annual-2026');for(const id of draft?.participants||[])for(const link of cwLinks(draft,id)){const g=cwGoal(link);if(g&&!g.cycleId){g.cycleId=draft.id;changed=true}}const legacy=urCycle('pd-completed');if(legacy?.sample&&legacy.name==='Annual Performance Review 2026'){legacy.name='Historical Design Evaluation 2026';changed=true}if(changed)save();return}
 const specs=[
  {id:'EMP-001',position:'Product Designer',names:['Timely Completion of Design Deliverables','Accurate Design Documentation','Developer Handoff Completion'],targets:[95,100,100],actuals:[98,100,90],progress:[100,100,90],ratings:[[5,4,4,4,4],[4,4,4,4,4],[4,4,4,4,4]],
   strengths:['I delivered clear interaction specifications and resolved design questions quickly.','Maria turns complex requirements into practical designs and supports developer handoffs.','Design evidence shows reliable delivery and effective cross-team communication.'],improve:['I want to document edge cases earlier in the sprint.','Schedule an earlier handoff check to close the remaining implementation gaps.','Track documentation revisions so improvements can be measured next cycle.'],feedback:['The new navigation flows reduced ambiguity for the implementation team.','Continue the weekly design-to-development checkpoint, especially for complex states.','Agree a focused handoff improvement goal for the next evaluation period.']},
  {id:'EMP-002',position:'Software Engineer',names:['Sprint Deliverable Completion','Code Quality Compliance','Timely Resolution of Assigned Bugs'],targets:[90,95,90],actuals:[94,97,92],progress:[100,100,100],ratings:[[4,4,4,4,4],[5,4,5,4,4],[4,4,5,4,4]],
   strengths:['I completed the API commitments and added checks around critical endpoints.','James delivers dependable changes and helps colleagues investigate difficult defects.','Review evidence supports strong engineering quality and ownership.'],improve:['I should share implementation risks before sprint planning closes.','Improve early estimates for tasks involving external services.','Build a repeatable knowledge-sharing habit beyond the engineering team.'],feedback:['The regression checks helped keep the release stable while delivering the agreed scope.','Maintain the quality checks and lead one technical walkthrough next quarter.','Continue development toward broader technical coordination responsibilities.']},
  {id:'EMP-003',position:'Marketing Specialist',names:['Campaign Delivery','Marketing Lead Generation','Campaign Reporting'],targets:[100,120,100],actuals:[90,126,100],progress:[90,100,100],ratings:[[3,4,4,3,4],[4,4,4,3,4],[4,4,4,4,4]],
   strengths:['My campaign reporting made conversion trends easier to discuss with sales.','Sofia generated qualified leads above target and provided timely campaign reports.','The submitted evidence shows effective measurement and a constructive response to feedback.'],improve:['I need to reserve approval time before campaign launch dates.','Use a shared approval checklist to reduce late campaign releases.','Translate campaign findings into a clearer prioritization plan.'],feedback:['One campaign moved while awaiting creative approval; the remaining launches met the agreed dates.','Keep the lead-quality checks and raise approval risks in the weekly planning meeting.','Agree a launch-readiness milestone and review progress at the next coaching session.']}
 ];
 // Performance reporting can differ from HRDotNet's official reporting line.
 if(!data.pmsManagerAssignments['EMP-003'])data.pmsManagerAssignments['EMP-003']={managerId:'MGR-001',effective:'2026-01-01',updated:urToday};
 const bt=urTemplate('Core Workplace Behaviors','Manager','General Performance',[
  ...['Communication','Collaboration','Accountability','Initiative','Adaptability'].map(n=>urQuestion(n,'Rating','Workplace Competencies')),
  urQuestion('Strengths','Paragraph','Written Feedback'),urQuestion('Areas for Improvement','Paragraph','Written Feedback')
 ]);Object.assign(bt,{id:'hr-core-behaviors-v2',version:2,description:'Observed workplace behaviors and distinct evaluator feedback.'});UR.templates.push(bt);
 const draft=cwLegacyCycle();Object.assign(draft,{id:'hr-annual-2026',name:'Annual Performance Review 2026',description:'Position-specific assigned goals and shared workplace behaviors for Design, Engineering, and Marketing.',participants:specs.map(s=>s.id),behavioralTemplate:bt.id,scoring:{goals:'manager-verified',behavioral:'average'},sample:true});
 const completed=urClone(draft);Object.assign(completed,{id:'hr-completed-2026',status:'Completed',released:true,finalized:'2026-11-15',releasedAt:'2026-11-16',sample:true,resultSnapshots:{},goalTemplateSnapshots:{},behaviorSnapshots:{}});
 for(const spec of specs){
  const indicators=spec.names.map((name,i)=>({...pdIndicator(name,i===1&&spec.id==='EMP-003'?'Count':'Percentage',spec.targets[i]),weight:[34,33,33][i],scoreMet:5,scoreBelow:3.5}));
  const existing=UR.goalTemplates.find(t=>t.name===spec.position+' Performance Goals'&&t.position===spec.position&&t.status==='Published');
  if(existing)indicators.forEach((x,i)=>x.id=existing.indicators[i]?.id||x.id);
  const template={id:existing?.id||'hr-goals-'+spec.id,name:spec.position+' Performance Goals',description:'Position-specific targets; target met = 5, below target = 3.5, weighted by indicator. Confirmed illustrative sample policy.',position:spec.position,status:'Published',version:1,updated:urToday,indicators};if(existing)Object.assign(existing,template);else UR.goalTemplates.push(template);
  for(const cycle of [draft,completed]){cycle.goalTemplates[spec.id]=template.id;cycle.goalLinks[spec.id]=[]}
  indicators.forEach((indicator,i)=>{
   let g=data.goals.find(g=>cwAssigned(g,spec.id)&&cwPeriodGoal(g,draft)&&g.name===indicator.name);
   if(!g){
    const p=spec.progress[i],count=p===100?10:p===90?10:3,done=Math.round(p*count/100);
    g={id:pmsGoalId(),name:indicator.name,description:indicator.unit==='Count'?'Generate qualified leads during the evaluation period.':'Deliver the agreed position-specific outcome during the evaluation period.',employee:urPerson(spec.id).name,ownerId:spec.id,createdBy:'HR-001',createdByName:'Maria Angeles',createdAt:'2026-01-05T09:00:00Z',assignedBy:'Maria Angeles',source:'assigned',category:'Delivery',startDate:'2026-01-01',due:'2026-10-30',cycle:draft.id,progress:p,trackingMode:'milestones',status:p===100?'Completed':'Active',milestones:Array.from({length:count},(_,j)=>({id:urUid('ms'),title:(j===0?'Confirm agreed scope':j===count-1?'Validate final outcome':'Deliver checkpoint '+(j+1)),due:'2026-10-30',done:j<done,completedAt:j<done?'2026-10-15':null})),updates:[]};data.goals.push(g);
   }
   g.cycleId??=draft.id;g.evaluationCycles=[...new Set([...(g.evaluationCycles||[]),draft.id,completed.id])];g.evaluationTargets??={};g.evaluationTargets[draft.id]={target:indicator.target,unit:indicator.unit};g.evaluationTargets[completed.id]={target:indicator.target,unit:indicator.unit};
   const link={goalId:g.id,indicatorId:indicator.id,target:indicator.target,unit:indicator.unit,direction:indicator.direction,weight:indicator.weight,scoreMet:indicator.scoreMet,scoreBelow:indicator.scoreBelow,requiresVerification:true};
   draft.goalLinks[spec.id].push(urClone(link));completed.goalLinks[spec.id].push(urClone(link));
   g.evaluationActuals??={};g.evaluationActuals[completed.id]={value:spec.actuals[i],by:spec.id,at:'2026-11-05T09:00:00Z'};
   g.goalVerifications??={};g.goalVerifications[completed.id]={state:'Verified',by:'MGR-001',at:'2026-11-10T09:00:00Z',reason:'Actual accomplishment checked against the agreed target and supporting records.',signature:cwGoalSignature(g,completed),completionVerified:Number(g.progress)===100,history:[{state:'Pending',by:spec.id,at:'2026-11-05T09:00:00Z'},{state:'Verified',by:'MGR-001',at:'2026-11-10T09:00:00Z'}]};
  });
  completed.goalTemplateSnapshots[spec.id]=urClone(template);completed.behaviorSnapshots[spec.position]=urClone(bt);
 }
 UR.cycles.push(draft,completed);cwGenerate(completed);
 for(const spec of specs){
  pdStageRows(completed,spec.id).forEach((a,i)=>{a.state='Completed';a.submitted=['2026-11-05','2026-11-10','2026-11-14'][i];a.finalized='2026-11-15';a.updated=a.submitted;let j=0;a.answers=Object.fromEntries(a.template.questions.map(q=>[q.id,q.type==='Rating'?String(spec.ratings[i][j++]):q.title==='Strengths'?spec.strengths[i]:spec.improve[i]]));a.feedback=spec.feedback[i]});
  completed.resultSnapshots[spec.id]={goals:cwGoalRows(completed,spec.id),goalScore:cwGoalsScore(completed,spec.id),behaviorScore:cwBehaviorScore(completed,spec.id),weights:cwWeights(completed),scoring:urClone(completed.scoring),employee:urClone(urPerson(spec.id)),at:'2026-11-15T09:00:00Z'};
 }
 const legacy=urCycle('pd-completed');if(legacy?.sample)legacy.name='Historical Design Evaluation 2026';
 UR.hrPerformanceRevision=1;save();
}

function hrResultData(c,subject){
 const all=urCycleAssignments(c).filter(a=>a.subject===subject&&['Submitted','Completed'].includes(a.state));
 const stages=c.stages||c.groups.map(type=>({id:type,type,name:pdLabel[type]||type}));
 const groups=[];
 for(const stage of stages){const anonymous=stage.type==='Peer'&&c.anonymousPeer||stage.type==='Upward'&&c.anonymousUpward;if(anonymous&&groups.some(g=>g.anonymous&&g.stage.type===stage.type))continue;const rows=all.filter(a=>anonymous?a.type===stage.type:c.stages?a.stage===stage.id:a.type===stage.type);groups.push({stage:anonymous?{...stage,name:stage.type+' Feedback'}:stage,rows,anonymous,hidden:anonymous&&new Set(rows.map(a=>a.reviewer)).size<c.threshold})}

 const snapshot=c.resultSnapshots?.[subject],dimensions=c.stages?pdDimensionResults(c,subject):{},historicalGoals=!snapshot?.goals&&!cwV2(c)?dimensions.goals:null,goals=snapshot?.goals||(cwV2(c)?dimensions.goalRows:[]),weights=snapshot?.weights||(cwV2(c)?cwWeights(c):historicalGoals?c.weights:{goals:0,behavioral:100});
 const goalScore=snapshot?snapshot.goalScore:c.stages?dimensions.goalScore:null;
 const eligible=groups.filter(g=>!g.hidden).flatMap(g=>g.rows);
 const behaviorScore=snapshot?snapshot.behaviorScore:c.stages?dimensions.behaviorScore:urAvg(eligible.map(a=>pdOld.mean(a)));
 const hasGoals=snapshot?snapshot.components?.goals??!!snapshot.goals?.length:cwV2(c)?c.components.goals:!!historicalGoals,hasBehavior=snapshot?snapshot.components?.behavioral??true:cwV2(c)?c.components.behavioral:true;
 const overall=hasGoals&&goalScore==null||hasBehavior&&behaviorScore==null?null:pdWeighted(hasGoals?goalScore:null,hasBehavior?behaviorScore:null,weights);
 return {groups,goals,goalScore,behaviorScore,overall,weights,hasGoals,hasBehavior,historicalGoals,employee:snapshot?.employee||urPerson(subject)};
}
function hrHistoricalGoals(r){const a=r.historicalGoals;return `<section class="panel hr-result-section"><div class="panelhead"><div><h2>Goals Performance</h2><p>Historical template snapshot · assigned-goal links were not recorded</p></div><span class="hr-dimension-score">${hrScore(r.goalScore)}</span></div><div class="tablewrap"><table><thead><tr><th>HISTORICAL INDICATOR</th><th>TARGET</th><th>RECORDED ACTUAL</th><th>RECORDED SCORE</th></tr></thead><tbody>${a.goalsTemplate.indicators.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(hrTarget(x))}</td><td>${esc(a.actuals[x.id]??'Not recorded')}</td><td>${hrScore(pdIndicatorScore(x,a.actuals[x.id]))}</td></tr>`).join('')}</tbody></table></div><p class="hr-result-note">This older evaluation retains its original numerical snapshot. It has no linked goal history or Manager verification record. Use the three completed sample evaluations for the connected employee-goal workflow.</p></section>`}
function hrScore(n){return n==null?'Not available':urRating(n)}
function hrTarget(r){return (r.direction==='Lower'?'At most ':'At least ')+r.target+(r.unit==='Percentage'?'%':' '+r.unit.toLowerCase())}
function hrAchievement(r){if(r.verification!=='Verified')return 'Awaiting verification';if(r.actual==null)return 'Not recorded';return (r.direction==='Lower'?r.actual<=r.target:r.actual>=r.target)?'Achieved':Number(r.actual)>0?'Partially Achieved':'Not Achieved'}
function hrResultsGoals(c,r){return `<section class="panel hr-result-section"><div class="panelhead"><div><h2>Goals Performance</h2><p>Assigned goal records · Manager-verified actual results</p></div><span class="hr-dimension-score">${hrScore(r.goalScore)}</span></div>${!r.hasGoals?'<p class="hr-result-note">Goals Performance was not configured for this historical evaluation. No goal score has been inferred from behavioral responses.</p>':`<div class="tablewrap"><table><thead><tr>${['GOAL NAME','TARGET','ACTUAL RESULT','PROGRESS','VERIFICATION STATUS','ACHIEVEMENT RESULT'].map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${r.goals.map(g=>`<tr><td>${cwGoal(g)&&pmsGoalInScope(cwGoal(g))?`<button class="textbtn hr-goal-link" onclick="pmsViewGoal(${Number(g.goalId)})">${esc(g.name)}</button>`:`<b>${esc(g.name)}</b>`}</td><td>${esc(hrTarget(g))}</td><td>${g.actual==null?'Not recorded':esc(g.actual)+(g.unit==='Percentage'?'%':'')}</td><td>${progress(g.progress)}</td><td>${urBadge(g.verification==='Verified'&&Number(g.progress)<100?'Verified Result':g.verification)}</td><td>${urBadge(hrAchievement(g))}<small>${g.verification==='Verified'?'Score '+pdIndicatorScore(g,g.actual).toFixed(2)+' / 5 · Weight '+g.weight+'%':''}</small></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No assigned goals linked to this evaluation.</td></tr>'}</tbody></table></div><p class="hr-result-note">Progress tracks work completion. Achievement compares verified actuals with agreed targets. ${c.scoring.goals==='manager-verified'?'The score uses the configured target-met / below-target criteria and indicator weights.':'No scoring policy has been confirmed.'}</p>`}</section>`}
function hrResultsBehavior(c,r){
 const titles=[...new Set(r.groups.filter(g=>!g.hidden).flatMap(g=>g.rows.flatMap(a=>a.template.questions.filter(q=>q.type==='Rating').map(q=>q.title))))];
 return `<section class="panel hr-result-section"><div class="panelhead"><div><h2>Behavioral Performance</h2><p>${esc(cwV2(c)?c.behaviorSnapshots?.[r.employee.position]?.name||cwBehaviorTemplate(c,r.employee.id)?.name||'Behavioral Assessment Template':'Published assessment snapshots')} · 1–5 rating scale</p></div><span class="hr-dimension-score">${hrScore(r.behaviorScore)}</span></div>${!r.hasBehavior?'<p class="hr-result-note">Behavioral Performance was not included in this cycle.</p>':`<div class="tablewrap"><table><thead><tr><th scope="col">BEHAVIORAL INDICATOR</th>${r.groups.map(g=>`<th scope="col">${esc(g.stage.name)}${g.anonymous?' · Aggregated':''}</th>`).join('')}</tr></thead><tbody>${titles.map(title=>`<tr><td><b>${esc(title)}</b></td>${r.groups.map(g=>{const values=g.rows.flatMap(a=>a.template.questions.filter(q=>q.type==='Rating'&&q.title===title).map(q=>a.answers[q.id])).filter(v=>v&&v!=='NO').map(Number).filter(Number.isFinite),score=urAvg(values);return `<td>${g.hidden?'Withheld':score==null?'Not Observed':score.toFixed(g.rows.length===1?0:2)+' / 5'}</td>`}).join('')}</tr>`).join('')||'<tr><td colspan="'+(r.groups.length+1)+'" class="empty">No eligible numerical ratings recorded.</td></tr>'}</tbody></table></div><p class="hr-result-note">${esc(cwV2(c)||c.demoGoalMigration?cwPolicyLabel(c):r.historicalGoals?'Historical finalized behavioral snapshot — original score retained':'Average eligible finalized assessment scores')}. Unanswered and Not Observed responses are excluded. Narrative answers are not scored.${r.groups.some(g=>g.hidden)?' Anonymous feedback below the minimum response threshold is withheld.':''}</p>`}</section>`;
}
function hrResultsAssessments(c,r){return `<section class="panel hr-result-section"><div class="panelhead"><div><h2>Assessment Summary</h2><p>Individual assessment records remain separate from the finalized Employee Evaluation.</p></div></div><div class="tablewrap"><table><thead><tr>${['ASSESSMENT','EVALUATOR','SUBMISSION DATE','STATUS','BEHAVIORAL RATING'].map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${r.groups.map(g=>g.anonymous?`<tr><td>${esc(g.stage.name)}</td><td>Anonymous group</td><td>${g.hidden?'Withheld':g.rows.length+' submitted'}</td><td>${urBadge(g.hidden?'Protected':'Submitted')}</td><td>${g.hidden?'Withheld':hrScore(urAvg(g.rows.map(a=>pdOld.mean(a))))}</td></tr>`:g.rows.map(a=>`<tr><td>${urCanRead(a)?`<button class="textbtn" onclick="hrOpenEvaluationAssessment('${a.id}')">${esc(g.stage.name)}</button>`:esc(g.stage.name)}</td><td>${esc(urPerson(a.reviewer).name)}</td><td>${a.submitted?date(a.submitted):'Not submitted'}</td><td>${urBadge(a.submitted?'Submitted':a.state)}${a.finalized?'<small>Finalized '+date(a.finalized)+'</small>':''}</td><td>${r.hasBehavior?hrScore(pdOld.mean(a)):'Not applicable'}</td></tr>`).join('')).join('')}</tbody></table></div></section>`}
function hrResultsWritten(c,r){
 const buckets=[['Strengths','strength'],['Areas for Improvement','improv'],['Additional Written Feedback','additional']];
 return `<section class="panel hr-result-section"><div class="panelhead"><h2>Written Feedback</h2></div><div class="hr-feedback-grid">${buckets.map(([title,kind])=>`<div><h3>${title}</h3>${r.groups.map(g=>{
  if(g.hidden)return `<p class="hr-feedback-empty">${esc(g.stage.name)} feedback withheld to protect anonymity.</p>`;
  const comments=g.rows.flatMap(a=>[...a.template.questions.filter(q=>q.type!=='Rating'&&a.answers[q.id]&&(kind==='additional'?!/strength|improv/i.test(q.title):q.title.toLowerCase().includes(kind))).map(q=>({text:a.answers[q.id],a})),...(kind==='additional'&&a.feedback?[{text:a.feedback,a}]:[])]);
  return comments.map(({text,a})=>`<blockquote><b>${esc(g.stage.name)}</b><small>${g.anonymous?'Anonymous grouped feedback':esc(urPerson(a.reviewer).name)}</small><p>${esc(text)}</p></blockquote>`).join('');
 }).join('')||'<p class="hr-feedback-empty">No feedback recorded in this category.</p>'}</div>`).join('')}</div>${c.finalComments?.[r.employee.id]?`<div class="hr-result-note"><h3>Manager’s Final Comments</h3><p>${esc(c.finalComments[r.employee.id])}</p></div>`:''}</section>`;
}
urEmployeeResults=function(){
 const c=urCycle(urResultCycle),subject=urResultSubject;if(!c||!urCanResult(c,subject))return urEmpty('Results unavailable','Results have not been released to your role.');
 const r=hrResultData(c,subject),p=r.employee,policy=c.demoGoalMigration?'Demo historical results · configured goal criteria and '+cwPolicyLabel(c).toLowerCase()+'.':cwV2(c)?'Configured goal achievement criteria and '+cwPolicyLabel(c).toLowerCase()+'.':r.historicalGoals?'Historical evaluation snapshot · original component scores and weights retained.':'Historical behavioral assessment results; no assigned-goal score was recorded.';
 return pdBack("urGoTab('Reviews')",'Back to Reviews')+pdHead('Employee Evaluation Results',p.name+' · '+c.name)+
 `<section class="panel hr-result-section hr-result-overview"><div class="panelhead"><div><h2>Employee & Evaluation Overview</h2><p>${esc(policy)}</p></div><div class="hr-overall-rating"><small>Overall Performance Rating</small><strong>${hrScore(r.overall)}</strong></div></div><dl class="hr-overview-grid">${[['Employee Name',p.name],['Employee ID',p.id],['Position',p.position],['Department',p.department],['Review Cycle',c.name],['Evaluation Period',date(c.periodStart)+' – '+date(c.periodEnd)],['Evaluation Status',c.status==='Completed'?'Completed · HR finalized':c.status],['Results Visibility',c.released?'Released to permitted audience':'Not released']].map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`+
 `<section class="panel hr-result-section"><div class="panelhead"><h2>Performance Overview</h2></div><div class="hr-performance-overview"><div><small>Goals Performance · ${r.weights.goals}%</small><b>${hrScore(r.goalScore)}</b><p>${r.historicalGoals?'Original historical goal criteria snapshot.':r.hasGoals?'Verified actual outcomes against assigned targets.':'Not configured for this historical evaluation.'}</p></div><div><small>Behavioral Performance · ${r.weights.behavioral}%</small><b>${hrScore(r.behaviorScore)}</b><p>Eligible numerical ratings under the cycle’s scoring policy.</p></div></div></section>`+
 (r.historicalGoals?hrHistoricalGoals(r):hrResultsGoals(c,r))+hrResultsBehavior(c,r)+hrResultsAssessments(c,r)+
 `<section class="panel hr-result-section"><div class="panelhead"><h2>Overall Performance Summary</h2></div><div class="tablewrap"><table><thead><tr><th scope="col">PERFORMANCE DIMENSION</th><th scope="col">SCORE</th><th scope="col">CONFIGURED WEIGHT</th><th scope="col">WEIGHTED CONTRIBUTION</th></tr></thead><tbody>${[['Goals Performance',r.goalScore,r.weights.goals,r.hasGoals],['Behavioral Performance',r.behaviorScore,r.weights.behavioral,r.hasBehavior]].map(([label,score,weight,enabled])=>`<tr><td>${label}</td><td>${hrScore(score)}</td><td>${weight}%</td><td>${enabled&&score!=null?(score*weight/100).toFixed(2)+' / 5':'Not applicable'}</td></tr>`).join('')}</tbody></table></div><p class="hr-calculation">${r.overall==null?'No official consolidated result is available until all enabled dimensions have valid configured scores.':`${r.hasGoals&&r.hasBehavior?`(${r.goalScore.toFixed(4)} × ${r.weights.goals}%) + (${r.behaviorScore.toFixed(4)} × ${r.weights.behavioral}%)`:r.hasGoals?`${r.goalScore.toFixed(4)} × 100%`:`${r.behaviorScore.toFixed(4)} × 100%`} = <b>${hrScore(r.overall)}</b>`}<small>Calculation uses unrounded component scores. Displayed values are rounded to two decimal places.</small></p></section>`+
 hrResultsWritten(c,r)+(pdCanJournal(subject)?`<section class="panel hr-result-section"><div class="panelhead"><div><h2>Supporting Performance Records</h2><p>Confidential observations provide context and do not automatically affect ratings.</p></div><button onclick="hrOpenEvaluationJournal('${subject}')">View 202 File</button></div></section>`:'');
};

function hrOpenMatchingTemplate(){if(!urHr()||!cwAssignment)return;const position=cwPosition(cwAssignment.subject);urSaveCycleDraft();closeModal();pdEditGoalTemplate();if(pdGoalEditor){pdGoalEditor.position=position;pdGoalEditor.name=position+' Performance Goals';render()}}

function hrDemoGoalSpec(person){
 const specs={
  'Product Designer':[['Timely Completion of Design Deliverables','Accurate Design Documentation','Developer Handoff Completion'],[95,100,100],[98,100,90]],
  'Software Engineer':[['Sprint Deliverable Completion','Code Quality Compliance','Timely Resolution of Assigned Bugs'],[90,95,90],[95,97,85]],
  'Marketing Specialist':[['Campaign Delivery','Marketing Lead Generation','Campaign Reporting'],[100,120,100],[100,132,95]],
  'Marketing Lead':[['Campaign Portfolio Delivery','Marketing Team Planning','Campaign Budget Reporting'],[100,100,100],[100,100,90]],
  'HR Specialist':[['Onboarding Completion','Employee Case Resolution','HR Record Accuracy'],[100,95,100],[100,97,95]],
  'QA Engineer':[['Regression Test Execution','Critical Defect Coverage','Automated Test Delivery'],[100,95,20],[100,97,18]]
 };
 const [names,targets,actuals]=specs[person.position]||[[person.position+' Delivery Commitments',person.position+' Quality Compliance',person.position+' Reporting and Handoffs'],[90,95,100],[95,97,90]];
 return {names,targets,actuals,units:person.position==='Marketing Specialist'?['Percentage','Count','Percentage']:person.position==='QA Engineer'?['Percentage','Percentage','Count']:['Percentage','Percentage','Percentage']};
}
function hrDemoBehaviorScore(c,subject){
 const policy=c.scoring.behavioral;
 const rows=urCycleAssignments(c).filter(a=>a.subject===subject&&['Completed','Submitted'].includes(a.state)&&!urAnon(a)&&(policy==='average'||a.type===policy));
 return urAvg(rows.flatMap(a=>a.template.questions.filter(q=>q.type==='Rating').map(q=>a.answers[q.id])).filter(v=>v&&v!=='NO').map(Number).filter(n=>Number.isFinite(n)&&n>=1&&n<=5));
}
function hrMigrateCompletedDemoGoals(){
 if(UR.completedGoalDemoMigration)return;
 // A one-time manifest limits invented historical data to demo records present during this upgrade.
 const cycles=UR.cycles.filter(c=>c.status==='Completed');
 const manifest={version:1,source:'Local mockup demo data migration',at:pdNow(),cycles:[],evaluations:[]};
 for(const c of cycles){
  const subjects=[...new Set([...c.participants,...urCycleAssignments(c).filter(a=>a.state==='Completed').map(a=>a.subject)])];
  c.components={goals:true,behavioral:true};c.goalTemplates??={};c.goalLinks??={};c.goalTemplateSnapshots??={};c.resultSnapshots??={};
  c.scoring={goals:'manager-verified',behavioral:c.scoring?.behavioral||((c.stages||[]).some(s=>s.type==='HR')?'HR':'average')};
  if(!c.weights||!Number.isFinite(c.weights.goals)||!Number.isFinite(c.weights.behavioral)||c.weights.goals<=0||c.weights.behavioral<=0||Math.abs(c.weights.goals+c.weights.behavioral-100)>.01)c.weights={goals:60,behavioral:40};
  c.demoGoalMigration={source:manifest.source,at:manifest.at};manifest.cycles.push(c.id);
  for(const subject of subjects){
   const person=urPerson(subject),spec=hrDemoGoalSpec(person),previous=c.resultSnapshots[subject],responses=urCycleAssignments(c).filter(a=>a.subject===subject);
   const end=cwDateValid(c.periodEnd)?c.periodEnd:c.deadline,start=cwDateValid(c.periodStart)?c.periodStart:end;
   const finalized=c.finalized||responses.map(a=>a.finalized||a.submitted).filter(Boolean).sort().at(-1)||c.deadline||end;
   const verifiedAt=finalized.slice(0,10),completedAt=end;
   const existingTemplate=UR.goalTemplates.find(t=>t.status==='Published'&&!pdGoalTemplateErrors(t,true).length&&t.position===person.position&&spec.names.every(name=>t.indicators.some(x=>x.name===name)));
   const template=existingTemplate||{id:'demo-historical-goals-'+subject,name:person.position+' Performance Goals',position:person.position,description:'Historical demonstration criteria: target met = 5; below target = 3.5. Not production employee data.',status:'Published',version:1,updated:verifiedAt,indicators:spec.names.map((name,i)=>({...pdIndicator(name,spec.units[i],spec.targets[i]),weight:[34,33,33][i],scoreMet:5,scoreBelow:3.5}))};
   if(!existingTemplate)UR.goalTemplates.push(template);
   c.goalTemplates[subject]=template.id;c.goalTemplateSnapshots[subject]=urClone(template);
   const manager=responses.find(a=>a.type==='Manager')?.reviewer||urSupervisor(subject)||'MGR-001';
   const goals=spec.names.map((name,i)=>{
    const criterion=template.indicators.find(x=>x.name===name),priorLink=cwLinks(c,subject).find(l=>cwGoal(l)?.name===name);
    let g=priorLink&&cwGoal(priorLink);
    // Reuse the cycle's own assignments; never substitute this year's active goals for an earlier period.
    if(!cwAssigned(g,subject)||!cwDateValid(g.due)||g.due<start||g.due>end)g=data.goals.find(g=>cwAssigned(g,subject)&&g.name===name&&g.cycleId===c.id&&g.due>=start&&g.due<=end);
    if(!g){
     const done=i===2?9:10;
     g={id:pmsGoalId(),name,description:'Historical assigned goal created by the local mockup demo migration for '+c.name+'.',ownerId:subject,employee:person.name,source:'assigned',category:'Delivery',createdBy:'HR-001',createdByName:'Maria Angeles',assignedBy:'Maria Angeles',createdAt:start+'T09:00:00Z',startDate:start,due:end,cycleId:c.id,cycle:c.id,evaluationCycles:[c.id],progress:done*10,status:done===10?'Completed':'Active',trackingMode:'milestones',demoData:true,milestones:Array.from({length:10},(_,j)=>({id:urUid('milestone'),title:j===0?'Confirm '+name.toLowerCase()+' scope':j===9?'Validate final '+name.toLowerCase()+' outcome':'Complete '+name.toLowerCase()+' checkpoint '+(j+1),due:end,done:j<done,completedAt:j<done?completedAt:null})),updates:[]};data.goals.push(g);
    }
    const link={goalId:g.id,indicatorId:criterion.id,target:spec.targets[i],unit:spec.units[i],direction:criterion.direction,weight:criterion.weight,scoreMet:criterion.scoreMet,scoreBelow:criterion.scoreBelow,requiresVerification:true};
    const actual=spec.actuals[i];g.evaluationCycles=[...new Set([...(g.evaluationCycles||[]),c.id])];g.evaluationTargets??={};g.evaluationTargets[c.id]={target:link.target,unit:link.unit};g.evaluationActuals??={};g.evaluationActuals[c.id]={value:actual,by:subject,at:verifiedAt+'T09:00:00Z',source:manifest.source};
    const verification={state:'Verified',by:manager,at:verifiedAt+'T12:00:00Z',reason:'Demo migration: recorded historical actual checked against the agreed target; partial achievement remains distinct from work completion.',signature:cwGoalSignature(g,c),completionVerified:Number(g.progress)===100,source:manifest.source,history:[{state:'Pending',by:subject,at:verifiedAt+'T09:00:00Z'},{state:'Verified',by:manager,at:verifiedAt+'T12:00:00Z'}]};
    g.goalVerifications??={};g.goalVerifications[c.id]=verification;
    return {...link,name:g.name,due:g.due,progress:g.progress,actual,verification:'Verified',verificationRecord:urClone(verification),milestones:urClone(pmsGoalMilestones(g)),achievement:hrAchievement({...link,actual,verification:'Verified'}),goalScore:pdIndicatorScore(link,actual),source:manifest.source};
   });
   c.goalLinks[subject]=goals.map(({goalId,indicatorId,target,unit,direction,weight,scoreMet,scoreBelow,requiresVerification})=>({goalId,indicatorId,target,unit,direction,weight,scoreMet,scoreBelow,requiresVerification}));
   let behaviorScore=previous?.behaviorScore??hrDemoBehaviorScore(c,subject);
   if(behaviorScore==null){
    const t=urClone(UR.templates.find(t=>t.id==='hr-core-behaviors-v2')),type=c.scoring.behavioral==='average'?'HR':c.scoring.behavioral;let stage=c.stages?.find(s=>s.type===type);if(c.stages&&!stage){stage={id:urUid('demo-stage'),type,name:(pdLabel[type]||type)+' — Demo Supplement',deadline:verifiedAt};c.stages.push(stage)}if(!c.groups.includes(type))c.groups.push(type);
    // Preserve all original responses; a separately identified demo supplement supplies missing rating data.
    const supplement={id:urUid('demo-review'),cycle:c.id,subject,reviewer:type==='Self'?subject:type==='Manager'?manager:'HR-001',type,stage:stage?.id,deadline:c.deadline,template:t,state:'Completed',answers:Object.fromEntries(t.questions.map(q=>[q.id,q.type==='Rating'?'4':'Historical demonstration evidence reviewed.'])),feedback:'Demo supplement for the historical behavioral indicators; original assessment responses are retained.',submitted:verifiedAt,finalized:verifiedAt,demoData:true};
    UR.assignments.push(supplement);behaviorScore=hrDemoBehaviorScore(c,subject);
   }
   const goalScore=goals.reduce((sum,g)=>sum+g.goalScore*g.weight,0)/goals.reduce((sum,g)=>sum+g.weight,0);
   c.resultSnapshots[subject]={...(previous||{}),goals,goalScore,behaviorScore,weights:urClone(c.weights),scoring:urClone(c.scoring),components:{goals:true,behavioral:true},goalTemplate:urClone(template),employee:urClone(previous?.employee||person),at:finalized,source:manifest.source};
   manifest.evaluations.push({cycle:c.id,subject,goals:goals.length});
  }
 }
 UR.completedGoalDemoMigration=manifest;save();
}

const hrSnapshotDimensions=pdDimensionResults,hrSnapshotMean=urMean;
pdDimensionResults=function(c,subject){const s=c.resultSnapshots?.[subject];if(!s)return hrSnapshotDimensions(c,subject);return {rows:urCycleAssignments(c).filter(a=>a.subject===subject&&['Submitted','Completed'].includes(a.state)&&!urAnon(a)),goalRows:urClone(s.goals||[]),goalScore:s.goalScore,behaviorScore:s.behaviorScore}};
urMean=function(a){const c=urCycle(a.cycle),s=c.resultSnapshots?.[a.subject];return c.status==='Completed'&&s?pdWeighted(s.goalScore,s.behaviorScore,s.weights):hrSnapshotMean(a)};
const hrSnapshotExport=urExportResults;
urExportResults=function(id){const c=urCycle(id);if(!c?.demoGoalMigration)return hrSnapshotExport(id);if(!c.released)return;const rows=Object.keys(c.resultSnapshots).filter(subject=>urCanResult(c,subject)).map(subject=>{const s=c.resultSnapshots[subject];return [s.employee.name,c.name,hrScore(s.goalScore),hrScore(s.behaviorScore),hrScore(pdWeighted(s.goalScore,s.behaviorScore,s.weights))]});urDownloadCsv([['Employee','Cycle','Goals Performance','Behavioral Performance','Overall Performance Rating'],...rows],'hrdotnet-performance-evaluation-results.csv')};

let hrEvaluationReturn=null,hrPendingEvaluationScroll=null;
function hrEvaluationRecordId(cycle,employee){return urCycle(cycle)?.resultSnapshots?.[employee]?.id||cycle+'|'+employee}
function hrCaptureEvaluation(){
 const c=urCycle(urResultCycle);
 if(page!=='Reviews'||urScreen!=='result'||!c||!urCanResult(c,urResultSubject))return null;
 return {employeeId:urResultSubject,reviewCycleId:c.id,evaluationRecordId:hrEvaluationRecordId(c.id,urResultSubject),sourcePage:{page,screen:urScreen,tab:urTab},detail:urDetail,filter:urClone(urFilter),scrollTop:document.querySelector('main')?.scrollTop||0,userId:urUser(),role:viewRole,companyId:data.pmsActiveCompanyId||'mayon'};
}
function hrEvaluationReturnAllowed(ctx){const c=ctx&&urCycle(ctx.reviewCycleId);return !!c&&ctx.userId===urUser()&&ctx.role===viewRole&&ctx.companyId===(data.pmsActiveCompanyId||'mayon')&&ctx.evaluationRecordId===hrEvaluationRecordId(c.id,ctx.employeeId)&&urCanResult(c,ctx.employeeId)}
function hrRelatedEvaluationActive(){
 const ctx=hrEvaluationReturn;if(!hrEvaluationReturnAllowed(ctx))return false;
 if(ctx.relatedType==='journal')return page==='202 Files'&&pdEmployee===ctx.employeeId&&['journal','entry'].includes(pdView)&&pdCanJournal(pdEmployee);
 const a=UR.assignments.find(a=>a.id===urDetail);
 return page==='Reviews'&&urScreen==='review'&&a?.subject===ctx.employeeId&&a.cycle===ctx.reviewCycleId&&urVisible(a)&&urCanRead(a);
}
function hrOpenEvaluationJournal(employee){
 const ctx=hrCaptureEvaluation();if(!ctx||employee!==ctx.employeeId||!pdCanJournal(employee))return;
 urGo(()=>{hrEvaluationReturn={...ctx,relatedType:'journal',relatedRecordId:employee};pdOpenJournal(employee)});
}
function hrOpenEvaluationAssessment(id){
 const ctx=hrCaptureEvaluation(),a=UR.assignments.find(a=>a.id===id);
 if(!ctx||!a||a.subject!==ctx.employeeId||a.cycle!==ctx.reviewCycleId||!urVisible(a)||!urCanRead(a))return;
 urGo(()=>{hrEvaluationReturn={...ctx,relatedType:'assessment',relatedRecordId:id};urOpenReview(id)});
}
function hrReturnToEvaluation(){
 urGo(()=>{const ctx=hrEvaluationReturn;if(!hrEvaluationReturnAllowed(ctx)){hrEvaluationReturn=null;render();toast('Evaluation results are no longer available in your scope.');return}
  hrEvaluationReturn=null;page=ctx.sourcePage.page;urScreen=ctx.sourcePage.screen;urTab=ctx.sourcePage.tab;urResultCycle=ctx.reviewCycleId;urResultSubject=ctx.employeeId;urDetail=ctx.detail;urFilter=urClone(ctx.filter);pdView='';urDirty=false;
  hrPendingEvaluationScroll={key:ctx.reviewCycleId+'|'+ctx.employeeId,top:ctx.scrollTop};render();
 });
}
function hrRestoreEvaluationScroll(){if(hrPendingEvaluationScroll&&page==='Reviews'&&urScreen==='result'&&hrPendingEvaluationScroll.key===urResultCycle+'|'+urResultSubject){const main=document.querySelector('main');if(main)main.scrollTop=hrPendingEvaluationScroll.top;hrPendingEvaluationScroll=null}}
const hrRelatedJournalPage=pdJournalPage,hrRelatedAssessmentDetail=urReviewDetail;
pdJournalPage=function(){const html=hrRelatedJournalPage();return hrRelatedEvaluationActive()&&hrEvaluationReturn.relatedType==='journal'&&pdView==='journal'?html.replace(pdBack("pdView='';pdQuery='';render()",'Back to 202 Files'),pdBack('hrReturnToEvaluation()','Back to Evaluation Results')):html};
urReviewDetail=function(){const html=hrRelatedAssessmentDetail();return hrRelatedEvaluationActive()&&hrEvaluationReturn.relatedType==='assessment'?html.replace('onclick="urGoTab(\'Reviews\')"','onclick="hrReturnToEvaluation()"').replace('← Back to Reviews','← Back to Evaluation Results'):html};
const hrContextNavigate=navigate,hrContextGoTab=urGoTab,hrContextSetRole=setRole;
navigate=function(destination){urGo(()=>{hrEvaluationReturn=null;hrContextNavigate(destination)})};
urGoTab=function(tab){urGo(()=>{hrEvaluationReturn=null;hrContextGoTab(tab)})};
setRole=function(role){urGo(()=>{hrEvaluationReturn=null;hrPendingEvaluationScroll=null;hrContextSetRole(role)})};

// A field's text and required marker must remain one flex/grid item.
function hrNormalizeLabels(root=document){
 for(const label of root.querySelectorAll('label')){
  if(label.querySelector('.hr-field-label')||label.querySelector('input[type="checkbox"],input[type="radio"]'))continue;
  const control=label.querySelector('input,select,textarea'),nodes=[...label.childNodes];
  const heading=nodes.filter(n=>n.nodeType===3&&n.textContent.trim()||n.nodeType===1&&n.matches('span.required,span.pms-required'));
  if(!heading.length)continue;const line=document.createElement('span');line.className='hr-field-label';label.insertBefore(line,heading[0]);for(const n of heading)line.append(n);
  if(control&&line.textContent.includes('*'))control.setAttribute('aria-required','true');
 }
}
const hrRender=render,hrModal=modal;
let hrLastResult='';
render=function(){hrRender();hrNormalizeLabels();const key=page==='Reviews'&&urScreen==='result'?urResultCycle+'|'+urResultSubject:'';if(key&&key!==hrLastResult){const main=document.querySelector('main');if(main)main.scrollTop=0}hrLastResult=key;hrRestoreEvaluationScroll();if(hrEvaluationReturn&&!hrRelatedEvaluationActive())hrEvaluationReturn=null};
modal=function(...args){hrModal(...args);hrNormalizeLabels(document.getElementById('modal'))};
hrSampleData();
hrMigrateCompletedDemoGoals();
render();
