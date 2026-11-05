// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill} from 'remotion';
export const GLASS={ink:'#183a56',muted:'#5e7d98',cyan:'#287fa3',coral:'#bc657b',purple:'#8670b9',lime:'#6e963d'};

export function BrightBackdrop({time=0,duration=1}) {
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 70% 35%,#fff 0%,#edf7ff 50%,#d9eaf8 100%)',overflow:'hidden'}}>
    <div style={{position:'absolute',width:1500,height:1500,border:'70px solid #ffffff85',borderRadius:'50%',left:690,top:-700,transform:'rotateX(45deg)',boxShadow:'0 25px 100px #abd9ec25,inset 0 0 65px #b0d7ff25'}}/>
    <div style={{position:'absolute',left:1000,top:150,width:850,height:650,background:'radial-gradient(ellipse,#b9a6fd40,transparent 70%)',filter:'blur(30px)'}}/>
    <div style={{position:'absolute',left:200,top:650,width:1550,height:800,transform:'perspective(1300px) rotateX(70deg)',backgroundImage:'linear-gradient(#497dad0b 1px,transparent 1px),linear-gradient(90deg,#497dad0b 1px,transparent 1px)',backgroundSize:'100px 100px'}}/>
    <div style={{position:'absolute',left:90,bottom:29,width:1740,height:2,background:'#497dad14'}}><div style={{width:`${Math.max(0,Math.min(1,time/duration))*100}%`,height:2,background:'linear-gradient(90deg,#4cabc8,#aa8be3)'}}/></div>
  </AbsoluteFill>;
}

export function GlassPlatform({position=[690,610],width=650,label='',color}) {
  return <div style={{position:'absolute',left:position[0],top:position[1],width,height:width*.32,zIndex:5}}>
    <div style={{position:'absolute',top:38,width:'100%',height:'70%',borderRadius:'50%',background:'linear-gradient(180deg,#ffffffa8,#b4cfeb55)',border:'2px solid #fff',boxShadow:'0 35px 70px #537bb630,inset 0 4px 10px #ffffffcc'}}/>
    <div style={{position:'absolute',top:0,width:'100%',height:'70%',borderRadius:'50%',background:'radial-gradient(ellipse,#ffffffa8,#effbffa8 50%,#b9e5f780 70%,#fff9 74%,#b0cfe666 80%)',border:`2px solid ${color??'#fff'}`,boxShadow:`inset 0 0 35px #fff,0 -6px 35px ${color?color+'30':'#ffffffa0'}`}}/>
    <div style={{position:'absolute',left:'18%',right:'18%',top:'48%',textAlign:'center',fontWeight:800,fontSize:width*.048,color:'#6689a6',letterSpacing:3,transform:'scaleY(.7)'}}>{label}</div>
  </div>;
}

export function GlassCard({position=[0,0],width=360,color=GLASS.cyan,title,label='',status='',detail,rows=[],opacity=1,scale=1,angle=0}) {
  return <div style={{position:'absolute',left:position[0],top:position[1],width,padding:'24px 28px',boxSizing:'border-box',borderRadius:24,border:`1px solid ${color}65`,background:'linear-gradient(135deg,#ffffffc9,#ffffff55 60%,#bdd8ef66)',backdropFilter:'blur(18px)',boxShadow:'0 18px 60px #6187ac25,inset 0 1px #ffffff',transform:`rotate(${angle}deg) scale(${scale})`,opacity,zIndex:12}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:18,color:GLASS.muted,gap:12}}><span>{label}</span>{status&&<span style={{fontSize:16,color,background:color+'18',padding:'4px 12px',borderRadius:30}}>{status}</span>}</div>
    <div style={{fontSize:30,fontWeight:800,color:GLASS.ink,marginTop:16,lineHeight:1.3,overflowWrap:'anywhere'}}>{title}</div>
    {detail&&<div style={{fontSize:23,lineHeight:1.4,color:GLASS.muted,marginTop:14}}>{detail}</div>}
    {rows.map((text,i)=><div key={i} style={{fontSize:24,color:GLASS.ink,marginTop:16}}>{text}</div>)}
    <div style={{display:'flex',gap:7,marginTop:20}}>{[.8,.45,.65].map((v,i)=><div key={i} style={{height:4,flex:v,background:i===0?color+'aa':'#6d7d9755',borderRadius:6}}/>)}</div>
  </div>;
}

export function FlowLines({paths,color=GLASS.cyan,time=0,speed=145}) {
  return <svg width="1920" height="1080" style={{position:'absolute',inset:0,zIndex:6,pointerEvents:'none'}}>{paths.map((d,i)=><g key={i}>
    <path d={d} fill="none" stroke={color+'20'} strokeWidth="14"/><path d={d} fill="none" stroke={color+'70'} strokeWidth="2"/>
    <path d={d} fill="none" stroke={color} strokeWidth="4" strokeDasharray="12 260" strokeDashoffset={-time*speed+i*50}/>
  </g>)}</svg>;
}

export function GlassTag({position=[0,0],text,color=GLASS.cyan}) {
  return <div style={{position:'absolute',left:position[0],top:position[1],display:'inline-flex',alignItems:'center',gap:12,border:`1px solid ${color}60`,color,background:`${color}12`,borderRadius:50,padding:'10px 20px',fontSize:23}}><span style={{width:7,height:7,borderRadius:10,background:color}}/>{text}</div>;
}
