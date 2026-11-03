/* HRDotNet Performance information architecture and assignment-based reporting. */
let pmsReviewsOpen = true;
let pmsReportFilter = {cycle:'All cycles',period:'All periods',department:'All departments',type:'All types'};
const pmsOriginalSummaryCards=urSummaryCards;
urSummaryCards=function(items){return page==='Dashboard'?pmsOriginalSummaryCards(items):''};
urVisible=function(a){return urHr()||a.reviewer===urUser()||viewRole==='Manager'&&urTeam(a.subject)||viewRole==='Employee'&&a.subject===urUser()&&urCycle(a.cycle).released};

urPageHead = function(title,description,action='') {
  if(urScreen==='list')return head(title,description,action);
  const back=action.includes('←')?action.replace('<button','<button class="pms-back-link"'):'';
  const actions=back?'':action;
  return `<div class="pagehead pms-nested-head">${back?`<div class="pms-back-row">${back}</div>`:''}<div class="pms-nested-title-row"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions?`<div class="pms-page-actions">${actions}</div>`:''}</div></div>`;
};

const pmsOriginalGoTab=urGoTab;
urGoTab=function(section){
  if (!['Reviews','Templates','Cycles'].includes(section)) return;
  if (!urHr() && section!=='Reviews') return;
  pmsReviewsOpen=true;
  pmsOriginalGoTab(section);
};
const pmsOriginalOpenCycle=urOpenCycle;
urOpenCycle=function(id){if(urHr())pmsOriginalOpenCycle(id)};

function pmsReviewRows(){
  return UR.assignments.filter(urVisible).filter(a=>{
    const c=urCycle(a.cycle),p=urPerson(a.subject);
    const reviewer=urAnon(a)&&a.reviewer!==urUser()?'Anonymous '+a.type:urPerson(a.reviewer).name;
    return (urFilter.view!=='My Reviews'||a.reviewer===urUser())
      &&(urFilter.view!=='Team Reviews'||urTeam(a.subject))
      &&(urFilter.view!=='Completed'||a.state==='Completed')
      &&`${p.name} ${reviewer}`.toLowerCase().includes(urFilter.q.toLowerCase())
      &&(urFilter.cycle==='All cycles'||c.name===urFilter.cycle)
      &&(urFilter.type==='All types'||a.type===urFilter.type)
      &&(urFilter.department==='All departments'||p.department===urFilter.department)
      &&(urFilter.status==='All statuses'||urEffective(a)===urFilter.status);
  });
}
function pmsReviewKpis(rows){return urSummaryCards([
  ['Total Reviews',rows.length,'Individual assignments in this view'],
  ['Pending Reviews',rows.filter(a=>a.state==='Not Started').length,'Not yet started, including overdue'],
  ['In Progress',rows.filter(a=>a.state==='In Progress').length,'Drafts, including overdue'],
  ['Completed Reviews',rows.filter(a=>a.state==='Completed').length,'Finalized assignments']
]);}
/* Listing filters and counts remain; page-level KPI cards are Dashboard-only. */

roleNav=function(){return viewRole==='Employee'
  ?[['Dashboard','▦'],['Goals','◎'],['Reviews','▤']]
  :viewRole==='Manager'
    ?[['Dashboard','▦'],['My Team','♧'],['Goals','◎'],['Reviews','▤'],['Reports','▥']]
    :[['Dashboard','▦'],['Goals','◎'],['Reviews','▤'],['Reports','▥'],['Employees','♧']];
};

function pmsSidebar(){
  const base=roleNav(),active=page==='Reviews';
  return base.map(([name,icon])=>{
    if(name!=='Reviews')return `<button class="${page===name?'active':''}" onclick="navigate('${name}')"><span class="ico">${icon}</span>${name}</button>`;
    if(!urHr())return `<button class="${active?'active':''}" ${active?'aria-current="page"':''} onclick="navigate('Reviews')"><span class="ico">▤</span>Reviews</button>`;
    const children=['Reviews','Templates','Cycles'];
    return `<div class="pms-nav-group"><button class="pms-nav-parent ${active?'pms-parent-current':''}" aria-expanded="${pmsReviewsOpen}" aria-controls="pms-review-subnav" onclick="pmsToggleReviews()"><span class="ico">▤</span>Reviews<svg class="pms-unified-chevron pms-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="pms-review-subnav" class="pms-subnav" ${pmsReviewsOpen?'':'hidden'}>${children.map(section=>`<button class="pms-subitem ${active&&urTab===section?'active':''}" ${active&&urTab===section?'aria-current="page"':''} onclick="urGoTab('${section}')">${section==='Reviews'&&urHr()?'All Reviews':section}</button>`).join('')}</div></div>`;
  }).join('');
}
function pmsToggleReviews(){pmsReviewsOpen=!pmsReviewsOpen;$('#nav').innerHTML=pmsSidebar()}

/* HRDotNet supplies identities; HRDotNet Performance stores only performance manager overrides. */
data.pmsManagerAssignments??={};
data.pmsPendingManagerAssignments??=[];
data.pmsManagerAssignmentHistory??=[];
let pmsEmployeeFilters={q:'',department:'All departments',position:'All positions',manager:'All managers',status:'All statuses'};
let pmsEmployeeSelected=new Set(),pmsAssignmentDraft=null;
function pmsHrEmployee(id){return data.employees.find(e=>e[0]===id)}
function pmsManagers(){return [urPerson('MGR-001'),urPerson('EMP-004')]}
function pmsAssignmentDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
function pmsAssignmentCompany(){return data.pmsActiveCompanyId||'mayon'}
function pmsAssignmentInCompany(id,company){const e=pmsHrEmployee(id);return !!e&&(!e.companyId&&!data.pmsEmployeeCompanies?.[id]||(e.companyId||data.pmsEmployeeCompanies?.[id])===company)}
function pmsOfficialManagerId(id){const person=urPerson(id);return urPeople().find(p=>p.name===person.manager)?.id||''}
function pmsManagerId(id){const override=data.pmsManagerAssignments[id];return override&&(override.scheduledAssignmentId||!override.effective||override.effective<=urToday)?override.managerId:pmsOfficialManagerId(id)}
function pmsPendingManagerAssignments(){return (data.pmsPendingManagerAssignments||[]).filter(x=>['Pending','Blocked'].includes(x.status))}
function pmsManagerAssignmentError(entry){
 if(!pmsAssignmentDate(entry.effective))return 'The scheduled effective date is invalid.';
 if(!pmsAssignmentInCompany(entry.employee,entry.companyId))return 'The employee is no longer in the assignment company.';
 if(!pmsManagers().some(m=>m.id===entry.managerId))return 'The selected manager is no longer eligible.';
 if(pmsHrEmployee(entry.managerId)&&!pmsAssignmentInCompany(entry.managerId,entry.companyId))return 'The selected manager is outside the assignment company.';
 if(entry.employee===entry.managerId)return 'An employee cannot be their own manager.';
 return '';
}
function pmsManagerGraph(){return Object.fromEntries(urPeople().map(p=>[p.id,pmsManagerId(p.id)]))}
function pmsManagerGraphError(graph){
 for(const employee of Object.keys(graph)){let current=employee;const seen=new Set();while(current){if(seen.has(current))return 'The assignments would create a reporting cycle.';seen.add(current);current=graph[current]}}
 return '';
}
function pmsManagerTimelineError(proposals=[]){
 const graph=pmsManagerGraph(),legacy=Object.entries(data.pmsManagerAssignments).filter(([id,x])=>!x.scheduledAssignmentId&&pmsAssignmentDate(x.effective)&&x.effective>urToday).map(([employee,x])=>({...x,employee})),entries=[...pmsPendingManagerAssignments(),...legacy,...proposals],days=[...new Set(entries.map(x=>x.effective))].sort();
 for(const day of days){const group=entries.filter(x=>x.effective===day),employees=new Set();for(const entry of group){if(employees.has(entry.employee))return 'Cancel the existing assignment for this employee and effective date before replacing it.';employees.add(entry.employee);graph[entry.employee]=entry.managerId}const error=pmsManagerGraphError(graph);if(error)return error+' Review the projected reporting hierarchy on '+date(day)+'.'}
 return '';
}
function pmsManagerAssignmentEvent(entry,action,reason='',by=urUser()){
 data.pmsManagerAssignmentHistory??=[];data.pmsManagerAssignmentHistory.push({assignmentId:entry.id,employee:entry.employee,managerId:entry.managerId,effective:entry.effective,companyId:entry.companyId,action,reason,by,at:new Date().toISOString()});urAudit('Manager assignment '+action+': '+entry.employee+' → '+entry.managerId+' / '+entry.effective+(reason?' — '+reason:''));
}
function pmsApplyManagerAssignment(entry){
 data.pmsManagerAssignments[entry.employee]={managerId:entry.managerId,effective:entry.effective,updated:urToday,scheduledAssignmentId:entry.id};
 for(const c of UR.cycles){if(!['Draft','Scheduled','Active'].includes(c.status))continue;if(['Draft','Scheduled'].includes(c.status))c.evaluators?.filter(e=>e.subject===entry.employee&&e.type==='Manager').forEach(e=>e.reviewer=entry.managerId);for(const a of UR.assignments.filter(a=>a.cycle===c.id&&a.subject===entry.employee&&a.type==='Manager'&&a.state==='Not Started')){a.reviewer=entry.managerId;c.evaluators?.filter(e=>e.subject===entry.employee&&e.type==='Manager').forEach(e=>e.reviewer=entry.managerId)}}
 entry.status='Applied';entry.appliedAt=new Date().toISOString();delete entry.error;pmsManagerAssignmentEvent(entry,'Applied','','System');
}
function pmsProcessManagerAssignments(){
 data.pmsPendingManagerAssignments??=[];let changed=false;
 // Old future overrides have no retained prior override. Keep only the known official baseline until they are due.
 for(const [employee,override] of Object.entries(data.pmsManagerAssignments)){if(override.scheduledAssignmentId||!pmsAssignmentDate(override.effective)||override.effective<=urToday)continue;const entry={id:urUid('manager-assignment'),employee,managerId:override.managerId,effective:override.effective,companyId:(pmsHrEmployee(employee)?.companyId||data.pmsEmployeeCompanies?.[employee]||pmsAssignmentCompany()),status:'Pending',legacy:true,createdAt:null,createdBy:null};data.pmsPendingManagerAssignments.push(entry);delete data.pmsManagerAssignments[employee];pmsManagerAssignmentEvent(entry,'Legacy schedule retained','Only the latest scheduled assignment is known; earlier override history is unavailable.','System');changed=true;}
 const due=pmsPendingManagerAssignments().filter(x=>x.effective<=urToday),days=[...new Set(due.map(x=>x.effective))].sort();
 for(const day of days){const group=due.filter(x=>x.effective===day),graph=pmsManagerGraph(),employees=new Set();let error='';for(const entry of group){error=error||pmsManagerAssignmentError(entry);if(employees.has(entry.employee))error='Multiple pending assignments have the same employee and effective date.';employees.add(entry.employee);const current=data.pmsManagerAssignments[entry.employee];if(current?.effective>entry.effective)error='A newer manager assignment is already effective. Cancel this outdated scheduled assignment.';graph[entry.employee]=entry.managerId}error=error||pmsManagerGraphError(graph);
  if(error){for(const entry of group){if(entry.status!=='Blocked'||entry.error!==error){entry.status='Blocked';entry.error=error;pmsManagerAssignmentEvent(entry,'Blocked',error,'System');changed=true}}continue}
  for(const entry of group){pmsApplyManagerAssignment(entry);changed=true}
 }
 if(changed)save();return changed;
}
function pmsCancelManagerAssignment(id){
 const entry=data.pmsPendingManagerAssignments?.find(x=>x.id===id);if(!urHr()||!entry||entry.companyId!==pmsAssignmentCompany()||!['Pending','Blocked'].includes(entry.status))return false;
 entry.status='Cancelled';entry.cancelledAt=new Date().toISOString();entry.cancelledBy=urUser();pmsManagerAssignmentEvent(entry,'Cancelled');save();render();const options=$('#pmsEmployeeOptions');if(pmsAssignmentDraft&&options)options.innerHTML=pmsEmployeeLookupOptions();const panel=$('#pmsAssignmentSchedulePanel');if(panel)panel.outerHTML=pmsAssignmentSchedulePanel();toast('Scheduled assignment cancelled');return true;
}
function pmsManagerScheduleHtml(employee){
 const recordInCompany=urHr()&&pmsPendingManagerAssignments().some(x=>x.employee===employee&&x.companyId===pmsAssignmentCompany());
 if(!pmsAssignmentInCompany(employee,pmsAssignmentCompany())&&!recordInCompany||!urHr()&&!urTeam(employee)&&employee!==urUser())return '';
 const entries=pmsPendingManagerAssignments().filter(x=>x.employee===employee&&x.companyId===pmsAssignmentCompany()).sort((a,b)=>a.effective.localeCompare(b.effective));
 const history=(data.pmsManagerAssignmentHistory||[]).filter(x=>x.employee===employee&&x.companyId===pmsAssignmentCompany());
 return entries.map(x=>`<div class="notice"><b>${esc(x.status)}: ${esc(urPerson(x.managerId).name)}</b> · Effective ${date(x.effective)}${x.error?`<p role="alert">${esc(x.error)}</p>`:''}${urHr()?`<button type="button" class="textbtn" onclick="event.preventDefault();event.stopPropagation();pmsCancelManagerAssignment('${x.id}')">Cancel Scheduled Assignment</button>`:''}</div>`).join('')+(urHr()&&history.length?`<details><summary>Manager Assignment History (${history.length})</summary>${history.map(x=>`<p>${esc(x.action)} · ${esc(urPerson(x.managerId).name)} · Effective ${date(x.effective)}<br>${esc(x.at)} · ${esc(x.by==='System'?'System':urPerson(x.by).name)}${x.reason?'<br>'+esc(x.reason):''}</p>`).join('')}</details>`:'');
}
function pmsAssignmentSchedulePanel(){
 if(!urHr())return '';
 const entries=pmsPendingManagerAssignments().filter(x=>x.companyId===pmsAssignmentCompany()),ids=[...new Set(entries.map(x=>x.employee))];
 return `<section id="pmsAssignmentSchedulePanel" class="panel pd-form"><h2>Scheduled Manager Assignments</h2><p>Assignments take effect on their scheduled company date. Blocked assignments retain current access until HR resolves or cancels them.</p>${ids.length?ids.map(id=>`<h3>${esc(urPerson(id).name)}</h3>${pmsManagerScheduleHtml(id)}`).join(''):'<p>No pending manager assignments.</p>'}</section>`;
}
function pmsManagerName(id){const managerId=pmsManagerId(id);return managerId?urPerson(managerId).name:'Unassigned'}
function pmsAssignmentStatus(id){return data.pmsManagerAssignments[id]?'PMS override':pmsManagerId(id)?'Assigned':'Unassigned'}
scopedEmployees=function(){return data.employees.filter(e=>viewRole==='HR Administrator'||viewRole==='Manager'&&pmsManagerName(e[0])===managerName||viewRole==='Employee'&&e[0]===employeeId)};
urTeam=function(id){return viewRole==='Manager'&&pmsHrEmployee(id)&&pmsManagerName(id)===managerName};
urSupervisor=function(id){return pmsManagerId(id)};
viewProfile=function(id){const e=pmsHrEmployee(id);if(!e||viewRole==='Manager'&&!urTeam(id)&&!urHr())return;modal(viewRole==='Manager'?'Team Member Details':'Employee Details','Read-only identity and organization data',`<div class="modalbody">${urDisplayPerson(id)}<div class="formgrid">${[['Employee ID',e[0]],['Department',e[3]],['Position',e[2]],['HRDotNet reporting manager',e[4]||'Unassigned'],['HRDotNet Performance performance manager',pmsManagerName(id)]].map(([l,v])=>`<div><small>${l}</small><h2 style="margin-top:9px">${esc(v)}</h2></div>`).join('')}</div>${pmsManagerScheduleHtml(id)}<div class="notice">Performance manager overrides in this mockup do not change HRDotNet’s official reporting hierarchy.</div></div>`,`<button onclick="closeModal()">Close</button>${urHr()?`<button class="primary" onclick="pmsOpenAssignment(['${e[0]}'])">${pmsManagerName(e[0])==='Unassigned'?'Assign Manager':'Reassign Manager'}</button>`:''}`)};
openEmployee=function(id){if(urHr())pmsOpenAssignment(id?[id]:[])};
function pmsEmployeeRows(){return (viewRole==='Manager'?scopedEmployees():data.employees).filter(e=>{
  const manager=pmsManagerName(e[0]),term=pmsEmployeeFilters.q.toLowerCase();
  return (!term||`${e[0]} ${e[1]} ${e[2]} ${e[3]} ${manager}`.toLowerCase().includes(term))
    &&(pmsEmployeeFilters.department==='All departments'||e[3]===pmsEmployeeFilters.department)
    &&(pmsEmployeeFilters.position==='All positions'||e[2]===pmsEmployeeFilters.position)
    &&(pmsEmployeeFilters.manager==='All managers'||manager===pmsEmployeeFilters.manager)
    &&(pmsEmployeeFilters.status==='All statuses'||pmsAssignmentStatus(e[0])===pmsEmployeeFilters.status);
})}
function pmsEmployeeSelect(label,key,values){return `<label class="urfilter"><span>${label}</span><select aria-label="${label}" onchange="pmsEmployeeFilters.${key}=this.value;pmsDrawEmployeeRows()">${values.map(v=>`<option ${pmsEmployeeFilters[key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`}
function pmsEmployeesPage(){const hr=urHr(),people=hr?data.employees:scopedEmployees();return head(hr?'Employees':'My Team',hr?'View employees from HRDotNet and manage their performance-related assignments.':'Employees assigned to you for performance management.',hr?'<button class="gradient" onclick="pmsOpenAssignment()">＋ Assign Manager</button>':'')+`<section class="panel"><div class="panelhead"><div><h2>${hr?'HRDotNet employee lookup':'Assigned employees'}</h2><p>${hr?'Select existing people and set HRDotNet Performance performance managers.':'Your HRDotNet Performance performance assignments, using HRDotNet records.'}</p></div><span class="pill blue">HRDotNet source</span></div><div class="toolbar urtoolbar"><label class="urfilter ursearch"><span>Search employees</span><input class="search" aria-label="Search employees" placeholder="Name, ID, role, or manager…" value="${esc(pmsEmployeeFilters.q)}" oninput="pmsEmployeeFilters.q=this.value;pmsDrawEmployeeRows()"></label>${pmsEmployeeSelect('Department','department',['All departments',...new Set(people.map(e=>e[3]))])}${pmsEmployeeSelect('Position','position',['All positions',...new Set(people.map(e=>e[2]))])}${pmsEmployeeSelect('Assigned Manager','manager',['All managers',...new Set(people.map(e=>pmsManagerName(e[0])))])}${pmsEmployeeSelect('Assignment Status','status',['All statuses','Assigned','Unassigned','PMS override'])}</div>${hr?`<div class="pms-bulkbar"><span id="pmsSelectedCount">${pmsEmployeeSelected.size} selected</span><button onclick="pmsOpenAssignment()">Assign Manager</button></div>`:''}<div class="tablewrap"><table><thead><tr>${hr?'<th><input type="checkbox" aria-label="Select all visible employees" onchange="pmsSelectVisible(this.checked)"></th>':''}<th>EMPLOYEE ID</th><th>EMPLOYEE NAME</th><th>DEPARTMENT</th><th>POSITION</th><th>ASSIGNED MANAGER</th><th>ASSIGNMENT STATUS</th></tr></thead><tbody id="pmsEmployeeRows"></tbody></table></div><div class="tablefoot"><span id="pmsEmployeeCount"></span><span>Identity and organization fields come from HRDotNet sample records.</span></div></section>`}
function pmsDrawEmployeeRows(){const target=$('#pmsEmployeeRows');if(!target)return;const rows=pmsEmployeeRows(),hr=urHr();target.innerHTML=rows.map(e=>{const assigned=pmsManagerName(e[0]),status=pmsAssignmentStatus(e[0]);return `<tr data-pms-record="employee" data-pms-id="${esc(e[0])}" tabindex="0" aria-label="Open employee ${esc(e[1])}">${hr?`<td><input type="checkbox" aria-label="Select ${esc(e[1])}" ${pmsEmployeeSelected.has(e[0])?'checked':''} onchange="pmsSelectEmployee('${e[0]}',this.checked)"></td>`:''}<td>${esc(e[0])}</td><td>${urDisplayPerson(e[0])}</td><td>${esc(e[3])}</td><td>${esc(e[2])}</td><td>${esc(assigned)}${data.pmsManagerAssignments[e[0]]?'<small>HRDotNet Performance performance assignment</small>':'<small>HRDotNet default</small>'}</td><td>${urBadge(status)}${pmsManagerScheduleHtml(e[0])}</td></tr>`}).join('')+(!rows.length?`<tr><td colspan="${hr?7:6}" class="empty">No employees match these filters.</td></tr>`:'');$('#pmsEmployeeCount').textContent=`${rows.length} employees shown`;if($('#pmsSelectedCount'))$('#pmsSelectedCount').textContent=`${pmsEmployeeSelected.size} selected`}
function pmsSelectEmployee(id,checked){if(!urHr())return;checked?pmsEmployeeSelected.add(id):pmsEmployeeSelected.delete(id);$('#pmsSelectedCount').textContent=`${pmsEmployeeSelected.size} selected`}
function pmsSelectVisible(checked){if(!urHr())return;for(const e of pmsEmployeeRows())checked?pmsEmployeeSelected.add(e[0]):pmsEmployeeSelected.delete(e[0]);pmsDrawEmployeeRows()}
function pmsEmployeeLookupOptions(){return data.employees.filter(e=>pmsAssignmentInCompany(e[0],pmsAssignmentCompany())).filter(e=>`${e[0]} ${e[1]} ${e[2]} ${e[3]}`.toLowerCase().includes((pmsAssignmentDraft.employeeSearch||'').toLowerCase())).map(e=>`<label class="pms-lookup-option"><input type="checkbox" ${pmsAssignmentDraft.employees.includes(e[0])?'checked':''} onchange="pmsToggleAssignmentEmployee('${e[0]}',this.checked)"><span><b>${esc(e[1])}</b><small>${esc(e[0])} · ${esc(e[3])} · Current: ${esc(pmsManagerName(e[0]))}</small>${pmsManagerScheduleHtml(e[0])}</span></label>`).join('')||'<p class="pms-lookup-empty">No matching HRDotNet employees.</p>'}
function pmsManagerLookupOptions(){return pmsManagers().filter(m=>`${m.id} ${m.name} ${m.department}`.toLowerCase().includes(pmsAssignmentDraft.managerSearch.toLowerCase())).map(m=>`<label class="pms-lookup-option"><input type="radio" name="pms-manager" value="${m.id}" ${pmsAssignmentDraft.manager===m.id?'checked':''} onchange="pmsAssignmentDraft.manager=this.value"><span><b>${esc(m.name)}</b><small>${esc(m.id)} · ${esc(m.department)} · ${esc(m.position)}</small></span></label>`).join('')||'<p class="pms-lookup-empty">No matching eligible managers.</p>'}
function pmsOpenAssignment(ids){if(!urHr())return;const chosen=Array.isArray(ids)?ids:[...pmsEmployeeSelected];pmsAssignmentDraft={employees:chosen.filter(id=>pmsHrEmployee(id)),manager:'',employeeSearch:'',managerSearch:'',effective:urToday};modal('Assign Manager','Select existing HRDotNet people for HRDotNet Performance performance management',`<div class="modalbody pms-assignment-modal"><div class="pms-lookup-grid"><div><label>Employee lookup<input aria-label="Search HRDotNet employees" placeholder="Search existing employees…" oninput="pmsAssignmentDraft.employeeSearch=this.value;$('#pmsEmployeeOptions').innerHTML=pmsEmployeeLookupOptions()"></label><div class="pms-lookup-list" id="pmsEmployeeOptions">${pmsEmployeeLookupOptions()}</div><small id="pmsAssignmentSelected">${pmsAssignmentDraft.employees.length} employee${pmsAssignmentDraft.employees.length===1?'':'s'} selected</small></div><div><label>Manager lookup<input aria-label="Search HRDotNet managers" placeholder="Search eligible managers…" oninput="pmsAssignmentDraft.managerSearch=this.value;$('#pmsManagerOptions').innerHTML=pmsManagerLookupOptions()"></label><div class="pms-lookup-list" id="pmsManagerOptions">${pmsManagerLookupOptions()}</div></div></div><label class="pms-effective">Assignment effective date<input type="date" aria-label="Assignment effective date" min="${urToday}" value="${urToday}" onchange="pmsAssignmentDraft.effective=this.value"></label><div class="notice">Future assignments remain scheduled until their effective date; current access and reviewers stay unchanged until then. This changes the HRDotNet Performance performance manager only. HRDotNet’s official reporting hierarchy remains unchanged. Not-started manager reviews are reassigned; submitted or in-progress responses retain their original evaluator.</div><div id="pmsAssignmentError" class="urerror" role="alert"></div></div>`,`<button onclick="closeModal()">Cancel</button><button class="primary" onclick="pmsSaveAssignment()">Save Assignment</button>`)}
function pmsToggleAssignmentEmployee(id,checked){if(!urHr()||!pmsHrEmployee(id))return;const selected=new Set(pmsAssignmentDraft.employees);checked?selected.add(id):selected.delete(id);pmsAssignmentDraft.employees=[...selected];$('#pmsAssignmentSelected').textContent=`${selected.size} employee${selected.size===1?'':'s'} selected`}
function pmsWouldCycle(employeeId,managerId){let current=managerId;const seen=new Set();while(current&&!seen.has(current)){if(current===employeeId)return true;seen.add(current);current=pmsManagerId(current)}return false}
function pmsSaveAssignment(){
 if(!urHr()||!pmsAssignmentDraft)return false;
 const d=pmsAssignmentDraft,employees=[...new Set(d.employees||[])],errorNode=$('#pmsAssignmentError'),fail=message=>{errorNode.textContent=message;return false};
 if(!employees.length)return fail('Select at least one employee.');
 if(!pmsAssignmentDate(d.effective)||d.effective<urToday)return fail('Choose a valid effective date on or after today.');
 const proposals=employees.map(employee=>({id:urUid('manager-assignment'),employee,managerId:d.manager,effective:d.effective,companyId:pmsAssignmentCompany(),status:'Pending',createdBy:urUser(),createdAt:new Date().toISOString()}));
 const error=proposals.map(pmsManagerAssignmentError).find(Boolean)||pmsManagerTimelineError(proposals);if(error)return fail(error);
 for(const entry of proposals){data.pmsPendingManagerAssignments.push(entry);pmsManagerAssignmentEvent(entry,entry.effective>urToday?'Scheduled':'Assignment requested')}
 pmsProcessManagerAssignments();save();pmsEmployeeSelected.clear();closeModal();render();toast(`${employees.length} performance manager assignment${employees.length===1?'':'s'} ${d.effective>urToday?'scheduled':'saved'}`);return true;
}

openGoal=function(id){const goal=data.goals.find(g=>g.id===id),owners=[...data.employees];modal(goal?'Update goal':'Create goal','Define a measurable outcome, milestones, and progress.',`<form id="pmsGoalForm"><div class="modalbody"><div class="formgrid"><label class="full">Goal / measurable target<input name="name" required maxlength="140" value="${esc(goal?.name||'')}" placeholder="e.g. Reduce support response time to four hours"></label><label>Owner<select name="employee">${owners.map(e=>`<option ${goal?.employee===e[1]?'selected':''}>${esc(e[1])}</option>`).join('')}</select></label><label>Category<select name="category">${['Quality','Delivery','Growth','Collaboration'].map(c=>`<option ${goal?.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Due date<input name="due" type="date" required value="${goal?.due||data.cycle.due}"></label><label>Progress (%)<input name="progress" type="number" required min="0" max="100" value="${goal?.progress??0}"></label><label class="full">Milestones (one per line)<textarea name="milestones" rows="4" placeholder="Draft approach&#10;Review with manager&#10;Deliver final result">${esc((goal?.milestones||[]).join('\n'))}</textarea></label></div></div><div class="modalfoot"><button type="button" onclick="closeModal()">Cancel</button><button class="primary">Save goal</button></div></form>`);$('#pmsGoalForm').onsubmit=event=>{event.preventDefault();const f=new FormData(event.target),name=String(f.get('name')||'').trim(),owner=f.get('employee');if(!name||!owners.some(e=>e[1]===owner))return;const next={id:goal?.id||Date.now(),name,employee:owner,category:f.get('category'),due:f.get('due'),progress:Number(f.get('progress')),milestones:String(f.get('milestones')||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)};goal?Object.assign(goal,next):data.goals.push(next);save();closeModal();render();toast('Goal saved')}};
goalsView=function(){return `<section class="panel"><div class="panelhead"><div><h2>Assigned goals</h2><p>Measurable outcomes, milestones, and current progress.</p></div></div><div class="tablewrap"><table><thead><tr><th>GOAL / TARGET</th><th>OWNER</th><th>CATEGORY</th><th>PROGRESS</th><th>DUE DATE</th><th></th></tr></thead><tbody>${scopedGoals().map(g=>`<tr><td class="urwrap"><b>${esc(g.name)}</b><small>${pmsGoalMilestones(g).length?`${pmsGoalMilestones(g).length} milestone${pmsGoalMilestones(g).length===1?'':'s'} · ${esc(pmsGoalMilestones(g).map(m=>m.title).join(' · '))}`:'No milestones added'}</small></td><td>${esc(g.employee)}</td><td><span class="pill">${esc(g.category)}</span></td><td>${progress(g.progress)}</td><td>${date(g.due)}</td><td><button class="textbtn" onclick="roleGoal(${g.id})">Update ↗</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No goals assigned.</td></tr>'}</tbody></table></div></section>`};

/* Goal provenance separates employee-authored plans from manager/HR assignments. */
let pmsGoalsTab='My Goals';
function pmsGoalOwner(g){return data.employees.find(e=>g.ownerId?e[0]===g.ownerId:e[1]===g.employee)?.[0]}
function pmsOwnGoal(g){return pmsGoalOwner(g)===employeeId&&(g.createdBy?g.createdBy===employeeId:g.source==='self')}
function pmsGoalMilestones(g){return (g.milestones||[]).map(m=>typeof m==='string'?{title:m,done:false}:m)}
function pmsGoalStatus(g){return g.status==='Pending Approval'?'Pending Approval':Number(g.progress)>=100?'Completed':'Active'}
function pmsGoalId(){return Math.max(0,...data.goals.map(g=>Number(g.id)||0))+1}
if(!data.goals.some(g=>pmsOwnGoal(g))){data.goals.push({id:pmsGoalId(),name:'Improve campaign analytics storytelling',employee:'Sofia Garcia',category:'Growth',startDate:'2026-10-01',due:'2026-12-15',progress:35,createdBy:employeeId,source:'self',status:'Active',milestones:[{title:'Complete reporting course',done:true},{title:'Present campaign insights',done:false}]});save()}
function pmsSetGoalsTab(tab){if(viewRole!=='Employee'||!['My Goals','Assigned Goals'].includes(tab))return;pmsGoalsTab=tab;render()}
function pmsEmployeeGoals(){
  const mine=pmsGoalsTab==='My Goals',rows=scopedGoals().filter(g=>pmsOwnGoal(g)===mine);
  return head('Goals','Create personal goals and track the outcomes assigned to you.',mine?'<button class="gradient" onclick="roleGoal()">＋ Create Goal</button>':'')
    +`<section class="panel"><div class="tabs pms-goal-tabs" role="tablist" aria-label="Employee goals"><button type="button" role="tab" aria-selected="${mine}" class="${mine?'selected':''}" onclick="pmsSetGoalsTab('My Goals')">My Goals</button><button type="button" role="tab" aria-selected="${!mine}" class="${!mine?'selected':''}" onclick="pmsSetGoalsTab('Assigned Goals')">Assigned Goals</button></div><div class="panelhead"><div><h2>${mine?'My Goals':'Assigned Goals'}</h2><p>${mine?'Goals you created for your own performance and development.':'Goals assigned by your manager or HR. Update progress without changing the original target or deadline.'}</p></div><span class="pill blue">${rows.length} goal${rows.length===1?'':'s'}</span></div><div class="tablewrap"><table><thead><tr><th>GOAL NAME</th><th>${mine?'CATEGORY':'ASSIGNED BY'}</th><th>START DATE</th><th>DUE DATE</th><th>PROGRESS</th><th>STATUS</th></tr></thead><tbody>${rows.map(g=>`<tr><td class="urwrap"><b>${esc(g.name)}</b><small>${pmsGoalMilestones(g).filter(m=>m.done).length} of ${pmsGoalMilestones(g).length} milestones complete</small></td><td>${esc(mine?g.category:(g.assignedBy||pmsManagerName(employeeId)))}</td><td>${date(g.startDate||'2026-10-01')}</td><td>${date(g.due)}</td><td>${progress(g.progress)}</td><td>${urBadge(pmsGoalStatus(g))}</td><td><button class="textbtn" onclick="${mine?'pmsOpenSelfGoal':'pmsOpenAssignedGoal'}(${JSON.stringify(g.id)})">${mine?(pmsGoalStatus(g)==='Completed'?'View details':'View / Edit'):(pmsGoalStatus(g)==='Completed'?'View details':'View / Update')} ↗</button></td></tr>`).join('')||`<tr><td colspan="7" class="empty">${mine?'No personal goals yet. Create your first goal to start tracking progress.':'No goals have been assigned to you.'}</td></tr>`}</tbody></table></div></section>`;
}
function pmsOpenSelfGoal(id){
  if(viewRole!=='Employee')return;
  const goal=id==null?null:data.goals.find(g=>g.id===id&&pmsOwnGoal(g)&&pmsGoalOwner(g)===employeeId);
  if(id!=null&&!goal)return;
  const locked=goal&&pmsGoalStatus(goal)==='Completed',milestones=pmsGoalMilestones(goal||{});
  modal(goal?'Personal goal details':'Create personal goal','Your own performance or development outcome.',`<form id="pmsSelfGoalForm"><div class="modalbody"><div class="formgrid"><label class="full">Goal name / measurable target<input name="name" required maxlength="140" value="${esc(goal?.name||'')}" ${locked?'readonly':''}></label><label>Category<select name="category" ${locked?'disabled':''}>${['Quality','Delivery','Growth','Collaboration'].map(c=>`<option ${goal?.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Progress (%)<input name="progress" type="number" required min="0" max="100" value="${goal?.progress??0}" ${locked?'readonly':''}></label><label>Start date<input name="startDate" type="date" required value="${goal?.startDate||urToday}" ${locked?'readonly':''}></label><label>Due date<input name="due" type="date" required value="${goal?.due||data.cycle.due}" ${locked?'readonly':''}></label><label class="full">Milestones / key results (one per line)<textarea name="milestones" rows="4" ${locked?'readonly':''}>${esc(milestones.map(m=>m.title).join('\n'))}</textarea></label>${!goal?'<label class="full pms-checkbox"><input name="approval" type="checkbox"> Request manager approval for this goal</label>':''}</div><div class="notice">${goal?`Status: ${esc(pmsGoalStatus(goal))}. `:''}This goal stays under My Goals because you created it.</div></div><div class="modalfoot"><button type="button" onclick="closeModal()">Close</button>${locked?'':'<button class="primary">Save Goal</button>'}</div></form>`);
  if(locked)return;
  $('#pmsSelfGoalForm').onsubmit=event=>{event.preventDefault();if(viewRole!=='Employee')return;const f=new FormData(event.target),name=String(f.get('name')||'').trim(),startDate=String(f.get('startDate')||''),due=String(f.get('due')||''),value=Number(f.get('progress'));if(!name||!startDate||!due||due<startDate||!Number.isFinite(value)||value<0||value>100){toast('Check the goal name, dates, and progress.');return}const old=pmsGoalMilestones(goal||{}),nextMilestones=String(f.get('milestones')||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(title=>({title,done:!!old.find(m=>m.title===title&&m.done)}));const next={id:goal?.id??pmsGoalId(),name,employee:roleName(),category:String(f.get('category')||'Growth'),startDate,due,progress:value,milestones:nextMilestones,createdBy:employeeId,source:'self',status:goal?.status==='Pending Approval'?'Pending Approval':f.get('approval')?'Pending Approval':value>=100?'Completed':'Active'};goal?Object.assign(goal,next):data.goals.push(next);save();closeModal();render();toast('Goal saved')};
}
function pmsOpenAssignedGoal(id){
  if(viewRole!=='Employee')return;
  const goal=data.goals.find(g=>g.id===id&&!pmsOwnGoal(g)&&pmsGoalOwner(g)===employeeId);if(!goal)return;
  const locked=pmsGoalStatus(goal)==='Completed',milestones=pmsGoalMilestones(goal);
  modal('Assigned goal details','Track an assigned outcome and record your progress.',`<form id="pmsAssignedGoalForm"><div class="modalbody"><div class="formgrid"><div class="full"><small>GOAL / ORIGINAL TARGET</small><h2>${esc(goal.name)}</h2></div><div><small>ASSIGNED BY</small><h2>${esc(goal.assignedBy||pmsManagerName(employeeId))}</h2></div><div><small>CATEGORY</small><h2>${esc(goal.category)}</h2></div><div><small>START DATE</small><h2>${date(goal.startDate||'2026-10-01')}</h2></div><div><small>DUE DATE</small><h2>${date(goal.due)}</h2></div><label class="full">Progress (%)<input name="progress" type="number" required min="0" max="100" value="${goal.progress}" ${locked?'readonly':''}></label></div><h2 class="pms-milestone-title">Milestones</h2><div class="pms-milestone-list">${milestones.length?milestones.map((m,i)=>`<label class="pms-checkbox"><input name="milestone-${i}" type="checkbox" ${m.done?'checked':''} ${locked?'disabled':''}> ${esc(m.title)}</label>`).join(''):'<p>No milestones have been added to this goal.</p>'}</div><label>Progress update / comment<textarea name="comment" rows="3" placeholder="Describe your progress or a blocker…" ${locked?'readonly':''}></textarea></label>${goal.updates?.length?`<div class="pms-update-history"><h2>Recent updates</h2>${goal.updates.slice(-3).reverse().map(u=>`<p><b>${esc(u.by)}</b> · ${date(u.at)} — ${esc(u.text)}</p>`).join('')}</div>`:''}<div class="notice">The original target, assigned-by information, and due date are managed by your manager or HR.</div></div><div class="modalfoot"><button type="button" onclick="closeModal()">Close</button>${locked?'':'<button class="primary">Save Progress</button>'}</div></form>`);
  if(locked)return;
  $('#pmsAssignedGoalForm').onsubmit=event=>{event.preventDefault();if(viewRole!=='Employee'||pmsOwnGoal(goal)||pmsGoalOwner(goal)!==employeeId)return;const f=new FormData(event.target),value=Number(f.get('progress'));if(!Number.isFinite(value)||value<0||value>100)return;goal.progress=value;goal.milestones=milestones.map((m,i)=>({title:m.title,done:!!f.get(`milestone-${i}`)}));const comment=String(f.get('comment')||'').trim();if(comment)(goal.updates??=[]).push({by:roleName(),at:urToday,text:comment});goal.status=value>=100?'Completed':'Active';save();closeModal();render();toast('Progress saved')};
}
const pmsOriginalRoleGoal=roleGoal;
roleGoal=function(id){if(viewRole==='Employee')return id==null?pmsOpenSelfGoal():pmsOwnGoal(data.goals.find(g=>g.id===id)||{})?pmsOpenSelfGoal(id):pmsOpenAssignedGoal(id);pmsOriginalRoleGoal(id)};
const pmsOriginalOpenGoal=openGoal;
openGoal=function(id){
  if(viewRole==='Employee')return roleGoal(id);
  if(id!=null&&!scopedGoals().some(g=>g.id===id))return;
  const before=new Set(data.goals.map(g=>g.id)),editor=roleName(),creator=urUser();
  pmsOriginalOpenGoal(id);
  const form=$('#pmsGoalForm');if(!form)return;
  const submit=form.onsubmit;
  form.onsubmit=event=>{submit(event);const goal=id!=null?data.goals.find(g=>g.id===id):data.goals.find(g=>!before.has(g.id));if(!goal)return;goal.createdBy??=creator;goal.assignedBy??=editor;goal.startDate??=urToday;goal.source??='assigned';save();render()};
};

function pmsReportRows(){return UR.assignments.filter(urVisible).filter(a=>{
  const c=urCycle(a.cycle),p=urPerson(a.subject),period=c.periodStart+' — '+c.periodEnd;
  return (pmsReportFilter.cycle==='All cycles'||c.name===pmsReportFilter.cycle)
    &&(pmsReportFilter.period==='All periods'||period===pmsReportFilter.period)
    &&(pmsReportFilter.department==='All departments'||p.department===pmsReportFilter.department)
    &&(pmsReportFilter.type==='All types'||a.type===pmsReportFilter.type);
})}
function pmsRatingEligible(a){
  const c=urCycle(a.cycle);
  if(a.state!=='Completed'||!c.released)return false;
  if(urAnon(a)&&urResultGroups(c,a.subject).find(g=>g.type===a.type)?.hidden)return false;
  return true;
}
function pmsReportBars(rows,formatter,max=100){
  if(!rows.length)return '<div class="pms-chart-empty">Insufficient data for this selection.</div>';
  return `<div class="bars">${rows.map(([label,value,detail])=>`<div class="barrow"><span title="${esc(label)}">${esc(label)}</span><div class="track"><i style="width:${Math.max(0,Math.min(100,max?value/max*100:0))}%"></i></div><b>${formatter(value,detail)}</b></div>`).join('')}</div>`;
}
function pmsReportSelect(label,key,options){return `<label class="urfilter"><span>${label}</span><select aria-label="${label}" onchange="pmsReportFilter.${key}=this.value;render()">${options.map(v=>`<option ${pmsReportFilter[key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`}
function pmsReportsPage(){
  const options=UR.assignments.filter(urVisible),cycles=[...new Set(options.map(a=>urCycle(a.cycle).name))],periods=[...new Set(options.map(a=>{const c=urCycle(a.cycle);return c.periodStart+' — '+c.periodEnd}))],departments=[...new Set(options.map(a=>urPerson(a.subject).department))];
  const rows=pmsReportRows(),done=rows.filter(a=>a.state==='Completed'),pending=rows.length-done.length;
  const completedPeople=new Set(done.filter(a=>{
    const all=UR.assignments.filter(other=>other.cycle===a.cycle&&other.subject===a.subject);
    return all.length&&all.every(other=>other.state==='Completed');
  }).map(a=>a.subject));
  const eligible=done.filter(pmsRatingEligible),scored=eligible.filter(a=>urMean(a)!==null),score=urAvg(scored.map(urMean));
  const depts=[...new Set(rows.map(a=>urPerson(a.subject).department))].sort().map(d=>{const group=rows.filter(a=>urPerson(a.subject).department===d);return [d,Math.round(group.filter(a=>a.state==='Completed').length/group.length*100),group.length]});
  const distribution=[1,2,3,4,5].map(n=>[`${n} ${n===1?'star':'stars'}`,scored.filter(a=>Math.round(urMean(a))===n).length]);
  const states=['Not Started','In Progress','Submitted','Completed','Locked'].map(s=>[s,rows.filter(a=>(a.stage&&typeof pdUnlocked==='function'&&!pdUnlocked(a)?'Locked':a.state)===s).length]);
  const competencies=new Map();for(const a of eligible)for(const q of a.template.questions.filter(q=>q.type==='Rating')){const value=a.answers[q.id];if(!value||value==='NO')continue;const old=competencies.get(q.title)||[];old.push(Number(value));competencies.set(q.title,old)}
  const competencyRows=[...competencies].map(([name,values])=>[name,urAvg(values),values.length]).sort((a,b)=>b[2]-a[2]).slice(0,6);
  return head('Reports','Measure review completion and finalized performance outcomes in your permitted scope.',`<button onclick="roleExport()">↓ Export CSV</button>`)
    +`<section class="panel pms-report-filters"><div class="toolbar urtoolbar">${pmsReportSelect('Review Cycle','cycle',['All cycles',...cycles])}${pmsReportSelect('Review Period','period',['All periods',...periods])}${pmsReportSelect('Department','department',['All departments',...departments])}${pmsReportSelect('Review Type','type',['All types',...urTypes])}<button class="textbtn" onclick="pmsReportFilter={cycle:'All cycles',period:'All periods',department:'All departments',type:'All types'};render()">Clear</button></div></section>`
    +`<p class="pms-report-note">Charts use the selected visible assignments. Submitted responses remain pending until finalized. Ratings include released results only and exclude unanswered and Not Observed answers.</p>`
    +`<div class="chartgrid">${chartPanel('Review Completion by Department','Finalized assignments as a share of each department',pmsReportBars(depts,v=>v+'%'))}${chartPanel('Performance Rating Distribution','Eligible finalized scores grouped on the five-point scale',scored.length?pmsReportBars(distribution,v=>String(v),Math.max(1,...distribution.map(x=>x[1]))):'<div class="pms-chart-empty">Insufficient finalized rating data for this selection.</div>')}</div>`
    +`<div class="chartgrid">${chartPanel('Review Status Breakdown','Submitted and Completed remain separate workflow states',(rows.length?pmsReportBars(states,v=>String(v),Math.max(1,...states.map(x=>x[1])))+`<p class="pms-chart-note">${rows.filter(a=>urEffective(a)==='Overdue').length} overdue assignment${rows.filter(a=>urEffective(a)==='Overdue').length===1?'':'s'} included in Not Started or In Progress.</p>`:'<div class="pms-chart-empty">Insufficient data for this selection.</div>'))}${chartPanel('Competency Performance Summary','Most answered rating questions · average observed score',pmsReportBars(competencyRows,v=>v.toFixed(2),5))}</div>`;
}

roleExport=function(){
  const rows=page==='Reports'?pmsReportRows():urDashAssignments();
  urDownloadCsv([['Employee','Cycle','Review period','Type','Department','Reviewer','Due date','Status','Eligible rating'],...rows.map(a=>{const c=urCycle(a.cycle);return [urPerson(a.subject).name,c.name,c.periodStart+' — '+c.periodEnd,a.type,urPerson(a.subject).department,urAnon(a)&&a.reviewer!==urUser()?'Anonymous evaluator':urPerson(a.reviewer).name,a.deadline,urEffective(a),pmsRatingEligible(a)?urMean(a)??'':'']})],'pmsdotnet-review-report.csv');
};

let pmsHeaderMenu=null;
data.pmsNotificationsEnabled??=true;
function pmsNotificationRows(){return UR.assignments.filter(a=>a.reviewer===urUser()&&['Not Started','In Progress'].includes(a.state)).sort((a,b)=>a.deadline.localeCompare(b.deadline))}
function pmsRenderHeader(){
  const profile=$('#pmsProfileMenu'),notifications=$('#pmsNotificationsMenu');if(!profile||!notifications)return;
  const roles=['Employee','Manager','HR Administrator'];
  profile.innerHTML=`<div class="pms-menu-title">PREVIEW AS USER TYPE</div>${roles.map(role=>`<button type="button" role="menuitemradio" aria-checked="${role===viewRole}" onclick="pmsSelectRole('${role}')"><span>${esc(role)}</span><span class="pms-selected-mark" aria-hidden="true">${role===viewRole?'✓':''}</span></button>`).join('')}`;
  const due=pmsNotificationRows();
  notifications.innerHTML=`<div class="pms-menu-title">NOTIFICATIONS</div>${data.pmsNotificationsEnabled?(due.length?`<div class="pms-notice-summary">${due.length} review${due.length===1?'':'s'} need${due.length===1?'s':''} your response</div>${due.slice(0,3).map(a=>`<button type="button" class="pms-notice-item" onclick="pmsCloseHeaderMenus();navigate('Reviews')"><b>${esc(urPerson(a.subject).name)} · ${esc(a.type)}</b><small>Due ${date(a.deadline)} · ${esc(urEffective(a))}</small></button>`).join('')}`:'<p class="pms-menu-empty">You’re up to date.</p>'):'<p class="pms-menu-empty">Notifications are turned off in Settings.</p>'}`;
  profile.hidden=pmsHeaderMenu!=='profile';notifications.hidden=pmsHeaderMenu!=='notifications';
  $('#pmsProfileButton').setAttribute('aria-expanded',String(pmsHeaderMenu==='profile'));
  $('#pmsNotificationsButton').setAttribute('aria-expanded',String(pmsHeaderMenu==='notifications'));
  $('header .avatar').textContent=initials(roleName());
}
function pmsToggleHeaderMenu(which){pmsHeaderMenu=pmsHeaderMenu===which?null:which;pmsRenderHeader()}
function pmsCloseHeaderMenus(){if(pmsHeaderMenu){pmsHeaderMenu=null;pmsRenderHeader()}}
function pmsSelectRole(role){if(!['Employee','Manager','HR Administrator'].includes(role))return;pmsHeaderMenu=null;setRole(role)}
function pmsOpenSettings(){pmsCloseHeaderMenus();modal('Settings','Workspace preferences.',`<div class="modalbody"><label class="pms-setting-row"><span><b>Review notifications</b><small>Show assigned reviews in the top-bar notifications panel.</small></span><input id="pmsNotificationsEnabled" type="checkbox" ${data.pmsNotificationsEnabled?'checked':''}></label></div>`,`<button onclick="closeModal()">Cancel</button><button class="primary" onclick="pmsSaveSettings()">Save Settings</button>`)}
function pmsSaveSettings(){data.pmsNotificationsEnabled=$('#pmsNotificationsEnabled').checked;save();closeModal();pmsRenderHeader();toast('Settings saved')}
if(document.addEventListener){document.addEventListener('click',event=>{if(!event.target.closest('.pms-header-popover-host'))pmsCloseHeaderMenus()});document.addEventListener('keydown',event=>{if(event.key==='Escape')pmsCloseHeaderMenus()})}

const pmsOriginalRender=render;
const pmsOriginalNavigate=navigate;
const pmsOriginalSetRole=setRole;
navigate=function(destination){if(['My Goals','Team Goals','Goals & KPIs'].includes(destination))destination='Goals';if(['My Profile','Roles & Access'].includes(destination))return;if(destination==='Goals'&&page!=='Goals')pmsGoalsTab='My Goals';pmsOriginalNavigate(destination)};
setRole=function(role){pmsHeaderMenu=null;pmsEmployeeFilters={q:'',department:'All departments',position:'All positions',manager:'All managers',status:'All statuses'};pmsEmployeeSelected.clear();pmsGoalsTab='My Goals';pmsOriginalSetRole(role)};
render=function(){
  if(page==='Reviews'&&!urHr()&&urTab!=='Reviews'){urTab='Reviews';urScreen='list'}
  pmsOriginalRender();
  $('#nav').innerHTML=pmsSidebar();
  pmsRenderHeader();
  ;
  if(page==='Reports')$('#content').innerHTML=pmsReportsPage();
  else if(page==='Employees'||page==='My Team'){$('#content').innerHTML=pmsEmployeesPage();pmsDrawEmployeeRows()}
  else if(page==='Goals')$('#content').innerHTML=viewRole==='Employee'?pmsEmployeeGoals():head('Goals','Set measurable outcomes, track milestones, and update progress.',`<button class="gradient" onclick="roleGoal()">＋ Create Goal</button>`)+goalsView();
};

render();


