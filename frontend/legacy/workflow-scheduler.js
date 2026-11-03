/* Browser-local catch-up only; no worker runs after the workspace closes. */
let pmsScheduleError='',pmsScheduleRunning=false,pmsScheduleDeferred=false;
function pmsScheduleAudit(action){UR.audit.push({at:new Date().toISOString(),by:'System',action:'System scheduler: '+action});urPersist()}
function pmsScheduleBusy(){return urDirty||!!document.querySelector('#modal')?.open}
function pmsScheduleAttention(c,message){if(c.scheduleAttention===message)return false;c.scheduleAttention=message;pmsScheduleAudit('attention for '+c.id+' — '+message);return true}
function pmsScheduledSnapshotErrors(c){
 if(typeof cwV2==='function'&&cwV2(c))return c.components?.goals?(c.participants||[]).filter(id=>!Array.isArray((c.performanceRecords?.[id]?.template||c.goalTemplateSnapshots?.[id])?.indicators)).map(id=>'Frozen KPI Goal Template is missing for '+id+'. Recover the original snapshot or cancel and replace this cycle.'):[];
 if(c.stages)return c.stages.flatMap(s=>[...(s.behavioralTemplate&&!c.pendingSnapshots?.behavioral?.some(t=>t.id===s.behavioralTemplate&&Array.isArray(t.questions))?['Frozen Behavioral Assessment Template is missing.']:[]),...(s.goalsTemplate&&!c.pendingSnapshots?.goals?.some(t=>t.id===s.goalsTemplate&&Array.isArray(t.indicators))?['Frozen KPI Goal Template is missing.']:[])]);
 return (c.evaluators||[]).filter(e=>!Array.isArray(c.templateSnapshots?.[e.type]?.questions)).map(e=>'Frozen '+e.type+' assessment template is missing. Recover the original snapshot or cancel and replace this cycle.');
}
function pmsScheduledGeneration(c){
 const snapshotErrors=pmsScheduledSnapshotErrors(c);if(snapshotErrors.length)return pmsScheduleAttention(c,[...new Set(snapshotErrors)].join(' '));
 const before=urClone(c),oldAssignments=UR.assignments.filter(a=>a.cycle===c.id);let errors=[];
 try{
  if(typeof cwV2==='function'&&cwV2(c))cwGenerate(c);else urGenerateAssignments(c);
  errors=c.generationErrors||[];
  const rows=UR.assignments.filter(a=>a.cycle===c.id),expected=c.stages?c.stages.length*(c.participants?.length||0):c.evaluators?.length;
  if(!errors.length&&(!rows.length||expected&&rows.length!==expected))errors=['Assessment generation did not produce all expected assignments. Recover the frozen configuration or cancel and replace this cycle.'];
 }catch(error){errors=['Assessment generation failed: '+error.message]}
 if(errors.length){for(const key of Object.keys(c))delete c[key];Object.assign(c,before);UR.assignments=UR.assignments.filter(a=>a.cycle!==c.id).concat(oldAssignments);return pmsScheduleAttention(c,errors.join(' '))}
 c.status='Active';delete c.scheduleAttention;pmsScheduleAudit('scheduled cycle opened: '+c.id);return true;
}
function pmsProcessSchedule(now=new Date()){
 const previous=urToday;urToday=pmsWorkflowToday(now);pmsUpdateClockStatus();
 if(pmsScheduleRunning)return false;
 if(pmsScheduleBusy()){pmsScheduleDeferred=true;pmsUpdateClockStatus();return false}
 const wasDeferred=pmsScheduleDeferred;pmsScheduleRunning=true;let changed=false;
 try{
  if(typeof pmsProcessManagerAssignments==='function')changed=!!pmsProcessManagerAssignments()||changed;
  for(const c of UR.cycles.filter(c=>c.status==='Scheduled')){
   if(!pmsWorkflowDateValid(c.start)||!pmsWorkflowDateValid(c.deadline)){changed=pmsScheduleAttention(c,'The scheduled operating dates are invalid. HR must recover or replace the cycle.')||changed;continue}
   if(c.start>urToday)continue;
   if(c.deadline<urToday){changed=pmsScheduleAttention(c,'The entire operating window has passed. HR must extend the schedule or cancel and replace this cycle; it has not been opened.')||changed;continue}
   changed=pmsScheduledGeneration(c)||changed;
  }
  if(pmsScheduleError){pmsScheduleError='';changed=true}
 }catch(error){pmsScheduleError='Scheduled processing failed: '+error.message;console.error(pmsScheduleError)}
 finally{pmsScheduleRunning=false;pmsScheduleDeferred=false}
 if(changed)urPersist();
 if((changed||previous!==urToday||wasDeferred)&&!pmsScheduleBusy())render();
 pmsUpdateClockStatus();return changed;
}
function pmsWorkflowClockLabel(){const clock=pmsWorkflowClock();return (clock.mode==='demo'?'Demo date: ':'Live date: ')+urToday+' · Asia/Manila'}
function pmsUpdateClockStatus(){
 const header=document.querySelector('.pms-topbar');if(header&&!document.getElementById('pmsClockStatus'))header.insertAdjacentHTML('afterbegin','<span id="pmsClockStatus" class="pms-clock-status" role="status"></span>');
 const node=document.getElementById('pmsClockStatus');if(node){node.textContent=pmsWorkflowClockLabel()+(pmsScheduleDeferred?' · Actions deferred while editing':'')+(pmsScheduleError?' · Scheduler needs attention':'');node.title='Runs while open; catches up when reopened. No external worker.'}
}
const pmsClockBaseHeader=pmsRenderHeader;
pmsRenderHeader=function(){pmsClockBaseHeader();pmsUpdateClockStatus()};
function pmsClockAttentionHTML(){if(!urHr())return '';const rows=UR.cycles.filter(c=>c.status==='Scheduled'&&c.scheduleAttention);return (pmsScheduleError?`<p class="urerror" role="alert">${esc(pmsScheduleError)}</p>`:'')+rows.map(c=>`<div class="pms-clock-attention"><b>${esc(c.name)}</b><p>${esc(c.scheduleAttention)}</p><button onclick="closeModal();urOpenCycle(${esc(JSON.stringify(c.id))})">Open Cycle</button> <button onclick="pmsRecoverSchedule(${esc(JSON.stringify(c.id))})">Recover Schedule</button></div>`).join('')}
pmsOpenSettings=function(){pmsCloseHeaderMenus();modal('Settings','Workspace preferences.',`<div class="modalbody"><label class="pms-setting-row"><span><b>Review notifications</b><small>Show assigned reviews in the top-bar notifications panel.</small></span><input id="pmsNotificationsEnabled" type="checkbox" ${data.pmsNotificationsEnabled?'checked':''}></label><section class="pms-clock-settings"><h3>Workflow Clock</h3><p>${esc(pmsWorkflowClockLabel())}</p><p>Runs while open; catches up when reopened. No external worker. The clock updates every 30 seconds and when you return to this workspace.</p>${urHr()?'<button onclick="pmsConfigureWorkflowClock()">Configure Clock</button> <button onclick="pmsRunDueActions()">Run Due Actions</button>':'<p>HR manages the workflow date.</p>'}${pmsClockAttentionHTML()}</section>${typeof pmsAssignmentSchedulePanel==='function'?pmsAssignmentSchedulePanel():''}</div>`,`<button onclick="closeModal()">Cancel</button><button class="primary" onclick="pmsSaveSettings()">Save Settings</button>`)};
function pmsConfigureWorkflowClock(){if(!urHr())return;urGo(()=>{const clock=pmsWorkflowClock();modal('Workflow Clock','Company timezone: Asia/Manila',`<div class="modalbody"><label>Clock mode<select id="pmsClockMode"><option value="live" ${clock.mode==='live'?'selected':''}>Live company date</option><option value="demo" ${clock.mode==='demo'?'selected':''}>Explicit demo date</option></select></label><label>Demo date<input id="pmsClockDemoDate" type="date" value="${esc(clock.demoDate||urToday)}"></label><p>Changing the date can start due cycles and apply scheduled manager assignments. Moving backward does not undo actions already applied.</p><p id="pmsClockError" class="urerror" role="alert"></p></div>`,`<button onclick="pmsOpenSettings()">Cancel</button><button class="primary" onclick="pmsConfirmWorkflowClock()">Review Clock Change</button>`)})}
function pmsConfirmWorkflowClock(){
 if(!urHr())return;const mode=$('#pmsClockMode').value,demoDate=$('#pmsClockDemoDate').value;
 if(!['live','demo'].includes(mode)||mode==='demo'&&!pmsWorkflowDateValid(demoDate)){$('#pmsClockError').textContent='Choose a valid calendar date for demo mode.';return}
 modal('Apply Workflow Clock Change?','This changes company workflow deadlines and due actions.',`<div class="modalbody"><p>${mode==='demo'?'Use demo date '+esc(demoDate):'Use the live Asia/Manila company date'}.</p><p>Due actions will run after this change. Backdating does not reverse cycle launches or manager assignments.</p></div>`,`<button onclick="pmsConfigureWorkflowClock()">Back</button><button class="primary" onclick="pmsApplyWorkflowClock('${mode}','${esc(demoDate)}')">Apply Clock Change</button>`);
}
function pmsApplyWorkflowClock(mode,demoDate){if(!urHr()||!['live','demo'].includes(mode)||mode==='demo'&&!pmsWorkflowDateValid(demoDate))return;urGo(()=>{data.pmsWorkflowClock=mode==='demo'?{mode,demoDate}:{mode};save();urAudit('Workflow clock changed to '+mode+(mode==='demo'?' '+demoDate:''));closeModal();pmsProcessSchedule();render()})}
function pmsRunDueActions(){if(!urHr())return;urGo(()=>{closeModal();pmsProcessSchedule();pmsOpenSettings()})}
function pmsRecoverSchedule(id){
 const c=urCycle(id);if(!urHr()||c?.status!=='Scheduled')return;
 if(typeof pgModel==='function'&&pgModel(c)){pgExtendSchedule(id);return}
 modal('Recover Scheduled Cycle',c.name,`<form onsubmit="event.preventDefault();pmsSaveScheduleRecovery('${c.id}',this)"><div class="modalbody"><p>Extend deadlines to reopen this scheduled window. Existing frozen templates and responses are preserved.</p>${c.stages?c.stages.map(s=>`<label>${esc(s.name)} Deadline<input type="date" name="stage-${s.id}" required value="${esc(s.deadline)}"></label>`).join(''):`<label>Final deadline<input type="date" name="deadline" required value="${esc(c.deadline)}"></label>`}<label>Reason<textarea name="reason" required maxlength="2000"></textarea></label><p id="pmsRecoveryError" class="urerror" role="alert"></p></div><div class="modalfoot"><button type="button" onclick="pmsOpenSettings()">Cancel</button><button class="primary">Extend Schedule</button></div></form>`,'');
}
function pmsSaveScheduleRecovery(id,form){
 const c=urCycle(id);if(!urHr()||c?.status!=='Scheduled')return;const f=new FormData(form),reason=String(f.get('reason')||'').trim(),stages=c.stages?.map(s=>({...s,deadline:String(f.get('stage-'+s.id)||'')})),deadline=stages?.at(-1)?.deadline||String(f.get('deadline')||'');
 if(!reason||reason.length>2000||!pmsWorkflowDateValid(deadline)||deadline<urToday||deadline<c.deadline||stages?.some((s,i)=>!pmsWorkflowDateValid(s.deadline)||s.deadline<c.stages[i].deadline||s.deadline<c.start||i&&s.deadline<=stages[i-1].deadline)){$('#pmsRecoveryError').textContent='Enter a reason and extend valid deadlines in sequence through today or later.';return}
 c.scheduleHistory??=[];c.scheduleHistory.push({before:{deadline:c.deadline,stages:urClone(c.stages||[])},reason,by:urUser(),at:new Date().toISOString()});c.deadline=deadline;if(stages)c.stages=stages;delete c.scheduleAttention;urAudit('Scheduled cycle deadlines extended: '+id+' — '+reason);closeModal();pmsProcessSchedule();render();
}
if(typeof pgCanExtend==='function'){const pmsClockBaseCanExtend=pgCanExtend;pgCanExtend=function(c){return pmsClockBaseCanExtend(c)||!!c&&urHr()&&pgModel(c)&&c.status==='Scheduled'&&!c.released&&c.participants.every(id=>pdScopedEmployees().some(e=>e[0]===id))}}
if(typeof window.addEventListener==='function')window.addEventListener('focus',()=>pmsProcessSchedule());
if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pmsProcessSchedule()});
if(typeof setInterval==='function')setInterval(()=>pmsProcessSchedule(),30000);
pmsProcessSchedule();
