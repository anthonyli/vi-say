// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PRODUCT_UI_FIELDS} from './product-contract.mjs';
import {EFFECT_TYPES,EFFECT_FIELDS,EFFECT_COMMON_FIELDS,BOT_ACTIONS} from './contract.mjs';
import {CARTOON_TRANSITIONS} from '../cartoon-transitions.mjs';
import {validateCartoon,cartoonStillPoints} from '../cartoon-contract.mjs';

export function catalog(){
  const examples=new URL('../../production/examples/',import.meta.url),presets=new URL('../../production/presets/',import.meta.url);
  const templates=fs.readdirSync(examples).filter(n=>n.endsWith('.json')).map(file=>{
    const sample=JSON.parse(fs.readFileSync(new URL(file,examples),'utf8'));
    const doc={aspect:'16:9',fps:30,duration:sample.scenes.at(-1).end,character:'dragon.png',styleId:'colorful-dragon-v1',cartoonScenes:sample.scenes};
    validateCartoon(doc);
    return {name:file.slice(0,-5),seconds:doc.duration,effects:[...new Set(sample.scenes.flatMap(s=>(s.effects??[]).map(e=>e.type)))],sampleFrames:cartoonStillPoints(doc).length};
  });
  const demonstrated=new Set(templates.flatMap(t=>t.effects));
  for(const type of EFFECT_TYPES)if(!demonstrated.has(type))throw new Error(`Effect ${type} needs a runnable example before packaging`);
  return {schemaVersion:1,effects:EFFECT_TYPES.map(type=>({type,fields:[...EFFECT_COMMON_FIELDS.filter(k=>type!=='focus'||!['enter','enterSeconds'].includes(k)),...EFFECT_FIELDS[type]],...(PRODUCT_UI_FIELDS[type]?{uiFields:PRODUCT_UI_FIELDS[type]}:{})})),botActions:BOT_ACTIONS,transitions:Object.keys(CARTOON_TRANSITIONS),presets:fs.readdirSync(presets).filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)),templates};
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=catalog();
  console.log(process.argv.includes('--json')?JSON.stringify(data,null,2):[
    `Effects (${data.effects.length}): ${data.effects.map(e=>e.type).join(', ')}`,
    `Transitions (${data.transitions.length}): ${data.transitions.join(', ')}`,
    `Bot actions: ${data.botActions.join(', ')}`,
    `Presets: ${data.presets.join(', ')}`,
    ...data.templates.map(t=>`Template ${t.name}: ${t.seconds}s, ${t.sampleFrames} sample points, ${t.effects.join(', ')}`),
  ].join('\n'));
}
