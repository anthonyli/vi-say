// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Add implemented effects here. The default rotation pool lives in style.json.
// Each effect receives eased progress; timing and completion are owned by motion.
import {isGLTransition,GL_TRANSITIONS,validateGLParams} from './gl-transitions.mjs';
const percent=v=>Math.round(v*10000000)/100000;
export const CARTOON_TRANSITIONS = Object.freeze({
  converge:p=>({opacity:p,clipPath:`inset(${(1-p)*40}% ${(1-p)*35}% round ${24*(1-p)}px)`}),
  slide:(p,o={})=>({transform:`translateX(${(1-p)*(o.distance??1920)}px)`,
    ...(o.blur!==undefined?{filter:`blur(${(1-p)*o.blur}px)`}:{}),
    ...(o.reveal?{clipPath:`inset(0 0 0 ${(1-p)*100}%)`}:{})}),
  radial:(p,o={})=>({clipPath:`circle(${p*(o.radius??150)}% at ${percent((o.center??[.7,.55])[0])}% ${percent((o.center??[.7,.55])[1])}%)`}),
  wipe: p => ({clipPath: `inset(0 ${(1-p)*100}% 0 0)`}),
  flip:(p,o={})=>({transform:`perspective(${o.perspective??2400}px) rotateY(${(1-p)*(o.angle??90)}deg)`+
      (o.offsetY!==undefined?` translateY(${(1-p)*o.offsetY}px)`:'')+
      (o.scaleFrom!==undefined?` scale(${o.scaleFrom+(1-o.scaleFrom)*p})`:''),
    transformOrigin:o.origin?`${percent(o.origin[0])}% ${percent(o.origin[1])}%`:'left center',backfaceVisibility:'hidden',
    ...(o.blur!==undefined?{filter:`blur(${(1-p)*o.blur}px)`}:{}),...(o.fade?{opacity:p}:{})}),
});
// Old business labels are presets/aliases, not additional rendering engines.
export const TRANSITION_ALIASES=Object.freeze({
  iris:{target:'radial',params:{radius:125,center:[.5,.46]},sequentialText:true},
  handoff:{target:'slide',params:{distance:480,blur:4,reveal:true},sequentialText:true},
  evidence:{target:'flip',params:{angle:-4,scaleFrom:.96,blur:3,origin:[.5,.5],fade:true},sequentialText:true},
  report:{target:'flip',params:{angle:-8,perspective:2500,offsetY:160,origin:[.5,1],fade:true},sequentialText:true},
  focus:{target:'gl:CrossZoom',params:{strength:.12},sequentialText:true},
  zoom:{target:'gl:CrossZoom',params:{strength:.2},sequentialText:true},
  merge:{target:'gl:CrossZoom',params:{strength:.1},sequentialText:true},
});
export const CSS_TRANSITION_PARAMS=Object.freeze({
  converge:{},wipe:{},
  slide:{distance:[-1920,1920],blur:[0,40],reveal:'boolean'},
  radial:{radius:[1,200],center:'unit-vector'},
  flip:{angle:[-90,90],perspective:[100,10000],offsetY:[-1080,1080],scaleFrom:[.1,3],blur:[0,40],origin:'unit-vector',fade:'boolean'},
});
export const canonicalTransition=name=>TRANSITION_ALIASES[name]?.target??name;
export const hasCartoonTransition=name=>typeof name==='string'&&(Object.hasOwn(CARTOON_TRANSITIONS,canonicalTransition(name))||isGLTransition(canonicalTransition(name)));
export const TRANSITION_NAMES=Object.freeze([...Object.keys(CARTOON_TRANSITIONS),...GL_TRANSITIONS.map(t=>t.name)]);
export function resolveTransition(name,params={},aliasName){
  if(!hasCartoonTransition(name))throw new Error('Unknown cartoon transition '+name);
  if(!params||typeof params!=='object'||Array.isArray(params))throw new Error('transitionParams must be an object');
  const canonical=canonicalTransition(name),alias=Object.hasOwn(TRANSITION_ALIASES,name)?name:aliasName;
  if(alias!==undefined&&(!Object.hasOwn(TRANSITION_ALIASES,alias)||TRANSITION_ALIASES[alias].target!==canonical))throw new Error('transitionAlias does not match its canonical transition');
  const values={...Object.fromEntries(Object.entries(TRANSITION_ALIASES[alias]?.params??{}).map(([k,v])=>[k,Array.isArray(v)?[...v]:v])),...params};
  if(isGLTransition(canonical))validateGLParams(canonical,values);
  else for(const [key,value] of Object.entries(values)){
    if(!Object.hasOwn(CSS_TRANSITION_PARAMS[canonical],key))throw new Error(`Unknown ${canonical} parameter ${key}`);
    const spec=CSS_TRANSITION_PARAMS[canonical][key];
    if(spec==='boolean'){if(typeof value!=='boolean')throw new Error(`${key} must be boolean`);}
    else if(spec==='unit-vector'){if(!Array.isArray(value)||value.length!==2||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))throw new Error(`${key} needs two coordinates in 0..1`);}
    else if(typeof value!=='number'||!Number.isFinite(value)||value<spec[0]||value>spec[1])throw new Error(`${key} outside the CSS parameter range`);
  }
  return {name:canonical,params:values,...(alias?{alias}:{}),sequentialText:canonical==='converge'||Boolean(TRANSITION_ALIASES[alias]?.sequentialText)};
}
export const sequentialTransition=(name,alias)=>name!==undefined&&resolveTransition(name,{},Object.hasOwn(TRANSITION_ALIASES,alias)?alias:undefined).sequentialText;

export function validateTransitionPool(names) {
  if (!Array.isArray(names) || !names.length || new Set(names).size !== names.length ||
      names.some(name => !hasCartoonTransition(name))) {
    throw new Error('Cartoon transition pool must contain unique implemented effect names');
  }
  // Aliases cannot increase the weighting of an already selected effect.
  const seen=new Set();
  return names.filter(name=>{const key=canonicalTransition(name);if(seen.has(key))return false;seen.add(key);return true;});
}
