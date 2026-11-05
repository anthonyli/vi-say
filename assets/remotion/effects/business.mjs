// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {validateProductUi} from './product-contract.mjs';
import {editorState,PRODUCT_ICONS} from './node-editor.mjs';
import {progress,lerp} from './motion.mjs';

// Each module exposes its authored inputs; validation and catalog use this table.
export const BUSINESS_FIELDS=Object.freeze({
  'panel-merge':['variant','ui','box','sources','title','detail','mergeAt','seconds'],
  'node-editor':['ui','dropSeconds','bars','metrics','metricsAt','box','nodes','moving','from','dragAt','dragSeconds','testAt','testSeconds','result'],
  network:['ui','box','nodes','edges','seconds','boxFrames'],
  document:['variant','ui','box','sources','title','rows','gatherAt','gatherSeconds','writeAt','writeSeconds','reviewAt','reviewLabel','reportAt','reportTitle'],
  chart:['ui','box','values','labels','title','seconds'],
  scan:['ui','box','query','rows','scanAt','seconds','result'],
});

export function validateBusiness(e,duration,h) {
  const {keys,text,number,color,pixelBox,fail}=h;
  pixelBox(e.box);
  if(e.ui!==undefined)validateProductUi(e.type,e.ui,h);
  if(e.box[2]<600||e.box[3]<240)fail('business module box needs at least 600x240');
  const begin=e.at??0,end=e.endAt??duration;
  const time=(v,name)=>number(v,begin,end,name);
  const phase=(at,seconds,name,after=begin)=>{time(at,name);number(seconds,.1,20,name+' seconds');if(at<after-.001||at+seconds>end-.1)fail(name+' must follow the preceding phase and leave an ending hold');return at+seconds;};
  const list=(v,name,min,max)=>{if(!Array.isArray(v)||v.length<min||v.length>max)fail(`${name} needs ${min}..${max} entries`);};
  const point=p=>{if(!Array.isArray(p)||p.length!==2)fail('normalized point needs [x,y]');p.forEach(x=>number(x,0,1,'normalized point'));};
  const strings=(v,name,min,max,chars)=>{list(v,name,min,max);v.forEach(s=>text(s,name,chars));};
  if(e.type==='panel-merge'){
    if(e.variant!==undefined&&!['workspace','profile'].includes(e.variant))fail('unknown merge variant');
    if(e.variant==='profile'&&e.sources?.length!==2)fail('profile merge requires two sources');
    strings(e.sources,'sources',2,4,18);text(e.title,'merge title',28);if(e.detail!==undefined)text(e.detail,'merge detail',60);
    phase(e.mergeAt,e.seconds??1.2,'merge');
  }
  if(e.type==='node-editor'){
    strings(e.nodes,'nodes',3,3,18);number(e.moving,0,2,'moving');if(!Number.isInteger(e.moving))fail('moving must be an integer');point(e.from);
    const dropped=phase(e.dragAt,e.dragSeconds??1.2,'drag');
    const drop=phase(dropped,e.dropSeconds??.4,'drop');const tested=phase(e.testAt,e.testSeconds??1,'test',drop);text(e.result,'test result',50);
    if(e.bars!==undefined){list(e.bars,'bars',2,40);e.bars.forEach(v=>number(v,0,1e12,'bar'));}
    if(e.metrics!==undefined){list(e.metrics,'metrics',2,3);for(const m of e.metrics){keys(m,['value','unit','label','color'],'metric');text(m.value,'metric value',10);text(m.label,'metric label',28);if(m.unit!==undefined)text(m.unit,'metric unit',8);color(m.color);}phase(e.metricsAt,.7,'metrics',tested);}
    else if(e.metricsAt!==undefined)fail('metricsAt requires metrics');
  }
  if(e.type==='network'){
    list(e.nodes,'nodes',2,16);list(e.edges,'edges',1,30);const ids=new Map();
    for(const n of e.nodes){keys(n,['id','label','position','at','color','main','badge','icon'],'network node');text(n.id,'node id',40);if(ids.has(n.id))fail('duplicate network node');ids.set(n.id,n);text(n.label,'node label',18);if(n.icon!==undefined&&!PRODUCT_ICONS.includes(n.icon))fail('unknown node icon');point(n.position);color(n.color);phase(n.at,.55,'node');if(n.main!==undefined&&typeof n.main!=='boolean')fail('main must be boolean');if(n.badge!==undefined)text(n.badge,'node badge',18);}
    for(const edge of e.edges){keys(edge,['from','to','at','color'],'network edge');if(!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)fail('edge must reference two existing nodes');color(edge.color);phase(edge.at,e.seconds??.8,'edge',Math.max(ids.get(edge.from).at,ids.get(edge.to).at));}
    if(e.boxFrames!==undefined){list(e.boxFrames,'boxFrames',1,12);let last=begin;for(const f of e.boxFrames){keys(f,['at','box'],'network box frame');time(f.at,'box frame');if(f.at<=last)fail('boxFrames must be strictly ordered');pixelBox(f.box);if(f.box[2]<240||f.box[3]<100)fail('network inset is too small');last=f.at;}}
  }
  if(e.type==='document'){
    if(e.variant!==undefined&&!['case','report'].includes(e.variant))fail('unknown document variant');
    strings(e.sources,'sources',2,4,18);text(e.title,'document title',28);list(e.rows,'rows',2,5);
    for(const r of e.rows){keys(r,['label','text'],'document row');text(r.label,'row label',20);text(r.text,'row text',44);}
    const gathered=phase(e.gatherAt,e.gatherSeconds??1,'gather'),written=phase(e.writeAt,e.writeSeconds??1.5,'write',gathered);
    text(e.reviewLabel,'review label',28);const reviewed=phase(e.reviewAt,.5,'review',written);
    if(e.reportAt!==undefined){phase(e.reportAt,.8,'report',reviewed);text(e.reportTitle,'report title',28);}else if(e.reportTitle!==undefined)fail('reportTitle requires reportAt');
  }
  if(e.type==='chart'){
    list(e.values,'values',2,32);e.values.forEach(v=>number(v,0,1e12,'chart value'));
    if(e.labels!==undefined){strings(e.labels,'labels',e.values.length,e.values.length,14);}
    text(e.title,'chart title',28);phase(begin,e.seconds??2,'chart');
  }
  if(e.type==='scan'){
    text(e.query,'query',36);strings(e.rows,'rows',2,5,40);text(e.result,'scan result',44);phase(e.scanAt,e.seconds??1.5,'scan');
  }
}

export function businessState(e,t) {
  const at=e.at??0;
  if(e.type==='panel-merge')return {merge:progress(t,e.mergeAt,e.seconds??1.2)};
  if(e.type==='node-editor')return editorState(e,t);
  if(e.type==='document')return {gather:progress(t,e.gatherAt,e.gatherSeconds??1),write:progress(t,e.writeAt,e.writeSeconds??1.5),review:progress(t,e.reviewAt,.5),report:e.reportAt===undefined?0:progress(t,e.reportAt,.8)};
  return {reveal:progress(t,e.type==='scan'?e.scanAt:at,e.seconds??(e.type==='scan'?1.5:2))};
}

export function networkBox(e,t) {
  let before={at:e.at??0,box:e.box};
  for(const after of e.boxFrames??[]){if(t<after.at){const p=progress(t,before.at,after.at-before.at);return before.box.map((v,i)=>lerp(v,after.box[i],p));}before=after;}
  return before.box;
}

export function businessTimes(e) {
  const at=e.at??0;
  if(e.type==='panel-merge')return [e.mergeAt,e.mergeAt+(e.seconds??1.2)/2,e.mergeAt+(e.seconds??1.2)];
  if(e.type==='node-editor')return [e.dragAt,e.dragAt+(e.dragSeconds??1.2)/2,e.dragAt+(e.dragSeconds??1.2),e.testAt+(e.testSeconds??1),...(e.metricsAt===undefined?[]:[e.metricsAt+.35,e.metricsAt+.7])];
  if(e.type==='network')return [...e.nodes.flatMap(n=>[n.at,n.at+.55]),...e.edges.map(x=>x.at+(e.seconds??.8)),...(e.boxFrames??[]).map(x=>x.at)];
  if(e.type==='document')return [e.gatherAt,e.gatherAt+(e.gatherSeconds??1),e.writeAt+(e.writeSeconds??1.5)/2,e.reviewAt+.5,...(e.reportAt===undefined?[]:[e.reportAt+.4,e.reportAt+.8])];
  const seconds=e.seconds??(e.type==='scan'?1.5:2);
  return [at,(e.scanAt??at)+seconds/2,(e.scanAt??at)+seconds];
}
