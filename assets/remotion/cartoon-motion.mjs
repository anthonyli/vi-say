import style from '../production/style.json' with {type:'json'};
import {CARTOON_TRANSITIONS, hasCartoonTransition, validateTransitionPool} from './cartoon-transitions.mjs';
export const clamp = x => Math.max(0, Math.min(1,x));
export const ease = x => {const p=clamp(x);return p*p*p*(10+p*(-15+6*p));};
export const sideOf = scene => scene.characterSide ?? (scene.kind==='hero'?'right':'left');
export function characterPose(scenes, time, enterSeconds=.65) {
  const box = s => s.kind==='hero'
    ? {left:sideOf(s)==='right'?1010:80,top:115,width:780,height:810,turn:sideOf(s)==='right'?180:0}
    : {left:sideOf(s)==='right'?1275:75,top:295,width:570,height:650,turn:sideOf(s)==='right'?180:0};
  let index=scenes.findIndex(s=>time>=s.start&&time<s.end);
  if(index<0)index=time>=scenes.at(-1).end?scenes.length-1:0;
  const current=scenes[index],target=box(current),previous=index?box(scenes[index-1]):target;
  const p=clamp((time-current.start)/enterSeconds),q=ease(p);
  const pose=Object.fromEntries(Object.keys(target).map(key=>[key,previous[key]+(target[key]-previous[key])*q]));
  if(target.left!==previous.left)pose.top+=Math.sin(Math.PI*p)*120;
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
