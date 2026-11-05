// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React,{useId} from 'react';
import {ProductShell,ProductIcon,PRODUCT as C,placed} from './product-shell';
import {editorState,editorPose} from '../../effects/node-editor.mjs';
const DEFAULT_TOOLS=[{icon:'settings',label:'Rule set'},{icon:'chart',label:'Scorecard'},{icon:'network',label:'Model'},{icon:'bolt',label:'Real-time signal'}];
function PolicyNode({position,title,detail,icon,tone,active,scale=1,floating=false}){
  return <div style={{...placed(...position,260,100),background:active?tone+'09':'#fff',border:`1.5px solid ${active?tone:'#DCE5DF'}`,borderRadius:12,padding:'17px 19px',boxShadow:floating?C.shadow:'0 9px 20px #214a2e08',transform:`scale(${scale})`,transformOrigin:'50% 50%'}}>
    <div style={{display:'flex',gap:10,alignItems:'center',color:active?tone:C.ink,fontSize:20,fontWeight:800}}><ProductIcon name={icon} size={23}/>{title}</div>
    <div style={{fontSize:16,color:C.muted,marginTop:10,lineHeight:1.25}}>{detail}</div>
  </div>;
}
export function NodeEditorEffect({effect:e,time:t}){
  const ui=e.ui??{},accent=e.color??C.green,state=editorState(e,t),pose=editorPose(e,t),id='grid-'+useId().replaceAll(':','');
  const {drag,drop,test,metrics}=state,colors=ui.nodeColors??[C.blue,C.purple,C.orange],icons=ui.nodeIcons??['bolt','settings','bell'];
  const details=ui.nodeDetails??['Input · Context · Time','Aggregate → Compare → Route','Send to the next step'];
  const [x,y,w,h]=e.box,s=Math.min(w/1600,h/740),bars=e.bars??[],maxBar=Math.max(1,...bars);
  return <div style={{...placed(x+(w-1600*s)/2,y+(h-740*s)/2,1600,740),transform:`scale(${s})`,transformOrigin:'0 0',fontWeight:500,lineHeight:1.2}}>
    <ProductShell ui={ui} accent={accent}>
      <div style={{...placed(225,70,230,670),background:'#fff',borderRight:`1px solid ${C.line}`,padding:22}}>
        <div style={{fontSize:21,fontWeight:800,marginBottom:24}}>{ui.paletteTitle??'Scenario tools'}</div>
        {(ui.tools??DEFAULT_TOOLS).map((tool,i)=><div key={i} style={{display:'flex',gap:13,padding:'16px 12px',border:`1px solid ${C.line}`,borderRadius:9,marginBottom:12,fontSize:18,color:C.ink}}><ProductIcon name={tool.icon} size={22} color={accent}/>{tool.label}</div>)}
      </div>
      <div style={placed(455,70,1145,520)}>
        <svg width="1145" height="520"><defs><pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#DCE5DF"/></pattern></defs><rect width="1145" height="520" fill={`url(#${id})`}/>
          <path d="M310 245H395M655 245H740" stroke={accent} strokeWidth="3" fill="none" strokeDasharray={pose.connected?undefined:'6 8'} strokeDashoffset={-t*20}/>
          <path d="M525 295v80H870V295" stroke="#A7BEB0" strokeWidth="2" fill="none"/>
        </svg>
        <div style={{...placed(705,25,390,55),display:'flex',alignItems:'center',gap:15}}><span style={{fontSize:18,color:C.muted}}>{ui.history??'Sample history'}</span><span style={{borderRadius:7,padding:'8px 13px',fontSize:19,fontWeight:700,background:accent,color:'#fff',display:'inline-flex',alignItems:'center',gap:8}}>{ui.runLabel??'Run back-test'}</span></div>
      </div>
      {e.nodes.map((title,i)=><PolicyNode key={i} position={i===e.moving?pose.position:[[505,265],[850,265],[1195,265]][i]} title={title} detail={details[i]} icon={icons[i]} tone={colors[i]} active={i===e.moving?drop>.5:i===2?drop>.6:true} scale={i===e.moving?pose.scale:1} floating={i===e.moving&&drop<.8}/>)}
      <div style={{...placed(...pose.pointer,50,65),opacity:pose.pointerOpacity,filter:'drop-shadow(0 5px 6px #0002)',transform:`scale(${1-.12*pose.click})`}}>
        <svg width="40" height="50" viewBox="0 0 40 50"><path d="M4 3v36l10-10 8 17 8-4-8-16 14-2Z" fill={C.ink} stroke="#fff" strokeWidth="3"/></svg>
        {drop>0&&drop<1&&<span style={{...placed(-15,-15,40,40),border:`2px solid ${accent}`,borderRadius:'50%',opacity:1-drop,transform:`scale(${1+2*drop})`}}/>}
      </div>
      <div style={{...placed(479,607,1094,107),background:'#fff',borderRadius:10,padding:'18px 23px',border:`1px solid ${C.line}`,opacity:test,transform:`translateY(${(1-test)*25}px)`}}>
        <div style={{display:'flex',alignItems:'center',gap:11,fontSize:21,fontWeight:800,color:accent}}><ProductIcon name="check"/>{e.result}</div>
        <div style={{fontSize:17,color:C.muted,marginTop:14,maxWidth:660}}>{ui.resultDetail??'Review the returned result before continuing'}</div>
        {bars.length>0&&<div style={{...placed(740,30,320,40),display:'flex',gap:5,alignItems:'end',justifyContent:'space-between'}}>{bars.map((v,i)=><div key={i} style={{flex:1,maxWidth:8,height:Math.max(1,v/maxBar*40)*test,background:i>bars.length*.75?accent:'#BCDCC8',borderRadius:2}}/>)}</div>}
      </div>
    </ProductShell>
    {e.metrics&&<div style={{...placed(170,430,1260,292),display:'flex',alignItems:'center',background:'#fff',borderRadius:18,boxShadow:'0 28px 80px #254e3329',opacity:metrics,transform:`translateY(${(1-metrics)*140}px) scale(${.92+.08*metrics})`,color:C.ink}}>
      {e.metrics.map((metric,i)=><div key={i} style={{flex:1,textAlign:'center',borderRight:i<e.metrics.length-1?`1px solid ${C.line}`:undefined}}>
        <div style={{fontSize:metric.value.length>5?65:78,fontWeight:800,letterSpacing:'-.04em'}}>{metric.value}<span style={{fontSize:31,color:metric.color??colors[i],marginLeft:8}}>{metric.unit}</span></div><div style={{fontSize:23,color:C.muted,marginTop:12}}>{metric.label}</div>
      </div>)}
    </div>}
  </div>;
}
