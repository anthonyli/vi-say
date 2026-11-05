// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill} from 'remotion';
import {StudioBackdrop} from './business';
import {progress} from '../../effects/motion.mjs';
import {GLASS,BrightBackdrop,GlassCard} from './glass';
import {MediaFrame,RevealList} from './operations';

export function GlassScene({scene:s,doc,time}) {
  const right=(s.characterSide??(s.kind==='hero'?'right':'left'))==='right';
  const left=s.kind==='stage'||s.mediaBox?90:right?90:700,hero=s.kind==='hero',p=progress(time,.08,.65);
  if(doc.modules?.background==='studio')return <AbsoluteFill style={{color:'#172A26'}}>
    <StudioBackdrop time={s.start+time}/>
    <div style={{position:'absolute',left:98,top:71,fontSize:51,fontWeight:800,letterSpacing:'-.035em',opacity:p,transform:`translateY(${18*(1-p)}px)`}}>{s.title}</div>
    {s.subtitle&&<div style={{position:'absolute',left:100,top:143,fontSize:25,fontWeight:500,color:'#6C7974',opacity:p}}>{s.subtitle}</div>}
    <div style={{position:'absolute',right:100,top:82,fontSize:24,fontWeight:800,color:'#172A26'}}>{doc.series??''}</div>
    <div style={{position:'absolute',left:100,top:1005,fontSize:17,fontWeight:500,color:'#6C7974'}}>Illustrative interface · Sample data</div>
    {s.kind==='demo'&&<MediaFrame scene={s} time={time} box={s.mediaBox??[100,215,1720,748]}/>}
    {s.kind==='steps'&&s.items.map((item,i)=><div key={i} style={{opacity:progress(time,item.at,.65)}}><GlassCard position={[160+i*520,400]} width={470} title={item.text} detail={item.detail} label={`0${i+1}`}/></div>)}
    {s.kind==='cta'&&<RevealList effect={{box:[160,320,1100,600],items:s.items}} time={time}/>}
  </AbsoluteFill>;
  return <AbsoluteFill style={{color:GLASS.ink}}>
    {doc.modules?.background==='studio'?<StudioBackdrop time={s.start+time}/>:<BrightBackdrop time={s.start+time} duration={doc.duration}/>}
    <div style={{position:'absolute',left:85,top:45,fontSize:28,fontWeight:800,color:GLASS.ink}}>{doc.series??'小龙带你看'}</div>
    <div style={{position:'absolute',right:90,top:48,fontSize:19,color:GLASS.muted}}>{s.label??''}</div>
    <div style={{position:'absolute',left,top:hero?180:125,width:hero?850:Math.min(1500,1830-left),opacity:p,transform:`translateY(${24*(1-p)}px)`,zIndex:20}}>
      <div style={{fontSize:hero?98:72,lineHeight:1.18,fontWeight:900,letterSpacing:-2,whiteSpace:'pre-line'}}>{s.title}</div>
      {s.subtitle&&<div style={{marginTop:20,fontSize:29,lineHeight:1.4,color:GLASS.muted}}>{s.subtitle}</div>}
    </div>
    {s.kind==='demo'&&<MediaFrame scene={s} time={time} box={s.mediaBox??[left,380,1080,540]} glass/>}
    {s.kind==='steps'&&s.items.map((item,i)=>{
      const q=progress(time,item.at,.65),color=[GLASS.cyan,GLASS.purple,GLASS.lime][i];
      return <div key={i} style={{opacity:q,transform:`translateY(${(1-q)*36}px)`}}><GlassCard position={[left+i*365,470]} width={330} color={color} label={`0${i+1}`} title={item.text} detail={item.detail}/></div>;
    })}
    {s.kind==='cta'&&<RevealList effect={{box:[left,390,Math.min(700,1800-left),500],items:s.items}} time={time}/>}
    <div style={{position:'absolute',left:90,bottom:42,fontSize:18,color:'#66839c',zIndex:30}}>{s.kind==='demo'?(s.sourceLabel??'界面素材展示'):'动画流程示意'}</div>
  </AbsoluteFill>;
}
