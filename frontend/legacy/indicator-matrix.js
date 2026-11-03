/* Per-indicator reference matrices travel with existing template snapshots. */
function mxEditable(){return urHr()&&pdGoalEditor&&!pdGoalPreview&&pdView!=='goalDetails'&&(!pdGoalEditor.status||pdGoalEditor.status==='Draft')}
function mxChange(i,change,redraw=false){if(!mxEditable())return;const x=pdGoalEditor.indicators[i];if(!x)return;change(x);urDirty=true;if(redraw)render()}
function mxDefaultScale(x,bound=x.direction==='Lower'?'maximum':'minimum'){
 const target=Number(x.target);
 return {kind:'scale',title:'Numeric threshold scale',bound,scoring:false,rows:bound==='maximum'?[{maximum:target,label:'Target met',score:5},{maximum:null,label:'Below target',score:1}]:target===0?[{minimum:0,label:'Target met',score:5}]:[{minimum:0,label:'Below target',score:1},{minimum:target,label:'Target met',score:5}]};
}
function mxSetKind(i,kind){mxChange(i,x=>{if(kind==='none')delete x.matrix;else if(kind==='table')x.matrix={kind,title:'Reference matrix',columns:['Criteria','Guidance'],rows:[['','']],scoring:false};else if(kind==='scale')x.matrix=mxDefaultScale(x)},true)}
function mxSetBound(i,bound){if(!['minimum','maximum'].includes(bound))return;mxChange(i,x=>x.matrix=mxDefaultScale(x,bound),true)}
function mxTitle(i,value){mxChange(i,x=>x.matrix.title=value)}
function mxCell(i,r,c,value){mxChange(i,x=>x.matrix.rows[r][c]=value)}
function mxColumn(i,c,value){mxChange(i,x=>x.matrix.columns[c]=value)}
function mxAddRow(i){mxChange(i,x=>{const m=x.matrix;if(m.kind==='scale'&&m.bound==='maximum')m.rows.splice(Math.max(0,m.rows.length-1),0,{maximum:'',label:'',score:''});else m.rows.push(m.kind==='scale'?{minimum:'',label:'',score:''}:m.columns.map(()=>''))},true)}
function mxRemoveRow(i,r){mxChange(i,x=>{const m=x.matrix;if(m.kind==='scale'&&m.bound==='maximum'&&m.rows[r]?.maximum===null)return;m.rows.splice(r,1)},true)}
function mxAddColumn(i){mxChange(i,x=>{x.matrix.columns.push('Column '+(x.matrix.columns.length+1));x.matrix.rows.forEach(r=>r.push(''))},true)}
function mxRemoveColumn(i,c){mxChange(i,x=>{x.matrix.columns.splice(c,1);x.matrix.rows.forEach(r=>r.splice(c,1))},true)}
function mxScaleCell(i,r,key,value){mxChange(i,x=>x.matrix.rows[r][key]=key==='label'?value:value===''?'':Number(value));mxRefreshPreview(i)}
function mxScoring(i,value){mxChange(i,x=>{if(x.matrix.kind==='scale')x.matrix.scoring=!!value},true)}
function mxMatrixErrors(x){
 const m=x.matrix;if(!m)return [];const errors=[];
 if(m.kind==='table'){
  if(!Array.isArray(m.columns)||!m.columns.length||!m.columns.every(c=>typeof c==='string'&&c.trim())||!Array.isArray(m.rows)||!m.rows.length||!m.rows.every(r=>Array.isArray(r)&&r.length===m.columns.length&&r.every(c=>typeof c==='string')))errors.push('Add labeled columns and at least one complete table row.');
  if(m.scoring)errors.push('Only numeric threshold scales can be used for scoring.');
 }else if(m.kind==='scale'){
  const maximum=m.bound==='maximum',key=maximum?'maximum':'minimum';
  if(m.bound!=null&&!['minimum','maximum'].includes(m.bound))errors.push('Choose minimum or maximum thresholds.');
  if(!Array.isArray(m.rows)||!m.rows.length||m.rows.some((r,i)=>!r||typeof r.label!=='string'||!r.label.trim()||!Number.isFinite(r.score)||r.score<1||r.score>5||(maximum&&i===m.rows.length-1?r[key]!==null:!Number.isFinite(r[key])||r[key]<0||(!maximum&&i===0?r[key]!==0:i>0&&r[key]<=m.rows[i-1][key]))))errors.push(maximum?'Scale rows need labels, scores from 1 to 5, distinct increasing nonnegative maximums, and a final row with no upper limit.':'Scale rows need a label, a score from 1 to 5, and distinct increasing nonnegative minimums starting at 0.');
 }else errors.push('Choose a supported matrix type.');
 return errors;
}
const mxBaseTemplateErrors=pdGoalTemplateErrors;
pdGoalTemplateErrors=function(t,publish){return [...mxBaseTemplateErrors(t,publish),...(publish?t.indicators.flatMap((x,i)=>mxMatrixErrors(x).map(e=>'Indicator '+(i+1)+': '+e)):[])]};
const mxBaseIndicatorScore=pdIndicatorScore;
pdIndicatorScore=function(x,actual){
 if(x.matrix?.kind!=='scale'||x.matrix.scoring!==true)return mxBaseIndicatorScore(x,actual);
 if(actual==null||actual===''||!Number.isFinite(Number(actual))||Number(actual)<0||mxMatrixErrors(x).length)return null;
 return mxScaleScore(x,Number(actual));
};
function mxScaleScore(x,actual){return x.matrix.bound==='maximum'?x.matrix.rows.find(r=>r.maximum===null||actual<=r.maximum)?.score??null:x.matrix.rows.filter(r=>actual>=r.minimum).at(-1)?.score??null}
function mxScaleWarning(x){
 if(mxMatrixErrors(x).length)return '';
 const rows=x.matrix.rows,conflict=rows.some((r,i)=>i>0&&(x.direction==='Lower'?r.score>rows[i-1].score:r.score<rows[i-1].score));
 return conflict?'<p class="mx-warning" role="status">Scale scoring conflicts with the indicator’s '+esc(x.direction==='Lower'?'Lower is better':'Higher is better')+' direction. Review the custom scores and boundaries; they have been kept unchanged.</p>':'';
}
function mxBoundaryPreview(x){
 const errors=mxMatrixErrors(x);if(errors.length)return `<div class="mx-boundary"><b>Boundary score preview</b><p>${esc(errors.join(' '))}</p></div>`;
 const target=Number(x.target),step=Math.max(Math.abs(target)*0.000001,0.000001),samples=[['Zero',0],['Below target',target-step],['Exact target',target],['Above target',target+step]];
 return mxScaleWarning(x)+`<div class="mx-boundary"><b>Boundary score preview</b><p>${x.matrix.scoring?'These matrix scores apply to actual results.':'Proposed matrix scores. Enable Use for scoring to apply them.'}</p><div class="tablewrap"><table><thead><tr><th>CHECK</th><th>ACTUAL</th><th>MATRIX SCORE</th></tr></thead><tbody>${samples.map(([label,value])=>`<tr><td>${label}</td><td>${esc(String(value))}</td><td>${value<0?'Outside nonnegative actual range':mxScaleScore(x,value)+'/5'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function mxRefreshPreview(i){if(!mxEditable())return;const node=document.getElementById('mx-preview-'+i),x=pdGoalEditor.indicators[i];if(node&&x?.matrix?.kind==='scale')node.innerHTML=mxBoundaryPreview(x)}
const mxBaseSetIndicator=pdSetIndicator;
pdSetIndicator=function(i,key,value){mxBaseSetIndicator(i,key,value);if(['target','direction'].includes(key))mxRefreshPreview(i)};
function mxIndicatorReference(x){
 const m=x.matrix;if(!m)return '';const scale=m.kind==='scale';
 const maximum=m.bound==='maximum';
 const headers=scale?(maximum?['Above actual','Maximum actual (inclusive)','Rating label','Score']:['Minimum actual','Applies until','Rating label','Score']):m.columns||[];
 const rows=scale?(m.rows||[]).map((r,i)=>maximum?[i?m.rows[i-1].maximum:'From 0',r.maximum===null?'No upper limit':r.maximum,r.label,r.score]:[r.minimum,i+1<m.rows.length?'Below '+m.rows[i+1].minimum:'No upper limit',r.label,r.score]):m.rows||[];
 return `<details class="mx-reference"><summary>${esc(m.title|| (scale?'Numeric threshold scale':'Reference matrix'))} <span>${scale&&m.scoring?'Used for scoring':'Reference only'}</span></summary><div class="tablewrap"><table><thead><tr>${headers.map(c=>`<th>${esc(String(c))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(String(c??''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${scale?mxBoundaryPreview(x):''}</details>`;
}
function mxIndicatorEditor(x,i,readonly=false){
 if(readonly)return mxIndicatorReference(x);const m=x.matrix;
 let html=`<div class="mx-editor"><label>Indicator matrix<select aria-label="Matrix type for indicator ${i+1}" onchange="mxSetKind(${i},this.value)">${[['none','No matrix'],['table','Custom reference table'],['scale','Numeric threshold scale']].map(([value,label])=>`<option value="${value}" ${value===(m?.kind||'none')?'selected':''}>${label}</option>`).join('')}</select></label>`;
 if(!m)return html+'</div>';
 html+=`<label>Matrix title<input maxlength="120" value="${esc(m.title||'')}" oninput="mxTitle(${i},this.value)"></label>`;
 if(m.kind==='scale'){
  const maximum=m.bound==='maximum',bound=maximum?'maximum':'minimum';
  html+=`<label>Threshold type (changing resets scale rows)<select aria-label="Threshold type" onchange="mxSetBound(${i},this.value)"><option value="minimum" ${!maximum?'selected':''}>Minimum actual (inclusive)</option><option value="maximum" ${maximum?'selected':''}>Maximum actual (inclusive)</option></select></label><label class="mx-scoring"><input type="checkbox" ${m.scoring?'checked':''} onchange="mxScoring(${i},this.checked)">Use for scoring</label><p class="urmuted">${maximum?'Maximum thresholds increase. A row includes its maximum and starts above the previous maximum. The final row has no upper limit.':'Minimum thresholds start at 0 and increase. Each applies until the next minimum; the last has no upper limit.'} ${m.scoring?'This scale replaces target-met / below-target scoring.':'Reference only. Existing target-met / below-target scoring applies.'}</p><div class="tablewrap"><table><thead><tr><th>${maximum?'MAXIMUM ACTUAL (INCLUSIVE)':'MINIMUM ACTUAL'}</th><th>RATING LABEL</th><th>SCORE (1–5)</th><th>ROW</th></tr></thead><tbody>${m.rows.map((r,n)=>`<tr>${[bound,'label','score'].map(key=>`<td>${key==='maximum'&&r.maximum===null?'No upper limit':`<input aria-label="${key===bound?(maximum?'Maximum actual':'Minimum actual'):key==='label'?'Rating label':'Score'} row ${n+1}" ${key==='label'?'type="text"':'type="number" step="any" min="'+(key==='score'?1:0)+'"'+(key==='score'?' max="5"':'')} value="${esc(String(r[key]))}" oninput="mxScaleCell(${i},${n},'${key}',this.value)">`}</td>`).join('')}<td><button aria-label="Remove row ${n+1}" ${maximum&&r.maximum===null?'disabled title="The final row keeps all higher actuals covered."':''} onclick="mxRemoveRow(${i},${n})">Remove row</button></td></tr>`).join('')}</tbody></table></div><div id="mx-preview-${i}" aria-live="polite">${mxBoundaryPreview(x)}</div>`;
 }else{
  html+=`<p class="urmuted">Add your own columns and rows for reference. This table does not change scoring.</p><div class="tablewrap"><table><thead><tr>${m.columns.map((c,n)=>`<th><input aria-label="Column ${n+1} label" value="${esc(c)}" oninput="mxColumn(${i},${n},this.value)"><button aria-label="Remove column ${n+1}" onclick="mxRemoveColumn(${i},${n})">Remove column</button></th>`).join('')}<th>ROW</th></tr></thead><tbody>${m.rows.map((r,n)=>`<tr>${r.map((c,j)=>`<td><input aria-label="Row ${n+1}, column ${j+1}" value="${esc(c)}" oninput="mxCell(${i},${n},${j},this.value)"></td>`).join('')}<td><button aria-label="Remove row ${n+1}" onclick="mxRemoveRow(${i},${n})">Remove row</button></td></tr>`).join('')}</tbody></table></div>`;
 }
 return html+`<div class="mx-actions"><button onclick="mxAddRow(${i})">Add row</button>${m.kind==='table'?`<button onclick="mxAddColumn(${i})">Add column</button>`:''}</div></div>`;
}
