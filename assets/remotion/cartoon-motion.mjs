// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import style from '../production/style.json' with {type:'json'};
import {BUSINESS_TRANSITIONS,CARTOON_TRANSITIONS, hasCartoonTransition, validateTransitionPool} from './cartoon-transitions.mjs';
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
  const kinds=[...validateTransitionPool(style.motion.transitionKinds)];let hash=2166136261;
  for(const c of seed)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  for(let i=kinds.length-1;i>0;i--){hash=(Math.imul(hash,1664525)+1013904223)>>>0;const j=hash%(i+1);[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
  return kinds[Math.max(0,index-1)%kinds.length];
}
export function transitionStyle(kind,progress) {
  if(!hasCartoonTransition(kind))throw new Error('Unknown cartoon transition '+kind);
  if(!Number.isFinite(progress))throw new Error('Transition progress must be finite');
  const p=ease(progress);
  if(p>=1)return {};
  return CARTOON_TRANSITIONS[kind](p);
}

/** Keep two complete text layers from being readable at the same time. */
export function sceneVisibility({index,frame,duration,transitionFrames,transition,nextTransition}) {
  const incoming=index>0&&Object.hasOwn(BUSINESS_TRANSITIONS,transition)
    ?ease((frame/transitionFrames-.45)/.55):1;
  const outgoing=frame>=duration&&Object.hasOwn(BUSINESS_TRANSITIONS,nextTransition)
    ?1-ease((frame-duration)/(transitionFrames*.45)):1;
  return incoming*outgoing;
}
