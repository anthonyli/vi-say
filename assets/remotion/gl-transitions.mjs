// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import catalog from './gl-transitions.json' with {type:'json'};

export const GL_TRANSITIONS=Object.freeze(catalog.transitions);
const byName=new Map(GL_TRANSITIONS.map(t=>[t.name,t]));
export const isGLTransition=name=>typeof name==='string'&&byName.has(name);
export const glTransitionPreset=name=>byName.get(name);
export function validateGLParams(name,params={}){
  const preset=byName.get(name);
  if(!preset)throw new Error(`Unknown GL transition ${name}`);
  if(!params||typeof params!=='object'||Array.isArray(params))throw new Error('transitionParams must be an object');
  for(const [key,value] of Object.entries(params)){
    const spec=preset.params[key];
    if(!spec)throw new Error(`Unknown ${name} parameter ${key}`);
    const match=/^(i?vec)([234])$/.exec(spec.type);
    const values=match?value:[value];
    if(match&&(!Array.isArray(value)||value.length!==Number(match[2])))throw new Error(`${key} requires ${spec.type}`);
    for(const n of values){
      if(spec.type==='bool'){if(typeof n!=='boolean')throw new Error(`${key} must be boolean`);continue;}
      if(typeof n!=='number'||!Number.isFinite(n)||((spec.type==='int'||spec.type.startsWith('ivec'))&&!Number.isInteger(n)))throw new Error(`${key} requires finite ${spec.type}`);
      if((spec.min!==undefined&&n<spec.min)||(spec.max!==undefined&&n>spec.max))throw new Error(`${key} outside the upstream parameter range`);
    }
    if(['size','squaresMin'].includes(key)&&Array.isArray(value)&&value.some(n=>n<1))throw new Error(`${key} requires positive grid dimensions`);
    if(key==='direction'&&Array.isArray(value)&&value.every(n=>n===0))throw new Error('direction cannot be zero');
  }
  return params;
}
export function glOptions(name,params){
  validateGLParams(name,params);
  const p=byName.get(name);
  return {name:p.shader,params:{...Object.fromEntries(Object.entries(p.params).map(([k,v])=>[k,v.default])),...params}};
}
