// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React,{useId} from 'react';
import {ProductShell,ProductIcon,PRODUCT as C,placed} from './product-shell';
import {progress,lerp,clamp} from '../../effects/motion.mjs';
import {businessState,networkBox} from '../../effects/business.mjs';
const colors=[C.blue,C.green,C.orange,'#F7B035'];
export function FitProduct({box,width=1600,height=740,children}){const [x,y,w,h]=box,s=Math.min(w/width,h/height);return <div style={{...placed(x+(w-width*s)/2,y+(h-height*s)/2,width,height),transform:`scale(${s})`,transformOrigin:'0 0',color:C.ink,fontWeight:500,lineHeight:1.2}}>{children}</div>;}
function Panel({box,children,style={}}){return <div style={{...placed(...box),background:'#fff',borderRadius:16,boxShadow:C.shadow,overflow:'hidden',...style}}>{children}</div>;}
function Card({box,title,children,style={}}){return <div style={{...placed(...box),background:'#fff',border:`1px solid ${C.line}`,borderRadius:12,padding:22,...style}}>{title&&<div style={{fontSize:20,fontWeight:800,marginBottom:18}}>{title}</div>}{children}</div>;}
function Pill({children,color=C.green}){return <span style={{borderRadius:7,padding:'8px 13px',fontSize:16,fontWeight:700,background:color+'10',color,display:'inline-flex',alignItems:'center',gap:8}}>{children}</span>;}
function ChartPlot({values,reveal,color=C.green,width=770,height=170,labels}){
 const id=useId().replaceAll(':',''),max=Math.max(1,...values),bottom=height-30,points=values.map((v,i)=>[10+i*(width-30)/(values.length-1),bottom-15-v/max*(height-65)]),path=points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ');
 return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><defs><linearGradient id={id+'fill'} x1="0" x2="0" y1="0" y2="1"><stop stopColor={color} stopOpacity=".18"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient><clipPath id={id}><rect width={width*reveal} height={height}/></clipPath></defs>
 {[.1,.35,.6,.85].map(q=><path key={q} d={`M0 ${q*bottom}H${width}`} stroke="#ECF0EE"/>)}<g clipPath={`url(#${id})`}><path d={`${path}L${points.at(-1)[0]} ${bottom}H10Z`} fill={`url(#${id}fill)`}/><path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round"/>{values.length<=12&&points.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="4" fill={color}/><text x={x} y={y-12} textAnchor="middle" fontSize="16" fontWeight="700" fill={C.ink}>{values[i]}</text></g>)}</g>
 {labels?.map((s,i)=><text key={i} x={points[i][0]} y={height-6} fontSize="15" textAnchor="middle" fill={C.muted}>{s}</text>)}</svg>;
}
function Dashboard({ui={},values=[0,0],title='Connected activity',time=0,seconds=2,sources=['Inputs','Tasks','Results']}){
 const stats=ui.stats??sources.slice(0,3).map(label=>({label,value:'—'})),columns=ui.columns??['Source','Status','Next action'],rows=ui.rows??sources.slice(0,3).map(s=>[s,'Ready','Review']);
 return <ProductShell ui={ui}><div style={placed(225,70,1375,670)}>
  <div style={{...placed(30,24,1308,40),fontSize:26,fontWeight:800}}>{title}</div>
  {stats.map((s,i)=><Card key={i} box={[30+i*(1308/stats.length+6),78,1308/stats.length-14,116]}><div style={{fontSize:15,color:C.muted,display:'flex',justifyContent:'space-between'}}>{s.label}<ProductIcon name={['scan','bell','report'][i]} size={21} color={s.color??colors[i]}/></div><div style={{fontSize:34,fontWeight:800,marginTop:8}}>{s.value}</div></Card>)}
  <Card box={[30,216,854,252]} title={title}><ChartPlot values={values} reveal={progress(time,0,seconds)}/></Card>
  <Card box={[904,216,434,252]} title={ui.detail??'Shared context'}><div style={{display:'flex',gap:18,alignItems:'center',marginTop:24}}><span style={{padding:17,background:'#EAF8EF',borderRadius:12,color:C.green}}><ProductIcon name="user" size={37}/></span><div style={{fontSize:21,fontWeight:800}}>{sources[0]}<div style={{fontSize:16,color:C.muted,fontWeight:500,marginTop:8}}>{sources.slice(1).join(' · ')}</div></div></div><div style={{height:1,background:C.line,margin:'24px 0 15px'}}/><div style={{fontSize:17,color:C.green,display:'flex',gap:9}}><ProductIcon name="check" size={20}/>{ui.footer??'Keep the original context'}</div></Card>
  <Card box={[30,490,1308,150]} title={ui.title??'Activity queue'}><div style={{display:'grid',gridTemplateColumns:`repeat(${columns.length},1fr)`,fontSize:16,color:C.muted,paddingBottom:15,borderBottom:`1px solid ${C.line}`}}>{columns.map((s,i)=><span key={i}>{s}</span>)}</div><div style={{display:'grid',gridTemplateColumns:`repeat(${columns.length},1fr)`,fontSize:17,paddingTop:15}}>{rows[0]?.map((s,i)=><span key={i}>{s}</span>)}</div></Card>
 </div></ProductShell>;
}
export function PanelMergeEffect({effect:e,time:t}){
 if(e.variant==='profile')return <ProfileMerge effect={e} time={t}/>;
 const {merge:p}=businessState(e,t),ui=e.ui??{},xy=[[100,65],[940,65],[100,395],[940,395]];
 return <FitProduct box={e.box}><div style={{position:'absolute',inset:0,opacity:p,transform:`perspective(2200px) rotateX(${(1-p)*9}deg) rotateY(${(1-p)*-8}deg) scale(${.78+.22*p})`,transformOrigin:'50% 65%'}}><Dashboard ui={ui} title={e.title} sources={e.sources} time={t} values={ui.trend??[0,0]}/></div>
  <svg width="1600" height="740" style={{position:'absolute',opacity:1-p}}><path d="M540 200C670 120 750 330 940 180M540 525C680 440 780 630 940 510M310 245V395M1150 245V395" fill="none" stroke="#99BAA6" strokeWidth="3" strokeDasharray="8 12" strokeDashoffset={-t*35}/></svg>
  {e.sources.map((s,i)=><Panel key={i} box={[lerp(xy[i][0],650,p),lerp(xy[i][1],300,p),445,180]} style={{opacity:1-p,transform:`rotate(${(i%2?3:-3)*(1-p)}deg) scale(${1-.25*p})`}}><div style={{display:'flex',gap:12,padding:'24px 23px',borderBottom:`1px solid ${C.line}`,fontSize:22,fontWeight:800,alignItems:'center'}}><ProductIcon name={['scan','bell','case','report'][i]} color={colors[i]}/>{s}</div><div style={{margin:'20px 24px',fontSize:17,color:C.muted}}>{e.detail??'Independent workspace'}</div><div style={{height:7,width:260,background:colors[i]+'28',margin:'0 24px',borderRadius:6}}/></Panel>)}
 </FitProduct>;
}
export function ChartEffect({effect:e,time:t}){return <FitProduct box={e.box}><Dashboard ui={e.ui} values={e.values} title={e.title} time={t-(e.at??0)} seconds={e.seconds??2} sources={e.labels??['Input','Process','Output']}/><Panel box={[310,320,1170,350]} style={{transform:`translateY(${(1-progress(t,(e.at??0)+.25,.7))*100}px)`,opacity:progress(t,(e.at??0)+.25,.7)}}><div style={{padding:'22px 30px',fontSize:24,fontWeight:800,borderBottom:`1px solid ${C.line}`}}>{e.title}</div><div style={{padding:'20px 40px'}}><ChartPlot values={e.values} labels={e.labels} reveal={progress(t,e.at??0,e.seconds??2)} color={e.color??C.green} width={1090} height={235}/></div></Panel></FitProduct>;}
export function ScanEffect({effect:e,time:t}){
 const ui=e.ui??{},focus=progress(t,e.at??0,.65),hit=progress(t,e.scanAt,e.seconds??1.5),cols=ui.columns??['Entry','Method','Category','Review'],result=ui.resultRow??[e.rows[0],'Match','Record',e.result],steps=ui.steps??['Collect','Search','Review','Link'];
 return <FitProduct box={e.box}><div style={{position:'absolute',inset:0,opacity:1-focus*.74,filter:`blur(${focus*2}px)`,transform:`scale(${1-focus*.035})`}}><Dashboard sources={e.rows} title={ui.title??'Search records'} time={t}/></div>
  <Panel box={[lerp(200,105,focus),4,1390,588]} style={{opacity:focus,transform:`translateY(${(1-focus)*80}px)`}}>
    <div style={{padding:'25px 32px',borderBottom:`1px solid ${C.line}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:27,fontWeight:800}}>{ui.title??'Search records'}</div><Pill>{e.rows.length} sources</Pill></div>
    <div style={{padding:32}}><div style={{fontSize:36,fontWeight:800}}>{ui.subtitle??'Keep every related record'}</div><div style={{fontSize:28,marginTop:16,color:C.green,fontWeight:750}}>{ui.methods??e.rows.join(' · ')}</div>
      <div style={{display:'flex',gap:14,marginTop:29}}><div style={{flex:1,border:`1px solid ${C.line}`,borderRadius:10,padding:19,display:'flex',gap:15,alignItems:'center',fontSize:25}}><ProductIcon name="scan" color={C.muted}/>{e.query}</div><div style={{background:C.green,color:'#fff',fontSize:23,fontWeight:800,padding:'19px 34px',borderRadius:10}}>{ui.action??'Search records'}</div></div>
      <div style={{marginTop:25,display:'grid',gridTemplateColumns:`repeat(${cols.length},1fr)`,padding:'15px 18px',fontSize:18,color:C.muted,background:C.surface,borderRadius:8}}>{cols.map((s,i)=><span key={i}>{s}</span>)}</div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${cols.length},1fr)`,padding:'19px 18px',fontSize:22,opacity:hit,transform:`translateY(${(1-hit)*20}px)`}}>{result.map((s,i)=><span key={i} style={{fontWeight:i===0||i===cols.length-1?800:500,color:i===cols.length-1?C.green:C.ink}}>{s}</span>)}</div>
      <div style={{display:'flex',gap:10,alignItems:'center',fontSize:19,color:C.muted,marginTop:8}}><ProductIcon name="network" size={20} color={C.green}/>{ui.footer??e.result}</div>
    </div>
  </Panel>
  <Panel box={[-60,646,1720,110]} style={{display:'flex'}}>{steps.map((s,i)=><div key={i} style={{flex:1,display:'flex',alignItems:'center',gap:10,padding:'20px 17px',background:t>(e.at??0)+i*.19?colors[i%4]+'16':'#fff',borderRight:`1px solid ${C.line}`,fontSize:19,fontWeight:800}}><ProductIcon name={['scan','bell','network','case','report','check'][i]} color={colors[i%4]} size={27}/>{s}</div>)}</Panel>
 </FitProduct>;
}
function NetworkGraph({e,t}){
 const id=useId().replaceAll(':',''),N=Object.fromEntries(e.nodes.map(n=>[n.id,n]));
 const xy=n=>[n.position[0]*1440,n.position[1]*690];
 return <svg width="1440" height="690" viewBox="0 0 1440 690"><defs><radialGradient id={id}><stop stopColor={C.green} stopOpacity=".1"/><stop offset="1" stopColor={C.green} stopOpacity="0"/></radialGradient></defs>
 {e.nodes.filter(n=>n.main).map(n=><circle key={n.id} cx={xy(n)[0]} cy={xy(n)[1]} r="210" fill={`url(#${id})`}/>)}
 {e.edges.map((edge,i)=>{const [x,y]=xy(N[edge.from]),[xx,yy]=xy(N[edge.to]),p=progress(t,edge.at,e.seconds??.8),color=edge.color??N[edge.to].color??C.blue,q=(Math.max(0,t-edge.at)*.42+i*.17)%1;
 return <g key={i} opacity={p}><path d={`M${x} ${y}L${xx} ${yy}`} stroke="#DCE7E0" strokeWidth="2"/><path d={`M${x} ${y}L${xx} ${yy}`} stroke={color} strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1-p}/>{p>.8&&<circle cx={lerp(x,xx,q)} cy={lerp(y,yy,q)} r="4" fill={C.green}/>}</g>;})}
 {e.nodes.map((n,i)=>{const [x,y]=xy(n),p=progress(t,n.at,.55),r=n.main?47:33,c=n.color??colors[i%4],size=n.main?36:26;return <g key={n.id} opacity={p} transform={`translate(${x},${y}) scale(${.6+.4*p})`}>
  {n.badge&&<circle r="52" fill={c+'1C'}/>}<circle r={r} fill="#fff"/><circle r={r} fill={n.main?c:c+'16'} stroke={c} strokeWidth={n.main?0:2}/>
  <foreignObject x={-size/2} y={-size/2} width={size} height={size}><div style={{display:'flex',color:n.main?'#fff':c}}><ProductIcon name={n.icon??'user'} size={size}/></div></foreignObject>
  <rect x="-89" y={r+11} width="178" height="29" rx="7" fill="#fff"/><text y={r+32} textAnchor="middle" fontSize="17" fontWeight={n.main||n.badge?800:600} fill={n.badge?c:'#434343'}>{n.label}</text>
  {n.badge&&<><rect x="-78" y="-85" width="156" height="31" rx="6" fill={c}/><text y="-64" textAnchor="middle" fontSize="15" fontWeight="800" fill="#433014">{n.badge}</text></>}
 </g>;})}</svg>;
}
export function NetworkEffect({effect:e,time:t}){
 const box=networkBox(e,t),ui=e.ui??{},shrink=clamp((e.box[2]-box[2])/Math.max(1,e.box[2]-(e.boxFrames?.at(-1)?.box[2]??e.box[2]))),insights=ui.insights??[],legend=ui.legend??[];
 return <FitProduct box={box} width={1720} height={748}>
  <Panel box={[0,0,1720,748]} style={{opacity:1-shrink}}><div style={{...placed(0,0,1720,60),borderBottom:`1px solid ${C.line}`,display:'flex',alignItems:'center',padding:'0 28px',gap:12,fontSize:20,fontWeight:800}}><ProductIcon name="network" color={C.green}/>{ui.title??'Relationship graph'}<div style={{marginLeft:'auto',display:'flex',gap:19,fontSize:17,fontWeight:500,color:C.muted}}>{legend.map((s,i)=><span key={i} style={{display:'flex',gap:7,alignItems:'center'}}><span style={{width:9,height:9,borderRadius:'50%',background:s.color??colors[i]}}/>{s.label}</span>)}</div></div>
  <div style={{...placed(30,86,250,450),display:'flex',flexDirection:'column',gap:15}}>{insights.map((s,i)=>{const p=progress(t,(e.at??0)+.5+i*.65,.45),c=s.color??colors[i];return <div key={i} style={{padding:'14px 16px',borderRadius:10,border:`1px solid ${c}66`,background:c+'0B',opacity:p,transform:`translateX(${(1-p)*-40}px)`}}><div style={{fontSize:21,fontWeight:800,display:'flex',alignItems:'center',gap:9}}><span style={{width:8,height:8,background:c,borderRadius:'50%',flexShrink:0}}/>{s.title}</div><div style={{fontSize:16,color:C.muted,marginTop:8}}>{s.detail}</div></div>;})}</div></Panel>
  <div style={{...placed(lerp(300,104,shrink),lerp(65,10,shrink),1440,690),transform:`scale(${lerp(.92,1.05,shrink)})`,transformOrigin:'0 0'}}><NetworkGraph e={e} t={t}/></div>
 </FitProduct>;
}
export function DocumentEffect({effect:e,time:t}){
 if(e.variant==='case')return <CaseEffect effect={e} time={t}/>;
 const ui=e.ui??{},state=businessState(e,t),{gather,write,review,report}=state,accent=e.color??C.green,roles=ui.roles??[{icon:'user',label:'Prepared by',value:'Operator'},{icon:'shield',label:'Reviewed by',value:'Reviewer'},{icon:'lock',label:'Access',value:'Assigned roles'}];
 return <FitProduct box={e.box} width={1720} height={742}><Panel box={[0,0,1720,742]}>
  <div style={{...placed(0,0,1720,63),display:'flex',alignItems:'center',padding:'0 28px',gap:12,borderBottom:`1px solid ${C.line}`,fontSize:23,fontWeight:800}}><ProductIcon name="report" color={accent}/>{ui.title??'Evidence and reporting'}<span style={{marginLeft:'auto'}}><Pill color={accent}>{ui.attachmentLabel??'Source-linked record'}</Pill></span></div>
  <div style={placed(30,92,600,440)}><div style={{fontSize:27,fontWeight:800,marginBottom:24}}>{ui.sourceLabel??'The complete evidence chain'}</div>
    {e.sources.map((s,i)=><div key={i} style={{position:'relative',height:88,display:'flex',alignItems:'flex-start',gap:19,opacity:progress(t,(e.at??0)+i*.22,.55)}}><div style={{color:accent,padding:10,borderRadius:8,background:accent+'10',zIndex:2}}><ProductIcon name={['scan','bell','case','report'][i]} size={23}/></div>{i<e.sources.length-1&&<div style={{...placed(22,46,2,44),background:'#B6DCC5'}}/>}<div><div style={{fontSize:22,fontWeight:800}}>{s}</div><div style={{fontSize:17,color:C.muted,marginTop:10}}>{ui.sourceDetails?.[i]??'Preserve the source and its context'}</div></div></div>)}
  </div>
  <div style={{...placed(31,548,584,158),padding:'24px 30px',borderRadius:12,background:accent+'10',display:'flex',gap:25,alignItems:'center'}}><ProductIcon name="lock" size={51} color={accent}/><div><div style={{fontSize:36,fontWeight:800}}>{ui.recordValue??'Source linked'}</div><div style={{fontSize:22,color:accent,marginTop:10}}>{ui.recordLabel??'Preserve context with each decision'}</div></div></div>
  <div style={{...placed(660,91,1027,616),background:C.surface,borderRadius:12,padding:25}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:21,fontWeight:800}}>{ui.detail??'Generate from the same source'}<Pill color={accent}>{e.reportTitle??'Prepare summary'}</Pill></div>
    <div style={{...placed(35,90,610,496),padding:'25px 32px',background:'#fff',boxShadow:'0 14px 25px #234b3010',borderRadius:7,transform:`scale(${1+.025*Math.sin(report*Math.PI)})`}}>
      <div style={{fontSize:26,fontWeight:800}}>{report<.5?e.title:e.reportTitle}</div><div style={{fontSize:16,color:C.muted,marginTop:10}}>{ui.attachmentLabel??'Evidence and recorded decisions'}</div><div style={{height:2,background:accent,margin:'24px 0'}}/>
      <div style={{clipPath:`inset(0 ${100*(1-write)}% 0 0)`}}>{e.rows.map((r,i)=><div key={i} style={{marginBottom:e.rows.length>4?15:23}}><div style={{fontSize:14,color:C.muted,marginBottom:7}}>{r.label}</div><div style={{fontSize:19,fontWeight:650}}>{r.text}</div></div>)}</div>
      <div style={{borderTop:`1px solid ${C.line}`,paddingTop:14,color:accent,fontSize:17,display:'flex',gap:10,opacity:review}}><ProductIcon name="check" size={20}/>{ui.footer??e.reviewLabel}</div>
    </div>
    <div style={{...placed(675,104,310,420),padding:22,background:'#fff',borderRadius:10,opacity:review,transform:`translateX(${(1-review)*60}px)`}}><div style={{fontSize:22,fontWeight:800}}>{ui.reviewTitle??'Review and approval'}</div>{roles.map((r,i)=><div key={i} style={{padding:'22px 0',borderBottom:i<roles.length-1?`1px solid ${C.line}`:undefined,display:'flex',gap:12}}><ProductIcon name={r.icon} color={accent}/><div><div style={{fontSize:17,color:C.muted}}>{r.label}</div><div style={{fontSize:20,fontWeight:800,marginTop:7}}>{r.value}</div></div></div>)}</div>
  </div>
  {gather>0&&gather<1&&e.sources.map((s,i)=><div key={i} style={{...placed(lerp(90,750,gather),lerp(150+i*88,250+i*36,gather),320,50),background:'#fff',border:`1px solid ${accent}55`,boxShadow:C.shadow,borderRadius:8,padding:14,fontSize:18,opacity:Math.sin(Math.PI*gather)}}>{s}</div>)}
 </Panel></FitProduct>;
}

function CaseEffect({effect:e,time:t}){
 const ui=e.ui??{},{write,review}=businessState(e,t),accent=e.color??C.purple;
 return <FitProduct box={e.box} width={1720} height={738}>
  <Panel box={[0,0,375,738]}><div style={{...placed(25,30,325,365),background:'linear-gradient(145deg,#E9F7EF,#D9EBF7)',borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{padding:48,background:'#fff',borderRadius:24,boxShadow:C.shadow,color:C.green}}><ProductIcon name="user" size={100}/></div></div><div style={{padding:'430px 30px 30px',fontSize:27,fontWeight:800}}>{ui.recordValue??'Shared subject'}<div style={{fontSize:20,fontWeight:500,lineHeight:1.6,color:C.muted,marginTop:24}}>{ui.recordLabel??'Keep the same object and the same supporting context'}</div><div style={{marginTop:30}}><Pill>{ui.reviewTitle??'Operator in control'}</Pill></div></div></Panel>
  <Panel box={[405,0,1315,738]}><div style={{...placed(0,0,1315,61),display:'flex',alignItems:'center',padding:'0 25px',borderBottom:`1px solid ${C.line}`,gap:13,fontSize:23,fontWeight:800}}><ProductIcon name="case" color={accent}/>{ui.title??'Investigation workspace'}<span style={{marginLeft:'auto'}}><Pill color={accent}>{ui.attachmentLabel??'Prepared from evidence'}</Pill></span></div>
    <div style={{...placed(22,84,360,627),background:C.surface,borderRadius:12,overflow:'hidden'}}><div style={{...placed(18,280,324,329),padding:'25px 18px',background:'#fff',borderRadius:10}}><div style={{fontSize:22,fontWeight:800,marginBottom:24}}>{ui.sourceLabel??'Evidence collected'}</div>{e.sources.map((s,i)=><div key={i} style={{display:'flex',gap:11,fontSize:19,lineHeight:1.45,marginTop:24,opacity:progress(t,(e.at??0)+.2+i*.3,.55)}}><span style={{color:C.green,flexShrink:0}}><ProductIcon name="check" size={20}/></span>{s}</div>)}</div></div>
    <div style={{...placed(408,84,884,419),padding:25,border:`1px solid ${C.line}`,borderRadius:12}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:26,fontWeight:800}}>{e.title}<Pill color={accent}>{ui.detail??'Draft for review'}</Pill></div><div style={{fontSize:20,color:C.muted,marginTop:18}}>{ui.recordValue??'Shared subject'}</div><div style={{marginTop:25,paddingTop:24,borderTop:`1px solid ${C.line}`,clipPath:`inset(0 ${100*(1-write)}% 0 0)`}}>{e.rows.map((r,i)=><div key={i} style={{fontSize:22,lineHeight:1.65}}>{r.text}</div>)}</div><div style={{display:'flex',gap:9,marginTop:24,opacity:write}}>{e.sources.map((s,i)=><Pill key={i} color={C.muted}>{s}</Pill>)}</div></div>
    <div style={{...placed(408,527,884,184),display:'flex',alignItems:'center',padding:'0 25px',background:'#EAF8EF',borderRadius:12}}><ProductIcon name="shield" size={64} color={accent}/><div style={{paddingLeft:25,marginLeft:25,borderLeft:'1px solid #BDDCC9',fontSize:21,fontWeight:800,lineHeight:1.6,maxWidth:420}}>{ui.footer??'Prepare from source material. Keep the final decision with the reviewer.'}</div><div style={{marginLeft:'auto',background:C.green,color:'#fff',padding:'18px 20px',borderRadius:10,fontSize:20,fontWeight:800,display:'flex',gap:9,opacity:review,transform:`translateY(${(1-review)*20}px)`}}><ProductIcon name="check"/>{e.reviewLabel}</div></div>
  </Panel>
 </FitProduct>;
}

function ProfileMerge({effect:e,time:t}){
 const {merge:p}=businessState(e,t),ui=e.ui??{},tags=ui.tags??e.sources,followups=ui.followups??['Shared context','Coordinated action'];
 return <FitProduct box={e.box} width={1660} height={660}>
 {e.sources.map((s,i)=><Panel key={i} box={[lerp(i===0?140:1080,560,p),lerp(180,70,p),470,290]} style={{opacity:1-p,transform:`perspective(1600px) rotateY(${(i===0?-1:1)*p*30}deg) scale(${1-p*.2})`}}><div style={{padding:35,fontSize:31,fontWeight:800}}>{s}</div><div style={{padding:'0 35px',fontSize:23,lineHeight:1.8,color:C.muted}}>{e.detail}</div></Panel>)}
 <div style={{...placed(360,40,940,510),opacity:p,transform:`scale(${.7+.3*p})`,borderRadius:18,background:'#fff',boxShadow:C.shadow,padding:'38px 46px'}}>
 <div style={{display:'flex',alignItems:'center',gap:22}}><div style={{background:'#EAF8EF',padding:24,borderRadius:14,color:C.green}}><ProductIcon name="user" size={49}/></div><div style={{fontSize:33,fontWeight:800}}>{e.title}<div style={{fontSize:22,color:C.muted,marginTop:12,fontWeight:500}}>{e.detail}</div></div></div>
 <div style={{marginTop:32,display:'flex',gap:15}}>{tags.map((s,i)=><span key={i} style={{borderRadius:7,padding:'12px 20px',fontSize:23,fontWeight:700,background:colors[i]+'16',display:'flex',alignItems:'center',gap:8}}><ProductIcon name={['scan','user','chart','settings'][i]} size={24} color={colors[i]}/>{s}</span>)}</div>
 <div style={{marginTop:36,height:1,background:C.line}}/><div style={{display:'flex',alignItems:'center',gap:20,marginTop:34,fontSize:27,fontWeight:800}}><ProductIcon name="bell" color={C.green} size={33}/>{followups[0]}<span style={{color:C.green}}>→</span><ProductIcon name="case" color={C.green} size={33}/>{followups[1]}</div>{ui.note&&<div style={{marginTop:35,fontSize:20,color:C.muted}}>{ui.note}</div>}
 </div>
 </FitProduct>;
}
