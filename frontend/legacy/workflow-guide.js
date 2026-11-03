/* Process reference only: exploring a workflow never changes employee records. */
const pmsWorkflowProcesses = [
 {id:'reviews',title:'Performance review cycle',summary:'From cycle setup to released results, with each required handoff.',nodes:[
  ['setup','Configure the cycle','HR',0,'Select the review type, period, participants, components, frozen templates, evaluator stages, deadlines and result visibility.','Every participant needs compatible published templates and authorized evaluators.'],
  ['ready','Ready to launch?','Decision',1,'Review the setup checks before launching now or scheduling activation.','Missing mappings, invalid dates, weights or evaluators block launch.','decision'],
  ['repair','Correct setup','HR',1,'Follow the readiness errors to the relevant setup step, correct them and validate again.','A failed readiness check must not create partial assignments.','branch'],
  ['launch','Launch or schedule','HR / System',2,'Freeze the cycle configuration. Activation creates cycle-specific accomplishment records and evaluator assignments.','A scheduled cycle is revalidated when due; an invalid cycle stays scheduled for HR repair.'],
  ['actuals','Submit and verify KPIs','Employee / Manager',3,'The employee reports actual results; the eligible manager verifies the evidence or returns it for correction.','Manager verification is required before the Manager assessment can be submitted.'],
  ['assess','Complete evaluator stages','Assigned evaluators',4,'Complete the configured stages in order, such as Self, Manager and HR, with Peer or Upward stages where configured.','All required responses in an earlier stage must be submitted before the next stage unlocks.'],
  ['finalize','Finalize the evaluation','HR',5,'Check completion and lock the calculated scores, weights and evidence in the result snapshot.','Required assessments must be submitted and required KPI accomplishments verified.'],
  ['release','Release results','HR',6,'Perform the separate release action so authorized employees and managers can view the finalized results.','Finalization alone does not make results visible.'],
  ['pip','Refer verified KPI failures','System',7,'A completed, released evaluation with any verified measurable KPI below its direction-specific target creates or updates a PIP referral.','The plan awaits Manager/HR planning; it does not start automatically.']
 ],edges:[['setup','ready'],['ready','repair','Fix setup'],['repair','ready','Recheck'],['ready','launch','Ready'],['launch','actuals'],['actuals','assess'],['assess','finalize'],['finalize','release'],['release','pip']],tour:['setup','ready','repair','ready','launch','actuals','assess','finalize','release','pip']},
 {id:'kpi',title:'KPI accomplishments',summary:'Report actual results, correct returned evidence and obtain manager verification.',nodes:[
  ['open','Open cycle indicators','Employee',0,'Open Goals and select the applicable cycle to see the frozen position-based KPI indicators, targets, direction and scoring criteria.','The employee reports results against the cycle snapshot; indicators and targets cannot be edited here.'],
  ['draft','Save actuals as a draft','Employee',1,'Enter actual results and optional remarks for the required indicators. Save unfinished work as a draft.','Actuals must be finite, nonnegative numbers; zero is a valid result.'],
  ['submit','Submit accomplishments','Employee',2,'After the evaluation period ends, submit the complete actuals within the submission window.','Submission locks the report while manager verification is pending.'],
  ['verify','Evidence acceptable?','Manager',3,'The eligible current manager reviews the submitted evidence and chooses Verify or Return with a reason.','Verification confirms the reported evidence; a verified result can still be below target.','decision'],
  ['correct','Correct and resubmit','Employee',3,'Read the return reason, correct the report and resubmit. Prior submitted values remain in history.','Returned work can be corrected through the verification deadline; HR must extend an expired window.','branch'],
  ['verified','Use verified results','System',4,'Verified actuals feed KPI scoring and unlock the Manager assessment gate.','Target success follows Higher/Lower direction. Only qualifying released results can trigger automatic PIP referral.']
 ],edges:[['open','draft'],['draft','submit'],['submit','verify'],['verify','correct','Return'],['correct','submit','Resubmit'],['verify','verified','Verify']],tour:['open','draft','submit','verify','correct','submit','verify','verified']},
 {id:'templates',title:'KPI Goal Templates',summary:'Publish reusable position-based indicators with flexible reference or scoring matrices.',nodes:[
  ['create','Create a position template','HR',0,'Create a KPI Goal Template and select the position it applies to.','Employees and managers consume the selected cycle snapshot.'],
  ['indicators','Define indicators','HR',1,'Add each indicator’s name, unit, target, Higher/Lower direction, weight and target/below-target scores.','Indicator weights must be positive and total 100%; scores stay within the configured 1–5 range.'],
  ['matrix','Add a matrix or scale','HR',2,'Create flexible rows and columns as reference criteria, or numeric threshold ranges as a scoring scale.','Use the explicit scoring toggle to choose whether the matrix determines scores.'],
  ['valid','Criteria valid?','Decision',3,'Preview results below, at and above the target, including zero and boundary values.','Scoring ranges must be complete, ordered, non-overlapping and consistent with the indicator direction.','decision'],
  ['repair','Adjust criteria','HR',3,'Correct invalid weights, thresholds, scores or matrix data, then preview again.','Invalid scoring configuration blocks publication.','branch'],
  ['publish','Publish a version','HR',4,'Publish the template so it can be selected for compatible participants in a future cycle.','Publishing later changes creates a new version; existing cycle snapshots stay unchanged.']
 ],edges:[['create','indicators'],['indicators','matrix'],['matrix','valid'],['valid','repair','Invalid'],['repair','matrix','Revise'],['valid','publish','Valid']],tour:['create','indicators','matrix','valid','repair','matrix','valid','publish']},
 {id:'behavior',title:'Behavioral assessments',summary:'Configure questionnaires and collect responses through assigned evaluator stages.',nodes:[
  ['template','Build the questionnaire','HR',0,'Create a Behavioral Assessment Template with sections and Rating Scale, Short Answer, Paragraph or Multiple Choice questions.','Set required questions and valid answer options before publishing.'],
  ['freeze','Publish and select in a cycle','HR',1,'Publish a version, then select the default template and compatible position overrides during cycle setup.','The selected questionnaire is frozen for that cycle.'],
  ['assigned','Open your assignment','Assigned evaluator',2,'Open the review assigned to you when its configured stage unlocks. Save responses as drafts.','Being the subject of a review does not grant permission to edit another evaluator’s response.'],
  ['valid','All required answers valid?','Decision',3,'Check that every required response matches its question type.','Blank required answers and invalid multiple-choice options block submission.','decision'],
  ['correct','Complete missing answers','Assigned evaluator',3,'Follow the validation guidance, correct answers and submit again.','Draft values stay available while correcting the response.','branch'],
  ['submit','Submit and unlock next stage','Assigned evaluator',4,'Submit the response. Once every required response in the stage is submitted, the next stage can open.','Overdue work remains submittable while the cycle is active and the stage is unlocked.'],
  ['score','Aggregate eligible ratings','System',5,'Compute behavioral scores from eligible observed numeric ratings using the cycle’s saved policy.','Narrative, multiple-choice, Not Observed and excluded optional answers do not become zero ratings.']
 ],edges:[['template','freeze'],['freeze','assigned'],['assigned','valid'],['valid','correct','Incomplete'],['correct','valid','Recheck'],['valid','submit','Valid'],['submit','score']],tour:['template','freeze','assigned','valid','correct','valid','submit','score']},
 {id:'pip',title:'Performance Improvement Plan',summary:'Turn a referral into measurable weekly improvement and an assessed outcome.',nodes:[
  ['enroll','Automatic or manual enrollment','System / Manager / HR',0,'A qualifying released KPI failure creates an Awaiting Planning referral. Manager/HR can also enroll an employee manually with a title and reason.','Repeated synchronization does not duplicate an employee’s source evaluation referral.'],
  ['plan','Plan weekly sections','Manager / HR',1,'Choose source indicators and declare weekly goals, target, unit, direction, actions, support and dates.','Each week spans seven inclusive days; sections cannot overlap.'],
  ['coverage','All failed sources covered?','Decision',2,'Cover each failed source indicator with a weekly section or a reasoned exclusion, and review new referrals.','Sources retain their cycle and indicator identity. Unresolved coverage blocks activation and closure.','decision'],
  ['revise','Resolve the planning gaps','Manager / HR',2,'Add missing weekly sections or justified exclusions and resolve referral review.','An excluded source cannot also be a planned focus until the exclusion is restored.','branch'],
  ['active','Activate and share the plan','Manager / HR',3,'Validate and activate the plan. The employee can view the plan and acknowledge it where configured.','Only HR and permitted managers configure the plan; employees see their own plans.'],
  ['progress','Record weekly progress','Employee',4,'Save progress drafts during the current week and submit the final update on or after its end date.','Future weeks are locked. Late submissions remain possible while the plan is active.'],
  ['assess','Assess the week','Manager / HR',5,'After week end, verify actuals and remarks, return a submitted update for correction or assess a missed update with an explicit reason.','An absent update is never automatically treated as zero. A reasoned follow-up can continue the same source.'],
  ['close','Close with the assessed outcome','Manager / HR',6,'Close only after all weeks end and are assessed, source coverage is resolved and referrals are reviewed. Record the closure note.','The outcome is derived from final assessments. PIP closure does not change the original KPI result.']
 ],edges:[['enroll','plan'],['plan','coverage'],['coverage','revise','Unresolved'],['revise','plan','Revise'],['coverage','active','Ready'],['active','progress'],['progress','assess'],['assess','close']],tour:['enroll','plan','coverage','revise','plan','coverage','active','progress','assess','close']},
 {id:'nte',title:'NTE Files',summary:'Issue a confidential notice, receive the employee’s explanation and close the record.',nodes:[
  ['select','Select an employee','HR',0,'Open 202 Files → NTE Files, choose an employee from the permitted masterlist and view active and past notices.','Managers can view issued notices for their current team; employees see only their own issued notices.'],
  ['draft','Draft and review the notice','HR',1,'Create an NTE with category, subject, body and explanation deadline; add an incident date or reference where needed.','Draft notices are hidden from employees and managers.'],
  ['issue','Issue and notify','HR / System',2,'Issue the reviewed notice. Its content locks and an in-app notification is created for the employee.','Opening an issued notice records a read receipt.'],
  ['respond','Employee submits an explanation','Employee',3,'Open the notice, review its deadline and submit one explanation while it remains open.','Response is available through the deadline and may still be submitted late while open; a submitted explanation locks.'],
  ['closegate','Response received or deadline passed?','Decision',4,'HR checks whether the ordinary closure condition is met.','The employee retains the response window while a notice stays open.','decision'],
  ['exception','Use a reasoned exception','HR',4,'An early close requires a separate reason and confirmation. Cancellation is a separate action with its own reason.','Keep the notice, response and history; a notice does not automatically impose disciplinary action.','branch'],
  ['closed','Close and retain history','HR',5,'Close the notice after response or deadline and retain the notice, explanation, read receipt and action history.','Closed and cancelled notices are read-only for permitted viewers.']
 ],edges:[['select','draft'],['draft','issue'],['issue','respond'],['respond','closegate'],['closegate','exception','Exception'],['closegate','closed','Yes']],tour:['select','draft','issue','respond','closegate','exception','closegate','closed']},
 {id:'journal',title:'Journal entries',summary:'Record employee context in 202 Files with scoped access.',nodes:[
  ['open','Open Journal Entries','HR / Manager',0,'Open 202 Files → Journal Entries and select the permitted employee records.','Manager access follows the current team; employee access is limited to their issued NTEs.'],
  ['entry','Record the context','HR',1,'Create a journal entry with date, type, title, description and author, and optionally associate an eligible cycle.','Required fields must be complete. A journal entry provides context without automatically generating a rating.'],
  ['save','Save the entry','HR',2,'Save and retain the entry in the employee’s journal listing.','Employee/company scope remains enforced when opening linked records.'],
  ['read','Review authorized history','HR / Manager',3,'Search, filter and open employee journal records when reviewing performance context.','A change of manager changes current team access; prior evaluator access does not grant journal access.']
 ],edges:[['open','entry'],['entry','save'],['save','read']],tour:['open','entry','save','read']},
 {id:'manager',title:'Manager reassignment',summary:'Schedule a manager change, validate it when due and retain started evaluation ownership.',nodes:[
  ['select','Select employees and manager','HR',0,'Open the assignment facility from Employees or Settings and choose eligible employees, a manager, effective date and required reason.','The manager and employees must be in the same company; self-assignment and reporting loops are rejected.'],
  ['pending','Save the pending change','HR',1,'Validate the complete batch and projected reporting graph, then retain the assignment as Pending until due.','A future assignment does not immediately change team access or verification authority.'],
  ['due','Still valid when due?','System',2,'Revalidate employee/manager eligibility, company and reporting graph at the effective date.','Assignments are evaluated chronologically, including same-day batches.','decision'],
  ['blocked','Keep current manager; mark Blocked','System / HR',2,'If due-date validation fails, leave current scope intact and show the assignment for HR repair or cancellation.','An invalid batch must not partially apply.','branch'],
  ['apply','Apply the manager change','System',3,'Apply the valid assignment once, update current team/verification scope and reassign eligible Not Started Manager work.','In Progress and Submitted responses retain their existing evaluator.'],
  ['history','Retain the assignment history','HR',4,'Keep previous/new manager, effective date, reason, actor and application or block outcome.','The prior evaluator can view only the exact retained assignment history, without gaining general team access.']
 ],edges:[['select','pending'],['pending','due'],['due','blocked','Invalid'],['blocked','select','Repair / reschedule'],['due','apply','Valid'],['apply','history']],tour:['select','pending','due','blocked','select','pending','due','apply','history']},
 {id:'recovery',title:'Workflow recovery',summary:'Recover eligible active work through controlled extensions and assessment corrections.',nodes:[
  ['identify','Review blocked or overdue work','HR',0,'Use cycle attention/recovery controls to identify an expired deadline or a submitted assessment needing correction.','Recovery applies to active, unreleased cycles.'],
  ['eligible','Is recovery permitted?','Decision',1,'Validate the cycle state, reason, date order and affected work before applying a change.','Completed or released cycles cannot use these active-cycle recovery actions.','decision'],
  ['reject','Explain the recovery constraint','System',1,'Show the blocking rule and preserve existing dates, answers and results.','Never unlock a finalized snapshot or silently override an invalid schedule.','branch'],
  ['extend','Extend or reopen with a reason','HR',2,'Extend deadlines without shortening any date, or reopen a submitted assessment after confirming the downstream impact.','At least one deadline must change for an extension. Reopening an assessment does not unverify KPI evidence.'],
  ['redo','Correct and resubmit in order','Assigned evaluator',3,'For reopened assessments, the selected response and affected downstream responses return to In Progress and require ordered resubmission.','Prior versions remain in history; later stages wait for the earlier correction.'],
  ['continue','Resume the gated workflow','HR / Evaluators',4,'Recheck completion, then finalize and release through the normal gates when all required work is ready.','Every recovery action retains its reason and before/after evidence.']
 ],edges:[['identify','eligible'],['eligible','reject','Blocked'],['eligible','extend','Permitted'],['extend','redo'],['redo','continue']],tour:['identify','eligible','reject','eligible','extend','redo','continue']},
 {id:'reporting',title:'Results, reports & notifications',summary:'Understand which results can be viewed and how scope applies to reports and notifications.',nodes:[
  ['release','Start with released results','HR',0,'Finalize the evaluation, then perform the separate release action using the cycle’s configured visibility.','A hidden or unreleased result cannot be disclosed by opening a detail link or report.'],
  ['scope','Apply role and confidentiality rules','System',1,'Limit employees to their own released results, managers to permitted team results and HR to authorized company records.','Anonymous Peer/Upward groups are shown only when their configured response threshold is met.'],
  ['filter','Filter dashboards and reports','Manager / HR',2,'Select permitted cycles, periods, review types, departments or date ranges to inspect available performance results.','Counts, filters and empty states reflect the same scoped dataset. Invalid date ranges are rejected.'],
  ['export','Export permitted fields','Manager / HR',3,'Export the report fields available to the current user.','Exports apply the same company, role, visibility and anonymity protections as the screen.'],
  ['notify','Follow actionable notifications','All roles',4,'Use Notifications to open assigned reviews, issued NTEs and actionable PIP tasks. Review-notification preferences are available in Settings.','Opening or reading a notification does not itself submit, verify or close the linked work.']
 ],edges:[['release','scope'],['scope','filter'],['filter','export'],['export','notify']],tour:['release','scope','filter','export','notify']}
];

const pmsWorkflowState = {process:'reviews',index:0,timer:null,opener:null};
function pmsWorkflowCurrent(){return pmsWorkflowProcesses.find(p=>p.id===pmsWorkflowState.process)||pmsWorkflowProcesses[0]}
function pmsWorkflowStop(){if(pmsWorkflowState.timer!==null)clearInterval(pmsWorkflowState.timer);pmsWorkflowState.timer=null}
function pmsWorkflowOpen(){
 pmsCloseHeaderMenus();
 let dialog=document.getElementById('pmsWorkflowDialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='pmsWorkflowDialog';dialog.className='pms-workflow-dialog';dialog.setAttribute('aria-labelledby','pmsWorkflowTitle');document.body.appendChild(dialog);
  dialog.addEventListener('close',()=>{pmsWorkflowStop();document.getElementById('pmsWorkflowButton')?.setAttribute('aria-expanded','false');pmsWorkflowState.opener?.focus()});
  dialog.addEventListener('cancel',pmsWorkflowStop);
 }
 if(dialog.open)return;
 pmsWorkflowState.opener=document.activeElement;pmsWorkflowStop();pmsWorkflowState.index=0;
 pmsWorkflowRender();dialog.showModal();document.getElementById('pmsWorkflowButton')?.setAttribute('aria-expanded','true');dialog.querySelector('.wf-close').focus();
}
function pmsWorkflowClose(){document.getElementById('pmsWorkflowDialog')?.close()}
function pmsWorkflowSelect(id){if(!pmsWorkflowProcesses.some(p=>p.id===id))return;pmsWorkflowStop();pmsWorkflowState.process=id;pmsWorkflowState.index=0;pmsWorkflowRender();document.querySelector(`.wf-process[data-process="${id}"]`)?.focus()}
function pmsWorkflowChoose(id){const i=pmsWorkflowCurrent().tour.indexOf(id);if(i<0)return;pmsWorkflowStop();pmsWorkflowState.index=i;pmsWorkflowUpdate();document.querySelector(`.wf-node[data-node="${id}"]`)?.focus()}
function pmsWorkflowMove(delta){pmsWorkflowStop();pmsWorkflowState.index=Math.max(0,Math.min(pmsWorkflowCurrent().tour.length-1,pmsWorkflowState.index+delta));pmsWorkflowUpdate(true)}
function pmsWorkflowPlay(){
 if(pmsWorkflowState.timer!==null){pmsWorkflowStop();pmsWorkflowUpdate();return}
 if(pmsWorkflowState.index===pmsWorkflowCurrent().tour.length-1)pmsWorkflowState.index=0;
 pmsWorkflowState.timer=setInterval(()=>{if(!document.getElementById('pmsWorkflowDialog')?.open){pmsWorkflowStop();return}pmsWorkflowState.index++;if(pmsWorkflowState.index>=pmsWorkflowCurrent().tour.length-1)pmsWorkflowStop();pmsWorkflowUpdate(true)},3600);
 pmsWorkflowUpdate(true);
}
function pmsWorkflowIcon(n){
 const role=n[2],kind=n[6]==='decision'?'decision':n[6]==='branch'?'return':/System/.test(role)?'system':/Manager/.test(role)?'manager':/Employee|evaluator/i.test(role)?'employee':'hr';
 const artwork={
  hr:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8M8 15h4"/><path class="wf-icon-action" d="m13 17 2 2 4-5"/>',
  employee:'<circle cx="10" cy="7" r="3"/><path d="M4 20v-3a6 6 0 0 1 9-5"/><path class="wf-icon-action" d="m14 16 5-5 2 2-5 5-3 1Z"/>',
  manager:'<circle cx="8" cy="7" r="3"/><path d="M2 21v-3a6 6 0 0 1 10-4M16 4a3 3 0 0 1 0 6"/><path class="wf-icon-action" d="m14 17 2 2 5-6"/>',
  system:'<g class="wf-icon-gear"><path d="m9 3 1-2h4l1 2 2 1 2-.3 2 3-1 2v2l1 2-2 3-2-.3-2 1-1 2h-4l-1-2-2-1-2 .3-2-3 1-2V9L3 7l2-3 2 .3Z"/><circle cx="12" cy="10" r="3"/></g><path d="m8 22 3 2 5-4" transform="translate(0 -1)"/>',
  decision:'<path d="M12 21v-7M12 14 5 7M12 14l7-7"/><path class="wf-icon-action" d="M5 12V7h5M14 7h5v5"/>',
  return:'<path d="M8 8h7a6 6 0 0 1 0 12h-3"/><path class="wf-icon-action" d="M8 3 3 8l5 5M3 8h5"/>'
 };
 return `<span class="wf-step-icon wf-icon-${kind}" aria-hidden="true"><svg viewBox="0 0 28 28"><circle class="wf-icon-progress" cx="14" cy="14" r="12" pathLength="100"/><g class="wf-icon-art" transform="translate(3 3) scale(.92)">${artwork[kind]}</g></svg></span>`;
}
function pmsWorkflowGraph(p){
 const height=Math.max(...p.nodes.map(n=>n[3]))*128+138,byId=new Map(p.nodes.map(n=>[n[0],n]));
 const point=n=>({x:n[6]==='branch'?342:30,y:n[3]*128+24});
 const paths=p.edges.map(([from,to,label=''])=>{
  const a=point(byId.get(from)),b=point(byId.get(to));let d,lx,ly;
  if(a.x===b.x){d=`M ${a.x+120} ${a.y+80} L ${b.x+120} ${b.y}`;lx=a.x+144;ly=a.y+103}
  else if(a.x<b.x){d=`M ${a.x+240} ${a.y+40} L ${b.x} ${b.y+40}`;lx=(a.x+240+b.x)/2;ly=a.y+26}
  else{const right=608;d=`M ${a.x+240} ${a.y+40} H ${right} V ${b.y-12} H ${b.x+120} V ${b.y}`;lx=right-8;ly=a.y+98}
  return `<g class="wf-edge" data-from="${from}" data-to="${to}"><path d="${d}" marker-end="url(#wf-arrow)"/><circle class="wf-edge-token" r="3.5" style="offset-path:path('${d}')"/>${label?`<text x="${lx}" y="${ly}" text-anchor="${a.x>b.x?'end':'middle'}">${esc(label)}</text>`:''}</g>`;
 }).join('');
 return `<div class="wf-canvas" style="height:${height}px"><svg class="wf-connectors" viewBox="0 0 630 ${height}" width="630" height="${height}" aria-hidden="true"><defs><marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="context-stroke" stroke-width="1.4"/></marker></defs>${paths}</svg>${p.nodes.map(n=>{const pos=point(n);return `<button type="button" class="wf-node ${n[6]==='decision'?'wf-decision':''} ${n[6]==='branch'?'wf-branch':''}" style="left:${pos.x}px;top:${pos.y}px" data-node="${n[0]}" aria-controls="wf-step-detail" onclick="pmsWorkflowChoose('${n[0]}')">${pmsWorkflowIcon(n)}<span class="wf-node-copy"><span class="wf-node-role">${esc(n[2])}</span><strong>${esc(n[1])}</strong></span></button>`}).join('')}</div>`;
}
function pmsWorkflowRender(){
 const p=pmsWorkflowCurrent();
 document.getElementById('pmsWorkflowDialog').innerHTML=`<div class="wf-heading"><div><h2 id="pmsWorkflowTitle">Workflow guide</h2><p>Explore the processes, responsibilities and decision points.</p></div><button type="button" class="wf-close pms-icon-button" aria-label="Close workflow guide" onclick="pmsWorkflowClose()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="wf-layout"><nav class="wf-process-list" aria-label="System processes">${pmsWorkflowProcesses.map(x=>`<button type="button" class="wf-process ${x.id===p.id?'wf-selected':''}" data-process="${x.id}" aria-pressed="${x.id===p.id}" onclick="pmsWorkflowSelect('${x.id}')">${esc(x.title)}</button>`).join('')}</nav><section class="wf-main" aria-labelledby="wf-process-title"><div class="wf-process-heading"><h3 id="wf-process-title">${esc(p.title)}</h3><p>${esc(p.summary)}</p><div class="wf-legend"><span><i class="wf-legend-main"></i>Main path</span><span><i class="wf-legend-branch"></i>Exception / correction</span></div></div><div class="wf-chart" role="region" aria-label="${esc(p.title)} flowchart. Select a step to read its details." tabindex="0">${pmsWorkflowGraph(p)}</div><div class="wf-controls"><button type="button" id="wf-previous" aria-label="Previous step" onclick="pmsWorkflowMove(-1)">Previous</button><button type="button" id="wf-play" class="primary" onclick="pmsWorkflowPlay()">Play walkthrough</button><button type="button" id="wf-next" aria-label="Next step" onclick="pmsWorkflowMove(1)">Next</button><span id="wf-position"></span></div></section><section class="wf-detail" id="wf-step-detail" aria-label="Selected step details"><div id="wf-step-content" aria-live="polite" aria-atomic="true"></div><p class="wf-reference-note">This guide explains the workflow. Exploring it does not change your current work or any employee records.</p></section></div>`;
 pmsWorkflowUpdate();
}
function pmsWorkflowUpdate(scroll=false){
 const p=pmsWorkflowCurrent(),id=p.tour[pmsWorkflowState.index],n=p.nodes.find(x=>x[0]===id),running=pmsWorkflowState.timer!==null,visited=new Set(p.tour.slice(0,pmsWorkflowState.index));
 document.querySelectorAll('#pmsWorkflowDialog .wf-node').forEach(el=>{const active=el.dataset.node===id;el.classList.toggle('wf-active',active);el.classList.toggle('wf-visited',visited.has(el.dataset.node));el.setAttribute('aria-pressed',String(active))});
 const previous=p.tour[pmsWorkflowState.index-1];
 document.querySelectorAll('#pmsWorkflowDialog .wf-edge').forEach(el=>el.classList.toggle('wf-edge-active',el.dataset.to===id&&el.dataset.from===previous));
 document.getElementById('wf-step-content').innerHTML=`<div class="wf-detail-identity">${pmsWorkflowIcon(n)}<span class="wf-role">${esc(n[2])}</span></div><h3>${esc(n[1])}</h3><p>${esc(n[4])}</p><h4>Rules & conditions</h4><p>${esc(n[5])}</p>`;
 document.getElementById('wf-play').textContent=running?'Pause walkthrough':pmsWorkflowState.index===p.tour.length-1?'Replay walkthrough':'Play walkthrough';
 document.getElementById('wf-play').setAttribute('aria-pressed',String(running));
 document.getElementById('wf-previous').disabled=pmsWorkflowState.index===0;document.getElementById('wf-next').disabled=pmsWorkflowState.index===p.tour.length-1;
 document.getElementById('wf-position').textContent=`${pmsWorkflowState.index+1} of ${p.tour.length}`;
 document.getElementById('pmsWorkflowDialog').classList.toggle('wf-playing',running);
 if(scroll){const chart=document.querySelector('#pmsWorkflowDialog .wf-chart'),active=document.querySelector('#pmsWorkflowDialog .wf-active');chart.scrollTo({top:Math.max(0,active.offsetTop-chart.clientHeight/2+40),left:Math.max(0,active.offsetLeft-chart.clientWidth/2+120),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&pmsWorkflowState.timer!==null){pmsWorkflowStop();if(document.getElementById('pmsWorkflowDialog')?.open)pmsWorkflowUpdate()}});
