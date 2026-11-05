// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import {BUSINESS_FIELDS,validateBusiness} from './business.mjs';
import botStyles from '../../production/bot-styles.json' with {type:'json'};
export const BOT_ACTIONS=Object.freeze(['idle','look','peek','hop','nudge','work','celebrate','spin']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw new Error(`effects: ${message}`);};
const number=(v,min,max,name)=>{if(!finite(v)||v<min||v>max)fail(`${name} must be ${min}..${max}`);};
const text=(v,name,max=80)=>{if(typeof v!=='string'||!v.trim()||[...v].length>max)fail(`${name} needs 1..${max} characters`);};
const choice=(v,values,name)=>{if(!values.includes(v))fail(`unsupported ${name}: ${v}`);};
const keys=(v,allowed,name)=>{if(!object(v))fail(`${name} must be an object`);for(const k of Object.keys(v))if(!allowed.includes(k))fail(`unknown ${name} field: ${k}`);};
const color=v=>{if(v!==undefined&&!/^#[a-f\d]{6}$/i.test(v))fail('color must be a six digit hex value');};
export function pixelBox(v,name='box') {
  if(!Array.isArray(v)||v.length!==4||!v.every(finite)||v[0]<0||v[1]<0||v[2]<=0||v[3]<=0||v[0]+v[2]>1920||v[1]+v[3]>1080)fail(`${name} must fit the 1920x1080 canvas`);
}
function position(v,name='position') {if(!Array.isArray(v)||v.length!==2)fail(`${name} needs [x,y]`);number(v[0],0,1920,name);number(v[1],0,1080,name);}
function at(v,duration,name='at'){number(v,0,duration,name);}
function ordered(rows,duration,name) {
  if(!Array.isArray(rows)||!rows.length||rows.length>30)fail(`${name} needs 1..30 entries`);
  let previous=-1;
  for(const row of rows){if(!object(row))fail(`${name} entries must be objects`);at(row.at,duration,name);if(row.at<=previous)fail(`${name} must be strictly ordered`);previous=row.at;}
}
function keyframes(effect,duration) {
  if(!effect.keyframes)return;
  ordered(effect.keyframes,duration,'keyframes');
  for(const frame of effect.keyframes){keys(frame,effect.type==='bot'?['at','position','size','angle','compression']:['at','position','size','angle'],'keyframe');if(frame.at>(effect.endAt??duration))fail('keyframe exceeds effect ending');if(frame.position)position(frame.position);if(frame.size!==undefined)number(frame.size,30,600,'size');if(frame.angle!==undefined)number(frame.angle,-360,360,'angle');if(frame.compression!==undefined)number(frame.compression,0,1,'compression');}
}
export const EFFECT_COMMON_FIELDS=['type','id','at','endAt','color','enter','enterSeconds'];
export const EFFECT_FIELDS=Object.freeze({
  ...BUSINESS_FIELDS,
  bot:['variant','position','size','angle','compression','phase','action','actions','keyframes','travelSeconds','arc','label'],
  platform:['position','width','label'],
  card:['position','width','title','label','status','detail','rows','angle','keyframes','changes'],
  paths:['paths','speed'],connection:['position','scale','label','waiting','complete','seconds'],
  flow:['box','sources','targets','summary','gatherAt','gatherSeconds','summaryAt','summarySeconds','sendAt','sendSeconds'],
  route:['points','label','labels','seconds','loop'],focus:['events'],pointer:['points','jump'],
  counter:['box','value','from','prefix','suffix','label','seconds'],
  tag:['position','text'],text:['position','text','fontSize','weight'],list:['box','items'],
});
export const EFFECT_TYPES=Object.freeze(Object.keys(EFFECT_FIELDS));

export function validateModules(doc) {
  if(doc.modules===undefined){if(doc.mouthCues!==undefined)fail('mouthCues need modules.character');return;}
  const m=doc.modules;keys(m,['background','captions','character'],'modules');
  if(m.background!==undefined)choice(m.background,['glass','classic','studio'],'background');
  if(m.captions!==undefined){
    const c=m.captions;keys(c,['style','stripPunctuation','keywords','protectedTerms'],'captions module');
    if(c.style!==undefined)choice(c.style,['plain','highlight'],'caption style');
    if(c.stripPunctuation!==undefined&&typeof c.stripPunctuation!=='boolean')fail('stripPunctuation must be boolean');
    for(const name of ['keywords','protectedTerms'])if(c[name]!==undefined){if(!Array.isArray(c[name])||c[name].length>60)fail(`${name} needs at most 60 terms`);for(const t of c[name])text(t,name,80);}
  }
  if(m.character!==undefined){
    const c=m.character;keys(c,['mode','travelSeconds','arc','tilt'],'character module');
    if(c.mode!==undefined)choice(c.mode,['legacy','rounded','none'],'character mode');
    if(c.travelSeconds!==undefined)number(c.travelSeconds,.1,2,'character travelSeconds');
    if(c.arc!==undefined)number(c.arc,0,150,'character arc');
    if(c.tilt!==undefined)number(c.tilt,0,8,'character tilt');
    if(c.mode==='rounded') {text(doc.characterClosed,'closed character asset',4096);text(doc.characterNeutral,'neutral character asset',4096);}
  }
  if(doc.mouthCues!==undefined){
    if(m.character?.mode!=='rounded'||!Array.isArray(doc.mouthCues)||!doc.mouthCues.length)fail('mouthCues need the rounded character module');
    if(!/^[a-f\d]{64}$/.test(doc.mouthCueAudioSha256??''))fail('mouthCues must be bound to the final audio hash');
    let end=0;for(const cue of doc.mouthCues){choice(cue.value,['X','A','B','C','D','E','F','G','H'],'mouth cue');at(cue.start,doc.duration,'mouth start');at(cue.end,doc.duration,'mouth end');if(Math.abs(cue.start-end)>.001||cue.end<=cue.start)fail('mouth cues must be contiguous');end=cue.end;}
    if(Math.abs(end-doc.duration)>.001)fail('mouth cues must cover the final audio');
  }
}

export function validateEffects(scene, cast=new Map()) {
  const duration=scene.end-scene.start;
  if(scene.characterPose!==undefined){const p=scene.characterPose;keys(p,['left','top','width','height','turn','rotation'],'characterPose');pixelBox([p.left,p.top,p.width,p.height],'characterPose');if(p.turn!==undefined)number(p.turn,-180,180,'turn');if(p.rotation!==undefined)number(p.rotation,-30,30,'rotation');}
  if(scene.effects===undefined)return;
  if(!Array.isArray(scene.effects)||scene.effects.length>40)fail('scene effects needs at most 40 modules');
  if(scene.effects.filter(e=>e?.type==='focus').length>1)fail('use one focus module per demo and combine its events');
  const ids=new Set();
  for(const e of scene.effects){
    if(!object(e))fail('effect must be an object');choice(e.type,EFFECT_TYPES,'effect type');keys(e,[...EFFECT_COMMON_FIELDS.filter(k=>e.type!=='focus'||!['enter','enterSeconds'].includes(k)),...EFFECT_FIELDS[e.type]],e.type);
    const start=e.at??0;at(start,duration);if(e.endAt!==undefined){at(e.endAt,duration,'endAt');if(e.endAt<=start)fail('endAt must follow at');}
    if(e.enter!==undefined)choice(e.enter,['fade','rise','pop','none'],'entry');if(e.enterSeconds!==undefined)number(e.enterSeconds,.05,2,'enterSeconds');color(e.color);
    if(start+(e.enter==='none'?0:e.enterSeconds??.65)>(e.endAt??duration)||start>=(e.endAt??duration))fail('effect entry must complete before its ending');
    if(e.id!==undefined){text(e.id,'effect id',80);if(ids.has(e.id))fail('duplicate effect id in scene');ids.add(e.id);}
    for(const name of ['label','status','detail','waiting','complete','prefix','suffix'])if(e[name]!==undefined&&(typeof e[name]!=='string'||e[name].length>100))fail(`${name} must be a short string`);
    if(e.angle!==undefined)number(e.angle,-360,360,'angle');
    if(e.position!==undefined)position(e.position);if(e.box!==undefined)pixelBox(e.box);
    if(['bot','platform','card','connection','tag','text'].includes(e.type)&&!e.position)fail(`${e.type} requires position`);
    if(['flow','counter','list'].includes(e.type)&&!e.box)fail(`${e.type} requires box`);
    if(Object.hasOwn(BUSINESS_FIELDS,e.type))validateBusiness(e,duration,{keys,text,number,color,pixelBox,fail});
    if(e.type==='bot'){
      text(e.id,'bot id');choice(e.variant,Object.keys(botStyles),'bot variant');if(cast.has(e.id)&&cast.get(e.id)!==e.variant)fail('a bot identity must keep its variant across scenes');cast.set(e.id,e.variant);
      number(e.size??160,30,600,'bot size');choice(e.action??'look',BOT_ACTIONS,'bot action');number(e.phase??0,0,10,'bot phase');number(e.compression??0,0,1,'compression');number(e.travelSeconds??.95,.1,2,'bot travelSeconds');number(e.arc??85,0,160,'bot arc');
      if(start+(e.travelSeconds??.95)>(e.endAt??duration))fail('bot travel must finish before its ending');
      pixelBox([...e.position,e.size??160,e.size??160],'bot bounds');
      if(e.actions){ordered(e.actions,duration,'actions');let end=start;for(const a of e.actions){keys(a,['at','duration','name','hideLabel'],'bot action');choice(a.name,BOT_ACTIONS,'bot action');number(a.duration,.1,duration,'action duration');if(a.at<end-.001||a.at+a.duration>(e.endAt??duration)+.001)fail('bot actions must not overlap or exceed the scene');if(a.hideLabel!==undefined&&typeof a.hideLabel!=='boolean')fail('hideLabel must be boolean');end=a.at+a.duration;}}
      keyframes(e,duration);
      for(const frame of e.keyframes??[])pixelBox([...(frame.position??e.position),frame.size??e.size??160,frame.size??e.size??160],'bot keyframe bounds');
    }
    if(e.type==='platform')number(e.width??650,100,1600,'platform width');
    if(e.type==='card'){
      text(e.title,'card title',40);number(e.width??360,180,1000,'card width');keyframes(e,duration);
      if(e.position[0]+(e.width??360)>1920)fail('card extends beyond the canvas');
      if(e.changes){ordered(e.changes,duration,'card changes');for(const c of e.changes){keys(c,['at','status'],'card change');text(c.status,'status',30);}}
      if(e.rows&&(!Array.isArray(e.rows)||e.rows.length>5||e.rows.some(t=>typeof t!=='string'||t.length>60)))fail('card rows need at most five short texts');
    }
    if(e.type==='paths'){if(!Array.isArray(e.paths)||!e.paths.length||e.paths.length>12||e.paths.some(p=>typeof p!=='string'||p.length>2048||!/^M/i.test(p)))fail('paths need local SVG path data');if(e.speed!==undefined)number(e.speed,0,500,'path speed');}
    if(e.type==='connection'||e.type==='counter'){number(e.seconds??1.5,.1,duration,'seconds');if(start+(e.seconds??1.5)>(e.endAt??duration)-.1)fail('animation must complete with an ending hold');}
    if(e.type==='connection'&&e.scale!==undefined)number(e.scale,.3,3,'connection scale');
    if(e.type==='flow'){
      for(const name of ['sources','targets']){if(!Array.isArray(e[name])||e[name].length<(name==='sources'?2:1)||e[name].length>3)fail(`${name} needs ${name==='sources'?'2..3':'1..3'} cards`);for(const card of e[name]){keys(card,['title','label','status','color'],name);text(card.title,name,30);color(card.color);}}
      keys(e.summary,['title','sections'],'flow summary');text(e.summary.title,'summary title',40);if(!Array.isArray(e.summary.sections)||!e.summary.sections.length||e.summary.sections.length>3)fail('summary needs 1..3 sections');for(const s of e.summary.sections){keys(s,['label','text','color'],'summary section');text(s.text,'summary text',40);color(s.color);}
      let end=start;for(const phase of ['gather','summary','send']){at(e[phase+'At'],duration,phase+'At');const seconds=e[phase+'Seconds']??({gather:1.05,summary:.65,send:1.1}[phase]);number(seconds,.1,3,phase+'Seconds');if(e[phase+'At']<end-.001||e[phase+'At']+seconds>(e.endAt??duration)-.1)fail('flow phases must complete in causal order with an ending hold');end=e[phase+'At']+seconds;}
    }
    if(e.type==='route'){
      if(!Array.isArray(e.points)||e.points.length<2||e.points.length>6)fail('route needs 2..6 points');e.points.forEach(p=>position(p,'route point'));if(e.labels!==undefined&&(!Array.isArray(e.labels)||e.labels.length!==e.points.length||e.labels.some(x=>typeof x!=='string'||x.length>20)))fail('route labels must match points');number(e.seconds??4,.2,duration,'route seconds');if(start+(e.seconds??4)>(e.endAt??duration)-.1)fail('route must allow a full pass and ending hold');if(e.loop!==undefined&&typeof e.loop!=='boolean')fail('route loop must be boolean');
    }
    if(e.type==='focus'){
      if(scene.kind!=='demo'||!Array.isArray(scene.mediaSize)||scene.mediaSize.length!==2||scene.mediaSize.some(n=>!finite(n)||n<=0))fail('focus requires demo mediaSize [width,height]');
      ordered(e.events,duration,'focus events');for(const f of e.events){keys(f,['at','region','label','color','zoom','pan'],'focus event');if(f.at<start||f.at+.35>(e.endAt??duration))fail('focus must allow its transition within the effect interval');const b=f.region;if(!Array.isArray(b)||b.length!==4||b.some(n=>!finite(n)||n<0||n>1)||b[2]<=0||b[3]<=0||b[0]+b[2]>1.001||b[1]+b[3]>1.001)fail('focus region must fit the source image');if(f.zoom!==undefined)number(f.zoom,1,1.5,'focus zoom');if(f.pan!==undefined&&(!Array.isArray(f.pan)||f.pan.length!==2||f.pan.some(n=>!finite(n)||Math.abs(n)>500)))fail('pan needs two pixel offsets');color(f.color);}
    }
    if(e.type==='pointer'){ordered(e.points,duration,'pointer points');for(const p of e.points){keys(p,['at','position','click'],'pointer point');position(p.position);if(p.click!==undefined&&typeof p.click!=='boolean')fail('click must be boolean');}if(e.jump!==undefined&&typeof e.jump!=='boolean')fail('pointer jump must be boolean');}
    if(e.type==='counter'){number(e.value,-1e12,1e12,'counter value');if(e.from!==undefined)number(e.from,-1e12,1e12,'counter from');}
    if(e.type==='text'||e.type==='tag'){text(e.text,e.type,100);if(e.fontSize!==undefined)number(e.fontSize,16,180,'font size');if(e.weight!==undefined)number(e.weight,100,900,'font weight');}
    if(e.type==='list'){ordered(e.items,duration,'list items');if(e.box[3]<e.items.length*90+16*(e.items.length-1))fail('list box is too short for readable items');for(const i of e.items){keys(i,['at','text','detail','color'],'list item');text(i.text,'list text',20);if(i.detail!==undefined)text(i.detail,'list detail',40);color(i.color);}}
  }
}
