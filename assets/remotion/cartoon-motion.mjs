// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import style from '../production/style.json' with {type:'json'};
import {CARTOON_TRANSITIONS,resolveTransition,sequentialTransition,TRANSITION_ALIASES} from './cartoon-transitions.mjs';
import {isGLTransition,glTransitionPreset} from './gl-transitions.mjs';
import {shuffledTransitionPool,selectSceneTransitions} from './transition-selection.mjs';
export const clamp = x => Math.max(0, Math.min(1,x));
// Opaque replacement keeps one mouth visible. Hysteresis avoids rapid swaps
// around the energy threshold; it is deterministic for out-of-order renders.
export function closedMouthOpacity(values, frame) {
  if (!values?.length) return 0;
  for (let i=Math.min(Math.max(0,Math.floor(frame)),values.length-1); i>=0; i--) {
    if (values[i]>=.28) return 0;
    if (values[i]<=.12) return 1;
  }
  return 1;
}
export const ease = x => {const p=clamp(x);return p*p*p*(10+p*(-15+6*p));};
export const sideOf = scene => scene.characterSide ?? (scene.kind==='hero'?'right':'left');
export function characterPose(scenes, time, enterSeconds=.65,options={}) {
  const box = s => s.characterPose?{turn:0,rotation:0,...s.characterPose}:s.kind==='hero'
    ? {left:sideOf(s)==='right'?1010:80,top:115,width:780,height:810,turn:sideOf(s)==='right'?180:0,rotation:0}
    : {left:sideOf(s)==='right'?1275:75,top:295,width:570,height:650,turn:sideOf(s)==='right'?180:0,rotation:0};
  let index=scenes.findIndex(s=>time>=s.start&&time<s.end);
  if(index<0)index=time>=scenes.at(-1).end?scenes.length-1:0;
  const current=scenes[index],target=box(current),previous=index?box(scenes[index-1]):target;
  const p=clamp((time-current.start)/enterSeconds),q=ease(p);
  const pose=Object.fromEntries(Object.keys(target).map(key=>[key,(previous[key]??0)+(target[key]-(previous[key]??0))*q]));
  if(target.left!==previous.left||target.top!==previous.top)pose.top+=Math.sin(Math.PI*p)*(options.arc??120);
  if(options.arc!==undefined)pose.top=Math.max(0,Math.min(1080-pose.height,pose.top));
  return pose;
}
// A shuffled cycle gives variety while every render worker sees identical choices.
export function transitionFor(index, seed='dragon-series') {
  const kinds=shuffledTransitionPool(seed,style.motion.transitionKinds);
  return kinds[Math.max(0,index-1)%kinds.length];
}
const settingsFor=(scene,choice)=>({...resolveTransition(choice.name,scene.transitionParams,scene.transitionAlias),
  ...(choice.selection?{selection:choice.selection}:{})});
export const sceneTransitionSettings=(scene,index,doc)=>settingsFor(scene,scene.transition!==undefined
  ?{name:scene.transition,selection:scene.transitionSelection}
  :selectSceneTransitions(doc,style.motion.transitionKinds)[index]);
export const sceneTransition=(scene,index,doc)=>sceneTransitionSettings(scene,index,doc).name;
export const transitionSeconds=(scene,kind,alias=scene.transitionAlias??(Object.hasOwn(TRANSITION_ALIASES,scene.transition)?scene.transition:undefined))=>scene.transitionSeconds??(alias?style.motion.transition:glTransitionPreset(kind)?.seconds??style.motion.transition);
export function resolveCartoonTransitions(doc){
  if(!doc.cartoonScenes)return doc;
  const choices=selectSceneTransitions(doc,style.motion.transitionKinds);
  return {...doc,cartoonScenes:doc.cartoonScenes.map((s,i)=>{
    if(!i)return {...s};const settings=settingsFor(s,choices[i]);
    return {...s,transition:settings.name,...(Object.keys(settings.params).length?{transitionParams:settings.params}:{}),...(settings.alias?{transitionAlias:settings.alias}:{}),...(settings.selection?{transitionSelection:settings.selection}:{})};
  })};
}
export function transitionPlan(doc){
  return (doc.cartoonScenes??[]).slice(1).map((s,i)=>{
    const settings=sceneTransitionSettings(s,i+1,doc),kind=settings.name,seconds=transitionSeconds(s,kind,settings.alias),frame=Math.round(s.start*doc.fps),frames=Math.round(seconds*doc.fps);
    return {sceneIndex:i+1,kind,...(settings.alias?{alias:settings.alias}:{}),...(settings.selection?{selection:settings.selection}:{}),engine:isGLTransition(kind)?'gl':'css',seconds,frames,startFrame:frame,endFrame:frame+frames};
  });
}
export function transitionStyle(kind,progress,params) {
  const settings=resolveTransition(kind,params);
  if(!Object.hasOwn(CARTOON_TRANSITIONS,settings.name))throw new Error('GL transitions require the scene compositor');
  if(!Number.isFinite(progress))throw new Error('Transition progress must be finite');
  const p=ease(progress);
  if(p>=1)return {};
  return CARTOON_TRANSITIONS[settings.name](p,settings.params);
}

/** Keep two complete text layers from being readable at the same time. */
export function sceneVisibility({index,frame,duration,transitionFrames,outgoingTransitionFrames=transitionFrames,transition,nextTransition,transitionAlias,nextTransitionAlias}) {
  const incoming=index>0&&sequentialTransition(transition,transitionAlias)
    ?ease((frame/transitionFrames-.45)/.55):1;
  const outgoing=frame>=duration&&sequentialTransition(nextTransition,nextTransitionAlias)
    ?1-ease((frame-duration)/(outgoingTransitionFrames*.45)):1;
  return incoming*outgoing;
}
