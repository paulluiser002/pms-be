/* Theme preference is independent of performance data; switching preserves live form nodes. */
function pmsThemeName(){return document.documentElement.dataset.pmsTheme==='workspace'?'workspace':'classic'}
function pmsThemeCompose(full=true){
 const workspace=pmsThemeName()==='workspace',topbar=document.querySelector('.pms-topbar'),sidebar=document.querySelector('.pms-sidebar'),frame=document.getElementById('pmsWorkspaceFrame');
 let context=document.getElementById('pmsThemeContext'),footer=document.getElementById('pmsThemeFooter');
 if(workspace){
  if(!context){context=document.createElement('div');context.id='pmsThemeContext';context.innerHTML='<div class="pms-theme-breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><b id="pmsThemePageName"></b></div><div class="pms-theme-header-tools"></div>';topbar.prepend(context)}
  document.getElementById('pmsThemePageName').textContent=page;
  const tools=context.querySelector('.pms-theme-header-tools'),search=document.querySelector('.pms-sidebar-search');if(search&&search.parentElement!==tools)tools.prepend(search);
  let role=document.getElementById('pmsThemeRole');if(!role){role=document.createElement('label');role.className='pms-theme-role';role.innerHTML='<span>Role</span><select id="pmsThemeRole" aria-label="Preview as User Type" onchange="pmsSelectRole(this.value)"><option>Employee</option><option>Manager</option><option>HR Administrator</option></select>';tools.appendChild(role)}document.getElementById('pmsThemeRole').value=viewRole;
  if(!footer){footer=document.createElement('footer');footer.id='pmsThemeFooter';footer.innerHTML='<span>© '+new Date().getFullYear()+' Mayon Consolidated Inc. · HRDotNet Performance</span>';frame.after(footer)}
  const clock=document.getElementById('pmsClockStatus');if(clock)footer.appendChild(clock);
 }else{
  const search=context?.querySelector('.pms-sidebar-search');if(search)sidebar.querySelector('.navlabel').before(search);
  const clock=document.getElementById('pmsClockStatus');if(clock)topbar.prepend(clock);
  context?.remove();footer?.remove();
 }
 if(!full)return;
 const dashboard=document.querySelector('.pms-dashboard'),heading=document.querySelector('#pmsPageHeader .pms-dash-header');
 if(dashboard){
  let toolbar=dashboard.querySelector('.pms-theme-dashboard-toolbar');
  if(workspace){const filters=heading?.querySelector('.pms-dash-filters');if(filters){if(!toolbar){toolbar=document.createElement('div');toolbar.className='pms-theme-dashboard-toolbar';dashboard.prepend(toolbar)}toolbar.appendChild(filters)}}
  else if(toolbar){const filters=toolbar.querySelector('.pms-dash-filters');if(filters&&heading)heading.appendChild(filters);toolbar.remove()}
  const grid=dashboard.querySelector('.pms-dash-grid');
  if(grid){const panels=[...grid.children];panels.forEach((panel,i)=>{panel.dataset.themeOrder??=i});
   if(workspace&&panels.length===4){const action=panels.find(p=>p.dataset.themeOrder==='3'),primary=panels.find(p=>p.querySelector('.pms-dash-bars'))||panels[0],others=panels.filter(p=>p!==action&&p!==primary).sort((a,b)=>Number(!!a.querySelector('.pms-dash-donut'))-Number(!!b.querySelector('.pms-dash-donut')));grid.append(primary,action,...others)}
   else if(!workspace)panels.sort((a,b)=>Number(a.dataset.themeOrder)-Number(b.dataset.themeOrder)).forEach(p=>grid.appendChild(p));
  }
  dashboard.querySelectorAll('.pms-dash-stat .symbol').forEach((symbol,i)=>{
   if(workspace){symbol.dataset.themeOriginal??=symbol.innerHTML;symbol.innerHTML=pmsIcon(i===0?'Goals':i===3?'Reports':'Reviews')}
   else if(symbol.dataset.themeOriginal!==undefined){symbol.innerHTML=symbol.dataset.themeOriginal;delete symbol.dataset.themeOriginal}
  });
 }
 document.querySelectorAll('.pms-theme-nav-label').forEach(el=>el.remove());
 if(workspace)for(const [name,label] of [['Reports','INSIGHTS'],['Employees','ADMINISTRATION']]){const button=[...document.querySelectorAll('#nav>button')].find(b=>b.textContent.trim()===name);if(button){const section=document.createElement('div');section.className='pms-theme-nav-label';section.textContent=label;button.before(section)}}
}
function pmsApplyTheme(name){
 const next=name==='workspace'?'workspace':'classic',shell=document.querySelector('.shell'),main=shell.querySelector('main'),heading=document.getElementById('pmsPageHeader'),active=document.activeElement;
 const scroll=main.scrollTop||shell.scrollTop;
 document.documentElement.dataset.pmsTheme=next;
 let frame=document.getElementById('pmsWorkspaceFrame');
 if(next==='workspace'&&!frame){frame=document.createElement('div');frame.id='pmsWorkspaceFrame';shell.querySelector('.pms-topbar').after(frame);if(heading)frame.appendChild(heading);frame.appendChild(main)}
 if(next==='classic'&&frame){if(heading)frame.before(heading);frame.before(main);frame.remove()}
 pmsThemeCompose();
 main.scrollTop=scroll;if(matchMedia('(max-width:700px)').matches&&next==='classic')shell.scrollTop=scroll;
 if(active?.isConnected)active.focus({preventScroll:true});
 try{localStorage.setItem('hrdotnet-performance-theme',next)}catch{}
}
function pmsToggleTheme(){
 const next=pmsThemeName()==='classic'?'workspace':'classic';pmsApplyTheme(next);pmsCloseHeaderMenus();pmsRenderHeader();document.getElementById('pmsProfileButton').focus({preventScroll:true});toast(`${next==='workspace'?'Workspace':'Classic'} theme applied`);
}
const pmsThemeBaseHeader=pmsRenderHeader;
pmsRenderHeader=function(...args){
 pmsThemeBaseHeader(...args);
 const preview=document.querySelector('#pmsProfileMenu .pms-preview-host');if(!preview)return;
 const button=document.createElement('button');button.type='button';button.id='pmsThemeButton';button.className='pms-theme-switch';button.setAttribute('aria-label','Change Theme');button.setAttribute('aria-pressed',String(pmsThemeName()==='workspace'));button.addEventListener('click',pmsToggleTheme);
 button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/><path d="m14 14 2 2 3-3"/></svg><span>Change Theme<small>${pmsThemeName()==='workspace'?'Workspace → Classic':'Classic → Workspace'}</small></span>`;
 preview.after(button);
 pmsThemeCompose(false);
};
const pmsThemeBaseRender=render;
render=function(...args){const result=pmsThemeBaseRender(...args);pmsThemeCompose();return result};
let pmsSavedTheme='classic';try{pmsSavedTheme=localStorage.getItem('hrdotnet-performance-theme')||'classic'}catch{}
pmsApplyTheme(pmsSavedTheme);pmsRenderHeader();
