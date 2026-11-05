// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {clamp,lerp} from './motion.mjs';
// Preserve the source film's ease-out pacing, with every phase measured in seconds.
export const editorProgress=(t,at,seconds)=>1-(1-clamp((t-at)/seconds))**4;
export function editorState(e,t){
  const dropAt=e.dragAt+(e.dragSeconds??1.2),dropSeconds=e.dropSeconds??.4;
  return {drag:editorProgress(t,e.dragAt,e.dragSeconds??1.2),drop:editorProgress(t,dropAt,dropSeconds),test:editorProgress(t,e.testAt,e.testSeconds??1),metrics:e.metricsAt===undefined?0:editorProgress(t,e.metricsAt,.7),dropAt};
}
export function editorPose(e,t){
  const {drag,drop,test}=editorState(e,t),x=[505,850,1195][e.moving],y=265;
  const position=[lerp(e.from[0]*1600,x,drag),lerp(e.from[1]*740,y,drag)];
  return {position,scale:1+.06*Math.sin(drag*Math.PI),pointer:[position[0]+205,position[1]+65],click:drop*(1-drop),pointerOpacity:1-test,connected:drop>=.8};
}

export const PRODUCT_ICONS=Object.freeze(['shield','chart','user','scan','settings','bell','network','case','report','lock','bolt','check','play']);
