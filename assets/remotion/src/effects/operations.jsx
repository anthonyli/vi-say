// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React, {useId} from 'react';
import {Img,OffthreadVideo,staticFile,useVideoConfig} from 'remotion';
import {clamp,lerp,progress,flowState,routePoint,counterValue} from '../../effects/motion.mjs';
import {GLASS,GlassCard,FlowLines} from './glass';
const COLORS=[GLASS.cyan,GLASS.coral,GLASS.purple];

export function Connection({effect:e,time}) {
  const color=e.color??GLASS.purple,q=progress(time,e.at??0,e.seconds??1.5),unique=useId().replace(/[^a-z\d]/gi,''),id=`plug-${unique}`;
  return <div style={{position:'absolute',left:e.position[0],top:e.position[1],zIndex:11,transform:`scale(${e.scale??1})`,transformOrigin:'0 0'}}>
    <svg width="400" height="200" viewBox="0 0 400 200">
      <defs><linearGradient id={id}><stop stopColor="#f5eaff"/><stop offset=".5" stopColor="#9787bd"/><stop offset="1" stopColor="#504363"/></linearGradient></defs>
      <path d="M0 95h200" stroke={color} strokeWidth="20"/>
      <g transform={`translate(${140*q} 0)`}><rect x="55" y="46" width="104" height="97" rx="21" fill={`url(#${id})`} stroke="#fff9" strokeWidth="2"/><rect x="155" y="65" width="39" height="18" rx="6" fill="#d1d9f0"/><rect x="155" y="105" width="39" height="18" rx="6" fill="#d1d9f0"/><text x="76" y="107" fontSize="25" fill="#18263b" fontWeight="800">{e.label??''}</text></g>
      <rect x="341" y="37" width="45" height="119" rx="16" fill="#1e334b" stroke={q>.95?GLASS.lime:color} strokeWidth="3"/>
    </svg>
    <div style={{fontSize:25,color:q>.95?GLASS.lime:GLASS.muted,textAlign:'center',marginTop:8}}>{q>.95?(e.complete??'✓ 连接完成'):(e.waiting??'正在连接')}</div>
  </div>;
}

export function ResultFlow({effect:e,time}) {
  const {gather,summary,send}=flowState(e,time),[x,y,w,h]=e.box,cardWidth=Math.min(300,w/e.sources.length-30),center=x+w/2-cardWidth/2;
  const sourceX=i=>x+i*(w-cardWidth)/(e.sources.length-1),summaryWidth=Math.min(w,940);
  return <>
    <FlowLines time={time} color={e.color??GLASS.cyan} paths={e.sources.map((_,i)=>`M${sourceX(i)+cardWidth/2} ${y+240}Q${sourceX(i)+cardWidth/2} ${y-20} ${x+w/2} ${y+70}`)}/>
    {e.sources.map((card,i)=><GlassCard key={i} {...card} color={card.color??COLORS[i%3]} width={cardWidth} position={[lerp(sourceX(i),center,gather),lerp(y+140,y+20,gather)]} opacity={1-summary} scale={1-.18*gather}/>)}
    <div style={{position:'absolute',left:x+(w-summaryWidth)/2,top:y+10,width:summaryWidth,opacity:summary,zIndex:12,transform:`scale(${.94+.06*summary})`,background:'linear-gradient(135deg,#ffffffdd,#e0ecfa88)',backdropFilter:'blur(20px)',border:'1px solid #b8d1f877',borderRadius:25,padding:'25px 32px',boxShadow:'0 30px 70px #5c7ea525',boxSizing:'border-box'}}>
      <div style={{fontSize:27,fontWeight:800,color:GLASS.purple}}>{e.summary.title}</div>
      <div style={{display:'flex',gap:24,marginTop:24}}>{e.summary.sections.map((section,i)=><div key={i} style={{flex:1,minWidth:0,padding:24,borderRadius:16,background:(section.color??COLORS[i%3])+'15',border:'1px solid '+(section.color??COLORS[i%3])+'44'}}><div style={{color:section.color??COLORS[i%3],fontSize:20}}>{section.label}</div><div style={{fontSize:30,color:GLASS.ink,marginTop:12,lineHeight:1.35}}>{section.text}</div></div>)}</div>
    </div>
    {send>0&&e.targets.map((card,i)=>{
      const target=e.targets.length===1?x+(w-cardWidth)/2:x+i*(w-cardWidth)/(e.targets.length-1);
      return <GlassCard key={i} {...card} width={cardWidth} color={card.color??COLORS[i%3]} position={[lerp(center,target,send),lerp(y+220,y+h-160,send)]} opacity={send}/>;
    })}
  </>;
}

export function RoutePacket({effect:e,time}) {
  const point=routePoint(e.points,time,e.at??0,e.seconds??4,e.loop??false),color=e.color??GLASS.cyan;
  const paths=e.points.slice(1).map((b,i)=>{const a=e.points[i];return `M${a[0]} ${a[1]}Q${(a[0]+b[0])/2} ${Math.min(a[1],b[1])-120} ${b[0]} ${b[1]}`;});
  return <><FlowLines paths={paths} color={color} time={time}/>{e.points.map((p,i)=><div key={i} style={{position:'absolute',left:p[0]-80,top:p[1]+50,width:160,textAlign:'center',fontSize:25,color:GLASS.ink}}>{e.labels?.[i]??''}</div>)}<div style={{position:'absolute',left:point[0]-45,top:point[1]-30,width:90,height:60,background:'linear-gradient(135deg,#c8f9ff,#64b7e4)',border:'1px solid #fff',borderRadius:14,boxShadow:'0 0 45px #58e6fa66',zIndex:15,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:'#1a3243'}}>{e.label??''}</div></>;
}

export function MediaFrame({scene,time,box,glass=false}) {
  const {fps}=useVideoConfig(),focus=scene.effects?.find(e=>e.type==='focus'&&time>=(e.at??0)&&(e.endAt===undefined||time<e.endAt));
  const events=focus?.events??[],index=events.findLastIndex(e=>e.at<=time),current=events[index],previous=events[index-1];
  const q=current?progress(time,current.at,.35):0;
  const zoom=lerp(previous?.zoom??1,current?.zoom??1,q),pan=[0,1].map(i=>lerp(previous?.pan?.[i]??0,current?.pan?.[i]??0,q));
  const [x,y,w,h]=box,pad=16,iw=w-2*pad,ih=h-2*pad,[sw,sh]=scene.mediaSize??[iw,ih],fit=Math.min(iw/sw,ih/sh),mw=sw*fit,mh=sh*fit;
  const left=(iw-mw)/2+pan[0]-(zoom-1)*mw/2,top=(ih-mh)/2+pan[1]-(zoom-1)*mh/2;
  const color=current?.color??focus?.color??GLASS.cyan;
  let region;
  if(current){const before=previous?.region??current.region;region=current.region.map((v,i)=>lerp(before[i],v,q));}
  return <div style={{position:'absolute',left:x,top:y,width:w,height:h,padding:pad,boxSizing:'border-box',borderRadius:30,background:glass?'linear-gradient(145deg,#ffffffcc,#c6dfee88)':'#fff',border:'1px solid #bbc7eb88',boxShadow:'0 25px 70px #5b7eac30',zIndex:8}}>
    <div style={{position:'relative',width:'100%',height:'100%',overflow:'hidden',borderRadius:18,background:'#eff5fb'}}>
      <div style={{position:'absolute',left,top,width:mw*zoom,height:mh*zoom}}>
        {scene.video?<OffthreadVideo src={staticFile(scene.video)} muted trimBefore={Math.round((scene.videoStart??0)*fps)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Img src={staticFile(scene.image)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>}
      </div>
      {region&&<div style={{position:'absolute',left:left+region[0]*mw*zoom,top:top+region[1]*mh*zoom,width:region[2]*mw*zoom,height:region[3]*mh*zoom,border:`3px solid ${color}`,boxShadow:`0 0 25px ${color}55,inset 0 0 20px ${color}18`,borderRadius:12}}/>}
      {current?.label&&<div style={{position:'absolute',left:24,top:24,borderRadius:40,padding:'12px 24px',background:'#0d172bee',color:'#dff4ff',fontSize:24,border:`1px solid ${color}`}}>{current.label}</div>}
    </div>
  </div>;
}

export function Pointer({effect:e,time}) {
  let i=e.points.findLastIndex(p=>p.at<=time);if(i<0)return null;
  const a=e.points[i],b=e.points[i+1]??a,p=e.jump||a===b?0:progress(time,a.at,b.at-a.at),position=a.position.map((v,j)=>lerp(v,b.position[j],p));
  const click=a.click?clamp(1-(time-a.at)/.5):0;
  return <div style={{position:'absolute',left:position[0],top:position[1],zIndex:22,color:e.color??GLASS.cyan}}>{click>0&&<div style={{position:'absolute',left:-22,top:-22,width:65,height:65,border:'3px solid currentColor',borderRadius:'50%',opacity:click,transform:`scale(${1.7-click})`}}/>}<svg width="58" height="68" viewBox="0 0 58 68"><path d="M6 3L50 40L29 43L20 62Z" fill="currentColor" stroke="#fff" strokeWidth="3" strokeLinejoin="round"/></svg></div>;
}

export function Counter({effect:e,time}) {
  const [x,y,w,h]=e.box,value=counterValue(e,time);
  return <div style={{position:'absolute',left:x,top:y,width:w,height:h,padding:26,boxSizing:'border-box',borderRadius:24,background:'#ffffffaa',border:'1px solid #ffffff',zIndex:12}}><div style={{fontSize:48,fontWeight:850,color:e.color??GLASS.lime}}>{e.prefix??''}{value.toLocaleString('en-US',{maximumSignificantDigits:21})}{e.suffix??''}</div>{e.label&&<div style={{fontSize:22,color:GLASS.muted,marginTop:12}}>{e.label}</div>}</div>;
}

export function RevealList({effect:e,time}) {
  const [x,y,w]=e.box;
  return <div style={{position:'absolute',left:x,top:y,width:w,zIndex:12}}>{e.items.map((item,i)=>{const p=progress(time,item.at,.55),color=item.color??e.color??COLORS[i%3];return <div key={i} style={{opacity:.25+.75*p,transform:`translateX(${(1-p)*-20}px)`,padding:'20px 26px',border:`1px solid ${color}55`,background:`${color}0c`,borderRadius:20,marginBottom:16}}><div style={{color,fontSize:30,fontWeight:800}}>{p>.8?'✓ ':''}{item.text}</div>{item.detail&&<div style={{fontSize:21,color:GLASS.muted,marginTop:8}}>{item.detail}</div>}</div>;})}</div>;
}
