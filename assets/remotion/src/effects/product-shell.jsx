// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
export const PRODUCT={ink:'#172A26',muted:'#6C7974',line:'#E4EAE7',surface:'#F7F8FC',green:'#12B455',blue:'#2E90FA',purple:'#6200EA',orange:'#F47345',shadow:'0 30px 65px rgba(26,62,44,.15), 0 5px 14px rgba(26,62,44,.035)'};
export const placed=(left,top,width,height)=>({position:'absolute',left,top,width,height});
export {PRODUCT_ICONS} from '../../effects/node-editor.mjs';
export function ProductIcon({name='settings',size=24,color='currentColor'}){
  const shapes={
    shield:<><path d="M12 3 21 7v6c0 5-9 9-9 9s-9-4-9-9V7Z"/><path d="m8 12 3 3 5-6"/></>,
    chart:<path d="M3 3v18h18M6 16l5-6 4 3 6-8"/>,user:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,
    scan:<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M6 12h12M9 8h6M9 16h6"/>,
    settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="16" cy="12" r="2" fill="#fff"/><circle cx="8" cy="18" r="2" fill="#fff"/></>,
    bell:<path d="M5 16h14l-2-4V9a5 5 0 0 0-10 0v3ZM9 20h6"/>,network:<><circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="m10 8-4 7m8-7 4 7M8 18h8"/></>,
    case:<path d="M3 7h18v14H3ZM8 7V3h8v4M3 12h18M10 12v3h4v-3"/>,report:<path d="M5 2h10l5 5v15H5ZM15 2v6h5M9 12h7M9 16h7"/>,lock:<><rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/></>,
    bolt:<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>,check:<path d="m4 12 5 5L20 6"/>,play:<path d="m8 4 13 8L8 20Z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{shapes[name]}</svg>;
}
export const DEFAULT_NAV=[['chart','Overview'],['user','Objects'],['scan','Search'],['settings','Workflow studio'],['bell','Activity'],['network','Relationships'],['case','Tasks'],['report','Reports']].map(([icon,label])=>({icon,label}));
export function ProductShell({children,ui={},accent=PRODUCT.green}){
  const nav=ui.nav??DEFAULT_NAV,active=ui.activeNav??3;
  return <div style={{...placed(0,0,1600,740),background:PRODUCT.surface,borderRadius:18,boxShadow:PRODUCT.shadow,overflow:'hidden',color:PRODUCT.ink,fontWeight:500}}>
    <div style={{...placed(0,0,225,740),background:'#fff',borderRight:`1px solid ${PRODUCT.line}`}}>
      <div style={{margin:'30px 22px 36px',fontWeight:800,fontSize:Math.min(27,136/((ui.brand??'WORKSPACE').length*.7)),letterSpacing:'-.035em',display:'flex',alignItems:'center',gap:12}}><ProductIcon name="shield" size={30} color={accent}/>{ui.brand??'WORKSPACE'}</div>
      {nav.map((n,i)=><div key={i} style={{height:54,margin:'5px 12px',padding:'0 13px',borderRadius:8,display:'flex',alignItems:'center',gap:13,fontSize:17,fontWeight:i===active?800:500,color:i===active?accent:PRODUCT.muted,background:i===active?accent+'10':'transparent'}}><ProductIcon name={n.icon} size={22}/>{n.label}</div>)}
      <div style={{...placed(26,645,180,50),display:'flex',alignItems:'center',gap:10,fontSize:16,color:PRODUCT.muted}}><ProductIcon name="lock" size={20}/>{ui.footer??'Connected workspace'}</div>
    </div>
    <div style={{...placed(225,0,1375,70),display:'flex',alignItems:'center',padding:'0 30px',borderBottom:`1px solid ${PRODUCT.line}`,background:'#fff',fontSize:20,fontWeight:750}}>{ui.title??'Workflow studio / Process builder'}<span style={{marginLeft:'auto',borderRadius:7,padding:'8px 13px',fontSize:14,background:accent+'10',color:accent,fontWeight:700}}>{ui.workspace??'Team workspace'}</span><span style={{marginLeft:22,width:30,height:30,borderRadius:'50%',background:'#EEF2EF',display:'grid',placeItems:'center',fontSize:13}}>{ui.avatar??'ME'}</span></div>
    {children}
  </div>;
}
