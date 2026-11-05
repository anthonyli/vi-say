// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill} from 'remotion';
import {progress,pop,trackPose,actorPose,actionAt} from '../../effects/motion.mjs';
import {EFFECT_TYPES} from '../../effects/contract.mjs';
import {BUSINESS_RENDERERS} from './business';
import {PlayfulBot} from './bot';
import {GLASS,GlassPlatform,GlassCard,FlowLines,GlassTag} from './glass';
import {Connection,ResultFlow,RoutePacket,Pointer,Counter,RevealList} from './operations';

const COMPONENTS={
  ...BUSINESS_RENDERERS,
  platform:(e,t)=><GlassPlatform {...e}/>,
  paths:(e,t)=><FlowLines {...e} time={t}/>,
  tag:(e,t)=><GlassTag {...e}/>,
  connection:(e,t)=><Connection effect={e} time={t}/>,
  flow:(e,t)=><ResultFlow effect={e} time={t}/>,
  route:(e,t)=><RoutePacket effect={e} time={t}/>,
  pointer:(e,t)=><Pointer effect={e} time={t}/>,
  counter:(e,t)=><Counter effect={e} time={t}/>,
  list:(e,t)=><RevealList effect={e} time={t}/>,
  card:(e,t)=>{
    const pose=trackPose(e,t),change=e.changes?.findLast(c=>c.at<=t);
    return <GlassCard {...e} position={pose.position} angle={pose.angle} scale={pose.size/160} status={change?.status??e.status}/>;
  },
  text:(e,t)=><div style={{position:'absolute',left:e.position[0],top:e.position[1],fontSize:e.fontSize??64,fontWeight:e.weight??850,lineHeight:1.2,color:e.color??GLASS.ink,whiteSpace:'pre-line',zIndex:12}}>{e.text}</div>,
};

// Fail at bundle startup when an extension is declared without an implementation.
for(const type of EFFECT_TYPES)if(!['bot','focus'].includes(type)&&!COMPONENTS[type])throw new Error(`Missing effect renderer: ${type}`);
for(const type of Object.keys(COMPONENTS))if(!EFFECT_TYPES.includes(type))throw new Error(`Unvalidated effect renderer: ${type}`);

export function SceneEffects({scene,time}) {
  return <>{(scene.effects??[]).filter(e=>!['bot','focus'].includes(e.type)).map((e,i)=>{
    if(time<(e.at??0)||(e.endAt!==undefined&&time>=e.endAt))return null;
    const render=COMPONENTS[e.type];if(!render)throw new Error(`No renderer for effect ${e.type}`);
    const p=e.enter==='none'?1:progress(time,e.at??0,e.enterSeconds??.65),scale=e.enter==='pop'?pop(time,e.at??0,e.enterSeconds??.7):1;
    const origin=e.position??e.box?.slice(0,2)??[960,540];
    return <AbsoluteFill key={e.id??i} style={{opacity:p,transform:`translateY(${e.enter==='rise'?(1-p)*32:0}px) scale(${scale})`,transformOrigin:`${origin[0]}px ${origin[1]}px`,pointerEvents:'none'}}>{render(e,time)}</AbsoluteFill>;
  })}</>;
}

/** One persistent actor layer prevents duplicated bots at scene transitions. */
export function BotActors({scenes,time}) {
  let index=scenes.findIndex(s=>time>=s.start&&time<s.end);if(index<0)index=scenes.length-1;
  const scene=scenes[index],local=time-scene.start,previous=scenes[index-1];
  return <>{(scene.effects??[]).filter(e=>e.type==='bot').map(e=>{
    if(local<(e.at??0)||(e.endAt!==undefined&&local>=e.endAt))return null;
    const before=previous?.effects?.find(p=>p.type==='bot'&&p.id===e.id);
    const previousPose=before?trackPose(before,Math.min(previous.end-previous.start,before.endAt??Infinity)):undefined;
    const pose=actorPose(e,previousPose,local),action=actionAt(e,local);
    const p=before||e.enter==='none'?1:progress(local,e.at??0,e.enterSeconds??.65);
    const entry=before||['none','fade','rise'].includes(e.enter)?1:Math.max(0,pop(local,e.at??0,e.enterSeconds??.7));
    return <div key={e.id} style={{position:'absolute',inset:0,opacity:p,transform:`translateY(${e.enter==='rise'?(1-p)*32:0}px) scale(${entry})`,transformOrigin:`${pose.position[0]}px ${pose.position[1]}px`,pointerEvents:'none',zIndex:24}}>
      <PlayfulBot variant={e.variant} color={e.color} position={pose.position} size={pose.size} angle={pose.angle} compression={pose.compression} time={action.time} phase={e.phase??0} action={action.name} label={action.hideLabel?undefined:e.label}/>
    </div>;
  })}</>;
}
