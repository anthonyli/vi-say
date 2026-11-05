// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React,{useId} from 'react';
import {PanelMergeEffect,ScanEffect,ChartEffect,NetworkEffect,DocumentEffect} from './product-views';
import {NodeEditorEffect} from './node-editor';
import {AbsoluteFill} from 'remotion';

export function StudioBackdrop({time=0}){
  const id=useId().replaceAll(':',''),drift=Math.sin(time*.18)*28;
  return <AbsoluteFill style={{overflow:'hidden',background:'linear-gradient(125deg,#FCFFFD 4%,#F4FAF7 44%,#E6F7EF 100%)'}}>
    <div style={{position:'absolute',left:1000+drift,top:-370,width:1300,height:1100,background:'radial-gradient(ellipse,#8DE5BC66,transparent 68%)',transform:'rotate(-18deg)'}}/>
    <svg width="1920" height="1080" style={{position:'absolute',transform:`translate(${drift}px,${Math.cos(time*.12)*12}px)`}}><defs><linearGradient id={id}><stop stopColor="#BDEBD1" stopOpacity=".3"/><stop offset=".5" stopColor="#E3F7EB" stopOpacity=".68"/><stop offset="1" stopColor="#B9E7D1" stopOpacity=".35"/></linearGradient></defs><path d="M2200 -230C1280 -240 1820 850 2170 1050" fill="none" stroke={`url(#${id})`} strokeWidth="260"/><path d="M2230 -240C1310 -230 1850 850 2200 1050" fill="none" stroke="#fff" strokeWidth="2"/><path d="M-320 1120C70 830 260 1165 1020 1190" fill="none" stroke="#C6EBD6" strokeOpacity=".55" strokeWidth="160"/></svg>
  </AbsoluteFill>;
}
export const BUSINESS_RENDERERS=Object.freeze({
  'panel-merge':(e,t)=><PanelMergeEffect effect={e} time={t}/>,
  'node-editor':(e,t)=><NodeEditorEffect effect={e} time={t}/>,
  network:(e,t)=><NetworkEffect effect={e} time={t}/>,
  document:(e,t)=><DocumentEffect effect={e} time={t}/>,
  chart:(e,t)=><ChartEffect effect={e} time={t}/>,
  scan:(e,t)=><ScanEffect effect={e} time={t}/>,
});
