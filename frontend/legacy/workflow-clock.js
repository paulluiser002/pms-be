/* Company workflow dates are independent of the browser's timezone. */
const pmsWorkflowTimezone='Asia/Manila';
function pmsWorkflowDateValid(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value}
function pmsWorkflowClock(){const value=data.pmsWorkflowClock;return value?.mode==='demo'&&pmsWorkflowDateValid(value.demoDate)?{mode:'demo',demoDate:value.demoDate}:{mode:'live'}}
function pmsWorkflowToday(now=new Date()){
 const clock=pmsWorkflowClock();if(clock.mode==='demo')return clock.demoDate;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:pmsWorkflowTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=type=>parts.find(p=>p.type===type).value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
