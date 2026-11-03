/* Keep one navigation tree so role changes and existing actions stay authoritative. */
const pmsMobileQuery=matchMedia('(max-width:700px)');
const pmsMobileMenuButton=document.createElement('button');
pmsMobileMenuButton.id='pmsMobileMenuButton';pmsMobileMenuButton.type='button';pmsMobileMenuButton.className='pms-mobile-menu-button';pmsMobileMenuButton.setAttribute('aria-label','Open navigation');pmsMobileMenuButton.setAttribute('aria-haspopup','dialog');pmsMobileMenuButton.setAttribute('aria-controls','pmsMobileNavigation');pmsMobileMenuButton.setAttribute('aria-expanded','false');
pmsMobileMenuButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
document.querySelector('.pms-brand').appendChild(pmsMobileMenuButton);
const pmsMobileDrawer=document.createElement('dialog');pmsMobileDrawer.id='pmsMobileNavigation';pmsMobileDrawer.setAttribute('aria-labelledby','pmsMobileNavigationTitle');
pmsMobileDrawer.innerHTML='<div class="pms-mobile-menu-heading"><h2 id="pmsMobileNavigationTitle">Navigation</h2><button type="button" aria-label="Close navigation" onclick="pmsMobileDrawer.close()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>';
document.body.appendChild(pmsMobileDrawer);
let pmsMobileNavAnchor=null;
pmsMobileMenuButton.addEventListener('click',()=>{
 if(!pmsMobileQuery.matches||pmsMobileDrawer.open)return;
 const nav=document.getElementById('nav');pmsMobileNavAnchor=document.createComment('navigation position');nav.before(pmsMobileNavAnchor);pmsMobileDrawer.appendChild(nav);
 pmsMobileDrawer.showModal();pmsMobileMenuButton.setAttribute('aria-expanded','true');
});
pmsMobileDrawer.addEventListener('close',()=>{const nav=pmsMobileDrawer.querySelector('#nav');if(nav&&pmsMobileNavAnchor)pmsMobileNavAnchor.replaceWith(nav);pmsMobileNavAnchor=null;pmsMobileMenuButton.setAttribute('aria-expanded','false');if(pmsMobileQuery.matches)pmsMobileMenuButton.focus()});
pmsMobileDrawer.addEventListener('click',event=>{const button=event.target.closest('#nav button');if(button&&!button.classList.contains('pms-nav-parent'))pmsMobileDrawer.close();if(event.target===pmsMobileDrawer){const r=pmsMobileDrawer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)pmsMobileDrawer.close()}},true);
pmsMobileQuery.addEventListener('change',()=>{if(!pmsMobileQuery.matches&&pmsMobileDrawer.open)pmsMobileDrawer.close()});

let pmsResponsiveFrame=0;
function pmsResponsiveTables(){
 if(pmsResponsiveFrame)return;
 pmsResponsiveFrame=requestAnimationFrame(()=>{
  pmsResponsiveFrame=0;
  document.querySelectorAll('.tablewrap').forEach(wrap=>{
   const overflow=wrap.scrollWidth>wrap.clientWidth+2;
   wrap.dataset.mobileScroll=String(overflow);wrap.tabIndex=overflow?0:-1;
   if(!wrap.hasAttribute('aria-label')){wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Data table. Scroll horizontally to view all columns.');}
  });
 });
}
new MutationObserver(pmsResponsiveTables).observe(document.body,{childList:true,subtree:true});
addEventListener('resize',pmsResponsiveTables);pmsResponsiveTables();
