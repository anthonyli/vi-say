// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useComic,INK,comicColor,comicPanel} from './surface';
export const GLASS={ink:'#15324b',muted:'#45627c',cyan:'#287fa3',coral:'#bc657b',purple:'#8670b9',lime:'#6e963d'};

export function BrightBackdrop({time=0,duration=1}) {
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 70% 35%,#fff 0%,#edf7ff 50%,#d9eaf8 100%)',overflow:'hidden'}}>
    <div style={{position:'absolute',width:1500,height:1500,border:'70px solid #ffffff85',borderRadius:'50%',left:690,top:-700,transform:'rotateX(45deg)',boxShadow:'0 25px 100px #abd9ec25,inset 0 0 65px #b0d7ff25'}}/>
    <div style={{position:'absolute',left:1000,top:150,width:850,height:650,background:'radial-gradient(ellipse,#b9a6fd40,transparent 70%)',filter:'blur(30px)'}}/>
    <div style={{position:'absolute',left:200,top:650,width:1550,height:800,transform:'perspective(1300px) rotateX(70deg)',backgroundImage:'linear-gradient(#497dad0b 1px,transparent 1px),linear-gradient(90deg,#497dad0b 1px,transparent 1px)',backgroundSize:'100px 100px'}}/>
    <div style={{position:'absolute',left:90,bottom:29,width:1740,height:2,background:'#497dad14'}}><div style={{width:`${Math.max(0,Math.min(1,time/duration))*100}%`,height:2,background:'linear-gradient(90deg,#4cabc8,#aa8be3)'}}/></div>
  </AbsoluteFill>;
}

export function GlassPlatform({position=[690,610],width=650,label='',color}) {
  if(useComic())return <div style={{position:'absolute',left:position[0],top:position[1],width,height:width*.3,zIndex:5}}>
    <div style={{position:'absolute',top:30,left:8,width:'100%',height:'62%',borderRadius:'50%',background:INK}}/>
    <div style={{position:'absolute',top:0,width:'100%',height:'62%',borderRadius:'50%',background:comicColor(color,3),border:`6px solid ${INK}`,boxSizing:'border-box'}}/>
    <div style={{position:'absolute',left:'10%',right:'10%',top:'16%',textAlign:'center',fontWeight:900,fontSize:Math.max(24,width*.055),color:INK}}>{label}</div>
  </div>;
  return <div style={{position:'absolute',left:position[0],top:position[1],width,height:width*.32,zIndex:5}}>
    <div style={{position:'absolute',top:38,width:'100%',height:'70%',borderRadius:'50%',background:'linear-gradient(180deg,#ffffffa8,#b4cfeb55)',border:'2px solid #fff',boxShadow:'0 35px 70px #537bb630,inset 0 4px 10px #ffffffcc'}}/>
    <div style={{position:'absolute',top:0,width:'100%',height:'70%',borderRadius:'50%',background:'radial-gradient(ellipse,#ffffffa8,#effbffa8 50%,#b9e5f780 70%,#fff9 74%,#b0cfe666 80%)',border:`2px solid ${color??'#fff'}`,boxShadow:`inset 0 0 35px #fff,0 -6px 35px ${color?color+'30':'#ffffffa0'}`}}/>
    <div style={{position:'absolute',left:'14%',right:'14%',top:'22%',textAlign:'center',fontWeight:850,fontSize:Math.max(22,width*.05),color:'#3f6283',letterSpacing:2}}>{label}</div>
  </div>;
}

export function GlassCard({position=[0,0],width=360,color=GLASS.cyan,title,label='',status='',detail,rows=[],opacity=1,scale=1,angle=0}) {
  if(useComic()){const accent=comicColor(color);return <div style={{position:'absolute',left:position[0],top:position[1],width,boxSizing:'border-box',overflow:'hidden',...comicPanel(),transform:`rotate(${angle}deg) scale(${scale})`,opacity,zIndex:12}}>
    <div style={{height:16,background:accent,borderBottom:`5px solid ${INK}`}}/>
    <div style={{padding:'18px 24px 22px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:21,fontWeight:800,color:INK,gap:12}}><span>{label}</span>{status&&<span style={{fontSize:19,fontWeight:900,background:accent,border:`3px solid ${INK}`,padding:'3px 12px',borderRadius:6}}>{status}</span>}</div>
      <div style={{fontSize:34,fontWeight:900,color:INK,marginTop:10,lineHeight:1.25,overflowWrap:'anywhere'}}>{title}</div>
      {detail&&<div style={{fontSize:24,fontWeight:650,lineHeight:1.4,color:INK,opacity:.82,marginTop:10}}>{detail}</div>}
      {rows.map((text,i)=><div key={i} style={{fontSize:25,fontWeight:700,color:INK,marginTop:12}}>{text}</div>)}
    </div>
  </div>;}
  return <div style={{position:'absolute',left:position[0],top:position[1],width,padding:'24px 28px',boxSizing:'border-box',borderRadius:24,border:`2px solid ${color}99`,background:'linear-gradient(135deg,#ffffffee,#ffffffaa 60%,#d6e7f7cc)',backdropFilter:'blur(18px)',boxShadow:'0 18px 50px #3c5f8a33,inset 0 1px #ffffff',transform:`rotate(${angle}deg) scale(${scale})`,opacity,zIndex:12}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:21,fontWeight:650,color:GLASS.muted,gap:12}}><span>{label}</span>{status&&<span style={{fontSize:18,fontWeight:750,color,background:color+'18',padding:'4px 12px',borderRadius:30}}>{status}</span>}</div>
    <div style={{fontSize:34,fontWeight:850,color:GLASS.ink,marginTop:14,lineHeight:1.28,overflowWrap:'anywhere'}}>{title}</div>
    {detail&&<div style={{fontSize:25,lineHeight:1.4,color:GLASS.muted,marginTop:14}}>{detail}</div>}
    {rows.map((text,i)=><div key={i} style={{fontSize:24,color:GLASS.ink,marginTop:16}}>{text}</div>)}
    <div style={{display:'flex',gap:7,marginTop:20}}>{[.8,.45,.65].map((v,i)=><div key={i} style={{height:4,flex:v,background:i===0?color+'aa':'#6d7d9755',borderRadius:6}}/>)}</div>
  </div>;
}

export function FlowLines({paths,color=GLASS.cyan,time=0,speed=145}) {
  if(useComic())return <svg width="1920" height="1080" style={{position:'absolute',inset:0,zIndex:6,pointerEvents:'none'}}>{paths.map((d,i)=><g key={i}>
    <path d={d} fill="none" stroke={INK} strokeWidth="14" strokeLinecap="round"/>
    <path d={d} fill="none" stroke={comicColor(color)} strokeWidth="7" strokeLinecap="round" strokeDasharray="26 18" strokeDashoffset={-time*speed*.6+i*20}/>
  </g>)}</svg>;
  return <svg width="1920" height="1080" style={{position:'absolute',inset:0,zIndex:6,pointerEvents:'none'}}>{paths.map((d,i)=><g key={i}>
    <path d={d} fill="none" stroke={color+'26'} strokeWidth="16"/><path d={d} fill="none" stroke={color+'aa'} strokeWidth="3"/>
    <path d={d} fill="none" stroke={color} strokeWidth="5" strokeDasharray="12 260" strokeDashoffset={-time*speed+i*50}/>
  </g>)}</svg>;
}

export function GlassTag({position=[0,0],text,color=GLASS.cyan}) {
  if(useComic())return <div style={{position:'absolute',left:position[0],top:position[1],display:'inline-flex',alignItems:'center',gap:12,border:`4px solid ${INK}`,color:INK,background:comicColor(color,3),borderRadius:8,padding:'8px 20px',fontSize:27,fontWeight:900,boxShadow:`5px 5px 0 ${INK}`}}>{text}</div>;
  return <div style={{position:'absolute',left:position[0],top:position[1],display:'inline-flex',alignItems:'center',gap:12,border:`1px solid ${color}60`,color,background:`${color}12`,borderRadius:50,padding:'10px 22px',fontSize:26,fontWeight:750}}><span style={{width:7,height:7,borderRadius:10,background:color}}/>{text}</div>;
}
