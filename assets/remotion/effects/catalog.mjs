// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PRODUCT_UI_FIELDS} from './product-contract.mjs';
import {EFFECT_TYPES,EFFECT_FIELDS,EFFECT_COMMON_FIELDS,BOT_ACTIONS} from './contract.mjs';
import {CARTOON_TRANSITIONS,TRANSITION_NAMES,TRANSITION_ALIASES,CSS_TRANSITION_PARAMS,canonicalTransition,validateTransitionPool} from '../cartoon-transitions.mjs';
import {validateCartoon,cartoonStillPoints,style} from '../cartoon-contract.mjs';
import {GL_TRANSITIONS} from '../gl-transitions.mjs';
import {transitionPlan} from '../cartoon-motion.mjs';
import {SCENE_TRANSITION_GROUPS} from '../transition-selection.mjs';

const CSS_LABELS={slide:'横向滑入',radial:'圆形揭示',wipe:'擦除',flip:'透视翻入',converge:'汇聚展开'};

export function catalog(){
  const examples=new URL('../../production/examples/',import.meta.url),presets=new URL('../../production/presets/',import.meta.url);
  const templates=fs.readdirSync(examples).filter(n=>n.endsWith('.json')).map(file=>{
    const sample=JSON.parse(fs.readFileSync(new URL(file,examples),'utf8'));
    const doc={aspect:'16:9',fps:30,duration:sample.scenes.at(-1).end,character:'dragon.png',styleId:'colorful-dragon-v1',cartoonScenes:sample.scenes};
    validateCartoon(doc);
    return {name:file.slice(0,-5),seconds:doc.duration,effects:[...new Set(sample.scenes.flatMap(s=>(s.effects??[]).map(e=>e.type)))],transitions:[...new Set(transitionPlan(doc).map(t=>t.kind))],sampleFrames:cartoonStillPoints(doc).length};
  });
  const demonstrated=new Set(templates.flatMap(t=>t.effects));
  for(const type of EFFECT_TYPES)if(!demonstrated.has(type))throw new Error(`Effect ${type} needs a runnable example before packaging`);
  const demonstratedCuts=new Set(templates.flatMap(t=>t.transitions));
  for(const name of TRANSITION_NAMES)if(!demonstratedCuts.has(name))throw new Error(`Transition ${name} needs a runnable example before packaging`);
  const defaultTransitionPool=validateTransitionPool(style.motion.transitionKinds).map(canonicalTransition);
  const transitionDetails=[
    ...Object.keys(CARTOON_TRANSITIONS).map(name=>({name,label:CSS_LABELS[name],engine:'css',category:'基础转场',seconds:style.motion.transition,params:CSS_TRANSITION_PARAMS[name]})),
    ...GL_TRANSITIONS.map(t=>({...t,engine:'gl'})),
  ].map(t=>({...t,inDefaultPool:defaultTransitionPool.includes(t.name)}));
  return {schemaVersion:3,effects:EFFECT_TYPES.map(type=>({type,fields:[...EFFECT_COMMON_FIELDS.filter(k=>type!=='focus'||!['enter','enterSeconds'].includes(k)),...EFFECT_FIELDS[type]],...(PRODUCT_UI_FIELDS[type]?{uiFields:PRODUCT_UI_FIELDS[type]}:{})})),botActions:BOT_ACTIONS,transitions:TRANSITION_NAMES,cssTransitions:Object.keys(CARTOON_TRANSITIONS),glTransitions:GL_TRANSITIONS.map(t=>t.name),transitionDetails,transitionAliases:Object.entries(TRANSITION_ALIASES).map(([alias,preset])=>({alias,...preset})),defaultTransitionPool,automaticSelection:{policy:'explicit > scene relevance > seeded rotation',groups:SCENE_TRANSITION_GROUPS},presets:fs.readdirSync(presets).filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)),templates};
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=catalog();
  console.log(process.argv.includes('--json')?JSON.stringify(data,null,2):[
    `Effects (${data.effects.length}): ${data.effects.map(e=>e.type).join(', ')}`,
    `Transitions (${data.transitions.length}; ${data.cssTransitions.length} CSS + ${data.glTransitions.length} GL):`,
    `Automatic selection (${data.defaultTransitionPool.length}): explicit > scene relevance > seeded rotation; exhaust unused effects before repeating`,
    ...data.transitionDetails.map(t=>`  ${t.name} · ${t.label} · ${t.category} · ${t.seconds}s${t.inDefaultPool?' · default pool':''}`),
    `Compatibility aliases (not counted): ${data.transitionAliases.map(t=>t.alias+' → '+t.target).join(', ')}`,
    `Bot actions: ${data.botActions.join(', ')}`,
    `Presets: ${data.presets.join(', ')}`,
    ...data.templates.map(t=>`Template ${t.name}: ${t.seconds}s, ${t.sampleFrames} sample points, ${t.transitions.length} transitions, ${t.effects.join(', ')}`),
  ].join('\n'));
}
