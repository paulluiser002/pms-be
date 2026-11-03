/* One dashboard renderer; each role supplies its permitted records and panel configuration. */
let pmsDashboardCycle='all',pmsDashboardLoading=false;
let pmsDashboardFilters={period:'This Quarter',department:'All Departments',start:'',end:''};
function pmsDashboardRange(){
  const year=Number(urToday.slice(0,4)),month=Number(urToday.slice(5,7))-1,iso=d=>d.toISOString().slice(0,10),f=pmsDashboardFilters;
  if(f.period==='Custom Date Range')return {start:f.start,end:f.end,valid:!!f.start&&!!f.end&&f.start<=f.end};
  const first=f.period==='This Year'?0:f.period==='This Quarter'?Math.floor(month/3)*3:month,months=f.period==='This Year'?12:f.period==='This Quarter'?3:1;
  return {start:iso(new Date(Date.UTC(year,first,1))),end:iso(new Date(Date.UTC(year,first+months,0))),valid:true};
}
function pmsDashboardOverlaps(start,end,range){return range.valid&&!!start&&!!end&&start<=range.end&&end>=range.start}
function pmsDashboardCycleMatches(c,range=pmsDashboardRange()){return pmsDashboardOverlaps(c.periodStart,c.periodEnd,range)}
function pmsDashboardGoalMatches(g,range=pmsDashboardRange()){return pmsDashboardOverlaps(g.periodStart||g.startDate||g.due,g.periodEnd||g.due,range)}
function pmsDashboardSetFilter(key,value){
  const focusedLabel=document.activeElement?.getAttribute('aria-label');
  if(key==='cycle')pmsDashboardCycle=value;else pmsDashboardFilters[key]=value;
  if(key==='period'&&value==='Custom Date Range'&&!pmsDashboardFilters.start){const quarter=pmsDashboardRangeForQuarter();pmsDashboardFilters.start=quarter.start;pmsDashboardFilters.end=quarter.end}
  render();
  if(focusedLabel)document.querySelector(`.pms-dash-filters [aria-label="${focusedLabel}"]`)?.focus();
}
function pmsDashboardRangeForQuarter(){const prior=pmsDashboardFilters.period;pmsDashboardFilters.period='This Quarter';const range=pmsDashboardRange();pmsDashboardFilters.period=prior;return range}
function pmsDashboardData(){
  const range=pmsDashboardRange(),department=urHr()?pmsDashboardFilters.department:'All Departments';
  const employees=scopedEmployees().filter(e=>department==='All Departments'||e[3]===department),names=new Set(employees.map(e=>e[1]));
  const goals=scopedGoals().filter(g=>names.has(g.employee)&&pmsDashboardGoalMatches(g,range));
  const visible=UR.assignments.filter(a=>urVisible(a)&&urCycle(a.cycle)?.status!=='Cancelled');
  const cycles=UR.cycles.filter(c=>urHr()||visible.some(a=>a.cycle===c.id)||c.participants.some(id=>viewRole==='Manager'&&urTeam(id)));
  if(pmsDashboardCycle!=='all'&&!cycles.some(c=>c.id===pmsDashboardCycle))pmsDashboardCycle='all';
  const reviews=visible.filter(a=>(viewRole==='Employee'||pmsDashboardCycle==='all'||a.cycle===pmsDashboardCycle)&&(viewRole!=='Employee'||a.reviewer===urUser())&&(department==='All Departments'||urPerson(a.subject).department===department)&&pmsDashboardCycleMatches(urCycle(a.cycle),range));
  const pending=reviews.filter(a=>urCycle(a.cycle).status==='Active'&&['Not Started','In Progress'].includes(a.state));
  const mine=pending.filter(a=>a.reviewer===urUser()).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  const completed=reviews.filter(a=>a.state==='Completed');
  const overdueGoals=goals.filter(g=>g.due<urToday&&Number(g.progress)<100);
  const average=goals.length?Math.round(goals.reduce((n,g)=>n+Number(g.progress||0),0)/goals.length):null;
  return {employees,goals,cycles,reviews,pending,mine,completed,overdueGoals,average,range,department,rate:reviews.length?Math.round(completed.length/reviews.length*100):null};
}
function pmsDashEmpty(message){return `<div class="pms-dash-empty">${esc(message)}</div>`}
function pmsDashPanel(title,subtitle,body){return `<section class="panel pms-dash-panel"><div class="panelhead"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div><div class="pms-dash-body">${body}</div></section>`}
function pmsDashMetric(label,value,note,action){return `<button class="stat pms-dash-stat" onclick="${action}"><span class="top">${esc(label)}<span class="symbol" aria-hidden="true">↗</span></span><strong>${esc(value)}</strong><small>${esc(note)}</small></button>`}
function pmsDashboardOpenReviews(scope='all',status='All statuses',department='All departments'){
  const cycle=viewRole==='Employee'||pmsDashboardCycle==='all'?'All cycles':urCycle(pmsDashboardCycle).name;
  if(urHr()&&department==='All departments'&&pmsDashboardFilters.department!=='All Departments')department=pmsDashboardFilters.department;
  urFilter={view:scope==='mine'?'My Reviews':scope==='team'?'Team Reviews':'All Reviews',q:'',cycle,type:'All types',department,status};
  navigate('Reviews');
}
function pmsDashboardOpenGoals(kind='all',owner='',category=''){
  const key=viewRole==='Employee'?'mine':'admin';
  pmsClearGoalFilters(key);
  if(viewRole==='Employee')pmsClearGoalFilters('assigned');
  if(kind==='overdue')pmsGoalFilters[key].due='Overdue';
  if(owner&&key==='admin')pmsGoalFilters.admin.owner=owner;
  if(category)pmsGoalFilters[key].category=category;
  navigate('Goals');
}
function pmsDashboardOpenGoal(id){const g=scopedGoals().find(g=>g.id===id);if(!g)return;roleGoal(id)}
function pmsDashBars(rows,empty='No goal data available.'){
  if(!rows.length)return pmsDashEmpty(empty);
  return `<div class="pms-dash-bars">${rows.map(r=>`<button class="pms-dash-bar" onclick="${r.action}" aria-label="${esc(r.label)}: ${r.value===null?'No data':r.value+'%'}"><span>${esc(r.label)}${r.note?`<small>${esc(r.note)}</small>`:''}</span><span class="track"><i style="width:${r.value??0}%"></i></span><b>${r.value===null?'—':r.value+'%'}</b></button>`).join('')}<div class="pms-dash-axis"><span>0%</span><span>50%</span><span>100%</span></div></div>`;
}
function pmsDashDonut(rows,scope){
  if(!rows.length)return pmsDashEmpty('No review assignments match these filters.');
  const states=['Not Started','In Progress','Submitted','Completed','Locked'],colors=['#bccbd8','#73abda','#ab96d5','#6dbb9b','#d8dde3'];const baseState=a=>typeof pdUnlocked==='function'&&!pdUnlocked(a)?'Locked':a.state;let offset=0;
  const parts=states.map((state,i)=>{const count=rows.filter(a=>baseState(a)===state).length,pct=count/rows.length*100;const part=`<circle cx="70" cy="70" r="52" fill="none" stroke="${colors[i]}" stroke-width="15" pathLength="100" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="${-offset}"/>`;offset+=pct;return part}).join('');
  const rate=Math.round(rows.filter(a=>a.state==='Completed').length/rows.length*100),overdue=rows.filter(a=>['Not Started','In Progress'].includes(baseState(a))&&a.deadline<urToday).length;
  return `<div class="pms-dash-donut"><svg viewBox="0 0 140 140" role="img" aria-label="${rate}% completed across ${rows.length} review assignments"><g transform="rotate(-90 70 70)">${parts}</g><text x="70" y="68" text-anchor="middle" class="pms-donut-value">${rate}%</text><text x="70" y="86" text-anchor="middle" class="pms-donut-label">COMPLETED</text></svg><div class="pms-dash-legend">${states.map((state,i)=>`<button onclick="pmsDashboardOpenReviews('${scope}','${state}')"><i style="background:${colors[i]}"></i><span>${state}</span><b>${rows.filter(a=>baseState(a)===state).length}</b></button>`).join('')}</div></div><p class="pms-dash-note">${overdue} overdue · included in Not Started or In Progress</p>`;
}
function pmsDashReviewList(rows){return rows.length?`<div class="pms-dash-list">${rows.slice(0,4).map(a=>`<div class="pms-dash-list-row"><div><b>${esc(urCycle(a.cycle).name)}</b><p>${esc(a.type)}${viewRole==='Manager'?' · '+esc(urPerson(a.subject).name):''}</p><small class="${a.deadline<urToday?'pms-due-overdue':''}">${a.deadline<urToday?'Overdue · ':''}Due ${date(a.deadline)}</small></div><div class="pms-dash-row-action">${urBadge(a.state)}<button class="textbtn" onclick="urOpenReview('${a.id}')">${a.state==='In Progress'?'Continue Review':'Start Review'} →</button></div></div>`).join('')}${rows.length>4?`<button class="textbtn pms-dash-view-all" onclick="pmsDashboardOpenReviews('mine')">View all ${rows.length} assigned reviews →</button>`:''}</div>`:pmsDashEmpty('You have no reviews awaiting your response.')}
function pmsDashGoalDeadlines(goals){const rows=goals.filter(g=>Number(g.progress)<100).sort((a,b)=>a.due.localeCompare(b.due));return rows.length?`<div class="pms-dash-list">${rows.slice(0,4).map(g=>`<div class="pms-dash-list-row"><div><b>${esc(g.name)}</b><small class="${g.due<urToday?'pms-due-overdue':''}">${g.due<urToday?'Overdue · ':''}${date(g.due)} · ${g.progress}% complete</small></div><button class="textbtn" onclick="pmsDashboardOpenGoal(${Number(g.id)})">View Goal →</button></div>`).join('')}</div>`:pmsDashEmpty('No upcoming goal deadlines.')}
function pmsDashAction(title,text,label,action){return `<div class="pms-dash-list-row"><div><b>${esc(title)}</b><p>${esc(text)}</p></div><button class="textbtn" onclick="${action}">${esc(label)} →</button></div>`}
function pmsDashNextActions(d){
  if(urHr()){
    const cycles=d.cycles.filter(c=>(pmsDashboardCycle==='all'||c.id===pmsDashboardCycle)&&pmsDashboardCycleMatches(c,d.range)&&(d.department==='All Departments'||c.participants.some(id=>urPerson(id).department===d.department))),drafts=cycles.filter(c=>c.status==='Draft'),ready=cycles.filter(c=>c.status==='Active'&&urCycleAssignments(c).length&&urCycleAssignments(c).every(a=>['Submitted','Completed'].includes(a.state))),releasable=cycles.filter(c=>c.status==='Completed'&&!c.released),due=cycles.filter(c=>c.status==='Active').sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,3);
    return `<div class="pms-dash-list">${ready.slice(0,1).map(c=>pmsDashAction('Ready to finalize',c.name,'Open Cycle',`urOpenCycle('${c.id}')`)).join('')}${releasable.slice(0,1).map(c=>pmsDashAction('Results awaiting release',c.name,'Open Cycle',`urOpenCycle('${c.id}')`)).join('')}${drafts.slice(0,1).map(c=>pmsDashAction('Continue cycle setup',c.name,'Continue',`urStartWizard('${c.id}')`)).join('')}${due.map(c=>pmsDashAction(c.name,`Submission deadline · ${date(c.deadline)}`,'View Cycle',`urOpenCycle('${c.id}')`)).join('')}${pmsDashAction('Plan the next review cycle','Set participants, evaluators, and dates.','Create Cycle','urStartWizard(null,true)')}</div>`;
  }
  const next=d.mine[0],actions=[];
  if(next)actions.push(pmsDashAction('Your next evaluation',`${urPerson(next.subject).name} · Due ${date(next.deadline)}`,next.state==='In Progress'?'Continue Review':'Start Review',`urOpenReview('${next.id}')`));
  if(viewRole==='Manager'){
    if(d.overdueGoals.length)actions.push(pmsDashAction(`${d.overdueGoals.length} overdue team goals`,'Follow up on progress and blockers.','View Goals',"pmsDashboardOpenGoals('overdue')"));
    actions.push(pmsDashAction('Check in with your team',`${d.employees.length} direct reports`,'View Team',"navigate('My Team')"));
  }else{
    const goal=d.goals.filter(g=>Number(g.progress)<100).sort((a,b)=>a.due.localeCompare(b.due))[0];
    if(goal)actions.push(pmsDashAction('Update your goal progress',goal.name,'View Goal',`pmsDashboardOpenGoal(${Number(goal.id)})`));
    actions.push(pmsDashAction('Plan your next goal','Add a personal development or performance goal.','Create Goal','pmsOpenSelfGoal()'));
  }
  return `<div class="pms-dash-list">${actions.join('')}</div>`;
}
function pmsDashboardConfig(d){
  const avg=d.average===null?'—':d.average+'%',mine="pmsDashboardOpenReviews('mine')",all="pmsDashboardOpenReviews()",goals='pmsDashboardOpenGoals()';
  if(urHr()){
    const departments=[...new Set(d.employees.map(e=>e[3]))].sort();
    const goalBars=departments.map(department=>{const names=d.employees.filter(e=>e[3]===department).map(e=>e[1]),gs=d.goals.filter(g=>names.includes(g.employee));return {label:department,value:gs.length?Math.round(gs.reduce((n,g)=>n+Number(g.progress||0),0)/gs.length):null,note:gs.length+(gs.length===1?' goal':' goals'),action:goals}});
    const reviewBars=departments.map(department=>{const rows=d.reviews.filter(a=>urPerson(a.subject).department===department);return {label:department,value:rows.length?Math.round(rows.filter(a=>a.state==='Completed').length/rows.length*100):null,note:rows.length+' assignments',action:`pmsDashboardOpenReviews('all','All statuses','${department}')`}});
    return {metrics:[['Total Review Assignments',d.reviews.length,'Selected evaluation period',all],['Review Completion Rate',d.rate===null?'—':d.rate+'%','Finalized assignments / total assignments',all],['Pending Reviews',d.pending.length,'Not Started or In Progress · active cycles',all],['Average Goal Progress',avg,d.goals.length+' goals · selected period',goals]],panels:[['Review Status','Selected evaluation period',pmsDashDonut(d.reviews,'all')],['Goal Progress by Department','Goals in the selected period',pmsDashBars(d.goals.length?goalBars:[])],['Review Completion by Department','Finalized review assignments',pmsDashBars(d.reviews.length?reviewBars:[],'No review assignments match these filters.')],['Next Actions and Upcoming Deadlines','',pmsDashNextActions(d)]]};
  }
  if(viewRole==='Manager')return {metrics:[['Team Members',d.employees.length,'Direct reports assigned to you',"navigate('My Team')"],['Pending Evaluations',d.mine.length,'Your Not Started or In Progress reviews',mine],['Average Team Goal Progress',avg,d.goals.length+' team goals · selected period',goals],['Overdue Goals',d.overdueGoals.length,'Past due and below 100% progress',"pmsDashboardOpenGoals('overdue')"]],panels:[['Team Goal Progress','Goals in period by team member',pmsDashBars((d.goals.length?d.employees:[]).map(e=>{const gs=d.goals.filter(g=>g.employee===e[1]);return {label:e[1],value:gs.length?Math.round(gs.reduce((n,g)=>n+Number(g.progress||0),0)/gs.length):null,note:gs.length+(gs.length===1?' goal':' goals'),action:`pmsDashboardOpenGoals('all','${e[1]}')`}}))],['Team Review Status','Direct reports · evaluation period',pmsDashDonut(d.reviews.filter(a=>urTeam(a.subject)),'team')],['Pending Evaluations','Assigned to you · earliest deadline first',pmsDashReviewList(d.mine)],['Next Actions','',pmsDashNextActions(d)]]};
  return {metrics:[['My Goals',d.goals.length,'Personal and assigned goals',goals],['Average Goal Progress',avg,'Goals in the selected period',goals],['Pending Reviews',d.mine.length,'Your Not Started or In Progress reviews',mine],['Completed Reviews',d.completed.length,'Your finalized review assignments',"pmsDashboardOpenReviews('mine','Completed')"]],panels:[['My Goal Progress','Personal and assigned goals',pmsDashBars(d.goals.map(g=>({label:g.name,value:Number(g.progress||0),note:pmsOwnGoal(g)?'Personal goal':'Assigned goal',action:`pmsDashboardOpenGoal(${Number(g.id)})`})))],['My Pending Reviews','Assigned to you · earliest deadline first',pmsDashReviewList(d.mine)],['Upcoming Goal Deadlines','Incomplete goals · earliest deadline first',pmsDashGoalDeadlines(d.goals)],['Next Actions','',pmsDashNextActions(d)]]};
}
function pmsDashboardHeader(d){
  const description='Monitor review activity and goal progress across your organization.',f=pmsDashboardFilters,custom=f.period==='Custom Date Range';
  const toolbarSelect=(label,value,options,code,extra='')=>`<label class="pms-dash-control ${extra}"><span class="pms-visually-hidden">${label}</span><select aria-label="${label}" title="${label}" onchange="${code}">${options.map(o=>`<option value="${esc(o.value??o)}" ${(o.value??o)===value?'selected':''}>${esc(o.label??o)}</option>`).join('')}</select></label>`;
  const period=toolbarSelect('Period',f.period,['This Month','This Quarter','This Year','Custom Date Range'],"pmsDashboardSetFilter('period',this.value)",'pms-dash-period-filter');
  const cycle=viewRole!=='Employee'?toolbarSelect('Dashboard review cycle',pmsDashboardCycle,[{value:'all',label:'All Cycles'},...d.cycles.map(c=>({value:c.id,label:c.name}))],"pmsDashboardSetFilter('cycle',this.value)",'pms-dash-cycle-filter'):'';
  const department=urHr()?toolbarSelect('Department',f.department,['All Departments',...new Set(data.employees.map(e=>e[3]))],"pmsDashboardSetFilter('department',this.value)",'pms-dash-department-filter'):'';
  const dates=custom?`<label class="pms-dash-control pms-dash-date-filter"><span class="pms-visually-hidden">Start Date</span><input type="date" required aria-invalid="${!d.range.valid}" aria-label="Dashboard start date" title="Start date" value="${esc(f.start)}" max="${esc(f.end)}" onchange="pmsDashboardSetFilter('start',this.value)"></label><label class="pms-dash-control pms-dash-date-filter"><span class="pms-visually-hidden">End Date</span><input type="date" required aria-invalid="${!d.range.valid}" aria-label="Dashboard end date" title="End date" value="${esc(f.end)}" min="${esc(f.start)}" onchange="pmsDashboardSetFilter('end',this.value)"></label>`:'';
  return `<div class="pms-dash-header"><div class="pms-dash-title"><h1>Dashboard</h1><p>${description}</p></div><div class="pms-dash-filters" role="group" aria-label="Dashboard filters">${period}${cycle}${department}${dates}</div></div>${!d.range.valid?'<div class="urerror pms-dash-filter-error" role="alert">Choose a start and end date. The end date must be on or after the start date.</div>':''}`;
}
function pmsDashboard(){
  const d=pmsDashboardData();
  if(!d.range.valid)return `<div class="pms-dashboard">${pmsDashboardHeader(d)}${pmsDashEmpty('Set a valid reporting period to view dashboard data.')}</div>`;
  if(pmsDashboardLoading)return pmsDashboardHeader(d)+'<section class="panel pms-dash-loading" role="status" aria-busy="true">Loading dashboard…</section>';
  const config=pmsDashboardConfig(d);
  return `<div class="pms-dashboard">${pmsDashboardHeader(d)}<div class="stats pms-dash-stats">${config.metrics.map(m=>pmsDashMetric(...m)).join('')}</div><div class="chartgrid pms-dash-grid">${config.panels.map(p=>pmsDashPanel(...p)).join('')}</div></div>`;
}
const pmsDashboardSetRoleBase=setRole;
setRole=function(role){if(role!==viewRole){pmsDashboardCycle='all';pmsDashboardFilters={period:'This Quarter',department:'All Departments',start:'',end:''}}pmsDashboardSetRoleBase(role)};
const pmsRenderDashboard=render;
render=function(){pmsRenderDashboard();if(page==='Dashboard')$('#content').innerHTML=pmsDashboard()};
page='Dashboard';render();



