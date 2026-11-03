import React from 'react';
import {AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import style from '../../production/style.json';
import {characterPose, sideOf, transitionFor, transitionStyle, clamp} from '../cartoon-motion.mjs';
const C=style.palette,M=style.motion;
const ease=x=>1-(1-clamp(x))**3;
const tint=(color,a)=>`color-mix(in srgb, ${color} ${a}%, ${C.white})`;
const shadow=`0 12px 0 ${C.black}12, 0 28px 60px ${C.black}12`;
function Icon({name}) {
  const path=name==='comment'?'M5 5h22v16H14l-7 6v-6H5Z':name==='follow'?'M16 4v24M4 16h24':'M10 14l6-10c4 0 2 9 2 9h8l-3 15H10Zm-6 0h6v14H4Z';
  return <svg width="58" height="58" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"><path d={path}/></svg>;
}
function Scene({scene:s,preview}) {
  const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps;
  const hero=s.kind==='hero',demo=s.kind==='demo',right=sideOf(s)==='right';
  const contentLeft=hero?(right?90:960):(right?90:700);
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
    {demo&&<div style={{position:'absolute',left:contentLeft,top:405,width:1080,height:590,padding:16,boxSizing:'border-box',background:C.white,borderRadius:32,boxShadow:shadow,...enter(.25)}}>
      {s.video?<OffthreadVideo src={staticFile(s.video)} muted trimBefore={Math.round((s.videoStart??0)*fps)} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:20}}/>:<Img src={staticFile(s.image)} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:20}}/>}
    </div>}
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
    <div style={{position:'absolute',left:90,bottom:42,fontSize:21,color:`${C.black}99`}}>{preview?'无声视觉样片 · 未进行声音验收':s.kind==='cta'?'互动动画示意':s.kind==='demo'?'官方界面素材展示':'小龙带你看'}</div>
  </AbsoluteFill>;
}
function SceneLayer({scene,index,doc}) {
  const frame=useCurrentFrame(),{fps}=useVideoConfig();
  const transition=scene.transition??transitionFor(index,doc.transitionSeed??doc.cartoonScenes[0].title);
  const duration=Math.round(scene.end*fps)-Math.round(scene.start*fps);
  return <AbsoluteFill style={index?transitionStyle(transition,frame/(M.transition*fps)):{}}>
    <Freeze frame={Math.min(frame,duration-1)}><Scene scene={scene} preview={doc.visualPreview}/></Freeze>
  </AbsoluteFill>;
}
export function CartoonScenes({doc}) {
  const {fps}=useVideoConfig(),frame=useCurrentFrame();
  const p=spring({frame,fps,config:{damping:M.damping,stiffness:M.stiffness,mass:M.mass},durationInFrames:Math.round(M.enter*fps)});
  const {turn,...box}=characterPose(doc.cartoonScenes,frame/fps,M.enter);
  const openness=doc.speechMotion?.values[Math.min(frame,doc.speechMotion.values.length-1)]??1;
  // Mouth asset uses identical image coordinates. Only the mouth region crossfades;
  // the body and eyes never swap between differently generated full-body frames.
  const ratio=style.character.imageSize[0]/style.character.imageSize[1],iw=Math.min(box.width,box.height*ratio),ih=iw/ratio;
  const mask=style.character.mouthMask;
  const mouthMask=`radial-gradient(ellipse ${mask.radii[0]*100}% ${mask.radii[1]*100}% at ${mask.center[0]*100}% ${mask.center[1]*100}%, black ${mask.solid*100}%, transparent 100%)`;
  return <>
    {doc.cartoonScenes.map((s,i)=><Sequence key={i} from={Math.round(s.start*fps)} durationInFrames={Math.round(s.end*fps)-Math.round(s.start*fps)+(i<doc.cartoonScenes.length-1?Math.ceil(M.transition*fps):0)}><SceneLayer scene={s} index={i} doc={doc}/></Sequence>)}
    <div style={{position:'absolute',...box,transform:`translateY(${(1-p)*M.travel}px) rotate(${(1-p)*-7}deg) scale(${.92+.08*p})`,transformOrigin:'50% 90%',opacity:clamp(p),pointerEvents:'none'}}>
      <div style={{position:'absolute',bottom:15,left:'22%',width:'60%',height:34,borderRadius:'50%',background:`${C.black}22`,filter:'blur(14px)'}}/>
      <div style={{position:'absolute',left:(box.width-iw)/2,top:(box.height-ih)/2,width:iw,height:ih,transform:`perspective(1600px) rotateY(${turn}deg)`}}>
        <Img src={staticFile(doc.character)} style={{position:'absolute',width:'100%',height:'100%'}}/>
        {doc.characterClosed&&doc.speechMotion&&<Img src={staticFile(doc.characterClosed)} style={{position:'absolute',width:'100%',height:'100%',opacity:1-openness,maskImage:mouthMask,WebkitMaskImage:mouthMask}}/>}
      </div>
    </div>
    {doc.unreviewedAudio&&<div style={{position:'absolute',right:28,top:20,padding:'10px 18px',borderRadius:12,background:'#fff3cf',border:'2px solid #b65f00',color:'#713b00',fontSize:26,fontWeight:800,zIndex:100}}>未听审候选 · 声音未验收</div>}
  </>;
}
