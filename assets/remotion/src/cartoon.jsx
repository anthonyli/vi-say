// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill, Freeze, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import style from '../../production/style.json';
import {DragonMouth} from './dragon-mouth';
import {StudioBackdrop} from './effects/business';
import {BrightBackdrop} from './effects/glass';
import {GlassScene} from './effects/glass-scene';
import {SceneEffects,BotActors} from './effects/layer';
import {MediaFrame} from './effects/operations';
import GLScenePair from './gl-transition';
import {isGLTransition} from '../gl-transitions.mjs';
import {sceneVisibility,characterPose, sideOf, sceneTransition, sceneTransitionSettings, transitionSeconds, transitionStyle, clamp, closedMouthOpacity} from '../cartoon-motion.mjs';
const C=style.palette,M=style.motion;
const ease=x=>1-(1-clamp(x))**3;
const tint=(color,a)=>`color-mix(in srgb, ${color} ${a}%, ${C.white})`;
const shadow=`0 12px 0 ${C.black}12, 0 28px 60px ${C.black}12`;
function Icon({name}) {
  const path=name==='comment'?'M5 5h22v16H14l-7 6v-6H5Z':name==='follow'?'M16 4v24M4 16h24':'M10 14l6-10c4 0 2 9 2 9h8l-3 15H10Zm-6 0h6v14H4Z';
  return <svg width="58" height="58" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"><path d={path}/></svg>;
}
function Scene({scene:s}) {
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps;
  const hero=s.kind==='hero',demo=s.kind==='demo',right=sideOf(s)==='right';
  const contentLeft=s.kind==='stage'?90:hero?(right?90:960):(right?90:700);
  const enter=(at=0,distance=32)=>{const p=ease((t-at)/M.enter);return {opacity:p,transform:p===1?'none':`translateY(${(1-p)*distance}px)`};};
  return <AbsoluteFill style={{background:C.white,color:C.black}}>
    <div style={{position:'absolute',right:-100,top:-230,width:1040,height:1040,borderRadius:'50%',background:tint(C.blue,12)}}/>
    <div style={{position:'absolute',left:-170,bottom:-300,width:800,height:590,borderRadius:'50%',background:tint(C.yellow,25),transform:'rotate(-18deg)'}}/>
    <div style={{position:'absolute',right:110,bottom:60,width:150,height:150,border:`32px solid ${C.green}`,borderRadius:'50%'}}/>
    <div style={{position:'absolute',left:85,top:62,padding:'14px 26px',borderRadius:100,background:C.black,color:C.white,fontSize:24,fontWeight:750,letterSpacing:2}}>{s.label||'小龙带你看'}<span style={{color:C.yellow,marginLeft:22}}>✦</span></div>
    <div style={{position:'absolute',left:contentLeft,top:hero?245:205,width:hero?900:1080,...enter(.08)}}>
      <div style={{fontSize:hero?108:76,lineHeight:1.16,fontWeight:900,letterSpacing:-3,whiteSpace:'pre-line',overflowWrap:'anywhere',maxWidth:hero?850:1080}}>{s.title}</div>
      {s.subtitle&&<div style={{fontSize:hero?36:30,lineHeight:1.45,marginTop:28,color:`${C.black}B3`,maxWidth:1000}}>{s.subtitle}</div>}
      {hero&&<div style={{marginTop:48,display:'inline-block',background:C.blue,color:C.black,borderRadius:24,padding:'20px 32px',boxShadow:shadow,fontSize:30,fontWeight:800}}>跟着小龙，一起搞懂 ↗</div>}
    </div>
    {demo&&<MediaFrame scene={s} time={t} box={s.mediaBox??[contentLeft,405,1080,590]}/>}
    {s.items?.map((item,i)=>{
      const q=ease((t-item.at)/M.emphasis),p=ease((t-item.at)/M.enter),active=t>=item.at+M.enter;
      const colors=[C.blue,C.green,C.yellow];
      return <div key={i} style={{position:'absolute',left:contentLeft+i*370,top:510,width:334,height:300,boxSizing:'border-box',padding:30,background:tint(colors[i],20),borderTop:`8px solid ${colors[i]}`,borderRadius:36,boxShadow:shadow,opacity:p,transform:p===1&&q===1?'none':`translateY(${(1-p)*36-8*Math.sin(Math.PI*q)}px)`}}>
        <div style={{fontSize:58,fontWeight:900,color:C.black,lineHeight:1.2}}>{s.kind==='cta'?<Icon name={item.icon||({留言:'comment',关注:'follow',点赞:'like'}[item.text])}/>: `0${i+1}`}</div>
        <div style={{fontSize:40,fontWeight:850,marginTop:26,lineHeight:1.2}}>{item.text}</div>
        {item.detail&&<div style={{fontSize:25,marginTop:16,lineHeight:1.35,overflowWrap:'anywhere'}}>{item.detail}</div>}
        {s.kind==='cta'&&active&&<span style={{position:'absolute',right:26,top:30,fontSize:32}}>✓</span>}
      </div>;
    })}
    <div style={{position:'absolute',left:90,bottom:42,fontSize:21,color:`${C.black}99`}}>{s.kind==='cta'?'互动动画示意':s.kind==='demo'?'官方界面素材展示':'小龙带你看'}</div>
  </AbsoluteFill>;
}
function SceneContent({scene,doc}) {
  const frame=useCurrentFrame(),{fps}=useVideoConfig();
  const duration=Math.round(scene.end*fps)-Math.round(scene.start*fps);
  const time=Math.min(frame,duration-1)/fps;
  return <Freeze frame={Math.min(frame,duration-1)}>{['glass','studio'].includes(doc.modules?.background)?<GlassScene scene={scene} doc={doc} time={time}/>:<Scene scene={scene}/>}<SceneEffects scene={scene} time={time}/></Freeze>;
}
function SceneLayer({scene,index,doc}) {
  const frame=useCurrentFrame(),{fps}=useVideoConfig();
  const settings=sceneTransitionSettings(scene,index,doc),transition=settings.name,seconds=transitionSeconds(scene,transition,settings.alias);
  const duration=Math.round(scene.end*fps)-Math.round(scene.start*fps);
  const next=doc.cartoonScenes[index+1],nextTransition=next?sceneTransition(next,index+1,doc):undefined;
  const outgoingSeconds=next?transitionSeconds(next,nextTransition):seconds;
  const gl=index>0&&isGLTransition(transition);
  const entrance=index&&!gl?transitionStyle(transition,frame/(seconds*fps),settings.params):{};
  const visibility=sceneVisibility({index,frame,duration,transitionFrames:seconds*fps,outgoingTransitionFrames:outgoingSeconds*fps,transition,nextTransition,transitionAlias:settings.alias,nextTransitionAlias:next?.transitionAlias??next?.transition});
  // Media and effect z-indices must stay inside their own scene. Without a
  // stacking context, the outgoing screenshot can cover the incoming shader
  // or transformed scene until the transition has already finished.
  return <AbsoluteFill style={{isolation:'isolate',zIndex:0,...entrance,opacity:(entrance.opacity??1)*visibility}}>
    {gl?<GLScenePair name={transition} params={settings.params} frames={Math.max(1,Math.round(seconds*fps))}
      before={<Freeze frame={Math.round(doc.cartoonScenes[index-1].end*fps)-Math.round(doc.cartoonScenes[index-1].start*fps)-1}><SceneContent scene={doc.cartoonScenes[index-1]} doc={doc}/></Freeze>}
      after={<SceneContent scene={scene} doc={doc}/>}/>:<SceneContent scene={scene} doc={doc}/>}
  </AbsoluteFill>;
}
export function CartoonScenes({doc}) {
  const {fps}=useVideoConfig(),frame=useCurrentFrame();
  const p=spring({frame,fps,config:{damping:M.damping,stiffness:M.stiffness,mass:M.mass},durationInFrames:Math.round(M.enter*fps)});
  const characterSettings=doc.modules?.character??{};
  const {turn,rotation=0,...box}=characterPose(doc.cartoonScenes,frame/fps,characterSettings.travelSeconds??M.enter,characterSettings);
  const tilt=rotation+Math.sin(frame/fps*1.3)*(characterSettings.tilt??0);
  const energy=doc.speechMotion?.values[frame]??0;
  const fallbackCue=energy<=.12?'X':energy<.28?'B':energy<.6?'C':'D';
  const mouthCues=doc.mouthCues??[{start:0,end:doc.duration,value:fallbackCue}];
  const closedOpacity=closedMouthOpacity(doc.speechMotion?.values,frame);
  // Replace the whole mouth opaquely; crossfades expose two lips at once.
  // The feather stays outside both lip silhouettes; body and eyes never swap.
  const ratio=style.character.imageSize[0]/style.character.imageSize[1],iw=Math.min(box.width,box.height*ratio),ih=iw/ratio;
  const mask=style.character.mouthMask;
  const mouthMask=`radial-gradient(ellipse ${mask.radii[0]*100}% ${mask.radii[1]*100}% at ${mask.center[0]*100}% ${mask.center[1]*100}%, black ${mask.solid*100}%, transparent 100%)`;
  return <>
    {doc.modules?.background==='studio'?<StudioBackdrop time={frame/fps}/>:doc.modules?.background==='glass'?<BrightBackdrop time={frame/fps} duration={doc.duration}/>:<AbsoluteFill style={{background:C.white}}/>}
    {doc.cartoonScenes.map((s,i)=>{const next=doc.cartoonScenes[i+1];return <Sequence key={i} from={Math.round(s.start*fps)} durationInFrames={Math.round(s.end*fps)-Math.round(s.start*fps)+(next?Math.ceil(transitionSeconds(next,sceneTransition(next,i+1,doc))*fps):0)}><SceneLayer scene={s} index={i} doc={doc}/></Sequence>;})}
    {characterSettings.mode!=='none'&&<div style={{position:'absolute',...box,transform:`translateY(${(1-p)*M.travel}px) rotate(${(1-p)*-7+tilt}deg) scale(${.92+.08*p})`,transformOrigin:'50% 90%',opacity:clamp(p),pointerEvents:'none'}}>
      <div style={{position:'absolute',bottom:15,left:'22%',width:'60%',height:34,borderRadius:'50%',background:`${C.black}22`,filter:'blur(14px)'}}/>
      <div style={{position:'absolute',left:(box.width-iw)/2,top:(box.height-ih)/2,width:iw,height:ih,transform:`perspective(1600px) rotateY(${turn}deg)`}}>
        {characterSettings.mode==='rounded'?<DragonMouth x={0} y={0} w={iw} time={frame/fps} cues={mouthCues} closedFile={doc.characterClosed} neutralFile={doc.characterNeutral}/>:<>        <Img src={staticFile(doc.character)} style={{position:'absolute',width:'100%',height:'100%'}}/>
        {doc.characterClosed&&doc.speechMotion&&<Img src={staticFile(doc.characterClosed)} style={{position:'absolute',width:'100%',height:'100%',opacity:closedOpacity,maskImage:mouthMask,WebkitMaskImage:mouthMask}}/>}</>}
      </div>
    </div>}
    <BotActors scenes={doc.cartoonScenes} time={frame/fps}/>
    {doc.reviewBadgeVisible===true&&<div style={{position:'absolute',right:28,top:20,padding:'10px 18px',borderRadius:12,background:'#fff3cf',border:'2px solid #b65f00',color:'#713b00',fontSize:26,fontWeight:800,zIndex:100}}>未听审候选 · 声音未验收</div>}
  </>;
}
