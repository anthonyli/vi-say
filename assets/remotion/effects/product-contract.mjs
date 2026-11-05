// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {PRODUCT_ICONS} from './node-editor.mjs';
const shell=['brand','title','workspace','nav','activeNav','footer','avatar'];
export const PRODUCT_UI_FIELDS={
 'node-editor':[...shell,'paletteTitle','tools','nodeDetails','nodeIcons','nodeColors','history','runLabel','resultDetail'],
 'panel-merge':[...shell,'columns','rows','stats','trend','tags','followups','note'],
 chart:[...shell,'detail','stats'],
 scan:['title','subtitle','methods','action','columns','resultRow','footer','steps'],
 network:['title','legend','insights'],
 document:['title','detail','sourceLabel','sourceDetails','reviewTitle','roles','recordLabel','recordValue','footer','attachmentLabel'],
};
export function validateProductUi(type,ui,h){
 const {keys,text,number,color,fail}=h;keys(ui,PRODUCT_UI_FIELDS[type],'product ui');
 const array=(a,name,min,max)=>{if(!Array.isArray(a)||a.length<min||a.length>max)fail(`${name} needs ${min}..${max} entries`);};
 const strings=(a,name,min,max,length)=>{array(a,name,min,max);a.forEach(v=>text(v,name,length));};
 const icon=v=>{if(!PRODUCT_ICONS.includes(v))fail('unknown product icon');};
 for(const [k,v] of Object.entries(ui)){
   if(['nav','tools'].includes(k)){array(v,k,k==='nav'?4:2,k==='nav'?8:4);v.forEach(n=>{keys(n,['label','icon'],k);text(n.label,k,24);icon(n.icon);});}
   else if(k==='activeNav'){number(v,0,(ui.nav?.length??8)-1,k);if(!Number.isInteger(v))fail('activeNav must be integer');}
   else if(k==='nodeDetails')strings(v,k,3,3,60);
   else if(k==='nodeIcons'){array(v,k,3,3);v.forEach(icon);}
   else if(k==='nodeColors'){array(v,k,3,3);v.forEach(color);}
   else if(['tags','followups'].includes(k))strings(v,k,2,k==='tags'?4:2,24);
   else if(['columns','resultRow','steps','sourceDetails'].includes(k))strings(v,k,2,k==='steps'?6:4,48);
   else if(k==='rows'){array(v,k,1,1);v.forEach(row=>strings(row,k,2,4,36));}
   else if(k==='trend'){array(v,k,2,32);v.forEach(n=>number(n,0,1e12,k));}
   else if(k==='stats'){array(v,k,2,3);v.forEach(s=>{keys(s,['value','label','color'],k);text(s.value,k,12);text(s.label,k,26);color(s.color);});}
   else if(k==='legend'){array(v,k,2,4);v.forEach(s=>{keys(s,['label','color'],k);text(s.label,k,18);color(s.color);});}
   else if(k==='insights'){array(v,k,2,4);v.forEach(s=>{keys(s,['title','detail','color'],k);text(s.title,k,24);text(s.detail,k,40);color(s.color);});}
   else if(k==='roles'){array(v,k,2,3);v.forEach(s=>{keys(s,['label','value','icon'],k);text(s.label,k,24);text(s.value,k,24);icon(s.icon);});}
   else text(v,k,80);
 }
 if(type==='scan'&&ui.columns&&!ui.resultRow&&ui.columns.length!==4)fail('custom columns need a matching resultRow');
 if(ui.columns&&ui.resultRow&&ui.columns.length!==ui.resultRow.length)fail('resultRow must match columns');
 if(ui.rows&&ui.columns&&ui.rows.some(row=>row.length!==ui.columns.length))fail('table rows must match columns');
}
